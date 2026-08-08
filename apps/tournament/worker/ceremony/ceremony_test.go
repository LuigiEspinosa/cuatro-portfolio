package ceremony

import (
	"encoding/json"
	"math/big"
	"reflect"
	"testing"

	"cs-tournament/worker/awards"
)

// ceremony_test.go — Story 6.8a, the CALLER's own suite.
//
// ⭐⭐ THIS FILE EXISTS BECAUSE THE BAR FOUND A DEFECT NOTHING ELSE COULD SEE. `BuildPayload` had no
// test at all: `worker/awards` proves the RUN and migration 0027's pgTAP proves the WRITER, but the
// TRANSLATION between them was covered by neither. The first end-to-end run over the real corpus was
// refused with `seed_mismatch` because the payload's `seed_hex` was the empty string — a defect
// invisible to a suite that never persists and to a suite that hand-writes its own JSON.
//
// ⚠ NO DATABASE. Every test here is over `BuildPayload`, which is a pure function; `LoadInputs` and
// `Persist` need a live stack and are covered by THE BAR.

const (
	seed = "1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c"
	pA   = "76561198000000001"
	pB   = "76561198000000002"
	pC   = "76561198000000003"
)

// sampleRun is a hand-built CeremonyRun carrying one of every shape the writer must handle: a lone
// winner with a VOLUME deciding value, a RATE winner that exits the FR-29 ladder at a real rung, a
// SHARED outcome with two winners, a zero-winner `no_eligible_players`, and two consolation players.
func sampleRun() awards.CeremonyRun {
	return awards.CeremonyRun{
		SeedHex: seed,
		Plan: []awards.SpinPlanEntry{
			{Spin: 1, Pool: []string{"7", "8", "9", "10"}, LiveCount: 2},
			{Spin: 2, Pool: []string{"9", "10"}, LiveCount: 2},
		},
		Spins: []awards.CeremonySpin{
			{
				Spin: 1, Label: "inclusivcup/v1/stage1/spin/1", Consumed: 3,
				Stage1: awards.Stage1Result{Live: []string{"8", "7"}},
				Result: awards.SpinResult{
					Results: []awards.AwardAssignment{
						{AwardID: "7", Outcome: awards.Outcome{
							Kind: awards.KindWinner, SteamID64: pA,
							DecidingValue:  awards.DecidingValue{Class: awards.ClassVolume, Value: big.NewInt(42)},
							LadderExitStep: awards.LadderExitNone,
						}},
						{AwardID: "8", Outcome: awards.Outcome{
							Kind: awards.KindWinner, SteamID64: pB,
							DecidingValue: awards.DecidingValue{
								Class: awards.ClassRate, Num: big.NewInt(1234), Den: big.NewInt(17),
							},
							LadderExitStep: awards.LadderExitH2H,
						}},
					},
					Assigned: []string{pA, pB},
				},
			},
			{
				Spin: 2, Label: "inclusivcup/v1/stage1/spin/2", Consumed: 2,
				Stage1: awards.Stage1Result{Live: []string{"9", "10"}},
				Result: awards.SpinResult{
					Results: []awards.AwardAssignment{
						{AwardID: "9", Outcome: awards.Outcome{
							Kind: awards.KindShared, Winners: []string{pA, pC},
							LadderExitStep: awards.LadderExitShared,
						}},
						{AwardID: "10", Outcome: awards.Outcome{Kind: awards.KindNoEligiblePlayers}},
					},
					Assigned: []string{pA, pC},
				},
			},
		},
		Shelf:     map[string]int{pA: 2, pB: 1, pC: 1},
		PityLabel: awards.PityLabel,
		Pity: awards.PityResult{
			Winless:       []string{pB, pC},
			RevealOrder:   []string{pC, pB},
			BytesConsumed: 1,
		},
	}
}

// ⭐ THE DEFECT THE BAR FOUND, PINNED. `persist_ceremony` refuses `seed_mismatch` unless this equals
// `ceremony.seed_demo_sha256`, so an empty value here rejects every otherwise-perfect run.
func TestBuildPayloadCarriesTheSeed(t *testing.T) {
	got := BuildPayload(sampleRun())
	if got.SeedHex != seed {
		t.Errorf("payload seed_hex = %q, want %q", got.SeedHex, seed)
	}
}

// AC4 — pity persists as N SPINS, one winner each, continuing the main sequence in RevealOrder.
func TestBuildPayloadRendersPityAsOneSpinPerWinner(t *testing.T) {
	run := sampleRun()
	got := BuildPayload(run)

	if len(got.Spins) != len(run.Spins)+len(run.Pity.RevealOrder) {
		t.Fatalf("payload has %d spins, want %d main + %d pity",
			len(got.Spins), len(run.Spins), len(run.Pity.RevealOrder))
	}

	// spin_index must be DENSE and 1-BASED across the whole run — `persist_ceremony` refuses
	// `spin_index_not_dense` otherwise, and it asserts it as a SET so {1,1,3} is caught too.
	for i, s := range got.Spins {
		if s.SpinIndex != i+1 {
			t.Errorf("payload spin at index %d reports spin_index %d", i, s.SpinIndex)
		}
	}

	pity := got.Spins[len(run.Spins):]
	for i, s := range pity {
		if s.Kind != "pity" {
			t.Errorf("pity spin %d has kind %q", s.SpinIndex, s.Kind)
		}
		if s.Label != awards.PityLabel {
			t.Errorf("pity spin %d label = %q, want %q", s.SpinIndex, s.Label, awards.PityLabel)
		}
		if len(s.Results) != 1 {
			t.Fatalf("pity spin %d carries %d results, want exactly 1", s.SpinIndex, len(s.Results))
		}
		r := s.Results[0]
		// ⛔ NIL, NOT "" — 0026's whole thesis is that a consolation prize names NO award, and the RPC
		// derives `is_pity` from the spin kind rather than trusting the payload.
		if r.AwardID != nil {
			t.Errorf("pity result on spin %d names award %q", s.SpinIndex, *r.AwardID)
		}
		if len(r.Winners) != 1 {
			t.Errorf("pity result on spin %d has %d winners, want exactly 1", s.SpinIndex, len(r.Winners))
		}
		// ⭐ REVEAL ORDER, NOT byte-lex `Winless`. They differ in this fixture on purpose: Winless is
		// [pB, pC] and RevealOrder is [pC, pB], so a mutant reading the wrong field is visible.
		if r.Winners[0] != run.Pity.RevealOrder[i] {
			t.Errorf("pity spin %d crowned %s; RevealOrder says %s",
				s.SpinIndex, r.Winners[0], run.Pity.RevealOrder[i])
		}
	}
	if reflect.DeepEqual(run.Pity.Winless, run.Pity.RevealOrder) {
		t.Fatal("the fixture's Winless and RevealOrder are equal — the assertion above cannot " +
			"distinguish the two fields")
	}
}

// ⛔ THE ENGINE'S 0 SENTINEL IS SENT RAW. The `nullif(v, 0)` mapping belongs at ONE seam — the RPC —
// and doing it here as well would make two places responsible for one rule (`0025:162-174`).
func TestBuildPayloadSendsTheLadderExitStepRaw(t *testing.T) {
	got := BuildPayload(sampleRun())

	spin1 := got.Spins[0]
	if spin1.Results[0].TieLadderExitStep != awards.LadderExitNone {
		t.Errorf("a no-ladder outcome sent exit step %d, want the raw 0 sentinel",
			spin1.Results[0].TieLadderExitStep)
	}
	if spin1.Results[1].TieLadderExitStep != awards.LadderExitH2H {
		t.Errorf("a rung-3 outcome sent exit step %d, want %d",
			spin1.Results[1].TieLadderExitStep, awards.LadderExitH2H)
	}
}

// DECISION 3 — a volume award fills `deciding_value`; a rate award fills the integer PAIR and never
// divides. Both are sent as decimal STRINGS so an unbounded magnitude cannot round through a float.
func TestBuildPayloadSplitsVolumeFromTheRatePair(t *testing.T) {
	got := BuildPayload(sampleRun())
	vol := got.Spins[0].Results[0]
	rate := got.Spins[0].Results[1]

	if vol.DecidingValue == nil || *vol.DecidingValue != "42" {
		t.Errorf("volume deciding_value = %v, want \"42\"", vol.DecidingValue)
	}
	if vol.DecidingNum != nil || vol.DecidingDen != nil {
		t.Error("a volume award filled the rate pair — award_result_deciding_pair_complete aside, " +
			"the two halves describe different classes")
	}
	if rate.DecidingValue != nil {
		t.Errorf("a rate award filled deciding_value with %v — it must never be divided", *rate.DecidingValue)
	}
	if rate.DecidingNum == nil || rate.DecidingDen == nil ||
		*rate.DecidingNum != "1234" || *rate.DecidingDen != "17" {
		t.Errorf("rate pair = %v/%v, want 1234/17", rate.DecidingNum, rate.DecidingDen)
	}
}

// Winner sets by outcome kind, and the cardinality `persist_ceremony`'s `winner_cardinality` guard
// (and IC909 behind it) requires: winner = 1, shared >= 2, the zero-winner kinds = 0.
func TestBuildPayloadWinnerCardinalityMatchesTheOutcomeKind(t *testing.T) {
	got := BuildPayload(sampleRun())
	for _, s := range got.Spins {
		for _, r := range s.Results {
			// ⚠ NEVER nil — the payload must carry `[]`, not `null`; three spellings of absence is a
			// hazard this epic has already paid for twice.
			if r.Winners == nil {
				t.Fatalf("spin %d result %v has a nil winners slice", s.SpinIndex, r.AwardID)
			}
			n := len(r.Winners)
			switch r.OutcomeKind {
			case string(awards.KindWinner):
				if n != 1 {
					t.Errorf("spin %d: 'winner' with %d winners", s.SpinIndex, n)
				}
			case string(awards.KindShared):
				if n < 2 {
					t.Errorf("spin %d: 'shared' with %d winners", s.SpinIndex, n)
				}
			case string(awards.KindNoEligiblePlayers), string(awards.KindNoAwardableValue):
				if n != 0 {
					t.Errorf("spin %d: %q with %d winners", s.SpinIndex, r.OutcomeKind, n)
				}
			default:
				t.Errorf("spin %d carries outcome_kind %q, which the writer refuses", s.SpinIndex, r.OutcomeKind)
			}
		}
	}
}

// The rendered JSON must carry every key the RPC reads, spelled exactly — a renamed field would make
// `persist_ceremony` see NULL and refuse for a reason that names the wrong thing.
func TestBuildPayloadJSONKeysAreTheOnesTheRPCReads(t *testing.T) {
	raw, err := json.Marshal(BuildPayload(sampleRun()))
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var generic map[string]any
	if err := json.Unmarshal(raw, &generic); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	for _, k := range []string{"seed_hex", "spin_plan", "spins"} {
		if _, ok := generic[k]; !ok {
			t.Errorf("payload is missing top-level key %q", k)
		}
	}
	spins := generic["spins"].([]any)
	first := spins[0].(map[string]any)
	for _, k := range []string{"spin_index", "kind", "live_award_ids", "results"} {
		if _, ok := first[k]; !ok {
			t.Errorf("a spin is missing key %q", k)
		}
	}
	res := first["results"].([]any)[0].(map[string]any)
	for _, k := range []string{"award_id", "outcome_kind", "deciding_value", "deciding_num",
		"deciding_den", "tie_ladder_exit_step", "winners"} {
		if _, ok := res[k]; !ok {
			t.Errorf("a result is missing key %q", k)
		}
	}
	plan := generic["spin_plan"].([]any)[0].(map[string]any)
	for _, k := range []string{"spin", "pool", "live_count"} {
		if _, ok := plan[k]; !ok {
			t.Errorf("a plan entry is missing key %q", k)
		}
	}
}

// PersistReasons must be exactly the set migration 0027 can RETURN — the closed-set discipline
// `stage1.go:118-131` established, applied to the caller. ⛔ `write_failed` is NOT a member: it is
// what an UNRECOGNISED reason becomes, so including it would make the fail-closed branch unreachable.
func TestPersistReasonsIsTheDeclaredSetAndExcludesWriteFailed(t *testing.T) {
	want := []string{
		"no_ceremony", "ceremony_not_locked", "already_persisted", "snapshot_missing",
		"seed_missing", "seed_mismatch", "no_spins", "no_spin_plan", "spin_index_missing",
		"spin_index_not_dense", "invalid_spin_kind", "unknown_award", "unknown_player",
		"invalid_outcome_kind", "outcome_kind_tie", "winner_cardinality", "pity_award_shape",
		"invalid_ladder_exit_step",
	}
	if len(PersistReasons) != len(want) {
		t.Errorf("PersistReasons holds %d reasons, want %d", len(PersistReasons), len(want))
	}
	for _, r := range want {
		if _, ok := PersistReasons[r]; !ok {
			t.Errorf("PersistReasons is missing %q", r)
		}
	}
	if _, bad := PersistReasons[ReasonWriteFailed]; bad {
		t.Error("write_failed is IN PersistReasons — it is the value an unrecognised reason becomes, " +
			"so treating it as declared makes the fail-closed branch unreachable")
	}
}
