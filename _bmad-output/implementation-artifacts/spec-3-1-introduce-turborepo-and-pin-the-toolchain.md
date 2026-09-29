---
title: 'Story 3.1: Introduce Turborepo and pin the toolchain'
type: 'chore'
created: '2026-09-28'
status: 'done'
route: 'dispatch'
baseline_commit: '716ba421f900a11faf9e488b8dee2b8e8cd58f30'
review_loop_iteration: 0
warnings: ['oversized']
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Epic 3 moves the Hub to `apps/hub` and builds every Anchor image from the repository
root narrowed by `turbo prune --docker` (AD-8), but the Anchor has no Turborepo, its workspace
covers `packages/*` only, and `ci.yml` and `lighthouse.yml` run Node 22, which has been
maintenance-only since 2025-10-21 while the stack targets Node 24 LTS. Doing that inside the Hub's
move would make the move a move plus a build-system introduction, which AD-20 forbids.

**Approach:** Add `turbo` 2.10.13 as a root devDependency and a `turbo.json` defining `build`,
`test`, `typecheck` and `lint`, uncached, with the root Hub's three scripts registered as root
tasks; widen `pnpm-workspace.yaml` to `apps/*` and `packages/*`. Prove that turbo runs give the
direct runs' results and that `turbo prune --docker` works on this workspace, recording exactly
what a root-level application cannot do. Pin Node 24 in both workflows once every gate has passed
on Node 24 locally.

## Boundaries & Constraints

**Always:**

- `turbo` is pinned exactly, `"turbo": "2.10.13"`: the newest 2.10.x on 2026-09-28. 2.11.x exists
  and is not the stack version.
- Root-level `corepack pnpm build`, `corepack pnpm typecheck` and `corepack pnpm test --run` keep
  working unchanged, and the turbo runs of the same tasks give identical results.
- Every task in `turbo.json` is a `package.json` script. Nothing orchestrates Elixir, Go, Python or
  Solidity (AD-2), and no Cargo or other future flag is set.
- The seven `ci.yml` job names stay exactly as they are; every gate stays blocking (AD-21).
- An `ops/` row that states Node 22 for a job this story moves is amended in the same commit, and
  every record says committed, never live: this becomes live at the Epic 3 merge.

**Never:**

- No lint script, no `eslint` invocation, no lint step in CI (AGENTS.md). The `lint` task
  definition is the whole of the lint criterion, and `linkg` stays as it is.
- No task caching, no `outputs`, no remote cache, no `.turbo/` in the tree.
- No edit to `docker/Dockerfile`, `.github/workflows/deploy.yml`,
  `.github/workflows/registry-verification.yml`, `tsconfig.json`, `vitest.config.ts`,
  `.lighthouserc.js` or `docker-compose.yml`. No `apps/` directory, no move, no new `ci.yml` job.

**Decisions** (unattended run: the orchestrator relayed the Operator's instruction of 2026-09-28 to
finish Epic 3 with the stories as written; each is reversible, keeps every gate green, and is an
Operator item):

1. **Node 24 goes into `ci.yml` and `lighthouse.yml` only**, the two workflows the criterion names.
   `deploy.yml` (2026-08-17) and `registry-verification.yml` (2026-09-12) copied Node 22 after the
   story was written, and `docker/Dockerfile` has run `node:22-slim` since 2026-03-07. All three sit
   on surfaces Stories 3.2 to 3.4 own or no story owns, so they are filed as DW-251, and a standing
   case holds every other `node-version` at 24 with those two as named exceptions.
2. **CI's `test` job keeps invoking `pnpm typecheck` and `pnpm test --run`, not turbo.** turbo exits
   0 with "No tasks were executed" when a task resolves to no script, so a gate routed through it
   passes having run nothing whenever `turbo.json` and the scripts drift apart, which AD-21 forbids.
   Invoked directly, `pnpm typecheck` fails when its script is missing and `pnpm test --run` runs
   the Hub's Vitest. `pnpm test` at a workspace root with no `test` script also exits 0, which is
   Story 3.2's hazard once the root gives the Hub's scripts up; it inherits the choice (DW-252).
3. **AD-2 is expressed by the workspace, not by `turbo boundaries`.** `pnpm-workspace.yaml` lists
   `apps/*` and `packages/*`, so an app may take a `workspace:` dependency on a package; every
   workspace manifest is `"private": true`, so nothing under `packages/` can reach a registry a
   Satellite installs from; `contracts/` stays the only published surface (AD-1). `turbo
   boundaries` is not listed by `turbo --help`, cannot see a Satellite at all, and reports two
   pre-existing issues on this tree (`packages/tokens`'s tests import the root's `vitest`).
4. **Telemetry is left at its default**, as Next.js's already is. Whether NFR-8 reaches build-tool
   telemetry is the Operator's reading (DW-253).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Typecheck through turbo | clean tree | `//#typecheck` runs `tsc --noEmit`, exit 0 | a planted type error exits non-zero |
| Tests through turbo | `pnpm turbo run test -- --run` | `//#test` runs `vitest --run`: the direct run's file and case counts, all passing | a planted failing test exits non-zero |
| Build through turbo | clean tree | `//#build` runs the publish step and `next build`; `.next/static` byte-identical to a direct build | a failing build exits non-zero |
| Lint through turbo | no workspace defines `lint` | "No tasks were executed", exit 0 | none: there is no lint gate by rule |
| Prune a workspace package | `turbo prune @cuatro/tokens --docker` | `json/`, `full/`, lockfile and workspace file; a frozen install of `json/` succeeds | none |
| Prune the root Hub | `turbo prune portfolio --docker` | fails, "Invalid scope" | recorded as the root-level limit |

</frozen-after-approval>

## Code Map

- `package.json`: the root manifest is the Hub (`name: portfolio`); its `build`, `test` and
  `typecheck` scripts are what the root tasks call. `linkg` stays misspelled.
- `pnpm-lock.yaml`: regenerated by `pnpm add`; turbo and its six optional platform binaries only.
- `pnpm-workspace.yaml`: `packages: ['packages/*']` and `onlyBuiltDependencies`, which stays.
- `packages/tokens/package.json`: the one workspace package: private, no scripts by design, so
  every turbo task skips it.
- `.github/workflows/ci.yml`: seven jobs, `node-version: 22` at `:24`, `:52`, `:112`, `:183`,
  `:221`, `:275`, `:324`; the comment at `:256-262` explains the `rendered-output` pin.
- `.github/workflows/lighthouse.yml:25`: `node-version: 22`.
- `ops/__tests__/contract-purity.test.ts:968`, `ops/__tests__/registry-schema.test.ts:1750`,
  `ops/__tests__/literal-conformance.test.ts:719`: pin their job's `node-version: 22`.
  `ops/__tests__/registry-verification.test.ts:903` pins that workflow's 22 and stays (DW-251).
- `docker/__tests__/deps-stage.test.ts:159`: pins the workspace globs to `['packages/*']`;
  `expandGlob` returns nothing for a directory that does not exist.
- `ops/__tests__/workflow-hardening.test.ts`: rules held over every file in
  `.github/workflows/`; the home for the Node-major rule.
- Records naming Node 22 for a moved job: `ops/contract-purity.md:53`, `ops/registry-schema.md:67`,
  `ops/literal-conformance.md:106`, `ops/token-contract.md:335`, and `ops/rendered-output-harness.md`
  (Pending Operator action 2's ruling; the dated-section pattern of "The actions moved off Node 20").
- `AGENTS.md`: the stack line in the orientation paragraph and § Running and verifying.
- `_bmad-output/implementation-artifacts/deferred-work.md`: DW-120 names "the build-tooling story"
  as its trigger; next free id DW-251.

## Tasks & Acceptance

**Execution:**

- [x] `package.json`, `pnpm-lock.yaml`: `corepack pnpm add -D -w turbo@2.10.13`: the exact pin.
- [x] `pnpm-workspace.yaml`: `packages:` becomes `'apps/*'` and `'packages/*'`: Story 3.2 may not
  edit this file, and its move needs `apps/*` in the workspace.
- [x] `turbo.json`: create: `$schema`, `envMode: loose`, generic `build`, `test`, `typecheck`,
  `lint`, and root `//#build`, `//#test`, `//#typecheck`, every one `cache: false`, with a
  `description` on `lint` and the root entries: see Design Notes.
- [x] `.github/workflows/ci.yml`, `.github/workflows/lighthouse.yml`: every `node-version: 22` to
  `24`; amend the `rendered-output` comment so it stays true.
- [x] `ops/__tests__/contract-purity.test.ts`, `registry-schema.test.ts`,
  `literal-conformance.test.ts`: Node pins and their messages to 24.
- [x] `docker/__tests__/deps-stage.test.ts`: globs pinned to `['apps/*', 'packages/*']`.
- [x] `ops/__tests__/turborepo.test.ts`: new. Spawns `node_modules/turbo/bin/turbo run build test
  typecheck lint --dry=json` (it needs no `pnpm` on PATH) and holds what it resolves: turbo 2.10.x,
  `build`, `test` and `typecheck` each resolving to a workspace's own script (today the three root
  tasks, after Story 3.2 `apps/hub`'s, with no edit), `lint` resolving to nothing, every task
  uncached in loose mode, every workspace manifest private; and it prunes every workspace with
  `--docker` into a temporary directory and refuses a root that prunes. CI does not route a gate
  through turbo (Decision 2), so this is what keeps `turbo.json` valid and resolving, and the prune
  AD-8 builds on working, on every run of the blocking `test` job.
- [x] `ops/__tests__/workflow-hardening.test.ts`: every `setup-node` step pins a `node-version`,
  24 everywhere but the two DW-251 names, with a planted-text control.
- [x] `.gitignore`: `/.turbo/` and `/.pnpm-store/`, local state this story's own runs created
  (Implementation Notes, surprises 2 and 3).
- [x] The five `ops/` records, `AGENTS.md`, and `deferred-work.md` (DW-120 re-read; DW-251 to
  DW-253): keep every claim true.

**Acceptance Criteria:**

- Given no `turbo` and no `turbo.json`, when Turborepo is introduced, then `devDependencies` carries
  `"turbo": "2.10.13"`, `turbo.json` defines `build`, `test`, `typecheck` and `lint`, and the turbo
  runs of typecheck, build and the unit suite match the direct runs: exit codes, test file and case
  counts, and a byte-identical `.next/static`.
- Given AD-2, when `turbo run build test typecheck lint --dry=json` resolves the pipelines, then the
  only runnable tasks are `//#build`, `//#test` and `//#typecheck` with the Hub's own scripts, the
  workspace globs are exactly `apps/*` and `packages/*`, and every workspace manifest is private.
- Given AD-8, when `turbo prune @cuatro/tokens --docker` runs against the current workspace, then it
  exits 0 with the lockfile, the workspace file and both manifests under `json/`, and a frozen
  install of `json/` links `packages/tokens`'s dependency; and `turbo prune portfolio --docker`
  fails with "Invalid scope", recorded with its consequence for Stories 3.2 and 3.3.
- Given Node 22 in both workflows, when they are updated, then every `ci.yml` job and
  `lighthouse.yml` pin `node-version: 24`, and before the commit every gate passes on Node 24
  locally: typecheck, the unit suite, the build, both contract rebuilds with no drift under
  `contracts/`, purity, the Registry schema, literal conformance, the rendered-output suite in the
  pinned image, and Lighthouse's three thresholds.
- Given AD-21, when CI runs, then the seven job names are unchanged and typecheck, the unit suite,
  the Registry schema gate and the purity gate still run and still fail on breach, each shown
  failing on a planted breach on Node 24.

## Implementation Notes

Implemented inline (a workflow sub-agent has no Agent tool), from this spec.

- `corepack pnpm add -D -w turbo@2.10.13` wrote `"turbo": "2.10.13"` and 64 lockfile lines: `turbo`
  and its six optional platform binaries, nothing else. The same command in a scratch clone first
  produced the identical diff.
- `turbo.json` as designed. CI keeps its steps; only the eight `node-version` lines and the
  `rendered-output` comment changed in the two workflows.
- Tests: the three Node pins to 24; the deps-stage globs; `workflow-hardening.test.ts` gains the Node
  rule over the whole directory with DW-251's two exceptions and a planted control; the new
  `ops/__tests__/turborepo.test.ts` holds the dry run in four cases and the prune in a fifth.
- Records: four `ops/` rows amended in place with a dated note, a dated section in
  `ops/rendered-output-harness.md`, the stack line and one bullet in `AGENTS.md`, DW-120 re-read, and
  DW-251 to DW-253 filed.
- Review pass 1 patched the two new test files only (rows 3, 4, 12 and 13 of the triage log) and
  filed DW-254 and DW-255; no loopback.
- **Surprises.** (1) turbo needs `pnpm` on PATH to run a task; a dry run and a prune do not, which is
  why the unit cases can run under `corepack`. (2) Every `turbo` invocation creates an empty `.turbo/cache/` at
  the root, so `/.turbo/` joined `.gitignore`. (3) The container e2e command's `pnpm install` wrote
  the two new packages into `.pnpm-store/` at the repository root, untracked and not ignored (the
  directory was a skeleton of empty folders until then); `/.pnpm-store/` joined `.gitignore` so an
  unattended `git add -A` in a later Epic 3 story cannot commit store binaries, and the ten files
  (44 MB) were deleted once every container run had finished. (4) An assumption
  made while planning was wrong: a root task's inputs do include other workspaces' files (the dry run
  listed 12 under `packages/tokens/` among `//#test`'s 449), so the uncached decision rests on the
  observed outputs behaviour alone, and Design Notes say so.

## Spec Change Log

**2026-09-28, fix round 1, after the independent verification.** The verifier passed the story with
one minor finding against the Always rule above. `ci.yml` and `lighthouse.yml` moved to Node 24 in
`e9f77a1`, but the four Runner rows (`ops/contract-purity.md:53`, `ops/registry-schema.md:67`,
`ops/literal-conformance.md:106`, `ops/token-contract.md:335`) were amended, and the dated section of
`ops/rendered-output-harness.md` added, in `5ec73f6`, the docs commit after it. Read back from both
trees: at `e9f77a1` all eight `node-version` pins in the two workflows are 24 while the four rows say
Node 22 and the dated section is absent; at `5ec73f6` every one of them agrees. **The split stays in
the history and is logged here; the rule is not amended.** The verifier's first repair, folding the
five amendments into `e9f77a1` while neither commit was pushed, needs a commit amend, and this
unattended run's permission check refused it as a destructive git action. What holds instead: both
commits are unpushed (`origin/dev` read `716ba42` on 2026-09-28), and a push of `dev` carries them
together with this entry, so no pushed head of `dev` pairs Node 24 jobs with Node 22 rows; nothing
deploys from `dev`; and the verifier read `e9f77a1` green on its own (typecheck exit 0, 64 files and
1,653 tests). KEEP: the five amendments as committed; a re-derivation puts them in the pin's commit.
Re-run on this tree: `corepack pnpm typecheck` exit 0; `corepack pnpm build` exit 0 (Next.js 16.2.1,
the same six routes); `corepack pnpm test --run` exit 0, 64 files and 1,653 tests, all passed.

## Review Triage Log

Pass 1, 2026-09-28, over a 73.1 kB diff (Blind Hunter floor 9). Every layer ran inline in this
session, which had no subagent tool, so none is independent. Design Review skipped: the diff touches
no `.scss` or `.tsx` outside tests and names no motion token or API.

| # | Layer | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | Blind | CI never executes a turbo pipeline, so "through Turborepo" is proven on a host only | false | Decision 2 (frozen) keeps the gates direct because a turbo run that resolves no script exits 0; no CI gate depends on a turbo task, and the dry-run and prune cases run in the blocking `test` job | reject |
| 2 | Blind | `deploy.yml`, `registry-verification.yml` and `node:22-slim` stay on Node 22 | medium | Real: from the Epic 3 merge CI verifies on 24 and the box serves on 22; Decision 1 (frozen) leaves them to their owners | defer, already DW-251 (this story's), not refiled |
| 3 | Blind, Edge | The suite says it makes no network call, but only telemetry was off; turbo's update check was not | low | turbo 2.10.13 is behind 2.11.5, so a check has something to find; no run failed on it, but the claim was unguarded. One flag fixes it | patch: `--no-update-notifier` on every spawn |
| 4 | Blind, Edge | The root prune wrote into a fixed temporary path with no cleanup if turbo ever succeeded | low | Real if turbo's behaviour changes; the fix is a direct correction | patch: the root prune shares the per-workspace temporary directory and cleanup |
| 5 | Blind | `turbo run test` without `-- --run` may leave Vitest watching in an interactive terminal | maybe-false | Not observable here (no TTY); if real it is a developer's hang the `//#test` description and `AGENTS.md` already warn about | reject: would be low, and a guard would change the Hub's `test` script |
| 6 | Blind | Loose env and no cache are coupled, and `turbo.json` does not say why | false | `ops/__tests__/turborepo.test.ts` fails the moment either changes and its message says what a story must declare first; mutation-checked | reject |
| 7 | Blind | `.dockerignore` lets `.pnpm-store/` and `.turbo/` into a local build context | low | Real: the container run left 44 MB there; the served image and the box are unaffected. Pre-existing store placement, Docker surface Story 3.3 owns | defer, DW-254; the 44 MB this story's run left deleted |
| 8 | Blind | No local Node pin (`engines`, `.node-version`) | low | The only development host runs v24.15.0 and the fix adds a file the criterion does not ask for | reject |
| 9 | Blind | `nodeVersions` counts every `node-version:` line, not only setup-node's | low | Fails closed (a count mismatch fails the case), no workflow has another such input, and the fix adds step parsing | reject |
| 10 | Blind | The `lint` task is a no-op that exits 0 if CI ever invokes it | low | `AGENTS.md` forbids a lint step in CI and now states the exit-0 behaviour; a guard would add a CI step | reject |
| 11 | Blind | `AGENTS.md`'s `<dir>` is not placed outside the repository | low | Real: the six shims are unignored names. The fix edits an agent-context file | defer, DW-255 |
| 12 | Edge | A nameless workspace would reach `turbo prune` as `undefined` | low | Observed: turbo's dry run accepts a nameless workspace (exit 0 in a scratch workspace), and the case read the name from the manifest | patch: prune by the name turbo gives each workspace (`task.package`) |
| 13 | Edge | `node-version: 24 # comment` would not be read and would fail with a misleading message | low | The workflows already carry trailing comments on `uses:` lines; the fix is the regex | patch: tolerate a trailing comment, with a planted line in the control |
| 14 | Verification gap | Nothing executes the Dockerfile's `deps` stage with the new lockfile before the Epic 3 merge deploy | medium | Pre-verified gap; `docker/__tests__/deps-stage.test.ts` reads text. Closed for now by a local `docker build --target deps`: "Packages: +588", "+ turbo 2.10.13", exit 0 | defer: `ops/token-contract.md` action 5, folded into Story 3.3, already owns the standing check |
| 15 | Ponytail | `DryTask` interface for one JSON shape | false | Every case reads typed fields off it; `any` would drop the checks that make a renamed turbo field fail loudly | reject |
| 16 | Ponytail | The `AGENTS.md` bullet restates `turbo.json` | false | It states what `turbo.json` cannot: which scripts the root tasks run, that `lint` resolves to nothing, the PATH failure and why CI stays direct | reject |
| 17 | Ponytail | Repeated descriptions in `turbo.json` | false | Each description is read alone, per task, in turbo's own output; no named harm | reject |
| 18 | ECC | None: build, types, tests (1653 of 1653), secrets and `console.log` scans clean; lint N/A | none | Observed on the tree reviewed | none |

## Design Notes

**Oversized, kept.** At the plan checkpoint the spec measured about 3,460 tokens (13,858
characters over four; 1,984 words), against the SCOPE STANDARD's 1600. Answer **Keep**, relayed by
the orchestrating workflow on 2026-09-28 as the Operator's instruction of that day to finish Epic 3
unattended with the stories as written, the answer the unattended Epic 2 run used on 2026-09-23.
The multi-goal check found the turbo introduction and the Node pin separable; the same relay
answers **Keep all goals**, since the story as written carries both under one key.

**Root tasks and generic tasks, both.** turbo runs the root package's scripts only when they are
registered as `//#<task>`; generic tasks apply to workspace packages. Registering both lets
`turbo.json` survive Story 3.2 unchanged: observed in a scratch workspace, a registered root task
whose script is absent is skipped with exit 0, and the generic task then runs `apps/hub`'s script.
After the move the root entries are inert.

**Uncached, loose.** turbo caches by default and on a hit replays the logs and restores only the
declared `outputs`: in a scratch workspace a root task that writes a file reported success on its
second run and left no file. A cached `build` would do that to `.next/`, and a cached `test` would
replay a pass without re-reading what the suite reads beyond hashed files (git history, the
environment, generated output). Strict env mode, turbo's default, withheld an undeclared variable a
direct run passes (49 variables against 127 in a scratch run), so a strict run could differ from a
direct one. No cache and loose env are what "identical results" needs; a story that wants caching
declares outputs, inputs and env then.

**The prune answer, for Stories 3.2 and 3.3.** While the Hub is the root package it is not a
workspace turbo can name: `turbo ls` lists `@cuatro/tokens` alone, and pruning the Hub fails. Every
pruned tree carries the root manifest and so the root importer, the Hub's whole dependency set, so
no prune narrows anything today. Pruning the token package proves the mechanism (lockfile, workspace
file, manifests, a frozen install, the workspace link). A scratch simulation of Story 3.2's shape,
the Hub as workspace `hub` under `apps/hub` beside a root manifest carrying only `turbo`, pruned to
the root and `apps/hub` importers and installed frozen with 62 fewer packages than the tree pruned
today, `style-dictionary` gone: the figure `ops/token-contract.md` action 4 names. That is a
simulation, not this repository; Story 3.3 observes it for real.

**The box's image.** Until Story 3.3 replaces how the image is built, the box's `deps` stage installs
`turbo` and its Linux binary with every other devDependency. The runner stage copies
`.next/standalone`, whose `node_modules` held `next`, `react`, `react-dom` and `sharp` only in this
host's build, so the served image does not carry turbo.

**turbo needs `pnpm` on PATH.** It spawns the package manager itself, and on this host pnpm is not
on PATH, so `corepack pnpm turbo run build` fails with "Unable to find package manager binary".
`corepack enable --install-directory <dir> pnpm`, with `<dir>` prepended to PATH, fixes it without
touching the host. CI's `pnpm/action-setup` already puts pnpm on PATH. `AGENTS.md` gains the line.

## Verification

All observed on 2026-09-28 on this host, Node v24.15.0, pnpm 10.31.0, over `716ba42` plus the
working tree, unless a line says otherwise.

**Commands:**

- Baseline before any edit, at `716ba42`: `corepack pnpm typecheck` exit 0; `corepack pnpm build`
  exit 0 (Next.js 16.2.1, Turbopack; routes `/`, `/_not-found`, `/api/health`, `/celeste`, `/cv`,
  `/work`); `corepack pnpm test --run` exit 0, "Test Files 63 passed (63)", "Tests 1642 passed
  (1642)". A second direct build wrote a `.next/static` byte-identical to the first (35 files by
  sha256, `BUILD_ID` apart), so a byte comparison between builds means something.
- After the change, direct: `corepack pnpm install --frozen-lockfile` exit 0; `corepack pnpm
  typecheck` exit 0; `corepack pnpm build` exit 0, `.next/static` byte-identical to the baseline
  build; `corepack pnpm test --run` exit 0, "Test Files 64 passed (64)", "Tests 1652 passed
  (1652)", the same tree the turbo runs below read. After the prune case joined, and again after
  the review patches (the final tree, 17:36 to 17:38Z): install, typecheck and build exit 0,
  `.next/static` still byte-identical to the baseline, "Test Files 64 passed (64)", "Tests 1653
  passed (1653)", the eleven new cases this story's; the five no-browser gates re-run green.
- Through turbo, with corepack's shims first on PATH: `pnpm turbo run typecheck` exit 0
  (`//:typecheck: > tsc --noEmit`, "Tasks: 1 successful, 1 total"); `pnpm turbo run build` exit 0,
  `.next/static` byte-identical to the direct build (35 files); `pnpm turbo run test -- --run`
  exit 0, `//:test:` "Test Files 64 passed (64)", "Tests 1652 passed (1652)"; `pnpm turbo run
  lint` exit 0, "WARNING No tasks were executed as part of this run."
- `pnpm turbo run build test typecheck lint --dry=json`: `turboVersion` 2.10.13, packages `//` and
  `@cuatro/tokens`; runnable `//#build` (`node packages/contracts-serve/publish.mjs && next
  build`), `//#test` (`vitest`), `//#typecheck` (`tsc --noEmit`); all four `@cuatro/tokens#`
  tasks `<NONEXISTENT>`; every task `cache: false` and `envMode: loose`.
- Prune: `pnpm turbo ls` lists "1 package (pnpm9)", `@cuatro/tokens packages/tokens`.
  `pnpm turbo prune @cuatro/tokens --docker --out-dir <scratch>` exit 0: `json/package.json`,
  `json/packages/tokens/package.json`, `json/pnpm-lock.yaml`, `json/pnpm-workspace.yaml`, `full/`
  (root files and `packages/tokens/**`), and the lockfile and workspace file at the top. The pruned
  lockfile's importers are `.` and `packages/tokens`, and `json/package.json` is the Hub's own
  manifest (`"name": "portfolio"`, `next`, `turbo`). `pnpm install --frozen-lockfile` in a copy of
  `json/` exit 0, 587 packages, `packages/tokens/node_modules/style-dictionary` linked.
  `pnpm turbo prune portfolio --docker` exit 1: "x Invalid scope. Package with name portfolio in
  `package.json` not found."
- The five no-browser gates as their jobs run them: `tokens:build` and `fonts:build` (each with its
  two build inputs set empty) exit 0 and `git status --porcelain --ignored=matching -- contracts/`
  empty after each; `node ops/contract-purity.mjs` "read contracts/, 11 files, none executable and
  no link (AD-1)."; `node ops/registry-schema.mjs` "16 applications, valid"; `node
  ops/literal-conformance.mjs` "read 25 stylesheets ... no colour, spacing or type literal outside
  it". All exit 0.
- Planted breaches, each removed afterwards: a root `.ts` assigning a string to a `number`,
  `corepack pnpm typecheck` exit 2 and `pnpm turbo run typecheck` exit 1, both "error TS2322"; a
  failing case, `corepack pnpm test --run <file>` exit 1 and `pnpm turbo run test -- --run <file>`
  exit 1 ("Failed: //#test"); `contracts/zz-planted-breach.js`, `node ops/contract-purity.mjs`
  "contract purity: REFUSED" exit 1; a Registry `status` of `Planted`, `node
  ops/registry-schema.mjs` "registry schema: REFUSED" exit 1, `contracts/registry.json` restored
  byte for byte.
- Mutations of the new cases, each reverted: `//#test` removed ("test resolves to no script
  anywhere"), `//#build` cached, `envMode` strict, `packages/tokens` not private, `lint` undefined
  (the dry run itself exits 1) each fail `ops/__tests__/turborepo.test.ts`; `lighthouse.yml` back
  to 22 and `deploy.yml` moved to 24 each fail `ops/__tests__/workflow-hardening.test.ts`, the
  second with "deploy.yml left Node 22 (owner: Story 3.4, ...). Delete its STILL_ON_NODE_22 entry
  and close its half of DW-251".
- Rendered output, the container command from `AGENTS.md` in `mcr.microsoft.com/playwright:v1.62.1-noble`
  on the image's Node v24.18.1: `pnpm install --frozen-lockfile` added `turbo` and
  `@turbo/linux-64`, then "343 passed (7.7m)", exit 0, no snapshot written, the `/work` baseline
  still `93a1aa4e...`.
- Linux, the same image: `turbo 2.10.13` from `@turbo+linux-64@2.10.13`; `pnpm turbo run typecheck`
  exit 0; `pnpm turbo prune @cuatro/tokens --docker` exit 0 with the same 23-file tree as on this
  host; `turbo prune portfolio --docker` "x Invalid scope".
- The box's build path: `docker build -f docker/Dockerfile --target deps .` on `node:22-slim`, the
  `deps` stage's `pnpm install --frozen-lockfile` over the new lockfile and workspace file: "Packages:
  +588", "+ turbo 2.10.13", "Done in 21.3s", exit 0 (the image deleted afterwards). The review's
  verification-gap layer asked for it, because `docker/__tests__/deps-stage.test.ts` reads text only.
- Lighthouse, the same image on its Node v24.18.1, taken the way `lighthouse.yml` takes it (the build
  with both Umami variables empty, `pnpm start` on 3000) with `@lhci/cli` 0.15.1 `collect` then
  `assert` against `.lighthouserc.js`, nothing uploaded: Lighthouse 12.6.1 under Chrome 151, build
  `jtqN_oxzQMpOe3V52WqW3`; `lhci assert` exit 0; accessibility, best practices and SEO 1.00 on all
  nine runs of `/`, `/work` and `/cv` (performance, not gated: 0.66, 0.66, 0.66; 0.82, 0.78, 0.69;
  0.80, 0.88, 0.85). `.lighthouseci/` deleted after reading.
