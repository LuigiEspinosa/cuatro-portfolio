/**
 * Anti-sweep — at most one trophy per player per spin (Story 6.6, FR-26 / AD-14 /
 * SOLUTION-DESIGN §9.4 / review-data-integrity.md M1).
 *
 * ```
 * resolveSpin(live, players, ladder):
 *     validate(live)                                   # A2, A13 — the WHOLE set, FIRST
 *     ordered  = sort(live, by ascending award.priority)       # A2 — over a COPY
 *     assigned = {}
 *     for a in ordered:
 *         reduced   = [ p for p in players if p.steamid64 not in assigned ]   # A3 / DECISION E'
 *         sweptOut  = [ p.steamid64 for p in players if p.steamid64 in assigned ]
 *         out = resolveStage2(a.award, reduced)        # A4 / DECISION D — a FULL re-run
 *         if out.kind === 'tie':
 *             out = ladder.resolve(a.award, out, reduced)      # A8 — width >= 2 by construction
 *         winners = out.winners | [out.steamid64] | []         # A5, A6
 *         assigned |= winners
 * ```
 *
 * ⛔ NO STREAM, NO CLOCK, NO RANDOMNESS, NO I/O (A1), AND THE SIGNATURE IS THE PROOF — this module
 * is **SYNCHRONOUS**, unlike {@link stage1Pick}, and it imports no `./prng`. Re-resolution is Stage
 * 2 plus the FR-29 ladder, and both are pure. ⛔ Do NOT add a stream "for the overflow": a runtime
 * assertion that a function which cannot reach a stream drew nothing is VACUOUS (the 6-4b code
 * review deleted exactly that assertion), and a byte drawn here would move every stream position
 * after it and invalidate 6-4b's measured 22-byte twelve-spin ceremony. `prng.test.ts`'s per-module
 * import-graph pin carries the property where no implementation can opt out of it: the ABSENCE of
 * `'./prng'` from this module's specifier list is the load-bearing half.
 *
 * ⛔ NOT `server-only`, and NOT an importer of `lib/awards/**`. This module ships to the BROWSER at
 * 6.9 — "Verificar la ceremonia" re-runs it against the published bundle — so `server-only` would
 * throw in a client bundle and `lib/awards/catalog.ts` (which IS `server-only`) would poison it.
 * The award projection arrives as plain data.
 *
 * THE SEAM (ARCHITECTURE-SPINE.md:73-76). This file conforms to
 * `roulette/vectors/antisweep-resolve.json`, never to `worker/awards/sweep.go`. Two independent
 * implementations of one spec; neither is the reference and neither may be corrected by reading the
 * other. When they disagree the vector decides; when the vector is silent, add a vector.
 *
 * ⛔ NOT IN THIS FILE, each with an owner: the luck-meter's VALUES and the shelf (6.6's Task 5, but
 * `stage1.ts` — this pass never touches a shelf, see A10), the pity draw (6.7), every write and the
 * reveal axis (6.8), canonicalization and the bundle (6.9), any UI at all (6.10).
 */

import type { Stage1Candidate } from './stage1';
import { resolveStage2, type Ladder, type Outcome, type SnapshotPlayer } from './stage2';

/**
 * A programmer/data error this module refuses to resolve past.
 *
 * ⭐ ITS OWN CLASS, not a bare `Error` and not a reuse of `Stage1Error` / `LadderError`. The 6.3
 * review measured a mutation surviving the entire suite because a built-in threw the same type the
 * test asserted, and 6-4a measured that an untyped refusal surface let a mutation which rejected
 * EVERY input pass all sixteen refusal rows. A named class keeps every assertion specific to THIS
 * module's refusal.
 */
export class SweepError extends Error {
  /** WHICH input was rejected — one of {@link SWEEP_REFUSAL_DETAILS}. */
  readonly detail: string;

  constructor(detail: string, message: string, options?: { cause?: unknown }) {
    super(`roulette: anti-sweep refused (${detail}): ${message}`, options);
    this.name = 'SweepError';
    this.detail = detail;
  }
}

/**
 * The closed set of things an anti-sweep refusal can be ABOUT (A12). Three distinct FACTS get three
 * distinct labels, because they mean genuinely different things to a caller — plus the one that no
 * input can reach.
 *
 * `Object.freeze` is SHALLOW — 6.1 shipped a "frozen" catalog of mutable entries on exactly that
 * mistake. One call suffices here only because every element is a primitive.
 *
 * ⭐ AND IT IS GENUINELY CLOSED. Story 6-4b shipped a "closed set" that was 9 / 7 / 7 across three
 * implementations with one input carrying two different labels across runtimes; 6.5 shipped one
 * whose fifth value no suite inspected. The vocabulary is declared once in the vector's
 * `refusal_details`, all three implementations read it, and both suites pin this constant against it
 * by exact equality, so a fifth cannot be added on one side alone.
 */
export const SWEEP_REFUSAL_DETAILS: readonly string[] = Object.freeze([
  'live', // the live set's own shape is wrong — a caller or spin-plan bug
  'stage2', // the award surface or the snapshot is malformed; propagated, never swallowed
  'ladder', // the FR-29 ladder ran and refused, or none was injected at all
  'internal', // an invariant this module believes unreachable
]);

/**
 * ⚠ `internal` IS DECLARED AND IS NOT ROW-REPRESENTABLE, exactly as `stage1.ts`'s `stream` /
 * `internal` pair and `ladder.ts`'s `internal` are. A vector row is a set of INPUTS, and every
 * producer of `internal` here is a state no input can reach: {@link Ladder} is an INJECTED port, so
 * it can hand this module an outcome no code in this package built — a kind that resolves nothing,
 * an empty winner array, an empty `steamid64` — none of which the shipped `fr29Ladder` can produce,
 * because `validateLadder` refuses an empty tied member and `bestSurvivors` refuses an empty best
 * set. The guards exist because 6.9's verifier reimplements the port and any third-party
 * implementation reaches exactly these arms; this suite drives them with a STUB port, which is the
 * machinery Story 6-5b built for `stage1`'s twin pair. The generator refuses to write a row
 * carrying this label.
 */

/**
 * `^[0-9]+$` — the same shape `stage2.ts:657`, `ladder.ts:726` and (since Story 6.9a) `pity.ts`
 * guard. Carried here to close `deferred-work.md:335`.
 *
 * ⭐ WHY IT EXISTS IN A MODULE THAT DRAWS NO BYTES. Anti-sweep publishes two ORDERED id arrays —
 * `sweptOut` and `assigned` — both produced by a bare `.sort()`. That comparator orders by UTF-16
 * code unit, which is NOT the byte-lex order Go and Python produce, and the divergence is
 * structurally invisible to this epic's byte-accounting gate: the ids reorder while `draws` and
 * `bytesConsumed` come out identical. Restricting the input to decimal digits makes the three
 * orderings coincide, so the claim at the `.sort()` becomes true by construction instead of by
 * assertion.
 *
 * ⚠ DELIBERATELY `+` AND NOT `{17}`, matching its three siblings rather than `0001:39`'s database
 * CHECK: the engine's contract is "decimal digits", and a length rule would refuse the short
 * synthetic ids every vector in this directory uses.
 */
const STEAMID64_RE = /^[0-9]+$/;

/** What one live award concluded, plus what anti-sweep did to its candidate set. */
export interface AwardAssignment {
  readonly awardId: string;
  readonly priority: number;
  /**
   * Stage 2's answer over the REDUCED set, with a tie already resolved by the ladder.
   *
   * ⚠ It can never be `'tie'`: every tie goes through the ladder, which returns `'winner'` or
   * `'shared'`. The vector declares that as `unreachable_outcome_kinds` and both suites assert zero
   * rows carry it — an implementation that skipped the ladder would leak one.
   */
  readonly outcome: Outcome;
  /**
   * Every rostered player removed from THIS award's candidate set because they were already
   * assigned this spin, in byte-lex order.
   *
   * ⭐ IT IS A FACT ABOUT THE INPUT, NOT ABOUT THE OUTCOME, and the clean-spin vector row is what
   * makes the difference visible: on a spin where nobody wins twice, awards 2 and 3 still resolve
   * over reduced sets and still crown exactly the players the full sets would have crowned. A
   * vector that pinned only the winner would let a pass that reached the right player WITHOUT EVER
   * REMOVING ANYONE pass every row, and the removal is the whole story.
   *
   * ⭐⭐ IT ALSO CARRIES DECISION F. When removal empties a later award's candidate set,
   * `resolveStage2` returns `'no_eligible_players'` — the SAME kind it returns when nobody cleared
   * the FR-21 floors, and those are completely different facts for Story 6.7's pity draw and Story
   * 6.8's reveal copy. A non-empty `sweptOut` on such a row is EXHAUSTION; an empty one is "nobody
   * qualified". The distinction is carried here rather than as a sixth outcome kind because
   * {@link OUTCOME_KINDS} is pinned by exact equality in both suites and in two other vector files.
   */
  readonly sweptOut: readonly string[];
  /**
   * This award's Stage 2 ran over a REDUCED candidate set.
   *
   * ⚠ NOT "the winner changed", and the two readings diverge on every clean spin. Deriving "the
   * winner changed" would mean resolving each award twice, which is a counterfactual the ceremony
   * has no reason to compute and no way to publish.
   */
  readonly reresolved: boolean;
}

/** The whole spin's answer. */
export interface SpinResult {
  /**
   * In ASCENDING PRIORITY order — the order the awards were PROCESSED, which is NOT the reveal
   * order. {@link Stage1Result.live} holds the reveal (draw) order and is untouched by this pass.
   */
  readonly results: readonly AwardAssignment[];
  /**
   * Every player who won anything this spin, in byte-lex order — the same order Stage 2 iterates
   * and the ladder's rung 5 returns. Its length against the number of trophies handed out is the
   * invariant `unique (spin_id, winner_entry_id)` backstops at the database (migration 0025): this
   * pass makes a duplicate impossible by construction, and the constraint exists because
   * `review-data-integrity.md:169-174` measured that nothing in the schema caught a producer bug or
   * a re-run that did not clean prior rows.
   */
  readonly assigned: readonly string[];
}

/**
 * FR-26's anti-sweep pass over one spin's live award set.
 *
 * ⭐ A3 / DECISION E' — REMOVAL IS APPLIED TO THE CANDIDATE SET, BEFORE STAGE 2 RUNS, never to an
 * `Outcome` afterwards. That is what makes `review-data-integrity.md:175-179` structurally
 * impossible rather than defensively handled: "if a tie bottoms out to a shared trophy (FR-29.5)
 * including player P, and P already won a higher-priority award this spin, the anti-sweep rule must
 * remove P from the *shared* set too." If P was never a candidate, no shared set can contain P.
 * Trimming the winners afterwards would additionally leave `ladderExitStep: 5` on what is now a sole
 * winner — a lie Story 6.8 renders on stage.
 *
 * ⭐ A4 / DECISION D — RE-RESOLUTION IS A FULL STAGE-2 RE-RUN, NEVER A "POP THE WINNER". Three
 * reasons, each independently sufficient: (i) the ladder's rung 3 is a strict dominator over the
 * REMAINING set, and the remaining set changed; (ii) `best` is a SET, so removing one member changes
 * which players are tied and therefore which rung resolves them; (iii) DECISION E's zero carve-out is
 * evaluated against the reduced set's best value, which may NEWLY be 0. All three have vector rows.
 *
 * ⭐ A9 — THE FR-21 FLOORS ARE NEVER RE-APPLIED. `resolveStage2` applies them itself; this pass
 * reduces the PLAYER LIST and lets Stage 2 filter it. Note what is absent below: no floor
 * comparison, no `idleDq` read, no deciding-magnitude lookup.
 *
 * ⭐ A10 — THE SHELF IS NEITHER READ NOR WRITTEN, and there is no parameter to read it with. The
 * shelf is FROZEN at spin start (W1) and Stage 1's provisional winners are computed BEFORE any
 * removal, so a category's luck weight can be justified by a player who then does not win it. That
 * is intended (DECISION G) — it is what keeps Stage 1 a pure function of the frozen shelf and
 * therefore reproducible from the published bundle alone — and it is stated in NO architecture
 * document, which is why it is stated here.
 *
 * `ladder` is REQUIRED, unlike Stage 1's optional one: Stage 1 made its ladder optional to preserve
 * 6-4b's shipped no-ladder contract, and this pass has no such contract.
 */
export function resolveSpin(
  live: readonly Stage1Candidate[],
  players: readonly SnapshotPlayer[] | undefined,
  ladder: Ladder,
): SpinResult {
  // ⛔ THE LADDER PRESENCE TEST IS STRUCTURAL, NOT `!== undefined` — it mirrors `stage2.ts`'s
  // `resolveAward` and Go's `ladderIsNil`, which `stage2.go:409` names as the sanctioned pair. A
  // bare `!== undefined` treats `ladder: null` — reachable from any JSON- or config-driven caller —
  // as PRESENT and calls `null.resolve`, while Go's typed-nil guard calls the same input ABSENT.
  // One input, two behaviours across the seam, and invisible to the vector because "no ladder" is
  // not a JSON input at all. This arm is driven by this module's own suite instead.
  if (
    ladder === undefined ||
    ladder === null ||
    typeof ladder !== 'object' ||
    typeof ladder.resolve !== 'function'
  ) {
    throw new SweepError(
      'ladder',
      'a Ladder must be injected — anti-sweep re-resolves overflows through the FR-29 ladder and ' +
        'will not pick a tie’s winner itself',
    );
  }

  // ⚠ AN ABSENT CONTAINER IS THE EMPTY CONTAINER (Cuatro, 2026-08-04, resolving the 6-4b code
  // review): Go cannot idiomatically tell a nil slice from an empty one, so an omitted roster is
  // the EMPTY roster there and must be here — every award then resolves to `'no_eligible_players'`
  // rather than refusing.
  //
  // ⚠ `null` AND STRUCTURALLY-WRONG TYPES STAY REFUSED, AND THAT GUARD IS DELIBERATELY THIS SIDE'S
  // ALONE. Go's parameter is typed, so the input cannot exist there and no shared row can express
  // it — the same non-vectorable split `stage1.ts`'s `Object.hasOwn` note records, and the same one
  // `deferred-work.md:326` flags for the ladder's own `players` guard. The label is `stage2`
  // because the roster is Stage 2's input, not this pass's.
  // ⛔ A13 — THE LIVE SET'S OWN SHAPE IS VALIDATED FIRST, IN FULL, OVER THE WHOLE SET, before any
  // award is resolved AND BEFORE ANY PLAYER IS READ. The order is CONTRACT, it is published in the
  // vector's `spec` string, and three refusal rows are malformed in TWO WAYS AT ONCE — two pinning
  // `live`→`stage2` and one pinning `stage2`→`ladder` — so a regression in either half is
  // observable. 6-4b's headline defect was three implementations disagreeing about validation order
  // with NO row able to see it; 6.5 shipped the same class again.
  //
  // ⚠ THE ROSTER GUARD BELOW USED TO SIT ABOVE THIS CALL, AND THAT WAS A REAL ORDER VIOLATION: it
  // made `resolveSpin([], null, ladder)` refuse `stage2` on this side while the anchor refused
  // `live`, so TypeScript disagreed with the published order on exactly the input class A13 exists
  // to pin. The code review measured it. The live group runs first, in full, full stop.
  const supplied = live === undefined ? [] : live;
  validateLive(supplied);

  // ⚠ AN ABSENT CONTAINER IS THE EMPTY CONTAINER (Cuatro, 2026-08-04, resolving the 6-4b code
  // review): Go cannot idiomatically tell a nil slice from an empty one, so an omitted roster is
  // the EMPTY roster there and must be here — every award then resolves to `'no_eligible_players'`
  // rather than refusing.
  //
  // ⚠ `null` IS REFUSED HERE AND RESOLVES IN THE OTHER TWO RUNTIMES, AND THAT IS A KNOWN,
  // DELIBERATE SPLIT — not, as this comment previously claimed, an input "no shared row can
  // express". `"players": null` IS expressible in JSON: Go decodes it to a nil slice and Python
  // maps `None → []`, so both RESOLVE where this refuses. The claim was wrong and the code review
  // corrected it. The guard stays because a `null` roster in a browser is a caller bug worth
  // reporting rather than silently treating as an empty ceremony, and it stays UNVECTORED because
  // adding the row would force the other two runtimes to refuse an input their type systems accept
  // — which is a change to 6-4a's Stage-2 contract this story has no mandate for. The label is
  // `stage2` because the roster is Stage 2's input, not this pass's.
  const roster: readonly SnapshotPlayer[] = players === undefined ? [] : players;
  if (!Array.isArray(roster)) {
    throw new SweepError('stage2', 'players must be an array of snapshot rows');
  }

  // A2 — ASCENDING `priority`, over a COPY. ⚠ {@link Stage1Result.live} is in DRAW order, which is
  // the REVEAL order and is deliberately unsorted — `stage1.ts:166-173` says so and names this story
  // by number. Never sort the caller's array: a pass that reordered its input would make two
  // consecutive resolutions of the same spin observably different operations.
  const ordered = [...supplied].sort((a, b) => a.priority - b.priority);

  const assigned = new Set<string>();
  const results: AwardAssignment[] = [];

  for (const candidate of ordered) {
    // ── REMOVAL, HERE, ON THE CANDIDATE SET, BEFORE RESOLUTION (A3 / DECISION E') ──────────────
    const reduced: SnapshotPlayer[] = [];
    const sweptOut: string[] = [];
    const reducedIds = new Set<string>();
    for (const p of roster) {
      // ⭐⭐ STORY 6.9a CLOSED `deferred-work.md:335` HERE — the twin of the fix landing in
      // `pity.ts` in the same edit, and it had to be the same edit: 6.7 deliberately deferred
      // rather than fix one, because two sibling modules in this directory guaranteeing DIFFERENT
      // things about one field is worse than both guaranteeing nothing.
      if (typeof p.steamid64 !== 'string' || !STEAMID64_RE.test(p.steamid64)) {
        throw new SweepError(
          'internal',
          `the roster carries a steamid64 that is not decimal digits — it would sort differently ` +
            `in the three runtimes while every byte count agreed`,
        );
      }
      if (assigned.has(p.steamid64)) {
        sweptOut.push(p.steamid64);
        continue;
      }
      reduced.push(p);
      reducedIds.add(p.steamid64);
    }
    // Byte-lex, the same order Stage 2 iterates and rung 5 returns. Never `localeCompare`, which is
    // locale-dependent and banned.
    //
    // ⚠⚠ THE COMMENT THIS REPLACES WAS FALSE, AND IT SAID SO "BY DEFINITION". A bare `.sort()` is
    // NOT byte-lex: JavaScript's default comparator orders by UTF-16 CODE UNIT, while Go's
    // `sort.Strings` orders by UTF-8 byte and Python's `sorted` by code point (those two agree,
    // by design of UTF-8). All three DIVERGE on supplementary-plane characters, where a surrogate
    // pair sorts BELOW U+E000-FFFF in UTF-16 and ABOVE it in UTF-8. `pity.ts` recorded the same
    // correction at its own `.sort()` after the 6.7 review and deferred the fix to 6.9.
    // ⭐ IT IS TRUE NOW, BY CONSTRUCTION, because of the guard added directly above: on `[0-9]+`
    // the three orderings COINCIDE exactly, so the input can no longer be anything they disagree
    // about. The comparator was not changed and must not be.
    // ⛔ AND DO NOT UNIFY IT WITH `canonical.ts`'s SORT, which RFC-8785 §3.2.3 requires to be
    // UTF-16 code units — the OPPOSITE rule, also correct, in the same package. Breaking either
    // one is invisible: a divergent id order changes `revealOrder` while `draws` and
    // `bytesConsumed` stay identical, and a divergent key order changes `bundle_sha256` alone.
    sweptOut.sort();

    let outcome: Outcome;
    try {
      outcome = resolveStage2(candidate.award, reduced);
    } catch (err) {
      // A12 — PROPAGATED under its own label, never swallowed into an outcome. `cause` keeps the
      // origin reachable so a caller can tell a malformed award from a ladder that refused.
      throw new SweepError(
        'stage2',
        `resolving award "${candidate.awardId}": ` +
          (err instanceof Error ? err.message : String(err)),
        { cause: err },
      );
    }

    if (outcome.kind === 'tie') {
      // ⭐ A8 — A REDUCED TIE OF WIDTH 1 IS NEVER CONSTRUCTED, AND THAT IS WHY THE RE-RUN ABOVE IS A
      // RE-RUN. `resolveStage2` cannot emit a width-1 tie (a lone best is a `'winner'`) and
      // `validateLadder` REFUSES `tied.length < 2` (L11), so the only way to hand the ladder a
      // width-1 set is to BUILD one — by popping the removed player out of the ORIGINAL tie and
      // passing the remainder. This code cannot: the tie it hands over is one Stage 2 just produced
      // over the reduced players. The width-1 vector row proves it by outcome KIND rather than by
      // winner — the shortcut refuses where this resolves.
      let resolved: Outcome;
      try {
        // ⚠ `reduced`, NOT `roster` — AND PASSING `roster` HERE IS A PROVABLY EQUIVALENT MUTANT,
        // recorded rather than left for the next reader to rediscover (Story 6.6's mutation pass
        // measured it as one of its two survivors). The ladder reads `byId.get(sid)` only for `sid`
        // in its SURVIVORS, survivors ⊆ tied, and `tied` came out of `resolveStage2(award, reduced)`
        // above — so tied ⊆ reduced ⊆ roster and the two calls index the same entries.
        //
        // ⛔ IT STILL PASSES `reduced`, AND THAT IS NOT A STYLE CHOICE. L12 forbids the ladder from
        // re-filtering eligibility, so the set it is handed must already BE the set the tie was
        // formed over; a wider roster would make the two disagree the moment anything started
        // reading `players` for something other than the tied ids.
        resolved = ladder.resolve(candidate.award, outcome, reduced);
      } catch (err) {
        throw new SweepError(
          'ladder',
          `the FR-29 ladder refused the tie on award "${candidate.awardId}": ` +
            (err instanceof Error ? err.message : String(err)),
          { cause: err },
        );
      }
      // ⛔ THE PORT'S OWN OUTPUT IS GUARDED, because {@link Ladder} is INJECTED and this arm can
      // therefore carry an outcome no code in this module built. A ladder that returned its tie
      // unchanged — or a `'no_eligible_players'` — would otherwise fall through the winners switch
      // below and assign NOBODY, silently turning a resolved tie into a category with no trophy.
      if (resolved.kind !== 'winner' && resolved.kind !== 'shared') {
        throw new SweepError(
          'internal',
          `the FR-29 ladder resolved award "${candidate.awardId}" to kind ` +
            `${JSON.stringify(resolved.kind)} — a ladder returns a winner or a shared co-win, ` +
            'never anything else',
        );
      }
      outcome = resolved;
    }

    // ⛔⛔ THE CAP'S OWN INVARIANT, CHECKED AGAINST THE SET THE AWARD ACTUALLY COMPETED OVER.
    // Everything above makes an anti-sweep violation impossible for outcomes THIS module built:
    // removal is applied to the candidate set before Stage 2 runs (A3 / DECISION E'), so
    // `resolveStage2` cannot return a player who is not in `reduced`. ⚠ BUT {@link Ladder} IS AN
    // INJECTED PORT — 6.9's browser verifier reimplements it, and the `'internal'` arms exist
    // precisely because this path can carry an outcome no code in this module built. Those guards
    // check only that a winner id is non-EMPTY; a port returning a well-formed id that is already
    // assigned, or that is on no roster row at all, would sail through and hand one player two
    // trophies in one spin — the single invariant FR-26 exists to guarantee. The code review
    // measured that the story claimed this impossible "by construction" when it was impossible only
    // for the SHIPPED ladder.
    //
    // `reduced` is exactly `roster` minus `assigned`, so ONE membership test carries BOTH facts: a
    // winner outside it is either already holding a trophy this spin or is not on the roster, and
    // both are `'internal'` — a broken port, never a malformed input.
    const winners = spinWinners(candidate.awardId, outcome);
    for (const sid of winners) {
      if (!reducedIds.has(sid)) {
        throw new SweepError(
          'internal',
          `award "${candidate.awardId}" resolved to winner ${sid}, who is not in the candidate ` +
            'set it competed over — either already awarded this spin (an anti-sweep violation) or ' +
            'absent from the roster entirely',
        );
      }
    }
    for (const sid of winners) assigned.add(sid);

    results.push({
      awardId: candidate.awardId,
      priority: candidate.priority,
      outcome,
      sweptOut,
      reresolved: sweptOut.length > 0,
    });
  }

  return { results, assigned: [...assigned].sort() };
}

/**
 * A5 and A6: who this outcome assigns.
 *
 * ⭐ A5 — EVERY WINNER COUNTS, INCLUDING EVERY CO-WINNER. "Co-winners all count"
 * (SOLUTION-DESIGN:427), which is also what makes `unique (spin_id, winner_entry_id)` the correct
 * backstop SHAPE — the constraint is per-PLAYER-per-SPIN, not per-award-result, precisely because
 * one award can hand out several trophies. A pass that credited only `winners[0]` would leave the
 * second co-winner in every later candidate set, which is the silent violation
 * `review-data-integrity.md:175-179` names.
 *
 * ⭐ A6 / DECISION K — `'no_eligible_players'` AND `'no_awardable_value'` ASSIGN NOBODY, AND NEITHER
 * IS A REFUSAL. ⛔ The suppressed set a `'no_awardable_value'` outcome CARRIES is to be READ for its
 * width — AD-14 names this pass when it says so — and NEVER resolved: a pass that "helpfully"
 * crowned it would re-crown the 27-way zero tie DECISION E exists to suppress.
 */
function spinWinners(awardId: string, outcome: Outcome): readonly string[] {
  switch (outcome.kind) {
    case 'winner':
      // ⛔ SYMMETRIC WITH THE SHARED ARM BELOW, and unreachable through `resolveStage2` alone. It is
      // reachable through the injected ladder, and an empty id assigned here would be an entry in
      // `assigned` that matches no roster row: it would remove nobody, and at 6.8 it would be
      // written to `award_result_winner` as a foreign key to nothing.
      // ⚠ `typeof !== 'string'`, NOT `=== ''` — AND THE DIFFERENCE IS THE WHOLE POINT OF THE GUARD.
      // Go's mirror gets the omitted-field case for free: a missing `SteamID64` IS `""` there, so
      // one comparison covers both shapes. TypeScript has two distinct shapes and `undefined === ''`
      // is FALSE, so the old check let a port returning `{kind:'winner'}` with no id through — and
      // `[undefined]` then entered `assigned`, producing exactly the "entry matching no roster row"
      // this comment warns about. The two stub tables LOOKED like mirrors (Go omitted the field, TS
      // set it empty) and tested different inputs; the code review measured it.
      // ⭐ 6.9a tightened `=== ''` to `STEAMID64_RE` here too: this id lands in `assigned`, which
      // `assigned: [...assigned].sort()` publishes, so it is on the same byte-lex axis as the
      // roster guard above and a non-digit id would reorder the published array.
      if (typeof outcome.steamid64 !== 'string' || !STEAMID64_RE.test(outcome.steamid64)) {
        throw new SweepError(
          'internal',
          // ⭐ 6.9a CODE REVIEW: the message says "not decimal digits", not "no steamid64". The
        // guard was tightened from a bare emptiness check to STEAMID64_RE and the wording was
        // left behind, so `"7656119800000001x"` — present, non-empty, non-numeric — reported
        // "with no steamid64" and sent the reader looking for a missing field that is populated.
        // These guards exist so a defect NAMES ITSELF (the 6.6 review's lesson); a message that
        // describes the wrong failure defeats the whole point of having them.
        `award "${awardId}" resolved to a WINNER whose steamid64 is missing or not decimal digits`,
        );
      }
      return [outcome.steamid64];

    case 'shared':
      // ⚠ THE ARRAY'S OWN TYPE FIRST, for the same reason. A port returning `{kind:'shared'}` with
      // no `winners` made `.length` throw a bare `TypeError` — not a `SweepError` — so the caller
      // could not read `.detail` and the closed four-detail set was bypassed entirely. Go's nil
      // slice has length 0 and lands on the refusal below, so this arm existed on one side only.
      if (!Array.isArray(outcome.winners) || outcome.winners.length === 0) {
        throw new SweepError(
          'internal',
          `award "${awardId}" resolved to a SHARED outcome with no winners`,
        );
      }
      if (outcome.winners.some((sid) => typeof sid !== 'string' || !STEAMID64_RE.test(sid))) {
        throw new SweepError(
          'internal',
          // ⭐ 6.9a CODE REVIEW — see the sibling guard above; "empty" describes a check this line
        // stopped making when it moved to STEAMID64_RE.
        `award "${awardId}" resolved to a SHARED outcome whose steamid64 is missing or not decimal digits`,
        );
      }
      // ⛔ DUPLICATES TOO, mirroring Go. `assigned` is a Set and would dedupe silently, so the
      // violation would not show in `SpinResult.assigned` at all — it would show at 6.8 as two
      // `award_result_winner` rows for one player, and the `is_shared` trigger would count 2 rows
      // and AGREE with the flag while the ceremony was already wrong. `eligiblePlayers` refuses a
      // duplicate steamid64 in the SNAPSHOT for the same reason, one layer down.
      if (new Set(outcome.winners).size !== outcome.winners.length) {
        throw new SweepError(
          'internal',
          `award "${awardId}" resolved to a SHARED outcome listing a player twice — a co-winner ` +
            'set holds one entry per player',
        );
      }
      return outcome.winners;

    case 'no_eligible_players':
    case 'no_awardable_value':
      return [];

    case 'tie':
      // Unreachable: every tie is handed to the ladder above, which returns a winner or a shared
      // co-win. Loud rather than silent — a tie that reached here would assign nobody and quietly
      // drop a category, which is exactly what a re-resolution that skipped the ladder produces.
      throw new SweepError(
        'internal',
        `award "${awardId}" reached the assignment step as an unresolved TIE — every tie goes ` +
          'through the FR-29 ladder',
      );
  }

  // Unreachable: `Outcome` is a closed union of five arms and every one is handled above. Loud
  // rather than silent — a sixth kind added by a later story must not fall through to "assigns
  // nobody", which is a plausible-looking answer for a category that in fact has a winner.
  // ⛔ `internal`, NOT `stage2` — this is an invariant of THIS module, not a refusal Stage 2 handed
  // up, and Go's mirror says the same. The 6-4b review found the two disagreeing on precisely the
  // arm both files' comments say a sixth kind will hit.
  throw new SweepError(
    'internal',
    `award "${awardId}" resolved to an unknown outcome kind ` +
      `${JSON.stringify((outcome as { kind: string }).kind)}`,
  );
}

/**
 * A2 and A13 — the live set's OWN shape.
 *
 * ⚠ IT MIRRORS `validatePool` CLAUSE FOR CLAUSE, deliberately: the two are the same rule about the
 * same column, one story apart, and a pool that Stage 1 accepted must not be a live set this pass
 * rejects. The one difference is the LABEL — `pool` there, `live` here — because callers route on it.
 *
 * ⭐ THE DUPLICATE-PRIORITY CLAUSE IS THE POINT. `review-data-integrity.md:388-389` says it in as
 * many words: `award.priority` must be UNIQUE "or the anti-sweep 'ascending priority' iteration is
 * non-deterministic when two awards share a priority". `0023:150` enforces it at the database
 * (`award_tournament_priority_key`) — CONFIRMED in the migration rather than assumed — and this
 * refuses it again rather than relying on a stable sort, because a stable sort makes the answer
 * depend on the order the caller happened to supply.
 */
function validateLive(live: readonly Stage1Candidate[]): void {
  if (!Array.isArray(live) || live.length === 0) {
    throw new SweepError(
      'live',
      'the live award set is empty — a spin with nothing to resolve is a refusal, never a short ' +
        'return',
    );
  }
  const seenId = new Set<string>();
  const seenPriority = new Set<number>();
  for (const c of live) {
    // ⚠ THE ELEMENT'S OWN TYPE, FIRST — this is `validatePool`'s arm, and the docstring above claims
    // to mirror that function CLAUSE FOR CLAUSE. It did not: a `null` or non-object element fell
    // through to the `c?.awardId` check and reported the MISLEADING `award_id must be a non-empty
    // string` for an input whose defect is that it is not a candidate at all. The anchor had the
    // same gap and raised a bare `AttributeError` instead of a refusal. The code review caught both.
    if (c === null || typeof c !== 'object') {
      throw new SweepError(
        'live',
        'every live entry must be an object with award_id and priority',
      );
    }
    if (typeof c.awardId !== 'string' || c.awardId === '') {
      throw new SweepError('live', 'award_id must be a non-empty string');
    }
    if (seenId.has(c.awardId)) {
      throw new SweepError(
        'live',
        `duplicate award_id ${c.awardId} — one award is live at most once in a spin`,
      );
    }
    seenId.add(c.awardId);

    if (!Number.isInteger(c.priority) || c.priority < 1) {
      throw new SweepError(
        'live',
        `award ${c.awardId} has priority ${String(c.priority)} — 0023's ` +
          'award_priority_positive requires an integer > 0',
      );
    }
    if (seenPriority.has(c.priority)) {
      throw new SweepError(
        'live',
        `duplicate priority ${String(c.priority)} — UNIQUE(tournament_id, priority) is what makes ` +
          'ascending priority a TOTAL order, so a duplicate is a refusal rather than a coin flip',
      );
    }
    seenPriority.add(c.priority);
  }
}
