import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  LadderRefusedError,
  OUTCOME_KINDS,
  Stage2Error,
  TIE_REASONS,
  refusingLadder,
  resolveAward,
  resolveStage2,
} from './stage2';
import type { Award, Ladder, Outcome, SnapshotPlayer, TieOutcome } from './stage2';

// NOTE: `node:fs` is imported HERE, in the test. The banned-`node:` rule applies to the shipped
// modules (scanned in prng.test.ts), not to the suite that reads the vector files off disk.

// ── the shared contract ────────────────────────────────────────────────────────
//
// These tests read `roulette/vectors/stage2-resolve.json` AT RUNTIME. The values are NEVER
// transcribed into TypeScript literals: a hard-coded copy greens on the day the vector is
// regenerated and silently stops testing the contract. `npm test` runs with cwd = the repo root.

const VECTOR_PATH = path.join(process.cwd(), 'roulette', 'vectors', 'stage2-resolve.json');

interface VectorAward {
  deciding_stat: string;
  class: string;
  direction: string;
  floor_rounds: number;
  floor_kills: number;
}

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

interface VectorExpected {
  kind: string;
  steamid64?: string;
  deciding_value?: { class: string; value?: string; num?: string; den?: string };
  tied?: string[];
  reason?: string;
}

interface VectorCase {
  name: string;
  note: string;
  award: VectorAward;
  players: VectorPlayer[];
  expected: VectorExpected;
}

interface VectorRefusal {
  why: string;
  award: VectorAward;
  players: VectorPlayer[];
}

const vector = JSON.parse(readFileSync(VECTOR_PATH, 'utf8')) as {
  vector: string;
  algo_version: string;
  outcome_kinds: string[];
  tie_reasons: string[];
  refusals: VectorRefusal[];
  cases: VectorCase[];
};

/**
 * Parse one vector magnitude.
 *
 * ⛔ THE SHAPE IS CHECKED BEFORE `BigInt` SEES IT. A bare `BigInt(s)` is a LENIENT parser:
 * `BigInt('')` is `0n`, `BigInt(' 5 ')` is `5n` and `BigInt('0x10')` is `16n` — while Go's
 * `SetString(s, 10)` refuses all three. Handing a malformed row straight to `BigInt` would turn
 * a drifted vector into a silently different number here and a named failure there, which is
 * exactly the cross-language divergence this directory exists to catch.
 *
 * ⚠ THE PARITY CLAIM USED TO BE FALSE IN ONE DIRECTION, and the 6-4a code review measured it:
 * `SetString(s, 10)` ACCEPTS a leading `+`, so a magnitude written `"+5"` loaded in Go and hard
 * -failed here. The Go loader now shape-checks with the same `^-?[0-9]+$` first, so the two
 * loaders accept exactly the same string set — which is what makes this guard a drift detector
 * rather than a source of drift.
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
  };
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
    return {
      steamid64: r.steamid64,
      roundsPlayed: big(`${r.steamid64}.rounds_played`, r.rounds_played),
      kills: big(`${r.steamid64}.kills`, r.kills),
      idleDq: r.idle_dq,
      volume,
      rate,
    };
  });
}

// ── the conformance gate ───────────────────────────────────────────────────────

describe('stage2-resolve.json conformance', () => {
  it('loaded the right file, with cases and refusals', () => {
    expect(vector.vector).toBe('stage2-resolve');
    expect(vector.cases.length).toBeGreaterThan(0);
    expect(vector.refusals.length).toBeGreaterThan(0);
  });

  // ⭐ THE CASE-NAME SET IS PINNED BY EXACT EQUALITY, mirroring the module-list assertion in
  // `prng.test.ts` and the Go suite's own file-set pin.
  //
  // The 6-4a code review measured why `length > 0` is not enough: deleting
  // `volume-min-zero-is-awardable`, `rate-max-zero-numerator-is-awardable`,
  // `volume-max-single-eligible-at-zero-no-awardable-value`, `volume-max-nonzero-best-over-zeros`
  // and `an-absent-key-on-an-INELIGIBLE-player-is-not-an-error` left every coverage flag below
  // still satisfied by surviving rows, `--check` still OK, and both suites green — so DECISION E's
  // entire SCOPE became untested. Adding a case reddens this deliberately.
  it('carries exactly the expected case set', () => {
    expect([...vector.cases.map((c) => c.name)].sort()).toEqual([
      'an-absent-RATE-key-on-an-INELIGIBLE-player-is-not-an-error',
      'an-absent-key-on-an-INELIGIBLE-player-is-not-an-error',
      'byte-lex-is-a-string-order-not-a-numeric-one',
      'floor-kills-zero-still-compares',
      'floors-are-inclusive-at-the-boundary',
      'floors-exclude-everyone',
      'idle-dq-excluded',
      'idle-dq-leaves-nobody-eligible',
      'players-supplied-out-of-byte-lex-order',
      'rate-max-cross-multiplication-only',
      'rate-max-equal-cross-product-different-pairs',
      'rate-max-positive-numerator-over-zero-beats-every-finite-rate',
      'rate-max-realistic-adr',
      'rate-max-zero-numerator-is-awardable',
      'rate-min-el-inofensivo',
      'rate-min-equal-cross-product-tie',
      'rate-zero-denominator-clears-a-real-floor',
      'rate-zero-denominator-is-equal-to-everyone',
      'rate-zero-denominator-pair-ties',
      'volume-max-all-zero-no-awardable-value',
      'volume-max-equal-integer-tie',
      'volume-max-nonzero-best-over-zeros',
      'volume-max-plain',
      'volume-max-single-eligible-at-zero-no-awardable-value',
      'volume-max-three-way-tie',
      'volume-min-equal-integer-tie',
      'volume-min-plain',
      'volume-min-zero-is-awardable',
    ]);
  });

  it.each(vector.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const got = resolveStage2(toAward(c.award), toPlayers(c.players));
    expect(got.kind, c.note).toBe(c.expected.kind);

    if (got.kind === 'winner') {
      expect(got.steamid64, c.note).toBe(c.expected.steamid64);
      const want = c.expected.deciding_value;
      expect(want).toBeDefined();
      // ⭐ THE XOR STORY 6.5 INTRODUCED, ASSERTED HERE ON EVERY STAGE-2 WINNER. `decidingValue`
      // became OPTIONAL when the ladder gained its own winner arm — a ladder-resolved winner
      // carries `ladderExitStep` and NO value, because the tie it resolved carried none and L12
      // forbids re-deriving one. The PURE stage is the other half of that XOR: it must always set
      // the value and never the step. Narrowing here rather than asserting `!== undefined` would
      // let a Stage-2 regression that dropped the value slip through as "optional, so absent".
      const decidingValue = got.decidingValue;
      expect(decidingValue, c.note).toBeDefined();
      if (decidingValue === undefined) throw new Error('unreachable');
      expect(got.ladderExitStep, 'the pure stage ran no ladder').toBeUndefined();
      expect(decidingValue.class).toBe(want?.class);
      if (decidingValue.class === 'volume') {
        expect(decidingValue.value).toBe(big('expected', want?.value ?? ''));
      } else {
        expect(decidingValue.num).toBe(big('expected.num', want?.num ?? ''));
        expect(decidingValue.den).toBe(big('expected.den', want?.den ?? ''));
      }
    } else if (got.kind === 'tie') {
      // ⭐ ORDER IS PART OF THE ANSWER. The set is byte-lex, so this compares positionally rather
      // than as sets — a resolver that returned the right players in the FIXTURE's order would
      // pass a set comparison.
      expect(got.tied, c.note).toEqual(c.expected.tied);
      expect(got.reason, c.note).toBe(c.expected.reason);
      // ⭐ THE LADDER SEAM, DRIVEN BY THE VECTOR. Every tie row in the file is also run through
      // resolveAward with the refusing ladder, so "a tie refuses loudly" is part of the shared
      // conformance gate rather than one hand-written local case. Without this, catching the
      // ladder's refusal inside resolveAward reddens only a local test.
      let refused: unknown;
      try {
        resolveAward(toAward(c.award), toPlayers(c.players), refusingLadder);
      } catch (e) {
        refused = e;
      }
      expect(refused, 'the refusal was swallowed').toBeInstanceOf(LadderRefusedError);
      expect((refused as LadderRefusedError).outcome.tied).toEqual(c.expected.tied);
    } else if (got.kind === 'no_awardable_value') {
      // ⭐ DECISION E CARRIES THE SUPPRESSED SET (6-4a code review). The zero check runs BEFORE
      // the `|best| === 1` branch, so this list is the tie that never formed and its length is
      // the width 6.5 / 6.6 / 6.7 would otherwise never see. Compared positionally — the order
      // is byte-lex, exactly as on a tie.
      expect(got.tied, c.note).toEqual(c.expected.tied);
      expect(got.tied.length, 'the suppressed width was discarded').toBeGreaterThan(0);
      expect(Object.keys(got).sort()).toEqual(['kind', 'tied']);
    } else if (got.kind === 'no_eligible_players') {
      // No winner, no tied set, no reason — the union already forbids them; this proves the
      // OBJECT carries none either, so a resolver returning residue reddens.
      expect(Object.keys(got)).toEqual(['kind']);
    } else {
      // ⛔ THE FINAL ARM. Go ends its switch with a fatal "the vector declares an outcome kind
      // this suite does not check"; without this, a fifth kind added to the vector would be
      // gated in ONE language only — asserted by kind string here and never by payload.
      throw new Error(
        `the vector declares an outcome kind this suite does not check: ${JSON.stringify(
          (got as { kind: string }).kind,
        )}`,
      );
    }
  });

  // The inputs both runtimes must REFUSE travel in the vector, so the two suites cannot drift
  // into two independently hand-written lists — the asymmetry the 6.3 review measured costing a
  // surviving mutation.
  it.each(vector.refusals.map((r) => [r.why, r] as const))('refuses %s', (_why, r) => {
    expect(() => resolveStage2(toAward(r.award), toPlayers(r.players))).toThrow(Stage2Error);
  });

  // If the vector's closed sets and this module's constants ever drift, the two runtimes
  // disagree about what Stage 2 can even conclude.
  it('declares the same closed sets as the module', () => {
    expect(vector.outcome_kinds).toEqual([...OUTCOME_KINDS]);
    expect(vector.tie_reasons).toEqual([...TIE_REASONS]);
    expect(vector.algo_version).toBe('inclusivcup-roulette-1.0.0');
  });

  it('deep-freezes the exported closed sets (Object.freeze is SHALLOW — 6.1 shipped a mutable "frozen" catalog)', () => {
    for (const frozen of [OUTCOME_KINDS, TIE_REASONS]) {
      expect(Object.isFrozen(frozen)).toBe(true);
      // Every element is a primitive, so there is nothing left to freeze — assert that rather
      // than assuming it.
      for (const value of frozen) expect(typeof value).toBe('string');
    }
    expect(Object.isFrozen(refusingLadder)).toBe(true);
  });
});

// ── the vector must CONTAIN the rows that carry the story's weight ────────────
//
// A suite that passes because the interesting rows quietly disappeared is the failure this
// guards. Same shape as the 6.3 coverage test, and for the same reason.

describe('stage2-resolve.json covers the hard cases', () => {
  it('covers every shape the story turns on', () => {
    let sawEqualValueTie = false;
    let sawEqualCrossTie = false;
    let sawWideTie = false;
    let sawMinDirection = false;
    let sawZeroDenominator = false;
    let sawNoEligible = false;
    let sawNoAwardable = false;
    let sawIdleExclusion = false;
    let sawUnsortedInput = false;
    let sawLexNotNumeric = false;
    let sawFloatDivergence = false;
    let sawFloorBoundary = false;
    let sawKillsFloorEdge = false;

    for (const c of vector.cases) {
      if (c.award.direction === 'min') sawMinDirection = true;
      if (c.expected.kind === 'no_eligible_players') sawNoEligible = true;
      if (c.expected.kind === 'no_awardable_value') sawNoAwardable = true;
      if (c.expected.kind === 'tie') {
        if (c.expected.reason === 'equal_value') sawEqualValueTie = true;
        if (c.expected.reason === 'equal_cross_product') sawEqualCrossTie = true;
        if ((c.expected.tied ?? []).length >= 3) sawWideTie = true;
      }

      const ids = c.players.map((p) => p.steamid64);
      for (const p of c.players) {
        if (p.idle_dq) sawIdleExclusion = true;
        // ⭐ BOTH AXES, tracked separately. The 6-4a code review measured that only the ROUNDS
        // floor was guarded while the message claimed to cover `>=` vs `>` generally: editing the
        // one row engineered for it from kills=20 to kills=25 let `kills >= floorKills` -> `>`
        // survive the entire vector with this flag still green.
        if (c.award.floor_rounds > 0 && p.rounds_played === String(c.award.floor_rounds)) {
          sawFloorBoundary = true;
        }
        if (c.award.floor_kills > 0 && p.kills === String(c.award.floor_kills)) {
          sawKillsFloorEdge = true;
        }
        const pair = p.stats_int.rate[c.award.deciding_stat];
        if (pair !== undefined && pair.den === '0') sawZeroDenominator = true;
      }
      for (let i = 1; i < ids.length; i++) {
        if ((ids[i - 1] as string) > (ids[i] as string)) sawUnsortedInput = true;
      }
      // ⭐ Byte-lex and NUMERIC order agree on every 17-digit id, so a numeric-sort mutation is
      // invisible unless some case carries ids whose two orders differ.
      for (const a of ids) {
        for (const b of ids) {
          const lex = a < b ? -1 : a > b ? 1 : 0;
          const num = BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0;
          if (lex !== 0 && num !== 0 && lex !== num) sawLexNotNumeric = true;
        }
      }

      // ⭐ THE CASE THAT ONLY EXACT ARITHMETIC GETS RIGHT. Recompute the whole case the naive way
      // — parse each `{num,den}` as a Number and divide — and record whether that reverses any
      // pairwise verdict. Without a pair the two methods DISAGREE on, "compared by
      // cross-multiplication" is untested and a float implementation passes every other row.
      //
      // ⛔ BOTH DENOMINATORS MUST BE NON-ZERO, and only ELIGIBLE players count. The 6-4a code
      // review measured that without those two conditions this flag was VACUOUS: `naiveQuotient`
      // returns 0 when the denominator is 0, so `rate-zero-denominator-is-equal-to-everyone`
      // (A = 0/0, B = 10/5) makes exact = 0 and naive = -1 disagree for a reason that has nothing
      // to do with precision — and `rate-max-cross-multiplication-only`, the (2^53+1)/(2^53+2)
      // row this story calls its headline, could then be deleted with every gate green.
      if (c.award.class === 'rate') {
        const eligible = eligibleRows(c);
        for (const a of eligible) {
          for (const b of eligible) {
            const pa = a.stats_int.rate[c.award.deciding_stat];
            const pb = b.stats_int.rate[c.award.deciding_stat];
            if (pa === undefined || pb === undefined) continue;
            if (pa.den === '0' || pb.den === '0') continue;
            const exact = sign(BigInt(pa.num) * BigInt(pb.den) - BigInt(pb.num) * BigInt(pa.den));
            const naive = sign(naiveQuotient(pa) - naiveQuotient(pb));
            if (exact !== naive) sawFloatDivergence = true;
          }
        }
      }
    }

    expect({
      sawEqualValueTie,
      sawEqualCrossTie,
      sawWideTie,
      sawMinDirection,
      sawZeroDenominator,
      sawNoEligible,
      sawNoAwardable,
      sawIdleExclusion,
      sawUnsortedInput,
      sawLexNotNumeric,
      sawFloatDivergence,
      sawFloorBoundary,
      sawKillsFloorEdge,
    }).toEqual({
      sawEqualValueTie: true,
      sawEqualCrossTie: true,
      sawWideTie: true, // a resolver returning a PAIR passes every 2-way case and fails a 3-way
      sawMinDirection: true,
      sawZeroDenominator: true,
      sawNoEligible: true,
      sawNoAwardable: true, // DECISION E
      sawIdleExclusion: true,
      sawUnsortedInput: true, // the resolver's own sort is exercised, not the fixture's order
      sawLexNotNumeric: true, // without it a numeric sort passes the whole file
      sawFloatDivergence: true, // ELIGIBLE players, NON-ZERO denominators — otherwise vacuous
      sawFloorBoundary: true, // `>=` vs `>` is otherwise indistinguishable
      sawKillsFloorEdge: true, // …and the kills half needs its own row
    });
  });
});

/**
 * Re-applies the FR-21 floors over a case's raw rows, so a coverage probe measures the players
 * the resolver would actually COMPARE rather than every row in the fixture. Deliberately
 * re-derived from the vector's own fields: calling `resolveStage2` would make the probe agree
 * with the implementation by construction.
 */
function eligibleRows(c: VectorCase): VectorPlayer[] {
  const floorRounds = BigInt(c.award.floor_rounds);
  const floorKills = BigInt(c.award.floor_kills);
  return c.players.filter(
    (p) =>
      !p.idle_dq && BigInt(p.rounds_played) >= floorRounds && BigInt(p.kills) >= floorKills,
  );
}

const sign = (v: bigint | number): number => (v > 0 ? 1 : v < 0 ? -1 : 0);

/**
 * The WRONG implementation, on purpose: convert both halves to `Number` and divide, exactly as a
 * well-meaning implementer who never read S4 would. It exists only so the coverage test above can
 * prove the vector contains a pair the two methods disagree on.
 */
function naiveQuotient(pair: { num: string; den: string }): number {
  const den = Number(pair.den);
  return den === 0 ? 0 : Number(pair.num) / den;
}

// ── the outcome is invariant under input order ────────────────────────────────

describe('the outcome does not depend on the caller ordering the players', () => {
  it.each(vector.cases.map((c) => [c.name, c] as const))(
    '%s is invariant under permutation',
    (_name, c) => {
      const award = toAward(c.award);
      const base = toPlayers(c.players);
      const want = resolveStage2(award, base);

      const permutations: Array<readonly [string, SnapshotPlayer[]]> = [
        ['reversed', [...base].reverse()],
      ];
      for (let shift = 1; shift < base.length; shift++) {
        permutations.push([`rotated-by-${String(shift)}`, [...base.slice(shift), ...base.slice(0, shift)]]);
      }
      for (const [how, players] of permutations) {
        expect(resolveStage2(award, players), how).toEqual(want);
      }
    },
  );

  it('does not reorder the caller array', () => {
    const players = toPlayers([
      vectorPlayer('300', 30, 20, { knife_kills: 1 }),
      vectorPlayer('100', 30, 20, { knife_kills: 5 }),
      vectorPlayer('200', 30, 20, { knife_kills: 3 }),
    ]);
    const before = players.map((p) => p.steamid64);
    resolveStage2(volumeAward('knife_kills', 'max', 0, 0), players);
    expect(players.map((p) => p.steamid64)).toEqual(before);
  });
});

// ── the ladder PORT (DECISION B) ──────────────────────────────────────────────

describe('the FR-29 ladder is an injected port whose 6-4a implementation refuses', () => {
  const tiedPlayers = () =>
    toPlayers([
      vectorPlayer('76561198000000022', 30, 20, { knife_kills: 7 }),
      vectorPlayer('76561198000000011', 30, 20, { knife_kills: 7 }),
    ]);
  const award = volumeAward('knife_kills', 'max', 0, 0);

  it('hands the WHOLE tie AND the WHOLE roster to the ladder, and returns what it concludes', () => {
    const seen: TieOutcome[] = [];
    // ⭐⭐ THE SPY RECORDS `players` TOO (Story 6-5b AC6, landed at the code review). Go's
    // `spyLadder` has captured and asserted the third argument since it was written — "the SAME
    // roster, in the SAME order, not a copy filtered or sorted on the way through" — and this side
    // took only two parameters, so a `resolveAward` that handed the ladder a re-filtered or
    // re-ordered roster reddened NOTHING here. AC6 named this item explicitly and it was the one
    // entry on its list with no artefact anywhere in the diff; the Completion Notes enumerated six
    // TS gains and silently dropped the seventh.
    const rosters: SnapshotPlayer[][] = [];
    const spy: Ladder = {
      resolve(_a: Award, tie: TieOutcome, players: SnapshotPlayer[]): Outcome {
        seen.push(tie);
        rosters.push(players);
        return { kind: 'winner', steamid64: '76561198000000022', decidingValue: { class: 'volume', value: 7n } };
      },
    };

    const roster = tiedPlayers();
    const got = resolveAward(award, roster, spy);
    expect(seen).toHaveLength(1);
    // The ladder receives the tie WHOLE — the full set and the reason, not a pre-picked player.
    expect(seen[0]).toEqual({
      kind: 'tie',
      tied: ['76561198000000011', '76561198000000022'],
      reason: 'equal_value',
    });
    // …and the roster WHOLE: the same rows, in the same order, not a copy filtered or sorted on the
    // way through. ⚠ Note the roster here is in the OPPOSITE order to the (byte-lex sorted) tied
    // set, which is what makes "not sorted on the way through" a real assertion rather than a
    // coincidence of the fixture.
    expect(rosters).toHaveLength(1);
    expect(rosters[0]).toEqual(roster);
    expect(rosters[0]?.map((p) => p.steamid64)).toEqual([
      '76561198000000022',
      '76561198000000011',
    ]);
    expect(got).toEqual({
      kind: 'winner',
      steamid64: '76561198000000022',
      decidingValue: { class: 'volume', value: 7n },
    });
  });

  it.each([
    ['a clear winner', [vectorPlayer('76561198000000011', 30, 20, { knife_kills: 7 }), vectorPlayer('76561198000000022', 30, 20, { knife_kills: 2 })]],
    ['no eligible players', [vectorPlayer('76561198000000011', 1, 0, { knife_kills: 7 })]],
    ['no awardable value', [vectorPlayer('76561198000000011', 30, 20, { knife_kills: 0 }), vectorPlayer('76561198000000022', 30, 20, { knife_kills: 0 })]],
  ] as const)('never consults the ladder for %s', (_name, rows) => {
    let calls = 0;
    const spy: Ladder = {
      resolve(): Outcome {
        calls += 1;
        return { kind: 'no_eligible_players' };
      },
    };
    resolveAward(volumeAward('knife_kills', 'max', 24, 0), toPlayers([...rows]), spy);
    expect(calls).toBe(0);
  });

  // ⭐ THE REFUSAL MUST PROPAGATE. Catching it here would turn a refusal into a silent tie-shaped
  // success, which is precisely the invisible outcome DECISION B exists to prevent.
  it('propagates the refusing ladder, with the tie readable on the error', () => {
    let thrown: unknown;
    try {
      resolveAward(award, tiedPlayers(), refusingLadder);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(LadderRefusedError);
    const refused = thrown as LadderRefusedError;
    // It names the story that supplies the real ladder…
    expect(refused.message).toContain('6.5');
    // …and carries the tie whole, so 6-4b's provisionalWinner can read the tied set rather than
    // only a message. This is the JS mirror of Go returning `(Outcome, error)` together.
    expect(refused.outcome).toEqual({
      kind: 'tie',
      tied: ['76561198000000011', '76561198000000022'],
      reason: 'equal_value',
    });
    expect(refused.award.decidingStat).toBe('knife_kills');
  });

  it('the refusing ladder is the module default and there is no fallback that picks a winner', () => {
    // A fallback that exists is a fallback someone wires into production. The only exported
    // Ladder must refuse.
    expect(() =>
      refusingLadder.resolve(
        award,
        { kind: 'tie', tied: ['1', '2'], reason: 'equal_value' },
        // ⭐ THE PORT CARRIES THE PLAYERS SINCE STORY 6.5 — rungs 1-4 read four snapshot blocks
        // that are on neither an `Award` nor a tie's `string[]`. `refusingLadder` SURVIVES that
        // widening and stays refusing (DECISION J): it is what every tie row in this file is driven
        // through, and 6-4a's mutation M13 only became vector-killable that way.
        [],
      ),
    ).toThrow(LadderRefusedError);
  });

  it.each([null, undefined, {}, 'ladder'])('refuses a ladder that is not one: %p', (bad) => {
    expect(() => resolveAward(award, tiedPlayers(), bad as unknown as Ladder)).toThrow(Stage2Error);
  });
});

// ── S4 directly: the arithmetic really is exact ───────────────────────────────

describe('S4 — cross-multiplication is exact at every width', () => {
  it('decides a pair that a Number implementation gets backwards', () => {
    // (2^53+1)/(2^53+2) vs 2^53/(2^53+1). Exactly, the first is larger — the cross-products
    // differ by ONE in ~2^106. As doubles, 2^53+1 rounds to 2^53 in BOTH fractions, so the naive
    // quotients are 2^53/(2^53+2) < 1 and 1.0 — the float compare picks the OTHER player.
    const two53 = 9007199254740992n;
    const players = toPlayers([
      ratePlayer('76561198000000011', two53 + 1n, two53 + 2n),
      ratePlayer('76561198000000022', two53, two53 + 1n),
    ]);
    const got = resolveStage2(rateAward('entry_success', 'max', 0, 0), players);
    expect(got).toEqual({
      kind: 'winner',
      steamid64: '76561198000000011',
      decidingValue: { class: 'rate', num: two53 + 1n, den: two53 + 2n },
    });

    // …and the naive computation really does disagree, so this test is not passing for a smaller
    // reason than it claims.
    const naive = Number(two53 + 1n) / Number(two53 + 2n) - Number(two53) / Number(two53 + 1n);
    expect(naive).toBeLessThan(0);
  });
});

// ── S1 / S2 / S7 as direct assertions ─────────────────────────────────────────

describe('S1 — direction inverts BEST and only best', () => {
  const players = () =>
    toPlayers([
      vectorPlayer('76561198000000011', 30, 20, { deaths: 9 }),
      vectorPlayer('76561198000000022', 30, 20, { deaths: 22 }),
    ]);

  it('max and min pick opposite players over the same field', () => {
    const max = resolveStage2(volumeAward('deaths', 'max', 0, 0), players());
    const min = resolveStage2(volumeAward('deaths', 'min', 0, 0), players());
    expect(max.kind === 'winner' && max.steamid64).toBe('76561198000000022');
    expect(min.kind === 'winner' && min.steamid64).toBe('76561198000000011');
  });

  it('does not invert the FLOORS with it (DECISION C)', () => {
    // `El Inofensivo`'s shape: a `min` award still EXCLUDES the player short of the floors, even
    // though they hold the "best" (lowest) value. That is anti-qualification, it is deliberate,
    // and deferred-work.md:268 homed the measurement here rather than a resolver special-case.
    const got = resolveStage2(
      volumeAward('deaths', 'min', 24, 20),
      toPlayers([
        vectorPlayer('76561198000000011', 10, 20, { deaths: 1 }),
        vectorPlayer('76561198000000022', 30, 20, { deaths: 9 }),
      ]),
    );
    expect(got.kind === 'winner' && got.steamid64).toBe('76561198000000022');
  });
});

describe('S2 — the floors are inclusive and BOTH apply', () => {
  it.each([
    ['exactly on both floors', 24, 20, true],
    ['one round short', 23, 20, false],
    ['one kill short', 24, 19, false],
    ['comfortably over', 40, 33, true],
  ] as const)('%s', (_name, rounds, kills, wantEligible) => {
    const got = resolveStage2(
      rateAward('adr', 'max', 24, 20),
      toPlayers([ratePlayer('76561198000000011', 100n, BigInt(rounds), rounds, kills)]),
    );
    expect(got.kind !== 'no_eligible_players').toBe(wantEligible);
  });
});

// ⭐ The two running-champion accidents, stated as their own test so the intent is unmissable at
// the implementation site. The tie sits at the FIRST and LAST positions of the iteration order,
// so `>` keeps A, `>=` keeps C, and only a set keeps both.
describe('S7 — best is a SET, never a running champion', () => {
  it('returns both ends of the iteration order', () => {
    const got = resolveStage2(
      volumeAward('knife_kills', 'max', 0, 0),
      toPlayers([
        vectorPlayer('76561198000000011', 30, 20, { knife_kills: 7 }),
        vectorPlayer('76561198000000022', 30, 20, { knife_kills: 6 }),
        vectorPlayer('76561198000000033', 30, 20, { knife_kills: 7 }),
      ]),
    );
    expect(got).toEqual({
      kind: 'tie',
      tied: ['76561198000000011', '76561198000000033'],
      reason: 'equal_value',
    });
  });
});

// ⛔ THE ROSTER IS GUARDED WITH THE MODULE'S OWN ERROR, not a built-in throw. Go returned a typed
// outcome for a nil slice and a typed refusal for a zero-value row, while this side threw a bare
// `TypeError: players is not iterable` from the spread — indistinguishable from an incidental
// failure, which is the exact confusion `Stage2Error` was introduced to end. Found by the 6-4a
// code review.
describe('the roster itself is validated', () => {
  const award = volumeAward('knife_kills', 'max', 0, 0);
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a plain object', {}],
    ['a string', 'players'],
  ])('refuses a players argument that is %s', (_name, bad) => {
    expect(() => resolveStage2(award, bad as unknown as SnapshotPlayer[])).toThrow(Stage2Error);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', '76561198000000011'],
  ])('refuses a roster containing %s', (_name, bad) => {
    const rows = [
      ...toPlayers([vectorPlayer('76561198000000011', 30, 20, { knife_kills: 7 })]),
      bad as unknown as SnapshotPlayer,
    ];
    expect(() => resolveStage2(award, rows)).toThrow(Stage2Error);
  });
});

// ⭐ DECISION E's outcome carries the set it suppressed, at both widths. The vector pins the
// values; this pins that the WIDTH is the thing being carried, which is what 6.6's anti-sweep and
// 6.7's pity need and what a bare kind would have thrown away.
describe('DECISION E reports the width of the tie it suppressed', () => {
  it('carries all four players of a whole-field zero', () => {
    const got = resolveStage2(
      volumeAward('knife_kills', 'max', 0, 0),
      toPlayers([
        vectorPlayer('76561198000000044', 30, 20, { knife_kills: 0 }),
        vectorPlayer('76561198000000011', 30, 20, { knife_kills: 0 }),
        vectorPlayer('76561198000000033', 30, 20, { knife_kills: 0 }),
        vectorPlayer('76561198000000022', 30, 20, { knife_kills: 0 }),
      ]),
    );
    expect(got).toEqual({
      kind: 'no_awardable_value',
      // Byte-lex, exactly as a tie would be — not the fixture's order.
      tied: [
        '76561198000000011',
        '76561198000000022',
        '76561198000000033',
        '76561198000000044',
      ],
    });
  });

  it('carries a single-element set when one lone eligible player sat at zero', () => {
    const got = resolveStage2(
      volumeAward('knife_kills', 'max', 24, 0),
      toPlayers([
        vectorPlayer('76561198000000011', 30, 20, { knife_kills: 0 }),
        vectorPlayer('76561198000000022', 10, 20, { knife_kills: 9 }),
      ]),
    );
    expect(got).toEqual({ kind: 'no_awardable_value', tied: ['76561198000000011'] });
  });
});

describe('the award itself is validated', () => {
  const players = () => toPlayers([vectorPlayer('76561198000000011', 30, 20, { kills: 20 })]);
  it.each([
    ['empty deciding stat', { decidingStat: '', class: 'volume', direction: 'max', floorRounds: 0, floorKills: 0 }],
    ['class outside the enum', { decidingStat: 'kills', class: 'ratio', direction: 'max', floorRounds: 0, floorKills: 0 }],
    ['direction outside the enum', { decidingStat: 'kills', class: 'volume', direction: 'highest', floorRounds: 0, floorKills: 0 }],
    ['negative floor', { decidingStat: 'kills', class: 'volume', direction: 'max', floorRounds: -1, floorKills: 0 }],
    ['non-integer floor', { decidingStat: 'kills', class: 'volume', direction: 'max', floorRounds: 1.5, floorKills: 0 }],
  ])('refuses %s', (_name, award) => {
    expect(() => resolveStage2(award as Award, players())).toThrow(Stage2Error);
  });
});

// ── fixtures ──────────────────────────────────────────────────────────────────
//
// These build VECTOR-SHAPED rows and run them through the same `toPlayers` the conformance gate
// uses, so a hand-written case cannot accidentally exercise a different construction path than
// the vector does.

function volumeAward(stat: string, direction: 'max' | 'min', floorRounds: number, floorKills: number): Award {
  return { decidingStat: stat, class: 'volume', direction, floorRounds, floorKills };
}

function rateAward(stat: string, direction: 'max' | 'min', floorRounds: number, floorKills: number): Award {
  return { decidingStat: stat, class: 'rate', direction, floorRounds, floorKills };
}

function vectorPlayer(
  steamid64: string,
  rounds: number,
  kills: number,
  volume: Record<string, number>,
  idleDq = false,
): VectorPlayer {
  const vol: Record<string, string> = {};
  for (const [k, v] of Object.entries(volume)) vol[k] = String(v);
  vol['kills'] = String(kills);
  vol['rounds_played'] = String(rounds);
  return {
    steamid64,
    rounds_played: String(rounds),
    kills: String(kills),
    idle_dq: idleDq,
    stats_int: {
      volume: vol,
      rate: { adr: { num: '0', den: String(rounds) }, entry_success: { num: '0', den: String(rounds) } },
    },
  };
}

function ratePlayer(steamid64: string, num: bigint, den: bigint, rounds = 30, kills = 20): VectorPlayer {
  const row = vectorPlayer(steamid64, rounds, kills, {});
  row.stats_int.rate = {
    adr: { num: String(num), den: String(den) },
    entry_success: { num: String(num), den: String(den) },
  };
  return row;
}
