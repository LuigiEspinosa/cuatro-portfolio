import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { parseRegisterBody, recordManualUpload, type RegisterResult } from '@/lib/ingest';

// Service-role write + the per-request admin gate need Node APIs; never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/ingest/register — the admin manual-upload notify (Story 3.1, AC2/AC5).
 *
 * The demo bytes already went browser → R2 via the worker's presigned URL (bypassing Vercel); this
 * tiny `{ match_id, storage_key }` JSON body is the ONLY thing that touches the Next.js app. It is
 * `requireAdmin`-gated and records the `demo` acquisition row via the service role. Deliberately NOT
 * under `/api/admin/` (SOLUTION-DESIGN §6 L330) — `/api/ingest/register` — but still admin-gated. Thin
 * wrapper: all validation + the write live in `lib/ingest.ts`. Mirrors `app/api/admin/roster/route.ts`.
 */

const STATUS_FOR: Record<Extract<RegisterResult, { ok: false }>['reason'], number> = {
  write_failed: 500,
};

export async function POST(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const ssr = await createSupabaseServerClient();

    // Server-enforced admin gate. Non-admin → 403, no write.
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
    const body = parseRegisterBody(raw);
    if (!body) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    const result = await recordManualUpload(admin, {
      matchId: body.match_id,
      storageKey: body.storage_key,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: STATUS_FOR[result.reason] });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/ingest/register] request failed:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
