package ingest

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"cs-tournament/worker/db"
	"cs-tournament/worker/store"
)

const testSecret = "s3cr3t-shared-token"

// recordingEnqueuer is an Enqueuer for tests that only need to assert WHICH jobs were submitted (fresh
// acquire enqueues; AlreadyIngested does not; POST /ingest/parse enqueues the resolved demo) without running
// the parse. The real end-to-end 200-then-parse path uses a live *Runner (see TestMatchZyParsesOffRequest).
type recordingEnqueuer struct {
	mu   sync.Mutex
	jobs []Job
}

func (e *recordingEnqueuer) Enqueue(j Job) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.jobs = append(e.jobs, j)
}

func (e *recordingEnqueuer) Jobs() []Job {
	e.mu.Lock()
	defer e.mu.Unlock()
	out := make([]Job, len(e.jobs))
	copy(out, e.jobs)
	return out
}

func newTestServer() (*Server, *store.FakeStore, *db.FakeRecorder, *recordingEnqueuer) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	rq := &recordingEnqueuer{}
	return &Server{Store: s, Recorder: rec, Secret: testSecret, Enqueuer: rq}, s, rec, rq
}

func gzipped(b []byte) *bytes.Buffer {
	var buf bytes.Buffer
	zw := gzip.NewWriter(&buf)
	_, _ = zw.Write(b)
	zw.Close()
	return &buf
}

func TestMatchZyHappyPathBearer(t *testing.T) {
	srv, s, rec, rq := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/ingest/matchzy", gzipped(demoBytes()))
	req.Header.Set("Authorization", "Bearer "+testSecret)
	req.Header.Set("MatchZy-MatchId", "55")
	rw := httptest.NewRecorder()

	srv.Routes().ServeHTTP(rw, req)

	if rw.Code != http.StatusOK {
		t.Fatalf("want 200, got %d (%s)", rw.Code, rw.Body.String())
	}
	if s.Len() != 1 {
		t.Fatalf("want 1 stored object, got %d", s.Len())
	}
	rows := rec.Recorded()
	if len(rows) != 1 || rows[0].MatchID != 55 || rows[0].Source != SourceMatchzy {
		t.Fatalf("unexpected recorded rows: %+v", rows)
	}
	if rows[0].SizeBytes != int64(len(demoBytes())) {
		t.Fatalf("streamed size should be the decompressed .dem length, got %d", rows[0].SizeBytes)
	}
	var resp map[string]any
	if err := json.Unmarshal(rw.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp["ok"] != true || resp["already_ingested"] != false {
		t.Fatalf("unexpected success body: %v", resp)
	}
	if _, ok := resp["storage_key"].(string); !ok {
		t.Fatalf("success body must carry a storage_key: %v", resp)
	}
	// Story 3.8: a FRESH acquire enqueues exactly one parse job carrying the acquire's {matchID, demoID,
	// storageKey} — the parse runs OFF this request (the 200 above did not wait for it).
	jobs := rq.Jobs()
	if len(jobs) != 1 || jobs[0].MatchID != 55 || jobs[0].DemoID == 0 || jobs[0].StorageKey != resp["storage_key"] {
		t.Fatalf("a fresh acquire must enqueue exactly one parse job for the acquired demo, got %+v", jobs)
	}
}

func TestMatchZyReUploadIsAlreadyIngested(t *testing.T) {
	srv, s, rec, rq := newTestServer()
	post := func() *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/ingest/matchzy", gzipped(demoBytes()))
		req.Header.Set("Authorization", "Bearer "+testSecret)
		req.Header.Set("MatchZy-MatchId", "77")
		rw := httptest.NewRecorder()
		srv.Routes().ServeHTTP(rw, req)
		return rw
	}

	first := post()
	if first.Code != http.StatusOK {
		t.Fatalf("first POST: want 200, got %d (%s)", first.Code, first.Body.String())
	}

	second := post()
	if second.Code != http.StatusOK {
		t.Fatalf("re-POST: want 200 (idempotent retry), got %d", second.Code)
	}
	var resp map[string]any
	if err := json.Unmarshal(second.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp["already_ingested"] != true {
		t.Fatalf("an identical re-POST must return already_ingested:true, got %v", resp)
	}
	if len(rec.Recorded()) != 1 {
		t.Fatalf("an identical re-POST must not add a demo row, have %d", len(rec.Recorded()))
	}
	if s.Len() != 1 {
		t.Fatalf("the redundant re-uploaded object must be deleted, objects=%d", s.Len())
	}
	// Story 3.8 (AD-3): the FRESH first POST enqueued one job; the AlreadyIngested re-POST enqueued NONE
	// (its stat rows already exist — re-parsing would be needless). Exactly ONE job across the two POSTs.
	if jobs := rq.Jobs(); len(jobs) != 1 || jobs[0].MatchID != 77 {
		t.Fatalf("only the fresh acquire may enqueue; an AlreadyIngested re-POST must enqueue no job, got %+v", jobs)
	}
}

func TestMatchZyTokenQueryParam(t *testing.T) {
	srv, s, _, _ := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/ingest/matchzy?token="+testSecret, gzipped(demoBytes()))
	req.Header.Set("MatchZy-MatchId", "9")
	rw := httptest.NewRecorder()

	srv.Routes().ServeHTTP(rw, req)

	if rw.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rw.Code)
	}
	if s.Len() != 1 {
		t.Fatal("object not stored via token-query auth")
	}
}

func TestMatchZyRejectsBadSecret(t *testing.T) {
	srv, s, rec, _ := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/ingest/matchzy", gzipped(demoBytes()))
	req.Header.Set("Authorization", "Bearer wrong-token")
	req.Header.Set("MatchZy-MatchId", "1")
	rw := httptest.NewRecorder()

	srv.Routes().ServeHTTP(rw, req)

	if rw.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", rw.Code)
	}
	if s.Len() != 0 || len(rec.Recorded()) != 0 {
		t.Fatal("nothing must be stored/recorded on a bad secret")
	}
}

func TestMatchZyRejectsMissingSecret(t *testing.T) {
	srv, s, _, _ := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/ingest/matchzy", gzipped(demoBytes()))
	req.Header.Set("MatchZy-MatchId", "1")
	rw := httptest.NewRecorder()

	srv.Routes().ServeHTTP(rw, req)

	if rw.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", rw.Code)
	}
	if s.Len() != 0 {
		t.Fatal("nothing must be stored on a missing secret")
	}
}

func TestMatchZyMissingMatchIdHeader(t *testing.T) {
	srv, s, _, _ := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/ingest/matchzy", gzipped(demoBytes()))
	req.Header.Set("Authorization", "Bearer "+testSecret)
	rw := httptest.NewRecorder()

	srv.Routes().ServeHTTP(rw, req)

	if rw.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", rw.Code)
	}
	if s.Len() != 0 {
		t.Fatal("nothing must be stored when the match id is missing")
	}
}

func TestPresignHappyPath(t *testing.T) {
	srv, _, _, _ := newTestServer()
	body, _ := json.Marshal(presignRequest{MatchID: 12})
	req := httptest.NewRequest(http.MethodPost, "/ingest/presign", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+testSecret)
	rw := httptest.NewRecorder()

	srv.Routes().ServeHTTP(rw, req)

	if rw.Code != http.StatusOK {
		t.Fatalf("want 200, got %d (%s)", rw.Code, rw.Body.String())
	}
	var resp presignResponse
	if err := json.Unmarshal(rw.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.URL == "" || !strings.HasPrefix(resp.StorageKey, "demos/12/") {
		t.Fatalf("unexpected presign response: %+v", resp)
	}
}

func TestPresignRejectsBadSecret(t *testing.T) {
	srv, _, _, _ := newTestServer()
	body, _ := json.Marshal(presignRequest{MatchID: 12})
	req := httptest.NewRequest(http.MethodPost, "/ingest/presign", bytes.NewReader(body))
	rw := httptest.NewRecorder()

	srv.Routes().ServeHTTP(rw, req)

	if rw.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", rw.Code)
	}
}

func TestPresignRejectsBadMatchID(t *testing.T) {
	srv, _, _, _ := newTestServer()
	body, _ := json.Marshal(presignRequest{MatchID: 0})
	req := httptest.NewRequest(http.MethodPost, "/ingest/presign", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+testSecret)
	rw := httptest.NewRecorder()

	srv.Routes().ServeHTTP(rw, req)

	if rw.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", rw.Code)
	}
}

// blockingParser holds each Parse until release is closed — it lets the async test PROVE the 200 returns
// WITHOUT waiting for the parse (AC1/AC3): the request completes while the parse is still blocked.
type blockingParser struct {
	release <-chan struct{}
	result  ParseResult
}

func (p blockingParser) Parse(r io.Reader) (ParseResult, error) {
	_, _ = io.Copy(io.Discard, r)
	<-p.release
	return p.result, nil
}

// TestMatchZyParsesOffRequest is the AC1/AC3 heart: a fresh MatchZy upload returns 200 as soon as the bytes
// are durable (it does NOT block on the parse — proven by a blockingParser that is still held when the 200
// arrives), then the off-request job parses and RecordParses the rows once released.
func TestMatchZyParsesOffRequest(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	statRec := db.NewFakeStatRecorder()
	release := make(chan struct{})
	parser := blockingParser{release: release, result: cannedParse()}
	runner := NewRunner(s, parser, statRec, cannedRoster(), LogAlerter{})
	done := make(chan Job, 1)
	runner.onJobDone = func(j Job, _ error) { done <- j }
	runner.Start(context.Background())
	t.Cleanup(runner.Close)
	srv := &Server{Store: s, Recorder: rec, Secret: testSecret, Enqueuer: runner}

	req := httptest.NewRequest(http.MethodPost, "/ingest/matchzy", gzipped(demoBytes()))
	req.Header.Set("Authorization", "Bearer "+testSecret)
	req.Header.Set("MatchZy-MatchId", "88")
	rw := httptest.NewRecorder()
	srv.Routes().ServeHTTP(rw, req)

	// The parse is STILL blocked (release not closed) yet the request already returned 200 — the response
	// was not gated on the ~seconds parse (a slow parse must never time out MatchZy's upload).
	if rw.Code != http.StatusOK {
		t.Fatalf("want a fast off-request 200, got %d (%s)", rw.Code, rw.Body.String())
	}
	if len(statRec.Calls()) != 0 {
		t.Fatal("the parse must NOT have run yet — the 200 returned off-request while the parser is blocked")
	}
	var resp map[string]any
	if err := json.Unmarshal(rw.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	storageKey, _ := resp["storage_key"].(string)

	// Release the parse and wait for the off-request job to finish; then assert it recorded the parsed rows.
	close(release)
	select {
	case j := <-done:
		if j.MatchID != 88 || j.StorageKey != storageKey {
			t.Fatalf("completed job mismatch: %+v (want match 88, key %s)", j, storageKey)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("the off-request parse job did not complete within 2s")
	}
	calls := statRec.Calls()
	if len(calls) != 1 || len(calls[0].Rows) != 2 {
		t.Fatalf("the off-request job must RecordParse the 2 parsed rows exactly once, got %+v", calls)
	}
	if calls[0].DemoID == 0 || calls[0].ParserVersion != ParserVersion {
		t.Fatalf("RecordParse must carry the fresh demo id + pinned parser version, got %+v", calls[0])
	}
	if calls[0].Val.Anomalous {
		t.Fatalf("a balanced+rostered parse must validate clean, got %+v", calls[0].Val)
	}
}

func TestParseEndpointEnqueuesKnownMatch(t *testing.T) {
	rq := &recordingEnqueuer{}
	demos := db.NewFakeDemoReader(db.DemoRef{DemoID: 7, StorageKey: "demos/42/abc.dem", SHA256: "deadbeef"})
	srv := &Server{Store: store.NewFakeStore(), Recorder: db.NewFakeRecorder(), Secret: testSecret, Enqueuer: rq, Demos: demos}

	body, _ := json.Marshal(parseRequest{MatchID: 42})
	req := httptest.NewRequest(http.MethodPost, "/ingest/parse", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+testSecret)
	rw := httptest.NewRecorder()
	srv.Routes().ServeHTTP(rw, req)

	if rw.Code != http.StatusAccepted {
		t.Fatalf("want 202 Accepted for a known match, got %d (%s)", rw.Code, rw.Body.String())
	}
	jobs := rq.Jobs()
	if len(jobs) != 1 || jobs[0].MatchID != 42 || jobs[0].DemoID != 7 || jobs[0].StorageKey != "demos/42/abc.dem" {
		t.Fatalf("POST /ingest/parse must enqueue the resolved demo of record, got %+v", jobs)
	}
}

func TestParseEndpoint404OnUnknownMatch(t *testing.T) {
	rq := &recordingEnqueuer{}
	demos := &db.FakeDemoReader{Err: fmt.Errorf("%w 999", db.ErrNoDemo)} // fail-closed no-demo path (ErrNoDemo => 404)
	srv := &Server{Store: store.NewFakeStore(), Recorder: db.NewFakeRecorder(), Secret: testSecret, Enqueuer: rq, Demos: demos}

	body, _ := json.Marshal(parseRequest{MatchID: 999})
	req := httptest.NewRequest(http.MethodPost, "/ingest/parse", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+testSecret)
	rw := httptest.NewRecorder()
	srv.Routes().ServeHTTP(rw, req)

	if rw.Code != http.StatusNotFound {
		t.Fatalf("want 404 when the match has no retained demo, got %d", rw.Code)
	}
	if len(rq.Jobs()) != 0 {
		t.Fatal("no job may be enqueued when there is no retained demo")
	}
}

// TestParseEndpoint500OnLookupFault: a transient/infra demo-lookup fault (NOT db.ErrNoDemo) must surface as a
// 500 — never masquerade as a 404 "no demo" — so the operator can tell "nothing to parse" apart from "the DB
// was momentarily unreachable." No job is enqueued.
func TestParseEndpoint500OnLookupFault(t *testing.T) {
	rq := &recordingEnqueuer{}
	demos := &db.FakeDemoReader{Err: errors.New("connection reset by peer")} // a transient fault, not ErrNoDemo
	srv := &Server{Store: store.NewFakeStore(), Recorder: db.NewFakeRecorder(), Secret: testSecret, Enqueuer: rq, Demos: demos}

	body, _ := json.Marshal(parseRequest{MatchID: 42})
	req := httptest.NewRequest(http.MethodPost, "/ingest/parse", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+testSecret)
	rw := httptest.NewRecorder()
	srv.Routes().ServeHTTP(rw, req)

	if rw.Code != http.StatusInternalServerError {
		t.Fatalf("a transient demo-lookup fault must be a 500 (not masked as a 404 no-demo), got %d", rw.Code)
	}
	if len(rq.Jobs()) != 0 {
		t.Fatal("no job may be enqueued when the demo lookup faulted")
	}
}

func TestParseEndpointRejectsBadSecret(t *testing.T) {
	rq := &recordingEnqueuer{}
	srv := &Server{Store: store.NewFakeStore(), Recorder: db.NewFakeRecorder(), Secret: testSecret, Enqueuer: rq, Demos: db.NewFakeDemoReader(db.DemoRef{DemoID: 1, StorageKey: "k"})}
	body, _ := json.Marshal(parseRequest{MatchID: 42})
	req := httptest.NewRequest(http.MethodPost, "/ingest/parse", bytes.NewReader(body))
	rw := httptest.NewRecorder()
	srv.Routes().ServeHTTP(rw, req)

	if rw.Code != http.StatusUnauthorized {
		t.Fatalf("want 401 on a missing secret, got %d", rw.Code)
	}
	if len(rq.Jobs()) != 0 {
		t.Fatal("an unauthorized parse trigger must enqueue nothing")
	}
}

func TestParseEndpointRejectsBadMatchID(t *testing.T) {
	rq := &recordingEnqueuer{}
	srv := &Server{Store: store.NewFakeStore(), Recorder: db.NewFakeRecorder(), Secret: testSecret, Enqueuer: rq, Demos: db.NewFakeDemoReader(db.DemoRef{DemoID: 1, StorageKey: "k"})}
	body, _ := json.Marshal(parseRequest{MatchID: 0})
	req := httptest.NewRequest(http.MethodPost, "/ingest/parse", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+testSecret)
	rw := httptest.NewRecorder()
	srv.Routes().ServeHTTP(rw, req)

	if rw.Code != http.StatusBadRequest {
		t.Fatalf("want 400 on a non-positive match_id, got %d", rw.Code)
	}
	if len(rq.Jobs()) != 0 {
		t.Fatal("a rejected match_id must enqueue nothing")
	}
}
