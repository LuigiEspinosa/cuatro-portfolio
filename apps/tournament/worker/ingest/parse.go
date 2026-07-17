package ingest

import (
	"fmt"
	"io"
	"sort"

	dem "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/events"
)

// ParserVersion is the pinned demoinfocs build stamped on demo.parser_version when a parse produces stat
// rows (AD-26: the pinned parser is the durability lever against Valve format churn — retained raw demos
// re-parse on upgrade). Keep it in LOCKSTEP with the demoinfocs-golang/v5 require line in worker/go.mod.
const ParserVersion = "demoinfocs-golang/v5 v5.2.0"

// PlayerStat is one parsed player's minimum-viable payload (Story 3.3) plus the Story-4.6a demo-derived
// round tally. The parser fills ONLY kills, deaths and RoundsWon — the rich FR-18/19/20/21 derivation
// (assists, ADR, HS%, MVPs, weird/derived/idle) is Epic 5, which widens this struct + the writer, never the
// schema (the stat_row columns already exist, nullable).
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

// Parse reads a whole Source-2 .dem stream and tallies per-SteamID64 kills/deaths/rounds-won + the rounds
// played, adapting the proven PoC pattern (research/poc-cs2-demo-parse/main.go) down to the 3.3 subset. It
// registers an events.Kill handler and an events.RoundEnd handler (both skipping warmup, and skipping
// bots/world via the get() helper), runs ParseToEnd, and reads TotalRoundsPlayed from the final game state.
// It computes NOTHING beyond kills/deaths/rounds-won/rounds — assists/ADR/headshots/weird/derived/idle are
// Epic 5. demoinfocs is CPU/RAM-heavy and consumes the entire stream, so callers pass the retained R2 object
// read back in full (AD-1), never a tee of the live upload.
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

	stats := map[uint64]*PlayerStat{}
	// getByID returns the stat row for a SteamID64, creating it on first sight. It skips id 0 (bots / the
	// world entity) so only real accounts get a row (AD-4).
	getByID := func(sid uint64) *PlayerStat {
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
	// get is the same lookup for an event's player pointer, skipping nil (a disconnected/world actor).
	get := func(pl *common.Player) *PlayerStat {
		if pl == nil {
			return nil
		}
		return getByID(pl.SteamID64)
	}

	// roundWinners maps the GAME'S OWN round index to the SteamID64s credited with winning that round. See
	// the events.RoundEnd handler below for why this is a map keyed on the round rather than a bare counter.
	roundWinners := map[int][]uint64{}

	p.RegisterEventHandler(func(e events.Kill) {
		if p.GameState().IsWarmupPeriod() {
			return // warmup kills are not scored (PoC discipline)
		}
		if k := get(e.Killer); k != nil {
			k.Kills++
		}
		if v := get(e.Victim); v != nil {
			v.Deaths++
		}
	})

	// THE FR-16 DEMO-DERIVED SCORE (Story 4.6a): credit every member of the winning team with the round.
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
	//     forever — which is exactly the +1 measured on 14 of 14 demos.
	//
	//     THE FIX, and why it is keyed this way: tally into a map keyed on the GAME'S OWN round counter
	//     (TotalRoundsPlayed(), already incremented when RoundEnd fires). A restart rewinds that counter to 0,
	//     so the replayed round OVERWRITES the discarded one instead of adding to it — the correction is
	//     driven by the same authority that produces RoundsPlayed, which is what makes ΣRoundsWon ==
	//     RoundsPlayed hold by construction rather than by luck. It also makes a duplicate RoundEnd for one
	//     round idempotent. Verified: 14/14 demos now tally EXACTLY the game's own final scoreboard.
	p.RegisterEventHandler(func(e events.RoundEnd) {
		if p.GameState().IsWarmupPeriod() {
			return // warmup rounds are not scored — the same discipline as the Kill handler above
		}
		if e.WinnerState == nil {
			return // a draw: nobody won this round (trap 3)
		}
		winners := make([]uint64, 0, 5)
		for _, pl := range e.WinnerState.Members() {
			// Resolve membership NOW (trap 2) and keep only real accounts — a bot/world id 0 is never
			// credited, and a player who won rounds without a single kill still gets a row (via getByID).
			if pl != nil && pl.SteamID64 != 0 {
				winners = append(winners, pl.SteamID64)
			}
		}
		// Last write wins for a given round index — that IS the trap-4 correction.
		roundWinners[p.GameState().TotalRoundsPlayed()] = winners
	})

	if err := p.ParseToEnd(); err != nil {
		return ParseResult{}, fmt.Errorf("parse demo: %w", err)
	}

	// Fold the surviving per-round winners into each player's tally (Story 4.6a).
	//
	// ⚠ The round index is BOUNDED by the final count, and that bound is what makes the trap-4 correction
	// total. Overwriting only fixes a discarded round the replayed match RE-REACHES — true for MatchZy's
	// pre-match round (index 1, always below a real match's length), false for any rewind from a HIGHER
	// water mark: a mid-match `!restore` (reach round 20, restore to 5, end at 16) leaves keys 17..20
	// stranded, and an unbounded fold would credit them — inflating the winner by up to 4 while
	// RoundsPlayed is 16. Dropping keys the game no longer counts is what makes ΣRoundsWon ==
	// RoundsPlayed hold BY CONSTRUCTION rather than by the accident of where a restart happened to land.
	totalRounds := p.GameState().TotalRoundsPlayed()
	for idx, winners := range roundWinners {
		if idx > totalRounds {
			continue // a stranded round from a rewind: the game does not count it, so neither do we
		}
		for _, sid := range winners {
			if w := getByID(sid); w != nil {
				w.RoundsWon++
			}
		}
	}

	// Assemble in a deterministic order (by SteamID64) so the produced rows — and the logs/tests that
	// assert over them — are stable regardless of Go's map iteration order.
	players := make([]PlayerStat, 0, len(stats))
	for _, s := range stats {
		players = append(players, *s)
	}
	sort.Slice(players, func(i, j int) bool { return players[i].SteamID64 < players[j].SteamID64 })

	return ParseResult{RoundsPlayed: p.GameState().TotalRoundsPlayed(), Players: players}, nil
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
