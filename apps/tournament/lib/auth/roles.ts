import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Role binding for the Steam login flow (Story 2.2, AD-12).
 *
 * `app_role` is the AUTHORITATIVE store (read first); `app_metadata.role` is the JWT
 * mirror that `is_admin()` reads. At login we resolve the role: an existing `app_role`
 * row always wins — so a Story 2.4 revoke is durable and re-login never re-promotes a
 * revoked admin. Only when no row exists do we bootstrap from the env-listed admin
 * allowlist (`admin` iff listed, else `viewer`) and INSERT the row. The resolved role is
 * then mirrored into `app_metadata` by the session layer.
 *
 * Fail-closed: a non-listed id is `viewer`; a hard DB error throws so the callback fails
 * the login closed rather than mint a session with an indeterminate role.
 *
 * `granted_by` is NULL for a login-time system bootstrap — the admin-only / no-self-grant
 * invariant belongs to Story 2.4's grant/revoke route, not this path.
 */

export type Role = 'admin' | 'viewer';

const STEAMID64_RE = /^[0-9]{17}$/;
const UNIQUE_VIOLATION = '23505';

/** Parse the comma-separated `ADMIN_STEAMIDS` env value into a set of 17-digit ids. */
export function parseAdminAllowlist(raw: string | undefined): Set<string> {
  const out = new Set<string>();
  if (!raw) return out;
  for (const part of raw.split(',')) {
    const id = part.trim();
    if (STEAMID64_RE.test(id)) out.add(id); // ignore blanks / malformed entries defensively
  }
  return out;
}

/**
 * Resolve a player's role. Reads `app_role` first (authoritative); if absent, bootstraps
 * from the allowlist, INSERTs the row, and returns the role. The caller mirrors the result
 * into `app_metadata`. Throws on a hard DB error (login fails closed).
 */
export async function resolveRole(
  admin: SupabaseClient,
  steamid64: string,
  allowlist: Set<string>,
): Promise<Role> {
  // 1. Authoritative store wins — an existing row is respected (revoke durability).
  const { data: existing, error: readError } = await admin
    .from('app_role')
    .select('role')
    .eq('steamid64', steamid64)
    .maybeSingle();
  if (readError) {
    throw new Error(`app_role read failed: ${readError.message}`);
  }
  if (existing) {
    return existing.role as Role;
  }

  // 2. No row yet — bootstrap from the allowlist (default viewer) and persist.
  const role: Role = allowlist.has(steamid64) ? 'admin' : 'viewer';
  const { error: insertError } = await admin
    .from('app_role')
    .insert({ steamid64, role, granted_by: null });
  if (insertError) {
    // Concurrent first-login race: another request inserted the row first. Re-read it.
    if (insertError.code === UNIQUE_VIOLATION) {
      const { data: raced } = await admin
        .from('app_role')
        .select('role')
        .eq('steamid64', steamid64)
        .maybeSingle();
      if (raced) return raced.role as Role;
    }
    throw new Error(`app_role insert failed: ${insertError.message}`);
  }
  return role;
}
