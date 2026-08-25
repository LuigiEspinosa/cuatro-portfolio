// The one entry point a human runs to rebuild the three published faces.
//
//   corepack pnpm fonts:prepare
//
// It shells out to the pinned subsetting command and prints the per-file and
// total figures that command produced. Nothing else: the actual work is in
// `packages/fonts/subset.py`, and the pin lives here so a rebuild on another
// host uses the same fontTools that produced the committed binaries.
//
// This is deliberately NOT run in CI. The runners have no Python toolchain, and
// re-subsetting on every push would make the published binaries a build output
// of an unpinned environment rather than a reviewed, committed artefact. The
// gate that CI does run is `pnpm fonts:build`, which regenerates the stylesheet
// from `faces.json` with Node builtins alone.
//
// AD-1: `packages/` only, never published.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

/**
 * Pinned exactly, no range. The woff2 bytes a subsetter emits are a function of
 * its version, so a floating pin would make the committed binaries and their
 * recorded sha256 values disagree with a fresh run for reasons nobody changed.
 * Same reasoning as the exact `@playwright/test` pin in the root manifest.
 */
const FONTTOOLS = 'fonttools[woff]==4.60.1';

const SCRIPT = join(HERE, 'subset.py');

// `uv` is not on PATH on the authoring host, so an explicit path is accepted as
// a build input rather than requiring a PATH edit. Documented in
// `ops/font-contract.md` under "How the faces are regenerated".
const UV = process.env.CUATRO_UV || 'uv';

if (!existsSync(SCRIPT)) {
  console.error(`packages/fonts/prepare.mjs: ${SCRIPT} is missing, so there is nothing to run.`);
  process.exit(1);
}

const command = [UV, 'run', '--with', FONTTOOLS, 'python', SCRIPT];
console.log(`packages/fonts: running  ${command.join(' ')}`);
console.log(`packages/fonts: writing  contracts/fonts/ under ${REPO_ROOT}`);

const result = spawnSync(command[0], command.slice(1), { stdio: 'inherit', cwd: REPO_ROOT });

if (result.error) {
  console.error(
    `packages/fonts/prepare.mjs: could not run "${UV}" (${result.error.message}). ` +
      `Install uv, or set CUATRO_UV to its full path.`
  );
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`packages/fonts/prepare.mjs: the subsetting step exited ${result.status}. Nothing was published.`);
  process.exit(result.status ?? 1);
}
