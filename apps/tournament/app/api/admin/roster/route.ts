import { type NextRequest } from 'next/server';
import { handleAdminCommand, isPositiveInt } from '@/lib/admin/command-route';
import { adminAddPlayer, removePlayer, type AdminRosterResult } from '@/lib/roster';

// Service-role writes + the per-request admin gate need Node APIs; never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/roster — admin adds/removes a roster player (Story 2.5, AC3/AC6).
 *
 * Under the AD-8 app/api/admin/ tree, gated by `requireAdmin`. Adds (allowed while
 * registration_open/_closed — admin may add after close) or SOFT-removes (status='removed', allowed
 * only before bracket generation) a player, each writing an audit row. The pre-bracket lock (AC3) is
 * enforced in `lib/roster.ts` (state gate + no delete grant). Thin definition over the shared
 * `handleAdminCommand` envelope (Story 4.9) — all logic in the lib.
 *
 * `tournament_id` validates through the shared range-capped `isPositiveInt` (Story 4.9 follow-up): a bare
 * `Number.isInteger` check passes `1e21` (an out-of-`bigint`-range id) straight through to a 22003/500. Capping
 * here makes it a clean 400 — the same fix `bracket` carries; the tiny contract shift is `tournament_id <= 0`
 * moving 404→400 (a malformed id IS a 400).
 *
 * Body: `{ tournament_id: number; steamid64: string; action: 'add' | 'remove' }`. Returns JSON.
 */

const STATUS_FOR: Record<Extract<AdminRosterResult, { ok: false }>['reason'], number> = {
  bad_target: 400,
  bad_tournament: 404,
  no_such_player: 404,
  not_on_roster: 404,
  locked: 409,
  write_failed: 500,
};

interface RosterBody {
  tournament_id: number;
  steamid64: string;
  action: 'add' | 'remove';
}

/** Validate the body. Returns null on anything malformed (→ 400, no write). The 17-digit id check
 *  is the lib's job (→ bad_target → 400), so we only type-check steamid64 here. */
function parseBody(raw: unknown): RosterBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { tournament_id, steamid64, action } = raw as Record<string, unknown>;
  if (!isPositiveInt(tournament_id)) return null;
  if (typeof steamid64 !== 'string') return null;
  if (action !== 'add' && action !== 'remove') return null; // closed set; narrows the type
  return { tournament_id, steamid64, action };
}

export function POST(request: NextRequest) {
  return handleAdminCommand<RosterBody, AdminRosterResult>(request, {
    parseBody,
    run: (admin, gate, body) => {
      const params = {
        actingAdmin: gate.steamid64,
        tournamentId: body.tournament_id,
        steamid64: body.steamid64,
      };
      return body.action === 'add' ? adminAddPlayer(admin, params) : removePlayer(admin, params);
    },
    statusFor: STATUS_FOR,
    ok: () => ({ ok: true }),
    logLabel: 'api/admin/roster',
  });
}
