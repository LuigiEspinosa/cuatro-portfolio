import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  setRegistrationOpen,
  resolveOpenTournament,
  enrollSelf,
  adminAddPlayer,
  removePlayer,
} from '@/lib/roster';

const ADMIN = '76561198388441171';
const TARGET = '76561198000000000';
const T_ID = 7;

/**
 * A chainable + thenable PostgrestFilterBuilder stub. Every filter/select/write method returns the
 * same builder (so chains compose) and records its call; awaiting the builder (`.then`) or calling
 * `.maybeSingle()` resolves to the configured `result`. Records each op globally so tests can assert
 * the exact write shape, the audit row, or that a write NEVER happened on a refusal.
 */
interface QueryBuilder {
  select: (...a: unknown[]) => QueryBuilder;
  eq: (...a: unknown[]) => QueryBuilder;
  in: (...a: unknown[]) => QueryBuilder;
  update: (...a: unknown[]) => QueryBuilder;
  insert: (...a: unknown[]) => QueryBuilder;
  upsert: (...a: unknown[]) => QueryBuilder;
  delete: (...a: unknown[]) => QueryBuilder;
  maybeSingle: () => Promise<unknown>;
  then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => Promise<unknown>;
}

/**
 * Build a service-role client mock. `plan` maps a table name to a queue of results returned by
 * successive `from(table)` chains (resolved via await or `.maybeSingle()`). A missing/empty queue
 * yields `{ data: null, error: null }`.
 */
function makeAdmin(plan: Record<string, Array<{ data?: unknown; error?: unknown }>> = {}) {
  const ops: { table: string; method: string; args: unknown[] }[] = [];
  const queues: Record<string, Array<{ data?: unknown; error?: unknown }>> = {};
  for (const [t, rs] of Object.entries(plan)) queues[t] = [...rs];

  function makeBuilder(table: string, result: { data?: unknown; error?: unknown }): QueryBuilder {
    const builder = {} as QueryBuilder;
    const rec =
      (method: string) =>
      (...args: unknown[]) => {
        ops.push({ table, method, args });
        return builder;
      };
    builder.select = rec('select');
    builder.eq = rec('eq');
    builder.in = rec('in');
    builder.update = rec('update');
    builder.insert = rec('insert');
    builder.upsert = rec('upsert');
    builder.delete = rec('delete');
    builder.maybeSingle = () => {
      ops.push({ table, method: 'maybeSingle', args: [] });
      return Promise.resolve(result);
    };
    builder.then = (onF, onR) => Promise.resolve(result).then(onF, onR);
    return builder;
  }

  const from = vi.fn((table: string) => {
    const q = queues[table];
    const result = q && q.length ? q.shift()! : { data: null, error: null };
    return makeBuilder(table, result);
  });
  const admin = { from } as unknown as SupabaseClient;

  const opsFor = (table: string, method: string) =>
    ops.filter((o) => o.table === table && o.method === method);
  return { admin, from, ops, opsFor };
}

describe('setRegistrationOpen (AC1 — the registration window + the lock + audit)', () => {
  it('opens registration: closed → open, and writes an open_registration audit row', async () => {
    const { admin, opsFor } = makeAdmin({
      tournament: [
        { data: { state: 'registration_closed' }, error: null }, // read (maybeSingle)
        { data: [{ id: T_ID }], error: null }, // the guarded update .select('id') → 1 row
      ],
      audit_log: [{ error: null }],
    });
    const result = await setRegistrationOpen(admin, { actingAdmin: ADMIN, tournamentId: T_ID, open: true });
    expect(result).toEqual({ ok: true, state: 'registration_open' });

    const update = opsFor('tournament', 'update');
    expect(update).toHaveLength(1);
    expect(update[0].args[0]).toEqual({ state: 'registration_open' });

    const audit = opsFor('audit_log', 'insert');
    expect(audit).toHaveLength(1);
    expect(audit[0].args[0]).toMatchObject({
      tournament_id: T_ID,
      actor_steamid64: ADMIN,
      action: 'open_registration',
      detail: { before: 'registration_closed', after: 'registration_open' },
    });
  });

  it('closes registration: open → closed, and writes a close_registration audit row', async () => {
    const { admin, opsFor } = makeAdmin({
      tournament: [
        { data: { state: 'registration_open' }, error: null },
        { data: [{ id: T_ID }], error: null },
      ],
      audit_log: [{ error: null }],
    });
    const result = await setRegistrationOpen(admin, { actingAdmin: ADMIN, tournamentId: T_ID, open: false });
    expect(result).toEqual({ ok: true, state: 'registration_closed' });
    expect(opsFor('tournament', 'update')[0].args[0]).toEqual({ state: 'registration_closed' });
    expect(opsFor('audit_log', 'insert')[0].args[0]).toMatchObject({ action: 'close_registration' });
  });

  it('returns bad_tournament when the tournament does not exist (no update, no audit)', async () => {
    const { admin, opsFor } = makeAdmin({ tournament: [{ data: null, error: null }] });
    const result = await setRegistrationOpen(admin, { actingAdmin: ADMIN, tournamentId: 999, open: true });
    expect(result).toEqual({ ok: false, reason: 'bad_tournament' });
    expect(opsFor('tournament', 'update')).toHaveLength(0);
    expect(opsFor('audit_log', 'insert')).toHaveLength(0);
  });

  it('returns locked when the tournament is already bracket_live (before any update — the lock)', async () => {
    const { admin, opsFor } = makeAdmin({ tournament: [{ data: { state: 'bracket_live' }, error: null }] });
    const result = await setRegistrationOpen(admin, { actingAdmin: ADMIN, tournamentId: T_ID, open: true });
    expect(result).toEqual({ ok: false, reason: 'locked' });
    expect(opsFor('tournament', 'update')).toHaveLength(0);
    expect(opsFor('audit_log', 'insert')).toHaveLength(0);
  });

  it('returns locked when the guarded update affects 0 rows (raced past the lock to bracket_live)', async () => {
    const { admin, opsFor } = makeAdmin({
      tournament: [
        { data: { state: 'registration_open' }, error: null }, // read says mutable…
        { data: [], error: null }, // …but the WHERE-guarded update hits 0 rows
      ],
    });
    const result = await setRegistrationOpen(admin, { actingAdmin: ADMIN, tournamentId: T_ID, open: false });
    expect(result).toEqual({ ok: false, reason: 'locked' });
    expect(opsFor('audit_log', 'insert')).toHaveLength(0); // no audit on a failed write
  });
});

describe('resolveOpenTournament (AC1 — the self-enroll state gate)', () => {
  it('returns the single registration_open tournament', async () => {
    const { admin } = makeAdmin({ tournament: [{ data: [{ id: T_ID }], error: null }] });
    expect(await resolveOpenTournament(admin)).toEqual({ ok: true, id: T_ID });
  });

  it('returns registration_not_open when none is open', async () => {
    const { admin } = makeAdmin({ tournament: [{ data: [], error: null }] });
    expect(await resolveOpenTournament(admin)).toEqual({ ok: false, reason: 'registration_not_open' });
  });

  it('fails closed (ambiguous_tournament) when more than one is open (should not happen in v1)', async () => {
    const { admin } = makeAdmin({ tournament: [{ data: [{ id: 1 }, { id: 2 }], error: null }] });
    expect(await resolveOpenTournament(admin)).toEqual({ ok: false, reason: 'ambiguous_tournament' });
  });

  it('returns read_failed on a read error (fail-closed)', async () => {
    const { admin } = makeAdmin({ tournament: [{ data: null, error: { message: 'boom' } }] });
    expect(await resolveOpenTournament(admin)).toEqual({ ok: false, reason: 'read_failed' });
  });
});

describe('enrollSelf (AC5 — a player enrolls THEMSELVES; reactivate-on-conflict)', () => {
  it('upserts on (tournament_id,steamid64) with status=active (reactivates a removed self)', async () => {
    const { admin, opsFor } = makeAdmin({ roster_entry: [{ error: null }] });
    const result = await enrollSelf(admin, { steamid64: TARGET, tournamentId: T_ID });
    expect(result).toEqual({ ok: true });
    const upsert = opsFor('roster_entry', 'upsert');
    expect(upsert).toHaveLength(1);
    expect(upsert[0].args[0]).toEqual({ tournament_id: T_ID, steamid64: TARGET, status: 'active' });
    expect(upsert[0].args[1]).toEqual({ onConflict: 'tournament_id,steamid64' });
  });

  it('maps a 23503 FK violation (no player row) to no_such_player (fail-closed)', async () => {
    const { admin } = makeAdmin({ roster_entry: [{ error: { code: '23503', message: 'fk' } }] });
    expect(await enrollSelf(admin, { steamid64: TARGET, tournamentId: T_ID })).toEqual({
      ok: false,
      reason: 'no_such_player',
    });
  });

  it('maps the D3 roster-lock trigger P0001 to locked, NOT write_failed (the race the trigger exists for)', async () => {
    // enrollSelf has no state check of its own — `resolveOpenTournament` is its gate, and that is a
    // check-then-write. If the bracket goes live in between, the trigger (migration 0011) is what stops
    // the write. That refusal MUST surface as `locked` (→ 409): mapping it to write_failed would report
    // the one code path D3 was built for as an internal server error.
    const { admin } = makeAdmin({ roster_entry: [{ error: { code: 'P0001', message: 'roster is frozen' } }] });
    expect(await enrollSelf(admin, { steamid64: TARGET, tournamentId: T_ID })).toEqual({
      ok: false,
      reason: 'locked',
    });
  });

  it('maps any other write error to write_failed', async () => {
    const { admin } = makeAdmin({ roster_entry: [{ error: { code: 'XYZ', message: 'boom' } }] });
    expect(await enrollSelf(admin, { steamid64: TARGET, tournamentId: T_ID })).toEqual({
      ok: false,
      reason: 'write_failed',
    });
  });
});

describe('adminAddPlayer (AC6 — admin add; allowed while closed; state gate before write)', () => {
  it('rejects a non-17-digit target BEFORE any DB call (bad_target)', async () => {
    const { admin, from } = makeAdmin();
    const result = await adminAddPlayer(admin, { actingAdmin: ADMIN, tournamentId: T_ID, steamid64: '123' });
    expect(result).toEqual({ ok: false, reason: 'bad_target' });
    expect(from).not.toHaveBeenCalled();
  });

  it('allows adding while registration_closed and writes an add_roster audit row', async () => {
    const { admin, opsFor } = makeAdmin({
      tournament: [{ data: { state: 'registration_closed' }, error: null }], // requireMutableTournament read
      roster_entry: [{ error: null }], // upsert
      audit_log: [{ error: null }],
    });
    const result = await adminAddPlayer(admin, { actingAdmin: ADMIN, tournamentId: T_ID, steamid64: TARGET });
    expect(result).toEqual({ ok: true });
    expect(opsFor('roster_entry', 'upsert')[0].args[1]).toEqual({ onConflict: 'tournament_id,steamid64' });
    expect(opsFor('audit_log', 'insert')[0].args[0]).toMatchObject({
      action: 'add_roster',
      actor_steamid64: ADMIN,
      detail: { steamid64: TARGET, status: 'active' },
    });
  });

  it('returns locked once bracket_live (no roster write, no audit)', async () => {
    const { admin, opsFor } = makeAdmin({ tournament: [{ data: { state: 'bracket_live' }, error: null }] });
    const result = await adminAddPlayer(admin, { actingAdmin: ADMIN, tournamentId: T_ID, steamid64: TARGET });
    expect(result).toEqual({ ok: false, reason: 'locked' });
    expect(opsFor('roster_entry', 'upsert')).toHaveLength(0);
    expect(opsFor('audit_log', 'insert')).toHaveLength(0);
  });

  it('returns bad_tournament when the tournament does not exist (no roster write)', async () => {
    const { admin, opsFor } = makeAdmin({ tournament: [{ data: null, error: null }] });
    const result = await adminAddPlayer(admin, { actingAdmin: ADMIN, tournamentId: 999, steamid64: TARGET });
    expect(result).toEqual({ ok: false, reason: 'bad_tournament' });
    expect(opsFor('roster_entry', 'upsert')).toHaveLength(0);
  });

  it('maps a 23503 FK violation to no_such_player', async () => {
    const { admin } = makeAdmin({
      tournament: [{ data: { state: 'registration_open' }, error: null }],
      roster_entry: [{ error: { code: '23503', message: 'fk' } }],
    });
    expect(
      await adminAddPlayer(admin, { actingAdmin: ADMIN, tournamentId: T_ID, steamid64: TARGET }),
    ).toEqual({ ok: false, reason: 'no_such_player' });
  });

  it('maps the D3 trigger P0001 to locked when a generate RACES past the read-gate', async () => {
    // ⭐ THIS is the TOCTOU D3 closes, and the exact shape of it: the read-gate below says the tournament
    // is still mutable, then a bracket generation COMMITS, and only then does the roster write land — where
    // the trigger blocks on the tournament lock, re-reads 'bracket_live', and rejects. Before the P0001
    // mapping this returned `write_failed` → HTTP 500: the single scenario the whole guard was built for
    // was the one that looked like a server crash.
    const { admin, opsFor } = makeAdmin({
      tournament: [{ data: { state: 'registration_open' }, error: null }], // the read says mutable…
      roster_entry: [{ error: { code: 'P0001', message: 'roster is frozen' } }], // …the trigger disagrees
    });
    expect(
      await adminAddPlayer(admin, { actingAdmin: ADMIN, tournamentId: T_ID, steamid64: TARGET }),
    ).toEqual({ ok: false, reason: 'locked' });
    expect(opsFor('audit_log', 'insert')).toHaveLength(0); // a refused write is never audited
  });
});

describe('removePlayer (AC3/AC6 — SOFT-delete; never DELETE; state gate + not_on_roster)', () => {
  it('soft-deletes (status=removed, never DELETE) and writes a remove_roster audit row', async () => {
    const { admin, opsFor } = makeAdmin({
      tournament: [{ data: { state: 'registration_open' }, error: null }],
      roster_entry: [{ data: [{ id: 1 }], error: null }], // update .select('id') → 1 row matched
      audit_log: [{ error: null }],
    });
    const result = await removePlayer(admin, { actingAdmin: ADMIN, tournamentId: T_ID, steamid64: TARGET });
    expect(result).toEqual({ ok: true });
    const update = opsFor('roster_entry', 'update');
    expect(update).toHaveLength(1);
    expect(update[0].args[0]).toEqual({ status: 'removed' });
    expect(opsFor('roster_entry', 'delete')).toHaveLength(0); // NEVER a hard delete (soft-delete only)
    expect(opsFor('audit_log', 'insert')[0].args[0]).toMatchObject({
      action: 'remove_roster',
      detail: { steamid64: TARGET, status: 'removed' },
    });
  });

  it('returns not_on_roster when the player has no row (0-row update, no audit)', async () => {
    const { admin, opsFor } = makeAdmin({
      tournament: [{ data: { state: 'registration_closed' }, error: null }],
      roster_entry: [{ data: [], error: null }],
    });
    const result = await removePlayer(admin, { actingAdmin: ADMIN, tournamentId: T_ID, steamid64: TARGET });
    expect(result).toEqual({ ok: false, reason: 'not_on_roster' });
    expect(opsFor('audit_log', 'insert')).toHaveLength(0);
  });

  it('maps the D3 trigger P0001 to locked — the soft-delete is an UPDATE, which the trigger also covers', async () => {
    const { admin, opsFor } = makeAdmin({
      tournament: [{ data: { state: 'registration_open' }, error: null }], // the read-gate says mutable…
      roster_entry: [{ error: { code: 'P0001', message: 'roster is frozen' } }], // …the trigger disagrees
    });
    const result = await removePlayer(admin, { actingAdmin: ADMIN, tournamentId: T_ID, steamid64: TARGET });
    expect(result).toEqual({ ok: false, reason: 'locked' });
    expect(opsFor('audit_log', 'insert')).toHaveLength(0);
  });

  it('returns locked once bracket_live (no roster update, no audit)', async () => {
    const { admin, opsFor } = makeAdmin({ tournament: [{ data: { state: 'bracket_live' }, error: null }] });
    const result = await removePlayer(admin, { actingAdmin: ADMIN, tournamentId: T_ID, steamid64: TARGET });
    expect(result).toEqual({ ok: false, reason: 'locked' });
    expect(opsFor('roster_entry', 'update')).toHaveLength(0);
  });

  it('rejects a non-17-digit target BEFORE any DB call (bad_target)', async () => {
    const { admin, from } = makeAdmin();
    const result = await removePlayer(admin, { actingAdmin: ADMIN, tournamentId: T_ID, steamid64: 'nope' });
    expect(result).toEqual({ ok: false, reason: 'bad_target' });
    expect(from).not.toHaveBeenCalled();
  });
});
