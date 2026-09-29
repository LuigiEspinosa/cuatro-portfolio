// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Story 3-6: the tracker's deploy unit, read off disk as `finance-image.test.ts` reads finance's. What is
// held: the image builds from the root pruned to `tracker` (AD-8), the server boots alone while the worker
// and the migration run the same image's other commands (AD-23), and the workflow tags by sha and pushes
// only after a real migration, a ready answer and a ready worker (AD-3).

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const read = (...path: string[]): string => readFileSync(join(REPO_ROOT, ...path), 'utf8').replace(/\r\n/g, '\n');

const DOCKERFILE = read('apps', 'tracker', 'Dockerfile');
const WORKFLOW = read('.github', 'workflows', 'image-tracker.yml');
const COMPOSE = read('docker-compose.yml');
const ROOT_TURBO: string = JSON.parse(read('package.json')).devDependencies.turbo;

const instructions = DOCKERFILE.split('\n')
  .map((line) => line.trim())
  .filter((line) => line !== '' && !line.startsWith('#'));

/** The `command:` a compose service carries, as its YAML flow list. */
const commandOf = (service: string): string =>
  new RegExp(String.raw`^ {2}${service}:\n(?: {4}.*\n|\s*#.*\n)*? {4}command: (\[.*\])$`, 'm').exec(COMPOSE)?.[1] ?? '';

describe('apps/tracker/Dockerfile', () => {
  it('prunes the tracker workspace with the Turborepo the root manifest pins, and builds it (AD-8)', () => {
    expect(instructions).toContain(`RUN npx --yes turbo@${ROOT_TURBO} prune tracker --docker`);
    expect(instructions).toContain('RUN pnpm --filter tracker build && rm -rf apps/tracker/.next/cache');
  });

  it('boots the server alone, as the unprivileged node user: no migration runs on start (AD-23)', () => {
    expect(instructions.filter((line) => /^(CMD|ENTRYPOINT)\b/.test(line))).toEqual([
      'CMD ["node", "node_modules/next/dist/bin/next", "start"]',
    ]);
    expect(instructions).toContain('USER node');
  });

  it("gives the worker and the migration the image's own installed tools, by the paths compose runs", () => {
    expect(commandOf('tracker-worker')).toBe("['node', 'node_modules/tsx/dist/cli.mjs', 'worker.ts']");
    expect(commandOf('tracker-migrate')).toBe("['node', 'node_modules/prisma/build/index.js', 'migrate', 'deploy']");
    expect(instructions).toContain('WORKDIR /app/apps/tracker');
    // The schema engine is fetched at build time, never at the box's first migration.
    expect(instructions).toContain('RUN cd apps/tracker && node node_modules/prisma/build/index.js --version');
  });
});

describe('.github/workflows/image-tracker.yml', () => {
  const steps = [...WORKFLOW.matchAll(/^ {6}- name: (.+)$/gm)].map(([, name]) => name);

  it('tags the image with the commit sha and nothing else (AD-3)', () => {
    expect(WORKFLOW).toMatch(/^ {6}IMAGE: ghcr\.io\/luigiespinosa\/tracker:\$\{\{ github\.sha \}\}$/m);
    expect(WORKFLOW).toContain('docker build --file apps/tracker/Dockerfile --tag "$IMAGE" .');
  });

  it('builds on every push', () => {
    expect(WORKFLOW).toMatch(/^on:\n {2}push:\n {4}branches: \['\*\*'\]\n/m);
  });

  it('migrates, answers /api/ready and readies the worker before it pushes, in that order', () => {
    expect(steps).toEqual([
      'Build',
      'Start a throwaway Postgres and Redis',
      'Migrate',
      'Answer /api/ready',
      'Start the worker',
      'Log in to GHCR',
      'Push',
    ]);
    expect(WORKFLOW).toContain('node node_modules/prisma/build/index.js migrate deploy');
    expect(WORKFLOW).toContain('http://127.0.0.1:3000/api/ready');
    expect(WORKFLOW).toContain('node node_modules/tsx/dist/cli.mjs worker.ts');
  });
});
