---
title: 'Story 2.12: The narrative resolves into the Suite Directory'
type: 'feature'
created: '2026-09-07'
status: 'done'
baseline_commit: '99cb842cb71e040f07e088a2b5aafdc2aea5bd05'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** FR-1's structure already holds: Stories 2-9 and 2-11 made the Directory the terminal
section and put the premise above it, so nothing needs reshaping. What is false is the payload NFR.
`GemComponent.tsx:5-6` statically imports `@react-three/postprocessing` and `ParticleWave` beside its
dynamic `Scene` call, and a static import is not deferred by a dynamic call next to it, so three.js
and R3F land in the homepage's eager entry chunk. `ops/asset-budget.md:118-121` measured it: **6,459 of
418,757 gzipped narrative bytes are deferred, 1.5 percent**. Separately the homepage's entrance
breaches the motion rules (`HomeLayout.tsx:27-28` animates `filter`, `:30` loops opacity with
`repeat: 4, yoyo: true`), and `useReduceMotion.ts:6` calls `matchMedia` on a media query missing its
parentheses, so a reduced-motion visitor is told `false` on first commit and sees the entrance start.

**Approach:** Put the whole narrative behind one dynamic boundary so the eager document references
none of it, swap the gem's reveal from `filter` to `opacity`, repair the media query, and assert every
clause by measurement: the deferral read off the served scripts by library fingerprint, and payload
independence proved with the narrative's chunk aborted mid-flight.

## Boundaries & Constraints

**Always:**

- **The deferral is proved on the served document, never on the import graph.** An eager script that
  contains `WebGLRenderer` or `react-three-fiber` is the narrative loading at first paint whatever the
  source looks like. Reuse the `FINGERPRINTS` table in `ops/asset-budget.mjs`, which
  `ops/__tests__/asset-budget.test.ts:784-795` already pins, rather than declaring a second one, and
  never match on a chunk filename: those are content hashes and change every build.
- **Payload independence is demonstrated, not argued.** Abort the narrative's request with
  `page.route`, the idiom at `contract-serving.pw.ts:206-210`, then assert the premise, the Directory
  and the footer render, `/#suite` still resolves and focuses, and the page reports no error. A test
  that only reads the import graph proves the thing that was already true and missed the defect.
- **The gem's reveal moves from `filter` to `opacity` in one change.** `HomeLayout.scss:190` sets
  `filter: brightness(0)`, so the tween at `:27-28` is the gem's only reveal and deleting it alone
  would leave the gem black forever. The stylesheet line and the tween move together or neither moves.
- **`transform` and `opacity` only, on the homepage entrance** (`EXPERIENCE.md:685-699`). Properties
  named individually, no `transition: all`, no loop. `y` is a transform and stays.
- **One orchestrated entrance per page load** (`DESIGN.md:1292`, `EXPERIENCE.md:693-694`). This story
  adds none: `HomeLayout`'s timeline is the one, and no scroll-triggered reveal is introduced for the
  premise or the Directory.
- **Durations stay plain numbers.** `HomeLayout` is an alias-layer consumer and Story 2-29 makes it
  token-native. Naming `--dur-minor` here would add it to a partition
  `app/__tests__/anchor-contract.test.ts:236` governs and do 2-29's work early.
- **A record that is now wrong is re-measured, not edited.** `ops/asset-budget.md`'s chunk table and
  its narrative discussion state figures this story invalidates. Re-run the tool and replace them with
  a real reading, dated, rather than adjusting the numbers by hand.

**Ask First:**

- **Any route losing a chunk it still needs**, or `/work` and `/projects` changing size. Their R3F
  boundaries (`TorusCanvas`, `TorusKnotCanvas`) carry the same defect and are **not** in scope; if
  moving the homepage's imports moves theirs, stop.
- The narrative failing to render at all after the move, on any path including the WebGL fallback.
- Adding a route, a dependency, a CI job, a Playwright project or a second breakpoint.

**Never:**

- **Do not touch the components other stories own.** `glitch-text.scss:15` (infinite loop,
  `text-shadow` and `clip-path` keyframes) is Story 2-27; `ScanlineOverlay.scss:39` is 2-28;
  `WorkItem.tsx:41-55` (animates `height`) is 2-31; `WorkTimeline.tsx:19-29` (scroll-triggered
  fade-up) and `WorkHero` are 2-33. File each; fix none.
- **Do not touch `HomeLayout.scss:80-82`** (`opacity: 0.2` dim-siblings-on-hover) or `:126` and `:159`
  (`transition: color`). `epics.md:3322-3326` gives the dim-siblings retirement to Story 2-29 by name.
- Do not move `gsap`, `lenis` or `ScrollTrigger` out of `app/providers.tsx`. They are on every route
  and that is a real defect, but they are not the narrative bundle this AC names.
- No skip control, no non-3D fork, no `aria-hidden` on the canvas: Story 2-13 owns all three.
- No climax-beat copy. `mockups/key-screens.html:235` renders one, no design document specifies it and
  no story owns it, so shipping it would be inventing copy.
- No spinner, no `loading:` option, no `<Suspense>` fallback for the narrative
  (`EXPERIENCE.md:658-659`).
- No `toHaveScreenshot`: `rendered-output.pw.ts` keeps exactly one committed baseline, on `/work`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| The deferral | Every script the `/` document references, fetched | None contains a WebGL-bearing fingerprint from `ops/asset-budget.mjs` | Demonstrated failing against a build with the static import restored |
| The narrative still runs | `/` with WebGL available | The canvas mounts and renders after hydration | A deferred narrative that never arrives is a worse defect than an eager one |
| Narrative blocked | Its chunk aborted via `page.route` | Premise, Directory and footer all render; `/#suite` resolves and focuses the heading | This is the AC's actual claim; graph independence was already true and missed it |
| No spinner | `/` during and after load | No spinner, skeleton, `loading:` option or `<Suspense>` fallback anywhere on the route | An empty transparent container is the intended state |
| Preload | The `/` document's `<link rel=preload>` set | Two font preloads only, neither narrative, none `fetchpriority=high` | True today and ungated, so it is pinned rather than assumed |
| Gem reveal | The entrance, WebGL present and absent | `.home-gem` goes 0 to 1 on `opacity`; computed `filter` is `none` at rest and while animating | `brightness(0)` left behind would black out the fallback image too |
| Entrance properties | Every tween on `/` | Only `opacity` and `transform` change; no tween repeats or yoyos | Read from the running page, with a control that fires |
| Reduced motion | `prefers-reduced-motion: reduce` | The entrance is at its final state immediately, and the media query is the valid parenthesised form | Today the first commit reads `false` and the entrance starts before the effect corrects it |
| FR-1's three consequences | `/`, then each pre-existing route | Directory reachable with no click and no route change; nothing after it but the footer; `/cv`, `/work`, `/recommendation` and `/celeste` all render | The exact-children pins in `page.test.tsx:39-45,58` already hold two of these |
| Scroll work | The whole homepage | No raw `scroll` listener, and this story adds no `IntersectionObserver` because it adds no scroll work | Asserting a mechanism nothing uses would be a test of nothing |

</frozen-after-approval>

## Code Map

**The boundary, which is the whole story**

- `components/molecules/GemComponent/GemComponent.tsx`: `:5` `@react-three/postprocessing` and `:6`
  `ParticleWave` are static, and `ParticleWave.tsx:4-5` imports `@react-three/fiber` and `three`, so
  both land in `GemComponent`'s chunk. `:8-10` defers `Scene` alone. Collapse this: one dynamically
  imported module holds `Scene`, `ParticleWave`, `EffectComposer` and `Bloom` together, and
  `GemComponent` keeps only the WebGL probe (`:16-22`) and the fallback (`:24-31`), importing nothing
  from `three` or R3F at module scope.
- `components/atoms/Scene/Scene.tsx` and `components/atoms/ParticleWave/ParticleWave.tsx`: read only.
  Both are already `'use client'` and already correct; they are on the wrong side of the boundary,
  not wrong in themselves.
- `ops/asset-budget.md:102-130`: the measurement that proves the defect and the sentence that names
  its cause. `:104-105` are the two chunks that must stop being eager on `/`; `:111` is the 6,459
  bytes that are deferred today. `:124-130` names the same fault at `TorusCanvas.tsx:8` and
  `TorusKnotCanvas.tsx:8`, which are `/work` and `/projects` and stay out of scope.

**The entrance**

- `components/organisms/HomeLayout/HomeLayout.tsx:16-41`: `:21` and `:27-28` animate `filter`; `:30`
  is the `repeat: 4, yoyo: true` opacity loop; `:32`, `:34` and `:38` are conformant already. The
  reduced-motion branch at `:19-23` sets the final state and must keep doing so.
- `components/organisms/HomeLayout/HomeLayout.scss:190`: `filter: brightness(0)`, the initial state
  that makes `:27-28` a reveal rather than a flourish. Becomes `opacity: 0`, matching `:52`, `:90` and
  `:127` which every other panel already uses.
- `hooks/useReduceMotion.ts:6`: `'prefers-reduced-motion: reduce'` with no parentheses. `:10` has the
  correct form; the two disagree and the broken one runs first.

**Where the assertions go**

- `tests/e2e/narrative.pw.ts`: **new.** `playwright.config.ts:33-34` globs every `.pw.ts` under
  `tests/e2e` and `.github/workflows/ci.yml:276-277` runs the directory, so **no config and no CI job
  change**. Adding a job would fail `ops/__tests__/contract-purity.test.ts:1018-1027` and
  `registry-schema.test.ts:1716-1721`, which each pin the six job names as an exact set.
- `hooks/__tests__/useReduceMotion.test.ts` and `components/molecules/GemComponent/__tests__/`: the
  jsdom halves. The media-query string is a unit fact; the boundary's shape is not.

**Gates that move, none of which fails with a message naming the cause**

- `app/__tests__/page.test.tsx:39-45` pins `main`'s children as exactly
  `['home-layout', 'premise', 'suite-directory']` and `:58` the fragment's as `['MAIN', 'FOOTER']`.
  This story adds no element, so both must still pass untouched: if either moves, something was added.
- `tests/e2e/hit-target-floor.pw.ts:85-91` `SURFACES` reads `found: 16` for `/` with
  `entrance: true`. Nothing here is interactive and the entrance survives, so both must hold.
- `tests/e2e/anchor-aliases.pw.ts:123` `ROUTES` is the seven-route list that answers FR-1's third
  consequence; `:414` `CALL_SITE_COUNT = 12` and `:415` `BOUNDARY_COUNT = 2` are exact and stay exact,
  since no stylesheet gains or loses an alias call site.
- `app/__tests__/anchor-contract.test.ts:236` `TOKEN_NATIVE_STYLESHEETS` is the four Epic 2 rebuilds.
  `HomeLayout.scss` is **not** among them and must not be added: swapping one declaration does not
  make it token-native, and `:609-623` fails any listed file that declares a custom property.
- `ops/__tests__/asset-budget.test.ts` runs against synthetic scratch trees, never the real build
  (`ops/asset-budget.md:70-73`), so re-chunking does not move it. `:784-795` pins the fingerprint
  table as literals; reuse that table, do not edit it.

**Idioms to copy rather than reinvent**

- `tests/e2e/contract-serving.pw.ts:206-210`: `page.route` fulfilling and aborting a request.
- `tests/e2e/harness.ts:66,86-90`: `goto` with `waitUntil: 'load'` and the reason `networkidle` is
  refused here, which matters more than usual on a route whose whole subject is loading.
- `tests/e2e/premise.pw.ts`: `expectPinnedViewport`, the probe-then-plant control shape, and its
  comment at `:892-911` explaining why nothing it adds moves the floor's count for `/`.

## Tasks & Acceptance

**Execution:**

- [x] `components/molecules/GemComponent/GemComponent.tsx` and the new module beside it: move `Scene`,
      `ParticleWave`, `EffectComposer` and `Bloom` behind one dynamic boundary so `GemComponent`
      imports nothing from `three` or R3F at module scope.
- [x] `components/organisms/HomeLayout/HomeLayout.tsx`: drop both `filter` tweens and the
      reduced-motion `filter` set; replace the `.home-role` yoyo with a single opacity tween.
- [x] `components/organisms/HomeLayout/HomeLayout.scss:190`: `filter: brightness(0)` becomes
      `opacity: 0`, which is what makes the tween above a reveal.
- [x] `hooks/useReduceMotion.ts:6`: parenthesise the media query so the initial read agrees with `:10`.
- [x] `tests/e2e/narrative.pw.ts`: **new.** Every browser row of the matrix, each with a control
      verified to fire: the fingerprint scan over the eager scripts, the aborted-chunk independence
      case, the preload and spinner reads, the gem's reveal, and the entrance's property sweep.
- [x] `hooks/__tests__/useReduceMotion.test.ts` and
      `components/molecules/GemComponent/__tests__/GemComponent.test.tsx`: the jsdom rows, including
      the invalid-query regression and the fallback path surviving the boundary move.
- [x] `ops/asset-budget.md`: re-run `ops/asset-budget.mjs` and replace the chunk table `:102-116` and
      the discussion `:118-135` with a dated real reading. State what is now deferred and what still
      is not, `/work` and `/projects` included, rather than implying this story fixed them.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md`: file the five motion breaches this
      story deliberately leaves (2-27, 2-28, 2-29, 2-31, 2-33), the `gsap`/`lenis`-on-every-route
      defect, and anything the run surfaces that these boundaries refuse.

Added during execution, beyond the list above:

- [x] **Three lines the task list did not name, and the story turns on them.** With the narrative's
      chunk aborted the page died outright: `next/dynamic` resolves through `React.lazy`, the rejected
      import reached Next's default error boundary, and the premise, Directory and footer all
      disappeared, which is the opposite of the acceptance criterion. The loader now catches the
      rejection and resolves to a component that draws nothing. Not a spinner, not a `loading:`
      option, not a `<Suspense>` fallback.
- [x] **The preload row is asserted on the distinct set.** The `/` document emits its two font
      preloads twice, four link elements for two URLs, and also carries two `as=style` preloads and one
      `as=script` at `fetchpriority=low`. The case pins exactly two distinct faces, nothing at high
      priority, and no preload pointing at a narrative chunk. The duplication is filed rather than
      quietly absorbed into the assertion.
- [x] **The scroll-work row is a source sweep, not a browser read.** Lenis registers a native `scroll`
      listener and so does ScrollTrigger, both from `node_modules`, so counting listeners in the
      browser cannot answer whether the Hub does scroll work. The sweep reads the Hub's own source
      instead, with both matchers shown firing and shown not firing on `lenis.on('scroll', ...)`.

Applied after the adversarial review, all patch-level. No finding rooted in the frozen intent and none
required a design change, so the spec did not loop back:

- [x] **Three findings were demonstrated by mutation, and two were matrix rows with no covering test,
      which means this story's own acceptance audit was failing quietly.** The reduced-motion branch
      had become the gem's only reveal (`HomeLayout.scss` now starts it at `opacity: 0`, and the
      timeline never runs for those visitors), while every gem case opened a `no-preference` context:
      deleting one `gsap.set` left a permanently blank hero, fallback image included, with the suite
      green, and `toBeVisible()` would not have caught it because `opacity: 0` still counts as visible.
      Nothing asserted the narrative ever renders: the discrimination control proves only that the
      chunk was **requested**, and a chunk is fetched before it is evaluated, so a module throwing on
      evaluation passed everything. And both no-spinner checks read a settled DOM, so adding a
      `loading:` option passed jsdom, whose mock discarded the options object, and passed e2e, which
      waited four seconds before its single sweep. All three now have cases that were watched failing.
- [x] **A payload miss on the payload story.** `webglAvailable` started `null` and the `null` branch
      rendered the narrative, so devices with no WebGL downloaded the whole thing before the probe
      answered. Three branches now, and the import cannot fire until the probe says `true`.
- [x] **Two silent-failure holes in the new loader.** The catch swallowed every failure with no signal,
      so a real regression and an offline visitor were indistinguishable while the suite asserted
      `pageerror` was empty; it logs first now. And a module resolving without the export would have
      thrown element-type-invalid and taken the route down, which is the exact failure the catch
      exists to prevent; resolution is guarded.
- [x] **An independence case that could pass while the narrative loaded.** The route handler let a
      request through when it could not classify it, and the assertion was only that something was
      blocked. It now keeps a `leaked` ledger and every case asserts it empty.
- [x] **Roughly twenty seconds per project of `waitForTimeout`, replaced with polling and init-script
      recorders.** The gem's first-frame opacity was read after `goto` and asserted below 1, which on a
      loaded runner fails for a timing reason while blaming the stylesheet. File runtime fell from 1.1
      minutes to 48 seconds.
- [x] **A prohibition wider than the story.** The `IntersectionObserver` sweep spanned four source
      roots and would have failed any later story adding a legitimate observer, with a message about
      scroll work. Scoped to what this story owns. The scroll sweep stays repo-wide because
      `EXPERIENCE.md:696` is a standing rule, and its case is renamed to what it actually measures.
- [x] **The hydration question the repair raised, checked rather than assumed.** A corrected
      `useReduceMotion` returns `true` on the client's first render where the server rendered `false`,
      which the bug had been masking. All four consumers read it only inside effects and dependency
      arrays and none branches on it in render output, so there is no mismatch; the constraint is now
      recorded in a docblock so a future consumer learns it before breaking it. A `matchMedia`
      existence guard was added alongside.
- [x] Smaller corrections: a docblock citing line numbers already stale in the same commit, now
      anchored on symbols; a three-way disagreement about `HomeLayout.scss:126` versus `:127`, checked
      and resolved (`:126` is the colour transition, `:127` the opacity initial state); the record's
      prose claiming `/work` and `/projects` carried almost all of 307,632 undeferred bytes when the
      table gives them 244,888; every other section of that record still badged `Verbatim` for a build
      that no longer exists, now dated and amended; ten ledger entries with no ids, now DW-31 to DW-42,
      one of which named no owning story; a dead default export; a preload control baking in the clean
      count; two URL-resolution forms that disagreed under `assetPrefix`; `vi.fn` written as the
      factory rather than called; a comment asserting a React mechanic that does not exist; and the
      typo `screenshort`, retyped from the file it replaced.
- [x] Two findings filed rather than fixed: `HomeLayout.test.tsx` mocks `useGsapContext` with a
      function that never invokes its callback, so no jsdom case can observe the entrance at all, which
      is why the reduced-motion branch went unpinned in the first place (DW-41); and `opacity: 0` has
      no scripting-disabled floor, the shape `filter: brightness(0)` also had, shared by four sibling
      panels, so the fix belongs to the route rather than to this line (DW-42).

**Acceptance Criteria:**

- Given `corepack pnpm test --run`, `corepack pnpm typecheck` and `corepack pnpm build`, when they run,
  then all three pass, and `page.test.tsx`'s two exact-children assertions and
  `hit-target-floor.pw.ts`'s `SURFACES` count for `/` are unchanged from `99cb842`.
- Given `corepack pnpm test:e2e` inside `mcr.microsoft.com/playwright:v1.62.1-noble`, when it runs,
  then it passes, and every control case in `tests/e2e/narrative.pw.ts` has been observed failing its
  clean counterpart's measurement on the same page.
- Given the `/` document, when every script it references is fetched and scanned, then none carries a
  WebGL-bearing fingerprint from `ops/asset-budget.mjs`, and the same scan run against the pre-change
  build finds them, so the measurement is shown to discriminate.
- Given the narrative's request is aborted, when the page settles, then the premise, the Directory and
  the footer render, `/#suite` resolves and moves focus to the heading, and no spinner or skeleton
  appears anywhere on the route.
- Given `/cv`, `/work`, `/recommendation`, `/celeste`, `/projects` and the 404, when each is requested
  after the change, then each still renders, which is FR-1's third consequence and NFR-2.
- Given `git status --porcelain -- tests/e2e/*-snapshots`, when it is read after a full run, then it is
  empty.

## Design Notes

**Why the fingerprint scan rather than a chunk-name assertion.** Next names chunks by content hash, so
a test naming `0g0oqlx4fsym~.js` measures one build and silently passes on the next when the hash moves
and the selector matches nothing. Scanning the scripts the document actually references, for the
library marks `ops/asset-budget.mjs` already publishes and `ops/__tests__/asset-budget.test.ts:784-795`
already pins, asks the question the acceptance criterion asks: is the narrative in what the browser
fetches before it can paint. It is also the shape that stays true when the bundler changes.

**Why the reveal becomes opacity and not a later-timed filter.** Once the narrative is deferred, a
brightness pulse scheduled at 0.5 seconds fires against a container that is usually still empty, so the
old timing stops meaning what it meant even before the rule is considered. Opacity on a transparent
container that has not filled yet is a no-op the visitor never sees, which is the same reason
`EXPERIENCE.md:658-659` refuses a spinner: on the one path where nothing is missing, announcing a wait
is the defect. The entrance keeps its shape and stops depending on the narrative having arrived.

## Verification

**Commands:**

- `corepack pnpm test --run`: passes, including the two new jsdom suites.
- `corepack pnpm typecheck`: passes. AD-21 makes it blocking.
- `corepack pnpm build`: passes, and is the build the fingerprint scan reads.
- `corepack pnpm test:e2e`: run inside the pinned image only; DW-23 records the container invocation.
- `node ops/asset-budget.mjs`: run after the build, and take the record's new figures from it rather
  than from an estimate.

**Manual checks:**

- Load `/` with WebGL available and confirm the gem still arrives and animates. A deferred narrative
  that never mounts would pass every assertion in this story and be a worse defect than the one it
  fixes.
- Confirm every control case was watched failing, not merely written. A control that passes for an
  unrelated reason is the failure mode `hit-target-floor.pw.ts:1323` already found once.
- Confirm the reduced-motion path shows no burst of entrance before settling, which is the symptom the
  media-query repair removes and which no automated case can see directly.

## Suggested Review Order

**The boundary, which is the whole story**

- Start here. One dynamic import, and nothing above it reaches `three` or R3F at module scope.
  [`GemComponent.tsx:16`](../../components/molecules/GemComponent/GemComponent.tsx#L16)

- The narrative's own module, which is what moved rather than what changed.
  [`GemNarrative.tsx:32`](../../components/molecules/GemComponent/GemNarrative.tsx#L32)

- Three branches, so a device with no WebGL never pays for the narrative at all.
  [`GemComponent.tsx:57`](../../components/molecules/GemComponent/GemComponent.tsx#L57)

- A rejected import draws nothing instead of replacing the route with an error page.
  [`GemComponent.tsx:22`](../../components/molecules/GemComponent/GemComponent.tsx#L22)

**The measurement, which is why the claim is believable**

- The deferral read off the scripts the browser actually fetches, never off a chunk name.
  [`narrative.pw.ts:304`](../../tests/e2e/narrative.pw.ts#L304)

- Payload independence proved by taking the narrative away, not by reading the import graph.
  [`narrative.pw.ts:564`](../../tests/e2e/narrative.pw.ts#L564)

- The half that stops a partly-blocked run counting as a clean one.
  [`narrative.pw.ts:573`](../../tests/e2e/narrative.pw.ts#L573)

- 6,459 deferred bytes became 118,809, and `/` stopped carrying WebGL at all.
  [`asset-budget.md:34`](../../ops/asset-budget.md#L34)

**What the review proved was missing, by breaking the code and watching the suite pass**

- The narrative mounting a real canvas, which every other case here would have missed.
  [`narrative.pw.ts:477`](../../tests/e2e/narrative.pw.ts#L477)

- The one line standing between a reduced-motion visitor and a permanently blank hero.
  [`HomeLayout.tsx:21`](../../components/organisms/HomeLayout/HomeLayout.tsx#L21)

- Read in the default context, because every gem case before this opted out of the preference.
  [`narrative.pw.ts:868`](../../tests/e2e/narrative.pw.ts#L868)

- A spinner is now caught while it flashes, not looked for after it has gone.
  [`narrative.pw.ts:742`](../../tests/e2e/narrative.pw.ts#L742)

**The entrance, and the bug underneath it**

- The gem reveals on opacity, and the stylesheet line that made the old tween a reveal.
  [`HomeLayout.scss:184`](../../components/organisms/HomeLayout/HomeLayout.scss#L184)

- Every recorded frame checked, rather than three chosen moments.
  [`narrative.pw.ts:821`](../../tests/e2e/narrative.pw.ts#L821)

- Only opacity and transform, and nothing loops.
  [`narrative.pw.ts:931`](../../tests/e2e/narrative.pw.ts#L931)

- The media query that was never valid, so the answer was always no.
  [`useReduceMotion.ts:11`](../../hooks/useReduceMotion.ts#L11)

**Peripherals**

- FR-1's three consequences, including every route still rendering.
  [`narrative.pw.ts:1079`](../../tests/e2e/narrative.pw.ts#L1079)

- Named for what it measures after the review found the title claimed more.
  [`narrative.pw.ts:1141`](../../tests/e2e/narrative.pw.ts#L1141)
