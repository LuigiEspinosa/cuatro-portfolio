---
title: 'Story 9-8: test EXPORT_SQL against a real Postgres'
type: 'chore'
created: '2026-10-18'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '3918735060f2aa3e07358c8f8e10504f067b78ad'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-plan-2026-10-18.md'
  - '{project-root}/_bmad-output/implementation-artifacts/dw-triage-2026-10-18.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `EXPORT_SQL` in `ops/tournament-identity.mjs` has run against a real Postgres only by hand (Story 3-7's Verification), so a regression in its joins, its column names or its `json_agg` shape passes CI; only `mapIdentities` is unit tested (DW-284).

**Approach:** Add a Postgres-backed block to `ops/__tests__/tournament-identity.test.ts` that drives `main(['export'])` with a query that runs, through `psql`, migration `0001_core_schema.sql`, a minimal `auth.users`, the case's rows and then `EXPORT_SQL` itself, in one transaction that is rolled back. CI's `test` job points the root `Unit tests` step at the `postgres` service it already has; no job is added.

## Boundaries & Constraints

**Always:** the block fails, never skips, in CI when its variable is unset (the tracker `demo-reset` precedent); locally it is skipped, with the reason in its title, only when `TOURNAMENT_IDENTITY_DATABASE_URL` is unset. Every statement runs inside `begin; ... rollback;`, so the database is left as found and no schema is dropped. Each new assertion is planted once and its failure recorded here.

**Never:** a new CI job or service, a change to `EXPORT_SQL` or to the module's behaviour, a new dependency (the runner image and this host both carry `psql`), a write outside the rolled-back transaction.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Steam users | admin (player, `app_role` admin, tab in name), viewer (player, no role, no claim), Auth user with no player row | code 0, TSV in `created_at` order: admin role, viewer default, the playerless user `viewer` with an empty name; note `users=3` | N/A |
| Password hash | one user with `encrypted_password` set | code 1 naming that user's id | refusal, no mapping |
| Contradicted claim | `raw_app_meta_data.steamid64` differs from the email's | code 1 naming the user and both ids | refusal |
| No users | empty `auth.users` | code 0, empty message, `users=0` | N/A |

</frozen-after-approval>

## Code Map

- `ops/tournament-identity.mjs`: `EXPORT_SQL` (the query under test), `main(argv, env, io)` whose `io.query(sql, env)` is the seam; the module's own `query` runs `psql` in `postgres:17-alpine` with `-X -At -v ON_ERROR_STOP=1`. Unchanged except the header line saying the suite plants the query.
- `ops/__tests__/tournament-identity.test.ts`: existing planted cases; the new block goes here.
- `apps/tournament/supabase/migrations/0001_core_schema.sql`: `season`, `tournament`, `player`, `app_role` in `public`; no transaction statements, no Supabase roles.
- `.github/workflows/ci.yml`: `test` job's `postgres:18` service (default database `postgres` exists beside `tracker_demo_reset_test`) and the `Unit tests` step; job names unchanged, so the two job-name pins hold.
- `apps/tracker/lib/__tests__/demo-reset.test.ts`: the fail-in-CI, skip-locally pattern to copy.

## Tasks & Acceptance

**Execution:**
- [x] `ops/__tests__/tournament-identity.test.ts`: add the CI guard case and a `describe.skipIf` block covering the matrix, with a `psql` query helper that pipes `begin`, the migration, a GoTrue-shaped minimal `auth.users`, the rows, `EXPORT_SQL` and `rollback` over stdin with `-X -q -At -v ON_ERROR_STOP=1`: the regression guard DW-284 asks for.
- [x] `.github/workflows/ci.yml`: `TOURNAMENT_IDENTITY_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres` on `Unit tests`, and the service comment names its second consumer.
- [x] `ops/tournament-identity.mjs`: header comment only.

**Acceptance Criteria:**
- Given CI's `test` job, when `pnpm test --run` runs, then the block runs against the `postgres` service and an unset variable fails the guard case.
- Given this host with an `epic-scratch-9-8-*` Postgres 17 and the variable set, when the suite runs, then all matrix cases pass; with it unset they are skipped, their title naming why.

## Implementation Notes

- Implemented directly in this session at `67f873be6c814ad4096cf01cf3d1097602fa9044`: no implementation subagent could be launched from this workflow sub-agent, which has no agent tool.
- `ops/__tests__/tournament-identity.test.ts`: a guard case (fails in CI, `CI=true`, when `TOURNAMENT_IDENTITY_DATABASE_URL` is empty) and a `describe.skipIf` block of three cases covering the four matrix rows. The query seam `againstPostgres(rows)` pipes `begin;`, a GoTrue-shaped `auth.users` (`id uuid`, `email` and `encrypted_password varchar(255)`, `raw_app_meta_data jsonb`, `created_at timestamptz`), migration 0001 read from disk, the case's inserts, `EXPORT_SQL;` and `rollback;` into `psql <url> -X -q -At -v ON_ERROR_STOP=1`. Those are the module's own flags plus `-q`, which drops the command tags so stdout is the query's one line, exactly what `main` parses.
- Creation order is deliberately not insertion order (days 3, 1, 2), so the `order by t.created_at` is held.
- The rollback leaves the database as found: after the runs, the scratch database held no `auth` schema and no table in `public` (both counts 0).
- `.github/workflows/ci.yml`: the variable on `Unit tests` names the service's default database `postgres`, so it never shares `tracker_demo_reset_test` with the tracker suite, which drops `public` there. No job, service or job name changed.
- Local runs used `epic-scratch-9-8-tournament-export-sql-test-pg` (`postgres:17-alpine`, host port 55498) and this host's scoop `psql`. CI runs server 18 with the runner image's own `psql`; that pairing is first observed on CI's first run of this commit.

### Planted failures

Each new assertion failed once on purpose, on the commit's tree with one mutation, then was restored (`git checkout ops/tournament-identity.mjs`) and the file passed 11 of 11.

- P0, the CI guard: `CI=true` with the variable unset: `× runs in CI, never silently skipped there`, `AssertionError: TOURNAMENT_IDENTITY_DATABASE_URL: expected '' not to be '' // Object.is equality`, `Tests 1 failed | 10 skipped (11)`.
- P1, the Steam-users case: the role join changed to `on r.steamid64 = u.email`: `× maps every Steam user by role and display name, ...`, the diff `- ...000000000001	76561198000000001	admin	A B` against `+ ...000000000001	76561198000000001	viewer	A B`, `Tests 1 failed | 10 passed (11)`.
- P2, creation order: `json_agg(t order by t.created_at)` changed to `json_agg(t)`: the Steam-users and refusal cases both failed (`AssertionError: expected { code: +0, …(2) } to deeply equal { code: +0, …(2) }` and its `code: 1` equivalent), `Tests 2 failed | 9 passed (11)`.
- P3, the refusal case: `has_password` changed to `false as has_password`: the message lost its first line, `- "message": "user 00000000-0000-4000-8000-000000000001 holds a password hash, so the move could force a reset` against `+ "message": "user 00000000-0000-4000-8000-000000000002 claims steamid64 76561198000000002 but its email names 76561198000000003"`, `Tests 1 failed | 10 passed (11)`.
- P4, the empty case: the `coalesce(..., '[]')` removed: `× answers an empty export for a source with no Auth users`, `AssertionError: promise rejected "SyntaxError: Unexpected end of JSON input" instead of resolving`, `Tests 1 failed | 10 passed (11)`.

## Review Triage Log

Every layer ran inline in this session (no agent tool to launch reviewer subagents from a workflow sub-agent). The independent verifier below is the check these layers are not.

| # | Layer | Finding | Verdict | Evidence and route |
|---|---|---|---|---|
| 1 | blind | The URL, with its password, is a `psql` argument, visible in the process list | false | The only values are CI's service password `postgres` and a scratch container's, both already plain text in `ci.yml`; the module's own `query` keeps the Operator's real URL in the environment and is unchanged |
| 2 | edge-case | Pointed at a database that already has an `auth` schema or a `player` table (a real Supabase), the case fails | false as a defect | It fails at `create schema auth` under `ON_ERROR_STOP`, inside the transaction, so nothing is written; a loud refusal on a database the suite must not use is correct |
| 3 | edge-case | Variable set but no `psql` on PATH | false as a defect | The seam throws `psql failed: spawnSync psql ENOENT`, a named failure, never a pass |
| 4 | verification-gap | CI's pairing (runner `psql`, server 18) is unobserved; the local runs were client and server 17 | maybe-false, would be medium | Settled only by CI's first run of `67f873b`, which this story does not push. Listed for the Operator; no change made |
| 5 | verification-gap | Every new assertion planted, every matrix row covered by a case that ran | no defect | P0 to P4 above; with the variable set the file ran 11 of 11, unset 8 passed and 3 skipped |
| 6 | ponytail | `user()` builds SQL literals by hand | false as waste | Five fixed literals from the test itself, no external input; a client library would be a new root dependency. "Lean already. Ship." |
| 7 | verification-loop | Hub build | n/a | The diff touches no Hub source and nothing the build reads. Typecheck exit 0; `corepack pnpm test -- --run` 83 files, 1997 passed, 1 skipped; lint N/A (no lint command, see AGENTS.md); no secret in the diff |
| 8 | design | No `.scss` or `.tsx` outside tests changed and no motion keyword was added | n/a | No UI surface in this diff. Design review skipped. |

## Independent verifier

pending

## Ledger closures

**DW-284:** **Closed 2026-10-18 by Story 9-8-tournament-export-sql-test** (`67f873b`, `ops/__tests__/tournament-identity.test.ts`: `EXPORT_SQL against a real Postgres`): `EXPORT_SQL` now runs in the blocking `test` job against the `postgres` service it already had, with no new job: `Unit tests` sets `TOURNAMENT_IDENTITY_DATABASE_URL` to the service's default database, and the root suite drives `main(['export'])` through `psql` over migration `0001_core_schema.sql`, a GoTrue-shaped `auth.users` and each case's rows, inside a transaction it rolls back. Three cases hold the role join, the playerless default, the creation order, both SQL-side refusals (a password hash, a contradicted claim) and the empty export, each planted; a guard case fails the job if the variable goes missing in CI. Locally the block runs against a scratch Postgres 17 and is skipped, its title naming why, only when the variable is unset.

Action items: none named for this story.

## Verification

**Commands** (observed 2026-10-18 on this host, the tree at `67f873b`):
- `TOURNAMENT_IDENTITY_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55498/postgres corepack pnpm vitest run ops/__tests__/tournament-identity.test.ts`: `Tests 11 passed (11)`. Unset: `Tests 8 passed | 3 skipped (11)`.
- `corepack pnpm typecheck`: exit 0.
- `TOURNAMENT_IDENTITY_DATABASE_URL=... corepack pnpm test -- --run`: `Test Files 83 passed (83)`, `Tests 1997 passed | 1 skipped (1998)`; no WSL-bash flake this run.
- No `apps/*` file changed, so no per-application suite was due.
