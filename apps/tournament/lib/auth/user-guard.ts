import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * `requireUser` — the authenticated-caller gate (Story 2.5, AC5).
 *
 * The non-admin sibling of `requireAdmin` (lib/auth/admin-guard.ts): steps 1–2 only — resolve the
 * caller from the VERIFIED session and return their canonical SteamID64. It does NOT read
 * `app_role`: any authenticated player may act on THEMSELVES, and authorization to a specific
 * action (e.g. enrolling only while registration is open) is the route's / domain layer's concern.
 *
 * Fail-closed: no session, a `getUser` error, or a missing/malformed identity claim all → 401
 * (never allowed-by-default). There is no 403 tier here — without a usable verified identity the
 * caller simply is not an authenticated principal for our purposes.
 *
 * Used by the self-enroll route so a player can enroll ONLY themselves: the enrolled SteamID64
 * comes from this verified claim, never from the request body (no path lets player A enroll player
 * B). `ssr` is INJECTED (mirrors `requireAdmin`) so this is a pure, unit-testable function with no
 * `next/headers` import — the route supplies the request-scoped SSR client.
 *
 * (Decision 1b: kept STANDALONE rather than refactoring the live-QA'd `requireAdmin` — a
 * regression-safe duplication of the ~10-line steps-1–2 shell + the STEAMID64_RE const.)
 */

const STEAMID64_RE = /^[0-9]{17}$/;

export type RequireUserResult =
  | { ok: true; steamid64: string }
  | { ok: false; status: 401 };

export async function requireUser(ssr: SupabaseClient): Promise<RequireUserResult> {
  // 1. Resolve the caller from the VERIFIED session. getUser() revalidates the JWT against the
  //    auth server — never trust getSession()/raw cookies for an authorization decision.
  const { data, error } = await ssr.auth.getUser();
  const user = data?.user;
  if (error || !user) {
    return { ok: false, status: 401 }; // no / invalid session → fail closed
  }

  // 2. Read the canonical id from the verified claim (text end-to-end, 17-digit).
  const claimed = user.app_metadata?.steamid64;
  if (typeof claimed !== 'string' || !STEAMID64_RE.test(claimed)) {
    return { ok: false, status: 401 }; // authenticated but no usable identity claim → fail closed
  }

  return { ok: true, steamid64: claimed };
}
