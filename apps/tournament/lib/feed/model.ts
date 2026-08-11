import type { EntryType, FeedRow, MatchResultDetail } from '@/lib/feed/types';
import { es, resultadoAprobado } from '@/lib/i18n/es';
import { safeViewerJoined } from '@/lib/i18n/safe-text';

/**
 * Pure card-model + presentation helpers for the timeline feed (Story 5.6, Task 4).
 *
 * These are the node-testable units (Task 7): no DB, no React — a raw `FeedRow` + a resolved
 * name lookup in, a fully-shaped `CardModel` out. The feed surface renders the model verbatim
 * and does NO further data work (AC8). Stories 5.7/5.8 reuse `entryTypeNode` for streamed nodes.
 */

/** The four node colors (AC3). `entryTypeNode` is the pure `entryType → color` map 5.8 reuses. */
export type NodeColor = 'blue' | 'green' | 'gold' | 'muted';

/**
 * Node color is a PURE function of entry_type (AC3, UX MUST):
 *   bracket_advance → blue, match_result → green, award_reveal → gold.
 * Gold is the single sanctioned gold-in-feed leak — gold on any non-reveal entry is a bug — so an
 * unrecognised type falls back to `muted`, never gold.
 */
export function entryTypeNode(entryType: EntryType | string): NodeColor {
  switch (entryType) {
    case 'bracket_advance':
      return 'blue';
    case 'match_result':
      return 'green';
    case 'award_reveal':
      return 'gold';
    default:
      return 'muted';
  }
}

/**
 * The event runs in a single timezone (one private event), so every feed time renders in it —
 * viewers see wall-clock time, not UTC. A FIXED tz (not the server locale) keeps output
 * deterministic. `hourCycle: 'h23'` guarantees zero-padded 00–23 (never a "24:xx").
 */
const EVENT_TIME_ZONE = 'America/Bogota';
const feedTimeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: EVENT_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * `HH:MM · <bracket_position>` (AC4). 24-hour, zero-padded. Absolute time, never a relative
 * "hace X". `occurredAt` is a timestamptz ISO string (stored UTC); rendered in the event's
 * timezone (`America/Bogota`, fixed). When `bracketPosition` is empty/null the suffix is dropped.
 */
export function formatFeedTime(occurredAt: string, bracketPosition?: string | null): string {
  const d = new Date(occurredAt);
  if (Number.isNaN(d.getTime())) {
    // Never throw on a malformed timestamp — degrade to the position (or empty) so a card still renders.
    return bracketPosition?.trim() ? bracketPosition.trim() : '';
  }
  const time = feedTimeFormat.format(d);
  const pos = bracketPosition?.trim();
  return pos ? `${time} · ${pos}` : time;
}

/** Truncate a demo sha256 for the provenance chip: `a3f1c9e2…7b40` (first 8 + ellipsis + last 4). */
export function truncateHash(sha: string): string {
  if (sha.length <= 13) return sha;
  return `${sha.slice(0, 8)}…${sha.slice(-4)}`;
}

/** A card link's subject route (AC7). Read-only; the destinations are Story 5.7 surfaces. */
function bracketHref(targetMatchId: number | null): string {
  return targetMatchId == null ? '/bracket' : `/bracket?match=${targetMatchId}`;
}

/** Resolve a roster_entry.id to a display name, degrading gracefully (removed player → neutral label). */
function nameOf(names: Map<number, string>, rosterEntryId: number | undefined): string {
  if (rosterEntryId == null) return es.unknownPlayer;
  return names.get(rosterEntryId) ?? es.unknownPlayer;
}

// ── card models (a discriminated union — the house {ok:true}|{ok:false} style) ──

export interface MatchResultCard {
  kind: 'match_result';
  id: number;
  node: NodeColor;
  time: string;
  winner: string;
  loser: string;
  /** Winner's score (rendered FIRST, green) and loser's (second, red) — winner-first, matching the title, aria + mock. */
  winnerScore: number;
  loserScore: number;
  /** Demo provenance is present only when a demo is bound (manual rows may have none). */
  verified: boolean;
  hash: string | null;
  href: string;
  aria: string;
}

export interface BracketAdvanceCard {
  kind: 'bracket_advance';
  id: number;
  node: NodeColor;
  time: string;
  player: string;
  round: string;
  href: string;
  aria: string;
}

export interface AwardRevealCard {
  kind: 'award_reveal';
  id: number;
  node: NodeColor;
  time: string;
  title: string;
  subtitle: string;
  href: string;
  aria: string;
}

export type CardModel = MatchResultCard | BracketAdvanceCard | AwardRevealCard;

/** Provisional shapes for the two unwritten entry types (no writer exists — rendered by construction). */
interface BracketAdvanceDetail {
  advancing_entry?: number; // roster_entry.id (speculative — the uniform writer is deferred)
  round?: string;
}
interface AwardRevealDetail {
  title?: string;
  subtitle?: string;
}

/**
 * Map a raw feed row (+ resolved name lookup) to its card model. Pure and total: an unresolved
 * roster id degrades to a neutral label (Task 7 edge), a malformed detail degrades to safe
 * defaults — never a throw, so one bad row can't blank the feed.
 */
export function toCardModel(row: FeedRow, names: Map<number, string>): CardModel {
  const node = entryTypeNode(row.entry_type);

  if (row.entry_type === 'match_result') {
    const d = (row.detail ?? {}) as MatchResultDetail;
    const winner = nameOf(names, d.winner_entry);
    const loser = nameOf(names, d.loser_entry);
    // The winner always holds the higher score (ties never reach the feed), so derive winner-first
    // ordering from the seat scores — the numbers then match the winner-first title, aria + mock,
    // regardless of which seat (score_a/score_b) the winner occupied.
    const scoreA = Number(d.score_a ?? 0);
    const scoreB = Number(d.score_b ?? 0);
    const winnerScore = Math.max(scoreA, scoreB);
    const loserScore = Math.min(scoreA, scoreB);
    const sha = typeof d.demo_sha256 === 'string' && d.demo_sha256.length > 0 ? d.demo_sha256 : null;
    return {
      kind: 'match_result',
      id: row.id,
      node,
      time: formatFeedTime(row.occurred_at, d.bracket_position),
      winner,
      loser,
      winnerScore,
      loserScore,
      verified: sha !== null,
      hash: sha ? truncateHash(sha) : null,
      href: bracketHref(row.target_match_id),
      aria: resultadoAprobado(winner, loser, winnerScore, loserScore),
    };
  }

  if (row.entry_type === 'bracket_advance') {
    const d = (row.detail ?? {}) as BracketAdvanceDetail;
    const player = nameOf(names, d.advancing_entry);
    const round = typeof d.round === 'string' ? d.round : '';
    return {
      kind: 'bracket_advance',
      id: row.id,
      node,
      time: formatFeedTime(row.occurred_at, null),
      player,
      round,
      href: bracketHref(row.target_match_id),
      aria: `${player} ${es.advance.avanzaA} ${round}`.trim(),
    };
  }

  // award_reveal — `reveal_spin` (Story 6.8b) is the writer, and `title` carries the AWARD NAME.
  //
  // ⭐ STORY 6.9b, AC9 — THIS IS WHERE `deferred-work.md:265-266` ACTUALLY BITES. `0023`'s
  // `~ '[^[:space:]]'` accepts U+200B / U+200E / U+FEFF and bounds nothing, so an award named with a
  // single zero-width space renders as an EMPTY CARD here and a multi-KB name renders as a wall.
  // ⚠ 6.9a's claim that the bundle's ASCII restriction gave that debt teeth was measured FALSE —
  // DECISION N drops `name` from the hashed document entirely, so the hash never covered this. The
  // guard belongs at the surface, and this is the surface: `safeViewerText` REJECTS rather than
  // strips (stripping U+200E could produce a different real name) and falls back to the copy this
  // card already uses when the writer sends nothing at all.
  const d = (row.detail ?? {}) as AwardRevealDetail;
  // ⭐ 6.9b CODE REVIEW — `safeViewerJoined`, NOT `safeViewerText`. Both fields are `string_agg(…,
  // ' · ')` aggregates (`0028:757-768`), so judging the whole join against a bound calibrated for one
  // award name refused legitimate multi-award / multi-winner cards and fell back to
  // `revealAtCeremony` — an already-revealed award telling the viewer it has not been revealed. The
  // guard now judges each element; character refusals still refuse the whole string, because
  // dropping an element would misreport who won.
  const title = safeViewerJoined(d.title, es.award.teaserTitle);
  const subtitle = safeViewerJoined(d.subtitle, es.award.revealAtCeremony);
  return {
    kind: 'award_reveal',
    id: row.id,
    node,
    time: formatFeedTime(row.occurred_at, null),
    title,
    subtitle,
    href: '/leaderboards',
    aria: `${title} — ${subtitle}`,
  };
}

/**
 * Collect every roster_entry.id referenced by a snapshot's rows (winner/loser + the speculative
 * advancing_entry), for a single batched name-resolution query in fetchFeedSnapshot. Exported so
 * Task 7 can pin the batching shape.
 */
export function collectRosterIds(rows: FeedRow[]): number[] {
  const ids = new Set<number>();
  for (const row of rows) {
    const d = (row.detail ?? {}) as MatchResultDetail & BracketAdvanceDetail;
    for (const v of [d.winner_entry, d.loser_entry, d.advancing_entry]) {
      if (typeof v === 'number' && Number.isFinite(v)) ids.add(v);
    }
  }
  return [...ids];
}
