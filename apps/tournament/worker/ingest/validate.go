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
// had UNEQUAL kills/deaths, the leftover K/D imbalance surfaces as a conservation anomaly — a PARTIAL safety
// net only (a dropped id with equal kills==deaths leaves Σkills==Σdeaths intact and is not caught here).
// `result` carries the match-level rounds for provenance/future gates; the three current gates need only the
// rows + roster.
func Validate(result ParseResult, rows []db.StatRow, roster map[string]struct{}) db.ValidationOutcome {
	_ = result // rounds/other match-level fields are available for future gates (Epic 5); the AC1 gates use rows+roster.

	var reasons []db.AnomalyReason

	// Gate 1 — conservation: Σkills == Σdeaths across the match (every kill is exactly one death in a
	// completed CS2 match). A mismatch means the parse missed or double-counted an event, or an id was
	// dropped by the skip-guard — hold it.
	var k, d int
	for _, r := range rows {
		k += r.Kills
		d += r.Deaths
	}
	if k != d {
		reasons = append(reasons, db.AnomalyReason{
			Gate:   "conservation",
			Detail: fmt.Sprintf("Σkills=%d Σdeaths=%d delta=%d", k, d, k-d),
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
