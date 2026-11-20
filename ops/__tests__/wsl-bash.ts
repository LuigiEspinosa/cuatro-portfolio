import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// The bash every suite under `ops/__tests__/` that runs a script spawns. On Windows it is WSL's, named
// absolutely because the PATH handed to the child is a POSIX one; CI is `ubuntu-latest`'s own bash.
export const BASH = (() => {
  if (process.platform !== 'win32') return 'bash';
  const candidate = join(process.env.SystemRoot ?? 'C:\\Windows', 'system32', 'bash.exe');
  return existsSync(candidate) ? candidate : 'bash';
})();

// DW-135: on the Windows host WSL sometimes stalls for about 30 seconds (25291 ms to 30469 ms observed on 2026-10-18) and
// `bash.exe` exits 1 having run nothing, writing its own error to stdout in UTF-16LE, such as "Catastrophic
// failure" with "Error code: Bash/Service/E_UNEXPECTED". Read as UTF-8 that text is NUL-interleaved, and the
// harnesses print only stderr, which is empty, so the stall read as silence. No script here runs that long
// or writes a NUL, so that shape is named as WSL rather than left to fail as the assertion that reads it next.
export const STALL_MS = 20_000;

export const wslStall = (
  result: { status: number | null; stdout: string | null; stderr: string | null },
  elapsedMs: number,
  wsl = BASH !== 'bash'
): string | null => {
  const stdout = result.stdout ?? '';
  const silent = !stdout.trim() && !(result.stderr ?? '').trim();
  if (!wsl || result.status === 0 || elapsedMs < STALL_MS || !(silent || stdout.includes('\u0000'))) return null;
  const said = stdout.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
  return (
    `WSL did not answer: ${BASH} exited ${result.status} after ${elapsedMs} ms ` +
    `${said ? `and wrote its own error, not the script's: "${said}"` : 'with no output'}. ` +
    'This is the host stall of DW-135, not the case under test: re-run the file before debugging.'
  );
};

/** `spawnSync(BASH, args)` as UTF-8, throwing a spawn error, and a WSL stall by that name. */
export const spawnBash = (args: string[]): SpawnSyncReturns<string> => {
  const started = Date.now();
  const result = spawnSync(BASH, args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  const stall = wslStall(result, Date.now() - started);
  if (stall) throw new Error(stall);
  return result;
};
