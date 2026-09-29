import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { curateAwardCatalog } from '@/lib/awards/curate';
import { AWARD_CATALOG, toCuratePayload } from '@/lib/awards/catalog';

const ADMIN = '76561198388441171';
/** Deliberately not 1, so an id/index mix-up cannot pass silently (the lib/match/*.test.ts convention). */
const TOURNAMENT = 77;

/**
 * The `.rpc()` seam mock (lib/match/bind.test.ts). The wrapper does NO table reads — the RPC is the sole
 * authority — so `from` is wired only to PIN that fact: a later pre-read turns the assertion red.
 */
function makeAdmin(rpcResult: { data?: unknown; error?: unknown } = { data: { ok: true, count: 12, before_count: 0 }, error: null }) {
  const from = vi.fn(() => {
    throw new Error('curate must not read tables — the RPC is the authority');
  });
  const rpc = vi.fn((_fn: string, _args: Record<string, unknown>) => Promise.resolve(rpcResult));
  const admin = { from, rpc } as unknown as SupabaseClient;
  return { admin, from, rpc };
}

describe('curateAwardCatalog — the RPC payload (AC1/AC2)', () => {
  it('calls curate_award_catalog with the EXACT snake_case arguments and the projected catalog', async () => {
    const { admin, rpc, from } = makeAdmin();

    const result = await curateAwardCatalog(admin, { actingAdmin: ADMIN, tournamentId: TOURNAMENT });
    expect(result).toEqual({ ok: true, count: 12, beforeCount: 0 });

    // ⚠ PIN EVERY ARGUMENT NAME — a typo'd key silently passes NULL into the RPC (the 4.1 review lesson).
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('curate_award_catalog');
    expect(Object.keys(args as object).sort()).toEqual(['p_actor', 'p_awards', 'p_tournament_id']);
    expect((args as Record<string, unknown>).p_tournament_id).toBe(TOURNAMENT);
    expect((args as Record<string, unknown>).p_actor).toBe(ADMIN);
    expect(from).not.toHaveBeenCalled();
  });

  it('posts the SEED catalog verbatim — 12 awards, projected, nothing re-derived', async () => {
    const { admin, rpc } = makeAdmin();
    await curateAwardCatalog(admin, { actingAdmin: ADMIN, tournamentId: TOURNAMENT });
    const args = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(args.p_awards).toEqual(toCuratePayload(AWARD_CATALOG));
    expect((args.p_awards as unknown[]).length).toBe(12);
  });

  it('never sends award identity COPY (statLabel) over the wire (AD-22)', async () => {
    const { admin, rpc } = makeAdmin();
    await curateAwardCatalog(admin, { actingAdmin: ADMIN, tournamentId: TOURNAMENT });
    const args = rpc.mock.calls[0][1] as Record<string, unknown>;
    for (const row of args.p_awards as Record<string, unknown>[]) {
      expect(row).not.toHaveProperty('statLabel');
    }
  });

  it('accepts an explicit catalog (the re-curation path — a swapped priority pair)', async () => {
    const { admin, rpc } = makeAdmin({ data: { ok: true, count: 12, before_count: 12 }, error: null });
    // Swap the priorities of the first two awards — an ordinary edit, and the reason the DB UNIQUE is DEFERRED.
    const swapped = AWARD_CATALOG.map((a) =>
      a.priority === 1 ? { ...a, priority: 2 } : a.priority === 2 ? { ...a, priority: 1 } : a,
    );
    const result = await curateAwardCatalog(admin, {
      actingAdmin: ADMIN,
      tournamentId: TOURNAMENT,
      awards: swapped,
    });
    expect(result).toEqual({ ok: true, count: 12, beforeCount: 12 });
    const args = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(args.p_awards).toEqual(toCuratePayload(swapped));
  });

  it('is idempotent at this layer — a re-post sends a byte-identical payload', async () => {
    const { admin, rpc } = makeAdmin({ data: { ok: true, count: 12, before_count: 12 }, error: null });
    await curateAwardCatalog(admin, { actingAdmin: ADMIN, tournamentId: TOURNAMENT });
    await curateAwardCatalog(admin, { actingAdmin: ADMIN, tournamentId: TOURNAMENT });
    expect(rpc.mock.calls[0][1]).toEqual(rpc.mock.calls[1][1]);
  });
});

describe('curateAwardCatalog — typed refusals surfaced verbatim, nothing written (AC2)', () => {
  it.each([
    'no_tournament',
    'catalog_frozen',
    'empty_catalog',
    'too_many_awards',
    'duplicate_name',
    'duplicate_priority',
    'invalid_award',
  ])('surfaces `%s` verbatim', async (reason) => {
    const { admin } = makeAdmin({ data: { ok: false, reason }, error: null });
    await expect(
      curateAwardCatalog(admin, { actingAdmin: ADMIN, tournamentId: TOURNAMENT }),
    ).resolves.toEqual({ ok: false, reason });
  });

  it('fails CLOSED on an unrecognised refusal reason (never invents an ok)', async () => {
    const { admin } = makeAdmin({ data: { ok: false, reason: 'something_new' }, error: null });
    await expect(
      curateAwardCatalog(admin, { actingAdmin: ADMIN, tournamentId: TOURNAMENT }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });

  it('fails closed on a null reply', async () => {
    const { admin } = makeAdmin({ data: null, error: null });
    await expect(
      curateAwardCatalog(admin, { actingAdmin: ADMIN, tournamentId: TOURNAMENT }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });

  it('maps a transport/SQL error to write_failed and does NOT map another lib\'s SQLSTATE', async () => {
    // P0001 is lib/match/format.ts's `already_locked`; IC907 is manual-score's. Mapping either here would hijack
    // another lib's refusal vocabulary — this lib raises nothing of its own (0023's header).
    for (const code of ['P0001', 'IC907', '23514', '23505']) {
      const { admin } = makeAdmin({ data: null, error: { code, message: `boom ${code}` } });
      await expect(
        curateAwardCatalog(admin, { actingAdmin: ADMIN, tournamentId: TOURNAMENT }),
      ).resolves.toEqual({ ok: false, reason: 'write_failed' });
    }
  });

  it('rejects an ok reply that is missing `count` / `before_count` (no silent success)', async () => {
    for (const data of [{ ok: true }, { ok: true, count: 12 }, { ok: true, before_count: 0 }, { ok: true, count: '12', before_count: 0 }]) {
      const { admin } = makeAdmin({ data, error: null });
      await expect(
        curateAwardCatalog(admin, { actingAdmin: ADMIN, tournamentId: TOURNAMENT }),
      ).resolves.toEqual({ ok: false, reason: 'write_failed' });
    }
  });

  it('carries a NON-ZERO before_count through (the re-curation evidence, not just a bare ok)', async () => {
    const { admin } = makeAdmin({ data: { ok: true, count: 12, before_count: 9 }, error: null });
    await expect(
      curateAwardCatalog(admin, { actingAdmin: ADMIN, tournamentId: TOURNAMENT }),
    ).resolves.toEqual({ ok: true, count: 12, beforeCount: 9 });
  });
});
