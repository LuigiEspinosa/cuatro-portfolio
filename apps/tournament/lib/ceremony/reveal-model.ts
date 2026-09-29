import type { NameRefusal, RevealedAward, RevealedCeremony, RevealedSpin } from './reveal-read';
import type { SafeTextRefusal } from '@/lib/i18n/safe-text';

/**
 * The pure view-model of a revealed ceremony (Story 6.10, AC5/AC7/AC8/AC9/AC12).
 *
 * ⭐ DECISION X — EVERY TESTABLE DECISION IS A `lib/` MODULE AND THE TSX IS GLUE, and that is FORCED
 * rather than preferred: `vitest.config.ts:15-18` is `environment: 'node'` with
 * `include: ['lib/**` + `/*.test.ts']`, so nothing under `app/` is collected and a `.tsx` is not
 * matched even here. A component test beside the wheel would be DOUBLY invisible — no jsdom, no
 * collection — and would report a silent zero. The precedents are `lib/realtime/status.ts` (reducer
 * tested, island glue) and `lib/i18n/verify-copy.ts` (map tested, island indexes it).
 *
 * ⛔ NO SPANISH IN THIS FILE. It emits MACHINE tokens; `lib/i18n/ceremony-copy.ts` is the one place
 * they meet Spanish, exactly as `lib/roulette/verify.ts` emits `VerifyOutcome` and
 * `lib/i18n/verify-copy.ts` maps it. ⛔ No clock, no `Math.random`, no `Intl`, no locale formatting:
 * this model must produce identical bytes on the server and in a test, forever.
 *
 * ⭐⭐ DECISION U — THIS IS WHERE REDUCED-MOTION PARITY IS WON, BY OMISSION. There is no motion
 * parameter on any function below and there is nowhere to put one: the model resolves EVERY revealed
 * spin, so the document the server renders is already the final state on both paths. Motion is a
 * client-only CSS layer applied OVER an already-correct document. ⛔ A reduced-motion implementation
 * that re-derives, defers, re-orders or withholds anything has failed AC3 even if the pixels look
 * right — and `reduced-motion.ts` exists to make that claim measurable rather than asserted.
 *
 * ⭐ THE ZERO-WINNER BRANCHES ARE FIRST-CLASS, NOT EDGES. Over the standing corpus 12 of 12 main
 * spins resolve `no_eligible_players` and 28 of 28 players take a consolation, because 0 of 28 clear
 * the FR-21 floors — and those bytes are cryptographically committed. A model that treated them as
 * the exceptional path would be a model of a ceremony that does not exist.
 */

/**
 * The outcome vocabulary, as a runtime `as const`.
 *
 * ⛔⛔ IT IS ASSERTED AGAINST `OUTCOME_KINDS` (`lib/roulette/stage2.ts:320`) BY EXACT EQUALITY, and
 * that pin is the whole reason it is written out here rather than imported: `OUTCOME_KINDS` is typed
 * `readonly string[]`, so it yields no literal union and cannot type a total `Record`. A literal
 * array copied beside its own assertion is the defect this project has shipped EIGHT times
 * (`6-9b:576-588`); the counterpart here is RUNTIME-DERIVED from the engine's own export, so the two
 * cannot drift without the suite reddening.
 *
 * ⚠ `tie` IS IN THE SET AND CAN NEVER ARRIVE. `award_result_outcome_kind_not_tie` (`0027:268`)
 * refuses a persisted `tie` because the FR-29 ladder resolves every tie before it reaches a row. It
 * is modelled LOUDLY rather than dropped — the `M19` precedent (`deferred-work.md:396`): falling
 * through would render an award that tied as though nobody qualified.
 */
export const REVEAL_OUTCOMES = ['winner', 'tie', 'no_eligible_players', 'no_awardable_value', 'shared'] as const;

export type RevealOutcome = (typeof REVEAL_OUTCOMES)[number];

/**
 * The three steps of ONE spin's choreography (EXPERIENCE.md:162-173 beats 2, 3 and 5).
 *
 * ⚠ *Bloqueado* is NOT here. EXPERIENCE.md:119 lists four spin states, but a LOCKED spin has no row
 * to model — `spin_viewer_read` makes it ABSENT, not blanked — so the locked state is the
 * `lockedPositions` grid below, which is built from a COUNT and never from a hidden row.
 */
export const REVEAL_PHASES = ['stage1', 'stage2', 'revealed'] as const;

export type RevealPhase = (typeof REVEAL_PHASES)[number];

/** What one shelf slot says about one award position. */
export const SHELF_STATES = ['locked', 'empty', 'won'] as const;

export type ShelfState = (typeof SHELF_STATES)[number];

export interface RevealWinnerView {
  readonly rosterEntryId: number;
  /** `null` ⇒ render the per-element fallback and keep the slot (AC9). */
  readonly displayName: string | null;
  readonly nameRefusal?: NameRefusal;
}

export interface RevealAwardView {
  readonly awardResultId: number;
  readonly awardId: number | null;
  readonly name: string | null;
  readonly nameRefusal?: SafeTextRefusal;
  readonly bucket: string | null;
  readonly decidingStat: string | null;
  /** The stored digits, verbatim. ⛔ Display only, never rounded, never locale-formatted. */
  readonly decidingText: string | null;
  readonly outcome: RevealOutcome;
  readonly isPity: boolean;
  readonly isShared: boolean;
  /** ⛔ ABSENT, never `0` — 6.9a DECISION J, carried through the model unchanged. */
  readonly ladderExitStep?: number;
  readonly winners: readonly RevealWinnerView[];
}

export interface RevealSpinView {
  readonly spinIndex: number;
  readonly kind: string;
  /** 1-based position among MAIN spins — the `i` of `Premio i de n`. `null` on a pity spin. */
  readonly position: number | null;
  readonly awards: readonly RevealAwardView[];
  /** The last revealed spin: the one the choreography plays for. Presentation only. */
  readonly isNewest: boolean;
}

/**
 * A MAIN spin — one that competes for a catalog award and therefore holds a position.
 *
 * ⚠ THE NARROWED TYPE EXISTS SO THE RENDERER NEVER CASTS. `position` is `number | null` on the base
 * view because a pity spin genuinely has none, and `Array.prototype.filter` does not narrow; a
 * `spin.position as number` at the call site would be the reviewer's cue that the model is lying
 * about its own shape.
 */
export type MainSpinView = RevealSpinView & { readonly position: number };

export interface ShelfSlotView {
  readonly position: number;
  readonly state: ShelfState;
  readonly isNewest: boolean;
}

export interface PityView {
  readonly spins: readonly RevealSpinView[];
  /** Every consolation winner, in published reveal order, flattened for the announcement. */
  readonly winners: readonly RevealWinnerView[];
}

export interface RevealView {
  /** Ascending by `spin_index` — the published order, restated, never re-sorted. */
  readonly spins: readonly RevealSpinView[];
  readonly mainSpins: readonly MainSpinView[];
  readonly pity: PityView | null;
  readonly shelf: readonly ShelfSlotView[];
  /** The main positions still behind `{components.blurred-lock}` — a COUNT, never a hidden row. */
  readonly lockedPositions: readonly number[];
  /**
   * The `n` of `Premio i de n`, RECONCILED — see `buildRevealView`. ⛔ Not `input.awardCount`
   * verbatim: the catalog count and the revealed rows come from two different reads and can disagree.
   */
  readonly awardCount: number;
  /**
   * The ceremony has run to completion.
   *
   * ⭐ CODE REVIEW 2026-08-11 — THIS FIELD IS LOAD-BEARING AND USED TO BE DEAD. It was computed,
   * threaded through `RevealModelInput` and read by nobody, which is why `.newest` was applied
   * unconditionally: a viewer opening a long-finished ceremony sat through a 4.6 s wheel spin over a
   * card `flipIn`'s backwards fill held invisible. The renderer now gates the animation class on it.
   */
  readonly complete: boolean;
}

export interface RevealModelInput {
  readonly ceremony: RevealedCeremony;
  /** `award_catalog_count` — the `n` of `Premio i de n` (`lib/awards/read.ts`, the only pre-reveal fact). */
  readonly awardCount: number;
  readonly complete: boolean;
}

/** Narrow an `outcome_kind` that arrived from the database, or fall back LOUDLY. */
function outcomeOf(raw: string): RevealOutcome {
  // ⚠ `includes` over the runtime array rather than a `Set` built beside it: one source, no second
  // list to forget. An unrecognised kind cannot reach here through the CHECK constraint, and if it
  // ever does it is reported as the unresolved arm rather than silently rendered as a win.
  return (REVEAL_OUTCOMES as readonly string[]).includes(raw) ? (raw as RevealOutcome) : 'tie';
}

function awardView(award: RevealedAward): RevealAwardView {
  return {
    awardResultId: award.awardResultId,
    awardId: award.awardId,
    name: award.name,
    ...(award.nameRefusal === undefined ? {} : { nameRefusal: award.nameRefusal }),
    bucket: award.bucket,
    decidingStat: award.decidingStat,
    // ⚠ THE RATE PAIR IS NOT DIVIDED. `0024:690-691` refuses to divide because a numeric quotient is
    // not reproducible across two runtimes; a viewer sees the pair as stored. `deciding_value` (the
    // volume form) and the pair are mutually exclusive by `award_result_deciding_pair_complete`.
    decidingText:
      award.decidingValue !== null
        ? award.decidingValue
        : award.decidingNum !== null && award.decidingDen !== null
          ? `${award.decidingNum}/${award.decidingDen}`
          : null,
    outcome: outcomeOf(award.outcomeKind),
    isPity: award.isPity,
    isShared: award.isShared,
    ...(award.ladderExitStep === undefined ? {} : { ladderExitStep: award.ladderExitStep }),
    winners: award.winners.map((w) => ({
      rosterEntryId: w.rosterEntryId,
      displayName: w.displayName,
      ...(w.nameRefusal === undefined ? {} : { nameRefusal: w.nameRefusal }),
    })),
  };
}

/**
 * Shape a revealed ceremony into everything the surface renders.
 *
 * ⛔ TOTAL AND ORDER-PRESERVING. `spins` arrives ascending by `spin_index` from the reader and is
 * NEVER re-sorted here: *"the published spin order IS the reveal order (UX-DR32/42)"*
 * (`lib/ceremony/reveal.ts:102`), and re-deriving it client-side is the single most dangerous thing
 * this story could get wrong.
 */
export function buildRevealView(input: RevealModelInput): RevealView {
  const { ceremony, awardCount } = input;
  const lastIndex = ceremony.spins.length - 1;

  let mainSeen = 0;
  const spins: RevealSpinView[] = ceremony.spins.map((spin: RevealedSpin, i) => {
    const isMain = spin.kind !== 'pity';
    const position = isMain ? ++mainSeen : null;
    return {
      spinIndex: spin.spinIndex,
      kind: spin.kind,
      position,
      awards: spin.awards.map(awardView),
      isNewest: i === lastIndex,
    };
  });

  const mainSpins = spins.filter((s): s is MainSpinView => s.position !== null);
  const pitySpins = spins.filter((s) => s.position === null);

  // ⭐⭐ CODE REVIEW 2026-08-11 — THE TWO COUNTS ARE RECONCILED RATHER THAN TRUSTED, because they come
  // from DIFFERENT READS. `awardCount` is a live `award_catalog_count` over the CURRENT catalog;
  // `mainSeen` counts the revealed rows. They can disagree in both directions and both used to be
  // rendered as fact: `awardCount === 0` (accepted by `lib/awards/read.ts`, which refuses only `< 0`
  // and `> 64`) printed `Premio 12 de 0`, and a catalog re-curated mid-ceremony printed
  // `Premio 13 de 12` while DROPPING position 13 off the shelf entirely — a won trophy with no slot.
  // ⛔ Taking the max is the fail-visible direction: no revealed position is ever unrepresentable,
  // and `i` can never exceed `n`.
  const positions = Math.max(awardCount, mainSeen);

  // ⭐ THE SHELF IS BUILT FROM THE RECONCILED COUNT, NOT FROM THE ROWS. A position with no revealed
  // spin is `locked`, and it carries NOTHING about the award that will land there — the identity is
  // absent, not blurred (AD-22; `LockedAwards.tsx:7-12` is the house form). ⛔ 6.9a DECISION B's rule
  // applies to this grid too: a placeholder that encodes cardinality-by-position is a defect.
  const shelf: ShelfSlotView[] = [];
  for (let position = 1; position <= positions; position++) {
    const spin = mainSpins.find((s) => s.position === position);
    shelf.push({
      position,
      state: spin === undefined ? 'locked' : spin.awards.some((a) => a.winners.length > 0) ? 'won' : 'empty',
      isNewest: spin !== undefined && spin.isNewest,
    });
  }

  const lockedPositions: number[] = [];
  for (let position = mainSeen + 1; position <= positions; position++) lockedPositions.push(position);

  return {
    spins,
    mainSpins,
    pity:
      pitySpins.length === 0
        ? null
        : { spins: pitySpins, winners: pitySpins.flatMap((s) => s.awards.flatMap((a) => a.winners)) },
    shelf,
    lockedPositions,
    awardCount: positions,
    complete: input.complete,
  };
}

/**
 * The canonical statement of everything a viewer must receive IDENTICALLY on both motion paths.
 *
 * ⭐⭐ THIS IS AC3's ORACLE, AND IT IS WHY AC3 IS PROVABLE RATHER THAN ASSERTED. DECISION U says the
 * rendered document is byte-identical with and without `prefers-reduced-motion`; a claim like that is
 * worth exactly as much as the thing that checks it. AC13 captures the rendered DOM under CDP
 * `Emulation.setEmulatedMedia` on both paths and diffs them character-for-character; this function is
 * the same comparison one layer up, where a unit test can reach it.
 *
 * ⛔ IT DELIBERATELY CARRIES ORDER, IDENTITY AND OUTCOME AND NOT ONE PRESENTATIONAL FACT. `isNewest`,
 * shelf state and the locked grid are ABSENT: they are decoration, and folding them in would make the
 * key sensitive to things AC3 explicitly permits to differ.
 */
export function revealParityKey(view: RevealView): string {
  const lines: string[] = [];
  for (const spin of view.spins) {
    lines.push(`spin\t${spin.spinIndex}\t${spin.kind}\t${spin.position ?? ''}`);
    for (const award of spin.awards) {
      lines.push(
        [
          'award',
          spin.spinIndex,
          award.awardResultId,
          award.outcome,
          award.awardId ?? '',
          award.name ?? `<${award.nameRefusal ?? 'none'}>`,
          award.bucket ?? '',
          award.decidingStat ?? '',
          award.decidingText ?? '',
          award.isPity ? 'pity' : 'main',
          award.isShared ? 'shared' : 'single',
          award.ladderExitStep ?? '',
        ].join('\t'),
      );
      for (const winner of award.winners) {
        lines.push(
          `winner\t${award.awardResultId}\t${winner.rosterEntryId}\t${winner.displayName ?? `<${winner.nameRefusal ?? 'none'}>`}`,
        );
      }
    }
  }
  return lines.join('\n');
}
