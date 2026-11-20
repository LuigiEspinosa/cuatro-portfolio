// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main, mapIdentities, toTsv, fromTsv, verifyExistingUser } from '../tournament-identity.mjs';

// Story 3-7: the tournament's identity export-and-map and its authenticate-as-an-existing-user check.
// The export's refusals are held on rows shaped as its query returns them, and the check against a planted
// Supabase that answers as GoTrue and PostgREST do. The real query runs against a real Postgres in the
// block at the end (Story 9-8); the real check needs the target's keys, so it is the Operator's to run.

const ADMIN = '76561198000000001';
const VIEWER = '76561198000000002';
const row = (steamid64: string, extra: Record<string, unknown> = {}) => ({
  id: `uuid-${steamid64}`,
  email: `${steamid64}@steam.inclusivcup.local`,
  has_password: false,
  claimed: steamid64,
  role: 'viewer',
  display_name: 'Player',
  ...extra,
});

describe('mapIdentities', () => {
  it('maps every Steam user to their steamid64 and role', () => {
    const { mapped, refused } = mapIdentities([row(ADMIN, { role: 'admin', display_name: 'A\tB' }), row(VIEWER, { claimed: null })]);
    expect(refused).toEqual([]);
    expect(mapped).toEqual([
      { id: `uuid-${ADMIN}`, steamid64: ADMIN, role: 'admin', display_name: 'A B' },
      { id: `uuid-${VIEWER}`, steamid64: VIEWER, role: 'viewer', display_name: 'Player' },
    ]);
    expect(fromTsv(toTsv(mapped))).toEqual(mapped);
  });

  it('refuses a password hash, an unmappable email and a claim the email contradicts, naming each user', () => {
    const { mapped, refused } = mapIdentities([
      row(ADMIN, { has_password: true }),
      row(VIEWER, { email: 'someone@example.com' }),
      row('76561198000000003', { claimed: VIEWER }),
    ]);
    expect(mapped).toEqual([]);
    expect(refused).toEqual([
      `user uuid-${ADMIN} holds a password hash, so the move could force a reset`,
      `user uuid-${VIEWER} has an email that maps to no steamid64`,
      `user uuid-76561198000000003 claims steamid64 ${VIEWER} but its email names 76561198000000003`,
    ]);
  });

  it('writes no mapping when any user is refused', async () => {
    const result = await main(['export'], { TOURNAMENT_SOURCE_DATABASE_URL: 'postgresql://planted' }, {
      fetch,
      query: () => JSON.stringify([row(ADMIN), row(VIEWER, { has_password: true })]),
    });
    expect(result.code).toBe(1);
    expect(result.message).not.toContain(ADMIN);
  });
});

/** A target Supabase: one player per entry here, GoTrue's admin and verify routes, and the two RPCs. */
function target(state: { players: Record<string, string>; authUsers: Set<string>; jwtSteamid?: string }) {
  const calls: string[] = [];
  let claim: { steamid64: string; role: string } | undefined;
  const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  const planted = (async (input: string, init: RequestInit) => {
    const url = new URL(input);
    const route = `${init.method} ${url.pathname}`;
    calls.push(route);
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    const steamid = url.searchParams.get('steamid64')?.replace('eq.', '') ?? '';
    switch (route) {
      case 'GET /rest/v1/player':
        return answer(200, steamid in state.players ? [{ steamid64: steamid }] : []);
      case 'GET /rest/v1/app_role':
        return answer(200, state.players[steamid] ? [{ role: state.players[steamid] }] : []);
      case 'POST /auth/v1/admin/users':
        if (state.authUsers.has(body.email)) return answer(422, { error_code: 'email_exists', msg: 'A user with this email address has already been registered' });
        state.authUsers.add(body.email);
        return answer(200, { id: 'uuid-new' });
      case 'POST /auth/v1/admin/generate_link':
        return answer(200, { id: 'uuid-existing', hashed_token: 'token' });
      case 'PUT /auth/v1/admin/users/uuid-existing':
        claim = body.app_metadata;
        return answer(200, {});
      case 'POST /auth/v1/verify':
        return body.token_hash === 'token' ? answer(200, { access_token: 'jwt' }) : answer(403, { msg: 'invalid' });
      case 'POST /rest/v1/rpc/jwt_steamid64':
        return answer(200, state.jwtSteamid ?? claim?.steamid64);
      case 'POST /rest/v1/rpc/is_admin':
        return answer(200, claim?.role === 'admin');
      default:
        return answer(404, { msg: route });
    }
  }) as unknown as typeof fetch;
  return { fetch: planted, calls };
}

const verify = (fetch: typeof globalThis.fetch, entry: { steamid64: string; role: string }) =>
  verifyExistingUser({ fetch, url: 'https://target.example', serviceKey: 'service', anonKey: 'anon', entry });

describe('verifyExistingUser', () => {
  it('signs in as an existing admin by the login calls, and the database sees their steamid64 and role', async () => {
    const { fetch, calls } = target({ players: { [ADMIN]: 'admin' }, authUsers: new Set([`${ADMIN}@steam.inclusivcup.local`]) });
    await expect(verify(fetch, { steamid64: ADMIN, role: 'admin' })).resolves.toBe(
      `authenticated as ${ADMIN} (auth user uuid-existing, carried by the move), role admin`
    );
    expect(calls).toEqual([
      'GET /rest/v1/player',
      'GET /rest/v1/app_role',
      'POST /auth/v1/admin/users',
      'POST /auth/v1/admin/generate_link',
      'PUT /auth/v1/admin/users/uuid-existing',
      'POST /auth/v1/verify',
      'POST /rest/v1/rpc/jwt_steamid64',
      'POST /rest/v1/rpc/is_admin',
    ]);
  });

  it('says so when the move did not carry the Auth user and the login created it', async () => {
    const { fetch } = target({ players: { [VIEWER]: '' }, authUsers: new Set() });
    await expect(verify(fetch, { steamid64: VIEWER, role: 'viewer' })).resolves.toContain('created at this login');
  });

  it('refuses a player the move lost, a role it changed, and a session the database reads as someone else', async () => {
    await expect(verify(target({ players: {}, authUsers: new Set() }).fetch, { steamid64: ADMIN, role: 'admin' })).rejects.toThrow(
      `the target holds no player ${ADMIN}`
    );
    await expect(verify(target({ players: { [ADMIN]: '' }, authUsers: new Set() }).fetch, { steamid64: ADMIN, role: 'admin' })).rejects.toThrow(
      `the target gives ${ADMIN} role viewer, and the source gave admin`
    );
    await expect(
      verify(target({ players: { [ADMIN]: 'admin' }, authUsers: new Set(), jwtSteamid: VIEWER }).fetch, { steamid64: ADMIN, role: 'admin' })
    ).rejects.toThrow(`the database sees steamid64 "${VIEWER}", not ${ADMIN}`);
  });

  it('exits 1 naming the refusal through main, and 2 when the target is not configured', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tournament-identity-'));
    const file = join(dir, 'identities.tsv');
    writeFileSync(file, toTsv([{ id: 'uuid-existing', steamid64: ADMIN, role: 'admin', display_name: 'A' }]));
    const env = { TOURNAMENT_TARGET_SUPABASE_URL: 'https://target.example/', TOURNAMENT_TARGET_SERVICE_ROLE_KEY: 's', TOURNAMENT_TARGET_ANON_KEY: 'a' };
    const lost = target({ players: {}, authUsers: new Set() });
    await expect(main(['verify', file, ADMIN], env, { fetch: lost.fetch, query: () => '' })).resolves.toEqual({
      code: 1,
      message: `the target holds no player ${ADMIN}`,
    });
    await expect(main(['verify', file, ADMIN], {}, { fetch: lost.fetch, query: () => '' })).rejects.toThrow('TOURNAMENT_TARGET_SUPABASE_URL is not set');
    await expect(main(['verify', file, VIEWER], env, { fetch: lost.fetch, query: () => '' })).resolves.toMatchObject({ code: 1 });
  });
});

// DW-284 (Story 9-8): `EXPORT_SQL` itself, against a real Postgres holding migration 0001, a minimal
// `auth.users` shaped as GoTrue's and each case's rows. Everything runs in one `psql` session inside
// `begin; ... rollback;`, so the database is left as found and nothing is dropped. CI's test job points
// the variable at its `postgres` service; here, point it at a scratch Postgres 17 (Supabase's major),
// with `127.0.0.1` as the host on Windows.
const DATABASE_URL = process.env.TOURNAMENT_IDENTITY_DATABASE_URL ?? '';
const MIGRATION = readFileSync(new URL('../../apps/tournament/supabase/migrations/0001_core_schema.sql', import.meta.url), 'utf8');
const AUTH_USERS = `create schema auth;
create table auth.users (id uuid primary key, email varchar(255), encrypted_password varchar(255), raw_app_meta_data jsonb, created_at timestamptz);`;

/** `main`'s query seam, run for real: the case's rows, then the export's SQL, then a rollback. */
const againstPostgres = (rows: string) => (sql: string, env: Record<string, string | undefined>) => {
  const run = spawnSync('psql', [env.TOURNAMENT_SOURCE_DATABASE_URL ?? '', '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'], {
    input: ['begin;', AUTH_USERS, MIGRATION, rows, `${sql};`, 'rollback;'].join('\n'),
    encoding: 'utf8',
  });
  if (run.status !== 0) throw new Error(`psql failed: ${(run.stderr || run.error?.message || '').trim()}`);
  return run.stdout;
};

const exportFrom = (rows: string) => main(['export'], { TOURNAMENT_SOURCE_DATABASE_URL: DATABASE_URL }, { fetch, query: againstPostgres(rows) });
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const THIRD = '76561198000000003';
const user = (n: number, email: string, password: string | null, meta: string | null, day: number) =>
  `insert into auth.users values ('${uuid(n)}', '${email}', ${password === null ? 'null' : `'${password}'`}, ${meta === null ? 'null' : `'${meta}'`}, '2026-01-0${day}T00:00:00Z');`;

describe('EXPORT_SQL against a real Postgres', () => {
  it('runs in CI, never silently skipped there', () => {
    if (process.env.CI === 'true') expect(DATABASE_URL, 'TOURNAMENT_IDENTITY_DATABASE_URL').not.toBe('');
  });

  describe.skipIf(!DATABASE_URL)('(skipped when TOURNAMENT_IDENTITY_DATABASE_URL is unset, which CI never leaves it)', () => {
    it('maps every Steam user by role and display name, in creation order, a user with no player row as a nameless viewer', async () => {
      const rows = [
        `insert into player (steamid64, display_name) values ('${ADMIN}', E'A\tB'), ('${VIEWER}', 'Player V');`,
        `insert into app_role (steamid64, role) values ('${ADMIN}', 'admin');`,
        user(1, `${ADMIN}@steam.inclusivcup.local`, null, `{"steamid64": "${ADMIN}", "role": "admin"}`, 3),
        user(2, `${VIEWER}@steam.inclusivcup.local`, '', '{}', 1),
        user(3, `${THIRD}@steam.inclusivcup.local`, null, null, 2),
      ].join('\n');
      await expect(exportFrom(rows)).resolves.toEqual({
        code: 0,
        message: [`${uuid(2)}\t${VIEWER}\tviewer\tPlayer V`, `${uuid(3)}\t${THIRD}\tviewer\t`, `${uuid(1)}\t${ADMIN}\tadmin\tA B`].join('\n'),
        note: 'tournament-identity export users=3',
      });
    });

    it('refuses a password hash and a claim its email contradicts, naming each user', async () => {
      const rows = [
        user(1, `${ADMIN}@steam.inclusivcup.local`, '$2a$10$abcdefghijklmnopqrstuv', null, 1),
        user(2, `${THIRD}@steam.inclusivcup.local`, null, `{"steamid64": "${VIEWER}"}`, 2),
      ].join('\n');
      await expect(exportFrom(rows)).resolves.toEqual({
        code: 1,
        message: [
          `user ${uuid(1)} holds a password hash, so the move could force a reset`,
          `user ${uuid(2)} claims steamid64 ${VIEWER} but its email names ${THIRD}`,
        ].join('\n'),
      });
    });

    it('answers an empty export for a source with no Auth users', async () => {
      await expect(exportFrom('')).resolves.toEqual({ code: 0, message: '', note: 'tournament-identity export users=0' });
    });
  });
});
