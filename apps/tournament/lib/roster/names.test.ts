import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveNames } from '@/lib/roster/names';

/**
 * Pins the shared roster→player resolver (Story 5.7 Task 2) — the batched two-`in(...)`-query shaping and
 * every graceful-degradation edge 5.6 relied on, now that the bracket read reuses it too. The faked client
 * mirrors lib/feed/read.test.ts: a chainable/thenable builder that returns queued results per table and
 * records ops so a test can assert NO queries fire on empty input.
 */
interface QueryBuilder {
  select: (...a: unknown[]) => QueryBuilder;
  in: (...a: unknown[]) => QueryBuilder;
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
    builder.in = rec('in');
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

describe('resolveNames (AC7 — the shared batched roster→player resolver)', () => {
  it('resolves roster ids to display names via the two batched in(...) queries', async () => {
    const { client, opsFor } = makeClient({
      roster_entry: [{ data: [{ id: 11, steamid64: '76561190000000011' }, { id: 22, steamid64: '76561190000000022' }], error: null }],
      player: [{ data: [{ steamid64: '76561190000000011', display_name: 'Dex' }, { steamid64: '76561190000000022', display_name: 'Theo' }], error: null }],
    });
    const names = await resolveNames(client, [11, 22]);
    expect(names.get(11)).toBe('Dex');
    expect(names.get(22)).toBe('Theo');
    // exactly one batched lookup per table (the `in` filter), never per-id
    expect(opsFor('roster_entry', 'in')).toHaveLength(1);
    expect(opsFor('roster_entry', 'in')[0].args).toEqual(['id', [11, 22]]);
    expect(opsFor('player', 'in')).toHaveLength(1);
  });

  it('returns an empty map and issues NO queries for empty input', async () => {
    const { client, opsFor } = makeClient({});
    const names = await resolveNames(client, []);
    expect(names.size).toBe(0);
    expect(opsFor('roster_entry', 'select')).toHaveLength(0);
    expect(opsFor('player', 'select')).toHaveLength(0);
  });

  it('leaves a removed player OUT of the map (active-only roster policy hides them)', async () => {
    const { client } = makeClient({
      // id 22 was removed after playing → not returned by the active-only viewer read
      roster_entry: [{ data: [{ id: 11, steamid64: '76561190000000011' }], error: null }],
      player: [{ data: [{ steamid64: '76561190000000011', display_name: 'Dex' }], error: null }],
    });
    const names = await resolveNames(client, [11, 22]);
    expect(names.get(11)).toBe('Dex');
    expect(names.has(22)).toBe(false); // caller falls back to es.unknownPlayer
  });

  it('falls back to the steamid64 tail when a player row lacks a display_name', async () => {
    const { client } = makeClient({
      roster_entry: [{ data: [{ id: 11, steamid64: '76561190000009999' }], error: null }],
      player: [{ data: [{ steamid64: '76561190000009999', display_name: null }], error: null }],
    });
    const names = await resolveNames(client, [11]);
    expect(names.get(11)).toBe('#9999');
  });

  it('returns an empty map when the roster read errors (non-fatal — never blanks a published result)', async () => {
    const { client, opsFor } = makeClient({
      roster_entry: [{ data: null, error: { message: 'boom' } }],
    });
    const names = await resolveNames(client, [11]);
    expect(names.size).toBe(0);
    // it short-circuits — the player lookup never runs
    expect(opsFor('player', 'select')).toHaveLength(0);
  });

  it('returns an empty map when the player read errors', async () => {
    const { client } = makeClient({
      roster_entry: [{ data: [{ id: 11, steamid64: '76561190000000011' }], error: null }],
      player: [{ data: null, error: { message: 'boom' } }],
    });
    const names = await resolveNames(client, [11]);
    expect(names.size).toBe(0);
  });
});
