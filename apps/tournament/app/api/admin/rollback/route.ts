import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { rollbackMatch, type RollbackMatchResult } from '@/lib/match/rollback';

// Service-role writes + the per-request admin gate need Node APIs; never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/rollback — the atomic rollback of an Approved match (Story 4.7, AC1/AC2/AC3).
 *
 * ⚠ THE PATH mirrors POST /api/admin/approve (DECISION H) — rollback is approve's inverse, so it sits at
 * `api/admin/`, symmetric with `approve`, NOT under `api/admin/match/`. Story 4.9's route list names
 * `rollback` as one of the audited command routes (epics.md:812).
 *
 * On a demo-derived `resolved` match, one tap reverts the dependent bracket advances transitively, then
 * unpublishes M to `pending` (score/winner cleared, stat rows back to `pending`, champion un-crowned if M was
 * the deciding row), writes one `rollback` audit row, and emits one `match.rolled_back` Broadcast — all in ONE
 * DB transaction (AD-6). The AD-8 flag REFUSES (never cascades) when a dependent downstream match stands on its
 * own state.
 *
 * Thin wrapper, exactly like POST /api/admin/approve — all logic lives in lib/match/rollback.ts (Vitest) +
 * migration 0018 (pgTAP). `requireAdmin` is the authorization gate; the RPC's service-role-only EXECUTE grant
 * is the second lock; the DB's whole-bracket lock, two-pass revert and AD-8 flag are the teeth.
 *
 * Body: `{ match_id }`. Returns JSON — a machine surface, no i18n (Epic 5 owns Spanish). CSRF is deferred to
 * Epic 7, uniformly.
 */

// ⚠ The Extract<> typing is LOAD-BEARING: a reason with no status entry is a COMPILE error, so a new refusal
// can never silently fall through to an undefined status.
const STATUS_FOR: Record<Extract<RollbackMatchResult, { ok: false }>['reason'], number> = {
  bad_match: 404,
  not_resolved: 409, // the match is not a demo-derived Approved result — nothing to roll back (also idempotency)
  downstream_active: 409, // ⭐ AD-8: a dependent advance stands on its own state — the `blocking` list says which to roll back first
  write_failed: 500,
};

interface RollbackBody {
  match_id: number;
}

// See app/api/admin/approve/route.ts for why the range test makes `Number.isInteger(1e21)` load-bearing.
const isPositiveInt = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= Number.MAX_SAFE_INTEGER;

/** Validate the body. Returns null on anything malformed (→ 400, no write). */
function parseBody(raw: unknown): RollbackBody | null {
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
    const result = await rollbackMatch(admin, {
      actingAdmin: gate.steamid64,
      matchId: body.match_id,
    });
    if (!result.ok) {
      // ⭐ The AD-8 flag returns the blocking list so the admin sees which downstream match to roll back first.
      if (result.reason === 'downstream_active') {
        return NextResponse.json(
          { error: 'downstream_active', blocking: result.blocking ?? [] },
          { status: STATUS_FOR.downstream_active },
        );
      }
      return NextResponse.json({ error: result.reason }, { status: STATUS_FOR[result.reason] });
    }

    return NextResponse.json({
      ok: true,
      stat_rows_unpublished: result.statRowsUnpublished,
      reverted: result.reverted,
      uncrowned: result.uncrowned,
    });
  } catch (err) {
    console.error('[api/admin/rollback] request failed:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
