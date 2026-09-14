---
title: "Story 2.28: Redesign `ScanlineOverlay` as the scrim layer, consuming `--token-scrim`"
type: 'feature'
created: '2026-09-14'
status: 'in-progress'
baseline_commit: '1addf8cda10c92d3bea0ba7eb8a54fc6922860f6'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** `ScanlineOverlay` is the cybercore raster: a `radial-gradient` vignette and a
`repeating-linear-gradient` scanline stack in pure black at two alphas (`ScanlineOverlay.scss:6`,
`:16-17`), an SVG `feTurbulence` grain looping at 2.5 steps a second (`:37-39`, F-7, DW-32), a
`light` / `full` intensity prop, and a hand-written `z-index: 10` that equals `--z-raised` by value
and resolves to nothing (KV-6 rows `z-scanline`, `gradient-scanline-vignette`,
`gradient-scanline-lines`). It is rendered on the two surfaces where the design says a scrim must be
absent: `/work`'s hero, where the display line sits beside the canvas rather than over it
(`WorkHero.tsx:56`), and the 404, where nothing moves (`Error404.tsx:57`). The legibility job the
raster was incidentally doing is a contract role, `--token-scrim`, shipped in `v1.0.0`, and nothing
consumes it.

**Approach:** Rebuild the component as the scrim layer the design specifies: one flat
`var(--token-scrim)` at `var(--z-raised)`, `pointer-events: none`, `aria-hidden`, no prop, no child,
no gradient, no asset, no animation, covering the box it is placed in. Remove both call sites,
because neither is text over moving imagery, and leave the layer with no consumer until Story 2-29
places it across the home canvas. Close the three ledger rows, F-7 and DW-32 with the file; regenerate
the `/work` baseline in the pinned image as the deliberate render change it is; weigh the deletion.

## Boundaries & Constraints

**Always:**

- **Precedence** (`RESTYLE-SPEC.md` § The vocabulary): `DESIGN.md:366-429` and `:739-748` win any
  value, `EXPERIENCE.md:471-490` any behaviour, `RESTYLE-SPEC.md:557-626` geometry.
- **The layer is exactly** `position: absolute; inset: 0; z-index: var(--z-raised);
  pointer-events: none; background-color: var(--token-scrim);` on one element carrying
  `aria-hidden='true'` and nothing else: no `rgba()`, no `#000`, no `--c-*`, no gradient function, no
  `url()`, no `@keyframes`, no `animation`, no `opacity`, no media query, no modifier class, no
  `z-index` digit. A literal reproducing the composited colour is a contract break (`epics.md:3229-3231`).
- **One state.** The component takes no props: `intensity` is retired, and a scrim that varies is a
  scrim whose guarantee varies (`EXPERIENCE.md:477-479`). Present at its one value or absent, never
  faint.
- **Placement is text over moving imagery and nothing else** (`EXPERIENCE.md:480-481`,
  `DESIGN.md:414-416`). Both shipped call sites leave: `/work`'s hero separates the display line from
  the canvas at every width (`WorkHero.scss:3-4`, `:43-44`; rule 5 at `DESIGN.md:428-429`), and the 404
  has no moving imagery (`epics.md:3252`, Story 2-30's own criterion at `:3385`). No new call site: the
  home canvas is Story 2-29's placement and carries the z-level trap (`epics.md:3267-3272`).
- **The four things move** for each of the three KV-6 rows (`ops/known-violations.md:526-532`): the
  record row, the `EXEMPTIONS` entry, the "What is in breach" cell, and KV-6's heading and index row
  (seven `z-index` literals become six in three files, eight depth tells become six in three files,
  `2-28` leaves the index row's Retired by cell; `ops/__tests__/hub-accessibility-pass.test.ts:596-620`
  pins the sums and the closers exactly). The record's `z-scanline` pin at `:273-276` moves to a row
  that is still in both files.
- **`ScanlineOverlay.scss` joins `TOKEN_NATIVE_STYLESHEETS`** (`app/__tests__/anchor-contract.test.ts:284-315`),
  the `GlitchText.scss` precedent at `:295-298`, and claim four (`:897-908`) is seen failing first with
  the path left out.
- **The `/work` baseline regenerates under case 1** (`ops/rendered-output-harness.md:277-280`): inside
  `mcr.microsoft.com/playwright:v1.62.1-noble` only, after a plain run against the old baseline has
  printed its differing-pixel count, with the new sha256 as a fourth row in the table at `:203-206`.
- **CSS weight is Observed against Story 2.2's baseline** (`epics.md:3108-3111`): `corepack pnpm build
  && node ops/asset-budget.mjs` on `dev` before the change and on the branch after it, plus the gzipped
  bytes of every `.next/static/chunks/*.css`, recorded in `ops/asset-budget.md` as a dated reading with
  a Derived delta against the 2026-09-14 reading after Story 2-27 (`:471-541`), in that shape. The
  raster's deletion is a number, never a claim.
- **Records:** every value Observed with its method or Decision with its reason, dates ISO 8601, story
  ids hyphenated (`ops/known-violations.md:17-20`); a citation that drifts is amended in place and dated
  (`:581-585`). Prose carries no dash-as-punctuation and no emoji.

**Ask First:**

- Any placement of the layer on a route before Story 2-29, or any edit to `HomeLayout.tsx` or
  `HomeLayout.scss`.
- Any edit to `contracts/`, `.github/workflows/`, or to another story's Playwright spec beyond the
  three `EXEMPTIONS` rows this story deletes. The one `playwright.config.ts` edit is the comment at
  `:75-78`, listed in the Code Map; nothing else in that file.
- Renaming the component, its directory, or its class: the `GlitchText` precedent keeps the shipped
  name through the rebuild, and this spec follows it unless the Operator says otherwise.
- A regenerated baseline whose diff is not confined to the hero's raster and grain: that is a finding,
  not a refresh (`ops/rendered-output-harness.md:285-289`).

**Never:**

- No restyle of `WorkHero.scss`, `error-page.scss` or `HomeLayout.scss`, and no edit to `Error404.tsx`
  or `WorkHero.tsx` beyond removing the import, the element and the docblock sentence that books the
  overlay to Story 2-30 (Stories 2-33, 2-30 and 2-29 own the rest).
- No `ScanlineOverlay` fingerprint in `ops/asset-budget.mjs`: the tool fingerprints libraries, and the
  stylesheet's disappearance from the build is what the per-chunk `.css` weighing records.
- No new `ci.yml` job, no new Playwright spec, no `toHaveScreenshot` beyond the one that exists, no
  edit inside `AGENTS.md`'s managed block, no `CHANGELOG.md` entry (unmaintained since 2026-03-30), no
  edit to `EXPERIENCE.md` or `DESIGN.md` (the two retracted sentences the story flags were corrected
  on 2026-08-16 at `DESIGN.md:744-748` and `:764-765`; nothing is left to delete).
- No `git` operation on the box, no deploy, no merge to `main`, no push from the implementation step.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Render | `<ScanlineOverlay />` | Exactly one element, `div.scanline-overlay[aria-hidden='true']`, with no child node, no text, no `role`, no `tabindex`; `queryAllByRole` finds nothing | |
| The retired prop | `<ScanlineOverlay intensity='light' />` under `tsc --noEmit` | A type error, held by a `// @ts-expect-error` line in the component test that `corepack pnpm typecheck` refuses if the prop is ever accepted again | |
| The stylesheet | `ScanlineOverlay.scss` read as text | Names `var(--token-scrim)`, `var(--z-raised)` and `pointer-events: none`, each read back off `contracts/tokens.css` rather than typed; carries none of `rgba(`, `#000`, `gradient(`, `url(`, `@keyframes`, `animation`, `opacity`, `__light`, `__full`, `__grain`, or a `z-index:` followed by a digit | The test names the offending token |
| The built CSS | `.next/static/chunks/*.css` in the pinned image | The tally reads six `z-index` literals and six depth tells, every one claimed by a remaining row; `radial-gradient(` and `repeating-linear-gradient(` occur zero times; no chunk carries `.scanline-overlay`, `feTurbulence` or `grain-shift` | The tally names an unlisted occurrence or a stale row |
| `/work` at 360x800 | The regenerated baseline | The hero's display line and meta sit on the `body#work` ground with no raster and no grain over them; the canvas is masked as before; the plain run against the old baseline printed a differing-pixel count above the 288-pixel allowance, recorded | A diff outside the hero is a finding |
| The 404 | `/a-route-that-does-not-exist` | Renders `.error-page` with no `.scanline-overlay` descendant and its two exits unchanged; `secondary-surfaces.pw.ts` and `hit-target-floor.pw.ts` pass as before | |
| The contract | `contracts/tokens.css` | Untouched: `--c-scrim` at `:24`, `--token-scrim` at `:38`, `--z-raised` at `:130` are consumed, not added, and no version moves | |

</frozen-after-approval>

## Code Map

**The component**

- `components/atoms/ScanlineOverlay/ScanlineOverlay.tsx` (14 lines): `ScanlineOverlayProps` and
  `intensity` (`:3-7`), the modifier class and the `__grain` span (`:8-10`) go. The new file imports
  `./ScanlineOverlay.scss`, carries a docblock stating what the layer is (one flat `--token-scrim` at
  `--z-raised` between moving imagery and text, `DESIGN.md:739-748`), why it has no prop
  (`EXPERIENCE.md:477-479`), its placement contract (it covers the positioned box it is placed in, so
  the parent is the imagery's box; no consumer until Story 2-29, `epics.md:3286-3361`), and renders
  `<div className='scanline-overlay' aria-hidden='true' />`. No `'use client'`, no hook.
- `components/atoms/ScanlineOverlay/ScanlineOverlay.scss` (55 lines): rewritten to the five
  declarations in Boundaries, with a heading comment in the `GlitchText.scss:1-6` shape naming the
  design sections and that the vignette, the raster, the grain and its loop are deleted, not
  tokenised. The roles: `contracts/tokens.css:38` `--token-scrim` (onto `:24` `--c-scrim`, the one
  alpha in the contract, `DESIGN.md:339-342`), `:130` `--z-raised`. `SkipControl.scss:25` is the
  existing `var(--z-raised)` call site and the sweep's proof that a `var(--z-*)` is not a tell
  (`accessibility-floor.pw.ts:930-931`, `:1846`).
- `components/atoms/ScanlineOverlay/__tests__/ScanlineOverlay.test.tsx` (21 lines): rewritten to the
  matrix's first three rows. The stylesheet read follows `GlitchText.test.tsx`'s source-read case;
  the role names are read off `contracts/tokens.css` the way `anchor-contract.test.ts:854-860` reads
  its pins, so a renamed role fails loudly rather than agreeing with a stale string.

**Consumers**

- `components/organisms/WorkHero/WorkHero.tsx:10` the import, `:56` the element: both deleted.
  `WorkHero.scss:1-51` is untouched (`position: relative`, the two-column grid, `z-index: 2` on the
  text and canvas wraps stay Story 2-33's ledger row `z-work-hero`). `__tests__/WorkHero.test.tsx`
  mocks `gsap`, `ScrollTrigger`, `useGsapContext` and `TorusCanvas` only; untouched.
- `components/organisms/ErrorPage/Error404.tsx:6` the import, `:57` the element: both deleted;
  `:24-26` the docblock sentence booking the `ScanlineOverlay` to Story 2-30 gets a dated clause (the
  layer left with Story 2-28 on 2026-09-14, because nothing moves here). `error-page.scss` untouched;
  `__tests__/Error404.test.tsx` untouched.

**Pins on the contract partition**

- `app/__tests__/anchor-contract.test.ts:284-315` `TOKEN_NATIVE_STYLESHEETS`: add
  `'components/atoms/ScanlineOverlay/ScanlineOverlay.scss'` in path order with a comment in the
  `:295-298` shape (a rebuild; the 2023 raster left with its literals and the file names the scrim
  and the raised layer directly). Claim four at `:897-908` is the one seen failing first.

**The ledger, its record, and the suites that hold them equal**

- `tests/e2e/accessibility-floor.pw.ts:221-228` `z-scanline`, `:269-276` `gradient-scanline-vignette`,
  `:277-284` `gradient-scanline-lines`: deleted (two-space indent, one object per row; the parser at
  `hub-accessibility-pass.test.ts:90-122` refuses a reflow). The header prose at `:26-30` describes
  the tally, names no count; untouched.
- `ops/hub-accessibility-pass.md:246`, `:252`, `:253`: the three rows deleted. `:36` the z-index
  literals row and `:37` the depth tells row each get a dated re-reading in the `:37` shape (six
  literals: `20`, `5`, `3`, and `2` three times; `radial-gradient(` and `repeating-linear-gradient(`
  zero, six in all). `:260-263` "Why `z-scanline` is a row" becomes history with a dated first
  sentence; the decision it records (the sweep reads text) stands. `:296` F-7 gets a "Closed
  2026-09-14 by Story 2-28" clause in the `:297` F-8 shape (findings are annotated, never deleted,
  `:484-485`). `:389` the A-14 decision cites `ScanlineOverlay.tsx:8` as the `aria-hidden` precedent:
  the citation is amended in place to the new line with the date. `:392` the built-CSS decision cites
  `ScanlineOverlay.scss:4`'s literal as its reason: reworded as the case that held until 2026-09-14.
- `ops/__tests__/hub-accessibility-pass.test.ts:273-276`: the "really in both files" pin moves from
  `z-scanline` to `z-work-hero`, with the comment rewritten (the row Story 2-33 closes, the last of the
  redesigns to land; the literal-equals-a-token reason left with the row). `:337-350` (closer on the
  board and not `done`), `:356-366` (cited lines carry the tell), `:596-620` (sums and closers) and
  `:632-646` (six harness rows) then pass without edits.
- `ops/known-violations.md:67` the index row (Six z-index literals, six depth tells; Retired by names
  Stories 2-29, 2-30, 2-31, 2-32 and 2-33), `:472` the heading, `:479-485` the counts paragraph (a
  dated clause: six and six since 2026-09-14, when Story 2-28 deleted the raster, the second rebuild to
  land), `:510` "What is in breach" (six literals in three files, six depth tells in three files, the
  `ScanlineOverlay.scss` clauses moved into a dated "until" sentence in the cell's existing shape),
  `:516` (Story 2-28's clause reads as landed), `:518` Retired by (Story 2-28 went second, on
  2026-09-14, deleting its three rows with the raster), `:519` (the `10` case reads as the case that
  held until Story 2-28).

**The harness record and the baseline**

- `tests/e2e/rendered-output.pw.ts-snapshots/work-360x800-chromium-linux.png`: regenerated in the
  pinned image by `pnpm run test:e2e:update` (`ops/rendered-output-harness.md:247-256`, the docker
  block), after a plain `pnpm test:e2e` against the old file has printed the differing-pixel count.
- `ops/rendered-output-harness.md:198-206`: the current sha256 line, "regenerated twice" to three
  times, a fourth table row (sha256, Story 2-28, 2026-09-14, what changed on `/work`: the hero's
  raster and grain left with the overlay, N pixels differed, printed before the update).
- `playwright.config.ts:75-78`: the comment's second clause (the grain animation behind a
  reduced-motion query) becomes history; the reduced-motion context stays for the GSAP tweens.

**Weight**

- `ops/asset-budget.md:469-541`: a new "### The 2026-09-14 reading, after Story 2-28" above the
  Story 2-27 reading, in its shape (`:471-480` the verbatim header, `:489-500` the before/after table,
  `:511-541` the Derived paragraphs), with the `.css` chunk that carried `.scanline-overlay` and the
  `feTurbulence` data URI as the named mover; `:922-949` a matching "### The 2026-09-14 run, after
  Story 2-28" under § Findings. The before is `dev` at `1addf8c`, whose build should reproduce the
  Story 2-27 after figures (21 `.js`, 14 `.css`; 619,573 gzipped; 9,195 gzipped of `.css`).

**Prose that names the raster**

- `components/molecules/GlitchText/GlitchText.scss:5-6`: "which Story 2-28 retires" becomes a dated
  "retired by Story 2-28 on 2026-09-14".
- `_bmad-output/implementation-artifacts/deferred-work.md:2708-2720` DW-32: a dated closure paragraph
  in the DW-31 shape (`:2696-2705`), `status: done`. `:3274` the `ScanlineOverlay.tsx:8` citation
  amended in place. A new entry, DW-101, source this spec: the composited-contrast verification of
  `--token-scrim` beneath the five roles by screenshot sampling (`epics.md:3254-3261`) runs where the
  layer first sits beneath text, which is Story 2-29's home canvas; owner Story 2-29, trigger its first
  placement of the layer.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:215`: the key renamed in place to
  `2-28-redesign-scanlineoverlay-as-the-scrim-layer-consuming-token` per `epics.md:4936-4957`
  (Operator ruling 2026-09-14; 2-31's paired rename stays with 2-31), `backlog` to `review`, with a
  comment block in the `:205-213` form.

## Tasks & Acceptance

**Execution** (in this order):

- [ ] On `dev` at `1addf8c` before branching: `corepack pnpm build && node ops/asset-budget.mjs` and
      the gzipped size of every `.next/static/chunks/*.css`, saved to the scratchpad as the before
      reading; confirm it reproduces the Story 2-27 after figures.
- [ ] Branch `story/2-28-redesign-scanlineoverlay-as-the-scrim-layer-consuming-token` off `dev`.
- [ ] `ScanlineOverlay.scss`, `ScanlineOverlay.tsx`, `__tests__/ScanlineOverlay.test.tsx`: the rewrite
      as the Code Map states; run the test file and see the stylesheet read fail first against the old
      file.
- [ ] `WorkHero.tsx`, `Error404.tsx`: the import and the element out; the 404 docblock clause.
- [ ] `app/__tests__/anchor-contract.test.ts`: run the file with the path left out and see claim four
      fail naming `ScanlineOverlay.scss`; then add the entry.
- [ ] `tests/e2e/accessibility-floor.pw.ts`, `ops/hub-accessibility-pass.md`,
      `ops/__tests__/hub-accessibility-pass.test.ts`, `ops/known-violations.md`: the three rows, the
      four things, the pin, the annotations; `corepack pnpm test --run ops/__tests__/hub-accessibility-pass.test.ts`
      green.
- [ ] `playwright.config.ts:75-78`, `GlitchText.scss:5-6`: the two comments.
- [ ] Branch build: `corepack pnpm build && node ops/asset-budget.mjs` and the `.css` sizes again;
      `ops/asset-budget.md`: the dated reading and run, the Derived delta.
- [ ] Container, three runs in order: `pnpm test:e2e` (the old baseline fails with its pixel count,
      the KV-6 tally passes with the rows gone), `pnpm run test:e2e:update` (the new baseline),
      `pnpm test:e2e` (green, no filter). `ops/rendered-output-harness.md`: the sha256 row.
- [ ] `deferred-work.md`: close DW-32, amend `:3274`, file DW-101.
- [ ] `corepack pnpm test --run`, `corepack pnpm typecheck`; commit on the branch (no push and no remote
      operation from the implementation step; the push and the PR to `dev` follow the review);
      `sprint-status.yaml`: the rename, `review`, the comment block.

**Acceptance Criteria:**

- Given the rewritten component, when `corepack pnpm test --run components/atoms/ScanlineOverlay` runs,
  then one `aria-hidden` element with no child renders, the stylesheet names the two roles read off
  the contract and none of the ten refused tokens, and `corepack pnpm typecheck` refuses `intensity`.
- Given the pinned image's build, when `accessibility-floor` runs, then the tally reads six `z-index`
  literals and six depth tells with no stale row and no unlisted occurrence, and
  `hub-accessibility-pass.test.ts` passes in both directions with `2-28` gone from the index row.
- Given `/work` at 360x800, when the harness runs against the old baseline, then it fails naming a
  pixel count above 288, and after the update run the committed PNG passes with its sha256 recorded.
- Given the before and after builds, when `ops/asset-budget.md` is read, then the dated reading states
  the `.css` gzipped bytes before and after, the chunk that left, and the Derived delta against the
  Story 2-27 reading, each a number with its method.
- Given `corepack pnpm test --run` and `corepack pnpm typecheck`, when they run, then every file
  passes, `anchor-contract` claim four having been seen failing first.

## Spec Change Log

## Design Notes

**Why no consumer.** The layer exists for text over moving imagery, and the shipped site has that
overlap on one surface only, the home canvas beneath the corner panels, which Story 2-29 rebuilds
with the sticky header that makes the placement a stacking question rather than a colour one
(`epics.md:3286-3361`). Placing it there now would be that story's work done half: the gem sits at a
literal `3` and the panels at `5` (`HomeLayout.scss:181`, `:39`), both ledger rows Story 2-29 closes.
The two surfaces that carry the raster today are both places the design says a scrim must be absent,
so the honest state after this story is a component with a contract and no call site, the way
`--token-scrim` itself sat in the contract with no consumer since Story 1-11.

**Why the sampling verification is carried.** `epics.md:3260-3261` asks for the guarantee to be
verified by screenshotting the composited surface and sampling the ground beneath the text. No
surface composites the layer beneath text until Story 2-29 places it, and a probe over an injected
element would measure the token's arithmetic rather than the site. The method is filed as DW-101
against Story 2-29's first placement, beside the stack constraint `epics.md:3272` already carries
there.

**Why the name stays.** `GlitchText` kept its name through Story 2-27 although it glitches nothing
now; `ScanlineOverlay` follows, with the docblock saying what it is. A rename is one `git mv` and a
handful of paths, and it is the Operator's call, not a stylesheet's.

**Rollback.** Revert the commit; the raster, the two call sites, the three rows, F-7's open state
and the old baseline return together, and the records carry no runtime.

## Verification

**Commands:**

- `corepack pnpm test --run components/atoms/ScanlineOverlay` : the rewritten cases pass, the
  stylesheet read having been seen failing against the old file.
- `corepack pnpm test --run app/__tests__/anchor-contract.test.ts` : claim four seen failing with the
  path left out, then green.
- `corepack pnpm test --run ops/__tests__/hub-accessibility-pass.test.ts` : green in both directions.
- `corepack pnpm test --run` : every file passes (890 tests in 34 files at the baseline; the count may
  move by this story's own cases).
- `corepack pnpm typecheck` : clean, the `@ts-expect-error` line consumed.
- `corepack pnpm build && node ops/asset-budget.mjs` : on `dev` before and on the branch after; the
  `.css` chunk carrying `.scanline-overlay` present before and absent after.
- The docker block at `ops/rendered-output-harness.md:247-256`, three times: `pnpm test:e2e` fails
  only on the old baseline with its pixel count; `pnpm run test:e2e:update` writes the new PNG;
  `pnpm test:e2e` green with no filter.

**Manual checks:**

- `git diff --stat` names no file outside the Code Map.
- The regenerated PNG, opened beside the old one: the change is confined to the hero's raster and
  grain.
