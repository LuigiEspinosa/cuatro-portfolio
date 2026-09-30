---
title: 'Story 4-4: One Postgres, one database and one role per consumer'
type: 'feature'
created: '2026-09-30'
status: 'awaiting-operator'
baseline_commit: '988fecd422fbc00c3fed69c0f3614ef9ac048201'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/ops/settled-inputs-refresh.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** The box runs three Postgres 16 containers grown by hand (`cuatro-portfolio-anchor-db-1`, `cuatro-tracker-postgres-1`, `cs-tracker-db-1`), none with an explicit `max_connections` or a per-role `connection_limit`, and nothing in source can recreate the estate's database (AD-10).

**Approach:** Commit one PostgreSQL 18.6 stack under `ops/postgres/` (a compose file beside the Anchor's, as `ops/traefik/` is) with a named volume, an explicit `max_connections`, and an init script that creates one database and one role per consumer, each with its own password variable, `CONNECTION LIMIT` and no `CONNECT` for anyone else. Prove it locally in Docker, hold it with a Vitest suite, and write `ops/postgres.md`: the budget table, AD-23's discipline, and the Operator's placement runbook. No consumer moves in this story.

## Boundaries & Constraints

**Always:** consumers `umami`, `cuatro_tracker`, `cs_tracker`, `cuatro_finance` (AD-3 names; `umami` by decision below); every password from the gitignored `ops/postgres/.env` by variable, placeholders only in git; `sum(connection_limit) <= max_connections - superuser_reserved_connections`; the proof quotes real output; every box step is an Operator item with its exact command.

**Never:** write to the box; schema-per-app; PgBouncer; publish a port or set `container_name`; change any application's connection string or pool (each migration story's, by note); move the tournament off Supabase; touch `contracts/`; weaken a gate.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First start | empty volume, all five variables set | four databases, four roles, each owning its database, limits applied | N/A |
| Own database | role X connects to database X | succeeds | N/A |
| Cross database | role X connects to database Y | refused, `permission denied for database "Y"` | N/A |
| Missing variable | any consumer password unset | init fails naming the variable, no half-created estate reported healthy | compose refuses without `.env` |
| Restore 16 to 18 | a 16 `pg_dump -Fc` restored as the consumer role | rows present, objects owned by the role | N/A |

</frozen-after-approval>

## Code Map

- `docker-compose.yml`: `anchor-db` (Umami's `umami`, 16-alpine), `finance` and `finance-migrate` (`finance` in `anchor-db`), `tracker*` (`tracker` in `cuatro-tracker-postgres-1`), tournament on Supabase. Read only: the application-side change is each migration story's.
- `ops/traefik/compose.yml`: the precedent for a hand-started stack beside the Anchor (header, `env_file: .env`, healthcheck, no socket). Copy its shape.
- `apps/finance/prisma/provision.sql`: the role and database pattern (`CREATE ROLE ... CONNECTION LIMIT`, `OWNER`, `REVOKE ALL ON DATABASE ... FROM PUBLIC`) reused by the init script.
- `apps/finance/lib/db.ts` (`max: 5`), `apps/tracker/lib/db.ts` (Prisma 6, default pool, no limit), `cs-tracker` `config/runtime.exs:208` (`POOL_SIZE`, default 10): where each application sets its pool.
- `ops/__tests__/traefik-config.test.ts`: suite shape (read as text, CRLF normalized, no YAML parser).
- `ops/settled-inputs-refresh.md` § Decision: PostgreSQL 18; `ops/estate.md:466` (finance's sum), `:510` (tracker waits for 4.4 and 4.8), `:573` (tournament's AD-10 exception); `ops/tracker-cutover.md:62`; `ops/routing-inventory.md:1013,1041,1083` (the three containers).
- `AGENTS.md:37`: record count (32 files today, the text says 31): DW-298 owns it; not edited here.
- `sprint-status.yaml` `4-4` row; `deferred-work.md` new DW entries only.

## Tasks & Acceptance

**Execution:**
- [x] `ops/postgres/compose.yml`: project `postgres`, service `estate-postgres` on `postgres:18.6-trixie`, `command` setting `max_connections`, named volume at `/var/lib/postgresql` (the 18 image's layout), init directory bound read-only, `env_file: .env`, TCP `pg_isready` healthcheck, network named `estate-postgres`, no ports, no `container_name`.
- [x] `ops/postgres/init/10-consumers.sh` (LF, 100755): a literal consumer table (name, limit, variable) looped through `psql -v` with `ON_ERROR_STOP`; fails on an unset variable.
- [x] `ops/__tests__/postgres-init.test.ts`: parse the table and compose; one database and one role per consumer, no shared role or variable, no `CREATE SCHEMA`, no PgBouncer, sum under the budget, image pinned exact, record table equals the script's.
- [x] `ops/postgres.md`: budget table with where each application sets its limit and which story changes it; AD-23 discipline; the local proof; runbook (env file, first start, per-story `pg_dump`/`pg_restore` move, verification, rollback); Pending Operator actions.
- [x] `sprint-status.yaml`: `4-4: awaiting-operator` with a dated comment. `deferred-work.md`: DWs for finance's `finance` name and any consequence found; DW-298 (the AGENTS.md record count, owned by the next context refresh) amended rather than AGENTS.md edited.

**Acceptance Criteria:**
- Given the pinned image and throwaway passwords, when the stack starts on an empty volume locally, then `\l` and `\du` show the four databases and roles with their limits, quoted.
- Given each role, when it connects to its own database and to another, then the first succeeds and the second fails by name, quoted.
- Given the record, when it is read, then every consumer has a limit, a knob and an owning story, the sum is under `max_connections`, and the tournament's staying on Supabase is reasoned.
- Given the change, when typecheck, the Hub build and the full suite run, then all pass.

## Implementation Notes

- Implemented inline (no subagent tool in this run). Box read 2026-09-30T10:59:09Z, read-only: `docker ps`, `docker inspect` with a format naming no environment, `free -m`, `nproc`, `uptime`. Nothing written. `cs-tracker`'s database and role names live in its `.env`, which the allowed reads do not cover; the record names them by variable.
- Local proof with the final script, 2026-09-30T11:18:36Z to 11:19:34Z, quoted in `ops/postgres.md` § Rehearsed off the box: four databases and roles with limits; each role in its own database only (20 refusals by name, the maintenance databases included); a twenty-sixth `umami` session refused by its limit of 25; a missing variable refusing before any statement; a 16-alpine dump restored as `cuatro_tracker` with `pg_trgm`, counted equal, and a later source write caught by the count. Every throwaway container, volume, network, dump and `.env` removed; `docker ps -a`, `docker volume ls`, `docker network ls` then listed none.
- Found by the proof: an init that failed midway restarted into a healthy cluster with half the consumers (the image skips its init directory once a cluster exists). Fixed by checking every variable before any statement; the runbook's step 4 counts the databases. `REVOKE CONNECT ... FROM PUBLIC` on `postgres` and `template1` added after the first matrix showed a consumer could open the empty `postgres`.
- Suite: `ops/__tests__/postgres-init.test.ts`, 17 cases, including the script run under `sh` against a `psql` stub. Mutation-checked: a limit raised to 95 failed the budget and record cases; removing the variable check failed the refusal case.
- DW-300 (finance's name), DW-301 (moves wait for 4.5), DW-302 (Umami's boot migration and pool, from review) filed; DW-298 amended.
- Review raised `umami` from 10 to 25 (sum 65 to 80) after reading the Umami 3.4.0 image: node-postgres's default pool of 10 per container, no environment knob. The whole proof was re-run on the final script and the record's quotes replaced.

## Spec Change Log

## Review Triage Log

Six layers run inline (no subagent tool in this run): blind hunter, edge-case hunter with the claims check, verification gap, ponytail, ECC verification loop, design (skipped: no `.scss` or `.tsx` and no motion in the diff).

| # | Layer | Finding | Verdict | Evidence and route |
|---|---|---|---|---|
| 1 | edge, claims | `umami` row claimed Prisma's default pool of 5 and a `connection_limit` URL knob | medium | Umami 3.4.0 image read: `new PrismaPg({connectionString})`, node-postgres default `max` 10, no knob; two containers overflow 10. Patch: limit 25, row rewritten, proof re-run |
| 2 | edge | Umami migrates on container start (`check-db.js`, `prisma migrate deploy`) | medium | pre-existing, read in the image; not caused here. Defer: DW-302, Story 4.7; named in the record's AD-23 section |
| 3 | blind | Runbook step 2 `install -m 600 /dev/null` truncates an existing `.env`, losing passwords the cluster holds | medium | real on a second run of the step. Patch: step skips an existing file |
| 4 | claims | First-start quote presented as "the image's log" while filtered | low | true. Patch: says which lines were kept |
| 5 | claims | Missing-variable quote showed `$ psql`, run as `docker exec ... psql` | low | true. Patch: the exact command |
| 6 | verification-gap | Nothing in CI runs the init SQL against the real image; the suite reads the SQL as text and runs the shell logic against a stub | low | the script runs once, at first start, and § The placement step 4 counts the result; a CI job changes both suites pinning `ci.yml`. Rejected: fix adds a job for a one-shot path already checked where it runs |
| 7 | blind | Consumer passwords stay in the database container's environment after init (`docker inspect`) | low | only `deploy` reaches the socket, and it already reads `.env`; same as every stack on the box. Rejected |
| 8 | edge | Consumer passwords reach `psql` as argv during init, visible in the container's process list | low | init runs before the server accepts network connections, inside the one container. Rejected |
| 9 | edge | Revoking CONNECT on `template1` could break a tool that connects there | false | `CREATE DATABASE` copies it without connecting (the proof created four); `prisma migrate deploy` and Ecto's migrator connect to their own database only |
| 10 | ponytail | Stub run of the script (about 60 lines of the suite) | false | it is the only automated coverage of the I/O matrix's missing-variable row; mutation removing the check failed it. Otherwise: `Lean already. Ship.` |
| 11 | ECC loop | Full suite: 4 failures in `deploy-remote`, `library-backup`, `tournament-backup`, `tracker-backup` | false | empty output from WSL bash spawns (DW-135 shape) while Docker pulled an image; none touched by this diff; re-run below |

## Design Notes

**Oversized spec, kept.** About 1,850 tokens (7,407 characters over four) against the 1,600 guide. The Operator's instruction of 2026-09-30, relayed by the orchestrator for this spec, is Keep: one stack, its proof and its runbook are one deliverable, and splitting would separate the budget from the record that states it.

**Decisions the Operator may overrule.** A separate stack, not a service in `docker-compose.yml`: the database outlives every application's deploy, serves consumers from three projects, and the Anchor's file is interpolated and pulled by every Hub deploy. `postgres:18.6-trixie`: 18.6 is the newest 18 on 2026-09-30 (Docker Hub, 2026-09-24), and the Debian suffix pins glibc, whose collation changes silently invalidate text indexes. `max_connections=100`, stated: the budget sums to 80 of 97 usable, leaving room for the superuser's dumps (Story 4.5) and a `psql`. Umami's database keeps the name `umami`: AD-3 derives Postgres names from Registry ids, and Umami has none; naming it for the Anchor would claim the Hub owns data it never reads. Finance is included though no story places it: its compose target `anchor-db` is retired when Umami moves (4.7). The tournament stays on Supabase: moving it replaces Supabase Auth, PostgREST and Realtime, which is a story of its own (`ops/estate.md` § cs-tournament, DW-280 ruling).

## Verification

**Commands:**
- `docker compose -f ops/postgres/compose.yml` with a throwaway `.env`, then `psql` per role: expected as in the ACs, containers and volume removed after.
- `corepack pnpm typecheck`, `corepack pnpm --filter hub build`, `corepack pnpm test --run`: exit 0.

**Results, 2026-09-30:** typecheck exit 0; Hub build exit 0; full suite first run 4 failed of 1812, all in the four WSL bash suites with empty output (DW-135 shape, during an image pull), re-run on the final tree 74 of 74 files, 1812 of 1812 tests, exit 0. `ops/__tests__/postgres-init.test.ts` 17 of 17. shellcheck (`koalaman/shellcheck:stable`) on the init script exit 0 with no finding. Docker proof as quoted in `ops/postgres.md` § Rehearsed off the box, every throwaway removed.
