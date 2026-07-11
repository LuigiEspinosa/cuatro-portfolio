package ingest

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"cs-tournament/worker/db"
	"cs-tournament/worker/store"
)

const testSecret = "s3cr3t-shared-token"

func newTestServer() (*Server, *store.FakeStore, *db.FakeRecorder) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	return &Server{Store: s, Recorder: rec, Secret: testSecret}, s, rec
}

func gzipped(b []byte) *bytes.Buffer {
	var buf bytes.Buffer
	zw := gzip.NewWriter(&buf)
	_, _ = zw.Write(b)
	zw.Close()
	return &buf
}

func TestMatchZyHappyPathBearer(t *testing.T) {
	srv, s, rec := newTestServer()
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
}

func TestMatchZyReUploadIsAlreadyIngested(t *testing.T) {
	srv, s, rec := newTestServer()
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
}

func TestMatchZyTokenQueryParam(t *testing.T) {
	srv, s, _ := newTestServer()
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
	srv, s, rec := newTestServer()
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
	srv, s, _ := newTestServer()
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
	srv, s, _ := newTestServer()
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
	srv, _, _ := newTestServer()
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
	srv, _, _ := newTestServer()
	body, _ := json.Marshal(presignRequest{MatchID: 12})
	req := httptest.NewRequest(http.MethodPost, "/ingest/presign", bytes.NewReader(body))
	rw := httptest.NewRecorder()

	srv.Routes().ServeHTTP(rw, req)

	if rw.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", rw.Code)
	}
}

func TestPresignRejectsBadMatchID(t *testing.T) {
	srv, _, _ := newTestServer()
	body, _ := json.Marshal(presignRequest{MatchID: 0})
	req := httptest.NewRequest(http.MethodPost, "/ingest/presign", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+testSecret)
	rw := httptest.NewRecorder()

	srv.Routes().ServeHTTP(rw, req)

	if rw.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", rw.Code)
	}
}
