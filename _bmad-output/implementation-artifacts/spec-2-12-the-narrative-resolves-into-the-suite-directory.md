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
