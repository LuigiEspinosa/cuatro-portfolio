import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseAdminAllowlist,
  resolveRole,
  setRole,
  healRoleMirror,
  type Role,
} from '@/lib/auth/roles';
import { steamEmail } from '@/lib/auth/session';

const ADMIN_ID = '76561198388441171';
const OTHER_ID = '76561198000000000';

describe('parseAdminAllowlist (AC2 / AC8a)', () => {
  it('parses a comma-separated list of 17-digit ids', () => {
    const set = parseAdminAllowlist(`${ADMIN_ID},${OTHER_ID}`);
    expect(set.has(ADMIN_ID)).toBe(true);
    expect(set.has(OTHER_ID)).toBe(true);
    expect(set.size).toBe(2);
  });

  it('trims whitespace around entries', () => {
    const set = parseAdminAllowlist(`  ${ADMIN_ID} , ${OTHER_ID}  `);
    expect(set.has(ADMIN_ID)).toBe(true);
    expect(set.has(OTHER_ID)).toBe(true);
  });

  it('ignores blanks and non-17-digit entries', () => {
    const set = parseAdminAllowlist(`${ADMIN_ID},,123,not-a-steamid,7656119838844117x`);
    expect(set.size).toBe(1);
    expect(set.has(ADMIN_ID)).toBe(true);
  });

  it('returns an empty set for undefined/empty (fail-closed → everyone viewer)', () => {
    expect(parseAdminAllowlist(undefined).size).toBe(0);
    expect(parseAdminAllowlist('').size).toBe(0);
  });
});

/** Minimal mock of the service-role client's `app_role` read/insert surface. */
function makeAdmin(opts: {
  existing?: { role: Role } | null;
  readError?: { message: string } | null;
  insertError?: { message: string; code?: string } | null;
}) {
  const insertCalls: unknown[] = [];
  const builder = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    async maybeSingle() {
      return { data: opts.existing ?? null, error: opts.readError ?? null };
    },
    async insert(row: unknown) {
      insertCalls.push(row);
      return { error: opts.insertError ?? null };
    },
  };
  const admin = { from: () => builder } as unknown as SupabaseClient;
  return { admin, insertCalls };
}

describe('resolveRole (AC2 / AC6 / AC8b)', () => {
  it('bootstraps an allowlisted id to admin and INSERTs the app_role row', async () => {
    const { admin, insertCalls } = makeAdmin({ existing: null });
    const role = await resolveRole(admin, ADMIN_ID, new Set([ADMIN_ID]));
    expect(role).toBe('admin');
    expect(insertCalls).toEqual([{ steamid64: ADMIN_ID, role: 'admin', granted_by: null }]);
  });

  it('defaults a non-allowlisted id to viewer and INSERTs the row', async () => {
    const { admin, insertCalls } = makeAdmin({ existing: null });
    const role = await resolveRole(admin, OTHER_ID, new Set([ADMIN_ID]));
    expect(role).toBe('viewer');
    expect(insertCalls).toEqual([{ steamid64: OTHER_ID, role: 'viewer', granted_by: null }]);
  });

  it('respects an existing app_role row over the allowlist (revoke durability)', async () => {
    // Id IS on the allowlist, but a prior row says viewer (e.g. a future 2.4 revoke) → viewer wins.
    const { admin, insertCalls } = makeAdmin({ existing: { role: 'viewer' } });
    const role = await resolveRole(admin, ADMIN_ID, new Set([ADMIN_ID]));
    expect(role).toBe('viewer');
    expect(insertCalls).toEqual([]); // never re-inserts / re-promotes
  });

  it('returns an existing admin row without touching the allowlist', async () => {
    const { admin, insertCalls } = makeAdmin({ existing: { role: 'admin' } });
    const role = await resolveRole(admin, ADMIN_ID, new Set());
    expect(role).toBe('admin');
    expect(insertCalls).toEqual([]);
  });

  it('throws on a hard read error (login fails closed)', async () => {
    const { admin } = makeAdmin({ readError: { message: 'connection reset' } });
    await expect(resolveRole(admin, ADMIN_ID, new Set([ADMIN_ID]))).rejects.toThrow(
      /app_role read failed/,
    );
  });
});

/** Mock the service-role `app_role` upsert surface for setRole. */
function makeRoleWriter(opts: { upsertError?: { message: string; code?: string } | null } = {}) {
  const upsertCalls: { row: Record<string, unknown>; options: unknown }[] = [];
  const builder = {
    async upsert(row: Record<string, unknown>, options: unknown) {
      upsertCalls.push({ row, options });
      return { error: opts.upsertError ?? null };
    },
  };
  const from = vi.fn(() => builder);
  const admin = { from } as unknown as SupabaseClient;
  return { admin, from, upsertCalls };
}

describe('setRole (AC5 / AC6 — durable role write + granted_by / no-self-grant)', () => {
  it('upserts on steamid64, stamping granted_by = actingAdmin + target/role, granted_at set', async () => {
    const { admin, upsertCalls } = makeRoleWriter();
    const result = await setRole(admin, { actingAdmin: ADMIN_ID, target: OTHER_ID, role: 'admin' });
    expect(result).toEqual({ ok: true });
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].row).toMatchObject({
      steamid64: OTHER_ID,
      role: 'admin',
      granted_by: ADMIN_ID,
    });
    expect(typeof upsertCalls[0].row.granted_at).toBe('string'); // refreshed on every write
    expect(upsertCalls[0].options).toEqual({ onConflict: 'steamid64' });
  });

  it('rejects a self-target BEFORE any DB call (no-self-grant → self_target)', async () => {
    const { admin, from } = makeRoleWriter();
    const result = await setRole(admin, { actingAdmin: ADMIN_ID, target: ADMIN_ID, role: 'viewer' });
    expect(result).toEqual({ ok: false, reason: 'self_target' });
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects a non-17-digit target BEFORE any DB call (bad_target)', async () => {
    const { admin, from } = makeRoleWriter();
    const result = await setRole(admin, { actingAdmin: ADMIN_ID, target: '123', role: 'admin' });
    expect(result).toEqual({ ok: false, reason: 'bad_target' });
    expect(from).not.toHaveBeenCalled();
  });

  it('maps a 23503 FK violation (target never logged in) to no_such_player', async () => {
    const { admin } = makeRoleWriter({
      upsertError: { message: 'insert or update violates foreign key', code: '23503' },
    });
    const result = await setRole(admin, { actingAdmin: ADMIN_ID, target: OTHER_ID, role: 'admin' });
    expect(result).toEqual({ ok: false, reason: 'no_such_player' });
  });

  it('maps any other write error to write_failed (fail-closed)', async () => {
    const { admin } = makeRoleWriter({ upsertError: { message: 'connection reset' } });
    const result = await setRole(admin, { actingAdmin: ADMIN_ID, target: OTHER_ID, role: 'viewer' });
    expect(result).toEqual({ ok: false, reason: 'write_failed' });
  });

  it('revoke path writes a viewer row (never deletes) so re-login stays durable', async () => {
    const { admin, upsertCalls } = makeRoleWriter();
    await setRole(admin, { actingAdmin: ADMIN_ID, target: OTHER_ID, role: 'viewer' });
    expect(upsertCalls[0].row).toMatchObject({ steamid64: OTHER_ID, role: 'viewer' });
  });
});

/** Mock the Auth Admin API (`listUsers` + `updateUserById`) for healRoleMirror. */
function makeAuthAdmin(
  opts: {
    pages?: { id: string; email: string }[][];
    updateError?: { message: string } | null;
    listError?: { message: string } | null;
  } = {},
) {
  const pages = opts.pages ?? [[]];
  const listUsers = vi.fn(async ({ page }: { page: number; perPage: number }) => ({
    data: { users: pages[page - 1] ?? [] },
    error: opts.listError ?? null,
  }));
  const updateUserById = vi.fn(async () => ({ error: opts.updateError ?? null }));
  const admin = { auth: { admin: { listUsers, updateUserById } } } as unknown as SupabaseClient;
  return { admin, listUsers, updateUserById };
}

describe('healRoleMirror (AC2 / AC6 — re-mint the app_metadata JWT mirror)', () => {
  it('finds the user by steamEmail(target) and updates app_metadata with BOTH keys', async () => {
    const { admin, updateUserById } = makeAuthAdmin({
      pages: [[{ id: 'uid-1', email: steamEmail(OTHER_ID) }]],
    });
    await healRoleMirror(admin, OTHER_ID, 'viewer');
    expect(updateUserById).toHaveBeenCalledWith('uid-1', {
      app_metadata: { steamid64: OTHER_ID, role: 'viewer' },
    });
  });

  it('no-ops cleanly when the target has no auth user yet (resolveRole binds on next login)', async () => {
    const { admin, updateUserById } = makeAuthAdmin({ pages: [[]] });
    await expect(healRoleMirror(admin, OTHER_ID, 'admin')).resolves.toBeUndefined();
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it('pages past a full first page to find a later user', async () => {
    const firstPage = Array.from({ length: 200 }, (_, i) => ({ id: `x${i}`, email: `x${i}@e` }));
    const { admin, updateUserById, listUsers } = makeAuthAdmin({
      pages: [firstPage, [{ id: 'uid-2', email: steamEmail(OTHER_ID) }]],
    });
    await healRoleMirror(admin, OTHER_ID, 'admin');
    expect(listUsers).toHaveBeenCalledTimes(2); // full page → keeps paging
    expect(updateUserById).toHaveBeenCalledWith('uid-2', {
      app_metadata: { steamid64: OTHER_ID, role: 'admin' },
    });
  });

  it('throws on a real updateUserById error (never silently swallows)', async () => {
    const { admin } = makeAuthAdmin({
      pages: [[{ id: 'uid-1', email: steamEmail(OTHER_ID) }]],
      updateError: { message: 'db down' },
    });
    await expect(healRoleMirror(admin, OTHER_ID, 'viewer')).rejects.toThrow(/updateUserById failed/);
  });

  it('throws on a real listUsers error and never reaches updateUserById (fail-closed, not a no-op)', async () => {
    // A listUsers infra error is NOT "user not found" — it must fail closed rather than
    // pretend-heal. Symmetric with the updateUserById-error case above.
    const { admin, updateUserById } = makeAuthAdmin({ listError: { message: 'auth db down' } });
    await expect(healRoleMirror(admin, OTHER_ID, 'admin')).rejects.toThrow(/listUsers failed/);
    expect(updateUserById).not.toHaveBeenCalled();
  });
});
