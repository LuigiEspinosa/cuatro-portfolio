// Publishes `contracts/` into `public/contracts/`, which is what makes the whole
// published surface answer an HTTP GET at `https://cuatro.dev/contracts/`
// (Story 1-16, AD-1, AD-4).
//
// AD-1: this script lives in `packages/` and is never published. What it writes
// is a copy of the published surface, not a second authored copy of it.
//
// **Why `public/` and not a proxy file server.** The Hub already owns the apex:
// `docker/Caddyfile` gives `cuatro.dev` one site block reverse-proxying
// `anchor-app:3000`, which is this application's own container. Anything the
// Hub serves is therefore already reachable under the apex over HTTPS, so the
// deploy that ships the contract also ships the serving, with no bind mount, no
// hand-installed proxy fragment and no file outside the container. See
// `ops/contract-serving.md`.
//
// **Why the copy is generated and never committed.** AD-4's rule is one
// authored location. A committed `public/contracts/` would be a second copy a
// reviewer has to keep in step by hand, and the first time it drifted,
// `https://cuatro.dev/contracts/tokens.css` would serve a value no generator
// produced. `.gitignore` ignores `/public/contracts/` for exactly that reason.
//
// **Why this is wired into the `build` script itself** rather than into a pnpm
// `prebuild` lifecycle hook: `enable-pre-post-scripts` is a pnpm setting this
// repository does not pin, and a build that quietly skipped the copy would ship
// a working site serving 404s at `/contracts/`. `docker/Dockerfile` runs
// `pnpm build` in its builder stage and its runner stage copies `public`, so
// the served image carries this with no Dockerfile change and no new layer.
// `docker/__tests__/runner-stage.test.ts` is what holds that second half.
//
// **The destination is removed before it is written.** A contract file that was
// renamed or deleted at source must not survive in the served tree, so the
// publish is a replacement rather than an overlay.
//
// Node builtins only, and no `package.json` in this directory. A manifest here
// would make it a workspace importer, change the lockfile, and oblige a new
// `COPY` line in the Docker `deps` stage that
// `docker/__tests__/deps-stage.test.ts` exists to police, on the same reasoning
// `packages/fonts` records.
//
// **Nothing redirects this publish at runtime.** No environment variable and no
// argument selects either path; both are fixed in this file and resolved beside
// this module. `ci.yml` had to pin two build inputs empty on each contract
// drift job to close that hole for the generators, and a redirectable publish
// has a worse version of it: a build that copies nothing into a directory
// nobody reads is green while the published surface serves 404s.
//
// `publish` does take both paths as arguments, and that is a different thing:
// it is how the standing suite runs the real code against scratch trees instead
// of against the repository. `main` passes the fixed pair and takes nothing.
//
// `publish` also takes an injected host, on the `inspect(directory, read)`
// precedent in `ops/contract-purity.mjs`. It decides **how** a directory is
// listed and how bytes are removed and copied, never **which** paths are read
// or written. It exists because three of the refusals below cannot be
// constructed portably on both a Windows authoring host and a Linux runner: an
// entry that is neither a file nor a directory needs `mkfifo`, and a removal or
// a copy that fails part way through needs a filesystem state no portable call
// can arrange. A refusal with no standing case is a refusal that quietly stops
// working. The CLI path passes no host, and standing cases run the real one end
// to end through a subprocess.

import { copyFileSync, lstatSync, mkdirSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

/**
 * The published surface's own name, which is three things at once: the
 * directory the source is, the final segment the destination must carry, and
 * the label every refusal prints. Deriving all three from one constant means a
 * message can never name a folder that was not the one read, and a scratch tree
 * in a test produces the exact string a build log would print for the real one.
 */
const SURFACE = 'contracts';

/**
 * The one authored location of the published surface, and the served copy of
 * it. Exported so a test can assert the pair this process actually uses rather
 * than a pair it wrote out a second time.
 */
export const SOURCE = join(REPO_ROOT, SURFACE);
export const DESTINATION = join(REPO_ROOT, 'public', SURFACE);

/**
 * The public path the destination answers at, once Next is serving `public/`.
 * `tests/e2e/contract-serving.pw.ts` builds every URL it fetches from this
 * exact value, and a standing case pins the two equal.
 */
export const SERVED_AT = `/${SURFACE}/`;

const asPosix = (/** @type {string} */ value) => value.replace(/\\/g, '/');

/**
 * Every refusal ends with the same clause, appended here rather than written
 * out at each site, so the claim `ops/contract-serving.md` makes about the
 * whole set cannot drift message by message.
 *
 * The clause means no publish completed, so nothing under the destination may
 * be read as the published surface. The one refusal that can leave debris
 * behind, a copy failure whose cleanup also failed, names the leftover path in
 * the sentence before it rather than dropping the clause.
 *
 * @param {string} message
 * @returns {never}
 */
const refuse = (message) => {
  throw new Error(`packages/contracts-serve/publish.mjs: ${message} Nothing was published.`);
};

const code = (/** @type {unknown} */ error) => {
  // The `code` rather than the `message`: an ENOENT message carries the
  // absolute path it tried, which differs between a Windows checkout and a
  // runner, and every path this file prints is normalised so both print the
  // same string.
  if (error instanceof Error && typeof (/** @type {{ code?: unknown }} */ (error).code) === 'string') {
    return String(/** @type {{ code?: unknown }} */ (error).code);
  }
  return error instanceof Error ? error.message : String(error);
};

/**
 * @typedef {{ name: string, isSymbolicLink(): boolean, isDirectory(): boolean, isFile(): boolean }} Entry
 * @typedef {(directory: string) => Entry[]} ReadDirectory
 * @typedef {{ read: ReadDirectory, remove: (path: string) => void, copy: (from: string, to: string) => void }} Host
 */

/** @type {Host} */
const HOST = {
  read: (directory) => readdirSync(directory, { withFileTypes: true }),
  remove: (path) => rmSync(path, { recursive: true, force: true }),
  copy: (from, to) => copyFileSync(from, to),
};

/**
 * True when `inner` is `outer` or sits underneath it.
 *
 * The publish removes the destination before it writes, so a destination that
 * contains the source, or a source that contains the destination, would delete
 * the published surface on the way to serving it. Equality is the obvious case
 * and the only one the first draft of this file caught.
 *
 * @param {string} outer
 * @param {string} inner
 */
const contains = (outer, inner) => {
  const above = resolve(outer);
  const below = resolve(inner);
  return below === above || below.startsWith(above.endsWith(sep) ? above : `${above}${sep}`);
};

/**
 * Every file under `directory`, as sorted relative paths with forward slashes,
 * so a Windows checkout and an Ubuntu runner produce the same list.
 *
 * A link or an entry that is neither a file nor a directory is refused rather
 * than copied. `ops/contract-purity.mjs` already refuses both under
 * `contracts/`; refusing them here too means this publish never turns one into
 * a served artifact whose bytes were decided outside the folder.
 *
 * @param {string} directory
 * @param {ReadDirectory} read
 * @param {string} prefix
 * @param {string[]} found
 * @returns {string[]}
 */
function walk(directory, read, prefix = '', found = []) {
  for (const entry of read(directory)) {
    const path = `${prefix}${entry.name}`;
    if (entry.isSymbolicLink()) {
      refuse(`${SURFACE}/${path} is a link, so what it would serve is decided outside the published folder.`);
    }
    if (entry.isDirectory()) {
      walk(join(directory, entry.name), read, `${path}/`, found);
      continue;
    }
    if (!entry.isFile()) {
      refuse(`${SURFACE}/${path} is neither a file nor a directory, so it is not something a server can send.`);
    }
    found.push(path);
  }
  found.sort();
  return found;
}

/**
 * Replace `destination` with a copy of `source` and return the relative paths
 * written, sorted.
 *
 * Refuses, and leaves no served tree behind, when the source is absent, is a
 * link, is not a directory, holds no files, holds a link or a non-file, when
 * either path contains the other, when the destination is not named for the
 * surface, when the removal fails, or when a copy fails part way through: a
 * silent empty publish and a half written one both serve 404s from a green
 * build, which is the failure this whole step exists to prevent.
 *
 * @param {string} source
 * @param {string} destination
 * @param {Host} [host]
 * @returns {string[]}
 */
export function publish(source, destination, host = HOST) {
  // Containment rather than equality. `rmSync(destination)` runs before the
  // copy, so either path sitting inside the other removes the published surface
  // before anything is read out of it.
  if (contains(source, destination) || contains(destination, source)) {
    refuse(
      `the source ${asPosix(resolve(source))} and the destination ${asPosix(resolve(destination))} are the ` +
        `same path or one contains the other, and the publish begins by removing the destination.`
    );
  }
  if (basename(destination) !== SURFACE) {
    refuse(
      `the destination ${asPosix(destination)} is not named "${SURFACE}", and the publish ` +
        `begins by removing it recursively.`
    );
  }

  // `lstat`, not `stat`: a linked surface root is refused rather than followed,
  // on the same reasoning `ops/contract-purity.mjs` records.
  const stats = (() => {
    try {
      return lstatSync(source);
    } catch (error) {
      return refuse(
        `the published surface at ${asPosix(source)} could not be read (${code(error)}), so there is ` +
          `nothing to serve at ${SERVED_AT}.`
      );
    }
  })();

  if (stats.isSymbolicLink()) {
    refuse(`the published surface at ${asPosix(source)} is a link, and the served copy must be the committed directory.`);
  }
  if (!stats.isDirectory()) {
    refuse(`the published surface at ${asPosix(source)} is not a directory, so it cannot be copied to ${SERVED_AT}.`);
  }

  const files = walk(source, host.read);
  if (files.length === 0) {
    refuse(
      `the published surface at ${asPosix(source)} holds no files. Publishing it would leave ${SERVED_AT} ` +
        `answering 404 from a green build, so an empty surface is a refusal rather than an empty copy.`
    );
  }

  // Removed before it is written, so a contract file that was renamed or
  // deleted at source cannot survive in the served tree. A removal that fails
  // is a refusal rather than an unguarded throw: a raw EPERM or EBUSY here
  // would reach a build log with no mention of this file and no clause, and the
  // record states the clause holds for every refusal.
  try {
    host.remove(destination);
  } catch (error) {
    refuse(
      `the served copy at ${asPosix(destination)} could not be removed (${code(error)}), so a contract ` +
        `renamed or deleted at source could have survived underneath a fresh publish.`
    );
  }

  for (const file of files) {
    const target = join(destination, ...file.split('/'));
    try {
      mkdirSync(dirname(target), { recursive: true });
      host.copy(join(source, ...file.split('/')), target);
    } catch (error) {
      // A half written served tree is worse than none: it answers 200 for the
      // contract files that made it and 404 for the rest, from a build that
      // exited non-zero somewhere a deploy log may not be read. So the partial
      // tree is removed before the refusal, and the refusal says whether that
      // succeeded.
      let cleaned = true;
      try {
        host.remove(destination);
      } catch {
        cleaned = false;
      }
      refuse(
        `${SURFACE}/${file} could not be copied to ${asPosix(target)} (${code(error)}).` +
          (cleaned
            ? ' The partly written served copy was removed.'
            : ` The partly written served copy at ${asPosix(destination)} could not be removed either and has to be` +
              ' deleted by hand before the next build.')
      );
    }
  }

  return files;
}

/**
 * The whole step as a function. It takes nothing: both paths are fixed in this
 * file and resolved beside this module, so no caller and no runner environment
 * can point it somewhere else. It passes no host either, so the CLI path is the
 * real one.
 *
 * @returns {string[]}
 */
export function main() {
  return publish(SOURCE, DESTINATION);
}

/**
 * @param {string} a
 * @param {string} b
 */
function sameFile(a, b) {
  try {
    // `realpath` on both, not a textual comparison. On Windows the same script
    // reaches `process.argv[1]` with a different drive-letter case, as an 8.3
    // short path, or through a link, and a textual comparison then answers no,
    // the publish is skipped, and `pnpm build` exits 0 having shipped a site
    // that serves 404s at /contracts/. That is this story's whole failure mode.
    return realpathSync(a) === realpathSync(b);
  } catch {
    // Never answer "no" here. A guard that decides it was not invoked directly
    // copies nothing and lets the build continue, which is a gate failing open.
    // If a path cannot be resolved, compare the paths as written instead.
    return resolve(a) === resolve(b);
  }
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && sameFile(process.argv[1], fileURLToPath(import.meta.url));

if (invokedDirectly) {
  // Printed before the copy, so a job log says which pair a run actually used
  // even when the publish then refuses. Both lines are asserted on the refusal
  // path as well as the success path.
  console.log(`packages/contracts-serve: reading  ${asPosix(SOURCE)}`);
  console.log(`packages/contracts-serve: writing  ${asPosix(DESTINATION)}`);
  try {
    const files = main();
    for (const file of files) console.log(`packages/contracts-serve:   ${SERVED_AT}${file}`);
    console.log(`packages/contracts-serve: published ${files.length} ${files.length === 1 ? 'file' : 'files'} at ${SERVED_AT}`);
  } catch (error) {
    // Record the verdict before writing anything. `process.exit` inside the
    // write callback is what keeps a refusal from being cut off mid flush on a
    // pipe, which is what a CI runner gives this process, and setting
    // `exitCode` first is what keeps a stream torn down before that callback
    // runs from letting the process fall off the end of this module and exit 0.
    // Same trap Story 1-14 recorded against `ops/capacity-gate.mjs`.
    process.exitCode = 1;
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`, () => process.exit(1));
  }
}
