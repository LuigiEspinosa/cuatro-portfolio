---
title: 'Install Playwright and establish the rendered-output harness'
type: 'feature'
created: '2026-08-24'
status: 'in-progress'
baseline_commit: '4f4c751092ade52d649841ff0cd5625f680040b6'
baseline_revision: '4f4c751092ade52d649841ff0cd5625f680040b6'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/.github/workflows/ci.yml'
warnings: ['oversized']
deferred: []
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
  `corepack pnpm test --run` is executed, then it reports the same 38 tests passing and starts no
  browser.

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

**The finding Story 1.18 needs.** The AC calls the alias check a `font-weight` read. On three of the
four call sites that read would prove nothing: `font-weight` computes to `400` there both before and
after a bad alias, because the weight lives in the family name (`_fonts.scss:91-99`) rather than in a
declaration. Only `glitch-text.scss:7` sets `700` explicitly. The harness therefore exposes a
generic "computed value of a named property" helper, and this spec records that the property to name
at those call sites is `font-family`. Story 1.18 inherits the finding rather than rediscovering it
after a green run that proved nothing.

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
- `corepack pnpm test --run` -- expected: 38 tests pass, no browser started, no Playwright file
  collected.
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
</content>
