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
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"unicode/utf16"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"cs-tournament/worker/awards"
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
	CanonMaxDepth        = "max_depth_exceeded"
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
	CanonMaxDepth,
}

// CanonMaxDepth is the nesting bound, shared verbatim with the other two runtimes.
//
// ⭐ ADDED BY THE 6.9a CODE REVIEW. Without it a deeply nested document fails as an UNTYPED
// language-level failure at three different depths — `RangeError` in TypeScript, `RecursionError`
// in Python, an unrecoverable goroutine stack overflow in Go — from modules whose entire contract
// is that every refusal is typed and drawn from a closed set. In 6.9b that untyped throw reaches
// the `write_failed` -> 500 escape hatch the route header says must never receive a business-shaped
// failure. 256 is ~60x the real bundle's depth (`players[].rate.num` is 4) and far below every
// runtime's native limit, so the typed refusal always wins the race.
const CanonMaxDepthLimit = 256

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
	// ⭐ 6.9a CODE REVIEW: this tracks MAPS AS WELL AS SLICES. It previously registered only the
	// slice arm, so `cycle` was structurally unreachable for objects and a self-referential map
	// recursed to an unrecoverable stack overflow — while TypeScript (`open.add(obj)` for both) and
	// Python (`id(v)` in both branches) returned the typed refusal. `BuildBundle` builds native
	// `map[string]any` values, so the unguarded arm was the one the producer actually walks.
	open := map[any]bool{}
	if err := canonEmit(&b, v, asciiOnly, open, 0); err != nil {
		return "", err
	}
	return b.String(), nil
}

// canonMapRef is a cycle key for a map. Maps are not comparable, so they cannot be used as map
// keys directly; their runtime pointer can. The distinct type keeps a map's pointer from ever
// colliding with the `*any` element address the slice arm uses.
type canonMapRef uintptr

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
// ⛔⛔ THE DETECTOR WAS REWRITTEN BY THE 6.9a CODE REVIEW, AND THE OLD ONE'S TWO FAILURES ARE
// RECORDED HERE SO NOBODY RESTORES IT AS A SIMPLIFICATION. It was:
//
//	rawHadReplacement := strings.Contains(string(raw), string(utf8.RuneError))
//	if !rawHadReplacement && canonContainsReplacementChar(v) { ...refuse... }
//
// a DOCUMENT-GLOBAL flag gating a DOCUMENT-GLOBAL scan, which fails in both directions:
//
//   - FAIL-OPEN: `{"a":"<literal U+FFFD>","b":"\ud800"}`. The raw text does contain U+FFFD, so the
//     whole guard is skipped, the decoder's substitution in `b` goes unnoticed, and Go hashes a
//     document TypeScript and Python both refuse. One legitimate replacement character anywhere
//     disabled the check for every string in the document — the exact divergence it existed to stop.
//   - FAIL-CLOSED: `{"s":"�"}` with `asciiOnly:false`. The raw bytes hold six ASCII characters
//     and no U+FFFD, the decoded value holds one, so Go refused `lone_surrogate` for a document
//     carrying no surrogate at all. TS and Python accept it.
//
// The replacement tests the ACTUAL condition — an unpaired surrogate ESCAPE in the source text —
// by scanning the raw JSON directly, so a legitimate U+FFFD elsewhere is irrelevant and an escaped
// `�` is not mistaken for one. Invalid UTF-8 in the input is refused for the same reason
// `canonEmitString` refuses it: `encoding/json` would substitute there too.
func CanonicalizeJSON(raw []byte, asciiOnly bool) (string, error) {
	if !utf8.Valid(raw) {
		return "", canonFail(CanonLoneSurrogate,
			"input is not valid UTF-8, so the decoder would substitute U+FFFD")
	}
	if canonRawHasLoneSurrogateEscape(raw) {
		return "", canonFail(CanonLoneSurrogate,
			"the input carries an unpaired surrogate escape, which the decoder replaces with U+FFFD")
	}
	dec := json.NewDecoder(strings.NewReader(string(raw)))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return "", canonFail(CanonUnsupportedType, "input is not valid JSON: %v", err)
	}
	return Canonicalize(v, asciiOnly)
}

// canonHex4 reads the four hex digits of a `\uXXXX` escape starting at pos.
func canonHex4(raw []byte, pos int) (rune, bool) {
	if pos+4 > len(raw) {
		return 0, false
	}
	var v rune
	for i := 0; i < 4; i++ {
		c := raw[pos+i]
		switch {
		case c >= '0' && c <= '9':
			v = v<<4 | rune(c-'0')
		case c >= 'a' && c <= 'f':
			v = v<<4 | rune(c-'a'+10)
		case c >= 'A' && c <= 'F':
			v = v<<4 | rune(c-'A'+10)
		default:
			return 0, false
		}
	}
	return v, true
}

// canonRawHasLoneSurrogateEscape reports whether the raw JSON text contains a `\uD800`-`\uDFFF`
// escape that is not part of a well-formed surrogate pair.
//
// ⚠ It tracks string context and backslash escaping, because `"\\u0041"` is a literal backslash
// followed by the characters `u0041` — not an escape — and a naive substring scan would read it as
// one.
func canonRawHasLoneSurrogateEscape(raw []byte) bool {
	inString := false
	for i := 0; i < len(raw); i++ {
		c := raw[i]
		if !inString {
			if c == '"' {
				inString = true
			}
			continue
		}
		if c == '"' {
			inString = false
			continue
		}
		if c != '\\' || i+1 >= len(raw) {
			continue
		}
		if raw[i+1] != 'u' {
			i++ // a two-character escape: \" \\ \/ \b \f \n \r \t
			continue
		}
		hi, ok := canonHex4(raw, i+2)
		if !ok {
			i++
			continue
		}
		switch {
		case hi >= 0xD800 && hi <= 0xDBFF:
			// A high surrogate is legal ONLY when the very next token is its low half.
			if i+12 <= len(raw) && raw[i+6] == '\\' && raw[i+7] == 'u' {
				if lo, ok2 := canonHex4(raw, i+8); ok2 && lo >= 0xDC00 && lo <= 0xDFFF {
					i += 11
					continue
				}
			}
			return true
		case hi >= 0xDC00 && hi <= 0xDFFF:
			// A low surrogate reached on its own: any valid pair was consumed by the case above.
			return true
		}
		i += 5
	}
	return false
}

func canonEmit(b *strings.Builder, v any, asciiOnly bool, open map[any]bool, depth int) error {
	if depth > CanonMaxDepthLimit {
		return canonFail(CanonMaxDepth,
			"nesting exceeds %d levels", CanonMaxDepthLimit)
	}
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
			if err := canonEmit(b, item, asciiOnly, open, depth+1); err != nil {
				return err
			}
		}
		b.WriteByte(']')
		return nil
	case map[string]any:
		return canonEmitObject(b, t, asciiOnly, open, depth)
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

func canonEmitObject(b *strings.Builder, m map[string]any, asciiOnly bool, open map[any]bool, depth int) error {
	// ⭐ 6.9a CODE REVIEW — THE CYCLE KEY. This arm previously took `open` and never touched it, so
	// `cycle` was unreachable for objects and `m := map[string]any{}; m["self"] = m` recursed until
	// the process died. Registered on the way in, released on the way out, exactly as the slice arm
	// does — a sibling repeat of the same map stays legal.
	if m != nil {
		key := canonMapRef(reflect.ValueOf(m).Pointer())
		if open[key] {
			return canonFail(CanonCycle, "the value contains a reference cycle")
		}
		open[key] = true
		defer delete(open, key)
	}
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
		if err := canonEmit(b, m[k], asciiOnly, open, depth+1); err != nil {
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
	// ⭐⭐ 6.9a CODE REVIEW — `ErrRange` IS NOT A SYNTAX ERROR, AND TREATING IT AS ONE SPLIT THE
	// THREE RUNTIMES TWO WAYS. `ParseFloat` returns a NON-NIL error for both overflow and
	// underflow: ±Inf with `ErrRange` for `1e400`, and ~0 with `ErrRange` for `1e-400`. Testing
	// `err != nil` first meant:
	//
	//   `1e400`  — TS and Python say `non_finite_number` (JSON.parse/json.loads yield Infinity);
	//              Go said `unsupported_type`. Same refusal, three names for it, one closed set.
	//   `1e-400` — TS and Python round to 0 and emit `0`; Go REFUSED outright. Two runtimes hash a
	//              document the third cannot produce, which is a broken commitment, not a nit.
	//
	// The returned value is well-defined in both range cases, so it is carried through to the
	// checks below: the overflow lands on `IsInf` -> `non_finite_number`, and the underflow lands
	// on the integer path -> `0`. Both now agree with ECMAScript, which is what JCS is defined in
	// terms of. Only a genuine SYNTAX error is `unsupported_type`.
	if err != nil {
		var numErr *strconv.NumError
		if !errors.As(err, &numErr) || numErr.Err != strconv.ErrRange {
			return canonFail(CanonUnsupportedType, "%s is not a JSON number: %v", n.String(), err)
		}
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

// ── the builder ───────────────────────────────────────────────────────────────
//
// ⭐⭐ THE BUNDLE IS DERIVED FROM THE **DATABASE**, WITH THE STREAM FACTS SUPPLIED BY THE RUN, AND
// THE SPLIT IS NOT ARBITRARY. Everything the database holds is read from the database, because that
// is what makes the document re-derivable after the producer's process exits and what makes
// `publish_bundle`'s count checks meaningful. The exceptions are the four Stage-1 fields nothing
// persists — `weights`, `total_weight`, `draws` and `live_count` — which exist only in the producer's
// `CeremonyRun`. ⚠ SAYING SO PLAINLY MATTERS: a reader who assumed "derived from the database" was
// total would look for a `spin.weights` column and not find one. `0029`'s AC10 adds `label` and
// `bytes_consumed` as columns precisely so the two most load-bearing provenance fields are NOT in
// that exception list — and this builder CROSS-CHECKS the run's copies against the persisted ones.
//
// ⚠ THIS IS THE THIRD TRANSLATION LAYER, AND 6.8a MEASURED WHAT THAT COSTS. Its THE BAR run found
// `BuildPayload` never populated `seed_hex`: "`worker/awards` proves the RUN and `0027`'s pgTAP
// proves the WRITER — the TRANSLATION between them was covered by neither." This file is a third
// such translation, so it validates rather than assumes at every seam it crosses.
//
// ⭐ DECISION J, GENERALISED AND STATED ONCE: **NULL IN THE DATABASE IS SPELLED *ABSENT* IN THE
// BUNDLE**, never as `null`, `0` or `""`. RFC-8785 hashes an absent key and a present-but-null key
// differently, so one runtime "helpfully" filling a zero value produces a different `bundle_sha256`
// with nothing looking wrong. `tie_ladder_exit_step` is the case `deferred-work.md:307` named — Go
// carries `0` for "no ladder ran", TS omits the key, and the column is already NULL after the RPC's
// `nullif(v, 0)` — so the key is DROPPED here. ⛔ Do NOT reach for `omitempty`: it would do the
// right thing today for the wrong reason and break the day the sentinel changes.

// BundleAlgoVersion is the `algo_version` this build publishes.
//
// ⚠ It is pinned in THREE places on purpose and they are cross-checked rather than trusted:
// here, `0029`'s `publish_bundle` (`c_algo_version`), and the gate-4 vector's `algo_version`. A
// MAJOR bump is "a deliberate, ceremony-invalidating act, not a refactor" (`labels.go:34-35`), so it
// costs a migration — which is the point of pinning it in SQL at all.
const BundleAlgoVersion = "inclusivcup-roulette-1.0.0"

// BuildBundle renders the ceremony as the canonical document AC3 specifies: exactly the seven keys
// `{algo_version, seed_hex, luck, spin_plan, awards, pity, players}`.
//
// The returned value is decoder-shaped — map[string]any / []any / json.Number / string / bool — so it
// can be handed straight to Canonicalize with no re-parse. ⛔ It is deliberately NOT a struct with
// JSON tags: `encoding/json` would decide key order, number formatting and omission, and every one of
// those three decisions belongs to the canonicalizer.
func BuildBundle(
	ctx context.Context,
	pool *pgxpool.Pool,
	ceremonyID int64,
	run awards.CeremonyRun,
) (map[string]any, error) {
	var (
		tournamentID int64
		snapshotID   *int64
		seedHex      *string
		table        []int32
	)
	err := pool.QueryRow(ctx, `
		select c.tournament_id, c.snapshot_id, c.seed_demo_sha256, c.luck_weight_table
		  from public.ceremony c
		 where c.id = $1`, ceremonyID).
		Scan(&tournamentID, &snapshotID, &seedHex, &table)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("ceremony %d does not exist", ceremonyID)
	}
	if err != nil {
		return nil, fmt.Errorf("reading ceremony %d: %w", ceremonyID, err)
	}
	if snapshotID == nil {
		return nil, fmt.Errorf("ceremony %d has no snapshot — lock_ceremony has not run", ceremonyID)
	}
	if seedHex == nil {
		return nil, fmt.Errorf("ceremony %d has no frozen seed (AD-13)", ceremonyID)
	}

	// ⛔ THE SEED IS CROSS-CHECKED, NOT COPIED FROM WHICHEVER SOURCE IS NEARER. `persist_ceremony`
	// already refused a `seed_mismatch` and `publish_bundle` will refuse one again — but a builder
	// that silently took the run's copy would publish a document naming a seed the ceremony never
	// froze if the run were ever handed to the wrong ceremony id.
	if run.SeedHex != *seedHex {
		return nil, fmt.Errorf(
			"ceremony %d froze seed %s but the run was drawn from %s — refusing to build a bundle "+
				"that names a seed the ceremony did not freeze", ceremonyID, *seedHex, run.SeedHex)
	}

	weights := make([]any, 0, len(table))
	for _, w := range table {
		weights = append(weights, jsonInt(int64(w)))
	}

	spinPlan, err := buildSpinPlan(ctx, pool, ceremonyID, run)
	if err != nil {
		return nil, err
	}
	awardEntries, err := buildAwards(ctx, pool, ceremonyID, tournamentID)
	if err != nil {
		return nil, err
	}
	players, err := buildPlayers(ctx, pool, *snapshotID)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"algo_version": BundleAlgoVersion,
		"seed_hex":     *seedHex,
		// ⭐ THE THREE-NAME COLLISION, RESOLVED HERE AND NOWHERE ELSE (`0025:76-80`): the COLUMN is
		// `ceremony.luck_weight_table`, the spine calls it `luck.weight_table`, and the bundle key is
		// `luck`. One value, three names, and this is the only place all three meet.
		"luck":      map[string]any{"weight_table": weights},
		"spin_plan": spinPlan,
		"awards":    awardEntries,
		"pity":      buildPity(run),
		"players":   players,
	}, nil
}

// buildSpinPlan renders one entry per PERSISTED spin — main and pity alike — because that is what
// makes `verification_bundle_read`'s gate exact: one bundle entry per `spin` row, filtered by that
// row's own `revealed_at`.
//
// ⭐ B3 — every main entry carries `pool`, `weights` and `label`, which together with the seed are
// SUFFICIENT to re-check the draw with NO award metadata. That sufficiency is what makes progressive
// verification possible at all: the projection can serve a revealed spin's draw without serving
// anything about the awards in it.
func buildSpinPlan(
	ctx context.Context,
	pool *pgxpool.Pool,
	ceremonyID int64,
	run awards.CeremonyRun,
) ([]any, error) {
	rows, err := pool.Query(ctx, `
		select s.spin_index, s.kind, s.label, s.bytes_consumed, coalesce(s.live_award_ids, '[]'::jsonb)
		  from public.spin s
		 where s.ceremony_id = $1
		 order by s.spin_index`, ceremonyID)
	if err != nil {
		return nil, fmt.Errorf("reading the spins of ceremony %d: %w", ceremonyID, err)
	}
	defer rows.Close()

	// The run's main spins, by 1-based index, so each database row can be reconciled with the stream
	// facts the database does not hold.
	mains := map[int]awards.CeremonySpin{}
	for _, s := range run.Spins {
		mains[s.Spin] = s
	}

	var out []any
	for rows.Next() {
		var (
			spinIndex     int
			kind          string
			label         *string
			bytesConsumed *int64
			liveRaw       []byte
		)
		if err := rows.Scan(&spinIndex, &kind, &label, &bytesConsumed, &liveRaw); err != nil {
			return nil, fmt.Errorf("scanning a spin row: %w", err)
		}

		// ⛔ A NULL HERE IS A HARD FAILURE, NOT A DEFAULT. `label` and `bytes_consumed` are nullable
		// columns because rows persisted before `0029` cannot have them (there is no back-fill that
		// could invent a stream label) — so a NULL means this ceremony was persisted by the OLD
		// `persist_ceremony` and its provenance is simply not recorded. Publishing a bundle that
		// guessed at either would publish a claim about which stream a spin drew from.
		if label == nil || bytesConsumed == nil {
			return nil, fmt.Errorf(
				"spin %d of ceremony %d has no label/bytes_consumed — it was persisted before "+
					"migration 0029 added the columns; re-run persist_ceremony before publishing",
				spinIndex, ceremonyID)
		}

		entry := map[string]any{
			"spin":           jsonInt(int64(spinIndex)),
			"kind":           kind,
			"label":          *label,
			"bytes_consumed": jsonInt(*bytesConsumed),
		}

		if kind == "main" {
			s, ok := mains[spinIndex]
			if !ok {
				return nil, fmt.Errorf(
					"ceremony %d has a persisted main spin %d that the run does not describe",
					ceremonyID, spinIndex)
			}
			// ⛔ THE CROSS-CHECK THAT EARNS THE COLUMNS. `label` and `bytes_consumed` now exist in BOTH
			// the run and the database, so disagreement is detectable — and it is exactly the class of
			// defect 6.8a's THE BAR found in the previous translation layer. `bytes_consumed` is
			// REPRODUCED, never re-derived (`README:531-535`), so this compares rather than recomputes.
			if s.Label != *label {
				return nil, fmt.Errorf(
					"spin %d: the run drew from stream %q but the database recorded %q",
					spinIndex, s.Label, *label)
			}
			if int64(s.Consumed) != *bytesConsumed {
				return nil, fmt.Errorf(
					"spin %d: the run consumed %d bytes but the database recorded %d",
					spinIndex, s.Consumed, *bytesConsumed)
			}

			// ⛔ `spin.live_award_ids` IS A JSONB ARRAY OF **BIGINTS**, NOT OF STRINGS, AND THE MISMATCH
			// IS A REAL SEAM RATHER THAN A TYPO. The producer's award identity is an opaque STRING
			// (`worker/ceremony:100-104`); `persist_ceremony` RESOLVES each one against the frozen
			// catalog and stores `award.id` as a number (`0028:1779-1783`). The bundle publishes the
			// STRING form again, because an id is a name and every steamid64 in this document is a
			// string for the same reason. So this decodes numbers and re-renders them as decimals.
			// ⚠ `json.Number`, not float64: an award id is small today, but reading ids through a
			// float is the habit that loses a magnitude the day one is not.
			var liveNums []json.Number
			decLive := json.NewDecoder(strings.NewReader(string(liveRaw)))
			decLive.UseNumber()
			if err := decLive.Decode(&liveNums); err != nil {
				return nil, fmt.Errorf("spin %d: decoding live_award_ids: %w", spinIndex, err)
			}
			live := make([]string, 0, len(liveNums))
			for _, n := range liveNums {
				live = append(live, n.String())
			}
			if !sameStrings(live, s.Stage1.Live) {
				return nil, fmt.Errorf(
					"spin %d: the run drew %v but the database recorded %v — the DRAW order IS the "+
						"reveal order and the two must not disagree", spinIndex, s.Stage1.Live, live)
			}

			entry["live_count"] = jsonInt(int64(s.Plan.LiveCount))
			entry["pool"] = strsToAny(s.Plan.Pool)
			entry["live"] = strsToAny(live)
			entry["weights"] = intsToAny(s.Stage1.Weights)
			entry["total_weight"] = jsonInt(int64(s.Stage1.TotalWeight))

			draws := make([]any, 0, len(s.Stage1.Draws))
			for _, d := range s.Stage1.Draws {
				draws = append(draws, map[string]any{
					"n":              jsonUint(d.N),
					"r":              jsonUint(d.R),
					"consumed_after": jsonUint(d.ConsumedAfter),
				})
			}
			entry["draws"] = draws
		}
		// ⚠ A PITY ENTRY CARRIES **ONLY** THE FOUR COMMON FIELDS, AND THAT IS NOT AN OMISSION.
		// FR-28 draws the whole consolation order from ONE stream, so there is no per-consolation-spin
		// Stage-1 draw to publish; the draw itself lives in the `pity` key. Giving these entries an
		// empty `pool`/`weights` would assert a Stage-1 pick that never happened.

		out = append(out, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("reading the spins of ceremony %d: %w", ceremonyID, err)
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("ceremony %d has no persisted spins", ceremonyID)
	}
	return out, nil
}

// buildAwards renders one entry per award the ceremony DECIDED — its frozen catalog metadata merged
// with its result.
//
// ⚠ FLAT, NOT NESTED, and the choice is recorded because AC3 spells it "`{award_id, name, …}` + its
// result `{outcome_kind, …}`" and both readings are defensible. Flat wins because the two field sets
// are disjoint, because a verifier comparing an award's published outcome against its re-derived one
// then compares one object rather than reaching through a wrapper, and because it keeps the
// canonical key order a single sorted sequence.
func buildAwards(ctx context.Context, pool *pgxpool.Pool, ceremonyID, tournamentID int64) ([]any, error) {
	// ⛔⛔ DECISION N — THE BUNDLE PUBLISHES `award_id`, NOT `name`, AND THE BAR IS WHAT DECIDED IT.
	//
	// AC3 lists `name` among the awards entry's fields. SOLUTION-DESIGN §9.5 makes the bundle
	// ASCII-restricted and AC2 requires the builder to REFUSE a non-ASCII payload with a typed reason.
	// The shipped catalog's names are Spanish: "Máquina de Frags", "Puntería Quirúrgica", "Rey del
	// Daño". ⭐ ALL THREE CANNOT HOLD, and no amount of reading spots it — the first full run of THE
	// BAR died on `non_ascii — U+00E1 violates the bundle's ASCII restriction`, at the first award.
	//
	// The resolution keeps the cryptographic contract intact and drops the field, because `name` is the
	// only one of the three that is not load-bearing:
	//   * A VERIFIER NEVER READS IT. Winners are re-derived from the snapshot, the seed and the award's
	//     RESOLUTION fields (class, direction, deciding_stat, the floors, the rung keys) — every one of
	//     which is a snake_case ASCII identifier. `award.name` is display copy; `0023` and
	//     SOLUTION-DESIGN:219 both class it that way, and nothing re-derives an outcome from it.
	//   * AD-24 HOMES VIEWER COPY TO ONE PLACE, and it is not a hashed document. 6.9b's strip renders
	//     award names from the reveal-gated `award` table (`0028`'s policy), exactly as the feed already
	//     does — so dropping `name` here costs no surface anything.
	//   * IT KEEPS THE ASCII REFUSAL REAL. The alternative — relaxing §9.5 — would invalidate the
	//     gate-4 vector, all three canonicalizers and DECISION L, and would re-open the hazard the rule
	//     was written for (`deferred-work.md:265-266`: award `name` accepts zero-width U+200B/200E/FEFF
	//     and has no length bound). Keeping the restriction absolute means it now bites ONLY on that
	//     hazard, which is what AC2 says it is for.
	// ⚠ THE COST, STATED PLAINLY: a reader of the raw bundle sees `"award_id":"4"` and must join the
	// catalog to learn which trophy it is. That is the same indirection `pool` and `live` already carry,
	// and `persist_ceremony` re-resolves every one of those ids against the frozen catalog.
	rows, err := pool.Query(ctx, `
		select a.id, a.bucket, a.class, a.deciding_stat, a.direction,
		       a.secondary_stat, a.eff_num_key, a.eff_den_key,
		       a.floor_rounds, a.floor_kills, a.priority,
		       ar.outcome_kind, ar.deciding_value::text, ar.deciding_num::text, ar.deciding_den::text,
		       ar.tie_ladder_exit_step, ar.is_shared, ar.is_pity,
		       coalesce(
		         (select array_agg(re.steamid64)
		            from public.award_result_winner w
		            join public.roster_entry re on re.id = w.winner_entry_id
		           where w.award_result_id = ar.id),
		         '{}'::text[]
		       )
		  from public.award_result ar
		  join public.spin s on s.id = ar.spin_id
		  join public.award a on a.id = ar.award_id
		 where s.ceremony_id = $1 and a.tournament_id = $2
		 -- 6.9a CODE REVIEW: ordering by a.priority ALONE IS NOT A TOTAL ORDER. Nothing in the
		 -- catalog makes priority unique, and PostgreSQL leaves ties in unspecified order, so two
		 -- awards sharing a priority could re-derive to different bytes -- and therefore a different
		 -- bundle_sha256 -- for the same ceremony after a replan or a vacuum. a.id is the primary
		 -- key, so the pair is total by construction. The Go-side sort after the scan loop is what
		 -- actually guarantees it; this keeps the query readable on its own terms.
		 order by a.priority, a.id`, ceremonyID, tournamentID)
	if err != nil {
		return nil, fmt.Errorf("reading the award results of ceremony %d: %w", ceremonyID, err)
	}
	defer rows.Close()

	var out []any
	for rows.Next() {
		var (
			id                                int64
			bucket, class, stat, direction    string
			secondary, effNum, effDen         *string
			floorRounds, floorKills, priority int
			outcomeKind                       string
			decidingValue, decNum, decDen     *string
			exitStep                          *int
			isShared, isPity                  bool
			winners                           []string
		)
		if err := rows.Scan(&id, &bucket, &class, &stat, &direction,
			&secondary, &effNum, &effDen, &floorRounds, &floorKills, &priority,
			&outcomeKind, &decidingValue, &decNum, &decDen, &exitStep, &isShared, &isPity,
			&winners); err != nil {
			return nil, fmt.Errorf("scanning an award result row: %w", err)
		}

		entry := map[string]any{
			// ⚠ THE IDENTITY IS `award.id` RENDERED AS DECIMAL, and `worker/ceremony:100-104` homed
			// that choice here: "Story 6.9 owns whatever identity the published bundle carries." It is
			// a STRING for the same reason every steamid64 is — an id is a name, not a magnitude — and
			// it matches the `pool`/`live` arrays, which a verifier joins against.
			"award_id":      strconv.FormatInt(id, 10),
			"bucket":        bucket,
			"class":         class,
			"deciding_stat": stat,
			"direction":     direction,
			// ⭐ B5 — the catalog and algorithm integers stay JSON INTEGERS. The split is by
			// PROVENANCE, not by size (`README:239-244`): these are bounded catalog columns, while
			// every SNAPSHOT magnitude below is an unbounded decimal STRING.
			"floor_rounds": jsonInt(int64(floorRounds)),
			"floor_kills":  jsonInt(int64(floorKills)),
			"priority":     jsonInt(int64(priority)),
			"outcome_kind": outcomeKind,
			"is_shared":    isShared,
			"is_pity":      isPity,
		}

		// NULL is ABSENT — see the builder's header. The three FR-29 rung keys are nullable in the
		// catalog (`0023:97-115`), and a `""` here would be a value the database does not hold.
		putIfPresent(entry, "secondary_stat", secondary)
		putIfPresent(entry, "eff_num_key", effNum)
		putIfPresent(entry, "eff_den_key", effDen)

		// ⭐ B5 again, from the other side: the DECIDING MAGNITUDES are decimal STRINGS even when
		// small, because they come from the snapshot. `::text` on a numeric/bigint gives the exact
		// decimal the column holds — ⛔ never a float, which `6-5b:587` measured reading both sides of
		// a comparison as 2^53 and bottoming a ladder out at rung 5.
		putIfPresent(entry, "deciding_value", decidingValue)
		putIfPresent(entry, "deciding_num", decNum)
		putIfPresent(entry, "deciding_den", decDen)

		// ⭐⭐ DECISION J AT ITS SITE — see `applyLadderExitStep`, which is a named function ONLY so
		// this decision is reachable from a test without a database.
		applyLadderExitStep(entry, exitStep)

		// ⚠ SORTED IN GO, NOT IN SQL, AND THAT IS DELIBERATE. `order by steamid64` sorts under the
		// database's COLLATION, which is not byte-lex in general; Go's `<` on strings is byte-lex by
		// definition. For 17-digit ASCII ids the two agree — which is exactly the kind of "agrees
		// today" the engine's own `STEAMID64_RE` guards make true by construction rather than by luck.
		sorted := append([]string{}, winners...)
		sort.Strings(sorted)
		entry["winners"] = strsToAny(sorted)

		out = append(out, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("reading the award results of ceremony %d: %w", ceremonyID, err)
	}
	// ⭐ 6.9a CODE REVIEW — the array order is hashed, so it is fixed IN GO rather than trusted from
	// the planner. `priority` is not unique in the catalog; `award_id` is a decimal-string primary
	// key, so comparing the pair numerically-then-by-id is a total order that no plan change, index
	// choice or vacuum can perturb.
	sort.SliceStable(out, func(i, j int) bool {
		mi, mj := out[i].(map[string]any), out[j].(map[string]any)
		pi := mi["priority"].(json.Number).String()
		pj := mj["priority"].(json.Number).String()
		if pi != pj {
			vi, _ := strconv.ParseInt(pi, 10, 64)
			vj, _ := strconv.ParseInt(pj, 10, 64)
			return vi < vj
		}
		ai, _ := strconv.ParseInt(mi["award_id"].(string), 10, 64)
		aj, _ := strconv.ParseInt(mj["award_id"].(string), 10, 64)
		return ai < aj
	})
	return out, nil
}

// buildPity renders FR-28's consolation draw — the shape Story 6.7 recorded at `6-7:1340-1343`.
//
// ⚠ IT COMES FROM THE RUN, NOT THE DATABASE, AND THE REASON IS STRUCTURAL: the database stores the
// consolation OUTCOME (one pity spin per winner, in reveal order) but not the DRAW that produced it.
// `n`, `k`, `rejections` and `value` are stream facts, and `rejections` in particular is derived from
// the byte position rather than counted — the field `deferred-work.md:348` made integer in all three
// runtimes precisely because it is published here and therefore outcome-affecting for the hash.
func buildPity(run awards.CeremonyRun) map[string]any {
	draws := make([]any, 0, len(run.Pity.Draws))
	for _, d := range run.Pity.Draws {
		draws = append(draws, map[string]any{
			"n":          jsonUint(d.N),
			"k":          jsonInt(int64(d.K)),
			"rejections": jsonInt(int64(d.Rejections)),
			"value":      jsonUint(d.Value),
		})
	}
	// ⚠ `Winless` and `RevealOrder` are ALWAYS non-nil, even when empty (`pity.go:205-220` — "three
	// spellings of absence is a hazard this epic has paid for twice already"), so these emit `[]`
	// rather than `null` with no coalesce needed here.
	return map[string]any{
		"label":          run.PityLabel,
		"winless":        strsToAny(run.Pity.Winless),
		"reveal_order":   strsToAny(run.Pity.RevealOrder),
		"draws":          draws,
		"bytes_consumed": jsonUint(run.Pity.BytesConsumed),
	}
}

// buildPlayers renders the AD-19 integer-form snapshot, one entry per `stat_snapshot_row`.
//
// ⭐ B4 — IT IS PUBLISHED IN FULL FROM THE START AND THAT IS NOT A LEAK. It carries no award
// identity, and `public.leaderboard` (Story 5.5) already publishes the same magnitudes to anon.
// Knowing everyone's `knife_kills` does not tell you that an award uses it, nor its direction, floors
// or priority. ⛔ Do not gate it: B3 depends on `players` being present for a revealed spin's
// Stage-2 outcome to be checkable at all.
//
// ⛔⛔ EVERY MAGNITUDE CROSSES AS A DECIMAL STRING, `achievement_ts` INCLUDED. `README:367-371` makes
// the split by PROVENANCE, not by size: a snapshot value is a string even when it is 3. The reason is
// not aesthetic — `6-5b:587` measured `Number`-parsing a magnitude reading both sides of a comparison
// as 2^53, tying, and bottoming the FR-29 ladder out at rung 5.
func buildPlayers(ctx context.Context, pool *pgxpool.Pool, snapshotID int64) ([]any, error) {
	rows, err := pool.Query(ctx, `
		select r.steamid64, r.stats_int, coalesce(r.h2h, '{}'::jsonb),
		       r.achievement_ts, r.rounds_played, r.kills, r.idle_dq
		  from public.stat_snapshot_row r
		 where r.snapshot_id = $1`, snapshotID)
	if err != nil {
		return nil, fmt.Errorf("reading snapshot %d: %w", snapshotID, err)
	}
	defer rows.Close()

	var out []any
	for rows.Next() {
		var (
			sid              string
			statsRaw, h2hRaw []byte
			achievementTS    *int64
			roundsPlayed     *int
			killsCol         *int
			idleDQ           *bool
		)
		if err := rows.Scan(&sid, &statsRaw, &h2hRaw, &achievementTS, &roundsPlayed, &killsCol, &idleDQ); err != nil {
			return nil, fmt.Errorf("scanning a snapshot row: %w", err)
		}

		// ⛔ `stats_int` IS DECODED WITH `UseNumber()` AND RE-EMITTED AS TEXT, never through float64.
		// `encoding/json`'s default number type silently rounds past 2^53, which is the exact defect
		// `.Float64()` and `.Int64()` are banned in the producer for.
		stats, err := decodeJSONNumbers(statsRaw)
		if err != nil {
			return nil, fmt.Errorf("snapshot row %s: decoding stats_int: %w", sid, err)
		}
		h2h, err := decodeJSONNumbers(h2hRaw)
		if err != nil {
			return nil, fmt.Errorf("snapshot row %s: decoding h2h: %w", sid, err)
		}

		entry := map[string]any{
			"steamid64": sid,
			// ⚠ THE ELIGIBILITY INPUTS, published because FR-21's floors are what the twelve
			// `no_eligible_players` outcomes of this ceremony turn on. A verifier that could not read
			// `rounds_played`/`kills` could not check WHY an award had no winner — it could only be
			// told. ⚠ The measured corpus clears NEITHER floor for ANY of the 28 players (24 rounds /
			// 20 kills against 10-21 and 1-12), so these are the numbers that make twelve
			// nobody-qualified cards checkable rather than assertable.
			// ⛔⛔ 6.9a CODE REVIEW — THESE THREE ARE `putIfPresent`, NOT COALESCED, AND THE PREVIOUS
			// FORM WAS A REAL FABRICATION INSIDE THE HASHED BYTES. All three columns are nullable
			// (`0003:49-51`), and the old code was `intPtrToNumber(roundsPlayed)` returning
			// `json.Number("0")` on nil, plus `idleDQ != nil && *idleDQ` collapsing NULL to `false`.
			// A NULL `rounds_played` was therefore published, hashed and COMMITTED as the decimal
			// string "0" — a magnitude the database does not hold — on precisely the two fields the
			// comment above says make the twelve `no_eligible_players` cards checkable. A verifier
			// reading "0" concludes the player played zero rounds and correctly failed the 24-round
			// floor; the truth is the count is unrecorded. That is the builder's own header rule
			// violated in the one place it matters most: NULL IN THE DATABASE IS SPELLED *ABSENT*,
			// and `achievement_ts` below is the ONE deliberate exception, for a stated reason these
			// three do not share.
			"volume":     numbersToStrings(stats["volume"]),
			"rate":       numbersToStrings(stats["rate"]),
			"secondary":  numbersToStrings(stats["secondary"]),
			"efficiency": numbersToStrings(stats["efficiency"]),
			"h2h":        numbersToStrings(h2h),
		}

		// The eligibility inputs, absent when the column is NULL — see the block above.
		if roundsPlayed != nil {
			entry["rounds_played"] = strconv.Itoa(*roundsPlayed)
		}
		if killsCol != nil {
			entry["kills"] = strconv.Itoa(*killsCol)
		}
		if idleDQ != nil {
			entry["idle_dq"] = *idleDQ
		}

		// ⭐ THE PUBLISHED ABSENT-SENTINEL IS `-1`, AS A DECIMAL STRING (`6-2:108`, AD-19). A NULL
		// column is spelled as the sentinel rather than as an absent key HERE — the one deliberate
		// exception to the builder's NULL-is-absent rule — because FR-29's rung 4 compares
		// achievement timestamps and `awards.AbsentAchievementTS` is the value the ENGINE compares
		// with. Publishing an absent key would leave a verifier re-deriving rung 4 with nothing to
		// substitute, and it would have to invent the same constant to proceed.
		ts := int64(awards.AbsentAchievementTS)
		if achievementTS != nil {
			ts = *achievementTS
		}
		entry["achievement_ts"] = strconv.FormatInt(ts, 10)

		out = append(out, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("reading snapshot %d: %w", snapshotID, err)
	}
	// ⭐⭐ 6.9a CODE REVIEW — SORTED IN GO, NOT IN SQL, FOR THE REASON THIS FILE ALREADY GIVES 200
	// LINES ABOVE about the winners array: `order by r.steamid64` sorts under the DATABASE'S
	// COLLATION, which is not byte-lex in general, while Go's `<` on strings is byte-lex by
	// definition. JCS never reorders arrays, so this order is load-bearing BYTES of
	// `bundle_sha256` — re-deriving the same ceremony on an ICU- or glibc-collated instance would
	// have produced a different hash for the same facts. The file forbade exactly this and then did
	// it; the determinism test hand-builds its document and runs no query, so it was structurally
	// blind to the divergence.
	sort.Slice(out, func(i, j int) bool {
		return out[i].(map[string]any)["steamid64"].(string) < out[j].(map[string]any)["steamid64"].(string)
	})
	return out, nil
}

// ── small shared helpers ──────────────────────────────────────────────────────

// jsonInt renders a signed integer as a JSON number the canonicalizer accepts.
func jsonInt(v int64) json.Number { return json.Number(strconv.FormatInt(v, 10)) }

// jsonUint renders an unsigned integer the same way.
//
// ⚠ Values above 2^53-1 are REFUSED by the canonicalizer rather than rounded (DECISION L). Nothing
// this builder emits as a JSON number can reach that: byte counts, draw indices and weights are all
// bounded by the ceremony's size. The magnitudes that genuinely can are decimal STRINGS.
func jsonUint(v uint64) json.Number { return json.Number(strconv.FormatUint(v, 10)) }

func strsToAny(in []string) []any {
	out := make([]any, 0, len(in))
	for _, s := range in {
		out = append(out, s)
	}
	return out
}

func intsToAny(in []int) []any {
	out := make([]any, 0, len(in))
	for _, v := range in {
		out = append(out, jsonInt(int64(v)))
	}
	return out
}

// applyLadderExitStep writes `tie_ladder_exit_step` only when a ladder actually ran (DECISION J).
//
// ⭐⭐ THE SPELLING IS **ABSENT**, NEVER THE `0` SENTINEL. `deferred-work.md:307` recorded the seam
// defect: Go carries `LadderExitStep` as an int whose 0 means "no ladder was walked", TypeScript omits
// the key, and `worker/ceremony`'s `Payload` sends the raw integer INCLUDING the sentinel with the RPC
// applying `nullif(v, 0)`. Three reasons the bundle spells it absent, in order of weight: (1) the
// COLUMN is already NULL after that `nullif` and the bundle is derived FROM THE DATABASE, so absent is
// the faithful projection and `0` would be a value the source does not hold; (2) RFC-8785 hashes `0`
// and *absent* DIFFERENTLY, so a runtime that helpfully filled the sentinel would produce a different
// `bundle_sha256` with nothing looking wrong — that has to be impossible by construction, not by
// review; (3) it matches the TS engine, which is what 6.9b's verifier re-derives, so the comparison is
// `undefined === undefined` rather than a special case.
//
// ⛔ THE TEST IS ON THE POINTER BEING NIL, NOT ON THE VALUE BEING ZERO, and `omitempty` is banned here
// for the same reason: it would do the right thing today for the wrong reason and break silently the
// day the sentinel moves.
//
// ⚠ IT IS A NAMED FUNCTION RATHER THAN THREE INLINE LINES BECAUSE OF THE MUTATION PASS. As inline
// code inside `buildAwards` it was reachable only through five table reads, so the T8 mutant that
// emitted the sentinel unconditionally SURVIVED — the decision had no test that did not need a
// database. Extracting it is what made the mutant killable.
func applyLadderExitStep(entry map[string]any, exitStep *int) {
	if exitStep == nil {
		return
	}
	entry["tie_ladder_exit_step"] = jsonInt(int64(*exitStep))
}

// putIfPresent writes a key only when the database holds a value — the NULL-is-absent rule.
func putIfPresent(m map[string]any, key string, v *string) {
	if v != nil {
		m[key] = *v
	}
}

func intPtrToNumber(v *int) any {
	if v == nil {
		return json.Number("0")
	}
	return json.Number(strconv.Itoa(*v))
}

// sameStrings reports whether two string slices are equal element-wise.
//
// ⚠ ORDER-SENSITIVE ON PURPOSE: the DRAW order IS the reveal order (`0025:127-129`), so two lists
// holding the same ids in different orders describe two different ceremonies.
func sameStrings(a, b []string) bool {
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

// decodeJSONNumbers decodes JSON into decoder-shaped values with every number kept as `json.Number`.
func decodeJSONNumbers(raw []byte) (map[string]any, error) {
	dec := json.NewDecoder(strings.NewReader(string(raw)))
	dec.UseNumber()
	var v map[string]any
	if err := dec.Decode(&v); err != nil {
		return nil, err
	}
	return v, nil
}

// numbersToStrings rewrites every JSON number in a decoded tree as its exact decimal STRING, leaving
// structure, strings and booleans untouched.
//
// ⭐ THIS IS B5 MADE MECHANICAL. Every value under `players` comes from the frozen snapshot, so every
// number under it is a magnitude and every magnitude is a string by provenance. Doing it by walk
// rather than field by field means a snapshot block added later (AD-19 has four today) is converted
// by construction instead of being forgotten — and a forgotten one would be a JSON number the
// canonicalizer refuses the moment it exceeds 2^53, which is the fail-closed direction.
func numbersToStrings(v any) any {
	switch t := v.(type) {
	case nil:
		// An absent AD-19 block is an EMPTY OBJECT, not null: `stage2.ts:143` states "absent container
		// === empty container", and a `null` would be a third spelling of absence in a document whose
		// whole job is to hash the same way in three runtimes.
		return map[string]any{}
	case json.Number:
		return t.String()
	case map[string]any:
		out := make(map[string]any, len(t))
		for k, item := range t {
			out[k] = numbersToStrings(item)
		}
		return out
	case []any:
		out := make([]any, 0, len(t))
		for _, item := range t {
			out = append(out, numbersToStrings(item))
		}
		return out
	default:
		return v
	}
}

// BuildCanonicalBundle is the whole producer side in one call: build the document, canonicalize it
// under the bundle's ASCII restriction, and hash it.
//
// The three values it returns are exactly `publish_bundle`'s three arguments after the ceremony id,
// which is the point: there is no step between here and the RPC where the bytes and the hash could
// drift apart — and the RPC re-derives the hash anyway and refuses `bundle_mismatch` if they have.
func BuildCanonicalBundle(
	ctx context.Context,
	pool *pgxpool.Pool,
	ceremonyID int64,
	run awards.CeremonyRun,
) (doc map[string]any, canonical string, sha256Hex string, err error) {
	doc, err = BuildBundle(ctx, pool, ceremonyID, run)
	if err != nil {
		return nil, "", "", err
	}
	// ⛔ `asciiOnly` IS TRUE AND IS NOT A PARAMETER. SOLUTION-DESIGN §9.5 makes the bundle
	// ASCII-restricted, and a builder that could be asked for a non-ASCII document would be a builder
	// somebody eventually asks. The refusal is typed (`CanonNonASCII`), which is what gives teeth to
	// `deferred-work.md:265-266` — `award.name` accepts zero-width U+200B/200E/FEFF and has no length
	// bound, and became viewer-visible at 6.8b.
	canonical, err = Canonicalize(doc, true)
	if err != nil {
		return nil, "", "", err
	}
	return doc, canonical, CanonicalSHA256Hex(canonical), nil
}
