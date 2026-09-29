import { describe, it, expect } from 'vitest';
import { type PlayerHeadline, type RawPlayerMatch, buildPlayerDetail } from '@/lib/player/model';
import { es } from '@/lib/i18n/es';

/**
 * Pins the pure player-detail model (Story 5.7, Task 7/AC6): the base K/D/A + rate formatting (sin datos on
 * NULL), the weird demo-only totals, and the raw matches-behind list (opponent, win/loss relative to the
 * player, score, most-recent-first). No re-aggregation — every headline number is the leaderboard row's.
 */
function headline(over: Partial<PlayerHeadline> = {}): PlayerHeadline {
  return {
    steamid64: '76561190000000011',
    display_name: 'Theo',
    kills_total: 21,
    deaths_total: 18,
    assists_total: 5,
    adr: 124.1,
    hs_pct: 0.48,
    kast_pct: 0.71,
    knife_kills_total: 4,
    wallbang_kills_total: 2,
    through_smoke_kills_total: 1,
    no_scope_kills_total: 1,
    blind_kills_total: 1,
    ...over,
  };
}

const names = new Map<number, string>([
  [22, 'Dex'],
  [33, 'Mara'],
]);

describe('buildPlayerDetail — headline (AC6)', () => {
  it('shapes base stats: K/D/A in the fixed "Muertes / Bajas / Asist." order (deaths/kills/assists) + rates', () => {
    const d = buildPlayerDetail(headline(), 4, 11, [], names);
    expect(d.name).toBe('Theo');
    expect(d.seed).toBe(4);
    expect(d.base.kda).toBe('18 / 21 / 5'); // deaths / kills / assists, matching the label
    expect(d.base.adr).toBe('124.1');
    expect(d.base.hsPct).toBe('48%');
    expect(d.base.kast).toBe('71%');
  });

  it('renders sin datos for NULL rate values (0-opportunity)', () => {
    const d = buildPlayerDetail(headline({ adr: null, hs_pct: null, kast_pct: null }), null, null, [], names);
    expect(d.base.adr).toBe(es.player.noData);
    expect(d.base.hsPct).toBe(es.player.noData);
  });

  it('maps the five weird demo-only totals', () => {
    const d = buildPlayerDetail(headline(), 4, 11, [], names);
    expect(d.weird.map((w) => [w.key, w.value])).toEqual([
      ['knife', 4],
      ['wallbang', 2],
      ['smoke', 1],
      ['noScope', 1],
      ['blind', 1],
    ]);
    expect(d.weird[0].label).toBe(es.player.weird.knife);
  });

  it('falls back to the steamid tail when display_name is null', () => {
    const d = buildPlayerDetail(headline({ display_name: null }), null, null, [], names);
    expect(d.name).toBe('#0011');
  });
});

describe('buildPlayerDetail — matches behind them (FR-23)', () => {
  function m(over: Partial<RawPlayerMatch> & { match_id: number }): RawPlayerMatch {
    return {
      bracket_position: 'Winners R1',
      competitor_a: 11, // this player
      competitor_b: 22, // Dex
      winner_entry: 11,
      score_a: 16,
      score_b: 13,
      state: 'resolved',
      demo_id: 9,
      ...over,
    };
  }

  it('resolves the opponent, the outcome relative to the player, and the player-first score', () => {
    const d = buildPlayerDetail(headline(), 4, 11, [m({ match_id: 1 })], names);
    expect(d.matches[0]).toMatchObject({
      matchId: 1,
      position: 'Winners R1',
      opponent: 'Dex',
      outcome: 'win',
      scoreSelf: 16,
      scoreOpp: 13,
      verified: true,
    });
  });

  it('orients score/outcome when the player is competitor_b (a loss)', () => {
    // player 11 sits in seat B; seat A (Dex, 22) won 16-9
    const d = buildPlayerDetail(
      headline(),
      4,
      11,
      [m({ match_id: 2, competitor_a: 22, competitor_b: 11, winner_entry: 22, score_a: 16, score_b: 9 })],
      names,
    );
    expect(d.matches[0]).toMatchObject({ opponent: 'Dex', outcome: 'loss', scoreSelf: 9, scoreOpp: 16 });
  });

  it('does not expose a score for an unscored match', () => {
    const d = buildPlayerDetail(headline(), 4, 11, [m({ match_id: 3, state: 'live', demo_id: null })], names);
    expect(d.matches[0]).toMatchObject({ outcome: null, scoreSelf: null, scoreOpp: null, verified: false });
  });

  it('sorts matches most-recent-first (by match_id desc) and aggregates the verified provenance flag', () => {
    const d = buildPlayerDetail(
      headline(),
      4,
      11,
      [m({ match_id: 1, demo_id: null }), m({ match_id: 3 }), m({ match_id: 2, demo_id: null })],
      names,
    );
    expect(d.matches.map((x) => x.matchId)).toEqual([3, 2, 1]);
    expect(d.verified).toBe(true); // match 3 has a demo bound
  });

  it('degrades a removed opponent to unknownPlayer', () => {
    const d = buildPlayerDetail(headline(), 4, 11, [m({ match_id: 1, competitor_b: 99 })], names);
    expect(d.matches[0].opponent).toBe(es.unknownPlayer);
  });

  it('a REMOVED player (null roster id) gets a neutral row — never a fabricated loss, swapped score, or self-opponent', () => {
    // The player was removed after playing, so their active-only roster_entry read returns nothing →
    // playerRosterId is null. We cannot orient the seat, so the row must NOT claim a loss, must not swap the
    // seat-B score, and must not list the player (seat B here, id 11) as their own opponent.
    const d = buildPlayerDetail(
      headline(),
      null, // no seed
      null, // ← removed: roster id unknown
      [m({ match_id: 7, competitor_a: 22, competitor_b: 11, winner_entry: 22, score_a: 16, score_b: 9 })],
      names,
    );
    expect(d.matches[0]).toMatchObject({
      opponent: es.bracket.tbd, // NOT the player themselves
      outcome: null, // NOT a fabricated loss
      scoreSelf: null, // no orientation → no score shown
      scoreOpp: null,
    });
  });
});
