import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { establishSession, steamEmail } from '@/lib/auth/session';

const STEAMID = '76561198388441171';

function makeAdmin(
  opts: { createError?: { message: string; code?: string } | null; noUser?: boolean } = {},
) {
  const createUser = vi.fn(async () => ({ error: opts.createError ?? null }));
  const generateLink = vi.fn(async () => ({
    data: {
      user: opts.noUser ? null : { id: 'user-1' },
      properties: { hashed_token: 'tok-abc' },
    },
    error: null,
  }));
  const updateUserById = vi.fn(async () => ({ error: null }));
  const admin = {
    auth: { admin: { createUser, generateLink, updateUserById } },
  } as unknown as SupabaseClient;
  return { admin, createUser, generateLink, updateUserById };
}

function makeSsr() {
  const verifyOtp = vi.fn(async () => ({ error: null }));
  const ssr = { auth: { verifyOtp } } as unknown as SupabaseClient;
  return { ssr, verifyOtp };
}

describe('establishSession — app_metadata { steamid64, role } (AC1 / AC4 / AC5 / AC8c)', () => {
  it('writes { steamid64, role } on create AND via updateUserById, before verifyOtp', async () => {
    const { admin, createUser, generateLink, updateUserById } = makeAdmin();
    const { ssr, verifyOtp } = makeSsr();

    await establishSession(admin, ssr, STEAMID, 'admin');

    // Create path carries both claims.
    expect(createUser).toHaveBeenCalledOnce();
    expect(createUser.mock.calls[0][0]).toMatchObject({
      email: steamEmail(STEAMID),
      app_metadata: { steamid64: STEAMID, role: 'admin' },
    });
    // Backfill/refresh carries BOTH keys (never clobber steamid64) — keyed by the id
    // returned from generateLink.
    expect(updateUserById).toHaveBeenCalledWith('user-1', {
      app_metadata: { steamid64: STEAMID, role: 'admin' },
    });
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'email', token_hash: 'tok-abc' });

    // AC4 ordering: generateLink → updateUserById (claim written) → verifyOtp (session minted).
    const linkOrder = generateLink.mock.invocationCallOrder[0];
    const updateOrder = updateUserById.mock.invocationCallOrder[0];
    const verifyOrder = verifyOtp.mock.invocationCallOrder[0];
    expect(linkOrder).toBeLessThan(updateOrder);
    expect(updateOrder).toBeLessThan(verifyOrder);
  });

  it('backfills an EXISTING user (createUser already-exists → no throw)', async () => {
    const { admin, updateUserById } = makeAdmin({
      createError: { message: 'already registered', code: 'email_exists' },
    });
    const { ssr } = makeSsr();

    await expect(establishSession(admin, ssr, STEAMID, 'admin')).resolves.toBeUndefined();
    expect(updateUserById).toHaveBeenCalledWith('user-1', {
      app_metadata: { steamid64: STEAMID, role: 'admin' },
    });
  });

  it('fails closed if generateLink returns no user id (cannot bind role → no session)', async () => {
    const { admin, updateUserById } = makeAdmin({ noUser: true });
    const { ssr, verifyOtp } = makeSsr();
    await expect(establishSession(admin, ssr, STEAMID, 'admin')).rejects.toThrow(/no user id/);
    expect(updateUserById).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled(); // never mints a session with an unbound claim
  });

  it('carries the viewer role through both writes', async () => {
    const { admin, createUser, updateUserById } = makeAdmin();
    const { ssr } = makeSsr();
    await establishSession(admin, ssr, STEAMID, 'viewer');
    expect(createUser.mock.calls[0][0]).toMatchObject({
      app_metadata: { steamid64: STEAMID, role: 'viewer' },
    });
    expect(updateUserById).toHaveBeenCalledWith('user-1', {
      app_metadata: { steamid64: STEAMID, role: 'viewer' },
    });
  });
});
