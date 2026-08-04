import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Lock the ceremony — the AD-15 admin command (Story 6.2, AC2/AC3/AC5).
 *
 * One admin command, a thin wrapper over migration 0024's `lock_ceremony` RPC. It is the moment the
 * tournament stops being live and becomes a fixed set of inputs: under ordered row locks the RPC captures
 * `stat_snapshot` + `stat_snapshot_row` (the AD-19 integer-form contract), transitions `ceremony.state`
 * `not_started -> locked` and `tournament.state -> 'ceremony'`, and writes one `start_ceremony` audit row —
 * all in ONE transaction (AD-6). From that commit on, `approve_match`, `rollback_match`,
 * `manual_resolve_match` and `curate_award_catalog` each refuse before any write.
 *
 * ⚠ THIS FILE IS UX, NOT TEETH — the same division of labour as lib/awards/curate.ts and lib/match/*.ts. The
 * lock ordering, the guards-before-any-write rule, the write-once snapshot grants, the deterministic
 * `content_sha256` and the one-audit-row-per-accepted-call invariant all live in the DATABASE (migration
 * 0024), because `service_role` holds the write grants and has BYPASSRLS — no route-level discipline can
 * bind it. All writes go through the INJECTED service-role `admin` client (AD-2).
 *
 * ⚠ NO NEW SQLSTATE IS MAPPED HERE. `lock_ceremony` RETURNS every refusal as `{ok:false, reason}` and raises
 * nothing of its own (0024's header). 0024's one new code, `IC908`, belongs to the `fair_seed` write-once
 * trigger on `tournament` and can only surface from an approve path — never from this call. Do NOT map
 * another lib's codes (P0001 is format.ts's; IC901–IC907 belong to walkover/approve/rollback/manual-score).
 *
 * ⚠ THIS COMMAND HAS A VIEWER-VISIBLE CONSEQUENCE, and it is the ONLY one Story 6.2 ships: writing
 * `tournament.state = 'ceremony'` unlocks the Ceremonia nav tab (`ceremonyUnlocked()`, lib/feed/read.ts) and
 * flips the live pill to `final` (lib/realtime/status.ts). `/ceremonia` remains the Story-5.7 placeholder
 * until Story 6.10. Nothing about the seed, the snapshot or the awards is published to anon (AD-22).
 */

/** The RPC's typed reply. */
interface RpcResult {
  ok: boolean;
  reason?: string;
  ceremony_state?: string;
  snapshot_id?: number;
  content_sha256?: string;
  seed_hex?: string;
  row_count?: number;
  eligible_count?: number;
}

export type LockCeremonyResult =
  | {
      ok: true;
      snapshotId: number;
      contentSha256: string;
      seedHex: string;
      rowCount: number;
      eligibleCount: number;
    }
  | {
      ok: false;
      reason:
        | 'no_tournament' // no such tournament
        | 'already_locked' // ceremony.state is past not_started — the snapshot is already captured
        | 'not_bracket_live' // the tournament is not in the one state a ceremony can start from
        | 'champion_undecided' // tournament.final_match_id is null — nobody has been crowned
        | 'seed_unavailable' // ⛔ AD-13's fail-closed point: the final's demo was never hashed, or there is none
        | 'seed_stale' // ⛔ the frozen seed does not match the CURRENT final's demo (a re-decided championship)
        | 'no_roster' // zero active roster entries — nobody to snapshot
        | 'empty_snapshot' // zero rows would be written; a header with no rows is not a commitment
        | 'write_failed';
    };

/** Every reason the RPC can RETURN. A reason outside this set is not trusted — the lib fails closed. */
const LOCK_REASONS = new Set([
  'no_tournament',
  'already_locked',
  'not_bracket_live',
  'champion_undecided',
  'seed_unavailable',
  'seed_stale',
  'no_roster',
  'empty_snapshot',
]);

/** Lock the ceremony for a tournament and capture its immutable snapshot. */
export async function lockCeremony(
  admin: SupabaseClient,
  params: { actingAdmin: string; tournamentId: number },
): Promise<LockCeremonyResult> {
  const { data, error } = await admin.rpc('lock_ceremony', {
    p_tournament_id: params.tournamentId,
    p_actor: params.actingAdmin,
  });

  if (error) {
    console.error('[lockCeremony] lock_ceremony RPC failed:', error.message);
    return { ok: false, reason: 'write_failed' };
  }

  const result = data as RpcResult | null;
  if (!result?.ok) {
    const reason = result?.reason;
    if (reason && LOCK_REASONS.has(reason)) {
      return { ok: false, reason: reason as Extract<LockCeremonyResult, { ok: false }>['reason'] };
    }
    return { ok: false, reason: 'write_failed' }; // fail closed on an unrecognised refusal
  }

  // Validate the ok-payload's shape before trusting it (the 4.1 review lesson, re-applied at 6.1). A lock
  // reported as successful with an `undefined` snapshot id or a missing content hash is exactly the class of
  // silent success the admin must never see — and here it would also mean the verification bundle 6.9 builds
  // has nothing to point at.
  if (
    typeof result.snapshot_id !== 'number' ||
    typeof result.row_count !== 'number' ||
    typeof result.eligible_count !== 'number' ||
    typeof result.content_sha256 !== 'string' ||
    typeof result.seed_hex !== 'string'
  ) {
    console.error('[lockCeremony] ok reply missing a usable field:', result);
    return { ok: false, reason: 'write_failed' };
  }

  return {
    ok: true,
    snapshotId: result.snapshot_id,
    contentSha256: result.content_sha256,
    seedHex: result.seed_hex,
    rowCount: result.row_count,
    eligibleCount: result.eligible_count,
  };
}
