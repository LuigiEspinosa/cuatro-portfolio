import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role `player` upsert (AC2, FR-1) + cosmetic Steam profile hydration.
 *
 * `display_name` is MUTABLE and cosmetic — never a join key (AD-4). The canonical key is
 * `steamid64` (text, 17-digit CHECK enforced by migration 0001). No migration here: the
 * `player` table and the `service_role` DML grant already exist (0001/0002).
 */

const STEAMID64_RE = /^[0-9]{17}$/;

/** Hard timeout for the cosmetic Steam Web API call — a hung endpoint must not stall login. */
const STEAM_HTTP_TIMEOUT_MS = 10_000;

export interface SteamProfile {
  displayName: string;
  avatarUrl: string | null;
}

/**
 * Injectable JSON GET transport (mirrors openid.ts's `HttpPost` seam) so tests never hit
 * the live Steam Web API. The default throws on a non-200 so `fetchSteamProfile`'s catch
 * maps every failure to the same `null` (unhydrated) signal.
 */
export type HttpGetJson = (url: string) => Promise<unknown>;

const defaultGet: HttpGetJson = async (url) => {
  const res = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(STEAM_HTTP_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`GetPlayerSummaries HTTP ${res.status}`);
  }
  return res.json();
};

/**
 * Hydrate cosmetic profile fields from Steam's Web API (GetPlayerSummaries). Requires
 * `STEAM_API_KEY`. Returns `null` when the profile CANNOT be hydrated — no key, non-200,
 * a thrown/timed-out fetch, a 200 with no player object, or a 200 whose player carries no
 * usable `personaname` (blank/absent). `null` is the explicit "unhydrated" signal (AC6): the
 * caller MUST NOT clobber an already-stored good `display_name`/`avatar_url` with a placeholder.
 * Login still succeeds on `null` (AC2 cosmetic — profile hydration is best-effort, never a
 * login gate). (A 200 with a real persona but a missing avatar still returns a profile whose
 * `avatarUrl` is null — the rarer avatar-only partial case is Epic-5-deferred.)
 */
export async function fetchSteamProfile(
  steamid64: string,
  apiKey: string,
  get: HttpGetJson = defaultGet,
): Promise<SteamProfile | null> {
  if (!apiKey) {
    // No key configured → cannot hydrate. Unhydrated signal, never a clobbering placeholder.
    return null;
  }
  try {
    const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('steamids', steamid64);
    const json = (await get(url.toString())) as {
      response?: { players?: { personaname?: string; avatarfull?: string }[] };
    };
    const player = json.response?.players?.[0];
    if (!player) {
      return null; // 200 but empty (private/unknown profile) → unhydrated, don't clobber
    }
    const displayName = player.personaname?.trim();
    if (!displayName) {
      // 200 with a present player but a blank/absent personaname → no usable name. Treat as
      // unhydrated (AC6, resolved decision Option A): returning null routes to the DO-NOTHING
      // preserve path instead of falling back to the 17-digit id and clobbering a stored good name.
      return null;
    }
    return {
      displayName,
      avatarUrl: player.avatarfull ?? null,
    };
  } catch {
    return null; // non-200 / timeout / thrown fetch → unhydrated
  }
}

/**
 * Upsert the `player` row keyed by SteamID64 via the service-role client. `display_name`
 * is synced cosmetically. The value MUST satisfy the 17-digit CHECK (SQLSTATE 23514);
 * we guard here too so a bad id never reaches the DB.
 *
 * `profile === null` means Steam could not be hydrated — no key, non-200, timeout, or a 200
 * with no usable persona (AC6). We still insert a placeholder row for a BRAND-NEW player (login
 * must produce a `player` row), but use `ignoreDuplicates` (→ `ON CONFLICT DO NOTHING`) so an
 * EXISTING player's good `display_name` is never overwritten by the 17-digit placeholder on a
 * transient Steam outage. A real profile (which now always carries a real persona name) takes
 * the normal update path (`onConflict: 'steamid64'`), refreshing `display_name`/`avatar_url` on
 * every login — a genuine rename lands on the SAME steamid64 row, never a new identity. (A 200
 * with a real persona but a missing avatar can still null a stored avatar — a rarer partial case
 * deferred to Epic 5.) `created_at` is never in the payload, so the conflict/UPDATE path leaves
 * it untouched (AC3).
 */
export async function upsertPlayer(
  admin: SupabaseClient,
  steamid64: string,
  profile: SteamProfile | null,
): Promise<void> {
  if (!STEAMID64_RE.test(steamid64)) {
    throw new Error(`Refusing to upsert non-canonical steamid64: ${steamid64}`);
  }

  const { error } = profile
    ? await admin.from('player').upsert(
        {
          steamid64,
          display_name: profile.displayName || steamid64,
          avatar_url: profile.avatarUrl,
        },
        { onConflict: 'steamid64' },
      )
    : await admin.from('player').upsert(
        { steamid64, display_name: steamid64, avatar_url: null },
        { onConflict: 'steamid64', ignoreDuplicates: true },
      );

  if (error) {
    throw new Error(`player upsert failed: ${error.message}`);
  }
}
