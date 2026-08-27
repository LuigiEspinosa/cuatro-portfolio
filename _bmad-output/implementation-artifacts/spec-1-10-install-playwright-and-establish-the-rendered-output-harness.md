---
title: 'Install Playwright and establish the rendered-output harness'
type: 'feature'
created: '2026-08-24'
status: 'awaiting-operator'
baseline_commit: '4f4c751092ade52d649841ff0cd5625f680040b6'
baseline_revision: '4f4c751092ade52d649841ff0cd5625f680040b6'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/.github/workflows/ci.yml'
warnings: ['oversized']
operator_actions:
  - 'Push this branch so the new blocking `rendered-output` job runs on a GitHub runner for the first time, then record its measured image pull, install and harness step timings in the "What provisioning the browser costs" table of ops/rendered-output-harness.md, keeping the local rows and their methods rather than overwriting them.'
  - 'Confirm from that first run that `actions/checkout@v4` and `pnpm/action-setup@v4` behave correctly inside the pinned container job, since neither has ever executed in that configuration in this repository.'
  - 'Decide whether the container job taking the image Node v24.18.1 while the `test` job pins Node 22 is acceptable, or pin the container job explicitly, and record the ruling in Pending Operator action 2 of ops/rendered-output-harness.md.'
  - 'Run `/bmad-project-context` to refresh the machine-managed `bmad:context` block in AGENTS.md, whose lines 52 to 57 now falsely state that CI runs typecheck and tests only and that Playwright is not installed.'
deferred:
  - summary: >-
      The machine-managed `bmad:context` block in AGENTS.md still states that Playwright is not
      installed and that no acceptance criterion may claim a rendered-output or browser check.
    evidence: |-
      AGENTS.md:52-53 reads "CI (.github/workflows/ci.yml) runs typecheck and tests only" and
      :55-57 reads "Playwright is not installed. @playwright/test appears only as a transitive
      lockfile entry, not in package.json. Story 1-10 installs it. Until then no acceptance
      criterion may claim a rendered-output or browser check." All three claims are false after
      this story, and Stories 1.12 and 1.17 through 1.19 depend on the capability those lines
      forbid. The block is rewritten by /bmad-project-context and this story is forbidden from
      hand-editing it, so the correction belongs to that refresh. It is also Pending Operator
      action 3 in ops/rendered-output-harness.md and is already foreshadowed by
      sprint-status.yaml:95-97.
    location: >-
      AGENTS.md:52-57
    severity: medium
  - summary: >-
      `useReduceMotion`'s initial state calls matchMedia with an unparenthesised media query, so
      it always starts false regardless of the user's setting.
    evidence: |-
      hooks/useReduceMotion.ts:6 passes 'prefers-reduced-motion: reduce' where a media query
      requires '(prefers-reduced-motion: reduce)'. An unparenthesised string is not a valid
      query, so `.matches` is false on first render. The effect at :10 uses the correct form and
      corrects the value on mount, so the visible consequence is one frame of animated state for
      a reader who asked for reduced motion. Pre-existing, unrelated to this story, and found
      while reasoning about what stops the GSAP entrance tweens during a screenshot.
    location: >-
      hooks/useReduceMotion.ts:6
    severity: low
---

<intent-contract>

## Intent

**Problem:** Four Epic 1 stories (1.12, 1.17, 1.18, 1.19) and every AD-19 floor turn on a rendered
property, and the Anchor cannot observe one. `@playwright/test` is not a dependency at all: the only
occurrence in the repository is an unresolved optional peer of `next` at `pnpm-lock.yaml:2162`, which
C-7 records as a real setup cost never paid. Until it is paid, "visually identical" and "this call
site still renders bold" are claims a document makes rather than assertions a machine makes.

**Approach:** Install `@playwright/test` pinned exactly, add a config plus a small `tests/e2e`
harness exposing three capabilities (a route screenshot at a viewport compared against a committed
baseline at a written tolerance, the computed value of a named CSS property on a named selector, and
the computed value of a custom property on `:root`), wire one blocking `rendered-output` job into
`.github/workflows/ci.yml`, demonstrate each capability failing against a temporary probe and remove
both probes, and record the tolerance, its reasoning, the browser provisioning cost and the probe
output under `ops/`.

## Boundaries & Constraints

**Always:**
- Baselines are generated inside the exact container image the CI job runs
  (`mcr.microsoft.com/playwright:v1.62.1-noble`). Font rasterization differs per platform and
  `--font-mono: 'Courier New', monospace` (`app/app.scss:31`) has no Courier New on Linux, so a
  baseline captured on this Windows host could never match a CI render. Pinning both sides to one
  image is what makes the tolerance a real number rather than a fudge factor.
- The job is blocking (AD-21): no `continue-on-error`, no `|| true`, no soft-fail, no
  `--pass-with-no-tests` style escape. A run that matched zero tests must fail.
- Its triggers match the existing file exactly: `push: branches: ['**']` and
  `pull_request: branches: [main]`.
- Every recorded number is marked observation or decision and carries its method (NFR-9). Dates are
  ISO 8601 UTC.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash, and no
  emoji. The commit is a subject line only, no body and no trailer.
- Both probes are deleted before the story closes. Their evidence lives in the `ops/` record, not in
  the working tree.

**Block If:**
- The only way to get a stable baseline is to weaken, skip or soft-fail an existing CI gate.
- The Hub cannot be built and served inside the container, so no capability can be demonstrated
  failing. A gate never observed to fail is not known to work, and shipping one unobserved is worse
  than shipping none.

**Never:**
- Never add the 44x44 hit-target assertion or the Status mark's three structural axes. Those are
  Stories 2.8 and 2.10 and need a Suite Directory that does not exist.
- Never touch `.lighthouserc.js` or `.github/workflows/lighthouse.yml`. The accessibility assertion
  at 0.95, severity error, stays byte-identical.
- Never edit `.github/workflows/deploy.yml`. Its AD-8 breach is KV-1 in `ops/known-violations.md`,
  retired in Epic 3.
- Never create anything under `contracts/` or introduce a `--token-*` name. This story ships the
  instrument, not the contract.
- Never change application source to make a screenshot stable. If a region does not render
  deterministically, mask it or narrow the target.
- Never let a Playwright spec fall inside Vitest's include globs. `corepack pnpm test --run` stays at
  38 tests and never tries to drive a browser.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Baseline matches | `/work` at 360x800, render unchanged | Test passes | No error expected |
| Baseline differs | Render shifted past the tolerance | Test fails, diff PNG written to the report | Non-zero exit |
| Baseline missing | No committed PNG for the project | Test fails naming the missing file | Never silently written; updating is an explicit opt-in run |
| Computed property read | Selector present, property named | Resolved computed string returned | No error expected |
| Selector absent | No element matches | Fails naming the selector | Never returns a default that would pass vacuously |
| Root custom property read | `--monument-bold` on `:root` | `'MonumentExtended-Bold'` | No error expected |
| Custom property undefined | Name not declared | Fails naming the property | `getPropertyValue` returns an empty string for an undeclared property, which would pass a naive equality check against another empty string |

</intent-contract>

## Code Map

Gathered 2026-08-24 against `4f4c751`, working tree clean.

- `package.json:31-46` -- devDependencies today: Vitest 4, Testing Library, jsdom. No Playwright.
  `:9-16` scripts, where `test` is bare `vitest` (watch mode) and `linkg` is the known-misspelled dead
  lint script. Add the pinned dependency and the e2e scripts here.
- `pnpm-lock.yaml:2162,2170` -- the only `@playwright/test` occurrence: an *optional peer* of `next`,
  never resolved, so nothing is installed and nothing is cached. This is C-7's evidence
  (`ARCHITECTURE-SPINE.md:433`). Latest stable on the registry checked 2026-08-24 is **1.62.1**.
- `.github/workflows/ci.yml` -- the whole file is one `test` job: checkout, `pnpm/action-setup@v4`,
  `setup-node@v4` at Node 22 with pnpm cache, `--frozen-lockfile`, typecheck, `pnpm test --run`.
  Triggers at `:3-7` are the ones the new job must match.
- `.github/workflows/lighthouse.yml:26-39` and `.lighthouserc.js:15` -- the existing browser work in
  CI (build, `pnpm start`, `wait-on`, `@lhci/cli autorun`) and the 0.95 accessibility assertion.
  Read-only here, and the `build` then `start` then `wait-on` sequence is the pattern the Playwright
  `webServer` block replaces with its own supervision.
- `vitest.config.ts:7-11` -- `environment: 'jsdom'`, `globals: true`, no `include`/`exclude`, so
  Vitest's defaults match `**/*.{test,spec}.?(c|m)[jt]s?(x)` anywhere outside `node_modules`. A file
  named `*.spec.ts` under `tests/e2e` would be swept into `pnpm test`. Two independent guards follow
  from this: name the specs `*.pw.ts`, and exclude the directory explicitly.
- `app/app.scss:3-32` -- the `:root` block the custom-property helper reads. `:29` is
  `--monument-bold: 'MonumentExtended-Bold'`. `:31` is the `Courier New` mono fallback that makes
  platform pinning load-bearing.
- The four `--monument-bold` call sites, and **the trap in them**: `glitch-text.scss:5` is the only
  one that also sets `font-weight: 700` (`:7`). `WorkHero.scss:19`, `ProjectsHero.scss:19` and
  `error-page.scss:24` set family alone, so their computed `font-weight` is `400` today and would
  still be `400` after Story 1.18's alias silently dropped bold. See Design Notes: the helper is
  generic, the property Story 1.18 must read is `font-family`, not `font-weight`.
- `app/scss/_fonts.scss:91-99` -- `@font-face` for `MonumentExtended-Bold` at `font-weight: 700`.
  The family name carries the weight; that is why the trap exists at all.
- `app/work/page.tsx` plus `components/organisms/WorkHero/WorkHero.tsx:25-52` -- the chosen route.
  Its GSAP entrance tweens sit behind `if (!reduceMotion)`, so a `reducedMotion: 'reduce'` context
  skips them at source. `:70-72` is the `TorusCanvas` (react-three-fiber, WebGL, animated by
  `useFrame`), which must be masked rather than waited on.
- `components/atoms/Container/Container.tsx:12-16` -- `<body id={route}>`, which is what
  `app/app.scss:53-60` keys the `/work` grid background off. A screenshot of `/work` therefore also
  covers that selector working.
- `components/atoms/ScanlineOverlay/ScanlineOverlay.scss:33-44` -- an `feTurbulence` grain layer with
  a CSS animation. Playwright disables CSS animations for screenshots by default and the layer is
  behind `prefers-reduced-motion` anyway; the noise itself is deterministic inside one Chromium build.
- `ops/monitoring.md`, `ops/known-violations.md` -- the shape every record under `ops/` follows: a
  provenance line naming story and date, tables with a `Nature` column, a "Maintaining this file"
  section and a "Pending Operator actions" table.
- `.gitignore:74-97` -- the Next.js block, where the Playwright output directories belong.
- Environment checked 2026-08-24 on this host: Docker server 29.7.2 available, npm registry
  reachable, and `%LOCALAPPDATA%\ms-playwright` already holds chromium builds 1223, 1228 and 1234
  from unrelated installs. Those Windows builds are irrelevant to the committed baseline, which is
  produced in the Linux container.

## Tasks & Acceptance

**Execution:**
- `package.json` -- add `@playwright/test` to devDependencies pinned exactly (`"1.62.1"`, no caret,
  unlike every neighbouring range) because the browser build is version-coupled to the package and a
  floating range would silently repoint the baseline. Add `test:e2e` (`playwright test`) and
  `test:e2e:update` (`playwright test --update-snapshots`). Leave `test`, `typecheck` and the dead
  `linkg` untouched.
- `playwright.config.ts` -- new. `testDir: 'tests/e2e'`, `testMatch: '**/*.pw.ts'`, one project
  pinned to chromium at a 360x800 viewport with `deviceScaleFactor: 1` and
  `reducedMotion: 'reduce'`; `webServer` building and serving the production bundle with
  `reuseExistingServer: !process.env.CI`; `expect.toHaveScreenshot` carrying the tolerance;
  `forbidOnly: !!process.env.CI`; `retries: 0`, so a flaky render is a failure to fix rather than a
  retry to hide.
- `tests/e2e/harness.ts` -- new. The three capabilities as named helpers, each failing loudly rather
  than vacuously: a missing selector and an undeclared custom property both throw naming what was
  asked for. This file is the surface Stories 1.12, 1.17, 1.18 and 1.19 import.
- `tests/e2e/rendered-output.pw.ts` -- new. One test per capability against `/work`, plus a
  vacuous-pass guard asserting the run matched the tests it was supposed to.
- `tests/e2e/rendered-output.pw.ts-snapshots/` -- the committed baseline PNG, generated inside
  `mcr.microsoft.com/playwright:v1.62.1-noble`.
- `vitest.config.ts` -- exclude `tests/e2e/**` while preserving Vitest's default excludes by
  spreading `configDefaults.exclude`, so the belt-and-braces guard cannot itself drop `node_modules`.
- `.gitignore` -- ignore `test-results/`, `playwright-report/` and `blob-report/`.
- `.github/workflows/ci.yml` -- add a `rendered-output` job running in the pinned Playwright
  container, blocking, on the same triggers. Do not modify the existing `test` job.
- `ops/rendered-output-harness.md` -- new record: what the harness asserts and deliberately does not
  yet; the tolerance with its reasoning and the measured probe ratio; the provisioning cost with its
  method; how a baseline is regenerated and when regenerating is legitimate; the two probe
  demonstrations with their output; and the pending Operator action for the first real CI timing.

**Acceptance Criteria:**
- Given `@playwright/test` was only an unresolved optional peer at `pnpm-lock.yaml:2162`, when the
  install lands, then `package.json` carries it as a direct devDependency at an exact pinned version,
  `pnpm-lock.yaml` resolves it, and `corepack pnpm install --frozen-lockfile` succeeds against the
  committed lockfile.
- Given C-7 makes browser provisioning a real cost rather than a free addition, when the CI job is
  written, then a browser is provisioned in CI by a pinned mechanism, and `ops/rendered-output-harness.md`
  records what that costs in run time, marked as an observation and stating the method by which it
  was obtained.
- Given Stories 1.17 and 1.20 turn on whether a render changed, when the harness runs, then it
  captures `/work` at 360x800 and compares it against a committed baseline, and the comparison fails
  when the difference exceeds the stated tolerance.
- Given "visually identical" needs a definition rather than an opinion, when the tolerance is
  recorded, then `ops/rendered-output-harness.md` states the exact tolerance values, why each was
  chosen, the diff ratio the shift probe actually produced, and the margin between them.
- Given Story 1.18's alias trap turns on a computed value rather than a screenshot, when the harness
  runs, then it reads the computed value of a named CSS property on a named selector, and separately
  the computed value of a custom property on `:root`, both against the running Hub.
- Given an undeclared custom property yields an empty string rather than an error, when a helper is
  asked for a selector that matches nothing or a property that is not declared, then it fails naming
  what was missing rather than returning a value that could compare equal to an expectation.
- Given a gate never observed to fail is not known to work, when the harness is verified, then the
  baseline comparison is demonstrated failing against a deliberately shifted render and the
  computed-style read is demonstrated failing against a deliberately wrong expected value, both
  outputs are recorded, and neither probe exists in the tree at the closing commit.
- Given AD-21 makes every CI gate blocking, when `.github/workflows/ci.yml` is read, then the new job
  carries no `continue-on-error` and no soft-fail, runs on `push` to `**` and `pull_request` to
  `main`, and a run that matches no tests fails rather than reporting success.
- Given the existing accessibility floor must not be weakened, when the story closes, then
  `.lighthouserc.js`, `.github/workflows/lighthouse.yml` and `.github/workflows/deploy.yml` are
  byte-identical to `4f4c751`, and the existing `test` job in `ci.yml` is unchanged.
- Given a Playwright spec inside Vitest's default globs would break the unit suite, when
  `corepack pnpm test --run` is executed, then it reports the same unit suite passing, unchanged
  in count from `4f4c751`, and starts no browser. The figure is **215 tests in 17 files**,
  observed 2026-08-24; the "38 tests" this criterion was first written with came from
  `AGENTS.md:46`, which is stale. The frozen intent block carries the same stale figure and is
  left alone.

## Spec Change Log

### 2026-08-24, Dev session

Three points where the code map or an acceptance criterion did not survive contact. None
changes what the story delivers; each is recorded so a reviewer does not read the difference as
a defect.

- **The unit suite is 215 tests in 17 files, not 38.** Observed 2026-08-24 by
  `corepack pnpm test --run`. The 38 in the last acceptance criterion, and the same figure in
  `AGENTS.md` under "Running and verifying", are both stale. The criterion's substance is met and
  was checked the way it should have been written: `corepack pnpm exec vitest list` collects the
  same 215 tests with and without the new `tests/e2e/**` exclude, and no `tests/e2e` file appears
  in either listing. `AGENTS.md` was not edited, since it is not a file this story touches.
- **`reducedMotion` is no longer a top-level Playwright test option.** As of 1.62 it is a context
  option, so `playwright.config.ts` sets `contextOptions: { reducedMotion: 'reduce' }` rather
  than `reducedMotion: 'reduce'`. The top-level spelling does not typecheck against 1.62.1.
- **The screenshot helper cannot wait for network idle.** Lenis plus the GSAP ticker keep the
  Hub busy indefinitely, so `waitForLoadState('networkidle')` times out rather than settling
  (observed: a 30 s test timeout on the first container run). The helper waits for
  `document.fonts.ready` instead, which is the condition the baseline actually depends on, and
  leaves the rest to `toHaveScreenshot`, which retries until two consecutive captures agree.

## Review Triage Log

### 2026-08-24, Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 19: (high 1, medium 8, low 10)
- defer: 2: (high 0, medium 1, low 1)
- reject: 6: (high 0, medium 2, low 4)
- addressed_findings:
  - `[high]` `[patch]` `pnpm test:e2e:update` would have overwritten the committed baseline with the shift test's deliberately shifted render, and written a stray `absent-baseline` PNG beside it. Bare `--update-snapshots` presets Playwright to `changed`, where a mismatching screenshot is written over rather than failed on, so the only documented way to refresh the baseline would have committed a broken one. Raised independently by three review layers. Both negative screenshot tests now carry `test.skip(testInfo.config.updateSnapshots !== 'none', ...)`, and a new test asserts the snapshot directory holds exactly the one committed PNG. Verified in the pinned container: an update run skips 2 of 13, passes 11, and leaves the baseline byte-identical at `sha256:27f22bb6...`.
  - `[medium]` `[patch]` The CI container job omitted `options: --ipc=host`, while every green run recorded in `ops/` was produced with it. Chromium's default 64 MB `/dev/shm` crashes the renderer, and `retries: 0` turns one crash into a red build on an unrelated pull request. Added, so both sides of the comparison run on one configuration.
  - `[medium]` `[patch]` The shift test asserted only `/are different/` under a 5 s comparison budget. A loaded runner that fails to get two stable captures produces a message with no pixel line, which would have gone red for the wrong reason. Budget raised to 10 s and the assertion now covers all three verdict shapes.
  - `[medium]` `[patch]` `reuseExistingServer: !process.env.CI` on port 3000 let a running `next dev` become the thing measured, silently baselining a development render. The harness now serves on port 3100 and never reuses.
  - `[medium]` `[patch]` A mask selector that matched nothing masked nothing, silently, so a renamed `.work-hero__canvas-wrap` would have reintroduced the WebGL torus into the comparison as intermittent redness with no stated cause. The helper now throws naming the selector, and a test covers it.
  - `[medium]` `[patch]` `expectRouteScreenshot` skipped its HTTP status guard entirely when `page.goto` returned null, which is exactly how an error page becomes a baseline. A null response is now a failure naming the route.
  - `[medium]` `[patch]` The tolerance table counted 288,000 pixels while the torus mask excludes 86,400 of them, overstating the sensitivity over the region actually compared, and a canvas that rendered nothing would still have passed. Both the compared-pixel count and the 30 percent masked share are now recorded, and the screenshot test asserts the masked element has a non-zero bounding box.
  - `[medium]` `[patch]` The recorded "finding Story 1-18 inherits" told a later story to read `font-family` instead of `font-weight`. `epics.md:1842-1843` already requires 1.18 to set `font-weight` by hand at all four call sites in the same commit, before `:1844` reads it, so the correct finding is "assert both, and set the weight before reading it". Corrected in the ops record, this spec's Design Notes and the `harness.ts` header.
  - `[medium]` `[patch]` `ops/rendered-output-harness.md` contradicted itself after the second commit: "Eight tests" in one place, "all six tests" in two others, and timing rows measured against a smaller file. Counts corrected to thirteen, the six-test rows kept and labelled with what they measured, and a new dated thirteen-test figure added, per that file's own no-deletion rule.
  - `[low]` `[patch]` `RENDERED_VIEWPORT` was exported and imported by nothing, so the anti-drift guarantee both the config comment and the ops table credited it with did not exist. It now lives in `harness.ts`, the config imports it, the spec builds the snapshot name from it, and the screenshot test asserts `page.viewportSize()` matches it.
  - `[low]` `[patch]` `computedStyleValue` used a non-waiting `count()`, so an element rendering one tick later would be reported as absent. It now waits up to 5 s for the selector to attach before deciding.
  - `[low]` `[patch]` Three loud-failure branches shipped unobserved, against the story's own rule: the non-2xx route guard, the empty-string property guard, and the non-custom-property-name guard. Each now has a standing test.
  - `[low]` `[patch]` The record never drew the consequence of its own font-substitution argument: `--font-mono` has no Courier New on Linux, so `.work-hero__meta` is baselined against a face no visitor sees. Recorded as a stated limit.
  - `[low]` `[patch]` A computed `font-family` read returns the resolved declaration, not the face that rasterized, so it cannot detect a broken `@font-face` src. Recorded as a stated limit.
  - `[low]` `[patch]` The capture is the 360x800 viewport and not `fullPage`, and `ScreenshotOptions` exposes no way to widen it, which Stories 1.17 and 1.20 inherit. Recorded as a stated limit rather than widened, because an untested option would be another unobserved capability.
  - `[low]` `[patch]` Nothing said that `pnpm test:e2e` cannot pass on this Windows host, where Playwright looks for a `-win32.png` that does not exist. Recorded, along with the fact that the failure writes nothing.
  - `[low]` `[patch]` The new job had no `timeout-minutes` and the artifact upload no `if-no-files-found`, so a hung browser ran until the platform killed it and an install failure produced a second, unrelated warning. Both added.
  - `[low]` `[patch]` The claim that the standing tests stop someone who "widens the mask until nothing is compared" holds only for a widening that covers the heading. Reworded, with the other case pointed at the mask-selector test.
  - `[low]` `[patch]` This spec's own acceptance criterion and verification command asserted "the same 38 tests", a figure copied from the stale `AGENTS.md:46`. The observed suite is 215 tests in 17 files. Corrected in both places outside the frozen block; the identical figure inside `<intent-contract>` is left alone because that block is read-only.

Two findings were deferred rather than fixed, both recorded in frontmatter `deferred`: the stale
`bmad:context` block in `AGENTS.md`, which only a `/bmad-project-context` refresh may rewrite,
and an unparenthesised media query in `hooks/useReduceMotion.ts:6` that predates this story.

Six were rejected. The sprint board row is the orchestrator's bookkeeping and not this story's to
write. The ` -- ` separator this spec template uses in its Code Map and task lists is a structured
separator, not a prose dash, and matches every sibling spec. A `tests/e2e/tsconfig.json` to stop
`vitest/globals` types leaking into a Playwright spec is defence against a mistake that would fail
loudly at runtime anyway. A dependency cache and a `concurrency` group on the new job are costs
recorded as a decision rather than defects, and adding an unobserved cache mechanism to a blocking
gate trades a known cost for an unknown failure. The two negative screenshot tests must bypass
`expectRouteScreenshot` to inject anything at all, and adding a probe hook to the surface later
stories import would be worse than the duplication. Deriving the capability ledger from the
harness's exports guards a fourth capability that does not exist.

**On the workflow's prefer-bad_spec rule.** The stale test count came from a spec sentence, which
argues for `bad_spec` and a full re-derivation. It was triaged `patch` deliberately: the code never
deviated, the figure was wrong in the spec and in `AGENTS.md` alike, and re-deriving would have
produced byte-identical code while discarding a verified implementation. The correction is
recorded here rather than hidden.

## Design Notes

**Why the container is pinned on both sides.** Playwright names a snapshot per platform, so a
baseline made here would be `-win32.png` and CI would look for `-linux.png` and fail on a missing
file. Even forcing the name, the render would differ: text at `--font-mono` falls back to a different
face on Linux, and glyph rasterization is not portable. Running CI inside
`mcr.microsoft.com/playwright:v1.62.1-noble` and generating the baseline in the same image makes an
unchanged render essentially byte-identical, which is what lets the tolerance be small enough that a
one-pixel shift still fails it. The image also ships the browsers, so provisioning becomes an image
pull rather than a download step, and that is the number the cost AC asks for.

**Why `/work`, and why the canvas is masked.** It is the only route that combines a
`--monument-bold` call site (`.work-hero__heading`), the body-id background rule, and server-rendered
content whose entrance animation is already gated on reduced motion. Its `TorusCanvas` is WebGL
driven by `useFrame` and can never be stable, so it is masked rather than waited for. Masking a
region is honest; adding a test hook to the application to freeze it would change the thing being
measured, which the boundaries forbid.

**The finding Story 1.18 needs.** The AC calls the alias check a `font-weight` read. Read against
the tree as it stands, that read would prove nothing on three of the four call sites: `font-weight`
computes to `400` there both before and after a bad alias, because the weight lives in the family
name (`_fonts.scss:91-99`) rather than in a declaration. Only `glitch-text.scss:7` sets `700`
explicitly. **Corrected during review:** Story 1.18's own criteria already close that hole and the
order is what matters. `epics.md:1842-1843` requires all four call sites to have `font-weight` set
alongside `font-family` by hand in the same commit, and only then does `:1844` assert them bold by
reading computed `font-weight`. The finding to inherit is therefore not "read `font-family` instead"
but "assert both, and set the weight before reading it". The harness stays generic, which is what
lets 1.18 do either.

**Tolerance, stated as a rule rather than a number picked in advance.** Keep Playwright's default
per-pixel `threshold` and set `maxDiffPixelRatio` so that the shift probe's measured ratio exceeds it
by at least five times. The probe is a one-pixel translation of the heading; if the smallest shift
Story 1.17 would care about does not clear the tolerance by a wide margin, the tolerance is wrong and
gets lowered rather than the probe made louder. Both numbers go into the record.

## Verification

**Commands:**
- `corepack pnpm install --frozen-lockfile` -- expected: resolves with the committed lockfile, no
  `ERR_PNPM_OUTDATED_LOCKFILE`.
- `corepack pnpm typecheck` -- expected: pass, with `playwright.config.ts` and `tests/e2e` inside the
  program.
- `corepack pnpm test --run` -- expected: 215 tests in 17 files pass, no browser started, no
  Playwright file collected.
- `docker run --rm -v <repo>:/w -w /w mcr.microsoft.com/playwright:v1.62.1-noble ...` running
  `pnpm exec playwright test` -- expected: all capability tests pass against the committed baseline.
  Same command with each probe applied -- expected: the corresponding test fails, and the diff ratio
  or the mismatched value is captured for the record.
- `git diff --stat 4f4c751 -- .lighthouserc.js .github/workflows/lighthouse.yml .github/workflows/deploy.yml`
  -- expected: empty output.
- Punctuation sweep over every file written, built on surrogate-pair ranges rather than `\u{...}`
  syntax and run against a positive control carrying all four forbidden forms, so it cannot pass
  vacuously (the trap recorded in `spec-1-5` finding 5 and repeated in `spec-1-9` finding 12).

**Manual checks:**
- Re-read `.github/workflows/ci.yml` after editing and confirm the existing `test` job is untouched
  and the new job's `on:` triggers are the file's, not a copy that drifted.
- Confirm no probe file, probe stylesheet or probe assertion survives in the closing commit.
- Run the harness once with `--update-snapshots` and confirm the committed baseline is byte-identical
  afterwards and no second snapshot appeared, since the documented refresh path is the one way a
  broken baseline could be committed without anyone noticing.

## Auto Run Result

Status: awaiting-operator

**What was implemented.** The Anchor now has a rendered-output harness. `@playwright/test` is a
direct devDependency pinned exactly at `1.62.1`, a `tests/e2e` harness exposes three capabilities
(a route screenshot at a fixed viewport against a committed baseline, the computed value of a
named CSS property on a named selector, and the computed value of a custom property on `:root`),
and a blocking `rendered-output` job runs them in CI inside the container image the baseline was
generated in. Both capabilities were demonstrated failing against a probe and both probes were
removed; the two screenshot failure paths are additionally asserted permanently, so the gate is
observed failing on every run rather than only on 2026-08-24.

**Files changed.**

- `package.json` -- `@playwright/test` at an exact pin, plus `test:e2e` and `test:e2e:update`.
- `pnpm-lock.yaml` -- resolves it as a real dependency rather than an unresolved optional peer.
- `playwright.config.ts` -- browser, viewport, scale factor, motion preference, tolerance,
  `updateSnapshots: 'none'`, `retries: 0`, and a `webServer` that always builds and serves its own
  production bundle on port 3100.
- `tests/e2e/harness.ts` -- the three capabilities and the shared viewport constant, each helper
  failing loudly rather than returning a value that could compare equal to an expectation.
- `tests/e2e/rendered-output.pw.ts` -- thirteen tests: three capabilities, nine failure paths, one
  vacuous-pass guard.
- `tests/e2e/rendered-output.pw.ts-snapshots/work-360x800-chromium-linux.png` -- the baseline.
- `vitest.config.ts` -- excludes `tests/e2e/**` while spreading `configDefaults.exclude` back in.
- `.gitignore` -- Playwright's output directories.
- `.github/workflows/ci.yml` -- one new blocking job in the pinned container with `--ipc=host` and
  a 20 minute ceiling. The existing `test` job is untouched.
- `ops/rendered-output-harness.md` -- the record: tolerance and reasoning, provisioning cost,
  regeneration rules, both probe demonstrations, the stated limits, and four Operator actions.

**Review findings.** 19 patched (1 high, 8 medium, 10 low), 2 deferred, 6 rejected, 0 intent gaps,
0 spec loopbacks. The high finding is the one worth knowing: the documented baseline-refresh path
would have committed a deliberately broken baseline. See the Review Triage Log above for each.

**Follow-up review recommended: true.** One patched finding was high severity, which sets the flag
on its own. Patched counts by severity: high 1, medium 8, low 10.

**Verification performed.** All browser work ran inside `mcr.microsoft.com/playwright:v1.62.1-noble`,
the image the CI job pins.

- `corepack pnpm install --frozen-lockfile`: clean, no `ERR_PNPM_OUTDATED_LOCKFILE`.
- `corepack pnpm typecheck`: passes.
- `corepack pnpm test --run`: 215 tests in 17 files, no browser started, no Playwright file
  collected.
- `pnpm test:e2e` in the container: 13 passed in 22.2 s against the committed baseline.
- `pnpm test:e2e:update` in the container: 2 skipped, 11 passed, baseline byte-identical at
  `sha256:27f22bb6ff78c62e019cc8f222665436b7a20c2445a90677bead375c7d763f97`, snapshot directory
  still holding exactly one file.
- Probe 1 (a one-pixel `translateX` on `.work-hero__heading` in `WorkHero.scss`): the screenshot
  test failed at 2,095 differing pixels, ratio 0.007274, a 7.27x margin over the 0.001 tolerance.
  Reverted.
- Probe 2 (the expected computed family flipped to `MonumentExtended-Regular`): the computed-style
  test failed. Reverted.
- `git diff --stat 4f4c751 -- .lighthouserc.js .github/workflows/lighthouse.yml .github/workflows/deploy.yml`:
  empty.
- Punctuation sweep over every written file, built on surrogate-pair ranges and run against a
  positive control carrying an em-dash, an en-dash, a prose double-dash, an astral emoji and a BMP
  pictograph. The control reported all five; the written files reported zero em-dashes, zero
  en-dashes and zero emoji. Every surviving `--` is a CLI flag, a code literal, or this template's
  list separator.

**Residual risks.**

- **The CI job has never run on a GitHub runner.** `actions/checkout@v4` and `pnpm/action-setup@v4`
  executing inside a container job is the one part of this change with no observation behind it.
  Nothing is soft-failed, so a problem there fails the build rather than hiding, and it is the
  first Operator action.
- **The provisioning figures are a development host's**, clearly marked as such. The number C-7
  actually asks for arrives with that first run.
- **A Playwright version bump must move four things at once**: the pin, the container image tag,
  the baseline PNG and the figures in the record. Written into the record and into a comment in
  `ci.yml`, but nothing enforces it mechanically.
- **`next start` warns that it does not work with `output: standalone`** and serves anyway. The
  existing Lighthouse job already depends on this behaviour; the harness inherits it rather than
  introducing it.
- **The screenshot covers one viewport of one route with 30 percent of the frame masked.** Story
  1.17's "visually identical" rests on exactly that unless 1.17 widens it first. Recorded as a
  stated limit rather than papered over.
</content>
