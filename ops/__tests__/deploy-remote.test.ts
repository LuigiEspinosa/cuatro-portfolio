// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// `ops/deploy-remote.sh` is the Anchor's deploy on the box and the forced command of the deploy key
// (`ops/contract-serving.md` Pending Operator action 7, DW-94). Since Story 3-4 it pulls the commit's image
// from GHCR and rolls the Hub onto it with `docker-rollout`, and never builds (AD-8). No deploy runs before
// the merge to `main`, so its contract is asserted here: the real script runs under bash against a scratch
// git repository standing in for GitHub and the box, with a stub `docker` and a stub `curl` first on PATH,
// in both of the ways the box can run it. The deploy workflow's wiring is read below as the data it is,
// since nothing executes it before it reaches `main` either.

// Every run spawns a real bash and a real git, and on Windows that bash is WSL's, at roughly a second
// a spawn, so the budget is raised here rather than in `vitest.config.ts`, as `library-backup.test.ts`
// does for the same reason.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const REPO_ROOT = process.cwd();
const SCRIPT = resolve(REPO_ROOT, 'ops/deploy-remote.sh');
const WORKFLOW = resolve(REPO_ROOT, '.github/workflows/deploy.yml');
const RECORD = resolve(REPO_ROOT, 'ops/contract-serving.md');

// The mapping `library-backup.test.ts` uses: on this host `bash` is WSL's and reads `/mnt/c/...` paths,
// and it is named absolutely because the PATH handed to the child is a POSIX one. CI is `ubuntu-latest`.
const BASH = (() => {
  if (process.platform !== 'win32') return 'bash';
  const candidate = join(process.env.SystemRoot ?? 'C:\\Windows', 'system32', 'bash.exe');
  return existsSync(candidate) ? candidate : 'bash';
})();
const posix = (path: string): string =>
  process.platform === 'win32'
    ? path.replace(/^([A-Za-z]):/, (_match, drive: string) => `/mnt/${drive.toLowerCase()}`).replace(/\\/g, '/')
    : path;
const quote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;
const POSIX_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';

// A launcher script carries the environment, because WSL hands a Windows variable to the Linux side only
// when `WSLENV` names it. Every inherited `GIT_*` variable is dropped first, so a run started from inside
// a git hook cannot point the scratch repository's `git reset --hard` at this one.
const runLauncher = (path: string, lines: string[]) => {
  const preamble = [
    '#!/usr/bin/env bash',
    'for name in $(compgen -e | grep "^GIT_"); do unset "$name"; done',
    'unset SSH_ORIGINAL_COMMAND',
  ];
  writeFileSync(path, [...preamble, ...lines, ''].join('\n'));
  chmodSync(path, 0o755);
  const run = spawnSync(BASH, [posix(path)], { encoding: 'utf8' });
  if (run.error) throw run.error;
  return run;
};

// ---------------------------------------------------------------------------
// The two strings the box is handed: the workflow's command, and the record's forced command
// ---------------------------------------------------------------------------

const workflow = readFileSync(WORKFLOW, 'utf8').replace(/\r\n/g, '\n');
// Comments discuss `if:` and `reset` by name, so everything below reads instructions, not prose.
const instructions = workflow
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n');

const SHA_EXPRESSION = '${{ github.sha }}';

/** The SSH step's `script: >-` block, folded the way YAML folds it: one line, joined by spaces. */
const commandTemplate = (() => {
  const lines = instructions.split('\n');
  const at = lines.findIndex((line) => /^\s+script: >-$/.test(line));
  if (at === -1) return '';
  const indent = lines[at].search(/\S/);
  const body: string[] = [];
  for (const line of lines.slice(at + 1)) {
    if (line.trim() === '' || line.search(/\S/) <= indent) break;
    body.push(line.trim());
  }
  return body.join(' ');
})();
const commandFor = (sha: string) => commandTemplate.split(SHA_EXPRESSION).join(sha);

/** The forced command the record tells the Operator to write into `authorized_keys`. */
const FORCED_COMMAND = /restrict,command="([^"]+)"/.exec(readFileSync(RECORD, 'utf8'))?.[1] ?? '';

// ---------------------------------------------------------------------------
// A scratch origin: A has no script (the box before this change), B to D carry it, X is off `main`.
// A box is cloned from a snapshot of the origin as it stood when the box last deployed, so its
// `origin/main` is stale and the commits after it are absent until the script's own fetch, as on the box.
// ---------------------------------------------------------------------------

const ROOT = mkdtempSync(join(tmpdir(), 'cuatro-deploy-remote-'));
const ORIGIN = join(ROOT, 'origin.git');
const SNAPSHOT = { A: join(ROOT, 'origin-at-A.git'), B: join(ROOT, 'origin-at-B.git') };
const shas = { A: '', B: '', C: '', D: '', X: '' };
let caseCount = 0;

afterAll(() => {
  try {
    rmSync(ROOT, { recursive: true, force: true });
  } catch {
    // A temp root that will not delete is not a failure of the script under test.
  }
});

/** What the stubs answer. Each field left out is the healthy box: v0.14 installed, nothing failing. */
interface Stub {
  /** What `docker rollout --version` reports, or `absent` for a box with no plugin. */
  rollout?: string;
  /** Whether the compose file declares `anchor-app-migrate` under the `migrate` profile. */
  migrate?: boolean;
  /** The image `compose ps` reports the service running after the rollout, the target's by default. */
  running?: string;
  /** A fragment of the one docker call that fails. */
  fail?: string;
}

interface Box {
  /** The snapshot the box was cloned from: `A`, before the script existed, or `B`, with `side` fetched. */
  start: keyof typeof SNAPSHOT;
  /**
   * `bootstrap`: the login shell runs `command`, as it does while the key is unrestricted. `forced`:
   * the record's forced command runs with `command` in SSH_ORIGINAL_COMMAND, unset when it is absent.
   */
  mode: 'bootstrap' | 'forced';
  command?: string;
  stub?: Stub;
  /** A sha256 written over the checkout copy's pin before the forced command runs it. */
  pin?: string;
}

const PLUGIN = '.docker/cli-plugins/docker-rollout';

/**
 * A fresh box cloned from the `start` snapshot, one session run from its home as sshd starts one, and
 * what the session left behind: each docker call as `[HUB_TAG it saw, its arguments]`, from the checkout.
 */
const deploy = ({ start, mode, command, stub = {}, pin }: Box) => {
  const home = join(ROOT, `case-${(caseCount += 1)}`);
  mkdirSync(home);
  const session =
    mode === 'bootstrap'
      ? `/bin/bash -c ${quote(command ?? '')}`
      : `${command === undefined ? '' : `SSH_ORIGINAL_COMMAND=${quote(command)} `}/bin/bash -c ${quote(
          FORCED_COMMAND.replace('/home/deploy/', `${posix(home)}/`)
        )}`;
  const run = runLauncher(join(ROOT, `case-${caseCount}.sh`), [
    `export HOME=${quote(posix(home))} GIT_CONFIG_NOSYSTEM=1`,
    `export PATH=${quote(`${posix(join(ROOT, 'bin'))}:${POSIX_PATH}`)}`,
    'export DOCKER_LOG="$HOME/docker.log" CURL_LOG="$HOME/curl.log"',
    `export STUB_ROLLOUT=${quote(stub.rollout ?? '')} STUB_MIGRATE=${stub.migrate ? 1 : "''"}`,
    `export STUB_RUNNING=${quote(stub.running ?? '')} STUB_FAIL=${quote(stub.fail ?? '')}`,
    `git clone -q ${quote(posix(SNAPSHOT[start]))} "$HOME/cuatro-portfolio" || exit 90`,
    `git -C "$HOME/cuatro-portfolio" remote set-url origin ${quote(posix(ORIGIN))} || exit 90`,
    ...(pin === undefined
      ? []
      : [`sed -i 's/^ROLLOUT_SHA256=.*/ROLLOUT_SHA256=${pin}/' "$HOME/cuatro-portfolio/ops/deploy-remote.sh" || exit 90`]),
    'cd "$HOME"',
    `${session} > "$HOME/out" 2> "$HOME/err"`,
    'echo "$?" > "$HOME/status"',
    'git -C "$HOME/cuatro-portfolio" rev-parse HEAD > "$HOME/head"',
  ]);
  if (run.status !== 0) throw new Error(`the scratch box could not be prepared (exit ${run.status}): ${run.stderr}`);
  const read = (name: string) => (existsSync(join(home, name)) ? readFileSync(join(home, name), 'utf8') : '');
  const lines = (name: string) => read(name).split('\n').filter(Boolean);
  const calls = lines('docker.log').map((line) => line.split('|'));
  return {
    status: Number(read('status').trim()),
    stdout: read('out'),
    stderr: read('err'),
    head: read('head').trim(),
    docker: calls.map(([, tag, args]) => [tag, args]),
    dockerDirs: calls.map(([directory]) => directory),
    curl: lines('curl.log'),
    plugin: existsSync(join(home, PLUGIN)),
    download: existsSync(join(home, '.docker/docker-rollout.download')),
  };
};

const IMAGE = (sha: string) => `ghcr.io/luigiespinosa/hub:${sha}`;
const ROLLOUT_ASSET = 'https://github.com/wowu/docker-rollout/releases/download/v0.14/docker-rollout';

/** What a deploy of `sha` asks docker, in order, as `[HUB_TAG it saw, arguments]`. */
const deployCalls = (sha: string, { migrate = false } = {}) => [
  ['', 'rollout --version'],
  ['', `pull ${IMAGE(sha)}`],
  [sha, 'compose --env-file .env.production --profile migrate config --services'],
  ...(migrate ? [[sha, 'compose --env-file .env.production --profile migrate run --rm anchor-app-migrate']] : []),
  [sha, 'rollout --env-file .env.production --timeout 120 anchor-app'],
  [sha, 'compose --env-file .env.production ps --format {{.Image}} anchor-app'],
];

describe('the two strings the box is handed', () => {
  it('names this script as the forced command, at the checkout it deploys', () => {
    expect(existsSync(SCRIPT), 'ops/deploy-remote.sh is missing').toBe(true);
    expect(FORCED_COMMAND).toBe('/bin/bash /home/deploy/cuatro-portfolio/ops/deploy-remote.sh');
  });

  it("ends the workflow's one command string with the pushed sha, the one word the forced script reads", () => {
    expect(commandTemplate, 'the SSH step carries no `script: >-` block').not.toBe('');
    expect(commandTemplate.endsWith(` ${SHA_EXPRESSION}`)).toBe(true);
    expect(commandTemplate.split(SHA_EXPRESSION)).toHaveLength(3);
    expect(commandTemplate).toContain(`git show ${SHA_EXPRESSION}:ops/deploy-remote.sh`);
    // The reset is the script's, to the sha it validated; the string itself never resets anything.
    expect(commandTemplate).not.toContain('reset');
  });
});

describe('ops/deploy-remote.sh, as the box runs it', () => {
  // The scratch origin is built once, for these cases only, so a failure to build it cannot mask the
  // wiring cases below.
  beforeAll(() => {
    mkdirSync(join(ROOT, 'bin'));
    // Records where it ran, the HUB_TAG it saw and what it was asked, answers the three questions the
    // script asks, and fails the one call a case names.
    writeFileSync(
      join(ROOT, 'bin', 'docker'),
      [
        '#!/bin/sh',
        'printf "%s|%s|%s\\n" "$PWD" "${HUB_TAG-}" "$*" >> "$DOCKER_LOG"',
        'case "$*" in',
        '  "rollout --version")',
        '    if [ "${STUB_ROLLOUT:-v0.14}" = absent ]; then',
        // As docker does, it finds a plugin once one is installed where docker looks.
        '      [ -x "$HOME/.docker/cli-plugins/docker-rollout" ] || exit 1',
        '      echo "docker-rollout version v0.14"; exit 0',
        '    fi',
        '    echo "docker-rollout version ${STUB_ROLLOUT:-v0.14}"; exit 0 ;;',
        '  *" config --services")',
        '    printf "%s\\n" anchor-app anchor-umami anchor-db ${STUB_MIGRATE:+anchor-app-migrate}; exit 0 ;;',
        '  *" ps --format {{.Image}} anchor-app")',
        '    echo "${STUB_RUNNING:-ghcr.io/luigiespinosa/hub:$HUB_TAG}"; exit 0 ;;',
        'esac',
        'case "$*" in *"${STUB_FAIL:-no call matches this}"*) exit 1 ;; esac',
        '',
      ].join('\n')
    );
    // Records what it was asked for and "downloads" bytes that are not the release asset.
    writeFileSync(
      join(ROOT, 'bin', 'curl'),
      [
        '#!/bin/sh',
        'printf "%s\\n" "$*" >> "$CURL_LOG"',
        'while [ "$#" -gt 1 ]; do',
        '  if [ "$1" = --output ]; then printf "not docker-rollout\\n" > "$2"; exit 0; fi',
        '  shift',
        'done',
        'exit 1',
        '',
      ].join('\n')
    );
    chmodSync(join(ROOT, 'bin', 'docker'), 0o755);
    chmodSync(join(ROOT, 'bin', 'curl'), 0o755);
    const seed = posix(join(ROOT, 'seed'));
    const setup = runLauncher(join(ROOT, 'setup.sh'), [
      'set -euo pipefail',
      `export HOME=${quote(posix(join(ROOT, 'setup-home')))} GIT_CONFIG_NOSYSTEM=1`,
      'export GIT_AUTHOR_NAME=deploy-remote GIT_AUTHOR_EMAIL=deploy-remote@example.invalid',
      'export GIT_COMMITTER_NAME=deploy-remote GIT_COMMITTER_EMAIL=deploy-remote@example.invalid',
      'mkdir -p "$HOME"',
      `git init -q --bare -b main ${quote(posix(ORIGIN))}`,
      `git init -q -b main ${quote(seed)} && cd ${quote(seed)}`,
      `git remote add origin ${quote(posix(ORIGIN))}`,
      `commit() { printf '%s\\n' "$1" > marker; git add -A; git commit -qm "$1"; git rev-parse HEAD; }`,
      'commit A',
      'git push -q origin main',
      `git clone -q --bare ${quote(posix(ORIGIN))} ${quote(posix(SNAPSHOT.A))}`,
      `mkdir ops && cp ${quote(posix(SCRIPT))} ops/deploy-remote.sh`,
      'commit B',
      'git push -q origin main',
      'git checkout -q -b side',
      'commit X',
      'git push -q origin side',
      `git clone -q --bare ${quote(posix(ORIGIN))} ${quote(posix(SNAPSHOT.B))}`,
      'git checkout -q main',
      'commit C',
      'commit D',
      'git push -q origin main',
    ]);
    const printed = setup.stdout.trim().split('\n');
    if (setup.status !== 0 || printed.length !== 5) {
      throw new Error(`the scratch origin could not be built (exit ${setup.status}): ${setup.stderr}`);
    }
    [shas.A, shas.B, shas.X, shas.C, shas.D] = printed;
  });

  // The first deploy after the merge that brings the script: the checkout is at a commit that has no script
  // and has never seen the target, the key is not yet restricted, and the login shell runs the string, which
  // fetches the target and brings the script in from it.
  it('deploys from a checkout that has no script yet, through an unrestricted shell', () => {
    const box = deploy({ start: 'A', mode: 'bootstrap', command: commandFor(shas.D) });
    expect(box.stderr).not.toContain('refused');
    expect(box.status).toBe(0);
    expect(box.head).toBe(shas.D);
    expect(box.docker).toEqual(deployCalls(shas.D));
    expect(box.dockerDirs.every((directory) => directory.endsWith('/cuatro-portfolio'))).toBe(true);
    expect(box.stdout).toContain(`deploying ${shas.D}, read from its argument`);
    expect(box.stdout).toContain(`anchor-app runs ${IMAGE(shas.D)}`);
  });

  // AD-8 in the calls themselves: the box pulls the sha tag and rolls it, and nothing it runs builds.
  it('pulls the sha tag and rolls it, and asks docker for no build', () => {
    const box = deploy({ start: 'B', mode: 'forced', command: commandFor(shas.D) });
    expect(box.status).toBe(0);
    const calls = box.docker.map(([, args]) => args).join('\n');
    expect(calls).toContain(`pull ${IMAGE(shas.D)}`);
    expect(calls).toContain('rollout --env-file .env.production --timeout 120 anchor-app');
    expect(calls).not.toMatch(/\bbuild\b/);
    expect(calls).not.toMatch(/\bup\b/);
    expect(box.curl, 'a box with v0.14 downloads nothing').toEqual([]);
  });

  // The box's `origin/main` is still B here, so this also shows the script's fetch moving it: without that,
  // D is no ancestor of B and the deploy is refused.
  it('deploys through the forced command, reading the sha from SSH_ORIGINAL_COMMAND', () => {
    const box = deploy({ start: 'B', mode: 'forced', command: commandFor(shas.D) });
    expect(box.status).toBe(0);
    expect(box.head).toBe(shas.D);
    expect(box.docker).toEqual(deployCalls(shas.D));
    expect(box.stdout).toContain(`deploying ${shas.D}, read from SSH_ORIGINAL_COMMAND`);
  });

  // DW-93: the old step reset to `origin/main`, so a run whose `main` had moved on deployed a commit its
  // own gate step never checked. The script resets to the sha it was given and pulls that sha's image.
  it('resets to the pushed sha when main has moved on, not to origin/main', () => {
    const box = deploy({ start: 'B', mode: 'forced', command: commandFor(shas.C) });
    expect(box.status).toBe(0);
    expect(box.head).toBe(shas.C);
    expect(box.docker).toEqual(deployCalls(shas.C));
  });

  // The table is built before `beforeAll` knows the shas, so each input is a function of them.
  it.each<[string, () => string | undefined]>([
    ['an interactive session, which sends no command', () => undefined],
    ['a command of its own', () => 'id'],
    ['an upper-case sha', () => shas.D.toUpperCase()],
    ['a short sha', () => shas.D.slice(0, 7)],
    ['a sha with a command glued on', () => `${shas.D};id`],
  ])('refuses %s before touching git or docker', (_label, input) => {
    const box = deploy({ start: 'B', mode: 'forced', command: input() });
    expect(box.status).toBe(1);
    expect(box.stderr).toContain('deploy-remote: refused');
    expect(box.head).toBe(shas.B);
    expect(box.docker).toEqual([]);
  });

  it.each<[string, () => string]>([
    // The box has fetched `side` before, so X is an object it holds, and the refusal is the ancestry's.
    ['a commit on another branch', () => shas.X],
    ['a sha no repository has', () => '0123456789abcdef0123456789abcdef01234567'],
  ])('refuses %s after the fetch, leaving the checkout where it was', (_label, sha) => {
    const target = sha();
    const box = deploy({ start: 'B', mode: 'forced', command: commandFor(target) });
    expect(box.status).toBe(1);
    expect(box.stderr).toContain(`deploy-remote: refused: ${target} is not on origin/main`);
    expect(box.head).toBe(shas.B);
    expect(box.docker).toEqual([]);
  });

  // DW-131: A is on `main` but predates the script, so a reset to it would delete the file the key's forced
  // command names, and every later deploy would fail until the checkout was repaired by hand.
  it('refuses a commit on main that predates the script, leaving the checkout where it was', () => {
    const box = deploy({ start: 'B', mode: 'forced', command: commandFor(shas.A) });
    expect(box.status).toBe(1);
    expect(box.stderr).toContain(`deploy-remote: refused: ${shas.A} carries no ops/deploy-remote.sh`);
    expect(box.head).toBe(shas.B);
    expect(box.docker).toEqual([]);
  });

  // A sha whose image never reached GHCR stops at the pull, before the checkout moves, so the box is left
  // exactly as it was and serves on.
  it('stops at the pull when the image is not in GHCR, leaving the checkout where it was', () => {
    const box = deploy({ start: 'B', mode: 'forced', command: commandFor(shas.D), stub: { fail: 'pull ' } });
    expect(box.status).not.toBe(0);
    expect(box.head).toBe(shas.B);
    expect(box.docker).toEqual(deployCalls(shas.D).slice(0, 2));
  });

  // A box without docker-rollout, or with another version, fetches the pinned release asset, and installs it
  // only if its sha256 is the pinned one. Here the download is not the asset, so nothing is installed and
  // nothing past the check runs.
  it.each(['absent', 'v0.13'])('refuses a download that is not the pinned asset, with docker-rollout %s', (rollout) => {
    const box = deploy({ start: 'B', mode: 'forced', command: commandFor(shas.D), stub: { rollout } });
    expect(box.status).toBe(1);
    expect(box.stderr).toContain('deploy-remote: refused: the docker-rollout v0.14 download does not match its pinned sha256');
    expect(box.curl).toHaveLength(1);
    expect(box.curl[0]).toContain(ROLLOUT_ASSET);
    expect(box.curl[0]).toContain("--proto =https");
    expect(box.plugin).toBe(false);
    expect(box.download).toBe(false);
    expect(box.head).toBe(shas.B);
    expect(box.docker).toEqual([['', 'rollout --version']]);
  });

  // The success half of the same path: a download that matches the pin is installed where docker looks, and
  // the deploy goes on. The asset's own bytes are not in this repository, so this case writes the stub
  // download's sha256 over the pin in the box's copy of the script, the one line it changes; the real asset
  // went through the real script on 2026-09-28 (the Story 3-4 spec, Verification).
  it('installs a download that matches the pin and goes on with the deploy', () => {
    const pin = createHash('sha256').update('not docker-rollout\n').digest('hex');
    const box = deploy({ start: 'B', mode: 'forced', command: commandFor(shas.D), stub: { rollout: 'absent' }, pin });
    expect(box.stderr).not.toContain('refused');
    expect(box.status).toBe(0);
    expect(box.curl).toHaveLength(1);
    expect(box.curl[0]).toContain(ROLLOUT_ASSET);
    expect(box.plugin).toBe(true);
    expect(box.download).toBe(false);
    expect(box.docker).toEqual([['', 'rollout --version'], ...deployCalls(shas.D)]);
  });

  // AD-23: a service that owns a schema declares `<service>-migrate`, and it runs as its own step after the
  // pull and before the rollout. The Hub declares none, which every case above shows running nothing.
  it('runs a declared migration after the pull and before the rollout', () => {
    const box = deploy({ start: 'B', mode: 'forced', command: commandFor(shas.D), stub: { migrate: true } });
    expect(box.status).toBe(0);
    expect(box.docker).toEqual(deployCalls(shas.D, { migrate: true }));
  });

  it('stops before the rollout when the migration fails', () => {
    const box = deploy({
      start: 'B',
      mode: 'forced',
      command: commandFor(shas.D),
      stub: { migrate: true, fail: 'run --rm anchor-app-migrate' },
    });
    expect(box.status).not.toBe(0);
    expect(box.docker).toEqual(deployCalls(shas.D, { migrate: true }).slice(0, 4));
  });

  // The workflow can only see the SSH step's exit status, so a failed rollout has to reach it through the
  // session, which is what fails the job and runs the report (DW-20). docker-rollout has already put the old
  // container back by then.
  it('fails the session when the rollout fails, after the reset', () => {
    const box = deploy({ start: 'A', mode: 'bootstrap', command: commandFor(shas.D), stub: { fail: 'rollout --env-file' } });
    expect(box.status).not.toBe(0);
    expect(box.head).toBe(shas.D);
    expect(box.docker).toEqual(deployCalls(shas.D).slice(0, 4));
  });

  // docker-rollout exits 0 without rolling anything when the service has a stopped container, so the deploy
  // reads what the service runs and refuses to report another image as deployed.
  it('fails when the service runs another image after the rollout', () => {
    const box = deploy({
      start: 'B',
      mode: 'forced',
      command: commandFor(shas.D),
      stub: { running: IMAGE(shas.B) },
    });
    expect(box.status).toBe(1);
    expect(box.stderr).toContain(`deploy-remote: refused: anchor-app runs ${IMAGE(shas.B)}, not ${IMAGE(shas.D)}`);
    expect(box.docker).toEqual(deployCalls(shas.D));
  });
});

// ---------------------------------------------------------------------------
// The deploy workflow's wiring around the script (DW-93, DW-20, Story 3-4)
// ---------------------------------------------------------------------------

/** Each job under `jobs:` by id, in file order, as its lines below the id. */
const jobsOf = (text: string): Map<string, string> => {
  const lines = text.split('\n');
  const start = lines.indexOf('jobs:');
  const jobs = new Map<string, string>();
  let id = '';
  for (const line of start === -1 ? [] : lines.slice(start + 1)) {
    const key = /^ {2}([\w-]+):$/.exec(line);
    if (key) jobs.set((id = key[1]), '');
    else if (id !== '') jobs.set(id, `${jobs.get(id)}${line}\n`);
  }
  return jobs;
};

describe('the deploy workflow', () => {
  const jobs = jobsOf(instructions);

  const stepsOf = (): string[] => {
    const at = instructions.indexOf('\n    steps:\n');
    if (at === -1) return [];
    return instructions
      .slice(at + '\n    steps:\n'.length)
      .split(/\n(?= {6}- )/)
      .map((step) => step.trim())
      .filter(Boolean);
  };

  it('deploys on a push to main that changes more than Markdown, and on dispatch', () => {
    expect(instructions).toMatch(
      /^on:\n {2}push:\n {4}branches: \[main\]\n {4}paths-ignore:\n {6}- '\*\*\.md'\n {2}workflow_dispatch:\n\n/m
    );
  });

  it('runs one deploy at a time and cancels none in flight', () => {
    expect(instructions).toMatch(/^concurrency:\n {2}group: deploy\n {2}cancel-in-progress: false\n/m);
  });

  it('refuses any ref but main in its first step, before anything else runs', () => {
    expect([...jobs.keys()][0]).toBe('gate');
    expect(stepsOf()[0]).toBe('- name: Refuse any ref but main\n        run: test "$GITHUB_REF" = refs/heads/main');
  });

  // Story 3-4: the box pulls the image the run itself built, so the SSH job needs the image job, which needs
  // the gate. A refused ref or placement builds nothing, and no deploy starts before its tag is in GHCR.
  it('chains its jobs, the gate then the image then the deploy, so no deploy starts before its image', () => {
    expect([...jobs.keys()]).toEqual(['gate', 'image', 'deploy', 'report']);
    const [gate, image, ssh] = ['gate', 'image', 'deploy'].map((id) => jobs.get(id) ?? '');
    expect(gate).not.toMatch(/^\s+needs\s*:/m);
    expect(gate).toMatch(/^\s+run: node ops\/capacity-gate\.mjs cuatro-portfolio$/m);
    expect(image).toMatch(/^ {4}needs: gate$/m);
    expect(image).toMatch(/^ {4}uses: \.\/\.github\/workflows\/image\.yml$/m);
    expect(ssh).toMatch(/^ {4}needs: image$/m);
    expect(ssh).toMatch(/^\s+uses: appleboy\/ssh-action@/m);
    expect(ssh).toMatch(/^\s+script: >-$/m);
  });

  it('opens an issue from a last job that needs the other three and runs only when one of them failed', () => {
    const report = jobs.get('report') ?? '';
    expect(report).toMatch(/^ {4}needs: \[gate, image, deploy\]$/m);
    expect(report).toMatch(/^ {4}if: failure\(\)$/m);
    expect(report).toMatch(/^\s+- name: Open an issue for the failed deploy$/m);
    expect(report).toMatch(/^\s+GH_TOKEN: \$\{\{ github\.token \}\}$/m);
    expect(report).toMatch(/^\s+gh issue create --repo "\$GITHUB_REPOSITORY" \\$/m);
    for (const id of ['gate', 'image', 'deploy']) expect(jobs.get(id), id).not.toMatch(/^\s+if\s*:/m);
  });

  it('reads each job apart, so a job that stops needing the one before it is named', () => {
    const planted = jobsOf(instructions.replace('    needs: image\n', ''));
    expect([...planted.keys()]).toEqual(['gate', 'image', 'deploy', 'report']);
    expect(planted.get('deploy')).not.toMatch(/^ {4}needs: image$/m);
    expect(planted.get('image')).toMatch(/^ {4}needs: gate$/m);
    expect(jobsOf('on: push\n')).toEqual(new Map());
  });
});
