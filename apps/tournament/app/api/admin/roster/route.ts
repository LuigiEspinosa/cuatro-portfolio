import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { adminAddPlayer, removePlayer, type AdminRosterResult } from '@/lib/roster';

// Service-role writes + the per-request admin gate need Node APIs; never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/roster — admin adds/removes a roster player (Story 2.5, AC3/AC6).
 *
 * Under the AD-8 app/api/admin/ tree, `requireAdmin`-gated. Adds (allowed while
 * registration_open/_closed — admin may add after close) or SOFT-removes (status='removed', allowed
 * only before bracket generation) a player, each writing an audit row. The pre-bracket lock (AC3) is
 * enforced in `lib/roster.ts` (state gate + no delete grant). Thin wrapper — all logic in the lib.
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
  if (typeof tournament_id !== 'number' || !Number.isInteger(tournament_id)) return null;
  if (typeof steamid64 !== 'string') return null;
  if (action !== 'add' && action !== 'remove') return null; // closed set; narrows the type
  return { tournament_id, steamid64, action };
}

export async function POST(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const ssr = await createSupabaseServerClient();

    // AC6: server-enforced admin gate. Non-admin → 403, no write.
    const gate = await requireAdmin(ssr, admin);
    if (!gate.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: gate.status });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }
    const body = parseBody(raw);
    if (!body) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    const params = {
      actingAdmin: gate.steamid64,
      tournamentId: body.tournament_id,
      steamid64: body.steamid64,
    };
    const result =
      body.action === 'add'
        ? await adminAddPlayer(admin, params)
        : await removePlayer(admin, params);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: STATUS_FOR[result.reason] });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/admin/roster] request failed:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
