---
title: 'Epic 3 retrospective items 4, 5 and 6: the tournament store''s nightly dump, three ledger closures and the L1 and L2 hazards'
type: 'chore'
created: '2026-09-30'
status: 'done'
baseline_commit: '23ca942f2fe261e2345e0594aa816761d544cbf9'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-retro-2026-09-30.md'
  - '{project-root}/ops/tournament-placement.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** The tournament's store (Supabase Cloud, `Live` since Registry 1.7.0) has no recorded copy
off Supabase's side: the only dump is the hand-taken pre-migration one (retro M4, AD-10). Three ledger
entries read `open` though Epic 3 resolved them (M5), and two hazards the retrospective found have no
ledger entry (L1, L2).

**Approach:** Add `ops/tournament-backup.sh` (nightly `pg_dump -Fc` through the pooler inside
`postgres:17-alpine`, into `/home/deploy/backups/cs-tournament`, with `.sha256` and `.counts`, fourteen
days kept) and `ops/tournament-restore-verify.sh` (restore into a throwaway Postgres 17 with no network,
compare counts and the migration ledger), cover both with a stubbed suite, prove both against a real
Postgres 17 here, and write the runbook section and the AD-10 record. Close DW-259, DW-266 and DW-274,
file three DW entries, amend DW-275, and mark board items 5 and 6 done.

## Boundaries & Constraints

**Always:** the shape of `ops/tracker-backup.sh` and `ops/tracker-restore-verify.sh`: no `set -e`, one
summary line on every exit path including signals, exit 0 or 1, a failed run removes what it half wrote,
the throwaway container removed on every path. The database URL is read from the env file, never
`source`d, and reaches the container through the environment, never argv. Files `0600`.

**Never:** touch the box, push, branch, or open a PR; edit `AGENTS.md`, `_bmad/`, or the frozen
evidence under `ops/routing-inventory.md` § Backup coverage; prune anything but `tournament-*` (the
`pre-migrations-*` dump stays); mark board item 4 done.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Nightly run | env file names the URL, store reachable | `tournament-<stamp>.dump`, `.counts`, `.sha256`; prune of `tournament-*` over 14 whole days; summary `exit=0` | N/A |
| No URL | env file missing or lacks `TOURNAMENT_DATABASE_URL` | exit 1, nothing written | named on stderr |
| Dump fails / unreadable | `pg_dump` non-zero, or `pg_restore --list` refuses | exit 1, `dump=failed` or `list=unreadable`, no files left, no prune | summary line |
| Verify happy | intact dump, counts match, every migration file's version in the ledger | `sha256=match restore=ok ... migrations=29-applied-0-pending exit=0` | N/A |
| Row planted after dump | the store gained a row between dump and counts | exit 1 naming the table and both counts | container removed |
| Tampered / missing migration | sha256 differs; a version absent from the ledger | exit 1 `sha256=mismatch` before any container; the missing version named | container removed |

</frozen-after-approval>

## Code Map

- `ops/tracker-backup.sh`, `ops/tracker-restore-verify.sh`: the shape to copy; the tracker dumps from a
  local container by `docker exec`, the tournament from a remote pooler by `docker run --rm`.
- `ops/__tests__/tracker-backup.test.ts`: the stubbed-docker suite and WSL launcher to mirror.
- `ops/library-backup.sh:230-243`: the `find -mtime +14` prune and its summary wording.
- `apps/tournament/supabase/migrations/`: 29 files `NNNN_name.sql`; Supabase records `NNNN` as
  `supabase_migrations.schema_migrations.version`. `0002_rls.sql` bodies call `auth.jwt()`, policies name
  `anon`, `authenticated`, `service_role`; no public object references another schema outside a body.
- `ops/tournament-placement.md` § Placement run step 9: the pooler route and the pre-migration dump.
- `ops/estate.md` § `cs-tournament`, bullet "Data, the AD-10 exception": where the record goes.
- `ops/backup-digital-library.md`: has no per-project coverage table (it points at
  `ops/routing-inventory.md` § Backup coverage, which is frozen 2026-08-24 evidence), so neither is edited.
- `.gitattributes`: `*.sh text eol=lf` already covers both scripts (`git check-attr` says `lf`).
- `deferred-work.md` DW-259 (8197), DW-266 (8385), DW-274 (8564), DW-275 (8587); highest id DW-291.
- `sprint-status.yaml` board ids `epic-3-retro-item-33-...` (item 5), `-34-...` (item 6); `-32-` stays.

## Tasks & Acceptance

**Execution:**
- [x] `ops/tournament-backup.sh`: new, per the matrix; dumps `-n public -n supabase_migrations`.
- [x] `ops/tournament-restore-verify.sh`: new; creates the three Supabase roles, restores
  `--no-owner --no-privileges --exit-on-error`, compares tables, counts and the ledger.
- [x] `ops/__tests__/tournament-backup.test.ts`: the matrix's cases against a docker stub, plus the URL
  never appearing in docker's argv.
- [x] `ops/tournament-placement.md`: § Backup: what runs, install, cron line, first-run record.
- [x] `ops/estate.md`: dated amendment to the AD-10 exception bullet.
- [x] `deferred-work.md`: close three, amend DW-275, append DW-292 to DW-294.
- [x] `sprint-status.yaml`: items 5 and 6 done through the retrospective's script.

**Acceptance Criteria:**
- Given a real Postgres 17 holding the 29 migrations and seeded rows, when the backup runs and then the
  verify, then both exit 0; when a row is planted after the dump, then the verify exits 1 naming it.
- Given the change, when typecheck, the Hub build and the full suite run, then all pass.

## Design Notes

**Scope (Operator instruction of 2026-09-30, relayed by the orchestrator):** Keep all three goals in one
spec, and Keep the spec over 1600 tokens. Token count at the check: about 1,720 (6,897 characters over four).

**Open questions, answered from the records:** the ledger lives in `supabase_migrations`, outside
`public`, so the dump adds `-n supabase_migrations` or the restore cannot compare it. The URL already
carries `sslmode=require` (placement record); `PGSSLMODE=require` is set as a floor for a URL without
one. The cron runs an installed copy, `~/tournament-backup.sh`, as `~/cuatro-backup.sh` runs, so a
deploy never changes the nightly job unseen. 03:45 UTC shares the minute with `library-backup.sh`; the
dump is about 30 KB, so the overlap costs nothing measurable.

**Counts** are read after the dump, in one query (`query_to_xml` per table), not in its snapshot: a
write in between makes the verify fail loudly, never pass wrongly.

## Verification

**Commands:**
- `corepack pnpm typecheck`, `corepack pnpm --filter hub build`, `corepack pnpm test --run`: pass.
- The real-Postgres proof above, output quoted under Implementation Notes.

## Implementation Notes

- Implemented inline (no Agent tool in this run). Files: the two scripts, `ops/__tests__/tournament-backup.test.ts`
  (14 cases), `ops/tournament-placement.md` § Backup and action 6, `ops/estate.md`, `deferred-work.md`
  (DW-259, DW-266, DW-274 closed; DW-275 widened; DW-292, DW-293, DW-294 filed), `sprint-status.yaml`
  (`epic-3-retro-item-33-...` and `-34-...` done through `sprint_status.py`; `-32-` left open).
- Found by the real run: a dump taken with `-n public` emits `CREATE SCHEMA public`, which fails against
  the image's default schema, so the verify drops that empty schema before restoring.
- `ops/routing-inventory.md` § Backup coverage is frozen 2026-08-24 evidence and
  `ops/backup-digital-library.md` has no per-project table, so neither changed.

**Real proof, 2026-09-30, on this host (Docker 29.8.1, `postgres:17-alpine`).** A source Postgres 17
(`tb-src`, port 55432) got a shim (roles `anon`, `authenticated`, `service_role`; `auth.jwt()`;
`realtime.send()`; `supabase_migrations.schema_migrations`), then all 29 migrations, each in one
transaction with its ledger row, then two `player` rows and one `app_role` row. The backup read the URL
from an env file (`host.docker.internal:55432`, `sslmode=disable`). Output as printed (paths shortened):

```
tournament-backup ts=2026-09-30T07:16:45Z file=.../backups/tournament-20260930T071642Z.dump dump=ok list=ok tables=19 rows=32 bytes=458571 sha256=21a7457c051c286263e011f5059d6c677f7c66e0e6125c1235b39ae80262a3f0 prune=removed-1-aged-over-14-whole-days exit=0
tournament-restore-verify sha256=match restore=ok tables=19 rows=32 migrations=29-applied-0-pending exit=0
```

The prune removed a planted `tournament-20260910T034500Z.dump` (mtime 2026-09-10) and kept
`tournament-20260925T034500Z.dump` and `pre-migrations-20260910T005415Z.dump`.

Planted row: a pass-through `docker` wrapper on PATH inserted `player` `76561198000000003` into the
source right after `pg_dump` returned and before the counts were read:

```
tournament-backup ts=2026-09-30T07:20:15Z file=.../plant2/tournament-20260930T072011Z.dump dump=ok list=ok tables=19 rows=33 bytes=458571 sha256=494998b954d74fbf5e479d8ece6e01f82160d982f5019cf43843d5eb3ba12a2e prune=removed-0-aged-over-14-whole-days exit=0
tournament-restore-verify: public.player restored 2 rows, and the store held 3 when counted right after the dump
tournament-restore-verify sha256=match restore=ok tables=8 rows=1 migrations=not-reached exit=1
```

Ledger gap (row `0029` deleted from the source ledger, then dumped):

```
tournament-restore-verify: migration 0029_verification_bundle.sql is not in the backup's ledger
tournament-restore-verify: 1 migration(s) this checkout carries are not in the backup's ledger, so the store is behind the code (DW-291)
tournament-restore-verify sha256=match restore=ok tables=19 rows=32 migrations=28-applied-1-pending exit=1
```

After restoring the ledger row and removing the planted row, a clean pair again ended
`migrations=29-applied-0-pending exit=0`; `docker ps -a --filter name=tournament-restore-verify` listed no
container after any run.

**Gates, on the final tree after review.** `corepack pnpm typecheck` exit 0;
`corepack pnpm --filter hub build` exit 0; `corepack pnpm test --run`: `Test Files  72 passed (72)`,
`Tests  1776 passed (1776)` (1775 before review's added case). The review patch was re-proved against the
real Postgres: the clean pair ended `migrations=29-applied-0-pending exit=0` and the planted-row dump
again failed naming `public.player restored 2 rows, and the store held 3`, no container left behind.
Committed digests: `tournament-backup.sh` `25fe9d02...be35d`, `tournament-restore-verify.sh`
`9ed8b79a...0805d` (in full in `ops/tournament-placement.md` § Backup, step 1).

## Spec Change Log

## Review Triage Log

Review ran inline (no Agent tool): six layers, one pass, `review_loop_iteration` 0. Design Review:
`No UI surface in this diff. Design review skipped.` ECC Verification Loop: build, types and the full
suite PASS as quoted above, Lint `N/A (no lint command, see AGENTS.md)`, no secret or debug output in the
diff; its dash scan found the spec's template separators (double hyphens and one long dash), fixed to colons and a
comma.

| # | Layer | Finding | Verdict | Route |
|---|---|---|---|---|
| 1 | edge-case | `tournament-restore-verify.sh`: `STARTED=1` set after `docker run`, so a container created but not started, or a signal before the next line, is never removed | medium: `docker run` creates before it starts, and the header promises removal on every path | patch: marked before the run, test added |
| 2 | blind | Runbook step 1 compared digests against "the committed checkout they came from", which a copy from a CRLF checkout would pass | low: the check was circular | patch: the two committed digests written in |
| 3 | blind | The ledger's version format for rows 0004 to 0029, written by hand at placement, is unknown; a different form fails every one | low: fails loudly, never passes wrongly | patch: step 4 says what to read before calling it a fault |
| 4 | edge-case | `TOURNAMENT_DOCKER_TIMEOUT` is not checked as a number; a bad value reports `dump=failed` | low: the cron sets nothing; loud | reject |
| 5 | edge-case | An env value with a trailing comment or `export ` prefix is not parsed | low: fails loudly naming the file | reject |
| 6 | blind | Counts are read after the dump, not in its snapshot | false as a defect: a write in between fails the verify loudly, as designed and recorded | reject |
| 7 | blind | Row level security could make counts or the dump partial | false: `pg_dump` runs `row_security` off and refuses; a counted shortfall fails the verify | reject; named limit 3 |
| 8 | verification-gap | Dropping the image's `public` schema before restore is exercised only against real Postgres, not by the stubbed suite | low: the real proof covers it and the first box run repeats it | reject |
| 9 | verification-gap | Real Supabase specifics (pooler, permissions on `supabase_migrations`) have no automated check | low: only the box can observe them; runbook steps 3 and 4 are that check | reject; Operator item |
| 10 | ponytail | `TOURNAMENT_CLIENT_IMAGE` and `TOURNAMENT_VERIFY_IMAGE` knobs | low: one line each, the tracker's precedent, and a Supabase major bump is the case | reject |
| 11 | ponytail | The counts query is written in both scripts | low: a divergence fails the verify loudly; one shared file would have to be installed beside both copies | reject |
