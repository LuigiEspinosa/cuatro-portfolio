# Rendered-output harness

The written record of the instrument Story 1-10 installed: what a machine can now assert about
what the Hub actually renders, what it deliberately cannot assert yet, what the assertions cost
to run, and what "visually identical" means as a number rather than as an opinion.

Written during Story 1-10 on **2026-08-24** (ISO 8601 UTC), against baseline commit
`4f4c751`.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/estate.md`, `ops/monitoring.md`, `ops/routing-inventory.md`,
`ops/bot-mitigation.md` and `ops/known-violations.md` set: every value is marked as either a
decision or an observation, and the two are never presented as the same kind of fact (NFR-9).
An observed value also carries the method that gathered it, because a number without a method
is a claim.

**Story ids are written hyphenated**, as `Story 1-10` and `Story 1-18`, matching the keys in
`_bmad-output/implementation-artifacts/sprint-status.yaml`. `epics.md` writes the same ids
dotted. They are the same stories.

## What the harness asserts

`tests/e2e/harness.ts` exposes exactly three capabilities. Stories 1.12, 1.17, 1.18 and 1.19
import that file rather than reaching for Playwright directly, so the viewport, the browser and
the failure behaviour are settled in one place.

| Capability | Helper | What it answers | Nature |
|---|---|---|---|
| Route screenshot | `expectRouteScreenshot` | Did this route's render change beyond the stated tolerance | **Decision.** Scope set by Story 1-10 |
| Computed property on a selector | `computedStyleValue` | What value does a named CSS property resolve to on a named selector, in a real browser | **Decision.** Same |
| Custom property on `:root` | `rootCustomPropertyValue` | What value does a named custom property resolve to on `:root` | **Decision.** Same |

`tests/e2e/rendered-output.pw.ts` runs one test per capability against `/work`, four tests that
prove the loud-failure behaviour below, and a guard that the run exercised all three
capabilities rather than passing over an empty selection. Eight tests, all green, in roughly
16 seconds of test time.

**Why `/work`.** **Decision.** It is the only route that combines a `--monument-bold` call site
(`.work-hero__heading`, `components/organisms/WorkHero/WorkHero.scss:19`), the `body#work` grid
background keyed off `<body id={route}>` (`app/app.scss:53-60`,
`components/atoms/Container/Container.tsx:12-16`), and server-rendered content whose GSAP
entrance tweens already sit behind `if (!reduceMotion)`. A screenshot of `/work` therefore
covers three separate mechanisms at once.

**Why the torus is masked.** **Decision.** `components/molecules/TorusCanvas/TorusCanvas.tsx` is
WebGL driven by `useFrame` and can never be stable between two captures. The harness masks
`.work-hero__canvas-wrap` rather than waiting for it. Masking is honest about what is not being
measured. Adding a test hook to the application to freeze the canvas would change the thing
being measured, which Story 1-10's boundaries forbid.

## What it deliberately does not assert yet

Naming these here is the point of the section: a harness that exists is easily mistaken for a
harness that covers everything.

| Not asserted | Why not | Owner |
|---|---|---|
| The 44x44 hit-target floor | Needs a Suite Directory that does not exist | **Decision.** Story 2.8 |
| The Status mark's three structural axes | Same | **Decision.** Story 2.10 |
| Any `--token-*` name or anything under `contracts/` | This story ships the instrument, not the contract. `contracts/` does not exist yet | **Decision.** Stories 1.11 through 1.14 |
| Colour contrast ratios | No token roles to compute them against yet | **Decision.** Epic 1 token stories |
| Any route other than `/work` | One route is enough to establish the instrument. Adding routes is cheap once the instrument exists | **Decision.** Story 1-10 scope |
| Accessibility | Unchanged and untouched. `.lighthouserc.js` still asserts accessibility at 0.95, severity error, and `.github/workflows/lighthouse.yml` still runs it. Story 1-10 modified neither, and `git diff --stat 4f4c751` over both files plus `deploy.yml` was empty | **Observed 2026-08-24**, by running that diff |

## The tolerance

**The rule, stated before the number.** **Decision.** Playwright's per-pixel `threshold` stays
at its default, so `maxDiffPixelRatio` is the only knob and it is written down here.
`maxDiffPixelRatio` is then set so the shift probe's measured ratio clears it by at least five
times. If the smallest shift Story 1.17 would care about does not clear it by a wide margin,
the tolerance is wrong and gets lowered, rather than the probe being made louder.

| Value | Number | Nature |
|---|---|---|
| Viewport | 360 x 800, `deviceScaleFactor: 1` | **Decision.** `playwright.config.ts`, exported as `RENDERED_VIEWPORT` so a spec cannot re-declare it and drift from the baseline |
| Total pixels compared | 288,000 | **Derived** from the viewport |
| Per-pixel `threshold` | Playwright default (0.2, YIQ colour space) | **Decision.** Left alone deliberately, so there is one number to reason about rather than two |
| `maxDiffPixelRatio` | **0.001** | **Decision.** Equivalent to 288 differing pixels out of 288,000 |
| Shift probe measured ratio | **0.007274** (2,095 pixels of 288,000) | **Observed 2026-08-24**, by adding `transform: translateX(1px)` to `.work-hero__heading` and running the harness in the pinned container. Playwright's own report rounds this to "ratio 0.01"; 0.007274 is 2095 divided by 288000 |
| Margin | **7.27 times** the tolerance | **Derived**: 2,095 divided by 288 |

**Why 0.001 and not smaller.** **Decision.** Both sides of the comparison are pinned to one
container image, so an unchanged render is essentially byte-identical and the honest floor would
be zero. 0.001 is deliberately a little above that floor: it absorbs a handful of stray pixels
from a font-rasterization or compositing detail without absorbing anything a human would see.
The 7.27 times margin is what makes that claim checkable rather than asserted. If a future
change to `/work` makes an unchanged render produce more than a few dozen differing pixels, the
answer is to find out why, not to raise this number.

**Why 0.001 and not larger.** **Decision.** Story 1.17 adds the token contract and changes
nothing visible, and Story 1.20 turns on whether a render changed. A tolerance loose enough to
absorb a one-pixel shift would let exactly the regression those stories exist to catch through.

## What provisioning the browser costs

C-7 (`ARCHITECTURE-SPINE.md:433`) records browser provisioning as a real setup cost never paid,
so this section pays it in writing.

**The mechanism is an image pull, not a browser download.** **Decision.** The CI job runs inside
`mcr.microsoft.com/playwright:v1.62.1-noble`, which ships the browsers already built for the
`@playwright/test` version it is tagged with. There is no `playwright install` step in
`.github/workflows/ci.yml`, and there must not be one: a download step would reintroduce the
version drift the pinning exists to prevent.

| Figure | Value | Nature |
|---|---|---|
| Image | `mcr.microsoft.com/playwright:v1.62.1-noble` | **Decision.** Pinned to the exact `@playwright/test` version in `package.json` |
| Index digest | `sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e` | **Observed 2026-08-24**, by `docker pull` then `docker image inspect` |
| linux/amd64 manifest digest | `sha256:c091b21d9fae78c76e85cd4356431e9b018402f172a214fc7d7a5e9a7e29d8ac` | **Observed 2026-08-24**, by `docker manifest inspect` on the index |
| Download size, linux/amd64 | **949,411,114 bytes (905 MiB) across 7 layers** | **Observed 2026-08-24**, by summing the `size` field of every layer in the amd64 manifest. This is the figure a GitHub-hosted runner transfers, and it is the harder of the two provisioning numbers because it does not depend on whose network measured it |
| Pull wall time on this host | **50.9 s** | **Observed 2026-08-24** on the Windows 11 development host, Docker server 29.7.2, by `docker rmi` on the tag followed by a timed `docker pull`. **Read this as an upper-bound-shaped local figure, not as the CI figure.** `docker rmi` untags and deletes the image but does not guarantee every layer left the local content store, and this host's network is not the runner's. The CI number is unknown until the first real run, which is Pending Operator action 1 below |
| Node in the image | v24.18.1 | **Observed 2026-08-24**, by `node -v` inside the container. Note that the existing `test` job pins Node 22 through `setup-node`; the container job takes the image's Node instead, which is the version the pinned browsers were built against |
| Harness run, cold `.next` | **27.8 s wall** for `pnpm build`, `pnpm start` and all six tests | **Observed 2026-08-24**, by emptying the container's `.next` volume and timing one `docker run` of `pnpm test:e2e`. Playwright reported 24.1 s of that as test time |
| Harness run, warm `.next` | **24.3 s wall**, 21.5 s reported as test time | **Observed 2026-08-24**, same method without emptying the volume |

**What these numbers do not include.** `pnpm install --frozen-lockfile` inside the container took
**4 m 33 s** on this host (**observed 2026-08-24**), but that figure is dominated by pnpm writing
its store onto a bind-mounted Windows filesystem and says nothing about CI, where the store is on
the runner's own disk. It is recorded only so a later reader does not mistake its absence for an
omission.

## Regenerating the baseline

The committed baseline is `tests/e2e/rendered-output.pw.ts-snapshots/work-360x800-chromium-linux.png`.

**It must be generated inside `mcr.microsoft.com/playwright:v1.62.1-noble`.** **Decision.**
Playwright names a snapshot per platform, so a baseline made on the Windows host would be
`-win32.png` and CI would fail on a missing `-linux.png`. Even forcing the name, the render
would differ: `--font-mono: 'Courier New', monospace` (`app/app.scss:31`) has no Courier New on
Linux, and glyph rasterization is not portable. Pinning both sides to one image is what makes
the tolerance a real number rather than a fudge factor.

The command used on 2026-08-24, from the repository root on the Windows host:

```
docker run --rm --ipc=host ^
  -v C:/CuatroEcosystem/cuatro-portfolio:/w ^
  -v pw-node-modules:/w/node_modules ^
  -v pw-next:/w/.next ^
  -w /w -e CI=1 ^
  mcr.microsoft.com/playwright:v1.62.1-noble ^
  bash -lc "corepack enable && pnpm install --frozen-lockfile && pnpm run test:e2e:update"
```

The two named volumes matter. `node_modules` and `.next` on the Windows host hold Windows
binaries (`sharp`, `@next/swc`), which a Linux container cannot execute, so both are masked with
container-local volumes rather than read through the bind mount. `corepack enable` is needed
because Playwright's `webServer` command calls `pnpm` by name and only `corepack` is on the
image's PATH; on a GitHub runner `pnpm/action-setup@v4` does that job instead.

**When regenerating is legitimate.** **Decision.** Exactly three cases:

1. A story deliberately changed how `/work` renders, and the new render is the intended one. The
   regenerated PNG is part of that story's diff and is reviewed as a change, not as noise.
2. The pinned Playwright version moved. The `package.json` pin, the image tag in
   `.github/workflows/ci.yml` and the baseline are one change, made together.
3. The route, viewport or mask in `tests/e2e/rendered-output.pw.ts` changed on purpose.

**When it is not.** A red screenshot test on a story that did not intend a visual change is a
finding, not a baseline to refresh. Regenerating to get a build green is the failure mode this
whole file exists to make visible, and it is why the baseline is never written as a side effect:
`playwright.config.ts` sets `updateSnapshots: 'none'`, so a missing or mismatched baseline fails
the run and writes nothing. Updating is the explicit `pnpm test:e2e:update` invocation and
nothing else.

**Observed 2026-08-24**, by renaming the committed PNG aside and running the harness: the run
failed with `A snapshot doesn't exist at /w/tests/e2e/rendered-output.pw.ts-snapshots/work-360x800-chromium-linux.png.`
and the snapshot directory was still empty afterwards.

## The two probe demonstrations

A gate never observed to fail is not known to work. Each probe was applied, run, its output
recorded here, and reverted. **Neither probe exists in the tree at this story's closing commit**,
which is why their output lives in this file.

**A probe is a one-time demonstration; the standing tests are something else.** **Decision.** A
demonstration recorded in a file proves the gate could fail on 2026-08-24. It proves nothing
about the run after someone raises `maxDiffPixelRatio`, sets `updateSnapshots` to `all`, or
widens the mask until nothing is compared. So the two screenshot failure paths are also asserted
permanently, by `fails when the render is shifted past the tolerance` and `fails naming the
baseline when none is committed` in `tests/e2e/rendered-output.pw.ts`. Both keep the suite green:
they assert that the comparison rejects, rather than being a broken assertion left behind. The
shift they use is injected into one page through `addStyleTag` and touches no file, which is what
separates them from Probe 1's edit to `WorkHero.scss`.

### Probe 1: a deliberately shifted render

| Field | Value | Nature |
|---|---|---|
| The probe | `transform: translateX(1px)` added to `&__heading` in `components/organisms/WorkHero/WorkHero.scss` | **Decision.** One pixel, because one pixel is the smallest shift Story 1.17 would care about. A larger probe would prove less |
| Result | The screenshot test failed | **Observed 2026-08-24** in the pinned container |
| Measured difference | 2,095 pixels, ratio 0.007274 of 288,000 | **Observed**, from Playwright's failure output |
| Artifacts written | `work-360x800-expected.png`, `work-360x800-actual.png`, `work-360x800-diff.png` and `trace.zip` under `test-results/` | **Observed.** The CI job uploads `playwright-report/` on failure, so a red run on a pull request carries its diff image |
| Reverted | Yes, by `git checkout -- components/organisms/WorkHero/WorkHero.scss` | **Observed**, confirmed by `git status --porcelain` |

Playwright's own line, quoted:

```
Error: expect(page).toHaveScreenshot(expected) failed

  2095 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: work-360x800.png
```

### Probe 2: a deliberately wrong expected value

| Field | Value | Nature |
|---|---|---|
| The probe | The expected computed `font-family` on `.work-hero__heading` changed from `MonumentExtended-Bold` to `MonumentExtended-Regular` in `tests/e2e/rendered-output.pw.ts` | **Decision.** The wrong value is the other real family in the same token block, not a nonsense string, so the probe tests the read rather than the string comparison |
| Result | The computed-style test failed | **Observed 2026-08-24** in the pinned container |
| Reverted | Yes | **Observed**, confirmed by the final green run of all six tests |

Playwright's own line, quoted:

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "MonumentExtended-Regular"
Received: "MonumentExtended-Bold"
```

## Failing loudly rather than vacuously

`getPropertyValue` answers an undeclared custom property with an empty string. A helper that
returned that string would pass any equality check against another empty string, and a gate that
passes over nothing is worse than no gate. Both reads therefore throw, naming what was missing.
This is asserted by two permanent tests, not by a probe.

| Case | Behaviour | Nature |
|---|---|---|
| A render differs past the tolerance | The comparison rejects, and Playwright's message carries the differing pixel count and ratio | **Observed 2026-08-24.** `tests/e2e/rendered-output.pw.ts`, "fails when the render is shifted past the tolerance", which injects a one-pixel shift through `addStyleTag` and asserts the rejection |
| No baseline is committed for the name asked for | The comparison rejects naming the exact path it looked for, and writes nothing | **Observed 2026-08-24.** Same file, "fails naming the baseline when none is committed". The snapshot directory held only `work-360x800-chromium-linux.png` after the run |
| Selector matches nothing | Throws naming the selector and the URL it was looked for on | **Observed 2026-08-24.** `tests/e2e/rendered-output.pw.ts`, "fails naming the selector when nothing matches it" |
| Custom property not declared on `:root` | Throws naming the property | **Observed 2026-08-24.** Same file, "fails naming the custom property when it is not declared" |
| Property resolves to an empty string | Throws naming the property, because an empty string is what an unknown property name yields | **Decision.** `tests/e2e/harness.ts` |
| Route answers a non-2xx status | Throws naming the route and the status, rather than photographing an error page | **Decision.** Same file |
| The run matched no tests | Playwright exits non-zero by default and no `--pass-with-no-tests` flag is passed anywhere | **Observed 2026-08-24**, by reading `playwright test --help` in the pinned image |
| The run matched some but not all capability tests | The last test in the file fails, because each capability test records itself and that test asserts all three were recorded | **Decision.** Note that Playwright restarts its worker after any failure, which resets that ledger, so this guard also fails on a run that was already failing. That is redundant noise on a red run, not a hole: the guard can only pass when all three capability tests ran and passed |

## The finding Story 1-18 inherits

**The property to read at the `--monument-bold` call sites is `font-family`, not `font-weight`.**
**Observed 2026-08-24**, by reading the four call sites and `app/scss/_fonts.scss:91-99`.

Story 1.18's acceptance criteria describe the alias check as a `font-weight` read. On three of
the four call sites that read would prove nothing. `WorkHero.scss:19`, `ProjectsHero.scss:19` and
`error-page.scss:24` set the family alone, so their computed `font-weight` is `400` today and
would still be `400` after an alias silently dropped bold. The weight lives in the family name,
declared by the `@font-face` block at `app/scss/_fonts.scss:91-99`. Only `glitch-text.scss:7`
sets `font-weight: 700` itself.

The harness therefore exposes a generic "computed value of a named property" helper rather than
a font-weight helper, and Story 1.18 names `font-family` at those call sites.

Two shapes of the same name come back, and both are asserted so neither surprises a later story.
**Observed 2026-08-24** in the pinned container:

| Read | Value returned | Why |
|---|---|---|
| Computed `font-family` on `.work-hero__heading` | `MonumentExtended-Bold` | Chromium serialises a family name that is a valid identifier sequence without quotes |
| Computed `--monument-bold` on `:root` | `"MonumentExtended-Bold"` | A custom property carries its declared token stream through untouched, and Sass normalises the single quotes at `app/app.scss:29` to double quotes on the way out |

## The CI job

`.github/workflows/ci.yml` gained one job, `rendered-output`. The existing `test` job was not
modified.

| Property | Value | Nature |
|---|---|---|
| Blocking | Yes. No `continue-on-error`, no `|| true`, no soft-fail, no `--pass-with-no-tests` | **Decision.** AD-21, and `AGENTS.md` under "Policy" |
| Triggers | `push` to `**` and `pull_request` to `main` | **Observed 2026-08-24.** The job sits in the existing file and inherits that file's `on:` block at `:3-7` rather than declaring its own, so the two can never drift |
| Runner | `ubuntu-latest` with `container: mcr.microsoft.com/playwright:v1.62.1-noble` | **Decision** |
| On failure | Uploads `playwright-report/` for 7 days | **Decision.** A red screenshot gate is unreadable without its diff image |

**Vitest never sees a Playwright spec.** Two independent guards, because one would be a single
point of failure. The specs are named `*.pw.ts`, which Vitest's default include globs
(`**/*.{test,spec}.?(c|m)[jt]s?(x)`) do not match, and `vitest.config.ts` additionally excludes
`tests/e2e/**` while spreading `configDefaults.exclude` back in so the guard cannot itself drop
`node_modules`. **Observed 2026-08-24**, by `pnpm exec vitest list` with and without the exclude:
215 tests collected either way, and no `tests/e2e` file in either listing.

## Pending Operator actions

This file hands the Operator work it cannot do from a development host. They are tracked here
rather than left in prose, in the shape `ops/known-violations.md` and `ops/capacity-measurement.md`
use.

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Record the first real CI timing of the `rendered-output` job**: image pull, install, and the harness step, from the Actions run summary | Operator | The provisioning figures above are a local host's, and say so. The CI figure is the one C-7 actually asks for, and it cannot be observed until this job runs on a runner. Replace the "Pull wall time on this host" row with a CI row when it is, keeping the local row and its method rather than overwriting it | _not done_ |
| 2 | **Confirm the container job's Node version is acceptable**, or pin it | Operator | The `test` job pins Node 22 through `setup-node`. The `rendered-output` job takes the image's Node, observed as v24.18.1, because that is the runtime the pinned browsers were built against. Two Node versions in one workflow is a deliberate consequence of pinning the image, and it is recorded rather than hidden | _not done_ |

**Maintaining this file.** When an action is performed, replace its `_not done_` cell with the
ISO 8601 UTC completion date and leave the row in place. When a figure is re-measured, add the
new row with its own date and method and keep the old one, so a later reader can see whether a
number moved or was simply re-stated. Deletion is not used here.

**When the Playwright version moves.** Four things change together and a change to fewer than
all four is a defect: the `@playwright/test` pin in `package.json`, the `container.image` tag in
`.github/workflows/ci.yml`, the committed baseline PNG, and the figures in this file. The pin is
exact (`"1.62.1"`, no caret, unlike every neighbouring range) precisely so that this stays a
deliberate act rather than something a lockfile refresh can do quietly.
