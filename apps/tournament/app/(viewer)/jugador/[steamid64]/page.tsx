import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchPlayerDetail } from '@/lib/player/read';
import type { PlayerDetailModel, PlayerMatchLine } from '@/lib/player/model';
import { es } from '@/lib/i18n/es';
import styles from './player.module.css';

/*
 * The player stat detail surface (Story 5.7, AC6/AC8/AC9) — a sub-route (no nav tab), reached from a
 * leaderboard row or a feed mention. Read-only, keyed by `steamid64`. Headline + weird totals come from the
 * player's ONE `public.leaderboard` row (AD-20); the matches-behind list is a raw per-match listing. Reads
 * through the anon client (NEVER service-role). `force-dynamic`: per-request read.
 */
export const dynamic = 'force-dynamic';

function avatar(name: string): string {
  return name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '·';
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ steamid64: string }>;
}) {
  const { steamid64 } = await params;
  const client = await createSupabaseServerClient();
  const result = await fetchPlayerDetail(client, steamid64);

  if (!result.ok) {
    return <NotFound body={result.reason === 'not_found' ? es.player.notFound : es.state.error} />;
  }
  return <PlayerDetail detail={result.detail} />;
}

function PlayerDetail({ detail }: { detail: PlayerDetailModel }) {
  return (
    <div className={styles.body}>
      <Link href="/leaderboards" className={styles.crumb}>
        <span className={styles.arrow} aria-hidden="true">
          {'←'}
        </span>
        {es.player.backToStats}
      </Link>

      <div className={styles.head}>
        <span className={styles.av} aria-hidden="true">
          {avatar(detail.name)}
        </span>
        <div className={styles.id}>
          <div className={styles.nameRow}>
            <span className={styles.name}>{detail.name}</span>
            {detail.seed !== null ? (
              <span className={`${styles.seedchip} num`}>
                {es.bracket.seed} {detail.seed}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* provenance line (AC6) — the CAPITALIZED "Verificado desde el demo", shown when a demo backs the stats */}
      {detail.verified ? (
        <div className={styles.verify}>
          <span className={styles.vi} aria-hidden="true">
            {'◇'}
          </span>
          <span>{es.provenance.verified}</span>
        </div>
      ) : null}

      {/* base stats */}
      <div className={styles.grpcap}>{es.player.baseStats}</div>
      <div className={styles.stats}>
        <Stat label={es.player.kda} value={detail.base.kda} />
        <Stat label={es.player.adr} value={detail.base.adr} />
        <Stat label={es.player.hsPct} value={detail.base.hsPct} />
        <Stat label={es.player.kast} value={detail.base.kast} />
      </div>

      {/* weird demo-only stats */}
      <div className={`${styles.grpcap} ${styles.spaced}`}>{es.player.weirdStats}</div>
      <div className={styles.weirdwrap}>
        {detail.weird.map((w) => (
          <div key={w.key} className={styles.wstat}>
            <span className={styles.wl}>
              <span className={styles.wn}>{w.label}</span>
            </span>
            <span className={`${styles.wv} num`}>{w.value}</span>
          </div>
        ))}
      </div>

      {/* matches behind them (FR-23) — a raw per-match listing, not a re-aggregation */}
      {detail.matches.length > 0 ? (
        <>
          <div className={`${styles.grpcap} ${styles.spaced}`}>{es.player.matches}</div>
          <div className={styles.matches}>
            {detail.matches.map((m) => (
              <MatchRow key={m.matchId} m={m} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <div className={styles.l}>{label}</div>
      <div className={`${styles.v} num`}>{value}</div>
    </div>
  );
}

function MatchRow({ m }: { m: PlayerMatchLine }) {
  const verb = m.outcome === 'win' ? es.player.beat : m.outcome === 'loss' ? es.player.lostTo : null;
  return (
    <div className={styles.mrow}>
      <span className={styles.mpos}>{m.position}</span>
      <span className={styles.mopp}>
        {verb ? <span className={styles.res}>{verb} </span> : null}
        {m.opponent}
      </span>
      {m.scoreSelf !== null && m.scoreOpp !== null ? (
        <span className={`${styles.mscore} num`}>
          <span className={m.outcome === 'win' ? styles.w : styles.l}>{m.scoreSelf}</span>
          {'–'}
          <span className={m.outcome === 'win' ? styles.l : styles.w}>{m.scoreOpp}</span>
        </span>
      ) : null}
    </div>
  );
}

function NotFound({ body }: { body: string }) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyBody}>{body}</p>
      <Link href="/leaderboards" className={styles.backLink}>
        {es.player.backToStats}
      </Link>
    </div>
  );
}
