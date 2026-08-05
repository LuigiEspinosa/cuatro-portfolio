import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { PITY_LABEL, stage1Label } from './labels';
import {
  MAX_READ_BYTES,
  N_BOUNDS,
  SEED_BYTES,
  Stream,
  createStream,
  decodeSeedHex,
  minimalK,
  uniformInt,
} from './prng';
import { blankOut, importSpecifiers } from '../../test/source-scan';

// NOTE: `node:fs` is imported HERE, in the test. The banned-`node:` rule applies to the shipped
// modules (scanned below), not to the suite that reads the vector files off disk.

// ── the shared contract ────────────────────────────────────────────────────────
//
// These tests read `roulette/vectors/*.json` AT RUNTIME. The values are NEVER transcribed into
// TypeScript literals: a hard-coded copy greens on the day the vector is regenerated and
// silently stops testing the contract. `npm test` runs with cwd = the repo root.

const VECTOR_DIR = path.join(process.cwd(), 'roulette', 'vectors');

/**
 * The vector's machine-readable description of how a label is CONSTRUCTED. Without it a
 * conformance suite only ever CONSUMES `label` as an opaque string and the label generator is
 * untested by the vector — the mutation pass found exactly that: bumping the "v1" prefix and
 * making the spin 0-based both passed the vector-driven test cleanly.
 */
type LabelSource = { kind: 'pity' } | { kind: 'stage1'; spin: number };

interface BlockCase {
  name: string;
  seed_hex: string;
  label: string;
  label_source: LabelSource;
  i: number;
  msg_hex: string;
  block_hex: string;
}

interface UniformDraw {
  n: number;
  result: number;
  bytes_consumed_after: number;
}

interface UniformCase {
  name: string;
  seed_hex: string;
  label: string;
  label_source: LabelSource;
  note: string;
  draws: UniformDraw[];
}

function loadVector<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(VECTOR_DIR, file), 'utf8')) as T;
}

const blockVector = loadVector<{
  vector: string;
  algo_version: string;
  invalid_seed_hex: Array<{ why: string; seed_hex: string }>;
  invalid_stage1_spin: Array<{ why: string; spin: number }>;
  cases: BlockCase[];
}>('prng-block.json');
const uniformVector = loadVector<{
  vector: string;
  n_bounds: { min: number; max: number };
  cases: UniformCase[];
}>('prng-uniform-int.json');

/** The real frozen `tournament.fair_seed` (Story 6.2) — the seed the ceremony will actually run on. */
const REAL_SEED_HEX = '1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c';

const toHex = (b: Uint8Array): string =>
  Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

const fromHex = (h: string): Uint8Array =>
  new Uint8Array((h.match(/../g) ?? []).map((p) => Number.parseInt(p, 16)));

// ── gate 1: the block function ─────────────────────────────────────────────────

describe('prng-block.json conformance', () => {
  it('loaded the right file, with cases', () => {
    expect(blockVector.vector).toBe('prng-block');
    expect(blockVector.cases.length).toBeGreaterThan(0);
  });

  // ⭐ The vector is checked for INTERNAL CONSISTENCY first: HMAC the vector's own `msg_hex`
  // with a bare SubtleCrypto call and compare against `block_hex`. This proves the msg/block
  // pair in the file is a real HMAC-SHA256 under this runtime — independently of anything in
  // `prng.ts`. If this passes and the stream check below fails, the fault is provably in how
  // `prng.ts` BUILDS the message (the `utf8(label) || LE64(i)` construction), not in the digest.
  it.each(blockVector.cases.map((c) => [c.name, c] as const))(
    '%s — the vector msg_hex really HMACs to block_hex',
    async (_name, c) => {
      const key = await crypto.subtle.importKey(
        'raw',
        fromHex(c.seed_hex),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      const sig = await crypto.subtle.sign('HMAC', key, fromHex(c.msg_hex));
      expect(toHex(new Uint8Array(sig))).toBe(c.block_hex);
    },
  );

  // …and then the implementation, driven through the real Stream so the block INDEXING is
  // exercised too, not just a bare HMAC call.
  it.each(blockVector.cases.map((c) => [c.name, c] as const))(
    '%s — the stream produces block_i',
    async (_name, c) => {
      const stream = await createStream(decodeSeedHex(c.seed_hex), c.label);
      // Block by block rather than one big read: the i = 255 / i = 256 cases would need 8 KiB in
      // a single call, past MAX_READ_BYTES. Reading 32 at a time still drives the pos -> index
      // mapping, which is the point of going through Stream instead of calling the HMAC directly.
      let block = new Uint8Array(0);
      for (let j = 0; j <= c.i; j++) block = await stream.read(32);
      expect(toHex(block)).toBe(c.block_hex);
      expect(stream.consumed).toBe((c.i + 1) * 32);
    },
  );

  // The message really is utf8(label) || LE64(i) — asserted against the vector, so a big-endian
  // counter or a padded label cannot pass.
  it.each(blockVector.cases.map((c) => [c.name, c] as const))(
    '%s — msg_hex is utf8(label) || LE64(i)',
    (_name, c) => {
      const labelBytes = new TextEncoder().encode(c.label);
      const msg = new Uint8Array(labelBytes.length + 8);
      msg.set(labelBytes, 0);
      new DataView(msg.buffer).setBigUint64(labelBytes.length, BigInt(c.i), true);
      expect(toHex(msg)).toBe(c.msg_hex);
      // The label occupies the front verbatim, and the counter is exactly 8 trailing bytes.
      expect(c.msg_hex.startsWith(toHex(labelBytes))).toBe(true);
      expect(c.msg_hex.length).toBe(toHex(labelBytes).length + 16);
    },
  );
});

describe('the stream is the block concatenation', () => {
  it('reading 64 bytes equals block_0 || block_1', async () => {
    const byLabel = new Map<string, Map<number, BlockCase>>();
    for (const c of blockVector.cases) {
      const key = `${c.seed_hex}|${c.label}`;
      if (!byLabel.has(key)) byLabel.set(key, new Map());
      byLabel.get(key)?.set(c.i, c);
    }

    let checked = 0;
    for (const byIndex of byLabel.values()) {
      const b0 = byIndex.get(0);
      const b1 = byIndex.get(1);
      if (!b0 || !b1) continue;
      const stream = await createStream(decodeSeedHex(b0.seed_hex), b0.label);
      const got = await stream.read(64);
      expect(toHex(got)).toBe(b0.block_hex + b1.block_hex);
      expect(stream.consumed).toBe(64);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

// ── the label GENERATOR is part of the contract, not just the label string ─────
//
// Added after the mutation pass: `label v1 -> v2` and `stage1 spin 1-based -> 0-based` both
// SURVIVED the vector-driven test, because every conformance case read `label` straight out of
// the file and never asked the code to produce it. `label_source` closes that — the expected
// value still comes from the vector, so this stays vector-driven rather than hand-written.

/** Reconstruct a case's label from `label_source` using the module's own generator. */
function buildLabel(src: LabelSource): string {
  return src.kind === 'pity' ? PITY_LABEL : stage1Label(src.spin);
}

describe('label construction conformance', () => {
  const all: Array<readonly [string, string, LabelSource]> = [
    ...blockVector.cases.map((c) => [`block/${c.name}`, c.label, c.label_source] as const),
    ...uniformVector.cases.map((c) => [`uniform/${c.name}`, c.label, c.label_source] as const),
  ];

  it.each(all)('%s — the generator rebuilds the vector label', (_name, want, src) => {
    expect(buildLabel(src)).toBe(want);
  });

  // A vector that lost its label_source fields would make every check above vacuous.
  it('covers both label kinds', () => {
    const kinds = new Set(all.map(([, , src]) => src.kind));
    expect(kinds.has('stage1')).toBe(true);
    expect(kinds.has('pity')).toBe(true);
  });
});

// The seed shapes both runtimes must REFUSE (E4) travel in the vector too, so the two suites
// cannot drift into two different hand-written lists. Added after `seed decode accepts a 31-byte
// key` survived the vector-driven test in both languages.
describe('invalid-seed conformance', () => {
  it('the vector carries the shared refusal list', () => {
    expect(blockVector.invalid_seed_hex.length).toBeGreaterThan(0);
  });

  it.each(blockVector.invalid_seed_hex.map((s) => [s.why, s.seed_hex] as const))(
    'rejects %s',
    (_why, seedHex) => {
      expect(() => decodeSeedHex(seedHex)).toThrow(TypeError);
    },
  );
});

// ── gate 2: uniform_int ────────────────────────────────────────────────────────

describe('prng-uniform-int.json conformance', () => {
  it('loaded the right file, and its n bounds match the module', () => {
    expect(uniformVector.vector).toBe('prng-uniform-int');
    expect(uniformVector.cases.length).toBeGreaterThan(0);
    // If these diverge, the two runtimes disagree about which n is legal.
    expect(uniformVector.n_bounds.min).toBe(N_BOUNDS.MIN);
    expect(uniformVector.n_bounds.max).toBe(N_BOUNDS.MAX);
  });

  it.each(uniformVector.cases.map((c) => [c.name, c] as const))(
    '%s',
    async (_name, c) => {
      const stream = await createStream(decodeSeedHex(c.seed_hex), c.label);
      for (const [index, draw] of c.draws.entries()) {
        const got = await uniformInt(stream, draw.n);
        expect(
          { draw: index + 1, n: draw.n, result: got },
          c.note,
        ).toEqual({ draw: index + 1, n: draw.n, result: draw.result });
        // ⭐ The byte position is what makes AC2 real. A wrong result and a wrong number of
        // consumed bytes are DIFFERENT bugs, and only the second corrupts every later draw.
        expect(stream.consumed).toBe(draw.bytes_consumed_after);
        expect(got).toBeGreaterThanOrEqual(0);
        expect(got).toBeLessThan(draw.n);
      }
    },
  );

  // The vector must actually CONTAIN the cases that carry the story's weight. A suite that
  // passes because the interesting rows quietly disappeared is the failure this guards.
  it('covers a real rejection, an exact-threshold rejection, a block straddle, E1 and k=4', async () => {
    const kAndSpace = (n: number): { k: number; space: bigint } => {
      let k = 0;
      let space = 1n;
      const bn = BigInt(n);
      while (space < bn) {
        space *= 256n;
        k += 1;
      }
      return { k, space };
    };

    let sawRejection = false;
    let sawStraddle = false;
    let sawZeroByte = false;
    let sawK3 = false;
    let sawK4 = false;
    let sawExactThreshold = false;

    for (const c of uniformVector.cases) {
      // A second stream over the same label, read RAW, so the actual x of every k-byte group
      // (including the rejected ones) can be inspected.
      const raw = await createStream(decodeSeedHex(c.seed_hex), c.label);
      let prev = 0;
      for (const [i, d] of c.draws.entries()) {
        // ⛔ Validate the vector's own numbers BEFORE doing arithmetic on them. uniformInt
        // range-checks n, but this test does not call it — a malformed "n": 0 row would throw
        // "Division by zero" out of the test body instead of failing a named assertion, and a
        // non-monotonic bytes_consumed_after would make `delta` negative. Caught by the review.
        expect(
          Number.isInteger(d.n) && d.n >= N_BOUNDS.MIN && d.n <= N_BOUNDS.MAX,
          `${c.name} draw ${i + 1}: vector carries out-of-range n = ${d.n}`,
        ).toBe(true);
        expect(
          d.bytes_consumed_after >= prev,
          `${c.name} draw ${i + 1}: bytes_consumed_after went backwards`,
        ).toBe(true);

        const { k, space } = kAndSpace(d.n);
        const limit = space - (space % BigInt(d.n));
        const delta = d.bytes_consumed_after - prev;

        if (delta > k) sawRejection = true; // burning more than k bytes can only be a rejection
        if (delta === 0 && d.n === 1) sawZeroByte = true; // E1
        if (k === 3) sawK3 = true; // the three-byte width — reached by no case before the review
        if (k === 4) sawK4 = true; // the n = 2^32 bound

        const buf = await raw.read(delta);
        // Walk the individual k-byte READS inside this draw (a rejection makes more than one).
        let pos = prev;
        for (let off = 0; k > 0 && off + k <= buf.length; off += k) {
          // ⭐ A per-READ straddle: this k-byte read begins at pos and ends at pos+k-1. The old
          // version compared the whole DRAW's span, which a rejection sequence at bytes 30/31/32
          // satisfies with three one-byte reads and no straddle at all — so the guard could pass
          // with the straddle case deleted from the vector. Caught by the review.
          if (Math.floor(pos / 32) !== Math.floor((pos + k - 1) / 32)) sawStraddle = true;
          let x = 0n;
          for (let j = off; j < off + k; j++) x = x * 256n + BigInt(buf[j] as number);
          if (x === limit) sawExactThreshold = true;
          pos += k;
        }
        prev = d.bytes_consumed_after;
      }
    }

    // ⭐ Without a draw whose x is EXACTLY limit, `x >= limit` and `x > limit` are
    // indistinguishable — the mutation pass found that off-by-one surviving the whole suite in
    // both languages. This assertion is what keeps the case in the file.
    expect({ sawRejection, sawExactThreshold, sawStraddle, sawZeroByte, sawK3, sawK4 }).toEqual({
      sawRejection: true,
      sawExactThreshold: true,
      sawStraddle: true,
      sawZeroByte: true,
      sawK3: true,
      sawK4: true,
    });
  });
});

// ── E1 / E2 / E3 / E4 as direct assertions ─────────────────────────────────────

describe('E1 — n = 1 consumes ZERO bytes (DECISION A)', () => {
  it('returns 0 without touching the stream', async () => {
    const seed = decodeSeedHex(REAL_SEED_HEX);
    const stream = await createStream(seed, PITY_LABEL);
    for (let i = 0; i < 5; i++) {
      expect(await uniformInt(stream, 1)).toBe(0);
      expect(stream.consumed).toBe(0);
    }
    // …and the stream is genuinely untouched: the next real draw starts at byte 0.
    const fresh = await createStream(seed, PITY_LABEL);
    expect(await uniformInt(stream, 200)).toBe(await uniformInt(fresh, 200));
  });
});

describe('E2 — n is bounded to [1, 2^32]', () => {
  it.each([0, -1, 2 ** 32 + 1, 2 ** 40, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects n = %p as a programmer error',
    async (n) => {
      const stream = await createStream(decodeSeedHex(REAL_SEED_HEX), PITY_LABEL);
      await expect(uniformInt(stream, n)).rejects.toThrow(RangeError);
      // …and it did not consume anything on the way to refusing.
      expect(stream.consumed).toBe(0);
    },
  );

  // ⭐ The assertion above is not SENSITIVE enough on its own. A reviewer-independent mutation in
  // the 6.3 review deleted `Number.isInteger(n)` from the guard and the whole 146-test suite
  // still passed — because `BigInt(1.5)` throws a RangeError too, so the test could not tell the
  // module's own refusal from BigInt's incidental one. Assert the message, which only the guard
  // produces, and assert it refuses BEFORE touching the stream.
  it.each([1.5, Number.NaN, 2.000000001])('refuses non-integer n = %p from its own guard', async (n) => {
    const stream = await createStream(decodeSeedHex(REAL_SEED_HEX), PITY_LABEL);
    await expect(uniformInt(stream, n)).rejects.toThrow(/uniformInt n must be an integer in/);
    expect(stream.consumed).toBe(0);
  });

  it('accepts the inclusive upper bound and reads exactly 4 bytes', async () => {
    const stream = await createStream(decodeSeedHex(REAL_SEED_HEX), PITY_LABEL);
    const got = await uniformInt(stream, N_BOUNDS.MAX);
    expect(Number.isSafeInteger(got)).toBe(true);
    expect(got).toBeLessThan(N_BOUNDS.MAX);
    expect(stream.consumed).toBe(4); // k = 4, and limit = 2^32 so it can never reject
  });

  it('deep-freezes N_BOUNDS (Object.freeze is shallow — 6.1 shipped a "frozen" mutable catalog)', () => {
    expect(Object.isFrozen(N_BOUNDS)).toBe(true);
    for (const value of Object.values(N_BOUNDS)) {
      // Every leaf is a primitive, so there is nothing left to freeze — assert that, rather
      // than assuming it.
      expect(typeof value).toBe('number');
    }
    const before = { ...N_BOUNDS };
    try {
      (N_BOUNDS as { MIN: number }).MIN = 999;
    } catch {
      /* strict mode throws; non-strict silently ignores — both are fine, the value must not change */
    }
    expect({ ...N_BOUNDS }).toEqual(before);
  });
});

describe('E3 — reads straddle block boundaries', () => {
  it('a 2-byte read beginning at byte 31 spans block_0 and block_1', async () => {
    const seed = decodeSeedHex(REAL_SEED_HEX);
    const all = await (await createStream(seed, PITY_LABEL)).read(96);

    const straddler = await createStream(seed, PITY_LABEL);
    await straddler.read(31);
    const pair = await straddler.read(2);
    expect(Array.from(pair)).toEqual([all[31], all[32]]);
    expect(straddler.consumed).toBe(33);
  });

  it('byte-at-a-time equals one bulk read (the block cache changes nothing)', async () => {
    const seed = decodeSeedHex(REAL_SEED_HEX);
    const bulk = await (await createStream(seed, stage1Label(1))).read(96);
    const oneByOne = await createStream(seed, stage1Label(1));
    const collected: number[] = [];
    for (let i = 0; i < 96; i++) {
      const b = await oneByOne.read(1);
      collected.push(b[0] as number);
    }
    expect(collected).toEqual(Array.from(bulk));
  });

  it('read(0) consumes nothing', async () => {
    const stream = await createStream(decodeSeedHex(REAL_SEED_HEX), PITY_LABEL);
    expect((await stream.read(0)).length).toBe(0);
    expect(stream.consumed).toBe(0);
  });

  it.each([-1, 1.5, Number.NaN])('rejects read(%p)', async (k) => {
    const stream = await createStream(decodeSeedHex(REAL_SEED_HEX), PITY_LABEL);
    await expect(stream.read(k)).rejects.toThrow(RangeError);
  });
});

describe('E4 — the seed key is exactly 32 bytes of lowercase hex', () => {
  it('decodes the real frozen seed', () => {
    const seed = decodeSeedHex(REAL_SEED_HEX);
    expect(seed).toBeInstanceOf(Uint8Array);
    expect(seed.length).toBe(SEED_BYTES);
    expect(toHex(seed)).toBe(REAL_SEED_HEX);
  });

  it.each([
    ['uppercase', REAL_SEED_HEX.toUpperCase()],
    ['mixed case', `1B3${REAL_SEED_HEX.slice(3)}`],
    ['0x prefix', `0x${REAL_SEED_HEX.slice(2)}`],
    ['31 bytes', REAL_SEED_HEX.slice(0, 62)],
    ['33 bytes', `${REAL_SEED_HEX}ab`],
    ['leading space', ` ${REAL_SEED_HEX.slice(1)}`],
    ['trailing newline', `${REAL_SEED_HEX}\n`],
    ['non-hex char', `${REAL_SEED_HEX.slice(0, 63)}g`],
    ['empty', ''],
  ])('rejects %s', (_why, bad) => {
    expect(() => decodeSeedHex(bad)).toThrow(TypeError);
  });

  it('createStream rejects a key of the wrong length', async () => {
    await expect(createStream(new Uint8Array(31), PITY_LABEL)).rejects.toThrow(TypeError);
    await expect(createStream(new Uint8Array(33), PITY_LABEL)).rejects.toThrow(TypeError);
  });

  // The key is the RAW 32 bytes, never the hex TEXT. Both produce a valid-looking stream; only
  // one is the spec.
  it('keying with the hex text produces a different stream', async () => {
    const raw = await (await createStream(decodeSeedHex(REAL_SEED_HEX), PITY_LABEL)).read(32);
    const asText = new TextEncoder().encode(REAL_SEED_HEX).slice(0, 32);
    const textKeyed = await (await createStream(asText, PITY_LABEL)).read(32);
    expect(toHex(raw)).not.toBe(toHex(textKeyed));
  });
});

describe('stream independence and range', () => {
  it('every ceremony label yields a distinct block_0', async () => {
    const seed = decodeSeedHex(REAL_SEED_HEX);
    const seen = new Map<string, string>();
    for (let spin = 1; spin <= 12; spin++) {
      const label = stage1Label(spin);
      const hex = toHex(await (await createStream(seed, label)).read(32));
      expect(seen.has(hex)).toBe(false);
      seen.set(hex, label);
    }
    const pity = toHex(await (await createStream(seed, PITY_LABEL)).read(32));
    expect(seen.has(pity)).toBe(false);
  });

  it('draws stay in range, cover every residue, and really do reject', async () => {
    const stream = await createStream(decodeSeedHex(REAL_SEED_HEX), PITY_LABEL);
    const counts = new Map<number, number>();
    const N = 12;
    const DRAWS = 600;
    for (let i = 0; i < DRAWS; i++) {
      const v = await uniformInt(stream, N);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(N);
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    expect(counts.size).toBe(N);
    // limit = 252 for n = 12, so 4/256 of bytes reject: over 600 draws, more than 600 bytes
    // must have been consumed.
    expect(stream.consumed).toBeGreaterThan(DRAWS);
  });
});

// ── minimalK directly, mirroring Go's TestMinimalK ─────────────────────────────

describe('minimalK', () => {
  // Until the 6.3 code review this function was module-private and the coverage test above
  // asserted against its own inline `kAndSpace` duplicate — so a bug HERE could not fail it.
  // Go has had a direct table test over every k boundary all along.
  it.each([
    [1n, 0, 1n], // E1 — reads NOTHING
    [2n, 1, 256n],
    [200n, 1, 256n],
    [255n, 1, 256n],
    [256n, 1, 256n], // exactly 256^1
    [257n, 2, 65536n], // the k boundary
    [65536n, 2, 65536n],
    [65537n, 3, 16777216n],
    [16777216n, 3, 16777216n],
    [16777217n, 4, 4294967296n],
    [4294967296n, 4, 4294967296n], // the E2 ceiling
  ])('minimalK(%s) = k %i, space %s', (n, k, space) => {
    expect(minimalK(n)).toEqual({ k, space });
  });
});

// ── the reentrancy guard (6.3 review DECISION: throw, never queue) ─────────────

describe('Stream is not reentrant', () => {
  // The measured failure: two concurrent read(4) after read(30) returned de11f26e / 7b537ef2
  // where the true bytes 30-37 are de7b92537ef2f26e — and `consumed` was IDENTICAL (38) in the
  // correct and the corrupt run, so the byte-position assertion the vector suite rests on could
  // not see it. It throws rather than serialising so a forgotten await cannot silently produce a
  // different-but-valid-looking ceremony.
  it('rejects two overlapping reads on one stream', async () => {
    const s = await createStream(decodeSeedHex(REAL_SEED_HEX), PITY_LABEL);
    await s.read(30);
    const results = await Promise.allSettled([s.read(4), s.read(4)]);
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(String((rejected[0] as PromiseRejectedResult).reason)).toMatch(/not reentrant/);
  });

  it('rejects two overlapping uniformInt draws on one stream', async () => {
    const s = await createStream(decodeSeedHex(REAL_SEED_HEX), PITY_LABEL);
    const results = await Promise.allSettled([uniformInt(s, 12), uniformInt(s, 12)]);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('a forgotten await is caught too', async () => {
    const s = await createStream(decodeSeedHex(REAL_SEED_HEX), PITY_LABEL);
    const dangling = s.read(32); // deliberately not awaited
    await expect(s.read(1)).rejects.toThrow(/not reentrant/);
    await dangling;
  });

  // ⭐ This is the ONLY case that distinguishes the whole-draw claim from the per-read guard —
  // found by the post-patch mutation pass, where deleting the draw-level guard survived every
  // other test here. n = 1 is k = 0, so read(0) never reaches an `await` inside its loop and the
  // per-read flag is set and cleared within one microtask; it cannot see an overlap at all.
  it('guards a whole draw, not just a single read (the k = 0 path)', async () => {
    const s = await createStream(decodeSeedHex(REAL_SEED_HEX), PITY_LABEL);
    const results = await Promise.allSettled([uniformInt(s, 1), uniformInt(s, 1)]);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(String((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason))
      .toMatch(/not reentrant/);
  });

  it('the guard releases, so sequential use is unaffected', async () => {
    const s = await createStream(decodeSeedHex(REAL_SEED_HEX), PITY_LABEL);
    const a = await uniformInt(s, 200);
    const b = await uniformInt(s, 200);
    expect(Number.isInteger(a) && Number.isInteger(b)).toBe(true);
    // …and a throw does not leave the stream permanently claimed.
    await expect(uniformInt(s, 0)).rejects.toThrow(RangeError);
    await expect(uniformInt(s, 12)).resolves.toBeGreaterThanOrEqual(0);
  });
});

// ── the construction guards ───────────────────────────────────────────────────

describe('Stream cannot be built around createStream', () => {
  // Measured at the review: `new Stream(<31-byte key>, label)` was accepted and produced a
  // valid-looking, completely different stream — failure class E4, reachable through the
  // module's own public export. Go's NewStream(seed [32]byte, …) makes that unrepresentable.
  it('the exported constructor refuses to build a stream directly', async () => {
    const key = await crypto.subtle.importKey(
      'raw',
      decodeSeedHex(REAL_SEED_HEX),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const Ctor = Stream as unknown as new (...args: unknown[]) => unknown;
    expect(() => new Ctor(Symbol('forged'), key, PITY_LABEL)).toThrow(TypeError);
    expect(() => new Ctor(undefined, key, PITY_LABEL)).toThrow(TypeError);
  });

  it('label is not writable at runtime', async () => {
    const s = await createStream(decodeSeedHex(REAL_SEED_HEX), PITY_LABEL);
    expect(s.label).toBe(PITY_LABEL);
    // `readonly` is erased at compile time; this used to be a plain writable property, so the
    // reported label could disagree with the bytes actually drawn.
    expect(() => {
      (s as unknown as { label: string }).label = 'inclusivcup/v1/pwned';
    }).toThrow();
    expect(s.label).toBe(PITY_LABEL);
  });

  it('createStream refuses a label that is not well-formed UTF-8', async () => {
    const seed = decodeSeedHex(REAL_SEED_HEX);
    // A lone surrogate has no UTF-8 encoding: TextEncoder substitutes EF BF BD while Go writes
    // the bytes verbatim, so the same label produced two different streams. Refused in both now.
    await expect(createStream(seed, '\uD800')).rejects.toThrow(TypeError);
    await expect(createStream(seed, `${PITY_LABEL}\uDC00`)).rejects.toThrow(TypeError);
    await expect(createStream(seed, '')).rejects.toThrow(TypeError);
    // …and every label the ceremony actually uses is accepted.
    for (let spin = 1; spin <= 12; spin++) {
      await expect(createStream(seed, stage1Label(spin))).resolves.toBeDefined();
    }
  });

  it('read(k) is bounded', async () => {
    const s = await createStream(decodeSeedHex(REAL_SEED_HEX), PITY_LABEL);
    await expect(s.read(MAX_READ_BYTES + 1)).rejects.toThrow(RangeError);
    await expect(s.read(-1)).rejects.toThrow(RangeError);
    expect(s.consumed).toBe(0);
    await expect(s.read(MAX_READ_BYTES)).resolves.toBeDefined();
    expect(s.consumed).toBe(MAX_READ_BYTES);
  });
});

// ── the shared refusal lists ──────────────────────────────────────────────────

describe('invalid-spin conformance', () => {
  // The mirror of Go's TestVectorRejectsInvalidStage1Spins. Added by the review: seed refusals
  // were shared contract while label refusals were two independent hand-written lists, and a
  // mutation relaxing Stage1Label's lower bound survived the vector-driven test because of it.
  it('the vector carries the shared spin-refusal list', () => {
    expect(blockVector.invalid_stage1_spin.length).toBeGreaterThan(0);
  });

  it.each(blockVector.invalid_stage1_spin)('refuses $why', ({ spin }) => {
    expect(() => stage1Label(spin)).toThrow(RangeError);
  });
});

// ── pinning: the bans are tested, because an absent import reddens nothing ─────

describe('lib/roulette source pinning', () => {
  // RECURSIVE, and not filtered to `.ts` while walking. The 6.3 code review found a plain
  // readdirSync here: a future `lib/roulette/weighted/pick.ts` would fail the `.ts` filter as a
  // directory entry, the exact-equality assertion below would still see ['labels.ts','prng.ts']
  // and pass, and a new client-reachable module would be scanned by nothing.
  const ROOT = path.join(process.cwd(), 'lib', 'roulette');
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) return walk(abs);
      return [path.relative(ROOT, abs).split(path.sep).join('/')];
    });

  const shipped = walk(ROOT)
    .filter((f) => /\.(ts|tsx|mts|cts|js|mjs|cjs)$/.test(f) && !/\.test\.[cm]?tsx?$/.test(f))
    .sort()
    .map((f) => [f, readFileSync(path.join(ROOT, f), 'utf8')] as const);

  it('scans exactly the shipped modules', () => {
    // Every non-test module under lib/roulette is production code that can reach a client bundle,
    // so the list is asserted exactly rather than as a lower bound: a new module added here
    // without thinking about the bans below should fail loudly, not slip in unscanned.
    // `stage2.ts` was added by Story 6-4a, `stage1.ts` by 6-4b and `ladder.ts` by 6.5; each had to
    // be registered here to be scanned at all.
    expect(shipped.map(([f]) => f)).toEqual([
      'labels.ts',
      'ladder.ts',
      'prng.ts',
      'stage1.ts',
      'stage2.ts',
    ]);
  });

  it('the walk really is recursive (a nested module could not hide)', () => {
    // Guards the guard: if `walk` regressed to a flat readdir, the exact-equality assertion above
    // would keep passing and say nothing. This proves the mechanism, not just today's result.
    const nested = walk(path.join(process.cwd(), 'lib')).filter((f) => f.includes('/'));
    expect(nested.length).toBeGreaterThan(0);
  });

  // ⛔ DECISION D — `lib/roulette` is the FIRST `lib/` module that is NOT server-only. Every
  // other one opens with `import 'server-only'`, habit will put it here too, and it will be
  // WRONG: `server-only` throws in a client bundle, which is exactly what 6.9's "Verificar la
  // ceremonia" builds. The failure would surface in 6.9, as someone else's build error.
  //
  // The Vitest config ALIASES `server-only` to a stub, so importing the module and expecting a
  // throw proves nothing. Only reading the file can tell the difference.
  it.each(shipped)('%s does not import server-only', (_file, src) => {
    expect(importSpecifiers(src)).not.toContain('server-only');
  });

  // ⛔ DECISION B — no `node:` anything. `node:crypto` does not exist in a browser, and a suite
  // that greens `createHmac` while the browser runs SubtleCrypto is testing a different
  // implementation than the one that ships.
  it.each(shipped)('%s imports no node: builtin', (_file, src) => {
    for (const spec of importSpecifiers(src)) {
      expect(spec.startsWith('node:')).toBe(false);
    }
  });

  it.each(shipped)('%s has no third-party dependency', (_file, src) => {
    for (const spec of importSpecifiers(src)) {
      // Relative only: the whole point of HMAC-SHA256 is that both runtimes already have it.
      expect(spec.startsWith('.')).toBe(true);
    }
  });

  // ⭐⭐ THE POSITIVE CONTROL, and the closure of deferred-work.md:291 (Story 6-4a).
  //
  // THE ORIGINAL FINDING: the three bans above iterate `importSpecifiers(src)`, and at 6-4a every
  // shipped module in this directory had ZERO imports — so `expect([]).not.toContain(…)` and both
  // `for` loops executed NO assertion at all. They passed vacuously, and a regression in
  // `importSpecifiers` itself would have been invisible to them. Silent green is the worst
  // failure mode a pinning test has.
  //
  // ⚠ THE DEFERRAL'S EXPECTED CLOSURE DID NOT HAPPEN AT 6-4a, and that was recorded rather than
  // papered over: it assumed "6.4 will bring the first real import". Stage 2 shares nothing with
  // the PRNG — no seed, no stream, no labels — so `stage2.ts` legitimately imports nothing
  // either, and manufacturing an import purely to make a test non-vacuous would have been the
  // tail wagging the dog.
  //
  // ⭐ STORY 6-4b CLOSED IT FOR REAL. `stage1.ts` imports `./prng` (for `uniformInt` and the
  // `Stream` type) and `./stage2` (for `resolveStage2`, which IS the provisional winner), because
  // Stage 1 genuinely composes the other two stages. The three bans above therefore now execute
  // REAL assertions over a non-empty specifier list for the first time. The 6-4a controls below
  // are KEPT: a non-empty list only proves the list is non-empty, whereas these prove the
  // predicate actually discriminates — which is the property the three tests claim to have.
  describe('the import bans are proven to FIRE, not merely to pass over an empty list', () => {
    it('catches server-only when it is present', () => {
      expect(importSpecifiers("import 'server-only';\nexport const x = 1;")).toContain('server-only');
    });

    it('catches a node: builtin when it is present', () => {
      const specs = importSpecifiers("import { createHmac } from 'node:crypto';");
      expect(specs.some((s) => s.startsWith('node:'))).toBe(true);
    });

    it('catches a third-party dependency when it is present', () => {
      const specs = importSpecifiers("import { createClient } from '@supabase/supabase-js';");
      expect(specs.length).toBeGreaterThan(0);
      expect(specs.every((s) => s.startsWith('.'))).toBe(false);
    });

    it('accepts a relative import, so the ban is not simply refusing everything', () => {
      const specs = importSpecifiers("import type { Award } from './stage2';");
      expect(specs).toEqual(['./stage2']);
      expect(specs.every((s) => s.startsWith('.'))).toBe(true);
    });

    // ⭐ UPDATED DELIBERATELY BY STORY 6-4b, which is exactly what the previous version of this
    // test asked for: "the day a shipped module gains a real import, this reddens — which is the
    // moment to notice that the three bans have started executing real assertions, and to update
    // this line deliberately rather than silently." That day is `stage1.ts`.
    //
    // It is now the MEASURED truth rather than a blanket claim: the exact import graph is pinned
    // per module, so a module quietly gaining an import still reddens here — including the two
    // that must stay leaves. `labels.ts` and `prng.ts` importing nothing is load-bearing: they are
    // the primitives, and an import appearing in either would mean the browser bundle grew a
    // dependency the producer does not have.
    // ⚠ THE PIN IS OVER THE SET OF MODULES IMPORTED, NOT THE RAW SPECIFIER LIST. The 6-4b code
    // review found the raw list encoding `['./prng', './prng', './stage2', './stage2']` — the
    // duplicates existing only because the module split its value and `import type` statements —
    // so a behaviour-neutral refactor that merged them reddened this pin for no semantic reason,
    // and that is precisely what happened when `Stream` moved into the value import. Deduping
    // loses nothing that matters: the property this pin protects is WHICH modules a shipped file
    // depends on, and a set states that exactly.
    it('pins each shipped module’s exact import graph', () => {
      const graph = Object.fromEntries(
        shipped.map(([file, src]) => [file, [...new Set(importSpecifiers(src))].sort()]),
      );
      expect(graph).toEqual({
        'labels.ts': [],
        // ⭐ Story 6.5. The FR-29 ladder imports `./stage2` and NOTHING ELSE, and that emptiness
        // elsewhere is load-bearing: no `./prng`, because the ladder draws ZERO bytes (L1) and a
        // stream import appearing here would be the first visible sign that somebody had added a
        // seeded rung — which would move every byte position after it and invalidate 6-4b's
        // measured 22-byte ceremony. It shares `stage2`'s comparator on purpose (`beatsBy`), so
        // rungs 1-3 inherit 6-4a's verbatim zero-denominator semantics rather than restating them.
        'ladder.ts': ['./stage2'],
        'prng.ts': [],
        // Stage 1 composes the other two stages: `uniformInt` draws the pick and `resolveStage2`
        // IS the provisional winner whose shelf the weight is indexed by.
        'stage1.ts': ['./prng', './stage2'],
        'stage2.ts': [],
      });
    });

    // …and at least one shipped module really does have a non-empty list, so the three bans above
    // are no longer vacuous. Guards the guard: if every module went back to importing nothing,
    // the bans would silently stop asserting and the pin above would still pass.
    it('at least one shipped module has a non-empty specifier list, so the bans are not vacuous', () => {
      const withImports = shipped.filter(([, src]) => importSpecifiers(src).length > 0);
      expect(withImports.map(([f]) => f)).toEqual(['ladder.ts', 'stage1.ts']);
    });
  });

  // AC3 — integer-only, locale-free, no language-specific RNG. Scanned over source with
  // comments AND string bodies blanked, so the doc comments that EXPLAIN these bans (and the
  // error messages that quote them) do not trip their own rule.
  it.each(shipped)('%s uses no banned construct', (_file, src) => {
    const code = blankOut(src, { strings: true });
    const banned: Array<[string, string]> = [
      ['Math.random', 'language-specific RNG: the stream must come from HMAC only'],
      ['crypto.getRandomValues', 'OS entropy is the BRACKET seed (AD-13), never the roulette'],
      ['randomUUID', 'OS entropy has no place in a reproducible draw'],
      ['Date', 'no clock in the draw path — a ceremony must replay identically forever'],
      ['toLocaleString', 'locale-dependent formatting keys a different stream per machine'],
      ['toLocaleLowerCase', 'locale-dependent casing'],
      ['localeCompare', 'locale-dependent comparison'],
      ['Intl.', 'locale-dependent formatting'],
      ['parseFloat', 'SPEC Constraint 7: integer-only arithmetic'],
      ['Number.EPSILON', 'SPEC Constraint 7: integer-only arithmetic'],
      ['Math.round', 'SPEC Constraint 7: rounding implies a fraction reached the draw path'],
      // Added by the 6.3 code review, which found the list banning Math.round while the module
      // itself used both of these — Task 4 names them literally ("Never parseInt, never ** on
      // floats"), so the code was changed to conform rather than the rule quietly dropped.
      ['parseInt', 'accepts leading whitespace and stops at the first invalid char — a best-effort decode'],
      ['**', 'the exponent operator is float-valued in general; write the integer literal'],
      // Spaced deliberately: TypeScript's generic syntax closes with a bare `>>`
      // (`Readonly<Record<string, number>>`), so an unspaced needle false-positives on types.
      // A real shift in this code would be written `x << 8`, which this catches.
      [' << ', '32-bit operator: it would silently corrupt the k = 4 assembly'],
      [' >> ', '32-bit operator: it would silently corrupt the k = 4 assembly'],
      [' >>> ', '32-bit operator: it would silently corrupt the k = 4 assembly'],
    ];
    // NOTE ON `Math.floor`: it is deliberately NOT banned. JavaScript has no integer division, so
    // `Math.floor(pos / BLOCK_BYTES)` is the sanctioned idiom and is exact for every position
    // below 2^53. `Math.round` IS banned because rounding to nearest can only be reached by
    // treating a value as an approximation, which nothing in the draw path may do.
    for (const [needle, why] of banned) {
      expect(code.includes(needle), `${_file} uses banned "${needle}" — ${why}`).toBe(false);
    }
  });

  // ⭐ DECISION B's POSITIVE half. Every ban above is a negative, and the 6.3 code review found
  // that a hand-rolled pure-TS SHA-256 — precisely what DECISION B forbids — would satisfy all of
  // them and still green every vector. So assert the module reaches WebCrypto by name.
  it('prng.ts signs through crypto.subtle, not a hand-rolled HMAC', () => {
    const src = shipped.find(([f]) => f === 'prng.ts')?.[1] ?? '';
    const code = blankOut(src, { strings: true });
    expect(code).toContain('crypto.subtle.importKey');
    expect(code).toContain('crypto.subtle.sign');
  });

  it('the Stream API is async by construction (SubtleCrypto is Promise-based)', async () => {
    // `await` on a non-promise is a silent no-op, so a sync rewrite would redden nothing without
    // this. 6.4/6.6/6.7 inherit these signatures.
    const s = await createStream(decodeSeedHex(REAL_SEED_HEX), PITY_LABEL);
    expect(Object.getPrototypeOf(s).read.constructor.name).toBe('AsyncFunction');
    expect(uniformInt.constructor.name).toBe('AsyncFunction');
    expect(createStream.constructor.name).toBe('AsyncFunction');
  });

  // The comment/string blanker is itself load-bearing: if it silently stopped blanking, every
  // ban above would start passing vacuously (the source text still SAYS "Math.random" in a
  // comment). So it gets its own test.
  it('the blanker removes comments and strings but not code', () => {
    const sample = [
      "const a = 'Math.random not really';",
      '// Date is banned here',
      '/* toLocaleString explained */',
      'const b = realCode(1);',
      'const url = "https://x/y"; // not a comment inside the string',
    ].join('\n');

    const code = blankOut(sample, { strings: true });
    expect(code).toContain('realCode(1)');
    expect(code).not.toContain('Math.random');
    expect(code).not.toContain('Date');
    expect(code).not.toContain('toLocaleString');
    expect(code).not.toContain('https');
    expect(code.split('\n').length).toBe(sample.split('\n').length);

    // …and with strings kept, the specifier really survives (which is what the import scan needs).
    const withStrings = blankOut("import 'server-only'; // Date", { strings: false });
    expect(withStrings).toContain("'server-only'");
    expect(withStrings).not.toContain('Date');
  });

  // ⭐ Both of these are 6.3 review findings. Each made the blanker erase code it should have
  // scanned, which turns every ban above into a vacuous pass — silent green, the worst failure
  // mode a pinning test has.
  it('template-literal interpolations are CODE, not string body', () => {
    // labels.ts builds every label out of `${LABEL_PREFIX}/stage1/spin/${String(spin)}`, so a
    // blanker that erases `${…}` cannot see a banned construct at the one place it would live.
    const src = 'const l = `a${spin.toLocaleString()}b${Math.random()}c`; const k = keep;';
    const code = blankOut(src, { strings: true });
    expect(code).toContain('toLocaleString');
    expect(code).toContain('Math.random');
    expect(code).toContain('keep');
    expect(code).not.toContain('a'.repeat(1) + 'b'); // the literal text between them is gone
    expect(code.length).toBe(src.length); // offsets preserved
  });

  it('nested braces inside an interpolation do not end it early', () => {
    const src = 'const s = `x${ f({ a: 1 }) }y${ Date.now() }z`;';
    const code = blankOut(src, { strings: true });
    expect(code).toContain('Date');
    expect(code.length).toBe(src.length);
  });

  it('a regex containing a quote does not blank the rest of the file', () => {
    // Without regex-literal handling the `'` inside the character class opens quote mode and
    // never closes, erasing everything after it — so every later ban passes vacuously.
    const src = ["const re = /['\"]/;", 'const later = Math.random();'].join('\n');
    const code = blankOut(src, { strings: true });
    expect(code).toContain('Math.random');
    expect(code.split('\n').length).toBe(2);
  });

  it('division is not mistaken for a regex', () => {
    const src = 'const half = total / 2; const other = count / 4; const keep = 1;';
    const code = blankOut(src, { strings: true });
    expect(code).toContain('total / 2');
    expect(code).toContain('count / 4');
    expect(code).toContain('keep');
  });

  it('a `//` inside a string is not mistaken for a comment', () => {
    const src = 'const u = "a//b"; const v = keep;';
    expect(blankOut(src, { strings: false })).toContain('keep');
    expect(blankOut(src, { strings: false })).toContain('"a//b"');
  });

  it('importSpecifiers finds every import form and ignores commented-out ones', () => {
    const src = [
      "import { a } from './a';",
      "import 'server-only';",
      "// import 'node:crypto';",
      "const x = await import('./b');",
      "export { c } from './c';",
    ].join('\n');
    const specs = importSpecifiers(src);
    expect(specs).toEqual(expect.arrayContaining(['./a', 'server-only', './b', './c']));
    expect(specs).not.toContain('node:crypto');
  });
});
