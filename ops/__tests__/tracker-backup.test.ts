// @vitest-environment node
import { describe, it, expect, afterAll, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Story 3-6: `ops/tracker-backup.sh` and `ops/tracker-restore-verify.sh`, the tracker's pre-cutover
// backup and its proof by restore. Both run for real under bash against a `docker` stub on PATH that
// answers the way `pg_dump`, `pg_restore` and `psql` answer inside the two containers, so what is held
// is the scripts' own logic: what they write, what they compare and refuse, and that the throwaway
// container is always removed. The real path, against a real Postgres, is in the spec's Verification.
// Spawning bash is WSL's on Windows, so the launcher and path mapping follow `library-backup.test.ts`.

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const HERE = dirname(fileURLToPath(import.meta.url));
const OPS = resolve(HERE, '..');
const BACKUP = join(OPS, 'tracker-backup.sh');
const VERIFY = join(OPS, 'tracker-restore-verify.sh');

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

// The live container answers as the box's `cuatro-tracker-postgres-1`; any other is the throwaway one.
// Tables, counts and applied migrations come from the environment, per side.
const DOCKER_STUB = `#!/usr/bin/env bash
echo "$*" >> "$STUB_LOG"
verb="$1"; shift
case "$verb" in
  inspect) echo "\${STUB_RUNNING:-true}"; exit 0 ;;
  run) exit "\${STUB_RUN_EXIT:-0}" ;;
  rm) exit 0 ;;
  exec) ;;
  *) exit 2 ;;
esac
[ "$1" = '-i' ] && shift
container="$1"; shift
side=live; [ "$container" = cuatro-tracker-postgres-1 ] || side=restored
case "$1" in
  pg_dump) printf 'PGDMP fixture'; exit "\${STUB_DUMP_EXIT:-0}" ;;
  pg_isready) exit 0 ;;
  pg_restore)
    cat > /dev/null
    case " $* " in *' --list '*) exit "\${STUB_LIST_EXIT:-0}" ;; esac
    exit "\${STUB_RESTORE_EXIT:-0}" ;;
  psql) ;;
  *) exit 2 ;;
esac
sql="\${!#}"
case "$sql" in
  *information_schema.tables*)
    if [ "$side" = restored ]; then list="\${STUB_RESTORED_TABLES-$STUB_TABLES}"; else list="$STUB_TABLES"; fi
    printf '%s\\n' $list ;;
  *'count(*)'*)
    table="$(printf '%s' "$sql" | sed 's/.*"\\(.*\\)".*/\\1/')"
    live="STUB_COUNT_$table"; restored="STUB_RESTORED_COUNT_$table"
    if [ "$side" = restored ] && [ -n "\${!restored:-}" ]; then echo "\${!restored}"; else echo "\${!live}"; fi ;;
  *_prisma_migrations*) printf '%s\\n' $STUB_APPLIED ;;
  *) exit 2 ;;
esac
`;

interface Box {
  backups: string;
  log: string;
  env: Record<string, string>;
}

const makeBox = (): Box => {
  const root = mkdtempSync(join(tmpdir(), 'cuatro-tracker-backup-'));
  ROOTS.push(root);
  const bin = join(root, 'bin');
  const backups = join(root, 'backups');
  const migrations = join(root, 'migrations');
  for (const dir of [bin, backups, join(migrations, '20260225074749_init'), join(migrations, '20260721120000_merge_suggestion_unique_pair')]) {
    mkdirSync(dir, { recursive: true });
  }
  // A checkout with `core.autocrlf` hands this file, and so the stub's text, CRLF endings bash rejects.
  writeFileSync(join(bin, 'docker'), DOCKER_STUB.replace(/\r\n/g, '\n'));
  chmodSync(join(bin, 'docker'), 0o755);
  const log = join(root, 'docker.log');
  writeFileSync(log, '');
  return {
    backups,
    log,
    env: {
      PATH: `${bashPath(bin)}:${POSIX_PATH}`,
      STUB_LOG: bashPath(log),
      TRACKER_BACKUP_DIR: bashPath(backups),
      TRACKER_MIGRATIONS_DIR: bashPath(migrations),
      STUB_TABLES: '_prisma_migrations media_item user',
      STUB_COUNT__prisma_migrations: '11',
      STUB_COUNT_media_item: '112',
      STUB_COUNT_user: '1',
      STUB_APPLIED: '20260225074749_init 20260721120000_merge_suggestion_unique_pair',
    },
  };
};

let launchers = 0;
const run = (box: Box, script: string, args: string[] = [], env: Record<string, string> = {}) => {
  const launcher = join(dirname(box.backups), `run-${(launchers += 1)}.sh`);
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
  const dumps = readdirSync(box.backups).filter((name) => name.endsWith('.dump'));
  expect(dumps).toHaveLength(1);
  return join(box.backups, dumps[0]);
};

describe('ops/tracker-backup.sh', () => {
  it('writes the dump, every table with its count and the checksum, and reports them', () => {
    const box = makeBox();
    const result = run(box, BACKUP);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    const dump = dumpOf(box);
    expect(dump).toMatch(/tracker-\d{8}T\d{6}Z\.dump$/);
    expect(readFileSync(dump, 'utf8')).toBe('PGDMP fixture');
    expect(readFileSync(`${dump}.counts`, 'utf8')).toBe('_prisma_migrations\t11\nmedia_item\t112\nuser\t1\n');
    expect(readFileSync(`${dump}.sha256`, 'utf8')).toMatch(/^[0-9a-f]{64} {2}tracker-\d{8}T\d{6}Z\.dump\n$/);
    expect(result.summary).toMatch(/^tracker-backup file=\S+ dump=ok list=ok tables=3 rows=124 bytes=13 sha256=[0-9a-f]{64} exit=0$/);
  });

  it('refuses when the database container is not running, and writes nothing', () => {
    const box = makeBox();
    const result = run(box, BACKUP, [], { STUB_RUNNING: 'false' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('cuatro-tracker-postgres-1 is not running');
    expect(readdirSync(box.backups)).toEqual([]);
  });

  it('removes what it half wrote when pg_dump fails', () => {
    const box = makeBox();
    const result = run(box, BACKUP, [], { STUB_DUMP_EXIT: '1' });
    expect(result.status).toBe(1);
    expect(result.summary).toContain('dump=failed list=not-reached');
    expect(result.summary).toMatch(/ exit=1$/);
    expect(readdirSync(box.backups)).toEqual([]);
  });

  it('refuses a dump pg_restore cannot list', () => {
    const box = makeBox();
    const result = run(box, BACKUP, [], { STUB_LIST_EXIT: '1' });
    expect(result.status).toBe(1);
    expect(result.summary).toContain('list=unreadable');
    expect(readdirSync(box.backups)).toEqual([]);
  });
});

describe('ops/tracker-restore-verify.sh', () => {
  const backedUp = (): { box: Box; dump: string } => {
    const box = makeBox();
    expect(run(box, BACKUP).status).toBe(0);
    return { box, dump: dumpOf(box) };
  };

  /** The throwaway container this run started, and whether it removed it. */
  const scratch = (box: Box): { started: string[]; removed: string[] } => {
    const lines = readFileSync(box.log, 'utf8').split('\n');
    return {
      started: lines.filter((line) => line.startsWith('run ')).map((line) => /--name (\S+)/.exec(line)?.[1] ?? ''),
      removed: lines.filter((line) => line.startsWith('rm --force ')).map((line) => line.slice('rm --force '.length)),
    };
  };

  it('proves a restore whose every table holds the counted rows, in a container it starts with no network and removes', () => {
    const { box, dump } = backedUp();
    const result = run(box, VERIFY, [bashPath(dump)]);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.summary).toBe('tracker-restore-verify sha256=match restore=ok tables=3 rows=124 migrations=2-applied-0-pending exit=0');
    const { started, removed } = scratch(box);
    expect(started).toHaveLength(1);
    expect(started[0]).toMatch(/^tracker-restore-verify-\d+$/);
    expect(removed).toEqual(started);
    expect(readFileSync(box.log, 'utf8')).toMatch(/^run --detach --name tracker-restore-verify-\d+ --network none /m);
  });

  it('names the table whose restored rows differ from the live count, and still removes the container', () => {
    const { box, dump } = backedUp();
    const result = run(box, VERIFY, [bashPath(dump)], { STUB_RESTORED_COUNT_media_item: '111' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('media_item restored 111 rows, and the live database held 112');
    const { started, removed } = scratch(box);
    expect(removed).toEqual(started);
  });

  it('refuses a restore whose tables are not the counted ones', () => {
    const { box, dump } = backedUp();
    const result = run(box, VERIFY, [bashPath(dump)], { STUB_RESTORED_TABLES: '_prisma_migrations media_item' });
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

  it('refuses a dump changed since its checksum, before starting anything', () => {
    const { box, dump } = backedUp();
    writeFileSync(dump, 'PGDMP tampered');
    const result = run(box, VERIFY, [bashPath(dump)]);
    expect(result.status).toBe(1);
    expect(result.summary).toContain('sha256=mismatch');
    expect(scratch(box).started).toEqual([]);
  });

  it('refuses a backup missing a migration the checkout carries, naming it, and still removes the container', () => {
    const { box, dump } = backedUp();
    const result = run(box, VERIFY, [bashPath(dump)], { STUB_APPLIED: '20260225074749_init' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('migration 20260721120000_merge_suggestion_unique_pair is not applied in the backup');
    expect(result.summary).toContain('migrations=1-applied-1-pending');
    const { started, removed } = scratch(box);
    expect(removed).toEqual(started);
  });

  it('refuses a backup with no applied migration, which is not the schema the tracker migrates', () => {
    const { box, dump } = backedUp();
    const result = run(box, VERIFY, [bashPath(dump)], { STUB_APPLIED: '' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('records no applied migration');
  });
});
