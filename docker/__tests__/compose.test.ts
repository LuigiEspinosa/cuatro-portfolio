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
