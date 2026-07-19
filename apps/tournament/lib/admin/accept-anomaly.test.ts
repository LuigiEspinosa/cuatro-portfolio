import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { acceptAnomaly } from '@/lib/admin/accept-anomaly';

const ADMIN = '76561198388441171';
/** Deliberately NOT 1..n, so an id mix-up cannot pass silently (mirrors bind.test.ts). */
const DEMO = 707;

/**
 * The `.rpc()` seam mock (lib/match/bind.test.ts). This wrapper does NO table reads — the RPC is the sole
 * authority — so `from` is wired only to PIN that fact: a later pre-read turns `expect(from).not…` red.
 */
function makeAdmin(rpcResult: { data?: unknown; error?: unknown } = { data: { ok: true }, error: null }) {
  const from = vi.fn(() => {
    throw new Error('accept-anomaly must not read tables — the RPC is the authority');
  });
  const rpc = vi.fn((_fn: string, _args: Record<string, unknown>) => Promise.resolve(rpcResult));
  const admin = { from, rpc } as unknown as SupabaseClient;
  return { admin, from, rpc };
}

function okPayload(over: Record<string, unknown> = {}) {
  return { ok: true, demo_id: DEMO, validation_state: 'pending', ...over };
}

describe('acceptAnomaly — the RPC payload + classification', () => {
  it('calls accept_anomaly with the EXACT snake_case payload and returns the new state', async () => {
    const { admin, rpc, from } = makeAdmin({ data: okPayload(), error: null });

    const result = await acceptAnomaly(admin, { actingAdmin: ADMIN, demoId: DEMO });
    expect(result).toEqual({ ok: true, demoId: DEMO, validationState: 'pending' });

    // ⚠ PIN EVERY ARGUMENT NAME — a typo'd key silently passes NULL into the RPC (the 4.1 review lesson).
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('accept_anomaly');
    expect(args).toEqual({ p_demo_id: DEMO, p_actor_steamid64: ADMIN });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([['bad_demo'], ['not_anomalous']])('surfaces the RPC %s refusal unchanged', async (reason) => {
    const { admin } = makeAdmin({ data: { ok: false, reason }, error: null });
    await expect(acceptAnomaly(admin, { actingAdmin: ADMIN, demoId: DEMO })).resolves.toEqual({
      ok: false,
      reason,
    });
  });

  it('fails CLOSED on an unrecognised refusal reason', async () => {
    const { admin } = makeAdmin({ data: { ok: false, reason: 'something_new' }, error: null });
    await expect(acceptAnomaly(admin, { actingAdmin: ADMIN, demoId: DEMO })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it('fails CLOSED on a null / bare-!ok reply with no reason', async () => {
    const nul = makeAdmin({ data: null, error: null });
    await expect(acceptAnomaly(nul.admin, { actingAdmin: ADMIN, demoId: DEMO })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
    const bare = makeAdmin({ data: { ok: false }, error: null });
    await expect(acceptAnomaly(bare.admin, { actingAdmin: ADMIN, demoId: DEMO })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  // ── The ok-payload SHAPE gate (the 4.1 review lesson) ──
  it.each([
    ['demo_id', { demo_id: undefined }],
    ['validation_state', { validation_state: undefined }],
  ])('fails CLOSED when the ok reply is missing %s', async (_field, over) => {
    const { admin } = makeAdmin({ data: okPayload(over), error: null });
    await expect(acceptAnomaly(admin, { actingAdmin: ADMIN, demoId: DEMO })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it('fails CLOSED when a field is the WRONG TYPE (demo_id as a string)', async () => {
    const { admin } = makeAdmin({ data: okPayload({ demo_id: '707' }), error: null });
    await expect(acceptAnomaly(admin, { actingAdmin: ADMIN, demoId: DEMO })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it('fails CLOSED on a transport error', async () => {
    const { admin } = makeAdmin({ data: null, error: { code: '40P01', message: 'deadlock detected' } });
    await expect(acceptAnomaly(admin, { actingAdmin: ADMIN, demoId: DEMO })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });
});
