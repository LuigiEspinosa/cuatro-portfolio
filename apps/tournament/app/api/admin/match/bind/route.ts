import { type NextRequest } from 'next/server';
import { handleAdminCommand, isPositiveInt } from '@/lib/admin/command-route';
import { bindMatchDemo, type BindMatchDemoResult } from '@/lib/match/bind';

// Service-role writes + the per-request admin gate need Node APIs; never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/match/bind — bind a parsed demo to the bracket match it decided (Story 4.6a, AC1/AC2/AC3).
 *
 * Populates the three FKs that have been NULL since migration 0010 (`match.demo_id`, `demo.match_id`,
 * `stat_row.match_id`) and moves the match `declared|live -> pending` — the state Story 4.6b's Aprobar and
 * Story 4.7's rollback both require. The match's format must already be declared (AD-10); a committed
 * bye/forfeit/void is REFUSED (AD-23), as is a demo held as `anomalous` (accept it first via
 * POST /api/admin/accept-anomaly, Story 4.9).
 *
 * Thin definition over the shared `handleAdminCommand` envelope (Story 4.9) — the gate/body-parse/500 boundary
 * live there. All command logic lives in lib/match/bind.ts (Vitest) + migration 0016 (pgTAP). `requireAdmin`
 * is the authorization gate; the RPC's service-role-only EXECUTE grant is the second lock; the RPC's guards +
 * the DB's CHECKs/triggers are the teeth that bind even service_role.
 *
 * Body: `{ match_id, demo_id }`. Binding the SAME pair twice is IDEMPOTENT (200, `idempotent: true`) so a
 * dropped response is safe to retry; a DIFFERENT pair is refused 409 rather than silently re-pointed
 * (re-pointing a bound demo is Story 4.7's audited rollback).
 *
 * Returns JSON — a machine surface, no i18n (Epic 5 owns Spanish). CSRF is deferred to Epic 7, uniformly.
 */

// ⚠ The Extract<> typing is LOAD-BEARING: a new refusal reason with no status entry is a COMPILE error, not
// a silent `undefined` status at runtime.
const STATUS_FOR: Record<Extract<BindMatchDemoResult, { ok: false }>['reason'], number> = {
  bad_match: 404,
  bad_demo: 404,
  not_bindable: 409, // not `declared`/`live` — including a committed bye/forfeit/void (AD-23)
  already_bound: 409, // a different demo/match already holds this binding — rollback is Story 4.7
  anomalous: 409, // the demo is held by the validation gate; accept it (accept-anomaly, 4.9) before binding
  format_not_declared: 409, // AD-10: declare the format before the match can reach `pending`
  terminal: 409, // AD-23 IC901 — the terminal guard refused the flip
  no_stats: 422, // the demo produced no stat rows: it decided nothing
  write_failed: 500,
};

interface BindBody {
  match_id: number;
  demo_id: number;
}

/** Validate the body. Returns null on anything malformed (→ 400, no write). */
function parseBody(raw: unknown): BindBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { match_id, demo_id } = raw as Record<string, unknown>;
  if (!isPositiveInt(match_id) || !isPositiveInt(demo_id)) return null;
  return { match_id, demo_id };
}

export function POST(request: NextRequest) {
  return handleAdminCommand<BindBody, BindMatchDemoResult>(request, {
    parseBody,
    // The actor is ALWAYS the authenticated admin — never taken from the body (AD-17: the audit row's "who"
    // must be the session, or it is worthless).
    run: (admin, gate, body) =>
      bindMatchDemo(admin, { actingAdmin: gate.steamid64, matchId: body.match_id, demoId: body.demo_id }),
    statusFor: STATUS_FOR,
    ok: (r) => ({
      ok: true,
      match_id: r.matchId,
      demo_id: r.demoId,
      state: r.state,
      idempotent: r.idempotent,
      stat_rows_bound: r.statRowsBound,
    }),
    logLabel: 'api/admin/match/bind',
  });
}
