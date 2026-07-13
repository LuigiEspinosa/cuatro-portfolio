import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Roster membership + registration-window domain logic (Story 2.5, AC1/AC3/AC5/AC6/AC7).
 *
 * All writes go through the INJECTED service-role `admin` client (the single server-side writer,
 * AD-2 — there is no client write policy on roster_entry/tournament). Mirrors `lib/auth/roles.ts`:
 * injectable client, typed refusal unions the route maps to HTTP statuses, `STEAMID64_RE` guard
 * before any DB write, `23503` FK mapping, upsert-on-conflict reactivation.
 *
 * The registration/roster LOCK (AC3/AC7) is enforced HERE, not just in a route/UI: every
 * state-gated mutation reads/checks `tournament.state` against its allowed set before writing, and
 * the tournament state transition additionally carries a `WHERE state IN (...)` guard so even a
 * mis-ordered call after `bracket_live` writes nothing (a 0-row result → a typed refusal, never a
 * silent no-op). Removal is a SOFT-delete (status='removed', Decision 2) — the migration grants no
 * DELETE, so a hard delete is impossible even for the service role.
 *
 * Boundaries (Decision 3): self-enroll → `registration_open` only (enforced by
 * `resolveOpenTournament`, which only returns an open event); admin add/remove →
 * `state IN ('registration_open','registration_closed')` (admin may add after close, prd.md:150);
 * ALL mutations locked at `bracket_live`/`ceremony`/`closed`.
 */

const STEAMID64_RE = /^[0-9]{17}$/;
const FK_VIOLATION = '23503'; // roster_entry.steamid64 → player(steamid64): a target that never logged in

/**
 * The `roster_entry_lock` trigger's refusal (migration 0011, D3): the tournament is past
 * `registration_closed`, so the roster is frozen. This is the WRITE-SIDE half of the lock — the
 * `requireMutableTournament` read-check below is a friendly early exit, but it is a check-then-write, so
 * a generate that commits in between still lands here. That race is the entire reason the trigger exists,
 * and it MUST surface as the same typed `locked` refusal (→ 409) the un-raced path already returns.
 * Without this mapping it would fall through to `write_failed` → 500: the one code path D3 was built for
 * would be the one that reports an internal server error.
 */
const ROSTER_LOCKED = 'P0001';

/**
 * Classify a `roster_entry` write error into the typed refusal union. Shared by all three write paths
 * (`enrollSelf` / `adminAddPlayer` / `removePlayer`) so the trigger is mapped uniformly — the trigger
 * covers all three, so its refusal must too.
 *
 * NOTE on 23503: it is ambiguous by construction — both `steamid64 → player` and a non-existent
 * `tournament_id` raise it (0004_roster_test pins the latter), and the D3 trigger deliberately reuses it
 * for an absent-or-invisible tournament so those two indistinguishable cases report identically. In
 * practice every caller resolves the tournament BEFORE writing (`requireMutableTournament` /
 * `resolveOpenTournament`), so a 23503 reaching here is the player FK. Pre-existing, unchanged.
 */
function classifyRosterWriteError(code: string | undefined): 'locked' | 'no_such_player' | 'write_failed' {
  if (code === ROSTER_LOCKED) return 'locked';
  if (code === FK_VIOLATION) return 'no_such_player';
  return 'write_failed';
}

/** The tournament.state closed set (0001:29–30). Roster mutations are gated on it. */
export type RegistrationState =
  | 'registration_open'
  | 'registration_closed'
  | 'bracket_live'
  | 'ceremony'
  | 'closed';

// States in which the roster may still be mutated — i.e. BEFORE bracket generation. Self-enroll is
// further restricted to registration_open only (see `resolveOpenTournament` / the enroll route).
const ROSTER_MUTABLE_STATES: RegistrationState[] = ['registration_open', 'registration_closed'];

// ── Audit (Task 6 / Decision 4 / FR-33) ─────────────────────────────────────

type AuditAction = 'open_registration' | 'close_registration' | 'add_roster' | 'remove_roster';

/**
 * Append one `audit_log` row for an admin state-mutation. This is the FIRST real `audit_log` write:
 * 0003 created the table + the `service_role` INSERT grant, and `action` is uncapped `text` so these
 * new action strings need no migration (roster/registration actions are tournament-scoped, so the
 * 2.4 grant_role deferral-to-4.9 blocker does not apply). `actor_steamid64` = the acting admin (a
 * real `player`, so the `audit_log.actor_steamid64 → player` FK is satisfied). Self-enroll is a
 * player action and is deliberately NOT audited (AC7).
 *
 * Throws on a real insert error (fail-closed, don't-swallow — 2.4's discipline). It runs AFTER the
 * primary row write, which is idempotent (upsert / state UPDATE), so a retry after a 500 is safe.
 * Story 4.9 (server-gated AUDITED command routes) generalizes this into a reusable helper — 2.5
 * establishes the write, like 2.4's `requireAdmin` that Epic 4 reuses.
 */
async function writeAudit(
  admin: SupabaseClient,
  params: { tournamentId: number; actorSteamid64: string; action: AuditAction; detail: unknown },
): Promise<void> {
  const { error } = await admin.from('audit_log').insert({
    tournament_id: params.tournamentId,
    actor_steamid64: params.actorSteamid64,
    action: params.action,
    detail: params.detail,
  });
  if (error) {
    throw new Error(`writeAudit(${params.action}) failed: ${error.message}`);
  }
}

/**
 * Read a tournament's state and assert it is roster-mutable (before bracket generation). Fail-
 * closed: a read error → `write_failed`; no such row → `bad_tournament`; a locked state
 * (`bracket_live`/`ceremony`/`closed`) → `locked`. Shared by `adminAddPlayer` / `removePlayer` so
 * the lock is checked BEFORE any roster write.
 */
async function requireMutableTournament(
  admin: SupabaseClient,
  tournamentId: number,
): Promise<
  | { ok: true; state: RegistrationState }
  | { ok: false; reason: 'bad_tournament' | 'locked' | 'write_failed' }
> {
  const { data, error } = await admin
    .from('tournament')
    .select('state')
    .eq('id', tournamentId)
    .maybeSingle();
  if (error) {
    return { ok: false, reason: 'write_failed' };
  }
  if (!data) {
    return { ok: false, reason: 'bad_tournament' };
  }
  const state = data.state as RegistrationState;
  if (!ROSTER_MUTABLE_STATES.includes(state)) {
    return { ok: false, reason: 'locked' };
  }
  return { ok: true, state };
}

// ── Registration window (AC1) ───────────────────────────────────────────────

export type SetRegistrationResult =
  | { ok: true; state: 'registration_open' | 'registration_closed' }
  | { ok: false; reason: 'bad_tournament' | 'locked' | 'write_failed' };

/**
 * Open or close registration by transitioning `tournament.state` between `registration_open` ↔
 * `registration_closed` (AC1). The `WHERE state IN (mutable)` guard is the lock: it refuses to
 * (re)open/close once `bracket_live`+ (registration cannot re-open after the bracket goes live).
 * Reads the `before` state first (for the audit detail + to distinguish a missing tournament from a
 * locked one). On success writes the `open_registration`/`close_registration` audit row.
 */
export async function setRegistrationOpen(
  admin: SupabaseClient,
  params: { actingAdmin: string; tournamentId: number; open: boolean },
): Promise<SetRegistrationResult> {
  const { actingAdmin, tournamentId, open } = params;
  const nextState = open ? 'registration_open' : 'registration_closed';

  // Read the current state first: distinguishes bad_tournament (no row) from locked (row, wrong
  // state), and supplies the audit `before`.
  const { data: current, error: readError } = await admin
    .from('tournament')
    .select('state')
    .eq('id', tournamentId)
    .maybeSingle();
  if (readError) {
    return { ok: false, reason: 'write_failed' };
  }
  if (!current) {
    return { ok: false, reason: 'bad_tournament' };
  }
  const before = current.state as RegistrationState;
  if (!ROSTER_MUTABLE_STATES.includes(before)) {
    return { ok: false, reason: 'locked' }; // bracket_live / ceremony / closed — cannot re-open/close
  }

  // The WHERE state-guard is the real teeth: a concurrent transition to bracket_live between the
  // read and this write yields 0 rows → fail closed (never a silent no-op).
  const { data: updated, error: updateError } = await admin
    .from('tournament')
    .update({ state: nextState })
    .eq('id', tournamentId)
    .in('state', ROSTER_MUTABLE_STATES)
    .select('id');
  if (updateError) {
    return { ok: false, reason: 'write_failed' };
  }
  if (!updated || updated.length === 0) {
    return { ok: false, reason: 'locked' }; // raced past the lock → fail closed
  }

  await writeAudit(admin, {
    tournamentId,
    actorSteamid64: actingAdmin,
    action: open ? 'open_registration' : 'close_registration',
    detail: { before, after: nextState },
  });

  return { ok: true, state: nextState };
}

export type ResolveOpenResult =
  | { ok: true; id: number }
  | { ok: false; reason: 'registration_not_open' | 'ambiguous_tournament' | 'read_failed' };

/**
 * Resolve the tournament that is currently `registration_open` — the self-enroll state gate (AC1:
 * "players can enroll only while open"). v1 has exactly one event, so this returns it. Returns a
 * typed refusal instead of guessing: none open → `registration_not_open`; more than one open
 * (should not happen in v1) → `ambiguous_tournament` (fail closed); a read error → `read_failed`.
 */
export async function resolveOpenTournament(admin: SupabaseClient): Promise<ResolveOpenResult> {
  const { data, error } = await admin
    .from('tournament')
    .select('id')
    .eq('state', 'registration_open');
  if (error) {
    return { ok: false, reason: 'read_failed' };
  }
  const rows = data ?? [];
  if (rows.length === 0) {
    return { ok: false, reason: 'registration_not_open' };
  }
  if (rows.length > 1) {
    return { ok: false, reason: 'ambiguous_tournament' };
  }
  return { ok: true, id: rows[0].id as number };
}

// ── Enrollment / roster management (AC5, AC6) ────────────────────────────────

export type EnrollResult =
  | { ok: true }
  | { ok: false; reason: 'no_such_player' | 'locked' | 'write_failed' };

/**
 * Enroll the CALLER in a tournament (AC5). The `steamid64` is the caller's OWN verified id (from
 * `requireUser`), passed by the route — never a request-body value, so a player can only enroll
 * themselves. Upsert on `(tournament_id, steamid64)` setting `status='active'`: a re-enroll of a
 * previously-`removed` self REACTIVATES the row (idempotent; a duplicate active enroll is a harmless
 * no-op). No state check here — `resolveOpenTournament` (the route's prior step) is the "only while
 * open" gate, so `tournamentId` is already the open event. `23503` (no player row — should not
 * happen for a logged-in caller, but fail closed) → `no_such_player`; the D3 trigger's `P0001` (the
 * event went `bracket_live` between `resolveOpenTournament` and this write) → `locked`; else →
 * `write_failed`.
 *
 * ⚠ The upsert's ON CONFLICT does NOT make this immune to the trigger: a BEFORE-INSERT trigger fires
 * before the conflict is detected, so once the roster is frozen even a duplicate-enroll that WOULD have
 * been a harmless no-op is refused. That is correct — it is a write to a frozen roster — and it now
 * reports as `locked` (409) rather than a 500.
 */
export async function enrollSelf(
  admin: SupabaseClient,
  params: { steamid64: string; tournamentId: number },
): Promise<EnrollResult> {
  const { steamid64, tournamentId } = params;
  const { error } = await admin.from('roster_entry').upsert(
    { tournament_id: tournamentId, steamid64, status: 'active' },
    { onConflict: 'tournament_id,steamid64' },
  );
  if (error) {
    return { ok: false, reason: classifyRosterWriteError(error.code) };
  }
  return { ok: true };
}

export type AdminRosterResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'bad_target' | 'bad_tournament' | 'no_such_player' | 'not_on_roster' | 'locked' | 'write_failed';
    };

/**
 * Admin adds a player to the roster (AC6). Like `enrollSelf` but: `requireAdmin`-gated at the
 * route, the target `steamid64` comes from the request body (so it is `STEAMID64_RE`-guarded here →
 * `bad_target`), it is allowed while `state IN ('registration_open','registration_closed')` (admin
 * may add even after close — prd.md:150), and it writes an `add_roster` audit row. Same
 * reactivate-on-conflict semantics; `23503` → `no_such_player`.
 */
export async function adminAddPlayer(
  admin: SupabaseClient,
  params: { actingAdmin: string; tournamentId: number; steamid64: string },
): Promise<AdminRosterResult> {
  const { actingAdmin, tournamentId, steamid64 } = params;
  if (!STEAMID64_RE.test(steamid64)) {
    return { ok: false, reason: 'bad_target' };
  }
  // Lock check BEFORE any write (fail-closed): admin add is allowed only before bracket generation.
  const gate = await requireMutableTournament(admin, tournamentId);
  if (!gate.ok) {
    return gate; // bad_tournament | locked | write_failed
  }

  const { error } = await admin.from('roster_entry').upsert(
    { tournament_id: tournamentId, steamid64, status: 'active' },
    { onConflict: 'tournament_id,steamid64' },
  );
  if (error) {
    // Includes the D3 trigger's `locked`: the gate above is a check-then-write, so a generation that
    // commits in between still lands here — and the trigger blocks on it, then rejects.
    return { ok: false, reason: classifyRosterWriteError(error.code) };
  }

  await writeAudit(admin, {
    tournamentId,
    actorSteamid64: actingAdmin,
    action: 'add_roster',
    detail: { steamid64, status: 'active' },
  });
  return { ok: true };
}

/**
 * Admin removes a player from the roster (AC6, AC3). SOFT-delete: `UPDATE status='removed'` (never
 * `DELETE` — the migration grants no delete, so a hard delete is impossible even for the service
 * role). Allowed only before bracket generation (`registration_open`/`_closed`); refused once
 * `bracket_live`+ (`locked`). A 0-row update after passing the lock → `not_on_roster` (the player
 * has no row on this roster) — distinct from `locked`, which the state gate returns first. On
 * success writes the `remove_roster` audit row. The removed player disappears from every viewer
 * surface (the `status='active'` policy hides it) while the admin/history row persists (AC3).
 */
export async function removePlayer(
  admin: SupabaseClient,
  params: { actingAdmin: string; tournamentId: number; steamid64: string },
): Promise<AdminRosterResult> {
  const { actingAdmin, tournamentId, steamid64 } = params;
  if (!STEAMID64_RE.test(steamid64)) {
    return { ok: false, reason: 'bad_target' };
  }
  // Lock check BEFORE any write (fail-closed): removal is allowed only before bracket generation.
  const gate = await requireMutableTournament(admin, tournamentId);
  if (!gate.ok) {
    return gate; // bad_tournament | locked | write_failed
  }

  const { data: updated, error } = await admin
    .from('roster_entry')
    .update({ status: 'removed' })
    .eq('tournament_id', tournamentId)
    .eq('steamid64', steamid64)
    .select('id');
  if (error) {
    // Includes the D3 trigger's `locked` — the soft-delete is an UPDATE, which the trigger also covers.
    return { ok: false, reason: classifyRosterWriteError(error.code) };
  }
  if (!updated || updated.length === 0) {
    return { ok: false, reason: 'not_on_roster' }; // no matching row (state already confirmed mutable)
  }

  await writeAudit(admin, {
    tournamentId,
    actorSteamid64: actingAdmin,
    action: 'remove_roster',
    detail: { steamid64, status: 'removed' },
  });
  return { ok: true };
}
