package ingest

import (
	"bytes"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/golang/geo/r3"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/events"
)

// TestFakeParserEchoesResultAndErr proves the test seam: the canned Result is returned verbatim, and the
// Err seam wins (fail-closed) so the wiring tests can force a parse failure.
func TestFakeParserEchoesResultAndErr(t *testing.T) {
	// Clutches (Story 5.3) makes PlayerStat non-comparable with ==, so the echo is asserted with
	// reflect.DeepEqual. ⚠ That switch was FORCED BY COMPILATION, not chosen for evidence: FakeParser returns
	// its canned Result, so got.Players[0].Clutches is the same map header as want's and DeepEqual is comparing
	// an object with itself. It would only redden against a FakeParser that rebuilt PlayerStat field by field.
	// The real proof that the map survives the PlayerStat -> StatRow mapping is assertDerivedStats over
	// cannedParse in cli_test.go / reparse_test.go. (Corrected at the Story 5.3 code review, 2026-07-21 — the
	// prior comment claimed this test proved the map "rides through the seam"; it does not.)
	want := ParseResult{RoundsPlayed: 24, Players: []PlayerStat{{
		SteamID64: 76561197960287930, Kills: 20, Deaths: 14, RoundsWon: 16,
		EntryFrags: 7, OpeningDeaths: 3, Clutches: map[int]int{1: 2, 2: 1},
	}}}
	got, err := FakeParser{Result: want}.Parse(strings.NewReader("ignored stream"))
	if err != nil {
		t.Fatal(err)
	}
	if got.RoundsPlayed != 24 || len(got.Players) != 1 || !reflect.DeepEqual(got.Players[0], want.Players[0]) {
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
//
// blind arrives as the killerBlind PARAMETER, not off e.AttackerBlind (Story 5.2a — that field is dead on
// our demos; see classifyWeirdKill). The cases below pin the consequence that matters: e.AttackerBlind must
// have NO effect on the result in either direction, so nobody "restores" it later thinking it is redundant.
func TestClassifyWeirdKillBranches(t *testing.T) {
	knife := &common.Equipment{Type: common.EqKnife}
	ak := &common.Equipment{Type: common.EqAK47}

	cases := []struct {
		name        string
		kill        events.Kill
		killerBlind bool
		want        weirdKinds
	}{
		{"knife", events.Kill{Weapon: knife}, false, weirdKinds{knife: true}},
		{"non-knife weapon is not a knife kill", events.Kill{Weapon: ak}, false, weirdKinds{}},
		{"nil weapon does not panic and is not a knife kill", events.Kill{Weapon: nil}, false, weirdKinds{}},
		{"wallbang", events.Kill{Weapon: ak, PenetratedObjects: 1}, false, weirdKinds{wallbang: true}},
		{"zero penetrated objects is NOT a wallbang", events.Kill{Weapon: ak, PenetratedObjects: 0}, false, weirdKinds{}},
		{"through smoke", events.Kill{Weapon: ak, ThroughSmoke: true}, false, weirdKinds{throughSmoke: true}},
		{"no scope", events.Kill{Weapon: ak, NoScope: true}, false, weirdKinds{noScope: true}},
		{"blind comes from killerBlind (the KILLER was flashed)", events.Kill{Weapon: ak}, true, weirdKinds{blind: true}},
		// ⭐ Story 5.2a: e.AttackerBlind is DEAD INPUT. It must not grant blind when the live state says the
		// killer could see, and must not suppress it when the live state says they could not.
		{"e.AttackerBlind=true does NOT grant blind on its own", events.Kill{Weapon: ak, AttackerBlind: true}, false, weirdKinds{}},
		{"e.AttackerBlind=false does NOT suppress a live blind kill", events.Kill{Weapon: ak, AttackerBlind: false}, true, weirdKinds{blind: true}},
		// The five are NOT mutually exclusive — one kill can earn several at once, so Σ(weird five) may
		// legitimately exceed kills. These two cases pin that independence.
		{"combined: blind knife kill", events.Kill{Weapon: knife}, true, weirdKinds{knife: true, blind: true}},
		{
			"combined: blind no-scope wallbang",
			events.Kill{Weapon: ak, PenetratedObjects: 2, NoScope: true},
			true,
			weirdKinds{wallbang: true, noScope: true, blind: true},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := classifyWeirdKill(tc.kill, tc.killerBlind); got != tc.want {
				t.Fatalf("classifyWeirdKill(%s, killerBlind=%v): got %+v want %+v", tc.name, tc.killerBlind, got, tc.want)
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

// TestRecordOpeningDuelLatchesFirstRealKill covers every branch of the FR-20 opening-duel latch (Story 5.3)
// over the PURE roundStats method — the same "decision here, call in the closure" seam kastQualified and
// classifyWeirdKill use, so each guard reddens on its own when removed.
//
// The two exclusions are FR-20 REQUIREMENTS, not defensive noise (prd.md:310 — bomb/suicide deaths are not
// opening deaths), and the "bomb then a real kill" case pins the half that is easy to get wrong: a
// world/suicide death must not latch the duel AND must not block it either.
func TestRecordOpeningDuelLatchesFirstRealKill(t *testing.T) {
	const killer = uint64(76561197960287930)
	const victim = uint64(76561198000000042)
	const other = uint64(76561198000000999)

	liveRound := func() *roundStats {
		rs := newRoundStats()
		rs.live = true // armed by RoundFreezetimeEnd in the real parser
		return rs
	}

	// A round that is NOT live (a post-round kill landing in the next round's fresh scratch) never latches —
	// this is the gate that keeps the deliberately-counted post-round knife-around out of FR-20.
	rsDead := newRoundStats()
	if rsDead.recordOpeningDuel(killer, victim) || rsDead.duelDone {
		t.Fatal("a kill outside the LIVE window must not latch the opening duel")
	}

	// World/bomb death (killer id 0) — not an opening death, and it must NOT latch.
	rsWorld := liveRound()
	if rsWorld.recordOpeningDuel(0, victim) || rsWorld.duelDone {
		t.Fatal("a world/bomb death (killer 0) must not latch the opening duel")
	}
	// Suicide (killer == victim) — likewise.
	rsSuicide := liveRound()
	if rsSuicide.recordOpeningDuel(victim, victim) || rsSuicide.duelDone {
		t.Fatal("a suicide (killer == victim) must not latch the opening duel")
	}
	// A victimless kill event is not a duel either.
	rsNoVictim := liveRound()
	if rsNoVictim.recordOpeningDuel(killer, 0) || rsNoVictim.duelDone {
		t.Fatal("a kill with no resolvable victim must not latch the opening duel")
	}

	// A bomb death BEFORE the first real kill must not consume the round's duel: the first REAL kill still
	// wins it. (A guard that latched-or-blocked on the bomb death would lose this round's entry frag.)
	rsBombThenReal := liveRound()
	rsBombThenReal.recordOpeningDuel(0, other)
	if !rsBombThenReal.recordOpeningDuel(killer, victim) {
		t.Fatal("a bomb death must not block the round's first REAL kill from latching")
	}
	if rsBombThenReal.entryFrag != killer || rsBombThenReal.openingDeath != victim {
		t.Fatalf("the REAL kill must be the latched duel: entry=%d opening=%d", rsBombThenReal.entryFrag, rsBombThenReal.openingDeath)
	}

	// The first real kill latches, and a SECOND real kill must not overwrite it.
	rs := liveRound()
	if !rs.recordOpeningDuel(killer, victim) {
		t.Fatal("the first real kill of a live round must latch the opening duel")
	}
	if !rs.duelDone || rs.entryFrag != killer || rs.openingDeath != victim {
		t.Fatalf("latched duel wrong: done=%v entry=%d opening=%d", rs.duelDone, rs.entryFrag, rs.openingDeath)
	}
	if rs.recordOpeningDuel(other, killer) {
		t.Fatal("a SECOND kill must not re-latch the opening duel")
	}
	if rs.entryFrag != killer || rs.openingDeath != victim {
		t.Fatalf("a second kill overwrote the latched duel: entry=%d opening=%d", rs.entryFrag, rs.openingDeath)
	}

	// A round with no kills at all leaves the duel unlatched, so foldRounds credits nobody.
	if newRoundStats().duelDone {
		t.Fatal("a fresh round must start with no latched duel")
	}
}

// TestArmLiveWindowResetsBothHalvesOfTheFR20State pins the re-arm contract (added by the Story 5.3 code
// review, 2026-07-21). RoundFreezetimeEnd is NOT guaranteed to fire once per committed round — THE BAR
// measured 221 freeze-time ends against 204 counted rounds on the 14 real demos, because a MatchZy restart
// re-arms a round that never reached a RoundEnd. Arming must therefore discard the aborted attempt's opening
// duel exactly as it discards its recorded deaths (a fresh tracker); resetting only ONE half would commit the
// aborted duel as the replayed round's entry frag, crediting two players who took no part in it while every
// aggregate invariant stayed green (Σentry == Σopening, Σentry <= rounds). Measured unreachable on today's
// corpus — 0 re-arms carried a stale latch across all 14 demos — so this test is the ONLY thing standing
// between that asymmetry and a future demo that restarts mid-round.
func TestArmLiveWindowResetsBothHalvesOfTheFR20State(t *testing.T) {
	const killer = uint64(76561197960287930)
	const victim = uint64(76561198000000042)
	const other = uint64(76561198000000999)

	rs := newRoundStats()

	// Arm, play out an attempt: a duel latches and a death moves the alive counts.
	rs.armLiveWindow()
	rs.clutch.addAlive(killer, 2)
	rs.clutch.addAlive(other, 2)
	rs.clutch.addAlive(victim, 3)
	if !rs.recordOpeningDuel(killer, victim) {
		t.Fatal("setup: the first real kill of an armed round must latch")
	}
	rs.clutch.kill(victim)

	// The round is aborted and re-armed with no RoundEnd in between.
	rs.armLiveWindow()

	if rs.duelDone || rs.entryFrag != 0 || rs.openingDeath != 0 {
		t.Fatalf("re-arming must discard the aborted attempt's opening duel: done=%v entry=%d opening=%d",
			rs.duelDone, rs.entryFrag, rs.openingDeath)
	}
	if !rs.live {
		t.Fatal("re-arming must leave the round live")
	}
	if len(rs.clutch.team) != 0 || len(rs.clutch.aliveOn) != 0 || len(rs.clutch.candidates) != 0 {
		t.Fatalf("re-arming must install a FRESH clutch tracker: team=%v aliveOn=%v candidates=%v",
			rs.clutch.team, rs.clutch.aliveOn, rs.clutch.candidates)
	}

	// The replayed round's OWN first kill must now win the duel — the whole point of the reset.
	if !rs.recordOpeningDuel(other, killer) {
		t.Fatal("after a re-arm the replayed round's first real kill must latch")
	}
	if rs.entryFrag != other || rs.openingDeath != killer {
		t.Fatalf("the replayed round's duel is wrong: entry=%d opening=%d", rs.entryFrag, rs.openingDeath)
	}
}

// TestClutchTrackerTransitionOnly is the AC2 table: a 1vX clutch candidate exists ONLY where a player
// TRANSITIONS from a team of >=2 alive to being its sole survivor, with X locked at that instant. Pure ints,
// no demoinfocs types — which is what makes every branch reddenable without a real demo.
func TestClutchTrackerTransitionOnly(t *testing.T) {
	const (
		teamT  = 2 // the plain int team codes common.Team carries; the tracker never interprets them
		teamCT = 3
	)
	// Two five-player rosters; the cases use as many as they need.
	a := [5]uint64{76561198000000001, 76561198000000002, 76561198000000003, 76561198000000004, 76561198000000005}
	b := [5]uint64{76561198000000011, 76561198000000012, 76561198000000013, 76561198000000014, 76561198000000015}

	setup := func(nA, nB int) *clutchTracker {
		ct := newClutchTracker()
		for i := 0; i < nA; i++ {
			ct.addAlive(a[i], teamT)
		}
		for i := 0; i < nB; i++ {
			ct.addAlive(b[i], teamCT)
		}
		return ct
	}

	cases := []struct {
		name  string
		build func() *clutchTracker
		want  map[uint64]int
	}{
		{
			// ⭐ THE TOURNAMENT-FORMAT CASE — do not delete it. The whole first tournament is 1v1 wingman, so
			// this is what every real round looks like: a team of one goes 1 -> 0 and NEVER -> 1, so nobody
			// ever BECOMES last alive. `clutches` is legitimately {} for every player. Chosen behaviour
			// (Cuatro, 2026-07-21), and it falls out of the rule — there is no "1v1" branch in the tracker.
			name: "1v1 never produces a candidate (the tournament format)",
			build: func() *clutchTracker {
				ct := setup(1, 1)
				ct.kill(a[0])
				ct.kill(b[0])
				return ct
			},
			want: map[uint64]int{},
		},
		{
			name: "2v2: a teammate's death makes the survivor a candidate at X=2",
			build: func() *clutchTracker {
				ct := setup(2, 2)
				ct.kill(a[0])
				return ct
			},
			want: map[uint64]int{a[1]: 2},
		},
		{
			// X is LOCKED at the instant of the transition: killing an opponent afterwards does not shrink it
			// (a 1v2 that becomes a 1v1 was still clutched from 1v2). The second transition also shows both
			// teams can hold a candidate at once — award() resolves that by winner membership, never by side.
			name: "X stays locked when an opponent dies later; both teams can hold a candidate",
			build: func() *clutchTracker {
				ct := setup(2, 2)
				ct.kill(a[0]) // a[1] becomes last alive vs 2
				ct.kill(b[0]) // b[1] becomes last alive vs 1 (a[1]); a[1]'s X must NOT move
				return ct
			},
			want: map[uint64]int{a[1]: 2, b[1]: 1},
		},
		{
			name: "5v5 chain: four teammates die, the survivor is a candidate at the opponents then alive",
			build: func() *clutchTracker {
				ct := setup(5, 5)
				ct.kill(b[0]) // an opponent dies first, so X is 4 rather than 5
				ct.kill(a[0])
				ct.kill(a[1])
				ct.kill(a[2])
				ct.kill(a[3])
				return ct
			},
			want: map[uint64]int{a[4]: 4},
		},
		{
			// FR-20 names "bomb explosion" as a winning path, so the plant-and-die clutch counts: candidacy is
			// recorded at the transition and is NOT revoked when the candidate later dies. award() then asks
			// the only question that matters — did their team win.
			name: "a candidate who later dies KEEPS candidacy (the bomb-explosion path)",
			build: func() *clutchTracker {
				ct := setup(2, 2)
				ct.kill(a[0])
				ct.kill(a[1]) // the candidate themselves dies
				return ct
			},
			want: map[uint64]int{a[1]: 2},
		},
		{
			name: "X == 0 is not a clutch: every opponent is already dead",
			build: func() *clutchTracker {
				ct := setup(2, 1)
				ct.kill(b[0]) // the lone opponent dies (1 -> 0: no transition on that team)
				ct.kill(a[0]) // a[1] is now last alive, but there is nobody left to clutch against
				return ct
			},
			want: map[uint64]int{},
		},
		{
			// An unknown victim (a late joiner absent from the freeze-time snapshot) and a DUPLICATE death are
			// both no-ops — the idempotence that keeps aliveOn off negative numbers and stops a phantom death
			// from manufacturing a candidate.
			name: "unknown victim and duplicate death are no-ops",
			build: func() *clutchTracker {
				ct := setup(2, 2)
				ct.kill(76561198000000777) // never added
				ct.kill(a[0])
				ct.kill(a[0]) // duplicate
				return ct
			},
			want: map[uint64]int{a[1]: 2},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ct := tc.build()
			if !reflect.DeepEqual(ct.candidates, tc.want) {
				t.Fatalf("candidates: got %v want %v", ct.candidates, tc.want)
			}
			for team, n := range ct.aliveOn {
				if n < 0 {
					t.Fatalf("aliveOn[%d] went NEGATIVE (%d) — a death was applied to an unknown/dead victim", team, n)
				}
			}
		})
	}

	// A repeated addAlive for the same id must not inflate the team (which would inflate every X computed
	// against it) — the arming snapshot is walked from live parser state, so it must be idempotent.
	ct := newClutchTracker()
	ct.addAlive(a[0], teamT)
	ct.addAlive(a[0], teamT)
	if ct.aliveOn[teamT] != 1 {
		t.Fatalf("a duplicate addAlive must not double-count the team: got %d want 1", ct.aliveOn[teamT])
	}
}

// TestClutchAwardOnlyWinningTeam pins the AC2 half that decides whether a candidate is CREDITED: their team
// won the round. Resolution is by MEMBERSHIP in the winners set (RoundEnd's WinnerState.Members(), resolved
// at that instant), never by a side identifier — halftime-proof by construction, the same trap-2-safe move
// RoundsWon makes. An empty set is a DRAW (WinnerState nil, trap 3): nobody clutches.
func TestClutchAwardOnlyWinningTeam(t *testing.T) {
	const (
		teamT  = 2
		teamCT = 3
	)
	const a1, a2 = uint64(76561198000000001), uint64(76561198000000002)
	const b1, b2 = uint64(76561198000000011), uint64(76561198000000012)

	build := func() *clutchTracker {
		ct := newClutchTracker()
		ct.addAlive(a1, teamT)
		ct.addAlive(a2, teamT)
		ct.addAlive(b1, teamCT)
		ct.addAlive(b2, teamCT)
		ct.kill(a1) // a2 becomes a candidate at X=2
		ct.kill(b1) // b2 becomes a candidate at X=1
		return ct
	}

	// The winning team's candidate is credited; the losing team's is NOT.
	got := build().award(map[uint64]bool{a2: true})
	if !reflect.DeepEqual(got, map[uint64]int{a2: 2}) {
		t.Fatalf("only the WINNING team's candidate may be credited: got %v want map[%d:2]", got, a2)
	}
	got = build().award(map[uint64]bool{b2: true})
	if !reflect.DeepEqual(got, map[uint64]int{b2: 1}) {
		t.Fatalf("the other team's candidate must be credited when THEY win: got %v", got)
	}
	// A winner who is not a candidate earns nothing (winning a round is not clutching it).
	if got = build().award(map[uint64]bool{b1: true}); len(got) != 0 {
		t.Fatalf("a winner who never became last alive must not be credited: got %v", got)
	}
	// A draw (WinnerState nil ⇒ no winners set built) credits nobody.
	if got = build().award(map[uint64]bool{}); len(got) != 0 {
		t.Fatalf("a draw must credit no clutch: got %v", got)
	}
}

// TestIsIdleRound covers every branch of the FR-21 idle classifier (Story 5.4) over the PURE roundStats
// method — the same "decision here, sampling in the closure" seam kastQualified/recordOpeningDuel use, so each
// of the three guards reddens on its own when removed. epsilon is passed IN, so the whole test is plain
// float64/bool with no demo. The three guards are FR-21 requirements, not defensive noise:
//   - !sampled → NOT idle (idle undecidable without a sample; the SAFE direction that turns a dead Position()
//     signal into "nobody idle" rather than "everyone idle" — trap 2 / SM-C1).
//   - acted → NOT idle even when motionless.
//   - maxDisp < epsilon is STRICT: exactly-epsilon is NOT idle.
func TestIsIdleRound(t *testing.T) {
	const p = uint64(76561197960287930)
	const eps = 64.0

	// unsampled → NOT idle (undecidable; never DQ on missing data). Note maxDisp is 0 (< eps) and acted is
	// false here, so ONLY the !sampled guard keeps this from reading idle — removing it reddens this case.
	if newRoundStats().isIdleRound(p, eps) {
		t.Fatal("an unsampled player must NOT be idle (undecidable — the safe direction)")
	}

	// sampled + no action + maxDisp < epsilon → idle.
	rsIdle := newRoundStats()
	rsIdle.sampled[p] = true
	rsIdle.posMaxDisp[p] = 10
	if !rsIdle.isIdleRound(p, eps) {
		t.Fatal("sampled, no action, displacement below epsilon → idle")
	}

	// sampled + moved (maxDisp >= epsilon) → NOT idle.
	rsMoved := newRoundStats()
	rsMoved.sampled[p] = true
	rsMoved.posMaxDisp[p] = 100
	if rsMoved.isIdleRound(p, eps) {
		t.Fatal("a player who moved >= epsilon must NOT be idle")
	}

	// sampled + acted, even with maxDisp == 0 (motionless) → NOT idle (the acted guard alone decides).
	rsActed := newRoundStats()
	rsActed.sampled[p] = true
	rsActed.acted[p] = true
	if rsActed.isIdleRound(p, eps) {
		t.Fatal("a player who acted must NOT be idle, even if motionless")
	}

	// sampled + DIED this round, even motionless and having not acted → NOT idle (the survival guard, review
	// 2026-07-27). A player rushed and killed near spawn before moving epsilon or firing was involuntarily
	// stopped, not idle-farming — flagging them would wrongly DQ an active duelist in the 1v1 wingman format.
	// Removing the deaths>0 guard reddens THIS case (maxDisp 0 < eps and acted false, so only the guard saves it).
	rsDied := newRoundStats()
	rsDied.sampled[p] = true
	rsDied.deaths[p] = 1
	if rsDied.isIdleRound(p, eps) {
		t.Fatal("a player who DIED this round must NOT be idle (involuntarily stopped — the safe direction)")
	}

	// The boundary: maxDisp EXACTLY epsilon → NOT idle (strict <). Inverting < to <= or > reddens here.
	rsBoundary := newRoundStats()
	rsBoundary.sampled[p] = true
	rsBoundary.posMaxDisp[p] = eps
	if rsBoundary.isIdleRound(p, eps) {
		t.Fatal("displacement EXACTLY at epsilon must NOT be idle (strict <)")
	}
}

// TestIdleDQThreshold pins the fold's idle-DQ ratio (Story 5.4): idle_dq is set when idle*Denom >= present*Numer
// (>= 50%), computed as an INTEGER ratio with no float. It drives the REAL formula through foldRounds (the
// formula lives inline there, not in a separate function), building `present` rounds with the first `idle` of
// them idle. This is the AC2 money boundary — flipping the >= to > (so exactly-50% no longer DQs) or swapping
// present/idle in the ratio reddens a case below.
func TestIdleDQThreshold(t *testing.T) {
	const p = uint64(76561197960287930)

	// foldIdle builds `present` counted rounds (idx 1..present, all within final) where the first `idle` are
	// idle for p, folds them, and returns p's PlayerStat.
	foldIdle := func(idle, present int) *PlayerStat {
		byRound := map[int]*roundStats{}
		for i := 1; i <= present; i++ {
			rs := newRoundStats()
			rs.present[p] = true
			if i <= idle {
				rs.idleRound[p] = true
			}
			byRound[i] = rs
		}
		stats := foldRounds(byRound, map[int][]uint64{}, map[int]uint64{}, present)
		return stats[p]
	}

	cases := []struct {
		idle, present int
		wantDQ        bool
	}{
		{0, 10, false}, // 0% → not DQ
		{4, 10, false}, // 40% → not DQ (4*2=8 >= 10*1=10 is false)
		{5, 10, true},  // exactly 50% → DQ (10 >= 10) — the boundary the > mutant breaks
		{6, 10, true},  // 60% → DQ
		{10, 10, true}, // 100% → DQ
	}
	for _, tc := range cases {
		s := foldIdle(tc.idle, tc.present)
		if s == nil {
			t.Fatalf("idle=%d/present=%d: player missing from the fold", tc.idle, tc.present)
		}
		if s.IdleRoundCount != tc.idle {
			t.Fatalf("idle=%d/present=%d: IdleRoundCount got %d want %d", tc.idle, tc.present, s.IdleRoundCount, tc.idle)
		}
		if s.IdleDQ != tc.wantDQ {
			t.Fatalf("idle=%d/present=%d: IdleDQ got %v want %v", tc.idle, tc.present, s.IdleDQ, tc.wantDQ)
		}
	}

	// present == 0: a player with a row (they got a kill) but never Playing at any RoundEnd is NOT DQ'd —
	// undecidable, safe direction, and no div-by-zero. Their idle_round_count is the struct-zero 0.
	rs := newRoundStats()
	rs.kills[p] = 1 // in the fold via kills, but present is never set
	stats := foldRounds(map[int]*roundStats{1: rs}, map[int][]uint64{}, map[int]uint64{}, 1)
	if s := stats[p]; s == nil || s.IdleDQ || s.IdleRoundCount != 0 {
		t.Fatalf("present==0 must be NOT DQ'd with idle_round_count 0, got %+v", s)
	}
}

// TestFoldRoundsAfkIdle proves the FR-21 fold (Story 5.4): idle/present tally across surviving rounds, respect
// the idx > final stranded-round bound, and — the case that matters — a stranded idle round that WOULD have
// flipped idle_dq if counted is dropped. Surviving alone: present 3, idle 1 (33%) → NOT DQ. If the stranded
// round (present + idle) were wrongly counted: present 4, idle 2 (50%) → DQ. So the bound is load-bearing here,
// not decorative.
func TestFoldRoundsAfkIdle(t *testing.T) {
	const p = uint64(76561197960287930)
	const final = 3

	mk := func(present, idle bool) *roundStats {
		rs := newRoundStats()
		if present {
			rs.present[p] = true
		}
		if idle {
			rs.idleRound[p] = true
		}
		return rs
	}

	byRound := map[int]*roundStats{
		1: mk(true, true),  // present + idle
		2: mk(true, false), // present, not idle
		3: mk(true, false), // present, not idle
		4: mk(true, true),  // STRANDED (idx 4 > final 3): present + idle, must be dropped whole
	}
	stats := foldRounds(byRound, map[int][]uint64{}, map[int]uint64{}, final)
	got := stats[p]
	if got == nil {
		t.Fatal("player must be present in the fold")
	}
	if got.IdleRoundCount != 1 { // round 1 only; the stranded round-4 idle is dropped
		t.Fatalf("idle_round_count: got %d want 1 (stranded idle round dropped)", got.IdleRoundCount)
	}
	if got.IdleDQ { // surviving 1/3 = 33% → not DQ; counting the stranded round would flip it to 50%
		t.Fatal("idle_dq must be false — a stranded idle round must NOT flip the verdict")
	}
}

// TestArmLiveWindowResetsAfkState pins the FR-21 half of the re-arm contract (Story 5.4), the twin of the
// FR-20 reset TestArmLiveWindowResetsBothHalvesOfTheFR20State guards: a MatchZy restart re-arms a round that
// never reached a RoundEnd, so arming must discard the aborted attempt's movement/action or it leaks into the
// replayed round and could flip its idle verdict. All six FR-21 maps must come back empty.
func TestArmLiveWindowResetsAfkState(t *testing.T) {
	const p = uint64(76561197960287930)
	rs := newRoundStats()

	// Arm, then play out an attempt: a sample, movement, an action, and a computed presence/idle verdict.
	rs.armLiveWindow()
	rs.sampled[p] = true
	rs.posAnchor[p] = r3.Vector{X: 1, Y: 2, Z: 3}
	rs.posMaxDisp[p] = 42
	rs.acted[p] = true
	rs.present[p] = true
	rs.idleRound[p] = true

	// The round is aborted and re-armed with no RoundEnd in between.
	rs.armLiveWindow()

	if len(rs.acted) != 0 || len(rs.posAnchor) != 0 || len(rs.posMaxDisp) != 0 ||
		len(rs.sampled) != 0 || len(rs.present) != 0 || len(rs.idleRound) != 0 {
		t.Fatalf("re-arming must clear ALL FR-21 per-round maps: acted=%v posAnchor=%v posMaxDisp=%v sampled=%v present=%v idleRound=%v",
			rs.acted, rs.posAnchor, rs.posMaxDisp, rs.sampled, rs.present, rs.idleRound)
	}
	if !rs.live {
		t.Fatal("re-arming must leave the round live")
	}
}

// TestFoldRoundsDropsStrandedRounds proves the trap-4 fold: a round index ABOVE the final count (a
// higher-water-mark rewind, e.g. an admin !restore) is dropped from EVERY additive stat, RoundsWon and MVPs,
// while surviving rounds sum.
func TestFoldRoundsDropsStrandedRounds(t *testing.T) {
	const p = uint64(76561197960287930)
	const opponent = uint64(76561198000000042)
	const final = 4

	r1 := newRoundStats()
	r1.kills[p], r1.deaths[p], r1.assists[p] = 2, 1, 1
	r1.flashAssists[p], r1.hsKills[p], r1.adrDamage[p], r1.utilityDamage[p] = 1, 1, 100, 20
	r1.kast[p] = true
	// The FR-20 derived three (Story 5.3): a LATCHED duel credits one entry frag to the killer and one
	// opening death to the victim, and an awarded clutch tallies under its own X.
	r1.duelDone, r1.entryFrag, r1.openingDeath = true, p, opponent
	r1.clutchWon = map[uint64]int{p: 2}
	// The FR-19 weird five (Story 5.2) fold on the SAME path and under the SAME stranded-round bound.
	// Distinct per-counter values so a fold loop copy/pasted onto the wrong map reddens.
	r1.knifeKills[p], r1.wallbangKills[p], r1.throughSmokeKills[p] = 1, 2, 3
	r1.noScopeKills[p], r1.blindKills[p] = 4, 5

	r2 := newRoundStats()
	r2.kills[p], r2.adrDamage[p] = 3, 150
	r2.kast[p] = true
	r2.knifeKills[p], r2.wallbangKills[p], r2.throughSmokeKills[p] = 10, 20, 30
	r2.noScopeKills[p], r2.blindKills[p] = 40, 50
	// Round 2 latched the duel the OTHER way round (and clutched at a different X), so the two counters and
	// the two jsonb keys are proven independent rather than moving together.
	r2.duelDone, r2.entryFrag, r2.openingDeath = true, opponent, p
	r2.clutchWon = map[uint64]int{p: 1}

	// A counted round that latched NOTHING must contribute nothing. It carries duel ids anyway so that
	// `duelDone` — not the presence of the ids — is proven to be the authority: drop that fold guard and this
	// round starts crediting a duel that never happened.
	r3 := newRoundStats()
	r3.entryFrag, r3.openingDeath = p, opponent // ids without duelDone == false: no duel

	// ⚠ r4 exists to make the fixture ASYMMETRIC. With only r1 + r2 (one duel each way) a TRANSPOSED fold —
	// crediting EntryFrags to rs.openingDeath and vice versa — produces the identical totals for both players
	// and passes: exactly the swap the Story-5.2 review found surviving both the suite and THE BAR. A third
	// duel latched the SAME way as r1 breaks the symmetry, so a transposition reddens.
	r4 := newRoundStats()
	r4.duelDone, r4.entryFrag, r4.openingDeath = true, p, opponent

	stranded := newRoundStats() // idx 5 > final 4 — must be dropped whole
	stranded.kills[p], stranded.assists[p], stranded.adrDamage[p] = 99, 99, 9999
	stranded.kast[p] = true
	stranded.knifeKills[p], stranded.wallbangKills[p], stranded.throughSmokeKills[p] = 99, 99, 99
	stranded.noScopeKills[p], stranded.blindKills[p] = 99, 99
	stranded.duelDone, stranded.entryFrag, stranded.openingDeath = true, p, opponent
	stranded.clutchWon = map[uint64]int{p: 5}

	byRound := map[int]*roundStats{1: r1, 2: r2, 3: r3, 4: r4, 5: stranded}
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
	// The FR-20 derived three (Story 5.3), same bound: rounds 1 + 2 count (one entry frag and one opening
	// death each way), round 3 latched nothing and contributes nothing, and the stranded round is dropped
	// whole — its duel AND its clutch.
	if got.EntryFrags != 2 { // rounds 1 + 4 (round 2's entry frag belongs to the opponent)
		t.Fatalf("entry_frags: got %d want 2 (stranded duel dropped, unlatched round ignored)", got.EntryFrags)
	}
	if got.OpeningDeaths != 1 { // round 2 only
		t.Fatalf("opening_deaths: got %d want 1 (stranded duel dropped, unlatched round ignored)", got.OpeningDeaths)
	}
	if !reflect.DeepEqual(got.Clutches, map[int]int{1: 1, 2: 1}) { // the stranded 1v5 is dropped
		t.Fatalf("clutches: got %v want map[1:1 2:1] (stranded clutch dropped)", got.Clutches)
	}
	// The other side of every duel folds onto the OPPONENT's row (asymmetrically — see r4), and the two
	// columns still balance across the demo: Σentry_frags == Σopening_deaths, the conservation THE BAR
	// asserts live.
	opp := stats[opponent]
	if opp == nil || opp.EntryFrags != 1 || opp.OpeningDeaths != 2 {
		t.Fatalf("the duel's other side must fold onto the opponent's row (1 entry / 2 opening): %+v", opp)
	}
	if got.EntryFrags+opp.EntryFrags != got.OpeningDeaths+opp.OpeningDeaths {
		t.Fatalf("Σentry_frags must equal Σopening_deaths: %d != %d",
			got.EntryFrags+opp.EntryFrags, got.OpeningDeaths+opp.OpeningDeaths)
	}
	if opp.Clutches != nil {
		t.Fatalf("a player with no awarded clutch must keep a NIL map (the writer renders it {}): got %v", opp.Clutches)
	}
}
