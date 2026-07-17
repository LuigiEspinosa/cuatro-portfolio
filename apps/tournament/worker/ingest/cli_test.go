package ingest

import (
	"context"
	"errors"
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

// cannedParse is the FakeParser result the CLI wiring tests upsert. Two real 17-digit SteamID64s with a
// BALANCED Σkills==Σdeaths (34==34) so a run with both ids rostered validates CLEAN (Story 3.4). (bots/world
// skip-zero is a property of the REAL DemoinfocsParser, exercised only at live-QA — Task 6.)
//
// RoundsWon (Story 4.6a) is the FR-16 demo-derived tally: 16-8 over 24 rounds, so ΣRoundsWon == RoundsPlayed
// — the conservation the real parser must satisfy on a decided 1v1. Note it is deliberately NOT proportional
// to K/D: the score comes from RoundEnd, never from kills (Σkills < Σdeaths on unattributed deaths, the 3.4
// review's finding), and a fixture that let the two agree would hide a kills-derived score.
func cannedParse() ParseResult {
	return ParseResult{
		RoundsPlayed: 24,
		Players: []PlayerStat{
			{SteamID64: 76561197960287930, Kills: 20, Deaths: 14, RoundsWon: 16},
			{SteamID64: 76561198000000042, Kills: 14, Deaths: 20, RoundsWon: 8},
		},
	}
}

// cannedRoster rosters exactly the two cannedParse ids, so cannedParse validates clean.
func cannedRoster() *db.FakeRosterReader {
	return db.NewFakeRosterReader("76561197960287930", "76561198000000042")
}

func TestRunCLIHappyPathParsesAndUpserts(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	parser := FakeParser{Result: cannedParse()}
	statRec := db.NewFakeStatRecorder()
	path := writeTemp(t, "cache.dem", demoBytes())

	res, err := RunCLI(context.Background(), s, rec, parser, statRec, cannedRoster(), path, 33)
	if err != nil {
		t.Fatal(err)
	}
	if res.AlreadyIngested {
		t.Fatal("a fresh CLI ingest must not be already_ingested")
	}
	if !res.Parsed || res.Players != 2 || res.Rounds != 24 {
		t.Fatalf("a fresh ingest must report a parse of 2 players / 24 rounds, got %+v", res)
	}
	// Balanced K/D + both ids rostered => a CLEAN validation (not held).
	if res.Anomalous || len(res.Reasons) != 0 {
		t.Fatalf("a clean balanced+rostered parse must not be anomalous, got %+v", res)
	}
	if _, ok := s.Object(res.StorageKey); !ok {
		t.Fatal("object not stored")
	}
	if res.DemoID == 0 {
		t.Fatal("a fresh acquire must carry a non-zero demo provenance id")
	}
	rows := rec.Recorded()
	if len(rows) != 1 || rows[0].MatchID != 33 || rows[0].Source != SourceManualUpload {
		t.Fatalf("unexpected recorded demo rows: %+v", rows)
	}
	if rows[0].SHA256 == "" {
		t.Fatal("the CLI path must record a non-empty demo_sha256")
	}

	// The single-writer parse path fired exactly once, with the right provenance + payload + a clean outcome.
	calls := statRec.Calls()
	if len(calls) != 1 {
		t.Fatalf("RecordParse must be called exactly once on a fresh ingest, got %d", len(calls))
	}
	call := calls[0]
	if call.DemoID != res.DemoID {
		t.Fatalf("RecordParse demoID must equal the fresh demo id: call=%d res=%d", call.DemoID, res.DemoID)
	}
	if call.ParserVersion != ParserVersion {
		t.Fatalf("RecordParse parserVersion mismatch: got %q want %q", call.ParserVersion, ParserVersion)
	}
	if call.Val.Anomalous || len(call.Val.Reasons) != 0 {
		t.Fatalf("RecordParse must receive a clean validation outcome, got %+v", call.Val)
	}
	byID := map[string]db.StatRow{}
	for _, r := range call.Rows {
		byID[r.SteamID64] = r
	}
	// SteamID64 uint64 -> 17-digit decimal text; match/demo/rounds provenance stamped; K/D carried through.
	r930, ok := byID["76561197960287930"]
	if !ok {
		t.Fatalf("missing stat row for 76561197960287930 (got %+v)", call.Rows)
	}
	if r930.MatchID != 33 || r930.DemoID != res.DemoID || r930.Kills != 20 || r930.Deaths != 14 || r930.RoundsPlayed != 24 {
		t.Fatalf("unexpected mapped stat row for …930: %+v", r930)
	}
	// Story 4.6a: the FR-16 demo-derived tally rides the SAME AD-4 steamid64 key onto the row. This is the
	// assembly seam — if cli.go stops carrying RoundsWon, the score silently becomes 0 for every player.
	if r930.RoundsWon != 16 {
		t.Fatalf("…930's demo-derived RoundsWon must be carried to the stat row: got %d want 16", r930.RoundsWon)
	}
	r042, ok := byID["76561198000000042"]
	if !ok {
		t.Fatalf("missing stat row for 76561198000000042 (got %+v)", call.Rows)
	}
	if r042.RoundsWon != 8 {
		t.Fatalf("…042's demo-derived RoundsWon must be carried to the stat row: got %d want 8", r042.RoundsWon)
	}
	// FR-16's conservation, at the assembly seam: the per-player tally sums to the match's rounds played.
	if r930.RoundsWon+r042.RoundsWon != r930.RoundsPlayed {
		t.Fatalf("ΣRoundsWon must equal RoundsPlayed: %d + %d != %d", r930.RoundsWon, r042.RoundsWon, r930.RoundsPlayed)
	}

	// Re-running the CLI on the SAME .dem + match short-circuits (AlreadyIngested) and SKIPS the parse AND
	// the validate: no second RecordParse, no second demo row/object (AD-3; the prior ingest validated).
	again, err := RunCLI(context.Background(), s, rec, parser, statRec, cannedRoster(), path, 33)
	if err != nil {
		t.Fatal(err)
	}
	if !again.AlreadyIngested || again.Parsed {
		t.Fatalf("an AlreadyIngested re-run must report already_ingested and skip the parse, got %+v", again)
	}
	if again.StorageKey != res.StorageKey {
		t.Fatalf("the re-run must return the prior key, got %q want %q", again.StorageKey, res.StorageKey)
	}
	if len(statRec.Calls()) != 1 {
		t.Fatalf("the AlreadyIngested re-run must NOT re-parse/re-validate: RecordParse call count = %d", len(statRec.Calls()))
	}
	if len(rec.Recorded()) != 1 || s.Len() != 1 {
		t.Fatalf("the re-run must not add a demo row/object: rows=%d objects=%d", len(rec.Recorded()), s.Len())
	}
}

// TestRunCLIConservationAnomaly: an imbalanced Σkills!=Σdeaths parse is HELD (validation_state='anomalous')
// with a conservation reason — but the stat rows are STILL written (the anomaly is a hold flag on demo, not
// a write-block).
func TestRunCLIConservationAnomaly(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	statRec := db.NewFakeStatRecorder()
	parser := FakeParser{Result: ParseResult{RoundsPlayed: 20, Players: []PlayerStat{
		{SteamID64: 76561197960287930, Kills: 13, Deaths: 8},
		{SteamID64: 76561198000000042, Kills: 8, Deaths: 12}, // Σkills 21 != Σdeaths 20
	}}}
	path := writeTemp(t, "cache.dem", demoBytes())

	res, err := RunCLI(context.Background(), s, rec, parser, statRec, cannedRoster(), path, 51)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Anomalous {
		t.Fatalf("an imbalanced K/D parse must be anomalous, got %+v", res)
	}
	calls := statRec.Calls()
	if len(calls) != 1 || len(calls[0].Rows) != 2 {
		t.Fatalf("the 2 stat rows must STILL be written on an anomaly (hold flag, not write-block), got %+v", calls)
	}
	if !calls[0].Val.Anomalous || len(calls[0].Val.Reasons) != 1 || calls[0].Val.Reasons[0].Gate != "conservation" {
		t.Fatalf("the recorded outcome must be a single conservation anomaly, got %+v", calls[0].Val)
	}
}

// TestRunCLIUnreconciledAnomaly: a parsed id absent from the active roster is HELD with an unreconciled
// reason naming exactly that id — and its stat_row is still written (it surfaces in unreconciled_stat_row).
func TestRunCLIUnreconciledAnomaly(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	statRec := db.NewFakeStatRecorder()
	parser := FakeParser{Result: cannedParse()}           // balanced → conservation passes
	roster := db.NewFakeRosterReader("76561197960287930") // …042 is NOT on the roster
	path := writeTemp(t, "cache.dem", demoBytes())

	res, err := RunCLI(context.Background(), s, rec, parser, statRec, roster, path, 52)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Anomalous {
		t.Fatalf("an unrostered parsed id must be anomalous, got %+v", res)
	}
	calls := statRec.Calls()
	if len(calls) != 1 || len(calls[0].Rows) != 2 {
		t.Fatalf("both stat rows must STILL be written (the unrostered id lands in unreconciled_stat_row), got %+v", calls)
	}
	if len(calls[0].Val.Reasons) != 1 || calls[0].Val.Reasons[0].Gate != "unreconciled" || calls[0].Val.Reasons[0].Detail != "76561198000000042" {
		t.Fatalf("the recorded outcome must be an unreconciled anomaly naming …042, got %+v", calls[0].Val)
	}
}

// TestRunCLIEmptyParseAnomaly: a successful parse that yields ZERO rows (empty/warmup-only demo) is HELD
// with an empty_stats reason; RecordParse still fires (it stamps the demo validation outcome).
func TestRunCLIEmptyParseAnomaly(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	statRec := db.NewFakeStatRecorder()
	parser := FakeParser{Result: ParseResult{RoundsPlayed: 0, Players: nil}}
	path := writeTemp(t, "cache.dem", demoBytes())

	res, err := RunCLI(context.Background(), s, rec, parser, statRec, cannedRoster(), path, 53)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Parsed || res.Players != 0 || !res.Anomalous {
		t.Fatalf("an empty parse must report parsed with 0 players and be anomalous, got %+v", res)
	}
	calls := statRec.Calls()
	if len(calls) != 1 || len(calls[0].Rows) != 0 {
		t.Fatalf("an empty parse still records once with 0 rows (stamps the demo outcome), got %+v", calls)
	}
	if len(calls[0].Val.Reasons) != 1 || calls[0].Val.Reasons[0].Gate != "empty_stats" {
		t.Fatalf("the recorded outcome must be a single empty_stats anomaly, got %+v", calls[0].Val)
	}
}

// TestRunCLIRosterReadErrorFailsClosed: if the active-roster read errors, RunCLI propagates it and does NOT
// record a parse it could not validate (fail closed). The acquire already happened (write-once): the demo
// row + object persist.
func TestRunCLIRosterReadErrorFailsClosed(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	statRec := db.NewFakeStatRecorder()
	roster := db.NewFakeRosterReader()
	roster.Err = errors.New("roster db down")
	parser := FakeParser{Result: cannedParse()}
	path := writeTemp(t, "cache.dem", demoBytes())

	if _, err := RunCLI(context.Background(), s, rec, parser, statRec, roster, path, 54); err == nil {
		t.Fatal("a roster-read error must propagate (fail closed — never record an unvalidated parse)")
	}
	if len(statRec.Calls()) != 0 {
		t.Fatal("RecordParse must not be called when the roster read fails")
	}
	if len(rec.Recorded()) != 1 || s.Len() != 1 {
		t.Fatalf("the acquired demo row/object persist on a roster-read failure: rows=%d objects=%d", len(rec.Recorded()), s.Len())
	}
}

// TestRunCLISkipsMalformedSteamID: a parsed player whose SteamID64 does not format to exactly 17 digits
// (a phantom/relay entity or a parser anomaly) is skipped at the mapping site — mirroring stat_row's
// `^[0-9]{17}$` CHECK — so one bad id can't make the single-transaction batch upsert roll back the WHOLE
// match (23514). Valid 17-digit ids are still upserted. (The resulting K/D imbalance surfaces as a
// conservation anomaly — the intended Story-3.4 safety net — but the surviving row is still written.)
func TestRunCLISkipsMalformedSteamID(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	statRec := db.NewFakeStatRecorder()
	parser := FakeParser{Result: ParseResult{
		RoundsPlayed: 16,
		Players: []PlayerStat{
			{SteamID64: 76561197960287930, Kills: 5, Deaths: 3}, // valid 17-digit id
			{SteamID64: 123, Kills: 9, Deaths: 1},               // malformed (3 digits) — must be skipped
		},
	}}
	roster := db.NewFakeRosterReader("76561197960287930")
	path := writeTemp(t, "cache.dem", demoBytes())

	res, err := RunCLI(context.Background(), s, rec, parser, statRec, roster, path, 77)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Parsed || res.Players != 1 {
		t.Fatalf("only the 1 valid-id row must be upserted (the malformed id skipped), got %+v", res)
	}
	calls := statRec.Calls()
	if len(calls) != 1 || len(calls[0].Rows) != 1 {
		t.Fatalf("RecordParse must receive exactly the 1 valid row, got %+v", calls)
	}
	if calls[0].Rows[0].SteamID64 != "76561197960287930" {
		t.Fatalf("the surviving row must be the valid 17-digit id, got %q", calls[0].Rows[0].SteamID64)
	}
}

func TestRunCLIRejectsNonSource2(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	statRec := db.NewFakeStatRecorder()
	path := writeTemp(t, "old.dem", []byte("HL2DEMO\x00 a CS:GO Source-1 demo"))

	if _, err := RunCLI(context.Background(), s, rec, FakeParser{Result: cannedParse()}, statRec, cannedRoster(), path, 1); err == nil {
		t.Fatal("expected rejection of a non-PBDEMS2 (Source-1) file")
	}
	if s.Len() != 0 || len(rec.Recorded()) != 0 || len(statRec.Calls()) != 0 {
		t.Fatal("nothing must be stored/recorded/parsed for a bad-format file")
	}
}

func TestRunCLIRequiresMatch(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	statRec := db.NewFakeStatRecorder()
	path := writeTemp(t, "cache.dem", demoBytes())

	if _, err := RunCLI(context.Background(), s, rec, FakeParser{}, statRec, cannedRoster(), path, 0); err == nil {
		t.Fatal("expected an error for a missing/zero --match")
	}
	if len(statRec.Calls()) != 0 {
		t.Fatal("a rejected --match must not parse")
	}
}

// TestRunCLIParseErrorFailsClosed: a parse failure on a fresh acquire propagates the error (no partial
// success claim). The demo row + object persist (write-once, AD-1) — recovery is Story 3.6/3.8, not here.
// The roster read never happens (validation is after a successful parse).
func TestRunCLIParseErrorFailsClosed(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	statRec := db.NewFakeStatRecorder()
	parser := FakeParser{Err: errors.New("corrupt demo")}
	path := writeTemp(t, "cache.dem", demoBytes())

	if _, err := RunCLI(context.Background(), s, rec, parser, statRec, cannedRoster(), path, 44); err == nil {
		t.Fatal("a parse error on a fresh acquire must propagate (fail closed)")
	}
	if len(statRec.Calls()) != 0 {
		t.Fatal("RecordParse must not be called when the parse fails")
	}
	// The acquire already happened (write-once): the demo row + object persist; only the parse failed.
	if len(rec.Recorded()) != 1 || s.Len() != 1 {
		t.Fatalf("the acquired demo row/object persist on a parse failure: rows=%d objects=%d", len(rec.Recorded()), s.Len())
	}
}

// TestRunCLIStatRecorderErrorFailsClosed: a RecordParse failure propagates the error (no partial claim).
func TestRunCLIStatRecorderErrorFailsClosed(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	statRec := db.NewFakeStatRecorder()
	statRec.Err = errors.New("db boom")
	parser := FakeParser{Result: cannedParse()}
	path := writeTemp(t, "cache.dem", demoBytes())

	if _, err := RunCLI(context.Background(), s, rec, parser, statRec, cannedRoster(), path, 45); err == nil {
		t.Fatal("a RecordParse error must propagate (fail closed)")
	}
}
