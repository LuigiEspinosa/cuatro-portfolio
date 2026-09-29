import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchBracketSnapshot } from '@/lib/bracket/read';
import { es } from '@/lib/i18n/es';

/**
 * Pins the bracket read seam (Story 5.7, AC2/AC7/AC8) with a faked client (à la lib/feed/read.test.ts):
 * the match read is ordered by bracket_slot + scoped to the tournament, names/seeds resolve via batched
 * queries, and the snapshot degrades gracefully. The pure shaping is proven in model.test.ts; this proves
 * the I/O wiring.
 */
interface QueryBuilder {
  select: (...a: unknown[]) => QueryBuilder;
  eq: (...a: unknown[]) => QueryBuilder;
  in: (...a: unknown[]) => QueryBuilder;
  order: (...a: unknown[]) => QueryBuilder;
  then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => Promise<unknown>;
}

function makeClient(plan: Record<string, Array<{ data?: unknown; error?: unknown }>> = {}) {
  const ops: { table: string; method: string; args: unknown[] }[] = [];
  const queues: Record<string, Array<{ data?: unknown; error?: unknown }>> = {};
  for (const [t, rs] of Object.entries(plan)) queues[t] = [...rs];

  function makeBuilder(table: string, result: { data?: unknown; error?: unknown }): QueryBuilder {
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
  return { client, opsFor };
}

const T = 7;

describe('fetchBracketSnapshot (AC2/AC7/AC8)', () => {
  it('reads scoped + ordered by bracket_slot, resolves names + seeds, and shapes a resolved node', () => {
    const setup = makeClient({
      match: [
        {
          data: [
            { id: 5, tournament_id: T, bracket: 'winners', bracket_position: 'Winners R1', bracket_slot: 0, gf_order: null, competitor_a: 11, competitor_b: 22, winner_entry: 11, score_a: 16, score_b: 13, state: 'resolved', demo_id: 9 },
          ],
          error: null,
        },
      ],
      roster_entry: [
        // resolveNames issues the FIRST roster_entry query (id → steamid64); resolveSeeds the SECOND (id → bracket_seed)
        { data: [{ id: 11, steamid64: '76561190000000011' }, { id: 22, steamid64: '76561190000000022' }], error: null },
        { data: [{ id: 11, bracket_seed: 1 }, { id: 22, bracket_seed: 4 }], error: null },
      ],
      player: [{ data: [{ steamid64: '76561190000000011', display_name: 'Dex' }, { steamid64: '76561190000000022', display_name: 'Theo' }], error: null }],
    });

    return fetchBracketSnapshot(setup.client, T).then((snap) => {
      expect(snap.ok).toBe(true);
      if (!snap.ok) return;
      // scoped + ordered
      expect(setup.opsFor('match', 'eq')[0].args).toEqual(['tournament_id', T]);
      expect(setup.opsFor('match', 'order')[0].args).toEqual(['bracket_slot', { ascending: true }]);
      const node = snap.groups.winners[0];
      expect(node.competitors[0]).toMatchObject({ name: 'Dex', seed: 1, score: 16, outcome: 'win' });
      expect(node.competitors[1]).toMatchObject({ name: 'Theo', seed: 4, score: 13, outcome: 'loss' });
    });
  });

  it('empty bracket → three empty groups, and issues NO name/seed queries', async () => {
    const { client, opsFor } = makeClient({ match: [{ data: [], error: null }] });
    const snap = await fetchBracketSnapshot(client, T);
    expect(snap).toEqual({ ok: true, groups: { winners: [], losers: [], grandFinal: [] } });
    expect(opsFor('roster_entry', 'select')).toHaveLength(0);
  });

  it('fails closed (read_failed) when the match read errors', async () => {
    const { client } = makeClient({ match: [{ data: null, error: { message: 'boom' } }] });
    expect(await fetchBracketSnapshot(client, T)).toEqual({ ok: false, reason: 'read_failed' });
  });

  it('still shapes nodes (neutral names, no seeds) when the name/seed joins error', async () => {
    const { client } = makeClient({
      match: [{ data: [{ id: 5, tournament_id: T, bracket: 'winners', bracket_position: 'Winners R1', bracket_slot: 0, gf_order: null, competitor_a: 11, competitor_b: 22, winner_entry: null, score_a: null, score_b: null, state: 'declared', demo_id: null }], error: null }],
      roster_entry: [{ data: null, error: { message: 'boom' } }, { data: null, error: { message: 'boom' } }],
    });
    const snap = await fetchBracketSnapshot(client, T);
    if (!snap.ok) throw new Error('expected ok');
    const node = snap.groups.winners[0];
    expect(node.competitors[0].name).toBe(es.unknownPlayer);
    expect(node.competitors[0].seed).toBeNull();
    expect(node.status).toBe('por_jugar');
  });
});
