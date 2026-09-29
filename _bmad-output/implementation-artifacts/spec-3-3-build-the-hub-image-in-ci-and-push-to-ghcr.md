---
title: 'Story 3.3: Build the Hub image in CI and push to GHCR'
type: 'feature'
created: '2026-09-28'
status: 'done'
route: 'dispatch'
baseline_commit: '0aec0fbbdb6cf376c032e2c1efba6f83eef4e91e'
review_loop_iteration: 0
warnings: ['oversized']
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/ops/token-contract.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** The serving box compiles the Hub on every deploy (KV-1, AD-8) because no image of it
exists anywhere else: `docker/Dockerfile` builds from the whole repository, and nothing in CI builds
or starts it. Story 3.4 cannot deploy by pulling a tag until `ghcr.io/luigiespinosa/hub:<sha>` exists
for the commit it deploys, built from the repository root narrowed by `turbo prune --docker` (AD-8),
and until the Hub's compose service meets `docker-rollout`'s requirements as requirements.

**Approach:** Move the Dockerfile to `apps/hub/Dockerfile` with a first stage that runs
`turbo prune hub --docker` on the root context, install the pruned lockfile, build the Hub, and add a
workflow that builds the image on every push, starts it, and pushes it tagged with the commit sha.
Tests hold the tag, the trigger, the pruned install and the compose service's healthcheck,
`container_name` and `ports`; Docker on this host demonstrates the app-directory failure and the
failing healthcheck.

## Boundaries & Constraints

**Always:**

- The image is `ghcr.io/luigiespinosa/hub:<full commit sha>` and nothing else: no `latest`, no
  second tag.
- The build context is the repository root; the first stage prunes it to the `hub` workspace, and
  no later stage copies from the build context.
- The workflow's token is `contents: read` at the top and its one job widens it by
  `packages: write` alone; no third-party action is added (DW-87).
- The box keeps building until Story 3.4: `docker-compose.yml` keeps `build:`, pointed at
  `apps/hub/Dockerfile`, so a deploy at the Epic 3 merge still works (AD-20).
- `ops/token-contract.md` actions 4 and 5 are recorded as observed. A record naming
  `docker/Dockerfile` as a present-tense fact changes in this story's commit and says committed,
  never live.
- The seven `ci.yml` jobs and their commands, the `/work` baseline and every gate stay as they are.

**Never:**

- No edit to `deploy.yml` or `ops/deploy-remote.sh` (Story 3.4), no compose service renamed, no
  product or dependency change, no job added to `ci.yml`.
- No push, no merge to `main`, nothing on the box, no GitHub setting (package visibility, secrets,
  variables, branch protection).

**Decisions** (unattended run: the orchestrator relayed the Operator's instruction of 2026-09-28 to
finish Epic 3 with the stories as written. Each answers an Open Question from the sources, is
reversible, keeps every gate green, and is an Operator item):

1. **The Hub's compose service keeps its name, `anchor-app`,** and the criterion's "the `hub`
   service" is read as the Hub's service. AD-3 derives the service from the id, but the Hub's id is
   itself split (Registry `cuatro-portfolio`, workspace and image `hub`), `docker-compose.yml` records
   the `anchor-*` names as load-bearing on the shared network, and the box's Caddyfile routes to
   `anchor-app`. A rename goes with Story 3.4, whose rollout names the service (DW-260).
2. **The two Umami build inputs are written into the workflow.** Both are public: every page
   carries them, and the id is the one `spec-1-21` committed on 2026-08-17 and cuatro.dev served on
   2026-09-28. Repository variables would leave the workflow red, or its image measuring nothing,
   until the Operator set them.
3. **`contracts/` and `packages/contracts-serve/` are copied from the prune stage into the
   builder.** Neither is a workspace, so the prune leaves both out (DW-257), and the Hub's build
   reads both. Making either a workspace would add a file to the published surface or an importer to
   the lockfile.
4. **The workflow starts the image and needs `/api/health` to answer before it pushes,** so the
   runner stage's command and standalone layout have an executing check (DW-257).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Push | a commit pushed to any branch | the Image run builds from the root, `/api/health` answers, `ghcr.io/luigiespinosa/hub:<sha>` is pushed | any failed step fails the run; nothing is pushed |
| App-directory context | `docker build -f apps/hub/Dockerfile apps/hub` | fails at the prune stage: turbo cannot resolve the workspace | observed and recorded |
| Pruned install | the `deps` stage | the root and `apps/hub` importers only, no `style-dictionary` | a build-context `COPY` into `deps` fails `deps-stage.test.ts` |
| Broken container | the Hub's service running a process that serves nothing | the healthcheck reports `unhealthy`; the real image reports `healthy` | observed and recorded |
| Floating tag | a `latest` or a second tag in the workflow | `image-workflow.test.ts` fails | |
| Measurement lost | either Umami input empty or dropped | `image-workflow.test.ts` fails | |
| Rollout blocker | `container_name` or `ports` on any service, the Hub's healthcheck gone | `compose.test.ts` fails | |

</frozen-after-approval>

## Code Map

- `docker/Dockerfile` (CRLF worktree, LF index): `deps` copies the root manifest, lockfile, workspace
  file and both workspace manifests from the context (`:9-11`); `builder` runs `COPY . .` (`:18`) and
  `pnpm --filter hub build` (`:28`); `runner` copies standalone, static and public (`:36-38`) and runs
  `apps/hub/server.js`; all three on `node:22-slim` (DW-251). Moves to `apps/hub/Dockerfile`.
- `docker-compose.yml:23-58`: `anchor-app`, `build: context: .`, `dockerfile: docker/Dockerfile`
  (`:26`), both build args behind `:?` guards (`:33-34`), a healthcheck fetching
  `http://$HOSTNAME:3000/api/health` inside node (`:43-58`). No service declares `container_name`
  or `ports`, and no suite reads the file.
- `.github/workflows/`: four workflows, each `permissions: contents: read` at the top, `deploy.yml`'s
  job alone widened (`issues: write`). `registry-verification.yml` is the precedent for a workflow of
  its own beside `ci.yml`, whose seven-job set two suites pin.
- `ops/__tests__/workflow-hardening.test.ts`: over every file in the directory, the top-level token
  (`:105-107`), the one widened job (`:109-112`), third-party actions pinned (`:114-116`), Node 24
  or DW-251's two exceptions (`:57-61`, `:129-143`), pnpm scripts resolved (`:149-151`).
- `docker/__tests__/deps-stage.test.ts`: the manifest-mirror obligation (each workspace manifest
  copied into `deps` before the install, pinned list `apps/hub`, `packages/tokens`), obsolete once
  `deps` installs the pruned `json/`. `runner-stage.test.ts`: the builder's build line and the
  runner's copy of `/app/apps/hub/public`; path pinned at `:33`.
- `ops/__tests__/turborepo.test.ts:92-121` already prunes every workspace and checks `json/`'s
  lockfile, workspace file and manifests; reused, unchanged.
- `turbo prune hub --docker`, turbo 2.10.13, observed: `json/` holds the root manifest, the pruned
  lockfile, the workspace file (`onlyBuiltDependencies` kept) and `apps/hub/package.json`; `full/`
  holds `apps/hub/`, the root manifest, the workspace file, `turbo.json` and `.gitattributes`;
  neither holds `contracts/` or `packages/`. Pruned lockfile: importers `.` and `apps/hub`, 645
  package entries against 707, no `style-dictionary`.
- The Hub's build reads outside its workspace: its `build` script runs
  `../../packages/contracts-serve/publish.mjs`; `apps/hub/app/scss/_index.scss` loads
  `contracts/tokens.css` and `fonts.css`; `apps/hub/lib/registry.ts` imports
  `contracts/registry.json`; `apps/hub/next.config.js:2` reads `../../package.json`. Next infers its
  tracing root from the lockfile, so the builder needs `/app/pnpm-lock.yaml`.
- `apps/hub/app/layout.tsx:49-54`: the tracker renders only when both `NEXT_PUBLIC_UMAMI_*` were set
  at build time.
- Present-tense `docker/Dockerfile` claims: `README.md:42-60` (CRLF in the index), `AGENTS.md:146`
  ("GHCR images that do not exist yet"), `.dockerignore:1-5`, `.env.example:4`,
  `packages/contracts-serve/publish.mjs:25`, `tests/e2e/contract-serving.pw.ts:12`,
  `ops/contract-serving.md:108,418,836`, `ops/token-contract.md:525-549,582-583`. Dated observations
  naming it stay as written (`ops/contract-serving.md:69`, `ops/tailwind-adapter.md`,
  `ops/font-contract.md`, `ops/routing-inventory.md`, `ops/known-violations.md`).
- `deferred-work.md`: DW-251 (the Dockerfile half), DW-254 and DW-257 are this story's; DW-253 and
  DW-259 name it as a trigger. Next free id DW-260.

## Tasks & Acceptance

**Execution:**

- [x] `apps/hub/Dockerfile`: `git mv` from `docker/Dockerfile`, then a `prune` stage (`COPY . .`,
  `npx --yes turbo@2.10.13 prune hub --docker`); `deps` copies `/app/out/json/` from it and installs
  frozen; `builder` copies `/app` from `deps` and `out/full/`, `contracts/` and
  `packages/contracts-serve/` from `prune`, keeping the build args and the build line; `runner` as it
  was; every stage `node:24-slim`; a source label linking the package to the repository.
- [x] `docker-compose.yml`: `dockerfile: apps/hub/Dockerfile`; the healthcheck comment names the
  rollout requirement and the suite holding it.
- [x] `.github/workflows/image.yml`: new. `push` on `'**'`, job `hub` (`contents: read`,
  `packages: write`), build from the root with both Umami inputs, start the image and wait for
  `/api/health`, log in with `github.token` on stdin, push `ghcr.io/luigiespinosa/hub:${{ github.sha }}`.
- [x] `.dockerignore`: the comment's path; `.pnpm-store` and `**/.turbo` (DW-254).
- [x] `docker/__tests__/deps-stage.test.ts`: rewrite. The prune stage runs `turbo prune hub
  --docker` at the root manifest's turbo version, and `deps` copies the prune stage's `json/` alone
  and before the install, with planted negatives. `runner-stage.test.ts`: the new path.
- [x] `docker/__tests__/compose.test.ts`: new. No service declares `container_name` or `ports`;
  the service built from `apps/hub/Dockerfile` has a healthcheck requesting `/api/health`, not
  disabled; planted negatives.
- [x] `docker/__tests__/image-workflow.test.ts`: new. The trigger, the one sha tag on every build
  and push, both Umami inputs non-empty; planted negatives.
- [x] `ops/__tests__/workflow-hardening.test.ts`: the image job's `packages: write` beside the
  deploy's `issues: write`; `image.yml` among the workflows read; every `FROM node:` in
  `apps/hub/Dockerfile` on the stack's Node (DW-251).
- [x] Records: `ops/token-contract.md` (actions 4 and 5 observed, the deps-stage paragraphs
  amended), `ops/contract-serving.md`, `README.md`, `AGENTS.md`, `.env.example`, the two comments;
  `deferred-work.md` (close DW-254, DW-257 and DW-251's Dockerfile half, note DW-253 and DW-259, file
  DW-260). *`.env.example` is not edited: this session's permissions refuse any command naming an
  `.env` file, so its one stale path is filed as DW-261.*

**Acceptance Criteria:**

- Given AD-3, when the workflow publishes, then it pushes `ghcr.io/luigiespinosa/hub:<commit sha>`
  and no other tag, and a floating or second tag fails `image-workflow.test.ts`.
- Given AD-8, when the image is built, then its context is the repository root pruned by
  `turbo prune hub --docker` with the Dockerfile at `apps/hub/Dockerfile`, an app-directory context
  is shown failing, and listings of the image and of the builder's tree show no part of the monorepo
  the Hub does not build from, save the two root files the prune itself writes into `out/full/`,
  `.gitattributes` and `turbo.json`, which reach the builder's tree and not the image.
- Given AD-7, when the workflow runs, then it names one id, the install reaches the root and `hub`
  importers alone, and the build compiles the `hub` workspace alone.
- Given `docker-rollout`, when the compose file is read, then the Hub's service has a healthcheck on
  `/api/health`, no service declares `container_name` or `ports`, `compose.test.ts` holds all three,
  and the healthcheck is shown `unhealthy` for a container serving nothing and `healthy` for the
  real one.
- Given `ops/token-contract.md` actions 4 and 5, when the story closes, then the pruned `deps` stage
  is observed running for real and installing without the token generator's packages, and both are
  recorded as observed.
- Given KV-1, when this story's commits are pushed, then that push's Image run builds the image in
  CI, `/api/health` answers, and the tag reaches GHCR with nothing compiled on the box. This run does
  not push, so that observation follows the push.

## Implementation Notes

Implemented inline (a workflow sub-agent has no Agent tool), from this spec.

- `apps/hub/Dockerfile`: `git mv` from `docker/Dockerfile`, then rewritten as the prototype shape plus
  comments and the source label. The rewrite is large enough that git reads it as a delete and an add
  rather than a rename, so the commits split the move from the rewrite to keep `git log --follow`.
- `.github/workflows/image.yml`: the runner's own `docker` builds, answers `/api/health` on a published
  port, logs in with the job token on stdin and pushes the one tag; no action beyond
  `actions/checkout`. The two Umami values sit in the job's `env:` beside `IMAGE`, so every step sees
  the same ones.
- Tests: `deps-stage.test.ts` rewritten around the pruned install (3 cases, the old 9 retired with the
  obligation they held); `compose.test.ts` (3) and `image-workflow.test.ts` (5) new;
  `workflow-hardening.test.ts` gained the image job's widening, `image.yml` in its list, and the
  Dockerfile's Node case with its planted reader case. The first two were written with block readers
  and shrunk by the review (rows 20 and 21). Every check is shown refusing planted text on each run,
  and planted edits of the real files were seen failing (Verification).
- Records: `ops/token-contract.md` (actions 4 and 5 observed; three dated amendments),
  `ops/contract-serving.md` (four present-tense Dockerfile claims), `README.md` (CRLF kept),
  `AGENTS.md` (the deploy pitfall), the two comments; `deferred-work.md` as the task says.
- **Surprises.** (1) The Bash tool's heredocs mangled backslashes, so edits carrying one went through
  the Edit tool. (2) The session may not touch `.env*` files at all (DW-261). (3) The orchestrator's
  `corepack pnpm build` is the command Story 3-2 retired: at the root it exits 1, "Command "build" not
  found", so the Hub builds by `corepack pnpm --filter hub build`, as `AGENTS.md` says.

## Spec Change Log

**2026-09-28, fix round 1, after the independent verification.** The verifier returned one blocking
finding and two minor ones, all taken. No image, workflow, compose or product file changed.

1. **Blocking.** `ops/token-contract.md`'s 2026-09-28 amendment said `deps-stage.test.ts`'s
   assertions, the prune's included, were each observed rejecting a planted edit on every run, and
   Implementation Notes said every check is shown refusing planted text on each run. The prune check
   had no planted case: its one observed rejection was the manual `turbo@2.9.0` plant in
   Verification, and the copy's destination was never planted on its own. The suite's third case now
   also plants the prune on `turbo@2.9.0` and on the workspace `web`, and the copy to `./json/`, on
   every run, so the record and the notes are true as written and neither changed (`5266f20`). It
   stays one case, so the count is unchanged.
2. `ops/routing-inventory.md` § Where the deploy goes gives a checkout of `docker-compose.yml`,
   `docker/Dockerfile` and `.dockerignore` from `origin/dev` as the way to recover the box, which
   stops at the pathspec once this story is pushed and was already unfit after Story 3-2's push.
   The Code Map counted that record's mentions as dated observations, and this one is a procedure.
   It carries a dated amendment, and its replacement is DW-263, Story 3.4's (`7ce2e3e`).
3. The board's 3-3 row said the push waits on the Operator, and in this run the orchestrator pushes.
   The row now says so, and that once that push's Image run is read the row records its run id, its
   conclusion and the tag `ghcr.io/luigiespinosa/hub:<sha>`, where criterion 6 and action 5's CI
   half are read (`ops/token-contract.md` action 5 points at the row for that).

The round lands after the story's commits, as Stories 3-1 and 3-2's rounds did: none of `6a600f6`,
`65ac0ac` or `b2fb599` was pushed (`origin/dev` read `0aec0fb`), so a push of `dev` carries them with
this round. Observed on this tree: the two new shapes planted in the real Dockerfile, `prune web` in
the prune stage and the copy to `./json/` in `deps`, each failing its case, then restored and
`cmp`-identical; the new planted lines, made no-ops in a throwaway copy of the suite, failing;
`corepack pnpm typecheck` exit 0; `corepack pnpm --filter hub build` exit 0 (11 files published,
Next.js 16.2.1, the same six routes), and the root's `corepack pnpm build` exit 1, "Command "build"
not found", as Story 3-2 designed; `corepack pnpm test --run` exit 0, "Test Files 66 passed (66)",
"Tests 1667 passed (1667)"; `node ops/contract-purity.mjs`, `node ops/registry-schema.mjs` and
`node ops/literal-conformance.mjs` exit 0.

## Review Triage Log

Pass 1, 2026-09-28, over an 87.5 kB diff (Blind Hunter floor 10). Every layer ran inline in this
session, which has no subagent tool, so none is independent. The Design Review found no surface and
skipped itself. No `intent_gap` or `bad_spec`, so no loopback; `review_loop_iteration` stays 0.

| # | Layer | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | Blind, Edge (claim) | The Dockerfile's label comment said the label is what lets the workflow push after the first push | low | GitHub's documentation: a push from a workflow with `GITHUB_TOKEN` links the package to its repository automatically, and the label is recommended "to ensure your `GITHUB_TOKEN` has appropriate permissions" | patch: the comment says what the documentation says |
| 2 | Ponytail | Delete the label, since a workflow push links the package itself | false | The same documentation recommends the label for exactly this case, a workflow's `GITHUB_TOKEN`; it is one line | reject |
| 3 | Blind | `actions/checkout` persists the job's `packages: write` token in `.git/config` | low | No later step runs code that can read the runner's checkout: `.dockerignore` keeps `.git` out of the build context, the health step's container mounts nothing, and every step is this repository's shell; the fix adds a parameter | reject |
| 4 | Blind | Every push adds a GHCR version and nothing prunes them, so a private package could meet the plan's storage limit | low | GitHub's billing documentation: "Container image storage and bandwidth for the Container registry is currently free", with a month's notice before that changes, and public packages are free; a retention step is more than a direct correction | reject |
| 5 | Blind | A commit whose unit tests fail still gets an image | false | Story 3.4 deploys the sha `main` points at, and `main` requires the eight checks, so a red commit's image is never the one deployed | reject |
| 6 | Blind, Ponytail | The health step's hand-rolled retry loop, with an unused counter, where curl retries natively | low | Real, a direct simplification. The first form, `--retry-connrefused`, was exercised before commit and failed: Docker's port proxy accepts the connection and drops it while the server starts (curl 52 and 56), which only `--retry-all-errors` retries | patch: `--retry 30 --retry-delay 1 --retry-all-errors`, observed passing on a live container in 2 s and failing on a broken one in 32 s |
| 7 | Blind | The compose comment called CI's image "the same image" the box builds, though each build reads its own inputs | low | The box's build reads `.env.production`, CI's the workflow | patch: "CI builds this Dockerfile" |
| 8 | Blind | The website id lives in the workflow and in the box's `.env.production` until Story 3.4 | low | Decision 2 records it; Story 3.4 retires the box build that reads the second copy, and the two are equal today (observed) | reject |
| 9 | Blind | The deps check refuses equivalent forms of the copy, a split lockfile copy or a missing trailing slash | low | It fails closed and names the line, which is the check's stated design | reject |
| 10 | Blind, Edge | A flow-style service or a YAML merge key would slip past the compose checks | low | The file is block style throughout; guarding those shapes adds branches | reject |
| 11 | Blind, Edge | `docker image push` would slip past the push check | low | Real; the same function already reads `docker (image )?tag` | patch: one alternation, with a planted case |
| 12 | Blind, Edge | `FROM --platform=... node:<tag>` would slip past the Node check | low | Real; a direct correction of one regular expression | patch: flags allowed before the image, with a planted case |
| 13 | Blind | The runner stage runs as root | low | Pre-existing, the base commit's runner did too; the fix is a user plus a writable cache directory | reject |
| 14 | Blind | `ops/token-contract.md` action 5 said the stage ran "from the workflow's own command" | low | The local run added `--no-cache` and a local tag | patch: the note says so |
| 15 | Blind | The workflow has no `workflow_dispatch` to rebuild a sha | false | A failed run is re-run from the Actions page, which rebuilds the same sha | reject |
| 16 | Blind | `.dockerignore`'s root-only `Dockerfile` line matches nothing | low | Pre-existing and harmless: the root never held a Dockerfile | reject |
| 17 | Edge (claim) | The builder's tree holds `.gitattributes` and `turbo.json`, against the claim that it holds nothing the Hub does not build from | low | Both are turbo's own prune output, two small root files; the fix would edit the spec | reject |
| 18 | Verification gap | The compose test found the Hub's service by its Dockerfile but never held `context: .`, so `context: apps/hub` passed every suite and failed first on the box | medium (pre-verified) | As filed; the app-directory failure is observed in Verification | patch: `compose.test.ts` holds `context: .`, with a planted case |
| 19 | Verification gap | The healthcheck's failing half is held by a one-time demonstration, not a gate | medium (pre-verified) | As filed: a probe rewritten to exit 0 passes `compose.test.ts`, and Story 3.4's rollout is the first thing that depends on it | defer, DW-262 |
| 20 | Ponytail | `deps-stage.test.ts`'s COPY parser, fault builder and derived paths | low | The stage compared line for line with the three lines it must run is stricter and about 60 lines shorter | patch: 3 cases |
| 21 | Ponytail | `compose.test.ts`'s four block readers | low | One cut at an indentation and two matches read the same file | patch: 3 cases |
| 22 | ECC | The layer's literal build, `corepack pnpm build`, fails at the root | medium | Observed exit 1, "Command "build" not found", the claim DW-259 records; the phase ran `corepack pnpm --filter hub build` per `AGENTS.md` | defer, DW-259 already filed, its trigger noted |
| 23 | ECC | None else: build exit 0, types 0 errors, 1673 of 1673 before the patches, no secret pattern or `console.log` added, lint N/A | none | Observed on the tree reviewed | none |
| 24 | Design Review | No `.scss` or `.tsx` outside tests and no motion token in the diff | none | The layer's own first check | none |

## Design Notes

**Oversized, kept.** At the plan checkpoint the spec measured about 4,066 tokens (16,266
characters over four; 2,272 words) against the SCOPE STANDARD's 1600. Answer **Keep**, relayed by
the orchestrating workflow on 2026-09-28 as the Operator's instruction of that day to finish Epic 3
unattended with the stories as written, the answer the unattended Epic 2 run used on 2026-09-23.
The multi-goal check found one goal: the compose requirements and actions 4 and 5 are the image's
own preconditions and observations.

**Open Questions, answered from the sources.** Two gaps an Operator would notice: the service's name
(AD-3 against the `anchor-*` rule) and where the Umami inputs live. Two more were design choices,
recorded beside them as Decisions 3 and 4. Each is answered from `epics.md` Story 3.3 and its
amendment, AD-3, AD-7, AD-8, `ops/token-contract.md`, `ops/routing-inventory.md` and DW-251 to
DW-259, per the orchestrator's standing instruction; none is irreversible.

**Why the prune runs inside the Dockerfile.** Pruning on the runner and handing Docker `out/` as the
context would need the same step on the box, whose `docker compose up --build` keeps building until
Story 3.4; a first stage that prunes the root context builds the same way in CI, on the box and on
this host. turbo 2.10.13 writes the pruned lockfile and workspace file inside `json/` (observed), so
one `COPY` feeds the install. The version is pinned in the Dockerfile and held to the root
manifest's by `deps-stage.test.ts`, because a lookup inside the Dockerfile fails in an app-directory
context before turbo can say why.

**The prototype (scratch, 2026-09-28).** Built from the root with this shape: `turbo prune` 4.4 s,
`deps` "Scope: all 2 workspace projects", "Packages: +526", "Done in 21.5s using pnpm v10.31.0";
the builder published 11 files and built the same six routes; the container answered every route as
Story 3-2's image did, `/api/health` at 3.0.0. The base commit's `deps` stage, built the same day:
"Scope: all 3 workspace projects", "Packages: +588", `style-dictionary` in the store. In the app
directory the prototype failed "x Could not resolve workspace. Missing `devEngines.packageManager`
or legacy `packageManager` field in package.json".

**For Story 3.4.** The image for a commit is pushed by that commit's Image run, which runs beside
the Deploy run with no ordering between them, so a pull-based deploy has to wait for the tag. While
the package is private the box needs a read token to pull; public, it needs none (Operator items).
Turbo and Next telemetry run at their defaults in the image build, as in every build before it
(DW-253 is still the Operator's).

## Verification

All observed on 2026-09-28 on this host (Windows 11, Node v24.15.0, pnpm 10.31.0, Docker 29.8.1) over
`0aec0fb` plus the working tree, unless a line says otherwise. The base commit's unit count, 1659 in 64
files, is Story 3-2's recorded figure; CI run 36492681112 on `0aec0fb` read success.

**Commands:**

- `corepack pnpm typecheck` exit 0. `corepack pnpm --filter hub build` exit 0: "packages/contracts-serve:
  published 11 files at /contracts/", "Next.js 16.2.1 (Turbopack)", routes `/`, `/_not-found`,
  `/api/health`, `/celeste`, `/cv`, `/work`. The root's `corepack pnpm build`, the command this run was
  handed, exit 1, "ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "build" not found", retired by Story 3-2.
- `corepack pnpm test --run` exit 0: "Test Files 66 passed (66)", "Tests 1673 passed (1673)" before the
  review's patches, and "Test Files 66 passed (66)", "Tests 1667 passed (1667)" on the final tree (the
  two shrunk suites dropped six planted-case tests).
- The five node-only `ci.yml` gates as their jobs run them: `tokens:build` and `fonts:build` with their
  inputs empty, exit 0 and `git status --porcelain --ignored=matching -- contracts/` empty after each;
  `node ops/contract-purity.mjs` "11 files, none executable and no link (AD-1)."; `node
  ops/registry-schema.mjs` "16 applications, valid"; `node ops/literal-conformance.mjs` "read 25
  stylesheets ... no colour, spacing or type literal outside it". All exit 0.
- The image as CI builds it: `docker build --no-cache -f apps/hub/Dockerfile` with both Umami build
  args from the root, exit 0 in 61 s. Prune: "turbo 2.10.13", "Generating pruned monorepo for hub in
  /app/out", " - Added hub" (3.9 s with the `npx` fetch). Deps: "Scope: all 2 workspace projects",
  "Packages: +526", "Done in 21.1s using pnpm v10.31.0". Builder: "published 11 files at /contracts/",
  "Next.js 16.2.1 (Turbopack)", the same six routes.
- The container answered `/`, `/cv`, `/work`, `/celeste`, `/api/health`, `/pdf/cv.pdf`,
  `/pdf/recommendation-letter.pdf`, `/assets/og/og-image.png` and `/favicon.ico` 200, `/projects` 301 to
  `/#suite`, `/recommendation` and `/nope` 404 and `/contracts/` 308 to `/contracts`, Story 3-2's
  fourteen probe lines, with `/api/health` `{"status":"ok","version":"3.0.0","uptime":1}`; all 11 files
  under `/contracts/` were byte-identical to `contracts/` (`cmp`), and the page carried the website id.
- Not the whole monorepo. The image's `/app` holds `apps` and `node_modules` alone: `apps/hub` is
  `.next`, `package.json`, `public` and `server.js`, `node_modules` is `.pnpm`, `next`, `react`,
  `react-dom` and `sharp`, 40 MB in all, with `ops`, `tests`, `packages`, `contracts`, `docker`,
  `.github` and `_bmad-output` absent; its label names the repository and its command is
  `node apps/hub/server.js`. The builder's `/app` holds `.gitattributes`, `apps` (`hub` alone),
  `contracts`, `node_modules`, `package.json`, `packages` (`contracts-serve` alone), the lockfile, the
  workspace file and `turbo.json`, a store of 528 entries with no `style-dictionary`. The base
  commit's builder, from the same context, held everything the context carried: `.env.example`, `.eslintrc.json`,
  `.github`, `.lighthouserc.js`, `.markdownlint.json`, `.prettierrc.js`, `README.md`, `docker`,
  `packages` with `fonts` and `tokens`, `playwright.config.ts`, `tests`, `tsconfig.json`,
  `vitest.config.ts`, `vitest.setup.ts` and this host's ignored `capacity-week`, `graphify-out`,
  `playwright-report`, `test-results` and `tsconfig.tsbuildinfo`. Of the builder's files,
  `.gitattributes` and `turbo.json` are the two the Hub does not build from, and both are the prune's
  own output (criterion 2). In fix round 2, over `d69fd33`: a `--target prune` build from the root
  held them in `out/full/` beside `apps` (`hub` alone), `package.json` and `pnpm-workspace.yaml`,
  `.gitattributes` byte-identical to the root's; the image, built with the workflow's two inputs, held
  neither anywhere under `/app`, whose `ls -A` read `apps` and `node_modules` alone.
- Actions 4 and 5: the base commit's `deps` stage (`docker/Dockerfile` at `0aec0fb`), `docker build
  --no-cache --target deps` from the root, exit 0: "Scope: all 3 workspace projects", "Packages: +588",
  "Done in 22.1s using pnpm v10.31.0", a store of 590 entries with `style-dictionary` in it. This tree's,
  above: +526 and none. 588 less 526 is the token generator's 62 packages `ops/token-contract.md`
  measured on 2026-08-24.
- The app-directory context: `docker build --no-cache -f apps/hub/Dockerfile apps/hub` exit 1 at the
  prune stage, "x Could not resolve workspace. `-> Missing `devEngines.packageManager` or legacy
  `packageManager` field in package.json". The base commit's `deps` stage in the same context, exit 1,
  "/pnpm-workspace.yaml": not found (and the two workspace manifests). A plain install there, exit 1,
  "ERR_PNPM_NO_LOCKFILE ... Headless installation requires a pnpm-lock.yaml file", on pnpm 12.6.0
  because nothing pins it; without `--frozen-lockfile` "Already up to date" with nothing installed, and
  `../../packages` and `../../contracts` absent.
- The healthcheck, run from `docker-compose.yml` (project `hub33demo`, the external network created
  locally and removed afterwards, the image overridden to this build and nothing rebuilt), `docker compose
  config` showing the unchanged `fetch(...:3000/api/health)` test. With `command` overridden to a node
  process that serves nothing: "running starting", then at +107 s "running unhealthy", every probe exit
  1, "Up About a minute (unhealthy)". As built: "running starting", at +8 s "running healthy", probe
  exit 0, "Up 9 seconds (healthy)".
- The workflow's health step, run with curl 8.14.1 against the image: on a live container exit 0 after
  2 s, one "(52) Empty reply from server" retried; on a container serving nothing exit 1 after 32 s,
  its logs printed. The first form, `--retry-connrefused`, gave up on the first "(56) Recv failure:
  Connection was reset" (review row 6).
- Planted breaches, each restored and `cmp`-identical afterwards. On the suites as first written: a
  context `COPY pnpm-lock.yaml ./` in `deps`, a stage on `node:22-slim`, `IMAGE` at `latest`, the
  website id emptied and `ports:` on the Hub, each failing its suite. On the final suites: the context
  `COPY`, the prune at `turbo@2.9.0`, `ports:` on the Hub, `context: apps/hub` and `IMAGE` at `latest`,
  each failing its suite.
- The website id cuatro.dev serves, read on 2026-09-28, equals the one `spec-1-21` recorded on
  2026-08-17, and `https://analytics.cuatro.dev/script.js` answered 200.
- Rendered output on the final tree, the `AGENTS.md` container command in
  `mcr.microsoft.com/playwright:v1.62.1-noble`: "Already up to date", "[WebServer] > hub@ build
  /w/apps/hub", then "hub@ start", "Running 343 tests using 1 worker", "343 passed (6.9m)", exit 0; the
  `/work` baseline's sha256 `93a1aa4e9c8374207ae689707b1e843285ba927fb762ed2f09d105050b9a59d8` and its
  2026-09-23 mtime unchanged, and nothing written. Lighthouse was not run: no Hub source changed, and
  `lighthouse.yml` builds the Hub without Docker.

**Not observed in this run, and why:** the Image workflow's first run. It needs a push, which this
run does not make; that run's log is where criterion 6 and action 5's CI half are read, and it is
recorded on the board when read.
