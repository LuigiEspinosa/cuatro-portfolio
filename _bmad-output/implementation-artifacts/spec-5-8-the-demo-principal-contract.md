---
title: 'Story 5-8: The demo principal contract'
type: 'feature'
created: '2026-10-03'
status: 'done'
baseline_commit: 'ecbb8ef864f2137fd91147b19eac2cd21afaea69'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/ops/demo-principal.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** AD-13 and FR-25/26: `demo@cuatro.dev` in every participating application, derived rather than invented per stack, owning every demo row; demo and Operator data never in one ownership scope; the principal undeletable and its credentials unchangeable from inside the application. No participant has an owner notion today: `cuatro-tracker` and `cs-tracker` are single-owner stores, and a demo account added to either would see and change the Operator's rows.

**Approach:** One record, `ops/demo-principal.md`, decides the participants from the sources and states the contract; each participant gets the same shape: a principal module, a resolver from principal to scope that refuses rather than falls back, gates calling it, the Operator's side effects withheld, and a suite case per clause. Off by default, so each application is exactly as today until the Operator turns it on. Creating the account, its credentials and every box step are Operator-pending.

## Boundaries & Constraints

**Always:** the scope inside each application's own database or store (AD-10); the issuer's subject is Operator data, supplied as a variable; other repositories on a non-production branch; no secret printed or committed.

**Never:** the resets, fixtures, scheduler or Registry flips (5.9 to 5.11); the box, the issuer, DNS, GitHub settings, any `.env.*` file; `cs-tracker`'s or `digital-library`'s production branch or the Operator's checkouts.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Off | demo switch unset | every other principal served as before; the demo address signs in nowhere and owns nothing | none |
| Demo signs in | switch on, demo credentials or subject | resolves to the demo scope only | scope unavailable: refused, never the Operator's |
| Operator signs in | switch on | resolves to the Operator's scope only | none |
| Across | either principal, a row of the other scope | not read, written or granted | 403, 404 or 409, no write |
| Delete or promote | admin acts on the principal | refused | 403 or 400 |

</frozen-after-approval>

## Code Map

- `apps/tracker`: `lib/db.ts` (Operator store, many importers), `lib/auth.ts` (credentials, JWT), `middleware.ts` (the gate), `app/admin/layout.tsx`, `lib/jobs/*` and `worker.ts` (Operator only), `tests/setup.ts`.
- `cs-tracker` `dev`: `auth/oidc.ex` (`owner?`, `signed_in?`), `plugs/require_owner.ex`, `live_assigns.ex`, `endpoint.ex` (Bandit: one process per connection), `release.ex`, `inventory_live.ex` `sync_now`, `item_live.ex` (Recently-Viewed, on-view refresh).
- `digital-library` `dev`: `apps/api/src/acl.ts` (admin bypass), `routes/admin/users.ts`, `UserRepository.ts`.
- Sources for participants: AD-13, FR-25, `ops/registry-inputs.md` § `demo`, `contracts/registry.json`, `apps/tournament/app/(viewer)`.

## Tasks & Acceptance

**Execution:**
- [x] `ops/demo-principal.md` (contract, participants, per stack, DP1 to DP8); `ops/__tests__/demo-principal.test.ts`; `ops/identity-issuer.md` § 13; `AGENTS.md` record list; DW-331 to DW-333.
- [x] `apps/tracker`: `lib/demo-principal.ts`, `lib/demo-store.ts`, `lib/scoped-db.ts`, every request path through `scopedDb`, sign-in per store, admin refused, `DEMO_ENABLED`; `lib/__tests__/demo-principal.test.ts`; `docker-compose.yml`.
- [x] `cs-tracker` `dev`: `DemoPrincipal`, `DemoRepo`, `migrate_demo`, gates, withheld actions, tests, `docs/deployment.md`.
- [x] `digital-library` branch `story-5-8-demo-principal`: scope rules in `acl.ts`, the repository and routes; tests.

**Acceptance Criteria:**
- AC1: Given the sources, then the record names the participants with a reason per Registry entry, and states the contract once; a test holds the in-repository address and the participant list to it.
- AC2: Given each participant, then its principal is `demo@cuatro.dev` derived as the record states (issuer subject for `cs-tracker`, account address otherwise), needing no issuer value until the Operator supplies it.
- AC3: Given each participant with demo on, then a demo row lands in the demo scope only and an Operator row in the Operator's only, and neither principal reads, writes or is granted across, held by a test per stack.
- AC4: Given each participant, then no in-application path deletes the principal, makes it an administrator or changes its credentials, held by a test per stack.
- AC5: Given each participant with demo off, then every other principal is served as before: existing suites pass unchanged and a case per stack holds the off state.
- AC6: The Operator's side effects (tracker admin, `cs-tracker` sync and price refresh) are refused to the demo principal.
- AC7: Typecheck and the full root suite pass; the tracker's typecheck and suite; `cs-tracker`'s `mix precommit` and the adoption probe; `digital-library`'s suite and typecheck on Node 22.
- AC8 (Operator-pending): DP1 to DP3, the mailbox question, credentials, the issuer account and its subject.
- AC9 (Operator-pending): DP4 to DP7, the budget ruling and each participant turned on, both scopes observed live.
- AC10 (Operator-pending, ruling): DP8, `cs-tournament`'s participation.

## Design Notes

The scope is a store, not an owner column: both single-owner applications carry global unique keys (`tmdb_id`, `classid`) and dozens of unscoped queries, so a Postgres schema `demo` in the same database gives each principal the whole schema, delete-by-owner is emptying it, and a request holds one store from its gate. `digital-library` already has per-library grants, so its scope is the libraries the demo principal alone holds.

Spec about 1577 tokens (6306 characters before § Verification, at 4 per token) when written: under 1600, no Split or Keep question arose; Checkpoint 1 answered Approve.

## Verification

**Commands:**
- Root: `corepack pnpm typecheck`, `corepack pnpm test --run`; `pnpm --filter tracker typecheck` and `test` (Redis on 6379); `node ops/cs-tracker-adoption-probe.mjs`.
- `cs-tracker`: `mix precommit` against a Postgres on 5432. `digital-library`: `pnpm test` and `pnpm typecheck` in `node:22-bookworm`.

## Implementation Notes

- Order, stated plainly: an unattended builder with no subagent tool, which read and built before writing this spec; the frozen block states the intent the code was built to. Checkpoint 1 answered Approve; no open question remained, the participant and scope choices being recorded in the record.
- Participants (AC1): FR-25 binds a `Live` application that requires authentication; `apps/tournament/app/(viewer)` is public, so `cs-tournament` is not one, pending DP8 (DW-332). `ops/__tests__/demo-principal.test.ts` 5 cases.
- `cuatro-tracker` (AC2 to AC6): `lib/__tests__/demo-principal.test.ts` 13 cases; suite 106 files, 1224 passed; typecheck exit 0; `SKIP_ENV_VALIDATION=1 pnpm --filter tracker build` exit 0 (its first run failed on a lint rule the new test broke, fixed). Real Postgres 18 (2026-10-03T00:06:52Z): `migrate deploy` applied every migration to `public` and to `?schema=demo` (9 tables, 23 indexes, 6 checks each); the real `storeFor` and `authorizeCredentials` put the same `tmdb_id` 603 in both schemas, each store saw only its own entry and user, and each address signed in against its own store. Mutants, each failing a case: `storeFor` answering the Operator store or the demo store across, the `schema` parameter dropped, sign-in not through `storeFor`, `scopedDb` falling back or ignoring the session, the middleware pattern narrowed, an Operator-store import in `app/api/progress/route.ts`, the layout check dropped. Survives: `DEMO_ENABLED` validated as any string (only a junk value differs).
- `cs-tracker` `dev` `8109599`, `e782b4c` (AC2 to AC6): `mix precommit` exit 0, 736 tests, 0 failures, 4 excluded (726 before), against a scratch Postgres 18; the test helper runs `migrate_demo` on the suite's database every run, which created `demo` with its own `items` and `schema_migrations` and left `oban_jobs` in `public` alone. Mutants, each failing a case: `put_repo` always the Owner's, the Owner's subject accepted as the demo's, the `search_path`, `admitted?` without the demo, the endpoint reset, the plug's `put_repo` (once the plug was tested on its own), the item view's and the sync's guards, the `on_mount` flag. Adoption probe 19 of 19, exit 0 (2026-10-03T00:49:30Z; it reads the Operator's checkout, which this story did not touch).
- `digital-library` `story-5-8-demo-principal` `4d7bea0`, `b94a95e` (AC2 to AC5): in `node:22-bookworm`, 162f14a 30 files 509 passed; the branch 31 files 518 passed, typecheck exit 0. Mutants, each failing a case: the boundary check, the admin's allowed ids, both grant refusals, the revoke refusal, the repository's delete and admin refusals, the route's 403 and 400, the admin list filter, the book delete check. The reading-progress branch's mutant broke the statement and failed every case, so it is not counted.
- Root: typecheck exit 0; the full run had 6 failures, all in the six WSL-bash suites (DW-135), which then passed alone (150 passed, 1 skipped); 79 files, 1923 tests. No Hub source changed, so no Hub build or rendered-output run was due. Not run: a production-image comparison of any participant with demo off; AC5 rests on the suites.
- Fix round 1 (AC3, AC10): the new case in `test/cs_tracker/demo_principal_test.exs` (an Owner item pushed to Recently-Viewed, a demo item under the same id in schema `demo`, `/` mounted as each principal) failed first on the unguarded dashboard, reproducing the finding; `5927991` makes `DashboardLive.recent_items/1` answer nothing for a socket whose `@demo_principal?` is true, and the case then passed, with the Owner's dashboard still showing his item. Its guard's mutant fails the case. `mix precommit` exit 0, 737 tests, 0 failures, 4 excluded, scratch Postgres 18; adoption probe 19 of 19, exit 0 (2026-10-03T01:12:25Z). The record now names `cs-tracker`'s cooldown and breaker display as accepted job metadata (§ Each participant, Shown, accepted), and the `cs-tournament` row, DP8 and DW-332 name the Steam player sign-in and `POST /api/roster/enroll`, recommendation (a) unchanged. Root: typecheck exit 0; two full runs each failed only in the six WSL-bash suites (DW-135, 5 and 11 cases), which passed together on rerun (7 files with the record's test, 155 passed, 1 skipped).

## Independent verification

- Round 1 (2026-10-03): **refused**, nothing pushed. Every stage passed in the verifier's own runs (root 79 files, 1921 passed; tracker 1224; `cs-tracker` `mix precommit` 736, 0 failures, probe 19 of 19; `digital-library` 518 on Node 22; every guard it mutated failed a case). One major finding: `cs-tracker`'s `DashboardLive.recent_items/0` read the Owner's Recently-Viewed cache for the demo principal and resolved those ids against schema `demo`, a read across the boundary with no case, so AC3 was unmet for `cs-tracker`. Two minor: the record's `cs-tournament` row and DP8 omitted the Steam player sign-in and self-enrollment; the dashboard's display of the Owner's sync cooldown and breaker was not recorded as accepted.
- Fix round 1: all three fixed, see § Implementation Notes. Round 2 verdict not yet recorded.

## Spec Change Log

## Review Triage Log

Review layers run inline by the builder (no subagent tool); the independent verifier is the context-free pass. Ponytail, the ECC verification loop and self-evaluation were applied inline, not invoked as skills. Design review skipped: no `.scss`, no rendered surface changed, no motion.

- high, patched: the tracker's new test read `process.env`, which its lint forbids, so `next build`, and the image, failed; found by building.
- medium, patched: revoking the demo principal's grant moved a library with its demo-written rows into the Operator's reach; a demo library now leaves the scope only by deletion (`b94a95e`).
- major (verifier round 1), patched: `cs-tracker`'s dashboard read the Owner's Recently-Viewed cache for the demo principal (`5927991`, with a case).
- minor (verifier round 1), patched: the `cs-tournament` premise omitted the Steam player sign-in; the dashboard's sync cooldown and breaker display was not recorded as accepted. Both now in the record.
- medium, patched: two guards had no case (`cs-tracker`'s plug `put_repo`, the tracker's admin layout); each now has one and fails under its mutant.
- low, deferred to Story 5.9 in the record: `cs-tracker` item ids repeat across schemas, so `prices:item:<id>` reaches both scopes' views.
- low, rejected: the demo's sync-button state reads the Owner's job times from `public.oban_jobs`; job metadata, the sync itself withheld; recorded.
- low, rejected: `scopedDb` reads the session once per helper; one JWT decode each, on a one-user application.
- low, rejected: the tracker's demo client is not disconnected on shutdown; the process exit closes it.
- medium, deferred DW-333: the demo principal can upload into its `digital-library` library, shared by every Visitor.
- Ponytail: three tracker modules (`demo-principal` imports nothing for the middleware; `demo-store` and `scoped-db` split to avoid a cycle with `lib/auth.ts`). Lean otherwise.
