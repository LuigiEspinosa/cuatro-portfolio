import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { setRole, healRoleMirror, type Role, type SetRoleResult } from '@/lib/auth/roles';

// The Auth Admin API + service-role writes need Node APIs (like the callback route), and the
// gate reads per-request session state — force dynamic, never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/roles — admin-only grant/revoke (Story 2.4, AC1/AC4/AC5/AC6).
 *
 * The FIRST route under the AD-8 `app/api/admin/` tree. A THIN wrapper: all logic lives in
 * the injectable `lib/` functions (mirrors the callback route delegating to `login-flow.ts`),
 * so this file is glue and is covered indirectly by the `lib/auth/*` unit tests.
 *
 * Body: `{ steamid64: string; role: 'admin' | 'viewer' }`. Returns JSON — a machine surface,
 * no i18n (the UX docs define no role-management/forbidden page; this is backend-only).
 */

// Map each setRole refusal reason to an HTTP status.
const STATUS_FOR: Record<Extract<SetRoleResult, { ok: false }>['reason'], number> = {
  self_target: 409,
  bad_target: 400,
  no_such_player: 404,
  write_failed: 500,
};

interface RoleBody {
  steamid64: string;
  role: Role;
}

/** Validate the request body. Returns null on anything malformed (→ 400, no write). */
function parseRoleBody(raw: unknown): RoleBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { steamid64, role } = raw as Record<string, unknown>;
  if (typeof steamid64 !== 'string') return null;
  if (role !== 'admin' && role !== 'viewer') return null; // closed set (AD-12); narrows to Role
  return { steamid64, role };
}

export async function POST(request: NextRequest) {
  const admin = getAdminClient();
  const ssr = await createSupabaseServerClient();

  // AC1/AC3: server-enforced admin gate. Non-admin → 403, no write. requireAdmin re-reads the
  // authoritative app_role (Option A), so a revoked admin is rejected on their very next call —
  // independent of when their stale access token expires.
  const gate = await requireAdmin(ssr, admin);
  if (!gate.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: gate.status });
  }

  // AC4: validate the body — malformed / missing / invalid role → 400 (no write).
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const body = parseRoleBody(raw);
  if (!body) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    // AC5/AC6: durable app_role write. granted_by = the acting admin (a DIFFERENT id by the
    // no-self-grant guard, so it is a genuine accountability pointer); a revoke UPDATEs the
    // row to viewer, never deletes it (keeps the revoke durable against re-login + allowlist).
    const result = await setRole(admin, {
      actingAdmin: gate.steamid64,
      target: body.steamid64,
      role: body.role,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: STATUS_FOR[result.reason] });
    }

    // AC6: heal the JWT mirror so the target's POST-REFRESH token carries the new role and
    // is_admin() converges on any RLS-read path. (Enforcement is already instant via the
    // app_role re-read in requireAdmin; this is the refresh-convergence half.)
    //
    // Audit note (NOT a write): the audit_log row for action='grant_role' is DEFERRED to
    // Story 4.9 — audit_log.tournament_id is NOT NULL, but a role change is event-global
    // (AD-18). app_role.granted_by / granted_at is the interim durable record. Do NOT write
    // audit_log here.
    await healRoleMirror(admin, body.steamid64, body.role);

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Never surface a raw 500. A thrown side effect (e.g. a listUsers/updateUserById infra
    // failure in healRoleMirror) fails closed to a controlled JSON error. The durable app_role
    // write may already have landed and the whole operation is idempotent, so a retry is safe.
    console.error('[api/admin/roles] role write failed:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
