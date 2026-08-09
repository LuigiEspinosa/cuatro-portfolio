// RFC-8785 (JSON Canonicalization Scheme) — PRODUCER side (Story 6.9a, FR-27 / AD-22 /
// SOLUTION-DESIGN §9.5-§9.6).
//
// THE ONE JOB: turn the verification bundle into the exact byte sequence whose SHA-256 is
// `bundle_sha256`. The commitment binds only if all three runtimes produce the SAME bytes, so this
// file is written FROM THE RFC TEXT and conforms to `roulette/vectors/canonical-bundle.json` —
// never to `lib/roulette/canonical.ts` and never to `generate_vectors.py`. When the three
// disagree, the vector decides; when the vector is silent, add a vector (README:13-24, rule 2).
//
// ⭐ WHY THIS LIVES IN `worker/ceremony` AND NOT IN `worker/awards`. `awards/prng_test.go` pins
// that package's FILE LIST by exact equality and keeps its `bannedImports` as "an exception list
// rather than an allowlist on purpose: a file added later is banned by default". `worker/awards`
// must stay the pure leaf `TestPackageIsALeaf` requires, and canonicalization is a serialization
// concern, not a draw concern. Measured before choosing: `worker/ceremony` carries no file-list
// pin and no banned-import list, so nothing here is being worked around.
// ⚠ The cross-language contract is the VECTOR, not the package path (SPINE:73-76) — which is why
// this variance from the architecture's directory sketch costs nothing.
//
// ⛔ DECISION L — NUMBERS ARE RESTRICTED TO SAFE INTEGERS, AND THE RESTRICTION IS A REFUSAL.
// RFC-8785 defines number serialization by the full ECMAScript Number::toString algorithm, which
// can emit 1e+30 and 5e-324. This build REFUSES every JSON number that is not a safe integer,
// because SPEC Constraint 7 makes the engine integer-only and the bundle carries every magnitude
// as a DECIMAL STRING by provenance (README:239-244). A float reaching a canonicalizer is a
// producer bug, and one that quietly serialized it would hash a value no verifier can compare.
//
// ⛔ EVERY MAGNITUDE STAYS TEXT ON THE WAY THROUGH. `encoding/json`'s default number type is
// float64, which silently rounds past 2^53 — the defect `.Float64()` and `.Int64()` are banned in
// the producer for. Decoding uses `UseNumber()` so a number keeps its source text until this file
// decides, exactly, what it is.
package ceremony

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"unicode/utf16"
	"unicode/utf8"
)

// ── the closed refusal set ────────────────────────────────────────────────────

// Canonicalization refusal reasons. ⛔ DECLARED ONCE, HERE, and asserted against the vector's
// `refusal_reasons` array rather than against a literal copied beside the assertion — this
// project's signature defect is a closed set measured by the size of a map literal written two
// lines above it, and it is at its seventh recorded occurrence.
const (
	CanonNonFiniteNumber = "non_finite_number"
	CanonNonIntegerNum   = "non_integer_number"
	CanonUnsafeInteger   = "unsafe_integer"
	CanonUnsupportedType = "unsupported_type"
	CanonLoneSurrogate   = "lone_surrogate"
	CanonNonASCII        = "non_ascii"
	CanonCycle           = "cycle"
)

// CanonRefusalReasons is the closed set, in the order the vector declares it.
var CanonRefusalReasons = []string{
	CanonNonFiniteNumber,
	CanonNonIntegerNum,
	CanonUnsafeInteger,
	CanonUnsupportedType,
	CanonLoneSurrogate,
	CanonNonASCII,
	CanonCycle,
}

// CanonError is a typed canonicalization refusal.
//
// ⛔ Never widen this to a bare error: `publish_bundle` mirrors these reasons into its own closed
// set and the admin route maps them to status codes, so an untyped failure here becomes an opaque
// 500 three layers up — the shape `6-8b:913` found, where a hand-written union plus a cast
// defeated the exhaustiveness the route calls load-bearing.
type CanonError struct {
	Reason string
	Detail string
}

func (e *CanonError) Error() string { return "canonical: " + e.Reason + " — " + e.Detail }

func canonFail(reason, format string, args ...any) *CanonError {
	return &CanonError{Reason: reason, Detail: fmt.Sprintf(format, args...)}
}

// MaxSafeInteger is 2^53 - 1, the largest magnitude a JSON number may carry in the bundle.
//
// Written as a literal because it is a CONTRACT BOUND shared with two runtimes that cannot spell
// it as an expression (`**` is a banned construct in `lib/roulette`), and a bound written three
// ways in three files is a bound that drifts. The vector carries it as a decimal string so all
// three read the same value rather than each declaring its own.
const MaxSafeInteger = 9007199254740991

// ── the serializer ────────────────────────────────────────────────────────────

// Canonicalize returns the RFC-8785 canonical form of an already-decoded JSON value.
//
// `v` must be the output of a decoder configured with `UseNumber()`: map[string]any, []any,
// json.Number, string, bool and nil. Anything else is `unsupported_type` — including float64,
// which is what an unconfigured decoder produces and which would mean a magnitude had already
// been through the rounding this file exists to prevent.
//
// `asciiOnly` applies §9.5's restriction on the BUNDLE. It is a per-call option and not a property
// of JCS: the ordering torture cases need supplementary-plane keys, while the bundle builder
// always passes true.
func Canonicalize(v any, asciiOnly bool) (string, error) {
	var b strings.Builder
	// Cycle detection over CONTAINERS ONLY, released on the way OUT — a sibling repeat of the same
	// map or slice is legal JSON and the bundle really does produce one after a filter chain.
	open := map[any]bool{}
	if err := canonEmit(&b, v, asciiOnly, open); err != nil {
		return "", err
	}
	return b.String(), nil
}

// CanonicalizeJSON decodes raw JSON text and canonicalizes it.
//
// ⚠⚠ THE ONE PLACE GO NEEDS EXTRA WORK TO AGREE WITH THE OTHER TWO RUNTIMES, and it is worth
// stating plainly because it is invisible otherwise. `encoding/json` SILENTLY REPLACES an
// unpaired surrogate escape with U+FFFD at PARSE time — before any canonicalizer can see it. So
// given the identical input `{"s":"\ud800"}`, TypeScript and Python refuse `lone_surrogate` while
// a naive Go implementation would succeed and hash a document containing a replacement character
// that was never in the source. Three runtimes, two answers, one commitment: that is exactly the
// divergence a golden vector exists to catch, and it is caught here rather than left to the day
// somebody publishes an award name with a broken escape in it.
//
// The detector: if the decoded value contains U+FFFD and the RAW INPUT did not, the decoder
// substituted, and the input carried an unpaired surrogate. Cheap, total, and it needs no
// second JSON scanner.
//
// ⚠ Under `asciiOnly` — which the bundle ALWAYS uses — the point is moot: U+FFFD is not ASCII, so
// all three runtimes refuse either way, merely with different reasons. The gate above matters for
// the `ascii_only:false` rows and for any future caller that turns the restriction off.
func CanonicalizeJSON(raw []byte, asciiOnly bool) (string, error) {
	dec := json.NewDecoder(strings.NewReader(string(raw)))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return "", canonFail(CanonUnsupportedType, "input is not valid JSON: %v", err)
	}
	rawHadReplacement := strings.Contains(string(raw), string(utf8.RuneError))
	if !rawHadReplacement && canonContainsReplacementChar(v) {
		return "", canonFail(CanonLoneSurrogate,
			"the decoder substituted U+FFFD, so the input carried an unpaired surrogate")
	}
	return Canonicalize(v, asciiOnly)
}

// canonContainsReplacementChar reports whether any string in the decoded tree holds U+FFFD.
func canonContainsReplacementChar(v any) bool {
	switch t := v.(type) {
	case string:
		return strings.ContainsRune(t, utf8.RuneError)
	case []any:
		for _, item := range t {
			if canonContainsReplacementChar(item) {
				return true
			}
		}
	case map[string]any:
		for k, item := range t {
			if strings.ContainsRune(k, utf8.RuneError) || canonContainsReplacementChar(item) {
				return true
			}
		}
	}
	return false
}

func canonEmit(b *strings.Builder, v any, asciiOnly bool, open map[any]bool) error {
	switch t := v.(type) {
	case nil:
		b.WriteString("null")
		return nil
	case bool:
		if t {
			b.WriteString("true")
		} else {
			b.WriteString("false")
		}
		return nil
	case string:
		return canonEmitString(b, t, asciiOnly)
	case json.Number:
		return canonEmitNumber(b, t)
	case []any:
		// The slice header is not comparable, so the cycle key is the address of the backing
		// array. A nil/empty slice has no stable address, and also cannot contain itself.
		var key any
		if len(t) > 0 {
			key = &t[0]
			if open[key] {
				return canonFail(CanonCycle, "the value contains a reference cycle")
			}
			open[key] = true
			defer delete(open, key)
		}
		b.WriteByte('[')
		for i, item := range t {
			if i > 0 {
				b.WriteByte(',')
			}
			if err := canonEmit(b, item, asciiOnly, open); err != nil {
				return err
			}
		}
		b.WriteByte(']')
		return nil
	case map[string]any:
		return canonEmitObject(b, t, asciiOnly, open)
	case float64:
		// ⛔ Reached only when the caller forgot `UseNumber()`. Refused rather than serialized:
		// by the time a magnitude is a float64 it has ALREADY been rounded, and emitting it would
		// publish a value that silently differs from the database's.
		return canonFail(CanonUnsupportedType,
			"float64 reached the canonicalizer — decode with UseNumber() so magnitudes stay exact")
	default:
		return canonFail(CanonUnsupportedType, "%T is not a JSON value", v)
	}
}

func canonEmitObject(b *strings.Builder, m map[string]any, asciiOnly bool, open map[any]bool) error {
	// ⭐⭐ B6 — RFC-8785 §3.2.3: "sort the properties by their key, in ascending order, comparing
	// the UTF-16 CODE UNITS". THIS IS NOT GO'S NATIVE STRING ORDER, and the difference is not
	// theoretical: a Go string sorts by UTF-8 BYTES, which is code-point order, so U+FB33 (Hebrew
	// dalet with dagesh) would sort BEFORE U+1F600 (emoji) — while UTF-16 puts the emoji first,
	// because its first code unit is the surrogate 0xD83D and 0xD83D < 0xFB33. RFC 8785's own
	// §3.2.3 example turns on exactly that pair, and it is row one of the gate-4 vector.
	//
	// ⚠ JavaScript gets this ordering FREE from a bare `.sort()`; Go and Python have to work for
	// it. That asymmetry is why the rule is commented in all three files rather than in one.
	// ⛔ AND DO NOT "UNIFY" THIS WITH THE ENGINE'S OTHER SORT. `awards/pity.go` and
	// `awards/sweep.go` sort steamid64 arrays BYTE-LEX — a different ordering, also correct, for
	// a different reason. Both are right; whoever merges them breaks exactly one, and the break is
	// invisible to the byte-accounting gate this epic was built on.
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool {
		return canonLessUTF16(keys[i], keys[j])
	})

	b.WriteByte('{')
	for i, k := range keys {
		if i > 0 {
			b.WriteByte(',')
		}
		if err := canonEmitString(b, k, asciiOnly); err != nil {
			return err
		}
		b.WriteByte(':')
		if err := canonEmit(b, m[k], asciiOnly, open); err != nil {
			return err
		}
	}
	b.WriteByte('}')
	return nil
}

// canonLessUTF16 compares two strings as sequences of UTF-16 code units (RFC-8785 §3.2.3).
func canonLessUTF16(a, b string) bool {
	ua := utf16.Encode([]rune(a))
	ub := utf16.Encode([]rune(b))
	for i := 0; i < len(ua) && i < len(ub); i++ {
		if ua[i] != ub[i] {
			return ua[i] < ub[i]
		}
	}
	return len(ua) < len(ub)
}

// canonEmitString implements §3.2.2.2 plus §9.5's optional ASCII restriction.
//
// ⚠ Non-ASCII characters that survive `asciiOnly == false` are emitted LITERALLY as UTF-8, not
// \u-escaped. That is the RFC's rule and the opposite of what an `ensure_ascii`-style helper does.
func canonEmitString(b *strings.Builder, s string, asciiOnly bool) error {
	// Invalid UTF-8 is Go's form of the lone-surrogate problem: it has no valid encoding, every
	// runtime would substitute U+FFFD, and the three would hash three different documents while
	// each one looked like it had succeeded.
	if !utf8.ValidString(s) {
		return canonFail(CanonLoneSurrogate, "string is not valid UTF-8: %q", s)
	}
	b.WriteByte('"')
	for _, r := range s {
		if asciiOnly && r > 0x7F {
			return canonFail(CanonNonASCII,
				"U+%04X violates the bundle's ASCII restriction", r)
		}
		// Unreachable for a valid-UTF-8 string (Go cannot encode a surrogate), asserted anyway:
		// the check is one comparison and its absence would be invisible until it mattered.
		if r >= 0xD800 && r <= 0xDFFF {
			return canonFail(CanonLoneSurrogate, "unpaired surrogate U+%04X", r)
		}
		switch r {
		case '\b':
			b.WriteString(`\b`)
		case '\t':
			b.WriteString(`\t`)
		case '\n':
			b.WriteString(`\n`)
		case '\f':
			b.WriteString(`\f`)
		case '\r':
			b.WriteString(`\r`)
		case '"':
			b.WriteString(`\"`)
		case '\\':
			b.WriteString(`\\`)
		default:
			if r < 0x20 {
				// LOWERCASE hex, four digits. `%04x` and not `%04X`: the RFC's escapes are
				// lowercase, and a case difference changes every byte of the hash.
				fmt.Fprintf(b, `\u%04x`, r)
			} else {
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte('"')
	return nil
}

// canonEmitNumber implements §3.2.2.3 RESTRICTED to safe integers (DECISION L).
//
// The number's SOURCE TEXT is parsed as an IEEE-754 double on purpose, not read as an integer:
// JCS is defined in terms of ECMAScript numbers, so `1`, `1.0` and `1e0` must be one value in
// every runtime. Using float64 here is faithful to the RFC rather than sloppy — and the safe-range
// check immediately after is what keeps it exact.
func canonEmitNumber(b *strings.Builder, n json.Number) error {
	f, err := strconv.ParseFloat(n.String(), 64)
	if err != nil {
		return canonFail(CanonUnsupportedType, "%s is not a JSON number: %v", n.String(), err)
	}
	if math.IsNaN(f) || math.IsInf(f, 0) {
		return canonFail(CanonNonFiniteNumber, "%s has no JSON representation", n.String())
	}
	if f != math.Trunc(f) {
		return canonFail(CanonNonIntegerNum,
			"%s is fractional; every magnitude in the bundle is a decimal STRING", n.String())
	}
	if math.Abs(f) > MaxSafeInteger {
		return canonFail(CanonUnsafeInteger,
			"%s exceeds 2^53-1; carry it as a decimal string, never as a JSON number", n.String())
	}
	// RFC 8785 requires -0 to serialize as 0. int64 conversion normalizes it, which is why this
	// needs no special case — and why the vector pins it, so the absence of a special case is
	// proven rather than assumed.
	b.WriteString(strconv.FormatInt(int64(f), 10))
	return nil
}

// CanonicalSHA256Hex is SHA-256 of the canonical UTF-8 bytes, lowercase hex.
//
// This is `verification_bundle.bundle_sha256`, which `SPINE:223` and `glossary.md:24` call
// `bundle_hash`. ⭐ B8: ONE VALUE, TWO NAMES, fixed once — the same precedent 6.2 set for
// `seed_demo_sha256` ↔ `seed_hex`. ⛔ Do not create a second field for the second name.
//
// ⛔ AND IT IS NOT `stat_snapshot.content_sha256`. `0024:760-762` says so in the file that computes
// that one: "This digest proves the captured bytes are the bytes and NOTHING more; 6.9 must not
// inherit it as a constraint." Different input, different purpose, different recipe.
func CanonicalSHA256Hex(canonical string) string {
	sum := sha256.Sum256([]byte(canonical))
	return hex.EncodeToString(sum[:])
}
