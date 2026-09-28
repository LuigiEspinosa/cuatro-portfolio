// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Story 3-4 deploys with `docker-rollout`, which starts a second container of a compose service beside
// the first, waits for the new one's healthcheck, and then removes the old one. So the service it rolls
// needs a real healthcheck, and no service may carry a `container_name` or publish `ports`: a second
// container could take neither a fixed name nor a host port (AD-8). All three were true of
// `docker-compose.yml` by accident, since behind the shared proxy nothing needed a port and nothing
// named a container. Story 3-3 makes them requirements here, together with the Hub's build context,
// the repository root, which the Dockerfile's prune stage needs.
//
// The file is read as indented text, on the precedent the Dockerfile suites beside this one set: a
// service is a two-space key under `services:`, and its own keys are four spaces in.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const COMPOSE = join(REPO_ROOT, 'docker-compose.yml');

/** The Hub's service is the one that builds the Hub's image. */
const HUB = 'dockerfile: apps/hub/Dockerfile';
const HEALTH = '/api/health';

/** The file without comments or blank lines, since the comments discuss the very keys read here. */
const compose = readFileSync(COMPOSE, 'utf8')
  .split(/\r?\n/)
  .filter((line) => !/^\s*(#.*)?$/.test(line))
  .join('\n');

/** The text cut at every key indented exactly `indent` spaces, so each part runs from one such key to the next. */
const parts = (text: string, indent: number): string[] => text.split(new RegExp(String.raw`^(?= {${indent}}\S)`, 'm'));

/** Every `container_name` or `ports` a service declares. */
const rolloutFaults = (text: string): string[] =>
  [...text.matchAll(/^ {4}(container_name|ports):/gm)].map(([, key]) => `a service declares ${key}, which a second container of it cannot take`);

/** Why the Hub's service would not build from the root or roll on a real healthcheck, empty when it would. */
const hubFaults = (text: string): string[] => {
  const hub = parts(text, 2).find((part) => part.includes(HUB));
  if (hub === undefined) return [`no service builds with \`${HUB}\``];
  const faults: string[] = [];
  if (!/^ {6}context: \.$/m.test(hub)) faults.push('the Hub service builds from a context other than the repository root');
  const check = parts(hub, 4).find((part) => part.startsWith('    healthcheck:'));
  if (check === undefined) return [...faults, 'the Hub service has no healthcheck'];
  if (!check.includes(HEALTH)) faults.push(`the healthcheck does not request ${HEALTH}`);
  if (/^ {6}disable:\s*true\b/m.test(check)) faults.push('the healthcheck is disabled');
  return faults;
};

describe('docker-compose.yml', () => {
  it('declares no container_name and publishes no ports on any service, so docker-rollout can run two', () => {
    expect(compose, 'no services: block was read').toMatch(/^services:$/m);
    expect(rolloutFaults(compose)).toEqual([]);
  });

  it(`builds the Hub from the repository root, with a healthcheck on ${HEALTH}`, () => {
    expect(hubFaults(compose)).toEqual([]);
  });

  it('names a planted container_name or ports block, another context, and a healthcheck removed, disabled or pointed elsewhere', () => {
    // Each replacement lands on the Hub's service, the first to declare a healthcheck.
    const planted = (from: string, to: string): string => compose.replace(from, to);
    expect(rolloutFaults(planted('    healthcheck:', '    container_name: hub\n    healthcheck:'))).toEqual([
      expect.stringContaining('declares container_name'),
    ]);
    expect(rolloutFaults(planted('    healthcheck:', "    ports:\n      - '3000:3000'\n    healthcheck:"))).toEqual([
      expect.stringContaining('declares ports'),
    ]);
    expect(hubFaults(planted('      context: .', '      context: apps/hub'))).toEqual([
      'the Hub service builds from a context other than the repository root',
    ]);
    expect(hubFaults(planted('    healthcheck:', '    x-healthcheck:'))).toEqual(['the Hub service has no healthcheck']);
    expect(hubFaults(planted('    healthcheck:', '    healthcheck:\n      disable: true'))).toEqual(['the healthcheck is disabled']);
    expect(hubFaults(compose.split(HEALTH).join('/'))).toEqual([`the healthcheck does not request ${HEALTH}`]);
  });
});
