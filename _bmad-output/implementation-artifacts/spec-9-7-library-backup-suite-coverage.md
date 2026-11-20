---
title: 'Story 9-7: exercise the traps, the sudo fallback and the tar retry in library-backup'
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

**Problem:** DW-133: three orchestration paths of `ops/library-backup.sh` are never executed by
`ops/__tests__/library-backup.test.ts`. The signal traps are checked only as source text, the
unreadable-config case uses a directory (so `[ -e ]` is already true and `|| sudo test -e` is never
consulted), and no case makes `tar` fail, so the `changed as we read it` retry and its two summary
fields never run.

**Approach:** Add behavioural cases that run the real script against the existing stub box: a
`sqlite3` stub that signals its parent bash mid-snapshot, a `sudo` stub that answers `test -e` for a
path this account cannot see, and a `tar` stub that fails the first N archive creations and delegates
to the real `tar` otherwise. `ops/library-backup.sh` is unchanged (epic-9 plan row 7: no box
re-install). Every new assertion is planted against a temporary edit of the script and the failure is
recorded below.

</frozen-after-approval>

## Implementation Notes

Graphify prepend skipped: the change is one test file whose structure was read directly. Sprint-status
sync skipped: the orchestrator's push step owns `sprint-status.yaml`.

Files changed: `ops/__tests__/library-backup.test.ts` only.

- Stubs: `sqlite3` gains `STUB_SQLITE_SIGNAL` (after `.backup`, `kill -s <sig> $PPID`; the `sudo` stub
  execs, so the parent is the backup's own bash, which holds the signal until the child exits and then
  runs the trap). `sudo` gains `STUB_SUDO_SEES` (answers `test -e <that path>` with 0). New `tar` stub
  in `STUBS`: fails the first `STUB_TAR_FAILS` `-cf` calls with `STUB_TAR_MESSAGE`, counts every `-cf`
  call in `STUB_TAR_COUNT`, and execs `/usr/bin/tar` or `/bin/tar` otherwise, so every other case still
  runs the real `tar`. The five names are added to `SCRIPT_VARIABLES`. Header comments updated.
- Cases: `an offsite config that exists and cannot be read` > `asks sudo before calling a config
  absent...`; `a signal mid-run` (INT 130, TERM 143, HUP 129); `a tar that fails` (retry succeeds,
  retry fails, failure of another kind). The source-text trap case stays: it also covers
  `library-restore-verify.sh`, which this story does not exercise.
- The new cases assert with `expect.soft`, so one planted fault reports every assertion it breaks;
  that is how each assertion below has a recorded failure rather than only each case's first.
- The other-kind case pins `tar=first-attempt` beside `archive=failed`, the script's current output.
  DW-133 called that field misleading; changing it is a script change, out of this story's
  "unchanged" boundary, and is returned to the Operator.
- Fixture assertion `existsSync(box.config) === false` was dropped: no script fault can fail it.

### Planted failures

Each plant was a `sed -i` on `ops/library-backup.sh`, run with `vitest --run -t <describe>`, then
`git checkout -- ops/library-backup.sh`. Output is vitest's `AssertionError` lines, abridged to one
per assertion.

- **A** traps to `trap ':' INT|TERM|HUP`: all three signal cases. `expected +0 to be 130` (status, and
  143, 129); `expected '0' to be '130'` (exit field, and 143, 129); `expected 'ok' to be
  'not-reached'` (snapshot); `expected [ Array(1) ] to have a length of +0 but got 1` (no archive).
- **B** `release_work` first line to `return 0`: `the scratch directory holding the plaintext snapshot
  survived: expected [ 'library-backup-GcmYrC' ] to deeply equal []` (all three).
- **C** `release_lock` first line to `return 0`: `the lock survived the signal: expected true to be
  false` (all three).
- **D** delete `|| sudo test -e "${CONFIG_FILE}" 2>/dev/null`: `expected 75 to be 1`; `expected
  'not-configured' to be 'config-unreadable'`; `expected 'library-backup: the local half is com...' to
  contain 'Do not create it again'`; `... not to contain 'to finish this, create'`.
- **E** grep string to `changed as we wrote it`: retry-succeeds case: status fails with `cannot
  archive ... file changed as we read it`; `expected 1 to be 2` (attempts); `expected 'first-attempt'
  to be 'retried-once-after-file-changed'`; `... to contain 'retrying once'`; `expected false to be
  true` (a `.tar.gz.gpg` archive). Retry-fails case: `expected 1 to be 2`; `expected 'first-attempt' to
  be 'retried-once-and-failed'`; `... to contain 'even after one retry'`.
- **F** grep pattern to `''` (retry everything): other-kind case: `expected +0 to be 1` (status);
  `expected 2 to be 1` (attempts); `expected 'retried-once-after-file-changed' to be 'first-attempt'`;
  `expected 'library-20261018T214112Z.tar.gz.gpg' to be 'failed'`; `... not to contain 'retrying
  once'`; `expected '/usr/bin/tar: library.db: time stamp ...' to contain 'Permission denied'`;
  `expected [ Array(1) ] to have a length of +0 but got 1`.
- **G** retry-failure field to `first-attempt`: `expected 'first-attempt' to be
  'retried-once-and-failed'`.
- **H** retry-success field to `first-attempt`: `expected 'first-attempt' to be
  'retried-once-after-file-changed'`.
- **K** `sudo rm -f "${TARBALL}"` to `run_tar` (a second retry): retry-succeeds `expected 3 to be 2`;
  retry-fails `expected +0 to be 1`, `expected 3 to be 2`, `expected 'retried-once-after-file-changed'
  to be 'retried-once-and-failed'`, `expected 'library-20261018T214134Z.tar.gz.gpg' to be 'failed'`,
  `... to contain 'even after one retry'`, `expected [ Array(1) ] to have a length of +0 but got 1`,
  `expected true to be false` (no curl call).

After every plant, `git diff --quiet -- ops/library-backup.sh` held: the script is unchanged.

### Tests run

- `corepack pnpm exec vitest --run ops/__tests__/library-backup.test.ts -t "signal mid-run|tar that fails|asks sudo"`:
  7 passed, 59 skipped (66).
- `corepack pnpm test -- --run`, first run: 4 failed, 1989 passed, 1 skipped (1994) across 82 files.
  Only the output's tail was kept; the one failure visible there is a WSL-spawning ops suite's
  `is not named pg-<database>-<stamp>` case, the DW-135 shape. Re-run per AGENTS.md: 1993 passed,
  1 skipped (1994), 82 of 82 files.
- `corepack pnpm typecheck`: exit 0.
- No `apps/*` file changed, so no per-app suite applies.

## Review Triage Log

The Blind Hunter layer could not be launched: this run had no subagent tool. Its prompt is the
step's own text, unchanged; the independent verifier below is the separate check. The findings below
are this run's inline pass, which is not a review layer of record.

- `low`, rejected: `attempts` reads `STUB_TAR_COUNT` with `readFileSync`, which throws ENOENT rather
  than failing an assertion if `tar` is never reached. Loud either way, and every case reaches stage 4.
- `false`: the `tar` stub could change the restore verify's `tar -xzf`. It matches only a first
  argument of `-cf` and execs the real binary for everything else; the restore cases stay green.
- `false`: `snapshot=not-reached` could race. Bash runs a pending trap as soon as the waited child
  exits and before the next command, so the assertion is deterministic; plant A shows it failing.

## Ledger closures

- **DW-133**: **Closed 2026-10-18 by Story 9-7-library-backup-suite-coverage**
  (`ops/__tests__/library-backup.test.ts`: `a signal mid-run`, `a tar that fails`, and `an offsite
  config that exists and cannot be read` > `asks sudo before calling a config absent`): each of the
  three paths now runs for real. A stub signals the backup's bash while it waits on the snapshot, and
  INT, TERM and HUP each exit 130, 143 and 129 with one summary line, no scratch directory and no
  lock; a `sudo` stub sees a config the account cannot, and the run exits 1 with
  `offsite=config-unreadable` rather than 75; a delegating `tar` stub drives the retry that succeeds,
  the retry that fails, and a non-retried failure. Each assertion's planted failure is in the spec.
  `ops/library-backup.sh` is unchanged, so the `tar=first-attempt` reading beside `archive=failed` on
  a non-retried failure is pinned as it stands, and its wording is an Operator question, not open
  work here.

No action items are named for this story.

## Independent verifier

Independent verifier: PASS on round 1, 2026-10-18, separate agent; tests: all commands ran in
`C:\CuatroEcosystem\epic9-wt\9-7-library-backup-suite-coverage`.
(1) `corepack pnpm exec vitest --run ops/__tests__/library-backup.test.ts`: 66 passed, 0 failed.
(2) Its own plant check: three temporary edits to `ops/library-backup.sh` (the TERM trap became
`trap ':' TERM`, the `|| sudo test -e` fallback was deleted, and line 386's `v_tar` became
`'not-retried'`), then `vitest -t "signal mid-run|tar that fails|asks sudo"`: 3 failed, 4 passed,
59 skipped. The failures were exactly the expected cases: the sudo case (75 vs 1, not-configured vs
config-unreadable, plus both stdout assertions), only the TERM signal case (0 vs 143, exit field,
snapshot ok vs not-reached, archive count), and the other-kind tar case (`'not-retried'` vs
`'first-attempt'`). The script was restored with `git checkout`, and
`git diff --quiet origin/dev -- ops/library-backup.sh` held afterwards.
(3) `corepack pnpm test -- --run`, first full run: 2 failed, 1991 passed, 1 skipped (1994), 80 of 82
files. `demo-reset` failed with WSL `Catastrophic failure E_UNEXPECTED`, and the existing
library-backup `carries the timeouts` case failed after about 40s with empty stderr, both the DW-135
shape. (4) Those two files re-run: 96 passed, 0 failed. (5) `corepack pnpm test -- --run`, second
full run: 1993 passed, 1 skipped (1994), 82 of 82 files, 0 failed. (6) `corepack pnpm typecheck`:
exit 0. No `apps/*`, `ci.yml`, `contracts/`, `tests/e2e` or rendered-output change, so no per-app
suite and no container e2e run.
