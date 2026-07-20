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
// demo-derived RoundsWon tally, and — as of Story 5.1 — the FR-18 CORE SEVEN (assists, ADR damage, headshot
// kills, MVPs, flash assists, utility damage, KAST rounds). The parser stores raw NUMERATORS/COUNTS, never
// ratios: ADR/HS%/KAST% are divided ONCE in the Epic-5 leaderboard view (AD-20 one-owner), so ADRDamage is
// the TOTAL overkill-capped damage (view: ADRDamage/RoundsPlayed), HSKills a count (view: HSKills/Kills),
// KASTRounds a count (view: KASTRounds/RoundsPlayed). The still-later weird/derived/idle stats (FR-19/20/21)
// are Stories 5.2–5.4 and stay at their nullable column defaults. This widens the struct + the writer, never
// the schema (every stat_row column already exists, nullable, since migration 0007).
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
	gotKill       map[uint64]bool // players who got >=1 kill this round (KAST "K")
	gotAssist     map[uint64]bool // players who got >=1 assist this round (KAST "A")
	deathEvents   []roundDeath    // every death this round in order (KAST "S"/"T")
	kast          map[uint64]bool // participating players credited a KAST round (computed at RoundEnd)
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
		gotKill:       map[uint64]bool{},
		gotAssist:     map[uint64]bool{},
		kast:          map[uint64]bool{},
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
		for sid := range rs.kast {
			if s := get(sid); s != nil {
				s.KASTRounds++
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
// Story-4.6a RoundsWon tally, and the Story-5.1 FR-18 core seven (assists, ADR damage, HS kills, MVPs, flash
// assists, utility damage, KAST rounds) + the rounds played. It adapts the proven PoC (research/poc-cs2-demo-
// parse/main.go), registers Kill/PlayerHurt/RoundMVPAnnouncement/RoundEnd handlers (all skipping warmup and
// bots/world id 0), runs ParseToEnd, and folds the surviving per-round buffers. It stores raw counts/totals,
// never ratios (AD-20: ADR/HS%/KAST% are divided once in the 5.5 view). demoinfocs is CPU/RAM-heavy and
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
			for _, pl := range e.WinnerState.Members() {
				if pl != nil && pl.SteamID64 != 0 {
					winners = append(winners, pl.SteamID64)
				}
			}
			roundWinners[idx] = winners
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
