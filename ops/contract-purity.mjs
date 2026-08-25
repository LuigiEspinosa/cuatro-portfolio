// The `contracts/` purity check (AD-1). The `contract-purity` job in
// `.github/workflows/ci.yml` runs this on every push and on every pull request
// to `main`.
//
// AD-1 makes `contracts/` the published surface: a contract is an artifact a
// consumer in any estate language uses without executing Anchor-authored code,
// so CI fails if any file under it matches `\.(ts|js|tsx|jsx|mjs|cjs)$`.
// Generators live in `packages/` and are never published. AD-21 makes the
// failure blocking rather than a warning, because there is one environment and
// no staging, so nothing downstream catches what this lets through.
//
// This file has no dependencies, deliberately, and imports only `node:`
// builtins. The job that runs it installs nothing, so the boundary is still
// reported on the run where `pnpm install --frozen-lockfile` fails, which is
// the run where a hurried fix is most likely to reach for the published folder.
//
// **Nothing redirects this check at runtime.** No environment variable and no
// argument selects the directory it opens; the surface is fixed in the source
// and resolved beside this module. `ci.yml` had to pin two build inputs empty
// on the `tokens-contract` job to close exactly that hole for the drift gate,
// and a redirectable purity gate has a worse version of it: a check that reads
// a directory nobody published is green over anything.
//
// `inspect` does take an injected directory reader, and that is a different
// thing: it decides how a directory is listed, never which directory is read.
// It exists because two of the refusals below cannot be constructed portably on
// both a Windows authoring host and a Linux runner, and a refusal with no
// standing case is a refusal that quietly stops working. It follows the
// `main(argv, readFile = readFileSync)` precedent in `ops/capacity-gate.mjs`.
// The CI path passes no reader, and five standing cases run the real binary.
//
// Five of its refusals are stricter than AD-1's regular expression, and each is
// recorded with its reason in `ops/contract-purity.md`. AD-1 fixes a lower
// bound, so a check may refuse more but never less, and none of the five can
// turn a violation into a pass.

import { lstatSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// One source of truth for the surface. `SURFACE_DIRECTORY` is what the process
// actually opens, resolved beside this module so the checker works from any
// working directory; `SURFACE` is what every message says. Deriving one from
// the other means a move cannot leave the message naming a folder that was
// never read. Exported so a test can assert the message still names them: a
// refusal that quietly stops naming the path is how an operator ends up
// guessing at what to fix.
const SURFACE_DIRECTORY = 'contracts';
export const SURFACE = `${SURFACE_DIRECTORY}/`;

// Where a generator belongs instead. Named in every refusal, because "this file
// may not be here" without "and here is where it goes" is half an instruction.
export const GENERATOR_HOME = 'packages/';

// The six extensions AD-1 names, and AD-1's own pattern built from them, kept
// as text so the refusal can quote the rule it is enforcing rather than
// paraphrase it.
const AD1_EXTENSIONS = ['ts', 'js', 'tsx', 'jsx', 'mjs', 'cjs'];
const patternFor = (/** @type {string[]} */ extensions) => String.raw`\.(${extensions.join('|')})$`;
export const RULE = patternFor(AD1_EXTENSIONS);

// The two TypeScript module extensions AD-1 does not name. `tsconfig.json:34-41`
// puts `**/*.mts` in this repository's own program, and Node executes both
// directly, so a `contracts/build.mts` is exactly the artifact AD-1 exists to
// keep out of the published surface while its literal pattern reads the name as
// a novel extension and lets it through. Third refusal stricter than AD-1.
const ALSO_EXECUTABLE = ['mts', 'cts'];

// The applied rule, built from the same list the quoted one is built from
// rather than written out a second time, so the two can never disagree while
// every message claims the applied rule contains the quoted one. The `i` flag
// is the first refusal stricter than AD-1's literal pattern: a case-insensitive
// checkout on macOS or on Windows serves `probe.TS` to a bundler as TypeScript,
// while the literal expression reads it as a novel extension and lets it
// through.
export const EXECUTABLE = new RegExp(patternFor([...AD1_EXTENSIONS, ...ALSO_EXECUTABLE]), 'i');

// AD-1's own six, applied the same way. Only used to word a refusal honestly:
// a finding may say it matches AD-1's expression only when it does.
const AD1_EXECUTABLE = new RegExp(RULE, 'i');

// Win32 strips trailing dots and spaces from a file name, so a checkout there
// serves `probe.ts.` as `probe.ts`. The rule is therefore applied to what the
// name resolves to, not only to what it is written as. Second refusal stricter
// than AD-1, on the same lower-bound argument as the `i` flag.
const WIN32_TRAILING = /[. ]+$/;

/**
 * This file is not typechecked (`tsconfig.json` includes `.ts` and `.mts`, not
 * `.mjs`), so these annotations exist for the test, which is typechecked and is
 * where the contract is asserted.
 *
 * `path` is always relative to the surface root and always uses forward
 * slashes, so a Windows checkout and an Ubuntu runner print the same string.
 * The surface root itself carries the empty path.
 *
 * `executable` says whether a finding is the extension rule firing, as opposed
 * to a link, an entry that is not a file, or a directory that would not list.
 * The remedy differs: only an executable file is something to move under
 * `packages/`, and a refusal that told an operator to move an unreadable
 * directory there would be an instruction they cannot follow.
 *
 * `read` says the surface root was opened and is a real directory. It does not
 * promise every directory beneath it was listed: one that would not list is a
 * finding rather than a failure to read, because naming the path is more use to
 * an operator than saying the surface was unreadable.
 *
 * @typedef {{ name: string, isSymbolicLink(): boolean, isDirectory(): boolean, isFile(): boolean }} Entry
 * @typedef {(directory: string) => Entry[]} ReadDirectory
 * @typedef {{ path: string, reason: string, executable: boolean }} Finding
 * @typedef {{ read: boolean, error: string | null, files: string[], findings: Finding[] }} Inspection
 * @typedef {{ ok: boolean, message: string }} Result
 */

/** @type {ReadDirectory} */
const readDirectory = (directory) => readdirSync(directory, { withFileTypes: true });

const code = (/** @type {unknown} */ error) => {
  // The `code` rather than the `message`: an ENOENT message carries the
  // absolute path it tried, which differs between a Windows checkout and a
  // runner, and the whole point of the path handling here is that both print
  // the same string.
  if (error instanceof Error && typeof (/** @type {{ code?: unknown }} */ (error).code) === 'string') {
    return String(/** @type {{ code?: unknown }} */ (error).code);
  }
  return error instanceof Error ? error.message : String(error);
};

// The code points that are escaped on top of the C0 range and DEL. U+2028 and
// U+2029 are line terminators to a JavaScript reader and to some log viewers,
// so they forge a line the same way a newline does. U+200E to U+202E and U+2066
// to U+2069 are the bidirectional overrides and isolates: they reorder how a
// name is drawn without changing what it is, which is how `probe.ts` gets drawn
// as something that does not look executable at all.
const FORGES_A_LINE = new Set([0x2028, 0x2029]);
const REORDERS_TEXT = (/** @type {number} */ point) =>
  (point >= 0x200e && point <= 0x200f) ||
  (point >= 0x202a && point <= 0x202e) ||
  (point >= 0x2066 && point <= 0x2069);

// U+0080 to U+009F are the C1 controls. A terminal reads several of them as
// escape sequence introducers, so a name carrying one forges or rewrites a line
// the same way the C0 range one block up does, and none of them is caught by a
// test that only knows about code points under 32.
const IS_A_CONTROL = (/** @type {number} */ point) => point >= 0x80 && point <= 0x9f;

// The code points that are drawn as nothing at all: the soft hyphen, the Arabic
// letter mark, the zero width space, non-joiner and joiner, and the byte order
// mark. None of them changes what a name is and every one of them lets two
// different published paths be drawn identically in an operator's log, which is
// the same disguise the bidirectional overrides make by another route.
const DRAWS_AS_NOTHING = new Set([0x00ad, 0x061c, 0x200b, 0x200c, 0x200d, 0xfeff]);

/**
 * A path as it is safe to print. A name carrying a newline would otherwise
 * forge extra lines in a refusal and could push the real offender out of an
 * operator's view, or fake a line that looks like this checker's own prose. A
 * name carrying a bidirectional override would be drawn as a different name
 * than the one the walk found.
 *
 * The escaping is injective, which is the property that makes it worth having:
 * a backslash is escaped too, so a name written with a literal backslash and an
 * `n` cannot print as the same string as a name carrying a real newline. Any
 * path with no backslash and no escaped code point, which is every path a
 * consumer would ever publish, is returned unchanged byte for byte.
 *
 * @param {string} text
 */
const printable = (text) =>
  [...text]
    .map((character) => {
      // Compared as a code point rather than matched by a character class, so
      // no control character has to be written into this source file to
      // describe one.
      const point = character.codePointAt(0) ?? 0;
      if (character === '\\') return String.raw`\\`;
      if (
        point > 31 &&
        point !== 127 &&
        !IS_A_CONTROL(point) &&
        !DRAWS_AS_NOTHING.has(point) &&
        !FORGES_A_LINE.has(point) &&
        !REORDERS_TEXT(point)
      ) {
        return character;
      }
      if (character === '\n') return String.raw`\n`;
      if (character === '\r') return String.raw`\r`;
      if (character === '\t') return String.raw`\t`;
      const width = point > 0xff ? 4 : 2;
      return `\\${width === 4 ? 'u' : 'x'}${point.toString(16).padStart(width, '0')}`;
    })
    .join('');

/**
 * @param {string} directory
 * @param {string} prefix
 * @param {string[]} files
 * @param {Finding[]} findings
 * @param {ReadDirectory} read
 */
function walk(directory, prefix, files, findings, read) {
  let entries;
  try {
    entries = read(directory);
  } catch (error) {
    // A directory that cannot be listed is a refusal, not a silent zero.
    // Whatever is inside it is published and unread, which is the same failure
    // the empty-surface refusal exists for, one level down.
    findings.push({
      path: prefix === '' ? '' : prefix.slice(0, -1),
      // The error text is escaped here rather than where the message is built.
      // It is the one part of a reason that does not come from this file: an
      // error with no `code` falls back to its own message, which can carry a
      // newline and forge a line in the refusal exactly as a path can. The rest
      // of every reason is this module's own prose and quotes `RULE`, whose
      // backslash must reach an operator as itself.
      reason: `a directory that could not be listed (${printable(code(error))}), so what it publishes was never read`,
      executable: false,
    });
    return;
  }

  for (const entry of entries) {
    const path = `${prefix}${entry.name}`;
    const full = join(directory, entry.name);

    // The reader reports the entry itself rather than what it points at, so the
    // walk never follows a link. The fourth refusal stricter than AD-1: a link
    // named `data.css` pointing at `packages/tokens/build.mjs` publishes
    // executable code the extension rule cannot see, and the folder is vendored
    // by copy into seven repositories (AD-16), where a link resolves to
    // something else or to nothing.
    if (entry.isSymbolicLink()) {
      findings.push({
        path,
        reason: 'a link, so what it publishes is decided outside this folder and a vendored copy resolves elsewhere or nowhere',
        executable: false,
      });
      continue;
    }

    if (entry.isDirectory()) {
      walk(full, `${path}/`, files, findings, read);
      continue;
    }

    if (!entry.isFile()) {
      findings.push({
        path,
        reason: 'neither a file nor a directory, so it is not something a consumer can read and parse',
        executable: false,
      });
      continue;
    }

    files.push(path);

    const served = entry.name.replace(WIN32_TRAILING, '');
    if (EXECUTABLE.test(served)) {
      // Which of the two patterns fired decides what the refusal may claim. A
      // `.mts` is executable code and is refused, but saying it matches AD-1's
      // expression would be a quotation of a rule that does not name it.
      const rule = AD1_EXECUTABLE.test(served)
        ? `matching AD-1's ${RULE}`
        : `an extension AD-1's ${RULE} does not name, refused because Node runs it directly`;
      findings.push({
        path,
        reason:
          served === entry.name
            ? `executable code, ${rule}`
            : `executable code once a Win32 checkout strips the trailing dot or space from its name, ${rule}`,
        executable: true,
      });
    }
  }
}

/**
 * Walk `directory` and report what is under it. Returns findings rather than
 * throwing or exiting, so the tests exercise the same code path the CI job
 * runs.
 *
 * The walk is recursive, does not follow links, and collects every offender
 * rather than stopping at the first: a run that names one of three paths costs
 * three CI runs to clear.
 *
 * `read` lists one directory and defaults to the real one. It is how the two
 * refusals that no portable filesystem call can produce on both hosts get a
 * standing case. It selects no directory: the path this process opens comes
 * from `main` and from nowhere else.
 *
 * @param {string} directory
 * @param {ReadDirectory} [read]
 * @returns {Inspection}
 */
export function inspect(directory, read = readDirectory) {
  let stats;
  try {
    // `lstat`, not `stat`, and the path carries no trailing separator. On a
    // POSIX filesystem a trailing slash forces resolution of the final
    // component, so `lstat("contracts/")` reports the target of a linked
    // surface root and the refusal below could never fire on the runner.
    stats = lstatSync(directory);
  } catch (error) {
    return { read: false, error: code(error), files: [], findings: [] };
  }

  if (stats.isSymbolicLink()) {
    return { read: false, error: 'it is a link, and the published surface must be the committed directory', files: [], findings: [] };
  }
  if (!stats.isDirectory()) {
    return { read: false, error: 'it is not a directory', files: [], findings: [] };
  }

  /** @type {string[]} */
  const files = [];
  /** @type {Finding[]} */
  const findings = [];
  walk(directory, '', files, findings, read);

  // Sorted, because `readdir` order is a property of the filesystem and a
  // failure message that reorders itself between two runs of the same tree is
  // one an operator cannot diff.
  files.sort();
  findings.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return { read: true, error: null, files, findings };
}

const AD1 = [
  `  AD-1: ${SURFACE} is the published surface. A contract is an artifact a consumer in any`,
  '  estate language uses without executing Anchor-authored code, so CI fails on any file',
  `  under ${SURFACE} matching ${RULE}. Generators live in ${GENERATOR_HOME}, which is`,
  '  never published.',
];

/** @param {string[]} detail */
const refusal = (detail) => ['contract purity: REFUSED', ...AD1, ...detail].join('\n');

/**
 * Turn an inspection into the operator's message and the process's verdict.
 *
 * The surface label is this module's own constant rather than a parameter, so
 * a scratch tree in a test produces the exact string a runner would print for
 * the real folder, and no test can pass against a message shape the job never
 * emits.
 *
 * @param {Inspection} inspection
 * @returns {Result}
 */
export function report(inspection) {
  if (!inspection.read) {
    return {
      ok: false,
      message: refusal([
        `  ${SURFACE} could not be read: ${printable(String(inspection.error))}.`,
        '  A check that passes over a directory it never opened is worse than no check, so a',
        '  missing or unreadable surface is a refusal and never a pass. Restore the folder at the',
        '  repository root, or correct the surface in ops/contract-purity.mjs if it has moved.',
      ]),
    };
  }

  if (inspection.findings.length > 0) {
    const count = inspection.findings.length;
    const one = count === 1;
    // Only an executable file is something to move under `packages/`. A link,
    // a socket and a directory that would not list are all refusals too, and
    // telling an operator to move one of those under `packages/` and publish
    // what it generates is an instruction they cannot follow. The all
    // executable wording is the one the recorded probe output quotes.
    const allExecutable = inspection.findings.every((finding) => finding.executable);
    return {
      ok: false,
      message: refusal([
        allExecutable
          ? `  ${count} ${one ? 'path' : 'paths'} under ${SURFACE} ${one ? 'breaks' : 'break'} that rule:`
          : `  ${count} ${one ? 'entry' : 'entries'} under ${SURFACE} cannot stand as published data:`,
        ...inspection.findings.map((finding) => `    ${SURFACE}${printable(finding.path)}: ${finding.reason}`),
        ...(allExecutable
          ? [
              `  Move ${one ? 'it' : 'them'} under ${GENERATOR_HOME}, which is never published, and publish what`,
              `  ${one ? 'it generates' : 'they generate'} instead. A published folder is vendored by copy into`,
              '  seven repositories (AD-16), so nothing under it may need a runtime to be useful.',
            ]
          : [
              `  Executable code goes under ${GENERATOR_HOME}, which is never published, and what it`,
              '  generates is published instead. Anything else listed above has to become a plain file',
              '  this walk can read, or leave the surface. A published folder is vendored by copy into',
              '  seven repositories (AD-16), so nothing under it may resolve outside itself, need a',
              '  runtime to be useful, or go unread.',
            ]),
      ]),
    };
  }

  if (inspection.files.length === 0) {
    return {
      ok: false,
      message: refusal([
        `  The walk reached 0 files under ${SURFACE}.`,
        '  A green run has to mean the surface was read, so an empty surface is a refusal rather',
        '  than a pass: the failure mode of a purity check is a pass over a tree nobody opened.',
      ]),
    };
  }

  const read = inspection.files.length;
  return {
    ok: true,
    message: `contract purity: read ${SURFACE}, ${read} ${read === 1 ? 'file' : 'files'}, none executable and no link (AD-1).`,
  };
}

/**
 * The whole CLI as a function. It takes nothing: the directory is fixed in this
 * file and resolved beside this module, so the checker works from any working
 * directory and no caller can point it somewhere else. It passes no reader
 * either, so the CI path is the default one.
 *
 * @returns {Result}
 */
export function main() {
  return report(inspect(fileURLToPath(new URL(`../${SURFACE_DIRECTORY}`, import.meta.url))));
}

/**
 * @param {string} a
 * @param {string} b
 */
function sameFile(a, b) {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    // Never answer "no" here. A guard that decides it was not invoked directly
    // runs nothing and lets the process exit 0, which is a gate failing open:
    // the one outcome this whole file exists to prevent. If a path cannot be
    // resolved, compare the paths as written instead.
    return resolve(a) === resolve(b);
  }
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && sameFile(process.argv[1], fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const result = main();
  const stream = result.ok ? process.stdout : process.stderr;
  // Record the verdict before writing anything. The exit below happens inside
  // the write callback, and a stream torn down before that callback runs never
  // calls it, at which point the process falls off the end of this module and
  // exits 0. On a refusal that is the gate failing open on the one path that
  // reports a violation, so the verdict is set here and the callback only
  // decides when to leave rather than whether the run failed.
  process.exitCode = result.ok ? 0 : 1;
  // Exit from the write callback. On a pipe, which is what a CI runner gives
  // this process, `process.exit` can otherwise cut the message off mid flush
  // and leave a failing step with nothing explaining why.
  stream.write(`${result.message}\n`, () => process.exit(result.ok ? 0 : 1));
}
