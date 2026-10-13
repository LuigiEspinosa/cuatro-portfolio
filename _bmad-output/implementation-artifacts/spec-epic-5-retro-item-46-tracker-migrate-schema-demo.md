---
title: 'Epic 5 retro action 2 (M2): the tracker migrates schema demo in every rollout'
type: 'bugfix'
created: '2026-10-12'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
baseline_commit: 'cuatro-portfolio 27a4d3dc3eed7fea094f75e7b1e61a4bf9c51225'
context: []
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** the tracker's schema `demo` was migrated once by hand at DP6 and no rollout migrates it: `tracker-migrate` reaches `public` only and `ops/tracker-cutover.md`'s standing rollout never names `demo`, so the next tracker migration leaves `demo` behind (demo pages fail, the hourly reset exits 1). DP6's runbook also built the demo URL by appending `&schema=demo`, which breaks on a URL with no query string (retro M2).

**Approach:** a second one-off compose service, `tracker-migrate-demo`, the same image, command and database as `tracker-migrate` with `schema=demo` set in the URL's query, so nothing on the box builds a URL; the standing rollout runs it after `tracker-migrate`, and DP6's text names it. Suites hold the two URLs equal but for `schema`, the runbook naming both, and `demoDatabaseUrl` safe on a URL without a query string.

## Acceptance Criteria

- Given `docker-compose.yml`, when `tracker-migrate-demo` is read, then its image, profile `migrate`, command, network and restart equal `tracker-migrate`'s, and its `DATABASE_URL` parsed as a URL equals `tracker-migrate`'s once its `schema=demo` parameter is removed; a demo URL missing `schema=demo`, naming another database or absent fails a case naming the fault.
- Given `ops/tracker-cutover.md`'s standing rollout (§ The sequence, **Later rollouts**), when read, then it runs `tracker-migrate` and then `tracker-migrate-demo` before `docker rollout`, and a suite fails if either is dropped.
- Given `ops/demo-principal.md`, when DP6's step and the tracker's scope are read, then neither builds a URL by appending `&schema=demo`; DP6 names `tracker-migrate-demo`.
- Given `demoDatabaseUrl` and a `DATABASE_URL` with no query string, when derived, then the result carries `schema=demo` and `connection_limit=1` on the same database.
- Given `ops/deploy-remote.sh`, when the Hub deploys, then it still runs `anchor-app-migrate` alone (the new service is never `$SERVICE-migrate`).
- Every live step (this change on `main`, the first rollout running the demo migration) is a dated Pending row in `ops/tracker-cutover.md`.

</frozen-after-approval>

## Implementation Notes

**First commit, the previous verifier's minor findings:** `cs-tracker` `rel/overlays/bin/migrate.bat` now runs `CsTracker.Release.migrate(); CsTracker.Release.migrate_demo()` as `bin/migrate` does (worktree `C:/CuatroEcosystem/cs-tracker-workspace/wt-migrate-bat-demo`, branch `fix/migrate-bat-demo` from `origin/dev` `666b852`, commit `8908973685c6e65bd9b08b69fd308a357abe84a2`; no PR opened). `mix precommit` was not run for it: the file is a Windows release script no build, test or deploy reads, and the change touches no Elixir source. The board legend lists `awaiting-operator` for action items (`27a4d3dc3eed7fea094f75e7b1e61a4bf9c51225`).

**Decisions:** a second compose service rather than `-e DATABASE_URL` on `tracker-migrate`, so the box builds no URL and handles no password; the URL is a literal with `schema=demo` in an existing query, held to `tracker-migrate`'s by parsing both (`demoMigrateFaults`). The migration runs whether the demo is on or off. `apps/tracker`'s `demoDatabaseUrl` already used the URL API; a case now proves it on a URL with no query string. No change to `ops/deploy-remote.sh`: it runs only `$SERVICE-migrate`, `anchor-app-migrate`. DP6's run section keeps its historical `&schema=demo` wording; its step text is amended with a date.

**Files:** `docker-compose.yml` (service `tracker-migrate-demo`, the tracker comment), `docker/__tests__/compose.test.ts` (two cases), `apps/tracker/lib/__tests__/demo-principal.test.ts` (one case), `ops/__tests__/demo-principal.test.ts` (one case: the standing rollout runs `tracker-migrate`, then `tracker-migrate-demo`, then `docker rollout`), `ops/tracker-cutover.md` (§ The sequence, Later rollouts, amended 2026-10-12; § Estate Postgres move's Later rollouts line; Pending action 9), `ops/demo-principal.md` (the tracker's scope, DP6's step, the liveness line), the board row.

**Planted:** the tracker case fails against a `demoDatabaseUrl` that appends `&schema=demo&connection_limit=1` (both URL cases red); the ops case fails with `tracker-migrate-demo` dropped from the rollout line; the compose fault cases plant a missing service, a missing `schema`, another database and another command.

**Review:** no subagent tool in this session, so the Blind Hunter layer ran inline, not independently: `docker compose --profile migrate config` renders the service with `?connection_limit=4&schema=demo`; Prisma creates schema `demo` if absent, as at DP6; the two migrations run in sequence, so the role's connection budget is unchanged.

## Verification

**Builder's runs (2026-10-12):**
- `corepack pnpm vitest run docker/__tests__/compose.test.ts`: `Tests 29 passed (29)`.
- `corepack pnpm --filter tracker exec vitest run lib/__tests__/demo-principal.test.ts`: `Tests 14 passed (14)`.
- `corepack pnpm vitest run ops/__tests__/demo-principal.test.ts`: `Tests 10 passed (10)`.
- Board suites (hit-target-floor, hub-accessibility-pass, status-mark-axes): `Tests 60 passed (60)`.
- `corepack pnpm typecheck` clean; `corepack pnpm --filter tracker typecheck` exit 0.
- Root suite `corepack pnpm test --run`: `Test Files 4 failed | 76 passed (80)`, `Tests 4 failed | 1971 passed | 1 skipped (1976)`; the four were 27 to 30 second cases in demo-reset, deploy-remote, library-backup and postgres-backup (DW-135). Each re-run alone passed: demo-reset 26, deploy-remote 28, library-backup 59, postgres-backup 20 (1 skipped).

**Operator steps:** this change on `main` (its Deploy resets the box's checkout), then `ops/tracker-cutover.md` Pending action 9.

**Independent verifier (2026-10-12, round 1): pass with minor findings.** A separate session with no builder context read both diffs against `origin/dev` and re-ran every stage:

- `docker/__tests__/compose.test.ts`: `Tests 29 passed (29)`; `ops/__tests__/demo-principal.test.ts`: `Tests 10 passed (10)`; `corepack pnpm --filter tracker exec vitest run lib/__tests__/demo-principal.test.ts`: `Tests 14 passed (14)`. `corepack pnpm typecheck` and `corepack pnpm --filter tracker typecheck` both exit 0.
- `docker compose -f docker-compose.yml --profile migrate config tracker-migrate-demo tracker-migrate` (scratch values) renders the two services with the same image and command and the URLs `...cuatro_tracker?connection_limit=4` and `...cuatro_tracker?connection_limit=4&schema=demo`.
- The two URLs' shapes against a scratch `postgres:18.6` (`epic-scratch-pg-m2`, removed after): `prisma migrate deploy` from `apps/tracker` with the public URL applied every migration; with `&schema=demo` added it applied every migration into a new schema `demo`; a second demo run printed "No pending migrations to apply."; `_prisma_migrations` holds 11 rows in each schema and each holds 9 tables.
- Root suite `corepack pnpm test --run`: `Test Files 5 failed | 75 passed (80)`, `Tests 5 failed | 1970 passed | 1 skipped (1976)`; the five were cases in demo-reset, deploy-remote, library-backup, postgres-backup and tournament-backup (DW-135). Each re-run alone passed: demo-reset 26, deploy-remote 28, library-backup 59, postgres-backup 20 (1 skipped), tournament-backup 15.
- `cs-tracker` `mix precommit` in `wt-migrate-bat-demo` at `8908973` against a scratch `postgres:18.6` (`epic-scratch-pg-cst`, removed after): `709 tests, 0 failures (4 excluded)`, no file changed by `format`. The `.bat` now matches `bin/migrate`'s eval.
- Records: the standing rollout (`ops/tracker-cutover.md` § The sequence, Later rollouts) carries the new step, and Pending action 9 is a dated row (`_not done_`). `ops/deploy-remote.sh` is unchanged. No prose dash or emoji in either diff; all three commit subjects are Conventional Commit subjects alone.

Minor findings, none blocking: no fault case removes `tracker-migrate-demo`'s `DATABASE_URL` line alone (it would still be named, as a missing `schema=demo`); `ops/estate.md` (Migrations, AD-23) and `ops/postgres.md`'s consumer row still name `tracker-migrate` alone; Pending action 9 uses `$C` without restating it (defined in § The sequence).

`cs-tracker` PR 7 (`fix/migrate-bat-demo` into `dev`, head `8908973685c6e65bd9b08b69fd308a357abe84a2`) is open and mergeable; the verifier's merge was refused by the session's permission classifier, so merging it to `dev` is left to the Operator. `cs-tracker` has no `.github/`, so no workflow ran on that sha (`gh run list --commit` empty).
