---
title: 'home-hero-rulings: hero links held inert through the entrance, the landmark focus ring above the hero, and a particle wave that ignores the pointer'
type: 'bugfix'
created: '2026-09-25'
status: 'done'
baseline_commit: '93cf5baeb8b0df24722d105cbb438bf2d48f347e'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Three open Operator entries on `/`. DW-125: `visibility: hidden` in the links' keyframe
makes the first hero link's reveal its first paint, so mobile LCP went from about 2.5s to 5.4s.
DW-127: on the default door at 768 and wider the hero's canvas and scrim paint over `main`'s inset
focus ring. DW-123: the particle wave still lifts under the pointer, a cursor follower.

**Approach:** Operator ruling 2026-09-25 on each. (a) The links fade from `opacity: 0` on the plain
entrance keyframe again, and script sets `inert` on each link only while its entrance is waiting,
removing it when the entrance starts, ends or is cancelled. (b) `main:focus-visible::after` draws the
same inset ring on a positioned layer above the hero. (c) The wave's pointer lift, its plane and its
spring are deleted.

## Boundaries & Constraints

**Always:** every new assertion seen red before the change; records take 2026-09-25 and cite
"Operator ruling 2026-09-25"; planning documents get dated amendments in their own style; motion
stays on contract tokens; no em-dash, en-dash, double hyphen standing in for a dash, or emoji.

**Ask First:** nothing gates this unattended run; open questions are resolved from the rulings, then
`DESIGN.md`, `EXPERIENCE.md`, `RESTYLE-SPEC.md`, and stated under Design Notes.

**Never:** served HTML carrying `inert`; `inert` under reduced motion, on a flat door, or where no
entrance runs; a change to the entrance's delays or durations; the ring pseudo-element present
without `:focus-visible`, taking clicks, or transitioned; a new dependency; a push to `main` or a PR.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default door, entrance waiting | hydrated before a link's delay ends | link `inert`, `opacity: 0`, `visibility: visible`; Tab skips it; click falls through | N/A |
| Entrance starts, ends or is cancelled | `animationstart` / `animationend` / `animationcancel`, or unmount, or door turns flat | `inert` removed | cleanup always releases |
| Reduced motion, Save-Data, no script | no animation, flat from the server, or no hydration | `inert` never set | N/A |
| Skip link Enter at 1280, 360 on `/`, 1280 on `/work` | `main` focused by keyboard | pixel inside top, left and right edges reads `--token-focus` | N/A |
| Pointer over the wave | hover the canvas | no point lifts above the wave's own amplitude | N/A |

</frozen-after-approval>

## Code Map

- `components/organisms/HomeLayout/HomeLayout.tsx`: the one hook call; add the inert effect keyed on `flat`.
- `components/organisms/HomeLayout/HomeLayout.scss`: `@keyframes home-enter-link` (DW-106) goes; `.nav-link` and contact `a` return to `home-enter`, delays unchanged.
- `components/organisms/HomeLayout/__tests__/HomeLayout.test.tsx`: the keyframe case pins two keyframes and `visibility:hidden`; becomes one keyframe, no `visibility`.
- `tests/e2e/front-door.pw.ts`: DW-106 block: `HOLD_ENTRANCE`, `heroLinkState`, `tabUntilDirectory`; rewrite it for `inert`.
- `tests/e2e/narrative.pw.ts`: `ENTRANCE_SITES`, `ALLOWED_VISIBILITY`; the DW-119 block's `SCENE_RECORDER`, `wavePose`, `frames`.
- `app/app.scss`: `main:focus-visible`, the one ring exception (F-20).
- `app/__tests__/anchor-contract.test.ts`: `FOCUS_ROLES` and friends pin every role `app/app.scss` names; `--z-raised` needs a list.
- `tests/e2e/accessibility-floor.pw.ts`: `LANDMARK_RING_SELECTOR`, `ringRulesOutsideTheGlobal`, `sampleBoxes`, `settle`.
- `components/atoms/ParticleWave/ParticleWave.tsx`: `MOUSE_*`, `SPRING_K`, `DAMPING`, `velZ`, `mouseLocal`, `_tmp`, `groupRef`, the plane mesh.
- Records: `deferred-work.md` DW-125, DW-127, DW-123; `ops/hub-accessibility-pass.md` § Lighthouse readings and § The Operator's keyboard confirmation; `RESTYLE-SPEC.md` § 4; `DESIGN.md` skip row; `EXPERIENCE.md` DW-106 amendment; `CHANGELOG.md`; `ops/asset-budget.md` if bytes move.

## Tasks & Acceptance

**Execution:**
- [x] `HomeLayout.scss`, `HomeLayout.tsx`: delete the links keyframe; add the effect, DW-125.
- [x] `HomeLayout.test.tsx`, `front-door.pw.ts`, `narrative.pw.ts`: inert during and not after, never on reduced motion or Save-Data, Tab skips then reaches, no `visibility: hidden`.
- [x] `app/app.scss`, `anchor-contract.test.ts`, `accessibility-floor.pw.ts`: the ring layer, its role and selector allowances, the raster case with a planted control, DW-127.
- [x] `ParticleWave.tsx`, `narrative.pw.ts`: delete the lift; hover case reading point heights, DW-123.
- [x] Records, a fresh Lighthouse reading of `/`, ledger closes.

**Acceptance Criteria:**
- Given the default door with the entrance held, when the links are read, then each is `inert`, visible and at opacity 0, Tab reaches the Directory past them, and after the entrance each is not `inert` and Tab reaches all five in order.
- Given the pinned container, when Lighthouse runs `/` three times, then accessibility is at least 0.95, best practices and SEO at least 0.9, and LCP is recorded as observed.
- Given the build, when chunks are counted, then one three.js chunk ships (DW-120).

## Design Notes

- Assumption 1 (DW-106's ruled effect, `EXPERIENCE.md` § Motion amendment): "its turn" is the end of its delay, so `inert` lifts on `animationstart`, as `visibility` became visible on the fade's first frame; `animationend`, `animationcancel`, unmount and a flat door are the backstops. A link whose delay has already passed at hydration is never made inert.
- Assumption 2: the ring layer is scoped to `main:focus-visible` on every route (the ruling names the landmark's ring, not a route); `position: relative` is set on `main` only while focused, and no absolute descendant of `main` resolves against it today (hero panels, skip control and scrim all have a nearer positioned ancestor). `z-index: var(--z-raised)` beats the panels by tree order, since `::after` follows them.
- Assumption 3: the spring existed to ease the lift back, so it goes with it; the wave sets each point to its base plus the sine directly.
- Acceptance note (DW-120): the build ships two three.js chunks of 894,996 bytes before and after this package, so the one-chunk criterion was never true at baseline; DW-120 is open, and this package neither closes nor widens it.
- Review: no subagent tool was available to this run, so the six review layers ran inline in the implementing agent (Operator's authorization of a sub-agent reviewer, 2026-09-25). No patch finding; one pre-existing issue the amendments widen was filed as DW-247.
- Scope count: the spec is above 1600 tokens. The orchestrator relayed Keep, stating the Operator ruled the three as one package; recorded here as the relay, not as this run's own answer.

## Verification

**Commands:**
- `corepack pnpm typecheck`; `corepack pnpm test --run`; `node ops/literal-conformance.mjs`; `corepack pnpm build`; `node ops/asset-budget.mjs`: all green.
- The pinned container `pnpm test:e2e`, no filter : green; the container Lighthouse script, readings recorded.

## Suggested Review Order

**The inert hold (DW-125)**

- Entry point: an entrance still inside its delay is the only thing held.
  [`HomeLayout.tsx:36`](../../components/organisms/HomeLayout/HomeLayout.tsx#L36)

- Script-only `inert`, released on start, end, cancel and cleanup.
  [`HomeLayout.tsx:85`](../../components/organisms/HomeLayout/HomeLayout.tsx#L85)

- The links keyframe is gone; links fade from opacity 0 again.
  [`HomeLayout.scss:58`](../../components/organisms/HomeLayout/HomeLayout.scss#L58)

**The ring above the hero (DW-127)**

- Positioned only while focused, so nothing changes otherwise.
  [`app.scss:54`](../../app/app.scss#L54)

- The same ring on a pointerless layer at the panels' level.
  [`app.scss:74`](../../app/app.scss#L74)

**The wave (DW-123)**

- Each point is its fold plus the wave; no pointer, no spring.
  [`ParticleWave.tsx:100`](../../components/atoms/ParticleWave/ParticleWave.tsx#L100)

**Tests**

- Unit: held, freed, never stranded, never served.
  [`HomeLayout.test.tsx:284`](../../components/organisms/HomeLayout/__tests__/HomeLayout.test.tsx#L284)

- Browser: inert during, released after, never on reduced motion or Save-Data.
  [`front-door.pw.ts:1885`](../../tests/e2e/front-door.pw.ts#L1885)

- Raster ring sample with a layer-off control.
  [`accessibility-floor.pw.ts:2338`](../../tests/e2e/accessibility-floor.pw.ts#L2338)

- Point heights under a hovering pointer.
  [`narrative.pw.ts:836`](../../tests/e2e/narrative.pw.ts#L836)

- The new selector and role admitted by name.
  [`accessibility-floor.pw.ts:107`](../../tests/e2e/accessibility-floor.pw.ts#L107)
  [`anchor-contract.test.ts:241`](../../app/__tests__/anchor-contract.test.ts#L241)
