'use client';

import { useState } from 'react';
import Link from 'next/link';
import { type BoardKind, type LeaderboardRow, buildBoard } from '@/lib/leaderboard/model';
import { es } from '@/lib/i18n/es';
import styles from './leaderboards.module.css';

/**
 * The leaderboards board island (Story 5.7, AC4/AC5). A thin `'use client'` segmented toggle that re-ranks
 * Tasa/Volumen IN PLACE off the ONE view's rows (a deliberate, reversible switch — not a hidden filter). The
 * toggle reads by TONE + WEIGHT only — no blue fill, no gold (AC4). Rows are ≥44px links to player detail
 * (AC6). All numbers are tabular (`.num`). The read + the raw rows come from the Server Component page.
 */
function avatar(name: string): string {
  return name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '·';
}

const COLS: Record<BoardKind, { v1: string; v2: string }> = {
  rate: { v1: es.leaderboards.colAdr, v2: es.leaderboards.colHs },
  volume: { v1: es.leaderboards.colKills, v2: es.leaderboards.colKnife },
};

export function LeaderboardBoards({ rows }: { rows: LeaderboardRow[] }) {
  const [kind, setKind] = useState<BoardKind>('rate');
  const board = buildBoard(rows, kind);
  const cols = COLS[kind];

  return (
    <div className={styles.body}>
      <div className={styles.sechead}>{es.leaderboards.sechead}</div>
      <div className={styles.subhead}>
        {es.leaderboards.updated} · {rows.length} {es.leaderboards.players}
      </div>

      {/* segmented toggle — tone + weight only */}
      <div className={styles.seg} role="tablist" aria-label={es.leaderboards.sechead}>
        <button
          type="button"
          role="tab"
          aria-selected={kind === 'rate'}
          className={`${styles.segBtn} ${kind === 'rate' ? styles.on : ''}`}
          onClick={() => setKind('rate')}
        >
          {es.leaderboards.rate}
          <span className={styles.hint}>{es.leaderboards.rateHint}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={kind === 'volume'}
          className={`${styles.segBtn} ${kind === 'volume' ? styles.on : ''}`}
          onClick={() => setKind('volume')}
        >
          {es.leaderboards.volume}
          <span className={styles.hint}>{es.leaderboards.volumeHint}</span>
        </button>
      </div>
      <div className={styles.segnote}>
        <span className={styles.k}>{kind === 'rate' ? es.leaderboards.rate : es.leaderboards.volume}</span>
        <span>{kind === 'rate' ? es.leaderboards.rateNote : es.leaderboards.volumeNote}</span>
      </div>

      {/* ranking */}
      <div className={styles.colhead}>
        <span className={styles.chRank}>{es.leaderboards.colRank}</span>
        <span className={styles.chPlayer}>{es.leaderboards.colPlayer}</span>
        <span className={styles.chV1}>{cols.v1}</span>
        <span className={styles.chV2}>{cols.v2}</span>
      </div>
      <div className={styles.lb}>
        {board.rows.map((r) => (
          <Link key={r.steamid64} href={`/jugador/${r.steamid64}`} className={styles.row}>
            <span className={`${styles.rk} num`}>{r.rank}</span>
            <span className={styles.av} aria-hidden="true">
              {avatar(r.name)}
            </span>
            <span className={styles.nm}>
              <span className={styles.n}>{r.name}</span>
              <span className={styles.meta}>{r.meta}</span>
            </span>
            <span className={`${styles.v1} num`}>{r.primary}</span>
            <span className={`${styles.v2} num`}>{r.secondary}</span>
          </Link>
        ))}
      </div>

      {/* eligibility */}
      <div className={styles.grpcap}>{es.leaderboards.eligibility}</div>
      <div className={styles.colhead}>
        <span className={styles.chRank}>{es.leaderboards.colRank}</span>
        <span className={styles.chPlayer}>{es.leaderboards.colPlayer}</span>
        <span className={styles.chV1}>{es.leaderboards.colRounds}</span>
        <span className={styles.chV2}>{es.leaderboards.colKills}</span>
      </div>
      <div className={styles.lb}>
        {board.eligibility.map((e) => (
          <Link key={e.steamid64} href={`/jugador/${e.steamid64}`} className={`${styles.row} ${e.eligible ? '' : styles.dq}`}>
            <span className={`${styles.rk} num`}>{'—'}</span>
            <span className={styles.av} aria-hidden="true">
              {avatar(e.name)}
            </span>
            <span className={styles.nm}>
              <span className={styles.n}>{e.name}</span>
              <span className={styles.meta}>{e.eligible ? es.leaderboards.eligible : es.leaderboards.notEligible}</span>
            </span>
            <span className={`${styles.v1} num`}>{e.rounds}</span>
            <span className={`${styles.v2} num`}>{e.kills}</span>
            {!e.eligible ? <span className={styles.dqtag}>{es.leaderboards.dq}</span> : null}
          </Link>
        ))}
      </div>

      {/* fixed anti-farm floor callout */}
      <div className={styles.elig}>
        <span className={styles.i} aria-hidden="true">
          {'◔'}
        </span>
        <span className={styles.t}>
          <b>{es.leaderboards.floorCallout}</b> {es.leaderboards.floorSub}
        </span>
      </div>
    </div>
  );
}
