import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAwardCatalogCount, MAX_AWARDS } from '@/lib/awards/read';

const TOURNAMENT = 77;

function makeClient(rpcResult: { data?: unknown; error?: unknown }) {
  const from = vi.fn(() => {
    throw new Error('the viewer must NEVER select from award — AD-22 is a missing grant, not a blur');
  });
  const rpc = vi.fn((_fn: string, _args: Record<string, unknown>) => Promise.resolve(rpcResult));
  const client = { from, rpc } as unknown as SupabaseClient;
  return { client, from, rpc };
}

describe('fetchAwardCatalogCount — the ONE catalog fact a viewer may learn (AC4)', () => {
  it('calls award_catalog_count with the exact argument name and returns the integer', async () => {
    const { client, rpc, from } = makeClient({ data: 12, error: null });

    await expect(fetchAwardCatalogCount(client, TOURNAMENT)).resolves.toEqual({ ok: true, count: 12 });

    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('award_catalog_count');
    expect(args).toEqual({ p_tournament_id: TOURNAMENT });
    // ⛔ The read must NEVER touch the `award` table — the secrecy is the absent grant, not the CSS blur.
    expect(from).not.toHaveBeenCalled();
  });

  it('returns count 0 for a tournament with no catalog (the caller renders NOTHING, never `Premio 1 de 0`)', async () => {
    const { client } = makeClient({ data: 0, error: null });
    await expect(fetchAwardCatalogCount(client, TOURNAMENT)).resolves.toEqual({ ok: true, count: 0 });
  });

  it('reports read_failed on an RPC error', async () => {
    const { client } = makeClient({ data: null, error: { message: '42501: permission denied' } });
    await expect(fetchAwardCatalogCount(client, TOURNAMENT)).resolves.toEqual({
      ok: false,
      reason: 'read_failed',
    });
  });

  it('accepts a count at the catalog cap', async () => {
    const { client } = makeClient({ data: MAX_AWARDS, error: null });
    await expect(fetchAwardCatalogCount(client, TOURNAMENT)).resolves.toEqual({ ok: true, count: MAX_AWARDS });
  });

  it.each([MAX_AWARDS + 1, 5000, 1e21])(
    'fails closed on a count above the cap (%p) rather than rendering an unbounded list',
    async (data) => {
      // `Number.isInteger(1e21)` is TRUE — the same range gap `isPositiveInt` closes on the admin route. The RPC's
      // cap does not bind service_role or raw SQL, which are the only writers on `award`.
      const { client } = makeClient({ data, error: null });
      await expect(fetchAwardCatalogCount(client, TOURNAMENT)).resolves.toEqual({
        ok: false,
        reason: 'read_failed',
      });
    },
  );

  it.each([null, undefined, '12', 12.5, -1, { count: 12 }, [12]])(
    'fails closed on a non-count reply (%p) rather than rendering `Premio 1 de NaN`',
    async (data) => {
      const { client } = makeClient({ data, error: null });
      await expect(fetchAwardCatalogCount(client, TOURNAMENT)).resolves.toEqual({
        ok: false,
        reason: 'read_failed',
      });
    },
  );
});
