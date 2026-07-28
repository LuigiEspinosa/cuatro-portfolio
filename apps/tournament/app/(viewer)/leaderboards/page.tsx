import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchLeaderboard } from '@/lib/leaderboard/read';
import { es } from '@/lib/i18n/es';
import { LeaderboardBoards } from './LeaderboardBoards';
import styles from './leaderboards.module.css';

/*
 * The leaderboards surface (Story 5.7, AC4/AC5/AC8/AC9) — the `Estadísticas` tab. A read-only ranking off
 * the SINGLE `public.leaderboard` view (AD-20), read through the anon, RLS-respecting
 * `createSupabaseServerClient()` (NEVER service-role). The Tasa/Volumen toggle is a thin client island that
 * re-ranks in place. Awards (the blurred "Posiciones de premios" block) are Epic 6 — NOT built here.
 * `force-dynamic`: the read is per-request.
 */
export const dynamic = 'force-dynamic';

export default async function LeaderboardsPage() {
  const client = await createSupabaseServerClient();
  const snapshot = await fetchLeaderboard(client);

  if (!snapshot.ok) {
    return <EmptyStats body={es.state.error} />;
  }
  if (snapshot.rows.length === 0) {
    return <EmptyStats body={es.leaderboards.empty} />;
  }
  return <LeaderboardBoards rows={snapshot.rows} />;
}

function EmptyStats({ body }: { body: string }) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyBody}>{body}</p>
    </div>
  );
}
