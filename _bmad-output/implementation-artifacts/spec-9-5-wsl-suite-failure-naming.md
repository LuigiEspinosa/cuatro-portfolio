---
title: 'Story 9-5: name a stalled WSL spawn, and identify the 2026-09-03 flake'
type: 'chore'
created: '2026-10-18'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-plan-2026-10-18.md'
  - '{project-root}/_bmad-output/implementation-artifacts/dw-triage-2026-10-18.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** On the Windows host the seven suites under `ops/__tests__/` that spawn WSL's bash (`deploy-remote`,
`library-backup`, `tracker-backup`, `postgres-backup`, `postgres-init`, `tournament-backup`, `demo-reset`) sometimes
fail a case after about 30 seconds, and the failure reads as whatever assertion follows the spawn, so a reader cannot
tell the host from the change (DW-135). One unit case failed once in four runs on 2026-09-03 and was never identified
because the output was truncated (DW-210).

**Approach:** Route every one of those spawns through one helper that recognises a stalled WSL spawn and fails the
case with a message that starts `WSL did not answer` and names DW-135. Then run the full suite ten times with
`--reporter=verbose` into files and read every failure and every passing case whose duration swings, so DW-210 is
either identified or closed on that evidence. Surface: `ops/__tests__/` only, no deploy.

</frozen-after-approval>

## Implementation Notes

Route oneshot: no intent gap, nothing irreversible, test files only (no script, workflow or deploy surface changes).

- **New `ops/__tests__/wsl-bash.ts`** (not a suite: Vitest's include is `*.test.*`): `BASH` (the seven files each
  carried an identical copy, now deleted), `wslStall(result, elapsedMs, wsl)` (pure classifier) and
  `spawnBash(args)` (`spawnSync(BASH, args, utf8)`, throws `result.error` as every caller did, then throws the stall
  message). Each of the seven harnesses calls `spawnBash` in place of `spawnSync(BASH, ..., { encoding: 'utf8' })`
  plus its `if (result.error) throw` line; nothing else in them moved. `postgres-backup` and `postgres-init` keep
  `spawnSync` for their `git` calls.
- **Surprise: the stall is not silent.** DW-135 recorded "an empty answer"; that was stderr, the only stream the
  harnesses print. A diagnostic run (temporary `SLOWSPAWN` logging of every spawn over 5 s, removed before commit)
  caught seven stalls in one pass of the seven files: every one was `bash.exe` exiting 1 after 29116 ms to 30216 ms
  with an empty stderr and its own UTF-16LE error on stdout, which reads NUL-interleaved as UTF-8: either
  `Catastrophic failure` / `Error code: Bash/Service/E_UNEXPECTED`, or `A connection attempt failed because the
  connected party did not properly respond after a period of time, ...`. So the classifier keys on: WSL bash, status
  not 0, at least `STALL_MS` (20 000 ms) elapsed, and either no output at all or a NUL on stdout. No script under test
  runs 20 s or writes a NUL to stdout, and on CI (`bash`, not `bash.exe`) the classifier is inert. The message quotes
  the decoded WSL text, so the reader sees WSL's own words.
- Nothing retries: a stall still fails the case (a gate never goes quietly green), it only fails under its own name.
- `AGENTS.md`'s DW-135 line still says "with empty output"; agent context is outside this story's surface, so it is
  returned to the Operator rather than edited.

## Planted failures

Each new assertion was made to fail once by breaking `wsl-bash.ts` in place, then restored (`git diff` empty after):

- **NUL branch removed** (`stdout.includes('` made to look for a different string): `× names a failed spawn of WSL
  bash that took the stall time and wrote WSL's own error`, `AssertionError: expected null to be 'WSL did not answer:
  C:\WINDOWS\system…' // Object.is equality`, `Tests 1 failed | 2 passed (3)`.
- **Silent branch removed** (`!(silent ||` to `!(false ||`): `× names a failed, silent spawn of WSL bash that took the
  stall time`, `Tests 1 failed | 2 passed (3)`.
- **Duration check removed** (`|| elapsedMs < STALL_MS` deleted): `× leaves every other result to the case that reads
  it`, `AssertionError: expected 'WSL did not answer: C:\WINDOWS\system…' to be null`, `Tests 1 failed | 2 passed (3)`.
- **WSL's text unattributed** (`and wrote its own error, not the script's: ` to `and wrote: `): `× names a failed spawn
  of WSL bash ...`, `Expected: "... exited 1 after 30008 ms and wrote its own error, not the script's: "Catastrophic
  failure Error code: Bash/Service/E_UNEXPECTED". ..."`, `Received: "... exited 1 after 30008 ms and wrote:
  "Catastrophic failure ..."`, `Tests 1 failed | 2 passed (3)`.

A first attempt at the NUL plant used a `sed` pattern that did not match and the suite stayed green; it was redone
with the substitution above, which matched once (`grep -c` 1) and failed as recorded.

End to end, the harness message itself is planted by the host: the ten runs below fail 28 cases on real WSL stalls,
and every one fails as `Error: WSL did not answer: C:\WINDOWS\system32\bash.exe exited 1 after <n> ms and wrote its
own error, not the script's: "Catastrophic failure Error code: Bash/Service/E_UNEXPECTED". This is the host stall of
DW-135, not the case under test: re-run the file before debugging.` (or the connection-attempt text). Before the
change, the same stall in `tracker-backup` read `AssertionError: expected 1 to be +0 // Object.is equality` (the
first eight-file run of this story).

## DW-210: ten verbose runs

Ten sequential `corepack pnpm exec vitest --run --reporter=verbose` (the root `test` script is `vitest`), each into
its own file, at `ae314fa8d03ef3a6f80f6ec669cc48eada971ef6`, 2026-10-18 21:17:13Z to about 21:45Z, 82 files and 1987
tests per run, 97 s to 248 s each:

| Run | Exit | Files failed | Cases failed | Named `WSL did not answer` | Catastrophic / connection | Stall ms |
|---|---|---|---|---|---|---|
| 1 | 1 | 6 | 6 | 6 | 5 / 1 | 25291 to 30150 |
| 2 | 1 | 6 | 11 | 11 | 9 / 2 | 28713 to 30185 |
| 3 | 1 | 3 | 3 | 3 | 2 / 1 | 28791 to 30202 |
| 4 | 1 | 2 | 2 | 2 | 1 / 1 | 29964 to 30469 |
| 5 | 0 | 0 | 0 | 0 | | |
| 6 | 0 | 0 | 0 | 0 | | |
| 7 | 0 | 0 | 0 | 0 | | |
| 8 | 1 | 1 | 1 | 1 | 0 / 1 | 30343 |
| 9 | 1 | 1 | 1 | 1 | 0 / 1 | 30208 |
| 10 | 1 | 4 | 4 | 4 | 3 / 1 | 28853 to 30322 |

28 failed cases in 7 of 10 runs, all 28 named as a WSL stall, all in the WSL-spawning suites (`demo-reset` 7,
`library-backup` 5, `postgres-backup` 5, `tournament-backup` 5, `tracker-backup` 4, `deploy-remote` 2,
`postgres-init` 0). No case in any other file failed in any run. Durations of passing cases outside those seven files
were compared across the ten runs: none swung by four times or more to five seconds or more.

**Reading for DW-210:** the 2026-09-03 failure cannot be named directly (its output is gone), but on that tree
(`75df819`) exactly one suite spawned WSL's bash, `ops/__tests__/library-backup.test.ts`, which fails five times in
these ten runs on the same stall. Ten verbose runs on today's tree, at more than twice the case count, produce no
failure of any other kind and no duration swing outside the WSL suites. DW-210 is closed as the DW-135 stall: the
only process-spawning suite on that tree that reaches WSL is a WSL suite that fails this way, and nothing else fails.

## Review Triage Log

Layers: Blind Hunter and `verification-loop`, both run inline by this workflow sub-agent (it has no tool to launch
review subagents); no Edge Case Hunter in the oneshot route. Findings and verdicts:

- A stall shorter than `STALL_MS` would fall through unnamed. **low, rejected**: 42 stalls observed in this story
  (7 diagnostic, 7 in the first eight-file run, 28 in the ten runs) ran 25291 ms to 30469 ms; 20 000 ms leaves room,
  and an unnamed stall fails exactly as before.
- A legitimate slow failure with output could be misnamed. **false**: the classifier needs a NUL on stdout or no
  output on either stream; a script's own failure writes text without NULs (the `'a script that failed slowly'` row of
  the third case pins this).
- No case drives `spawnBash` itself, only the pure classifier. **low, rejected**: the ten runs are the end-to-end
  proof (28 real stalls, each failing with the message), and a mocked `spawnSync` would test the mock.
- The CI path (`BASH === 'bash'`) never names anything. **false as a defect**: CI has no WSL layer to stall; the
  classifier's `wsl` default is that comparison, and the first case of "leaves every other result" pins `wsl: false`.
- `AGENTS.md`'s DW-135 line says "with empty output", which this story disproved. **medium, real, outside surface**:
  agent context, returned to the Operator (below), not edited here.
- `bashPath`/`posix`/`shPath` copies remain in each file. **low, rejected**: not part of the stall, and moving them
  widens a diff that does not need it.

## Ledger closures

No sprint-status action item names this story; it covers two deferred-work entries.

- **DW-135:** **Closed 2026-10-18 by Story 9-5-wsl-suite-failure-naming** (`de8b82a`,
  `ops/__tests__/wsl-bash.ts`:`spawnBash`): all seven WSL-spawning suites (`deploy-remote`, `library-backup`,
  `tracker-backup`, `postgres-backup`, `postgres-init`, `tournament-backup`, `demo-reset`) spawn bash through one
  helper, and a stalled spawn now fails the case as `WSL did not answer: ... exited 1 after <n> ms and wrote its own
  error, not the script's: "..."`, naming DW-135 and saying to re-run the file. The stall was never silent: `bash.exe`
  exits 1 after about 30 s with an empty stderr and its own UTF-16LE error on stdout (`Catastrophic failure` with
  `Error code: Bash/Service/E_UNEXPECTED`, or a connection-attempt timeout), which the harnesses never printed. Ten
  full verbose runs failed 28 cases on the stall and named all 28 (`spec-9-5-wsl-suite-failure-naming.md` § DW-210).
  The stall itself is the host's and still happens; a red local run of these files is now told apart from the change.
- **DW-210:** **Closed 2026-10-18 by Story 9-5-wsl-suite-failure-naming** (`spec-9-5-wsl-suite-failure-naming.md`
  § DW-210: ten verbose runs): ten `vitest --run --reporter=verbose` runs at `ae314fa` (on `dev` as
  `de8b82a`) failed 28 cases in 7 runs, every
  one a named WSL stall in a WSL-spawning suite, with no failure elsewhere and no duration swing outside those suites.
  On the 2026-09-03 tree (`75df819`) the only suite spawning WSL's bash was `library-backup.test.ts`, which fails five
  times in the ten runs on that stall. The lost case is attributed to DW-135 and closed with it.

## Verification

**Commands, run 2026-10-18 in this worktree:**
- `corepack pnpm exec vitest --run ops/__tests__/wsl-bash.test.ts`: `Tests 3 passed (3)`.
- The seven WSL suites plus the new one, first run: `Test Files 2 failed | 6 passed (8)`, `Tests 2 failed | 180
  passed | 1 skipped (183)`, both before the classifier matched the real shape (`expected 1 to be +0` in
  `tracker-backup`); the three backup files re-run alone: `Tests 46 passed | 1 skipped (47)`. Three diagnostic runs of
  the seven: 7 failed, then 180 passed 1 skipped twice.
- Full suite, ten times verbose (§ DW-210): 82 files, 1987 tests each; three runs `1986 passed | 1 skipped`, seven runs
  failing only named WSL stalls (1 to 11 cases).
- `corepack pnpm typecheck`: exit 0 on the tree committed as `ae314fa`, and again after the comment-only follow-up
  commit that records the observed stall range in `wsl-bash.ts`.
- No `apps/*` file changed, so no per-application suite applies.
- Added lines and this spec: 0 em-dashes, en-dashes, dash-standing double-dashes or emoji (read by `node`).

**Independent verifier:** PASS on round 1, 2026-10-18, separate agent; tests: all run in the story worktree at
`943c060` (rebased onto `dev` as `a59b796`, with `ae314fa` as `de8b82a` and `24c37d8` as `1094d9d`).
(1) `corepack pnpm typecheck`: exit 0 (checked with pipefail). (2) `corepack pnpm exec vitest --run
ops/__tests__/wsl-bash.test.ts`: 3 passed (3). (3) Planted failure: changed `result.status === 0 ||` to `false ||` in
`ops/__tests__/wsl-bash.ts`; the suite then failed 1 of 3 ("leaves every other result to the case that reads it",
`AssertionError: expected 'WSL did not answer: C:\WINDOWS\system...' to be null`); restored with `git checkout` and
the tree confirmed clean. (4) Full root suite, `corepack pnpm exec vitest --run`: 82 files, 1987 tests, 3 failed, 1983
passed, 1 skipped. The 3 failures were `demo-reset`, `tournament-backup` and `tracker-backup`, each a real host stall
reported as `Error: WSL did not answer: C:\WINDOWS\system32\bash.exe exited 1 after 29055 to 30219 ms and wrote its own
error, not the script's: ...` with either the `Catastrophic failure` / `E_UNEXPECTED` text or the connection-attempt
text: end-to-end proof that the new message fires on real stalls. Nothing failed outside the WSL suites. (5) The three
failing files re-run alone (the DW-135 procedure): 1 failed and 55 passed, the one failure another stall named as WSL
(connection-attempt, `Bash/Service/0x8007274c`). (6) All seven WSL suites together, twice: 7 of 7 files passed both
times (180 passed, 1 skipped). No `apps/*` file changed, so the per-application suites do not apply; `tests/e2e` and
the Hub's rendered output are untouched, so no container e2e ran.
