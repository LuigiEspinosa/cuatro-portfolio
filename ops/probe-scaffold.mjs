// The scaffold the two rendered-output probes share (epic-1 retro item 10):
// `ops/cs-tracker-adoption-probe.mjs` and `ops/daisyui-route-probe.mjs` each
// carried their own copy of everything here, so a fix to one never reached the
// other. The comments are the daisyUI copy's, which was the commented one.
//
// Not a probe and not a gate: it observes nothing on its own. Its cases are in
// `ops/__tests__/probe-scaffold.test.ts`.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

/**
 * This module's own directory, which is `ops/` for both probes too.
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
 * absolute path, so the estate layout is the only assumption. The daisyUI probe
 * writes nothing under it; the adoption probe plants files there for its scan
 * cases, removes them, and fails a case unless `git status` reads as before.
 */
export const CS_TRACKER = resolve(REPO_ROOT, '..', 'cs-tracker-workspace', 'cs-tracker');

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.woff2': 'font/woff2',
  '.js': 'text/javascript; charset=utf-8',
};

/** Thrown for a condition the story's Block If names, never for a defect in a probe. */
export class BlockedError extends Error {}

export function say(message) {
  process.stdout.write(`${message}\n`);
}

/**
 * Run a command, returning its exit status, both streams, the signal that killed
 * it, any spawn error and the timeout it was given. Never throws on a non-zero
 * exit: a compile failure is a finding a probe records, not a crash to report.
 *
 * `timeout` is required in practice: each probe names its own, because
 * `describeRun` quotes it back into a transcript that gets published verbatim,
 * and a figure that disagreed with the real timeout would be a lie in evidence.
 *
 * `signal` is surfaced because `timeout` kills with SIGTERM and leaves `status`
 * null, which is indistinguishable from a spawn failure at the call site. A
 * `mix phx.new --install` that ran out of time on a cold hex cache is a
 * different thing from a generator that refused, and the caller has to be able
 * to say which.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {import('node:child_process').SpawnSyncOptions} [options]
 */
export function run(command, args, { timeout, shell = false, ...options } = {}) {
  // Node 18.20 and later refuse to spawn a `.bat` or `.cmd` without a shell, and
  // `mix` and `elixir` are both batch files on Windows, so the daisyUI probe
  // passes `shell` there. The command is then joined into one string rather than
  // passed as an argument vector, because Node warns (DEP0190) that a vector
  // plus `shell: true` is concatenated unescaped, and a deprecation notice in
  // the middle of the probe output is noise in a record that gets quoted
  // verbatim. Every argument that probe passes is a bare flag or an identifier,
  // so there is nothing there for a shell to reinterpret.
  //
  // Quoted only when it has to be. `cmd.exe` resolves a quoted `mix.bat` against
  // the working directory rather than through PATH, and the batch file then
  // computes its own `%~dp0` from that wrong directory and cannot find
  // `elixir.bat`. Observed doing exactly that on 2026-08-25.
  const quoted = shell && command.includes(' ') ? `"${command}"` : command;
  const result = spawnSync(shell ? [quoted, ...args].join(' ') : command, shell ? [] : args, {
    encoding: 'utf8',
    timeout,
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
    timeout,
  };
}

/** How a finished command should be described in a failure message. */
export function describeRun(result) {
  const how =
    result.signal !== null
      ? `was killed by ${result.signal}, which is what the ${result.timeout / 1000} second timeout does`
      : result.error !== null
        ? `could not be started: ${result.error}`
        : `exited ${result.status}`;
  return `${how}\n${result.stdout}\n${result.stderr}`;
}

/**
 * The `tailwindcss vX.Y.Z` banner out of the binary's `--help` output, or null.
 *
 * The 4.1.12 CLI colours its banner through a pipe as well as on a terminal,
 * unless `NO_COLOR` is set, and one escape sits between the name and the
 * version. So every escape sequence is stripped before the match, and the pin
 * reads the same from any shell (DW-109).
 */
export function tailwindBanner(helpText) {
  return /(tailwindcss v[\d.]+)/.exec(stripVTControlCharacters(helpText ?? ''))?.[1] ?? null;
}

/** Read a file, or return null rather than throwing an ENOENT with no context. */
export function readOrNull(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/** Serve `root` on a free loopback port; resolves to the listening server. */
export function serve(root) {
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

/**
 * Whether the module at `moduleUrl` (its `import.meta.url`) is the script node
 * was started with. False under Vitest, where that URL is not a `file:` one.
 */
export function invokedDirectly(moduleUrl) {
  let entry;
  try {
    entry = fileURLToPath(moduleUrl);
  } catch {
    return false;
  }
  if (typeof process.argv[1] !== 'string') return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(entry);
  } catch {
    return false;
  }
}
