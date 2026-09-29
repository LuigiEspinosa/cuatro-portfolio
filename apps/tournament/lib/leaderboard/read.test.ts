import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchLeaderboard } from '@/lib/leaderboard/read';

/**
 * Pins the leaderboard read seam (Story 5.7, AC4/AC8): it reads the SINGLE `public.leaderboard` view once
 * and returns the raw rows, failing closed on error. The board shaping is proven in model.test.ts.
 */
function makeClient(result: { data?: unknown; error?: unknown }) {
  const ops: { table: string; method: string }[] = [];
  const builder = {
    select: (..._a: unknown[]) => {
      ops.push({ table: 'leaderboard', method: 'select' });
      return Promise.resolve(result);
    },
  };
  const client = { from: (_t: string) => builder } as unknown as SupabaseClient;
  return { client, ops };
}

describe('fetchLeaderboard (AC4/AC8)', () => {
  it('returns the raw view rows', async () => {
    const rows = [{ steamid64: 'a', display_name: 'Dex', kills_total: 30, eligible_rate: true }];
    const { client, ops } = makeClient({ data: rows, error: null });
    const snap = await fetchLeaderboard(client);
    expect(snap).toEqual({ ok: true, rows });
    expect(ops).toHaveLength(1); // one read of the ONE view (AD-20)
  });

  it('empty view → ok with no rows', async () => {
    const { client } = makeClient({ data: [], error: null });
    expect(await fetchLeaderboard(client)).toEqual({ ok: true, rows: [] });
  });

  it('fails closed (read_failed) on a read error', async () => {
    const { client } = makeClient({ data: null, error: { message: 'boom' } });
    expect(await fetchLeaderboard(client)).toEqual({ ok: false, reason: 'read_failed' });
  });
});
