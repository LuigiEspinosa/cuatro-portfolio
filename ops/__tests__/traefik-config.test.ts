// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Story 4-2 (AD-7, AD-26): the Traefik stack under `ops/traefik/`. Every hostname the box serves has a
// router matching on Host, PathPrefix never routes between applications, the dashboard sits behind
// basic auth on its loopback entrypoint, only the scratch hostname uses the DNS-01 resolver, and no
// secret is committed. The files are read as indented text, on the precedent of
// `docker/__tests__/compose.test.ts`: no YAML parser is installed, and the routing file's own header
// fixes the shape this reads (routers four spaces in, their keys six, every rule on one line).

const ROOT = process.cwd();
const DIR = resolve(ROOT, 'ops/traefik');
// Line endings normalized: `core.autocrlf` checks these out with CRLF on the Windows authoring host.
const read = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const ROUTES = read(join(DIR, 'dynamic/routes.yml'));
const STATIC = read(join(DIR, 'traefik.yml'));
const COMPOSE = read(join(DIR, 'compose.yml'));
const INVENTORY = read(resolve(ROOT, 'ops/routing-inventory.md'));

const BOX = '177.7.52.248';
const SCRATCH = 'dns01-probe.scratch.cuatro.dev';

interface Router {
  name: string;
  rule?: string;
  entryPoints?: string;
  middlewares?: string;
  service?: string;
  certResolver?: string;
}

/** The routers under `http.routers`, each with its one-line keys. */
function parseRouters(text: string): Router[] {
  const lines = text.split(/\r?\n/);
  const start = lines.indexOf('  routers:');
  if (start < 0) throw new Error('no `  routers:` block');
  const routers: Router[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^ {0,2}\S/.test(line)) break; // the next block at two spaces or less
    const name = /^ {4}([a-z0-9-]+):\s*$/.exec(line);
    if (name) {
      routers.push({ name: name[1] });
      continue;
    }
    const key = /^ {6}(rule|entryPoints|middlewares|service):\s*(.+)$/.exec(line);
    if (key) routers[routers.length - 1][key[1] as 'rule'] = key[2].trim();
    const resolver = /^ {8}certResolver:\s*(\S+)/.exec(line);
    if (resolver) routers[routers.length - 1].certResolver = resolver[1];
  }
  return routers;
}

/** Hostnames in `§ Every hostname in the zone` whose origin is this box. */
function boxHostnames(markdown: string): string[] {
  const section = markdown.split('\n## Every hostname in the zone\n')[1]?.split('\n## ')[0];
  if (!section) throw new Error('no `## Every hostname in the zone` section');
  return section
    .split('\n')
    .filter((l) => l.startsWith('| `'))
    .map((l) => l.split('|').map((c) => c.trim()))
    .filter((cells) => cells[2] === `\`${BOX}\``)
    .map((cells) => cells[1].replace(/`/g, ''));
}

/** The one host a rule leads with, or null when it does not lead with exactly one Host. */
const leadingHost = (rule: string) => /^Host\(`([^`]+)`\)(?:\s*&&|$)/.exec(rule)?.[1] ?? null;

const routers = parseRouters(ROUTES);
const publicRouters = routers.filter((r) => r.name !== 'dashboard');

describe('the parsers', () => {
  it('read a router block and stop at the next block', () => {
    const text = ['http:', '  routers:', '    a:', '      rule: Host(`a.x`)', '      tls:', '        certResolver: r', '  services:', '    s:', '      rule: nope'].join('\n');
    expect(parseRouters(text)).toEqual([{ name: 'a', rule: 'Host(`a.x`)', certResolver: 'r' }]);
  });

  it('keep only rows whose origin is the box', () => {
    const md = ['## Every hostname in the zone', '', '| Hostname | Origin |', '|---|---|', `| \`a.x\` | \`${BOX}\` |`, '| `b.x` | **not this box** |', '', '## Next', `| \`c.x\` | \`${BOX}\` |`].join('\n');
    expect(boxHostnames('\n' + md)).toEqual(['a.x']);
  });

  it('leadingHost refuses a rule that does not start with one Host', () => {
    expect(leadingHost('Host(`a.x`)')).toBe('a.x');
    expect(leadingHost('Host(`a.x`) && PathPrefix(`/p`)')).toBe('a.x');
    expect(leadingHost('PathPrefix(`/p`)')).toBeNull();
    expect(leadingHost('Host(`a.x`) || Host(`b.x`)')).toBeNull();
    expect(leadingHost('Host(`a.x`, `b.x`)')).toBeNull();
  });
});

describe('ops/traefik/dynamic/routes.yml', () => {
  it('routes every hostname this box serves, and no other public one but the scratch host', () => {
    const inventory = boxHostnames(INVENTORY);
    expect(inventory.length).toBeGreaterThanOrEqual(8);
    const routed = new Set(publicRouters.map((r) => leadingHost(r.rule ?? '')));
    expect([...routed].sort()).toEqual([...inventory, SCRATCH].sort());
  });

  it('gives every public router a rule that leads with exactly one Host, on websecure only', () => {
    for (const r of publicRouters) {
      expect(leadingHost(r.rule ?? ''), `${r.name}: ${r.rule}`).not.toBeNull();
      expect(r.entryPoints, r.name).toBe('[websecure]');
      expect(r.service, r.name).toBeTruthy();
    }
  });

  it('uses PathPrefix only to split a hostname that also has a Host-only router', () => {
    const hostOnly = new Set(publicRouters.filter((r) => /^Host\(`[^`]+`\)$/.test(r.rule ?? '')).map((r) => leadingHost(r.rule!)));
    const split = publicRouters.filter((r) => /PathPrefix/.test(r.rule ?? ''));
    expect(split.map((r) => r.name)).toEqual(['digital-library-api']);
    for (const r of split) expect(hostOnly.has(leadingHost(r.rule!)), r.name).toBe(true);
    // Never a bare PathPrefix, which would match on every hostname.
    expect(ROUTES).not.toMatch(/rule:\s*\(?\s*PathPrefix/);
  });

  it('names the DNS-01 resolver on the scratch router alone, and the scratch host is not in the zone', () => {
    const resolving = routers.filter((r) => r.certResolver);
    expect(resolving.map((r) => [r.name, r.certResolver])).toEqual([['dns01-probe', 'cloudflare']]);
    expect(leadingHost(resolving[0].rule!)).toBe(SCRATCH);
    // Also by text, so a flow-style `tls: { certResolver: ... }` the parser does not read cannot hide one.
    expect(ROUTES.match(/certResolver/g)).toHaveLength(1);
    // AD-26: no ACME for a proxied hostname. The scratch host has no record in the inventory's zone,
    // and it is two labels deep so the Origin CA's `*.cuatro.dev` does not cover it.
    expect(INVENTORY).not.toContain(SCRATCH);
    expect(SCRATCH.split('.').length).toBe(4);
  });

  it('keeps the dashboard on its own entrypoint, behind basic auth', () => {
    const dashboard = routers.find((r) => r.name === 'dashboard');
    expect(dashboard).toEqual({ name: 'dashboard', rule: 'Host(`localhost`)', entryPoints: '[traefik]', middlewares: '[dashboard-auth]', service: 'api@internal' });
    expect(routers.filter((r) => r.service === 'api@internal').map((r) => r.name)).toEqual(['dashboard']);
    expect(ROUTES).toContain(['    dashboard-auth:', '      basicAuth:', '        users:', `          - '{{ env "TRAEFIK_DASHBOARD_USERS" }}'`].join('\n'));
  });

  it('carries the www 301 to the apex and serves the Origin CA pair by default', () => {
    expect(routers.find((r) => r.name === 'www')?.middlewares).toBe('[house-headers, www-to-apex]');
    expect(ROUTES).toContain('replacement: https://cuatro.dev${1}');
    expect(ROUTES).toContain('permanent: true');
    expect(ROUTES).toContain('certFile: /etc/traefik/origin-ca/origin.pem');
    expect(ROUTES).toContain('keyFile: /etc/traefik/origin-ca/origin.key');
  });

  // Story 4-6: docker-rollout names each new Hub container `cuatro-portfolio-anchor-app-<n>`, so only the
  // compose alias names whichever containers run, through the rollout overlap (`ops/traefik-cutover.md`). And
  // the Operator's ruling of 2026-09-24 keeps `contracts/` on the Hub, behind the apex router.
  it('sends the apex to the alias anchor-app declares, and routes no contracts/ path itself', () => {
    expect(routers.find((r) => r.name === 'cuatro-portfolio')?.service).toBe('cuatro-portfolio');
    const upstream = /^ {4}cuatro-portfolio:\n {6}loadBalancer:\n {8}servers:\n {10}- url: http:\/\/([^:/]+):3000$/m.exec(ROUTES)?.[1];
    const hub = read(resolve(ROOT, 'docker-compose.yml')).split('\n  anchor-app:\n')[1]?.split(/\n {2}\S/)[0] ?? '';
    const aliases = /\n {6}cs-tracker_default:\n {8}aliases:\n((?: {10}- \S+\n)+)/.exec(hub)?.[1].match(/\S+$/gm) ?? [];
    expect(aliases).toContain(upstream);
    expect(ROUTES).not.toMatch(/contracts/);
  });
});

describe('ops/traefik/traefik.yml and compose.yml', () => {
  it('keeps the insecure API off and the dashboard entrypoint on loopback', () => {
    expect(STATIC).toMatch(/^ {2}insecure: false$/m);
    expect(COMPOSE).toContain("- '127.0.0.1:8080:8080'");
    expect(COMPOSE).not.toMatch(/- '(0\.0\.0\.0:)?8080:8080'/);
  });

  it('publishes 8443 and never 80 or 443, which the shared Caddy holds', () => {
    const ports = [...COMPOSE.matchAll(/^ {6}- '([^']+)'$/gm)].map((m) => m[1]).filter((p) => /:\d+$/.test(p));
    expect(ports.sort()).toEqual(['127.0.0.1:8080:8080', '8443:8443']);
    // Also by text, whatever the quoting: no mapping names 80 or 443 on either side.
    expect(COMPOSE).not.toMatch(/(?<!\d)(80|443):\d+|:(80|443)(?!\d)/);
  });

  it('pins an exact Traefik v3.7 patch and mounts no Docker socket', () => {
    expect(COMPOSE).toMatch(/^ {4}image: traefik:v3\.7\.\d+$/m);
    expect(COMPOSE).not.toContain('docker.sock');
  });

  it('stores the resolver on a named volume and reads the certificate read-only', () => {
    expect(STATIC).toContain('storage: /acme/acme.json');
    expect(COMPOSE).toContain('- acme:/acme');
    expect(COMPOSE).toMatch(/source: cs-tracker_caddy_data\n {8}target: \/etc\/traefik\/origin-ca\n {8}read_only: true\n {8}volume:\n {10}subpath: origin-ca/);
  });
});

describe('no secret is committed under ops/traefik/', () => {
  const files = readdirSync(DIR, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name));

  it('holds the three configuration files and nothing else but the gitignored .env', () => {
    const rel = files.map((f) => f.slice(DIR.length + 1).replace(/\\/g, '/')).filter((f) => f !== '.env');
    expect(rel.sort()).toEqual(['compose.yml', 'dynamic/routes.yml', 'traefik.yml']);
  });

  it.each([
    ['an htpasswd hash', /\$(apr1|2[aby]|5|6)\$|\{SHA\}/],
    ['a PEM block', /-----BEGIN/],
    ['a token or key assignment with a value', /(TOKEN|KEY|PASSWORD|SECRET|USERS)\s*[=:]\s*['"]?[A-Za-z0-9_$./+-]{8,}/],
    ['a 40-character token-shaped string', /\b[A-Za-z0-9_-]{40}\b/],
  ])('no file contains %s', (_label, pattern) => {
    for (const file of files.filter((f) => !f.endsWith('.env'))) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(pattern);
    }
  });

  it('reads its secrets from a gitignored .env beside the compose file', () => {
    expect(COMPOSE).toMatch(/env_file:\n(?: {6}#.*\n)* {6}- \.env\n/);
    const ignored = spawnSync('git', ['check-ignore', '-q', 'ops/traefik/.env'], { cwd: ROOT });
    expect(ignored.status).toBe(0);
  });
});
