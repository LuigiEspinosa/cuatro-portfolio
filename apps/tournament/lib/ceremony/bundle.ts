import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Publish the verification bundle — the AD-22 commitment (Story 6.9a, AC4).
 *
 * One admin command, a thin wrapper over migration 0029's `publish_bundle` RPC. It is the moment the
 * ceremony acquires something to be verified against: the RPC stores the canonical bytes, stores the
 * SHA-256 it RE-DERIVES from those bytes, writes `ceremony.algorithm_version` (a shell since
 * `0024:200`) and one `publish_bundle` audit row — all in one transaction (AD-6).
 *
 * ⛔ THE ORDER IS THE WHOLE POINT: this must happen BEFORE the first reveal. `reveal_spin` refuses
 * `bundle_not_published` until it has, and `publish_bundle` refuses `reveal_in_progress` after it is
 * too late. The two guards are the same rule read from both ends, because a commitment chosen once an
 * outcome is known commits to nothing.
 *
 * ⚠ THIS FILE IS UX, NOT TEETH — the same division of labour as lib/ceremony/reveal.ts and
 * lib/ceremony/lock.ts. The lock ordering, the guards-before-any-write rule, the re-derived hash, the
 * ASCII restriction, the shape checks against the database's own counts and the one-audit-row
 * invariant all live in the DATABASE (migration 0029), because `service_role` holds the write grants
 * and has BYPASSRLS — no route-level discipline can bind it. All writes go through the INJECTED
 * service-role `admin` client (AD-2).
 *
 * ⚠ THE CALLER SUPPLIES BOTH THE BYTES AND THE HASH, AND THE RPC BELIEVES NEITHER. That is not
 * redundancy: `bundle_mismatch` is the refusal that fires when a producer's own hash does not match
 * its own bytes, which is the one bug that would publish a commitment binding nothing. ⛔ Do not
 * "simplify" the API by dropping `bundleSha256` and letting the database compute it alone — the
 * mismatch would then be undetectable rather than refused.
 *
 * ⚠ NO NEW SQLSTATE IS MAPPED HERE. `publish_bundle` RETURNS every business refusal as
 * `{ok:false, reason}`. Migration 0029's one raised code, `IC912`, is genuine CORRUPTION — an attempt
 * to edit a published commitment — and it is deliberately NOT translated into a friendly reason: it
 * arrives as a transport `error` and falls into `write_failed`, which is a 500, which is correct for
 * "somebody tried to rewrite bytes viewers have already hashed".
 *
 * ⚠ THIS COMMAND HAS NO VIEWER-VISIBLE UI IN STORY 6.9a. The commitment becomes readable the instant
 * it commits — through `verification_bundle`'s column-scoped grant and `verification_bundle_read` —
 * but nothing in a browser reads either until Story 6.9b ships `Verificar la ceremonia`. That gap is
 * recorded deliberately in 6.9a's Completion Notes; it is not an oversight.
 */

/** The RPC's typed reply. */
interface RpcResult {
  ok: boolean;
  reason?: string;
  ceremony_id?: number;
  bundle_id?: number;
  bundle_sha256?: string;
  algorithm_version?: string;
  payload_bytes?: number;
  spins?: number;
  awards?: number;
  players?: number;
  published_at?: string;
  /** `already_published` only. */
  published?: string;
  /** `bundle_mismatch` only. */
  computed_sha256?: string;
  claimed_sha256?: string;
  /** `payload_shape` only — which check failed. */
  detail?: string;
}

/**
 * Every reason the RPC can RETURN — and the SINGLE SOURCE of the refusal union below.
 * A reason outside this set is not trusted; the lib fails closed to `write_failed`.
 *
 * ⭐⭐ THE `as const` AND THE DERIVED TYPE ARE LOAD-BEARING, and the shape is copied from
 * lib/ceremony/reveal.ts:81 RATHER THAN FROM lib/ceremony/lock.ts DELIBERATELY. `6-8b:913` found the
 * older cast-based form — `new Set([...])` inferring `Set<string>`, plus a bare `as` on the reason —
 * had "defeated the exhaustiveness the route calls load-bearing": a seventh SQL reason was forced INTO
 * the set by the cross-check tests but nothing forced it into the union, so `STATUS_FOR` had no entry
 * and `command-route.ts:106`'s `?? 500` backstop shipped a typed business refusal as an opaque 500.
 * Deriving the union FROM the set makes that impossible: add an entry here and `STATUS_FOR` stops
 * compiling until it is mapped. ⚠ This is the SIXTH such map in the tree and the first written this
 * way from the start.
 * ⛔ Do not add an inline `'quoted_snake_case'` token to a comment in this block — `libReasons()` in
 * bundle.test.ts strips comment LINES, but a trailing comment on a value line would be read as data.
 */
const PUBLISH_REASONS = new Set([
  'no_ceremony',
  'ceremony_not_spinning',
  'already_published',
  'reveal_in_progress',
  'snapshot_missing',
  'seed_missing',
  'no_spins',
  'bundle_mismatch',
  'non_ascii_payload',
  'payload_shape',
  'seed_mismatch',
  'algo_version_mismatch',
  'award_revealed_twice',
  'unknown_actor',
] as const);

/**
 * The refusals the SQL returns (derived, never hand-copied), plus the lib's own fail-closed reason.
 * - no_ceremony — no such ceremony, or it was deleted between the peek and the lock
 * - ceremony_not_spinning — the run is not persisted yet, or the ceremony is already complete
 * - already_published — one bundle per ceremony; the commitment is singular or it is not a commitment
 * - reveal_in_progress — ⛔ too late: an outcome is already public, so these bytes commit to nothing
 * - snapshot_missing / seed_missing — the ceremony was never locked, so there are no frozen inputs
 * - no_spins — the run was never persisted, so there is nothing to describe
 * - bundle_mismatch — ⛔ the claimed hash is not the hash of the supplied bytes (B9: validated, not
 *   trusted). Carries `computed_sha256` and `claimed_sha256` so the producer bug is diagnosable.
 * - non_ascii_payload — the bundle is ASCII-restricted (SOLUTION-DESIGN §9.5); fix the source string
 * - payload_shape — the document is not the seven specced keys, or its counts disagree with the
 *   database's own spins/awards/snapshot rows. Carries `detail` naming which check failed.
 * - seed_mismatch — the document names a seed the ceremony did not freeze
 * - algo_version_mismatch — the document names an algorithm this database does not implement
 * - award_revealed_twice — one trophy decided in two spins of one ceremony (deferred-work.md:362)
 * - unknown_actor — the acting steamid64 is not a player; refused before any write (AD-17)
 * - write_failed — the lib's OWN reason: a transport error, a null reply, an unrecognised refusal or a
 *   malformed ok payload. Never returned by the SQL, and bundle.test.ts asserts that in both directions.
 */
type PublishRefusalReason =
  | (typeof PUBLISH_REASONS extends ReadonlySet<infer R> ? R : never)
  | 'write_failed';

/**
 * Membership test that NARROWS. The widening cast is on the SET, not on the value — safe, because
 * `ReadonlySet<string>.has` only reads — so the reason that flows out is narrowed by real membership
 * rather than by an unchecked assertion on an untrusted string.
 */
const isRefusalReason = (v: string): v is Exclude<PublishRefusalReason, 'write_failed'> =>
  (PUBLISH_REASONS as ReadonlySet<string>).has(v);

export type PublishBundleResult =
  | {
      ok: true;
      ceremonyId: number;
      bundleId: number;
      bundleSha256: string;
      algorithmVersion: string;
      payloadBytes: number;
      spins: number;
      awards: number;
      players: number;
      publishedAt: string;
    }
  | {
      ok: false;
      reason: PublishRefusalReason;
      /** `bundle_mismatch` only — what the database derived from the bytes it was handed. */
      computedSha256?: string;
      /** `bundle_mismatch` only — what the caller claimed. */
      claimedSha256?: string;
      /** `payload_shape` only — which of the document's checks failed. */
      detail?: string;
    };

/** Publish one ceremony's canonical bundle and its commitment. */
export async function publishBundle(
  admin: SupabaseClient,
  params: { actingAdmin: string; ceremonyId: number; payload: string; bundleSha256: string },
): Promise<PublishBundleResult> {
  const { data, error } = await admin.rpc('publish_bundle', {
    p_ceremony_id: params.ceremonyId,
    p_payload: params.payload,
    p_bundle_sha256: params.bundleSha256,
    p_actor: params.actingAdmin,
  });

  if (error) {
    console.error('[publishBundle] publish_bundle RPC failed:', error.message);
    return { ok: false, reason: 'write_failed' };
  }

  const result = data as RpcResult | null;
  if (!result?.ok) {
    const reason = result?.reason;
    if (reason && isRefusalReason(reason)) {
      // ⭐ CARRY THE REFUSAL'S CONTEXT, the same precedent reveal.ts:154-160 sets for
      // `expected_spin_index`. A `bundle_mismatch` with no numbers tells an operator only "wrong
      // hash", when the two hashes side by side are what identifies WHICH producer stage drifted; a
      // `payload_shape` with no `detail` names none of the eight distinct checks behind that reason.
      // Each field is copied ONLY when the RPC actually sent it, so every other refusal stays exactly
      // `{ok:false, reason}`.
      const refusal: Extract<PublishBundleResult, { ok: false }> = { ok: false, reason };
      if (typeof result.computed_sha256 === 'string') refusal.computedSha256 = result.computed_sha256;
      if (typeof result.claimed_sha256 === 'string') refusal.claimedSha256 = result.claimed_sha256;
      if (typeof result.detail === 'string') refusal.detail = result.detail;
      return refusal;
    }
    return { ok: false, reason: 'write_failed' }; // fail closed on an unrecognised refusal
  }

  // Validate the ok-payload's shape before trusting it (the 4.1 review lesson, re-applied at 6.1, 6.2
  // and 6.8b). ⛔ HERE IT MATTERS MORE THAN ANYWHERE ELSE IT HAS BEEN APPLIED: `bundleSha256` is the
  // value a viewer will hash against for the life of the tournament, so a "successful" publish that
  // returned an `undefined` hash would hand the caller nothing to record and no way to know it.
  if (
    typeof result.ceremony_id !== 'number' ||
    typeof result.bundle_id !== 'number' ||
    typeof result.bundle_sha256 !== 'string' ||
    typeof result.algorithm_version !== 'string' ||
    typeof result.payload_bytes !== 'number' ||
    typeof result.spins !== 'number' ||
    typeof result.awards !== 'number' ||
    typeof result.players !== 'number' ||
    typeof result.published_at !== 'string'
  ) {
    console.error('[publishBundle] ok reply missing a usable field:', result);
    return { ok: false, reason: 'write_failed' };
  }

  return {
    ok: true,
    ceremonyId: result.ceremony_id,
    bundleId: result.bundle_id,
    bundleSha256: result.bundle_sha256,
    algorithmVersion: result.algorithm_version,
    payloadBytes: result.payload_bytes,
    spins: result.spins,
    awards: result.awards,
    players: result.players,
    publishedAt: result.published_at,
  };
}
