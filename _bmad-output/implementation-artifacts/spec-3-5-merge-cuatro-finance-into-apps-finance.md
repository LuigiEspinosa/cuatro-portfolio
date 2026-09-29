---
title: 'Story 3.5: Merge cuatro-finance into apps/finance'
type: 'feature'
created: '2026-09-29'
status: 'done'
baseline_commit: '0412525a1465682c69bd3a6956fd3ba90dde6db8'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-3-4-deploy-by-pulling-a-tag-with-docker-rollout.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** `cuatro-finance` (Next.js 16, Prisma 7, Tailwind 4) is its own repository, so the Estate
carries one more repository than its end state, and the application has no deploy unit: no
Dockerfile, no image, no compose service, no migration step and no database of its own (AD-7,
AD-8, AD-10, AD-23). It is the first of AD-20's three merges.

**Approach:** Rewrite a scratch clone of the source into `apps/finance/` with `git filter-repo` and
merge it into `dev` with its history, then make it the workspace `finance` under the one root
lockfile, with its own typecheck and suite in CI, an image built from the pruned root and pushed to
GHCR by sha, one compose service with a real healthcheck, a one-off migration service, and database
and role `finance` with an explicit connection limit. It is merged, building in CI and imaged, not
placed on the box.

## Boundaries & Constraints

**Always:**

- The merge is `git filter-repo --to-subdirectory-filter apps/finance` on a scratch clone, then
  `git merge --allow-unrelated-histories`, and `git log --follow` works on a real file afterwards.
- One root `pnpm-lock.yaml` and one `pnpm-workspace.yaml`; `pnpm install --frozen-lockfile` passes.
- The image is `ghcr.io/luigiespinosa/finance:<git-sha>`, never a floating tag, built from the root
  narrowed by `turbo prune finance --docker` with `apps/finance/Dockerfile`, as the Hub's is.
- Migrations never run on container boot; they run as the one-off `finance-migrate` before a rollout.
- The Hub's build, its seven `ci.yml` jobs, typecheck and the unit suite stay green; no gate weakens.
- Records say committed on `dev`: finance reaches `main` at the Epic 3 merge, and is not placed.

**Never:**

- No placement: nothing on the box, no router, no hostname, no `ops/capacity-gate.yml` entry.
- No push, no merge to `main`, no new secret, no archive, no GHCR visibility change.
- No token adoption and no restyle (Decision 3). No `absorbed_into` (Decision 13).
- No edit to `ops/deploy-remote.sh`, `deploy.yml`, `image.yml` or `apps/hub/Dockerfile`.

**Decisions** (unattended run: the orchestrator relayed the Operator's instruction of 2026-09-28 to
finish Epic 3 with the stories as written. Each answers an intent gap from the sources, is reversible
before the Epic 3 merge, keeps every gate green, and is an Operator item):

1. **The source branch is `dev`.** `main` holds one commit, a `LICENSE`, which is `dev`'s root, so
   merging `dev` carries both branches' history (`ops/registry-inputs.md` read `dev` for the same reason).
2. **The id is `finance`** for the workspace, image, compose service, database and role, as the story
   names them; the Registry id stays `cuatro-finance`, the Hub's split (DW-260).
3. **Token adoption is deferred whole** (AD-14): finance keeps its own palette and fonts, and is
   `In progress`, so unrendered, and AD-25 gives it no restyle until it renders.
4. **The Hub's gates are the Hub's.** One named list, `OTHER_APPLICATIONS` in
   `ops/literal-conformance.mjs`, keeps `apps/finance/` out of the FR-17 gate and the alias search;
   the root `tsc` and Vitest exclude it, and finance's own typecheck and suite run by filter in CI's
   `test` job (DW-258). Every other gate never reaches it or passes over it unchanged.
5. **Finance's own lockfile is folded in**, so it keeps the versions it was built with.
6. **Prisma's install scripts stay unbuilt** (`ignoredBuiltDependencies`): `prisma generate` fetches
   its engine on first use, so no Hub job depends on Prisma's download host.
7. **Compose:** `finance` and `finance-migrate` in `docker-compose.yml`, under profiles no deploy
   activates, tagged `${FINANCE_TAG-}`: compose interpolates every service, so a `:?` would stop
   every Hub deploy, and an unset tag is an invalid reference Docker refuses.
8. **The image carries the migration toolchain**: the Prisma CLI at the lockfile's versions under
   `/app/migrate`, installed by npm (DW-268), exercised in CI against a throwaway database.
9. **Connection limit:** five per container in `lib/db.ts`; role `CONNECTION LIMIT 10`, two
   containers across a rollout, in `apps/finance/prisma/provision.sql`, which CI runs.
10. **`/api/health` answers 200 only when the database answers**, so a rollout never drains a serving
    container for one that cannot reach its data.
11. **`prisma.config.ts` reads `process.env.DATABASE_URL`**, so a build needs no secret.
12. **The `lint` script goes**: `next lint` left Next 16 and CI runs no lint (DW-271).
13. **The Registry is unchanged**: its `cuatro-finance` values stay true, and `absorbed_into` and
    `source` move once the source repository is archived (Story 3.8).
14. **`.dockerignore` refuses env files at any depth**, since an app directory can now hold one.
15. **"Never both in one" is held by a suite** over the migrations; the four existing ones apply
    together to an empty database at placement, with no version serving.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Push | any branch | build, provision and migrate a throwaway `finance`, `/api/health` 200, push the sha tag | any failed step: nothing pushed |
| Hub deploy | `docker-compose.yml` with finance, only `HUB_TAG` set | the Hub's compose commands exit 0; no finance container | none needed |
| Untagged start | `FINANCE_TAG` unset | the reference ends in `:` | Docker refuses it |
| Database down | `/api/health` | 503 | the probe fails, a rollout keeps the old container |
| Mixed migration | one expanding and contracting | the finance suite fails naming it | none |
| Finance stylesheet | a literal under `apps/finance/` | not read; under `apps/hub/` refused | none |
| Boot | the image starts | the server alone, no migration | none |

</frozen-after-approval>

## Code Map

- Source: `https://github.com/LuigiEspinosa/cuatro-finance`, `dev` at
  `bcf7369e89d72af9cd34140ee6756ed700907edb`, 37 commits, 98 files. `main` is
  `38b23e3cad6de4cbf009265cd948784b21958578` (`LICENSE`), `dev`'s root. `git filter-repo` (a40bce548d2c)
  is installed at `~/.local/bin`. The scratch clone is
  `<scratchpad>/epic-3/3-5/verify-filter`; the interrupted attempt's `finance-filtered` filters to the
  same `dev` sha, `3698b0d6adab872e0fce5845f16464b116eeb2dd`, so both are faithful.
- `apps/finance/` after the merge: own `pnpm-lock.yaml` and `pnpm-workspace.yaml`; `package.json` named
  `cuatro-finance` with `lint: next lint`; `prisma.config.ts` `env("DATABASE_URL")` throws when unset;
  `lib/db.ts` `new PrismaPg({ connectionString })`; `next.config.ts` empty; `middleware.ts` skips
  `api/`; `vitest.config.ts` (node, `@` to itself); `app/tokens.css` 78 `oklch` literals naming
  `--accent` and `--font-mono`, as does `app/layout.tsx`; `lib/auth-client.ts` inlines
  `NEXT_PUBLIC_BETTER_AUTH_URL`; `generated/prisma` gitignored; four migrations, each only expanding or
  only contracting.
- Root: `tsconfig.json` includes `**/*.ts`; `vitest.config.ts` collects every test under `@` =
  `apps/hub` (DW-258); `pnpm-workspace.yaml` `onlyBuiltDependencies`.
- Gates: `ops/literal-conformance.mjs` `inspect()`; `apps/hub/app/__tests__/anchor-contract.test.ts`
  `isSearchExcluded` and the source-root pin; `ops/__tests__/workflow-hardening.test.ts` widened jobs
  and the unit gate; `ops/__tests__/turborepo.test.ts` refuses a lint script and prunes every workspace.
- Deploy unit models: `apps/hub/Dockerfile`, `.github/workflows/image.yml`, `docker-compose.yml`,
  `ops/deploy-remote.sh` (`<service>-migrate` under the `migrate` profile), `docker/__tests__/compose.test.ts`.

## Tasks & Acceptance

**Execution:**

- [x] Merge: filter the scratch clone, fetch it into the Anchor without a remote, merge
  `--allow-unrelated-histories` with a subject-only message, prove `git log --follow`.
- [x] `apps/finance/`: delete its lockfile and workspace file; `package.json`: name `finance`, no
  `lint`, `build` and `typecheck` run `prisma generate` first; `prisma.config.ts` reads
  `process.env.DATABASE_URL`; `next.config.ts` `output: "standalone"`; `lib/db.ts` `max` 5;
  `app/api/health/route.ts` with its test; a migrations suite; `prisma/provision.sql`;
  `Dockerfile`; a README note.
- [x] Root: `pnpm-lock.yaml` folded and rewritten by pnpm; `pnpm-workspace.yaml`
  `ignoredBuiltDependencies`; `tsconfig.json` and `vitest.config.ts` exclude `apps/finance`;
  `.dockerignore` at any depth; `docker-compose.yml` `finance` and `finance-migrate`.
- [x] CI: `ci.yml` `test` job gains finance's typecheck and suite by filter;
  `.github/workflows/image-finance.yml` builds, provisions, migrates, checks and pushes.
- [x] Suites: `OTHER_APPLICATIONS` pinned and exercised; the alias search skips it; workflow
  hardening (widened jobs, Node 24 in both Dockerfiles, finance's gate steps);
  `docker/__tests__/finance-image.test.ts`; `compose.test.ts` finance cases.
- [x] Records: `ops/estate.md`, `ops/literal-conformance.md`, `AGENTS.md`, `README.md`;
  `deferred-work.md` (close DW-258; amend DW-253, DW-260; file DW-267 to DW-271).

**Acceptance Criteria:**

- Given AD-20, when the merge is performed, then filter-repo ran on a scratch clone, the merge brought
  the history in, and `git log --follow` lists a file's source commits from `apps/finance/`.
- Given AD-14, when finance lands, then `turbo run build --filter finance` builds it alone, and its
  deferred token adoption is recorded in the spec, `ops/estate.md` and DW-267.
- Given AD-3 and AD-8, when the deploy unit is defined, then the image is the sha-tagged
  `ghcr.io/luigiespinosa/finance` from `apps/finance/Dockerfile` over `turbo prune finance --docker`,
  with one compose service and no `PathPrefix` anywhere.
- Given AD-23, when finance is prepared, then the image starts the server alone, `finance-migrate`
  runs migrations against `finance`, and the suite refuses a migration that expands and contracts.
- Given AD-10, when its data layer is defined, then it uses database and role `finance` with an
  explicit connection limit, and `ops/estate.md` states the Anchor Postgres' sum under `max_connections`.
- Given merging is not placing, when the story closes, then finance builds in CI and its image is in
  GHCR after the push, and the records say it is not placed, AD-9 deciding.
- Given NFR-2, when the merge ships, then the Hub's build, typecheck, suite and gates pass as before.

## Implementation Notes

- The merge is its own commit, `6d5929f684472e37b64a36c87f2940b2dd5148a4`, subject only, with parents
  `0412525` (dev) and `3698b0d` (the filtered source). It was redone in the main checkout; the
  interrupted attempt's scratch copy of the Anchor was reference only.
- The lockfile fold kept finance's own resolutions: every finance importer entry resolves to the
  version its own lockfile named (the ten reported differences are peer suffixes only), and the
  Hub's and `packages/tokens` importers are unchanged. The root importer changed in peer suffixes
  only (DW-270).
- `app/api/health/route.ts` is `force-dynamic`, so the build never queries a database.
- The image carries `openssl` in the runner for the schema engine `finance-migrate` runs; the server
  needs none. `ENCRYPTION_KEY` and the Better Auth secrets are not needed to boot or to answer the
  health route, and are placement inputs (DW-269).
- Windows-only: `next build` on this host warns that it cannot copy traced chunks whose names hold a
  `:`; the Linux image build copies them and serves.

## Spec Change Log

## Review Triage Log

No subagents in this run: every layer ran inline in the builder's session, over the diff since the
merge commit (47 kB, the lockfile and `_bmad-output/` excluded), with the merge itself checked by its
own proof. One pass, no loopback.

| # | Layer | Finding | Verdict | Route |
|---|---|---|---|---|
| 1 | Blind Hunter, Edge Case | `migrations.test.ts` holds "never both in one" only; a NOT NULL column with no default or a new unique index is an expansion that still breaks the serving version, and `20260311091131_better_auth_tables` has such columns | low: real, but those four apply together to an empty database (Decision 15), and a stricter classifier would need an allowlist for them | patch: a `ponytail:` comment naming the ceiling |
| 2 | Blind Hunter | The migration toolchain is npm-installed outside the lockfile's integrity hashes | low: real, versions held equal to the lockfile by `finance-image.test.ts` | already DW-268 |
| 3 | Blind Hunter | `image-finance.yml`'s readiness loop falls through silently after 30 tries | false: the next command, `psql` with `ON_ERROR_STOP`, fails the step loudly | rejected |
| 4 | Blind Hunter | `image-finance.yml` builds on every push, `main` included, even when finance is untouched | false as a defect: an image per sha is what AD-3 needs for any later placement, and no other job waits on it | rejected |
| 5 | Blind Hunter | The role's limit of 10 equals two pools of five, with no slot for a manual `psql` during a rollout | low: real only mid-rollout, and `finance-migrate` runs before it; not met in everyday use | rejected |
| 6 | Blind Hunter | The image is built without `NEXT_PUBLIC_BETTER_AUTH_URL`, so its auth client falls back to localhost | low: real for a placed image only, and nothing is placed | already DW-269 |
| 7 | Blind Hunter | One lockfile moves the Hub's optional peers, and its traced server gains `@opentelemetry/api` | low: measured, no version change, output equal in function | already DW-270 |
| 8 | Edge Case | `classify` splits on `;`, so a semicolon inside a string or a `$$` body would split a statement | low: Prisma's generated SQL carries neither; not met in everyday use, and a SQL tokenizer is more than a direct fix | rejected |
| 9 | Edge Case | The health route's query has no timeout, so an unreachable database hangs the request | false: the compose healthcheck's `timeout: 5s` counts the hang as a failure, and CI's database is up | rejected |
| 10 | Verification Gap | `.dockerignore`'s nested env-file lines have no test | false as a gap: only a source-text assertion could hold them, which the layer's rules do not count; the Hub's line has none either | rejected |
| 11 | Verification Gap | The health route's database check is tested with a mock | false: the real query runs in `image-finance.yml` before any push, and ran here through the real compose file | rejected |
| 12 | Ponytail | `export const runtime = "nodejs"` in the health route is the default | false as waste: every route finance already has declares it, so it matches the app | rejected |
| 13 | ECC verification loop | Build (`corepack pnpm --filter hub build`), types and the full suite pass; lint N/A (no lint command, `AGENTS.md`); no secret in the diff (the workflow's `throwaway` password guards a runner-local container) | no defect | none |
| 14 | Design Review | The only `.tsx` surface is finance's own, carried verbatim by the merge | no defect in this story: its restyle is AD-25's after it renders, and token adoption is DW-267 | none |

## Design Notes

**Oversized, kept.** The draft measured about 3,550 tokens (14,213 characters over four; 1,953 words)
against the SCOPE STANDARD's 1600. Answer **Keep**, relayed by the orchestrating workflow on
2026-09-29 as the Operator's instruction of 2026-09-28 to finish Epic 3 unattended with the stories as
written, the answer the unattended Epic 2 run used on 2026-09-23 and Stories 3.1 to 3.4 used on
2026-09-28. The multi-goal check found one goal: the history, the workspace and the deploy unit are
one merge, and each criterion is a facet of it.

**Resumed after an interruption.** A first attempt on 2026-09-28 stopped in planning on a network
outage, leaving this spec as a draft and scratch work but nothing committed. This run re-filtered a
fresh clone, got the identical sha, reused the draft's decisions, and did every step in the main
checkout.

**Open Questions, answered from the sources.** Fifteen, answered as Decisions 1 to 15 from `epics.md`
Story 3.5 and Epic 8's "Not in this epic, by rule", AD-3, AD-6, AD-7, AD-8, AD-9, AD-10, AD-14,
AD-20, AD-23 and AD-25, `ops/estate.md`, `ops/registry-inputs.md`, Stories 3-1 to 3-4 and DW-253,
DW-258 and DW-260, per the orchestrator's standing instruction. Each is reversible before the Epic 3
merge and is an Operator item.

**Checkpoint 1.** No human present: the builder reviewed the spec as a second reader against the
READY FOR DEVELOPMENT standard and the story text, found it actionable, and approved it.

**Why the compose tag is not guarded.** `ops/deploy-remote.sh` runs `docker compose ... --profile
migrate config --services` for the Hub, and compose interpolates every service, profiled ones
included. `${FINANCE_TAG-}` resolves to `ghcr.io/luigiespinosa/finance:`, which Docker refuses as an
invalid reference, so no command can start finance untagged and none of the Hub's stops.

**Decision 7, read precisely.** `finance` is under the `finance` profile, which nothing activates.
`finance-migrate` is under `migrate`, the profile `ops/deploy-remote.sh` passes to list services; the
script runs only `anchor-app-migrate` from that list, so no deploy starts it either.

**Why the Hub's gates skip finance, and which do not.** FR-17 and the Story 2-22 alias search are the
Hub's rules, and finance's palette is deferred whole (Decision 3), so one named list in
`ops/literal-conformance.mjs` keeps `apps/finance/` out of both, pinned to that one entry. Every other
gate needed nothing: `contract-purity` reads `contracts/` alone, `registry-schema` reads the Registry,
the tokens and fonts drift jobs rebuild `contracts/`, Lighthouse and the rendered-output suite run the
Hub's build, `ops/__tests__/accent-fill.test.ts` reads finance's CSS and passes, and
`ops/__tests__/turborepo.test.ts` prunes `finance` like every workspace.

## Verification

**Commands** (observed 2026-09-29 on this host, the tree at the story's final state):

- `corepack pnpm install --frozen-lockfile`: "Already up to date", exit 0.
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test --run`: "Test Files  67 passed (67)", "Tests  1703 passed (1703)", exit 0.
- `corepack pnpm --filter finance typecheck`: "Generated Prisma Client (7.6.0)", then `tsc` clean,
  exit 0, on a `node_modules` whose hoisted `zod` is 4.3.6, as a fresh frozen install gives. With
  3.25.76 hoisted, as this host's was after the story, it fails TS2769 in four forms (DW-272, found
  by the independent verifier; the host was relinked). `corepack pnpm --filter finance test`: "Test Files  5 passed (5)", "Tests  70 passed (70)".
- `corepack pnpm --filter hub build`: exit 0, twice from a clean `.next`, with identical
  `.next/static` hashes both times. Against the Hub built on the base lockfile with finance set
  aside: 28 of 31 chunks byte-identical after masking the pnpm directory name of `next`, chunk
  names and module ids, the other three differing only in minifier-chosen local names (DW-270).
- `pnpm turbo run build --filter finance`: "Tasks: 1 successful, 1 total", finance alone.
- `node ops/contract-purity.mjs`, `node ops/registry-schema.mjs`, `node ops/literal-conformance.mjs`:
  exit 0; the last reads "25 stylesheets, 21 outside the permitted set and 4 inside it".
- `docker build -f apps/finance/Dockerfile .`: exit 0. actionlint 1.7.7 over `.github/workflows`: exit
  0 (after one fix, SC2034 on an unused loop variable).
- `docker build -f apps/hub/Dockerfile .` with the two Umami inputs: exit 0; the container answers `/api/health` 200, and its store carries `@opentelemetry+api@1.9.1` beside `next` (DW-270).

**Manual checks:**

- `git log --follow -- apps/finance/lib/money.ts` lists `cda27fc` and `4d64543`, the file's two
  commits in the filtered source.
- The image against Postgres 16: `provision.sql` gives role and database `finance`, `rolconnlimit`
  and `datconnlimit` 10; `migrate deploy` from `/app/migrate`: "All migrations have been successfully
  applied."; `/api/health` 200 `{"status":"ok"}`, the container's one process `next-server`; the
  database stopped, 503.
- Through the real `docker-compose.yml` (project `finance-rehearsal`, torn down with its volume):
  `anchor-db` healthy, provision, `--profile migrate run --rm finance-migrate` applied all four,
  `finance` reached "Up (healthy)" on its own healthcheck, and with `anchor-db` stopped the same
  probe printed 503 and exited 1.
- With only `HUB_TAG` set: `docker compose --profile migrate config --services` and
  `docker compose config --services` exit 0 and list no `finance`; `docker compose --profile finance
  run finance` is refused, "invalid reference format".
- `finance.cuatro.dev`: NXDOMAIN from 1.1.1.1.
