// The parsers over `ops/contract-adoption.md`, Story 1-20's record.
//
// The record states the published contract version, the version every estate
// application has adopted, the automation policy over the eleven repositories
// `ops/estate.md` names, and the propagation counter Epic 6 reads. Each is a
// statement about something else in this repository or in the estate, and a
// statement nobody checks drifts. These functions read the record's tables so
// two readers can hold it to the tree: `ops/__tests__/contract-adoption.test.ts`
// under the blocking `test` job, and `ops/cs-tracker-adoption-probe.mjs`, the
// hand-run drift detector, which holds the `cs-tracker` row to the header of
// the vendored `tokens.css`.
//
// Pure, apart from the two functions that look for configuration files under a
// root, which take the root as an argument so a test can plant one.
//
// The table shapes are part of the record's contract: keep its header rows as
// they are. A waypoint change in `ops/estate.md` moves the estate sentence,
// `ESTATE_COUNT` and both of the record's tables together.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Where the record lives, relative to the repository root. */
export const RECORD_REL = 'ops/contract-adoption.md';

/** The eleven repositories, pinned, so the estate parse has something to disagree with. */
export const ESTATE_COUNT = 11;

/** The sentence in `ops/estate.md` the estate names are read out of. */
export const ESTATE_SENTENCE = 'The 11 repositories at this waypoint are';

/** AD-14's fixed folder name, and the one file the Epic 2 drift check reads out of it. */
export const VENDORED_TOKENS = 'cuatro-contracts/tokens.css';
export const CS_TRACKER_TOKENS = 'assets/css/cuatro-contracts/tokens.css';

/** The Anchor is the publisher and vendors nothing: it loads this file in place (AD-1, AD-4). */
export const ANCHOR = 'cuatro-portfolio';
export const ANCHOR_TOKENS = 'contracts/tokens.css';

/**
 * Every location Dependabot and Renovate read a configuration from, as their
 * documentation lists them, plus the `renovate` key in `package.json`, which
 * is named `package.json#renovate` wherever a path is expected.
 */
export const AUTOMATION_CONFIGS = [
  '.github/dependabot.yml',
  '.github/dependabot.yaml',
  'renovate.json',
  'renovate.json5',
  'renovate.jsonc',
  '.github/renovate.json',
  '.github/renovate.json5',
  '.github/renovate.jsonc',
  '.renovaterc',
  '.renovaterc.json',
  '.renovaterc.json5',
  '.renovaterc.jsonc',
  '.gitlab/renovate.json',
  '.gitlab/renovate.json5',
  '.gitlab/renovate.jsonc',
];
export const PACKAGE_JSON_KEY = 'package.json#renovate';

export const SEMVER = /^\d+\.\d+\.\d+$/;
export const HEADER_PATTERN = /Contract v(\d+\.\d+\.\d+)/;

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

/**
 * The markdown with every fenced code block removed, so a quoted transcript's
 * `## ` heading, `|` row or `Propagation count:` line is never read as the
 * record's own structure. The record quotes its rehearsal verbatim.
 */
export function withoutFences(markdown) {
  return String(markdown ?? '').replace(/^[ \t]*```[^\n]*\n[\s\S]*?\n[ \t]*```[ \t]*$/gm, '');
}

/**
 * The text of one `## heading` section, up to the next `## `, fenced blocks
 * removed. Throws when the heading is absent, and when it appears more than
 * once, so a second table under a repeated heading is never left unread.
 */
export function section(markdown, heading) {
  const lines = withoutFences(markdown).split('\n');
  const starts = lines.map((line, i) => (line.trim() === `## ${heading}` ? i : -1)).filter((i) => i !== -1);
  if (starts.length === 0) throw new Error(`the record carries no "## ${heading}" section`);
  if (starts.length > 1) {
    throw new Error(`the record carries ${starts.length} "## ${heading}" sections, so which is current is not stated`);
  }
  const start = starts[0];
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join('\n');
}

/** The cells of one pipe-table row. A `\|` is a literal pipe inside a cell, as Markdown has it, not a boundary. */
export function cells(line) {
  return String(line)
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replace(/\\\|/g, '|').trim());
}

/**
 * The first pipe table whose header row begins with `firstHeader`. Throws when
 * there is none. The separator row may carry alignment colons (`|:---|`), as
 * a formatter writes them, so a cosmetic edit cannot hide a table.
 */
export function table(text, firstHeader) {
  const lines = String(text ?? '').split('\n');
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (!lines[i].trim().startsWith('|')) continue;
    const headers = cells(lines[i]);
    if (headers[0] !== firstHeader) continue;
    if (!/^\|\s*:?-+/.test(lines[i + 1].trim())) continue;
    const rows = [];
    for (let j = i + 2; j < lines.length; j += 1) {
      if (!lines[j].trim().startsWith('|')) break;
      const row = cells(lines[j]);
      if (row.length !== headers.length) {
        throw new Error(`row ${j - i - 1} of the "${firstHeader}" table has ${row.length} cells, the header has ${headers.length}`);
      }
      rows.push(row);
    }
    return { headers, rows };
  }
  throw new Error(`no table whose header begins with "${firstHeader}" was found`);
}

export const unticked = (cell) => String(cell ?? '').replace(/`/g, '').trim();

// ---------------------------------------------------------------------------
// The versions
// ---------------------------------------------------------------------------

/**
 * The published version line. Throws when there is none, so nothing is compared
 * to nothing, and when there is more than one, so a stale line is never read as
 * the current one in silence.
 */
export function publishedVersion(record) {
  const all = [...withoutFences(record).matchAll(/^Published contract version: \*\*(\d+\.\d+\.\d+)\*\*/gm)];
  if (all.length === 0) throw new Error('the record carries no "Published contract version: **X.Y.Z**" line');
  if (all.length > 1) {
    throw new Error(
      `the record carries ${all.length} "Published contract version" lines (${all.map((m) => m[1]).join(', ')}), so which is current is not stated`
    );
  }
  return all[0][1];
}

/** `Contract vX.Y.Z` out of a header. Throws when there is none, for the same reason. */
export function headerVersion(css) {
  const match = HEADER_PATTERN.exec(String(css ?? ''));
  if (match === null) throw new Error('the stylesheet carries no "Contract vX.Y.Z" header line');
  return match[1];
}

/** Holds the three versions equal, failing naming all three. */
export function assertVersionsAgree({ record, header, manifest }) {
  if (record !== header || record !== manifest) {
    throw new Error(
      `the record says ${record}, the contracts/tokens.css header says Contract v${header}, and ` +
        `packages/tokens/package.json says ${manifest}. All three must be one version`
    );
  }
}

// ---------------------------------------------------------------------------
// The tables
// ---------------------------------------------------------------------------

/** The adopted-versions table, one row per estate application. Throws on zero rows. */
export function adopterRows(record) {
  const parsed = table(section(record, 'The adopted versions'), 'Application');
  const application = parsed.headers.indexOf('Application');
  const path = parsed.headers.indexOf('File read');
  const version = parsed.headers.indexOf('Adopted version');
  if (application === -1 || path === -1 || version === -1) {
    throw new Error(`the adopted-versions table lacks one of Application, File read, Adopted version: ${parsed.headers.join(' | ')}`);
  }
  if (parsed.rows.length === 0) throw new Error('the adopted-versions table has zero rows, so nothing was recorded');
  return parsed.rows.map((row) => ({ application: unticked(row[application]), path: unticked(row[path]), version: unticked(row[version]) }));
}

/** The adopted version the record states for one application, or a throw naming it. */
export function recordedAdoptedVersion(record, application) {
  const row = adopterRows(record).find((r) => r.application === application);
  if (row === undefined) throw new Error(`the record carries no adopted-versions row for ${application}`);
  return row.version;
}

/** The eleven-row policy table. Throws on zero rows. */
export function policyRows(record) {
  const parsed = table(section(record, 'The automation policy'), 'Repository');
  const repository = parsed.headers.indexOf('Repository');
  const testSuite = parsed.headers.findIndex((h) => h.startsWith('Test suite'));
  const automation = parsed.headers.findIndex((h) => h.startsWith('Dependency automation'));
  const requiredCheck = parsed.headers.findIndex((h) => h.startsWith('Required check'));
  if (repository === -1 || testSuite === -1 || automation === -1 || requiredCheck === -1) {
    throw new Error(
      `the policy table lacks one of Repository, Test suite, Dependency automation, Required check: ${parsed.headers.join(' | ')}`
    );
  }
  if (parsed.rows.length === 0) throw new Error('the policy table has zero rows, so no repository was observed');
  return parsed.rows.map((row) => ({
    repository: unticked(row[repository]),
    testSuite: row[testSuite],
    automation: row[automation],
    requiredCheck: row[requiredCheck],
  }));
}

/** The eleven names `ops/estate.md` gives at the waypoint. Throws when anything but the pinned count is read: pinned, not bounded. */
export function estateNames(estate) {
  const match = new RegExp(`${ESTATE_SENTENCE} ([\\s\\S]*?)\\.`).exec(String(estate ?? ''));
  if (match === null) throw new Error(`ops/estate.md carries no "${ESTATE_SENTENCE} ..." sentence`);
  const names = [...match[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  if (names.length !== ESTATE_COUNT) {
    throw new Error(`ops/estate.md names ${names.length} repositories at the waypoint, not the ${ESTATE_COUNT} pinned`);
  }
  return names;
}

/** Case-insensitive name order, so a message does not depend on the order `ops/estate.md` happens to list the names in. */
const byName = (a, b) => {
  const [x, y] = [a.toLowerCase(), b.toLowerCase()];
  return x < y ? -1 : x > y ? 1 : 0;
};

/** Holds a list of repository names equal to the estate's, throwing naming every missing and every extra name, in name order. */
export function assertEstateCovered(listed, names) {
  const missing = names.filter((name) => !listed.includes(name)).sort(byName);
  const extra = listed.filter((name) => !names.includes(name)).sort(byName);
  const twice = listed.filter((name, i) => listed.indexOf(name) !== i).sort(byName);
  if (missing.length > 0 || extra.length > 0 || twice.length > 0) {
    throw new Error(
      `the table does not list the estate: missing ${missing.length > 0 ? missing.join(', ') : 'none'}; ` +
        `extra ${extra.length > 0 ? extra.join(', ') : 'none'}; listed twice ${twice.length > 0 ? twice.join(', ') : 'none'}`
    );
  }
}

/**
 * The propagation counter and the number of event rows beneath it. Throws on
 * no count line, and on more than one, so a stale count is never read as the
 * current one in silence, as `publishedVersion` does for its line.
 */
export function ledger(record) {
  const text = section(record, 'The propagation ledger');
  const all = [...text.matchAll(/^Propagation count: \*\*([^*]+)\*\*/gm)];
  if (all.length === 0) throw new Error('the ledger carries no "Propagation count: **N**" line');
  if (all.length > 1) {
    throw new Error(
      `the ledger carries ${all.length} "Propagation count" lines (${all.map((m) => m[1].trim()).join(', ')}), so which is current is not stated`
    );
  }
  const line = all[0];
  if (!/^\d+$/.test(line[1].trim())) throw new Error(`the propagation count "${line[1]}" does not parse as an integer`);
  const events = table(text, '#').rows.length;
  return { count: Number(line[1]), events };
}

// ---------------------------------------------------------------------------
// Dependency automation, both directions
// ---------------------------------------------------------------------------

/** Whether `package.json` under `root` carries a top-level `renovate` key. */
export function renovateKeyInPackageJson(root) {
  const path = join(root, 'package.json');
  if (!existsSync(path)) return false;
  try {
    const json = JSON.parse(readFileSync(path, 'utf8'));
    return json !== null && typeof json === 'object' && Object.prototype.hasOwnProperty.call(json, 'renovate');
  } catch {
    return false;
  }
}

/** Which of the configuration locations exist under `root`, `package.json#renovate` included. */
export function automationConfigsPresent(root) {
  const files = AUTOMATION_CONFIGS.filter((rel) => existsSync(join(root, ...rel.split('/'))));
  return renovateKeyInPackageJson(root) ? [...files, PACKAGE_JSON_KEY] : files;
}

/** The configuration paths a policy cell names, in backticks, that are on the list. */
export function namedConfigs(cell) {
  const known = new Set([...AUTOMATION_CONFIGS, PACKAGE_JSON_KEY]);
  return [...String(cell ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((name) => known.has(name));
}

/**
 * The two-directional guard on the Anchor's automation cell. A cell reading
 * `none` requires no configuration present; any other cell must name, in
 * backticks, at least one location from the list, and the set present must
 * equal the set named. A configuration with no row and a row with no
 * configuration both fail naming the path, so the row and the setting can
 * only land together.
 */
export function anchorAutomationVerdict({ cell, present }) {
  const reasons = [];
  const found = Array.isArray(present) ? present : [];
  if (unticked(cell) === 'none') {
    for (const path of found) reasons.push(`${path} exists in the repository and the Anchor's cell still reads none`);
    return { pass: reasons.length === 0, reasons };
  }
  const named = namedConfigs(cell);
  if (named.length === 0) {
    reasons.push(`the Anchor's cell reads "${String(cell ?? '').trim()}", which is neither none nor a backticked path from the list`);
  }
  for (const path of named) {
    if (!found.includes(path)) reasons.push(`the cell names ${path} and it does not exist in the repository`);
  }
  for (const path of found) {
    if (!named.includes(path)) reasons.push(`${path} exists in the repository and the cell does not name it`);
  }
  return { pass: reasons.length === 0, reasons };
}

/**
 * The hand-run stand-in for step 6's declaration-against-header comparison:
 * the version the record states for an adopter against the `Contract vX.Y.Z`
 * header read out of its vendored `tokens.css`. Fails naming both values;
 * fails rather than passing when either could not be read.
 */
export function recordedVersionVerdict({ recorded, header }) {
  if (typeof recorded !== 'string' || !SEMVER.test(recorded)) {
    return { pass: false, detail: `the record's adopted version read as ${JSON.stringify(recorded)}, not a semver` };
  }
  if (typeof header !== 'string' || !SEMVER.test(header)) {
    return { pass: false, detail: `the vendored header's version read as ${JSON.stringify(header)}, not a semver` };
  }
  return recorded === header
    ? { pass: true, detail: `the record states ${recorded} and the vendored tokens.css header reads Contract v${header}` }
    : { pass: false, detail: `the record states ${recorded} and the vendored tokens.css header reads Contract v${header}; the two must be one version` };
}
