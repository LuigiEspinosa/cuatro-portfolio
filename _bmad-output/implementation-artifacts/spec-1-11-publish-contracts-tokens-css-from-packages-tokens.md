---
title: 'Publish `contracts/tokens.css` from `packages/tokens`'
type: 'feature'
created: '2026-08-24'
status: 'in-progress'
baseline_commit: '064c087d581d366db0a8259179ef381a962de880'
baseline_revision: '064c087d581d366db0a8259179ef381a962de880'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** The Ecosystem's visual identity exists only as a fenced code block in `DESIGN.md`.
Seven Satellites in six frameworks are supposed to adopt it with a file read, and there is nothing
to read: no `contracts/` directory, no `packages/` directory, and no `packages:` key in
`pnpm-workspace.yaml`. Every downstream Epic 1 story (1.12, 1.13, 1.14, 1.16, 1.17, 1.18, 1.19)
consumes a file that does not exist.

**Approach:** Create `packages/tokens`, a Style Dictionary generator over DTCG-shaped source files,
and publish its output as `contracts/tokens.css` carrying the exact property set `DESIGN.md`
§ `tokens.css` fixes. Commit the generated file, assert its shape in the existing blocking unit
suite, add one new blocking CI job that rebuilds it and fails if the committed file drifted from
its source, demonstrate that job failing against a planted probe, and record the decisions under
`ops/`.

## Boundaries & Constraints

**Always:**
- `DESIGN.md:824-966` is the source of truth for the property set and for every value. Copy from it
  rather than re-deriving a number, and never substitute a hex fallback for an authored OKLCH value.
- The generator lives in `packages/` and is never published (AD-1). Nothing under `contracts/` is a
  `.ts`, `.js`, `.tsx`, `.jsx`, `.mjs` or `.cjs` file.
- The new CI job is blocking (AD-21): no `continue-on-error`, no `|| true`, no soft-fail. Its
  triggers match the existing file exactly, `push: branches: ['**']` and
  `pull_request: branches: [main]`.
- A new gate is demonstrated failing once against a planted probe, and the probe is removed in the
  same story. Its output lives in the `ops/` record, not in the working tree.
- The production image must still build. `docker/Dockerfile:4` copies `package.json` and
  `pnpm-lock.yaml` alone and then runs `pnpm install --frozen-lockfile`; a workspace lockfile with
  an importer whose manifest is absent fails that install. Verify by building the `deps` target,
  not by reasoning about it.
- Every recorded number is marked observation or decision and carries its method (NFR-9). Dates are
  ISO 8601 UTC.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash, and no
  emoji. The commit is a subject line only, no body and no trailer.

**Block If:**
- The only way to make the generated file match `DESIGN.md` is to weaken, skip or soft-fail an
  existing CI gate.
- Style Dictionary at 5.5.1 or above cannot emit an authored OKLCH value, a `clamp()` value or a
  `var()` reference without mangling it, so the published contract would carry values the design
  did not author.

**Never:**
- Never create `contracts/fonts.css`, `contracts/tailwind.css`, `contracts/registry.json` or a
  `@font-face` rule. Those are Stories 1.12, 1.13 and 2.x. This story ships one file.
- Never edit `app/app.scss` or any component stylesheet. Publishing the contract is not adopting it;
  adoption is Stories 1.17 and 1.18 and the Hub's render must not change.
- Never edit `.lighthouserc.js`, `.github/workflows/lighthouse.yml` or
  `.github/workflows/deploy.yml`. The 0.95 accessibility assertion stays byte-identical and
  `deploy.yml`'s AD-8 breach is KV-1, retired in Epic 3.
- Never edit the existing `test` or `rendered-output` jobs in `.github/workflows/ci.yml`.
- Never edit the `bmad:context` block in `AGENTS.md` by hand, and never edit `epics.md` or
  `DESIGN.md`. A wording defect found in a planning artifact is recorded, not corrected here.
- Never rename or drop a token to make a count come out. A rename is a major contract break under
  AD-16 before the contract has shipped once.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Build from source | `packages/tokens` DTCG files unchanged | `contracts/tokens.css` rewritten byte-identically | No error expected |
| Source changed, output stale | A `$value` edited, no rebuild | The `tokens-contract` CI job fails showing the diff | Non-zero exit |
| Generator emits a new file | Output path added under `contracts/` | The drift check fails on the untracked file, not only on tracked diffs | `git diff` alone would miss it, so the check also reads `git status --porcelain` |
| Token added without a section | New group key absent from the section map | The build throws naming the group | Never emitted into an arbitrary position or silently dropped |
| Role points at a missing palette entry | `--token-x: var(--c-missing)` | The contract test fails naming the role and the target | Never passes because the text merely looks like a `var()` |
| Role is self-referential | `--token-bg: var(--token-bg)` | The contract test fails naming the role | AD-14: the failure is silent `transparent` at runtime, so it must be caught statically |
| Header version drifts | `package.json` version and the `Contract vX.Y.Z` header disagree | The contract test fails naming both values | AD-16 verifies Satellites against this header, so a drifted header is a broken check estate-wide |

</intent-contract>

## Code Map

Gathered 2026-08-24 against `064c087`, working tree clean.

- `_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md:824-966` --
  **the authoritative `tokens.css` block.** Every name, every value, the header, the section order
  and the `@media (prefers-reduced-motion: reduce)` block come from here verbatim. `:244-259` is the
  palette table, `:280-293` the role table, `:461-476` the type scale, `:510-520` spacing,
  `:527-547` the hit-target floor, `:562-569` z-index, `:591-600` strokes, `:615-619` shapes,
  `:1028-1045` the versioning rule the header states, `:366-436` the scrim and why its alpha lives on
  the palette entry.
- `_bmad-output/planning-artifacts/epics.md:1531-1587` -- Story 1.11's acceptance criteria, including
  the per-category counts. `:1550` names `DESIGN.md` § `tokens.css` as what fixes the property set,
  which is what settles the one place the two disagree (see Design Notes).
- `ARCHITECTURE-SPINE.md:82-86` (AD-1, `contracts/` is the published surface and generators live in
  `packages/`), `:160-164` (AD-14, the two namespaces and the fixed `cuatro-contracts/` folder name),
  `:172-176` (AD-16, versioning and the `Contract vX.Y.Z` header the scheduled job reads),
  `:202-206` (AD-21, every gate blocking).
- `pnpm-workspace.yaml` -- two lines today, `onlyBuiltDependencies` only. No `packages:` key. This is
  the file the first acceptance criterion names.
- `package.json:9-18` -- scripts. `test` is bare `vitest` (watch mode), `linkg` is the known dead lint
  script. `:50` pins pnpm 10.31.0.
- `docker/Dockerfile:1-5` -- **the production-build hazard.** The `deps` stage copies `package.json`
  and `pnpm-lock.yaml` and nothing else, then runs `pnpm install --frozen-lockfile`. Adding a
  workspace importer to the lockfile without giving this stage `pnpm-workspace.yaml` and the new
  manifest breaks every deploy. `docker/Dockerfile:11` (`COPY . .`) means the `builder` stage is
  unaffected. `.dockerignore` does not exclude `packages/` or `contracts/`.
- `.github/workflows/ci.yml:3-7` -- the triggers the new job must match. `:10-29` the `test` job,
  `:31-72` the `rendered-output` job Story 1-10 added, which is the shape a third job follows.
- `vitest.config.ts:7-16` -- `environment: 'jsdom'`, `globals: true`, `exclude` spreads
  `configDefaults.exclude` plus `tests/e2e/**`. Default includes match `**/*.test.ts` anywhere
  outside `node_modules`, so a test under `packages/tokens/__tests__/` is collected by
  `corepack pnpm test --run` with no config change.
- `ops/__tests__/library-backup.test.ts:1-8` -- the precedent for a node-environment test that reads a
  non-TypeScript artifact from disk: `// @vitest-environment node` on line 1, then
  `fileURLToPath(import.meta.url)` to resolve the repository root. Follow it.
- `tsconfig.json:34-44` -- `include` covers `**/*.ts` and `**/*.mts`, so the new test is typechecked
  and a `.mjs` generator is not. `types: ['vitest/globals']`.
- `ops/rendered-output-harness.md:1-20` and `ops/known-violations.md` -- the record shape: a
  provenance line naming the story and the ISO date, tables with a `Nature` column, a "Maintaining
  this file" section and a "Pending Operator actions" table.
- `.gitignore:125` -- unanchored `node_modules`, so `packages/tokens/node_modules` is already ignored.
  Nothing ignores `contracts/` or `packages/`.
- Environment checked 2026-08-24 on this host: `style-dictionary` latest on the registry is **5.5.2**,
  which clears the >=5.5.1 security floor. It declares `engines.node >= 22`; CI pins Node 22 and this
  host runs v24.15.0. A spike against 5.5.2 settled the value encoding, see Design Notes.

## Tasks & Acceptance

**Execution:**
- `pnpm-workspace.yaml` -- add `packages: ['packages/*']` above the existing `onlyBuiltDependencies`
  key, leaving that key unchanged.
- `packages/tokens/package.json` -- new. Private, `"type": "module"`, `"version": "1.0.0"` (the
  single source of the contract version), a `build` script, and `style-dictionary` pinned exactly at
  `5.5.2` in devDependencies, matching the exact-pin convention Story 1-10 set for a
  version-coupled tool.
- `packages/tokens/tokens/*.json` -- new. The DTCG source, split by section, carrying `$type`,
  `$value`, `$description` and `{group.name}` aliases. Group keys are the emitted prefixes (`c`,
  `token`, `f`, `t`, `w`, `lh`, `tr`, `s`, `r`, `stroke`, `elev`, `dur`, `ease`, `z`) plus the four
  ungrouped tokens `measure`, `page-pad`, `tap` and `focus-offset`, so `name/kebab` alone produces
  the exact custom-property names.
- `packages/tokens/build.mjs` -- new. Registers one format that emits the header, the `:root` block
  in `DESIGN.md` section order with a section comment per group, and the
  `@media (prefers-reduced-motion: reduce)` block derived from the `dur` group rather than
  hand-written. Transforms are `name/kebab` only, `outputReferences` is on, the version is read from
  `package.json`, and an unmapped group key throws.
- `package.json` -- add a `tokens:build` script delegating to the workspace package. Leave `test`,
  `typecheck`, `test:e2e`, `test:e2e:update` and the dead `linkg` untouched.
- `contracts/tokens.css` -- the generated, committed output. Never hand-edited.
- `packages/tokens/__tests__/tokens-contract.test.ts` -- new. Reads the published file and asserts
  every row of the I/O matrix plus the per-category counts. This is what puts the contract inside the
  already-blocking unit gate.
- `.github/workflows/ci.yml` -- add a `tokens-contract` job: install, `pnpm tokens:build`, then fail
  if anything under `contracts/` changed or appeared. Do not touch the two existing jobs.
- `docker/Dockerfile` -- give the `deps` stage `pnpm-workspace.yaml` and `packages/tokens/package.json`
  so `pnpm install --frozen-lockfile` still resolves against the workspace lockfile. Leave the install
  command itself unchanged.
- `ops/token-contract.md` -- new record: what v1.0.0 publishes and what it deliberately does not; the
  value-encoding decision with the Style Dictionary probe output that forced it; the versioning rule
  and who verifies it; how the file is regenerated; the drift gate and its probe demonstration; the
  added production-build cost with its method; the stated limits; and the Pending Operator actions.

**Acceptance Criteria:**
- Given the Anchor has no `packages:` key and no Turborepo today, when `packages/tokens` is created,
  then `pnpm-workspace.yaml` gains a `packages:` entry covering it,
  `corepack pnpm install --frozen-lockfile` succeeds against the committed lockfile, and the package
  builds with Style Dictionary at 5.5.1 or above over DTCG-shaped source files.
- Given AD-1 puts generators in `packages/` and never publishes them, when the story closes, then no
  file under `contracts/` matches `\.(ts|js|tsx|jsx|mjs|cjs)$` and every generator file sits under
  `packages/`.
- Given `DESIGN.md` § `tokens.css` fixes the exact property set, when `contracts/tokens.css` is
  generated, then it declares exactly twelve `--c-*` palette values authored in OKLCH on hue 288,
  twelve `--token-*` roles, three families, ten type-scale steps, five weights, five line-heights,
  six tracking values, `--measure`, nine spacing steps, `--tap`, three shape values, five stroke
  values, three elevation values, seven motion values and seven z-index values, and every name and
  value matches `DESIGN.md:832-957`.
- Given AD-16 makes the header the thing a scheduled job verifies a Satellite against, when the file
  header is written, then it carries `Contract v1.0.0`, states that a value change or an addition is
  a minor bump and that any rename including fixing a typo or any removal is major, and the version
  in the header equals `packages/tokens/package.json`'s version.
- Given a target floor is a physical-size guarantee, when the hit-target token is emitted, then
  `--tap` is `44px`, no token in the type scale, the spacing scale or `--measure` is authored in
  `px`, and the stroke and shape values remain the `px` geometry values `DESIGN.md:591-600` and
  `:615-619` specify. The epics wording "the only length in the contract authored in `px`" is
  contradicted by its own source and is recorded rather than acted on; see Design Notes.
- Given AD-14 forbids `--token-*` and Tailwind's `--color-*` sharing a name across a `var()`, when
  the semantic roles are emitted, then every `--token-*` role is a plain `var()` reference to a
  `--c-*` value that is declared in the same file, and no role references itself.
- Given a `url()` in `tokens.css` breaks the moment a Satellite vendors the folder to a different
  depth, when the file is published, then it contains no `@font-face` rule and no `url()`.
- Given reduced-motion compliance is the one behaviour the token layer federates, when the file is
  published, then it carries an `@media (prefers-reduced-motion: reduce)` block collapsing exactly
  the four `--dur-*` tokens to `1ms`, and that set equals the `--dur-*` set declared in `:root`.
- Given a gate never observed to fail is not known to work, when the drift gate is verified, then it
  is demonstrated failing against a source edit that was not rebuilt, the shape test is demonstrated
  failing against a token removed from the source, both outputs are recorded in `ops/token-contract.md`,
  and neither probe exists in the tree at the closing commit.
- Given AD-21 makes every CI gate blocking, when `.github/workflows/ci.yml` is read, then the new job
  carries no `continue-on-error` and no soft-fail, runs on `push` to `**` and `pull_request` to
  `main`, and the two existing jobs are byte-identical to `064c087`.
- Given `cuatro.dev` deploys from `main` on every push and the deps stage does not see the workspace
  manifest, when the production image is verified, then `docker build --target deps` succeeds against
  the committed lockfile, and the observed build time is recorded with its method.
- Given publishing the contract is not adopting it, when the story closes, then `app/app.scss`, every
  component stylesheet, `.lighthouserc.js`, `.github/workflows/lighthouse.yml` and
  `.github/workflows/deploy.yml` are byte-identical to `064c087`, and the rendered-output harness
  still passes against its committed baseline.

## Spec Change Log

## Review Triage Log

## Design Notes

**Why string values in DTCG-shaped files, with the probe that decided it.** DTCG 2025.10 gives
`color`, `dimension` and `duration` structured object types. A spike against Style Dictionary 5.5.2
on 2026-08-24 ran the same token set through three transform sets and none of them survives contact
with this contract: a structured `oklch` colour comes out of `color/css` as `#060509` and
`rgba(6, 5, 9, 0.88)`, which discards the authored OKLCH that `DESIGN.md:239-242` makes the source of
truth and the hex merely the fallback; a structured `duration` renders `[object Object]` under every
transform set tried, including `time/seconds`; and a `fontFamily` array renders unquoted and
comma-joined. `clamp(2.25rem, 9vw, 4.5rem)` and `cubic-bezier(0.16, 1, 0.3, 1)` have no structured
DTCG representation at all. The same spike with string `$value`s and `name/kebab` as the only
transform emitted `oklch(12% 0.011 288)`, `oklch(12% 0.011 288 / 0.88)`, `clamp(...)`, `44px`,
`120ms`, `cubic-bezier(...)` and `var(--c-paper)` byte-exactly. So the source files take DTCG's
structure, `$value` / `$type` / `$description` / `{group.name}` aliases, and author values as the CSS
strings the design fixes. That is a decision with a cost, and the cost is recorded in
`ops/token-contract.md` rather than hidden: a future consumer wanting structured tokens has to parse
the strings.

**Why the group key is the emitted prefix.** Style Dictionary builds a name from the token's path, so
a group named `color.palette` would emit `--color-palette-paper`. Naming the groups `c`, `token`, `t`
and so on makes `name/kebab` alone produce the exact names, with no rename transform to review and
nothing to drift. The four tokens that carry no prefix, `--measure`, `--page-pad`, `--tap` and
`--focus-offset`, are authored at the top level for the same reason.

**Where epics and the design source disagree, and how it is settled.** `epics.md:1558-1559` says
`--tap` is "the only length in the contract authored in `px`". `DESIGN.md`'s own `tokens.css` block
authors `--r-hair: 2px`, `--r-pill: 999px` and all five stroke values in `px`, and
`DESIGN.md:602` states outright that rules are "1px and opaque". The acceptance criterion's own
governing clause is "`DESIGN.md` § `tokens.css` fixes the exact property set", so the design block
wins and the epics sentence is a wording defect about *reader-scaled* lengths. Converting the strokes
to `rem` would make a hairline scale with the root font size, which the design forbids in the same
paragraph. The contract is published as designed and the wording is raised as a Pending Operator
action against the planning artifacts, which this story may not edit.

**Why the drift gate reads `git status` and not only `git diff`.** `git diff --exit-code` is blind to
a file the generator newly created, which is exactly the shape of a mistake Story 1.12 and 1.13 will
make when they add a second and third output. The check has to see untracked paths under `contracts/`
too, or the first new file ships unreviewed.

## Verification

**Commands:**
- `corepack pnpm install --frozen-lockfile` -- expected: resolves with the committed lockfile, no
  `ERR_PNPM_OUTDATED_LOCKFILE`, and `packages/tokens` appears as a workspace importer.
- `corepack pnpm tokens:build` -- expected: succeeds, and `git status --porcelain -- contracts/` is
  empty afterwards, run twice to confirm the output is stable.
- `corepack pnpm typecheck` -- expected: pass, with the new test inside the program.
- `corepack pnpm test --run` -- expected: the 215 tests observed at `4f4c751` still pass, plus the new
  contract tests, no browser started.
- `docker build -f docker/Dockerfile --target deps .` -- expected: succeeds. Time it before and after
  the workspace change and record both figures with the method.
- Probe 1, edit a `$value` in the DTCG source and do not rebuild -- expected: the drift check fails
  and prints the offending property. Revert.
- Probe 2, delete one palette token from the source and rebuild -- expected: the contract test fails
  on the palette count and on the role whose `var()` target vanished. Revert.
- `git diff --stat 064c087 -- app .lighthouserc.js .github/workflows/lighthouse.yml .github/workflows/deploy.yml`
  -- expected: empty output.
- Punctuation sweep over every file written, built on surrogate-pair ranges rather than `\u{...}`
  syntax and run against a positive control carrying all four forbidden forms, so it cannot pass
  vacuously (the trap recorded in `spec-1-5` finding 5, repeated in `spec-1-9` finding 12).

**Manual checks:**
- Diff the generated `:root` block against `DESIGN.md:832-957` line by line and confirm every name and
  value matches, since a mistyped OKLCH lightness is a value a test asserting counts cannot catch.
- Re-read `.github/workflows/ci.yml` after editing and confirm the two existing jobs are untouched and
  the new job's triggers are the file's own, not a copy that drifted.
- Run the rendered-output harness once in `mcr.microsoft.com/playwright:v1.62.1-noble` and confirm the
  committed baseline still matches, since nothing here should change what the Hub renders.
