package awards

import (
	"errors"
	"math/big"
	"sort"
	"strconv"
	"strings"
	"testing"
)

// ── the shared contract ────────────────────────────────────────────────────────
//
// These tests read `roulette/vectors/stage2-resolve.json` AT RUNTIME through the 6.3 loader.
// Values are NEVER transcribed into Go literals: a hard-coded copy greens on the day the vector
// is regenerated and silently stops testing the contract.

type stage2Award struct {
	DecidingStat string `json:"deciding_stat"`
	Class        string `json:"class"`
	Direction    string `json:"direction"`
	FloorRounds  int    `json:"floor_rounds"`
	FloorKills   int    `json:"floor_kills"`
}

type stage2Rate struct {
	Num string `json:"num"`
	Den string `json:"den"`
}

type stage2Player struct {
	SteamID64    string `json:"steamid64"`
	RoundsPlayed string `json:"rounds_played"`
	Kills        string `json:"kills"`
	IdleDQ       bool   `json:"idle_dq"`
	StatsInt     struct {
		Volume map[string]string     `json:"volume"`
		Rate   map[string]stage2Rate `json:"rate"`
	} `json:"stats_int"`
}

type stage2Value struct {
	Class string `json:"class"`
	Value string `json:"value"`
	Num   string `json:"num"`
	Den   string `json:"den"`
}

type stage2Expected struct {
	Kind          string       `json:"kind"`
	SteamID64     string       `json:"steamid64"`
	DecidingValue *stage2Value `json:"deciding_value"`
	Tied          []string     `json:"tied"`
	Reason        string       `json:"reason"`
}

type stage2Case struct {
	Name     string         `json:"name"`
	Note     string         `json:"note"`
	Award    stage2Award    `json:"award"`
	Players  []stage2Player `json:"players"`
	Expected stage2Expected `json:"expected"`
}

type stage2Refusal struct {
	Why     string         `json:"why"`
	Award   stage2Award    `json:"award"`
	Players []stage2Player `json:"players"`
}

type stage2Vector struct {
	Vector       string          `json:"vector"`
	AlgoVersion  string          `json:"algo_version"`
	OutcomeKinds []string        `json:"outcome_kinds"`
	TieReasons   []string        `json:"tie_reasons"`
	Refusals     []stage2Refusal `json:"refusals"`
	Cases        []stage2Case    `json:"cases"`
}

// mustBig parses one vector magnitude.
//
// ⛔ GUARDED, not assumed. The 6.3 code review found the Go coverage test PANICKING the whole
// binary on a malformed `"n": 0` row instead of failing one named test — a vector that had
// silently drifted took the entire suite with it, and the failure said nothing about which row.
// Every magnitude here is a decimal STRING, so a malformed one fails this named parse rather
// than arriving as a zero.
// ⚠ THE SHAPE IS CHECKED BEFORE SetString SEES IT, so the two loaders accept exactly the same
// string set. `SetString(s, 10)` accepts a leading `+` and TypeScript's `/^-?[0-9]+$/` does not,
// so a magnitude written as "+5" loaded here and hard-failed there — a one-sided red, but the TS
// guard's comment claims parity with this parser and the 6-4a code review measured that it did
// not hold. The generator emits `str(int)`, which never produces a `+`, so the tighter shape is
// the honest common denominator.
func mustBig(t *testing.T, what, s string) *big.Int {
	t.Helper()
	if !decimalMagnitude(s) {
		t.Fatalf("vector carries a non-decimal magnitude for %s: %q", what, s)
	}
	v, ok := new(big.Int).SetString(s, 10)
	if !ok {
		t.Fatalf("vector carries a non-decimal magnitude for %s: %q", what, s)
	}
	return v
}

// decimalMagnitude is `^-?[0-9]+$`, character by character — the same set TypeScript's regexp
// accepts.
func decimalMagnitude(s string) bool {
	digits := s
	if strings.HasPrefix(digits, "-") {
		digits = digits[1:]
	}
	if digits == "" {
		return false
	}
	for i := 0; i < len(digits); i++ {
		if digits[i] < '0' || digits[i] > '9' {
			return false
		}
	}
	return true
}

func toAward(a stage2Award) Award {
	return Award{
		DecidingStat: a.DecidingStat,
		Class:        AwardClass(a.Class),
		Direction:    AwardDirection(a.Direction),
		FloorRounds:  a.FloorRounds,
		FloorKills:   a.FloorKills,
	}
}

func toPlayers(t *testing.T, rows []stage2Player) []SnapshotPlayer {
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
		for k, v := range r.StatsInt.Volume {
			p.Volume[k] = mustBig(t, r.SteamID64+".volume."+k, v)
		}
		for k, v := range r.StatsInt.Rate {
			p.Rate[k] = RatePair{
				Num: mustBig(t, r.SteamID64+".rate."+k+".num", v.Num),
				Den: mustBig(t, r.SteamID64+".rate."+k+".den", v.Den),
			}
		}
		out = append(out, p)
	}
	return out
}

func loadStage2(t *testing.T) stage2Vector {
	t.Helper()
	v := loadVector[stage2Vector](t, "stage2-resolve.json")
	if v.Vector != "stage2-resolve" {
		t.Fatalf("loaded the wrong vector file: %q", v.Vector)
	}
	if len(v.Cases) == 0 {
		t.Fatal("stage2-resolve.json has no cases")
	}
	return v
}

// ⭐ THE CASE-NAME SET IS PINNED BY EXACT EQUALITY, mirroring
// TestScannedSourceFilesAreExactlyTheShippedModules and lib/roulette's module list.
//
// The 6-4a code review measured why a `len(cases) > 0` check is not enough: deleting
// `volume-min-zero-is-awardable`, `rate-max-zero-numerator-is-awardable`,
// `volume-max-single-eligible-at-zero-no-awardable-value`, `volume-max-nonzero-best-over-zeros`
// and `an-absent-key-on-an-INELIGIBLE-player-is-not-an-error` left EVERY coverage flag below
// still satisfied by surviving rows, `--check` still reporting OK, and both suites green — so
// DECISION E's entire SCOPE (that it does NOT apply to `min` or to `rate`, and that it is a rule
// about the value rather than the tie width) became untested, which is the one claim the
// implementation's own comments make about this file. Adding a case reddens this deliberately.
var stage2CaseNames = []string{
	"an-absent-RATE-key-on-an-INELIGIBLE-player-is-not-an-error",
	"an-absent-key-on-an-INELIGIBLE-player-is-not-an-error",
	"byte-lex-is-a-string-order-not-a-numeric-one",
	"floor-kills-zero-still-compares",
	"floors-are-inclusive-at-the-boundary",
	"floors-exclude-everyone",
	"idle-dq-excluded",
	"idle-dq-leaves-nobody-eligible",
	"players-supplied-out-of-byte-lex-order",
	"rate-max-cross-multiplication-only",
	"rate-max-equal-cross-product-different-pairs",
	"rate-max-positive-numerator-over-zero-beats-every-finite-rate",
	"rate-max-realistic-adr",
	"rate-max-zero-numerator-is-awardable",
	"rate-min-el-inofensivo",
	"rate-min-equal-cross-product-tie",
	"rate-zero-denominator-clears-a-real-floor",
	"rate-zero-denominator-is-equal-to-everyone",
	"rate-zero-denominator-pair-ties",
	"volume-max-all-zero-no-awardable-value",
	"volume-max-equal-integer-tie",
	"volume-max-nonzero-best-over-zeros",
	"volume-max-plain",
	"volume-max-single-eligible-at-zero-no-awardable-value",
	"volume-max-three-way-tie",
	"volume-min-equal-integer-tie",
	"volume-min-plain",
	"volume-min-zero-is-awardable",
}

func TestVectorStage2CarriesExactlyTheExpectedCases(t *testing.T) {
	v := loadStage2(t)
	got := make([]string, 0, len(v.Cases))
	for _, c := range v.Cases {
		got = append(got, c.Name)
	}
	sort.Strings(got)
	if strings.Join(got, "\n") != strings.Join(stage2CaseNames, "\n") {
		t.Errorf("the vector's case set drifted.\n got: %v\nwant: %v", got, stage2CaseNames)
	}
}

// ── the conformance gate ───────────────────────────────────────────────────────

func TestVectorStage2Resolve(t *testing.T) {
	v := loadStage2(t)

	for _, tc := range v.Cases {
		t.Run(tc.Name, func(t *testing.T) {
			award := toAward(tc.Award)
			players := toPlayers(t, tc.Players)

			got, err := ResolveStage2(award, players)
			if err != nil {
				t.Fatalf("ResolveStage2: %v\nnote: %s", err, tc.Note)
			}
			if string(got.Kind) != tc.Expected.Kind {
				t.Fatalf("kind = %q, want %q\nnote: %s", got.Kind, tc.Expected.Kind, tc.Note)
			}

			switch tc.Expected.Kind {
			case "winner":
				if got.SteamID64 != tc.Expected.SteamID64 {
					t.Errorf("winner = %q, want %q\nnote: %s", got.SteamID64, tc.Expected.SteamID64, tc.Note)
				}
				assertDecidingValue(t, got.DecidingValue, tc.Expected.DecidingValue)
				// A winner outcome must carry no tie residue.
				if len(got.Tied) != 0 || got.Reason != "" {
					t.Errorf("winner outcome carries tie fields: %+v", got)
				}
			case "tie":
				// ⭐ ORDER IS PART OF THE ANSWER. The set is byte-lex, so this compares the
				// slices positionally rather than as sets — a resolver that returned the right
				// players in the fixture's order would pass a set comparison.
				if strings.Join(got.Tied, ",") != strings.Join(tc.Expected.Tied, ",") {
					t.Errorf("tied = %v, want %v (byte-lex order)\nnote: %s", got.Tied, tc.Expected.Tied, tc.Note)
				}
				if string(got.Reason) != tc.Expected.Reason {
					t.Errorf("reason = %q, want %q\nnote: %s", got.Reason, tc.Expected.Reason, tc.Note)
				}
				if got.SteamID64 != "" {
					t.Errorf("a TIE named a single winner %q — that is the silent argmax AD-14 forbids", got.SteamID64)
				}
				// ⭐ AND IT CARRIES NO DECIDING VALUE. A resolver that populated it from
				// values[best[0]] would leak "the winning value" of an UNRESOLVED tie into
				// 6.5's input; TypeScript makes that unrepresentable via the union, so this is
				// the Go-only half of the same guarantee.
				if got.DecidingValue.Class != "" || got.DecidingValue.Value != nil ||
					got.DecidingValue.Num != nil || got.DecidingValue.Den != nil {
					t.Errorf("a TIE carries a deciding value: %+v — the tie is UNRESOLVED", got.DecidingValue)
				}
				// ⭐ THE LADDER SEAM, DRIVEN BY THE VECTOR. Every tie row in the file is also run
				// through ResolveAward with the refusing ladder, so "a tie refuses loudly" is part
				// of the shared conformance gate rather than one hand-written local case. Without
				// this, swallowing the ladder's error reddens only a local test.
				out, err := ResolveAward(award, players, RefusingLadder{})
				if err == nil {
					t.Errorf("ResolveAward returned no error on a tie — the refusal was swallowed")
				}
				if strings.Join(out.Tied, ",") != strings.Join(tc.Expected.Tied, ",") {
					t.Errorf("the refused outcome lost the tie: %v", out.Tied)
				}
			case "no_eligible_players":
				if got.SteamID64 != "" || len(got.Tied) != 0 || got.Reason != "" {
					t.Errorf("no_eligible_players outcome carries residue: %+v", got)
				}
			case "no_awardable_value":
				// ⭐ DECISION E CARRIES THE SUPPRESSED SET (6-4a code review). The zero check
				// runs BEFORE the |best| branch, so this list is the tie that never formed and
				// its LENGTH is the width 6.5 / 6.6 / 6.7 would otherwise never see. Compared
				// positionally: the order is byte-lex, exactly as on a tie.
				if strings.Join(got.Tied, ",") != strings.Join(tc.Expected.Tied, ",") {
					t.Errorf("no_awardable_value tied = %v, want %v (byte-lex)\nnote: %s",
						got.Tied, tc.Expected.Tied, tc.Note)
				}
				if len(got.Tied) == 0 {
					t.Error("no_awardable_value carries an EMPTY set — the suppressed width was discarded")
				}
				// No winner, and no reason: nothing "tied" when the set holds one player.
				if got.SteamID64 != "" || got.Reason != "" {
					t.Errorf("no_awardable_value outcome names a winner or a tie reason: %+v", got)
				}
			default:
				t.Fatalf("the vector declares an outcome kind this suite does not check: %q", tc.Expected.Kind)
			}
		})
	}
}

func assertDecidingValue(t *testing.T, got DecidingValue, want *stage2Value) {
	t.Helper()
	if want == nil {
		t.Fatal("the vector's winner row carries no deciding_value")
	}
	if string(got.Class) != want.Class {
		t.Errorf("deciding_value.class = %q, want %q", got.Class, want.Class)
	}
	switch want.Class {
	case "volume":
		if got.Value == nil || got.Value.String() != want.Value {
			t.Errorf("deciding_value = %v, want %s", got.Value, want.Value)
		}
		if got.Num != nil || got.Den != nil {
			t.Errorf("a volume deciding value carries rate halves: %+v", got)
		}
	case "rate":
		if got.Num == nil || got.Num.String() != want.Num || got.Den == nil || got.Den.String() != want.Den {
			t.Errorf("deciding_value = %v/%v, want %s/%s", got.Num, got.Den, want.Num, want.Den)
		}
		if got.Value != nil {
			t.Errorf("a rate deciding value carries a volume value: %+v", got)
		}
	}
}

// The inputs both runtimes must REFUSE travel in the vector, so the two suites cannot drift into
// two independently hand-written lists — the asymmetry the 6.3 review measured costing a
// surviving mutation.
func TestVectorStage2Refusals(t *testing.T) {
	v := loadStage2(t)
	if len(v.Refusals) == 0 {
		t.Fatal("stage2-resolve.json carries no refusals list — the refusals are not shared contract")
	}
	for _, bad := range v.Refusals {
		t.Run(bad.Why, func(t *testing.T) {
			got, err := ResolveStage2(toAward(bad.Award), toPlayers(t, bad.Players))
			if err == nil {
				t.Fatalf("ResolveStage2 returned %+v, want an error (%s)", got, bad.Why)
			}
			// ⭐ THE ERROR IS TYPED, not merely non-nil. The 6-4a code review measured the gap:
			// with every refusal a bare error string, `err != nil` was the only discriminator, so
			// a mutation making validateAward reject EVERY award left all sixteen rows passing.
			// TypeScript has always asserted `toThrow(Stage2Error)`; this is the Go mirror.
			if !errors.Is(err, ErrStage2) {
				t.Errorf("refusal is not an ErrStage2 (%T: %v) — it failed for some other reason", err, err)
			}
		})
	}
}

// The vector's declared closed sets and this package's constants must be the same sets. If they
// drift, the two runtimes disagree about what Stage 2 can even conclude.
func TestVectorStage2ClosedSetsMatchThePackage(t *testing.T) {
	v := loadStage2(t)

	wantKinds := []OutcomeKind{KindWinner, KindTie, KindNoEligiblePlayers, KindNoAwardableValue}
	if len(v.OutcomeKinds) != len(wantKinds) {
		t.Fatalf("vector outcome_kinds = %v, package has %v", v.OutcomeKinds, wantKinds)
	}
	for i, k := range wantKinds {
		if v.OutcomeKinds[i] != string(k) {
			t.Errorf("outcome_kinds[%d] = %q, want %q", i, v.OutcomeKinds[i], k)
		}
	}

	wantReasons := []TieReason{ReasonEqualValue, ReasonEqualCrossProduct}
	if len(v.TieReasons) != len(wantReasons) {
		t.Fatalf("vector tie_reasons = %v, package has %v", v.TieReasons, wantReasons)
	}
	for i, r := range wantReasons {
		if v.TieReasons[i] != string(r) {
			t.Errorf("tie_reasons[%d] = %q, want %q", i, v.TieReasons[i], r)
		}
	}

	if v.AlgoVersion != "inclusivcup-roulette-1.0.0" {
		t.Errorf("algo_version = %q — epics.md:1164 fixes it and 6.3's review already corrected it once", v.AlgoVersion)
	}
}

// ── the vector must CONTAIN the rows that carry the story's weight ─────────────
//
// A suite that passes because the interesting rows quietly disappeared is the failure this
// guards. Same shape as the 6.3 coverage test, and for the same reason.
func TestVectorStage2CoversTheHardCases(t *testing.T) {
	v := loadStage2(t)

	var (
		sawEqualValueTie   bool
		sawEqualCrossTie   bool
		sawWideTie         bool // width >= 3
		sawMinDirection    bool
		sawZeroDenominator bool
		sawNoEligible      bool
		sawNoAwardable     bool
		sawIdleExclusion   bool
		sawUnsortedInput   bool
		sawLexNotNumeric   bool
		sawFloatDivergence bool
		sawFloorBoundary   bool
		sawKillsFloorEdge  bool
	)

	for _, tc := range v.Cases {
		if tc.Award.Direction == "min" {
			sawMinDirection = true
		}
		switch tc.Expected.Kind {
		case "no_eligible_players":
			sawNoEligible = true
		case "no_awardable_value":
			sawNoAwardable = true
		case "tie":
			if tc.Expected.Reason == "equal_value" {
				sawEqualValueTie = true
			}
			if tc.Expected.Reason == "equal_cross_product" {
				sawEqualCrossTie = true
			}
			if len(tc.Expected.Tied) >= 3 {
				sawWideTie = true
			}
		}

		ids := make([]string, 0, len(tc.Players))
		for _, p := range tc.Players {
			ids = append(ids, p.SteamID64)
			if p.IdleDQ {
				sawIdleExclusion = true
			}
			// The floors bite exactly at the boundary in at least one case, which is what makes
			// `>=` distinguishable from `>`.
			//
			// ⭐ BOTH AXES, tracked separately. The 6-4a code review measured that only the
			// ROUNDS floor was guarded while the message claimed to cover `>=` vs `>` generally:
			// editing the one row engineered for it from kills=20 to kills=25 let
			// `kills >= floorKills` -> `>` survive the entire vector with this flag still green.
			if tc.Award.FloorRounds > 0 && p.RoundsPlayed == strconv.Itoa(tc.Award.FloorRounds) {
				sawFloorBoundary = true
			}
			if tc.Award.FloorKills > 0 && p.Kills == strconv.Itoa(tc.Award.FloorKills) {
				sawKillsFloorEdge = true
			}
			if r, ok := p.StatsInt.Rate[tc.Award.DecidingStat]; ok && r.Den == "0" {
				sawZeroDenominator = true
			}
		}
		if !sortedAscending(ids) {
			sawUnsortedInput = true
		}
		// ⭐ Byte-lex and NUMERIC order agree on every 17-digit id, so a numeric-sort mutation is
		// invisible unless some case carries ids whose two orders differ.
		if byteLexDiffersFromNumeric(ids) {
			sawLexNotNumeric = true
		}

		// ⭐ THE CASE THAT ONLY EXACT ARITHMETIC GETS RIGHT. Recompute the whole case the naive
		// way — parse each `{num,den}` as a float64 and divide — and record whether that reverses
		// any pairwise verdict. This is the assertion that keeps the case in the file: without a
		// pair the two methods DISAGREE on, "compared by cross-multiplication" is untested.
		//
		// ⛔ BOTH DENOMINATORS MUST BE NON-ZERO, and only ELIGIBLE players count. The 6-4a code
		// review measured that without those two conditions this flag was VACUOUS: `naiveFloatSign`
		// returns 0 when a denominator is 0, so the `rate-zero-denominator-is-equal-to-everyone`
		// row (A = 0/0, B = 10/5) makes exact = 0 and naive = -1 disagree for a reason that has
		// nothing to do with precision — and `rate-max-cross-multiplication-only`, the
		// (2^53+1)/(2^53+2) row this story calls its headline, could then be deleted with every
		// gate green. A den-0 player sitting anywhere in the file satisfied it for free.
		if tc.Award.Class == "rate" {
			eligible := eligibleRows(t, tc)
			for i := range eligible {
				for j := range eligible {
					a, aok := eligible[i].StatsInt.Rate[tc.Award.DecidingStat]
					b, bok := eligible[j].StatsInt.Rate[tc.Award.DecidingStat]
					if !aok || !bok || a.Den == "0" || b.Den == "0" {
						continue
					}
					if exactSign(t, a, b) != naiveFloatSign(t, a, b) {
						sawFloatDivergence = true
					}
				}
			}
		}
	}

	checks := []struct {
		ok   bool
		what string
	}{
		{sawEqualValueTie, "an equal-INTEGER tie"},
		{sawEqualCrossTie, "an equal-CROSS-PRODUCT tie"},
		{sawWideTie, "a tie WIDER than two players (a resolver returning a pair would pass every 2-way case)"},
		{sawMinDirection, "a direction:'min' award"},
		{sawZeroDenominator, "a zero-denominator deciding value"},
		{sawNoEligible, "a no_eligible_players outcome"},
		{sawNoAwardable, "a no_awardable_value outcome (DECISION E)"},
		{sawIdleExclusion, "an idle_dq player"},
		{sawUnsortedInput, "a case whose players are supplied OUT of byte-lex order"},
		{sawLexNotNumeric, "ids for which byte-lex and NUMERIC order differ — without one, a numeric sort passes everything"},
		{sawFloorBoundary, "a player sitting EXACTLY on a non-zero floor — `>=` vs `>` is otherwise untested"},
		{sawKillsFloorEdge, "a player sitting EXACTLY on a non-zero floor_KILLS — the kills half of `>=` vs `>` is otherwise untested"},
		{sawFloatDivergence, "a rate pair of ELIGIBLE players with NON-ZERO denominators where a float compare and cross-multiplication DISAGREE — without one, 'compared by cross-multiplication' is untested"},
	}
	for _, c := range checks {
		if !c.ok {
			t.Errorf("no vector case exercises %s", c.what)
		}
	}
}

// eligibleRows re-applies the FR-21 floors over a vector case's raw rows, so a coverage probe
// measures the players the resolver would actually COMPARE rather than every row in the fixture.
// Deliberately re-derived here from the vector's own fields: calling eligiblePlayers would make
// the probe agree with the implementation by construction.
func eligibleRows(t *testing.T, tc stage2Case) []stage2Player {
	t.Helper()
	floorRounds := big.NewInt(int64(tc.Award.FloorRounds))
	floorKills := big.NewInt(int64(tc.Award.FloorKills))
	out := make([]stage2Player, 0, len(tc.Players))
	for _, p := range tc.Players {
		if p.IdleDQ {
			continue
		}
		if mustBig(t, "rounds_played", p.RoundsPlayed).Cmp(floorRounds) < 0 {
			continue
		}
		if mustBig(t, "kills", p.Kills).Cmp(floorKills) < 0 {
			continue
		}
		out = append(out, p)
	}
	return out
}

func sortedAscending(ids []string) bool {
	for i := 1; i < len(ids); i++ {
		if ids[i-1] > ids[i] {
			return false
		}
	}
	return true
}

// byteLexDiffersFromNumeric reports whether some pair of these ids is ordered one way by byte-lex
// and the other way by decimal magnitude. For equal-length decimal strings the two always agree,
// which is exactly the point.
func byteLexDiffersFromNumeric(ids []string) bool {
	for i := range ids {
		for j := range ids {
			a, aok := new(big.Int).SetString(ids[i], 10)
			b, bok := new(big.Int).SetString(ids[j], 10)
			if !aok || !bok {
				continue
			}
			lex := strings.Compare(ids[i], ids[j])
			num := a.Cmp(b)
			if lex != 0 && num != 0 && (lex > 0) != (num > 0) {
				return true
			}
		}
	}
	return false
}

func exactSign(t *testing.T, a, b stage2Rate) int {
	t.Helper()
	an := mustBig(t, "num", a.Num)
	ad := mustBig(t, "den", a.Den)
	bn := mustBig(t, "num", b.Num)
	bd := mustBig(t, "den", b.Den)
	return new(big.Int).Mul(an, bd).Cmp(new(big.Int).Mul(bn, ad))
}

// naiveFloatSign is the WRONG implementation, on purpose: parse both halves as float64 and
// divide, exactly as a well-meaning implementer who never read S4 would. It exists only so the
// coverage test above can prove the vector contains a pair the two methods disagree on.
func naiveFloatSign(t *testing.T, a, b stage2Rate) int {
	t.Helper()
	q := func(r stage2Rate) float64 {
		n, err1 := strconv.ParseFloat(r.Num, 64)
		d, err2 := strconv.ParseFloat(r.Den, 64)
		if err1 != nil || err2 != nil || d == 0 {
			return 0
		}
		return n / d
	}
	x, y := q(a), q(b)
	switch {
	case x > y:
		return 1
	case x < y:
		return -1
	default:
		return 0
	}
}

// ── the outcome is invariant under input order ────────────────────────────────

// Stage 2 sorts its own input, so permuting the caller's slice cannot change the answer — not
// the winner, not the tied set, and not the tied set's ORDER. Driven over every vector case
// rather than one hand-picked shape.
func TestStage2IsInvariantUnderInputPermutation(t *testing.T) {
	v := loadStage2(t)
	for _, tc := range v.Cases {
		t.Run(tc.Name, func(t *testing.T) {
			award := toAward(tc.Award)
			base := toPlayers(t, tc.Players)
			want, err := ResolveStage2(award, base)
			if err != nil {
				t.Fatalf("ResolveStage2: %v", err)
			}

			permutations := map[string][]SnapshotPlayer{
				"reversed": reversed(base),
			}
			for shift := 1; shift < len(base); shift++ {
				permutations["rotated-by-"+strconv.Itoa(shift)] = rotated(base, shift)
			}

			for name, players := range permutations {
				got, err := ResolveStage2(award, players)
				if err != nil {
					t.Fatalf("%s: ResolveStage2: %v", name, err)
				}
				if got.Kind != want.Kind || got.SteamID64 != want.SteamID64 ||
					got.Reason != want.Reason || strings.Join(got.Tied, ",") != strings.Join(want.Tied, ",") {
					t.Errorf("%s changed the outcome: %+v, want %+v", name, got, want)
				}
				// ⭐ INCLUDING THE DECIDING VALUE. The 6-4a code review measured the asymmetry:
				// TypeScript's `toEqual` compares it and this test did not, so a mutation making
				// the reported value depend on input order — `values[0]` instead of
				// `values[bestIndex]`, which coincide whenever the winner is byte-lex first —
				// was killed there and SURVIVED here.
				if !sameDecidingValue(got.DecidingValue, want.DecidingValue) {
					t.Errorf("%s changed the deciding value: %+v, want %+v",
						name, got.DecidingValue, want.DecidingValue)
				}
			}
		})
	}
}

func sameDecidingValue(a, b DecidingValue) bool {
	sameInt := func(x, y *big.Int) bool {
		if x == nil || y == nil {
			return x == nil && y == nil
		}
		return x.Cmp(y) == 0
	}
	return a.Class == b.Class && sameInt(a.Value, b.Value) &&
		sameInt(a.Num, b.Num) && sameInt(a.Den, b.Den)
}

func reversed(in []SnapshotPlayer) []SnapshotPlayer {
	out := make([]SnapshotPlayer, len(in))
	for i, p := range in {
		out[len(in)-1-i] = p
	}
	return out
}

func rotated(in []SnapshotPlayer, by int) []SnapshotPlayer {
	out := make([]SnapshotPlayer, 0, len(in))
	out = append(out, in[by:]...)
	out = append(out, in[:by]...)
	return out
}

// A resolver that sorted its argument in place would make two consecutive resolutions over the
// same snapshot observably different operations.
func TestResolveStage2DoesNotMutateTheCallerSlice(t *testing.T) {
	players := []SnapshotPlayer{
		snapPlayer("300", 30, 20, false, map[string]int64{"kills": 20, "knife_kills": 1}),
		snapPlayer("100", 30, 20, false, map[string]int64{"kills": 20, "knife_kills": 5}),
		snapPlayer("200", 30, 20, false, map[string]int64{"kills": 20, "knife_kills": 3}),
	}
	before := []string{players[0].SteamID64, players[1].SteamID64, players[2].SteamID64}

	if _, err := ResolveStage2(volumeAward("knife_kills", DirectionMax, 0, 0), players); err != nil {
		t.Fatalf("ResolveStage2: %v", err)
	}
	after := []string{players[0].SteamID64, players[1].SteamID64, players[2].SteamID64}
	if strings.Join(before, ",") != strings.Join(after, ",") {
		t.Errorf("the caller's slice was reordered: %v -> %v", before, after)
	}
}

// ── the ladder PORT (DECISION B) ──────────────────────────────────────────────

// spyLadder records whether it was consulted, so "non-ties never reach the ladder" and "ties
// always do" are both assertions rather than assumptions.
type spyLadder struct {
	calls int
	tie   Outcome
	out   Outcome
	err   error
}

func (s *spyLadder) Resolve(award Award, tie Outcome) (Outcome, error) {
	s.calls++
	s.tie = tie
	return s.out, s.err
}

func TestResolveAwardHandsTheWholeTieToTheLadder(t *testing.T) {
	// Two players, equal integers — a tie by construction.
	players := []SnapshotPlayer{
		snapPlayer("76561198000000011", 30, 20, false, map[string]int64{"kills": 20, "knife_kills": 7}),
		snapPlayer("76561198000000022", 30, 20, false, map[string]int64{"kills": 20, "knife_kills": 7}),
	}
	spy := &spyLadder{out: Outcome{Kind: KindWinner, SteamID64: "76561198000000022"}}

	got, err := ResolveAward(volumeAward("knife_kills", DirectionMax, 0, 0), players, spy)
	if err != nil {
		t.Fatalf("ResolveAward: %v", err)
	}
	if spy.calls != 1 {
		t.Fatalf("the ladder was consulted %d times on a tie, want 1 — the port is declared but not USED", spy.calls)
	}
	// The ladder receives the tie WHOLE: the full set and the reason, not a pre-picked player.
	if spy.tie.Kind != KindTie || len(spy.tie.Tied) != 2 || spy.tie.Reason != ReasonEqualValue {
		t.Errorf("the ladder received %+v, want the whole tie", spy.tie)
	}
	if spy.tie.SteamID64 != "" {
		t.Errorf("Stage 2 pre-picked %q before consulting the ladder — that is the silent argmax", spy.tie.SteamID64)
	}
	// …and whatever the ladder concludes is what ResolveAward returns.
	if got.Kind != KindWinner || got.SteamID64 != "76561198000000022" {
		t.Errorf("ResolveAward returned %+v, want the ladder's answer", got)
	}
}

func TestResolveAwardNeverConsultsTheLadderForANonTie(t *testing.T) {
	cases := map[string][]SnapshotPlayer{
		"a clear winner": {
			snapPlayer("76561198000000011", 30, 20, false, map[string]int64{"kills": 20, "knife_kills": 7}),
			snapPlayer("76561198000000022", 30, 20, false, map[string]int64{"kills": 20, "knife_kills": 2}),
		},
		"no eligible players": {
			snapPlayer("76561198000000011", 1, 0, false, map[string]int64{"kills": 0, "knife_kills": 7}),
		},
		"no awardable value": {
			snapPlayer("76561198000000011", 30, 20, false, map[string]int64{"kills": 20, "knife_kills": 0}),
			snapPlayer("76561198000000022", 30, 20, false, map[string]int64{"kills": 20, "knife_kills": 0}),
		},
	}
	for name, players := range cases {
		t.Run(name, func(t *testing.T) {
			spy := &spyLadder{}
			award := volumeAward("knife_kills", DirectionMax, 24, 0)
			if _, err := ResolveAward(award, players, spy); err != nil {
				t.Fatalf("ResolveAward: %v", err)
			}
			if spy.calls != 0 {
				t.Errorf("the ladder was consulted %d times on a non-tie", spy.calls)
			}
		})
	}
}

// ⭐ THE REFUSAL MUST PROPAGATE. Swallowing the ladder's error turns a refusal into a
// tie-shaped success, which is precisely the invisible outcome DECISION B exists to prevent.
func TestResolveAwardPropagatesTheRefusingLadder(t *testing.T) {
	players := []SnapshotPlayer{
		snapPlayer("76561198000000022", 30, 20, false, map[string]int64{"kills": 20, "knife_kills": 7}),
		snapPlayer("76561198000000011", 30, 20, false, map[string]int64{"kills": 20, "knife_kills": 7}),
	}
	award := volumeAward("knife_kills", DirectionMax, 0, 0)

	out, err := ResolveAward(award, players, RefusingLadder{})
	if err == nil {
		t.Fatal("ResolveAward returned no error on a tie — the refusal was swallowed")
	}
	if !strings.Contains(err.Error(), "6.5") {
		t.Errorf("the refusal does not name the story that supplies the ladder: %v", err)
	}

	// The tie is still READABLE: both through the returned Outcome and through the typed error,
	// so a caller (6-4b's provisional_winner) can see the tied set rather than only a message.
	if out.Kind != KindTie || strings.Join(out.Tied, ",") != "76561198000000011,76561198000000022" {
		t.Errorf("the refused outcome lost the tie: %+v", out)
	}
	var refused *LadderRefusedError
	if !errors.As(err, &refused) {
		t.Fatalf("the refusal is not a *LadderRefusedError: %T", err)
	}
	if refused.Tie.Reason != ReasonEqualValue || len(refused.Tie.Tied) != 2 {
		t.Errorf("the typed error lost the tie: %+v", refused.Tie)
	}
}

func TestResolveAwardRefusesANilLadder(t *testing.T) {
	// A TIE, so a ladder that slipped past the guard is actually dereferenced — with a
	// non-tie the nil ladder is never called and the test would pass for the wrong reason.
	players := []SnapshotPlayer{
		snapPlayer("76561198000000011", 30, 20, false, map[string]int64{"kills": 20, "knife_kills": 7}),
		snapPlayer("76561198000000022", 30, 20, false, map[string]int64{"kills": 20, "knife_kills": 7}),
	}
	award := volumeAward("knife_kills", DirectionMax, 0, 0)

	var typedNil *spyLadder
	ladders := map[string]Ladder{
		"an untyped nil": nil,
		// ⭐ A TYPED NIL is a NON-nil interface, so `ladder == nil` passes it straight through
		// and the tie path dereferences a nil receiver — a panic that takes the worker down
		// instead of the documented refusal. TypeScript's structural guard already rejected
		// every such shape (`null`, `undefined`, `{}`, `'ladder'`), so the two halves of the
		// seam 6-4b and 6.5 inherit did not refuse the same inputs until the 6-4a code review.
		"a TYPED nil": typedNil,
	}
	for name, ladder := range ladders {
		t.Run(name, func(t *testing.T) {
			got, err := ResolveAward(award, players, ladder)
			if err == nil {
				t.Fatalf("ResolveAward accepted %s and returned %+v — a tie would have no owner", name, got)
			}
			if !errors.Is(err, ErrStage2) {
				t.Errorf("the refusal is not an ErrStage2: %T: %v", err, err)
			}
		})
	}
}

// ⛔ THE MIXED-CLASS COMPARISON REFUSES RATHER THAN PANICKING. Both languages call it
// unreachable, but only TypeScript failed safely there until the 6-4a code review: Go took the
// class from the award and dereferenced whichever half it expected, so a mismatched
// DecidingValue was a nil-pointer panic in the worker instead of a typed refusal.
func TestCompareValuesRefusesAMixedClassPair(t *testing.T) {
	volume := DecidingValue{Class: ClassVolume, Value: big.NewInt(3)}
	rate := DecidingValue{Class: ClassRate, Num: big.NewInt(1), Den: big.NewInt(2)}

	for name, tc := range map[string]struct {
		class AwardClass
		a, b  DecidingValue
	}{
		"a rate value under a volume award": {ClassVolume, volume, rate},
		"a volume value under a rate award": {ClassRate, rate, volume},
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := compareValues(tc.class, tc.a, tc.b); err == nil {
				t.Error("compareValues accepted a mixed-class pair")
			} else if !errors.Is(err, ErrStage2) {
				t.Errorf("the refusal is not an ErrStage2: %T: %v", err, err)
			}
		})
	}
}

// ⭐ THE OUTCOME MUST NOT ALIAS THE CALLER'S SNAPSHOT. `*big.Int` is a mutable pointer, so a
// resolver that returned `p.Volume[stat]` directly would let a later in-place mutation anywhere
// downstream retroactively change an already-returned deciding_value — and the frozen snapshot
// with it. TypeScript cannot exhibit this (`bigint` is immutable), so it is a producer-only
// divergence and the shared vector can never see it.
func TestDecidingValueDoesNotAliasTheSnapshot(t *testing.T) {
	player := snapPlayer("76561198000000011", 30, 20, false, map[string]int64{"kills": 20, "knife_kills": 7})
	got, err := ResolveStage2(volumeAward("knife_kills", DirectionMax, 0, 0), []SnapshotPlayer{player})
	if err != nil {
		t.Fatalf("ResolveStage2: %v", err)
	}
	if got.DecidingValue.Value.String() != "7" {
		t.Fatalf("deciding value = %v, want 7", got.DecidingValue.Value)
	}

	// Mutate the caller's snapshot in place, exactly as a normalisation step downstream would.
	player.Volume["knife_kills"].SetInt64(999)
	if got.DecidingValue.Value.String() != "7" {
		t.Errorf("the Outcome aliased the snapshot: deciding value became %v", got.DecidingValue.Value)
	}

	// The rate arm has two halves and both must be copied.
	rp := ratePlayer("76561198000000011", 30, 20, big.NewInt(5), big.NewInt(10))
	out, err := ResolveStage2(rateAward("adr", DirectionMax, 0, 0), []SnapshotPlayer{rp})
	if err != nil {
		t.Fatalf("ResolveStage2: %v", err)
	}
	rp.Rate["adr"].Num.SetInt64(999)
	rp.Rate["adr"].Den.SetInt64(999)
	if out.DecidingValue.Num.String() != "5" || out.DecidingValue.Den.String() != "10" {
		t.Errorf("the rate Outcome aliased the snapshot: %v/%v",
			out.DecidingValue.Num, out.DecidingValue.Den)
	}
}

// ── S4 directly: the arithmetic really is unbounded ───────────────────────────

// The vector proves the WINNER; this proves the MECHANISM. Both cross-products exceed 2^64, so
// a uint64 implementation wraps and an IEEE double rounds — either one returns a plausible,
// wrong answer rather than failing.
func TestCrossMultiplicationExceedsMachineWords(t *testing.T) {
	// (2^53+1)/(2^53+2) vs 2^53/(2^53+1): exactly one apart after cross-multiplying, ~2^106 wide.
	two53 := new(big.Int).Lsh(big.NewInt(1), 53)
	aNum := new(big.Int).Add(two53, big.NewInt(1))
	aDen := new(big.Int).Add(two53, big.NewInt(2))

	players := []SnapshotPlayer{
		ratePlayer("76561198000000011", 30, 20, aNum, aDen),
		ratePlayer("76561198000000022", 30, 20, new(big.Int).Set(two53), new(big.Int).Add(two53, big.NewInt(1))),
	}
	got, err := ResolveStage2(rateAward("adr", DirectionMax, 0, 0), players)
	if err != nil {
		t.Fatalf("ResolveStage2: %v", err)
	}
	if got.Kind != KindWinner || got.SteamID64 != "76561198000000011" {
		t.Fatalf("got %+v, want the (2^53+1)/(2^53+2) player to win", got)
	}

	// …and the products really are past a machine word, so the test is not passing for a smaller
	// reason than it claims.
	product := new(big.Int).Mul(aNum, new(big.Int).Add(two53, big.NewInt(1)))
	if product.BitLen() <= 64 {
		t.Fatalf("the cross-product is only %d bits — this test no longer exercises S4", product.BitLen())
	}
}

// ── S1/S2/S7 as direct table assertions ───────────────────────────────────────

func TestDirectionInvertsBestAndOnlyBest(t *testing.T) {
	players := []SnapshotPlayer{
		snapPlayer("76561198000000011", 30, 20, false, map[string]int64{"kills": 20, "deaths": 9}),
		snapPlayer("76561198000000022", 30, 20, false, map[string]int64{"kills": 20, "deaths": 22}),
	}
	max, err := ResolveStage2(volumeAward("deaths", DirectionMax, 0, 0), players)
	if err != nil {
		t.Fatalf("max: %v", err)
	}
	min, err := ResolveStage2(volumeAward("deaths", DirectionMin, 0, 0), players)
	if err != nil {
		t.Fatalf("min: %v", err)
	}
	if max.SteamID64 != "76561198000000022" || min.SteamID64 != "76561198000000011" {
		t.Errorf("direction did not invert: max=%q min=%q", max.SteamID64, min.SteamID64)
	}

	// …and the FLOORS are not inverted with it (DECISION C). The same `min` award with the
	// catalog's rate floors excludes the player who cleared fewer rounds, not more.
	floored := []SnapshotPlayer{
		snapPlayer("76561198000000011", 10, 20, false, map[string]int64{"kills": 20, "deaths": 1}),
		snapPlayer("76561198000000022", 30, 20, false, map[string]int64{"kills": 20, "deaths": 9}),
	}
	got, err := ResolveStage2(volumeAward("deaths", DirectionMin, 24, 20), floored)
	if err != nil {
		t.Fatalf("floored min: %v", err)
	}
	if got.SteamID64 != "76561198000000022" {
		t.Errorf("the floors inverted with the direction: got %+v", got)
	}
}

func TestFloorsAreInclusiveAndBothApply(t *testing.T) {
	award := rateAward("adr", DirectionMax, 24, 20)
	cases := []struct {
		name          string
		rounds, kills int64
		wantEligible  bool
	}{
		{"exactly on both floors", 24, 20, true},
		{"one round short", 23, 20, false},
		{"one kill short", 24, 19, false},
		{"comfortably over", 40, 33, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			p := ratePlayer("76561198000000011", tc.rounds, tc.kills, big.NewInt(100), big.NewInt(tc.rounds))
			got, err := ResolveStage2(award, []SnapshotPlayer{p})
			if err != nil {
				t.Fatalf("ResolveStage2: %v", err)
			}
			eligible := got.Kind != KindNoEligiblePlayers
			if eligible != tc.wantEligible {
				t.Errorf("eligible = %v, want %v (got %+v)", eligible, tc.wantEligible, got)
			}
		})
	}
}

// ⭐ The two running-champion accidents, stated as their own test so the intent is unmissable at
// the implementation site. The tie sits at the FIRST and LAST positions of the iteration order,
// so `>` keeps A, `>=` keeps C, and only a set keeps both.
func TestBestIsASetNotARunningChampion(t *testing.T) {
	players := []SnapshotPlayer{
		snapPlayer("76561198000000011", 30, 20, false, map[string]int64{"kills": 20, "knife_kills": 7}),
		snapPlayer("76561198000000022", 30, 20, false, map[string]int64{"kills": 20, "knife_kills": 6}),
		snapPlayer("76561198000000033", 30, 20, false, map[string]int64{"kills": 20, "knife_kills": 7}),
	}
	got, err := ResolveStage2(volumeAward("knife_kills", DirectionMax, 0, 0), players)
	if err != nil {
		t.Fatalf("ResolveStage2: %v", err)
	}
	if got.Kind != KindTie {
		t.Fatalf("got %+v — a running max on `>` returns the FIRST of the pair and on `>=` the LAST", got)
	}
	if strings.Join(got.Tied, ",") != "76561198000000011,76561198000000033" {
		t.Errorf("tied = %v, want both ends of the iteration order", got.Tied)
	}
}

func TestValidateAwardRefusesOutOfEnumValues(t *testing.T) {
	players := []SnapshotPlayer{
		snapPlayer("76561198000000011", 30, 20, false, map[string]int64{"kills": 20}),
	}
	bad := []struct {
		name  string
		award Award
	}{
		{"empty deciding stat", Award{Class: ClassVolume, Direction: DirectionMax}},
		{"class outside the enum", Award{DecidingStat: "kills", Class: "ratio", Direction: DirectionMax}},
		{"direction outside the enum", Award{DecidingStat: "kills", Class: ClassVolume, Direction: "highest"}},
		{"negative floor", Award{DecidingStat: "kills", Class: ClassVolume, Direction: DirectionMax, FloorRounds: -1}},
	}
	for _, tc := range bad {
		t.Run(tc.name, func(t *testing.T) {
			if got, err := ResolveStage2(tc.award, players); err == nil {
				t.Errorf("ResolveStage2 returned %+v, want an error", got)
			}
		})
	}
}

// ── test fixtures ─────────────────────────────────────────────────────────────

func volumeAward(stat string, dir AwardDirection, floorRounds, floorKills int) Award {
	return Award{DecidingStat: stat, Class: ClassVolume, Direction: dir, FloorRounds: floorRounds, FloorKills: floorKills}
}

func rateAward(stat string, dir AwardDirection, floorRounds, floorKills int) Award {
	return Award{DecidingStat: stat, Class: ClassRate, Direction: dir, FloorRounds: floorRounds, FloorKills: floorKills}
}

func snapPlayer(id string, rounds, kills int64, idle bool, volume map[string]int64) SnapshotPlayer {
	vol := map[string]*big.Int{}
	for k, v := range volume {
		vol[k] = big.NewInt(v)
	}
	vol["rounds_played"] = big.NewInt(rounds)
	vol["kills"] = big.NewInt(kills)
	return SnapshotPlayer{
		SteamID64:    id,
		RoundsPlayed: big.NewInt(rounds),
		Kills:        big.NewInt(kills),
		IdleDQ:       idle,
		Volume:       vol,
		Rate:         map[string]RatePair{"adr": {Num: big.NewInt(0), Den: big.NewInt(rounds)}},
	}
}

func ratePlayer(id string, rounds, kills int64, num, den *big.Int) SnapshotPlayer {
	p := snapPlayer(id, rounds, kills, false, map[string]int64{})
	p.Rate["adr"] = RatePair{Num: num, Den: den}
	return p
}
