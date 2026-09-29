import type { ReactNode } from 'react';
import { ceremonyUnlocked, type TournamentState } from '@/lib/feed/read';
import { currentTournament } from './current-tournament';
import { Nav } from './components/Nav';
import { RealtimeNudge } from './components/RealtimeNudge';
import styles from './viewer.module.css';

/**
 * The viewer shell (Story 5.6) — the mobile-first, dark, single-column frame every read-only surface
 * shares (Feed / Llave / Estadísticas / Ceremonia). Server Component: it resolves the tournament (anon RLS
 * client) to drive the Ceremonia lock and to SEED the live pill, then mounts the ONE `RealtimeNudge` island.
 *
 * Story 5.8 makes the shell LIVE: `RealtimeNudge` subscribes to `tournament:<id>` and, on any nudge, calls
 * `router.refresh()` — which re-runs THIS layout + the active route together, so every viewer surface
 * (`/`, `/bracket`, `/leaderboards`, `/jugador/[id]`) re-fetches published truth and the pill re-resolves,
 * from a single island. The pill (formerly a static span here) is now rendered by that client island so it
 * can reflect the realtime connection status (En vivo / final / sin transmisión / Reconectando…).
 */
export default async function ViewerLayout({ children }: { children: ReactNode }) {
  const resolved = await currentTournament();
  const state: TournamentState = resolved.ok ? resolved.state : 'registration_open';

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brandrow}>
          <div className={styles.wordmark}>
            INCLUSIV<span className={styles.cup}>CUP</span>
          </div>
          {/* Connection-aware pill + realtime subscription (Story 5.8). `null` id ⇒ no channel, `loading` pill. */}
          <RealtimeNudge
            tournamentId={resolved.ok ? resolved.id : null}
            state={resolved.ok ? resolved.state : null}
          />
        </div>
        <Nav ceremonyUnlocked={ceremonyUnlocked(state)} />
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
