---
title: 'Story 9-19: fix the tracker gsap teardown flake and remove its inert delivery files'
type: 'bugfix'
created: '2026-10-18'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '928e32e4a19c7f29573f596e5c76cac978f278d1'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-plan-2026-10-18.md'
  - '{project-root}/_bmad-output/implementation-artifacts/dw-triage-2026-10-18.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The Anchor's `test` job fails now and then in the tracker's unit tests on `ReferenceError: requestAnimationFrame is not defined`, thrown after the jsdom environment is torn down (DW-341; second occurrence `ci.yml` run 39026807811 at `9db6ae4`, unrecorded). `apps/tracker` still carries its old repository's delivery files, which nothing runs: `.github/workflows/ci.yml`, `docker/`, three compose files, a second ESLint configuration, a Playwright e2e suite, and a Prisma seed command that needs `tsx` on PATH (DW-276).

**Approach:** Stop gsap ScrollTrigger's sync interval in the tracker's Vitest teardown, behind a planted test. Delete the inert files and every line that names them, and make the seed command run without PATH, as the worker's compose command already does.

## Boundaries & Constraints

**Always:** the tracker's `typecheck` and `test` pass with Redis on 6379; every new assertion is planted and its failure recorded here; the deletions leave no script, config or README line naming a removed file.

**Never:** change `EraGroundTint.tsx` behaviour; touch `apps/tracker/Dockerfile`, the root `docker-compose.yml`, `image-tracker.yml` or the box; add a dependency; edit `deferred-work.md` or `sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| jsdom file that registered ScrollTrigger | interval running at teardown | interval cleared, no rAF call after | N/A |
| jsdom file that never loaded gsap | teardown | guard is a no-op, no throw | N/A |
| node-environment file | teardown | guard skipped (no `window`) | N/A |

</frozen-after-approval>

## Code Map

- `node_modules/.pnpm/gsap@3.14.2/node_modules/gsap/ScrollTrigger.js`: `register` calls `enable` when a window exists, which starts `setInterval(_sync, 250)`; `_sync` calls the bare global `requestAnimationFrame`, which jsdom's teardown removes; `ScrollTrigger.disable()` clears the interval. Run 39026807811's stack is `Timeout._sync ScrollTrigger.js:372:48`.
- `apps/tracker/components/molecules/EraGroundTint/EraGroundTint.tsx`: the only ScrollTrigger consumer; registered at module load, reached by `TimelineView.test.tsx` and `EraGroundTint.test.tsx`. Unchanged.
- `apps/tracker/tests/setup.ts`: the Vitest setup file; gets the teardown hook.
- `apps/tracker/package.json`: `infra`, `infra:down`, `stack`, `test:e2e`, `@playwright/test`, `prisma.seed`.
- `apps/tracker/vitest.config.ts`: `e2e/**` exclude; `apps/tracker/eslint.config.mjs`: Playwright override block.
- `apps/tracker/README.md`: deploy and development sections describe the compose stack.
- `apps/tracker/.dockerignore`, `.gitignore`: compose and Playwright lines.
- `docker-compose.yml:283` (root): the worker runs `node node_modules/tsx/dist/cli.mjs`; the seed follows it.

## Tasks & Acceptance

**Execution:**
- [x] `apps/tracker/tests/scroll-trigger-teardown.ts`: export `stopScrollTrigger()`: in a window, import `gsap/ScrollTrigger` and call `disable()`; one testable place for the guard
- [x] `apps/tracker/tests/setup.ts`: `afterAll(stopScrollTrigger)`; runs once per file before jsdom tears down
- [x] `apps/tracker/tests/__tests__/scroll-trigger-teardown.test.ts`: jsdom, fake timers: load ScrollTrigger, call the guard, advance 1s, assert `requestAnimationFrame` never called; planted by skipping the guard
- [x] delete `apps/tracker/.github/`, `docker/`, `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.override.example.yml`, `.eslintrc.json`, `e2e/`, `playwright.config.ts`
- [x] `apps/tracker/package.json`: drop the four scripts and `@playwright/test`; seed becomes `node node_modules/tsx/dist/cli.mjs prisma/seed.ts`; refresh `pnpm-lock.yaml`
- [x] `apps/tracker/vitest.config.ts`, `eslint.config.mjs`, `.dockerignore`, `.gitignore`, `README.md`: remove what names the deleted files; README points at `ops/tracker-cutover.md`

**Acceptance Criteria:**
- Given the tracker suite, when it runs, then `TimelineView.test.tsx` and `EraGroundTint.test.tsx` pass and no unhandled error is reported.
- Given `git ls-files apps/tracker`, when listed, then none of the deleted paths remain and a grep for them finds only `CHANGELOG.md` history.
- Given `corepack pnpm install --frozen-lockfile`, when run, then it succeeds on the refreshed lockfile.

## Implementation Notes

Route: dispatch. Implemented directly in this session: the workflow sub-agent has no subagent tool, so the step-03 handoff and the step-04 review layers ran inline (see Review Triage Log). Sprint-status sync was skipped: the orchestrator's push step owns `sprint-status.yaml`. The Operator's "Sure, do it." relayed by the harness stood as approval at the plan checkpoint; the spec measured about 1500 tokens, under the 1600 gate.

**Commits** on `epic9/9-19-tracker-flake-and-inert-files`:

- `0bc7afebc1d8a70196f9086e244c1e256a1803df` fix(tracker): stop scrolltrigger's sync interval before jsdom teardown. `tests/scroll-trigger-teardown.ts` (`stopScrollTrigger`), `afterAll(stopScrollTrigger)` in `tests/setup.ts`, and the planted test.
- `018deab1a79471a526e36134595473bfef520a11` chore(tracker): remove the inert delivery files the merge kept. Deleted `.github/workflows/ci.yml`, `docker/` (`Dockerfile`, `Dockerfile.caddy`, `Caddyfile`, `Caddyfile.dev`), the three compose files, `.eslintrc.json`, `e2e/` (12 specs, a fixture, global setup and teardown), `playwright.config.ts`, and `apps/tracker/.dockerignore` (see Design Notes); dropped `infra`, `infra:down`, `stack`, `test:e2e` and `@playwright/test`; refreshed `pnpm-lock.yaml` (12 insertions, 42 deletions: `@playwright/test@1.60.0` and its `playwright` and `playwright-core` go, and `next`'s optional peer now resolves to the root's `@playwright/test@1.62.1`); removed the Playwright block from `eslint.config.mjs`, the `e2e/**` exclude from `vitest.config.ts`, the compose and Playwright lines from `.gitignore`; rewrote the README banner, proxy row and development section; two test comments that named `pnpm infra` now name a Redis on `localhost:6379`.
- `6226fe7aa0044f28e7e5d2ea1a68dbd84ade298d` fix(tracker): run the prisma seed without tsx on path. `prisma.seed` is `node node_modules/tsx/dist/cli.mjs prisma/seed.ts`, the form the root `docker-compose.yml` already gives the worker.
- `b2c22eb096573f403902823c83856d023b184c0d` docs(tracker): say why the scrolltrigger guard skips the node environment. Found by the inline review: the window check is load-bearing, not a cost saving.
- `fa8cd2094af16360832248f3db6bb49fd88952e7` test(tracker): fail when setup stops wiring the scrolltrigger teardown. The second case in `scroll-trigger-teardown.test.ts`, `is run by an afterAll hook that tests/setup.ts gives every file`: it runs the file suite's merged `afterAll` hooks and asserts the interval stops, so dropping `afterAll(stopScrollTrigger)` from `tests/setup.ts` fails it.
- `40021765acad66357ed42c26966218f3f07a82bb` docs(tracker): stop crediting the removed e2e suite with coverage. Found by the independent verifier (round 2): `EraGroundTint.test.tsx` and `bulkImport.test.ts` said the gated e2e covered the smooth ScrollTrigger ramp and the real-stack import path; both now say no automated coverage exists since this story.

**Run 39026807811, recorded** (`gh run view 39026807811`, read 2026-10-18): workflow CI, `push` to `dev` at `9db6ae45e42f3b2b8c1855d2cedb3d6ee0e3d228`, created 2026-10-17T10:56:39Z, attempt 1, conclusion `failure`; only the `test` job (117379295378) failed, every other job green. The tracker step reported `Test Files 108 passed (108)`, `Tests 1245 passed (1245)`, `Errors 1 error`: `ReferenceError: requestAnimationFrame is not defined` at `Timeout._sync [as _onTimeout] ../../node_modules/.pnpm/gsap@3.14.2/node_modules/gsap/ScrollTrigger.js:372:48`, "originated in components/organisms/TimelineView/__tests__/TimelineView.test.tsx", "caught after test environment was torn down". No second attempt exists (the attempts API answers 404 for attempt 2). The first occurrence was run 38399622554 at `63c5a1f` (DW-341).

**Planted failures**, each restored and re-run green:

| Assertion | Plant | Failure output |
|---|---|---|
| `the interval still asks for a frame after the guard` (`scroll-trigger-teardown.test.ts`) | `ScrollTrigger.disable()` commented out in `stopScrollTrigger` | `× stopScrollTrigger (DW-341) > stops the sync interval, so no requestAnimationFrame call outlives the file`, `AssertionError: the interval still asks for a frame after the guard: expected "requestAnimationFrame" to not be called at all, but actually been called 4 times` |
| `the interval runs before the guard` (same test, its precondition) | `gsap.registerPlugin(ScrollTrigger)` commented out in the test | `→ the interval runs before the guard: expected "requestAnimationFrame" to be called at least once`, `Tests 1 failed (1)` |
| `no file afterAll hook stopped the interval` (`scroll-trigger-teardown.test.ts`, the wiring case) | `afterAll(stopScrollTrigger)` commented out in `tests/setup.ts` | `× stopScrollTrigger (DW-341) > is run by an afterAll hook that tests/setup.ts gives every file`, `AssertionError: no file afterAll hook stopped the interval: expected "requestAnimationFrame" to not be called at all, but actually been called 4 times`, `Tests 1 failed \| 1 passed (2)` |
| `the interval runs before the hooks` (the wiring case's precondition) | `ScrollTrigger.enable()` commented out in the wiring case | `→ the interval runs before the hooks: expected "requestAnimationFrame" to be called at least once`, `Tests 1 failed \| 1 passed (2)` |
| Matrix row 2: a jsdom file that never loaded gsap | `gsap.registerPlugin(ScrollTrigger)` commented out in `stopScrollTrigger`, run against `LogoMark.test.tsx` | `FAIL components/molecules/LogoMark/__tests__/LogoMark.test.tsx`, `TypeError: Cannot read properties of undefined (reading 'removeEventListener')`, `❯ ScrollTrigger.disable ScrollTrigger.js:1982:5`, `❯ stopScrollTrigger tests/scroll-trigger-teardown.ts:11:17` |
| Matrix row 3: a node-environment file | the `typeof window` check commented out, run against `lib/__tests__/timeline.test.ts` | `FAIL lib/__tests__/timeline.test.ts`, the same `TypeError ... reading 'removeEventListener'` from `ScrollTrigger.disable` |

The race itself is not reproduced on demand (a 250ms interval tick must land between jsdom's teardown and the worker's exit); the test proves the interval that throws is stopped.

**Verification**, all in the story worktree:

- `corepack pnpm --filter tracker typecheck`: exit 0 (at `b2c22eb`, and again at `4002176`).
- `corepack pnpm --filter tracker test`, Redis in `epic-scratch-9-19-redis`: at `4002176` 109 files, 1240 passed, 5 skipped (1245), no `Errors` line, 54.3 s (at `b2c22eb`, before `fa8cd20` added the wiring case, 1239 passed, 5 skipped (1244), 57.2 s). Two earlier runs on the same code failed 5 and then 2 different cases, all `Test timed out in 5000ms` (one spy count) while a `docker build` and a second install loaded the host; a baseline worktree at `928e32e` then passed 108 files, 1238 passed, 5 skipped, and a back-to-back pair measured 66.8 s here against 66.2 s at the baseline, so the guard adds no measurable cost.
- `corepack pnpm typecheck`: exit 0. `corepack pnpm test -- --run`: 87 files, 2033 passed, 4 skipped (2037), 149 s (the root suite excludes `apps/tracker`).
- `corepack pnpm install --frozen-lockfile`: exit 0 on the refreshed lockfile.
- `docker build --target deps -f apps/tracker/Dockerfile .` (`turbo prune tracker --docker` then `pnpm install --frozen-lockfile`): exit 0. In that image, `cd apps/tracker && env -u PATH node node_modules/tsx/dist/cli.mjs --version` printed `tsx v4.21.0`, and `command -v tsx` found nothing, so the new seed command resolves where the old one failed. The seed was not run against a database.
- `git grep` over `apps/tracker` for the deleted names finds only `CHANGELOG.md` history; the remaining mentions repository-wide are in dated specs and `deferred-work.md`.

## Spec Change Log

## Review Triage Log

The six layers ran inline in this session, not as separate subagents (no subagent tool here); the independent verifier is a separate agent and has not run.

| # | Layer | Finding | Verdict | Evidence and route |
|---|---|---|---|---|
| 1 | Edge Case | `stopScrollTrigger` called `disable()` on a plugin that was never registered | high | Observed: the first targeted run failed `TypeError ... removeEventListener` from `ScrollTrigger.disable`, because importing `gsap/ScrollTrigger` alone does not register it (`_getGSAP()` finds no `window.gsap`). Patched in `0bc7afe` before commit: register, then disable. Planted as matrix row 2 |
| 2 | Edge Case | the `typeof window` check was described as a cost saving | low | Planted: without it a node file fails with the same `TypeError`. Patched by `b2c22eb` (comment only) |
| 3 | Blind | the guard registers and enables ScrollTrigger in jsdom files that never used gsap, waking gsap's ticker there | false | The ticker schedules through the `requestAnimationFrame` it captured from the jsdom window, whose timers close with it, and `disable()` zeroes `_enabled`, which ends `_rafBugFix`; no `setTimeout` path remains in ScrollTrigger (`grep setTimeout` finds only the `_syncInterval` lines). Suite durations matched the baseline |
| 4 | Blind | detect registration through `gsap.core.globals().ScrollTrigger` instead of registering | false | Tried: `tsc` refused it (`Property 'globals' does not exist on type 'typeof core'`); an untyped internal is worse than an idempotent public call |
| 5 | Blind | `apps/tracker/.dockerignore` is inert too: the image's build context is the repository root, whose `.dockerignore` applies | medium | Same defect class as DW-276 on this surface; deleted in `018deab` |
| 6 | Blind | the `.gitignore` Playwright lines and two `pnpm infra` test comments name removed things | low | Direct corrections; patched in `018deab` |
| 7 | Verification Gap | the seed change is unverified against a database | low | Accepted as stated: the path is proven in the pruned image's install with PATH unset; running the seed writes rows, and the live database is already seeded (DW-276) |
| 8 | Verification Gap | the lockfile refresh could break the tracker image's frozen install | false | `docker build --target deps` ran `turbo prune` and `pnpm install --frozen-lockfile` to exit 0 |
| 9 | Ponytail | `eslint.config.mjs` stays though nothing runs ESLint | false | Kept on purpose: it is the flat config AGENTS.md names as the precondition for any lint gate; the story removes the second config, not the first |
| 10 | ECC Verification Loop | Hub build not run | false | Nothing under `apps/hub` changed; typecheck and both suites ran (above). Lint: N/A (no lint command, see AGENTS.md) |
| 11 | Design Review | motion keywords (`gsap`, `ScrollTrigger`) appear only under `tests/` | false | No UI surface and no product motion changed; `EraGroundTint.tsx` is untouched |

## Design Notes

The flake is a race, not a test bug: the interval ticks every 250ms for the life of the worker, and only a tick landing between jsdom's teardown and the worker's exit throws. Stubbing `requestAnimationFrame` in setup would not survive teardown, which deletes the globals the environment installed, so the interval itself is stopped. Registering is idempotent where `EraGroundTint` already registered, and where nothing did it enables the plugin only for `disable()` to stop it at once; that costs one module load per jsdom file and keeps the guard from depending on which files reach gsap.

`apps/tracker/.dockerignore` was not named by DW-276 but is the same kind of file: `image-tracker.yml` builds with the repository root as context, so only the root `.dockerignore` applies. The e2e suite went rather than being kept: it needed Postgres, Redis and a worker that no workflow here provides, so it ran nowhere since the merge (DW-276). `eslint.config.mjs` stays as the single configuration for the lint story AGENTS.md anticipates.

## Ledger closures

**DW-341:** **Closed 2026-10-18 by Story 9-19-tracker-flake-and-inert-files** (`0bc7afe`, `apps/tracker/tests/scroll-trigger-teardown.ts`: `stopScrollTrigger`): the second occurrence is recorded, `ci.yml` run 39026807811 on `dev` at `9db6ae4` (`9db6ae45e42f3b2b8c1855d2cedb3d6ee0e3d228`), 2026-10-17, attempt 1, `test` job failed on the same `ReferenceError` from `ScrollTrigger.js:372:48` (`_sync`), originating in `TimelineView.test.tsx` after teardown, with 1245 tests passed. The cause is gsap ScrollTrigger's `setInterval(_sync, 250)`, started when `EraGroundTint` registers the plugin in a window and never stopped; `_sync` calls the global `requestAnimationFrame` that jsdom's teardown deletes. The tracker's Vitest setup now runs `afterAll(stopScrollTrigger)`, which registers (idempotently) and calls `ScrollTrigger.disable()`, clearing the interval in every jsdom file. `tests/__tests__/scroll-trigger-teardown.test.ts` proves no frame is requested after the guard, planted by skipping `disable()`, and its wiring case (`fa8cd20`) proves the file suite's `afterAll` hooks stop the interval, planted by dropping `afterAll(stopScrollTrigger)` from `tests/setup.ts`.

**DW-276:** **Closed 2026-10-18 by Story 9-19-tracker-flake-and-inert-files** (`018deab`, `6226fe7`): the inert delivery files are gone: `apps/tracker/.github/workflows/ci.yml`, `docker/` (both Dockerfiles and both Caddyfiles), `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.override.example.yml`, `.eslintrc.json`, the Playwright e2e suite with `playwright.config.ts` and `@playwright/test`, and `apps/tracker/.dockerignore`, which the root build context never read; the `infra`, `infra:down`, `stack` and `test:e2e` scripts went with them, and the README now points at `ops/tracker-cutover.md`. `eslint.config.mjs` stays as the one ESLint configuration, for the lint story AGENTS.md anticipates. The e2e half's coverage was already lost at the merge and is not replaced. The Prisma seed runs `node node_modules/tsx/dist/cli.mjs prisma/seed.ts`, the worker's form, which resolves in the image's install with PATH unset (checked in the `deps` stage); it was not run against a database. The `CLAUDE.md` half was closed 2026-09-30.

No sprint-status action item is named by this story; the one that mentions DW-276, `epic-3-retro-item-31-decide-the-merged-trees-agent-files-apps`, is already `done`.

## Independent verifier

pending

## Verification

**Commands:**
- `corepack pnpm --filter tracker typecheck`: exit 0
- `corepack pnpm --filter tracker test` (Redis on 6379): all pass, `Errors` absent
- `corepack pnpm typecheck` and `corepack pnpm test -- --run`: root unchanged and green
- `corepack pnpm install --frozen-lockfile`: exit 0
