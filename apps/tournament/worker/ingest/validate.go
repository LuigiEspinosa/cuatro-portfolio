package ingest

import (
	"fmt"
	"sort"
	"strings"

	"cs-tournament/worker/db"
)

// Validate computes the three AC1 validation gates (Story 3.4) over the just-parsed rows + the active
// roster set and returns the AD-2 anomaly outcome the worker persists. It is PURE — no I/O: the caller
// reads the roster (RosterReader) and persists the result (RecordParse). This is the Validating node of the
// ingest state machine: on any gate failure the match is HELD (validation_state='anomalous', reasons logged,
// never silent) rather than proceeding toward publish; the stat rows are still written either way (the
// anomaly is a hold flag on demo, not a write-block).
//
// Reason order is deterministic (conservation, empty_stats, unreconciled) and offending ids are sorted, so
// the logged/persisted reasons — and the tests that assert over them — are stable across runs.
//
// The gates run over `rows` (the mapped, post-skip-guard stat rows actually written), not result.Players:
// a non-17-digit id dropped by the cli.go D1 skip-guard is deliberately absent here. When that dropped id
// had MORE kills than deaths, the leftover Σkills > Σdeaths over-count surfaces as a conservation anomaly — a
// PARTIAL safety net only, and NARROWER since the Story-5.4 relax below: a dropped id whose absence makes the
// match UNDER-count (Σkills < Σdeaths, the common case for a real player) is no longer caught here, and a
// dropped id with equal kills==deaths leaves Σkills==Σdeaths intact and never was. `result` carries the
// match-level rounds for provenance/future gates; the three current gates need only the rows + roster.
func Validate(result ParseResult, rows []db.StatRow, roster map[string]struct{}) db.ValidationOutcome {
	_ = result // rounds/other match-level fields are available for future gates (Epic 5); the AC1 gates use rows+roster.

	var reasons []db.AnomalyReason

	// Gate 1 — conservation, RELAXED to flag ONLY the impossible over-count direction Σkills > Σdeaths
	// (Story 5.4, closing the Epic-3 retro action item pinned at sprint-status.yaml:197-200; approved after
	// real demos balanced 16==16 at live-QA). Every kill is exactly one death, so Σkills > Σdeaths is
	// IMPOSSIBLE in a completed match — it can only mean a double-counted kill, so hold it. The reverse,
	// Σkills < Σdeaths, is the NORMAL under-count: an unattributed fall/world/bomb death credits a death with
	// no kill (the same reason RoundsWon is never derived from kills — validate at the RoundEnd tally, not the
	// K/D sum). That under-count was over-flagging clean matches, so it is no longer held. (No FR-21 gate is
	// added: an all-zero idle_round_count is the EXPECTED result, not an anomaly — THE BAR proves it, not this.)
	var k, d int
	for _, r := range rows {
		k += r.Kills
		d += r.Deaths
	}
	if k > d {
		reasons = append(reasons, db.AnomalyReason{
			Gate:   "conservation",
			Detail: fmt.Sprintf("Σkills=%d > Σdeaths=%d delta=%d (impossible over-count: a double-counted kill, or a non-17-digit id dropped by the skip-guard whose kills exceeded its deaths — see the D1 note above)", k, d, k-d),
		})
	}

	// Gate 2 — non-zero rows: a successful parse that yields ZERO player rows (an empty/broken/warmup-only
	// demo) is anomalous (Resolved Decision 4: the literal reading of the spine's 0-stat gate).
	if len(rows) == 0 {
		reasons = append(reasons, db.AnomalyReason{Gate: "empty_stats", Detail: "parse produced no stat rows"})
	}

	// Gate 3 — roster reconciliation: every parsed SteamID64 must be on the ACTIVE roster (AD-4/FR-2). A
	// parsed id absent from the roster is captured here (and its row still surfaces in unreconciled_stat_row).
	var missing []string
	for _, r := range rows {
		if _, ok := roster[r.SteamID64]; !ok {
			missing = append(missing, r.SteamID64)
		}
	}
	if len(missing) > 0 {
		sort.Strings(missing) // stable, sorted offending ids for deterministic logs/tests
		reasons = append(reasons, db.AnomalyReason{Gate: "unreconciled", Detail: strings.Join(missing, ",")})
	}

	return db.ValidationOutcome{Anomalous: len(reasons) > 0, Reasons: reasons}
}
