import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Reveal one spin of the ceremony — the AD-22 admin command (Story 6.8b, AC5/AC6/AC8).
 *
 * One admin command, a thin wrapper over migration 0028's `reveal_spin` RPC. It is the moment a
 * single wheel-turn becomes public: the RPC stamps `spin.revealed_at`, and that one column is what
 * flips that spin, its `award_result` rows, its `award_result_winner` rows and its `award` into the
 * viewer's reach through 0028's four reveal-gated policies. In the SAME transaction it posts the
 * `award_reveal` `timeline_feed` entry (FR-31's third event type, which has had no writer since
 * `0017:109`), writes exactly one `reveal_spin` `audit_log` row, and — when the spin is the
 * ceremony's highest index — completes the ceremony (`state = 'complete'` + `completed_at`) as one
 * legal forward step through `assert_ceremony_transition`. All of it commits together or none of it
 * does (AD-6).
 *
 * ⚠ THIS FILE IS UX, NOT TEETH — the same division of labour as lib/ceremony/lock.ts and
 * lib/match/*.ts. The lock ordering, the guards-before-any-write rule, the forward-only dense reveal
 * order, the one-audit-row-per-accepted-call invariant and the atomic completion all live in the
 * DATABASE (migration 0028), because `service_role` holds the write grants and has BYPASSRLS — no
 * route-level discipline can bind it. All writes go through the INJECTED service-role `admin`
 * client (AD-2).
 *
 * ⚠ REVEALS ARE FORWARD-ONLY AND DENSE, AND A DOUBLE-TAP REFUSES. `p_spin_index` must be the lowest
 * unrevealed index of the ceremony (`out_of_order` otherwise, carrying `expected_spin_index` so the
 * caller learns what to press), and re-revealing an already-revealed spin returns `already_revealed`
 * rather than a silent `ok` — decided by Cuatro 2026-08-08, mirroring `persist_ceremony`'s
 * `already_persisted`. AD-8's idempotency stance genuinely cuts the other way, so the choice is
 * recorded: an idempotent reply would have to write a second audit + feed row into two append-only
 * surfaces, or write neither while claiming success.
 *
 * ⚠ NO NEW SQLSTATE IS MAPPED HERE. `reveal_spin` RETURNS every business refusal as
 * `{ok:false, reason}`. Its one raised code, `IC911`, is genuine CORRUPTION — a `revealed_at` that
 * was written directly with the service key, leaving the revealed set a non-prefix — and it is
 * deliberately NOT translated into a friendly reason: it arrives as a transport `error` and falls
 * into `write_failed`, which is a 500, which is correct for "the published spin order is already
 * broken". Do NOT map another lib's codes (IC901–IC910 belong to walkover/approve/rollback/
 * manual-score/fair-seed/ceremony-transition).
 *
 * ⚠ THIS COMMAND HAS VIEWER-VISIBLE CONSEQUENCES, and they are the only ones Story 6.8b ships:
 * revealed rows become readable, and one `award_reveal` entry appears in the timeline feed per
 * reveal — through a reader branch Story 5.6 already built and tested. `/ceremonia` remains the
 * Story-5.7 placeholder until Story 6.10; the wheel, the verify strip and `Verificar la ceremonia`
 * are 6.10/6.9's. This story adds no viewer UI and no new Spanish copy.
 */

/** The RPC's typed reply. */
interface RpcResult {
  ok: boolean;
  reason?: string;
  ceremony_id?: number;
  spin_id?: number;
  spin_index?: number;
  kind?: string;
  revealed_at?: string;
  revealed_spins?: number;
  total_spins?: number;
  awards?: number;
  winners?: number;
  ceremony_state?: string;
  ceremony_complete?: boolean;
  expected_spin_index?: number;
}

/**
 * Every reason the RPC can RETURN — and the SINGLE SOURCE of the refusal union below.
 * A reason outside this set is not trusted; the lib fails closed to `write_failed`.
 *
 * ⭐⭐ THE `as const` AND THE DERIVED TYPE ARE LOAD-BEARING, AND THIS IS A CODE-REVIEW FIX (2026-08-08).
 * This was `new Set([...])`, which infers `Set<string>`, and the refusal branch then cast the reason
 * with a bare `as`. Both cross-checks at the bottom of reveal.test.ts read this Set and the migration's
 * `prosrc`, so a SEVENTH SQL reason was forced INTO THE SET — but nothing forced it into the union,
 * because the cast is unchecked. It compiled, `STATUS_FOR` (keyed on the unchanged union) had no entry,
 * and `command-route.ts:106`'s `?? 500` backstop shipped a typed business refusal as an opaque 500 —
 * making the route's own "a reason with no status entry is a COMPILE error" comment FALSE on exactly
 * the path it was written for. Deriving the union FROM the set makes that impossible: add an entry here
 * and `STATUS_FOR` stops compiling until it is mapped.
 * ⛔ Do not add an inline `'quoted_snake_case'` token to a comment in this block — `libReasons()` in
 * reveal.test.ts strips comment LINES, but a trailing comment on a value line would be read as data.
 */
const REVEAL_REASONS = new Set([
  'no_ceremony',
  'ceremony_not_spinning',
  'bundle_not_published',
  'no_such_spin',
  'already_revealed',
  'out_of_order',
  'unknown_actor',
] as const);

/**
 * The refusals the SQL returns (derived, never hand-copied), plus the lib's own fail-closed reason.
 * - no_ceremony — no such ceremony, or it was deleted between the peek and the lock
 * - ceremony_not_spinning — the run is not persisted yet, or the ceremony is already complete
 * - bundle_not_published — ⛔ ADDED BY STORY 6.9a (migration 0029, AC4). No reveal may happen until
 *   `publish_bundle` has committed the ceremony's canonical bytes, because a commitment chosen after
 *   an outcome is known commits to nothing. It is the mirror of `publish_bundle`'s own
 *   `reveal_in_progress`: one closes publish-after-reveal, this closes reveal-before-publish, and
 *   either alone leaves the other order legal.
 * - no_such_spin — this ceremony has no spin at that index
 * - already_revealed — ⛔ a double-tap REFUSES rather than being idempotent (R9, Cuatro 2026-08-08)
 * - out_of_order — ⛔ the published spin order IS the reveal order (UX-DR32/42)
 * - unknown_actor — the acting steamid64 is not a player; refused before any write (AD-17)
 * - write_failed — the lib's OWN reason: a transport error, a null reply, an unrecognised refusal or a
 *   malformed ok payload. Never returned by the SQL, and reveal.test.ts asserts that in both directions.
 */
type RevealRefusalReason = (typeof REVEAL_REASONS extends ReadonlySet<infer R> ? R : never) | 'write_failed';

/**
 * Membership test that NARROWS. The widening cast is on the SET, not on the value — safe, because
 * `ReadonlySet<string>.has` only reads — so the reason that flows out is narrowed by real membership
 * rather than by an unchecked assertion on an untrusted string.
 */
const isRefusalReason = (v: string): v is Exclude<RevealRefusalReason, 'write_failed'> =>
  (REVEAL_REASONS as ReadonlySet<string>).has(v);

export type RevealSpinResult =
  | {
      ok: true;
      spinId: number;
      spinIndex: number;
      kind: string;
      revealedAt: string;
      revealedSpins: number;
      totalSpins: number;
      awards: number;
      winners: number;
      ceremonyState: string;
      ceremonyComplete: boolean;
    }
  | {
      ok: false;
      reason: RevealRefusalReason;
      /** `out_of_order` only — the index the admin should press INSTEAD. See the header. */
      expectedSpinIndex?: number;
      /** `already_revealed` only — when that spin was actually revealed. */
      revealedAt?: string;
    };

/** Reveal the next spin of a running ceremony. */
export async function revealSpin(
  admin: SupabaseClient,
  params: { actingAdmin: string; ceremonyId: number; spinIndex: number },
): Promise<RevealSpinResult> {
  const { data, error } = await admin.rpc('reveal_spin', {
    p_ceremony_id: params.ceremonyId,
    p_spin_index: params.spinIndex,
    p_actor: params.actingAdmin,
  });

  if (error) {
    console.error('[revealSpin] reveal_spin RPC failed:', error.message);
    return { ok: false, reason: 'write_failed' };
  }

  const result = data as RpcResult | null;
  if (!result?.ok) {
    const reason = result?.reason;
    if (reason && isRefusalReason(reason)) {
      // ⭐ CARRY THE REFUSAL'S CONTEXT (code-review fix, 2026-08-08). The RPC returns
      // `expected_spin_index` on `out_of_order` and `revealed_at` on `already_revealed`, 0028 says at the
      // site that "the expected index travels in the refusal so the admin (and 6.10's UI) learns what to
      // press instead of guessing", and pgTAP asserts it is there — but this branch used to return
      // `{ok:false, reason}` and drop both, so the documented affordance did not exist end to end and the
      // caller was told only "wrong index". Each field is copied ONLY when the RPC actually sent it, so a
      // refusal that carries no context stays exactly `{ok:false, reason}`.
      const refusal: Extract<RevealSpinResult, { ok: false }> = { ok: false, reason };
      if (typeof result.expected_spin_index === 'number') {
        refusal.expectedSpinIndex = result.expected_spin_index;
      }
      if (typeof result.revealed_at === 'string') {
        refusal.revealedAt = result.revealed_at;
      }
      return refusal;
    }
    return { ok: false, reason: 'write_failed' }; // fail closed on an unrecognised refusal
  }

  // Validate the ok-payload's shape before trusting it (the 4.1 review lesson, re-applied at 6.1 and
  // 6.2). A reveal reported as successful with an `undefined` spin id or a missing `revealed_at` is
  // exactly the class of silent success an admin must never see — and here it would also mean the
  // caller cannot tell whether the ceremony just completed, which is the one fact that decides
  // whether there is another spin to press at all.
  if (
    typeof result.spin_id !== 'number' ||
    typeof result.spin_index !== 'number' ||
    typeof result.kind !== 'string' ||
    typeof result.revealed_at !== 'string' ||
    typeof result.revealed_spins !== 'number' ||
    typeof result.total_spins !== 'number' ||
    typeof result.awards !== 'number' ||
    typeof result.winners !== 'number' ||
    typeof result.ceremony_state !== 'string' ||
    typeof result.ceremony_complete !== 'boolean'
  ) {
    console.error('[revealSpin] ok reply missing a usable field:', result);
    return { ok: false, reason: 'write_failed' };
  }

  return {
    ok: true,
    spinId: result.spin_id,
    spinIndex: result.spin_index,
    kind: result.kind,
    revealedAt: result.revealed_at,
    revealedSpins: result.revealed_spins,
    totalSpins: result.total_spins,
    awards: result.awards,
    winners: result.winners,
    ceremonyState: result.ceremony_state,
    ceremonyComplete: result.ceremony_complete,
  };
}
