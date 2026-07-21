package ingest

import (
	"fmt"
	"io"
	"sort"
	"time"

	dem "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/events"
)

// ParserVersion is the pinned demoinfocs build stamped on demo.parser_version when a parse produces stat
// rows (AD-26: the pinned parser is the durability lever against Valve format churn — retained raw demos
// re-parse on upgrade). Keep it in LOCKSTEP with the demoinfocs-golang/v5 require line in worker/go.mod.
const ParserVersion = "demoinfocs-golang/v5 v5.2.0"

// PlayerStat is one parsed player's payload: the Story-3.3 minimum-viable (kills/deaths), the Story-4.6a
// demo-derived RoundsWon tally, the Story-5.1 FR-18 CORE SEVEN (assists, ADR damage, headshot kills, MVPs,
// flash assists, utility damage, KAST rounds), the Story-5.2 FR-19 WEIRD FIVE (knife, wallbang,
// through-smoke, no-scope and blind kills), and — as of Story 5.3 — the FR-20 DERIVED THREE (entry frags,
// opening deaths, 1vX clutches). The parser stores raw NUMERATORS/COUNTS, never ratios: ADR/HS%/KAST% AND
// FR-20's ENTRY SUCCESS RATE are divided ONCE in the Epic-5 leaderboard view (AD-20 one-owner), so
// ADRDamage is the TOTAL overkill-capped damage (view: ADRDamage/RoundsPlayed), HSKills a count (view:
// HSKills/Kills), KASTRounds a count (view: KASTRounds/RoundsPlayed) and EntryFrags/OpeningDeaths two raw
// counts (view: EntryFrags/(EntryFrags+OpeningDeaths)). Store counts; divide nowhere. Only FR-21's IDLE
// stats (idle_dq, idle_round_count — Story 5.4) remain at their nullable column defaults. This widens the
// struct + the writer, never the schema (every stat_row column already exists, nullable, since 0007).
//
// ⚠ FR-19's trailing "molotov/HE damage" clause is ALREADY SHIPPED as UtilityDamage by Story 5.1 (one
// utility_damage column, 0007:43). There is no molotov/HE split to build; 5.2 is exactly five counters.
//
// ⭐ RoundsWon is PER-PLAYER, never score_a/score_b (Story 4.6a DECISION B). `a`/`b` name the MATCH's
// competitor seats, and this worker cannot resolve them. Three reasons, in the order that actually binds:
//  1. SEQUENCING — at parse time NO bracket row is associated with this demo at all. The demo->match
//     association is a later, explicit admin act (0016's bind_match_demo). There is no match to ask.
//  2. SCHEMA — the worker holds only the EXTERNAL matchzy_match_id (a game-server id; 0010's rename left it
//     that and nothing else), while match.competitor_a is a roster_entry_id resolvable only via the bracket.
//  3. AD-2 (SPINE:85-88) — the worker is the single writer of demo + stat_row, and the approve decisions are
//     "admin actions on the app side, never the worker". So even a resolvable seat would not be its call.
//
// ⚠ Earlier drafts asserted the worker is "match-agnostic BY AD-2 DESIGN". That overstates the citation:
// AD-2 governs who WRITES, not what the worker KNOWS — and AD-3 (SPINE:93) in fact models the worker's own
// dedup keys AS match_id. DECISION B is right; reasons 1 and 2 are what make it right. (Code review
// 2026-07-16.)
//
// So the parser emits the only fact it is entitled to know — a tally keyed by SteamID64 (the same AD-4 key
// the rest of the row rides) — and Story 4.6b maps those onto the seats inside the Aprobar transaction,
// where the bracket knowledge lives.
type PlayerStat struct {
	SteamID64 uint64
	Kills     int
	Deaths    int
	RoundsWon int
	// The FR-18 core seven (Story 5.1). All raw counts/totals — the leaderboard view (Story 5.5) divides.
	Assists       int // kills with a (non-nil) assister — the scoreboard "A" (damage OR flash assists)
	ADRDamage     int // TOTAL overkill-capped HealthDamageTaken dealt (ADR = ADRDamage/RoundsPlayed in 5.5)
	HSKills       int // headshot kills (HS% = HSKills/Kills in 5.5)
	MVPs          int // RoundMVPAnnouncement count
	FlashAssists  int // the subset of Assists where the assist was a flash (AssistedFlash) — always <= Assists
	UtilityDamage int // overkill-capped HE + molotov/incendiary damage dealt (a subset of ADRDamage)
	KASTRounds    int // rounds the player got a Kill/Assist/Survived/was Traded (KAST% = KASTRounds/RoundsPlayed in 5.5)
	// The FR-19 WEIRD FIVE (Story 5.2) — the comedy/weird award tracks. All credited to the KILLER, each
	// tallied from a NATIVE events.Kill field (never a heuristic), each an overlapping SUBSET of Kills: one
	// kill can earn several at once, so any one is <= Kills while their SUM may legitimately exceed it.
	KnifeKills        int // Weapon.Type == EqKnife (every knife SKIN normalizes to that one type)
	WallbangKills     int // Kill.IsWallBang() (≡ PenetratedObjects > 0)
	ThroughSmokeKills int // Kill.ThroughSmoke
	NoScopeKills      int // Kill.NoScope
	BlindKills        int // Kill.AttackerBlind — the KILLER was flashed ("blind justice"); events.Kill carries NO victim-blind field
	// The FR-20 DERIVED THREE (Story 5.3) — not read off any single event field but DERIVED from the event
	// stream's per-round shape: an opening-duel latch and an alive-count transition. Entry success rate is
	// NOT here — it is the ratio EntryFrags/(EntryFrags+OpeningDeaths), computed once in the 5.5 view (AD-20).
	EntryFrags    int         // killer of the round's first live kill (FR-20 opening duel)
	OpeningDeaths int         // victim of that same kill
	Clutches      map[int]int // X -> count of 1vX clutches WON; nil/empty when none (the writer renders {} , never null)
}

// kastTradeWindow is the KAST "traded" window (FR-18, prd.md:103): a round counts for a player who died if
// the teammate/opponent who killed them themselves dies within this window AFTER the death. It is a
// PUBLISHED, code-level stat convention (the AC2 "build-time config"), NOT a secret/endpoint — so it lives
// here, never in worker/config (AD-25 = server-only secrets). The ADR convention is the sibling constant,
// documented at the PlayerHurt handler: ALWAYS the overkill-capped events.PlayerHurt.HealthDamageTaken,
// NEVER the raw HealthDamage — that is what makes ADR match the in-game scoreboard (AC2).
const kastTradeWindow = 5 * time.Second

// roundDeath is one death inside a counted round — the victim, the killer (0 = world / unattributed) and the
// ingame time (p.CurrentTime()) it happened. It is the raw material for the KAST "survived"/"traded" tests.
type roundDeath struct {
	victim uint64
	killer uint64
	at     time.Duration
}

// roundStats buffers ONE counted round's additive per-player tallies plus the inputs KAST needs. The parser
// accumulates the round IN PROGRESS into a scratch roundStats and, at RoundEnd, ASSIGNS it into a per-round
// map keyed by the game's own TotalRoundsPlayed() — the SAME key + overwrite discipline RoundsWon uses (see
// the trap-4 commentary in Parse). Why commit-whole-round-then-assign rather than a bare per-event counter:
// a MatchZy pre-match round is played, won, then discarded by a score reset that REWINDS TotalRoundsPlayed(),
// and the replayed round re-reaches the same low index. RoundsWon survives because it ASSIGNS a per-round
// value (last write wins) — but an ADDITIVE `counter++` keyed at event time would land the pre-match round
// AND its replay on the same index and merge them (a rewind cannot un-add). Committing the completed round as
// a unit and ASSIGNING it means the replay OVERWRITES the discarded round; the final fold then drops any index
// stranded above the final count (a higher-water-mark mid-match rewind). So every additive stat becomes
// scoreboard-consistent BY CONSTRUCTION, and the previously-uncorrected kills/deaths fold onto the same path.
// Because the commit is a destructive MOVE (not RoundsWon's recompute), a duplicate RoundEnd at a stable index
// is made idempotent by the `roundStarted` guard in Parse (skip the commit when no RoundStart has fired since
// the last one) — so an empty scratch never overwrites a committed round, nor false-credits KAST.
type roundStats struct {
	kills         map[uint64]int
	deaths        map[uint64]int
	assists       map[uint64]int
	flashAssists  map[uint64]int
	hsKills       map[uint64]int
	adrDamage     map[uint64]int
	utilityDamage map[uint64]int
	// The FR-19 weird five (Story 5.2). Additive per-kill counters, so they ride this scratch like every
	// other additive stat — a bare `stats[k].KnifeKills++` at event time would silently carry the discarded
	// MatchZy pre-match round (a MEASURED +1 on 14 of 14 real demos — see the trap-4 block in Parse).
	knifeKills        map[uint64]int
	wallbangKills     map[uint64]int
	throughSmokeKills map[uint64]int
	noScopeKills      map[uint64]int
	blindKills        map[uint64]int
	gotKill           map[uint64]bool // players who got >=1 kill this round (KAST "K")
	gotAssist         map[uint64]bool // players who got >=1 assist this round (KAST "A")
	deathEvents       []roundDeath    // every death this round in order (KAST "S"/"T")
	kast              map[uint64]bool // participating players credited a KAST round (computed at RoundEnd)
	// The FR-20 derived three (Story 5.3). Unlike every counter above, these are NOT per-event tallies: the
	// opening duel is a one-shot LATCH over the round and the clutch is an alive-count TRANSITION, so the
	// round carries the latched pair + the awarded result and foldRounds turns them into counts.
	//
	// ⭐ `live` is the whole reason post-round kills cannot corrupt FR-20. It is false in a fresh scratch and
	// only becomes true at RoundFreezetimeEnd, so a kill landing between RoundEnd and the next freeze-time end
	// — which we DELIBERATELY count for kills/deaths and the FR-19 weird five (see the Kill handler) — can
	// neither claim an entry frag nor move the clutch alive counts. Both behaviours are correct; do not unify.
	live         bool           // the round is in its LIVE window (freeze time has ended, RoundEnd has not fired)
	entryFrag    uint64         // killer of this round's opening duel (0 until latched)
	openingDeath uint64         // victim of this round's opening duel (0 until latched)
	duelDone     bool           // the opening duel has been latched — a later kill must not overwrite it
	clutch       *clutchTracker // alive-count state machine, armed at RoundFreezetimeEnd (nil until then)
	clutchWon    map[uint64]int // the AWARDED result at RoundEnd: player -> X. Rides the scratch like every
	// other stat so it gets the trap-4 assign/overwrite commit for free.
}

func newRoundStats() *roundStats {
	return &roundStats{
		kills:         map[uint64]int{},
		deaths:        map[uint64]int{},
		assists:       map[uint64]int{},
		flashAssists:  map[uint64]int{},
		hsKills:       map[uint64]int{},
		adrDamage:     map[uint64]int{},
		utilityDamage: map[uint64]int{},

		knifeKills:        map[uint64]int{},
		wallbangKills:     map[uint64]int{},
		throughSmokeKills: map[uint64]int{},
		noScopeKills:      map[uint64]int{},
		blindKills:        map[uint64]int{},

		gotKill:   map[uint64]bool{},
		gotAssist: map[uint64]bool{},
		kast:      map[uint64]bool{},
	}
}

// kastQualified reports whether `player` earned a KAST round from THIS round's tallies: they got a Kill, an
// Assist, Survived (were not a victim this round), or were Traded (the player who killed them died within
// tradeWindow AFTER them). It is PURE over roundStats, so the four branches + the trade-window boundary are
// unit-tested with no real demo. The caller restricts evaluation to PARTICIPATING players
// (GameState().Participants().Playing()), so a benched/spectating account is never silently credited a
// "survived" round every round.
func (rs *roundStats) kastQualified(player uint64, tradeWindow time.Duration) bool {
	if rs.gotKill[player] || rs.gotAssist[player] {
		return true // K or A
	}
	var died bool
	var deathTime time.Duration
	var killer uint64
	for _, d := range rs.deathEvents {
		if d.victim == player {
			died, deathTime, killer = true, d.at, d.killer
			break // one death per player per round
		}
	}
	if !died {
		return true // S — survived (not a victim this round)
	}
	if killer == 0 {
		return false // died to world/unattributed: no killer to be traded against
	}
	for _, d := range rs.deathEvents {
		// T — the player who killed `player` was themselves killed within the window AFTER the death.
		if d.victim == killer && d.at >= deathTime && d.at-deathTime <= tradeWindow {
			return true
		}
	}
	return false
}

// armLiveWindow arms the round for FR-20: it opens the live window and resets BOTH halves of the derived
// state — the opening-duel latch and the clutch tracker — so a re-arm can never mix an aborted attempt's duel
// into the round that actually commits. Pure over roundStats (the DECISION here, only the CALL in the
// RoundFreezetimeEnd closure), which is what makes the reset mutation-testable; the handler itself is
// unreachable by FakeParser. See the handler for why a re-arm happens at all (measured: 221 freeze-time ends
// against 204 counted rounds).
func (rs *roundStats) armLiveWindow() {
	rs.live = true
	rs.entryFrag, rs.openingDeath, rs.duelDone = 0, 0, false
	rs.clutch = newClutchTracker()
}

// recordOpeningDuel latches this round's OPENING DUEL (FR-20) on the FIRST kill of the LIVE round that has a
// real killer who is not the victim, and reports whether it latched. Like kastQualified it is PURE over
// roundStats — the DECISION lives here, only the CALL lives in the events.Kill closure — which is what makes
// every branch below mutation-testable with no real demo (the seam the Story-5.2 review had to retro-fit).
//
// The three guards are FR-20 REQUIREMENTS, not defensive noise:
//   - !rs.live — the round's opening duel is the first kill after FREEZE TIME ENDS. A post-round kill lands in
//     the NEXT round's scratch (see roundStats.live) with live still false, so it cannot steal that round's
//     entry frag. This gate is INSIDE the method on purpose, so removing it reddens a unit test.
//   - killer == 0 (world/bomb) and killer == victim (suicide) — "bomb/suicide deaths are not opening deaths"
//     (prd.md:310). Crucially such a death must not latch AND must not BLOCK: duelDone stays false, so the
//     first REAL kill of the round still wins the duel.
//   - rs.duelDone — one duel per round; a second real kill must never overwrite the first.
//
// victim == 0 is guarded for the same reason a killer of 0 is: an unattributable actor is not a duel side.
func (rs *roundStats) recordOpeningDuel(killer, victim uint64) bool {
	if !rs.live || rs.duelDone {
		return false
	}
	if killer == 0 || victim == 0 || killer == victim {
		return false
	}
	rs.entryFrag, rs.openingDeath, rs.duelDone = killer, victim, true
	return true
}

// clutchTracker is the FR-20 1vX state machine for ONE round: who is alive, on which team, and who BECAME
// the last player alive on their team (and against how many opponents at that instant). It holds NO
// demoinfocs type — plain uint64 ids and plain int team codes — so every branch is table-testable with no
// real demo, exactly as kastQualified and classifyWeirdKill are. That purity is not stylistic: alive-tracking
// derived from the EVENT STREAM is what lets AC2 be proven, whereas Player.IsAlive() routes through the
// unexported demoInfoProvider and degrades on a test-constructed player (the Story-5.2a hazard).
//
// ⭐ A CLUTCH IS A TRANSITION (Cuatro's decision, 2026-07-21). A player must GO from a team of >=2 alive to
// being its only survivor; a player who STARTS as their team's only member never becomes last alive and is
// never a candidate. In the 1v1 wingman format of the first tournament the victim's team goes 1 -> 0, never
// -> 1, so `clutches` is legitimately {} for every player of every match. That falls out of the rule — there
// is deliberately NO branch named "1v1" anywhere here, and the empty result must not be "fixed".
type clutchTracker struct {
	// ⚠ "alive" here means PRESUMED-ALIVE: a player who was on a team at the arming instant and whose death has
	// not been seen in the event stream. It is NOT a checked liveness property — see the accepted 5v5 limitation
	// pinned at the RoundFreezetimeEnd handler. On a 1v1 corpus the two coincide exactly.
	team       map[uint64]int // presumed-alive player -> their team id (snapshotted at arming); deleted on death
	aliveOn    map[int]int    // team id -> presumed-alive count
	candidates map[uint64]int // player who BECAME last alive -> X (presumed-alive opponents AT THAT INSTANT)
}

func newClutchTracker() *clutchTracker {
	return &clutchTracker{
		team:       map[uint64]int{},
		aliveOn:    map[int]int{},
		candidates: map[uint64]int{},
	}
}

// addAlive puts one presumed-alive player on a team at the round's arming instant — "presumed" because the
// caller's roster is a TEAM filter, not a liveness check (see the limitation pinned at the RoundFreezetimeEnd
// handler). A repeat id is idempotent (it does not double-count the team), so a duplicated roster entry cannot
// inflate X.
func (ct *clutchTracker) addAlive(sid uint64, team int) {
	if sid == 0 {
		return
	}
	if _, seen := ct.team[sid]; seen {
		return
	}
	ct.team[sid] = team
	ct.aliveOn[team]++
}

// kill applies one death to the alive counts and records a candidate on the >=2 -> exactly-1 TRANSITION.
//
// An UNKNOWN victim (a late joiner who was not in the freeze-time snapshot) or an ALREADY-DEAD one (a
// duplicate event) returns without touching any counter — that idempotence is what keeps aliveOn from going
// negative and what stops a phantom death from manufacturing a candidate.
//
// ⚠ A CANDIDATE WHO LATER DIES KEEPS THEIR CANDIDACY, deliberately: FR-20 names "bomb explosion" as a
// winning path (prd.md:310-312), so the plant-and-die clutch counts. award() resolves it by whether their
// team won, which is exactly the right question. Do not add a "still alive" test here.
//
// Counts only ever decrease, so a team passes through exactly-1 at most once and cannot be credited twice.
func (ct *clutchTracker) kill(victim uint64) {
	t, known := ct.team[victim]
	if !known {
		return
	}
	delete(ct.team, victim)
	ct.aliveOn[t]--
	if ct.aliveOn[t] != 1 {
		return // still >=2 alive (no transition yet), or wiped out (0) — neither makes anyone last alive
	}
	var surv uint64
	for sid, team := range ct.team {
		if team == t {
			surv = sid
			break // aliveOn[t] == 1, so this is the team's only living member
		}
	}
	if surv == 0 {
		// Counts and roster disagree — record nothing rather than a phantom candidate. This also ABSORBS the
		// aliveOn[t] == 0 (team wiped) case, which is why mutating the test above to `> 1` is an EQUIVALENT
		// mutant that no test can redden (recorded as the single survivor in this story's mutation table): a
		// wiped team has no living member to find, so the search leaves surv at 0 and we return here anyway.
		// Two independent guards enforce "a wiped team produces no candidate"; keep both.
		return
	}
	x := 0
	for team, n := range ct.aliveOn {
		if team != t {
			x += n
		}
	}
	if x == 0 {
		return // every opponent is already dead: the round is over, there is nobody to clutch against
	}
	ct.candidates[surv] = x
}

// award resolves the round's candidates against the WINNING side's membership, returning player -> X for the
// winners only. Membership, never a side identifier: e.RoundEnd.WinnerState.Members() resolves the winners AT
// THAT INSTANT, so this is halftime-proof by construction — the same trap-2-safe move RoundsWon makes. Both
// teams can hold a candidate at once (a 5v5 that decays to 1v1); only the winning one is credited. An empty
// winners set (a draw, where WinnerState is nil — trap 3) credits nobody.
func (ct *clutchTracker) award(winners map[uint64]bool) map[uint64]int {
	out := map[uint64]int{}
	for sid, x := range ct.candidates {
		if winners[sid] {
			out[sid] = x
		}
	}
	return out
}

// foldRounds sums the SURVIVING per-round buffers into each player's PlayerStat totals. A round index ABOVE
// the final TotalRoundsPlayed() is a stranded round from a higher-water-mark rewind (an admin `!restore` from
// round 20 back to 5 that ends at 16 leaves keys 17..20): the game no longer counts it, so neither do we —
// the SAME bound RoundsWon's fold uses. (The pre-match-round discard is already handled by the
// assignment-overwrite at commit time; this bound handles the mid-match restore.) RoundsWon (roundWinners)
// and MVPs (mvpByRound) share the identical key + survivor fold. SteamID64 0 (bots/world) is already excluded
// upstream; `final` is the parser's final TotalRoundsPlayed().
func foldRounds(byRound map[int]*roundStats, roundWinners map[int][]uint64, mvpByRound map[int]uint64, final int) map[uint64]*PlayerStat {
	stats := map[uint64]*PlayerStat{}
	get := func(sid uint64) *PlayerStat {
		if sid == 0 {
			return nil
		}
		s := stats[sid]
		if s == nil {
			s = &PlayerStat{SteamID64: sid}
			stats[sid] = s
		}
		return s
	}
	for idx, rs := range byRound {
		if idx > final {
			continue // a stranded round from a rewind — the game drops it, so do we
		}
		for sid, n := range rs.kills {
			if s := get(sid); s != nil {
				s.Kills += n
			}
		}
		for sid, n := range rs.deaths {
			if s := get(sid); s != nil {
				s.Deaths += n
			}
		}
		for sid, n := range rs.assists {
			if s := get(sid); s != nil {
				s.Assists += n
			}
		}
		for sid, n := range rs.flashAssists {
			if s := get(sid); s != nil {
				s.FlashAssists += n
			}
		}
		for sid, n := range rs.hsKills {
			if s := get(sid); s != nil {
				s.HSKills += n
			}
		}
		for sid, n := range rs.adrDamage {
			if s := get(sid); s != nil {
				s.ADRDamage += n
			}
		}
		for sid, n := range rs.utilityDamage {
			if s := get(sid); s != nil {
				s.UtilityDamage += n
			}
		}
		// The FR-19 weird five (Story 5.2) — same survivor fold, same stranded-round bound.
		for sid, n := range rs.knifeKills {
			if s := get(sid); s != nil {
				s.KnifeKills += n
			}
		}
		for sid, n := range rs.wallbangKills {
			if s := get(sid); s != nil {
				s.WallbangKills += n
			}
		}
		for sid, n := range rs.throughSmokeKills {
			if s := get(sid); s != nil {
				s.ThroughSmokeKills += n
			}
		}
		for sid, n := range rs.noScopeKills {
			if s := get(sid); s != nil {
				s.NoScopeKills += n
			}
		}
		for sid, n := range rs.blindKills {
			if s := get(sid); s != nil {
				s.BlindKills += n
			}
		}
		for sid := range rs.kast {
			if s := get(sid); s != nil {
				s.KASTRounds++
			}
		}
		// The FR-20 derived three (Story 5.3) — same survivor fold, same stranded-round bound. The opening
		// duel is at most ONE pair per round (so Σentry_frags == Σopening_deaths across a demo), and a round
		// that never latched one (no live kill, or only world/suicide deaths) contributes nothing.
		if rs.duelDone {
			if s := get(rs.entryFrag); s != nil {
				s.EntryFrags++
			}
			if s := get(rs.openingDeath); s != nil {
				s.OpeningDeaths++
			}
		}
		for sid, x := range rs.clutchWon {
			if s := get(sid); s != nil {
				if s.Clutches == nil {
					s.Clutches = map[int]int{}
				}
				s.Clutches[x]++
			}
		}
	}
	for idx, winners := range roundWinners {
		if idx > final {
			continue
		}
		for _, sid := range winners {
			if s := get(sid); s != nil {
				s.RoundsWon++
			}
		}
	}
	for idx, mvp := range mvpByRound {
		if idx > final {
			continue
		}
		if s := get(mvp); s != nil {
			s.MVPs++
		}
	}
	return stats
}

// weirdKinds are the FR-19 weird flags one non-warmup kill earns its KILLER (Story 5.2). They are NOT
// mutually exclusive — one kill can be several at once (a blind no-scope wallbang is all three), so each
// counter increments independently and Σ(weird five) may legitimately exceed kills.
type weirdKinds struct{ knife, wallbang, throughSmoke, noScope, blind bool }

// classifyWeirdKill reads the FR-19 weird flags off ONE kill. It is PURE over events.Kill — the deliberate
// split (the DECISION here, the flag->counter BINDING in addWeirdKills, and NOTHING but the call in the
// parser closure) is what makes every branch unit-testable without a real demo, exactly as kastQualified
// is. Every flag is a NATIVE demoinfocs field; none is a heuristic:
//
//   - knife: Weapon.Type == common.EqKnife. Every knife SKIN normalizes to that one type (equipment.go maps
//     ids 41/42/59/80 and 500–556 — weapon_knife_t, bayonet, karambit, kukri, … — plus a name-contains
//     fallback), so this single test covers them all; do NOT hand-roll a skin list. The zeus/taser is
//     EqZeus and correctly does NOT count. Weapon is nil for world/corrupt damage — guarded, since this is
//     the only test that dereferences it.
//   - wallbang: the library's own IsWallBang() (≡ PenetratedObjects > 0) — states intent and cannot drift.
//   - blind: passed IN as killerBlind, NOT read off e.AttackerBlind. See the Story 5.2a note below.
//
// ⚠ blind is a PARAMETER, and that is deliberate (Story 5.2a, 2026-07-21). The obvious source,
// e.AttackerBlind, is DEAD on our demos: measured over the same 14 MatchZy Source-2 demos, 172 FlashExplode
// events and 4 non-warmup kills where the killer was genuinely blind at trigger time (one with 2.13s of
// flash still remaining) ALL reported e.AttackerBlind == false, while wallbang and through-smoke fired
// normally on that same data. Left as-is, blind_kills would read 0 for every player forever — an award with
// no possible winner and nothing to signal it. The live source that DOES work is Killer.IsBlinded(), but it
// cannot be read here: IsBlinded() -> FlashDurationTimeRemaining() dereferences the unexported
// demoInfoProvider, so a test-constructed common.Player panics and the classifier would stop being
// unit-testable — the exact property the 5.2 review was fought over. So the caller evaluates it and passes
// a plain bool, keeping every branch here pure and table-testable.
func classifyWeirdKill(e events.Kill, killerBlind bool) weirdKinds {
	return weirdKinds{
		knife:        e.Weapon != nil && e.Weapon.Type == common.EqKnife,
		wallbang:     e.IsWallBang(),
		throughSmoke: e.ThroughSmoke,
		noScope:      e.NoScope,
		blind:        killerBlind,
	}
}

// addWeirdKills credits one kill's FR-19 flags into this round's scratch, one counter per flag. It is split
// out of the events.Kill closure ON PURPOSE (Story 5.2 code review): FakeParser cannot drive a real parser
// event handler, so ANY logic left inside that closure is unreachable by every Go test — and the failure
// this seam hides is not a missing increment but a TRANSPOSED one. A swap (w.noScope crediting blindKills)
// keeps every counter <= kills, leaves Σkills/Σdeaths/ΣroundsWon untouched, and therefore satisfies every
// live-QA invariant THE BAR asserts: two columns silently trade places forever with a green suite AND a
// green BAR. Binding flag->counter here is what makes a transposition reddenable, by
// TestAddWeirdKillsBindsEachFlagToItsOwnCounter.
//
// No outer "is anything set?" guard: the five conditionals are the complete statement of intent, and a
// struct-equality shortcut would restate "what counts as weird" a second time and start silently skipping
// real kills the moment weirdKinds gains a field whose zero value is meaningful.
func (rs *roundStats) addWeirdKills(sid uint64, w weirdKinds) {
	if w.knife {
		rs.knifeKills[sid]++
	}
	if w.wallbang {
		rs.wallbangKills[sid]++
	}
	if w.throughSmoke {
		rs.throughSmokeKills[sid]++
	}
	if w.noScope {
		rs.noScopeKills[sid]++
	}
	if w.blind {
		rs.blindKills[sid]++
	}
}

// ParseResult is a parsed demo's per-player payload plus the match-level rounds played (the same value
// stamped on every row this match). Players is deterministically ordered (by SteamID64) so tests + logs
// are stable across runs.
type ParseResult struct {
	RoundsPlayed int
	Players      []PlayerStat
}

// Parser parses a Source-2 .dem stream into normalized per-player rows. It is an interface so `go test`
// injects a FakeParser (no real .dem needed) — the Go analogue of the DemoStore/DemoRecorder seams. The
// real DemoinfocsParser's happy-path correctness on a genuine demo is a live-QA gate (Task 7).
type Parser interface {
	Parse(r io.Reader) (ParseResult, error)
}

// DemoinfocsParser is the production Parser backed by markus-wa/demoinfocs-golang/v5. It is stateless —
// a fresh demoinfocs parser is created per Parse call over the given stream.
type DemoinfocsParser struct{}

var _ Parser = DemoinfocsParser{}

// Parse reads a whole Source-2 .dem stream and derives, per SteamID64: the Story-3.3 kills/deaths, the
// Story-4.6a RoundsWon tally, the Story-5.1 FR-18 core seven (assists, ADR damage, HS kills, MVPs, flash
// assists, utility damage, KAST rounds) and the Story-5.2 FR-19 weird five (knife/wallbang/through-smoke/
// no-scope/blind kills, all off native events.Kill flags) and the Story-5.3 FR-20 derived three (entry frags,
// opening deaths, 1vX clutches — DERIVED from the round's shape, not read off one field) + the rounds played.
// It adapts the proven PoC (research/poc-cs2-demo-
// parse/main.go), registers Kill/PlayerHurt/RoundMVPAnnouncement/RoundStart/RoundFreezetimeEnd/RoundEnd
// handlers (all skipping warmup and bots/world id 0), runs ParseToEnd, and folds the surviving per-round
// buffers. It stores raw counts/totals, never ratios (AD-20: ADR/HS%/KAST% and FR-20's entry success rate are
// divided once in the 5.5 view). demoinfocs is CPU/RAM-heavy and
// consumes the entire stream, so callers pass the retained R2 object read back in full (AD-1), never a tee of
// the live upload.
func (DemoinfocsParser) Parse(r io.Reader) (result ParseResult, err error) {
	// demoinfocs is a third-party bit-reader; a crafted or corrupt stream can panic (e.g. an
	// index-out-of-range deep in the reader) instead of returning an error. Recover so a bad demo fails
	// CLOSED with a wrapped error rather than crashing the worker process — the SAME Parser is wired to
	// the MatchZy HTTP receiver in Story 3.8, where the .dem bytes are externally produced.
	defer func() {
		if rec := recover(); rec != nil {
			result = ParseResult{}
			err = fmt.Errorf("parse demo: recovered from parser panic: %v", rec)
		}
	}()

	p := dem.NewParser(r)
	defer p.Close()

	// idOf extracts an event player's SteamID64, returning 0 for a nil pointer (disconnected/world actor) or a
	// bot (SteamID64 == 0). Every caller skips 0 so only real accounts get a row (AD-4).
	idOf := func(pl *common.Player) uint64 {
		if pl == nil {
			return 0
		}
		return pl.SteamID64
	}

	// Per-round buffers, all keyed on the GAME'S OWN round index (TotalRoundsPlayed()) so a MatchZy restart's
	// rewind makes a replayed round OVERWRITE the discarded pre-match round (trap-4; see roundStats). The
	// additive+KAST stats accumulate into `cur` (the round IN PROGRESS) and are ASSIGNED into byRound at
	// RoundEnd; RoundsWon and MVPs are one-value-per-round and are assigned directly at their event time.
	byRound := map[int]*roundStats{}
	roundWinners := map[int][]uint64{}
	mvpByRound := map[int]uint64{}
	cur := newRoundStats()
	// roundStarted is the "a real round has begun since the last commit" signal that keeps the additive/KAST
	// scratch idempotent to a DUPLICATE RoundEnd at a stable index (see the RoundEnd guard). RoundsWon needs no
	// such flag — it recomputes its winners from e.WinnerState every call — but the scratch commit is a
	// destructive move, so it needs to know a round actually happened.
	roundStarted := false

	// ⭐ POST-ROUND KILLS COUNT — DELIBERATE, do not "fix" it (Story 5.2 code review, Cuatro's call
	// 2026-07-21). This handler filters warmup and nothing else: a kill landed between RoundEnd and the next
	// RoundStart is not warmup, and `cur` was already reset, so it accumulates into the FOLLOWING round's
	// scratch. That is scoreboard-correct for kills/deaths (CS2 counts post-round kills, which is why the
	// conservation gate can never see it), and for the FR-19 weird five it is what we WANT: the post-round
	// knife-around is precisely the comedy the weird awards exist to capture. Keeping the weird five on the
	// identical event path as kills/deaths is also what makes them auditable against it. The known cost: if
	// that following round is later stranded by a rewind (idx > final), those kills are dropped with it.
	p.RegisterEventHandler(func(e events.Kill) {
		if p.GameState().IsWarmupPeriod() {
			return // warmup kills are not scored (PoC discipline)
		}
		if k := idOf(e.Killer); k != 0 {
			cur.kills[k]++
			cur.gotKill[k] = true
			if e.IsHeadshot {
				cur.hsKills[k]++
			}
			// The FR-19 weird five (Story 5.2), all credited to the KILLER. Both halves are unit-tested and
			// live OUTSIDE this closure — classifyWeirdKill decides, addWeirdKills binds each flag to its own
			// counter — leaving nothing here a test cannot reach. It goes through `cur` like every other
			// additive stat, so the trap-4 pre-match round is discarded by the RoundEnd overwrite.
			//
			// e.Killer.IsBlinded() is the ONE expression that must live here (Story 5.2a): it needs the live
			// parser flash state, which no fake can supply — see classifyWeirdKill's note on why
			// e.AttackerBlind is dead and why this is a parameter rather than a read inside the classifier.
			// k != 0 already implies e.Killer != nil; the guard is kept because it costs nothing and this is
			// the one line no unit test can redden.
			cur.addWeirdKills(k, classifyWeirdKill(e, e.Killer != nil && e.Killer.IsBlinded()))
		}
		if v := idOf(e.Victim); v != 0 {
			cur.deaths[v]++
			cur.deathEvents = append(cur.deathEvents, roundDeath{victim: v, killer: idOf(e.Killer), at: p.CurrentTime()})
		}
		// A single Assister carries BOTH damage and flash assists; AssistedFlash flags the flash case. So
		// Assists = every kill with a non-nil assister (the CS2 scoreboard "A", which includes flash assists),
		// and FlashAssists = that subset where AssistedFlash is true (always <= Assists).
		if a := idOf(e.Assister); a != 0 {
			cur.assists[a]++
			cur.gotAssist[a] = true
			if e.AssistedFlash {
				cur.flashAssists[a]++
			}
		}
		// The FR-20 derived three (Story 5.3): both DECISIONS are pure (recordOpeningDuel / clutchTracker),
		// only these two CALLS live in the closure — the seam that keeps AC1/AC2 mutation-testable.
		//
		// ⚠ THE TWO GATES DIFFER ON PURPOSE — do not collapse them into one condition. The opening duel
		// EXCLUDES world/bomb deaths and suicides (FR-20: they are not opening deaths); the clutch alive count
		// must include EVERY death, because a teammate dying to the bomb still reduces the team to one.
		cur.recordOpeningDuel(idOf(e.Killer), idOf(e.Victim))
		if cur.live && cur.clutch != nil {
			if v := idOf(e.Victim); v != 0 {
				cur.clutch.kill(v)
			}
		}
	})

	// THE FR-20 LIVE WINDOW (Story 5.3). RoundFreezetimeEnd is the "buy time is over, the round is playable"
	// signal, dispatched from the Source-1 legacy event round_freeze_end that the default parser's game-event
	// mimicry re-emits (demoinfocs v5.2.0: game_events.go:363, datatables.go:1101-1115). Per round the order is
	// RoundStart -> RoundFreezetimeEnd -> ... -> RoundEnd, so `cur` (reset at the previous RoundEnd) is the
	// correct scratch to arm.
	//
	// It ARMS the round: it opens the live window (so the opening duel can latch) and snapshots the roster into
	// a fresh clutch tracker. `live` returns to false for free when RoundEnd installs a new scratch — which is
	// precisely why a post-round kill can neither claim an entry frag nor move an alive count, while still
	// counting for kills/deaths + the FR-19 weird five as Cuatro decided it should.
	//
	// ⚠ ARMING IS A FULL RESET OF THE FR-20 STATE, both halves together (code review, 2026-07-21). This handler
	// is NOT guaranteed to fire once per committed round: THE BAR measured 221 freeze-time ends against 204
	// counted rounds on the 14 real demos, because a MatchZy restart re-arms a round that never reached a
	// RoundEnd. A re-arm that dropped every recorded death (fresh tracker) while KEEPING an already-latched duel
	// would commit the aborted attempt's entry frag as the replayed round's opening duel — crediting two players
	// who took no part in it, with every invariant still green (Σentry == Σopening, Σentry <= rounds). Measured
	// as unreachable on today's corpus (0 re-arms carried a stale latch across all 14 demos) and therefore NOT a
	// live defect — but the two halves must be reset together or the asymmetry becomes one the day a demo
	// restarts mid-round. Reset the duel latch here; do not "simplify" it back out.
	//
	// ⚠ pl.Team is a PLAIN STRUCT FIELD (common.Player.Team) — no entity dereference, no panic risk. IsAlive()
	// and GetTeam() are deliberately NOT used anywhere in this story: both route through PlayerPawnEntity(),
	// the live-state class of call Story 5.2a had to route around. Alive-tracking is derived from the event
	// stream instead, which is what keeps the clutch machine pure and table-testable.
	//
	// ⚠ ACCEPTED LIMITATION, 5v5 ONLY (Cuatro's decision at the 5.3 code review, 2026-07-21). Participants()
	// .Playing() filters on TEAM, not on aliveness, and events.Kill is the only thing that ever decrements the
	// alive counts (there is deliberately no PlayerDisconnected handler). So a player who is on a team here but
	// never dies — a mid-round disconnect, or someone already dead when freeze time ends — stays counted: their
	// team may never reach exactly-1 (a genuine clutch silently dropped) or the opposing X may be inflated by
	// one. UNREACHABLE on the 1v1 corpus (T:1 CT:1 on all 221 rounds, Σclutches 0 — measured, not assumed), and
	// the fix was declined ON PURPOSE: keeping clutchTracker free of every demoinfocs type is what makes AC2
	// table-testable at all. Filed to deferred-work for the first 5v5/substitution demo, where the cheap and
	// still-pure fix is a PlayerDisconnected handler calling ct.kill(sid).
	p.RegisterEventHandler(func(e events.RoundFreezetimeEnd) {
		if p.GameState().IsWarmupPeriod() {
			return // warmup is not scored — the same discipline as every other handler here
		}
		cur.armLiveWindow()
		for _, pl := range p.GameState().Participants().Playing() {
			if pl == nil || pl.SteamID64 == 0 {
				continue
			}
			cur.clutch.addAlive(pl.SteamID64, int(pl.Team))
		}
	})

	p.RegisterEventHandler(func(e events.PlayerHurt) {
		if p.GameState().IsWarmupPeriod() {
			return
		}
		a := idOf(e.Attacker)
		if a == 0 {
			return // world damage (fall/bomb) or a disconnected/corrupt attacker — nobody to credit
		}
		// AC2 ADR CONVENTION (the documented build-time constant): use HealthDamageTaken — the OVERKILL-CAPPED
		// damage (capped at the victim's remaining HP) — NEVER the raw/uncapped HealthDamage. The cap is what
		// makes the total match the in-game scoreboard. Mirrors the verified PoC exactly (no self/team-damage
		// exclusion: competitive friendly fire is off and the PoC's unfiltered sum reproduced the scoreboard
		// golden values; THE BAR re-verifies live). ADRDamage is the raw total; 5.5 divides by RoundsPlayed.
		cur.adrDamage[a] += e.HealthDamageTaken
		// UtilityDamage is the HE + molotov/incendiary subset of that same capped damage (so it is always
		// <= ADRDamage). e.Weapon may be nil for world damage — guard it. THE BAR confirms fire ticks actually
		// carry EqMolotov/EqIncendiary on PlayerHurt (they can attribute differently) and widens the set if so.
		if e.Weapon != nil {
			switch e.Weapon.Type {
			case common.EqHE, common.EqMolotov, common.EqIncendiary:
				cur.utilityDamage[a] += e.HealthDamageTaken
			}
		}
	})

	p.RegisterEventHandler(func(e events.RoundMVPAnnouncement) {
		if p.GameState().IsWarmupPeriod() {
			return
		}
		// RoundMVPAnnouncement fires AFTER RoundEnd (when `cur` is already committed + reset), so it cannot
		// ride the scratch — key it directly like RoundsWon: one MVP per round, ASSIGNED (last write wins), so
		// a restart's replay overwrites the discarded pre-match round's MVP. Folded over surviving indices.
		if m := idOf(e.Player); m != 0 {
			mvpByRound[p.GameState().TotalRoundsPlayed()] = m
		}
	})

	// A RoundStart marks that a real round has begun since the last commit — the signal the additive/KAST
	// scratch needs to stay idempotent to a duplicate RoundEnd (see the RoundEnd guard). NOT gated on warmup:
	// a warmup RoundEnd never commits (it returns early), so a stray warmup-set flag is harmless, while the
	// pre-match round — which is NOT warmup — must set it so its RoundEnd commits and the trap-4 replay works.
	p.RegisterEventHandler(func(e events.RoundStart) {
		roundStarted = true
	})

	// THE FR-16 DEMO-DERIVED SCORE (Story 4.6a) + the KAST close-out (Story 5.1) + the per-round commit.
	// The match score is the DEMO's final round tally — never a hand-typed number (SM-1), and never derived
	// from kills: Σkills < Σdeaths whenever a death is unattributed (fall/world/bomb), so kills != rounds won
	// in general (the Story-3.4 review's finding).
	//
	// ⚠ FOUR TRAPS. The first three were flagged in the story and verified against demoinfocs-golang/v5
	// v5.2.0's own source; the FOURTH was found by running this parser over all 14 real demos in demos/, where
	// the first three-trap-clean implementation over-counted the WINNER by exactly one on 14 of 14. Get any of
	// them wrong and the score is silently, plausibly off — every one of these produces a believable score.
	//
	//  1. TeamState.Score() is NOT yet updated when RoundEnd fires (events.go:78 says so verbatim: "Attention:
	//     TeamState.Score() won't be up to date yet after this"). So we never read Score() — we tally our own.
	//  2. Teams SWAP SIDES at halftime, so any side-relative key (Player.Team, TeamTerrorists()) silently
	//     mis-attributes half the match. Members() resolves the winning side's players AT THIS INSTANT
	//     (participants.TeamMembers: "all players belonging to the requested team at this time") and we credit
	//     them by SteamID64 — so this is side-agnostic and halftime-proof BY CONSTRUCTION: it never asks which
	//     side anyone is on, only who just won the round.
	//  3. WinnerState is nil on a DRAW (Winner == TeamSpectators) — the library's own doc comment. A drawn
	//     round credits nobody, so ΣRoundsWon can legitimately be < RoundsPlayed on a drawn round.
	//  4. ⭐ A MATCHZY PRE-MATCH ROUND IS PLAYED, WON, AND THEN DISCARDED — AND IT IS NOT WARMUP. Every real
	//     demo opens with a round that ends normally (IsWarmupPeriod() == FALSE, so the warmup skip below does
	//     NOT catch it), after which MatchZy restarts the game: m_bHasMatchStarted goes true->false->true and
	//     the game RESETS its own score to 0 (observed verbatim: `RoundEnd(totalRounds=1)`,
	//     `MatchStartedChanged true->false`, `ScoreUpdated 1->0`, `MatchStartedChanged false->true`, then the
	//     real round 1). A bare `RoundsWon++` counter cannot see that reset and credits the discarded round
	//     forever — which is exactly the +1 measured on 14 of 14 demos. The SAME trap over-counts EVERY new
	//     additive stat, which is why kills/deaths/assists/... commit through `cur` and the keyed overwrite
	//     below (see roundStats), not a bare per-event counter.
	//
	//     THE FIX, and why it is keyed this way: tally into maps keyed on the GAME'S OWN round counter
	//     (TotalRoundsPlayed()). A restart rewinds that counter, so the replayed round OVERWRITES the discarded
	//     one (assignment) instead of adding to it — the correction is driven by the same authority that
	//     produces RoundsPlayed, so ΣRoundsWon == RoundsPlayed holds by construction rather than by luck.
	p.RegisterEventHandler(func(e events.RoundEnd) {
		if p.GameState().IsWarmupPeriod() {
			return // warmup rounds are not scored — the same discipline as the Kill handler above
		}
		if !roundStarted {
			// A DUPLICATE RoundEnd at a stable index — no RoundStart has fired since the last commit. The
			// commit below is a destructive MOVE of the scratch (unlike RoundsWon, which recomputes its
			// winners every call and is idempotent by construction). Without this guard the second RoundEnd
			// would ASSIGN the freshly-reset EMPTY cur over the committed round — wiping its kills/deaths/…,
			// and its KAST close-out (empty deathEvents ⇒ everyone "survived") would falsely credit every
			// Playing() player a KAST round. Skipping when no round has begun restores the idempotency the
			// old keyed-counter comment claimed. ⚠ Trap-4's LEGITIMATE replay is NOT skipped: a real
			// RoundStart fired for it, so roundStarted is true and the replay correctly OVERWRITES the
			// discarded pre-match round at the rewound index.
			return
		}
		roundStarted = false
		idx := p.GameState().TotalRoundsPlayed()
		// (1) RoundsWon: credit the winning side's members BY STEAMID64 (trap 2). WinnerState is nil on a draw
		// (trap 3) → nobody won. Assignment for this round index IS the trap-4 correction (last write wins).
		if e.WinnerState != nil {
			winners := make([]uint64, 0, 5)
			winnerSet := make(map[uint64]bool, 5)
			for _, pl := range e.WinnerState.Members() {
				if pl != nil && pl.SteamID64 != 0 {
					winners = append(winners, pl.SteamID64)
					winnerSet[pl.SteamID64] = true
				}
			}
			roundWinners[idx] = winners
			// (1b) The FR-20 1vX clutch (Story 5.3): a candidate is credited only if THEIR TEAM WON, resolved
			// by membership in the SAME winners set built above — never by a side identifier (trap 2), and
			// never by a second Members() walk. A draw leaves WinnerState nil, so this whole block is skipped
			// and nobody clutches (trap 3, unchanged). The tracker is nil for a round whose RoundFreezetimeEnd
			// never fired (a truncated demo), which credits nobody rather than panicking.
			if cur.clutch != nil {
				cur.clutchWon = cur.clutch.award(winnerSet)
			}
		}
		// (2) KAST close-out: over the completed round's scratch, credit every PARTICIPATING player (on T/CT
		// now, via Playing() — benched/spectators excluded) who got a K/A, Survived, or was Traded.
		for _, pl := range p.GameState().Participants().Playing() {
			if pl == nil || pl.SteamID64 == 0 {
				continue
			}
			if cur.kastQualified(pl.SteamID64, kastTradeWindow) {
				cur.kast[pl.SteamID64] = true
			}
		}
		// (3) Commit the completed round's additive+KAST scratch under the game's own index (ASSIGN → a
		// restart's replay overwrites the discarded pre-match round), then reset for the next round.
		byRound[idx] = cur
		cur = newRoundStats()
	})

	if err := p.ParseToEnd(); err != nil {
		return ParseResult{}, fmt.Errorf("parse demo: %w", err)
	}

	// Fold the surviving per-round buffers into each player's totals (bounded by the final count so a
	// higher-water-mark rewind's stranded rounds are dropped — see foldRounds).
	final := p.GameState().TotalRoundsPlayed()
	stats := foldRounds(byRound, roundWinners, mvpByRound, final)

	// Assemble in a deterministic order (by SteamID64) so the produced rows — and the logs/tests that
	// assert over them — are stable regardless of Go's map iteration order.
	players := make([]PlayerStat, 0, len(stats))
	for _, s := range stats {
		players = append(players, *s)
	}
	sort.Slice(players, func(i, j int) bool { return players[i].SteamID64 < players[j].SteamID64 })

	return ParseResult{RoundsPlayed: final, Players: players}, nil
}

// FakeParser is a Parser for `go test`: it returns a canned Result (or Err) so the read→parse→upsert
// wiring is unit-tested without a real .dem. Mirrors the FakeStore/FakeRecorder in-package seams.
type FakeParser struct {
	Result ParseResult
	Err    error
}

var _ Parser = FakeParser{}

// Parse DRAINS r to EOF (as the real DemoinfocsParser does via ParseToEnd) and then returns the configured
// Err (fail-closed seam) or the canned Result. Draining matters for the Story-3.6 re-parse: RunReparse tees
// the retained object through a sha256 hasher WHILE parsing, so the parser must consume every byte for the
// re-hash-verify to see the whole object (a non-draining fake would leave the hash over an empty stream).
func (f FakeParser) Parse(r io.Reader) (ParseResult, error) {
	_, _ = io.Copy(io.Discard, r) // drain so a tee'd hasher observes the full stream (the caller Closes r)
	if f.Err != nil {
		return ParseResult{}, f.Err
	}
	return f.Result, nil
}
