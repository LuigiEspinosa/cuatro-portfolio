---
title: 'Story 5-9: demo:reset and a baseline fixture, per application'
type: 'feature'
created: '2026-10-03'
status: 'done'
baseline_commit: '0e3421ce2efe3d23b6c62a5bed587b414c14942a'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/ops/demo-principal.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** AD-13 and FR-26: each participant exposes an idempotent `demo:reset` that deletes by owner and reseeds a baseline fixture committed in its own repository, with one semantics for all three rather than three inventions. Story 5.8 built the scopes; nothing empties or refills them, so demo state is unbounded and Story 5.10's scheduler has nothing to call.

**Approach:** Define the reset once in `ops/demo-principal.md` § The reset (what it deletes, by which key, what it never touches, what a fixture is, idempotence, invocation from the host, exit codes, output), then implement it in `cuatro-tracker`, `cs-tracker` and `digital-library` to that definition, each with a fixture in its own repository and a test against a real store. Running it live is Operator-pending.

## Boundaries & Constraints

**Always:** the reset touches its scope only, addressed by an explicit key (the demo store, `demo.`-qualified names, the fixture library), never a search path; one transaction; no secret printed; other repositories on their story branches.

**Never:** the scheduler (5.10), the Registry (5.11), a migration run by the reset (AD-23), the box, any `.env.*` file, the Operator's checkouts.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reset | demo on, principal present, Operator and Visitor rows | scope equals the fixture, Operator rows unchanged, principal and its credentials kept | stdout `reset`, exit 0 |
| Again | right after a reset | scope identical row for row and byte for byte | exit 0 |
| Off or absent | switch off, or no principal | nothing read from or written to either scope | stdout `skipped`, exit 0 |
| Fault | scope unmigrated, a foreign library in scope, id ranges meet | nothing applied | stderr `failed`, exit 1 |

</frozen-after-approval>

## Code Map

- Tracker: `lib/demo-store.ts` (`storeFor`, `demoDatabaseUrl`), `prisma/schema.prisma` (eight models, `cuid` ids), `eslint.config.mjs` (no `process.env`, no `console`), image runs `tsx` (`worker.ts`).
- `cs-tracker` `dev`: `release.ex` (`migrate_demo`), `demo_principal.ex` (`enabled?`, `schema`), seven tables in `demo`, of which `schema_migrations` and `steam_rate_limit_state` (one row a migration seeds) are structural; `prices:item:<id>` and `inventory:updates` carry ids across scopes.
- `digital-library` branch `story-5-8-demo-principal`: `acl.ts` (`inDemoScope`), `services/importBook.ts` (`BOOKS_PATH`, `COVERS_PATH`, global `sha256` unique), `routes/admin/libraries.ts` (the 5.8 verifier's minor), image ships `dist` only.

## Tasks & Acceptance

**Execution:**
- [x] `ops/demo-principal.md`: § The reset, per-participant commands, DP6 and DP7 revised, DR1 to DR4; the one definition; `ops/__tests__/demo-principal.test.ts` holds it.
- [x] `apps/tracker`: `lib/demo-reset.ts`, `scripts/demo-reset.ts`, `prisma/demo-fixture.json`, a real-Postgres test; `ci.yml` gains a Postgres service for it.
- [x] `cs-tracker`: `CsTracker.DemoReset`, `Release.demo_reset/0`, `priv/demo/fixture.json`, a test.
- [x] `digital-library`: `src/demo-reset.ts`, `src/demo-fixture.ts`, the admin's container routes recorded as accepted, tests.

**Acceptance Criteria:**
- AC1: Given the record, then § The reset states deletion, key, exclusions, fixture, idempotence, invocation, exit codes and output once, and names each participant's command; a test holds it.
- AC2: Given each participant with Operator rows beside Visitor rows in its scope, when the reset runs twice, then the Operator rows are unchanged, the scope equals the fixture after each run, the second run leaves it identical, and the principal is kept, held by a test per stack against a real store.
- AC3: Given each participant with demo off or the principal absent, when the reset runs, then it reports `skipped`, exits 0 and changes nothing, held by a test per stack.
- AC4: Given a fault, then the reset applies nothing and exits 1 with one line, held by a case per stack.
- AC5: Given each fixture, then it is committed in its application's repository with fixed ids and times, and every table of the scope is classified as reset or structural by a case that fails on a new table.
- AC6: `cs-tracker`'s demo item ids never equal an Owner item id; `digital-library`'s reset removes uploaded files and covers; the record says whether its admin's container routes over a demo library are closed or accepted, and why.
- AC7: Root typecheck and suite; the tracker's typecheck, suite and build; `cs-tracker`'s `mix precommit` and the adoption probe; `digital-library`'s suite and typecheck on Node 22.
- AC8 (Operator-pending): DR1 to DR3, each participant's reset run live after its DP5 to DP7, observed.
- AC9 (Operator-pending, ruling): DR4, DW-333's uploads.

## Implementation Notes

- Order, stated plainly: an unattended builder with no subagent tool; Checkpoint 1 answered Approve, no open question remained. The record holds the semantics (§ The reset), so this spec was about 1330 tokens when written (5315 characters before § Verification, measured, at 4 per token): under 1600, no Split or Keep question arose.
- `cuatro-tracker` (AC2 to AC5): `lib/demo-reset.ts`, `lib/demo-scope.ts` (the URL and switch moved out of `lib/demo-store.ts`, which re-exports them, because that module loads `lib/db.ts`, whose Redis client connects eagerly and logs to stdout), `scripts/demo-reset.ts`, `prisma/demo-fixture.json`; `lib/__tests__/demo-reset.test.ts` 10 cases, 5 against Postgres 18 (scratch database `tracker_demo_reset_test`), exempted from the `process.env` lint rule beside `env.test.ts`; CI's `test` job gains a `postgres:18` service and the variable, and the suite fails rather than skips in CI without it. Mutants, each failing a case: the principal's `User` row deleted, the command built on the Operator's URL, no transaction, the off guard, the absent guard. The command through `tsx`, as the image runs it, against the scratch database with `REDIS_URL` pointing nowhere: off `skipped` exit 0, then `reset rows=12` exit 0 twice, `public` untouched. Suite 107 files, 1234 passed; typecheck exit 0; `SKIP_ENV_VALIDATION=1 pnpm --filter tracker build` exit 0.
- `cs-tracker` `dev` `d1adf6c`, `7b79f25`, `dcd35ee` (AC2 to AC6): `CsTracker.DemoReset`, `Release.demo_reset/0` (one connection, none while off), `priv/demo/fixture.json`; `test/cs_tracker/demo_reset_test.exs` 9 cases, including an Owner item and a Visitor item under one id, and a renamed demo table that fails the reset while the Owner's table of that name stays whole. Mutants, each failing a case: the delete unqualified (4 cases), the sequences not moved, the floor guard, the enabled guard. `Release.demo_reset/0` run with `mix run --no-start` against a scratch dev database: off `skipped` exit 0, `reset rows=12` exit 0 twice, a renamed demo table `failed: Postgrex.Error undefined_table` on stderr exit 1. `mix precommit` exit 0, 746 tests, 0 failures, 4 excluded (737 before), scratch Postgres 18, no format change left. Adoption probe (it reads the Operator's checkout, untouched): first run exit 3 (BLOCKED, the Tailwind binary reported no version, which answered `v4.1.12` by hand a minute later), second exit 1 (18 of 19, the planted-candidate case), then three runs 19 of 19, exit 0, the last at 2026-10-03T02:28:30Z. Recorded as flaky on this host, not caused here: no `cs-tracker` stylesheet or token changed.
- `digital-library` `story-5-8-demo-principal` `527bc2c` (AC2 to AC6): `src/demo-reset.ts`, `src/demo-fixture.ts`, `importBook.ts` exports its two roots; `src/__tests__/demo-reset.test.ts` 13 cases against a SQLite file and real directories. In `node:22-bookworm` with CI's packages: 32 files, 531 passed (518 before); typecheck exit 0. Mutants, each failing a case: the foreign-library refusal, the outside-scope refusal, the covers-directory check, the directory removal, the cover removal, no transaction, the absent guard, the missing-database check. The compiled `node dist/demo-reset.js` in that container: `reset rows=5` exit 0 twice, three PDFs on disk, a missing database `failed` exit 1 creating no file.
- The 5.8 verifier's minor (admin container routes): accepted, not closed, see Spec Change Log; the record says why and a case holds the way out. The id overlap 5.8 left: closed by the floor at 900000001 and the guard. DW-333: the reset removes uploads and covers; whether the demo principal may upload is ruling DR4. New: DW-334 (cross-library duplicate check); DW-331 amended (one connection per running reset).
- Root: typecheck exit 0; the full run had 6 failures, all in the six WSL-bash suites (DW-135), which each passed alone (28, 59, 20 and 1 skipped, 17, 15, 11); 79 files, 1927 tests; `ops/__tests__/demo-principal.test.ts` 9 cases. No Hub source changed, so no Hub build or rendered-output run was due.
- Not run: any reset against the estate (DR1 to DR3); a production image of any participant.

## Spec Change Log

- 2026-10-03, during implementation: AC6 and the `digital-library` task said the admin's library routes would be closed to the demo scope. Closing them would leave no way out of the reset's refusal (a library granted the demo principal by hand), since 5.8 already refuses to revoke the demo principal's grant; so the routes are recorded as accepted administration of the container, and AC6 now asks the record to say which and why. Intent unchanged.

## Review Triage Log

Review layers run inline by the builder (no subagent tool); the independent verifier is the context-free pass. Ponytail, the ECC verification loop and self-evaluation were applied inline, not invoked as skills. Design review skipped: no `.scss`, no rendered surface, no motion.

- medium, patched: the tracker's command, through `lib/demo-store.ts`, would have loaded `lib/db.ts` and its eager Redis client, holding the process open and logging to stdout; `lib/demo-scope.ts` split out, proven by running the command with `REDIS_URL` pointing nowhere.
- medium, patched: `cs-tracker`'s reset connected to the database while off; it now checks first.
- low, patched: `cs-tracker` matched its refusal by a `RuntimeError` message prefix; now `DemoReset.Refused` (`dcd35ee`).
- low, patched: `cs-tracker`'s reset held two connections; one now, and DP4's arithmetic counts it.
- low, rejected: a Visitor writing during a reset can collide with it; the reset then fails whole (exit 1) and the next run repairs it. Idempotence is claimed between runs, not under concurrent writes.
- low, rejected: the tracker finds the principal by the exact address; DP6 inserts it in that form.
- low, deferred DW-334: `digital-library`'s duplicate check crosses libraries.
- Ponytail: one new tracker module (`demo-scope.ts`, forced by the Redis import); fixtures are data files except `digital-library`'s, which is code because the image ships `dist` alone. Lean otherwise.

## Independent verification

No independent verifier has run yet.

## Verification

**Commands:**
- Root: `corepack pnpm typecheck`, `corepack pnpm test --run`; `pnpm --filter tracker typecheck`, `test` (Redis 6379, `TRACKER_DEMO_RESET_DATABASE_URL`), `build`; `node ops/cs-tracker-adoption-probe.mjs`.
- `cs-tracker`: `mix precommit`. `digital-library`: `pnpm test`, `pnpm typecheck` in `node:22-bookworm`.
