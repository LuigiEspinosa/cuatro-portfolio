package awards

import (
	"encoding/json"
	"errors"
	"math/big"
	"reflect"
	"sort"
	"strings"
	"testing"
)

// ── the shared contract ────────────────────────────────────────────────────────
//
// These tests read `roulette/vectors/ladder-resolve.json` AT RUNTIME through the 6.3 loader.
// Values are NEVER transcribed into Go literals: a hard-coded copy greens on the day the vector is
// regenerated and silently stops testing the contract.

// ladderStat is one CLASS-SHAPED value as the vector encodes it: a decimal STRING for a volume key
// and a `{num, den}` object for a rate key.
//
// ⭐ THE LOADER BRANCHES ON THE JSON SHAPE, NOT ON THE VOCABULARY, and that is deliberate. If the
// loader consulted `classOfStatKey` it would be re-implementing the rule under test, so a rung-1
// implementation that read the wrong shape would be handed a value the loader had already coerced
// into the right one. The vector's shapes come from 0024's own `volume || rate` derivation; the
// production code's job is to agree with them.
type ladderStat struct {
	IsPair bool
	Value  string
	Num    string
	Den    string
}

func (s *ladderStat) UnmarshalJSON(b []byte) error {
	trimmed := strings.TrimSpace(string(b))
	if strings.HasPrefix(trimmed, `"`) {
		return json.Unmarshal(b, &s.Value)
	}
	var pair stage2Rate
	if err := json.Unmarshal(b, &pair); err != nil {
		return err
	}
	s.IsPair, s.Num, s.Den = true, pair.Num, pair.Den
	return nil
}

// ladderAward carries the three FR-29 rung keys as PLAIN STRINGS, which is the whole point.
//
// ⭐ THIS STRUCT IS THE LOADER-RULE TEST. `encoding/json` leaves a `string` field at its zero value
// for a JSON `null` AND for an OMITTED key, so all three of the vector's spellings of absence —
// `null`, omitted, and `""` — arrive here as `""`, which `rungKey` reads as absent. No loader code
// exists for it, which is why `stage2-resolve.json`'s award objects (which carry none of the three)
// can regenerate byte-identically. `TestLadderAbsentRungKeySpellingsAreIndistinguishable` pins it.
type ladderAward struct {
	DecidingStat  string `json:"deciding_stat"`
	Class         string `json:"class"`
	Direction     string `json:"direction"`
	FloorRounds   int    `json:"floor_rounds"`
	FloorKills    int    `json:"floor_kills"`
	SecondaryStat string `json:"secondary_stat"`
	EffNumKey     string `json:"eff_num_key"`
	EffDenKey     string `json:"eff_den_key"`
}

type ladderPlayer struct {
	SteamID64    string `json:"steamid64"`
	RoundsPlayed string `json:"rounds_played"`
	Kills        string `json:"kills"`
	IdleDQ       bool   `json:"idle_dq"`
	StatsInt     struct {
		Volume map[string]string     `json:"volume"`
		Rate   map[string]stage2Rate `json:"rate"`
		// ⭐ `Secondary` AND `Efficiency` BOTH DECODE THROUGH `ladderStat` (Story 6-5b). Every real
		// efficiency entry is a `{num, den}` pair, so on every honest row this is exactly what
		// `stage2Rate` decoded — what it BUYS is that a NON-PAIR is readable at all. `efficiencyPair`'s
		// "incomplete {num, den} pair" refusal is live in all three implementations and had no row
		// anywhere, because a `stage2Rate` target turns a bare decimal string into a hard unmarshal
		// error inside the loader rather than into the input state the guard is about.
		Secondary  map[string]ladderStat `json:"secondary"`
		Efficiency map[string]ladderStat `json:"efficiency"`
	} `json:"stats_int"`
	H2H map[string]map[string]ladderStat `json:"h2h"`
	// ⚠ A POINTER, so an OMITTED `achievement_ts` stays distinguishable from the sentinel. It is a
	// SCALAR rather than a container, so "absent is the empty case" does NOT apply: a nil read as 0
	// would be an epoch of 1970 and would win rung 4 outright.
	AchievementTS *string `json:"achievement_ts"`
}

type ladderExpected struct {
	Kind           string       `json:"kind"`
	SteamID64      string       `json:"steamid64"`
	Winners        []string     `json:"winners"`
	LadderExitStep int          `json:"ladder_exit_step"`
	DecidingValue  *stage2Value `json:"deciding_value"`
}

type ladderCase struct {
	Name     string         `json:"name"`
	Note     string         `json:"note"`
	Award    ladderAward    `json:"award"`
	Tied     []string       `json:"tied"`
	Players  []ladderPlayer `json:"players"`
	Expected ladderExpected `json:"expected"`
}

type ladderRefusalRow struct {
	Why     string         `json:"why"`
	Detail  string         `json:"detail"`
	Award   ladderAward    `json:"award"`
	Tied    []string       `json:"tied"`
	Players []ladderPlayer `json:"players"`
}

type ladderVector struct {
	Vector              string   `json:"vector"`
	AlgoVersion         string   `json:"algo_version"`
	ExitSteps           []int    `json:"exit_steps"`
	AbsentAchievementTS string   `json:"absent_achievement_ts"`
	RefusalDetails      []string `json:"refusal_details"`
	StatVocabulary      struct {
		Volume []string `json:"volume"`
		Rate   []string `json:"rate"`
	} `json:"stat_vocabulary"`
	DeclaredDivergences []ladderDeclaredDivergence `json:"declared_divergences"`
	Refusals            []ladderRefusalRow         `json:"refusals"`
	Cases               []ladderCase               `json:"cases"`
}

// ladderDeclaredDivergence — a cross-language divergence the vector DECLARES rather than resolves: an
// input whose refusal label legitimately differs between the runtimes, with the argument for why.
//
// ⭐⭐ IT IS NOT ROW-REPRESENTABLE, WHICH IS EXACTLY WHY IT NEEDS AN INSPECTOR. A vector row is a set
// of INPUTS, and this input — a non-array roster — cannot exist here at all: `ResolveLadder`'s
// parameter is typed `[]SnapshotPlayer`, so a nil slice IS an empty slice ("an absent container is the
// empty container"). `deferred-work.md:326` is therefore closed "in data" as AC9 permits — but data
// nothing reads is, in this directory's own words, "a compartment, not a contract". Story 6.11 emitted
// the block and its code review found NEITHER runtime inspected it.
type ladderDeclaredDivergence struct {
	Input            string `json:"input"`
	TypeScript       string `json:"typescript"`
	Go               string `json:"go"`
	Python           string `json:"python"`
	RowRepresentable bool   `json:"row_representable"`
	WhyNot           string `json:"why_not"`
	Resolution       string `json:"resolution"`
}

func loadLadder(t *testing.T) ladderVector {
	t.Helper()
	v := loadVector[ladderVector](t, "ladder-resolve.json")
	if v.Vector != "ladder-resolve" {
		t.Fatalf("loaded the wrong vector file: %q", v.Vector)
	}
	if len(v.Cases) == 0 {
		t.Fatal("ladder-resolve.json has no cases")
	}
	if len(v.Refusals) == 0 {
		t.Fatal("ladder-resolve.json has no refusals")
	}
	return v
}

func toLadderAward(a ladderAward) Award {
	return Award{
		DecidingStat:  a.DecidingStat,
		Class:         AwardClass(a.Class),
		Direction:     AwardDirection(a.Direction),
		FloorRounds:   a.FloorRounds,
		FloorKills:    a.FloorKills,
		SecondaryStat: a.SecondaryStat,
		EffNumKey:     a.EffNumKey,
		EffDenKey:     a.EffDenKey,
	}
}

func toStatValue(t *testing.T, what string, s ladderStat) StatValue {
	t.Helper()
	if s.IsPair {
		return StatValue{
			Class: ClassRate,
			Num:   mustBig(t, what+".num", s.Num),
			Den:   mustBig(t, what+".den", s.Den),
		}
	}
	return StatValue{Class: ClassVolume, Value: mustBig(t, what, s.Value)}
}

func toLadderPlayers(t *testing.T, rows []ladderPlayer) []SnapshotPlayer {
	t.Helper()
	out := make([]SnapshotPlayer, 0, len(rows))
	for _, r := range rows {
		p := SnapshotPlayer{
			SteamID64:    r.SteamID64,
			RoundsPlayed: mustBig(t, r.SteamID64+".rounds_played", r.RoundsPlayed),
			Kills:        mustBig(t, r.SteamID64+".kills", r.Kills),
			IdleDQ:       r.IdleDQ,
			Volume:       map[string]*big.Int{},
			Rate:         map[string]RatePair{},
		}
		// ⭐ AN OMITTED BLOCK STAYS A NIL MAP (Story 6-5b). The loader used to allocate all three
		// unconditionally, so Go's nil-map read — the behaviour the "an absent container is the empty
		// container" rule is ABOUT — was entered by no row in the file while the TypeScript side's
		// `container(undefined)` was equally unreachable. `encoding/json` leaves the field nil when the
		// key is absent, so the three maps below are allocated only when the vector actually wrote them.
		if r.StatsInt.Secondary != nil {
			p.Secondary = map[string]StatValue{}
		}
		if r.StatsInt.Efficiency != nil {
			p.Efficiency = map[string]RatePair{}
		}
		if r.H2H != nil {
			p.H2H = map[string]map[string]StatValue{}
		}
		for k, v := range r.StatsInt.Volume {
			p.Volume[k] = mustBig(t, r.SteamID64+".volume."+k, v)
		}
		for k, v := range r.StatsInt.Rate {
			p.Rate[k] = RatePair{
				Num: mustBig(t, r.SteamID64+".rate."+k+".num", v.Num),
				Den: mustBig(t, r.SteamID64+".rate."+k+".den", v.Den),
			}
		}
		for k, v := range r.StatsInt.Secondary {
			p.Secondary[k] = toStatValue(t, r.SteamID64+".secondary."+k, v)
		}
		for k, v := range r.StatsInt.Efficiency {
			// ⚠ A NON-PAIR STAYS A NIL-HALVED RatePair rather than becoming a loader failure — that IS
			// the input state `efficiencyPair`'s incomplete-pair refusal is about, and the only way the
			// shared file can express it.
			if !v.IsPair {
				p.Efficiency[k] = RatePair{}
				continue
			}
			p.Efficiency[k] = RatePair{
				Num: mustBig(t, r.SteamID64+".efficiency."+k+".num", v.Num),
				Den: mustBig(t, r.SteamID64+".efficiency."+k+".den", v.Den),
			}
		}
		for opp, block := range r.H2H {
			inner := map[string]StatValue{}
			for k, v := range block {
				inner[k] = toStatValue(t, r.SteamID64+".h2h."+opp+"."+k, v)
			}
			p.H2H[opp] = inner
		}
		// ⚠ Left NIL when the vector OMITS the key — the refusal row for an absent scalar depends
		// on that, and coercing it to a zero here would make the row untestable.
		if r.AchievementTS != nil {
			p.AchievementTS = mustBig(t, r.SteamID64+".achievement_ts", *r.AchievementTS)
		}
		out = append(out, p)
	}
	return out
}

// ⭐ THE CASE-NAME SET IS PINNED BY EXACT EQUALITY, mirroring `stage2CaseNames` and
// `TestScannedSourceFilesAreExactlyTheShippedModules`.
//
// The recurring finding across the 6-4a and 6-4b reviews is that a coverage flag can be satisfied
// by a row unrelated to the property it names — so deleting the file's most valuable rows leaves
// every flag green, `--check` reporting OK and both suites passing. Adding or removing a case
// reddens this deliberately, and the flags below additionally RE-DERIVE their input property from
// each row's own data.
var ladderCaseNames = []string{
	"ABSENT-secondary-efficiency-and-h2h-BLOCKS-are-the-EMPTY-blocks",
	"a-NON-TIED-player-with-a-CORRUPT-ts-and-a-DOMINANT-h2h-is-INVISIBLE-to-BOTH",
	"a-RATE-class-award-cross-multiplies-its-h2h-PAIRS-at-rung-3",
	"a-RATE-class-award-with-a-VOLUME-secondary-crosses-CLASS-the-OTHER-way",
	"a-player-who-is-NOT-in-the-tied-set-is-INVISIBLE-to-every-rung",
	"a-width-3-tie-NARROWS-to-2-at-rung-1-and-is-SHARED-at-rung-5",
	"an-achievement_ts-of-ZERO-is-a-REAL-timestamp-and-WINS-rung-4",
	"an-achievement_ts-past-2-pow-53-is-compared-EXACTLY",
	"rung-1-RESOLVES-and-RETURNS-even-though-rung-2-and-h2h-are-CONFIGURED",
	"rung-1-a-RATE-secondary-cross-multiplies-and-crosses-CLASS",
	"rung-1-a-VOLUME-secondary-breaks-the-tie",
	"rung-1-a-zero-denominator-secondary-ties-everyone-S3-verbatim",
	"rung-1-direction-min-inverts-the-secondary",
	"rung-1-is-SKIPPED-when-secondary_stat-is-NULL",
	"rung-2-NARROWS-without-resolving-and-the-NEXT-rung-runs-over-the-SURVIVORS",
	"rung-2-RATE-efficiency-keys-give-the-product-FOUR-non-trivial-terms",
	"rung-2-RESOLVES-and-RETURNS-even-though-h2h-is-POPULATED",
	"rung-2-a-ZERO-OVER-ZERO-ratio-is-UNELIMINABLE-and-rides-to-the-next-rung",
	"rung-2-a-ratio-of-two-ratios-the-naive-single-pair-compare-gets-BACKWARDS",
	"rung-2-a-zero-denominator-ratio-behaves-as-PLUS-INFINITY",
	"rung-2-an-INFINITE-and-a-ZERO-OVER-ZERO-ratio-are-EQUAL-and-BOTH-ride-through",
	"rung-2-four-term-products-past-2-pow-53",
	"rung-2-is-SKIPPED-when-both-efficiency-keys-are-NULL",
	"rung-2-runs-over-rung-1s-SURVIVORS-so-the-ORDER-of-the-rungs-decides",
	"rung-2-under-direction-min-a-ZERO-DENOMINATOR-ratio-LOSES-to-every-finite-one",
	"rung-2-under-direction-min-picks-the-SMALLEST-ratio",
	"rung-3-a-ONE-SIDED-h2h-record-is-not-comparable",
	"rung-3-a-dominator-must-beat-EVERY-other-survivor-not-merely-ONE",
	"rung-3-a-strict-dominator-wins",
	"rung-3-direction-min-inverts-the-head-to-head",
	"rung-3-has-NO-strict-dominator-and-SKIPS-without-eliminating-anyone",
	"rung-3-runs-over-rung-1s-SURVIVORS-so-a-DOMINATOR-emerges-the-full-tie-had-not",
	"rung-4-BYTE-IDENTICAL-timestamps-fall-through-to-the-shared-rung-5",
	"rung-4-NARROWS-and-the-SENTINEL-holder-is-EXCLUDED-from-the-shared-set",
	"rung-4-the-MINUS-ONE-sentinel-must-NEVER-win",
	"rung-4-the-earliest-achievement_ts-wins",
	"rung-4-under-direction-min-is-STILL-the-earliest",
	"rung-4-when-EVERY-survivor-is-absent-the-rung-skips-to-rung-5",
	"rung-keys-OMITTED-from-the-award-object-entirely",
	"rung-keys-spelled-as-EMPTY-STRINGS",
	"rung-keys-spelled-as-explicit-JSON-null",
	"the-ladder-NEVER-re-applies-the-FR-21-floors",
}

func TestVectorLadderCarriesExactlyTheExpectedCases(t *testing.T) {
	v := loadLadder(t)
	got := make([]string, 0, len(v.Cases))
	for _, c := range v.Cases {
		got = append(got, c.Name)
	}
	sort.Strings(got)
	if strings.Join(got, "\n") != strings.Join(ladderCaseNames, "\n") {
		t.Errorf("the ladder vector's case set drifted.\n got: %v\nwant: %v", got, ladderCaseNames)
	}
}

// ── the conformance gate ───────────────────────────────────────────────────────

func TestVectorLadderResolve(t *testing.T) {
	v := loadLadder(t)

	for _, tc := range v.Cases {
		t.Run(tc.Name, func(t *testing.T) {
			award := toLadderAward(tc.Award)
			players := toLadderPlayers(t, tc.Players)

			got, err := ResolveLadder(award, tc.Tied, players)
			if err != nil {
				t.Fatalf("ResolveLadder refused a CASE row: %v\nnote: %s", err, tc.Note)
			}

			// ⭐ THE EXIT STEP IS ASSERTED ON EVERY CASE, not only on the interesting ones. A ladder
			// that reached the RIGHT player by the WRONG rung passes a winner-only assertion, and
			// Story 6.8 persists this as `award_result.tie_ladder_exit_step` — so a wrong rung ships
			// a false explanation to the audience.
			if got.LadderExitStep != tc.Expected.LadderExitStep {
				t.Errorf("ladder_exit_step = %d, want %d\nnote: %s",
					got.LadderExitStep, tc.Expected.LadderExitStep, tc.Note)
			}

			// ⚠ The XOR: a LADDER-resolved outcome carries an exit step and NO deciding value. A
			// fabricated zero would be a plausible-looking lie that 6.8 renders on stage.
			if tc.Expected.DecidingValue != nil {
				t.Error("a ladder case declares a deciding_value — the ladder never re-derives one (L12)")
			}
			if got.DecidingValue.Class != "" || got.DecidingValue.Value != nil ||
				got.DecidingValue.Num != nil || got.DecidingValue.Den != nil {
				t.Errorf("the ladder returned a deciding value %+v — it must leave it absent",
					got.DecidingValue)
			}

			switch tc.Expected.Kind {
			case string(KindWinner):
				if got.Kind != KindWinner {
					t.Fatalf("kind = %q, want winner\nnote: %s", got.Kind, tc.Note)
				}
				if got.SteamID64 != tc.Expected.SteamID64 {
					t.Errorf("winner = %q, want %q\nnote: %s",
						got.SteamID64, tc.Expected.SteamID64, tc.Note)
				}
				if len(got.Winners) != 0 {
					t.Errorf("a single winner carries a Winners set: %v", got.Winners)
				}

			case string(KindShared):
				if got.Kind != KindShared {
					t.Fatalf("kind = %q, want shared\nnote: %s", got.Kind, tc.Note)
				}
				if strings.Join(got.Winners, ",") != strings.Join(tc.Expected.Winners, ",") {
					t.Errorf("winners = %v, want %v (byte-lex)\nnote: %s",
						got.Winners, tc.Expected.Winners, tc.Note)
				}
				if len(got.Winners) < 2 {
					t.Errorf("a SHARED outcome holds %d winner(s) — rung 5 shares the FULL surviving set",
						len(got.Winners))
				}
				if got.SteamID64 != "" {
					t.Errorf("a shared outcome names a single winner %q", got.SteamID64)
				}
				// ⭐ RUNG 5 IS THE ONLY WAY TO BE SHARED, and it is TERMINAL.
				if got.LadderExitStep != LadderExitShared {
					t.Errorf("a shared outcome exited at step %d, want %d",
						got.LadderExitStep, LadderExitShared)
				}

			default:
				// The final arm. A vector that grew a sixth outcome kind must fail loudly here
				// rather than silently skipping the row — 6-4a's review found the TypeScript
				// conformance switch missing exactly this.
				t.Fatalf("the vector declares an outcome kind this suite does not check: %q",
					tc.Expected.Kind)
			}
		})
	}
}

// Every refusal row must refuse with the TYPED error AND with the DECLARED detail.
//
// ⭐ NEVER MERELY "SOME ERROR". The 6-4a review measured the cost: with an untyped refusal surface
// a mutation that made validation reject EVERY input left all sixteen rows passing. And 6-4b
// measured the next level down: with only a type and no `detail`, deleting a guard still threw the
// right class from three functions later.
func TestVectorLadderRefusals(t *testing.T) {
	v := loadLadder(t)

	for _, r := range v.Refusals {
		t.Run(r.Detail+"/"+r.Why, func(t *testing.T) {
			award := toLadderAward(r.Award)
			players := toLadderPlayers(t, r.Players)

			got, err := ResolveLadder(award, r.Tied, players)
			if err == nil {
				t.Fatalf("a refusal row RESOLVED: %+v", got)
			}
			if !errors.Is(err, ErrLadder) {
				t.Errorf("refusal is not an ErrLadder: %v", err)
			}
			var invalid *LadderInvalidError
			if !errors.As(err, &invalid) {
				t.Fatalf("refusal is not a *LadderInvalidError: %v", err)
			}
			if invalid.Detail != r.Detail {
				t.Errorf("refused on detail %q, the vector declares %q: %v",
					invalid.Detail, r.Detail, err)
			}
			// ⛔ A propagated Stage-2 refusal must STILL identify where it came from.
			if r.Detail == LadderDetailStage2 && !errors.Is(err, ErrStage2) {
				t.Error("a `stage2` refusal does not unwrap to ErrStage2 — the propagation was swallowed")
			}
		})
	}
}

// The vector's declared closed sets and this package's constants must be the same sets.
//
// ⭐ 6-4b SHIPPED A "CLOSED SET" THAT WAS NOT CLOSED — nine constants in Go against seven in
// TypeScript and seven in the vector. Declaring the set in the anchor and pinning all three against
// it is the fix, applied here from the first commit rather than after a review.
func TestVectorLadderClosedSetsMatchThePackage(t *testing.T) {
	v := loadLadder(t)

	wantDetails := []string{
		LadderDetailStage2, LadderDetailAward, LadderDetailTied,
		LadderDetailPlayer, LadderDetailInternal,
	}
	if strings.Join(v.RefusalDetails, ",") != strings.Join(wantDetails, ",") {
		t.Errorf("vector refusal_details = %v, package has %v", v.RefusalDetails, wantDetails)
	}

	wantSteps := []int{
		LadderExitSecondary, LadderExitEfficiency, LadderExitH2H,
		LadderExitAchieved, LadderExitShared,
	}
	if len(v.ExitSteps) != len(wantSteps) {
		t.Fatalf("vector exit_steps = %v, package has %v", v.ExitSteps, wantSteps)
	}
	for i, s := range wantSteps {
		if v.ExitSteps[i] != s {
			t.Errorf("exit_steps[%d] = %d, want %d", i, v.ExitSteps[i], s)
		}
	}

	if v.AbsentAchievementTS != "-1" {
		t.Errorf("vector absent_achievement_ts = %q, want %q", v.AbsentAchievementTS, "-1")
	}
	if AbsentAchievementTS != -1 {
		t.Errorf("AbsentAchievementTS = %d, want -1", AbsentAchievementTS)
	}

	// ⭐ `algo_version` WAS ASSERTED ONLY BY THE TYPESCRIPT SUITE (Story 6-5b, T6 — a one-sided gate
	// over a shared file). It is the field 6.9 canonicalizes into `bundle_sha256`, so a bump that
	// landed in the vector and in one runtime would have reddened exactly one of the two.
	if v.AlgoVersion != "inclusivcup-roulette-1.0.0" {
		t.Errorf("vector algo_version = %q, want %q", v.AlgoVersion, "inclusivcup-roulette-1.0.0")
	}
}

// ⭐⭐ EVERY DECLARED `detail` IS EITHER EXERCISED BY A ROW OR DECLARED UNREACHABLE, IN WORDS.
//
// This mirrors the machinery `stage1_test.go` already ships (`rowRepresentable` / `unrepresentable`
// + a `seenDetail` map) and that the ladder suites did not copy. Before it, both suites pinned
// `refusal_details` as a five-element set and then iterated whatever rows happened to exist — so
// EVERY `award` row, or EVERY `player` row, could have been deleted from the vector and only "the
// array is non-empty" would have noticed. A closed set nothing inspects is a compartment, not a
// contract. (Story 6-5b, T5.)
func TestVectorLadderEveryDeclaredDetailIsExercisedOrDeclaredUnreachable(t *testing.T) {
	v := loadLadder(t)

	// ⚠ SPELLED OUT RATHER THAN RE-SLICED. `stage1_test.go` learned this the hard way: a slice bound
	// is the kind of thing a later append silently shifts, and the whole point of the split is that
	// adding a detail forces a decision about which side it lands on.
	rowRepresentable := []string{
		LadderDetailStage2, LadderDetailAward, LadderDetailTied, LadderDetailPlayer,
	}
	unrepresentable := []string{LadderDetailInternal}

	if len(rowRepresentable)+len(unrepresentable) != len(v.RefusalDetails) {
		t.Fatalf("the split covers %d details, the vector declares %d — a detail was added and this "+
			"test was not told which side it belongs on",
			len(rowRepresentable)+len(unrepresentable), len(v.RefusalDetails))
	}

	seenDetail := map[string]int{}
	for _, r := range v.Refusals {
		if r.Detail == "" {
			t.Errorf("refusal row %q carries no detail", r.Why)
		}
		seenDetail[r.Detail]++
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
	for d := range seenDetail {
		var known bool
		for _, k := range rowRepresentable {
			if k == d {
				known = true
			}
		}
		if !known {
			t.Errorf("a refusal row carries detail %q, which is outside the row-representable set", d)
		}
	}
}

// ⭐ `internal` IS DECLARED UNREACHABLE, AND IT HAS **TWO** PRODUCERS WITH GENUINELY DIFFERENT
// ARGUMENTS. Naming them separately is the obligation the non-representability creates: a `detail`
// that no row can carry is only honest if the reason it cannot is written down, and a later reader
// who "simplifies" the two into one sentence removes a guard that is load-bearing for the other.
//
//  1. RUNG 3'S PLURAL DOMINATOR — unreachable by ANTISYMMETRY. `compareValues(a,b) ==
//     -compareValues(b,a)`, so `p` beating `q` means `q` does not beat `p`, so two players can never
//     both beat everyone.
//  2. `bestSurvivors`' EMPTY BEST SET — unreachable by ACYCLICITY, which is STRICTLY WEAKER than
//     transitivity, and the comparator genuinely does NOT have transitivity: `0/0` compares equal to
//     everything, so `0/0 ~ 10/5` and `0/0 ~ 6/5` while `10/5 > 6/5`. Every non-empty set has an
//     unbeaten member while the strict part is acyclic — and a NEGATIVE magnitude is what breaks
//     acyclicity, which is why the negative-magnitude refusals in `statValue`/`efficiencyPair` are
//     the same mechanism described at another site.
//
// This test asserts what CAN be asserted about an unreachable path: that both producers exist in the
// shipped source, that each refuses with `internal`, and that neither has drifted into a detail a row
// could carry. It cannot drive them, and saying so is the point. (Story 6-5b, T5.)
func TestLadderInternalHasTwoDeclaredProducersAndNoRowCanReachEither(t *testing.T) {
	// ⚠ Read through `productionSources`, which strips comments — so these needles match the CODE
	// (the refusal messages themselves) rather than the prose that explains them. A scan over raw
	// text would have been satisfied by this very doc comment.
	entry, ok := productionSources(t)["ladder.go"]
	if !ok {
		t.Fatal("ladder.go is not in the scanned source set")
	}
	src := entry.code

	for _, want := range []string{
		"antisymmetric comparator",     // producer 1, rung 3's plural dominator
		"the comparator's strict part", // producer 2, the empty best set
		"cannot compare a ",            // the class-mismatch guard, `internal`'s third site
	} {
		if !strings.Contains(src, want) {
			t.Errorf("ladder.go no longer contains the %q refusal — an `internal` producer was removed "+
				"or renamed, and the declaration above is now describing something that is not there", want)
		}
	}

	// Both producers must refuse with LadderDetailInternal specifically. Counting is what makes this
	// fail if one of them is quietly relabelled into a row-representable detail to "get it covered".
	if got := strings.Count(src, "LadderDetailInternal"); got < 3 {
		t.Errorf("ladder.go names LadderDetailInternal %d times; the declaration above lists two "+
			"refusal producers plus the constant itself", got)
	}

	// …and the empty best set really is unreachable from a vector row: no refusal row declares it.
	v := loadLadder(t)
	for _, r := range v.Refusals {
		if r.Detail == LadderDetailInternal {
			t.Errorf("refusal row %q declares `internal`, which no INPUT can produce", r.Why)
		}
	}
}

// ⭐ THE 17/4 VOCABULARY SPLIT IS PINNED AGAINST THE VECTOR, not trusted.
//
// It is the FOURTH restatement of 0023's closed set (0023's CHECKs, `award_stat_vocabulary()`,
// lib/awards/catalog.ts, and now the two runtimes), and `worker/awards` is a LEAF that cannot read
// the database — so the only thing that can keep the copies honest is the shared file.
func TestVectorLadderStatVocabularyMatchesThePackage(t *testing.T) {
	v := loadLadder(t)

	if strings.Join(v.StatVocabulary.Volume, ",") != strings.Join(volumeStatKeys, ",") {
		t.Errorf("vector volume vocabulary = %v, package has %v",
			v.StatVocabulary.Volume, volumeStatKeys)
	}
	if strings.Join(v.StatVocabulary.Rate, ",") != strings.Join(rateStatKeys, ",") {
		t.Errorf("vector rate vocabulary = %v, package has %v",
			v.StatVocabulary.Rate, rateStatKeys)
	}
	if len(volumeStatKeys) != 17 || len(rateStatKeys) != 4 {
		t.Errorf("the vocabulary is %d volume / %d rate, 0023 declares 17 / 4",
			len(volumeStatKeys), len(rateStatKeys))
	}
	// The split must be a PARTITION: every key classifies, and no key classifies as both.
	for _, k := range append(append([]string{}, volumeStatKeys...), rateStatKeys...) {
		if _, ok := classOfStatKey(k); !ok {
			t.Errorf("vocabulary key %q does not classify", k)
		}
	}
	if _, ok := classOfStatKey("not_a_stat"); ok {
		t.Error("a key outside the vocabulary classified — L5's refusal is unreachable")
	}
}

// ── guarding the guards ────────────────────────────────────────────────────────
//
// ⭐⭐ EVERY FLAG BELOW NAMES THE SPECIFIC ROW IT CLAIMS AND RE-DERIVES THAT ROW'S PROPERTY FROM ITS
// OWN DATA, and each uniquely-claimed property is asserted to be claimed by EXACTLY ONE row.
//
// This is the finding that has now recurred twice. 6-4a: `sawFloatDivergence` was flipped by a
// zero-denominator row, so the headline `(2^53+1)` case could have been deleted with every gate
// green. 6-4b, subtler: three guards checked only the NUMBERS their row produces, and those numbers
// were reachable by other routes. "The outcome exited at rung 4" is true of half this file, so it
// proves nothing about the sentinel; "a shared outcome" is true of three rows, so it proves nothing
// about narrowing.

func TestVectorLadderCoverageIsRealAndUnique(t *testing.T) {
	v := loadLadder(t)
	byName := map[string]ladderCase{}
	for _, c := range v.Cases {
		byName[c.Name] = c
	}

	claim := func(name string, check func(c ladderCase) bool) {
		t.Helper()
		c, ok := byName[name]
		if !ok {
			t.Fatalf("the row %q is gone — the property it carried is now covered by nothing", name)
		}
		if !check(c) {
			t.Errorf("the row %q no longer exhibits the property its name claims", name)
		}
		// Uniqueness: exactly one row in the file satisfies it, so the claim cannot silently
		// migrate to a row that happens to satisfy it for an unrelated reason.
		hits := 0
		for _, other := range v.Cases {
			if check(other) {
				hits++
			}
		}
		if hits != 1 {
			t.Errorf("%d rows satisfy %q's property; exactly 1 must", hits, name)
		}
	}

	tsOf := func(c ladderCase, sid string) (string, bool) {
		for _, p := range c.Players {
			if p.SteamID64 == sid && p.AchievementTS != nil {
				return *p.AchievementTS, true
			}
		}
		return "", false
	}

	rowOf := func(c ladderCase, sid string) (ladderPlayer, bool) {
		for _, p := range c.Players {
			if p.SteamID64 == sid {
				return p, true
			}
		}
		return ladderPlayer{}, false
	}

	// rung2Ratio re-derives the FOUR-TERM rung-2 ratio for one player from the ROW'S OWN award keys.
	// ⭐ Every guard below that talks about rung 2 goes through this rather than reading a hardcoded
	// key, which is T4's finding stated as code: a guard that names a key can only describe the
	// fixture it was written against.
	rung2Ratio := func(c ladderCase, sid string) (num, den *big.Int, ok bool) {
		if c.Award.EffNumKey == "" || c.Award.EffDenKey == "" {
			return nil, nil, false
		}
		p, found := rowOf(c, sid)
		if !found {
			return nil, nil, false
		}
		n, okN := p.StatsInt.Efficiency[c.Award.EffNumKey]
		d, okD := p.StatsInt.Efficiency[c.Award.EffDenKey]
		if !okN || !okD || !n.IsPair || !d.IsPair {
			return nil, nil, false
		}
		nNum, _ := new(big.Int).SetString(n.Num, 10)
		nDen, _ := new(big.Int).SetString(n.Den, 10)
		dNum, _ := new(big.Int).SetString(d.Num, 10)
		dDen, _ := new(big.Int).SetString(d.Den, 10)
		if nNum == nil || nDen == nil || dNum == nil || dDen == nil {
			return nil, nil, false
		}
		return new(big.Int).Mul(nNum, dDen), new(big.Int).Mul(nDen, dNum), true
	}

	// anyZeroOverZero re-derives whether SOME tied player's computed rung-2 ratio is exactly 0/0 —
	// the S3 half that is EQUAL to everything, as opposed to `n/0`, which BEATS everything.
	anyZeroOverZero := func(c ladderCase) bool {
		for _, sid := range c.Tied {
			num, den, ok := rung2Ratio(c, sid)
			if ok && num.Sign() == 0 && den.Sign() == 0 {
				return true
			}
		}
		return false
	}

	// anyInfinite re-derives whether SOME tied player's computed rung-2 ratio is `n/0` with `n > 0`
	// — S3's beats-every-finite-value half. Added at the 6-5b code review, which found that the
	// `min` and `0/0` claims could not tell their own rows from the two new degenerate-ratio rows.
	anyInfinite := func(c ladderCase) bool {
		for _, sid := range c.Tied {
			num, den, ok := rung2Ratio(c, sid)
			if ok && den.Sign() == 0 && num.Sign() > 0 {
				return true
			}
		}
		return false
	}

	// ── the COUNTERFACTUAL helpers (Story 6-5b code review, 2026-08-06) ──────────────────────────
	//
	// ⭐ Several claims below asserted only the SHAPE of the outcome — "it exited at rung 2", "h2h is
	// populated" — where the Python anchor's `pins_inputs` re-derived the counterfactual that makes
	// the row load-bearing: that the OTHER rung would have crowned somebody else. A claim that
	// cannot see the disagreement cannot notice when a fixture edit removes it.
	//
	// ⚠ `beats` is re-derived from the row's own `direction` here rather than calling the shipped
	// comparator: a guard that used the implementation under test to decide whether the
	// implementation is right would be circular.
	beatsFrac := func(c ladderCase, aNum, aDen, bNum, bDen *big.Int) bool {
		left := new(big.Int).Mul(aNum, bDen)
		right := new(big.Int).Mul(bNum, aDen)
		if c.Award.Direction == string(DirectionMin) {
			return left.Cmp(right) < 0
		}
		return left.Cmp(right) > 0
	}

	// statFrac reads one class-shaped value as a fraction — a bare magnitude is `v/1`.
	statFrac := func(v ladderStat, present bool) (*big.Int, *big.Int, bool) {
		if !present {
			return nil, nil, false
		}
		if v.IsPair {
			n, _ := new(big.Int).SetString(v.Num, 10)
			d, _ := new(big.Int).SetString(v.Den, 10)
			if n == nil || d == nil {
				return nil, nil, false
			}
			return n, d, true
		}
		n, _ := new(big.Int).SetString(v.Value, 10)
		if n == nil {
			return nil, nil, false
		}
		return n, big.NewInt(1), true
	}

	// dominatorsOver is rung 3's strict-dominator set over an ARBITRARY survivor list, so a claim
	// can state what rung 3 would have said over the ORIGINAL tie as well as over the narrowed one.
	dominatorsOver := func(c ladderCase, survivors []string) []string {
		out := []string{}
		for _, p := range survivors {
			pRow, okP := rowOf(c, p)
			if !okP {
				continue
			}
			dominates := true
			for _, q := range survivors {
				if q == p {
					continue
				}
				qRow, okQ := rowOf(c, q)
				if !okQ {
					dominates = false
					break
				}
				mineV, mineOK := pRow.H2H[q][c.Award.DecidingStat]
				theirsV, theirsOK := qRow.H2H[p][c.Award.DecidingStat]
				mn, md, ok1 := statFrac(mineV, mineOK)
				tn, td, ok2 := statFrac(theirsV, theirsOK)
				if !ok1 || !ok2 || !beatsFrac(c, mn, md, tn, td) {
					dominates = false
					break
				}
			}
			if dominates {
				out = append(out, p)
			}
		}
		return out
	}

	// bestBySecondary is rung 1's `best` set over the full tie, on the row's own `secondary_stat`.
	bestBySecondary := func(c ladderCase) ([]string, bool) {
		if c.Award.SecondaryStat == "" {
			return nil, false
		}
		nums := map[string]*big.Int{}
		dens := map[string]*big.Int{}
		for _, sid := range c.Tied {
			p, ok := rowOf(c, sid)
			if !ok {
				return nil, false
			}
			v, present := p.StatsInt.Secondary[c.Award.SecondaryStat]
			n, d, okV := statFrac(v, present)
			if !okV {
				return nil, false
			}
			nums[sid], dens[sid] = n, d
		}
		out := []string{}
		for _, p := range c.Tied {
			beaten := false
			for _, q := range c.Tied {
				if q != p && beatsFrac(c, nums[q], dens[q], nums[p], dens[p]) {
					beaten = true
					break
				}
			}
			if !beaten {
				out = append(out, p)
			}
		}
		return out, true
	}

	// bestByRatio is rung 2's `best` set over the full tie, by four-term cross-multiplication.
	bestByRatio := func(c ladderCase) ([]string, bool) {
		nums := map[string]*big.Int{}
		dens := map[string]*big.Int{}
		for _, sid := range c.Tied {
			n, d, ok := rung2Ratio(c, sid)
			if !ok {
				return nil, false
			}
			nums[sid], dens[sid] = n, d
		}
		out := []string{}
		for _, p := range c.Tied {
			beaten := false
			for _, q := range c.Tied {
				if q != p && beatsFrac(c, nums[q], dens[q], nums[p], dens[p]) {
					beaten = true
					break
				}
			}
			if !beaten {
				out = append(out, p)
			}
		}
		return out, true
	}

	hasH2H := func(c ladderCase) bool {
		for _, sid := range c.Tied {
			if p, ok := rowOf(c, sid); ok && len(p.H2H) > 0 {
				return true
			}
		}
		return false
	}

	// ⭐ THE SENTINEL ROW. Not "somebody exited at rung 4" — that is half the file. The row must
	// genuinely CONTAIN a -1, the winner must NOT be the -1 holder, and the NAIVE minimum must have
	// picked the -1 holder, so dropping the filter is guaranteed to change the answer.
	claim("rung-4-the-MINUS-ONE-sentinel-must-NEVER-win", func(c ladderCase) bool {
		if c.Expected.Kind != string(KindWinner) || c.Expected.LadderExitStep != LadderExitAchieved {
			return false
		}
		sentinelHolder := ""
		for _, sid := range c.Tied {
			if ts, ok := tsOf(c, sid); ok && ts == "-1" {
				sentinelHolder = sid
			}
		}
		if sentinelHolder == "" || sentinelHolder == c.Expected.SteamID64 {
			return false
		}
		// The naive `min` over the raw column really would have crowned the sentinel holder.
		naive, best := "", (*big.Int)(nil)
		for _, sid := range c.Tied {
			ts, ok := tsOf(c, sid)
			if !ok {
				return false
			}
			n, _ := new(big.Int).SetString(ts, 10)
			if best == nil || n.Cmp(best) < 0 {
				best, naive = n, sid
			}
		}
		return naive == sentinelHolder
	})

	// ⭐ THE ALL-ABSENT ROW: every tied player carries the sentinel, and the rung SKIPS without
	// narrowing, so the shared set is the WHOLE tie.
	claim("rung-4-when-EVERY-survivor-is-absent-the-rung-skips-to-rung-5", func(c ladderCase) bool {
		if c.Expected.Kind != string(KindShared) {
			return false
		}
		for _, sid := range c.Tied {
			if ts, ok := tsOf(c, sid); !ok || ts != "-1" {
				return false
			}
		}
		return len(c.Expected.Winners) == len(c.Tied)
	})

	// ⭐ THE deferred-work.md:281 ROW: two REAL, BYTE-IDENTICAL timestamps falling to rung 5.
	claim("rung-4-BYTE-IDENTICAL-timestamps-fall-through-to-the-shared-rung-5", func(c ladderCase) bool {
		if c.Expected.Kind != string(KindShared) || len(c.Tied) != 2 {
			return false
		}
		a, okA := tsOf(c, c.Tied[0])
		b, okB := tsOf(c, c.Tied[1])
		return okA && okB && a == b && a != "-1"
	})

	// ⭐ THE L3 ROW: a player is ELIMINATED at rung 1 and holds the strictly EARLIEST timestamp in
	// the whole tie, so a rung that restarted from `tied` would crown them at a different rung.
	// ⭐ THE ELIMINATED PLAYER'S TIMESTAMP MUST BE REAL, NOT THE SENTINEL (Story 6-5b). Without that
	// clause the rung-4 narrowing row — whose excluded player holds `-1`, numerically the smallest
	// value in the column — ALSO satisfies this property, and two rows claiming one property is
	// precisely the migration the uniqueness check exists to stop.
	claim("a-width-3-tie-NARROWS-to-2-at-rung-1-and-is-SHARED-at-rung-5", func(c ladderCase) bool {
		if c.Expected.Kind != string(KindShared) || len(c.Tied) <= len(c.Expected.Winners) {
			return false
		}
		eliminated := ""
		for _, sid := range c.Tied {
			found := false
			for _, w := range c.Expected.Winners {
				if w == sid {
					found = true
				}
			}
			if !found {
				eliminated = sid
			}
		}
		if eliminated == "" {
			return false
		}
		if ts, ok := tsOf(c, eliminated); !ok || ts == "-1" {
			return false
		}
		earliest, holder := (*big.Int)(nil), ""
		for _, sid := range c.Tied {
			ts, ok := tsOf(c, sid)
			if !ok {
				return false
			}
			n, _ := new(big.Int).SetString(ts, 10)
			if earliest == nil || n.Cmp(earliest) < 0 {
				earliest, holder = n, sid
			}
		}
		return holder == eliminated
	})

	// ⭐ THE L8 ROW: some pair records EXACTLY ONE direction, and nobody dominates.
	claim("rung-3-a-ONE-SIDED-h2h-record-is-not-comparable", func(c ladderCase) bool {
		h2h := map[string]map[string]map[string]ladderStat{}
		for _, p := range c.Players {
			h2h[p.SteamID64] = p.H2H
		}
		oneSided := false
		for _, p := range c.Tied {
			for _, q := range c.Tied {
				if p == q {
					continue
				}
				_, hasPQ := h2h[p][q]
				_, hasQP := h2h[q][p]
				if hasPQ != hasQP {
					oneSided = true
				}
			}
		}
		return oneSided
	})

	// ⭐ THE 'BEATS ALL, NOT BEATS ANY' ROW: nobody beats everyone, and MORE THAN ONE player beats
	// at least one opponent — so a relaxed comparator genuinely finds a different answer.
	// ⚠ `SecondaryStat == ""` IS PART OF THE CLAIM (Story 6-5b). The rung-3-over-a-NARROWED-set row
	// added by this pass also has nobody dominating the FULL tie and also has more than one player
	// beating somebody — that is exactly what makes it the row it is — so without this clause two
	// rows satisfy the property and neither is uniquely responsible for it. What THIS row alone
	// carries is a rung 3 that skips over the WHOLE tie, with no earlier rung having narrowed it.
	claim("rung-3-has-NO-strict-dominator-and-SKIPS-without-eliminating-anyone", func(c ladderCase) bool {
		if c.Award.SecondaryStat != "" {
			return false
		}
		players := map[string]ladderPlayer{}
		for _, p := range c.Players {
			players[p.SteamID64] = p
		}
		beatsSome := 0
		for _, p := range c.Tied {
			any, all := false, true
			for _, q := range c.Tied {
				if p == q {
					continue
				}
				pq, okPQ := players[p].H2H[q]
				qp, okQP := players[q].H2H[p]
				if !okPQ || !okQP {
					all = false
					continue
				}
				mine, _ := new(big.Int).SetString(pq[c.Award.DecidingStat].Value, 10)
				theirs, _ := new(big.Int).SetString(qp[c.Award.DecidingStat].Value, 10)
				if mine == nil || theirs == nil {
					return false
				}
				won := mine.Cmp(theirs) > 0
				if c.Award.Direction == string(DirectionMin) {
					won = mine.Cmp(theirs) < 0
				}
				if won {
					any = true
				} else {
					all = false
				}
			}
			if all {
				return false // somebody DOES dominate — the row is not what it claims
			}
			if any {
				beatsSome++
			}
		}
		return beatsSome > 1
	})

	// ⭐ THE L5 CROSS-CLASS ROW: a VOLUME award whose secondary key is a RATE key.
	// ⚠ The exit step is part of the claim. Another row also pairs a volume award with a rate
	// secondary (the S3 zero-denominator one), and it resolves at rung FOUR — so without this
	// clause two rows satisfy the property and neither is uniquely responsible for it. What THIS
	// row alone carries is a cross-class secondary that actually DECIDES the award at rung 1.
	claim("rung-1-a-RATE-secondary-cross-multiplies-and-crosses-CLASS", func(c ladderCase) bool {
		if c.Award.Class != string(ClassVolume) || c.Expected.LadderExitStep != LadderExitSecondary {
			return false
		}
		class, ok := classOfStatKey(c.Award.SecondaryStat)
		return ok && class == ClassRate
	})

	// ⭐ THE RUNG-2 DIVERGENCE ROW: the NAIVE compare — `efficiency[eff_num_key]` alone, ignoring
	// the denominator key — really does pick a DIFFERENT player. An efficiency case both methods
	// agree on proves nothing, exactly as 6-4a recorded for its float search.
	claim("rung-2-a-ratio-of-two-ratios-the-naive-single-pair-compare-gets-BACKWARDS", func(c ladderCase) bool {
		if c.Expected.Kind != string(KindWinner) || c.Expected.LadderExitStep != LadderExitEfficiency {
			return false
		}
		if c.Award.EffNumKey == "" || c.Award.EffDenKey == "" {
			return false
		}
		// ⚠ The rung-ORDER row (added by the mutation pass) also configures both efficiency keys and
		// also exits at step 2, and its naive compare also disagrees — so without this clause TWO
		// rows claim this property and neither is uniquely responsible for it. What THIS row alone
		// carries is a PURE rung-2 decision, with rung 1 declined.
		// ⚠ …AND WITH RUNG 3 UNCONFIGURED (Story 6-5b): the rung-2-early-return row added by this pass
		// is also a pure rung-2 decision whose naive compare also disagrees, and what distinguishes
		// the two is that THIS one has no head-to-head record at all while THAT one is about
		// returning past a populated rung 3.
		if c.Award.SecondaryStat != "" || hasH2H(c) {
			return false
		}
		naive, best := "", (*big.Rat)(nil)
		for _, sid := range c.Tied {
			for _, p := range c.Players {
				if p.SteamID64 != sid {
					continue
				}
				pair, ok := p.StatsInt.Efficiency[c.Award.EffNumKey]
				if !ok {
					return false
				}
				n, _ := new(big.Int).SetString(pair.Num, 10)
				d, _ := new(big.Int).SetString(pair.Den, 10)
				if n == nil || d == nil || d.Sign() == 0 {
					return false
				}
				r := new(big.Rat).SetFrac(n, d)
				if best == nil || r.Cmp(best) > 0 {
					best, naive = r, sid
				}
			}
		}
		return naive != "" && naive != c.Expected.SteamID64
	})

	// ⭐ THE ARITHMETIC-WIDTH ROW: both operands genuinely exceed 2^53, where a double rounds and an
	// int64 wraps. Below that threshold no inversion is possible at all (6-4a's measured finding).
	//
	// ⛔⛔ IT RE-DERIVES THE STRADDLE AND THE FLOAT FLIP, NOT MERELY THE MAGNITUDES. This counted
	// only "every `eff_num_key` numerator exceeds 2^53", which is true of ANY pair of large numbers
	// — so a regeneration that drifted the row to two ratios differing by a mile kept this gate
	// green while TypeScript's and Python's twins (which check the difference-of-one straddle and
	// the double-rounded flip) reddened. A one-sided gate over one shared row, in the flagship row
	// of the file. (Story 6-5b code review, 2026-08-06.)
	claim("rung-2-four-term-products-past-2-pow-53", func(c ladderCase) bool {
		if c.Award.EffNumKey == "" || c.Award.EffDenKey == "" || len(c.Tied) != 2 {
			return false
		}
		two53 := new(big.Int).Lsh(big.NewInt(1), 53)
		// The FOUR-TERM ratio for one player, from the row's own award keys.
		ratio := func(sid string) (*big.Int, *big.Int, bool) {
			for _, p := range c.Players {
				if p.SteamID64 != sid {
					continue
				}
				n, okN := p.StatsInt.Efficiency[c.Award.EffNumKey]
				d, okD := p.StatsInt.Efficiency[c.Award.EffDenKey]
				if !okN || !okD {
					return nil, nil, false
				}
				nn, _ := new(big.Int).SetString(n.Num, 10)
				nd, _ := new(big.Int).SetString(n.Den, 10)
				dn, _ := new(big.Int).SetString(d.Num, 10)
				dd, _ := new(big.Int).SetString(d.Den, 10)
				if nn == nil || nd == nil || dn == nil || dd == nil {
					return nil, nil, false
				}
				return new(big.Int).Mul(nn, dd), new(big.Int).Mul(nd, dn), true
			}
			return nil, nil, false
		}
		an, ad, okA := ratio(c.Tied[0])
		bn, bd, okB := ratio(c.Tied[1])
		if !okA || !okB {
			return false
		}
		// (1) the operands are genuinely past the double's exact-integer threshold…
		if an.Cmp(two53) < 0 || bn.Cmp(two53) < 0 {
			return false
		}
		// (2) …the CROSS PRODUCTS straddle a difference of exactly ONE, so the row cannot be
		// satisfied by any two large numbers — only by the narrowest possible true inequality…
		left := new(big.Int).Mul(an, bd)
		right := new(big.Int).Mul(bn, ad)
		diff := new(big.Int).Abs(new(big.Int).Sub(left, right))
		if diff.Cmp(big.NewInt(1)) != 0 {
			return false
		}
		// (3) …and a float64 compare of the same two ratios sees them EQUAL, so a double-precision
		// implementation provably cannot reproduce this row. That is the whole claim.
		af, _ := new(big.Rat).SetFrac(an, ad).Float64()
		bf, _ := new(big.Rat).SetFrac(bn, bd).Float64()
		return af == bf
	})

	// ⭐ THE S3 ROWS: a genuine zero denominator at rung 1 and at rung 2.
	claim("rung-1-a-zero-denominator-secondary-ties-everyone-S3-verbatim", func(c ladderCase) bool {
		if c.Award.SecondaryStat == "" {
			return false
		}
		for _, p := range c.Players {
			if s, ok := p.StatsInt.Secondary[c.Award.SecondaryStat]; ok && s.IsPair && s.Den == "0" {
				return true
			}
		}
		return false
	})

	// ⭐ THE `n/0` HALF OF S3, AND ONLY THAT HALF (tightened by Story 6-5b). It used to assert merely
	// "somebody's denominator key has a zero numerator", which is equally true of the `0/0` row this
	// pass added — and `0/0` is the OPPOSITE behaviour (equal to everything, rather than beating
	// everything). The claim is now the WINNER's own computed ratio: `n/0` with n > 0, resolving the
	// rung outright.
	claim("rung-2-a-zero-denominator-ratio-behaves-as-PLUS-INFINITY", func(c ladderCase) bool {
		if c.Expected.Kind != string(KindWinner) || c.Expected.LadderExitStep != LadderExitEfficiency {
			return false
		}
		num, den, ok := rung2Ratio(c, c.Expected.SteamID64)
		return ok && den.Sign() == 0 && num.Sign() > 0
	})

	// ── the rows Story 6-5b added ─────────────────────────────────────────────────────────────

	// ⭐⭐ RUNG 2's HEADLINE PROPERTY. Both efficiency slots name RATE keys, so all four factors of
	// the product are non-trivial — the state in which "drop both the .Den and .Num factors" is
	// finally observable. Every other rung-2 row names volume keys, where two factors are the
	// literal 1 and the mutation is byte-identical.
	claim("rung-2-RATE-efficiency-keys-give-the-product-FOUR-non-trivial-terms", func(c ladderCase) bool {
		if c.Award.EffNumKey == "" || c.Award.EffDenKey == "" {
			return false
		}
		nClass, okN := classOfStatKey(c.Award.EffNumKey)
		dClass, okD := classOfStatKey(c.Award.EffDenKey)
		if !okN || !okD || nClass != ClassRate || dClass != ClassRate {
			return false
		}
		one := big.NewInt(1)
		for _, sid := range c.Tied {
			p, ok := rowOf(c, sid)
			if !ok {
				return false
			}
			for _, key := range []string{c.Award.EffNumKey, c.Award.EffDenKey} {
				pair, present := p.StatsInt.Efficiency[key]
				if !present || !pair.IsPair {
					return false
				}
				for _, half := range []string{pair.Num, pair.Den} {
					n, _ := new(big.Int).SetString(half, 10)
					if n == nil || n.Cmp(one) <= 0 {
						return false // a factor of 1 (or 0) is a trivial term — the state this row escapes
					}
				}
			}
		}
		return true
	})

	// ⭐ RUNG 2 UNDER `min`. Rungs 1, 3 and 4 each had a `min` row; rung 2 did not, so a mutation
	// hardcoding `max` at rung 2 alone survived the whole suite.
	// ⚠ `!anyInfinite`/`!anyZeroOverZero` separate it from the `min` + `n/0` row added by the 6-5b
	// code review, which is ALSO `min` and ALSO exits at rung 2. This row is `direction` over FINITE
	// ratios; that one is `direction` deciding which way a zero denominator points.
	claim("rung-2-under-direction-min-picks-the-SMALLEST-ratio", func(c ladderCase) bool {
		return c.Award.Direction == string(DirectionMin) &&
			c.Expected.LadderExitStep == LadderExitEfficiency &&
			!anyInfinite(c) && !anyZeroOverZero(c)
	})

	// ⭐⭐ `n/0` UNDER `min` — the shape that existed in NO row of EITHER vector file. Every
	// zero-denominator row here and all four in `stage2-resolve.json` are `max`, so a mutant that
	// short-circuits "a zero denominator wins the rung", ignoring `direction`, was byte-identical on
	// every case in both. Under `min`, `n/0` LOSES to every finite value.
	claim("rung-2-under-direction-min-a-ZERO-DENOMINATOR-ratio-LOSES-to-every-finite-one", func(c ladderCase) bool {
		if c.Award.Direction != string(DirectionMin) || c.Expected.LadderExitStep != LadderExitEfficiency {
			return false
		}
		infinite := 0
		for _, sid := range c.Tied {
			num, den, ok := rung2Ratio(c, sid)
			if !ok {
				return false
			}
			if den.Sign() == 0 && num.Sign() > 0 {
				infinite++
				// The `n/0` holder must NOT be the winner — under `max` that same player takes the
				// rung outright, so the row observes the direction and nothing else.
				if sid == c.Expected.SteamID64 {
					return false
				}
			}
		}
		return infinite == 1
	})

	// ⭐ L3 AT RUNG 2: the rung NARROWS and resolves NOTHING, so a later rung runs over its
	// survivors. ⚠ `!anyZeroOverZero` is what separates it from the `0/0` row below, which also
	// narrows without resolving — there the survivor rides through on an UNBEATABLE ratio, here on
	// an exactly-equal one.
	claim("rung-2-NARROWS-without-resolving-and-the-NEXT-rung-runs-over-the-SURVIVORS", func(c ladderCase) bool {
		if c.Award.EffNumKey == "" || c.Award.EffDenKey == "" {
			return false
		}
		if c.Expected.LadderExitStep == LadderExitEfficiency || len(c.Tied) < 3 {
			return false
		}
		return !anyZeroOverZero(c)
	})

	// ⭐ THE `0/0` HALF OF S3 AT RUNG 2: a computed ratio of exactly 0/0, which is EQUAL to
	// everything and therefore UNELIMINABLE — the shipped `kills/deaths` pair's second degenerate
	// case, and the one the D1 decision promised a row for.
	claim("rung-2-a-ZERO-OVER-ZERO-ratio-is-UNELIMINABLE-and-rides-to-the-next-rung", func(c ladderCase) bool {
		// ⚠ The claim is the COMPUTED four-term ratio being 0/0, not "a zero appears somewhere". The
		// `n/0` row above has a zero denominator half and is the OPPOSITE behaviour, so the two are
		// distinguished by the computed value rather than by which half happens to be zero.
		// ⚠ `!anyInfinite` separates it from the `n/0`-meets-`0/0` row added by the 6-5b code
		// review, which also carries a `0/0` and also survives the rung: there the fact is that the
		// two DEGENERATE shapes are equal to each other, here that `0/0` alone is uneliminable.
		return anyZeroOverZero(c) && !anyInfinite(c) &&
			c.Expected.LadderExitStep != LadderExitEfficiency
	})

	// ⭐⭐ THE TWO DEGENERATE RATIOS IN ONE RACE — they had never met. Cross-multiplication makes
	// `n/0` and `0/0` EQUAL (`5*0 − 0*0 = 0`), so neither eliminates the other and both ride to
	// rung 5. An implementation reading them as IEEE doubles narrows to one and returns a WINNER at
	// rung 2 rather than a SHARED outcome at rung 5 — a different outcome KIND.
	claim("rung-2-an-INFINITE-and-a-ZERO-OVER-ZERO-ratio-are-EQUAL-and-BOTH-ride-through", func(c ladderCase) bool {
		if !anyInfinite(c) || !anyZeroOverZero(c) || c.Expected.Kind != string(KindShared) {
			return false
		}
		degenerate := 0
		shared := map[string]struct{}{}
		for _, w := range c.Expected.Winners {
			shared[w] = struct{}{}
		}
		for _, sid := range c.Tied {
			_, den, ok := rung2Ratio(c, sid)
			if !ok {
				return false
			}
			if den.Sign() == 0 {
				degenerate++
				// BOTH degenerate holders survive to the shared set…
				if _, in := shared[sid]; !in {
					return false
				}
			}
		}
		// …and somebody finite was eliminated, so the row proves the equality rather than merely
		// containing the two shapes.
		return degenerate == 2 && len(c.Expected.Winners) < len(c.Tied)
	})

	// ⭐⭐ RUNG 4's NARROWING, LOAD-BEARING FOR THE FIRST TIME: width >= 3, exactly one sentinel
	// holder, and the shared set EXCLUDES them. An implementation that skipped rung 4 whenever it
	// could not resolve shares with a player who has no approved rows at all.
	claim("rung-4-NARROWS-and-the-SENTINEL-holder-is-EXCLUDED-from-the-shared-set", func(c ladderCase) bool {
		if c.Expected.Kind != string(KindShared) || len(c.Tied) < 3 {
			return false
		}
		sentinels := 0
		for _, sid := range c.Tied {
			ts, ok := tsOf(c, sid)
			if !ok {
				return false
			}
			if ts == "-1" {
				sentinels++
				for _, w := range c.Expected.Winners {
					if w == sid {
						return false // the sentinel holder is a co-winner — the opposite of the claim
					}
				}
			}
		}
		return sentinels == 1 && len(c.Expected.Winners) >= 2 &&
			len(c.Expected.Winners) < len(c.Tied)
	})

	// ⭐ RUNG 1's EARLY RETURN, with rung 2 configured AND h2h populated. Falling through returns the
	// SAME winner at a FABRICATED exit step, because rung 2's best-of-one is that one and rung 3's
	// dominator loop is vacuously true for a lone survivor.
	// ⚠ THE COUNTERFACTUAL, NOT ONLY THE CONFIGURATION (6-5b code review). This asserted that the
	// later rungs were merely CONFIGURED — true of any row exiting at 1 with the keys filled in, and
	// satisfied without the later rungs disagreeing about anything. The anchor re-derives that rung
	// 2 and rung 3 each crown the OTHER player, which is what makes falling through observable as a
	// different WINNER rather than only a different step.
	claim("rung-1-RESOLVES-and-RETURNS-even-though-rung-2-and-h2h-are-CONFIGURED", func(c ladderCase) bool {
		if c.Expected.LadderExitStep != LadderExitSecondary {
			return false
		}
		if c.Award.EffNumKey == "" || c.Award.EffDenKey == "" || !hasH2H(c) {
			return false
		}
		r2, ok := bestByRatio(c)
		if !ok || len(r2) != 1 || r2[0] == c.Expected.SteamID64 {
			return false
		}
		doms := dominatorsOver(c, c.Tied)
		return len(doms) == 1 && doms[0] != c.Expected.SteamID64
	})

	// ⭐ RUNG 2's EARLY RETURN, with h2h populated — and here it changes the WINNER too, because the
	// other player is the strict dominator over the same set.
	// ⚠ Same strengthening: `h2h` being POPULATED is not the property — the property is that rung 3
	// would have crowned a DIFFERENT player, so a fall-through changes the winner, not just the step.
	claim("rung-2-RESOLVES-and-RETURNS-even-though-h2h-is-POPULATED", func(c ladderCase) bool {
		if c.Expected.LadderExitStep != LadderExitEfficiency || c.Award.SecondaryStat != "" || !hasH2H(c) {
			return false
		}
		doms := dominatorsOver(c, c.Tied)
		return len(doms) == 1 && doms[0] != c.Expected.SteamID64
	})

	// ⭐ L3 AT RUNG 3: rung 1 narrows first, and a dominator emerges over the SURVIVORS that did not
	// exist over the full tie.
	// ⚠ THE WHOLE POINT IS THE DIFFERENCE BETWEEN THE TWO SETS, and the claim computed neither.
	// `exit == 3 && secondary set && width >= 3` is satisfied by any wide rung-3 row. The anchor
	// re-derives that rung 1 narrows to a PLURAL PROPER SUBSET and that nobody dominates the FULL
	// tie — without which an implementation computing dominators over `tied` gives the same answer.
	claim("rung-3-runs-over-rung-1s-SURVIVORS-so-a-DOMINATOR-emerges-the-full-tie-had-not", func(c ladderCase) bool {
		if c.Expected.LadderExitStep != LadderExitH2H || c.Award.SecondaryStat == "" || len(c.Tied) < 3 {
			return false
		}
		survivors, ok := bestBySecondary(c)
		if !ok || len(survivors) < 2 || len(survivors) >= len(c.Tied) {
			return false
		}
		overSurvivors := dominatorsOver(c, survivors)
		overAll := dominatorsOver(c, c.Tied)
		return len(overSurvivors) == 1 && overSurvivors[0] == c.Expected.SteamID64 && len(overAll) == 0
	})

	// ⭐ RUNG 3's CONJUNCTION, load-bearing for a POSITIVE result for the first time. Every rung-3
	// win in the file was decided over exactly TWO survivors, where "dominates every other"
	// collapses to "beats the one opponent" — so the loop across opponents could have returned on
	// its first success and nothing reddened. A "beats at least one" implementation finds TWO
	// dominators here and raises the plural-dominator `internal` refusal instead of crowning.
	claim("rung-3-a-dominator-must-beat-EVERY-other-survivor-not-merely-ONE", func(c ladderCase) bool {
		if c.Expected.LadderExitStep != LadderExitH2H || len(c.Tied) < 3 {
			return false
		}
		// The record is COMPLETE in both directions for every ordered pair, so nothing here rests
		// on L8's never-met skip.
		for _, p := range c.Tied {
			pRow, ok := rowOf(c, p)
			if !ok {
				return false
			}
			for _, q := range c.Tied {
				if p == q {
					continue
				}
				if _, present := pRow.H2H[q]; !present {
					return false
				}
			}
		}
		beats := func(p, q string) bool {
			pRow, ok1 := rowOf(c, p)
			qRow, ok2 := rowOf(c, q)
			if !ok1 || !ok2 {
				return false
			}
			mv, mok := pRow.H2H[q][c.Award.DecidingStat]
			tv, tok := qRow.H2H[p][c.Award.DecidingStat]
			mn, md, o1 := statFrac(mv, mok)
			tn, td, o2 := statFrac(tv, tok)
			return o1 && o2 && beatsFrac(c, mn, md, tn, td)
		}
		beaten := 0
		for _, q := range c.Tied {
			if q != c.Expected.SteamID64 && beats(c.Expected.SteamID64, q) {
				beaten++
			}
		}
		// Somebody OTHER than the winner beats at least one opponent without dominating — which is
		// exactly what makes "beats one" and "beats all" different predicates on this row.
		partial := false
		for _, p := range c.Tied {
			if p == c.Expected.SteamID64 {
				continue
			}
			wins, losses := 0, 0
			for _, q := range c.Tied {
				if q == p {
					continue
				}
				if beats(p, q) {
					wins++
				} else {
					losses++
				}
			}
			if wins > 0 && losses > 0 {
				partial = true
			}
		}
		return beaten >= 2 && partial
	})

	// ⭐ THE RATE-CLASS AWARD: rung 3's rate arm, where `h2h[p][q][stat]` is a PAIR and the dominator
	// test cross-multiplies. Zero `class: rate` awards existed in this file before.
	// ⚠ IT MUST ACTUALLY REACH RUNG 3, AND THE h2h MUST BE NON-EMPTY (6-5b code review). Without
	// both clauses the loop below was VACUOUSLY TRUE over a row with no h2h at all — which is how
	// the rate-award-with-a-volume-secondary row (class `rate`, deciding key `hs_pct`, no
	// head-to-head anywhere, exits at rung 1) satisfied a claim about rung 3's rate arm. A vacuous
	// loop is the same defect class as a vacuous guard, one level down.
	claim("a-RATE-class-award-cross-multiplies-its-h2h-PAIRS-at-rung-3", func(c ladderCase) bool {
		if c.Award.Class != string(ClassRate) {
			return false
		}
		class, ok := classOfStatKey(c.Award.DecidingStat)
		if !ok || class != ClassRate {
			return false
		}
		if c.Expected.LadderExitStep != LadderExitH2H || !hasH2H(c) {
			return false
		}
		// every h2h value the rung reads really is a PAIR, not a bare magnitude
		for _, sid := range c.Tied {
			p, found := rowOf(c, sid)
			if !found {
				return false
			}
			for _, block := range p.H2H {
				v, present := block[c.Award.DecidingStat]
				if !present || !v.IsPair {
					return false
				}
			}
		}
		return true
	})

	// ⭐ L5's MIRROR: a `class: rate` award whose SECONDARY is a VOLUME key. The file pinned a volume
	// award with a rate secondary; the reverse pairing appeared nowhere, because the only
	// `class: rate` award carried no secondary at all. A rule that holds in one direction only is
	// not a rule — an implementation branching on `award.class` reads a bare integer as a pair here.
	claim("a-RATE-class-award-with-a-VOLUME-secondary-crosses-CLASS-the-OTHER-way", func(c ladderCase) bool {
		if c.Award.Class != string(ClassRate) || c.Award.SecondaryStat == "" {
			return false
		}
		secClass, ok := classOfStatKey(c.Award.SecondaryStat)
		if !ok || secClass != ClassVolume {
			return false
		}
		if c.Expected.LadderExitStep != LadderExitSecondary {
			return false
		}
		// Every value rung 1 actually reads is a BARE MAGNITUDE, not a pair — the shape the
		// award-class branch would misread — and the winner holds the largest of them.
		best, holder := new(big.Int), ""
		for i, sid := range c.Tied {
			p, found := rowOf(c, sid)
			if !found {
				return false
			}
			v, present := p.StatsInt.Secondary[c.Award.SecondaryStat]
			if !present || v.IsPair {
				return false
			}
			n, _ := new(big.Int).SetString(v.Value, 10)
			if n == nil {
				return false
			}
			if i == 0 || n.Cmp(best) > 0 {
				best, holder = n, sid
			}
		}
		return holder == c.Expected.SteamID64
	})

	// ⭐⭐ A ROSTER WIDER THAN THE TIE, REACHING THE LATE RUNGS. The only other row with an outsider
	// exits at RUNG 1, so rungs 2-5 had never run against one — and that is the ORDINARY production
	// shape, since 0024 freezes the whole roster and 6.6 drives a REDUCED tie against it.
	claim("a-NON-TIED-player-with-a-CORRUPT-ts-and-a-DOMINANT-h2h-is-INVISIBLE-to-BOTH", func(c ladderCase) bool {
		if c.Expected.LadderExitStep != LadderExitAchieved {
			return false
		}
		inTied := map[string]struct{}{}
		for _, sid := range c.Tied {
			inTied[sid] = struct{}{}
		}
		outsiders := []string{}
		for _, p := range c.Players {
			if _, ok := inTied[p.SteamID64]; !ok {
				outsiders = append(outsiders, p.SteamID64)
			}
		}
		if len(outsiders) != 1 {
			return false
		}
		out := outsiders[0]
		outRow, ok := rowOf(c, out)
		if !ok || outRow.AchievementTS == nil {
			return false
		}
		outTS, _ := new(big.Int).SetString(*outRow.AchievementTS, 10)
		if outTS == nil {
			return false
		}
		// (1) BELOW the published sentinel, so a roster-wide `achievement_ts` validation must REFUSE
		// an input the other two implementations resolve.
		if outTS.Cmp(big.NewInt(-1)) >= 0 {
			return false
		}
		// (2) strictly earlier than every tied member, so a roster-wide rung 4 crowns them.
		for _, sid := range c.Tied {
			raw, okTS := tsOf(c, sid)
			if !okTS {
				return false
			}
			n, _ := new(big.Int).SetString(raw, 10)
			if n == nil || outTS.Cmp(n) >= 0 {
				return false
			}
		}
		// (3) the sole dominator over the ROSTER, while NOBODY dominates over the tie — so a
		// roster-wide rung 3 crowns them at step 3 and the correct ladder skips the rung entirely.
		all := append(append([]string{}, c.Tied...), out)
		overRoster := dominatorsOver(c, all)
		return len(overRoster) == 1 && overRoster[0] == out && len(dominatorsOver(c, c.Tied)) == 0
	})

	// ⭐ `achievement_ts` AT ZERO — the value adjacent to the sentinel, so a `ts <= 0` absent-filter
	// passed every other row in the file.
	claim("an-achievement_ts-of-ZERO-is-a-REAL-timestamp-and-WINS-rung-4", func(c ladderCase) bool {
		zero := false
		for _, sid := range c.Tied {
			ts, ok := tsOf(c, sid)
			if !ok || ts == "-1" {
				return false
			}
			if ts == "0" {
				zero = true
			}
		}
		return zero && c.Expected.SteamID64 != "" &&
			func() bool { ts, ok := tsOf(c, c.Expected.SteamID64); return ok && ts == "0" }()
	})

	// ⭐ `achievement_ts` PAST 2^53 — the provenance rule's own proof. A `Number`-parsing verifier
	// reads both as 2^53, sees them EQUAL, and bottoms out shared at step 5.
	//
	// ⛔ THE FLOAT-COLLAPSE CLAUSE IS WHAT MAKES IT THE CLAIM. This asserted only "every timestamp
	// exceeds 2^53 and all are distinct as STRINGS" — so regenerating with 2^53 and 2^60 would have
	// kept Go green while TypeScript (`new Set(raw.map(Number)).size === 1`, commented "which is the
	// whole claim") and Python both reddened, and the row would have silently stopped proving that a
	// `Number`-parsing verifier diverges. (Story 6-5b code review, 2026-08-06.)
	claim("an-achievement_ts-past-2-pow-53-is-compared-EXACTLY", func(c ladderCase) bool {
		two53 := new(big.Int).Lsh(big.NewInt(1), 53)
		distinct := map[string]struct{}{}
		asFloat := map[float64]struct{}{}
		for _, sid := range c.Tied {
			ts, ok := tsOf(c, sid)
			if !ok {
				return false
			}
			n, _ := new(big.Int).SetString(ts, 10)
			if n == nil || n.Cmp(two53) < 0 {
				return false
			}
			distinct[ts] = struct{}{}
			f, _ := new(big.Float).SetInt(n).Float64()
			asFloat[f] = struct{}{}
		}
		// Distinct as EXACT integers, and INDISTINGUISHABLE as float64 — both halves, or the row is
		// satisfied by any oversized pair.
		return len(distinct) == len(c.Tied) && len(asFloat) == 1
	})

	// ⭐ A PLAYER OUTSIDE `tied` — so an implementation iterating the ROSTER rather than the
	// SURVIVORS is finally distinguishable. The outsider must be dominant, or the row proves nothing.
	//
	// ⛔⛔ AND IT NOW CHECKS THE DOMINANCE THE COMMENT ABOVE PROMISES. It returned `outsiders >= 1`
	// — narration wearing a measurement's clothes, in a guard added to close exactly that defect,
	// and found independently by all three layers of the 6-5b code review. A fixture edit making the
	// outsider a LOSER left this green while the row stopped distinguishing a roster-iterating
	// ladder from a correct one; only the Python anchor re-derived it.
	claim("a-player-who-is-NOT-in-the-tied-set-is-INVISIBLE-to-every-rung", func(c ladderCase) bool {
		if c.Award.SecondaryStat == "" || c.Expected.LadderExitStep != LadderExitSecondary {
			return false
		}
		inTied := map[string]struct{}{}
		for _, sid := range c.Tied {
			inTied[sid] = struct{}{}
		}
		// The tie's best secondary and earliest timestamp — the two bars the outsider must clear.
		bestTied, earliestTied := new(big.Int), new(big.Int)
		for i, sid := range c.Tied {
			p, ok := rowOf(c, sid)
			if !ok {
				return false
			}
			s, ok := p.StatsInt.Secondary[c.Award.SecondaryStat]
			if !ok || s.IsPair {
				return false
			}
			raw, okTS := tsOf(c, sid)
			if !okTS {
				return false
			}
			v, _ := new(big.Int).SetString(s.Value, 10)
			ts, _ := new(big.Int).SetString(raw, 10)
			if v == nil || ts == nil {
				return false
			}
			if i == 0 || v.Cmp(bestTied) > 0 {
				bestTied = v
			}
			if i == 0 || ts.Cmp(earliestTied) < 0 {
				earliestTied = ts
			}
		}
		outsiders := 0
		for _, p := range c.Players {
			if _, ok := inTied[p.SteamID64]; ok {
				continue
			}
			outsiders++
			s, ok := p.StatsInt.Secondary[c.Award.SecondaryStat]
			if !ok || s.IsPair {
				return false
			}
			if p.AchievementTS == nil {
				return false
			}
			v, _ := new(big.Int).SetString(s.Value, 10)
			ts, _ := new(big.Int).SetString(*p.AchievementTS, 10)
			if v == nil || ts == nil {
				return false
			}
			// Strictly better on BOTH axes: the outsider would have won the rung it is excluded
			// from AND the last rung. A non-tied player who lost anyway proves nothing.
			if v.Cmp(bestTied) <= 0 || ts.Cmp(earliestTied) >= 0 {
				return false
			}
		}
		return outsiders >= 1
	})

	// ⭐ THE ABSENT-CONTAINER ROW: a TIED player whose `secondary`, `efficiency` and `h2h` keys are
	// all OMITTED from the JSON, so Go's nil-map read and TypeScript's `container(undefined)` are
	// entered at last. All three, because two of three leaves one container untested.
	claim("ABSENT-secondary-efficiency-and-h2h-BLOCKS-are-the-EMPTY-blocks", func(c ladderCase) bool {
		for _, sid := range c.Tied {
			p, ok := rowOf(c, sid)
			if !ok {
				return false
			}
			if p.StatsInt.Secondary == nil && p.StatsInt.Efficiency == nil && p.H2H == nil {
				return true
			}
		}
		return false
	})

	// EVERY RUNG MUST BE EXITED AT BY AT LEAST ONE ROW — AC4's floor.
	reached := map[int]int{}
	for _, c := range v.Cases {
		reached[c.Expected.LadderExitStep]++
	}
	for _, step := range v.ExitSteps {
		if reached[step] == 0 {
			t.Errorf("no case exits at rung %d — AC4 requires at least one at each of 1..5", step)
		}
	}
}

// ── the loader rule: absent is absent, however it is spelled ────────────────────

// ⭐ ITS OWN NAMED TEST, because the whole regenerability of `stage2-resolve.json` rests on it.
// The three rows differ ONLY in how absence is written — explicit `null`, the key omitted entirely,
// and the empty string — and their outcomes must be indistinguishable. A loader that turned an
// absent key into a present-but-empty one, or that treated `""` as an invalid vocabulary key, fails
// here and only here.
func TestLadderAbsentRungKeySpellingsAreIndistinguishable(t *testing.T) {
	v := loadLadder(t)
	names := []string{
		"rung-keys-spelled-as-explicit-JSON-null",
		"rung-keys-OMITTED-from-the-award-object-entirely",
		"rung-keys-spelled-as-EMPTY-STRINGS",
	}
	outcomes := make([]Outcome, 0, len(names))
	for _, name := range names {
		var tc *ladderCase
		for i := range v.Cases {
			if v.Cases[i].Name == name {
				tc = &v.Cases[i]
			}
		}
		if tc == nil {
			t.Fatalf("the %q row is gone — the loader rule is now covered by nothing", name)
		}
		// The three spellings must arrive at the SAME Award value, not merely at the same outcome.
		award := toLadderAward(tc.Award)
		if award.SecondaryStat != "" || award.EffNumKey != "" || award.EffDenKey != "" {
			t.Errorf("%s: the loader produced a non-empty rung key %+v", name, award)
		}
		got, err := ResolveLadder(award, tc.Tied, toLadderPlayers(t, tc.Players))
		if err != nil {
			t.Fatalf("%s refused: %v", name, err)
		}
		outcomes = append(outcomes, got)
	}
	for i := 1; i < len(outcomes); i++ {
		if outcomes[i].Kind != outcomes[0].Kind ||
			outcomes[i].SteamID64 != outcomes[0].SteamID64 ||
			outcomes[i].LadderExitStep != outcomes[0].LadderExitStep {
			t.Errorf("%s produced %+v, %s produced %+v — absence must be absence however it is spelled",
				names[i], outcomes[i], names[0], outcomes[0])
		}
	}
}

// ── the port, and what it refuses ──────────────────────────────────────────────

// The ladder is driven through the PORT as well as through the pure entry point, so the wiring
// `ResolveAward` performs is exercised by every tie the vector carries rather than merely declared.
func TestFR29LadderResolvesThroughThePort(t *testing.T) {
	v := loadLadder(t)
	for _, tc := range v.Cases {
		t.Run(tc.Name, func(t *testing.T) {
			award := toLadderAward(tc.Award)
			players := toLadderPlayers(t, tc.Players)
			tie := Outcome{Kind: KindTie, Tied: tc.Tied, Reason: ReasonEqualValue}

			viaPort, err := FR29Ladder{}.Resolve(award, tie, players)
			if err != nil {
				t.Fatalf("the port refused a CASE row: %v", err)
			}
			direct, err := ResolveLadder(award, tc.Tied, players)
			if err != nil {
				t.Fatalf("the pure entry point refused a CASE row: %v", err)
			}
			// ⭐ THE WHOLE OUTCOME, NOT FOUR OF ITS FIELDS (Story 6-5b, T6). This used to compare
			// Kind/SteamID64/LadderExitStep/Winners by hand, so a port that FABRICATED a DecidingValue —
			// exactly the "plausible-looking lie 6.8 renders on stage" that L12 forbids — survived the
			// entire Go suite, while TypeScript's `toEqual` caught it. `reflect.DeepEqual` compares
			// `*big.Int` pointers structurally, so it is the right tool here rather than `==`.
			if !reflect.DeepEqual(viaPort, direct) {
				t.Errorf("the port and the pure entry point disagree: %+v vs %+v", viaPort, direct)
			}
		})
	}
}

// ⛔ DECISION K — a no_awardable_value outcome CARRIES a tied set, and the ladder must refuse to
// resolve it. Resolving it would re-crown the 27-way zero tie DECISION E exists to suppress.
func TestFR29LadderRefusesANonTieOutcome(t *testing.T) {
	award := Award{DecidingStat: "kills", Class: ClassVolume, Direction: DirectionMax}
	players := []SnapshotPlayer{
		{SteamID64: "1", RoundsPlayed: big.NewInt(0), Kills: big.NewInt(0), AchievementTS: big.NewInt(1)},
		{SteamID64: "2", RoundsPlayed: big.NewInt(0), Kills: big.NewInt(0), AchievementTS: big.NewInt(2)},
	}
	for _, kind := range []OutcomeKind{KindNoAwardableValue, KindNoEligiblePlayers, KindWinner, KindShared} {
		out, err := FR29Ladder{}.Resolve(award, Outcome{Kind: kind, Tied: []string{"1", "2"}}, players)
		if err == nil {
			t.Errorf("the port resolved a %q outcome: %+v", kind, out)
			continue
		}
		var invalid *LadderInvalidError
		if !errors.As(err, &invalid) || invalid.Detail != LadderDetailTied {
			t.Errorf("a %q outcome refused as %v, want detail %q", kind, err, LadderDetailTied)
		}
	}
}

// TestLadderDeclaredDivergenceIsInspected — the declared divergence is CHECKED, not merely emitted.
//
// ⭐⭐ `deferred-work.md:326`, and this is the half that was missing. Story 6.11 added
// `declared_divergences` to `ladder-resolve.json` and annotated the debt CLOSED; its code review found
// that a repo-wide grep for the key returned hits only in the generator, the JSON and story prose. The
// block's own `resolution` field claims "Both suites assert their own label, and this row is what
// makes the asymmetry a contract instead of two comments that can drift apart" — which was untrue
// until this test and its TypeScript twin existed.
//
// ⛔ THIS ASSERTS THE **Go** LABEL AGAINST THE **RUNTIME**. The block says Go refuses `tied` where
// TypeScript refuses `player`, because Go normalises the absent container to empty and then discovers
// the tied members have no matching snapshot row. If someone "unified" the two — which the block
// explicitly forbids — one side would stop matching the vector and redden here or in `ladder.test.ts`.
func TestLadderDeclaredDivergenceIsInspected(t *testing.T) {
	v := loadLadder(t)

	// ⛔ NON-VACUITY. A `range` over an empty slice runs zero times and passes — the shape this
	// project has now recorded six times. The block must exist before anything is asserted about it.
	if len(v.DeclaredDivergences) == 0 {
		t.Fatal("ladder-resolve.json declares no divergences — `deferred-work.md:326` is carried by " +
			"this block, and an empty one makes every assertion below vacuous")
	}

	declared := make(map[string]struct{}, len(v.RefusalDetails))
	for _, d := range v.RefusalDetails {
		declared[d] = struct{}{}
	}

	found := false
	for _, d := range v.DeclaredDivergences {
		if !strings.Contains(strings.ToUpper(d.Input), "NON-ARRAY") {
			continue
		}
		found = true

		if d.RowRepresentable {
			t.Errorf("the non-array-roster divergence claims to be row-representable; if it is, it " +
				"belongs in `refusals` as a row, not in this block")
		}
		// The asymmetry IS the entry. If the three ever agreed, delete the entry rather than keep it.
		if d.TypeScript == d.Go {
			t.Errorf("typescript %q and go %q agree — this entry no longer describes a divergence",
				d.TypeScript, d.Go)
		}
		if d.Go != d.Python {
			t.Errorf("go %q and python %q disagree; the block declares both normalise to empty and "+
				"refuse the same way", d.Go, d.Python)
		}
		for _, label := range []string{d.TypeScript, d.Go} {
			if _, ok := declared[label]; !ok {
				t.Errorf("declared divergence label %q is outside the refusal_details set %v",
					label, v.RefusalDetails)
			}
		}

		// …and the label the vector attributes to Go is RE-DERIVED from a real call. A nil slice is
		// the closest this runtime can come to "players supplied as a non-array".
		award := Award{DecidingStat: "kills", Class: ClassVolume, Direction: DirectionMax}
		out, err := ResolveLadder(award, []string{"11", "22"}, nil)
		if err == nil {
			t.Fatalf("a nil roster resolved to %+v — it must refuse", out)
		}
		var invalid *LadderInvalidError
		if !errors.As(err, &invalid) {
			t.Fatalf("refusal is not a *LadderInvalidError: %v", err)
		}
		if invalid.Detail != d.Go {
			t.Errorf("a nil roster refused as %q, the vector attributes %q to Go — the declared "+
				"divergence has drifted from what this runtime does", invalid.Detail, d.Go)
		}
	}
	if !found {
		t.Error("no declared divergence describes the NON-ARRAY roster input, which is the one " +
			"`deferred-work.md:326` is about")
	}
}

// The refusing 6-4a-era ladder SURVIVES (DECISION J) and still refuses through the widened port.
// It is what every tie row in `stage2-resolve.json` is driven through, and 6-4a's mutation M13 only
// became vector-killable that way.
func TestRefusingLadderStillRefusesThroughTheWidenedPort(t *testing.T) {
	award := Award{DecidingStat: "kills", Class: ClassVolume, Direction: DirectionMax}
	tie := Outcome{Kind: KindTie, Tied: []string{"1", "2"}, Reason: ReasonEqualValue}
	out, err := RefusingLadder{}.Resolve(award, tie, nil)
	if err == nil {
		t.Fatal("RefusingLadder resolved a tie")
	}
	var refused *LadderRefusedError
	if !errors.As(err, &refused) {
		t.Errorf("RefusingLadder returned %v, want a *LadderRefusedError", err)
	}
	if strings.Join(out.Tied, ",") != "1,2" {
		t.Errorf("RefusingLadder dropped the tie it was handed: %+v", out)
	}
}

// ── local table-driven guards, each asserting its DETAIL ───────────────────────
//
// ⭐ EVERY LOCAL REFUSAL ASSERTS THE `detail`, FROM THE START. The 6-4b review found the TypeScript
// local table asserting only the error CLASS, which left two guards mutation-invisible — a negative
// shelf was laundered into a NaN three functions later and still threw the right class. These rows
// cover states the shared vector cannot represent (a nil block, a nil magnitude) rather than
// duplicating it.
func TestLadderLocalRefusals(t *testing.T) {
	ts := func(n int64) *big.Int { return big.NewInt(n) }
	base := func() []SnapshotPlayer {
		return []SnapshotPlayer{
			{SteamID64: "11", RoundsPlayed: ts(30), Kills: ts(20), AchievementTS: ts(1000)},
			{SteamID64: "22", RoundsPlayed: ts(30), Kills: ts(20), AchievementTS: ts(2000)},
		}
	}

	cases := []struct {
		name    string
		award   Award
		tied    []string
		players []SnapshotPlayer
		detail  string
	}{
		{
			name: "a nil Secondary block still lands on the absent-KEY refusal",
			// ⚠ An absent CONTAINER is the empty container (Go cannot tell nil from empty), so the
			// nil map is accepted and the absent KEY is what refuses — the right answer for the
			// right reason, one line later.
			award:   Award{DecidingStat: "kills", Class: ClassVolume, Direction: DirectionMax, SecondaryStat: "hs_kills"},
			tied:    []string{"11", "22"},
			players: base(),
			detail:  LadderDetailPlayer,
		},
		{
			name:    "a nil AchievementTS is a refusal, never a zero",
			award:   Award{DecidingStat: "kills", Class: ClassVolume, Direction: DirectionMax},
			tied:    []string{"11", "22"},
			players: []SnapshotPlayer{{SteamID64: "11", AchievementTS: nil}, {SteamID64: "22", AchievementTS: ts(1)}},
			detail:  LadderDetailPlayer,
		},
		{
			name:    "a tied member absent from the roster",
			award:   Award{DecidingStat: "kills", Class: ClassVolume, Direction: DirectionMax},
			tied:    []string{"11", "33"},
			players: base(),
			detail:  LadderDetailTied,
		},
		{
			name:    "a non-decimal steamid64 in the tied set",
			award:   Award{DecidingStat: "kills", Class: ClassVolume, Direction: DirectionMax},
			tied:    []string{"11", "2x"},
			players: base(),
			detail:  LadderDetailTied,
		},
		{
			name:    "an empty deciding stat refuses at the Stage-2 surface, before the vocabulary check",
			award:   Award{DecidingStat: "", Class: ClassVolume, Direction: DirectionMax},
			tied:    []string{"11", "22"},
			players: base(),
			detail:  LadderDetailStage2,
		},
		{
			name:    "a duplicate player row",
			award:   Award{DecidingStat: "kills", Class: ClassVolume, Direction: DirectionMax},
			tied:    []string{"11", "22"},
			players: append(base(), SnapshotPlayer{SteamID64: "11", AchievementTS: ts(9)}),
			detail:  LadderDetailPlayer,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			out, err := ResolveLadder(tc.award, tc.tied, tc.players)
			if err == nil {
				t.Fatalf("resolved: %+v", out)
			}
			if !errors.Is(err, ErrLadder) {
				t.Errorf("not an ErrLadder: %v", err)
			}
			var invalid *LadderInvalidError
			if !errors.As(err, &invalid) {
				t.Fatalf("not a *LadderInvalidError: %v", err)
			}
			if invalid.Detail != tc.detail {
				t.Errorf("detail = %q, want %q: %v", invalid.Detail, tc.detail, err)
			}
		})
	}
}

// The ladder never sorts, re-filters or re-derives (L12). Driven over every vector case: the input
// slices must be exactly as the caller left them afterwards.
func TestLadderDoesNotMutateItsInputs(t *testing.T) {
	v := loadLadder(t)
	for _, tc := range v.Cases {
		t.Run(tc.Name, func(t *testing.T) {
			tied := append([]string{}, tc.Tied...)
			before := strings.Join(tied, ",")
			players := toLadderPlayers(t, tc.Players)
			order := make([]string, len(players))
			for i, p := range players {
				order[i] = p.SteamID64
			}
			if _, err := ResolveLadder(toLadderAward(tc.Award), tied, players); err != nil {
				t.Fatalf("refused: %v", err)
			}
			if strings.Join(tied, ",") != before {
				t.Errorf("the ladder reordered the caller's tied slice: %v", tied)
			}
			for i, p := range players {
				if p.SteamID64 != order[i] {
					t.Errorf("the ladder reordered the caller's players slice")
					break
				}
			}
		})
	}
}

// ⭐ THE PURE STAGE STILL CANNOT RESOLVE A TIE. Asserted over EVERY case in `stage2-resolve.json`,
// not once: `ResolveStage2` must never return the new `shared` arm and never a non-absent exit step.
// The fifth arm exists only because a LADDER produced it.
func TestPureStage2NeverProducesALadderOutcome(t *testing.T) {
	v := loadStage2(t)
	for _, tc := range v.Cases {
		t.Run(tc.Name, func(t *testing.T) {
			got, err := ResolveStage2(toAward(tc.Award), toPlayers(t, tc.Players))
			if err != nil {
				t.Fatalf("refused: %v", err)
			}
			if got.Kind == KindShared {
				t.Error("the PURE stage returned a shared outcome — only a ladder can")
			}
			if got.LadderExitStep != LadderExitNone {
				t.Errorf("the PURE stage set ladder_exit_step = %d — no ladder ran", got.LadderExitStep)
			}
			if len(got.Winners) != 0 {
				t.Errorf("the PURE stage returned Winners = %v", got.Winners)
			}
		})
	}
}
