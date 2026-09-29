import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// The helper constructs both clients + calls requireAdmin itself (that is the whole point — routes hold no
// client-construction boilerplate). So we mock those three seams and drive the gate per-test. Mirrors the
// injected-stub style of admin-guard.test.ts, adapted to module mocks because the helper owns construction.
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn(() => ({}) as SupabaseClient) }));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({}) as SupabaseClient),
}));
vi.mock('@/lib/auth/admin-guard', () => ({ requireAdmin: vi.fn() }));

import { handleAdminCommand, isPositiveInt, type AdminCommandSpec } from '@/lib/admin/command-route';
import { requireAdmin } from '@/lib/auth/admin-guard';

const ADMIN = '76561198388441171';

/** A fake NextRequest whose `json()` yields `body` (or throws, for the invalid_json path). */
function makeRequest(body: unknown, opts: { throwOnJson?: boolean } = {}): NextRequest {
  return {
    json: async () => {
      if (opts.throwOnJson) throw new SyntaxError('Unexpected token');
      return body;
    },
  } as unknown as NextRequest;
}

type EchoResult =
  | { ok: true; echoed: number }
  | { ok: false; reason: 'refused' | 'other'; blocking?: number[] };

/** A minimal spec that echoes `{ n }`, records the actor/admin it was run with, and refuses on `n === 0`. */
function makeSpec(over: Partial<AdminCommandSpec<{ n: number }, EchoResult>> = {}) {
  const runCalls: { actor: string; body: { n: number } }[] = [];
  const spec: AdminCommandSpec<{ n: number }, EchoResult> = {
    parseBody: (raw) => {
      if (typeof raw !== 'object' || raw === null) return null;
      const { n } = raw as Record<string, unknown>;
      return typeof n === 'number' && Number.isInteger(n) ? { n } : null;
    },
    run: async (_admin, gate, body) => {
      runCalls.push({ actor: gate.steamid64, body });
      if (body.n < 0) throw new Error('boom'); // the 500 path
      return body.n === 0
        ? { ok: false, reason: 'refused' }
        : { ok: true, echoed: body.n };
    },
    statusFor: { refused: 409, other: 422 },
    ok: (r) => ({ ok: true, echoed: r.echoed }),
    logLabel: 'api/admin/echo',
    ...over,
  };
  return { spec, runCalls };
}

beforeEach(() => {
  vi.mocked(requireAdmin).mockReset();
});

describe('handleAdminCommand — the shared audited-command-route envelope (AC1)', () => {
  it('403s a non-admin BEFORE parsing the body or running the command', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403 });
    const { spec, runCalls } = makeSpec();
    const res = await handleAdminCommand(makeRequest({ n: 5 }), spec);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
    expect(runCalls).toHaveLength(0); // gate bit first — no write reached
  });

  it('passes requireAdmin’s status through (401 when there is no session)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 401 });
    const { spec } = makeSpec();
    const res = await handleAdminCommand(makeRequest({ n: 5 }), spec);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });

  it('400 invalid_json when the body is not JSON', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, steamid64: ADMIN });
    const { spec, runCalls } = makeSpec();
    const res = await handleAdminCommand(makeRequest(undefined, { throwOnJson: true }), spec);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_json' });
    expect(runCalls).toHaveLength(0);
  });

  it('400 invalid_body when parseBody returns null', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, steamid64: ADMIN });
    const { spec, runCalls } = makeSpec();
    const res = await handleAdminCommand(makeRequest({ n: 'not-a-number' }), spec);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_body' });
    expect(runCalls).toHaveLength(0);
  });

  it('threads gate.steamid64 as the actor into run (never the body)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, steamid64: ADMIN });
    const { spec, runCalls } = makeSpec();
    // The body even carries a decoy steamid64; the actor must still be the verified session id.
    await handleAdminCommand(makeRequest({ n: 7, steamid64: 'attacker' }), spec);
    expect(runCalls).toEqual([{ actor: ADMIN, body: { n: 7 } }]);
  });

  it('maps a refusal reason to its statusFor status with { error: reason }', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, steamid64: ADMIN });
    const { spec } = makeSpec();
    const res = await handleAdminCommand(makeRequest({ n: 0 }), spec);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'refused' });
  });

  it('falls closed to 500 for a refusal reason absent from statusFor', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, steamid64: ADMIN });
    // `run` returns a reason with no statusFor entry — the `?? 500` backstop, never an undefined status.
    const { spec } = makeSpec({ run: async () => ({ ok: false, reason: 'other' }), statusFor: {} });
    const res = await handleAdminCommand(makeRequest({ n: 3 }), spec);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'other' });
  });

  it('returns the ok() payload on success (200)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, steamid64: ADMIN });
    const { spec } = makeSpec();
    const res = await handleAdminCommand(makeRequest({ n: 42 }), spec);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, echoed: 42 });
  });

  it('500 internal_error when run throws (fail-closed, logged)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, steamid64: ADMIN });
    const { spec } = makeSpec();
    const res = await handleAdminCommand(makeRequest({ n: -1 }), spec); // run throws on n < 0
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal_error' });
    expect(spy).toHaveBeenCalledWith('[api/admin/echo] request failed:', expect.any(Error));
    spy.mockRestore();
  });

  it('uses errorBody to surface extra fields (rollback’s downstream_active blocking list)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, steamid64: ADMIN });
    const { spec } = makeSpec({
      run: async () => ({ ok: false, reason: 'refused', blocking: [11, 22] }),
      errorBody: (r) => ({ error: r.reason, blocking: r.blocking ?? [] }),
    });
    const res = await handleAdminCommand(makeRequest({ n: 0 }), spec);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'refused', blocking: [11, 22] });
  });
});

describe('isPositiveInt — the shared range-capped validator (closes bracket/route.ts:52)', () => {
  it('accepts a positive safe integer', () => {
    expect(isPositiveInt(1)).toBe(true);
    expect(isPositiveInt(Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  it('rejects zero, negatives, and non-integers', () => {
    expect(isPositiveInt(0)).toBe(false);
    expect(isPositiveInt(-1)).toBe(false);
    expect(isPositiveInt(1.5)).toBe(false);
    expect(isPositiveInt(NaN)).toBe(false);
  });

  it('⭐ rejects an out-of-bigint-range integer (1e21) — the unbounded-int 400-gap', () => {
    // Number.isInteger(1e21) is TRUE and 1e21 > 0, so a bare check passed it → 22003 → 500. The cap makes it 400.
    expect(Number.isInteger(1e21)).toBe(true); // the trap, pinned
    expect(isPositiveInt(1e21)).toBe(false); // the fix
  });

  it('rejects non-number inputs', () => {
    expect(isPositiveInt('5')).toBe(false);
    expect(isPositiveInt(null)).toBe(false);
    expect(isPositiveInt(undefined)).toBe(false);
  });
});
