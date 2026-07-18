import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The atomic "Aprobar" publish — the AD-6 / FR-13 path (Story 4.6b).
 *
 * One admin command, a thin wrapper over migration-0017's `approve_match` RPC: on a `pending`, demo-bound
 * match it flips the stat rows to `approved`, writes the demo-derived score + `state='resolved'`, advances the
 * bracket (idempotent), posts one `timeline_feed` entry, and emits exactly one `match.approved` Broadcast —
 * all in ONE DB transaction (AD-6). "One tap produces consistent published truth with no half-applied state."
 *
 * ⚠ THIS FILE IS UX, NOT TEETH — same division of labour as lib/match/walkover.ts + lib/match/format.ts. The
 * whole-bracket lock, the score mapping, the {ok:false}-advance rollback, the AD-23 guards and the append-only
 * feed all live in the DATABASE (migration 0017), because `service_role` holds UPDATE on `match` and has
 * BYPASSRLS — no route-level discipline can bind it. BYPASSRLS skips policies; it never skips triggers. All
 * writes go through the INJECTED service-role `admin` client (AD-2).
 *
 * ⚠ DISTINCT SQLSTATES (the 4.5/4.6a convention, deferred-work.md). approve_match RAISES a NEW distinct code,
 * NEVER a bare `P0001` (which lib/match/format.ts owns and maps to `already_locked`):
 *   * IC903 — approve_match rolled the publish back because advance_match returned {ok:false} -> `advance_refused`.
 *   * IC904 — the AD-23 terminal guard's new rule refused a resolved -> bye/forfeit/void flip -> `terminal`.
 *   * 23514 — a check_violation (match_live_requires_locked_format: the format was never locked) -> `format_not_declared`.
 * ⚠ Do NOT map P0001 (format.ts's) nor IC901/IC902 (walkover.ts's) — mapping them here would hijack another
 * lib's refusals. Mapping these (rather than swallowing them to a 500) is Story 4.1's review lesson applied: a
 * trigger / rollback refusal is a REFUSAL, not a server fault, so it reports as one.
 */

const ADVANCE_REFUSED = 'IC903'; // approve_match rolled the publish back — advance_match returned {ok:false}
const TERMINAL_STATE = 'IC904'; // match_terminal_state_guard's IC904 rule — a resolved result cannot be forfeited/voided
const FORMAT_NOT_DECLARED = '23514'; // match_live_requires_locked_format — the match's format was never locked

/** The RPC's typed reply. `ok:false` carries a `reason` string; the ok payload carries the publish outcome. */
interface RpcResult {
  ok: boolean;
  reason?: string;
  stat_rows_approved?: number;
  score_a?: number;
  score_b?: number;
  winner_entry?: number;
  advanced?: number;
  champion?: number | null;
}

export type ApproveMatchResult =
  | {
      ok: true;
      statRowsApproved: number;
      scoreA: number;
      scoreB: number;
      winnerEntry: number;
      advanced: number;
      champion: number | null;
    }
  | {
      ok: false;
      reason:
        | 'bad_match' // no such match
        | 'not_pending' // state is not `pending` — nothing else is approvable (4.6a's bind is what produces `pending`)
        | 'not_bound' // demo_id is null — the match was never bound; refuse, do NOT bind (that is 4.6a's job)
        | 'wrong_demo' // a stat_row's player is not one of the two seated competitors (the demo is for other people)
        | 'demo_mismatch' // a stat_row.demo_id != match.demo_id (score derived from one demo, evidence link names another)
        | 'bad_score' // rounds_won is missing OR NULL for a competitor (nullable; every pre-0016 row is NULL)
        | 'tied' // score_a = score_b — a draw has no winner_entry and cannot advance a double-elim bracket (DECISION K)
        | 'advance_refused' // the advance was refused (IC903), so the whole publish rolled back
        | 'terminal' // AD-23 (IC904): the match is already a committed result — cannot be forfeited/voided
        | 'format_not_declared' // 23514: the match's format was never locked (should not occur on a `pending` match)
        | 'write_failed';
    };

const APPROVE_REASONS = new Set([
  'bad_match',
  'not_pending',
  'not_bound',
  'wrong_demo',
  'demo_mismatch',
  'bad_score',
  'tied',
]);

/**
 * Approve a `pending`, demo-bound match: publish its stats, set the demo-derived score, advance the bracket,
 * post the feed entry, and emit — atomically. The score mapping, the {ok:false}-advance rollback and the AD-23
 * guards are ENFORCED IN THE DB (migration 0017 `approve_match` + `match_terminal_state_guard`).
 */
export async function approveMatch(
  admin: SupabaseClient,
  params: { actingAdmin: string; matchId: number },
): Promise<ApproveMatchResult> {
  const { data, error } = await admin.rpc('approve_match', {
    p_match_id: params.matchId,
    p_actor_steamid64: params.actingAdmin,
  });

  if (error) {
    // The DB raises (never returns) for these — a REFUSAL, not a server fault (the 4.5/4.6a convention).
    if (error.code === ADVANCE_REFUSED) {
      return { ok: false, reason: 'advance_refused' };
    }
    if (error.code === TERMINAL_STATE) {
      return { ok: false, reason: 'terminal' };
    }
    if (error.code === FORMAT_NOT_DECLARED) {
      return { ok: false, reason: 'format_not_declared' };
    }
    console.error('[approveMatch] approve_match RPC failed:', error.message);
    return { ok: false, reason: 'write_failed' };
  }

  const result = data as RpcResult | null;
  if (!result?.ok) {
    const reason = result?.reason;
    if (reason && APPROVE_REASONS.has(reason)) {
      return { ok: false, reason: reason as Exclude<ApproveMatchResult, { ok: true }>['reason'] };
    }
    return { ok: false, reason: 'write_failed' }; // fail closed on an unrecognised refusal
  }

  // Validate the ok-payload's shape before trusting it (the 4.1 review lesson). `champion` is nullable (only a
  // Grand Final crowns one); every other field must be a number.
  if (
    typeof result.stat_rows_approved !== 'number' ||
    typeof result.score_a !== 'number' ||
    typeof result.score_b !== 'number' ||
    typeof result.winner_entry !== 'number' ||
    typeof result.advanced !== 'number' ||
    !(result.champion === null || result.champion === undefined || typeof result.champion === 'number')
  ) {
    console.error('[approveMatch] ok reply missing a usable field:', result);
    return { ok: false, reason: 'write_failed' };
  }

  return {
    ok: true,
    statRowsApproved: result.stat_rows_approved,
    scoreA: result.score_a,
    scoreB: result.score_b,
    winnerEntry: result.winner_entry,
    advanced: result.advanced,
    champion: result.champion ?? null,
  };
}
