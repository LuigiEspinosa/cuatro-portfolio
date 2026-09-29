// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Story 3-7: the tournament's two deploy units (AD-7), read off disk as `finance-image.test.ts` reads
// finance's. What is held: the server's image builds from the root pruned to `tournament` (AD-8) and boots
// the server alone (AD-23); the Go worker's builds from its own directory, never through Turborepo (AD-2);
// and each job tags by sha and pushes only after its image answered its probe (AD-3).

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const read = (...path: string[]): string => readFileSync(join(REPO_ROOT, ...path), 'utf8').replace(/\r\n/g, '\n');

const instructionsOf = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));

const SERVER = instructionsOf(read('apps', 'tournament', 'Dockerfile'));
const WORKER = instructionsOf(read('apps', 'tournament', 'worker', 'Dockerfile'));
const WORKFLOW = read('.github', 'workflows', 'image-tournament.yml');
const ROOT_TURBO: string = JSON.parse(read('package.json')).devDependencies.turbo;
const GO_VERSION = /^go (\S+)$/m.exec(read('apps', 'tournament', 'worker', 'go.mod'))?.[1];

/** One job's text, from its key to the next job's. */
const job = (name: string): string =>
  WORKFLOW.split(/^(?= {2}\S)/m).find((part) => part.startsWith(`  ${name}:\n`)) ?? '';
const stepsOf = (text: string): string[] => [...text.matchAll(/^ {6}- name: (.+)$/gm)].map(([, name]) => name);

describe('apps/tournament/Dockerfile', () => {
  it('prunes the tournament workspace with the Turborepo the root manifest pins, and builds it (AD-8)', () => {
    expect(SERVER).toContain(`RUN npx --yes turbo@${ROOT_TURBO} prune tournament --docker`);
    expect(SERVER).toContain('RUN pnpm --filter tournament build');
  });

  // DW-281: Next inlines both into the browser bundle at build time, and an image built without either
  // passes every probe while its Realtime client throws in the browser. So the builder refuses an empty
  // one, by name, before the build that would inline it.
  it('takes both public Supabase values as build arguments and refuses to build without either', () => {
    const build = SERVER.indexOf('RUN pnpm --filter tournament build');
    for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
      const arg = SERVER.indexOf(`ARG ${name}`);
      const check = SERVER.findIndex((line) => line.startsWith(`RUN test -n "$${name}" || {`) && line.includes('exit 1'));
      const env = SERVER.findIndex((line) => line.startsWith('ENV ') && line.includes(`${name}=$${name}`));
      expect([arg, check, env].every((index) => index >= 0), name).toBe(true);
      expect(arg < check && check < env && env < build, name).toBe(true);
    }
  });

  it('boots the traced server alone, as the unprivileged node user: nothing migrates on start (AD-23)', () => {
    expect(SERVER.filter((line) => /^(CMD|ENTRYPOINT)\b/.test(line))).toEqual(['CMD ["node", "apps/tournament/server.js"]']);
    expect(SERVER).toContain('USER node');
  });
});

describe('apps/tournament/worker/Dockerfile', () => {
  it('builds the Go module at the release its go.mod names, with no Node and no Turborepo (AD-2)', () => {
    expect(GO_VERSION).toBeDefined();
    expect(WORKER[0]).toBe(`FROM golang:${GO_VERSION}-alpine AS builder`);
    expect(WORKER.join('\n')).not.toMatch(/node|turbo|pnpm/);
  });

  it('serves as nobody, with wget for the compose probe', () => {
    expect(WORKER.filter((line) => /^(CMD|ENTRYPOINT)\b/.test(line))).toEqual(['CMD ["worker", "serve"]']);
    expect(WORKER).toContain('USER nobody');
    expect(WORKER.filter((line) => line.startsWith('FROM ')).at(-1)).toMatch(/^FROM alpine:/);
  });
});

describe('.github/workflows/image-tournament.yml', () => {
  it('builds on every push', () => {
    expect(WORKFLOW).toMatch(/^on:\n {2}push:\n {4}branches: \['\*\*'\]\n/m);
  });

  it('tags each image with the commit sha and nothing else, one job per deploy unit (AD-3, AD-7)', () => {
    expect(job('tournament')).toMatch(/^ {6}IMAGE: ghcr\.io\/luigiespinosa\/tournament:\$\{\{ github\.sha \}\}$/m);
    expect(job('tournament')).toMatch(
      /docker build --file apps\/tournament\/Dockerfile \\\n\s+--build-arg NEXT_PUBLIC_SUPABASE_URL --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY \\\n\s+--tag "\$IMAGE" \.\n/
    );
    expect(job('tournament-worker')).toMatch(/^ {6}IMAGE: ghcr\.io\/luigiespinosa\/tournament-worker:\$\{\{ github\.sha \}\}$/m);
    expect(job('tournament-worker')).toContain(
      'docker build --file apps/tournament/worker/Dockerfile --tag "$IMAGE" apps/tournament/worker'
    );
  });

  // Repository variables, never secrets and never literals: public by design, set once per repository.
  it('passes the two public Supabase values from repository variables (DW-281)', () => {
    for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
      expect(job('tournament')).toMatch(new RegExp(`^ {6}${name}: \\$\\{\\{ vars\\.${name} \\}\\}$`, 'm'));
    }
    expect(job('tournament-worker')).not.toContain('SUPABASE');
  });

  it('pushes each image only after it answered its probe', () => {
    expect(stepsOf(job('tournament'))).toEqual(['Build', 'Answer /api/health', 'Log in to GHCR', 'Push']);
    expect(stepsOf(job('tournament-worker'))).toEqual(['Build', 'Answer /healthz', 'Log in to GHCR', 'Push']);
    expect(job('tournament')).toContain('http://127.0.0.1:3000/api/health');
    expect(job('tournament-worker')).toContain('wget -q --spider http://127.0.0.1:8080/healthz');
  });
});
