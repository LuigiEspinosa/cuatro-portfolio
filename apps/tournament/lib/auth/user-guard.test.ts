import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/auth/user-guard';

const STEAMID = '76561198388441171';

/** Mock the SSR client's verified-session read (`auth.getUser`) — same shape as admin-guard.test.ts. */
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

describe('requireUser (AC5 — authenticated-caller gate; the non-admin sibling of requireAdmin)', () => {
  it('allows a verified session carrying a 17-digit steamid64 claim', async () => {
    const { ssr } = makeSsr({ user: { app_metadata: { steamid64: STEAMID } } });
    expect(await requireUser(ssr)).toEqual({ ok: true, steamid64: STEAMID });
  });

  it('denies 401 when there is no session', async () => {
    const { ssr } = makeSsr({ user: null });
    expect(await requireUser(ssr)).toEqual({ ok: false, status: 401 });
  });

  it('denies 401 on a getUser error (fail-closed)', async () => {
    const { ssr } = makeSsr({ user: null, error: { message: 'jwt expired' } });
    expect(await requireUser(ssr)).toEqual({ ok: false, status: 401 });
  });

  it('denies 401 when the verified claim carries no steamid64', async () => {
    const { ssr } = makeSsr({ user: { app_metadata: {} } });
    expect(await requireUser(ssr)).toEqual({ ok: false, status: 401 });
  });

  it('denies 401 for a non-17-digit steamid64 claim (fail-closed)', async () => {
    const { ssr } = makeSsr({ user: { app_metadata: { steamid64: '123' } } });
    expect(await requireUser(ssr)).toEqual({ ok: false, status: 401 });
  });
});
