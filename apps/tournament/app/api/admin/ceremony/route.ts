import { type NextRequest } from 'next/server';
import { handleAdminCommand, isPositiveInt } from '@/lib/admin/command-route';
import { lockCeremony, type LockCeremonyResult } from '@/lib/ceremony/lock';

// Service-role writes + the per-request admin gate need Node APIs; never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/ceremony — lock the ceremony and capture the immutable snapshot (Story 6.2, AC2/AC3).
 *
 * The single admin act that freezes the ceremony's inputs: `ceremony.state` `not_started -> locked`, the
 * AD-19 `stat_snapshot`/`stat_snapshot_row` capture, `tournament.state -> 'ceremony'`, and one
 * `start_ceremony` audit row — all in one transaction (AD-6). Re-posting is a typed 409 `already_locked`
 * that writes nothing; it never captures a second snapshot over the first.
 *
 * Thin definition over the shared `handleAdminCommand` envelope (Story 4.9) — the gate/body-parse/500
 * boundary live there, and `lib/admin/route-coverage.test.ts` reddens CI for any admin route that does not
 * use it. All command logic lives in lib/ceremony/lock.ts (Vitest) + migration 0024 (pgTAP). `requireAdmin`
 * is the authorization gate; the RPC's service-role-only EXECUTE grant is the second lock; the DB's ordered
 * locks, guards-before-any-write ordering, write-once grants and audit row are the teeth.
 *
 * ⚠ THERE IS NO ADMIN CONSOLE UI. None exists in this repo and no Epic-6 story adds one — the lock is driven
 * over HTTP. Returns JSON: a machine surface, no i18n (AD-24 governs the VIEWER). CSRF is deferred to Epic 7,
 * uniformly across all cookie-authenticated admin POSTs.
 *
 * ⚠ THE RESPONSE CARRIES `seed_hex` AND `content_sha256` — and that is NOT an AD-22 leak: this route is
 * behind `requireAdmin`, and the values reach an authenticated admin only. Publishing the seed and the
 * commitment to the AUDIENCE is Story 6.8's, through a different surface. Nothing here grants anon anything.
 *
 * Body: `{ tournament_id }`. Nothing else is accepted — the snapshot's contents are derived server-side from
 * the locked rows, never posted.
 */

// ⚠ The Extract<> typing is LOAD-BEARING: a reason with no status entry is a COMPILE error, so a new refusal
// can never silently fall through to an undefined status.
const STATUS_FOR: Record<Extract<LockCeremonyResult, { ok: false }>['reason'], number> = {
  no_tournament: 404,
  already_locked: 409, // the snapshot is already captured — re-locking is a no-op, not an error to retry
  not_bracket_live: 409,
  champion_undecided: 409, // nobody crowned yet: advance/approve the final first
  seed_unavailable: 409, // ⛔ AD-13 fails closed here: the final's demo carries no hash (or there is no demo)
  seed_stale: 409, // ⛔ the frozen seed names a demo that is no longer championship-deciding — refuse, never publish it
  no_roster: 409,
  empty_snapshot: 409,
  write_failed: 500,
};

interface CeremonyBody {
  tournament_id: number;
}

/** Validate the body. Returns null on anything malformed (→ 400, no write). */
function parseBody(raw: unknown): CeremonyBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { tournament_id } = raw as Record<string, unknown>;
  // The shared, RANGE-CAPPED validator: `Number.isInteger(1e21)` is TRUE, so a bare integer check would let an
  // out-of-bigint-range id bind and make PostgreSQL raise 22003 — an opaque 500 where a malformed id is a 400.
  if (!isPositiveInt(tournament_id)) return null;
  return { tournament_id };
}

export function POST(request: NextRequest) {
  return handleAdminCommand<CeremonyBody, LockCeremonyResult>(request, {
    parseBody,
    // Actor is ALWAYS the authenticated admin (never from the body) — AD-17.
    run: (admin, gate, body) =>
      lockCeremony(admin, { actingAdmin: gate.steamid64, tournamentId: body.tournament_id }),
    statusFor: STATUS_FOR,
    ok: (r) => ({
      ok: true,
      snapshot_id: r.snapshotId,
      content_sha256: r.contentSha256,
      seed_hex: r.seedHex,
      row_count: r.rowCount,
      eligible_count: r.eligibleCount,
    }),
    logLabel: 'api/admin/ceremony',
  });
}
