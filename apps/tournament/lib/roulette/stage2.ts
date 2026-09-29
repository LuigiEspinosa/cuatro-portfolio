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
 * ⭐ WIDENED BY STORY 6.5 with the three FR-29 rung keys (0023:71-73). They were deliberately
 * omitted at 6-4a because the ladder had made no decisions yet; rungs 1 and 2 cannot read a key
 * they were never handed, so the projection grows.
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

  /**
   * The FR-29 rung keys, all three NULLABLE (0023:97-115 declares them `text` with closed-set
   * CHECKs that admit NULL).
   *
   * ⭐ THREE SPELLINGS OF ABSENT, ALL EQUIVALENT, AND THAT IS THE CONTRACT: `undefined` (the key
   * omitted), `null` (the column's NULL, which is what the vector writes) and `''`. The first two
   * are the obvious pair; the third is forced by the producer — Go has no nullable string, so
   * `Award.SecondaryStat` is a plain `string` whose zero value `""` is what `encoding/json` leaves
   * behind for BOTH a JSON `null` and an omitted key. Go therefore cannot distinguish "absent"
   * from "present and empty", and if this side treated `''` as a present-but-invalid key the seam
   * would disagree on an input neither runtime would report — exactly the class of divergence the
   * 6-4b review resolved by making an absent container the empty one. {@link rungKey} is the one
   * place that normalisation happens.
   *
   * ⚠ `stage2-resolve.json`'s award objects carry NONE of the three and must keep not carrying
   * them: that file has to regenerate with `outcome_kinds` as its only changed bytes.
   *
   * ⚠ ALL THREE ARE NOW FILLED FOR ALL TWELVE SHIPPED AWARDS — 6.5's catalog pass (Question 2,
   * measured) set `secondaryStat` and the `kills`/`deaths` efficiency pair on every one, so the
   * deterministic SKIP these fields describe (`ladder.ts`'s L2) is exercised by the VECTOR and by a
   * reduced 6.6 award, never by a shipped ceremony. The fields stay nullable because 0023's columns
   * are. (Comment corrected at the Group-1 code review, 2026-08-04 — it still said "absent until 6.5
   * fills them" in the commit that filled them.)
   */
  readonly secondaryStat?: string | null;
  readonly effNumKey?: string | null;
  readonly effDenKey?: string | null;
}

/**
 * The ONE normalisation of a nullable rung key: `undefined`, `null` and `''` all mean ABSENT, and
 * everything else is the key itself.
 *
 * Exported because `ladder.ts` and both suites must agree with it exactly — a second copy of this
 * three-way test is a second place for the producer and the verifier to drift apart. See the note
 * on {@link Award.secondaryStat} for why `''` is in the list.
 */
export function rungKey(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value === '') return null;
  return value;
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

  // ── The four AD-19 blocks Story 6.5 is the FIRST consumer of (0024:716-737). ─────────────────
  //
  // Nothing had ever read them: 6-4a took `volume` / `rate` / `roundsPlayed` / `kills` / `idleDq`
  // and stopped, because the FR-29 rungs that need these had made no decisions yet.

  /**
   * Rung 1's block: `volume || rate` (0024:723), so every one of the 21 vocabulary keys in its
   * CLASS-SHAPED form — an integer for a volume key, a `{num,den}` pair for a rate key.
   *
   * ⭐ IT IS THE SAME TYPE `h2h`'s inner record uses, deliberately, because 0024 builds both from
   * the same `p.vol || p.rat` expression (`:650`, `:723`). Two near-identical types is how the two
   * runtimes drift.
   *
   * ⚠ OPTIONAL BECAUSE ABSENT IS THE EMPTY BLOCK. Go's `map[string]StatValue` cannot tell a nil
   * map from an empty one, so `undefined` normalises to `{}` inside `ladder.ts` — never by
   * loosening this module, which the scope boundary forbids.
   */
  readonly secondary?: Readonly<Record<string, StatValue>>;

  /**
   * Rung 2's block: every key in the UNIFORM `{num,den}` form, so a volume key `k` with value `v`
   * arrives as `{v, 1n}` (`snapshot_efficiency_form`, 0024:338-370 — the ONE definition site; do
   * not restate the shape at a call site). That uniformity is what lets a rung-2 ratio over two
   * arbitrary vocabulary keys resolve by pure integer cross-multiplication with no class branching
   * and no division.
   */
  readonly efficiency?: Readonly<Record<string, RatePair>>;

  /**
   * Rung 3's block: `{opponentSteamid64: {the same class-shaped union}}` over the matches the two
   * players SHARED.
   *
   * ⛔ AN ABSENT OPPONENT KEY IS THE `NEVER MET` SIGNAL AND IS NEVER A ZERO (0024:918-923,
   * verbatim: "a zero would silently become a real comparison"). It is `{}` for a player with no
   * shared approved matches, and a player is never a key in their own map.
   */
  readonly h2h?: Readonly<Record<string, Readonly<Record<string, StatValue>>>>;

  /**
   * Rung 4's value: an epoch-MILLISECOND integer with the PUBLISHED ABSENT SENTINEL `-1n`
   * (0024:703-709, 898-907). It is NEVER NULL in the snapshot.
   *
   * ⭐ `-1` IS NUMERICALLY THE SMALLEST VALUE IN THE COLUMN, which is the whole reason `ladder.ts`'s
   * L9 exists: a naive `min` over this field crowns the player with NO APPROVED ROWS AT ALL, for a
   * rung whose entire meaning is "did it first".
   *
   * ⚠ It is a DOCUMENTED PROXY — `min(stat_row.approved_at)`, i.e. admin approval order, not a demo
   * tick (deferred-work.md:282).
   */
  readonly achievementTs?: bigint;
}

/**
 * AD-19's CLASS-SHAPED integer union: an integer for a volume key, a `{num,den}` pair for a rate
 * key.
 *
 * ⭐ IT IS {@link DecidingValue}, REUSED RATHER THAN RESTATED. The two are the same shape because
 * they are the same thing — one integer value read out of the frozen snapshot, branched on the
 * key's class — and Story 6.5's rungs 1 and 3 must compare them with the EXACT arithmetic Stage 2
 * uses ({@link compareStatValues}: cross-multiplication, never `num === num && den === den`, and
 * 6-4a's verbatim zero-denominator total order). A second near-identical type would be a second
 * comparator waiting to be written, which is precisely how the producer and the verifier drift.
 *
 * ⚠ THE `DISPLAY ONLY` WARNING ON `DecidingValue` IS ABOUT THE OUTCOME FIELD, not about the shape.
 * `Outcome.decidingValue` is display-only and nothing re-derives a winner from it; the TYPE is just
 * "a class-shaped integer", and `secondary` / `h2h` are genuine resolution inputs.
 */
export type StatValue = DecidingValue;

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
  | {
      readonly kind: 'winner';
      readonly steamid64: string;
      /**
       * ⭐ OPTIONAL SINCE STORY 6.5, AND THE INVARIANT IS `decidingValue` XOR `ladderExitStep`.
       * {@link resolveStage2} always sets it and never sets the exit step; a LADDER-resolved winner
       * always sets the exit step and never sets this — because the tie a ladder resolves carries
       * no value (Stage 2's `tie` arm has none) and L12 forbids the ladder from re-deriving one.
       *
       * ⛔ FABRICATING A ZERO HERE WOULD BE WORSE THAN ABSENCE: a plausible-looking `0` is exactly
       * the silent wrongness this package refuses everywhere else, and `award_result.deciding_value`
       * is display-only, so a rendered zero would simply be a lie on stage. Go's mirror leaves the
       * struct field at its zero value, which is the same statement in that language. Both suites
       * assert the XOR over every case in both vector files.
       */
      readonly decidingValue?: DecidingValue;
      /**
       * Which FR-29 rung decided this award — 1..4 — or absent when no ladder was involved.
       *
       * ⭐ AS LOAD-BEARING AS THE WINNER, and 6.8 is why: it persists this as
       * `award_result.tie_ladder_exit_step` (SOLUTION-DESIGN:222, nullable), so a ladder that
       * reaches the RIGHT player by the WRONG rung ships a false explanation to the audience.
       * Every ladder vector case pins it.
       *
       * ⚠ NEVER SET BY {@link resolveStage2}. The pure stage resolves no tie, so this field is
       * absent on every outcome it produces — pinned over every case in `stage2-resolve.json`.
       */
      readonly ladderExitStep?: 1 | 2 | 3 | 4;
    }
  | { readonly kind: 'tie'; readonly tied: readonly string[]; readonly reason: TieReason }
  | { readonly kind: 'no_eligible_players' }
  /**
   * ⭐ STORY 6.5's FIFTH ARM: the FR-29 ladder bottomed out at rung 5 and the award is genuinely
   * SHARED by every survivor.
   *
   * A DESIGNED OUTCOME, NEVER AN ERROR STATE — EXPERIENCE.md:123 says so in those words, and
   * FR-29, AD-14, epics.md:1084 and SOLUTION-DESIGN §9.3 all end the ladder here. It is the
   * deterministic TERMINAL rung (DECISION H, Cuatro 2026-08-04): there is no seeded rung below it,
   * which is what keeps the ladder a zero-byte function and 6-4b's measured 22-byte ceremony valid.
   *
   * `winners` is the FULL surviving set in byte-lex order, never a first and never a lowest
   * SteamID64. It is a SEPARATE field from a tie's `tied` on purpose — `tied` is the tie that
   * FORMED, `winners` is who actually WON, and on a narrowed ladder those differ (a width-3 tie can
   * share between two).
   */
  | { readonly kind: 'shared'; readonly winners: readonly string[]; readonly ladderExitStep: 5 }
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
  // ⭐ APPENDED BY STORY 6.5, DELIBERATELY. This list is asserted by EXACT EQUALITY against the
  // vector's `outcome_kinds` and against Go's const block, so adding the ladder's fifth arm
  // reddens all three at once — which is exactly what those pins exist for. It is appended rather
  // than inserted so `stage2-resolve.json` regenerates with these bytes as its ONLY change.
  'shared',
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
 *
 * ⭐ WIDENED BY STORY 6.5 TO CARRY THE PLAYERS, and the reason is structural rather than
 * convenient: rungs 1-4 read `secondary`, `efficiency`, `h2h` and `achievementTs`, none of which is
 * on an `Award` or on a tie's `readonly string[]`. The 6-4a signature could not see the data the
 * ladder exists to read, so the port grows rather than the ladder guessing.
 *
 * ⛔ IT IS SYNCHRONOUS AND TAKES NO `Stream`, AND THE SIGNATURE IS THE PROOF (`ladder.ts`'s L1).
 * The FR-29 ladder consumes ZERO PRNG bytes: rung 5 is deterministic, so nothing below it needs
 * randomness. A runtime assertion that "the ladder drew nothing" is VACUOUS against a function that
 * cannot reach a stream — the 6-4b code review deleted exactly that assertion — so the property is
 * carried here, by the type, where no implementation can opt out of it. (`stage1Pick` is `async`
 * because it draws; this is not.)
 */
export interface Ladder {
  resolve(award: Award, tie: TieOutcome, players: readonly SnapshotPlayer[]): Outcome;
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
 *
 * ⭐ IT SURVIVES STORY 6.5 AND IT STAYS REFUSING (DECISION J). Now that `resolveLadder` exists, the
 * temptation is to delete this — but it is what EVERY tie row in `stage2-resolve.json` is driven
 * through, and 6-4a's mutation M13 (the ladder's refusal swallowed by `resolveAward`) only became
 * vector-killable that way. Deleting it would silently weaken the Stage-2 gate while this story was
 * busy elsewhere, and would make that file impossible to regenerate byte-identically.
 */
export const refusingLadder: Ladder = Object.freeze({
  // `players` is accepted and deliberately unused: this ladder refuses before it could read
  // anything, and the parameter exists so the object satisfies the widened port.
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
  // ⭐ THE PLAYERS TRAVEL WITH THE TIE (Story 6.5). The ladder receives the SAME array Stage 2
  // resolved over — not a re-read and not a re-filter — because L12 forbids the ladder from
  // re-applying the FR-21 floors or re-deriving the deciding value: doing either could empty the
  // set or disagree with the caller about who is even in the race.
  return ladder.resolve(award, outcome, players);
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
  return beatsBy(award.direction, a, b);
}

/**
 * `beats`, taking the direction alone.
 *
 * ⭐ EXPORTED FOR `ladder.ts` (Story 6.5), and sharing it is the point rather than a convenience.
 * FR-29's rungs 1, 2 and 3 are all "who is best under `direction`" over a class-shaped value, which
 * is the SAME question Stage 2 asks — including 6-4a's verbatim zero-denominator semantics (S3):
 * cross-multiplication stays total, `0/0` compares equal to everything, and `n/0` with `n > 0`
 * beats every finite value. A ladder with its own comparator would be a second place for those to
 * be got wrong, and the two would disagree only on inputs no row happens to carry.
 *
 * ⚠ It takes an {@link AwardDirection}, NOT an {@link Award}, because rung 4 must NOT be inverted
 * (`ladder.ts`'s L4) and rung 2 compares a COMPUTED ratio that belongs to no award's class. Passing
 * the whole award would invite both mistakes.
 */
export function beatsBy(direction: AwardDirection, a: DecidingValue, b: DecidingValue): boolean {
  const c = compareStatValues(a, b);
  return direction === 'max' ? c > 0 : c < 0;
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
export function compareStatValues(a: DecidingValue, b: DecidingValue): number {
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
