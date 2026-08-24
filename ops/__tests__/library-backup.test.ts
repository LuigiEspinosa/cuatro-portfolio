import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, chmodSync, utimesSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// `ops/s3-object.sh`, `ops/library-backup.sh` and `ops/library-restore-verify.sh`
// are shell scripts, which `tsconfig.json:34-41` cannot typecheck, so this file
// is where their contract is actually asserted. Same precedent as
// `ops/__tests__/capacity-summary.test.ts`, which reads `capacity-sampler.sh`
// and pins its schema literal.
//
// Every `describe` below is one row of the spec's I/O and edge-case matrix.
//
// Two kinds of case. The signing cases run an independent SigV4 implementation
// in Node, check it against vectors AWS publishes with their expected
// signatures, derive the golden vector from first principles, and require the
// bash implementation to produce the same bytes. The orchestration cases run
// `library-backup.sh` for real against a PATH of stubs for `sqlite3`, `sudo`,
// `gpg`, `docker` and `curl`, in a scratch directory, so `tar`, `gzip`, `find`
// and `openssl` are exercised as themselves.

// Every case here spawns a real bash and runs real `tar`, `gzip`, `find` and
// `openssl`, and on Windows that bash is WSL's, which costs roughly a second
// per spawn. Vitest's 5 second default is a comfortable fit when this file runs
// alone and not when it runs beside sixteen others on a loaded machine, so the
// budget is raised here rather than in `vitest.config.ts`, where it would
// loosen the whole suite.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const OPS = resolve(__dirname, '..');
const S3_OBJECT = join(OPS, 's3-object.sh');
const LIBRARY_BACKUP = join(OPS, 'library-backup.sh');
const RESTORE_VERIFY = join(OPS, 'library-restore-verify.sh');

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
  'S3_PREFIX', 'S3_OBJECT_CLIENT', 'BACKUP_PASSPHRASE',
  'LIBRARY_BACKUP_CONFIG', 'LIBRARY_DATA_DIR', 'LIBRARY_BACKUP_DIR', 'LIBRARY_RETENTION_DAYS',
  'LIBRARY_RESTORE_VERIFY', 'LIBRARY_REDIS_CONTAINER', 'LIBRARY_REDIS_VOLUME_DIR',
  'MAX_ARCHIVE_BYTES', 'VERIFY_MAX_BYTES', 'TMPDIR',
  'STUB_CURL_LOG', 'STUB_BUCKET', 'STUB_PUT_CODE', 'STUB_GET_CODE', 'STUB_CORRUPT_GET',
  'STUB_REDIS_DBSIZE', 'STUB_SQLITE_INTEGRITY',
];

const shellQuote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

const LAUNCHERS = mkdtempSync(join(tmpdir(), 'cuatro-launcher-'));
let launcherCount = 0;

// The environment is set by a generated launcher script rather than by
// `spawnSync`'s `env`. On Windows the child is WSL's bash, and WSL hands a
// Windows environment variable to the Linux process only when it is named in
// `WSLENV`, so anything set the ordinary way is simply absent on the other
// side. A launcher behaves identically here and on `ubuntu-latest`, and it
// keeps every value out of a command line that two different argument parsers
// would otherwise have to agree about.
const runBash = (script: string, args: string[], env: Record<string, string> = {}): RunResult => {
  const merged: Record<string, string> = { PATH: POSIX_PATH, ...env };
  const launcher = join(LAUNCHERS, `run-${(launcherCount += 1)}.sh`);
  writeFileSync(
    launcher,
    [
      '#!/usr/bin/env bash',
      `unset ${SCRIPT_VARIABLES.join(' ')}`,
      ...Object.entries(merged).map(([name, value]) => `export ${name}=${shellQuote(value)}`),
      'exec bash "$@"',
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

const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');
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
  // does for a quiescent database. Everything else answers a query.
  sqlite3: `#!/usr/bin/env bash
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
    printf '11\\n'
    ;;
  *FROM\\ sqlite_master*)
    printf 'users\\nsessions\\n'
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
  // `tar -czf` wrote and the round trip is exercised end to end.
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
  docker: `#!/usr/bin/env bash
printf '%s\\n' "\${STUB_REDIS_DBSIZE:-0}"
`,
  // A bucket in a directory. PUT writes the body under a flattened key, GET
  // reads it back, and both append to a call log so a case can assert that no
  // request was made at all.
  curl: `#!/usr/bin/env bash
method='GET'; out=''; data=''; url=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    -X) method="$2"; shift 2 ;;
    -o) out="$2"; shift 2 ;;
    --data-binary) data="\${2#@}"; shift 2 ;;
    -H|-w) shift 2 ;;
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

interface Box {
  root: string;
  bin: string;
  data: string;
  backups: string;
  bucket: string;
  curlLog: string;
  config: string;
  env: Record<string, string>;
}

const makeBox = (name: string): Box => {
  const root = mkdtempSync(join(tmpdir(), `cuatro-${name}-`));
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
  const config = join(root, 'library-backup.env');

  return {
    root,
    bin,
    data,
    backups,
    bucket,
    curlLog,
    config,
    env: {
      // Deliberately not built from `process.env.PATH`. On Windows that holds
      // `C:\...` entries separated by semicolons, which mean nothing to the
      // bash that actually runs these scripts. A fixed POSIX PATH with the stub
      // directory in front behaves identically here and on `ubuntu-latest`.
      PATH: `${bashPath(bin)}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
      LIBRARY_BACKUP_CONFIG: bashPath(config),
      LIBRARY_DATA_DIR: bashPath(data),
      LIBRARY_BACKUP_DIR: bashPath(backups),
      S3_OBJECT_CLIENT: bashPath(S3_OBJECT),
      LIBRARY_RESTORE_VERIFY: bashPath(RESTORE_VERIFY),
      TMPDIR: bashPath(join(root, 'work')),
      STUB_CURL_LOG: bashPath(curlLog),
      STUB_BUCKET: bashPath(bucket),
      LIBRARY_REDIS_VOLUME_DIR: bashPath(join(root, 'no-such-redis-volume')),
    },
  };
};

const writeConfig = (box: Box): void => {
  writeFileSync(
    box.config,
    [
      "S3_ENDPOINT='https://account.r2.cloudflarestorage.com'",
      "S3_REGION='auto'",
      "S3_BUCKET='cuatro-library-backup'",
      "S3_ACCESS_KEY_ID='AKIAIOSFODNN7EXAMPLE'",
      `S3_SECRET_ACCESS_KEY='${AWS_EXAMPLE_SECRET}'`,
      "BACKUP_PASSPHRASE='fixture-passphrase-not-a-real-one'",
      '',
    ].join('\n')
  );
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
});

// ---------------------------------------------------------------------------
// Matrix row 2: an unsafe object key.
// ---------------------------------------------------------------------------

describe('an unsafe object key', () => {
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

      const result = runBash(S3_OBJECT, ['put', bashPath(payload), key], {
        ...box.env,
        S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
        S3_BUCKET: 'cuatro-library-backup',
        S3_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        S3_SECRET_ACCESS_KEY: AWS_EXAMPLE_SECRET,
      });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('unsafe object key');
      // A key holding a newline is refused without echoing it, so that case
      // names the reason instead. Every other refusal names the key.
      expect(result.stderr).toContain(key);
      expect(existsSync(box.curlLog), 'a request was made for a key that should never have reached the network').toBe(false);
    });
  }
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
      S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
      S3_BUCKET: 'cuatro-library-backup',
      S3_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
      S3_SECRET_ACCESS_KEY: '',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('S3_SECRET_ACCESS_KEY');
    expect(result.stderr).toContain('missing required configuration');
    expect(existsSync(box.curlLog)).toBe(false);
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
});

// ---------------------------------------------------------------------------
// Matrix row 4: a non-2xx from the endpoint.
// ---------------------------------------------------------------------------

describe('a non-2xx from the endpoint', () => {
  const credentials = {
    S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
    S3_BUCKET: 'cuatro-library-backup',
    S3_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
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
    expect(field(summary, 'archive')).toMatch(/^library-\d{8}T\d{6}Z\.tar\.gz$/);
    expect(field(summary, 'prune')).toMatch(/^removed-\d+-older-than-14d$/);
  });

  it('exits 75, which is not success, and says so in the same line', () => {
    expect(result.status).toBe(75);
    expect(field(summary, 'exit')).toBe('75');
    expect(field(summary, 'offsite')).toBe('not-configured');
    expect(field(summary, 'roundtrip')).toBe('skipped');
    expect(field(summary, 'restore')).toBe('skipped');
  });

  it('names the exact file the Operator must create', () => {
    expect(result.stdout).toContain(bashPath(box.config));
    expect(result.stdout).toContain('S3_ENDPOINT');
    expect(result.stdout).toContain('BACKUP_PASSPHRASE');
    expect(result.stdout).toContain('ops/backup-digital-library.md');
  });

  it('leaves the local half intact: a fresh archive is on disk and nothing was uploaded', () => {
    expect(archivesIn(box)).toHaveLength(1);
    expect(statSync(join(box.backups, archivesIn(box)[0])).size).toBeGreaterThan(0);
    expect(existsSync(box.curlLog)).toBe(false);
  });

  it('leaves the live store unwritten', () => {
    expect(readFileSync(join(box.data, 'library.db'), 'utf8')).toBe('SQLite format 3\u0000 fixture');
    expect(readdirSync(box.data).sort()).toEqual(['books', 'covers', 'inbox', 'library.db']);
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
    expect(existsSync(box.curlLog), 'an object was written despite a failed integrity check').toBe(false);
    expect(readdirSync(box.bucket)).toEqual([]);
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
    expect(existsSync(box.curlLog), 'the ceiling was checked after the upload rather than before it').toBe(false);
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
});

// ---------------------------------------------------------------------------
// Matrix row 10: retention.
// ---------------------------------------------------------------------------

describe('the retention prune', () => {
  it('removes library-* files older than the window in all three generations of naming, and nothing else', () => {
    const box = makeBox('prune');
    writeConfig(box);

    const hour = 3_600_000;
    const now = Date.now();
    const age = (name: string, hours: number, keep: boolean) => {
      const file = join(box.backups, name);
      writeFileSync(file, `fixture ${name}`);
      const when = new Date(now - hours * hour);
      utimesSync(file, when, when);
      return { name, keep };
    };

    const fixtures = [
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

    const result = runBackup(box);
    expect(result.status, result.stderr).toBe(0);

    const present = new Set(readdirSync(box.backups));
    for (const fixture of fixtures) {
      expect(present.has(fixture.name), `${fixture.name} should have been ${fixture.keep ? 'kept' : 'removed'}`).toBe(fixture.keep);
    }

    const summary = summaryOf(result);
    expect(field(summary, 'prune')).toBe('removed-4-older-than-14d');
    // The archive this run wrote is present, and is not what was counted.
    expect(archivesIn(box).filter((name) => name.endsWith('.tar.gz.gpg')).length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// The acceptance criteria that are not matrix rows.
// ---------------------------------------------------------------------------

describe('the summary line contract', () => {
  it('emits exactly one summary line whose exit field equals the process exit status, on every path', () => {
    const paths: Array<[string, () => RunResult]> = [
      [
        'unconfigured',
        () => runBackup(makeBox('contract-unconfigured')),
      ],
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
    ];

    for (const [label, run] of paths) {
      const result = run();
      const summary = summaryOf(result);
      expect(Number(field(summary, 'exit')), `${label}: the summary line disagrees with the exit status`).toBe(result.status);
    }
  });

  it('carries a verdict for every stage, so no stage can be silently skipped', () => {
    const box = makeBox('all-fields');
    writeConfig(box);
    const summary = summaryOf(runBackup(box));
    for (const name of ['ts', 'snapshot', 'own', 'integrity', 'archive', 'bytes', 'encrypt', 'size', 'redis', 'offsite', 'roundtrip', 'restore', 'prune', 'exit']) {
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

    // A complete run first, so a real object exists in the bucket to verify.
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
    expect(source).toMatch(/sqlite3 "\$\{DB\}" "\.backup/);
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
