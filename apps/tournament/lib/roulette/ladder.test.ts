import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ABSENT_ACHIEVEMENT_TS,
  LADDER_REFUSAL_DETAILS,
  LadderError,
  RATE_STAT_KEYS,
  VOLUME_STAT_KEYS,
  fr29Ladder,
  resolveLadder,
} from './ladder';
import { OUTCOME_KINDS, resolveStage2 } from './stage2';
import type { Award, Outcome, RatePair, SnapshotPlayer, StatValue, TieOutcome } from './stage2';

// NOTE: `node:fs` is imported HERE, in the test. The banned-`node:` rule applies to the shipped
// modules (scanned in prng.test.ts), not to the suite that reads the vector files off disk.

// ── the shared contract ────────────────────────────────────────────────────────
//
// These tests read `roulette/vectors/ladder-resolve.json` AT RUNTIME. The values are NEVER
// transcribed into TypeScript literals: a hard-coded copy greens on the day the vector is
// regenerated and silently stops testing the contract. `npm test` runs with cwd = the repo root.

const VECTOR_PATH = path.join(process.cwd(), 'roulette', 'vectors', 'ladder-resolve.json');
const STAGE2_PATH = path.join(process.cwd(), 'roulette', 'vectors', 'stage2-resolve.json');

/** A class-shaped value as the vector encodes it: a decimal STRING or a `{num, den}` object. */
type VectorStat = string | { num: string; den: string };

interface VectorAward {
  deciding_stat: string;
  class: string;
  direction: string;
  floor_rounds: number;
  floor_kills: number;
  // ⭐ ALL THREE OPTIONAL AND NULLABLE, which is the loader rule under test: the vector spells
  // absence three ways (`null`, the key omitted, `''`) and all three must be indistinguishable —
  // because Go, whose `Award.SecondaryStat` is a plain `string`, cannot tell them apart.
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
    secondary: Record<string, VectorStat>;
    efficiency: Record<string, { num: string; den: string }>;
  };
  h2h: Record<string, Record<string, VectorStat>>;
  // Optional so an OMITTED value stays distinguishable from the sentinel — it is a SCALAR, not a
  // container, so "absent is the empty case" does not apply.
  achievement_ts?: string;
}

interface VectorExpected {
  kind: string;
  steamid64?: string;
  winners?: string[];
  ladder_exit_step: number;
  deciding_value?: unknown;
}

interface VectorCase {
  name: string;
  note: string;
  award: VectorAward;
  tied: string[];
  players: VectorPlayer[];
  expected: VectorExpected;
}

interface VectorRefusal {
  why: string;
  detail: string;
  award: VectorAward;
  tied: string[];
  players: VectorPlayer[];
}

const vector = JSON.parse(readFileSync(VECTOR_PATH, 'utf8')) as {
  vector: string;
  algo_version: string;
  exit_steps: number[];
  absent_achievement_ts: string;
  refusal_details: string[];
  stat_vocabulary: { volume: string[]; rate: string[] };
  refusals: VectorRefusal[];
  cases: VectorCase[];
};

/**
 * Parse one vector magnitude.
 *
 * ⛔ THE SHAPE IS CHECKED BEFORE `BigInt` SEES IT, for the same reason `stage2.test.ts` does it: a
 * bare `BigInt(s)` is a LENIENT parser (`BigInt('')` is `0n`, `BigInt('0x10')` is `16n`) while Go's
 * `SetString(s, 10)` refuses both. Handing a drifted row straight to `BigInt` would turn it into a
 * silently different number here and a named failure there.
 */
function big(what: string, s: string): bigint {
  if (!/^-?[0-9]+$/.test(s)) {
    throw new Error(`vector carries a non-decimal magnitude for ${what}: ${JSON.stringify(s)}`);
  }
  return BigInt(s);
}

/**
 * ⭐ THE LOADER BRANCHES ON THE JSON SHAPE, NOT ON THE VOCABULARY, and that is deliberate. If it
 * consulted the 17/4 split it would be re-implementing the rule under test, so a rung-1
 * implementation that read the wrong shape would be handed a value the loader had already coerced
 * into the right one. The vector's shapes come from 0024's own `volume || rate` derivation; the
 * production code's job is to agree with them.
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
    // ⚠ Passed through VERBATIM — `undefined` for an omitted key, `null` for an explicit null and
    // `''` for the empty-string row. Normalising here would move the rule out of `ladder.ts` and
    // make the three-spellings cases test the loader instead of the module.
    secondaryStat: a.secondary_stat,
    effNumKey: a.eff_num_key,
    effDenKey: a.eff_den_key,
  };
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
    const secondary: Record<string, StatValue> = {};
    for (const [k, v] of Object.entries(r.stats_int.secondary)) {
      secondary[k] = toStatValue(`${r.steamid64}.secondary.${k}`, v);
    }
    const efficiency: Record<string, RatePair> = {};
    for (const [k, v] of Object.entries(r.stats_int.efficiency)) {
      efficiency[k] = {
        num: big(`${r.steamid64}.efficiency.${k}.num`, v.num),
        den: big(`${r.steamid64}.efficiency.${k}.den`, v.den),
      };
    }
    const h2h: Record<string, Record<string, StatValue>> = {};
    for (const [opp, block] of Object.entries(r.h2h)) {
      const inner: Record<string, StatValue> = {};
      for (const [k, v] of Object.entries(block)) {
        inner[k] = toStatValue(`${r.steamid64}.h2h.${opp}.${k}`, v);
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
      // ⚠ Left UNDEFINED when the vector omits the key — the refusal row for an absent scalar
      // depends on that, and coercing it to a zero here would make the row untestable.
      achievementTs:
        r.achievement_ts === undefined
          ? undefined
          : big(`${r.steamid64}.achievement_ts`, r.achievement_ts),
    };
  });
}

describe('the ladder vector file itself', () => {
  it('is the ladder vector and carries both cases and refusals', () => {
    expect(vector.vector).toBe('ladder-resolve');
    expect(vector.algo_version).toBe('inclusivcup-roulette-1.0.0');
    expect(vector.cases.length).toBeGreaterThan(0);
    expect(vector.refusals.length).toBeGreaterThan(0);
  });

  // ⭐ THE CASE-NAME SET IS PINNED BY EXACT EQUALITY, mirroring the Go suite's `ladderCaseNames`.
  //
  // The recurring finding across the 6-4a and 6-4b reviews is that a coverage flag can be satisfied
  // by a row unrelated to the property it names, so deleting the file's most valuable rows leaves
  // every flag green and both suites passing. Adding or removing a case reddens this deliberately.
  it('carries exactly the expected cases', () => {
    expect([...vector.cases.map((c) => c.name)].sort()).toEqual([
      'a-width-3-tie-NARROWS-to-2-at-rung-1-and-is-SHARED-at-rung-5',
      'rung-1-a-RATE-secondary-cross-multiplies-and-crosses-CLASS',
      'rung-1-a-VOLUME-secondary-breaks-the-tie',
      'rung-1-a-zero-denominator-secondary-ties-everyone-S3-verbatim',
      'rung-1-direction-min-inverts-the-secondary',
      'rung-1-is-SKIPPED-when-secondary_stat-is-NULL',
      'rung-2-a-ratio-of-two-ratios-the-naive-single-pair-compare-gets-BACKWARDS',
      'rung-2-a-zero-denominator-ratio-behaves-as-PLUS-INFINITY',
      'rung-2-four-term-products-past-2-pow-53',
      'rung-2-is-SKIPPED-when-both-efficiency-keys-are-NULL',
      'rung-2-runs-over-rung-1s-SURVIVORS-so-the-ORDER-of-the-rungs-decides',
      'rung-3-a-ONE-SIDED-h2h-record-is-not-comparable',
      'rung-3-a-strict-dominator-wins',
      'rung-3-direction-min-inverts-the-head-to-head',
      'rung-3-has-NO-strict-dominator-and-SKIPS-without-eliminating-anyone',
      'rung-4-BYTE-IDENTICAL-timestamps-fall-through-to-the-shared-rung-5',
      'rung-4-the-MINUS-ONE-sentinel-must-NEVER-win',
      'rung-4-the-earliest-achievement_ts-wins',
      'rung-4-under-direction-min-is-STILL-the-earliest',
      'rung-4-when-EVERY-survivor-is-absent-the-rung-skips-to-rung-5',
      'rung-keys-OMITTED-from-the-award-object-entirely',
      'rung-keys-spelled-as-EMPTY-STRINGS',
      'rung-keys-spelled-as-explicit-JSON-null',
      'the-ladder-NEVER-re-applies-the-FR-21-floors',
    ]);
  });

  // ⭐ 6-4b SHIPPED A "CLOSED SET" THAT WAS NOT CLOSED — nine constants in Go against seven here
  // and seven in the vector. Declaring the set in the anchor and pinning all three against it is
  // the fix, applied here from the first commit rather than after a review.
  it('declares the same closed refusal-detail set this module does', () => {
    expect(vector.refusal_details).toEqual([...LADDER_REFUSAL_DETAILS]);
    expect(Object.isFrozen(LADDER_REFUSAL_DETAILS)).toBe(true);
  });

  it('declares the same five exit steps and the same absent sentinel', () => {
    expect(vector.exit_steps).toEqual([1, 2, 3, 4, 5]);
    expect(BigInt(vector.absent_achievement_ts)).toBe(ABSENT_ACHIEVEMENT_TS);
    expect(ABSENT_ACHIEVEMENT_TS).toBe(-1n);
  });

  // ⭐ THE 17/4 VOCABULARY SPLIT IS PINNED AGAINST THE VECTOR, not trusted. It is the FOURTH
  // restatement of 0023's closed set, and this module cannot import `lib/awards/catalog.ts` (it is
  // `server-only` and would poison the browser bundle), so the shared file is the only thing that
  // can keep the copies honest.
  it('declares the same 17/4 stat vocabulary this module does', () => {
    expect(vector.stat_vocabulary.volume).toEqual([...VOLUME_STAT_KEYS]);
    expect(vector.stat_vocabulary.rate).toEqual([...RATE_STAT_KEYS]);
    expect(VOLUME_STAT_KEYS).toHaveLength(17);
    expect(RATE_STAT_KEYS).toHaveLength(4);
    // A PARTITION: no key is in both halves.
    expect(VOLUME_STAT_KEYS.filter((k) => RATE_STAT_KEYS.includes(k))).toEqual([]);
    // `Object.freeze` is SHALLOW — 6.1 shipped a "frozen" catalog of mutable entries on exactly
    // that mistake. One call suffices only because every element is a primitive; assert that.
    expect(Object.isFrozen(VOLUME_STAT_KEYS)).toBe(true);
    for (const k of VOLUME_STAT_KEYS) expect(typeof k).toBe('string');
  });

  it("declares 'shared' in the Stage-2 outcome kinds both runtimes pin", () => {
    expect(OUTCOME_KINDS).toContain('shared');
  });
});

// ── the conformance gate ───────────────────────────────────────────────────────

describe('resolveLadder conforms to the golden vector', () => {
  it.each(vector.cases.map((c) => [c.name, c] as const))('%s', (_name, tc) => {
    const got = resolveLadder(toAward(tc.award), tc.tied, toPlayers(tc.players));

    // ⭐ THE EXIT STEP IS ASSERTED ON EVERY CASE, not only on the interesting ones. A ladder that
    // reached the RIGHT player by the WRONG rung passes a winner-only assertion, and Story 6.8
    // persists this as `award_result.tie_ladder_exit_step` — so a wrong rung ships a false
    // explanation to the audience.
    expect(got.kind === 'winner' || got.kind === 'shared').toBe(true);
    const step = (got as { ladderExitStep?: number }).ladderExitStep;
    expect(step, tc.note).toBe(tc.expected.ladder_exit_step);

    // ⚠ The XOR: a LADDER-resolved outcome carries an exit step and NO deciding value. A fabricated
    // zero would be a plausible-looking lie that 6.8 renders on stage.
    expect(tc.expected.deciding_value).toBeUndefined();
    expect((got as { decidingValue?: unknown }).decidingValue).toBeUndefined();

    switch (tc.expected.kind) {
      case 'winner':
        expect(got.kind).toBe('winner');
        if (got.kind !== 'winner') throw new Error('unreachable');
        expect(got.steamid64, tc.note).toBe(tc.expected.steamid64);
        expect((got as { winners?: unknown }).winners).toBeUndefined();
        break;

      case 'shared': {
        expect(got.kind).toBe('shared');
        if (got.kind !== 'shared') throw new Error('unreachable');
        expect([...got.winners], tc.note).toEqual(tc.expected.winners);
        // Rung 5 shares the FULL surviving set; a single "shared" winner is a silent argmax.
        expect(got.winners.length).toBeGreaterThanOrEqual(2);
        expect((got as { steamid64?: unknown }).steamid64).toBeUndefined();
        // ⭐ RUNG 5 IS THE ONLY WAY TO BE SHARED, and it is TERMINAL.
        expect(got.ladderExitStep).toBe(5);
        break;
      }

      default:
        // The final arm. A vector that grew a sixth outcome kind must fail loudly here rather than
        // silently skipping the row — 6-4a's review found this suite's Stage-2 switch missing it.
        throw new Error(
          `the vector declares an outcome kind this suite does not check: ${tc.expected.kind}`,
        );
    }
  });
});

// Every refusal row must throw the TYPED error AND carry the DECLARED detail.
//
// ⭐ NEVER MERELY "SOME ERROR". 6-4a measured the cost of an untyped surface (a mutation rejecting
// EVERY input passed all sixteen rows) and 6-4b measured the next level down (with only a class and
// no `detail`, deleting a guard still threw the right class from three functions later).
describe('resolveLadder refuses exactly what the vector says it must', () => {
  it.each(vector.refusals.map((r) => [`${r.detail}/${r.why}`, r] as const))('%s', (_why, r) => {
    let thrown: unknown;
    try {
      resolveLadder(toAward(r.award), r.tied, toPlayers(r.players));
    } catch (err) {
      thrown = err;
    }
    expect(thrown, 'a refusal row RESOLVED').toBeInstanceOf(LadderError);
    expect((thrown as LadderError).detail).toBe(r.detail);
    expect(LADDER_REFUSAL_DETAILS).toContain((thrown as LadderError).detail);
  });
});

// ── the loader rule: absent is absent, however it is spelled ────────────────────

// ⭐ ITS OWN NAMED TEST, because the whole regenerability of `stage2-resolve.json` rests on it. The
// three rows differ ONLY in how absence is written — explicit `null`, the key omitted entirely, and
// the empty string — and their outcomes must be indistinguishable. A loader that turned an absent
// key into a present-but-empty one, or that treated `''` as an invalid vocabulary key, fails here
// and only here.
describe('an absent rung key is absent however it is spelled', () => {
  const names = [
    'rung-keys-spelled-as-explicit-JSON-null',
    'rung-keys-OMITTED-from-the-award-object-entirely',
    'rung-keys-spelled-as-EMPTY-STRINGS',
  ];

  it('produces byte-identical outcomes across all three spellings', () => {
    const outcomes = names.map((name) => {
      const tc = vector.cases.find((c) => c.name === name);
      if (tc === undefined) {
        throw new Error(`the ${name} row is gone — the loader rule is covered by nothing`);
      }
      return resolveLadder(toAward(tc.award), tc.tied, toPlayers(tc.players));
    });
    for (const o of outcomes) expect(o).toEqual(outcomes[0]);
  });

  it('the three rows really do spell absence three different ways', () => {
    // Guards the guard: if a future edit made all three carry `null`, the test above would still
    // pass and would say nothing.
    const awards = names.map((name) => {
      const tc = vector.cases.find((c) => c.name === name);
      if (tc === undefined) throw new Error(`missing row ${name}`);
      return tc.award;
    });
    expect(awards[0]?.secondary_stat).toBeNull();
    expect(Object.hasOwn(awards[1] as object, 'secondary_stat')).toBe(false);
    expect(awards[2]?.secondary_stat).toBe('');
  });
});

// ── guarding the guards ────────────────────────────────────────────────────────
//
// ⭐⭐ EVERY FLAG NAMES THE SPECIFIC ROW IT CLAIMS AND RE-DERIVES THAT ROW'S PROPERTY FROM ITS OWN
// DATA, and each is asserted to be claimed by EXACTLY ONE row — the same guards the Go suite runs,
// written independently against the same file.

describe('the vector coverage is real and uniquely claimed', () => {
  const tsOf = (c: VectorCase, sid: string): string | undefined =>
    c.players.find((p) => p.steamid64 === sid)?.achievement_ts;

  const claim = (name: string, check: (c: VectorCase) => boolean): void => {
    const row = vector.cases.find((c) => c.name === name);
    expect(row, `the row ${name} is gone — the property it carried is covered by nothing`).toBeDefined();
    expect(check(row as VectorCase), `${name} no longer exhibits the property its name claims`).toBe(
      true,
    );
    // Uniqueness: exactly one row satisfies it, so the claim cannot silently migrate to a row that
    // happens to satisfy it for an unrelated reason.
    expect(vector.cases.filter(check)).toHaveLength(1);
  };

  it('the -1 sentinel row genuinely contains a -1 that the naive minimum would have crowned', () => {
    claim('rung-4-the-MINUS-ONE-sentinel-must-NEVER-win', (c) => {
      if (c.expected.kind !== 'winner' || c.expected.ladder_exit_step !== 4) return false;
      const sentinel = c.tied.find((sid) => tsOf(c, sid) === '-1');
      if (sentinel === undefined || sentinel === c.expected.steamid64) return false;
      let naive: string | undefined;
      let best: bigint | undefined;
      for (const sid of c.tied) {
        const raw = tsOf(c, sid);
        if (raw === undefined) return false;
        const n = BigInt(raw);
        if (best === undefined || n < best) [best, naive] = [n, sid];
      }
      return naive === sentinel;
    });
  });

  it('the all-absent row has every tied player at the sentinel and narrows nobody', () => {
    claim(
      'rung-4-when-EVERY-survivor-is-absent-the-rung-skips-to-rung-5',
      (c) =>
        c.expected.kind === 'shared' &&
        c.tied.every((sid) => tsOf(c, sid) === '-1') &&
        c.expected.winners?.length === c.tied.length,
    );
  });

  it('the deferred-work.md:281 row carries two REAL byte-identical timestamps', () => {
    claim('rung-4-BYTE-IDENTICAL-timestamps-fall-through-to-the-shared-rung-5', (c) => {
      if (c.expected.kind !== 'shared' || c.tied.length !== 2) return false;
      const a = tsOf(c, c.tied[0] as string);
      const b = tsOf(c, c.tied[1] as string);
      return a !== undefined && a === b && a !== '-1';
    });
  });

  it('the L3 row eliminates the player holding the strictly earliest timestamp', () => {
    claim('a-width-3-tie-NARROWS-to-2-at-rung-1-and-is-SHARED-at-rung-5', (c) => {
      const winners = c.expected.winners;
      if (c.expected.kind !== 'shared' || winners === undefined) return false;
      if (c.tied.length <= winners.length) return false;
      const eliminated = c.tied.find((sid) => !winners.includes(sid));
      if (eliminated === undefined) return false;
      let holder: string | undefined;
      let earliest: bigint | undefined;
      for (const sid of c.tied) {
        const raw = tsOf(c, sid);
        if (raw === undefined) return false;
        const n = BigInt(raw);
        if (earliest === undefined || n < earliest) [earliest, holder] = [n, sid];
      }
      return holder === eliminated;
    });
  });

  it('the one-sided h2h row really records exactly one direction for some pair', () => {
    claim('rung-3-a-ONE-SIDED-h2h-record-is-not-comparable', (c) => {
      const h2h = new Map(c.players.map((p) => [p.steamid64, p.h2h]));
      return c.tied.some((p) =>
        c.tied.some((q) => {
          if (p === q) return false;
          const hasPq = Object.hasOwn(h2h.get(p) ?? {}, q);
          const hasQp = Object.hasOwn(h2h.get(q) ?? {}, p);
          return hasPq !== hasQp;
        }),
      );
    });
  });

  it("the no-dominator row has nobody beating ALL and more than one beating SOME", () => {
    claim('rung-3-has-NO-strict-dominator-and-SKIPS-without-eliminating-anyone', (c) => {
      const players = new Map(c.players.map((p) => [p.steamid64, p]));
      const key = c.award.deciding_stat;
      let beatsSome = 0;
      for (const p of c.tied) {
        let any = false;
        let all = true;
        for (const q of c.tied) {
          if (p === q) continue;
          const pq = players.get(p)?.h2h[q];
          const qp = players.get(q)?.h2h[p];
          if (pq === undefined || qp === undefined) {
            all = false;
            continue;
          }
          const mine = BigInt(pq[key] as string);
          const theirs = BigInt(qp[key] as string);
          const won = c.award.direction === 'min' ? mine < theirs : mine > theirs;
          if (won) any = true;
          else all = false;
        }
        if (all) return false; // somebody DOES dominate — the row is not what it claims
        if (any) beatsSome++;
      }
      return beatsSome > 1;
    });
  });

  it('the L5 row pairs a VOLUME award with a RATE secondary that decides at rung 1', () => {
    claim(
      'rung-1-a-RATE-secondary-cross-multiplies-and-crosses-CLASS',
      (c) =>
        c.award.class === 'volume' &&
        c.expected.ladder_exit_step === 1 &&
        RATE_STAT_KEYS.includes(c.award.secondary_stat ?? ''),
    );
  });

  it('the rung-2 row is one the NAIVE single-pair compare gets backwards', () => {
    claim('rung-2-a-ratio-of-two-ratios-the-naive-single-pair-compare-gets-BACKWARDS', (c) => {
      const numKey = c.award.eff_num_key;
      if (c.expected.kind !== 'winner' || c.expected.ladder_exit_step !== 2) return false;
      if (numKey === undefined || numKey === null || numKey === '') return false;
      if (c.award.eff_den_key === undefined || c.award.eff_den_key === null) return false;
      // ⚠ The rung-ORDER row also configures both efficiency keys and also exits at step 2, so
      // without this clause two rows claim the property. THIS row alone is a PURE rung-2 decision.
      const sec = c.award.secondary_stat;
      if (sec !== undefined && sec !== null && sec !== '') return false;
      // The naive compare: `efficiency[eff_num_key]` alone, cross-multiplied, ignoring the
      // denominator KEY entirely. If it ever agrees with the real rung, this row proves nothing.
      let naive: string | undefined;
      let bestN = 0n;
      let bestD = 0n;
      for (const sid of c.tied) {
        const pair = c.players.find((p) => p.steamid64 === sid)?.stats_int.efficiency[numKey];
        if (pair === undefined) return false;
        const n = BigInt(pair.num);
        const d = BigInt(pair.den);
        if (naive === undefined || n * bestD > bestN * d) [naive, bestN, bestD] = [sid, n, d];
      }
      return naive !== undefined && naive !== c.expected.steamid64;
    });
  });

  it('the arithmetic-width row genuinely exceeds 2^53 on every operand', () => {
    claim('rung-2-four-term-products-past-2-pow-53', (c) => {
      const numKey = c.award.eff_num_key;
      if (numKey === undefined || numKey === null || numKey === '') return false;
      const two53 = 2n ** 53n;
      return (
        c.players.length >= 2 &&
        c.players.every((p) => {
          const pair = p.stats_int.efficiency[numKey];
          return pair !== undefined && BigInt(pair.num) >= two53;
        })
      );
    });
  });

  it('the S3 rows carry a genuine zero denominator at rung 1 and at rung 2', () => {
    claim('rung-1-a-zero-denominator-secondary-ties-everyone-S3-verbatim', (c) => {
      const key = c.award.secondary_stat;
      if (key === undefined || key === null || key === '') return false;
      return c.players.some((p) => {
        const v = p.stats_int.secondary[key];
        return typeof v === 'object' && v.den === '0';
      });
    });
    claim('rung-2-a-zero-denominator-ratio-behaves-as-PLUS-INFINITY', (c) => {
      const key = c.award.eff_den_key;
      if (key === undefined || key === null || key === '') return false;
      return c.players.some((p) => p.stats_int.efficiency[key]?.num === '0');
    });
  });

  it('every one of the five rungs is exited at by at least one case', () => {
    const reached = new Set(vector.cases.map((c) => c.expected.ladder_exit_step));
    for (const step of vector.exit_steps) expect([...reached]).toContain(step);
  });
});

// ── the port, and what it refuses ──────────────────────────────────────────────

describe('the FR-29 ladder through the injected port', () => {
  it.each(vector.cases.map((c) => [c.name, c] as const))(
    '%s agrees with the pure entry point',
    (_name, tc) => {
      const award = toAward(tc.award);
      const players = toPlayers(tc.players);
      const tie: TieOutcome = { kind: 'tie', tied: tc.tied, reason: 'equal_value' };
      expect(fr29Ladder.resolve(award, tie, players)).toEqual(
        resolveLadder(award, tc.tied, players),
      );
    },
  );

  // ⛔ DECISION K — a `no_awardable_value` outcome CARRIES a tied set, and the ladder must refuse to
  // resolve it. Resolving it would re-crown the 27-way zero tie DECISION E exists to suppress.
  it.each(['no_awardable_value', 'no_eligible_players', 'winner', 'shared'])(
    'refuses a %s outcome handed to the port',
    (kind) => {
      const award: Award = {
        decidingStat: 'kills',
        class: 'volume',
        direction: 'max',
        floorRounds: 0,
        floorKills: 0,
      };
      const players: SnapshotPlayer[] = [
        { steamid64: '1', roundsPlayed: 0n, kills: 0n, idleDq: false, volume: {}, rate: {}, achievementTs: 1n },
        { steamid64: '2', roundsPlayed: 0n, kills: 0n, idleDq: false, volume: {}, rate: {}, achievementTs: 2n },
      ];
      const notATie = { kind, tied: ['1', '2'] } as unknown as TieOutcome;
      expect(() => fr29Ladder.resolve(award, notATie, players)).toThrow(LadderError);
      try {
        fr29Ladder.resolve(award, notATie, players);
      } catch (err) {
        expect((err as LadderError).detail).toBe('tied');
      }
    },
  );

  it('is frozen, so the injected ladder cannot be swapped at runtime', () => {
    expect(Object.isFrozen(fr29Ladder)).toBe(true);
  });
});

// ── local guards over states the shared vector cannot represent ────────────────
//
// ⭐ EVERY LOCAL REFUSAL ASSERTS ITS `detail`, FROM THE START. The 6-4b review found this suite's
// Stage-1 local table asserting only the error CLASS, which left two guards mutation-invisible.

describe('local refusals the vector cannot express', () => {
  const player = (over: Partial<SnapshotPlayer> & { steamid64: string }): SnapshotPlayer => ({
    roundsPlayed: 30n,
    kills: 20n,
    idleDq: false,
    volume: {},
    rate: {},
    achievementTs: 1000n,
    ...over,
  });
  const award: Award = {
    decidingStat: 'kills',
    class: 'volume',
    direction: 'max',
    floorRounds: 0,
    floorKills: 0,
  };
  const roster = [player({ steamid64: '11' }), player({ steamid64: '22', achievementTs: 2000n })];

  const expectDetail = (fn: () => unknown, detail: string): void => {
    let thrown: unknown;
    try {
      fn();
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(LadderError);
    expect((thrown as LadderError).detail).toBe(detail);
  };

  it('an ABSENT secondary block is the EMPTY block, so it lands on the absent-KEY refusal', () => {
    // ⚠ NOT a container refusal: Go cannot tell a nil map from an empty one, so `undefined` must
    // behave here as nil behaves there. The absent KEY is what refuses, one line later — the right
    // answer for the right reason.
    expectDetail(
      () => resolveLadder({ ...award, secondaryStat: 'hs_kills' }, ['11', '22'], roster),
      'player',
    );
  });

  it('a NULL secondary block is refused — a state Go cannot express, so it is not vectorable', () => {
    expectDetail(
      () =>
        resolveLadder({ ...award, secondaryStat: 'hs_kills' }, ['11', '22'], [
          player({ steamid64: '11', secondary: null as unknown as Record<string, StatValue> }),
          roster[1] as SnapshotPlayer,
        ]),
      'player',
    );
  });

  it('an ARRAY where a block belongs is refused', () => {
    expectDetail(
      () =>
        resolveLadder({ ...award, secondaryStat: 'hs_kills' }, ['11', '22'], [
          player({ steamid64: '11', secondary: [] as unknown as Record<string, StatValue> }),
          roster[1] as SnapshotPlayer,
        ]),
      'player',
    );
  });

  it('an absent achievementTs is a refusal, never a zero', () => {
    expectDetail(
      () =>
        resolveLadder(award, ['11', '22'], [
          player({ steamid64: '11', achievementTs: undefined }),
          roster[1] as SnapshotPlayer,
        ]),
      'player',
    );
  });

  it('a non-array roster is refused rather than throwing a bare TypeError', () => {
    expectDetail(
      () => resolveLadder(award, ['11', '22'], null as unknown as SnapshotPlayer[]),
      'player',
    );
  });

  it('a tied member absent from the roster is refused as `tied`', () => {
    expectDetail(() => resolveLadder(award, ['11', '33'], roster), 'tied');
  });

  it('an empty deciding stat refuses at the Stage-2 surface, before the vocabulary check', () => {
    expectDetail(() => resolveLadder({ ...award, decidingStat: '' }, ['11', '22'], roster), 'stage2');
  });

  it('a duplicate player row is refused', () => {
    expectDetail(
      () => resolveLadder(award, ['11', '22'], [...roster, player({ steamid64: '11' })]),
      'player',
    );
  });

  it('a shelf-shaped prototype key is not mistaken for an h2h opponent', () => {
    // ⛔ `Object.hasOwn`, not a bare lookup: a plain object inherits `constructor` and friends, so a
    // bare `mine[q]` can return a FUNCTION for an opponent who is not in the map. Go's map has no
    // such hazard, so without the guard the two halves of the seam disagree on an input neither
    // would report. Here the "opponent" is named `constructor`, which every object has.
    const a = player({ steamid64: '11', h2h: {}, achievementTs: 1000n });
    const b = player({ steamid64: '22', h2h: {}, achievementTs: 2000n });
    const got = resolveLadder(award, ['11', '22'], [a, b]);
    expect(got.kind).toBe('winner');
    if (got.kind !== 'winner') throw new Error('unreachable');
    // Rung 3 skipped (nobody comparable), so rung 4's earlier timestamp decides.
    expect(got.steamid64).toBe('11');
    expect(got.ladderExitStep).toBe(4);
  });
});

// ── the pure stage still cannot resolve a tie ──────────────────────────────────

// ⭐ ASSERTED OVER EVERY CASE IN `stage2-resolve.json`, NOT ONCE. `resolveStage2` must never return
// the new `shared` arm and never a non-absent exit step: the fifth arm exists only because a LADDER
// produced it.
describe('the PURE Stage 2 never produces a ladder outcome', () => {
  const stage2 = JSON.parse(readFileSync(STAGE2_PATH, 'utf8')) as {
    cases: { name: string; award: VectorAward; players: VectorPlayer[] }[];
  };

  it.each(stage2.cases.map((c) => [c.name, c] as const))('%s', (_name, tc) => {
    // The Stage-2 fixtures carry no FR-29 blocks at all, which is itself the point: those award
    // objects omit all three rung keys, and this file must keep loading them unchanged.
    const players = tc.players.map((r) => {
      const volume: Record<string, bigint> = {};
      for (const [k, v] of Object.entries(r.stats_int.volume)) volume[k] = big(k, v);
      const rate: Record<string, RatePair> = {};
      for (const [k, v] of Object.entries(r.stats_int.rate)) {
        rate[k] = { num: big(k, v.num), den: big(k, v.den) };
      }
      return {
        steamid64: r.steamid64,
        roundsPlayed: big('rounds_played', r.rounds_played),
        kills: big('kills', r.kills),
        idleDq: r.idle_dq,
        volume,
        rate,
      } satisfies SnapshotPlayer;
    });

    const got: Outcome = resolveStage2(toAward(tc.award), players);
    expect(got.kind).not.toBe('shared');
    expect((got as { ladderExitStep?: unknown }).ladderExitStep).toBeUndefined();
    expect((got as { winners?: unknown }).winners).toBeUndefined();
  });
});
