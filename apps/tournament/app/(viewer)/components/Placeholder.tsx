import { es } from '@/lib/i18n/es';
import styles from '../feed.module.css';

/**
 * A minimal placeholder for the Story 5.7 viewer surfaces (bracket / leaderboards / ceremony).
 * 5.6 establishes the nav + route targets; a hard 404 would break the shell's usability, so these
 * exist as stubs under the shared viewer layout. Their real content is Story 5.7's.
 */
export function Placeholder({ body }: { body: string }) {
  return (
    <div className={styles.empty}>
      <div className={styles.ring}>{es.empty.ringLabel}</div>
      <h3 className={styles.emptyTitle}>{es.placeholder.comingSoon}</h3>
      <p className={styles.emptyBody}>{body}</p>
    </div>
  );
}
