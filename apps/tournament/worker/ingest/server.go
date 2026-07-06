package ingest

import (
	"crypto/subtle"
	"encoding/json"
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

// Server is the worker's HTTP ingest surface (serve mode): the MatchZy auto-upload receiver and the
// admin manual-upload presign endpoint. Both are shared-secret gated (constant-time). The 50–170 MB
// bytes reach this Go worker (or R2 directly) — never a Vercel/Next.js function (SPEC Constraint 6).
type Server struct {
	Store    store.DemoStore
	Recorder db.DemoRecorder
	Secret   string // WORKER_MATCHZY_SHARED_SECRET; empty => every request fails closed
}

// Routes wires the HTTP handlers (Go 1.22+ method-pattern mux).
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /ingest/matchzy", s.handleMatchZy)
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

	key, err := Acquire(r.Context(), s.Store, s.Recorder, AcquireMeta{
		MatchID: matchID,
		Source:  SourceMatchzy,
	}, dem)
	if err != nil {
		log.Printf("[matchzy] acquire match %d: %v", matchID, err)
		http.Error(w, "acquire failed", http.StatusInternalServerError)
		return
	}
	log.Printf("[matchzy] acquired match %d -> %s", matchID, key)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "storage_key": key})
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
