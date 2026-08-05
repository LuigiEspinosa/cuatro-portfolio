package awards

import (
	"encoding/json"
	"errors"
	"math/big"
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
		Volume     map[string]string     `json:"volume"`
		Rate       map[string]stage2Rate `json:"rate"`
		Secondary  map[string]ladderStat `json:"secondary"`
		Efficiency map[string]stage2Rate `json:"efficiency"`
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
	Refusals []ladderRefusalRow `json:"refusals"`
	Cases    []ladderCase       `json:"cases"`
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
			Secondary:    map[string]StatValue{},
			Efficiency:   map[string]RatePair{},
			H2H:          map[string]map[string]StatValue{},
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
	"a-width-3-tie-NARROWS-to-2-at-rung-1-and-is-SHARED-at-rung-5",
	"rung-1-a-RATE-secondary-cross-multiplies-and-crosses-CLASS",
	"rung-1-a-VOLUME-secondary-breaks-the-tie",
	"rung-1-a-zero-denominator-secondary-ties-everyone-S3-verbatim",
	"rung-1-direction-min-inverts-the-secondary",
	"rung-1-is-SKIPPED-when-secondary_stat-is-NULL",
	"rung-2-a-ratio-of-two-ratios-the-naive-single-pair-compare-gets-BACKWARDS",
	"rung-2-a-zero-denominator-ratio-behaves-as-PLUS-INFINITY",
	"rung-2-four-term-products-past-2-pow-53",
	"rung-2-is-SKIPPED-when-both-efficiency-keys-are-NULL",
	"rung-2-runs-over-rung-1s-SURVIVORS-so-the-ORDER-of-the-rungs-decides",
	"rung-3-a-ONE-SIDED-h2h-record-is-not-comparable",
	"rung-3-a-strict-dominator-wins",
	"rung-3-direction-min-inverts-the-head-to-head",
	"rung-3-has-NO-strict-dominator-and-SKIPS-without-eliminating-anyone",
	"rung-4-BYTE-IDENTICAL-timestamps-fall-through-to-the-shared-rung-5",
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
	claim("rung-3-has-NO-strict-dominator-and-SKIPS-without-eliminating-anyone", func(c ladderCase) bool {
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
		if c.Award.SecondaryStat != "" {
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
	claim("rung-2-four-term-products-past-2-pow-53", func(c ladderCase) bool {
		if c.Award.EffNumKey == "" {
			return false
		}
		two53 := new(big.Int).Lsh(big.NewInt(1), 53)
		count := 0
		for _, p := range c.Players {
			pair, ok := p.StatsInt.Efficiency[c.Award.EffNumKey]
			if !ok {
				return false
			}
			n, _ := new(big.Int).SetString(pair.Num, 10)
			if n != nil && n.Cmp(two53) >= 0 {
				count++
			}
		}
		return count == len(c.Players) && count >= 2
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

	claim("rung-2-a-zero-denominator-ratio-behaves-as-PLUS-INFINITY", func(c ladderCase) bool {
		if c.Award.EffDenKey == "" {
			return false
		}
		for _, p := range c.Players {
			if pair, ok := p.StatsInt.Efficiency[c.Award.EffDenKey]; ok && pair.Num == "0" {
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
			if viaPort.Kind != direct.Kind || viaPort.SteamID64 != direct.SteamID64 ||
				viaPort.LadderExitStep != direct.LadderExitStep ||
				strings.Join(viaPort.Winners, ",") != strings.Join(direct.Winners, ",") {
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
