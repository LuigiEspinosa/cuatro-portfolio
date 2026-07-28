import type { ReactNode } from 'react';
import {
  ceremonyUnlocked,
  livePillState,
  type TournamentState,
} from '@/lib/feed/read';
import { currentTournament } from './current-tournament';
import { es } from '@/lib/i18n/es';
import { Nav } from './components/Nav';
import styles from './viewer.module.css';

/**
 * The viewer shell (Story 5.6) — the mobile-first, dark, single-column frame every read-only surface
 * shares (Feed / Llave / Estadísticas / Ceremonia). Established here as the convention Stories 5.7/5.8
 * inherit. Server Component: it resolves the tournament state (anon RLS client) to drive the live pill
 * + the Ceremonia lock, then hands those to the `<Nav>` island. The feed read itself lives in the page.
 */
const PILL_COPY: Record<'on' | 'off' | 'final', string> = {
  on: es.live.on,
  off: es.live.off,
  final: es.live.final,
};

export default async function ViewerLayout({ children }: { children: ReactNode }) {
  const resolved = await currentTournament();
  const state: TournamentState = resolved.ok ? resolved.state : 'registration_open';

  const pill = livePillState(state);
  const pillClass =
    pill === 'on' ? styles.pillLive : pill === 'final' ? styles.pillDone : styles.pillSoft;

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brandrow}>
          <div className={styles.wordmark}>
            INCLUSIV<span className={styles.cup}>CUP</span>
          </div>
          <span className={`${styles.pill} ${pillClass}`}>
            <span className={styles.pulse} aria-hidden="true" />
            {PILL_COPY[pill]}
          </span>
        </div>
        <Nav ceremonyUnlocked={ceremonyUnlocked(state)} />
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
