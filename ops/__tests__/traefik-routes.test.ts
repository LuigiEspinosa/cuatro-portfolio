// Story 9-21 (DW-299): the Traefik start's wiring. The start itself, every router probed against whoami
// stand-ins, is the `traefik-routes` job in `ci.yml` and `ops/traefik-routes.sh` by hand
// (`ops/traefik-cutover.md` § Rehearsed off the box). What this suite holds is that the job keeps running it,
// that the script starts what the box mounts and not a stand-in for it, and that a router or upstream added
// to `dynamic/routes.yml` cannot go unprobed: the script must name it, or this suite fails.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8').replace(/\r\n/g, '\n');
const workflow = read('.github/workflows/ci.yml');
const script = read('ops/traefik-routes.sh');
const routes = read('ops/traefik/dynamic/routes.yml');
const JOB = 'traefik-routes';

/** The job's block, comments dropped, so its prose may name what its instructions may not do. */
function jobInstructions(name: string): string {
  const lines = workflow.slice(workflow.indexOf('\njobs:\n')).split('\n');
  const start = lines.indexOf(`  ${name}:`);
  if (start === -1) throw new Error(`no job named ${name} in ci.yml`);
  const end = lines.findIndex((line, i) => i > start && /^ {2}[A-Za-z_]/.test(line));
  return lines
    .slice(start, end === -1 ? undefined : end)
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}

describe('the traefik-routes job', () => {
  const job = jobInstructions(JOB);

  it('runs the script and nothing else', () => {
    expect([...job.matchAll(/^\s*run: (.+)$/gm)].map((m) => m[1].trim())).toEqual(['bash ops/traefik-routes.sh']);
    expect([...job.matchAll(/uses: (\S+)/g)].map((m) => m[1])).toEqual(['actions/checkout@v7']);
  });

  it('is blocking: never soft-failed, skipped, gated on another job, or redirected by an env block (AD-21)', () => {
    expect(job).not.toMatch(/continue-on-error\s*:/);
    expect(job).not.toContain('|| true');
    expect(job).not.toMatch(/^\s+(if|needs|env)\s*:/m);
    expect(job).toMatch(/^\s+timeout-minutes: \d+$/m);
  });
});

describe('ops/traefik-routes.sh', () => {
  it('starts the committed compose service and overrides none of the image, traefik.yml or dynamic/', () => {
    expect(script).toContain('-f $ROOT/ops/traefik/compose.yml -f $W/override.yml');
    const override = script.replace(/\\\n\s*/g, ' ').split('\n').find((line) => line.includes('> "$W/override.yml"')) ?? '';
    expect(override, 'the override line').toContain("'  ingress:'");
    expect(override).not.toMatch(/image|traefik\.yml|\/etc\/traefik\/dynamic|command/);
  });

  it('pins each stand-in image by digest; Traefik itself is the compose file pin', () => {
    for (const name of ['WHOAMI', 'CURL']) expect(script).toMatch(new RegExp(`^${name}=\\S+:\\S+@sha256:[0-9a-f]{64}$`, 'm'));
  });

  it('runs on an internal network, so the DNS-01 resolver reaches no ACME directory', () => {
    expect(script).toContain('docker network create --internal "$NET"');
  });

  it('stands in for every upstream routes.yml dials, and for nothing else', () => {
    const services = routes.slice(routes.indexOf('\n  services:\n'), routes.indexOf('\ntls:\n'));
    const dialled = [...services.matchAll(/url: http:\/\/(\S+)/g)].map((m) => m[1]).sort();
    const standIns = (script.match(/^STAND_INS='([^']*)'$/m)?.[1] ?? '').split(' ').sort();
    expect(dialled.length, 'routes.yml dials no upstream').toBeGreaterThan(0);
    expect(standIns).toEqual(dialled);
  });

  it('expects exactly the routers routes.yml declares, in each branch of its dashboard template', () => {
    // The script's two `routers` lines, in the order it runs them: DASHBOARD_FORWARD_AUTH unset, then `on`.
    const expected = [...script.matchAll(/^routers (\S+)$/gm)].map((m) => m[1].split(','));
    expect(expected, 'one expected router list per dashboard branch').toHaveLength(2);
    (['off', 'on'] as const).forEach((branch, i) => {
      const rendered = routes.replace(
        /^\{\{ if [^}]*\}\}\n([\s\S]*?)(?:^\{\{ else \}\}\n([\s\S]*?))?^\{\{ end \}\}\n/gm,
        (_, then: string, otherwise?: string) => (branch === 'on' ? then : (otherwise ?? ''))
      );
      const routers = rendered.slice(rendered.indexOf('\n  routers:\n'), rendered.indexOf('\n  middlewares:\n'));
      const declared = [...routers.matchAll(/^ {4}([a-z0-9-]+):$/gm)].map((m) => m[1]).sort();
      expect(expected[i], `the ${branch} branch`).toEqual(declared);
    });
  });
});
