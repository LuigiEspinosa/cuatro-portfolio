import { createSupabaseServerClient } from '@/lib/supabase/server';
import { currentTournament } from '../current-tournament';
import { fetchBracketSnapshot } from '@/lib/bracket/read';
import type { BracketGroups, MatchNodeModel } from '@/lib/bracket/model';
import { es } from '@/lib/i18n/es';
import { BracketNode } from './BracketNode';
import { FocusedMatch } from './FocusedMatch';
import styles from './bracket.module.css';

/*
 * The bracket surface (Story 5.7, AC2/AC3/AC8/AC9) — the `Llave` tab. A read-only, mobile-first view of the
 * seeded double-elimination `match` rows (viewer-readable via migration 0022). Reads published state through
 * the anon, RLS-respecting `createSupabaseServerClient()` (NEVER service-role). Two views off ONE snapshot:
 * the stacked map (Winners → Losers → Grand final) and a focused match (`?match=<id>`, linked from the feed
 * or a tapped node). Renders NO admin advance/forfeit control (FR-34/UX-DR4). `force-dynamic`: per-request read.
 */
export const dynamic = 'force-dynamic';

export default async function BracketPage({
  searchParams,
}: {
  searchParams: Promise<{ match?: string }>;
}) {
  const { match } = await searchParams;
  const client = await createSupabaseServerClient();
  const resolved = await currentTournament();

  if (!resolved.ok) {
    // No tournament yet → the pre-bracket empty copy; a genuine read error → a non-blank error line.
    return <EmptyBracket body={resolved.reason === 'no_tournament' ? es.empty.body : es.state.error} />;
  }

  const snapshot = await fetchBracketSnapshot(client, resolved.id);
  if (!snapshot.ok) {
    return <EmptyBracket body={es.state.error} />;
  }

  const { groups } = snapshot;
  const total = groups.winners.length + groups.losers.length + groups.grandFinal.length;
  if (total === 0) {
    return <EmptyBracket body={es.empty.body} />;
  }

  // Focused match view: a ?match=<id> from the feed or a tapped node.
  const focusId = match ? Number(match) : NaN;
  if (Number.isFinite(focusId)) {
    const node = findNode(groups, focusId);
    return node ? <FocusedMatch node={node} /> : <EmptyBracket body={es.bracket.notFound} />;
  }

  return <BracketMap groups={groups} />;
}

/** The stacked map: three bracket sections, each ordered by bracket_slot (empty sections are omitted). */
function BracketMap({ groups }: { groups: BracketGroups }) {
  const champion = [...groups.grandFinal, ...groups.winners, ...groups.losers].find((n) => n.isChampion);
  return (
    <div className={styles.wrap}>
      {/* aria-live announces the crowned champion / Final state (AC9); 5.8 refreshes it on a nudge. */}
      <div className={styles.srOnly} aria-live="polite" role="status">
        {champion ? `${es.bracket.champion}: ${champion.competitors[0].name ?? ''}` : ''}
      </div>
      <Section label={es.bracket.winners} nodes={groups.winners} />
      <Section label={es.bracket.losers} nodes={groups.losers} />
      <Section label={es.bracket.grandFinal} nodes={groups.grandFinal} />
    </div>
  );
}

function Section({ label, nodes }: { label: string; nodes: MatchNodeModel[] }) {
  if (nodes.length === 0) return null;
  return (
    <section className={styles.section}>
      <div className={styles.branchLabel}>{label}</div>
      <div className={styles.nodes}>
        {nodes.map((node) => (
          <BracketNode key={node.id} node={node} />
        ))}
      </div>
    </section>
  );
}

function findNode(groups: BracketGroups, id: number): MatchNodeModel | undefined {
  return [...groups.winners, ...groups.losers, ...groups.grandFinal].find((n) => n.id === id);
}

function EmptyBracket({ body }: { body: string }) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyBody}>{body}</p>
    </div>
  );
}
