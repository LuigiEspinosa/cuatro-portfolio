import { type NextRequest } from 'next/server';
import { handleAdminCommand, isPositiveInt } from '@/lib/admin/command-route';
import { acceptAnomaly, type AcceptAnomalyResult } from '@/lib/admin/accept-anomaly';

// Service-role writes + the per-request admin gate need Node APIs; never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/accept-anomaly — accept a held demo's anomaly (Story 4.9, DELIVERABLE 3; Story 3.4 AC2).
 *
 * The `Anomalous → Pending` admin decision that was ORPHANED between Epic 3 and Epic 4 (0008:17-20 homed it to
 * "Epic 4 audited admin routes, AD-8", but no Epic-4 AC named it until 4.9). The worker HOLDS a demo that fails
 * a validation gate (`validation_state='anomalous'`, Story 3.4), and `bind_match_demo` (4.6a) refuses to bind a
 * held demo — so this route is the missing unblock step: the admin explicitly accepts the anomaly (LOGGED),
 * flipping `validation_state → pending` so the demo becomes bindable, then approvable through the existing path.
 *
 * ⚠ SCOPE (DECISION D/G): this flips ONLY `demo.validation_state`. It does NOT bind, approve, or set `idle_dq`.
 *
 * Thin definition over the shared `handleAdminCommand` envelope (Story 4.9) — the gate/body-parse/500 boundary
 * live there. All command logic lives in lib/admin/accept-anomaly.ts (Vitest) + migration 0020 (pgTAP).
 * `requireAdmin` is the authorization gate; the RPC's service-role-only EXECUTE grant is the second lock.
 *
 * Body: `{ demo_id }`. Returns JSON — a machine surface, no i18n (Epic 5 owns Spanish). CSRF is deferred to
 * Epic 7, uniformly.
 */

// ⚠ The Extract<> typing is LOAD-BEARING: a reason with no status entry is a COMPILE error, so a new refusal
// can never silently fall through to an undefined status.
const STATUS_FOR: Record<Extract<AcceptAnomalyResult, { ok: false }>['reason'], number> = {
  bad_demo: 404,
  not_anomalous: 409, // the demo is not `anomalous` — nothing to accept (also idempotency on a 2nd accept)
  write_failed: 500,
};

interface AcceptAnomalyBody {
  demo_id: number;
}

/** Validate the body. Returns null on anything malformed (→ 400, no write). Uses the shared range-capped
 *  `isPositiveInt` (Story 4.9) so an out-of-`bigint`-range id is a clean 400, never a 22003/500. */
function parseBody(raw: unknown): AcceptAnomalyBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { demo_id } = raw as Record<string, unknown>;
  if (!isPositiveInt(demo_id)) return null;
  return { demo_id };
}

export function POST(request: NextRequest) {
  return handleAdminCommand<AcceptAnomalyBody, AcceptAnomalyResult>(request, {
    parseBody,
    // Actor is ALWAYS the authenticated admin (never from the body).
    run: (admin, gate, body) => acceptAnomaly(admin, { actingAdmin: gate.steamid64, demoId: body.demo_id }),
    statusFor: STATUS_FOR,
    ok: (r) => ({ ok: true, demo_id: r.demoId, validation_state: r.validationState }),
    logLabel: 'api/admin/accept-anomaly',
  });
}
