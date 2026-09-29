import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/user-guard';
import { resolveOpenTournament, enrollSelf } from '@/lib/roster';

// Service-role writes + the per-request session read need Node APIs; never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/roster/enroll — a player enrolls THEMSELVES in the open tournament (Story 2.5, AC5/AC1).
 *
 * NOT under app/api/admin/: this is authenticated-gated (`requireUser`), not admin-gated. The
 * enrolled SteamID64 is read from the VERIFIED session, NEVER from the request body — a player can
 * only ever enroll themselves (there is no body). Enrollment succeeds only while a tournament is
 * `registration_open` (`resolveOpenTournament` is the state gate → 409 if none open). No audit row —
 * self-enroll is a player action, not an admin action (AC7).
 *
 * Thin wrapper: all logic lives in `lib/roster.ts` + `lib/auth/user-guard.ts` (Vitest covers those).
 */

// Map each refusal reason (from resolveOpenTournament + enrollSelf) to an HTTP status.
const STATUS_FOR: Record<
  | 'registration_not_open'
  | 'ambiguous_tournament'
  | 'read_failed'
  | 'no_such_player'
  | 'locked'
  | 'write_failed',
  number
> = {
  registration_not_open: 409,
  ambiguous_tournament: 409,
  read_failed: 500,
  no_such_player: 404,
  // The D3 roster-lock trigger (migration 0011) refused the write: the bracket went live between
  // `resolveOpenTournament` and the insert. A conflict, not a server fault — same 409 the admin roster
  // route already returns for the un-raced case.
  locked: 409,
  write_failed: 500,
};

export async function POST() {
  // One controlled fail-closed boundary around the whole handler: any throw (client construction,
  // the gate's transport call, a lib infra failure) lands here as a JSON 500 — never Next's HTML
  // error page. The early 401/409 returns exit before the catch.
  try {
    const admin = getAdminClient();
    const ssr = await createSupabaseServerClient();

    // AC5: authenticated gate. No/invalid session → 401, no write. The enrolled id is the caller's
    // OWN verified steamid64 (gate.steamid64) — this route reads no body.
    const gate = await requireUser(ssr);
    if (!gate.ok) {
      return NextResponse.json({ error: 'unauthorized' }, { status: gate.status });
    }

    // AC1: enroll only while open. resolveOpenTournament returns the single registration_open
    // tournament, or a typed refusal (none open / ambiguous / read error).
    const open = await resolveOpenTournament(admin);
    if (!open.ok) {
      return NextResponse.json({ error: open.reason }, { status: STATUS_FOR[open.reason] });
    }

    const result = await enrollSelf(admin, { steamid64: gate.steamid64, tournamentId: open.id });
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: STATUS_FOR[result.reason] });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/roster/enroll] request failed:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
