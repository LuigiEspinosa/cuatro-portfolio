import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The atomic rollback of an Approved match — the rollback side of FR-14 / AD-8 (Story 4.7).
 *
 * One admin command, a thin wrapper over migration-0018's `rollback_match` RPC: on a demo-derived `resolved`
 * (Approved) match it reverts the dependent bracket advances transitively, then unpublishes M back to
 * `pending` — clears the score/winner/state, flips its stat rows back to `pending`, un-crowns the champion if
 * M was the deciding row — writes one `rollback` audit row, and emits exactly one `match.rolled_back`
 * Broadcast, all in ONE DB transaction (AD-6 inverted). "Unpublishing a result never leaves the bracket in an
 * inconsistent state." The demo STAYS bound, so the corrected truth is re-approvable.
 *
 * ⚠ THIS FILE IS UX, NOT TEETH — same division of labour as lib/match/approve.ts + lib/match/walkover.ts. The
 * whole-bracket lock, the two-pass read-only-then-apply revert, the ⭐ AD-8 downstream flag, the conditional
 * un-seat, and the resolved->pending un-publish all live in the DATABASE (migration 0018), because
 * `service_role` holds UPDATE on `match` and has BYPASSRLS — no route-level discipline can bind it. BYPASSRLS
 * skips policies; it never skips triggers. All writes go through the INJECTED service-role `admin` client (AD-2).
 *
 * ⚠ DISTINCT SQLSTATES (the 4.5/4.6a/4.6b convention, deferred-work.md). rollback_match RAISES a NEW distinct
 * code, NEVER a bare `P0001` (which lib/match/format.ts owns and maps to `already_locked`):
 *   * IC905 — rollback_match's own raise paths (a routing-cycle hop-cap, or a pass-2 lock-invariant violation).
 *     These are genuine bracket corruption, not a refusal, so they map to `write_failed`/500 — the same posture
 *     4.5 took for advance_match's bare P0001 raises (deferred-work.md:41).
 * ⚠ Do NOT map P0001 (format.ts's), IC901/IC902 (walkover.ts's), or IC903/IC904 (approve.ts's) — mapping them
 * here would hijack another lib's refusals. The typed refusals (bad_match / not_resolved / downstream_active)
 * are RETURNED by the RPC, not raised.
 */

const ROLLBACK_INVARIANT = 'IC905'; // rollback_match's hop-cap cycle / pass-2 lock-invariant raise — genuine corruption

/** One blocking downstream match the AD-8 flag refuses to auto-revert (it stands on its own state). */
export interface BlockingMatch {
  match_id: number;
  state: string;
}

/** The RPC's typed reply. `ok:false` carries a `reason` (+ `blocking` for downstream_active); the ok payload
 *  carries the revert outcome. */
interface RpcResult {
  ok: boolean;
  reason?: string;
  state?: string;
  stat_rows_unpublished?: number;
  reverted?: unknown[];
  uncrowned?: boolean;
  blocking?: BlockingMatch[];
}

export type RollbackMatchResult =
  | {
      ok: true;
      statRowsUnpublished: number;
      reverted: unknown[];
      uncrowned: boolean;
    }
  | {
      ok: false;
      reason:
        | 'bad_match' // no such match
        | 'not_resolved' // state is not a demo-derived `resolved` — nothing to unpublish (also AC2's idempotency: a second rollback is not_resolved). manual_resolved is Story 4.8's to invert (DECISION C)
        | 'downstream_active' // ⭐ the AD-8 flag: a dependent advance stands on its own state — refuse, leaf-first. `blocking` lists which matches to roll back first
        | 'write_failed';
      blocking?: BlockingMatch[]; // present ONLY on downstream_active — the matches the admin must address first
    };

const ROLLBACK_REASONS = new Set(['bad_match', 'not_resolved', 'downstream_active']);

/**
 * Roll back a demo-derived Approved (`resolved`) match: revert its dependent advances transitively, then
 * unpublish it to `pending` — atomically. The two-pass revert, the AD-8 downstream flag and the conditional
 * un-seat are ENFORCED IN THE DB (migration 0018 `rollback_match`).
 */
export async function rollbackMatch(
  admin: SupabaseClient,
  params: { actingAdmin: string; matchId: number },
): Promise<RollbackMatchResult> {
  const { data, error } = await admin.rpc('rollback_match', {
    p_match_id: params.matchId,
    p_actor_steamid64: params.actingAdmin,
  });

  if (error) {
    // The DB raises (never returns) for these — genuine corruption, a server fault (unlike the typed refusals).
    if (error.code === ROLLBACK_INVARIANT) {
      console.error('[rollbackMatch] rollback_match raised an invariant (IC905):', error.message);
      return { ok: false, reason: 'write_failed' };
    }
    console.error('[rollbackMatch] rollback_match RPC failed:', error.message);
    return { ok: false, reason: 'write_failed' };
  }

  const result = data as RpcResult | null;
  if (!result?.ok) {
    const reason = result?.reason;
    if (reason && ROLLBACK_REASONS.has(reason)) {
      // ⭐ downstream_active carries `blocking` — surface it so the admin knows which downstream match to roll
      // back first. It is only present on that reason; the array is validated shape-lightly (ids + states).
      if (reason === 'downstream_active') {
        return { ok: false, reason: 'downstream_active', blocking: result?.blocking ?? [] };
      }
      return { ok: false, reason: reason as 'bad_match' | 'not_resolved' };
    }
    return { ok: false, reason: 'write_failed' }; // fail closed on an unrecognised refusal
  }

  // Validate the ok-payload's shape before trusting it (the 4.1 review lesson).
  if (
    typeof result.stat_rows_unpublished !== 'number' ||
    !Array.isArray(result.reverted) ||
    typeof result.uncrowned !== 'boolean'
  ) {
    console.error('[rollbackMatch] ok reply missing a usable field:', result);
    return { ok: false, reason: 'write_failed' };
  }

  return {
    ok: true,
    statRowsUnpublished: result.stat_rows_unpublished,
    reverted: result.reverted,
    uncrowned: result.uncrowned,
  };
}
