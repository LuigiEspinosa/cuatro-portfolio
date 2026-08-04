/**
 * Stage 2 — the deterministic winner, browser VERIFIER side (Story 6-4a, FR-25 / AD-14 / AD-15 /
 * AD-19 / SOLUTION-DESIGN §9.3).
 *
 *   eligible(award, players) = [ p for p in players sorted BYTE-LEX on the decimal
 *                                steamid64 STRING
 *                                if p.rounds_played >= award.floor_rounds
 *                               and p.kills         >= award.floor_kills
 *                               and not p.idle_dq ]
 *
 *   value(award, p) = p.stats_int.volume[award.deciding_stat]             class 'volume'
 *                   = p.stats_int.rate[award.deciding_stat]  # {num,den}  class 'rate'
 *
 *   cmp(award, p, q) = (volume) sign(p - q)
 *                      (rate)   sign(p.num*q.den - q.num*p.den)
 *   beats(award, p, q) = cmp > 0 for direction 'max';  cmp < 0 for 'min'
 *
 *   resolve(award, players):
 *       E = eligible(award, players)
 *       if E is empty:                      return no_eligible_players
 *       best = { p in E : no q in E with beats(award, q, p) }   # a SET, never a champion
 *       if class == 'volume' and direction == 'max' and value(best[0]) == 0:
 *                                           return no_awardable_value      # DECISION E
 *       if len(best) == 1:                  return winner(best[0], value(best[0]))
 *       return tie(best, equal_value if class == 'volume' else equal_cross_product)
 *
 * NO RANDOMNESS AND NO STREAM. Stage 2 consumes no PRNG bytes at all, so unlike `prng.ts` this
 * module is fully SYNCHRONOUS — there is no SubtleCrypto to await. It is a pure integer function
 * of the frozen snapshot, which is what lets a skeptic replay it with nothing but the bundle.
 *
 * ⛔ NO `import 'server-only'` — see the note in `labels.ts`. `lib/roulette` is the one `lib/**`
 * package that ships to the browser (6.9's "Verificar la ceremonia") and `server-only` throws in a
 * client bundle. Pinned by the source scan in `prng.test.ts`, whose module list is asserted by
 * EXACT EQUALITY, so this file had to be registered there to be scanned at all.
 *
 * ⛔ ALL COMPARISON ARITHMETIC IS `BigInt`. Never `Number`, never a division, never `Math.*`. See
 * the note on {@link compareValues} — the vector carries a case where a `Number` implementation is
 * corrupted at `JSON.parse` time, before any arithmetic runs.
 *
 * THE SEAM (ARCHITECTURE-SPINE.md:73-76). This module conforms to `roulette/vectors/`, never to
 * `worker/awards`. They are two independent implementations of one spec; neither is the reference
 * and neither may be corrected by reading the other's source. When they disagree the vector
 * decides; when the vector is silent, add a vector.
 *
 * ⛔ NOT IN THIS FILE, each with an owner: the FR-29 tiebreak ladder (6.5 — this file defines and
 * injects the PORT and ships an implementation that refuses), Stage 1's weighted pick (6-4b),
 * anti-sweep (6.6), pity (6.7), persistence and the reveal axis (6.8), canonicalization (6.9).
 */

/** 0023's `award_class_valid` closed set. */
export type AwardClass = 'volume' | 'rate';

/** 0023's `award_direction_valid` closed set. */
export type AwardDirection = 'max' | 'min';

/**
 * The resolution-relevant projection of one `award` row.
 *
 * The floors are `number`, not `bigint`, and the asymmetry with {@link SnapshotPlayer}'s
 * magnitudes is deliberate: `floor_rounds`/`floor_kills` are bounded `int` columns (0023:74-75)
 * while every snapshot magnitude is an unbounded integer (AD-19). Provenance, not taste.
 *
 * ⚠ `secondaryStat` / `effNumKey` / `effDenKey` are deliberately absent. They are NULL in the
 * shipped seed (0024 DECISION B) and they are the FR-29 ladder's rungs 1 and 2 — Story 6.5's to
 * define, not this file's to guess.
 */
export interface Award {
  readonly decidingStat: string;
  /**
   * ⭐ THE BRANCH IS ON THE CLASS, never on whether a value happens to look like a pair.
   * `award_class_key_coherent` (0023:129-133) is documented in its own comment as "precisely the
   * discriminator 6.4's Stage 2 branches on", and it is a database CHECK exactly so this branch
   * can trust it.
   */
  readonly class: AwardClass;
  readonly direction: AwardDirection;
  readonly floorRounds: number;
  readonly floorKills: number;
}

/**
 * One AD-19 `{num, den}` integer pair. NEVER pre-divided: the snapshot deliberately carries the
 * two integer halves and 0024:690-691 refuses to divide them, because a `numeric` quotient is not
 * reproducible across two runtimes.
 *
 * ⚠ A `den` of 0 is CORRECT and reachable, not a defect to coalesce away — see
 * {@link compareValues}.
 */
export interface RatePair {
  readonly num: bigint;
  readonly den: bigint;
}

/**
 * One `stat_snapshot_row` in AD-19 integer form (0024:664-737).
 *
 * ⚠ `idleDq` carries the SNAPSHOT's meaning, which differs from `stat_row.idle_dq`: it is true iff
 * the player has AT LEAST ONE approved row and EVERY one of them is idle — "fully DQ'd"
 * (0024:909-916). A rostered player with ZERO approved rows is `false` with zero stats: winless,
 * not disqualified, and Story 6.7's pity draw must still be able to reach them.
 */
export interface SnapshotPlayer {
  readonly steamid64: string;
  readonly roundsPlayed: bigint;
  readonly kills: bigint;
  readonly idleDq: boolean;
  /**
   * The 17 integer totals and the four `{num,den}` pairs. An ABSENT key is a refusal, never a
   * zero — a zero would silently become a real comparison, the same doctrine 0024:918-923 applies
   * to an absent h2h opponent.
   */
  readonly volume: Readonly<Record<string, bigint>>;
  readonly rate: Readonly<Record<string, RatePair>>;
}

/** Which equality tied the award. The two are different bugs when they are wrong. */
export type TieReason = 'equal_value' | 'equal_cross_product';

/**
 * The winning value.
 *
 * ⛔ DISPLAY ONLY. `award_result.deciding_value` carries the identical warning at
 * SOLUTION-DESIGN:219 — "display only; never an input to resolution". Nothing in this file reads
 * it back, and nothing downstream may re-derive a winner from it.
 */
export type DecidingValue =
  | { readonly class: 'volume'; readonly value: bigint }
  | { readonly class: 'rate'; readonly num: bigint; readonly den: bigint };

/**
 * Stage 2's answer for one award.
 *
 * ⭐ THIS SHAPE IS THE SEAM 6-4b, 6.5 AND 6.8 ALL INHERIT. A tie is a RETURNED OUTCOME, not a
 * resolution and not an error state — EXPERIENCE.md:123 calls a shared co-winner a designed
 * outcome, and AD-14 requires an equal deciding value to enter the FR-29 ladder rather than be
 * settled by a silent argmax over iteration order.
 *
 * Written as a DISCRIMINATED UNION rather than Go's flat struct-with-kind, because TypeScript can
 * make "a tie that also names a single winner" unrepresentable where Go can only test for it. Both
 * project onto the same vector JSON, which is the contract they actually share.
 */
export type Outcome =
  | { readonly kind: 'winner'; readonly steamid64: string; readonly decidingValue: DecidingValue }
  | { readonly kind: 'tie'; readonly tied: readonly string[]; readonly reason: TieReason }
  | { readonly kind: 'no_eligible_players' }
  /**
   * ⭐ CARRIES THE SUPPRESSED SET (6-4a code review). DECISION E's zero check runs BEFORE the
   * `|best| === 1` branch, so the tie that would have formed never becomes a `'tie'` outcome;
   * without `tied` here its WIDTH is discarded and 6.5 / 6.6 / 6.7 receive a bare kind — the
   * 27-way zero tie `deferred-work.md:270` predicted would arrive with nothing to read.
   * `tied.length` IS that width, and it is 1 when a lone eligible player sat at zero.
   *
   * No `reason`: nothing tied when the suppressed set holds one player.
   */
  | { readonly kind: 'no_awardable_value'; readonly tied: readonly string[] };

/** The tie arm on its own — what a {@link Ladder} receives. */
export type TieOutcome = Extract<Outcome, { kind: 'tie' }>;

/**
 * The closed sets, exported so the vector suite can assert the two runtimes agree on what Stage 2
 * can even conclude.
 *
 * `Object.freeze` is SHALLOW — 6.1 shipped a "frozen" catalog of mutable entries on exactly that
 * mistake. One call suffices here only because every element is a primitive, and the test asserts
 * that rather than assuming it.
 */
export const OUTCOME_KINDS: readonly string[] = Object.freeze([
  'winner',
  'tie',
  'no_eligible_players',
  'no_awardable_value',
]);

export const TIE_REASONS: readonly string[] = Object.freeze(['equal_value', 'equal_cross_product']);

/**
 * A programmer/data error this module refuses to resolve past.
 *
 * ⭐ ITS OWN CLASS, not a bare `TypeError`. The 6.3 code review measured a mutation surviving the
 * entire suite because `BigInt(1.5)` throws a `RangeError` too, so the test could not tell the
 * module's own guard from an incidental built-in throw. A named class makes every assertion below
 * specific to THIS module's refusal.
 */
export class Stage2Error extends Error {
  constructor(message: string) {
    super(`roulette: ${message}`);
    this.name = 'Stage2Error';
  }
}

/**
 * The FR-29 tiebreak PORT (Story 6.5).
 *
 * ⭐ IT IS INJECTED, AND ITS 6-4a-ERA IMPLEMENTATION REFUSES. The spec assumes Stage 2 yields one
 * player. It does not, and it must not: 6.2's review proved the most common tie shape in a 1v1
 * bracket is GUARANTEED to reach the ladder's rung 4 and fail there (deferred-work.md:281, a named
 * blocker on 6.5). Every self-contained fallback — first-in-byte-lex, lowest SteamID64, the
 * running-max accident — is a silent argmax wearing a different hat: it produces a plausible
 * winner that 6.5 will later contradict, changing the drawn bytes and the whole ceremony from that
 * spin onward, with nothing red anywhere.
 *
 * `resolve` receives the tie WHOLE and returns whatever the ladder concludes. It returns an
 * `Outcome` rather than a bare winner on purpose: what a ladder-resolved award looks like is 6.5's
 * design, and inventing a field for it here would be inventing a contract for a story that has not
 * made its decisions.
 */
export interface Ladder {
  resolve(award: Award, tie: TieOutcome): Outcome;
}

/**
 * What a ladder that cannot resolve a tie throws.
 *
 * It carries the tie whole, so a caller — 6-4b's `provisionalWinner`, most immediately — can read
 * the tied set and its reason instead of only a message. This is the JavaScript mirror of Go's
 * `(Outcome, error)` pair: Go returns both, so here the outcome rides on the error.
 */
export class LadderRefusedError extends Error {
  readonly award: Award;
  readonly outcome: TieOutcome;

  constructor(award: Award, tie: TieOutcome) {
    super(
      `roulette: Stage 2 tied on ${award.decidingStat} (${tie.reason}, ${String(tie.tied.length)} players) ` +
        'and the FR-29 tiebreak ladder is not implemented — it is Story 6.5’s. Stage 2 will not ' +
        'pick one: every self-contained fallback is a silent argmax that 6.5 would later contradict',
    );
    this.name = 'LadderRefusedError';
    this.award = award;
    this.outcome = tie;
  }
}

/**
 * The 6-4a-era {@link Ladder}: it refuses, loudly, naming the story that supplies the real one.
 *
 * It is the DEFAULT and there is deliberately no dev-only fallback ladder in this module — a
 * fallback that exists is a fallback someone wires into production.
 */
export const refusingLadder: Ladder = Object.freeze({
  resolve(award: Award, tie: TieOutcome): Outcome {
    throw new LadderRefusedError(award, tie);
  },
});

/**
 * The full Stage-2 entry point: resolve, and hand any tie to the injected ladder.
 *
 * ⚠ The tie path genuinely CALLS the ladder rather than merely declaring the port, so the seam is
 * exercised by every tie case in the vector suite. Catching the ladder's refusal here — returning
 * the tie as if nothing happened — would turn a refusal into a silent tie-shaped success.
 */
export function resolveAward(
  award: Award,
  players: readonly SnapshotPlayer[],
  ladder: Ladder,
): Outcome {
  if (ladder === null || typeof ladder !== 'object' || typeof ladder.resolve !== 'function') {
    throw new Stage2Error('a Ladder must be injected — Stage 2 never resolves a tie itself');
  }
  const outcome = resolveStage2(award, players);
  if (outcome.kind !== 'tie') return outcome;
  return ladder.resolve(award, outcome);
}

/**
 * The pure stage: no ladder, no I/O, no clock, no randomness.
 *
 * Exported separately from {@link resolveAward} because 6-4b needs the raw outcome — a tied award
 * has no single `provisionalWinner`, and Stage 1 must SEE that rather than be handed a ladder's
 * answer or a refusal it cannot inspect.
 */
export function resolveStage2(award: Award, players: readonly SnapshotPlayer[]): Outcome {
  validateAward(award);

  const eligible = eligiblePlayers(award, players);
  // S5 — an empty eligible set is a TYPED OUTCOME, not a crash and not a zero-winner. It is
  // reachable today, not hypothetically: 6.2 measured 0 of 28 players clearing the shipped 24/20
  // floors on the real corpus (deferred-work.md:269).
  if (eligible.length === 0) return { kind: 'no_eligible_players' };

  // Read every ELIGIBLE player's value up front, so a missing or malformed key refuses even for a
  // player who would have lost. An ineligible player is never read — they are not in the race, and
  // a tripwire on rows nobody consults is not a signal.
  const values = eligible.map((p) => decidingValue(award, p));

  // ⭐ S7 — "BEST" IS COMPUTED AS A SET: best = { p : no q beats p }. A running champion replaced
  // on `>` silently keeps the FIRST of an equal pair and IS the argmax AD-14 forbids; replaced on
  // `>=` it silently keeps the LAST. Both produce a plausible winner and nothing red anywhere.
  // n <= the roster, so the quadratic scan is free and obviously correct.
  const best: number[] = [];
  for (let i = 0; i < eligible.length; i++) {
    let beaten = false;
    for (let j = 0; j < eligible.length; j++) {
      if (beats(award, values[j], values[i])) {
        beaten = true;
        break;
      }
    }
    if (!beaten) best.push(i);
  }
  if (best.length === 0) {
    // Unreachable: compareValues is TOTAL — every pair is comparable — and with non-negative
    // denominators (enforced in decidingValue) its STRICT part is acyclic, so somebody is always
    // unbeaten.
    //
    // ⚠ IT IS NOT A TOTAL PREORDER, and the 6-4a code review corrected this comment for claiming
    // it was. A 0/0 rate cross-multiplies to 0 against EVERY pair, so indifference is not
    // transitive: 0/0 ~ 10/5 and 0/0 ~ 6/5 while 10/5 > 6/5. The vector carries that
    // counterexample by name (`rate-zero-denominator-is-equal-to-everyone`). This guard holds
    // because of ACYCLICITY, not transitivity — do not "simplify" it against the wrong reason.
    throw new Stage2Error(
      `empty best set over ${String(eligible.length)} eligible players — the comparator's strict part is not acyclic`,
    );
  }

  const bestIndex = best[0];
  const bestValue = values[bestIndex];

  // ⭐ DECISION E (Cuatro, 2026-08-04). A `max` VOLUME award whose best deciding value is 0 has NO
  // WINNER, rather than crowning a whole-roster co-win over a stat nobody scored on. This is the
  // measured case, not a hypothetical: 6.1's review found `knife_kills` non-zero for 1 of 28
  // players, so if that player misses the floors award #6 is a 27-way tie at zero
  // (deferred-work.md:270), and lib/awards/catalog.ts:132-137 hands the question here by name.
  //
  // ⚠ SCOPE IS DELIBERATE AND NARROW. `min` awards are untouched — fewest deaths is an
  // achievement. `rate` awards are untouched. The vector pins both halves, so widening this
  // reddens `volume-min-zero-is-awardable` and `rate-max-zero-numerator-is-awardable`. And it is a
  // rule about the VALUE, not the tie width: one lone eligible player at zero still wins nothing.
  //
  // ⭐ IT CARRIES THE SUPPRESSED SET (6-4a code review). The check runs BEFORE the `|best| === 1`
  // branch, so the tie that would have formed never becomes a `'tie'`; carrying `tied` is what
  // keeps its width visible to 6.5 / 6.6 / 6.7 instead of handing them a bare kind.
  if (award.class === 'volume' && award.direction === 'max' && bestValue.class === 'volume') {
    if (bestValue.value === 0n) {
      return { kind: 'no_awardable_value', tied: best.map((i) => eligible[i].steamid64) };
    }
  }

  if (best.length === 1) {
    return { kind: 'winner', steamid64: eligible[bestIndex].steamid64, decidingValue: bestValue };
  }

  // AC2 — the FULL tied set, in byte-lex order, with the reason it tied. Never pick one.
  return {
    kind: 'tie',
    tied: best.map((i) => eligible[i].steamid64),
    reason: award.class === 'rate' ? 'equal_cross_product' : 'equal_value',
  };
}

/**
 * Whether `a` is strictly better than `b` for this award.
 *
 * S1 — `direction` inverts "BEST", AND ONLY "BEST". It does not invert the floors (DECISION C:
 * `El Inofensivo` keeps its `floorKills = 20` even though a kill floor on the catalog's only `min`
 * award is anti-QUALIFICATION — deferred-work.md:268), and it does not change the tie rule: equal
 * is still equal in both directions.
 */
function beats(award: Award, a: DecidingValue, b: DecidingValue): boolean {
  const c = compareValues(a, b);
  return award.direction === 'max' ? c > 0 : c < 0;
}

/**
 * `sign(a - b)` for a volume pair; `sign(a.num*b.den - b.num*a.den)` for a rate pair.
 *
 * ⭐ S3 — A ZERO DENOMINATOR IS A REAL, REACHABLE INPUT. A rostered player with zero approved rows
 * is `idleDq = false` with zero stats (0024:909-916), so their `adr` is 0/0. Cross-multiplication
 * is TOTAL: with a `den` of 0 both products are still computable. Two such players compare EQUAL
 * and therefore tie. Nothing here divides, nothing throws, and nothing filters them out — a silent
 * den-0 filter is an argmax by another name.
 *
 * ⚠ S3 HAS TWO CONSEQUENCES the original note left unstated; the 6-4a code review surfaced both
 * and each now has its own vector row rather than waiting to be discovered in a ceremony:
 *   1. `0n/0n` compares EQUAL TO EVERY PAIR (`0*q.den === q.num*0 === 0`), so a player with no
 *      data is unbeatable and always lands in `best`. With A=0/0, B=10/5, C=6/5 the answer is a
 *      TIE of {A,B} even though B beats C outright — an unambiguous win becomes the ladder's
 *      refusal. Pinned by `rate-zero-denominator-is-equal-to-everyone` and, under the catalog's
 *      REAL floors, by `rate-zero-denominator-clears-a-real-floor` (`entry_success`'s denominator
 *      has no volume counterpart, so a den-0 player can clear 24/20).
 *   2. `n/0n` with `n > 0` BEATS EVERY FINITE RATE at any magnitude (`n*q.den > q.num*0 === 0`) —
 *      it behaves as +infinity and is crowned outright, with `1/0` rendered as the deciding value.
 *      Pinned by `rate-max-positive-numerator-over-zero-beats-every-finite-rate`.
 * Both are the formula applied verbatim, reported rather than patched around: excluding den-0
 * players is exactly the silent filter S3 forbids.
 *
 * ⭐ S4 — THE ARITHMETIC MUST NOT ROUND, and this is the highest-value divergence in the story
 * because a rounded product yields a PLAUSIBLE winner. `bigint` is exact at every width, which is
 * the property Go's producer gets from `math/big`. The vector's
 * `rate-max-cross-multiplication-only` case is built past 2^53 precisely because BELOW it no
 * inversion is possible — with exactly-representable operands, correctly-rounded division cannot
 * swap two ratios, only collapse them into a false tie. Past it, `Number` corrupts the input at
 * `JSON.parse` before any arithmetic runs, which is why every magnitude in the vector is a decimal
 * STRING.
 *
 * ⚠ EQUALITY IS THE CROSS PRODUCT, never `num === num && den === den`. `3/6` and `2/4` are the
 * same value carried by different pairs, and a pair-equality check misses that tie entirely.
 */
function compareValues(a: DecidingValue, b: DecidingValue): number {
  if (a.class === 'volume' && b.class === 'volume') {
    return a.value > b.value ? 1 : a.value < b.value ? -1 : 0;
  }
  if (a.class === 'rate' && b.class === 'rate') {
    const left = a.num * b.den;
    const right = b.num * a.den;
    return left > right ? 1 : left < right ? -1 : 0;
  }
  // Unreachable: every value in one resolution is read through the same award's class.
  throw new Stage2Error('cannot compare a volume value with a rate value');
}

/** Reads one player's deciding stat, branching on the award's CLASS. */
function decidingValue(award: Award, p: SnapshotPlayer): DecidingValue {
  if (award.class === 'volume') {
    const value = p.volume[award.decidingStat];
    if (typeof value !== 'bigint') {
      throw new Stage2Error(
        `volume key "${award.decidingStat}" absent from ${p.steamid64}'s stats_int.volume — an absent key is a refusal, never a zero`,
      );
    }
    if (value < 0n) {
      throw new Stage2Error(
        `volume "${award.decidingStat}" is negative for ${p.steamid64} — every volume stat is a count`,
      );
    }
    return { class: 'volume', value };
  }

  const pair = p.rate[award.decidingStat];
  if (pair === undefined || typeof pair.num !== 'bigint' || typeof pair.den !== 'bigint') {
    throw new Stage2Error(
      `rate key "${award.decidingStat}" absent from ${p.steamid64}'s stats_int.rate — an absent key is a refusal, never a zero`,
    );
  }
  // ⛔ A NEGATIVE DENOMINATOR SILENTLY INVERTS THE COMPARISON: `a.num*b.den > b.num*a.den` is the
  // right test only while both denominators are non-negative, and with one negative the inequality
  // flips and the resolver returns a plausible, wrong winner. Every rate half is a count
  // (0021:66-71,84,108) and 0024 coalesces to 0, so this is unreachable from a real snapshot —
  // which is precisely why it is loud rather than trusted. `den === 0n` stays LEGAL (S3); only a
  // negative is refused.
  if (pair.num < 0n || pair.den < 0n) {
    throw new Stage2Error(
      `rate "${award.decidingStat}" has a negative half for ${p.steamid64} — both halves are counts`,
    );
  }
  return { class: 'rate', num: pair.num, den: pair.den };
}

/**
 * `^[0-9]+$`.
 *
 * Deliberately NOT pinned to 17 digits: the column is `text`, this module is a resolver rather
 * than a SteamID64 validator, and the vector's byte-lex case needs short synthetic ids to tell a
 * string sort from a numeric one at all.
 */
const STEAMID64_RE = /^[0-9]+$/;

/** Applies the FR-21 floors over the byte-lex-ordered roster. */
function eligiblePlayers(award: Award, players: readonly SnapshotPlayer[]): SnapshotPlayer[] {
  // ⛔ THE ROSTER ITSELF IS GUARDED, before the spread. `[...null]` throws a bare
  // `TypeError: players is not iterable` and a null element throws on `p.steamid64` — in both
  // cases a built-in throw that this module's own doctrine (see {@link Stage2Error}) says is
  // indistinguishable from an incidental failure. Go returned a TYPED outcome for a nil slice
  // and a typed refusal for a zero-value row, so the two halves of the seam did not refuse the
  // same inputs until the 6-4a code review.
  if (!Array.isArray(players)) {
    throw new Stage2Error('players must be an array — a snapshot is a roster, never null');
  }
  for (const p of players) {
    if (p === null || typeof p !== 'object') {
      throw new Stage2Error(
        `every player must be a snapshot row, got ${JSON.stringify(p) ?? String(p)}`,
      );
    }
  }

  // Never sort the CALLER's array: a resolver that reordered its input would make two consecutive
  // resolutions over the same snapshot observably different operations.
  const ordered = [...players];

  const seen = new Set<string>();
  for (const p of ordered) {
    if (typeof p.steamid64 !== 'string' || !STEAMID64_RE.test(p.steamid64)) {
      throw new Stage2Error(
        `steamid64 must be a non-empty decimal string, got ${JSON.stringify(p.steamid64)}`,
      );
    }
    if (seen.has(p.steamid64)) {
      throw new Stage2Error(
        `duplicate steamid64 ${p.steamid64} — a snapshot holds one row per player`,
      );
    }
    seen.add(p.steamid64);
    if (typeof p.roundsPlayed !== 'bigint' || typeof p.kills !== 'bigint') {
      throw new Stage2Error(
        `${p.steamid64} has a non-integer eligibility input — 0024 coalesces both to 0, never NULL`,
      );
    }
    // The eligibility inputs are read for EVERY player, so they are validated for every player.
    // The deciding magnitudes are validated where they are read, which is only for the eligible.
    if (p.roundsPlayed < 0n || p.kills < 0n) {
      throw new Stage2Error(`${p.steamid64} has a negative eligibility input — both are counts`);
    }
  }

  // ⭐ S6 — ITERATION ORDER IS BYTE-LEX OVER THE DECIMAL SteamID64 *STRING*. JavaScript's `<` on
  // strings compares UTF-16 code units, which is identical to byte order for ASCII digits, and
  // that is what makes this agree with the snapshot's own `order by p.steamid64 collate "C"`
  // (0024:732, named at :545-547 as "Story 6.4's Stage-2 iteration order").
  //
  // ⛔ NEVER `localeCompare` — it is locale-dependent and would order differently per machine
  // (banned by the source scan in `prng.test.ts`). NEVER a numeric sort and never `BigInt`
  // ordering: "10" sorts BEFORE "9" here, and every real SteamID64 being 17 digits is exactly why
  // that difference needs its own vector case rather than being assumed harmless.
  ordered.sort((a, b) => (a.steamid64 < b.steamid64 ? -1 : a.steamid64 > b.steamid64 ? 1 : 0));

  // S2 — the floor test is `>=`, on the snapshot's OWN roundsPlayed / kills, plus `not idleDq`.
  // `floorKills` is 0 for volume awards and 20 for rate awards; a 0 floor still runs the
  // comparison rather than being special-cased away.
  const floorRounds = BigInt(award.floorRounds);
  const floorKills = BigInt(award.floorKills);

  return ordered.filter(
    (p) => !p.idleDq && p.roundsPlayed >= floorRounds && p.kills >= floorKills,
  );
}

function validateAward(award: Award): void {
  if (typeof award.decidingStat !== 'string' || award.decidingStat === '') {
    throw new Stage2Error('award.decidingStat must be a non-empty string');
  }
  if (award.class !== 'volume' && award.class !== 'rate') {
    throw new Stage2Error(
      `unknown award class ${JSON.stringify(award.class)} — 0023 constrains it to volume|rate`,
    );
  }
  if (award.direction !== 'max' && award.direction !== 'min') {
    throw new Stage2Error(
      `unknown award direction ${JSON.stringify(award.direction)} — 0023 constrains it to max|min`,
    );
  }
  if (
    !Number.isInteger(award.floorRounds) ||
    !Number.isInteger(award.floorKills) ||
    award.floorRounds < 0 ||
    award.floorKills < 0
  ) {
    throw new Stage2Error(
      'floors must be non-negative integers — 0023’s award_floors_non_negative',
    );
  }
}
