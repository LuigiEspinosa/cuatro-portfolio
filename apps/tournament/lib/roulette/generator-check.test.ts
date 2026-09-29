import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * STORY 6.11, AC6 — `generate_vectors.py --check` STOPS DEPENDING ON A HUMAN REMEMBERING
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ⭐⭐ THE FAILURE THIS EXISTS TO PREVENT, in `deferred-work.md:299`'s own words: "someone whose
 * implementation fails a case edits `expected.steamid64` in the JSON instead of fixing the code —
 * `go test`, `vitest`, `lint` and `build` all go green and the committed vector silently becomes a
 * transcript of a buggy implementation, which is exactly the property the README says committing
 * the generator exists to prevent." Until this file, the third-implementation anchor was enforced
 * by a human remembering to type one command. `deferred-work.md:288` is the same gap seen from the
 * other side: 6.3's cross-language transcript is not re-derivable from the tree.
 *
 * ⭐ DECISION AD (Cuatro, Story 6.11 Question 2) — IT IS A VITEST GATE, not an npm `pretest`, not a
 * Go test, and not the repo's first CI. It rides `npm test`, which is already gate 2 of the
 * standing eight, so it runs at every sign-off without anyone remembering; it is COUNTED in the
 * suite total, so its disappearance is visible in a number the story notes already track; and it
 * can be made to fail loudly when Python is absent.
 *
 * ⛔⛔ IT MUST NEVER `skip`. A gate that quietly opts out on a missing interpreter reproduces
 * EXACTLY the failure mode `:299` describes — green gates over an unverified anchor — and this
 * project has now recorded the vacuous-guard shape six separate times. `it.skipIf` is deliberately
 * not used anywhere in this file.
 *
 * ⚠ THE COST, STATED: `npm test` depends on a Python 3 interpreter on PATH. Measured at Story 6.11:
 * `python` and `python3` both resolve to 3.14.5 on this machine. The dependency is real; it is the
 * price of the anchor being checked rather than trusted, and it is logged as a deferred item because
 * no `engines` entry or setup doc mentions it.
 *
 * ⚠ `node:child_process` IS TEST SUPPORT, NOT SHIPPED CODE. The `node:` import ban is enforced
 * against PRODUCTION sources only (`prng.test.ts` scans `productionSources`), and the shipped-module
 * pin filters `*.test.ts`, so this file widens neither.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THREE DEFECTS FOUND AT 6.11's CODE REVIEW, FIXED HERE — recorded so they are not re-introduced.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * 1. ⛔ THE GATE SPAWNED THE WHOLE GENERATOR TWICE AND TIMED OUT UNDER LOAD. `runCheck()` was called
 *    once per `it`. Measured: `--check` costs ~2.6 s, and `vitest.config.ts` sets no `testTimeout`,
 *    so the 5 s default left under 2× headroom for a doubled cost. The reviewer OBSERVED the second
 *    test time out on a loaded full-suite run — and a timeout reports a Vitest message, not the
 *    carefully written drift diagnostic, so the gate failed in the least informative way available.
 *    The run is now memoised: one spawn per process, shared by every test, with an explicit per-test
 *    timeout well clear of it.
 *
 * 2. ⛔ `spawnSync` HAD NO `timeout`, SO A STALLED INTERPRETER HUNG `npm test` FOREVER. `spawnSync`
 *    blocks the worker inside a native call, so Vitest's own timer cannot fire and cannot abort it.
 *    An explicit `timeout` is the only thing that can.
 *
 * 3. ⛔ THE INTERPRETER FALLBACK ADVANCED ONLY ON A *SPAWN* ERROR, so on this repo's own platform the
 *    missing-interpreter arm could not fire for its most common cause. Windows ships an App Execution
 *    Alias `python.exe` that SPAWNS SUCCESSFULLY and exits non-zero without running anything; the old
 *    loop returned that as a result, never tried `python3`, and reported it through the DRIFT arm as
 *    "a committed vector no longer matches … ⛔ FIX THE CODE, NEVER THE JSON" — naming the wrong
 *    cause and pointing the next developer at JSON that is fine. Spawning is now three outcomes, not
 *    two: `unusable` (try the next candidate), `ran` (a real answer, trust the exit code), and
 *    exhausted (fail loudly).
 */

const REPO_ROOT = process.cwd();
const GENERATOR = path.join('roulette', 'vectors', 'generate_vectors.py');
const VECTOR_DIR = path.join(REPO_ROOT, 'roulette', 'vectors');

/**
 * The one vector file `--check` does NOT round-trip: it is an INPUT, deliberately outside the
 * generator's `outputs` map (`README.md:111-135`), and also gate 5's projection source.
 */
const EXEMPT_INPUT = 'canonical-bundle-input.json';

/** The interpreters to try, in order. Both resolve on the machine this was written on. */
const INTERPRETERS = ['python', 'python3'] as const;

/** Hard ceiling on one `--check`. Measured at ~2.6 s; this is ~23× headroom, not a tuning knob. */
const CHECK_TIMEOUT_MS = 60_000;

interface CheckRun {
  interpreter: string;
  status: number | null;
  stdout: string;
  stderr: string;
  /** The `OK …` / `DRIFT …` lines, one per file the generator actually round-tripped. */
  reported: string[];
}

/** Why a candidate interpreter was rejected without being trusted as an answer. */
interface Unusable {
  interpreter: string;
  reason: string;
}

/**
 * Does this look like a Python that RAN our script, as opposed to one that could not?
 *
 * ⛔ "SPAWNED" IS NOT "RAN", AND "RAN" IS NOT "EXITED ZERO" — three different facts, and conflating
 * any two is how this gate would quietly stop testing anything. A spawn error (ENOENT), a Windows
 * Store alias stub, and a Python 2 that cannot parse the file are all "not our interpreter"; a real
 * Python 3 that ran the script and reported DRIFT is an ANSWER and must fail the test.
 */
function classify(status: number | null, stdout: string, stderr: string): 'ran' | string {
  const reported = reportedLines(stdout);
  if (reported.length > 0) return 'ran';
  // A traceback means a real Python executed the file and blew up — that is an answer, and a loud
  // one. A *SyntaxError* traceback means the opposite: an interpreter too old to parse the source.
  const traceback = /Traceback \(most recent call last\)/.test(stderr);
  if (traceback && !/SyntaxError/.test(stderr)) return 'ran';
  if (traceback) return 'the interpreter could not parse the generator (Python 2?)';
  if (status === 0) return 'exited 0 but reported on no files at all';
  return `exited ${status} without running the generator (a Store alias stub or a shim?)`;
}

function reportedLines(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('OK') || l.startsWith('DRIFT'));
}

function attempt(): CheckRun | { unusable: Unusable[] } {
  const unusable: Unusable[] = [];
  for (const interpreter of INTERPRETERS) {
    const proc = spawnSync(interpreter, [GENERATOR, '--check'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: CHECK_TIMEOUT_MS,
      // ⚠ The default 1 MB can raise ENOBUFS, which surfaces as `proc.error` and would otherwise be
      // misreported as "no interpreter".
      maxBuffer: 16 * 1024 * 1024,
    });
    if (proc.error) {
      unusable.push({ interpreter, reason: proc.error.message });
      continue;
    }
    const stdout = proc.stdout ?? '';
    const stderr = proc.stderr ?? '';
    const verdict = classify(proc.status, stdout, stderr);
    if (verdict !== 'ran') {
      unusable.push({ interpreter, reason: verdict });
      continue;
    }
    return { interpreter, status: proc.status, stdout, stderr, reported: reportedLines(stdout) };
  }
  return { unusable };
}

/**
 * ⭐ ONE SPAWN PER PROCESS, SHARED BY EVERY TEST. See defect 1 in the header.
 */
let memo: CheckRun | { unusable: Unusable[] } | undefined;
function checkRun(): CheckRun | { unusable: Unusable[] } {
  memo ??= attempt();
  return memo;
}

/**
 * ⛔⛔ THE MISSING-INTERPRETER PATH IS A FAILURE, LOUDLY, WITH INSTRUCTIONS. Not a skip, not a
 * warning, not a silent pass. This is the arm AC6 names explicitly.
 */
function requireRun(): CheckRun {
  const run = checkRun();
  if ('unusable' in run) {
    throw new Error(
      'AC6: no usable Python 3 interpreter could be found, so the golden vectors are UNVERIFIED.\n' +
        'This is a FAILURE and never a skip — a gate that opts out on a missing tool is the exact\n' +
        `vacuity \`deferred-work.md:299\` describes.\n` +
        run.unusable.map((u) => `  ${u.interpreter}: ${u.reason}`).join('\n') +
        '\nInstall Python 3, put it on PATH, and re-run `npm test`.',
    );
  }
  return run;
}

describe('AC6 — the third-implementation anchor is checked, not trusted', () => {
  it(
    'runs generate_vectors.py --check and requires exit code 0',
    () => {
      const run = requireRun();

      // ⛔ THE ORACLE IS THE EXIT CODE, NEVER A PROSE GREP OF THE OUTPUT. `--check` prints "OK" or
      // "DRIFT" per file and returns 1 if any file differs; matching on the word "OK" would pass on
      // a run that printed eight OKs and one DRIFT.
      //
      // ⚠ The stdout parsing above is NOT the oracle — it is how a non-interpreter is told apart
      // from an interpreter, and how the file COUNT is re-derived below. The pass/fail decision here
      // is `run.status` and nothing else.
      expect(
        run.status,
        `generate_vectors.py --check exited ${run.status} under ${run.interpreter} — a committed ` +
          'vector no longer matches what the third implementation produces. ⛔ FIX THE CODE, NEVER ' +
          `THE JSON.\n--- stdout ---\n${run.stdout}\n--- stderr ---\n${run.stderr}`,
      ).toBe(0);
    },
    CHECK_TIMEOUT_MS + 30_000,
  );

  it(
    'checks EVERY derived vector, with the count re-derived from the directory',
    () => {
      const run = requireRun();

      // ⭐⭐ NON-VACUITY FOR THE GATE ITSELF, AND THE FIRST VERSION OF THIS WAS TOO WEAK. Exit 0 is
      // also what a `--check` iterating an EMPTY outputs map returns, so the exit-code gate cannot
      // tell "nine files verified" from "nothing was verified". The original assertion here was
      // `toBeGreaterThan(0)` — which catches only the fully-empty case, while a map that lost EIGHT
      // of its nine entries would report one `OK`, exit 0, and pass. `deferred-work.md` meanwhile
      // advertised this test as "re-derives the checked-file count from the process's own stdout".
      // Now it genuinely does.
      //
      // ⛔ THE EXPECTED COUNT IS DERIVED FROM THE TREE, NOT HAND-WRITTEN (`6-5b:114`: "do not
      // hand-edit a count"). Every `.json` in the directory is a derived vector except the one
      // exempt INPUT, so the generator must round-trip exactly that many.
      const onDisk = readdirSync(VECTOR_DIR, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.json'))
        .map((e) => e.name);
      const expectedCount = onDisk.filter((n) => n !== EXEMPT_INPUT).length;

      expect(onDisk, `${EXEMPT_INPUT} is the exempt input and must be present`).toContain(EXEMPT_INPUT);
      expect(expectedCount, 'no derived vectors found — the count below would be vacuous').toBeGreaterThan(0);

      expect(
        run.reported.length,
        `--check reported on ${run.reported.length} files but ${expectedCount} derived vectors are ` +
          `on disk — a file dropped out of the generator's \`outputs\` map is a gate that silently ` +
          `stopped running.\n${run.stdout}`,
      ).toBe(expectedCount);

      expect(run.reported.every((l) => l.startsWith('OK')), `--check reported drift:\n${run.stdout}`).toBe(true);

      // Gate 5's own file must be among them — the whole point of this story is that the end-to-end
      // vector is round-tripped by the generator like every other derived file.
      expect(run.reported.some((l) => l.includes('end-to-end.json'))).toBe(true);
    },
    CHECK_TIMEOUT_MS + 30_000,
  );
});
