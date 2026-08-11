import Link from 'next/link';
import type { CardModel } from '@/lib/feed/model';
import { es } from '@/lib/i18n/es';
import styles from '../feed.module.css';

/**
 * The timeline (Story 5.6). Renders the resolved, ordered `CardModel[]` verbatim — rail + colored
 * node + a full-card tap target per entry (AC1–AC4, AC7). The list is stable + `id`-keyed so Story
 * 5.8 can prepend without wiping scroll (AC8). A Server Component: no client state, no data work.
 *
 * The card renderer switches on all THREE entry types by construction (AC2). Only `match_result`
 * populates today; `bracket_advance`/`award_reveal` branches exist for 5.8 / Epic 6 — do NOT remove.
 */
export function TimelineFeed({ cards, dayHeader }: { cards: CardModel[]; dayHeader: string }) {
  const newestResult = cards.find((c) => c.kind === 'match_result');

  return (
    <div className={styles.feed}>
      <div className={styles.day}>{dayHeader}</div>

      {/* aria-live announces the newest approved result (AC10); 5.8 refreshes it on a nudge. */}
      <div className={styles.srOnly} aria-live="polite" role="status">
        {newestResult ? newestResult.aria : ''}
      </div>

      {cards.map((card) => (
        <Link key={card.id} href={card.href} className={styles.item}>
          <span className={`${styles.node} ${styles[card.node]}`} aria-hidden="true" />
          {renderCard(card)}
        </Link>
      ))}
    </div>
  );
}

function renderCard(card: CardModel) {
  switch (card.kind) {
    case 'match_result':
      return <MatchResultBody card={card} />;
    case 'bracket_advance':
      return <BracketAdvanceBody card={card} />;
    case 'award_reveal':
      return <AwardRevealBody card={card} />;
  }
}

function MatchResultBody({ card }: { card: Extract<CardModel, { kind: 'match_result' }> }) {
  return (
    <div className={`${styles.card} ${styles.raised}`}>
      <div className={`${styles.time} num`}>{card.time}</div>
      <div className={styles.matchline}>
        <span className={styles.who}>
          {card.winner} <span className={styles.def}>{es.result.vs}</span> {card.loser}
        </span>
        {/* Winner-first: winner's number leads (green), loser's follows (red) — matches title + aria + mock. */}
        <span className={`${styles.score} num`}>
          <span className={styles.w}>{card.winnerScore}</span>
          {'–'}
          <span className={styles.l}>{card.loserScore}</span>
        </span>
      </div>
      <div className={styles.metarow}>
        <span className={`${styles.chip} ${styles.chipOk}`}>
          <span className={styles.tick} aria-hidden="true">
            {'✓'}
          </span>
          {es.result.approved}
        </span>
        {card.verified ? (
          <span className={styles.chip}>
            <span className={styles.tick} aria-hidden="true">
              {'✓'}
            </span>
            {es.result.verified}
          </span>
        ) : null}
        {card.hash ? <span className={`${styles.chip} num`}>{card.hash}</span> : null}
      </div>
    </div>
  );
}

function BracketAdvanceBody({ card }: { card: Extract<CardModel, { kind: 'bracket_advance' }> }) {
  return (
    <div className={styles.card}>
      <div className={`${styles.time} num`}>{card.time}</div>
      <div className={styles.advance}>
        <span className={styles.arr} aria-hidden="true">
          {'→'}
        </span>
        <span>
          <b>{card.player}</b> {es.advance.avanzaA} {card.round}
        </span>
      </div>
    </div>
  );
}

function AwardRevealBody({ card }: { card: Extract<CardModel, { kind: 'award_reveal' }> }) {
  return (
    <div className={`${styles.card} ${styles.teaser}`}>
      <div className={styles.trow}>
        <div>
          <div className={styles.ttitle}>{card.title}</div>
          <div className={styles.tsub}>{card.subtitle}</div>
        </div>
        {/*
          ⭐⭐ STORY 6.10, AC8 — THE SECOND OF THE TWO SITES (`deferred-work.md:369`). This pill used to
          render `es.award.revealAtCeremony` UNCONDITIONALLY, so a zero-winner reveal showed *"Se
          revela en la ceremonia"* beside a subtitle that said the same thing — an already-revealed
          award telling the viewer, twice, that it had not been revealed. ⛔ `award_reveal` rows are
          written by `reveal_spin` and by nothing else, so the card is a reveal BY CONSTRUCTION and
          the pill now names the state EXPERIENCE.md:119 gives it: *Revelado*.
        */}
        <span className={styles.lockpill}>{es.reveal.feedRevealed}</span>
      </div>
    </div>
  );
}
