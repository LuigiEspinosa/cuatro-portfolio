---
title: 'Story 2.13: The non-3D front door and the skip control'
type: 'feature'
created: '2026-09-07'
status: 'done'
baseline_commit: 'dae5b3439e117155cb039b1277f5582898e6afb2'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** FR-2 promises two paths to the Suite Directory and the Hub has one. `HomeLayout.scss:19`
locks the hero at `height: 100dvh` and the only alternative to the 3D narrative is
`GemComponent.tsx:65`, a 1,755,015-byte still of the same scene, which `EXPERIENCE.md:173-176` bans by
name because a still of a 3D scene reads as a broken one. There is no skip control, so a cold arrival
costs a scroll rather than FR-2's one interaction. There is no accessibility skip-link either: A-6 has
no implementation anywhere in this repository, and no other story creates one. And the canvas is
neither `aria-hidden` nor unfocusable, so A-14 is claimed and not held.

**Approach:** One decision function picks the path and everything follows from it. On the non-3D path
the narrative is never imported, the poster frame is deleted outright, and the hero releases its
viewport lock so the premise and framework band that already sit below it become the hero with nothing
preceding them. On the default path a token-native `Skip to the suite ↓` control sits above the fold
and moves focus to the `#suite` heading, with the A-6 skip-link built ahead of it as the first
tabbable element.

## Boundaries & Constraints

**Always:**

- **One decision, one source.** A new hook owns the WebGL probe, `prefers-reduced-motion` and the
  connection read together and answers one of three states. `GemComponent` and `HomeLayout` both
  consume it; neither re-derives any part of it. Today the probe lives inside `GemComponent`
  (`:44-50`) and `HomeLayout` cannot see it, which is why the fold and the skip control cannot follow
  it without this move.
- **The undecided state renders the default path's geometry, and every trigger that can be answered
  before the document paints must be, so that visitor sees no shift.** Amended by Operator ruling of
  2026-09-07; the original clause forbade a shift on every path, which is unsatisfiable for a WebGL
  probe. Two triggers are answerable and both must be answered: `prefers-reduced-motion` in CSS, so
  the served document is already flat, and `Save-Data`, which is an HTTP request header and is read
  server-side so the served document is already flat for it too. The remaining two, a slow
  `effectiveType` and an absent WebGL context, exist only in the browser: those visitors take exactly
  one collapse after hydration, it only ever shrinks the hero, and both facts are asserted rather
  than tolerated. `GemComponent.tsx:57-59` establishes the undecided branch.
- **No render-time branch on `useReduceMotion`.** Its docblock at `:22-30` records that no consumer
  branches on the value in render output, because the corrected hook returns `true` on the client's
  first render where the server rendered `false`. The new hook preserves that by starting undecided on
  both sides of hydration. A consumer that breaks it takes a hydration mismatch, not a warning.
- **Slow connection is `navigator.connection.saveData === true`, or `effectiveType` one of `slow-2g`,
  `2g`, `3g`.** No planning document defines it: `Save-Data`, `effectiveType` and Network Information
  have zero occurrences across every planning artifact, and this is an Operator ruling of 2026-09-07,
  recorded here because it exists nowhere else. Declare the type with `declare global` inside the hook
  module. Do **not** add a top-level `types/` directory: `anchor-contract.test.ts:671-740` fails a
  source directory not in `SCANNED`.
- **Two skips, two targets, and they stay distinct** (`EXPERIENCE.md:421-422`). The A-6 link is the
  first tabbable element and targets main content; the skip control targets the Directory heading and
  is not the first tabbable element.
- **The skip control moves focus explicitly**, never by trusting the engine to focus a fragment target
  on a same-document click. `EXPERIENCE.md:723` says moves focus, not only scroll, and
  `SuiteDirectory.tsx:137-139` already ships the `tabIndex={-1}` heading to receive it.
- **The A-6 link is off-screen until focused, never clipped to 1px.** `hit-target-floor.pw.ts:509-517`
  skips only `aria-hidden`, `hidden`, no box, zero area and `visibility: hidden`. A `clip-path`
  skip-link is measured, at 1x1, and fails AD-19's floor.
- **The floor sweep cannot see the skip control, so this story measures it.**
  `playwright.config.ts:79` makes `reducedMotion: 'reduce'` the default context, which is the non-3D
  path, where the control does not render. Asserting it at 360px is this story's job or it is nobody's.
- **Counts move in the test and the record together.** `hit-target-floor.pw.ts:86` and
  `ops/hit-target-floor.md:98` and its cross-surface total at `:104`, which
  `ops/__tests__/hit-target-floor.test.ts` holds equal in both directions.
- **Both new stylesheets join `TOKEN_NATIVE_STYLESHEETS`** (`anchor-contract.test.ts:236`) and declare
  no custom property of their own: `:612-645` fails any `.scss` but `app/app.scss` that declares one.

**Ask First:**

- **Any surface other than `/` changing its `SURFACES` row.** Only `/` gains elements. If `/work`,
  `/projects`, `/celeste` or the 404 moves, the skip-link landed in the wrong file.
- **`page.test.tsx:39-45`'s main-children array moving.** The skip control belongs inside
  `HomeLayout`'s subtree, which that case mocks away. If it becomes a child of `<main>`, stop.
- The narrative failing to render on the default path once the probe moves out of `GemComponent`.
- Adding a route, a dependency, a CI job, a Playwright project, or a top-level directory.

**Never:**

- **No second framework band and no new hero component.** `premise.pw.ts:270-285` queries
  `.premise__framework` globally and a second band misaligns its position-parity assertion. The
  existing `Premise` is the hero on the non-3D path because nothing precedes it.
- **No climax beat.** `mockups/key-screens.html:235` renders one, no design document specifies it, and
  no story owns it. Story 2-12 refused it for the same reason.
- **Do not touch `.premise` or anything under it.** `premise.pw.ts:892-911` asserts nothing that
  subtree contains is interactive, on a wider selector than the floor's.
- **Do not do Story 2-29's work.** Leave `HomeLayout.scss:80-82` (dim-siblings-on-hover), the
  grid-line ground at `:8-14`, the notched panels, and the panel identities alone, and do not add
  `HomeLayout.scss` to `TOKEN_NATIVE_STYLESHEETS`.
- **Do not add `<main>` to the other four surfaces.** Only `app/page.tsx` has one. The rest belong to
  Story 2-26, which depends on this one.
- No spinner, no `loading:` option, no `<Suspense>` fallback (`EXPERIENCE.md:658-659`).
- No `toHaveScreenshot`: `rendered-output.pw.ts` keeps exactly one committed baseline, on `/work`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default path | WebGL present, no motion preference, no data-saving signal | The narrative chunk is imported and a canvas mounts; the skip control renders above the fold | The path the whole homepage was built around, and the one every Story 2-12 assertion assumes |
| Reduced motion | `prefers-reduced-motion: reduce` | No narrative chunk is ever requested; no canvas; no poster frame; no skip control | `EXPERIENCE.md:656,709`: never requested, never decoded |
| Save-Data | The `Save-Data: on` request header, motion unset | Same non-3D path, and the served document is already flat because the header is read server-side | Opened on a `no-preference` context, or the case cannot tell which trigger fired |
| Slow effectiveType | `effectiveType` is `slow-2g`, `2g` or `3g`, motion unset | Same non-3D path | `4g` and an absent `navigator.connection` both take the default path |
| WebGL absent or throwing | Probe answers false | Same non-3D path, and no image | This is the branch that renders `gem-fallback.png` today |
| The fold | The non-3D path at 360px and at a wider width | The hero releases its viewport lock, panels stack, and the Directory needs no interaction | Zero interactions is the diagram's claim for this path (`EXPERIENCE.md:154-169`) |
| No shift | The default path, reduced motion, and Save-Data, first frame to resolved | The container's height does not change between the served document and the resolved one | Recorded from the running page, not argued from the effect's position |
| One collapse | A slow `effectiveType`, or WebGL absent | Exactly one height change after hydration, and it only ever shrinks the hero | Asserted in both directions, and it is the control proving the three readings above measure something |
| Skip control | Default path, activated | Focus lands on `#suite`, not merely scroll; `document.activeElement` is the heading | `suite-directory.pw.ts:365-371` is the shape, on hash arrival rather than click |
| Skip control floor | Default path at 360px | `boundingBox()` is at least 44x44, and the label is exactly `Skip to the suite ↓` | The floor sweep runs reduced-motion and never sees it |
| A-6 link | Any path on `/`, tab pressed once from the document | It is the first tabbable element, becomes visible on focus, targets `#main`, and measures at least 44x44 | Off-screen, not clipped, or the floor measures it at 1x1 |
| Canvas semantics | Default path, canvas mounted | The canvas is `aria-hidden` and not reachable by tab | A-14, double-owned with Story 2-29, and this story runs first |

</frozen-after-approval>

## Code Map

**The decision, which everything else follows**

- `hooks/useNarrativePath.ts`: **new.** Owns the three inputs and answers `'undecided' | 'narrative' |
  'flat'`. The WebGL probe moves here verbatim from `GemComponent.tsx:44-50`. `declare global` for
  `Navigator.connection`, because `tsconfig.json:4-8` is `["dom","dom.iterable","esnext"]` and
  `lib.dom.d.ts` does not declare `NetworkInformation`.
- `hooks/useReduceMotion.ts`: read only, and reused rather than reimplemented. `:11` is the query,
  `:20` the `matchMedia` guard, `:22-30` the render-branch invariant this story must not break.
- `components/molecules/GemComponent/GemComponent.tsx`: `:42-50` the probe that moves out; `:57-59`
  the undecided branch that stays; `:61-68` the poster-frame branch that goes, along with
  `public/assets/home/gem-fallback.png`. `:16-38` the dynamic boundary is Story 2-12's and does not
  change shape, but must not be reached on the flat path.

**The two skips**

- `components/atoms/SkipLink/`: **new**, the A-6 link. Rendered first inside the fragment in
  `app/page.tsx:23`, ahead of `<main>`, which gains `id='main'` and `tabIndex={-1}`.
- `components/atoms/SkipControl/`: **new**, `Skip to the suite ↓`. Rendered inside
  `HomeLayout.tsx:51`'s `.home-container` on the narrative path only, so `page.test.tsx:39-45` cannot
  see it. Not a `.home-panel`: `HomeLayout.scss:80-82` would dim it whenever a sibling is hovered, and
  `HomeLayout.tsx:17`'s `finalState` would not fade it in, which is correct, it must not wait 2s.
- `components/organisms/SuiteDirectory/SuiteDirectory.tsx:29,137-139`: read only. `HEADING_ID` is
  `'suite'` and the heading already carries `tabIndex={-1}` for exactly this.
- Focus treatment to copy: `SuiteDirectory.scss:299-302`, `outline: var(--stroke-focus) solid
  var(--token-focus)` at `var(--focus-offset)`. Size floor: `--tap`, `contracts/tokens.css:100`.

**The fold**

- `components/organisms/HomeLayout/HomeLayout.tsx:16-48`: the entrance stays as Story 2-12 left it.
  `:66-68` `.home-gem` wraps `GemComponent`.
- `components/organisms/HomeLayout/HomeLayout.scss:17-23` the `100dvh` lock; `:34-78` the absolutely
  positioned panels; **`:199-258` the `max-width: 767px` block is the pattern to reuse**: it already
  turns the same panels static and stacks them in reading order. The flat modifier applies that shape
  at every width with the lock released, rather than inventing a second layout.

**Gates that move, and the two that must not**

- `app/__tests__/page.test.tsx:58`: `['MAIN','FOOTER']` becomes three entries. **`:39-45` must not
  move**: if it does, the skip control escaped `HomeLayout`.
- `tests/e2e/hit-target-floor.pw.ts:86` and `ops/hit-target-floor.md:98,104`: `/` gains the A-6 link
  only, because the sweep runs the reduced-motion context. The cross-surface total moves with it.
- `tests/e2e/narrative.pw.ts`: **the largest edit.** `playwright.config.ts:79` makes reduced motion the
  default, and `:361`, `:478`, `:517`, `:635`, `:684`, `:697`, `:865`, `:905` all require the narrative
  to mount or be fetched on that context. Each moves onto a `no-preference` context (`:280-298`
  `withMotion` is the idiom). `:498` and `:517` assert the poster frame exists and must be rewritten to
  assert nothing renders. `:1080`'s `afterMain` is unaffected by a skip-link placed before `<main>`.
- `components/molecules/GemComponent/__tests__/GemComponent.test.tsx:58` is an exact SSR string, and
  `:112-120` asserts the poster frame. Both move.
- `app/__tests__/anchor-contract.test.ts:236` gains two entries and nothing else.
- `ops/asset-budget.md:259,285,666`: the poster frame's three prose figures. No test pins them.

**Idioms**

- `narrative.pw.ts:197-203` `NO_WEBGL`: `addInitScript` patching a browser API, which is the shape for
  stubbing `navigator.connection`. `browser.newContext({ extraHTTPHeaders })` for `Save-Data`.
- `premise.pw.ts:61-81` `goTo` with a status guard and `waitUntil: 'load'`; `:125-133`
  `expectPinnedViewport`; `:111-116` `plantStyle` for controls.

## Tasks & Acceptance

**Execution:**

- [x] `hooks/useNarrativePath.ts`: **new.** The three-state decision, the moved WebGL probe, the
      `Save-Data`/`effectiveType` read, and the ambient `Navigator.connection` declaration.
- [x] `components/molecules/GemComponent/GemComponent.tsx`: consume the hook; render nothing on
      `flat`; delete the poster-frame branch. Delete `public/assets/home/gem-fallback.png`.
- [x] `components/atoms/SkipLink/SkipLink.tsx` and `SkipLink.scss`: **new.** Off-screen until focused,
      at least 44x44, `:focus-visible` ring on `--token-focus`.
- [x] `components/atoms/SkipControl/SkipControl.tsx` and `SkipControl.scss`: **new.** Exactly
      `Skip to the suite ↓`, targeting `#suite` and moving focus explicitly.
- [x] `app/page.tsx`: render `SkipLink` first in the fragment; give `<main>` `id='main'` and
      `tabIndex={-1}`.
- [x] `components/organisms/HomeLayout/HomeLayout.tsx` and `HomeLayout.scss`: consume the hook; render
      `SkipControl` on the narrative path only; add the flat modifier that releases the viewport lock
      and reuses the `:199-258` stacking shape.
- [x] `components/atoms/Scene/Scene.tsx`: `aria-hidden` on the canvas and remove it from the tab order
      (A-14).
- [x] `app/__tests__/anchor-contract.test.ts:236`, `app/__tests__/page.test.tsx:58`,
      `tests/e2e/hit-target-floor.pw.ts:86`, `ops/hit-target-floor.md:98,104`: move the pins this story
      genuinely moves, and no others.
- [x] `tests/e2e/narrative.pw.ts`: move the eight narrative-dependent cases onto `no-preference`
      contexts and rewrite the two poster-frame cases. State in each why the context differs.
- [x] `tests/e2e/front-door.pw.ts`: **new.** Every browser row of the matrix, each with a control
      watched failing: the four non-3D triggers, the chunk never requested, the fold, the absence of
      shift, the skip control's focus move and its 44x44, and the A-6 link's tab position.
- [x] `components/atoms/SkipControl/__tests__/`, `components/atoms/SkipLink/__tests__/`,
      `hooks/__tests__/useNarrativePath.test.ts`, and the two moved `GemComponent` cases: the jsdom
      halves, including a `saveData` case and an absent-`navigator.connection` case.
- [x] `ops/asset-budget.md`: amend the three poster-frame figures, dated, and state that `/`'s non-3D
      path now ships no image at all.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md`: file A-6 having no owning story before
      this one, the skip control's missing visual row (`review-rubric.md:40`), PRD Q7 still reading open
      at `prd.md:814`, A-14 being double-owned with Story 2-29, and anything the run surfaces.

**Acceptance Criteria:**

- Given `corepack pnpm test --run`, `corepack pnpm typecheck` and `corepack pnpm build`, when they run,
  then all three pass, and `page.test.tsx:39-45`'s main-children array is unchanged from `dae5b34`.
- Given `corepack pnpm test:e2e` inside `mcr.microsoft.com/playwright:v1.62.1-noble`, when it runs,
  then it passes, and every control case in `tests/e2e/front-door.pw.ts` has been observed failing its
  clean counterpart's measurement on the same page.
- Given each of the four non-3D triggers in isolation, when `/` is loaded, then no script the document
  fetches carries a WebGL fingerprint from `ops/asset-budget.mjs`, no request is made for the gem
  chunk, and no image renders inside the hero.
- Given the default path, when the page settles, then the canvas mounts, the skip control is present
  above the fold at 360px measuring at least 44x44, and activating it makes `#suite` the active element.
- Given a single Tab from the loaded document on `/`, when focus lands, then it lands on the A-6 link,
  which is visible at that moment and resolves to `#main`.
- Given `/cv`, `/work`, `/recommendation`, `/celeste`, `/projects` and the 404, when each is requested,
  then each still renders and its `SURFACES` row is unchanged, which is NFR-2.
- Given `git status --porcelain -- tests/e2e/*-snapshots`, when it is read after a full run, then it is
  empty.

## Spec Change Log

**2026-09-07, during step 3. The no-shift invariant was unsatisfiable as written, and the Operator
renegotiated it rather than the code.** The frozen clause required that resolving the path never shift
the page, on any path. That holds only where the trigger can be answered before the document paints,
and one of the four is a WebGL probe, which by construction cannot be: capability is knowable only in
the browser. The implementation met the clause for `prefers-reduced-motion` and the default path,
measured the residual collapse at 800.00 to 520.70 on a 1024 viewport, asserted its direction, and
filed DW-47 rather than asserting it away.

Amended, by Operator ruling, to require that every trigger which **can** be answered before paint
**must** be, which is two of the four rather than one: `prefers-reduced-motion` in CSS, and
`Save-Data`, which is an HTTP request header and so is readable server-side. The two script-only
triggers, a slow `effectiveType` and an absent WebGL context, take exactly one collapse, shrinking
only, both asserted. Matrix row 3 now names the header rather than the client property, row 7 names
the three shift-free paths, and a row was added for the one that collapses.

**KEEP:** the residual collapse is the control that proves the shift-free readings are measurements
rather than a comparison that always agrees. Whatever trigger carries that control after this
amendment, it must remain a real artifact of the architecture and not a planted one.

## Design Notes

**Why the existing `Premise` is the hero rather than a new component.** `EXPERIENCE.md:154-169`
diagrams the non-3D path as premise plus framework band, and both already render, below the hero,
built by Story 2-11. The only thing making them not the hero is `HomeLayout`'s `100dvh` lock and the
3D block above them. Remove both on that path and the diagram is satisfied with no new surface, no
second band for `premise.pw.ts:270-285` to trip over, and no copy invented. A new hero component would
have to duplicate the band, drop the nav and contact panels no story retires, and decide typography
that no design document specifies.

**Why two components rather than one skip.** `EXPERIENCE.md:421-422` requires them distinct, and they
differ in every axis that matters: the A-6 link is hidden until focused, is first in tab order and
targets main content; the skip control is always visible on the default path, is not first, and targets
the Directory heading. Neither doc gives either a visual row, which `review-rubric.md:40` already names
as a gap, so both are built to the rules that do exist: mono uppercase signage on a hairline, hover
recolouring an existing underline rather than adding one, `:focus-visible` painted instantly on
`--token-focus`, and `--tap` as the size floor.

**Why the A-6 link is off-screen and not clipped.** The conventional 1px `clip-path` pattern is
invisible to a person and fully visible to `hit-target-floor.pw.ts`, whose visibility rule at `:509-517`
removes only `aria-hidden`, `hidden`, boxless, zero-area and `visibility: hidden` candidates. A clipped
link is measured at 1x1 and fails AD-19. Positioning it off-screen keeps a real 44x44 box, so the floor
measures it and passes, which is the outcome the floor exists to produce.

## Verification

**Commands:**

- `corepack pnpm test --run`: passes, including the four new jsdom suites.
- `corepack pnpm typecheck`: passes, and is what proves the ambient `Navigator.connection` declaration
  is picked up without a tsconfig edit. AD-21 makes it blocking.
- `corepack pnpm build`: passes.
- `corepack pnpm test:e2e`: run inside the pinned image only; DW-23 records the container invocation.

**Manual checks:**

- Load `/` with WebGL and no preferences set, and confirm the gem still arrives. The probe moving out
  of `GemComponent` is the change most likely to break the path nothing in this story asserts positively.
- Force `prefers-reduced-motion` and confirm the hero is short, the Directory is reachable without
  interaction, and nothing flashes at 100dvh before collapsing.
- Tab once from a fresh load and confirm the A-6 link appears, then Tab again and confirm the skip
  control is not what receives focus first.

## Suggested Review Order

**The decision, which everything else follows**

- Start here. Three states, and the page's only call to it.
  [`useNarrativePath.ts:174`](../../hooks/useNarrativePath.ts#L174)

- The one trigger that reaches the server, so those bytes are already flat.
  [`page.tsx:57`](../../app/page.tsx#L57)

- One call, and the child is handed the decided path rather than re-deriving it.
  [`HomeLayout.tsx:49`](../../components/organisms/HomeLayout/HomeLayout.tsx#L49)

- The flat door is unrepresentable here, rather than merely untested.
  [`GemComponent.tsx:48`](../../components/molecules/GemComponent/GemComponent.tsx#L48)

- The probe releases its context instead of waiting for garbage collection.
  [`useNarrativePath.ts:104`](../../hooks/useNarrativePath.ts#L104)

**The fold, answered twice because only one trigger is expressible in CSS**

- One mixin, applied to the modifier class and to the media query.
  [`HomeLayout.scss:280`](../../components/organisms/HomeLayout/HomeLayout.scss#L280)

- The CSS half, which is what makes a reduced-motion first paint already flat.
  [`HomeLayout.scss:335`](../../components/organisms/HomeLayout/HomeLayout.scss#L335)

- A case that fails if the stylesheet and the hook ever disagree.
  [`front-door.pw.ts:1391`](../../tests/e2e/front-door.pw.ts#L1391)

- Sampled every frame: three doors never move, two collapse once and only downward.
  [`front-door.pw.ts:1047`](../../tests/e2e/front-door.pw.ts#L1047)

**The two skips, which are deliberately not one control**

- Focus moves explicitly; the browser keeps the history entry and the scroll.
  [`SkipControl.tsx:51`](../../components/atoms/SkipControl/SkipControl.tsx#L51)

- Hidden by its own height, so a longer label cannot leave an edge showing.
  [`SkipLink.scss:35`](../../components/atoms/SkipLink/SkipLink.scss#L35)

- Revealed on `:focus`, not `:focus-visible`, and the comment says why.
  [`SkipLink.scss:70`](../../components/atoms/SkipLink/SkipLink.scss#L70)

- Measured at both widths after the review found only 360 was covered.
  [`front-door.pw.ts:1100`](../../tests/e2e/front-door.pw.ts#L1100)

- Enter actually pressed, against the landmark it claims to reach.
  [`front-door.pw.ts:1330`](../../tests/e2e/front-door.pw.ts#L1330)

**What the review proved was missing, by breaking the code and watching the suite pass**

- The wrapper read, which `closest()` starting at the element had made vacuous.
  [`front-door.pw.ts:1444`](../../tests/e2e/front-door.pw.ts#L1444)

- Both halves of A-14, the element-level one a guard against a future library.
  [`Scene.tsx:49`](../../components/atoms/Scene/Scene.tsx#L49)

- A settled read that cannot be satisfied by a page which never hydrated.
  [`front-door.pw.ts:940`](../../tests/e2e/front-door.pw.ts#L940)

**The header, and the guarantee it turned out not to carry**

- Declared, and overwritten by Next on every App Router response.
  [`next.config.js:30`](../../next.config.js#L30)

- So the assertion is the guarantee: varying, or unstorable. Today it is unstorable.
  [`front-door.pw.ts:529`](../../tests/e2e/front-door.pw.ts#L529)

- Two documents from one URL, which is what makes the hazard real rather than theoretical.
  [`front-door.pw.ts:504`](../../tests/e2e/front-door.pw.ts#L504)

**Peripherals**

- Zero interactions to the Directory, with no control rendered to activate.
  [`front-door.pw.ts:650`](../../tests/e2e/front-door.pw.ts#L650)

- The poster frame is gone and `/` stopped carrying WebGL at all.
  [`asset-budget.md`](../../ops/asset-budget.md)

- One surface gained one element, and the record moved with the table.
  [`hit-target-floor.md:98`](../../ops/hit-target-floor.md#L98)
