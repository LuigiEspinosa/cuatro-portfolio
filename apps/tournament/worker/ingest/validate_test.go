package ingest

import (
	"testing"

	"cs-tournament/worker/db"
)

// rosterSet builds an active-roster lookup set from a list of 17-digit ids.
func rosterSet(ids ...string) map[string]struct{} {
	m := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		m[id] = struct{}{}
	}
	return m
}

// row is a terse StatRow builder for the gate tests (only the fields the gates read).
func row(sid string, kills, deaths int) db.StatRow {
	return db.StatRow{SteamID64: sid, Kills: kills, Deaths: deaths}
}

const (
	sidA = "76561197960287930"
	sidB = "76561198000000042"
	sidC = "76561197960287999"
)

// TestValidateAllClean: balanced K/D, ≥1 row, every id rostered → not anomalous, no reasons.
func TestValidateAllClean(t *testing.T) {
	rows := []db.StatRow{row(sidA, 20, 14), row(sidB, 14, 20)} // Σkills 34 == Σdeaths 34
	out := Validate(ParseResult{RoundsPlayed: 24}, rows, rosterSet(sidA, sidB))
	if out.Anomalous {
		t.Fatalf("a clean parse must not be anomalous, got %+v", out)
	}
	if len(out.Reasons) != 0 {
		t.Fatalf("a clean parse must carry no reasons, got %+v", out.Reasons)
	}
}

// TestValidateConservationFlagsOnlyOvercount is the AC7 money test (Story 5.4): the conservation gate was
// RELAXED from `Σkills != Σdeaths` to `Σkills > Σdeaths`, so it now flags ONLY the impossible over-count
// direction (a double-counted kill) and NO LONGER the normal Σkills < Σdeaths under-count (an unattributed
// fall/world/bomb death). Over → held; under → clean (the relaxation); equal → clean.
func TestValidateConservationFlagsOnlyOvercount(t *testing.T) {
	// Σkills > Σdeaths — impossible in a completed match → held with the direction named in the detail.
	over := []db.StatRow{row(sidA, 20, 14), row(sidB, 16, 18)} // Σkills 36 > Σdeaths 32, delta +4
	out := Validate(ParseResult{}, over, rosterSet(sidA, sidB))
	if !out.Anomalous || len(out.Reasons) != 1 || out.Reasons[0].Gate != "conservation" {
		t.Fatalf("an over-count (Σkills > Σdeaths) must be a single conservation anomaly, got %+v", out)
	}
	if want := "Σkills=36 > Σdeaths=32 delta=4 (impossible over-count: a double-counted kill, or a non-17-digit id dropped by the skip-guard whose kills exceeded its deaths — see the D1 note above)"; out.Reasons[0].Detail != want {
		t.Fatalf("conservation detail = %q, want %q", out.Reasons[0].Detail, want)
	}

	// Σkills < Σdeaths — the normal unattributed-death under-count → NO conservation reason (THE RELAX). This
	// is the case that used to over-flag clean matches; changing the gate back to `!= d` or `< d` reddens here.
	under := []db.StatRow{row(sidA, 14, 20), row(sidB, 11, 14)} // Σkills 25 < Σdeaths 34
	if out := Validate(ParseResult{}, under, rosterSet(sidA, sidB)); out.Anomalous {
		t.Fatalf("an under-count (unattributed deaths) must NOT be anomalous after the relax, got %+v", out)
	}

	// Σkills == Σdeaths — the decided-match norm → clean.
	bal := []db.StatRow{row(sidA, 17, 17), row(sidB, 17, 17)}
	if out := Validate(ParseResult{}, bal, rosterSet(sidA, sidB)); out.Anomalous {
		t.Fatalf("a balanced match must not be anomalous, got %+v", out)
	}
}

// TestValidateEmptyStats: zero rows → exactly one empty_stats reason (Resolved Decision 4). Conservation
// (0==0) and unreconciled (no ids) do NOT fire — empty_stats is the sole reason.
func TestValidateEmptyStats(t *testing.T) {
	out := Validate(ParseResult{}, nil, rosterSet(sidA))
	if !out.Anomalous || len(out.Reasons) != 1 {
		t.Fatalf("an empty parse must be anomalous with one reason, got %+v", out)
	}
	if out.Reasons[0].Gate != "empty_stats" {
		t.Fatalf("expected an empty_stats reason, got %+v", out.Reasons[0])
	}
}

// TestValidateUnreconciled: one rostered + one unrostered id (balanced K/D) → exactly one unreconciled
// reason listing ONLY the missing id (the rostered one is not reported).
func TestValidateUnreconciled(t *testing.T) {
	rows := []db.StatRow{row(sidA, 10, 8), row(sidB, 8, 10)} // Σ balanced (18==18)
	out := Validate(ParseResult{}, rows, rosterSet(sidA))    // sidB is NOT rostered
	if !out.Anomalous || len(out.Reasons) != 1 {
		t.Fatalf("an unrostered id must be anomalous with one reason, got %+v", out)
	}
	if out.Reasons[0].Gate != "unreconciled" {
		t.Fatalf("expected an unreconciled reason, got %+v", out.Reasons[0])
	}
	if out.Reasons[0].Detail != sidB {
		t.Fatalf("unreconciled detail must list EXACTLY the missing id %q, got %q", sidB, out.Reasons[0].Detail)
	}
}

// TestValidateMultipleFailuresDeterministic: an OVER-count K/D AND two unrostered ids (given out of order)
// → both reasons present in the fixed order (conservation, unreconciled) with the offending ids SORTED and
// comma-joined. (empty_stats cannot co-occur — it requires zero rows, which zeroes the other two gates.) Uses
// an over-count (Σkills > Σdeaths) since the Story-5.4 relax no longer flags the under-count.
func TestValidateMultipleFailuresDeterministic(t *testing.T) {
	// sidC before sidA in the rows to prove the detail is sorted, not input-ordered.
	rows := []db.StatRow{row(sidC, 5, 3), row(sidA, 4, 2)} // Σkills 9 > Σdeaths 5, delta +4
	out := Validate(ParseResult{}, rows, rosterSet())      // neither id rostered
	if !out.Anomalous || len(out.Reasons) != 2 {
		t.Fatalf("two simultaneous failures must yield two reasons, got %+v", out)
	}
	if out.Reasons[0].Gate != "conservation" || out.Reasons[1].Gate != "unreconciled" {
		t.Fatalf("reason order must be deterministic (conservation, unreconciled), got %q,%q", out.Reasons[0].Gate, out.Reasons[1].Gate)
	}
	// sidA ("…930") sorts before sidC ("…999") — sorted ascending, comma-joined.
	if want := sidA + "," + sidC; out.Reasons[1].Detail != want {
		t.Fatalf("unreconciled ids must be sorted + comma-joined: got %q, want %q", out.Reasons[1].Detail, want)
	}
}
