// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// DW-87, Operator ruling 2026-09-24. Every workflow narrows its `GITHUB_TOKEN` to `contents: read` at the
// top, since the repository's own default is `write`, and a job widens only what it needs; every action
// outside GitHub's own is pinned to a full commit sha with the tag it was read from in a comment, so a
// moved tag cannot change the code a job runs. GitHub's own actions stay on tags. The rules are held over
// the whole directory rather than over the four files by name, so a fifth workflow inherits them.

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

describe('every workflow', () => {
  it('reads at least the four workflows this repository carries', () => {
    expect(FILES).toEqual(
      expect.arrayContaining(['ci.yml', 'deploy.yml', 'lighthouse.yml', 'registry-verification.yml'])
    );
  });

  it.each(FILES)('%s narrows the token to contents: read at the top', (name) => {
    expect(permissionBlocks(read(name), 'top')).toEqual([['contents: read']]);
  });

  it('widens the token for one job only, the deploy, by issues: write for its failure report', () => {
    const widened = FILES.flatMap((name) => permissionBlocks(read(name), 'job').map((entries) => ({ name, entries })));
    expect(widened).toEqual([{ name: 'deploy.yml', entries: ['contents: read', 'issues: write'] }]);
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
});

// The two readers above decide every case, so each is shown refusing a planted file as well as passing
// the real ones; a reader that returned nothing would otherwise read as a clean directory.
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
});
