import type { ReactNode } from 'react';
import type {
  RevealAwardView,
  RevealSpinView,
  RevealView,
  RevealWinnerView,
  ShelfState,
} from '@/lib/ceremony/reveal-model';
import { es, premioBloqueado, premioDe } from '@/lib/i18n/es';
import {
  announceSpin,
  awardTitle,
  bucketLabel,
  decidingPhrase,
  OUTCOME_COPY,
  PHASE_COPY,
  winnerName,
} from '@/lib/i18n/ceremony-copy';
import { REVEAL_PHASES } from '@/lib/ceremony/reveal-model';
import styles from './reveal.module.css';

/**
 * The ceremony reveal (Story 6.10, AC1/AC4/AC9/AC10/AC11 — FR-30 / AD-22 / AD-24 / UX-DR32/42).
 *
 * ⭐ A SERVER COMPONENT WITH NO STATE, AND THAT IS DECISION T AND DECISION U AT THE SAME TIME. The
 * whole reveal — order, winners, announced text — is resolved by `lib/ceremony/reveal-model.ts` on
 * the server and rendered here verbatim; the browser computes NOTHING about who won. There is no
 * `useState`, no `matchMedia`, no timer and no `'use client'` in this file. Motion is one `@media`
 * block in `reveal.module.css` decorating a document that is already final, which is why the
 * reduced-motion DOM and the animated DOM are the same bytes (AC3) and why the no-JS render is the
 * accessible baseline rather than a degraded one.
 *
 * ⛔ NO VIEWER-FACING "NEXT SPIN" CONTROL, NOT EVEN DISABLED (FR-34, UX-DR4, EXPERIENCE.md:134). The
 * mock's `Siguiente ›` (`mock-ceremony.html:831-833`) and its operator narration `Mara gira por la
 * mesa` (`:635`) are both absent on purpose: a viewer surface is read-only, and a disabled mutating
 * affordance is on the banned list by name. ⛔ No hover-only affordance either — this is a touch
 * product.
 *
 * ⛔ NO INLINE SPANISH. Every word resolves through `es.reveal` / `lib/i18n/ceremony-copy.ts`
 * (AD-24, `es.ts:6-8` admits no exception), including the glyphs' accessible names.
 */

/** The 36 hairline ticks at 10° (DESIGN.md:271). Decorative — the wheel's meaning is the copy below it. */
const TICKS = Array.from({ length: 36 }, (_, i) => i);

/**
 * The shelf's three states, as TOTAL `Record`s over `ShelfState`.
 *
 * ⛔ TOTAL ON PURPOSE: a fourth shelf state becomes a COMPILE error here rather than silently falling
 * into whichever arm a ternary happened to have. That is the same rule `lib/i18n/ceremony-copy.ts`
 * states for its three maps, applied to the one place that had a ternary instead.
 */
const SLOT_GLYPH: Readonly<Record<ShelfState, string>> = { locked: '·', empty: '✕', won: '★' };

const SLOT_CLASS: Readonly<Record<ShelfState, (isNewest: boolean) => string>> = {
  locked: () => styles.slotLocked ?? '',
  empty: () => styles.slotEmpty ?? '',
  won: (isNewest) => (isNewest ? (styles.slotNewest ?? '') : (styles.slotWon ?? '')),
};

function Wheel() {
  return (
    // ⭐ CODE REVIEW 2026-08-11 — THE WHEEL IS ONE LABELLED, OTHERWISE-SILENT OBJECT. `wheelLabel` was
    // authored and never referenced, so the wheel had NO accessible name while `.hub` was the one
    // child left un-hidden: a screen reader read `Ruleta de premios`, `3·6·0` and `Fuerza en lo que
    // otros ignoran` as three loose strings. The hub is decoration like every other part, so it is
    // hidden like every other part, and the label states what the object IS, once.
    <div className={styles.wheelWrap} role="img" aria-label={es.reveal.wheelLabel}>
      <span className={styles.pointer} aria-hidden="true" />
      <div className={styles.wheel} aria-hidden="true">
        <span className={styles.ringGold} aria-hidden="true" />
        <span className={styles.ringBlue} aria-hidden="true" />
        <span className={styles.sweep} aria-hidden="true" />
        <span className={styles.ticks} aria-hidden="true">
          {TICKS.map((i) => (
            <span key={i} className={styles.tick} />
          ))}
        </span>
        {/*
          ⚠ THE HUB IS NOT BLURRED HERE, AND THE DIFFERENCE FROM THE MOCK IS DELIBERATE. The mock's
          `hub.locked` blur (`:225-229`) belongs to beat 1, BEFORE the ceremony starts — a state this
          surface never renders, because `/ceremonia` shows the reveal only once at least one spin is
          revealed (AC2's k=0 gate). The blurred lock that DOES ship is the locked-position grid
          below, where it sits over a placeholder that never held anything (AD-22).
        */}
        <div className={styles.hub}>
          <span className={styles.hubEyebrow}>{es.reveal.wheelEyebrow}</span>
          <span className={`${styles.hubGlyph} num`}>{es.reveal.hubGlyph}</span>
          <span className={styles.hubSub}>{es.reveal.hubSub}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * The phase rail (AC7).
 *
 * ⭐ ALL THREE STEPS ARE ALWAYS RENDERED. They are the choreography's beats 2, 3 and 5 stated as
 * copy, not as state: a rail that mounted steps as the animation advanced would make the
 * reduced-motion DOM a different document, and AC3 is a claim about the document.
 */
function PhaseRail() {
  return (
    <p className={styles.phaseRail}>
      {REVEAL_PHASES.map((phase) => (
        <span key={phase} className={`${styles.phaseStep} ${styles.phaseDone}`}>
          {PHASE_COPY[phase]}
        </span>
      ))}
    </p>
  );
}

/**
 * The avatar's initial.
 *
 * ⭐ CODE REVIEW 2026-08-11 — THE FIRST CODE POINT IS NOT NECESSARILY A VISIBLE ONE. `checkViewerText`
 * requires `visible > 0` SOMEWHERE in the string, not at index 0, so `' Dex'`, `' Dex'` and
 * `'　Dex'` all pass the guard and used to render a blank gold circle, and a leading combining
 * mark rendered a stray floating accent. Skip anything that is whitespace or a combining mark and
 * take the first character that will actually draw.
 */
function avatarInitial(name: string): string {
  for (const ch of name) {
    if (/^[\s\p{Mn}\p{Me}\p{Cf}]$/u.test(ch)) continue;
    return ch.toUpperCase();
  }
  return '?';
}

/** One winner, as its OWN element (AC9 / DECISION Y) — refused names keep their slot. */
function Winner({ winner, label }: { winner: RevealWinnerView; label: string }) {
  const name = winnerName(winner);
  const shown = winner.displayName !== null;
  // The avatar is decorative and hidden from AT, so the card is announced exactly once, by the live
  // region — the same split `LockedAwards.tsx:50-52` uses for the locked cards.
  const initial = shown ? avatarInitial(name) : '?';
  return (
    <li className={styles.winnerRow}>
      <span className={`${styles.avatar} ${shown ? '' : styles.avatarMissing}`} aria-hidden="true">
        {initial}
      </span>
      {/* ⚠ CLASSED, NOT BARE. An unclassed `<span>` is an INLINE box, so the label and the name laid
          out on one line as `GANADORDex` and `.winnerName`'s `margin-top` was silently inert. */}
      <span className={styles.winnerText}>
        <span className={styles.winnerLabel}>{label}</span>
        <span className={shown ? styles.winnerName : styles.winnerMissing}>{name}</span>
      </span>
    </li>
  );
}

/**
 * One award's card.
 *
 * ⭐ THE ZERO-WINNER ARMS ARE THE DOMINANT ONES AND THEY RENDER FIRST-CLASS. 12 of 12 main spins over
 * the standing corpus resolve `no_eligible_players`: the card carries the award's real identity (its
 * spin revealed it, `0028:436-445`) and one honest line, and it does NOT render an empty winner
 * block, a `0`, or a placeholder that implies a name was withheld.
 */
function AwardCard({ award }: { award: RevealAwardView }) {
  const bucket = bucketLabel(award.bucket);
  const stat = decidingPhrase(award);
  const hasWinners = award.winners.length > 0;

  return (
    <div className={`${styles.catCard} ${styles.catRevealed}`}>
      {bucket === null ? null : <span className={styles.bucketTag}>{bucket}</span>}
      <div className={styles.catName}>{awardTitle(award)}</div>
      {stat === null ? null : <div className={`${styles.catStat} num`}>{stat}</div>}

      {/* A shared trophy says so, once, above its N winners (UX-DR59 — a designed outcome). */}
      {award.isShared ? <p className={styles.outcomeLine}>{OUTCOME_COPY.shared}</p> : null}

      {hasWinners ? (
        <ul className={styles.winners}>
          {/* ⚠ SPANISH NUMBER AGREEMENT — `winnersLabel` was authored and never used, so a shared
              trophy read *Trofeo compartido* over two or more rows each saying the SINGULAR
              *Ganador*. This project already treats agreement as correctness (`categoriasSelladas`
              exists solely to avoid `1 categorías`). */}
          {award.winners.map((winner) => (
            <Winner
              key={winner.rosterEntryId}
              winner={winner}
              label={award.winners.length > 1 ? es.reveal.winnersLabel : es.reveal.winnerLabel}
            />
          ))}
        </ul>
      ) : (
        <p className={styles.outcomeLine}>{OUTCOME_COPY[award.outcome]}</p>
      )}
    </div>
  );
}

function PrizeChip() {
  return (
    <div className={styles.prizeChip}>
      <span className={styles.prizeGlyph} aria-hidden="true">
        ◆
      </span>
      {/* ⚠ CLASSED — see the note in `Winner`. Bare, these two stacked as `Camiseta InclusivSe
          entrega fuera de la app` on one line. */}
      <span className={styles.prizeText}>
        <span className={styles.prizeTitle}>{es.reveal.prizeTitle}</span>
        <span className={styles.prizeSub}>{es.reveal.prizeSub}</span>
      </span>
      <span className={styles.prizeTag}>{es.reveal.prizeTag}</span>
    </div>
  );
}

/** The trophy shelf — one slot per catalog position, gold only where a trophy actually landed. */
function Shelf({ view }: { view: RevealView }) {
  return (
    <section className={styles.section} aria-label={es.reveal.shelfHead}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionTitle}>{es.reveal.shelfHead}</span>
        {/* ⚠ `Premio i de n` counts CATALOG POSITIONS, not spins. `totalSpins` is 40 over the standing
            corpus (12 main + 28 consolation), and "Premio 6 de 40" would be a different, wrong fact. */}
        <span className={`${styles.sectionCount} num`}>{premioDe(view.mainSpins.length, view.awardCount)}</span>
      </div>
      {/*
        ⭐⭐ CODE REVIEW 2026-08-11 — THE SHELF'S THIRD STATE IS BACK, AND THE MEASURED CORPUS IS WHY.
        `SHELF_STATES` has three members and the model computes all three, but the renderer was
        `state === 'won' ? … : slotEmpty` with glyph `'★' : '·'`, so `locked` (has not spun) and
        `empty` (spun, nobody qualified) were pixel-identical. Since 12 of 12 main spins resolve
        `no_eligible_players`, that made the shelf twelve identical dots from the first spin to the
        last — a progress indicator that never moved. ⛔ The zero is SHOWN, not narrated: `✕` says the
        position was decided and went unclaimed, `·` says it is still to come.
      */}
      <div className={styles.shelf}>
        {view.shelf.map((slot) => (
          <span
            key={slot.position}
            className={`${styles.slot} ${SLOT_CLASS[slot.state](slot.isNewest)}`}
            aria-hidden="true"
          >
            {SLOT_GLYPH[slot.state]}
          </span>
        ))}
      </div>
    </section>
  );
}

/**
 * The still-locked positions (AC11).
 *
 * ⛔⛔ SECRECY IS THE ABSENCE OF DATA, NOT A BLUR. This block receives POSITION NUMBERS and nothing
 * else — there is no prop through which an award's identity could arrive, exactly as
 * `LockedAwards.tsx:7-12` states for the leaderboards block. The 7px blur sits over a decorative
 * placeholder that never held anything; AD-22 exists precisely to prevent *"CSS blur being the only
 * secrecy"*, which view-source, DevTools or a screen reader defeat instantly.
 */
function LockedPositions({ positions, total }: { positions: readonly number[]; total: number }) {
  if (positions.length === 0) return null;
  return (
    <section className={styles.section} aria-label={es.reveal.lockedLandmark}>
      <ul className={styles.lockRows}>
        {positions.map((position) => (
          <li key={position} className={styles.lockRow}>
            {/* The AC4 accessible name, verbatim (em dash) — the visual below is decorative. */}
            <span className={styles.srOnly}>{premioBloqueado(position, total)}</span>
            <span className={`${styles.lockNum} num`} aria-hidden="true">
              {premioDe(position, total)}
            </span>
            <span className={styles.redact} aria-hidden="true" />
            <span className={styles.lockGlyph} aria-hidden="true">
              ⬚
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The consolation round (FR-28) — a spotlight, ⛔ never a participation-trophy pat. */
function PityRound({ view }: { view: RevealView }) {
  const pity = view.pity;
  if (pity === null) return null;
  // ⭐⭐ CODE REVIEW 2026-08-11 — THE PROMISE IS ONLY MADE WHERE IT IS KEPT. The guard used to be
  // `pity === null` alone, but the model returns non-null whenever any pity SPIN exists, regardless
  // of winners — so a revealed pity spin whose `award_result` rows carried no winners rendered
  // *"Nadie se va con las manos vacías"* over an EMPTY list. The one place the copy makes an
  // unconditional promise was the one place its content was unguarded. ⛔ No new copy is invented:
  // the round still announces itself, it simply does not promise what it cannot show.
  const hasWinners = pity.winners.length > 0;
  return (
    <section className={styles.pity} aria-label={es.reveal.pityRound}>
      <span className={styles.pityTitle}>{es.reveal.pityRound}</span>
      {hasWinners ? <span className={styles.pityPromise}>{es.reveal.pityPromise}</span> : null}
      <span className={styles.pitySub}>{es.reveal.pitySub}</span>
      {hasWinners ? (
        <ul className={styles.pityNames}>
          {pity.winners.map((winner, i) => (
            // ⚠ COMPOSITE KEY. `rosterEntryId` alone is not unique across this list: it is flattened
            // over ALL pity spins, and the uniqueness constraints are per `award_result` and per
            // `spin` (`0025:222,247`), so one player winning a consolation prize in two pity spins
            // produced duplicate React keys.
            <li
              key={`${winner.rosterEntryId}-${i}`}
              className={`${styles.pityName} ${winner.displayName === null ? styles.pityNameMissing : ''}`}
            >
              {winnerName(winner)}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Every revealed MAIN spin, ascending — the published order, restated, ⛔ never re-sorted. */
function Record({ view }: { view: RevealView }) {
  if (view.mainSpins.length === 0) return null;
  return (
    <section className={styles.section} aria-label={es.reveal.recordLandmark}>
      <ol className={styles.record}>
        {view.mainSpins.map((spin) => (
          <li key={spin.spinIndex} className={styles.recordItem}>
            <span className={`${styles.recordCounter} num`}>{premioDe(spin.position, view.awardCount)}</span>
            {spin.awards.map((award) => (
              <AwardCard key={award.awardResultId} award={award} />
            ))}
          </li>
        ))}
      </ol>
    </section>
  );
}

export interface CeremonyRevealProps {
  readonly view: RevealView;
  /**
   * The persistent verify strip, injected as a child (AC1/AC2).
   *
   * ⭐ IT IS A PROP RATHER THAN AN IMPORT SO THIS COMPONENT CANNOT MOUNT ONE. `page.tsx` owns the k=0
   * gate; if the strip were constructed here, a future edit could render it on a surface that has
   * nothing to verify — which is exactly the vacuous affordance 6.9b's headline finding removed.
   */
  readonly verifyStrip: ReactNode;
}

export function CeremonyReveal({ view, verifyStrip }: CeremonyRevealProps) {
  const newest: RevealSpinView | undefined = view.spins[view.spins.length - 1];
  // Defensive only: `fetchRevealedCeremony` refuses an empty ceremony with `no_revealed_spins`, so
  // this branch is unreachable through the page. Rendering nothing is the fail-closed direction.
  if (newest === undefined) return null;

  // AC10 — name + bucket + deciding stat, per revealed award of the newest spin. ⚠ The punctuation
  // lives in `announceSpin` (a `lib/` decision with its own assertion), not here: the old
  // `join('. ')` added a second full stop to outcome copy that already ended in one.
  const announced = announceSpin(newest.awards);

  const isPity = newest.kind === 'pity';
  // ⭐⭐ CODE REVIEW 2026-08-11 — THE STAGE ONLY ANIMATES WHEN THERE IS SOMETHING TO ANIMATE.
  // `.newest` used to be applied unconditionally, on every render, for every spin kind. Two
  // consequences, both measured: a viewer opening a LONG-FINISHED ceremony sat through a 4.6 s wheel
  // spin over a card `flipIn`'s backwards fill held invisible (`complete` was computed and read by
  // nobody); and because 28 of the 40 spins over the standing corpus are consolation spins, 70% of
  // the ceremony spun a category wheel to reveal the same constant string. A pity spin chooses no
  // category, so it gets no Stage-1 wheel and no Fase-1 copy.
  const animated = !view.complete && !isPity;
  // A revealed spin with no `award_result` rows yet (the read racing the insert) has nothing to
  // stage — better no stage than 4.6 s of wheel over an empty column.
  const hasStage = newest.awards.length > 0;

  return (
    <section className={styles.reveal} aria-label={es.reveal.landmark} data-ceremony-wide="">
      {/*
        ⚠ ALWAYS RENDERED, FIRST CHILD, AND A LEAF. 6.9b's exact form (`VerifyStrip.tsx:86-93`): a
        live region inserted at the moment it gains content is not announced by most screen readers.
        ⛔ IT IS A LEAF ON PURPOSE (AC10): the verify strip carries its OWN `aria-live` region, and
        nesting one live region inside another makes both announce unpredictably. Nothing below is a
        descendant of this element.
      */}
      <div className={styles.srOnly} aria-live="polite" role="status">
        {announced}
      </div>

      <span className={styles.bannerEyebrow}>{es.reveal.bannerEyebrow}</span>

      {/*
        ⭐⭐ `key` IS THE NEWEST SPIN INDEX AND IT IS LOAD-BEARING — BUT IT NO LONGER SITS ON THE
        STAGE. A `spin.reveal` nudge calls `router.refresh()`, which reconciles this tree IN PLACE;
        without a changing key React keeps the same DOM node and the CSS animation — which runs once
        on mount — never replays for the new spin.

        ⛔⛔ CODE REVIEW 2026-08-11, ALL THREE REVIEW LAYERS INDEPENDENTLY: the key used to be on the
        `.stage` wrapper, which CONTAINED THE VERIFY STRIP. `VerifyStrip` is a `'use client'` island
        holding `busy` and `report` in `useState`, so every one of the ceremony's 40 reveals unmounted
        it: a viewer's verification RESULT was wiped, an in-flight `Verificar la ceremonia` was
        discarded mid-compute, keyboard focus on the button dropped to `<body>`, and the strip's own
        `aria-live` region was re-inserted — the precise failure that region's always-mounted form
        exists to prevent. AC1's word is *persistent*; the strip was the least persistent thing here.

        ⭐ THE KEY NOW SITS ON THE TWO ANIMATED COLUMNS AND ONLY THEM. The wheel column and the award
        column remount and replay; the third column — prize chip and strip — is reconciled in place
        and never unmounts. ⚠ Under `prefers-reduced-motion` the remount is invisible either way,
        because there is no animation to replay and the content was already final.
      */}
      {hasStage ? (
        <div className={`${styles.stage} ${animated ? styles.newest : ''}`}>
          <div key={`wheel-${newest.spinIndex}`} className={`${styles.stageCol} ${styles.wheelCol}`}>
            {isPity ? null : (
              <>
                <Wheel />
                <PhaseRail />
                <p className={styles.oneTrophy}>
                  <span className={styles.pin} aria-hidden="true">
                    FR-26
                  </span>
                  {es.reveal.oneTrophy}
                </p>
              </>
            )}
          </div>

          <div key={`awards-${newest.spinIndex}`} className={styles.stageCol}>
            {newest.awards.map((award) => (
              <AwardCard key={award.awardResultId} award={award} />
            ))}
          </div>

          {/* ⛔ NO `key` ON THIS COLUMN. See the block above — this is where the strip lives. */}
          <div className={styles.stageCol}>
            <PrizeChip />
            {verifyStrip}
          </div>
        </div>
      ) : (
        <div className={styles.stage}>
          <div className={styles.stageCol} />
          <div className={styles.stageCol} />
          <div className={styles.stageCol}>
            <PrizeChip />
            {verifyStrip}
          </div>
        </div>
      )}

      <Shelf view={view} />
      <Record view={view} />
      <LockedPositions positions={view.lockedPositions} total={view.awardCount} />
      <PityRound view={view} />
    </section>
  );
}
