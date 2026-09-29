import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import {
  beginMatchGrace,
  resumeMatch,
  type BeginGraceResult,
  type ResumeMatchResult,
} from '@/lib/match/walkover';

// Service-role writes + the per-request admin gate need Node APIs; never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The grace-clock transitions for a no-show match (Story 4.5, AC2). ONE route, two verbs (DECISION F):
 *   * POST   — begin grace: `declared -> awaiting_grace`, stamp the server clock.
 *   * DELETE — resume:      `awaiting_grace -> declared` (the absent player arrived), clear the clock.
 *
 * Thin wrappers over lib/match/walkover.ts (Vitest) + migration 0015 (pgTAP), mirroring
 * POST /api/admin/match/format. `requireAdmin` gates both; the RPC grants + DB triggers are the teeth.
 *
 * ⚠ DOCUMENTED EXCEPTION to Story 4.9's shared `handleAdminCommand` helper: this is the ONE dual-verb route
 * (POST begin-grace + DELETE resume), so it stays HAND-WRITTEN with its own `gateAndParse` (which calls
 * `requireAdmin` on BOTH verbs). The AC1 route-coverage test (lib/admin/route-coverage.test.ts) allow-lists
 * this file to reference `requireAdmin` directly instead of the helper; every other admin route MUST use the
 * helper, or CI reddens. Both verbs re-verify admin server-side — the AC1 guarantee holds here too.
 *
 * Body (both verbs): `{ match_id }`. JSON reply, no i18n (Epic 5). CSRF deferred to Epic 7, uniformly.
 */

const BEGIN_STATUS_FOR: Record<Extract<BeginGraceResult, { ok: false }>['reason'], number> = {
  bad_match: 404,
  not_startable: 409, // the match is not `declared` (already awaiting_grace, or a played/terminal state)
  not_ready: 409, // a competitor seat is empty — not a determined matchup
  write_failed: 500,
};

const RESUME_STATUS_FOR: Record<Extract<ResumeMatchResult, { ok: false }>['reason'], number> = {
  bad_match: 404,
  not_awaiting: 409, // the match is not on the grace clock
  write_failed: 500,
};

// See app/api/admin/match/format/route.ts for why the range test is load-bearing (`Number.isInteger(1e21)`).
const isPositiveInt = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= Number.MAX_SAFE_INTEGER;

/** Both verbs take the same `{ match_id }` body. Returns null on anything malformed (→ 400, no write). */
function parseMatchId(raw: unknown): number | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { match_id } = raw as Record<string, unknown>;
  return isPositiveInt(match_id) ? match_id : null;
}

/** Shared gate + body plumbing for both verbs. Returns the admin steamid64 + match_id, or an error response. */
async function gateAndParse(
  request: NextRequest,
): Promise<{ ok: true; steamid64: string; matchId: number } | { ok: false; response: NextResponse }> {
  const admin = getAdminClient();
  const ssr = await createSupabaseServerClient();

  const gate = await requireAdmin(ssr, admin);
  if (!gate.ok) {
    return { ok: false, response: NextResponse.json({ error: 'forbidden' }, { status: gate.status }) };
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'invalid_json' }, { status: 400 }) };
  }
  const matchId = parseMatchId(raw);
  if (matchId === null) {
    return { ok: false, response: NextResponse.json({ error: 'invalid_body' }, { status: 400 }) };
  }

  return { ok: true, steamid64: gate.steamid64, matchId };
}

export async function POST(request: NextRequest) {
  try {
    const gate = await gateAndParse(request);
    if (!gate.ok) return gate.response;

    const admin = getAdminClient();
    const result = await beginMatchGrace(admin, { actingAdmin: gate.steamid64, matchId: gate.matchId });
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: BEGIN_STATUS_FOR[result.reason] });
    }
    return NextResponse.json({
      ok: true,
      match_id: result.matchId,
      awaiting_grace_since: result.awaitingGraceSince,
    });
  } catch (err) {
    console.error('[api/admin/match/grace POST] request failed:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const gate = await gateAndParse(request);
    if (!gate.ok) return gate.response;

    const admin = getAdminClient();
    const result = await resumeMatch(admin, { actingAdmin: gate.steamid64, matchId: gate.matchId });
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: RESUME_STATUS_FOR[result.reason] });
    }
    return NextResponse.json({ ok: true, match_id: result.matchId });
  } catch (err) {
    console.error('[api/admin/match/grace DELETE] request failed:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
