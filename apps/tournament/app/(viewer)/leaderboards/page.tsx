import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchLeaderboard } from '@/lib/leaderboard/read';
import { fetchAwardCatalogCount } from '@/lib/awards/read';
import { currentTournament } from '../current-tournament';
import { es } from '@/lib/i18n/es';
import { LeaderboardBoards } from './LeaderboardBoards';
import { LockedAwards } from './LockedAwards';
import styles from './leaderboards.module.css';

/*
 * The leaderboards surface (Story 5.7, AC4/AC5/AC8/AC9 · Story 6.1, AC4) — the `Estadísticas` tab. A read-only
 * ranking off the SINGLE `public.leaderboard` view (AD-20), read through the anon, RLS-respecting
 * `createSupabaseServerClient()` (NEVER service-role). The Tasa/Volumen toggle is a thin client island that
 * re-ranks in place. `force-dynamic`: the reads are per-request.
 *
 * ⭐ Story 6.1 adds the locked "Posiciones de premios" block ABOVE the boards. It renders from the award COUNT
 * and nothing else (`award_catalog_count`) — a viewer holds no grant on `award` at all, so no name, bucket,
 * class, deciding stat, floor or id can reach the client before that award's spin (AD-22 / FR-24). Story 6.8
 * opens the per-spin reveal; nothing here is revealed.
 *
 * ⚠ The block is INDEPENDENT OF STATS: it renders even when the boards are empty (an award catalog exists before
 * the first approved match). It renders NOTHING when the count is 0 or the read fails — never `Premio 1 de 0`.
 */
export const dynamic = 'force-dynamic';

export default async function LeaderboardsPage() {
  const client = await createSupabaseServerClient();

  // The tournament is resolved through the SHARED per-request cache (5.6 review, P3) — a second resolver here
  // would mean a second `tournament` read on every render of this page.
  const [snapshot, tournament] = await Promise.all([fetchLeaderboard(client), currentTournament()]);

  const catalog = tournament.ok
    ? await fetchAwardCatalogCount(client, tournament.id)
    : ({ ok: false, reason: 'read_failed' } as const);
  const lockedCount = catalog.ok ? catalog.count : 0;

  return (
    <>
      {lockedCount > 0 && <LockedAwards count={lockedCount} />}
      {!snapshot.ok ? (
        <EmptyStats body={es.state.error} />
      ) : snapshot.rows.length === 0 ? (
        <EmptyStats body={es.leaderboards.empty} />
      ) : (
        <LeaderboardBoards rows={snapshot.rows} />
      )}
    </>
  );
}

function EmptyStats({ body }: { body: string }) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyBody}>{body}</p>
    </div>
  );
}
