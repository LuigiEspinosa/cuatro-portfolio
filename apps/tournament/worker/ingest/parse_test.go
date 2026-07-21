package ingest

import (
	"bytes"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/events"
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

// TestClassifyWeirdKillBranches exercises every FR-19 weird flag independently over the PURE classifier
// (Story 5.2) — the same "keep the DECISION pure, leave only the increment in the parser closure" move
// kastQualified made, so each branch is mutation-testable with no real demo. It also pins the two guards
// that are easy to get wrong: PenetratedObjects == 0 is NOT a wallbang, and a nil Weapon (world/corrupt
// damage) must neither panic nor count a knife kill.
func TestClassifyWeirdKillBranches(t *testing.T) {
	knife := &common.Equipment{Type: common.EqKnife}
	ak := &common.Equipment{Type: common.EqAK47}

	cases := []struct {
		name string
		kill events.Kill
		want weirdKinds
	}{
		{"knife", events.Kill{Weapon: knife}, weirdKinds{knife: true}},
		{"non-knife weapon is not a knife kill", events.Kill{Weapon: ak}, weirdKinds{}},
		{"nil weapon does not panic and is not a knife kill", events.Kill{Weapon: nil}, weirdKinds{}},
		{"wallbang", events.Kill{Weapon: ak, PenetratedObjects: 1}, weirdKinds{wallbang: true}},
		{"zero penetrated objects is NOT a wallbang", events.Kill{Weapon: ak, PenetratedObjects: 0}, weirdKinds{}},
		{"through smoke", events.Kill{Weapon: ak, ThroughSmoke: true}, weirdKinds{throughSmoke: true}},
		{"no scope", events.Kill{Weapon: ak, NoScope: true}, weirdKinds{noScope: true}},
		{"blind (the KILLER was flashed)", events.Kill{Weapon: ak, AttackerBlind: true}, weirdKinds{blind: true}},
		// The five are NOT mutually exclusive — one kill can earn several at once, so Σ(weird five) may
		// legitimately exceed kills. These two cases pin that independence.
		{"combined: blind knife kill", events.Kill{Weapon: knife, AttackerBlind: true}, weirdKinds{knife: true, blind: true}},
		{
			"combined: blind no-scope wallbang",
			events.Kill{Weapon: ak, PenetratedObjects: 2, NoScope: true, AttackerBlind: true},
			weirdKinds{wallbang: true, noScope: true, blind: true},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := classifyWeirdKill(tc.kill); got != tc.want {
				t.Fatalf("classifyWeirdKill(%s): got %+v want %+v", tc.name, got, tc.want)
			}
		})
	}
}

// TestAddWeirdKillsBindsEachFlagToItsOwnCounter closes the seam the Story-5.2 review found: the flag->counter
// binding used to live inside the events.Kill closure, which FakeParser cannot drive, so a TRANSPOSED pair
// (w.noScope crediting blindKills) was invisible to the whole suite AND to THE BAR — a swap keeps every
// counter <= kills and leaves Σkills/Σdeaths untouched, so no live invariant fires either. Setting exactly
// one flag and demanding exactly one counter move reddens on any cross-wire, in either direction.
func TestAddWeirdKillsBindsEachFlagToItsOwnCounter(t *testing.T) {
	const sid uint64 = 76561197960287930

	// counters reads the five back in a fixed order so a case can assert the WHOLE vector, not just its own
	// counter — that is what catches a swap (the wrong counter moving is as much a failure as the right one
	// standing still).
	counters := func(rs *roundStats) [5]int {
		return [5]int{rs.knifeKills[sid], rs.wallbangKills[sid], rs.throughSmokeKills[sid], rs.noScopeKills[sid], rs.blindKills[sid]}
	}

	cases := []struct {
		name string
		w    weirdKinds
		want [5]int // knife, wallbang, throughSmoke, noScope, blind
	}{
		{"knife credits only knifeKills", weirdKinds{knife: true}, [5]int{1, 0, 0, 0, 0}},
		{"wallbang credits only wallbangKills", weirdKinds{wallbang: true}, [5]int{0, 1, 0, 0, 0}},
		{"throughSmoke credits only throughSmokeKills", weirdKinds{throughSmoke: true}, [5]int{0, 0, 1, 0, 0}},
		{"noScope credits only noScopeKills", weirdKinds{noScope: true}, [5]int{0, 0, 0, 1, 0}},
		{"blind credits only blindKills", weirdKinds{blind: true}, [5]int{0, 0, 0, 0, 1}},
		{"no flags credits nothing", weirdKinds{}, [5]int{0, 0, 0, 0, 0}},
		// One kill can earn several at once (the flags are independent subsets of kills), so a combined kill
		// must move exactly the counters it names and no others.
		{"combined blind no-scope wallbang", weirdKinds{wallbang: true, noScope: true, blind: true}, [5]int{0, 1, 0, 1, 1}},
		{"all five at once", weirdKinds{true, true, true, true, true}, [5]int{1, 1, 1, 1, 1}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rs := newRoundStats()
			rs.addWeirdKills(sid, tc.w)
			if got := counters(rs); got != tc.want {
				t.Fatalf("addWeirdKills(%+v): counters [knife wallbang smoke noscope blind] = %v want %v", tc.w, got, tc.want)
			}
		})
	}

	// The counters are ADDITIVE, not assignments: two knife kills in one round are two, and a second kill
	// must not reset the counters an earlier kill moved.
	rs := newRoundStats()
	rs.addWeirdKills(sid, weirdKinds{knife: true})
	rs.addWeirdKills(sid, weirdKinds{knife: true, blind: true})
	if got := counters(rs); got != [5]int{2, 0, 0, 0, 1} {
		t.Fatalf("two kills must accumulate: got %v want [2 0 0 0 1]", got)
	}

	// A second player's kills land under their OWN id and leave the first player's counters alone.
	const other uint64 = 76561198000000042
	rs.addWeirdKills(other, weirdKinds{wallbang: true})
	if got := counters(rs); got != [5]int{2, 0, 0, 0, 1} {
		t.Fatalf("another player's kill must not touch this player's counters: got %v want [2 0 0 0 1]", got)
	}
	if rs.wallbangKills[other] != 1 {
		t.Fatalf("the other player's wallbang must be credited to THEM: got %d want 1", rs.wallbangKills[other])
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
	// The FR-19 weird five (Story 5.2) fold on the SAME path and under the SAME stranded-round bound.
	// Distinct per-counter values so a fold loop copy/pasted onto the wrong map reddens.
	r1.knifeKills[p], r1.wallbangKills[p], r1.throughSmokeKills[p] = 1, 2, 3
	r1.noScopeKills[p], r1.blindKills[p] = 4, 5

	r2 := newRoundStats()
	r2.kills[p], r2.adrDamage[p] = 3, 150
	r2.kast[p] = true
	r2.knifeKills[p], r2.wallbangKills[p], r2.throughSmokeKills[p] = 10, 20, 30
	r2.noScopeKills[p], r2.blindKills[p] = 40, 50

	stranded := newRoundStats() // idx 5 > final 4 — must be dropped whole
	stranded.kills[p], stranded.assists[p], stranded.adrDamage[p] = 99, 99, 9999
	stranded.kast[p] = true
	stranded.knifeKills[p], stranded.wallbangKills[p], stranded.throughSmokeKills[p] = 99, 99, 99
	stranded.noScopeKills[p], stranded.blindKills[p] = 99, 99

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
	// The FR-19 weird five: rounds 1 + 2 sum, the stranded 99s are dropped whole (Story 5.2).
	if got.KnifeKills != 11 { // 1 + 10
		t.Fatalf("knife_kills: got %d want 11 (stranded round dropped)", got.KnifeKills)
	}
	if got.WallbangKills != 22 { // 2 + 20
		t.Fatalf("wallbang_kills: got %d want 22 (stranded round dropped)", got.WallbangKills)
	}
	if got.ThroughSmokeKills != 33 { // 3 + 30
		t.Fatalf("through_smoke_kills: got %d want 33 (stranded round dropped)", got.ThroughSmokeKills)
	}
	if got.NoScopeKills != 44 { // 4 + 40
		t.Fatalf("no_scope_kills: got %d want 44 (stranded round dropped)", got.NoScopeKills)
	}
	if got.BlindKills != 55 { // 5 + 50
		t.Fatalf("blind_kills: got %d want 55 (stranded round dropped)", got.BlindKills)
	}
}
