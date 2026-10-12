---
title: 'Epic 5 retro action 1 (M1): cs-tracker serves the demo principal from schema demo alone'
type: 'bugfix'
created: '2026-10-12'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'cuatro-portfolio 43dbb6a71c5bfc145b48527b0a9cbda3e3a7db51; cs-tracker 3b1aa7c14d2534e524ac258277904691d349afbb'
context: []
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `cs-tracker`'s `DemoRepo` searches `demo,public`, and no redeploy runs `migrate_demo`, so the next migration that adds a table would serve and write the Owner's rows to the demo principal (retro M1).

**Approach:** the demo repo searches `demo` alone, Oban's reads name `public` explicitly, and `bin/migrate` runs `migrate_demo` after `migrate`, so the standing redeploy order migrates both schemas.

## Boundaries & Constraints

**Always:** the live roll is an Operator step, recorded as a dated Pending row; `mix precommit` plus the production image booted against a scratch Postgres is the gate.

**Never:** edit the Operator's checkouts; touch the box; change Oban's prefix or move its tables.

## I/O & Edge-Case Matrix

| Scenario | State | Expected |
|---|---|---|
| Unmigrated demo table | table in `public`, absent from `demo` | demo read raises `undefined_table`, never the Owner's row |
| Demo reads sync state | demo principal opens `/inventory` | `oban_jobs` read from `public`, page renders |
| Redeploy | `bin/migrate` | both schemas migrated, idempotent |

</frozen-after-approval>

## Code Map

- `cs-tracker` `lib/cs_tracker/demo_principal.ex` `repo_options/0`: the serving search path.
- `lib/cs_tracker/release.ex` `migrate_demo/0`: keeps `demo,public` so `pg_trgm`'s `gin_trgm_ops` resolves; creates still land in `demo`.
- `lib/cs_tracker/inventory/inventory.ex`: the four `from(j in Job, ...)` reads; Oban's own calls already carry `prefix: "public"` (`Oban.Repo`).
- `rel/overlays/bin/migrate`, `docs/deployment.md`: the redeploy order.
- `cuatro-portfolio` `ops/demo-principal.md` (cs-tracker participant, § By hand step 16, DP9), `ops/cs-tracker-cutover.md` § Later rollouts (the standing redeploy order).

## Tasks & Acceptance

**Execution:**
- [x] `demo_principal.ex`: `search_path: "demo"`.
- [x] `inventory.ex`: `prefix: ^@oban_prefix` (`"public"`) on the four Job queries.
- [x] `release.ex`: `migrate_demo` overrides `parameters` to `demo,public`.
- [x] `bin/migrate`: `eval 'CsTracker.Release.migrate(); CsTracker.Release.migrate_demo()'`.
- [x] `demo_principal_test.exs`: the refusal case; the options pin reads `"demo"`.
- [x] `docs/deployment.md`, both ops records, DP9 Pending row.

**Acceptance Criteria:**
- Given a demo table dropped inside the sandbox, when the demo principal reads it, then `Postgrex.Error` `undefined_table` is raised.
- Given a fresh database, when the image's `bin/migrate` runs, then `public` and `demo` each hold 10 migrations, and a second run prints `Migrations already up` twice.
- Given demo on, when the image serves, then `DemoRepo`'s `search_path` is `demo` and the `Inventory` sync reads answer.

## Implementation Notes

Implemented directly in worktree `C:/CuatroEcosystem/cs-tracker-workspace/wt-demo-schema-alone`, branch `fix/demo-schema-alone` off `origin/dev` `3b1aa7c`, commit `f2c005d6a5bfff146757adec93584bf045a93227` (no subagent tool in this session). Shown red first: the new case failed on the old search path ("Expected to catch error, got nothing"), and with `demo` alone but before the Oban prefix three cases failed with `relation "oban_jobs" does not exist`. Running `migrate_demo` while demo is off creates schema `demo`; harmless, and it keeps `bin/migrate` unconditional.

**Tests run (2026-10-12, Postgres 18.6 scratch containers):**
- `mix test test/cs_tracker/demo_principal_test.exs test/cs_tracker/inventory`: `154 tests, 0 failures (1 excluded)`.
- `mix precommit` on a dropped and recreated test database, at the committed tree: `709 tests, 0 failures (4 excluded)`; the fresh `migrate_demo` left `demo` 8 tables, `public` 10 (`oban_jobs`, `oban_peers` only in `public`).
- Image `epic-scratch-cs-tracker:m1` built from `f2c005d`, against a fresh database owned by a non-superuser `cs_tracker` role: `bin/migrate` exit 0 with 20 `Running` lines; `schema_migrations` 10 and 10; second run `Migrations already up` twice; with `demo.ownership_marks` and its version removed, a third run migrated it in `demo` alone. Server booted with demo on; over `rpc`: `demo search_path: [["demo"]]`, `cooldown_status` `%{active?: false, ...}`, unqualified `oban_jobs` `:error`, owner `"$user", public`, `GET /auth/session` `401`, no `[error]` log line. Scratch objects removed.
- Root suite: see Verification.

**Review:** the review layers ran inline in this session (no subagent tool), not independently: Oban writes already prefixed; `CREATE SCHEMA IF NOT EXISTS` checks the database `CREATE` privilege, which the box's role held at DP5; `migrate` failing stops before `migrate_demo` (`set -eu`, eval raises); `rollback/2` still rolls back `public` only (pre-existing, no demo rollback asked).

## Review Triage Log

| Finding | Verdict | Evidence |
|---|---|---|
| `bin/migrate`'s demo step has no unit test | low | covered by the image rehearsal only; `cs-tracker` has no shell-script tests |
| Demo still sees the Owner's sync metadata | false | accepted in `ops/demo-principal.md` "Shown, accepted"; unchanged |

## Verification

**Commands:** `mix precommit` in the worktree; the image rehearsal above; `corepack pnpm test --run` in `cuatro-portfolio`.

**Root suite (2026-10-12, after the ops edits):** `Test Files 7 failed | 73 passed (80)`, `Tests 18 failed | 1954 passed | 1 skipped (1973)`; all 18 in the seven WSL-bash suites, each a 21 to 32 second timeout (DW-135). Each re-run alone passed: deploy-remote 28, library-backup 59, tracker-backup 11, postgres-backup 20 (1 skipped), postgres-init 17, tournament-backup 15, demo-reset 26. After the board and spec edits, the five suites reading the board or the record (hit-target-floor, hub-accessibility-pass, status-mark-axes, demo-principal, registry-verification): `150 passed (150)`.

**Independent verifier:** _not yet run_. The verifier opens and merges the `cs-tracker` PR to `dev`, pushes `cuatro-portfolio` `dev`, and records its verdict here.
