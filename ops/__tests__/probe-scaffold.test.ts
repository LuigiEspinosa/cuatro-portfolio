// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import * as scaffold from '../probe-scaffold.mjs';
import * as adoption from '../cs-tracker-adoption-probe.mjs';
import * as daisyui from '../daisyui-route-probe.mjs';

// `ops/probe-scaffold.mjs` holds what the two rendered-output probes used to
// copy into each other (epic-1 retro item 10). These cases keep it one copy, and
// keep the parts of it that a probe's verdict leans on able to fail.

const PROBES = ['cs-tracker-adoption-probe.mjs', 'daisyui-route-probe.mjs'];

describe('the probes share one scaffold', () => {
  it.each(PROBES)('%s imports the scaffold and defines none of it again', (file) => {
    const source = readFileSync(join(process.cwd(), 'ops', file), 'utf8');
    expect(source).toMatch(/^import \{[^}]*\bserve\b[^}]*\} from '\.\/probe-scaffold\.mjs';$/m);
    const local = [
      ...source.matchAll(/^(?:export )?(?:async )?(?:function|class) (moduleDir|say|run|describeRun|readOrNull|serve|sameFile|thisFile|tailwindBanner|BlockedError)\b/gm),
    ].map((match) => match[1]);
    // `run` stays as a one-line wrapper that fixes the probe's own timeout.
    expect(local.filter((name) => name !== 'run')).toEqual([]);
    expect(source).not.toMatch(/\bcreateServer\b|\bspawnSync\b|\bstripVTControlCharacters\b/);
  });

  it("re-exports the scaffold's bindings, so each probe's public surface is unchanged", () => {
    for (const probe of [adoption, daisyui]) {
      expect(probe.BlockedError).toBe(scaffold.BlockedError);
      expect(probe.CONTRACTS).toBe(scaffold.CONTRACTS);
      expect(probe.CS_TRACKER).toBe(scaffold.CS_TRACKER);
      expect(probe.REPO_ROOT).toBe(scaffold.REPO_ROOT);
      expect(probe.tailwindBanner).toBe(scaffold.tailwindBanner);
    }
  });
});

describe('run and describeRun', () => {
  it('carries the timeout it was given, so describeRun quotes the real figure', () => {
    const result = scaffold.run(process.execPath, ['-e', 'process.stdout.write("hi")'], { timeout: 60_000 });
    expect(result).toMatchObject({ status: 0, signal: null, stdout: 'hi', error: null, timeout: 60_000 });
    const killed = { ...result, status: null, signal: 'SIGTERM' };
    expect(scaffold.describeRun(killed)).toMatch(/^was killed by SIGTERM, which is what the 60 second timeout does\n/);
  });
});

describe('serve', () => {
  let base: string;
  let server: Server;
  let origin: string;

  beforeAll(async () => {
    base = realpathSync(mkdtempSync(join(tmpdir(), 'probe-scaffold-')));
    mkdirSync(join(base, 'root', 'dir'), { recursive: true });
    writeFileSync(join(base, 'root', 'page.css'), 'a{}');
    writeFileSync(join(base, 'secret.txt'), 'outside');
    server = await scaffold.serve(join(base, 'root'));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((done) => server.close(done));
    rmSync(base, { recursive: true, force: true });
  });

  it('serves a file under its root with its MIME type', async () => {
    const response = await fetch(`${origin}/page.css`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/css; charset=utf-8');
    expect(await response.text()).toBe('a{}');
  });

  it.each(['/..%2fsecret.txt', '/dir', '/missing.css'])('answers 404 for %s', async (path) => {
    const response = await fetch(`${origin}${path}`);
    expect(response.status).toBe(404);
  });
});

describe('invokedDirectly', () => {
  it('is true only for the script node was started with', () => {
    expect(scaffold.invokedDirectly(pathToFileURL(process.argv[1]).href)).toBe(true);
    expect(scaffold.invokedDirectly(pathToFileURL(join(process.cwd(), 'ops', 'probe-scaffold.mjs')).href)).toBe(false);
    expect(scaffold.invokedDirectly('/@fs/ops/probe-scaffold.mjs')).toBe(false);
  });
});
