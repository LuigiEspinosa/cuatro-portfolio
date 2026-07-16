import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { markWalkover, type MarkWalkoverResult } from '@/lib/match/walkover';

// Service-role writes + the per-request admin gate need Node APIs; never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/match/walkover — mark a no-show FORFEIT (Story 4.5, AC1/AC2/AC3).
 *
 * The match must already be on the grace clock (`awaiting_grace`, via POST /api/admin/match/grace) and the
 * server-side grace period must have elapsed. The present player is seated as winner and the bracket
 * advances; the absent player drops via the normal double-elim loser edge. A committed forfeit is TERMINAL
 * (AD-23) — a later demo can never flip it.
 *
 * Thin wrapper, exactly like POST /api/admin/match/format — all logic lives in lib/match/walkover.ts
 * (Vitest) + migration 0015 (pgTAP). `requireAdmin` is the authorization gate; the RPC's service-role-only
 * EXECUTE grant is the second lock; the DB's grace gate, terminal guard and {ok:false}-advance rollback are
 * the teeth that bind even the service role.
 *
 * Body: `{ match_id, winner_entry }` — winner_entry is the PRESENT player (one of the match's two seats).
 * Returns JSON — a machine surface, no i18n (Epic 5 owns Spanish). CSRF is deferred to Epic 7, uniformly.
 */

const STATUS_FOR: Record<Extract<MarkWalkoverResult, { ok: false }>['reason'], number> = {
  bad_match: 404,
  not_awaiting: 409, // the match is not on the grace clock — begin grace first
  grace_active: 409, // the grace period has not elapsed yet
  bad_winner: 422, // winner_entry is not one of the two seated competitors
  terminal: 409, // AD-23: the match is already a committed bye/forfeit/void
  advance_refused: 409, // the forfeit's advance was refused (a destination seat is taken) — forfeit rolled back
  write_failed: 500,
};

interface WalkoverBody {
  match_id: number;
  winner_entry: number;
}

// See app/api/admin/match/format/route.ts for why `Number.isInteger(1e21)` makes the range test load-bearing.
const isPositiveInt = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= Number.MAX_SAFE_INTEGER;

/** Validate the body. Returns null on anything malformed (→ 400, no write). */
function parseBody(raw: unknown): WalkoverBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { match_id, winner_entry } = raw as Record<string, unknown>;
  if (!isPositiveInt(match_id) || !isPositiveInt(winner_entry)) return null;
  return { match_id, winner_entry };
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

    const result = await markWalkover(admin, {
      actingAdmin: gate.steamid64,
      matchId: body.match_id,
      winnerEntry: body.winner_entry,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: STATUS_FOR[result.reason] });
    }

    return NextResponse.json({
      ok: true,
      forfeiting_entry: result.forfeitingEntry,
      winner_entry: result.winnerEntry,
      advanced: result.advanced,
      champion: result.champion,
    });
  } catch (err) {
    console.error('[api/admin/match/walkover] request failed:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
