import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * `requireAdmin` — the server-side admin gate (Story 2.4, AC1/AC3; AD-8/AD-12).
 *
 * This is the single reusable primitive every Epic-4 command route (advance/approve/
 * rollback/…) will call before mutating the event. It authorizes an admin-only action
 * from the VERIFIED Supabase session — never an unvalidated cookie — and is fail-closed:
 * no session, a `getUser` error, a missing/malformed identity claim, a non-admin role, an
 * absent `app_role` row, or a hard DB read error all → DENIED, never allowed-by-default.
 *
 * ⭐ Decision Option A (Cuatro, 2026-07-05) — authoritative re-read = instant revoke.
 * We do NOT trust the JWT's `role` claim for the authorization decision. Supabase access
 * tokens are stateless: a revoked admin's already-issued token keeps `role:admin` until it
 * expires (~1h). Instead we read the caller's canonical `steamid64` from the verified claim
 * and RE-READ the authoritative `app_role` table (service role) to confirm `role='admin'`
 * right now. A revoke (`UPDATE app_role → viewer`) is therefore effective on the caller's
 * very next admin action — the story's headline ("a stale JWT cannot retain admin after
 * revoke") becomes literally true for mutating actions, with no dependency on token-refresh
 * timing. Cost: one indexed single-row PK SELECT per admin action.
 *
 * Both clients are INJECTED (mirrors `login-flow.ts`/`roles.ts`) so this is a pure,
 * unit-testable function with no `next/headers` import — the route supplies the request-
 * scoped SSR client and the service-role `admin` client.
 */

const STEAMID64_RE = /^[0-9]{17}$/;

export type RequireAdminResult =
  | { ok: true; steamid64: string }
  | { ok: false; status: 401 | 403 };

export async function requireAdmin(
  ssr: SupabaseClient,
  admin: SupabaseClient,
): Promise<RequireAdminResult> {
  // 1. Resolve the caller from the VERIFIED session. getUser() revalidates the JWT against
  //    the auth server — never trust getSession()/raw cookies for an authorization decision.
  const { data, error } = await ssr.auth.getUser();
  const user = data?.user;
  if (error || !user) {
    return { ok: false, status: 401 }; // no / invalid session → fail closed
  }

  // 2. Read the canonical id from the verified claim (text end-to-end, 17-digit).
  const claimed = user.app_metadata?.steamid64;
  if (typeof claimed !== 'string' || !STEAMID64_RE.test(claimed)) {
    return { ok: false, status: 403 }; // authenticated but no usable identity claim
  }

  // 3. ⭐ Authorize against the AUTHORITATIVE app_role store (Option A — instant revoke).
  //    A stale token still carrying role:admin is rejected the moment app_role flips to viewer.
  const { data: row, error: roleError } = await admin
    .from('app_role')
    .select('role')
    .eq('steamid64', claimed)
    .maybeSingle();
  if (roleError) {
    // A hard read error must DENY (fail closed), never allow-by-default. Log for ops.
    console.error('[requireAdmin] app_role read failed:', roleError.message);
    return { ok: false, status: 403 };
  }
  if (row?.role !== 'admin') {
    return { ok: false, status: 403 }; // viewer / no row / anything but admin → denied
  }

  return { ok: true, steamid64: claimed };
}
