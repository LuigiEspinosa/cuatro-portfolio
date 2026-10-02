// Story 5.7 (FR-23, AD-11): the provider-swap demonstration's wiring. The demonstration itself, a sign-in
// through each participant against a second, independently implemented issuer, is the `provider-swap` job
// in `ci.yml` and `ops/provider-swap.sh` by hand (`ops/identity-issuer.md` § Provider replaceability).
// What this suite holds is that the job keeps running it, and that the script hands each participant its
// issuer and client variables and nothing else, so "a configuration change" stays the claim it proves.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8').replace(/\r\n/g, '\n');
const workflow = read('.github/workflows/ci.yml');
const script = read('ops/provider-swap.sh');
const JOB = 'provider-swap';

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

/** The script's commands, continuation lines joined. */
const commands = script.replace(/\\\n\s*/g, ' ').split('\n');
const runOf = (container: string) => {
  const found = commands.filter((c) => c.includes(`docker run -d --name ${container} `));
  expect(found, `one docker run starts ${container}`).toHaveLength(1);
  return found[0];
};
const envNames = (command: string) => [...command.matchAll(/ -e ([A-Z_]+)=/g)].map((m) => m[1]).sort();
const printedNames = (marker: string) => {
  const line = commands.find((c) => c.includes(marker)) ?? '';
  return [...line.matchAll(/"?([A-Z_]+)=/g)].map((m) => m[1]).sort();
};

describe('the provider-swap job', () => {
  const job = jobInstructions(JOB);

  it('builds the Hub production image and runs the script with it, and nothing else', () => {
    const runs = [...job.matchAll(/^\s*run: (.+)$/gm)].map((m) => m[1].trim());
    expect(runs).toEqual([
      'docker build -f apps/hub/Dockerfile -t provider-swap-hub:ci .',
      'HUB_IMAGE=provider-swap-hub:ci bash ops/provider-swap.sh',
    ]);
    expect([...job.matchAll(/uses: (\S+)/g)].map((m) => m[1])).toEqual(['actions/checkout@v7']);
  });

  it('is blocking: never soft-failed, skipped, gated on another job, or redirected by an env block (AD-21)', () => {
    expect(job).not.toMatch(/continue-on-error\s*:/);
    expect(job).not.toContain('|| true');
    expect(job).not.toMatch(/^\s+(if|needs|env)\s*:/m);
    expect(job).toMatch(/^\s+timeout-minutes: \d+$/m);
  });
});

describe('ops/provider-swap.sh', () => {
  it('runs dex pinned by its digest, and the forward-auth service from the committed compose file', () => {
    expect(script).toMatch(/^DEX=ghcr\.io\/dexidp\/dex:v\d+\.\d+\.\d+@sha256:[0-9a-f]{64}$/m);
    expect(script).toContain('-f $ROOT/ops/traefik/compose.yml');
    expect(script).toMatch(/--profile forward-auth up -d forward-auth/);
  });

  it('hands the Hub its three variables and the scratch authority, and runs the image as built', () => {
    const hub = runOf('provider-swap-hub');
    expect(envNames(hub)).toEqual(['CUATRO_PORTFOLIO_OIDC_CLIENT_ID', 'CUATRO_PORTFOLIO_OIDC_CLIENT_SECRET', 'NODE_EXTRA_CA_CERTS', 'OIDC_ISSUER']);
    expect(hub).not.toMatch(/--env-file|--entrypoint/);
    expect(hub.trim()).toMatch(/"\$HUB_IMAGE" > \/dev\/null$/);
  });

  it("hands cs-tracker its four variables over the boot baseline every production run needs, and runs the image as built", () => {
    const cs = runOf('provider-swap-cs-tracker');
    expect(envNames(cs)).toEqual(['CS_TRACKER_OIDC_CLIENT_ID', 'CS_TRACKER_OIDC_CLIENT_SECRET', 'CS_TRACKER_OIDC_OWNER_SUB', 'OIDC_ISSUER']);
    expect(printedNames('"$W/cs-tracker.env"')).toEqual(['DATABASE_URL', 'PHX_HOST', 'SECRET_KEY_BASE', 'STEAM_ID']);
    expect(cs).not.toContain('--entrypoint');
    expect(cs.trim()).toMatch(/"\$CS_TRACKER_IMAGE" > \/dev\/null$/);
  });

  it("hands forward-auth only the names its compose service interpolates, and adds only the authority's trust", () => {
    expect(printedNames('"$W/forward-auth.env"')).toEqual([
      'OIDC_ISSUER',
      'TRAEFIK_FORWARD_AUTH_COOKIE_SECRET',
      'TRAEFIK_OIDC_CLIENT_ID',
      'TRAEFIK_OIDC_CLIENT_SECRET',
      'TRAEFIK_OIDC_OWNER_EMAIL',
    ]);
    const override = commands.find((c) => c.includes('"$W/override.yml"')) ?? '';
    expect([...override.matchAll(/'(\s*[a-z_-]+:[^']*)'/g)].map((m) => m[1].trim())).toEqual([
      'services:',
      'ingress:',
      'forward-auth:',
    ]);
    expect(override).toContain("volumes: ['$W/tls/ca.pem:/etc/ssl/certs/ca-certificates.crt:ro']");
    expect(override).toContain('env_file: !override [$W/forward-auth.env]');
  });

  it('names each client by its id, as AD-3 derives it', () => {
    expect(script).toMatch(/^HUB_CLIENT=cuatro-portfolio; CS_CLIENT=cs-tracker; FA_CLIENT=traefik$/m);
  });
});
