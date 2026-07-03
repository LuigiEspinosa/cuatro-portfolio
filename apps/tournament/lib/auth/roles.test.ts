import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseAdminAllowlist, resolveRole, type Role } from '@/lib/auth/roles';

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
