// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Story 4-2 (AD-7, AD-26), and Story 4-11, which hands it 80 and 443: the Traefik stack under `ops/traefik/`. Every hostname the box serves has a
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
    // AD-26: no ACME for a proxied hostname. The scratch host has no record in the inventory's zone
    // listing (Story 4-11 names it in the hostname table, as the one routed name with no DNS record),
    // and it is two labels deep so the Origin CA's `*.cuatro.dev` does not cover it.
    const zone = INVENTORY.split('\n## The whole zone, all 26 records\n')[1]?.split('\n## ')[0] ?? '';
    expect(zone).toContain('| `wheel.cuatro.dev` | A |');
    expect(zone).not.toContain(SCRATCH);
    const hostnames = INVENTORY.split('\n## Every hostname in the zone\n')[1]?.split('\n## ')[0] ?? '';
    const row = hostnames.split('\n').find((l) => l.includes(SCRATCH)) ?? '';
    expect(row).toContain('| **no DNS record** |');
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

  // Story 4-3: wheel.cuatro.dev moves first, onto a router that must answer what Caddy's block does: the
  // house headers (the container's own Caddy sends none) and the alias and port the inventory's row names.
  it('sends wheel.cuatro.dev to the alias and port the inventory names, with the house headers', () => {
    const wheel = routers.find((r) => leadingHost(r.rule ?? '') === 'wheel.cuatro.dev');
    expect(wheel).toMatchObject({ rule: 'Host(`wheel.cuatro.dev`)', middlewares: '[house-headers]', service: 'list-wheel' });
    const upstream = /^ {4}list-wheel:\n {6}loadBalancer:\n {8}servers:\n {10}- url: http:\/\/([^:/]+):(\d+)$/m.exec(ROUTES)?.slice(1);
    const row = INVENTORY.split('\n').find((l) => l.startsWith('| `wheel.cuatro.dev` | `177.7.52.248` |')) ?? '';
    const [alias, port] = /alias `([^`]+)` \| (\d+) \|$/.exec(row)?.slice(1) ?? [];
    expect(alias).toBeTruthy();
    expect(upstream).toEqual([alias, port]);
  });

  // Story 4-9: library.cuatro.dev moves as a routing move, so both of its routers must answer what Caddy's
  // block does: the split on exactly Caddy's `handle` paths, the aliases and ports the inventory's row names
  // (`library-api` 4000, `library-web` 3000), SAMEORIGIN, and the API's own `no-referrer` left standing (Caddy
  // appends its policy after the API's, so browsers apply the API's; Traefik's would replace it).
  it("splits library.cuatro.dev on Caddy's handle paths, to the aliases and ports the inventory names", () => {
    const [web, api] = ['digital-library', 'digital-library-api'].map((n) => routers.find((r) => r.name === n));
    expect(web).toMatchObject({ rule: 'Host(`library.cuatro.dev`)', middlewares: '[library-headers]', service: 'digital-library-web' });
    expect(api).toMatchObject({ middlewares: '[library-api-headers]', service: 'digital-library-api' });
    const caddy = INVENTORY.split('\nlibrary.cuatro.dev {\n')[1]?.split('\n}\n')[0] ?? '';
    const handles = [...caddy.matchAll(/handle (\/\S+)\/\* \{\n\s*reverse_proxy library-api:4000/g)].map((m) => m[1]);
    expect(handles).toEqual(['/api', '/files']);
    expect(api?.rule).toBe(`Host(\`library.cuatro.dev\`) && (${handles.map((p) => `PathPrefix(\`${p}/\`)`).join(' || ')})`);
    const upstream = (s: string) => new RegExp(`^ {4}${s}:\\n {6}loadBalancer:\\n {8}servers:\\n {10}- url: http://([^:/]+):(\\d+)$`, 'm').exec(ROUTES)?.slice(1).join(':');
    const row = INVENTORY.split('\n').find((l) => l.startsWith('| `library.cuatro.dev` | `177.7.52.248` |')) ?? '';
    expect(row).toContain('(alias `library-api`) for `/api/*` and `/files/*`');
    expect(row).toContain('(alias `library-web`) for everything else | 4000, 3000 |');
    expect([upstream('digital-library-api'), upstream('digital-library-web')]).toEqual(['library-api:4000', 'library-web:3000']);
    expect(ROUTES).toContain(['    library-headers:', '      headers:', '        contentTypeNosniff: true', '        customFrameOptionsValue: SAMEORIGIN', '        referrerPolicy: strict-origin-when-cross-origin'].join('\n'));
    expect(ROUTES).toContain(['    library-api-headers:', '      headers:', '        contentTypeNosniff: true', '        customFrameOptionsValue: SAMEORIGIN', '    www-to-apex:'].join('\n'));
  });

  // Story 4-10: Traefik forwards a WebSocket upgrade as `X-Forwarded-Proto: wss`, which cs-tracker's
  // Plug.SSL does not read as HTTPS, so its LiveView socket was answered 301 in the rehearsal until the
  // router set the header to `https`, as Caddy sends it. No headers beyond that one, as Caddy's block.
  it('sends cs-tracker.cuatro.dev to the alias and port the inventory names, forwarding the scheme as https', () => {
    const cs = routers.find((r) => leadingHost(r.rule ?? '') === 'cs-tracker.cuatro.dev');
    expect(cs).toMatchObject({ rule: 'Host(`cs-tracker.cuatro.dev`)', middlewares: '[forwarded-proto-https]', service: 'cs-tracker' });
    const upstream = /^ {4}cs-tracker:\n {6}loadBalancer:\n {8}servers:\n {10}- url: http:\/\/([^:/]+):(\d+)$/m.exec(ROUTES)?.slice(1);
    const row = INVENTORY.split('\n').find((l) => l.startsWith('| `cs-tracker.cuatro.dev` | `177.7.52.248` |')) ?? '';
    const [alias, port] = /alias `([^`]+)` \| (\d+) \|$/.exec(row)?.slice(1) ?? [];
    expect(alias).toBeTruthy();
    expect(upstream).toEqual([alias, port]);
    expect(ROUTES).toContain(['    forwarded-proto-https:', '      headers:', '        customRequestHeaders:', '          X-Forwarded-Proto: https', ''].join('\n'));
    expect(routers.filter((r) => r.middlewares?.includes('forwarded-proto-https')).map((r) => r.name)).toEqual(['cs-tracker']);
  });
});

// Story 4-11: tournament.cuatro.dev is the last hostname to leave the shared Caddy, so its router must answer
// what Caddy's block does: the house headers and the alias and port the inventory's row names.
describe('the tournament router', () => {
  it('sends tournament.cuatro.dev to the alias and port the inventory names, with the house headers', () => {
    const t = routers.find((r) => leadingHost(r.rule ?? '') === 'tournament.cuatro.dev');
    expect(t).toMatchObject({ rule: 'Host(`tournament.cuatro.dev`)', middlewares: '[house-headers]', service: 'cs-tournament' });
    const upstream = /^ {4}cs-tournament:\n {6}loadBalancer:\n {8}servers:\n {10}- url: http:\/\/([^:/]+):(\d+)$/m.exec(ROUTES)?.slice(1);
    const row = INVENTORY.split('\n').find((l) => l.startsWith('| `tournament.cuatro.dev` | `177.7.52.248` |')) ?? '';
    const [alias, port] = /alias `([^`]+)` \| (\d+) \|$/.exec(row)?.slice(1) ?? [];
    expect(alias).toBeTruthy();
    expect(upstream).toEqual([alias, port]);
  });
});

describe('ops/traefik/traefik.yml and compose.yml', () => {
  // Story 4-9: Traefik 3 cuts a request body at 60 seconds by default and Caddy never does, so a slow
  // library upload would fail only through Traefik. Story 4-11 moves websecure to 443.
  it('serves websecure on 443 with no read timeout, as the shared Caddy had none', () => {
    expect(STATIC).toMatch(/^ {2}websecure:\n {4}address: ':443'\n(?: {4}#.*\n)* {4}transport:\n {6}respondingTimeouts:\n {8}readTimeout: 0\n/m);
    expect(STATIC).not.toContain(':8443');
  });

  // Story 4-11: plain HTTP reaches the origin (the edge's `always_use_https` is off), and Caddy's port 80
  // answered it with a permanent redirect to https. The web entrypoint does the same and routes nothing.
  it('answers plain HTTP on 80 with a permanent redirect to websecure over https', () => {
    expect(STATIC).toContain(["  web:", "    address: ':80'", '    http:', '      redirections:', '        entryPoint:', '          to: websecure', '          scheme: https', '          permanent: true'].join('\n'));
    expect(ROUTES).not.toMatch(/entryPoints: \[[^\]]*\bweb\b/);
  });

  it('keeps the insecure API off and the dashboard entrypoint on loopback', () => {
    expect(STATIC).toMatch(/^ {2}insecure: false$/m);
    expect(COMPOSE).toContain("- '127.0.0.1:8081:8080'");
    expect(COMPOSE).not.toMatch(/- '(0\.0\.0\.0:)?808[01]:8080'/);
  });

  // Story 4-11: the shared Caddy is retired and Traefik holds 80 and 443 itself; 8443, where the Origin
  // Rules sent each hostname while the two ran side by side, is closed again.
  it('publishes 80 and 443 and never 8443, from one service', () => {
    const ports = [...COMPOSE.matchAll(/^ {6}- '([^']+)'$/gm)].map((m) => m[1]).filter((p) => /:\d+$/.test(p));
    expect(ports.sort()).toEqual(['127.0.0.1:8081:8080', '443:443', '80:80']);
    // Comments name 8443 for the history; no setting may.
    expect(COMPOSE.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n')).not.toContain('8443');
    expect([...COMPOSE.matchAll(/^ {2}([a-z_-]+):$/gm)].map((m) => m[1])).toEqual(['ingress', 'cs-tracker_default', 'origin-ca', 'acme']);
  });

  it('pins an exact Traefik v3.7 patch and mounts no Docker socket', () => {
    expect(COMPOSE).toMatch(/^ {4}image: traefik:v3\.7\.\d+$/m);
    expect(COMPOSE).not.toContain('docker.sock');
  });

  // Story 4-11 (DW-296): the Origin CA pair comes from a volume of Traefik's own, external so no `down -v`
  // can take it, and never from the retired Caddy's `cs-tracker_caddy_data`.
  it('stores the resolver on a named volume and reads the certificate read-only from its own volume', () => {
    expect(STATIC).toContain('storage: /acme/acme.json');
    expect(COMPOSE).toContain('- acme:/acme');
    expect(COMPOSE).toMatch(/^ {6}- origin-ca:\/etc\/traefik\/origin-ca:ro$/m);
    expect(COMPOSE).toContain(['  origin-ca:', '    external: true', '    name: traefik-origin-ca'].join('\n'));
    expect(COMPOSE).not.toContain('cs-tracker_caddy_data');
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
