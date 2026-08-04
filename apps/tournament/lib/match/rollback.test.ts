import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { rollbackMatch } from '@/lib/match/rollback';

const ADMIN = '76561198388441171';
/** Ids deliberately NOT 1..n, so an index/id mix-up cannot pass silently (mirrors approve.test.ts). */
const MATCH = 501;

/**
 * The `.rpc()` seam mock (lib/match/approve.test.ts). rollbackMatch does NO table reads — the RPC is the sole
 * authority — so `from` is wired only to PIN that fact: a later pre-read turns `expect(from).not…` red.
 */
function makeAdmin(rpcResult: { data?: unknown; error?: unknown } = { data: { ok: true }, error: null }) {
  const from = vi.fn(() => {
    throw new Error('rollback wrapper must not read tables — the RPC is the authority');
  });
  const rpc = vi.fn((_fn: string, _args: Record<string, unknown>) => Promise.resolve(rpcResult));
  const admin = { from, rpc } as unknown as SupabaseClient;
  return { admin, from, rpc };
}

/** A well-formed ok payload (a clean rollback that reverted one downstream seat). */
const OK_PAYLOAD = {
  ok: true,
  state: 'pending',
  stat_rows_unpublished: 2,
  reverted: [{ match_id: 42, side: 'a', entry: 88, walkover: false }],
  uncrowned: false,
};

describe('rollbackMatch — the RPC payload + classification', () => {
  it('calls rollback_match with the EXACT snake_case payload and returns the revert outcome', async () => {
    const { admin, rpc, from } = makeAdmin({ data: OK_PAYLOAD, error: null });

    const result = await rollbackMatch(admin, { actingAdmin: ADMIN, matchId: MATCH });
    expect(result).toEqual({
      ok: true,
      statRowsUnpublished: 2,
      reverted: [{ match_id: 42, side: 'a', entry: 88, walkover: false }],
      uncrowned: false,
    });

    // ⚠ PIN EVERY ARGUMENT NAME — a typo'd key silently passes NULL into the RPC (the 4.1 review lesson).
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('rollback_match');
    expect(args).toEqual({ p_match_id: MATCH, p_actor_steamid64: ADMIN });
    expect(from).not.toHaveBeenCalled();
  });

  it('carries uncrowned=true through (a rolled-back Grand-Final deciding row un-crowns)', async () => {
    const { admin } = makeAdmin({
      data: { ...OK_PAYLOAD, reverted: [], uncrowned: true },
      error: null,
    });
    await expect(rollbackMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: true,
      statRowsUnpublished: 2,
      reverted: [],
      uncrowned: true,
    });
  });

  // `ceremony_locked` is Story 6.2's (migration 0024, AD-15) — see the note in approve.test.ts.
  it.each([['bad_match'], ['ceremony_locked'], ['not_resolved']])(
    'surfaces the RPC %s refusal unchanged (no blocking list)',
    async (reason) => {
      const { admin } = makeAdmin({ data: { ok: false, reason }, error: null });
      await expect(rollbackMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
        ok: false,
        reason,
      });
    },
  );

  it('⭐ surfaces downstream_active WITH its blocking list (the AD-8 flag the admin must act on)', async () => {
    const blocking = [{ match_id: 42, state: 'resolved' }];
    const { admin } = makeAdmin({ data: { ok: false, reason: 'downstream_active', blocking }, error: null });
    await expect(rollbackMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'downstream_active',
      blocking,
    });
  });

  it('downstream_active with a MISSING blocking list defaults to an empty array (never undefined)', async () => {
    const { admin } = makeAdmin({ data: { ok: false, reason: 'downstream_active' }, error: null });
    await expect(rollbackMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'downstream_active',
      blocking: [],
    });
  });

  it('maps the IC905 invariant RAISE to write_failed (genuine corruption, a 500 — not a typed refusal)', async () => {
    // The hop-cap cycle / pass-2 lock-invariant are IMPOSSIBLE states, not refusals — report as a server fault
    // (the 4.5 posture for advance_match's bare raises, deferred-work.md:41).
    const { admin } = makeAdmin({
      data: null,
      error: { code: 'IC905', message: 'rollback_match: hop cap exceeded reverting match 501' },
    });
    await expect(rollbackMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it('does NOT hijack a bare P0001 (that belongs to lib/match/format.ts) — it fails closed', async () => {
    const { admin } = makeAdmin({ data: null, error: { code: 'P0001', message: 'some other trigger' } });
    await expect(rollbackMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it.each([['IC901'], ['IC902'], ['IC903'], ['IC904']])(
    'does NOT hijack %s (walkover.ts / approve.ts codes) — it fails closed',
    async (code) => {
      // These are other libs' terminal/advance-refused codes. rollback_match never raises them, and mapping
      // them here would misreport another lib's refusal that leaked through as a rollback outcome.
      const { admin } = makeAdmin({ data: null, error: { code, message: 'another lib refusal' } });
      await expect(rollbackMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
        ok: false,
        reason: 'write_failed',
      });
    },
  );

  it('fails CLOSED on an unrecognised refusal reason', async () => {
    const { admin } = makeAdmin({ data: { ok: false, reason: 'something_new' }, error: null });
    await expect(rollbackMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it('fails CLOSED on a transport error', async () => {
    const { admin } = makeAdmin({ data: null, error: { code: '40P01', message: 'deadlock' } });
    await expect(rollbackMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it('fails CLOSED when ok is claimed without the outcome fields', async () => {
    const { admin } = makeAdmin({ data: { ok: true, state: 'pending' }, error: null });
    await expect(rollbackMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it('fails CLOSED when a field arrives as the wrong type (reverted not an array)', async () => {
    const { admin } = makeAdmin({ data: { ...OK_PAYLOAD, reverted: 'nope' }, error: null });
    await expect(rollbackMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it('fails CLOSED when uncrowned is not a boolean', async () => {
    const { admin } = makeAdmin({ data: { ...OK_PAYLOAD, uncrowned: 'false' }, error: null });
    await expect(rollbackMatch(admin, { actingAdmin: ADMIN, matchId: MATCH })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });
});
