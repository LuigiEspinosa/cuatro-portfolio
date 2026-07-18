import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { approveMatch, type ApproveMatchResult } from '@/lib/match/approve';

// Service-role writes + the per-request admin gate need Node APIs; never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/approve — the atomic "Aprobar" publish (Story 4.6b, AC1/AC2/AC3).
 *
 * ⚠ THE PATH IS SPECIFIED (SOLUTION-DESIGN:372) — it sits at `api/admin/`, NOT under `api/admin/match/` like
 * 4.2/4.5/4.6a. Follow the spec.
 *
 * On a `pending`, demo-bound match, one tap publishes the stats, writes the demo-derived score, advances the
 * bracket, posts one timeline_feed entry, and emits one `match.approved` Broadcast — all in ONE DB transaction
 * (AD-6). "The line between 'the Admin sees it' and 'everyone sees it' is the Aprobar action" (EXPERIENCE:160).
 *
 * Thin wrapper, exactly like POST /api/admin/match/walkover — all logic lives in lib/match/approve.ts (Vitest)
 * + migration 0017 (pgTAP). `requireAdmin` is the authorization gate; the RPC's service-role-only EXECUTE
 * grant is the second lock; the DB's whole-bracket lock, {ok:false}-advance rollback and AD-23 guards are the
 * teeth that bind even the service role.
 *
 * Body: `{ match_id }` — the winner is DERIVED from the demo score, never supplied. Returns JSON — a machine
 * surface, no i18n (Epic 5 owns Spanish). CSRF is deferred to Epic 7, uniformly.
 */

// ⚠ The Extract<> typing is LOAD-BEARING: a reason with no status entry is a COMPILE error, so a new refusal
// can never silently fall through to an undefined status.
const STATUS_FOR: Record<Extract<ApproveMatchResult, { ok: false }>['reason'], number> = {
  bad_match: 404,
  not_pending: 409, // the match is not `pending` — nothing else is approvable
  not_bound: 409, // no demo bound — bind it first (4.6a)
  wrong_demo: 409, // the bound demo is between other players — re-bind the right demo (4.7 rollback)
  demo_mismatch: 409, // the stat rows belong to a different demo than the match names — re-parse/re-bind
  advance_refused: 409, // the advance was refused (a destination seat is taken) — the whole publish rolled back
  terminal: 409, // AD-23: the match is already a committed result (IC904)
  format_not_declared: 409, // the format was never locked (should not occur on a `pending` match)
  tied: 409, // score_a = score_b — a draw cannot advance a double-elim bracket
  bad_score: 422, // the demo-derived tally is missing/NULL for a competitor
  write_failed: 500,
};

interface ApproveBody {
  match_id: number;
}

// See app/api/admin/match/format/route.ts for why `Number.isInteger(1e21)` makes the range test load-bearing.
const isPositiveInt = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= Number.MAX_SAFE_INTEGER;

/** Validate the body. Returns null on anything malformed (→ 400, no write). */
function parseBody(raw: unknown): ApproveBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { match_id } = raw as Record<string, unknown>;
  if (!isPositiveInt(match_id)) return null;
  return { match_id };
}

export async function POST(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const ssr = await createSupabaseServerClient();

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

    // Actor is ALWAYS the authenticated admin (never from the body).
    const result = await approveMatch(admin, {
      actingAdmin: gate.steamid64,
      matchId: body.match_id,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: STATUS_FOR[result.reason] });
    }

    return NextResponse.json({
      ok: true,
      stat_rows_approved: result.statRowsApproved,
      score_a: result.scoreA,
      score_b: result.scoreB,
      winner_entry: result.winnerEntry,
      advanced: result.advanced,
      champion: result.champion,
    });
  } catch (err) {
    console.error('[api/admin/approve] request failed:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
