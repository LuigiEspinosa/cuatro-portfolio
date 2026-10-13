---
title: 'Epic 5 retro action 3 (M3): a failed or hollow reset run is visible'
type: 'bugfix'
created: '2026-10-13'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'd29e7e91ac2e42c7ce33117cbfa6984793897e31'
context: []
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** a failed reset run's `exit=1` reaches only `/home/deploy/demo-reset/demo-reset.log`, which nothing reads, and a participant whose principal vanished prints `skipped: the demo principal is absent` with exit 0, so visitor edits could pile up unseen (retro M3).

**Approach:** the scheduler treats any `skipped` reason but `demo access is off` from a participant it ran, and any exit 0 without a reset or skipped line, as a failure, and the first failing run of a streak opens a GitHub issue in this repository with its summary line, through `curl` and a header file the Operator installs. `digital-library`, which has no demo account until DW-337, goes `off` in the schedule so it does not fail every hour.

## Boundaries & Constraints

**Always:** the token never enters the script, its argv or the log (curl reads the header file itself, `-H @file`); one issue per failing streak, not one per tick; a refused or unconfigured report never changes the run's exit code; every box, GitHub and token step is a dated Pending row in `ops/demo-principal.md` and a step of its § By hand.

**Never:** a heartbeat monitor (the UptimeRobot free plan refused the type, `ops/monitoring.md`, 2026-09-12); a change to any participant's own reset contract (§ The reset item 6 stays: skipped, exit 0); closing issues automatically.

## I/O & Edge-Case Matrix

| Scenario | State | Behaviour |
|---|---|---|
| Hollow | a scheduled participant prints `skipped: the demo principal is absent` (or any reason but `demo access is off`) | stderr `demo:reset <id> failed: skipped (<reason>) while the schedule runs it`, named in `failed=`, exit 1 |
| Silent | a scheduled participant exits 0 and its last stdout line is neither `reset rows=<n>` nor a `skipped` | stderr `demo:reset <id> failed: exit 0 without its reset or skipped line`, named in `failed=`, exit 1 |
| App switch off | `skipped: demo access is off` | passes, exit 0, as today |
| First failure of a streak, header file present | exit 1 | one POST to the issues API; `issue=opened` on 201, else `issue=refused`, marker not set |
| Streak continues | marker set | no POST, `issue=open` |
| Recovery | a run that did something exits 0 | marker cleared, `issue=none` |
| No header file | exit 1 | no POST, `issue=unconfigured` |

</frozen-after-approval>

## Code Map

- `ops/demo-reset.sh`: `run_one` captures the participant's stdout and judges its last line; `report` and `finish` add `issue=` to the summary, POST the issue and keep the streak marker.
- `ops/demo-reset.schedule`: `digital-library off` until DW-337.
- `ops/__tests__/demo-reset.test.ts`: docker stub gains `STUB_ABSENT` and `STUB_SILENT`; a `curl` stub records argv and body; the run's PATH holds only the box's tools plus the two stubs.
- `ops/demo-principal.md`: § The scheduler items 2, 5, 8, 10 amended, item 11 added; § By hand step 15 amended, steps 17 (DS4) and 18 (DS5) added; Pending rows DS4 and DS5.
- `ops/monitoring.md`: dated note under the HEARTBEAT refusal naming the issue path.
- `deferred-work.md`: DW-315 and DW-337 amended.
- Reused: the `/etc/cuatro/*` install form `root:deploy 0640` (`ops/postgres-backup.md` § Install); the issue title form of `deploy.yml`; `curl` observed on the box 2026-08-24 (`ops/backup-digital-library.md`).

## Tasks & Acceptance

**Execution:**
- [x] `ops/demo-reset.sh`: hollow and silent rules, issue report (M3).
- [x] `ops/demo-reset.schedule`: `digital-library off`, else every run fails until DW-337.
- [x] `ops/__tests__/demo-reset.test.ts`: a case per matrix row, and the committed schedule's new shape.
- [x] `ops/demo-principal.md`, `ops/monitoring.md`, `deferred-work.md`: the record and runbook.
- [x] `sprint-status.yaml`: row 47 to `in-progress` with a comment naming the verifier and DS4, DS5.

**Acceptance Criteria:**
- Given the suite, when each matrix row runs against the stubs, then status, lines and curl calls match the matrix, and the POST body carries the summary line and no header value.
- Given `ops/demo-principal.md`, when read, then § By hand carries the header-file install (DS4) and a proof run (DS5), and the Pending table leaves both undated.
- Given the committed schedule, when the hourly tick runs, then the two trackers run, `digital-library` prints its `off` line, and the run exits 0.

## Design Notes

An issue over a heartbeat: the only monitor service is on a plan that refuses heartbeats, and an issue reaches the same mailbox `deploy.yml`'s failure issues do. The scheduler stopping outright (cron removed, box down) still opens nothing: the HTTP monitors see a down box, and a removed cron file is a named limit in § The scheduler item 11.

The silent rule is stricter than the retro's wording: § The reset item 8 already promises exactly one stdout line at exit 0, so a participant that prints none (or an unrelated last line) is as hollow as an absent principal. `cs-tracker`'s off and absent are one state that prints `demo access is off` (checked in `lib/cs_tracker/demo_reset.ex` on its `origin/dev`), so the absent rule cannot fire for it; `digital-library` has no switch but its account, hence `off` in the schedule.

Oversize check: the spec is above 1600 tokens only by the matrix row added for the silent rule; no Split or Keep was asked, as this is a retro item handed to an unattended builder with the scope fixed by the board row.

## Implementation Notes

- The first commit the orchestrator asked for (the previous verifier's three minor findings) was found already made: `d29e7e91ac2e42c7ce33117cbfa6984793897e31` adds the `compose.test.ts` case removing only `tracker-migrate-demo`'s `DATABASE_URL` line (line 401), names `tracker-migrate-demo` in `ops/estate.md` § Migrations and `ops/postgres.md`'s consumer row, and defines `$C` inside `ops/tracker-cutover.md` Pending action 9. No empty commit was made.
- This work was found partly built in the working tree by an earlier interrupted run of this story (script, schedule, tests, record); this run reviewed it against the participants' code, added the silent rule and its case, the `ops/monitoring.md` note and the board row, and ran the tests.

**Tests run (2026-10-13, this host):**
- `corepack pnpm vitest run ops/__tests__/demo-reset.test.ts`: `Test Files 1 passed (1)`, `Tests 30 passed (30)`, 29.30 s.
- `corepack pnpm test --run`: `Test Files 7 failed | 73 passed (80)`, `Tests 26 failed | 1953 passed | 1 skipped (1980)`, 200.25 s. Every failure was in the seven WSL-bash suites (each case about 30 s with empty output, DW-135) and nowhere else.
- Each of those seven re-run alone, all passing: `demo-reset` 30 passed; `deploy-remote` 28 passed; `library-backup` 59 passed; `postgres-backup` 20 passed, 1 skipped; `postgres-init` 17 passed; `tournament-backup` 15 passed; `tracker-backup` 11 passed.
- No CI workflow was read: nothing is pushed (the verifier pushes).

## Operator steps (each a dated Pending row)

- `ops/demo-principal.md` DS4: create a fine-grained token (Issues read and write on `cuatro-portfolio` only), install `/etc/cuatro/demo-reset-issue.header` on the box per § By hand step 17, and write the token's expiry date in the row.
- `ops/demo-principal.md` DS5: after the Epic 5 retrospective changes reach `main` with the Operator's merge and the Deploy runs, prove one issue per § By hand step 18 and close it.

## Verification

_Filled by the independent verifier._
