// The tournament's identity export-and-map and its authenticate-as-an-existing-user check (Story 3-7).
//
// Story 3.7 requires that moving `cs-tournament` forces no user through a password reset, verified by
// authenticating as an existing user after the move. No user of it has a password: login is Steam
// OpenID, and `apps/tournament/lib/auth/session.ts` creates each Supabase Auth user without one, keyed
// by the synthetic email `<steamid64>@steam.inclusivcup.local`, with `{ steamid64, role }` in its
// `app_metadata`. A user's standing is their `player` and `app_role` rows, keyed by steamid64, and no
// table references `auth.users`. So what must survive the move is the steamid64 identity, and these two
// commands hold it:
//
//   node ops/tournament-identity.mjs export > identities.tsv
//     Reads the source database's `auth.users`, `player` and `app_role` with `psql` inside
//     `postgres:17-alpine` (Supabase runs 17), connecting as TOURNAMENT_SOURCE_DATABASE_URL, which
//     reaches the container by name and never appears on a command line. Supabase's direct host
//     `db.<ref>.supabase.co` answers on IPv6 only, so from an IPv4 network use the project's session
//     pooler URL (`aws-0-<region>.pooler.supabase.com:5432`, user `postgres.<ref>`), as the worker's
//     `config.go` notes for its own connection. Writes one line per Auth user:
//     auth id, steamid64, role, display name. Refuses, naming the user id, any user holding a password
//     hash (the premise above would be wrong, and a reset could follow) or whose email maps to no
//     steamid64 (their next login could not find them).
//
//   node ops/tournament-identity.mjs verify identities.tsv <steamid64>
//     Against the target Supabase (TOURNAMENT_TARGET_SUPABASE_URL, TOURNAMENT_TARGET_SERVICE_ROLE_KEY,
//     TOURNAMENT_TARGET_ANON_KEY): requires that user's `player` row and the role the export recorded,
//     then signs in as them by the login's own four Auth calls (create if absent, magic-link token, bind
//     the claim, verify the token), and requires the database to see that steamid64 and role through
//     `jwt_steamid64()` and `is_admin()`, the functions every RLS policy reads. Like a real login it
//     creates the Auth user when the move did not carry it, and binds the claim; nothing else is written.
//
// Pure exports plus a thin `main`; the suite plants the fetcher and the query. Exit 0 the check passed,
// 1 it refused, 2 a defect (a missing variable, an unreadable file, a malformed answer).

import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EMAIL = /^(\d{17})@steam\.inclusivcup\.local$/;
const STEAMID64 = /^\d{17}$/;

export const EXPORT_SQL = `select coalesce(json_agg(t order by t.created_at), '[]') from (
  select u.id, u.email, u.created_at,
         coalesce(u.encrypted_password, '') <> '' as has_password,
         u.raw_app_meta_data ->> 'steamid64' as claimed,
         coalesce(r.role, 'viewer') as role,
         coalesce(p.display_name, '') as display_name
  from auth.users u
  left join public.player p on p.steamid64 = substring(u.email from '^([0-9]{17})@')
  left join public.app_role r on r.steamid64 = p.steamid64
) t`;

/**
 * Map exported Auth users to their steamid64 identity, refusing any the move could lose.
 * @param {Array<{id: string, email: string, has_password: boolean, claimed: string | null, role: string, display_name: string}>} rows
 */
export function mapIdentities(rows) {
  const mapped = [];
  const refused = [];
  for (const row of rows) {
    const steamid64 = EMAIL.exec(row.email ?? '')?.[1];
    if (row.has_password) refused.push(`user ${row.id} holds a password hash, so the move could force a reset`);
    else if (!steamid64) refused.push(`user ${row.id} has an email that maps to no steamid64`);
    else if (row.claimed && row.claimed !== steamid64) refused.push(`user ${row.id} claims steamid64 ${row.claimed} but its email names ${steamid64}`);
    else mapped.push({ id: row.id, steamid64, role: row.role, display_name: row.display_name.replace(/[\t\r\n]+/g, ' ') });
  }
  return { mapped, refused };
}

/** @param {{id: string, steamid64: string, role: string, display_name: string}[]} mapped */
export const toTsv = (mapped) => mapped.map((entry) => [entry.id, entry.steamid64, entry.role, entry.display_name].join('\t')).join('\n');

/** @param {string} text */
export const fromTsv = (text) =>
  text
    .split(/\r?\n/)
    .filter((line) => line !== '')
    .map((line) => {
      const [id, steamid64, role, display_name = ''] = line.split('\t');
      return { id, steamid64, role, display_name };
    });

class Refusal extends Error {}

/**
 * Sign in as an existing user the way `establishSession` does, and require the database to see them.
 * @param {{ fetch: typeof fetch, url: string, serviceKey: string, anonKey: string, entry: {steamid64: string, role: string} }} input
 * @returns {Promise<string>} what was observed, one line
 */
export async function verifyExistingUser({ fetch, url, serviceKey, anonKey, entry }) {
  const { steamid64, role } = entry;
  const email = `${steamid64}@steam.inclusivcup.local`;
  const service = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
  const call = async (step, path, init, headers = service) => {
    const response = await fetch(`${url}${path}`, { ...init, headers });
    const body = await response.json().catch(() => null);
    return { step, response, body };
  };
  const need = ({ step, response, body }) => {
    if (!response.ok) throw new Refusal(`${step} answered ${response.status}: ${body?.msg ?? body?.message ?? ''}`.trim());
    return body;
  };

  const players = need(await call('reading player', `/rest/v1/player?steamid64=eq.${steamid64}&select=steamid64`, { method: 'GET' }));
  if (!Array.isArray(players) || players.length !== 1) throw new Refusal(`the target holds no player ${steamid64}`);
  const roles = need(await call('reading app_role', `/rest/v1/app_role?steamid64=eq.${steamid64}&select=role`, { method: 'GET' }));
  const targetRole = Array.isArray(roles) && roles[0]?.role ? roles[0].role : 'viewer';
  if (targetRole !== role) throw new Refusal(`the target gives ${steamid64} role ${targetRole}, and the source gave ${role}`);

  const claim = { app_metadata: { steamid64, role } };
  const created = await call('createUser', '/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, email_confirm: true, ...claim }) });
  const existed = !created.response.ok && (created.body?.error_code === 'email_exists' || /already/i.test(created.body?.msg ?? ''));
  if (!created.response.ok && !existed) need(created);

  const link = need(await call('generateLink', '/auth/v1/admin/generate_link', { method: 'POST', body: JSON.stringify({ type: 'magiclink', email }) }));
  if (!link?.id || !link?.hashed_token) throw new Refusal('generateLink returned no user id or token');
  need(await call('updateUserById', `/auth/v1/admin/users/${link.id}`, { method: 'PUT', body: JSON.stringify(claim) }));
  const anon = { apikey: anonKey, 'Content-Type': 'application/json' };
  const session = need(await call('verifyOtp', '/auth/v1/verify', { method: 'POST', body: JSON.stringify({ type: 'email', token_hash: link.hashed_token }) }, anon));
  if (!session?.access_token) throw new Refusal('verifyOtp returned no session');

  const asUser = { ...anon, Authorization: `Bearer ${session.access_token}` };
  const seen = need(await call('jwt_steamid64()', '/rest/v1/rpc/jwt_steamid64', { method: 'POST', body: '{}' }, asUser));
  const admin = need(await call('is_admin()', '/rest/v1/rpc/is_admin', { method: 'POST', body: '{}' }, asUser));
  if (seen !== steamid64) throw new Refusal(`the database sees steamid64 ${JSON.stringify(seen)}, not ${steamid64}`);
  if (admin !== (role === 'admin')) throw new Refusal(`the database answers is_admin() ${admin} for role ${role}`);
  return `authenticated as ${steamid64} (auth user ${link.id}, ${existed ? 'carried by the move' : 'created at this login'}), role ${role}`;
}

/** Run the export's query in a throwaway `psql`, the URL passed by name through the environment. */
function query(sql, env) {
  const run = spawnSync(
    'docker',
    ['run', '--rm', '--env', 'TOURNAMENT_SOURCE_DATABASE_URL', 'postgres:17-alpine', 'sh', '-c', 'exec psql "$TOURNAMENT_SOURCE_DATABASE_URL" -X -At -v ON_ERROR_STOP=1 -c "$1"', 'psql', sql],
    { env, encoding: 'utf8' }
  );
  if (run.status !== 0) throw new Error(`psql failed: ${(run.stderr || run.error?.message || '').trim()}`);
  return run.stdout;
}

const required = (env, name) => {
  if (!env[name]) throw new Error(`${name} is not set`);
  return env[name];
};

/**
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} env
 * @param {{ fetch: typeof fetch, query: (sql: string, env: Record<string, string | undefined>) => string }} io
 */
export async function main(argv = process.argv.slice(2), env = process.env, io = { fetch: globalThis.fetch, query }) {
  const [command, file, steamid64] = argv;
  if (command === 'export') {
    required(env, 'TOURNAMENT_SOURCE_DATABASE_URL');
    const rows = JSON.parse(io.query(EXPORT_SQL, env));
    const { mapped, refused } = mapIdentities(rows);
    if (refused.length > 0) return { code: 1, message: refused.join('\n') };
    return { code: 0, message: toTsv(mapped), note: `tournament-identity export users=${mapped.length}` };
  }
  if (command === 'verify' && file && STEAMID64.test(steamid64 ?? '')) {
    const entry = fromTsv(readFileSync(file, 'utf8')).find((candidate) => candidate.steamid64 === steamid64);
    if (!entry) return { code: 1, message: `${steamid64} is not in ${file}` };
    try {
      const seen = await verifyExistingUser({
        fetch: io.fetch,
        url: required(env, 'TOURNAMENT_TARGET_SUPABASE_URL').replace(/\/+$/, ''),
        serviceKey: required(env, 'TOURNAMENT_TARGET_SERVICE_ROLE_KEY'),
        anonKey: required(env, 'TOURNAMENT_TARGET_ANON_KEY'),
        entry,
      });
      return { code: 0, message: seen };
    } catch (error) {
      if (error instanceof Refusal) return { code: 1, message: error.message };
      throw error;
    }
  }
  return { code: 2, message: 'usage: tournament-identity.mjs export | verify <identities.tsv> <steamid64>' };
}

function sameFile(a, b) {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return resolve(a) === resolve(b);
  }
}

if (typeof process.argv[1] === 'string' && sameFile(process.argv[1], fileURLToPath(import.meta.url))) {
  main()
    .catch((error) => ({ code: 2, message: error instanceof Error ? error.message : String(error) }))
    .then((result) => {
      if (result.note) process.stderr.write(`${result.note}\n`);
      const stream = result.code === 0 ? process.stdout : process.stderr;
      process.exitCode = result.code;
      stream.write(`${result.message}\n`, () => process.exit(result.code));
    });
}
