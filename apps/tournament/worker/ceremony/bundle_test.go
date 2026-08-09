package ceremony

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"testing"
	"unicode/utf8"
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

func TestCanonEndToEndBundleRowIsStillOwed(t *testing.T) {
	// ⛔ AC2 requires "an end-to-end bundle_sha256 over the REAL ceremony's bundle carried as
	// data". That document only exists after Task 9 rebuilds the 14-demo corpus, runs the
	// ceremony, persists it and publishes — so the row is OWED, and its absence is asserted here
	// rather than left as a silent gap somebody has to notice.
	//
	// ⚠ THIS REDDENS DELIBERATELY THE MOMENT TASK 9 FILLS THE ROW, which is the same
	// deliberate-update pattern the TypeScript module list uses. When it goes red the fix is to
	// change the expected count HERE, on purpose, having read the new row — never to delete it.
	v := loadCanonVector(t)
	if len(v.EndToEnd) != 0 {
		t.Errorf("end_to_end now carries %d row(s); update this expectation deliberately and "+
			"verify each row below", len(v.EndToEnd))
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
