import { type NextRequest } from 'next/server';
import { handleAdminCommand, isPositiveInt } from '@/lib/admin/command-route';
import { declareMatchFormat, type FormatCommandResult } from '@/lib/match/format';

// Service-role writes + the per-request admin gate need Node APIs; never statically prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/match/format — declare (or audit-override) a match's format + tie policy (Story 4.2).
 *
 * The AD-10 lock: `format` and `tie_policy` are frozen BEFORE a match may go live, and a later change is
 * only ever an explicit audited override — never a silent edit.
 *
 * Thin definition over the shared `handleAdminCommand` envelope (Story 4.9) — the gate/body-parse/500 boundary
 * live there. All command logic lives in `lib/match/format.ts` (Vitest) and migration 0012 (pgTAP).
 * `requireAdmin` is the authorization gate (server-side app_role re-read = instant revoke); the RPC's
 * service-role-only EXECUTE grant is the second lock on the same door; and the DB's CHECK constraints +
 * `match_format_lock` trigger are the teeth that bite even the service role.
 *
 * Body: `{ tournament_id, format, tie_policy, match_ids?, override? }`.
 *   * OMIT `match_ids` to declare the WHOLE tournament (every still-`declared`, unlocked match) in one
 *     call. This is the normal path — an 11-player field is 30 match rows.
 *   * `override: true` REQUIRES explicit `match_ids` (you do not bulk-override a live bracket by
 *     accident) and writes an `audit_log` row per match plus `match.format_overridden_at`.
 *
 * Returns JSON — a machine surface, no i18n (the precedent is app/api/admin/registration/route.ts:19).
 * The Spanish admin console is Epic 5. CSRF is deferred to Epic 7, uniformly across all admin routes.
 */

const STATUS_FOR: Record<Extract<FormatCommandResult, { ok: false }>['reason'], number> = {
  bad_tournament: 404,
  bad_match: 404, // an id that does not name a match of THIS tournament
  bad_format: 422, // a well-formed request naming a format that is not in the catalog
  override_needs_ids: 422, // override=true with no match_ids — well-formed, but not a thing you may ask for
  not_declarable: 409, // a targeted match is a bye/void/forfeit/live row — declaring it would latch it forever
  already_locked: 409, // the format is frozen; changing it is an override, not a re-declare
  not_overridable: 409, // override=true on a match that was never locked — that is a first declare
  no_eligible_matches: 409, // nothing left to declare (idempotent re-run) — an honest refusal, not a no-op
  write_failed: 500,
};

interface FormatBody {
  tournament_id: number;
  match_ids?: number[];
  format: string;
  tie_policy: string;
  override?: boolean;
}

/**
 * A bracket is `2 · bracketSize − 2` matches, so even a 64-player field is 126. This is a foot-gun guard,
 * not a business rule: without it a 100k-element array becomes a 100k `unnest`, a 100k-row `FOR UPDATE` and
 * 100k audit inserts inside one transaction, holding locks on `match` throughout.
 */
const MAX_MATCH_IDS = 256;

/** Validate the body. Returns null on anything malformed (→ 400, no write). Every id uses the shared,
 *  range-capped `isPositiveInt` (Story 4.9) — `Number.isInteger(1e21)` is TRUE, so the cap is load-bearing. */
function parseBody(raw: unknown): FormatBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { tournament_id, match_ids, format, tie_policy, override } = raw as Record<string, unknown>;

  if (!isPositiveInt(tournament_id)) return null;

  // The VOCABULARY is checked in lib/match/format.ts (→ a typed `bad_format`, 422). Here we only check
  // the SHAPE: a non-string is a malformed body (400), an unknown string is a bad format (422).
  if (typeof format !== 'string' || typeof tie_policy !== 'string') return null;

  if (override !== undefined && typeof override !== 'boolean') return null;

  let ids: number[] | undefined;
  if (match_ids !== undefined) {
    // An EMPTY array is ambiguous with the bulk path ("declare nothing" vs "declare everything") — refuse
    // it rather than guess, because guessing wrong here silently declares a whole bracket.
    if (!Array.isArray(match_ids) || match_ids.length === 0) return null;
    if (match_ids.length > MAX_MATCH_IDS) return null;
    if (!match_ids.every(isPositiveInt)) return null;
    ids = match_ids as number[];
  }

  return {
    tournament_id,
    format,
    tie_policy,
    ...(ids !== undefined && { match_ids: ids }),
    ...(override !== undefined && { override }),
  };
}

export function POST(request: NextRequest) {
  return handleAdminCommand<FormatBody, FormatCommandResult>(request, {
    parseBody,
    run: (admin, gate, body) =>
      declareMatchFormat(admin, {
        actingAdmin: gate.steamid64,
        tournamentId: body.tournament_id,
        matchIds: body.match_ids,
        format: body.format,
        tiePolicy: body.tie_policy,
        override: body.override,
      }),
    statusFor: STATUS_FOR,
    ok: (r) => ({
      ok: true,
      declared: r.declared,
      override: r.override,
    }),
    logLabel: 'api/admin/match/format',
  });
}
