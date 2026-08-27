---
title: 'Publish `contracts/tokens.css` from `packages/tokens`'
type: 'feature'
created: '2026-08-24'
status: 'done'
baseline_commit: '064c087d581d366db0a8259179ef381a962de880'
baseline_revision: '064c087d581d366db0a8259179ef381a962de880'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Nothing under `contracts/` identifies the folder to a repository that vendors it: no README,
      no source repository or commit, and no licence line.
    evidence: |-
      AD-14 has seven repositories copy the folder under the fixed name `cuatro-contracts/`. The
      only provenance the published file carries is the header line "Generated from
      packages/tokens", which names a path that does not exist in a Satellite checkout, so a
      maintainer who finds a stale copy has no route back to the generator. AD-16 already makes a
      scheduled job read the `Contract vX.Y.Z` header across those repositories, which is a
      version but not an origin. Adding a second file under `contracts/` is a published-surface
      decision rather than a defect in this story, and Story 1.16 (serve `contracts/` at
      https://cuatro.dev/contracts/) is where the folder first acquires a public identity.
    location: >-
      contracts/
    severity: medium
  - summary: >-
      The `test` job in `.github/workflows/ci.yml` carries no `timeout-minutes`, and it is now the
      job that owns every case which spawns a real build.
    evidence: |-
      The `tokens-contract` and `rendered-output` jobs both declare a ceiling and both argue for it
      in a comment. The `test` job does not, and it is the one that grew: it runs eight cases that
      spawn `node packages/tokens/build.mjs`. Story 1-11 hardened that half by passing `timeout` to
      `spawnSync`, so a hung generator now fails its own case rather than the job. The job-level
      ceiling is still absent, and a hang anywhere else in the suite runs until the platform kills
      it with no cause in the log. This story's boundaries forbid editing the `test` job, so the
      one-line fix cannot be made here.
    location: >-
      .github/workflows/ci.yml:10-29
    severity: low
  - summary: >-
      `.github/workflows/ci.yml` declares no `permissions:` block, so every job runs with the
      default token scope.
    evidence: |-
      The workflow runs on `push` to `**` and checks out the repository to run tests. A
      workflow-level `permissions: contents: read` is the conventional least-privilege default for
      that shape and costs one line. The gap predates this story, which only added a third job under
      the same default, and closing it means editing a shared file beyond the story's scope.
    location: >-
      .github/workflows/ci.yml:1-7
    severity: low
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

### 2026-08-24, Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 24: (high 1, medium 9, low 14)
- defer: 1: (high 0, medium 1, low 0)
- reject: 6: (high 0, medium 2, low 4)
- addressed_findings:
  - `[high]` `[patch]` **The Dockerfile change was the only part of this story that can take the site down, and it was the only part with no standing gate.** Making `packages/tokens` a workspace importer turned the `deps` stage into a hand-maintained mirror of every workspace manifest, held together by a comment. Story 1.12 adding `packages/fonts` without its `COPY` line would pass typecheck, the unit suite, the drift gate and the harness, then fail first inside `docker compose up --build` on the production box during a deploy from `main`. Raised independently by two review layers. `docker/__tests__/deps-stage.test.ts` now expands the `packages:` globs and asserts every matched manifest appears on a `COPY` line in that stage. Mutation-verified: deleting the line fails with the missing manifest named and the deploy consequence spelled out.
  - `[medium]` `[patch]` **The published contract shipped a claim its own contents contradict.** `--tap` carried the comment "The ONE px length in the contract, and deliberately so" into a file declaring eight `px` lengths. The story had already diagnosed that wording defect and settled it in the design's favour, then copied the false sentence into the artifact that gets vendored into seven repositories. The comment now says what is true: `--tap` is the one length authored as a physical-size guarantee, the shape and stroke values are `px` as fixed geometry, and no reader-scaled length is. Pending Operator action 1 now names `DESIGN.md:540` as well as `epics.md:1558-1559`, since both carry the same false claim.
  - `[medium]` `[patch]` The generator wrote output even when its token source matched no files, so a moved or emptied source directory would have overwritten the published contract with an empty `:root` and exited 0. It now refuses, naming the source directory.
  - `[medium]` `[patch]` The version went into the header unchecked, so a missing or prerelease value would have published `Contract vundefined`. AD-16's scheduled job reads that header as `X.Y.Z` across seven repositories. Validated before writing.
  - `[medium]` `[patch]` `.dockerignore`'s `node_modules` matches only the context root in Docker's pattern semantics, so `packages/tokens/node_modules` reached the builder stage through `COPY . .` as a pnpm symlink tree. `**/node_modules` added.
  - `[medium]` `[patch]` Nothing asserted the published file is structurally valid CSS. The declaration parser was a regex with no notion of braces, so a property outside any rule, or everything after an unclosed brace, still counted toward all thirteen category assertions and the 89 total. For an artifact whose whole value is that seven repositories can `@import` it, a brace-balancing splitter now asserts two top-level rules, all 89 declarations inside the one `:root`, and nothing declared outside a rule.
  - `[medium]` `[patch]` The reference check covered only `--token-*`, leaving the three `--elev-*` aliases unvalidated by the assertion written for exactly that failure mode. It now covers every `var()` in the file.
  - `[medium]` `[patch]` `CUATRO_TOKENS_SOURCE` and `CUATRO_TOKENS_OUTPUT` could silently redirect the CI rebuild, leaving `git status -- contracts/` clean and the drift gate green on real drift. The build now prints both resolved paths, the record documents them as build inputs, and a test pins the unredirected default.
  - `[medium]` `[patch]` The DESIGN.md block locator failed open: a renamed heading gave `indexOf('```css', -1)`, which searches from 0 and locks onto the first CSS fence in the document, while the guard still passed because any non-negative index beats `-1`. It now throws on a missing heading, which is the case the test claimed to catch.
  - `[medium]` `[patch]` The token source files declared DTCG `$type`s whose values are strings those types do not accept, and carried no note of it, so a downstream author who trusts `$type` read nothing. A top-level `$description` on each file now names the decision and points at the record. `contracts/tokens.css` is unaffected.
  - `[low]` `[patch]` The "keeps every generator file under packages/" test enumerated files under the package root and asserted each path starts with `packages/`. It could not fail. Replaced with a real check.
  - `[low]` `[patch]` Nothing asserted the published file's line endings, though `.gitattributes` gained `contracts/** text eol=lf` precisely because a CRLF checkout desyncs the gate from the generator. LF-only and one trailing newline now asserted.
  - `[low]` `[patch]` Nine smaller fixes to the test file and the CI job: spacing and stroke counts derived from the parsed file rather than appended as literals; the custom-property name class widened so an uppercase name cannot slip past every count; the long timeout scoped to the two cases that spawn a build; an `existsSync` guard naming the `DESIGN.md` coupling; the alpha-uniqueness check rewritten as a property rather than a ban list that `hsla(` slipped; `git add --intent-to-add` before the drift diff so an untracked file's content is printed; `timeout-minutes` on the new job; `--ignored=matching` on the status check; and a `$description` carrying a CSS comment delimiter now rejected.
  - `[low]` `[patch]` `.gitattributes` had its six-line rationale four rules above the line it explains. Moved.
  - `[low]` `[patch]` `packages/tokens/package.json` defined a `build` script that nothing invoked, a second definition of the root `tokens:build` with nothing keeping the two in step. Collapsed to one.
  - `[low]` `[patch]` The record never noted that the shipped header promises `fonts.css` in the same folder while that file is Story 1.12, so vendoring `contracts/` today follows a dangling pointer. Recorded.

One finding was deferred rather than fixed, in frontmatter `deferred`: nothing under `contracts/` identifies the folder to a repository that vendors it, and adding a second published file is Story 1.16's decision rather than this story's.

Six were rejected. The ` -- ` separator this spec template uses in its Code Map and task lists is a structured separator, not a prose dash, which spec-1-10's review adjudicated for the same template. Folding `tokens-contract` into the `test` job trades a deliberate gate separation for one install. Symlink hardening in the test's directory walk defends against a state the build cannot create. Making `contracts/` reachable to the seven repositories is Story 1.16 by name. Proving the roles resolve in a browser rather than in text is the surface `epics.md:1510-1515` reserves for Stories 1.17 and 1.18, using the harness Story 1-10 built. Dropping the DTCG `$type` keys would discard what each value is meant to be; the non-conformance is documented in the JSON instead.

**On the workflow's prefer-bad_spec rule.** Finding 2 has a spec-shaped argument: the spec's Design Notes settled the `px` contradiction but never said the published comment must not repeat it. It was triaged `patch` deliberately. The spec's resolution was correct and the implementation followed it everywhere except one comment string; a loopback would have reverted a verified generator, a verified contract and 45 passing assertions to re-derive them byte-identically around a one-line edit. Recorded here rather than hidden.

### 2026-08-24, Follow-up review pass

- intent_gap: 0
- bad_spec: 0
- patch: 9: (high 0, medium 4, low 5)
- defer: 2: (high 0, medium 0, low 2)
- reject: 11: (high 0, medium 3, low 8)
- addressed_findings:
  - `[medium]` `[patch]` **`contracts/** text eol=lf` was a landmine for the next story in this
    epic.** Story 1.12 publishes `fonts.css` and the font files it points at into the same folder,
    and `text` on a `.woff2` makes git normalise line endings inside a binary on check-in, which
    corrupts the face in all seven repositories that vendor the folder. The rule is now listed by
    format, `contracts/**/*.css` and `contracts/**/*.json`. `git check-attr` confirms `tokens.css`
    is still `text: set, eol: lf` and that a `.woff2` under the same folder is now unspecified.
    `.gitattributes` carries no `* text=auto`, so leaving a format off the list is the safe default.
  - `[medium]` `[patch]` **The one hole the record identified in its own drift gate was documented
    rather than closed.** `ops/token-contract.md` said "Neither `CUATRO_TOKENS_SOURCE` nor
    `CUATRO_TOKENS_OUTPUT` may be set in CI", named the consequence exactly (the rebuild redirected,
    `git status -- contracts/` clean, the gate green over real drift) and then relied on a printed
    log line nobody reads on a green run. The `Rebuild the published contract` step now pins both to
    the empty string, which the generator treats as unset, so no environment reaching that runner
    can redirect it.
  - `[medium]` `[patch]` **The Dockerfile check asserted the weakest of the three properties that
    keep the deploy alive.** It read only the sources on each `COPY` line, so
    `COPY packages/tokens/package.json ./` passed while flattening the manifest onto
    `/app/package.json`, clobbering the root manifest and failing the install; and the same `COPY`
    moved below `RUN pnpm install --frozen-lockfile` passed too. Both are plausible edits and both
    end as a failed deploy from `main`, the one place with no staging behind it. The check now
    asserts the destination directory and the position relative to the install, and refuses a `COPY`
    form it cannot parse rather than skipping the line. Raised independently by two review layers.
  - `[medium]` `[patch]` **Three of the generator's five refusals had only a one-time probe behind
    them**, in a story whose own stated principle is that a gate never observed to fail is not known
    to work. Deleting the `$description` delimiter guard left the whole suite green, because every
    case reads a committed file whose descriptions carry no delimiter. Each refusal now has a
    standing case that runs the real generator against a corrupted copy of the committed source, and
    the record says which are probes and which are permanent.
  - `[low]` `[patch]` `build.mjs` guarded `$description` against a CSS delimiter and left `$value`
    unguarded, the same injection one field over: a value carrying `;` ends its declaration early
    and emits the rest of itself as CSS. It also published no `@media (prefers-reduced-motion:
    reduce)` block at all, silently and with exit 0, if the `dur` group were ever emptied. Both now
    refuse, both observed refusing with an empty output directory, both asserted permanently.
  - `[low]` `[patch]` `spawnSync` carried no `timeout`, and Vitest cannot interrupt a synchronous
    spawn, so a hung generator would have blocked the worker past its case budget and run until the
    CI platform killed the job. The spawn now carries the same budget as the case.
  - `[low]` `[patch]` The case titled "defaults its output to contracts/tokens.css when neither
    override is set" set `CUATRO_TOKENS_SOURCE`, as its own assertion proved, so the default source
    directory was pinned by nothing. Split into one case per variable, and the output case now
    restores the published file if a regression ever writes it rather than only reporting that one
    did.
  - `[low]` `[patch]` Four smaller fixes to `deps-stage.test.ts`: the workspace-glob reader stopped
    at the first comment or blank line under `packages:` and silently dropped every glob below it;
    `expandGlob` counted any directory as a package, so a scratch directory under `packages/` turned
    the suite red, and returned filesystem order into an order-sensitive comparison; an identity
    round-trip through `relative(REPO_ROOT, join(REPO_ROOT, x))`; and two assertions with no failure
    message in a file whose whole value is the message it prints.
  - `[low]` `[patch]` Record corrections in `ops/token-contract.md`. "What the change cost the
    production image" was the wrong frame: the `runner` stage copies `.next/standalone`,
    `.next/static` and `public` and no `node_modules`, so the served image does not grow, and the 62
    packages are not merely unused by a later stage, no later stage could use them, since the
    `builder` copies `/app/node_modules` alone and not the workspace link tree. Also added: the
    version-move checklist undercounted at three (the test pins the version literally as well), an
    OKLCH stated limit for a contract vendored into seven repositories with different audiences, a
    stated limit that the line-ending rule is only ever exercised on a Windows checkout, the new
    standing assertions, and Pending Operator action 5, that nothing in CI builds the `deps` target
    so the Dockerfile obligation has a text check and no executing one.

Two findings were deferred rather than fixed, both in `.github/workflows/ci.yml` and both blocked by
this story's own boundaries: the `test` job has no `timeout-minutes` and the story may not edit that
job, and the workflow declares no `permissions:` block, which predates this story.

Eleven were rejected. Three are worth naming. A cyclic alias, `a` to `b` to `a` with no direct
self-reference, is not reachable: every `--token-*` is asserted to be a plain `var()` at a `--c-*`
value, every `--c-*` is asserted to be an OKLCH literal, and the whole file is compared to
`DESIGN.md` declaration by declaration. Folding `tokens-contract` into the `test` job to save one
install trades a deliberate gate separation for a runtime figure, which the previous pass already
adjudicated. Widening the executable-extension list under `contracts/` adds nothing, because a
separate case pins the folder's contents to exactly `contracts/tokens.css`, which forbids every
extension rather than six. The remainder were scope (`AGENTS.md`, the dead `linkg` script, and the
`epics.md` and `DESIGN.md` wording, all forbidden by the intent and all already carried as Pending
Operator actions), style (the `$description` provenance repeated per source file, which the previous
pass added deliberately so each file stands alone), or observations about the diff handed to the
reviewers rather than about the change.

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

## Auto Run Result

Status: done

**What was implemented.** The Ecosystem has a published token contract. `contracts/tokens.css` v1.0.0
carries the 89 custom properties `DESIGN.md` section `tokens.css` fixes, in its order, with its
values, plus the `@media (prefers-reduced-motion: reduce)` block. It is generated by
`packages/tokens`, a Style Dictionary 5.5.2 package over DTCG-shaped JSON, which is the first entry
under the repository's first `packages:` key. The published file is committed, its shape is asserted
inside the already-blocking unit gate, and a blocking `tokens-contract` CI job rebuilds it and fails
if the committed output no longer matches its source. Publishing is not adopting: the Hub's render is
untouched.

This follow-up review pass changed no published byte. `contracts/tokens.css` is still sha256
`319a825597995cbecacc43f08da9b24b48db636abc2b1e023ea4387a5cb38462`. What it hardened is the ring
around that file: the two properties of the Docker `deps` stage that a text check was not asserting,
the one drift-gate hole the record had documented instead of closing, a `.gitattributes` rule that
would have corrupted Story 1.12's font files, and three generator refusals that had a probe behind
them and no standing test.

**Files changed.**

- `pnpm-workspace.yaml` -- the `packages:` key the first acceptance criterion names.
- `packages/tokens/package.json` -- private, `type: module`, `version: 1.0.0` as the single source of
  the contract version, `style-dictionary` pinned exactly at `5.5.2`.
- `packages/tokens/tokens/*.json` -- seven DTCG-shaped source files. Group keys are the emitted
  prefixes, so `name/kebab` alone produces the exact custom-property names.
- `packages/tokens/build.mjs` -- one registered format: the header, the `:root` block in design
  section order, and the reduced-motion block derived from the `dur` group rather than hand-written.
  Refuses an empty dictionary, a version that is not `X.Y.Z`, an unmapped group, a `$description` or
  a `$value` carrying a CSS delimiter, and a source with no durations to collapse.
- `contracts/tokens.css` -- the generated, committed contract. 89 declarations, sha256 `319a8255...`.
- `packages/tokens/__tests__/tokens-contract.test.ts` -- 64 cases over the published file, including
  a standing case per generator refusal and one pinned default per build input.
- `docker/__tests__/deps-stage.test.ts` -- 9 cases keeping the Dockerfile in step with the workspace:
  every workspace manifest copied, to its own directory, before the install that reads it.
- `package.json` -- `tokens:build`, the single entry point.
- `.github/workflows/ci.yml` -- the blocking `tokens-contract` job, with both build inputs pinned
  empty so no runner environment can redirect the rebuild. The two existing jobs are byte-identical
  to `064c087`: the diff against the baseline removes no line from this file.
- `docker/Dockerfile` -- the `deps` stage sees the workspace manifests, so the production build still
  resolves against the workspace lockfile. The install command is unchanged.
- `.dockerignore`, `.gitattributes` -- `**/node_modules` out of the build context; LF pinned on the
  published surface by format rather than by `contracts/**`, so a future font binary is left alone.
- `ops/token-contract.md` -- the record: what v1.0.0 publishes and what it deliberately does not, the
  value-encoding decision with the Style Dictionary probe output that forced it, the regeneration
  path and its build inputs, the drift gate with its probe demonstrations, what the change cost the
  production build, the stated limits and five Pending Operator actions.

**Review findings, this pass.** 9 patched (0 high, 4 medium, 5 low), 2 deferred, 11 rejected, 0
intent gaps, 0 spec loopbacks. Follow-up review recommended: **true**, by the rule (no high, so
`3 x 4 + 1 x 5 = 17`, which is at or above 5). The two deferred findings are both in
`.github/workflows/ci.yml` and both blocked by this story's boundaries, not by difficulty.

**Verification performed**, all on 2026-08-24 on the development host:

- `corepack pnpm install --frozen-lockfile` -- "Lockfile is up to date, resolution step is skipped",
  done in 842 ms. No manifest changed this pass.
- `corepack pnpm typecheck` -- pass.
- `corepack pnpm test --run` -- **288 passed, 19 files, 75.5 s**, up from the 281 recorded before
  this pass. 64 cases in `tokens-contract.test.ts`, 9 in `deps-stage.test.ts`, counted per file.
- `corepack pnpm tokens:build`, run twice -- sha256 of `contracts/tokens.css` identical before, after
  the first build and after the second, and `git status --porcelain --ignored=matching -- contracts/`
  empty each time.
- The two new refusals observed rejecting, each against a copy of the committed source with one file
  corrupted, each exiting 1 with an empty output directory. Both messages are quoted verbatim in
  `ops/token-contract.md`.
- `git check-attr text eol -- contracts/tokens.css` -- `text: set`, `eol: lf`. The same command
  against a `.woff2` under `contracts/` returns unspecified, which is the point of the narrowing.
- `git diff --stat 064c087 -- app .lighthouserc.js .github/workflows/lighthouse.yml
  .github/workflows/deploy.yml` -- empty.
- `git diff 064c087 -- .github/workflows/ci.yml` -- 59 added lines and **no removed line**, so both
  pre-existing jobs are byte-identical to the baseline.
- Punctuation sweep over every file written this pass plus the published contract, built on
  surrogate-pair ranges and run against a positive control carrying an em-dash, an en-dash, a
  double-dash and two emoji. All five patterns fired on the control first. No em-dash, en-dash or
  emoji in any swept file. Every double-dash hit is a git pathspec separator inside backticks
  (`git status -- contracts/`) or the spec template's structured Code Map separator, which
  spec-1-10's review adjudicated for this template.

**Not re-run this pass, with the reason.** `docker build --target deps` and the rendered-output
harness. Nothing in this pass touches `docker/Dockerfile`, `.dockerignore`, the lockfile, any
manifest, `app/`, or any component stylesheet, so neither input changed since both were observed
passing. The Dockerfile's own text is unchanged; what changed is the test that reads it.

**Residual risks.**

- The `tokens-contract` job has still never run on a GitHub runner. Everything recorded about it was
  observed by running its commands locally against the committed tree. Pending Operator action 2.
- Nothing in CI builds the Docker image. The `deps` stage obligation is asserted by reading the
  Dockerfile as text, which now covers the destination and the ordering but still cannot observe an
  install. The first executing check remains the deploy from `main`. Pending Operator action 5.
- The shipped header points at `contracts/fonts.css`, which is Story 1.12. A Satellite that vendors
  the folder today follows a dangling pointer. Recorded in the record with its owner; unchanged by
  this pass.
- `AGENTS.md` still describes CI as "typecheck and tests only" and the suite as 38 tests. Correcting
  it by hand is forbidden here. Pending Operator action 3.

