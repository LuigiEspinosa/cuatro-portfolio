import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  CANONICAL_MAX_DEPTH,
  CANONICAL_REFUSALS,
  CanonicalError,
  canonicalSha256Hex,
  canonicalize,
} from './canonical';

// NOTE: `node:fs` is imported HERE, in the test. The banned-`node:` rule applies to the shipped
// modules (scanned in prng.test.ts), not to the suite that reads the vector files off disk.
//
// ⚠ THIS FILE MUST LIVE UNDER `lib/**` — `vitest.config.ts:17` restricts collection to that tree,
// so a suite placed anywhere else SILENTLY DOES NOT RUN.

// ── the shared contract ────────────────────────────────────────────────────────
//
// These tests read `roulette/vectors/canonical-bundle.json` AT RUNTIME. ⛔ No expected canonical
// form, no SHA-256 and no refusal reason is transcribed into a TypeScript literal: a hard-coded
// copy greens on the day the vector is regenerated and silently stops testing the contract
// (README:83-89). The generator is a THIRD implementation written from RFC 8785; when it and this
// module disagree, the vector decides.
//
// ⭐ WHAT MAKES THIS GATE DIFFERENT FROM EVERY OTHER ONE IN THIS DIRECTORY. Gates 1-3 and the
// three pure-pass vectors all gate a DRAW: their failure mode is "a byte came out wrong". This
// one gates the SERIALIZATION the commitment is taken over, so its failure mode is "the hash
// binds a different document" — the ceremony can be perfectly produced and perfectly persisted
// and still fail to verify, which is exactly the class of defect AC5 calls a VERIFIER-ONLY
// divergence.

const VECTOR_PATH = path.join(process.cwd(), 'roulette', 'vectors', 'canonical-bundle.json');

interface VectorCase {
  name: string;
  why: string;
  ascii_only: boolean;
  input_json: string;
  canonical: string;
  canonical_utf8_bytes: number;
  sha256: string;
}

interface VectorRefusal {
  name: string;
  why: string;
  ascii_only: boolean;
  input_json: string;
  reason: string;
}

interface VectorUnreachable {
  reason: string;
  why: string;
}

interface Vector {
  vector: string;
  algo_version: string;
  spec: string;
  refusal_reasons: string[];
  unreachable_refusal_reasons: VectorUnreachable[];
  max_safe_integer: string;
  cases: VectorCase[];
  refusals: VectorRefusal[];
  end_to_end: VectorCase[];
}

const vector = JSON.parse(readFileSync(VECTOR_PATH, 'utf8')) as Vector;

describe('canonical-bundle vector: identity', () => {
  it('is the file this suite thinks it is', () => {
    expect(vector.vector).toBe('canonical-bundle');
    expect(vector.algo_version).toBe('inclusivcup-roulette-1.0.0');
  });

  it('carries cases and refusals, so the loops below are not vacuous', () => {
    // ⚠ `it.each([])` reports ZERO tests and a green run. Every suite in this directory pays for
    // that guard because an empty vector array is indistinguishable from a passing one.
    expect(vector.cases.length).toBeGreaterThan(0);
    expect(vector.refusals.length).toBeGreaterThan(0);
  });
});

describe('canonical-bundle vector: canonicalization', () => {
  it.each(vector.cases.map((c) => [c.name, c] as const))(
    'canonicalizes %s to the exact bytes the vector pins',
    async (_name, c) => {
      const value: unknown = JSON.parse(c.input_json);
      const got = canonicalize(value, { asciiOnly: c.ascii_only });

      // Compared as a STRING first so a mismatch prints both forms, then as a BYTE COUNT — the
      // two catch different things. A UTF-8 length divergence with identical text would mean the
      // runtimes disagree about an encoding, which is invisible in a string comparison.
      expect(got).toBe(c.canonical);
      expect(new TextEncoder().encode(got).length).toBe(c.canonical_utf8_bytes);

      // And the hash, because `bundle_sha256` is the only value that leaves this module.
      expect(await canonicalSha256Hex(got)).toBe(c.sha256);
    },
  );

  it('is idempotent: canonicalizing a canonical document reproduces it', () => {
    // A canonical document re-parsed and re-canonicalized must be a fixed point. This catches an
    // asymmetry between the escaper and the parser that a one-way comparison cannot see.
    for (const c of vector.cases) {
      const once = canonicalize(JSON.parse(c.input_json), { asciiOnly: c.ascii_only });
      const twice = canonicalize(JSON.parse(once), { asciiOnly: c.ascii_only });
      expect(twice).toBe(once);
    }
  });

  it('emits no insignificant whitespace anywhere outside string bodies', () => {
    // §3.2.1. Proven structurally rather than by eyeballing the pinned forms: strings are blanked,
    // then any remaining space, tab, CR or LF is a violation.
    for (const c of vector.cases) {
      const outside = c.canonical.replace(/"(?:[^"\\]|\\.)*"/g, '""');
      expect(/[ \t\r\n]/.test(outside), `${c.name} carries insignificant whitespace`).toBe(false);
    }
  });
});

describe('canonical-bundle vector: refusals', () => {
  it.each(vector.refusals.map((r) => [r.name, r] as const))(
    'refuses %s with the reason the vector pins',
    (_name, r) => {
      const value: unknown = JSON.parse(r.input_json);
      // ⛔ Asserted on the REASON, never merely on "it threw". A canonicalizer that refused
      // everything for one reason would pass a `toThrow()` assertion on every row here.
      let caught: unknown;
      try {
        canonicalize(value, { asciiOnly: r.ascii_only });
      } catch (e) {
        caught = e;
      }
      expect(caught, `${r.name} did not refuse`).toBeInstanceOf(CanonicalError);
      expect((caught as CanonicalError).reason).toBe(r.reason);
    },
  );

  it('the reasons the vector exercises are exactly the reachable half of the closed set', () => {
    // ⭐ THE CLOSED SET READS ITS EVIDENCE, which is this project's signature defect at its
    // eighth occurrence if it does not. The declared set comes from the VECTOR; the reachable
    // half is derived from the refusal rows and the unreachable half from the marker list, and
    // the two are asserted to PARTITION the declared set — so a reason that is neither exercised
    // nor declared unreachable fails here instead of sitting untested.
    const declared = [...vector.refusal_reasons].sort();
    const exercised = [...new Set(vector.refusals.map((r) => r.reason))].sort();
    const unreachable = [...new Set(vector.unreachable_refusal_reasons.map((u) => u.reason))].sort();

    expect(declared.length).toBeGreaterThan(0);
    expect(exercised.length).toBeGreaterThan(0);
    expect(unreachable.length).toBeGreaterThan(0);

    // Partition: disjoint, and together the whole declared set.
    expect(exercised.filter((r) => unreachable.includes(r))).toEqual([]);
    expect([...exercised, ...unreachable].sort()).toEqual(declared);
  });

  it('a non-plain object REFUSES instead of silently canonicalizing to {}', () => {
    // ⛔ THE 6.9a CODE REVIEW'S FIX, PINNED. `typeof` reports 'object' for Date, Map, Set, RegExp,
    // boxed primitives and every class instance, and `Object.keys()` returns [] for all of them —
    // so `canonicalize({ ts: new Date() })` used to return `{"ts":{}}` and HASH IT, and a Map lost
    // every entry. Go's type switch and Python's emit both bottom out in `unsupported_type`; only
    // TypeScript invented an empty object, and it is reachable from the native-value entry point
    // 6.9b's browser verifier uses.
    for (const [label, value] of [
      ['Date', new Date(0)],
      ['Map', new Map([['a', 1]])],
      ['Set', new Set([1])],
      ['RegExp', /x/],
      ['class instance', new (class Foo { readonly a = 1 })()],
    ] as const) {
      expect(
        () => canonicalize({ v: value }),
        `${label} must refuse, not canonicalize to {}`,
      ).toThrowError(expect.objectContaining({ reason: 'unsupported_type' }));
    }

    // ⚠ THE FALSE SIDE: plain objects and null-prototype objects must still canonicalize, or the
    // guard is an unconditional refusal wearing a check's clothes.
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    const bare = Object.create(null) as Record<string, unknown>;
    bare.k = 'v';
    expect(canonicalize(bare)).toBe('{"k":"v"}');
  });

  it('nesting past the shared depth bound is a TYPED refusal, not a RangeError', () => {
    let deep: unknown = 'leaf';
    for (let i = 0; i < CANONICAL_MAX_DEPTH + 10; i += 1) deep = [deep];
    expect(() => canonicalize(deep)).toThrowError(
      expect.objectContaining({ reason: 'max_depth_exceeded' }),
    );

    let shallow: unknown = 'leaf';
    for (let i = 0; i < 50; i += 1) shallow = [shallow];
    expect(() => canonicalize(shallow)).not.toThrow();
  });

  it('every reason the vector declares is a reason this module can actually name', () => {
    // ⛔⛔ REWRITTEN BY THE 6.9a CODE REVIEW. THE PREVIOUS FORM WAS VACUOUS, and it is worth
    // spelling out because it read as rigorous:
    //
    //     const err = new CanonicalError(reason as CanonicalError['reason'], 'probe');
    //     expect(err.reason).toBe(reason);
    //
    // The constructor merely ASSIGNS the field, and `CanonicalRefusal` is a compile-time union
    // that erases at runtime, so the cast let any string through. It passed for a reason deleted
    // from the union, for a typo, for `"banana"` — it proved that assignment works, not that this
    // module names these reasons. The test's own comment identified the erasure and then drew the
    // wrong conclusion from it, which is this project's signature defect at its eighth occurrence:
    // a closed-set assertion measuring a literal instead of reading its evidence.
    //
    // The fix is the one the Go mirror already had — compare against a REAL RUNTIME VALUE.
    // `CANONICAL_REFUSALS` is exported from the module under test, so deleting a member, renaming
    // one or letting the vector drift now reddens here.
    expect([...CANONICAL_REFUSALS]).toEqual(vector.refusal_reasons);

    // And the values are still genuinely constructible, which is the half the old test did prove.
    for (const reason of CANONICAL_REFUSALS) {
      const err = new CanonicalError(reason, 'probe');
      expect(err.reason).toBe(reason);
      expect(err.name).toBe('CanonicalError');
      expect(err).toBeInstanceOf(Error);
    }
  });

  it('the three unreachable reasons are reachable from a NATIVE value, which is why they exist', () => {
    // ⭐ The `unreachable_*` marker says "not reachable FROM JSON" — not "dead". Left unproven,
    // a later reader deletes the three arms as unused and the browser's `canonicalize(nativeObj)`
    // path loses its guards. Each is driven here from the native value JSON cannot express.
    const reasons = new Set(vector.unreachable_refusal_reasons.map((u) => u.reason));

    if (reasons.has('non_finite_number')) {
      expect(() => canonicalize({ n: Number.NaN })).toThrowError(
        expect.objectContaining({ reason: 'non_finite_number' }),
      );
      expect(() => canonicalize({ n: Number.POSITIVE_INFINITY })).toThrowError(
        expect.objectContaining({ reason: 'non_finite_number' }),
      );
    }
    if (reasons.has('unsupported_type')) {
      expect(() => canonicalize({ n: undefined })).toThrowError(
        expect.objectContaining({ reason: 'unsupported_type' }),
      );
      // ⚠ `bigint` is refused ON PURPOSE: every magnitude crosses the JSON boundary as a decimal
      // STRING by provenance, so a bigint here means somebody serialized a magnitude as a number.
      expect(() => canonicalize({ n: 1n })).toThrowError(
        expect.objectContaining({ reason: 'unsupported_type' }),
      );
    }
    if (reasons.has('cycle')) {
      const cyc: Record<string, unknown> = { a: 1 };
      cyc.self = cyc;
      expect(() => canonicalize(cyc)).toThrowError(expect.objectContaining({ reason: 'cycle' }));
    }
  });

  it('a repeated SIBLING is legal — only an ancestor cycle refuses', () => {
    // Guards the cycle guard against being written with a plain `Set` that never releases: the
    // bundle really does carry the same array reference twice after a map/filter chain, and
    // refusing that would make a legal document unpublishable.
    const shared = { k: 1 };
    expect(canonicalize({ x: shared, y: shared })).toBe('{"x":{"k":1},"y":{"k":1}}');
    const arr = [1, 2];
    expect(canonicalize({ a: arr, b: arr })).toBe('{"a":[1,2],"b":[1,2]}');
  });
});

describe('canonical-bundle vector: the safe-integer boundary is pinned from both sides', () => {
  it('accepts 2^53-1 and refuses 2^53, using the bound the vector carries', () => {
    // ⭐ Read from the vector as a STRING and compared through `Number`, because the bound is a
    // shared contract with two runtimes that spell it differently (`lib/roulette` cannot write
    // `2 ** 53 - 1` at all — `**` is a banned construct there).
    const max = Number(vector.max_safe_integer);
    expect(Number.isSafeInteger(max)).toBe(true);
    expect(canonicalize({ n: max })).toBe(`{"n":${vector.max_safe_integer}}`);
    expect(() => canonicalize({ n: max + 1 })).toThrowError(
      expect.objectContaining({ reason: 'unsafe_integer' }),
    );
  });
});

describe('canonical-bundle vector: the end-to-end row', () => {
  // ⛔ AC2 requires "an end-to-end `bundle_sha256` over the REAL ceremony's bundle carried as
  // data". That document only exists after Task 9 rebuilds the 14-demo corpus, runs the ceremony,
  // persists it and publishes — so the row is OWED, and its absence is asserted here rather than
  // left as a silent gap somebody has to notice.
  //
  // ⚠ THIS TEST IS DESIGNED TO REDDEN THE MOMENT TASK 9 FILLS THE ROW. That is the same
  // deliberate-update pattern `prng.test.ts` uses for the shipped-module list: when it goes red,
  // the fix is to change the expected count HERE, on purpose, having read the new row — never to
  // delete the assertion.
  // ⭐⭐ THE ROW LANDED. Task 9 (THE BAR) rebuilt the 14-demo corpus, ran and persisted the ceremony,
  // published the bundle, and carried the committed canonical bytes into the vector. This assertion
  // reddened exactly as designed and is updated HERE, on purpose, having read the new row — never
  // deleted. It stays as a COUNT so a second row cannot arrive unnoticed either.
  it('carries exactly the ONE end-to-end row Task 9 filled', () => {
    expect(vector.end_to_end.length).toBe(1);
    // The real ceremony's shape, pinned so a re-run against a different corpus cannot pass quietly:
    // 75,013 canonical bytes over 28 players, 12 awards and 40 spins.
    const row = vector.end_to_end[0];
    expect(row.name).toBe('real-ceremony-bundle');
    expect(row.ascii_only).toBe(true);
    expect(row.canonical_utf8_bytes).toBe(75013);
  });

  it.each(vector.end_to_end.map((c) => [c.name, c] as const))(
    'reproduces the real ceremony bundle %s',
    async (_name, c) => {
      const value: unknown = JSON.parse(c.input_json);
      const got = canonicalize(value, { asciiOnly: c.ascii_only });
      expect(got).toBe(c.canonical);
      expect(new TextEncoder().encode(got).length).toBe(c.canonical_utf8_bytes);
      expect(await canonicalSha256Hex(got)).toBe(c.sha256);
    },
  );
});

describe('RFC 8785 §3.2.3 key ordering — the property, not just the pinned rows', () => {
  // ⭐⭐ B6, asserted rather than commented. The vector pins the RFC's own example; this pins the
  // PROPERTY it demonstrates, so the two cannot drift apart. A canonicalizer that sorted by code
  // point, by UTF-8 bytes or by locale passes every ASCII row in this file and fails only here.
  it('orders a supplementary-plane key BEFORE a U+E000..U+FFFF key', () => {
    // U+1F600 encodes to the surrogate pair D83D DE00, so its FIRST code unit is 0xD83D, which is
    // below 0xFB33 — even though its code point (0x1F600) is far above it. Code-point order and
    // UTF-8 byte order would both put it second; UTF-16 code-unit order puts it first.
    const got = canonicalize({ '\u{1F600}': 1, 'דּ': 2 });
    expect(got.indexOf('\u{1F600}')).toBeLessThan(got.indexOf('דּ'));
  });

  it('orders by code unit and not by length or by locale', () => {
    // 'Z' (0x5A) before 'a' (0x61) is where a locale-aware or case-insensitive comparator breaks.
    expect(Object.keys(JSON.parse(canonicalize({ a: 1, Z: 2, A: 3 })))).toEqual(['A', 'Z', 'a']);
    // A prefix sorts before its extension.
    expect(Object.keys(JSON.parse(canonicalize({ ab: 1, a: 2 })))).toEqual(['a', 'ab']);
  });

  it('sorts at every depth, not only at the root', () => {
    expect(canonicalize({ z: { b: 1, a: 2 } })).toBe('{"z":{"a":2,"b":1}}');
  });

  it('never reorders an ARRAY', () => {
    // The mirror of the rule above, and the one a "sort everything" shortcut breaks: `winners`,
    // `reveal_order` and `draws` are all arrays whose ORDER is the outcome being published.
    expect(canonicalize({ a: [3, 1, 2] })).toBe('{"a":[3,1,2]}');
  });
});
