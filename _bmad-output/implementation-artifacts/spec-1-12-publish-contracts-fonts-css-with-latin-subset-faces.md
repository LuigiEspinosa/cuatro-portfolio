---
title: 'Publish `contracts/fonts.css` with latin-subset faces'
type: 'feature'
created: '2026-08-25'
status: 'done'
baseline_commit: '7545cd6a8258d509c8ced98c7a8cc4332e7f9341'
baseline_revision: '7545cd6a8258d509c8ced98c7a8cc4332e7f9341'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-11-publish-contracts-tokens-css-from-packages-tokens.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** `contracts/tokens.css` names three families and deliberately carries no `@font-face`,
and its header points at `fonts.css` in the same folder. That file does not exist, so a repository
that vendors `contracts/` today follows a dangling pointer and every family falls back to
`system-ui`. Stories 1.13, 1.16, 1.17, 1.19 and 2.20 all consume it, and the type system is the
half of the contract a Visitor can actually see.

**Approach:** Prepare latin-subset variable woff2 faces for Bricolage Grotesque, Geist and Geist
Mono into `contracts/fonts/` with their OFL licence text, generate `contracts/fonts.css` from a new
`packages/fonts` generator with `url()` paths relative to the stylesheet, `font-display: swap` and
metric overrides derived from measured fallback metrics, assert the published file and the asset
budget inside the already-blocking unit suite, verify depth-independent resolution and the absence
of a layout shift across the swap through Story 1-10's harness in the pinned container, add one
blocking drift job, demonstrate both new gates failing against planted probes, and record the whole
thing in `ops/font-contract.md`.

## Boundaries & Constraints

**Always:**
- `contracts/` is data. Nothing under it matches `\.(ts|js|tsx|jsx|mjs|cjs)$`, and every generator
  file sits under `packages/fonts` and is never published (AD-1).
- Every `url()` in `contracts/fonts.css` is relative to the stylesheet itself (`./fonts/...`).
  Never a leading slash, never a scheme, never a bare filename that assumes a document root.
- The three `@font-face` family names equal the first family in `contracts/tokens.css`'s
  `--f-display`, `--f-body` and `--f-mono` byte for byte: `Bricolage Grotesque`, `Geist`,
  `Geist Mono`.
- The header carries `Contract v1.0.0`, read from `packages/tokens/package.json` and validated as
  exact `X.Y.Z`, because AD-16 has a scheduled job read that line across seven repositories.
  Publishing `fonts.css` bumps nothing; see Design Notes.
- UX-DR7's budget binds: the three published woff2 files total **at or below 120 KB**. The figure is
  measured per file and in total, as bytes on disk and gzipped, and both are recorded with the
  method.
- The OFL requires the licence and copyright notice to travel with the binaries, so each family's
  licence text ships beside its face under `contracts/fonts/`.
- The new CI job is blocking (AD-21): no `continue-on-error`, no `|| true`, no soft-fail. It sits in
  `.github/workflows/ci.yml` and inherits that file's own `on:` block rather than declaring one.
- A new gate is demonstrated failing once against a planted probe, the probe is removed in the same
  story, and its output lives in the `ops/` record rather than in the tree.
- Every recorded number is marked observation or decision and carries its method (NFR-9). Dates are
  ISO 8601 UTC.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash and no
  emoji. The commit is a subject line only, no body and no trailer.

**Block If:**
- The three faces cannot reach the 120 KB budget without dropping a family, dropping latin coverage,
  or pinning a second variable axis beyond the recorded `opsz` pin. Widening the budget is not this
  story's call.
- An upstream family turns out not to be OFL-licensed at the pinned revision, so the binaries cannot
  be redistributed into seven repositories.
- The only way to make the swap check or the drift check pass is to weaken an existing gate, raise
  `maxDiffPixelRatio`, or regenerate the committed rendered-output baseline.

**Never:**
- Never create `contracts/tailwind.css` or `contracts/registry.json`, and never write a `@theme`
  block. Those are Stories 1.13 and 2.5.
- Never edit `contracts/tokens.css`, `packages/tokens/build.mjs`, `packages/tokens/package.json` or
  `packages/tokens/tokens/*.json`. The single permitted edit inside `packages/tokens` is the pinned
  published-file list in `__tests__/tokens-contract.test.ts:883`, which this story necessarily
  widens, and nothing else in that file.
- Never edit `app/app.scss`, `app/scss/_fonts.scss`, any component stylesheet, or anything under
  `public/fonts/`. Publishing the contract is not adopting it: the Hub's render must not change, and
  retiring the old binaries is Story 2.20.
- Never edit `.lighthouserc.js`, `.github/workflows/lighthouse.yml` or
  `.github/workflows/deploy.yml`, and never edit the `test`, `tokens-contract` or `rendered-output`
  jobs in `.github/workflows/ci.yml`.
- Never regenerate `tests/e2e/rendered-output.pw.ts-snapshots/work-360x800-chromium-linux.png`.
  Nothing here changes what `/work` renders, so a red screenshot test is a finding.
- Never hand-edit `contracts/fonts.css` or any file under `contracts/fonts/`.
- Never edit `epics.md`, `DESIGN.md`, or the `bmad:context` block in `AGENTS.md`. A wording defect
  found in a planning artifact is recorded as a Pending Operator action, not corrected here.
- Never add a dependency to the root manifest for the generator. It uses Node builtins only.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Build from source | `faces.json` and `fallback-metrics.json` unchanged | `contracts/fonts.css` rewritten byte-identically, twice in a row | No error expected |
| Input edited, output stale | A metric edited, no rebuild | The `fonts-contract` CI job fails printing the diff | Non-zero exit |
| A face binary changes | A woff2 replaced without rerunning prepare | The contract test fails naming the file and both sha256 values | Size alone never decides it |
| A face named in the CSS is absent | `contracts/fonts/x.woff2` deleted | The generator refuses before writing, naming the missing file | Nothing published |
| A family missing from either input | `fallback-metrics.json` lacks `Geist Mono` | The generator refuses naming the family and the input file | Never emits a face with no overrides |
| A rooted or absolute `url()` | `src: url("/fonts/x.woff2")` reaches the emitter | The generator refuses naming the rule | The published file is the one thing a vendored folder depends on |
| Vendored at depth | `contracts/` copied to `a/b/c/cuatro-contracts/` | All three woff2 answer HTTP 200 and `document.fonts.check` is true per family | A 404 fails naming the family and the request URL |
| Swap without overrides | A probe stylesheet with the overrides stripped | The layout comparison fails naming the sample block and the delta | Tolerance is a recorded number, not an opinion |
| Budget exceeded | Published total above 120 KB | The contract test fails printing every file's bytes and the total | Never rounded down to pass |
| Header version drift | Header and `packages/tokens/package.json` disagree | The contract test fails naming both values | AD-16 reads that header estate-wide |

</intent-contract>

## Code Map

Gathered 2026-08-25 against `7545cd6`, working tree clean.

- `contracts/tokens.css:1-7` -- the published header this file's header mirrors, and `:3` is the
  dangling pointer this story closes. `:41-43` are the three `--f-*` stacks: the family names and the
  fallback chains both come from here, not from `DESIGN.md`, because this is the published artefact.
- `_bmad-output/planning-artifacts/epics.md:1590-1623` -- Story 1.12's four acceptance criteria.
  `:462` and `:695-701` are UX-DR7 and UX-DR49, the 120 KB font budget inside a 140 KB non-3D path.
- `_bmad-output/.../DESIGN.md:445-459` -- the three families, their licence and the axes the design
  uses (`wdth` 75 to 100, `opsz` 10 to 48, `wght` 700 to 800 for Bricolage; `wght` 300 to 600 for
  Geist; `wght` 400 for Geist Mono). `:498-499` is the `font-display: swap` plus overrides rule.
  `:811-822` is why `@font-face` may not live in `tokens.css`. `:1028-1045` is the versioning rule.
- `_bmad-output/.../RESTYLE-SPEC.md:648` -- **F-2, and it settles how the face check is written.**
  `getComputedStyle().fontFamily` returns the declared stack and passes identically when every woff2
  has 404'd. `document.fonts.check()` per family, or the network response, is the check.
- `packages/tokens/build.mjs:30-69` -- the generator shape to follow: repository-root resolution, the
  two scratch build inputs with their defaults, the printed resolved paths, and the `X.Y.Z` version
  guard. `:140-164` is the CSS-delimiter refusal on a published value.
- `packages/tokens/__tests__/tokens-contract.test.ts:881-887` -- **the one line this story must
  widen.** It pins the published set to exactly `['contracts/tokens.css']`. `:289` is the
  `EXECUTABLE` pattern, `:291-315` the directory walk to reuse the shape of.
- `docker/__tests__/deps-stage.test.ts:66-77` and `:250-255` -- a directory under `packages/` with no
  `package.json` is not a workspace package, and the pinned list is exactly `['packages/tokens']`.
  Verified 2026-08-25: `corepack pnpm install --frozen-lockfile` with a manifest-less
  `packages/fonts` present reports "all 2 workspace projects" and "Lockfile is up to date". This is
  why the generator ships without a manifest and `docker/Dockerfile` is not touched.
- `tests/e2e/harness.ts:11` and `:119-154` -- `RENDERED_VIEWPORT` and `computedStyleValue`, the two
  helpers this story imports. `:24` names Story 1.12 as a caller. The helpers take a `Page` and do
  not assume `baseURL`, so they work against a fixture served by the test's own server.
- `playwright.config.ts:32-93` -- one chromium project, `workers: 1`, `updateSnapshots: 'none'`,
  `reducedMotion: 'reduce'`, and a `webServer` that builds and starts the Hub for every spec in
  `tests/e2e`. A new `*.pw.ts` file is collected automatically and pays that build once.
- `.github/workflows/ci.yml:31-88` -- the `tokens-contract` job, which is the exact shape the new
  `fonts-contract` job follows, including the empty-pinned build inputs at `:62-64` and the
  `git status --porcelain --ignored=matching -- contracts/` check at `:78-88`. That check already
  covers a new file appearing under `contracts/`, so it will see a stale `fonts.css` too.
- `.gitattributes:19-33` -- LF is pinned by format, `contracts/**/*.css` and `contracts/**/*.json`,
  precisely so a `.woff2` is left alone. `.txt` is not listed yet.
- `ops/token-contract.md` and `ops/rendered-output-harness.md` -- the record shape: a provenance line
  with the story and the ISO date, tables with a `Nature` column, probe output quoted verbatim, a
  "Maintaining this file" section and a "Pending Operator actions" table.
- `AGENTS.md:55-57` -- **stale and known to be.** It says Playwright is not installed and that no
  acceptance criterion may claim a browser check. Story 1-10 installed it; `ops/rendered-output-harness.md`
  Pending Operator action 3 already owns the correction. Do not act on that line, and do not edit the
  block.
- Environment checked 2026-08-25 on this host: `uv` at `C:\Users\NumCuatro\.local\bin\uv.exe`, Node
  v24.15.0, Docker server 29.7.2 (from `ops/rendered-output-harness.md:118`), network reachable to
  `raw.githubusercontent.com`. The subsetting spike below ran here.

## Tasks & Acceptance

**Execution:**
- `packages/fonts/sources.json` -- new. One entry per family: upstream repository, the **commit-pinned**
  raw URL for the variable TTF and for `OFL.txt`, the sha256 of each, and the download date. A branch
  URL rots; a commit URL does not.
- `packages/fonts/sources/*.ttf` and `packages/fonts/sources/OFL-*.txt` -- new, committed. The three
  upstream variable fonts (roughly 750 KB in total) and their licences. Committed because the
  subsetting step is deliberately not run in CI, so the only way a later maintainer can reproduce or
  re-subset the contract is to hold the exact input.
- `packages/fonts/subset.py` -- new. Run through `uv run --with "fonttools[woff]==4.60.1"`. Verifies
  each source against `sources.json`, runs `varLib.instancer` with the pinned axis limits, then
  `pyftsubset` with the pinned unicode range and feature list, writes the three woff2 files into
  `contracts/fonts/`, copies the licence text beside them, and writes `packages/fonts/faces.json`:
  per face the file name, sha256, byte size, gzipped size, units per em, the surviving axis ranges,
  the unicode range, and the vertical metrics. Refuses on a source hash mismatch, on an empty glyph
  set, and on an output that would exceed the budget.
- `packages/fonts/prepare.mjs` -- new. The one entry point a human runs: shells out to the pinned
  `uv` command above and prints the per-file and total figures it produced.
- `packages/fonts/measure.mjs` -- new. Run inside `mcr.microsoft.com/playwright:v1.62.1-noble`.
  Loads the prepared faces through a bare `@font-face` carrying no overrides, and measures, in
  Chromium and at one pinned pixel size, `fontBoundingBoxAscent`, `fontBoundingBoxDescent` and the
  advance of one pinned sample string, for each published face and for the remainder of each `--f-*`
  stack with the contract family removed. Writes `packages/fonts/fallback-metrics.json` with its
  provenance: image tag, image digest, date, sample string, pixel size.
- `packages/fonts/build.mjs` -- new. Emits `contracts/fonts.css` from `faces.json`,
  `fallback-metrics.json` and the version in `packages/tokens/package.json`. Pure arithmetic and a
  template, so a rebuild is deterministic on any host. Honours `CUATRO_FONTS_SOURCE` and
  `CUATRO_FONTS_OUTPUT` for scratch runs, prints both resolved paths before building, and refuses
  every row of the I/O matrix that names the generator.
- `package.json` -- add `fonts:prepare`, `fonts:measure` and `fonts:build`. Leave every existing
  script untouched, including the dead `linkg`.
- `contracts/fonts.css`, `contracts/fonts/*.woff2`, `contracts/fonts/OFL-*.txt` -- the generated and
  committed published surface. Never hand-edited.
- `packages/fonts/__tests__/fonts-contract.test.ts` -- new. Asserts the published file against every
  I/O matrix row, the family names against `contracts/tokens.css`, the header version, the budget
  with its printed figures, LF endings with one trailing newline, the exact published file set, the
  absence of any executable extension under `contracts/`, and one standing case per generator
  refusal run against a corrupted copy of the inputs.
- `packages/tokens/__tests__/tokens-contract.test.ts` -- widen the pinned published-file list at
  `:883` to the new exact set, and nothing else in the file.
- `tests/e2e/contract-fonts.pw.ts` -- new. Serves a scratch tree from a `node:http` server on an
  ephemeral port with `contracts/` copied to a deliberately deep path under the vendored folder name
  `cuatro-contracts/`, and runs three checks: the faces resolve at that depth (network status plus
  `document.fonts.check`), the fallback-to-face swap moves no sample block beyond the recorded
  tolerance, and the same comparison against a probe stylesheet with the overrides stripped fails.
  Imports `RENDERED_VIEWPORT` and `computedStyleValue` from `./harness`.
- `.gitattributes` -- add `contracts/**/*.txt text eol=lf` beside the two existing rules, so the
  licence files are covered by the same by-format reasoning. Change nothing else.
- `.github/workflows/ci.yml` -- add a `fonts-contract` job modelled on `tokens-contract`: install,
  `pnpm fonts:build` with both build inputs pinned empty, then fail if anything under `contracts/`
  changed or appeared. Do not touch the three existing jobs.
- `ops/font-contract.md` -- new record: what the type contract publishes, the licence position, the
  subsetting decisions with the measured cost table that forced the `opsz` pin, the metric-override
  method and its formula, the budget figures with their method, how the faces and the file are
  regenerated, the drift gate and the swap gate with their probe output, the stated limits, and the
  Pending Operator actions.
- `ops/rendered-output-harness.md` -- amend the one row that says nothing under `contracts/` is
  asserted yet, and name the second spec file. Leave every figure and every other row intact.

**Acceptance Criteria:**
- Given three open-licence variable families, when the faces are prepared, then each published face
  is subset to latin only, all three woff2 files sit in `contracts/fonts/` with their OFL licence
  text beside them, and the measured total is at or below 120 KB, recorded per file and in total as
  bytes on disk and gzipped, each figure carrying its method.
- Given a Satellite may vendor the folder to `assets/css/`, `src/styles/` or `src/`, when
  `contracts/` is copied to a nested scratch path and a page loads `fonts.css` from it, then every
  woff2 request answers HTTP 200, `document.fonts.check` reports each of the three families
  available, and no `url()` in the published file begins with a slash or a scheme.
- Given a font swap must not shift layout, when each `@font-face` is declared, then it carries
  `font-display: swap` together with `size-adjust`, `ascent-override` and `descent-override` derived
  from the measured metrics of the fallback its own `--f-*` stack resolves to in the pinned image,
  and the fallback-to-face comparison in the harness holds every sample block's height and width
  inside the tolerance recorded in `ops/font-contract.md`.
- Given a gate never observed to fail is not known to work, when the two new gates are verified,
  then the drift job is demonstrated failing against an input edited without a rebuild, the swap
  check is demonstrated failing against faces published without their overrides, both outputs are
  recorded verbatim in `ops/font-contract.md`, and neither probe exists in the tree at the closing
  commit.
- Given AD-1 bars executable code from the published surface, when the story closes, then no file
  under `contracts/` matches `\.(ts|js|tsx|jsx|mjs|cjs)$`, the published set is exactly the list the
  contract test pins, and every generator file sits under `packages/fonts`.
- Given AD-16 makes the header the thing a scheduled job verifies a Satellite against, when
  `fonts.css` is written, then it carries `Contract v1.0.0`, that version equals
  `packages/tokens/package.json`'s, and `contracts/tokens.css` is byte-identical to `7545cd6`.
- Given AD-21 makes every CI gate blocking, when `.github/workflows/ci.yml` is read, then the new
  job carries no `continue-on-error` and no soft-fail, and the diff against `7545cd6` removes no
  line from that file.
- Given publishing the contract is not adopting it, when the story closes, then `app/`,
  `public/fonts/`, `.lighthouserc.js`, `.github/workflows/lighthouse.yml` and
  `.github/workflows/deploy.yml` are byte-identical to `7545cd6`, and the rendered-output harness
  still passes against its committed baseline with that PNG unchanged.
- Given `cuatro.dev` deploys from `main` on every push and the `deps` stage mirrors the workspace by
  hand, when the workspace is checked, then `packages/fonts` carries no `package.json`,
  `corepack pnpm install --frozen-lockfile` still resolves two workspace projects against the
  committed lockfile, and `docker/Dockerfile`, `pnpm-lock.yaml` and `pnpm-workspace.yaml` are
  byte-identical to `7545cd6`. If a manifest proves unavoidable, its `COPY` line in the `deps` stage
  and the pinned list in `docker/__tests__/deps-stage.test.ts:254` move in the same commit.

## Spec Change Log

## Review Triage Log

## Design Notes

**Why publishing `fonts.css` bumps no version.** AD-16 makes an addition a minor bump, and
`DESIGN.md:1036-1038` carves out the case that decides this one: a token present at first
publication is not an addition. `DESIGN.md`'s own `tokens.css` block, which is what v1.0.0 was
generated from, already carries the line "Font files: see fonts.css (same folder)". The design
authored v1.0.0 as a folder of three files, so `fonts.css` is the second instalment of a first
publication rather than an addition to a shipped contract. It therefore reads `Contract v1.0.0`, and
`contracts/tokens.css` is not regenerated. Reading it the other way would republish the tokens file
with a new header in a story whose boundaries forbid touching it.

**The measured cost that forces one axis pin.** Observed 2026-08-25 on this host with fontTools
4.60.1, latin subset, hinting kept, features `kern,liga,calt,ccmp,locl,mark,mkmk,tnum`:

| Bricolage Grotesque variant | woff2 bytes |
|---|---|
| All axes as upstream ships them | 124,408 |
| `wght` 700 to 800, `wdth` 75 to 100, `opsz` 12 to 48 | 107,752 |
| Same, `opsz` 12 to 24 | 82,852 |
| Same, `opsz` pinned at 24 | 58,876 |

Geist at `wght` 300 to 600 is 23,868 and Geist Mono pinned at `wght` 400 is 8,488. Keeping any
`opsz` range puts the three-file total at 132.8 KB or above against a budget of 120 KB, and the
budget is the acceptance criterion. So `opsz` is pinned and the other two axes, which the design
names as identity-bearing, survive: **58,876 plus 23,868 plus 8,488 is 91,232 bytes, 91.2 KB, with
28.8 KB of margin.** The pin value is 24, the geometric midpoint of the 12 to 48 range the design
names as used, chosen because optical-size perception is logarithmic rather than linear. Upstream's
`opsz` floor is 12 and `DESIGN.md:447` says 10, which is a wording defect in the design against its
own font and becomes a Pending Operator action rather than an edit here.

Hinting is kept, unlike the usual web-font practice, because `--no-hinting` saves 10 KB the budget
does not need and dropping it would be a rendering-quality decision this story has no reason to
make. Both figures are recorded.

**Why the swap check is a geometry comparison and not a screenshot.** The acceptance criterion asks
for "a baseline comparison across the swap". A pixel comparison across a font swap fails by
construction: different outlines are different pixels, and that is the intended change. What must
not move is the layout. So the comparison is over element geometry, the same page measured with the
woff2 requests aborted and then allowed, which is exactly what a real visitor experiences under
`font-display: swap`. The committed screenshot baseline is a different instrument, belongs to
`/work`, and is untouched.

**How the three descriptors are derived.** With `swap` the fallback paints first, so the published
face is adjusted to the fallback's metrics rather than the other way round. Measured in one browser,
at one size, over one string, so both sides of every ratio come from the same instrument:

```
sizeAdjust      = fallback.advance / face.advance
ascentOverride  = fallback.ascent  / (pixelSize * sizeAdjust)
descentOverride = fallback.descent / (pixelSize * sizeAdjust)
```

The overrides are divided by the size adjustment because the browser applies them to the
size-adjusted em. The measurement is committed as `fallback-metrics.json` with its provenance rather
than run at build time, so `pnpm fonts:build` stays deterministic arithmetic that a CI runner with
no browser can reproduce; the empirical check in the harness is what catches the measurement going
stale. A stated limit follows and is recorded: the fallback is whatever the pinned Linux image
resolves for each stack, so the overrides are tuned against that face and not against Segoe UI or
SF Pro. `line-gap-override` is emitted only when the measured fallback carries a non-zero line gap,
because omitting it in that case would reintroduce the shift the story exists to remove.

**Why the generator carries no manifest.** `packages/fonts` needs no npm dependency: `build.mjs` is
Node builtins, subsetting is `uv` and fontTools, and measuring borrows the root's `@playwright/test`
through ordinary Node resolution. A `package.json` there would make it a workspace importer, which
changes the lockfile and obliges a new `COPY` line in the Docker `deps` stage. That is the exact
failure `docker/__tests__/deps-stage.test.ts` was written for after Story 1-11's review predicted
this story would trip it. Not creating the manifest is the cheaper way to keep the deploy from
`main` safe, and it was verified rather than assumed.

**Why the licences sit under `contracts/`.** Story 1-11 deferred adding a provenance file to the
published root, and that deferral stands: this story adds no README. The OFL is different in kind.
It permits redistribution only with the copyright and licence notice included, and the binaries are
redistributed by every repository that vendors the folder, so the licence text is part of the
payload rather than a decoration on it.

## Verification

**Commands:**
- `corepack pnpm install --frozen-lockfile` -- expected: resolves against the committed lockfile,
  reports two workspace projects, and `git status --porcelain -- pnpm-lock.yaml` is empty.
- `corepack pnpm fonts:prepare` -- expected: verifies the three source hashes, writes three woff2
  files plus three licence files under `contracts/fonts/`, prints per-file and total bytes, and run
  twice produces byte-identical output (compare sha256 both times).
- `corepack pnpm fonts:build`, run twice -- expected: succeeds, prints both resolved paths, and
  `git status --porcelain --ignored=matching -- contracts/` is empty afterwards.
- `corepack pnpm typecheck` -- expected: pass, with both new test files inside the program.
- `corepack pnpm test --run` -- expected: the 288 tests observed at `064c087` still pass, plus the
  new contract cases, and no browser starts.
- The harness in the pinned container, by the documented `docker run` command in
  `ops/rendered-output-harness.md:154-164` with `test:e2e` in place of `test:e2e:update` -- expected:
  the thirteen existing tests still pass against the unchanged baseline, and the new spec's checks
  pass with their measured deltas printed.
- `corepack pnpm fonts:measure` inside that same container -- expected: writes
  `fallback-metrics.json` naming the resolved fallback and the image digest.
- Probe 1: edit a value in `fallback-metrics.json` and do not rebuild -- expected: the drift check
  fails and prints the offending declaration. Revert.
- Probe 2: build a variant of `fonts.css` with the three descriptors stripped -- expected: the swap
  comparison fails naming the sample block and the observed delta. Revert.
- `git diff --stat 7545cd6 -- app public/fonts .lighthouserc.js .github/workflows/lighthouse.yml .github/workflows/deploy.yml docker contracts/tokens.css pnpm-lock.yaml pnpm-workspace.yaml`
  -- expected: empty output.
- Punctuation sweep over every file written, built on surrogate-pair ranges rather than `\u{...}`
  syntax and run against a positive control carrying all four forbidden forms, so it cannot pass
  vacuously (the trap recorded in `spec-1-5` finding 5 and `spec-1-9` finding 12).

**Manual checks:**
- Read `contracts/fonts.css` and confirm by eye that every `url()` starts `./fonts/`, that the three
  family names match `contracts/tokens.css:41-43`, and that the header version matches
  `packages/tokens/package.json`.
- Open one published woff2 in the browser's font inspector or through `document.fonts` and confirm
  the surviving axes are the ones the record claims, since a wrongly pinned axis is a value no count
  assertion catches.
- Re-read `.github/workflows/ci.yml` after editing and confirm the three existing jobs are untouched
  and the new job's triggers are the file's own.

## Auto Run Result

Status: done

**What was implemented.** The type half of the contract is published. `contracts/fonts.css` v1.0.0
carries three `@font-face` rules whose every `url()` is `./fonts/...`, with `font-display: swap` and
`size-adjust`, `ascent-override`, `descent-override` and `line-gap-override` derived from fallback
metrics measured in the pinned Playwright image. The three latin-subset variable woff2 files sit in
`contracts/fonts/` with their OFL text beside them, at **94,400 bytes on disk and 94,489 gzipped**
against a 120,000 byte budget. The dangling pointer `contracts/tokens.css:3` has carried since Story
1-11 now resolves. Publishing is not adopting: the Hub's render is untouched and its committed
screenshot baseline is unchanged.

**Files changed.**

- `packages/fonts/sources.json` -- commit-pinned upstream provenance for the three families, with a
  sha256 per file, the axis limits, the unicode range, the feature list and the budget.
- `packages/fonts/sources/*.ttf`, `packages/fonts/sources/OFL-*.txt` -- the committed upstream inputs,
  749,520 bytes, so the subsetting step is reproducible without a network.
- `packages/fonts/subset.py` -- verifies every source, instances with the pinned axis limits, subsets
  to latin, writes the three woff2 files and their licences through a staging directory, and writes
  `faces.json`. Refuses on a hash mismatch, an empty glyph set and an over-budget total.
- `packages/fonts/prepare.mjs` -- the one entry point a human runs, pinning
  `fonttools[woff]==4.60.1` through `uv`.
- `packages/fonts/measure.mjs` -- measures each face and the remainder of its own `--f-*` stack in
  Chromium inside the pinned image, and writes `fallback-metrics.json` with its provenance.
- `packages/fonts/build.mjs` -- Node builtins only. Emits the stylesheet from the two committed JSON
  files plus `packages/tokens/package.json`'s version, and refuses every row of the I/O matrix that
  names the generator.
- `contracts/fonts.css`, `contracts/fonts/*` -- the generated, committed published surface.
- `packages/fonts/__tests__/fonts-contract.test.ts` -- 57 cases over the published surface, including
  one standing case per generator refusal run against a corrupted copy of the inputs.
- `packages/tokens/__tests__/tokens-contract.test.ts` -- the pinned published-file list widened to
  the new exact set of eight, and nothing else.
- `tests/e2e/contract-fonts.pw.ts` -- four checks against a scratch tree with `contracts/` vendored
  five directories deep as `cuatro-contracts/`.
- `package.json`, `.gitattributes`, `.github/workflows/ci.yml` -- three scripts, the `.txt` line
  ending rule, and the blocking `fonts-contract` job.
- `ops/font-contract.md` -- the record. `ops/rendered-output-harness.md` -- one amended row.

**Verification performed**, all on 2026-08-25 on the development host:

- `corepack pnpm install --frozen-lockfile` -- "Lockfile is up to date", two workspace projects, 813
  ms. `packages/fonts` carries no manifest, so the lockfile did not move.
- `corepack pnpm typecheck` -- pass.
- `corepack pnpm test --run` -- **379 passed, 20 files, 81.6 s**, 57 of them the new contract file.
- `corepack pnpm fonts:prepare` run twice -- byte-identical output, confirmed by sha256 on all three
  woff2 files. That determinism needed `recalcTimestamp=False`; see the record.
- `corepack pnpm fonts:build` run twice -- `git status --porcelain --ignored=matching -- contracts/`
  shows only the additions this story makes.
- `corepack pnpm fonts:measure` in `mcr.microsoft.com/playwright:v1.62.1-noble` -- wrote
  `fallback-metrics.json` naming the resolved fallback per stack and the image digest.
- `pnpm test:e2e` in that same container -- **17 passed**, the thirteen existing tests against the
  unchanged baseline plus the four new ones.
- Probe 1 (drift) and Probe 2 (swap) both observed failing and both reverted. Output quoted verbatim
  in `ops/font-contract.md`.
- The committed woff2 files re-opened with fontTools: 262, 264 and 309 glyphs, 235, 225 and 225
  codepoints, and exactly the axes the record claims.
- `git diff --stat 7545cd6 -- app public/fonts .lighthouserc.js .github/workflows/lighthouse.yml
  .github/workflows/deploy.yml docker contracts/tokens.css pnpm-lock.yaml pnpm-workspace.yaml` --
  empty. `git diff 7545cd6 -- .github/workflows/ci.yml` removes no line.
- Punctuation sweep over every file written, on surrogate-pair ranges, against a positive control
  carrying all four forbidden forms. All four fired on the control first. No em-dash, en-dash or
  emoji in any swept file; every double-dash hit is a CLI flag, a git pathspec separator, a CSS
  custom property name, or a markdown table rule.

**Residual risks.**

- The `fonts-contract` job has never run on a GitHub runner. Pending Operator action 2.
- The overrides are tuned against what the pinned Linux image resolves, which is WenQuanYi Zen Hei
  for two of the three stacks. A Windows or macOS visitor gets a different fallback. Stated limit,
  and Pending Operator action 4.
- `subset.py`'s own three refusals have no standing test, because the unit gate cannot run fontTools.
  Named in the record rather than assumed closed.
- `DESIGN.md:447` names an `opsz` floor of 10 that the font cannot produce. Pending Operator action 1.
