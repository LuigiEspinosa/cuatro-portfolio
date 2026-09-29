import { es } from '@/lib/i18n/es';
import styles from '../feed.module.css';

/**
 * Pre-event empty state (AC5) — dashed ring, fixed headline + body, and the registration pill.
 * Shown when the tournament has zero feed rows (correct, not a bug — only `match_result` has a
 * writer and none has been approved yet). Never a blank screen.
 */
export function EmptyState({ registeredCount }: { registeredCount: number }) {
  return (
    <div className={styles.empty}>
      <div className={styles.ring}>{es.empty.ringLabel}</div>
      <h3 className={styles.emptyTitle}>{es.empty.headline}</h3>
      <p className={styles.emptyBody}>
        {es.empty.body} {es.empty.sub}
      </p>
      <div className={styles.reg}>
        <span className={`${styles.regN} num`}>{registeredCount}</span>
        {es.empty.regNoun}
      </div>
    </div>
  );
}
