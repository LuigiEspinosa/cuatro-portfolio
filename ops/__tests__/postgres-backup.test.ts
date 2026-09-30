// @vitest-environment node
import { describe, it, expect, afterAll, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Story 4-5: `ops/postgres-backup.sh` and `ops/postgres-restore-verify.sh`, the estate Postgres's nightly
// dump, its restic offsite copy and its proof by restore. Both run for real under bash against a `docker`
// stub on PATH that answers as `psql`, `pg_dump` and `pg_restore` answer in the instance and in the
// throwaway container, and as `restic` answers in its image, so what is held is the scripts' own logic:
// what they write, what they compare and refuse, the retention they ask restic for, and that the
// throwaway container is always removed. The real path, against a real Postgres 18.6 and a real restic
// repository, is quoted in `ops/postgres-backup.md` § Rehearsed off the box. Launcher and path mapping
// follow `tracker-backup.test.ts`.

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const HERE = dirname(fileURLToPath(import.meta.url));
const OPS = resolve(HERE, '..');
const ROOT = resolve(OPS, '..');
const BACKUP = join(OPS, 'postgres-backup.sh');
const VERIFY = join(OPS, 'postgres-restore-verify.sh');

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
const SNAPSHOT_ID = 'ab'.repeat(32);

const ROOTS: string[] = [];
afterAll(() => {
  for (const root of ROOTS) rmSync(root, { recursive: true, force: true });
});

// The instance answers as `postgres-estate-postgres-1`; any other exec target is the throwaway. Counts per
// database come from `STUB_COUNTS_<db>` as `schema.table=n,...`, and the throwaway's from
// `STUB_RESTORED_COUNTS_<db>` when set. restic's `restore` copies what `backup` was handed into the host
// directory mounted at /restore.
const DOCKER_STUB = `#!/usr/bin/env bash
echo "$*" >> "$STUB_LOG"
verb="$1"; shift
case "$verb" in
  inspect) echo "\${STUB_RUNNING:-true}"; exit 0 ;;
  rm) exit 0 ;;
  run|exec) ;;
  *) exit 2 ;;
esac
if [ "$verb" = run ]; then
  case " $* " in *' --detach '*) exit "\${STUB_RUN_EXIT:-0}" ;; esac
  restore_host=''; prev=''; seen=0; rest=()
  for a in "$@"; do
    if [ "$seen" -eq 1 ]; then rest+=("$a")
    elif [[ "$a" == restic/restic:* ]]; then seen=1
    elif [ "$prev" = -v ] && [[ "$a" == *:/restore ]]; then restore_host="\${a%:/restore}"
    fi
    prev="$a"
  done
  case "\${rest[0]}" in
    cat) exit "\${STUB_RESTIC_CAT_EXIT:-0}" ;;
    backup)
      printf '%s\\n' "\${rest[@]:1}" | grep '^/' > "$STUB_STATE/backed-up"
      echo '{"message_type":"summary","snapshot_id":"${SNAPSHOT_ID}"}'
      exit "\${STUB_RESTIC_BACKUP_EXIT:-0}" ;;
    forget) exit "\${STUB_RESTIC_FORGET_EXIT:-0}" ;;
    check) exit "\${STUB_RESTIC_CHECK_EXIT:-0}" ;;
    restore)
      while IFS= read -r f; do mkdir -p "$restore_host$(dirname "$f")"; cp "$f" "$restore_host$f"; done < "$STUB_STATE/backed-up"
      if [ -n "\${STUB_TAMPER:-}" ]; then find "$restore_host" -name '*.sha256' -exec sh -c 'echo x >> "$1"' _ {} \\; ; fi
      exit 0 ;;
    *) exit 2 ;;
  esac
fi
interactive=0
[ "$1" = -i ] && { interactive=1; shift; }
container="$1"; shift
live=0; [ "$container" = postgres-estate-postgres-1 ] && live=1
db=''; prev=''
for a in "$@"; do [ "$prev" = -d ] && db="$a"; prev="$a"; done
counts_for() {
  local var="STUB_COUNTS_$1" restored="STUB_RESTORED_COUNTS_$1"
  [ "$live" -eq 0 ] && [ -n "\${!restored:-}" ] && var="$restored"
  local value="\${!var:-}"
  [ -n "$value" ] && printf '%s\\n' \${value//,/ } | tr '=' '\\t'
  return 0
}
case "$1" in
  pg_isready|createdb) exit 0 ;;
  pg_dump)
    [ "\${STUB_DUMP_FAIL_DB:-}" = "$db" ] && exit 1
    printf 'PGDMP %s' "$db"
    case " $* " in *' --snapshot=0000000A-0000001B-1 '*) exit 0 ;; *) exit 3 ;; esac ;;
  pg_restore)
    cat > /dev/null
    case " $* " in *' --list '*) exit "\${STUB_LIST_EXIT:-0}" ;; esac
    exit "\${STUB_RESTORE_EXIT:-0}" ;;
  psql) ;;
  *) exit 2 ;;
esac
if [ "$interactive" -eq 0 ]; then
  sql="\${!#}"
  case "$sql" in
    *pg_database*) printf '%s\\n' $STUB_DATABASES ;;
    *information_schema.tables*) counts_for "$db" ;;
    *) exit 2 ;;
  esac
  exit 0
fi
while IFS= read -r line; do
  case "$line" in
    *pg_export_snapshot*) echo '0000000A-0000001B-1' ;;
    *information_schema.tables*) counts_for "$db" ;;
    *__end_of_counts__*) echo __end_of_counts__ ;;
  esac
done
exit 0
`;

interface Box {
  root: string;
  backups: string;
  config: string;
  log: string;
  env: Record<string, string>;
}

const makeBox = (configured = true): Box => {
  const root = mkdtempSync(join(tmpdir(), 'cuatro-postgres-backup-'));
  ROOTS.push(root);
  const bin = join(root, 'bin');
  const state = join(root, 'state');
  const backups = join(root, 'backups');
  for (const dir of [bin, state, backups]) mkdirSync(dir, { recursive: true });
  // A checkout with `core.autocrlf` hands this file, and so the stub's text, CRLF endings bash rejects.
  writeFileSync(join(bin, 'docker'), DOCKER_STUB.replace(/\r\n/g, '\n'));
  chmodSync(join(bin, 'docker'), 0o755);
  const log = join(root, 'docker.log');
  writeFileSync(log, '');
  const config = join(root, 'postgres-backup.env');
  if (configured) writeFileSync(config, 'RESTIC_REPOSITORY=s3:https://example.invalid/bucket\nRESTIC_PASSWORD=fixture\n');
  return {
    root,
    backups,
    config,
    log,
    env: {
      PATH: `${bashPath(bin)}:${POSIX_PATH}`,
      STUB_LOG: bashPath(log),
      STUB_STATE: bashPath(state),
      POSTGRES_BACKUP_DIR: bashPath(backups),
      POSTGRES_BACKUP_CONFIG: bashPath(config),
      STUB_DATABASES: 'cuatro_tracker umami',
      STUB_COUNTS_cuatro_tracker: 'public.media=1000,public.user=2',
      STUB_COUNTS_umami: 'analytics.session=3,public.website_event=250',
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

const files = (box: Box): string[] => readdirSync(box.backups).filter((name) => name.startsWith('pg-')).sort();
const logLines = (box: Box): string[] => readFileSync(box.log, 'utf8').split('\n').filter(Boolean);
const resticCalls = (box: Box, sub: string): string[] => logLines(box).filter((line) => line.startsWith('run ') && line.includes(` restic/restic:0.19.1 ${sub}`));
const scratch = (box: Box): { started: string[]; removed: string[] } => ({
  started: logLines(box).filter((line) => line.startsWith('run --detach')).map((line) => /--name (\S+)/.exec(line)?.[1] ?? ''),
  removed: logLines(box).filter((line) => line.startsWith('rm --force --volumes ')).map((line) => line.slice('rm --force --volumes '.length)),
});

describe('ops/postgres-backup.sh', () => {
  it('dumps every database in its snapshot, sends the night offsite, forgets, checks, restores it back and verifies it', () => {
    const box = makeBox();
    const result = run(box, BACKUP);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.summary).toMatch(
      /^postgres-backup ts=\S+ databases=2 dumps=ok tables=4 rows=1255 bytes=\d+ offsite=ok-abababab forget=ok check=ok roundtrip=sha256-match restore=verified prune=removed-0-aged-over-14-whole-days exit=0$/
    );
    const written = files(box);
    expect(written).toHaveLength(6);
    const tracker = written.find((name) => /^pg-cuatro_tracker-\d{8}T\d{6}Z\.dump$/.test(name));
    expect(tracker).toBeDefined();
    expect(readFileSync(join(box.backups, tracker!), 'utf8')).toBe('PGDMP cuatro_tracker');
    expect(readFileSync(join(box.backups, `${tracker}.counts`), 'utf8')).toBe('public.media\t1000\npublic.user\t2\n');
    expect(readFileSync(join(box.backups, `${tracker}.sha256`), 'utf8')).toMatch(/^[0-9a-f]{64} {2}pg-cuatro_tracker-\d{8}T\d{6}Z\.dump\n$/);
    // pg_dump took the snapshot the counting session exported (the stub fails any other).
    expect(logLines(box).filter((line) => line.includes('pg_dump'))).toHaveLength(2);
    expect(logLines(box).every((line) => !line.includes('pg_dump') || line.includes('--snapshot=0000000A-0000001B-1'))).toBe(true);
  });

  it('asks restic for exactly this night, the stated retention grouped by host and tag, and the env file by --env-file', () => {
    const box = makeBox();
    expect(run(box, BACKUP).status).toBe(0);
    const [backup] = resticCalls(box, 'backup');
    const sent = backup.slice(backup.indexOf(' backup ')).split(' ').filter((word) => word.startsWith('/')).map((path) => path.split('/').pop()).sort();
    expect(sent).toEqual(files(box));
    const [forget] = resticCalls(box, 'forget');
    expect(forget).toContain('forget --host estate-postgres --tag estate-postgres --group-by host,tags --keep-daily 14 --keep-weekly 8 --keep-monthly 6 --prune');
    for (const line of logLines(box).filter((l) => l.includes('restic/restic:0.19.1'))) {
      expect(line).toContain(`--env-file ${bashPath(box.config)}`);
      expect(line).toMatch(/--user \d+:\d+ /);
      expect(line).not.toContain('fixture');
    }
    expect(resticCalls(box, 'check')).toHaveLength(1);
    expect(resticCalls(box, `restore ${SNAPSHOT_ID} --target /restore`)).toHaveLength(1);
    expect(readdirSync(box.backups).filter((name) => name.startsWith('.restore'))).toEqual([]);
  });

  it('verifies in a throwaway container with no network, removed with its volume', () => {
    const box = makeBox();
    expect(run(box, BACKUP).status).toBe(0);
    const { started, removed } = scratch(box);
    expect(started).toHaveLength(1);
    expect(removed).toEqual(started);
    expect(logLines(box).find((line) => line.startsWith('run --detach'))).toMatch(/--network none .*postgres:18\.6-trixie$/);
  });

  it('without the env file writes and verifies the local dumps, prunes, and exits 75', () => {
    const box = makeBox(false);
    const result = run(box, BACKUP);
    expect(result.status).toBe(75);
    expect(result.stderr).toContain('does not exist; the local dumps are written and verified');
    expect(result.summary).toContain('offsite=not-configured forget=skipped check=skipped roundtrip=skipped restore=verified-local prune=removed-0');
    expect(files(box)).toHaveLength(6);
    expect(resticCalls(box, '')).toEqual([]);
  });

  // A mode on /mnt/c is not enforced for WSL's bash, so this runs where CI runs it, on a Linux filesystem.
  it.skipIf(process.platform === 'win32')('refuses an env file this account cannot read, keeping the dumps and pruning nothing', () => {
    const box = makeBox();
    chmodSync(box.config, 0o000);
    const result = run(box, BACKUP);
    chmodSync(box.config, 0o600);
    // Only meaningful when not run as root, which reads a 000 file anyway (never so in CI).
    expect(result.status).toBe(1);
    expect(result.summary).toContain('offsite=config-unreadable');
    expect(result.summary).toContain('prune=not-reached');
    expect(files(box)).toHaveLength(6);
  });

  it('refuses an env file without a repository password, naming it', () => {
    const box = makeBox();
    writeFileSync(box.config, 'RESTIC_REPOSITORY=s3:https://example.invalid/bucket\nRESTIC_PASSWORD=\n');
    const result = run(box, BACKUP);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('sets no RESTIC_PASSWORD');
    expect(result.summary).toContain('offsite=misconfigured');
    expect(files(box)).toHaveLength(6);
  });

  it('tells a repository that does not exist from one it cannot reach', () => {
    const missing = makeBox();
    const first = run(missing, BACKUP, [], { STUB_RESTIC_CAT_EXIT: '10' });
    expect(first.status).toBe(1);
    expect(first.summary).toContain('offsite=not-initialized');
    expect(first.stderr).toContain('restic init');
    const down = makeBox();
    const second = run(down, BACKUP, [], { STUB_RESTIC_CAT_EXIT: '1' });
    expect(second.status).toBe(1);
    expect(second.summary).toContain('offsite=unreachable');
    expect(resticCalls(down, 'backup')).toEqual([]);
  });

  it('fails a night whose forget or check fails, keeping the dumps', () => {
    const forget = makeBox();
    expect(run(forget, BACKUP, [], { STUB_RESTIC_FORGET_EXIT: '1' }).summary).toContain('forget=failed check=not-reached');
    const check = makeBox();
    const result = run(check, BACKUP, [], { STUB_RESTIC_CHECK_EXIT: '1' });
    expect(result.status).toBe(1);
    expect(result.summary).toContain('check=failed roundtrip=not-reached');
    expect(files(check)).toHaveLength(6);
  });

  it('fails a night whose copy comes back from the repository different', () => {
    const box = makeBox();
    const result = run(box, BACKUP, [], { STUB_TAMPER: '1' });
    expect(result.status).toBe(1);
    expect(result.summary).toContain('roundtrip=mismatch restore=not-reached');
    expect(readdirSync(box.backups).filter((name) => name.startsWith('.restore'))).toEqual([]);
  });

  it('fails a night whose restored copy does not count what the dump counted, naming the table', () => {
    const box = makeBox();
    const result = run(box, BACKUP, [], { STUB_RESTORED_COUNTS_umami: 'analytics.session=3,public.website_event=249' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('umami: public.website_event restored 249 rows, and the live database held 250');
    expect(result.summary).toContain('restore=failed prune=not-reached');
    const { started, removed } = scratch(box);
    expect(removed).toEqual(started);
  });

  it('removes this run\'s files when a dump fails, and leaves earlier nights alone', () => {
    const box = makeBox(false);
    writeFileSync(join(box.backups, 'pg-umami-20260101T031500Z.dump'), 'older night');
    const result = run(box, BACKUP, [], { STUB_DUMP_FAIL_DB: 'umami' });
    expect(result.status).toBe(1);
    expect(result.summary).toContain('dumps=failed-umami');
    expect(files(box)).toEqual(['pg-umami-20260101T031500Z.dump']);
  });

  it('prunes pg-* files past fourteen whole days and nothing else', () => {
    const box = makeBox();
    const day = 24 * 60 * 60;
    const now = Date.now() / 1000;
    const aged = (name: string, days: number) => {
      writeFileSync(join(box.backups, name), 'fixture');
      utimesSync(join(box.backups, name), now - days * day, now - days * day);
    };
    aged('pg-umami-20260901T031500Z.dump', 16);
    aged('pg-umami-20260917T031500Z.dump', 13);
    aged('backup.log', 30);
    const result = run(box, BACKUP);
    expect(result.status).toBe(0);
    expect(result.summary).toContain('prune=removed-1-aged-over-14-whole-days');
    expect(existsSync(join(box.backups, 'pg-umami-20260901T031500Z.dump'))).toBe(false);
    expect(existsSync(join(box.backups, 'pg-umami-20260917T031500Z.dump'))).toBe(true);
    expect(existsSync(join(box.backups, 'backup.log'))).toBe(true);
  });

  it('refuses an instance that is not running or holds no consumer database', () => {
    const stopped = makeBox();
    const first = run(stopped, BACKUP, [], { STUB_RUNNING: 'false' });
    expect(first.status).toBe(1);
    expect(first.stderr).toContain('postgres-estate-postgres-1 is not running');
    const empty = makeBox();
    const second = run(empty, BACKUP, [], { STUB_DATABASES: '' });
    expect(second.status).toBe(1);
    expect(second.stderr).toContain('holds no consumer database');
    expect(files(empty)).toEqual([]);
  });
});

describe('ops/postgres-restore-verify.sh', () => {
  const backedUp = (): { box: Box; dumps: string[] } => {
    const box = makeBox(false);
    expect(run(box, BACKUP).status).toBe(75);
    writeFileSync(box.log, '');
    return { box, dumps: files(box).filter((name) => name.endsWith('.dump')).map((name) => bashPath(join(box.backups, name))) };
  };

  it('proves every dump and removes its container', () => {
    const { box, dumps } = backedUp();
    const result = run(box, VERIFY, dumps);
    expect(result.status).toBe(0);
    expect(result.summary).toBe('postgres-restore-verify dumps=2 sha256=match restore=ok tables=4 rows=1255 exit=0');
    const { started, removed } = scratch(box);
    expect(started).toHaveLength(1);
    expect(removed).toEqual(started);
  });

  it('refuses a dump changed since its checksum, before starting anything', () => {
    const { box, dumps } = backedUp();
    writeFileSync(join(box.backups, dumps[0].split('/').pop()!), 'PGDMP tampered');
    const result = run(box, VERIFY, dumps);
    expect(result.status).toBe(1);
    expect(result.summary).toContain('sha256=mismatch');
    expect(scratch(box).started).toEqual([]);
  });

  it('refuses a restore whose tables are not the counted ones, naming the database', () => {
    const { box, dumps } = backedUp();
    const result = run(box, VERIFY, dumps, { STUB_RESTORED_COUNTS_cuatro_tracker: 'public.media=1000' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('cuatro_tracker: the restored tables are not the tables the counts file names');
  });

  it('refuses a dump pg_restore does not finish, and still removes the container', () => {
    const { box, dumps } = backedUp();
    const result = run(box, VERIFY, dumps, { STUB_RESTORE_EXIT: '1' });
    expect(result.status).toBe(1);
    expect(result.summary).toContain('restore=failed-cuatro_tracker');
    const { started, removed } = scratch(box);
    expect(removed).toEqual(started);
  });

  it('refuses a file not named as the backup names its dumps', () => {
    const { box } = backedUp();
    const result = run(box, VERIFY, ['/tmp/tracker-20260101T000000Z.dump']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('is not named pg-<database>-<stamp>.dump');
  });
});

describe('the scripts as committed', () => {
  const COMPOSE = readFileSync(join(OPS, 'postgres', 'compose.yml'), 'utf8');
  const RECORD = readFileSync(join(OPS, 'postgres-backup.md'), 'utf8');

  it('restores on the instance\'s own image, and pins restic exact', () => {
    const image = /^ {4}image: (\S+)$/m.exec(COMPOSE)?.[1];
    expect(image).toBe('postgres:18.6-trixie');
    expect(readFileSync(VERIFY, 'utf8')).toContain(`IMAGE='${image}'`);
    expect(readFileSync(BACKUP, 'utf8')).toContain("RESTIC_IMAGE='restic/restic:0.19.1'");
  });

  it('states in the record the retention the script asks restic for', () => {
    expect(readFileSync(BACKUP, 'utf8')).toContain('KEEP=(--keep-daily 14 --keep-weekly 8 --keep-monthly 6)');
    expect(RECORD).toContain('--keep-daily 14 --keep-weekly 8 --keep-monthly 6');
  });

  it('ships both scripts LF and executable', () => {
    for (const script of ['ops/postgres-backup.sh', 'ops/postgres-restore-verify.sh']) {
      const staged = spawnSync('git', ['ls-files', '-s', script], { cwd: ROOT, encoding: 'utf8' });
      expect(staged.stdout).toMatch(/^100755 /);
      expect(readFileSync(join(ROOT, script), 'utf8')).not.toContain('\r');
    }
  });
});
