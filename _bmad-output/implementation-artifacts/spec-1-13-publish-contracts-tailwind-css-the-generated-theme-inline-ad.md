---
title: 'Publish `contracts/tailwind.css`, the generated `@theme inline` adapter'
type: 'feature'
created: '2026-08-25'
status: 'done'
baseline_commit: 'c07038dbccb84e51092dd7810fa66dc8368323e7'
baseline_revision: 'c07038dbccb84e51092dd7810fa66dc8368323e7'
review_loop_iteration: 1
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-11-publish-contracts-tokens-css-from-packages-tokens.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-12-publish-contracts-fonts-css-with-latin-subset-faces.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** `contracts/` publishes values and faces, and a Tailwind v4 consumer can use neither.
Research and `DESIGN.md:1058-1066` are explicit that a plain `:root` file of custom properties mints
**zero** utility classes, so `cuatro-finance`, `cuatro-tracker`, `cs-tournament` and `cs-tracker`
would import the contract and still have no `bg-accent`. The adapter is the third and last file of
v1.0.0, and Stories 1.16, 1.19 and 2.5 all consume it.

**Approach:** Generate `contracts/tailwind.css` from the same `packages/tokens` build that writes
`tokens.css`, driven by a committed `theme-map.json` that names one Tailwind theme key per token it
should mint. Emit the fixed import order then an `@theme inline` block, refuse at generation time on
a self-referencing mapping, on a token the dictionary does not publish and on a raw-palette
reference, assert the published file in the already-blocking unit suite, and prove in the pinned
browser image that a real Tailwind v4 build over the published file mints every mapping in it.

## Boundaries & Constraints

**Always:**
- `contracts/` is data. Nothing under it matches `\.(ts|js|tsx|jsx|mjs|cjs)$`, and every generator
  file sits under `packages/tokens` and is never published (AD-1).
- Import order is exactly `tailwindcss`, then `./tokens.css`, then `./fonts.css`, then the theme
  block. The adapter imports `fonts.css`: an adapter pulling in only `tokens.css` hands the cluster
  three named families with no `@font-face` for any of them (`DESIGN.md:1006-1010`).
- The block is `@theme inline`. The keyword is mandatory rather than stylistic (AD-14).
- Every mapping reads `--<tailwind-key>: var(--<token-name>);`, the two names are never equal, and
  the referenced name is always one `contracts/tokens.css` actually declares. `--color-bg:
  var(--color-bg)` is a cycle that resolves to `transparent` once a bundler flattens the imports.
- The raw `--c-*` palette is never referenced by the adapter. The semantic role layer is the only
  thing consumers read (AD-14).
- The header carries `Contract v1.0.0`, read from `packages/tokens/package.json` and validated as
  exact `X.Y.Z`, because AD-16 has a scheduled job read that line across seven repositories.
  Publishing the adapter bumps nothing; see Design Notes.
- `contracts/tokens.css`, `contracts/fonts.css` and everything under `contracts/fonts/` stay
  byte-identical to `c07038d`. This story adds one file to the published surface and changes none.
- Every CI gate stays blocking (AD-21): no `continue-on-error`, no `|| true`, no soft-fail, and no
  line removed from `.github/workflows/ci.yml`.
- Every recorded number is marked observation or decision and carries its method (NFR-9). Dates are
  ISO 8601 UTC.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash and no
  emoji. The commit is a subject line only, no body and no trailer.

**Block If:**
- A Tailwind v4 build over the published adapter cannot mint utilities without an executable file
  under `contracts/` (a `tailwind.config.js`, a plugin, a PostCSS entry). That would put AD-1 and
  AD-14 in direct conflict, which is not this story's call.
- Making the rendered check pass would need a token renamed, a token value changed, a version bump,
  or an existing gate weakened.

**Never:**
- Never create `contracts/registry.json` or `contracts/registry.schema.json`, and never add a
  `contracts/README`. Those are Stories 2.5 and a standing Story 1-11 deferral.
- Never edit `contracts/tokens.css`, `contracts/fonts.css`, `contracts/fonts/*`,
  `packages/tokens/tokens/*.json`, `packages/tokens/package.json`, or anything under
  `packages/fonts/` except the pinned published-file list named below.
- Never hand-edit `contracts/tailwind.css`.
- Never edit `app/`, `public/`, any component stylesheet, `.lighthouserc.js`,
  `.github/workflows/lighthouse.yml`, `.github/workflows/deploy.yml`, `docker/Dockerfile`,
  `pnpm-workspace.yaml`, or the `test`, `tokens-contract`, `fonts-contract` and `rendered-output`
  jobs in `.github/workflows/ci.yml`. Publishing the adapter is not adopting it, and the Anchor is
  SCSS and is not a Tailwind consumer.
- Never regenerate `tests/e2e/rendered-output.pw.ts-snapshots/work-360x800-chromium-linux.png`.
- Never add a PostCSS config, a `tailwind.config.*`, or a Tailwind import to the Hub's stylesheet
  graph. The two new dependencies are build-time only and are used by one Playwright spec.
- Never edit `epics.md`, `DESIGN.md`, or the `bmad:context` block in `AGENTS.md`. A wording defect
  found in a planning artifact is recorded as a Pending Operator action, not corrected here.
- Never add a new workspace package. A second `package.json` under `packages/` changes the lockfile
  importers and obliges a `COPY` line in the Docker `deps` stage.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Build from source | `tokens/*.json` and `theme-map.json` unchanged | `contracts/tailwind.css` and `contracts/tokens.css` rewritten byte-identically, twice in a row | No error expected |
| Output edited, not rebuilt | A mapping hand-edited in the published file | The `tokens-contract` CI job fails printing the diff | Non-zero exit |
| A mapping names a token that is gone | `theme-map.json` references `--token-brand` | The generator refuses naming the key, the token and the file | Nothing published |
| A mapping is a cycle | `--color-accent: var(--color-accent)` reaches the emitter | The generator refuses naming the key, citing AD-14 | Never published: it resolves to `transparent` |
| A mapping reads the raw palette | A key references `--c-accent` | The generator refuses naming the key | The palette is never consumed outside `contracts/` |
| A key in an unknown namespace | `--colour-bg` (a typo) reaches the emitter | The generator refuses, naming the key and the permitted namespaces | A key Tailwind does not know mints nothing, silently |
| An empty map | `theme-map.json` has no mappings | The generator refuses rather than publishing an empty `@theme` block | Nothing published |
| Version drift | Header and `packages/tokens/package.json` disagree | The contract test fails naming both values | AD-16 reads that header estate-wide |
| A real Tailwind build | A scratch v4 build imports the published adapter | Every mapping mints its utility, verified by computed style in the pinned image | A missing utility fails naming the key and the class |
| The same build without the adapter | The same fixture importing `tailwindcss` and `tokens.css` only | The utilities do not exist, which is the premise AD-14 rests on | A pass here would mean the check proves nothing |

</intent-contract>

## Code Map

Gathered 2026-08-25 against `c07038d`, working tree clean.

- `packages/tokens/build.mjs:199-296` -- **the file this story extends.** `registerFormat` at `:199`
  and the `files: [{ destination: 'tokens.css', ... }]` array at `:285` are where a second format and
  a second file entry go, which is what makes AC 3 (`rebuilding packages/tokens regenerates
  tailwind.css`) true by construction. `:43-48` are the two build inputs, `:60-69` the `X.Y.Z`
  version guard to reuse verbatim, `:140-164` the CSS-delimiter refusal, `:206-211` the
  empty-dictionary refusal, and `:213` the `nameByPath` map. `:186-197` `declarations()` is the
  alignment helper the theme block reuses.
- `contracts/tokens.css:8-136` -- the published names the map may reference: `--token-*` (12 roles,
  `:27-38`), `--f-*` (`:41-43`), `--t-*`, `--w-*`, `--lh-*`, `--tr-*`, `--measure`, `--s-*`,
  `--page-pad`, `--tap`, `--r-*`. `:10-24` is the `--c-*` palette the adapter may never reference.
  **`--ease-*` at `:124-126` collides byte for byte with Tailwind's own `--ease-*` namespace**; see
  Design Notes.
- `contracts/fonts.css` -- the second import. Its `url()`s are `./fonts/...`, relative to itself, so
  where a compiled consumer bundle lands decides whether they resolve. That is the matrix row the
  browser check measures rather than assumes.
- `_bmad-output/.../DESIGN.md:975-1019` -- **the authored adapter block, and the shape to follow**:
  the three imports, `@theme inline`, and the sample mappings the map must reproduce name for name
  (`--color-surface` from `--token-bg-raised`, not from `--token-surface`). `:1006-1010` is why
  `fonts.css` is imported, `:1012-1016` why `inline` is mandatory, `:1028-1045` the versioning rule,
  `:805-822` the three-file split, `:1058-1066` the zero-utilities premise.
- `ARCHITECTURE-SPINE.md:160-164` (AD-14) and `:172-176` (AD-16) -- the two governing rules. AD-14
  fixes the vendored folder name `cuatro-contracts/` and the namespace separation.
- `packages/tokens/__tests__/tokens-contract.test.ts:881-896` -- **one of the two pinned
  published-file lists this story widens.** `:289` is the `EXECUTABLE` pattern, `:291-315` the
  directory walk, `:924-955` the read-the-design-block helper to model the adapter comparison on.
- `packages/fonts/__tests__/fonts-contract.test.ts:779-795` -- **the second pinned list.** Both fail
  the moment a third file appears under `contracts/`, which is the gate working, not a defect.
  `:832` asserts `fonts.css` declares no `@import`; that is about `fonts.css`, not the adapter.
- `.github/workflows/ci.yml:31-88` -- the `tokens-contract` job. It runs `pnpm tokens:build` and then
  `git status --porcelain --ignored=matching -- contracts/`, so **it already covers a third
  generated file with no edit to this file at all**. `ops/token-contract.md:419-441` is Probe 3, the
  demonstration that this gate sees a newly appeared file, run in Story 1-11 against exactly this
  case. No new CI job is needed and none is added.
- `tests/e2e/contract-fonts.pw.ts:34-37`, `:108-189` -- the scratch-tree pattern to follow: `__dirname`
  rather than `import.meta`, `contracts/` copied under `cuatro-contracts/` five directories deep, a
  `node:http` server on an ephemeral port, MIME by extension, and teardown that removes the tree so
  nothing reaches the closing commit. **One deviation is required:** that spec builds under
  `tmpdir()`, and the Tailwind CLI resolves `@import "tailwindcss"` by walking up from the input file
  for `node_modules`, so this story's scratch tree is built under the repository instead.
- `tests/e2e/harness.ts:11`, `:119-154` -- `RENDERED_VIEWPORT` and `computedStyleValue`, the two
  helpers to import.
- `playwright.config.ts:32-93` -- one chromium project, `workers: 1`, `retries: 0`,
  `updateSnapshots: 'none'`, and a `webServer` that builds and starts the Hub for every spec in
  `tests/e2e`. A new `*.pw.ts` is collected automatically.
- `vitest.config.ts` -- `tests/e2e/**` is excluded twice over, so a browser never joins `pnpm test`.
- `package.json:9-22` -- the script block. `packageManager` is pnpm 10.31.0; `@playwright/test` is
  pinned exact at `1.62.1`, which is the precedent for pinning the two new devDependencies exact.
- `docker/Dockerfile:1-11` and `docker/__tests__/deps-stage.test.ts:61-77`, `:174-195` -- the deps
  stage copies the root manifest, the lockfile, `pnpm-workspace.yaml` and every **workspace
  manifest**. A root devDependency changes the lockfile but adds no importer, so no `COPY` line
  moves. Verified by reading the test: it enumerates directories under `packages/` that have a
  `package.json`, and this story adds none.
- `ops/token-contract.md:63-79` -- the "what it deliberately does not publish" table, whose
  `contracts/tailwind.css` row already says "Generated from this file". `:200-243` the build inputs,
  `:301-354` the drift gate, `:532-560` the shape of stated limits and Pending Operator actions.
- Environment checked 2026-08-25 on this host: Node v24.15.0, `corepack pnpm` working, registry
  reachable, `tailwindcss` and `@tailwindcss/cli` both at **4.3.3** latest, which satisfies the
  spine's "Tailwind CSS v4" pin. Docker server 29.7.2 per `ops/rendered-output-harness.md:118`.

## Tasks & Acceptance

**Execution:**
- `packages/tokens/theme-map.json` -- new. The mapping, as data: an ordered list of sections, each
  with a title and its entries, every entry naming the Tailwind theme key and the contract token it
  reads. Covers the twelve `--token-*` roles, the three families, the type scale, weights, line
  heights, tracking, the spacing scale plus `--page-pad` and `--tap`, the radii, and `--measure` as a
  container width. It sits beside `tokens/` and not inside it, because the source glob is
  `tokens/*.json` and Style Dictionary would otherwise read it as tokens.
- `packages/tokens/build.mjs` -- extend, and only extend. Add a `cuatro/tailwind-css` format and a
  second entry to the `files` array, reading the map from `join(SOURCE_DIR, '..', 'theme-map.json')`
  so a scratch run through `CUATRO_TOKENS_SOURCE` picks up a scratch map with no third build input.
  Refuse every generator row of the I/O matrix, naming the key and the file each time. Print the
  second resolved output path before building. Change nothing about the existing format, the
  sections, or the emitted `tokens.css`.
- `contracts/tailwind.css` -- the generated and committed third published file. Never hand-edited.
- `packages/tokens/__tests__/tailwind-adapter.test.ts` -- new. Asserts the published file against
  every I/O matrix row that does not need a browser: the exact import order and that the three
  imports precede everything else, the `inline` keyword, one `@theme` block, every mapping's two
  names differing, every referenced name present in `contracts/tokens.css`, no `--c-*` reference, no
  `url()` and no `@font-face` of its own, the header version against `packages/tokens/package.json`,
  LF endings with one trailing newline, and the mappings against `DESIGN.md`'s authored block for the
  keys that block names. One standing case per generator refusal, each run against a corrupted copy
  of the inputs through `CUATRO_TOKENS_SOURCE` and `CUATRO_TOKENS_OUTPUT`, so the real `contracts/`
  is never touched.
- `packages/tokens/__tests__/tokens-contract.test.ts` -- widen the pinned published-file list at
  `:883` to the new exact set of nine, and nothing else in the file.
- `packages/fonts/__tests__/fonts-contract.test.ts` -- widen the pinned published-file list at `:782`
  the same way, and nothing else in the file.
- `package.json` -- add `tailwindcss` and `@tailwindcss/cli`, both pinned exact at the same 4.x
  version, to `devDependencies`. Leave every script and every other dependency untouched, including
  the dead `linkg`.
- `tests/e2e/contract-tailwind.pw.ts` -- new. Copies `contracts/` to `cuatro-contracts/` at a deep
  scratch path **under the repository**, writes a consumer stylesheet importing the vendored adapter
  and a fixture page whose elements are generated from `theme-map.json`, compiles it with the pinned
  Tailwind v4 CLI, serves the result over `node:http` on an ephemeral port, and reads computed styles.
  Every mapping is probed by its namespace: `--color-*` through `bg-*` and `background-color`,
  `--font-*` through `font-*` and `font-family`, `--text-*` through `text-*` and `font-size`,
  `--font-weight-*` through `font-*` and `font-weight`, `--tracking-*`, `--leading-*`, `--spacing-*`
  through `p-*` and `padding`, `--radius-*` through `rounded-*`, `--container-*` through `max-w-*`.
  Each utility's computed value is compared against a control element declaring the same token
  directly, so the assertion is the browser's own resolution rather than a string. A namespace with
  no probe rule fails the spec rather than being skipped. Removes the scratch tree in teardown.
- `ops/tailwind-adapter.md` -- new record: what the adapter publishes, the mapping table with a
  `Nature` column, what is deliberately not mapped and why (the `--ease-*` collision, the namespaces
  Tailwind v4 does not theme), why publishing it bumps no version, how it is regenerated, which gate
  covers it and why no new job was added, the two new dependencies with their measured install cost,
  where a consumer must place its compiled output for the faces to resolve, the probe output
  verbatim, the stated limits, and the Pending Operator actions.
- `ops/token-contract.md` -- amend the one row at `:72` that files the adapter as not yet published,
  and point it at the new record. Leave every figure and every other row intact.

**Acceptance Criteria:**
- Given a plain `:root` file mints zero utility classes in Tailwind v4, when `contracts/tailwind.css`
  is read, then its first three statements are `@import "tailwindcss"`, `@import "./tokens.css"` and
  `@import "./fonts.css"` in that order, followed by exactly one `@theme inline` block, and nothing
  precedes them but the generated header comment.
- Given AD-14 requires the two namespaces to differ, when the theme mappings are emitted, then every
  line maps a Tailwind key from a `--token-*`, `--f-*`, `--t-*`, `--w-*`, `--lh-*`, `--tr-*`, `--s-*`,
  `--r-*`, `--page-pad`, `--tap` or `--measure` name, no line carries the same name on both sides of
  its `var()`, no line references the `--c-*` palette, and every referenced name is one
  `contracts/tokens.css` declares.
- Given the adapter is generated output and not authored, when `pnpm tokens:build` is run twice in
  succession, then `contracts/tailwind.css` is written both times from `tokens/*.json` and
  `theme-map.json` with no hand editing, `git status --porcelain --ignored=matching -- contracts/`
  is empty afterwards, and `contracts/tokens.css`, `contracts/fonts.css` and `contracts/fonts/*` are
  byte-identical to `c07038d`.
- Given the adapter must actually mint utilities, when a scratch Tailwind v4 build importing the
  published file is compiled and loaded in the pinned browser image, then **every** mapping in
  `theme-map.json` mints a working utility whose computed value equals the same token read directly,
  covering at least the colour, font and spacing mappings, and the count of probed mappings equals
  the count in the map so the check cannot pass over nothing.
- Given the premise the adapter exists to answer, when the same fixture is compiled against
  `tailwindcss` plus `tokens.css` with no `@theme` block, then the utilities do not exist, that
  output is recorded verbatim in `ops/tailwind-adapter.md`, and the probe leaves nothing in the tree
  at the closing commit.
- Given the adapter imports `fonts.css` so the cluster gets faces and not just family names, when the
  compiled scratch build is loaded, then every woff2 it requests answers HTTP 200 and
  `document.fonts.check` reports each of the three families available, with the compiled stylesheet
  placed as `ops/tailwind-adapter.md` instructs a consumer to place it, and that placement rule is
  stated there as an observation of how the pinned CLI treats a relative `url()` across an `@import`.
- Given AD-1 bars executable code from the published surface, when the story closes, then no file
  under `contracts/` matches `\.(ts|js|tsx|jsx|mjs|cjs)$`, the published set is exactly the nine
  files both contract tests pin, and every generator file sits under `packages/tokens`.
- Given AD-16 makes the header the thing a scheduled job verifies a Satellite against, when
  `tailwind.css` is written, then it carries `Contract v1.0.0` and that version equals
  `packages/tokens/package.json`'s.
- Given AD-21 makes every CI gate blocking and `cuatro.dev` deploys from `main` on every push, when
  the diff against `c07038d` is read, then `.github/workflows/ci.yml`, `docker/Dockerfile`,
  `pnpm-workspace.yaml`, `app/`, `public/`, `.lighthouserc.js` and both other workflows are
  byte-identical, `packages/` gains no `package.json`, `corepack pnpm install --frozen-lockfile`
  still resolves two workspace projects, and the rendered-output harness still passes against its
  committed baseline with that PNG unchanged.

## Spec Change Log

## Review Triage Log

### 2026-08-25, Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 12
- defer: 0
- reject: 0
- addressed_findings:
  - `[P1]` `[patch]` **`theme-map.json` was its own oracle.** The case comparing the published block
    against the map proved the generator copied the map faithfully and nothing about whether the map
    was right, the namespace counts were derived from the same map, and the `DESIGN.md` comparison
    pins only 14 of 55 rows. Deleting `--spacing-tap`, or re-pointing `--color-accent-muted` at
    `--token-focus`, kept every gate green. A literal `EXPECTED_MAPPINGS` array of all 55 pairs, nine
    per-namespace counts filtered out of the parsed published file, and a hard total of 55 now stand
    beside it, on the shape `tokens-contract.test.ts:729-763` uses.
  - `[P2]` `[patch]` **Nothing checked that a mapping's token was the right kind for its namespace.**
    `--color-bg: var(--s-md)` satisfied every refusal, published, minted, and passed the browser
    probe, because the control element that probe compares against reads the same wrong token. A
    per-namespace table of permitted token prefixes now refuses a crossing mapping naming the key,
    the token and the permitted prefixes, with a standing case and a matrix row in the record.
  - `[P3]` `[patch]` **The acceptance probe was vacuous on seven of 55 rows.** `probe === control`
    proves nothing wherever the contract's value equals Tailwind 4.3.3's own default, which is true
    of `--r-none`, `--w-light`, `--w-medium`, `--w-bold`, `--t-sm`, `--t-base` and `--tr-body`. Every
    probed utility's compiled rule body is now required to read `var(<contract token>)`. It is the
    token and not the theme key because that is what `inline` means, which is also what settles P4.
  - `[P4]` `[patch]` **`--radius-none` was reported as minting nothing, and it does not.** Settled
    with P3's rule-body assertion: **observed 2026-08-25** against 4.3.3, the themed build compiles
    `.rounded-none { border-radius: var(--r-none) }`, where a build with no `@theme` block compiles
    `.rounded-none { border-radius: 0 }`. Defining the key replaces Tailwind's static declaration
    with one that reads the contract token, so the mapping stays and the record now carries that
    evidence beside the `--ease-*` exclusion. Both compute to `0px`, which is why only the rule body
    can tell them apart.
  - `[P5]` `[patch]` **Teardown was not robust and the scratch tree lives inside the repository.**
    `server.close()` does not resolve while Chromium holds a keep-alive socket, and a throw in
    `beforeAll` left both handles unassigned so teardown threw over the real failure and the tree
    survived. `closeAllConnections()` before `close()`, both handles guarded, the `rmSync` in a
    `finally`, a leftover sweep in `beforeAll`, an `error` handler before `listen` so a failed listen
    rejects instead of hanging, and a `.gitignore` rule beside the Playwright run-output rules.
  - `[P6]` `[patch]` **The compile was not hermetic.** `@source` adds to Tailwind's automatic source
    detection rather than replacing it, and that detection is rooted at the working directory, which
    was the repository root. What got minted could therefore move because of unrelated repository
    text, and the pinned `SHIPPED_BY_TAILWIND` split rests on exactly that. The CLI is now spawned
    with `cwd` set to the scratch root, and the record states the mechanism. Verified that the
    explicit `@source` is still honoured from a directory `.gitignore` matches.
  - `[P7]` `[patch]` Two generator edges. A map parsing to `null`, a number, a string or an array
    reached `parsed.sections` and threw a raw `TypeError` naming no file and no key; it is refused by
    name now. And a key equal to a bare namespace (`--font-weight-`) was published and minted
    nothing; the namespace is matched by longest prefix and an empty suffix is refused. One standing
    case each, plus one for the array form.
  - `[P8]` `[patch]` **Two refusals did not end with the clause the record and the docstring both
    claimed for all of them:** the missing-map message ended in lower case and the unreadable-JSON
    message ended with a raw `error.message`. `refuseAdapter` now appends the exact clause, so the
    property is structural rather than per site, and every standing case asserts it.
  - `[P9]` `[patch]` The misplaced-build check asserted only that no observed response was a 200,
    which a page requesting no woff2 at all would satisfy, while the record claimed it observed every
    face 404. It now asserts three 404s by URL and guards that at least one face was requested.
  - `[P10]` `[patch]` The four module-scope reads failed collection with a bare ENOENT while the same
    file took care to throw a named, explanatory error for the `DESIGN.md` coupling. They now get the
    same treatment.
  - `[P11]` `[patch]` Six record corrections: Probe 2's prose said "four writing lines" over a block
    showing two reading and two writing; `ops/font-contract.md:38` still said the adapter was not
    published; the amended row in `ops/token-contract.md` left a published file inside a table headed
    "what it deliberately does not publish", so the publication moved to a published-surface note and
    the row is kept struck through as history; a stated limit added for `--font-sans` and
    `--font-mono` retargeting Tailwind's `--default-font-family` and `--default-mono-font-family`,
    which changes a consumer's base body and code font; the `--spacing-tap` reachability claim is now
    asserted (`min-w-tap` and `min-h-tap` compile to `var(--tap)`) rather than stated; and Pending
    Operator actions 2 and 5 extended to cover `TAILWIND_NAMESPACES` drifting from the installed
    compiler and `AGENTS.md:7` reading "Sass (no Tailwind)".
  - `[P12]` `[patch]` **The published header told a consumer to do something no consumer does.** It
    said "compile this file into the same folder it sits in"; a consumer compiles its own entry
    stylesheet, and it is that output which must land in the vendored folder. Reworded, regenerated
    and committed. Separately, the comment at the faces check cited F-2 as though
    `document.fonts.check` carried the weight, and it does not: it answers `true` for a family with
    no matching `@font-face` rule at all, so the comment now says plainly that the HTTP 200 assertion
    beside it is what makes the check real.

No finding was deferred, rejected, or raised as an intent gap or a spec loopback. Every published
byte that moved was moved by regenerating the file, never by hand.

## Design Notes

**Why the generator is `packages/tokens/build.mjs` and not a new package.** AC 3 is written as
"rebuilding `packages/tokens` regenerates `tailwind.css`", `ops/token-contract.md:72` already records
the adapter as generated from that file, and the adapter's every value is a reference to a token in
that dictionary. Emitting it as a second file of the same Style Dictionary platform gets three things
for free: one command, one drift gate that already reads all of `contracts/` (`ci.yml:78-88`, proved
against a newly appeared file by Probe 3 in `ops/token-contract.md:419-441`), and validation of every
mapping against the dictionary the same run just published, so a renamed token fails the build rather
than shipping an adapter that silently resolves to nothing.

**Why the map is data and not code.** The names differ on purpose: `--color-surface` reads
`--token-bg-raised`, and `--color-ink` reads `--token-text`. That is a translation table, not a rule,
so it is committed as one and reviewed as one. Keeping it out of `tokens/*.json` matters mechanically:
the source glob is `tokens/*.json`, and a map file inside that directory would be read as tokens.

**What is deliberately not mapped, and the one collision.** The contract's motion easings are
`--ease-entrance`, `--ease-exit` and `--ease-toggle`, and Tailwind v4's easing namespace is also
`--ease-*`. A mapping would therefore have the identical property name on both sides of its `var()`,
which is exactly what AD-14 forbids and what the epic's second acceptance criterion names as a cycle.
Renaming a contract token is a MAJOR bump under AD-16 and is not this story's call, so the easings are
left out and recorded, and a Tailwind consumer reaches them as
`[transition-timing-function:var(--ease-entrance)]` or in plain CSS. The durations, the strokes,
`--focus-offset`, the z-layers and the elevation aliases are left out for a different reason: Tailwind
v4 has no theme namespace for them, so a mapping would mint nothing at all. The palette is left out
because it must never be consumed outside `contracts/`.

**Why publishing the adapter bumps no version.** The same reading Story 1-12 recorded and that
`DESIGN.md:805-815` supports: v1.0.0 was authored as a folder of three files, so the third is the last
instalment of a first publication rather than an addition to a shipped contract. It reads
`Contract v1.0.0`, and neither published file beside it is regenerated.

**Why the browser check is the acceptance and a unit test is not.** The epic asks for utilities
"checked in rendered output rather than read off the source", and it is right to: the failure mode
here is a mapping that parses, publishes, and mints nothing, which every string assertion passes. The
control is a second element declaring the token directly, so the two sides are the browser's own
resolution of the same value and the comparison is not an expected string a typo can be copied into.
The negative control matters as much: the same fixture compiled without the `@theme` block must
produce no utilities, which is the premise AD-14 rests on and the guard against a vacuous pass.

**The two new dependencies, and where their cost lands.** The scratch build needs a real Tailwind v4
compiler, and the only alternatives are an unpinned `dlx` in CI or asserting the compiled CSS by
reading it, which the acceptance criterion rules out. Both are pinned exact, both are
devDependencies, and neither touches the Hub: no PostCSS config, no `tailwind.config`, no import into
`app/`. The lockfile moves, no workspace importer appears, so `docker/Dockerfile` and the deps-stage
test do not. The cost lands on the `deps` and `builder` layers of a build that already runs on the
serving box, and it is measured and recorded rather than assumed, the way Story 1-11 recorded its own.

## Verification

**Commands:**
- `corepack pnpm install` then `corepack pnpm install --frozen-lockfile` -- expected: the second
  resolves against the newly committed lockfile, reports two workspace projects, and leaves
  `git status --porcelain -- pnpm-lock.yaml` empty.
- `corepack pnpm tokens:build`, run twice -- expected: succeeds, prints all three resolved paths, and
  `git status --porcelain --ignored=matching -- contracts/` shows only the one added file.
- `corepack pnpm typecheck` -- expected: pass, with the two new test files inside the program.
- `corepack pnpm test --run` -- expected: the 379 tests observed at `c07038d` still pass, plus the new
  adapter cases, and no browser starts.
- The harness in the pinned container, by the documented `docker run` command in
  `ops/rendered-output-harness.md:154-164` with `test:e2e` in place of `test:e2e:update` -- expected:
  the seventeen existing tests still pass against the unchanged baseline, and the new spec's checks
  pass with every probed mapping printed.
- Probe: compile the same fixture against `tailwindcss` plus `tokens.css` with no `@theme` block --
  expected: the utility classes are absent from the compiled output and the computed values fall back
  to the browser defaults. Record verbatim, revert.
- Probe: hand-edit one mapping in `contracts/tailwind.css`, then run `pnpm tokens:build` --
  expected: `git status --porcelain --ignored=matching -- contracts/` reports the modified file, which
  is the `tokens-contract` gate covering the third file. Revert.
- `git diff --stat c07038d -- app public .lighthouserc.js .github/workflows docker pnpm-workspace.yaml contracts/tokens.css contracts/fonts.css contracts/fonts`
  -- expected: empty output.
- Punctuation sweep over every file written, built on surrogate-pair ranges rather than `\u{...}`
  syntax and run against a positive control carrying all four forbidden forms, so it cannot pass
  vacuously (the trap recorded in `spec-1-5` finding 5 and `spec-1-9` finding 12).

**Manual checks:**
- Read `contracts/tailwind.css` and confirm by eye that the three imports lead the file in the fixed
  order, that the block says `@theme inline`, and that no line repeats a name across its `var()`.
- Compare the emitted mappings against `DESIGN.md:985-1003` key by key for the keys that block names,
  since a plausible but different key (`--color-surface` from `--token-bg-raised`) is a value no count
  assertion catches.
- Re-read `.github/workflows/ci.yml` after the run and confirm it is unchanged, because this story's
  claim is that the existing drift gate already covers the new file.

## Auto Run Result

Status: done

**What was implemented.** The v1.0.0 contract folder is complete. `contracts/tailwind.css` carries
the fixed import order (`tailwindcss`, `./tokens.css`, `./fonts.css`) and one `@theme inline` block
of **55 mappings**, generated by `packages/tokens/build.mjs` from the committed translation table
`packages/tokens/theme-map.json` and validated against the same dictionary that publishes
`tokens.css` in the same run. Every mapping was proved to mint a working utility in a real Tailwind
v4 build loaded in the pinned browser image, against a control element declaring the same contract
token directly. The premise the adapter answers was proved too: the same fixture with no `@theme`
block binds not one utility to the contract. Publishing is not adopting: the Hub is untouched and
its committed screenshot baseline is unchanged.

**No CI job was added, and that is the finding.** `.github/workflows/ci.yml` is byte-identical to
`c07038d`. The `tokens-contract` job already runs `pnpm tokens:build` and reads
`git status --porcelain --ignored=matching -- contracts/`, which covers a third generated file with
no edit, and it was observed doing so against a hand-edited committed adapter.

**Files changed.**

- `packages/tokens/theme-map.json` -- new. Nine ordered sections, 55 entries, each naming one
  Tailwind theme key and the contract token it reads. Beside `tokens/` rather than inside it,
  because the Style Dictionary source glob would otherwise read it as tokens.
- `packages/tokens/build.mjs` -- extended only. A `cuatro/tailwind-css` format, a second entry in the
  `files` array, the map path resolved from the source directory so a scratch run needs no third
  build input, and both new resolved paths printed before the build. Thirteen refusals, each naming
  the key and the file, each ending with the exact clause "Nothing was published." because
  `refuseAdapter` appends it, which Style Dictionary makes true by formatting every file in a
  platform before writing any of them. Among them a per-namespace type rule, so a length cannot sit
  in a colour slot. The existing format, the sections and the emitted `tokens.css` are unchanged.
- `contracts/tailwind.css` -- the generated and committed third published file. 4,522 bytes.
- `packages/tokens/__tests__/tailwind-adapter.test.ts` -- new. 52 cases: a literal 55-pair oracle for
  the mapping set with per-namespace counts and a hard total, the published file's shape, the AD-16
  header, the comparison against the authored block in `DESIGN.md`, and one standing case per
  generator refusal, each run against a corrupted copy of both inputs through `CUATRO_TOKENS_SOURCE`
  and `CUATRO_TOKENS_OUTPUT`.
- `packages/tokens/__tests__/tokens-contract.test.ts`, `packages/fonts/__tests__/fonts-contract.test.ts`
  -- the pinned published-file list widened to the new exact set of nine, and nothing else.
- `package.json`, `pnpm-lock.yaml` -- `tailwindcss` and `@tailwindcss/cli` pinned exact at 4.3.3 in
  `devDependencies`. 36 new lockfile entries, 0 removed, no new workspace importer.
- `tests/e2e/contract-tailwind.pw.ts` -- new. Four checks against a scratch tree with `contracts/`
  vendored five directories deep, compiled hermetically by the pinned CLI and served over
  `node:http`. Every probed utility is asserted both by computed value against a control element and
  by its compiled rule reading the contract token, so a row cannot pass on a coincidence of values.
- `.gitignore` -- one rule for the scratch tree, beside the Playwright run-output rules.
- `ops/tailwind-adapter.md` -- new record. `ops/token-contract.md` and `ops/font-contract.md` -- the
  lines that said the adapter was not published yet.

**Verification performed**, all on 2026-08-25:

- `corepack pnpm install --frozen-lockfile` -- "Lockfile is up to date, resolution step is skipped",
  "all 2 workspace projects", 764 ms, and the lockfile byte-identical before and after.
- `corepack pnpm typecheck` -- pass, with both new files inside the program.
- `corepack pnpm test --run` -- **431 passed, 21 files, 76.6 s**, up from the 379 observed at
  `c07038d`. No browser started.
- `corepack pnpm tokens:build` run twice -- all four resolved paths printed,
  `git status --porcelain --ignored=matching -- contracts/` shows only the one added file, and
  `contracts/tokens.css`, `contracts/fonts.css` and `contracts/fonts/*` are byte-identical to
  `c07038d`.
- `pnpm test:e2e` in `mcr.microsoft.com/playwright:v1.62.1-noble` -- **21 passed**, the seventeen
  existing tests against the unchanged baseline PNG plus the four new ones. All 55 mappings printed
  with their computed values.
- Probe: the drift gate observed failing against a hand-edited committed adapter, output quoted
  verbatim in `ops/tailwind-adapter.md`. The probe commit was removed.
- Probe: the negative control observed producing no contract-bound utility, output verbatim in the
  record. Thirteen of the 55 utility names turn out to exist in stock Tailwind v4 carrying Tailwind's
  own values, which is recorded rather than glossed, and the check asserts none of them reads a
  contract token.
- Probe: the identical compiled build placed one directory outside the vendored folder observed
  404ing all three faces, which is what makes the placement rule in the record an observation.
- `git diff --stat c07038d -- app public .lighthouserc.js .github/workflows docker
  pnpm-workspace.yaml contracts/tokens.css contracts/fonts.css contracts/fonts` -- empty.
- Punctuation sweep over every file written, on surrogate-pair ranges, against a positive control
  carrying an em-dash, an en-dash, a double-dash and two emoji. All five patterns fired on the
  control first. No em-dash, en-dash or emoji in any swept file. Every double-dash hit is a CSS
  custom property name, a CLI flag, a git pathspec separator, an ASCII rule in a comment, or a
  markdown table rule.

**Three findings worth carrying forward.**

1. **`DESIGN.md:1001` names `--radius-DEFAULT`.** In Tailwind v4 that mints `.rounded-DEFAULT`, not
   the bare `.rounded`, which keeps its own hardcoded `0.25rem`. The `*-DEFAULT` convention is a v3
   idiom. It is left out of the map and recorded as Pending Operator action 1.
2. **The pinned CLI does not rebase `url()` across an `@import`.** The compiled output carries
   `./fonts/...` verbatim, so a consumer's compiled output must land in the vendored
   `cuatro-contracts/` folder or every face 404s silently. Stated as a rule in
   `ops/tailwind-adapter.md`, carried in the published header, and measured both ways in the harness.
3. **Adopting the adapter changes a consumer's base body and code font.** Tailwind derives
   `--default-font-family` from `--font-sans` and `--default-mono-font-family` from `--font-mono`,
   and Preflight sets those on `html` and on `code`, `pre`, `kbd` and `samp`. That is the intended
   outcome of adopting a type contract, and it is the one mapping whose effect reaches elements
   nobody opted in, so it is a stated limit rather than a footnote.

**Residual risks.**

- The four new browser checks have never run on a GitHub runner. Pending Operator action 4.
- Every figure here is a fact about Tailwind 4.3.3, the pinned set of stock utility names included.
  Pending Operator action 2.
- Tailwind's paired `--text-*--line-height` defaults survive under the overridden sizes, so
  `.text-sm` still carries a line height from Tailwind's scale. Stated limit.
- The browser check builds its scratch tree inside the repository, because the CLI cannot resolve
  `@import "tailwindcss"` from `tmpdir()`. Teardown is guarded and runs its removal in a `finally`,
  the next run sweeps any leftover, and `.gitignore` keeps one out of a commit, but a hard kill of
  the process still leaves a tree on disk until the next run.
- `TAILWIND_NAMESPACES` in `packages/tokens/build.mjs` is a hand-copied transcription of Tailwind
  v4's theme namespace list, and nothing compares it to the installed compiler. A namespace added
  upstream would be refused here; one removed upstream would be accepted and mint nothing. Pending
  Operator action 2.
