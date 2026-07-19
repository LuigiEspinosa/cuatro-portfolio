import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Bind a parsed demo to the bracket match it decided — the AD-2 / AD-5 / FR-13 path (Story 4.6a).
 *
 * One admin command, a thin wrapper over migration 0016's `bind_match_demo` RPC. It populates all three of
 * the FKs that have been NULL since 0010 (`match.demo_id`, `demo.match_id`, `stat_row.match_id`) and moves
 * the match `declared|live -> pending` — the state Story 4.6b's Aprobar and Story 4.7's rollback both
 * require, and which NOTHING in the codebase could produce before this story.
 *
 * ⚠ THIS FILE IS UX, NOT TEETH — the same division of labour as lib/match/format.ts + lib/match/walkover.ts.
 * The binding itself, every guard, the idempotency, the AD-23 terminal refusal and the audit row all live in
 * the DATABASE (migration 0016's RPC), because `service_role` holds UPDATE on `match`/`demo`/`stat_row` and
 * has BYPASSRLS — no route-level discipline can bind it. BYPASSRLS skips policies; it never skips triggers or
 * CHECKs. All writes go through the INJECTED service-role `admin` client (AD-2).
 *
 * ⚠ SQLSTATES. `bind_match_demo` RAISES NOTHING — every refusal is RETURNED as {ok:false, reason}. The two
 * codes mapped here come from constraints/triggers it could trip, and each is owned elsewhere:
 *   * IC901 — 4.5's AD-23 terminal-state guard (0015:108-126) -> `terminal`. Not reachable through the RPC
 *     (its `not_bindable` guard refuses a terminal state first, BY DESIGN — that is AC2), but mapped anyway:
 *     Story 4.1's review found that the one path its trigger existed for reported an HTTP 500 because the
 *     code was unmapped. A refusal is a REFUSAL, not a server fault. 4.7's un-seat path will make it live.
 *   * 23514 — a `match` check_violation, DISAMBIGUATED by the constraint name in `error.message` (Story 4.8,
 *     DECISION I — closing the deferred-work.md item this file carried since Story 4.6a):
 *       · `match_live_requires_locked_format` (0012:123-126) -> `format_not_declared`. This closes the "whoever
 *         lands `declared -> live` inherits an opaque check_violation" item open since Story 4.2; 4.6a lands
 *         `pending`, so it inherits it. The RPC's own guard means this should never be reached — it is the honest
 *         report if it ever is.
 *       · `score_source_guard` (0010:124-128) -> `write_failed`. A row with `score_source='admin_manual'`,
 *         `manual_override=false`, `demo_id IS NULL` is legal today and becomes illegal the instant the bind sets
 *         `demo_id`. ⚠ UNREACHABLE via bind (analysis, recorded in Story 4.8 Completion Notes): the RPC's
 *         `not_bindable` guard refuses anything that is not `declared`/`live`, and a `manual_resolved` match — the
 *         only thing 4.8 sets `score_source` on — is neither, so no bind ever touches a score_source-set row.
 *         Discriminating the name means a future path that DID reach it reports honestly, never "declare the
 *         format first". (Was: EVERY 23514 mapped to `format_not_declared`. Code review 2026-07-16; fixed 4.8.)
 *
 * ⚠ DELIBERATELY NOT MAPPED: bare `P0001` (that is lib/match/format.ts's `already_locked` — deferred-work.md,
 * "P0001 is PL/pgSQL's GENERIC exception code") and `IC902` (that is lib/match/walkover.ts's
 * `advance_refused`). Claiming either here would re-create the exact ambiguity DECISION D was written to
 * prevent. Anything unrecognised fails CLOSED to `write_failed`.
 *
 * ⚠ deferred-work.md is cited BY ITEM TITLE, never by line: it grows at the top, so line numbers rot on
 * every story — this file originally cited `:136` and `:127`, both already wrong when written (`:127` was
 * never the P0001 item at all). Code review 2026-07-16.
 */

const TERMINAL_STATE = 'IC901'; // match_terminal_state_guard — a committed bye/forfeit/void cannot be flipped
const CHECK_VIOLATION = '23514'; // a match CHECK — DISAMBIGUATED by constraint name below (two CHECKs fire 23514)
// The bind's UPDATE re-evaluates every CHECK on `match`. TWO of them raise 23514, and they mean DIFFERENT things,
// so the raw code cannot be the discriminator — the CONSTRAINT NAME in error.message is (Story 4.8, DECISION I,
// closing the deferred-work.md "bind.ts maps EVERY 23514 to format_not_declared" item):
const FORMAT_LOCK_CONSTRAINT = 'match_live_requires_locked_format'; // -> format_not_declared (the honest UX)
const SCORE_SOURCE_CONSTRAINT = 'score_source_guard'; // -> write_failed (unreachable via bind today — see below)

/** The RPC's typed reply. `ok:false` carries a `reason` string; the ok payload carries the binding's fields. */
interface RpcResult {
  ok: boolean;
  reason?: string;
  match_id?: number;
  demo_id?: number;
  state?: string;
  idempotent?: boolean;
  stat_rows_bound?: number;
  bound_demo_id?: number;
  bound_match_id?: number;
}

export type BindMatchDemoResult =
  | { ok: true; matchId: number; demoId: number; state: string; idempotent: boolean; statRowsBound: number }
  | {
      ok: false;
      reason:
        | 'bad_match' // no such match
        | 'bad_demo' // no such demo
        | 'not_bindable' // state is not declared/live — INCLUDING a committed bye/forfeit/void (AD-23, AC2)
        | 'already_bound' // this match holds a different demo, or this demo belongs to a different match
        | 'anomalous' // demo.validation_state = 'anomalous' — a held demo does not publish (DECISION H)
        | 'no_stats' // the demo produced no stat_row: it decided nothing
        | 'format_not_declared' // the format is not locked yet (AD-10) — declare it first
        | 'terminal' // AD-23 IC901: the terminal guard refused the flip — should not occur (see above)
        | 'write_failed';
    };

/** Every reason the RPC can RETURN. A reason outside this set is not trusted — the lib fails closed. */
const BIND_REASONS = new Set([
  'bad_match',
  'bad_demo',
  'not_bindable',
  'already_bound',
  'anomalous',
  'no_stats',
  'format_not_declared',
]);

/**
 * Bind `demoId` to `matchId`: populates match.demo_id + demo.match_id + every stat_row.match_id for that
 * demo, and moves the match to `pending`.
 *
 * IDEMPOTENT on the SAME pair — a retry returns `{ok:true, idempotent:true}` having written nothing (so a
 * dropped HTTP response is safe to retry). A DIFFERENT pair is REFUSED (`already_bound`), never silently
 * re-pointed: re-pointing a bound demo is Story 4.7's audited rollback.
 */
export async function bindMatchDemo(
  admin: SupabaseClient,
  params: { actingAdmin: string; matchId: number; demoId: number },
): Promise<BindMatchDemoResult> {
  const { data, error } = await admin.rpc('bind_match_demo', {
    p_match_id: params.matchId,
    p_demo_id: params.demoId,
    p_actor_steamid64: params.actingAdmin,
  });

  if (error) {
    // The DB raises (never returns) for these — a REFUSAL, not a server fault.
    if (error.code === TERMINAL_STATE) {
      return { ok: false, reason: 'terminal' };
    }
    if (error.code === CHECK_VIOLATION) {
      // ⚠ 23514 is NOT unique to one constraint (Story 4.8, DECISION I). match_live_requires_locked_format means
      // "declare the format first" (a real, actionable admin UX); score_source_guard tripping on this UPDATE is a
      // should-never-happen (a row already carrying `score_source='admin_manual', manual_override=false,
      // demo_id IS NULL` becomes illegal the instant the bind sets demo_id). ⚠ UNREACHABLE via bind TODAY, by
      // analysis: bind_match_demo's `not_bindable` guard refuses anything that is not `declared`/`live`, and a
      // `manual_resolved` match (the only thing Story 4.8 writes score_source onto) is neither — so no bind ever
      // touches a score_source-set row. Discriminating the constraint name means a future path that DID reach it
      // reports honestly instead of lying "declare the format first". Anything unrecognised fails CLOSED.
      if (error.message?.includes(FORMAT_LOCK_CONSTRAINT)) {
        return { ok: false, reason: 'format_not_declared' };
      }
      if (error.message?.includes(SCORE_SOURCE_CONSTRAINT)) {
        console.error('[bindMatchDemo] score_source_guard tripped on bind (should be unreachable):', error.message);
        return { ok: false, reason: 'write_failed' };
      }
      // A 23514 from some other match CHECK — fail closed rather than mislabel it "declare the format first".
      console.error('[bindMatchDemo] unrecognised 23514 on bind:', error.message);
      return { ok: false, reason: 'write_failed' };
    }
    console.error('[bindMatchDemo] bind_match_demo RPC failed:', error.message);
    return { ok: false, reason: 'write_failed' };
  }

  const result = data as RpcResult | null;
  if (!result?.ok) {
    const reason = result?.reason;
    if (reason && BIND_REASONS.has(reason)) {
      return { ok: false, reason: reason as Exclude<BindMatchDemoResult, { ok: true }>['reason'] };
    }
    return { ok: false, reason: 'write_failed' }; // fail closed on an unrecognised refusal
  }

  // Validate the ok-payload's SHAPE before trusting it: a typo'd jsonb key in the RPC would otherwise surface
  // as `undefined` fields on a `{ok:true}` the route reports as success (the Story-4.1 review's lesson).
  if (
    typeof result.match_id !== 'number' ||
    typeof result.demo_id !== 'number' ||
    typeof result.state !== 'string' ||
    typeof result.idempotent !== 'boolean' ||
    typeof result.stat_rows_bound !== 'number'
  ) {
    console.error('[bindMatchDemo] ok reply missing a usable field:', result);
    return { ok: false, reason: 'write_failed' };
  }
  return {
    ok: true,
    matchId: result.match_id,
    demoId: result.demo_id,
    state: result.state,
    idempotent: result.idempotent,
    statRowsBound: result.stat_rows_bound,
  };
}
