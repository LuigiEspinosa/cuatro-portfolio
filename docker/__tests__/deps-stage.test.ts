// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// `docker/Dockerfile` is not TypeScript, so `tsconfig.json:34-41` cannot
// typecheck it and no import can reach it. This file is where its one standing
// obligation is asserted, on the same precedent as
// `ops/__tests__/library-backup.test.ts`, which reads shell scripts off disk.
//
// The obligation. The `deps` stage copies manifests and then runs
// `pnpm install --frozen-lockfile`. Since Story 1-11 the lockfile carries
// workspace importers, and pnpm fails that install when an importer's
// `package.json` is not in the build context. Nothing else in the repository
// notices: a new workspace package passes typecheck, the unit suite, the token
// drift gate and the rendered-output harness, and fails first on the deploy from
// `main`, which is the one place there is no staging to catch it (AD-20, NFR-2).
//
// So the mirror is asserted here rather than left to a comment in the Dockerfile.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const DOCKERFILE = join(REPO_ROOT, 'docker', 'Dockerfile');
const WORKSPACE = join(REPO_ROOT, 'pnpm-workspace.yaml');

const posix = (path: string): string => path.split(sep).join('/');

/**
 * The `packages:` globs, read out of `pnpm-workspace.yaml` rather than assumed.
 * The file is two keys deep and hand-maintained, so a five line reader is a
 * better trade here than a YAML dependency the production image would carry.
 */
const workspaceGlobs = (yaml: string): string[] => {
  const lines = yaml.split(/\r?\n/);
  const start = lines.findIndex((line) => /^packages:\s*$/.test(line));
  if (start === -1) return [];
  const globs: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const entry = /^\s+-\s*['"]?([^'"#]+?)['"]?\s*$/.exec(line);
    if (!entry) break;
    globs.push(entry[1]);
  }
  return globs;
};

/** Only the shapes pnpm workspaces actually use here: `dir/*` and a plain path. */
const expandGlob = (glob: string): string[] => {
  if (!glob.endsWith('/*')) return existsSync(join(REPO_ROOT, glob)) ? [glob] : [];
  const parent = glob.slice(0, -2);
  const full = join(REPO_ROOT, parent);
  if (!existsSync(full)) return [];
  return readdirSync(full)
    .filter((entry) => statSync(join(full, entry)).isDirectory())
    .map((entry) => `${parent}/${entry}`);
};

/** The `deps` stage alone, from its `FROM ... AS deps` to the next `FROM`. */
const depsStage = (dockerfile: string): string => {
  const lines = dockerfile.split(/\r?\n/);
  const start = lines.findIndex((line) => /^FROM\s.+\sAS\s+deps\s*$/i.test(line));
  if (start === -1) throw new Error('docker/Dockerfile has no stage named deps');
  const rest = lines.slice(start + 1);
  const next = rest.findIndex((line) => /^FROM\s/i.test(line));
  return (next === -1 ? rest : rest.slice(0, next)).join('\n');
};

/** Every path named on a `COPY` line, ignoring flags and the destination. */
const copiedPaths = (stage: string): string[] => {
  const copied: string[] = [];
  for (const line of stage.split('\n')) {
    const copy = /^\s*COPY\s+(.*)$/i.exec(line);
    if (!copy) continue;
    const words = copy[1].split(/\s+/).filter((word) => word.length > 0 && !word.startsWith('--'));
    // The last word is the destination inside the image, not a source.
    copied.push(...words.slice(0, -1));
  }
  return copied;
};

const dockerfile = readFileSync(DOCKERFILE, 'utf8');
const stage = depsStage(dockerfile);
const copied = copiedPaths(stage);
const globs = workspaceGlobs(readFileSync(WORKSPACE, 'utf8'));
const workspaceDirectories = globs.flatMap(expandGlob);

describe('the Dockerfile deps stage', () => {
  it('is found, and copies something, so nothing below passes over an empty read', () => {
    expect(stage).toContain('pnpm install --frozen-lockfile');
    expect(copied.length).toBeGreaterThan(0);
    expect(copied).toContain('package.json');
    expect(copied).toContain('pnpm-lock.yaml');
  });

  it('reads the workspace globs out of pnpm-workspace.yaml rather than assuming them', () => {
    expect(globs).toEqual(['packages/*']);
    expect(workspaceDirectories.length).toBeGreaterThan(0);
  });

  it('copies pnpm-workspace.yaml, without which pnpm does not see the importers at all', () => {
    expect(
      copied,
      'docker/Dockerfile deps stage does not COPY pnpm-workspace.yaml, so `pnpm install --frozen-lockfile` resolves against a different workspace than the lockfile records'
    ).toContain('pnpm-workspace.yaml');
  });

  it('copies the manifest of every workspace package the globs match', () => {
    for (const directory of workspaceDirectories) {
      const manifest = `${directory}/package.json`;
      if (!existsSync(join(REPO_ROOT, posix(manifest)))) continue;
      expect(
        copied,
        `docker/Dockerfile deps stage does not COPY ${manifest}. The lockfile carries ${directory} as an importer, ` +
          `so \`pnpm install --frozen-lockfile\` fails in that stage and the deploy from main breaks. ` +
          `Add a COPY line for it in the same change that adds the package.`
      ).toContain(manifest);
    }
  });

  it('names a workspace manifest that is missing from the stage, rather than passing quietly', () => {
    // The check above can only fail when someone adds a package, which is
    // exactly when nobody is running it deliberately. This runs the same
    // comparison against a stage with the COPY line removed, so the check is
    // observed rejecting on every suite run.
    const withoutManifest = copiedPaths(
      stage
        .split('\n')
        .filter((line) => !/packages\/[^\s]+\/package\.json/.test(line))
        .join('\n')
    );
    expect(withoutManifest).toContain('package.json');
    for (const directory of workspaceDirectories) {
      expect(withoutManifest).not.toContain(`${directory}/package.json`);
    }
  });

  it('lists every workspace package that exists today, so a new one cannot be silently absent here', () => {
    expect(workspaceDirectories.map((directory) => relative(REPO_ROOT, join(REPO_ROOT, directory)).split(sep).join('/'))).toEqual(
      ['packages/tokens']
    );
  });
});
