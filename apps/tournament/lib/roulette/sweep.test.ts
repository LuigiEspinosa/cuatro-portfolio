import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { LADDER_EXIT_STEPS, fr29Ladder, resolveLadder } from './ladder';
import { OUTCOME_KINDS, Stage2Error, resolveStage2 } from './stage2';
import type { Award, Ladder, Outcome, RatePair, SnapshotPlayer, StatValue } from './stage2';
import type { Stage1Candidate } from './stage1';
import { SWEEP_REFUSAL_DETAILS, SweepError, resolveSpin } from './sweep';

// NOTE: `node:fs` is imported HERE, in the test. The banned-`node:` rule applies to the shipped
// modules (scanned in prng.test.ts), not to the suite that reads the vector files off disk.
//
// ⚠ THIS FILE MUST LIVE UNDER `lib/**` — `vitest.config.ts:17` restricts collection to that tree,
// so a suite placed anywhere else SILENTLY DOES NOT RUN.

// ── the shared contract ────────────────────────────────────────────────────────
//
// These tests read `roulette/vectors/antisweep-resolve.json` AT RUNTIME. The values are NEVER
// transcribed into TypeScript literals: a hard-coded copy greens on the day the vector is
// regenerated and silently stops testing the contract. `npm test` runs with cwd = the repo root.

const VECTOR_PATH = path.join(process.cwd(), 'roulette', 'vectors', 'antisweep-resolve.json');

type VectorStat = string | { num: string; den: string };

interface VectorAward {
  deciding_stat: string;
  class: string;
  direction: string;
  floor_rounds: number;
  floor_kills: number;
  secondary_stat?: string | null;
  eff_num_key?: string | null;
  eff_den_key?: string | null;
}

interface VectorPlayer {
  steamid64: string;
  rounds_played: string;
  kills: string;
  idle_dq: boolean;
  stats_int: {
    volume: Record<string, string>;
    rate: Record<string, { num: string; den: string }>;
    secondary?: Record<string, VectorStat>;
    efficiency?: Record<string, VectorStat>;
  };
  h2h?: Record<string, Record<string, VectorStat>>;
  achievement_ts?: string | null;
}

interface VectorCandidate {
  award_id: string;
  priority: number;
  award: VectorAward;
}

/** One assignment row: the outcome FLATTENED onto the row, plus what anti-sweep did to the set. */
interface VectorResultRow {
  award_id: string;
  priority: number;
  kind: string;
  steamid64?: string;
  winners?: string[];
  tied?: string[];
  deciding_value?: { class: string; value?: string; num?: string; den?: string };
  /**
   * ⚠ ALWAYS PRESENT, with `0` meaning "no ladder ran". Go carries `LadderExitStep int` on every
   * outcome while this side omits the key (`deferred-work.md:307` tracks the asymmetry), so a file
   * that also omitted it would be a THIRD spelling of NULL.
   */
  ladder_exit_step: number;
  swept_out: string[];
  reresolved: boolean;
}

interface VectorCase {
  name: string;
  note: string;
  live: VectorCandidate[];
  players: VectorPlayer[];
  expected: { results: VectorResultRow[]; assigned: string[] };
}

interface VectorRefusal {
  why: string;
  detail: string;
  defects: string[];
  live: VectorCandidate[];
  players: VectorPlayer[];
}

const vector = JSON.parse(readFileSync(VECTOR_PATH, 'utf8')) as {
  vector: string;
  algo_version: string;
  spec: string;
  outcome_kinds: string[];
  unreachable_outcome_kinds: string[];
  exit_steps: number[];
  refusal_details: string[];
  refusals: VectorRefusal[];
  cases: VectorCase[];
};

/**
 * ⛔ THE SHAPE IS CHECKED BEFORE `BigInt` SEES IT. A bare `BigInt(s)` is a LENIENT parser
 * (`BigInt('')` is `0n`, `BigInt('0x10')` is `16n`) while Go's `SetString(s, 10)` refuses both, so
 * a drifted row would become a silently different number here and a named failure there.
 */
function big(what: string, s: string): bigint {
  if (!/^-?[0-9]+$/.test(s)) {
    throw new Error(`vector carries a non-decimal magnitude for ${what}: ${JSON.stringify(s)}`);
  }
  return BigInt(s);
}

/**
 * ⭐ THE LOADER BRANCHES ON THE JSON SHAPE, NOT ON THE VOCABULARY — consulting the 17/4 split here
 * would re-implement the rule under test.
 */
function toStatValue(what: string, v: VectorStat): StatValue {
  if (typeof v === 'string') return { class: 'volume', value: big(what, v) };
  return { class: 'rate', num: big(`${what}.num`, v.num), den: big(`${what}.den`, v.den) };
}

function toAward(a: VectorAward): Award {
  return {
    decidingStat: a.deciding_stat,
    class: a.class as Award['class'],
    direction: a.direction as Award['direction'],
    floorRounds: a.floor_rounds,
    floorKills: a.floor_kills,
    secondaryStat: a.secondary_stat,
    effNumKey: a.eff_num_key,
    effDenKey: a.eff_den_key,
  };
}

function toLive(rows: VectorCandidate[]): Stage1Candidate[] {
  return rows.map((r) => ({ awardId: r.award_id, priority: r.priority, award: toAward(r.award) }));
}

function toPlayers(rows: VectorPlayer[]): SnapshotPlayer[] {
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
    // ⚠ `undefined` WHEN THE VECTOR OMITS THE BLOCK, never `{}` — coercing it here would move the
    // "an absent container is the empty container" rule out of the module and into this loader.
    let secondary: Record<string, StatValue> | undefined;
    if (r.stats_int.secondary !== undefined) {
      secondary = {};
      for (const [k, v] of Object.entries(r.stats_int.secondary)) {
        secondary[k] = toStatValue(`${r.steamid64}.secondary.${k}`, v);
      }
    }
    let efficiency: Record<string, RatePair> | undefined;
    if (r.stats_int.efficiency !== undefined) {
      efficiency = {};
      for (const [k, v] of Object.entries(r.stats_int.efficiency)) {
        efficiency[k] =
          typeof v === 'string'
            ? ({} as RatePair)
            : {
                num: big(`${r.steamid64}.efficiency.${k}.num`, v.num),
                den: big(`${r.steamid64}.efficiency.${k}.den`, v.den),
              };
      }
    }
    let h2h: Record<string, Record<string, StatValue>> | undefined;
    if (r.h2h !== undefined) {
      h2h = {};
      for (const [opp, block] of Object.entries(r.h2h)) {
        const inner: Record<string, StatValue> = {};
        for (const [k, v] of Object.entries(block)) {
          inner[k] = toStatValue(`${r.steamid64}.h2h.${opp}.${k}`, v);
        }
        h2h[opp] = inner;
      }
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
        r.achievement_ts == null ? undefined : big(`${r.steamid64}.achievement_ts`, r.achievement_ts),
    } satisfies SnapshotPlayer;
  });
}

/**
 * ⭐ THE CASE-NAME SET IS PINNED BY EXACT EQUALITY, mirroring the ladder and Stage-2 suites, and for
 * the reason those exist: a coverage flag can be satisfied by a row unrelated to the property it
 * names, so deleting this file's most valuable rows would leave every flag green, `--check`
 * reporting OK and both suites passing. Adding or removing a case reddens this deliberately.
 */
const CASE_NAMES = [
  'EXHAUSTION-every-eligible-player-for-a-LATER-award-is-ALREADY-assigned',
  'TWO-DIFFERENT-players-are-swept-out-of-TWO-DIFFERENT-awards',
  'a-CASCADE-award-3s-re-resolved-winner-was-ALREADY-swept-into-award-2',
  'a-CLEAN-spin-REMOVES-players-from-later-races-and-CHANGES-NOTHING',
  'a-CO-WINNER-of-an-EARLIER-shared-award-is-the-one-SWEPT-OUT',
  'a-REDUCED-set-drops-a-max-VOLUME-awards-best-value-to-ZERO-re-triggering-DECISION-E',
  'a-SINGLE-OVERFLOW-re-resolves-award-2-to-the-NEXT-ELIGIBLE-player',
  'a-ZERO-KILL-player-WINS-and-the-pass-FILTERS-NOBODY',
  'a-reduced-tie-of-WIDTH-1-is-NEVER-handed-to-the-ladder',
  'an-award-arrives-as-no_eligible_players-BEFORE-any-removal-and-assigns-NOBODY',
  'an-overflow-re-resolves-through-the-LADDER-and-EXITS-AT-A-DIFFERENT-RUNG',
  'an-overflow-re-resolves-to-a-SHARED-outcome-and-assigns-TWO-players-at-once',
  'the-SHIPPED-live-count-1-spin-can-never-sweep-ANYBODY',
  'the-award-with-the-LOWER-PRIORITY-NUMBER-KEEPS-the-trophy',
  'the-live-set-supplied-OUT-OF-PRIORITY-ORDER-resolves-IDENTICALLY',
  'the-ROSTER-supplied-OUT-OF-BYTE-LEX-order-changes-NOTHING',
] as const;

const caseByName = new Map(vector.cases.map((c) => [c.name, c]));

function caseNamed(name: string): VectorCase {
  const c = caseByName.get(name);
  if (c === undefined) throw new Error(`the case ${name} named by a coverage guard is gone`);
  return c;
}

function rowOf(c: VectorCase, awardId: string): VectorResultRow {
  const r = c.expected.results.find((x) => x.award_id === awardId);
  if (r === undefined) throw new Error(`case ${c.name} has no award ${awardId}`);
  return r;
}

/**
 * Resolve ONE of a case's awards over an arbitrary roster, through the REAL Stage 2 and the REAL
 * ladder — the TypeScript mirror of the anchor's `_unreduced` and Go's `resolveAwardOver`.
 *
 * ⭐ EVERY COVERAGE GUARD BELOW GOES THROUGH THIS, because a counterfactual asserted from a literal
 * is a transcription and a counterfactual COMPUTED is a measurement. The recurring defect it closes
 * is at its FIFTH occurrence across 6-4a, 6-4b, 6.5 and 6-5b: a flag that names a property and is
 * satisfied by a row unrelated to it.
 */
function resolveOver(c: VectorCase, awardId: string, players: readonly SnapshotPlayer[]): Outcome {
  const live = c.live.find((x) => x.award_id === awardId);
  if (live === undefined) throw new Error(`case ${c.name} has no live award ${awardId}`);
  const award = toAward(live.award);
  const out = resolveStage2(award, players);
  return out.kind === 'tie' ? resolveLadder(award, out.tied, players) : out;
}

function winnerOf(out: Outcome): string | undefined {
  return out.kind === 'winner' ? out.steamid64 : undefined;
}

function exitStepOf(out: Outcome): number {
  if (out.kind === 'winner') return out.ladderExitStep ?? 0;
  if (out.kind === 'shared') return out.ladderExitStep;
  return 0;
}

// ── the conformance run ────────────────────────────────────────────────────────

describe('antisweep-resolve.json', () => {
  it('is the file this suite expects', () => {
    expect(vector.vector).toBe('antisweep-resolve');
    expect(vector.cases.length).toBeGreaterThan(0);
    expect(vector.refusals.length).toBeGreaterThan(0);
  });

  // ⭐ THREE TOP-LEVEL FIELDS WERE DECLARED IN BOTH SUITES' TYPES AND ASSERTED BY NEITHER, which is
  // the "compartment rather than a contract" defect this file closes for `refusal_details` and left
  // open one field over. 6-5b's T6 fixed the same class for `ladder-resolve.json`'s `algo_version`
  // and the pattern reappeared here. The code review measured all three.
  it('declares the same algo_version this suite expects', () => {
    expect(vector.algo_version).toBe('inclusivcup-roulette-1.0.0');
  });

  it('declares exit_steps as NO-LADDER plus the ladder’s five rungs, and every row uses one', () => {
    // A real cross-module pin: it reddens if the FR-29 rung set changes, if the generator drifts, or
    // if the "0 means no ladder ran" sentinel is renumbered. ⚠ It deliberately does NOT assert that
    // all six are REACHED — rungs 1–3 genuinely do not occur in this vector's cases, and claiming
    // otherwise would be the over-strong assertion that has to be deleted later.
    expect(vector.exit_steps).toEqual([0, ...LADDER_EXIT_STEPS]);
    for (const c of vector.cases) {
      for (const r of c.expected.results) {
        expect(
          vector.exit_steps,
          `case ${c.name} / award ${r.award_id} carries an exit step outside the declared set`,
        ).toContain(r.ladder_exit_step ?? 0);
      }
    }
  });

  it('publishes a spec whose validation order matches the declared detail set', () => {
    // The modules both say "the order is CONTRACT, it is published in the vector's `spec` string".
    // Nothing read it, so the "published contract" was decorative. This does not pin the prose —
    // that would be brittle — it pins the one thing the prose exists to fix: that each
    // row-representable detail is NAMED, and that they are named in the order the code visits them.
    const spec = vector.spec;
    expect(typeof spec).toBe('string');
    expect(spec.length).toBeGreaterThan(200);
    const at = (d: string) => spec.indexOf(`\`${d}\``);
    for (const d of ['live', 'stage2', 'ladder']) {
      expect(at(d), `the spec never names the \`${d}\` detail`).toBeGreaterThan(-1);
    }
    expect(at('live'), 'the spec must name `live` before `stage2`').toBeLessThan(at('stage2'));
    expect(at('stage2'), 'the spec must name `stage2` before `ladder`').toBeLessThan(at('ladder'));
  });

  it('carries exactly the expected cases', () => {
    expect(vector.cases.map((c) => c.name).sort()).toEqual([...CASE_NAMES].sort());
  });
});

describe('resolveSpin — the shared vector', () => {
  for (const tc of vector.cases) {
    it(tc.name, () => {
      const got = resolveSpin(toLive(tc.live), toPlayers(tc.players), fr29Ladder);

      expect(got.results).toHaveLength(tc.expected.results.length);
      tc.expected.results.forEach((want, i) => {
        const row = got.results[i];
        if (row === undefined) throw new Error('missing result row');
        expect(row.awardId).toBe(want.award_id);
        expect(row.priority).toBe(want.priority);
        expect(row.outcome.kind).toBe(want.kind);
        expect([...row.sweptOut]).toEqual(want.swept_out);
        expect(row.reresolved).toBe(want.reresolved);
        // ⭐ `sweptOut` AND `reresolved` MUST AGREE, on the row's OWN data. They are two spellings
        // of one fact, and an implementation that reported the set correctly while hardcoding the
        // boolean (or vice versa) would pass every row where they happen to coincide.
        expect(row.reresolved).toBe(row.sweptOut.length > 0);
        expect(exitStepOf(row.outcome)).toBe(want.ladder_exit_step);

        // ⛔ THE CONFORMANCE SWITCH HAS A FINAL ARM THAT FAILS LOUDLY. A `default` that silently
        // accepted an unknown kind is the exact hole the 6-4a review found in this side's Stage-2
        // switch: an implementation returning a kind neither side understood would pass every row.
        switch (want.kind) {
          case 'winner': {
            if (row.outcome.kind !== 'winner') throw new Error('kind mismatch');
            expect(row.outcome.steamid64).toBe(want.steamid64);
            // ⭐ THE `deciding_value` XOR `ladder_exit_step` INVARIANT, carried through this pass. A
            // Stage-2 winner has a value and no rung; a ladder-resolved winner has a rung and no
            // value, because the tie it resolves carries none and L12 forbids re-deriving one.
            // Fabricating a zero would be a plausible-looking lie Story 6.8 renders on stage.
            expect(row.outcome.decidingValue !== undefined).toBe(want.deciding_value !== undefined);
            expect(row.outcome.decidingValue !== undefined).toBe(
              (row.outcome.ladderExitStep ?? 0) === 0,
            );
            // ⭐ THE MAGNITUDE, NOT JUST THE PRESENCE — Go compared `class` and then `big.Int.Cmp`
            // on every arm while this side asserted only that the field existed, so a TypeScript
            // implementation returning the RIGHT winner with a wrong, fabricated or zero deciding
            // value passed every row of the shared vector. That number is what Story 6.8 renders on
            // stage as the REASON the winner won, and asymmetric conformance across the one seam
            // whose whole contract is "the two runtimes behave identically" is the defect this file
            // exists to prevent. `stage2.test.ts:202-208` is the shape being mirrored.
            const want_dv = want.deciding_value;
            const got_dv = row.outcome.decidingValue;
            if (want_dv !== undefined) {
              expect(got_dv, 'the vector declares a deciding value and none came back').toBeDefined();
              if (got_dv === undefined) throw new Error('unreachable');
              expect(got_dv.class).toBe(want_dv.class);
              if (got_dv.class === 'volume') {
                expect(got_dv.value).toBe(big('expected.value', want_dv.value ?? ''));
              } else {
                expect(got_dv.num).toBe(big('expected.num', want_dv.num ?? ''));
                expect(got_dv.den).toBe(big('expected.den', want_dv.den ?? ''));
              }
            }
            break;
          }
          case 'shared': {
            if (row.outcome.kind !== 'shared') throw new Error('kind mismatch');
            expect([...row.outcome.winners]).toEqual(want.winners);
            break;
          }
          case 'no_awardable_value': {
            if (row.outcome.kind !== 'no_awardable_value') throw new Error('kind mismatch');
            // DECISION K — the suppressed set's WIDTH travels and is READ, never resolved.
            expect([...row.outcome.tied]).toEqual(want.tied);
            break;
          }
          case 'no_eligible_players': {
            expect(row.outcome.kind).toBe('no_eligible_players');
            break;
          }
          default:
            throw new Error(
              `the vector carries an outcome kind this suite does not check: ${want.kind}`,
            );
        }
      });

      expect([...got.assigned]).toEqual(tc.expected.assigned);

      // ⭐ THE RESULTS ARE IN ASCENDING PRIORITY, asserted as a PROPERTY over the row's own
      // priorities rather than left to the per-row `award_id` comparison: the rows would still line
      // up if both the vector and the implementation sorted the wrong way.
      for (let i = 1; i < got.results.length; i += 1) {
        expect((got.results[i - 1] as { priority: number }).priority).toBeLessThan(
          (got.results[i] as { priority: number }).priority,
        );
      }
    });
  }
});

// ⭐⭐ THE CAP ITSELF, ASSERTED OVER EVERY CASE, as an INVARIANT over the resolved output rather than
// row by row — a per-row expectation can be satisfied by a vector that simply never constructs the
// violation. It is the ONE property the whole story exists to guarantee, and the same property
// migration 0025's `unique (spin_id, winner_entry_id)` backstops at the database.
describe('resolveSpin never awards one player twice in one spin', () => {
  for (const tc of vector.cases) {
    it(tc.name, () => {
      const got = resolveSpin(toLive(tc.live), toPlayers(tc.players), fr29Ladder);
      const seen = new Map<string, string>();
      for (const row of got.results) {
        const winners =
          row.outcome.kind === 'winner'
            ? [row.outcome.steamid64]
            : row.outcome.kind === 'shared'
              ? row.outcome.winners
              : [];
        for (const sid of winners) {
          expect(seen.has(sid), `${sid} won ${String(seen.get(sid))} AND ${row.awardId}`).toBe(
            false,
          );
          seen.set(sid, row.awardId);
        }
      }
      expect([...got.assigned]).toEqual([...seen.keys()].sort());
    });
  }
});

// ⛔ A PURE PASS MUST NOT REORDER ITS CALLER'S ARRAYS. The caller holds `Stage1Result.live`'s DRAW
// order, which is the REVEAL order Story 6.10 renders — sorting it in place would silently discard it.
describe('resolveSpin does not mutate its inputs', () => {
  for (const tc of vector.cases) {
    it(tc.name, () => {
      const live = toLive(tc.live);
      const players = toPlayers(tc.players);
      const liveBefore = live.map((c) => c.awardId);
      const playersBefore = players.map((p) => p.steamid64);
      resolveSpin(live, players, fr29Ladder);
      expect(live.map((c) => c.awardId)).toEqual(liveBefore);
      expect(players.map((p) => p.steamid64)).toEqual(playersBefore);
    });
  }
});

// ── refusals ───────────────────────────────────────────────────────────────────

describe('resolveSpin — the shared refusals', () => {
  for (const bad of vector.refusals) {
    it(bad.why, () => {
      let thrown: unknown;
      try {
        resolveSpin(toLive(bad.live), toPlayers(bad.players), fr29Ladder);
      } catch (err) {
        thrown = err;
      }
      // ⛔ THE TYPED ERROR **AND** THE DECLARED DETAIL, never merely "some error". 6-4a measured the
      // cost of the weaker assertion: a mutation that made validation reject EVERY input left all
      // sixteen refusal rows passing. And 6-4b's TS local table asserted only `toThrow(Stage1Error)`
      // and left two guards mutation-invisible — so the per-row `detail` is here from the start.
      expect(thrown, 'resolved an input the vector says must refuse').toBeInstanceOf(SweepError);
      expect((thrown as SweepError).detail).toBe(bad.detail);
      // ⭐ `detail` IS `defects[0]` — the published order's first visited defect.
      expect(bad.defects[0]).toBe(bad.detail);
      for (const d of bad.defects) expect(vector.refusal_details).toContain(d);

      // ⭐ A PROPAGATED REFUSAL KEEPS ITS ORIGIN REACHABLE, so a caller can tell a malformed award
      // from a ladder that ran and refused without parsing English.
      //
      // ⛔ A SWITCH WITH A FINAL ARM THAT FAILS LOUDLY, mirroring Go's `default: t.Fatalf`. The old
      // shape was two bare `if`s: the single `ladder` row's `cause` was never inspected at all — so
      // a runtime that dropped the `{ cause: err }` on the ladder catch passed the whole suite —
      // and a FIFTH detail added to the vector fell through both `if`s and passed silently on this
      // side while failing loudly on Go's. A gate whose job is keeping the closed set closed must
      // not be the thing that diverges. The code review measured both halves.
      const cause = (thrown as SweepError).cause;
      switch (bad.detail) {
        case 'stage2':
          expect(cause, 'a propagated stage2 refusal must keep its origin').toBeInstanceOf(
            Stage2Error,
          );
          break;
        case 'ladder':
          // The ladder's own error class, reached through the port. `resolveLadder` throws a
          // `LadderError`; asserting merely "an Error" would let a runtime that swallowed the
          // origin and re-threw a bare string pass.
          expect(cause, 'a propagated ladder refusal must keep its origin').toBeInstanceOf(Error);
          expect(
            (cause as Error).constructor.name,
            'the ladder refusal must unwrap to the LADDER’s error, not Stage 2’s',
          ).toBe('LadderError');
          break;
        case 'live':
          // The live group is this module's own guard — there is no upstream to carry.
          expect(cause, 'a live refusal originates here and has no cause').toBeUndefined();
          break;
        default:
          throw new Error(
            `the vector declares a refusal detail this suite does not check: ${JSON.stringify(
              bad.detail,
            )}`,
          );
      }
    });
  }
});

// ⭐⭐ VALIDATION ORDER IS CONTRACT, AND THE DOUBLY-MALFORMED ROWS ARE THE ONLY ROWS THAT CAN SEE IT.
//
// 6-4b's headline defect was three implementations disagreeing about whether `live_count` was
// checked before or after weighting, with NO row malformed in two ways — so the gate was
// structurally blind. Story 6.5 shipped the same class again.
describe('validation order', () => {
  const doubles = vector.refusals.filter((r) => r.defects.length >= 2);

  it('at least two rows are malformed in two ways at once', () => {
    expect(doubles.length).toBeGreaterThanOrEqual(2);
  });

  for (const bad of doubles) {
    it(`carries two DIFFERENT labels: ${bad.why}`, () => {
      expect(bad.defects[0]).not.toBe(bad.defects[1]);
      expect(bad.detail).toBe(bad.defects[0]);
    });
  }
});

// ── the closed sets ────────────────────────────────────────────────────────────

describe('the closed sets are one vocabulary', () => {
  it('the vector’s refusal_details are exactly this module’s', () => {
    expect(vector.refusal_details).toEqual([...SWEEP_REFUSAL_DETAILS]);
  });

  it('every ROW-REPRESENTABLE detail is exercised, and the unrepresentable one is not', () => {
    // ⚠ `internal` IS DELIBERATELY EXCLUDED from the "must be exercised" requirement. A row is a set
    // of INPUTS; "the injected port returned something impossible" is not an input, so no row can
    // produce it. It is covered by the stub-port tests below, and the generator enforces the same
    // split from the other side: it refuses to write a row carrying it.
    const rowRepresentable = ['live', 'stage2', 'ladder'];
    const unrepresentable = ['internal'];
    const seen = vector.refusals.map((r) => r.detail);
    for (const d of rowRepresentable) expect(seen, `no refusal row of detail ${d}`).toContain(d);
    for (const d of unrepresentable) expect(seen).not.toContain(d);
  });

  it('the vector’s outcome_kinds are the engine’s one closed set', () => {
    expect(vector.outcome_kinds).toEqual([...OUTCOME_KINDS]);
  });

  it('no assignment row carries a kind this pass cannot produce', () => {
    // ⭐ `OUTCOME_KINDS` stays ONE closed set across the engine — narrowing it here would be a
    // second vocabulary — so the fact that a TIE never survives this pass travels as its own field
    // and is asserted against the rows rather than inferred from their absence. An implementation
    // that skipped the ladder would emit one.
    expect(vector.unreachable_outcome_kinds).toEqual(['tie']);
    for (const c of vector.cases) {
      for (const r of c.expected.results) {
        expect(vector.unreachable_outcome_kinds).not.toContain(r.kind);
        expect(vector.outcome_kinds).toContain(r.kind);
      }
    }
  });
});

// ── coverage: every flag names its ROW and re-derives that row's property ───────

describe('the vector’s coverage is real and unique', () => {
  it('the shipped live_count = 1 row can sweep nobody, structurally', () => {
    const shipped = caseNamed('the-SHIPPED-live-count-1-spin-can-never-sweep-ANYBODY');
    expect(shipped.live).toHaveLength(1);
    expect(shipped.expected.results).toHaveLength(1);
    expect((shipped.expected.results[0] as VectorResultRow).swept_out).toEqual([]);
    expect((shipped.expected.results[0] as VectorResultRow).reresolved).toBe(false);
    // …and it is the ONLY single-award row, or it stops being the row that models the shipped width.
    expect(vector.cases.filter((c) => c.live.length === 1)).toHaveLength(1);
  });

  it('the clean spin REMOVES players and changes NOTHING', () => {
    const clean = caseNamed('a-CLEAN-spin-REMOVES-players-from-later-races-and-CHANGES-NOTHING');
    const players = toPlayers(clean.players);
    // ⭐ THE COUNTERFACTUAL, re-derived through the real Stage 2: every award's UNREDUCED winner is
    // the player the reduced resolution crowned, so the removal provably changed nothing.
    for (const r of clean.expected.results) {
      expect(r.kind).toBe('winner');
      expect(winnerOf(resolveOver(clean, r.award_id, players))).toBe(r.steamid64);
    }
    // …and removal genuinely HAPPENED, or "changed nothing" is vacuous.
    expect(clean.expected.results.some((r) => r.swept_out.length > 0)).toBe(true);
  });

  it('the out-of-order row is the SAME spin and produces an IDENTICAL result', () => {
    const clean = caseNamed('a-CLEAN-spin-REMOVES-players-from-later-races-and-CHANGES-NOTHING');
    const shuffled = caseNamed('the-live-set-supplied-OUT-OF-PRIORITY-ORDER-resolves-IDENTICALLY');
    // ⭐ THAT IDENTITY IS THE ASSERTION, the shape `ladder-resolve.json`'s three spellings of an
    // absent rung key established.
    expect(shuffled.expected).toEqual(clean.expected);
    // …and the guard-the-guard half: the two rows must genuinely differ in the order they SUPPLY the
    // candidates, or the identity is a row compared with itself.
    expect(shuffled.live.map((c) => c.award_id)).not.toEqual(clean.live.map((c) => c.award_id));
    expect([...shuffled.live].map((c) => `${c.award_id}@${String(c.priority)}`).sort()).toEqual(
      [...clean.live].map((c) => `${c.award_id}@${String(c.priority)}`).sort(),
    );
    expect(shuffled.players).toEqual(clean.players);
    // The supplied order must be NEITHER ascending nor descending, or it cannot separate "no sort at
    // all" from "sorted the wrong way".
    const supplied = shuffled.live.map((c) => c.priority);
    expect(supplied).not.toEqual([...supplied].sort((a, b) => a - b));
    expect(supplied).not.toEqual([...supplied].sort((a, b) => b - a));
  });

  it('the LOWER priority number keeps the trophy, and both awards’ unreduced winner is the SAME player', () => {
    const dir = caseNamed('the-award-with-the-LOWER-PRIORITY-NUMBER-KEEPS-the-trophy');
    const players = toPlayers(dir.players);
    expect(dir.expected.results).toHaveLength(2);
    const first = winnerOf(resolveOver(dir, (dir.expected.results[0] as VectorResultRow).award_id, players));
    const second = winnerOf(resolveOver(dir, (dir.expected.results[1] as VectorResultRow).award_id, players));
    // ⭐ Without this the two sort directions produce the same answer and the row discriminates
    // nothing.
    expect(first).toBeDefined();
    expect(first).toBe(second);
    // …and the candidates are supplied largest-priority-first, so "the supplied order" and
    // "descending" are both killed by this row.
    const supplied = dir.live.map((c) => c.priority);
    expect(supplied).toEqual([...supplied].sort((a, b) => b - a));
  });

  it('the cascade relays award 2’s re-resolved winner into award 3', () => {
    const cascade = caseNamed('a-CASCADE-award-3s-re-resolved-winner-was-ALREADY-swept-into-award-2');
    const players = toPlayers(cascade.players);
    const firstWinner = rowOf(cascade, 'aw-01').steamid64 as string;
    const minusFirst = players.filter((p) => p.steamid64 !== firstWinner);
    // (ii) award 3 over the roster minus the FIRST sweeper is exactly award 2's re-resolved winner —
    //      which is what makes this a cascade rather than two independent overflows.
    expect(winnerOf(resolveOver(cascade, 'aw-03', minusFirst))).toBe(rowOf(cascade, 'aw-02').steamid64);
    expect(rowOf(cascade, 'aw-03').swept_out).toHaveLength(2);
    expect(rowOf(cascade, 'aw-03').steamid64).not.toBe(rowOf(cascade, 'aw-02').steamid64);
  });

  it('the ladder overflow exits at a DIFFERENT rung from the original resolution', () => {
    const rung = caseNamed('an-overflow-re-resolves-through-the-LADDER-and-EXITS-AT-A-DIFFERENT-RUNG');
    const players = toPlayers(rung.players);
    const original = resolveOver(rung, 'aw-02', players);
    const overflow = rowOf(rung, 'aw-02');
    // The unreduced resolution must itself reach the ladder, or "a different rung" has nothing to
    // differ from.
    expect(exitStepOf(original)).not.toBe(0);
    expect(exitStepOf(original)).not.toBe(overflow.ladder_exit_step);
    expect(winnerOf(original)).not.toBe(overflow.steamid64);
    expect(resolveStage2(toAward((rung.live[1] as VectorCandidate).award), players).kind).toBe('tie');
    // …and it is the only such row, or the claim is no longer unique.
    const rungRows = vector.cases.flatMap((c) =>
      c.expected.results.filter(
        (r) => r.ladder_exit_step !== 0 && r.ladder_exit_step !== 5 && r.swept_out.length > 0,
      ),
    );
    expect(rungRows).toHaveLength(1);
  });

  it('the swept-out co-winner is the SECOND one, not winners[0]', () => {
    const co = caseNamed('a-CO-WINNER-of-an-EARLIER-shared-award-is-the-one-SWEPT-OUT');
    const players = toPlayers(co.players);
    const sharedRow = rowOf(co, 'aw-01');
    expect(sharedRow.kind).toBe('shared');
    expect((sharedRow.winners ?? []).length).toBeGreaterThanOrEqual(2);
    // ⭐ Without this the row is satisfied by a pass that credits only `winners[0]`, and it is the
    // ONLY row that can distinguish the two rules.
    expect(winnerOf(resolveOver(co, 'aw-02', players))).toBe((sharedRow.winners as string[])[1]);
  });

  it('exhaustion had a NON-EMPTY eligible set before removal', () => {
    const ex = caseNamed('EXHAUSTION-every-eligible-player-for-a-LATER-award-is-ALREADY-assigned');
    const players = toPlayers(ex.players);
    const empty = rowOf(ex, 'aw-02');
    expect(empty.kind).toBe('no_eligible_players');
    expect(empty.swept_out.length).toBeGreaterThan(0);
    // ⭐ The guard Task 2 demands — without it the row is indistinguishable from an award nobody
    // qualified for.
    expect(resolveOver(ex, 'aw-02', players).kind).not.toBe('no_eligible_players');
    expect(empty.swept_out).toHaveLength(ex.players.length);
  });

  it('its twin arrives as no_eligible_players with an EMPTY swept_out and assigns nobody', () => {
    const un = caseNamed('an-award-arrives-as-no_eligible_players-BEFORE-any-removal-and-assigns-NOBODY');
    expect(rowOf(un, 'aw-01').kind).toBe('no_eligible_players');
    expect(rowOf(un, 'aw-01').swept_out).toEqual([]);
    // A6 — it assigns NOBODY, so the next award still sees the whole roster.
    expect(rowOf(un, 'aw-02').swept_out).toEqual([]);
  });

  it('DECISION E re-fires on the reduced set, and the suppressed set is READ not resolved', () => {
    const zeroed = caseNamed(
      'a-REDUCED-set-drops-a-max-VOLUME-awards-best-value-to-ZERO-re-triggering-DECISION-E',
    );
    const players = toPlayers(zeroed.players);
    const suppressed = rowOf(zeroed, 'aw-02');
    expect(suppressed.kind).toBe('no_awardable_value');
    expect((suppressed.tied ?? []).length).toBeGreaterThan(0);
    // ⭐ THE BEST VALUE WAS NON-ZERO BEFORE REMOVAL — otherwise the carve-out was not re-triggered
    // BY the removal.
    expect(resolveOver(zeroed, 'aw-02', players).kind).toBe('winner');
    // ⛔ DECISION K — none of the suppressed set is assigned.
    for (const sid of suppressed.tied ?? []) {
      expect(zeroed.expected.assigned).not.toContain(sid);
    }
  });

  it('the width-1 reduced tie resolves through Stage 2, never through the ladder', () => {
    const w1 = caseNamed('a-reduced-tie-of-WIDTH-1-is-NEVER-handed-to-the-ladder');
    const players = toPlayers(w1.players);
    const row = rowOf(w1, 'aw-02');
    expect(row.kind).toBe('winner');
    expect(row.ladder_exit_step).toBe(0);
    expect(row.deciding_value).toBeDefined();
    // The property that makes the row hard: the UNREDUCED outcome is a tie of width exactly 2 and
    // the removed player is one of the two — so a pop-the-winner shortcut hands the ladder a
    // width-1 set and is REFUSED where this resolves.
    const raw = resolveStage2(toAward((w1.live[1] as VectorCandidate).award), players);
    expect(raw.kind).toBe('tie');
    if (raw.kind !== 'tie') throw new Error('unreachable');
    expect(raw.tied).toHaveLength(2);
    expect(raw.tied).toContain(row.swept_out[0]);
  });

  it('the SHARED re-resolution assigns two players at once, and it is the only one', () => {
    const so = rowOf(
      caseNamed('an-overflow-re-resolves-to-a-SHARED-outcome-and-assigns-TWO-players-at-once'),
      'aw-02',
    );
    expect(so.kind).toBe('shared');
    expect(so.winners).toHaveLength(2);
    expect(so.swept_out.length).toBeGreaterThan(0);
    const sharedReresolutions = vector.cases.flatMap((c) =>
      c.expected.results.filter((r) => r.kind === 'shared' && r.swept_out.length > 0),
    );
    expect(sharedReresolutions).toHaveLength(1);
  });

  // ⭐⭐ THE FOUR CASES THAT WERE PINNED BY NAME AND GUARDED BY NOTHING.
  //
  // The code review measured it: twelve of the sixteen case names got a guard that re-derives the
  // row's defining property from its own data, and four did not — including BOTH rows the mutation
  // pass added, which are by definition the rows measured to be load-bearing. A case name is not a
  // test. This is the coverage-guard defect at its FOURTH occurrence in this epic.

  it('the reversed-roster row is genuinely supplied OUT of byte-lex order', () => {
    // Worthless if the roster it supplies happens to be sorted: `sweptOut.sort()` and the `assigned`
    // sort both become identities and deleting them is byte-identical. That is the exact mutation
    // that survived the author's first run and was closed by adding this row — unguarded.
    const rev = caseNamed('the-ROSTER-supplied-OUT-OF-BYTE-LEX-order-changes-NOTHING');
    const supplied = rev.players.map((p) => p.steamid64);
    expect(supplied, 'the row supplies its roster already sorted, so the sort is an identity').not.toEqual(
      [...supplied].sort(),
    );
  });

  it('the zero-kill row really has a zero-kill player, and that player WINS', () => {
    // Worthless if every player has the same kills: a pass that quietly re-applied an eligibility
    // filter produces identical output. Also one of the author's two measured holes.
    const zk = caseNamed('a-ZERO-KILL-player-WINS-and-the-pass-FILTERS-NOBODY');
    const winner = rowOf(zk, 'aw-01').steamid64;
    expect(zk.players.some((p) => p.kills === '0')).toBe(true);
    expect(
      zk.players.find((p) => p.steamid64 === winner)?.kills,
      'the row is named for a ZERO-KILL player WINNING',
    ).toBe('0');
  });

  it('two DIFFERENT players are swept out of two DIFFERENT awards', () => {
    // One of either makes this the cascade row under a different title.
    const two = caseNamed('TWO-DIFFERENT-players-are-swept-out-of-TWO-DIFFERENT-awards');
    const sweptPlayers = new Set(two.expected.results.flatMap((r) => r.swept_out));
    const sweepingAwards = two.expected.results.filter((r) => r.swept_out.length > 0);
    expect(sweptPlayers.size).toBeGreaterThanOrEqual(2);
    expect(sweepingAwards.length).toBeGreaterThanOrEqual(2);
  });

  it('the single overflow makes award 2 CHANGE HANDS, and to a player it swept out', () => {
    // Without this the row passes for a pass that removed the player and re-crowned him anyway.
    const one = caseNamed('a-SINGLE-OVERFLOW-re-resolves-award-2-to-the-NEXT-ELIGIBLE-player');
    const players = toPlayers(one.players);
    const reduced = rowOf(one, 'aw-02');
    const full = winnerOf(resolveOver(one, 'aw-02', players));
    expect(reduced.swept_out.length).toBeGreaterThan(0);
    expect(full, 'award 2 crowns the same player reduced and unreduced — no removal is proven').not.toBe(
      reduced.steamid64,
    );
    expect(
      reduced.swept_out,
      'the full-roster winner is not among the swept-out, so the overflow is a coincidence',
    ).toContain(full);
  });
});

// ── local rows: the states no set of INPUTS can reach ───────────────────────────

describe('resolveSpin refuses an absent ladder', () => {
  const live: Stage1Candidate[] = [
    {
      awardId: 'aw-01',
      priority: 1,
      award: { decidingStat: 'kills', class: 'volume', direction: 'max', floorRounds: 0, floorKills: 0 },
    },
  ];

  // ⭐ THE PRESENCE TEST IS STRUCTURAL, NOT `!== undefined`, and these are the shapes that prove it:
  // a bare `!== undefined` treats `null` — reachable from any JSON- or config-driven caller — as
  // PRESENT and calls `null.resolve`, while Go's typed-nil guard calls the same input ABSENT. One
  // input, two behaviours across the seam, and invisible to the vector because "no ladder" is not a
  // JSON input.
  for (const [name, ladder] of [
    ['undefined', undefined],
    ['null', null],
    ['a plain object with no resolve', {}],
    ['an object whose resolve is not a function', { resolve: 42 }],
  ] as const) {
    it(name, () => {
      expect(() => resolveSpin(live, [], ladder as unknown as Ladder)).toThrow(SweepError);
      try {
        resolveSpin(live, [], ladder as unknown as Ladder);
      } catch (err) {
        expect((err as SweepError).detail).toBe('ladder');
      }
    });
  }
});

// ⭐⭐ THE `internal` ARMS, DRIVEN BY A STUB PORT — the machinery Story 6-5b built for Stage 1's twin
// pair, applied here from the first commit rather than after a review.
//
// `Ladder` is an INJECTED PORT: 6.9's verifier reimplements it and any third-party implementation
// reaches these arms, which is the entire reason the guards were written. The shipped `fr29Ladder`
// cannot produce any of these shapes, so nothing else in the suite touches them.
describe('the internal guards are driven by a stub port', () => {
  const award: Award = {
    decidingStat: 'knife_kills',
    class: 'volume',
    direction: 'max',
    floorRounds: 0,
    floorKills: 0,
  };
  const live: Stage1Candidate[] = [{ awardId: 'aw-01', priority: 1, award }];
  const tiedPlayer = (sid: string): SnapshotPlayer => ({
    steamid64: sid,
    roundsPlayed: 30n,
    kills: 20n,
    idleDq: false,
    volume: { knife_kills: 7n },
    rate: {},
  });
  const players = [tiedPlayer('76561198000000011'), tiedPlayer('76561198000000022')];
  const stub = (out: Outcome): Ladder => ({ resolve: () => out });

  const shapes: Array<[string, Outcome]> = [
    // A ladder that returned its tie unchanged would otherwise fall through the winners switch and
    // assign NOBODY — silently turning a resolved tie into a category with no trophy.
    ['the port returns the tie unresolved', {
      kind: 'tie',
      tied: ['76561198000000011', '76561198000000022'],
      reason: 'equal_value',
    }],
    ['the port returns a kind that resolves nothing', { kind: 'no_eligible_players' }],
    // A trophy awarded to NOBODY. Without the guard, `winners[0]` reads `undefined` here and panics
    // in Go: one input, two failure kinds across the seam.
    ['the port returns SHARED with no winners', { kind: 'shared', winners: [], ladderExitStep: 5 }],
    // ⭐ The empty id would enter `assigned`, match no roster row, remove nobody — and at 6.8 be
    // written to `award_result_winner` as a foreign key to nothing.
    ['the port returns SHARED with an empty steamid64', {
      kind: 'shared',
      winners: ['', '76561198000000022'],
      ladderExitStep: 5,
    }],
    ['the port returns a WINNER with an empty steamid64', {
      kind: 'winner',
      steamid64: '',
      ladderExitStep: 1,
    }],
    // ⭐⭐ THE CAP'S OWN INVARIANT, WHICH NO STUB ROW DROVE UNTIL THE CODE REVIEW. Every row above
    // tests a MALFORMED shape; this one is perfectly well-formed and is the violation FR-26 exists
    // to prevent — a port handing back a player who is not in the candidate set the award competed
    // over. The story claimed this was impossible "by construction"; it was impossible only for the
    // shipped ladder, and the guards vetted weaker properties than the load-bearing one.
    ['the port returns a WINNER who is not on the roster at all', {
      kind: 'winner',
      steamid64: '76561198000000099',
      ladderExitStep: 1,
    }],
    ['the port returns SHARED including a player outside the candidate set', {
      kind: 'shared',
      winners: ['76561198000000011', '76561198000000099'],
      ladderExitStep: 5,
    }],
    // ⛔ A DUPLICATE CO-WINNER. `assigned` is a Set and would dedupe it silently, so the violation
    // would never show in `SpinResult.assigned` — it would show at 6.8 as two `award_result_winner`
    // rows for one player, with the `is_shared` trigger counting 2 and AGREEING with the flag.
    ['the port returns SHARED listing the same player twice', {
      kind: 'shared',
      winners: ['76561198000000011', '76561198000000011'],
      ladderExitStep: 5,
    }],
    // ⚠ THE OMITTED-FIELD SHAPES, which Go gets for free from its zero values and this side did not:
    // `undefined === ''` is FALSE, so these sailed past the empty-string guards. The two stub tables
    // LOOKED like mirrors and tested different inputs.
    ['the port returns a WINNER with no steamid64 key at all',
      { kind: 'winner', ladderExitStep: 1 } as unknown as Outcome],
    ['the port returns SHARED with no winners key at all',
      { kind: 'shared', ladderExitStep: 5 } as unknown as Outcome],
  ];

  for (const [name, out] of shapes) {
    it(name, () => {
      try {
        resolveSpin(live, players, stub(out));
        throw new Error('resolved a port output no implementation may produce');
      } catch (err) {
        expect(err).toBeInstanceOf(SweepError);
        expect((err as SweepError).detail).toBe('internal');
      }
    });
  }
});

// ⭐ A1 IS CARRIED BY THE SIGNATURE, AND THIS IS THE ONLY HONEST WAY TO SAY SO. There is no runtime
// assertion that "the pass drew nothing", because `resolveSpin` takes no stream and such an
// assertion would be VACUOUS — the 6-4b code review deleted exactly that shape. What CAN be asserted
// is that the entry point is SYNCHRONOUS: an `async` mirror would return a Promise, which is the
// observable difference a stream would force (`uniformInt` is async on this side, and `prng.ts`
// throws if two draws overlap on one stream).
describe('resolveSpin is synchronous, and that is what "draws nothing" means here', () => {
  it('returns a plain result rather than a Promise', () => {
    const tc = vector.cases[0] as VectorCase;
    const got = resolveSpin(toLive(tc.live), toPlayers(tc.players), fr29Ladder);
    expect(got).not.toBeInstanceOf(Promise);
    expect(Array.isArray(got.results)).toBe(true);
  });
});
