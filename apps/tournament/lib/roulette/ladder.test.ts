import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ABSENT_ACHIEVEMENT_TS,
  LADDER_EXIT_ACHIEVED,
  LADDER_EXIT_EFFICIENCY,
  LADDER_EXIT_H2H,
  LADDER_EXIT_SECONDARY,
  LADDER_EXIT_SHARED,
  LADDER_EXIT_STEPS,
  LADDER_REFUSAL_DETAILS,
  LadderError,
  RATE_STAT_KEYS,
  VOLUME_STAT_KEYS,
  fr29Ladder,
  resolveLadder,
} from './ladder';
import { OUTCOME_KINDS, Stage2Error, resolveStage2 } from './stage2';
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

/**
 * Source with `//` and slash-star comments removed, string and template literals PRESERVED.
 *
 * ⭐ THE TYPESCRIPT COUNTERPART OF GO'S `productionSources`, added at the Story 6-5b code review.
 * Any test that scans shipped source for a needle must scan the CODE, or the needle is satisfied by
 * the very comment that describes it — which is what happened here: `ladder.ts` carries
 * `antisymmetric comparator` in both a comment and the refusal message, so the `internal`-producer
 * test passed over a `ladder.ts` with the refusal deleted. Go's twin says so in its own comment and
 * strips; this side did not.
 *
 * ⚠ STRING LITERALS ARE KEPT, and that is not incidental — every needle this is used for IS a
 * string literal (`'internal'`, the refusal messages). A stripper that also removed them would make
 * every assertion vacuously false rather than vacuously true, which is a different bug, not a fix.
 * The regex-free character walk is deliberate: `//` inside a string (a URL, a path) must not start
 * a comment, and a regex that "handles" that is the classic place this goes wrong.
 */
function stripComments(source: string): string {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const ch = source[i] as string;
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      out += ch;
      i += 1;
      while (i < source.length) {
        const c = source[i] as string;
        out += c;
        i += 1;
        if (c === '\\') {
          out += source[i] ?? '';
          i += 1;
          continue;
        }
        if (c === quote) break;
      }
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

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
    // ⭐ `secondary`, `efficiency` AND `h2h` ARE ALL OPTIONAL AND ALL CLASS-SHAPED (Story 6-5b).
    //
    // OPTIONAL: an ABSENT container is the EMPTY container, and every row emitted all three blocks
    // until this pass — so `container(undefined)` here and Go's nil-map read there were entered by
    // NOTHING, while `stage1-pick.json` treats exactly that shape as load-bearing.
    //
    // CLASS-SHAPED for `efficiency`: every real entry is a `{num, den}` pair, so on every honest row
    // this reads exactly what the narrower type read. What it buys is that a NON-PAIR is expressible
    // at all — `efficiencyPair`'s "incomplete {num, den} pair" refusal is live in all three
    // implementations and had no row anywhere, because the loader could not carry the shape.
    secondary?: Record<string, VectorStat>;
    efficiency?: Record<string, VectorStat>;
  };
  h2h?: Record<string, Record<string, VectorStat>>;
  // Optional so an OMITTED value stays distinguishable from the sentinel — it is a SCALAR, not a
  // container, so "absent is the empty case" does not apply.
  // ⭐ `| null` SO THE TWO LOADERS AGREE (Story 6-5b, T6): Go's field is a `*string`, which
  // `encoding/json` leaves nil for BOTH an explicit `null` and an omitted key. This side saw
  // `undefined` for the omission and `null` for the explicit form, so a regeneration that emitted
  // nulls would have reddened one suite and greened the other over one shared file.
  achievement_ts?: string | null;
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
  declared_divergences: VectorDeclaredDivergence[];
  refusals: VectorRefusal[];
  cases: VectorCase[];
};

/**
 * A cross-language divergence the vector DECLARES rather than resolves — an input whose refusal label
 * legitimately differs between the runtimes, with the argument for why it is deliberate.
 *
 * ⭐⭐ IT IS NOT ROW-REPRESENTABLE, WHICH IS EXACTLY WHY IT NEEDS AN INSPECTOR. A vector row is a set
 * of INPUTS, and this input (a non-array roster) cannot exist in Go at all, whose parameter is typed
 * `[]SnapshotPlayer`. So `deferred-work.md:326` is closed "in data" as AC9 permits — but data nothing
 * reads is, in this file's own words, "a compartment, not a contract". Story 6.11 emitted the block
 * and its code review found that NEITHER runtime inspected it; this is the TypeScript half.
 */
interface VectorDeclaredDivergence {
  input: string;
  typescript: string;
  go: string;
  python: string;
  row_representable: boolean;
  why_not: string;
  resolution: string;
}

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

/**
 * A minimal well-formed award, used as the base for the DELIBERATELY malformed ones below.
 *
 * ⚠ It exists so the Stage-2 surface tests vary exactly ONE field from a known-good award. A
 * hand-written malformed literal can be malformed in a second way by accident, and then the test
 * passes for the wrong reason — which is the same "malformed twice with nothing to see it" shape
 * the doubly-malformed refusal rows exist to pin.
 */
const BASE_AWARD: Award = {
  decidingStat: 'kills',
  class: 'volume',
  direction: 'max',
  floorRounds: 0,
  floorKills: 0,
};

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
    // ⚠ `undefined` WHEN THE VECTOR OMITS THE BLOCK, never `{}` — coercing it here would move the
    // "an absent container is the empty container" rule out of `ladder.ts` and into this loader,
    // making the row test the test.
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
        // ⚠ A BARE MAGNITUDE STAYS A NON-PAIR rather than becoming a loader failure — that IS the
        // input state `efficiencyPair`'s incomplete-pair refusal is about, and the only way the
        // shared file can express it. The cast is deliberate and named: the value is knowingly not a
        // `RatePair`, which is exactly what the module under test must notice.
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
      // ⚠ Left UNDEFINED when the vector omits the key — the refusal row for an absent scalar
      // depends on that, and coercing it to a zero here would make the row untestable.
      // ⚠ `== null` catches BOTH `null` and `undefined`, which is what makes this loader agree with
      // Go's `*string` — see the note on the field above.
      achievementTs:
        r.achievement_ts == null
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
      'ABSENT-secondary-efficiency-and-h2h-BLOCKS-are-the-EMPTY-blocks',
      'a-NON-TIED-player-with-a-CORRUPT-ts-and-a-DOMINANT-h2h-is-INVISIBLE-to-BOTH',
      'a-RATE-class-award-cross-multiplies-its-h2h-PAIRS-at-rung-3',
      'a-RATE-class-award-with-a-VOLUME-secondary-crosses-CLASS-the-OTHER-way',
      'a-player-who-is-NOT-in-the-tied-set-is-INVISIBLE-to-every-rung',
      'a-width-3-tie-NARROWS-to-2-at-rung-1-and-is-SHARED-at-rung-5',
      'an-achievement_ts-of-ZERO-is-a-REAL-timestamp-and-WINS-rung-4',
      'an-achievement_ts-past-2-pow-53-is-compared-EXACTLY',
      'rung-1-RESOLVES-and-RETURNS-even-though-rung-2-and-h2h-are-CONFIGURED',
      'rung-1-a-RATE-secondary-cross-multiplies-and-crosses-CLASS',
      'rung-1-a-VOLUME-secondary-breaks-the-tie',
      'rung-1-a-zero-denominator-secondary-ties-everyone-S3-verbatim',
      'rung-1-direction-min-inverts-the-secondary',
      'rung-1-is-SKIPPED-when-secondary_stat-is-NULL',
      'rung-2-NARROWS-without-resolving-and-the-NEXT-rung-runs-over-the-SURVIVORS',
      'rung-2-RATE-efficiency-keys-give-the-product-FOUR-non-trivial-terms',
      'rung-2-RESOLVES-and-RETURNS-even-though-h2h-is-POPULATED',
      'rung-2-a-ZERO-OVER-ZERO-ratio-is-UNELIMINABLE-and-rides-to-the-next-rung',
      'rung-2-a-ratio-of-two-ratios-the-naive-single-pair-compare-gets-BACKWARDS',
      'rung-2-a-zero-denominator-ratio-behaves-as-PLUS-INFINITY',
      'rung-2-an-INFINITE-and-a-ZERO-OVER-ZERO-ratio-are-EQUAL-and-BOTH-ride-through',
      'rung-2-four-term-products-past-2-pow-53',
      'rung-2-is-SKIPPED-when-both-efficiency-keys-are-NULL',
      'rung-2-runs-over-rung-1s-SURVIVORS-so-the-ORDER-of-the-rungs-decides',
      'rung-2-under-direction-min-a-ZERO-DENOMINATOR-ratio-LOSES-to-every-finite-one',
      'rung-2-under-direction-min-picks-the-SMALLEST-ratio',
      'rung-3-a-ONE-SIDED-h2h-record-is-not-comparable',
      'rung-3-a-dominator-must-beat-EVERY-other-survivor-not-merely-ONE',
      'rung-3-a-strict-dominator-wins',
      'rung-3-direction-min-inverts-the-head-to-head',
      'rung-3-has-NO-strict-dominator-and-SKIPS-without-eliminating-anyone',
      'rung-3-runs-over-rung-1s-SURVIVORS-so-a-DOMINATOR-emerges-the-full-tie-had-not',
      'rung-4-BYTE-IDENTICAL-timestamps-fall-through-to-the-shared-rung-5',
      'rung-4-NARROWS-and-the-SENTINEL-holder-is-EXCLUDED-from-the-shared-set',
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
    // ⭐ PINNED AGAINST THE MODULE'S OWN CONSTANTS, NOT AGAINST A TRANSCRIBED LITERAL (Story 6-5b,
    // T6). `expect(vector.exit_steps).toEqual([1, 2, 3, 4, 5])` compared the vector with a copy of
    // itself: a module that renumbered a rung reddened only where the literal had been written down,
    // which is the exact "never transcribe a vector value into source" rule this directory is built
    // on. Go asserted against `LadderExit*` from the first commit; this side did not have constants
    // to assert against until now.
    expect(vector.exit_steps).toEqual([...LADDER_EXIT_STEPS]);
    expect(Object.isFrozen(LADDER_EXIT_STEPS)).toBe(true);
    expect(BigInt(vector.absent_achievement_ts)).toBe(ABSENT_ACHIEVEMENT_TS);
    expect(ABSENT_ACHIEVEMENT_TS).toBe(-1n);
  });

  it('declares the same algo_version this suite expects', () => {
    expect(vector.algo_version).toBe('inclusivcup-roulette-1.0.0');
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

  // ⭐ SET EQUALITY, NOT `toContain` (Story 6-5b, T6). `toContain('shared')` cannot see a SIXTH kind
  // added on this side alone — and Go pins `OUTCOME_KINDS` by exact equality, so the two halves of
  // the seam were held to different standards over one shared list. The kinds are named here rather
  // than read from the vector on purpose: this assertion is about the MODULE's declared set, and the
  // vector's `outcome_kinds` is pinned against it separately in `stage2.test.ts`.
  it('pins the Stage-2 outcome kinds by SET EQUALITY, and `shared` is one of them', () => {
    expect([...OUTCOME_KINDS]).toEqual([
      'winner',
      'tie',
      'no_eligible_players',
      'no_awardable_value',
      'shared',
    ]);
    expect(OUTCOME_KINDS).toContain('shared');
    expect(Object.isFrozen(OUTCOME_KINDS)).toBe(true);
  });

  // ⭐⭐ EVERY DECLARED `detail` IS EITHER EXERCISED BY A ROW OR DECLARED UNREACHABLE, IN WORDS.
  //
  // This mirrors the machinery `stage1.test.ts` already ships and that the ladder suites did not
  // copy. Before it, both suites pinned `refusal_details` as a five-element set and then iterated
  // whatever rows happened to exist — so EVERY `award` row, or EVERY `player` row, could have been
  // deleted from the vector and only "the array is non-empty" would have noticed. A closed set
  // nothing inspects is a compartment, not a contract. (Story 6-5b, T5.)
  it('exercises every ROW-REPRESENTABLE detail and NO unrepresentable one', () => {
    // ⚠ Spelled out rather than re-sliced: a slice bound is the kind of thing a later append
    // silently shifts, and the point of the split is that adding a detail forces a decision.
    const rowRepresentable = ['stage2', 'award', 'tied', 'player'];
    const unrepresentable = ['internal'];
    expect(rowRepresentable.length + unrepresentable.length).toBe(LADDER_REFUSAL_DETAILS.length);

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

  // ⭐ `internal` IS DECLARED UNREACHABLE, AND IT HAS **TWO** PRODUCERS WITH GENUINELY DIFFERENT
  // ARGUMENTS. Naming them separately is the obligation the non-representability creates:
  //
  //   1. RUNG 3'S PLURAL DOMINATOR — unreachable by ANTISYMMETRY. `compareStatValues(a,b) ===
  //      -compareStatValues(b,a)`, so `p` beating `q` means `q` does not beat `p`, so two players
  //      can never both beat everyone.
  //   2. `bestSurvivors`' EMPTY BEST SET — unreachable by ACYCLICITY, which is STRICTLY WEAKER than
  //      transitivity, and the comparator genuinely does NOT have transitivity: `0/0` compares equal
  //      to everything, so `0/0 ~ 10/5` and `0/0 ~ 6/5` while `10/5 > 6/5`. Every non-empty set has
  //      an unbeaten member while the strict part is acyclic — and a NEGATIVE magnitude is what
  //      breaks acyclicity, which is why the negative-magnitude refusals are the same mechanism
  //      described at another site.
  //
  // This asserts what CAN be asserted about an unreachable path: both producers exist in the shipped
  // source, both refuse with `internal`, and no row reaches either. It cannot drive them, and saying
  // so is the point. (Story 6-5b, T5.)
  it('declares BOTH `internal` producers, with their different unreachability arguments', () => {
    // ⛔⛔ THE SCAN IS OVER COMMENT-STRIPPED SOURCE, AND THAT IS THE WHOLE POINT OF THE TEST.
    // Go's twin has read through `productionSources` (which strips comments) since it was written,
    // and its comment says exactly why: "A scan over raw text would have been satisfied by this
    // very doc comment." This side then did the raw scan Go warns against — and `ladder.ts` carries
    // `antisymmetric comparator` in BOTH a comment and the refusal message, so DELETING the whole
    // `throw new LadderError('internal', 'antisymmetric comparator …')` left the needle matching
    // the surviving comment: TypeScript green, Go red, over one shared rule. A one-sided gate
    // created by the very pass that was closing one. (Story 6-5b code review, 2026-08-06.)
    const source = stripComments(readFileSync(new URL('./ladder.ts', import.meta.url), 'utf8'));
    // A positive control on the stripper itself — a needle that exists ONLY in a comment must be
    // GONE. Without this the test passes just as well over an identity function.
    expect(
      source,
      'stripComments left comment text behind — every needle below is then meaningless',
    ).not.toContain('see the note above');
    for (const needle of [
      'antisymmetric comparator', // producer 1, rung 3's plural dominator
      "the comparator's strict part", // producer 2, the empty best set
      'cannot compare a ', // the class-mismatch guard, `internal`'s third site
    ]) {
      expect(source, `ladder.ts no longer contains the "${needle}" refusal`).toContain(needle);
    }
    // ⚠ EXACT EQUALITY, NOT `>= 3`. The threshold was slack: `'internal'` appears FIVE times in
    // `ladder.ts`, so two producers could be deleted before a `>= 3` count noticed. Pinning the
    // real number means a deletion reddens here immediately, and an addition forces the same
    // deliberate decision the case-name set forces.
    expect(
      source.split("'internal'").length - 1,
      "the number of `'internal'` sites in ladder.ts changed — add its unreachability argument above, or say why one went",
    ).toBe(5);
    for (const r of vector.refusals) {
      expect(r.detail, `${r.why} declares \`internal\`, which no INPUT can produce`).not.toBe(
        'internal',
      );
    }
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
        // ⚠ THE CONSTANT, NOT THE LITERAL `5`. AC6 named `toBe(5)` by name alongside `[1,2,3,4,5]`;
        // only the array was converted, so the one assertion the constants were introduced for kept
        // its transcribed copy. A module that renumbered rung 5 would have reddened only where the
        // literal was written down — the exact defect `LADDER_EXIT_*` exists to remove.
        expect(got.ladderExitStep).toBe(LADDER_EXIT_SHARED);
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

    // ⛔ A PROPAGATED STAGE-2 REFUSAL MUST STILL IDENTIFY WHERE IT CAME FROM (Story 6-5b, T6).
    // Go's suite has asserted `errors.Is(err, ErrStage2)` on every `stage2` row since the first
    // commit; this side asserted nothing, and `ladder.ts` attached no `cause` — so a TypeScript
    // implementation that SWALLOWED the propagation and threw a fresh `LadderError('stage2', …)`
    // passed every refusal row in the file. One-sided gates over a shared vector are the shape
    // this directory exists to prevent, and this was one.
    if (r.detail === 'stage2') {
      expect(
        (thrown as LadderError).cause,
        'a `stage2` refusal carries no cause — the propagation was swallowed',
      ).toBeInstanceOf(Stage2Error);
    }
  });
});

// ── the cross-language asymmetries this suite used to have (Story 6-5b, T6) ────

describe('the gates Go had and this suite did not', () => {
  it('does NOT mutate the caller`s tied set or roster, over every vector case', () => {
    // ⭐ Go has driven `TestLadderDoesNotMutateItsInputs` over every case since the first commit and
    // this side had no counterpart, so a future `tied.sort()` here reddened nothing. L12 in test
    // form: the ladder reads the set AS GIVEN — it never sorts, re-filters or re-derives.
    // ⛔ CONTENTS, NOT ONLY ORDERING. It compared `steamid64` joins alone, so an implementation
    // that sorted a player's `h2h` opponent map, mutated a `volume` entry or replaced a `RatePair`
    // in place passed — while the stated invariant is the far broader "reads the set AS GIVEN,
    // never sorts, re-filters or re-derives". A deep snapshot taken BEFORE the call is the only
    // formulation that covers what the sentence claims. (Story 6-5b code review, 2026-08-06.)
    const deep = (v: unknown): string =>
      JSON.stringify(v, (_k, x: unknown) => (typeof x === 'bigint' ? `${x}n` : x));
    for (const tc of vector.cases) {
      const tied = [...tc.tied];
      const before = tied.join(',');
      const players = toPlayers(tc.players);
      const order = players.map((p) => p.steamid64);
      const snapshot = deep(players);
      resolveLadder(toAward(tc.award), tied, players);
      expect(tied.join(','), `${tc.name}: the ladder reordered the caller's tied array`).toBe(before);
      expect(
        players.map((p) => p.steamid64).join(','),
        `${tc.name}: the ladder reordered the caller's players array`,
      ).toBe(order.join(','));
      expect(
        deep(players),
        `${tc.name}: the ladder MUTATED the caller's roster — a block, a pair or a magnitude changed under it`,
      ).toBe(snapshot);
    }
  });

  it('refuses a NON-DECIMAL steamid64 in the tied set, so STEAMID64_RE is not dead here', () => {
    // ⭐ Go has had this local row from the first commit; this suite had none, so the regex was dead
    // to it — deleting it reddened only the other language.
    const award: Award = {
      decidingStat: 'kills',
      class: 'volume',
      direction: 'max',
      floorRounds: 0,
      floorKills: 0,
    };
    const roster: SnapshotPlayer[] = [
      { steamid64: '11', roundsPlayed: 30n, kills: 20n, idleDq: false, volume: {}, rate: {}, achievementTs: 1000n },
      { steamid64: '2x', roundsPlayed: 30n, kills: 20n, idleDq: false, volume: {}, rate: {}, achievementTs: 2000n },
    ];
    let thrown: unknown;
    try {
      resolveLadder(award, ['11', '2x'], roster);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(LadderError);
    expect((thrown as LadderError).detail).toBe('tied');
  });

  it('classifies every vocabulary key and REFUSES one outside it (the classOfStatKey probe)', () => {
    // ⭐ Go probes `classOfStatKey` directly because the suite is in-package. `classOfStatKey` is
    // module-private here, so the probe goes through the observable surface instead: every one of
    // the 21 keys must be usable as a secondary (it classifies), and a key outside the vocabulary
    // must refuse as `award` (L5's refusal is reachable rather than dead).
    const award: Award = {
      decidingStat: 'kills',
      class: 'volume',
      direction: 'max',
      floorRounds: 0,
      floorKills: 0,
    };
    const roster: SnapshotPlayer[] = [
      { steamid64: '11', roundsPlayed: 30n, kills: 20n, idleDq: false, volume: {}, rate: {}, achievementTs: 1000n },
      { steamid64: '22', roundsPlayed: 30n, kills: 20n, idleDq: false, volume: {}, rate: {}, achievementTs: 2000n },
    ];
    for (const key of [...VOLUME_STAT_KEYS, ...RATE_STAT_KEYS]) {
      let thrown: unknown;
      try {
        resolveLadder({ ...award, secondaryStat: key }, ['11', '22'], roster);
      } catch (err) {
        thrown = err;
      }
      // It classifies, so it gets past the AWARD group and lands on the absent-KEY refusal instead.
      expect((thrown as LadderError).detail, `${key} did not classify`).toBe('player');
    }
    let thrown: unknown;
    try {
      resolveLadder({ ...award, secondaryStat: 'not_a_stat' }, ['11', '22'], roster);
    } catch (err) {
      thrown = err;
    }
    expect((thrown as LadderError).detail).toBe('award');
  });

  it('exercises ALL FOUR clauses of the TRANSCRIBED Stage-2 award surface', () => {
    // ⭐ `ladder.ts` TRANSCRIBES `stage2.ts`'s private `validateAward` instead of calling it, and says
    // so at the site — Go CALLS the real function and therefore cannot drift, while this side can.
    // Only the `direction` clause had a vector row, so three of the four could have drifted from
    // `stage2.ts` with every gate green. This asserts a row exists for each, by the input each one
    // rejects, so "the same four clauses" is checkable rather than trusted. (Story 6-5b, T10/AC8.)
    const stage2Rows = vector.refusals.filter((r) => r.detail === 'stage2');
    const clauses: readonly [string, (r: VectorRefusal) => boolean][] = [
      ['decidingStat must be a non-empty string', (r) => r.award.deciding_stat === ''],
      ['class must be volume|rate', (r) => r.award.class !== 'volume' && r.award.class !== 'rate'],
      ['direction must be max|min', (r) => r.award.direction !== 'max' && r.award.direction !== 'min'],
      ['floors must be non-negative', (r) => r.award.floor_rounds < 0 || r.award.floor_kills < 0],
    ];
    for (const [name, matches] of clauses) {
      expect(
        stage2Rows.some(matches),
        `no vector row rejects "${name}" — that clause of the transcription is unpinned`,
      ).toBe(true);
    }

    // ⛔⛔ AND THE MESSAGES ARE COMPARED AGAINST THE REAL `stage2.ts`, NOT AGAINST A TRANSCRIBED
    // COPY. `expect(clauses).toHaveLength(4)` asserted the length of an array literal declared
    // eleven lines above — it could not fail under any implementation of anything, and it replaced
    // the one check that would have caught what was actually wrong: the transcription had ALREADY
    // DRIFTED. `ladder.ts` spelled clause 4 with an ASCII `'` where `stage2.ts` uses U+2019, so
    // `refuse`'s "the same typed error `stage2.ts` would have thrown" was observably a DIFFERENT
    // error, one character apart, while the test compared no messages at all.
    //
    // ⭐ This drives BOTH sides with the same malformed award and requires the `cause` this module
    // constructs to equal — byte for byte — what `resolveStage2` actually throws. That is the only
    // formulation that cannot itself drift: it holds no copy of the text.
    // (Story 6-5b code review, 2026-08-06.)
    const roster: SnapshotPlayer[] = [
      { steamid64: '11', roundsPlayed: 30n, kills: 20n, idleDq: false, volume: {}, rate: {}, achievementTs: 1000n },
      { steamid64: '22', roundsPlayed: 30n, kills: 20n, idleDq: false, volume: {}, rate: {}, achievementTs: 2000n },
    ];
    const malformed: readonly [string, Award][] = [
      ['decidingStat', { ...BASE_AWARD, decidingStat: '' }],
      ['class', { ...BASE_AWARD, class: 'speed' as Award['class'] }],
      ['direction', { ...BASE_AWARD, direction: 'sideways' as Award['direction'] }],
      ['floors', { ...BASE_AWARD, floorKills: -1 }],
    ];
    expect(malformed).toHaveLength(clauses.length);
    for (const [clause, award] of malformed) {
      let fromStage2: unknown;
      try {
        resolveStage2(award, roster);
      } catch (err) {
        fromStage2 = err;
      }
      let fromLadder: unknown;
      try {
        resolveLadder(award, ['11', '22'], roster);
      } catch (err) {
        fromLadder = err;
      }
      expect(fromStage2, `${clause}: stage2.ts did not refuse its own clause`).toBeInstanceOf(
        Stage2Error,
      );
      expect(fromLadder, `${clause}: the ladder did not propagate`).toBeInstanceOf(LadderError);
      expect((fromLadder as LadderError).detail).toBe('stage2');
      expect(
        ((fromLadder as LadderError).cause as Error | undefined)?.message,
        `${clause}: the transcribed clause has DRIFTED from stage2.ts — the propagated cause is not the error stage2.ts throws for the same award`,
      ).toBe((fromStage2 as Error).message);
    }
  });

  it('reads a JSON `null` achievement_ts exactly as Go`s pointer loader does — as ABSENT', () => {
    // ⭐ THE TWO LOADERS AGREE ON `null` (Story 6-5b, T6). Go's field is a `*string`, so `null` and an
    // omitted key both arrive as nil; this side's is `string | undefined`, and `JSON.parse` gives
    // `null` for the former and `undefined` for the latter. A regeneration that emitted explicit
    // nulls would have reddened one suite and greened the other — so the loader below coerces both
    // to `undefined`, and this asserts it does.
    // ⛔⛔ IT DRIVES `toPlayers`, THE REAL LOADER. It used to assert `null ?? undefined === undefined`
    // — a JavaScript language tautology that never called the loader and could not fail for ANY
    // implementation, sitting under a comment claiming "the loader below coerces both to
    // `undefined`, and this asserts it does". It did not. Worse, NO row in `ladder-resolve.json`
    // carries an explicit `null` (0 explicit nulls, 1 omitted key across all 73 case+refusal rows),
    // so the loader branch this protects was exercised by nothing at all: reverting `== null` to
    // `=== undefined` reddened nowhere. Both halves are now driven through the loader with a
    // synthetic row, which is the only way to reach the branch at all.
    // (Story 6-5b code review, 2026-08-06.)
    const base = {
      steamid64: '11',
      rounds_played: '30',
      kills: '20',
      idle_dq: false,
      stats_int: { volume: {}, rate: {} },
    };
    const [explicitNull] = toPlayers([
      JSON.parse(JSON.stringify({ ...base, achievement_ts: null })) as VectorPlayer,
    ]);
    const [omittedKey] = toPlayers([JSON.parse(JSON.stringify(base)) as VectorPlayer]);
    expect(
      explicitNull?.achievementTs,
      'an explicit JSON `null` achievement_ts did not load as ABSENT',
    ).toBeUndefined();
    expect(
      omittedKey?.achievementTs,
      'an OMITTED achievement_ts did not load as ABSENT',
    ).toBeUndefined();
    // ⭐ AND THE TWO SPELLINGS ARE INDISTINGUISHABLE AFTER LOADING, which is the property Go gets
    // for free from `*string` and this side has to produce.
    expect(explicitNull).toEqual(omittedKey);
    // …and a ladder-resolved outcome never carries a deciding value, however the vector spells it.
    for (const tc of vector.cases) {
      expect(tc.expected.deciding_value ?? undefined).toBeUndefined();
    }
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
    c.players.find((p) => p.steamid64 === sid)?.achievement_ts ?? undefined;

  const rowOf = (c: VectorCase, sid: string): VectorPlayer | undefined =>
    c.players.find((p) => p.steamid64 === sid);

  /**
   * The FOUR-TERM rung-2 ratio for one player, derived from the ROW'S OWN award keys.
   *
   * ⭐ It takes the keys from `c.award`, never from a literal — T4's finding stated as code: a guard
   * that names a key can only describe the fixture it was written against.
   */
  const rung2Ratio = (c: VectorCase, sid: string): [bigint, bigint] | undefined => {
    const numKey = c.award.eff_num_key;
    const denKey = c.award.eff_den_key;
    if (!numKey || !denKey) return undefined;
    const eff = rowOf(c, sid)?.stats_int.efficiency;
    if (eff === undefined) return undefined;
    const n = eff[numKey];
    const d = eff[denKey];
    if (n === undefined || d === undefined || typeof n === 'string' || typeof d === 'string') {
      return undefined;
    }
    return [BigInt(n.num) * BigInt(d.den), BigInt(n.den) * BigInt(d.num)];
  };

  /** Whether SOME tied player's COMPUTED rung-2 ratio is exactly `0/0` — S3's equal-to-everything
   * half, as opposed to `n/0`, which beats everything. */
  const anyZeroOverZero = (c: VectorCase): boolean =>
    c.tied.some((sid) => {
      const r = rung2Ratio(c, sid);
      return r !== undefined && r[0] === 0n && r[1] === 0n;
    });

  /** Whether SOME tied player's COMPUTED rung-2 ratio is `n/0` with `n > 0` — S3's
   * beats-every-finite-value half, the opposite degenerate shape to `0/0`. */
  const anyInfinite = (c: VectorCase): boolean =>
    c.tied.some((sid) => {
      const r = rung2Ratio(c, sid);
      return r !== undefined && r[1] === 0n && r[0] > 0n;
    });

  const hasH2H = (c: VectorCase): boolean =>
    c.tied.some((sid) => Object.keys(rowOf(c, sid)?.h2h ?? {}).length > 0);

  /**
   * The COUNTERFACTUAL helpers, added at the Story 6-5b code review.
   *
   * ⭐ Several claims asserted only the SHAPE of the outcome — "it exited at rung 2", "h2h is
   * populated" — where the anchor's `pins_inputs` re-derived the counterfactual that makes the row
   * load-bearing: that the OTHER rung would have crowned somebody else. A claim that cannot see the
   * disagreement cannot notice when a fixture edit removes it, and the row silently becomes
   * ordinary while continuing to report the property as covered.
   *
   * ⚠ They re-implement `beats` from the row's own `direction` and `deciding_stat` rather than
   * calling the shipped comparator: a guard that used the implementation under test to decide
   * whether the implementation is right would be circular.
   */
  const beatsValue = (c: VectorCase, a: bigint, b: bigint): boolean =>
    c.award.direction === 'max' ? a > b : a < b;

  /** Rung 2's `best` set over an explicit survivor list, by four-term cross-multiplication. */
  const bestByRatio = (c: VectorCase, over?: readonly string[]): string[] | undefined => {
    const pool = over ?? c.tied;
    const ratios = new Map<string, [bigint, bigint]>();
    for (const sid of pool) {
      const r = rung2Ratio(c, sid);
      if (r === undefined) return undefined;
      ratios.set(sid, r);
    }
    const beats = (p: string, q: string): boolean => {
      const [pn, pd] = ratios.get(p) as [bigint, bigint];
      const [qn, qd] = ratios.get(q) as [bigint, bigint];
      return beatsValue(c, pn * qd, qn * pd);
    };
    return pool.filter((p) => !pool.some((q) => beats(q, p)));
  };

  /** Rung 1's `best` set over the full tie, on the row's own volume `secondary_stat`. */
  const bestBySecondary = (c: VectorCase): string[] | undefined => {
    const values = new Map<string, bigint>();
    for (const sid of c.tied) {
      const v = secondaryOf(c, sid);
      if (v === undefined) return undefined;
      values.set(sid, v);
    }
    return c.tied.filter(
      (p) =>
        !c.tied.some((q) =>
          beatsValue(c, values.get(q) as bigint, values.get(p) as bigint),
        ),
    );
  };

  /** Rung 3's strict dominators over an ARBITRARY survivor set — so a claim can state what rung 3
   * would have said over the ORIGINAL tie as well as over the narrowed one. */
  const dominatorsOver = (c: VectorCase, survivors: readonly string[]): string[] => {
    const stat = c.award.deciding_stat;
    const value = (v: VectorStat | undefined): [bigint, bigint] | undefined => {
      if (typeof v === 'string') return [BigInt(v), 1n];
      if (v === undefined) return undefined;
      return [BigInt(v.num), BigInt(v.den)];
    };
    return survivors.filter((p) =>
      survivors.every((q) => {
        if (p === q) return true;
        const mine = value(rowOf(c, p)?.h2h?.[q]?.[stat]);
        const theirs = value(rowOf(c, q)?.h2h?.[p]?.[stat]);
        if (mine === undefined || theirs === undefined) return false;
        return beatsValue(c, mine[0] * theirs[1], theirs[0] * mine[1]);
      }),
    );
  };

  /** One tied player's `secondary` value under the ROW's own `secondary_stat`, as a comparable
   * bigint — volume keys only, which is all the guards below need. */
  const secondaryOf = (c: VectorCase, sid: string): bigint | undefined => {
    const key = c.award.secondary_stat;
    if (!key) return undefined;
    const v = rowOf(c, sid)?.stats_int.secondary?.[key];
    return typeof v === 'string' ? BigInt(v) : undefined;
  };

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
      if (c.expected.kind !== 'winner' || c.expected.ladder_exit_step !== LADDER_EXIT_ACHIEVED) return false;
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

  it('the L3 row eliminates the player holding the strictly earliest REAL timestamp', () => {
    // ⭐ "REAL" IS PART OF THE CLAIM (Story 6-5b). Without the `!== '-1'` clause the rung-4 narrowing
    // row — whose excluded player holds the sentinel, numerically the smallest value in the column —
    // also satisfies this property, and two rows claiming one property is exactly the migration the
    // uniqueness check exists to stop.
    claim('a-width-3-tie-NARROWS-to-2-at-rung-1-and-is-SHARED-at-rung-5', (c) => {
      const winners = c.expected.winners;
      if (c.expected.kind !== 'shared' || winners === undefined) return false;
      if (c.tied.length <= winners.length) return false;
      const eliminated = c.tied.find((sid) => !winners.includes(sid));
      if (eliminated === undefined) return false;
      if (tsOf(c, eliminated) === '-1') return false;
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
    // ⚠ `secondary_stat` BEING ABSENT IS PART OF THE CLAIM (Story 6-5b). The rung-3-over-a-NARROWED-
    // set row added by this pass also has nobody dominating the FULL tie and also has more than one
    // player beating somebody — that is what makes it the row it is — so without this clause two
    // rows satisfy the property and neither is uniquely responsible for it.
    claim('rung-3-has-NO-strict-dominator-and-SKIPS-without-eliminating-anyone', (c) => {
      const sec = c.award.secondary_stat;
      if (sec !== undefined && sec !== null && sec !== '') return false;
      const players = new Map(c.players.map((p) => [p.steamid64, p]));
      const key = c.award.deciding_stat;
      let beatsSome = 0;
      for (const p of c.tied) {
        let any = false;
        let all = true;
        for (const q of c.tied) {
          if (p === q) continue;
          // ⚠ `?.` ON THE BLOCK TOO — the absent-container row added by Story 6-5b omits `h2h`
          // entirely, and this scan runs over EVERY case.
          const pq = players.get(p)?.h2h?.[q];
          const qp = players.get(q)?.h2h?.[p];
          if (pq === undefined || qp === undefined) {
            all = false;
            continue;
          }
          // ⚠ VOLUME SHAPES ONLY. The rate-class row added by Story 6-5b carries `{num, den}`
          // objects here, and this uniqueness scan runs over EVERY case — so a bare `BigInt(...)`
          // threw on it rather than returning "not this row".
          if (typeof pq[key] !== 'string' || typeof qp[key] !== 'string') return false;
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
        c.expected.ladder_exit_step === LADDER_EXIT_SECONDARY &&
        RATE_STAT_KEYS.includes(c.award.secondary_stat ?? ''),
    );
  });

  it('the rung-2 row is one the NAIVE single-pair compare gets backwards', () => {
    claim('rung-2-a-ratio-of-two-ratios-the-naive-single-pair-compare-gets-BACKWARDS', (c) => {
      const numKey = c.award.eff_num_key;
      if (c.expected.kind !== 'winner' || c.expected.ladder_exit_step !== LADDER_EXIT_EFFICIENCY) return false;
      if (numKey === undefined || numKey === null || numKey === '') return false;
      if (c.award.eff_den_key === undefined || c.award.eff_den_key === null) return false;
      // ⚠ The rung-ORDER row also configures both efficiency keys and also exits at step 2, so
      // without this clause two rows claim the property. THIS row alone is a PURE rung-2 decision.
      // ⚠ …AND HAS NO HEAD-TO-HEAD RECORD (Story 6-5b): the rung-2-early-return row added by this
      // pass is also a pure rung-2 decision whose naive compare also disagrees, and what separates
      // the two is that THIS one has no h2h at all while THAT one is about returning past rung 3.
      const sec = c.award.secondary_stat;
      if (sec !== undefined && sec !== null && sec !== '') return false;
      if (hasH2H(c)) return false;
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

  // ⭐⭐ THE FLAGSHIP GUARD, AND IT WAS THE WEAKEST IN THE FILE (strengthened by Story 6-5b, T4). It
  // re-derived only that the operands exceed 2^53 — true of any pair of large numbers, and equally
  // true of a row whose two ratios differ by a mile. What makes THIS row the arithmetic-width row is
  // that the CROSS PRODUCTS STRADDLE A DIFFERENCE OF EXACTLY ONE, so nothing narrower than exact
  // integer arithmetic can separate them, and that a DOUBLE-ROUNDED compare FLIPS the winner. Its
  // sibling rung-2 row had exactly that re-derivation; the higher-value row got the weaker guard.
  it('the arithmetic-width row straddles a difference of ONE and a double compare flips it', () => {
    claim('rung-2-four-term-products-past-2-pow-53', (c) => {
      const two53 = 2n ** 53n;
      if (c.tied.length !== 2) return false;
      const a = rung2Ratio(c, c.tied[0] as string);
      const b = rung2Ratio(c, c.tied[1] as string);
      if (a === undefined || b === undefined) return false;
      if (a[0] < two53 || b[0] < two53) return false;
      // the cross products differ by EXACTLY one
      const cross = a[0] * b[1] - b[0] * a[1];
      if (cross !== 1n && cross !== -1n) return false;
      // …and as float64 the winner's ratio does NOT come out strictly ahead
      const winner = c.expected.steamid64 === c.tied[0] ? a : b;
      const loser = c.expected.steamid64 === c.tied[0] ? b : a;
      return Number(winner[0]) / Number(winner[1]) <= Number(loser[0]) / Number(loser[1]);
    });
  });

  it('the S3 rows carry a genuine zero denominator at rung 1 and at rung 2', () => {
    claim('rung-1-a-zero-denominator-secondary-ties-everyone-S3-verbatim', (c) => {
      const key = c.award.secondary_stat;
      if (key === undefined || key === null || key === '') return false;
      return c.players.some((p) => {
        const v = p.stats_int.secondary?.[key];
        return typeof v === 'object' && v.den === '0';
      });
    });
    // ⭐ THE `n/0` HALF, AND ONLY THAT HALF (tightened by Story 6-5b). It used to assert merely
    // "somebody's denominator key has a zero numerator", which is equally true of the `0/0` row this
    // pass added — and `0/0` is the OPPOSITE behaviour (equal to everything rather than beating
    // everything). The claim is now the WINNER's own COMPUTED ratio, resolving the rung outright.
    claim('rung-2-a-zero-denominator-ratio-behaves-as-PLUS-INFINITY', (c) => {
      if (c.expected.kind !== 'winner' || c.expected.ladder_exit_step !== LADDER_EXIT_EFFICIENCY) {
        return false;
      }
      const r = rung2Ratio(c, c.expected.steamid64 as string);
      return r !== undefined && r[1] === 0n && r[0] > 0n;
    });
  });

  // ── the rows Story 6-5b added ────────────────────────────────────────────────

  it('the RATE-efficiency row has FOUR non-trivial terms, so the drop-both mutant is visible', () => {
    claim('rung-2-RATE-efficiency-keys-give-the-product-FOUR-non-trivial-terms', (c) => {
      const numKey = c.award.eff_num_key;
      const denKey = c.award.eff_den_key;
      if (!numKey || !denKey) return false;
      if (!RATE_STAT_KEYS.includes(numKey) || !RATE_STAT_KEYS.includes(denKey)) return false;
      return c.tied.every((sid) => {
        const eff = rowOf(c, sid)?.stats_int.efficiency;
        if (eff === undefined) return false;
        return [numKey, denKey].every((k) => {
          const pair = eff[k];
          // a factor of 1 (or 0) is a TRIVIAL term — the state every other rung-2 row is stuck in
          return typeof pair === 'object' && BigInt(pair.num) > 1n && BigInt(pair.den) > 1n;
        });
      });
    });
  });

  it('rung 2 has a `min` row, so a hardcoded `max` at that rung alone is visible', () => {
    // ⚠ `!anyInfinite` separates it from the `min` + `n/0` row added by the code review, which is
    // ALSO `min` and ALSO exits at rung 2. This row is about `direction` over FINITE ratios; that
    // one is about `direction` deciding which way a zero denominator points. Before the separating
    // clause both rows satisfied this claim and the uniqueness assertion caught it — which is the
    // machinery working exactly as intended.
    claim(
      'rung-2-under-direction-min-picks-the-SMALLEST-ratio',
      (c) =>
        c.award.direction === 'min' &&
        c.expected.ladder_exit_step === LADDER_EXIT_EFFICIENCY &&
        !anyInfinite(c) &&
        !anyZeroOverZero(c),
    );
  });

  it('rung 2 under `min` makes a ZERO DENOMINATOR the LOSER, not the winner', () => {
    // ⭐⭐ `n/0` under `min` existed in NO row of either vector file — every zero-denominator row
    // here and all four in `stage2-resolve.json` are `max`. A mutant short-circuiting "a zero
    // denominator wins the rung", ignoring `direction`, was byte-identical on every case in both.
    claim(
      'rung-2-under-direction-min-a-ZERO-DENOMINATOR-ratio-LOSES-to-every-finite-one',
      (c) => {
        if (c.award.direction !== 'min') return false;
        if (c.expected.ladder_exit_step !== LADDER_EXIT_EFFICIENCY) return false;
        const infinite = c.tied.filter((sid) => {
          const r = rung2Ratio(c, sid);
          return r !== undefined && r[1] === 0n && r[0] > 0n;
        });
        // Exactly one `n/0` holder, and the winner is SOMEBODY ELSE — under `max` that same player
        // would have taken the rung outright, so the row observes the direction and nothing else.
        return infinite.length === 1 && !infinite.includes(c.expected.steamid64 as string);
      },
    );
  });

  it('rung 2 NARROWS without resolving, so the next rung runs over its survivors', () => {
    claim('rung-2-NARROWS-without-resolving-and-the-NEXT-rung-runs-over-the-SURVIVORS', (c) => {
      if (!c.award.eff_num_key || !c.award.eff_den_key) return false;
      if (c.expected.ladder_exit_step === LADDER_EXIT_EFFICIENCY || c.tied.length < 3) return false;
      // ⚠ `!anyZeroOverZero` separates it from the `0/0` row, which also narrows without resolving —
      // there the survivor rides through on an UNBEATABLE ratio, here on an exactly-equal one.
      return !anyZeroOverZero(c);
    });
  });

  it('a computed `0/0` rung-2 ratio is UNELIMINABLE and rides to the next rung', () => {
    // ⚠ `!anyInfinite` separates it from the `n/0`-meets-`0/0` row added by the code review, which
    // also carries a `0/0` and also survives the rung. There the interesting fact is that the two
    // DEGENERATE shapes are equal to each other; here it is that `0/0` alone cannot be eliminated.
    claim(
      'rung-2-a-ZERO-OVER-ZERO-ratio-is-UNELIMINABLE-and-rides-to-the-next-rung',
      (c) =>
        anyZeroOverZero(c) &&
        !anyInfinite(c) &&
        c.expected.ladder_exit_step !== LADDER_EXIT_EFFICIENCY,
    );
  });

  it('an INFINITE and a ZERO-OVER-ZERO ratio compare EQUAL, and both survive the rung', () => {
    // ⭐⭐ The two degenerate ratios had never met in one race. Cross-multiplication makes `n/0` and
    // `0/0` EQUAL (`5*0 − 0*0 = 0`), so neither eliminates the other; an implementation reading
    // them as IEEE doubles narrows to one and returns a WINNER at rung 2 instead of a SHARED
    // outcome at rung 5 — a different outcome KIND, invisible to every other row.
    claim(
      'rung-2-an-INFINITE-and-a-ZERO-OVER-ZERO-ratio-are-EQUAL-and-BOTH-ride-through',
      (c) => {
        if (!anyInfinite(c) || !anyZeroOverZero(c)) return false;
        if (c.expected.kind !== 'shared') return false;
        const winners = c.expected.winners ?? [];
        const degenerate = c.tied.filter((sid) => {
          const r = rung2Ratio(c, sid);
          return r !== undefined && r[1] === 0n;
        });
        // BOTH degenerate holders survive to the shared set, and somebody finite was eliminated —
        // so the row proves the equality rather than merely containing the two shapes.
        return (
          degenerate.length === 2 &&
          degenerate.every((sid) => winners.includes(sid)) &&
          winners.length < c.tied.length
        );
      },
    );
  });

  it('rung 4 NARROWS, and the sentinel holder is EXCLUDED from the shared set', () => {
    claim('rung-4-NARROWS-and-the-SENTINEL-holder-is-EXCLUDED-from-the-shared-set', (c) => {
      const winners = c.expected.winners;
      if (c.expected.kind !== 'shared' || winners === undefined || c.tied.length < 3) return false;
      const sentinels = c.tied.filter((sid) => tsOf(c, sid) === '-1');
      if (sentinels.length !== 1) return false;
      if (winners.includes(sentinels[0] as string)) return false;
      return winners.length >= 2 && winners.length < c.tied.length;
    });
  });

  it('rung 1 RETURNS rather than falling through to a fabricated exit step', () => {
    // ⚠ THE COUNTERFACTUAL, NOT ONLY THE CONFIGURATION. This asserted that later rungs were merely
    // CONFIGURED — true of any row that exits at 1 with the keys filled in, and satisfied without
    // the later rungs disagreeing about anything. The anchor's `pins_inputs` re-derives that rung 2
    // and rung 3 each crown the OTHER player, which is what makes falling through observable as a
    // different WINNER rather than only a different step. (Story 6-5b code review, 2026-08-06.)
    claim('rung-1-RESOLVES-and-RETURNS-even-though-rung-2-and-h2h-are-CONFIGURED', (c) => {
      if (c.expected.ladder_exit_step !== LADDER_EXIT_SECONDARY) return false;
      if (!c.award.eff_num_key || !c.award.eff_den_key || !hasH2H(c)) return false;
      const winner = c.expected.steamid64 as string;
      // Rung 2, run over the FULL tie, picks somebody else.
      const rung2 = bestByRatio(c);
      if (rung2 === undefined || rung2.length !== 1 || rung2[0] === winner) return false;
      // And so does rung 3.
      const doms = dominatorsOver(c, c.tied);
      return doms.length === 1 && doms[0] !== winner;
    });
  });

  it('rung 2 RETURNS rather than falling through to rung 3, which would crown the other player', () => {
    // ⚠ Same strengthening: `h2h` being POPULATED is not the property — the property is that rung 3
    // would have crowned a DIFFERENT player, so a fall-through changes the winner and not merely
    // the exit step.
    claim('rung-2-RESOLVES-and-RETURNS-even-though-h2h-is-POPULATED', (c) => {
      const sec = c.award.secondary_stat;
      if (sec !== undefined && sec !== null && sec !== '') return false;
      if (c.expected.ladder_exit_step !== LADDER_EXIT_EFFICIENCY || !hasH2H(c)) return false;
      const doms = dominatorsOver(c, c.tied);
      return doms.length === 1 && doms[0] !== (c.expected.steamid64 as string);
    });
  });

  it('rung 3 runs over rung 1`s SURVIVORS, so a dominator emerges the full tie had not', () => {
    // ⚠ THE WHOLE POINT IS THE DIFFERENCE BETWEEN THE TWO SETS, and the claim did not compute
    // either of them. `exit === 3 && secondary set && width >= 3` is satisfied by any wide rung-3
    // row. The anchor re-derives that rung 1 narrows to a PLURAL PROPER SUBSET and that nobody
    // dominates the FULL tie — without which an implementation computing dominators over `tied`
    // produces the same answer and the row proves nothing.
    claim('rung-3-runs-over-rung-1s-SURVIVORS-so-a-DOMINATOR-emerges-the-full-tie-had-not', (c) => {
      if (c.expected.ladder_exit_step !== LADDER_EXIT_H2H) return false;
      if (!c.award.secondary_stat || c.tied.length < 3) return false;
      const survivors = bestBySecondary(c);
      if (survivors === undefined) return false;
      // Rung 1 narrows to a plural PROPER subset…
      if (!(survivors.length > 1 && survivors.length < c.tied.length)) return false;
      // …over which exactly the winner dominates, while over the FULL tie NOBODY does.
      const overSurvivors = dominatorsOver(c, survivors);
      const overAll = dominatorsOver(c, c.tied);
      return (
        overSurvivors.length === 1 &&
        overSurvivors[0] === (c.expected.steamid64 as string) &&
        overAll.length === 0
      );
    });
  });

  it('a `class: rate` award reaches rung 3, where the h2h values are PAIRS', () => {
    // ⚠ IT MUST ACTUALLY REACH RUNG 3, AND THE h2h MUST BE NON-EMPTY. Without both clauses the
    // `every(...)` walk was VACUOUSLY TRUE over a row with no h2h at all — which is how the
    // rate-award-with-a-volume-secondary row added by the code review (class `rate`, deciding key
    // `hs_pct`, no head-to-head anywhere, exits at rung 1) satisfied a claim about rung 3's rate
    // arm. A vacuous `every` is the same defect class as a vacuous guard, one level down.
    claim('a-RATE-class-award-cross-multiplies-its-h2h-PAIRS-at-rung-3', (c) => {
      if (c.award.class !== 'rate') return false;
      if (!RATE_STAT_KEYS.includes(c.award.deciding_stat)) return false;
      if (c.expected.ladder_exit_step !== LADDER_EXIT_H2H) return false;
      if (!hasH2H(c)) return false;
      return c.tied.every((sid) =>
        Object.values(rowOf(c, sid)?.h2h ?? {}).every(
          (block) => typeof block[c.award.deciding_stat] === 'object',
        ),
      );
    });
  });

  it('a `class: rate` award with a VOLUME secondary crosses class the OTHER way', () => {
    // ⭐ L5's mirror. The file pinned a VOLUME award with a RATE secondary; the reverse pairing
    // appeared nowhere, because the only `class: rate` award carried no secondary at all. A rule
    // that holds in one direction only is not a rule — an implementation branching on
    // `award.class` reads a bare integer as a `{num, den}` pair here.
    claim('a-RATE-class-award-with-a-VOLUME-secondary-crosses-CLASS-the-OTHER-way', (c) => {
      const key = c.award.secondary_stat;
      if (c.award.class !== 'rate' || !key) return false;
      if (!VOLUME_STAT_KEYS.includes(key)) return false;
      if (c.expected.ladder_exit_step !== LADDER_EXIT_SECONDARY) return false;
      // Every value rung 1 actually reads is a BARE STRING, not a pair — the shape the
      // award-class branch would misread — and the winner holds the largest of them.
      const values = c.tied.map((sid) => secondaryOf(c, sid));
      if (values.some((v) => v === undefined)) return false;
      const best = values.reduce((a, b) => ((b as bigint) > (a as bigint) ? b : a)) as bigint;
      return secondaryOf(c, c.expected.steamid64 as string) === best;
    });
  });

  it('rung 3 requires a dominator to beat EVERY other survivor, not merely one', () => {
    // ⭐ Every rung-3 WIN in the file was decided over exactly TWO survivors, where "dominates
    // every other" collapses to "beats the one opponent" — so the conjunction across opponents was
    // load-bearing for a positive result NOWHERE. A "beats at least one" implementation finds two
    // dominators here and raises the plural-dominator `internal` refusal instead of crowning.
    claim('rung-3-a-dominator-must-beat-EVERY-other-survivor-not-merely-ONE', (c) => {
      if (c.expected.ladder_exit_step !== LADDER_EXIT_H2H || c.tied.length < 3) return false;
      // The record is COMPLETE in both directions for every ordered pair, so no result here rests
      // on L8's never-met skip.
      const complete = c.tied.every((p) =>
        c.tied.every((q) => p === q || Object.hasOwn(rowOf(c, p)?.h2h ?? {}, q)),
      );
      if (!complete) return false;
      const beats = (p: string, q: string): boolean => {
        const mine = rowOf(c, p)?.h2h?.[q]?.[c.award.deciding_stat];
        const theirs = rowOf(c, q)?.h2h?.[p]?.[c.award.deciding_stat];
        if (typeof mine !== 'string' || typeof theirs !== 'string') return false;
        return c.award.direction === 'max' ? BigInt(mine) > BigInt(theirs) : BigInt(mine) < BigInt(theirs);
      };
      const winner = c.expected.steamid64 as string;
      const beaten = c.tied.filter((q) => q !== winner && beats(winner, q));
      // The winner beats at least TWO, and somebody else beats at least one WITHOUT dominating —
      // which is exactly what makes "beats one" and "beats all" different predicates on this row.
      const partial = c.tied.some(
        (p) =>
          p !== winner &&
          c.tied.some((q) => q !== p && beats(p, q)) &&
          c.tied.some((q) => q !== p && !beats(p, q)),
      );
      return beaten.length >= 2 && partial;
    });
  });

  it('an achievement_ts of ZERO is a real timestamp, so a `ts <= 0` filter is visible', () => {
    claim('an-achievement_ts-of-ZERO-is-a-REAL-timestamp-and-WINS-rung-4', (c) => {
      if (c.tied.some((sid) => tsOf(c, sid) === '-1')) return false;
      return (
        c.tied.some((sid) => tsOf(c, sid) === '0') &&
        tsOf(c, c.expected.steamid64 as string) === '0'
      );
    });
  });

  it('an achievement_ts past 2^53 is compared EXACTLY, so a Number-parsing verifier diverges', () => {
    claim('an-achievement_ts-past-2-pow-53-is-compared-EXACTLY', (c) => {
      const two53 = 2n ** 53n;
      const raw = c.tied.map((sid) => tsOf(c, sid));
      if (raw.some((t) => t === undefined)) return false;
      if (raw.some((t) => BigInt(t as string) < two53)) return false;
      // distinct as bigints…
      if (new Set(raw).size !== raw.length) return false;
      // …and INDISTINGUISHABLE as doubles, which is the whole claim.
      return new Set(raw.map((t) => Number(t))).size === 1;
    });
  });

  it('a player outside `tied` is carried, so a roster-iterating ladder is distinguishable', () => {
    // ⛔⛔ THE OUTSIDER MUST BE DOMINANT, AND THIS NOW CHECKS IT. The claim asserted only
    // `outsiders >= 1` while the comment above it promised dominance — narration wearing a
    // measurement's clothes, in a guard added to close exactly that defect. All three review layers
    // found it independently. A fixture edit making the outsider a LOSER left both suites green
    // while the row stopped distinguishing a roster-iterating ladder from a correct one; only the
    // anchor's `pins_inputs` re-derived it. (Story 6-5b code review, 2026-08-06.)
    claim('a-player-who-is-NOT-in-the-tied-set-is-INVISIBLE-to-every-rung', (c) => {
      if (c.expected.ladder_exit_step !== LADDER_EXIT_SECONDARY) return false;
      const outsiders = c.players.filter((p) => !c.tied.includes(p.steamid64));
      if (outsiders.length < 1) return false;
      const key = c.award.secondary_stat;
      if (!key) return false;
      const tiedTs = c.tied.map((sid) => BigInt(tsOf(c, sid) ?? '0'));
      const tiedSecondary = c.tied.map((sid) => secondaryOf(c, sid));
      if (tiedSecondary.some((v) => v === undefined)) return false;
      // Each outsider would have won BOTH the rung it is excluded from AND the last rung: a
      // strictly larger secondary than every tied player, and a strictly earlier timestamp.
      return outsiders.every((p) => {
        const v = p.stats_int.secondary?.[key];
        if (typeof v !== 'string') return false;
        return (
          (tiedSecondary as bigint[]).every((t) => BigInt(v) > t) &&
          tiedTs.every((t) => BigInt(p.achievement_ts ?? '0') < t)
        );
      });
    });
  });

  it('a NON-TIED player with a corrupt ts and a dominant h2h is invisible to BOTH', () => {
    // ⭐⭐ The only row with a roster wider than the tie exited at RUNG 1, so rungs 2-5 had never
    // run against one — and that is the ORDINARY production shape, since 0024 freezes the whole
    // roster and 6.6 drives a REDUCED tie against it. Three counterfactuals on one row.
    claim('a-NON-TIED-player-with-a-CORRUPT-ts-and-a-DOMINANT-h2h-is-INVISIBLE-to-BOTH', (c) => {
      if (c.expected.ladder_exit_step !== LADDER_EXIT_ACHIEVED) return false;
      const outsiders = c.players.filter((p) => !c.tied.includes(p.steamid64));
      if (outsiders.length !== 1) return false;
      const out = outsiders[0] as VectorPlayer;
      const outTs = BigInt(out.achievement_ts ?? '0');
      // (1) BELOW the published sentinel, so a roster-wide `achievement_ts` validation must REFUSE
      // an input the other two implementations resolve.
      if (outTs >= ABSENT_ACHIEVEMENT_TS) return false;
      // (2) strictly earlier than every tied member, so a roster-wide rung 4 crowns them.
      if (!c.tied.every((sid) => outTs < BigInt(tsOf(c, sid) ?? '0'))) return false;
      // (3) beats every tied member head to head in BOTH directions, so a roster-wide rung 3
      // crowns them at step 3 — while over the tie itself nobody dominates.
      const stat = c.award.deciding_stat;
      const dominates = c.tied.every((sid) => {
        const mine = out.h2h?.[sid]?.[stat];
        const theirs = rowOf(c, sid)?.h2h?.[out.steamid64]?.[stat];
        return typeof mine === 'string' && typeof theirs === 'string' && BigInt(mine) > BigInt(theirs);
      });
      if (!dominates) return false;
      // …and inside the tie the record is LEVEL, so rung 3 genuinely skips.
      const level = c.tied.every((p) =>
        c.tied.every((q) => {
          if (p === q) return true;
          const mine = rowOf(c, p)?.h2h?.[q]?.[stat];
          const theirs = rowOf(c, q)?.h2h?.[p]?.[stat];
          return typeof mine === 'string' && typeof theirs === 'string' && BigInt(mine) === BigInt(theirs);
        }),
      );
      return level && c.tied.includes(c.expected.steamid64 as string);
    });
  });

  it('a tied player`s three blocks are ABSENT, so `container(undefined)` is entered at last', () => {
    claim('ABSENT-secondary-efficiency-and-h2h-BLOCKS-are-the-EMPTY-blocks', (c) =>
      c.tied.some((sid) => {
        const p = rowOf(c, sid);
        return (
          p !== undefined &&
          p.stats_int.secondary === undefined &&
          p.stats_int.efficiency === undefined &&
          p.h2h === undefined
        );
      }),
    );
  });

  it('every one of the five rungs is exited at by at least one case', () => {
    const reached = new Set(vector.cases.map((c) => c.expected.ladder_exit_step));
    for (const step of vector.exit_steps) expect([...reached]).toContain(step);
    // …and the module's own constants are the five, so this cannot pass over a vector that renamed
    // a rung out from under the code.
    expect([...reached].sort((a, b) => a - b)).toEqual([
      LADDER_EXIT_SECONDARY,
      LADDER_EXIT_EFFICIENCY,
      LADDER_EXIT_H2H,
      LADDER_EXIT_ACHIEVED,
      LADDER_EXIT_SHARED,
    ]);
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

  // ⭐⭐ THE DECLARED DIVERGENCE IS INSPECTED, NOT MERELY EMITTED — `deferred-work.md:326`.
  //
  // Story 6.11 added `declared_divergences` to `ladder-resolve.json` and annotated the debt CLOSED;
  // its code review found that NOTHING in either runtime read the block. The block's own `resolution`
  // says "Both suites assert their own label, and this row is what makes the asymmetry a contract
  // instead of two comments that can drift apart" — which was not true until this test and its Go
  // twin (`TestLadderDeclaredDivergenceIsInspected`) existed.
  //
  // ⛔ THIS ASSERTS THE **TypeScript** LABEL AGAINST THE **RUNTIME**, not against a constant here. If
  // someone "unified" the TS guard down to `tied` for symmetry — which the block explicitly forbids —
  // the vector would still say `player` and this test would redden. The reverse drift (someone edits
  // the JSON to match a weakened guard) is caught by `--check`, which re-derives the file.
  it('the declared non-array-roster divergence carries the label THIS runtime actually produces', () => {
    const declared = vector.declared_divergences.find((d) => /NON-ARRAY/i.test(d.input));
    expect(declared, 'the non-array-roster divergence is missing from the vector').toBeDefined();
    const row = declared as VectorDeclaredDivergence;

    // It is declared unrepresentable, so no case row may quietly carry it instead.
    expect(row.row_representable).toBe(false);
    // The asymmetry is the whole point: if the three ever agreed, the entry should be deleted, not left.
    expect(row.typescript).not.toBe(row.go);
    expect(row.go).toBe(row.python);
    expect(vector.refusal_details).toContain(row.typescript);
    expect(vector.refusal_details).toContain(row.go);

    // …and the label the vector attributes to TypeScript is re-derived from a real call.
    expectDetail(
      () => resolveLadder(award, ['11', '22'], null as unknown as SnapshotPlayer[]),
      row.typescript,
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
    expect(got.ladderExitStep).toBe(LADDER_EXIT_ACHIEVED);
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
