// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// `ops/deploy-remote.sh` is the Anchor's deploy on the box and, once the Operator applies
// `ops/contract-serving.md` Pending Operator action 7, the forced command of the deploy key (DW-94).
// No deploy can run before the merge to `main`, so its contract is asserted here: the real script runs
// under bash against a scratch git repository standing in for GitHub and the box, with a stub `docker`
// first on PATH, in both of the ways the box can run it. The deploy workflow's new wiring is read below
// as the data it is, since nothing executes it before it reaches `main` either.

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

interface Box {
  /** The snapshot the box was cloned from: `A`, before the script existed, or `B`, with `side` fetched. */
  start: keyof typeof SNAPSHOT;
  /**
   * `bootstrap`: the login shell runs `command`, as it does while the key is unrestricted. `forced`:
   * the record's forced command runs with `command` in SSH_ORIGINAL_COMMAND, unset when it is absent.
   */
  mode: 'bootstrap' | 'forced';
  command?: string;
  dockerExit?: number;
}

/**
 * A fresh box cloned from the `start` snapshot, one session run from its home as sshd starts one, and
 * what the session left behind.
 */
const deploy = ({ start, mode, command, dockerExit = 0 }: Box) => {
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
    `export DOCKER_LOG="$HOME/docker.log" STUB_DOCKER_EXIT=${dockerExit}`,
    `git clone -q ${quote(posix(SNAPSHOT[start]))} "$HOME/cuatro-portfolio" || exit 90`,
    `git -C "$HOME/cuatro-portfolio" remote set-url origin ${quote(posix(ORIGIN))} || exit 90`,
    'cd "$HOME"',
    `${session} > "$HOME/out" 2> "$HOME/err"`,
    'echo "$?" > "$HOME/status"',
    'git -C "$HOME/cuatro-portfolio" rev-parse HEAD > "$HOME/head"',
  ]);
  if (run.status !== 0) throw new Error(`the scratch box could not be prepared (exit ${run.status}): ${run.stderr}`);
  const read = (name: string) => (existsSync(join(home, name)) ? readFileSync(join(home, name), 'utf8') : '');
  return {
    status: Number(read('status').trim()),
    stdout: read('out'),
    stderr: read('err'),
    head: read('head').trim(),
    docker: read('docker.log').split('\n').filter(Boolean),
  };
};

const COMPOSE = 'compose --env-file .env.production up --build -d --remove-orphans';

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
    // Records where it ran and with what, and exits with whatever the case asks for.
    writeFileSync(
      join(ROOT, 'bin', 'docker'),
      ['#!/bin/sh', 'printf "%s|%s\\n" "$PWD" "$*" >> "$DOCKER_LOG"', 'exit "${STUB_DOCKER_EXIT:-0}"', ''].join('\n')
    );
    chmodSync(join(ROOT, 'bin', 'docker'), 0o755);
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

  // The first deploy after the merge: the checkout is at a commit that has no script and has never seen the
  // target, the key is not yet restricted, and the login shell runs the string, which fetches the target and
  // brings the script in from it.
  it('deploys from a checkout that has no script yet, through an unrestricted shell', () => {
    const box = deploy({ start: 'A', mode: 'bootstrap', command: commandFor(shas.D) });
    expect(box.stderr).not.toContain('refused');
    expect(box.status).toBe(0);
    expect(box.head).toBe(shas.D);
    expect(box.docker).toHaveLength(1);
    expect(box.docker[0]).toMatch(new RegExp(`/cuatro-portfolio\\|${COMPOSE}$`));
    expect(box.stdout).toContain(`deploying ${shas.D}, read from its argument`);
  });

  // The box's `origin/main` is still B here, so this also shows the script's fetch moving it: without that,
  // D is no ancestor of B and the deploy is refused.
  it('deploys through the forced command, reading the sha from SSH_ORIGINAL_COMMAND', () => {
    const box = deploy({ start: 'B', mode: 'forced', command: commandFor(shas.D) });
    expect(box.status).toBe(0);
    expect(box.head).toBe(shas.D);
    expect(box.docker).toHaveLength(1);
    expect(box.docker[0]).toMatch(new RegExp(`/cuatro-portfolio\\|${COMPOSE}$`));
    expect(box.stdout).toContain(`deploying ${shas.D}, read from SSH_ORIGINAL_COMMAND`);
  });

  // DW-93: the old step reset to `origin/main`, so a run whose `main` had moved on deployed a commit its
  // own gate step never checked. The script resets to the sha it was given.
  it('resets to the pushed sha when main has moved on, not to origin/main', () => {
    const box = deploy({ start: 'B', mode: 'forced', command: commandFor(shas.C) });
    expect(box.status).toBe(0);
    expect(box.head).toBe(shas.C);
    expect(box.docker).toHaveLength(1);
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

  // The workflow can only see the SSH step's exit status, so a failed compose has to reach it through the
  // login shell, which is what fails the job and runs the issue step (DW-20).
  it('fails the session when compose fails, after the reset', () => {
    const box = deploy({ start: 'A', mode: 'bootstrap', command: commandFor(shas.D), dockerExit: 1 });
    expect(box.status).not.toBe(0);
    expect(box.head).toBe(shas.D);
    expect(box.docker).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// The deploy workflow's wiring around the script (DW-93, DW-20)
// ---------------------------------------------------------------------------

describe('the deploy workflow', () => {
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
    expect(stepsOf()[0]).toBe('- name: Refuse any ref but main\n        run: test "$GITHUB_REF" = refs/heads/main');
  });

  it('opens an issue in its last step when any step before it failed, and only then', () => {
    const steps = stepsOf();
    const last = steps[steps.length - 1] ?? '';
    expect(last).toMatch(/^- name: Open an issue for the failed deploy\n\s+if: failure\(\)\n/);
    expect(last).toMatch(/^\s+GH_TOKEN: \$\{\{ github\.token \}\}$/m);
    expect(last).toMatch(/^\s+gh issue create --repo "\$GITHUB_REPOSITORY" \\$/m);
    expect(steps.slice(0, -1).join('\n')).not.toMatch(/^\s+if\s*:/m);
  });
});
