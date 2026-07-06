import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { setRegistrationOpen, type SetRegistrationResult } from '@/lib/roster';

// Service-role writes + the per-request admin gate need Node APIs; never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/registration — admin opens/closes the registration window (Story 2.5, AC1/AC6).
 *
 * Under the AD-8 app/api/admin/ tree, `requireAdmin`-gated (reuses 2.4's gate verbatim → instant
 * revoke via the app_role re-read). Transitions `tournament.state` between `registration_open` ↔
 * `registration_closed`; the lib's `WHERE state IN (...)` guard means it cannot re-open once the
 * bracket is live (→ 409 locked). Writes an audit row. Thin wrapper — all logic in `lib/roster.ts`.
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
  if (typeof tournament_id !== 'number' || !Number.isInteger(tournament_id)) return null;
  if (typeof open !== 'boolean') return null;
  return { tournament_id, open };
}

export async function POST(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const ssr = await createSupabaseServerClient();

    // AC1/AC6: server-enforced admin gate. Non-admin → 403, no write.
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

    const result = await setRegistrationOpen(admin, {
      actingAdmin: gate.steamid64,
      tournamentId: body.tournament_id,
      open: body.open,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: STATUS_FOR[result.reason] });
    }

    return NextResponse.json({ ok: true, state: result.state });
  } catch (err) {
    console.error('[api/admin/registration] request failed:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
