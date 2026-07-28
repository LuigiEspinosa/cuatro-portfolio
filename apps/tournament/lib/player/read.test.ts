import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchPlayerDetail } from '@/lib/player/read';

/**
 * Pins the player-detail read seam (Story 5.7, AC6/AC8): the ONE leaderboard row + roster identity + the
 * approved stat_row×match embed, the graceful not-found, and fail-closed on error. The pure shaping is in
 * model.test.ts. The faked builder resolves `.maybeSingle()` and awaited chains to queued per-table results.
 */
interface QueryBuilder {
  select: (...a: unknown[]) => QueryBuilder;
  eq: (...a: unknown[]) => QueryBuilder;
  in: (...a: unknown[]) => QueryBuilder;
  limit: (...a: unknown[]) => QueryBuilder;
  maybeSingle: () => Promise<unknown>;
  then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => Promise<unknown>;
}

function makeClient(plan: Record<string, Array<{ data?: unknown; error?: unknown }>> = {}) {
  const queues: Record<string, Array<{ data?: unknown; error?: unknown }>> = {};
  for (const [t, rs] of Object.entries(plan)) queues[t] = [...rs];

  function makeBuilder(result: { data?: unknown; error?: unknown }): QueryBuilder {
    const builder = {} as QueryBuilder;
    const self = () => builder;
    builder.select = self;
    builder.eq = self;
    builder.in = self;
    builder.limit = self;
    builder.maybeSingle = () => Promise.resolve(result);
    builder.then = (onF, onR) => Promise.resolve(result).then(onF, onR);
    return builder;
  }

  const from = (table: string) => {
    const q = queues[table];
    const result = q && q.length ? q.shift()! : { data: null, error: null };
    return makeBuilder(result);
  };
  const client = { from } as unknown as SupabaseClient;
  return { client };
}

const SID = '76561190000000011';

describe('fetchPlayerDetail (AC6/AC8)', () => {
  it('shapes the detail from the leaderboard row + the approved stat_row×match embed', async () => {
    const { client } = makeClient({
      leaderboard: [
        {
          data: {
            steamid64: SID,
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
          },
          error: null,
        },
      ],
      roster_entry: [
        // 1st: the identity read (maybeSingle) — this player's roster id + seed
        { data: { id: 11, bracket_seed: 4 }, error: null },
        // 2nd: resolveNames' opponent lookup (id → steamid64) for competitor 22
        { data: [{ id: 22, steamid64: '76561190000000022' }], error: null },
      ],
      stat_row: [
        {
          data: [
            { match_id: 5, match: { bracket_position: 'Winners R1', competitor_a: 11, competitor_b: 22, winner_entry: 11, score_a: 16, score_b: 13, state: 'resolved', demo_id: 9 } },
            // a null-match stat row (unbound) is filtered out
            { match_id: null, match: null },
          ],
          error: null,
        },
      ],
      player: [{ data: [{ steamid64: '76561190000000022', display_name: 'Dex' }], error: null }],
    });

    const result = await fetchPlayerDetail(client, SID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.detail.name).toBe('Theo');
    expect(result.detail.seed).toBe(4);
    expect(result.detail.base.kda).toBe('18 / 21 / 5');
    // resolveNames queried roster_entry(id 22)→steamid64→player(display_name)
    expect(result.detail.matches).toHaveLength(1);
    expect(result.detail.matches[0]).toMatchObject({ opponent: 'Dex', outcome: 'win', scoreSelf: 16, scoreOpp: 13 });
  });

  it('returns not_found when the player has no leaderboard row (never played / all idle-DQ)', async () => {
    const { client } = makeClient({ leaderboard: [{ data: null, error: null }] });
    expect(await fetchPlayerDetail(client, SID)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('fails closed (read_failed) when the leaderboard read errors', async () => {
    const { client } = makeClient({ leaderboard: [{ data: null, error: { message: 'boom' } }] });
    expect(await fetchPlayerDetail(client, SID)).toEqual({ ok: false, reason: 'read_failed' });
  });
});
