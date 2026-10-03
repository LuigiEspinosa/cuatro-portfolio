// @vitest-environment node
import { describe, it, expect, afterAll, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Story 5.10: `ops/demo-reset.sh`, the estate's one host-level demo reset scheduler, run for real under bash
// against a `docker` stub that answers as each participant's one-shot reset and as `docker ps` does. PATH
// holds only the stub and the tools `ops/demo-principal.md` § The scheduler records on the box, so a tool the
// box lacks fails here as "command not found". Spawning bash is WSL's on Windows, as in the backup suites.

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const HERE = dirname(fileURLToPath(import.meta.url));
const OPS = resolve(HERE, '..');
const SCRIPT = join(OPS, 'demo-reset.sh');
const SCHEDULE = join(OPS, 'demo-reset.schedule');
const CRON = join(OPS, 'demo-reset.cron');
const RECORD = join(OPS, 'demo-principal.md');

// The tools the box runs for this script, beside bash: `ops/demo-principal.md` § The scheduler.
const BOX_TOOLS = ['date', 'dirname', 'mkdir', 'cmp', 'tail', 'cut', 'flock', 'timeout'];

const bashPath = (path: string): string =>
  process.platform === 'win32'
    ? path.replace(/^([A-Za-z]):/, (_match, drive: string) => `/mnt/${drive.toLowerCase()}`).replace(/\\/g, '/')
    : path;

const BASH = (() => {
  if (process.platform !== 'win32') return 'bash';
  const candidate = join(process.env.SystemRoot ?? 'C:\\Windows', 'system32', 'bash.exe');
  return existsSync(candidate) ? candidate : 'bash';
})();

const shellQuote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;
const lf = (text: string): string => text.replace(/\r\n/g, '\n');

const ROOTS: string[] = [];
afterAll(() => {
  for (const root of ROOTS) rmSync(root, { recursive: true, force: true });
});

// Each participant's directory names it, as on the box. STUB_FAIL, STUB_HANG and STUB_SKIP list ids.
const DOCKER_STUB = `#!/bin/bash
printf '%s|%s|%s|%s\\n' "$PWD" "\${HUB_TAG-}" "\${TRACKER_TAG-}" "$*" >> "$STUB_LOG"
case "$1" in
  rm) exit 0 ;;
  ps)
    case "$*" in
      *oneoff=True*)
        printf '%s\\n' \${STUB_ONEOFF-}
        [ -e "$STUB_LOG.hung" ] && printf 'started-by-this-run\\n'
        exit 0 ;;
    esac
    case "$*" in
      *service=anchor-app*) [ -n "\${STUB_HUB-}" ] && printf 'ghcr.io/luigiespinosa/hub:%s\\n' "$STUB_HUB" ;;
      *service=tracker*)
        # docker ps lists newest first: during a rollout the incoming container, then the outgoing one.
        [ -n "\${STUB_TRACKER-}" ] && printf 'ghcr.io/luigiespinosa/tracker:%s\\n' "$STUB_TRACKER"
        [ -n "\${STUB_TRACKER_OUTGOING-}" ] && printf 'ghcr.io/luigiespinosa/tracker:%s\\n' "$STUB_TRACKER_OUTGOING" ;;
    esac
    exit 0 ;;
  compose) ;;
  *) exit 2 ;;
esac
case "\${PWD##*/}" in
  cuatro-portfolio) id=cuatro-tracker ;;
  *) id="\${PWD##*/}" ;;
esac
case " \${STUB_HANG-} " in *" $id "*) : > "$STUB_LOG.hung"; exec /bin/sleep 30 ;; esac
case " \${STUB_FAIL-} " in *" $id "*) printf 'demo:reset %s failed: Postgrex.Error\\n' "$id" >&2; exit 1 ;; esac
case " \${STUB_SKIP-} " in *" $id "*) printf 'demo:reset %s skipped: demo access is off\\n' "$id"; exit 0 ;; esac
printf 'demo:reset %s reset rows=12\\n' "$id"
`;

interface Box {
  root: string;
  ops: string;
  log: string;
  installedCron: string;
  state: string;
  env: Record<string, string>;
}

const DEFAULT_SCHEDULE = 'cuatro-tracker 60\ncs-tracker 60\ndigital-library 60\n';

const makeBox = (schedule: string | null = DEFAULT_SCHEDULE): Box => {
  const root = mkdtempSync(join(tmpdir(), 'cuatro-demo-reset-'));
  ROOTS.push(root);
  const ops = join(root, 'ops');
  const checkouts = join(root, 'home');
  const stubs = join(root, 'stubs');
  const state = join(root, 'state');
  for (const dir of [ops, stubs, join(checkouts, 'cuatro-portfolio'), join(checkouts, 'cs-tracker'), join(checkouts, 'digital-library')]) {
    mkdirSync(dir, { recursive: true });
  }
  // The script beside its own schedule and cron file, as in the checkout.
  writeFileSync(join(ops, 'demo-reset.sh'), lf(readFileSync(SCRIPT, 'utf8')));
  writeFileSync(join(ops, 'demo-reset.schedule'), schedule ?? lf(readFileSync(SCHEDULE, 'utf8')));
  writeFileSync(join(ops, 'demo-reset.cron'), lf(readFileSync(CRON, 'utf8')));
  const installedCron = join(root, 'cuatro-demo-reset');
  writeFileSync(installedCron, lf(readFileSync(CRON, 'utf8')));
  writeFileSync(join(stubs, 'docker'), DOCKER_STUB.replace(/\r\n/g, '\n'));
  const log = join(root, 'docker.log');
  writeFileSync(log, '');
  return {
    root,
    ops,
    log,
    installedCron,
    state,
    env: {
      STUB_LOG: bashPath(log),
      STUB_HUB: 'f9ea578',
      STUB_TRACKER: '5117673f',
      DEMO_RESET_CRON: bashPath(installedCron),
      DEMO_RESET_DIR: bashPath(state),
      DEMO_RESET_CHECKOUTS: bashPath(checkouts),
      DEMO_RESET_NOW: String(at(0, 0)),
    },
  };
};

// Seconds since the epoch at hh:mm UTC on 2026-10-03.
function at(hour: number, minute: number): number {
  return Date.UTC(2026, 9, 3, hour, minute) / 1000;
}

let launchers = 0;
// The launcher builds a bin directory of the box's tools and the stub, then runs the script with that
// directory as the whole PATH. `prelude` runs first, with the full PATH (the held-lock case).
const run = (box: Box, args: string[] = [], env: Record<string, string> = {}, prelude = '') => {
  const launcher = join(box.root, `run-${(launchers += 1)}.sh`);
  const bin = bashPath(join(box.root, 'bin'));
  const merged = { ...box.env, ...env };
  writeFileSync(
    launcher,
    [
      '#!/bin/bash',
      `rm -rf ${shellQuote(bin)} && mkdir -p ${shellQuote(bin)}`,
      ...BOX_TOOLS.map((tool) => `ln -s "$(command -v ${tool})" ${shellQuote(`${bin}/${tool}`)}`),
      `cp ${shellQuote(bashPath(join(box.root, 'stubs', 'docker')))} ${shellQuote(`${bin}/docker`)} && chmod 755 ${shellQuote(`${bin}/docker`)}`,
      `chmod 755 ${shellQuote(bashPath(join(box.ops, 'demo-reset.sh')))}`,
      prelude,
      ...Object.entries(merged).map(([k, v]) => `export ${k}=${shellQuote(v)}`),
      `export PATH=${shellQuote(bin)}`,
      `exec /bin/bash ${shellQuote(bashPath(join(box.ops, 'demo-reset.sh')))} "$@"`,
      '',
    ].join('\n')
  );
  const result = spawnSync(BASH, [bashPath(launcher), ...args], { encoding: 'utf8' });
  if (result.error) throw result.error;
  const stdout = result.stdout ?? '';
  const lines = stdout.trim() === '' ? [] : stdout.trim().split('\n');
  const calls = readFileSync(box.log, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [pwd, hub, tracker, argv] = line.split('|');
      return { dir: pwd.split('/').pop() ?? '', hub, tracker, argv };
    });
  const composeCalls = calls.filter((call) => call.argv.startsWith('compose '));
  return { status: result.status ?? -1, stdout, stderr: result.stderr ?? '', lines, summary: lines.at(-1) ?? '', calls, composeCalls };
};

// § The reset item 7, read from the record: directory and command per participant.
const recordCommands = (): Map<string, { dir: string; command: string }> => {
  const text = lf(readFileSync(RECORD, 'utf8'));
  const rows = new Map<string, { dir: string; command: string }>();
  for (const match of text.matchAll(/^ *\| `([a-z-]+)` \| `\/home\/deploy\/([a-z-]+)`[^|]*\| `(docker compose [^`]+)` \|$/gm)) {
    rows.set(match[1], { dir: match[2], command: match[3] });
  }
  return rows;
};

describe('ops/demo-reset.sh', () => {
  it('runs each due participant with the record command in its own directory, one after another, and exits 0', () => {
    const box = makeBox();
    const result = run(box);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.lines).toEqual([
      'demo:reset cuatro-tracker reset rows=12',
      'demo:reset cs-tracker reset rows=12',
      'demo:reset digital-library reset rows=12',
      expect.stringMatching(/^demo-reset ts=\S+ tick=00:00 lock=ok schedule=ok cron=match ran=3 off=0 failed=none exit=0$/),
    ]);
    const record = recordCommands();
    expect([...record.keys()]).toEqual(['cuatro-tracker', 'cs-tracker', 'digital-library']);
    expect(result.composeCalls.map((call) => [call.dir, `docker ${call.argv}`])).toEqual(
      [...record.values()].map(({ dir, command }) => [dir, command.replace(/'/g, '')])
    );
  });

  it("gives the tracker's command the serving Hub's and tracker's tags, and no other command any", () => {
    const box = makeBox();
    const result = run(box);
    expect(result.status).toBe(0);
    const ps = result.calls.filter((call) => call.argv.startsWith('ps ') && call.argv.includes('{{.Image}}'));
    expect(ps.map((call) => call.argv)).toEqual([
      'ps --filter label=com.docker.compose.project=cuatro-portfolio --filter label=com.docker.compose.service=anchor-app --format {{.Image}}',
      'ps --filter label=com.docker.compose.project=cuatro-portfolio --filter label=com.docker.compose.service=tracker --format {{.Image}}',
    ]);
    expect(result.composeCalls.map((call) => [call.dir, call.hub, call.tracker])).toEqual([
      ['cuatro-portfolio', 'f9ea578', '5117673f'],
      ['cs-tracker', '', ''],
      ['digital-library', '', ''],
    ]);
  });

  it('names the newest tracker image while a rollout holds two tracker containers', () => {
    const box = makeBox();
    const result = run(box, ['cuatro-tracker'], { STUB_TRACKER_OUTGOING: '0ld0ut60' });
    expect(result.status).toBe(0);
    expect(result.composeCalls.map((call) => [call.dir, call.hub, call.tracker])).toEqual([
      ['cuatro-portfolio', 'f9ea578', '5117673f'],
    ]);
  });

  it('fails the tracker alone when its tags cannot be read, and still runs the others', () => {
    const box = makeBox();
    const result = run(box, [], { STUB_TRACKER: '' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('demo:reset cuatro-tracker failed: anchor-app or tracker is not running');
    expect(result.composeCalls.map((call) => call.dir)).toEqual(['cs-tracker', 'digital-library']);
    expect(result.summary).toMatch(/ ran=3 off=0 failed=cuatro-tracker exit=1$/);
  });

  it('runs every other participant when one fails, and exits 1 naming it', () => {
    const box = makeBox();
    const result = run(box, [], { STUB_FAIL: 'cs-tracker' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('demo:reset cs-tracker failed: Postgrex.Error');
    expect(result.composeCalls.map((call) => call.dir)).toEqual(['cuatro-portfolio', 'cs-tracker', 'digital-library']);
    expect(result.lines.slice(0, 2)).toEqual(['demo:reset cuatro-tracker reset rows=12', 'demo:reset digital-library reset rows=12']);
    expect(result.summary).toMatch(/ ran=3 off=0 failed=cs-tracker exit=1$/);
  });

  it('stops a participant that outlives its timeout, removes the container it started and no other, names it, and runs the next', () => {
    const box = makeBox();
    const result = run(box, [], {
      STUB_HANG: 'cuatro-tracker',
      STUB_FAIL: 'digital-library',
      STUB_ONEOFF: 'an-operator-one-off',
      DEMO_RESET_TIMEOUT: '2',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('demo:reset cuatro-tracker failed: timed out after 2 s');
    expect(result.lines[0]).toBe('demo:reset cs-tracker reset rows=12');
    expect(result.summary).toMatch(/ failed=cuatro-tracker,digital-library exit=1$/);
    const oneoffs = result.calls.filter((call) => call.argv.includes('oneoff=True'));
    expect(oneoffs[0].argv).toBe(
      `ps -q --filter label=com.docker.compose.project.working_dir=${box.env.DEMO_RESET_CHECKOUTS}/cuatro-portfolio --filter label=com.docker.compose.service=tracker --filter label=com.docker.compose.oneoff=True`
    );
    expect(result.calls.filter((call) => call.argv.startsWith('rm ')).map((call) => call.argv)).toEqual([
      'rm -f started-by-this-run',
    ]);
  });

  it('removes no container when a participant fails without timing out', () => {
    const box = makeBox();
    const result = run(box, [], { STUB_FAIL: 'cs-tracker', STUB_ONEOFF: 'an-operator-one-off' });
    expect(result.status).toBe(1);
    expect(result.calls.filter((call) => call.argv.startsWith('rm '))).toEqual([]);
  });

  it('passes a participant whose own demo access is off through as its skipped line, exit 0', () => {
    const box = makeBox();
    const result = run(box, [], { STUB_SKIP: 'digital-library' });
    expect(result.status).toBe(0);
    expect(result.lines).toContain('demo:reset digital-library skipped: demo access is off');
  });

  it('starts nothing while another run holds the lock, and says so', () => {
    const box = makeBox();
    const lock = shellQuote(`${bashPath(box.state)}/.demo-reset.lock`);
    const prelude = `mkdir -p ${shellQuote(bashPath(box.state))}; flock ${lock} sleep 10 >/dev/null 2>&1 & sleep 1`;
    const result = run(box, [], {}, prelude);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('another run holds the lock; this one started nothing');
    expect(result.calls).toEqual([]);
    expect(result.summary).toMatch(/ lock=held schedule=not-reached cron=not-reached ran=0 off=0 failed=none exit=1$/);
  });

  it('runs normally over a lock file a killed run left behind', () => {
    const box = makeBox();
    mkdirSync(box.state, { recursive: true });
    writeFileSync(join(box.state, '.demo-reset.lock'), '');
    const result = run(box);
    expect(result.status).toBe(0);
    expect(result.summary).toMatch(/ lock=ok .* ran=3 /);
  });

  it('makes no docker call for a participant off in the schedule, and prints its skipped line on the hour only', () => {
    const box = makeBox('cuatro-tracker off\ncs-tracker 60\ndigital-library 60\n');
    const result = run(box);
    expect(result.status).toBe(0);
    expect(result.lines[0]).toBe('demo:reset cuatro-tracker skipped: off in ops/demo-reset.schedule');
    expect(result.composeCalls.map((call) => call.dir)).toEqual(['cs-tracker', 'digital-library']);
    expect(result.calls.filter((call) => /cuatro-portfolio|service=tracker|service=anchor-app/.test(call.argv))).toEqual([]);
    expect(result.summary).toMatch(/ ran=2 off=1 failed=none exit=0$/);
    const allOff = makeBox('cuatro-tracker off\ncs-tracker off\ndigital-library off\n');
    const hourly = run(allOff, [], { DEMO_RESET_NOW: String(at(5, 0)) });
    expect(hourly.status).toBe(0);
    expect(hourly.calls).toEqual([]);
    expect(hourly.lines).toHaveLength(4);
    const quiet = run(allOff, [], { DEMO_RESET_NOW: String(at(5, 15)) });
    expect([quiet.status, quiet.stdout, quiet.calls]).toEqual([0, '', []]);
  });

  it("runs each participant at exactly the ticks its own interval names", () => {
    const box = makeBox('cuatro-tracker 60\ncs-tracker 120\ndigital-library 15\n');
    const ran = (hour: number, minute: number) =>
      run(box, [], { DEMO_RESET_NOW: String(at(hour, minute) + 37) }).composeCalls.map((call) => call.dir);
    // Before each run the stub's log is emptied, so each list is that tick's alone.
    const tick = (hour: number, minute: number) => {
      writeFileSync(box.log, '');
      return ran(hour, minute);
    };
    expect(tick(0, 0)).toEqual(['cuatro-portfolio', 'cs-tracker', 'digital-library']);
    expect(tick(0, 15)).toEqual(['digital-library']);
    expect(tick(1, 0)).toEqual(['cuatro-portfolio', 'digital-library']);
    expect(tick(1, 14)).toEqual(['cuatro-portfolio', 'digital-library']);
    expect(tick(2, 0)).toEqual(['cuatro-portfolio', 'cs-tracker', 'digital-library']);
    const daily = makeBox('cuatro-tracker 1440\ncs-tracker 90\ndigital-library 60\n');
    const dues = [at(0, 0), at(1, 30), at(3, 0), at(12, 0)].map((now) => {
      writeFileSync(daily.log, '');
      return run(daily, [], { DEMO_RESET_NOW: String(now) }).composeCalls.map((call) => call.dir);
    });
    expect(dues).toEqual([
      ['cuatro-portfolio', 'cs-tracker', 'digital-library'],
      ['cs-tracker'],
      ['cs-tracker', 'digital-library'],
      ['cs-tracker', 'digital-library'],
    ]);
  });

  it('says nothing and exits 0 on a tick where nothing is due', () => {
    const box = makeBox();
    const result = run(box, [], { DEMO_RESET_NOW: String(at(9, 45)) });
    expect([result.status, result.stdout, result.stderr, result.calls]).toEqual([0, '', '', []]);
  });

  it('runs the ids given as arguments now, whatever their interval, and refuses an unknown one', () => {
    const box = makeBox('cuatro-tracker 60\ncs-tracker off\ndigital-library 1440\n');
    const named = run(box, ['digital-library', 'cs-tracker'], { DEMO_RESET_NOW: String(at(9, 45)) });
    expect(named.status).toBe(0);
    expect(named.lines.slice(0, 2)).toEqual([
      'demo:reset cs-tracker skipped: off in ops/demo-reset.schedule',
      'demo:reset digital-library reset rows=12',
    ]);
    writeFileSync(box.log, '');
    const unknown = run(box, ['cs-tournament']);
    expect(unknown.status).toBe(1);
    expect(unknown.stderr).toContain('cs-tournament is not a participant');
    expect(unknown.calls).toEqual([]);
  });

  it.each([
    ['an unknown id', 'cuatro-tracker 60\ncs-tracker 60\ndigital-library 60\ncs-tournament 60\n', 'not a participant'],
    ['a participant left out', 'cuatro-tracker 60\ncs-tracker 60\n', 'does not name digital-library'],
    ['a participant named twice', 'cuatro-tracker 60\ncs-tracker 60\ndigital-library 60\ncs-tracker 30\n', 'a second time'],
    ['an interval of 0', 'cuatro-tracker 0\ncs-tracker 60\ndigital-library 60\n', 'multiple of 15'],
    ['an interval off the tick', 'cuatro-tracker 20\ncs-tracker 60\ndigital-library 60\n', 'multiple of 15'],
    ['an interval over a day', 'cuatro-tracker 1455\ncs-tracker 60\ndigital-library 60\n', 'multiple of 15'],
    ['a CRLF line', 'cuatro-tracker 60\r\ncs-tracker 60\ndigital-library 60\n', "is not '<registry-id> <minutes|off>'"],
    ['a word for an interval', 'cuatro-tracker hourly\ncs-tracker 60\ndigital-library 60\n', "is not '<registry-id> <minutes|off>'"],
  ])('runs nothing on a schedule with %s, and exits 1', (_name, schedule, message) => {
    const box = makeBox(schedule);
    const result = run(box);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
    expect(result.calls).toEqual([]);
    expect(result.summary).toMatch(/ lock=ok schedule=invalid cron=not-reached ran=0 /);
  });

  it('exits 1 naming an installed cron file that differs from the committed one or is absent, and still runs the resets', () => {
    const box = makeBox();
    writeFileSync(box.installedCron, lf(readFileSync(CRON, 'utf8')).replace('*/15', '*/30'));
    const differs = run(box);
    expect(differs.status).toBe(1);
    expect(differs.stderr).toContain('differs from ops/demo-reset.cron');
    expect(differs.composeCalls).toHaveLength(3);
    expect(differs.summary).toMatch(/ cron=differs ran=3 off=0 failed=none exit=1$/);
    rmSync(box.installedCron);
    const absent = run(box, [], { DEMO_RESET_NOW: String(at(9, 45)) });
    expect(absent.status).toBe(1);
    expect(absent.summary).toMatch(/ cron=absent ran=0 off=0 failed=none exit=1$/);
  });

  it('reads the committed schedule: every participant hourly, none due off the hour', () => {
    const box = makeBox(null);
    expect(run(box).composeCalls).toHaveLength(3);
    writeFileSync(box.log, '');
    expect(run(box, [], { DEMO_RESET_NOW: String(at(0, 30)) }).calls).toEqual([]);
  });
});

describe('ops/demo-reset.cron', () => {
  it("is one job, every 15 minutes, as deploy, running the checkout's scheduler into its state directory", () => {
    const text = readFileSync(CRON, 'utf8');
    expect(text).not.toContain('\r');
    expect(text.endsWith('\n')).toBe(true);
    const lines = text.split('\n').filter((line) => line !== '' && !line.startsWith('#'));
    expect(lines).toEqual([
      'SHELL=/bin/sh',
      'PATH=/usr/bin:/bin',
      '*/15 * * * * deploy /home/deploy/cuatro-portfolio/ops/demo-reset.sh >> /home/deploy/demo-reset/demo-reset.log 2>&1',
    ]);
    const script = readFileSync(SCRIPT, 'utf8');
    expect(script).toContain("STATE_DIR=\"${DEMO_RESET_DIR:-/home/deploy/demo-reset}\"");
    expect(script).toContain("CRON_INSTALLED=\"${DEMO_RESET_CRON:-/etc/cron.d/cuatro-demo-reset}\"");
  });

  it('is named in the record with the tools the box runs', () => {
    const record = lf(readFileSync(RECORD, 'utf8'));
    expect(record).toContain('/etc/cron.d/cuatro-demo-reset');
    for (const tool of BOX_TOOLS) expect(record).toContain(`\`${tool}\``);
  });
});
