import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The pre-declared match format + tie policy — the AD-10 lock (Story 4.2, AC1/AC2).
 *
 * `format` and `tie_policy` are declared and FROZEN before a match may go live, and a later change is
 * only ever an explicit, audited override — never a silent edit.
 *
 * ⚠ THIS FILE IS UX, NOT TEETH. The catalog check below is a friendly early exit (a clean 422 without a
 * round-trip through a doomed transaction); the actual lock lives in the DATABASE — two CHECK constraints,
 * the `match_format_lock` latch, and the `match_format_audited` constraint trigger in migration 0012 —
 * because `service_role` holds UPDATE on `match` and has BYPASSRLS, so no policy and no route-level
 * discipline can stop a future story's `update match set format = …`. BYPASSRLS skips policies; it never
 * skips triggers. Same division of labour as `requireMutableTournament` (lib/roster.ts) vs the roster-lock
 * trigger: the lib is UX, the DB is truth. All writes go through the INJECTED service-role `admin` client
 * (AD-2).
 */

// ── The format catalog — ORGANIZER CONFIG, NOT CODE ─────────────────────────
//
// ⭐ EDIT THESE ARRAYS FREELY. That is the whole point, and it is why `match.format`/`match.tie_policy`
// are deliberately FREE TEXT in the DB with no CHECK enum (SOLUTION-DESIGN §3 gives every other
// closed-set column a CHECK and gives these two none; ARCHITECTURE-SPINE OQ-4 records match formats as
// "organizer/content config, NOT code"). A CHECK enum would mean a MIGRATION every time Cuatro wants MR8
// instead of MR12 for a round — for a casual private event that is exactly backwards. So the VOCABULARY
// lives here, editable in one line with no migration, and the DB keeps only a non-blank backstop
// (`match_format_lock_complete`).
//
// The starter set is grounded in the PRD ("e.g., MR12 + overtime rule", prd.md:518) and the admin
// mockup's `de_mirage · MR12`.
//
// ⚠ NO `bo3_mr12` — it was in the first cut and the code review pulled it (Cuatro, 2026-07-13). `match`
// has exactly one `score_a`/`score_b`, one `demo_id` and one `winner_entry`, and AD-18 is single-demo-per-
// match, so a best-of-three has NO representation in the schema. Picking it would have created a
// permanently-latched row the rest of the system cannot model, escapable only through an audited override.
// Add it back when a story actually supports multi-map — the free-text column keeps that door open with no
// migration, which is precisely why it is free text.
export const MATCH_FORMATS = ['mr12', 'mr8'] as const;
export const TIE_POLICIES = ['ot_mr3', 'ot_mr3_unlimited', 'draw'] as const;

export type MatchFormat = (typeof MATCH_FORMATS)[number];
export type TiePolicy = (typeof TIE_POLICIES)[number];

function isMatchFormat(value: string): value is MatchFormat {
  return (MATCH_FORMATS as readonly string[]).includes(value);
}

function isTiePolicy(value: string): value is TiePolicy {
  return (TIE_POLICIES as readonly string[]).includes(value);
}

// ── The atomic admin command ────────────────────────────────────────────────

export type FormatCommandResult =
  | { ok: true; declared: number; override: boolean }
  | {
      ok: false;
      reason:
        | 'bad_tournament' // no such tournament
        | 'bad_match' // a requested match id does not belong to this tournament (the WHOLE call fails)
        | 'bad_format' // the format / tie policy is not in the catalog above (or is blank/whitespace)
        | 'override_needs_ids' // override=true without explicit match_ids — never bulk-override a bracket by accident
        | 'not_declarable' // a targeted match is not `declared` (a bye/void/forfeit/live row) — the lock is a LATCH, so this would be irreversible
        | 'already_locked' // the format is frozen; changing it requires an explicit audited override
        | 'not_overridable' // override=true on a match that was never locked — that is a first declare, not an override
        | 'no_eligible_matches' // nothing to declare — an honest refusal, never a silent no-op
        | 'write_failed';
    };

/** The RPC's typed reply. `ok:false` carries the same reason strings as the union above. */
interface RpcResult {
  ok: boolean;
  reason?: string;
  declared?: number;
  override?: boolean;
}

const RPC_REASONS = new Set([
  'bad_tournament',
  'bad_match',
  'bad_format',
  'override_needs_ids',
  'not_declarable',
  'already_locked',
  'not_overridable',
  'no_eligible_matches',
]);

/**
 * A format-lock trigger's refusal (migration 0012): someone tried to change a FROZEN format/tie_policy
 * without the audit row that authorizes it, to un-latch `format_locked`, or to forge/erase
 * `format_overridden_at`.
 *
 * This is UNREACHABLE through the RPC — it takes `FOR UPDATE` on the target rows, re-reads their state
 * under that lock, and writes the authorizing `audit_log` row BEFORE the UPDATE, so a concurrent declare
 * makes the loser refuse with a typed reason rather than reach a trigger. It is mapped anyway,
 * deliberately: Story 4.1's code review found that the one code path its D3 trigger existed for reported an
 * HTTP 500, because its `P0001` was left unmapped. A trigger refusal is a REFUSAL (the format is frozen),
 * not a server fault — so it reports as one. (Same classify-by-SQLSTATE pattern as lib/roster.ts:26-54.)
 *
 * ⚠ `P0001` is PL/pgSQL's GENERIC exception code, so the moment a SECOND trigger on `match` raises it
 * (Story 4.5's state machine is the likely one), this mapping becomes ambiguous and must be given a
 * distinct SQLSTATE. Tracked in deferred-work.md; today `match` has no other raising trigger.
 */
const FORMAT_FROZEN = 'P0001';

/**
 * Declare (or audit-override) the format + tie policy for one match, several, or a WHOLE TOURNAMENT.
 *
 * BULK IS THE DEFAULT, AND IT HAS TO BE: an 11-player field generates 30 `match` rows, so a
 * per-match-only API would mean 30 HTTP calls before the first match could start. Omit `matchIds` and
 * every still-`declared`, still-unlocked match of the tournament is declared in one transaction. Pass
 * `matchIds` to target specific matches — which an override REQUIRES (an override is surgical; you do not
 * bulk-override a live bracket by accident).
 *
 * One RPC = one transaction: the guards, one `audit_log` row PER MATCH, and the UPDATE all commit
 * together, or none of them do. The audit row is not a convention the caller could forget — it is written
 * FIRST, and the `match_format_audited` trigger refuses the UPDATE of any match that does not already have
 * one describing exactly that result. The audit row is the override's PRECONDITION, not its receipt.
 */
export async function declareMatchFormat(
  admin: SupabaseClient,
  params: {
    actingAdmin: string;
    tournamentId: number;
    matchIds?: number[];
    format: string;
    tiePolicy: string;
    override?: boolean;
  },
): Promise<FormatCommandResult> {
  const { actingAdmin, tournamentId, matchIds, format, tiePolicy, override } = params;

  // Catalog validation BEFORE any I/O — an unknown format never reaches the database. The DB's non-blank
  // CHECK is the backstop for a direct RPC call, not the vocabulary.
  if (!isMatchFormat(format) || !isTiePolicy(tiePolicy)) {
    return { ok: false, reason: 'bad_format' };
  }

  const { data, error } = await admin.rpc('declare_match_format', {
    p_tournament_id: tournamentId,
    // `undefined` would be dropped from the JSON body entirely and the RPC would see a missing argument;
    // an explicit null is what selects the bulk path.
    p_match_ids: matchIds ?? null,
    p_format: format,
    p_tie_policy: tiePolicy,
    p_actor_steamid64: actingAdmin,
    p_override: override ?? false,
  });

  if (error) {
    if (error.code === FORMAT_FROZEN) {
      return { ok: false, reason: 'already_locked' };
    }
    console.error('[declareMatchFormat] declare_match_format RPC failed:', error.message);
    return { ok: false, reason: 'write_failed' };
  }

  const result = data as RpcResult | null;
  if (!result?.ok) {
    const reason = result?.reason;
    // Fail closed: an unrecognised refusal is a write failure, never a silent success.
    if (reason && RPC_REASONS.has(reason)) {
      return { ok: false, reason: reason as Exclude<FormatCommandResult, { ok: true }>['reason'] };
    }
    return { ok: false, reason: 'write_failed' };
  }

  // Report what the DATABASE committed, not what we asked for. `declared` comes from the RPC's
  // GET DIAGNOSTICS ROW_COUNT — so a short write is visible to the caller instead of being papered over
  // with `matchIds.length`.
  //
  // `declared < 1` is a write failure, NOT an `ok:true` with a zero count. The RPC's `no_eligible_matches`
  // guard makes zero unreachable today, but the code review's fix added real WHERE predicates to the target
  // resolution — so "the DB said ok but changed nothing" must fail closed rather than return an HTTP 200
  // that tells the admin the bracket was declared when it was not.
  const { declared, override: didOverride } = result;
  if (!Number.isInteger(declared) || (declared as number) < 1 || typeof didOverride !== 'boolean') {
    console.error('[declareMatchFormat] declare_match_format returned ok without a usable count:', result);
    return { ok: false, reason: 'write_failed' };
  }

  return { ok: true, declared: declared as number, override: didOverride };
}
