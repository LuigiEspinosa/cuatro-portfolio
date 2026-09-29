import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { fr29Ladder } from './ladder';
import { PITY_LABEL, stage1Label } from './labels';
import { resolvePity } from './pity';
import { createStream, decodeSeedHex } from './prng';
import { stage1Pick } from './stage1';
import type { Stage1Candidate } from './stage1';
import type { Award, DecidingValue, Outcome, RatePair, SnapshotPlayer, StatValue } from './stage2';
import { resolveSpin } from './sweep';
import { ALGO_VERSION } from './verify';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * STORY 6.11 — GATE 5, THE END-TO-END CEREMONY VECTOR (FR-25 / AD-14 / AD-19)
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ⭐⭐ THIS IS THE VERIFIER HALF OF THE SEAM `worker/awards/ceremony.go:19-26` SAYS IT HAS NO PROOF
 * OF. Every stage below is already gated as a UNIT — `stage1-pick.json`, `stage2-resolve.json`,
 * `ladder-resolve.json`, `antisweep-resolve.json`, `pity-draw.json`. What no artifact in the tree
 * gated until now is the COMPOSITION: which stage runs when, what the shelf carries between spins,
 * and that pity fires exactly once after the last main spin.
 *
 * ⛔ THERE IS DELIBERATELY NO SHIPPED TypeScript ORCHESTRATOR, AND THE ORDER IS TRANSCRIBED HERE
 * INSTEAD. `lib/roulette` is the VERIFIER: it re-runs stages to check a published bundle, and
 * `verify.ts` already does that from the bundle's own spin plan. Adding a producer-side
 * `ceremony.ts` would ship a module no route imports, and would redden `prng.test.ts`'s shipped-
 * module pin for a file whose only caller is a test. So the composition below is written FROM THE
 * VECTOR'S OWN `spec` STRING — which is transcribed from SOLUTION-DESIGN §9.2 + §9.4 — and the
 * assertion is that the TypeScript STAGES, composed in that published order, reproduce the Go
 * producer's ceremony byte for byte.
 *
 * ⛔ NEVER `Promise.all` OVER THE SPINS OR THE PICKS. `prng.ts` throws on overlapping reads of one
 * stream, and `verify.ts:23-32` documents a SECOND sequential requirement — the shelf threading —
 * that a parallel map would corrupt WITHOUT tripping that throw. Every await below is sequential
 * on purpose.
 *
 * ⛔ NOTHING HERE TRANSCRIBES A VECTOR VALUE. Every expected number is read from the JSON at
 * runtime.
 */

const VECTOR_DIR = path.join(process.cwd(), 'roulette', 'vectors');
const E2E_SOURCE_FILE = 'canonical-bundle-input.json';

// ── the published projection source ───────────────────────────────────────────

interface BundlePair {
  num: string;
  den: string;
}

interface BundlePlayer {
  steamid64: string;
  rounds_played: string;
  kills: string;
  idle_dq: boolean;
  volume: Record<string, string>;
  rate: Record<string, BundlePair>;
  secondary: Record<string, string | BundlePair>;
  efficiency: Record<string, BundlePair>;
  h2h: Record<string, Record<string, string | BundlePair>>;
  achievement_ts: string;
}

interface BundleDoc {
  seed_hex: string;
  players: BundlePlayer[];
  awards: unknown[];
  luck: { weight_table: number[] };
}

// ── the vector ────────────────────────────────────────────────────────────────

interface VectorCatalogRow {
  award_id: string;
  priority: number;
  deciding_stat: string;
  class: 'volume' | 'rate';
  direction: 'max' | 'min';
  floor_rounds: number;
  floor_kills: number;
  secondary_stat: string | null;
  eff_num_key: string | null;
  eff_den_key: string | null;
}

interface VectorDraw {
  n: number;
  r: number;
  consumed_after: number;
}

interface VectorDecidingValue {
  class: 'volume' | 'rate';
  value?: string;
  num?: string;
  den?: string;
}

interface VectorResult {
  award_id: string;
  priority: number;
  kind: string;
  steamid64?: string;
  deciding_value?: VectorDecidingValue;
  winners?: string[];
  tied?: string[];
  ladder_exit_step: number;
  swept_out: string[];
  reresolved: boolean;
}

interface VectorSpin {
  spin: number;
  kind: string;
  label: string;
  pool: string[];
  live_count: number;
  weights: number[];
  total_weight: number;
  draws: VectorDraw[];
  bytes_consumed: number;
  live: string[];
  results: VectorResult[];
  assigned: string[];
}

interface VectorPity {
  label: string;
  winless: string[];
  reveal_order: string[];
  draws: { n: number; k: number; rejections: number; value: number }[];
  bytes_consumed: number;
}

interface VectorAnchors {
  main_spin_count: number;
  main_spin_bytes: number;
  pity_bytes: number;
  total_bytes: number;
  drawn_order: string[];
  winless_count: number;
  shelf_holders: number;
  max_trophies_per_player: number;
  ladder_exit_steps: number[];
  outcome_kinds: string[];
}

interface VectorCase {
  name: string;
  why: string;
  projection: {
    snapshot: string;
    snapshot_source: string;
    seed: string;
    weight_table: string;
    catalog: 'real' | 'counterfactual';
    counterfactual_fields: string[];
  };
  seed_hex: string;
  live_count: number;
  weight_table: number[];
  catalog: VectorCatalogRow[];
  expected: {
    spins: VectorSpin[];
    pity: VectorPity;
    shelf: Record<string, number>;
    anchors: VectorAnchors;
  };
}

interface EndToEndVector {
  vector: string;
  algo_version: string;
  spec: string;
  projection: string;
  source: {
    file: string;
    present: boolean;
    utf8_bytes: number;
    player_count: number;
    award_count: number;
    seed_hex: string;
    weight_table: number[];
  };
  /**
   * `deferred-work.md:347` — the winless set at each Stage-1 width, over the real snapshot and a
   * floors-ZERO catalog. Committed rather than narrated: 6.7's AC6 asked for it, the entry deferred
   * it as costing "a full 14-demo corpus rebuild", and it costs nothing of the sort.
   */
  winless_by_width: {
    live_count: number;
    main_spins: number;
    winless: string[];
    shelf_distribution: { trophies: number; players: number }[];
  }[];
  unreachable_ladder_rungs: {
    rung: number;
    why: string;
    gated_instead_by: string;
    note: string;
  }[];
  cases: VectorCase[];
}

const vector = JSON.parse(
  readFileSync(path.join(VECTOR_DIR, 'end-to-end.json'), 'utf8'),
) as EndToEndVector;

const sourceRaw = readFileSync(path.join(VECTOR_DIR, E2E_SOURCE_FILE), 'utf8');
const sourceDoc = JSON.parse(sourceRaw) as BundleDoc;

/**
 * The decimal-string guard, BEFORE `BigInt`. Every snapshot magnitude crosses the seam as a decimal
 * STRING — the split is by PROVENANCE, not by magnitude — and `BigInt('12.5')` throws a bare
 * `SyntaxError` where this throws something a reader can act on.
 */
function big(what: string, s: string): bigint {
  if (!/^-?[0-9]+$/.test(s)) {
    throw new Error(`vector carries a non-decimal magnitude for ${what}: ${JSON.stringify(s)}`);
  }
  return BigInt(s);
}

/**
 * ⭐ THE LOADER BRANCHES ON THE JSON SHAPE, NOT ON THE VOCABULARY. A volume key is published as a
 * bare decimal string and a rate key as a `{num,den}` object; consulting a 17/4 key list here would
 * put a fourth copy of 0023's split in the tree, and the shape already carries it.
 */
function statValue(where: string, v: string | BundlePair): StatValue {
  if (typeof v === 'object' && v !== null) {
    return { class: 'rate', num: big(`${where}.num`, v.num), den: big(`${where}.den`, v.den) };
  }
  return { class: 'volume', value: big(where, v) };
}

function ratePair(where: string, v: BundlePair): RatePair {
  return { num: big(`${where}.num`, v.num), den: big(`${where}.den`, v.den) };
}

function mapValues<T, U>(o: Record<string, T>, f: (v: T, k: string) => U): Record<string, U> {
  const out: Record<string, U> = {};
  for (const [k, v] of Object.entries(o)) out[k] = f(v, k);
  return out;
}

/**
 * ⭐⭐ THE CAPTURE SHAPE. DECISION AE keeps the snapshot OUT of the vector and names
 * `canonical-bundle-input.json` as the projection source, so a conformant implementation must
 * project AD-19's published integer form back into its own snapshot type — and that projection is
 * exactly what AD-19 requires this vector to test. A vector carrying pre-projected players would
 * test the orchestration and nothing about the capture.
 */
function projectPlayer(p: BundlePlayer): SnapshotPlayer {
  return {
    steamid64: p.steamid64,
    roundsPlayed: big(`${p.steamid64}.rounds_played`, p.rounds_played),
    kills: big(`${p.steamid64}.kills`, p.kills),
    idleDq: p.idle_dq,
    volume: mapValues(p.volume, (v, k) => big(`${p.steamid64}.volume.${k}`, v)),
    rate: mapValues(p.rate, (v, k) => ratePair(`${p.steamid64}.rate.${k}`, v)),
    secondary: mapValues(p.secondary, (v, k) => statValue(`${p.steamid64}.secondary.${k}`, v)),
    efficiency: mapValues(p.efficiency, (v, k) => ratePair(`${p.steamid64}.efficiency.${k}`, v)),
    h2h: mapValues(p.h2h, (blk, opp) =>
      mapValues(blk, (v, k) => statValue(`${p.steamid64}.h2h[${opp}].${k}`, v)),
    ),
    achievementTs: big(`${p.steamid64}.achievement_ts`, p.achievement_ts),
  } as SnapshotPlayer;
}

const PLAYERS: readonly SnapshotPlayer[] = sourceDoc.players.map(projectPlayer);

/** A published catalog row -> the `Award` the resolvers consume. An absent rung key is `null` in
 * the JSON and must reach the resolver as an ABSENT key, never as the string "null". */
function toAward(r: VectorCatalogRow): Award {
  return {
    decidingStat: r.deciding_stat,
    class: r.class,
    direction: r.direction,
    floorRounds: r.floor_rounds,
    floorKills: r.floor_kills,
    secondaryStat: r.secondary_stat,
    effNumKey: r.eff_num_key,
    effDenKey: r.eff_den_key,
  } as Award;
}

function toCatalog(rows: readonly VectorCatalogRow[]): Stage1Candidate[] {
  return rows.map((r) => ({ awardId: r.award_id, priority: r.priority, award: toAward(r) }));
}

interface RanSpin {
  spin: number;
  label: string;
  pool: string[];
  liveCount: number;
  weights: readonly number[];
  totalWeight: number;
  draws: readonly { n: number; r: number; consumedAfter: number }[];
  bytesConsumed: number;
  live: readonly string[];
  results: readonly { awardId: string; priority: number; outcome: Outcome; sweptOut: readonly string[]; reresolved: boolean }[];
  assigned: readonly string[];
}

/**
 * The ceremony, composed. Transcribed from the vector's own `spec` string (SOLUTION-DESIGN §9.2 +
 * §9.4) — see the file header for why this lives in the test rather than in a shipped module.
 */
async function runCeremony(tc: VectorCase): Promise<{
  spins: RanSpin[];
  pity: Awaited<ReturnType<typeof resolvePity>>;
  shelf: Record<string, number>;
}> {
  const seed = decodeSeedHex(tc.seed_hex);
  const catalog = toCatalog(tc.catalog).sort((a, b) => a.priority - b.priority);
  const shelf: Record<string, number> = {};
  const revealed = new Set<string>();
  const spins: RanSpin[] = [];
  let spinNo = 0;

  while (revealed.size < catalog.length) {
    spinNo += 1;
    const pool = catalog.filter((c) => !revealed.has(c.awardId));
    const label = stage1Label(spinNo);
    const stream = await createStream(seed, label);
    const width = Math.min(tc.live_count, pool.length);

    // ⛔ SEQUENTIAL. `stage1Pick` makes `width` draws on ONE stream and `prng.ts` throws on
    // overlapping reads; the shelf threading below is the second reason.
    const pick = await stage1Pick(stream, {
      candidates: pool,
      players: PLAYERS,
      shelf,
      table: tc.weight_table,
      liveCount: width,
      ladder: fr29Ladder,
    });
    for (const id of pick.live) revealed.add(id);

    const live = catalog.filter((c) => pick.live.includes(c.awardId));
    const sweep = resolveSpin(live, PLAYERS, fr29Ladder);
    // Co-winners all count (§9.4); the shelf advances by exactly one per player per spin.
    for (const sid of sweep.assigned) shelf[sid] = (shelf[sid] ?? 0) + 1;

    spins.push({
      spin: spinNo,
      label,
      pool: pool.map((c) => c.awardId),
      liveCount: width,
      weights: pick.weights,
      totalWeight: pick.totalWeight,
      draws: pick.draws,
      bytesConsumed: stream.consumed,
      live: pick.live,
      results: sweep.results.map((r) => ({
        awardId: r.awardId,
        priority: r.priority,
        outcome: r.outcome,
        sweptOut: r.sweptOut,
        reresolved: r.reresolved,
      })),
      assigned: sweep.assigned,
    });
  }

  const pityStream = await createStream(seed, PITY_LABEL);
  const pity = await resolvePity({ players: PLAYERS, shelf, stream: pityStream });
  return { spins, pity, shelf };
}

// ══ THE GATE ══════════════════════════════════════════════════════════════════

describe('gate 5 — the end-to-end ceremony vector', () => {
  it('loads the vector it claims to', () => {
    expect(vector.vector).toBe('end-to-end');
    expect(vector.algo_version).toBe(ALGO_VERSION);
    expect(vector.source.present).toBe(true);
    expect(vector.source.file).toBe(E2E_SOURCE_FILE);
    // ⛔ NON-VACUITY. An empty `cases` array would make every assertion in this file run zero times,
    // which is this project's most-recorded failure shape.
    expect(vector.cases.length).toBeGreaterThanOrEqual(2);
  });

  it('projects from the committed real snapshot, at its exact byte length', () => {
    // ⭐⭐ AC4's 75,013-BYTE TRIPWIRE. A wholesale corpus swap produces a SELF-CONSISTENT set of
    // vectors with a different hash and `--check` reports OK on all nine; this length is one of the
    // two assertions standing in the way. ⛔ `bundle_sha256` is deliberately NOT asserted — it moves
    // on every rebuild because `achievement_ts` is wall-clock approval time (DECISION AC).
    expect(Buffer.byteLength(sourceRaw, 'utf8')).toBe(vector.source.utf8_bytes);
    expect(sourceDoc.players).toHaveLength(vector.source.player_count);
    expect(sourceDoc.awards).toHaveLength(vector.source.award_count);
    expect(sourceDoc.seed_hex).toBe(vector.source.seed_hex);
    expect(sourceDoc.luck.weight_table).toEqual(vector.source.weight_table);
    expect(PLAYERS.length).toBeGreaterThan(0);
  });

  it('re-derives DECISION AF: rung 3 is unreachable because every player has ONE opponent', () => {
    const rung3 = vector.unreachable_ladder_rungs.find((u) => u.rung === 3);
    expect(rung3).toBeDefined();
    expect(rung3?.gated_instead_by).toBe('ladder-resolve.json');
    // ⭐ THE DECLARATION IS CHECKED, NOT TRUSTED. Rung 3 needs a STRICT h2h dominator over the
    // remaining survivors; with exactly one opponent each, no player can beat two others.
    for (const p of PLAYERS) {
      expect(Object.keys(p.h2h)).toHaveLength(1);
    }
  });

  for (const tc of vector.cases) {
    describe(tc.name, () => {
      it('declares its projection honestly', () => {
        // ⭐ AC3 — the projection block is DATA and is asserted rather than read past. A case that
        // quietly switched to a synthetic roster would still pass every numeric assertion below.
        expect(tc.projection.snapshot).toBe('real');
        expect(tc.projection.snapshot_source).toBe(E2E_SOURCE_FILE);

        // ⛔ `seed: 'real'` IS CHECKED ON EVERY CASE, NOT ONLY THE REAL-CATALOG ONE. Until 6.11's
        // code review the `seed_hex` comparison lived inside the `catalog === 'real'` branch, so the
        // forced run could carry an INVENTED seed while declaring the seed real — the one field a
        // reader most needs to trust, unchecked on the case that varies the most.
        expect(tc.projection.seed).toBe('real');
        expect(tc.seed_hex).toBe(sourceDoc.seed_hex);

        // ⛔ `weight_table` WAS DECLARED AND NEVER READ. Both runtimes parsed it and neither
        // asserted it, while the comment above claimed the projection block is "asserted rather than
        // read past" — one member was read past. Found at 6.11's code review.
        expect(tc.projection.weight_table).toBe('real');
        expect(tc.weight_table).toEqual(vector.source.weight_table);

        expect(['real', 'counterfactual']).toContain(tc.projection.catalog);
        if (tc.projection.catalog === 'real') {
          expect(tc.projection.counterfactual_fields).toEqual([]);
        } else {
          expect(tc.projection.counterfactual_fields.length).toBeGreaterThan(0);
          // ⭐ EVERY NAMED FIELD MUST BE A REAL LEVER, RE-DERIVED FROM THE CATALOG ROWS THEMSELVES
          // rather than from a list restated here — a restated list drifts from the shape it claims
          // to describe, which is the failure this block exists to prevent.
          //
          // ⚠ `live_count` IS THE ONE DELIBERATE EXCEPTION, named rather than waved through.
          // DECISION AA says the catalog is the counterfactual lever and every field here is a
          // catalog field; `live_count` is a CEREMONY parameter. It is genuinely counterfactual (6
          // against the real ceremony's 1) and DECISION AB requires it — overflow is unreachable at
          // `live_count = 1` — so the honest record is that DECISION AA has exactly one documented
          // exception.
          const catalogFields = new Set(Object.keys(tc.catalog[0] ?? {}));
          expect(catalogFields.size, 'no catalog row to derive field names from').toBeGreaterThan(0);
          const CEREMONY_LEVER = 'live_count';
          for (const f of tc.projection.counterfactual_fields) {
            if (f === CEREMONY_LEVER) continue;
            expect(
              catalogFields,
              `counterfactual field "${f}" is neither a catalog row field nor the one declared ` +
                `ceremony lever "${CEREMONY_LEVER}"`,
            ).toContain(f);
          }
          expect(
            tc.projection.counterfactual_fields,
            `the counterfactual case runs live_count=${tc.live_count} against the real ceremony's 1, ` +
              'and an undeclared counterfactual is what the projection block exists to prevent',
          ).toContain(CEREMONY_LEVER);
        }
      });

      it('reproduces every main spin byte-for-byte', async () => {
        const run = await runCeremony(tc);
        expect(run.spins).toHaveLength(tc.expected.spins.length);

        tc.expected.spins.forEach((want, i) => {
          const got = run.spins[i];
          expect(want.kind).toBe('main');
          expect(got.spin).toBe(want.spin);
          expect(got.label).toBe(want.label);
          expect(got.pool).toEqual(want.pool);
          expect(got.liveCount).toBe(want.live_count);
          expect(got.weights).toEqual(want.weights);
          expect(got.totalWeight).toBe(want.total_weight);
          // ⛔ THE BYTE ACCOUNTING IS THE CONTRACT — measured from the stream, never re-derived.
          expect(got.bytesConsumed).toBe(want.bytes_consumed);
          expect(got.draws).toHaveLength(want.draws.length);
          want.draws.forEach((wd, j) => {
            expect(got.draws[j].n).toBe(wd.n);
            expect(got.draws[j].r).toBe(wd.r);
            expect(got.draws[j].consumedAfter).toBe(wd.consumed_after);
          });
          // ⚠ `live` is DRAW order, which is REVEAL order and deliberately NOT priority-sorted.
          expect(got.live).toEqual(want.live);
          expect(got.assigned).toEqual(want.assigned);

          expect(got.results).toHaveLength(want.results.length);
          want.results.forEach((wr, k) => {
            const gr = got.results[k];
            expect(gr.awardId).toBe(wr.award_id);
            expect(gr.priority).toBe(wr.priority);
            // ⛔ THE TYPED KIND AND THE DECLARED STEP — never message prose.
            expect(gr.outcome.kind).toBe(wr.kind);
            const step = (gr.outcome as { ladderExitStep?: number }).ladderExitStep ?? 0;
            expect(step).toBe(wr.ladder_exit_step);
            // ⭐ FACTS ABOUT THE INPUT: a vector pinning only the winner would let a pass that
            // reached the right player WITHOUT EVER REMOVING ANYONE pass every row.
            expect(gr.sweptOut).toEqual(wr.swept_out);
            expect(gr.reresolved).toBe(wr.reresolved);
            if (wr.steamid64 !== undefined) {
              expect((gr.outcome as { steamid64?: string }).steamid64).toBe(wr.steamid64);
            }
            if (wr.winners !== undefined) {
              expect((gr.outcome as { winners?: string[] }).winners).toEqual(wr.winners);
            }
            if (wr.tied !== undefined) {
              expect((gr.outcome as { tied?: string[] }).tied).toEqual(wr.tied);
            }
            // ⭐⭐ THE `deciding_value` XOR `ladder_exit_step` INVARIANT, CARRIED END-TO-END: a Stage-2
            // winner has a value and no rung; a ladder-resolved winner has a rung and no value.
            //
            // ⛔ THIS WAS A ONE-SIDED GATE UNTIL 6.11's CODE REVIEW. Go asserted it
            // (`end_to_end_test.go:530`, `assertE2EDecidingValue`); TypeScript declared
            // `VectorDecidingValue`, typed the field on `VectorResult` — and never read it. The forced
            // run carries FIVE populated `deciding_value` objects, so a TypeScript Stage 2 that
            // reached the right winner with the wrong deciding magnitude, or spelled the
            // class/num/den differently, was green on gate 5. `README.md`: "A change that greens only
            // one of them is the exact divergence this directory exists to catch."
            //
            // ⚠ MAGNITUDES ARE COMPARED AS DECIMAL STRINGS, never as numbers — these are `bigint`s and
            // the real corpus carries operands past 2^53.
            if (wr.deciding_value !== undefined) {
              const dv = (gr.outcome as { decidingValue?: DecidingValue }).decidingValue;
              expect(dv, `spin ${want.spin} ${wr.award_id} has no decidingValue`).toBeDefined();
              expect(dv?.class).toBe(wr.deciding_value.class);
              if (wr.deciding_value.class === 'volume') {
                expect((dv as { value: bigint }).value.toString()).toBe(wr.deciding_value.value);
              } else {
                expect((dv as { num: bigint }).num.toString()).toBe(wr.deciding_value.num);
                expect((dv as { den: bigint }).den.toString()).toBe(wr.deciding_value.den);
              }
            }
            // ⛔ A tie must NEVER survive to an assignment — every tie goes through the ladder.
            expect(gr.outcome.kind).not.toBe('tie');
          });
        });
      });

      it('reproduces the pity draw, both fields, and the byte total', async () => {
        const run = await runCeremony(tc);
        const w = tc.expected.pity;
        expect(w.label).toBe(PITY_LABEL);
        expect(run.pity.winless).toEqual(w.winless);
        // ⭐⭐ TWO FIELDS, NEVER ONE — publishing the canonical order as the reveal order is the
        // single most destructive thing a caller can do with this result.
        expect(run.pity.revealOrder).toEqual(w.reveal_order);
        expect(run.pity.bytesConsumed).toBe(w.bytes_consumed);
        expect(run.pity.draws).toHaveLength(w.draws.length);
        w.draws.forEach((wd, i) => {
          expect(run.pity.draws[i].n).toBe(wd.n);
          expect(run.pity.draws[i].k).toBe(wd.k);
          expect(run.pity.draws[i].rejections).toBe(wd.rejections);
          expect(run.pity.draws[i].value).toBe(wd.value);
        });
        // The multiset identity, re-derived rather than read.
        expect([...run.pity.winless].sort()).toEqual([...run.pity.revealOrder].sort());
      });

      it('threads the shelf across spins and spells "no trophies" as ABSENT', async () => {
        const run = await runCeremony(tc);
        expect(run.shelf).toEqual(tc.expected.shelf);
        // ⚠ W8's spelling: a player who won nothing is ABSENT, not present-with-zero.
        for (const [sid, n] of Object.entries(run.shelf)) {
          expect(n, `shelf carries ${sid} with an explicit 0`).toBeGreaterThan(0);
        }
      });

      it('re-derives the corpus anchors deferred-work.md:401 records as unverifiable', async () => {
        const run = await runCeremony(tc);
        const a = tc.expected.anchors;

        // ⭐⭐ THIS IS `deferred-work.md:401`, AND `verify.test.ts:2825-2828` SAID THESE WERE "NOT
        // ASSERTABLE HERE". They are now — re-derived from the run, in both runtimes, with no
        // throwaway harness and no live database.
        expect(run.spins).toHaveLength(a.main_spin_count);
        const mainBytes = run.spins.reduce((t, s) => t + s.bytesConsumed, 0);
        expect(mainBytes).toBe(a.main_spin_bytes);
        expect(run.pity.bytesConsumed).toBe(a.pity_bytes);
        expect(mainBytes + run.pity.bytesConsumed).toBe(a.total_bytes);
        expect(run.spins.flatMap((s) => [...s.live])).toEqual(a.drawn_order);
        expect(run.pity.winless).toHaveLength(a.winless_count);
        expect(Object.keys(run.shelf)).toHaveLength(a.shelf_holders);

        const trophies = Object.values(run.shelf);
        expect(trophies.length ? Math.max(...trophies) : 0).toBe(a.max_trophies_per_player);

        const steps = new Set<number>();
        const kinds = new Set<string>();
        for (const s of run.spins) {
          for (const r of s.results) {
            const step = (r.outcome as { ladderExitStep?: number }).ladderExitStep ?? 0;
            if (step) steps.add(step);
            kinds.add(r.outcome.kind);
          }
        }
        expect([...steps].sort((x, y) => x - y)).toEqual(a.ladder_exit_steps);
        expect([...kinds].sort()).toEqual(a.outcome_kinds);

        // ⭐⭐ FR-26 AS AN ACCOUNTING IDENTITY, over the WINNERS of each spin rather than trusted
        // from `assigned` — a pass that assigned a player twice and then deduplicated `assigned`
        // would satisfy every other assertion in this file.
        for (const s of run.spins) {
          const perPlayer = new Map<string, number>();
          for (const r of s.results) {
            const o = r.outcome as { kind: string; steamid64?: string; winners?: string[] };
            const winners = o.kind === 'shared' ? (o.winners ?? []) : o.kind === 'winner' ? [o.steamid64!] : [];
            for (const w of winners) perPlayer.set(w, (perPlayer.get(w) ?? 0) + 1);
          }
          for (const [sid, n] of perPlayer) {
            expect(n, `FR-26 VIOLATED: spin ${s.spin} gave ${sid} ${n} trophies`).toBe(1);
          }
        }
      });
    });
  }

  it('carries both an anchor run and a forced run (DECISION AB)', () => {
    const catalogs = vector.cases.map((c) => c.projection.catalog);
    expect(catalogs).toContain('real');
    expect(catalogs).toContain('counterfactual');
  });

  it('exercises the FR-29 rungs the forced run exists to reach', () => {
    // ⭐ THE COVERAGE GUARD, WRITTEN IN THE SAME EDIT AS THE CASE IT GUARDS (6-5b:214), and it
    // re-derives the property from the ROW'S OWN DATA rather than restating a constant: the forced
    // run must reach every rung the vector does NOT declare unreachable.
    const forced = vector.cases.find((c) => c.projection.catalog === 'counterfactual');
    expect(forced).toBeDefined();
    const unreachable = new Set(vector.unreachable_ladder_rungs.map((u) => u.rung));
    const expectedRungs = [1, 2, 3, 4, 5].filter((r) => !unreachable.has(r));
    expect(forced!.expected.anchors.ladder_exit_steps).toEqual(expectedRungs);
    // …and the anti-sweep overflow it exists to produce: at least one award re-resolved over a
    // REDUCED candidate set, which is unreachable at the anchor run's live_count of 1.
    const reresolved = forced!.expected.spins.flatMap((s) => s.results).filter((r) => r.reresolved);
    expect(reresolved.length).toBeGreaterThan(0);
    expect(forced!.live_count).toBeGreaterThanOrEqual(2);
  });

  // ⛔ THE COVERAGE GUARD FOR THE `deciding_value` ASSERTION ADDED AT 6.11's CODE REVIEW. That
  // assertion is inside `if (wr.deciding_value !== undefined)`, and a conditional over a field no row
  // carries is the vacuity shape this project has now recorded six times — it would pass forever
  // while testing nothing. This pins that the vector really does carry populated deciding values, and
  // re-derives the count from the rows themselves rather than restating a constant.
  //
  // ⭐ IT ALSO PINS THE XOR: every result with a `deciding_value` exits at rung 0 (Stage 2 decided it
  // outright) and every result at a rung > 0 has none (the ladder decided it, and the magnitude that
  // tied is no longer the answer).
  it('carries populated deciding values, and they are XOR with the ladder exit step', () => {
    const results = vector.cases.flatMap((c) => c.expected.spins.flatMap((s) => s.results));
    const withValue = results.filter((r) => r.deciding_value !== undefined);
    expect(
      withValue.length,
      'no result carries a deciding_value — the assertion in the spin loop would be vacuous',
    ).toBeGreaterThan(0);

    for (const r of withValue) {
      expect(r.ladder_exit_step, `${r.award_id} has both a deciding_value and a rung`).toBe(0);
      const dv = r.deciding_value!;
      // Magnitudes travel as decimal STRINGS (the provenance rule), never as JSON numbers.
      if (dv.class === 'volume') {
        expect(typeof dv.value).toBe('string');
      } else {
        expect(typeof dv.num).toBe('string');
        expect(typeof dv.den).toBe('string');
      }
    }
    for (const r of results.filter((r) => r.ladder_exit_step > 0)) {
      expect(r.deciding_value, `${r.award_id} exited at a rung and still carries a value`).toBeUndefined();
    }
  });
});

// ══ deferred-work.md:347 — THE WINLESS SET AT EVERY WIDTH ═════════════════════
//
// ⭐⭐ 6.7's AC6 asked for this set at all four Stage-1 widths, printed rather than inferred. The
// entry deferred it as costing "a full 14-demo corpus rebuild"; it is a pure function of the
// committed snapshot and a floors-zero catalog. Story 6.11 said exactly that in its notes and then
// left the four numbers in prose, which its code review flagged as the same evidentiary class the
// entry was raised against. The generator now emits them and both runtimes re-derive them.
//
// ⚠ THE ENTRY'S OWN REASONING WAS FALSE, WHICH IS WHY THE AC WAS RIGHT TO DEMAND THE SET. `:347`
// argued the sets were "near-certainly identical" BECAUSE the recorded shelf distributions were
// identical across widths. They are not — the distributions genuinely differ at widths 3 and 4. The
// same 19 players win nothing while the trophies distribute differently among the 9 who do.
describe('deferred-work.md:347 — the winless set does not move with Stage-1 width', () => {
  it('is identical at all four widths, and is neither everybody nor nobody', () => {
    const rows = vector.winless_by_width;
    // ⛔ NON-VACUITY FIRST — every assertion below is inside a loop or a comparison against rows[0].
    expect(rows).toHaveLength(4);

    const first = rows[0].winless;
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThan(vector.source.player_count);

    rows.forEach((row, i) => {
      expect(row.live_count).toBe(i + 1);
      expect(row.winless, `width ${row.live_count} differs from width 1`).toEqual(first);

      // ⭐ RE-DERIVED FROM THE ROW'S OWN INPUTS, never restated: each spin reveals
      // min(width, |remaining pool|) awards, so it takes ceil(awards / width) of them.
      expect(row.main_spins).toBe(Math.ceil(vector.source.award_count / row.live_count));

      // ⭐ THE ACCOUNTING IDENTITY TYING THE TWO HALVES TOGETHER: the distribution covers every
      // player exactly once, and its zero-trophy bucket IS the winless set. Without this the two
      // fields could drift into describing different runs.
      const total = row.shelf_distribution.reduce((s, b) => s + b.players, 0);
      expect(total).toBe(vector.source.player_count);
      const zeroBucket = row.shelf_distribution.find((b) => b.trophies === 0)?.players ?? 0;
      expect(zeroBucket, `width ${row.live_count}'s shelf-0 bucket is not the winless set`).toBe(
        row.winless.length,
      );
    });
  });
});

// ══ AC5 — SUITE COMPLETENESS ══════════════════════════════════════════════════
//
// ⛔ NOTHING ASSERTED THIS BEFORE. Each suite hard-codes its own path, so a vector file added,
// renamed or DELETED reddened nothing — a deleted gate is indistinguishable from one that never
// existed. This is the TypeScript twin of `TestVectorDirectoryIsComplete`; the two lists must stay
// identical, which is the point.
describe('gate 5 — suite completeness', () => {
  const EXPECTED_VECTOR_FILES = [
    'antisweep-resolve.json',
    'canonical-bundle-input.json',
    'canonical-bundle.json',
    'end-to-end.json',
    'ladder-resolve.json',
    'pity-draw.json',
    'prng-block.json',
    'prng-uniform-int.json',
    'stage1-pick.json',
    'stage2-resolve.json',
  ];

  // ⛔ `isFile()` — A DIRECTORY NAMED `*.json` MUST NOT COUNT. Go skips `e.IsDir()`; until 6.11's
  // code review this side filtered on the extension alone, so a directory ending `.json` reddened one
  // runtime and not the other — in the one pair of assertions whose stated contract is that the two
  // lists stay identical.
  const onDisk = readdirSync(VECTOR_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => e.name)
    .sort();

  it('pins the vector file set by exact equality', () => {
    // ⚠ TEN, NOT NINE: nine are `--check`-derived, and `canonical-bundle-input.json` is an INPUT —
    // deliberately outside the generator's `outputs` map, and ALSO gate 5's projection source.
    expect(onDisk).toEqual(EXPECTED_VECTOR_FILES);
  });

  // ⭐⭐ AC5 REQUIRES THE PROOF, NOT THE CLAIM — AND THE FIRST PROOF WAS ITSELF VACUOUS.
  //
  // ⛔ WHAT WAS WRONG, recorded so it is not re-introduced: the original loop compared `onDisk` (ten
  // entries) against leave-one-out lists of NINE. A ten-element array can never equal a nine-element
  // one, so `not.toEqual(shorter)` held for every `i` no matter what the names were — every iteration
  // was dead, and the "proof" could only ever have failed on cardinality. It sat directly above
  // `expect(EXPECTED_VECTOR_FILES.length).toBe(10)`, a literal checked against itself, which is
  // verbatim the shape this project's own vacuity catalogue lists (`6-5b:434`).
  //
  // ⭐ THE REPLACEMENT VARIES ONE NAME AT A TIME AT CONSTANT LENGTH, so the assertion can only pass
  // because of what the names ARE.
  it('proves the file-set assertion is name-sensitive, not merely length-sensitive', () => {
    for (let i = 0; i < EXPECTED_VECTOR_FILES.length; i++) {
      const swapped = EXPECTED_VECTOR_FILES.map((n, j) => (j === i ? 'not-a-real-vector.json' : n));
      expect(swapped).toHaveLength(onDisk.length);
      expect(
        onDisk,
        `renaming ${EXPECTED_VECTOR_FILES[i]} still matched the directory — the pin is not ` +
          'sensitive to that name, so deleting or renaming that vector would pass unnoticed',
      ).not.toEqual(swapped);
    }
  });

  it('proves the file-set assertion is length-sensitive too', () => {
    // The weaker half, kept deliberately and labelled as the weaker half: a vector ADDED or DELETED
    // changes the count, and that must redden independently of any name.
    for (let i = 0; i < EXPECTED_VECTOR_FILES.length; i++) {
      const shorter = EXPECTED_VECTOR_FILES.filter((_, j) => j !== i);
      expect(onDisk, `removing ${EXPECTED_VECTOR_FILES[i]} still matched`).not.toEqual(shorter);
    }
    const longer = [...EXPECTED_VECTOR_FILES, 'an-extra-vector.json'];
    expect(onDisk, 'an ADDED vector still matched the expected set').not.toEqual(longer);
  });
});
