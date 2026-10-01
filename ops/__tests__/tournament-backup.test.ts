// @vitest-environment node
import { describe, it, expect, afterAll, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Epic 3 retrospective action 4: `ops/tournament-backup.sh` and `ops/tournament-restore-verify.sh`, the
// tournament store's nightly dump and its proof by restore. Both run for real under bash against a
// `docker` stub on PATH that answers the way `pg_dump`, `pg_restore` and `psql` answer in the one-shot
// client and in the throwaway Postgres, so what is held is the scripts' own logic: what they write,
// compare, refuse and prune, that the URL never reaches an argv, and that the throwaway container is
// always removed. The real path, against a real Postgres 17, is in the spec's Implementation Notes.
// Spawning bash is WSL's on Windows, so the launcher and path mapping follow `tracker-backup.test.ts`.

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const HERE = dirname(fileURLToPath(import.meta.url));
const OPS = resolve(HERE, '..');
const BACKUP = join(OPS, 'tournament-backup.sh');
const VERIFY = join(OPS, 'tournament-restore-verify.sh');
const SECRET = 'n0t-a-real-pooler-password';

const bashPath = (path: string): string =>
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

const ROOTS: string[] = [];
afterAll(() => {
  for (const root of ROOTS) rmSync(root, { recursive: true, force: true });
});

// `run` without `--detach` is the one-shot client against the store, told apart by its `sh -c` script;
// with it, the throwaway Postgres. Counts come from the environment as `schema.table|count` words.
const DOCKER_STUB = `#!/usr/bin/env bash
echo "$*" >> "$STUB_LOG"
verb="$1"; shift
case "$verb" in
  run)
    case " $* " in *' --detach '*) exit "\${STUB_RUN_EXIT:-0}" ;; esac
    printf '%s\\n' "\${TOURNAMENT_DATABASE_URL:-}" > "$STUB_URL_SEEN"
    script="\${!#}"
    case "$script" in
      *pg_dump*) printf 'PGDMP fixture'; exit "\${STUB_DUMP_EXIT:-0}" ;;
      *pg_restore*) cat > /dev/null; exit "\${STUB_LIST_EXIT:-0}" ;;
      *psql*) cat > /dev/null; printf '%s\\n' $STUB_COUNTS; exit 0 ;;
    esac
    exit 2 ;;
  rm) exit 0 ;;
  exec) ;;
  *) exit 2 ;;
esac
[ "$1" = '-i' ] && shift
shift
case "$1" in
  pg_isready) exit 0 ;;
  pg_restore) cat > /dev/null; exit "\${STUB_RESTORE_EXIT:-0}" ;;
  psql) ;;
  *) exit 2 ;;
esac
sql="\${!#}"
case "$sql" in
  *'DROP SCHEMA'*) exit 0 ;;
  *information_schema.tables*) printf '%s\\n' \${STUB_RESTORED_COUNTS-$STUB_COUNTS} ;;
  *schema_migrations*) printf '%s\\n' $STUB_APPLIED ;;
  *) exit 2 ;;
esac
`;

interface Box {
  root: string;
  backups: string;
  log: string;
  urlSeen: string;
  env: Record<string, string>;
}

const makeBox = (): Box => {
  const root = mkdtempSync(join(tmpdir(), 'cuatro-tournament-backup-'));
  ROOTS.push(root);
  const bin = join(root, 'bin');
  const backups = join(root, 'backups');
  const migrations = join(root, 'migrations');
  for (const dir of [bin, backups, migrations]) mkdirSync(dir, { recursive: true });
  writeFileSync(join(migrations, '0001_core_schema.sql'), '');
  writeFileSync(join(migrations, '0002_rls.sql'), '');
  // A checkout with `core.autocrlf` hands this file, and so the stub's text, CRLF endings bash rejects.
  writeFileSync(join(bin, 'docker'), DOCKER_STUB.replace(/\r\n/g, '\n'));
  chmodSync(join(bin, 'docker'), 0o755);
  const log = join(root, 'docker.log');
  writeFileSync(log, '');
  const urlSeen = join(root, 'url-seen');
  const envFile = join(root, 'env.production');
  writeFileSync(
    envFile,
    `HUB_TAG=abc\nTOURNAMENT_DATABASE_URL="postgresql://postgres.ref:${SECRET}@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"\r\n`
  );
  return {
    root,
    backups,
    log,
    urlSeen,
    env: {
      PATH: `${bashPath(bin)}:${POSIX_PATH}`,
      STUB_LOG: bashPath(log),
      STUB_URL_SEEN: bashPath(urlSeen),
      TOURNAMENT_ENV_FILE: bashPath(envFile),
      TOURNAMENT_BACKUP_DIR: bashPath(backups),
      TOURNAMENT_MIGRATIONS_DIR: bashPath(migrations),
      STUB_COUNTS: 'public.app_role|1 public.player|2 supabase_migrations.schema_migrations|2',
      STUB_APPLIED: '0001 0002',
    },
  };
};

let launchers = 0;
const run = (box: Box, script: string, args: string[] = [], env: Record<string, string> = {}) => {
  const launcher = join(box.root, `run-${(launchers += 1)}.sh`);
  const merged = { ...box.env, ...env };
  writeFileSync(
    launcher,
    ['#!/usr/bin/env bash', ...Object.entries(merged).map(([k, v]) => `export ${k}=${shellQuote(v)}`), 'exec bash "$@"', ''].join('\n')
  );
  const result = spawnSync(BASH, [bashPath(launcher), bashPath(script), ...args], { encoding: 'utf8' });
  if (result.error) throw result.error;
  const summary = (result.stdout ?? '').trim().split('\n').pop() ?? '';
  return { status: result.status ?? -1, stdout: result.stdout ?? '', stderr: result.stderr ?? '', summary };
};

const dumpOf = (box: Box): string => {
  const dumps = readdirSync(box.backups).filter((name) => /^tournament-\d{8}T\d{6}Z\.dump$/.test(name));
  expect(dumps).toHaveLength(1);
  return join(box.backups, dumps[0]);
};

const DAY = 24 * 60 * 60 * 1000;
const aged = (box: Box, name: string, days: number): string => {
  const path = join(box.backups, name);
  writeFileSync(path, 'old');
  const when = new Date(Date.now() - days * DAY);
  utimesSync(path, when, when);
  return name;
};

describe('ops/tournament-backup.sh', () => {
  it('writes the dump, every table with its count and the checksum, and reports them', () => {
    const box = makeBox();
    const result = run(box, BACKUP);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    const dump = dumpOf(box);
    expect(readFileSync(dump, 'utf8')).toBe('PGDMP fixture');
    expect(readFileSync(`${dump}.counts`, 'utf8')).toBe(
      'public.app_role\t1\npublic.player\t2\nsupabase_migrations.schema_migrations\t2\n'
    );
    expect(readFileSync(`${dump}.sha256`, 'utf8')).toMatch(/^[0-9a-f]{64} {2}tournament-\d{8}T\d{6}Z\.dump\n$/);
    expect(result.summary).toMatch(
      /^tournament-backup ts=\S+ file=\S+ dump=ok list=ok tables=3 rows=5 bytes=13 sha256=[0-9a-f]{64} prune=removed-0-aged-over-14-whole-days exit=0$/
    );
  });

  it('hands the URL, unquoted, to the client through its environment and never through an argv', () => {
    const box = makeBox();
    expect(run(box, BACKUP).status).toBe(0);
    expect(readFileSync(box.urlSeen, 'utf8')).toBe(
      `postgresql://postgres.ref:${SECRET}@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require\n`
    );
    const log = readFileSync(box.log, 'utf8');
    expect(log).toContain('-e TOURNAMENT_DATABASE_URL -e PGSSLMODE=require');
    expect(log).not.toContain(SECRET);
    expect(log).toMatch(/pg_dump .*-Fc -n public -n supabase_migrations/);
  });

  it('prunes tournament dumps over 14 whole days and nothing else', () => {
    const box = makeBox();
    const old = aged(box, 'tournament-20260910T034500Z.dump', 16);
    const kept = aged(box, 'tournament-20260920T034500Z.dump', 10);
    const placement = aged(box, 'pre-migrations-20260930T005415Z.dump', 30);
    const result = run(box, BACKUP);
    expect(result.status).toBe(0);
    expect(result.summary).toContain('prune=removed-1-aged-over-14-whole-days');
    const left = readdirSync(box.backups);
    expect(left).not.toContain(old);
    expect(left).toContain(kept);
    expect(left).toContain(placement);
  });

  it('refuses an env file with no URL, and writes nothing', () => {
    const box = makeBox();
    writeFileSync(join(box.root, 'env.production'), 'HUB_TAG=abc\n');
    const result = run(box, BACKUP);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('has no TOURNAMENT_DATABASE_URL line');
    expect(readdirSync(box.backups)).toEqual([]);
  });

  it('removes what it half wrote when pg_dump fails, and prunes nothing', () => {
    const box = makeBox();
    const old = aged(box, 'tournament-20260910T034500Z.dump', 16);
    const result = run(box, BACKUP, [], { STUB_DUMP_EXIT: '1' });
    expect(result.status).toBe(1);
    expect(result.summary).toContain('dump=failed list=not-reached');
    expect(result.summary).toContain('prune=not-reached exit=1');
    expect(readdirSync(box.backups)).toEqual([old]);
  });

  it('refuses a dump pg_restore cannot list', () => {
    const box = makeBox();
    const result = run(box, BACKUP, [], { STUB_LIST_EXIT: '1' });
    expect(result.status).toBe(1);
    expect(result.summary).toContain('list=unreadable');
    expect(readdirSync(box.backups)).toEqual([]);
  });

  it('refuses a store with no migration ledger', () => {
    const box = makeBox();
    const result = run(box, BACKUP, [], { STUB_COUNTS: 'public.player|2' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('carries no migration ledger');
    expect(readdirSync(box.backups)).toEqual([]);
  });
});

describe('ops/tournament-restore-verify.sh', () => {
  const backedUp = (): { box: Box; dump: string } => {
    const box = makeBox();
    expect(run(box, BACKUP).status).toBe(0);
    return { box, dump: dumpOf(box) };
  };

  /** The throwaway container this run started, and whether it removed it. */
  const scratch = (box: Box): { started: string[]; removed: string[] } => {
    const lines = readFileSync(box.log, 'utf8').split('\n');
    return {
      started: lines.filter((line) => line.startsWith('run --detach ')).map((line) => /--name (\S+)/.exec(line)?.[1] ?? ''),
      removed: lines.filter((line) => line.startsWith('rm --force --volumes ')).map((line) => line.slice('rm --force --volumes '.length)),
    };
  };

  it('proves a restore whose every table holds the counted rows and whose ledger holds every migration', () => {
    const { box, dump } = backedUp();
    const result = run(box, VERIFY, [bashPath(dump)]);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.summary).toBe('tournament-restore-verify sha256=match restore=ok tables=3 rows=5 migrations=2-applied-0-pending exit=0');
    const { started, removed } = scratch(box);
    expect(started).toHaveLength(1);
    expect(removed).toEqual(started);
    expect(readFileSync(box.log, 'utf8')).toMatch(/^run --detach --name tournament-restore-verify-\d+ --network none /m);
    expect(readFileSync(box.log, 'utf8')).toMatch(/pg_restore .*--exit-on-error --no-owner --no-privileges/);
  });

  it('names the table whose restored rows differ from the counted ones, and still removes the container', () => {
    const { box, dump } = backedUp();
    const result = run(box, VERIFY, [bashPath(dump)], {
      STUB_RESTORED_COUNTS: 'public.app_role|1 public.player|1 supabase_migrations.schema_migrations|2',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('public.player restored 1 rows, and the store held 2');
    const { started, removed } = scratch(box);
    expect(removed).toEqual(started);
  });

  it('refuses a restore whose tables are not the counted ones', () => {
    const { box, dump } = backedUp();
    const result = run(box, VERIFY, [bashPath(dump)], { STUB_RESTORED_COUNTS: 'public.player|2 supabase_migrations.schema_migrations|2' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('the restored tables are not the tables the counts file names');
  });

  it('refuses a dump pg_restore does not finish, and still removes the container', () => {
    const { box, dump } = backedUp();
    const result = run(box, VERIFY, [bashPath(dump)], { STUB_RESTORE_EXIT: '1' });
    expect(result.status).toBe(1);
    expect(result.summary).toContain('restore=failed');
    const { started, removed } = scratch(box);
    expect(removed).toEqual(started);
  });

  it('removes a throwaway container docker created but could not start', () => {
    const { box, dump } = backedUp();
    const result = run(box, VERIFY, [bashPath(dump)], { STUB_RUN_EXIT: '1' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('cannot start a throwaway postgres:17-alpine');
    const { started, removed } = scratch(box);
    expect(started).toHaveLength(1);
    expect(removed).toEqual(started);
  });

  it('refuses a dump changed since its checksum, before starting anything', () => {
    const { box, dump } = backedUp();
    writeFileSync(dump, 'PGDMP tampered');
    const result = run(box, VERIFY, [bashPath(dump)]);
    expect(result.status).toBe(1);
    expect(result.summary).toContain('sha256=mismatch');
    expect(scratch(box).started).toEqual([]);
  });

  it('names a migration the checkout carries that the ledger lacks, and still removes the container', () => {
    const { box, dump } = backedUp();
    const result = run(box, VERIFY, [bashPath(dump)], { STUB_APPLIED: '0001' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("migration 0002_rls.sql is not in the backup's ledger");
    expect(result.summary).toContain('migrations=1-applied-1-pending');
    const { started, removed } = scratch(box);
    expect(removed).toEqual(started);
  });

  it('refuses a restored ledger that records no migration', () => {
    const { box, dump } = backedUp();
    const result = run(box, VERIFY, [bashPath(dump)], { STUB_APPLIED: '' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('records no migration');
  });
});
