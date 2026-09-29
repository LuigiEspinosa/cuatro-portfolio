/**
 * The FR-29 tie ladder — the browser VERIFIER side (Story 6.5, FR-29 / AD-14 / AD-19 /
 * SOLUTION-DESIGN §9.3 / SPEC Constraint 7).
 *
 *   ABSENT_TS = -1n                    # 0024:704, the PUBLISHED absent sentinel
 *
 *   value(key, block) = block[key]     # integer  if key in VOLUME_STAT_KEYS (17)
 *                     = {num, den}     # pair     if key in RATE_STAT_KEYS   (4)
 *                                      # otherwise: REFUSE                            L5
 *
 *   beats(dir, a, b)  = cmp(a, b) > 0 for 'max';  < 0 for 'min'
 *   best(S, dir, f)   = { p in S : no q in S with beats(dir, f(q), f(p)) }   # a SET
 *
 *   resolveLadder(award, tied, players):
 *       validate(award, tied, players)                                       # order below
 *       S = tied                                        # byte-lex, |S| >= 2
 *
 *       if award.secondaryStat is present:                                   # L2 SKIP
 *           S1 = best(S, dir, p -> value(secondaryStat, p.secondary))
 *           if |S1| === 1: return winner(S1[0], 1)
 *           S = S1                                                           # L3 NARROW
 *
 *       if award.effNumKey and award.effDenKey are present:                   # L2 SKIP
 *           ratio(p) = { num: p.eff[nk].num * p.eff[dk].den,                  # L6
 *                        den: p.eff[nk].den * p.eff[dk].num }
 *           S2 = best(S, dir, ratio)
 *           if |S2| === 1: return winner(S2[0], 2)
 *           S = S2
 *
 *       D = { p in S : for every q in S, q !== p:
 *                          p.h2h has q and q.h2h has p                        # L8, BOTH ways
 *                      and beats(dir, value(decidingStat, p.h2h[q]),
 *                                     value(decidingStat, q.h2h[p])) }
 *       if |D| === 1: return winner(D[0], 3)
 *       if |D| >  1: REFUSE internal   # a strict dominator cannot be plural   # L7
 *       # |D| === 0 -> SKIP, S unchanged (nobody was eliminated)
 *
 *       P = [ p in S : p.achievementTs !== ABSENT_TS ]                        # L9
 *       if P is non-empty:
 *           m  = min(p.achievementTs for p in P)      # NEVER inverted         # L4
 *           S4 = [ p in P : p.achievementTs === m ]
 *           if |S4| === 1: return winner(S4[0], 4)
 *           S = S4
 *       # every survivor absent -> SKIP with S unchanged
 *
 *       return shared(S in byte-lex order, exitStep = 5)   # TERMINAL, no PRNG  L10 / DECISION H
 *
 * ⛔⛔ L1 — THE LADDER TAKES NO STREAM, DRAWS ZERO BYTES, AND IS **SYNCHRONOUS**. The signature is
 * the proof: there is no `Stream` parameter anywhere in this module and there must never be one, and
 * unlike `stage1Pick` nothing here is `async` because there is nothing to await. It is what keeps
 * 6-4b's MEASURED 22-byte 12-spin ceremony valid and what lets 6.9's browser reproduce a
 * ladder-resolved award without a stream at all. ⚠ Do not "verify" this with a runtime assertion: a
 * test that opens a fresh stream and asserts `consumed` is unchanged around a call to a function
 * that cannot reach a stream CANNOT FAIL for any implementation — the 6-4b code review deleted
 * exactly two such assertions rather than repairing them. The type carries the property.
 *
 * ⛔ DECISION H (Cuatro, 2026-08-04, answering deferred-work.md:281's NAMED BLOCKER). Rung 5 — the
 * shared co-winner — IS the deterministic terminal rung the blocker asked for. It is satisfied by
 * RECOGNISING the rung FR-29 already ends with rather than by adding a seeded one: a seeded rung
 * would make this a stream CONSUMER, moving every byte position after it and invalidating both the
 * measured ceremony and everything this verifier reproduces.
 *
 * ⚠ THE EXPECTATION THIS DECISION SHIPPED WITH WAS MEASURED FALSE BY THE SAME STORY, AND THE
 * CORRECTION IS RECORDED HERE RATHER THAN QUIETLY DROPPED (Story 6-5b, T9a — this used to read
 * "SHARED TROPHIES WILL BE COMMON"). The MECHANISM is exactly as the blocker described: 14 of 14
 * duel pairs carry a BYTE-IDENTICAL `achievement_ts`, because `approve_match` stamps one transaction
 * timestamp on every row of a match (0024:898-907), so rung 4 provably cannot separate two players
 * of one duel. But the OUTCOME is unreachable on this corpus: 0 of the 5 real ties contains a duel
 * pair — every tie is assembled ACROSS matches, whose approvals are separate transactions — so rung
 * 4 separates all five and 0 of 12 awards end SHARED. The reason is structural to 1v1 wingman: a
 * player plays one match, so two opponents are never tied against each other on a tournament-wide
 * total. The shared rung remains correct, necessary and UNTRIGGERED, and it is gated by vector rows
 * rather than by production traffic. Re-measure before quoting either number for a 5v5 format.
 *
 * ⛔ DECISION K — DECISION E's carve-out is UPSTREAM and stays upstream. A `max` volume award whose
 * best value is 0 returns `no_awardable_value` and never becomes a tie, so the 27-way zero tie
 * `deferred-work.md:270` predicted never reaches this module. Its width is there to be READ, never
 * resolved.
 *
 * ⛔ NO `import 'server-only'` — see the note in `labels.ts`. `lib/roulette` is the one `lib/**`
 * package that ships to the browser (6.9's "Verificar la ceremonia") and `server-only` throws in a
 * client bundle. Pinned by the source scan in `prng.test.ts`, whose module list is asserted by EXACT
 * EQUALITY, so this file had to be registered there to be scanned at all.
 *
 * ⛔ NO import of `lib/awards/**`. That package IS `server-only`, and importing it here would poison
 * the browser bundle — which is also why the 17/4 vocabulary below is restated rather than imported
 * from `catalog.ts`. The award arrives as PLAIN DATA.
 *
 * ⛔ ALL COMPARISON ARITHMETIC IS `bigint`. Never `Number`, never a division, never `Math.*`, never
 * `**`. Rung 2 multiplies FOUR unbounded snapshot magnitudes per side (L6), and the vector's
 * `rung-2-four-term-products-past-2-pow-53` case is corrupted at `JSON.parse` time if any magnitude
 * is read as a number — which is why every magnitude in that file is a decimal STRING.
 *
 * THE SEAM (ARCHITECTURE-SPINE.md:73-76). This module conforms to `roulette/vectors/`, never to
 * `worker/awards`. They are two independent implementations of one spec; neither is the reference
 * and neither may be corrected by reading the other's source. When they disagree the vector decides;
 * when the vector is silent, add a vector.
 *
 * ⛔ NOT IN THIS MODULE, each with an owner: `award_result.tie_ladder_exit_step` PERSISTENCE and the
 * 1..N `award_result_winner` rows (6.8 — this module EMITS the exit step and stores nothing), the
 * anti-sweep overflow loop that re-drives this ladder over a REDUCED set (6.6 — {@link resolveLadder}
 * takes an explicit `tied` so 6.6 needs no fake tie outcome), pity (6.7), canonicalization (6.9), and
 * the one-card-two-prize-chips reveal (6.10).
 */

import { Stage2Error, beatsBy, rungKey } from './stage2';
import type {
  Award,
  AwardClass,
  AwardDirection,
  Ladder,
  Outcome,
  RatePair,
  SnapshotPlayer,
  StatValue,
  TieOutcome,
} from './stage2';

/**
 * The PUBLISHED absent sentinel for `stat_snapshot_row.achievement_ts` (0024:704, 898-907): a
 * rostered player with no contributing approved row.
 *
 * ⭐ IT IS NUMERICALLY THE SMALLEST VALUE IN THE COLUMN, which is the entire reason L9 exists.
 */
export const ABSENT_ACHIEVEMENT_TS = -1n;

/**
 * The five exit steps, NAMED — the mirror of Go's `LadderExitSecondary … LadderExitShared`.
 *
 * ⭐ THEY EXIST SO THE VECTOR HAS SOMETHING TO BE PINNED AGAINST (Story 6-5b, T6). Go's suite asserts
 * `exit_steps` against package constants by exact equality; this side transcribed `[1, 2, 3, 4, 5]`
 * and `toBe(5)` as literals INTO THE TEST, so the vector was being compared with a copy of itself and
 * a module that renumbered a rung reddened only where the literal happened to be written down. A
 * transcribed value cannot pin the thing it was transcribed from — that is this directory's founding
 * rule, applied to the one place it had not been.
 *
 * ⛔ NO BEHAVIOUR CHANGE: every one of these replaces a literal that was already there, at the same
 * sites, with the same values.
 */
export const LADDER_EXIT_SECONDARY = 1;
export const LADDER_EXIT_EFFICIENCY = 2;
export const LADDER_EXIT_H2H = 3;
export const LADDER_EXIT_ACHIEVED = 4;
export const LADDER_EXIT_SHARED = 5;

/** The five, in rung order — pinned against the vector's `exit_steps` by exact equality. */
export const LADDER_EXIT_STEPS: readonly number[] = Object.freeze([
  LADDER_EXIT_SECONDARY,
  LADDER_EXIT_EFFICIENCY,
  LADDER_EXIT_H2H,
  LADDER_EXIT_ACHIEVED,
  LADDER_EXIT_SHARED,
]);

/**
 * The 17/4 vocabulary split, transcribed from 0023's `award_deciding_stat_valid` CHECK (0023:89-96)
 * and `award_secondary_stat_valid` / `award_eff_*_key_valid` (0023:98-115).
 *
 * ⭐ WHY THIS MODULE RESTATES IT. `lib/awards/catalog.ts` exports the same lists and is `server-only`
 * — importing it here would poison the browser bundle — while L5 needs a key's CLASS derived from
 * the KEY: `secondary` is `volume || rate` (0024:723), so `secondary[k]` is an integer for a volume
 * key and a `{num,den}` pair for a rate key INDEPENDENTLY of the class of the award's deciding stat.
 * Without the split, rung 1 has no way to know which shape to read.
 *
 * ⚠ IT IS THE FOURTH RESTATEMENT (0023's CHECKs, `award_stat_vocabulary()`, `catalog.ts`, and now
 * the two runtimes), so it is PINNED against the vector's `stat_vocabulary` block by exact equality
 * in both suites rather than trusted. A key added on one side alone reddens.
 *
 * `Object.freeze` is SHALLOW — 6.1 shipped a "frozen" catalog of mutable entries on exactly that
 * mistake. One call suffices here only because every element is a primitive, and the test asserts
 * that rather than assuming it.
 */
export const VOLUME_STAT_KEYS: readonly string[] = Object.freeze([
  'kills',
  'deaths',
  'assists',
  'mvps',
  'flash_assists',
  'utility_damage',
  'knife_kills',
  'wallbang_kills',
  'through_smoke_kills',
  'no_scope_kills',
  'blind_kills',
  'entry_frags',
  'opening_deaths',
  'rounds_won',
  'rounds_played',
  'matches_played',
  'hs_kills',
]);

export const RATE_STAT_KEYS: readonly string[] = Object.freeze([
  'adr',
  'hs_pct',
  'kast_pct',
  'entry_success',
]);

const STAT_KEY_CLASS: ReadonlyMap<string, AwardClass> = new Map<string, AwardClass>([
  ...VOLUME_STAT_KEYS.map((k) => [k, 'volume'] as const),
  ...RATE_STAT_KEYS.map((k) => [k, 'rate'] as const),
]);

/**
 * L5's whole rule: a key's class comes from the VOCABULARY, never from `award.class`. A key in
 * neither half is a refusal — never a guess and never a default.
 */
function classOfStatKey(key: string): AwardClass | undefined {
  return STAT_KEY_CLASS.get(key);
}

/**
 * The closed set of things a ladder refusal can be ABOUT, in the ORDER all three implementations
 * check them.
 *
 * ⭐ THE ORDER IS CONTRACT, NOT TASTE, and it is published in `ladder-resolve.json`'s `spec` string.
 * Story 6-4b's headline defect was three implementations disagreeing about whether `live_count` was
 * validated before or after weighting — invisible because no vector row was malformed in two ways at
 * once, so nothing could pin WHICH guard fires first. The vector's `MALFORMED IN TWO WAYS AT ONCE`
 * row is the only row that can redden a regression here.
 *
 * ⭐ AND IT IS GENUINELY CLOSED. Story 6-4b shipped a "closed set" that was not: nine constants in Go
 * against seven here and seven in the vector, with this side emitting the missing two anyway. All
 * five are declared once in the anchor, carried in the vector's `refusal_details`, and pinned against
 * this constant by exact equality in both suites.
 */
export const LADDER_REFUSAL_DETAILS: readonly string[] = Object.freeze([
  'stage2', // the Stage-2 award surface refused; propagated, never swallowed
  'award', // a rung key outside the vocabulary, or a HALF-CONFIGURED efficiency pair
  'tied', // the tied set's own shape
  'player', // a snapshot row is malformed or missing a key the ladder needs
  'internal', // an invariant this module believes unreachable
]);

/**
 * ⚠ `internal` IS DECLARED AND IS NOT ROW-REPRESENTABLE, exactly as `stage1.ts`'s `stream` and
 * `internal` are — and here the unreachability is PROVABLE rather than asserted. Rung 3's dominator
 * test is antisymmetric (`compareStatValues(a,b) === -compareStatValues(b,a)`), so `p` beating `q`
 * means `q` does not beat `p`, so two players can never both beat everyone: `|D| > 1` is reachable
 * ONLY from a broken comparator. That is exactly why it is a loud typed refusal (Cuatro's call,
 * 2026-08-04) rather than a fall-through — falling through converts a comparator bug into a silently
 * SHARED trophy, indistinguishable from a legitimate rung-5 bottom-out, and rung-5 bottom-outs are
 * the outcome this ceremony is going to produce a lot of.
 */

/**
 * A programmer/data error this module refuses to resolve past.
 *
 * ⭐ ITS OWN CLASS, not a bare `Error` and not a reuse of `Stage2Error`/`Stage1Error`. The 6.3 review
 * measured a mutation surviving the entire suite because a built-in threw the same type the test
 * asserted, and 6-4a measured that an untyped refusal surface let a mutation which rejected EVERY
 * input pass all sixteen refusal rows. A named class keeps every assertion specific to THIS module.
 */
export class LadderError extends Error {
  /** WHICH input was rejected — one of {@link LADDER_REFUSAL_DETAILS}. */
  readonly detail: string;

  constructor(detail: string, message: string, options?: { cause?: unknown }) {
    super(`roulette: FR-29 ladder refused (${detail}): ${message}`, options);
    this.name = 'LadderError';
    this.detail = detail;
  }
}

/**
 * The real FR-29 tiebreak ladder — the {@link Ladder} the ceremony injects.
 *
 * ⚠ It is a frozen singleton with no state on purpose: the ladder is a pure function of the award,
 * the tied set and the frozen snapshot. Anything it remembered between calls would make two
 * resolutions of the same tie observably different operations.
 *
 * ⚠ It refuses a non-tie outcome rather than passing it through. The port is only ever handed a
 * `'tie'` by `resolveAward`, so anything else means the caller is broken — and DECISION K makes the
 * point sharp: a `no_awardable_value` outcome CARRIES a `tied` set, so a ladder that resolved
 * whatever it was given would re-crown the very zero tie DECISION E exists to suppress.
 */
export const fr29Ladder: Ladder = Object.freeze({
  resolve(award: Award, tie: TieOutcome, players: readonly SnapshotPlayer[]): Outcome {
    if (tie === null || typeof tie !== 'object' || tie.kind !== 'tie') {
      throw new LadderError(
        'tied',
        `the ladder resolves a "tie" outcome and was handed ${describeKind((tie as { kind?: unknown } | null)?.kind)} — ` +
          'DECISION K: a no_awardable_value outcome carries a tied set whose WIDTH is to be read, ' +
          'never resolved',
      );
    }
    return resolveLadder(award, tie.tied, players);
  },
});

/**
 * The pure ladder over injected inputs, and the entry point Story 6.6 drives.
 *
 * ⭐ IT TAKES AN EXPLICIT `tied` RATHER THAN AN `Outcome`, and that is the seam decision worth
 * getting right once: 6.6's anti-sweep re-resolves an award over a REDUCED set after the original
 * winner is removed, and building a fake tie outcome to do that would be inventing a Stage-2 result
 * that Stage 2 never produced.
 *
 * ⛔ SYNCHRONOUS. No stream, no clock, no randomness, no I/O (L1).
 */
export function resolveLadder(
  award: Award,
  tied: readonly string[],
  players: readonly SnapshotPlayer[],
): Outcome {
  const byId = validateLadder(award, tied, players);
  const direction = award.direction;
  let survivors: readonly string[] = [...tied];

  // ── RUNG 1 — the secondary stat ─────────────────────────────────────────────────────────────
  //
  // L2 — an ABSENT `secondaryStat` is a deterministic SKIP. Not a refusal, not a zero, and not
  // "fall back to the deciding stat": the award simply declines this rung.
  //
  // ⚠ THE SKIP IS NOW EXERCISED ONLY BY THE VECTOR, NOT IN PRODUCTION. All twelve shipped awards
  // had all three keys NULL until 6.5's own catalog pass filled them, so this branch WAS the common
  // path and is now taken by ZERO shipped awards. It stays a first-class contract because 0023's
  // columns are nullable and 6.6 may hand the ladder a reduced award — but do not read this rung as
  // "usually skipped" any more. (Comment corrected at the Group-1 code review, 2026-08-04, which
  // found it asserting the opposite of what the same commit shipped.)
  const secondaryStat = rungKey(award.secondaryStat);
  if (secondaryStat !== null) {
    const narrowed = bestSurvivors(survivors, direction, (sid) =>
      statValue(secondaryStat, container(byId.get(sid)?.secondary), `${sid}.secondary`),
    );
    if (narrowed.length === 1) return ladderWinner(narrowed[0] as string, LADDER_EXIT_SECONDARY);
    // L3 — NARROW. The next rung runs over THESE, never over the original `tied`. A ladder that
    // re-read the full tied set at every rung is a VOTE, not a ladder, and it can crown a player
    // this rung already eliminated.
    survivors = narrowed;
  }

  // ── RUNG 2 — the efficiency ratio: a RATIO OF TWO RATIOS ────────────────────────────────────
  //
  // ⭐⭐ THE SHIPPED PAIR IS `kills`/`deaths`, SO A ZERO DENOMINATOR IS AN ORDINARY SHAPE HERE, NOT
  // AN EXOTIC ONE — accepted and documented rather than engineered away (Cuatro, Group-1 code
  // review, 2026-08-04). S3's semantics are inherited verbatim from Stage 2 and L6 forbids "fixing"
  // them, so on a 1v1 corpus expect both of these to be reachable:
  //
  //   - a survivor with 0 deaths gives n/0, which BEATS every finite value — they win this rung
  //     outright on a `max` award, and lose to everyone on `El Inofensivo`;
  //   - a survivor with 0 kills AND 0 deaths gives 0/0, which is EQUAL to everything — they can
  //     never be eliminated at rung 1 or rung 2 and ride to the shared rung 5.
  //
  // Both agree with Stage 2 by construction (this rung and `resolveStage2` share
  // `compareStatValues`), both have their own vector rows, and neither is reachable on today's
  // corpus because rung 1 resolves all five real ties. ⛔ Do not special-case them here — the place
  // to change this behaviour is the catalog's choice of denominator, and that is a measured decision.
  const numKey = rungKey(award.effNumKey);
  const denKey = rungKey(award.effDenKey);
  if (numKey !== null && denKey !== null) {
    const narrowed = bestSurvivors(survivors, direction, (sid) => {
      // L6 — `efficiency[k]` is ALWAYS a `{num, den}` pair (`snapshot_efficiency_form`,
      // 0024:352-364: a volume `v` becomes `{v, 1n}`), so the ratio of two of them is
      //     num = eff[numKey].num * eff[denKey].den
      //     den = eff[numKey].den * eff[denKey].num
      // and comparing two players cross-multiplies THOSE — four multiplications of unbounded
      // snapshot magnitudes per side. `bigint` is exact at every width; a `Number` here is
      // corrupted before the first multiplication.
      const eff = container(byId.get(sid)?.efficiency);
      const num = efficiencyPair(eff, numKey, `${sid}.efficiency`);
      const den = efficiencyPair(eff, denKey, `${sid}.efficiency`);
      return { class: 'rate', num: num.num * den.den, den: num.den * den.num } as const;
    });
    if (narrowed.length === 1) return ladderWinner(narrowed[0] as string, LADDER_EXIT_EFFICIENCY);
    survivors = narrowed;
  }

  // ── RUNG 3 — the head-to-head STRICT dominator over the REMAINING set ────────────────────────
  const dominators = h2hDominators(award, survivors, byId);
  if (dominators.length === 1) return ladderWinner(dominators[0] as string, LADDER_EXIT_H2H);
  if (dominators.length > 1) {
    // L7 — unreachable over an antisymmetric comparator; see the note above.
    throw new LadderError(
      'internal',
      `rung 3 computed ${String(dominators.length)} strict dominators, which is impossible over an ` +
        'antisymmetric comparator — the comparator is broken',
    );
  }
  // |D| === 0 -> SKIP, and `survivors` is UNCHANGED. Failing to dominate is not losing: nobody was
  // eliminated, so every survivor reaches rung 4.

  // ── RUNG 4 — the earliest achievementTs; the SENTINEL NEVER WINS ─────────────────────────────
  //
  // ⭐ L9 — FILTER THE ABSENTS BEFORE MINIMISING. `-1n` is the published absent sentinel AND
  // numerically the smallest value in the column, so a naive `min` crowns the player with NO
  // APPROVED ROWS AT ALL — the worst possible outcome for a rung whose whole meaning is "did it
  // first".
  const present = survivors.filter(
    (sid) => (byId.get(sid) as SnapshotPlayer).achievementTs !== ABSENT_ACHIEVEMENT_TS,
  );
  if (present.length > 0) {
    // ⭐ L4 — ALWAYS THE EARLIEST, NEVER INVERTED BY `direction`. Rung 4 is a RECENCY rule, not a
    // stat: inverting it would mean "the latest achievement wins" for the catalog's one `min` award
    // (`El Inofensivo`) and for no other, which is a rule nobody wrote down anywhere.
    //
    // ⛔ NEVER `Math.min` — these are `bigint`, and `Math.min` would coerce them (a TypeError at
    // best, a rounded number at worst). The fold is explicit for that reason.
    let earliest = (byId.get(present[0] as string) as SnapshotPlayer).achievementTs as bigint;
    for (const sid of present) {
      const ts = (byId.get(sid) as SnapshotPlayer).achievementTs as bigint;
      if (ts < earliest) earliest = ts;
    }
    const narrowed = present.filter(
      (sid) => (byId.get(sid) as SnapshotPlayer).achievementTs === earliest,
    );
    if (narrowed.length === 1) return ladderWinner(narrowed[0] as string, LADDER_EXIT_ACHIEVED);
    survivors = narrowed;
  }
  // Every survivor absent -> SKIP with `survivors` unchanged. Not a refusal, and not a crash on an
  // empty minimum: it is the ordinary shape for a roster whose matches are unapproved.

  // ── RUNG 5 — the shared co-winner. TERMINAL. NO PRNG. (L10 / DECISION H) ─────────────────────
  //
  // The FULL surviving set, in the byte-lex order it has carried since `tied` — never the first,
  // never the lowest SteamID64. Returning one of them is the silent argmax AD-14 forbids, wearing
  // its last available hat. EXPERIENCE.md:123: "a designed outcome, never an error state".
  return { kind: 'shared', winners: [...survivors], ladderExitStep: LADDER_EXIT_SHARED };
}

/**
 * A ladder-resolved single winner.
 *
 * ⚠ NO `decidingValue`, DELIBERATELY. The tie this ladder resolves carries none (Stage 2's tie arm
 * has no value), and L12 forbids re-deriving one: the ladder reads the tied set as given and never
 * re-reads the deciding magnitudes. Story 6.8, which persists `award_result`, holds the snapshot and
 * can render it there.
 */
function ladderWinner(steamid64: string, exitStep: 1 | 2 | 3 | 4): Outcome {
  // ⛔ `decidingValue` IS OMITTED, NOT ZEROED. A fabricated `0` is a plausible-looking lie that
  // `award_result.deciding_value` would render on stage; absence is the honest statement, and it is
  // what the vector's expected block carries. Go's mirror leaves the struct field at its zero value,
  // which says the same thing in that language.
  return { kind: 'winner', steamid64, ladderExitStep: exitStep };
}

/**
 * `beats` over two CLASS-SHAPED values, taking the DIRECTION alone — the mirror of Go's `beatsStat`
 * (`ladder.go:505`).
 *
 * ⚠ IT TAKES A DIRECTION, NOT AN AWARD, and that is deliberate: rung 4 must never be inverted (L4)
 * and rung 2 compares a COMPUTED ratio that belongs to no award's class. Passing the whole award
 * would invite both mistakes.
 *
 * ⛔ IT EXISTS SO THE CLASS-MISMATCH REFUSAL IS A `LadderError`, NOT A `Stage2Error`. The rungs used
 * to call `beatsBy` directly, whose mixed-class arm throws `Stage2Error` — which carries no `detail`
 * and is therefore OUTSIDE `LADDER_REFUSAL_DETAILS` entirely, the "closed set that is not closed"
 * shape this module's header says it guards against. Go bothered to guard it and this side did not,
 * so one unreachable input produced two different refusal TYPES across the seam. Unreachable in
 * practice — every value inside one rung is read through ONE key via `statValue`, so they share a
 * class — and guarded anyway, for the same reason Go guards it. (Code review, Group 1, 2026-08-04.)
 *
 * ⚠ S3's ZERO-DENOMINATOR SEMANTICS ARE INHERITED VERBATIM by delegating to `beatsBy`:
 * cross-multiplication stays total, `0/0` compares EQUAL to everything, and `n/0` with `n > 0` beats
 * every finite value.
 */
function beatsStat(direction: AwardDirection, a: StatValue, b: StatValue): boolean {
  if (a.class !== b.class) {
    throw new LadderError(
      'internal',
      `cannot compare a ${String(a.class)} value with a ${String(b.class)} value`,
    );
  }
  try {
    return beatsBy(direction, a, b);
  } catch (err) {
    throw new LadderError(
      'internal',
      `comparing two ${String(a.class)} values: ` +
        (err instanceof Error ? err.message : String(err)),
      { cause: err },
    );
  }
}

/**
 * `best` as a SET over the survivors, preserving their byte-lex order.
 *
 * ⭐ A SET, NEVER A CHAMPION — the same S7 rule Stage 2 obeys, for the same reason: a running
 * champion replaced on `>` silently keeps the FIRST of an equal pair and IS the argmax AD-14
 * forbids; replaced on `>=` it silently keeps the LAST.
 */
function bestSurvivors(
  survivors: readonly string[],
  direction: AwardDirection,
  valueOf: (sid: string) => StatValue,
): readonly string[] {
  const values = new Map<string, StatValue>();
  for (const sid of survivors) values.set(sid, valueOf(sid));
  const best = survivors.filter(
    (p) =>
      !survivors.some((q) =>
        beatsStat(direction, values.get(q) as StatValue, values.get(p) as StatValue),
      ),
  );
  // ⛔ AN EMPTY BEST SET IS A REFUSAL, NEVER A SILENT NARROWING — the same guard `stage2.ts:490`
  // carries, for the same reason and with the same caveat: it holds because of ACYCLICITY, not
  // transitivity (`0/0` is equal to everything, so the relation is NOT transitive and that is fine).
  // Every non-empty set has an unbeaten member while the strict part is acyclic; if this ever fires,
  // the comparator is broken. ⭐ Without it the emptiness propagates silently to rung 5 and
  // `resolveLadder` hands back a SHARED outcome with ZERO winners — a trophy awarded to nobody,
  // which is the "plausible, wrong, nothing red" failure Stage 2's twin exists to prevent. The guard
  // belongs HERE because this is the only place `survivors` can shrink to empty: rung 3 never
  // narrows, and rung 4's minimum is drawn from a non-empty `present`.
  // (Code review, Group 1, 2026-08-04.)
  if (best.length === 0) {
    throw new LadderError(
      'internal',
      `empty best set over ${String(survivors.length)} survivors — the comparator's strict part is ` +
        'not acyclic',
    );
  }
  return best;
}

/** Rung 3: every survivor who STRICTLY beats every other survivor head-to-head. */
function h2hDominators(
  award: Award,
  survivors: readonly string[],
  byId: ReadonlyMap<string, SnapshotPlayer>,
): readonly string[] {
  return survivors.filter((p) => {
    const mine = container(byId.get(p)?.h2h);
    return survivors.every((q) => {
      if (q === p) return true;
      const theirs = container(byId.get(q)?.h2h);
      // ⛔ L8 — BOTH DIRECTIONS MUST EXIST, AND AN ABSENT OPPONENT KEY IS NEVER A ZERO. `h2h[p][q]`
      // holds P's OWN stats over the matches p and q shared, so a comparison needs both halves; one
      // present and one absent is still "not comparable". An absent opponent key is the NEVER-MET
      // signal and DISQUALIFIES p as a dominator — 0024:920-923 gives the reason verbatim: "a zero
      // would silently become a real comparison".
      // ⚠ `h2h` is `{}` for a player with no shared approved matches, and a player is never a key
      // in their own map. `Object.hasOwn`, not a bare lookup: a plain object inherits `constructor`
      // and friends from its prototype, so a bare `mine[q]` can return a FUNCTION for an opponent
      // who is not in the map at all — and Go's map has no such hazard, so without this the two
      // halves of the seam would disagree on an input neither would report.
      if (!Object.hasOwn(mine, q) || !Object.hasOwn(theirs, p)) return false;
      const a = statValue(
        award.decidingStat,
        container(mine[q] as Record<string, StatValue> | undefined),
        `${p}.h2h[${q}]`,
      );
      const b = statValue(
        award.decidingStat,
        container(theirs[p] as Record<string, StatValue> | undefined),
        `${q}.h2h[${p}]`,
      );
      // L7 — STRICT. `p` must BEAT `q`, not merely not-lose to them. Relaxing this to "beats at
      // least one" turns a dominator into a plurality vote.
      return beatsStat(award.direction, a, b);
    });
  });
}

/**
 * ⭐ AN ABSENT CONTAINER IS THE EMPTY CONTAINER (Cuatro, 2026-08-04, carried from the 6-4b review).
 * Go's `map[string]StatValue` cannot tell a nil map from an empty one, so `undefined` must mean here
 * what nil means there or the producer and the verifier disagree about an input neither would
 * report. The normalisation happens HERE, inside the ladder — never by loosening `stage2.ts`, which
 * the scope boundary forbids.
 *
 * ⚠ `null` and structurally-wrong types are still REFUSED, and that guard is deliberately NOT
 * vectorable: Go cannot express those states at all. Same split as `stage1.ts`'s shelf.
 */
/**
 * Render an arbitrary rejected value for a refusal message, WITHOUT throwing on the way.
 *
 * ⛔ `JSON.stringify` THROWS ON A `bigint` (`TypeError: Do not know how to serialize a BigInt`), and
 * these messages are built precisely when a value is NOT the expected shape — in a module where
 * every magnitude IS a `bigint`. A stray magnitude arriving where a snapshot block or a player row
 * belongs would therefore replace the typed `LadderError` with a raw `TypeError` thrown from inside
 * the constructor argument, so the caller never receives a refusal it can inspect at all. That is
 * the mutation-survival shape this module's refusal doctrine exists to prevent.
 * (Code review, Group 1, 2026-08-04.)
 *
 * ⚠ Deliberately NOT used in {@link validateStage2AwardSurface}: those four clauses are byte-verbatim
 * copies of `stage2.ts`'s private `validateAward`, and keeping them character-identical is what makes
 * "the same four clauses" checkable by diff rather than by trust.
 */
function describe(value: unknown): string {
  if (typeof value === 'bigint') return `${String(value)}n`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * {@link describe}, but an ABSENT value reads as `nothing` rather than `undefined` — the wording the
 * port's non-tie refusal has carried since 6-4a, preserved verbatim so the message is unchanged.
 */
function describeKind(value: unknown): string {
  return value === undefined ? 'nothing' : describe(value);
}

function container<T>(value: Readonly<Record<string, T>> | undefined): Record<string, T> {
  if (value === undefined) return {};
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new LadderError(
      'player',
      `a snapshot block must be an object or absent, got ${describe(value)}`,
    );
  }
  return value as Record<string, T>;
}

/**
 * One CLASS-SHAPED value out of a `secondary` or `h2h[opp]` block.
 *
 * ⚠ AN ABSENT KEY IS A REFUSAL, NEVER A ZERO — the same doctrine 0024:918-923 states for an absent
 * h2h OPPONENT, applied one level in. The two absences mean different things and must stay
 * distinguishable: an absent OPPONENT is "they never met" (a skip, handled by the caller); an absent
 * STAT KEY inside a present opponent block is a CORRUPT ROW, because the DATABASE writes all 21 keys
 * into every block it writes at all (0024:667-683's `parts` CTE).
 *
 * ⚠ THE VECTOR'S FIXTURES DO NOT, AND THAT IS DELIBERATE (Story 6-5b, T9e): every `h2h` block in
 * `ladder-resolve.json` carries exactly ONE key, precisely so that "the key this award reads is
 * missing" stays an expressible INPUT with a row of its own.
 */
function statValue(key: string, block: Record<string, StatValue>, where: string): StatValue {
  const klass = classOfStatKey(key);
  if (klass === undefined) {
    throw new LadderError('award', `${where}: ${key} is not one of the 21 vocabulary keys`);
  }
  if (!Object.hasOwn(block, key)) {
    throw new LadderError(
      'player',
      `${where}: key ${key} is absent — an absent key is a refusal, never a zero`,
    );
  }
  const value = block[key];
  if (value === null || typeof value !== 'object') {
    throw new LadderError('player', `${where}: key ${key} carries ${String(value)}`);
  }
  // ⭐ L5 — THE SHAPE IS CHECKED AGAINST THE KEY'S CLASS, NEVER AGAINST `award.class`. `secondary`
  // is `volume || rate`, so a VOLUME award may perfectly well name `hs_pct` as its secondary and the
  // value read is then a `{num,den}` PAIR. An implementation that branched on `award.class` reads
  // that pair as a bare integer for every award whose secondary crosses classes.
  if (value.class !== klass) {
    throw new LadderError(
      'player',
      `${where}: key ${key} is a ${klass} key carrying a ${String(value.class)} value`,
    );
  }
  // ⛔ NEGATIVE MAGNITUDES ARE REFUSED, exactly as `stage2.ts:618,638` refuses them on the DECIDING
  // value, and for the identical reason stated there: cross-multiplication `a.num*b.den >
  // b.num*a.den` is the right test only while both denominators are non-negative, and one negative
  // SILENTLY INVERTS the comparison — the ladder then returns a plausible, wrong survivor with
  // nothing red anywhere. ⚠ S3's zero semantics are inherited verbatim (`beatsBy`); only a NEGATIVE
  // is refused. Every one of these is a `coalesce`d count in 0024, so this is unreachable from a
  // real snapshot — which is precisely why Stage 2 keeps its own copy loud rather than trusting the
  // producer, and why the ladder, reading THREE blocks Stage 2 never touches, needs its own.
  // (Code review, Group 1, 2026-08-04.)
  if (value.class === 'volume') {
    if (typeof value.value !== 'bigint') {
      throw new LadderError('player', `${where}: volume key ${key} carries no integer`);
    }
    if (value.value < 0n) {
      throw new LadderError(
        'player',
        `${where}: volume key ${key} is negative — every volume stat is a count`,
      );
    }
    return value;
  }
  if (typeof value.num !== 'bigint' || typeof value.den !== 'bigint') {
    throw new LadderError(
      'player',
      `${where}: rate key ${key} carries an incomplete {num, den} pair`,
    );
  }
  if (value.num < 0n || value.den < 0n) {
    throw new LadderError(
      'player',
      `${where}: rate key ${key} has a negative half — both halves are counts`,
    );
  }
  return value;
}

/**
 * One `{num, den}` out of the efficiency block. Uniform — there is no class branch here, because
 * `snapshot_efficiency_form` gives EVERY key that shape.
 */
function efficiencyPair(
  block: Record<string, RatePair>,
  key: string,
  where: string,
): RatePair {
  if (classOfStatKey(key) === undefined) {
    throw new LadderError('award', `${where}: ${key} is not one of the 21 vocabulary keys`);
  }
  if (!Object.hasOwn(block, key)) {
    throw new LadderError(
      'player',
      `${where}: key ${key} is absent — an absent key is a refusal, never a zero`,
    );
  }
  const pair = block[key];
  if (
    pair === null ||
    typeof pair !== 'object' ||
    typeof pair.num !== 'bigint' ||
    typeof pair.den !== 'bigint'
  ) {
    throw new LadderError(
      'player',
      `${where}: efficiency[${key}] carries an incomplete {num, den} pair — ` +
        'snapshot_efficiency_form gives every key that shape, a volume v as {v, 1n}',
    );
  }
  // ⛔ NEGATIVE HALVES ARE REFUSED — see the note in `statValue`. It matters MORE here: rung 2
  // multiplies FOUR of these halves together, so a single negative flips the sense of the whole
  // four-term product and makes the "beats" relation cyclic rather than merely wrong.
  if (pair.num < 0n || pair.den < 0n) {
    throw new LadderError(
      'player',
      `${where}: efficiency[${key}] has a negative half — both halves are counts`,
    );
  }
  return pair;
}

const STEAMID64_RE = /^[0-9]+$/;

/**
 * Validate in the PUBLISHED order and return the steamid64 -> player index.
 *
 * ⭐ THE ORDER IS PUBLISHED IN THE VECTOR'S `spec` STRING AND PINNED BY ROWS MALFORMED TWICE. It is
 * SIX groups, not four, and the details ALTERNATE:
 *
 *   1. `stage2` — the award's Stage-2 surface, re-run because {@link resolveLadder} is a PUBLIC
 *      entry point Story 6.6 drives directly over a REDUCED set, with no preceding Stage-2 call to
 *      have checked it.
 *   2. `award`  — this module's own award surface: `decidingStat` and every present rung key must be
 *      one of the 21 vocabulary keys (rung 3 reads `h2h[opp][decidingStat]` through the KEY's class,
 *      so membership is what makes the read decidable at all), and the efficiency pair is
 *      BOTH-OR-NEITHER (L2 — half a ratio is a half-configured rung, not a skip).
 *   3. `tied`   — the tied set's OWN SHAPE ONLY: width >= 2 (L11), every id a decimal string, no
 *      duplicate, strictly ascending byte-lex. Nothing here reads `players`.
 *   4. `player` — BUILDING THE INDEX over `players`: an array, every row an object, no duplicate
 *      steamid64.
 *   5. `tied`   — MEMBERSHIP: every tied member has a row in the index just built.
 *   6. `player` — every TIED player's `achievementTs`.
 *
 * ⭐⭐ GROUPS 4 AND 5 ARE WHY THIS SAYS SIX AND NOT FOUR. The duplicate-`players` scan is part of
 * BUILDING the index, so it necessarily runs before the membership check that READS the index — and
 * it refuses as `player`. An input carrying BOTH a duplicate `players` row AND a tied member with no
 * row therefore refuses `player`, not `tied`. The published four-group text said the opposite and all
 * three implementations disagreed with it; Cuatro's call at the Groups-2/3 code review (2026-08-04)
 * was AMEND THE PUBLISHED SPEC, DO NOT MOVE THE CODE, and Story 6-5b did. Two vector refusal rows
 * hold this text to the code — the single-defect duplicate-`players` row, and the row malformed
 * across the `player`/`tied` boundary.
 *
 * ⚠ WHY `achievementTs` IS VALIDATED UP FRONT RATHER THAN AT RUNG 4. It is NEVER NULL in the
 * snapshot (0024:706), so a value below the sentinel is a CORRUPT SNAPSHOT rather than a
 * rung-specific concern — and a ladder that only noticed corruption when it happened to descend that
 * far would report the same snapshot as fine or broken depending on how the tie broke. The per-key
 * BLOCK lookups stay lazy, at the rung that reads them, mirroring Stage 2's own split between
 * eligibility inputs (checked for everyone) and deciding magnitudes (checked where read).
 *
 * ⛔ L12 — THE LADDER NEVER RE-FILTERS ELIGIBILITY AND NEVER RE-DERIVES THE DECIDING VALUE. Stage 2
 * already applied the FR-21 floors and `idleDq`; re-applying them here could EMPTY the tied set, and
 * re-deriving `best` could disagree with the caller about who is in the race. Note what is absent
 * below: no floor comparison, no `idleDq` read, no `volume`/`rate` lookup.
 */
function validateLadder(
  award: Award,
  tied: readonly string[],
  players: readonly SnapshotPlayer[],
): ReadonlyMap<string, SnapshotPlayer> {
  // 1 — the Stage-2 award surface, PROPAGATED rather than swallowed and re-labelled so a caller can
  // see where it came from. Transcribed here rather than importing `validateAward` because that
  // function is module-private to `stage2.ts` and widening its export surface for one caller is how
  // a resolver's guards start drifting from the resolver.
  validateStage2AwardSurface(award);

  // 2 — this module's own award surface.
  if (classOfStatKey(award.decidingStat) === undefined) {
    throw new LadderError(
      'award',
      `deciding_stat ${award.decidingStat} is not one of the 21 vocabulary keys — rung 3 reads ` +
        "h2h[opp][deciding_stat] through the KEY's class, so membership is what makes the read " +
        'decidable at all',
    );
  }
  for (const [name, raw] of [
    ['secondary_stat', award.secondaryStat],
    ['eff_num_key', award.effNumKey],
    ['eff_den_key', award.effDenKey],
  ] as const) {
    const key = rungKey(raw);
    if (key !== null && classOfStatKey(key) === undefined) {
      throw new LadderError(
        'award',
        `${name} ${key} is not one of the 21 vocabulary keys (0023:98-115)`,
      );
    }
  }
  if ((rungKey(award.effNumKey) === null) !== (rungKey(award.effDenKey) === null)) {
    // L2 — BOTH OR NEITHER. One without the other is a HALF-CONFIGURED rung, which is a refusal
    // rather than a skip: a skip means "this award declines rung 2", and half a ratio means somebody
    // edited the catalog and stopped.
    throw new LadderError(
      'award',
      'eff_num_key and eff_den_key are both-or-neither — one without the other is a ' +
        'half-configured rung, not a skip',
    );
  }

  // 3 — the tied set.
  if (!Array.isArray(tied) || tied.length < 2) {
    // L11 — Stage 2 only produces a tie at width >= 2, so anything narrower means the CALLER is
    // broken. A ladder that "resolved" a width-1 set would crown a player nobody tied with.
    throw new LadderError(
      'tied',
      `a tied set has width >= 2, got ${Array.isArray(tied) ? String(tied.length) : describe(tied)} — ` +
        'Stage 2 never produces a narrower one, so this is a broken caller',
    );
  }
  const seen = new Set<string>();
  for (let i = 0; i < tied.length; i++) {
    const sid = tied[i] as string;
    if (typeof sid !== 'string' || !STEAMID64_RE.test(sid)) {
      throw new LadderError(
        'tied',
        `tied[${String(i)}]: steamid64 must be a non-empty decimal string, got ${describe(sid)}`,
      );
    }
    if (seen.has(sid)) {
      throw new LadderError('tied', `duplicate steamid64 ${sid} in the tied set`);
    }
    seen.add(sid);
    // ⚠ STRICTLY ASCENDING BYTE-LEX, and it is REFUSED rather than sorted. The tied set arrives in
    // the order Stage 2 produced it (0024:732's `collate "C"`) and rung 5 must RETURN that order, so
    // sorting here would HIDE a caller that had reordered it and the shared set's published order
    // would silently depend on the caller.
    // ⛔ NEVER `localeCompare` — it is locale-dependent and would order differently per machine.
    // JavaScript's `<` on strings compares UTF-16 code units, identical to byte order for the ASCII
    // digits a SteamID64 is made of.
    if (i > 0 && sid <= (tied[i - 1] as string)) {
      throw new LadderError(
        'tied',
        `the tied set must be in strictly ascending byte-lex order, got ${String(tied[i - 1])} then ${sid}`,
      );
    }
  }

  if (!Array.isArray(players)) {
    throw new LadderError('player', 'players must be an array — a snapshot is a roster, never null');
  }
  const byId = new Map<string, SnapshotPlayer>();
  for (const p of players) {
    if (p === null || typeof p !== 'object') {
      throw new LadderError(
        'player',
        `every player must be a snapshot row, got ${describe(p)}`,
      );
    }
    if (byId.has(p.steamid64)) {
      throw new LadderError(
        'player',
        `duplicate steamid64 ${p.steamid64} — a snapshot holds one row per player`,
      );
    }
    byId.set(p.steamid64, p);
  }
  for (const sid of tied) {
    if (!byId.has(sid)) {
      throw new LadderError('tied', `tied member ${sid} has no matching snapshot row`);
    }
  }

  // 4 — every TIED player's achievementTs.
  for (const sid of tied) {
    const ts = (byId.get(sid) as SnapshotPlayer).achievementTs;
    if (typeof ts !== 'bigint') {
      // ⚠ A SCALAR, NOT A CONTAINER, so the "absent is the empty case" rule does NOT apply here. A
      // nil `*big.Int` read as 0 in the producer would be an epoch of 1970 and would win rung 4
      // outright — the same class of silent plausibility L9 exists to prevent.
      throw new LadderError(
        'player',
        `${sid}: achievementTs is absent or not an integer — 0024:706 makes it NEVER NULL, with ` +
          `${String(ABSENT_ACHIEVEMENT_TS)} as the published absent sentinel`,
      );
    }
    if (ts < ABSENT_ACHIEVEMENT_TS) {
      throw new LadderError(
        'player',
        `${sid}: achievementTs ${String(ts)} is below the published absent sentinel ${String(ABSENT_ACHIEVEMENT_TS)}`,
      );
    }
  }
  return byId;
}

/**
 * The Stage-2 award surface, re-checked at the ladder's own door and reported as `stage2`.
 *
 * ⚠ TRANSCRIBED, NOT IMPORTED, and the trade is stated rather than left implicit: `stage2.ts`'s
 * `validateAward` is module-private, and exporting it so one caller could re-run it would widen a
 * resolver's internals into a shared surface. The four clauses below are the same four, and the
 * vector's `an award direction outside {max, min}` refusal row is what keeps them the same four —
 * it is driven through the LADDER, so a drift here reddens against the anchor rather than against a
 * comment.
 */
function validateStage2AwardSurface(award: Award): void {
  const refuse = (message: string): never => {
    // ⛔ THE PROPAGATION CARRIES A `Stage2Error` AS ITS `cause`, AND THAT IS THE MINIMUM CHANGE THAT
    // MAKES THE GATE NON-VACUOUS (Story 6-5b, DECISION B(1), AC6). Go's `validateLadder` wraps the
    // real Stage-2 error (`Cause: err`) so `errors.Is(err, ErrStage2)` still answers "where did this
    // come from", and the Go suite asserts exactly that on every `stage2` refusal row. This side
    // attached NO cause at all, so a TypeScript implementation that SWALLOWED the propagation and
    // threw a fresh `LadderError('stage2', …)` passed every refusal row in the file — the assertion
    // had nothing to look at. ⚠ The cause is CONSTRUCTED here rather than caught, because these four
    // clauses are transcribed rather than imported (see the note above); constructing the same typed
    // error `stage2.ts` would have thrown is what keeps the two halves of the seam symmetric.
    const cause = new Stage2Error(message);
    throw new LadderError('stage2', message, { cause });
  };
  if (typeof award.decidingStat !== 'string' || award.decidingStat === '') {
    refuse('award.decidingStat must be a non-empty string');
  }
  if (award.class !== 'volume' && award.class !== 'rate') {
    refuse(
      `unknown award class ${JSON.stringify(award.class)} — 0023 constrains it to volume|rate`,
    );
  }
  if (award.direction !== 'max' && award.direction !== 'min') {
    refuse(
      `unknown award direction ${JSON.stringify(award.direction)} — 0023 constrains it to max|min`,
    );
  }
  if (
    !Number.isInteger(award.floorRounds) ||
    !Number.isInteger(award.floorKills) ||
    award.floorRounds < 0 ||
    award.floorKills < 0
  ) {
    // ⚠ THE APOSTROPHE IS U+2019, MATCHING `stage2.ts:750` BYTE FOR BYTE. It was an ASCII `'` until
    // the Story 6-5b code review measured the drift: this clause is TRANSCRIBED rather than
    // imported, `refuse` constructs "the same typed error `stage2.ts` would have thrown" as its
    // `cause`, and it was observably NOT the same error — one character apart. The transcription
    // note claimed the four clauses were verbatim identical; three were. The test below now
    // compares both halves against the REAL `stage2.ts` output for the same award rather than
    // against a transcribed literal, so the next drift reddens instead of being narrated.
    refuse('floors must be non-negative integers — 0023’s award_floors_non_negative');
  }
}
