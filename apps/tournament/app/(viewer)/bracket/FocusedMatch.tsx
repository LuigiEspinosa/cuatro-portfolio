import Link from 'next/link';
import type { MatchNodeModel, NodeBadge, NodeCompetitor } from '@/lib/bracket/model';
import { es } from '@/lib/i18n/es';
import styles from './bracket.module.css';

// Same badge machine-token → label/class maps as BracketNode, so the focused view shows the same
// en vivo / Pase directo / W.O. badge (without it, a `live` focused match is indistinguishable from unplayed).
const BADGE_LABEL: Record<NodeBadge, string> = {
  live: es.bracket.liveBadge,
  bye: es.bracket.bye,
  forfeit: es.bracket.forfeit,
};
const BADGE_CLASS: Record<NodeBadge, string> = {
  live: styles.badgeLive,
  bye: styles.badgeBye,
  forfeit: styles.badgeForfeit,
};

/**
 * The focused-match view (Story 5.7, AC3) — the same node data, expanded, reached from a feed link or a
 * tapped node (`/bracket?match=<id>`). Shows the round label, the provenance chip when a demo is bound, big
 * per-competitor scores with win/loss coloring, and a back affordance. Read-only: NO admin advance/forfeit
 * bar renders (the mock shows one — it is admin-only, FR-34/UX-DR4).
 */
function Player({ c }: { c: NodeCompetitor }) {
  const tone = c.outcome === 'win' ? styles.fmwin : c.outcome === 'loss' ? styles.fmlose : '';
  return (
    <div className={`${styles.fmplayer} ${tone}`}>
      <div className={styles.fmname}>
        <div className={`${styles.fmnm} ${c.name === null ? styles.tbd : ''}`}>
          {c.name ?? es.bracket.tbd}
          {c.seed !== null ? (
            <span className={`${styles.seedchip} num`}>
              {es.bracket.seed} {c.seed}
            </span>
          ) : null}
          {c.outcome === 'win' ? <span className={styles.wtag}>{es.bracket.victory}</span> : null}
        </div>
      </div>
      {c.score !== null ? <div className={`${styles.fmscore} num`}>{c.score}</div> : null}
    </div>
  );
}

export function FocusedMatch({ node }: { node: MatchNodeModel }) {
  const [top, bottom] = node.competitors;
  const footNote = node.noStats
    ? es.bracket.noStats
    : node.status === 'awaiting'
      ? es.bracket.awaiting
      : node.status === 'por_jugar'
        ? es.bracket.porJugar
        : null;

  return (
    <div className={styles.wrap}>
      <Link href="/bracket" className={styles.crumb}>
        <span className={styles.arrow} aria-hidden="true">
          {'←'}
        </span>
        {es.bracket.back}
      </Link>

      <div className={`${styles.fmcard} ${node.isChampion ? styles.champ : ''}`}>
        <div className={styles.fmtop}>
          <span className={styles.fmround}>{node.isChampion ? es.bracket.champion : node.position}</span>
          {node.badge ? (
            <span className={`${styles.badge} ${BADGE_CLASS[node.badge]}`}>{BADGE_LABEL[node.badge]}</span>
          ) : null}
          {node.verified ? (
            <span className={styles.verify}>
              <span className={styles.chk} aria-hidden="true">
                {'✓'}
              </span>
              {es.result.verified}
            </span>
          ) : null}
        </div>
        <Player c={top} />
        <Player c={bottom} />
        {footNote ? (
          <div className={`${styles.fmfoot} ${node.badge === 'forfeit' ? styles.forfeit : ''}`}>{footNote}</div>
        ) : null}
      </div>
    </div>
  );
}
