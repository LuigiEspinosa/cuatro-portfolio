// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// `.github/workflows/image.yml` builds the Hub's image from `apps/hub/Dockerfile` on every push and pushes
// it to GHCR (AD-8, Story 3-3), and Story 3-4 deploys by pulling it. Three of its properties would
// regress silently, since the run stays green through each, so they are held here:
//
// - Its trigger: a push to any branch but `main`, `dev` included, and a call. A push to `main` builds
//   through `.github/workflows/deploy.yml`, whose `image` job calls this workflow before the deploy job
//   that needs it (Story 3-4), so no push to `main` builds its image twice, and it is built before the
//   box pulls it.
// - Its tag, `ghcr.io/luigiespinosa/hub` and the commit sha, the one tag it ever pushes. No estate
//   application runs a floating tag (AD-3).
// - Its two Umami build inputs. Next inlines `NEXT_PUBLIC_*` at build time, and an image built without
//   either serves a working site that measures nothing (`apps/hub/app/layout.tsx`).
//
// Read as `ops/__tests__/workflow-hardening.test.ts` reads workflows: CRLF normalised (`.gitattributes`
// names no `.yml`) and comments dropped, since they discuss the keys; a `run:` line continued with a
// backslash is joined, so a command reads as the shell runs it.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const WORKFLOW = join(REPO_ROOT, '.github', 'workflows', 'image.yml');

const IMAGE = 'ghcr.io/luigiespinosa/hub:${{ github.sha }}';
const TRIGGER = "on:\n  push:\n    branches: ['**', '!main']\n  workflow_call:";
const UMAMI_INPUTS = ['NEXT_PUBLIC_UMAMI_WEBSITE_ID', 'NEXT_PUBLIC_UMAMI_URL'] as const;
/** What each input must look like: a website id is a UUID, and the tracker is served over HTTPS. */
const UMAMI_SHAPES: Record<(typeof UMAMI_INPUTS)[number], RegExp> = {
  NEXT_PUBLIC_UMAMI_WEBSITE_ID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  NEXT_PUBLIC_UMAMI_URL: /^https:\/\/\S+[^/]$/,
};

const instructionsOf = (text: string): string =>
  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n')
    .replace(/\\\n\s*/g, ' ');

/** The `on:` block, its key and every indented line under it. */
const triggerOf = (text: string): string => /^on:\n(?:[ \t]+\S.*\n?)*/m.exec(text)?.[0].trimEnd() ?? '';

/** Why the workflow could push something other than the one sha tag, empty when it cannot. */
const tagFaults = (text: string): string[] => {
  const faults: string[] = [];
  // A reference runs to the first space, quote or `$`, then takes one whole `${{ ... }}` expression.
  const references = [...text.matchAll(/ghcr\.io\/[^\s"'$]+(?:\$\{\{[^}]*\}\})?/g)].map(([reference]) => reference);
  const image = /^[ \t]+IMAGE:[ \t]*(.+?)[ \t]*$/m.exec(text)?.[1];
  if (image !== IMAGE) faults.push(`IMAGE is ${image ?? 'unset'}, not ${IMAGE}`);
  for (const reference of references) if (reference !== IMAGE) faults.push(`names ${reference}`);
  const pushes = [...text.matchAll(/\bdocker (?:image )?push\b[^\n]*/g)].map(([command]) => command.trim());
  if (pushes.length === 0) faults.push('pushes nothing');
  for (const push of pushes) if (push !== 'docker push "$IMAGE"') faults.push(`pushes otherwise: ${push}`);
  if (/\bdocker (?:image )?tag\b/.test(text)) faults.push('retags the image');
  return faults;
};

/** Why the build could lose either Umami input, empty when it cannot. */
const umamiFaults = (text: string): string[] => {
  const builds = [...text.matchAll(/\bdocker build\b[^\n]*/g)].map(([command]) => command);
  if (builds.length === 0) return ['builds nothing'];
  return UMAMI_INPUTS.flatMap((name) => {
    const faults: string[] = [];
    const value = new RegExp(String.raw`^[ \t]+${name}:[ \t]*(.*?)[ \t]*$`, 'm').exec(text)?.[1] ?? '';
    if (!UMAMI_SHAPES[name].test(value)) {
      faults.push(
        `${name} is "${value}", not a literal value of its shape. It is set in the workflow on purpose (Story 3-3 ` +
          `Decision 2); moving it to a variable is an Operator ruling that edits this case with it`
      );
    }
    for (const build of builds) {
      if (!new RegExp(String.raw`--build-arg ${name}(?=\s|$)`).test(build)) faults.push(`${name} is not passed to: ${build}`);
    }
    return faults;
  });
};

const workflow = instructionsOf(readFileSync(WORKFLOW, 'utf8'));

describe('the image workflow', () => {
  it('runs on a push to every branch but main, and when the deploy calls it', () => {
    expect(triggerOf(workflow)).toBe(TRIGGER);
  });

  it('pushes the Hub image by its commit sha and by nothing else (AD-3, AD-8)', () => {
    expect(tagFaults(workflow)).toEqual([]);
  });

  it('builds with both Umami inputs set, so the image measures what the site serves', () => {
    expect(umamiFaults(workflow)).toEqual([]);
  });

  it('names a changed trigger, a floating tag and a second push', () => {
    for (const planted of [
      workflow.replace("branches: ['**', '!main']", 'branches: [main]'),
      workflow.replace("branches: ['**', '!main']", "branches: ['**']"),
      workflow.replace('  workflow_call:\n', ''),
    ]) {
      expect(planted).not.toBe(workflow);
      expect(triggerOf(planted)).not.toBe(TRIGGER);
    }
    expect(tagFaults(workflow.replace(IMAGE, 'ghcr.io/luigiespinosa/hub:latest'))).toEqual(
      expect.arrayContaining([expect.stringContaining('IMAGE is ghcr.io/luigiespinosa/hub:latest')])
    );
    expect(tagFaults(`${workflow}\n        run: docker push ghcr.io/luigiespinosa/hub:latest`)).toEqual([
      'names ghcr.io/luigiespinosa/hub:latest',
      'pushes otherwise: docker push ghcr.io/luigiespinosa/hub:latest',
    ]);
    expect(tagFaults(`${workflow}\n        run: docker tag "$IMAGE" hub:latest`)).toEqual(['retags the image']);
    expect(tagFaults(`${workflow}\n        run: docker image push "$LATEST"`)).toEqual([
      'pushes otherwise: docker image push "$LATEST"',
    ]);
  });

  it('names an input emptied, handed to a variable, or left off the build', () => {
    const emptied = workflow.replace(/^(\s+NEXT_PUBLIC_UMAMI_WEBSITE_ID:).*$/m, "$1 ''");
    expect(umamiFaults(emptied)).toEqual([expect.stringContaining('NEXT_PUBLIC_UMAMI_WEBSITE_ID is "\'\'"')]);
    const variable = workflow.replace(/^(\s+NEXT_PUBLIC_UMAMI_URL:).*$/m, '$1 ${{ vars.NEXT_PUBLIC_UMAMI_URL }}');
    expect(umamiFaults(variable)).toEqual([expect.stringContaining('NEXT_PUBLIC_UMAMI_URL is "${{ vars.')]);
    const dropped = workflow.replace('--build-arg NEXT_PUBLIC_UMAMI_URL', '');
    expect(umamiFaults(dropped)).toEqual([expect.stringContaining('NEXT_PUBLIC_UMAMI_URL is not passed to')]);
  });
});
