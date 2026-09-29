// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Story 3-1 introduced Turborepo. CI invokes the root's scripts directly rather than through turbo,
// because `turbo run` exits 0 with "No tasks were executed" when a task resolves to no script, so a gate
// routed through it could pass having run nothing (DW-252). That leaves this suite as what keeps
// `turbo.json` valid and resolving on every run of the blocking `test` job: it asks turbo for a dry run
// of the four pipelines and holds what comes back, and it prunes every workspace the way AD-8 builds an
// image. Neither executes a task, and neither needs `pnpm` on PATH.

const ROOT = process.cwd();
const TURBO = join(ROOT, 'node_modules', 'turbo', 'bin', 'turbo');
const NONE = '<NONEXISTENT>';

interface DryTask {
  taskId: string;
  task: string;
  package: string;
  command: string;
  directory: string;
  envMode: string;
  resolvedTaskDefinition: { cache: boolean };
}

const manifest = (directory: string) => JSON.parse(readFileSync(join(ROOT, directory, 'package.json'), 'utf8'));

const turbo = (args: string[]) => {
  // A unit run makes no network call: turbo's anonymous telemetry and its update check are both one.
  const run = spawnSync(process.execPath, [TURBO, '--no-update-notifier', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, TURBO_TELEMETRY_DISABLED: '1' },
    maxBuffer: 32 * 1024 * 1024,
  });
  if (run.error) throw run.error;
  return run;
};

const dry = (() => {
  const run = turbo(['run', 'build', 'test', 'typecheck', 'lint', '--dry=json']);
  if (run.status !== 0) throw new Error(`turbo run --dry=json exited ${run.status}: ${run.stderr}`);
  // A banner line precedes the JSON, which opens on a line of its own.
  const start = run.stdout.search(/^\{\r?$/m);
  if (start === -1) throw new Error(`turbo run --dry=json printed no JSON: ${run.stdout.slice(0, 500)}`);
  return JSON.parse(run.stdout.slice(start)) as { turboVersion: string; tasks: DryTask[] };
})();

describe('the Turborepo pipelines', () => {
  it("run the stack's Turborepo, 2.10.x, the version package.json pins exactly", () => {
    expect(dry.turboVersion).toMatch(/^2\.10\.\d+$/);
    expect(manifest('.').devDependencies.turbo).toBe(dry.turboVersion);
  });

  it("resolve build, test and typecheck to a workspace's own scripts, and lint to nothing", () => {
    // A task no workspace defines resolves to a placeholder command and runs nothing, and `turbo run`
    // then exits 0, so each of the three must resolve somewhere. Since Story 3.2 moved the Hub to
    // `apps/hub`, `build` is its own script there (`hub#build`), while `test` and `typecheck` stay the
    // root tasks `//#test` and `//#typecheck`, because the unit suite reads the tree from the root.
    // `packages/tokens` declares no scripts.
    const runnable = dry.tasks.filter((task) => task.command !== NONE);
    for (const task of runnable) expect(task.command, task.taskId).toBe(manifest(task.directory).scripts?.[task.task]);
    for (const name of ['build', 'test', 'typecheck']) {
      const resolved = runnable.filter((task) => task.task === name);
      expect(resolved.length, `${name} resolves to no script anywhere`).toBeGreaterThan(0);
    }
    const lint = dry.tasks.filter((task) => task.task === 'lint');
    expect(lint.length, 'no workspace resolved a lint task, so the check below passes over nothing').toBeGreaterThan(0);
    const linting = lint.filter((task) => task.command !== NONE);
    expect(linting, 'a lint script appeared; CI runs no lint (AGENTS.md)').toEqual([]);
  });

  it('run every task uncached and in loose env mode, so a turbo run is the direct run', () => {
    // On a cache hit turbo replays logs and restores only declared outputs, and none are declared; strict
    // mode withholds the variables turbo.json does not name. Either would make a turbo run differ from a
    // direct one. A story that wants caching declares outputs, inputs and env first.
    for (const task of dry.tasks) {
      expect(task.resolvedTaskDefinition.cache, task.taskId).toBe(false);
      expect(task.envMode, task.taskId).toBe('loose');
    }
  });

  it('keep every workspace manifest private, so no Satellite can install a packages/* artifact (AD-2)', () => {
    const directories = [...new Set(dry.tasks.map((task) => task.directory))];
    expect(directories.length, 'turbo saw no workspace beside the root').toBeGreaterThan(1);
    for (const directory of directories) expect(manifest(directory).private, directory || 'the root').toBe(true);
  });

  it('prune every workspace to a Docker context with its lockfile, and never the root (AD-8)', () => {
    // AD-8 builds each Anchor image from the root narrowed by `turbo prune --docker`. The root package is
    // not a prune target at all, which is why Story 3.2 moves the Hub into `apps/hub`; every workspace
    // must prune, so a lockfile shape turbo cannot read fails here rather than in an image build. Each is
    // pruned by the name turbo itself gives it, which is what `turbo prune` takes.
    const workspaces = new Map(
      dry.tasks.filter((task) => task.directory !== '').map((task) => [task.directory, task.package])
    );
    expect(workspaces.size, 'no workspace to prune, so the loop below passes over nothing').toBeGreaterThan(0);
    const pruned = (name: string, check: (run: ReturnType<typeof turbo>, out: string) => void) => {
      const out = mkdtempSync(join(tmpdir(), 'turbo-prune-'));
      try {
        check(turbo(['prune', name, '--docker', `--out-dir=${out}`]), out);
      } finally {
        rmSync(out, { recursive: true, force: true });
      }
    };
    for (const [directory, name] of workspaces) {
      pruned(name, (run, out) => {
        expect(run.status, `turbo prune ${name} --docker: ${run.stdout}${run.stderr}`).toBe(0);
        const lockfile = ['pnpm-lock.yaml', 'json/pnpm-lock.yaml', 'json/pnpm-workspace.yaml', 'json/package.json'];
        for (const file of [...lockfile, join('json', directory, 'package.json')]) {
          expect(existsSync(join(out, file)), `${name}: ${file}`).toBe(true);
        }
      });
    }
    pruned(manifest('.').name, (run) => {
      expect(run.status, 'turbo pruned the root package, so the reason the Hub moves no longer holds').not.toBe(0);
      expect(`${run.stdout}${run.stderr}`).toContain('Invalid scope');
    });
    // One prune per workspace, each copying that workspace's whole tree, so the cost grows with every
    // application merged into `apps/`; four took past Vitest's 5 s default on this host (Story 3-6).
  }, 60_000);
});
