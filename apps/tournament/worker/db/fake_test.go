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

// TestFakeRecorderAssignsDemoID proves the 3.3 provenance ripple in the fake: a fresh record gets a
// non-zero id, distinct demos get distinct ids, and a dedup returns the FIRST row's id (the provenance
// the prior parse used) rather than minting a new one.
func TestFakeRecorderAssignsDemoID(t *testing.T) {
	rec := NewFakeRecorder()
	first, err := rec.RecordDemo(context.Background(), DemoRow{MatchID: 5, StorageBackend: "r2", StorageKey: "demos/5/a.dem", Source: "matchzy", SHA256: "sha-a"})
	if err != nil {
		t.Fatal(err)
	}
	if first.DemoID == 0 {
		t.Fatal("a fresh record must get a non-zero fake DemoID (stat_row.demo_id provenance)")
	}
	second, err := rec.RecordDemo(context.Background(), DemoRow{MatchID: 6, StorageBackend: "r2", StorageKey: "demos/6/b.dem", Source: "matchzy", SHA256: "sha-b"})
	if err != nil {
		t.Fatal(err)
	}
	if second.DemoID == first.DemoID {
		t.Fatalf("distinct demos must get distinct ids, both %d", first.DemoID)
	}
	dup, err := rec.RecordDemo(context.Background(), DemoRow{MatchID: 5, StorageBackend: "r2", StorageKey: "demos/5/dup.dem", Source: "matchzy", SHA256: "sha-a"})
	if err != nil {
		t.Fatal(err)
	}
	if dup.Inserted || dup.DemoID != first.DemoID {
		t.Fatalf("a dedup must return the FIRST row's id: got inserted=%v id=%d want id=%d", dup.Inserted, dup.DemoID, first.DemoID)
	}
}

// TestFakeStatRecorderUpsertIdempotency proves the in-memory upsert mirror behaves like ON CONFLICT
// (match_id, steamid64) DO UPDATE: a repeated pair REPLACES (latest wins), it does not append.
func TestFakeStatRecorderUpsertIdempotency(t *testing.T) {
	rec := NewFakeStatRecorder()
	ctx := context.Background()
	if err := rec.RecordParse(ctx, 1, "v", []StatRow{{MatchID: 33, SteamID64: "76561197960287930", DemoID: 1, Kills: 20, Deaths: 14, RoundsPlayed: 24}}); err != nil {
		t.Fatal(err)
	}
	if err := rec.RecordParse(ctx, 2, "v", []StatRow{{MatchID: 33, SteamID64: "76561197960287930", DemoID: 2, Kills: 25, Deaths: 10, RoundsPlayed: 26}}); err != nil {
		t.Fatal(err)
	}
	up := rec.Upserted()
	if len(up) != 1 {
		t.Fatalf("a repeated (match_id, steamid64) must upsert to ONE row, got %d", len(up))
	}
	if up[0].Kills != 25 || up[0].Deaths != 10 || up[0].RoundsPlayed != 26 || up[0].DemoID != 2 {
		t.Fatalf("the upsert must keep the LATEST values, got %+v", up[0])
	}
	if len(rec.Calls()) != 2 {
		t.Fatalf("both RecordParse calls must be captured, got %d", len(rec.Calls()))
	}
}

func TestFakeStatRecorderReturnsConfiguredErr(t *testing.T) {
	rec := NewFakeStatRecorder()
	rec.Err = errors.New("boom")
	if err := rec.RecordParse(context.Background(), 1, "v", []StatRow{{MatchID: 1, SteamID64: "76561197960287930", DemoID: 1}}); err == nil {
		t.Fatal("expected the configured error")
	}
	if len(rec.Calls()) != 0 || len(rec.Upserted()) != 0 {
		t.Fatal("must not capture/upsert anything when Err is set")
	}
}
