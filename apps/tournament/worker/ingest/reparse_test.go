package ingest

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"testing"

	"cs-tournament/worker/db"
	"cs-tournament/worker/store"
)

// seedRetained stores body as the match's retained object and returns a DemoRef whose SHA256 is the true
// sha of those bytes (the AD-1 re-hash target) — the fixture RunReparse reads back and re-hash-verifies.
func seedRetained(t *testing.T, s *store.FakeStore, matchID, demoID int64, body []byte) db.DemoRef {
	t.Helper()
	key, err := store.NewStorageKey(matchID)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Put(context.Background(), key, bytes.NewReader(body), int64(len(body))); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(body)
	return db.DemoRef{DemoID: demoID, StorageKey: key, SHA256: hex.EncodeToString(sum[:])}
}

// upsertedByID indexes a stat recorder's mirror by SteamID64 for a given match.
func upsertedByID(rec *db.FakeStatRecorder, matchID int64) map[string]db.StatRow {
	byID := map[string]db.StatRow{}
	for _, r := range rec.Upserted() {
		if r.MatchID == matchID {
			byID[r.SteamID64] = r
		}
	}
	return byID
}

// TestRunReparseHappyPathReplacesAndBumpsGeneration: a re-parse re-derives a player's row (new K/D) from
// the RETAINED object, REPLACING (not duplicating) the prior row, and bumps the demo's generation.
func TestRunReparseHappyPathReplacesAndBumpsGeneration(t *testing.T) {
	s := store.NewFakeStore()
	ref := seedRetained(t, s, 33, 7, demoBytes())
	reader := db.NewFakeDemoReader(ref)
	statRec := db.NewFakeStatRecorder()
	// A prior parse left …930 with stale K/D (pending). The re-parse must replace it.
	statRec.SeedRow("pending", db.StatRow{MatchID: 33, SteamID64: "76561197960287930", DemoID: 7, Kills: 1, Deaths: 1, RoundsPlayed: 5})

	res, err := RunReparse(context.Background(), s, reader, FakeParser{Result: cannedParse()}, statRec, cannedRoster(), 33)
	if err != nil {
		t.Fatal(err)
	}
	if res.Players != 2 || res.Rounds != 24 || res.Anomalous {
		t.Fatalf("a clean re-parse must report 2 players / 24 rounds / not anomalous, got %+v", res)
	}
	if res.DemoID != 7 || res.StorageKey != ref.StorageKey {
		t.Fatalf("the re-parse must reuse the RETAINED demo id + key, got demo=%d key=%q", res.DemoID, res.StorageKey)
	}
	byID := upsertedByID(statRec, 33)
	if len(byID) != 2 {
		t.Fatalf("the match must have exactly 2 rows after re-parse, got %d", len(byID))
	}
	// The re-parse path assembles rows independently of RunCLI, so it carries RoundsWon independently too
	// (Story 4.6a): a re-parse must re-derive the score, not blank it. The seeded prior row had none.
	if r := byID["76561197960287930"]; r.Kills != 20 || r.Deaths != 14 || r.RoundsPlayed != 24 || r.RoundsWon != 16 {
		t.Fatalf("…930 must be REPLACED with the fresh K/D + demo-derived RoundsWon, got %+v", r)
	}
	// Stories 5.1 + 5.2: the re-parse map (reparse.go) assembles rows INDEPENDENTLY of cli.go, so it must
	// carry the FR-18 core seven AND the FR-19 weird five independently too — the recurring "second path
	// drops the widening" failure mode. A dropped field here silently writes NULL over that column on
	// every re-parse.
	assertDerivedStats(t, byID["76561197960287930"], cannedParse().Players[0])
	assertDerivedStats(t, byID["76561198000000042"], cannedParse().Players[1])
	if reparses := statRec.Reparsed(); len(reparses) != 1 || reparses[0].MatchID != 33 || reparses[0].ParserVersion != ParserVersion {
		t.Fatalf("RecordReparse must fire exactly once with the match + pinned parser version, got %+v", reparses)
	}
	if g := statRec.Generation(7); g != 1 {
		t.Fatalf("the demo generation must bump once, got %d", g)
	}
}

// TestRunReparseDeleteMissing: a player present in the PRIOR parse but ABSENT from the new one is removed
// (the AD-3 delete-missing revert half) — the surviving rows are replaced, not duplicated.
func TestRunReparseDeleteMissing(t *testing.T) {
	s := store.NewFakeStore()
	ref := seedRetained(t, s, 41, 9, demoBytes())
	reader := db.NewFakeDemoReader(ref)
	statRec := db.NewFakeStatRecorder()
	// Prior state: the two canned ids PLUS a phantom the new parse no longer contains.
	statRec.SeedRow("pending", db.StatRow{MatchID: 41, SteamID64: "76561197960287930", DemoID: 9})
	statRec.SeedRow("pending", db.StatRow{MatchID: 41, SteamID64: "76561198000000042", DemoID: 9})
	statRec.SeedRow("pending", db.StatRow{MatchID: 41, SteamID64: "76561198000000999", DemoID: 9}) // absent from the new parse

	if _, err := RunReparse(context.Background(), s, reader, FakeParser{Result: cannedParse()}, statRec, cannedRoster(), 41); err != nil {
		t.Fatal(err)
	}
	byID := upsertedByID(statRec, 41)
	if len(byID) != 2 {
		t.Fatalf("the phantom row must be DELETED, leaving 2, got %d (%v)", len(byID), byID)
	}
	if _, gone := byID["76561198000000999"]; gone {
		t.Fatal("the SteamID absent from the new parse must be removed")
	}
}

// TestRunReparseStatusPreserved (the money test for AC3): an approved row STAYS approved through a re-parse
// (no flicker to pending), while a genuinely-new SteamID lands pending.
func TestRunReparseStatusPreserved(t *testing.T) {
	s := store.NewFakeStore()
	ref := seedRetained(t, s, 60, 12, demoBytes())
	reader := db.NewFakeDemoReader(ref)
	statRec := db.NewFakeStatRecorder()
	// Simulate a future Aprobar: …930 is already approved. …042 does NOT exist yet (a new id this parse).
	statRec.SeedRow("approved", db.StatRow{MatchID: 60, SteamID64: "76561197960287930", DemoID: 12, Kills: 3, Deaths: 3})

	if _, err := RunReparse(context.Background(), s, reader, FakeParser{Result: cannedParse()}, statRec, cannedRoster(), 60); err != nil {
		t.Fatal(err)
	}
	if st, ok := statRec.StatusOf(60, "76561197960287930"); !ok || st != "approved" {
		t.Fatalf("the approved row must STAY approved through the re-parse (no Pending flicker), got status=%q ok=%v", st, ok)
	}
	if st, ok := statRec.StatusOf(60, "76561198000000042"); !ok || st != "pending" {
		t.Fatalf("a brand-new SteamID must land pending, got status=%q ok=%v", st, ok)
	}
	// …and the approved row's stats were still re-derived (replaced), proving preservation != skipping.
	if r := upsertedByID(statRec, 60)["76561197960287930"]; r.Kills != 20 || r.Deaths != 14 {
		t.Fatalf("the approved row's stats must be re-derived, got %+v", r)
	}
}

// TestRunReparseEmptyDeletesAllAndFlagsEmpty: a re-parse that now yields ZERO players deletes ALL of the
// match's rows and trips the empty_stats anomaly gate.
func TestRunReparseEmptyDeletesAllAndFlagsEmpty(t *testing.T) {
	s := store.NewFakeStore()
	ref := seedRetained(t, s, 70, 15, demoBytes())
	reader := db.NewFakeDemoReader(ref)
	statRec := db.NewFakeStatRecorder()
	statRec.SeedRow("pending", db.StatRow{MatchID: 70, SteamID64: "76561197960287930", DemoID: 15})
	statRec.SeedRow("approved", db.StatRow{MatchID: 70, SteamID64: "76561198000000042", DemoID: 15})

	res, err := RunReparse(context.Background(), s, reader, FakeParser{Result: ParseResult{RoundsPlayed: 0, Players: nil}}, statRec, cannedRoster(), 70)
	if err != nil {
		t.Fatal(err)
	}
	if res.Players != 0 || !res.Anomalous {
		t.Fatalf("an empty re-parse must report 0 players and be anomalous, got %+v", res)
	}
	if len(res.Reasons) != 1 || res.Reasons[0].Gate != "empty_stats" {
		t.Fatalf("an empty re-parse must flag empty_stats, got %+v", res.Reasons)
	}
	if left := upsertedByID(statRec, 70); len(left) != 0 {
		t.Fatalf("an empty re-parse must delete ALL of the match's rows (incl. the approved one), got %v", left)
	}
	if g := statRec.Generation(15); g != 1 {
		t.Fatalf("the generation must still bump on an empty re-parse, got %d", g)
	}
}

// TestRunReparseRehashMismatchFailsClosed: if the retained object does not re-hash to its recorded
// demo_sha256 (corruption/tampering), the re-parse FAILS CLOSED — RecordReparse is never called and the
// prior rows are untouched.
func TestRunReparseRehashMismatchFailsClosed(t *testing.T) {
	s := store.NewFakeStore()
	ref := seedRetained(t, s, 80, 18, demoBytes())
	ref.SHA256 = hex.EncodeToString(sha256Of([]byte("a DIFFERENT object than what is stored"))) // recorded sha != stored bytes
	reader := db.NewFakeDemoReader(ref)
	statRec := db.NewFakeStatRecorder()
	statRec.SeedRow("approved", db.StatRow{MatchID: 80, SteamID64: "76561197960287930", DemoID: 18, Kills: 5, Deaths: 5})

	if _, err := RunReparse(context.Background(), s, reader, FakeParser{Result: cannedParse()}, statRec, cannedRoster(), 80); err == nil {
		t.Fatal("a re-hash mismatch must fail closed (the retained object must re-hash byte-for-byte)")
	}
	if reparses := statRec.Reparsed(); len(reparses) != 0 {
		t.Fatalf("RecordReparse must NOT be called on a re-hash mismatch, got %d calls", len(reparses))
	}
	if st, ok := statRec.StatusOf(80, "76561197960287930"); !ok || st != "approved" {
		t.Fatalf("the prior approved row must be untouched on a fail-closed re-parse, got status=%q ok=%v", st, ok)
	}
}

// TestRunReparseEmptySHASkipsVerify: a demo recorded on the un-hashed manual path (NULL demo_sha256, empty
// SHA256) skips the re-hash-verify and re-parses normally.
func TestRunReparseEmptySHASkipsVerify(t *testing.T) {
	s := store.NewFakeStore()
	ref := seedRetained(t, s, 90, 21, demoBytes())
	ref.SHA256 = "" // the un-hashed manual path
	reader := db.NewFakeDemoReader(ref)
	statRec := db.NewFakeStatRecorder()

	res, err := RunReparse(context.Background(), s, reader, FakeParser{Result: cannedParse()}, statRec, cannedRoster(), 90)
	if err != nil {
		t.Fatalf("an empty-sha (manual path) re-parse must proceed, got %v", err)
	}
	if res.Players != 2 || len(statRec.Reparsed()) != 1 {
		t.Fatalf("the manual-path re-parse must still record 2 players once, got %+v / %d calls", res, len(statRec.Reparsed()))
	}
}

// TestRunReparseRosterReadErrorFailsClosed: a roster-read failure propagates and records NOTHING (never
// record a re-parse we could not validate).
func TestRunReparseRosterReadErrorFailsClosed(t *testing.T) {
	s := store.NewFakeStore()
	ref := seedRetained(t, s, 54, 24, demoBytes())
	reader := db.NewFakeDemoReader(ref)
	statRec := db.NewFakeStatRecorder()
	roster := db.NewFakeRosterReader()
	roster.Err = errors.New("roster db down")

	if _, err := RunReparse(context.Background(), s, reader, FakeParser{Result: cannedParse()}, statRec, roster, 54); err == nil {
		t.Fatal("a roster-read error must fail closed (never record an unvalidated re-parse)")
	}
	if len(statRec.Reparsed()) != 0 {
		t.Fatal("RecordReparse must not be called when the roster read fails")
	}
}

// TestRunReparseNoRetainedDemoFailsClosed: a match with no retained demo has nothing to re-parse — the
// DemoReader error propagates and nothing is recorded.
func TestRunReparseNoRetainedDemoFailsClosed(t *testing.T) {
	s := store.NewFakeStore()
	reader := &db.FakeDemoReader{Err: errors.New("no retained demo for match 404 (nothing to re-parse)")}
	statRec := db.NewFakeStatRecorder()

	if _, err := RunReparse(context.Background(), s, reader, FakeParser{Result: cannedParse()}, statRec, cannedRoster(), 404); err == nil {
		t.Fatal("a match with no retained demo must fail closed")
	}
	if len(statRec.Reparsed()) != 0 {
		t.Fatal("RecordReparse must not be called when there is no retained demo")
	}
}

// TestRunReparseParseErrorFailsClosed: a parse failure on the retained object propagates and records
// nothing (the retained demo + object are untouched — AD-1).
func TestRunReparseParseErrorFailsClosed(t *testing.T) {
	s := store.NewFakeStore()
	ref := seedRetained(t, s, 44, 27, demoBytes())
	reader := db.NewFakeDemoReader(ref)
	statRec := db.NewFakeStatRecorder()

	if _, err := RunReparse(context.Background(), s, reader, FakeParser{Err: errors.New("corrupt demo")}, statRec, cannedRoster(), 44); err == nil {
		t.Fatal("a parse error must fail closed")
	}
	if len(statRec.Reparsed()) != 0 {
		t.Fatal("RecordReparse must not be called when the parse fails")
	}
	if s.Len() != 1 {
		t.Fatalf("the retained object must be untouched on a parse failure, got %d objects", s.Len())
	}
}

// TestRunReparseRequiresMatch: a missing/zero --match is rejected before any read.
func TestRunReparseRequiresMatch(t *testing.T) {
	s := store.NewFakeStore()
	reader := db.NewFakeDemoReader(db.DemoRef{})
	statRec := db.NewFakeStatRecorder()
	if _, err := RunReparse(context.Background(), s, reader, FakeParser{}, statRec, cannedRoster(), 0); err == nil {
		t.Fatal("a zero --match must be rejected")
	}
}

// TestRunReparseUnreconciledStillReparsed: an unrostered parsed id is HELD (unreconciled anomaly) but its
// row is STILL written (it surfaces in unreconciled_stat_row) — the re-parse mirrors RunCLI's hold-not-block.
func TestRunReparseUnreconciledStillReparsed(t *testing.T) {
	s := store.NewFakeStore()
	ref := seedRetained(t, s, 52, 30, demoBytes())
	reader := db.NewFakeDemoReader(ref)
	statRec := db.NewFakeStatRecorder()
	roster := db.NewFakeRosterReader("76561197960287930") // …042 not rostered

	res, err := RunReparse(context.Background(), s, reader, FakeParser{Result: cannedParse()}, statRec, roster, 52)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Anomalous || len(res.Reasons) != 1 || res.Reasons[0].Gate != "unreconciled" || res.Reasons[0].Detail != "76561198000000042" {
		t.Fatalf("an unrostered id must be a single unreconciled anomaly naming …042, got %+v", res.Reasons)
	}
	if len(upsertedByID(statRec, 52)) != 2 {
		t.Fatal("both rows must still be written on an unreconciled hold (not a write-block)")
	}
}

func sha256Of(b []byte) []byte {
	sum := sha256.Sum256(b)
	return sum[:]
}
