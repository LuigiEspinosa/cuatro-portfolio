// @vitest-environment node
import { describe, it, expect, afterAll, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Story 4-4 (AD-10, AD-3): the estate's one Postgres under `ops/postgres/`. One database and one role per
// consumer, never a shared role or a schema per application, no PgBouncer, and every role's CONNECTION
// LIMIT summing under `max_connections` less the superuser slots. The files are read as text, on the
// precedent of `traefik-config.test.ts`. The init script also runs for real under `sh` against a `psql`
// stub on PATH, so what is held is its own logic: every variable checked before any statement, and each
// value handed to psql as a variable. The real run, against the pinned image, is in the spec's
// Verification and `ops/postgres.md` § Rehearsed off the box. Spawning a shell is WSL's on Windows, so the
// launcher and path mapping follow `tracker-backup.test.ts`.

vi.setConfig({ testTimeout: 120_000 });

const ROOT = process.cwd();
const DIR = resolve(ROOT, 'ops/postgres');
const SCRIPT = join(DIR, 'init/10-consumers.sh');
// Line endings normalized: `core.autocrlf` checks these out with CRLF on the Windows authoring host.
const read = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const INIT = read(SCRIPT);
const COMPOSE = read(join(DIR, 'compose.yml'));
const RECORD = read(resolve(ROOT, 'ops/postgres.md'));
// What runs, without the comments, which name what the files refuse.
const code = (text: string) => text.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
const REGISTRY = JSON.parse(read(resolve(ROOT, 'contracts/registry.json'))) as { applications: { id: string }[] };

// Postgres' default, which `compose.yml` does not override: slots only a superuser may take.
const SUPERUSER_RESERVED = 3;

interface Consumer {
  name: string;
  limit: number;
  variable: string;
}

/** The `CONSUMERS='...'` table: one `name limit VARIABLE` line per consumer. */
function parseConsumers(text: string): Consumer[] {
  const block = /^CONSUMERS='([^']*)'$/m.exec(text)?.[1];
  if (block === undefined) throw new Error("no `CONSUMERS='...'` table");
  return block.split('\n').map((line) => {
    const cells = line.trim().split(/\s+/);
    if (cells.length !== 3 || !/^\d+$/.test(cells[1])) throw new Error(`malformed consumer line: ${line}`);
    return { name: cells[0], limit: Number(cells[1]), variable: cells[2] };
  });
}

/** `max_connections` from the service's `command`. */
function maxConnections(text: string): number {
  const found = /'-c', 'max_connections=(\d+)'/.exec(text)?.[1];
  if (!found) throw new Error('compose sets no max_connections');
  return Number(found);
}

/** The rows of `ops/postgres.md` § The budget whose first cell is a backticked role. */
function budgetRows(markdown: string): { name: string; limit: number }[] {
  const section = markdown.split('\n## The budget\n')[1]?.split('\n## ')[0];
  if (!section) throw new Error('no `## The budget` section');
  return section
    .split('\n')
    .filter((l) => /^\| `[a-z_]+` \|/.test(l))
    .map((l) => l.split('|').map((c) => c.trim()))
    .map((cells) => ({ name: cells[1].replace(/`/g, ''), limit: Number(cells[2]) }));
}

const consumers = parseConsumers(INIT);

describe('the parsers', () => {
  it('read the consumer table and refuse a malformed line', () => {
    expect(parseConsumers("CONSUMERS='a 1 A\nb 2 B'")).toEqual([
      { name: 'a', limit: 1, variable: 'A' },
      { name: 'b', limit: 2, variable: 'B' },
    ]);
    expect(() => parseConsumers("CONSUMERS='a ten A'")).toThrow(/malformed/);
    expect(() => parseConsumers('nothing')).toThrow(/no `CONSUMERS/);
  });

  it('read the budget rows of one section only', () => {
    const text = ['# x', '## The budget', '| Role | Limit |', '| `a` | 5 | x |', '## Next', '| `b` | 9 |'].join('\n');
    expect(budgetRows(text)).toEqual([{ name: 'a', limit: 5 }]);
  });
});

describe('one database and one role per consumer', () => {
  it('names exactly the estate consumers that use this instance', () => {
    expect(consumers.map((c) => c.name)).toEqual(['umami', 'cuatro_tracker', 'cs_tracker', 'cuatro_finance']);
  });

  it('shares no role, database or password variable between consumers', () => {
    expect(new Set(consumers.map((c) => c.name)).size).toBe(consumers.length);
    expect(new Set(consumers.map((c) => c.variable)).size).toBe(consumers.length);
    for (const c of consumers) expect(c.variable).toBe(`${c.name.toUpperCase()}_DB_PASSWORD`);
  });

  it('derives every name but Umami from a Registry id, hyphens as underscores (AD-3)', () => {
    const ids = new Set(REGISTRY.applications.map((a) => a.id.replace(/-/g, '_')));
    for (const c of consumers.filter((c) => c.name !== 'umami')) expect(ids, c.name).toContain(c.name);
    expect(ids).not.toContain('umami');
  });

  it('creates each role and its own database, owned by that role, with the limit on both', () => {
    expect(INIT).toContain(`CREATE ROLE :"name" LOGIN PASSWORD :'password' CONNECTION LIMIT :limit;`);
    expect(INIT).toContain('CREATE DATABASE :"name" OWNER :"name" CONNECTION LIMIT :limit;');
    expect(INIT).toContain('REVOKE ALL ON DATABASE :"name" FROM PUBLIC;');
    expect(INIT).toContain("REVOKE CONNECT ON DATABASE postgres, template1 FROM PUBLIC");
  });

  it('never creates a schema per application, grants across consumers, or makes a superuser', () => {
    expect(code(INIT)).not.toMatch(/CREATE SCHEMA/i);
    expect(code(INIT)).not.toMatch(/\bGRANT\b/i);
    expect(code(INIT)).not.toMatch(/SUPERUSER|CREATEROLE|CREATEDB/i);
  });
});

describe('the connection budget', () => {
  it('keeps every limit positive and the sum under max_connections less the superuser slots', () => {
    for (const c of consumers) expect(c.limit, c.name).toBeGreaterThan(0);
    const sum = consumers.reduce((total, c) => total + c.limit, 0);
    expect(sum).toBeLessThanOrEqual(maxConnections(COMPOSE) - SUPERUSER_RESERVED);
    expect(code(COMPOSE)).not.toMatch(/superuser_reserved_connections/);
  });

  it('is stated in the record exactly as the script applies it', () => {
    expect(budgetRows(RECORD)).toEqual(consumers.map(({ name, limit }) => ({ name, limit })));
    expect(RECORD).toContain(`max_connections=${maxConnections(COMPOSE)}`);
  });
});

describe('the compose file', () => {
  it('pins an exact PostgreSQL 18 patch on a named Debian release', () => {
    expect(COMPOSE).toMatch(/^ {4}image: postgres:18\.\d+-[a-z]+$/m);
  });

  it('keeps the cluster on a named volume at the 18 image layout and mounts the init directory read-only', () => {
    expect(COMPOSE).toMatch(/^ {6}- pgdata:\/var\/lib\/postgresql$/m);
    expect(COMPOSE).toMatch(/^volumes:\n {2}pgdata:$/m);
    expect(COMPOSE).toMatch(/^ {6}- \.\/init:\/docker-entrypoint-initdb\.d:ro$/m);
  });

  it('publishes no port, fixes no container name, and runs no PgBouncer', () => {
    expect(COMPOSE).not.toMatch(/^\s*ports:/m);
    expect(code(COMPOSE)).not.toMatch(/container_name/);
    expect(code(`${COMPOSE}\n${INIT}`)).not.toMatch(/pgbouncer/i);
    expect(COMPOSE.match(/^ {4}image: /gm)).toHaveLength(1);
  });

  it('checks health over TCP and joins only its own named network', () => {
    expect(COMPOSE).toContain("pg_isready -h 127.0.0.1 -U postgres -d postgres");
    expect(COMPOSE).toMatch(/^networks:\n {2}estate-postgres:\n {4}name: estate-postgres$/m);
    expect(COMPOSE).not.toMatch(/cs-tracker_default/);
  });

  it('reads its secrets from a gitignored .env and holds only the compose file and the init script', () => {
    expect(COMPOSE).toMatch(/env_file:\n(?: {6}#.*\n)* {6}- \.env$/m);
    expect(spawnSync('git', ['check-ignore', '-q', 'ops/postgres/.env'], { cwd: ROOT }).status).toBe(0);
    const files = readdirSync(DIR, { recursive: true, withFileTypes: true })
      .filter((f) => f.isFile() && f.name !== '.env')
      .map((f) => join(f.parentPath, f.name).slice(DIR.length + 1).replace(/\\/g, '/'))
      .sort();
    expect(files).toEqual(['compose.yml', 'init/10-consumers.sh']);
  });

  it('ships the init script executable, so the image runs it rather than sourcing it', () => {
    const staged = spawnSync('git', ['ls-files', '-s', 'ops/postgres/init/10-consumers.sh'], { cwd: ROOT, encoding: 'utf8' });
    expect(staged.stdout).toMatch(/^100755 /);
    expect(INIT.startsWith('#!/bin/sh\n')).toBe(true);
  });
});

// The script under `sh`, with a `psql` stub that logs its arguments and the SQL it was fed.
const shPath = (path: string): string =>
  process.platform === 'win32'
    ? path.replace(/^([A-Za-z]):/, (_match, drive: string) => `/mnt/${drive.toLowerCase()}`).replace(/\\/g, '/')
    : path;

const BASH = (() => {
  if (process.platform !== 'win32') return 'bash';
  const candidate = join(process.env.SystemRoot ?? 'C:\\Windows', 'system32', 'bash.exe');
  return existsSync(candidate) ? candidate : 'bash';
})();

const POSIX_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';
const shellQuote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

const PSQL_STUB = `#!/bin/sh
printf '%s\\n' "--- call" "$@" >> "$STUB_LOG"
[ -t 0 ] || cat >> "$STUB_LOG"
`;

const ROOTS: string[] = [];
afterAll(() => {
  for (const root of ROOTS) rmSync(root, { recursive: true, force: true });
});

const PASSWORDS: Record<string, string> = {
  UMAMI_DB_PASSWORD: "u'm ami",
  CUATRO_TRACKER_DB_PASSWORD: 'tr$acker',
  CS_TRACKER_DB_PASSWORD: 'cs"tracker',
  CUATRO_FINANCE_DB_PASSWORD: 'fin;ance',
};

const runInit = (env: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), 'postgres-init-'));
  ROOTS.push(root);
  const bin = join(root, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'psql'), PSQL_STUB);
  chmodSync(join(bin, 'psql'), 0o755);
  const log = join(root, 'psql.log');
  writeFileSync(log, '');
  const launcher = join(root, 'run.sh');
  const merged = { PATH: `${shPath(bin)}:${POSIX_PATH}`, STUB_LOG: shPath(log), ...env };
  writeFileSync(
    launcher,
    ['#!/bin/sh', ...Object.entries(merged).map(([k, v]) => `export ${k}=${shellQuote(v)}`), 'exec sh "$@" </dev/null', ''].join('\n')
  );
  // The checkout may hold CRLF; the image reads the committed LF bytes, so the copy run here is LF too.
  const script = join(root, '10-consumers.sh');
  writeFileSync(script, INIT);
  const result = spawnSync(BASH, [shPath(launcher), shPath(script)], { encoding: 'utf8' });
  if (result.error) throw result.error;
  return { status: result.status ?? -1, stdout: result.stdout ?? '', stderr: result.stderr ?? '', log: readFileSync(log, 'utf8') };
};

describe('the init script, run', () => {
  it('revokes the maintenance databases, then hands each consumer to psql as variables', () => {
    const run = runInit(PASSWORDS);
    expect(run.status, run.stderr).toBe(0);
    const calls = run.log.split('--- call\n').slice(1);
    expect(calls).toHaveLength(1 + consumers.length);
    expect(calls[0]).toContain('REVOKE CONNECT ON DATABASE postgres, template1 FROM PUBLIC');
    consumers.forEach((c, i) => {
      const args = calls[i + 1].split('\n');
      expect(args).toContain(`name=${c.name}`);
      expect(args).toContain(`limit=${c.limit}`);
      expect(args).toContain(`password=${PASSWORDS[c.variable]}`);
      expect(args).toContain('ON_ERROR_STOP=1');
      expect(calls[i + 1]).toContain('CREATE ROLE :"name"');
    });
    for (const password of Object.values(PASSWORDS)) expect(run.stdout + run.stderr).not.toContain(password);
  });

  it('refuses before any statement when a password variable is unset or empty, naming each', () => {
    const { CS_TRACKER_DB_PASSWORD: _unset, ...rest } = PASSWORDS;
    const run = runInit({ ...rest, CUATRO_FINANCE_DB_PASSWORD: '' });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('CS_TRACKER_DB_PASSWORD is unset or empty; no database for cs_tracker');
    expect(run.stderr).toContain('CUATRO_FINANCE_DB_PASSWORD is unset or empty; no database for cuatro_finance');
    expect(run.log).toBe('');
  });
});
