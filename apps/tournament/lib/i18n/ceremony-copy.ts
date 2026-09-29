import { es, ganadoresAnunciados, premioAnunciado, valorDecidido } from './es';
import type { RevealAwardView, RevealOutcome, RevealPhase, RevealWinnerView } from '@/lib/ceremony/reveal-model';

/**
 * The one place the reveal's MACHINE vocabulary meets Spanish (Story 6.10, AC7 — AD-24).
 *
 * ⭐ THE SHAPE IS `lib/i18n/verify-copy.ts`'s, DELIBERATELY AND FOR ITS STATED REASON. `verify-copy`
 * exists because `lib/roulette/verify.ts` must stay free of Spanish and the viewer must carry no
 * inline literal, so something has to join them — and if that something lives under `app/` it is
 * UNTESTABLE, since `vitest.config.ts:17` collects only test files under `lib`. Here the
 * exhaustiveness below is a GATED ASSERTION instead of a live-QA hope.
 *
 * ⛔ THE THREE MAPS ARE TOTAL `Record`s, NOT LOOKUPS WITH A FALLBACK. A sixth outcome kind, a fourth
 * phase or a fifth bucket is a COMPILE error. ⚠ `bucketLabel` and `statNoun` still exist beside the
 * maps because the bucket and the deciding stat arrive from the DATABASE as `text`: a value outside
 * the CHECK's closed set cannot be typed away, so it resolves to `null` and the caller OMITS the
 * segment rather than rendering an empty one or guessing.
 */

/** The phase rail, in order. ⚠ EM DASH inside `phase1`/`phase2` — not the mock's middot. */
export const PHASE_COPY: Readonly<Record<RevealPhase, string>> = {
  stage1: es.reveal.phase1,
  stage2: es.reveal.phase2,
  revealed: es.reveal.phaseRevealed,
};

/**
 * What each outcome SAYS on the card.
 *
 * ⭐ `no_eligible_players` IS THE DOMINANT ONE, NOT AN EDGE — 12 of 12 main spins over the standing
 * corpus. Its line is one quiet honest sentence (Cuatro, 2026-08-11): the ceremony does not pretend
 * somebody won, and it does not editorialise about the floors either. *Measure zeros, never narrate
 * them* — including in a reveal.
 * ⚠ `winner` and `shared` resolve to LABELS rather than sentences, because on those two arms the
 * card's statement is the winner's NAME and this string is only its eyebrow.
 */
export const OUTCOME_COPY: Readonly<Record<RevealOutcome, string>> = {
  winner: es.reveal.winnerLabel,
  shared: es.reveal.sharedTrophy,
  no_eligible_players: es.reveal.noEligiblePlayers,
  no_awardable_value: es.reveal.noAwardableValue,
  tie: es.reveal.unresolvedTie,
};

export type AwardBucket = keyof typeof es.bucket;
export type DecidingStat = keyof typeof es.decidingStat;

/**
 * The closed sets, DERIVED FROM THE MAPS THEY DESCRIBE rather than written out beside them.
 *
 * ⛔ This is the eight-times-shipped defect (`6-9b:576-588`) closed by construction: there is no
 * second literal array that could disagree with `es.bucket` / `es.decidingStat`, because the array
 * IS their key list. The suite still asserts the counts, so a key silently deleted from `es.ts`
 * reddens rather than shrinking a "closed set" that quietly stopped being closed.
 */
export const AWARD_BUCKETS = Object.keys(es.bucket) as readonly AwardBucket[];
export const DECIDING_STATS = Object.keys(es.decidingStat) as readonly DecidingStat[];

/** `award.bucket` → `Habilidad` / `Clutch` / `Rarezas del demo` / `Comedia`; `null` for anything else. */
export function bucketLabel(raw: string | null): string | null {
  if (raw === null) return null;
  return Object.hasOwn(es.bucket, raw) ? es.bucket[raw as AwardBucket] : null;
}

/** `award.deciding_stat` → its Spanish noun; `null` for a key this module has not been taught. */
export function statNoun(raw: string | null): string | null {
  if (raw === null) return null;
  return Object.hasOwn(es.decidingStat, raw) ? es.decidingStat[raw as DecidingStat] : null;
}

/**
 * The award's rendered title.
 *
 * ⚠ THE THREE CASES ARE DIFFERENT FACTS AND STAY APART. A PITY result has `awardId === null` and
 * genuinely has no category (`0026:104-113`) so it takes the round's own name; a REFUSED name is one
 * that exists and cannot be shown safely; and a name that is present is rendered verbatim. ⛔ None of
 * the three may borrow `es.award.revealAtCeremony`, which is what made the 12 zero-winner feed cards
 * announce that an already-revealed award had not been revealed (`deferred-work.md:369`).
 */
export function awardTitle(award: RevealAwardView): string {
  if (award.name !== null) return award.name;
  if (award.awardId === null) return es.reveal.pityRound;
  return es.reveal.awardUnnamed;
}

/** One winner's rendered name — the per-element fallback AC9 requires (⛔ refused, never dropped). */
export function winnerName(winner: RevealWinnerView): string {
  if (winner.displayName !== null) return winner.displayName;
  // ⚠ TWO DISTINCT FACTS, TWO DISTINCT STRINGS. `unresolved` is the roster's active-only policy
  // hiding a player REMOVED after playing — `es.unknownPlayer` is the shipped word for exactly that
  // (`lib/feed/model.ts:76-79`) — and anything else is the text guard refusing a name that exists.
  return winner.nameRefusal === 'unresolved' ? es.unknownPlayer : es.reveal.nameUnavailable;
}

/**
 * `21 bajas` / `73/100 ADR` — the deciding value, or `null` when the outcome had none.
 *
 * ⛔ DISPLAY ONLY (SOLUTION-DESIGN:219). The digits are the stored digits: no rounding, no `Intl`, no
 * division of the AD-19 rate pair (`0024:690-691` refuses to divide because a quotient is not
 * reproducible across two runtimes).
 */
export function decidingPhrase(award: RevealAwardView): string | null {
  if (award.decidingText === null) return null;
  const noun = statNoun(award.decidingStat);
  return noun === null ? award.decidingText : valorDecidido(award.decidingText, noun);
}

/**
 * The `aria-live` announcement for ONE award reveal (AC10) — EXPERIENCE.md:145's pattern.
 *
 * `Máquina de Frags — Habilidad — 21 bajas — Dex`, with every segment that does not apply DROPPED
 * rather than rendered as a bare dash. ⭐ On the corpus's dominant card the third segment is the
 * OUTCOME sentence instead of a stat, because there is no stat: a screen-reader user hears *"Máquina
 * de Frags — Habilidad — Nadie alcanzó el mínimo."* rather than a name, a bucket and silence.
 */
/**
 * The three outcome arms whose copy is a SENTENCE and may therefore stand in the announcement's
 * statement slot.
 *
 * ⭐⭐ CODE REVIEW 2026-08-11 — `winner` AND `shared` ARE DELIBERATELY ABSENT, and their absence is the
 * fix. `OUTCOME_COPY` maps them to bare LABELS (`Ganador`, `Trofeo compartido`) — this module's own
 * header says so: *"on those two arms the card's statement is the winner's NAME and this string is
 * only its eyebrow."* `announceAward` used to substitute that eyebrow wherever there was no deciding
 * stat, which is EVERY pity result — 28 of the 40 spins over the measured corpus — so a screen reader
 * heard *"Ronda de consolación — Ganador — Mara"*. ⛔ Derived from `OUTCOME_COPY`'s own keys minus the
 * two label arms, so a sixth outcome cannot quietly join the sentence set.
 */
export const OUTCOME_SENTENCE_ARMS: readonly RevealOutcome[] = (Object.keys(OUTCOME_COPY) as RevealOutcome[]).filter(
  // ⚠ ANNOTATED `readonly RevealOutcome[]` DELIBERATELY. Without it TypeScript narrows the result of
  // `filter` to the three surviving literals, and `.includes(award.outcome)` — whose argument is the
  // full five-member union — stops compiling. The set is a RUNTIME subset of a full-union array, not
  // a narrower type.
  (o) => o !== 'winner' && o !== 'shared',
);

export function announceAward(award: RevealAwardView): string {
  const stat = decidingPhrase(award);
  const winners = award.winners.map(winnerName);
  // ⚠ THE STATEMENT SLOT IS THE STAT, OR THE OUTCOME SENTENCE, OR NOTHING — never a label. When the
  // award HAS winners their names are the statement, so an eyebrow there is noise at best.
  const statement =
    stat ?? (OUTCOME_SENTENCE_ARMS.includes(award.outcome) ? OUTCOME_COPY[award.outcome] : '');
  return premioAnunciado(
    awardTitle(award),
    bucketLabel(award.bucket) ?? '',
    statement,
    winners.length === 0 ? '' : ganadoresAnunciados(winners),
  );
}

/**
 * Every award of ONE spin, as the single string the `aria-live` region carries (AC10).
 *
 * ⭐ CODE REVIEW 2026-08-11 — THE PUNCTUATION LIVES HERE, IN `lib/`, RATHER THAN IN THE TSX. The
 * renderer used to `join('. ')`, and three of the five `OUTCOME_COPY` values already end in `.`, so a
 * multi-award spin announced *"…Nadie alcanzó el mínimo.. Muralla — …"*. A sentence that already
 * terminates is not given a second full stop. ⛔ DECISION X: this is a testable decision, so it is a
 * `lib/` function with its own assertion, not glue.
 */
export function announceSpin(awards: readonly RevealAwardView[]): string {
  return awards
    .map(announceAward)
    .filter((s) => s.length > 0)
    .reduce((acc, next) => (acc.length === 0 ? next : `${acc}${acc.endsWith('.') ? '' : '.'} ${next}`), '');
}
