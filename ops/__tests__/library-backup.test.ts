// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, chmodSync, utimesSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// `ops/s3-object.sh`, `ops/library-backup.sh` and `ops/library-restore-verify.sh`
// are shell scripts, which `tsconfig.json:34-41` cannot typecheck, so this file
// is where their contract is actually asserted. Same precedent as
// `ops/__tests__/capacity-summary.test.ts`, which reads `capacity-sampler.sh`
// and pins its schema literal.
//
// Every `describe` below is one row of the spec's I/O and edge-case matrix,
// followed by the acceptance criteria that are not matrix rows.
//
// Two kinds of case. The signing cases run an independent SigV4 implementation
// in Node, check it against vectors AWS publishes with their expected
// signatures, derive the golden vector from first principles, and require the
// bash implementation to produce the same bytes in its `selftest` and on the
// wire. The orchestration cases run `library-backup.sh` for real against a PATH
// of stubs for `sqlite3`, `sudo`, `gpg`, `docker` and `curl`, in a scratch
// directory, so `tar`, `gzip`, `find`, `timeout` and `openssl` are exercised as
// themselves.

// Every case spawns a real bash and runs real `tar`, `gzip`, `find` and
// `openssl`, and on Windows that bash is WSL's, which costs roughly a second
// per spawn. Vitest's 5 second default is a comfortable fit when this file runs
// alone and not when it runs beside sixteen others on a loaded machine, so the
// budget is raised here rather than in `vitest.config.ts`, where it would
// loosen the whole suite.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const HERE = dirname(fileURLToPath(import.meta.url));
const OPS = resolve(HERE, '..');
const S3_OBJECT = join(OPS, 's3-object.sh');
const LIBRARY_BACKUP = join(OPS, 'library-backup.sh');
const RESTORE_VERIFY = join(OPS, 'library-restore-verify.sh');
const RECORD = join(OPS, 'backup-digital-library.md');

// On this host `bash` resolves to `C:\WINDOWS\system32\bash.exe`, which is WSL's
// bash and reads paths in `/mnt/c/...` form rather than `C:\...`. CI is
// `ubuntu-latest`, where the same spawn needs no mapping at all.
const bashPath = (windowsOrPosixPath: string): string =>
  process.platform === 'win32'
    ? windowsOrPosixPath.replace(/^([A-Za-z]):/, (_match, drive: string) => `/mnt/${drive.toLowerCase()}`).replace(/\\/g, '/')
    : windowsOrPosixPath;

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

// Node resolves the executable against the PATH it is handed, and the PATH
// these runs are handed is a POSIX one for the child's benefit, so the
// interpreter itself is named absolutely on Windows rather than looked up.
const BASH = (() => {
  if (process.platform !== 'win32') return 'bash';
  const candidate = join(process.env.SystemRoot ?? 'C:\\Windows', 'system32', 'bash.exe');
  return existsSync(candidate) ? candidate : 'bash';
})();

const POSIX_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';

// Every variable the three scripts read. Cleared before each run, so a value
// this host happens to export can never make a case pass or fail.
const SCRIPT_VARIABLES = [
  'S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY',
  'S3_PREFIX', 'S3_OBJECT_CLIENT', 'S3_CONNECT_TIMEOUT', 'S3_MAX_TIME', 'BACKUP_PASSPHRASE',
  'LIBRARY_BACKUP_CONFIG', 'LIBRARY_DATA_DIR', 'LIBRARY_BACKUP_DIR', 'LIBRARY_RETENTION_DAYS',
  'LIBRARY_RESTORE_VERIFY', 'LIBRARY_REDIS_CONTAINER', 'LIBRARY_REDIS_VOLUME_DIR',
  'LIBRARY_BACKUP_LOCK', 'LIBRARY_DOCKER_TIMEOUT',
  'MAX_ARCHIVE_BYTES', 'VERIFY_MAX_BYTES', 'TMPDIR',
  'STUB_CURL_LOG', 'STUB_CURL_ARGV', 'STUB_BUCKET', 'STUB_PUT_CODE', 'STUB_GET_CODE',
  'STUB_CORRUPT_GET', 'STUB_REDIS_DBSIZE', 'STUB_DOCKER_FAIL', 'STUB_SQLITE_INTEGRITY',
  'STUB_SQLITE_OBJECTS', 'STUB_SQLITE_TABLES', 'STUB_DATE_STAMP',
];

const shellQuote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

/** Every temporary root this file creates, so the suite removes what it made. */
const TEMP_ROOTS: string[] = [];
const makeTempRoot = (name: string): string => {
  const root = mkdtempSync(join(tmpdir(), `cuatro-${name}-`));
  TEMP_ROOTS.push(root);
  return root;
};

const LAUNCHERS = makeTempRoot('launcher');
let launcherCount = 0;

afterAll(() => {
  for (const root of TEMP_ROOTS) {
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      // A directory that will not delete is not a test failure, and leaving a
      // stale temp root is better than failing a green suite over cleanup.
    }
  }
});

// The environment is set by a generated launcher script rather than by
// `spawnSync`'s `env`. On Windows the child is WSL's bash, and WSL hands a
// Windows environment variable to the Linux process only when it is named in
// `WSLENV`, so anything set the ordinary way is simply absent on the other
// side. A launcher behaves identically here and on `ubuntu-latest`, and it
// keeps every value out of a command line that two different argument parsers
// would otherwise have to agree about.
//
// `literalArgs` are emitted into the launcher unquoted, which is the only way
// to hand the script an argument holding a newline or an empty string without
// two argument parsers having to agree about it first.
const runBash = (
  script: string,
  args: string[],
  env: Record<string, string> = {},
  literalArgs: string[] = []
): RunResult => {
  const merged: Record<string, string> = { PATH: POSIX_PATH, ...env };
  const launcher = join(LAUNCHERS, `run-${(launcherCount += 1)}.sh`);
  writeFileSync(
    launcher,
    [
      '#!/usr/bin/env bash',
      `unset ${SCRIPT_VARIABLES.join(' ')}`,
      ...Object.entries(merged).map(([name, value]) => `export ${name}=${shellQuote(value)}`),
      `exec bash "$@" ${literalArgs.join(' ')}`,
      '',
    ].join('\n')
  );
  chmodSync(launcher, 0o755);

  const result = spawnSync(BASH, [bashPath(launcher), bashPath(script), ...args], { encoding: 'utf8' });
  if (result.error) throw result.error;
  return { status: result.status ?? -1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
};

// ---------------------------------------------------------------------------
// The Node reference implementation of AWS SigV4, written from the specification
// rather than from `s3-object.sh`. If both were derived from each other this
// file would only prove they are the same, not that either is right.
// ---------------------------------------------------------------------------

const sha256Hex = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const hmac = (key: Buffer | string, value: string): Buffer => createHmac('sha256', key).update(value).digest();

interface SignInput {
  secret: string;
  region: string;
  service: string;
  method: string;
  uri: string;
  query: string;
  headers: Record<string, string>;
  payloadHash: string;
  amzDate: string;
}

const referenceSign = (input: SignInput): { scope: string; signedHeaders: string; signature: string } => {
  const lowered = Object.entries(input.headers).map(([name, value]) => [name.toLowerCase(), value.trim()] as const);
  lowered.sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0));
  const canonicalHeaders = lowered.map(([name, value]) => `${name}:${value}\n`).join('');
  const signedHeaders = lowered.map(([name]) => name).join(';');
  const canonicalRequest = [input.method, input.uri, input.query, canonicalHeaders, signedHeaders, input.payloadHash].join('\n');
  const stamp = input.amzDate.slice(0, 8);
  const scope = `${stamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', input.amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const kDate = hmac(`AWS4${input.secret}`, stamp);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, input.service);
  const kSigning = hmac(kService, 'aws4_request');
  return { scope, signedHeaders, signature: hmac(kSigning, stringToSign).toString('hex') };
};

const AWS_EXAMPLE_SECRET = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
const AWS_EXAMPLE_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

// The golden vector, pinned. `ops/s3-object.sh` carries this same string as
// `GOLDEN_AUTHORIZATION` and its `selftest` recomputes and compares it, so
// changing either implementation without the other fails here.
const GOLDEN_AUTHORIZATION =
  'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20260824/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=16c2a64a6dd328c0d52c7544842a9c742be8504a5325640801954b32a8d5013b';

// ---------------------------------------------------------------------------
// The stub box. `sqlite3`, `sudo`, `gpg`, `docker` and `curl` are the five
// binaries the nightly job reaches for that either do not exist on the test
// runner or must not be allowed to touch a network.
// ---------------------------------------------------------------------------

const STUBS: Record<string, string> = {
  // `.backup '<path>'` copies the source, which is what the real dot-command
  // does for a quiescent database. Everything else answers a query. Leading
  // options are skipped, because the real call now carries `-cmd '.timeout ...'`.
  sqlite3: `#!/usr/bin/env bash
while [ "$#" -gt 0 ]; do
  case "$1" in
    -cmd|-init) shift 2 ;;
    -*) shift ;;
    *) break ;;
  esac
done
db="$1"; shift
cmd="$*"
case "$cmd" in
  .backup*)
    target="$(printf '%s' "$cmd" | sed "s/^[^']*'//; s/'.*$//")"
    cp "$db" "$target"
    ;;
  *integrity_check*)
    printf '%s\\n' "\${STUB_SQLITE_INTEGRITY:-ok}"
    ;;
  *count\\(*\\)*sqlite_master*)
    printf '%s\\n' "\${STUB_SQLITE_OBJECTS:-11}"
    ;;
  *FROM\\ sqlite_master*)
    printf '%s\\n' "\${STUB_SQLITE_TABLES-users
sessions}"
    ;;
  *count\\(*)
    printf '1\\n'
    ;;
  *)
    printf '\\n'
    ;;
esac
`,
  // The test runner is not root, so `chown` is a no-op and everything else runs
  // as the caller. That is the whole of what `sudo` does for this script.
  sudo: `#!/usr/bin/env bash
while [ "$#" -gt 0 ]; do
  case "$1" in -n|-E|-H) shift ;; *) break ;; esac
done
case "\${1:-}" in chown) exit 0 ;; esac
exec "$@"
`,
  // Identity in both directions, so a real `tar -xzf` still reads what a real
  // `tar -czf` wrote and the round trip is exercised end to end. The real gpg
  // path is proved on the box instead, and recorded in the ops record.
  gpg: `#!/usr/bin/env bash
out=''; input=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    --output) out="$2"; shift 2 ;;
    --cipher-algo|--passphrase-fd|--pinentry-mode) shift 2 ;;
    --batch|--yes|--quiet|--symmetric|--decrypt) shift ;;
    *) input="$1"; shift ;;
  esac
done
cat > /dev/null
[ -n "$out" ] || exit 1
cp "$input" "$out"
`,
  // Only the archive stamp is overridable, and only when a case asks for it.
  // Everything else delegates, so a fixed stamp can be used to reproduce two
  // runs colliding on one filename without freezing the clock.
  date: `#!/usr/bin/env bash
if [ -n "\${STUB_DATE_STAMP:-}" ]; then
  for a in "$@"; do
    if [ "\$a" = '+%Y%m%dT%H%M%SZ' ]; then
      printf '%s\\n' "\$STUB_DATE_STAMP"
      exit 0
    fi
  done
fi
for candidate in /usr/bin/date /bin/date; do
  [ -x "\$candidate" ] && exec "\$candidate" "$@"
done
exit 1
`,
  docker: `#!/usr/bin/env bash
if [ "\${STUB_DOCKER_FAIL:-0}" = '1' ]; then
  printf 'Cannot connect to the Docker daemon\\n' >&2
  exit 1
fi
printf '%s\\n' "\${STUB_REDIS_DBSIZE:-0}"
`,
  // A bucket in a directory. PUT writes the body under a flattened key, GET
  // reads it back, and every invocation's full argv is recorded so a case can
  // assert the request that actually carried the signature, not just that a
  // request happened.
  curl: `#!/usr/bin/env bash
argv=("$@")
{
  printf 'CALL\\n'
  for a in "\${argv[@]}"; do printf 'ARG %s\\n' "$a"; done
} >> "$STUB_CURL_ARGV"

method='GET'; out=''; data=''; url=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    -X) method="$2"; shift 2 ;;
    -o) out="$2"; shift 2 ;;
    --data-binary) data="\${2#@}"; shift 2 ;;
    -H|-w|--connect-timeout|--max-time) shift 2 ;;
    -sS|-s|-S) shift ;;
    *) url="$1"; shift ;;
  esac
done
rest="\${url#*://}"
key="\${rest#*/}"
printf '%s %s\\n' "$method" "$key" >> "$STUB_CURL_LOG"
flat="\${key//\\//__}"
if [ "$method" = 'PUT' ]; then
  code="\${STUB_PUT_CODE:-200}"
  case "$code" in 2??) cp "$data" "\$STUB_BUCKET/\$flat" ;; esac
  printf '%s' "$code"
  exit 0
fi
code="\${STUB_GET_CODE:-200}"
case "$code" in
  2??)
    if [ -f "\$STUB_BUCKET/\$flat" ]; then
      cp "\$STUB_BUCKET/\$flat" "$out"
    else
      printf 'NoSuchKey' > "$out"
      code='404'
    fi
    ;;
  *)
    printf '<Error><Code>AccessDenied</Code></Error>' > "$out"
    ;;
esac
if [ "\${STUB_CORRUPT_GET:-0}" = '1' ]; then printf 'x' >> "$out"; fi
printf '%s' "$code"
`,
};

const CONFIG_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
const CONFIG_BUCKET = 'cuatro-library-backup';
const CONFIG_REGION = 'auto';

interface Box {
  root: string;
  bin: string;
  data: string;
  backups: string;
  bucket: string;
  curlLog: string;
  curlArgv: string;
  config: string;
  env: Record<string, string>;
}

const makeBox = (name: string): Box => {
  const root = makeTempRoot(name);
  const bin = join(root, 'bin');
  const data = join(root, 'data');
  const backups = join(root, 'backups');
  const bucket = join(root, 'bucket');
  const work = join(root, 'work');
  for (const dir of [bin, data, backups, bucket, work, join(data, 'books'), join(data, 'covers'), join(data, 'inbox')]) {
    mkdirSync(dir, { recursive: true });
  }

  for (const [tool, source] of Object.entries(STUBS)) {
    const file = join(bin, tool);
    writeFileSync(file, source.replace(/\r\n/g, '\n'), { encoding: 'utf8' });
    chmodSync(file, 0o755);
  }

  // A stand-in for the live store. Its content does not matter to any assertion
  // here; that it is copied through the whole pipeline unchanged does.
  writeFileSync(join(data, 'library.db'), 'SQLite format 3\u0000 fixture');

  const curlLog = join(root, 'curl.log');
  const curlArgv = join(root, 'curl.argv');
  const config = join(root, 'library-backup.env');

  return {
    root,
    bin,
    data,
    backups,
    bucket,
    curlLog,
    curlArgv,
    config,
    env: {
      // Deliberately not built from `process.env.PATH`. On Windows that holds
      // `C:\...` entries separated by semicolons, which mean nothing to the
      // bash that actually runs these scripts. A fixed POSIX PATH with the stub
      // directory in front behaves identically here and on `ubuntu-latest`.
      PATH: `${bashPath(bin)}:${POSIX_PATH}`,
      LIBRARY_BACKUP_CONFIG: bashPath(config),
      LIBRARY_DATA_DIR: bashPath(data),
      LIBRARY_BACKUP_DIR: bashPath(backups),
      S3_OBJECT_CLIENT: bashPath(S3_OBJECT),
      LIBRARY_RESTORE_VERIFY: bashPath(RESTORE_VERIFY),
      TMPDIR: bashPath(work),
      STUB_CURL_LOG: bashPath(curlLog),
      STUB_CURL_ARGV: bashPath(curlArgv),
      STUB_BUCKET: bashPath(bucket),
      LIBRARY_REDIS_VOLUME_DIR: bashPath(join(root, 'no-such-redis-volume')),
    },
  };
};

const writeConfig = (box: Box, overrides: Record<string, string> = {}): void => {
  const values: Record<string, string> = {
    S3_ENDPOINT: CONFIG_ENDPOINT,
    S3_REGION: CONFIG_REGION,
    S3_BUCKET: CONFIG_BUCKET,
    S3_ACCESS_KEY_ID: AWS_EXAMPLE_KEY_ID,
    S3_SECRET_ACCESS_KEY: AWS_EXAMPLE_SECRET,
    BACKUP_PASSPHRASE: 'fixture-passphrase-not-a-real-one',
    ...overrides,
  };
  writeFileSync(box.config, `${Object.entries(values).map(([name, value]) => `${name}='${value}'`).join('\n')}\n`);
};

const runBackup = (box: Box, env: Record<string, string> = {}): RunResult =>
  runBash(LIBRARY_BACKUP, [], { ...box.env, ...env });

/** The single summary line, which must be exactly one line on every path. */
const summaryOf = (result: RunResult): string => {
  const lines = result.stdout.split('\n').filter((line) => line.startsWith('library-backup ts='));
  expect(lines).toHaveLength(1);
  return lines[0];
};

/** `snapshot=ok` and friends, read out of the summary line. */
const field = (summary: string, name: string): string => {
  const match = summary.match(new RegExp(`(?:^| )${name}=([^ ]*)`));
  expect(match, `summary line has no ${name}= field: ${summary}`).not.toBeNull();
  return match![1];
};

const archivesIn = (box: Box): string[] => readdirSync(box.backups).filter((entry) => entry.startsWith('library-'));

interface CurlCall {
  args: string[];
  method: string;
  url: string;
  headers: Record<string, string>;
}

/** Every recorded `curl` invocation, parsed back into method, URL and headers. */
const curlCalls = (box: Box): CurlCall[] => {
  if (!existsSync(box.curlArgv)) return [];
  const calls: CurlCall[] = [];
  let current: string[] | null = null;
  for (const line of readFileSync(box.curlArgv, 'utf8').split('\n')) {
    if (line === 'CALL') {
      current = [];
      calls.push({ args: current, method: 'GET', url: '', headers: {} });
    } else if (line.startsWith('ARG ') && current) {
      current.push(line.slice(4));
    }
  }
  for (const call of calls) {
    for (let index = 0; index < call.args.length; index += 1) {
      const arg = call.args[index];
      if (arg === '-X') call.method = call.args[index + 1];
      else if (arg === '-H') {
        const header = call.args[index + 1];
        const split = header.indexOf(':');
        call.headers[header.slice(0, split).trim().toLowerCase()] = header.slice(split + 1).trim();
      } else if (arg.startsWith('http')) call.url = arg;
    }
  }
  return calls;
};

// ---------------------------------------------------------------------------
// Matrix row 1: a signed request.
// ---------------------------------------------------------------------------

describe('a signed request', () => {
  it('reproduces the two SigV4 vectors AWS publishes, which is what makes the reference implementation a reference', () => {
    const get = referenceSign({
      secret: AWS_EXAMPLE_SECRET,
      region: 'us-east-1',
      service: 's3',
      method: 'GET',
      uri: '/test.txt',
      query: '',
      headers: {
        host: 'examplebucket.s3.amazonaws.com',
        range: 'bytes=0-9',
        'x-amz-content-sha256': EMPTY_SHA256,
        'x-amz-date': '20130524T000000Z',
      },
      payloadHash: EMPTY_SHA256,
      amzDate: '20130524T000000Z',
    });
    expect(get.signature).toBe('f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');

    const put = referenceSign({
      secret: AWS_EXAMPLE_SECRET,
      region: 'us-east-1',
      service: 's3',
      method: 'PUT',
      uri: '/test%24file.text',
      query: '',
      headers: {
        date: 'Fri, 24 May 2013 00:00:00 GMT',
        host: 'examplebucket.s3.amazonaws.com',
        'x-amz-content-sha256': '44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072',
        'x-amz-date': '20130524T000000Z',
        'x-amz-storage-class': 'REDUCED_REDUNDANCY',
      },
      payloadHash: '44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072',
      amzDate: '20130524T000000Z',
    });
    expect(put.signature).toBe('98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd');
  });

  it('derives the golden vector from first principles and it is the pinned one', () => {
    const golden = referenceSign({
      secret: AWS_EXAMPLE_SECRET,
      region: 'us-east-1',
      service: 's3',
      method: 'PUT',
      uri: '/examplebucket/digital-library/library-20260824T034500Z.tar.gz.gpg',
      query: '',
      headers: {
        host: 's3.us-east-1.amazonaws.com',
        'x-amz-content-sha256': EMPTY_SHA256,
        'x-amz-date': '20260824T034500Z',
      },
      payloadHash: EMPTY_SHA256,
      amzDate: '20260824T034500Z',
    });
    expect(
      `AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/${golden.scope}, SignedHeaders=${golden.signedHeaders}, Signature=${golden.signature}`
    ).toBe(GOLDEN_AUTHORIZATION);
  });

  it('makes s3-object.sh selftest produce that same Authorization header, byte for byte', () => {
    const result = runBash(S3_OBJECT, ['selftest']);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`computed: ${GOLDEN_AUTHORIZATION}`);
    expect(result.stdout).toContain('matches byte for byte');
  });

  it('pins the golden vector inside s3-object.sh itself, so the two cannot drift apart silently', () => {
    const source = readFileSync(S3_OBJECT, 'utf8');
    expect(source).toContain(`GOLDEN_AUTHORIZATION='${GOLDEN_AUTHORIZATION}'`);
  });

  // The `selftest` proves the arithmetic. This proves the request that carries
  // it. Without this, deleting the Authorization header from `cmd_put`, or
  // signing one URI while sending another, leaves every other case green.
  it('sends an Authorization header on the wire that the reference implementation reproduces exactly', () => {
    const box = makeBox('signed-wire');
    writeConfig(box);
    const result = runBackup(box);
    expect(result.status, result.stderr).toBe(0);

    const calls = curlCalls(box);
    // One PUT, then one GET for the round trip, then one GET for the restore.
    expect(calls.map((call) => call.method)).toEqual(['PUT', 'GET', 'GET']);

    const archive = archivesIn(box).find((name) => name.endsWith('.tar.gz.gpg'))!;
    const expectedKey = `digital-library/${archive}`;
    const expectedUrl = `${CONFIG_ENDPOINT}/${CONFIG_BUCKET}/${expectedKey}`;
    const localSha = sha256Hex(readFileSync(join(box.backups, archive)));

    for (const call of calls) {
      expect(call.url, 'the request went to a URL other than the signed bucket and key').toBe(expectedUrl);
      expect(call.headers.host).toBe('account.r2.cloudflarestorage.com');
      expect(call.headers['x-amz-date']).toMatch(/^\d{8}T\d{6}Z$/);

      const payloadHash = call.method === 'PUT' ? localSha : EMPTY_SHA256;
      expect(call.headers['x-amz-content-sha256'], 'the signed payload hash is not the hash of what was sent').toBe(payloadHash);

      const signed = referenceSign({
        secret: AWS_EXAMPLE_SECRET,
        region: CONFIG_REGION,
        service: 's3',
        method: call.method,
        uri: new URL(call.url).pathname,
        query: '',
        headers: {
          host: call.headers.host,
          'x-amz-content-sha256': payloadHash,
          'x-amz-date': call.headers['x-amz-date'],
        },
        payloadHash,
        amzDate: call.headers['x-amz-date'],
      });
      expect(call.headers.authorization, `the ${call.method} carried a signature the reference does not reproduce`).toBe(
        `AWS4-HMAC-SHA256 Credential=${AWS_EXAMPLE_KEY_ID}/${signed.scope}, SignedHeaders=${signed.signedHeaders}, Signature=${signed.signature}`
      );
    }
  });

  it('bounds every request in time, so a stalled endpoint cannot hang the 03:45 job', () => {
    const box = makeBox('timeouts');
    writeConfig(box);
    expect(runBackup(box).status).toBe(0);
    for (const call of curlCalls(box)) {
      expect(call.args).toContain('--connect-timeout');
      expect(call.args).toContain('--max-time');
    }
  });
});

// ---------------------------------------------------------------------------
// Matrix row 2: an unsafe object key.
// ---------------------------------------------------------------------------

describe('an unsafe object key', () => {
  const credentials = {
    S3_ENDPOINT: CONFIG_ENDPOINT,
    S3_BUCKET: CONFIG_BUCKET,
    S3_ACCESS_KEY_ID: AWS_EXAMPLE_KEY_ID,
    S3_SECRET_ACCESS_KEY: AWS_EXAMPLE_SECRET,
  };

  const cases: Array<[string, string]> = [
    ['a key holding a space', 'digital-library/library 2026.tar.gz.gpg'],
    ['a key holding ..', 'digital-library/../../etc/shadow'],
    ['a key with a leading slash', '/digital-library/library.tar.gz.gpg'],
  ];

  for (const [label, key] of cases) {
    it(`refuses ${label} before any network call, naming the key`, () => {
      const box = makeBox('unsafe-key');
      const payload = join(box.root, 'payload.bin');
      writeFileSync(payload, 'anything');

      const result = runBash(S3_OBJECT, ['put', bashPath(payload), key], { ...box.env, ...credentials });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('unsafe object key');
      expect(result.stderr).toContain(key);
      expect(existsSync(box.curlArgv), 'a request was made for a key that should never have reached the network').toBe(false);
    });
  }

  it('refuses a key holding a newline, without echoing it back', () => {
    const box = makeBox('newline-key');
    const payload = join(box.root, 'payload.bin');
    writeFileSync(payload, 'anything');

    // Emitted into the launcher literally, because an argument holding a
    // newline cannot survive two argument parsers agreeing about it.
    const result = runBash(S3_OBJECT, ['put', bashPath(payload)], { ...box.env, ...credentials }, [
      "$'digital-library/library\\n.tar.gz.gpg'",
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('contains a newline');
    expect(existsSync(box.curlArgv)).toBe(false);
  });

  it('refuses an empty key', () => {
    const box = makeBox('empty-key');
    const payload = join(box.root, 'payload.bin');
    writeFileSync(payload, 'anything');

    const result = runBash(S3_OBJECT, ['put', bashPath(payload)], { ...box.env, ...credentials }, ["''"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('empty object key');
    expect(existsSync(box.curlArgv)).toBe(false);
  });

  it('refuses an endpoint carrying a path and a bucket holding a slash, which would sign one URI and send another', () => {
    const box = makeBox('bad-endpoint');
    const payload = join(box.root, 'payload.bin');
    writeFileSync(payload, 'anything');

    const withPath = runBash(S3_OBJECT, ['put', bashPath(payload), 'digital-library/a.gpg'], {
      ...box.env,
      ...credentials,
      S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com/some/path',
    });
    expect(withPath.status).not.toBe(0);
    expect(withPath.stderr).toContain('S3_ENDPOINT must be a scheme and host with no path');

    const badBucket = runBash(S3_OBJECT, ['put', bashPath(payload), 'digital-library/a.gpg'], {
      ...box.env,
      ...credentials,
      S3_BUCKET: 'cuatro backup/nested',
    });
    expect(badBucket.status).not.toBe(0);
    expect(badBucket.stderr).toContain('S3_BUCKET must be a plain bucket name');

    expect(existsSync(box.curlArgv)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Matrix row 3: a missing credential.
// ---------------------------------------------------------------------------

describe('a missing credential', () => {
  it('names the empty variable and makes no request', () => {
    const box = makeBox('missing-credential');
    const payload = join(box.root, 'payload.bin');
    writeFileSync(payload, 'anything');

    const result = runBash(S3_OBJECT, ['put', bashPath(payload), 'digital-library/library.tar.gz.gpg'], {
      ...box.env,
      S3_ENDPOINT: CONFIG_ENDPOINT,
      S3_BUCKET: CONFIG_BUCKET,
      S3_ACCESS_KEY_ID: AWS_EXAMPLE_KEY_ID,
      S3_SECRET_ACCESS_KEY: '',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('S3_SECRET_ACCESS_KEY');
    expect(result.stderr).toContain('missing required configuration');
    expect(existsSync(box.curlArgv)).toBe(false);
  });

  it('names every missing variable at once rather than one per run', () => {
    const box = makeBox('missing-all');
    const payload = join(box.root, 'payload.bin');
    writeFileSync(payload, 'anything');

    const result = runBash(S3_OBJECT, ['put', bashPath(payload), 'digital-library/library.tar.gz.gpg'], {
      ...box.env,
      S3_ENDPOINT: '',
      S3_BUCKET: '',
      S3_ACCESS_KEY_ID: '',
      S3_SECRET_ACCESS_KEY: '',
    });

    expect(result.status).not.toBe(0);
    for (const name of ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
      expect(result.stderr).toContain(name);
    }
  });

  it('reports a readable config with empty values as misconfigured, not as unconfigured', () => {
    const box = makeBox('misconfigured');
    writeConfig(box, { S3_ACCESS_KEY_ID: '', S3_SECRET_ACCESS_KEY: '' });

    const result = runBackup(box);
    const summary = summaryOf(result);

    expect(result.status).not.toBe(0);
    expect(result.status).not.toBe(75);
    expect(field(summary, 'exit')).toBe(String(result.status));
    expect(field(summary, 'offsite')).toBe('misconfigured');
    expect(result.stderr).toContain('S3_ACCESS_KEY_ID');
    expect(result.stderr).toContain('S3_SECRET_ACCESS_KEY');
    expect(result.stderr).toContain('exists and is readable');
    expect(archivesIn(box), 'the local copy was not kept').toHaveLength(1);
    expect(existsSync(box.curlArgv)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Matrix row 4: a non-2xx from the endpoint.
// ---------------------------------------------------------------------------

describe('a non-2xx from the endpoint', () => {
  const credentials = {
    S3_ENDPOINT: CONFIG_ENDPOINT,
    S3_BUCKET: CONFIG_BUCKET,
    S3_ACCESS_KEY_ID: AWS_EXAMPLE_KEY_ID,
    S3_SECRET_ACCESS_KEY: AWS_EXAMPLE_SECRET,
  };

  it('names the method, the key and the status on a put', () => {
    const box = makeBox('put-403');
    const payload = join(box.root, 'payload.bin');
    writeFileSync(payload, 'anything');

    const result = runBash(S3_OBJECT, ['put', bashPath(payload), 'digital-library/library.tar.gz.gpg'], {
      ...box.env,
      ...credentials,
      STUB_PUT_CODE: '403',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('put:');
    expect(result.stderr).toContain('digital-library/library.tar.gz.gpg');
    expect(result.stderr).toContain('403');
  });

  it('names the method, the key and the status on a get, and leaves no partial output file', () => {
    const box = makeBox('get-403');
    const out = join(box.root, 'downloaded.bin');

    const result = runBash(S3_OBJECT, ['get', 'digital-library/library.tar.gz.gpg', bashPath(out)], {
      ...box.env,
      ...credentials,
      STUB_GET_CODE: '403',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('get:');
    expect(result.stderr).toContain('digital-library/library.tar.gz.gpg');
    expect(result.stderr).toContain('403');
    expect(existsSync(out), 'the destination was created from an error body').toBe(false);
    expect(readdirSync(box.root).filter((entry) => entry.includes('.partial.'))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Matrix row 5: offsite not configured.
// ---------------------------------------------------------------------------

describe('offsite not configured', () => {
  let box: Box;
  let result: RunResult;
  let summary: string;

  beforeAll(() => {
    box = makeBox('unconfigured');
    result = runBackup(box);
    summary = summaryOf(result);
  });

  it('completes the local snapshot, the integrity check, the archive and the prune', () => {
    expect(field(summary, 'snapshot')).toBe('ok');
    expect(field(summary, 'own')).toBe('ok');
    expect(field(summary, 'integrity')).toBe('ok');
    expect(field(summary, 'objects')).toBe('11');
    expect(field(summary, 'archive')).toMatch(/^library-\d{8}T\d{6}Z\.tar\.gz$/);
    expect(field(summary, 'tar')).toBe('first-attempt');
    expect(field(summary, 'prune')).toMatch(/^removed-\d+-aged-over-14-whole-days$/);
  });

  it('exits 75, which is not success, and says so in the same line', () => {
    expect(result.status).toBe(75);
    expect(field(summary, 'exit')).toBe('75');
    expect(field(summary, 'offsite')).toBe('not-configured');
    expect(field(summary, 'roundtrip')).toBe('skipped');
    expect(field(summary, 'restore')).toBe('skipped');
  });

  it('names the exact file the Operator must create, with the ownership the cron account can read', () => {
    expect(result.stdout).toContain(bashPath(box.config));
    expect(result.stdout).toContain('mode 0640');
    expect(result.stdout).toContain('S3_ENDPOINT');
    expect(result.stdout).toContain('BACKUP_PASSPHRASE');
    expect(result.stdout).toContain('ops/backup-digital-library.md');
  });

  it('leaves the local half intact: a fresh archive is on disk and nothing was uploaded', () => {
    expect(archivesIn(box)).toHaveLength(1);
    expect(statSync(join(box.backups, archivesIn(box)[0])).size).toBeGreaterThan(0);
    expect(existsSync(box.curlArgv)).toBe(false);
  });

  it('leaves the live store unwritten, and leaves no lock behind', () => {
    expect(readFileSync(join(box.data, 'library.db'), 'utf8')).toBe('SQLite format 3\u0000 fixture');
    expect(readdirSync(box.data).sort()).toEqual(['books', 'covers', 'inbox', 'library.db']);
    expect(readdirSync(box.backups)).not.toContain('.library-backup.lock');
  });
});

// ---------------------------------------------------------------------------
// The config exists but this account cannot read it. A different answer from
// "not configured", because the remedy is completely different.
// ---------------------------------------------------------------------------

describe('an offsite config that exists and cannot be read', () => {
  it('says so, does not tell the Operator to create it again, and keeps the local half', () => {
    const box = makeBox('config-unreadable');
    // A directory standing in for a file this account cannot source. Chmod 000
    // would be the truer fixture and does not survive a Windows drive mount, so
    // this shape is used instead: it exercises the same branch on both hosts.
    mkdirSync(box.config, { recursive: true });

    const result = runBackup(box);
    const summary = summaryOf(result);

    expect(result.status).not.toBe(0);
    expect(result.status).not.toBe(75);
    expect(field(summary, 'exit')).toBe(String(result.status));
    expect(field(summary, 'offsite')).toBe('config-unreadable');
    expect(field(summary, 'encrypt')).toBe('skipped-config-unreadable');
    expect(field(summary, 'snapshot')).toBe('ok');
    expect(field(summary, 'prune')).toMatch(/^removed-\d+/);
    expect(result.stdout).toContain('cannot read it');
    expect(result.stdout).toContain('Do not create it again');
    expect(result.stdout).not.toContain('to finish this, create');
    expect(archivesIn(box)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Matrix row 6: the snapshot fails its integrity check.
// ---------------------------------------------------------------------------

describe('a snapshot that fails its integrity check', () => {
  it('aborts before anything is uploaded and writes no object', () => {
    const box = makeBox('bad-integrity');
    writeConfig(box);

    const result = runBackup(box, { STUB_SQLITE_INTEGRITY: '*** in database main *** Page 4 is never used' });
    const summary = summaryOf(result);

    expect(result.status).not.toBe(0);
    expect(result.status).not.toBe(75);
    expect(field(summary, 'snapshot')).toBe('ok');
    expect(field(summary, 'integrity')).toBe('failed');
    expect(field(summary, 'offsite')).toBe('not-reached');
    expect(result.stderr).toContain('integrity_check');
    expect(existsSync(box.curlArgv), 'an object was written despite a failed integrity check').toBe(false);
    expect(readdirSync(box.bucket)).toEqual([]);
  });

  it('refuses a snapshot with no schema in it, which is what a file copy of this store would produce', () => {
    const box = makeBox('empty-schema');
    writeConfig(box);

    const result = runBackup(box, { STUB_SQLITE_OBJECTS: '0' });
    const summary = summaryOf(result);

    expect(result.status).not.toBe(0);
    expect(field(summary, 'integrity')).toBe('failed');
    expect(field(summary, 'objects')).toBe('0');
    expect(result.stderr).toContain('no schema objects');
    expect(existsSync(box.curlArgv)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Matrix row 7: the round trip disagrees.
// ---------------------------------------------------------------------------

describe('a round trip that disagrees', () => {
  it('fails after the upload rather than reporting success, and keeps the local copy', () => {
    const box = makeBox('roundtrip');
    writeConfig(box);

    const result = runBackup(box, { STUB_CORRUPT_GET: '1' });
    const summary = summaryOf(result);

    expect(result.status).not.toBe(0);
    expect(field(summary, 'offsite')).toMatch(/^ok-digital-library\//);
    expect(field(summary, 'roundtrip')).toBe('sha256-mismatch');
    expect(field(summary, 'restore')).toBe('not-reached');
    expect(result.stderr).toContain('sha256');
    expect(archivesIn(box)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Matrix row 8: the archive is over the size ceiling.
// ---------------------------------------------------------------------------

describe('an archive over the size ceiling', () => {
  it('refuses to upload, names both sizes, and keeps the local copy', () => {
    const box = makeBox('over-ceiling');
    writeConfig(box);

    const result = runBackup(box, { MAX_ARCHIVE_BYTES: '16' });
    const summary = summaryOf(result);

    expect(result.status).not.toBe(0);
    expect(field(summary, 'size')).toBe('over-ceiling');
    expect(field(summary, 'offsite')).toBe('not-reached');
    expect(result.stderr).toContain('MAX_ARCHIVE_BYTES');
    expect(result.stderr).toContain('16');
    expect(result.stderr).toContain(field(summary, 'bytes'));
    expect(Number(field(summary, 'bytes'))).toBeGreaterThan(16);
    expect(archivesIn(box)).toHaveLength(1);
    expect(existsSync(box.curlArgv), 'the ceiling was checked after the upload rather than before it').toBe(false);
  });

  // The ceiling is the entire justification for `put` buffering the body in
  // memory, so it must not be able to fail open on a junk value.
  it('refuses to run at all when a ceiling is not a number, rather than silently bypassing it', () => {
    for (const [variable, value] of [
      ['MAX_ARCHIVE_BYTES', 'lots'],
      ['MAX_ARCHIVE_BYTES', '268435456 '],
      ['VERIFY_MAX_BYTES', '32MB'],
      ['LIBRARY_RETENTION_DAYS', 'fourteen'],
    ]) {
      const box = makeBox('bad-ceiling');
      writeConfig(box);
      const result = runBackup(box, { [variable]: value });
      const summary = summaryOf(result);

      expect(result.status, `${variable}=${value} did not fail`).not.toBe(0);
      expect(field(summary, 'exit')).toBe(String(result.status));
      expect(result.stderr).toContain(`${variable} must be a whole number`);
      expect(field(summary, 'size')).toBe('not-reached');
      expect(existsSync(box.curlArgv)).toBe(false);
    }
  });

  it('falls back to the documented default when a ceiling is set to nothing, which fails closed rather than open', () => {
    const box = makeBox('empty-ceiling');
    writeConfig(box);
    const result = runBackup(box, { MAX_ARCHIVE_BYTES: '' });
    const summary = summaryOf(result);
    expect(result.status, result.stderr).toBe(0);
    expect(field(summary, 'size')).toBe('within-ceiling');
  });
});

// ---------------------------------------------------------------------------
// Matrix row 9: Redis stops being empty.
// ---------------------------------------------------------------------------

describe('a cache that stops being empty', () => {
  it('reports the emptiness it observed rather than staying silent, and completes the run', () => {
    const box = makeBox('redis-empty');
    writeConfig(box);
    const result = runBackup(box);
    const summary = summaryOf(result);

    expect(result.status, result.stderr).toBe(0);
    expect(field(summary, 'redis')).toBe('empty');
    expect(field(summary, 'roundtrip')).toBe('sha256-match');
    expect(field(summary, 'restore')).toBe('verified');
  });

  it('says so in the summary line when DBSIZE is not zero, and the run still completes', () => {
    const box = makeBox('redis-full');
    writeConfig(box);
    const result = runBackup(box, { STUB_REDIS_DBSIZE: '3' });
    const summary = summaryOf(result);

    expect(result.status, result.stderr).toBe(0);
    expect(field(summary, 'redis')).toContain('NON-EMPTY');
    expect(field(summary, 'redis')).toContain('3');
    expect(field(summary, 'redis')).toContain('not-in-this-archive');
  });

  it('says so when a dump.rdb appears in the volume', () => {
    const box = makeBox('redis-rdb');
    writeConfig(box);
    const volume = join(box.root, 'redis-volume');
    mkdirSync(volume, { recursive: true });
    writeFileSync(join(volume, 'dump.rdb'), 'REDIS0011');

    const result = runBackup(box, { LIBRARY_REDIS_VOLUME_DIR: bashPath(volume) });
    const summary = summaryOf(result);

    expect(result.status, result.stderr).toBe(0);
    expect(field(summary, 'redis')).toContain('dump.rdb-present');
  });

  // A check the script itself declares non-fatal must never be able to fail the
  // run or, with the timeout, to block it.
  it('reports an unreachable Docker and completes the backup anyway', () => {
    const box = makeBox('redis-unreachable');
    writeConfig(box);

    const result = runBackup(box, { STUB_DOCKER_FAIL: '1' });
    const summary = summaryOf(result);

    expect(result.status, result.stderr).toBe(0);
    expect(field(summary, 'redis')).toBe('unreachable');
    expect(field(summary, 'restore')).toBe('verified');
  });
});

// ---------------------------------------------------------------------------
// Matrix row 10: retention.
// ---------------------------------------------------------------------------

describe('the retention prune', () => {
  const hour = 3_600_000;

  const seedGenerations = (box: Box) => {
    const now = Date.now();
    const age = (name: string, hours: number, keep: boolean) => {
      const file = join(box.backups, name);
      writeFileSync(file, `fixture ${name}`);
      const when = new Date(now - hours * hour);
      utimesSync(file, when, when);
      return { name, keep };
    };
    return [
      // Generation one: the original compressed naming.
      age('library-2026-07-30_0617.db.gz', 25 * 24, false),
      // Generation two: the 25 root-owned uncompressed files the broken script
      // left, which its own prune pattern never matched.
      age('library-2026-07-31_0345.db', 24 * 24, false),
      age('library-2026-08-20_0345.db', 4 * 24, true),
      // Generation three: this script.
      age('library-20260801T034500Z.tar.gz.gpg', 23 * 24, false),
      age('library-20260823T034500Z.tar.gz.gpg', 1 * 24, true),
      // The boundary. `find -mtime +14` matches a file whose age in whole
      // 24-hour units is 15 or more, so just over 14 days survives and just
      // over 15 days does not. The extra hour keeps the case away from the
      // truncation edge, where a fixture written a moment before `find` runs
      // could land either side.
      age('library-20260810T034500Z.tar.gz.gpg', 14 * 24 + 1, true),
      age('library-20260809T034500Z.tar.gz.gpg', 15 * 24 + 1, false),
      // Not a library-* file, and old. Must survive.
      age('backup.log', 40 * 24, true),
      age('keep-me.txt', 40 * 24, true),
    ];
  };

  it('removes library-* files aged over the window in all three generations of naming, and nothing else', () => {
    const box = makeBox('prune');
    writeConfig(box);
    const fixtures = seedGenerations(box);

    const result = runBackup(box);
    expect(result.status, result.stderr).toBe(0);

    const present = new Set(readdirSync(box.backups));
    for (const fixture of fixtures) {
      expect(present.has(fixture.name), `${fixture.name} should have been ${fixture.keep ? 'kept' : 'removed'}`).toBe(fixture.keep);
    }

    const summary = summaryOf(result);
    expect(field(summary, 'prune')).toBe('removed-4-aged-over-14-whole-days');
    expect(archivesIn(box).filter((name) => name.endsWith('.tar.gz.gpg')).length).toBeGreaterThanOrEqual(1);
  });

  // The record states this as an invariant, so it is asserted rather than left
  // as an implementation detail: a run that could not prove its own backup does
  // not also delete history.
  it('does not prune when the run fails', () => {
    const box = makeBox('prune-not-on-failure');
    writeConfig(box);
    const fixtures = seedGenerations(box);

    const result = runBackup(box, { MAX_ARCHIVE_BYTES: '16' });
    expect(result.status).not.toBe(0);

    const summary = summaryOf(result);
    expect(field(summary, 'prune')).toBe('not-reached');
    const present = new Set(readdirSync(box.backups));
    for (const fixture of fixtures) {
      expect(present.has(fixture.name), `${fixture.name} was deleted by a failing run`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// The acceptance criteria that are not matrix rows.
// ---------------------------------------------------------------------------

describe('the summary line contract', () => {
  it('emits exactly one summary line whose exit field equals the process exit status, on every path', () => {
    const paths: Array<[string, () => RunResult]> = [
      ['unconfigured', () => runBackup(makeBox('contract-unconfigured'))],
      [
        'complete',
        () => {
          const box = makeBox('contract-complete');
          writeConfig(box);
          return runBackup(box);
        },
      ],
      [
        'integrity failure',
        () => {
          const box = makeBox('contract-integrity');
          writeConfig(box);
          return runBackup(box, { STUB_SQLITE_INTEGRITY: 'not ok' });
        },
      ],
      [
        'store missing entirely',
        () => {
          const box = makeBox('contract-nostore');
          writeConfig(box);
          return runBackup(box, { LIBRARY_DATA_DIR: bashPath(join(box.root, 'gone')) });
        },
      ],
      [
        'config present and unreadable',
        () => {
          const box = makeBox('contract-unreadable');
          mkdirSync(box.config, { recursive: true });
          return runBackup(box);
        },
      ],
      [
        'a second run while one is already holding the lock',
        () => {
          const box = makeBox('contract-locked');
          writeConfig(box);
          mkdirSync(join(box.backups, '.library-backup.lock'), { recursive: true });
          return runBackup(box);
        },
      ],
    ];

    for (const [label, run] of paths) {
      const result = run();
      const summary = summaryOf(result);
      expect(Number(field(summary, 'exit')), `${label}: the summary line disagrees with the exit status`).toBe(result.status);
    }
  });

  it('refuses to run two backups over one directory, one prune and one object namespace', () => {
    const box = makeBox('lock');
    writeConfig(box);
    // A lock whose holder cannot be identified is treated as held, which is the
    // conservative reading: refusing a run is recoverable, two runs sharing one
    // prune and one object namespace is not.
    mkdirSync(join(box.backups, '.library-backup.lock'), { recursive: true });

    const result = runBackup(box);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('holds');
    expect(result.stderr).toContain('Refusing to run two backups');
    expect(archivesIn(box)).toHaveLength(0);
  });

  it('takes over a lock whose holder is gone, so a killed run does not stop the nightly job forever', () => {
    const box = makeBox('stale-lock');
    writeConfig(box);
    const lock = join(box.backups, '.library-backup.lock');
    mkdirSync(lock, { recursive: true });
    // A pid that can never be a live process, so `/proc/0` never exists.
    writeFileSync(join(lock, 'pid'), '0\n');

    const result = runBackup(box);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('taking over a stale lock');
  });

  // The stamp has second resolution, so a hand run and the 03:45 cron run
  // landing in the same second is the shape this guards against. The date stub
  // reproduces that collision deterministically rather than by racing.
  it('refuses to overwrite an archive a previous run already wrote', () => {
    const box = makeBox('no-overwrite');
    writeConfig(box);
    const frozen = { STUB_DATE_STAMP: '20260824T034500Z' };

    const first = runBackup(box, frozen);
    expect(first.status, first.stderr).toBe(0);
    expect(archivesIn(box)).toContain('library-20260824T034500Z.tar.gz.gpg');

    const second = runBackup(box, frozen);
    expect(second.status).not.toBe(0);
    expect(second.stderr).toContain('Refusing to overwrite');
    expect(readFileSync(join(box.backups, 'library-20260824T034500Z.tar.gz.gpg')).length).toBe(
      first.stdout.match(/ bytes=(\d+) /) ? Number(first.stdout.match(/ bytes=(\d+) /)![1]) : -1
    );
  });

  it('carries a verdict for every stage, so no stage can be silently skipped', () => {
    const box = makeBox('all-fields');
    writeConfig(box);
    const summary = summaryOf(runBackup(box));
    for (const name of ['ts', 'snapshot', 'own', 'integrity', 'objects', 'archive', 'tar', 'bytes', 'encrypt', 'size', 'redis', 'offsite', 'roundtrip', 'restore', 'prune', 'exit']) {
      expect(field(summary, name)).not.toBe('');
    }
    expect(field(summary, 'ts')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('never expands USER, which is the expansion that broke the script it replaces', () => {
    for (const script of [LIBRARY_BACKUP, RESTORE_VERIFY, S3_OBJECT]) {
      // Comment lines are stripped, because the scripts describe the defect
      // they replace and naming it is the point of that prose.
      const code = readFileSync(script, 'utf8')
        .split('\n')
        .filter((line) => !/^\s*#/.test(line))
        .join('\n');
      expect(code, `${script} still expands USER`).not.toMatch(/\$\{?USER\b/);
    }
  });

  it('traps the signals that bash would otherwise skip the EXIT trap for', () => {
    for (const script of [LIBRARY_BACKUP, RESTORE_VERIFY]) {
      const source = readFileSync(script, 'utf8');
      for (const signal of ['INT', 'TERM', 'HUP']) {
        expect(source, `${script} does not trap ${signal}`).toMatch(new RegExp(`trap '[^']+' ${signal}`));
      }
    }
  });

  // The suite stubs `gpg` as an identity copy, so the real encrypt and decrypt
  // invocations are proved on the box instead, dated in
  // `ops/backup-digital-library.md`. That proof is point in time, so this pins
  // the exact flags it was run against: a change to either invocation has to
  // change this test, which is the prompt to re-prove it on the box.
  it('encrypts and decrypts with the flags the box proof was run against', () => {
    const encrypt = readFileSync(LIBRARY_BACKUP, 'utf8');
    for (const flag of ['--batch', '--yes', '--quiet', '--pinentry-mode loopback', '--passphrase-fd 0', '--symmetric', '--cipher-algo AES256']) {
      expect(encrypt, `library-backup.sh no longer encrypts with ${flag}`).toContain(flag);
    }
    const decrypt = readFileSync(RESTORE_VERIFY, 'utf8');
    for (const flag of ['--batch', '--yes', '--quiet', '--pinentry-mode loopback', '--passphrase-fd 0', '--decrypt']) {
      expect(decrypt, `library-restore-verify.sh no longer decrypts with ${flag}`).toContain(flag);
    }
    // The passphrase reaches gpg on a pipe, never as an argument, because an
    // argument is visible in `ps` to every account on the box.
    expect(encrypt).toMatch(/printf '%s' "\$\{BACKUP_PASSPHRASE\}" \| gpg/);
    expect(decrypt).toMatch(/printf '%s' "\$\{BACKUP_PASSPHRASE\}" \| gpg/);
    expect(encrypt).not.toMatch(/--passphrase[= ]"?\$/);
    expect(decrypt).not.toMatch(/--passphrase[= ]"?\$/);
  });

  it('never deletes an object offsite, because retention there is a bucket lifecycle rule', () => {
    const source = readFileSync(S3_OBJECT, 'utf8');
    expect(source).not.toMatch(/-X\s+DELETE/);
    expect(source.match(/^\s*(put|get|selftest)\)/gm)?.length).toBe(3);
  });
});

describe('the real restore', () => {
  it('proves the backup by reading the database back out of the bucket, not by an exit code', () => {
    const box = makeBox('restore');
    writeConfig(box);
    const result = runBackup(box);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('library-restore-verify: PRAGMA integrity_check ok');
    expect(result.stdout).toContain('library-restore-verify: schema objects: 11');
    expect(result.stdout).toContain('library-restore-verify: table users:');
    expect(result.stdout).toContain('library-restore-verify: table sessions:');
    expect(result.stdout).toContain('11 schema objects across 2 tables');
    for (const dir of ['books', 'covers', 'inbox']) {
      expect(result.stdout).toContain(`media directory ${dir} present`);
    }
  });

  it('removes its scratch directory, leaving nothing behind outside it', () => {
    const box = makeBox('restore-scratch');
    writeConfig(box);
    runBackup(box);
    const leftovers = readdirSync(join(box.root, 'work'));
    expect(leftovers, `scratch directories survived: ${leftovers.join(', ')}`).toEqual([]);
  });

  it('refuses the object when the database that came back out of the bucket fails its integrity check', () => {
    const box = makeBox('restore-bad');
    writeConfig(box);

    const seeded = runBackup(box);
    expect(seeded.status, seeded.stderr).toBe(0);
    const key = `digital-library/${archivesIn(box).find((name) => name.endsWith('.tar.gz.gpg'))}`;

    const good = runBash(RESTORE_VERIFY, [key], box.env);
    expect(good.status, good.stderr).toBe(0);

    const bad = runBash(RESTORE_VERIFY, [key], {
      ...box.env,
      STUB_SQLITE_INTEGRITY: '*** in database main *** Page 4 is never used',
    });
    expect(bad.status).not.toBe(0);
    expect(bad.stderr).toContain('fails PRAGMA integrity_check');
  });

  // The whole reason the floor exists: a valid but empty database is what a
  // naive `cp` of this store's 4096 byte main file produces, and it passes
  // `integrity_check`.
  it('refuses a restored database that is valid and empty, which integrity_check alone would certify', () => {
    const box = makeBox('restore-empty');
    writeConfig(box);
    const seeded = runBackup(box);
    expect(seeded.status, seeded.stderr).toBe(0);
    const key = `digital-library/${archivesIn(box).find((name) => name.endsWith('.tar.gz.gpg'))}`;

    const noObjects = runBash(RESTORE_VERIFY, [key], { ...box.env, STUB_SQLITE_OBJECTS: '0' });
    expect(noObjects.status).not.toBe(0);
    expect(noObjects.stderr).toContain('no schema objects');

    const noTables = runBash(RESTORE_VERIFY, [key], { ...box.env, STUB_SQLITE_TABLES: '' });
    expect(noTables.status).not.toBe(0);
    expect(noTables.stderr).toContain('no tables');
  });

  it('fails rather than exiting 0 when a count comes back as an error message', () => {
    const box = makeBox('restore-nonnumeric');
    writeConfig(box);
    const seeded = runBackup(box);
    expect(seeded.status, seeded.stderr).toBe(0);
    const key = `digital-library/${archivesIn(box).find((name) => name.endsWith('.tar.gz.gpg'))}`;

    const result = runBash(RESTORE_VERIFY, [key], {
      ...box.env,
      STUB_SQLITE_OBJECTS: 'Error: no such module: fts5',
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('not a number');
  });

  it('picks the newest local archive when it is given no object key', () => {
    const box = makeBox('restore-default-key');
    writeConfig(box);
    const seeded = runBackup(box);
    expect(seeded.status, seeded.stderr).toBe(0);

    const result = runBash(RESTORE_VERIFY, [], box.env);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("no key given, so verifying the newest local archive's object");
  });
});

describe('the store is read and never written', () => {
  it('takes the snapshot with sqlite3 .backup and never copies library.db', () => {
    const source = readFileSync(LIBRARY_BACKUP, 'utf8');
    expect(source).toMatch(/sqlite3 -cmd '\.timeout \d+' "\$\{DB\}" "\.backup/);
    expect(source).not.toMatch(/cp\s+"\$\{DB\}"/);
  });

  it('leaves the data directory byte-identical after a complete run', () => {
    const box = makeBox('readonly');
    writeConfig(box);
    const before = readdirSync(box.data).sort().map((entry) => [entry, statSync(join(box.data, entry)).size]);
    const result = runBackup(box);
    expect(result.status, result.stderr).toBe(0);
    const after = readdirSync(box.data).sort().map((entry) => [entry, statSync(join(box.data, entry)).size]);
    expect(after).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// The record and the box. These three checksums are the only thing tying the
// committed scripts to what is installed on `177.7.52.248`, so they are held
// true by a test rather than by whoever last remembered to update the record.
// ---------------------------------------------------------------------------

describe('the ops record', () => {
  it('pins the sha256 of every committed script, matching what the record says is installed', () => {
    const record = readFileSync(RECORD, 'utf8');
    for (const script of [S3_OBJECT, LIBRARY_BACKUP, RESTORE_VERIFY]) {
      const name = script.split(/[\\/]/).pop();
      const digest = createHash('sha256').update(readFileSync(script)).digest('hex');
      const row = record.split('\n').find((line) => line.includes(`/usr/local/sbin/${name}`) && line.includes('|'));
      expect(row, `ops/backup-digital-library.md has no installed-checksum row for ${name}`).toBeTruthy();
      expect(
        row,
        `ops/backup-digital-library.md records a stale sha256 for ${name}. The committed file is ${digest}. Reinstall on the box and update the record.`
      ).toContain(digest);
    }
  });
});
