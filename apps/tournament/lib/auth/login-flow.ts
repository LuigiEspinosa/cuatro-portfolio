import { resolveSteamCallback, type CallbackConfig, type CallbackResult } from '@/lib/steam/callback';
import type { SteamVerifier } from '@/lib/steam/openid';

/**
 * Orchestrates the callback: verify first (pure), and ONLY on success run the two side
 * effects — the service-role `player` upsert (AC2) and the Supabase session mint (AC5).
 * On any failure the effects are never called (AC3: no write, no session on tamper).
 *
 * The effects are injected so AC7 tests can assert call counts without touching real
 * Supabase or the live Steam service.
 */

export interface LoginSideEffects {
  upsertPlayer(steamid64: string): Promise<void>;
  establishSession(steamid64: string): Promise<void>;
}

export async function runSteamLogin(
  args: {
    params: URLSearchParams;
    nonceCookie: string | undefined;
    verifier: SteamVerifier;
    config: CallbackConfig;
  },
  effects: LoginSideEffects,
): Promise<CallbackResult> {
  const result = await resolveSteamCallback(args);
  if (!result.ok) {
    return result; // fail closed — no player write, no session
  }

  // Verified. Cosmetic profile upsert, then mint the authenticated session.
  await effects.upsertPlayer(result.steamid64);
  await effects.establishSession(result.steamid64);
  return result;
}
