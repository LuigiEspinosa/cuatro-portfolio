import { type NextRequest } from 'next/server';
import { handleAdminCommand, isPositiveInt } from '@/lib/admin/command-route';
import { publishBundle, type PublishBundleResult } from '@/lib/ceremony/bundle';

// Service-role writes + the per-request admin gate need Node APIs; never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/ceremony/bundle — publish the verification bundle and its commitment
 * (Story 6.9a, AC4).
 *
 * The admin act that gives a ceremony something to be verified against: migration 0029's
 * `publish_bundle` stores the RFC-8785 canonical bytes, re-derives their SHA-256 and refuses
 * `bundle_mismatch` if it disagrees with the caller's, writes `ceremony.algorithm_version` and one
 * `publish_bundle` audit row — all in one transaction (AD-6). ⛔ It must run BEFORE the first reveal:
 * `reveal_spin` refuses `bundle_not_published` until it has, and this refuses `reveal_in_progress`
 * once it is too late.
 *
 * Thin definition over the shared `handleAdminCommand` envelope (Story 4.9) — the gate/body-parse/500
 * boundary live there, and `lib/admin/route-coverage.test.ts` reddens for any admin route that does
 * not use it. All command logic lives in lib/ceremony/bundle.ts (Vitest) + migration 0029 (pgTAP).
 *
 * ⚠ THERE IS NO ADMIN CONSOLE UI. None exists in this repo and no Epic-6 story adds one — publication
 * is driven over HTTP, and in Story 6.9a the only caller is the QA harness. Returns JSON: a machine
 * surface, no i18n (AD-24 governs the VIEWER). CSRF is deferred to Epic 7, uniformly across all
 * cookie-authenticated admin POSTs.
 *
 * ⚠ THE BODY CARRIES THE BYTES **AND** THE HASH, DELIBERATELY. The RPC believes neither — it hashes
 * what it was handed and compares. Sending only the bytes would make a producer's hash bug
 * undetectable rather than refused; sending only the hash would publish a commitment to nothing.
 *
 * ⚠ `payload` IS SENT AS A STRING, NOT AS JSON. The canonical bytes are the artifact; re-serialising
 * a parsed object would reorder keys and change every byte of the hash. ⛔ Do not "improve" this
 * route by accepting an object.
 *
 * Body: `{ ceremony_id, payload, bundle_sha256 }` — a range-capped positive integer, a non-empty
 * string and a 64-char lowercase hex string, or 400. Any other key is IGNORED rather than rejected:
 * `parseBody` destructures the three fields and returns a fresh object, so nothing else can reach the
 * RPC. ⛔ The actor is always the verified session (AD-17) and is never read from the body.
 */

// ⚠ The Extract<> typing is LOAD-BEARING: a reason with no status entry is a COMPILE error, so a new
// refusal can never silently fall through to an undefined status.
// ⚠ THESE NUMERIC VALUES ARE UNTESTED, AND SAYING SO IS THE HONEST FORM (deferred-work.md:279, Epic
// 7's). `vitest.config.ts:17` collects only `lib/**/*.test.ts`, so nothing under `app/` runs — the
// same reason every other route's map is untested. ⛔ Do not claim coverage this file does not have.
const STATUS_FOR: Record<Extract<PublishBundleResult, { ok: false }>['reason'], number> = {
  no_ceremony: 404,
  ceremony_not_spinning: 409, // the run is not persisted yet, or the ceremony is already complete
  already_published: 409, // ⛔ one bundle per ceremony — the commitment is singular
  reveal_in_progress: 409, // ⛔ an outcome is already public; these bytes would commit to nothing
  snapshot_missing: 409,
  seed_missing: 409,
  no_spins: 409,
  bundle_mismatch: 422, // the caller's own hash does not match the caller's own bytes
  non_ascii_payload: 422, // SOLUTION-DESIGN §9.5 — fix the source string, never escape it in
  payload_shape: 422, // the document is not the seven specced keys, or disagrees with the DB
  seed_mismatch: 409, // the document names a seed this ceremony did not freeze
  algo_version_mismatch: 409, // this database does not implement the algorithm the document names
  award_revealed_twice: 409, // one trophy in two spins of one ceremony (deferred-work.md:362)
  unknown_actor: 409, // the verified session's steamid64 is not a player row
  write_failed: 500, // includes IC912 — an attempt to edit an already-published commitment
};

interface BundleBody {
  ceremony_id: number;
  payload: string;
  bundle_sha256: string;
}

/**
 * Validate the body. Returns null on anything malformed (→ 400, no write).
 *
 * ⚠ The hex shape is checked HERE as well as in the database, and that is not duplication for its own
 * sake: a malformed hash is a malformed REQUEST (400), while a well-formed hash that does not match
 * the bytes is a business refusal (422 `bundle_mismatch`). Collapsing them would report a client typo
 * as a producer bug.
 */
function parseBody(raw: unknown): BundleBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { ceremony_id, payload, bundle_sha256 } = raw as Record<string, unknown>;
  if (!isPositiveInt(ceremony_id)) return null;
  if (typeof payload !== 'string' || payload.length === 0) return null;
  if (typeof bundle_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(bundle_sha256)) return null;
  return { ceremony_id, payload, bundle_sha256 };
}

export function POST(request: NextRequest) {
  return handleAdminCommand<BundleBody, PublishBundleResult>(request, {
    parseBody,
    // Actor is ALWAYS the authenticated admin (never from the body) — AD-17.
    run: (admin, gate, body) =>
      publishBundle(admin, {
        actingAdmin: gate.steamid64,
        ceremonyId: body.ceremony_id,
        payload: body.payload,
        bundleSha256: body.bundle_sha256,
      }),
    statusFor: STATUS_FOR,
    // ⭐ SURFACE THE REFUSAL'S CONTEXT — the precedent rollback's `blocking` and reveal's
    // `expected_spin_index` set (command-route.ts:61-63). A bare `{error:'bundle_mismatch'}` tells an
    // operator only "wrong hash"; the two hashes side by side identify which producer stage drifted.
    // Each field is emitted only when the lib actually carried it.
    errorBody: (r) => ({
      error: r.reason,
      ...(r.computedSha256 !== undefined ? { computed_sha256: r.computedSha256 } : {}),
      ...(r.claimedSha256 !== undefined ? { claimed_sha256: r.claimedSha256 } : {}),
      ...(r.detail !== undefined ? { detail: r.detail } : {}),
    }),
    ok: (r) => ({
      ok: true,
      ceremony_id: r.ceremonyId,
      bundle_id: r.bundleId,
      bundle_sha256: r.bundleSha256,
      algorithm_version: r.algorithmVersion,
      payload_bytes: r.payloadBytes,
      spins: r.spins,
      awards: r.awards,
      players: r.players,
      published_at: r.publishedAt,
    }),
    logLabel: 'api/admin/ceremony/bundle',
  });
}
