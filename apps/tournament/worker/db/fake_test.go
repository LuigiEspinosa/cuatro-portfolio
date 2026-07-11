package db

import (
	"context"
	"errors"
	"testing"
)

func TestFakeRecorderCapturesRows(t *testing.T) {
	rec := NewFakeRecorder()
	row := DemoRow{MatchID: 5, StorageBackend: "r2", StorageKey: "demos/5/a.dem", SizeBytes: 100, Source: "matchzy", SHA256: "abc"}
	out, err := rec.RecordDemo(context.Background(), row)
	if err != nil {
		t.Fatal(err)
	}
	if !out.Inserted || out.ExistingKey != row.StorageKey {
		t.Fatalf("first record should insert and return its own key, got %+v", out)
	}
	got := rec.Recorded()
	if len(got) != 1 || got[0] != row {
		t.Fatalf("unexpected captured rows: %+v", got)
	}
}

func TestFakeRecorderDedupsRepeat(t *testing.T) {
	rec := NewFakeRecorder()
	first := DemoRow{MatchID: 5, StorageBackend: "r2", StorageKey: "demos/5/first.dem", Source: "matchzy", SHA256: "sha-a"}
	dup := DemoRow{MatchID: 5, StorageBackend: "r2", StorageKey: "demos/5/second.dem", Source: "matchzy", SHA256: "sha-a"}
	if _, err := rec.RecordDemo(context.Background(), first); err != nil {
		t.Fatal(err)
	}
	out, err := rec.RecordDemo(context.Background(), dup)
	if err != nil {
		t.Fatal(err)
	}
	if out.Inserted {
		t.Fatal("a repeat (MatchID, SHA256) must not insert")
	}
	if out.ExistingKey != first.StorageKey {
		t.Fatalf("dedup must return the FIRST row's key, got %q", out.ExistingKey)
	}
	if len(rec.Recorded()) != 1 {
		t.Fatalf("a duplicate must not be captured, have %d rows", len(rec.Recorded()))
	}

	// A different match with the same sha256 is genuinely distinct — it inserts (no false dedup).
	other := DemoRow{MatchID: 6, StorageBackend: "r2", StorageKey: "demos/6/x.dem", Source: "matchzy", SHA256: "sha-a"}
	out, err = rec.RecordDemo(context.Background(), other)
	if err != nil {
		t.Fatal(err)
	}
	if !out.Inserted || len(rec.Recorded()) != 2 {
		t.Fatalf("same sha256 under a different match must insert, got %+v (%d rows)", out, len(rec.Recorded()))
	}
}

func TestFakeRecorderNullSHA256NeverDedups(t *testing.T) {
	// The manual path records a NULL/empty SHA256; NULLs are distinct in the UNIQUE, so two such rows for
	// the same match both insert.
	rec := NewFakeRecorder()
	row := DemoRow{MatchID: 7, StorageBackend: "r2", Source: "manual_upload"}
	row.StorageKey = "demos/7/n1.dem"
	if _, err := rec.RecordDemo(context.Background(), row); err != nil {
		t.Fatal(err)
	}
	row.StorageKey = "demos/7/n2.dem"
	out, err := rec.RecordDemo(context.Background(), row)
	if err != nil {
		t.Fatal(err)
	}
	if !out.Inserted || len(rec.Recorded()) != 2 {
		t.Fatalf("NULL-sha256 rows must not dedup, got %+v (%d rows)", out, len(rec.Recorded()))
	}
}

func TestFakeRecorderReturnsConfiguredErr(t *testing.T) {
	rec := NewFakeRecorder()
	rec.Err = errors.New("boom")
	if _, err := rec.RecordDemo(context.Background(), DemoRow{}); err == nil {
		t.Fatal("expected the configured error")
	}
	if len(rec.Recorded()) != 0 {
		t.Fatal("must not capture a row when Err is set")
	}
}
