import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { bindMatchDemo } from '@/lib/match/bind';

const ADMIN = '76561198388441171';
/** Ids deliberately NOT 1..n, so an index/id mix-up cannot pass silently (mirrors walkover.test.ts). */
const MATCH = 501;
const DEMO = 707;

/**
 * The `.rpc()` seam mock (lib/match/walkover.test.ts). This wrapper does NO table reads — the RPC is the sole
 * authority — so `from` is wired only to PIN that fact: a later pre-read turns `expect(from).not…` red.
 */
function makeAdmin(rpcResult: { data?: unknown; error?: unknown } = { data: { ok: true }, error: null }) {
  const from = vi.fn(() => {
    throw new Error('bind wrappers must not read tables — the RPC is the authority');
  });
  const rpc = vi.fn((_fn: string, _args: Record<string, unknown>) => Promise.resolve(rpcResult));
  const admin = { from, rpc } as unknown as SupabaseClient;
  return { admin, from, rpc };
}

/** The RPC's full ok-payload for a fresh (non-idempotent) bind. */
function okPayload(over: Record<string, unknown> = {}) {
  return {
    ok: true,
    match_id: MATCH,
    demo_id: DEMO,
    state: 'pending',
    idempotent: false,
    stat_rows_bound: 2,
    ...over,
  };
}

describe('bindMatchDemo — the RPC payload + classification', () => {
  it('calls bind_match_demo with the EXACT snake_case payload and returns the binding', async () => {
    const { admin, rpc, from } = makeAdmin({ data: okPayload(), error: null });

    const result = await bindMatchDemo(admin, { actingAdmin: ADMIN, matchId: MATCH, demoId: DEMO });
    expect(result).toEqual({
      ok: true,
      matchId: MATCH,
      demoId: DEMO,
      state: 'pending',
      idempotent: false,
      statRowsBound: 2,
    });

    // ⚠ PIN EVERY ARGUMENT NAME — a typo'd key silently passes NULL into the RPC (the 4.1 review lesson).
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('bind_match_demo');
    expect(args).toEqual({ p_match_id: MATCH, p_demo_id: DEMO, p_actor_steamid64: ADMIN });
    expect(from).not.toHaveBeenCalled();
  });

  it('carries the AC3 state + the bound stat_row COUNT through (not just a bare ok)', async () => {
    // stat_rows_bound is the AC3 evidence the admin/queue reads: a bind that moved zero rows is a red flag.
    const { admin } = makeAdmin({ data: okPayload({ stat_rows_bound: 10 }), error: null });
    await expect(bindMatchDemo(admin, { actingAdmin: ADMIN, matchId: MATCH, demoId: DEMO })).resolves.toEqual({
      ok: true,
      matchId: MATCH,
      demoId: DEMO,
      state: 'pending',
      idempotent: false,
      statRowsBound: 10,
    });
  });

  it('reports an IDEMPOTENT re-bind of the same pair as ok, flagged', async () => {
    // The RPC short-circuits a same-pair re-bind having written nothing — so a retried request is safe. The
    // flag is what lets a caller tell "I bound it" from "it was already bound".
    const { admin } = makeAdmin({
      data: okPayload({ idempotent: true, stat_rows_bound: 0 }),
      error: null,
    });
    await expect(bindMatchDemo(admin, { actingAdmin: ADMIN, matchId: MATCH, demoId: DEMO })).resolves.toEqual({
      ok: true,
      matchId: MATCH,
      demoId: DEMO,
      state: 'pending',
      idempotent: true,
      statRowsBound: 0,
    });
  });

  it.each([
    ['bad_match'],
    ['bad_demo'],
    ['not_bindable'],
    ['already_bound'],
    ['anomalous'],
    ['no_stats'],
    ['format_not_declared'],
  ])('surfaces the RPC %s refusal unchanged', async (reason) => {
    const { admin } = makeAdmin({ data: { ok: false, reason }, error: null });
    await expect(bindMatchDemo(admin, { actingAdmin: ADMIN, matchId: MATCH, demoId: DEMO })).resolves.toEqual({
      ok: false,
      reason,
    });
  });

  it('fails CLOSED on an unrecognised refusal reason', async () => {
    const { admin } = makeAdmin({ data: { ok: false, reason: 'something_new' }, error: null });
    await expect(bindMatchDemo(admin, { actingAdmin: ADMIN, matchId: MATCH, demoId: DEMO })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it('fails CLOSED on a null/!ok reply with no reason at all', async () => {
    const nul = makeAdmin({ data: null, error: null });
    await expect(
      bindMatchDemo(nul.admin, { actingAdmin: ADMIN, matchId: MATCH, demoId: DEMO }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });
    const bare = makeAdmin({ data: { ok: false }, error: null });
    await expect(
      bindMatchDemo(bare.admin, { actingAdmin: ADMIN, matchId: MATCH, demoId: DEMO }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });
  });

  // ── The ok-payload SHAPE gate (the 4.1 review lesson: a typo'd jsonb key must not read as success) ──

  it.each([
    ['match_id', { match_id: undefined }],
    ['demo_id', { demo_id: undefined }],
    ['state', { state: undefined }],
    ['idempotent', { idempotent: undefined }],
    ['stat_rows_bound', { stat_rows_bound: undefined }],
  ])('fails CLOSED when the ok reply is missing %s', async (_field, over) => {
    const { admin } = makeAdmin({ data: okPayload(over), error: null });
    await expect(bindMatchDemo(admin, { actingAdmin: ADMIN, matchId: MATCH, demoId: DEMO })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it('fails CLOSED when a field is present but the WRONG TYPE', async () => {
    // `typeof` gates, not truthiness: stat_rows_bound=0 is VALID (an idempotent re-bind) and must pass, while
    // a string "2" must not. A truthiness check would invert both.
    const wrong = makeAdmin({ data: okPayload({ stat_rows_bound: '2' }), error: null });
    await expect(
      bindMatchDemo(wrong.admin, { actingAdmin: ADMIN, matchId: MATCH, demoId: DEMO }),
    ).resolves.toEqual({ ok: false, reason: 'write_failed' });

    const zero = makeAdmin({ data: okPayload({ stat_rows_bound: 0 }), error: null });
    await expect(zero.admin && bindMatchDemo(zero.admin, { actingAdmin: ADMIN, matchId: MATCH, demoId: DEMO }))
      .resolves.toMatchObject({ ok: true, statRowsBound: 0 });
  });

  // ── SQLSTATE classification ──────────────────────────────────────────────

  it('maps the IC901 terminal-guard RAISE to terminal (NOT a 500)', async () => {
    // AD-23. Not reachable through the RPC (its `not_bindable` guard refuses a terminal state first — that IS
    // AC2), but a trigger refusal is a REFUSAL, not a server fault. 4.7's un-seat path will make it live.
    const { admin } = makeAdmin({
      data: null,
      error: { code: 'IC901', message: 'state forfeit is TERMINAL (AD-23)' },
    });
    await expect(bindMatchDemo(admin, { actingAdmin: ADMIN, matchId: MATCH, demoId: DEMO })).resolves.toEqual({
      ok: false,
      reason: 'terminal',
    });
  });

  it('maps a 23514 check_violation to format_not_declared (NOT a 500) — closing deferred-work.md:136', async () => {
    // ⭐ THE FOUR-STORY-OLD HAND-OFF. 4.2 installed match_live_requires_locked_format and flagged that
    // "whoever lands `declared -> live` inherits an opaque check_violation". 4.6a lands `pending`, so it
    // inherits it: an unlocked format reports as a typed refusal, never a raw constraint violation in a 500.
    // ⚠ This pins the mapping, NOT that 23514 uniquely means "format". score_source_guard is a second CHECK
    // on the same UPDATE — see bind.ts. Deferred to 4.8, which is what makes it reachable.
    const { admin } = makeAdmin({
      data: null,
      error: { code: '23514', message: 'violates check constraint "match_live_requires_locked_format"' },
    });
    await expect(bindMatchDemo(admin, { actingAdmin: ADMIN, matchId: MATCH, demoId: DEMO })).resolves.toEqual({
      ok: false,
      reason: 'format_not_declared',
    });
  });

  it('does NOT hijack a bare P0001 (that belongs to lib/match/format.ts) — it fails closed', async () => {
    // deferred-work.md, "P0001 is PL/pgSQL's GENERIC exception code" (cited by title — the `:127` this used
    // to cite was never that item). format.ts maps P0001 to already_locked; reading it as a bind reason here
    // would re-create the exact ambiguity DECISION D exists to prevent.
    const { admin } = makeAdmin({ data: null, error: { code: 'P0001', message: 'some other trigger' } });
    await expect(bindMatchDemo(admin, { actingAdmin: ADMIN, matchId: MATCH, demoId: DEMO })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it('does NOT hijack IC902 (that belongs to lib/match/walkover.ts) — it fails closed', async () => {
    const { admin } = makeAdmin({ data: null, error: { code: 'IC902', message: 'advance refused' } });
    await expect(bindMatchDemo(admin, { actingAdmin: ADMIN, matchId: MATCH, demoId: DEMO })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });

  it('fails CLOSED on a transport error', async () => {
    const { admin } = makeAdmin({ data: null, error: { code: '40P01', message: 'deadlock detected' } });
    await expect(bindMatchDemo(admin, { actingAdmin: ADMIN, matchId: MATCH, demoId: DEMO })).resolves.toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });
});
