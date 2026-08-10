package ceremony

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"testing"
	"unicode/utf8"

	"cs-tournament/worker/awards"
)

// ── the shared contract ────────────────────────────────────────────────────────
//
// These tests read `roulette/vectors/canonical-bundle.json` AT RUNTIME. ⛔ No expected canonical
// form, no SHA-256 and no refusal reason is transcribed into a Go literal: a hard-coded copy
// greens on the day the vector is regenerated and silently stops testing the contract
// (README:83-89). The generator is a THIRD implementation written from RFC 8785; when it and this
// file disagree, the vector decides — never the TypeScript half, which this package may not read.
//
// ⭐ WHAT MAKES GATE 4 DIFFERENT FROM GATES 1-3. Those gate a DRAW: their failure mode is "a byte
// came out wrong". This one gates the SERIALIZATION the commitment is taken over, so its failure
// mode is "the hash binds a different document" — the ceremony can be perfectly produced and
// perfectly persisted and still fail to verify in a browser.

type canonVectorCase struct {
	Name               string `json:"name"`
	Why                string `json:"why"`
	ASCIIOnly          bool   `json:"ascii_only"`
	InputJSON          string `json:"input_json"`
	Canonical          string `json:"canonical"`
	CanonicalUTF8Bytes int    `json:"canonical_utf8_bytes"`
	SHA256             string `json:"sha256"`
}

type canonVectorRefusal struct {
	Name      string `json:"name"`
	Why       string `json:"why"`
	ASCIIOnly bool   `json:"ascii_only"`
	InputJSON string `json:"input_json"`
	Reason    string `json:"reason"`
}

type canonVectorUnreachable struct {
	Reason string `json:"reason"`
	Why    string `json:"why"`
}

type canonVector struct {
	Vector                    string                   `json:"vector"`
	AlgoVersion               string                   `json:"algo_version"`
	Spec                      string                   `json:"spec"`
	RefusalReasons            []string                 `json:"refusal_reasons"`
	UnreachableRefusalReasons []canonVectorUnreachable `json:"unreachable_refusal_reasons"`
	MaxSafeInteger            string                   `json:"max_safe_integer"`
	Cases                     []canonVectorCase        `json:"cases"`
	Refusals                  []canonVectorRefusal     `json:"refusals"`
	EndToEnd                  []canonVectorCase        `json:"end_to_end"`
}

func loadCanonVector(t *testing.T) canonVector {
	t.Helper()
	// The suite runs with cwd = the package directory, so the vector is three levels up.
	path := filepath.Join("..", "..", "roulette", "vectors", "canonical-bundle.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("reading %s: %v", path, err)
	}
	var v canonVector
	if err := json.Unmarshal(raw, &v); err != nil {
		t.Fatalf("parsing %s: %v", path, err)
	}
	if v.Vector != "canonical-bundle" {
		t.Fatalf("vector identity = %q, want canonical-bundle", v.Vector)
	}
	// ⚠ A ranged loop over an EMPTY slice reports a PASS and asserts nothing. Every suite in this
	// repo pays for that guard because an empty vector array is indistinguishable from a green one.
	if len(v.Cases) == 0 || len(v.Refusals) == 0 {
		t.Fatalf("vector carries %d cases and %d refusals; both must be non-empty",
			len(v.Cases), len(v.Refusals))
	}
	return v
}

func TestCanonicalizeMatchesTheVector(t *testing.T) {
	v := loadCanonVector(t)
	for _, c := range v.Cases {
		t.Run(c.Name, func(t *testing.T) {
			got, err := CanonicalizeJSON([]byte(c.InputJSON), c.ASCIIOnly)
			if err != nil {
				t.Fatalf("canonicalize refused: %v\nwhy this row exists: %s", err, c.Why)
			}
			if got != c.Canonical {
				t.Errorf("canonical form mismatch\n got: %s\nwant: %s", got, c.Canonical)
			}
			// A UTF-8 length divergence with identical text would mean the runtimes disagree
			// about an encoding, which a string comparison alone cannot see.
			if n := len([]byte(got)); n != c.CanonicalUTF8Bytes {
				t.Errorf("canonical utf8 length = %d, want %d", n, c.CanonicalUTF8Bytes)
			}
			if h := CanonicalSHA256Hex(got); h != c.SHA256 {
				t.Errorf("bundle_sha256 = %s, want %s", h, c.SHA256)
			}
		})
	}
}

func TestCanonicalizeIsIdempotent(t *testing.T) {
	// A canonical document re-parsed and re-canonicalized must be a fixed point. This catches an
	// asymmetry between the escaper and the parser that a one-way comparison cannot see.
	v := loadCanonVector(t)
	for _, c := range v.Cases {
		once, err := CanonicalizeJSON([]byte(c.InputJSON), c.ASCIIOnly)
		if err != nil {
			t.Fatalf("%s: %v", c.Name, err)
		}
		twice, err := CanonicalizeJSON([]byte(once), c.ASCIIOnly)
		if err != nil {
			t.Fatalf("%s (second pass): %v", c.Name, err)
		}
		if twice != once {
			t.Errorf("%s is not a fixed point\n once: %s\ntwice: %s", c.Name, once, twice)
		}
	}
}

func TestCanonicalizeEmitsNoInsignificantWhitespace(t *testing.T) {
	// §3.2.1, proven structurally rather than by eyeballing the pinned forms: string bodies are
	// removed, then any remaining space, tab, CR or LF is a violation.
	v := loadCanonVector(t)
	for _, c := range v.Cases {
		outside := stripJSONStrings(c.Canonical)
		if strings.ContainsAny(outside, " \t\r\n") {
			t.Errorf("%s carries insignificant whitespace outside a string: %q", c.Name, outside)
		}
	}
}

// stripJSONStrings removes every "…" body, honouring backslash escapes.
func stripJSONStrings(s string) string {
	var out strings.Builder
	inStr := false
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if inStr {
			if ch == '\\' {
				i++
				continue
			}
			if ch == '"' {
				inStr = false
			}
			continue
		}
		if ch == '"' {
			inStr = true
			continue
		}
		out.WriteByte(ch)
	}
	return out.String()
}

func TestCanonicalizeRefusesWhatTheVectorPins(t *testing.T) {
	v := loadCanonVector(t)
	for _, r := range v.Refusals {
		t.Run(r.Name, func(t *testing.T) {
			_, err := CanonicalizeJSON([]byte(r.InputJSON), r.ASCIIOnly)
			if err == nil {
				t.Fatalf("did not refuse\nwhy this row exists: %s", r.Why)
			}
			// ⛔ Asserted on the REASON, never merely on "it errored". A canonicalizer that
			// refused everything for one reason would pass an err != nil check on every row here.
			ce, ok := err.(*CanonError)
			if !ok {
				t.Fatalf("refused with %T, want *CanonError: %v", err, err)
			}
			if ce.Reason != r.Reason {
				t.Errorf("reason = %q, want %q", ce.Reason, r.Reason)
			}
		})
	}
}

func TestCanonRefusalReasonsMatchTheVector(t *testing.T) {
	// ⭐ THE CLOSED SET READS ITS EVIDENCE. `CanonRefusalReasons` is compared against the VECTOR's
	// declared array — not against a literal written beside the assertion, which is this project's
	// signature defect and is at its seventh recorded occurrence (`6-8a:909`: "if len(inputReachable)
	// != 6 measures the size of a map literal written two lines above it").
	v := loadCanonVector(t)
	got := append([]string(nil), CanonRefusalReasons...)
	want := append([]string(nil), v.RefusalReasons...)
	sort.Strings(got)
	sort.Strings(want)
	if len(got) != len(want) {
		t.Fatalf("declared %d reasons, vector declares %d", len(got), len(want))
	}
	for i := range got {
		if got[i] != want[i] {
			t.Errorf("reason[%d] = %q, vector says %q", i, got[i], want[i])
		}
	}
}

func TestCanonReasonsPartitionIntoReachableAndUnreachable(t *testing.T) {
	// The exercised reasons and the declared-unreachable reasons must PARTITION the closed set:
	// disjoint, and together the whole of it. A reason that is neither exercised nor declared
	// unreachable fails here instead of sitting untested forever.
	v := loadCanonVector(t)
	exercised := map[string]bool{}
	for _, r := range v.Refusals {
		exercised[r.Reason] = true
	}
	unreachable := map[string]bool{}
	for _, u := range v.UnreachableRefusalReasons {
		unreachable[u.Reason] = true
	}
	if len(exercised) == 0 || len(unreachable) == 0 {
		t.Fatalf("exercised=%d unreachable=%d; both must be non-empty", len(exercised), len(unreachable))
	}
	for _, reason := range v.RefusalReasons {
		if exercised[reason] == unreachable[reason] {
			// Equal means either BOTH (overlap) or NEITHER (uncovered) — both are failures.
			t.Errorf("reason %q is exercised=%v unreachable=%v; it must be exactly one",
				reason, exercised[reason], unreachable[reason])
		}
	}
}

// TestCanonCycleIsDetectedThroughAMapAsWellAsASlice pins the 6.9a code-review fix.
//
// ⛔ THE OLD TEST DROVE `cycle` FROM A SELF-REFERENTIAL **SLICE** ONLY, and that is exactly why the
// defect survived: `canonEmitObject` took the `open` set and never touched it, so `cycle` was
// structurally unreachable for objects and `m["self"] = m` recursed until the goroutine stack died —
// an unrecoverable crash, not a typed refusal — while TypeScript and Python both returned the
// refusal for the same value. ⚠ `BuildBundle` builds native `map[string]any`, so the unguarded arm
// was the one the PRODUCER actually walks.
func TestCanonCycleIsDetectedThroughAMapAsWellAsASlice(t *testing.T) {
	m := map[string]any{}
	m["self"] = m
	if _, err := Canonicalize(m, true); err == nil {
		t.Fatal("a self-referential map canonicalized without error")
	} else {
		var ce *CanonError
		if !errors.As(err, &ce) || ce.Reason != CanonCycle {
			t.Errorf("a self-referential map refused with %v, want reason %q", err, CanonCycle)
		}
	}

	// Nested one level down, so the fix is not "the top-level map happens to be checked".
	inner := map[string]any{}
	inner["loop"] = inner
	if _, err := Canonicalize(map[string]any{"a": inner}, true); err == nil {
		t.Fatal("a nested self-referential map canonicalized without error")
	}

	// ⚠ THE FALSE SIDE, without which the guard could be an unconditional refusal: the SAME map
	// appearing twice as a SIBLING is legal JSON and must still canonicalize.
	shared := map[string]any{"k": "v"}
	if _, err := Canonicalize(map[string]any{"x": shared, "y": shared}, true); err != nil {
		t.Errorf("a sibling repeat of the same map must be legal, got %v", err)
	}
}

// TestCanonDepthBoundIsATypedRefusal pins the other half of the 6.9a review's canonicalizer work:
// past the shared bound every runtime used to die an UNTYPED death at a different depth.
func TestCanonDepthBoundIsATypedRefusal(t *testing.T) {
	var v any = "leaf"
	for i := 0; i < CanonMaxDepthLimit+10; i++ {
		v = []any{v}
	}
	if _, err := Canonicalize(v, true); err == nil {
		t.Fatal("a document past the depth bound canonicalized without error")
	} else {
		var ce *CanonError
		if !errors.As(err, &ce) || ce.Reason != CanonMaxDepth {
			t.Errorf("deep nesting refused with %v, want reason %q", err, CanonMaxDepth)
		}
	}

	// The false side: comfortably inside the bound still works.
	var ok any = "leaf"
	for i := 0; i < 50; i++ {
		ok = []any{ok}
	}
	if _, err := Canonicalize(ok, true); err != nil {
		t.Errorf("50 levels is well inside the bound and must canonicalize, got %v", err)
	}
}

func TestCanonUnreachableReasonsAreReachableFromNativeValues(t *testing.T) {
	// ⭐ The `unreachable_*` marker means "not reachable FROM JSON" — not "dead". Left unproven, a
	// later reader deletes the arms as unused and the producer's `Canonicalize(nativeValue)` path
	// loses its guards. Each is driven here from the native value JSON cannot express.
	v := loadCanonVector(t)
	declared := map[string]bool{}
	for _, u := range v.UnreachableRefusalReasons {
		declared[u.Reason] = true
	}

	if declared[CanonUnsupportedType] {
		// float64 is THE reachable form of this in Go: it is what an unconfigured decoder
		// produces, and by then a magnitude has already been rounded.
		if _, err := Canonicalize(map[string]any{"n": float64(1)}, false); !isCanonReason(err, CanonUnsupportedType) {
			t.Errorf("float64 gave %v, want unsupported_type", err)
		}
		if _, err := Canonicalize(map[string]any{"n": 1}, false); !isCanonReason(err, CanonUnsupportedType) {
			t.Errorf("untyped int gave %v, want unsupported_type", err)
		}
	}
	if declared[CanonNonFiniteNumber] {
		if _, err := Canonicalize(map[string]any{"n": json.Number("NaN")}, false); !isCanonReason(err, CanonNonFiniteNumber) {
			t.Errorf("NaN gave %v, want non_finite_number", err)
		}
		if _, err := Canonicalize(map[string]any{"n": json.Number("Inf")}, false); !isCanonReason(err, CanonNonFiniteNumber) {
			t.Errorf("Inf gave %v, want non_finite_number", err)
		}
	}
	if declared[CanonCycle] {
		cyc := []any{json.Number("1")}
		cyc[0] = cyc
		if _, err := Canonicalize(map[string]any{"a": cyc}, false); !isCanonReason(err, CanonCycle) {
			t.Errorf("self-referential slice gave %v, want cycle", err)
		}
	}
}

func isCanonReason(err error, reason string) bool {
	ce, ok := err.(*CanonError)
	return ok && ce.Reason == reason
}

func TestCanonSiblingRepeatIsLegal(t *testing.T) {
	// Guards the cycle guard against being written so it never releases: the bundle really does
	// carry the same slice twice after a filter chain, and refusing that would make a legal
	// document unpublishable.
	shared := []any{json.Number("1"), json.Number("2")}
	got, err := Canonicalize(map[string]any{"a": shared, "b": shared}, true)
	if err != nil {
		t.Fatalf("a repeated sibling was refused: %v", err)
	}
	if want := `{"a":[1,2],"b":[1,2]}`; got != want {
		t.Errorf("got %s, want %s", got, want)
	}
}

func TestCanonSafeIntegerBoundaryFromBothSides(t *testing.T) {
	// ⭐ The bound is read from the VECTOR as a decimal string, because it is a contract shared
	// with two runtimes that spell it differently — `lib/roulette` cannot write `2 ** 53 - 1` at
	// all, since `**` is a banned construct there.
	v := loadCanonVector(t)
	max, err := strconv.ParseInt(v.MaxSafeInteger, 10, 64)
	if err != nil {
		t.Fatalf("vector max_safe_integer %q: %v", v.MaxSafeInteger, err)
	}
	if max != MaxSafeInteger {
		t.Fatalf("MaxSafeInteger = %d, vector says %d", int64(MaxSafeInteger), max)
	}
	ok, err := Canonicalize(map[string]any{"n": json.Number(v.MaxSafeInteger)}, true)
	if err != nil {
		t.Fatalf("2^53-1 was refused: %v", err)
	}
	if want := `{"n":` + v.MaxSafeInteger + `}`; ok != want {
		t.Errorf("got %s, want %s", ok, want)
	}
	over := strconv.FormatInt(max+1, 10)
	if _, err := Canonicalize(map[string]any{"n": json.Number(over)}, true); !isCanonReason(err, CanonUnsafeInteger) {
		t.Errorf("2^53 gave %v, want unsafe_integer", err)
	}
}

func TestCanonKeyOrderIsUTF16CodeUnits(t *testing.T) {
	// ⭐⭐ B6, asserted rather than commented. The vector pins the RFC's own example; this pins the
	// PROPERTY it demonstrates, so the two cannot drift apart. A canonicalizer that sorted by Go's
	// native string order — UTF-8 bytes, i.e. code points — passes every ASCII row and fails here.
	//
	// U+1F600 encodes to the surrogate pair D83D DE00, so its FIRST code unit is 0xD83D, which is
	// BELOW 0xFB33 — even though its code point (0x1F600) is far above it.
	got, err := Canonicalize(map[string]any{"\U0001F600": json.Number("1"), "דּ": json.Number("2")}, false)
	if err != nil {
		t.Fatalf("refused: %v", err)
	}
	iEmoji := strings.Index(got, "\U0001F600")
	iDalet := strings.Index(got, "דּ")
	if iEmoji < 0 || iDalet < 0 {
		t.Fatalf("both keys must appear: %s", got)
	}
	if iEmoji > iDalet {
		t.Errorf("supplementary-plane key must sort FIRST (UTF-16 order), got %s", got)
	}
	// And the sanity check that makes the assertion above meaningful: Go's NATIVE order is the
	// other one, so this really is a property the implementation had to work for.
	if !("דּ" < "\U0001F600") {
		t.Error("expected Go's native string order to put U+FB33 first; the premise of this test moved")
	}
}

func TestCanonArraysAreNeverReordered(t *testing.T) {
	// The mirror of the key-order rule, and the one a "sort everything" shortcut breaks:
	// `winners`, `reveal_order` and `draws` are arrays whose ORDER is the outcome being published.
	got, err := Canonicalize(map[string]any{"a": []any{json.Number("3"), json.Number("1"), json.Number("2")}}, true)
	if err != nil {
		t.Fatalf("refused: %v", err)
	}
	if want := `{"a":[3,1,2]}`; got != want {
		t.Errorf("got %s, want %s", got, want)
	}
}

func TestCanonGoDecoderSubstitutionIsCaught(t *testing.T) {
	// ⚠⚠ THE GO-ONLY DIVERGENCE, MEASURED RATHER THAN ASSUMED. `encoding/json` replaces an
	// unpaired surrogate escape with U+FFFD at PARSE time, so without the detector in
	// CanonicalizeJSON, Go would SUCCEED on `{"s":"\ud800"}` and hash a document containing a
	// replacement character that was never in the source — while TypeScript and Python refuse.
	// Three runtimes, two answers, one commitment.
	//
	// This test proves BOTH halves: that the decoder really does substitute (the premise), and
	// that the detector catches it (the fix). If Go ever stops substituting, the premise check
	// reddens and this guard can be retired deliberately rather than left as cargo.
	var v any
	if err := json.Unmarshal([]byte(`{"s":"\ud800"}`), &v); err != nil {
		t.Fatalf("premise: Go used to accept a lone surrogate escape, now: %v", err)
	}
	m, ok := v.(map[string]any)
	if !ok {
		t.Fatalf("premise: unexpected decode shape %T", v)
	}
	s, _ := m["s"].(string)
	if !strings.ContainsRune(s, utf8.RuneError) {
		t.Fatalf("premise moved: Go no longer substitutes U+FFFD for a lone surrogate (got %q)", s)
	}
	if _, err := CanonicalizeJSON([]byte(`{"s":"\ud800"}`), false); !isCanonReason(err, CanonLoneSurrogate) {
		t.Errorf("detector failed: got %v, want lone_surrogate", err)
	}
	// ⚠ And the safety net that makes the divergence bounded rather than merely detected: under
	// the ASCII restriction the BUNDLE always uses, all three runtimes refuse either way.
	if _, err := CanonicalizeJSON([]byte(`{"s":"\ud800"}`), true); err == nil {
		t.Error("asciiOnly must refuse a substituted replacement character too")
	}
	// A LITERAL U+FFFD in the source is a different matter: it was really there, so it is not a
	// substitution and must not be refused as one.
	if _, err := CanonicalizeJSON([]byte("{\"s\":\"�\"}"), false); err != nil {
		t.Errorf("a genuine U+FFFD in the source must be accepted, got %v", err)
	}
}

func TestCanonEndToEndBundleRow(t *testing.T) {
	// ⛔ AC2 requires "an end-to-end bundle_sha256 over the REAL ceremony's bundle carried as
	// data". That document only exists after Task 9 rebuilds the 14-demo corpus, runs the
	// ceremony, persists it and publishes — so the row is OWED, and its absence is asserted here
	// rather than left as a silent gap somebody has to notice.
	//
	// ⚠ THIS REDDENS DELIBERATELY THE MOMENT TASK 9 FILLS THE ROW, which is the same
	// deliberate-update pattern the TypeScript module list uses. When it goes red the fix is to
	// change the expected count HERE, on purpose, having read the new row — never to delete it.
	// ⭐⭐ THE ROW LANDED. Task 9 (THE BAR) rebuilt the 14-demo corpus, ran and persisted the ceremony,
	// published the bundle, and carried the committed canonical bytes into the vector. This
	// expectation reddened exactly as designed and is updated HERE, on purpose, having read the new
	// row — never deleted. It stays a COUNT so a second row cannot arrive unnoticed either.
	v := loadCanonVector(t)
	if len(v.EndToEnd) != 1 {
		t.Errorf("end_to_end carries %d row(s), want exactly 1; update this expectation "+
			"deliberately and verify each row below", len(v.EndToEnd))
	}
	// The real ceremony's shape, pinned so a re-run against a different corpus cannot pass quietly.
	//
	// ⛔ 6.9a CODE REVIEW — THIS WAS NAME-GUARDED AND COULD GO VACUOUS. It read:
	//
	//	for _, c := range v.EndToEnd {
	//	    if c.Name == "real-ceremony-bundle" && c.CanonicalUTF8Bytes != 75013 { ... }
	//	}
	//
	// so renaming the row on the next corpus rebuild — exactly the event this assertion exists to
	// catch — would have made the loop body never execute, silently deleting the check and leaving
	// only the count above, which a renamed single row satisfies. Indexed and asserted by NAME
	// FIRST, so a rename reddens here instead of disappearing. The TypeScript mirror already did it
	// this way; the two halves now agree.
	row := v.EndToEnd[0]
	if row.Name != "real-ceremony-bundle" {
		t.Fatalf("end_to_end[0] is %q, want \"real-ceremony-bundle\" — if the corpus was rebuilt "+
			"under a new name, update this expectation deliberately after reading the new row",
			row.Name)
	}
	if row.CanonicalUTF8Bytes != 75013 {
		t.Errorf("the real ceremony's bundle is %d canonical bytes, want 75013",
			row.CanonicalUTF8Bytes)
	}
	for _, c := range v.EndToEnd {
		got, err := CanonicalizeJSON([]byte(c.InputJSON), c.ASCIIOnly)
		if err != nil {
			t.Fatalf("%s: %v", c.Name, err)
		}
		if got != c.Canonical {
			t.Errorf("%s canonical mismatch", c.Name)
		}
		if h := CanonicalSHA256Hex(got); h != c.SHA256 {
			t.Errorf("%s bundle_sha256 = %s, want %s", c.Name, h, c.SHA256)
		}
	}
}

// ══ THE BUILDER (Story 6.9a, Task 4b) ═════════════════════════════════════════
//
// ⚠ WHAT THESE TESTS CAN AND CANNOT REACH, STATED RATHER THAN IMPLIED. `BuildBundle` reads five
// tables, so its query layer is provable only against a real database — and that is THE BAR's job
// (Task 9), not this file's. What IS provable here is every decision the builder makes ABOUT the
// document: the NULL-is-absent rule, the provenance split between JSON integers and decimal strings,
// DECISION J's dropped sentinel, and the byte-identity of two builds. Those are the decisions a
// reviewer would otherwise have to take on trust, and they are also the ones a database cannot check.

func TestBuildPityCarriesTheWholeConsolationDraw(t *testing.T) {
	run := awards.CeremonyRun{
		PityLabel: "inclusivcup/v1/pity",
		Pity: awards.PityResult{
			Winless:     []string{"76561198000000011", "76561198000000022"},
			RevealOrder: []string{"76561198000000022", "76561198000000011"},
			Draws: []awards.PityDraw{
				{N: 2, K: 1, Rejections: 0, Value: 1},
			},
			BytesConsumed: 1,
		},
	}
	got := buildPity(run)

	if got["label"] != "inclusivcup/v1/pity" {
		t.Errorf("label = %v", got["label"])
	}
	// ⭐ TWO SEPARATE LISTS, NEVER ONE. `pity.go:205-220` keeps `Winless` (byte-lex, the OUTCOME set)
	// and `RevealOrder` (the seeded permutation) apart precisely so a caller cannot publish one as the
	// other, and this asserts the bundle preserves that distinction rather than collapsing it.
	winless := got["winless"].([]any)
	order := got["reveal_order"].([]any)
	if winless[0] != "76561198000000011" || order[0] != "76561198000000022" {
		t.Errorf("winless and reveal_order collapsed: %v / %v", winless, order)
	}

	draws := got["draws"].([]any)
	if len(draws) != 1 {
		t.Fatalf("draws = %d, want 1", len(draws))
	}
	d := draws[0].(map[string]any)
	// ⭐ `rejections` IS A JSON INTEGER, and `deferred-work.md:348` is why it is asserted here: it was
	// float division in TypeScript until Story 6.9a's T2b, and it is a PUBLISHED `draws[]` field —
	// therefore outcome-affecting for `bundle_sha256`. A `0.0` here would hash differently from a `0`
	// and the canonicalizer would refuse it outright (DECISION L), which is the fail-closed direction.
	for _, k := range []string{"n", "k", "rejections", "value"} {
		if _, ok := d[k].(json.Number); !ok {
			t.Errorf("pity draw %q is %T, want a JSON integer", k, d[k])
		}
	}
}

func TestBuildPityEmitsEmptyListsRatherThanNull(t *testing.T) {
	// ⚠ "Three spellings of absence is a hazard this epic has paid for twice already" (`pity.go:210`).
	// A `null` here would canonicalize to `null` and hash differently from `[]` in a runtime that
	// spelled it the other way.
	got := buildPity(awards.CeremonyRun{
		PityLabel: "inclusivcup/v1/pity",
		Pity: awards.PityResult{
			Winless:     []string{},
			RevealOrder: []string{},
			Draws:       nil,
		},
	})
	for _, k := range []string{"winless", "reveal_order", "draws"} {
		v, ok := got[k].([]any)
		if !ok {
			t.Fatalf("%s is %T, want []any", k, got[k])
		}
		if len(v) != 0 {
			t.Errorf("%s = %v, want empty", k, v)
		}
	}
	canon, err := Canonicalize(map[string]any{"pity": got}, true)
	if err != nil {
		t.Fatalf("canonicalizing an empty pity block: %v", err)
	}
	if strings.Contains(canon, "null") {
		t.Errorf("an empty pity block canonicalized to %s — it must carry [] and never null", canon)
	}
}

func TestNumbersToStringsIsTheProvenanceSplitMadeMechanical(t *testing.T) {
	// ⭐ B5 — every SNAPSHOT magnitude is a decimal STRING even when small; the split is by
	// PROVENANCE, not by size (`README:239-244`). The walk is what makes a block added later
	// converted by construction rather than remembered.
	raw := []byte(`{"volume":{"knife_kills":3},"rate":{"adr":{"num":1234,"den":10}},` +
		`"nested":[{"deep":9007199254740993}],"flag":true,"name":"x"}`)
	decoded, err := decodeJSONNumbers(raw)
	if err != nil {
		t.Fatalf("decoding: %v", err)
	}
	out := numbersToStrings(decoded).(map[string]any)

	if got := out["volume"].(map[string]any)["knife_kills"]; got != "3" {
		t.Errorf("a small magnitude became %#v, want the string \"3\"", got)
	}
	if got := out["rate"].(map[string]any)["adr"].(map[string]any)["num"]; got != "1234" {
		t.Errorf("a rate numerator became %#v", got)
	}
	// ⛔ THE ONE THAT MATTERS: 2^53+1 survives EXACTLY. Through float64 it would come back as
	// 9007199254740992 — a silently different number, and the defect `.Float64()` is banned for.
	if got := out["nested"].([]any)[0].(map[string]any)["deep"]; got != "9007199254740993" {
		t.Errorf("a magnitude past 2^53 became %#v — it was rounded on the way through", got)
	}
	// Structure, strings and booleans are untouched.
	if out["flag"] != true || out["name"] != "x" {
		t.Errorf("a non-number was rewritten: flag=%#v name=%#v", out["flag"], out["name"])
	}
}

func TestNumbersToStringsSpellsAnAbsentBlockAsAnEmptyObject(t *testing.T) {
	// "Absent container === empty container" (`stage2.ts:143`). A `null` would be a third spelling of
	// absence in a document whose whole job is to hash identically in three runtimes.
	got := numbersToStrings(nil)
	m, ok := got.(map[string]any)
	if !ok || len(m) != 0 {
		t.Fatalf("an absent AD-19 block became %#v, want an empty object", got)
	}
}

func TestPutIfPresentDropsTheKeyOnNULL(t *testing.T) {
	// ⭐ DECISION J generalised: NULL in the database is spelled ABSENT in the bundle. JCS hashes an
	// absent key and a present-but-empty one differently, so `""` would be a value the source does not
	// hold — and the three FR-29 rung keys are genuinely nullable in the catalog (`0023:97-115`).
	m := map[string]any{}
	val := "kd_ratio"
	putIfPresent(m, "secondary_stat", &val)
	putIfPresent(m, "eff_num_key", nil)
	if m["secondary_stat"] != "kd_ratio" {
		t.Errorf("a present value was dropped: %#v", m["secondary_stat"])
	}
	if _, present := m["eff_num_key"]; present {
		t.Error("a NULL column produced a KEY — the bundle must spell NULL as absent, never as \"\"")
	}
	// The hash difference is the whole reason, so it is measured rather than asserted in prose.
	withKey, err := Canonicalize(map[string]any{"eff_num_key": ""}, true)
	if err != nil {
		t.Fatal(err)
	}
	withoutKey, err := Canonicalize(map[string]any{}, true)
	if err != nil {
		t.Fatal(err)
	}
	if CanonicalSHA256Hex(withKey) == CanonicalSHA256Hex(withoutKey) {
		t.Error("an empty-string key and an absent key hashed the SAME — the premise of DECISION J " +
			"has changed and the rule needs re-deciding, not re-asserting")
	}
}

func TestDecisionJTheZeroSentinelHashesDifferentlyFromAbsent(t *testing.T) {
	// ⛔⛔ THE MEASUREMENT DECISION J RESTS ON. Go carries `LadderExitStep` as an int whose 0 means
	// "no ladder ran" and TS omits the key; `deferred-work.md:307` calls that "two spellings of NULL".
	// If the two hashed the same, the seam would be harmless and the decision unnecessary. They do not.
	withZero, err := Canonicalize(map[string]any{
		"award_id":             "1",
		"tie_ladder_exit_step": json.Number("0"),
	}, true)
	if err != nil {
		t.Fatal(err)
	}
	absent, err := Canonicalize(map[string]any{"award_id": "1"}, true)
	if err != nil {
		t.Fatal(err)
	}
	if withZero == absent {
		t.Fatal("the 0 sentinel and an absent key produced IDENTICAL canonical bytes — DECISION J's " +
			"premise is false and the whole rule needs re-deriving")
	}
	if CanonicalSHA256Hex(withZero) == CanonicalSHA256Hex(absent) {
		t.Error("two different canonical forms hashed the same, which is not a JCS question at all")
	}
}

func TestApplyLadderExitStepDropsTheSentinel(t *testing.T) {
	// ⭐⭐ THE TEST THE MUTATION PASS DEMANDED. T8's M27 emitted `tie_ladder_exit_step: 0`
	// unconditionally and SURVIVED, because the decision lived inline inside `buildAwards` — five
	// table reads away from anything a unit test could reach. `TestDecisionJTheZeroSentinelHashes
	// DifferentlyFromAbsent` proved the two forms hash differently but never proved the BUILDER picks
	// the right one. This is that proof.
	step := 3
	zero := 0

	ran := map[string]any{}
	applyLadderExitStep(ran, &step)
	if got, ok := ran["tie_ladder_exit_step"]; !ok || got != json.Number("3") {
		t.Errorf("a ladder that ran at rung 3 published %#v, want the JSON integer 3", got)
	}

	// ⛔ THE LOAD-BEARING HALF: NULL in the column is ABSENT in the bundle.
	none := map[string]any{}
	applyLadderExitStep(none, nil)
	if _, present := none["tie_ladder_exit_step"]; present {
		t.Error("a NULL tie_ladder_exit_step produced a KEY — DECISION J spells it ABSENT, and a 0 " +
			"would hash differently from absent in every runtime that reads this bundle")
	}

	// ⚠ AND A GENUINE RUNG 0 IS STILL PUBLISHED. `omitempty` would drop this, which is why it is
	// banned at the site: today no rung is 0, and the day one is, this must not silently vanish.
	explicitZero := map[string]any{}
	applyLadderExitStep(explicitZero, &zero)
	if got, ok := explicitZero["tie_ladder_exit_step"]; !ok || got != json.Number("0") {
		t.Errorf("an explicit rung 0 published %#v — the drop keys on the POINTER, not on the value", got)
	}

	// The two documents must not hash alike, or the whole decision is moot.
	a, err := Canonicalize(map[string]any{"x": ran}, true)
	if err != nil {
		t.Fatal(err)
	}
	b, err := Canonicalize(map[string]any{"x": none}, true)
	if err != nil {
		t.Fatal(err)
	}
	if CanonicalSHA256Hex(a) == CanonicalSHA256Hex(b) {
		t.Error("a ladder-resolved award and a non-ladder one hashed identically")
	}
}

func TestSameStringsIsOrderSensitive(t *testing.T) {
	// ⚠ The DRAW order IS the reveal order (`0025:127-129`), so two lists holding the same ids in a
	// different order describe two different ceremonies. An order-INsensitive comparison here would
	// let the builder publish a live_award_ids ordering that disagreed with the run's.
	if !sameStrings([]string{"a", "b"}, []string{"a", "b"}) {
		t.Error("equal slices reported unequal")
	}
	if sameStrings([]string{"a", "b"}, []string{"b", "a"}) {
		t.Error("a REORDERED slice compared equal — the draw order is not a set")
	}
	if sameStrings([]string{"a"}, []string{"a", "b"}) {
		t.Error("slices of different length compared equal")
	}
}

func TestBundleAlgoVersionAgreesWithTheVectorAndTheMigration(t *testing.T) {
	// ⭐ THE CLOSED-SET DISCIPLINE APPLIED TO A CONSTANT. `algo_version` is pinned in three artifacts —
	// this file, `0029`'s `publish_bundle` and the gate-4 vector — and each one is written in a
	// different language by a different tool. Reading two of them here is what makes the third
	// unable to drift silently: a MAJOR bump has to move all three, deliberately, which is exactly
	// what `labels.go:34-35` means by "a deliberate, ceremony-invalidating act, not a refactor".
	v := loadCanonVector(t)
	if v.AlgoVersion != BundleAlgoVersion {
		t.Errorf("the vector declares algo_version %q and this build publishes %q",
			v.AlgoVersion, BundleAlgoVersion)
	}

	migration := filepath.Join("..", "..", "supabase", "migrations", "0029_verification_bundle.sql")
	raw, err := os.ReadFile(migration)
	if err != nil {
		t.Fatalf("reading %s, which is the evidence this test rests on: %v", migration, err)
	}
	want := "c_algo_version constant text := '" + BundleAlgoVersion + "'"
	if !strings.Contains(string(raw), want) {
		t.Errorf("migration 0029 does not pin algo_version as %q — the RPC would refuse every bundle "+
			"this builder produces with algo_version_mismatch", BundleAlgoVersion)
	}
}

func TestBuildingTheSameDocumentTwiceIsByteIdentical(t *testing.T) {
	// ⭐ THE DETERMINISM PROOF IN ITS DB-FREE HALF (the 6.8a form: two runs, compared as bytes, one
	// SHA-256). Map iteration order in Go is RANDOMISED per range, so a canonicalizer that leaned on
	// it — or a builder that emitted a map some other way — would fail this intermittently rather than
	// never. Twenty rounds is enough that a key-order dependence cannot pass by luck.
	doc := map[string]any{
		"algo_version": BundleAlgoVersion,
		"seed_hex":     strings.Repeat("a", 64),
		"luck":         map[string]any{"weight_table": intsToAny([]int{100, 40, 16, 6, 2, 1})},
		"players": []any{map[string]any{
			"steamid64": "76561198000000011",
			"volume":    map[string]any{"knife_kills": "3", "adr": "1234"},
			"idle_dq":   false,
		}},
		"pity": buildPity(awards.CeremonyRun{PityLabel: "inclusivcup/v1/pity"}),
	}
	first, err := Canonicalize(doc, true)
	if err != nil {
		t.Fatalf("canonicalizing: %v", err)
	}
	for i := 0; i < 20; i++ {
		again, err := Canonicalize(doc, true)
		if err != nil {
			t.Fatalf("round %d: %v", i, err)
		}
		if again != first {
			t.Fatalf("round %d produced different bytes:\n%s\n%s", i, first, again)
		}
	}
	if CanonicalSHA256Hex(first) == "" {
		t.Error("the hash is empty")
	}
}

func TestBuiltDocumentRefusesANonASCIIAwardName(t *testing.T) {
	// ⭐ B7 — THE FIRST CONSTRAINT IN THIS PROJECT TO GIVE TEETH TO `deferred-work.md:265-266`:
	// `award.name` accepts zero-width U+200B/200E/FEFF and has no length bound, and it became
	// viewer-visible at 6.8b. A name carrying one now REFUSES at build with a typed reason rather than
	// being silently escaped into the hashed bytes.
	// ⚠ SPELLED AS ESCAPES, NOT AS LITERAL CHARACTERS, AND THE COMPILER INSISTED: a literal U+FEFF in
	// Go source is `illegal byte order mark` and the package will not build. That is itself worth
	// recording — the character this guard exists to catch cannot even be written down in one of the
	// three runtimes that has to agree about it.
	for _, name := range []string{
		"Cuchiller\u200Bo", // U+200B ZERO WIDTH SPACE
		"Muralla\uFEFF",    // U+FEFF ZERO WIDTH NO-BREAK SPACE (BOM)
		"Cegador\u200E",    // U+200E LEFT-TO-RIGHT MARK
		"Cegador\u00E9",    // U+00E9 — an ordinary accented letter, the case a human would actually type
	} {
		_, err := Canonicalize(map[string]any{
			"awards": []any{map[string]any{"award_id": "1", "name": name}},
		}, true)
		ce, ok := err.(*CanonError)
		if !ok {
			t.Fatalf("%q produced %T (%v), want a typed *CanonError", name, err, err)
		}
		if ce.Reason != CanonNonASCII {
			t.Errorf("%q refused with %q, want %q", name, ce.Reason, CanonNonASCII)
		}
	}
	// The positive control: the same shape with an ASCII name is accepted, so the refusal above is
	// about the character and not about the shape.
	if _, err := Canonicalize(map[string]any{
		"awards": []any{map[string]any{"award_id": "1", "name": "Cuchillero"}},
	}, true); err != nil {
		t.Errorf("an ASCII award name was refused: %v", err)
	}
}
