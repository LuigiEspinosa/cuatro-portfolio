/**
 * Stage 1 — the seeded weighted live-category pick, browser VERIFIER side (Story 6-4b,
 * FR-25 / FR-26 / AD-14 / SOLUTION-DESIGN §9.2).
 *
 *   weight(a, players, shelf, table):
 *       out = resolveStage2(a.award, players)          # the PROVISIONAL winner
 *       if out.kind === 'tie':          REFUSE (Stage1TieError, names Story 6.5)      W9
 *       if out.kind is no_eligible_players | no_awardable_value:
 *                                       idx = 0        # no player => empty shelf => heaviest
 *       else:                           idx = min(shelf[out.steamid64] ?? 0, table.length - 1)  W8
 *       return table[idx]
 *
 *   stage1Pick(stream, input):
 *       validate(table)      # non-empty, strictly decreasing, every entry > 0            W7
 *       validate(shelf)      # every size a NON-NEGATIVE integer                          W8
 *       validate(pool)       # non-empty, no dup awardId, no dup priority, priority >= 1  W2
 *       validate(liveCount)  # 1 <= liveCount <= pool.length                              W6
 *       cand = [...pool].sort(by priority)              # ASCENDING, a TOTAL order        W2
 *       w    = cand.map(weight)                         # the shelf is FROZEN here        W1
 *       for each of liveCount picks:
 *           total = sum of the REMAINING weights        # RECOMPUTED every pick           W4
 *           r     = await uniformInt(stream, total)     # ALWAYS drawn, no short-circuit  W5
 *           the first remaining candidate whose running cumulative is STRICTLY > r        W3
 *       return live                                     # in DRAW order
 *
 * ⭐ THIS IS THE FIRST STAGE THAT CONSUMES THE STREAM, so its BYTE ACCOUNTING is contract rather
 * than a side effect. Every draw reports `consumedAfter`, because that is the only externally
 * visible proof that this verifier and the Go producer walked the same stream — and the only way
 * a rejection inside `uniformInt` is observable at all. A pick that is right with a byte count
 * that is wrong is still a broken ceremony: every later spin inherits the position.
 *
 * ⛔⛔ W10 — THE PICKS MUST BE AWAITED **SEQUENTIALLY**. `uniformInt` returns a Promise and
 * `prng.ts` THROWS if two draws overlap on one stream. NEVER `Promise.all` over the `liveCount`
 * picks, and never a `.map(async …)`: the 6.3 code review measured what overlapping draws do —
 * after `read(30)`, two concurrent `read(4)` delivered de11f26e / 7b537ef2 where the true bytes
 * are de7b92537ef2f26e (byte 32 never delivered, stream byte 0 injected) — and `consumed` was
 * IDENTICAL in the correct and the corrupt run, so the byte-position assertion this whole vector
 * suite rests on cannot see it. Go is synchronous and cannot exhibit it, which makes this a
 * VERIFIER-ONLY divergence that would surface at 6.9 as the browser declaring a correctly
 * produced ceremony unfair. The loop below is a plain sequential `for` for exactly that reason.
 *
 * ⛔ NO `import 'server-only'` — see the note in `labels.ts`. `lib/roulette` is the one `lib/**`
 * package that ships to the browser (6.9's "Verificar la ceremonia") and `server-only` throws in
 * a client bundle. Pinned by the source scan in `prng.test.ts`.
 *
 * ⛔ NO import of `lib/awards/**`. That package IS `server-only`, and importing it here would
 * poison the browser bundle. Candidates arrive as PLAIN DATA — the projection from the catalog is
 * the caller's job, on the server, and 6.9 will read it out of the published bundle instead.
 *
 * ⭐ THIS MODULE BRINGS `lib/roulette` ITS FIRST REAL IMPORT (`./prng` and `./stage2`). That is
 * deliberate and it reddens `prng.test.ts`'s "every shipped module currently imports nothing"
 * pin BY DESIGN — that test's own comment asks for exactly this: "the day a shipped module gains
 * a real import, this reddens, which is the moment to notice that the three bans have started
 * executing real assertions, and to update this line deliberately rather than silently."
 *
 * THE SEAM (ARCHITECTURE-SPINE.md:73-76). This module conforms to `roulette/vectors/`, never to
 * `worker/awards`. Neither is the reference implementation and neither may be corrected by
 * reading the other's source. When they disagree the vector decides; when the vector is silent,
 * add a vector.
 *
 * ⛔ NOT IN THIS FILE, each with an owner: the FR-29 ladder (6.5 — a tie REFUSES here),
 * anti-sweep and the weight table's VALUES (6.6 — the table arrives as a parameter and is
 * validated, never seeded), pity (6.7), the spin plan's content and the pool's composition across
 * spins (6.8), canonicalization (6.9).
 */

// `Stream` is imported as a VALUE, not only as a type: the guard in stage1Pick uses `instanceof`.
// A structural `typeof x === 'object'` check accepted any non-null object, so a plausible fake —
// a Stream round-tripped through JSON in a 6.9 bundle, say — passed the guard and then died on a
// bare `TypeError: stream.read is not a function` instead of the typed refusal the guard exists
// to produce. Go's `*Stream` parameter makes the equivalent unrepresentable.
import { N_BOUNDS, Stream, uniformInt } from './prng';
import { Stage2Error, resolveStage2 } from './stage2';
import type { Award, SnapshotPlayer } from './stage2';

/**
 * One award in a spin's candidate pool.
 *
 * The pool arrives ALREADY FILTERED — "minus already-revealed" is the spin plan's bookkeeping and
 * belongs to Story 6.8.
 */
export interface Stage1Candidate {
  readonly awardId: string;
  /**
   * The catalog's `priority` column. W2 — the cumulative walk is over candidates in ASCENDING
   * priority, and `UNIQUE(tournament_id, priority)` (0023:150) is the ONLY reason that order is
   * TOTAL. A duplicate is refused rather than broken by a stable sort: two honest implementations
   * would break it differently and the whole walk would shift.
   */
  readonly priority: number;
  readonly award: Award;
}

/**
 * Everything one spin's pick depends on. All of it is INJECTED — this module reads no database,
 * no clock and no ambient configuration, which is what lets a skeptic replay a ceremony with
 * nothing but the published bundle.
 */
export interface Stage1Input {
  readonly candidates: readonly Stage1Candidate[];
  /**
   * The frozen AD-19 snapshot rows Stage 2 resolves over.
   *
   * ⭐ OPTIONAL BECAUSE ABSENT IS LEGAL (Cuatro, 2026-08-04, resolving the 6-4b code review). Go's
   * `Players []SnapshotPlayer` cannot tell a nil slice from an empty one, so an omitted roster is
   * the EMPTY roster there and every award resolves to `no_eligible_players`. This side used to
   * refuse it, which meant the producer could publish a ceremony the verifier called unfair — the
   * exact W10-class divergence the vector seam exists to prevent. `undefined` is now normalised to
   * `[]` here, in Stage 1, deliberately NOT by loosening `stage2.ts`: the scope boundary forbids
   * editing 6-4a's Stage-2 semantics to suit a caller.
   */
  readonly players?: readonly SnapshotPlayer[];
  /**
   * SteamID64 -> the number of trophies that player already holds.
   *
   * W1 — FROZEN AT SPIN START (SOLUTION-DESIGN:411), and an injected map rather than anything
   * read live. An ABSENT player is shelf 0 — the normal shape at the first spin, never an error.
   */
  readonly shelf?: Readonly<Record<string, number>>;
  /**
   * The published `luck.weight_table`: strictly decreasing positive integers, heaviest first.
   * Its VALUES are organizer config (ARCHITECTURE-SPINE.md:471) and belong to 6.6/6.8; this
   * module validates its SHAPE and never seeds one.
   */
  readonly table: readonly number[];
  readonly liveCount: number;
}

/** One draw, including what it cost the stream. */
export interface Stage1Draw {
  /** The total weight this draw ran over — RECOMPUTED per pick (W4). */
  readonly n: number;
  readonly r: number;
  /**
   * The stream's CUMULATIVE byte position after the draw. ⭐ Not decorative: it is what makes
   * "both runtimes consumed identical bytes" an assertion instead of a claim, and
   * `consumedAfter - previous > k` is the only way a rejection inside `uniformInt` is visible.
   */
  readonly consumedAfter: number;
}

/** One spin's answer. */
export interface Stage1Result {
  /**
   * In DRAW order, which is the REVEAL order (EXPERIENCE.md:162-173).
   *
   * ⚠ DELIBERATELY NOT SORTED BY PRIORITY. Story 6.6 re-sorts by ascending priority for
   * anti-sweep processing (SOLUTION-DESIGN §9.4); that is 6.6's transformation of this list, not
   * a defect in it. Sorting here would silently discard the reveal order the UI needs.
   */
  readonly live: readonly string[];
  /** Aligned to ASCENDING PRIORITY order, not to the order `candidates` was supplied in. */
  readonly weights: readonly number[];
  /** The WHOLE pool's total. On a multi-pick spin it is NOT the second draw's `n`. */
  readonly totalWeight: number;
  readonly draws: readonly Stage1Draw[];
}

/**
 * A programmer/data error this module refuses to resolve past.
 *
 * ⭐ ITS OWN CLASS, not a bare `Error` and not a reuse of `Stage2Error`. The 6.3 review measured a
 * mutation surviving the entire suite because a built-in threw the same type the test asserted,
 * and 6-4a measured that an untyped refusal surface let a mutation which rejected EVERY input
 * pass all sixteen refusal rows. A named class keeps every assertion specific to THIS module.
 */
export class Stage1Error extends Error {
  /**
   * WHICH input was rejected — one of {@link REFUSAL_DETAILS}.
   *
   * ⭐ SHARED CONTRACT, not decoration, and Story 6-4b's mutation pass is why. Deleting the
   * NEGATIVE-SHELF guard left every gate GREEN here: a negative index yields `undefined`, which
   * becomes `NaN` in the weight sum and is refused three functions later — still a `Stage1Error`,
   * still the right `refusal_kind`. Go, meanwhile, PANICS on `table[-1]`. So the shared refusal
   * row could not tell "refused by the guard that exists for exactly this" from "refused by
   * accident" or "crashed". This field makes them distinguishable in both languages, and it
   * sharpens every invalid row rather than only that one. It is 6-4a's untyped-refusal lesson
   * applied one level deeper.
   */
  readonly detail: string;

  constructor(detail: string, message: string, options?: { cause?: unknown }) {
    super(`roulette: stage 1 refused (${detail}): ${message}`, options);
    this.name = 'Stage1Error';
    this.detail = detail;
  }
}

/**
 * The closed set of things a Stage-1 refusal can be ABOUT. It travels in the vector next to the
 * refusal rows, so both runtimes must agree on it.
 *
 * `Object.freeze` is SHALLOW — 6.1 shipped a "frozen" catalog of mutable entries on exactly that
 * mistake. One call suffices here only because every element is a primitive.
 */
export const REFUSAL_DETAILS: readonly string[] = Object.freeze([
  'weight_table', // W7 — the published luck table's shape
  'shelf', // W8 — a shelf size
  'pool', // W2/W6 — the candidate pool's shape
  'live_count', // W6 — how many awards the spin asked for
  'total_weight', // the sum left uniformInt's [1, 2^32]
  'stage2', // a Stage-2 refusal propagated rather than swallowed
  'tie', // W9 — which is a refusal KIND, not an invalid input
  'stream', // no stream was supplied at all
  'internal', // an invariant this module believes unreachable
]);

/**
 * ⚠ THE LAST TWO ARE DECLARED BUT NOT ROW-REPRESENTABLE, and that distinction is why this note
 * exists. A vector row is a set of INPUTS; "no stream was supplied" and "an invariant broke" are
 * not inputs, so no row can produce them — but both are reachable here and in Go, so leaving them
 * out made a "closed set" that was not closed. The 6-4b code review found all three ways that went
 * wrong: Go declared nine while this file and the vector declared seven, this file threw `'stream'`
 * and `'internal'` anyway while the JSDoc on {@link Stage1Error.detail} promised one of the seven,
 * and the unreachable unknown-outcome arm refused as `internal` in Go and `stage2` here — the same
 * input, two different values, in the field the vector calls shared contract.
 *
 * All three now declare the same NINE and the vector's `refusal_details` carries all nine. Which of
 * them a ROW may carry is the separate, narrower rule the generator enforces: seven.
 */

/**
 * The W9 refusal: the provisional winner is a TIE, which has no single shelf.
 *
 * ⭐ A SUBCLASS, so it is distinguishable from an invalid input while `instanceof Stage1Error`
 * still answers "did Stage 1 refuse". The vector's `refusal_kind` makes both runtimes keep them
 * distinguishable — the two mean different things to the caller: an invalid input is a bug to
 * fix, while a tie is the FR-29 seam Story 6.5 fills. 6-4a measured ties on 5 of 12 awards once
 * the floors admit anyone, so this fires often and is a designed outcome, not a malfunction.
 */
export class Stage1TieError extends Stage1Error {
  readonly awardId: string;
  readonly tied: readonly string[];
  /**
   * WHICH equality tied it — `equal_value` or `equal_cross_product`. Carried because the two are
   * different bugs when they are wrong, and because Go's `Stage1TieError` carries it: the two
   * halves of the seam must expose the same information about the same refusal, which Story
   * 6-4b's Task-5 transcript diff is what proved.
   */
  readonly reason: string;

  constructor(awardId: string, tied: readonly string[], reason: string) {
    super(
      'tie',
      `the provisional winner of award "${awardId}" is a ${String(tied.length)}-way ${reason} tie ` +
        'and therefore has no single shelf to look up — that is Story 6.5’s FR-29 ladder. Stage 1 ' +
        'will not pick one: min-shelf-over-the-tied-set, byte-lex-first and lowest-SteamID64 are ' +
        'each a silent argmax that 6.5 would later contradict, changing every drawn byte from ' +
        'this spin onward with nothing red anywhere',
    );
    this.name = 'Stage1TieError';
    this.awardId = awardId;
    this.tied = tied;
    this.reason = reason;
  }
}

/**
 * The candidates' integer weights in ASCENDING PRIORITY order.
 *
 * SYNCHRONOUS, and it draws NOTHING: no stream, no bytes, no randomness. Exported separately from
 * {@link stage1Pick} so 6.6's luck meter can render the weights it is about to bias without
 * consuming a byte of a ceremony's stream.
 *
 * `liveCount` is deliberately NOT consulted — weighting a pool does not depend on how many awards
 * will be drawn from it. The split is mirrored in all three implementations so the shared refusal
 * surface stays one surface.
 */
export function stage1Weights(input: Stage1Input): number[] {
  return weighted(input, false).weights;
}

/**
 * The shared half: validate, sort, weight. `checkLiveCount` is false for the {@link stage1Weights}
 * path, which does not consult `liveCount` at all.
 *
 * ⭐ VALIDATION ORDER IS PART OF THE CONTRACT, not an implementation detail. When an input is
 * malformed in TWO ways at once — a bad `liveCount` over a pool whose first candidate TIES — the
 * order decides WHICH refusal the caller sees, and a caller routing on `refusal_kind` hands a
 * malformed spin plan to Story 6.5's ladder if the runtimes disagree about it. The 6-4b code
 * review measured exactly that: this file and its Go mirror weighted FIRST and returned `tie`,
 * while the Python anchor validated `live_count` first and returned `invalid`/`live_count`. The
 * anchor is right — the story's transcribed algorithm and the vector's published `spec` string
 * both put `1 <= live_count <= |pool|` in the POOL group, before the weight loop.
 *
 * The vector's `live-count-zero-over-a-tied-pool` refusal row is the ONLY row that can redden a
 * regression of this, because it is the only row carrying two defects at once.
 */
function weighted(
  input: Stage1Input,
  checkLiveCount: boolean,
): {
  ordered: Stage1Candidate[];
  weights: number[];
} {
  // ⭐ AN ABSENT CONTAINER IS THE EMPTY ONE (Cuatro, 2026-08-04, resolving the 6-4b review). Go
  // cannot distinguish a nil map from an empty one, so `undefined` here must mean what nil means
  // there or the producer and the verifier disagree about an input neither would report. `null`
  // and structurally-wrong types are still refused below: those are states Go cannot express at
  // all, so the guard is this side's alone and is deliberately not vectorable — the same reasoning
  // as the `Object.hasOwn` note in `weightOf`.
  const shelf = input.shelf === undefined ? {} : input.shelf;
  const players = input.players === undefined ? [] : input.players;

  validateWeightTable(input.table);
  validateShelf(shelf);
  validatePool(input.candidates);
  if (checkLiveCount) {
    validateLiveCount(input.liveCount, input.candidates.length);
  }

  // W2 — ASCENDING `priority`, over a COPY. Never sort the caller's array: a selector that
  // reordered its input would make two consecutive picks over the same pool observably different
  // operations, which is exactly what `stage2.ts`'s eligiblePlayers refuses to do.
  //
  // ⛔ NEVER `localeCompare`, and never a string sort: `priority` is an integer column, the
  // comparator below is a numeric subtraction on values `validatePool` has already proven to be
  // safe integers, and the priorities are unique so the order is total with no stability needed.
  const ordered = [...input.candidates].sort((a, b) => a.priority - b.priority);

  // W1 — THE SHELF IS FROZEN HERE. Every weight is computed once, from the shelf as it stood at
  // spin start, BEFORE the first draw. See the note in stage1Pick for why that matters.
  const weights = ordered.map((c) => weightOf(c, players, shelf, input.table));
  return { ordered, weights };
}

/**
 * FR-26's rule for ONE candidate: `table[min(shelf[provisionalWinner], tableMax)]`.
 *
 * ⭐ DECISION F (Cuatro, 2026-08-04) lives here, and the two no-winner shapes must NOT be
 * collapsed:
 *   - `'tie'` has SEVERAL candidate shelves, and choosing among them is the silent argmax AD-14
 *     forbids — so it refuses, naming Story 6.5 (W9).
 *   - `'no_eligible_players'` / `'no_awardable_value'` have NO PLAYER AT ALL, therefore no shelf,
 *     therefore index 0 — the heaviest weight, which is exactly what FR-26's "empty shelf =>
 *     heaviest" is written to produce.
 *
 * The consequence is measured, not hypothetical: 6-4a found all twelve real awards resolving to
 * `no_eligible_players` under the shipped 24/20 floors, so on today's corpus every candidate
 * weighs the heaviest and Stage 1 draws UNIFORMLY. That is a correct output of a measured input.
 * Refusing on a no-winner outcome would make the ceremony unrunnable today; weighting a TIE as an
 * empty shelf would invent a winner 6.5 will contradict.
 *
 * ⛔ `resolveStage2`, NEVER `resolveAward`. `resolveAward` hands a tie to the injected ladder,
 * which in this era refuses — so Stage 1 would receive an error it cannot inspect instead of the
 * tie it must SEE in order to refuse for the right reason. `stage2.ts` exports the pure stage for
 * precisely this caller.
 */
function weightOf(
  candidate: Stage1Candidate,
  players: readonly SnapshotPlayer[],
  shelf: Readonly<Record<string, number>>,
  table: readonly number[],
): number {
  let outcome;
  try {
    outcome = resolveStage2(candidate.award, players);
  } catch (err) {
    if (err instanceof Stage2Error) {
      // ⭐ RE-TYPED, NOT RE-THROWN AS-IS, and `cause` keeps the original readable. Every refusal
      // Stage 1 produces is a `Stage1Error`, so one check answers "did Stage 1 refuse" — the Go
      // mirror wraps both sentinels for the same reason. Swallowing this instead — treating an
      // unresolvable award as a zero, or as the heaviest weight — would let a malformed catalog
      // draw a ceremony.
      throw new Stage1Error(
        'stage2',
        `weighting award "${candidate.awardId}": ${err.message}`,
        { cause: err },
      );
    }
    throw err;
  }

  switch (outcome.kind) {
    case 'tie':
      // W9 — propagated, never swallowed.
      throw new Stage1TieError(candidate.awardId, outcome.tied, outcome.reason);

    case 'no_eligible_players':
    case 'no_awardable_value':
      // DECISION F — no player, no shelf, the maximal empty shelf: index 0.
      return table[0] as number;

    case 'winner': {
      // W8 — `tableMax` is `table.length - 1`, NOT a length. Using the length indexes one past
      // the end for any shelf at or beyond it, which is `undefined` here and a panic in Go.
      const tableMax = table.length - 1;
      // ⛔ `Object.hasOwn`, not a bare `shelf[id]`. A plain object inherits `constructor`,
      // `toString` and friends from its prototype, so a bare lookup can return a FUNCTION for an
      // id that is not in the map at all — and `min(function, tableMax)` is `NaN`, which indexes
      // `undefined` and produces `NaN` weights that compare false against everything. Go's map
      // has no such hazard, so without this guard the two halves of the seam would disagree on an
      // input neither would report.
      const held = Object.hasOwn(shelf, outcome.steamid64) ? (shelf[outcome.steamid64] as number) : 0;
      // An ABSENT player is shelf 0 — the right answer for the right reason, and the NORMAL case
      // at the first spin. validateShelf has already refused any negative size.
      const index = held > tableMax ? tableMax : held;
      return table[index] as number;
    }
  }

  // Unreachable: `Outcome` is a closed union of four arms and every one is handled above. Loud
  // rather than silent — a fifth kind added by a later story must not fall through to a plausible
  // weight. (6-4a's review found the TypeScript conformance switch lacking exactly this arm.)
  // ⛔ `internal`, NOT `stage2` — this is an invariant of THIS module, not a refusal Stage 2
  // handed up, and Go's mirror has always said `DetailInternal` here. The 6-4b review found the
  // two disagreeing on precisely the arm both files' comments say a fifth `Outcome` kind will hit.
  throw new Stage1Error(
    'internal',
    `award "${candidate.awardId}" resolved to an unknown Stage-2 outcome kind ` +
      `${JSON.stringify((outcome as { kind: string }).kind)}`,
  );
}

/**
 * Draw `liveCount` awards from the pool, consuming `stream`.
 *
 * ⛔ ASYNC AND SEQUENTIAL — see W10 in the module header. Each `await` completes before the next
 * begins; `Promise.all` over the picks would interleave reads on one stream and silently produce
 * a different-but-valid-looking ceremony that `consumed` cannot detect.
 */
export async function stage1Pick(stream: Stream, input: Stage1Input): Promise<Stage1Result> {
  if (!(stream instanceof Stream)) {
    throw new Stage1Error('stream', 'a Stream must be supplied — Stage 1 is stream-driven');
  }

  // ⛔ EVERY VALIDATION RUNS BEFORE THE FIRST DRAW (W7). A malformed table or pool must not
  // consume a byte and THEN fail: the stream position would depend on the failure, so a retry
  // after fixing the config would produce a different ceremony from the same seed. The vector's
  // generator asserts this directly — every refusal row is checked to have left the stream at 0.
  const { ordered, weights } = weighted(input, true);

  let remaining = ordered.map((_, i) => i);
  const totalWeight = sumWeights(weights, remaining);

  const draws: Stage1Draw[] = [];
  const live: string[] = [];

  for (let pick = 0; pick < input.liveCount; pick++) {
    // W4 — RECOMPUTED over the REMAINING candidates, every time. Never `r - cumulative` and never
    // a second walk over the first draw's remainder: two picks are two `uniformInt` calls and two
    // byte movements, and `consumedAfter` is what proves it.
    const total = sumWeights(weights, remaining);

    // W5 / DECISION G — THE DRAW ALWAYS HAPPENS. There is no single-candidate short-circuit: a
    // one-candidate pool of weight 100 still draws n = 100 and still consumes a byte. `n = 1` —
    // and therefore E1's zero-byte draw — arises ONLY when the remaining total is 1. The two
    // rules produce identical PICKS and different STREAM POSITIONS, which is invisible until this
    // very verifier declares a correct ceremony unfair.
    //
    // ⛔ AWAITED HERE, INSIDE THE LOOP. This is the W10 line.
    const r = await uniformInt(stream, total);
    draws.push({ n: total, r, consumedAfter: stream.consumed });

    // The cumulative walk, still in ascending priority over what remains.
    let cumulative = 0;
    let picked = -1;
    for (const i of remaining) {
      cumulative += weights[i] as number;
      // ⭐ W3 — STRICTLY GREATER, and this is the highest-value line in the file. With weights
      // [3, 2] and r = 3: `>` selects the SECOND candidate, which is correct because r in
      // {0,1,2} is the first candidate's share and {3,4} is the second's. `>=` selects the FIRST
      // and silently hands it 4/5 of the probability mass. The result SHAPE is identical either
      // way and every award in the ceremony shifts. Pinned by the vector's
      // `r-lands-exactly-on-a-cumulative-boundary` row — the only row where r sits exactly on a
      // boundary, and the same class as uniform_int's `exact-threshold-rejection-x-equals-limit`,
      // which the 6.3 mutation pass found surviving the entire suite in both languages.
      if (cumulative > r) {
        picked = i;
        break;
      }
    }
    if (picked < 0) {
      // Unreachable: r < total = the sum of the remaining weights, so the cumulative necessarily
      // exceeds it on some candidate. Loud rather than silent — falling through with no pick
      // would return a spin shorter than the plan promised, which is exactly what W6 refuses to
      // do by accident.
      throw new Stage1Error(
        'internal',
        `the cumulative walk selected nothing for r=${String(r)} over total ${String(total)} — ` +
          "uniformInt's range broke",
      );
    }

    live.push((ordered[picked] as Stage1Candidate).awardId);
    remaining = remaining.filter((i) => i !== picked);
  }

  return { live, weights, totalWeight, draws };
}

/**
 * Total the weights at `idx`, refusing rather than losing precision.
 *
 * ⚠ CHECKED AFTER EVERY ADDITION, not once at the end. Every weight is > 0
 * ({@link validateWeightTable}), so the running total only grows — which means a bound checked
 * each step catches an oversized table BEFORE the addition that would leave the safe-integer
 * range. Checking only the final sum would let a total that had already lost precision land back
 * inside `[1, 2^32]` and draw a perfectly plausible, completely wrong ceremony.
 *
 * The bound is `uniformInt`'s own. `prng.ts` records that the largest REAL total is about 1200
 * (12 awards x weight 100), so a total anywhere near the bound means the weight table is wrong,
 * not that the bound is tight.
 */
function sumWeights(weights: readonly number[], idx: readonly number[]): number {
  let total = 0;
  for (const i of idx) {
    total += weights[i] as number;
    if (!Number.isSafeInteger(total) || total < N_BOUNDS.MIN || total > N_BOUNDS.MAX) {
      throw new Stage1Error(
        'total_weight',
        `total weight left uniformInt's [${String(N_BOUNDS.MIN)}, ${String(N_BOUNDS.MAX)}] range — ` +
          'the largest real total is about 1200 (12 awards x weight 100), so this means the ' +
          'weight table is wrong',
      );
    }
  }
  return total;
}

/**
 * W7, and it runs BEFORE any draw.
 *
 * Non-empty, STRICTLY DECREASING, every entry a positive integer. Each clause earns its place:
 *   - a NON-DECREASING table inverts FR-26's bias — the luck meter would favour the player who
 *     already holds the most trophies, the exact opposite of the underdog rule the feature
 *     exists for, and nothing downstream would look wrong;
 *   - a `0` entry makes a candidate unpickable while it still occupies the cumulative walk, so
 *     the pool silently shrinks with no refusal anywhere;
 *   - an empty table has no index 0 to give the empty shelf.
 *
 * ⚠ The INTEGER check has no counterpart in the Go producer, whose `[]int` excludes a fractional
 * weight at the type level. It is the same asymmetry `README.md:107-109` records for the `n`
 * bounds: a fractional weight cannot be written as a JSON integer without breaking the vector's
 * integer-only rule, so it stays a runtime assertion on this side rather than a shared row.
 */
function validateWeightTable(table: readonly number[]): void {
  if (!Array.isArray(table) || table.length === 0) {
    throw new Stage1Error(
      'weight_table',
      'luck_weight_table must be a non-empty array — there is no index 0 to give the empty shelf',
    );
  }
  for (let i = 0; i < table.length; i++) {
    const w = table[i] as number;
    // ⚠ `isInteger`, NOT `isSafeInteger`. Go's `[]int` and Python's `isinstance(w, int)` both
    // accept an oversized-but-integral entry and let `sumWeights` refuse the TOTAL; refusing it
    // here as `weight_table` made the same input carry a different `detail` in each runtime. The
    // 6-4b review found the divergence starting at 2^53 + 1 — one order of magnitude above the
    // shipped `[4294967296, 1]` row, which IS a safe integer and so agreed by luck. Precision is
    // still guaranteed: `sumWeights` re-checks `isSafeInteger` after every addition.
    if (!Number.isInteger(w)) {
      throw new Stage1Error(
        'weight_table',
        `luck_weight_table[${String(i)}] must be an integer, got ${JSON.stringify(w)}`,
      );
    }
    if (w <= 0) {
      throw new Stage1Error(
        'weight_table',
        `luck_weight_table[${String(i)}] = ${String(w)} must be > 0 — a non-positive weight makes ` +
          'a candidate unpickable while it still occupies the cumulative walk',
      );
    }
    if (i > 0 && w >= (table[i - 1] as number)) {
      throw new Stage1Error(
        'weight_table',
        `luck_weight_table must be STRICTLY DECREASING, got ${String(table[i - 1])} then ` +
          `${String(w)} at index ${String(i)} — a non-decreasing table inverts FR-26's bias ` +
          'toward the empty shelf',
      );
    }
  }
}

/**
 * W8's other half.
 *
 * A shelf size is a count, so it is non-negative. A NEGATIVE size is refused rather than trusted
 * because it is silently plausible and DIFFERENTLY wrong in each language: Python and Ruby index
 * from the END of the table (handing the LIGHTEST weight to the emptiest shelf — FR-26 exactly
 * backwards), Go panics, and JavaScript yields `undefined`. Three behaviours, no error, one
 * contract.
 */
function validateShelf(shelf: Readonly<Record<string, number>>): void {
  if (shelf === null || typeof shelf !== 'object' || Array.isArray(shelf)) {
    throw new Stage1Error('shelf', 'shelf must be an object mapping steamid64 to a trophy count');
  }
  // ⛔ `getOwnPropertyNames`, NOT `Object.entries` / `Object.keys`. The read side uses
  // `Object.hasOwn`, which sees NON-ENUMERABLE own properties; `Object.entries` does not. The 6-4b
  // review found the gap: a shelf carrying a non-enumerable own key sailed through validation
  // untouched and was then read by `weightOf`, so the guard and the lookup disagreed about what
  // "in the map" means. The two accessors must see the same set or the validation is decorative.
  for (const sid of Object.getOwnPropertyNames(shelf)) {
    const size = shelf[sid] as number;
    // `isInteger`, not `isSafeInteger`, for the same provenance reason as validateWeightTable:
    // Go's `map[string]int` accepts an oversized shelf and clamps it to tableMax.
    if (!Number.isInteger(size) || size < 0) {
      throw new Stage1Error(
        'shelf',
        `shelf[${JSON.stringify(sid)}] = ${JSON.stringify(size)} must be a non-negative integer — ` +
          'a shelf size is a count',
      );
    }
  }
}

/** W2 and the pool half of W6. */
function validatePool(candidates: readonly Stage1Candidate[]): void {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Stage1Error(
      'pool',
      'the candidate pool is empty — a spin with nothing to draw is a refusal, never a short return',
    );
  }
  const seenId = new Set<string>();
  const seenPriority = new Set<number>();
  for (const c of candidates) {
    if (c === null || typeof c !== 'object') {
      throw new Stage1Error(
        'pool',
        `every candidate must be an object, got ${JSON.stringify(c) ?? String(c)}`,
      );
    }
    if (typeof c.awardId !== 'string' || c.awardId === '') {
      throw new Stage1Error(
        'pool',
        `award_id must be a non-empty string, got ${JSON.stringify(c.awardId)}`,
      );
    }
    if (seenId.has(c.awardId)) {
      throw new Stage1Error(
        'pool',
        `duplicate award_id "${c.awardId}" — one award appears at most once in a spin's pool`,
      );
    }
    seenId.add(c.awardId);

    // 0023:139's `award_priority_positive`.
    if (!Number.isSafeInteger(c.priority) || c.priority < 1) {
      throw new Stage1Error(
        'pool',
        `award "${c.awardId}" has priority ${JSON.stringify(c.priority)} — 0023's ` +
          'award_priority_positive requires a positive integer',
      );
    }
    if (seenPriority.has(c.priority)) {
      // W2 — a refusal, NOT a stable-sort coin flip. UNIQUE(tournament_id, priority) is the only
      // thing making "ascending priority" a total order; without it two honest implementations
      // break the tie differently and the whole cumulative walk shifts.
      throw new Stage1Error(
        'pool',
        `duplicate priority ${String(c.priority)} — UNIQUE(tournament_id, priority) is what makes ` +
          'ascending priority a TOTAL order, so a duplicate is a refusal rather than a coin flip',
      );
    }
    seenPriority.add(c.priority);
  }
}

/**
 * W6.
 *
 * ⛔ NEVER A CLAMP AND NEVER A SHORT RETURN. A clamped spin reveals fewer categories than the
 * spin plan promised, and nothing downstream can tell that apart from a plan that asked for
 * fewer — the ceremony would simply be quietly smaller than the one that was published.
 */
function validateLiveCount(liveCount: number, poolSize: number): void {
  if (!Number.isSafeInteger(liveCount) || liveCount < 1) {
    throw new Stage1Error(
      'live_count',
      `live_count must be an integer >= 1, got ${JSON.stringify(liveCount)}`,
    );
  }
  if (liveCount > poolSize) {
    throw new Stage1Error(
      'live_count',
      `live_count ${String(liveCount)} exceeds the ${String(poolSize)}-candidate pool — never a ` +
        'clamp: a clamped spin reveals fewer categories than the spin plan promised',
    );
  }
}
