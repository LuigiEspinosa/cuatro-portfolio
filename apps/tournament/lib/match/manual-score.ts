import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The manual score override — the manual side of FR-16 / AD-5 (Story 4.8).
 *
 * One admin command, a thin wrapper over migration-0019's `manual_resolve_match` RPC: on a demo-less
 * (`declared`/`live`) match OR an audited override of a demo-bound (`pending`) match, it writes the hand-entered
 * score + `state='manual_resolved'`, advances the bracket (idempotent), posts one `timeline_feed` entry, and
 * emits exactly one `match.manual_resolved` Broadcast — all in ONE DB transaction (AD-6). It is the manual
 * sibling of lib/match/approve.ts: an admin types the score in instead of it being read off a demo.
 *
 * ⚠ THIS FILE IS UX, NOT TEETH — same division of labour as lib/match/approve.ts + lib/match/format.ts. The
 * whole-bracket lock, the AD-5 override rule, the ⭐ audit-row-as-precondition gate (match_manual_override_audited),
 * the {ok:false}-advance rollback and the score-source guards all live in the DATABASE (migration 0019), because
 * `service_role` holds UPDATE on `match` and has BYPASSRLS — no route-level discipline can bind it. BYPASSRLS
 * skips policies; it never skips triggers. All writes go through the INJECTED service-role `admin` client (AD-2).
 *
 * ⚠ DISTINCT SQLSTATES (the 4.5/4.6a/4.6b/4.7 convention, deferred-work.md). manual_resolve_match RAISES a NEW
 * distinct code, NEVER a bare `P0001` (which lib/match/format.ts owns and maps to `already_locked`):
 *   * IC906 — manual_resolve_match rolled the resolution back because advance_match returned {ok:false} -> `advance_refused`.
 *   * IC907 — match_manual_override_audited refused the override write: no matching `manual_score` audit row for
 *     THIS transaction -> `override_not_audited`. It SHOULD never surface (the RPC writes the row before the
 *     UPDATE); mapped as the honest report if it ever does — exactly as bind.ts maps its "should-never-happen"
 *     23514 rather than swallowing it to a 500.
 * ⚠ Do NOT map P0001 (format.ts's), IC901/IC902 (walkover.ts's), IC903/IC904 (approve.ts's), or IC905
 * (rollback.ts's) — mapping them here would hijack another lib's refusals. Anything unrecognised fails CLOSED
 * to `write_failed`.
 */

const ADVANCE_REFUSED = 'IC906'; // manual_resolve_match rolled the resolution back — advance_match returned {ok:false}
const OVERRIDE_NOT_AUDITED = 'IC907'; // match_manual_override_audited — an admin_manual override with no matching audit row

/** The RPC's typed reply. `ok:false` carries a `reason` string; the ok payload carries the resolution outcome. */
interface RpcResult {
  ok: boolean;
  reason?: string;
  state?: string;
  score_a?: number;
  score_b?: number;
  winner_entry?: number;
  override?: boolean;
  advanced?: number;
  champion?: number | null;
}

export type ManualResolveMatchResult =
  | {
      ok: true;
      state: string;
      scoreA: number;
      scoreB: number;
      winnerEntry: number;
      override: boolean;
      advanced: number;
      champion: number | null;
    }
  | {
      ok: false;
      reason:
        | 'bad_match' // no such match
        | 'ceremony_locked' // Story 6.2 / AD-15: the ceremony is locked — a hand-entered result now would diverge the live standings from the frozen snapshot
        | 'not_manual_resolvable' // state is not declared/live/pending — nothing else can be hand-resolved (AC2)
        | 'undetermined' // a competitor seat is NULL — no winner to derive
        | 'format_not_declared' // 23514 backstop: the match's format was never locked (AD-10)
        | 'bad_score' // score_a/score_b null or negative
        | 'tied' // score_a = score_b — a draw has no winner and cannot advance a double-elim bracket
        | 'override_required' // a demo is bound — discarding its score demands the explicit audited-override flag
        | 'nothing_to_override' // override=true on a no-demo match — a mis-set flag surfaces an admin mistake
        | 'advance_refused' // IC906: the advance was refused, so the whole resolution rolled back
        | 'override_not_audited' // IC907: the override gate refused (no matching audit row) — should never surface
        | 'write_failed';
    };

/** Every reason the RPC can RETURN (guards). A reason outside this set is not trusted — the lib fails closed. */
const MANUAL_REASONS = new Set([
  'bad_match',
  'ceremony_locked',
  'not_manual_resolvable',
  'undetermined',
  'format_not_declared',
  'bad_score',
  'tied',
  'override_required',
  'nothing_to_override',
]);

/**
 * Resolve a match by a hand-entered score: write score_a/score_b + `state='manual_resolved'`, advance the
 * bracket, post the feed entry, and emit — atomically. The AD-5 override rule, the audit-row-as-precondition gate
 * and the {ok:false}-advance rollback are ENFORCED IN THE DB (migration 0019 `manual_resolve_match` +
 * `match_manual_override_audited`).
 *
 * A DEMO-BOUND match requires `override:true` (an audited override that discards the demo's score); a NO-DEMO
 * match requires `override:false` (a plain manual entry). The RPC refuses the mismatched combinations.
 */
export async function manualResolveMatch(
  admin: SupabaseClient,
  params: { actingAdmin: string; matchId: number; scoreA: number; scoreB: number; override: boolean },
): Promise<ManualResolveMatchResult> {
  const { data, error } = await admin.rpc('manual_resolve_match', {
    p_match_id: params.matchId,
    p_score_a: params.scoreA,
    p_score_b: params.scoreB,
    p_actor_steamid64: params.actingAdmin,
    p_override: params.override,
  });

  if (error) {
    // The DB raises (never returns) for these — a REFUSAL, not a server fault (the 4.5/4.6a convention).
    if (error.code === ADVANCE_REFUSED) {
      return { ok: false, reason: 'advance_refused' };
    }
    if (error.code === OVERRIDE_NOT_AUDITED) {
      return { ok: false, reason: 'override_not_audited' };
    }
    console.error('[manualResolveMatch] manual_resolve_match RPC failed:', error.message);
    return { ok: false, reason: 'write_failed' };
  }

  const result = data as RpcResult | null;
  if (!result?.ok) {
    const reason = result?.reason;
    if (reason && MANUAL_REASONS.has(reason)) {
      return { ok: false, reason: reason as Exclude<ManualResolveMatchResult, { ok: true }>['reason'] };
    }
    return { ok: false, reason: 'write_failed' }; // fail closed on an unrecognised refusal
  }

  // Validate the ok-payload's shape before trusting it (the 4.1 review lesson). `champion` is nullable (only a
  // Grand Final crowns one); every other field must be its expected type.
  if (
    typeof result.state !== 'string' ||
    typeof result.score_a !== 'number' ||
    typeof result.score_b !== 'number' ||
    typeof result.winner_entry !== 'number' ||
    typeof result.override !== 'boolean' ||
    typeof result.advanced !== 'number' ||
    !(result.champion === null || result.champion === undefined || typeof result.champion === 'number')
  ) {
    console.error('[manualResolveMatch] ok reply missing a usable field:', result);
    return { ok: false, reason: 'write_failed' };
  }

  return {
    ok: true,
    state: result.state,
    scoreA: result.score_a,
    scoreB: result.score_b,
    winnerEntry: result.winner_entry,
    override: result.override,
    advanced: result.advanced,
    champion: result.champion ?? null,
  };
}
