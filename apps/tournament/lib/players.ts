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

export interface SteamProfile {
  displayName: string;
  avatarUrl: string | null;
}

/**
 * Hydrate cosmetic profile fields from Steam's Web API (GetPlayerSummaries). Requires
 * `STEAM_API_KEY`. Falls back to the SteamID64 as a placeholder display name if the key
 * is absent or the profile can't be fetched — the login must still succeed (AC2 cosmetic).
 */
export async function fetchSteamProfile(steamid64: string, apiKey: string): Promise<SteamProfile> {
  if (!apiKey) {
    // TODO(2.1): profile hydration pending STEAM_API_KEY — placeholder display name.
    return { displayName: steamid64, avatarUrl: null };
  }
  try {
    const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('steamids', steamid64);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return { displayName: steamid64, avatarUrl: null };
    }
    const json = (await res.json()) as {
      response?: { players?: { personaname?: string; avatarfull?: string }[] };
    };
    const player = json.response?.players?.[0];
    return {
      displayName: player?.personaname?.trim() || steamid64,
      avatarUrl: player?.avatarfull ?? null,
    };
  } catch {
    return { displayName: steamid64, avatarUrl: null };
  }
}

/**
 * Upsert the `player` row keyed by SteamID64 via the service-role client. `display_name`
 * is synced cosmetically. The value MUST satisfy the 17-digit CHECK (SQLSTATE 23514);
 * we guard here too so a bad id never reaches the DB.
 */
export async function upsertPlayer(
  admin: SupabaseClient,
  steamid64: string,
  profile: SteamProfile,
): Promise<void> {
  if (!STEAMID64_RE.test(steamid64)) {
    throw new Error(`Refusing to upsert non-canonical steamid64: ${steamid64}`);
  }
  const { error } = await admin
    .from('player')
    .upsert(
      {
        steamid64,
        display_name: profile.displayName || steamid64,
        avatar_url: profile.avatarUrl,
      },
      { onConflict: 'steamid64' },
    );
  if (error) {
    throw new Error(`player upsert failed: ${error.message}`);
  }
}
