import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { PITY_LABEL } from './labels';
import { createStream, decodeSeedHex } from './prng';
import { PITY_REFUSAL_DETAILS, PityError, resolvePity } from './pity';
import type { RatePair, SnapshotPlayer } from './stage2';

// NOTE: `node:fs` is imported HERE, in the test. The banned-`node:` rule applies to the shipped
// modules (scanned in prng.test.ts), not to the suite that reads the vector files off disk.
//
// ⚠ THIS FILE MUST LIVE UNDER `lib/**` — `vitest.config.ts:17` restricts collection to that tree,
// so a suite placed anywhere else SILENTLY DOES NOT RUN.

// ── the shared contract ────────────────────────────────────────────────────────
//
// These tests read `roulette/vectors/pity-draw.json` AT RUNTIME. The values are NEVER transcribed
// into TypeScript literals: a hard-coded copy greens on the day the vector is regenerated and
// silently stops testing the contract. `npm test` runs with cwd = the repo root.
//
// ⭐ THIS IS THE FIRST RESOLVER SUITE SINCE STAGE 1 THAT ASSERTS A BYTE COUNT AND MEANS IT. The
// ladder and anti-sweep suites prove "it drew nothing" by the SIGNATURE, because a runtime
// assertion around a function that cannot reach a stream is vacuous. Here the stream is a required
// parameter, so `consumed` is the gate.

const VECTOR_PATH = path.join(process.cwd(), 'roulette', 'vectors', 'pity-draw.json');

interface VectorPlayer {
  steamid64: string;
  rounds_played: string;
  kills: string;
  idle_dq: boolean;
  stats_int: {
    volume: Record<string, string>;
    rate: Record<string, { num: string; den: string }>;
  };
}

interface VectorDraw {
  n: number;
  k: number;
  rejections: number;
  value: number;
}

interface VectorExpected {
  winless: string[];
  reveal_order: string[];
  draws: VectorDraw[];
  bytes_consumed: number;
}

interface VectorCase {
  name: string;
  note: string;
  seed_hex: string;
  /** ⚠ ABSENT IN ONE ROW ON PURPOSE (P11) — an omitted container is the EMPTY container. */
  players?: VectorPlayer[];
  shelf?: Record<string, number>;
  expected: VectorExpected;
}

interface VectorRefusal {
  why: string;
  detail: string;
  defects: string[];
  seed_hex: string;
  /** The wrong-label row — how AC4's "PITY_LABEL and only PITY_LABEL" becomes vector-checked. */
  label?: string;
  /** The not-fresh row — bytes burnt off the stream before the call (SPINE:216). */
  pre_consumed?: number;
  players: VectorPlayer[];
  shelf: Record<string, number>;
}

const vector = JSON.parse(readFileSync(VECTOR_PATH, 'utf8')) as {
  vector: string;
  algo_version: string;
  spec: string;
  label: string;
  refusal_details: string[];
  row_representable_refusal_details: string[];
  refusals: VectorRefusal[];
  cases: VectorCase[];
};

/**
 * ⛔ THE SHAPE IS CHECKED BEFORE `BigInt` SEES IT. A bare `BigInt(s)` is a LENIENT parser
 * (`BigInt('')` is `0n`, `BigInt('0x10')` is `16n`) while Go's `SetString(s, 10)` refuses both, so a
 * drifted row would become a silently different number here and a named failure there.
 */
function big(what: string, s: string): bigint {
  if (!/^-?[0-9]+$/.test(s)) {
    throw new Error(`vector carries a non-decimal magnitude for ${what}: ${JSON.stringify(s)}`);
  }
  return BigInt(s);
}

function toPlayers(rows: VectorPlayer[] | undefined): SnapshotPlayer[] | undefined {
  // ⚠ `undefined` STAYS `undefined`. Coercing an omitted container to `[]` here would move P11's
  // "an absent container is the empty container" rule out of the module and into this loader,
  // which is exactly how a rule stops being tested.
  if (rows === undefined) return undefined;
  return rows.map((r) => {
    const volume: Record<string, bigint> = {};
    for (const [k, v] of Object.entries(r.stats_int.volume)) {
      volume[k] = big(`${r.steamid64}.volume.${k}`, v);
    }
    const rate: Record<string, RatePair> = {};
    for (const [k, v] of Object.entries(r.stats_int.rate)) {
      rate[k] = {
        num: big(`${r.steamid64}.rate.${k}.num`, v.num),
        den: big(`${r.steamid64}.rate.${k}.den`, v.den),
      };
    }
    return {
      steamid64: r.steamid64,
      roundsPlayed: big(`${r.steamid64}.rounds_played`, r.rounds_played),
      kills: big(`${r.steamid64}.kills`, r.kills),
      idleDq: r.idle_dq,
      volume,
      rate,
    } as SnapshotPlayer;
  });
}

/** The stream one row runs on: fresh, counter 0, keyed by the file's pity label unless overridden. */
async function streamFor(seedHex: string, label: string, preConsumed = 0) {
  const stream = await createStream(decodeSeedHex(seedHex), label);
  if (preConsumed > 0) await stream.read(preConsumed);
  return stream;
}

describe('pity-draw.json — the shared contract', () => {
  it('is the file this suite thinks it is', () => {
    expect(vector.vector).toBe('pity-draw');
    expect(vector.cases.length).toBeGreaterThan(0);
    expect(vector.refusals.length).toBeGreaterThan(0);
  });

  // ⭐ THE CASE-NAME SET IS PINNED BY EXACT EQUALITY, mirroring the Go suite and every vector suite
  // before it: a coverage flag can be satisfied by a row unrelated to the property it names, so
  // deleting this file's most valuable rows would leave every flag green, `--check` reporting OK and
  // both suites passing. Adding or removing a case reddens this deliberately.
  it('carries exactly the expected cases', () => {
    expect(vector.cases.map((c) => c.name).sort()).toEqual(
      [
        'a-ONE-member-winless-set-RESOLVES-and-consumes-ZERO-bytes',
        'a-REJECTION-inside-uniform_int-is-BYTE-ACCOUNTED-and-CHANGES-the-reveal-order',
        'a-THREE-member-winless-set-DEMONSTRABLY-REORDERS',
        'a-TWO-member-winless-set-COSTS-ONE-BYTE-and-the-SELF-SWAP-leaves-the-order-UNCHANGED',
        'a-roster-where-EVERY-player-HOLDS-a-trophy-leaves-the-winless-set-EMPTY',
        'an-ABSENT-players-and-shelf-CONTAINER-is-the-EMPTY-one',
        'an-ABSENT-shelf-key-is-shelf-ZERO',
        'an-EMPTY-roster-resolves-to-an-EMPTY-draw-and-consumes-ZERO-bytes',
        'an-EXPLICIT-shelf-0-is-BYTE-IDENTICAL-to-an-absent-key',
        'an-idle_dq-player-is-EXCLUDED-while-a-player-with-ZERO-approved-rows-is-INCLUDED',
        'the-ROSTER-supplied-OUT-OF-BYTE-LEX-ORDER-resolves-IDENTICALLY',
        'the-SHIPPED-floors-shape-NOBODY-holds-a-trophy-and-EVERY-player-is-BELOW-both-FR-21-floors',
        'the-winless-set-is-a-STRICT-SUBSET-in-the-MIDDLE-of-byte-lex-order',
      ].sort(),
    );
  });

  // Pins this module's constants against the vector's vocabulary, so a fourth label cannot be added
  // on one side alone. 6-4b shipped a "closed set" that was 9 / 7 / 7 across three implementations.
  it('declares exactly the details this module declares', () => {
    expect([...vector.refusal_details].sort()).toEqual([...PITY_REFUSAL_DETAILS].sort());
    // ⭐ AND THE ROW-REPRESENTABLE SET EQUALS IT, WHICH IS THE POINT RATHER THAN AN OVERSIGHT: pity
    // declares no `internal` label because it has no injected port that could hand it a state no
    // input can reach. Asserting the equality as DATA keeps the absence a decision.
    expect([...vector.row_representable_refusal_details].sort()).toEqual(
      [...vector.refusal_details].sort(),
    );
  });

  it('is drawing on Story 6.3’s frozen pity label', () => {
    expect(vector.label).toBe(PITY_LABEL);
  });

  it('the refusal-detail constant is frozen, and shallowly is enough (every element a primitive)', () => {
    expect(Object.isFrozen(PITY_REFUSAL_DETAILS)).toBe(true);
    for (const d of PITY_REFUSAL_DETAILS) expect(typeof d).toBe('string');
  });
});

describe('resolvePity — conformance', () => {
  it.each(vector.cases.map((c) => [c.name, c] as const))('%s', async (_name, tc) => {
    const stream = await streamFor(tc.seed_hex, vector.label);
    const got = await resolvePity({
      players: toPlayers(tc.players),
      shelf: tc.shelf,
      stream,
    });

    expect(got.winless).toEqual(tc.expected.winless);
    expect(got.revealOrder).toEqual(tc.expected.reveal_order);

    // ⭐⭐ THE BYTE COST IS PART OF THE ANSWER, NOT A DIAGNOSTIC. 6.9's browser has to consume the
    // same bytes, not merely reach the same permutation — an implementation that got there by a
    // different draw sequence would desynchronise every stream position after it.
    expect(got.bytesConsumed).toBe(tc.expected.bytes_consumed);
    // …and the STREAM agrees with what the result reports, so a result that under-reported its own
    // cost is caught rather than believed.
    expect(stream.consumed).toBe(tc.expected.bytes_consumed);

    expect(got.draws).toEqual(
      tc.expected.draws.map((d) => ({
        n: d.n,
        k: d.k,
        rejections: d.rejections,
        value: d.value,
      })),
    );

    // ⭐⭐ AC2's MULTISET IDENTITY, ASSERTED ON EVERY CASE RATHER THAN SPOT-CHECKED. The OUTCOME is
    // invariant and only the ORDER is drawn, so the reveal order is a permutation of the winless
    // set: same length, same members, no additions, no drops. This is where "everyone winless gets
    // one" stops being a sentence in a spec.
    expect([...got.revealOrder].sort()).toEqual([...got.winless]);
    expect(new Set(got.revealOrder).size).toBe(got.revealOrder.length);
  });
});

describe('resolvePity — refusals', () => {
  // ⭐ PER-ROW `detail` ASSERTIONS FROM THE START. 6-4a measured that an untyped refusal surface let
  // a mutation which rejected EVERY input pass all sixteen refusal rows; asserting only "it threw"
  // is the same blindness one step less obvious.
  it.each(vector.refusals.map((r) => [r.why, r] as const))('%s', async (_why, row) => {
    const stream = await streamFor(row.seed_hex, row.label ?? vector.label, row.pre_consumed ?? 0);
    const before = stream.consumed;

    let thrown: unknown;
    try {
      await resolvePity({ players: toPlayers(row.players), shelf: row.shelf, stream });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(PityError);
    expect((thrown as PityError).detail).toBe(row.detail);
    expect(vector.refusal_details).toContain((thrown as PityError).detail);
    // ⭐ `detail` MUST EQUAL `defects[0]` — the published validation order, checkable in the file
    // rather than only in prose.
    expect(row.defects[0]).toBe(row.detail);

    // ⭐ A REFUSAL MUST NOT COST BYTES. Validation runs before the first draw, so a caller that
    // refuses, fixes its input and retries gets the SAME ceremony — and a validation step
    // accidentally moved below the loop would otherwise be invisible.
    expect(stream.consumed).toBe(before);
  });

  // ⭐ VALIDATION ORDER IS CONTRACT, AND IT IS THE BOUNDARIES THAT MATTER, NOT THE COUNT. A count of
  // doubly-malformed rows is the wrong proxy and 6.6's review measured the cost of using one: two
  // rows that both pin stream/players satisfy `>= 2` while leaving players/shelf unobservable.
  it('a doubly-malformed row pins each ADJACENT boundary of stream -> players -> shelf', () => {
    const pairs = new Set(
      vector.refusals
        .filter((r) => r.defects.length >= 2)
        .map((r) => [r.defects[0], r.defects[1]].slice().sort().join('/')),
    );
    expect(pairs).toContain(['stream', 'players'].sort().join('/'));
    expect(pairs).toContain(['players', 'shelf'].sort().join('/'));
  });

  it('every declared row-representable detail is genuinely exercised by a row', () => {
    const exercised = new Set(vector.refusals.map((r) => r.detail));
    for (const d of vector.row_representable_refusal_details) {
      expect(exercised, `detail ${d} is declared and no row carries it`).toContain(d);
    }
  });

  // ⚠ THE ONE ARM NO ROW CAN EXPRESS — "no stream was supplied" is not a JSON input, so the
  // generator refuses to write a row reaching it and this module's own suite drives it instead.
  // ⛔ `null` AND `undefined` BOTH, because a bare `!== undefined` guard would treat `null` as
  // PRESENT and then read `null.label`, throwing a `TypeError` whose `.detail` a caller cannot read
  // — bypassing the closed set entirely.
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a plain object that is not a Stream', {}],
    // ⭐⭐ THE DISCRIMINATING SHAPE (6.7 code review). The three rows above are all rejected by the
    // FIRST clause of the guard — `{}` fails `typeof stream.label !== 'string'` — so none of them
    // ever reached the question the guard is actually about. This row carries a well-formed label
    // and a well-formed position and NO `read`, which every pre-review check accepted. It is the
    // stand-in that resolved a zero-member set while publishing an invented byte count.
    ['a structurally-shaped stand-in with no `read`', { label: PITY_LABEL, consumed: 0 }],
  ])('refuses %s as a stream, under the `stream` detail', async (_what, bad) => {
    await expect(
      resolvePity({ players: [], shelf: {}, stream: bad as never }),
    ).rejects.toSatisfy((err: unknown) => err instanceof PityError && err.detail === 'stream');
  });

  // ⭐ …AND IT REFUSES AT BOTH CARDINALITIES, which is the whole point of the row above. Before the
  // capability check the stand-in's behaviour SPLIT on the winless count: at 0 or 1 members the
  // shuffle loop never runs, so the pass RESOLVED and reported the stand-in's own `consumed`; only
  // at 2+ did it reach `read` and die — untyped. A guard that only fired on one side of that split
  // would leave the silent-resolution half in place, so both sides are driven here.
  it.each([
    ['a ZERO-member winless set (the loop never runs)', 0],
    ['a ONE-member winless set (the loop never runs)', 1],
    ['a TWO-member winless set (the loop reaches `read`)', 2],
  ])('refuses a read-less stand-in even with %s', async (_what, n) => {
    const players = toPlayers(
      Array.from({ length: n }, (_v, i) => ({
        steamid64: `1000${String(i)}`,
        rounds_played: '30',
        kills: '25',
        idle_dq: false,
        stats_int: { volume: {}, rate: {} },
      })) as never,
    );
    await expect(
      resolvePity({
        players,
        shelf: {},
        stream: { label: PITY_LABEL, consumed: 0 } as never,
      }),
    ).rejects.toSatisfy((err: unknown) => err instanceof PityError && err.detail === 'stream');
  });

  // ── the arms no VECTOR ROW can express, driven here instead (6.7 code review) ─────────────────
  //
  // ⛔⛔ THESE FIVE BRANCHES WERE EXERCISED BY NOTHING — no vector row and no unit test — which is
  // the exact standard this module uses to REJECT an `internal` refusal label: "a label no suite
  // could ever drive is a COMPARTMENT rather than a contract". That discipline had been applied to
  // one arm (the missing stream) and not to these. They cannot be vector rows: each is a
  // structurally-wrong JSON type that Go's type system refuses at its LOADER rather than inside the
  // pass, so a shared row would force the other two runtimes to refuse an input they cannot even
  // represent (P11, Cuatro's call at the 6-4b review). So they are driven per-runtime, here.
  it.each([
    ['players is not an array', { players: 'nope' as never, shelf: {} }, 'players'],
    ['a roster element is not an object', { players: [42] as never, shelf: {} }, 'players'],
    [
      'idleDq is not a boolean',
      { players: [{ steamid64: '10', idleDq: 'no' }] as never, shelf: {} },
      'players',
    ],
    [
      'a shelf count is not an integer',
      { players: [] as never, shelf: { '10': 1.5 } as never },
      'shelf',
    ],
    ['a shelf key is the empty string', { players: [] as never, shelf: { '': 0 } }, 'shelf'],
  ])('refuses %s, under the declared detail', async (_what, input, detail) => {
    const stream = await streamFor(vector.cases[0].seed_hex, vector.label);
    await expect(
      resolvePity({ ...(input as object), stream } as never),
    ).rejects.toSatisfy((err: unknown) => err instanceof PityError && err.detail === detail);
    // ⭐ AND IT COSTS NOTHING. Every one of these is a VALIDATION refusal, so it fires before the
    // first draw — the invariant that is true of all of them and deliberately NOT true of the
    // mid-shuffle `uniformInt` arm.
    expect(stream.consumed).toBe(0);
  });
});

describe('resolvePity — the properties no single row states', () => {
  // ⭐⭐ P2 — EVERY WINLESS PLAYER WINS. The most plausible wrong implementation of something named
  // "pity roulette" draws N winners out of the winless set and leaves the rest with nothing; it
  // would satisfy "seeded" and "reproducible" and would defeat FR-28 entirely. Stated here about
  // the PASS rather than about a row.
  it('is a PERMUTATION, never a lottery', async () => {
    for (const tc of vector.cases) {
      const got = await resolvePity({
        players: toPlayers(tc.players),
        shelf: tc.shelf,
        stream: await streamFor(tc.seed_hex, vector.label),
      });
      expect(got.revealOrder.length, tc.name).toBe(got.winless.length);
      for (const sid of got.winless) {
        expect(got.revealOrder.filter((x) => x === sid).length, `${tc.name}/${sid}`).toBe(1);
      }
    }
  });

  // ⭐⭐ P7 — THE FR-21 FLOORS ARE NEVER CONSULTED, checked as behaviour rather than by reading the
  // source. The same roster is resolved twice, with `roundsPlayed` and `kills` zeroed on the second
  // run; if a floor were read anywhere the two answers would diverge. They must be identical,
  // including the draw sequence and the byte cost.
  it('reads neither rounds_played nor kills — no floor can reach the winless set', async () => {
    for (const tc of vector.cases) {
      const players = toPlayers(tc.players);
      const withStats = await resolvePity({
        players,
        shelf: tc.shelf,
        stream: await streamFor(tc.seed_hex, vector.label),
      });
      const zeroed = players?.map((p) => ({ ...p, roundsPlayed: 0n, kills: 0n }));
      const withoutStats = await resolvePity({
        players: zeroed,
        shelf: tc.shelf,
        stream: await streamFor(tc.seed_hex, vector.label),
      });
      expect(withoutStats.revealOrder, tc.name).toEqual(withStats.revealOrder);
      expect(withoutStats.bytesConsumed, tc.name).toBe(withStats.bytesConsumed);
    }
  });

  // ⭐ P6 — THE SHELF IS READ, NEVER WRITTEN. "There is no write" is a claim about code that a
  // refactor can break silently, so the caller's object is compared before and after.
  it('never writes the caller’s shelf', async () => {
    for (const tc of vector.cases) {
      const shelf: Record<string, number> = { ...(tc.shelf ?? {}) };
      const snapshot = JSON.stringify(shelf);
      await resolvePity({
        players: toPlayers(tc.players),
        shelf,
        stream: await streamFor(tc.seed_hex, vector.label),
      });
      expect(JSON.stringify(shelf), tc.name).toBe(snapshot);
    }
  });

  // ⭐⭐ DECISION D, CHECKED ON THE EMITTED DATA. The `n` sequence is exactly len..2, strictly
  // decreasing, and `n = 1` is NEVER drawn. An ascending-sweep implementation reaches a different
  // permutation from the same stream while still calling itself Fisher–Yates; this separates them
  // independently of which permutation either one happens to reach.
  it('pins Durstenfeld DESCENDING: the n sequence is len..2 and n is never 1', () => {
    for (const tc of vector.cases) {
      const want: number[] = [];
      for (let n = tc.expected.winless.length; n >= 2; n -= 1) want.push(n);
      expect(tc.expected.draws.map((d) => d.n), tc.name).toEqual(want);
      for (const d of tc.expected.draws) {
        expect(d.n, `${tc.name}: n must be >= 2`).toBeGreaterThanOrEqual(2);
        // j is always in [0, i], i.e. [0, n): the primitive's own contract, re-derived here so a
        // vector carrying an impossible value could not teach it to both suites.
        expect(d.value, `${tc.name}: uniform_int returns [0, n)`).toBeLessThan(d.n);
        expect(d.value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  // ⭐ THE VECTOR IS CHECKED AGAINST ITSELF. A rejection consumes its k bytes and draws k fresh
  // ones, so a step costs `k * (1 + rejections)` exactly. A file whose total disagreed with its own
  // steps would teach BOTH suites to accept an implementation that under-reported — which is one of
  // the mutations Task 7 runs.
  it('every case’s bytes_consumed is re-derivable from its own draws', () => {
    for (const tc of vector.cases) {
      const derived = tc.expected.draws.reduce((sum, d) => sum + d.k * (1 + d.rejections), 0);
      expect(derived, tc.name).toBe(tc.expected.bytes_consumed);
    }
  });

  // ⭐ THE THREE IDENTITIES THE FILE IS BUILT AROUND, asserted here as well as at the anchor —
  // and each guarded against being a row compared with itself, which is the failure mode that makes
  // an identity check prove nothing.
  it('the out-of-byte-lex row is the SAME roster in a DIFFERENT order with a byte-identical result', () => {
    const inOrder = vector.cases.find((c) => c.name === 'a-THREE-member-winless-set-DEMONSTRABLY-REORDERS');
    const shuffled = vector.cases.find(
      (c) => c.name === 'the-ROSTER-supplied-OUT-OF-BYTE-LEX-ORDER-resolves-IDENTICALLY',
    );
    expect(inOrder && shuffled).toBeTruthy();
    expect(shuffled!.expected).toEqual(inOrder!.expected);
    const a = inOrder!.players!.map((p) => p.steamid64);
    const b = shuffled!.players!.map((p) => p.steamid64);
    expect(b).not.toEqual(a); // …a DIFFERENT order,
    expect([...b].sort()).toEqual([...a].sort()); // …of the SAME roster.
    // …and it genuinely reorders, so a shuffle that returned its input would not satisfy both rows.
    expect(inOrder!.expected.reveal_order).not.toEqual(inOrder!.expected.winless);
  });

  it('an ABSENT shelf key and an EXPLICIT 0 are byte-identical', () => {
    const absent = vector.cases.find((c) => c.name === 'an-ABSENT-shelf-key-is-shelf-ZERO')!;
    const explicit = vector.cases.find(
      (c) => c.name === 'an-EXPLICIT-shelf-0-is-BYTE-IDENTICAL-to-an-absent-key',
    )!;
    expect(explicit.expected).toEqual(absent.expected);
    expect(explicit.shelf).not.toEqual(absent.shelf); // …two spellings,
    expect(explicit.players).toEqual(absent.players); // …of one roster.
  });

  it('an ABSENT container is the EMPTY container (P11)', () => {
    const empty = vector.cases.find(
      (c) => c.name === 'an-EMPTY-roster-resolves-to-an-EMPTY-draw-and-consumes-ZERO-bytes',
    )!;
    const omitted = vector.cases.find(
      (c) => c.name === 'an-ABSENT-players-and-shelf-CONTAINER-is-the-EMPTY-one',
    )!;
    expect(omitted.expected).toEqual(empty.expected);
    // …and the row really does OMIT both keys, or it is testing the explicit spelling twice.
    expect(Object.hasOwn(omitted, 'players')).toBe(false);
    expect(Object.hasOwn(omitted, 'shelf')).toBe(false);
  });

  // ⭐ P7's COVERAGE FLAG, RE-DERIVED FROM THE ROWS' OWN DATA rather than asserted as a count: at
  // least two rows must carry a winless player BELOW BOTH shipped FR-21 floors, or an implementation
  // that re-applied them inside pity would pass every row in the file. This is the twin of the hole
  // Story 6.6's mutation pass found in its own vector.
  it('at least two rows carry a winless player below BOTH FR-21 floors', () => {
    const rows = vector.cases.filter((c) =>
      (c.players ?? []).some(
        (p) =>
          c.expected.winless.includes(p.steamid64) &&
          BigInt(p.rounds_played) < 24n &&
          BigInt(p.kills) < 20n,
      ),
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  // ⭐ EXACTLY ONE ROW EXERCISES A REJECTION, and its rejection is attributable to the arithmetic
  // (`256 mod n != 0`) rather than to luck of the fixture.
  it('exactly one row exercises a uniform_int rejection, and it is forced by 256 mod n', () => {
    const rows = vector.cases.filter((c) => c.expected.draws.some((d) => d.rejections > 0));
    expect(rows.map((c) => c.name)).toEqual([
      'a-REJECTION-inside-uniform_int-is-BYTE-ACCOUNTED-and-CHANGES-the-reveal-order',
    ]);
    expect(
      rows[0].expected.draws.some((d) => d.rejections > 0 && 256 % d.n !== 0),
    ).toBe(true);
  });

  // ⭐ EXACTLY FOUR ZERO-BYTE ROWS AND EXACTLY ONE ONE-MEMBER ROW — AC3's two halves, pinned by the
  // specific rows that carry them so a degenerate row cannot satisfy the claim.
  it('AC3’s zero and one cases are present and are not satisfied by a degenerate row', () => {
    const zeroByte = vector.cases.filter((c) => c.expected.bytes_consumed === 0).map((c) => c.name);
    expect(zeroByte.sort()).toEqual(
      [
        'a-ONE-member-winless-set-RESOLVES-and-consumes-ZERO-bytes',
        'a-roster-where-EVERY-player-HOLDS-a-trophy-leaves-the-winless-set-EMPTY',
        'an-ABSENT-players-and-shelf-CONTAINER-is-the-EMPTY-one',
        'an-EMPTY-roster-resolves-to-an-EMPTY-draw-and-consumes-ZERO-bytes',
      ].sort(),
    );
    const oneMember = vector.cases.filter((c) => c.expected.winless.length === 1);
    expect(oneMember.map((c) => c.name)).toEqual([
      'a-ONE-member-winless-set-RESOLVES-and-consumes-ZERO-bytes',
    ]);
    // …and the one-member row has an EMPTY draws array, which is the half the byte count cannot
    // state: `uniformInt(s, 1)` is legal and reads zero bytes, so an implementation that DID call
    // it would be byte-identical to one that did not.
    expect(oneMember[0].expected.draws).toEqual([]);
  });
});
