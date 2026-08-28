// The `cs-tracker` token adoption probe (Story 1-19, FR-18, SM-6).
//
// Epic 1's acceptance condition is a second application, on a different
// framework, rendering from the same published contract. That is a claim about
// what a browser computes, so this file measures it rather than asserting that
// both repositories import the same file.
//
// It compiles `cs-tracker`'s REAL `assets/css/app.css` with `cs-tracker`'s OWN
// pinned Tailwind 4.1.12 binary out of its `_build`, serves the output over
// `node:http` beside the contract's three woff2 faces, renders a fixture page
// carrying the daisyUI class strings `core_components.ex` and `layouts.ex`
// actually emit, and reads computed values in Playwright's Chromium. It then
// loads the Hub's own built stylesheet in the same browser and prints the
// shared roles side by side.
//
// **A reading of daisyUI's or Tailwind's source may explain a result and may
// never stand in for one.** Every verdict below is a computed value. The
// compiled text is read only where the question is about the text: whether a
// retired literal survives, whether a rule declares a `var()` or a literal, and
// how many theme blocks there are.
//
// **Why it compiles rather than running the application.** `mix test` needs a
// Postgres and `mix phx.server` needs the whole stack, and neither renders CSS
// any differently from the compiler. What the acceptance criteria ask for is
// the computed value of a theme variable on a daisyUI component, which is a
// property of the compiled stylesheet plus the markup.
//
// **This is a reproduction tool, not a gate.** Like `ops/daisyui-route-probe.mjs`
// it needs a browser and a checkout of another repository, and neither is on a
// runner, so it is never a CI job (AD-21 is about gates that exist). Its pure
// parts are exported and covered by `ops/__tests__/cs-tracker-adoption-probe.test.ts`
// under the blocking `test` job, so a later edit cannot quietly make it unable
// to fail.
//
// It writes nothing into `cs-tracker`: the compiled output goes to a scratch
// directory under the OS temporary directory, which is removed in a `finally`.
//
// Usage: node ops/cs-tracker-adoption-probe.mjs
//
// Exit codes, because "the mapping stopped resolving" and "no Chromium on this
// host" are different answers:
//
//   0  every named case passed and the scratch tree is gone
//   1  a named case failed, or the scratch tree survived removal
//   2  a defect in this file
//   3  a Block If condition: nothing could be observed at all

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { CS_TRACKER_TOKENS, RECORD_REL, headerVersion, recordedAdoptedVersion, recordedVersionVerdict } from './contract-adoption.mjs';

// Story 1-20's stand-in for step 6 of the change-propagation runbook, re-exported
// so `ops/__tests__/cs-tracker-adoption-probe.test.ts` pins it beside the other
// pure verdicts this file uses.
export { recordedVersionVerdict };

const require_ = createRequire(import.meta.url);

/**
 * This module's own directory.
 *
 * Guarded, because under Vitest `import.meta.url` is a vite URL rather than a
 * `file:` one and `fileURLToPath` throws on it. An unguarded call here would
 * fail at import time and take the whole unit suite with it.
 */
function moduleDir() {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return resolve(process.cwd(), 'ops');
  }
}

export const REPO_ROOT = resolve(moduleDir(), '..');
export const CONTRACTS = join(REPO_ROOT, 'contracts');

/** `cs-tracker`, resolved beside this repository rather than hardcoded. Read only. */
export const CS_TRACKER = resolve(REPO_ROOT, '..', 'cs-tracker-workspace', 'cs-tracker');

/**
 * AD-14's fixed folder name. A scheduled drift check looks here across seven
 * repositories. Derived from the one path the record's `cs-tracker` row must
 * name (`CS_TRACKER_TOKENS` in `ops/contract-adoption.mjs`), so the folder
 * this probe reads and the file the record names cannot drift apart; the
 * sibling suite pins the two equal.
 */
export const VENDORED_REL = join(...dirname(CS_TRACKER_TOKENS).split('/'));

/** Every scratch directory this probe makes starts with this. */
export const SCRATCH_PREFIX = 'cuatro-cs-tracker-adoption-';

/** The pins the finding rests on. A run on anything else answers a different question. */
export const PINNED_TAILWIND = '4.1.12';
export const PINNED_DAISYUI = '5.0.35';

/**
 * daisyUI 5.0.35's own default primary, which is what "the family did not
 * resolve to the Cuatro roles" looks like rendered.
 *
 * **Observed 2026-08-25** by `ops/daisyui-route-probe.mjs`'s `unmapped` control
 * and quoted in `ops/daisyui-route.md` § The observed values. It is hand-copied,
 * so it is used only as the value the components must DIFFER from; every
 * "equal to the token value" claim is measured against a probe element in the
 * same page instead.
 */
export const DAISYUI_DEFAULT_PRIMARY = 'oklch(0.45 0.24 277.023)';

/** The unset background every "nothing painted" failure looks like. */
export const UNPAINTED = 'rgba(0, 0, 0, 0)';

/** Emitted exactly once per Tailwind Preflight, so counting it counts Preflights. */
const PREFLIGHT_MARKER = '-webkit-tap-highlight-color';

/**
 * The commit `cs-tracker` carried Story 7.1's two theme blocks at, and the one
 * this probe reads the retired palette out of.
 *
 * The retired set is DERIVED from that commit rather than transcribed: it is
 * every `oklch()` literal the baseline `app.css` declared, minus every literal
 * the current one still declares. A hand-written list is a list that can be
 * short, and a short list is exactly what a partially retired theme looks like.
 */
export const CS_TRACKER_BASELINE = 'ff7667b';

/**
 * The same set, pinned, so the derivation has something to disagree with.
 *
 * `cs-tracker/test/cs_tracker_web/token_contract_test.exs` carries this list
 * too, because that suite runs with no access to this repository. The probe
 * derives the set from git and fails if the two disagree, which is what keeps
 * the transcription honest in the repository that cannot derive it.
 */
export const RETIRED_LITERALS = [
  'oklch(0% 0 0)',
  'oklch(100% 0 0)',
  'oklch(19.5% 0.008 60)',
  'oklch(20% 0.04 50)',
  'oklch(23% 0.008 60)',
  'oklch(28% 0.01 60)',
  'oklch(28% 0.012 60)',
  'oklch(32% 0.012 60)',
  'oklch(55% 0.027 264.364)',
  'oklch(58% 0.21 25)',
  'oklch(58% 0.233 277.117)',
  'oklch(60% 0.25 292.717)',
  'oklch(62% 0.214 259.815)',
  'oklch(70% 0.14 182.503)',
  'oklch(70% 0.213 47)',
  'oklch(72% 0.2 50)',
  'oklch(91.5% 0.008 70)',
  'oklch(92% 0.008 70)',
  'oklch(94% 0.006 70)',
  'oklch(96.5% 0.006 70)',
  'oklch(96% 0.006 70)',
  'oklch(96% 0.016 293.756)',
  'oklch(96% 0.018 272.314)',
  'oklch(97% 0.014 254.604)',
  'oklch(98% 0.002 247.839)',
  'oklch(99% 0.004 70)',
  'oklch(99% 0.012 47)',
].sort();

export const RETIRED_COUNT = 27;

/** How many files the published contract is, pinned so a narrowed walk fails. */
export const CONTRACT_FILE_COUNT = 9;

/**
 * The markers planted into `cs-tracker` for the two source-scan cases, and the
 * utility selector each one would mint if it were scanned.
 *
 * Every file this probe plants is removed in the `finally`, and the run asserts
 * `git status --porcelain` in `cs-tracker` is byte-identical before and after.
 */
export const SCAN_MARKER = { candidate: 'm-[13px]', selector: String.raw`.m-\[13px\]` };
export const VENDOR_MARKER = { candidate: 'p-[7px]', selector: String.raw`.p-\[7px\]` };

/**
 * How many `--color-*` names the theme block maps onto a contract role, and how
 * many it deliberately leaves on a literal.
 *
 * Pinned rather than bounded, because a floor cannot see a removed mapping: the
 * loop that reads each one back simply gets shorter and stays green. The names
 * themselves are derived from the file.
 */
export const MAPPED_COLOUR_COUNT = 12;
export const UNCOVERED_COLOUR_COUNT = 8;

/** The counts `contracts/tokens.css` publishes at v1.0.0, pinned for the same reason. */
export const ROLE_COUNT = 12;
export const FAMILY_COUNT = 3;
export const SIZE_COUNT = 10;

/** One viewport for both pages, because `--t-display` is a `clamp()` carrying `9vw`. */
export const VIEWPORT = { width: 1280, height: 720 };

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.woff2': 'font/woff2',
  '.js': 'text/javascript; charset=utf-8',
};

/** How long any spawned command is given. Named, because the transcript quotes it. */
const TIMEOUT_MS = 300_000;

/** Thrown for a condition the story's Block If names, never for a defect in this file. */
export class BlockedError extends Error {}

function say(message) {
  process.stdout.write(`${message}\n`);
}

/**
 * Run a command, returning its exit status, both streams, the signal that killed
 * it and any spawn error. Never throws on a non-zero exit: a compile failure is
 * a finding this probe records, not a crash to report.
 */
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
  return {
    status: result.status,
    signal: result.signal ?? null,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error ? String(result.error.message) : null,
  };
}

/** How a finished command should be described in a failure message. */
function describeRun(result) {
  const how =
    result.signal !== null
      ? `was killed by ${result.signal}, which is what the ${TIMEOUT_MS / 1000} second timeout does`
      : result.error !== null
        ? `could not be started: ${result.error}`
        : `exited ${result.status}`;
  return `${how}\n${result.stdout}\n${result.stderr}`;
}

/** Read a file, or return null rather than throwing an ENOENT with no context. */
function readOrNull(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// The verbatim-copy comparison
// ---------------------------------------------------------------------------

/** Every file under `dir`, relative to it, with forward slashes, sorted. */
export function fileList(dir) {
  const found = [];
  const walk = (current, prefix) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) walk(join(current, entry.name), rel);
      else found.push(rel);
    }
  };
  walk(dir, '');
  return found.sort();
}

/** `{ relative path -> sha256 }` for every file under `dir`. */
export function hashTree(dir) {
  const hashes = new Map();
  for (const rel of fileList(dir)) {
    hashes.set(rel, createHash('sha256').update(readFileSync(join(dir, ...rel.split('/')))).digest('hex'));
  }
  return hashes;
}

/**
 * Compare two `{ path -> sha256 }` maps.
 *
 * Pure, so `ops/__tests__/cs-tracker-adoption-probe.test.ts` can plant a
 * mismatch without a filesystem. **An empty left side is a failure**, never a
 * vacuous pass: comparing nothing against nothing would report a verbatim copy
 * of a folder that does not exist.
 *
 * @param {Map<string,string>} source
 * @param {Map<string,string>} vendored
 */
export function compareHashes(source, vendored) {
  const missing = [];
  const extra = [];
  const differing = [];
  const equal = [];

  for (const [path, hash] of source) {
    if (!vendored.has(path)) missing.push(path);
    else if (vendored.get(path) !== hash) differing.push({ path, source: hash, vendored: vendored.get(path) });
    else equal.push(path);
  }
  for (const path of vendored.keys()) {
    if (!source.has(path)) extra.push(path);
  }

  return {
    equal: equal.sort(),
    missing: missing.sort(),
    extra: extra.sort(),
    differing: differing.sort((a, b) => a.path.localeCompare(b.path)),
    identical: source.size > 0 && missing.length === 0 && extra.length === 0 && differing.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Reading `cs-tracker`'s own `app.css`
// ---------------------------------------------------------------------------

/** Strip CSS comments, so a commented-out declaration is never read as a live one. */
export function withoutComments(css) {
  return typeof css === 'string' ? css.replace(/\/\*[\s\S]*?\*\//g, '') : '';
}

/**
 * The bodies of every `@plugin "../vendor/daisyui-theme" { ... }` block, in
 * source order.
 *
 * Comments are stripped first and the closing brace is found by counting, not
 * by `[^}]*`. A `}` inside a comment would otherwise end the body early and
 * hide every declaration after it from every assertion downstream, which is a
 * silent partial read rather than a failure.
 */
export function themeBlocks(css) {
  const bodies = [];
  if (typeof css !== 'string') return bodies;
  const text = withoutComments(css);
  const needle = '@plugin "../vendor/daisyui-theme"';
  let at = text.indexOf(needle);
  while (at !== -1) {
    const open = text.indexOf('{', at + needle.length);
    if (open === -1) break;
    let depth = 1;
    let i = open + 1;
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth += 1;
      else if (text[i] === '}') depth -= 1;
      if (depth === 0) break;
      i += 1;
    }
    if (depth !== 0) break;
    bodies.push(text.slice(open + 1, i));
    at = text.indexOf(needle, i);
  }
  return bodies;
}

/** Every distinct `oklch(...)` literal a stylesheet declares, sorted. */
export function oklchLiterals(css) {
  if (typeof css !== 'string') return [];
  return [...new Set([...css.matchAll(/oklch\([^)]*\)/g)].map((match) => match[0]))].sort();
}

/**
 * The literals the baseline declared and the current file no longer does.
 *
 * Derived rather than transcribed, so a theme that was only half retired
 * produces a shorter set here and fails the pinned count rather than passing.
 */
export function retiredLiterals(baselineCss, currentCss) {
  const kept = new Set(oklchLiterals(currentCss));
  return oklchLiterals(baselineCss).filter((literal) => !kept.has(literal));
}

/**
 * The FR-18 rows that cannot be compared, so a run never reports agreement
 * between two values nobody published.
 *
 * A name that is not DECLARED on `:root` makes its probe fall back to the
 * document default, and that default is the same in both pages: an undeclared
 * `--f-*` or `--t-*` would report as equal on both sides while the contract had
 * silently stopped publishing it. So a row is unreadable when either computed
 * value is missing or unpainted, or when either side declares nothing.
 *
 * @param {{name: string, hub: string, tracker: string, hubDeclared: string, trackerDeclared: string}[]} rows
 */
export function unreadableRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (row) =>
      !row.hub ||
      !row.tracker ||
      row.hub === UNPAINTED ||
      row.tracker === UNPAINTED ||
      !row.hubDeclared ||
      !row.trackerDeclared
  );
}

/**
 * WCAG 2.1 contrast ratio between two `rgba(r, g, b, a)` strings, which is the
 * shape `CANONICALISE` returns.
 *
 * Computed here rather than by a script that lives nowhere, so every ratio the
 * record quotes names a committed method and moves when a mapping moves. Alpha
 * is ignored: every pair compared is opaque, and the one translucent role,
 * `--token-scrim`, is never a text pair.
 */
export function contrastRatio(a, b) {
  const channels = (value) => {
    const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(String(value));
    return match === null ? null : [Number(match[1]), Number(match[2]), Number(match[3])];
  };
  const left = channels(a);
  const right = channels(b);
  if (left === null || right === null) return null;
  const luminance = (rgb) =>
    rgb
      .map((channel) => {
        const v = channel / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      })
      .reduce((total, v, index) => total + v * [0.2126, 0.7152, 0.0722][index], 0);
  const l1 = luminance(left);
  const l2 = luminance(right);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The `--name: value` custom-property declarations in one theme block, in
 * source order, with comments stripped.
 */
export function themeDeclarations(block) {
  const declared = [];
  for (const raw of withoutComments(block).split(';')) {
    const at = raw.indexOf(':');
    if (at === -1) continue;
    const name = raw.slice(0, at).trim();
    if (!name.startsWith('--')) continue;
    declared.push({ name, value: raw.slice(at + 1).trim() });
  }
  return declared;
}

/**
 * Split the theme block's `--color-*` declarations into the ones that read a
 * contract role and the ones that kept a literal.
 *
 * The mapping is derived from the file rather than restated here, so a mapping
 * that is deleted disappears from the list rather than quietly passing.
 */
export function colourMapping(block) {
  const mapped = [];
  const literal = [];
  for (const { name, value } of themeDeclarations(block)) {
    if (!name.startsWith('--color-')) continue;
    const role = /^var\(\s*(--token-[a-z0-9-]+)\s*\)$/.exec(value);
    if (role === null) literal.push({ name, value });
    else mapped.push({ name, role: role[1] });
  }
  return { mapped, literal };
}

/**
 * The theme block's shape and stroke rows, and the contract role each reads.
 *
 * Derived from the file like the colour rows, and read in the browser like
 * them: the record marks these Observed, so something has to observe them. The
 * four form controls the S-3 hand-fix squares cannot, because that rule squares
 * them whether the theme maps a radius or not.
 */
export function shapeMapping(block) {
  const mapped = [];
  for (const { name, value } of themeDeclarations(block)) {
    if (!name.startsWith('--radius-') && name !== '--border') continue;
    const role = /var\(\s*(--(?:r|stroke)-[a-z0-9-]+)\s*\)/.exec(value);
    if (role === null) continue;
    mapped.push({
      name,
      role: role[1],
      property: name === '--border' ? 'border-width' : 'border-radius',
      read: name === '--border' ? 'borderTopWidth' : 'borderTopLeftRadius',
    });
  }
  return mapped;
}

/** How many shape and stroke rows the theme block maps. Pinned, like the colours. */
export const MAPPED_SHAPE_COUNT = 4;

/** Every `--color-*` custom property name declared anywhere in a stylesheet. */
export function declaredColourNames(css) {
  const names = new Set();
  if (typeof css !== 'string') return names;
  for (const match of css.matchAll(/(--color-[A-Za-z0-9_-]+)\s*:/g)) names.add(match[1]);
  return names;
}

/** Every distinct value a stylesheet declares for `property`, in first-appearance order. */
export function emittedValues(css, property) {
  const values = new Set();
  if (typeof css !== 'string') return [];
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const match of css.matchAll(new RegExp(`(?<![\\w-])${escaped}\\s*:\\s*([^;}]+)`, 'g'))) {
    values.add(match[1].trim());
  }
  return [...values];
}

/** How many Tailwind Preflights a compiled stylesheet carries. */
export function preflightCount(css) {
  return typeof css === 'string' ? css.split(PREFLIGHT_MARKER).length - 1 : 0;
}

/** The declaration block of the first `::selection` rule, or null. */
export function selectionRule(css) {
  const match = /::selection\s*\{([^}]*)\}/.exec(withoutComments(css));
  return match === null ? null : match[1].trim();
}

/** Every `url("...")` value in a stylesheet that is not a `data:` URI. */
export function fontUrls(css) {
  const urls = new Set();
  if (typeof css !== 'string') return [];
  for (const match of css.matchAll(/url\("([^"]+)"\)/g)) {
    if (!match[1].startsWith('data:')) urls.add(match[1]);
  }
  return [...urls];
}

/**
 * The names in one contract namespace, read out of `contracts/tokens.css`
 * rather than restated, so a rename shows up as a count that moved.
 */
export function namesInNamespace(tokensCss, prefix) {
  const names = [];
  const seen = new Set();
  for (const match of withoutComments(tokensCss).matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) {
    const name = match[1];
    if (!name.startsWith(prefix) || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

// ---------------------------------------------------------------------------
// The fixture
// ---------------------------------------------------------------------------

/**
 * The daisyUI markup `cs-tracker` actually emits.
 *
 * Every `classes` string below is a verbatim substring of the file named in
 * `from`, and `assertFixtureIsTheApplication` re-reads those files and fails if
 * one has drifted. That is what makes the fixture the application's own markup
 * rather than markup invented here that happens to look like it.
 */
export const FIXTURE_ELEMENTS = [
  {
    id: 'shell',
    tag: 'div',
    classes: 'min-h-screen flex flex-col bg-base-200 font-sans text-base-content antialiased',
    from: 'lib/cs_tracker_web/components/layouts.ex',
    text: 'shell',
  },
  {
    id: 'navbar',
    tag: 'div',
    classes: 'navbar min-h-14 bg-base-100 border-b border-base-300 px-2 sm:px-4 gap-1',
    from: 'lib/cs_tracker_web/components/layouts.ex',
    text: 'navbar',
  },
  {
    id: 'wordmark',
    tag: 'span',
    classes:
      'grid place-items-center size-8 rounded-field bg-primary text-primary-content font-mono text-[13px] font-bold leading-none',
    from: 'lib/cs_tracker_web/components/layouts.ex',
    text: 'CS',
  },
  {
    id: 'btn',
    tag: 'button',
    classes: 'btn btn-primary',
    from: 'lib/cs_tracker_web/components/core_components.ex',
    text: 'Primary',
  },
  {
    id: 'btn-ghost',
    tag: 'button',
    classes: 'btn btn-ghost btn-sm btn-square',
    from: 'lib/cs_tracker_web/components/layouts.ex',
    text: 'G',
  },
  {
    id: 'badge',
    tag: 'span',
    classes: 'badge badge-primary',
    from: 'lib/cs_tracker_web/components/core_components.ex',
    text: 'Primary',
  },
  {
    id: 'badge-neutral',
    tag: 'span',
    classes: 'badge badge-neutral',
    from: 'lib/cs_tracker_web/components/core_components.ex',
    text: 'Neutral',
  },
  {
    id: 'badge-success',
    tag: 'span',
    classes: 'badge badge-success',
    from: 'lib/cs_tracker_web/components/core_components.ex',
    text: 'Owned',
  },
  {
    id: 'card',
    tag: 'div',
    classes: 'card border border-base-300 bg-base-100 rounded-box',
    from: 'lib/cs_tracker_web/components/core_components.ex',
    text: 'card',
  },
  {
    id: 'alert',
    tag: 'div',
    classes: 'alert w-80 sm:w-96 max-w-80 sm:max-w-96 text-wrap',
    from: 'lib/cs_tracker_web/components/core_components.ex',
    text: 'alert',
  },
  {
    id: 'spinner',
    tag: 'span',
    classes: 'loading loading-spinner',
    from: 'lib/cs_tracker_web/components/core_components.ex',
    text: '',
  },
];

/** The form controls hand-fix 4 (seam S-3) is read on, with the classes `input/1` emits. */
export const FIXTURE_CONTROLS = [
  {
    id: 'input',
    markup: (id) => `<input id="${id}" data-probe="${id}" type="text" class="w-full input" value="x">`,
    classes: 'w-full input',
    from: 'lib/cs_tracker_web/components/core_components.ex',
  },
  {
    id: 'select',
    markup: (id) =>
      `<select id="${id}" data-probe="${id}" class="w-full select"><option>x</option></select>`,
    classes: 'w-full select',
    from: 'lib/cs_tracker_web/components/core_components.ex',
  },
  {
    id: 'textarea',
    markup: (id) => `<textarea id="${id}" data-probe="${id}" class="w-full textarea">x</textarea>`,
    classes: 'w-full textarea',
    from: 'lib/cs_tracker_web/components/core_components.ex',
  },
];

/** The two components the route-A verdict is computed over, as `ops/daisyui-route.md` chose them. */
export const COMPONENT_IDS = ['btn', 'badge'];

/**
 * The fixture page for the compiled `cs-tracker` stylesheet.
 *
 * `data-role="<token>"` elements declare `background-color: var(--<token>)`
 * inline, so every "equal to the token value" claim is the browser's own
 * resolution on both sides rather than a string written here. The same goes for
 * `data-theme-colour="<--color-*>"`, which is how the daisyUI family is read.
 *
 * @param {{stylesheet: string, roles?: string[], themeColours?: string[], shapes?: {name: string, role: string, property: string}[]}} options
 */
export function fixtureHtml({ stylesheet, roles = [], themeColours = [], shapes = [] }) {
  const elements = FIXTURE_ELEMENTS.map(
    (element) =>
      `  <${element.tag} id="${element.id}" data-probe="${element.id}" class="${element.classes}">${element.text}</${element.tag}>`
  ).join('\n');
  const controls = FIXTURE_CONTROLS.map((control) => `  ${control.markup(control.id)}`).join('\n');
  const roleProbes = roles
    .map((role) => `  <span data-role="${role}" style="background-color: var(${role})">Aa</span>`)
    .join('\n');
  const themeProbes = themeColours
    .map((name) => `  <span data-theme-colour="${name}" style="background-color: var(${name})">Aa</span>`)
    .join('\n');
  const shapeProbes = shapes
    .flatMap((shape) => [
      `  <span data-shape="${shape.name}" style="border-style: solid; ${shape.property}: var(${shape.name})">Aa</span>`,
      `  <span data-shape-role="${shape.name}" style="border-style: solid; ${shape.property}: var(${shape.role})">Aa</span>`,
    ])
    .join('\n');

  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<title>cs-tracker token adoption probe</title>
<link rel="stylesheet" href="./${stylesheet}">
</head>
<body>
<a id="focus-anchor" href="#">focus anchor</a>
${elements}
${controls}
${roleProbes}
${themeProbes}
${shapeProbes}
</body>
</html>
`;
}

/**
 * The fixture page for the Hub's own built stylesheet.
 *
 * It carries the same role probes and nothing else: the FR-18 row is about the
 * shared roles, not about the Hub's components, and a fixture that pulled in
 * Hub markup would invite reading a component difference as a token difference.
 *
 * @param {{stylesheet: string, roles?: string[], families?: string[], sizes?: string[]}} options
 */
export function hubFixtureHtml({ stylesheet, roles = [], families = [], sizes = [] }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>cuatro.dev built stylesheet</title>
<link rel="stylesheet" href="./${stylesheet}">
</head>
<body>
${roles.map((role) => `  <span data-role="${role}" style="background-color: var(${role})">Aa</span>`).join('\n')}
${families.map((f) => `  <span data-family="${f}" style="font-family: var(${f})">Aa</span>`).join('\n')}
${sizes.map((t) => `  <span data-size="${t}" style="font-size: var(${t})">Aa</span>`).join('\n')}
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// The verdict, as a pure function
// ---------------------------------------------------------------------------

/**
 * Every outcome the route-A reading can reach. They are distinct on purpose:
 * reporting a build that failed to compile as a mapping that failed to resolve
 * would be a wrong answer rather than a failure.
 */
export const VERDICT = {
  live: 'LIVE',
  dead: 'dead',
  split: 'SPLIT, components disagree',
  noCompile: 'does not compile',
  notObserved: 'no value observed',
  noReference: 'no reference, the token probe was never read',
  vacuous: 'vacuous, the token probe equals daisyUI\'s own default',
};

/**
 * Is route A live in `cs-tracker`'s real compiled stylesheet?
 *
 * A build is `{ compiled: boolean, values: { components: Record<string,string>,
 * reference: string } | null }`, and `fallback` is daisyUI's own default for the
 * name under test, which the components must differ from.
 *
 * **Only `LIVE` passes.**
 *
 * @returns {{verdict: string, live: boolean, pass: boolean}}
 */
export function routeVerdict(build, fallback, ids = COMPONENT_IDS) {
  const outcome = (verdict, live = false) => ({ verdict, live, pass: verdict === VERDICT.live });

  if (build == null || build.compiled !== true) return outcome(VERDICT.noCompile);
  if (build.values == null) return outcome(VERDICT.notObserved);

  const reference = build.values.reference;
  if (typeof reference !== 'string' || reference === '' || reference === UNPAINTED) {
    return outcome(VERDICT.noReference);
  }

  if (!Array.isArray(ids) || ids.length === 0) return outcome(VERDICT.notObserved);
  const read = (id) => build.values.components[id];
  if (!ids.every((id) => typeof read(id) === 'string' && read(id) !== '')) {
    return outcome(VERDICT.notObserved);
  }

  const mine = ids.map(read);
  if (!mine.every((value) => value === mine[0])) return outcome(VERDICT.split);

  // A reference that already equals daisyUI's own default measures nothing, so
  // a mapping sitting on top of it cannot be called live whatever it computed.
  if (reference === fallback) return outcome(VERDICT.vacuous);

  if (mine.every((value) => value === reference && value !== fallback)) return outcome(VERDICT.live, true);
  return outcome(VERDICT.dead);
}

// ---------------------------------------------------------------------------
// The scratch tree, the compile and the server
// ---------------------------------------------------------------------------

/** `cs-tracker`'s own pinned standalone Tailwind CLI, wherever it landed under `_build`. */
export function findTailwindBinary(buildDir) {
  const stack = [buildDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!existsSync(current)) continue;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.startsWith('tailwind-')) return full;
    }
  }
  return null;
}

function serve(root) {
  return new Promise((done, fail) => {
    const server = createServer((request, response) => {
      try {
        const requested = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
        const target = normalize(join(root, requested));
        if (!target.startsWith(root + sep) || !existsSync(target) || statSync(target).isDirectory()) {
          response.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
          return;
        }
        response.writeHead(200, { 'content-type': MIME[extname(target)] ?? 'application/octet-stream' });
        response.end(readFileSync(target));
      } catch (error) {
        try {
          response.writeHead(500, { 'content-type': 'text/plain' }).end(String(error));
        } catch {
          response.destroy();
        }
      }
    });
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => done(server));
  });
}

/**
 * The Hub's built stylesheet: the one chunk under `.next/static` that declares
 * the contract's own `--c-paper`, a name nothing else in the estate declares.
 */
export function findHubStylesheet(nextStatic) {
  const found = [];
  const stack = [nextStatic];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!existsSync(current)) continue;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith('.css') && (readOrNull(full) ?? '').includes('--c-paper:')) found.push(full);
    }
  }
  return found.sort();
}

/**
 * Canonicalise a computed colour to 8-bit sRGB, in the browser, through a
 * canvas.
 *
 * The Hub's build minifies `oklch(12% 0.011 288)` into a `#rrggbb` fallback
 * plus a `lab()` override behind `@supports`, so the two stylesheets serialise
 * the same colour in different spaces and a string comparison would report a
 * difference that does not exist. Rasterising both sides through the same
 * engine is the comparison that means what FR-18 asks.
 */
const CANONICALISE = `
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.globalCompositeOperation = 'copy';
  const canonical = (colour) => {
    if (typeof colour !== 'string' || colour === '') return '';
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return 'rgba(' + d[0] + ', ' + d[1] + ', ' + d[2] + ', ' + (d[3] / 255).toFixed(3) + ')';
  };
`;

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

async function probe() {
  const startedAt = Date.now();
  const cases = [];
  const record = (name, pass, detail) => {
    cases.push({ name, pass, detail });
    say(`${pass ? 'PASS' : 'FAIL'}  ${name}: ${detail}`);
  };

  say('# cs-tracker token adoption probe, Story 1-19, FR-18 and SM-6');
  say(`# started ${new Date(startedAt).toISOString()}`);
  say('');

  // ---- Block If conditions, before anything is compiled ----------------
  if (!existsSync(join(CS_TRACKER, 'mix.exs'))) {
    throw new BlockedError(
      `cs-tracker is not checked out beside this repository at ${CS_TRACKER}, so its real app.css ` +
        `cannot be compiled and nothing can be observed.`
    );
  }
  const tailwindBinary = findTailwindBinary(join(CS_TRACKER, '_build'));
  if (tailwindBinary === null) {
    throw new BlockedError(
      `cs-tracker's pinned Tailwind binary was not found under ${join(CS_TRACKER, '_build')}. The ` +
        `rendered half of this story is the acceptance and there is nothing to substitute for it. ` +
        `Run mix assets.setup in cs-tracker.`
    );
  }
  const banner = /(tailwindcss v[\d.]+)/.exec(run(tailwindBinary, ['--help'], { cwd: CS_TRACKER }).stdout ?? '');
  if (banner === null || !banner[1].endsWith(` v${PINNED_TAILWIND}`)) {
    throw new BlockedError(
      `cs-tracker's Tailwind binary reports ${banner?.[1] ?? 'no version at all'}, not v${PINNED_TAILWIND}. ` +
        `The finding would be about a different compiler from the one cs-tracker runs, so nothing was compiled.`
    );
  }
  const daisyui = /var version = "([^"]+)"/.exec(
    readOrNull(join(CS_TRACKER, 'assets', 'vendor', 'daisyui.js')) ?? ''
  );
  if (daisyui === null || daisyui[1] !== PINNED_DAISYUI) {
    throw new BlockedError(
      `cs-tracker's vendored daisyUI reports ${daisyui?.[1] ?? 'no version at all'}, not ${PINNED_DAISYUI}. ` +
        `ops/daisyui-route.md's finding is pinned to that version, so nothing was compiled.`
    );
  }
  const hubStylesheets = findHubStylesheet(join(REPO_ROOT, '.next', 'static'));
  if (hubStylesheets.length === 0) {
    throw new BlockedError(
      `no built Hub stylesheet under .next/static declares the contract's own --c-paper, so the FR-18 ` +
        `side-by-side has nothing to read on the Anchor's side. Run corepack pnpm build first.`
    );
  }
  if (hubStylesheets.length > 1) {
    throw new BlockedError(
      `${hubStylesheets.length} built Hub stylesheets declare --c-paper: ` +
        `${hubStylesheets.join(', ')}. The contract would then ship twice, which is a payload defect ` +
        `rather than a token difference, and this probe will not pick one of them.`
    );
  }
  const hubStylesheet = hubStylesheets[0];

  let chromium;
  try {
    ({ chromium } = require_('@playwright/test'));
  } catch (error) {
    throw new BlockedError(
      `@playwright/test could not be loaded from this repository's node_modules, so no computed value ` +
        `can be read and the whole content of this story is that reading. Run corepack pnpm install. ` +
        `${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Read before anything is planted, compared after everything is removed. Two
  // of the cases below need a candidate class inside cs-tracker's own tree to
  // be scanned or not scanned, and a probe that leaves one behind would be a
  // probe that edited another repository.
  const treeBefore = run('git', ['status', '--porcelain'], { cwd: CS_TRACKER }).stdout;

  const root = realpathSync(mkdtempSync(join(tmpdir(), SCRATCH_PREFIX)));
  let server = null;
  let browser = null;
  let leaked = false;
  /** Every file planted inside `cs-tracker`, removed in the `finally`. */
  const planted = [];
  const plant = (relPath, contents) => {
    const target = join(CS_TRACKER, ...relPath.split('/'));
    writeFileSync(target, contents);
    planted.push(target);
    return target;
  };
  /** Compile one stylesheet inside `cs-tracker` into the scratch tree. */
  const compileFrom = (inputRel, outputName) => {
    const output = join(root, outputName);
    const result = run(
      tailwindBinary,
      [`--input=${join(CS_TRACKER, ...inputRel.split('/'))}`, `--output=${output}`],
      { cwd: CS_TRACKER }
    );
    return {
      status: result,
      css: existsSync(output) ? readFileSync(output, 'utf8') : null,
      output,
    };
  };

  try {
    say(`# scratch tree: ${root}`);
    say(`# cs-tracker:   ${CS_TRACKER}`);
    say(`# tailwind:     ${tailwindBinary} (${banner[1]})`);
    say(`# daisyui:      ${daisyui[1]}`);
    say(`# hub css:      ${relative(REPO_ROOT, hubStylesheet)}`);
    say('');

    // ---- case: the folder is a verbatim copy ---------------------------
    const vendoredDir = join(CS_TRACKER, VENDORED_REL);
    const sourceHashes = hashTree(CONTRACTS);
    const comparison = compareHashes(sourceHashes, hashTree(vendoredDir));
    record(
      'The folder is a verbatim copy',
      // The count is pinned as well as the comparison. A tree walk that stopped
      // recursing would hand `compareHashes` the three top-level stylesheets on
      // both sides, find nothing wrong, and report a verbatim copy having never
      // looked at the three faces or the three licence texts.
      comparison.identical && comparison.equal.length === CONTRACT_FILE_COUNT,
      comparison.identical
        ? `${comparison.equal.length} file(s) (pinned at ${CONTRACT_FILE_COUNT}) under ` +
          `${VENDORED_REL.replace(/\\/g, '/')} are byte-identical to contracts/ by sha256: ` +
          comparison.equal.map((path) => `${path} ${sourceHashes.get(path)}`).join(', ')
        : `not a verbatim copy. ${comparison.equal.length} equal, ` +
          `${comparison.missing.length} missing (${comparison.missing.join(', ') || 'none'}), ` +
          `${comparison.extra.length} extra (${comparison.extra.join(', ') || 'none'}), ` +
          `${comparison.differing.length} differing (` +
          `${comparison.differing.map((d) => `${d.path}: contracts ${d.source} against vendored ${d.vendored}`).join('; ') || 'none'})`
    );

    // ---- case: the record states the version the vendored header carries
    // Story 1-20. The version `ops/contract-adoption.md` records for cs-tracker
    // is what Story 2.5 seeds `token_contract` from, and nothing else holds it
    // to the folder: every other pin on the version is a literal in a test.
    // This is the hand-run stand-in for step 6's declaration-against-header
    // comparison until Story 2.23's scheduled job exists.
    const recordText = readOrNull(join(REPO_ROOT, ...RECORD_REL.split('/')));
    const vendoredTokensCss = readOrNull(join(vendoredDir, 'tokens.css'));
    const readOr = (text, read) => {
      if (text === null) return null;
      try {
        return read(text);
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    };
    const recorded = recordedVersionVerdict({
      recorded: readOr(recordText, (text) => recordedAdoptedVersion(text, 'cs-tracker')),
      header: readOr(vendoredTokensCss, headerVersion),
    });
    record(
      'The record states the version the vendored header carries',
      recorded.pass,
      `${recorded.detail} (${RECORD_REL} against ${VENDORED_REL.replace(/\\/g, '/')}/tokens.css` +
        `${recordText === null ? '; the record could not be read' : ''}` +
        `${vendoredTokensCss === null ? '; the vendored tokens.css could not be read' : ''})`
    );

    // ---- case: it compiles at all --------------------------------------
    const output = join(root, 'app.css');
    const compiled = run(
      tailwindBinary,
      [`--input=${join(CS_TRACKER, 'assets', 'css', 'app.css')}`, `--output=${output}`],
      { cwd: CS_TRACKER }
    );
    const compiledCss = existsSync(output) ? readFileSync(output, 'utf8') : null;
    const compiledOk = compiled.status === 0 && compiledCss !== null && compiledCss.length > 0;
    record(
      'It compiles at all',
      compiledOk,
      compiledOk
        ? `cs-tracker's real assets/css/app.css compiled with its own pinned ${banner[1]} to ` +
          `${Buffer.byteLength(compiledCss, 'utf8')} bytes, Preflight emitted ${preflightCount(compiledCss)} time(s)`
        : `the CLI ${describeRun(compiled).replace(/\s+/g, ' ').slice(0, 800)}`
    );
    if (!compiledOk) {
      throw new BlockedError(
        `cs-tracker's real app.css does not compile with the vendored adapter imported. That is the ` +
          `premise AD-14 and this whole step rest on, so nothing below could be observed. The CLI ` +
          `${describeRun(compiled).replace(/\s+/g, ' ').slice(0, 800)}`
      );
    }

    // ---- the mapping, derived from cs-tracker's own app.css -------------
    const appCss = readFileSync(join(CS_TRACKER, 'assets', 'css', 'app.css'), 'utf8');
    const blocks = themeBlocks(appCss);
    const mapping = blocks.length === 1 ? colourMapping(blocks[0]) : { mapped: [], literal: [] };
    const shapes = blocks.length === 1 ? shapeMapping(blocks[0]) : [];

    // ---- the contract's own namespaces, read rather than restated -------
    const tokensCss = readFileSync(join(CONTRACTS, 'tokens.css'), 'utf8');
    const roles = namesInNamespace(tokensCss, '--token-');
    const families = namesInNamespace(tokensCss, '--f-');
    const sizes = namesInNamespace(tokensCss, '--t-');

    // ---- serve the compiled stylesheet beside the faces ----------------
    cpSync(join(CONTRACTS, 'fonts'), join(root, 'fonts'), { recursive: true });
    cpSync(hubStylesheet, join(root, 'hub.css'));
    writeFileSync(
      join(root, 'cs-tracker.html'),
      fixtureHtml({
        stylesheet: 'app.css',
        roles,
        themeColours: mapping.mapped.map((entry) => entry.name),
        shapes,
      })
    );
    writeFileSync(join(root, 'hub.html'), hubFixtureHtml({ stylesheet: 'hub.css', roles, families, sizes }));

    server = await serve(root);
    const address = server.address();
    if (!address || typeof address === 'string') throw new BlockedError('the scratch server reported no port');
    const origin = `http://127.0.0.1:${address.port}`;

    try {
      browser = await chromium.launch();
    } catch (error) {
      throw new BlockedError(
        `no Chromium could be launched, so nothing can be observed. Run ` +
          `corepack pnpm exec playwright install chromium. ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
    }
    const page = await browser.newPage({ viewport: VIEWPORT });

    const csResponse = await page.goto(`${origin}/cs-tracker.html`, { waitUntil: 'load' });
    if (csResponse === null || csResponse.status() !== 200) {
      throw new BlockedError(
        `the cs-tracker fixture answered ${csResponse?.status() ?? 'nothing'}, so the harness itself is ` +
          `broken and no value it read could be trusted.`
      );
    }

    // The focus ring is only asserted under `:focus-visible`, which a mouse
    // click deliberately does not satisfy. A real Tab press is the only way to
    // put the document into the state the rule is written for, and the target
    // is the daisyUI `.btn` rather than the bare anchor before it: daisyUI
    // ships its own `.btn:focus-visible` ring, so a plain element would never
    // show that the contract's rule wins over it.
    for (let pressed = 0; pressed < 10; pressed += 1) {
      await page.keyboard.press('Tab');
      const landed = await page.evaluate(() => document.activeElement?.id ?? '');
      if (landed === 'btn') break;
    }
    const focusedOn = await page.evaluate(() => document.activeElement?.id ?? '');
    if (focusedOn !== 'btn') {
      throw new BlockedError(
        `Tab never reached the daisyUI button in the fixture (it stopped on "${focusedOn}"), so the ` +
          `focus ring could not be read on the element the rule has to win on.`
      );
    }

    const csReadings = await page.evaluate(
      ({ roles, families, sizes, themeColours, mapped, controls, shapeRows, canonicaliseSource }) => {
        // eslint-disable-next-line no-new-func
        const canonical = new Function(`${canonicaliseSource}; return canonical;`)();
        const style = (selector) => {
          const element = document.querySelector(selector);
          if (element === null) throw new Error(`the fixture carries no ${selector}`);
          return window.getComputedStyle(element);
        };
        const background = (selector) => canonical(style(selector).backgroundColor);
        const probe = (id) => background(`[data-probe="${id}"]`);
        const roleValue = (name) => background(`[data-role="${name}"]`);

        const focused = document.activeElement;
        const focusStyle = focused === null ? null : window.getComputedStyle(focused);

        return {
          components: { btn: probe('btn'), badge: probe('badge') },
          reference: roleValue('--token-accent'),
          probes: Object.fromEntries(
            [...document.querySelectorAll('[data-probe]')].map((element) => [
              element.dataset.probe,
              canonical(window.getComputedStyle(element).backgroundColor),
            ])
          ),
          roles: Object.fromEntries(roles.map((name) => [name, roleValue(name)])),
          families: Object.fromEntries(
            families.map((name) => [
              name,
              (() => {
                const span = document.createElement('span');
                span.style.fontFamily = `var(${name})`;
                document.body.append(span);
                const value = window.getComputedStyle(span).fontFamily;
                span.remove();
                return value;
              })(),
            ])
          ),
          sizes: Object.fromEntries(
            sizes.map((name) => [
              name,
              (() => {
                const span = document.createElement('span');
                span.style.fontSize = `var(${name})`;
                document.body.append(span);
                const value = window.getComputedStyle(span).fontSize;
                span.remove();
                return value;
              })(),
            ])
          ),
          // The daisyUI family, each name beside the role it claims to read.
          family: Object.fromEntries(
            mapped.map(({ name, role }) => [
              name,
              { declared: background(`[data-theme-colour="${name}"]`), role, roleValue: roleValue(role) },
            ])
          ),
          themeColourCount: themeColours.length,
          colorScheme: window.getComputedStyle(document.documentElement).colorScheme,
          selection: (() => {
            const computed = window.getComputedStyle(document.body, '::selection');
            return {
              background: canonical(computed.backgroundColor),
              colour: canonical(computed.color),
            };
          })(),
          focus:
            focusStyle === null
              ? null
              : {
                  element: focused.tagName.toLowerCase() + (focused.id ? `#${focused.id}` : ''),
                  width: focusStyle.outlineWidth,
                  style: focusStyle.outlineStyle,
                  colour: canonical(focusStyle.outlineColor),
                  offset: focusStyle.outlineOffset,
                  transitionProperty: focusStyle.transitionProperty,
                },
          // Read off :root so the comparison is against the contract's own
          // declared lengths rather than against numbers written in this file.
          strokeFocus: (() => {
            const span = document.createElement('span');
            span.style.outline = 'var(--stroke-focus) solid var(--token-focus)';
            span.style.outlineOffset = 'var(--focus-offset)';
            document.body.append(span);
            const computed = window.getComputedStyle(span);
            const read = {
              width: computed.outlineWidth,
              colour: canonical(computed.outlineColor),
              offset: computed.outlineOffset,
            };
            span.remove();
            return read;
          })(),
          radii: Object.fromEntries(
            [...controls, 'btn'].map((id) => [id, style(`[data-probe="${id}"]`).borderRadius])
          ),
          shellFontFamily: style('[data-probe="shell"]').fontFamily,
          // The shape and stroke rows, read the same way the colour rows are:
          // a probe declaring the daisyUI name beside one declaring the role it
          // claims to read. The four form controls the S-3 hand-fix squares
          // cannot stand in for this, because that rule squares them whether
          // the theme maps a radius or not.
          shapes: Object.fromEntries(
            shapeRows.map(({ name, read }) => [
              name,
              {
                declared: style(`[data-shape="${name}"]`)[read],
                roleValue: style(`[data-shape-role="${name}"]`)[read],
              },
            ])
          ),
          // Whether the name is DECLARED on :root at all, per namespace. An
          // undeclared --f-* or --t-* makes its probe inherit the document
          // default, which is the same default on both sides, so the FR-18 row
          // would report equal from two values nobody published.
          declared: Object.fromEntries(
            [...roles, ...families, ...sizes].map((name) => [
              name,
              window.getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
            ])
          ),
        };
      },
      {
        shapeRows: shapes,
        roles,
        families,
        sizes,
        themeColours: mapping.mapped.map((entry) => entry.name),
        mapped: mapping.mapped,
        controls: FIXTURE_CONTROLS.map((control) => control.id),
        canonicaliseSource: CANONICALISE,
      }
    );

    // ---- case: route A resolves in the real stylesheet ------------------
    const verdict = routeVerdict(
      { compiled: true, values: { components: csReadings.components, reference: csReadings.reference } },
      DAISYUI_DEFAULT_PRIMARY
    );
    record(
      'Route A resolves in the real stylesheet',
      verdict.pass,
      `${verdict.verdict}: .btn.btn-primary computed ${csReadings.components.btn} and ` +
        `.badge.badge-primary computed ${csReadings.components.badge}, against var(--token-accent) ` +
        `declared inline in the same page computing ${csReadings.reference}, and against daisyUI ` +
        `5.0.35's own default primary ${DAISYUI_DEFAULT_PRIMARY}`
    );

    // ---- case: the whole daisyUI colour family --------------------------
    const familyRows = Object.entries(csReadings.family).map(([name, read]) => ({
      name,
      role: read.role,
      declared: read.declared,
      roleValue: read.roleValue,
      ok: read.declared !== '' && read.declared !== UNPAINTED && read.declared === read.roleValue,
    }));
    const familyWrong = familyRows.filter((row) => !row.ok);
    const countsPinned =
      mapping.mapped.length === MAPPED_COLOUR_COUNT && mapping.literal.length === UNCOVERED_COLOUR_COUNT;
    record(
      'The whole daisyUI colour family',
      familyRows.length === MAPPED_COLOUR_COUNT && countsPinned && familyWrong.length === 0,
      `${familyRows.length} of the ${mapping.mapped.length + mapping.literal.length} --color-* names the ` +
        `theme block declares are mapped onto a contract role (pinned at ${MAPPED_COLOUR_COUNT}), and ` +
        `${mapping.literal.length} keep a literal (pinned at ${UNCOVERED_COLOUR_COUNT}: ` +
        `${mapping.literal.map((entry) => entry.name).join(', ') || 'none'}). ` +
        (familyWrong.length === 0
          ? `Every mapped name computes the value of its role: ` +
            familyRows.map((row) => `${row.name} = ${row.role} = ${row.declared}`).join('; ')
          : `${familyWrong.length} did NOT: ` +
            familyWrong
              .map((row) => `${row.name} computed ${row.declared} against ${row.role} computing ${row.roleValue}`)
              .join('; '))
    );

    // ---- case: the shape and stroke rows --------------------------------
    const shapeRows = Object.entries(csReadings.shapes).map(([name, read]) => {
      const row = shapes.find((entry) => entry.name === name);
      return {
        name,
        role: row?.role ?? '(unread)',
        declared: read.declared,
        roleValue: read.roleValue,
        ok: read.declared !== '' && read.declared === read.roleValue,
      };
    });
    const shapeWrong = shapeRows.filter((row) => !row.ok);
    record(
      'Shape and stroke come from the contract',
      shapes.length === MAPPED_SHAPE_COUNT && shapeRows.length === MAPPED_SHAPE_COUNT && shapeWrong.length === 0,
      `${shapes.length} shape and stroke rows (pinned at ${MAPPED_SHAPE_COUNT}), each read off :root ` +
        `through a probe declaring the daisyUI name beside one declaring the role: ` +
        shapeRows.map((row) => `${row.name} = ${row.role} = ${row.declared}`).join('; ') +
        (shapeWrong.length === 0
          ? ''
          : `. FAILED: ` +
            shapeWrong
              .map((row) => `${row.name} computed ${row.declared} against ${row.role} computing ${row.roleValue}`)
              .join('; '))
    );

    // ---- case: no surface left on the previous theme --------------------
    // The retired set is DERIVED from git at the baseline commit rather than
    // transcribed: every oklch() the Story 7.1 blocks declared, minus every one
    // the current file still declares. A hand-written list can be short, and a
    // short list is exactly what a partially retired theme looks like.
    const baselineShow = run('git', ['show', `${CS_TRACKER_BASELINE}:assets/css/app.css`], {
      cwd: CS_TRACKER,
    });
    if (baselineShow.status !== 0 || baselineShow.stdout.trim() === '') {
      throw new BlockedError(
        `git show ${CS_TRACKER_BASELINE}:assets/css/app.css read nothing in ${CS_TRACKER}, so the retired ` +
          `palette could not be derived and the claim that none of it survives has no set to check. ` +
          `The CLI ${describeRun(baselineShow).replace(/\s+/g, ' ').slice(0, 400)}`
      );
    }
    const derivedRetired = retiredLiterals(baselineShow.stdout, appCss);
    const pinnedAgrees =
      derivedRetired.length === RETIRED_LITERALS.length &&
      derivedRetired.every((literal, index) => literal === RETIRED_LITERALS[index]);

    // Which of the retired literals daisyUI emits from its own base layer,
    // independent of any theme. Measured against a daisyUI-only build with no
    // theme block at all rather than assumed, so a survivor attributable to
    // daisyUI is never reported as a survivor of the retired theme, and one
    // that is not attributable to it still fails.
    plant(
      'assets/css/cuatro-probe-daisyonly.css',
      '@import "tailwindcss" source(none);\n@plugin "../vendor/daisyui" {\n  themes: false;\n}\n'
    );
    const daisyOnly = compileFrom('assets/css/cuatro-probe-daisyonly.css', 'daisy-only.css');
    if (daisyOnly.css === null) {
      throw new BlockedError(
        `the daisyUI only control build did not compile, so no survivor could be attributed to daisyUI ` +
          `rather than to the retired theme. The CLI ` +
          `${describeRun(daisyOnly.status).replace(/\s+/g, ' ').slice(0, 400)}`
      );
    }
    const daisyOwn = derivedRetired.filter((literal) => daisyOnly.css.includes(literal));
    const survivors = derivedRetired.filter(
      (literal) => compiledCss.includes(literal) && !daisyOwn.includes(literal)
    );
    record(
      'No surface left on the previous theme',
      survivors.length === 0 &&
        blocks.length === 1 &&
        derivedRetired.length === RETIRED_COUNT &&
        pinnedAgrees,
      `${derivedRetired.length} oklch() literals (pinned at ${RETIRED_COUNT}) were retired between ` +
        `${CS_TRACKER_BASELINE} and now, derived from git rather than transcribed, and the pinned list ` +
        `${pinnedAgrees ? 'agrees' : 'DISAGREES'} with the derivation. ` +
        `${survivors.length} survive in the compiled stylesheet` +
        `${survivors.length === 0 ? '' : `: ${survivors.join(', ')}`}. ` +
        `${daisyOwn.length} of them (${daisyOwn.join(', ') || 'none'}) are also emitted by a daisyUI only ` +
        `build carrying no theme block at all, so they are daisyUI's own and are not attributed to the ` +
        `retired theme. ` +
        `${blocks.length} @plugin "../vendor/daisyui-theme" block(s) remain in app.css` +
        `${blocks.length === 1 ? `, name ${/name:\s*"([^"]+)"/.exec(blocks[0])?.[1] ?? '(unread)'}` : ''}`
    );

    // ---- case: hand-fix 1, S-11 -----------------------------------------
    record(
      'Hand-fix 1, S-11',
      csReadings.colorScheme === 'dark',
      `:root computed color-scheme: ${csReadings.colorScheme}`
    );

    // ---- case: hand-fix 2, S-12 -----------------------------------------
    const selection = selectionRule(compiledCss);
    const selectionDeclaresRoles =
      selection !== null && selection.includes('var(--token-accent)') && selection.includes('var(--token-bg)');
    const selectionPaints =
      csReadings.selection.background === csReadings.roles['--token-accent'] &&
      csReadings.selection.colour === csReadings.roles['--token-bg'];
    record(
      'Hand-fix 2, S-12',
      selection !== null && selectionDeclaresRoles && selectionPaints,
      selection === null
        ? 'the compiled stylesheet carries no ::selection rule at all'
        : `::selection declares { ${selection.replace(/\s+/g, ' ')} }, which ` +
          `${selectionDeclaresRoles ? 'reads the accent and the ground rather than a literal' : 'CARRIES A LITERAL'}, ` +
          `and computed background ${csReadings.selection.background} against --token-accent ` +
          `${csReadings.roles['--token-accent']}, foreground ${csReadings.selection.colour} against ` +
          `--token-bg ${csReadings.roles['--token-bg']}`
    );

    // ---- case: hand-fix 3, S-2 -------------------------------------------
    const focus = csReadings.focus;
    const focusOk =
      focus !== null &&
      focus.width === csReadings.strokeFocus.width &&
      focus.style === 'solid' &&
      focus.colour === csReadings.roles['--token-focus'] &&
      focus.offset === csReadings.strokeFocus.offset &&
      !/outline/.test(focus.transitionProperty);
    record(
      'Hand-fix 3, S-2',
      focusOk,
      focus === null
        ? 'nothing took focus, so no ring could be read'
        : `${focus.element} under :focus-visible computed outline-width ${focus.width} against ` +
          `--stroke-focus ${csReadings.strokeFocus.width}, outline-style ${focus.style}, outline-color ` +
          `${focus.colour} against --token-focus ${csReadings.roles['--token-focus']}, outline-offset ` +
          `${focus.offset} against --focus-offset ${csReadings.strokeFocus.offset}, and transition-property ` +
          `"${focus.transitionProperty}"`
    );

    // ---- case: hand-fix 4, S-3 -------------------------------------------
    const rounded = Object.entries(csReadings.radii).filter(([, value]) => value !== '0px');
    record(
      'Hand-fix 4, S-3',
      rounded.length === 0 && Object.keys(csReadings.radii).length === FIXTURE_CONTROLS.length + 1,
      `${Object.keys(csReadings.radii).length} controls read: ` +
        Object.entries(csReadings.radii)
          .map(([id, value]) => `${id} = ${value}`)
          .join(', ') +
        (rounded.length === 0 ? '' : `. ROUNDED: ${rounded.map(([id, value]) => `${id} ${value}`).join(', ')}`)
    );

    // ---- case: type comes from the contract -------------------------------
    const familiesDeclared = families.filter((name) => (csReadings.declared[name] ?? '') !== '');
    const geistStack = csReadings.shellFontFamily.includes('Geist');
    record(
      'Type comes from the contract',
      familiesDeclared.length === FAMILY_COUNT && geistStack,
      `${familiesDeclared.length} of ${FAMILY_COUNT} --f-* families are declared on :root ` +
        `(${families.map((name) => `${name} = ${csReadings.declared[name] || '(empty)'}`).join('; ')}), ` +
        `and the shell's computed font-family is ${csReadings.shellFontFamily}`
    );

    // ---- case: the font faces resolve --------------------------------------
    const urls = fontUrls(compiledCss);
    const faceChecks = [];
    for (const url of urls) {
      const path = url.replace(/^\.\//, '');
      const response = await page.request.get(`${origin}/${path}`);
      faceChecks.push({ url, status: response.status(), onDisk: existsSync(join(root, ...path.split('/'))) });
    }
    const badFaces = faceChecks.filter((face) => face.status !== 200 || !face.onDisk);
    record(
      'The font faces resolve',
      urls.length === 3 && badFaces.length === 0,
      `${urls.length} non-data url() value(s) in the compiled stylesheet, each answering 200 from a ` +
        `directory this probe staged itself beside the output: ` +
        faceChecks.map((face) => `${face.url} -> ${face.status}`).join(', ') +
        `. This proves the PLACEMENT ROUTE, that faces sitting beside the compiled file resolve, and ` +
        `NOT the pipeline: the probe copied them there, so it reads identically whether mix cuatro.fonts ` +
        `exists or not. The pipeline is the next case` +
        (badFaces.length === 0 ? '.' : `. FAILED: ${badFaces.map((face) => face.url).join(', ')}`)
    );

    // ---- case: the build pipeline places them where those urls resolve -----
    // Read out of cs-tracker's own files rather than restated, because the
    // failure this guards against is silent: the faces 404, the page falls back
    // to a system stack, and it looks almost right.
    const mixExs = readOrNull(join(CS_TRACKER, 'mix.exs')) ?? '';
    const fontsTask = readOrNull(join(CS_TRACKER, 'lib', 'mix', 'tasks', 'cuatro.fonts.ex')) ?? '';
    const configExs = readOrNull(join(CS_TRACKER, 'config', 'config.exs')) ?? '';
    const targetRel = /@target_rel\s+"([^"]+)"/.exec(fontsTask)?.[1] ?? null;
    const tailwindOutput = /--output=(\S+)/.exec(configExs)?.[1] ?? null;
    const aliasList = (name) =>
      new RegExp(`"${name}":\\s*\\[([^\\]]*)\\]`).exec(mixExs.replace(/#[^\n]*/g, ''))?.[1] ?? null;
    const buildAlias = aliasList('assets\\.build');
    const deployAlias = aliasList('assets\\.deploy');
    const setupAlias = aliasList('assets\\.setup');
    const expectedTarget =
      tailwindOutput === null ? null : `${tailwindOutput.split('/').slice(0, -1).join('/')}/fonts`;
    const inDeploy = deployAlias !== null && deployAlias.includes('"cuatro.fonts"');
    const beforeDigest =
      inDeploy && deployAlias.indexOf('"cuatro.fonts"') < deployAlias.indexOf('"phx.digest"');
    const pipelineOk =
      targetRel !== null &&
      expectedTarget !== null &&
      targetRel === expectedTarget &&
      buildAlias !== null &&
      buildAlias.includes('"cuatro.fonts"') &&
      setupAlias !== null &&
      setupAlias.includes('"cuatro.fonts"') &&
      beforeDigest;
    record(
      'The build pipeline places them',
      pipelineOk,
      `mix cuatro.fonts writes to ${targetRel ?? '(unread)'}, and the Tailwind profile writes its ` +
        `stylesheet to ${tailwindOutput ?? '(unread)'}, whose url() values therefore resolve in ` +
        `${expectedTarget ?? '(unread)'}. The two ${targetRel === expectedTarget ? 'agree' : 'DISAGREE'}. ` +
        `It runs in assets.setup: ${setupAlias !== null && setupAlias.includes('"cuatro.fonts"')}, in ` +
        `assets.build: ${buildAlias !== null && buildAlias.includes('"cuatro.fonts"')}, in assets.deploy: ` +
        `${inDeploy}, and there ${beforeDigest ? 'before' : 'NOT before'} phx.digest, which rewrites the ` +
        `url() values onto the digested names and needs the files present to do it`
    );

    // ---- case: automatic source detection stays off -----------------------
    // ops/daisyui-route.md recorded this as "a clean negative across five
    // compiles, not a calibrated instrument", because no build in that run had
    // detection on. This is the calibration: the same marker, in a file no
    // @source names, is absent from the real build and present in a control
    // that names it.
    plant(
      'cuatro_probe_source_marker.ex',
      `defmodule CuatroProbeSourceMarker do\n  @moduledoc false\n  def marker, do: "${SCAN_MARKER.candidate}"\nend\n`
    );
    plant(
      'assets/css/cuatro-probe-scan-control.css',
      `@import "tailwindcss" source(none);\n@source "../../cuatro_probe_source_marker.ex";\n`
    );
    const scanControl = compileFrom('assets/css/cuatro-probe-scan-control.css', 'scan-control.css');
    const realBuildAgain = compileFrom('assets/css/app.css', 'app-rescan.css');
    const mintedInControl = (scanControl.css ?? '').includes(SCAN_MARKER.selector);
    const mintedInReal = (realBuildAgain.css ?? '').includes(SCAN_MARKER.selector);
    record(
      'Automatic source detection stays off',
      mintedInControl && !mintedInReal,
      `${SCAN_MARKER.candidate} planted at cuatro_probe_source_marker.ex, which no @source line in ` +
        `app.css names. The real build ${mintedInReal ? 'MINTED' : 'did not mint'} ${SCAN_MARKER.selector}, ` +
        `and a control stylesheet that names that file ${mintedInControl ? 'did' : 'DID NOT'} mint it, so ` +
        `the negative is calibrated rather than a marker nothing would ever have minted. The adapter's own ` +
        `bare @import "tailwindcss" therefore does not re-enable detection: the outer source(none) governs`
    );

    // ---- case: the vendored contract is excluded from the scan ------------
    // Measured in two halves, and the order matters: the clean comparison runs
    // BEFORE anything is planted inside the vendored folder, or it would be
    // measuring the plant.
    const selectorsOf = (css) =>
      new Set([...(css ?? '').matchAll(/^\s*(\.[^\s,{]+)/gm)].map((match) => match[1]));
    plant(
      'assets/css/cuatro-probe-noexclude.css',
      appCss.replace(/^@source not "\.\.\/css\/cuatro-contracts";\r?\n/m, '')
    );
    const cleanNoExclude = compileFrom('assets/css/cuatro-probe-noexclude.css', 'no-exclude-clean.css');
    const cleanSelectors = selectorsOf(cleanNoExclude.css);
    const realSelectors = selectorsOf(compiledCss);
    const extraWithoutExclusion = [...cleanSelectors].filter((selector) => !realSelectors.has(selector));

    plant(
      `${VENDORED_REL.replace(/\\/g, '/')}/cuatro-probe-marker.txt`,
      `${VENDOR_MARKER.candidate}\n`
    );
    const noExclude = compileFrom('assets/css/cuatro-probe-noexclude.css', 'no-exclude.css');
    const withExclude = compileFrom('assets/css/app.css', 'app-vendor-scan.css');
    const mintedWithout = (noExclude.css ?? '').includes(VENDOR_MARKER.selector);
    const mintedWith = (withExclude.css ?? '').includes(VENDOR_MARKER.selector);
    record(
      'The vendored contract is excluded from the scan',
      mintedWithout && !mintedWith && realSelectors.size > 0,
      `${VENDOR_MARKER.candidate} planted inside the vendored folder. The real build ` +
        `${mintedWith ? 'MINTED' : 'did not mint'} ${VENDOR_MARKER.selector}, and a control with only the ` +
        `@source not line removed ${mintedWithout ? 'did' : 'DID NOT'} mint it, so the exclusion is what ` +
        `stops it rather than the candidate never being reachable. ` +
        `Measured before anything was planted, the two builds mint the same ${realSelectors.size} ` +
        `selectors and the unexcluded one adds ${extraWithoutExclusion.length} ` +
        `(${extraWithoutExclusion.join(', ') || 'none'}), so the published contract contributes no ` +
        `candidate of its own today and the exclusion is precautionary rather than load bearing`
    );

    // ---- case: FR-18 side by side -------------------------------------------
    const hubResponse = await page.goto(`${origin}/hub.html`, { waitUntil: 'load' });
    if (hubResponse === null || hubResponse.status() !== 200) {
      throw new BlockedError(
        `the Hub fixture answered ${hubResponse?.status() ?? 'nothing'}, so the FR-18 comparison has no ` +
          `second side.`
      );
    }
    const hubReadings = await page.evaluate(
      ({ roles, families, sizes, canonicaliseSource }) => {
        // eslint-disable-next-line no-new-func
        const canonical = new Function(`${canonicaliseSource}; return canonical;`)();
        const read = (attribute, name, property) => {
          const element = document.querySelector(`[${attribute}="${name}"]`);
          if (element === null) throw new Error(`the Hub fixture carries no [${attribute}="${name}"]`);
          const value = window.getComputedStyle(element)[property];
          if (typeof value !== 'string' || value === '') {
            throw new Error(`[${attribute}="${name}"] read an empty ${property}`);
          }
          return value;
        };
        return {
          roles: Object.fromEntries(roles.map((n) => [n, canonical(read('data-role', n, 'backgroundColor'))])),
          families: Object.fromEntries(families.map((n) => [n, read('data-family', n, 'fontFamily')])),
          sizes: Object.fromEntries(sizes.map((n) => [n, read('data-size', n, 'fontSize')])),
          // Whether each name is DECLARED here at all. A name that is not
          // declared makes its probe fall back to the document default, which
          // is the same default in both pages, so the comparison would report
          // equal from two values nobody published.
          declared: Object.fromEntries(
            [...roles, ...families, ...sizes].map((n) => [
              n,
              window.getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
            ])
          ),
        };
      },
      { roles, families, sizes, canonicaliseSource: CANONICALISE }
    );

    const sideBySide = [
      ...roles.map((name) => ({ name, hub: hubReadings.roles[name], tracker: csReadings.roles[name] })),
      ...families.map((name) => ({ name, hub: hubReadings.families[name], tracker: csReadings.families[name] })),
      ...sizes.map((name) => ({ name, hub: hubReadings.sizes[name], tracker: csReadings.sizes[name] })),
    ].map((row) => ({
      ...row,
      hubDeclared: hubReadings.declared[row.name] ?? '',
      trackerDeclared: csReadings.declared[row.name] ?? '',
    }));
    const emptyReads = unreadableRows(sideBySide);
    if (emptyReads.length > 0) {
      throw new BlockedError(
        `${emptyReads.length} name(s) were unread or undeclared on one side, so there was nothing to ` +
          `compare and an equality between two inherited defaults would have been reported as agreement: ` +
          emptyReads
            .map(
              (row) =>
                `${row.name} (hub computed "${row.hub}" declared "${row.hubDeclared}", ` +
                `cs-tracker computed "${row.tracker}" declared "${row.trackerDeclared}")`
            )
            .join(', ')
      );
    }
    const differing = sideBySide.filter((row) => row.hub !== row.tracker);
    const countsRight =
      roles.length === ROLE_COUNT && families.length === FAMILY_COUNT && sizes.length === SIZE_COUNT;

    say('');
    say('# FR-18, the shared contract read in one browser, canonicalised to 8-bit sRGB where it is a colour');
    say(`  ${'name'.padEnd(26)} ${'cuatro.dev (built)'.padEnd(54)} cs-tracker (compiled)`);
    for (const row of sideBySide) {
      say(`  ${row.name.padEnd(26)} ${String(row.hub).padEnd(54)} ${row.tracker}`);
    }
    say('');

    record(
      'FR-18 side by side',
      countsRight && differing.length === 0,
      `${roles.length} --token-* roles (pinned ${ROLE_COUNT}), ${families.length} --f-* families ` +
        `(pinned ${FAMILY_COUNT}) and ${sizes.length} --t-* sizes (pinned ${SIZE_COUNT}) were read off :root ` +
        `in the Hub's built stylesheet and in cs-tracker's compiled stylesheet, in one browser at ` +
        `${VIEWPORT.width}x${VIEWPORT.height}. ${sideBySide.length - differing.length} of ${sideBySide.length} ` +
        `are equal across them` +
        (differing.length === 0
          ? '.'
          : `, and ${differing.length} DIFFER: ` +
            differing.map((row) => `${row.name}: hub ${row.hub} against cs-tracker ${row.tracker}`).join('; '))
    );

    // ---- case: the contrast of every pair ---------------------------------
    // Computed here, from the 8-bit sRGB values already canonicalised above, so
    // every ratio the record quotes names a committed method and moves when a
    // mapping moves. The pairs are derived from the mapping: every `-content`
    // name is a foreground on the fill of the same stem.
    const contentPairs = mapping.mapped
      .filter((entry) => entry.name.endsWith('-content'))
      .map((entry) => ({
        fill: entry.name.replace(/-content$/, ''),
        content: entry.name,
      }))
      .filter((pair) => csReadings.family[pair.fill] !== undefined);
    // base-content has no `--color-base` fill of its own: it is the foreground
    // on all three grounds, so all three are read.
    const groundPairs = ['--color-base-100', '--color-base-200', '--color-base-300']
      .filter((name) => csReadings.family[name] !== undefined)
      .map((name) => ({ fill: name, content: '--color-base-content' }));
    const focusPairs = ['--token-bg', '--token-bg-raised', '--token-bg-raised-2'].map((ground) => ({
      fill: ground,
      content: '--token-focus',
      role: true,
    }));

    const valueOf = (name) =>
      name.startsWith('--token-') ? csReadings.roles[name] : csReadings.family[name]?.declared;

    const contrastRows = [...groundPairs, ...contentPairs, ...focusPairs].map((pair) => ({
      pair: `${pair.fill} on ${pair.content}`,
      ratio: contrastRatio(valueOf(pair.fill), valueOf(pair.content)),
      // WCAG 2.1: 4.5:1 for body text, 3:1 for a non-text indicator such as the
      // focus ring.
      floor: pair.role === true ? 3 : 4.5,
    }));
    const belowFloor = contrastRows.filter((row) => row.ratio === null || row.ratio < row.floor);

    say('# contrast, WCAG 2.1 over the 8-bit sRGB values read above');
    for (const row of contrastRows) {
      say(`  ${row.pair.padEnd(52)} ${row.ratio === null ? '(unread)' : `${row.ratio.toFixed(2)}:1`}`);
    }
    say('');
    record(
      'Every pair clears its contrast floor',
      contrastRows.length > 0 && belowFloor.length === 0,
      `${contrastRows.length} pairs computed from the values this run read, ${groundPairs.length} grounds ` +
        `against --color-base-content, ${contentPairs.length} fill-and-content pairs and ` +
        `${focusPairs.length} focus-ring readings. ` +
        (belowFloor.length === 0
          ? `All clear their floor (4.5:1 for text, 3:1 for the ring).`
          : `${belowFloor.length} below floor: ` +
            belowFloor
              .map((row) => `${row.pair} at ${row.ratio === null ? '(unread)' : row.ratio.toFixed(2)}:1`)
              .join('; '))
    );

    // ---- case: cs-tracker's tree is unchanged -----------------------------
    // Three files were planted inside cs-tracker for the two scan cases and one
    // for the daisyUI only control. They are removed in the `finally`, and this
    // case is what makes that a fact rather than an intention. It runs after the
    // removal, below.

    // ---- the diagnostics, which carry no verdict --------------------------
    say('# diagnostics, which never carry a verdict');
    say(`  compiled bytes                      = ${Buffer.byteLength(compiledCss, 'utf8')}`);
    say(`  Preflight emitted                   = ${preflightCount(compiledCss)} time(s)`);
    say(`  --color-primary as EMITTED          = ${emittedValues(compiledCss, '--color-primary').join(' | ')}`);
    say(`  --color-accent as EMITTED           = ${emittedValues(compiledCss, '--color-accent').join(' | ')}`);
    say(`  --color-* names in the compiled css = ${declaredColourNames(compiledCss).size}`);
    for (const element of FIXTURE_ELEMENTS) {
      say(`  ${element.id.padEnd(34)} background-color = ${csReadings.probes[element.id]}`);
    }
    say(`  chromium                            = ${browser.version()}`);
    say('');
  } finally {
    if (browser !== null) await browser.close().catch(() => undefined);
    if (server !== null) {
      try {
        server.closeAllConnections();
        await new Promise((done) => server.close(() => done()));
      } catch {
        // A server that will not close cleanly must not mask the real failure.
      }
    }

    // Everything planted inside `cs-tracker` comes out, on failure as well as
    // on success, and the tree is then compared against what it was before the
    // run. This probe reads another repository; a leftover would be an edit.
    const plantFailures = [];
    for (const target of planted) {
      try {
        rmSync(target, { force: true });
      } catch (error) {
        plantFailures.push(`${target} (${error instanceof Error ? error.message : String(error)})`);
      }
      if (existsSync(target)) plantFailures.push(`${target} (still there)`);
    }
    const treeAfter = run('git', ['status', '--porcelain'], { cwd: CS_TRACKER }).stdout;
    const treeUnchanged = treeAfter === treeBefore && plantFailures.length === 0;
    cases.push({ name: "cs-tracker's tree is unchanged", pass: treeUnchanged, detail: '' });
    say(
      `${treeUnchanged ? 'PASS' : 'FAIL'}  cs-tracker's tree is unchanged: ${planted.length} file(s) ` +
        `were planted inside it for the scan and control builds and ${planted.length - plantFailures.length} ` +
        `were removed, and git status --porcelain is ${treeUnchanged ? 'byte-identical to' : 'DIFFERENT from'} ` +
        `what it was before the run` +
        (plantFailures.length === 0 ? '' : `. LEFT BEHIND: ${plantFailures.join('; ')}`)
    );
    let removalError = null;
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch (error) {
      removalError = error instanceof Error ? error.message : String(error);
    }
    leaked = existsSync(root);
    say(`# scratch tree removed: ${root} (exists afterwards: ${leaked})`);
    if (removalError !== null) say(`#   removal reported: ${removalError}`);
    if (leaked) {
      say('# FAILURE: the scratch tree survived removal, so this run leaves files behind and exits non-zero.');
    }

    const failed = cases.filter((entry) => !entry.pass);
    say('');
    say(`# ${cases.length} cases, ${cases.length - failed.length} PASS, ${failed.length} FAIL`);
    say(`# elapsed ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
    say(`# finished ${new Date().toISOString()}`);
  }

  return cases.every((entry) => entry.pass) && !leaked;
}

/**
 * Assert that every class string the fixture carries is a verbatim substring of
 * the `cs-tracker` file it claims to come from.
 *
 * Exported so the unit suite can run it against a planted drift. Returns the
 * list of strings that were NOT found, so an empty list is the pass.
 */
export function fixtureDrift(readSource) {
  const missing = [];
  for (const element of [...FIXTURE_ELEMENTS, ...FIXTURE_CONTROLS]) {
    const source = readSource(element.from);
    for (const token of element.classes.split(/\s+/).filter(Boolean)) {
      // Delimited on both sides, so `btn` is not satisfied by `btn-primary` and
      // a class that was renamed cannot go on matching a prefix of its old name.
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(?<![A-Za-z0-9_:[\\-])${escaped}(?![A-Za-z0-9_[\\-])`);
      if (typeof source !== 'string' || !pattern.test(source)) {
        missing.push({ id: element.id, token, from: element.from });
      }
    }
  }
  return missing;
}

function sameFile(a, b) {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return false;
  }
}

function thisFile() {
  try {
    return fileURLToPath(import.meta.url);
  } catch {
    return null;
  }
}

const entry = thisFile();
const invokedDirectly = entry !== null && typeof process.argv[1] === 'string' && sameFile(process.argv[1], entry);

if (invokedDirectly) {
  // `process.exitCode` rather than `process.exit`. On a pipe, which is what a
  // shell redirection gives this process, `process.exit` can cut the transcript
  // off mid flush, and this probe's entire value is a transcript quoted
  // verbatim into `ops/cs-tracker-token-adoption.md`.
  const drift = fixtureDrift((rel) => readOrNull(join(CS_TRACKER, ...rel.split('/'))));
  if (drift.length > 0) {
    say(
      `# BLOCKED: ${drift.length} fixture class string(s) are no longer in the cs-tracker file they were ` +
        `read out of, so the fixture would not be the application's markup: ` +
        drift.map((entry) => `${entry.id} needs "${entry.token}" in ${entry.from}`).join('; ')
    );
    process.exitCode = 3;
  } else {
    probe().then(
      (ok) => {
        process.exitCode = ok ? 0 : 1;
      },
      (error) => {
        const blocked = error instanceof BlockedError;
        const text = blocked ? error.message : error instanceof Error ? error.stack : String(error);
        say(`# ${blocked ? 'BLOCKED' : 'PROBE DEFECT'}: ${text}`);
        process.stderr.write(`cs-tracker-adoption-probe: ${text}\n`);
        process.exitCode = blocked ? 3 : 2;
      }
    );
  }
}
