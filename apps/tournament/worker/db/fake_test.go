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
	if err := rec.RecordParse(ctx, 1, "v", []StatRow{{MatchID: 33, SteamID64: "76561197960287930", DemoID: 1, Kills: 20, Deaths: 14, RoundsPlayed: 24}}, ValidationOutcome{}); err != nil {
		t.Fatal(err)
	}
	if err := rec.RecordParse(ctx, 2, "v", []StatRow{{MatchID: 33, SteamID64: "76561197960287930", DemoID: 2, Kills: 25, Deaths: 10, RoundsPlayed: 26}}, ValidationOutcome{}); err != nil {
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
	if err := rec.RecordParse(context.Background(), 1, "v", []StatRow{{MatchID: 1, SteamID64: "76561197960287930", DemoID: 1}}, ValidationOutcome{}); err == nil {
		t.Fatal("expected the configured error")
	}
	if len(rec.Calls()) != 0 || len(rec.Upserted()) != 0 {
		t.Fatal("must not capture/upsert anything when Err is set")
	}
}

// TestFakeStatRecorderCapturesValidationOutcome proves the fake records the Story-3.4 validation outcome
// passed to RecordParse (so cli_test can assert the anomaly flag + reasons the worker persisted).
func TestFakeStatRecorderCapturesValidationOutcome(t *testing.T) {
	rec := NewFakeStatRecorder()
	val := ValidationOutcome{Anomalous: true, Reasons: []AnomalyReason{{Gate: "unreconciled", Detail: "76561197960287930"}}}
	if err := rec.RecordParse(context.Background(), 7, "v", []StatRow{{MatchID: 9, SteamID64: "76561197960287930", DemoID: 7}}, val); err != nil {
		t.Fatal(err)
	}
	calls := rec.Calls()
	if len(calls) != 1 {
		t.Fatalf("expected one captured call, got %d", len(calls))
	}
	if !calls[0].Val.Anomalous || len(calls[0].Val.Reasons) != 1 || calls[0].Val.Reasons[0].Gate != "unreconciled" {
		t.Fatalf("the captured validation outcome must round-trip, got %+v", calls[0].Val)
	}
}

// TestFakeStatRecorderRecordReparse proves the fake's re-parse semantics: (1) the fresh rows upsert
// (replace), (2) a prior SteamID absent from the new set is DELETED (delete-missing), (3) an approved row's
// status is PRESERVED while a new id lands pending, and (4) the per-demo generation counter bumps.
func TestFakeStatRecorderRecordReparse(t *testing.T) {
	rec := NewFakeStatRecorder()
	ctx := context.Background()
	// Prior state: an approved …930 (stale K/D), a pending …042, and a phantom …999 the new parse drops.
	rec.SeedRow("approved", StatRow{MatchID: 5, SteamID64: "76561197960287930", DemoID: 3, Kills: 1, Deaths: 1})
	rec.SeedRow("pending", StatRow{MatchID: 5, SteamID64: "76561198000000042", DemoID: 3})
	rec.SeedRow("pending", StatRow{MatchID: 5, SteamID64: "76561198000000999", DemoID: 3})

	newRows := []StatRow{
		{MatchID: 5, SteamID64: "76561197960287930", DemoID: 3, Kills: 20, Deaths: 14, RoundsPlayed: 24}, // replace
		{MatchID: 5, SteamID64: "76561198000000042", DemoID: 3, Kills: 14, Deaths: 20, RoundsPlayed: 24},
		{MatchID: 5, SteamID64: "76561198000000111", DemoID: 3, Kills: 7, Deaths: 3, RoundsPlayed: 24}, // brand-new id
	}
	if err := rec.RecordReparse(ctx, 5, 3, "v", newRows, ValidationOutcome{}); err != nil {
		t.Fatal(err)
	}

	up := rec.Upserted()
	if len(up) != 3 {
		t.Fatalf("after re-parse the match must have exactly 3 rows (…999 deleted, …111 added), got %d", len(up))
	}
	byID := map[string]StatRow{}
	for _, r := range up {
		byID[r.SteamID64] = r
	}
	if _, gone := byID["76561198000000999"]; gone {
		t.Fatal("the phantom …999 (absent from the new parse) must be delete-missing'd")
	}
	if r := byID["76561197960287930"]; r.Kills != 20 || r.Deaths != 14 {
		t.Fatalf("…930 must be replaced with the fresh K/D, got %+v", r)
	}
	if st, ok := rec.StatusOf(5, "76561197960287930"); !ok || st != "approved" {
		t.Fatalf("…930 must STAY approved (status preserved), got %q ok=%v", st, ok)
	}
	if st, ok := rec.StatusOf(5, "76561198000000111"); !ok || st != "pending" {
		t.Fatalf("the brand-new …111 must land pending, got %q ok=%v", st, ok)
	}
	if g := rec.Generation(3); g != 1 {
		t.Fatalf("the demo generation must bump once, got %d", g)
	}
	if len(rec.Reparsed()) != 1 || rec.Reparsed()[0].MatchID != 5 {
		t.Fatalf("the re-parse call must be captured with its match, got %+v", rec.Reparsed())
	}
}

// TestFakeStatRecorderReparseEmptyDeletesAll proves the empty-set revert: a zero-row re-parse removes ALL
// of the match's rows (the ARRAY[]::text[] <> ALL is-true-for-every-row case) — and only that match's.
func TestFakeStatRecorderReparseEmptyDeletesAll(t *testing.T) {
	rec := NewFakeStatRecorder()
	rec.SeedRow("approved", StatRow{MatchID: 5, SteamID64: "76561197960287930", DemoID: 3})
	rec.SeedRow("pending", StatRow{MatchID: 5, SteamID64: "76561198000000042", DemoID: 3})
	rec.SeedRow("pending", StatRow{MatchID: 6, SteamID64: "76561198000000042", DemoID: 4}) // a DIFFERENT match — must survive

	if err := rec.RecordReparse(context.Background(), 5, 3, "v", nil, ValidationOutcome{Anomalous: true}); err != nil {
		t.Fatal(err)
	}
	for _, r := range rec.Upserted() {
		if r.MatchID == 5 {
			t.Fatalf("match 5 must have no rows after an empty re-parse, found %+v", r)
		}
	}
	if _, ok := rec.StatusOf(6, "76561198000000042"); !ok {
		t.Fatal("a DIFFERENT match's rows must NOT be touched by match 5's re-parse")
	}
}

// TestFakeStatRecorderReparseReturnsConfiguredErr proves the fail-closed seam: a set Err aborts before any
// mutation (no generation bump, no delete, no capture).
func TestFakeStatRecorderReparseReturnsConfiguredErr(t *testing.T) {
	rec := NewFakeStatRecorder()
	rec.SeedRow("approved", StatRow{MatchID: 5, SteamID64: "76561197960287930", DemoID: 3})
	rec.Err = errors.New("boom")
	if err := rec.RecordReparse(context.Background(), 5, 3, "v", []StatRow{{MatchID: 5, SteamID64: "76561198000000042", DemoID: 3}}, ValidationOutcome{}); err == nil {
		t.Fatal("expected the configured error")
	}
	if len(rec.Reparsed()) != 0 || rec.Generation(3) != 0 {
		t.Fatal("a fail-closed re-parse must not capture a call or bump the generation")
	}
	if st, ok := rec.StatusOf(5, "76561197960287930"); !ok || st != "approved" {
		t.Fatal("a fail-closed re-parse must leave the prior mirror untouched")
	}
}

// TestFakeDemoReader proves the seam: NewFakeDemoReader returns the seeded ref; a configured Err surfaces
// (the fail-closed no-demo path).
func TestFakeDemoReader(t *testing.T) {
	ref := DemoRef{DemoID: 9, StorageKey: "demos/5/x.dem", SHA256: "abc"}
	r := NewFakeDemoReader(ref)
	got, err := r.DemoForMatch(context.Background(), 5)
	if err != nil {
		t.Fatal(err)
	}
	if got != ref {
		t.Fatalf("the fake must return the seeded ref, got %+v", got)
	}
	r.Err = errors.New("no retained demo")
	if _, err := r.DemoForMatch(context.Background(), 5); err == nil {
		t.Fatal("a configured Err must surface (fail-closed no-demo path)")
	}
}

// TestFakeRosterReader proves the seam: NewFakeRosterReader seeds an active set, ActiveSteamIDs returns it
// (as a copy), and a configured Err surfaces (the fail-closed roster-read path).
func TestFakeRosterReader(t *testing.T) {
	r := NewFakeRosterReader("76561197960287930", "76561198000000042")
	set, err := r.ActiveSteamIDs(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := set["76561197960287930"]; !ok {
		t.Fatal("seeded id must be present in the active set")
	}
	if len(set) != 2 {
		t.Fatalf("expected 2 active ids, got %d", len(set))
	}
	// Mutating the returned set must not corrupt the fake's state (defensive copy).
	delete(set, "76561197960287930")
	again, _ := r.ActiveSteamIDs(context.Background())
	if _, ok := again["76561197960287930"]; !ok {
		t.Fatal("mutating the returned set must not affect the fake (ActiveSteamIDs must return a copy)")
	}

	r.Err = errors.New("db down")
	if _, err := r.ActiveSteamIDs(context.Background()); err == nil {
		t.Fatal("a configured Err must surface (fail-closed roster read)")
	}
}
