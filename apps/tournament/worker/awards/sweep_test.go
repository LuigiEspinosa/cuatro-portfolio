package awards

import (
	"errors"
	"math/big"
	"sort"
	"strings"
	"testing"
)

// ── the shared contract ────────────────────────────────────────────────────────
//
// These tests read `roulette/vectors/antisweep-resolve.json` AT RUNTIME. Values are NEVER
// transcribed into Go literals: a hard-coded copy greens on the day the vector is regenerated and
// silently stops testing the contract.
//
// The player and award loaders are the LADDER's (`toLadderPlayers`, `toLadderAward`), reused rather
// than restated — this pass drives the ladder over reduced sets, so it needs the same four AD-19
// blocks, and a second near-identical loader is how two readers of one file drift apart.

type sweepCandidate struct {
	AwardID  string      `json:"award_id"`
	Priority int         `json:"priority"`
	Award    ladderAward `json:"award"`
}

// sweepResultRow is one assignment row as the vector encodes it: the outcome FLATTENED onto the row
// alongside what anti-sweep did to the candidate set.
//
// ⚠ `LadderExitStep` is a plain `int` with `0` meaning "no ladder ran", matching Go's
// `LadderExitNone`. The vector writes it on EVERY row for exactly that reason — `deferred-work.md:307`
// records that Go carries the field always while TypeScript omits the key, and a file that also
// omitted it would be a third spelling of NULL.
type sweepResultRow struct {
	AwardID        string       `json:"award_id"`
	Priority       int          `json:"priority"`
	Kind           string       `json:"kind"`
	SteamID64      string       `json:"steamid64"`
	Winners        []string     `json:"winners"`
	Tied           []string     `json:"tied"`
	DecidingValue  *stage2Value `json:"deciding_value"`
	LadderExitStep int          `json:"ladder_exit_step"`
	SweptOut       []string     `json:"swept_out"`
	Reresolved     bool         `json:"reresolved"`
}

type sweepExpected struct {
	Results  []sweepResultRow `json:"results"`
	Assigned []string         `json:"assigned"`
}

type sweepCase struct {
	Name     string           `json:"name"`
	Note     string           `json:"note"`
	Live     []sweepCandidate `json:"live"`
	Players  []ladderPlayer   `json:"players"`
	Expected sweepExpected    `json:"expected"`
}

type sweepRefusalRow struct {
	Why    string `json:"why"`
	Detail string `json:"detail"`
	// Defects is every defect this row carries, in the order the published validation order visits
	// them. ⭐ `Detail` MUST equal `Defects[0]`, and a row with two entries is a row that can
	// observe an ORDER rather than a single guard. `ladder-resolve.json` carries that fact only in
	// its `why` prose; here it is data, so a regression is a failed assertion rather than a reader's
	// judgement.
	Defects []string         `json:"defects"`
	Live    []sweepCandidate `json:"live"`
	Players []ladderPlayer   `json:"players"`
}

type sweepVector struct {
	Vector                  string            `json:"vector"`
	AlgoVersion             string            `json:"algo_version"`
	Spec                    string            `json:"spec"`
	OutcomeKinds            []string          `json:"outcome_kinds"`
	UnreachableOutcomeKinds []string          `json:"unreachable_outcome_kinds"`
	ExitSteps               []int             `json:"exit_steps"`
	RefusalDetails          []string          `json:"refusal_details"`
	Refusals                []sweepRefusalRow `json:"refusals"`
	Cases                   []sweepCase       `json:"cases"`
}

func loadSweep(t *testing.T) sweepVector {
	t.Helper()
	v := loadVector[sweepVector](t, "antisweep-resolve.json")
	if v.Vector != "antisweep-resolve" {
		t.Fatalf("loaded the wrong vector file: %q", v.Vector)
	}
	if len(v.Cases) == 0 {
		t.Fatal("antisweep-resolve.json has no cases")
	}
	if len(v.Refusals) == 0 {
		t.Fatal("antisweep-resolve.json has no refusals")
	}
	return v
}

// toSweepLive guards the loader against malformed rows rather than letting a bad row panic the
// whole binary — the defect this package fixed once in the Stage-2 loader and must not re-import.
func toSweepLive(t *testing.T, rows []sweepCandidate) []Stage1Candidate {
	t.Helper()
	out := make([]Stage1Candidate, 0, len(rows))
	for _, r := range rows {
		out = append(out, Stage1Candidate{
			AwardID:  r.AwardID,
			Priority: r.Priority,
			Award:    toLadderAward(r.Award),
		})
	}
	return out
}

// ⭐ THE CASE-NAME SET IS PINNED BY EXACT EQUALITY, mirroring `ladderCaseNames` and
// `stage2CaseNames`, and for the reason those exist: a coverage flag can be satisfied by a row
// unrelated to the property it names, so deleting this file's most valuable rows would leave every
// flag green, `--check` reporting OK and both suites passing. Adding or removing a case reddens
// this deliberately.
var sweepCaseNames = []string{
	"EXHAUSTION-every-eligible-player-for-a-LATER-award-is-ALREADY-assigned",
	"TWO-DIFFERENT-players-are-swept-out-of-TWO-DIFFERENT-awards",
	"a-CASCADE-award-3s-re-resolved-winner-was-ALREADY-swept-into-award-2",
	"a-CLEAN-spin-REMOVES-players-from-later-races-and-CHANGES-NOTHING",
	"a-CO-WINNER-of-an-EARLIER-shared-award-is-the-one-SWEPT-OUT",
	"a-REDUCED-set-drops-a-max-VOLUME-awards-best-value-to-ZERO-re-triggering-DECISION-E",
	"a-SINGLE-OVERFLOW-re-resolves-award-2-to-the-NEXT-ELIGIBLE-player",
	"a-ZERO-KILL-player-WINS-and-the-pass-FILTERS-NOBODY",
	"a-reduced-tie-of-WIDTH-1-is-NEVER-handed-to-the-ladder",
	"an-award-arrives-as-no_eligible_players-BEFORE-any-removal-and-assigns-NOBODY",
	"an-overflow-re-resolves-through-the-LADDER-and-EXITS-AT-A-DIFFERENT-RUNG",
	"an-overflow-re-resolves-to-a-SHARED-outcome-and-assigns-TWO-players-at-once",
	"the-SHIPPED-live-count-1-spin-can-never-sweep-ANYBODY",
	"the-award-with-the-LOWER-PRIORITY-NUMBER-KEEPS-the-trophy",
	"the-live-set-supplied-OUT-OF-PRIORITY-ORDER-resolves-IDENTICALLY",
	"the-ROSTER-supplied-OUT-OF-BYTE-LEX-order-changes-NOTHING",
}

func TestVectorSweepCarriesExactlyTheExpectedCases(t *testing.T) {
	v := loadSweep(t)
	got := make([]string, 0, len(v.Cases))
	for _, c := range v.Cases {
		got = append(got, c.Name)
	}
	sort.Strings(got)
	want := append([]string{}, sweepCaseNames...)
	sort.Strings(want)
	if strings.Join(got, "\n") != strings.Join(want, "\n") {
		t.Errorf("antisweep-resolve.json cases =\n%s\nwant\n%s", strings.Join(got, "\n"), strings.Join(want, "\n"))
	}
}

// ── the conformance run ────────────────────────────────────────────────────────

func TestVectorSweepResolve(t *testing.T) {
	v := loadSweep(t)
	for _, tc := range v.Cases {
		t.Run(tc.Name, func(t *testing.T) {
			live := toSweepLive(t, tc.Live)
			players := toLadderPlayers(t, tc.Players)

			got, err := ResolveSpin(live, players, FR29Ladder{})
			if err != nil {
				t.Fatalf("ResolveSpin: %v", err)
			}

			if len(got.Results) != len(tc.Expected.Results) {
				t.Fatalf("got %d results, want %d", len(got.Results), len(tc.Expected.Results))
			}
			for i, want := range tc.Expected.Results {
				assertAssignment(t, got.Results[i], want)
			}
			if strings.Join(got.Assigned, ",") != strings.Join(tc.Expected.Assigned, ",") {
				t.Errorf("assigned = %v, want %v", got.Assigned, tc.Expected.Assigned)
			}

			// ⭐ THE RESULTS ARE IN ASCENDING PRIORITY, and it is asserted here rather than left to
			// the per-row `award_id` comparison: the rows would still line up if BOTH the vector and
			// the implementation sorted the wrong way, and the whole file's expected blocks come
			// from an anchor that could in principle have made the same mistake. This checks the
			// PROPERTY against the row's own priorities.
			for i := 1; i < len(got.Results); i++ {
				if got.Results[i-1].Priority >= got.Results[i].Priority {
					t.Errorf("results are not in strictly ascending priority: %d then %d",
						got.Results[i-1].Priority, got.Results[i].Priority)
				}
			}
		})
	}
}

// assertAssignment compares one result row field by field.
//
// ⛔ THE CONFORMANCE SWITCH HAS A FINAL ARM THAT FAILS LOUDLY. A `default` that silently accepted an
// unknown kind is the exact hole the 6-4a review found in the TypeScript Stage-2 switch: an
// implementation returning a kind neither side understood would pass every row.
func assertAssignment(t *testing.T, got AwardAssignment, want sweepResultRow) {
	t.Helper()
	if got.AwardID != want.AwardID {
		t.Errorf("award_id = %q, want %q", got.AwardID, want.AwardID)
	}
	if got.Priority != want.Priority {
		t.Errorf("%s: priority = %d, want %d", want.AwardID, got.Priority, want.Priority)
	}
	if string(got.Outcome.Kind) != want.Kind {
		t.Fatalf("%s: kind = %q, want %q", want.AwardID, got.Outcome.Kind, want.Kind)
	}
	if got.Outcome.LadderExitStep != want.LadderExitStep {
		t.Errorf("%s: ladder_exit_step = %d, want %d",
			want.AwardID, got.Outcome.LadderExitStep, want.LadderExitStep)
	}
	if strings.Join(got.SweptOut, ",") != strings.Join(want.SweptOut, ",") {
		t.Errorf("%s: swept_out = %v, want %v", want.AwardID, got.SweptOut, want.SweptOut)
	}
	if got.Reresolved != want.Reresolved {
		t.Errorf("%s: reresolved = %v, want %v", want.AwardID, got.Reresolved, want.Reresolved)
	}
	// ⭐ `swept_out` AND `reresolved` MUST AGREE, on the row's OWN data. They are two spellings of
	// one fact, and an implementation that reported the set correctly while hardcoding the boolean
	// (or vice versa) would pass every row where they happen to coincide.
	if got.Reresolved != (len(got.SweptOut) > 0) {
		t.Errorf("%s: reresolved = %v but swept_out has %d entries — the two must agree",
			want.AwardID, got.Reresolved, len(got.SweptOut))
	}

	switch want.Kind {
	case string(KindWinner):
		if got.Outcome.SteamID64 != want.SteamID64 {
			t.Errorf("%s: steamid64 = %q, want %q", want.AwardID, got.Outcome.SteamID64, want.SteamID64)
		}
		// ⭐ THE `deciding_value` XOR `ladder_exit_step` INVARIANT, carried through this pass. A
		// Stage-2 winner has a value and no rung; a ladder-resolved winner has a rung and no value,
		// because the tie it resolves carries none and L12 forbids re-deriving one. Fabricating a
		// zero would be a plausible-looking lie Story 6.8 renders on stage.
		hasValue := got.Outcome.DecidingValue.Value != nil || got.Outcome.DecidingValue.Num != nil
		if hasValue != (want.DecidingValue != nil) {
			t.Errorf("%s: deciding_value present = %v, vector says %v",
				want.AwardID, hasValue, want.DecidingValue != nil)
		}
		if hasValue == (got.Outcome.LadderExitStep != 0) {
			t.Errorf("%s: deciding_value and ladder_exit_step must be exclusive, got value=%v step=%d",
				want.AwardID, hasValue, got.Outcome.LadderExitStep)
		}
		if want.DecidingValue != nil {
			assertSweepDecidingValue(t, want.AwardID, got.Outcome.DecidingValue, *want.DecidingValue)
		}
	case string(KindShared):
		if strings.Join(got.Outcome.Winners, ",") != strings.Join(want.Winners, ",") {
			t.Errorf("%s: winners = %v, want %v", want.AwardID, got.Outcome.Winners, want.Winners)
		}
	case string(KindNoAwardableValue):
		// DECISION K — the suppressed set's WIDTH travels and is read, never resolved.
		if strings.Join(got.Outcome.Tied, ",") != strings.Join(want.Tied, ",") {
			t.Errorf("%s: tied = %v, want %v", want.AwardID, got.Outcome.Tied, want.Tied)
		}
	case string(KindNoEligiblePlayers):
		if got.Outcome.SteamID64 != "" || len(got.Outcome.Winners) != 0 {
			t.Errorf("%s: no_eligible_players carries a winner: %+v", want.AwardID, got.Outcome)
		}
	default:
		t.Fatalf("%s: the vector carries an outcome kind this suite does not check: %q",
			want.AwardID, want.Kind)
	}
}

func assertSweepDecidingValue(t *testing.T, where string, got DecidingValue, want stage2Value) {
	t.Helper()
	if string(got.Class) != want.Class {
		t.Errorf("%s: deciding_value.class = %q, want %q", where, got.Class, want.Class)
	}
	if want.Class == string(ClassVolume) {
		if got.Value == nil || got.Value.Cmp(mustBig(t, where+".deciding_value", want.Value)) != 0 {
			t.Errorf("%s: deciding_value.value = %v, want %s", where, got.Value, want.Value)
		}
		return
	}
	if got.Num == nil || got.Num.Cmp(mustBig(t, where+".num", want.Num)) != 0 ||
		got.Den == nil || got.Den.Cmp(mustBig(t, where+".den", want.Den)) != 0 {
		t.Errorf("%s: deciding_value = %v/%v, want %s/%s", where, got.Num, got.Den, want.Num, want.Den)
	}
}

// ── refusals ───────────────────────────────────────────────────────────────────

func TestVectorSweepRefusals(t *testing.T) {
	v := loadSweep(t)
	for _, bad := range v.Refusals {
		t.Run(bad.Why, func(t *testing.T) {
			live := toSweepLive(t, bad.Live)
			players := toLadderPlayers(t, bad.Players)

			got, err := ResolveSpin(live, players, FR29Ladder{})
			if err == nil {
				t.Fatalf("resolved an input the vector says must refuse: %+v", got)
			}
			// ⛔ THE TYPED ERROR **AND** THE DECLARED DETAIL, never merely "some error". 6-4a
			// measured the cost of the weaker assertion: a mutation that made validation reject
			// EVERY input left all sixteen refusal rows passing.
			if !errors.Is(err, ErrSweep) {
				t.Errorf("refusal is not an ErrSweep: %v", err)
			}
			var invalid *SweepInvalidError
			if !errors.As(err, &invalid) {
				t.Fatalf("refusal is not a *SweepInvalidError: %v", err)
			}
			if invalid.Detail != bad.Detail {
				t.Errorf("detail = %q, vector declares %q (%v)", invalid.Detail, bad.Detail, err)
			}
			// ⭐ `detail` IS `defects[0]` — the published order's first visited defect.
			if len(bad.Defects) == 0 || bad.Defects[0] != bad.Detail {
				t.Errorf("defects = %v, which does not begin with the declared detail %q",
					bad.Defects, bad.Detail)
			}
			for _, d := range bad.Defects {
				if !containsString(v.RefusalDetails, d) {
					t.Errorf("defects carries %q, which is outside the declared closed set %v",
						d, v.RefusalDetails)
				}
			}
			// ⭐ A PROPAGATED REFUSAL KEEPS ITS ORIGIN REACHABLE. `stage2` must still unwrap to
			// ErrStage2 and `ladder` to ErrLadder, so a caller can tell a malformed award from a
			// ladder that ran and refused without parsing English.
			switch invalid.Detail {
			case SweepDetailStage2:
				if !errors.Is(err, ErrStage2) {
					t.Errorf("a `stage2` refusal does not unwrap to ErrStage2: %v", err)
				}
			case SweepDetailLadder:
				if !errors.Is(err, ErrLadder) {
					t.Errorf("a `ladder` refusal does not unwrap to ErrLadder: %v", err)
				}
			case SweepDetailLive:
				// The live set's own shape — this file's own guard, with no propagated cause.
				if invalid.Cause != nil {
					t.Errorf("a `live` refusal carries a propagated cause: %v", invalid.Cause)
				}
			default:
				t.Fatalf("the vector declares a detail this suite does not check: %q", invalid.Detail)
			}
		})
	}
}

// ⭐⭐ VALIDATION ORDER IS CONTRACT, AND THE DOUBLY-MALFORMED ROWS ARE THE ONLY ROWS THAT CAN SEE IT.
//
// 6-4b's headline defect was three implementations disagreeing about whether `live_count` was
// checked before or after weighting, with NO row malformed in two ways — so the gate was
// structurally blind. Story 6.5 shipped the same class again. This asserts that the rows exist, that
// each carries two DIFFERENT labels, and that the refusal really is the FIRST of them.
func TestVectorSweepPinsValidationOrderWithDoublyMalformedRows(t *testing.T) {
	v := loadSweep(t)
	doubles := 0
	for _, bad := range v.Refusals {
		if len(bad.Defects) < 2 {
			continue
		}
		doubles++
		if bad.Defects[0] == bad.Defects[1] {
			t.Errorf("row %q carries two defects with the SAME label %q — it cannot observe which "+
				"guard ran first", bad.Why, bad.Defects[0])
		}
		if bad.Detail != bad.Defects[0] {
			t.Errorf("row %q refuses %q but its first defect is %q", bad.Why, bad.Detail, bad.Defects[0])
		}
	}
	if doubles < 2 {
		t.Errorf("only %d doubly-malformed refusal row(s) — validation order needs at least one "+
			"row per adjacent boundary it claims to pin", doubles)
	}
}

// ── the closed sets ────────────────────────────────────────────────────────────

func TestVectorSweepDetailsAreExactlyTheDeclaredSet(t *testing.T) {
	v := loadSweep(t)
	want := []string{SweepDetailLive, SweepDetailStage2, SweepDetailLadder, SweepDetailInternal}
	if strings.Join(v.RefusalDetails, ",") != strings.Join(want, ",") {
		t.Errorf("refusal_details = %v, package has %v", v.RefusalDetails, want)
	}

	// ⚠ THE LAST ONE IS DELIBERATELY EXCLUDED FROM THE "must be exercised" REQUIREMENT. A row is a
	// set of INPUTS; "the injected port returned something impossible" is not an input, so no row
	// can produce it. It is covered instead by the stub-port tests below, and the generator enforces
	// the same split from the other side: it refuses to write a row carrying it.
	rowRepresentable := []string{SweepDetailLive, SweepDetailStage2, SweepDetailLadder}
	unrepresentable := []string{SweepDetailInternal}

	seen := map[string]int{}
	for _, r := range v.Refusals {
		if r.Detail == "" {
			t.Errorf("refusal row %q carries no detail", r.Why)
		}
		seen[r.Detail]++
	}
	for _, d := range rowRepresentable {
		if seen[d] == 0 {
			t.Errorf("no refusal row of detail %q — the label is declared and never exercised, "+
				"which is a compartment rather than a contract", d)
		}
	}
	for _, d := range unrepresentable {
		if seen[d] != 0 {
			t.Errorf("a refusal row carries detail %q, which no set of INPUTS can produce — the row "+
				"is not testing what it claims", d)
		}
	}
}

func TestVectorSweepOutcomeKindsMatchThePackage(t *testing.T) {
	v := loadSweep(t)
	want := []string{
		string(KindWinner), string(KindTie), string(KindNoEligiblePlayers),
		string(KindNoAwardableValue), string(KindShared),
	}
	if strings.Join(v.OutcomeKinds, ",") != strings.Join(want, ",") {
		t.Errorf("outcome_kinds = %v, package has %v", v.OutcomeKinds, want)
	}
	// ⭐ THE KIND NO ASSIGNMENT ROW MAY CARRY. `OUTCOME_KINDS` stays one closed set across the
	// engine — narrowing it here would be a second vocabulary — so the fact that a TIE never
	// survives this pass travels as its own field, and is asserted against the rows rather than
	// inferred from their absence. An implementation that skipped the ladder would emit one.
	if strings.Join(v.UnreachableOutcomeKinds, ",") != string(KindTie) {
		t.Errorf("unreachable_outcome_kinds = %v, want [%q]", v.UnreachableOutcomeKinds, KindTie)
	}
	for _, c := range v.Cases {
		for _, r := range c.Results() {
			for _, unreachable := range v.UnreachableOutcomeKinds {
				if r.Kind == unreachable {
					t.Errorf("case %q carries outcome kind %q, which no assignment row may hold",
						c.Name, r.Kind)
				}
			}
			if !containsString(v.OutcomeKinds, r.Kind) {
				t.Errorf("case %q carries outcome kind %q, outside the closed set %v",
					c.Name, r.Kind, v.OutcomeKinds)
			}
		}
	}
}

// ⭐ THREE TOP-LEVEL FIELDS WERE DECODED BY BOTH SUITES AND ASSERTED BY NEITHER, which is the
// "compartment rather than a contract" defect this file closes for `refusal_details` and left open
// three fields over. 6-5b's T6 fixed exactly this class for `ladder-resolve.json`'s `algo_version`
// (a one-sided gate: TypeScript asserted it, Go did not) and the pattern reappeared here on BOTH
// sides. The code review measured all three.
func TestVectorSweepHeaderFieldsAreAsserted(t *testing.T) {
	v := loadSweep(t)

	if v.AlgoVersion != "inclusivcup-roulette-1.0.0" {
		t.Errorf("algo_version = %q — epics.md:1164 fixes it and 6.3's review already corrected it once",
			v.AlgoVersion)
	}

	// NO-LADDER plus the FR-29 rungs, in order. A real cross-module pin: it reddens if the rung set
	// changes, if the generator drifts, or if the "0 means no ladder ran" sentinel is renumbered.
	// ⚠ It deliberately does NOT assert all six are REACHED — rungs 1-3 genuinely do not occur in
	// this vector's cases, and claiming otherwise is the over-strong assertion that gets deleted.
	wantSteps := []int{
		LadderExitNone, LadderExitSecondary, LadderExitEfficiency,
		LadderExitH2H, LadderExitAchieved, LadderExitShared,
	}
	if len(v.ExitSteps) != len(wantSteps) {
		t.Fatalf("exit_steps = %v, package has %v", v.ExitSteps, wantSteps)
	}
	for i, s := range wantSteps {
		if v.ExitSteps[i] != s {
			t.Errorf("exit_steps[%d] = %d, want %d", i, v.ExitSteps[i], s)
		}
	}
	for _, c := range v.Cases {
		for _, r := range c.Results() {
			found := false
			for _, s := range v.ExitSteps {
				if r.LadderExitStep == s {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("case %q / award %q carries exit step %d, outside the declared set %v",
					c.Name, r.AwardID, r.LadderExitStep, v.ExitSteps)
			}
		}
	}

	// `sweep.go` says "the order is CONTRACT, it is published in the vector's `spec` string".
	// Nothing read it, so the published contract was decorative. This does not pin the prose — that
	// would be brittle — it pins the one thing the prose exists to fix: that each row-representable
	// detail is NAMED, and named in the order the code visits them.
	if len(v.Spec) < 200 {
		t.Fatalf("the vector publishes no usable spec string (%d chars)", len(v.Spec))
	}
	live := strings.Index(v.Spec, "`"+SweepDetailLive+"`")
	stage2 := strings.Index(v.Spec, "`"+SweepDetailStage2+"`")
	ladder := strings.Index(v.Spec, "`"+SweepDetailLadder+"`")
	if live < 0 || stage2 < 0 || ladder < 0 {
		t.Fatalf("the spec does not name all three row-representable details (live=%d stage2=%d ladder=%d)",
			live, stage2, ladder)
	}
	if !(live < stage2 && stage2 < ladder) {
		t.Errorf("the spec names the details in the order live=%d stage2=%d ladder=%d — the "+
			"published validation order is live -> stage2 -> ladder", live, stage2, ladder)
	}
}

// Results is a tiny accessor so the loops above read as intent rather than as field access.
func (c sweepCase) Results() []sweepResultRow { return c.Expected.Results }

func containsString(haystack []string, needle string) bool {
	for _, s := range haystack {
		if s == needle {
			return true
		}
	}
	return false
}

// ── coverage: every flag names its ROW and re-derives that row's property ───────
//
// ⭐⭐ THE PROJECT'S OWN RECURRING DEFECT, NOW AT ITS FIFTH OCCURRENCE (6-4a's `sawFloatDivergence`,
// 6-4b's three output-only guards, 6.5's `pins_inputs` covering none of the rows its mutation pass
// added, 6-5b's two consumer suites). A coverage flag that merely counts "some row did X" is
// satisfiable by a degenerate row. Every check below names the SPECIFIC case it claims, re-derives
// that case's property FROM THE ROW'S OWN DATA, and asserts the claim is UNIQUE — so a second row
// drifting into the same shape is a failure rather than a silent weakening.
func TestVectorSweepCoverageIsRealAndUnique(t *testing.T) {
	v := loadSweep(t)
	byName := map[string]sweepCase{}
	for _, c := range v.Cases {
		byName[c.Name] = c
	}
	get := func(name string) sweepCase {
		t.Helper()
		c, ok := byName[name]
		if !ok {
			t.Fatalf("the case %q named by a coverage guard is gone", name)
		}
		return c
	}
	rowOf := func(c sweepCase, awardID string) sweepResultRow {
		t.Helper()
		for _, r := range c.Expected.Results {
			if r.AwardID == awardID {
				return r
			}
		}
		t.Fatalf("case %q has no award %q", c.Name, awardID)
		return sweepResultRow{}
	}

	// ── the shipped width: one live award, so no removal is POSSIBLE ──────────────────────────
	shipped := get("the-SHIPPED-live-count-1-spin-can-never-sweep-ANYBODY")
	if len(shipped.Live) != 1 {
		t.Errorf("%q no longer has exactly one live award, so it no longer models the shipped "+
			"live_count = 1 pacing", shipped.Name)
	}
	if len(shipped.Expected.Results) != 1 || shipped.Expected.Results[0].Reresolved {
		t.Errorf("%q must produce exactly one result and it must not be re-resolved", shipped.Name)
	}
	single := 0
	for _, c := range v.Cases {
		if len(c.Live) == 1 {
			single++
		}
	}
	if single != 1 {
		t.Errorf("%d cases carry a single live award; exactly one may, or the shipped-width row "+
			"stops being the row that models it", single)
	}

	// ── the clean spin: removal HAPPENS and changes NOTHING ───────────────────────────────────
	//
	// Re-derived rather than asserted: every award's winner is re-computed over the FULL roster
	// through the real ResolveStage2 + the real ladder, and must equal the winner the reduced
	// resolution produced. Without this the row is an ordinary three-award spin.
	clean := get("a-CLEAN-spin-REMOVES-players-from-later-races-and-CHANGES-NOTHING")
	cleanPlayers := toLadderPlayers(t, clean.Players)
	sweptSomewhere := false
	for _, r := range clean.Expected.Results {
		if len(r.SweptOut) > 0 {
			sweptSomewhere = true
		}
		if r.Kind != string(KindWinner) {
			t.Fatalf("%q: award %s is %q, but the clean-spin row needs a lone winner per award",
				clean.Name, r.AwardID, r.Kind)
		}
		unreduced := resolveOverFullRoster(t, clean, r.AwardID, cleanPlayers)
		if unreduced.SteamID64 != r.SteamID64 {
			t.Errorf("%q: award %s would have gone to %s over the FULL roster but the row says %s "+
				"— the removal changed the outcome, so this is not the cap-is-inert row",
				clean.Name, r.AwardID, unreduced.SteamID64, r.SteamID64)
		}
	}
	if !sweptSomewhere {
		t.Errorf("%q sweeps nobody at all, so 'the removal changed nothing' is vacuous", clean.Name)
	}

	// ── the out-of-order row: same spin, different supplied order, IDENTICAL expected block ───
	//
	// ⭐ THAT IDENTITY IS THE ASSERTION, the shape `ladder-resolve.json`'s three spellings of an
	// absent rung key established — and the guard-the-guard half is that the two rows genuinely
	// differ in the order they SUPPLY the candidates. Two identical rows would satisfy the identity
	// and prove nothing.
	shuffled := get("the-live-set-supplied-OUT-OF-PRIORITY-ORDER-resolves-IDENTICALLY")
	if !sameExpected(clean.Expected, shuffled.Expected) {
		t.Errorf("%q and %q no longer produce the same result — the supplied order must not change "+
			"one byte of the outcome", clean.Name, shuffled.Name)
	}
	if sameLiveOrder(clean.Live, shuffled.Live) {
		t.Errorf("%q supplies its candidates in the same order as %q, so the identity above is a "+
			"row compared with itself", shuffled.Name, clean.Name)
	}
	if !sameLiveSet(clean.Live, shuffled.Live) {
		t.Errorf("%q is no longer the same spin as %q, so the identity proves nothing about sorting",
			shuffled.Name, clean.Name)
	}
	// The supplied order must be neither ascending nor descending, or it cannot separate "no sort
	// at all" from "sorted the wrong way".
	if isSortedByPriority(shuffled.Live, true) || isSortedByPriority(shuffled.Live, false) {
		t.Errorf("%q supplies its candidates in a sorted order, so it discriminates nothing",
			shuffled.Name)
	}

	// ── the direction of the sort ─────────────────────────────────────────────────────────────
	//
	// The property that makes it discriminate: BOTH awards' unreduced winner is the SAME player, so
	// ascending and descending processing hand the two trophies to opposite players.
	dir := get("the-award-with-the-LOWER-PRIORITY-NUMBER-KEEPS-the-trophy")
	dirPlayers := toLadderPlayers(t, dir.Players)
	if len(dir.Expected.Results) != 2 {
		t.Fatalf("%q must carry exactly two awards", dir.Name)
	}
	first := resolveOverFullRoster(t, dir, dir.Expected.Results[0].AwardID, dirPlayers)
	second := resolveOverFullRoster(t, dir, dir.Expected.Results[1].AwardID, dirPlayers)
	if first.SteamID64 == "" || first.SteamID64 != second.SteamID64 {
		t.Errorf("%q: the two awards' UNREDUCED winners are %q and %q — they must be the SAME "+
			"player, or the two sort directions produce the same answer", dir.Name,
			first.SteamID64, second.SteamID64)
	}
	if !isSortedByPriority(dir.Live, false) {
		t.Errorf("%q must supply its candidates largest-priority-first, or 'the supplied order' and "+
			"'descending' are not both killed", dir.Name)
	}

	// ── the cascade ───────────────────────────────────────────────────────────────────────────
	cascade := get("a-CASCADE-award-3s-re-resolved-winner-was-ALREADY-swept-into-award-2")
	cascadePlayers := toLadderPlayers(t, cascade.Players)
	third := rowOf(cascade, "aw-03")
	second2 := rowOf(cascade, "aw-02")
	// (ii) award 3's winner over the roster minus the FIRST sweeper is exactly award 2's
	//      re-resolved winner — which is what makes this a cascade rather than two independent
	//      overflows.
	minusFirst := excludePlayers(cascadePlayers, rowOf(cascade, "aw-01").SteamID64)
	relayed := resolveAwardOver(t, cascade, "aw-03", minusFirst)
	if relayed.SteamID64 != second2.SteamID64 {
		t.Errorf("%q: award 3 over the roster minus award 1's winner goes to %q, but award 2's "+
			"re-resolved winner is %q — the chain is broken and the row is not a cascade",
			cascade.Name, relayed.SteamID64, second2.SteamID64)
	}
	if third.SteamID64 == second2.SteamID64 || len(third.SweptOut) != 2 {
		t.Errorf("%q: award 3 must land on a third player after TWO removals, got %q with "+
			"swept_out %v", cascade.Name, third.SteamID64, third.SweptOut)
	}

	// ── the ladder overflow exits at a DIFFERENT rung ─────────────────────────────────────────
	rung := get("an-overflow-re-resolves-through-the-LADDER-and-EXITS-AT-A-DIFFERENT-RUNG")
	rungPlayers := toLadderPlayers(t, rung.Players)
	overflow := rowOf(rung, "aw-02")
	original := resolveOverFullRoster(t, rung, "aw-02", rungPlayers)
	if original.LadderExitStep == 0 {
		t.Errorf("%q: the UNREDUCED resolution of aw-02 did not reach the ladder at all, so "+
			"'a different rung' has nothing to differ from", rung.Name)
	}
	if original.LadderExitStep == overflow.LadderExitStep {
		t.Errorf("%q: the unreduced resolution exits at rung %d and the re-resolution at rung %d — "+
			"they must DIFFER, or the row does not pin the exit step", rung.Name,
			original.LadderExitStep, overflow.LadderExitStep)
	}
	if original.SteamID64 == overflow.SteamID64 {
		t.Errorf("%q: the removal did not change the winner", rung.Name)
	}
	rungRows := 0
	for _, c := range v.Cases {
		for _, r := range c.Expected.Results {
			if r.LadderExitStep != 0 && r.LadderExitStep != 5 && len(r.SweptOut) > 0 {
				rungRows++
			}
		}
	}
	if rungRows != 1 {
		t.Errorf("%d rows are a re-resolution that exits the ladder at rungs 1-4; exactly one may, "+
			"or the claim is no longer unique", rungRows)
	}

	// ── the co-winner who is swept out is NOT the first one ───────────────────────────────────
	co := get("a-CO-WINNER-of-an-EARLIER-shared-award-is-the-one-SWEPT-OUT")
	coPlayers := toLadderPlayers(t, co.Players)
	sharedRow := rowOf(co, "aw-01")
	if sharedRow.Kind != string(KindShared) || len(sharedRow.Winners) < 2 {
		t.Fatalf("%q: award 1 must be a SHARED outcome with at least two winners, got %q %v",
			co.Name, sharedRow.Kind, sharedRow.Winners)
	}
	wouldHaveWon := resolveOverFullRoster(t, co, "aw-02", coPlayers)
	if wouldHaveWon.SteamID64 != sharedRow.Winners[1] {
		t.Errorf("%q: award 2's unreduced winner is %q, but the row only discriminates "+
			"'all co-winners count' from 'winners[0] counts' when it is the SECOND co-winner %q",
			co.Name, wouldHaveWon.SteamID64, sharedRow.Winners[1])
	}

	// ── exhaustion: the eligible set was NON-EMPTY before removal ─────────────────────────────
	exhausted := get("EXHAUSTION-every-eligible-player-for-a-LATER-award-is-ALREADY-assigned")
	exhaustedPlayers := toLadderPlayers(t, exhausted.Players)
	empty := rowOf(exhausted, "aw-02")
	if empty.Kind != string(KindNoEligiblePlayers) || len(empty.SweptOut) == 0 {
		t.Fatalf("%q: award 2 must be no_eligible_players with a NON-EMPTY swept_out, got %q %v",
			exhausted.Name, empty.Kind, empty.SweptOut)
	}
	before := resolveOverFullRoster(t, exhausted, "aw-02", exhaustedPlayers)
	if before.Kind == string(KindNoEligiblePlayers) {
		t.Errorf("%q: award 2 has no eligible players even BEFORE any removal, so the row is "+
			"indistinguishable from an award nobody qualified for", exhausted.Name)
	}
	if len(empty.SweptOut) != len(exhausted.Players) {
		t.Errorf("%q: removal must have emptied the roster entirely, got %d of %d swept out",
			exhausted.Name, len(empty.SweptOut), len(exhausted.Players))
	}

	// ── its twin: no_eligible_players BEFORE any removal, with an EMPTY swept_out ─────────────
	unqualified := get("an-award-arrives-as-no_eligible_players-BEFORE-any-removal-and-assigns-NOBODY")
	firstRow := rowOf(unqualified, "aw-01")
	if firstRow.Kind != string(KindNoEligiblePlayers) || len(firstRow.SweptOut) != 0 {
		t.Errorf("%q: award 1 must be no_eligible_players with an EMPTY swept_out", unqualified.Name)
	}
	// A6 — it assigns NOBODY, so the next award still sees the whole roster.
	if len(rowOf(unqualified, "aw-02").SweptOut) != 0 {
		t.Errorf("%q: a no_eligible_players award assigned somebody", unqualified.Name)
	}

	// ── DECISION E on the reduced set: the best value was NON-ZERO before removal ─────────────
	zeroed := get("a-REDUCED-set-drops-a-max-VOLUME-awards-best-value-to-ZERO-re-triggering-DECISION-E")
	zeroedPlayers := toLadderPlayers(t, zeroed.Players)
	suppressed := rowOf(zeroed, "aw-02")
	if suppressed.Kind != string(KindNoAwardableValue) || len(suppressed.Tied) == 0 {
		t.Fatalf("%q: award 2 must be no_awardable_value carrying the suppressed set", zeroed.Name)
	}
	pre := resolveOverFullRoster(t, zeroed, "aw-02", zeroedPlayers)
	if pre.Kind != string(KindWinner) {
		t.Errorf("%q: award 2 must have an ORDINARY winner before removal, got %q — otherwise the "+
			"carve-out was not re-triggered BY the removal", zeroed.Name, pre.Kind)
	}
	// ⛔ AND THE SUPPRESSED SET IS READ, NEVER RESOLVED: none of it is assigned.
	for _, sid := range suppressed.Tied {
		if containsString(zeroed.Expected.Assigned, sid) {
			t.Errorf("%q: %s is in the suppressed set AND in `assigned` — DECISION K says the width "+
				"is to be read, never resolved", zeroed.Name, sid)
		}
	}

	// ── the width-1 reduced tie is never handed to the ladder ─────────────────────────────────
	width1 := get("a-reduced-tie-of-WIDTH-1-is-NEVER-handed-to-the-ladder")
	width1Players := toLadderPlayers(t, width1.Players)
	resolvedRow := rowOf(width1, "aw-02")
	if resolvedRow.Kind != string(KindWinner) || resolvedRow.LadderExitStep != 0 {
		t.Errorf("%q: award 2 must resolve as a Stage-2 winner with no ladder, got %q step %d",
			width1.Name, resolvedRow.Kind, resolvedRow.LadderExitStep)
	}
	// The property that makes the row hard: the UNREDUCED outcome is a tie of width exactly 2, and
	// the removed player is one of the two — so a pop-the-winner shortcut would hand the ladder a
	// width-1 set and be REFUSED where this resolves.
	raw, err := ResolveStage2(toLadderAward(liveAward(t, width1, "aw-02")), width1Players)
	if err != nil {
		t.Fatalf("%q: re-resolving aw-02 over the full roster: %v", width1.Name, err)
	}
	if raw.Kind != KindTie || len(raw.Tied) != 2 {
		t.Errorf("%q: aw-02 over the full roster must be a tie of width 2, got %q width %d",
			width1.Name, raw.Kind, len(raw.Tied))
	}
	// ⛔ FATAL, NOT Errorf — the index below panics on an empty slice, and the check above it is
	// non-fatal, so a vector edit that emptied `swept_out` turned a clean assertion failure into an
	// index-out-of-range that takes down the whole package binary and hides every other failure in
	// it. Guard the index, not just the value.
	if len(resolvedRow.SweptOut) == 0 {
		t.Fatalf("%q: award 2 swept nobody out, so there is no reduced set and the row proves "+
			"nothing about width-1 ties", width1.Name)
	}
	if !containsString(raw.Tied, resolvedRow.SweptOut[0]) {
		t.Errorf("%q: the swept-out player %q is not in the original tie, so the reduced set does "+
			"not have width 1", width1.Name, resolvedRow.SweptOut[0])
	}

	// ── the shared re-resolution assigns TWO players at once ──────────────────────────────────
	sharedOverflow := get("an-overflow-re-resolves-to-a-SHARED-outcome-and-assigns-TWO-players-at-once")
	so := rowOf(sharedOverflow, "aw-02")
	if so.Kind != string(KindShared) || len(so.Winners) != 2 || len(so.SweptOut) == 0 {
		t.Errorf("%q: award 2 must be a SHARED re-resolution with two winners", sharedOverflow.Name)
	}
	sharedReresolutions := 0
	for _, c := range v.Cases {
		for _, r := range c.Expected.Results {
			if r.Kind == string(KindShared) && len(r.SweptOut) > 0 {
				sharedReresolutions++
			}
		}
	}
	if sharedReresolutions != 1 {
		t.Errorf("%d rows are a SHARED re-resolution; exactly one may, or the claim is not unique",
			sharedReresolutions)
	}

	// ── ⭐⭐ THE FOUR CASES THAT WERE PINNED BY NAME AND GUARDED BY NOTHING ─────────────────────
	//
	// The code review measured this: twelve of the sixteen case names got a guard that re-derives
	// the row's defining property from its own data, and four did not — including BOTH rows the
	// mutation pass added, which are by definition the rows measured to be load-bearing. A case name
	// is not a test. Each guard below asserts the property the NAME claims, so a regeneration or a
	// hand-edit that quietly degraded the row into a duplicate of a neighbour reddens here instead
	// of passing while the name goes on advertising coverage it no longer has. This is the
	// coverage-guard defect at its FOURTH occurrence in this epic; it is the same fix each time.

	// The reversed-roster row is worthless if the roster it supplies happens to be sorted: the
	// `sweptOut.sort()` and `assigned.sort()` calls become identities and deleting them is
	// byte-identical. This is the exact mutation that survived the author's first run.
	revRoster := get("the-ROSTER-supplied-OUT-OF-BYTE-LEX-order-changes-NOTHING")
	suppliedIDs := make([]string, 0, len(revRoster.Players))
	for _, p := range revRoster.Players {
		suppliedIDs = append(suppliedIDs, p.SteamID64)
	}
	if sort.StringsAreSorted(suppliedIDs) {
		t.Errorf("%q supplies its roster ALREADY in byte-lex order %v — the sort is then an "+
			"identity and deleting it is byte-identical, which is precisely the mutation this row "+
			"exists to kill", revRoster.Name, suppliedIDs)
	}

	// The zero-kill row is worthless if every player has the same kills: a pass that quietly
	// re-applied an eligibility filter produces identical output. Also the author's measured hole.
	zeroKill := get("a-ZERO-KILL-player-WINS-and-the-pass-FILTERS-NOBODY")
	zkWinner := rowOf(zeroKill, "aw-01")
	zeroKillers := 0
	winnerKills := "(not found)"
	for _, p := range zeroKill.Players {
		if p.Kills == "0" {
			zeroKillers++
		}
		if p.SteamID64 == zkWinner.SteamID64 {
			winnerKills = p.Kills
		}
	}
	if zeroKillers == 0 {
		t.Errorf("%q has no player with zero kills — a pass that re-applied a kills floor would "+
			"produce identical output and the row would discriminate nothing", zeroKill.Name)
	}
	if winnerKills != "0" {
		t.Errorf("%q: award 1's winner %q has kills=%s, not 0 — the row is named for a ZERO-KILL "+
			"player WINNING, and a non-zero winner does not test the claim",
			zeroKill.Name, zkWinner.SteamID64, winnerKills)
	}

	// Two DIFFERENT players swept out of two DIFFERENT awards — not the same player twice, which is
	// the cascade row's property and would make this a duplicate of it.
	twoDiff := get("TWO-DIFFERENT-players-are-swept-out-of-TWO-DIFFERENT-awards")
	sweptBy := map[string]map[string]bool{}
	for _, r := range twoDiff.Expected.Results {
		for _, sid := range r.SweptOut {
			if sweptBy[sid] == nil {
				sweptBy[sid] = map[string]bool{}
			}
			sweptBy[sid][r.AwardID] = true
		}
	}
	awardsThatSwept := map[string]bool{}
	for _, r := range twoDiff.Expected.Results {
		if len(r.SweptOut) > 0 {
			awardsThatSwept[r.AwardID] = true
		}
	}
	if len(sweptBy) < 2 || len(awardsThatSwept) < 2 {
		t.Errorf("%q sweeps %d distinct player(s) across %d award(s) — the name claims TWO of each, "+
			"and one of either makes it the cascade row under a different title",
			twoDiff.Name, len(sweptBy), len(awardsThatSwept))
	}

	// The single overflow must actually CHANGE HANDS: award 2's winner over the reduced set must
	// differ from its winner over the full roster. Without this the row passes for a pass that
	// removed the player and re-crowned him anyway.
	singleOverflow := get("a-SINGLE-OVERFLOW-re-resolves-award-2-to-the-NEXT-ELIGIBLE-player")
	singlePlayers := toLadderPlayers(t, singleOverflow.Players)
	reducedWinner := rowOf(singleOverflow, "aw-02")
	fullWinner := resolveAwardOver(t, singleOverflow, "aw-02", singlePlayers)
	if len(reducedWinner.SweptOut) == 0 {
		t.Errorf("%q: award 2 swept nobody out, so nothing overflowed", singleOverflow.Name)
	}
	if fullWinner.SteamID64 == reducedWinner.SteamID64 {
		t.Errorf("%q: award 2 crowns %q over BOTH the full roster and the reduced one — the row is "+
			"named for an overflow that re-resolves to the NEXT eligible player, and a winner that "+
			"does not change hands proves no removal happened",
			singleOverflow.Name, reducedWinner.SteamID64)
	}
	if !containsString(reducedWinner.SweptOut, fullWinner.SteamID64) {
		t.Errorf("%q: the full-roster winner %q is not among award 2's swept-out players %v — the "+
			"overflow is then a coincidence rather than a consequence of the removal",
			singleOverflow.Name, fullWinner.SteamID64, reducedWinner.SweptOut)
	}
}

// liveAward finds one of a case's live awards by id.
func liveAward(t *testing.T, c sweepCase, awardID string) ladderAward {
	t.Helper()
	for _, l := range c.Live {
		if l.AwardID == awardID {
			return l.Award
		}
	}
	t.Fatalf("case %q has no live award %q", c.Name, awardID)
	return ladderAward{}
}

// resolveAwardOver runs the REAL Stage 2 (and the REAL ladder on a tie) over an arbitrary roster.
//
// ⭐ EVERY COVERAGE GUARD ABOVE GOES THROUGH THIS, because a counterfactual asserted from a literal
// is a transcription and a counterfactual COMPUTED is a measurement. It is the Go mirror of the
// anchor's `_unreduced`.
func resolveAwardOver(t *testing.T, c sweepCase, awardID string, players []SnapshotPlayer) sweepResultRow {
	t.Helper()
	award := toLadderAward(liveAward(t, c, awardID))
	out, err := ResolveStage2(award, players)
	if err != nil {
		t.Fatalf("case %q: resolving %s over a counterfactual roster: %v", c.Name, awardID, err)
	}
	if out.Kind == KindTie {
		out, err = ResolveLadder(award, out.Tied, players)
		if err != nil {
			t.Fatalf("case %q: laddering %s over a counterfactual roster: %v", c.Name, awardID, err)
		}
	}
	return sweepResultRow{
		AwardID:        awardID,
		Kind:           string(out.Kind),
		SteamID64:      out.SteamID64,
		Winners:        out.Winners,
		Tied:           out.Tied,
		LadderExitStep: out.LadderExitStep,
	}
}

func resolveOverFullRoster(t *testing.T, c sweepCase, awardID string, players []SnapshotPlayer) sweepResultRow {
	t.Helper()
	return resolveAwardOver(t, c, awardID, players)
}

func excludePlayers(players []SnapshotPlayer, ids ...string) []SnapshotPlayer {
	out := make([]SnapshotPlayer, 0, len(players))
	for _, p := range players {
		if containsString(ids, p.SteamID64) {
			continue
		}
		out = append(out, p)
	}
	return out
}

func sameExpected(a, b sweepExpected) bool {
	if strings.Join(a.Assigned, ",") != strings.Join(b.Assigned, ",") || len(a.Results) != len(b.Results) {
		return false
	}
	for i := range a.Results {
		x, y := a.Results[i], b.Results[i]
		if x.AwardID != y.AwardID || x.Priority != y.Priority || x.Kind != y.Kind ||
			x.SteamID64 != y.SteamID64 || x.LadderExitStep != y.LadderExitStep ||
			x.Reresolved != y.Reresolved ||
			strings.Join(x.Winners, ",") != strings.Join(y.Winners, ",") ||
			strings.Join(x.Tied, ",") != strings.Join(y.Tied, ",") ||
			strings.Join(x.SweptOut, ",") != strings.Join(y.SweptOut, ",") {
			return false
		}
	}
	return true
}

func sameLiveOrder(a, b []sweepCandidate) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].AwardID != b[i].AwardID {
			return false
		}
	}
	return true
}

func sameLiveSet(a, b []sweepCandidate) bool {
	if len(a) != len(b) {
		return false
	}
	ids := func(xs []sweepCandidate) []string {
		out := make([]string, 0, len(xs))
		for _, x := range xs {
			out = append(out, x.AwardID+"@"+itoa(x.Priority))
		}
		sort.Strings(out)
		return out
	}
	return strings.Join(ids(a), ",") == strings.Join(ids(b), ",")
}

func isSortedByPriority(live []sweepCandidate, ascending bool) bool {
	for i := 1; i < len(live); i++ {
		if ascending && live[i-1].Priority > live[i].Priority {
			return false
		}
		if !ascending && live[i-1].Priority < live[i].Priority {
			return false
		}
	}
	return true
}

// ── local rows: the states no set of INPUTS can reach ───────────────────────────

// ⭐ A1 IS CARRIED BY THE SIGNATURE, AND THIS IS THE ONLY HONEST WAY TO SAY SO. There is no runtime
// assertion here that "the pass drew nothing", because `ResolveSpin` takes no `*Stream` and such an
// assertion would be VACUOUS — the 6-4b code review deleted exactly that shape. What CAN be asserted
// is that the whole pass runs without one existing, which the entire vector suite above already
// does. This test states the property so a future edit that adds a stream parameter has to delete a
// named test rather than quietly widen a signature.
func TestResolveSpinTakesNoStreamAndTheSignatureIsTheProof(t *testing.T) {
	// A compile-time statement of the contract: the pass is exactly this shape.
	var _ func([]Stage1Candidate, []SnapshotPlayer, Ladder) (SpinResult, error) = ResolveSpin
}

func TestResolveSpinRefusesAnAbsentLadder(t *testing.T) {
	live := []Stage1Candidate{{AwardID: "aw-01", Priority: 1, Award: Award{
		DecidingStat: "kills", Class: ClassVolume, Direction: DirectionMax,
	}}}
	for _, tc := range []struct {
		name   string
		ladder Ladder
	}{
		{"a plain nil interface", nil},
		// ⭐ THE TYPED NIL, which a plain `ladder == nil` does NOT catch — an interface holding
		// `(*nilLadder)(nil)` is itself non-nil, so without `ladderIsNil` the tie path dereferences
		// a nil receiver and panics instead of refusing. 6-4a measured this on `ResolveAward`.
		{"a TYPED nil", (*nilSweepLadder)(nil)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := ResolveSpin(live, nil, tc.ladder)
			var invalid *SweepInvalidError
			if !errors.As(err, &invalid) || invalid.Detail != SweepDetailLadder {
				t.Fatalf("err = %v, want a SweepInvalidError with detail %q", err, SweepDetailLadder)
			}
			if !errors.Is(err, ErrSweep) {
				t.Errorf("the refusal is not an ErrSweep: %v", err)
			}
		})
	}
}

type nilSweepLadder struct{}

func (*nilSweepLadder) Resolve(Award, Outcome, []SnapshotPlayer) (Outcome, error) {
	return Outcome{}, nil
}

// stubSweepLadder returns whatever it is told to, which is the ONLY way to drive the port guards.
// (Its own type rather than a reuse of `stage1_test.go`'s `stubLadder`: that one carries no error
// arm, and widening a shared fixture for one caller is how two suites start testing one shape.)
type stubSweepLadder struct {
	out Outcome
	err error
}

func (s stubSweepLadder) Resolve(Award, Outcome, []SnapshotPlayer) (Outcome, error) {
	return s.out, s.err
}

// ⭐⭐ THE `internal` ARMS, DRIVEN BY A STUB PORT — the machinery Story 6-5b built for Stage 1's twin
// pair, applied here from the first commit rather than after a review.
//
// `Ladder` is an INJECTED PORT: 6.9's verifier reimplements it and any third-party implementation
// reaches these arms, which is the entire reason the guards were written. The shipped `FR29Ladder`
// cannot produce any of these shapes (`validateLadder` refuses an empty tied member and
// `bestSurvivors` refuses an empty best set), so nothing else in the suite touches them.
//
// ⚠ These are LOCAL rows, not vector rows, and deliberately so: a stub port is not a set of INPUTS,
// so the shared file cannot express one — which is exactly why `internal` is declared and NOT
// row-representable.
func TestSweepInternalGuardsAreDrivenByAStubPort(t *testing.T) {
	// A tie the ladder is handed: two players equal on the deciding stat.
	award := Award{DecidingStat: "knife_kills", Class: ClassVolume, Direction: DirectionMax}
	live := []Stage1Candidate{{AwardID: "aw-01", Priority: 1, Award: award}}
	players := []SnapshotPlayer{
		tiedSweepPlayer("76561198000000011"),
		tiedSweepPlayer("76561198000000022"),
	}

	for _, tc := range []struct {
		name string
		out  Outcome
	}{
		{
			// A ladder that returned its tie unchanged would otherwise fall through the winners
			// switch and assign NOBODY — silently turning a resolved tie into a category with no
			// trophy, which reads downstream as "nobody was eligible".
			name: "the port returns the tie unresolved",
			out:  Outcome{Kind: KindTie, Tied: []string{"76561198000000011", "76561198000000022"}},
		},
		{
			name: "the port returns a kind that resolves nothing",
			out:  Outcome{Kind: KindNoEligiblePlayers},
		},
		{
			// A trophy awarded to NOBODY. Without the guard, `Winners[0]` panics in Go and reads
			// `undefined` in TypeScript: one input, two failure kinds across the seam.
			name: "the port returns SHARED with no winners",
			out:  Outcome{Kind: KindShared, LadderExitStep: LadderExitShared},
		},
		{
			// ⭐ The empty id would enter `assigned`, match no roster row, remove nobody — and at
			// 6.8 be written to `award_result_winner` as a foreign key to nothing.
			name: "the port returns SHARED with an empty steamid64",
			out: Outcome{Kind: KindShared, LadderExitStep: LadderExitShared,
				Winners: []string{"", "76561198000000022"}},
		},
		{
			name: "the port returns a WINNER with an empty steamid64",
			out:  Outcome{Kind: KindWinner, LadderExitStep: LadderExitSecondary},
		},
		{
			// ⭐⭐ THE CAP'S OWN INVARIANT, WHICH NO STUB ROW DROVE UNTIL THE CODE REVIEW. Every row
			// above tests a MALFORMED shape; this one is perfectly well-formed and is the violation
			// FR-26 exists to prevent — a port handing back a player who is not in the candidate set
			// the award competed over. The story claimed this impossible "by construction"; it was
			// impossible only for the SHIPPED ladder, and the guards vetted weaker properties than
			// the load-bearing one.
			name: "the port returns a WINNER who is not on the roster at all",
			out: Outcome{Kind: KindWinner, LadderExitStep: LadderExitSecondary,
				SteamID64: "76561198000000099"},
		},
		{
			name: "the port returns SHARED including a player outside the candidate set",
			out: Outcome{Kind: KindShared, LadderExitStep: LadderExitShared,
				Winners: []string{"76561198000000011", "76561198000000099"}},
		},
		{
			// ⛔ A DUPLICATE CO-WINNER. `assigned` is a map and would dedupe it silently, so the
			// violation would never show in `SpinResult.Assigned` — it would show at 6.8 as two
			// `award_result_winner` rows for one player, with the `is_shared` trigger counting 2
			// and AGREEING with the flag while the ceremony was already wrong.
			name: "the port returns SHARED listing the same player twice",
			out: Outcome{Kind: KindShared, LadderExitStep: LadderExitShared,
				Winners: []string{"76561198000000011", "76561198000000011"}},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := ResolveSpin(live, players, stubSweepLadder{out: tc.out})
			var invalid *SweepInvalidError
			if !errors.As(err, &invalid) {
				t.Fatalf("err = %v, want a *SweepInvalidError", err)
			}
			if invalid.Detail != SweepDetailInternal {
				t.Errorf("detail = %q, want %q", invalid.Detail, SweepDetailInternal)
			}
		})
	}
}

func tiedSweepPlayer(sid string) SnapshotPlayer {
	return SnapshotPlayer{
		SteamID64:    sid,
		RoundsPlayed: big.NewInt(30),
		Kills:        big.NewInt(20),
		Volume:       map[string]*big.Int{"knife_kills": big.NewInt(7)},
		Rate:         map[string]RatePair{},
	}
}

// ── properties the vector cannot state ─────────────────────────────────────────

// ⛔ A PURE PASS MUST NOT REORDER ITS CALLER'S SLICES. `eligiblePlayers` and `stage1Weighted` both
// carry the same guard, for the same reason: a resolver that sorted its input in place would make
// two consecutive resolutions of the same spin observably different operations — and the caller
// here holds `Stage1Result.Live`'s DRAW order, which is the REVEAL order Story 6.10 renders.
func TestResolveSpinDoesNotMutateItsInputs(t *testing.T) {
	v := loadSweep(t)
	for _, tc := range v.Cases {
		t.Run(tc.Name, func(t *testing.T) {
			live := toSweepLive(t, tc.Live)
			players := toLadderPlayers(t, tc.Players)

			liveBefore := make([]string, 0, len(live))
			for _, c := range live {
				liveBefore = append(liveBefore, c.AwardID)
			}
			playersBefore := make([]string, 0, len(players))
			for _, p := range players {
				playersBefore = append(playersBefore, p.SteamID64)
			}

			if _, err := ResolveSpin(live, players, FR29Ladder{}); err != nil {
				t.Fatalf("ResolveSpin: %v", err)
			}

			liveAfter := make([]string, 0, len(live))
			for _, c := range live {
				liveAfter = append(liveAfter, c.AwardID)
			}
			playersAfter := make([]string, 0, len(players))
			for _, p := range players {
				playersAfter = append(playersAfter, p.SteamID64)
			}
			if strings.Join(liveBefore, ",") != strings.Join(liveAfter, ",") {
				t.Errorf("the live slice was reordered: %v -> %v", liveBefore, liveAfter)
			}
			if strings.Join(playersBefore, ",") != strings.Join(playersAfter, ",") {
				t.Errorf("the players slice was reordered: %v -> %v", playersBefore, playersAfter)
			}
		})
	}
}

// ⭐⭐ THE CAP ITSELF, ASSERTED OVER EVERY CASE: no player appears in more than one award's winner
// set within one spin. It is the ONE property the whole story exists to guarantee, and it is
// deliberately checked as an INVARIANT over the resolved output rather than row by row — a per-row
// expectation can be satisfied by a vector that simply never constructs the violation.
//
// This is the same property migration 0025's `unique (spin_id, winner_entry_id)` backstops at the
// database. That constraint must never fire; this is why.
func TestResolveSpinNeverAwardsOnePlayerTwiceInOneSpin(t *testing.T) {
	v := loadSweep(t)
	for _, tc := range v.Cases {
		t.Run(tc.Name, func(t *testing.T) {
			got, err := ResolveSpin(toSweepLive(t, tc.Live), toLadderPlayers(t, tc.Players), FR29Ladder{})
			if err != nil {
				t.Fatalf("ResolveSpin: %v", err)
			}
			seen := map[string]string{}
			for _, r := range got.Results {
				for _, sid := range winnersOf(r.Outcome) {
					if prev, dup := seen[sid]; dup {
						t.Errorf("%s won %s AND %s in one spin — the anti-sweep cap did not hold",
							sid, prev, r.AwardID)
					}
					seen[sid] = r.AwardID
				}
			}
			// …and `Assigned` is exactly that set, in byte-lex order.
			want := make([]string, 0, len(seen))
			for sid := range seen {
				want = append(want, sid)
			}
			sort.Strings(want)
			if strings.Join(got.Assigned, ",") != strings.Join(want, ",") {
				t.Errorf("assigned = %v, but the winner sets hold %v", got.Assigned, want)
			}
		})
	}
}

func winnersOf(out Outcome) []string {
	switch out.Kind {
	case KindWinner:
		return []string{out.SteamID64}
	case KindShared:
		return out.Winners
	}
	return nil
}
