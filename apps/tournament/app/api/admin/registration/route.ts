import { type NextRequest } from 'next/server';
import { handleAdminCommand, isPositiveInt } from '@/lib/admin/command-route';
import { setRegistrationOpen, type SetRegistrationResult } from '@/lib/roster';

// Service-role writes + the per-request admin gate need Node APIs; never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/registration — admin opens/closes the registration window (Story 2.5, AC1/AC6).
 *
 * Under the AD-8 app/api/admin/ tree, gated by `requireAdmin` (reuses 2.4's gate → instant revoke via the
 * app_role re-read). Transitions `tournament.state` between `registration_open` ↔ `registration_closed`; the
 * lib's `WHERE state IN (...)` guard means it cannot re-open once the bracket is live (→ 409 locked). Writes an
 * audit row. Thin definition over the shared `handleAdminCommand` envelope (Story 4.9) — all logic in
 * `lib/roster.ts`.
 *
 * `tournament_id` validates through the shared range-capped `isPositiveInt` (Story 4.9 follow-up): a bare
 * `Number.isInteger` check passes `1e21` (an out-of-`bigint`-range id) straight through to a 22003/500, and
 * passes `0`/negatives to the lib's `bad_tournament` 404. Capping here makes both a clean 400 — the same fix
 * `bracket` carries; the tiny contract shift is `tournament_id <= 0` moving 404→400 (a malformed id IS a 400).
 *
 * Body: `{ tournament_id: number; open: boolean }`. Returns JSON (a machine surface, no i18n).
 */

const STATUS_FOR: Record<Extract<SetRegistrationResult, { ok: false }>['reason'], number> = {
  bad_tournament: 404,
  locked: 409,
  write_failed: 500,
};

interface RegistrationBody {
  tournament_id: number;
  open: boolean;
}

/** Validate the body. Returns null on anything malformed (→ 400, no write). */
function parseBody(raw: unknown): RegistrationBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { tournament_id, open } = raw as Record<string, unknown>;
  if (!isPositiveInt(tournament_id)) return null;
  if (typeof open !== 'boolean') return null;
  return { tournament_id, open };
}

export function POST(request: NextRequest) {
  return handleAdminCommand<RegistrationBody, SetRegistrationResult>(request, {
    parseBody,
    run: (admin, gate, body) =>
      setRegistrationOpen(admin, { actingAdmin: gate.steamid64, tournamentId: body.tournament_id, open: body.open }),
    statusFor: STATUS_FOR,
    ok: (r) => ({ ok: true, state: r.state }),
    logLabel: 'api/admin/registration',
  });
}
