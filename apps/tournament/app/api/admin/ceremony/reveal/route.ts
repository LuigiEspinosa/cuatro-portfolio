import { type NextRequest } from 'next/server';
import { handleAdminCommand, isPositiveInt } from '@/lib/admin/command-route';
import { revealSpin, type RevealSpinResult } from '@/lib/ceremony/reveal';

// Service-role writes + the per-request admin gate need Node APIs; never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/ceremony/reveal — reveal ONE spin of a running ceremony (Story 6.8b, AC5/AC6/AC8).
 *
 * The admin act that turns AD-22's reveal axis: migration 0028's `reveal_spin` stamps
 * `spin.revealed_at`, which flips that spin, its results, its winners and its award into the
 * viewer's reach; posts the `award_reveal` timeline_feed entry; writes one `reveal_spin` audit row;
 * and, on the ceremony's highest spin index, sets `state = 'complete'` + `completed_at` — all in one
 * transaction (AD-6). Re-posting the same index is a typed 409 `already_revealed` that writes
 * nothing; posting anything but the next index is a 409 `out_of_order`.
 *
 * Thin definition over the shared `handleAdminCommand` envelope (Story 4.9) — the gate/body-parse/500
 * boundary live there, and `lib/admin/route-coverage.test.ts` reddens CI for any admin route that does
 * not use it. All command logic lives in lib/ceremony/reveal.ts (Vitest) + migration 0028 (pgTAP).
 * `requireAdmin` is the authorization gate; the RPC's service-role-only EXECUTE grant is the second
 * lock; the DB's ordered locks, guards-before-any-write ordering, forward-only dense reveal order and
 * audit row are the teeth.
 *
 * ⚠ THERE IS NO ADMIN CONSOLE UI. None exists in this repo and no Epic-6 story adds one — the reveal
 * is driven over HTTP. Returns JSON: a machine surface, no i18n (AD-24 governs the VIEWER). CSRF is
 * deferred to Epic 7, uniformly across all cookie-authenticated admin POSTs.
 *
 * ⚠ THE RESPONSE NAMES THE REVEALED AWARD COUNT AND WINNER COUNT BUT NO IDENTITY — and it does not
 * need to guard that, because by the time it answers the identity is public anyway: the whole point
 * of the call is that those rows became viewer-readable. What it deliberately does NOT carry is
 * anything about an UNREVEALED spin.
 *
 * Body: `{ ceremony_id, spin_index }` — both required and both range-capped positive integers, or 400.
 * Any other key is IGNORED rather than rejected: `parseBody` destructures the two fields and returns a
 * fresh object, so nothing else can reach the RPC. ⛔ The actor is always the verified session
 * (AD-17) and is never read from the body — posting `actor` or `p_actor` changes nothing.
 */

// ⚠ The Extract<> typing is LOAD-BEARING: a reason with no status entry is a COMPILE error, so a new
// refusal can never silently fall through to an undefined status.
const STATUS_FOR: Record<Extract<RevealSpinResult, { ok: false }>['reason'], number> = {
  no_ceremony: 404,
  ceremony_not_spinning: 409, // the run is not persisted yet, or the ceremony is already complete
  bundle_not_published: 409, // ⛔ Story 6.9a: publish the commitment BEFORE the first reveal (AD-22)
  no_such_spin: 404,
  already_revealed: 409, // ⛔ a double-tap is a no-op to the DATA and a refusal to the caller — never a second audit row
  out_of_order: 409, // ⛔ the published spin order IS the reveal order (UX-DR32/42)
  unknown_actor: 409, // the verified session's steamid64 is not a player row
  write_failed: 500, // includes IC911 — a reveal order already corrupted outside this RPC
};

interface RevealBody {
  ceremony_id: number;
  spin_index: number;
}

/** Validate the body. Returns null on anything malformed (→ 400, no write). */
function parseBody(raw: unknown): RevealBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { ceremony_id, spin_index } = raw as Record<string, unknown>;
  // The shared, RANGE-CAPPED validator: `Number.isInteger(1e21)` is TRUE, so a bare integer check would
  // let an out-of-bigint-range id bind and make PostgreSQL raise 22003 — an opaque 500 where a malformed
  // id is a 400. `spin_index` is 1-based and dense (0027's spin_index_not_dense guard), so 0 and negatives
  // are malformed rather than merely absent.
  if (!isPositiveInt(ceremony_id)) return null;
  if (!isPositiveInt(spin_index)) return null;
  return { ceremony_id, spin_index };
}

export function POST(request: NextRequest) {
  return handleAdminCommand<RevealBody, RevealSpinResult>(request, {
    parseBody,
    // Actor is ALWAYS the authenticated admin (never from the body) — AD-17.
    run: (admin, gate, body) =>
      revealSpin(admin, {
        actingAdmin: gate.steamid64,
        ceremonyId: body.ceremony_id,
        spinIndex: body.spin_index,
      }),
    statusFor: STATUS_FOR,
    // ⭐ SURFACE THE REFUSAL'S CONTEXT (code-review fix, 2026-08-08). The default `{error: reason}` told the
    // admin only "wrong index", while 0028 promises at the site that the expected index travels in the
    // refusal "so the admin (and 6.10's UI) learns what to press instead of guessing". There is no admin
    // console, so without this the operator has no published surface naming the next index. Same precedent
    // as rollback's `downstream_active` carrying `blocking` (command-route.ts:61-63). Each field is emitted
    // only when the lib actually carried it, so every other refusal stays exactly `{error: reason}`.
    errorBody: (r) => ({
      error: r.reason,
      ...(r.expectedSpinIndex !== undefined ? { expected_spin_index: r.expectedSpinIndex } : {}),
      ...(r.revealedAt !== undefined ? { revealed_at: r.revealedAt } : {}),
    }),
    ok: (r) => ({
      ok: true,
      spin_id: r.spinId,
      spin_index: r.spinIndex,
      kind: r.kind,
      revealed_at: r.revealedAt,
      revealed_spins: r.revealedSpins,
      total_spins: r.totalSpins,
      awards: r.awards,
      winners: r.winners,
      ceremony_state: r.ceremonyState,
      ceremony_complete: r.ceremonyComplete,
    }),
    logLabel: 'api/admin/ceremony/reveal',
  });
}
