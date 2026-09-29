import { describe, it, expect } from 'vitest';
import { type LeaderboardRow, buildBoard, formatPct, formatRate, nameOfRow } from '@/lib/leaderboard/model';
import { es } from '@/lib/i18n/es';

/**
 * Pins the pure leaderboard board model (Story 5.7, Task 5/AC4/AC5): Tasa/Volumen board definitions, sort,
 * hide-below-floor on RATE boards only, the eligibility mapping, and the `sin datos` NULL rendering. Reads
 * the view's `eligible_rate` flag — never re-derives the 24/20 floors.
 */
function row(over: Partial<LeaderboardRow> & { steamid64: string }): LeaderboardRow {
  return {
    display_name: 'P',
    matches_played: 2,
    rounds_played_total: 40,
    kills_total: 30,
    adr: 90,
    kast_pct: 0.7,
    hs_pct: 0.4,
    deaths_total: 20,
    assists_total: 5,
    knife_kills_total: 1,
    wallbang_kills_total: 0,
    through_smoke_kills_total: 0,
    no_scope_kills_total: 0,
    blind_kills_total: 0,
    entry_frags_total: 5,
    opening_deaths_total: 3,
    meets_round_floor: true,
    meets_kill_floor: true,
    eligible_rate: true,
    ...over,
  };
}

describe('formatting (AC5/AC9)', () => {
  it('formats ADR to one decimal, coercing a PostgREST numeric string', () => {
    expect(formatRate(78.94)).toBe('78.9');
    expect(formatRate('101.7')).toBe('101.7');
  });
  it('renders sin datos for a NULL rate (0-opportunity denominator)', () => {
    expect(formatRate(null)).toBe(es.player.noData);
    expect(formatPct(null)).toBe(es.player.noData);
  });
  it('formats a 0..1 fraction as an integer percent', () => {
    expect(formatPct(0.48)).toBe('48%');
    expect(formatPct('0.706')).toBe('71%');
  });
  it('falls back to the steamid tail when display_name is null', () => {
    expect(nameOfRow({ display_name: null, steamid64: '76561190000001234' })).toBe('#1234');
    expect(nameOfRow({ display_name: 'Dex', steamid64: 'x' })).toBe('Dex');
  });
  it('falls back to the steamid tail for an EMPTY-string display_name (not just null), matching resolveNames', () => {
    // '' is truthy-falsy but not nullish — a `??` would leak a blank name; `||` tails it like the resolver does.
    expect(nameOfRow({ display_name: '', steamid64: '76561190000001234' })).toBe('#1234');
  });
});

describe('buildBoard — rate (Tasa)', () => {
  it('sorts by ADR desc and HIDES below-floor players from the ranking (AC5)', () => {
    const board = buildBoard(
      [
        row({ steamid64: 'a', display_name: 'Alpha', adr: 90 }),
        row({ steamid64: 'b', display_name: 'Bravo', adr: 120 }),
        row({ steamid64: 'c', display_name: 'Charlie', adr: 200, eligible_rate: false, meets_round_floor: false }),
      ],
      'rate',
    );
    // Charlie has the highest ADR but fails the floor → NOT in the ranking despite the number
    expect(board.rows.map((r) => r.name)).toEqual(['Bravo', 'Alpha']);
    expect(board.rows[0]).toMatchObject({ rank: 1, primary: '120.0', secondary: '40%' });
    expect(board.rows[0].meta).toContain('KAST 70%');
  });

  it('renders sin datos for a NULL rate value in a row', () => {
    const board = buildBoard([row({ steamid64: 'a', adr: null })], 'rate');
    expect(board.rows[0].primary).toBe(es.player.noData);
  });
});

describe('buildBoard — volume (Volumen)', () => {
  it('sorts by Kills desc and keeps EVERYONE (the floor does not hide on volume — AC5)', () => {
    const board = buildBoard(
      [
        row({ steamid64: 'a', display_name: 'Alpha', kills_total: 18, knife_kills_total: 4 }),
        row({ steamid64: 'b', display_name: 'Bravo', kills_total: 29, knife_kills_total: 1 }),
        // below-floor but still present on a volume board
        row({ steamid64: 'c', display_name: 'Charlie', kills_total: 12, knife_kills_total: 2, eligible_rate: false, meets_round_floor: false }),
      ],
      'volume',
    );
    expect(board.rows.map((r) => r.name)).toEqual(['Bravo', 'Alpha', 'Charlie']);
    expect(board.rows[0]).toMatchObject({ rank: 1, primary: '29', secondary: '1' });
  });
});

describe('buildBoard — eligibility section (AC5)', () => {
  it('lists every player with rounds/kills + the eligible flag, eligible first', () => {
    const board = buildBoard(
      [
        row({ steamid64: 'dq', display_name: 'Juan', rounds_played_total: 19, kills_total: 12, eligible_rate: false, meets_round_floor: false }),
        row({ steamid64: 'ok', display_name: 'Dex', rounds_played_total: 44, kills_total: 29, eligible_rate: true }),
      ],
      'rate',
    );
    expect(board.eligibility.map((e) => e.name)).toEqual(['Dex', 'Juan']); // eligible sorts first
    expect(board.eligibility.find((e) => e.name === 'Juan')).toMatchObject({ rounds: 19, kills: 12, eligible: false });
  });

  it('empty input → empty board + empty eligibility', () => {
    expect(buildBoard([], 'rate')).toEqual({ kind: 'rate', rows: [], eligibility: [] });
  });
});
