import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchFeedSnapshot,
  fetchRegisteredCount,
  resolveCurrentTournament,
  livePillState,
  ceremonyUnlocked,
} from '@/lib/feed/read';

/**
 * A chainable + thenable PostgREST builder stub (mirrors lib/roster.test.ts). Every filter/select
 * method returns the same builder and records its call; awaiting the builder (`.then`) or calling
 * `.maybeSingle()` resolves to the queued result for that table's `from(...)` call. Records ops so a
 * test can assert the read was ordered by `id desc` and that no name queries fire on an empty feed.
 */
interface QueryBuilder {
  select: (...a: unknown[]) => QueryBuilder;
  eq: (...a: unknown[]) => QueryBuilder;
  in: (...a: unknown[]) => QueryBuilder;
  order: (...a: unknown[]) => QueryBuilder;
  limit: (...a: unknown[]) => QueryBuilder;
  maybeSingle: () => Promise<unknown>;
  then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => Promise<unknown>;
}

function makeClient(plan: Record<string, Array<{ data?: unknown; error?: unknown; count?: number }>> = {}) {
  const ops: { table: string; method: string; args: unknown[] }[] = [];
  const queues: Record<string, Array<{ data?: unknown; error?: unknown; count?: number }>> = {};
  for (const [t, rs] of Object.entries(plan)) queues[t] = [...rs];

  function makeBuilder(table: string, result: { data?: unknown; error?: unknown; count?: number }): QueryBuilder {
    const builder = {} as QueryBuilder;
    const rec =
      (method: string) =>
      (...args: unknown[]) => {
        ops.push({ table, method, args });
        return builder;
      };
    builder.select = rec('select');
    builder.eq = rec('eq');
    builder.in = rec('in');
    builder.order = rec('order');
    builder.limit = rec('limit');
    builder.maybeSingle = () => {
      ops.push({ table, method: 'maybeSingle', args: [] });
      return Promise.resolve(result);
    };
    builder.then = (onF, onR) => Promise.resolve(result).then(onF, onR);
    return builder;
  }

  const from = (table: string) => {
    const q = queues[table];
    const result = q && q.length ? q.shift()! : { data: null, error: null };
    return makeBuilder(table, result);
  };
  const client = { from } as unknown as SupabaseClient;
  const opsFor = (table: string, method: string) => ops.filter((o) => o.table === table && o.method === method);
  return { client, ops, opsFor };
}

const T = 7;

function matchRow(id: number, detail: Record<string, unknown>, targetMatchId: number | null = 1) {
  return {
    id,
    tournament_id: T,
    entry_type: 'match_result',
    occurred_at: '2026-07-28T21:12:00Z',
    target_match_id: targetMatchId,
    detail,
  };
}

describe('fetchFeedSnapshot (AC1/AC4/AC8)', () => {
  it('reads newest-first (order by id desc) and resolves names via the roster→player join', async () => {
    const { client, opsFor } = makeClient({
      timeline_feed: [
        {
          data: [
            matchRow(5, { winner_entry: 11, loser_entry: 22, score_a: 16, score_b: 13, bracket_position: 'Winners R1', demo_sha256: 'a3f1c9e2deadbeef7b40' }),
            matchRow(3, { winner_entry: 33, loser_entry: 11, score_a: 16, score_b: 9, bracket_position: 'Winners R1' }),
          ],
          error: null,
        },
      ],
      roster_entry: [
        {
          data: [
            { id: 11, steamid64: '76561190000000011' },
            { id: 22, steamid64: '76561190000000022' },
            { id: 33, steamid64: '76561190000000033' },
          ],
          error: null,
        },
      ],
      player: [
        {
          data: [
            { steamid64: '76561190000000011', display_name: 'Dex' },
            { steamid64: '76561190000000022', display_name: 'Theo' },
            { steamid64: '76561190000000033', display_name: 'Mara' },
          ],
          error: null,
        },
      ],
    });

    const result = await fetchFeedSnapshot(client, T);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // ordering key is id desc — asserted on the query AND preserved in the output order
    const order = opsFor('timeline_feed', 'order');
    expect(order).toHaveLength(1);
    expect(order[0].args).toEqual(['id', { ascending: false }]);
    expect(result.cards.map((c) => c.id)).toEqual([5, 3]);

    const first = result.cards[0];
    if (first.kind !== 'match_result') throw new Error('kind');
    expect(first).toMatchObject({ winner: 'Dex', loser: 'Theo', verified: true, hash: 'a3f1c9e2…7b40' });
    // the read filtered on the tournament scope
    expect(opsFor('timeline_feed', 'eq')[0].args).toEqual(['tournament_id', T]);
  });

  it('tolerates a null target_match_id (links to the bracket root, no crash)', async () => {
    const { client } = makeClient({
      timeline_feed: [{ data: [matchRow(5, { winner_entry: 11, loser_entry: 22, score_a: 16, score_b: 13 }, null)], error: null }],
      roster_entry: [{ data: [{ id: 11, steamid64: '76561190000000011' }, { id: 22, steamid64: '76561190000000022' }], error: null }],
      player: [{ data: [{ steamid64: '76561190000000011', display_name: 'Dex' }, { steamid64: '76561190000000022', display_name: 'Theo' }], error: null }],
    });
    const result = await fetchFeedSnapshot(client, T);
    if (!result.ok) throw new Error('expected ok');
    expect(result.cards[0].href).toBe('/bracket');
  });

  it('degrades gracefully when a roster id does not resolve (removed player hidden from anon)', async () => {
    const { client } = makeClient({
      timeline_feed: [{ data: [matchRow(5, { winner_entry: 11, loser_entry: 22, score_a: 16, score_b: 13 })], error: null }],
      // roster viewer policy is active-only: the removed loser (22) is simply absent from the result
      roster_entry: [{ data: [{ id: 11, steamid64: '76561190000000011' }], error: null }],
      player: [{ data: [{ steamid64: '76561190000000011', display_name: 'Dex' }], error: null }],
    });
    const result = await fetchFeedSnapshot(client, T);
    if (!result.ok) throw new Error('expected ok');
    const card = result.cards[0];
    if (card.kind !== 'match_result') throw new Error('kind');
    expect(card.winner).toBe('Dex');
    expect(card.loser).toBe('Jugador retirado');
  });

  it('falls back to the steamid64 tail when the player row lacks a display_name', async () => {
    const { client } = makeClient({
      timeline_feed: [{ data: [matchRow(5, { winner_entry: 11, loser_entry: 22, score_a: 16, score_b: 13 })], error: null }],
      roster_entry: [{ data: [{ id: 11, steamid64: '76561190000000011' }, { id: 22, steamid64: '76561190000009999' }], error: null }],
      player: [{ data: [{ steamid64: '76561190000000011', display_name: 'Dex' }, { steamid64: '76561190000009999', display_name: null }], error: null }],
    });
    const result = await fetchFeedSnapshot(client, T);
    if (!result.ok) throw new Error('expected ok');
    const card = result.cards[0];
    if (card.kind !== 'match_result') throw new Error('kind');
    expect(card.loser).toBe('#9999');
  });

  it('returns an empty array for a feed with no rows — and issues NO name queries', async () => {
    const { client, opsFor } = makeClient({ timeline_feed: [{ data: [], error: null }] });
    const result = await fetchFeedSnapshot(client, T);
    expect(result).toEqual({ ok: true, cards: [] });
    expect(opsFor('roster_entry', 'select')).toHaveLength(0);
    expect(opsFor('player', 'select')).toHaveLength(0);
  });

  it('fails closed (read_failed) when the timeline read errors', async () => {
    const { client } = makeClient({ timeline_feed: [{ data: null, error: { message: 'boom' } }] });
    expect(await fetchFeedSnapshot(client, T)).toEqual({ ok: false, reason: 'read_failed' });
  });

  it('still renders cards (neutral names) when the name join errors — a broken join never blanks a result', async () => {
    const { client } = makeClient({
      timeline_feed: [{ data: [matchRow(5, { winner_entry: 11, loser_entry: 22, score_a: 16, score_b: 13 })], error: null }],
      roster_entry: [{ data: null, error: { message: 'boom' } }],
    });
    const result = await fetchFeedSnapshot(client, T);
    if (!result.ok) throw new Error('expected ok');
    const card = result.cards[0];
    if (card.kind !== 'match_result') throw new Error('kind');
    expect(card.winner).toBe('Jugador retirado');
    expect(card.loser).toBe('Jugador retirado');
  });
});

describe('resolveCurrentTournament', () => {
  it('returns the newest tournament id + state', async () => {
    const { client } = makeClient({ tournament: [{ data: { id: T, state: 'bracket_live' }, error: null }] });
    expect(await resolveCurrentTournament(client)).toEqual({ ok: true, id: T, state: 'bracket_live' });
  });

  it('returns no_tournament when none exists', async () => {
    const { client } = makeClient({ tournament: [{ data: null, error: null }] });
    expect(await resolveCurrentTournament(client)).toEqual({ ok: false, reason: 'no_tournament' });
  });

  it('fails closed (read_failed) on a read error', async () => {
    const { client } = makeClient({ tournament: [{ data: null, error: { message: 'boom' } }] });
    expect(await resolveCurrentTournament(client)).toEqual({ ok: false, reason: 'read_failed' });
  });
});

describe('fetchRegisteredCount', () => {
  it('returns the exact active count', async () => {
    const { client } = makeClient({ roster_entry: [{ count: 8, error: null }] });
    expect(await fetchRegisteredCount(client, T)).toBe(8);
  });
  it('returns 0 on error (the pill still renders)', async () => {
    const { client } = makeClient({ roster_entry: [{ count: undefined, error: { message: 'boom' } }] });
    expect(await fetchRegisteredCount(client, T)).toBe(0);
  });
});

describe('livePillState / ceremonyUnlocked (AC1/AC6 — static state mapping)', () => {
  it('maps tournament.state to the pill state', () => {
    expect(livePillState('bracket_live')).toBe('on');
    expect(livePillState('ceremony')).toBe('final');
    expect(livePillState('closed')).toBe('final');
    expect(livePillState('registration_open')).toBe('off');
    expect(livePillState('registration_closed')).toBe('off');
  });
  it('unlocks Ceremonia only from ceremony/closed', () => {
    expect(ceremonyUnlocked('ceremony')).toBe(true);
    expect(ceremonyUnlocked('closed')).toBe(true);
    expect(ceremonyUnlocked('bracket_live')).toBe(false);
    expect(ceremonyUnlocked('registration_open')).toBe(false);
  });
});
