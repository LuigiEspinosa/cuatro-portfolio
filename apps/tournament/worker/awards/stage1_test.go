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
// These tests read `roulette/vectors/stage1-pick.json` AT RUNTIME through the 6.3 loader. No
// value is ever transcribed into a Go literal: a hard-coded copy greens on the day the vector is
// regenerated and silently stops testing the contract.

type stage1VectorCandidate struct {
	AwardID  string `json:"award_id"`
	Priority int    `json:"priority"`
	// ⭐ `ladderAward` SINCE STORY 6.5 — it is `stage2Award` plus the three FR-29 rung keys as
	// PLAIN STRINGS. The fourteen pre-6.5 rows carry none of the three and load identically (an
	// omitted JSON key leaves a Go string at ""), which is the same loader rule the ladder vector
	// pins by name; the appended ladder rows can carry them.
	Award ladderAward `json:"award"`
}

type stage1VectorDraw struct {
	N                  uint64 `json:"n"`
	R                  uint64 `json:"r"`
	BytesConsumedAfter uint64 `json:"bytes_consumed_after"`
}

type stage1VectorExpected struct {
	Weights     []int              `json:"weights"`
	TotalWeight int                `json:"total_weight"`
	Draws       []stage1VectorDraw `json:"draws"`
	Live        []string           `json:"live"`
}

type stage1VectorCase struct {
	Name        string                  `json:"name"`
	Note        string                  `json:"note"`
	SeedHex     string                  `json:"seed_hex"`
	Label       string                  `json:"label"`
	LabelSource labelSource             `json:"label_source"`
	WeightTable []int                   `json:"weight_table"`
	Shelf       map[string]int          `json:"shelf"`
	LiveCount   int                     `json:"live_count"`
	Candidates  []stage1VectorCandidate `json:"candidates"`
	// ⭐ `ladderPlayer` SINCE STORY 6.5, for the same reason as the award above: a row that INJECTS
	// a ladder must carry the four FR-29 blocks the rungs read, while the pre-6.5 rows carry none
	// of them and load with empty maps and a nil AchievementTS — which is correct, because nothing
	// on a no-ladder path ever consults them.
	Players  []ladderPlayer       `json:"players"`
	Expected stage1VectorExpected `json:"expected"`
	// Absent on every pre-6.5 row, which IS the no-ladder contract.
	Ladder bool `json:"ladder"`
}

type stage1VectorRefusal struct {
	Why         string                  `json:"why"`
	RefusalKind string                  `json:"refusal_kind"`
	Detail      string                  `json:"detail"`
	SeedHex     string                  `json:"seed_hex"`
	Label       string                  `json:"label"`
	LabelSource labelSource             `json:"label_source"`
	WeightTable []int                   `json:"weight_table"`
	Shelf       map[string]int          `json:"shelf"`
	LiveCount   int                     `json:"live_count"`
	Candidates  []stage1VectorCandidate `json:"candidates"`
	Players     []ladderPlayer          `json:"players"`
	Ladder      bool                    `json:"ladder"`
}

type stage1Vector struct {
	Vector         string                `json:"vector"`
	AlgoVersion    string                `json:"algo_version"`
	RefusalKinds   []string              `json:"refusal_kinds"`
	RefusalDetails []string              `json:"refusal_details"`
	Refusals       []stage1VectorRefusal `json:"refusals"`
	Cases          []stage1VectorCase    `json:"cases"`
}

func loadStage1(t *testing.T) stage1Vector {
	t.Helper()
	v := loadVector[stage1Vector](t, "stage1-pick.json")
	if v.Vector != "stage1-pick" {
		t.Fatalf("loaded the wrong vector file: %q", v.Vector)
	}
	if len(v.Cases) == 0 {
		t.Fatal("stage1-pick.json has no cases")
	}
	if len(v.Refusals) == 0 {
		t.Fatal("stage1-pick.json carries no refusals list — the refusals are not shared contract")
	}
	if v.AlgoVersion != "inclusivcup-roulette-1.0.0" {
		t.Errorf("algo_version = %q — epics.md:1164 fixes it and 6.3's review already corrected it once", v.AlgoVersion)
	}
	return v
}

// toCandidates converts a vector row, guarding the loader rather than trusting it.
//
// ⛔ The 6.3 code review found a Go coverage test PANICKING the whole binary on a malformed row
// instead of failing one named test. When `strict`, every field the walk depends on is checked
// here, so a drifted vector fails a NAMED parse rather than arriving as a plausible zero.
//
// ⚠ `strict` IS FALSE FOR THE REFUSAL ROWS, and that is not a loophole — it is the distinction the
// 6-4b code review forced. This body used to be a pure field copy while the comment claimed it
// guarded everything, so a CASE row that had lost its `priority` key arrived as Priority 0 and
// surfaced as "stage 1 refused (pool): award has priority 0" — an IMPLEMENTATION failure reported
// for a drifted VECTOR, the exact plausible zero the comment said it prevented. But the refusal
// rows are DELIBERATELY malformed (a non-positive priority is one of them), so guarding them the
// same way would reject the very inputs they exist to feed in. Cases must be well-formed; refusals
// must not be pre-judged.
func toCandidates(t *testing.T, rows []stage1VectorCandidate, strict bool) []Stage1Candidate {
	t.Helper()
	out := make([]Stage1Candidate, 0, len(rows))
	for i, r := range rows {
		if strict {
			if r.AwardID == "" {
				t.Fatalf("vector candidate %d has an empty award_id — the row is malformed, not the implementation", i)
			}
			if r.Priority < 1 {
				t.Fatalf("vector candidate %d (%s) has priority %d — a missing or non-positive `priority` key in the row, not an implementation defect",
					i, r.AwardID, r.Priority)
			}
			if r.Award.DecidingStat == "" || r.Award.Class == "" || r.Award.Direction == "" {
				t.Fatalf("vector candidate %d (%s) has an incomplete award projection %+v — the walk depends on every one of these fields",
					i, r.AwardID, r.Award)
			}
		}
		out = append(out, Stage1Candidate{
			AwardID:  r.AwardID,
			Priority: r.Priority,
			Award:    toLadderAward(r.Award),
		})
	}
	return out
}

// stage1Stream opens the case's stream, rebuilding the LABEL from `label_source` with the
// package's own generator and cross-checking it against the label the vector carries.
//
// ⭐ Without this, a suite only ever CONSUMES `label` as an opaque string — and the 6.3 mutation
// pass proved that gap real: bumping the `v1` prefix and making the spin 0-based BOTH passed the
// vector-driven test until `label_source` existed.
func stage1Stream(t *testing.T, seedHex, label string, src labelSource) *Stream {
	t.Helper()
	built := buildLabel(t, src)
	if built != label {
		t.Fatalf("label mismatch: built %q from %+v, vector carries %q", built, src, label)
	}
	seed, err := DecodeSeed(seedHex)
	if err != nil {
		t.Fatalf("DecodeSeed(%q): %v", seedHex, err)
	}
	return mustStream(t, seed, label)
}

func toInput(t *testing.T, c stage1VectorCase) Stage1Input {
	t.Helper()
	return Stage1Input{
		Candidates: toCandidates(t, c.Candidates, true),
		Players:    toLadderPlayers(t, c.Players),
		Shelf:      c.Shelf,
		Table:      c.WeightTable,
		LiveCount:  c.LiveCount,
		// ⭐ INJECTED ONLY WHEN THE ROW SAYS SO. A nil Ladder is the 6-4b contract — a tie refuses —
		// and that is the state all fourteen pre-6.5 rows are in, which is what keeps every one of
		// gate 3's eighteen refusal rows valid.
		Ladder: ladderFor(c.Ladder),
	}
}

// ladderFor returns the real FR-29 ladder or a genuine nil interface.
//
// ⚠ IT MUST RETURN AN UNTYPED NIL on the false branch. Returning a typed nil (`var l *FR29Ladder`)
// would produce a non-nil interface holding a nil pointer — the exact shape `ladderIsNil` exists to
// catch, and it would make every no-ladder row silently take the ladder path.
func ladderFor(inject bool) Ladder {
	if inject {
		return FR29Ladder{}
	}
	return nil
}

// ⭐ THE CASE-NAME SET IS PINNED BY EXACT EQUALITY, exactly as `stage2CaseNames` is and for the
// reason the 6-4a code review measured: a `len(cases) > 0` check is not enough. Five DECISION-E
// scope rows could be deleted from `stage2-resolve.json` with every coverage flag still satisfied
// by surviving rows, `--check` still OK and both suites green. The same hazard is sharper here,
// because this file's single most valuable row —
// `r-lands-exactly-on-a-cumulative-boundary` — is the ONLY row where `r` sits exactly on a
// cumulative boundary, so deleting it would make `cum > r` versus `cum >= r` untested while
// twelve other rows kept passing. Adding a case reddens this deliberately.
var stage1CaseNames = []string{
	// ⭐ Story 6.5 appended two rows, and adding them here is the deliberate update this pin asks
	// for. They are the only rows in the file that INJECT a ladder.
	"a-SHARED-co-winner-shelf-is-CLAMPED-to-table_max-after-the-minimum",
	"a-SHARED-co-winner-weights-at-the-MINIMUM-shelf",
	"an-absent-shelf-map-is-shelf-zero-for-everyone",
	"an-injected-ladder-RESOLVES-a-tie-that-would-otherwise-refuse",
	"an-omitted-shelf-key-is-the-empty-shelf",
	"candidates-supplied-out-of-priority-order",
	"every-candidate-has-no-eligible-players-and-weights-heaviest",
	"heaviest-weighted-candidate-is-not-the-one-drawn",
	"live-count-2-redraws-against-the-recomputed-total",
	"live-count-equal-to-the-whole-pool-drains-it-in-draw-order",
	"min-and-rate-candidates-resolve-through-the-real-stage-2",
	"no-awardable-value-weights-as-an-empty-shelf",
	"r-lands-exactly-on-a-cumulative-boundary",
	"shelf-to-weight-mapping-with-clamp-and-empty-shelf",
	"single-candidate-pool-still-draws-and-consumes-a-byte",
	"the-shelf-is-frozen-across-the-picks-of-one-spin",
	"total-weight-one-is-the-only-zero-byte-draw",
}

func TestVectorStage1CarriesExactlyTheExpectedCases(t *testing.T) {
	v := loadStage1(t)
	got := make([]string, 0, len(v.Cases))
	for _, c := range v.Cases {
		got = append(got, c.Name)
	}
	sort.Strings(got)
	if strings.Join(got, "\n") != strings.Join(stage1CaseNames, "\n") {
		t.Errorf("the vector's case set drifted.\n got: %v\nwant: %v", got, stage1CaseNames)
	}
}

// ── §9.6 GATE 3: the conformance gate ──────────────────────────────────────────

func TestVectorStage1Pick(t *testing.T) {
	v := loadStage1(t)

	for _, tc := range v.Cases {
		t.Run(tc.Name, func(t *testing.T) {
			in := toInput(t, tc)
			s := stage1Stream(t, tc.SeedHex, tc.Label, tc.LabelSource)

			// A fresh stream starts at 0 — otherwise every byte assertion below is relative to
			// an unknown origin.
			if s.Consumed() != 0 {
				t.Fatalf("a fresh stream reports %d bytes consumed", s.Consumed())
			}

			got, err := Stage1Pick(s, in)
			if err != nil {
				t.Fatalf("Stage1Pick: %v\nnote: %s", err, tc.Note)
			}

			// ⭐ THE WEIGHTS ARE AS LOAD-BEARING AS THE PICK. A vector that asserted only the
			// winner would let a wrong shelf lookup pass on every case where it happened to draw
			// the same award anyway — and eight of the thirteen rows here would do exactly that.
			if !equalInts(got.Weights, tc.Expected.Weights) {
				t.Errorf("weights = %v, want %v (ASCENDING PRIORITY order)\nnote: %s",
					got.Weights, tc.Expected.Weights, tc.Note)
			}
			// Pinned separately from the draws so a summation bug is its own failure rather than
			// hiding inside a draw that landed the same way.
			if got.TotalWeight != tc.Expected.TotalWeight {
				t.Errorf("total_weight = %d, want %d\nnote: %s",
					got.TotalWeight, tc.Expected.TotalWeight, tc.Note)
			}

			if len(got.Draws) != len(tc.Expected.Draws) {
				t.Fatalf("made %d draws, want %d — live_count is %d\nnote: %s",
					len(got.Draws), len(tc.Expected.Draws), tc.LiveCount, tc.Note)
			}
			for i, want := range tc.Expected.Draws {
				d := got.Draws[i]
				// W4 — `n` is the RECOMPUTED total for this pick. On a live_count > 1 row it
				// differs from the previous draw's by exactly the removed weight; reusing the
				// first draw's remainder makes no second draw at all.
				if d.N != want.N {
					t.Errorf("draw %d: n = %d, want %d\nnote: %s", i+1, d.N, want.N, tc.Note)
				}
				if d.R != want.R {
					t.Errorf("draw %d: r = %d, want %d\nnote: %s", i+1, d.R, want.R, tc.Note)
				}
				// ⭐ THE BYTE ACCOUNTING IS THE CONTRACT, not a side effect. This is the only
				// externally visible proof that the producer and the browser verifier walked the
				// same stream, and the only way a rejection inside UniformInt is observable.
				if d.ConsumedAfter != want.BytesConsumedAfter {
					t.Errorf("draw %d: bytes_consumed_after = %d, want %d — the two runtimes are "+
						"no longer on the same byte\nnote: %s",
						i+1, d.ConsumedAfter, want.BytesConsumedAfter, tc.Note)
				}
			}
			// …and the stream really is where the last draw said it was.
			if n := len(got.Draws); n > 0 && s.Consumed() != tc.Expected.Draws[n-1].BytesConsumedAfter {
				t.Errorf("stream at %d after the pick, last draw reported %d",
					s.Consumed(), tc.Expected.Draws[n-1].BytesConsumedAfter)
			}

			// ⭐ COMPARED POSITIONALLY, not as a set: `live` is in DRAW order, which is the
			// REVEAL order. A selector that returned the right awards sorted by priority would
			// pass a set comparison and ship the wrong reveal order to 6.10.
			if strings.Join(got.Live, ",") != strings.Join(tc.Expected.Live, ",") {
				t.Errorf("live = %v, want %v (DRAW order)\nnote: %s",
					got.Live, tc.Expected.Live, tc.Note)
			}
			if len(got.Live) != tc.LiveCount {
				t.Errorf("live has %d entries, live_count is %d — never a short return",
					len(got.Live), tc.LiveCount)
			}

			// Stage1Weights must agree with the weights Stage1Pick used.
			//
			// ⚠ THERE IS NO "IT DREW NOTHING" ASSERTION HERE, DELIBERATELY. There used to be one:
			// it opened a fresh stream and checked Consumed() == 0 afterwards. The 6-4b code
			// review found it TAUTOLOGICAL in both suites — Stage1Weights takes no stream and has
			// no way to reach that object, so the check could not fail for any implementation,
			// including one rewritten to consume a stream. The property is real, but it is a
			// SIGNATURE property the compiler already enforces, not something a runtime assertion
			// can witness. A test that cannot fail is worse than no test: it reads as coverage.
			w, err := Stage1Weights(in)
			if err != nil {
				t.Fatalf("Stage1Weights: %v", err)
			}
			if !equalInts(w, tc.Expected.Weights) {
				t.Errorf("Stage1Weights = %v, want %v", w, tc.Expected.Weights)
			}
		})
	}
}

// ⭐ THE OUTCOME MUST NOT DEPEND ON THE ORDER THE CANDIDATES ARRIVE IN (W2), and this drives it
// over EVERY case rather than relying on the one fixture that happens to be shuffled. Reversing
// the input must change nothing: the selector sorts by priority itself.
func TestVectorStage1IsInvariantUnderCandidatePermutation(t *testing.T) {
	v := loadStage1(t)
	for _, tc := range v.Cases {
		t.Run(tc.Name, func(t *testing.T) {
			in := toInput(t, tc)
			reversed := make([]Stage1Candidate, len(in.Candidates))
			for i, c := range in.Candidates {
				reversed[len(in.Candidates)-1-i] = c
			}
			in.Candidates = reversed

			got, err := Stage1Pick(stage1Stream(t, tc.SeedHex, tc.Label, tc.LabelSource), in)
			if err != nil {
				t.Fatalf("Stage1Pick over reversed candidates: %v", err)
			}
			if !equalInts(got.Weights, tc.Expected.Weights) {
				t.Errorf("reversed input changed the weights: %v, want %v", got.Weights, tc.Expected.Weights)
			}
			if strings.Join(got.Live, ",") != strings.Join(tc.Expected.Live, ",") {
				t.Errorf("reversed input changed the pick: %v, want %v", got.Live, tc.Expected.Live)
			}
		})
	}
}

// Stage 1 must not reorder the caller's slice, for the same reason Stage 2 must not: two
// consecutive picks over the same pool would otherwise be observably different operations.
func TestStage1PickDoesNotMutateTheCallerSlice(t *testing.T) {
	v := loadStage1(t)
	tc := v.Cases[0]
	in := toInput(t, tc)
	before := make([]string, len(in.Candidates))
	for i, c := range in.Candidates {
		before[i] = c.AwardID
	}
	if _, err := Stage1Pick(stage1Stream(t, tc.SeedHex, tc.Label, tc.LabelSource), in); err != nil {
		t.Fatalf("Stage1Pick: %v", err)
	}
	for i, c := range in.Candidates {
		if c.AwardID != before[i] {
			t.Errorf("the caller's candidate slice was reordered at %d: %q, was %q", i, c.AwardID, before[i])
		}
	}
}

// ── the shared refusal list ────────────────────────────────────────────────────

func TestVectorStage1Refusals(t *testing.T) {
	v := loadStage1(t)
	for _, bad := range v.Refusals {
		t.Run(bad.Why, func(t *testing.T) {
			in := Stage1Input{
				Candidates: toCandidates(t, bad.Candidates, false),
				Players:    toLadderPlayers(t, bad.Players),
				Shelf:      bad.Shelf,
				Table:      bad.WeightTable,
				LiveCount:  bad.LiveCount,
				Ladder:     ladderFor(bad.Ladder),
			}
			s := stage1Stream(t, bad.SeedHex, bad.Label, bad.LabelSource)

			got, err := Stage1Pick(s, in)
			if err == nil {
				t.Fatalf("Stage1Pick returned %+v, want an error (%s)", got, bad.Why)
			}
			// ⭐ THE ERROR IS TYPED, not merely non-nil. 6-4a measured the cost of the alternative:
			// with every refusal a bare string, `err != nil` was the only discriminator, so a
			// mutation making validation reject EVERY input left all sixteen rows passing.
			if !errors.Is(err, ErrStage1) {
				t.Errorf("refusal is not an ErrStage1 (%T: %v) — it failed for some other reason", err, err)
			}

			// ⭐ AND THE TWO REFUSAL KINDS STAY DISTINGUISHABLE. A tie is the FR-29 seam Story 6.5
			// fills; an invalid input is a bug to fix. Collapsing them is what would let "Stage 1
			// refuses everything" pass this whole list.
			switch bad.RefusalKind {
			case "tie":
				var tie *Stage1TieError
				if !errors.As(err, &tie) {
					t.Fatalf("a TIE refusal is not a *Stage1TieError: %T %v", err, err)
				}
				if !errors.Is(err, ErrStage1Tie) {
					t.Errorf("a TIE refusal is not an ErrStage1Tie: %v", err)
				}
				if !strings.Contains(err.Error(), "6.5") {
					t.Errorf("the tie refusal does not name Story 6.5: %v", err)
				}
				// ⭐ IT CARRIES THE TIE, not just a message: Story 6.5 must be able to read the
				// tied set and the equality without parsing English.
				if len(tie.Tied) < 2 || tie.AwardID == "" || tie.Reason == "" {
					t.Errorf("the tie refusal does not carry the tie: %+v", tie)
				}
				if tie.Detail() != bad.Detail {
					t.Errorf("tie detail = %q, vector declares %q", tie.Detail(), bad.Detail)
				}
			case "invalid":
				if errors.Is(err, ErrStage1Tie) {
					t.Errorf("an INVALID-input refusal was reported as a tie: %v", err)
				}
				// ⭐⭐ THE REFUSAL NAMES WHICH INPUT IT REJECTED, and this is what makes each row
				// specific. Story 6-4b's mutation pass found the alternative's cost: deleting the
				// NEGATIVE-SHELF guard still produced a typed refusal of the right KIND (arrived
				// at by NaN three functions downstream) and survived the whole TypeScript suite.
				var bad1 *Stage1InvalidError
				if !errors.As(err, &bad1) {
					t.Fatalf("an INVALID refusal is not a *Stage1InvalidError: %T %v", err, err)
				}
				if bad1.Detail != bad.Detail {
					t.Errorf("refusal detail = %q, vector declares %q — the refusal came from a "+
						"different guard than the row is about", bad1.Detail, bad.Detail)
				}
			default:
				t.Fatalf("the vector declares a refusal_kind this suite does not check: %q", bad.RefusalKind)
			}

			// ⛔ W7 — VALIDATION RUNS BEFORE ANY DRAW. A refusal that had consumed a byte would
			// make the stream position depend on the failure, so retrying after fixing the config
			// would produce a DIFFERENT ceremony from the same seed. The generator asserts this
			// too; here it is asserted against the shipped implementation.
			if s.Consumed() != 0 {
				t.Errorf("the refusal consumed %d stream byte(s) — validation must run BEFORE the first draw",
					s.Consumed())
			}
		})
	}
}

// The vector's declared refusal kinds and this package's sentinels must be the same set.
func TestVectorStage1RefusalKindsAreBothExercised(t *testing.T) {
	v := loadStage1(t)
	want := []string{"tie", "invalid"}
	if strings.Join(v.RefusalKinds, ",") != strings.Join(want, ",") {
		t.Errorf("refusal_kinds = %v, want %v", v.RefusalKinds, want)
	}
	seen := map[string]int{}
	for _, r := range v.Refusals {
		seen[r.RefusalKind]++
	}
	for _, k := range want {
		if seen[k] == 0 {
			t.Errorf("no refusal row of kind %q — the kind is declared and never exercised", k)
		}
	}
	// ErrStage1Tie must wrap ErrStage1, so one check answers "did Stage 1 refuse".
	if !errors.Is(ErrStage1Tie, ErrStage1) {
		t.Error("ErrStage1Tie does not wrap ErrStage1")
	}

	// The vector's declared detail set and this package's constants must be the same set — if
	// they drift, the two runtimes disagree about what a refusal can even be ABOUT.
	//
	// ⭐ ALL NINE, INCLUDING THE TWO NO ROW CAN CARRY. The 6-4b code review found this list pinning
	// only seven while the package declared nine, so DetailStream and DetailInternal — both
	// reachable, both emitted — were unpinned on the Go side and absent from TypeScript's declared
	// set entirely, which made `detail` a "closed set" that was not closed. A tenth added on one
	// side alone would have reddened nothing.
	// ⭐ `DetailLadder` IS APPENDED BY STORY 6.5, and this pin reddening is exactly what it is for.
	// "The injected ladder ran and refused" is a different fact from "no ladder was injected"
	// (DetailTie) and from "the award or the snapshot is malformed" (DetailStage2); reusing either
	// label to avoid growing the set would rebuild 6-4b's closed-set-that-was-not-closed by choice.
	wantDetails := []string{
		DetailWeightTable, DetailShelf, DetailPool, DetailLiveCount,
		DetailTotalWeight, DetailStage2, DetailTie, DetailStream, DetailInternal, DetailLadder,
	}
	if strings.Join(v.RefusalDetails, ",") != strings.Join(wantDetails, ",") {
		t.Errorf("refusal_details = %v, package has %v", v.RefusalDetails, wantDetails)
	}
	// …and every ROW-REPRESENTABLE detail must be exercised by a row, or it is a label nothing
	// enforces.
	//
	// ⚠ THE LAST TWO ARE DELIBERATELY EXCLUDED FROM THAT REQUIREMENT. A row is a set of INPUTS;
	// "no stream was supplied" and "an invariant broke" are not inputs, so no row can produce
	// them. They are covered instead by TestStage1PickRefusesANilStream and by the unreachable
	// arms being loud. The generator enforces the same split from the other side: it refuses to
	// write a row whose detail is one of these two.
	//
	// ⭐ `DetailLadder` IS ROW-REPRESENTABLE, unlike the two above it: an injected ladder handed a
	// tied award whose `secondary_stat` is outside the vocabulary is a set of INPUTS, and the
	// appended refusal row is exactly that. So the unrepresentable pair stays exactly two, and the
	// representable list is the first seven PLUS this one — spelled out rather than re-sliced,
	// because a slice bound is the kind of thing a later append silently shifts.
	rowRepresentable := append(append([]string{}, wantDetails[:7]...), DetailLadder)
	unrepresentable := []string{DetailStream, DetailInternal}
	seenDetail := map[string]int{}
	for _, r := range v.Refusals {
		seenDetail[r.Detail]++
		if r.Detail == "" {
			t.Errorf("refusal row %q carries no detail", r.Why)
		}
	}
	for _, d := range rowRepresentable {
		if seenDetail[d] == 0 {
			t.Errorf("no refusal row of detail %q — the label is declared and never exercised", d)
		}
	}
	for _, d := range unrepresentable {
		if seenDetail[d] != 0 {
			t.Errorf("a refusal row carries detail %q, which no set of INPUTS can produce — the row "+
				"is not testing what it claims", d)
		}
	}
}

// ⭐⭐ STAGE 1's TWO `internal` PORT GUARDS, DRIVEN AT LAST — BY A STUB `Ladder` (Story 6-5b, T10).
//
// Both suites injected either the REAL `FR29Ladder` or nothing at all, so the two guards on the
// LADDER'S OWN OUTPUT were unreachable from any test in either language: `validateLadder` refuses an
// empty tied member and `bestSurvivors` refuses an empty best set, so the shipped ladder cannot
// produce either shape. But `Ladder` is an INJECTED PORT — 6.6 drives it, 6.9's verifier reimplements
// it, and a third-party or mock implementation reaches exactly these two arms. That is the whole
// reason the guards were written; nothing exercised them.
//
// What each one prevents, and why "unreachable" is not a reason to leave it undriven:
//
//   - `{shared, winners: []}` — a trophy awarded to NOBODY. Without the guard `out.Winners[0]` panics
//     in Go and reads `undefined` in TypeScript: one input, two failure kinds across the seam.
//   - `{winner, steamid64: ""}` — the empty id misses the shelf map, reads Go's zero value, and
//     silently draws INDEX 0, the HEAVIEST luck weight. A plausible number, nothing red.
//
// ⚠ These are LOCAL rows, not vector rows, and deliberately so: a stub port is not a set of INPUTS,
// so no row in `stage1-pick.json` can carry one — the same reason `internal` is declared and not
// row-representable in the first place.
type stubLadder struct{ out Outcome }

func (s stubLadder) Resolve(Award, Outcome, []SnapshotPlayer) (Outcome, error) { return s.out, nil }

func TestStage1RefusesAMalformedOutcomeFromAnInjectedLadderPort(t *testing.T) {
	// A roster with a genuine two-way tie, so the ladder port is actually consulted.
	tie := []SnapshotPlayer{
		{SteamID64: "76561198000000011", RoundsPlayed: big.NewInt(30), Kills: big.NewInt(20),
			Volume: map[string]*big.Int{"knife_kills": big.NewInt(7)}},
		{SteamID64: "76561198000000022", RoundsPlayed: big.NewInt(30), Kills: big.NewInt(20),
			Volume: map[string]*big.Int{"knife_kills": big.NewInt(7)}},
	}
	candidate := Stage1Candidate{
		AwardID:  "aw-knife",
		Priority: 1,
		Award: Award{
			DecidingStat: "knife_kills", Class: ClassVolume, Direction: DirectionMax,
		},
	}

	cases := []struct {
		name string
		out  Outcome
		why  string
	}{
		{
			name: "a SHARED outcome with ZERO winners",
			out:  Outcome{Kind: KindShared, Winners: []string{}, LadderExitStep: LadderExitShared},
			why:  "a trophy awarded to nobody — `Winners[0]` panics without the guard",
		},
		{
			name: "a WINNER outcome with an EMPTY steamid64",
			out:  Outcome{Kind: KindWinner, SteamID64: "", LadderExitStep: LadderExitAchieved},
			why:  "the empty id misses the shelf and silently draws the HEAVIEST weight",
		},
		{
			// ⛔⛔ THE THIRD MALFORMED SHAPE, AND THE ONE THIS TABLE STOPPED ONE ELEMENT SHORT OF.
			// The `winner` arm's comment has claimed to be "symmetric with the shared arm's
			// empty-winners guard" since 6-4b; it was not — the shared arm checked only that the
			// SLICE was non-empty, so an empty id among genuine co-winners read `shelf[""]`, got
			// Go's zero value by the documented absent-is-shelf-0 rule, and `min` made 0 the index
			// for the WHOLE co-win: table[0] = 100, the HEAVIEST luck weight. `min` is why this is
			// worse than the single-winner case — one malformed id poisons the aggregate no matter
			// what the other co-winners' real shelves hold.
			// (Story 6-5b code review, 2026-08-06; Cuatro authorised the source edit at review.)
			name: "a SHARED outcome with an EMPTY steamid64 among real co-winners",
			out: Outcome{
				Kind:           KindShared,
				Winners:        []string{"", "76561198000000022"},
				LadderExitStep: LadderExitShared,
			},
			why: "the empty id reads shelf 0 and `min` drags the WHOLE co-win to the heaviest weight",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := Stage1Weights(Stage1Input{
				Candidates: []Stage1Candidate{candidate},
				Players:    tie,
				Shelf:      map[string]int{},
				Table:      []int{100, 40, 16, 6, 2, 1},
				LiveCount:  1,
				Ladder:     stubLadder{out: tc.out},
			})
			if err == nil {
				t.Fatalf("Stage 1 accepted %s — %s", tc.name, tc.why)
			}
			var invalid *Stage1InvalidError
			if !errors.As(err, &invalid) {
				t.Fatalf("refusal is not a *Stage1InvalidError: %v", err)
			}
			if invalid.Detail != DetailInternal {
				t.Errorf("detail = %q, want %q: %v", invalid.Detail, DetailInternal, err)
			}
		})
	}

	// ⭐ THE CONTROL. A stub returning a WELL-FORMED outcome must be ACCEPTED, or the two assertions
	// above would pass for a stub that is simply never consulted — the vacuity this whole pass exists
	// to close.
	weights, err := Stage1Weights(Stage1Input{
		Candidates: []Stage1Candidate{candidate},
		Players:    tie,
		Shelf:      map[string]int{"76561198000000022": 1},
		Table:      []int{100, 40, 16, 6, 2, 1},
		LiveCount:  1,
		Ladder: stubLadder{out: Outcome{
			Kind: KindWinner, SteamID64: "76561198000000022", LadderExitStep: LadderExitAchieved,
		}},
	})
	if err != nil {
		t.Fatalf("the control stub was refused: %v", err)
	}
	if len(weights) != 1 || weights[0] != 40 {
		t.Errorf("the control stub's winner weighed %v, want [40] — shelf 1 indexes table[1]", weights)
	}

	// ⭐ THE SHARED-ARM CONTROL, for the same reason: without it the new empty-id row above could be
	// satisfied by a `shared` arm that refused EVERY co-win. A well-formed pair must still weigh at
	// the MINIMUM shelf across the co-winners — shelf 0 for the unlisted player, so table[0] = 100.
	sharedWeights, err := Stage1Weights(Stage1Input{
		Candidates: []Stage1Candidate{candidate},
		Players:    tie,
		Shelf:      map[string]int{"76561198000000022": 1},
		Table:      []int{100, 40, 16, 6, 2, 1},
		LiveCount:  1,
		Ladder: stubLadder{out: Outcome{
			Kind:           KindShared,
			Winners:        []string{"76561198000000011", "76561198000000022"},
			LadderExitStep: LadderExitShared,
		}},
	})
	if err != nil {
		t.Fatalf("the well-formed SHARED control stub was refused: %v", err)
	}
	if len(sharedWeights) != 1 || sharedWeights[0] != 100 {
		t.Errorf("the shared control weighed %v, want [100] — the MINIMUM co-winner shelf is 0", sharedWeights)
	}
}

// ── the vector must CONTAIN the rows that carry the story's weight ─────────────
//
// ⭐ GUARD THE GUARDS. 6-4a's headline review finding was that its own coverage flags were
// satisfied by rows UNRELATED to the property they named — `sawFloatDivergence` was flipped by a
// zero-denominator row, so the story's headline case could have been deleted with every gate
// green. So every flag below is checked against THE SPECIFIC ROW it claims, by name, and the
// property is re-derived from the row's own data rather than assumed from its title.

func TestVectorStage1CoversTheHardCases(t *testing.T) {
	v := loadStage1(t)
	byName := map[string]stage1VectorCase{}
	for _, c := range v.Cases {
		byName[c.Name] = c
	}
	get := func(name string) stage1VectorCase {
		c, ok := byName[name]
		if !ok {
			t.Fatalf("the vector no longer carries the %q case", name)
		}
		return c
	}

	// W3 — `r` sits EXACTLY on the first candidate's cumulative boundary, and the SECOND
	// candidate is the one drawn. Both halves matter: an `r` on a boundary that still picked the
	// first would mean the implementation used `>=`.
	boundary := get("r-lands-exactly-on-a-cumulative-boundary")
	if len(boundary.Expected.Draws) != 1 {
		t.Fatal("the boundary case must be a single draw")
	}
	if got, want := boundary.Expected.Draws[0].R, uint64(boundary.Expected.Weights[0]); got != want {
		t.Errorf("the boundary case's r = %d but the first cumulative is %d — it no longer sits ON "+
			"the boundary, so `cum > r` versus `cum >= r` is untested by ANY row", got, want)
	}
	if len(boundary.Expected.Live) != 1 || boundary.Expected.Live[0] == firstByPriority(boundary).AwardID {
		t.Errorf("the boundary case drew %v, which is the FIRST candidate — under `cum > r` the "+
			"second must win, so this row would pass under `>=` too", boundary.Expected.Live)
	}
	// …and no OTHER row may quietly take its place: if a second row also sat on a boundary, this
	// one could be deleted and the property would survive by accident rather than by design.
	onBoundary := 0
	for _, c := range v.Cases {
		if len(c.Expected.Draws) > 0 && c.Expected.Draws[0].R == uint64(c.Expected.Weights[0]) {
			onBoundary++
		}
	}
	if onBoundary != 1 {
		t.Errorf("%d rows sit exactly on a first cumulative boundary — this test names ONE, so the "+
			"case-name pin no longer protects the property it claims", onBoundary)
	}

	// DECISION G, both halves, and they must genuinely differ in BYTES.
	oneCand := get("single-candidate-pool-still-draws-and-consumes-a-byte")
	if len(oneCand.Candidates) != 1 {
		t.Error("the single-candidate row no longer has exactly one candidate")
	}
	if oneCand.Expected.Draws[0].N <= 1 || oneCand.Expected.Draws[0].BytesConsumedAfter == 0 {
		t.Errorf("the single-candidate row draws n=%d consuming %d bytes — DECISION G says a "+
			"one-candidate pool of weight > 1 STILL draws and STILL moves the stream",
			oneCand.Expected.Draws[0].N, oneCand.Expected.Draws[0].BytesConsumedAfter)
	}
	zeroByte := get("total-weight-one-is-the-only-zero-byte-draw")
	if zeroByte.Expected.TotalWeight != 1 || zeroByte.Expected.Draws[0].N != 1 ||
		zeroByte.Expected.Draws[0].BytesConsumedAfter != 0 {
		t.Errorf("the zero-byte row is total_weight=%d n=%d bytes=%d — E1's zero-byte draw must "+
			"arise from total_weight == 1, never from the pool SIZE",
			zeroByte.Expected.TotalWeight, zeroByte.Expected.Draws[0].N,
			zeroByte.Expected.Draws[0].BytesConsumedAfter)
	}

	// W4 — the re-draw's n is the RECOMPUTED total, and it really shrank by the removed weight.
	redraw := get("live-count-2-redraws-against-the-recomputed-total")
	if len(redraw.Expected.Draws) != 2 {
		t.Fatal("the re-draw row must make exactly two draws")
	}
	d0, d1 := redraw.Expected.Draws[0], redraw.Expected.Draws[1]
	if d1.N >= d0.N {
		t.Errorf("the re-draw's n = %d did not shrink from %d — re-drawing against the ORIGINAL "+
			"total would leave it unchanged", d1.N, d0.N)
	}
	if d1.BytesConsumedAfter <= d0.BytesConsumedAfter {
		t.Error("the re-draw consumed no bytes — reusing the first draw's remainder makes no second draw")
	}
	if want := d0.N - uint64(weightOf(redraw, redraw.Expected.Live[0])); d1.N != want {
		t.Errorf("the re-draw's n = %d, want %d (the first total minus the removed candidate's weight)", d1.N, want)
	}
	// …and its first draw REJECTED inside uniform_int, so a Stage-1 pick cannot assume one byte.
	if d0.BytesConsumedAfter <= 1 {
		t.Errorf("the re-draw row's first draw consumed %d byte(s) — it is also the row that proves "+
			"a Stage-1 draw inherits rejection sampling", d0.BytesConsumedAfter)
	}

	// W1 — the frozen shelf. The second draw's n must be the FROZEN total (first total minus one
	// weight), not the total a recomputed shelf would produce.
	frozen := get("the-shelf-is-frozen-across-the-picks-of-one-spin")
	if len(frozen.Expected.Draws) != 2 {
		t.Fatal("the frozen-shelf row must make exactly two draws")
	}
	if !allEqual(frozen.Expected.Weights) || len(frozen.Expected.Weights) < 3 {
		t.Errorf("the frozen-shelf row's weights are %v — it needs three or more EQUAL weights, or "+
			"a recomputed shelf would be indistinguishable from a frozen one", frozen.Expected.Weights)
	}
	// ⭐ …AND EQUAL WEIGHTS ARE NOT ENOUGH — that was this guard's whole defect. The 6-4b code
	// review found the check above (plus the n arithmetic below) satisfied by ANY roster with real
	// winners, so the fixture could have been swapped for one where each candidate has a DIFFERENT
	// winner and every gate would have stayed green while the row silently stopped discriminating.
	// The row only kills the recomputed-shelf mutation because ONE player wins ALL of the
	// candidates: crediting the first pick to its winner is then what reweights the survivors from
	// 100 to 40. That is an INPUT property, so it is re-derived here from the row's own players,
	// through the real Stage 2 — the same check the generator now runs at the anchor.
	frozenWinners := map[string]struct{}{}
	for _, c := range toCandidates(t, frozen.Candidates, true) {
		out, err := ResolveStage2(c.Award, toLadderPlayers(t, frozen.Players))
		if err != nil {
			t.Fatalf("the frozen-shelf row's candidate %s no longer resolves: %v", c.AwardID, err)
		}
		if out.Kind != KindWinner {
			t.Errorf("the frozen-shelf row's candidate %s resolves to %q, not a winner — a "+
				"no-winner outcome has no shelf, so recomputing one could not change its weight "+
				"and the row would stop testing W1", c.AwardID, out.Kind)
			continue
		}
		frozenWinners[out.SteamID64] = struct{}{}
	}
	if len(frozenWinners) != 1 {
		t.Errorf("the frozen-shelf row's candidates resolve to %d distinct winners — it needs "+
			"exactly ONE sweeper, or a shelf recomputed between the picks would produce the same "+
			"weights as a frozen one and the row would pass under the mutation it exists to kill",
			len(frozenWinners))
	}
	if want := frozen.Expected.Draws[0].N - uint64(frozen.Expected.Weights[0]); frozen.Expected.Draws[1].N != want {
		t.Errorf("the frozen-shelf row's second n = %d, want %d — a shelf recomputed after the "+
			"first pick would reweight the survivors and draw over a smaller total",
			frozen.Expected.Draws[1].N, want)
	}

	// W8 — the clamp really clamps: some shelf entry must exceed table_max, and some player must
	// be absent from the map entirely.
	mapping := get("shelf-to-weight-mapping-with-clamp-and-empty-shelf")
	tableMax := len(mapping.WeightTable) - 1
	sawPastMax, sawMid := false, false
	for _, size := range mapping.Shelf {
		if size > tableMax {
			sawPastMax = true
		}
		if size > 0 && size < tableMax {
			sawMid = true
		}
	}
	if !sawPastMax {
		t.Error("no shelf entry in the mapping row exceeds table_max — min(shelf, table_max) is untested")
	}
	if !sawMid {
		t.Error("no shelf entry in the mapping row sits mid-table — only 0 and the clamp are exercised")
	}
	if !containsInt(mapping.Expected.Weights, mapping.WeightTable[0]) {
		t.Error("no candidate in the mapping row weighs the heaviest entry — the empty shelf is untested")
	}
	if !containsInt(mapping.Expected.Weights, mapping.WeightTable[tableMax]) {
		t.Error("no candidate in the mapping row weighs the lightest entry — the clamp's RESULT is untested")
	}

	// ⭐ Without this row, "weighted pick" and "argmax over the weights" are indistinguishable.
	notHeaviest := get("heaviest-weighted-candidate-is-not-the-one-drawn")
	if maxInt(notHeaviest.Expected.Weights) == weightOf(notHeaviest, notHeaviest.Expected.Live[0]) {
		t.Error("the not-heaviest row drew the heaviest-weighted candidate — an implementation that " +
			"ignored the stream entirely would pass every row in this file")
	}

	// W2 — the out-of-order row really is supplied out of order.
	unordered := get("candidates-supplied-out-of-priority-order")
	if isAscendingByPriority(unordered) {
		t.Error("the out-of-order row's candidates are supplied in ASCENDING priority — the " +
			"selector's own sort is not exercised by it")
	}

	// DECISION F — both no-winner arms are present, and each weighs the HEAVIEST entry.
	noEligible := get("every-candidate-has-no-eligible-players-and-weights-heaviest")
	// ⭐ THE LOOP BELOW PASSES ON ZERO ITERATIONS, so the length is asserted first. The 6-4b review
	// found no suite checking it: an empty `weights` would have left DECISION F's
	// no_eligible_players arm unasserted with both suites green.
	if len(noEligible.Expected.Weights) < 2 {
		t.Errorf("the no_eligible_players row has %d weights — it needs at least two, or the loop "+
			"below asserts nothing", len(noEligible.Expected.Weights))
	}
	for _, w := range noEligible.Expected.Weights {
		if w != noEligible.WeightTable[0] {
			t.Errorf("a no_eligible_players candidate weighs %d, want the heaviest %d — DECISION F "+
				"gives a no-winner outcome the maximal EMPTY shelf", w, noEligible.WeightTable[0])
		}
	}
	// ⭐ …and the OUTCOME KIND the row is named for is re-derived from its own inputs. "every
	// weight is table[0]" is equally true of a roster whose players simply WIN with an empty
	// shelf, so without this the no_eligible_players branch could go untested while AC3 still
	// claimed it covered — the 6-4b review's finding, and the same class as the frozen-shelf gap.
	for _, c := range toCandidates(t, noEligible.Candidates, true) {
		out, err := ResolveStage2(c.Award, toLadderPlayers(t, noEligible.Players))
		if err != nil {
			t.Fatalf("the no_eligible_players row's candidate %s no longer resolves: %v", c.AwardID, err)
		}
		if out.Kind != KindNoEligiblePlayers {
			t.Errorf("the no_eligible_players row's candidate %s resolves to %q — the row is named "+
				"for a branch it no longer exercises", c.AwardID, out.Kind)
		}
	}
	noAwardable := get("no-awardable-value-weights-as-an-empty-shelf")
	if !containsInt(noAwardable.Expected.Weights, noAwardable.WeightTable[0]) {
		t.Error("the no_awardable_value row has no candidate at the heaviest weight")
	}
	// …and it must NOT be all-heaviest, or it would be indistinguishable from the row above.
	if allEqual(noAwardable.Expected.Weights) {
		t.Error("the no_awardable_value row weighs every candidate identically — it cannot then " +
			"distinguish DECISION F's no-winner arm from an ordinary resolution")
	}

	// The pool-draining row exercises W6's upper edge.
	drain := get("live-count-equal-to-the-whole-pool-drains-it-in-draw-order")
	if drain.LiveCount != len(drain.Candidates) || drain.LiveCount < 2 {
		t.Errorf("the draining row has live_count %d over %d candidates", drain.LiveCount, len(drain.Candidates))
	}
	// ⭐ "live is in DRAW order" IS CARRIED BY A NAMED ROW, not by an any-row scan.
	//
	// This used to be a scan over every case looking for one whose live differed from priority
	// order. The 6-4b code review found two things wrong with that. First, the draining row's own
	// note claimed to be that row and is not — its draw order IS 1,2,3,4, so it never
	// discriminated. Second, an any-row scan is exactly the "flag satisfied by a row unrelated to
	// the property it names" shape 6-4a's headline finding was about: if the one row that really
	// carries the property ever landed in priority order, the flag would go vacuous while the
	// case-name pin stayed green. So the row is named, and the scan is kept only to assert that it
	// is the ONLY one — which is what makes deleting it impossible to do quietly.
	drawOrderRow := get("live-count-2-redraws-against-the-recomputed-total")
	if len(drawOrderRow.Expected.Live) < 2 || sameOrderAsPriority(drawOrderRow) {
		t.Errorf("the re-draw row's live is %v, which is ascending priority order — it is the row "+
			"that proves `live` is in DRAW order, and a selector that sorted its output by "+
			"priority would now pass every row in the file", drawOrderRow.Expected.Live)
	}
	differing := 0
	for _, c := range v.Cases {
		if len(c.Expected.Live) > 1 && !sameOrderAsPriority(c) {
			differing++
		}
	}
	if differing != 1 {
		t.Errorf("%d rows return `live` in a non-priority order — this test names ONE, so the "+
			"case-name pin no longer protects the property it claims", differing)
	}
	// ⚠ The draining row is NOT that row: its four picks come out in priority order by chance.
	// Asserted so nobody restores the note that used to claim otherwise.
	if !sameOrderAsPriority(drain) {
		t.Error("the draining row's live is no longer in priority order — if that is deliberate, " +
			"the `differing != 1` count above and the row's note both need updating")
	}
}

// ── W1/W2/W3/W5 as direct table assertions, independent of the vector ──────────
//
// The vector proves the two runtimes agree. These prove the RULE, over inputs chosen to make one
// specific mutation fail — so a rule with no vector row still cannot rot silently.

func TestW3CumulativeWalkIsStrictlyGreater(t *testing.T) {
	// Weights [3, 2] over total 5. Every r maps to exactly one candidate under `cum > r`:
	// r in {0,1,2} -> the first, {3,4} -> the second. Under `cum >= r` the boundary r = 3 would
	// go to the first instead, handing it 4/5 of the mass.
	players := []SnapshotPlayer{
		s1Player("10", map[string]int64{"knife_kills": 5, "hs_kills": 1}),
		s1Player("20", map[string]int64{"knife_kills": 1, "hs_kills": 5}),
	}
	in := Stage1Input{
		Candidates: []Stage1Candidate{
			{AwardID: "first", Priority: 1, Award: s1Award("knife_kills")},
			{AwardID: "second", Priority: 2, Award: s1Award("hs_kills")},
		},
		Players:   players,
		Shelf:     map[string]int{"20": 1},
		Table:     []int{3, 2},
		LiveCount: 1,
	}
	w, err := Stage1Weights(in)
	if err != nil {
		t.Fatalf("Stage1Weights: %v", err)
	}
	if !equalInts(w, []int{3, 2}) {
		t.Fatalf("weights = %v, want [3 2]", w)
	}
	for r := uint64(0); r < 5; r++ {
		want := "first"
		if r >= 3 {
			want = "second"
		}
		if got := walkForR(w, r); got != want {
			t.Errorf("r = %d selected index %s, want %s", r, got, want)
		}
	}
}

// walkForR reproduces only the WALK, so the boundary rule can be exercised at every r without
// hunting for a seed whose draw lands there.
func walkForR(weights []int, r uint64) string {
	cum := uint64(0)
	for i, w := range weights {
		cum += uint64(w)
		if cum > r {
			if i == 0 {
				return "first"
			}
			return "second"
		}
	}
	return "none"
}

func TestW1ShelfIsNotRecomputedBetweenPicks(t *testing.T) {
	// One player wins all three candidates from an empty shelf, so every weight is the heaviest.
	// Frozen: the second draw runs over 200. Recomputed (crediting the first pick): over 80.
	players := []SnapshotPlayer{
		s1Player("10", map[string]int64{"knife_kills": 9, "hs_kills": 9, "wallbang_kills": 9}),
		s1Player("20", map[string]int64{"knife_kills": 1, "hs_kills": 1, "wallbang_kills": 1}),
	}
	in := Stage1Input{
		Candidates: []Stage1Candidate{
			{AwardID: "a", Priority: 1, Award: s1Award("knife_kills")},
			{AwardID: "b", Priority: 2, Award: s1Award("hs_kills")},
			{AwardID: "c", Priority: 3, Award: s1Award("wallbang_kills")},
		},
		Players:   players,
		Shelf:     map[string]int{},
		Table:     []int{100, 40, 16},
		LiveCount: 2,
	}
	seed, err := DecodeSeed(realSeedHex)
	if err != nil {
		t.Fatalf("DecodeSeed: %v", err)
	}
	label, err := Stage1Label(1)
	if err != nil {
		t.Fatalf("Stage1Label: %v", err)
	}
	got, err := Stage1Pick(mustStream(t, seed, label), in)
	if err != nil {
		t.Fatalf("Stage1Pick: %v", err)
	}
	if !equalInts(got.Weights, []int{100, 100, 100}) {
		t.Fatalf("weights = %v, want [100 100 100]", got.Weights)
	}
	if got.Draws[0].N != 300 {
		t.Errorf("first draw n = %d, want 300", got.Draws[0].N)
	}
	if got.Draws[1].N != 200 {
		t.Errorf("second draw n = %d, want 200 — a shelf recomputed after the first pick would "+
			"reweight the survivors to 40 each and draw over 80", got.Draws[1].N)
	}
}

func TestW5NoSingleCandidateShortCircuit(t *testing.T) {
	players := []SnapshotPlayer{s1Player("10", map[string]int64{"knife_kills": 5})}
	base := Stage1Input{
		Candidates: []Stage1Candidate{{AwardID: "only", Priority: 1, Award: s1Award("knife_kills")}},
		Players:    players,
		Table:      []int{100, 1},
		LiveCount:  1,
	}
	seed, err := DecodeSeed(realSeedHex)
	if err != nil {
		t.Fatalf("DecodeSeed: %v", err)
	}
	label, err := Stage1Label(1)
	if err != nil {
		t.Fatalf("Stage1Label: %v", err)
	}

	// Weight 100 on a ONE-candidate pool: the pick is a foregone conclusion, the byte is not.
	heavy := base
	heavy.Shelf = map[string]int{}
	s := mustStream(t, seed, label)
	got, err := Stage1Pick(s, heavy)
	if err != nil {
		t.Fatalf("Stage1Pick: %v", err)
	}
	if got.Draws[0].N != 100 {
		t.Errorf("n = %d, want 100 — DECISION G draws over total_weight, never over the pool size", got.Draws[0].N)
	}
	if s.Consumed() == 0 {
		t.Error("a one-candidate pool of weight 100 consumed ZERO bytes — that is the special case " +
			"DECISION G forbids, and it desynchronises every later spin")
	}

	// …and total_weight == 1 is the ONLY zero-byte draw.
	light := base
	light.Shelf = map[string]int{"10": 7}
	s2 := mustStream(t, seed, label)
	got2, err := Stage1Pick(s2, light)
	if err != nil {
		t.Fatalf("Stage1Pick: %v", err)
	}
	if got2.TotalWeight != 1 || got2.Draws[0].N != 1 || s2.Consumed() != 0 {
		t.Errorf("total=%d n=%d consumed=%d, want 1/1/0", got2.TotalWeight, got2.Draws[0].N, s2.Consumed())
	}
}

func TestW9TieRefusesAndNoWinnerWeightsHeaviest(t *testing.T) {
	// DECISION F, both arms, over the same table.
	tied := []SnapshotPlayer{
		s1Player("10", map[string]int64{"knife_kills": 7}),
		s1Player("20", map[string]int64{"knife_kills": 7}),
	}
	in := Stage1Input{
		Candidates: []Stage1Candidate{{AwardID: "a", Priority: 1, Award: s1Award("knife_kills")}},
		Players:    tied,
		Shelf:      map[string]int{"10": 3, "20": 0},
		Table:      []int{100, 40, 16, 6},
		LiveCount:  1,
	}
	if _, err := Stage1Weights(in); !errors.Is(err, ErrStage1Tie) {
		t.Errorf("a tied provisional winner did not refuse as ErrStage1Tie: %v", err)
	} else if !strings.Contains(err.Error(), "6.5") {
		t.Errorf("the tie refusal does not name Story 6.5: %v", err)
	}

	// ⛔ The minimum shelf over the tied set is 0 -> weight 100, and byte-lex-first is "10" ->
	// shelf 3 -> weight 6. Both are plausible answers, and both are the silent argmax DECISION B
	// forbids. Neither may be returned.
	if w, err := Stage1Weights(in); err == nil {
		t.Errorf("Stage 1 invented a weight %v for a tie — min-shelf and byte-lex-first are each a "+
			"silent argmax that Story 6.5 would later contradict", w)
	}

	// A no-winner outcome, by contrast, weighs the HEAVIEST — no player, no shelf, empty shelf.
	allZero := []SnapshotPlayer{
		s1Player("10", map[string]int64{"knife_kills": 0}),
		s1Player("20", map[string]int64{"knife_kills": 0}),
	}
	noAwardable := in
	noAwardable.Players = allZero
	w, err := Stage1Weights(noAwardable)
	if err != nil {
		t.Fatalf("a no_awardable_value outcome refused: %v — DECISION F weights it as an empty shelf", err)
	}
	if !equalInts(w, []int{100}) {
		t.Errorf("no_awardable_value weighted %v, want [100] (the heaviest)", w)
	}

	// …and so does no_eligible_players, reached by a different route.
	noEligible := in
	noEligible.Candidates = []Stage1Candidate{
		{AwardID: "a", Priority: 1, Award: Award{
			DecidingStat: "knife_kills", Class: ClassVolume, Direction: DirectionMax,
			FloorRounds: 24, FloorKills: 20,
		}},
	}
	noEligible.Players = []SnapshotPlayer{s1PlayerAt("10", 10, 6, map[string]int64{"knife_kills": 3})}
	w, err = Stage1Weights(noEligible)
	if err != nil {
		t.Fatalf("a no_eligible_players outcome refused: %v", err)
	}
	if !equalInts(w, []int{100}) {
		t.Errorf("no_eligible_players weighted %v, want [100]", w)
	}
}

func TestStage1RefusesAMalformedTableBeforeDrawing(t *testing.T) {
	players := []SnapshotPlayer{s1Player("10", map[string]int64{"knife_kills": 5})}
	cands := []Stage1Candidate{{AwardID: "a", Priority: 1, Award: s1Award("knife_kills")}}
	seed, err := DecodeSeed(realSeedHex)
	if err != nil {
		t.Fatalf("DecodeSeed: %v", err)
	}
	label, err := Stage1Label(1)
	if err != nil {
		t.Fatalf("Stage1Label: %v", err)
	}

	for _, tc := range []struct {
		name  string
		table []int
	}{
		{"empty", []int{}},
		{"nil", nil},
		{"contains zero", []int{100, 40, 0}},
		{"contains a negative", []int{100, 40, -5}},
		{"equal adjacent entries", []int{100, 40, 40}},
		{"increasing", []int{1, 2, 3}},
		{"single non-positive entry", []int{0}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := mustStream(t, seed, label)
			_, err := Stage1Pick(s, Stage1Input{
				Candidates: cands, Players: players, Shelf: map[string]int{},
				Table: tc.table, LiveCount: 1,
			})
			if !errors.Is(err, ErrStage1) {
				t.Fatalf("table %v was accepted (%v)", tc.table, err)
			}
			if s.Consumed() != 0 {
				t.Errorf("a malformed table consumed %d byte(s) before refusing", s.Consumed())
			}
		})
	}
}

func TestStage1RefusesAMalformedPoolAndLiveCount(t *testing.T) {
	players := []SnapshotPlayer{s1Player("10", map[string]int64{"knife_kills": 5, "hs_kills": 3})}
	a := Stage1Candidate{AwardID: "a", Priority: 1, Award: s1Award("knife_kills")}
	b := Stage1Candidate{AwardID: "b", Priority: 2, Award: s1Award("hs_kills")}
	seed, err := DecodeSeed(realSeedHex)
	if err != nil {
		t.Fatalf("DecodeSeed: %v", err)
	}
	label, err := Stage1Label(1)
	if err != nil {
		t.Fatalf("Stage1Label: %v", err)
	}

	for _, tc := range []struct {
		name      string
		cands     []Stage1Candidate
		liveCount int
		shelf     map[string]int
	}{
		{"empty pool", nil, 1, map[string]int{}},
		{"duplicate award_id", []Stage1Candidate{a, {AwardID: "a", Priority: 2, Award: s1Award("hs_kills")}}, 1, map[string]int{}},
		{"duplicate priority", []Stage1Candidate{a, {AwardID: "b", Priority: 1, Award: s1Award("hs_kills")}}, 1, map[string]int{}},
		{"zero priority", []Stage1Candidate{{AwardID: "a", Priority: 0, Award: s1Award("knife_kills")}}, 1, map[string]int{}},
		{"negative priority", []Stage1Candidate{{AwardID: "a", Priority: -1, Award: s1Award("knife_kills")}}, 1, map[string]int{}},
		{"empty award_id", []Stage1Candidate{{AwardID: "", Priority: 1, Award: s1Award("knife_kills")}}, 1, map[string]int{}},
		{"live_count 0", []Stage1Candidate{a, b}, 0, map[string]int{}},
		{"live_count negative", []Stage1Candidate{a, b}, -1, map[string]int{}},
		{"live_count above the pool", []Stage1Candidate{a, b}, 3, map[string]int{}},
		{"negative shelf size", []Stage1Candidate{a, b}, 1, map[string]int{"10": -1}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := mustStream(t, seed, label)
			_, err := Stage1Pick(s, Stage1Input{
				Candidates: tc.cands, Players: players, Shelf: tc.shelf,
				Table: []int{100, 40, 16}, LiveCount: tc.liveCount,
			})
			if !errors.Is(err, ErrStage1) {
				t.Fatalf("accepted (%v)", err)
			}
			if errors.Is(err, ErrStage1Tie) {
				t.Errorf("an invalid input was reported as a TIE: %v", err)
			}
			if s.Consumed() != 0 {
				t.Errorf("consumed %d byte(s) before refusing", s.Consumed())
			}
		})
	}
}

func TestStage1RefusesATotalWeightOutsideUniformIntsRange(t *testing.T) {
	// Two candidates at the table's heaviest entry, which is itself the MaxN bound: the total is
	// 2^33 and uniform_int refuses above 2^32. ⚠ Checked BEFORE the draw, and checked after every
	// addition so it cannot wrap into range.
	players := []SnapshotPlayer{
		s1Player("10", map[string]int64{"knife_kills": 5, "hs_kills": 1}),
		s1Player("20", map[string]int64{"knife_kills": 1, "hs_kills": 5}),
	}
	seed, err := DecodeSeed(realSeedHex)
	if err != nil {
		t.Fatalf("DecodeSeed: %v", err)
	}
	label, err := Stage1Label(1)
	if err != nil {
		t.Fatalf("Stage1Label: %v", err)
	}
	s := mustStream(t, seed, label)
	_, err = Stage1Pick(s, Stage1Input{
		Candidates: []Stage1Candidate{
			{AwardID: "a", Priority: 1, Award: s1Award("knife_kills")},
			{AwardID: "b", Priority: 2, Award: s1Award("hs_kills")},
		},
		Players:   players,
		Shelf:     map[string]int{},
		Table:     []int{int(MaxN), 1},
		LiveCount: 1,
	})
	if !errors.Is(err, ErrStage1) {
		t.Fatalf("an out-of-range total weight was accepted (%v)", err)
	}
	if s.Consumed() != 0 {
		t.Errorf("consumed %d byte(s) before refusing", s.Consumed())
	}
}

func TestStage1PickRefusesANilStream(t *testing.T) {
	players := []SnapshotPlayer{s1Player("10", map[string]int64{"knife_kills": 5})}
	_, err := Stage1Pick(nil, Stage1Input{
		Candidates: []Stage1Candidate{{AwardID: "a", Priority: 1, Award: s1Award("knife_kills")}},
		Players:    players, Shelf: map[string]int{}, Table: []int{100}, LiveCount: 1,
	})
	if !errors.Is(err, ErrStage1) {
		t.Errorf("a nil stream was accepted (%v) — Stage 1 is stream-driven", err)
	}
}

// ── test fixtures ─────────────────────────────────────────────────────────────

func s1Award(stat string) Award {
	return Award{DecidingStat: stat, Class: ClassVolume, Direction: DirectionMax}
}

// s1Player builds a snapshot row that clears zero floors comfortably.
func s1Player(sid string, vol map[string]int64) SnapshotPlayer {
	return s1PlayerAt(sid, 30, 20, vol)
}

func s1PlayerAt(sid string, rounds, kills int64, vol map[string]int64) SnapshotPlayer {
	v := map[string]*big.Int{}
	for k, n := range vol {
		v[k] = big.NewInt(n)
	}
	v["kills"] = big.NewInt(kills)
	v["rounds_played"] = big.NewInt(rounds)
	return SnapshotPlayer{
		SteamID64:    sid,
		RoundsPlayed: big.NewInt(rounds),
		Kills:        big.NewInt(kills),
		Volume:       v,
		Rate:         map[string]RatePair{},
	}
}

func equalInts(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func containsInt(xs []int, v int) bool {
	for _, x := range xs {
		if x == v {
			return true
		}
	}
	return false
}

func allEqual(xs []int) bool {
	for _, x := range xs {
		if x != xs[0] {
			return false
		}
	}
	return len(xs) > 0
}

func maxInt(xs []int) int {
	m := xs[0]
	for _, x := range xs {
		if x > m {
			m = x
		}
	}
	return m
}

// sortedByPriority returns the case's candidates in ascending priority — the order `weights` and
// the cumulative walk both use.
func sortedByPriority(c stage1VectorCase) []stage1VectorCandidate {
	out := make([]stage1VectorCandidate, len(c.Candidates))
	copy(out, c.Candidates)
	sort.Slice(out, func(i, j int) bool { return out[i].Priority < out[j].Priority })
	return out
}

func firstByPriority(c stage1VectorCase) stage1VectorCandidate {
	return sortedByPriority(c)[0]
}

func weightOf(c stage1VectorCase, awardID string) int {
	for i, cand := range sortedByPriority(c) {
		if cand.AwardID == awardID {
			return c.Expected.Weights[i]
		}
	}
	return -1
}

func isAscendingByPriority(c stage1VectorCase) bool {
	for i := 1; i < len(c.Candidates); i++ {
		if c.Candidates[i].Priority < c.Candidates[i-1].Priority {
			return false
		}
	}
	return true
}

// sameOrderAsPriority reports whether `live` happens to be in ascending-priority order.
func sameOrderAsPriority(c stage1VectorCase) bool {
	prio := map[string]int{}
	for _, cand := range c.Candidates {
		prio[cand.AwardID] = cand.Priority
	}
	for i := 1; i < len(c.Expected.Live); i++ {
		if prio[c.Expected.Live[i]] < prio[c.Expected.Live[i-1]] {
			return false
		}
	}
	return true
}

// ── Story 6.6, Task 5 — the luck weight table's INDEXING, in both directions ───

// ⭐⭐ FR-26's HEADLINE PROPERTY, ASSERTED AS A PROPERTY: an EMPTY shelf draws the HEAVIEST weight,
// and the weight is MONOTONE NON-INCREASING in shelf size.
//
// ⚠ IT RE-DERIVES BOTH FROM THE TABLE IT IS HANDED rather than from a transcribed literal, and the
// distinction is the whole point: the VALUES are organizer config that lives in
// `ceremony.luck_weight_table` (migration 0025 sets the column default and the pgTAP suite asserts
// its shape) precisely because `worker/awards` is a LEAF that must never seed one — `stage1.go:224`
// says so. A test that hardcoded [100 40 16 6 2 1] would silently stop testing the day an organizer
// re-tunes the table, which is the one thing the column exists to allow.
//
// It drives the PUBLIC entry point, not `stage1Weight`, so what is proven is the path a ceremony
// actually takes: pool -> ascending priority -> provisional winner -> shelf -> table.
func TestWeightIsHeaviestAtTheEmptyShelfAndMonotoneInShelfSize(t *testing.T) {
	// Three tables of different lengths, all satisfying validateWeightTable. The property must hold
	// for EVERY legal table, not for the one that happens to ship.
	for _, table := range [][]int{
		{100, 40, 16, 6, 2, 1},
		{9, 4, 1},
		{2, 1},
	} {
		// ⚠ `itoa`, not `fmt.Sprint` — `fmt.Sprintf`/`fmt.Sprint` are banned in this package's
		// decision path and the ban is scanned over source, so keeping the suite to the same
		// vocabulary avoids teaching a reader that the rule is negotiable.
		name := ""
		for _, w := range table {
			name += itoa(w) + "-"
		}
		t.Run(name, func(t *testing.T) {
			winner := "76561198000000011"
			candidates := []Stage1Candidate{{
				AwardID:  "aw-01",
				Priority: 1,
				Award:    Award{DecidingStat: "knife_kills", Class: ClassVolume, Direction: DirectionMax},
			}}
			players := []SnapshotPlayer{
				{
					SteamID64: winner, RoundsPlayed: big.NewInt(30), Kills: big.NewInt(20),
					Volume: map[string]*big.Int{"knife_kills": big.NewInt(9)},
					Rate:   map[string]RatePair{},
				},
				{
					SteamID64: "76561198000000022", RoundsPlayed: big.NewInt(30), Kills: big.NewInt(20),
					Volume: map[string]*big.Int{"knife_kills": big.NewInt(1)},
					Rate:   map[string]RatePair{},
				},
			}

			// Two past the end, so the CLAMP is exercised rather than assumed.
			weights := make([]int, 0, len(table)+3)
			for shelf := 0; shelf <= len(table)+1; shelf++ {
				got, err := Stage1Weights(Stage1Input{
					Candidates: candidates,
					Players:    players,
					Shelf:      map[string]int{winner: shelf},
					Table:      table,
					LiveCount:  1,
				})
				if err != nil {
					t.Fatalf("shelf %d: %v", shelf, err)
				}
				weights = append(weights, got[0])
			}

			// ⭐ SHELF 0 => table[0] => the HEAVIEST entry. Both halves are re-derived: the identity
			// with table[0], and that table[0] really is the maximum of the table it was handed.
			if weights[0] != table[0] {
				t.Errorf("shelf 0 weighs %d, want table[0] = %d", weights[0], table[0])
			}
			heaviest := table[0]
			for _, w := range table {
				if w > heaviest {
					heaviest = w
				}
			}
			if weights[0] != heaviest {
				t.Errorf("shelf 0 weighs %d, but the heaviest entry in %v is %d — FR-26's bias is "+
					"inverted", weights[0], table, heaviest)
			}
			// MONOTONE NON-INCREASING in shelf size, past the clamp included.
			for i := 1; i < len(weights); i++ {
				if weights[i] > weights[i-1] {
					t.Errorf("weight rose from %d at shelf %d to %d at shelf %d — a fuller shelf may "+
						"never draw MORE luck", weights[i-1], i-1, weights[i], i)
				}
			}
			// …and it genuinely DECREASES somewhere, or "non-increasing" is satisfied by a constant
			// table the validator would have refused anyway.
			if weights[0] == weights[len(table)-1] {
				t.Errorf("every shelf weighs the same (%d) — the bias is not a bias", weights[0])
			}
			// The clamp: everything at or past table_max weighs the LAST entry.
			last := table[len(table)-1]
			for shelf := len(table) - 1; shelf <= len(table)+1; shelf++ {
				if weights[shelf] != last {
					t.Errorf("shelf %d weighs %d, want the clamped last entry %d", shelf, weights[shelf], last)
				}
			}
		})
	}
}

// ⭐ THE TWO ARMS `deferred-work.md:308` IS ABOUT, DRIVEN DIRECTLY — and they are LOCAL rows rather
// than vector rows for a stated reason: both are refused by a guard that runs FIRST
// (`validateShelf` refuses a negative size, `validateWeightTable` refuses an empty table), so no set
// of INPUTS to the public entry points can reach them. That is exactly the representability rule the
// vector's README states, and faking a row would pin the validator rather than the guard.
//
// What they prevent is a DIVERGENCE, not a crash: before Story 6.6 the clamp was one-sided, so this
// input PANICKED here, yielded `undefined as number` in TypeScript and read the table from the END
// in Python — three behaviours, no error, one contract.
func TestWeightAtGuardsBothEndsOfTheTable(t *testing.T) {
	for _, tc := range []struct {
		name   string
		table  []int
		index  int
		detail string
	}{
		{"a NEGATIVE shelf index", []int{100, 40, 16}, -1, DetailShelf},
		{"an EMPTY table has no index 0 to give the empty shelf", []int{}, 0, DetailWeightTable},
		{"an empty table with a positive index refuses the TABLE, not the shelf", []int{}, 3, DetailWeightTable},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := weightAt(tc.table, tc.index)
			var invalid *Stage1InvalidError
			if !errors.As(err, &invalid) {
				t.Fatalf("err = %v, want a *Stage1InvalidError", err)
			}
			if invalid.Detail != tc.detail {
				t.Errorf("detail = %q, want %q", invalid.Detail, tc.detail)
			}
			if !errors.Is(err, ErrStage1) {
				t.Errorf("the refusal is not an ErrStage1: %v", err)
			}
		})
	}

	// ⭐ THE POSITIVE CONTROL: the same function on a legal index must NOT refuse, or the two arms
	// above are satisfied by a `weightAt` that refuses everything — the untyped-refusal defect 6-4a
	// measured, one level down.
	if w, err := weightAt([]int{100, 40, 16}, 1); err != nil || w != 40 {
		t.Errorf("weightAt([100 40 16], 1) = %d, %v; want 40, nil", w, err)
	}
	// …and the clamp still clamps rather than refusing.
	if w, err := weightAt([]int{100, 40, 16}, 99); err != nil || w != 16 {
		t.Errorf("weightAt([100 40 16], 99) = %d, %v; want the clamped 16, nil", w, err)
	}
}
