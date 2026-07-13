import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { generateAndPersistBracket, type BracketCommandResult } from '@/lib/bracket/generate';

// Service-role writes + the per-request admin gate need Node APIs (and the draw needs node:crypto);
// never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/bracket — admin generates the double-elim bracket from the closed roster (Story 4.1).
 *
 * The FIRST atomic admin command route (AD-6/AD-8): unlike the roster routes, whose writes are each
 * individually idempotent, this one cannot be decomposed — a partial failure would leave a half-built
 * bracket. So the whole thing (seed the roster, insert every match, flip the state, append the audit
 * row) commits inside the `generate_bracket` RPC, in one transaction. Story 4.6 (Aprobar) reuses this
 * shape; Story 4.9 generalizes the audited-command-route boilerplate.
 *
 * Thin wrapper — all logic lives in `lib/bracket/generate.ts` (Vitest) and migration 0011 (pgTAP).
 * `requireAdmin` is the authorization gate (server-side app_role re-read = instant revoke); the RPC's
 * service-role-only EXECUTE grant is the second lock on the same door.
 *
 * Body: `{ tournament_id: number }`. Returns JSON (a machine surface, no i18n — the Spanish viewer
 * bracket, including the `Pase directo` bye badge, is Epic 5).
 */

const STATUS_FOR: Record<Extract<BracketCommandResult, { ok: false }>['reason'], number> = {
  bad_tournament: 404,
  not_closed: 409, // registration still open (or the event is already past the bracket)
  already_live: 409, // single-shot — the bracket exists; regenerating is a rollback, not a retry
  roster_changed: 409, // the roster moved under us; re-read and try again (retry-able)
  bad_field_count: 422, // 8..16 is the drawable range — a well-formed request the field cannot satisfy
  // The RPC re-validates the payload it is handed and refuses a malformed one. This route cannot
  // produce either (it feeds the RPC exactly what generateBracket computed), so both are only reachable
  // by a direct service-role RPC call — but they are mapped rather than swallowed, because a refusal
  // that falls through to `write_failed` would report a caller error as a server fault.
  bad_seeds: 422, // p_seeds was not a permutation of 1..N
  bad_skeleton: 422, // p_matches was not the complete 2*bracketSize-2 row skeleton
  write_failed: 500,
};

interface BracketBody {
  tournament_id: number;
}

/** Validate the body. Returns null on anything malformed (→ 400, no write). */
function parseBody(raw: unknown): BracketBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { tournament_id } = raw as Record<string, unknown>;
  if (typeof tournament_id !== 'number' || !Number.isInteger(tournament_id)) return null;
  return { tournament_id };
}

export async function POST(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const ssr = await createSupabaseServerClient();

    // AC1: server-enforced admin gate. Non-admin → 403, no draw, no write.
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

    const result = await generateAndPersistBracket(admin, {
      actingAdmin: gate.steamid64,
      tournamentId: body.tournament_id,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: STATUS_FOR[result.reason] });
    }

    return NextResponse.json({
      ok: true,
      field_size: result.fieldSize,
      bracket_size: result.bracketSize,
      match_count: result.matchCount,
      bye_seeds: result.byeSeeds,
    });
  } catch (err) {
    console.error('[api/admin/bracket] request failed:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
