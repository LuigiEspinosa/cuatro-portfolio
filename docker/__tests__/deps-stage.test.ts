// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
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
//
// Three properties, not one. Naming a manifest on a COPY line is not enough:
// the manifest has to land at the path pnpm will look for it, and it has to be
// there before the install runs. `COPY packages/tokens/package.json ./` names
// the right file, flattens it onto `/app/package.json`, clobbers the root
// manifest and fails the install; the same line moved below the `RUN` fails it
// too. Both are plausible edits and both must be rejected here.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const DOCKERFILE = join(REPO_ROOT, 'docker', 'Dockerfile');
const WORKSPACE = join(REPO_ROOT, 'pnpm-workspace.yaml');
const INSTALL = 'pnpm install --frozen-lockfile';

const posix = (path: string): string => path.split(sep).join('/');

/**
 * The `packages:` globs, read out of `pnpm-workspace.yaml` rather than assumed.
 * The file is two keys deep and hand-maintained, so a short reader is a better
 * trade here than a YAML dependency the production image would carry. Comments
 * and blank lines between entries are skipped rather than ending the list: YAML
 * allows them, and stopping at the first one would silently drop every glob
 * below it along with the manifests they oblige.
 */
const workspaceGlobs = (yaml: string): string[] => {
  const lines = yaml.split(/\r?\n/);
  const start = lines.findIndex((line) => /^packages:\s*$/.test(line));
  if (start === -1) return [];
  const globs: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\s*(#.*)?$/.test(line)) continue;
    const entry = /^\s+-\s*['"]?([^'"#]+?)['"]?\s*$/.exec(line);
    if (!entry) break;
    globs.push(entry[1]);
  }
  return globs;
};

/**
 * Only the shapes pnpm workspaces actually use here: `dir/*` and a plain path.
 * A directory with no `package.json` is not a workspace package, so a scratch or
 * build directory left under `packages/` neither turns this suite red nor gets
 * a COPY line demanded for it. Sorted, so the pinned list below compares against
 * a stable order rather than the filesystem's.
 */
const expandGlob = (glob: string): string[] => {
  const hasManifest = (directory: string): boolean => existsSync(join(REPO_ROOT, directory, 'package.json'));
  if (!glob.endsWith('/*')) return existsSync(join(REPO_ROOT, glob)) && hasManifest(glob) ? [glob] : [];
  const parent = glob.slice(0, -2);
  const full = join(REPO_ROOT, parent);
  if (!existsSync(full)) return [];
  return readdirSync(full)
    .sort()
    .filter((entry) => statSync(join(full, entry)).isDirectory())
    .map((entry) => `${parent}/${entry}`)
    .filter(hasManifest);
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

interface Copy {
  /** Every source path on the line, flags and destination removed. */
  sources: string[];
  /** The destination, normalised to a context-relative directory: `.` for `./`. */
  destination: string;
  /** Line index within the stage, so a COPY below the install can be caught. */
  line: number;
}

const asDirectory = (destination: string): string => {
  const trimmed = destination.replace(/^\.\//, '').replace(/\/+$/, '');
  return trimmed === '' || trimmed === '.' ? '.' : trimmed;
};

/**
 * Every `COPY` in the stage, as sources plus destination plus position.
 *
 * A shape this cannot read is a hard failure rather than a quiet skip: a guard
 * whose whole purpose is to catch an omission must not pass over a line it did
 * not understand. The exec form (`COPY ["a", "b"]`) and a backslash
 * continuation are both legal Dockerfile and both would make the naive split
 * below wrong, so they are rejected until someone teaches this reader about
 * them.
 */
const copiesIn = (stage: string): Copy[] => {
  const copies: Copy[] = [];
  stage.split('\n').forEach((line, index) => {
    const copy = /^\s*COPY\s+(.*)$/i.exec(line);
    if (!copy) return;
    const rest = copy[1].trim();
    if (rest.endsWith('\\') || rest.startsWith('[')) {
      throw new Error(
        `docker/Dockerfile deps stage line ${index + 1} uses a COPY form this check cannot read: ${line.trim()}. ` +
          `Teach docker/__tests__/deps-stage.test.ts about it rather than leaving the workspace-manifest ` +
          `obligation unchecked.`
      );
    }
    const words = rest.split(/\s+/).filter((word) => word.length > 0 && !word.startsWith('--'));
    if (words.length < 2) return;
    copies.push({
      sources: words.slice(0, -1),
      destination: asDirectory(words[words.length - 1]),
      line: index,
    });
  });
  return copies;
};

/** The COPY that brings `source` in, or undefined. */
const copyOf = (copies: Copy[], source: string): Copy | undefined =>
  copies.find((copy) => copy.sources.includes(source));

const dockerfile = readFileSync(DOCKERFILE, 'utf8');
const stage = depsStage(dockerfile);
const copies = copiesIn(stage);
const copied = copies.flatMap((copy) => copy.sources);
const installLine = stage.split('\n').findIndex((line) => line.includes(INSTALL));
const globs = workspaceGlobs(readFileSync(WORKSPACE, 'utf8'));
const workspaceDirectories = globs.flatMap(expandGlob);

describe('the Dockerfile deps stage', () => {
  it('is found, and copies something, so nothing below passes over an empty read', () => {
    expect(stage).toContain(INSTALL);
    expect(installLine).toBeGreaterThan(-1);
    expect(copies.length).toBeGreaterThan(0);
    expect(copied).toContain('package.json');
    expect(copied).toContain('pnpm-lock.yaml');
  });

  it('reads the workspace globs out of pnpm-workspace.yaml rather than assuming them', () => {
    expect(globs, 'pnpm-workspace.yaml no longer declares the globs this check expands').toEqual(['packages/*']);
    expect(
      workspaceDirectories.length,
      'no workspace package was found, so every manifest assertion below would pass over an empty list'
    ).toBeGreaterThan(0);
  });

  it('copies pnpm-workspace.yaml to the context root, without which pnpm sees no importers at all', () => {
    const copy = copyOf(copies, 'pnpm-workspace.yaml');
    expect(
      copy,
      'docker/Dockerfile deps stage does not COPY pnpm-workspace.yaml, so `pnpm install --frozen-lockfile` resolves against a different workspace than the lockfile records'
    ).toBeDefined();
    expect(copy!.destination, 'pnpm-workspace.yaml must land beside the root manifest at /app').toBe('.');
  });

  it('copies the manifest of every workspace package the globs match, to that package own directory', () => {
    for (const directory of workspaceDirectories) {
      const manifest = `${directory}/package.json`;
      const copy = copyOf(copies, posix(manifest));
      expect(
        copy,
        `docker/Dockerfile deps stage does not COPY ${manifest}. The lockfile carries ${directory} as an importer, ` +
          `so \`pnpm install --frozen-lockfile\` fails in that stage and the deploy from main breaks. ` +
          `Add a COPY line for it in the same change that adds the package.`
      ).toBeDefined();
      expect(
        copy!.destination,
        `docker/Dockerfile deps stage copies ${manifest} to "${copy!.destination}" rather than to "${directory}". ` +
          `A destination of "." flattens it onto /app/package.json and clobbers the root manifest, and any other ` +
          `path leaves pnpm unable to find the importer. The install fails and the deploy from main breaks.`
      ).toBe(directory);
    }
  });

  it('copies every manifest before the install that reads them, not after it', () => {
    for (const source of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) {
      const copy = copyOf(copies, source);
      expect(copy, `${source} is not copied in the deps stage at all`).toBeDefined();
      expect(
        copy!.line,
        `docker/Dockerfile copies ${source} after \`${INSTALL}\`, so the install runs without it`
      ).toBeLessThan(installLine);
    }
    for (const directory of workspaceDirectories) {
      const manifest = `${directory}/package.json`;
      const copy = copyOf(copies, posix(manifest));
      expect(
        copy!.line,
        `docker/Dockerfile copies ${manifest} after \`${INSTALL}\`, so the install still cannot see the importer ` +
          `and the deploy from main breaks`
      ).toBeLessThan(installLine);
    }
  });

  it('names a workspace manifest that is missing from the stage, rather than passing quietly', () => {
    // The checks above can only fail when someone adds a package, which is
    // exactly when nobody is running them deliberately. This runs the same
    // comparison against a stage with the COPY line removed, so they are
    // observed rejecting on every suite run.
    const withoutManifest = copiesIn(
      stage
        .split('\n')
        .filter((line) => !/packages\/[^\s]+\/package\.json/.test(line))
        .join('\n')
    );
    expect(withoutManifest.flatMap((copy) => copy.sources)).toContain('package.json');
    for (const directory of workspaceDirectories) {
      expect(copyOf(withoutManifest, `${directory}/package.json`)).toBeUndefined();
    }
  });

  it('rejects a manifest copied to the context root, which clobbers the root manifest', () => {
    // The destination assertion observed rejecting, on the exact edit that names
    // the right file and still breaks the install.
    const flattened = copiesIn(
      stage
        .split('\n')
        .map((line) => (/packages\/[^\s]+\/package\.json/.test(line) ? line.replace(/\S+\s*$/, './') : line))
        .join('\n')
    );
    for (const directory of workspaceDirectories) {
      expect(copyOf(flattened, `${directory}/package.json`)?.destination).toBe('.');
    }
  });

  it('rejects a COPY form it cannot read, rather than skipping the line', () => {
    expect(() => copiesIn('COPY ["package.json", "./"]')).toThrow(/cannot read/);
    expect(() => copiesIn('COPY package.json \\')).toThrow(/cannot read/);
  });

  it('lists every workspace package that exists today, so a new one cannot be silently absent here', () => {
    expect(
      workspaceDirectories,
      'the workspace gained or lost a package. Add its manifest to the deps stage COPY lines in the same change, then update this list.'
    ).toEqual(['packages/tokens']);
  });
});
