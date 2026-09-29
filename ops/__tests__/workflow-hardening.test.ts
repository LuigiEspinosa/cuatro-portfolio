// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// DW-87, Operator ruling 2026-09-24. Every workflow narrows its `GITHUB_TOKEN` to `contents: read` at the
// top, since the repository's own default is `write`, and a job widens only what it needs; every action
// outside GitHub's own is pinned to a full commit sha with the tag it was read from in a comment, so a
// moved tag cannot change the code a job runs. GitHub's own actions stay on tags. The rules are held over
// the whole directory rather than over the files by name, so a new workflow inherits them, as the fifth,
// `image.yml` (Story 3-3), did.

const DIRECTORY = resolve(process.cwd(), '.github/workflows');
const FILES = readdirSync(DIRECTORY)
  .filter((name) => /\.ya?ml$/.test(name))
  .sort();

// CRLF normalised (`.gitattributes` names no `.yml`), and comments dropped, since they discuss the keys.
const instructionsOf = (text: string): string =>
  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
const read = (name: string): string => instructionsOf(readFileSync(join(DIRECTORY, name), 'utf8'));

/**
 * Every `permissions:` key, top-level (column 0) or not (a job's), with its entries: the `scope: level`
 * lines beneath it, or its inline value (`write-all`, `{ contents: write }`) as the one entry.
 */
const permissionBlocks = (text: string, where: 'top' | 'job'): string[][] => {
  const lines = text.split('\n');
  return lines.flatMap((line, at) => {
    const key = /^(\s*)permissions\s*:\s*(.*)$/.exec(line);
    if (!key || (key[1] === '') !== (where === 'top')) return [];
    if (key[2] !== '') return [[key[2]]];
    const entries: string[] = [];
    for (const next of lines.slice(at + 1)) {
      if (next.trim() === '' || next.search(/\S/) <= key[1].length) break;
      entries.push(next.trim());
    }
    return [entries];
  });
};

// GitHub's own actions stay on tags by the ruling, and a local action (`./...`) is this repository's code.
const EXEMPT = /^(actions\/|github\/|\.\/)/;

/** Every `uses:` outside the exempt set that is not `@<40 hex> # vX.Y.Z`. */
const unpinned = (text: string): string[] =>
  [...text.matchAll(/^\s*(?:- )?uses: (\S+)(.*)$/gm)]
    .filter(([, ref, rest]) => !EXEMPT.test(ref) && !(/@[0-9a-f]{40}$/.test(ref) && /^ # v\d+\.\d+\.\d+$/.test(rest)))
    .map(([, ref]) => ref);

// Story 3-1 pinned Node 24 LTS, the stack's runtime, in `ci.yml` and `lighthouse.yml`, the two workflows its
// criterion names. Two more copied Node 22 after the story was written and keep it until their owners move
// them (DW-251). When one moves, delete its entry here and close its half of DW-251. DW-251's third place,
// the image, moved in Story 3-3 and is held below: `apps/hub/Dockerfile` builds and runs on the same major.
// `deploy.yml` moved in Story 3-4, which rewrote the deploy.
const STACK_NODE = '24';
const STILL_ON_NODE_22: Record<string, string> = {
  'registry-verification.yml': 'no story yet',
};

const DOCKERFILE = resolve(process.cwd(), 'apps/hub/Dockerfile');
// Story 3-5: the finance application's image, held to the same major.
const FINANCE_DOCKERFILE = resolve(process.cwd(), 'apps/finance/Dockerfile');
/** The tag of every `FROM node:<tag>` stage, so a stage on another major than CI tests on is named. */
const nodeBases = (text: string): string[] =>
  [...text.matchAll(/^FROM\s+(?:--\S+\s+)*node:(\S+)/gim)].map(([, tag]) => tag);
const majorOf = (tag: string): string => tag.split(/[.@-]/)[0];

const setupNodeSteps = (text: string): number =>
  (text.match(/^\s*(?:- )?uses: actions\/setup-node@/gm) ?? []).length;
const nodeVersions = (text: string): string[] =>
  [...text.matchAll(/^\s+node-version:\s*([^\s#]+)\s*(?:#.*)?$/gm)].map(([, version]) => version);

// DW-252 (Story 3-2). At a workspace root whose manifest has no `test` script, `pnpm test --run` prints
// nothing and exits 0, so a unit gate invoked that way passes having run nothing. Every `pnpm <script>` a
// workflow runs must name a script in the manifest it runs against: the root's, or that of the workspace
// `--filter` names. `install` is pnpm's own command, not a script.
type Manifest = { name?: string; scripts?: Record<string, string> };
const manifestAt = (path: string): Manifest => JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
const ROOT_MANIFEST = manifestAt('package.json');
// The two globs `pnpm-workspace.yaml` declares. A workspace outside them fails its filter as unknown.
const WORKSPACES = new Map(
  ['apps', 'packages'].flatMap((parent) =>
    readdirSync(resolve(process.cwd(), parent), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(resolve(process.cwd(), parent, entry.name, 'package.json')))
      .map((entry) => manifestAt(`${parent}/${entry.name}/package.json`))
      .map((manifest) => [manifest.name ?? '', manifest] as const)
  )
);

/** Every `pnpm [--filter <name>] <script>` on one line, as `//#<script>` at the root or `<name>#<script>`. */
const pnpmSteps = (text: string): string[] =>
  [...text.matchAll(/\bpnpm(?:[ \t]+--filter[ \t=]+(\S+))?[ \t]+([\w:-]+)/g)]
    .filter(([, , script]) => script !== 'install')
    .map(([, filter, script]) => `${filter ?? '//'}#${script}`);

/** The steps whose script the manifest they run against does not define. */
const unresolved = (steps: string[], root: Manifest, workspaces: Map<string, Manifest>): string[] =>
  steps.filter((step) => {
    const [owner, script] = step.split('#');
    return (owner === '//' ? root : workspaces.get(owner))?.scripts?.[script] === undefined;
  });

describe('every workflow', () => {
  it('reads at least the five workflows this repository carries', () => {
    expect(FILES).toEqual(
      expect.arrayContaining(['ci.yml', 'deploy.yml', 'image.yml', 'lighthouse.yml', 'registry-verification.yml'])
    );
  });

  it.each(FILES)('%s narrows the token to contents: read at the top', (name) => {
    expect(permissionBlocks(read(name), 'top')).toEqual([['contents: read']]);
  });

  // Story 3-4: the deploy builds its own image by calling `image.yml`, so the push's `packages: write` is
  // granted twice, once to the Image workflow's job and once to the deploy's job that calls it, and the
  // failure report moved into a job of its own. Story 3-5 adds the finance image's push, in its own workflow.
  it("widens the token for four jobs only: the Hub image's push, alone and called by the deploy, the deploy's failure report, and the finance image's push", () => {
    const widened = FILES.flatMap((name) => permissionBlocks(read(name), 'job').map((entries) => ({ name, entries })));
    expect(widened).toEqual([
      { name: 'deploy.yml', entries: ['contents: read', 'packages: write'] },
      { name: 'deploy.yml', entries: ['contents: read', 'issues: write'] },
      { name: 'image-finance.yml', entries: ['contents: read', 'packages: write'] },
      { name: 'image.yml', entries: ['contents: read', 'packages: write'] },
    ]);
  });

  it.each(FILES)('%s pins every third-party action to a commit, with its tag in a comment', (name) => {
    expect(unpinned(read(name))).toEqual([]);
  });

  it('pins each third-party action to one commit across the directory', () => {
    const pins = new Map<string, Set<string>>();
    for (const name of FILES) {
      for (const [, action, sha] of read(name).matchAll(/^\s*(?:- )?uses: ([^@\s]+)@([0-9a-f]{40})\b/gm)) {
        pins.set(action, (pins.get(action) ?? new Set()).add(sha));
      }
    }
    expect(pins.size, 'no third-party action is pinned anywhere').toBeGreaterThan(0);
    for (const [action, found] of pins) expect([...found], action).toHaveLength(1);
  });

  it.each(FILES)('%s pins every setup-node step to Node 24, or to the Node 22 DW-251 defers', (name) => {
    const text = read(name);
    const versions = nodeVersions(text);
    expect(versions, `${name} has a setup-node step with no node-version, which runs the runner's Node`).toHaveLength(
      setupNodeSteps(text)
    );
    const owner = STILL_ON_NODE_22[name];
    const expected = owner === undefined ? STACK_NODE : '22';
    expect(
      versions.filter((version) => version !== expected),
      owner === undefined
        ? `${name} pins a Node other than the stack's ${STACK_NODE}`
        : `${name} left Node 22 (owner: ${owner}). Delete its STILL_ON_NODE_22 entry and close its half of DW-251`
    ).toEqual([]);
  });

  it('finds a Node pin in both workflows the story names, so an empty read cannot pass', () => {
    for (const name of ['ci.yml', 'lighthouse.yml']) expect(nodeVersions(read(name)), name).toContain(STACK_NODE);
  });

  it(`builds and runs the Hub image on Node ${STACK_NODE} in every stage, the major CI tests on (DW-251)`, () => {
    const tags = nodeBases(readFileSync(DOCKERFILE, 'utf8'));
    expect(tags.length, 'apps/hub/Dockerfile has no node stage, so the check below would pass over nothing').toBeGreaterThan(0);
    expect(
      tags.filter((tag) => majorOf(tag) !== STACK_NODE),
      `apps/hub/Dockerfile stages on a Node other than the ${STACK_NODE} every workflow tests on: CI would pass a build that production runs on another major`
    ).toEqual([]);
  });

  it.each(FILES)('%s runs only pnpm scripts the manifest it runs against defines (DW-252)', (name) => {
    expect(unresolved(pnpmSteps(read(name)), ROOT_MANIFEST, WORKSPACES)).toEqual([]);
  });

  it(`builds and runs the finance image on Node ${STACK_NODE} in every stage (Story 3-5)`, () => {
    const tags = nodeBases(readFileSync(FINANCE_DOCKERFILE, 'utf8'));
    expect(tags.length, 'apps/finance/Dockerfile has no node stage').toBeGreaterThan(0);
    expect(tags.filter((tag) => majorOf(tag) !== STACK_NODE)).toEqual([]);
  });

  it('finds the unit gate and the Hub build it reads, so an empty read cannot pass', () => {
    expect(pnpmSteps(read('ci.yml'))).toEqual(
      expect.arrayContaining(['//#typecheck', '//#test', 'finance#typecheck', 'finance#test'])
    );
    expect(pnpmSteps(read('lighthouse.yml'))).toEqual(expect.arrayContaining(['hub#build', 'hub#start']));
  });
});

// The readers above decide every case, so each is shown refusing a planted file as well as passing the
// real ones; a reader that returned nothing would otherwise read as a clean directory.
describe('the readers, on planted text', () => {
  it('finds no top-level block in a workflow that declares none, and does not mistake a job block for one', () => {
    const planted = ['on: push', '', 'jobs:', '  build:', '    permissions:', '      contents: write', ''].join('\n');
    expect(permissionBlocks(planted, 'top')).toEqual([]);
    expect(permissionBlocks(planted, 'job')).toEqual([['contents: write']]);
  });

  it('reads an inline value as the entry, so write-all cannot pass as no block at all', () => {
    const planted = ['permissions: read-all', '', 'jobs:', '  build:', '    permissions: write-all', ''].join('\n');
    expect(permissionBlocks(planted, 'top')).toEqual([['read-all']]);
    expect(permissionBlocks(planted, 'job')).toEqual([['write-all']]);
  });

  it('refuses a third-party action on a tag or without its tag comment, and passes GitHub and local actions', () => {
    const planted = [
      '      - uses: actions/checkout@v7',
      '      - uses: ./.github/actions/local',
      '      - uses: appleboy/ssh-action@v1',
      '        uses: pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86',
      '      - uses: pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86 # v6.0.10',
    ].join('\n');
    expect(unpinned(planted)).toEqual([
      'appleboy/ssh-action@v1',
      'pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86',
    ]);
  });

  it('counts a setup-node step that names no node-version, so it cannot pass as pinned', () => {
    const planted = [
      '      - uses: actions/setup-node@v7',
      '        with:',
      '          node-version: 24',
      '      - uses: actions/setup-node@v7',
      '        with:',
      '          package-manager-cache: false',
      '      - uses: actions/setup-node@v7',
      '        with:',
      '          node-version: 22 # a trailing comment still names the version',
    ].join('\n');
    expect(setupNodeSteps(planted)).toBe(3);
    expect(nodeVersions(planted)).toEqual(['24', '22']);
  });

  it('reads the Node major of every image stage, a digest or a variant included', () => {
    const planted = [
      'FROM node:24-slim AS prune',
      'from node:22.9.0 AS deps',
      'FROM --platform=linux/amd64 node:22-slim AS builder',
      'FROM node:24@sha256:abc AS runner',
      'FROM debian AS other',
    ].join('\n');
    expect(nodeBases(planted).map(majorOf)).toEqual(['24', '22', '22', '24']);
  });

  it('reads a pnpm step with its filter, skips install, and refuses a script its manifest lacks', () => {
    const planted = [
      '        run: pnpm install --frozen-lockfile',
      '        run: pnpm test --run',
      '        run: pnpm --filter hub build',
      '          cache: pnpm',
      '      - uses: pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86 # v6.0.10',
    ].join('\n');
    expect(pnpmSteps(planted)).toEqual(['//#test', 'hub#build']);
    // The DW-252 shape, a root with no `test`, beside a filter to a workspace without the script and a
    // filter naming no workspace.
    const workspaces = new Map<string, Manifest>([['hub', { scripts: { build: 'next build' } }]]);
    expect(unresolved(['//#test', 'hub#test', 'nobody#build', 'hub#build'], { scripts: {} }, workspaces)).toEqual([
      '//#test',
      'hub#test',
      'nobody#build',
    ]);
  });
});
