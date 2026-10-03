---
title: 'Story 5-10: One host-level reset scheduler for the estate'
type: 'feature'
created: '2026-10-03'
status: 'done'
baseline_commit: '9d703bc19ca7746634c86be2a8442c0a92d854da'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/ops/demo-principal.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** AD-13 and FR-26: Story 5.9 gave each participant a one-shot `demo:reset` command, and nothing runs it, so demo state is unbounded between by-hand runs. AD-13 rules out a timer inside each container on a CPU-bound box: one scheduler, on the host, hourly by default with a per-application override, often enough that two Visitors arriving the same day both find a usable application.

**Approach:** One committed bash scheduler, `ops/demo-reset.sh`, run from the box's checkout by one committed cron file, reading one committed schedule file, calling exactly the commands of `ops/demo-principal.md` § The reset item 7, one participant at a time under a lock. The record gains § The scheduler and its by-hand install. Installing it is the Operator's, after each participant's demo access is on.

## Boundaries & Constraints

**Always:** the commands are the record's, never restated; one summary line per run that did anything, with `exit=`; no secret read into an argument or printed; only tools the box already runs; every scratch Docker object named `epic5-scratch*` and removed.

**Never:** a timer in an application container; anything that runs on the box by itself on merge; a change to a participant's reset (5.9) or the Registry (5.11); a reader of the log (DW-315's, amended); the box, any `.env.*` file, the Operator's checkouts.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Due | tick on a participant's interval | its command runs in its directory, its one line passes through | its failure or timeout marks it failed, the next still runs, exit 1 naming it |
| Not due | tick off every interval | no command, no line | exit 0 |
| Off | `off` in the schedule | `skipped` line, no `docker` call at all | exit 0 |
| Overlap | another run holds the lock | nothing runs | one line, exit 1 |
| Stale lock | lock file left by a killed run | runs normally | none |
| Bad schedule or drifted cron | unknown id, missing id, bad interval; installed cron file differs | schedule: nothing runs; cron: resets run | exit 1 naming it |

</frozen-after-approval>

## Code Map

- `ops/demo-principal.md` § The reset item 7 (the three commands and directories), DP4 and DW-331 (one connection per running reset), § By hand and § Pending Operator actions (DP5 to DP7, DR1 to DR3 precede the install).
- `ops/postgres-backup.sh`: the host-job shape to reuse (`flock -n` on fd 9, a summary line from an EXIT trap, `timeout`, cron's `env -i` shape); the tools it runs on the box are the allowed set.
- `ops/__tests__/tournament-backup.test.ts`: the WSL bash launcher, `bashPath`, a `docker` stub on PATH.
- `ops/tracker-cutover.md` line 425: `TRACKER_TAG` read from the serving container's image; `HUB_TAG` the same way from `anchor-app`.
- `.gitattributes`: LF for files installed onto Ubuntu; the cron and schedule files join it.
- DW-315 (no log reader), DW-318 (installed copies drift), DW-331 (connection budget).

## Tasks & Acceptance

**Execution:**
- [x] `ops/demo-reset.sh`, `ops/demo-reset.schedule`, `ops/demo-reset.cron`, `.gitattributes`: the scheduler, its intervals, its one cron line.
- [x] `ops/__tests__/demo-reset.test.ts`: the matrix, under WSL bash with a `docker` stub and a PATH of the box's tools only.
- [x] `ops/demo-principal.md`: § The scheduler, its install (DS1 to DS3), the measured cost; DW-315 and DW-331 amended.

**Acceptance Criteria:**
- AC1: Given a tick where participants are due, when the scheduler runs, then it runs each due participant's record command in its directory, one after another, with `HUB_TAG` and `TRACKER_TAG` read from the serving containers for the tracker, and a test fails when a command differs from the record.
- AC2: Given one participant failing or exceeding its timeout, then every other due participant still runs and the run exits 1 with a summary naming it.
- AC3: Given a held lock, then the run starts nothing and exits 1 with one line; given a lock file with no holder, then it runs.
- AC4: Given a participant `off` in the schedule, then the run prints its `skipped` line and makes no `docker` call for it.
- AC5: Given the schedule (60 minutes each by default), when ticks fall at different times, then each participant runs exactly at the ticks its own interval names; an invalid or incomplete schedule runs nothing and exits 1.
- AC6: Given the cron file installed by `install` from the checkout, then cron runs the checkout's scheduler and schedule (DW-318), and a run whose installed cron file differs from the committed one exits 1 naming it; every run that did anything appends one summary line with `exit=` to its log, recorded against DW-315.
- AC7: Given a PATH holding only the tools the box is recorded to run, then every case passes.
- AC8: Given the three participants' real images run locally, then one full run's CPU cost and wall time are measured and recorded against load15 0.60, and the reset's connection is counted in DW-331.
- AC9: Root suite and typecheck pass.
- AC10 (Operator-pending): DS1 to DS3, the install after DP5 to DP7 and DR1 to DR3, and the first unattended runs read.

## Implementation Notes

- Order, stated plainly: an unattended builder with no subagent tool; Checkpoint 1 answered Approve, no open question remained. The spec was about 1425 tokens when written (5700 characters before § Verification, measured, at 4 per token): under 1600, no Split or Keep question arose. The record holds the detail (`ops/demo-principal.md` § The scheduler, items 1 to 10, § What a run costs, DS1 to DS3).
- Decisions the record states: cron (`/etc/cron.d/cuatro-demo-reset`, root-owned, as the box's other cron.d jobs) rather than a systemd timer, so its log reads the way the three backup logs do; a 15 minute tick with an epoch-aligned phase, so an interval needs no state file; `off` prints on the hourly ticks only; ids given as arguments run now, so a by-hand reset takes the lock.
- DW-318 avoided: cron runs the checkout's script and schedule, and every run `cmp`s the one installed copy (the cron file) against the checkout, exiting 1 on `differs` or `absent`. DW-315 not avoided: nothing reads `demo-reset.log`, filed as an amendment to DW-315 so its reader covers all four logs. DW-331 amended: one reset connection in the estate at a time.
- AC1 to AC7 (`ops/__tests__/demo-reset.test.ts`, 25 cases, WSL bash, a PATH of only `date dirname mkdir cmp tail cut flock timeout` and the `docker` stub). Mutants, each killed by at least one case: a failure that stops the run, no lock, `off` starting its container, the override ignored, the cron file never compared, `head` for `tail` (a tool not in the set: 9 cases fail with command not found), `--no-deps` dropped from `cs-tracker`'s command, a missing participant accepted, no timeout, the timed-out container left running, every one-off removed rather than this run's. Each mutant was restored by writing the original file back; the final run is 25 of 25.
- AC8: the three images built from Story 5.9's commits (`epic5-scratch-tracker`, `-cs-tracker`, `-library`) ran their reset commands against scratch stores: a full run 3.45 and 3.61 s wall, 4.17 and 4.63 VM CPU-seconds; each reset opened exactly 1 connection (Postgres `log_connections`), 0 with its switch off. The load15 arithmetic is derived, not observed on the box (DS3 observes it). Every scratch container, network, volume and the three images were removed; `docker ps -a`, `network ls`, `volume ls` and `images` list no `epic5` name. The build cache was left (never prune).
- Two claims checked in a Linux `docker:29-cli` container against this daemon (its project and runner named `epic5-scratch*`, removed): `timeout` on `docker compose run --rm` exits 124 and leaves the container `Up` (this became the removal, see the triage log); `git reset --hard` under a running bash script gives the file a new inode and the run finishes on the old text.
- AGENTS.md's DW-135 line now names seven WSL-bash suites: this one stalled a case at 30 s in the first full run and passed alone, as the other six did.
- AC9, on the final tree: `corepack pnpm typecheck` exit 0; `corepack pnpm test --run` 80 files, 1952 tests, 1937 passed, 1 skipped, 1 todo, 13 failed, every failure a case in one of the seven WSL-bash suites stalling at about 30 s (DW-135); each of the seven then passed alone: `demo-reset` 25, `tracker-backup` 11, `tournament-backup` 15, `postgres-init` 17, `postgres-backup` 20 and 1 skipped, `deploy-remote` 28, `library-backup` 59. `ops/__tests__/demo-principal.test.ts` 9 of 9. No Hub source changed, so no Hub build or rendered-output run was due.
- Not run: anything on the box (DS1 to DS3); `docker compose run` against the participants' real compose files (each command was run as `docker run --rm` of its image); a reset through the scheduler against the real images.

## Spec Change Log

## Review Triage Log

Review layers run inline by the builder (no subagent tool); the independent verifier is the context-free pass. Ponytail and the ECC verification loop were applied inline, not invoked as skills. Design review skipped: no `.scss`, `.tsx` or motion.

- medium, patched: a timed-out `docker compose run --rm` leaves its container running with the reset's connection and transaction, past the lock (observed). The scheduler now removes the one-off containers of that service it started, by compose's labels, and no earlier one; two cases and two mutants hold it.
- low, patched: `docker ps` (the tracker's tags) ran without a timeout, so a stalled daemon would hold the lock indefinitely; `timeout 30` now, as on the one-off listing.
- low, patched: the tick was computed before `DEMO_RESET_NOW` was validated; moved after it.
- low, rejected: `demo-reset.log` grows without rotation, about 4 lines an hour (about 3 MB a year); the backup logs share it and DW-315's reader is where rotation belongs.
- low, rejected: a participant whose serving image is gone makes `docker compose run` pull or build it (`digital-library` builds on the box); the image is present whenever the participant serves, and the failure would be visible in the log.
- low, rejected: a participant's command typed by hand outside the scheduler does not take the lock; the record (item 4) sends a by-hand reset through `ops/demo-reset.sh <id>`.
- Ponytail: three small files and one test; no state file (phase from the epoch), no config beyond the schedule, the commands kept as the record's literal words. Lean.

## Independent verification

**Round 1, 2026-10-03: pass.** A context-free verifier read the diff `origin/dev..317c3c0` against the acceptance intent in `epics.md` and AD-13, and re-performed every criterion's evidence on this host.

- AC1 to AC7: `ops/__tests__/demo-reset.test.ts` 25 of 25 alone. 21 mutants of `ops/demo-reset.sh`, each killed, twice with the same failing counts: a failure ignored, no lock, `off` running its container, the override ignored, the cron file never compared, a differing cron file exiting 0, no timeout, the timed-out container left, every one-off removed, a missing or duplicated participant accepted, the 1440 cap dropped, `--no-deps` dropped from the tracker's command, the library's command changed, the tags not exported, an empty tag accepted, the wrong directory, arguments ignoring `off`, no summary on success, a summary on a tick with nothing due, and `head` for `tail` (not in the box's tools, 9 cases fail).
- The timeout removal's premise, checked with a scratch compose project (`epic5-scratch-oneoff`, removed): `timeout 4 docker compose run --rm --no-deps` exits 124, its container stays `Up` and carries `com.docker.compose.oneoff=True` and the project's absolute `working_dir`, the labels the scheduler filters on.
- AC8: the three images rebuilt from the same commits (`epic5-scratch-tracker`, `-cs-tracker`, `-library`, removed afterwards) and run through the builder's harness on scratch stores: a full run 3.43 and 3.55 s wall, 4.06 and 4.42 VM CPU-seconds; each reset 1 connection, 0 with its switch off. Within noise of § What a run costs.
- AC9: `corepack pnpm typecheck` exit 0. `corepack pnpm test --run` 80 files, 1952 tests, 12 failures, each a 30 s stall in one of the seven WSL bash suites (DW-135); each of the seven then passed alone (`demo-reset` 25, `tracker-backup` 11, `tournament-backup` 15, `postgres-init` 17, `postgres-backup` 20 and 1 skipped, `deploy-remote` 28, `library-backup` 59). No application code changed, so no Hub build or rendered-output run was due.
- AC10 stays the Operator's: DS1 to DS3.
- Minor, not blocking: `docker compose run` without a TTY writes its own `Container ... Creating` and `Created` lines to stderr (seen in the check above), so the log and DS2's output carry them beside each participant's line, which item 8 and DS2 do not mention; and `tag_of` takes the last line of `docker ps`, the oldest container, so during a by-hand tracker rollout `TRACKER_TAG` can name the outgoing image.

## Verification

**Commands:**
- `corepack pnpm vitest run ops/__tests__/demo-reset.test.ts ops/__tests__/demo-principal.test.ts`: expected: all pass.
- `corepack pnpm typecheck`, `corepack pnpm test --run`: expected: exit 0 (WSL-bash suites re-run alone on a DW-135 flake).
