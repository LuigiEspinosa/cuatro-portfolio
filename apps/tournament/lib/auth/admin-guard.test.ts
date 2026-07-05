import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/admin-guard';

const ADMIN_ID = '76561198388441171';

/** Mock the SSR client's verified-session read (`auth.getUser`). */
function makeSsr(opts: {
  user?: { app_metadata?: Record<string, unknown> } | null;
  error?: { message: string } | null;
}) {
  const getUser = vi.fn(async () => ({
    data: { user: opts.user ?? null },
    error: opts.error ?? null,
  }));
  const ssr = { auth: { getUser } } as unknown as SupabaseClient;
  return { ssr, getUser };
}

/** Mock the service-role client's `app_role` read builder (reuses roles.test.ts's shape). */
function makeAdmin(opts: { row?: { role: string } | null; readError?: { message: string } | null }) {
  const builder = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    async maybeSingle() {
      return { data: opts.row ?? null, error: opts.readError ?? null };
    },
  };
  const from = vi.fn(() => builder);
  const admin = { from } as unknown as SupabaseClient;
  return { admin, from };
}

describe('requireAdmin (AC1 / AC3 — server-enforced admin gate; Option A instant revoke)', () => {
  it('allows an admin: verified steamid64 claim resolving to an app_role row role=admin', async () => {
    const { ssr } = makeSsr({ user: { app_metadata: { steamid64: ADMIN_ID } } });
    const { admin, from } = makeAdmin({ row: { role: 'admin' } });
    const result = await requireAdmin(ssr, admin);
    expect(result).toEqual({ ok: true, steamid64: ADMIN_ID });
    expect(from).toHaveBeenCalledWith('app_role'); // authorized against the authoritative store
  });

  it('denies 401 when there is no session', async () => {
    const { ssr } = makeSsr({ user: null });
    const { admin } = makeAdmin({});
    expect(await requireAdmin(ssr, admin)).toEqual({ ok: false, status: 401 });
  });

  it('denies 401 on a getUser error (fail-closed)', async () => {
    const { ssr } = makeSsr({ user: null, error: { message: 'jwt expired' } });
    const { admin } = makeAdmin({});
    expect(await requireAdmin(ssr, admin)).toEqual({ ok: false, status: 401 });
  });

  it('denies 403 when the verified claim carries no steamid64 (never reads app_role)', async () => {
    const { ssr } = makeSsr({ user: { app_metadata: {} } });
    const { admin, from } = makeAdmin({ row: { role: 'admin' } });
    expect(await requireAdmin(ssr, admin)).toEqual({ ok: false, status: 403 });
    expect(from).not.toHaveBeenCalled();
  });

  it('denies 403 for a non-17-digit steamid64 claim', async () => {
    const { ssr } = makeSsr({ user: { app_metadata: { steamid64: '123' } } });
    const { admin } = makeAdmin({ row: { role: 'admin' } });
    expect(await requireAdmin(ssr, admin)).toEqual({ ok: false, status: 403 });
  });

  it('⭐ denies 403 when the JWT claim said admin but app_role now says viewer (instant revoke)', async () => {
    // The stale-token proof: even a token still carrying role:admin is rejected the moment
    // the authoritative app_role row flips to viewer.
    const { ssr } = makeSsr({ user: { app_metadata: { steamid64: ADMIN_ID, role: 'admin' } } });
    const { admin } = makeAdmin({ row: { role: 'viewer' } });
    expect(await requireAdmin(ssr, admin)).toEqual({ ok: false, status: 403 });
  });

  it('denies 403 when there is no app_role row for the caller', async () => {
    const { ssr } = makeSsr({ user: { app_metadata: { steamid64: ADMIN_ID } } });
    const { admin } = makeAdmin({ row: null });
    expect(await requireAdmin(ssr, admin)).toEqual({ ok: false, status: 403 });
  });

  it('denies 403 (fail-closed) on a hard app_role read error, and logs server-side', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ssr } = makeSsr({ user: { app_metadata: { steamid64: ADMIN_ID } } });
    const { admin } = makeAdmin({ readError: { message: 'connection reset' } });
    expect(await requireAdmin(ssr, admin)).toEqual({ ok: false, status: 403 });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
