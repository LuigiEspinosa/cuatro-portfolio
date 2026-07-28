package ingest

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"reflect"
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
			// The FR-18 core seven (Story 5.1) ride the same map->row assembly as K/D/RoundsWon. Values are
			// deliberately distinct per field + per player so a dropped mapping (either site) reddens: no two
			// fields share a value, and FlashAssists <= Assists / HSKills <= Kills / KASTRounds <= RoundsPlayed
			// so the fixture is a plausible scoreboard.
			// The FR-19 weird five (Story 5.2) ride the same assembly again — likewise distinct per field +
			// per player, and each <= that player's Kills (they are overlapping SUBSETS of kills, so any one
			// is <= Kills while their SUM may legitimately exceed it — no fixture invariant on the sum).
			// ⚠ The distinctness rule is WITHIN a player row and it is load-bearing, not decoration: two
			// fields sharing a value make a cross-wire between them (ThroughSmokeKills: pl.Kills) invisible
			// for that player. The 5.2 review caught three collisions on …042 — check the whole row, not
			// just your new field, when you widen this fixture. (Cross-PLAYER repeats are fine and sometimes
			// required: …930's Deaths == …042's Kills is the Σkills == Σdeaths conservation the tests assert.)
			// The FR-20 derived three (Story 5.3) ride the same assembly a third time: EntryFrags <= Kills and
			// OpeningDeaths <= Deaths keep the fixture a plausible scoreboard, and BOTH players carry a
			// NON-EMPTY Clutches map — a nil `want` would make a dropped `Clutches:` mapping invisible, since
			// the dropped field is nil too.
			// The FR-21 AFK/idle pair (Story 5.4) rides the same assembly a fourth time. …930 is IdleDQ:true
			// with a NON-ZERO IdleRoundCount (15 — distinct from every other int on the row); …042 is the
			// zero/false case (IdleDQ:false, IdleRoundCount:0). A DQ'd player is not realistic in a real
			// tournament, but this is a MAPPING fixture — the point is that both fields land, distinct enough
			// that a copy/paste swap or a dropped mapping reddens assertDerivedStats.
			{SteamID64: 76561197960287930, Kills: 20, Deaths: 14, RoundsWon: 16,
				Assists: 4, ADRDamage: 2529, HSKills: 6, MVPs: 5, FlashAssists: 1, UtilityDamage: 233, KASTRounds: 18,
				KnifeKills: 8, WallbangKills: 9, ThroughSmokeKills: 10, NoScopeKills: 11, BlindKills: 12,
				EntryFrags: 7, OpeningDeaths: 3, Clutches: map[int]int{1: 2, 2: 1},
				IdleDQ: true, IdleRoundCount: 15},
			{SteamID64: 76561198000000042, Kills: 14, Deaths: 20, RoundsWon: 8,
				Assists: 3, ADRDamage: 1801, HSKills: 7, MVPs: 6, FlashAssists: 2, UtilityDamage: 147, KASTRounds: 13,
				KnifeKills: 9, WallbangKills: 5, ThroughSmokeKills: 11, NoScopeKills: 1, BlindKills: 4,
				EntryFrags: 10, OpeningDeaths: 12, Clutches: map[int]int{1: 3, 4: 1},
				IdleDQ: false, IdleRoundCount: 0},
		},
	}
}

// assertDerivedStats checks a mapped StatRow carries every derived field from its PlayerStat source: the
// FR-18 core seven (Story 5.1), the FR-19 weird five (Story 5.2), the FR-20 derived three (Story 5.3) AND the
// FR-21 AFK/idle pair (Story 5.4). Both mapping sites (cli.go parseAndRecord, reparse.go) must copy all
// SEVENTEEN; dropping ANY one silently writes a 0/false (a NULL/zeroed column) — or, for Clutches, a `{}` that
// ERASES a player's clutch history on every re-parse — so this single helper is the per-stat mutation net for
// both paths.
func assertDerivedStats(t *testing.T, got db.StatRow, want PlayerStat) {
	t.Helper()
	if got.Assists != want.Assists {
		t.Fatalf("assists not carried: got %d want %d", got.Assists, want.Assists)
	}
	if got.ADRDamage != want.ADRDamage {
		t.Fatalf("adr_damage not carried: got %d want %d", got.ADRDamage, want.ADRDamage)
	}
	if got.HSKills != want.HSKills {
		t.Fatalf("hs_kills not carried: got %d want %d", got.HSKills, want.HSKills)
	}
	if got.MVPs != want.MVPs {
		t.Fatalf("mvps not carried: got %d want %d", got.MVPs, want.MVPs)
	}
	if got.FlashAssists != want.FlashAssists {
		t.Fatalf("flash_assists not carried: got %d want %d", got.FlashAssists, want.FlashAssists)
	}
	if got.UtilityDamage != want.UtilityDamage {
		t.Fatalf("utility_damage not carried: got %d want %d", got.UtilityDamage, want.UtilityDamage)
	}
	if got.KASTRounds != want.KASTRounds {
		t.Fatalf("kast_rounds not carried: got %d want %d", got.KASTRounds, want.KASTRounds)
	}
	// The FR-19 weird five (Story 5.2). Same net, same reason: a field dropped from either map literal
	// writes 0/NULL into a comedy-award column and nothing else notices.
	if got.KnifeKills != want.KnifeKills {
		t.Fatalf("knife_kills not carried: got %d want %d", got.KnifeKills, want.KnifeKills)
	}
	if got.WallbangKills != want.WallbangKills {
		t.Fatalf("wallbang_kills not carried: got %d want %d", got.WallbangKills, want.WallbangKills)
	}
	if got.ThroughSmokeKills != want.ThroughSmokeKills {
		t.Fatalf("through_smoke_kills not carried: got %d want %d", got.ThroughSmokeKills, want.ThroughSmokeKills)
	}
	if got.NoScopeKills != want.NoScopeKills {
		t.Fatalf("no_scope_kills not carried: got %d want %d", got.NoScopeKills, want.NoScopeKills)
	}
	if got.BlindKills != want.BlindKills {
		t.Fatalf("blind_kills not carried: got %d want %d", got.BlindKills, want.BlindKills)
	}
	// The FR-20 derived three (Story 5.3). Clutches is a MAP — compared with DeepEqual, and the fixture keeps
	// it non-empty precisely so a dropped mapping (which leaves nil) reddens here.
	if got.EntryFrags != want.EntryFrags {
		t.Fatalf("entry_frags not carried: got %d want %d", got.EntryFrags, want.EntryFrags)
	}
	if got.OpeningDeaths != want.OpeningDeaths {
		t.Fatalf("opening_deaths not carried: got %d want %d", got.OpeningDeaths, want.OpeningDeaths)
	}
	if !reflect.DeepEqual(got.Clutches, want.Clutches) {
		t.Fatalf("clutches not carried: got %v want %v", got.Clutches, want.Clutches)
	}
	// The FR-21 AFK/idle pair (Story 5.4). Same net, same reason: a field dropped from either map literal
	// writes 0/false into an anti-farm column on every parse/re-parse and nothing else notices.
	if got.IdleDQ != want.IdleDQ {
		t.Fatalf("idle_dq not carried: got %v want %v", got.IdleDQ, want.IdleDQ)
	}
	if got.IdleRoundCount != want.IdleRoundCount {
		t.Fatalf("idle_round_count not carried: got %d want %d", got.IdleRoundCount, want.IdleRoundCount)
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
	// Stories 5.1 + 5.2: the FR-18 core seven and the FR-19 weird five ride the SAME first-parse map
	// (cli.go parseAndRecord). Dropping any one field from that literal writes a 0 for it — this asserts
	// all twelve landed for BOTH players.
	assertDerivedStats(t, r930, cannedParse().Players[0])
	assertDerivedStats(t, r042, cannedParse().Players[1])
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

// TestRunCLIZeroWeirdStatsRecordedAsZeroNotOmitted is AC2 of Story 5.2 (FR-19's testable consequence: "a
// weird stat with a zero count is recorded as zero, not omitted"), extended by Story 5.3 AC3 to the FR-20
// derived three. A player who earned NONE of them is still UPSERTED — a full row, never skipped and never
// partially mapped — which is the half of the AC that is reachable from here and the half a "skip the player
// if they have nothing weird" optimization would break.
//
// ⚠ Read what this test does NOT prove (5.2 review). The `!= 0` assertions below are 0 == 0: db.StatRow
// carries plain ints, so they hold identically whether the map literal copies the fields or omits them. They
// are a tripwire for a row going MISSING, not for a field going missing — the per-field net is
// assertDerivedStats over the NON-zero cannedParse fixture, which is where a dropped mapping actually
// reddens. And no Go test can reach the 0-vs-NULL distinction at all: FakeStatRecorder stores StatRow
// structs and never executes SQL, and no Go int can be NULL. That the columns sit unconditionally in the
// INSERT list (db.go) is what makes zero land as 0, and it is verified by reading that statement — not by
// this test. The same holds for Clutches: a nil map reaching the writer is rendered `{}` rather than the
// jsonb scalar `null`, and THAT is proven by db.TestClutchesJSON, not here.
func TestRunCLIZeroWeirdStatsRecordedAsZeroNotOmitted(t *testing.T) {
	s := store.NewFakeStore()
	rec := db.NewFakeRecorder()
	statRec := db.NewFakeStatRecorder()
	// The canned fixture with the weird five AND the FR-20 derived three zeroed out for BOTH players —
	// everything else unchanged, so a row that goes missing or loses its K/D is a skip/partial-map, not a zero.
	zeroed := cannedParse()
	for i := range zeroed.Players {
		zeroed.Players[i].KnifeKills = 0
		zeroed.Players[i].WallbangKills = 0
		zeroed.Players[i].ThroughSmokeKills = 0
		zeroed.Players[i].NoScopeKills = 0
		zeroed.Players[i].BlindKills = 0
		zeroed.Players[i].EntryFrags = 0
		zeroed.Players[i].OpeningDeaths = 0
		zeroed.Players[i].Clutches = nil // the real parser's shape for a player who clutched nothing
		// Story 5.4 AC3: a never-idle player. idle_round_count 0 + idle_dq false must be WRITTEN, not skipped.
		zeroed.Players[i].IdleDQ = false
		zeroed.Players[i].IdleRoundCount = 0
	}
	path := writeTemp(t, "cache.dem", demoBytes())

	res, err := RunCLI(context.Background(), s, rec, FakeParser{Result: zeroed}, statRec, cannedRoster(), path, 77)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Parsed || res.Players != 2 {
		t.Fatalf("both players must still be parsed+recorded, got %+v", res)
	}
	calls := statRec.Calls()
	if len(calls) != 1 || len(calls[0].Rows) != 2 {
		t.Fatalf("a zero-weird-stat parse must upsert a row for EVERY player (none omitted), got %+v", calls)
	}
	for _, r := range calls[0].Rows {
		if r.Kills == 0 || r.RoundsPlayed != 24 {
			t.Fatalf("row for %s lost its non-weird payload — partially mapped: %+v", r.SteamID64, r)
		}
		if r.KnifeKills != 0 || r.WallbangKills != 0 || r.ThroughSmokeKills != 0 || r.NoScopeKills != 0 || r.BlindKills != 0 {
			t.Fatalf("row for %s must carry the weird five as explicit zeros: %+v", r.SteamID64, r)
		}
		// Story 5.3 AC3: the derived three are on the row too — two explicit zeros and an empty (not
		// populated-by-accident) clutch tally that the writer renders as the empty jsonb object.
		if r.EntryFrags != 0 || r.OpeningDeaths != 0 || len(r.Clutches) != 0 {
			t.Fatalf("row for %s must carry the FR-20 derived three as zeros/empty: %+v", r.SteamID64, r)
		}
		// Story 5.4 AC3: a never-idle player's row carries idle_round_count 0 + idle_dq false WRITTEN (the
		// columns sit unconditionally in the INSERT list — db.go — so 0/false lands, not NULL; the 0-vs-NULL
		// distinction itself is unreachable from a Go test that stores structs and never executes SQL).
		if r.IdleRoundCount != 0 || r.IdleDQ {
			t.Fatalf("row for %s must carry the FR-21 idle pair as 0/false: %+v", r.SteamID64, r)
		}
	}
	// And the whole mapping still holds against the zeroed source (the same twelve-field net).
	byID := map[string]db.StatRow{}
	for _, r := range calls[0].Rows {
		byID[r.SteamID64] = r
	}
	assertDerivedStats(t, byID["76561197960287930"], zeroed.Players[0])
	assertDerivedStats(t, byID["76561198000000042"], zeroed.Players[1])
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
