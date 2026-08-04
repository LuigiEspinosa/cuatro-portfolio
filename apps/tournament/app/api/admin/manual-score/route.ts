import { type NextRequest } from 'next/server';
import { handleAdminCommand, isPositiveInt } from '@/lib/admin/command-route';
import { manualResolveMatch, type ManualResolveMatchResult } from '@/lib/match/manual-score';

// Service-role writes + the per-request admin gate need Node APIs; never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/manual-score — the manual score override (Story 4.8, AC1/AC2). The manual side of FR-16.
 *
 * ⚠ THE PATH mirrors POST /api/admin/approve + /api/admin/rollback (DECISION G) — a manual resolution is
 * approve's manual sibling, so it sits at `api/admin/`, symmetric with them, NOT under `api/admin/match/`.
 * ⚠ Story 4.9 CORRECTS the epics.md:812 audited-route list, which omitted manual-score (and accept-anomaly).
 *
 * On a demo-less (`declared`/`live`) match, one tap writes the hand-entered score + `state='manual_resolved'`,
 * advances the bracket, posts one timeline_feed entry, and emits one `match.manual_resolved` Broadcast — all in
 * ONE DB transaction (AD-6). On a demo-bound (`pending`) match it is an AUDITED override (`override:true`) that
 * discards the demo's score, gated by the DB's audit-row-as-precondition trigger.
 *
 * Thin definition over the shared `handleAdminCommand` envelope (Story 4.9) — the gate/body-parse/500 boundary
 * live there. All command logic lives in lib/match/manual-score.ts (Vitest) + migration 0019 (pgTAP).
 * `requireAdmin` is the authorization gate; the RPC's service-role-only EXECUTE grant is the second lock; the
 * DB's whole-bracket lock, AD-5 override rule, override-audit gate and {ok:false}-advance rollback are the teeth.
 *
 * Body: `{ match_id, score_a, score_b, override? }` — the winner is DERIVED from the score, never supplied.
 * Returns JSON — a machine surface, no i18n (Epic 5 owns Spanish). CSRF is deferred to Epic 7, uniformly.
 */

// ⚠ The Extract<> typing is LOAD-BEARING: a reason with no status entry is a COMPILE error, so a new refusal
// can never silently fall through to an undefined status.
const STATUS_FOR: Record<Extract<ManualResolveMatchResult, { ok: false }>['reason'], number> = {
  bad_match: 404,
  ceremony_locked: 409, // AD-15: the ceremony is locked and the snapshot frozen — a hand-entered result is refused before any write
  not_manual_resolvable: 409, // state is not declared/live/pending — nothing else can be hand-resolved
  undetermined: 409, // a competitor seat is NULL — no winner to derive
  format_not_declared: 409, // the format was never locked (AD-10)
  tied: 409, // score_a = score_b — a draw cannot advance a double-elim bracket
  override_required: 409, // a demo is bound — pass override:true (an audited override) to discard its score
  nothing_to_override: 409, // override:true on a no-demo match — nothing to override
  advance_refused: 409, // the advance was refused (a destination seat is taken) — the whole resolution rolled back
  bad_score: 422, // a score is missing/negative/non-int
  override_not_audited: 500, // IC907: the override gate refused — should never surface (the RPC writes the row)
  write_failed: 500,
};

interface ManualScoreBody {
  match_id: number;
  score_a: number;
  score_b: number;
  override: boolean;
}

// A score is a NON-NEGATIVE integer (0 is a valid CS score). Rejects negatives / non-ints / NaN → 400, and caps
// at INT4_MAX: score_a/score_b are `int4` in the RPC signature + `match` (0010:66), so a value in the
// (2^31-1, 2^53-1] band would pass a bare MAX_SAFE_INTEGER check but overflow the argument at the PostgREST
// boundary (22003) BEFORE the RPC's `bad_score` guard runs — surfacing as an opaque 500 rather than a clean 400.
// Capping here is what actually makes "never lets a garbage score reach it" true. The RPC's `bad_score` guard
// stays the authority for null/negative. (match_id uses the shared isPositiveInt from the 4.9 helper.)
const INT4_MAX = 2147483647;
const isScore = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= INT4_MAX;

/** Validate the body. Returns null on anything malformed (→ 400, no write). `override` defaults to false. */
function parseBody(raw: unknown): ManualScoreBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { match_id, score_a, score_b, override } = raw as Record<string, unknown>;
  if (!isPositiveInt(match_id)) return null;
  if (!isScore(score_a) || !isScore(score_b)) return null;
  if (override !== undefined && typeof override !== 'boolean') return null;
  return { match_id, score_a, score_b, override: override === true };
}

export function POST(request: NextRequest) {
  return handleAdminCommand<ManualScoreBody, ManualResolveMatchResult>(request, {
    parseBody,
    // Actor is ALWAYS the authenticated admin (never from the body).
    run: (admin, gate, body) =>
      manualResolveMatch(admin, {
        actingAdmin: gate.steamid64,
        matchId: body.match_id,
        scoreA: body.score_a,
        scoreB: body.score_b,
        override: body.override,
      }),
    statusFor: STATUS_FOR,
    ok: (r) => ({
      ok: true,
      state: r.state,
      score_a: r.scoreA,
      score_b: r.scoreB,
      winner_entry: r.winnerEntry,
      override: r.override,
      advanced: r.advanced,
      champion: r.champion,
    }),
    logLabel: 'api/admin/manual-score',
  });
}
