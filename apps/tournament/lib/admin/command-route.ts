import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin-guard';

/**
 * `handleAdminCommand` — the ONE audited-command-route envelope (Story 4.9, AC1). The literal deliverable the
 * codebase named for four stories ("Story 4.9 generalizes the audited-command-route boilerplate",
 * bracket/route.ts:19) and the STRONGEST form of AD-8's "no action can bypass authorization": a single
 * structural gate instead of eleven byte-repeated copies, each of which was its own chance for one to drift open.
 *
 * Every admin POST route was, before this, the SAME envelope — `getAdminClient()` → `createSupabaseServerClient()`
 * → `requireAdmin` (403 on failure) → `request.json()` try/catch (400 `invalid_json`) → `parseBody` (400
 * `invalid_body`) → the lib call → `{ error: reason }` at `statusFor[reason]` → the success payload → one outer
 * try/catch → `console.error('[api/admin/…]', err)` + 500 `internal_error`. Only four things differed per route:
 * the body shape, the lib call, the refusal→status map, and the success payload. Those are exactly the four
 * fields of `AdminCommandSpec`; everything else lives HERE, once.
 *
 * ⚠ THE ACTOR IS ALWAYS `gate.steamid64`, NEVER the body (AD-17 — an audit row's "who" must be the verified
 * session, or it is worthless). The helper threads it into `run`; a route cannot get it wrong.
 *
 * ⚠ This does NOT replace or wrap `requireAdmin` (lib/auth/admin-guard.ts, Story 2.4, Option A instant-revoke) —
 * it CALLS it. The gate primitive stays the single source of authorization truth; both its clients are
 * constructed here so the migrated routes hold no client-construction boilerplate.
 *
 * ⚠ EXCEPTION: `match/grace` is dual-verb (POST begin-grace + DELETE resume) and stays hand-written — it calls
 * `requireAdmin` on both verbs directly. The route-coverage test (lib/admin/route-coverage.test.ts) allows that
 * one file to reference `requireAdmin` instead of this helper; every other `route.ts` under `app/api/admin/`
 * MUST route through here, or CI reddens.
 */

/**
 * A shared positive-integer body validator (the correct, RANGE-CAPPED form). `Number.isInteger(1e21)` is TRUE
 * and `1e21 > 0`, so a bare `Number.isInteger` check lets an out-of-`bigint`-range id sail through, bind as a
 * bigint, and make PostgreSQL raise `22003` — surfacing as an opaque 500 where a malformed id is a 400. Capping
 * at `Number.MAX_SAFE_INTEGER` is what actually makes "a garbage id never reaches the RPC" true. This is the ONE
 * validator the deferred `bracket/route.ts:52` unbounded-integer gap folds into (deferred-work.md, 4.2 review).
 */
export const isPositiveInt = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= Number.MAX_SAFE_INTEGER;

/** Every lib command returns this discriminated shape: `{ok:true, …payload}` or `{ok:false, reason}`. */
type CommandResult = { ok: true } | { ok: false; reason: string };

/** The verified caller, threaded into `run`. `steamid64` is the actor for the audit row (AD-17). */
export interface AdminGate {
  steamid64: string;
}

export interface AdminCommandSpec<TBody, TResult extends CommandResult> {
  /** Validate the parsed JSON body. Return `null` on anything malformed → 400 `invalid_body`, no write. */
  parseBody: (raw: unknown) => TBody | null;
  /** Run the command. The injected `admin` is the service-role client; `gate.steamid64` is the actor. */
  run: (admin: SupabaseClient, gate: AdminGate, body: TBody) => Promise<TResult>;
  /** Map each refusal reason to an HTTP status. Keep the call-site type `Record<Extract<…,{ok:false}>['reason'], number>` for exhaustiveness. */
  statusFor: Record<string, number>;
  /** Shape the success (200) JSON payload from the ok result. */
  ok: (result: Extract<TResult, { ok: true }>) => Record<string, unknown>;
  /** OPTIONAL — shape the error JSON body. Defaults to `{ error: reason }`. Override only for a route that
   *  surfaces extra fields (e.g. rollback's `downstream_active` carries `blocking`). */
  errorBody?: (result: Extract<TResult, { ok: false }>) => Record<string, unknown>;
  /** The route's log tag, e.g. `api/admin/approve` — used for the 500 `console.error` line. */
  logLabel: string;
}

/**
 * Run one admin command through the shared envelope. In order: construct both clients; `requireAdmin` → 403 on
 * failure; parse the JSON body → 400 `invalid_json`; `parseBody` → 400 `invalid_body`; `run`; on `!ok` →
 * `errorBody` at `statusFor[reason]`; on ok → `ok(result)`; all inside one outer try/catch → 500 `internal_error`.
 */
export async function handleAdminCommand<TBody, TResult extends CommandResult>(
  request: NextRequest,
  spec: AdminCommandSpec<TBody, TResult>,
): Promise<NextResponse> {
  try {
    const admin = getAdminClient();
    const ssr = await createSupabaseServerClient();

    // AC1: the server-enforced admin gate. Non-admin → 403, before any read or write. requireAdmin re-reads the
    // authoritative app_role (Option A), so a revoked admin is rejected on their very next call.
    const gate = await requireAdmin(ssr, admin);
    if (!gate.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: gate.status });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }
    const body = spec.parseBody(raw);
    if (body === null) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    // The actor is ALWAYS the authenticated admin — never taken from the body (AD-17).
    const result: CommandResult = await spec.run(admin, { steamid64: gate.steamid64 }, body);
    if (!result.ok) {
      const failed = result as Extract<TResult, { ok: false }>;
      const errBody = spec.errorBody ? spec.errorBody(failed) : { error: result.reason };
      // `statusFor` is exhaustive at every call site via the Extract<> typing; `?? 500` is a defence-in-depth
      // backstop that can only trigger for a reason the caller forgot to map (a fail-closed 500, never undefined).
      return NextResponse.json(errBody, { status: spec.statusFor[result.reason] ?? 500 });
    }

    return NextResponse.json(spec.ok(result as Extract<TResult, { ok: true }>));
  } catch (err) {
    // One controlled fail-closed boundary around the WHOLE handler: a throw from client construction, the
    // requireAdmin gate's transport calls, or a `run` infra failure all land here as a JSON 500 — never Next's
    // default HTML error page.
    console.error(`[${spec.logLabel}] request failed:`, err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
