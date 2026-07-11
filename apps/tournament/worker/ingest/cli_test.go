package ingest

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"cs-tournament/worker/db"
	"cs-tournament/worker/store"
)

func writeTemp(t *testing.T, name string, content []byte) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(p, content, 0o600); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestRunCLIHappyPath(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	path := writeTemp(t, "cache.dem", demoBytes())

	res, err := RunCLI(context.Background(), s, rec, path, 33)
	if err != nil {
		t.Fatal(err)
	}
	if res.AlreadyIngested {
		t.Fatal("a fresh CLI ingest must not be already_ingested")
	}
	if _, ok := s.Object(res.StorageKey); !ok {
		t.Fatal("object not stored")
	}
	rows := rec.Recorded()
	if len(rows) != 1 || rows[0].MatchID != 33 || rows[0].Source != SourceManualUpload {
		t.Fatalf("unexpected recorded rows: %+v", rows)
	}
	if rows[0].SizeBytes != int64(len(demoBytes())) {
		t.Fatal("CLI size should be the file size")
	}
	if rows[0].SHA256 == "" {
		t.Fatal("the CLI path must record a non-empty demo_sha256")
	}

	// Re-running the CLI on the SAME .dem + match short-circuits (an operator sees already_ingested, not
	// a silent second store).
	again, err := RunCLI(context.Background(), s, rec, path, 33)
	if err != nil {
		t.Fatal(err)
	}
	if !again.AlreadyIngested || again.StorageKey != res.StorageKey {
		t.Fatalf("re-running the CLI on the same .dem must report already_ingested with the prior key, got %+v", again)
	}
	if len(rec.Recorded()) != 1 || s.Len() != 1 {
		t.Fatalf("the re-run must not add a row/object: rows=%d objects=%d", len(rec.Recorded()), s.Len())
	}
}

func TestRunCLIRejectsNonSource2(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	path := writeTemp(t, "old.dem", []byte("HL2DEMO\x00 a CS:GO Source-1 demo"))

	if _, err := RunCLI(context.Background(), s, rec, path, 1); err == nil {
		t.Fatal("expected rejection of a non-PBDEMS2 (Source-1) file")
	}
	if s.Len() != 0 || len(rec.Recorded()) != 0 {
		t.Fatal("nothing must be stored/recorded for a bad-format file")
	}
}

func TestRunCLIRequiresMatch(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	path := writeTemp(t, "cache.dem", demoBytes())

	if _, err := RunCLI(context.Background(), s, rec, path, 0); err == nil {
		t.Fatal("expected an error for a missing/zero --match")
	}
}
