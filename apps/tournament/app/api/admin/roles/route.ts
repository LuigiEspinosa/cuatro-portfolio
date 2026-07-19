import { type NextRequest } from 'next/server';
import { handleAdminCommand } from '@/lib/admin/command-route';
import { setRole, healRoleMirror, type Role, type SetRoleResult } from '@/lib/auth/roles';

// The Auth Admin API + service-role writes need Node APIs (like the callback route), and the
// gate reads per-request session state — force dynamic, never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/roles — admin-only grant/revoke (Story 2.4, AC1/AC4/AC5/AC6).
 *
 * The FIRST route under the AD-8 `app/api/admin/` tree. A THIN definition over the shared `handleAdminCommand`
 * envelope (Story 4.9): the gate, body-parse, refusal→status mapping and 500 boundary live in the helper; the
 * durable role write + JWT-mirror heal live in the injectable `lib/auth/*` functions (covered by the
 * `lib/auth/*` unit tests).
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

export function POST(request: NextRequest) {
  return handleAdminCommand<RoleBody, SetRoleResult>(request, {
    parseBody: parseRoleBody,
    // AC5/AC6: durable app_role write. granted_by = the acting admin (a DIFFERENT id by the no-self-grant
    // guard, so it is a genuine accountability pointer); a revoke UPDATEs the row to viewer, never deletes it.
    // setRole ALSO writes the `grant_role` audit row (Story 4.9, DECISION B — the audit deferral roles/route.ts
    // once carried is now lifted; the row is written in setRole, in migration 0020's now-nullable
    // audit_log.tournament_id event-global shape). On success we heal the JWT mirror so the target's
    // POST-REFRESH token carries the new role and is_admin() converges (enforcement is already instant via the
    // app_role re-read in requireAdmin; this is the refresh-convergence half). A healRoleMirror throw
    // propagates to the helper's outer try/catch → JSON 500 (the durable app_role write already landed and the
    // whole operation is idempotent, so a retry is safe).
    run: async (admin, gate, body) => {
      const result = await setRole(admin, {
        actingAdmin: gate.steamid64,
        target: body.steamid64,
        role: body.role,
      });
      if (result.ok) {
        await healRoleMirror(admin, body.steamid64, body.role);
      }
      return result;
    },
    statusFor: STATUS_FOR,
    ok: () => ({ ok: true }),
    logLabel: 'api/admin/roles',
  });
}
