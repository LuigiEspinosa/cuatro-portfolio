import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AWARD_CATALOG, toCuratePayload, type CurateAwardPayload, type SeedAward } from '@/lib/awards/catalog';

/**
 * Curate the award catalog — the FR-24 admin command (Story 6.1, AC1/AC2).
 *
 * One admin command, a thin wrapper over migration 0023's `curate_award_catalog` RPC. Semantics are DECLARATIVE
 * and REPLACE-THE-WHOLE-CATALOG: the payload IS the catalog (upsert on `(tournament_id, name)` + delete-missing),
 * the same shape as re-parse (SPINE:232). That is what makes AC2's idempotency true BY CONSTRUCTION — re-sending
 * the same 12 awards produces the same 12 rows and no duplicate, because the end state is a pure function of the
 * payload rather than the result of a de-dup check that could drift.
 *
 * ⚠ THIS FILE IS UX, NOT TEETH — the same division of labour as lib/match/*.ts. The closed-set CHECKs, the
 * class↔key coherence rule, the DEFERRABLE priority UNIQUE, the guards-before-any-write/lock ordering and the
 * one-audit-row-per-accepted-call invariant all live in the DATABASE (migration 0023), because `service_role`
 * holds INSERT/UPDATE/DELETE on `award` and has BYPASSRLS — no route-level discipline can bind it. All writes go
 * through the INJECTED service-role `admin` client (AD-2).
 *
 * ⚠ NO NEW SQLSTATE. `curate_award_catalog` RETURNS every refusal as `{ok:false, reason}` and raises nothing of
 * its own (0023's header). The only errors reachable are the table's own CHECKs (23514) and the deferred priority
 * UNIQUE (23505, at COMMIT) — both BACKSTOPS the RPC's guards keep it from tripping, so either arriving here is a
 * genuine server fault and correctly fails closed to `write_failed`. Do NOT map another lib's codes (P0001 is
 * format.ts's; IC901–IC907 belong to walkover/approve/rollback/manual-score).
 */

/** The RPC's typed reply. */
interface RpcResult {
  ok: boolean;
  reason?: string;
  count?: number;
  before_count?: number;
}

export type CurateAwardCatalogResult =
  | { ok: true; count: number; beforeCount: number }
  | {
      ok: false;
      reason:
        | 'no_tournament' // no such tournament
        | 'catalog_frozen' // tournament.state is ceremony/closed — the honest partial of AD-15 until 6.2
        | 'empty_catalog' // null / not an array / zero awards — never a legitimate curation
        | 'too_many_awards' // > 64
        | 'duplicate_name' // two awards share a name WITHIN the payload
        | 'duplicate_priority' // two awards share a priority WITHIN the payload
        | 'invalid_award' // bad bucket/class/key/direction/floor/blank name/class↔key mismatch/priority
        | 'write_failed';
    };

/** Every reason the RPC can RETURN. A reason outside this set is not trusted — the lib fails closed. */
const CURATE_REASONS = new Set([
  'no_tournament',
  'catalog_frozen',
  'empty_catalog',
  'too_many_awards',
  'duplicate_name',
  'duplicate_priority',
  'invalid_award',
]);

/**
 * Write the award catalog for a tournament.
 *
 * `awards` defaults to the ONE seed catalog (`lib/awards/catalog.ts`). A caller may pass an explicit payload —
 * that is the re-curation path (a renamed award, a swapped priority pair) — but it must still come from a
 * `SeedAward[]` so the projection stays the single definition site of the RPC's argument shape.
 */
export async function curateAwardCatalog(
  admin: SupabaseClient,
  params: { actingAdmin: string; tournamentId: number; awards?: readonly SeedAward[] },
): Promise<CurateAwardCatalogResult> {
  const payload: CurateAwardPayload[] = toCuratePayload(params.awards ?? AWARD_CATALOG);

  const { data, error } = await admin.rpc('curate_award_catalog', {
    p_tournament_id: params.tournamentId,
    p_actor: params.actingAdmin,
    p_awards: payload,
  });

  if (error) {
    console.error('[curateAwardCatalog] curate_award_catalog RPC failed:', error.message);
    return { ok: false, reason: 'write_failed' };
  }

  const result = data as RpcResult | null;
  if (!result?.ok) {
    const reason = result?.reason;
    if (reason && CURATE_REASONS.has(reason)) {
      return { ok: false, reason: reason as Extract<CurateAwardCatalogResult, { ok: false }>['reason'] };
    }
    return { ok: false, reason: 'write_failed' }; // fail closed on an unrecognised refusal
  }

  // Validate the ok-payload's shape before trusting it (the 4.1 review lesson): a missing `count` reported as a
  // successful curation of `undefined` awards is exactly the class of silent-success the admin must never see.
  if (typeof result.count !== 'number' || typeof result.before_count !== 'number') {
    console.error('[curateAwardCatalog] ok reply missing a usable field:', result);
    return { ok: false, reason: 'write_failed' };
  }

  return { ok: true, count: result.count, beforeCount: result.before_count };
}
