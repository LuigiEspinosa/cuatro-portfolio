package ingest

import (
	"bytes"
	"errors"
	"strings"
	"testing"
	"time"
)

// TestFakeParserEchoesResultAndErr proves the test seam: the canned Result is returned verbatim, and the
// Err seam wins (fail-closed) so the wiring tests can force a parse failure.
func TestFakeParserEchoesResultAndErr(t *testing.T) {
	want := ParseResult{RoundsPlayed: 24, Players: []PlayerStat{{SteamID64: 76561197960287930, Kills: 20, Deaths: 14, RoundsWon: 16}}}
	got, err := FakeParser{Result: want}.Parse(strings.NewReader("ignored stream"))
	if err != nil {
		t.Fatal(err)
	}
	if got.RoundsPlayed != 24 || len(got.Players) != 1 || got.Players[0] != want.Players[0] {
		t.Fatalf("FakeParser did not echo its canned result: %+v", got)
	}
	if _, err := (FakeParser{Result: want, Err: errors.New("boom")}).Parse(strings.NewReader("x")); err == nil {
		t.Fatal("FakeParser.Err must be returned (the fail-closed seam)")
	}
}

// TestDemoinfocsParserRejectsCorruptStream drives the REAL parser on a stream that carries the Source-2
// magic but then garbage: it must fail CLEANLY (return a wrapped error, not panic), so a corrupt or
// truncated retained object surfaces as a fail-closed error rather than crashing the worker. The real
// parser's happy-path correctness on a genuine .dem is the live-QA gate (Task 7) — this only proves the
// production impl is not shipped entirely unexercised.
func TestDemoinfocsParserRejectsCorruptStream(t *testing.T) {
	_, err := DemoinfocsParser{}.Parse(bytes.NewReader([]byte("PBDEMS2\x00 not actually a valid demo body — truncated garbage")))
	if err == nil {
		t.Fatal("expected a parse error on a corrupt/truncated demo stream")
	}
}

// TestKASTClassifierBranches exercises the four KAST qualifiers independently (K, A, S, T) plus the two
// non-qualifying death cases, over the PURE roundStats classifier — the real handler wiring is THE BAR.
func TestKASTClassifierBranches(t *testing.T) {
	const player = uint64(76561197960287930)
	const killer = uint64(76561198000000042)
	const other = uint64(76561198000000999)
	const window = 5 * time.Second

	// K — got a kill this round.
	rsK := newRoundStats()
	rsK.gotKill[player] = true
	if !rsK.kastQualified(player, window) {
		t.Fatal("K: a player who got a kill must qualify")
	}

	// A — got an assist this round.
	rsA := newRoundStats()
	rsA.gotAssist[player] = true
	if !rsA.kastQualified(player, window) {
		t.Fatal("A: a player who got an assist must qualify")
	}

	// S — survived: the player is not among this round's victims (someone else died).
	rsS := newRoundStats()
	rsS.deathEvents = []roundDeath{{victim: other, killer: killer, at: time.Second}}
	if !rsS.kastQualified(player, window) {
		t.Fatal("S: a player who did not die this round (survived) must qualify")
	}

	// T — traded: the player died, and the one who killed them died within the window AFTER.
	rsT := newRoundStats()
	rsT.deathEvents = []roundDeath{
		{victim: player, killer: killer, at: 10 * time.Second},
		{victim: killer, killer: other, at: 13 * time.Second}, // avenged 3s later
	}
	if !rsT.kastQualified(player, window) {
		t.Fatal("T: a traded death must qualify")
	}

	// NOT — died and the killer was never avenged.
	rsUntraded := newRoundStats()
	rsUntraded.deathEvents = []roundDeath{{victim: player, killer: killer, at: 10 * time.Second}}
	if rsUntraded.kastQualified(player, window) {
		t.Fatal("an untraded death must NOT qualify")
	}

	// NOT — died to the world (killer id 0): there is no killer to be traded against.
	rsWorld := newRoundStats()
	rsWorld.deathEvents = []roundDeath{{victim: player, killer: 0, at: 10 * time.Second}}
	if rsWorld.kastQualified(player, window) {
		t.Fatal("a world/unattributed death must NOT qualify (no trader)")
	}
}

// TestKASTTradeWindowBoundary pins the trade window as INCLUSIVE at exactly kastTradeWindow and exclusive
// just beyond it, and rejects a "trade" where the killer died BEFORE the victim.
func TestKASTTradeWindowBoundary(t *testing.T) {
	const player = uint64(76561197960287930)
	const killer = uint64(76561198000000042)
	const window = 5 * time.Second
	withKillerDeath := func(at time.Duration) *roundStats {
		rs := newRoundStats()
		rs.deathEvents = []roundDeath{
			{victim: player, killer: killer, at: 10 * time.Second},
			{victim: killer, killer: 0, at: at},
		}
		return rs
	}

	if !withKillerDeath(15*time.Second).kastQualified(player, window) {
		t.Fatal("a trade at EXACTLY the window (10s+5s) must qualify (inclusive boundary)")
	}
	if withKillerDeath(15*time.Second+time.Millisecond).kastQualified(player, window) {
		t.Fatal("a trade JUST OVER the window must NOT qualify")
	}
	if withKillerDeath(9*time.Second).kastQualified(player, window) {
		t.Fatal("a killer death BEFORE the victim's death is not a trade")
	}
}

// TestFoldRoundsDropsStrandedRounds proves the trap-4 fold: a round index ABOVE the final count (a
// higher-water-mark rewind, e.g. an admin !restore) is dropped from EVERY additive stat, RoundsWon and MVPs,
// while surviving rounds sum.
func TestFoldRoundsDropsStrandedRounds(t *testing.T) {
	const p = uint64(76561197960287930)
	const final = 4

	r1 := newRoundStats()
	r1.kills[p], r1.deaths[p], r1.assists[p] = 2, 1, 1
	r1.flashAssists[p], r1.hsKills[p], r1.adrDamage[p], r1.utilityDamage[p] = 1, 1, 100, 20
	r1.kast[p] = true

	r2 := newRoundStats()
	r2.kills[p], r2.adrDamage[p] = 3, 150
	r2.kast[p] = true

	stranded := newRoundStats() // idx 5 > final 4 — must be dropped whole
	stranded.kills[p], stranded.assists[p], stranded.adrDamage[p] = 99, 99, 9999
	stranded.kast[p] = true

	byRound := map[int]*roundStats{1: r1, 2: r2, 5: stranded}
	roundWinners := map[int][]uint64{1: {p}, 5: {p}} // idx 5 winner dropped
	mvpByRound := map[int]uint64{2: p, 5: p}         // idx 5 MVP dropped

	stats := foldRounds(byRound, roundWinners, mvpByRound, final)
	got := stats[p]
	if got == nil {
		t.Fatal("player must be present in the fold")
	}
	if got.Kills != 5 { // 2 + 3, stranded 99 dropped
		t.Fatalf("kills: got %d want 5 (stranded round dropped)", got.Kills)
	}
	if got.Deaths != 1 || got.Assists != 1 || got.FlashAssists != 1 || got.HSKills != 1 {
		t.Fatalf("surviving additive counts wrong: %+v", got)
	}
	if got.ADRDamage != 250 { // 100 + 150, stranded 9999 dropped
		t.Fatalf("adr_damage: got %d want 250 (stranded round dropped)", got.ADRDamage)
	}
	if got.UtilityDamage != 20 {
		t.Fatalf("utility_damage: got %d want 20", got.UtilityDamage)
	}
	if got.KASTRounds != 2 { // rounds 1 + 2, stranded dropped
		t.Fatalf("kast_rounds: got %d want 2 (stranded round dropped)", got.KASTRounds)
	}
	if got.RoundsWon != 1 { // round 1 only; idx 5 dropped
		t.Fatalf("rounds_won: got %d want 1 (stranded round dropped)", got.RoundsWon)
	}
	if got.MVPs != 1 { // round 2 only; idx 5 dropped
		t.Fatalf("mvps: got %d want 1 (stranded MVP dropped)", got.MVPs)
	}
}
