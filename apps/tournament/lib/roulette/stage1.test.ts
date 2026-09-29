import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { PITY_LABEL, stage1Label } from './labels';
import { createStream, decodeSeedHex } from './prng';
import type { Stream } from './prng';
import {
  REFUSAL_DETAILS,
  Stage1Error,
  Stage1TieError,
  stage1Pick,
  stage1Weights,
  weightAt,
} from './stage1';
import type { Stage1Candidate, Stage1Input } from './stage1';
// `resolveStage2` is imported as a VALUE so the coverage guards below can RE-DERIVE the outcome
// kind each row is named for, rather than inferring it from the weights the row happens to
// produce. See the guard-the-guards notes on the frozen-shelf and DECISION-F rows.
import { fr29Ladder } from './ladder';
import { resolveStage2 } from './stage2';
import type { Award, Ladder, Outcome, SnapshotPlayer, StatValue } from './stage2';

// NOTE: `node:fs` is imported HERE, in the test. The banned-`node:` rule applies to the shipped
// modules (scanned in prng.test.ts), not to the suite that reads the vector files off disk.
//
// ⚠ THIS FILE MUST LIVE UNDER `lib/**`. vitest.config.ts:17 includes only colocated
// `lib/**/*.test.ts`, so a Stage-1 suite placed anywhere else SILENTLY DOES NOT RUN.

// ── the shared contract ────────────────────────────────────────────────────────
//
// These tests read `roulette/vectors/stage1-pick.json` AT RUNTIME. No value is ever transcribed
// into a TypeScript literal: a hard-coded copy greens on the day the vector is regenerated and
// silently stops testing the contract. `npm test` runs with cwd = the repo root.

const VECTOR_PATH = path.join(process.cwd(), 'roulette', 'vectors', 'stage1-pick.json');

interface VectorAward {
  deciding_stat: string;
  class: string;
  direction: string;
  floor_rounds: number;
  floor_kills: number;
  // ⭐ ADDED BY STORY 6.5, ALL THREE OPTIONAL AND NULLABLE. The fourteen pre-6.5 rows carry none of
  // them and must keep not carrying them — an absent key IS an absent rung, which is the loader
  // rule `ladder.test.ts` pins by name.
  secondary_stat?: string | null;
  eff_num_key?: string | null;
  eff_den_key?: string | null;
}

interface VectorCandidate {
  award_id: string;
  priority: number;
  award: VectorAward;
}

type VectorStat = string | { num: string; den: string };

interface VectorPlayer {
  steamid64: string;
  rounds_played: string;
  kills: string;
  idle_dq: boolean;
  stats_int: {
    volume: Record<string, string>;
    rate: Record<string, { num: string; den: string }>;
    // ⭐ ADDED BY STORY 6.5 AND OPTIONAL: a row that INJECTS a ladder carries the four FR-29 blocks
    // its rungs read, while the pre-6.5 rows carry none of them and load with empty containers —
    // which is correct, because nothing on a no-ladder path ever consults them.
    secondary?: Record<string, VectorStat>;
    efficiency?: Record<string, { num: string; den: string }>;
  };
  h2h?: Record<string, Record<string, VectorStat>>;
  achievement_ts?: string;
}

interface VectorDraw {
  n: number;
  r: number;
  bytes_consumed_after: number;
}

interface VectorExpected {
  weights: number[];
  total_weight: number;
  draws: VectorDraw[];
  live: string[];
}

interface LabelSource {
  kind: string;
  spin?: number;
}

interface VectorCase {
  name: string;
  note: string;
  seed_hex: string;
  label: string;
  label_source: LabelSource;
  weight_table: number[];
  // ⭐ OPTIONAL: `an-omitted-shelf-key-is-the-empty-shelf` has no `shelf` key at all. That absence
  // IS the input under test — an absent container must mean what Go's nil map means, or the
  // producer and the verifier disagree about a state neither would report.
  shelf?: Record<string, number>;
  live_count: number;
  candidates: VectorCandidate[];
  players: VectorPlayer[];
  expected: VectorExpected;
  /** Absent on every pre-6.5 row, which IS the no-ladder contract. */
  ladder?: boolean;
}

interface VectorRefusal {
  why: string;
  refusal_kind: string;
  detail: string;
  seed_hex: string;
  label: string;
  label_source: LabelSource;
  weight_table: number[];
  shelf: Record<string, number>;
  live_count: number;
  candidates: VectorCandidate[];
  players: VectorPlayer[];
  /** Absent on every pre-6.5 row, which IS the no-ladder contract. */
  ladder?: boolean;
}

const vector = JSON.parse(readFileSync(VECTOR_PATH, 'utf8')) as {
  vector: string;
  algo_version: string;
  refusal_kinds: string[];
  refusal_details: string[];
  refusals: VectorRefusal[];
  cases: VectorCase[];
};

/**
 * Parse one vector magnitude, shape-checked BEFORE `BigInt` sees it — the same guard
 * `stage2.test.ts` uses and for the same reason: `BigInt('')` is `0n` and `BigInt('0x10')` is
 * `16n`, while Go's `SetString(s, 10)` refuses both, so a drifted vector would become a silently
 * different number here and a named failure there.
 */
function big(what: string, s: string): bigint {
  if (!/^-?[0-9]+$/.test(s)) {
    throw new Error(`vector carries a non-decimal magnitude for ${what}: ${JSON.stringify(s)}`);
  }
  return BigInt(s);
}

function toAward(a: VectorAward): Award {
  return {
    decidingStat: a.deciding_stat,
    class: a.class as Award['class'],
    direction: a.direction as Award['direction'],
    floorRounds: a.floor_rounds,
    floorKills: a.floor_kills,
    // ⚠ Passed through VERBATIM — `undefined` on every pre-6.5 row. Normalising here would move
    // the "absent key is an absent rung" rule out of `ladder.ts` and into the loader.
    secondaryStat: a.secondary_stat,
    effNumKey: a.eff_num_key,
    effDenKey: a.eff_den_key,
  };
}

/** A class-shaped value as the vector encodes it — branched on the JSON SHAPE, not the vocabulary. */
function toStat(what: string, v: VectorStat): StatValue {
  if (typeof v === 'string') return { class: 'volume', value: big(what, v) };
  return { class: 'rate', num: big(`${what}.num`, v.num), den: big(`${what}.den`, v.den) };
}

function toCandidates(rows: VectorCandidate[]): Stage1Candidate[] {
  return rows.map((r) => ({ awardId: r.award_id, priority: r.priority, award: toAward(r.award) }));
}

function toPlayers(rows: VectorPlayer[]): SnapshotPlayer[] {
  return rows.map((r) => {
    const volume: Record<string, bigint> = {};
    for (const [k, v] of Object.entries(r.stats_int.volume)) {
      volume[k] = big(`${r.steamid64}.volume.${k}`, v);
    }
    const rate: Record<string, { num: bigint; den: bigint }> = {};
    for (const [k, v] of Object.entries(r.stats_int.rate)) {
      rate[k] = {
        num: big(`${r.steamid64}.rate.${k}.num`, v.num),
        den: big(`${r.steamid64}.rate.${k}.den`, v.den),
      };
    }
    // ── The four FR-29 blocks, present only on the rows that inject a ladder. ─────────────────
    const secondary: Record<string, StatValue> = {};
    for (const [k, v] of Object.entries(r.stats_int.secondary ?? {})) {
      secondary[k] = toStat(`${r.steamid64}.secondary.${k}`, v);
    }
    const efficiency: Record<string, { num: bigint; den: bigint }> = {};
    for (const [k, v] of Object.entries(r.stats_int.efficiency ?? {})) {
      efficiency[k] = {
        num: big(`${r.steamid64}.efficiency.${k}.num`, v.num),
        den: big(`${r.steamid64}.efficiency.${k}.den`, v.den),
      };
    }
    const h2h: Record<string, Record<string, StatValue>> = {};
    for (const [opp, block] of Object.entries(r.h2h ?? {})) {
      const inner: Record<string, StatValue> = {};
      for (const [k, v] of Object.entries(block)) {
        inner[k] = toStat(`${r.steamid64}.h2h.${opp}.${k}`, v);
      }
      h2h[opp] = inner;
    }
    return {
      steamid64: r.steamid64,
      roundsPlayed: big(`${r.steamid64}.rounds_played`, r.rounds_played),
      kills: big(`${r.steamid64}.kills`, r.kills),
      idleDq: r.idle_dq,
      volume,
      rate,
      secondary,
      efficiency,
      h2h,
      achievementTs:
        r.achievement_ts === undefined
          ? undefined
          : big(`${r.steamid64}.achievement_ts`, r.achievement_ts),
    };
  });
}

function toInput(c: VectorCase | VectorRefusal): Stage1Input {
  return {
    candidates: toCandidates(c.candidates),
    players: toPlayers(c.players),
    shelf: c.shelf,
    table: c.weight_table,
    liveCount: c.live_count,
    // ⭐ INJECTED ONLY WHEN THE ROW SAYS SO. An absent `ladder` is the 6-4b contract — a tie refuses
    // — and that is the state all fourteen pre-6.5 rows are in, which is what keeps every one of
    // gate 3's eighteen refusal rows valid.
    ladder: c.ladder === true ? fr29Ladder : undefined,
  };
}

/**
 * Rebuild the case's label from `label_source` with this package's OWN generator and cross-check
 * it against the label the vector carries, then open the stream.
 *
 * ⭐ Without this a suite only ever CONSUMES `label` as an opaque string, and the 6.3 mutation
 * pass proved that gap real: bumping the `v1` prefix and making the spin 0-based BOTH passed the
 * vector-driven test until `label_source` existed.
 */
async function openStream(row: { seed_hex: string; label: string; label_source: LabelSource }): Promise<Stream> {
  let built: string;
  if (row.label_source.kind === 'pity') {
    built = PITY_LABEL;
  } else if (row.label_source.kind === 'stage1') {
    built = stage1Label(row.label_source.spin as number);
  } else {
    throw new Error(`unknown label_source kind ${JSON.stringify(row.label_source.kind)}`);
  }
  expect(built, 'the label rebuilt from label_source must match the one the vector carries').toBe(
    row.label,
  );
  return createStream(decodeSeedHex(row.seed_hex), built);
}

// ⭐ THE CASE-NAME SET IS PINNED BY EXACT EQUALITY, mirroring `stage2.test.ts` and the Go suite.
// The 6-4a code review measured why a `length > 0` check is not enough: five DECISION-E scope
// rows could be deleted from `stage2-resolve.json` with every coverage flag still satisfied by
// surviving rows and both suites green. The hazard is sharper here, because this file's single
// most valuable row — `r-lands-exactly-on-a-cumulative-boundary` — is the ONLY row where `r` sits
// exactly on a cumulative boundary, so deleting it would leave `cum > r` versus `cum >= r`
// untested while twelve other rows kept passing.
const CASE_NAMES = [
  // ⭐ Story 6.5 appended two rows, and adding them here is the deliberate update this pin asks
  // for. They are the only rows in the file that INJECT a ladder.
  'a-SHARED-co-winner-shelf-is-CLAMPED-to-table_max-after-the-minimum',
  'a-SHARED-co-winner-weights-at-the-MINIMUM-shelf',
  'an-absent-shelf-map-is-shelf-zero-for-everyone',
  'an-injected-ladder-RESOLVES-a-tie-that-would-otherwise-refuse',
  'an-omitted-shelf-key-is-the-empty-shelf',
  'candidates-supplied-out-of-priority-order',
  'every-candidate-has-no-eligible-players-and-weights-heaviest',
  'heaviest-weighted-candidate-is-not-the-one-drawn',
  'live-count-2-redraws-against-the-recomputed-total',
  'live-count-equal-to-the-whole-pool-drains-it-in-draw-order',
  'min-and-rate-candidates-resolve-through-the-real-stage-2',
  'no-awardable-value-weights-as-an-empty-shelf',
  'r-lands-exactly-on-a-cumulative-boundary',
  'shelf-to-weight-mapping-with-clamp-and-empty-shelf',
  'single-candidate-pool-still-draws-and-consumes-a-byte',
  'the-shelf-is-frozen-across-the-picks-of-one-spin',
  'total-weight-one-is-the-only-zero-byte-draw',
];

describe('stage1-pick.json conformance — §9.6 GATE 3', () => {
  it('loaded the right file, with cases and refusals', () => {
    expect(vector.vector).toBe('stage1-pick');
    expect(vector.cases.length).toBeGreaterThan(0);
    expect(vector.refusals.length).toBeGreaterThan(0);
    // epics.md:1164 fixes it and 6.3's review already corrected it once.
    expect(vector.algo_version).toBe('inclusivcup-roulette-1.0.0');
  });

  it('carries exactly the expected case set', () => {
    expect(vector.cases.map((c) => c.name).sort()).toEqual([...CASE_NAMES].sort());
  });

  it.each(vector.cases.map((c) => [c.name, c] as const))('%s', async (_name, c) => {
    const stream = await openStream(c);
    // A fresh stream starts at 0 — otherwise every byte assertion below is relative to an
    // unknown origin.
    expect(stream.consumed).toBe(0);

    const got = await stage1Pick(stream, toInput(c));

    // ⭐ THE WEIGHTS ARE AS LOAD-BEARING AS THE PICK. A vector asserting only the winner would let
    // a wrong shelf lookup pass on every case where it happened to draw the same award anyway —
    // and eight of the thirteen rows here would do exactly that.
    expect(got.weights, `${c.name}: weights (ASCENDING PRIORITY order) — ${c.note}`).toEqual(
      c.expected.weights,
    );
    // Pinned separately from the draws so a summation bug is its own failure.
    expect(got.totalWeight, `${c.name}: total_weight`).toBe(c.expected.total_weight);

    expect(got.draws.length, `${c.name}: draw count must equal live_count`).toBe(
      c.expected.draws.length,
    );
    for (let i = 0; i < c.expected.draws.length; i++) {
      const want = c.expected.draws[i] as VectorDraw;
      const d = got.draws[i];
      // W4 — `n` is the RECOMPUTED total for this pick.
      expect(d?.n, `${c.name}: draw ${String(i + 1)} n`).toBe(want.n);
      expect(d?.r, `${c.name}: draw ${String(i + 1)} r`).toBe(want.r);
      // ⭐ THE BYTE ACCOUNTING IS THE CONTRACT. It is the only externally visible proof that this
      // verifier and the Go producer walked the same stream, and the only way a rejection inside
      // uniformInt is observable at all.
      expect(
        d?.consumedAfter,
        `${c.name}: draw ${String(i + 1)} bytes_consumed_after — the two runtimes are no longer on the same byte`,
      ).toBe(want.bytes_consumed_after);
    }
    // …and the stream really is where the last draw said it was.
    const last = c.expected.draws[c.expected.draws.length - 1];
    if (last !== undefined) expect(stream.consumed).toBe(last.bytes_consumed_after);

    // ⭐ COMPARED POSITIONALLY, not as a set: `live` is in DRAW order, which is the REVEAL order.
    // A selector returning the right awards sorted by priority would pass a set comparison and
    // ship the wrong reveal order to 6.10.
    expect(got.live, `${c.name}: live (DRAW order) — ${c.note}`).toEqual(c.expected.live);
    expect(got.live.length, 'never a short return').toBe(c.live_count);

    // stage1Weights must agree with the weights stage1Pick used.
    //
    // ⚠ THERE IS NO "IT DREW NOTHING" ASSERTION HERE, DELIBERATELY. There used to be one: it
    // opened a fresh stream and checked `consumed === 0` afterwards. The 6-4b code review found it
    // TAUTOLOGICAL in both suites — `stage1Weights` takes no stream and has no way to reach that
    // object, so the check could not fail for any implementation, including one rewritten to
    // consume a stream. The property is real, but it is a SIGNATURE property the type system
    // already enforces, not something a runtime assertion can witness. A test that cannot fail is
    // worse than no test: it reads as coverage.
    expect(stage1Weights(toInput(c))).toEqual(c.expected.weights);
  });

  // ⭐ THE OUTCOME MUST NOT DEPEND ON THE ORDER THE CANDIDATES ARRIVE IN (W2), driven over EVERY
  // case rather than relying on the one fixture that happens to be shuffled.
  it.each(vector.cases.map((c) => [c.name, c] as const))(
    'is invariant under candidate permutation: %s',
    async (_name, c) => {
      const input = toInput(c);
      const reversed: Stage1Input = { ...input, candidates: [...input.candidates].reverse() };
      const got = await stage1Pick(await openStream(c), reversed);
      expect(got.weights).toEqual(c.expected.weights);
      expect(got.live).toEqual(c.expected.live);
    },
  );

  it('does not reorder the caller array', async () => {
    const c = vector.cases[0] as VectorCase;
    const input = toInput(c);
    const before = input.candidates.map((x) => x.awardId);
    await stage1Pick(await openStream(c), input);
    expect(input.candidates.map((x) => x.awardId)).toEqual(before);
  });
});

// ── the shared refusal list ────────────────────────────────────────────────────

// ⭐⭐ STAGE 1's TWO `internal` PORT GUARDS, DRIVEN AT LAST — BY A STUB `Ladder` (Story 6-5b, T10).
//
// Both suites injected either the REAL `fr29Ladder` or nothing at all, so the two guards on the
// LADDER'S OWN OUTPUT were unreachable from any test in either language: `validateLadder` refuses an
// empty tied member and `bestSurvivors` refuses an empty best set, so the shipped ladder cannot
// produce either shape. But `Ladder` is an INJECTED PORT — 6.6 drives it, 6.9's verifier
// reimplements it, and a third-party or mock implementation reaches exactly these two arms. That is
// the whole reason the guards were written; nothing exercised them.
//
//   - `{shared, winners: []}` — a trophy awarded to NOBODY. Without the guard `winners[0]` reads
//     `undefined` here and PANICS in Go: one input, two failure kinds across the seam.
//   - `{winner, steamid64: ''}` — the empty id misses the shelf map and silently draws INDEX 0, the
//     HEAVIEST luck weight. A plausible number, nothing red.
//
// ⚠ LOCAL rows, not vector rows, and deliberately so: a stub port is not a set of INPUTS, so no row
// in `stage1-pick.json` can carry one — the same reason `internal` is declared and not
// row-representable in the first place.
describe('an INJECTED ladder port that returns a malformed outcome is refused as `internal`', () => {
  const tie: SnapshotPlayer[] = [
    {
      steamid64: '76561198000000011',
      roundsPlayed: 30n,
      kills: 20n,
      idleDq: false,
      volume: { knife_kills: 7n },
      rate: {},
    },
    {
      steamid64: '76561198000000022',
      roundsPlayed: 30n,
      kills: 20n,
      idleDq: false,
      volume: { knife_kills: 7n },
      rate: {},
    },
  ];
  const candidate: Stage1Candidate = {
    awardId: 'aw-knife',
    priority: 1,
    award: {
      decidingStat: 'knife_kills',
      class: 'volume',
      direction: 'max',
      floorRounds: 0,
      floorKills: 0,
    },
  };
  const stub = (out: Outcome): Ladder => ({ resolve: () => out });
  const run = (ladder: Ladder): number[] =>
    stage1Weights({
      candidates: [candidate],
      players: tie,
      shelf: { '76561198000000022': 1 },
      table: [100, 40, 16, 6, 2, 1],
      liveCount: 1,
      ladder,
    });

  it.each([
    ['a SHARED outcome with ZERO winners', { kind: 'shared', winners: [], ladderExitStep: 5 }],
    ['a WINNER outcome with an EMPTY steamid64', { kind: 'winner', steamid64: '', ladderExitStep: 4 }],
    // ⛔⛔ THE THIRD MALFORMED SHAPE, AND THE ONE THIS LIST STOPPED ONE ELEMENT SHORT OF. The
    // `winner` arm's comment has claimed to be "symmetric with the shared arm's empty-winners
    // guard" since 6-4b; it was not — the shared arm checked only that the ARRAY was non-empty, so
    // an empty id among genuine co-winners went to `shelfOf('')`, returned 0 by the documented
    // absent-is-shelf-0 rule, and `min` made 0 the index for the WHOLE co-win: `table[0] = 100`,
    // the HEAVIEST luck weight. `min` is why this is worse than the single-winner case — one
    // malformed id poisons the aggregate regardless of the other co-winners' real shelves.
    // ⚠ The OTHER co-winner here holds shelf 1, so without the guard this returns a plausible
    // `[100]` rather than the `[40]` the real shelf implies, and nothing is red.
    // (Story 6-5b code review, 2026-08-06; Cuatro authorised the source edit at review.)
    [
      'a SHARED outcome with an EMPTY steamid64 among real co-winners',
      { kind: 'shared', winners: ['', '76561198000000022'], ladderExitStep: 5 },
    ],
  ] as const)('refuses %s', (_name, out) => {
    let thrown: unknown;
    try {
      run(stub(out as unknown as Outcome));
    } catch (err) {
      thrown = err;
    }
    expect(thrown, 'Stage 1 accepted a malformed ladder outcome').toBeInstanceOf(Stage1Error);
    expect((thrown as Stage1Error).detail).toBe('internal');
  });

  // ⭐ THE CONTROL. A stub returning a WELL-FORMED outcome must be ACCEPTED, or the two assertions
  // above would pass for a stub that is simply never consulted — the vacuity this pass exists to
  // close. Shelf 1 indexes table[1] = 40, so the number also proves the RESOLVED winner's shelf is
  // what was looked up.
  it('ACCEPTS a well-formed outcome from the same stub (the non-vacuity control)', () => {
    expect(
      run(
        stub({
          kind: 'winner',
          steamid64: '76561198000000022',
          ladderExitStep: 4,
        } as unknown as Outcome),
      ),
    ).toEqual([40]);
  });

  // ⭐ THE SHARED-ARM CONTROL, for the same reason: without it the new empty-id row above could be
  // satisfied by a `shared` arm that refused EVERY co-win. A well-formed pair must still weigh at
  // the MINIMUM shelf across the co-winners — shelf 0 for the unlisted player, so table[0] = 100.
  it('ACCEPTS a well-formed SHARED outcome, weighed at the MINIMUM co-winner shelf', () => {
    expect(
      run(
        stub({
          kind: 'shared',
          winners: ['76561198000000011', '76561198000000022'],
          ladderExitStep: 5,
        } as unknown as Outcome),
      ),
    ).toEqual([100]);
  });
});

describe('stage1-pick.json refusals', () => {
  it('declares exactly the refusal kinds this module implements, and exercises both', () => {
    expect(vector.refusal_kinds).toEqual(['tie', 'invalid']);
    for (const kind of vector.refusal_kinds) {
      expect(
        vector.refusals.some((r) => r.refusal_kind === kind),
        `no refusal row of kind "${kind}" — the kind is declared and never exercised`,
      ).toBe(true);
    }
    // Stage1TieError must be a Stage1Error, so one check answers "did Stage 1 refuse".
    expect(new Stage1TieError('a', ['1'], 'equal_value')).toBeInstanceOf(Stage1Error);
    expect(new Stage1TieError('a', ['1'], 'equal_value').detail).toBe('tie');
  });

  it('declares exactly the refusal DETAILS this module implements, and exercises every one', () => {
    // The vector's declared set and the module's exported set must be the same set — if they
    // drift, the two runtimes disagree about what a refusal can even be ABOUT.
    expect(vector.refusal_details).toEqual([...REFUSAL_DETAILS]);

    // ⚠ ONLY THE FIRST SEVEN ARE ROW-REPRESENTABLE. A row is a set of INPUTS, and the last two —
    // `stream` and `internal` — are not producible by any input. Before the 6-4b code review they
    // were missing from this module's declared set entirely while the module threw them anyway,
    // which made `Stage1Error.detail`'s own JSDoc false on two live paths. They are declared now,
    // and this split is what keeps "declared" from silently meaning "unreachable".
    //
    // ⭐ Story 6.5's `ladder` IS ROW-REPRESENTABLE, unlike those two: an injected ladder handed a
    // tied award whose `secondary_stat` is outside the vocabulary is a set of INPUTS, and the
    // appended refusal row is exactly that. The unrepresentable pair therefore stays exactly two,
    // and both are named rather than sliced — a slice bound is the kind of thing a later append
    // silently shifts.
    const unrepresentable = ['stream', 'internal'];
    const rowRepresentable = REFUSAL_DETAILS.filter((d) => !unrepresentable.includes(d));
    for (const detail of rowRepresentable) {
      expect(
        vector.refusals.some((r) => r.detail === detail),
        `no refusal row of detail "${detail}" — the label is declared and never exercised`,
      ).toBe(true);
    }
    for (const detail of unrepresentable) {
      expect(
        vector.refusals.some((r) => r.detail === detail),
        `a refusal row carries "${detail}", which no set of INPUTS can produce`,
      ).toBe(false);
    }
    for (const r of vector.refusals) {
      expect(r.detail, `${r.why} carries no detail`).not.toBe('');
      expect(rowRepresentable).toContain(r.detail);
    }
  });

  it('deep-freezes REFUSAL_DETAILS (Object.freeze is SHALLOW — 6.1 shipped a mutable "frozen" catalog)', () => {
    expect(Object.isFrozen(REFUSAL_DETAILS)).toBe(true);
    expect(REFUSAL_DETAILS.every((d) => typeof d === 'string')).toBe(true);
  });

  it.each(vector.refusals.map((r) => [r.why, r] as const))('refuses %s', async (_why, r) => {
    const stream = await openStream(r);
    let thrown: unknown;
    try {
      await stage1Pick(stream, toInput(r));
    } catch (err) {
      thrown = err;
    }
    expect(thrown, `${r.why}: expected a refusal`).toBeDefined();
    // ⭐ THE ERROR IS TYPED, not merely thrown. 6-4a measured the cost of the alternative: with
    // every refusal untyped, "it threw" was the only discriminator, so a mutation making
    // validation reject EVERY input left all sixteen rows passing.
    expect(thrown, `${r.why}: refusal must be a Stage1Error`).toBeInstanceOf(Stage1Error);

    // ⭐ AND THE TWO REFUSAL KINDS STAY DISTINGUISHABLE.
    if (r.refusal_kind === 'tie') {
      expect(thrown).toBeInstanceOf(Stage1TieError);
      expect((thrown as Error).message, 'the tie refusal must name Story 6.5').toContain('6.5');
      // ⭐ IT CARRIES THE TIE, not just a message: Story 6.5 must be able to read the tied set
      // and the equality without parsing English. Go's Stage1TieError carries the same three.
      const tie = thrown as Stage1TieError;
      expect(tie.tied.length).toBeGreaterThanOrEqual(2);
      expect(tie.awardId).not.toBe('');
      expect(tie.reason).not.toBe('');
    } else if (r.refusal_kind === 'invalid') {
      expect(thrown).not.toBeInstanceOf(Stage1TieError);
    } else {
      throw new Error(`the vector declares a refusal_kind this suite does not check: ${r.refusal_kind}`);
    }

    // ⭐⭐ THE REFUSAL NAMES WHICH INPUT IT REJECTED. This is the assertion Story 6-4b's mutation
    // pass added after finding its absence cost a SURVIVOR: deleting the NEGATIVE-SHELF guard
    // still threw a Stage1Error of the right KIND here — arrived at by a NaN three functions
    // downstream — and survived the entire suite, while the same deletion made Go PANIC. With
    // `detail` the row is about the guard it names.
    expect(
      (thrown as Stage1Error).detail,
      `${r.why}: the refusal came from a different guard than the row is about`,
    ).toBe(r.detail);

    // ⛔ W7 — VALIDATION RUNS BEFORE ANY DRAW. A refusal that had consumed a byte would make the
    // stream position depend on the failure, so retrying after fixing the config would produce a
    // DIFFERENT ceremony from the same seed.
    expect(
      stream.consumed,
      `${r.why}: validation must run BEFORE the first draw`,
    ).toBe(0);
  });
});

// ── the vector must CONTAIN the rows that carry the story's weight ─────────────
//
// ⭐ GUARD THE GUARDS. 6-4a's headline review finding was that its own coverage flags were
// satisfied by rows UNRELATED to the property they named — `sawFloatDivergence` was flipped by a
// zero-denominator row, so the story's headline case could have been deleted with every gate
// green. So every check below names THE SPECIFIC ROW it claims and re-derives the property from
// that row's own data.

describe('stage1-pick.json covers the hard cases', () => {
  const byName = new Map(vector.cases.map((c) => [c.name, c]));
  const get = (name: string): VectorCase => {
    const c = byName.get(name);
    if (c === undefined) throw new Error(`the vector no longer carries the "${name}" case`);
    return c;
  };
  const ascending = (c: VectorCase): VectorCandidate[] =>
    [...c.candidates].sort((a, b) => a.priority - b.priority);
  const weightOf = (c: VectorCase, awardId: string): number =>
    c.expected.weights[ascending(c).findIndex((x) => x.award_id === awardId)] as number;

  it('W3 — exactly one row sits ON a cumulative boundary, and it drew the SECOND candidate', () => {
    const c = get('r-lands-exactly-on-a-cumulative-boundary');
    expect(c.expected.draws.length).toBe(1);
    // `r` equal to the first cumulative is the whole point: `>` gives the second candidate, `>=`
    // gives the first. Both halves are asserted — an `r` on the boundary that still picked the
    // first would mean the implementation used `>=`.
    expect(
      c.expected.draws[0]?.r,
      'it no longer sits ON the boundary, so `cum > r` versus `cum >= r` is untested by ANY row',
    ).toBe(c.expected.weights[0]);
    expect(c.expected.live).toHaveLength(1);
    expect(
      c.expected.live[0],
      'under `cum > r` the SECOND candidate must win here, or this row would pass under `>=` too',
    ).not.toBe(ascending(c)[0]?.award_id);

    // …and no OTHER row may quietly take its place: if a second row also sat on a boundary, this
    // one could be deleted and the property would survive by accident rather than by design.
    const onBoundary = vector.cases.filter(
      (x) => x.expected.draws.length > 0 && x.expected.draws[0]?.r === x.expected.weights[0],
    );
    expect(
      onBoundary.map((x) => x.name),
      'this test names ONE boundary row, so the case-name pin no longer protects what it claims',
    ).toEqual(['r-lands-exactly-on-a-cumulative-boundary']);
  });

  it('DECISION G — both halves, and they genuinely differ in BYTES', () => {
    const one = get('single-candidate-pool-still-draws-and-consumes-a-byte');
    expect(one.candidates).toHaveLength(1);
    expect(one.expected.draws[0]?.n, 'a one-candidate pool draws over total_weight').toBeGreaterThan(1);
    expect(
      one.expected.draws[0]?.bytes_consumed_after,
      'a one-candidate pool of weight > 1 STILL moves the stream',
    ).toBeGreaterThan(0);

    const zero = get('total-weight-one-is-the-only-zero-byte-draw');
    expect(zero.expected.total_weight).toBe(1);
    expect(zero.expected.draws[0]?.n).toBe(1);
    expect(
      zero.expected.draws[0]?.bytes_consumed_after,
      "E1's zero-byte draw must arise from total_weight == 1, never from the pool SIZE",
    ).toBe(0);
  });

  it('W4 — the re-draw runs over the RECOMPUTED total and really consumed more bytes', () => {
    const c = get('live-count-2-redraws-against-the-recomputed-total');
    expect(c.expected.draws).toHaveLength(2);
    const [d0, d1] = c.expected.draws as [VectorDraw, VectorDraw];
    expect(d1.n, 're-drawing against the ORIGINAL total would leave n unchanged').toBeLessThan(d0.n);
    expect(d1.n, 'n must shrink by exactly the removed candidate’s weight').toBe(
      d0.n - weightOf(c, c.expected.live[0] as string),
    );
    expect(
      d1.bytes_consumed_after,
      'reusing the first draw’s remainder makes no second draw at all',
    ).toBeGreaterThan(d0.bytes_consumed_after);
    // …and its first draw REJECTED inside uniformInt, so a Stage-1 pick cannot assume one byte.
    expect(
      d0.bytes_consumed_after,
      'this is also the row proving a Stage-1 draw inherits rejection sampling',
    ).toBeGreaterThan(1);
  });

  it('W1 — the frozen-shelf row can actually tell frozen from recomputed', () => {
    const c = get('the-shelf-is-frozen-across-the-picks-of-one-spin');
    expect(c.expected.draws).toHaveLength(2);
    // Equal weights are what make the two behaviours distinguishable: with different weights a
    // recomputed shelf could coincidentally produce the same total.
    expect(c.expected.weights.length).toBeGreaterThanOrEqual(3);
    expect(new Set(c.expected.weights).size, 'the row needs EQUAL weights').toBe(1);

    // ⭐ …AND EQUAL WEIGHTS ARE NOT ENOUGH — that was this guard's defect. The 6-4b code review
    // found the checks here satisfied by ANY roster with real winners, so the fixture could have
    // been swapped for one where each candidate has a DIFFERENT winner and every gate would have
    // stayed green while the row silently stopped discriminating. The row only kills the
    // recomputed-shelf mutation because ONE player wins ALL of the candidates: crediting the first
    // pick to its winner is then what reweights the survivors. That is an INPUT property, so it is
    // re-derived here from the row's own players through the real Stage 2.
    const winners = new Set<string>();
    for (const cand of c.candidates) {
      const out = resolveStage2(toAward(cand.award), toPlayers(c.players));
      expect(out.kind, `${cand.award_id} must resolve to a winner for this row to test W1`).toBe(
        'winner',
      );
      if (out.kind === 'winner') winners.add(out.steamid64);
    }
    expect(
      winners.size,
      'the frozen-shelf row needs exactly ONE sweeper, or a recomputed shelf produces the same ' +
        'weights as a frozen one and the row passes under the mutation it exists to kill',
    ).toBe(1);
    expect(
      c.expected.draws[1]?.n,
      'a shelf recomputed after the first pick would reweight the survivors and draw over a smaller total',
    ).toBe((c.expected.draws[0] as VectorDraw).n - (c.expected.weights[0] as number));
  });

  it('W8 — the clamp really clamps, and the empty shelf really is heaviest', () => {
    const c = get('shelf-to-weight-mapping-with-clamp-and-empty-shelf');
    const tableMax = c.weight_table.length - 1;
    const sizes = Object.values(c.shelf);
    expect(
      sizes.some((s) => s > tableMax),
      'no shelf entry exceeds table_max — min(shelf, table_max) is untested',
    ).toBe(true);
    expect(
      sizes.some((s) => s > 0 && s < tableMax),
      'no shelf entry sits mid-table — only 0 and the clamp are exercised',
    ).toBe(true);
    expect(c.expected.weights, 'the empty shelf must reach the heaviest entry').toContain(
      c.weight_table[0],
    );
    expect(c.expected.weights, "the clamp's RESULT must reach the lightest entry").toContain(
      c.weight_table[tableMax],
    );
    // …and at least one candidate's winner must be ABSENT from the shelf map entirely — the
    // first-spin shape, and the branch where "a missing key is shelf 0" is exercised at all.
    expect(
      Object.keys(c.shelf).length,
      'every player is in the shelf map, so the absent-key branch is untested by this row',
    ).toBeLessThan(c.candidates.length);
  });

  it('the pick is stream-driven, not an argmax over the weights', () => {
    const c = get('heaviest-weighted-candidate-is-not-the-one-drawn');
    expect(
      weightOf(c, c.expected.live[0] as string),
      'an implementation that ignored the stream and returned the max-weight candidate would pass every other row',
    ).not.toBe(Math.max(...c.expected.weights));
  });

  it('W2 — the out-of-order row really is supplied out of order', () => {
    const c = get('candidates-supplied-out-of-priority-order');
    const supplied = c.candidates.map((x) => x.priority);
    expect(
      supplied.every((p, i) => i === 0 || p >= (supplied[i - 1] as number)),
      "the selector's own sort is not exercised by this row",
    ).toBe(false);
    // …and it must agree with the in-order row it mirrors, or it proves nothing about the sort.
    const mirror = get('heaviest-weighted-candidate-is-not-the-one-drawn');
    expect(c.expected).toEqual(mirror.expected);
  });

  it('DECISION F — both no-winner arms weight as an EMPTY shelf', () => {
    const noEligible = get('every-candidate-has-no-eligible-players-and-weights-heaviest');
    // ⭐ THE LOOP BELOW PASSES ON ZERO ITERATIONS, so the length is asserted first — the 6-4b
    // review found no suite checking it, so an empty `weights` would have left this arm unasserted
    // with both suites green.
    expect(noEligible.expected.weights.length).toBeGreaterThanOrEqual(2);
    for (const w of noEligible.expected.weights) {
      expect(w, 'a no-winner outcome gets the maximal EMPTY shelf').toBe(noEligible.weight_table[0]);
    }
    // ⭐ …and the OUTCOME KIND the row is NAMED for is re-derived from its own inputs. "every
    // weight is table[0]" is equally true of a roster whose players simply WIN with an empty
    // shelf, so without this the `no_eligible_players` branch could go untested while AC3 still
    // claimed it covered.
    for (const cand of noEligible.candidates) {
      expect(
        resolveStage2(toAward(cand.award), toPlayers(noEligible.players)).kind,
        `${cand.award_id} — the row is named for a branch it no longer exercises`,
      ).toBe('no_eligible_players');
    }
    const noAwardable = get('no-awardable-value-weights-as-an-empty-shelf');
    expect(noAwardable.expected.weights).toContain(noAwardable.weight_table[0]);
    expect(
      resolveStage2(toAward(noAwardable.candidates[0]!.award), toPlayers(noAwardable.players)).kind,
      'the no_awardable_value row must actually produce a no_awardable_value outcome',
    ).toBe('no_awardable_value');
    // …and it must NOT be all-heaviest, or it could not distinguish DECISION F's no-winner arm
    // from an ordinary resolution.
    expect(new Set(noAwardable.expected.weights).size).toBeGreaterThan(1);
  });

  it('W6 — the upper edge is exercised, and `live` is genuinely in DRAW order somewhere', () => {
    const drain = get('live-count-equal-to-the-whole-pool-drains-it-in-draw-order');
    expect(drain.live_count).toBe(drain.candidates.length);
    expect(drain.live_count).toBeGreaterThan(1);

    // ⭐ "live is in DRAW order" IS CARRIED BY A NAMED ROW, not by an any-row scan.
    //
    // This used to be `vector.cases.some(...)`. The 6-4b code review found two faults. First, the
    // draining row's own note claimed to be that row and is not — its draw order IS 1,2,3,4, so it
    // never discriminated. Second, an any-row scan is exactly the "flag satisfied by a row
    // unrelated to the property it names" shape 6-4a's headline finding was about: if the row that
    // really carries the property ever landed in priority order, the flag would go vacuous while
    // the case-name pin stayed green. So the row is named, and the scan now asserts it is the ONLY
    // one — which is what makes deleting it impossible to do quietly.
    const prio = (c: VectorCase, id: string): number =>
      c.candidates.find((x) => x.award_id === id)?.priority ?? 0;
    const inPriorityOrder = (c: VectorCase): boolean =>
      !c.expected.live.some(
        (id, i) => i > 0 && prio(c, id) < prio(c, c.expected.live[i - 1] as string),
      );

    const drawOrderRow = get('live-count-2-redraws-against-the-recomputed-total');
    expect(drawOrderRow.expected.live.length).toBeGreaterThan(1);
    expect(
      inPriorityOrder(drawOrderRow),
      'the re-draw row is the row that proves `live` is in DRAW order — if its picks come out in ' +
        'priority order, a selector that sorted its output would pass every row in the file',
    ).toBe(false);

    const differing = vector.cases.filter(
      (c) => c.expected.live.length > 1 && !inPriorityOrder(c),
    ).length;
    expect(
      differing,
      'this test names ONE row as the carrier — if another appears, the case-name pin no longer ' +
        'protects the property it claims',
    ).toBe(1);

    // ⚠ The draining row is NOT that row: its four picks come out in priority order by chance.
    // Asserted so nobody restores the note that used to claim otherwise.
    expect(inPriorityOrder(drain)).toBe(true);
  });
});

// ── W1/W3/W5/W9/W10 as direct assertions, independent of the vector ───────────
//
// The vector proves the two runtimes agree. These prove the RULE, over inputs chosen to make one
// specific mutation fail — so a rule with no vector row still cannot rot silently.

const REAL_SEED_HEX = '1b3cd6782e42655756e3ff1a966dbda04c7e07c4708608dcb214b8815db3279c';

function player(steamid64: string, vol: Record<string, bigint>, rounds = 30n, kills = 20n): SnapshotPlayer {
  return {
    steamid64,
    roundsPlayed: rounds,
    kills,
    idleDq: false,
    volume: { ...vol, kills, rounds_played: rounds },
    rate: {},
  };
}

const volumeAward = (stat: string): Award => ({
  decidingStat: stat,
  class: 'volume',
  direction: 'max',
  floorRounds: 0,
  floorKills: 0,
});

async function realStream(spin = 1): Promise<Stream> {
  return createStream(decodeSeedHex(REAL_SEED_HEX), stage1Label(spin));
}

describe('W3 — the cumulative walk is STRICTLY greater', () => {
  it('maps every r in [0, 5) to exactly one candidate under weights [3, 2]', async () => {
    // r in {0,1,2} is the first candidate's share, {3,4} is the second's. Under `cum >= r` the
    // boundary r = 3 would go to the first instead, handing it 4/5 of the mass.
    const input: Stage1Input = {
      candidates: [
        { awardId: 'first', priority: 1, award: volumeAward('knife_kills') },
        { awardId: 'second', priority: 2, award: volumeAward('hs_kills') },
      ],
      players: [
        player('10', { knife_kills: 5n, hs_kills: 1n }),
        player('20', { knife_kills: 1n, hs_kills: 5n }),
      ],
      shelf: { '20': 1 },
      table: [3, 2],
      liveCount: 1,
    };
    expect(stage1Weights(input)).toEqual([3, 2]);

    // The walk is exercised at every r without hunting for a seed whose draw lands there.
    const walk = (weights: number[], r: number): string => {
      let cum = 0;
      for (let i = 0; i < weights.length; i++) {
        cum += weights[i] as number;
        if (cum > r) return i === 0 ? 'first' : 'second';
      }
      return 'none';
    };
    for (let r = 0; r < 5; r++) {
      expect(walk([3, 2], r)).toBe(r >= 3 ? 'second' : 'first');
    }
  });
});

describe('W1 — the shelf is not recomputed between the picks of one spin', () => {
  it('draws the second pick over 200, not over 80', async () => {
    // One player wins all three candidates from an empty shelf, so every weight is the heaviest.
    // Frozen: the second draw runs over 200. Recomputed (crediting the first pick): over 80.
    const got = await stage1Pick(await realStream(1), {
      candidates: [
        { awardId: 'a', priority: 1, award: volumeAward('knife_kills') },
        { awardId: 'b', priority: 2, award: volumeAward('hs_kills') },
        { awardId: 'c', priority: 3, award: volumeAward('wallbang_kills') },
      ],
      players: [
        player('10', { knife_kills: 9n, hs_kills: 9n, wallbang_kills: 9n }),
        player('20', { knife_kills: 1n, hs_kills: 1n, wallbang_kills: 1n }),
      ],
      shelf: {},
      table: [100, 40, 16],
      liveCount: 2,
    });
    expect(got.weights).toEqual([100, 100, 100]);
    expect(got.draws[0]?.n).toBe(300);
    expect(
      got.draws[1]?.n,
      'a shelf recomputed after the first pick would reweight the survivors to 40 each',
    ).toBe(200);
  });
});

describe('W5 / DECISION G — there is no single-candidate short-circuit', () => {
  const only: Stage1Candidate[] = [
    { awardId: 'only', priority: 1, award: volumeAward('knife_kills') },
  ];
  const players = [player('10', { knife_kills: 5n })];

  it('a one-candidate pool of weight 100 draws n=100 and CONSUMES a byte', async () => {
    const stream = await realStream(1);
    const got = await stage1Pick(stream, {
      candidates: only,
      players,
      shelf: {},
      table: [100, 1],
      liveCount: 1,
    });
    expect(got.draws[0]?.n, 'DECISION G draws over total_weight, never over the pool size').toBe(100);
    expect(
      stream.consumed,
      'the special case DECISION G forbids — it desynchronises every later spin',
    ).toBeGreaterThan(0);
  });

  it('total_weight == 1 is the ONLY zero-byte draw', async () => {
    const stream = await realStream(1);
    const got = await stage1Pick(stream, {
      candidates: only,
      players,
      shelf: { '10': 7 },
      table: [100, 1],
      liveCount: 1,
    });
    expect(got.totalWeight).toBe(1);
    expect(got.draws[0]?.n).toBe(1);
    expect(stream.consumed).toBe(0);
  });
});

describe('W9 / DECISION F — a tie refuses; a no-winner outcome weights heaviest', () => {
  const tieInput: Stage1Input = {
    candidates: [{ awardId: 'a', priority: 1, award: volumeAward('knife_kills') }],
    players: [player('10', { knife_kills: 7n }), player('20', { knife_kills: 7n })],
    shelf: { '10': 3, '20': 0 },
    table: [100, 40, 16, 6],
    liveCount: 1,
  };

  it('refuses a tied provisional winner, naming Story 6.5', () => {
    expect(() => stage1Weights(tieInput)).toThrow(Stage1TieError);
    expect(() => stage1Weights(tieInput)).toThrow(/6\.5/);
  });

  it('invents neither the min shelf nor the byte-lex-first shelf', () => {
    // The minimum shelf over the tied set is 0 -> weight 100, and byte-lex-first is "10" ->
    // shelf 3 -> weight 6. Both are plausible answers and both are the silent argmax DECISION B
    // forbids, so NEITHER may be returned.
    let weights: number[] | undefined;
    try {
      weights = stage1Weights(tieInput);
    } catch {
      weights = undefined;
    }
    expect(weights, 'Stage 1 invented a weight for a tie that Story 6.5 would later contradict').toBeUndefined();
  });

  it('weights a no_awardable_value outcome as an EMPTY shelf', () => {
    expect(
      stage1Weights({
        ...tieInput,
        players: [player('10', { knife_kills: 0n }), player('20', { knife_kills: 0n })],
      }),
    ).toEqual([100]);
  });

  it('weights a no_eligible_players outcome as an EMPTY shelf', () => {
    expect(
      stage1Weights({
        ...tieInput,
        candidates: [
          {
            awardId: 'a',
            priority: 1,
            award: { ...volumeAward('knife_kills'), floorRounds: 24, floorKills: 20 },
          },
        ],
        players: [player('10', { knife_kills: 3n }, 10n, 6n)],
      }),
    ).toEqual([100]);
  });
});

// ⭐⭐ W10 — THE VERIFIER-ONLY DIVERGENCE. Go is synchronous and cannot exhibit this at all, so
// these are the only tests in either language that can. They matter because the failure is
// INVISIBLE to `consumed`: the 6.3 review measured a corrupt interleaved run reporting the same
// byte position as the correct one, so the whole vector suite is structurally blind to it.
describe('W10 — stage1Pick awaits its draws sequentially', () => {
  const input: Stage1Input = {
    candidates: [
      { awardId: 'a', priority: 1, award: volumeAward('knife_kills') },
      { awardId: 'b', priority: 2, award: volumeAward('hs_kills') },
      { awardId: 'c', priority: 3, award: volumeAward('wallbang_kills') },
    ],
    players: [
      player('10', { knife_kills: 9n, hs_kills: 1n, wallbang_kills: 1n }),
      player('20', { knife_kills: 1n, hs_kills: 9n, wallbang_kills: 9n }),
    ],
    shelf: {},
    table: [100, 40, 16],
    liveCount: 3,
  };

  it('a three-pick spin never trips the stream’s reentrancy guard', async () => {
    // If stage1Pick ever used Promise.all over its picks, prng.ts would THROW here — which is
    // exactly why it throws rather than queueing (6.3 review decision): queueing would let this
    // pass while silently producing a different-but-valid-looking ceremony ordering.
    const got = await stage1Pick(await realStream(1), input);
    expect(got.live).toHaveLength(3);
    expect(new Set(got.live).size).toBe(3);
  });

  it('the guard it relies on is REAL — two overlapping picks on one stream throw', async () => {
    // The positive control. Without this, the test above passes for a module that never draws at
    // all, and "sequential" would be an untested claim about an unobserved mechanism.
    const stream = await realStream(1);
    await expect(
      Promise.all([stage1Pick(stream, input), stage1Pick(stream, input)]),
    ).rejects.toThrow(/not reentrant/);
  });

  it('is deterministic: the same seed and label reproduce the same picks and bytes', async () => {
    const a = await realStream(1);
    const b = await realStream(1);
    const ra = await stage1Pick(a, input);
    const rb = await stage1Pick(b, input);
    expect(ra).toEqual(rb);
    expect(a.consumed).toBe(b.consumed);
    // …and a DIFFERENT spin is a different stream, or the domain separation is not doing its job.
    const c = await realStream(2);
    const rc = await stage1Pick(c, input);
    expect(rc.draws[0]?.r).not.toBe(ra.draws[0]?.r);
  });
});

describe('the inputs are validated before any byte is drawn', () => {
  const players = [player('10', { knife_kills: 5n, hs_kills: 3n })];
  const a: Stage1Candidate = { awardId: 'a', priority: 1, award: volumeAward('knife_kills') };
  const b: Stage1Candidate = { awardId: 'b', priority: 2, award: volumeAward('hs_kills') };
  const base: Stage1Input = {
    candidates: [a, b],
    players,
    shelf: {},
    table: [100, 40, 16],
    liveCount: 1,
  };

  // ⭐ EVERY ROW DECLARES THE `detail` IT EXPECTS, and that is not decoration.
  //
  // This table used to assert only `rejects.toThrow(Stage1Error)` plus `consumed === 0`, and the
  // 6-4b code review found two rows surviving deletion of the guard they name. Delete
  // `Number.isInteger` from validateShelf and `a fractional shelf size` still throws — as
  // `total_weight`, three functions downstream, because `table[1.5]` is `undefined` and the sum
  // becomes NaN. Delete it from validateWeightTable and `a fractional weight` does the same. Both
  // stayed green: still a typed refusal, still zero bytes, refused by ACCIDENT. That is the exact
  // T18 survivor class this story closed for the SHARED rows and left open here — `detail` is what
  // distinguishes "refused by the guard that exists for this" from "refused by something else".
  it.each([
    ['an empty table', { table: [] }, 'weight_table'],
    ['a table containing 0', { table: [100, 40, 0] }, 'weight_table'],
    ['a table containing a negative', { table: [100, 40, -5] }, 'weight_table'],
    ['a non-strictly-decreasing table', { table: [100, 40, 40] }, 'weight_table'],
    ['an increasing table', { table: [1, 2, 3] }, 'weight_table'],
    ['a fractional weight', { table: [100.5, 40] }, 'weight_table'],
    ['an empty pool', { candidates: [] }, 'pool'],
    ['a duplicate award_id', { candidates: [a, { ...b, awardId: 'a' }] }, 'pool'],
    ['a duplicate priority', { candidates: [a, { ...b, priority: 1 }] }, 'pool'],
    ['a zero priority', { candidates: [{ ...a, priority: 0 }] }, 'pool'],
    ['a fractional priority', { candidates: [{ ...a, priority: 1.5 }] }, 'pool'],
    ['an empty award_id', { candidates: [{ ...a, awardId: '' }] }, 'pool'],
    ['live_count 0', { liveCount: 0 }, 'live_count'],
    ['a negative live_count', { liveCount: -1 }, 'live_count'],
    ['a fractional live_count', { liveCount: 1.5 }, 'live_count'],
    ['live_count above the pool', { liveCount: 3 }, 'live_count'],
    ['a negative shelf size', { shelf: { '10': -1 } }, 'shelf'],
    ['a fractional shelf size', { shelf: { '10': 1.5 } }, 'shelf'],
    // `null` and structurally-wrong containers are refused HERE and nowhere in the vector: Go
    // cannot express them, so they are deliberately not shared rows. An OMITTED shelf is a
    // different thing entirely and is legal — see `an-omitted-shelf-key-is-the-empty-shelf`.
    ['a null shelf', { shelf: null as unknown as Record<string, number> }, 'shelf'],
    ['an array as a shelf', { shelf: [] as unknown as Record<string, number> }, 'shelf'],
  ] as Array<[string, Partial<Stage1Input>, string]>)(
    'refuses %s without drawing, naming the guard that fired',
    async (_why, patch, detail) => {
      const stream = await realStream(1);
      let thrown: unknown;
      try {
        await stage1Pick(stream, { ...base, ...patch });
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(Stage1Error);
      expect(
        (thrown as Stage1Error).detail,
        'refused, but by a different guard than the one this row exists to exercise',
      ).toBe(detail);
      expect(stream.consumed, 'validation must run BEFORE the first draw').toBe(0);
    },
  );

  // ⛔ THE STREAM GUARD HAD NO TEST ON THIS SIDE AT ALL. Go has TestStage1PickRefusesANilStream;
  // the 6-4b review found no TypeScript counterpart, and the guard was `typeof x === 'object'`,
  // which accepts ANY non-null object — so a Stream-shaped fake (one round-tripped through JSON in
  // a 6.9 bundle, say) passed it and then died on a bare `TypeError: stream.read is not a
  // function`. It is `instanceof Stream` now, and these are the inputs that prove it.
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a plain object', {}],
    ['a Stream-shaped fake', { consumed: 0, read: 'not a function' }],
  ])('refuses %s as a stream, typed rather than as a bare TypeError', async (_why, notAStream) => {
    let thrown: unknown;
    try {
      await stage1Pick(notAStream as unknown as Stream, base);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Stage1Error);
    expect((thrown as Stage1Error).detail).toBe('stream');
  });

  it('refuses a total weight above uniformInt’s bound, before drawing', async () => {
    const stream = await realStream(1);
    await expect(
      stage1Pick(stream, { ...base, table: [4294967296, 1] }),
    ).rejects.toThrow(Stage1Error);
    expect(stream.consumed).toBe(0);
  });

  it('propagates a Stage-2 refusal as a Stage1Error carrying the original as its cause', async () => {
    const stream = await realStream(1);
    let thrown: unknown;
    try {
      await stage1Pick(stream, {
        ...base,
        candidates: [{ ...a, award: { ...volumeAward('knife_kills'), class: 'ratio' as Award['class'] } }],
      });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Stage1Error);
    expect(thrown).not.toBeInstanceOf(Stage1TieError);
    expect((thrown as { cause?: unknown }).cause, 'the original refusal must stay readable').toBeDefined();
    expect(stream.consumed).toBe(0);
  });

  it('an INHERITED shelf entry is not treated as a trophy count', () => {
    // ⛔ A bare `shelf[id]` reads through the prototype chain; `Object.hasOwn` does not. Go's map
    // has no prototype, so a shelf whose value is inherited rather than own would weight the
    // candidate at 16 here and at 100 there — a cross-language divergence on an input NEITHER
    // side would report. `Object.entries` (in validateShelf) is already own-only, so without the
    // matching guard on the READ the module would not even be self-consistent.
    const inherited = Object.create({ '10': 2 } as Record<string, number>) as Record<string, number>;
    expect(inherited['10'], 'the fixture must really inherit the entry').toBe(2);
    expect(Object.keys(inherited), 'and must own nothing').toEqual([]);

    const weights = stage1Weights({
      candidates: [{ awardId: 'a', priority: 1, award: volumeAward('knife_kills') }],
      players: [player('10', { knife_kills: 5n })],
      shelf: inherited,
      table: [100, 40, 16],
      liveCount: 1,
    });
    expect(weights, 'an inherited entry is not a shelf — the winner holds nothing').toEqual([100]);
  });
});

// ── Story 6.6, Task 5 — the luck weight table's INDEXING, in both directions ───

// ⭐⭐ FR-26's HEADLINE PROPERTY, ASSERTED AS A PROPERTY: an EMPTY shelf draws the HEAVIEST weight,
// and the weight is MONOTONE NON-INCREASING in shelf size.
//
// ⚠ IT RE-DERIVES BOTH FROM THE TABLE IT IS HANDED rather than from a transcribed literal, and the
// distinction is the whole point: the VALUES are organizer config that lives in
// `ceremony.luck_weight_table` (migration 0025 sets the column default and the pgTAP suite asserts
// its shape) precisely because this module is a browser-reachable leaf that must never seed one. A
// test that hardcoded [100, 40, 16, 6, 2, 1] would silently stop testing the day an organizer
// re-tunes the table, which is the one thing the column exists to allow.
describe('the luck weight table: shelf 0 is the heaviest, and weight is monotone in shelf size', () => {
  const WINNER = '76561198000000011';
  const RUNNER_UP = '76561198000000022';

  const spin = (table: readonly number[], shelf: number): number => {
    const weights = stage1Weights({
      candidates: [
        {
          awardId: 'aw-01',
          priority: 1,
          award: {
            decidingStat: 'knife_kills',
            class: 'volume',
            direction: 'max',
            floorRounds: 0,
            floorKills: 0,
          },
        },
      ],
      players: [
        {
          steamid64: WINNER,
          roundsPlayed: 30n,
          kills: 20n,
          idleDq: false,
          volume: { knife_kills: 9n },
          rate: {},
        },
        {
          steamid64: RUNNER_UP,
          roundsPlayed: 30n,
          kills: 20n,
          idleDq: false,
          volume: { knife_kills: 1n },
          rate: {},
        },
      ],
      shelf: { [WINNER]: shelf },
      table,
      liveCount: 1,
    });
    return weights[0] as number;
  };

  // Three legal tables of different lengths: the property must hold for EVERY table the validator
  // accepts, not for the one that happens to ship.
  for (const table of [[100, 40, 16, 6, 2, 1], [9, 4, 1], [2, 1]]) {
    it(`holds for [${table.join(', ')}]`, () => {
      // Two past the end, so the CLAMP is exercised rather than assumed.
      const weights = Array.from({ length: table.length + 2 }, (_, shelf) => spin(table, shelf));

      // ⭐ SHELF 0 => table[0] => the HEAVIEST entry. Both halves re-derived: the identity with
      // table[0], and that table[0] really is the maximum of the table it was handed.
      expect(weights[0]).toBe(table[0]);
      expect(weights[0]).toBe(Math.max(...table));

      // MONOTONE NON-INCREASING in shelf size, past the clamp included.
      for (let i = 1; i < weights.length; i += 1) {
        expect(
          weights[i] as number,
          `a fuller shelf drew MORE luck at shelf ${String(i)}`,
        ).toBeLessThanOrEqual(weights[i - 1] as number);
      }
      // …and it genuinely DECREASES somewhere, or "non-increasing" is satisfied by a constant table
      // the validator would have refused anyway.
      expect(weights[0]).not.toBe(weights[table.length - 1]);

      // The clamp: everything at or past table_max weighs the LAST entry.
      const last = table[table.length - 1];
      for (let shelf = table.length - 1; shelf < weights.length; shelf += 1) {
        expect(weights[shelf]).toBe(last);
      }
    });
  }
});

// ⭐ THE TWO ARMS `deferred-work.md:308` IS ABOUT, DRIVEN DIRECTLY — and they are LOCAL rows rather
// than vector rows for a stated reason: both are refused by a guard that runs FIRST (`validateShelf`
// refuses a negative size, `validateWeightTable` refuses an empty table), so no set of INPUTS to the
// public entry points can reach them. That is the representability rule the vector's README states,
// and faking a row would pin the validator rather than the guard.
//
// What they prevent is a DIVERGENCE, not a crash: before Story 6.6 the clamp was one-sided, so this
// input yielded `undefined as number` here — poisoning a byte-accounted draw with `NaN` and being
// refused three functions later under a DIFFERENT label — while Go PANICKED and Python read the
// table from the END. Three behaviours, no error, one contract.
describe('weightAt guards both ends of the table', () => {
  it.each([
    ['a NEGATIVE shelf index', [100, 40, 16], -1, 'shelf'],
    ['an EMPTY table has no index 0 to give the empty shelf', [], 0, 'weight_table'],
    ['an empty table with a positive index refuses the TABLE, not the shelf', [], 3, 'weight_table'],
    // ⭐ THE TWO SHAPES THE NEGATIVE-ONLY CHECK LET THROUGH, which the code review measured. `NaN < 0`
    // is FALSE and `NaN > tableMax` is FALSE, so `NaN` fell straight past both ends into `table[NaN]`
    // → `undefined as number` — the EXACT failure this function was written to close, surviving
    // inside it. A fractional index does the same via `table[1.5]`. Both are TypeScript-only: Go's
    // parameter is an `int`, so no shared row can express either and they belong here.
    ['a NaN shelf index is not a count', [100, 40, 16], Number.NaN, 'shelf'],
    ['a FRACTIONAL shelf index is not a count', [100, 40, 16], 1.5, 'shelf'],
  ] as const)('%s', (_name, table, index, detail) => {
    expect(() => weightAt(table, index)).toThrow(Stage1Error);
    try {
      weightAt(table, index);
    } catch (err) {
      expect((err as Stage1Error).detail).toBe(detail);
    }
  });

  // ⭐ THE POSITIVE CONTROL: the same function on a legal index must NOT throw, or the three cases
  // above are satisfied by a `weightAt` that refuses everything — the untyped-refusal defect 6-4a
  // measured, one level down.
  it('does not refuse a legal index, and still clamps rather than refusing past the end', () => {
    expect(weightAt([100, 40, 16], 1)).toBe(40);
    expect(weightAt([100, 40, 16], 99)).toBe(16);
  });
});
