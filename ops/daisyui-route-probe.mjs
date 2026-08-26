// The daisyUI adoption route probe (Story 1-15, AD-15 open item O-3).
//
// AD-15 leaves `cs-tracker`'s token adoption carrying two mappings because
// nobody has run the test that picks one:
//
//   route A  `@plugin ".../daisyui-theme" { --color-primary: var(--token-accent); }`
//   route B  an unlayered `[data-theme="cuatro"] { --color-primary: var(--token-accent); }`
//
// The answer is a rendered-output observation and nothing else. Reading
// daisyUI's or Tailwind's source can explain a result and may never stand in
// for one, so this file builds a throwaway `mix phx.new` application under the
// OS temporary directory, pinned to what `cs-tracker` actually runs, compiles
// five variants of its `app.css` through that application's own asset pipeline,
// and reads the computed `background-color` of real daisyUI components in
// Chromium.
//
// Four variants carry the question, and one test alone would be worthless. A
// fixture that never painted the token colour anywhere would report "route A
// does not work" for a reason that has nothing to do with `var()`. So:
//
//   unmapped    the theme declares no `--color-primary` at all, and daisyUI's
//               own default theme supplies one. This is what "did not resolve"
//               looks like rendered.
//   literal     `--color-primary` set to the literal value `--token-accent`
//               resolves to. This is what "resolved" looks like rendered.
//   plugin-var  route A.
//   css-var     route B.
//
// A route is live when both its components compute EQUAL to `literal` and
// DIFFERENT from `unmapped`, and a route that is not live FAILS its case. That
// matters more than it looks: `ops/daisyui-route.md` tells the Operator that
// re-running this probe is the whole check on a Tailwind bump, so a run in
// which route A quietly died must not exit 0.
//
// **That is stricter than the story's own matrix**, whose two route rows say the
// case passes on either outcome as long as it observed a value. The strict
// reading was taken deliberately: the record promises the Operator a non-zero
// exit as the entire regression signal, and the story's Always clause that no
// pass may be vacuous is what a pass-on-either case would break. The looser
// reading survives in the detail line, which names `dead` and `does not compile`
// as the distinct findings they are rather than flattening both into a failure.
//
// A fifth variant, `composition`, imports `cuatro-contracts/tailwind.css`
// beside daisyUI in one stylesheet and carries route A through it, for
// Story 1.19.
//
// **This is a reproduction tool, not a gate.** It needs Elixir, a hex fetch and
// a browser, and none of the three is on a CI runner. AD-21's blocking rule is
// about gates that exist; nothing here is wired into one. It takes no argument
// and reads no environment variable that selects what it tests, so the run that
// produced `ops/daisyui-route.md` is the run anyone else gets.
//
// The pure parts are exported and covered by `ops/__tests__/daisyui-route-probe.test.ts`,
// which runs with no Elixir, no network and no browser. A probe proves only the
// day it ran; those cases are what keep it able to fail after a later edit.
//
// Usage: node ops/daisyui-route-probe.mjs
//
// Exit codes, because "a route stopped resolving" and "no Chromium on this host"
// are different answers and the record tells the Operator that a non-zero exit
// is the whole regression check:
//
//   0  every named case passed and the scratch tree is gone
//   1  a named case failed, or the scratch application survived removal
//   2  a defect in this file
//   3  a Block If condition: nothing could be observed at all

import { spawnSync } from 'node:child_process';
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
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const require_ = createRequire(import.meta.url);

/**
 * This module's own directory.
 *
 * Guarded, because under Vitest `import.meta.url` is a vite URL rather than a
 * `file:` one and `fileURLToPath` throws on it. An unguarded call here would
 * fail at import time and take the whole unit suite with it, which is the trap
 * `ops/__tests__/contract-purity.test.ts:27-30` records.
 */
function moduleDir() {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return resolve(process.cwd(), 'ops');
  }
}

/** This repository. `contracts/` is copied out of it into the scratch tree. */
export const REPO_ROOT = resolve(moduleDir(), '..');
export const CONTRACTS = join(REPO_ROOT, 'contracts');

/**
 * `cs-tracker`, resolved beside this repository rather than hardcoded to one
 * absolute path, so the estate layout is the only assumption. Read-only: this
 * story writes nothing under it.
 */
export const CS_TRACKER = resolve(REPO_ROOT, '..', 'cs-tracker-workspace', 'cs-tracker');

/** Every scratch directory this probe makes starts with this, so a sweep has a target. */
export const SCRATCH_PREFIX = 'cuatro-daisyui-probe-';

/**
 * Written into a scratch root the moment it is created, naming the process that
 * owns it. The sweep reads it and leaves a tree alone while its owner is alive,
 * so two probes running at once do not delete each other's application.
 */
export const ACTIVE_MARKER = '.probe-active';

/** The generated application's OTP name, and therefore its asset profile key. */
const APP = 'daisy_probe';

/** The theme name the variants declare, and the `data-theme` the fixture wears. */
const THEME = 'cuatro';

/** The pins the whole finding rests on. A run on anything else answers a different question. */
export const PINNED_TAILWIND = '4.1.12';
export const PINNED_ESBUILD = '0.25.4';
export const PINNED_DAISYUI = '5.0.35';

/**
 * What `--token-accent` resolves to, read from `contracts/tokens.css`:
 * `--token-accent: var(--c-accent)` and `--c-accent: oklch(66% 0.165 288)`.
 *
 * The `literal` variant declares this value directly. The reference build and
 * the route builds can only agree if the `var()` chain actually resolved.
 */
const ACCENT_LITERAL = 'oklch(66% 0.165 288)';

/** The `var()` reference both routes carry, and the thing under test. */
const ACCENT_REFERENCE = 'var(--token-accent)';

/**
 * A colour that is neither the accent nor anything daisyUI ships, declared
 * inside the `css-var` variant's own plugin block so route B has a plugin
 * declaration to beat. `cs-tracker`'s real theme blocks all declare
 * `--color-primary`, so a route B that only works against an empty slot would
 * not be a route.
 */
const DECOY = 'oklch(50% 0.2 140)';

/** The two components read, so the finding is about the theme variable and not one component's quirk. */
const COMPONENTS = [
  { id: 'btn', markup: '<button class="btn btn-primary" data-component="btn">Primary</button>' },
  { id: 'badge', markup: '<span class="badge badge-primary" data-component="badge">Primary</span>' },
];

/** The ids the verdict is computed over. Exported so the test feeds the same set. */
export const COMPONENT_IDS = COMPONENTS.map((component) => component.id);

/**
 * Elements that carry no verdict and exist for the composition observation.
 *
 * `--color-accent` is the one name daisyUI's theme and the contract adapter both
 * own, so Story 1.19 needs to know which of the two a daisyUI component reads
 * and which an adapter utility reads once both sit in one stylesheet. In
 * variants 1 to 4 there is no adapter, and `bg-accent` is still minted there:
 * daisyUI registers `--color-accent` as a theme variable of its own, so the
 * utility exists and computes daisyUI's value. That is the control for the
 * composition row, and it is a value rather than an absence.
 */
const DIAGNOSTIC_ELEMENTS = [
  { id: 'accent', markup: '<button class="btn btn-accent" data-component="accent">Accent</button>' },
  { id: 'bg-accent', markup: '<span class="bg-accent" data-component="bg-accent">Aa</span>' },
];

/** The unset background every "nothing painted" failure looks like. */
const UNPAINTED = 'rgba(0, 0, 0, 0)';

/**
 * A utility planted in an application source file that no `@source` line names.
 *
 * `cs-tracker`'s own `app.css` opens `@import "tailwindcss" source(none)`, while
 * `contracts/tailwind.css` opens with a bare `@import "tailwindcss"`. If the
 * second import re-enables Tailwind's automatic source detection, the
 * composition build crawls the whole Phoenix application for class names and
 * the compile stops being the one `source(none)` was chosen for. Minting this
 * marker is what that would look like, so Story 1.19 gets an observation rather
 * than a worry.
 */
const SOURCE_MARKER = 'm-[13px]';
/** How Tailwind escapes that utility's selector in its output. */
const SOURCE_MARKER_SELECTOR = String.raw`.m-\[13px\]`;

/** Emitted exactly once per Tailwind Preflight, so counting it counts Preflights. */
const PREFLIGHT_MARKER = '-webkit-tap-highlight-color';

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.woff2': 'font/woff2',
  '.js': 'text/javascript; charset=utf-8',
};

const MIX = process.platform === 'win32' ? 'mix.bat' : 'mix';

/**
 * How long any spawned command is given. Named rather than repeated, because
 * `describeRun` quotes it back into a transcript that gets published verbatim,
 * and a figure that disagreed with the real timeout would be a lie in evidence.
 */
const TIMEOUT_MS = 600_000;

/** Thrown for a condition the story's Block If names, never for a defect in this file. */
export class BlockedError extends Error {}

function say(message) {
  process.stdout.write(`${message}\n`);
}

/**
 * Run a command, returning its exit status, both streams, the signal that killed
 * it and any spawn error. Never throws on a non-zero exit: a compile failure is
 * a finding this probe records, not a crash to report.
 *
 * `signal` is surfaced because `timeout` kills with SIGTERM and leaves `status`
 * null, which is indistinguishable from a spawn failure at the call site. A
 * `mix phx.new --install` that ran out of time on a cold hex cache is a
 * different thing from a generator that refused, and the caller has to be able
 * to say which.
 */
function run(command, args, options = {}) {
  // Node 18.20 and later refuse to spawn a `.bat` or `.cmd` without a shell, and
  // `mix` and `elixir` are both batch files on Windows. The command is joined
  // into one string rather than passed as an argument vector, because Node warns
  // (DEP0190) that a vector plus `shell: true` is concatenated unescaped, and a
  // deprecation notice in the middle of the probe output is noise in a record
  // that gets quoted verbatim. Every argument this file passes is a bare flag or
  // an identifier, so there is nothing here for a shell to reinterpret.
  const shell = process.platform === 'win32';
  // Quoted only when it has to be. `cmd.exe` resolves a quoted `mix.bat` against
  // the working directory rather than through PATH, and the batch file then
  // computes its own `%~dp0` from that wrong directory and cannot find
  // `elixir.bat`. Observed doing exactly that on 2026-08-25.
  const quoted = shell && command.includes(' ') ? `"${command}"` : command;
  const result = spawnSync(shell ? [quoted, ...args].join(' ') : command, shell ? [] : args, {
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
    shell,
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

/** The first capture of `pattern` in `text`, trimmed, or null. */
function firstMatch(text, pattern) {
  const match = pattern.exec(text);
  return match === null ? null : match[1].trim();
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
// The leftover sweep
// ---------------------------------------------------------------------------

/** Whether the process that claimed a scratch root is still running. */
function ownerAlive(root) {
  const marker = readOrNull(join(root, ACTIVE_MARKER));
  if (marker === null) return false;
  let pid;
  try {
    pid = JSON.parse(marker).pid;
  } catch {
    return false;
  }
  // `pid: null` is what this file's own sweep-probe directory carries, so that
  // branch is the production path for the self-test. `0` and a negative number
  // are neither: on POSIX `process.kill(0, 0)` signals the whole process group
  // and answers "alive" for a marker that names nothing, which would leak a full
  // Phoenix tree per corrupt marker.
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists and belongs to somebody else, so it is
    // alive. Only ESRCH means nobody is there.
    return error.code === 'EPERM';
  }
}

/**
 * How long a scratch directory carrying no `ACTIVE_MARKER` is left alone.
 *
 * A run claims its root in the statement after `mkdtempSync` returns, so there is
 * a window of a few microseconds in which the tree exists and nothing names its
 * owner. A concurrent sweep landing inside that window would delete a live run's
 * application, which is the failure the marker exists to prevent. Anything older
 * than this and still unclaimed died before it could write one.
 */
export const CLAIM_GRACE_MS = 10_000;

/** How long ago a directory was last written, or `Infinity` when that cannot be read. */
function ageMs(target, now) {
  try {
    return now - statSync(target).mtimeMs;
  } catch {
    return Infinity;
  }
}

/**
 * Remove every scratch tree an earlier run left under `base`.
 *
 * A run killed between building the application and its `finally` leaves a full
 * Phoenix tree with `deps/` and `_build/` on disk. This runs before the new tree
 * is made, so a leftover can never be mistaken for this run's.
 *
 * **It never touches a tree that is in use.** `activeRoot` is skipped outright,
 * so is any tree whose `ACTIVE_MARKER` names a process that is still alive, and
 * so is an unclaimed tree younger than `CLAIM_GRACE_MS`, which is a root created
 * moments ago by a run that has not reached its marker write yet. A sweep that
 * deleted a concurrent run's application would turn one run into two failures
 * with no cause in either log.
 *
 * **It never throws.** An unreadable temporary directory and a leftover holding a
 * locked file under `_build`, which is a Windows commonplace, are both reported
 * rather than raised: neither is a finding about the routes, and neither may take
 * the run down before the first variant has compiled.
 *
 * `base` exists so the unit cases can be pointed at a directory of their own
 * rather than at the shared `tmpdir()`, where they would race a live probe.
 *
 * @param {string|null} activeRoot
 * @param {string} base
 * @returns {{swept: string[], skipped: string[], failed: {target: string, reason: string}[]}}
 */
export function sweepLeftovers(activeRoot = null, base = tmpdir()) {
  const swept = [];
  const skipped = [];
  const failed = [];
  const active = activeRoot === null ? null : normalize(activeRoot);
  let entries;
  try {
    entries = readdirSync(base);
  } catch (error) {
    failed.push({ target: base, reason: error instanceof Error ? error.message : String(error) });
    return { swept, skipped, failed };
  }
  const now = Date.now();
  for (const entry of entries) {
    if (!entry.startsWith(SCRATCH_PREFIX)) continue;
    const target = join(base, entry);
    if (active !== null && normalize(target) === active) {
      skipped.push(target);
      continue;
    }
    if (ownerAlive(target)) {
      skipped.push(target);
      continue;
    }
    if (!existsSync(join(target, ACTIVE_MARKER)) && ageMs(target, now) < CLAIM_GRACE_MS) {
      skipped.push(target);
      continue;
    }
    try {
      rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch (error) {
      failed.push({ target, reason: error instanceof Error ? error.message : String(error) });
      continue;
    }
    swept.push(target);
  }
  return { swept, skipped, failed };
}

// ---------------------------------------------------------------------------
// The variants
// ---------------------------------------------------------------------------

/**
 * The theme block every variant declares, minus its `--color-primary` line.
 * Ported from `cs-tracker`'s own `light` theme so the surrounding shape is the
 * one route A has to slot into. `default: false` matters: daisyUI's own `light`
 * theme holds `:root`, so a variant that declares no `--color-primary` inherits
 * daisyUI's own primary rather than nothing at all, and the `unmapped` control
 * therefore measures a real painted colour.
 */
const THEME_BLOCK_REST = [
  '  --color-base-100: oklch(99% 0.004 70);',
  '  --color-base-200: oklch(96.5% 0.006 70);',
  '  --color-base-300: oklch(91.5% 0.008 70);',
  '  --color-base-content: oklch(28% 0.012 60);',
  '  --color-primary-content: oklch(99% 0.012 47);',
  '  --radius-selector: 0.375rem;',
  '  --radius-field: 0.375rem;',
  '  --radius-box: 0.5rem;',
  '  --size-selector: 0.21875rem;',
  '  --size-field: 0.21875rem;',
  '  --border: 1.5px;',
  '  --depth: 1;',
  '  --noise: 0;',
].join('\n');

/**
 * `--color-primary` is the ONE line that moves between the four variants.
 * Everything else in the stylesheet is byte-identical across them, which is
 * what makes a difference in the rendered output attributable to that line.
 */
export const VARIANTS = [
  {
    name: 'unmapped',
    role: 'control',
    primary: null,
    trailing: null,
    what: "the theme declares no --color-primary, so daisyUI's own default theme supplies it",
  },
  {
    name: 'literal',
    role: 'reference',
    primary: ACCENT_LITERAL,
    trailing: null,
    what: `--color-primary: ${ACCENT_LITERAL}, the value --token-accent resolves to`,
  },
  {
    name: 'plugin-var',
    role: 'route A',
    primary: ACCENT_REFERENCE,
    trailing: null,
    what: `@plugin "../vendor/daisyui-theme" { --color-primary: ${ACCENT_REFERENCE}; }`,
  },
  {
    name: 'css-var',
    role: 'route B',
    primary: DECOY,
    trailing: `[data-theme="${THEME}"] {\n  --color-primary: ${ACCENT_REFERENCE};\n}`,
    what: `an unlayered [data-theme="${THEME}"] rule after the plugin, over a plugin block declaring ${DECOY}`,
  },
];

/**
 * The fifth compile, for Story 1.19, which asks a different question.
 *
 * It carries **route A**, not the literal. A composition build that declared the
 * literal would compile the adapter beside daisyUI and never exercise the `var()`
 * at all, so it could not support the claim that the route still works with the
 * adapter present. The claim is the point of the variant.
 */
export const COMPOSITION = {
  name: 'composition',
  role: 'for Story 1.19',
  primary: ACCENT_REFERENCE,
  trailing: null,
  what: `cuatro-contracts/tailwind.css imported beside daisyUI, carrying route A`,
  adapter: true,
};

/**
 * The `app.css` for one variant, in the shape `cs-tracker`'s own file has.
 *
 * `source(none)` plus a single explicit `@source` is what makes each compile
 * hermetic: the class scan sees this variant's own fixture page and nothing
 * else, so what gets minted cannot move because of unrelated text in the tree.
 *
 * **Two deliberate differences from `cs-tracker`'s real file**, both disclosed
 * in `ops/daisyui-route.md`. daisyUI is loaded with `themes: light --default`
 * rather than `themes: false`, because the `unmapped` control needs a daisyUI
 * default theme to fall back to or it would measure an unpainted element rather
 * than a colour. And `@plugin "../vendor/heroicons"` is not loaded, because it
 * mints icon utilities no fixture here uses.
 */
export function appCss(variant) {
  const head = variant.adapter
    ? [
        '@import "tailwindcss" source(none);',
        `@source "../../fixture/${variant.name}.html";`,
        '',
        '/* AD-14 assigns this import to a Tailwind consumer. It carries its own',
        '   @import "tailwindcss" and its own @theme inline block. */',
        '@import "../vendor/cuatro-contracts/tailwind.css";',
      ]
    : [
        '@import "tailwindcss" source(none);',
        `@source "../../fixture/${variant.name}.html";`,
        '',
        '/* Tokens only. Variants 1 to 4 request no face and no adapter. */',
        '@import "../vendor/cuatro-contracts/tokens.css";',
      ];

  const primary = variant.primary === null ? [] : [`  --color-primary: ${variant.primary};`];

  return [
    ...head,
    '',
    '@plugin "../vendor/daisyui" {',
    '  themes: light --default;',
    '}',
    '',
    '@plugin "../vendor/daisyui-theme" {',
    `  name: "${THEME}";`,
    '  default: false;',
    '  prefersdark: false;',
    '  color-scheme: "light";',
    ...primary,
    THEME_BLOCK_REST,
    '}',
    '',
    variant.trailing === null ? '' : `${variant.trailing}\n`,
  ].join('\n');
}

/**
 * The fixture page, identical for every variant except the stylesheet it links
 * and the title. The file compiled against and the file served are the same
 * file, so the class scan and the render cannot disagree.
 *
 * `data-component="token"` is the reference the comparisons use. It declares
 * `var(--token-accent)` inline, so every "equal to the token value" claim is
 * the browser's own resolution on both sides rather than a string written here.
 */
export function fixtureHtml(variant) {
  return `<!doctype html>
<html lang="en" data-theme="${THEME}">
<head>
<meta charset="utf-8">
<title>daisyui route probe: ${variant.name}</title>
<link rel="stylesheet" href="./${variant.name}.css">
<style>
  html, body { margin: 0; padding: 0; background: #fff; }
</style>
</head>
<body>
${[...COMPONENTS, ...DIAGNOSTIC_ELEMENTS].map((element) => `  ${element.markup}`).join('\n')}
  <span data-component="token" style="background-color: var(--token-accent)">Aa</span>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// The verdict, as a pure function
// ---------------------------------------------------------------------------

/**
 * Every outcome a route build can reach. They are distinct on purpose: the
 * story's Never clause forbids reporting a variant that failed to compile as a
 * route that failed to resolve, and the same applies to a run with no usable
 * reference and to two components that disagree with each other.
 */
export const VERDICT = {
  live: 'LIVE',
  dead: 'dead',
  split: 'SPLIT, components disagree',
  noCompile: 'does not compile',
  notObserved: 'no value observed',
  noReference: 'no reference, the literal build is unusable',
  noControl: 'no control, the unmapped build is unusable',
  vacuous: 'vacuous, the control equals the reference',
};

/**
 * The verdict for one route, computed from injected observations so the cases a
 * healthy run never produces are still exercised.
 *
 * A build is `{ compiled: boolean, values: { components: Record<string,string> } | null }`.
 *
 * **Only `LIVE` passes.** `dead`, `does not compile` and every unusable-input
 * outcome fail, because `ops/daisyui-route.md` tells the Operator that re-running
 * this probe is the whole check on a Tailwind or daisyUI bump. A route that
 * stopped resolving must not leave the run exiting 0.
 *
 * @param {{compiled: boolean, values: {components: Record<string,string>}|null}} route
 * @param {{compiled: boolean, values: {components: Record<string,string>}|null}} reference
 * @param {{compiled: boolean, values: {components: Record<string,string>}|null}} control
 * @param {string[]} ids
 * @returns {{verdict: string, live: boolean, pass: boolean}}
 */
export function routeVerdict(route, reference, control, ids = COMPONENT_IDS) {
  const outcome = (verdict, live = false) => ({ verdict, live, pass: verdict === VERDICT.live });

  const usable = (build) => build != null && build.compiled === true && build.values != null;

  if (route == null || route.compiled !== true) return outcome(VERDICT.noCompile);
  if (route.values == null) return outcome(VERDICT.notObserved);
  if (!usable(reference)) return outcome(VERDICT.noReference);
  if (!usable(control)) return outcome(VERDICT.noControl);

  const read = (build, id) => build.values.components[id];

  // With no ids, `every` and `some` are both vacuous and the comparisons below
  // would report LIVE from measurements nobody took. The same goes for an id
  // whose reading is missing or empty in any of the three builds: `undefined`
  // equals `undefined`, and that is not agreement.
  const taken = (build, id) => typeof read(build, id) === 'string' && read(build, id) !== '';
  if (ids.length === 0) return outcome(VERDICT.notObserved);
  if (!ids.every((id) => [route, reference, control].every((build) => taken(build, id)))) {
    return outcome(VERDICT.notObserved);
  }

  // The route's own components first. Two chains onto one theme variable that
  // disagree is a finding of its own, and flattening it into "dead" would hide
  // which half moved.
  const mine = ids.map((id) => read(route, id));
  if (!mine.every((value) => value === mine[0])) return outcome(VERDICT.split);

  const equalsReference = ids.every((id) => read(route, id) === read(reference, id));
  const differsFromControl = ids.every((id) => read(route, id) !== read(control, id));

  // A control that equals the reference measures nothing, so a route sitting on
  // top of it cannot be called live whatever it computed.
  if (ids.some((id) => read(reference, id) === read(control, id))) return outcome(VERDICT.vacuous);

  if (equalsReference && differsFromControl) return outcome(VERDICT.live, true);
  return outcome(VERDICT.dead);
}

// ---------------------------------------------------------------------------
// The scratch application
// ---------------------------------------------------------------------------

/**
 * Create the throwaway Phoenix application under `tmpdir()` and pin it to what
 * `cs-tracker` runs. Returns the application directory plus every version it
 * observed and where it read it.
 */
function buildApplication(root) {
  say(`# scratch tree: ${root}`);

  // `ACCENT_LITERAL` is the one value in this file hand-copied out of the
  // contract, and every comparison in the run rests on it. Checked before the
  // generator runs, because a drift here would make both routes look dead for a
  // reason that has nothing to do with `var()`, and that is a wrong answer rather
  // than a failure.
  const tokens = readOrNull(join(CONTRACTS, 'tokens.css'));
  if (tokens === null) {
    throw new BlockedError(
      `no contracts/tokens.css at ${CONTRACTS}, so no variant could import the tokens and the literal ` +
        `reference could not be checked. This is the Block If condition.`
    );
  }
  const declaredAccent = firstMatch(tokens, /--c-accent:\s*([^;]+);/);
  if (declaredAccent !== ACCENT_LITERAL) {
    throw new BlockedError(
      `contracts/tokens.css declares --c-accent: ${declaredAccent ?? '(nothing this file could read)'}, not ` +
        `${ACCENT_LITERAL}. The literal reference would then measure a different colour from the one both ` +
        `routes resolve to, and every route would read as dead for a reason that has nothing to do with ` +
        `var(). Update ACCENT_LITERAL and re-record ops/daisyui-route.md from the new run.`
    );
  }

  const created = run(
    MIX,
    ['phx.new', APP, '--install', '--no-ecto', '--no-mailer', '--no-gettext', '--no-dashboard'],
    { cwd: root }
  );
  const appDir = join(root, APP);
  if (created.status !== 0 || !existsSync(join(appDir, 'mix.exs'))) {
    throw new BlockedError(
      `mix phx.new created no application, so no route can be observed. This is the Block If ` +
        `condition, not a result. The generator ${describeRun(created)}`
    );
  }

  // Pin the two asset toolchain versions BEFORE anything is compiled with them.
  const configPath = join(appDir, 'config', 'config.exs');
  const generated = readOrNull(configPath);
  if (generated === null) {
    throw new BlockedError(
      `the generated application carries no config/config.exs, so nothing can be pinned and no ` +
        `variant can compile. This is the Block If condition.`
    );
  }
  const generatedTailwind = firstMatch(generated, /config :tailwind,\s*\n\s*version: "([^"]+)"/);
  const generatedEsbuild = firstMatch(generated, /config :esbuild,\s*\n\s*version: "([^"]+)"/);
  const pinned = generated
    .replace(/(config :tailwind,\s*\n\s*version: ")[^"]+(")/, `$1${PINNED_TAILWIND}$2`)
    .replace(/(config :esbuild,\s*\n\s*version: ")[^"]+(")/, `$1${PINNED_ESBUILD}$2`);
  writeFileSync(configPath, pinned);

  const tailwindPinned = firstMatch(pinned, /config :tailwind,\s*\n\s*version: "([^"]+)"/);
  const esbuildPinned = firstMatch(pinned, /config :esbuild,\s*\n\s*version: "([^"]+)"/);
  if (tailwindPinned !== PINNED_TAILWIND || esbuildPinned !== PINNED_ESBUILD) {
    throw new BlockedError(
      `the generated config.exs did not take the pins: tailwind ${tailwindPinned}, esbuild ${esbuildPinned}. ` +
        'Nothing was compiled, because a run on an unpinned compiler answers a different question.'
    );
  }

  // The profile args the probe relies on, read rather than assumed.
  const profileArgs = firstMatch(pinned, /config :tailwind,[\s\S]*?args: ~w\(([\s\S]*?)\)/);

  // Force the pinned binary down. `--if-missing` would keep whatever `--install`
  // already fetched at the generator's own default version.
  const installed = run(MIX, ['tailwind.install'], { cwd: appDir });
  if (installed.status !== 0) {
    throw new BlockedError(
      `the pinned Tailwind binary could not be fetched, so no variant can compile. This is the ` +
        `Block If condition. mix tailwind.install ${describeRun(installed)}`
    );
  }

  const lockText = readOrNull(join(appDir, 'mix.lock'));
  const mixExsText = readOrNull(join(appDir, 'mix.exs'));
  const phoenixLocked = lockText === null ? null : firstMatch(lockText, /"phoenix": .*?"(\d+\.\d+\.\d+)"/);
  const phoenixRequired = mixExsText === null ? null : firstMatch(mixExsText, /\{:phoenix, "([^"]+)"/);

  // The Tailwind binary's own banner, so the pin is observed rather than trusted.
  const binary = findTailwindBinary(appDir);
  if (binary === null) {
    throw new BlockedError(
      `the pinned Tailwind binary was not found under ${join(appDir, '_build')} after ` +
        `mix tailwind.install reported success, so the compiler this run would use is unknown. ` +
        `This is the Block If condition.`
    );
  }
  const banner = firstMatch(run(binary, ['--help'], { cwd: appDir }).stdout, /(tailwindcss v[\d.]+)/);
  if (banner === null || !banner.endsWith(` v${PINNED_TAILWIND}`)) {
    throw new BlockedError(
      `the Tailwind binary reports ${banner ?? 'no version at all'}, not v${PINNED_TAILWIND}. The finding ` +
        `would be about a different toolchain from the one cs-tracker runs, so nothing was compiled.`
    );
  }

  // The two daisyUI bundles, verbatim from `cs-tracker`, so the finding is about
  // the version it runs.
  const vendor = join(appDir, 'assets', 'vendor');
  mkdirSync(vendor, { recursive: true });
  for (const bundle of ['daisyui.js', 'daisyui-theme.js']) {
    const source = join(CS_TRACKER, 'assets', 'vendor', bundle);
    if (!existsSync(source)) {
      throw new BlockedError(
        `cs-tracker does not carry assets/vendor/${bundle} at ${CS_TRACKER}, so the finding could not ` +
          `be about the daisyUI it runs. This is the Block If condition.`
      );
    }
    cpSync(source, join(vendor, bundle));
  }
  const daisyui = firstMatch(readFileSync(join(vendor, 'daisyui.js'), 'utf8'), /var version = "([^"]+)"/);
  if (daisyui !== PINNED_DAISYUI) {
    throw new BlockedError(
      `cs-tracker's vendored daisyUI reports ${daisyui ?? 'no version at all'}, not ${PINNED_DAISYUI}. The ` +
        `finding would be about a different toolchain, so nothing was compiled. If cs-tracker has ` +
        `legitimately moved, update PINNED_DAISYUI and re-record ops/daisyui-route.md from the new run.`
    );
  }

  // AD-14's fixed folder name, which is what a consumer vendors the contract as.
  cpSync(CONTRACTS, join(vendor, 'cuatro-contracts'), { recursive: true });

  // Planted before any compile, in an application source file no `@source` line
  // names, so every variant is measured on the same footing.
  writeFileSync(
    join(appDir, 'lib', 'source_detection_marker.ex'),
    `defmodule SourceDetectionMarker do\n  @moduledoc false\n  def marker, do: "${SOURCE_MARKER}"\nend\n`
  );

  // Every version read runs with `cwd` inside the scratch tree, like every other
  // spawn in this file. The BEAM writes an `erl_crash.dump` of several megabytes
  // into its working directory when it terminates during boot, and `elixir
  // --version` does terminate during boot under a shell with no console
  // attached. Observed 2026-08-25 dropping an 8.8 MB dump into the repository
  // root from a run made there by hand. `ERL_CRASH_DUMP` is redirected into the
  // scratch tree as well, so a dump from any working directory still leaves with
  // the tree.
  const inTree = { cwd: appDir };
  const elixirVersion = run('elixir', ['--version'], inTree).stdout;

  let playwright = null;
  try {
    playwright = require_('@playwright/test/package.json').version;
  } catch {
    playwright = null;
  }

  return {
    appDir,
    versions: {
      elixir: firstMatch(elixirVersion, /(Elixir [\d.]+)/),
      otp: firstMatch(elixirVersion, /(Erlang\/OTP \d+)/),
      phxNew: firstMatch(run(MIX, ['archive'], inTree).stdout, /(phx_new-[\d.]+)/),
      phoenixRequired,
      phoenixLocked,
      tailwindConfigured: tailwindPinned,
      tailwindGenerated: generatedTailwind,
      tailwindBanner: banner,
      esbuildConfigured: esbuildPinned,
      esbuildGenerated: generatedEsbuild,
      daisyui,
      profileArgs: profileArgs === null ? null : profileArgs.split(/\s+/).filter(Boolean).join(' '),
      playwright,
      node: process.version,
    },
  };
}

/** The pinned standalone Tailwind CLI the mix task downloaded, wherever it landed. */
function findTailwindBinary(appDir) {
  const stack = [join(appDir, '_build')];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!existsSync(current)) continue;
    // A directory that cannot be read is not a finding about the routes, and an
    // EACCES stack here would land instead of the named Block If below.
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.name.startsWith('tailwind-')) {
        return full;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Compiling
// ---------------------------------------------------------------------------

const OUTPUT_REL = join('priv', 'static', 'assets', 'css', 'app.css');

/**
 * Write one variant's `app.css` and its fixture, then compile through the
 * application's own `mix tailwind` profile.
 *
 * A non-zero exit is recorded as "does not compile" and returned. It is never
 * thrown, and never reported as a route that failed to resolve: the two are
 * different findings and this record keeps them apart.
 */
function compileVariant(appDir, variant) {
  const fixtureDir = join(appDir, 'fixture');
  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(join(appDir, 'assets', 'css', 'app.css'), appCss(variant));
  writeFileSync(join(fixtureDir, `${variant.name}.html`), fixtureHtml(variant));

  // Removed first, so a compile that writes nothing cannot be read as the
  // previous variant's output.
  const output = join(appDir, OUTPUT_REL);
  rmSync(output, { force: true });

  const compiled = run(MIX, ['tailwind', APP], { cwd: appDir });
  if (compiled.status !== 0 || !existsSync(output)) {
    // A zero exit with nothing at the expected path is a harness fault rather
    // than a stylesheet the CLI rejected, and the two read identically in a
    // transcript unless the difference is said out loud.
    const wroteNothing =
      compiled.status === 0 ? `\nThe CLI exited 0 and wrote no ${OUTPUT_REL}, so the asset profile's output path moved.` : '';
    return { compiled: false, error: `${describeRun(compiled).trim()}${wroteNothing}`, css: null, values: null };
  }
  const css = readFileSync(output, 'utf8');
  writeFileSync(join(fixtureDir, `${variant.name}.css`), css);
  return { compiled: true, error: null, css, values: null };
}

// ---------------------------------------------------------------------------
// Serving and reading
// ---------------------------------------------------------------------------

function serve(root) {
  return new Promise((done, fail) => {
    const server = createServer((request, response) => {
      // A throw inside a request handler takes the whole process down with an
      // uncaught exception, which would land on top of whatever the probe was
      // actually reporting.
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
    // Without this the promise never settles when `listen` fails and the probe
    // hangs with nothing in the log explaining why.
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => done(server));
  });
}

/** Every `--color-*` custom property name declared anywhere in a compiled stylesheet. */
export function declaredColourNames(css) {
  const names = new Set();
  if (typeof css !== 'string') return names;
  for (const match of css.matchAll(/(--color-[A-Za-z0-9_-]+)\s*:/g)) names.add(match[1]);
  return names;
}

/**
 * Every distinct value a compiled stylesheet declares for `property`, in the
 * order they first appear.
 *
 * This reads the compiler's own output rather than daisyUI's or Tailwind's
 * source, and it explains a result rather than carrying one: a `var()` still
 * standing in the emitted declaration is why the browser could resolve it, and
 * it is also what tells Story 1.19 whether the reference survives to run time or
 * was flattened at build time.
 */
export function emittedValues(css, property) {
  const values = new Set();
  if (typeof css !== 'string') return [];
  // Escaped, because an unescaped property name would be read as a pattern; and
  // preceded by a boundary, so a longer custom property that merely ends in the
  // requested name cannot contribute its value to this list.
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

  say('# daisyUI adoption route probe, Story 1-15, AD-15 open item O-3');
  say(`# started ${new Date(startedAt).toISOString()}`);
  say('');

  // The leftover sweep is exercised on every run rather than only after a
  // crash: a directory is planted under the scratch prefix, the sweep runs, and
  // its absence afterwards is the assertion. The name carries this process id
  // and the clock, so a second probe running at the same moment plants its own
  // rather than colliding on one name.
  //
  // The sweep itself still runs over the shared `tmpdir()`, because that is
  // where real leftovers are, so a concurrent probe's sweep may remove this
  // directory first. **Gone is the assertion, not who removed it.** Requiring
  // this run's own `swept` list to name it would fail the case on two healthy
  // concurrent runs and print the opposite of what happened.
  const planted = join(tmpdir(), `${SCRATCH_PREFIX}planted-${process.pid}-${startedAt}`);
  rmSync(planted, { recursive: true, force: true });
  mkdirSync(planted, { recursive: true });
  writeFileSync(join(planted, 'leftover.txt'), 'planted by the probe to exercise the sweep\n');
  // Claimed by a marker naming no process at all, so the claim grace that
  // protects a concurrent run's freshly created root does not also protect this
  // one and the case still asserts a real removal.
  writeFileSync(join(planted, ACTIVE_MARKER), JSON.stringify({ pid: null, planted: true, startedAt }));
  const { swept, skipped, failed } = sweepLeftovers();
  const plantedGone = !existsSync(planted);
  // The story's matrix says a leftover that survives the sweep fails the case,
  // and a tree the sweep could not remove is exactly that. It is reported rather
  // than thrown so it cannot take the run down before the first variant has
  // compiled, but reporting is not the same as passing.
  const sweepWorked = plantedGone && failed.length === 0;
  record(
    'Leftover sweep',
    sweepWorked,
    (plantedGone
      ? `${swept.length} scratch director${swept.length === 1 ? 'y' : 'ies'} swept, and the planted one is gone` +
        `${swept.includes(planted) ? ', this sweep having removed it' : ", removed by a concurrent run's sweep"}` +
        `${skipped.length === 0 ? '' : `, ${skipped.length} left alone as belonging to a live run`}`
      : `the planted directory ${planted} survived the sweep`) +
      `${failed.length === 0 ? '' : `. ${failed.length} leftover${failed.length === 1 ? '' : 's'} would NOT be removed: ${failed.map((entry) => `${entry.target} (${entry.reason})`).join('; ')}`}`
  );
  if (!sweepWorked) {
    // The one path on which nothing else removes it is the path this case exists
    // to catch, and this file's promise is that it leaves nothing behind.
    try {
      rmSync(planted, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch (error) {
      say(`#   the planted directory could not be removed either: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const root = realpathSync(mkdtempSync(join(tmpdir(), SCRATCH_PREFIX)));

  let server = null;
  let browser = null;
  // Set in the `finally`. AC4 promises no directory of the scratch application
  // remains on disk, and a promise nothing can fail is not one: a tree that
  // survived removal makes the run non-zero rather than leaving it exiting 0
  // with a full Phoenix tree, `deps/` and `_build/` still there.
  let leaked = false;

  // The `try` opens on the statement after the root exists, so every path out of
  // here reaches the `finally` that removes it. A claim or an environment write
  // that threw above this line would have leaked the whole tree.
  try {
    // Claimed immediately, so a concurrent run's sweep leaves this tree alone.
    writeFileSync(join(root, ACTIVE_MARKER), JSON.stringify({ pid: process.pid, startedAt }));

    // Set before the first BEAM starts, and inherited by every child. A crash
    // during boot writes a dump of several megabytes into the working directory
    // otherwise, and this file's promise is that nothing outside the scratch tree
    // is created.
    process.env.ERL_CRASH_DUMP = join(root, 'erl_crash.dump');

    const { appDir, versions } = buildApplication(root);

    say('');
    say('# versions');
    for (const [key, value] of Object.entries(versions)) say(`  ${key.padEnd(20)} ${value ?? '(not read)'}`);
    say('');

    const all = [...VARIANTS, COMPOSITION];
    const builds = new Map();
    for (const variant of all) {
      const built = compileVariant(appDir, variant);
      builds.set(variant.name, built);
      say(`# compile ${variant.name.padEnd(12)} ${built.compiled ? 'ok' : 'FAILED TO COMPILE'}`);
      if (!built.compiled) {
        say(
          built.error
            .split('\n')
            .map((line) => `    | ${line}`)
            .join('\n')
        );
      }
    }
    say('');

    // Faces for the composition variant's own `@font-face` urls, which are
    // relative to wherever the compiled file lands. This is the second of the
    // two routes `ops/tailwind-adapter.md:176-178` names for a consumer that
    // does not compile into the vendored folder: copy `fonts/` beside the
    // output. The probe uses it rather than working around a blocker.
    const fixtureDir = join(appDir, 'fixture');
    if (existsSync(join(CONTRACTS, 'fonts'))) {
      cpSync(join(CONTRACTS, 'fonts'), join(fixtureDir, 'fonts'), { recursive: true });
    }

    server = await serve(fixtureDir);
    const address = server.address();
    if (!address || typeof address === 'string') throw new BlockedError('the scratch server reported no port');
    const origin = `http://127.0.0.1:${address.port}`;

    let chromium;
    try {
      ({ chromium } = require_('@playwright/test'));
    } catch (error) {
      throw new BlockedError(
        `@playwright/test could not be loaded from this repository's node_modules, so no computed value ` +
          `can be read and the whole content of this story is that reading. Run corepack pnpm install. ` +
          `This is the Block If condition. ${error instanceof Error ? error.message : String(error)}`
      );
    }
    try {
      browser = await chromium.launch();
    } catch (error) {
      throw new BlockedError(
        `no Chromium could be launched, so no route can be observed. This is the Block If condition. ` +
          `Run corepack pnpm exec playwright install chromium. ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
    }
    const page = await browser.newPage();

    for (const variant of all) {
      const build = builds.get(variant.name);
      if (!build.compiled) continue;
      const response = await page.goto(`${origin}/${variant.name}.html`, { waitUntil: 'load' });
      if (response === null || response.status() !== 200) {
        throw new BlockedError(
          `the fixture page for ${variant.name} answered ${response?.status() ?? 'nothing'}, so the ` +
            `harness itself is broken and no value it read could be trusted.`
        );
      }
      build.values = await page.evaluate(
        (ids) => {
          const read = (id) => {
            const element = document.querySelector(`[data-component="${id}"]`);
            if (element === null) throw new Error(`the fixture carries no [data-component="${id}"]`);
            return window.getComputedStyle(element).getPropertyValue('background-color').trim();
          };
          const rootStyle = window.getComputedStyle(document.documentElement);
          return {
            components: Object.fromEntries(ids.verdict.map((id) => [id, read(id)])),
            diagnostics: Object.fromEntries(ids.diagnostic.map((id) => [id, read(id)])),
            token: read('token'),
            // Diagnostics, and a diagnostic never carries the verdict. They say
            // which declaration won and whether the var() chain resolved.
            raw: rootStyle.getPropertyValue('--color-primary').trim(),
            rawAccent: rootStyle.getPropertyValue('--color-accent').trim(),
          };
        },
        {
          verdict: COMPONENT_IDS,
          diagnostic: DIAGNOSTIC_ELEMENTS.map((element) => element.id),
        }
      );
    }

    const chromiumVersion = browser.version();
    const build = (name) => builds.get(name);
    const valuesOf = (name) => builds.get(name).values;

    // Every reported figure is read through `COMPONENT_IDS`, the same set the
    // verdict is computed over. Naming `btn` and `badge` by hand here would let
    // a renamed or added component leave the verdict correct while printing
    // `undefined` into a transcript that gets quoted verbatim into the record.
    const listOf = (values) =>
      values === null ? '(not read)' : COMPONENT_IDS.map((id) => values.components[id]).join(' and ');
    const firstOf = (values) => (values === null ? '(none)' : values.components[COMPONENT_IDS[0]]);

    // ---- the table -------------------------------------------------------
    say('# computed background-color, read in Chromium');
    say(`  ${'variant'.padEnd(12)} ${'role'.padEnd(15)} ${'component'.padEnd(10)} computed background-color`);
    for (const variant of all) {
      const values = valuesOf(variant.name);
      for (const component of COMPONENTS) {
        const value = values === null ? '(did not compile)' : values.components[component.id];
        say(`  ${variant.name.padEnd(12)} ${variant.role.padEnd(15)} ${component.id.padEnd(10)} ${value}`);
      }
    }
    say('');
    say('# diagnostics, which never carry a verdict');
    for (const variant of all) {
      const current = build(variant.name);
      const values = current.values;
      if (values === null) {
        say(`  ${variant.name.padEnd(12)} (did not compile)`);
        continue;
      }
      const pad = ''.padEnd(12);
      say(`  ${variant.name.padEnd(12)} --color-primary raw on <html>          = ${values.raw || '(empty)'}`);
      say(`  ${pad} --color-accent raw on <html>           = ${values.rawAccent || '(empty)'}`);
      say(`  ${pad} var(--token-accent) declared inline    = ${values.token}`);
      say(`  ${pad} .btn.btn-accent background-color       = ${values.diagnostics.accent}`);
      say(`  ${pad} .bg-accent background-color            = ${values.diagnostics['bg-accent']}`);
      say(
        `  ${pad} --color-primary as EMITTED by the CLI  = ${emittedValues(current.css, '--color-primary').join(' | ')}`
      );
      say(
        `  ${pad} automatic source detection minted ${SOURCE_MARKER} = ` +
          `${current.css.includes(SOURCE_MARKER_SELECTOR) ? 'YES' : 'no'}`
      );
      say(`  ${pad} Preflight emitted                      = ${preflightCount(current.css)} time(s)`);
      say(`  ${pad} compiled bytes                         = ${Buffer.byteLength(current.css, 'utf8')}`);
    }
    say('');

    // ---- the named cases -------------------------------------------------
    const unmapped = build('unmapped');
    const literal = build('literal');

    // `literal` first: it is the reference every other case is read against, so
    // a broken harness has to be visible before any verdict is reported.
    const literalPainted =
      literal.values !== null &&
      COMPONENT_IDS.every(
        (id) => literal.values.components[id] !== UNPAINTED && literal.values.components[id] !== ''
      ) &&
      literal.values.token !== UNPAINTED;
    const literalMatchesToken =
      literal.values !== null && COMPONENT_IDS.every((id) => literal.values.components[id] === literal.values.token);
    record(
      'literal reference',
      literal.compiled && literalPainted && literalMatchesToken,
      literal.values === null
        ? `the reference build did not compile, so the harness itself is broken: ${literal.error}`
        : `both components computed ${listOf(literal.values)}, ` +
          `against var(--token-accent) declared inline computing ${literal.values.token}`
    );

    const controlDiffers =
      unmapped.values !== null &&
      literal.values !== null &&
      COMPONENT_IDS.every((id) => unmapped.values.components[id] !== literal.values.components[id]);
    record(
      'unmapped control',
      unmapped.compiled &&
        unmapped.values !== null &&
        COMPONENT_IDS.every(
          (id) => unmapped.values.components[id] !== UNPAINTED && unmapped.values.components[id] !== ''
        ) &&
        controlDiffers,
      unmapped.values === null
        ? `the control build did not compile: ${unmapped.error}`
        : `both components computed ${listOf(unmapped.values)}, ` +
          // A literal build that was never read is not a control that equals it.
          // Reporting the second for the first is the conflation this file keeps
          // out of every other case.
          `${
            literal.values === null
              ? 'and the literal build was never read, so there was nothing to compare it against'
              : controlDiffers
                ? 'differing from literal as a control must'
                : 'which EQUALS literal, so the fixture is not measuring the mapping'
          }`
    );

    const routes = [
      { name: 'plugin-var', label: 'plugin-var, route A' },
      { name: 'css-var', label: 'css-var, route B' },
    ].map((route) => ({ ...route, ...routeVerdict(build(route.name), literal, unmapped) }));

    for (const route of routes) {
      const current = build(route.name);
      const detail =
        route.verdict === VERDICT.noCompile
          ? `does not compile, which is not the same finding as does not resolve. The CLI ` +
            `${current.error.replace(/\s+/g, ' ').slice(0, 400)}`
          : current.values === null
            ? `${route.verdict}, so nothing was read for it`
            : `${route.verdict}: components computed ${listOf(current.values)}, against literal ` +
              `${firstOf(literal.values)} and unmapped ${firstOf(unmapped.values)}`;
      // Only LIVE passes. See `routeVerdict`.
      record(route.label, route.pass, detail);
    }

    const live = routes.filter((route) => route.live);
    const routeA = build('plugin-var');
    const routeB = build('css-var');
    const bothRead = routeA.values !== null && routeB.values !== null;
    const sameRendered =
      bothRead && COMPONENT_IDS.every((id) => routeA.values.components[id] === routeB.values.components[id]);
    // A route that was never read did not render differently from the other one.
    // The comparison is unmade, and saying "do NOT produce the same rendered
    // result" for it would answer one of AC2's clauses with something nobody
    // measured.
    const renderedClause = bothRead
      ? `The two routes ${sameRendered ? 'produce the same rendered result' : 'do NOT produce the same rendered result'}.`
      : 'Whether the two routes produce the same rendered result was NOT measured, because at least one of ' +
        'them was never read.';
    // "Neither route is live" means AD-15's Block If only when the harness
    // itself was sound. An unusable reference or control is a broken harness,
    // and reporting it as the Operator's decision would be the same conflation
    // `routeVerdict` names apart.
    const unusable = routes.filter((route) =>
      [VERDICT.noReference, VERDICT.noControl, VERDICT.vacuous].includes(route.verdict)
    );
    record(
      'Verdict',
      live.length > 0,
      live.length === 0
        ? unusable.length > 0
          ? `no verdict: ${unusable.map((route) => `${route.label} reported "${route.verdict}"`).join(', ')}. ` +
            'That is the harness being unusable, not AD-15 having no route, so nothing here is the ' +
            'Block If condition and nothing here answers O-3.'
          : 'NEITHER route computed equal to literal. AD-15 assumes at least one path works, so this ' +
            'is the Block If condition and the Operator owns the decision, not this probe.'
        : `${live.map((route) => route.label).join(' and ')} ${live.length === 1 ? 'is' : 'are'} live. ` +
          renderedClause
    );

    // ---- composition -----------------------------------------------------
    const composition = build('composition');
    const adapterColours = declaredColourNames(
      (readOrNull(join(CONTRACTS, 'tailwind.css')) ?? '').replace(/@import[^;]*;/g, '')
    );
    const daisyColours = literal.compiled ? declaredColourNames(literal.css) : new Set();
    const overlap = [...adapterColours].filter((name) => daisyColours.has(name)).sort();
    // Comparable only when both sides were actually read. A composition build
    // measured against a reference that does not exist has not stopped
    // resolving; nobody asked it the question. Reporting the second as the first
    // is the conflation the story's Never clause forbids, and the route cases
    // already name it apart through `no reference`.
    const compositionComparable = composition.values !== null && literal.values !== null;
    const compositionCarriesRoute =
      compositionComparable &&
      COMPONENT_IDS.every((id) => composition.values.components[id] === literal.values.components[id]);
    record(
      'Composition',
      // A compile failure is an observation this case reports and never a
      // blocked story, which is what the story's I/O matrix says, and neither is
      // an unusable reference. What is NOT allowed is a compiled build, read
      // against a real reference, whose route silently stopped resolving.
      composition.compiled ? !compositionComparable || compositionCarriesRoute : true,
      composition.compiled
        ? `cuatro-contracts/tailwind.css compiles beside daisyUI in one app.css, and route A ` +
          `${
            !compositionComparable
              ? 'could not be compared there, because the literal reference build was never read'
              : compositionCarriesRoute
                ? 'still resolves'
                : 'STOPPED resolving'
          } there: its components computed ` +
          `${listOf(composition.values)} against literal ` +
          `${firstOf(literal.values)}. ` +
          `${overlap.length} --color-* name${overlap.length === 1 ? ' is' : 's are'} owned by both: ` +
          `${overlap.join(', ') || 'none'}. ` +
          `On the collided name, .btn.btn-accent computed ${composition.values?.diagnostics.accent ?? '(not read)'} ` +
          `here against ${literal.values?.diagnostics.accent ?? '(not read)'} in a daisyUI only build, and the ` +
          `adapter utility .bg-accent computed ${composition.values?.diagnostics['bg-accent'] ?? '(not read)'} ` +
          `here against ${literal.values?.diagnostics['bg-accent'] ?? '(not read)'} there. ` +
          `The adapter's own bare @import "tailwindcss" ` +
          `${composition.css.includes(SOURCE_MARKER_SELECTOR) ? 'DID' : 'did not'} re-enable automatic ` +
          `source detection, and Preflight was emitted ${preflightCount(composition.css)} time(s) against ` +
          `${preflightCount(literal.css)} in a daisyUI only build.`
        : `cuatro-contracts/tailwind.css does NOT compile beside daisyUI in one app.css, which is an ` +
          `observation for Story 1.19 and not a blocked story. The CLI ` +
          `${composition.error.replace(/\s+/g, ' ').slice(0, 600)}`
    );

    say('');
    say(`# chromium ${chromiumVersion}`);
    say(`# adapter --color-* names: ${[...adapterColours].sort().join(', ')}`);
    say(`# overlap with daisyUI: ${overlap.join(', ') || 'none'}`);
    say('');
    say('# the app.css fragment each route corresponds to');
    for (const variant of VARIANTS) {
      say(`  ${variant.name}: ${variant.what}`);
    }
    say('');
  } finally {
    if (browser !== null) await browser.close().catch(() => undefined);
    if (server !== null) {
      try {
        server.closeAllConnections();
        await new Promise((done) => server.close(() => done()));
      } catch {
        // A server that will not close cleanly must not mask the real failure,
        // and must not stop the scratch tree being removed below.
      }
    }
    // Removed on failure as well as on success. The scratch application is never
    // committed and never left behind. A locked file under `_build` is reported
    // rather than thrown, so it neither hides the real error nor leaves the
    // reader thinking the tree is gone.
    let removalError = null;
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch (error) {
      removalError = error instanceof Error ? error.message : String(error);
    }
    const stillThere = existsSync(root);
    leaked = stillThere;
    say(`# scratch tree removed: ${root} (exists afterwards: ${stillThere})`);
    if (removalError !== null) {
      say(`#   removal reported: ${removalError}. Remove it by hand: the next run sweeps it anyway.`);
    }
    if (stillThere) {
      say(
        `# FAILURE: the scratch application survived removal, so this run leaves a Phoenix tree behind ` +
          `and exits non-zero. It is not one of the story's named cases, and it is not a finding about ` +
          `the routes.`
      );
    }

    // The summary lives here rather than after the block, so a Block If
    // condition escaping mid run still ends the transcript with how far the run
    // got. The transcript is this file's entire deliverable and it gets quoted
    // verbatim; a run that stopped early must not simply trail off.
    const unfinished = cases.filter((entry) => !entry.pass);
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    say('');
    say(`# ${cases.length} cases, ${cases.length - unfinished.length} PASS, ${unfinished.length} FAIL`);
    say(`# elapsed ${elapsed}s`);
    say(`# finished ${new Date().toISOString()}`);
  }

  return cases.every((entry) => entry.pass) && !leaked;
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
  // shell redirection and a CI log both give this process, `process.exit` can
  // cut the transcript off mid flush, and this probe's entire value is a
  // transcript quoted verbatim into `ops/daisyui-route.md`. Story 1-14 learned
  // the same thing about `ops/capacity-gate.mjs`.
  probe().then(
    (ok) => {
      process.exitCode = ok ? 0 : 1;
    },
    (error) => {
      const blocked = error instanceof BlockedError;
      const text = blocked ? error.message : error instanceof Error ? error.stack : String(error);
      // Also on stdout, because the record's reproducibility method is a
      // captured stdout transcript. A blocked run whose only explanation went to
      // stderr would end at the summary and simply trail off, which is the very
      // thing that moved the summary into the `finally`.
      say(`# ${blocked ? 'BLOCKED' : 'PROBE DEFECT'}: ${text}`);
      process.stderr.write(`daisyui-route-probe: ${text}\n`);
      // Three exit codes, because "a route stopped resolving" and "no Chromium
      // on this host" are different answers and the record tells the Operator
      // that a non-zero exit is the whole regression check.
      //   1  a named case failed, or the scratch tree survived removal
      //   2  a defect in this file
      //   3  a Block If condition: nothing could be observed
      process.exitCode = blocked ? 3 : 2;
    }
  );
}
