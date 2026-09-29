import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchSteamProfile,
  upsertPlayer,
  type HttpGetJson,
  type SteamProfile,
} from '@/lib/players';

const STEAMID = '76561198388441171'; // 17 digits (the real id used across the auth suite)

// Shape of the `.upsert(payload, opts)` call we assert against. Typing the spy keeps
// `upsert.mock.calls[i]` a real tuple so payload/opts are inspectable (mirrors openid.test).
type UpsertFn = (
  payload: Record<string, unknown>,
  opts: Record<string, unknown>,
) => Promise<{ error: { message: string } | null }>;

// Mock service-role client: admin.from('player').upsert(payload, opts).
function makeAdmin(upsertResult: { error: { message: string } | null } = { error: null }) {
  const upsert = vi.fn<UpsertFn>(async () => upsertResult);
  const from = vi.fn((_table: string) => ({ upsert }));
  const admin = { from } as unknown as SupabaseClient;
  return { admin, from, upsert };
}

const REAL_PROFILE: SteamProfile = {
  displayName: 'Cuatro',
  avatarUrl: 'https://avatars/cuatro.jpg',
};

describe('upsertPlayer — canonical steamid64 key, rename tolerance (AC1, AC2, AC5a/b)', () => {
  it('targets the row by onConflict:steamid64 with the cosmetic payload (never display_name)', async () => {
    const { admin, from, upsert } = makeAdmin();
    await upsertPlayer(admin, STEAMID, REAL_PROFILE);

    expect(from).toHaveBeenCalledExactlyOnceWith('player');
    expect(upsert).toHaveBeenCalledOnce();
    const [payload, opts] = upsert.mock.calls[0];
    expect(payload).toEqual({
      steamid64: STEAMID,
      display_name: 'Cuatro',
      avatar_url: 'https://avatars/cuatro.jpg',
    });
    expect(opts).toEqual({ onConflict: 'steamid64' }); // canonical key, never display_name
    // created_at is never written, so the conflict/UPDATE path leaves it untouched (AC3).
    expect(payload).not.toHaveProperty('created_at');
  });

  it('a rename routes to the SAME steamid64 identity, not a new key (AC2 / AC5b)', async () => {
    const { admin, upsert } = makeAdmin();
    await upsertPlayer(admin, STEAMID, { displayName: 'OldName', avatarUrl: null });
    await upsertPlayer(admin, STEAMID, { displayName: 'NewName', avatarUrl: null });

    expect(upsert).toHaveBeenCalledTimes(2);
    for (const [payload, opts] of upsert.mock.calls) {
      expect(payload.steamid64).toBe(STEAMID); // same canonical key both logins
      expect(opts).toMatchObject({ onConflict: 'steamid64' }); // never keyed on display_name
    }
    // Only the cosmetic display_name differs between the two logins.
    expect(upsert.mock.calls[0][0].display_name).toBe('OldName');
    expect(upsert.mock.calls[1][0].display_name).toBe('NewName');
  });

  it('propagates a DB error as a thrown Error', async () => {
    const { admin } = makeAdmin({ error: { message: 'boom' } });
    await expect(upsertPlayer(admin, STEAMID, REAL_PROFILE)).rejects.toThrow(
      /player upsert failed: boom/,
    );
  });
});

describe('upsertPlayer — 17-digit guard fires before any DB call (AC5c)', () => {
  it.each([
    ['too short (16 digits)', '7656119838844117'],
    ['too long (18 digits)', '765611983884411710'],
    ['non-numeric', '76561198abc441171'],
    ['empty', ''],
  ])('refuses a non-canonical steamid64 (%s) before touching the client', async (_label, badId) => {
    const { admin, from } = makeAdmin();
    await expect(upsertPlayer(admin, badId, REAL_PROFILE)).rejects.toThrow(
      /non-canonical steamid64/,
    );
    expect(from).not.toHaveBeenCalled(); // guard fires BEFORE any admin.from(...)
  });
});

describe('upsertPlayer — AC6: an unhydrated (null) profile must not clobber good values', () => {
  it('uses ON CONFLICT DO NOTHING (ignoreDuplicates) with a placeholder payload', async () => {
    const { admin, from, upsert } = makeAdmin();
    await upsertPlayer(admin, STEAMID, null);

    expect(from).toHaveBeenCalledExactlyOnceWith('player');
    const [payload, opts] = upsert.mock.calls[0];
    // A brand-new player still gets a row (placeholder); an EXISTING player's good
    // name/avatar is preserved because ignoreDuplicates → ON CONFLICT DO NOTHING (no UPDATE).
    expect(payload).toEqual({ steamid64: STEAMID, display_name: STEAMID, avatar_url: null });
    expect(opts).toEqual({ onConflict: 'steamid64', ignoreDuplicates: true });
  });

  it('still enforces the 17-digit guard on the unhydrated path', async () => {
    const { admin, from } = makeAdmin();
    await expect(upsertPlayer(admin, 'not-an-id', null)).rejects.toThrow(/non-canonical steamid64/);
    expect(from).not.toHaveBeenCalled();
  });
});

describe('fetchSteamProfile — cosmetic hydration with an injected transport (AC5d, AC6)', () => {
  it('returns the real persona + avatar on a 200 with a player', async () => {
    const get: HttpGetJson = async () => ({
      response: { players: [{ personaname: 'Cuatro', avatarfull: 'https://a/full.jpg' }] },
    });
    expect(await fetchSteamProfile(STEAMID, 'key-123', get)).toEqual({
      displayName: 'Cuatro',
      avatarUrl: 'https://a/full.jpg',
    });
  });

  it('sends the api key + steamid64 to GetPlayerSummaries', async () => {
    const get = vi.fn<HttpGetJson>(async () => ({
      response: { players: [{ personaname: 'X', avatarfull: 'u' }] },
    }));
    await fetchSteamProfile(STEAMID, 'key-123', get);
    expect(get).toHaveBeenCalledOnce();
    const calledUrl = new URL(get.mock.calls[0][0]);
    expect(calledUrl.pathname).toContain('GetPlayerSummaries');
    expect(calledUrl.searchParams.get('key')).toBe('key-123');
    expect(calledUrl.searchParams.get('steamids')).toBe(STEAMID);
  });

  it('returns null (unhydrated) when STEAM_API_KEY is missing — never calls the transport', async () => {
    const get = vi.fn<HttpGetJson>(async () => ({ response: { players: [] } }));
    expect(await fetchSteamProfile(STEAMID, '', get)).toBeNull();
    expect(get).not.toHaveBeenCalled(); // no key → short-circuit, no outbound call
  });

  it('returns null when the transport throws (non-200 / timeout / network)', async () => {
    const get: HttpGetJson = async () => {
      throw new Error('HTTP 503');
    };
    expect(await fetchSteamProfile(STEAMID, 'key-123', get)).toBeNull();
  });

  it('returns null on a 200 with an empty players array (private/unknown profile)', async () => {
    const get: HttpGetJson = async () => ({ response: { players: [] } });
    expect(await fetchSteamProfile(STEAMID, 'key-123', get)).toBeNull();
  });

  it('returns null on a 200 whose persona is blank/whitespace (unhydrated — AC6 Option A, no id-fallback clobber)', async () => {
    const get: HttpGetJson = async () => ({
      response: { players: [{ personaname: '   ', avatarfull: 'https://a/full.jpg' }] },
    });
    // A blank persona used to fall back to the 17-digit id and clobber a stored good name on the
    // UPDATE path; now it returns null → the DO-NOTHING preserve path keeps the good name (AC6).
    expect(await fetchSteamProfile(STEAMID, 'key-123', get)).toBeNull();
  });

  it('returns null on a 200 whose player object has no personaname field at all (unhydrated)', async () => {
    const get: HttpGetJson = async () => ({
      response: { players: [{ avatarfull: 'https://a/full.jpg' }] },
    });
    expect(await fetchSteamProfile(STEAMID, 'key-123', get)).toBeNull();
  });
});
