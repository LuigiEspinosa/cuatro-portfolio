package awards

import (
	"errors"
	"reflect"
	"slices"
	"sort"
	"strconv"
	"strings"
	"testing"
)

// ⛔ THE COMPILE-TIME HALF OF THE `PityInput` FIELD PIN. An UNKEYED composite literal does what the
// keyed one was mistakenly believed to do: adding a fourth field makes this line FAIL TO COMPILE.
// The reflective test below carries the readable message; this carries the guarantee.
// ⚠ `go vet`'s composites check only flags unkeyed literals for types from OTHER packages, so this
// is clean here and deliberately so.
var _ = PityInput{nil, nil, nil}

// pityInputFieldNames reads PityInput's field set off the type, in declaration order.
//
// ⚠ `reflect` is confined to this test file on purpose. `TestPackageSourceHasNoBannedConstructs`
// scans only non-test sources (`prng_test.go:768` skips `_test.go`), and the production path must
// stay reflection-free — pity indexes and swaps, and nothing in the decision path may depend on
// runtime type information.
func pityInputFieldNames() []string {
	rt := reflect.TypeOf(PityInput{})
	names := make([]string, 0, rt.NumField())
	for i := 0; i < rt.NumField(); i++ {
		names = append(names, rt.Field(i).Name)
	}
	return names
}

// ⚠ SLICES ARE COMPARED WITH `slices.Equal`, NEVER BY JOINING THEM (6.7 code review). This file used
// `strings.Join(x, ",") != strings.Join(y, ",")` in five places, which is not INJECTIVE: `["a,b"]`
// and `["a","b"]` join to the same string, as do `["a\nb"]` and `["a","b"]` under the "\n" variant.
// `steamid64` is validated only as "a non-empty string", so a comma is representable — and this is
// the same "two shapes that look like mirrors compare equal" class the 6.6 review found. `strings`
// is still imported for the ERROR MESSAGES, where a joined rendering is exactly what is wanted.

// ── the shared contract ────────────────────────────────────────────────────────
//
// These tests read `roulette/vectors/pity-draw.json` AT RUNTIME. Values are NEVER transcribed into
// Go literals: a hard-coded copy greens on the day the vector is regenerated and silently stops
// testing the contract.
//
// The player loader is Stage 2's (`toPlayers`), reused rather than restated — pity consumes the
// same `SnapshotPlayer` every other stage does, and a second near-identical loader is how two
// readers of one file drift apart.
//
// ⭐ THIS IS THE FIRST RESOLVER SUITE SINCE STAGE 1 THAT ASSERTS A BYTE COUNT AND MEANS IT. The
// ladder and anti-sweep suites prove "it drew nothing" by the SIGNATURE, because a runtime
// assertion around a function that cannot reach a stream is vacuous. Here the stream is a required
// parameter, so `Consumed()` is the gate: every case pins the per-step `n`/`k`/`rejections`/`value`
// sequence AND the cumulative total, and an implementation that reached the right permutation by a
// different draw sequence fails.

type pityDrawRow struct {
	N          int `json:"n"`
	K          int `json:"k"`
	Rejections int `json:"rejections"`
	Value      int `json:"value"`
}

type pityExpected struct {
	Winless       []string      `json:"winless"`
	RevealOrder   []string      `json:"reveal_order"`
	Draws         []pityDrawRow `json:"draws"`
	BytesConsumed uint64        `json:"bytes_consumed"`
}

type pityCase struct {
	Name    string         `json:"name"`
	Note    string         `json:"note"`
	SeedHex string         `json:"seed_hex"`
	Players []stage2Player `json:"players"`
	// ⚠ ABSENT IN ONE ROW ON PURPOSE (P11). An omitted `shelf` key decodes to a nil map here, an
	// omitted `players` key to a nil slice, and both must behave as the EMPTY container rather than
	// refusing — Go cannot idiomatically tell nil from empty, so the other two runtimes agree.
	Shelf    map[string]int `json:"shelf"`
	Expected pityExpected   `json:"expected"`
}

type pityRefusalRow struct {
	Why    string `json:"why"`
	Detail string `json:"detail"`
	// Defects is every defect this row carries, in the order the published validation order visits
	// them. ⭐ `Detail` MUST equal `Defects[0]`, and a row with two entries is a row that can
	// observe an ORDER rather than a single guard.
	Defects []string `json:"defects"`
	SeedHex string   `json:"seed_hex"`
	// Label overrides the file's pity label — the wrong-label row, which is how AC4's "PityLabel and
	// only PityLabel" becomes a vector-checked property instead of a unit-test-only one.
	Label string `json:"label"`
	// PreConsumed burns bytes off the stream before the call — the not-fresh row (SPINE:216).
	PreConsumed int            `json:"pre_consumed"`
	Players     []stage2Player `json:"players"`
	Shelf       map[string]int `json:"shelf"`
}

type pityVector struct {
	Vector                         string           `json:"vector"`
	AlgoVersion                    string           `json:"algo_version"`
	Spec                           string           `json:"spec"`
	Label                          string           `json:"label"`
	RefusalDetails                 []string         `json:"refusal_details"`
	RowRepresentableRefusalDetails []string         `json:"row_representable_refusal_details"`
	Refusals                       []pityRefusalRow `json:"refusals"`
	Cases                          []pityCase       `json:"cases"`
}

func loadPity(t *testing.T) pityVector {
	t.Helper()
	v := loadVector[pityVector](t, "pity-draw.json")
	if v.Vector != "pity-draw" {
		t.Fatalf("loaded the wrong vector file: %q", v.Vector)
	}
	if len(v.Cases) == 0 {
		t.Fatal("pity-draw.json has no cases")
	}
	if len(v.Refusals) == 0 {
		t.Fatal("pity-draw.json has no refusals")
	}
	return v
}

// pityStream opens the stream one row runs on: fresh, counter 0, keyed by the file's pity label
// unless the row deliberately supplies a wrong one.
//
// ⛔ GUARDED, not assumed. A malformed `seed_hex` or an unopenable label fails THIS named helper
// rather than panicking the whole binary — the defect the 6.3 review found in the coverage test and
// this package must not re-import.
func pityStream(t *testing.T, seedHex, label string, preConsumed int) *Stream {
	t.Helper()
	seed, err := DecodeSeed(seedHex)
	if err != nil {
		t.Fatalf("vector carries an undecodable seed_hex %q: %v", seedHex, err)
	}
	s, err := NewStream(seed, label)
	if err != nil {
		t.Fatalf("vector carries an unopenable label %q: %v", label, err)
	}
	if preConsumed > 0 {
		if _, err := s.Read(preConsumed); err != nil {
			t.Fatalf("could not pre-consume %d bytes: %v", preConsumed, err)
		}
	}
	return s
}

// ⭐ THE CASE-NAME SET IS PINNED BY EXACT EQUALITY, mirroring `sweepCaseNames`, `ladderCaseNames`
// and `stage2CaseNames`, and for the reason those exist: a coverage flag can be satisfied by a row
// unrelated to the property it names, so deleting this file's most valuable rows would leave every
// flag green, `--check` reporting OK and both suites passing. Adding or removing a case reddens this
// deliberately.
var pityCaseNames = []string{
	"a-ONE-member-winless-set-RESOLVES-and-consumes-ZERO-bytes",
	"a-REJECTION-inside-uniform_int-is-BYTE-ACCOUNTED-and-CHANGES-the-reveal-order",
	"a-THREE-member-winless-set-DEMONSTRABLY-REORDERS",
	"a-TWO-member-winless-set-COSTS-ONE-BYTE-and-the-SELF-SWAP-leaves-the-order-UNCHANGED",
	"a-roster-where-EVERY-player-HOLDS-a-trophy-leaves-the-winless-set-EMPTY",
	"an-ABSENT-players-and-shelf-CONTAINER-is-the-EMPTY-one",
	"an-ABSENT-shelf-key-is-shelf-ZERO",
	"an-EMPTY-roster-resolves-to-an-EMPTY-draw-and-consumes-ZERO-bytes",
	"an-EXPLICIT-shelf-0-is-BYTE-IDENTICAL-to-an-absent-key",
	"an-idle_dq-player-is-EXCLUDED-while-a-player-with-ZERO-approved-rows-is-INCLUDED",
	"the-ROSTER-supplied-OUT-OF-BYTE-LEX-ORDER-resolves-IDENTICALLY",
	"the-SHIPPED-floors-shape-NOBODY-holds-a-trophy-and-EVERY-player-is-BELOW-both-FR-21-floors",
	"the-winless-set-is-a-STRICT-SUBSET-in-the-MIDDLE-of-byte-lex-order",
}

func TestVectorPityCarriesExactlyTheExpectedCases(t *testing.T) {
	v := loadPity(t)
	got := make([]string, 0, len(v.Cases))
	for _, c := range v.Cases {
		got = append(got, c.Name)
	}
	sort.Strings(got)
	want := append([]string{}, pityCaseNames...)
	sort.Strings(want)
	if !slices.Equal(got, want) {
		t.Errorf("pity-draw.json cases =\n%s\nwant\n%s", strings.Join(got, "\n"), strings.Join(want, "\n"))
	}
}

// TestPityDetailsAreExactlyTheDeclaredSet pins this package's constants against the vector's
// vocabulary, so a fourth label cannot be added on one side alone. 6-4b shipped a "closed set" that
// was 9 / 7 / 7 across three implementations; this is the machinery that prevents it.
func TestPityDetailsAreExactlyTheDeclaredSet(t *testing.T) {
	v := loadPity(t)
	got := append([]string{}, v.RefusalDetails...)
	sort.Strings(got)
	want := []string{PityDetailPlayers, PityDetailShelf, PityDetailStream}
	sort.Strings(want)
	if !slices.Equal(got, want) {
		t.Errorf("refusal_details = %v, this package declares %v", v.RefusalDetails, want)
	}

	// ⭐ AND THE ROW-REPRESENTABLE SET EQUALS IT, WHICH IS THE POINT RATHER THAN AN OVERSIGHT. Pity
	// declares no `internal` label because it has no injected port that could hand it a state no
	// input can reach — see the note beside the constants in pity.go. Asserting the equality as
	// DATA is what keeps the absence a decision rather than a thing somebody forgot.
	rowRep := append([]string{}, v.RowRepresentableRefusalDetails...)
	sort.Strings(rowRep)
	if !slices.Equal(rowRep, got) {
		t.Errorf("row_representable_refusal_details = %v, want it EQUAL to refusal_details %v — "+
			"pity declares no non-representable label", v.RowRepresentableRefusalDetails, v.RefusalDetails)
	}
}

// TestVectorPityLabelIsTheFrozenPityLabel — the file must be drawing on Story 6.3's label, whose
// VALUE is frozen. Moving one byte of it invalidates every ceremony ever published.
func TestVectorPityLabelIsTheFrozenPityLabel(t *testing.T) {
	if v := loadPity(t); v.Label != PityLabel {
		t.Errorf("pity-draw.json label = %q, want %q", v.Label, PityLabel)
	}
}

// TestResolvePityMatchesTheVector is the conformance gate.
func TestResolvePityMatchesTheVector(t *testing.T) {
	v := loadPity(t)
	for _, c := range v.Cases {
		t.Run(c.Name, func(t *testing.T) {
			stream := pityStream(t, c.SeedHex, v.Label, 0)
			got, err := ResolvePity(PityInput{
				Players: toPlayers(t, c.Players),
				Shelf:   c.Shelf,
				Stream:  stream,
			})
			if err != nil {
				t.Fatalf("ResolvePity refused a valid case: %v", err)
			}

			if !slices.Equal(got.Winless, c.Expected.Winless) {
				t.Errorf("winless = %v, want %v", got.Winless, c.Expected.Winless)
			}
			if !slices.Equal(got.RevealOrder, c.Expected.RevealOrder) {
				t.Errorf("reveal_order = %v, want %v", got.RevealOrder, c.Expected.RevealOrder)
			}

			// ⭐⭐ THE BYTE COST IS PART OF THE ANSWER, NOT A DIAGNOSTIC. 6.9's browser has to
			// consume the same bytes, not merely reach the same permutation.
			if got.BytesConsumed != c.Expected.BytesConsumed {
				t.Errorf("bytes_consumed = %d, want %d", got.BytesConsumed, c.Expected.BytesConsumed)
			}
			// …and the STREAM agrees with what the result reports, so a result that under-reported
			// its own cost is caught rather than believed.
			if stream.Consumed() != c.Expected.BytesConsumed {
				t.Errorf("the stream consumed %d bytes, the vector expects %d",
					stream.Consumed(), c.Expected.BytesConsumed)
			}

			if len(got.Draws) != len(c.Expected.Draws) {
				t.Fatalf("drew %d step(s), want %d", len(got.Draws), len(c.Expected.Draws))
			}
			for i, want := range c.Expected.Draws {
				d := got.Draws[i]
				if int(d.N) != want.N || d.K != want.K || d.Rejections != want.Rejections ||
					int(d.Value) != want.Value {
					t.Errorf("draw %d = {n:%d k:%d rejections:%d value:%d}, want "+
						"{n:%d k:%d rejections:%d value:%d}",
						i, d.N, d.K, d.Rejections, d.Value, want.N, want.K, want.Rejections, want.Value)
				}
			}

			// ⭐⭐ AC2's MULTISET IDENTITY, ASSERTED ON EVERY CASE RATHER THAN SPOT-CHECKED. The
			// OUTCOME is invariant and only the ORDER is drawn, so the reveal order is a permutation
			// of the winless set: same length, same members, no additions, no drops. This is where
			// "everyone winless gets one" stops being a sentence in a spec.
			perm := append([]string{}, got.RevealOrder...)
			sort.Strings(perm)
			if !slices.Equal(perm, got.Winless) {
				t.Errorf("reveal_order %v is not a permutation of winless %v", got.RevealOrder, got.Winless)
			}

			// ⭐ NEVER nil, EVEN WHEN EMPTY. Three spellings of absence is a hazard this epic has
			// paid for twice; a harness or 6.9's bundle must print `[]`, never `null`.
			//
			// ⭐ `Draws` IS PINNED HERE TOO (6.7 code review). It was documented as always non-nil
			// and only the other two fields were asserted, so a refactor to `var draws []PityDraw`
			// would have emitted `null` into 6.9's bundle for every zero- and one-member case with
			// this whole suite green — and those are precisely the cases where the slice is empty.
			if got.Winless == nil || got.RevealOrder == nil || got.Draws == nil {
				t.Errorf("Winless, RevealOrder and Draws must be non-nil even when empty "+
					"(winless nil=%t, revealOrder nil=%t, draws nil=%t)",
					got.Winless == nil, got.RevealOrder == nil, got.Draws == nil)
			}
		})
	}
}

// TestVectorPityByteAccountingIsSelfConsistent re-derives every case's total from its own steps.
//
// ⭐ THE VECTOR IS CHECKED AGAINST ITSELF, not only against the implementation. A rejection consumes
// its k bytes and draws k fresh ones, so a step costs `k * (1 + rejections)` exactly. A file whose
// total disagreed with its own steps would teach BOTH suites to accept an implementation that
// under-reported, which is the mutation Task 7 runs.
func TestVectorPityByteAccountingIsSelfConsistent(t *testing.T) {
	v := loadPity(t)
	for _, c := range v.Cases {
		var derived uint64
		for _, d := range c.Draws() {
			derived += uint64(d.K * (1 + d.Rejections))
		}
		if derived != c.Expected.BytesConsumed {
			t.Errorf("%s: draws account for %d bytes, bytes_consumed is %d",
				c.Name, derived, c.Expected.BytesConsumed)
		}
	}
}

// Draws is a tiny accessor so the accounting test above reads as prose. It exists because the two
// tests that need the draw list want it for different reasons and neither should reach through the
// expected block by hand.
func (c pityCase) Draws() []pityDrawRow { return c.Expected.Draws }

// ── the row-specific coverage guards (6.7 code review) ─────────────────────────────────────────
//
// ⛔⛔ THIS BLOCK DID NOT EXIST AND THAT WAS THE GAP. The Python anchor and `pity.test.ts` both
// carried a full set of "guard the guards" checks — name the row, re-derive its property from its
// own data, exclude the degenerate input, pin the exact count — and the GO suite carried none of
// them. It had the case-name list and nothing behind it, so regenerating `pity-draw.json` with (say)
// the out-of-byte-lex row deleted would have reddened only the name list, and no Go assertion said
// WHY any row mattered. Task 2's rule is that a coverage flag must name the specific row it claims;
// two of three implementations obeyed it.
//
// ⭐ These read the VECTOR, not the implementation, so they fail when the shared contract erodes —
// which is the failure the two suites are supposed to catch independently of each other.

// pityCaseNamed finds one case by name, failing loudly rather than returning a zero value — the
// defect the 6.3 review found in a coverage helper that silently scanned nothing.
func pityCaseNamed(t *testing.T, v pityVector, name string) pityCase {
	t.Helper()
	for _, c := range v.Cases {
		if c.Name == name {
			return c
		}
	}
	t.Fatalf("pity-draw.json has no case named %q — the case-name pin should have caught this first", name)
	return pityCase{}
}

// TestVectorPityZeroByteRowsAreExactlyTheFour — AC3, pinned by count AND by name.
func TestVectorPityZeroByteRowsAreExactlyTheFour(t *testing.T) {
	v := loadPity(t)
	got := make([]string, 0, 4)
	for _, c := range v.Cases {
		if c.Expected.BytesConsumed == 0 {
			got = append(got, c.Name)
			// …and a zero-byte row must genuinely have taken no step, not merely reported zero.
			if len(c.Expected.Draws) != 0 {
				t.Errorf("%s: bytes_consumed is 0 but it records %d draw(s)", c.Name, len(c.Expected.Draws))
			}
			if len(c.Expected.Winless) > 1 {
				t.Errorf("%s: %d winless members cannot cost zero bytes — Durstenfeld takes len-1 "+
					"steps and every step at n >= 2 spends at least one byte",
					c.Name, len(c.Expected.Winless))
			}
		}
	}
	sort.Strings(got)
	want := []string{
		"a-ONE-member-winless-set-RESOLVES-and-consumes-ZERO-bytes",
		"a-roster-where-EVERY-player-HOLDS-a-trophy-leaves-the-winless-set-EMPTY",
		"an-ABSENT-players-and-shelf-CONTAINER-is-the-EMPTY-one",
		"an-EMPTY-roster-resolves-to-an-EMPTY-draw-and-consumes-ZERO-bytes",
	}
	sort.Strings(want)
	if !slices.Equal(got, want) {
		t.Errorf("the ZERO-byte rows are %v, want exactly %v (AC3: the empty and one-member cases "+
			"resolve normally and cost nothing)", got, want)
	}
}

// TestVectorPityRejectionRowIsGenuinelyForced — the row that pins `uniform_int`'s rejection path.
//
// ⭐ RE-DERIVES BOTH HALVES FROM THE ROW'S OWN DATA: that a rejection is arithmetically POSSIBLE at
// that step's `n` (`256 mod n != 0`, or no byte value could ever have been rejected there), and that
// one ACTUALLY HAPPENED. The anchor's twin of this guard was a constant expression until this review.
func TestVectorPityRejectionRowIsGenuinelyForced(t *testing.T) {
	v := loadPity(t)
	rejecting := make([]string, 0, 1)
	for _, c := range v.Cases {
		for _, d := range c.Expected.Draws {
			if d.Rejections > 0 {
				rejecting = append(rejecting, c.Name)
				break
			}
		}
	}
	want := []string{"a-REJECTION-inside-uniform_int-is-BYTE-ACCOUNTED-and-CHANGES-the-reveal-order"}
	if !slices.Equal(rejecting, want) {
		t.Fatalf("the rows exercising a REJECTION are %v, want exactly %v", rejecting, want)
	}

	c := pityCaseNamed(t, v, want[0])
	forced := false
	for _, d := range c.Expected.Draws {
		if d.Rejections > 0 && 256%d.N != 0 {
			forced = true
		}
	}
	if !forced {
		t.Error("the rejection row's rejection is not attributable to a non-zero `256 mod n` — at a " +
			"step where 256 mod n == 0 the limit is 256 and no byte can ever be rejected, so the " +
			"row would be pinning nothing")
	}
	// …and the byte cost must exceed the draw count, which is the externally visible consequence of
	// a rejection and the only half 6.9's browser can check.
	if c.Expected.BytesConsumed <= uint64(len(c.Expected.Draws)) {
		t.Errorf("%s: %d bytes for %d draws — a rejected value is CONSUMED and never put back, so a "+
			"row that truly rejects costs strictly more than one byte per draw at k = 1",
			c.Name, c.Expected.BytesConsumed, len(c.Expected.Draws))
	}
}

// TestVectorPityOutOfByteLexRowIsTheSameRosterReordered — P4's guard.
//
// ⭐ THE IDENTITY IS GUARDED AGAINST BEING A ROW COMPARED WITH ITSELF. An identity between two rows
// carrying the same inputs cannot fail, so this re-derives that the two rosters are the SAME MULTISET
// in a DIFFERENT sequence, that the supplied sequence is genuinely not byte-lex, and that the
// expected blocks are nevertheless identical.
func TestVectorPityOutOfByteLexRowIsTheSameRosterReordered(t *testing.T) {
	v := loadPity(t)
	inOrder := pityCaseNamed(t, v, "a-THREE-member-winless-set-DEMONSTRABLY-REORDERS")
	outOfOrder := pityCaseNamed(t, v, "the-ROSTER-supplied-OUT-OF-BYTE-LEX-ORDER-resolves-IDENTICALLY")

	ids := func(c pityCase) []string {
		out := make([]string, 0, len(c.Players))
		for _, p := range c.Players {
			out = append(out, p.SteamID64)
		}
		return out
	}
	supplied, twin := ids(outOfOrder), ids(inOrder)

	// (1) the supplied sequence is NOT byte-lex — otherwise the row's name is false.
	if slices.IsSorted(supplied) {
		t.Errorf("the out-of-order row's roster %v IS byte-lex sorted — the row cannot show that "+
			"the sort is load-bearing", supplied)
	}
	// (2) …and it is the SAME roster as its twin, only sequenced differently.
	if slices.Equal(supplied, twin) {
		t.Error("the out-of-order row and its twin supply their rosters in the SAME order — the " +
			"identity below would be comparing a row with itself and would prove nothing")
	}
	a, b := append([]string{}, supplied...), append([]string{}, twin...)
	sort.Strings(a)
	sort.Strings(b)
	if !slices.Equal(a, b) {
		t.Errorf("the out-of-order row is no longer the same roster: %v vs %v", a, b)
	}
	// (3) the expected blocks are identical — the order the caller supplies must not move one byte.
	if !slices.Equal(outOfOrder.Expected.Winless, inOrder.Expected.Winless) ||
		!slices.Equal(outOfOrder.Expected.RevealOrder, inOrder.Expected.RevealOrder) ||
		outOfOrder.Expected.BytesConsumed != inOrder.Expected.BytesConsumed ||
		!reflect.DeepEqual(outOfOrder.Expected.Draws, inOrder.Expected.Draws) {
		t.Errorf("the in-order and out-of-order rows disagree: %+v vs %+v",
			outOfOrder.Expected, inOrder.Expected)
	}
	// (4) …and the pair genuinely REORDERS, so a shuffle that returned its input satisfies neither.
	if slices.Equal(inOrder.Expected.RevealOrder, inOrder.Expected.Winless) {
		t.Error("the reorder pair no longer reorders — a no-op shuffle would satisfy both rows")
	}
}

// TestVectorPityAbsentShelfKeyIsByteIdenticalToExplicitZero — W8/P6's guard, and the identity IS the
// assertion. Both halves are re-derived: the expected blocks agree, and the two shelves genuinely
// differ (otherwise the rows are one row written twice).
func TestVectorPityAbsentShelfKeyIsByteIdenticalToExplicitZero(t *testing.T) {
	v := loadPity(t)
	absent := pityCaseNamed(t, v, "an-ABSENT-shelf-key-is-shelf-ZERO")
	explicit := pityCaseNamed(t, v, "an-EXPLICIT-shelf-0-is-BYTE-IDENTICAL-to-an-absent-key")

	if !reflect.DeepEqual(absent.Expected, explicit.Expected) {
		t.Errorf("the absent-key and explicit-0 rows disagree: %+v vs %+v",
			absent.Expected, explicit.Expected)
	}
	if reflect.DeepEqual(absent.Shelf, explicit.Shelf) {
		t.Error("the absent-key and explicit-0 rows carry the SAME shelf — the identity above would " +
			"prove nothing, because there would be only one spelling in the pair")
	}
	if !reflect.DeepEqual(absent.Players, explicit.Players) {
		t.Error("the absent/explicit pair no longer shares one roster — the shelf spelling is " +
			"supposed to be the ONLY difference between them")
	}
}

// TestVectorPityDQRowExcludesOnTheDQFilterALONE — AC1's guard, with the degenerate input excluded.
//
// ⛔ THE DEGENERATE CASE IS THE WHOLE POINT. "There is a DQ'd player absent from winless" is also
// satisfied by a DQ'd player who HOLDS A TROPHY — the shelf filter alone would exclude them, so the
// DQ branch could be deleted and the flag would stay green. The excluded player must sit at SHELF 0,
// which makes the DQ filter the sole reason they are out. The anchor's twin of this guard had the
// same hole until this review.
func TestVectorPityDQRowExcludesOnTheDQFilterALONE(t *testing.T) {
	v := loadPity(t)
	got := make([]string, 0, 1)
	for _, c := range v.Cases {
		for _, p := range c.Players {
			if p.IdleDQ && c.Shelf[p.SteamID64] == 0 && !slices.Contains(c.Expected.Winless, p.SteamID64) {
				got = append(got, c.Name)
				break
			}
		}
	}
	want := []string{"an-idle_dq-player-is-EXCLUDED-while-a-player-with-ZERO-approved-rows-is-INCLUDED"}
	if !slices.Equal(got, want) {
		t.Fatalf("the rows where the DQ filter is the SOLE reason for an exclusion are %v, want %v", got, want)
	}

	// …and the AC1 INVERSION is in the same row: beside the excluded DQ'd player sits one with ZERO
	// approved rows who is INCLUDED — winless, not disqualified, "and 6.7's pity draw must still be
	// able to reach them" (0024:584-589).
	c := pityCaseNamed(t, v, want[0])
	included := false
	for _, p := range c.Players {
		if !p.IdleDQ && p.RoundsPlayed == "0" && p.Kills == "0" &&
			slices.Contains(c.Expected.Winless, p.SteamID64) {
			included = true
		}
	}
	if !included {
		t.Error("the DQ row no longer carries a ZERO-approved-rows player in its winless set — the " +
			"row is supposed to invert BOTH halves of the idle_dq rule in one case, and without the " +
			"included half it only tests the exclusion")
	}
}

// TestVectorPitySubFloorRowsAreExactlyTheTwo — P7's guard, pinned by NAME rather than by a lower
// bound.
//
// ⛔ P7 IS THE STORY'S MOST DANGEROUS SEMANTIC: pity's eligibility is "not fully DQ'd", NEVER
// "cleared the FR-21 floors". A player who missed the floors won nothing PRECISELY BECAUSE of them,
// so re-applying them inside pity would exclude the very people FR-28 exists for and make SM-2
// unachievable by construction. These rows are what make that observable — with every fixture above
// the floors the mutation is invisible, which is the exact hole 6.6's mutation pass found in its own
// vector. The anchor's twin of this guard was `>= 2` with no row named until this review.
func TestVectorPitySubFloorRowsAreExactlyTheTwo(t *testing.T) {
	v := loadPity(t)
	got := make([]string, 0, 2)
	for _, c := range v.Cases {
		for _, p := range c.Players {
			if !slices.Contains(c.Expected.Winless, p.SteamID64) {
				continue
			}
			rounds, errR := strconv.Atoi(p.RoundsPlayed)
			kills, errK := strconv.Atoi(p.Kills)
			if errR != nil || errK != nil {
				t.Errorf("%s: player %s carries an undecodable rounds_played/kills (%q/%q)",
					c.Name, p.SteamID64, p.RoundsPlayed, p.Kills)
				continue
			}
			// The SHIPPED FR-21 literals, transcribed deliberately: 0021:56's floor_rounds = 24 and
			// floor_kills = 20. DECISION C — they are read here and NOWHERE in pity.go.
			if rounds < 24 && kills < 20 {
				got = append(got, c.Name)
				break
			}
		}
	}
	sort.Strings(got)
	want := []string{
		"an-idle_dq-player-is-EXCLUDED-while-a-player-with-ZERO-approved-rows-is-INCLUDED",
		"the-SHIPPED-floors-shape-NOBODY-holds-a-trophy-and-EVERY-player-is-BELOW-both-FR-21-floors",
	}
	sort.Strings(want)
	if !slices.Equal(got, want) {
		t.Errorf("the rows carrying a WINLESS player below BOTH FR-21 floors are %v, want exactly "+
			"%v — an implementation that re-applied the floors inside pity would drop those players "+
			"and only these rows would redden", got, want)
	}
}

// TestVectorPityPinsDurstenfeldDescending — DECISION D, checked on the emitted data.
//
// ⭐ THE `n` SEQUENCE IS EXACTLY len..2, STRICTLY DECREASING, AND `n = 1` IS NEVER DRAWN. An
// ascending-sweep implementation reaches a different permutation from the same stream while still
// calling itself Fisher–Yates; this is the assertion that separates them independently of which
// permutation either one happens to reach.
func TestVectorPityPinsDurstenfeldDescending(t *testing.T) {
	v := loadPity(t)
	for _, c := range v.Cases {
		want := make([]int, 0, len(c.Expected.Winless))
		for n := len(c.Expected.Winless); n >= 2; n-- {
			want = append(want, n)
		}
		got := make([]int, 0, len(c.Expected.Draws))
		for _, d := range c.Expected.Draws {
			got = append(got, d.N)
			if d.N < 2 {
				t.Errorf("%s: drew n = %d — Durstenfeld descending terminates at i = 1, so n is "+
					"never 1 and a step that draws it is the ascending variant", c.Name, d.N)
			}
			// j is always in [0, i], i.e. in [0, n-1] — the primitive's own contract, re-derived
			// here so a vector that carried an impossible value could not teach it to both suites.
			if d.Value < 0 || d.Value >= d.N {
				t.Errorf("%s: drew value %d for n = %d — uniform_int returns [0, n)", c.Name, d.Value, d.N)
			}
		}
		if len(got) != len(want) {
			t.Errorf("%s: %d draw(s) for %d winless — Durstenfeld takes len-1 steps",
				c.Name, len(got), len(c.Expected.Winless))
			continue
		}
		for i := range want {
			if got[i] != want[i] {
				t.Errorf("%s: draw sequence %v, want %v", c.Name, got, want)
				break
			}
		}
	}
}

// TestResolvePityRefusesTheVectorsRefusals — every refusal is the TYPED error AND the declared
// detail, never merely "some error".
func TestResolvePityRefusesTheVectorsRefusals(t *testing.T) {
	v := loadPity(t)
	declared := make(map[string]struct{}, len(v.RefusalDetails))
	for _, d := range v.RefusalDetails {
		declared[d] = struct{}{}
	}

	for _, r := range v.Refusals {
		t.Run(r.Why, func(t *testing.T) {
			label := r.Label
			if label == "" {
				label = v.Label
			}
			got, err := ResolvePity(PityInput{
				Players: toPlayers(t, r.Players),
				Shelf:   r.Shelf,
				Stream:  pityStream(t, r.SeedHex, label, r.PreConsumed),
			})
			if err == nil {
				t.Fatalf("expected a refusal, got %+v", got)
			}
			if !errors.Is(err, ErrPity) {
				t.Errorf("refusal does not wrap ErrPity: %v", err)
			}
			var invalid *PityInvalidError
			if !errors.As(err, &invalid) {
				t.Fatalf("refusal is not a *PityInvalidError: %v", err)
			}
			if invalid.Detail != r.Detail {
				t.Errorf("detail = %q, vector declares %q", invalid.Detail, r.Detail)
			}
			if _, ok := declared[invalid.Detail]; !ok {
				t.Errorf("detail %q is outside the declared set %v", invalid.Detail, v.RefusalDetails)
			}
			// ⭐ `detail` MUST EQUAL `defects[0]` — the published validation order, checkable in the
			// file rather than only in prose.
			if len(r.Defects) == 0 || r.Defects[0] != r.Detail {
				t.Errorf("defects %v do not start with the declared detail %q", r.Defects, r.Detail)
			}
		})
	}
}

// TestVectorPityRefusalsPinBothAdjacentBoundaries — validation ORDER is contract.
//
// ⭐ THE BOUNDARIES, NOT THE COUNT. A count of doubly-malformed rows is the wrong proxy and 6.6's
// review measured the cost of using one: two rows that both pin stream/players satisfy `>= 2` while
// leaving players/shelf completely unobservable. The published order is stream -> players -> shelf,
// so its ADJACENT boundaries are exactly these two and each needs a row malformed on both sides.
func TestVectorPityRefusalsPinBothAdjacentBoundaries(t *testing.T) {
	v := loadPity(t)
	seen := map[string]bool{}
	for _, r := range v.Refusals {
		if len(r.Defects) < 2 {
			continue
		}
		pair := []string{r.Defects[0], r.Defects[1]}
		sort.Strings(pair)
		seen[strings.Join(pair, "/")] = true
	}
	for _, want := range []string{"players/stream", "players/shelf"} {
		pair := strings.Split(want, "/")
		sort.Strings(pair)
		if !seen[strings.Join(pair, "/")] {
			t.Errorf("no doubly-malformed refusal row pins the %s boundary — that half of the "+
				"published order is unobservable", want)
		}
	}
	// …and every declared, row-representable detail is genuinely exercised, so no label is a
	// compartment.
	exercised := map[string]bool{}
	for _, r := range v.Refusals {
		exercised[r.Detail] = true
	}
	for _, d := range v.RowRepresentableRefusalDetails {
		if !exercised[d] {
			t.Errorf("detail %q is declared row-representable and no row carries it", d)
		}
	}
}

// TestResolvePityRefusesANilStream drives the one arm NO VECTOR ROW CAN EXPRESS.
//
// ⚠ "No stream was supplied" is not a JSON input, so the generator refuses to write a row reaching
// it — exactly the split `TestStage1PickRefusesANilStream` handles for Stage 1. The label is
// `stream` on both halves, which is what keeps the closed set closed.
func TestResolvePityRefusesANilStream(t *testing.T) {
	_, err := ResolvePity(PityInput{Players: nil, Shelf: nil, Stream: nil})
	if err == nil {
		t.Fatal("a nil stream must refuse — pity DRAWS, and it will not open a stream of its own")
	}
	if !errors.Is(err, ErrPity) {
		t.Errorf("refusal does not wrap ErrPity: %v", err)
	}
	var invalid *PityInvalidError
	if !errors.As(err, &invalid) {
		t.Fatalf("refusal is not a *PityInvalidError: %v", err)
	}
	if invalid.Detail != PityDetailStream {
		t.Errorf("detail = %q, want %q", invalid.Detail, PityDetailStream)
	}
}

// TestResolvePityLeavesTheStreamUntouchedOnEveryRefusal.
//
// ⭐ A REFUSAL MUST NOT COST BYTES. Validation runs before the first draw, so a caller that refuses,
// fixes its input and retries gets the SAME ceremony — and a validation step accidentally moved
// below the loop would otherwise be invisible.
func TestResolvePityLeavesTheStreamUntouchedOnEveryRefusal(t *testing.T) {
	v := loadPity(t)
	for _, r := range v.Refusals {
		label := r.Label
		if label == "" {
			label = v.Label
		}
		stream := pityStream(t, r.SeedHex, label, r.PreConsumed)
		before := stream.Consumed()
		if _, err := ResolvePity(PityInput{
			Players: toPlayers(t, r.Players),
			Shelf:   r.Shelf,
			Stream:  stream,
		}); err == nil {
			t.Fatalf("%s: expected a refusal", r.Why)
		}
		if stream.Consumed() != before {
			t.Errorf("%s: the refusal consumed %d byte(s) — validation runs before the first draw",
				r.Why, stream.Consumed()-before)
		}
	}
}

// ── the table-driven half: properties no single vector row states ──────────────

// TestResolvePityIsAPermutationNeverALottery — P2, stated as an executable property.
//
// ⭐ EVERY WINLESS PLAYER WINS. The most plausible wrong implementation of something named "pity
// roulette" draws N winners out of the winless set and leaves the rest with nothing; it would
// satisfy "seeded" and "reproducible" and would defeat FR-28 entirely. Asserted here over every
// vector case at once so the property is stated about the PASS rather than about a row.
func TestResolvePityIsAPermutationNeverALottery(t *testing.T) {
	v := loadPity(t)
	for _, c := range v.Cases {
		got, err := ResolvePity(PityInput{
			Players: toPlayers(t, c.Players),
			Shelf:   c.Shelf,
			Stream:  pityStream(t, c.SeedHex, v.Label, 0),
		})
		if err != nil {
			t.Fatalf("%s: %v", c.Name, err)
		}
		if len(got.RevealOrder) != len(got.Winless) {
			t.Errorf("%s: %d revealed for %d winless — the outcome is invariant",
				c.Name, len(got.RevealOrder), len(got.Winless))
		}
		seen := map[string]int{}
		for _, sid := range got.RevealOrder {
			seen[sid]++
		}
		for _, sid := range got.Winless {
			if seen[sid] != 1 {
				t.Errorf("%s: %s appears %d time(s) in the reveal order, want exactly 1",
					c.Name, sid, seen[sid])
			}
		}
	}
}

// TestResolvePityReadsNeitherTheFloorsNorTheShelfsWriteEnd — P6 and P7 as behaviour.
//
// ⭐ P7: the SAME roster, resolved twice, with the players' `RoundsPlayed` and `Kills` set to zero
// on the second run. If a floor were consulted anywhere the two answers would differ; they must be
// byte-identical, including the draw sequence.
//
// ⭐ P6: the caller's shelf map is compared before and after. Pity READS it and there is no return
// path that could write it, but "there is no write" is a claim about code that a refactor can break
// silently, so it is checked.
func TestResolvePityReadsNeitherTheFloorsNorTheShelfsWriteEnd(t *testing.T) {
	v := loadPity(t)
	for _, c := range v.Cases {
		players := toPlayers(t, c.Players)

		shelf := map[string]int{}
		for k, val := range c.Shelf {
			shelf[k] = val
		}
		withStats, err := ResolvePity(PityInput{
			Players: players,
			Shelf:   shelf,
			Stream:  pityStream(t, c.SeedHex, v.Label, 0),
		})
		if err != nil {
			t.Fatalf("%s: %v", c.Name, err)
		}
		if len(shelf) != len(c.Shelf) {
			t.Errorf("%s: the pass changed the caller's shelf map", c.Name)
		}
		for k, val := range c.Shelf {
			if shelf[k] != val {
				t.Errorf("%s: the pass wrote shelf[%s] = %d, was %d", c.Name, k, shelf[k], val)
			}
		}

		// Strip every eligibility magnitude the FR-21 floors are computed from. Nothing pity reads
		// lives in these fields, so the answer must not move by one byte.
		zeroed := make([]SnapshotPlayer, len(players))
		copy(zeroed, players)
		for i := range zeroed {
			zeroed[i].RoundsPlayed = nil
			zeroed[i].Kills = nil
		}
		withoutStats, err := ResolvePity(PityInput{
			Players: zeroed,
			Shelf:   c.Shelf,
			Stream:  pityStream(t, c.SeedHex, v.Label, 0),
		})
		if err != nil {
			t.Fatalf("%s (stripped): %v", c.Name, err)
		}
		if strings.Join(withStats.RevealOrder, ",") != strings.Join(withoutStats.RevealOrder, ",") ||
			withStats.BytesConsumed != withoutStats.BytesConsumed {
			t.Errorf("%s: stripping rounds_played/kills changed the draw — a FR-21 floor is being "+
				"consulted inside pity, which excludes the very players FR-28 exists for", c.Name)
		}
	}
}

// TestResolvePityTakesNoAwardAndNoOutcome is DECISION K' and P7 stated where a refactor would trip
// over it: the input struct's field set, pinned exactly.
//
// ⭐ A FIELD ADDED HERE IS A DEPENDENCY ADDED. `SPINE:148` names pity as a reader of the suppressed
// `Tied` set and a future maintainer will come to "restore" it; the answer is DECISION K' — a
// suppressed player did not win, so the shelf already places them in the winless set. Likewise an
// `Award` field would be the first step toward re-applying the floors. This test is what makes
// either one a deliberate act.
func TestResolvePityTakesNoAwardAndNoOutcome(t *testing.T) {
	// ⚠ THIS TEST USED TO BE VACUOUS AND ITS COMMENT WAS WRONG (6.7 code review). It built
	// `PityInput{Players: nil, Shelf: nil, Stream: nil}` and then asserted those three fields were
	// nil — an `if` that cannot fail for any implementation. The comment justifying it claimed a
	// KEYED composite literal "fails to compile if a fourth field is added", which is not Go: keyed
	// literals tolerate new fields silently, so the pin it described did not exist. The story's own
	// testing standard is "if an assertion cannot fail for any implementation, delete it and let the
	// signature carry the property" — 6-4b deleted two rather than repairing them.
	//
	// ⭐ REPLACED BY A PIN THAT CAN ACTUALLY FAIL: the field set is read off the TYPE by reflection
	// and compared for exact equality. A fourth field — `Award` (the first step toward re-applying
	// the FR-21 floors, P7) or `Outcome`/`Tied` (the dependency DECISION K' deliberately did not
	// build, which SPINE:148 invites a maintainer to "restore") — reddens HERE, by name.
	want := []string{"Players", "Shelf", "Stream"}
	got := pityInputFieldNames()
	if !slices.Equal(got, want) {
		t.Errorf("PityInput's fields are %v, want exactly %v — a field added here is a DEPENDENCY "+
			"added: `Award` re-opens P7 (the floors are never consulted inside pity) and "+
			"`Outcome`/`Tied` re-opens DECISION K' (readable is not the same as read)", got, want)
	}
}
