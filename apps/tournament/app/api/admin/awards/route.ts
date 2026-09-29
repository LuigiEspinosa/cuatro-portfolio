import { type NextRequest } from 'next/server';
import { handleAdminCommand, isPositiveInt } from '@/lib/admin/command-route';
import { curateAwardCatalog, type CurateAwardCatalogResult } from '@/lib/awards/curate';

// Service-role writes + the per-request admin gate need Node APIs; never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/awards — curate the FR-24 award catalog (Story 6.1, AC1/AC2).
 *
 * The catalog is DECLARATIVE and replace-the-whole-thing: this route posts the ONE seed catalog
 * (`lib/awards/catalog.ts`) for the given tournament. Re-posting is a no-op on the rows and still writes exactly
 * one `curate_awards` audit row — idempotent by construction, not by a de-dup check (AC2).
 *
 * Thin definition over the shared `handleAdminCommand` envelope (Story 4.9) — the gate/body-parse/500 boundary
 * live there, and `lib/admin/route-coverage.test.ts` reddens CI for any admin route that does not use it. All
 * command logic lives in lib/awards/curate.ts (Vitest) + migration 0023 (pgTAP). `requireAdmin` is the
 * authorization gate; the RPC's service-role-only EXECUTE grant is the second lock; the DB's guards-before-any-
 * write ordering, closed-set CHECKs and audit row are the teeth.
 *
 * ⚠ THERE IS NO ADMIN CONSOLE UI. None exists in this repo (Epic 4 shipped routes, not pages) and no Epic-6 story
 * adds one — curation is driven over HTTP. Returns JSON: a machine surface, no i18n (AD-24 governs the VIEWER).
 * CSRF is deferred to Epic 7, uniformly across all cookie-authenticated admin POSTs.
 *
 * Body: `{ tournament_id }`. The catalog itself is NOT accepted from the body — it is the server-side constant.
 * That is deliberate: an award list posted by a client would be a second definition site of the catalog (AC1) and
 * would put award identity on the wire before any spin (AD-22 / AC4).
 */

// ⚠ The Extract<> typing is LOAD-BEARING: a reason with no status entry is a COMPILE error, so a new refusal can
// never silently fall through to an undefined status.
const STATUS_FOR: Record<Extract<CurateAwardCatalogResult, { ok: false }>['reason'], number> = {
  no_tournament: 404,
  catalog_frozen: 409, // the ceremony has started (or the event closed) — the catalog is sealed
  empty_catalog: 400,
  too_many_awards: 400,
  duplicate_name: 400,
  duplicate_priority: 400,
  invalid_award: 400,
  write_failed: 500,
};

interface AwardsBody {
  tournament_id: number;
}

/** Validate the body. Returns null on anything malformed (→ 400, no write). */
function parseBody(raw: unknown): AwardsBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { tournament_id } = raw as Record<string, unknown>;
  // The shared, RANGE-CAPPED validator: `Number.isInteger(1e21)` is TRUE, so a bare integer check would let an
  // out-of-bigint-range id bind and make PostgreSQL raise 22003 — an opaque 500 where a malformed id is a 400.
  if (!isPositiveInt(tournament_id)) return null;
  return { tournament_id };
}

export function POST(request: NextRequest) {
  return handleAdminCommand<AwardsBody, CurateAwardCatalogResult>(request, {
    parseBody,
    // Actor is ALWAYS the authenticated admin (never from the body) — AD-17.
    run: (admin, gate, body) =>
      curateAwardCatalog(admin, { actingAdmin: gate.steamid64, tournamentId: body.tournament_id }),
    statusFor: STATUS_FOR,
    ok: (r) => ({ ok: true, count: r.count, before_count: r.beforeCount }),
    logLabel: 'api/admin/awards',
  });
}
