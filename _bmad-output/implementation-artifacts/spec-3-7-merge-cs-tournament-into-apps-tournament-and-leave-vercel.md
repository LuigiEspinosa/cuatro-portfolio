---
title: 'Story 3.7: Merge cs-tournament into apps/tournament and leave Vercel'
type: 'feature'
created: '2026-09-29'
status: 'done'
baseline_commit: '1c708906a443804b2bbd020415d8ae1c6a878ffd'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-3-6-merge-cuatro-tracker-into-apps-tracker.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** `cs-tournament` (Next.js 16 on Supabase, plus a Go demo-ingestion worker) is its own
private repository, deployed nowhere since the Operator removed Vercel on 2026-09-24 (Registry 1.4.0,
`Complete`, no `live`). It is the third and last of AD-20's merges, and has no deploy unit.

**Approach:** Merge a `git filter-repo` rewrite of the source into `apps/tournament/` with its history,
make the Next.js side the workspace `tournament` under the one root lockfile with its typecheck and
suite in CI, and give it and the Go worker one deploy unit each: their own image built and checked in
CI, pushed by sha, and compose services no deploy starts. Write, not run, the identity export-and-map
and the authenticate-as-an-existing-user check the placement needs. Placing it is not this run.

## Boundaries & Constraints

**Always:**

- The merge is `git filter-repo --to-subdirectory-filter apps/tournament` on a scratch clone, then
  `git merge --allow-unrelated-histories`; `git log --follow` works on a real file afterwards.
- One root `pnpm-lock.yaml`; `pnpm install --frozen-lockfile` passes; the Hub's build, the seven
  `ci.yml` jobs, typecheck and the unit suite stay green; no gate weakens.
- Images `ghcr.io/luigiespinosa/tournament:<sha>` (root pruned by `turbo prune tournament --docker`,
  `apps/tournament/Dockerfile`) and `ghcr.io/luigiespinosa/tournament-worker:<sha>` (Go, its own
  context `apps/tournament/worker`, never Turborepo, AD-2), each pushed only after it answered its probe.
- Nothing migrates on boot (AD-23). The Registry entry is unchanged: `Complete`, no `live`.
- Records say committed on `dev`; nothing here is placed or live.

**Never:**

- No placement: nothing on the box, no hostname, no DNS, no router, no `deploy.yml` wiring, no
  `ops/capacity-gate.yml` change (AD-9). No push, no merge to `main`, no secret, no archive.
- No change to the application's behaviour or data layer beyond what building it here needs; no token
  adoption or restyle (Epic 8 wave 2).
- No edit to `ops/deploy-remote.sh`, `image.yml`, `image-finance.yml`, `image-tracker.yml` or any
  other application's Dockerfile.

**Decisions** (unattended run: the orchestrator relayed the Operator's instruction of 2026-09-28 to
finish Epic 3 with the stories as written. Each answers a gap from the sources, is reversible before
placement, keeps every gate green, and is an Operator item):

1. **Source `main`** at `0d3e856f20c9d686b77d7a8ed001dafa123fed36`, its only branch, 102 commits.
2. **Ids:** `tournament` for workspace, image and service; the worker is `tournament-worker` (image
   and service). The Registry id stays `cs-tournament`, DW-260's split, as finance and tracker.
3. **Supabase stays its backend.** The app is Supabase Auth, PostgREST, Realtime and RLS on
   `auth.jwt()`; the worker writes Postgres directly and stores demos in Cloudflare R2. Where its data
   lives at placement (Supabase Cloud kept as a declared store with its own backup path, AD-10's
   exception, or moved onto the box, which replaces Auth, PostgREST and Realtime) is the Operator's,
   filed as a DW item. So no `tournament` database, role or migrate service in `anchor-db` now; its
   SQL migrations stay the discrete `supabase db push` they are, and nothing runs them on boot.
4. **The bcrypt premise does not hold, and the obligation does.** No user has a password: login is
   Steam OpenID, and `lib/auth/session.ts` creates each Supabase Auth user without one, keyed by the
   synthetic email `<steamid64>@steam.inclusivcup.local`; no table references `auth.users`. So no
   user can be forced through a reset, and what must move is the steamid64 identity. `ops/tournament-identity.mjs`
   `export` reads the source's `auth.users`, `player` and `app_role` into a mapping and refuses any user
   holding a password hash or an unmappable email; `verify` authenticates as an existing user against
   the target by the login's own four Auth calls and requires the database to see that steamid64 and
   role (`jwt_steamid64()`, `is_admin()`). Both need Supabase credentials, so the Operator runs them.
5. **Health:** `app/api/health/route.ts` answers 200 with no Supabase call (liveness): nothing here
   can reach Supabase, and a readiness probe is chosen with the data home (Decision 3). The worker
   has `GET /healthz` already.
6. **The Hub's gates are the Hub's:** root `tsc` and Vitest exclude `apps/tournament`;
   `OTHER_APPLICATIONS` gains it; CI's `test` job runs its typecheck, suite and the worker's
   `go vet` and `go test` (the runner's Go fetching `go.mod`'s toolchain).
7. **Manifest:** name `tournament`, `lint` goes (DW-271), `typecheck` added; `package-lock.json` goes,
   pnpm resolves its exact pins; `next.config.ts` `output: 'standalone'`.
8. **Compose:** `tournament` and `tournament-worker` under profile `tournament`, tagged
   `${TOURNAMENT_TAG-}`, secrets from `.env.production` prefixed `TOURNAMENT_`, no shared network.
9. **The public Supabase URL and anon key are build-time inputs** the image is built without; they
   are the placement's (DW item), as finance's auth URL is (DW-269).
10. **The source's own delivery files stay as merged** (`.claude/`, `_bmad/`, `_bmad-output/`,
    `docs/`, `vercel.json`, `eslint.config.mjs`), inert here, filed as DW-276 filed the tracker's.
    **Amended 2026-09-30 (Epic 3 retrospective, finding M2, Operator ruling):** not all of it was
    inert. `apps/tournament/.claude/`, `_bmad/` and `_bmad-output/` (346 tracked files) and
    `apps/tracker/CLAUDE.md` loaded in this repository as directory-scoped skills and instructions
    carrying the standalone repositories' commands. The Operator ruled to remove them, and one commit
    on 2026-09-30 deleted all four trees; the applications' own histories keep them.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Push | any branch | both images built; `/api/health` and `/healthz` 200; both sha tags pushed | any failed step: that image not pushed |
| Hub deploy | compose with tournament, only `HUB_TAG` set | the Hub's commands exit 0; no tournament container | none needed |
| Export | a user with a password hash, or an email not `<17 digits>@steam.inclusivcup.local` | exit 1 naming the user id | no mapping written |
| Export | every user mappable | mapping TSV: id, steamid64, role, display name; exit 0 | none |
| Verify | steamid64 in the mapping | exit 0 only if `jwt_steamid64()` and `is_admin()` answer that id and role | exit 1 naming the step that failed |
| Tournament stylesheet | a literal under `apps/tournament/` | not read | none |

</frozen-after-approval>

## Code Map

- Source `https://github.com/LuigiEspinosa/cs-tournament` (public since 2026-09-24, KV-2), `main`
  `0d3e856`, 662 files, all LF. Filtered clone `<scratchpad>/epic-3/3-7/filtered` at `243ad04fedd007a9c72d1fe6509540036c074bd1`
  (needs `core.longpaths`: `.claude/skills` paths pass Windows' limit).
- `apps/tournament/` after the merge: `package.json` `inclusivcup`, npm `package-lock.json`, exact pins
  (next 16.2.10, react 19.2.7, supabase-js 2.110.0, ssr 0.12.0, vitest 4.1.9); `vitest.config.ts`
  includes `lib/**/*.test.ts`, stubs `server-only`; `lib/env.ts` lazy getters; `lib/auth/session.ts`
  (synthetic email, createUser, generateLink, updateUserById, verifyOtp); `lib/supabase/browser.ts`
  reads `NEXT_PUBLIC_SUPABASE_*`; `supabase/migrations/0001..0029`, `0002_rls.sql` `is_admin()`,
  `jwt_steamid64()`; `worker/` Go 1.26.4 module `cs-tournament/worker`, `worker serve` on `$PORT`
  (8080), `GET /healthz`, config needs `R2_*`, `WORKER_MATCHZY_SHARED_SECRET`, `DATABASE_URL`;
  pgxpool connects lazily.
- Models from Stories 3-5 and 3-6: `apps/finance/Dockerfile` (standalone), `.github/workflows/image-finance.yml`,
  `image-tracker.yml`, `docker-compose.yml`, `docker/__tests__/{finance,tracker}-image.test.ts`,
  `compose.test.ts`, `ops/literal-conformance.mjs` `OTHER_APPLICATIONS` and its test,
  `anchor-contract.test.ts` `isSearchExcluded`, `workflow-hardening.test.ts` (widened jobs, Node
  stages, unit gate steps), root `tsconfig.json`, `vitest.config.ts`, `pnpm-workspace.yaml`,
  `ops/__tests__/turborepo.test.ts`.

## Tasks & Acceptance

**Execution:**

- [x] Merge: filtered clone fetched without a remote, merged subject-only, `git log --follow` proved.
- [x] Workspace: `apps/tournament/package.json`, `package-lock.json` removed, root lockfile;
  `next.config.ts` standalone; `app/api/health/route.ts` (its probe run by the image workflow); root excludes;
  `OTHER_APPLICATIONS` and alias-search pins; `ci.yml` tournament and Go steps; workflow-hardening.
- [x] Deploy units: `apps/tournament/Dockerfile`, `apps/tournament/worker/Dockerfile`,
  `.github/workflows/image-tournament.yml` (two jobs), `docker-compose.yml`,
  `docker/__tests__/tournament-image.test.ts`, `compose.test.ts` cases.
- [x] Identity: `ops/tournament-identity.mjs`, `ops/__tests__/tournament-identity.test.ts`.
- [x] Records: `ops/estate.md`, `ops/literal-conformance.md`, `AGENTS.md`, `README.md`,
  `apps/tournament/README.md`, `deferred-work.md`, sprint-status.

**Acceptance Criteria:**

- Given AD-20, when the merge is performed, then filter-repo ran on a scratch clone and
  `git log --follow` lists a file's source commits from `apps/tournament/`.
- Given the Go worker, when the merge lands, then it has its own id, image and compose service, and
  Turborepo neither builds nor tests it.
- Given the existing users, when the placement moves them, then the export refuses any password hash
  and `verify` authenticates as an existing user; both are exercised here against a real Postgres
  and a stubbed Auth, and their real runs are Operator items.
- Given AD-9 and FR-28, when this story closes, then nothing is placed, the capacity gate and Registry
  are unchanged, and the records list the placement's steps: gate, `placements`, load reading,
  hostname, `live` and `Live` in one change.
- Given NFR-2, when the merge lands, then the Hub's build, typecheck, suite and gates pass as before.

## Implementation Notes

- The merge is its own commit, `b98dabb219b144084d8e95d4c73610a21f1d2ca7`, subject only, parents `1c70890`
  (dev) and `243ad04` (the filtered source). Every blob came in LF, and the longest path is 171
  characters, so the main checkout needed no `core.longpaths` (the scratch clone did).
- The npm lockfile went; pnpm resolved every exact pin to the version it named. The ranges moved within
  themselves: `@types/node` 24.13.2 to 24.19.0 and `@types/react` 19.2.17 to 19.2.14 (the one the root
  already holds). Beyond the new importer, the fold moved two transitive resolutions pnpm dedupes: the
  `@types/node` that `@types/{connect,mysql,pg}` and the `@inquirer` packages pull (22.19.15 to 25.5.0,
  types only, under finance and tracker) and `ajv` under `@prisma/streams-local` (8.18.0 to 8.20.0).
  Finance and tracker typecheck and their suites pass on it (Verification), DW-270's shape.
- `tsc` over the whole application fails on 21 errors, all in nine test files, identically in an untouched
  clone installed from the source's own lockfile; the source never ran it. `typecheck` therefore reads
  `tsconfig.typecheck.json`, the application without `*.test.ts`, which is what `next build` checks
  (DW-282). The suite itself runs every test.
- On this host the suite first failed two cases: its vector check compares the generator's `\n` output
  with a CRLF checkout. `.gitattributes` pins `apps/tournament/roulette/vectors/*.json` to LF; the blobs
  were LF already. Under Python 3.12 (the runner's) the check passes too.
- The Go step uses `actions/setup-go@v6` with `go-version-file`, which installs exactly the release
  `go.mod` names, rather than relying on whatever Go the runner image carries: Decision 6's outcome, by a
  more deterministic mechanism than its parenthetical names.
- The server image is 384 MB, the worker's 46.6 MB (Alpine, `nobody`). `/` in the server image answers
  500 without Supabase values, as expected; `/api/health` answers 200.
- `next.config.ts` had nothing custom, so `output: 'standalone'` is its only change.

## Spec Change Log

## Review Triage Log

No subagents in this run: every layer ran inline in the builder's session, over the diff since the merge
commit (65 kB; the root lockfile, the deleted npm lockfile and `_bmad-output/` excluded), the merge itself
checked by its own proof. Blind Hunter floor: sqrt(65.2) is 8.1, plus 1, floor 9. One pass, no loopback.

| # | Layer | Finding | Verdict | Route |
|---|---|---|---|---|
| 1 | Blind Hunter | `ops/tournament-identity.mjs` gives no hint that Supabase's direct host is IPv6 only, so the Operator's export from an IPv4 network fails on connection | low: real, met on first use from most networks | patch: the header names the session pooler URL, as `worker/config/config.go` does |
| 2 | Blind Hunter | The lockfile fold moved resolutions outside the new importer, recorded nowhere | low: real, a later reader of the lockfile diff would ask | patch: Implementation Notes name both moves; finance and tracker verified on them |
| 3 | Blind Hunter | The tournament image is pushed with a browser bundle whose Realtime client throws | low: real for a placed image only, and nothing is placed | already DW-281 |
| 4 | Blind Hunter | `/api/health` passes a container whose Supabase values are missing, so a rollout could drain a working container for a broken one | medium if placed: real, and nothing is placed | already DW-280 |
| 5 | Blind Hunter | `image-tournament.yml` pushes two more private packages on every push | maybe-false: GHCR private storage billing unread | already DW-278 |
| 6 | Blind Hunter | The worker's base `alpine:3.22` is a floating minor tag | false as a defect: the Hub, finance and tracker images float `node:24-slim` the same way, and AD-3's sha tag binds the application image, not its base | rejected |
| 7 | Blind Hunter | `verifyExistingUser` interpolates the steamid64 into a PostgREST query string unencoded | false: `main` accepts only `^\d{17}$` and finds the entry by equality | rejected |
| 8 | Blind Hunter | The tournament suite in CI depends on the runner's Python | false: the generator imports the standard library only and passes `--check` under `python:3.12-alpine`, the runner's minor | rejected |
| 9 | Blind Hunter | A fresh CI checkout has no `next-env.d.ts`, so the scoped `tsc` might fail on CSS module imports | false: run here with `next-env.d.ts`, `.next` and the build info removed, exit 0 | rejected |
| 10 | Blind Hunter | Root `.dockerignore` excludes `.claude`, `_bmad` and `docs` at the root only, so `apps/tournament`'s copies reach the prune and builder stages | low: a few MB in intermediate stages; the runner copies only the traced output | rejected |
| 11 | Edge Case | `verify` writes to the target (creates the Auth user when absent, rebinds `app_metadata`) | false as a defect: it is exactly what a real login does, and the header says so | rejected |
| 12 | Edge Case | An `is_admin()` answer that is not a boolean | false: `admin !== (role === 'admin')` refuses any non-boolean | rejected |
| 13 | Edge Case, claims | Decision 6 says the runner's Go fetches `go.mod`'s toolchain; CI uses `actions/setup-go` | low: same outcome, `go.mod`'s release; no one meets a defect, and the fix edits the frozen spec | rejected; recorded in Implementation Notes |
| 14 | Verification Gap | `EXPORT_SQL` runs in no automated test; only `mapIdentities` does | low: real, but a wrong join shows as a role mismatch `verify` refuses, and the query ran here against a real Postgres 17 (Verification); a Postgres in the unit gate is more than a direct fix | rejected; filed as DW-284 after the independent verification raised it again |
| 15 | Verification Gap | The worker's compose healthcheck is held as text | false: `image-tournament.yml` runs the same `wget` probe against the built image before any push, observed here | rejected |
| 16 | Ponytail | `sameFile` repeats `registry-verification.mjs`'s guard instead of a one-line URL comparison | false as waste: the realpath form is the repository's pattern for a guard that must never fail open | rejected. Ponytail otherwise: "Lean already. Ship." |
| 17 | ECC verification loop | Build (`corepack pnpm --filter hub build`), types and the full suite pass; lint N/A (no lint command, `AGENTS.md`); no secret in the diff (workflow and test placeholders guard nothing) | no defect | none |
| 18 | Design Review | No `.scss` or `.tsx` outside tests changed and no motion keyword was added | No UI surface in this diff. Design review skipped. | none |

## Design Notes

**Oversized, kept.** The draft measured about 2,571 tokens (10,284 characters over four; 1,320 words)
against the SCOPE STANDARD's 1600. Answer **Keep**, relayed by the orchestrating workflow on 2026-09-29
as the Operator's instruction of 2026-09-28 to finish Epic 3 unattended with the stories as written,
the answer the unattended Epic 2 run used on 2026-09-23 and Stories 3.1 to 3.6 used since. The
multi-goal check found one goal: history, workspace, the two deploy units and the identity
instruments are one merge, and each criterion is a facet of it.

**Resumed after an interruption.** This run was relaunched after a network outage. The tree was clean
at `1c70890` and no Story 3.7 work existed, in the tree or in scratch, so it started from the beginning.

**Open Questions, answered from the sources.** Ten, answered as Decisions 1 to 10 from `epics.md`
Story 3.7 and its amendment of 2026-09-25, AD-2, AD-3, AD-7, AD-8, AD-9, AD-10, AD-14, AD-20 and
AD-23, `ops/estate.md`, `ops/registry-inputs.md` § identity (Supabase auth, observed), the source's
own `lib/auth/session.ts` and migrations, Stories 3-5 and 3-6 and DW-260, DW-269, DW-271 and DW-276,
per the orchestrator's standing instruction. Each is reversible before placement and is an Operator item.

**Checkpoint 1.** No human present: the builder reviewed the spec as a second reader against the READY
FOR DEVELOPMENT standard and the story text, found it actionable, and approved it.

**Why the bcrypt criterion is met by a steamid64 mapping.** The criterion was written (PRD addendum
§ C.6) before anyone read the source; `ops/registry-inputs.md` records Supabase auth, and the source
shows no password anywhere: `ensureAuthUser` passes `email`, `email_confirm` and `app_metadata` only.
A user's standing is `player` and `app_role` rows keyed by steamid64, and their next Steam login
re-creates or finds the Auth user by the synthetic email and re-binds the claim. So the export proves
there is nothing to reset (it refuses a password hash rather than assuming none), and the verify step
is the criterion's own test: authenticate as an existing user after the move.

## Verification

**Commands** (observed 2026-09-29 on this host, the tree at the story's final state):

- `corepack pnpm install --frozen-lockfile`: "Already up to date", exit 0.
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test --run`: "Test Files  71 passed (71)", "Tests  1752 passed (1752)", exit 0, on the
  first run and again after the review patch.
- `corepack pnpm --filter hub build`: exit 0, from a clean `.next`.
- `corepack pnpm --filter tournament typecheck`: exit 0 (also with `next-env.d.ts`, `.next` and build
  info removed). `corepack pnpm --filter tournament test`: "Test Files  57 passed (57)", "Tests  1980
  passed (1980)". The untouched source clone gives the same 1980 on an LF checkout, and
  `python:3.12-alpine` running `generate_vectors.py --check` exits 0.
- `go vet ./... && go test ./...` in `apps/tournament/worker` (go1.26.4): every package `ok`,
  `cmd/qa54` no test files.
- `pnpm turbo run build --filter tournament`: "Packages in scope: tournament", "Tasks:    1 successful, 1 total".
- `corepack pnpm --filter finance typecheck` exit 0, `test` "Tests  70 passed (70)";
  `corepack pnpm --filter tracker typecheck` exit 0, `test` beside `redis:7-alpine` "Tests  1211 passed (1211)".
- `node ops/contract-purity.mjs`, `node ops/registry-schema.mjs` ("16 applications, valid"),
  `node ops/literal-conformance.mjs` ("25 stylesheets, 21 outside the permitted set and 4 inside it"):
  exit 0. actionlint 1.7.7 over `.github/workflows`: exit 0.
- `docker build --file apps/tournament/Dockerfile .`: exit 0, 384 MB; the workflow's step run here:
  `curl` on `/api/health` `{"status":"ok"}`, the HOSTNAME probe inside the container exit 0, `uid=1000(node)`.
- `docker build --file apps/tournament/worker/Dockerfile apps/tournament/worker`: exit 0, 46.6 MB; the
  workflow's step run here verbatim, exit 0; the same `wget` probe against port 8081 exits 1; without its
  configuration `worker serve` exits naming the five missing `R2_*` values; `uid=65534(nobody)`.
- `HUB_TAG=x docker compose config --services`: `anchor-app anchor-db anchor-umami`; with `--profile
  migrate`: adds `finance-migrate tracker-migrate`; with `--profile tournament`: adds `tournament
  tournament-worker`. `docker compose --profile tournament run --no-deps tournament-worker` with
  `TOURNAMENT_TAG` unset: "invalid reference format".

**Manual checks:**

- `git log --follow --format='%h %s' -- apps/tournament/lib/auth/session.ts` prints the same three
  subjects, in order, as `git log -- lib/auth/session.ts` in the source clone.
- `node ops/tournament-identity.mjs export` against a real `postgres:17-alpine` holding migration
  `0001_core_schema.sql`, a minimal `auth.users` and two Steam users (one admin): stderr
  "tournament-identity export users=2", exit 0, and two tab-separated lines, the admin's display name
  with its tab replaced. With one user given a bcrypt-shaped `encrypted_password`: "user <id> holds a
  password hash, so the move could force a reset", exit 1, no mapping printed. A wrong password: "psql
  failed: ... password authentication failed", exit 2, the URL not echoed. No variable: exit 2.
- `verify` ran against a planted Supabase only (the suite); against a real target it is the Operator's,
  step 4 of `ops/estate.md` § Pending Operator actions for `cs-tournament`.

**Amended 2026-09-29 (evening), the real export.** Run by the Operator's session against the source
project once the Operator had restored it from a pause, `export` refused, by design, naming the
project's one Auth user: the admin, created 2026-07-02 with a Steam-style synthetic email, holds a
password hash. So Decision 4's "no user has a password" is off by one, and the refusal is the check
doing its job; the script is unchanged. Under the Operator's ruling of that day (DW-280, option one)
the data stays in Supabase Cloud and moves nowhere, so no hash is touched, no reset can be forced, and
`verify` has no target. The third criterion's proof, an existing user authenticating after the move,
becomes the Operator's Steam sign-in on `tournament.cuatro.dev` once it serves, dated in
`ops/tournament-placement.md` action 4. The placement itself is `spec-3-7-placement-tournament-on-the-box.md`.
