import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { steamEmail } from '@/lib/auth/session';

/**
 * Role binding + role administration for the Steam auth system.
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
 * Story 2.2 (BINDING): `parseAdminAllowlist` + `resolveRole` — read/bootstrap the role at login.
 * Story 2.4 (ENFORCEMENT + REVOKE): `setRole` (durable grant/revoke write with the
 * `granted_by` / no-self-grant invariant) + `healRoleMirror` (re-mint `app_metadata` so a
 * post-refresh JWT flips `is_admin()`). The admin gate that authorizes these lives in
 * `lib/auth/admin-guard.ts`; the route that calls them is `app/api/admin/roles/route.ts`.
 *
 * `granted_by` is NULL for a login-time system bootstrap (`resolveRole`); an admin grant/
 * revoke (`setRole`) always stamps it with the acting admin's id (a different id, by the
 * no-self-grant guard) — the admin-only / no-self-grant invariant is enforced HERE in app
 * code, not a DB CHECK (migration 0003's header forbids one — a service-role write bypasses RLS).
 */

export type Role = 'admin' | 'viewer';

const STEAMID64_RE = /^[0-9]{17}$/;
const UNIQUE_VIOLATION = '23505';
const FK_VIOLATION = '23503'; // app_role.steamid64 → player(steamid64): target never logged in

// Pagination for `healRoleMirror`'s user lookup — there is no `getUserByEmail` in the
// installed @supabase/auth-js, so we page `listUsers` and match by email. perPage is
// generous (this private event has a handful of users), but we page defensively so a target
// on a later page is still found; MAX_PAGES is a safety backstop far beyond real scale.
const LIST_USERS_PER_PAGE = 200;
const LIST_USERS_MAX_PAGES = 50;

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

export type SetRoleResult =
  | { ok: true }
  | { ok: false; reason: 'self_target' | 'bad_target' | 'no_such_player' | 'write_failed' };

/**
 * Set a target player's role (Story 2.4, AC5/AC6 — the durable half of grant/revoke).
 *
 * UPDATEs an existing `app_role` row (revoke / re-grant) or INSERTs a first row, via the
 * service-role client only (no client write policy exists on `app_role`). Stamps
 * `granted_by` = the acting admin and refreshes `granted_at` on every change. NEVER deletes
 * on revoke — a persistent `viewer` row is what keeps the revoke durable against re-login +
 * allowlist re-promotion (`resolveRole` reads `app_role` first).
 *
 * ⭐ Story 4.9 (DELIVERABLE 2 / DECISION B): setRole now ALSO writes the AD-17 `grant_role`
 * audit_log row — the one previously-un-logged audited action (the deferral roles/route.ts:90-93
 * once carried is lifted here). It is EVENT-GLOBAL (tournament_id NULL — a role is event-global,
 * AD-18; migration 0020 dropped audit_log.tournament_id's NOT NULL to permit it) and NON-ATOMIC
 * with the app_role write: the durable `app_role` row is the source of truth and lands FIRST, so
 * the audit insert is best-effort append-only logging — a failure logs and does NOT roll back an
 * idempotent grant. `before`/`after` capture the target's prior and new role (a pre-read gets the
 * prior; `before.role` is null on a first grant).
 *
 * Fail-closed guards run BEFORE any DB write: a non-17-digit target → `bad_target`; a
 * self-target → `self_target` (no-self-grant prevents a self-demote lockout / self-promote
 * loop and guarantees `granted_by` is always a DIFFERENT admin). A `23503` FK violation
 * (target has no `player` row — never logged in) → `no_such_player`; any other error →
 * `write_failed`. The route maps each reason to an HTTP status.
 */
export async function setRole(
  admin: SupabaseClient,
  params: { actingAdmin: string; target: string; role: Role },
): Promise<SetRoleResult> {
  const { actingAdmin, target, role } = params;

  if (!STEAMID64_RE.test(target)) {
    return { ok: false, reason: 'bad_target' };
  }
  if (actingAdmin === target) {
    return { ok: false, reason: 'self_target' };
  }

  // Capture the prior role for the audit row's before/after. Best-effort: a read error does not block the
  // grant — `before.role` falls back to null ("no prior role recorded"), and the durable app_role write below
  // is still the source of truth.
  const { data: prior } = await admin
    .from('app_role')
    .select('role')
    .eq('steamid64', target)
    .maybeSingle();
  const beforeRole = (prior?.role as Role | undefined) ?? null;

  // `granted_at` is set explicitly (not left to the column default) so it refreshes on every
  // grant/revoke — a conflict UPDATE does not re-apply the INSERT default.
  const { error } = await admin.from('app_role').upsert(
    {
      steamid64: target,
      role,
      granted_by: actingAdmin,
      granted_at: new Date().toISOString(),
    },
    { onConflict: 'steamid64' },
  );
  if (error) {
    if (error.code === FK_VIOLATION) {
      return { ok: false, reason: 'no_such_player' };
    }
    return { ok: false, reason: 'write_failed' };
  }

  // ⭐ AD-17 / Story 4.9: the grant_role audit row, written AFTER the durable app_role write (which already
  // landed). Event-global (tournament_id NULL, AD-18) and non-atomic: a failure LOGS and does not roll back the
  // idempotent grant. actor is the acting admin (a real player — actor_steamid64 is NOT NULL + FK to player).
  const { error: auditError } = await admin.from('audit_log').insert({
    tournament_id: null,
    actor_steamid64: actingAdmin,
    action: 'grant_role',
    target_match_id: null,
    detail: {
      target,
      before: { role: beforeRole },
      after: { role },
    },
  });
  if (auditError) {
    console.error(
      '[setRole] grant_role audit_log insert failed (the grant already landed and is idempotent):',
      auditError.message,
    );
  }

  return { ok: true };
}

/**
 * Re-mint the target's `app_metadata` mirror so their POST-REFRESH JWT carries the new role
 * (AC2/AC6) and `is_admin()` converges. The Admin API REPLACES `app_metadata` (no deep-merge),
 * so we pass BOTH keys — omitting `steamid64` clobbers it (the load-bearing gotcha proven live
 * in 2.2's D1 gate).
 *
 * There is no `getUserByEmail` in the installed @supabase/auth-js, so we resolve the auth
 * user id by paging `listUsers` and matching `email === steamEmail(target)`. If the target has
 * no Supabase auth user yet (never completed a session), this is a DELIBERATE no-op success —
 * NOT a swallowed error: `app_role` already carries the truth and `resolveRole` binds the
 * correct role on their first/next login. Throws only on a real infra error (listUsers /
 * updateUserById), so a genuine failure fails closed rather than pretending to have healed.
 */
export async function healRoleMirror(
  admin: SupabaseClient,
  target: string,
  role: Role,
): Promise<void> {
  const uid = await findAuthUserIdByEmail(admin, steamEmail(target));
  if (!uid) {
    return; // no auth user yet — resolveRole will bind the role on next login
  }
  const { error } = await admin.auth.admin.updateUserById(uid, {
    app_metadata: { steamid64: target, role }, // BOTH keys — the Admin API replaces, not merges
  });
  if (error) {
    throw new Error(`healRoleMirror updateUserById failed: ${error.message}`);
  }
}

/** Resolve a Supabase auth user id by email (there is no getUserByEmail — page listUsers). */
async function findAuthUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  for (let page = 1; page <= LIST_USERS_MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: LIST_USERS_PER_PAGE,
    });
    if (error) {
      throw new Error(`listUsers failed: ${error.message}`);
    }
    const users = data?.users ?? [];
    const match = users.find((u) => u.email === email);
    if (match) return match.id;
    if (users.length < LIST_USERS_PER_PAGE) break; // short page → no more users
  }
  return null;
}
