---
title: 'Story 2.33: Redesign `WorkHero` and `WorkTimeline` token-native'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_commit: '70cdbbd824819ef3fb41df6a018efa588c387f26'
review_loop_iteration: 0
warnings: ['oversized']
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** `/work` is the last Hub surface painted from 2023 values. The hero reads six aliases, two
bare `z-index: 2`, a `42vh` floor and `overflow: hidden`; it sets its display line in secondary text and
its meta line as free mono text carrying a `//` a screen reader speaks; it fetches three.js, R3F and
drei with the document and draws the torus under reduced motion; the torus trails the scroll by 1.5s;
and the heading slides in from script after hydration. `body#work` paints `#0a000f` under a
two-gradient grid. The timeline fades every row up on scroll entry with no motion preference read,
pads itself inside a container that already pads, and draws a separator under its last row.

**Approach:** Rebuild `WorkHero.scss` and `WorkTimeline.scss` against `contracts/tokens.css` alone,
make the meta line a Plate mark, move the whole torus behind one contained `next/dynamic` boundary that
is never rendered under reduced motion, bind it with `scrub: true`, turn the entrance into one CSS
opacity keyframe, delete the timeline's scroll batch and `body#work`, and retire in the same change
what this story closes: KV-5 (the A-5 sweep widened to every element), KV-6, F-11 and the deferred
items booked here.

## Boundaries & Constraints

**Always:**

- `WorkHero.scss` and `WorkTimeline.scss` read contract roles only (`--token-*`, `--f-*`, `--t-*`,
  `--w-*`, `--lh-*`, `--tr-*`, `--s-*`, `--stroke-*`, `--dur-*`, `--ease-*`): no alias, no colour or
  length literal outside a media condition, no `rgba()`, gradient, shadow, `z-index`, `url(`,
  `overflow: hidden`, `transition` or custom property of their own.
- `WorkTimeline` keeps its elements, its `openId` state, its one-open toggle and its no-prop signature;
  its `ul` gains `role='list'` and nothing else. `WorkItem` is not edited. `/work` and `/cv` keep
  rendering the timeline, one mount per document.
- The heading stays the document's one `<h1>`, same words and `<br />`, outside any `aria-hidden`
  subtree; `aria-hidden` stays on the canvas and its wrappers only (`Scene.tsx`, unchanged).
- `WorkHero` imports nothing from `three`, R3F or drei, directly or through a static import; the
  dynamic torus is not rendered on the server, on the first client render, or while
  `prefers-reduced-motion: reduce` matches, and a failed import resolves to a component that draws
  nothing and logs.
- Every ledger row, register cell, finding and deferred entry this story closes moves in the same
  commit as the repair, in every file that holds it; a retired entry keeps its history.
- No `.tsx` names a contract token or the path `contracts/`, comments included.
- The `/work` baseline is regenerated inside `mcr.microsoft.com/playwright:v1.62.1-noble` only, its
  sha256 recorded in `ops/rendered-output-harness.md`.

**Ask First:**

- Changing `contracts/`, `epics.md`, `DESIGN.md`, `EXPERIENCE.md` or `RESTYLE-SPEC.md`.
- Editing `WorkItem.tsx`, `WorkItem.scss`, `Scene.tsx`, `PlateMark.*` or `hooks/useNarrativePath.ts`.
- Changing the hero's words beyond dropping the meta line's `//`.

**Never:**

- No new dependency and no motion library; GSAP stays, for the scroll binding only.
- No scroll-triggered entrance, no transform in the entrance, no loading state for the canvas, no
  still or image in the torus's place.
- No change to `CanvasOrbitControls` or the torus's pointer rotation: an interaction the restyle
  ceiling keeps, filed for the Operator.
- No skip link, `<main>` or new landmark on `/work` (re-booked by Story 2-32).
- No `eslint` invocation and no lint criterion.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Wide, motion allowed | `/work` at 768 to 2400, `no-preference` | Two columns, display line left (`3fr`), canvas right (`2fr`, `4 / 3`), a canvas mounted; the hero closed beneath by `--stroke-boundary` in `--token-border-interactive` | N/A |
| Narrow, motion allowed | `/work` at 360 | One column: the annotated mark, the heading, the meta mark, then the canvas box full width at `4 / 3`; nothing past either edge | N/A |
| Reduced motion | The project's `reduce` context, any width | One column, the wrap `display: none`, no `<canvas>`, no WebGL-carrying script requested, no ScrollTrigger, heading and meta at full opacity with `animation: none` | Preference turned on mid-session: the torus unmounts and the wrap hides |
| Chunk fails | `no-preference`, every WebGL-carrying script aborted | Heading, both marks and four rows render; the wrap stays empty; no uncaught error; one console error naming the torus | The loader's `catch` and `??` |
| No script | JavaScript disabled | Server markup, the wrap empty; heading and meta reach full opacity by CSS alone | N/A |
| Entrance | `no-preference` load | Heading at 100ms, meta mark at 400ms, one `work-hero-enter` opacity keyframe each on `--dur-minor` and `--ease-entrance`, fill `both`; nothing else in the hero or the timeline animates | N/A |
| Scroll | Motion allowed, page scrolled | Rotation tracks the scroll through `scrub: true`, `top bottom` to `bottom top` | N/A |
| Rows | `/work`, `/cv`, each row scrolled into view | Opacity 1, identity transform, no running animation, no inline style | N/A |
| Last row | `/work`, `/cv` | Every row but the last draws the 1px `--token-border` separator; the last draws none | N/A |
| Display line | 360, 768, 1024, 1280, 2400 | Display roles; no word broken across two lines | `overflow-wrap: break-word` below the 360 floor |
| Meta line | `/work` | Section Plate mark reading `<n> POSITIONS` (n = rows) and `2017 - PRESENT`, no `//` | N/A |

</frozen-after-approval>

## Code Map

**The hero** (graphify `affected WorkHero`: `app/work/page.tsx:L3`, `WorkHero.test.tsx:L2`)

- `components/organisms/WorkHero/WorkHero.tsx` (76): `:24-51` the two GSAP entrance tweens (deleted)
  and the scroll binding, `scrub: 1.5` at `:48`; `:66-68` the meta `<p>`, which becomes a section Plate
  mark inside `div.work-hero__meta`; `:9` and `:71-73` the static `TorusCanvas` import, which becomes a
  `next/dynamic` import rendered from effect-set state.
- `components/organisms/WorkHero/WorkHero.scss` (51): rewritten. Aliases at `:7,8,19,24,28,30`;
  `z-index: 2` at `:15,40` (ledger row `z-work-hero`); `min-height: 42vh` `:6`; `overflow: hidden`
  `:9`; length literals `:7,14,21,29,39,48`; tracking `:31`.
- `components/molecules/TorusCanvas/TorusCanvas.tsx` (25): `:8-10` a nested `dynamic(Scene)`, which
  becomes a static `Scene` import now that the whole module sits behind `WorkHero`'s boundary
  (`GemNarrative.tsx:32-41`, the one-boundary shape).
- `components/molecules/GemComponent/GemComponent.tsx:16-37`: the containment to copy
  (`.then((m) => m.X ?? (() => null)).catch(...)`, logged).
- `components/molecules/PlateMark/PlateMark.tsx:40-73`: the section variant takes `{ label, domain }`
  and uppercases every cell.
- `hooks/useReduceMotion.ts:25-37`: the docblock says nothing branches on the hook in render output;
  `WorkHero` now derives a render branch from it through effect-set state.
- `components/organisms/WorkHero/__tests__/WorkHero.test.tsx` (51): rewritten.

**The timeline** (graphify `affected WorkTimeline`: `app/cv/page.tsx:L4`, `app/work/page.tsx:L4`,
`WorkTimeline.test.tsx:L2`, `app/cv/__tests__/page.test.tsx:L3`)

- `components/organisms/WorkTimeline/WorkTimeLine.tsx` (49): `:3-11,16-30` the `ScrollTrigger.batch`
  fade-up, its imports and `listRef` (deleted); `:37` the `ul`.
- `components/organisms/WorkTimeline/WorkTimeline.scss` (8): rewritten. The separator it drops on the
  last row is `WorkItem.scss:27`.
- `components/organisms/WorkTimeline/__tests__/WorkTimeline.test.tsx` (71).
- `app/app.scss:134-143`: `body#work` (ledger row `gradient-work-ground`, F-11, DW-8), deleted.

**Tests that read `/work` and move with it**

- `tests/e2e/rendered-output.pw.ts:11-23,104-155`: the canvas mask and the `--monument-bold` probes.
- `tests/e2e/plate-mark-and-work-item.pw.ts:36-42` (waits for a canvas the `reduce` context never
  mounts), `:178-184`, `:212-247`, `:306-318` (`MARKS`, `MARKS_PER_ROUTE`), `:436-465` (strict-mode
  reads of `.plate-mark` meet two marks), `:585-626` (every row's separator, the `/work` ground).
- `tests/e2e/type-swap.pw.ts:116-122,141-159` (`settle` on the canvas); `tests/e2e/chrome-nav.pw.ts:300-307,1039-1042`
  (canvas wait); `tests/e2e/cv.pw.ts:216-243` (the control reads `/work`'s override).
- `tests/e2e/anchor-aliases.pw.ts:24-28,135-162,305-392,452-517,630-728` (`CALL_SITES`,
  `WEIGHT_SITES`, their per-site cases).
- `tests/e2e/accessibility-floor.pw.ts:196-216` (`EXEMPTIONS`, both rows 2-33's).
- `tests/e2e/hit-target-floor.pw.ts:40-52,738-755,934-1033,1406-1515` (A-5 on interactive elements).
- Comments this story makes false: `tests/e2e/narrative.pw.ts:572-578`, `tests/e2e/harness.ts:31-46`.
- `app/__tests__/anchor-contract.test.ts:33,245-341,874-925` (`WEIGHT_CALL_SITES`,
  `TOKEN_NATIVE_STYLESHEETS`, claims two and four).
- `ops/__tests__/hub-accessibility-pass.test.ts:67-118` (both parsers refuse zero rows), `:246-263`
  (pins `z-work-hero`), `:286-296`, `:572-631` (KV-6 held `Open`).
- `ops/__tests__/hit-target-floor.test.ts:798-827` (KV-5 held `Open`).
- New: `tests/e2e/work-hero.pw.ts`.

**Records**

- `ops/known-violations.md`: index `:66-67`; KV-5 `:418-474`; KV-6 `:476-557`.
- `ops/hub-accessibility-pass.md`: headline rows `:29-40`; the ground row `:146`; the ledger
  `:301-397` (`:335-336`, `:372-376`); F-11 `:415`.
- `ops/hit-target-floor.md`: § What is asserted `:30`; `:604`; § The overflow `:629-776`.
- `ops/rendered-output-harness.md`: rows `:48,51,55,58,59,61`; § Why `/work` and the mask `:71-83`;
  `:96`; `:121`; the baseline table.
- `ops/anchor-token-adoption.md:515-520,556-566`; `ops/asset-budget.md` § Every route `:469` and
  § Findings `:1309`.
- `_bmad-output/implementation-artifacts/deferred-work.md`: DW-8 `:1161`, DW-35 `:2799`, DW-37
  `:2838`, DW-57 `:3527`, DW-66 `:3903` and DW-116 `:5632` close; DW-38 `:2873`, DW-81 `:4479` and
  DW-102 `:5208` annotated; new entries per Design Notes.

**Found during implementation, and touched for it**

- `tests/e2e/contract-anchor.pw.ts` held `/work`'s body at `rgb(10, 0, 15)` "unmoved" until the
  Epic 2 redesign; it reads the base rule's `--token-bg` there now.
- `tests/e2e/accessibility-floor.pw.ts`'s built-CSS tally guarded vacuity with "observed at least one
  tell", which an empty ledger over clean CSS cannot meet: the guard reads the contract layers the
  build sets and a planted literal and grid reported against the empty ledger instead.
- The meta label's 2023 no-break spaces: the accessibility snapshot normalises one away, so the
  CSS-off read in `plate-mark-and-work-item.pw.ts` could not find the cell in the tree; a plain space.
- `Scene.tsx` writes the canvas's own `aria-hidden` and `tabindex` in `onCreated`, a moment after the
  element is attached (its wrapper is hidden from the start): the new spec polls for them, and for the
  canvas to fill its box, after a first plain run failed one read on that race.
- The build emits the three/R3F/drei library twice, one chunk per dynamic boundary (DW-120), and
  splits `gsap` from `ScrollTrigger` into two chunks on every route; measured, recorded, not changed.
- `tests/e2e/type-swap.pw.ts`'s `settle` option had no entry left using it, and left with its last use.
- The matrix's wide row names 768 to 2400 where its criterion names 1280: the composition case runs at
  768, 1280 and 2400 and reads the 3 to 2 split as well.

## Tasks & Acceptance

**Execution** (in this order, on `dev`):

- [x] Before any edit: `corepack pnpm build && node ops/asset-budget.mjs`, every `.next/static/chunks`
      chunk gzipped at level 9, saved to the scratchpad as the before reading.
- [x] Unit guards first, each seen failing on the 2023 file: `WorkHero.test.tsx` (markup, the
      reduced-motion branch, the binding's vars, the boundary's options and containment, the compiled
      sheet), `WorkTimeline.test.tsx` (no batch, `role='list'`, the compiled sheet).
- [x] `WorkHero.tsx`, `WorkHero.scss`, `TorusCanvas.tsx`, `WorkTimeLine.tsx`, `WorkTimeline.scss`,
      `app/app.scss` (`body#work` out), the `hooks/useReduceMotion.ts` docblock.
- [x] `anchor-contract.test.ts`: both files token-native, `WEIGHT_CALL_SITES` retired, one FR-37 case
      (no stylesheet but `app/app.scss` reads any of the Hub's fifteen properties) with a planted
      control; `anchor-aliases.pw.ts`: `--accent-dim` and `--monument-bold` pinned at zero call sites,
      their tables and per-site cases retired with notes.
- [x] `tests/e2e/work-hero.pw.ts`, one case per browser criterion below, each with a planted control;
      the other specs as the Code Map says.
- [x] Ledgers and records: both exemption ledgers emptied (the agreement suite accepting a ledger empty
      by declaration and still refusing one it cannot read), KV-6 and KV-5 retired, the A-5 arm widened
      in `hit-target-floor.pw.ts` and its record, F-11 closed, the other records.
- [x] Branch build and budget; `ops/asset-budget.md` reading and run.
- [x] Container: a plain run (the `/work` comparison is expected to fail), `pnpm run test:e2e:update`,
      then a plain run with no filter, green; sha256 into the harness record.
- [x] `deferred-work.md`; `corepack pnpm typecheck`; `corepack pnpm test --run`; commit.

**Acceptance Criteria:**

- Given `/work` at 1280 on a `no-preference` context, when the hero is read, then the heading's box lies
  left of the canvas wrap's with the two overlapping vertically, a `<canvas>` is mounted in the wrap,
  and the hero's bottom border computes `--stroke-boundary` solid `--token-border-interactive` with its
  pixel row equal to that role rasterised across the hero's width, where a planted half-alpha boundary
  matches nowhere.
- Given `/work` on the project's `reduce` context, when it has loaded and hydrated, then no `<canvas>`
  exists, no requested script carries a WebGL fingerprint from `ops/asset-budget.mjs`, the wrap has no
  box, and the heading and the meta compute `animation-name: none` at opacity 1 on first read; and the
  same reads on a `no-preference` context find the canvas and a WebGL-carrying request.
- Given either context, when the tree is read, then `/work` carries one level-1 heading, named
  `Frontend Developer and Team Lead`, with no `aria-hidden` ancestor, and a planted `aria-hidden` on the
  section removes it; on `no-preference` the canvas is `aria-hidden`, inside an `aria-hidden` wrapper,
  at `tabindex="-1"`, and twelve Tab presses never land on it.
- Given `/work` at 360, 768, 1024, 1280 and 2400, when the heading is read, then it computes the display
  face (`document.fonts.check` at 800), `--t-display`, `--w-black`, `--lh-display`, `--tr-display`,
  uppercase and `--token-text`, and every word sets on one line (one client rect per word), where a
  planted width narrower than its longest word breaks one.
- Given `/work`, when the hero's marks are read, then it carries two, the annotated `EXPERIENCE` mark and
  a section mark reading `<n> POSITIONS` and `2017 - PRESENT` where n is the rendered row count, no
  text in the hero carries `//`, and no mono text sits outside a mark.
- Given a `no-preference` load, when the animations are read, then the heading and the meta each run
  one `work-hero-enter` animation over `--dur-minor` on `--ease-entrance`, fill `both`, at delays
  100ms and 400ms, both ending at opacity 1 with no inline `opacity` or `transform`, and no other
  element in the hero or the timeline animates; with scripting disabled both still reach opacity 1.
- Given `no-preference` with every WebGL-carrying script aborted, when `/work` loads, then the heading,
  both marks and four rows render, no canvas mounts, no page error is thrown, and the containment logs.
- Given `/work` and `/cv` on a `no-preference` context, when each row is scrolled into view, then in the
  frames after the scroll every row computes opacity 1 and an identity transform with no animation
  running and no inline style, where a planted CSS fade on `.work-item` is reported by the same read.
- Given `/work` and `/cv`, when the rows are read, then every row but the last draws the 1px
  `--token-border` separator and the last draws none, and the first row starts at the container's
  content edge, as the hero's text does on `/work` and the intro's on `/cv`.
- Given every surface at 360, when the widened A-5 arm runs, then no element with a box sits past either
  viewport edge, where a planted non-interactive element past each edge is reported and the
  interactive-only read misses it; KV-5 reads `Retired` on 2026-09-23 by Story 2-33 in its entry and
  index row.
- Given the built CSS and the rendered routes, when `accessibility-floor.pw.ts` sweeps, then both
  ledgers are empty and agree, `/work`'s body paints `--token-bg` with no image, no ring reads a ground
  outside the three tokens, and KV-6 reads `Retired` on 2026-09-23 by Story 2-33.
- Given the unit suites, when they run, then the ScrollTrigger binding is `scrub: true` over
  `top bottom` to `bottom top` on `ease: 'none'` and exists only while the torus is drawn, the dynamic
  import is `ssr: false` with no `loading` option and resolves a missing export and a rejected import
  to a component drawing nothing, no stylesheet but `app/app.scss` reads any of the Hub's fifteen
  properties (FR-37's removal condition; Story 2-22 unblocked), and both stylesheets hold every guard
  in the Always list.
- Given the before and after builds, when `ops/asset-budget.md` is read, then a dated reading gives both
  sides, the Derived delta against the Story 2-32 reading, `/work`'s WebGL column and the non-3D line
  against Story 2-2's 140,000.
- Given `corepack pnpm typecheck`, `corepack pnpm test --run` and the container `pnpm test:e2e`, when
  run, then every file passes, the last against a regenerated `/work` baseline captured with no mask,
  its sha256 recorded.

## Spec Change Log

**2026-09-23, fix round 1, after the independent verification.** The verifier's plain container run
on `3986699` read 324 passed and 1 failed: `tests/e2e/chrome-nav.pw.ts`'s hover case saw four pixels
outside the Suite rule change under hover, x 19, y 44 to 47 of the band on `/work` at 360, the left
edge of the wordmark's `C`, once in the 24 runs of that case the verifier took. The story owns it: it
replaced the case's wait for the torus canvas with an assertion that none mounts, and Story 2-32 had
put these four pixels on that canvas. **Diagnosed in the pinned image rather than guessed.** The
pixels are the tint the subpixel antialiasing filter lays one column past the `C`'s ink box,
`(6, 5, 23)` at rest against the bare ground `(6, 5, 9)` under hover. A first load paints the band
before its faces arrive (the contract's `font-display: swap`), and the swap repaints the glyph's ink
box, not that column. On some first loads the compositor's frames then disagree in that column and
nowhere else: the rest read has the tint, every hover on either link shows the ground, and moving off
brings the tint back, which fits a spare tile buffer repainted only where something changed. Measured
through the case's own reads in fresh contexts: 20 of 160 first loads failed (18 at the `C`, 2 at the
`S` of `Suite`) against 0 of 260 second loads; a second load's three faces read `loaded` in its first
animation frame 212 times in 212, a first load's `unloaded` or `loading` 11 times in 12; pages with
the stale column turned up at least as often with the hover taken one to two and a half seconds after
load (11 of 70), so the hydration settle the verifier offered would not have reached it; and a
planted repaint of the whole band, set and removed a captured frame apart, cleared it on the 3 pages
of 24 that had it. **The repair is in the case**, since no product code paints those pixels and the
swap is the contract's by design: the case loads `/work` once so its faces are cached, reads the
second load, and first asserts that every face read `loaded` in that document's first animation
frame; `stillPixelsIn`'s docblock states the measured cause where the canvas stood. The comparison,
its region, its one-pixel margin and its planted control are unchanged, and nothing retries. KEEP:
the second load and its faces check. Re-run: `corepack pnpm typecheck` clean;
`corepack pnpm test --run` 58 files and 1,446 tests, all passed; in the pinned image the case alone
with `--repeat-each=120` read 120 of 120, where the pre-fix case copied out of `3986699` read 119 of
120 under the same command, its one failure the same four pixels; the plain run with no filter,
twice, read 325 of 325 in 5.7 minutes each time, the `/work` baseline still `93a1aa4e...` and no
snapshot written.

## Design Notes

Each resolution below is an assumption taken from the documents in their precedence order
(`DESIGN.md` values, `EXPERIENCE.md` behaviour, `RESTYLE-SPEC.md` geometry and the rest).

**The display line.** The `/work` heading is that page's one display line (`RESTYLE-SPEC.md` § 6),
set on § 6's Display row and `DESIGN.md`'s display values: the display face at `wdth 100`,
`--t-display`, `--w-black`, `--lh-display`, `--tr-display`, uppercase, `--token-text`, with
`overflow-wrap: break-word` as `CvIntro.scss:26-41` sets it. It is not the display entrance component,
which `EXPERIENCE.md` gives the homepage and the error surface; it keeps its markup.

**The geometry, measured rather than guessed.** No document sizes the hero. **Observed 2026-09-23** in
the pinned image, face and fallback: `DEVELOPER` sets 349.6px wide at 72px, 336.9 at 69.12px (768
wide) and 176.8 at 36px; `FRONTEND DEVELOPER` 693.2 at 72px. Two equal columns give the line 325.6px
at 768, which breaks `DEVELOPER`, so the columns are `minmax(0, 3fr) minmax(0, 2fr)` (400px at 768,
667 at 1280) and the display line, the page's primary voice, takes the larger share. The wrap is
`aspect-ratio: 4 / 3`, which reproduces the 2023 240px at 360 (320 wide) with no length literal. The
two-column rule is gated on `(min-width: 768px) and (prefers-reduced-motion: no-preference)`, 768
being this file's and `HomeLayout.scss`'s existing breakpoint; under `reduce` the wrap is omitted
(`RESTYLE-SPEC.md` § 8: an empty section is omitted, never rendered empty) and the line takes the whole
width. The hero pads block-wise only, `var(--s-2xl) var(--s-xl)` (`CvIntro.scss:18`'s pair), because
the container pays the inline gutter once (§ 2, "the row is flush; the page is padded"); `gap:
var(--s-lg)`, the text column `gap: var(--s-md)`, `align-items: center`, and a single
`minmax(0, 1fr)` column below 768 so a long word cannot widen it. `42vh` and `overflow: hidden` go.

```scss
.work-hero { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--s-lg); align-items: center;
  padding-block: var(--s-2xl) var(--s-xl); border-block-end: var(--stroke-boundary) solid var(--token-border-interactive); }
@media (min-width: 768px) and (prefers-reduced-motion: no-preference) {
  .work-hero { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); } }
@media (prefers-reduced-motion: reduce) { .work-hero__canvas-wrap { display: none; } }
```

**The meta line is a section Plate mark.** `label` is the count and `POSITIONS` joined by a plain
space (the 2023 line's no-break spaces set a free-text line; in a cell the accessibility snapshot
normalises one away, and the CSS-off read compares the cell with the tree), `domain` is
`2017 - PRESENT`: identity leading and the period trailing, in the order the 2023
line read (`DESIGN.md` § Plate mark: identity top-left, position or domain top-right). The `//` between
them leaves as decoration a screen reader speaks (`EXPERIENCE.md` § Plate mark; the Story 2-31
precedent); the two cells separate them structurally. It sits in `div.work-hero__meta` so the entrance
addresses it by name. Two marks on one surface is allowed: each carries a genuine domain.

**The torus boundary (DW-37's `/work` half, taken because this story writes the boundary).**

```tsx
const TorusCanvas = dynamic(
  () => import('@/components/molecules/TorusCanvas/TorusCanvas')
    .then((module) => module.TorusCanvas ?? (() => null))
    .catch((error: unknown) => { console.error('WorkHero: the torus chunk failed to load, so the torus is not drawn', error); return () => null; }),
  { ssr: false }
);
```

It renders from `drawTorus`, `false` on the server and on the first client render and set in an effect
to `!reduceMotion`, so hydration sees no difference and a changed preference is honoured live.
`TorusCanvas` imports `Scene` statically, since it is behind the boundary now: one boundary, one chunk
chain. The binding moves into `useGsapContext(..., [drawTorus])`, returning early while nothing is
drawn, with `scrub: true` (review A-7).

**The entrance, through the `animate` skill's order, the repository's rules outranking it.** It
animates: once per page load, the route's one entrance (`EXPERIENCE.md` § Motion). Purpose: the display
line's arrival. Tool: a CSS keyframe, which runs off the main thread while the page loads, needs no
hydration, is the form the 2026-09-15 rule prefers, and removes the GSAP `from`'s flash, where the
server-painted heading vanished after hydration and slid back. Property: opacity alone. Curve and
duration: `--ease-entrance` on `--dur-minor`, the display entrance's and the 404's pair, under the
skill's 300ms. Delays 100ms and 400ms, the shipped order. No interruption and no exit: it runs once.
Under `reduce`, `animation: none`, present at first paint. Only a `from { opacity: 0 }`, fill `both`, so
the base state is the final state (the Story 2-29 and 2-30 shape).

**The timeline.** The batch is deleted (ruled a presentation change on 2026-09-15). `role='list'`,
because `list-style: none` drops list semantics in WebKit (the Story 2-31 and 2-32 precedent). The list
is flush in the container, `padding-block: var(--s-xl) var(--s-3xl)` (2rem and 8rem have no step; the
nearest, the Story 2-29 mapping); the zero-gap flex column is block flow and leaves.
`.work-timeline > li:last-child > .work-item { border-block-end: 0; }` drops the last separator.

**`body#work` is deleted.** `/work` then paints the base rule's `var(--black-color)`, which is
`--token-bg` through the alias layer until Story 2-22 repoints it: F-11 and DW-8 close.

**KV-5 retires on a widened instrument (DW-116).** The Story 2-8 sweep's A-5 arm is widened, inside
`hit-target-floor.pw.ts` where A-5 lives, to every element with a box on every surface, both edges at
the 0.5px slack, the census predicate KV-5 was opened and re-read with. Its heading becomes a statement
of what holds (KV-4's shape); DW-57 and DW-66 close with it.

**KV-6 retires with its last two rows.** The ledger empties; `hub-accessibility-pass.test.ts` accepts a
ledger empty by declaration, the Story 2-32 hit-target shape, and still refuses one it cannot read.

**FR-37.** After this story no stylesheet but `app/app.scss` reads any of the Hub's fifteen
properties; the three its base `body` rule reads are the layer's own, which Story 2-22 repoints.

**"Not focusable"** is read as the home canvas has been asserted since Story 2-13
(`front-door.pw.ts:1661-1709`): `tabindex="-1"` and never reached by Tab. `Scene.tsx` sets both.

**Re-booked, not taken: the torus's pointer rotation.** `CanvasOrbitControls` lets a pointer drag the
decorative torus, which `EXPERIENCE.md` § Pointer and touch and § Work hero argue against and the
restyle ceiling keeps as an interaction. **Observed 2026-09-23**: the canvas computes
`touch-action: auto`, so a touch scroll is not captured. Filed for the Operator, with the home's
`ParticleWave` drag beside it.

**Rollback.** Revert the commit: the files, the ledger rows, the two entries' open state and the old
baseline return together.

## Verification

**Commands:**

- `corepack pnpm typecheck`: expected clean.
- `corepack pnpm test --run`: expected every file to pass (1,423 tests in 58 files after Story 2-32).
- `corepack pnpm build && node ops/asset-budget.mjs`: expected a reading the Derived paragraph accounts for.
- Container `pnpm test:e2e` with no filter: expected green after the baseline update.

**As run, 2026-09-23:**

- `corepack pnpm typecheck`: clean.
- `corepack pnpm test --run`: 58 files, 1,446 tests, all passed (1,423 before the story). The two
  component suites read 23 of their new cases failing on the 2023 files before the rebuild; the ops
  suites pass against the emptied exemption ledger, KV-5 and KV-6 retired.
- `corepack pnpm build && node ops/asset-budget.mjs`: before `xX5gFekkt9wODVOqKSW22` (Story 2-32's
  after figures exactly), after `3khZaamuAoVzhg3IZI1ZP`: `/work` 232,796 gzipped lighter on the wire
  and carrying no WebGL chunk; the directory 228,274 gzipped heavier, all of it the three/R3F library
  emitted once per dynamic boundary (DW-120); the non-3D line names `/work` at 113,886 over Story
  2-2's 140,000. Filed in `ops/asset-budget.md`. Re-read at the review on build
  `i4CjKeHq3IQbazlZr0Ue0`: the same bytes on disk and gzipped, chunk for chunk.
- Container `pnpm test:e2e`, `mcr.microsoft.com/playwright:v1.62.1-noble`: the first plain run was 318
  passed and 5 failed, the `/work` comparison at 85,590 differing pixels (ratio 0.30) and its
  capability guard as expected, and three this story then repaired: `contract-anchor.pw.ts` holding
  `/work`'s body at the 2023 literal, and two reads of the meta label, whose no-break spaces the
  accessibility snapshot normalised (the Code Map records both). `pnpm run test:e2e:update` wrote
  `93a1aa4e...` (35,763 bytes), 321 passed and 2 skipped; the next plain run failed one read of the
  new spec on a race with the renderer (the canvas's `tabindex` is written in `onCreated`, a moment
  after the element is attached), which the spec now polls for; then `work-hero.pw.ts` three times
  over was 45 of 45 and the plain run with no filter 323 of 323 in 6.1 minutes, no stray snapshot.
- Measured in those runs: under the project's reduced motion, 12 scripts requested and none carrying a
  WebGL fingerprint, no canvas and the canvas box omitted, where a context allowing motion requested
  two WebGL-carrying chunks; the heading 36px on 34.2px at 360 (320.00 wide, three lines, 0.00% across
  the type swap), 69.12px at 768 and 72px from 1024, no word broken at any of the five widths; 0
  elements of any kind past an edge on all five surfaces; the built-CSS tally observing nothing over
  12 stylesheets; 346 text reads, 28 generated.

**The Step-04 review, 2026-09-23.** All six layers ran in this session, because it had no tool to
start a subagent, so none of them is independent of the implementation (the 2-30, 2-31 and 2-32
precedent). No intent gap and no spec defect, so no loopback (`review_loop_iteration` stays 0). The
patches, and no deferral: the matrix's wide row names 768 to 2400 and the composition case ran at 1280
alone, so it runs at 768, 1280 and 2400 now, reads the 3 to 2 split (400.33 to 266.89 at 768, 676.80
to 451.20 at 1280, 1060.80 to 707.20 at 2400) and refuses a hero taller than the viewport before its
pixel read; `type-swap.pw.ts`'s `settle` option and helper had no user left and went; in
`work-hero.pw.ts` the one-caller context factory folded into `onContext` (the Story 2-32 patch's
shape) and the no-script case says why it blocks hydration rather than disabling JavaScript
(`front-door.pw.ts`'s reason); `WorkHero.test.tsx`'s mocks lost a `set`, an `update` and a
`batch` the hero never calls; `accessibility-floor.pw.ts`'s zero-observed message no longer reads
as though it named ledger rows; and four record sentences this story left stale or ambiguous: KV-5's
"2-33 is what the entry now waits on", KV-6's "went seventh" beside the kept "Story 2-27 was the
seventh", the budget reading's "unit suites beside them", and the harness row that still counted
three `--monument-bold` sites. Rejected: the chunk failure staying cached for the session (the
`GemComponent` containment, as specified); a WebGL context that cannot be created, which R3F 9
configures asynchronously so the page stays whole, and which predates this story; the 300ms between
the two entrance delays, `animation: none` under reduced motion and an opacity-only entrance, each
set by the frozen criteria and matrix; the built-CSS guard failing loudly if the build ever stopped
setting a contract layer; and helpers repeated across browser specs, the house pattern because an
imported `.pw.ts` registers its tests twice. The ECC loop read the build, the types and the whole
suite green, and found no secret-like string, no `console.log` in a shipped source and no dash
character in an added line. The design layer approved: the heading takes its leading and tracking
from the display roles; the entrance is opacity alone on `--ease-entrance` at `--dur-minor`, once
per load, its delays set by the frozen criteria; the canvas box is reserved by ratio, so the torus's
arrival moves nothing; no `:hover` rule was added; and under reduced motion nothing moves and the
torus is not requested (`EXPERIENCE.md` § Reduced motion). Re-run after the patches: typecheck
clean; 58 files, 1,446 tests, all passed; in the pinned image `work-hero.pw.ts` and
`type-swap.pw.ts` three times over, 69 of 69 in 1.6 minutes, and the plain run with no filter 325
of 325 in 6.5 minutes, the `/work` baseline still `93a1aa4e...` and no snapshot written. The build
and the budget were re-read before the patches, which touch nothing the build bundles.

**Lighthouse, which this spec does not ask for and which gates on `main` only**, read after the review
in the same image the way `.github/workflows/lighthouse.yml` takes it (`@lhci/cli` 0.15.1, Lighthouse
12.6.1, three runs per URL): accessibility `/cv` 1.00 and `/` and `/work` 0.96, best practices and SEO
1.00 everywhere, every assertion green. `/work` read 1.00 before this story. Its one failing audit is
`color-contrast` on the annotated mark's `aria-hidden` kanji, `#564c91` on `#060509` at 2.74:1, a node
Story 2-31 set and this story did not touch, which the deleted grid image had kept out of axe's
score; on the plain ground it is scored. That is DW-113's class exactly, and it is filed there: the
margin is one hundredth on two routes now.

**Manual checks:**

- Look at `/work` at 360 and 1280 on a phone and on a hover-capable pointer, and with reduced motion
  on: the display line, the two marks, the boundary, no canvas and one column under reduced motion.
- Play the entrance at 2x to 5x in the animation inspector.

## Suggested Review Order

**The torus behind one contained boundary**

- Start here: the whole WebGL stack loads through one `next/dynamic` call, contained and logged.
  [`WorkHero.tsx:31`](../../components/organisms/WorkHero/WorkHero.tsx#L31)

- Decided in an effect: absent on the server and first render, never under reduced motion.
  [`WorkHero.tsx:53`](../../components/organisms/WorkHero/WorkHero.tsx#L53)

- The scroll binding exists only while the torus is drawn, and tracks the scroll 1:1.
  [`WorkHero.tsx:63`](../../components/organisms/WorkHero/WorkHero.tsx#L63)

- `Scene` imported statically, since the one boundary now sits at the hero.
  [`TorusCanvas.tsx:4`](../../components/molecules/TorusCanvas/TorusCanvas.tsx#L4)

- The hook's contract amended for the one consumer that branches on it.
  [`useReduceMotion.ts:38`](../../hooks/useReduceMotion.ts#L38)

**The hero's surface**

- Block padding only, a `minmax(0, 1fr)` column, closed beneath by the boundary rule.
  [`WorkHero.scss:23`](../../components/organisms/WorkHero/WorkHero.scss#L23)

- Three fifths to the line, two to the canvas, only where the canvas is drawn.
  [`WorkHero.scss:37`](../../components/organisms/WorkHero/WorkHero.scss#L37)

- The display row named role by role, where an alias and a hand weight stood.
  [`WorkHero.scss:56`](../../components/organisms/WorkHero/WorkHero.scss#L56)

- The canvas box reserved by ratio, so the torus's arrival moves nothing.
  [`WorkHero.scss:79`](../../components/organisms/WorkHero/WorkHero.scss#L79)

- One opacity keyframe; reduced motion runs none and omits the canvas box.
  [`WorkHero.scss:89`](../../components/organisms/WorkHero/WorkHero.scss#L89)

- The meta line as a section Plate mark, its `//` gone.
  [`WorkHero.tsx:96`](../../components/organisms/WorkHero/WorkHero.tsx#L96)

**The timeline and the ground**

- The scroll batch deleted, so the rows simply exist; the list states its role.
  [`WorkTimeLine.tsx:11`](../../components/organisms/WorkTimeline/WorkTimeLine.tsx#L11)

- Flush in the container, and the last row drops its separator.
  [`WorkTimeline.scss:11`](../../components/organisms/WorkTimeline/WorkTimeline.scss#L11)

- `body#work` deleted: every route paints the base rule's ground.
  [`app.scss:134`](../../app/app.scss#L134)

**The records, moved in the same change**

- KV-5 retired on the widened sweep's reading.
  [`known-violations.md:418`](../../ops/known-violations.md#L418)

- KV-6 retired with the exemption ledger's last two rows.
  [`known-violations.md:484`](../../ops/known-violations.md#L484)

- The exemption ledger empty, and saying so in words.
  [`hub-accessibility-pass.md:336`](../../ops/hub-accessibility-pass.md#L336)

- The whole-page census at zero on all five surfaces.
  [`hit-target-floor.md:745`](../../ops/hit-target-floor.md#L745)

- The weighed build: `/work` 232,796 gzipped lighter, one library emitted twice.
  [`asset-budget.md:471`](../../ops/asset-budget.md#L471)

- The first baseline captured with nothing masked.
  [`rendered-output-harness.md:242`](../../ops/rendered-output-harness.md#L242)

- Two entries filed: the torus's drag for the Operator, and the duplicated chunk.
  [`deferred-work.md:5784`](deferred-work.md#L5784)

**Peripherals**

- The composition at three widths: the split, the ratio, the rule as pixels.
  [`work-hero.pw.ts:230`](../../tests/e2e/work-hero.pw.ts#L230)

- No WebGL request under reduced motion, against a context that makes two.
  [`work-hero.pw.ts:384`](../../tests/e2e/work-hero.pw.ts#L384)

- A torus chunk that never arrives: the page whole and the failure logged.
  [`work-hero.pw.ts:421`](../../tests/e2e/work-hero.pw.ts#L421)

- The entrance read off the running page, and nothing else animating.
  [`work-hero.pw.ts:616`](../../tests/e2e/work-hero.pw.ts#L616)

- A-5 over every element, and the planted blocks the interactive arm misses.
  [`hit-target-floor.pw.ts:324`](../../tests/e2e/hit-target-floor.pw.ts#L324)

- No stylesheet but the alias layer reads a Hub property: FR-37's condition.
  [`anchor-contract.test.ts:1214`](../../app/__tests__/anchor-contract.test.ts#L1214)

- The loader driven against a module, a missing export and a failed chunk.
  [`WorkHero.test.tsx:193`](../../components/organisms/WorkHero/__tests__/WorkHero.test.tsx#L193)

- The empty ledger read from the real files, its refusals still exercised.
  [`hub-accessibility-pass.test.ts:282`](../../ops/__tests__/hub-accessibility-pass.test.ts#L282)

- The built-CSS tally with nothing to claim, shown firing on a planted grid.
  [`accessibility-floor.pw.ts:1458`](../../tests/e2e/accessibility-floor.pw.ts#L1458)

- No mask, and no canvas to mask, asserted beside the capture.
  [`rendered-output.pw.ts:120`](../../tests/e2e/rendered-output.pw.ts#L120)

- Both aliases pinned at zero call sites where their tables stood.
  [`anchor-aliases.pw.ts:406`](../../tests/e2e/anchor-aliases.pw.ts#L406)
