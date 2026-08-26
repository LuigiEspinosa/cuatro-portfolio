// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// `docker/Dockerfile` is not TypeScript, so `tsconfig.json:34-41` cannot
// typecheck it and no import can reach it. This file asserts the runner stage's
// one standing obligation, on the same precedent
// `docker/__tests__/deps-stage.test.ts` set one stage up. It is a sibling
// rather than an addition to that file, and imports nothing from it, so the two
// stages have two independent readers: a change that breaks one reader cannot
// silently take the other obligation with it.
//
// The obligation (Story 1-16). `pnpm build` publishes `contracts/` into
// `/app/public/contracts` in the builder stage, and
// `COPY --from=builder /app/public ./public` is the single hop that carries it
// into the deployed image. Nothing else in the repository notices if that line
// is dropped or repointed: typecheck, the whole Vitest suite, all three
// contract jobs and the `rendered-output` harness stay green, because every one
// of them reads the builder's own tree rather than the image. The deploy from
// `main` then ships a working site answering 404 at every `/contracts/` URL,
// which is the exact failure Story 1-16 exists to end, and there is no staging
// to catch it (AD-20, NFR-2).
//
// Three properties, not one. Naming `public` on a COPY line is not enough: it
// has to come from the builder stage, since that is the only stage that ran the
// publish, and it has to land at the path the server reads, since `WORKDIR` is
// what makes a relative destination mean `/app/public`.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const DOCKERFILE = join(REPO_ROOT, 'docker', 'Dockerfile');

/** The stage that runs the publish, and the stage that has to carry its output forward. */
const BUILDER = 'builder';
const RUNNER = 'runner';

/** What the builder stage must run, because it is what writes `public/contracts`. */
const BUILD = 'pnpm build';

/** The directory Next serves as the document root, relative to the image's working directory. */
const PUBLIC = 'public';

interface Copy {
  /** The stage named by `--from=`, or null for a copy out of the build context. */
  from: string | null;
  /** Every source path on the line, flags and destination removed. */
  sources: string[];
  /** The destination, normalised to a working-directory-relative path: `.` for `./`. */
  destination: string;
}

const asDirectory = (destination: string): string => {
  const trimmed = destination.replace(/^\.\//, '').replace(/\/+$/, '');
  return trimmed === '' || trimmed === '.' ? '.' : trimmed;
};

/** One named stage, from its `FROM ... AS <name>` to the next `FROM`. */
const stageNamed = (dockerfile: string, name: string): string => {
  const lines = dockerfile.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(String.raw`^FROM\s.+\sAS\s+${name}\s*$`, 'i').test(line));
  if (start === -1) throw new Error(`docker/Dockerfile has no stage named ${name}`);
  const rest = lines.slice(start + 1);
  const next = rest.findIndex((line) => /^FROM\s/i.test(line));
  return (next === -1 ? rest : rest.slice(0, next)).join('\n');
};

/**
 * Every `COPY` in the stage, as its source stage plus sources plus destination.
 *
 * A shape this cannot read is a hard failure rather than a quiet skip, on the
 * same reasoning `docker/__tests__/deps-stage.test.ts` records: a guard whose
 * whole purpose is to catch an omission must not pass over a line it did not
 * understand. The exec form and a backslash continuation are both legal
 * Dockerfile and both would make the naive split below wrong.
 */
const copiesIn = (stage: string): Copy[] => {
  const copies: Copy[] = [];
  for (const line of stage.split('\n')) {
    const copy = /^\s*COPY\s+(.*)$/i.exec(line);
    if (!copy) continue;
    const rest = copy[1].trim();
    if (rest.endsWith('\\') || rest.startsWith('[')) {
      throw new Error(
        `docker/Dockerfile uses a COPY form this check cannot read: ${line.trim()}. Teach ` +
          `docker/__tests__/runner-stage.test.ts about it rather than leaving the published-surface ` +
          `obligation unchecked.`
      );
    }
    const words = rest.split(/\s+/).filter((word) => word.length > 0);
    const flags = words.filter((word) => word.startsWith('--'));
    const paths = words.filter((word) => !word.startsWith('--'));
    if (paths.length < 2) continue;
    const source = flags.map((flag) => /^--from=(.+)$/.exec(flag)).find(Boolean);
    copies.push({
      from: source ? source[1] : null,
      sources: paths.slice(0, -1),
      destination: asDirectory(paths[paths.length - 1]),
    });
  }
  return copies;
};

/** The `WORKDIR` a stage sets, or null. */
const workdirOf = (stage: string): string | null => {
  const found = /^\s*WORKDIR\s+(\S+)\s*$/im.exec(stage);
  return found ? found[1].replace(/\/+$/, '') : null;
};

/**
 * The COPY that carries `directory` out of `from`, or undefined.
 *
 * The source is matched against the absolute path the stage's own `WORKDIR`
 * makes it, so a Dockerfile that moved `WORKDIR` and updated the COPY together
 * still passes, and one that moved only one of them does not.
 */
const copyOfDirectory = (copies: Copy[], from: string, absolute: string): Copy | undefined =>
  copies.find((copy) => copy.from === from && copy.sources.includes(absolute));

const dockerfile = readFileSync(DOCKERFILE, 'utf8');
const builder = stageNamed(dockerfile, BUILDER);
const runner = stageNamed(dockerfile, RUNNER);
const runnerCopies = copiesIn(runner);
const builderWorkdir = workdirOf(builder);
const runnerWorkdir = workdirOf(runner);

describe('the Dockerfile runner stage', () => {
  it('is found, and both stages set a working directory, so nothing below passes over an empty read', () => {
    expect(builder.length, 'the builder stage read as empty').toBeGreaterThan(0);
    expect(runner.length, 'the runner stage read as empty').toBeGreaterThan(0);
    expect(runnerCopies.length, 'the runner stage copies nothing at all').toBeGreaterThan(0);
    expect(builderWorkdir, 'the builder stage sets no WORKDIR, so no absolute path can be derived').toBeTruthy();
    expect(runnerWorkdir, 'the runner stage sets no WORKDIR, so a relative destination means nothing').toBeTruthy();
  });

  it('runs the build in the builder stage, which is what writes the served copy', () => {
    expect(
      builder,
      `docker/Dockerfile's builder stage no longer runs \`${BUILD}\`, so nothing publishes contracts/ into ` +
        `${builderWorkdir}/${PUBLIC}/contracts and the image carries no published surface`
    ).toContain(BUILD);
  });

  it("copies the builder's public directory forward, which is the only hop that carries the published surface", () => {
    const absolute = `${builderWorkdir}/${PUBLIC}`;
    const copy = copyOfDirectory(runnerCopies, BUILDER, absolute);
    expect(
      copy,
      `docker/Dockerfile's runner stage does not COPY --from=${BUILDER} ${absolute}. That line is the single hop ` +
        `carrying the published surface into the deployed image: \`${BUILD}\` writes ${absolute}/contracts in the ` +
        `builder and nothing else copies it forward. Without it the deploy from main serves 404 at every ` +
        `/contracts/ URL while every CI job stays green (Story 1-16, AD-1, AD-4).`
    ).toBeDefined();
    expect(
      copy!.destination,
      `docker/Dockerfile's runner stage copies ${absolute} to "${copy!.destination}" rather than to "${PUBLIC}". ` +
        `Next serves its public directory from the working directory, so any other destination leaves ` +
        `/contracts/ answering 404 from an image that built cleanly.`
    ).toBe(PUBLIC);
  });

  it('names the omission rather than passing quietly when the line is gone', () => {
    // The check above can only fail when someone edits the Dockerfile, which is
    // exactly when nobody is running it deliberately. This runs the same
    // comparison against a stage with the COPY line removed, so it is observed
    // rejecting on every suite run.
    const absolute = `${builderWorkdir}/${PUBLIC}`;
    const withoutPublic = copiesIn(
      runner
        .split('\n')
        .filter((line) => !new RegExp(String.raw`COPY[^\n]*\s${absolute}\s`, 'i').test(line))
        .join('\n')
    );
    expect(withoutPublic.length, 'the planted negative removed every COPY, so it proves nothing').toBeGreaterThan(0);
    expect(copyOfDirectory(withoutPublic, BUILDER, absolute)).toBeUndefined();
  });

  it('rejects the same line repointed at another destination', () => {
    // The destination assertion observed rejecting, on the edit that names the
    // right directory and still leaves /contracts/ unserved.
    const absolute = `${builderWorkdir}/${PUBLIC}`;
    const repointed = copiesIn(
      runner
        .split('\n')
        .map((line) =>
          new RegExp(String.raw`COPY[^\n]*\s${absolute}\s`, 'i').test(line) ? line.replace(/\S+\s*$/, './assets') : line
        )
        .join('\n')
    );
    expect(copyOfDirectory(repointed, BUILDER, absolute)?.destination).toBe('assets');
  });

  it('rejects a build step removed from the builder stage', () => {
    const withoutBuild = builder
      .split('\n')
      .filter((line) => !line.includes(BUILD))
      .join('\n');
    expect(withoutBuild).not.toContain(BUILD);
  });

  it('rejects a COPY form it cannot read, rather than skipping the line', () => {
    expect(() => copiesIn('COPY ["public", "./public"]')).toThrow(/cannot read/);
    expect(() => copiesIn('COPY --from=builder /app/public \\')).toThrow(/cannot read/);
  });

  it('reads the --from flag rather than discarding it with the other flags', () => {
    // The property the whole file rests on. A reader that stripped every `--`
    // word, which is what the deps-stage reader does because it has no use for
    // one, would match a `COPY public ./public` out of the build context and
    // report the obligation met by a line that copies the repository's own
    // committed `public/` rather than the builder's published one.
    const [copy] = copiesIn('COPY --from=builder /app/public ./public');
    expect(copy.from).toBe(BUILDER);
    expect(copy.sources).toEqual(['/app/public']);
    expect(copy.destination).toBe(PUBLIC);
    expect(copiesIn('COPY public ./public')[0].from).toBeNull();
    expect(copyOfDirectory(copiesIn('COPY public ./public'), BUILDER, 'public')).toBeUndefined();
  });
});
