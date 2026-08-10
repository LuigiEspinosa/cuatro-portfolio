/**
 * RFC-8785 (JSON Canonicalization Scheme) — browser VERIFIER side (Story 6.9a, FR-27 / AD-22 /
 * SOLUTION-DESIGN §9.5-§9.6).
 *
 * THE ONE JOB: turn a JSON value into the exact byte sequence whose SHA-256 is `bundle_sha256`.
 * The commitment binds only if all three runtimes produce the SAME bytes, so this module is
 * written FROM THE RFC TEXT and conforms to `roulette/vectors/canonical-bundle.json` — never to
 * `worker/ceremony/bundle.go` and never to `generate_vectors.py`. When the three disagree, the
 * vector decides; when the vector is silent, add a vector.
 *
 * ⛔ NO `import 'server-only'` — see the note in `labels.ts`. Story 6.9b's "Verificar la ceremonia"
 * button pulls this module into the browser bundle, where `server-only` throws. Pinned by the
 * source scan in `prng.test.ts`.
 *
 * ⛔ NO third-party import, in this module above all others: there is no `json-canonicalize` here
 * and there will not be. RFC-8785 is hand-written in all three runtimes precisely so that no
 * single library can be the de facto reference the way a deleted generator once was (6.3's review).
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ B6 — THE ONE THING A LATER READER WILL "FIX" AND BREAK.
 *
 * This file sorts OBJECT KEYS by **UTF-16 code units**, which is what RFC-8785 §3.2.3 specifies,
 * and which is what a bare JavaScript `.sort()` already does. **THAT IS CORRECT. DO NOT CHANGE IT
 * TO BYTE-LEX.**
 *
 * Forty lines away, in `pity.ts` and `sweep.ts`, the SAME package sorts **steamid64 arrays
 * BYTE-LEX** — a different ordering, also correct, for a different reason (it is the engine's
 * eligibility order and Go/Python must reproduce it over UTF-8 bytes). The two rules are
 * OPPOSITE and they are both right. Whoever "unifies" them breaks exactly one of the two, and
 * the break is invisible: a divergent key order changes `bundle_sha256` and nothing else, while a
 * divergent steamid64 order changes `reveal_order` while `draws` and `bytes_consumed` stay
 * IDENTICAL — so the byte-accounting gate this epic was built on cannot see either one.
 *
 * The mirror of this comment lives at the `.sort()` call sites in `pity.ts` and `sweep.ts`.
 * ────────────────────────────────────────────────────────────────────────────────────────────
 *
 * WHAT THIS IMPLEMENTATION DELIBERATELY RESTRICTS (DECISION L — recorded in the 6.9a story file).
 * RFC-8785 defines number serialization by the full ECMAScript `Number::toString` algorithm,
 * which can emit `1e+30` and `5e-324`. This build **REFUSES** every JSON number that is not a
 * safe integer, because SPEC Constraint 7 makes the whole engine integer-only and the bundle
 * carries every magnitude as a DECIMAL STRING by provenance (B5). A float reaching this function
 * is a producer bug, and a canonicalizer that quietly serialized it would hash a value no
 * verifier can compare. The restriction is a REFUSAL, never a silent coercion, and both
 * `1e+30` and `5e-324` are pinned as refusals in the gate-4 vector so the three runtimes cannot
 * drift into disagreeing about it.
 *
 * Within the safe-integer subset all three runtimes agree BY CONSTRUCTION rather than by
 * convention: IEEE-754 binary64 parses `1.0`, `1` and `1e0` to the same value in JavaScript, Go
 * and Python alike, and the shortest round-trip decimal of a safe integer is its plain digits.
 */

/** Every way {@link canonicalize} can refuse. A closed set — the vector pins it. */
export type CanonicalRefusal =
  | 'non_finite_number'
  | 'non_integer_number'
  | 'unsafe_integer'
  | 'unsupported_type'
  | 'lone_surrogate'
  | 'non_ascii'
  | 'cycle'
  | 'max_depth_exceeded';

/**
 * The closed set as a RUNTIME value.
 *
 * ⛔⛔ ADDED BY THE 6.9a CODE REVIEW, AND THE REASON IS THE DEFECT IT REPLACES. The suite's
 * "every reason the vector declares is a reason this module can name" test used to do this:
 *
 *     const err = new CanonicalError(reason as CanonicalError['reason'], 'probe');
 *     expect(err.reason).toBe(reason);
 *
 * — which passes for ANY string, because `CanonicalRefusal` is a compile-time union that erases
 * at runtime and the constructor merely assigns the field. It would have stayed green with a
 * reason deleted from the union, or invented from thin air. The test named the erasure in its own
 * comment and then drew the wrong conclusion from it. The Go mirror compares a real runtime slice
 * (`CanonRefusalReasons`); this is the TypeScript half of that evidence, so the vector's array
 * can be compared against something the module actually holds.
 *
 * ⚠ Keep the ORDER identical to Go's `CanonRefusalReasons` and to the vector's `refusal_reasons`.
 */
export const CANONICAL_REFUSALS: readonly CanonicalRefusal[] = [
  'non_finite_number',
  'non_integer_number',
  'unsafe_integer',
  'unsupported_type',
  'lone_surrogate',
  'non_ascii',
  'cycle',
  'max_depth_exceeded',
];

/**
 * The nesting bound, shared verbatim with the other two runtimes.
 *
 * ⭐ ADDED BY THE 6.9a CODE REVIEW. Without it a deeply nested document fails as an UNTYPED
 * language-level failure at a different depth in each runtime — `RangeError` here,
 * `RecursionError` in Python, an unrecoverable stack overflow in Go — from a module whose entire
 * contract is that every refusal is typed and drawn from a closed set. In 6.9b that untyped throw
 * reaches the `write_failed` -> 500 escape hatch the route header says must never receive a
 * business-shaped failure. 256 is ~60x the real bundle's depth and far below every runtime's
 * native limit, so the typed refusal always wins the race.
 */
export const CANONICAL_MAX_DEPTH = 256;

/**
 * A typed refusal. `reason` is the machine-readable half; the message is for a human reading a
 * stack trace. ⛔ Never widen this to a bare `Error`: `publish_bundle` mirrors these reasons into
 * its own closed set and the admin route maps them to status codes, so an untyped throw here
 * becomes an opaque 500 three layers up (the shape `6-8b:913` found and this project has now
 * paid for seven times).
 */
export class CanonicalError extends Error {
  readonly reason: CanonicalRefusal;

  constructor(reason: CanonicalRefusal, detail: string) {
    super(`roulette/canonical: ${reason} — ${detail}`);
    this.name = 'CanonicalError';
    this.reason = reason;
  }
}

/**
 * The escape table of RFC-8785 §3.2.2.2, which is ECMAScript's `JSON.stringify` escaping.
 * Everything else below U+0020 becomes `\u00xx` with LOWERCASE hex; everything at or above
 * U+0020 that is not `"` or `\` is emitted literally.
 */
const SHORT_ESCAPE: ReadonlyMap<number, string> = new Map<number, string>([
  [0x08, '\\b'],
  [0x09, '\\t'],
  [0x0a, '\\n'],
  [0x0c, '\\f'],
  [0x0d, '\\r'],
  [0x22, '\\"'],
  [0x5c, '\\\\'],
]);

/** Options for {@link canonicalize}. */
export interface CanonicalOptions {
  /**
   * Refuse any code unit above U+007F (§9.5's ASCII restriction on the bundle).
   *
   * ⛔⛔ CORRECTED BY THE 6.9a CODE REVIEW — READ THIS BEFORE CITING THE RULE AS A FIX. This
   * comment used to claim the restriction "gives teeth to `deferred-work.md:265-266`" (award
   * `name` accepts zero-width U+200B / U+200E / U+FEFF and has no length bound). **It does not,
   * and it cannot.** DECISION N drops `name` from the bundle, and every remaining published field
   * is digits, snake_case identifiers, decimal strings or `inclusivcup/v1/…` labels — so no
   * producer-controlled value can ever be non-ASCII and this refusal is UNREACHABLE in
   * production. It is worth keeping as defence-in-depth against a field added later; it is not
   * the zero-width fix, and `deferred-work.md:265-266` stays OPEN. That guard belongs where award
   * names reach a viewer, as an explicit reject-list plus a length bound.
   *
   * ⚠ It is OFF by default because the ordering torture cases in the gate-4 vector need
   * supplementary-plane keys, which are not ASCII; the BUNDLE builder always turns it ON.
   */
  readonly asciiOnly?: boolean;
}

/**
 * Canonicalize a parsed JSON value into RFC-8785 bytes, returned as a JS string.
 *
 * The caller hashes `new TextEncoder().encode(canonicalize(v))`. This function returns text
 * rather than bytes because the canonical form is also what `publish_bundle` stores in
 * `verification_bundle.payload_canonical` and re-hashes server-side (B9, VALIDATED NOT TRUSTED),
 * and a `text` column is what the database compares.
 */
export function canonicalize(value: unknown, opts?: CanonicalOptions): string {
  const asciiOnly = opts?.asciiOnly === true;
  // Cycle detection over CONTAINERS ONLY. A plain `Set` would also reject the same immutable
  // object appearing twice as a sibling, which is legal JSON and which the bundle actually does
  // (two spins can carry an identical `weights` array reference after a map/filter chain).
  const open = new Set<object>();
  return emit(value, asciiOnly, open, 0);
}

/**
 * Is this a PLAIN object — one `Object.keys` can faithfully enumerate?
 *
 * ⛔⛔ ADDED BY THE 6.9a CODE REVIEW, WHICH FOUND SILENT DATA LOSS HERE. `typeof` reports
 * `'object'` for `Date`, `Map`, `Set`, `RegExp`, boxed primitives and every class instance, and
 * `Object.keys()` returns `[]` for all of them — so `canonicalize({ ts: new Date() })` returned
 * `{"ts":{}}` and HASHED IT, and `canonicalize({ m: new Map([['a',1]]) })` silently dropped every
 * entry. Go's type switch bottoms out in `unsupported_type` and Python's `emit` raises it; only
 * TypeScript invented an empty object. That divergence is reachable from the native-value entry
 * point 6.9b's browser verifier uses, which is the one that matters.
 */
function isPlainObject(v: object): boolean {
  const proto: unknown = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function emit(value: unknown, asciiOnly: boolean, open: Set<object>, depth: number): string {
  if (depth > CANONICAL_MAX_DEPTH) {
    throw new CanonicalError(
      'max_depth_exceeded',
      `nesting exceeds ${String(CANONICAL_MAX_DEPTH)} levels`,
    );
  }

  if (value === null) return 'null';

  const t = typeof value;

  if (t === 'boolean') return value === true ? 'true' : 'false';
  if (t === 'string') return emitString(value as string, asciiOnly);
  if (t === 'number') return emitNumber(value as number);

  if (t === 'object') {
    const obj = value as object;
    if (open.has(obj)) {
      throw new CanonicalError('cycle', 'the value contains a reference cycle');
    }
    const isArray = Array.isArray(obj);
    if (!isArray && !isPlainObject(obj)) {
      throw new CanonicalError(
        'unsupported_type',
        `${obj.constructor.name} is not a JSON value — only plain objects and arrays canonicalize`,
      );
    }
    open.add(obj);
    try {
      if (isArray) return emitArray(obj, asciiOnly, open, depth);
      return emitObject(obj as Record<string, unknown>, asciiOnly, open, depth);
    } finally {
      // Removed on the way OUT, so a sibling repeat of the same object is legal while a true
      // ancestor cycle is not. `finally` so a refusal deep in the tree does not poison the set.
      open.delete(obj);
    }
  }

  // `undefined`, `function`, `symbol`, `bigint`. ⚠ `bigint` is refused ON PURPOSE and is not an
  // oversight: every magnitude in the bundle crosses the JSON boundary as a DECIMAL STRING by
  // provenance (B5), so a bigint arriving here means somebody serialized a magnitude as a number
  // and `Number`-parsing it would read both sides as 2^53, tie, and bottom out `shared` at
  // ladder step 5 — the exact defect `6-5b:587` measured.
  throw new CanonicalError('unsupported_type', `${t} is not a JSON value`);
}

function emitArray(
  arr: readonly unknown[],
  asciiOnly: boolean,
  open: Set<object>,
  depth: number,
): string {
  const parts: string[] = [];
  for (const item of arr) parts.push(emit(item, asciiOnly, open, depth + 1));
  return `[${parts.join(',')}]`;
}

function emitObject(
  obj: Record<string, unknown>,
  asciiOnly: boolean,
  open: Set<object>,
  depth: number,
): string {
  // ⭐ B6 — RFC-8785 §3.2.3: "sort the properties by their key, in ascending order, using the
  // UTF-16 code units". A bare `.sort()` on an array of strings is EXACTLY that comparison, so
  // this line is the RFC and not an approximation of it. ⛔ It must NOT be "fixed" to a byte-lex
  // or code-point comparator; see the block comment at the top of this file, and note that the
  // Go and Python halves have to do REAL WORK to reach this ordering (Go encodes to []uint16,
  // Python to utf-16-be) precisely because their native string order is the other one.
  //
  // ⚠ `Object.keys` returns integer-like keys first, in ascending numeric order, ahead of every
  // string key regardless of insertion order — a JS-only quirk that has nothing to do with JCS.
  // Sorting unconditionally erases it, which is why the sort is not skipped when it "looks
  // already sorted".
  const keys = Object.keys(obj).sort();

  const parts: string[] = [];
  for (const key of keys) {
    const v = obj[key];
    if (v === undefined) {
      // ⛔ NOT silently dropped the way `JSON.stringify` drops it. A key whose value is
      // `undefined` is a producer bug, and dropping it would change `bundle_sha256` invisibly.
      // ⚠ This is also why DECISION J spells "no ladder was walked" as an ABSENT KEY rather than
      // an explicit `undefined`: absent means the key is not in `Object.keys` at all.
      throw new CanonicalError('unsupported_type', `undefined at key ${JSON.stringify(key)}`);
    }
    parts.push(`${emitString(key, asciiOnly)}:${emit(v, asciiOnly, open, depth + 1)}`);
  }
  return `{${parts.join(',')}}`;
}

/**
 * RFC-8785 §3.2.2.2 string serialization, plus §9.5's optional ASCII restriction.
 *
 * ⚠ Non-ASCII characters that survive `asciiOnly === false` are emitted LITERALLY, not
 * `\u`-escaped — that is the RFC's rule, and it is the opposite of what `JSON.stringify(…,
 * ensure_ascii)` style helpers do in other languages. The output is UTF-8 text; the caller
 * encodes it once, at the hash boundary.
 */
function emitString(s: string, asciiOnly: boolean): string {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i] as string;
    const code = s.charCodeAt(i);

    if (asciiOnly && code > 0x7f) {
      throw new CanonicalError(
        'non_ascii',
        `code unit U+${hex4(code)} in ${JSON.stringify(s)} violates the bundle's ASCII restriction`,
      );
    }

    // Surrogate pairing is validated even when the characters are legal, because a lone
    // surrogate has no UTF-8 encoding: every runtime would substitute U+FFFD and the three would
    // hash three different documents while every one of them looked like it had succeeded.
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new CanonicalError('lone_surrogate', `unpaired high surrogate at index ${i}`);
      }
      out += ch;
      out += s[i + 1] as string;
      i += 1;
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      throw new CanonicalError('lone_surrogate', `unpaired low surrogate at index ${i}`);
    }

    const short = SHORT_ESCAPE.get(code);
    if (short !== undefined) {
      out += short;
      continue;
    }
    if (code < 0x20) {
      out += `\\u${hex4(code)}`;
      continue;
    }
    out += ch;
  }
  return `${out}"`;
}

/** Four LOWERCASE hex digits. ⛔ Not `parseInt`'s inverse and not locale-aware — both are banned. */
function hex4(code: number): string {
  return code.toString(16).padStart(4, '0');
}

/**
 * RFC-8785 §3.2.2.3, RESTRICTED to safe integers (DECISION L — see the header).
 *
 * Accepts: any IEEE-754 double that is an integer with magnitude <= 2^53 - 1.
 * Refuses:  NaN and the infinities (`non_finite_number`), any fractional value
 *           (`non_integer_number`), and any integer outside the safe range (`unsafe_integer`).
 *
 * ⚠ `-0` is serialized as `0`, which the RFC requires explicitly. It is normalized rather than
 * refused because it is the one place where the RFC is unambiguous and a refusal would be this
 * implementation inventing a rule. Pinned in the gate-4 vector.
 */
function emitNumber(n: number): string {
  if (!Number.isFinite(n)) {
    throw new CanonicalError('non_finite_number', `${String(n)} has no JSON representation`);
  }
  if (!Number.isInteger(n)) {
    throw new CanonicalError(
      'non_integer_number',
      `${String(n)} is fractional; every magnitude in the bundle is a decimal STRING (B5)`,
    );
  }
  if (!Number.isSafeInteger(n)) {
    throw new CanonicalError(
      'unsafe_integer',
      `${String(n)} exceeds 2^53-1; carry it as a decimal string, never as a JSON number`,
    );
  }
  // `Object.is` rather than `n === 0 && 1 / n < 0`: no division, and it says what it means.
  if (Object.is(n, -0)) return '0';
  // A safe integer's magnitude is below 1e21, so ECMAScript's number-to-string never reaches
  // exponential form here and `String` is exactly the RFC's serialization for this subset.
  return String(n);
}

/**
 * SHA-256 of the canonical bytes, lowercase hex — the value `verification_bundle.bundle_sha256`
 * carries and `SPINE:223` calls `bundle_hash` (B8: one value, two names, fixed once).
 *
 * ⛔ Web Crypto only, never `node:crypto` and never hand-rolled: `prng.test.ts:888-896` exists
 * because a hand-rolled pure-TS SHA-256 satisfies every source ban and still greens every vector.
 * ⚠ ASYNC because `crypto.subtle.digest` is — a React component cannot compute this at render
 * time, which is a constraint on 6.9b's verify strip, not on this module.
 *
 * ⚠ The `crypto.subtle` feature detection that `deferred-work.md:289` owes is NOT here: it is
 * 6.9b's, at the button, where there is Spanish copy to refuse WITH. This function is reached
 * from Node under Vitest and from the Go/SQL side not at all, so it cannot be the place that
 * turns an absent WebCrypto into a user-visible refusal.
 */
export async function canonicalSha256Hex(canonical: string): Promise<string> {
  const bytes: Uint8Array<ArrayBuffer> = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  let out = '';
  for (const b of new Uint8Array(digest)) out += b.toString(16).padStart(2, '0');
  return out;
}
