---
title: 'Story 4-5: pg_dump on cron plus restic offsite'
type: 'feature'
created: '2026-09-30'
status: 'awaiting-operator'
baseline_commit: '955537e1f9aa632bb4dd6dcb95b58616994efa51'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/ops/postgres.md'
  - '{project-root}/ops/backup-digital-library.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** Story 4-4's estate Postgres (`postgres-estate-postgres-1`) has no backup, so no consumer may move onto it (DW-301), and AD-10 names the estate's backup as `pg_dump` on cron plus restic offsite, verified by a real restore.

**Approach:** `ops/postgres-backup.sh` dumps every consumer database of the instance nightly (one `-Fc` file, a `.counts` and a `.sha256` each, counts read inside the dump's own snapshot), keeps fourteen days locally, sends the run offsite with restic from its official pinned image, forgets on a stated retention, checks the repository, restores the run back from it and proves it with `ops/postgres-restore-verify.sh` (a throwaway Postgres 18.6 with no network). Record and runbook in `ops/postgres-backup.md`; box steps are the Operator's.

## Boundaries & Constraints

**Always:** shape of `ops/tracker-backup.sh` and `ops/tournament-backup.sh` (no `set -e`, one summary line on every path including a signal, a failed run removes what it half wrote, `find -mtime +14` prune only after a good run); exit 0 all proved, 75 offsite not configured (local half done and verified, the library's idiom), 1 anything else; secrets only in `/etc/cuatro/postgres-backup.env` (root:deploy 0640, outside every checkout) read by `docker --env-file`, never sourced, never in argv; the throwaway container `--network none`, removed with its volumes on every path; both scripts LF, 100755, shellcheck clean; proof quotes real output.

**Never:** write to the box; touch `digital-library`'s scripts, bucket, token or lifecycle rule; install restic on the host; point-in-time recovery; move a consumer; change the tracker's or tournament's backups; weaken a gate.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Nightly, configured | instance up, repository initialized | three files per database, restic snapshot, forget, check, restore of that snapshot, verify passes, prune; exit 0 | N/A |
| Writes during the dump | a writer inserting throughout | counts equal the dump's snapshot; verify passes | N/A |
| Config absent | no env file | local dumps verified from local disk, prune; exit 75 `offsite=not-configured` | N/A |
| Config bad | unreadable, or `RESTIC_REPOSITORY`/`RESTIC_PASSWORD` empty, or repository not initialized | exit 1 naming which; no prune | message names the fix |
| Count mismatch | restored table differs from `.counts` | verify exit 1 naming database and table | container removed |
| Dump fails | `pg_dump` non-zero | exit 1, this run's files removed, older ones kept | N/A |

</frozen-after-approval>

## Code Map

- `ops/tracker-backup.sh`, `ops/tracker-restore-verify.sh`: stage and summary shape, `finish` trap, `fail`, TCP `pg_isready` loop, throwaway `--network none` container. Reuse the shape, not the files.
- `ops/tournament-backup.sh:122-130`: the one-query `xpath(query_to_xml(...))` count, reused across all non-system schemas; `:147-153` the prune.
- `ops/library-backup.sh` and `ops/backup-digital-library.md` § The three exits, § Configuration: exit 75, `/etc/cuatro/*.env` root:deploy 0640. Unchanged.
- `ops/postgres/compose.yml`: image `postgres:18.6-trixie`, project `postgres`, container `postgres-estate-postgres-1`; `ops/postgres.md` § Moving a consumer's precondition, Pending action 2.
- `ops/__tests__/tracker-backup.test.ts`: WSL bash launcher, docker stub on PATH; the new suite copies its shape. `ops/__tests__/postgres-init.test.ts:168`: the 100755 index check.
- `ops/settled-inputs-refresh.md:33`: restic 0.19.1 is current.
- Board row `4-5`; `deferred-work.md` DW-301 (owned by 4.7/4.8/4.10; left alone).

## Tasks & Acceptance

**Execution:**
- [x] `ops/postgres-backup.sh`: flock lock, list consumer databases, per database a psql session (over two FIFOs) exporting a REPEATABLE READ snapshot, `pg_dump -Fc --snapshot`, counts in that session, `pg_restore --list`, sha256; restic stages from `restic/restic:0.19.1` (`cat config`, `backup --json`, `forget --group-by host,tags --keep-daily 14 --keep-weekly 8 --keep-monthly 6 --prune`, `check`, `restore <id>`), roundtrip compare, verify, prune, the nightly job.
- [x] `ops/postgres-restore-verify.sh`: one throwaway `postgres:18.6-trixie`, each dump restored `--no-owner --no-acl --exit-on-error` into a database of its name, table set and counts equal, the proof by restore.
- [x] `ops/__tests__/postgres-backup.test.ts`: the I/O matrix against a docker stub, the retention flags, the verify image equal to the compose image, LF and 100755.
- [x] `ops/postgres-backup.md`: decisions, retention, cost, RPO/RTO, the PITR deferral, the library's path unchanged, the local proof, install, cron line, first run, Pending Operator actions.
- [x] `sprint-status.yaml`: `4-5: awaiting-operator`, dated comment.

**Acceptance Criteria:**
- Given a local Postgres 18.6 with two databases and planted rows, when the backup runs against a local restic repository, then it exits 0 with a snapshot, a forget, a check and a verified restore, quoted.
- Given a row planted after the dump and counted into `.counts`, when the verify runs, then it fails naming the table, quoted.
- Given the restic repository, when a snapshot is restored by hand and verified, then it passes, quoted.
- Given the change, when typecheck, the Hub build and the full suite run, then all pass.

## Implementation Notes

- Implemented inline (no subagent tool in this run). Box read 2026-09-30T11:51:43Z, read-only: `crontab -l` (three jobs, 03:30 and two at 03:45), `ls -l /etc/cuatro` (only `library-backup.env`, `root:deploy 0640`), `df -h /home` (77G free), `command -v restic flock timeout sha256sum` (no restic), `docker ps` (no estate instance yet), listings of `/home/deploy/backups` (the tracker's dump is 22,310 bytes). Nothing written.
- Local proof in Docker, quoted in `ops/postgres-backup.md` § Rehearsed off the box, final run 2026-09-30T12:12:11Z to 12:13:31Z as a non-root `deploy` in the cron shape against `postgres:18.6-trixie` and a restic 0.19.1 repository on disk (official image; restic is not installed on the host). Every throwaway removed 12:13:41Z.
- Found by the proof: the first draft removed a night's whole dumps when its offsite half failed; whole dumps are now kept and only a failed dump stage removes this run's files. The not-initialized message named a section that did not exist; it now names § Install and first run, step 4.
- Found by the suite under full-suite load: the counting session as a bash `coproc` lost its read descriptor when bash reaped the finished `psql` (`Bad file descriptor`), so it now runs over two FIFOs in a `mktemp -d` directory the exit trap removes. Three concurrent suite runs then passed.
- Deviation from the literal proof instruction, stated in the record: counts are read inside the dump's snapshot, so a row planted after the dump cannot reach `.counts` by itself; the planted-row proof rewrites that table's line with the live count (what a post-write count would hold) and the verify fails naming `cuatro_tracker: public.user`. The writer run shows the snapshot property itself (live 292 to 713, dump and counts agree on 298).
- The unreadable-config suite case is skipped on Windows, where WSL's bash ignores a mode set on `/mnt/c`; CI runs it on Linux as a non-root runner, and the real path is in the rehearsal (`offsite=config-unreadable`).
- Mutation-checked: dropping `--group-by host,tags` failed 1 case; dropping `--snapshot` failed 16; never setting `DONE=1` failed 9.
- DW-303 filed: the new suite shows the DW-135 WSL flake shape, and AGENTS.md's pitfall names three files. DW-301 is owned by 4.7, 4.8 and 4.10 and left untouched; this story is the precondition it names.

## Spec Change Log

## Review Triage Log

Six layers run inline (no subagent tool in this run): blind hunter, edge-case hunter with the claims check, verification gap, ponytail, ECC verification loop, design (skipped: no `.scss` or `.tsx` and no motion in the diff).

| # | Layer | Finding | Verdict | Evidence and route |
|---|---|---|---|---|
| 1 | ponytail | `POSTGRES_RESTIC_IMAGE`, `POSTGRES_RESTORE_VERIFY` and `POSTGRES_VERIFY_IMAGE` overrides nothing sets, not even the suite | low | real dead flexibility. Patch: constants; the suite pins the constants; the record says the proof ran with the defaults they became |
| 2 | blind | A run killed mid-restic (timeout, reboot) leaves a repository lock, and the next night fails with no named remedy | low | restic 0.19 containers get a fresh hostname each run, so the stale-lock check falls back to age. Patch: the exits table names `restic unlock` |
| 3 | claims | Frozen Always: "a failed run removes what it half wrote"; a night whose offsite fails keeps its dumps | false | the kept files are whole (written, listed by `pg_restore --list`, checksummed); only the dump stage writes partial files and it still removes them. The record states the rule |
| 4 | claims | Tasks said "coproc psql session" | low | implementation moved to FIFOs (note above). Task text corrected |
| 5 | edge | Verify's own summary line lands in the backup log before the job's | false | the job's line is last and starts `postgres-backup ts=`; the verify line is evidence the log should keep |
| 6 | edge | A database name outside `^[a-z_][a-z0-9_]*$` fails the whole night | false | deliberate and loud, stated in § The method stage 2; every estate name is AD-3 shaped (`ops/postgres/init/10-consumers.sh`) |
| 7 | verification-gap | Nothing in CI runs the scripts against a real Postgres or restic; the suite drives a stub | low | same boundary as `tracker-backup.test.ts`; every night's own verify fails loudly if the snapshot or restore path breaks, and the rehearsal is quoted. Rejected: a CI job changes both suites pinning `ci.yml` for a path the nightly already proves |
| 8 | verification-gap | Unreadable-config case skipped on this host | low | runs in CI (ubuntu-latest, non-root); real path quoted in the rehearsal. Rejected |
| 9 | ECC loop | typecheck, Hub build, full suite | false | all exit 0 on the final tree (Verification below); lint N/A (no lint command, AGENTS.md) |

## Design Notes

**Oversized spec, kept.** About 1,850 tokens (7,412 characters over four) against the 1,600 guide. The Operator's instruction of 2026-09-30, relayed by the orchestrator for this spec, is Keep: the dump, its offsite copy and its proof by restore are one backup path, and splitting would ship a backup nobody has restored.

**Restic, not the SigV4 client (Operator may overrule).** The library's decision stands for the library: a few kilobytes, write-only token, no third-party binary on the host. The estate's Postgres differs: AD-10 names restic, several databases a night want snapshots, retention and `check`, and restic runs from its official image pinned to 0.19.1, so nothing is installed on the host. `forget --prune` needs delete, which a bucket-scoped R2 token cannot confine to a prefix, so the repository lives in **its own R2 bucket** in the same account (`cuatro-postgres-backups`, suggested): no new vendor, $0 at this volume, and the library's bucket and token keep their blast radius.

**Counts in the dump's snapshot.** Umami writes on every page view, so counts read after the dump would fail the nightly by race; the tracker's model assumed stopped writers.

**Retention:** local 14 whole days; offsite 14 daily, 8 weekly, 6 monthly, grouped by host and tag (dated paths would otherwise make every snapshot its own group and nothing would ever be forgotten).

## Verification

**Commands:**
- `corepack pnpm typecheck`; `corepack pnpm --filter hub build`; `corepack pnpm test --run`: exit 0.
- `koalaman/shellcheck:stable` on both scripts: no finding.
- Docker proof per the ACs: output quoted in `ops/postgres-backup.md`, throwaways removed.

**Results, 2026-09-30, final tree:** typecheck exit 0; Hub build exit 0; shellcheck (`koalaman/shellcheck:stable`) on both scripts exit 0 with no finding; `ops/__tests__/postgres-backup.test.ts` 20 passed, 1 skipped (the unreadable-config case, Windows only), alone and three times concurrently. Full suite: two runs each failed four or five cases in the five WSL bash suites (`deploy-remote`, `library-backup`, `postgres-backup`, `tournament-backup`, `tracker-backup`) after about 30 s with empty output (DW-135 shape, DW-303); the third run 75 of 75 files, 1832 passed, 1 skipped, exit 0. Docker proof as quoted in `ops/postgres-backup.md` § Rehearsed off the box, every throwaway removed.
