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

	key, err := RunCLI(context.Background(), s, rec, path, 33)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := s.Object(key); !ok {
		t.Fatal("object not stored")
	}
	rows := rec.Recorded()
	if len(rows) != 1 || rows[0].MatchID != 33 || rows[0].Source != SourceManualUpload {
		t.Fatalf("unexpected recorded rows: %+v", rows)
	}
	if rows[0].SizeBytes != int64(len(demoBytes())) {
		t.Fatal("CLI size should be the file size")
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
