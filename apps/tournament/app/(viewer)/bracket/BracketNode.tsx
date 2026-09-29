import Link from 'next/link';
import type { MatchNodeModel, NodeBadge, NodeCompetitor, NodeStatus } from '@/lib/bracket/model';
import { es } from '@/lib/i18n/es';
import styles from './bracket.module.css';

/**
 * One bracket node — a full-width, tappable card (Story 5.7, AC2/AC3). Renders competitors + seeds, a
 * per-state badge, and a score ONLY when the model says so (scored). The whole card links to the focused
 * match view (`/bracket?match=<id>`). NO admin advance/forfeit control is ever rendered (FR-34/UX-DR4).
 *
 * ⚠ The only gold is the champion node (UX-DR6) — `isChampion` adds the gold border + the "Campeón" label.
 */

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
const STATUS_LABEL: Record<NodeStatus, string> = {
  por_jugar: es.bracket.porJugar,
  awaiting: es.bracket.awaiting,
};

function Slot({ c }: { c: NodeCompetitor }) {
  const tone = c.outcome === 'win' ? styles.win : c.outcome === 'loss' ? styles.loss : '';
  const tbd = c.name === null ? styles.tbd : '';
  return (
    <div className={`${styles.slot} ${tone} ${tbd}`}>
      <span className={`${styles.seed} num`}>{c.seed ?? '·'}</span>
      <span className={styles.pname}>{c.name ?? es.bracket.tbd}</span>
      {c.score !== null ? <span className={`${styles.pscore} num`}>{c.score}</span> : null}
    </div>
  );
}

export function BracketNode({ node }: { node: MatchNodeModel }) {
  const [top, bottom] = node.competitors;
  return (
    <Link href={`/bracket?match=${node.id}`} className={`${styles.node} ${node.isChampion ? styles.champ : ''}`}>
      {node.badge ? <span className={`${styles.badge} ${BADGE_CLASS[node.badge]}`}>{BADGE_LABEL[node.badge]}</span> : null}
      {node.isChampion ? (
        <div className={styles.champLabel}>
          <span aria-hidden="true">{'♕'}</span>
          {es.bracket.champion}
        </div>
      ) : (
        <div className={styles.pos}>{node.position}</div>
      )}
      <Slot c={top} />
      <div className={styles.divider} aria-hidden="true" />
      <Slot c={bottom} />
      {node.status ? <div className={styles.note}>{STATUS_LABEL[node.status]}</div> : null}
      {node.noStats ? (
        <div className={`${styles.note} ${node.badge === 'forfeit' ? styles.noteForfeit : ''}`}>
          {es.bracket.noStats}
        </div>
      ) : null}
    </Link>
  );
}
