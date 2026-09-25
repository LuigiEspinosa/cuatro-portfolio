---
title: 'DW-36: narrative weight, Lenis removed, drag removed from both canvases, orphaned 3D assets deleted'
type: 'bugfix'
created: '2026-09-24'
status: 'done'
baseline_commit: '9bf4f208cfb1de9d8c0f6d9f953192b371eb1888'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** `app/providers.tsx`, rendered by the root layout, puts `lenis`, `gsap` and `ScrollTrigger`
on every route's document, so `EXPERIENCE.md` Rule 1 ("everything narrative is deferred") is false
(`ops/asset-budget.md` § What this reads against the budget's own rules) and every visitor who allows
motion gets smooth scroll, which no design document asks for. Both canvases take a drag that
`EXPERIENCE.md` § Pointer and touch rules out (drei's orbit controls on the `/work` torus,
`ParticleWave`'s pointer drag with inertia and a grab cursor on `/`), and four 3D assets (1,215,179
bytes) plus `Gem.tsx` and `VenomSculpture.tsx` are committed, served and reached by nothing.

**Approach:** Operator ruling 2026-09-24, one package. Delete Lenis and `app/providers.tsx`: native
scroll everywhere. Move the torus's scroll binding and `ScrollTrigger`'s registration into
`TorusCanvas`, behind the torus's one boundary, so `ScrollTrigger` loads only with the torus and
GSAP's core ships only where the Work item's disclosure uses it. Delete the orbit controls and the
wave's drag, inertia and grab cursor. Delete the four assets and two orphaned components. Record one
asset-budget reading after all three and close the refs this covers.

## Boundaries & Constraints

**Always:**

- Every changed behaviour has a test that fails without the change, run red on the baseline tree
  before it is believed, and every new read carries a planted control that shows it firing (the house
  shape in `tests/e2e/work-hero.pw.ts`).
- The torus binding is unchanged in kind: `value` 0 to 1, `ease: 'none'`, trigger the hero section,
  `start: 'top bottom'`, `end: 'bottom top'`, `scrub: true`, created only while the torus is drawn and
  reverted with it.
- Records take the UTC date and cite "Operator ruling 2026-09-24"; a ledger entry closes with a dated
  paragraph naming the commit; an ops Pending row gets its Completed cell dated and stays; a planning
  document gets a dated amendment in its own style.
- No em-dash, en-dash, double-dash standing in for a dash, or emoji in anything written.

**Ask First:** nothing gates this run: it is unattended, and each open decision is resolved from
`DESIGN.md`, then `EXPERIENCE.md`, then `RESTYLE-SPEC.md`, and stated under Design Notes.

**Never:**

- No change to the wave's hover lift (`onPointerMove`, `onPointerLeave`), to `WorkItem`'s tween, to
  the home narrative's boundary or to `hooks/useNarrativePath.ts`; no new dependency.
- No edit to the "Unmeasured" wording at `EXPERIENCE.md:946-947` and `:961-964`: it is
  `ops/asset-budget.md` Pending action 1, another package's.
- No push, no pull request; the rendered-output baseline is regenerated only if the container run
  shows it moved, and only in the pinned image.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fragment, motion allowed | `/#suite` on a `no-preference` context | Native jump lands on the heading, focused; `<html>` never carries `lenis` | N/A |
| Documents with no narrative | `/`, `/celeste`, the 404 | Reference no script carrying any fingerprinted library | N/A |
| Documents with the Work item | `/cv`, `/work` | Reference `gsap` and no other fingerprinted library | N/A |
| `/work`, reduced motion | pinned context | No script carrying `ScrollTrigger` is requested | N/A |
| `/work`, motion allowed | torus drawn | `ScrollTrigger` requested on demand; a mouse drag leaves the canvas pixels identical; every element from the canvas to the root computes `touch-action: auto` | A torus chunk that fails keeps today's containment |
| `/`, motion allowed | wave drawn | A drag leaves the wave's rotation unchanged; the body cursor stays `auto` on hover and on press | N/A |
| Orphans | GET the four `/assets/home/` files | 404 | N/A |

</frozen-after-approval>

## Code Map

- `app/providers.tsx`: Lenis, `gsap.registerPlugin(ScrollTrigger)`, `lagSmoothing(0)`, the A-17 gate on
  `useReduceMotion`. Deleted with `app/__tests__/providers.test.tsx`. `app/layout.tsx:8,43,54` import it
  and wrap every route in it (graphify: its only importers).
- `components/organisms/WorkHero/WorkHero.tsx:5-7,13,43-45,59-75,100`: `gsap`, `ScrollTrigger`,
  `useGsapContext` and the binding leave; `heroRef` becomes a plain ref handed to the torus as
  `triggerRef`. Its test's binding cases (`WorkHero.test.tsx:135-175`) move to a new
  `components/molecules/TorusCanvas/__tests__/TorusCanvas.test.tsx` (mock shapes at `:28-61`).
- `components/molecules/TorusCanvas/TorusCanvas.tsx`: gains the binding and the registration, loses
  `CanvasOrbitControls`, its only importer (graphify). `three-stdlib` in `package.json` has no other
  source importer; drei keeps its own copy.
- `components/atoms/ParticleWave/ParticleWave.tsx:24-27,42-45,91-133,149-160,230-231`: drag refs,
  window listeners, cursor writes, inertia. The pose becomes the group's static `rotation`.
- `public/assets/home/*` (four files), `components/atoms/Gem/Gem.tsx`,
  `components/atoms/VenomSculpture/VenomSculpture.tsx`: named only by `Gem.tsx:16,19` and
  `gem.gltf:91`; no importer (graphify), no config or Caddyfile names them, the Dockerfile copies
  `public/` whole.
- `ops/asset-budget.mjs:60-88` `FINGERPRINTS`, pinned at `ops/__tests__/asset-budget.test.ts:784-797`:
  a mark that hits nothing stops the tool (`gsap/SplitText` precedent, `:71-74`), so `lenis` leaves and
  `three-stdlib` leaves if its mark stops hitting. Fixture comments `:117-121,179,270`.
- E2E: `tests/e2e/suite-directory.pw.ts:267-330,407-432` (`landsOnHeading` and the Lenis run);
  `tests/e2e/narrative.pw.ts:313-429` (the `/` scan, `withMotion`, `documentScriptUrls`);
  `tests/e2e/work-hero.pw.ts:36-49,203-225` (WebGL-only parse, `scriptLedger`).
- Comments naming Lenis or `providers`: `playwright.config.ts:80-82`, `tests/e2e/harness.ts:94-97`,
  `tests/e2e/front-door.pw.ts:284`, `tests/e2e/narrative.pw.ts:186-187,717-720,1473-1477,1534`,
  `hooks/useReduceMotion.ts:16-22,34-43`, `hooks/__tests__/useReduceMotion.test.ts:127-130`,
  `components/atoms/Torus/Torus.tsx:11-12`, `README.md:17,121-147`.
- Records: `deferred-work.md` DW-36, DW-104, DW-119, DW-120; `ops/asset-budget.md` § Every route,
  § The narrative assets, § What this reads against the budget's own rules, § Findings, Pending rows 3
  and 6; `spec-a-17-lenis-scoped-to-reduced-motion.md`; `review-apple-design-2026-09-15.md:45`;
  `EXPERIENCE.md:946` and `:951-952`. Before reading: build `h9ihC9KUuEQ39XtLfRn2X` at `9bf4f20`.

## Tasks & Acceptance

**Execution:**
- [x] Tests first, run red on the baseline: the unit and e2e cases below.
- [x] `package.json`, `pnpm-lock.yaml`: `corepack pnpm remove lenis three-stdlib`.
- [x] `app/providers.tsx`, `app/__tests__/providers.test.tsx`: delete. `app/layout.tsx`: children in `Body` directly.
- [x] `TorusCanvas.tsx`: binding and registration in, orbit controls out. New `TorusCanvas.test.tsx`: one `to` with the binding's vars, trigger is the handed element, `Torus` reads the tween's target, the scene holds a light and the torus only, revert on unmount.
- [x] `WorkHero.tsx` and its test: no GSAP import (source read), the section handed as `triggerRef`, the torus drawn only where motion is allowed (kept).
- [x] `ParticleWave.tsx`: drag, inertia, window listeners and cursor writes out; static pose.
- [x] `git rm` `CanvasOrbitControls/`, `Gem/`, `VenomSculpture/` and the four assets.
- [x] `ops/asset-budget.mjs` and its test: the rows, the pin and the comments.
- [x] E2E: `suite-directory.pw.ts` asserts no `lenis` class on both runs; `narrative.pw.ts` adds the route scan, the wave drag and cursor read (planted-rotation control) and the four orphan URLs answering 404 (an `/assets/og/` file answering 200 as control); `work-hero.pw.ts` adds `ScrollTrigger` absent under reduced motion and present with motion, the torus drag read pixel-identical (a scroll as control), and the `touch-action` chain (a planted `none` as control).
- [x] The comment sweep in the Code Map.
- [x] Build, `node ops/asset-budget.mjs`, the dated reading with per-route before and after, and DW-120's verdict.
- [x] Records: DW-36, DW-104 and DW-119 done; DW-120 done or annotated; asset-budget rows 3 and 6 dated; a-17 superseded; `EXPERIENCE.md` notes; review-apple-design A-1; a new DW for the wave's hover lift.

**Acceptance Criteria:**
- Given the baseline tree, when the new cases run, then each fails for the reason it names.
- Given the final tree, when typecheck, the full unit suite, `node ops/literal-conformance.mjs`, the build and the unfiltered container e2e run, then all pass.
- Given the final build, when `node ops/asset-budget.mjs` runs, then it exits 0, reads no `lenis` or `ScrollTrigger` on any document and 0 bytes under `public/assets/home/`.

## Spec Change Log

- **Review, 2026-09-24, loop 0.** No subagent could be spawned in this session, so the six layers
  ran inline, as the Operator's authorisation of a sub-agent reviewer allows. No intent gap and no
  bad-spec finding; one patch, a loose sentence in the new `ops/asset-budget.md` section, fixed; the
  ponytail layer's one shrink (share `frames` from `tests/e2e/harness.ts`) rejected under the
  suites' copy-don't-import convention. The design layer approved: the diff deletes motion and adds
  none. Nothing was re-derived.

## Design Notes

Assumptions, resolved unattended in the stated order:

1. **What Rule 1 calls narrative.** `EXPERIENCE.md` § Secondary surfaces names "the GSAP height tween"
   as the `/cv` accordion's, so GSAP's core on `/cv` and `/work` is the Work item's disclosure, not
   narrative. `ScrollTrigger` exists only to turn the torus, so it is narrative and moves behind the
   torus's boundary. The dated notes: the budget row (lenis gone, GSAP's core not narrative) and
   Rule 1 (holds, with the reading).
2. `lagSmoothing(0)` is line three of Lenis's own GSAP recipe (`node_modules/lenis/README.md:155-156`)
   and leaves with it; the disclosure tween and the scrub run on GSAP's default.
3. **The hover lift stays.** The ruling names the drag and its inertia; § Pointer and touch bans
   gestures. Its tension with § Motion's "cursor followers" ban is filed as a new DW.
4. **DW-119's touch evidence was incomplete.** three-stdlib's `connect()` writes `touch-action: none`
   on R3F's event-source div (`OrbitControls.js:300`, `react-three-fiber.esm.js:86`), above the canvas
   whose own `auto` DW-119 read, so a swipe starting on the torus could not scroll the page. The e2e
   reads the whole chain; the closing paragraph says so.
5. The architecture spine's stack table ("the code owns these once it exists") and PRD addendum C.2
   are dated snapshots, left as they are, the way `/projects` was.

## Verification

**Commands:**
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test --run`: every file passes.
- `node ops/literal-conformance.mjs`: exit 0.
- `corepack pnpm build`, then `node ops/asset-budget.mjs`: exit 0 each.
- The pinned container run of `pnpm test:e2e`, no filter: every case passes.

**As run, 2026-09-24:**
- Red on the baseline tree, before any code moved: `corepack pnpm test --run
  components/molecules/TorusCanvas components/organisms/WorkHero`, 6 failed on their named
  assertions (no registration, no binding, no revert, the orbit controls in the scene, no
  `triggerRef` handed over, GSAP imported by the hero). In the pinned image, `pnpm test:e2e -g` over
  the new cases: 6 failed, each for its reason (`lenis`, `gsap` and `ScrollTrigger` on every document;
  the wave turned from (-0.816, 15.977) to (-0.244, 17.407); `gem.glb` answered 200; the `lenis`
  class on a context allowing motion; the torus's pixels moved; `ScrollTrigger` requested under
  reduced motion), and the pinned fragment run passed, as it should.
- A probe of the pre-ruling build `BU9kM-lGaB456wSGuYMN5` in the pinned image read an inline
  `touch-action: none` on the renderer's outer wrapper above the torus (Design Notes, assumption 4).
- One commit per ruling, each verified before it was made: `237772c` typecheck exit 0, unit 59 files
  and 1,545 passed; `16412d1` typecheck exit 0, unit 59 files and 1,546 passed; `d91a34f` typecheck
  exit 0.
- Final tree: `corepack pnpm typecheck` exit 0; `corepack pnpm test --run` 59 files, 1,546 passed;
  `node ops/literal-conformance.mjs` exit 0; `corepack pnpm build` exit 0; `node ops/asset-budget.mjs`
  exit 0 against `ysPv_iPVOqc9Sc90vXp_1` at `d91a34f` (the reading filed), and against
  `36_nTzInaShL9idXMFw2l` at `4447bd6` within 2 bytes a route of it.
- The first unfiltered container run: 329 passed, 1 failed. `tests/e2e/front-door.pw.ts:1661` read
  the home canvas's own `aria-hidden` null, because it read straight after the canvas became visible
  and before the renderer's `onCreated` wrote it; alone the case passed five repeats in a row. Fixed
  in `4447bd6` by waiting for the renderer, the way `tests/e2e/work-hero.pw.ts` already waits for the
  torus's. The rendered-output baseline did not move in either run.
- The second unfiltered container run, on `4447bd6`: 330 passed, 0 failed, 10.6 minutes, exit 0.

## Suggested Review Order

**Native scroll, and GSAP only where it is used**

- Entry point: the root layout wraps no route in a client component any more
  [`layout.tsx:41`](../../app/layout.tsx#L41)

- `ScrollTrigger` registered in the one module that uses it, on the torus's side of the boundary
  [`TorusCanvas.tsx:14`](../../components/molecules/TorusCanvas/TorusCanvas.tsx#L14)

- The binding moved here unchanged: 0 to 1, no ease, the hero, `scrub: true`
  [`TorusCanvas.tsx:47`](../../components/molecules/TorusCanvas/TorusCanvas.tsx#L47)

- The hero keeps the decision and hands the section over; it imports no GSAP
  [`WorkHero.tsx:81`](../../components/organisms/WorkHero/WorkHero.tsx#L81)

**Both canvases are decoration**

- The torus scene is a light and the torus; the orbit controls are gone
  [`TorusCanvas.tsx:62`](../../components/molecules/TorusCanvas/TorusCanvas.tsx#L62)

- The wave's pose is a static rotation; only the hover lift answers the pointer (DW-123)
  [`ParticleWave.tsx:167`](../../components/atoms/ParticleWave/ParticleWave.tsx#L167)

**The instrument and the reading**

- Two fingerprint rows left with the libraries; a mark that matches nothing stops the tool
  [`asset-budget.mjs:83`](../../ops/asset-budget.mjs#L83)

- One reading after all three rulings, `/` weighed from the served document
  [`asset-budget.md:484`](../../ops/asset-budget.md#L484)

- Rule 1 holds, and why GSAP's core on `/cv` and `/work` is not the narrative
  [`asset-budget.md:1454`](../../ops/asset-budget.md#L1454)

**Proof in the browser, each read shown firing first**

- Every route's document, every fingerprint: only `/cv` and `/work` carry GSAP's core
  [`narrative.pw.ts:428`](../../tests/e2e/narrative.pw.ts#L428)

- `ScrollTrigger` never requested under reduced motion, requested where the torus is drawn
  [`work-hero.pw.ts:495`](../../tests/e2e/work-hero.pw.ts#L495)

- The torus: pixels identical across a drag, no pan refused from canvas to root
  [`work-hero.pw.ts:393`](../../tests/e2e/work-hero.pw.ts#L393)

- The wave: pose read off the drawn scene, no grab cursor on hover or press
  [`narrative.pw.ts:712`](../../tests/e2e/narrative.pw.ts#L712)

- The fragment lands natively with motion allowed, and Lenis's class never appears
  [`suite-directory.pw.ts:274`](../../tests/e2e/suite-directory.pw.ts#L274)

- The four orphan URLs answer 404 against a served control
  [`narrative.pw.ts:795`](../../tests/e2e/narrative.pw.ts#L795)

**Peripherals**

- The race the full run found: wait for the renderer before reading the canvas's attributes
  [`front-door.pw.ts:1669`](../../tests/e2e/front-door.pw.ts#L1669)

- The binding's unit half, moved from the hero's suite
  [`TorusCanvas.test.tsx:76`](../../components/molecules/TorusCanvas/__tests__/TorusCanvas.test.tsx#L76)

- The hero reads as handing its section to the torus, and as running no GSAP
  [`WorkHero.test.tsx:122`](../../components/organisms/WorkHero/__tests__/WorkHero.test.tsx#L122)

- The ledger: DW-36, DW-104 and DW-119 closed, DW-120 re-read and open, DW-123 filed
  [`deferred-work.md:2850`](deferred-work.md#L2850)

- The dated notes on the budget row and on Rule 1
  [`EXPERIENCE.md:949`](../planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/EXPERIENCE.md#L949)
