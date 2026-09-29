package ingest

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"cs-tournament/worker/db"
	"cs-tournament/worker/store"
)

// presignExpiry bounds how long an admin's presigned upload URL is valid.
const presignExpiry = 15 * time.Minute

// Server is the worker's HTTP ingest surface (serve mode): the MatchZy auto-upload receiver, the admin
// manual-upload presign endpoint, and (Story 3.8) the manual/re-parse trigger. All shared-secret gated
// (constant-time). The 50–170 MB bytes reach this Go worker (or R2 directly) — never a Vercel/Next.js
// function (SPEC Constraint 6).
type Server struct {
	Store    store.DemoStore
	Recorder db.DemoRecorder
	Secret   string // WORKER_MATCHZY_SHARED_SECRET; empty => every request fails closed

	// Enqueuer is the Story-3.8 bounded async parse-job queue: handleMatchZy submits a job here after a
	// FRESH acquire so parsing runs OFF the request (the 200 returns as soon as the bytes are durable). The
	// production value is a *Runner started in runServe; tests inject a recording/real Runner.
	Enqueuer Enqueuer
	// Demos resolves a match's retained demo of record ({DemoID, StorageKey}) for the POST /ingest/parse
	// manual/re-parse trigger (Story 3.8). Reuses the same PgxDemoReader as `worker reparse`.
	Demos db.DemoReader
}

// Routes wires the HTTP handlers (Go 1.22+ method-pattern mux).
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /ingest/matchzy", s.handleMatchZy)
	mux.HandleFunc("POST /ingest/parse", s.handleParse)
	mux.HandleFunc("POST /ingest/presign", s.handlePresign)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	return mux
}

// authOK extracts the shared secret from an `Authorization` header (raw or `Bearer <secret>`) or a
// `?token=` query param — the two carriers MatchZy builds support (there is no auth-header cvar in the
// docs snapshot, so the deployed build pins which one) — and constant-time compares it. An empty
// configured secret fails closed: the worker never authenticates when unconfigured.
func (s *Server) authOK(r *http.Request) bool {
	if s.Secret == "" {
		return false
	}
	got := headerSecret(r.Header.Get("Authorization"))
	if got == "" {
		got = strings.TrimSpace(r.URL.Query().Get("token"))
	}
	if got == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(got), []byte(s.Secret)) == 1
}

// headerSecret returns the bearer token if the header is `Bearer <x>`, else the trimmed raw header
// (supports a MatchZy build that carries the secret as a raw configurable header value).
func headerSecret(h string) string {
	const prefix = "Bearer "
	if strings.HasPrefix(h, prefix) {
		return strings.TrimSpace(h[len(prefix):])
	}
	return strings.TrimSpace(h)
}

// handleMatchZy receives a finished match's demo (AC1): shared-secret auth → read MatchZy-* headers →
// decompress the (zipped/gzipped/raw) body to the canonical .dem → stream to R2 → record the row.
func (s *Server) handleMatchZy(w http.ResponseWriter, r *http.Request) {
	if !s.authOK(r) {
		log.Printf("[matchzy] rejected: bad or missing shared secret from %s", r.RemoteAddr)
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	matchID, err := strconv.ParseInt(strings.TrimSpace(r.Header.Get("MatchZy-MatchId")), 10, 64)
	if err != nil || matchID <= 0 {
		http.Error(w, "missing or invalid MatchZy-MatchId header", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Cap the request body (raw or compressed) so an oversized/hostile upload can't fill the worker's
	// disk (the zip spool) or stream an unbounded raw object to R2; the decompressed .dem is separately
	// ceilinged in decompressToDem. Both guards default to maxDemoBytes (300 MiB, ≫ the 170 MB max demo).
	dem, err := decompressToDem(http.MaxBytesReader(w, r.Body, maxDemoBytes))
	if err != nil {
		log.Printf("[matchzy] decompress match %d: %v", matchID, err)
		http.Error(w, "cannot read demo body", http.StatusBadRequest)
		return
	}
	defer dem.Close()

	res, err := Acquire(r.Context(), s.Store, s.Recorder, AcquireMeta{
		MatchID: matchID,
		Source:  SourceMatchzy,
	}, dem)
	if err != nil {
		log.Printf("[matchzy] acquire match %d: %v", matchID, err)
		http.Error(w, "acquire failed", http.StatusInternalServerError)
		return
	}
	// Story 3.8: a FRESH acquire enqueues a bounded async parse job (parse runs OFF this request — the 200
	// returns as soon as the bytes are durable in R2, never blocking on the ~3.4 s parse, so MatchZy's upload
	// does not time out). An AlreadyIngested re-upload enqueues NOTHING — its stat rows already exist (AD-3),
	// exactly as RunCLI skips the parse on AlreadyIngested; re-POSTing must not re-parse needlessly.
	if !res.AlreadyIngested {
		s.Enqueuer.Enqueue(Job{MatchID: matchID, DemoID: res.DemoID, StorageKey: res.StorageKey})
	}
	// A re-uploaded identical demo returns 200 with already_ingested:true and the prior key, so MatchZy
	// can safely retry (idempotent — AD-3).
	log.Printf("[matchzy] acquired match %d -> %s (already_ingested=%t)", matchID, res.StorageKey, res.AlreadyIngested)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "storage_key": res.StorageKey, "already_ingested": res.AlreadyIngested})
}

// handleParse is the Story-3.8 manual / re-parse trigger seam (Resolved Decision 3): a shared-secret-gated
// POST {match_id} that resolves the match's retained demo of record and enqueues a bounded async parse job,
// returning 202 Accepted (job enqueued, parse runs off-request) or 404 when the match has no retained demo.
// It gives the manual path (and future re-parse-via-HTTP) a worker-side home WITHOUT touching app/lib — the
// Next.js /api/ingest/register route calling this endpoint stays deferred (keeps git diff app/ lib/ empty).
func (s *Server) handleParse(w http.ResponseWriter, r *http.Request) {
	if !s.authOK(r) {
		log.Printf("[parse] rejected: bad or missing shared secret from %s", r.RemoteAddr)
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var req parseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	if req.MatchID <= 0 {
		http.Error(w, "match_id is required and must be positive", http.StatusBadRequest)
		return
	}
	ref, err := s.Demos.DemoForMatch(r.Context(), req.MatchID)
	if err != nil {
		if errors.Is(err, db.ErrNoDemo) {
			// A genuinely-absent demo of record => nothing to (re-)parse: a client-addressable 404.
			log.Printf("[parse] match %d: no retained demo to parse: %v", req.MatchID, err)
			http.Error(w, "no retained demo for match", http.StatusNotFound)
			return
		}
		// A transient/infra lookup fault must NOT masquerade as a 404 "no demo" — surface it as a 500 so the
		// operator can tell "nothing to parse" apart from "the DB was momentarily unreachable."
		log.Printf("[parse] match %d: demo lookup failed: %v", req.MatchID, err)
		http.Error(w, "demo lookup failed", http.StatusInternalServerError)
		return
	}
	s.Enqueuer.Enqueue(Job{MatchID: req.MatchID, DemoID: ref.DemoID, StorageKey: ref.StorageKey})
	log.Printf("[parse] match %d -> enqueued parse job for retained demo %s", req.MatchID, ref.StorageKey)
	writeJSON(w, http.StatusAccepted, map[string]any{"ok": true, "match_id": req.MatchID, "enqueued": true})
}

type parseRequest struct {
	MatchID int64 `json:"match_id"`
}

type presignRequest struct {
	MatchID int64 `json:"match_id"`
}

type presignResponse struct {
	URL        string `json:"url"`
	StorageKey string `json:"storage_key"`
}

// handlePresign mints a worker-generated R2 presigned upload URL for the admin manual path (AC2). The
// worker holds the R2 creds; the Next.js app does not. The browser PUTs the bytes to `url` directly
// (bypassing Vercel), then notifies POST /api/ingest/register {match_id, storage_key}.
func (s *Server) handlePresign(w http.ResponseWriter, r *http.Request) {
	if !s.authOK(r) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var req presignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}
	if req.MatchID <= 0 {
		http.Error(w, "match_id is required and must be positive", http.StatusBadRequest)
		return
	}
	key, err := store.NewStorageKey(req.MatchID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	url, err := s.Store.PresignPut(r.Context(), key, presignExpiry)
	if err != nil {
		log.Printf("[presign] match %d: %v", req.MatchID, err)
		http.Error(w, "presign failed", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, presignResponse{URL: url, StorageKey: key})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
