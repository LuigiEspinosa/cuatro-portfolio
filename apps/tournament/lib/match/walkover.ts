import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Bye / forfeit walkover with a server-enforced grace timer — the AD-9 / AD-23 path (Story 4.5).
 *
 * Three admin commands, each a thin wrapper over a migration-0015 RPC:
 *   * `beginMatchGrace` — declared -> awaiting_grace, stamps the server grace clock.
 *   * `resumeMatch`     — awaiting_grace -> declared (the absent player arrived), clears the clock.
 *   * `markWalkover`    — awaiting_grace -> forfeit AFTER the grace period elapses: seats the present player
 *                         as winner, advances the bracket, and logs who + when.
 *
 * ⚠ THIS FILE IS UX, NOT TEETH — same division of labour as lib/match/format.ts. The grace clock, the
 * elapsed gate, the AD-23 terminal-state guard and the {ok:false}-advance rollback all live in the DATABASE
 * (migration 0015 RPCs + `match_terminal_state_guard`), because `service_role` holds UPDATE on `match` and
 * has BYPASSRLS — no route-level discipline can bind it. BYPASSRLS skips policies; it never skips triggers.
 * All writes go through the INJECTED service-role `admin` client (AD-2).
 *
 * ⚠ DISTINCT SQLSTATES (DECISION D, deferred-work.md:127). The 0015 raises use custom codes, NEVER bare
 * `P0001` (which lib/match/format.ts owns and maps to `already_locked`):
 *   * IC901 — the AD-23 terminal-state guard refused a flip OUT of a committed bye/forfeit/void -> `terminal`.
 *   * IC902 — mark_walkover rolled the forfeit back because advance_match returned {ok:false} -> `advance_refused`.
 * Mapping them here (rather than swallowing them to a 500) is Story 4.1's review lesson applied: a trigger /
 * rollback refusal is a REFUSAL, not a server fault, so it reports as one.
 */

const TERMINAL_STATE = 'IC901'; // match_terminal_state_guard — a committed bye/forfeit/void cannot be flipped
const ADVANCE_REFUSED = 'IC902'; // mark_walkover — the forfeit's advance was refused, so the forfeit rolled back

/** The RPC's typed reply. `ok:false` carries a `reason` string; the ok payloads carry the command's fields. */
interface RpcResult {
  ok: boolean;
  reason?: string;
  match_id?: number;
  awaiting_grace_since?: string;
  forfeiting_entry?: number;
  winner_entry?: number;
  advanced?: number;
  champion?: number | null;
}

// ── beginMatchGrace ─────────────────────────────────────────────────────────

export type BeginGraceResult =
  | { ok: true; matchId: number; awaitingGraceSince: string }
  | {
      ok: false;
      reason:
        | 'bad_match' // no such match
        | 'not_startable' // match is not `declared` (already awaiting_grace, or a played/terminal state)
        | 'not_ready' // a competitor seat is empty — a grace timer is for a determined matchup, not an unfilled slot
        | 'write_failed';
    };

const BEGIN_REASONS = new Set(['bad_match', 'not_startable', 'not_ready']);

/** Start the grace clock for a no-show match: `declared -> awaiting_grace`, `awaiting_grace_since = now()`. */
export async function beginMatchGrace(
  admin: SupabaseClient,
  params: { actingAdmin: string; matchId: number },
): Promise<BeginGraceResult> {
  const { data, error } = await admin.rpc('begin_match_grace', {
    p_match_id: params.matchId,
    p_actor_steamid64: params.actingAdmin,
  });

  if (error) {
    console.error('[beginMatchGrace] begin_match_grace RPC failed:', error.message);
    return { ok: false, reason: 'write_failed' };
  }

  const result = data as RpcResult | null;
  if (!result?.ok) {
    const reason = result?.reason;
    if (reason && BEGIN_REASONS.has(reason)) {
      return { ok: false, reason: reason as Exclude<BeginGraceResult, { ok: true }>['reason'] };
    }
    return { ok: false, reason: 'write_failed' }; // fail closed on an unrecognised refusal
  }

  if (typeof result.match_id !== 'number' || typeof result.awaiting_grace_since !== 'string') {
    console.error('[beginMatchGrace] ok reply missing match_id/awaiting_grace_since:', result);
    return { ok: false, reason: 'write_failed' };
  }
  return { ok: true, matchId: result.match_id, awaitingGraceSince: result.awaiting_grace_since };
}

// ── resumeMatch ─────────────────────────────────────────────────────────────

export type ResumeMatchResult =
  | { ok: true; matchId: number }
  | {
      ok: false;
      reason:
        | 'bad_match' // no such match
        | 'not_awaiting' // state is not `awaiting_grace`
        | 'write_failed';
    };

const RESUME_REASONS = new Set(['bad_match', 'not_awaiting']);

/** The absent player arrived: `awaiting_grace -> declared` (DECISION C — NOT `live`), clear the clock. */
export async function resumeMatch(
  admin: SupabaseClient,
  params: { actingAdmin: string; matchId: number },
): Promise<ResumeMatchResult> {
  const { data, error } = await admin.rpc('resume_match', {
    p_match_id: params.matchId,
    p_actor_steamid64: params.actingAdmin,
  });

  if (error) {
    console.error('[resumeMatch] resume_match RPC failed:', error.message);
    return { ok: false, reason: 'write_failed' };
  }

  const result = data as RpcResult | null;
  if (!result?.ok) {
    const reason = result?.reason;
    if (reason && RESUME_REASONS.has(reason)) {
      return { ok: false, reason: reason as Exclude<ResumeMatchResult, { ok: true }>['reason'] };
    }
    return { ok: false, reason: 'write_failed' };
  }

  if (typeof result.match_id !== 'number') {
    console.error('[resumeMatch] ok reply missing match_id:', result);
    return { ok: false, reason: 'write_failed' };
  }
  return { ok: true, matchId: result.match_id };
}

// ── markWalkover ────────────────────────────────────────────────────────────

export type MarkWalkoverResult =
  | { ok: true; forfeitingEntry: number; winnerEntry: number; advanced: number; champion: number | null }
  | {
      ok: false;
      reason:
        | 'bad_match' // no such match
        | 'not_awaiting' // state is not `awaiting_grace` — a match must be on the grace clock to be forfeited
        | 'grace_active' // the grace period has not elapsed yet (the AC2 teeth)
        | 'bad_winner' // p_winner_entry is not one of the two seated competitors
        | 'terminal' // AD-23: the match is already a committed bye/forfeit/void (IC901) — should not occur here
        | 'advance_refused' // the forfeit's advance was refused (IC902), so the whole forfeit rolled back
        | 'write_failed';
    };

const WALKOVER_REASONS = new Set(['bad_match', 'not_awaiting', 'grace_active', 'bad_winner']);

/**
 * Mark a no-show forfeit: `awaiting_grace -> forfeit`, seat the present player as winner, advance the bracket,
 * and log it. The grace-elapsed gate and the {ok:false}-advance rollback are ENFORCED IN THE DB.
 */
export async function markWalkover(
  admin: SupabaseClient,
  params: { actingAdmin: string; matchId: number; winnerEntry: number },
): Promise<MarkWalkoverResult> {
  const { data, error } = await admin.rpc('mark_walkover', {
    p_match_id: params.matchId,
    p_actor_steamid64: params.actingAdmin,
    p_winner_entry: params.winnerEntry,
  });

  if (error) {
    // The DB raises (never returns) for these two — a REFUSAL, not a server fault (DECISION D).
    if (error.code === TERMINAL_STATE) {
      return { ok: false, reason: 'terminal' };
    }
    if (error.code === ADVANCE_REFUSED) {
      return { ok: false, reason: 'advance_refused' };
    }
    console.error('[markWalkover] mark_walkover RPC failed:', error.message);
    return { ok: false, reason: 'write_failed' };
  }

  const result = data as RpcResult | null;
  if (!result?.ok) {
    const reason = result?.reason;
    if (reason && WALKOVER_REASONS.has(reason)) {
      return { ok: false, reason: reason as Exclude<MarkWalkoverResult, { ok: true }>['reason'] };
    }
    return { ok: false, reason: 'write_failed' };
  }

  // `champion` is nullable (only the Grand Final crowns one); `advanced`/entries are numbers.
  if (
    typeof result.forfeiting_entry !== 'number' ||
    typeof result.winner_entry !== 'number' ||
    typeof result.advanced !== 'number' ||
    !(result.champion === null || result.champion === undefined || typeof result.champion === 'number')
  ) {
    console.error('[markWalkover] ok reply missing a usable field:', result);
    return { ok: false, reason: 'write_failed' };
  }
  return {
    ok: true,
    forfeitingEntry: result.forfeiting_entry,
    winnerEntry: result.winner_entry,
    advanced: result.advanced,
    champion: result.champion ?? null,
  };
}
