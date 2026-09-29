// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Story 3-5: the finance application's deploy unit, read off disk as the Hub's suites beside this one
// read theirs, since neither a Dockerfile nor a workflow is TypeScript. It is merged and imaged, not
// placed (AD-9). What is held: the image builds from the root pruned to `finance` (AD-8), the server
// boots alone and the migration toolchain is the lockfile's (AD-23), and the workflow tags by sha and
// pushes only after a real provision, migration and health answer (AD-3, AD-10).

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const read = (...path: string[]): string => readFileSync(join(REPO_ROOT, ...path), 'utf8').replace(/\r\n/g, '\n');

const DOCKERFILE = read('apps', 'finance', 'Dockerfile');
const WORKFLOW = read('.github', 'workflows', 'image-finance.yml');
const LOCKFILE = read('pnpm-lock.yaml');
const ROOT_TURBO: string = JSON.parse(read('package.json')).devDependencies.turbo;

/** Instructions with comments and blanks dropped. */
const instructions = DOCKERFILE.split('\n')
  .map((line) => line.trim())
  .filter((line) => line !== '' && !line.startsWith('#'));

/** The version `pnpm-lock.yaml` resolves for one of `apps/finance`'s direct dependencies. */
const resolved = (lock: string, name: string): string | undefined => {
  const importer = /^ {2}apps\/finance:\n([\s\S]*?)(?=^ {2}\S)/m.exec(lock)?.[1] ?? '';
  const escaped = name.replace(/[/\^$*+?.()|[\]{}]/g, '\$&');
  return new RegExp(String.raw`^ {6}'?${escaped}'?:\n {8}specifier: \S+\n {8}version: ([^(\s]+)`, 'm').exec(importer)?.[1];
};

/** Every `npm install` pin in the Dockerfile, as name to version. */
const npmPins = (dockerfile: string): Map<string, string> => {
  const line = dockerfile.split('\n').find((entry) => /^RUN npm install\b/.test(entry.trim())) ?? '';
  return new Map([...line.matchAll(/\s((?:@[\w-]+\/)?[\w.-]+)@(\d[\w.-]*)/g)].map(([, name, version]) => [name, version]));
};

describe('apps/finance/Dockerfile', () => {
  it('prunes the finance workspace with the Turborepo the root manifest pins (AD-8)', () => {
    expect(instructions).toContain(`RUN npx --yes turbo@${ROOT_TURBO} prune finance --docker`);
    expect(instructions).toContain('RUN pnpm --filter finance build');
  });

  it('boots the server alone: no migration runs on start (AD-23)', () => {
    const cmd = instructions.filter((line) => /^(CMD|ENTRYPOINT)\b/.test(line));
    expect(cmd).toEqual(['CMD ["node", "apps/finance/server.js"]']);
  });

  it('installs the migration toolchain at the versions the lockfile resolves for apps/finance', () => {
    const pins = npmPins(DOCKERFILE);
    expect([...pins.keys()].sort()).toEqual(['dotenv', 'prisma']);
    for (const [name, version] of pins) expect(version, `${name} drifted from pnpm-lock.yaml`).toBe(resolved(LOCKFILE, name));
  });

  it('names a pin that drifts from the lockfile', () => {
    expect(resolved(LOCKFILE, 'prisma'), 'the lockfile reader found nothing').toMatch(/^\d/);
    const drifted = npmPins(DOCKERFILE.replace(/prisma@[\d.]+/, 'prisma@0.0.1'));
    expect(drifted.get('prisma')).not.toBe(resolved(LOCKFILE, 'prisma'));
  });
});

describe('.github/workflows/image-finance.yml', () => {
  const steps = [...WORKFLOW.matchAll(/^ {6}- name: (.+)$/gm)].map(([, name]) => name);

  it('tags the image with the commit sha and nothing else (AD-3)', () => {
    expect(WORKFLOW).toMatch(/^ {6}IMAGE: ghcr\.io\/luigiespinosa\/finance:\$\{\{ github\.sha \}\}$/m);
    expect(WORKFLOW).toContain('docker build --file apps/finance/Dockerfile --tag "$IMAGE" .');
  });

  it('builds on every push', () => {
    expect(WORKFLOW).toMatch(/^on:\n {2}push:\n {4}branches: \['\*\*'\]\n/m);
  });

  it('provisions, migrates and answers /api/health before it pushes, in that order', () => {
    expect(steps).toEqual([
      'Build',
      'Provision a throwaway finance database',
      'Migrate',
      'Answer /api/health',
      'Log in to GHCR',
      'Push',
    ]);
    expect(WORKFLOW).toContain('< apps/finance/prisma/provision.sql');
    expect(WORKFLOW).toContain('node node_modules/prisma/build/index.js migrate deploy');
  });
});

describe('apps/finance/prisma/provision.sql', () => {
  const sql = read('apps', 'finance', 'prisma', 'provision.sql');

  it('gives finance its own role and database, each with an explicit connection limit (AD-10)', () => {
    expect(sql).toMatch(/^CREATE ROLE finance LOGIN PASSWORD :'password' CONNECTION LIMIT 10;$/m);
    expect(sql).toMatch(/^CREATE DATABASE finance OWNER finance CONNECTION LIMIT 10;$/m);
  });

  it('keeps the application pool within the role limit across a two-container rollout', () => {
    const pool = Number(/\bmax: (\d+)\b/.exec(read('apps', 'finance', 'lib', 'db.ts'))?.[1]);
    const limit = Number(/CREATE ROLE finance\b.*CONNECTION LIMIT (\d+)/.exec(sql)?.[1]);
    expect(pool).toBeGreaterThan(0);
    expect(2 * pool).toBeLessThanOrEqual(limit);
  });
});
