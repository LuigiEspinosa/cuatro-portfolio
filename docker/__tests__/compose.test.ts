// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Story 3-4 deploys with `docker-rollout`, which starts a second container of a compose service beside
// the first, waits for the new one's healthcheck, and then removes the old one. So the service it rolls
// needs a real healthcheck, and no service may carry a `container_name` or publish `ports`: a second
// container could take neither a fixed name nor a host port (AD-8). Story 3-3 made those requirements
// here. Story 3-4 adds what the box itself may do: it never compiles (AD-8), so no service declares
// `build:`, and the Hub's service runs its GHCR image by the commit sha the deploy puts in HUB_TAG, with
// no default, since no estate application runs a floating tag (AD-3).
//
// The healthcheck's probe is also run here, against a server that answers, one that fails and a port
// nothing serves, because docker-rollout drains the old container on the new one's word (DW-262): a probe
// that passed a server serving nothing would ship green and take the site down at the next deploy.
//
// The file is read as indented text, on the precedent the Dockerfile suites beside this one set: a
// service is a two-space key under `services:`, and its own keys are four spaces in.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const COMPOSE = join(REPO_ROOT, 'docker-compose.yml');

/** The Hub's service is the one that runs the Hub's image. */
const HUB = 'image: ghcr.io/luigiespinosa/hub:';
/** The one image line it may carry: the tag from HUB_TAG, refused when unset rather than defaulted. */
const HUB_IMAGE = /^ {4}image: ghcr\.io\/luigiespinosa\/hub:\$\{HUB_TAG:\?[^}]+\}$/m;
const HEALTH = '/api/health';

/** The file without comments or blank lines, since the comments discuss the very keys read here. */
const compose = readFileSync(COMPOSE, 'utf8')
  .split(/\r?\n/)
  .filter((line) => !/^\s*(#.*)?$/.test(line))
  .join('\n');

/** The text cut at every key indented exactly `indent` spaces, so each part runs from one such key to the next. */
const parts = (text: string, indent: number): string[] => text.split(new RegExp(String.raw`^(?= {${indent}}\S)`, 'm'));

/** Every `container_name`, `ports` or `build` a service declares. */
const serviceFaults = (text: string): string[] =>
  [...text.matchAll(/^ {4}(container_name|ports|build):/gm)].map(
    ([, key]) =>
      `a service declares ${key}, ${key === 'build' ? 'so the box would compile it (AD-8)' : 'which a second container of it cannot take'}`
  );

/** Why the Hub's service would not run its sha-tagged image on a real healthcheck, empty when it would. */
const hubFaults = (text: string): string[] => {
  const hub = parts(text, 2).find((part) => part.includes(HUB));
  if (hub === undefined) return ['no service runs ghcr.io/luigiespinosa/hub'];
  const faults: string[] = [];
  if (!HUB_IMAGE.test(hub)) faults.push('the Hub image is not tagged by HUB_TAG under a :? guard');
  const check = parts(hub, 4).find((part) => part.startsWith('    healthcheck:'));
  if (check === undefined) return [...faults, 'the Hub service has no healthcheck'];
  if (!check.includes(HEALTH)) faults.push(`the healthcheck does not request ${HEALTH}`);
  if (/^ {6}disable:\s*true\b/m.test(check)) faults.push('the healthcheck is disabled');
  return faults;
};

/**
 * The script the Hub's healthcheck hands `node -e`: the CMD-SHELL entry is a YAML single-quoted scalar,
 * whose `''` is one quote, holding `node -e "<script>"`.
 */
const probeOf = (text: string): string => {
  const entry = /^\s+\['CMD-SHELL', '(node -e .*)'\]$/m.exec(text)?.[1] ?? '';
  return /^node -e "(.*)"$/.exec(entry.replace(/''/g, "'"))?.[1] ?? '';
};

// The probe reads the host from HOSTNAME and the port is fixed at 3000, so the servers below listen on a
// loopback address of their own, which nothing else on a development host or a runner binds.
const HOST = '127.0.0.2';

/** The probe's exit status against whatever listens on HOST:3000; a probe still running at 10 s fails. */
const runProbe = (script: string): Promise<number> =>
  new Promise((done) => {
    execFile(process.execPath, ['-e', script], { env: { ...process.env, HOSTNAME: HOST }, timeout: 10_000 }, (error) =>
      done(error === null ? 0 : typeof error.code === 'number' ? error.code : 1)
    );
  });

let server: Server | undefined;
const requested: string[] = [];
const serve = (status: number): Promise<void> =>
  new Promise((listening, failed) => {
    server = createServer((request, response) => {
      requested.push(request.url ?? '');
      response.statusCode = status;
      response.end();
    })
      .on('error', failed)
      .listen(3000, HOST, () => listening());
  });

afterEach(async () => {
  requested.length = 0;
  await new Promise<void>((closed) => (server ? server.close(() => closed()) : closed()));
  server = undefined;
});

describe('docker-compose.yml', () => {
  it('declares no container_name, publishes no ports and builds nothing on any service', () => {
    expect(compose, 'no services: block was read').toMatch(/^services:$/m);
    expect(serviceFaults(compose)).toEqual([]);
  });

  it(`runs the Hub's image by the commit sha in HUB_TAG, with a healthcheck on ${HEALTH}`, () => {
    expect(hubFaults(compose)).toEqual([]);
  });

  // The deploy pulls `$REPOSITORY:<sha>` and then checks that the service runs it, while compose rolls the
  // image this file names, so the two must be one repository or a deploy rolls one image and refuses on
  // another.
  it('names the image repository ops/deploy-remote.sh pulls and checks', () => {
    const pulled = /^REPOSITORY=(\S+)$/m.exec(readFileSync(join(REPO_ROOT, 'ops', 'deploy-remote.sh'), 'utf8'))?.[1];
    expect(pulled, 'ops/deploy-remote.sh sets no REPOSITORY').toBeDefined();
    expect(/^ {4}image: (\S+):\$\{HUB_TAG:\?/m.exec(compose)?.[1]).toBe(pulled);
  });

  it('names a planted container_name, ports or build, a floating tag, and a healthcheck removed, disabled or pointed elsewhere', () => {
    // Each replacement lands on the Hub's service, the first to declare a healthcheck.
    const planted = (from: string, to: string): string => compose.replace(from, to);
    expect(serviceFaults(planted('    healthcheck:', '    container_name: hub\n    healthcheck:'))).toEqual([
      expect.stringContaining('declares container_name'),
    ]);
    expect(serviceFaults(planted('    healthcheck:', "    ports:\n      - '3000:3000'\n    healthcheck:"))).toEqual([
      expect.stringContaining('declares ports'),
    ]);
    expect(serviceFaults(planted('    healthcheck:', '    build: .\n    healthcheck:'))).toEqual([
      'a service declares build, so the box would compile it (AD-8)',
    ]);
    const image = /^ {4}image: ghcr\.io\/luigiespinosa\/hub:.*$/m;
    for (const floating of ['latest', '${HUB_TAG:-latest}', '${HUB_TAG}']) {
      expect(hubFaults(compose.replace(image, `    image: ghcr.io/luigiespinosa/hub:${floating}`)), floating).toEqual([
        'the Hub image is not tagged by HUB_TAG under a :? guard',
      ]);
    }
    expect(hubFaults(planted('    healthcheck:', '    x-healthcheck:'))).toEqual(['the Hub service has no healthcheck']);
    expect(hubFaults(planted('    healthcheck:', '    healthcheck:\n      disable: true'))).toEqual(['the healthcheck is disabled']);
    expect(hubFaults(compose.split(HEALTH).join('/'))).toEqual([`the healthcheck does not request ${HEALTH}`]);
  });
});

describe("the Hub's healthcheck probe, run (DW-262)", () => {
  const probe = probeOf(compose);

  it('reads the probe out of the healthcheck', () => {
    expect(probe).toContain('process.env.HOSTNAME');
    expect(probe).toContain(HEALTH);
  });

  it(`passes a server that answers ${HEALTH}`, async () => {
    await serve(200);
    expect(await runProbe(probe)).toBe(0);
    expect(requested).toEqual([HEALTH]);
  });

  it('fails a server that answers with an error', async () => {
    await serve(503);
    expect(await runProbe(probe)).not.toBe(0);
  });

  it('fails a port nothing serves', async () => {
    expect(await runProbe(probe)).not.toBe(0);
  });

  // The shape DW-262 names: a probe rewritten to pass whatever happens would pass a port nothing serves,
  // so the case above fails it.
  it('names a probe rewritten to pass whatever happens', async () => {
    const planted = probe.replace('.catch(()=>process.exit(1))', '.catch(()=>process.exit(0))');
    expect(planted).not.toBe(probe);
    expect(await runProbe(planted)).toBe(0);
  });
});

// Story 4-7: Umami, the estate's analytics, on the estate's one Postgres (`ops/postgres.md` § Moving Umami).
// Its image is an exact release and registry digest, never the floating `postgresql-latest` it ran before
// (DW-191). The image's start script migrates unless SKIP_DB_MIGRATION is set, so the server sets it and
// the migration is its own one-off under the `migrate` profile, from the same image (AD-23, DW-302). Both
// reach database and role `umami` at `estate-postgres` and never `anchor-db`, which stays only as the
// move's rollback. The server's healthcheck lets the move's `up` report healthy and a rollout roll it
// (AD-8, DW-179).
describe('the Umami services', () => {
  const PINNED = /^ {4}image: (ghcr\.io\/umami-software\/umami:\d+\.\d+\.\d+@sha256:[0-9a-f]{64})$/m;
  const DATABASE = '      - DATABASE_URL=postgresql://umami:${UMAMI_DB_PASSWORD-}@estate-postgres:5432/umami';
  const MIGRATE = "    command: ['node', 'node_modules/prisma/build/index.js', 'migrate', 'deploy']";

  /** Why Umami's two services would not run pinned, migrate discretely and reach the estate database. */
  const umamiFaults = (text: string): string[] => {
    const service = (name: string): string => parts(text, 2).find((part) => part.startsWith(`  ${name}:\n`)) ?? '';
    const server = service('anchor-umami');
    const migrate = service('anchor-umami-migrate');
    if (server === '') return ['no anchor-umami service'];
    const faults: string[] = [];
    const image = PINNED.exec(server)?.[1];
    if (image === undefined) faults.push('the server image is not an exact release and digest');
    if (migrate === '') return [...faults, 'no anchor-umami-migrate service'];
    if (PINNED.exec(migrate)?.[1] !== image) faults.push("the migration does not run the server's pinned image");
    if (!server.split('\n').includes('      - SKIP_DB_MIGRATION=1')) faults.push('the server migrates on boot');
    const lines = migrate.split('\n');
    if (!lines.includes('    profiles: [migrate]') || !lines.includes(MIGRATE) || !lines.includes("    restart: 'no'"))
      faults.push('the migration is not a one-off prisma migrate deploy under the migrate profile');
    for (const [name, part] of [['anchor-umami', server], ['anchor-umami-migrate', migrate]]) {
      if (!part.split('\n').includes(DATABASE) || !/^ {6}estate-postgres:$/m.test(part))
        faults.push(`${name} does not reach umami at estate-postgres`);
      if (part.includes('anchor-db')) faults.push(`${name} names anchor-db`);
    }
    const check = parts(server, 4).find((part) => part.startsWith('    healthcheck:'));
    if (check === undefined || !check.includes('/api/heartbeat') || /^ {6}disable:\s*true\b/m.test(check))
      faults.push('the server has no healthcheck on /api/heartbeat');
    return faults;
  };

  it('pins an exact release and digest, migrates as a one-off from it, and reaches umami at estate-postgres', () => {
    expect(umamiFaults(compose)).toEqual([]);
  });

  it('declares estate-postgres external, since the estate Postgres stack owns it', () => {
    const networks = parts(compose, 0).find((part) => part.startsWith('networks:'));
    expect(networks).toMatch(/^ {2}estate-postgres:\n {4}external: true$/m);
  });

  it('names a floating tag, a boot migration, a missing one-off, the old database and a missing healthcheck', () => {
    const image = /^( {4}image: ghcr\.io\/umami-software\/umami:)\S+$/m;
    for (const floating of ['postgresql-latest', '3.4.0', '3', 'latest@sha256:0']) {
      expect(umamiFaults(compose.replace(image, `$1${floating}`))[0], floating).toBe(
        'the server image is not an exact release and digest'
      );
    }
    const migrateImage = /^( {4}image: ghcr\.io\/umami-software\/umami:)\S+(\n {4}profiles: \[migrate\])$/m;
    expect(umamiFaults(compose.replace(migrateImage, `$1${'3.3.0@sha256:' + '0'.repeat(64)}$2`))).toEqual([
      "the migration does not run the server's pinned image",
    ]);
    expect(umamiFaults(compose.replace('      - SKIP_DB_MIGRATION=1\n', ''))).toEqual(['the server migrates on boot']);
    expect(umamiFaults(compose.replace('  anchor-umami-migrate:', '  anchor-umami-migrated:'))).toEqual([
      'no anchor-umami-migrate service',
    ]);
    const profile = /^( {4}image: ghcr\.io\/umami-software\/umami:\S+\n {4}profiles: )\[migrate\]$/m;
    expect(umamiFaults(compose.replace(profile, '$1[umami]'))).toEqual([
      'the migration is not a one-off prisma migrate deploy under the migrate profile',
    ]);
    expect(umamiFaults(compose.replace('@estate-postgres:5432/umami', '@anchor-db:5432/umami'))).toEqual([
      'anchor-umami does not reach umami at estate-postgres',
      'anchor-umami names anchor-db',
    ]);
    expect(umamiFaults(compose.replace('/api/heartbeat', '/'))).toEqual(['the server has no healthcheck on /api/heartbeat']);
    const probe = "    healthcheck:\n      test: ['CMD', 'curl'";
    expect(umamiFaults(compose.replace(probe, probe.replace('healthcheck:', 'healthcheck:\n      disable: true')))).toEqual([
      'the server has no healthcheck on /api/heartbeat',
    ]);
  });
});

// Story 3-5: the finance application, merged and imaged but not placed. Its two services sit under
// profiles no deploy activates, run its image by the sha in FINANCE_TAG, and reach database and role
// `finance` in `anchor-db` (AD-10). The migration is its own one-off service under the `migrate` profile,
// the name `ops/deploy-remote.sh` runs before a rollout (AD-23), and the server's probe is the Hub's,
// which the cases above run against a live server.
describe('the finance services', () => {
  const service = (name: string): string => parts(compose, 2).find((part) => part.startsWith(`  ${name}:\n`)) ?? '';
  const finance = service('finance');
  const migrate = service('finance-migrate');
  const IMAGE = '    image: ghcr.io/luigiespinosa/finance:${FINANCE_TAG-}';
  const DATABASE = '      - DATABASE_URL=postgresql://finance:${FINANCE_DB_PASSWORD-}@anchor-db:5432/finance';

  it('runs the image by the sha in FINANCE_TAG, under a profile no deploy activates', () => {
    expect(finance.split('\n')).toEqual(expect.arrayContaining([IMAGE, '    profiles: [finance]', DATABASE]));
  });

  it("probes /api/health with the Hub's probe, so the runs above cover it", () => {
    expect(probeOf(finance)).toBe(probeOf(compose));
    expect(probeOf(finance)).toContain(HEALTH);
  });

  it('migrates as a one-off under the migrate profile, never on the server', () => {
    expect(migrate.split('\n')).toEqual(
      expect.arrayContaining([
        IMAGE,
        '    profiles: [migrate]',
        "    command: ['node', 'node_modules/prisma/build/index.js', 'migrate', 'deploy']",
        DATABASE,
      ])
    );
    expect(finance).not.toContain('migrate');
  });

  it('joins no network the shared proxy reaches, since it has no router until it is placed', () => {
    expect(finance).not.toContain('cs-tracker_default');
    expect(migrate).not.toContain('cs-tracker_default');
  });
});

// Story 3-6: the tracker, merged and imaged, and started only by the Operator's cutover
// (`ops/tracker-cutover.md`). Its server and worker sit under a profile no deploy activates, run its image
// by the sha in TRACKER_TAG, and reach Redis and qBittorrent in the box's `cuatro-tracker` project, by
// container name, over that project's network. The server answers to `cuatro-app`, the upstream the
// shared Caddyfile already proxies, and its probe is the Hub's on `/api/ready`. Story 4-8 moves its
// database to `cuatro_tracker` in the estate Postgres, with the pool capped on the URL (AD-10).
describe('the tracker services', () => {
  const service = (name: string): string => parts(compose, 2).find((part) => part.startsWith(`  ${name}:\n`)) ?? '';
  const tracker = service('tracker');
  const worker = service('tracker-worker');
  const migrate = service('tracker-migrate');
  const IMAGE = '    image: ghcr.io/luigiespinosa/tracker:${TRACKER_TAG-}';
  const DATABASE =
    '      - DATABASE_URL=postgresql://cuatro_tracker:${CUATRO_TRACKER_DB_PASSWORD-}@estate-postgres:5432/cuatro_tracker?connection_limit=4';
  const READY = '/api/ready';
  const NAMES = ['tracker', 'tracker-worker', 'tracker-migrate'];

  /** Why the three services would not reach `cuatro_tracker` at estate-postgres under the pool cap. */
  const databaseFaults = (text: string): string[] => {
    const of = (name: string): string => parts(text, 2).find((part) => part.startsWith(`  ${name}:\n`)) ?? '';
    const faults: string[] = [];
    for (const name of NAMES) {
      const part = of(name);
      // The worker takes the server's environment through the YAML anchor, so its URL is the server's.
      const environment = name === 'tracker-worker' ? of('tracker') : part;
      if (!environment.split('\n').includes(DATABASE))
        faults.push(`${name} does not reach cuatro_tracker at estate-postgres with connection_limit=4`);
      if (!/^ {6}estate-postgres:$/m.test(part)) faults.push(`${name} does not join estate-postgres`);
      if (part.includes('cuatro-tracker-postgres-1')) faults.push(`${name} names the old database`);
    }
    return faults;
  };

  it('runs the image by the sha in TRACKER_TAG, the server and worker under a profile no deploy activates', () => {
    for (const part of [tracker, worker]) {
      expect(part.split('\n')).toEqual(expect.arrayContaining([IMAGE, '    profiles: [tracker]']));
    }
    expect(tracker.split('\n')).toEqual(expect.arrayContaining([DATABASE, '      - REDIS_URL=redis://cuatro-tracker-redis-1:6379']));
    expect(worker).toContain('    environment: *tracker-environment');
  });

  it('migrates as a one-off under the migrate profile, and never on the server or the worker', () => {
    expect(migrate.split('\n')).toEqual(expect.arrayContaining([IMAGE, '    profiles: [migrate]', DATABASE]));
    expect(tracker).not.toContain('migrate');
    expect(worker).not.toContain('migrate');
  });

  it('answers to cuatro-app on the shared network, and reaches Redis and qBittorrent over the tracker project network', () => {
    expect(tracker).toMatch(
      /^ {4}networks:\n {6}estate-postgres:\n {6}cuatro-tracker_default:\n {6}cs-tracker_default:\n {8}aliases:\n {10}- cuatro-app$/m
    );
    expect(worker).toMatch(/^ {4}networks:\n {6}estate-postgres:\n {6}cuatro-tracker_default:$/m);
    expect(worker).not.toContain('cs-tracker_default');
    expect(migrate).toMatch(/^ {4}networks:\n {6}estate-postgres:\n {4}restart: 'no'$/m);
    expect(compose).toMatch(/^ {2}cuatro-tracker_default:\n {4}external: true$/m);
  });

  it('reaches cuatro_tracker at estate-postgres with connection_limit=4 from all three services (AD-10)', () => {
    expect(databaseFaults(compose)).toEqual([]);
    expect(tracker.split('\n')).toContain('      - DB_PASS=${CUATRO_TRACKER_DB_PASSWORD-}');
  });

  it('names the old database, a missing pool cap and a missing estate network', () => {
    const unreached = (name: string): string => `${name} does not reach cuatro_tracker at estate-postgres with connection_limit=4`;
    const old = compose.replaceAll('@estate-postgres:5432/cuatro_tracker?connection_limit=4', '@cuatro-tracker-postgres-1:5432/tracker');
    expect(databaseFaults(old)).toEqual([
      unreached('tracker'),
      'tracker names the old database',
      unreached('tracker-worker'),
      unreached('tracker-migrate'),
      'tracker-migrate names the old database',
    ]);
    expect(databaseFaults(compose.replaceAll('?connection_limit=4', ''))).toEqual(NAMES.map(unreached));
    const migrateNetwork = /^( {4}networks:\n) {6}estate-postgres:\n( {4}restart: 'no')$/m;
    expect(databaseFaults(compose.replace(migrate, migrate.replace(migrateNetwork, '$1      cuatro-tracker_default:\n$2')))).toEqual([
      'tracker-migrate does not join estate-postgres',
    ]);
  });

  it(`probes ${READY} with the Hub's probe, so the runs above cover its handling`, () => {
    expect(probeOf(tracker)).toBe(probeOf(compose).replace(HEALTH, READY));
  });

  it(`passes a server that answers ${READY}, and fails one that answers 503`, async () => {
    await serve(200);
    expect(await runProbe(probeOf(tracker))).toBe(0);
    expect(requested).toEqual([READY]);
    await new Promise<void>((closed) => server!.close(() => closed()));
    server = undefined;
    await serve(503);
    expect(await runProbe(probeOf(tracker))).not.toBe(0);
  });
});

// Story 3-7: the tournament, merged and imaged, and placed by hand (`ops/tournament-placement.md`). Two
// deploy units (AD-7), the Next.js server and the Go demo worker, each its own image by the sha in
// TOURNAMENT_TAG under a profile no deploy activates. Its data stays in Supabase Cloud (Operator ruling
// 2026-09-29), so neither reaches `anchor-db`. The server answers to `tournament` on the shared network,
// the upstream the tournament.cuatro.dev site block proxies; the worker has no public hostname and joins
// the project's own network alone.
describe('the tournament services', () => {
  const service = (name: string): string => parts(compose, 2).find((part) => part.startsWith(`  ${name}:\n`)) ?? '';
  const tournament = service('tournament');
  const worker = service('tournament-worker');

  it('runs each deploy unit from its own image, by the sha in TOURNAMENT_TAG, under a profile no deploy activates', () => {
    expect(tournament.split('\n')).toEqual(
      expect.arrayContaining(['    image: ghcr.io/luigiespinosa/tournament:${TOURNAMENT_TAG-}', '    profiles: [tournament]'])
    );
    expect(worker.split('\n')).toEqual(
      expect.arrayContaining(['    image: ghcr.io/luigiespinosa/tournament-worker:${TOURNAMENT_TAG-}', '    profiles: [tournament]'])
    );
  });

  it("probes /api/health with the Hub's probe, and the worker its own /healthz", () => {
    expect(probeOf(tournament)).toBe(probeOf(compose));
    expect(worker).toContain("    test: ['CMD', 'wget', '-q', '--spider', 'http://127.0.0.1:8080/healthz']");
  });

  it('answers to tournament on the shared network and keeps default; the worker joins default alone', () => {
    expect(tournament).toMatch(/^ {4}networks:\n {6}default:\n {6}cs-tracker_default:\n {8}aliases:\n {10}- tournament\n {4}healthcheck:/m);
    expect(worker).toMatch(/^ {4}networks:\n {6}default:\n {4}healthcheck:/m);
    expect(worker).not.toContain('cs-tracker_default');
  });

  it('reaches no anchor-db and migrates nothing', () => {
    for (const part of [tournament, worker]) {
      expect(part).not.toContain('anchor-db');
      expect(part).not.toContain('migrate');
    }
    expect(parts(compose, 2).some((part) => part.startsWith('  tournament-migrate:'))).toBe(false);
  });
});
