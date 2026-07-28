import { describe, it, expect } from 'vitest';
import {
  collectRosterIds,
  entryTypeNode,
  formatFeedTime,
  toCardModel,
  truncateHash,
} from '@/lib/feed/model';
import type { FeedRow } from '@/lib/feed/types';

const NAMES = new Map<number, string>([
  [11, 'Dex'],
  [22, 'Theo'],
  [33, 'Mara'],
]);

describe('entryTypeNode (AC3 — node color is a pure function of entry_type)', () => {
  it('maps each entry type to its sanctioned color', () => {
    expect(entryTypeNode('bracket_advance')).toBe('blue');
    expect(entryTypeNode('match_result')).toBe('green');
    expect(entryTypeNode('award_reveal')).toBe('gold');
  });

  it('falls back to muted (never gold) for an unrecognised type — gold is the reveal-only leak', () => {
    expect(entryTypeNode('rollback' as never)).toBe('muted');
  });
});

describe('formatFeedTime (AC4 — HH:MM · <position>, 24h, absolute, event-local America/Bogota UTC-5)', () => {
  it('formats time + bracket position in event time (21:12Z → 16:12 Bogota)', () => {
    expect(formatFeedTime('2026-07-28T21:12:00Z', 'Winners R1')).toBe('16:12 · Winners R1');
  });

  it('zero-pads and drops an empty position (09:05Z → 04:05 Bogota)', () => {
    expect(formatFeedTime('2026-07-28T09:05:00Z', null)).toBe('04:05');
    expect(formatFeedTime('2026-07-28T09:05:00Z', '   ')).toBe('04:05');
  });

  it('degrades (never throws) on a malformed timestamp', () => {
    expect(formatFeedTime('not-a-date', 'gran final')).toBe('gran final');
    expect(formatFeedTime('not-a-date', null)).toBe('');
  });
});

describe('truncateHash', () => {
  it('truncates a full sha to first-8…last-4', () => {
    expect(truncateHash('a3f1c9e2deadbeefcafe12347b40')).toBe('a3f1c9e2…7b40');
  });
  it('passes a short value through unchanged', () => {
    expect(truncateHash('abc123')).toBe('abc123');
  });
});

describe('toCardModel — match_result (AC4)', () => {
  const row: FeedRow = {
    id: 5,
    tournament_id: 7,
    entry_type: 'match_result',
    occurred_at: '2026-07-28T21:12:00Z',
    target_match_id: 42,
    detail: {
      winner_entry: 11,
      loser_entry: 22,
      score_a: 16,
      score_b: 13,
      bracket_position: 'Winners R1',
      demo_sha256: 'a3f1c9e2deadbeefcafe12347b40',
    },
  };

  it('shapes names, seat-ordered score, winner-green flag, provenance and aria', () => {
    const card = toCardModel(row, NAMES);
    expect(card).toMatchObject({
      kind: 'match_result',
      id: 5,
      node: 'green',
      time: '16:12 · Winners R1',
      winner: 'Dex',
      loser: 'Theo',
      winnerScore: 16,
      loserScore: 13,
      verified: true,
      hash: 'a3f1c9e2…7b40',
      href: '/bracket?match=42',
      aria: 'Resultado aprobado: Dex venció a Theo 16-13',
    });
  });

  it('renders the score winner-first regardless of seat (winner in seat B: score_a < score_b)', () => {
    const card = toCardModel({ ...row, detail: { ...(row.detail as object), score_a: 13, score_b: 16 } }, NAMES);
    if (card.kind !== 'match_result') throw new Error('kind');
    // Winner-first: the winner's number leads (green), matching the title + aria + mock — even
    // though the winner sat in seat B (score_b holds the higher score). This is the P1 review fix.
    expect(card.winnerScore).toBe(16);
    expect(card.loserScore).toBe(13);
    expect(card.aria).toBe('Resultado aprobado: Dex venció a Theo 16-13');
  });

  it('tolerates a null target_match_id — links to the bracket root', () => {
    const card = toCardModel({ ...row, target_match_id: null }, NAMES);
    expect(card.href).toBe('/bracket');
  });

  it('degrades a manual row with no demo: no verified chip, no hash (not a crash)', () => {
    const card = toCardModel({ ...row, detail: { ...(row.detail as object), demo_sha256: null } }, NAMES);
    if (card.kind !== 'match_result') throw new Error('kind');
    expect(card.verified).toBe(false);
    expect(card.hash).toBeNull();
  });

  it('falls back to a neutral label when a roster id does not resolve (removed player edge)', () => {
    const card = toCardModel(row, new Map([[11, 'Dex']])); // 22 (loser) missing → removed player
    if (card.kind !== 'match_result') throw new Error('kind');
    expect(card.winner).toBe('Dex');
    expect(card.loser).toBe('Jugador retirado');
  });
});

describe('toCardModel — bracket_advance / award_reveal render by construction (AC2)', () => {
  it('renders a bracket_advance card even though no writer exists', () => {
    const card = toCardModel(
      {
        id: 9,
        tournament_id: 7,
        entry_type: 'bracket_advance',
        occurred_at: '2026-07-28T21:14:00Z',
        target_match_id: null,
        detail: { advancing_entry: 33, round: 'Winners R2' },
      },
      NAMES,
    );
    expect(card).toMatchObject({ kind: 'bracket_advance', node: 'blue', player: 'Mara', round: 'Winners R2', href: '/bracket' });
  });

  it('renders an award_reveal card with gold node and teaser fallbacks', () => {
    const card = toCardModel(
      {
        id: 12,
        tournament_id: 7,
        entry_type: 'award_reveal',
        occurred_at: '2026-07-28T23:00:00Z',
        target_match_id: null,
        detail: {},
      },
      NAMES,
    );
    expect(card).toMatchObject({ kind: 'award_reveal', node: 'gold', href: '/leaderboards' });
  });
});

describe('collectRosterIds', () => {
  it('collects and de-duplicates winner/loser/advancing ids across rows', () => {
    const rows: FeedRow[] = [
      {
        id: 1,
        tournament_id: 7,
        entry_type: 'match_result',
        occurred_at: 't',
        target_match_id: null,
        detail: { winner_entry: 11, loser_entry: 22 },
      },
      {
        id: 2,
        tournament_id: 7,
        entry_type: 'bracket_advance',
        occurred_at: 't',
        target_match_id: null,
        detail: { advancing_entry: 11 }, // dup of 11
      },
    ];
    expect(collectRosterIds(rows).sort()).toEqual([11, 22]);
  });

  it('returns an empty array when no rows carry roster ids', () => {
    expect(collectRosterIds([])).toEqual([]);
  });
});
