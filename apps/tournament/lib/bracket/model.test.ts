import { describe, it, expect } from 'vitest';
import {
  type MatchRow,
  type MatchState,
  collectCompetitorIds,
  detectChampion,
  groupBracket,
  matchNodeModel,
} from '@/lib/bracket/model';
import { es } from '@/lib/i18n/es';

/**
 * Pins the pure bracket view-model (Story 5.7, Task 3/AC2/AC3): grouping + slot order, score-only-when-
 * resolved, winner-first ordering, champion (gold) detection across the AD-21 two-row grand final, void
 * drop, and the removed-player name fallback. No DB — a raw MatchRow + resolved lookups in, a node out.
 */

function row(over: Partial<MatchRow> & { id: number }): MatchRow {
  return {
    tournament_id: 1,
    bracket: 'winners',
    bracket_position: 'Winners R1',
    bracket_slot: 0,
    gf_order: null,
    competitor_a: null,
    competitor_b: null,
    winner_entry: null,
    score_a: null,
    score_b: null,
    state: 'declared' as MatchState,
    demo_id: null,
    ...over,
  };
}

const names = new Map<number, string>([
  [11, 'Dex'],
  [22, 'Theo'],
  [33, 'Mara'],
]);
const seeds = new Map<number, number>([
  [11, 1],
  [22, 4],
  [33, 2],
]);

describe('matchNodeModel — per-state rendering (AC3)', () => {
  it('shows a score, winner-first + win/loss outcomes, ONLY for a resolved match (AC2)', () => {
    // seat B (Theo, 22) is the winner — winner-first must lead with Theo despite the seat order.
    const node = matchNodeModel(
      row({ id: 5, competitor_a: 11, competitor_b: 22, winner_entry: 22, score_a: 13, score_b: 16, state: 'resolved', demo_id: 9 }),
      names,
      seeds,
      null,
    )!;
    expect(node.scored).toBe(true);
    expect(node.competitors[0]).toMatchObject({ name: 'Theo', seed: 4, score: 16, outcome: 'win' });
    expect(node.competitors[1]).toMatchObject({ name: 'Dex', seed: 1, score: 13, outcome: 'loss' });
    expect(node.verified).toBe(true); // demo bound
  });

  it('manual_resolved also renders a score (AC3 table)', () => {
    const node = matchNodeModel(
      row({ id: 6, competitor_a: 11, competitor_b: 22, winner_entry: 11, score_a: 16, score_b: 9, state: 'manual_resolved' }),
      names,
      seeds,
      null,
    )!;
    expect(node.scored).toBe(true);
    expect(node.competitors[0]).toMatchObject({ name: 'Dex', outcome: 'win', score: 16 });
    expect(node.verified).toBe(false); // no demo bound (a manual score)
  });

  it.each<[MatchState, { badge: string | null; status: string | null; noStats: boolean }]>([
    ['declared', { badge: null, status: 'por_jugar', noStats: false }],
    ['pending', { badge: null, status: 'por_jugar', noStats: false }],
    ['rolled_back', { badge: null, status: 'por_jugar', noStats: false }],
    ['awaiting_grace', { badge: null, status: 'awaiting', noStats: false }],
    ['live', { badge: 'live', status: null, noStats: false }],
    ['bye', { badge: 'bye', status: null, noStats: true }],
    ['forfeit', { badge: 'forfeit', status: null, noStats: true }],
  ])('state %s → no score, correct badge/status', (state, expected) => {
    const node = matchNodeModel(
      row({ id: 7, competitor_a: 11, competitor_b: 22, score_a: 16, score_b: 3, state }),
      names,
      seeds,
      null,
    )!;
    expect(node.scored).toBe(false);
    // even though score_a/score_b carry values on the row, an unscored state NEVER exposes them
    expect(node.competitors[0].score).toBeNull();
    expect(node.competitors[1].score).toBeNull();
    expect(node.badge).toBe(expected.badge);
    expect(node.status).toBe(expected.status);
    expect(node.noStats).toBe(expected.noStats);
  });

  it('void → null (render nothing)', () => {
    expect(matchNodeModel(row({ id: 8, state: 'void' }), names, seeds, null)).toBeNull();
  });

  it('an unseated slot is TBD (null name) and a removed player falls back to unknownPlayer', () => {
    const node = matchNodeModel(
      row({ id: 9, competitor_a: 99 /* removed — not in names */, competitor_b: null /* TBD */, state: 'declared' }),
      names,
      seeds,
      null,
    )!;
    expect(node.competitors[0].name).toBe(es.unknownPlayer);
    expect(node.competitors[1].name).toBeNull(); // TBD
    expect(node.competitors[1].seed).toBeNull();
  });
});

describe('detectChampion — the ONLY gold node (AC2, AD-21)', () => {
  const gf1 = (over: Partial<MatchRow>) =>
    row({ id: 100, bracket: 'grand_final', bracket_position: 'Grand Final', gf_order: 1, competitor_a: 11, competitor_b: 22, ...over });
  const gf2 = (over: Partial<MatchRow>) =>
    row({ id: 200, bracket: 'grand_final', bracket_position: 'Grand Final (reset)', gf_order: 2, competitor_a: 22, competitor_b: 11, ...over });

  it('side-A (Winners champ) wins game 1 outright → champion is game 1', () => {
    const champ = detectChampion([gf1({ winner_entry: 11, state: 'resolved' }), gf2({ state: 'declared' })]);
    expect(champ).toEqual({ entryId: 11, matchId: 100 });
  });

  it('side-B (Losers survivor) wins game 1 → reset pending → NO champion yet', () => {
    const champ = detectChampion([gf1({ winner_entry: 22, state: 'resolved' }), gf2({ state: 'declared' })]);
    expect(champ).toBeNull();
  });

  it('the reset (gf_order=2) resolves → champion is the reset winner', () => {
    const champ = detectChampion([gf1({ winner_entry: 22, state: 'resolved' }), gf2({ winner_entry: 22, state: 'resolved' })]);
    expect(champ).toEqual({ entryId: 22, matchId: 200 });
  });

  it('no resolved grand final → no champion', () => {
    expect(detectChampion([gf1({ state: 'live' })])).toBeNull();
  });

  it('marks only the champion grand-final node isChampion', () => {
    const groups = groupBracket(
      [gf1({ winner_entry: 11, state: 'resolved', score_a: 16, score_b: 12 }), gf2({ state: 'declared' })],
      names,
      seeds,
    );
    expect(groups.grandFinal.find((n) => n.id === 100)!.isChampion).toBe(true);
    expect(groups.grandFinal.find((n) => n.id === 200)!.isChampion).toBe(false);
  });
});

describe('groupBracket — grouping + slot order + void drop', () => {
  it('groups by bracket, orders by bracket_slot, and drops void nodes', () => {
    const groups = groupBracket(
      [
        row({ id: 1, bracket: 'winners', bracket_slot: 2, competitor_a: 11, competitor_b: 22 }),
        row({ id: 2, bracket: 'winners', bracket_slot: 0, competitor_a: 33, competitor_b: 11 }),
        row({ id: 3, bracket: 'losers', bracket_slot: 0, state: 'void' }),
        row({ id: 4, bracket: 'losers', bracket_slot: 1, competitor_a: 22, competitor_b: null }),
        row({ id: 5, bracket: 'grand_final', bracket_slot: 0, gf_order: 1, competitor_a: 11, competitor_b: 22 }),
      ],
      names,
      seeds,
    );
    expect(groups.winners.map((n) => n.id)).toEqual([2, 1]); // slot 0 before slot 2
    expect(groups.losers.map((n) => n.id)).toEqual([4]); // the void (id 3) is dropped
    expect(groups.grandFinal.map((n) => n.id)).toEqual([5]);
  });

  it('empty input → three empty groups', () => {
    expect(groupBracket([], names, seeds)).toEqual({ winners: [], losers: [], grandFinal: [] });
  });

  it('orders the two grand-final rows game-1-before-reset despite a SHARED bracket_slot=0 and reversed input', () => {
    // Both GF rows sit at bracket_slot=0 (generate.ts:458-463); only gf_order disambiguates them. Feed the
    // reset (gf_order=2) FIRST — without the gf_order tiebreak it would render above the game it resets.
    const groups = groupBracket(
      [
        row({ id: 200, bracket: 'grand_final', bracket_position: 'Grand Final (reset)', bracket_slot: 0, gf_order: 2 }),
        row({ id: 100, bracket: 'grand_final', bracket_position: 'Grand Final', bracket_slot: 0, gf_order: 1 }),
      ],
      names,
      seeds,
    );
    expect(groups.grandFinal.map((n) => n.id)).toEqual([100, 200]); // game 1 (gf_order=1) first, reset second
  });
});

describe('collectCompetitorIds', () => {
  it('gathers competitor_a/b + winner_entry, unique, skipping nulls', () => {
    const ids = collectCompetitorIds([
      row({ id: 1, competitor_a: 11, competitor_b: 22, winner_entry: 11 }),
      row({ id: 2, competitor_a: 33, competitor_b: null, winner_entry: null }),
    ]);
    expect(ids.sort((a, b) => a - b)).toEqual([11, 22, 33]);
  });
});
