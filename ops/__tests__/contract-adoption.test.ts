// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import {
  ANCHOR,
  ANCHOR_TOKENS,
  AUTOMATION_CONFIGS,
  CS_TRACKER_TOKENS,
  ESTATE_COUNT,
  ESTATE_SENTENCE,
  PACKAGE_JSON_KEY,
  RECORD_REL,
  SEMVER,
  VENDORED_TOKENS,
  adopterRows,
  anchorAutomationVerdict,
  assertEstateCovered,
  assertVersionsAgree,
  automationConfigsPresent,
  cells,
  estateNames,
  headerVersion,
  ledger,
  namedConfigs,
  policyRows,
  publishedVersion,
  recordedAdoptedVersion,
  recordedVersionVerdict,
  renovateKeyInPackageJson,
  section,
  table,
} from '../contract-adoption.mjs';

/**
 * The Story 1-20 record, `ops/contract-adoption.md`, held equal to the tree.
 *
 * The parsers live in `ops/contract-adoption.mjs` so two readers share them:
 * this suite, under the blocking `test` job, and `ops/cs-tracker-adoption-probe.mjs`,
 * the hand-run drift detector, which holds the record's `cs-tracker` row to
 * the header of the vendored `tokens.css`. These cases parse the record off
 * disk and hold it against `contracts/tokens.css`, `packages/tokens/package.json`,
 * `ops/estate.md` and the repository itself.
 *
 * Every parser asserts it read something, every list is pinned rather than
 * bounded, and every matcher is shown firing on a planted control, in the
 * shape `app/__tests__/anchor-contract.test.ts` and
 * `ops/__tests__/cs-tracker-adoption-probe.test.ts` use. The rehearsal in the
 * record shows the first case going red on a `1.0.1` bump.
 *
 * **A waypoint change moves four things together**: the sentence in
 * `ops/estate.md` that `ESTATE_SENTENCE` names, `ESTATE_COUNT` in the module,
 * and both of the record's tables. `ops/estate.md` already schedules the next
 * waypoint at eight repositories; when it lands, all four move in one change.
 */

// Resolved from the repository root, which is where Vitest runs. Same treatment
// as `ops/__tests__/contract-purity.test.ts:31`.
const REPO_ROOT = process.cwd();
const HERE = 'ops/__tests__/contract-adoption.test.ts';

const RECORD = resolve(REPO_ROOT, 'ops/contract-adoption.md');
const TOKENS_CSS = resolve(REPO_ROOT, 'contracts/tokens.css');
const MANIFEST = resolve(REPO_ROOT, 'packages/tokens/package.json');
const ESTATE = resolve(REPO_ROOT, 'ops/estate.md');

const read = (path: string): string => {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(`${HERE}: ${path} could not be read: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const record = read(RECORD);
const tokensCss = read(TOKENS_CSS);
const manifestVersion = (JSON.parse(read(MANIFEST)) as { version: string }).version;
const estate = read(ESTATE);

/** A record fragment carrying every table, in the record's own shape, for the planted controls. */
const fragment = ({
  published = '1.0.0',
  adopters = [
    ['`cuatro-portfolio`', '`contracts/tokens.css`', '1.0.0'],
    ['`cs-tracker`', '`assets/css/cuatro-contracts/tokens.css`', '1.0.0'],
  ],
  policy = [['`cuatro-portfolio`', 'yes', 'none', 'none required']],
  count = '0',
  events = [] as string[][],
}: {
  published?: string | null;
  adopters?: string[][];
  policy?: string[][];
  count?: string;
  events?: string[][];
} = {}): string =>
  [
    '# A record',
    '',
    '## The adopted versions',
    '',
    published === null ? '' : `Published contract version: **${published}**, read off the header.`,
    '',
    '| Application | Consumption route | File read | Header read | Adopted version | Nature and method |',
    '|---|---|---|---|---|---|',
    ...adopters.map(([app, path, version]) => `| ${app} | route | ${path} | header | ${version} | method |`),
    '',
    '## The automation policy',
    '',
    '| Repository | Test suite (files, runner) | CI runs it on push | Required check on the default branch | Dependency automation (config files) | Nature and method |',
    '|---|---|---|---|---|---|',
    ...policy.map(([repo, suite, automation, required]) => `| ${repo} | ${suite} | yes | ${required} | ${automation} | method |`),
    '',
    '## The propagation ledger',
    '',
    `Propagation count: **${count}**`,
    '',
    '| # | Date (UTC) | From | To | Satellites re-vendored | Deprecated names and removal version | Detector run and what it said | Pointer |',
    '|---|---|---|---|---|---|---|---|',
    ...events.map((row) => `| ${row.join(' | ')} |`),
    '',
    '## Stated limits',
    '',
  ].join('\n');

// ---------------------------------------------------------------------------
// Matrix row 1: the record and the header agree
// ---------------------------------------------------------------------------

describe('the record and the header agree', () => {
  it('states the published version, and it equals the Contract vX.Y.Z header and the manifest', () => {
    const published = publishedVersion(record);
    const header = headerVersion(tokensCss);
    expect(published).toMatch(SEMVER);
    expect(() => assertVersionsAgree({ record: published, header, manifest: manifestVersion })).not.toThrow();
    expect(published).toBe(header);
    expect(published).toBe(manifestVersion);
  });

  it('fails naming all three values when they disagree', () => {
    expect(() => assertVersionsAgree({ record: '1.0.0', header: '1.0.1', manifest: '1.0.1' })).toThrow(
      /the record says 1\.0\.0, the contracts\/tokens\.css header says Contract v1\.0\.1, and packages\/tokens\/package\.json says 1\.0\.1/
    );
    expect(() => assertVersionsAgree({ record: '1.0.0', header: '1.0.0', manifest: '1.1.0' })).toThrow(/says 1\.1\.0/);
  });

  it('fails on a record with no published-version line rather than comparing nothing', () => {
    expect(() => publishedVersion(fragment({ published: null }))).toThrow(/no "Published contract version/);
    expect(() => publishedVersion('Published contract version: 1.0.0')).toThrow(/no "Published contract version/);
    expect(publishedVersion(fragment({ published: '1.0.1' }))).toBe('1.0.1');
  });

  it('fails on a record with two published-version lines rather than reading the first in silence', () => {
    const twice = `${fragment()}\nPublished contract version: **1.0.1**, re-observed later.\n`;
    expect(() => publishedVersion(twice)).toThrow(/carries 2 "Published contract version" lines \(1\.0\.0, 1\.0\.1\)/);
  });

  it('fails on a header with no Contract line rather than comparing nothing', () => {
    expect(() => headerVersion(':root { --c-paper: oklch(12% 0.011 288); }')).toThrow(/no "Contract vX\.Y\.Z" header/);
    expect(headerVersion('/* Contract v1.0.1 · dark only */')).toBe('1.0.1');
  });
});

// ---------------------------------------------------------------------------
// Matrix row 2: the adopter row parses
// ---------------------------------------------------------------------------

describe('the adopter rows', () => {
  const rows = adopterRows(record);
  const names = estateNames(estate);

  it('carry cs-tracker at a semver, read off the fixed vendored path', () => {
    const tracker = rows.find((row) => row.application === 'cs-tracker');
    expect(tracker, 'no cs-tracker row').toBeDefined();
    expect(tracker?.version).toMatch(SEMVER);
    expect(tracker?.path).toBe(CS_TRACKER_TOKENS);
    expect(tracker?.path.endsWith(VENDORED_TOKENS)).toBe(true);
    expect(recordedAdoptedVersion(record, 'cs-tracker')).toBe(tracker?.version);
  });

  it('carry the Anchor at the same semver, loading contracts/ in place', () => {
    const anchor = rows.find((row) => row.application === ANCHOR);
    expect(anchor, 'no Anchor row').toBeDefined();
    expect(anchor?.version).toBe(publishedVersion(record));
    expect(anchor?.path).toBe(ANCHOR_TOKENS);
  });

  it('carry one row for every one of the eleven repositories, adopted or not', () => {
    expect(names).toHaveLength(ESTATE_COUNT);
    const listed = rows.map((row) => row.application);
    expect(() => assertEstateCovered(listed, names)).not.toThrow();
    expect(listed).toHaveLength(ESTATE_COUNT);
  });

  it('give every adopter a semver on the fixed path, and every non-adopter "not adopted" with no path', () => {
    for (const row of rows) {
      if (SEMVER.test(row.version)) {
        const fixed = row.path.endsWith(VENDORED_TOKENS) || (row.application === ANCHOR && row.path === ANCHOR_TOKENS);
        expect(fixed, `${row.application} adopted ${row.version} from ${row.path}, which is not the fixed folder`).toBe(true);
      } else {
        expect(row.version, `${row.application}: "${row.version}" is neither a semver nor "not adopted"`).toBe('not adopted');
        expect(row.path, `${row.application} has not adopted and still names a file`).toBe('none');
      }
    }
  });

  it('fails on a table with zero rows, a missing row, a non-semver, or a path off the fixed folder', () => {
    expect(() => adopterRows(fragment({ adopters: [] }))).toThrow(/zero rows/);
    expect(() => adopterRows('# nothing\n\n## Stated limits\n')).toThrow(/no "## The adopted versions" section/);
    expect(() => recordedAdoptedVersion(fragment(), 'digital-library')).toThrow(/no adopted-versions row for digital-library/);

    const planted = adopterRows(fragment({ adopters: [['`cs-tracker`', '`assets/css/tokens.css`', 'v1']] }));
    expect(planted).toHaveLength(1);
    expect(planted[0].version).not.toMatch(SEMVER);
    expect(planted[0].path.endsWith(VENDORED_TOKENS)).toBe(false);
    expect(planted.find((row) => row.application === ANCHOR)).toBeUndefined();
  });

  it('holds the recorded version to the vendored header, failing naming both values', () => {
    // The verdict the hand-run detector uses as step 6's stand-in, pinned here
    // as well as in the detector's own suite.
    expect(recordedVersionVerdict({ recorded: '1.0.0', header: '1.0.0' }).pass).toBe(true);
    const drifted = recordedVersionVerdict({ recorded: '1.0.0', header: '1.0.1' });
    expect(drifted.pass).toBe(false);
    expect(drifted.detail).toBe('the record states 1.0.0 and the vendored tokens.css header reads Contract v1.0.1; the two must be one version');
    expect(recordedVersionVerdict({ recorded: 'not adopted', header: '1.0.0' }).pass).toBe(false);
    expect(recordedVersionVerdict({ recorded: '1.0.0', header: undefined as unknown as string }).pass).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Matrix row 3: the policy lists the estate
// ---------------------------------------------------------------------------

describe('the policy table lists the estate', () => {
  const rows = policyRows(record);
  const names = estateNames(estate);

  it('names exactly the eleven repositories ops/estate.md names, no more and no fewer', () => {
    expect(names).toHaveLength(ESTATE_COUNT);
    expect(() => assertEstateCovered(rows.map((row) => row.repository), names)).not.toThrow();
  });

  it('fills the test-suite, required-check and automation columns on every row', () => {
    for (const row of rows) {
      expect(row.testSuite, `${row.repository} has an empty test-suite cell`).not.toBe('');
      expect(row.requiredCheck, `${row.repository} has an empty required-check cell`).not.toBe('');
      expect(row.automation, `${row.repository} has an empty automation cell`).not.toBe('');
    }
  });

  it('refuses an estate parse that yields anything but eleven names before comparing', () => {
    expect(() => estateNames(`${ESTATE_SENTENCE} \`a\`, \`b\` and \`c\`.`)).toThrow(/names 3 repositories at the waypoint, not the 11 pinned/);
    const twelve = `${ESTATE_SENTENCE} ${[...names, 'one-more'].map((name) => `\`${name}\``).join(', ')}.`;
    expect(() => estateNames(twelve)).toThrow(/names 12 repositories at the waypoint, not the 11 pinned/);
    expect(() => estateNames('nothing here')).toThrow(/no "The 11 repositories/);
    expect(estateNames(estate)).toContain('cs-tracker');
    expect(estateNames(estate)).toContain(ANCHOR);
  });

  it('throws naming every missing and every extra name, shown on planted controls', () => {
    const short = policyRows(fragment({ policy: [['`cuatro-portfolio`', 'yes', 'none', 'none required']] })).map((row) => row.repository);
    // Named in name order, not in the order `ops/estate.md` happens to list
    // them, so a reordered sentence there cannot turn this case red.
    expect(() => assertEstateCovered(short, names)).toThrow(/missing cs-tournament, cs-tracker, cuatro-finance, cuatro-tracker, digital-library, list-wheel, MaiCoin, Mutuo, poketracker-go, StreamVault; extra none/);

    const extra = policyRows(fragment({ policy: [['`not-in-the-estate`', 'yes', 'none', 'none required']] })).map((row) => row.repository);
    expect(() => assertEstateCovered([...names, ...extra], names)).toThrow(/missing none; extra not-in-the-estate/);

    expect(() => assertEstateCovered([...names, names[0]], names)).toThrow(/listed twice cuatro-portfolio/);
    expect(() => policyRows(fragment({ policy: [] }))).toThrow(/zero rows/);
  });
});

// ---------------------------------------------------------------------------
// Matrix row 4: the counter equals the ledger
// ---------------------------------------------------------------------------

describe('the propagation counter', () => {
  it('equals the number of event rows, 0 today', () => {
    // The literal is a pin: an event moves the row, the count line and this
    // number in one change, as the record's runbook says.
    const { count, events } = ledger(record);
    expect(count).toBe(events);
    expect(count).toBe(0);
  });

  it('fails naming both when they disagree, and on a count that is not an integer', () => {
    const planted = ledger(fragment({ count: '1', events: [] }));
    expect(planted.count).not.toBe(planted.events);
    expect(planted).toEqual({ count: 1, events: 0 });
    const withEvent = ledger(
      fragment({ count: '1', events: [['1', '2026-09-01', '1.0.0', '1.0.1', '`cs-tracker`', 'none', 'PASS 9 of 9', 'x']] })
    );
    expect(withEvent).toEqual({ count: 1, events: 1 });
    expect(() => ledger(fragment({ count: 'zero' }))).toThrow(/does not parse as an integer/);
    expect(() => ledger('## The propagation ledger\n\nnothing\n')).toThrow(/no "Propagation count/);
  });

  it('refuses a ledger with two count lines rather than reading the first in silence', () => {
    const twice = fragment().replace('Propagation count: **0**\n', 'Propagation count: **0**\n\nPropagation count: **1**\n');
    expect(() => ledger(twice)).toThrow(/carries 2 "Propagation count" lines \(0, 1\)/);
  });

  it('never reads a fenced transcript as structure: a quoted heading, count line, version line or row is not the record\'s own', () => {
    // The record quotes its rehearsal verbatim, dry-run ledger row included.
    const quoted = fragment().replace(
      'Propagation count: **0**\n',
      [
        'Propagation count: **0**',
        '',
        '```',
        '## The rehearsal',
        'Propagation count: **9**',
        'Published contract version: **9.9.9**',
        '| 9 | 2026-08-27 | 1.0.0 | 1.0.1 | `cs-tracker` | none | DRY RUN | quoted |',
        '```',
        '',
      ].join('\n')
    );
    expect(ledger(quoted)).toEqual({ count: 0, events: 0 });
    expect(publishedVersion(quoted)).toBe('1.0.0');
  });
});

// ---------------------------------------------------------------------------
// Matrix row 5: the Anchor row matches the tree, in both directions
// ---------------------------------------------------------------------------

describe('the Anchor row matches the tree', () => {
  const anchor = policyRows(record).find((row) => row.repository === ANCHOR);

  it('holds the cell and the configuration present in the repository equal', () => {
    expect(anchor, 'no Anchor policy row').toBeDefined();
    const verdict = anchorAutomationVerdict({ cell: anchor?.automation ?? '', present: automationConfigsPresent(REPO_ROOT) });
    expect(verdict.reasons).toEqual([]);
    expect(verdict.pass).toBe(true);
    // Today that means none, with none of the sixteen locations present.
    expect(anchor?.automation).toBe('none');
    expect(automationConfigsPresent(REPO_ROOT)).toEqual([]);
    expect(AUTOMATION_CONFIGS).toHaveLength(15);
    expect(PACKAGE_JSON_KEY).toBe('package.json#renovate');
  });

  it('fails a planted configuration with the cell still reading none, naming the path', () => {
    const verdict = anchorAutomationVerdict({ cell: 'none', present: ['renovate.json'] });
    expect(verdict.pass).toBe(false);
    expect(verdict.reasons).toEqual(['renovate.json exists in the repository and the Anchor\'s cell still reads none']);
  });

  it('fails a row naming a configuration that does not exist, naming the path', () => {
    const verdict = anchorAutomationVerdict({ cell: '`renovate.json`, enabled 2026-09-01', present: [] });
    expect(verdict.pass).toBe(false);
    expect(verdict.reasons).toEqual(['the cell names renovate.json and it does not exist in the repository']);
  });

  it('passes a row and a configuration that name the same set, and fails a set that differs either way', () => {
    expect(anchorAutomationVerdict({ cell: '`renovate.json`, enabled 2026-09-01', present: ['renovate.json'] }).pass).toBe(true);
    expect(
      anchorAutomationVerdict({ cell: '`renovate.json` and `package.json#renovate`', present: ['renovate.json', 'package.json#renovate'] }).pass
    ).toBe(true);
    const extra = anchorAutomationVerdict({ cell: '`renovate.json`', present: ['renovate.json', '.github/dependabot.yml'] });
    expect(extra.pass).toBe(false);
    expect(extra.reasons).toEqual(['.github/dependabot.yml exists in the repository and the cell does not name it']);
    const neither = anchorAutomationVerdict({ cell: 'yes, enabled', present: ['renovate.json'] });
    expect(neither.pass).toBe(false);
    expect(neither.reasons[0]).toMatch(/neither none nor a backticked path/);
    expect(namedConfigs('`renovate.json` and `README.md`')).toEqual(['renovate.json']);
  });

  it('reports every planted configuration location by name, the package.json key included', () => {
    const root = mkdtempSync(join(tmpdir(), 'cuatro-contract-adoption-'));
    try {
      writeFileSync(join(root, 'renovate.json'), '{}');
      mkdirSync(dirname(join(root, '.github', 'dependabot.yaml')), { recursive: true });
      writeFileSync(join(root, '.github', 'dependabot.yaml'), 'version: 2\n');
      mkdirSync(join(root, '.gitlab'), { recursive: true });
      writeFileSync(join(root, '.gitlab', 'renovate.jsonc'), '{}');
      writeFileSync(join(root, '.renovaterc.json5'), '{}');
      writeFileSync(join(root, 'package.json'), '{ "name": "x", "renovate": { "extends": [] } }');
      expect(automationConfigsPresent(root)).toEqual([
        '.github/dependabot.yaml',
        'renovate.json',
        '.renovaterc.json5',
        '.gitlab/renovate.jsonc',
        'package.json#renovate',
      ]);
      expect(renovateKeyInPackageJson(root)).toBe(true);
      writeFileSync(join(root, 'package.json'), '{ "name": "x" }');
      expect(renovateKeyInPackageJson(root)).toBe(false);
      expect(automationConfigsPresent(root)).not.toContain('package.json#renovate');
      writeFileSync(join(root, 'package.json'), 'not json');
      expect(renovateKeyInPackageJson(root)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// The markdown parsers the five rows rest on, each shown on a planted control
// ---------------------------------------------------------------------------

describe('the markdown parsers', () => {
  it('reads an escaped pipe as a literal inside a cell, never as a boundary', () => {
    expect(cells('| a | run: cat log \\|\\| true | c |')).toEqual(['a', 'run: cat log || true', 'c']);
    expect(cells('| a | b |')).toEqual(['a', 'b']);
    // The real record leans on it: the cuatro-tracker policy row quotes a
    // `\|\| true`, and a split at it would throw the cell-count error below.
    expect(record).toContain('\\|\\| true');
    expect(policyRows(record)).toHaveLength(ESTATE_COUNT);
  });

  it('fails a row whose cell count differs from the header, naming the row', () => {
    expect(() => table('| A | B |\n|---|---|\n| 1 | 2 |\n| 3 |\n', 'A')).toThrow(/row 2 of the "A" table has 1 cells, the header has 2/);
    expect(table('| A | B |\n|---|---|\n| 1 | 2 |\n', 'A').rows).toEqual([['1', '2']]);
  });

  it('accepts a separator row carrying alignment colons, so a formatter cannot hide a table', () => {
    expect(table('| A | B |\n|:---|---:|\n| 1 | 2 |\n', 'A').rows).toEqual([['1', '2']]);
    expect(table('| A | B |\n| :--- | :---: |\n| 1 | 2 |\n', 'A').rows).toEqual([['1', '2']]);
    expect(() => table('| A | B |\n| 1 | 2 |\n', 'A')).toThrow(/no table whose header begins with "A"/);
  });

  it('refuses a heading that appears twice rather than reading the first section in silence', () => {
    const twice = `${fragment()}\n## The propagation ledger\n\nPropagation count: **1**\n`;
    expect(() => section(twice, 'The propagation ledger')).toThrow(/carries 2 "## The propagation ledger" sections/);
    expect(() => ledger(twice)).toThrow(/carries 2 "## The propagation ledger" sections/);
    expect(section(fragment(), 'The propagation ledger')).toContain('Propagation count: **0**');
  });
});

// ---------------------------------------------------------------------------
// The policy is stated where it binds
// ---------------------------------------------------------------------------

describe('the policy is stated where it binds', () => {
  it('AGENTS.md carries the dependency automation policy after the managed block, pointing at the record', () => {
    // The record calls this section the place the rule binds, and it sits
    // outside the managed `bmad:context` block so a refresh keeps it. Nothing
    // else would turn red if a refresh or an edit dropped it.
    const agents = read(resolve(REPO_ROOT, 'AGENTS.md'));
    const closing = agents.indexOf('<!-- /bmad:context -->');
    const heading = agents.search(/^## Dependency automation policy\r?$/m);
    expect(closing).toBeGreaterThan(-1);
    expect(heading).toBeGreaterThan(closing);
    const policy = agents.slice(heading);
    expect(policy).toContain('No automated dependency merge is enabled in any estate repository without a real test');
    expect(policy).toContain('required status check on the default branch');
    expect(policy).toContain('None is enabled here');
    expect(policy).toContain(RECORD_REL);
    expect(policy).toContain('ops/__tests__/contract-adoption.test.ts');
  });
});

describe(`${HERE} reads the real files`, () => {
  it('found the record, the contract, the manifest and the estate', () => {
    expect(record.length).toBeGreaterThan(1000);
    expect(tokensCss).toContain(':root');
    expect(manifestVersion).toMatch(SEMVER);
    expect(estate).toContain(ESTATE_SENTENCE);
  });
});
