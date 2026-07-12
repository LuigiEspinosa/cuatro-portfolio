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

// PlayerStat is one parsed player's minimum-viable payload (Story 3.3). The parser fills ONLY kills and
// deaths — the rich FR-18/19/20/21 derivation (assists, ADR, HS%, MVPs, weird/derived/idle) is Epic 5,
// which widens this struct + the writer, never the schema (the stat_row columns already exist, nullable).
type PlayerStat struct {
	SteamID64 uint64
	Kills     int
	Deaths    int
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

// Parse reads a whole Source-2 .dem stream and tallies per-SteamID64 kills/deaths + the rounds played,
// adapting the proven PoC pattern (research/poc-cs2-demo-parse/main.go) down to the 3.3 subset. It
// registers a single events.Kill handler (skipping warmup, and skipping bots/world via the get() helper),
// runs ParseToEnd, and reads TotalRoundsPlayed from the final game state. It computes NOTHING beyond
// kills/deaths/rounds — assists/ADR/headshots/weird/derived/idle are Epic 5. demoinfocs is CPU/RAM-heavy
// and consumes the entire stream, so callers pass the retained R2 object read back in full (AD-1), never
// a tee of the live upload.
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
	// get returns the stat row for a player keyed by SteamID64, creating it on first sight. It skips
	// nil and SteamID64 == 0 (bots / the world entity) so only real accounts get a row (AD-4).
	get := func(pl *common.Player) *PlayerStat {
		if pl == nil || pl.SteamID64 == 0 {
			return nil
		}
		s := stats[pl.SteamID64]
		if s == nil {
			s = &PlayerStat{SteamID64: pl.SteamID64}
			stats[pl.SteamID64] = s
		}
		return s
	}

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

	if err := p.ParseToEnd(); err != nil {
		return ParseResult{}, fmt.Errorf("parse demo: %w", err)
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
// wiring is unit-tested without a real .dem. It does not read r (the caller Closes it). Mirrors the
// FakeStore/FakeRecorder in-package seams.
type FakeParser struct {
	Result ParseResult
	Err    error
}

var _ Parser = FakeParser{}

// Parse returns the configured Err (fail-closed seam) or the canned Result.
func (f FakeParser) Parse(io.Reader) (ParseResult, error) {
	if f.Err != nil {
		return ParseResult{}, f.Err
	}
	return f.Result, nil
}
