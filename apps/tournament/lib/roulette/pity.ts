/**
 * Pity — the guaranteed consolation draw (Story 6.7, FR-28 / AD-14 / SM-2 /
 * SOLUTION-DESIGN §9.4 / ARCHITECTURE-SPINE.md:221).
 *
 * ```
 * resolvePity({players, shelf, stream}):
 *     validate(stream); validate(players); validate(shelf)      # the PUBLISHED order (P10)
 *
 *     # ── the WINLESS SET. shelf == 0 AND not fully DQ'd. An ABSENT key is 0.  (AC1, P6)
 *     #    ⛔ NO FR-21 floors here — never                                      (P7)
 *     #    ⛔ NO read of a Stage-2 outcome's suppressed set        (DECISION K', P8)
 *     winless = sorted(p.steamid64 for p in players
 *                      if shelf[p.steamid64] == 0 and not p.idleDq)   # byte-lex   (P4)
 *
 *     # ── the SEEDED REVEAL ORDER. The OUTCOME is invariant; only this is drawn. (AC2, P2)
 *     order = copy(winless)
 *     for i = len(order) - 1 down to 1:          # DECISION D — Durstenfeld, DESCENDING (P3)
 *         j = await uniformInt(stream, i + 1)    #   n = i+1, strictly decreasing; n is never 1
 *         swap(order[i], order[j])               #   i == j is a LEGAL self-swap
 * ```
 *
 * ⭐⭐ P1 — THIS MODULE TAKES A STREAM AND THE BYTE COST IS PART OF THE CONTRACT. THE WHOLE
 * DISCIPLINE INVERTS FROM {@link resolveSpin}. There, "it draws nothing and the SIGNATURE is the
 * proof" was the property — the module is **synchronous** and the **absence** of `'./prng'` from
 * its specifier list is the load-bearing half of `prng.test.ts`'s import-graph pin. Here the mirror
 * holds: `./prng` **IS** imported, that **presence** is what the pin protects, and this entry point
 * is therefore **`async`** like {@link stage1Pick}, because `uniformInt` returns a `Promise`. A
 * synchronous signature here is not a style choice; it is impossible.
 *
 * ⛔ THE CALLER CONSTRUCTS THE STREAM AND PASSES IT IN, the same injection discipline `stage1Pick`
 * uses, because the seed and the label are the ceremony's to publish and not this module's to
 * invent. ⭐⭐ AND "THE STREAM IS FRESH AND KEYED BY THE PITY LABEL" IS A CLAIM ABOUT A CALLER, NOT
 * A CONSTRUCTION — SO IT IS CHECKED, NOT ASSERTED. Story 6.6's AC1 claimed a property held "by
 * construction" when it held only for the shipped composition, and the code review measured it.
 *
 * ⛔ NOT `server-only`, and NOT an importer of `lib/awards/**`. This module ships to the BROWSER at
 * 6.9 — "Verificar la ceremonia" re-runs it against the published bundle — so `server-only` would
 * throw in a client bundle and `lib/awards/catalog.ts` (which IS `server-only`) would poison it.
 *
 * THE SEAM (ARCHITECTURE-SPINE.md:73-76). This file conforms to `roulette/vectors/pity-draw.json`,
 * never to `worker/awards/pity.go`. Two independent implementations of one spec; neither is the
 * reference and neither may be corrected by reading the other. When they disagree the vector
 * decides; when the vector is silent, add a vector.
 *
 * ⛔ NOT IN THIS FILE, each with an owner: every WRITE — the pity `spin` row(s), `spin.kind =
 * 'pity'`, `award_result` with `is_pity = true`, `award_result_winner`, the reveal axis — is
 * 6.8's; canonicalization, `bundle_sha256` and the `pity` bundle key's SHAPE are 6.9's; the
 * `ronda de consolación` UI and every i18n string are 6.10's; the end-to-end ceremony vector is
 * 6.11's — this file's vector is the UNIT one.
 */

import { PITY_LABEL } from './labels';
import { minimalK, uniformInt, type Stream } from './prng';
import type { SnapshotPlayer } from './stage2';

/**
 * A programmer/data error this module refuses to resolve past.
 *
 * ⭐ ITS OWN CLASS, not a bare `Error` and not a reuse of `SweepError` / `Stage1Error`. The 6.3
 * review measured a mutation surviving the entire suite because a built-in threw the same type the
 * test asserted, and 6-4a measured that an untyped refusal surface let a mutation which rejected
 * EVERY input pass all sixteen refusal rows.
 */
export class PityError extends Error {
  /** WHICH input was rejected — one of {@link PITY_REFUSAL_DETAILS}. */
  readonly detail: string;

  constructor(detail: string, message: string, options?: { cause?: unknown }) {
    super(`roulette: pity refused (${detail}): ${message}`, options);
    this.name = 'PityError';
    this.detail = detail;
  }
}

/**
 * The closed set of things a pity refusal can be ABOUT (P9). THREE distinct FACTS get three
 * distinct labels, because they mean genuinely different things to a caller.
 *
 * `Object.freeze` is SHALLOW — 6.1 shipped a "frozen" catalog of mutable entries on exactly that
 * mistake. One call suffices here only because every element is a primitive, and the suite asserts
 * that rather than assuming it.
 *
 * ⭐⭐ THERE IS DELIBERATELY NO `internal` LABEL, AND THE ABSENCE IS ARGUED RATHER THAN OVERLOOKED.
 * `sweep.ts` declares one because {@link Ladder} is an INJECTED PORT that can hand it an outcome no
 * code in that module built. Pity has no such port: every value it decides from is either a plain
 * input it has just validated or the return of `uniformInt`, whose `[0, n)` contract is pinned by
 * gate 2's own vector in the same three implementations. A fourth label would be a COMPARTMENT
 * rather than a contract — one no suite could ever drive. The multiset identity between `winless`
 * and `revealOrder` is therefore asserted as a TEST over every vector case in all three
 * implementations, not as a runtime refusal nothing can reach.
 *
 * ⚠ ALL THREE ARE ROW-REPRESENTABLE, so the vector's `refusal_details` and
 * `row_representable_refusal_details` are EQUAL — a fact worth stating as data rather than a key
 * worth omitting. The one arm no ROW can express is `stream` with NO STREAM AT ALL; that half is
 * driven by this module's own suite.
 */
export const PITY_REFUSAL_DETAILS: readonly string[] = Object.freeze([
  'stream', // the injected stream is absent, keyed by the wrong label, or already drawn on
  'players', // the roster's OWN shape is wrong — a duplicate or an empty steamid64
  'shelf', // a shelf count is negative, or a shelf key names nobody on the roster
]);

/** One shuffle step, including what it cost the stream. */
export interface PityDraw {
  /** The `n` this step drew over: `i + 1`, strictly decreasing from `winless.length` down to 2. */
  readonly n: number;
  /** `minimalK(n)` — 1 for every roster this ceremony can produce. */
  readonly k: number;
  /**
   * How many times `uniformInt` rejected before returning, derived from the byte position rather
   * than counted inside a second copy of the primitive.
   */
  readonly rejections: number;
  /** The index `j` the step swapped with. `j === i` is a LEGAL self-swap. */
  readonly value: number;
}

/** Everything the consolation draw depends on. All of it is INJECTED. */
export interface PityInput {
  /**
   * The frozen AD-19 snapshot, REUSED rather than restated — two near-identical player shapes is
   * how the two runtimes drift.
   *
   * ⚠ AN ABSENT CONTAINER IS THE EMPTY CONTAINER (P11, Cuatro's call at the 6-4b review): Go cannot
   * idiomatically tell a nil slice from an empty one, so an omitted roster is the EMPTY roster
   * there and must be here. It resolves to an empty draw, never a refusal.
   */
  readonly players?: readonly SnapshotPlayer[];
  /**
   * SteamID64 to the number of trophies that player holds after ALL main spins — the same shape
   * `Stage1Input.shelf` already defines.
   *
   * ⭐ P6 / DECISION G — READ, NEVER WRITTEN. Advancing the shelf across spins is the CALLER's job:
   * `resolveSpin` deliberately never touches it (A10), so the caller accumulates `SpinResult.
   * assigned` across the twelve spins into this map and pity reads the result. ⚠ An ABSENT player
   * is shelf 0 (W8) — the normal shape after a ceremony where nobody won, never an error.
   */
  readonly shelf?: Readonly<Record<string, number>>;
  /** The pity draw's own domain-separated stream, keyed by `PITY_LABEL` and at counter 0. */
  readonly stream: Stream;
}

/** The whole consolation draw's answer. */
export interface PityResult {
  /**
   * Every player who holds no trophy and is not fully DQ'd, in BYTE-LEX order.
   *
   * ⭐⭐ THIS IS THE OUTCOME, AND IT IS INVARIANT. "Everyone winless gets one" (SPINE:221) means the
   * set of winners IS this set: no selection, no elimination, no weighting.
   */
  readonly winless: readonly string[];
  /**
   * The SEEDED permutation of {@link winless} — the order the consolation prizes are revealed in,
   * and the only thing the stream decides.
   *
   * ⭐⭐ TWO FIELDS, NEVER ONE, so a caller cannot accidentally publish the canonical order as the
   * reveal order or vice versa. With one field that would be a typo; with two it is a type error at
   * the call site. Both are ALWAYS present, even when empty.
   */
  readonly revealOrder: readonly string[];
  /** One entry per shuffle step. EMPTY for a winless set of length 0 or 1 — AC3's whole content. */
  readonly draws: readonly PityDraw[];
  /** The stream's cumulative position after the draw. */
  readonly bytesConsumed: number;
}

/**
 * FR-28's guaranteed consolation draw, run ONCE after all main spins.
 *
 * ⭐⭐ P2 — THE OUTCOME IS INVARIANT AND ONLY THE ORDER IS SEEDED. A "draw" here is a PERMUTATION,
 * not a lottery. There is no selection, no elimination, no weighting and no luck meter: every
 * winless player gets exactly one consolation award, and the stream decides only the sequence they
 * are revealed in. This is stated because "pity ROULETTE" reads like a lottery and FR-28's own name
 * invites the wrong implementation — the one that draws N winners out of the winless set and leaves
 * the rest with nothing, defeating the entire requirement while looking like a faithful reading of
 * the word.
 *
 * ⭐⭐ P7 — THE FR-21 FLOORS ARE NEVER CONSULTED, AND THIS IS THE EASIEST SEMANTIC IN THE STORY TO
 * GET BACKWARDS. Pity's eligibility is "not fully AFK/idle-DQ'd" (FR-28) and NOTHING else. A player
 * who missed the floors won nothing PRECISELY BECAUSE OF THEM, so re-applying them here would
 * exclude the very people FR-28 exists for and make SM-2 ("zero Players finish with no shot at a
 * prize") unachievable by construction. ⛔ NOTE WHAT IS ABSENT BELOW: no `roundsPlayed` read, no
 * `kills` read, no eligibility filter, no `Award` parameter at all — there is nothing in this
 * signature a floor could even be read from.
 *
 * ⭐ P8 / DECISION K' — THE SUPPRESSED SET OF A `'no_awardable_value'` OUTCOME IS NOT READ, AND
 * THAT IS A DECISION RATHER THAN AN OMISSION. `ARCHITECTURE-SPINE.md:148` says the outcome carries
 * it "so the width of the tie that did not form stays readable to the ladder (6.5), anti-sweep
 * (6.6) and pity (6.7)" — so a future maintainer WILL come here to "restore" the dependency.
 * READABLE IS NOT THE SAME AS READ: a suppressed player did not win, so their shelf is unchanged,
 * so the shelf ALREADY places them in the winless set. Reading it would be redundant at best and
 * double-counting at worst. The width earns its keep at 6.8's reveal copy and in 6.9's bundle.
 *
 * ⭐ DECISION F' — THE EXHAUSTION / NOBODY-QUALIFIED DISTINCTION IS DELIBERATELY NOT BRANCHED ON.
 * Story 6.6 carried it on `AwardAssignment.sweptOut` specifically for this story, and it does not
 * change who is winless: both facts leave the player at shelf 0 and both put them in pity. It
 * matters for 6.8's reveal copy, not for this input.
 */
export async function resolvePity(input: PityInput): Promise<PityResult> {
  // ⚠ THE INPUT OBJECT'S OWN TYPE FIRST. Go's parameter is a struct and cannot be `null`; a
  // JSON- or config-driven caller here can hand over anything, and reaching through a `null` would
  // throw a bare `TypeError` the caller cannot read `.detail` from — bypassing the closed set
  // entirely, which is the defect the 6.6 review measured on `sweep.ts`'s shared arm.
  if (input === null || typeof input !== 'object') {
    throw new PityError('stream', 'resolvePity takes an object with players, shelf and stream');
  }

  // ⛔ P10 — VALIDATION ORDER IS CONTRACT: stream -> players -> shelf. It is published in the
  // vector's `spec` string, mirrored in all three implementations, and two refusal rows are
  // malformed in TWO WAYS AT ONCE — one on each ADJACENT boundary — so a reordering is observable
  // in the file rather than only in prose. 6-4b's headline defect was three implementations
  // disagreeing about validation order with NO row able to see it; this has now been the headline
  // of two reviews. The STREAM goes first because it is this pass's one injected dependency,
  // exactly as `resolveSpin` checks its `Ladder` before it reads anything else.
  validatePityStream(input.stream);
  const roster = validatePityPlayers(input.players);
  const shelf = validatePityShelf(input.shelf, roster);

  // ── the WINLESS SET (AC1) ──────────────────────────────────────────────────────────────────
  //
  // ⭐ `idleDq` IS THE SNAPSHOT SENSE AND THE TWO FACTS ARE PINNED HERE BECAUSE THIS IS WHERE
  // GETTING THEM BACKWARDS IS EXPENSIVE (0024:584-589, restated on {@link SnapshotPlayer.idleDq}):
  //
  //   (1) TRUE means FULLY DQ'd — the player has AT LEAST ONE approved stat_row and EVERY one of
  //       them is idle. That is the only exclusion FR-28 admits.
  //   (2) A ROSTERED PLAYER WITH ZERO APPROVED ROWS IS `false` WITH ZERO STATS: winless, NOT
  //       disqualified, "and Story 6.7's pity draw must still be able to reach them" — 0024's words.
  //
  // ⛔ THE DQ FILTER IS MEASURED-INERT ON THE REAL CORPUS: 0 of 28 players are fully DQ'd. That is
  // a measured zero recorded in the story's Completion Notes, NOT a reason to delete the filter —
  // it is FR-28's only stated exclusion, and a corpus where somebody idles the whole tournament is
  // one approved demo away.
  //
  // ⭐ P4 — SORTED BEFORE THE FIRST DRAW, NEVER AFTER. The seeded permutation is a function of the
  // input SEQUENCE, so without this the reveal order would depend on the order the caller happened
  // to iterate a database cursor in, and the ceremony would stop being reproducible from the
  // published bundle. Story 6.6's mutation pass measured the twin of this defect surviving because
  // every fixture roster was already sorted, which is why the vector's out-of-byte-lex row was
  // written in the same edit as this line.
  //
  // ⛔ Never `localeCompare`, which is locale-dependent and banned by the pinning suite.
  //
  // ⚠⚠ AND A BARE `.sort()` IS *NOT* BYTE-LEX — THIS COMMENT USED TO CLAIM IT WAS "BY DEFINITION"
  // (6.7 code review). JavaScript's default comparator orders by UTF-16 CODE UNIT. Go's
  // `sort.Strings` orders by UTF-8 BYTE and Python's `sorted` orders by CODE POINT, and those two
  // agree with each other — code-point order and UTF-8 byte order are the same order, by design of
  // UTF-8. All three DISAGREE for supplementary-plane characters: a surrogate pair encodes as
  // `U+D800–DFFF`, which sorts BELOW `U+E000–FFFF` in UTF-16 and ABOVE it in UTF-8.
  // ⭐ WHY IT MATTERS AND WHY IT IS INVISIBLE: a divergent `winless` yields a divergent
  // `revealOrder` while `draws` and `bytesConsumed` come out IDENTICAL, so the byte-accounting gate
  // this whole story rests on structurally cannot see it. `validatePityPlayers` requires only a
  // NON-EMPTY STRING, where `stage2.ts` guards the same field with `STEAMID64_RE = /^[0-9]+$/` and
  // makes the weaker, correct claim ("identical to byte order FOR ASCII DIGITS", `stage2.ts:707`).
  // ⛔ NOT FIXED IN THIS SLICE, AND THE REASON IS RECORDED: `sweep.ts` carries the identical defect,
  // Story 6.6's review already deferred it to 6.9, and this story is scope-barred from touching
  // `sweep.*` — fixing only pity would leave two sibling modules in this directory guaranteeing
  // different things about one field. Home: 6.9, BOTH modules, by carrying `stage2.ts`'s
  // `STEAMID64_RE` into them, which makes the byte-lex claim true by construction.
  // ⚠ Unreachable through the shipped DB (`player.steamid64 check (~ '^[0-9]{17}$')`, 0001:39) —
  // but this module is what 6.9 ships to the BROWSER to re-verify externally-supplied bundle JSON.
  const winless = roster
    .filter((p) => shelfAt(shelf, p.steamid64) === 0 && !p.idleDq)
    .map((p) => p.steamid64)
    .sort();

  // ── the SEEDED REVEAL ORDER (AC2) ──────────────────────────────────────────────────────────
  //
  // ⭐⭐ P3 / DECISION D — THE SHUFFLE VARIANT IS PINNED, NOT "FISHER–YATES". Neither SPINE:221 nor
  // §9.4:427-429 says WHICH shuffle, and "seeded reveal order" is satisfied by any of them — so two
  // honest implementers produce two different ceremonies while both correctly calling their work
  // Fisher–Yates. The variant is DURSTENFELD DESCENDING (Cuatro, 2026-08-07), and a reader can
  // execute it by hand from this comment:
  //
  //   i counts DOWN from order.length-1 to 1 inclusive. The loop body never runs for length <= 1.
  //   n for the step is i+1, so n is strictly decreasing and n is NEVER 1.
  //   j = await uniformInt(stream, n) is in [0, i].
  //   order[i] and order[j] are SWAPPED. j === i is a LEGAL SELF-SWAP and consumes its byte anyway.
  //
  // ⛔ THE REJECTED ALTERNATIVE, RECORDED SO THE NEXT READER DOES NOT RE-OPEN IT: the ascending
  // sweep `for i = 0 to len-2: j = i + uniformInt(s, len-i)`. It is the same family and it produces
  // a DIFFERENT permutation from the same stream; its last step draws n = 1 for zero bytes unless
  // the bound is trimmed, which is an ambiguity the vector would then have to arbitrate instead of
  // the spec. Durstenfeld's per-step n is unambiguous, it never draws n = 1, and it is the form
  // `uniformInt`'s `[1, MAX]` contract fits with no special case.
  //
  // ⭐ P5 — a winless set of length 0 or 1 RESOLVES, IT DOES NOT REFUSE (AC3). The loop bound
  // carries it with no branch at all: there is no `i` to count down from, so there are ZERO draws
  // and ZERO bytes, and the function returns normally. ⚠ `uniformInt(s, 1)` is legal and reads ZERO
  // bytes (`minimalK(1)` gives `k = 0`), so an implementation that DID call it here would be
  // byte-identical to this one — which is precisely why the vector pins the `draws` ARRAY and not
  // only the byte count.
  const order = [...winless];
  const draws: PityDraw[] = [];

  for (let i = order.length - 1; i >= 1; i -= 1) {
    const n = i + 1;
    const { k } = minimalK(BigInt(n));
    const before = input.stream.consumed;

    // ⭐ THE PRIMITIVE IS CALLED VERBATIM, NEVER RE-IMPLEMENTED. `uniformInt`'s rejection loop is
    // already pinned by gate 2's own vector in all three implementations; a second copy of it here
    // — written to count rejections from the inside — would be the single most subtle piece of
    // arithmetic in the engine, duplicated.
    //
    // ⭐ A FAILING PRIMITIVE IS A TYPED REFUSAL IN ALL THREE RUNTIMES (6.7 code review). `pity.go`
    // already wrapped this arm; this module and the Python anchor let a foreign error escape, so the
    // SAME primitive failure produced three different observable surfaces — and this one carried no
    // `.detail`, putting it outside the closed set the whole module is built around. That is the
    // untyped-refusal defect 6-4a measured, one level deeper. This is also the only call site that
    // populates `PityError`'s `cause`, which was dead until now.
    //
    // ⚠ REACHABLE HERE IN A WAY IT IS NOT IN GO: `n` is in `[2, order.length]` so it cannot leave
    // `uniformInt`'s legal bound, but `prng.ts`'s Stream is NOT REENTRANT — two `resolvePity` calls
    // awaited concurrently over one stream both pass validation synchronously (both see
    // `consumed === 0`) and the second then trips the reentrancy guard mid-draw.
    //
    // ⛔⛔ THIS IS THE ONE REFUSAL THAT COSTS BYTES. Every other pity refusal is raised by a
    // VALIDATOR before the first draw, which is what makes "a refusal leaves the stream untouched"
    // true of them — the suites iterate the vector's refusal rows, all of which are pre-draw. This
    // arm fires mid-shuffle with the stream already advanced, so the invariant must NOT be
    // generalised to it. It is not a hole in the tests: it is a property they deliberately do not
    // claim, stated here so nobody widens it.
    let j: number;
    try {
      j = await uniformInt(input.stream, n);
    } catch (err) {
      if (err instanceof PityError) throw err;
      throw new PityError(
        'stream',
        `uniformInt(stream, ${String(n)}) failed mid-shuffle — the stream has already advanced to ` +
          `${String(input.stream.consumed)} and this refusal, unlike every other one here, is NOT free`,
        { cause: err },
      );
    }

    // ⭐ `rejections` IS DERIVED FROM THE BYTE POSITION. A rejection consumes its k bytes and draws
    // k fresh ones, so the step's total is `k * (1 + rejections)` and the count reads straight back
    // out. `k` is never 0 here because `n >= 2` on every step.
    const consumed = input.stream.consumed - before;
    draws.push({ n, k, rejections: consumed / k - 1, value: j });

    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }

  return {
    winless,
    revealOrder: order,
    draws,
    bytesConsumed: input.stream.consumed,
  };
}

/**
 * The shelf lookup, in ONE place. ⚠ `Object.hasOwn`, never a bare `shelf[sid]`: every JavaScript
 * object inherits `toString`, `constructor` and friends, so a player whose steamid64 happened to
 * spell one of them would read a FUNCTION where Go reads its zero value. Go's map lookup has no
 * prototype chain and returns 0; this is what makes the two agree.
 */
function shelfAt(shelf: Readonly<Record<string, number>>, sid: string): number {
  return Object.hasOwn(shelf, sid) ? shelf[sid] : 0;
}

/**
 * P1 and AC4 — the injected stream, checked rather than assumed.
 *
 * ⚠ THE ABSENT ARM IS NOT ROW-REPRESENTABLE. "No stream was supplied" is not a JSON input, so no
 * vector row can produce it; this module's own suite drives it, exactly as
 * `TestStage1PickRefusesANilStream` handles the split for Stage 1. The other two arms ARE
 * row-representable — the vector's refusal rows carry an optional `label` and an optional
 * `pre_consumed`.
 *
 * ⛔ THE PRESENCE TEST IS STRUCTURAL, NOT `!== undefined`, mirroring `sweep.ts`'s ladder guard and
 * Go's typed-nil check. A bare `!== undefined` treats `stream: null` — reachable from any JSON- or
 * config-driven caller — as PRESENT and then reads `null.label`, throwing a bare `TypeError` the
 * caller cannot read `.detail` from.
 */
function validatePityStream(stream: Stream): void {
  if (
    stream === undefined ||
    stream === null ||
    typeof stream !== 'object' ||
    typeof stream.label !== 'string' ||
    typeof stream.consumed !== 'number'
  ) {
    throw new PityError(
      'stream',
      'a Stream must be injected — pity DRAWS its reveal order and will not open a stream of its ' +
        'own, because the seed and the label are the ceremony’s to publish',
    );
  }
  // ⭐ THE CAPABILITY, NOT ONLY THE SHAPE (6.7 code review). Checking `label` and `consumed` and not
  // `read` validated the two fields this pass merely REPORTS and skipped the one it actually USES.
  // A structurally-shaped stand-in — `{ label: PITY_LABEL, consumed: 0 }`, which the checks above
  // all accept — then split the behaviour by winless cardinality: at 0 or 1 members the shuffle loop
  // never runs, so `resolvePity` RESOLVED and published a `bytesConsumed` copied straight off the
  // stand-in, from a stream that had never been keyed by anything; at 2+ it reached `stream.read`
  // and died with a bare `TypeError: stream.read is not a function`, carrying no `.detail` — exactly
  // the failure mode the guard's own docstring says it exists to prevent. Both halves are now one
  // typed refusal.
  // ⚠ Go is immune by its type system (`PityInput.Stream` is `*Stream`), so this guard and the
  // Python anchor's twin are the two runtimes where the check has to be written out.
  if (typeof (stream as { read?: unknown }).read !== 'function') {
    throw new PityError(
      'stream',
      'the injected stream cannot READ — it carries a label and a position but no callable `read`, ' +
        'and a stand-in that is never drawn from would resolve a zero- or one-member set while ' +
        'reporting a byte count it invented',
    );
  }
  // ⭐ THE LABEL, AND ONLY THE PITY LABEL (AC4). A Stage-1 label here would consume bytes that
  // spin's stream expects and move every byte position after it, which is invisible in the result
  // and fatal from the next draw onward. `PITY_LABEL` is Story 6.3's and its VALUE is frozen —
  // moving one byte of it invalidates every ceremony ever published.
  if (stream.label !== PITY_LABEL) {
    throw new PityError(
      'stream',
      `the stream is keyed by ${stream.label}, not ${PITY_LABEL} — pity draws from its OWN ` +
        'domain-separated stream, and a Stage-1 label here would consume bytes a spin expects and ' +
        'move every byte position after it',
    );
  }
  // ⭐ AND IT MUST BE FRESH. `ARCHITECTURE-SPINE.md:216`: "each spin's stream is independent
  // (starts at counter 0)". A partly-drawn stream silently produces a DIFFERENT reveal order from
  // the same seed, which is the class of divergence that stays invisible until 6.9's browser
  // declares a correct ceremony unfair.
  if (stream.consumed !== 0) {
    throw new PityError(
      'stream',
      `the stream has already consumed ${String(stream.consumed)} byte(s) — each stream is ` +
        'independent and starts at counter 0 (SPINE:216), so a partly-drawn one silently produces ' +
        'a different reveal order from the same seed',
    );
  }
}

/**
 * The roster's OWN shape, in full, over the WHOLE list.
 *
 * ⚠ THE DUPLICATE CLAUSE MIRRORS `eligiblePlayers`'s CLAUSE FOR CLAUSE and for the same reason one
 * layer up: a duplicated steamid64 would be counted twice in the winless set — one extra
 * consolation prize — and at 6.8 it becomes a second `award_result_winner` row that trips
 * `unique (spin_id, winner_entry_id)` on a write the producer believed was legal.
 *
 * ⚠ `null` AND STRUCTURALLY-WRONG TYPES STAY REFUSED, AND THAT GUARD IS DELIBERATELY THIS SIDE'S
 * ALONE — the same deliberate, documented split `sweep.ts` records for its own roster guard. Go's
 * parameter is typed, so `players: null` decodes to a nil slice there and RESOLVES; adding a vector
 * row for it would force the other two runtimes to refuse an input their type systems accept.
 */
function validatePityPlayers(
  players: readonly SnapshotPlayer[] | undefined,
): readonly SnapshotPlayer[] {
  // ⚠ AN ABSENT CONTAINER IS THE EMPTY CONTAINER (P11), and `undefined` is the only spelling of
  // absence that resolves. `null` is a caller bug worth reporting in a browser.
  const roster = players === undefined ? [] : players;
  if (!Array.isArray(roster)) {
    throw new PityError('players', 'players must be an array of snapshot rows');
  }
  const seen = new Set<string>();
  for (const p of roster) {
    if (p === null || typeof p !== 'object') {
      throw new PityError('players', 'every player must be an object carrying steamid64');
    }
    // ⚠ `typeof !== 'string'`, NOT `=== ''` — and the difference is the whole point of the guard.
    // Go's mirror gets the omitted-field case for free: a missing `SteamID64` IS `""` there, so one
    // comparison covers both shapes. TypeScript has two distinct shapes and `undefined === ''` is
    // FALSE, so a `=== ''` check would let a row with no id through and put `undefined` into the
    // winless set. The two stub tables LOOKED like mirrors and tested different inputs when the 6.6
    // review measured exactly this on `sweep.ts`.
    if (typeof p.steamid64 !== 'string' || p.steamid64 === '') {
      throw new PityError(
        'players',
        'steamid64 must be a non-empty string — an empty id in the winless set would match no ' +
          'roster row and would be written at 6.8 as a foreign key to nothing',
      );
    }
    if (seen.has(p.steamid64)) {
      throw new PityError(
        'players',
        `duplicate steamid64 ${p.steamid64} — a roster holds one row per player, and a duplicate ` +
          'here is one extra consolation prize',
      );
    }
    seen.add(p.steamid64);
    if (typeof p.idleDq !== 'boolean') {
      throw new PityError('players', `player ${p.steamid64} has a non-boolean idleDq`);
    }
  }
  return roster;
}

/**
 * P6 — the shelf, read and never written.
 *
 * ⚠ ITERATED IN SORTED KEY ORDER, DELIBERATELY. Go's map iteration is RANDOMISED, so a shelf
 * carrying two different defects would report a different MESSAGE on two runs of the same input
 * there. The `detail` would be stable and the transcript would not, which is exactly the class of
 * difference Task 6's mechanical cross-runtime diff exists to catch. All three implementations sort.
 *
 * ⚠ A NEGATIVE COUNT IS A REFUSAL, NOT A CLAMP. `weightAt`'s two-sided guard (Story 6.6) is the
 * precedent and this is the same class: a negative shelf is a caller that has been subtracting, and
 * treating it as 0 would quietly hand a consolation prize to a player who is holding trophies.
 *
 * ⚠ A SHELF KEY NAMING NOBODY ON THE ROSTER IS ALSO A REFUSAL, AND IT IS THE EXACT INVERSE OF W8'S
 * RULE RATHER THAN A CONTRADICTION OF IT. Roster -> shelf, an absent key is the NORMAL shape and
 * means 0. Shelf -> roster, an unknown key means the shelf was accumulated over a DIFFERENT roster
 * than the one being drawn for.
 */
function validatePityShelf(
  shelf: Readonly<Record<string, number>> | undefined,
  roster: readonly SnapshotPlayer[],
): Readonly<Record<string, number>> {
  const table = shelf === undefined ? {} : shelf;
  if (table === null || typeof table !== 'object' || Array.isArray(table)) {
    throw new PityError('shelf', 'shelf must be an object mapping steamid64 to a trophy count');
  }
  const rosterIds = new Set(roster.map((p) => p.steamid64));
  for (const sid of Object.keys(table).sort()) {
    const count = table[sid];
    if (sid === '') {
      throw new PityError('shelf', 'a shelf key must be a non-empty steamid64');
    }
    // ⚠ THE INTEGER CHECK IS THIS SIDE'S ALONE and is deliberately unvectored: Go's
    // `map[string]int` cannot hold a fraction, so `1.5` fails at that runtime's LOADER rather than
    // inside the pass, and no shared row can express an input only one runtime can even represent.
    if (!Number.isInteger(count)) {
      throw new PityError(
        'shelf',
        `shelf[${sid}] must be an integer trophy count, got ${String(count)}`,
      );
    }
    if (count < 0) {
      throw new PityError(
        'shelf',
        `shelf[${sid}] is ${String(count)} — a trophy count is never negative, and clamping it to ` +
          '0 would hand a consolation prize to a player who is holding trophies',
      );
    }
    if (!rosterIds.has(sid)) {
      throw new PityError(
        'shelf',
        `shelf key ${sid} is on no roster row — an ABSENT key is shelf 0 (the normal shape), but ` +
          'an UNKNOWN key means the shelf was accumulated over a different roster',
      );
    }
  }
  return table;
}
