// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// `apps/hub/Dockerfile` is not TypeScript, so no import can reach it and `tsc` cannot check it. This
// file asserts what its `deps` stage installs, on the precedent `ops/__tests__/library-backup.test.ts`
// set by reading shell scripts off disk.
//
// Since Story 3-3 the image builds from the repository root, which the Dockerfile's first stage,
// `prune`, narrows with `turbo prune hub --docker` (AD-8). turbo writes the pruned lockfile,
// `pnpm-workspace.yaml` and every manifest that lockfile names under `out/json/`, and `deps` installs
// from that alone. Two properties follow, and neither shows until an image is built:
//
// - The install sees the Hub's importers and no others, so the token generator's packages stay out of
//   the image unless the Hub comes to depend on them (`ops/token-contract.md` action 4). A `COPY` of
//   the repository's own lockfile or of a manifest from the build context would put them back, and
//   would hand the frozen install a lockfile the prune did not write.
// - The prune runs the Turborepo the root manifest pins, the version `ops/__tests__/turborepo.test.ts`
//   prunes every workspace with on every run.
//
// The obligation this file held from Story 1-11 to Story 3-2, a `COPY` line in `deps` for every
// workspace manifest, went with the prune: turbo writes the manifests, so a workspace added later needs
// no line in the Dockerfile. Each stage is compared line for line with what it must run, so any other
// form of a line, however equivalent, fails here and names itself.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const DOCKERFILE = join(REPO_ROOT, 'apps', 'hub', 'Dockerfile');
const ROOT_TURBO: string = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')).devDependencies.turbo;

const PRUNE = `RUN npx --yes turbo@${ROOT_TURBO} prune hub --docker`;
const COPY = 'COPY --from=prune /app/out/json/ ./';
const INSTALL = 'RUN pnpm install --frozen-lockfile';

/** One stage's instructions, from its `FROM ... AS <name>` to the next `FROM`, trimmed, comments and blanks dropped. */
const stage = (dockerfile: string, name: string): string[] => {
  const lines = dockerfile.split(/\r?\n/).map((line) => line.trim());
  const start = lines.findIndex((line) => new RegExp(String.raw`^FROM\s.+\sAS\s+${name}$`, 'i').test(line));
  if (start === -1) throw new Error(`apps/hub/Dockerfile has no stage named ${name}`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^FROM\s/i.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).filter((line) => line !== '' && !line.startsWith('#'));
};

/** Why `deps` does not install the pruned tree alone, empty when it does. */
const depsFaults = (lines: string[]): string[] => {
  const copies = lines.filter((line) => /^COPY\s/i.test(line));
  const faults = copies
    .filter((line) => line !== COPY)
    .map((line) => `${line}: deps may copy \`${COPY}\` alone, or the install sees a lockfile or manifest the prune did not write`);
  if (!copies.includes(COPY)) faults.push(`deps does not \`${COPY}\``);
  const install = lines.indexOf(INSTALL);
  if (install === -1) faults.push(`deps does not \`${INSTALL}\``);
  else if (lines.indexOf(COPY) > install) faults.push(`\`${COPY}\` comes after the install, which then runs without it`);
  return faults;
};

const dockerfile = readFileSync(DOCKERFILE, 'utf8');
const deps = stage(dockerfile, 'deps');

describe('the Dockerfile prune and deps stages', () => {
  it('prunes the hub workspace, the image, with the Turborepo the root manifest pins', () => {
    expect(stage(dockerfile, 'prune'), `apps/hub/Dockerfile's prune stage must run \`${PRUNE}\``).toContain(PRUNE);
  });

  it("installs the prune stage's json output alone, copied before the install", () => {
    expect(depsFaults(deps)).toEqual([]);
  });

  it('names a copy from the build context, a copy of anything else, and the copy moved below the install', () => {
    // The checks above can only fail when someone edits the Dockerfile, which is exactly when nobody runs
    // them deliberately, so each shape of the regression they exist for is planted here on every run.
    const at = deps.indexOf(INSTALL);
    expect(depsFaults([...deps.slice(0, at), 'COPY pnpm-lock.yaml ./', ...deps.slice(at)])).toEqual([
      expect.stringContaining('COPY pnpm-lock.yaml ./: deps may copy'),
    ]);
    expect(depsFaults(deps.map((line) => (line === COPY ? 'COPY --from=prune /app/ ./' : line)))).toEqual([
      expect.stringContaining('COPY --from=prune /app/ ./: deps may copy'),
      `deps does not \`${COPY}\``,
    ]);
    expect(depsFaults([...deps.filter((line) => line !== COPY), COPY])).toEqual([
      expect.stringContaining('comes after the install'),
    ]);
  });
});
