---
title: "A-17: Lenis smooth scroll scoped to the motion preference"
type: 'bugfix'
created: '2026-09-15'
status: 'done'
baseline_commit: 'bf3035442915f82e5cf23f96cc3d719e050298c0'
review_loop_iteration: 1
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** `app/providers.tsx:14` constructs `new Lenis()` for every visitor and reads no motion
preference, so a visitor who asked for reduced motion, and whom the front door correctly steers
onto the flat path (`HomeLayout.scss:327-329`, `hooks/useNarrativePath.ts`), still gets rAF-driven
inertial wheel scrolling on every route. Smooth scroll is a first-order vestibular trigger on its
own (`review-accessibility.md:320-329`, rated high on 2026-08-15 and never booked; A-1 in
`review-apple-design-2026-09-15.md`). The preference is half honoured.

**Approach:** `Providers` reads `useReduceMotion()` and constructs Lenis only when it is `false`.
The effect depends on that value, so React's cleanup destroys a running instance and removes its
ticker callback when the preference flips to `reduce`, and constructs one again if it flips back.
ScrollTrigger keeps working on native scroll without Lenis, which is its default. One regression
test beside the hook's tests.

## Boundaries & Constraints

**Always:**

- `hooks/useReduceMotion.ts` is the one source of the preference: it holds the parenthesised query
  (`:11`), guards a missing `matchMedia` (`:21`), and subscribes to `change` (`:41-47`). No second
  `matchMedia` call in `providers.tsx`.
- The value is read only inside the effect and its dependency array, never in render output
  (`useReduceMotion.ts:24-31`): `Providers` keeps rendering `<>{children}</>` so there is no
  hydration branch.
- `import Lenis from 'lenis'` stays a static import: `ops/asset-budget.md` records Lenis on the
  shared non-3D chunk (`ops/asset-budget.mjs:87` is the fingerprint), and a dynamic import would
  silently falsify that record. `gsap.registerPlugin(ScrollTrigger)` stays at module level.
- No `addEventListener('scroll'` anywhere (`tests/e2e/narrative.pw.ts:1273-1284` sweeps for it);
  no em-dash, en-dash or emoji in any prose (AGENTS.md).

**Ask First:**

- If honouring the flip needs anything beyond the effect's own cleanup (a ref, an extra effect, a
  Lenis option), stop and ask: the intent is the dependency array doing the work.

**Never:**

- No change to `hooks/useNarrativePath.ts`, to `WorkHero.tsx`'s scrub or to any component's GSAP
  call (Story 2-33 owns those); no new dependency; no keyboard or `scrollIntoView` delegation
  (A-18 and A-19 in the same review are separate and unbooked).
- E2e changes are limited to two things (Operator ruling 2026-09-15, review loop 1): the `/#suite`
  fragment case in `tests/e2e/suite-directory.pw.ts` runs a second time on a `no-preference`
  context, because the pinned `reduce` context (`playwright.config.ts:79`) now never constructs
  the Lenis it was written to guard against; and comments that describe Lenis as installed
  unconditionally are corrected. No other e2e assertion changes and no baseline is regenerated.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No preference | `matchMedia('(prefers-reduced-motion: reduce)').matches` is `false` on mount | Lenis constructed once, `lenis.on('scroll', ScrollTrigger.update)` wired, `lenis.raf` added to `gsap.ticker`, `lagSmoothing(0)` set | N/A |
| Reduce on mount | `matches` is `true` on mount | Lenis never constructed; nothing added to the ticker | N/A |
| Flip to reduce | Lenis running; the `change` listener fires with `matches: true` | `gsap.ticker.remove` called with the same callback that was added, then `lenis.destroy()` | N/A |
| Flip back | Preference returns to no-preference | A new instance is constructed; the old one is not reused | N/A |
| No `matchMedia` | Bare jsdom or a webview without it | The hook answers `false`; Lenis constructed as today, nothing throws | N/A |

</frozen-after-approval>

## Code Map

- `app/providers.tsx`: the change. `:12-33` is the whole component: effect with `[]` deps, Lenis
  at `:14`, ticker at `:20-21`, `lagSmoothing(0)` at `:24`, cleanup at `:26-29`. Mounted once from
  `app/layout.tsx:43`, wrapping `Header` and every route.
- `hooks/useReduceMotion.ts`: the source of truth; returns state, so it is a valid effect
  dependency. `:18` counts consumers and `:27-29` lists them dated. The true count is five, not
  three: `hooks/useNarrativePath.ts:175` was never counted. Fix the number, name the two missing
  consumers, keep the dated history.
- `hooks/__tests__/useReduceMotion.test.ts:30-39`: `mockMatchMedia(matches)` harness for the
  `matches` value only. It hands out a fresh `addEventListener` spy per `matchMedia` call and the
  hook calls `matchMedia` twice (initializer, then effect), so the `change` listener lands on the
  second object; a flip harness needs one shared spy across calls.
- `vitest.setup.ts:8-18`: the suite-wide `matchMedia` stub answers `false`; a test that overrides
  it must restore it in `afterEach`, or the cases become order-dependent.
- `components/atoms/WorkItem/__tests__/WorkItem.test.tsx:42-53`: the `vi.hoisted` + `vi.mock('gsap', ...)`
  idiom to copy for `gsap` (`ticker.add`, `ticker.remove`, `ticker.lagSmoothing`, `registerPlugin`)
  and `gsap/ScrollTrigger`; mock `lenis` with a default-export constructor spy returning
  `{ on, raf, destroy }`.
- `tests/e2e/suite-directory.pw.ts:329-378`: the `/#suite` fragment case, on the default `page`
  fixture (pinned `reduce`). Its comments at `:332-333` and `:340-341` and the message at
  `:362-364` name Lenis as the hazard. `:242-259` (`pastTheBreakpoint`) is the file's own shape
  for a second context that differs in one option; `tests/e2e/narrative.pw.ts:290-308`
  (`withMotion`) is the same shape with `reducedMotion: 'no-preference'`.
- Comments that say Lenis is installed unconditionally: `playwright.config.ts:75-78`,
  `tests/e2e/harness.ts:92`, `tests/e2e/narrative.pw.ts:186-187` and `:1221-1222`,
  `tests/e2e/front-door.pw.ts:284`, `tests/e2e/suite-directory.pw.ts:332-333` and `:340-341`.

## Tasks & Acceptance

**Execution:**
- [x] `app/providers.tsx`: call `useReduceMotion()`, return early from the effect when it is
  `true`, add it to the dependency array; keep everything else in the effect as is. Fix the
  `begind` typo in the comment while the line is touched and say in a short comment why the
  dependency array is the teardown.
- [x] `hooks/useReduceMotion.ts:18`: the consumer count becomes five, naming `app/providers.tsx`
  and `hooks/useNarrativePath.ts` (loop 1: was "four").
- [x] `app/__tests__/providers.test.tsx`: new: the five matrix rows plus unmount teardown, the
  flip driven through the captured `change` handler inside `act()`; assert `ticker.remove` receives
  the exact function `ticker.add` received.
- [x] `tests/e2e/suite-directory.pw.ts`: run the `/#suite` fragment case a second time on a
  `no-preference` context, so the Lenis condition it guards against is actually on; the existing
  run on the pinned context stays as the native-scroll check (loop 1).
- [x] The seven comment sites in the Code Map's last entry: say that Lenis is constructed only
  when the motion preference is not `reduce`, and that the pinned harness context therefore runs
  without it (loop 1). Comments only; no assertion moves.

**Acceptance Criteria:**
- Given the suite-wide `matchMedia` stub, when `Providers` mounts, then Lenis is constructed
  exactly once (the existing behaviour is unchanged for the no-preference visitor).
- Given `matches: true`, when `Providers` mounts and unmounts, then the `lenis` constructor is
  never called and `gsap.ticker.add` is never called.
- Given a running instance, when the change handler fires with `matches: true`, then
  `ticker.remove` and `destroy` are each called once, in that order, and no second instance exists.
- Given the full unit suite, when it runs, then every file still passes, and
  `tests/e2e/narrative.pw.ts`'s source sweep would find no `addEventListener('scroll'` in the diff.

## Spec Change Log

- **Loop 1, 2026-09-15.** Triggered by three review layers (blind hunter, edge case, verification
  gap) finding that the `/#suite` fragment case in `tests/e2e/suite-directory.pw.ts` guards
  against Lenis but runs on the pinned `reduce` context where, after this change, Lenis never
  mounts: a guard that passes while measuring nothing. Root cause was the frozen `Never` bullet
  "No e2e change", written on the premise that the pin made the harness correct everywhere; the
  Operator lifted it for that one case plus a comment sweep. Known-bad state avoided: the only
  browser check of Lenis versus the fragment jump silently switched off. KEEP: the code in
  `app/providers.tsx` is unchanged by this loop; every layer passed it, the Design Review approved
  it, and the mechanism (the dependency array as the teardown) stays exactly as written.
- **Loop 1 patches, 2026-09-15.** The `lenis` class Lenis writes onto `<html>` is asserted on both
  fragment runs: the `no-preference` run proves it mounted, and the pinned run proves it absent,
  which is the only browser proof that A-17 holds. The Never bullet's "no other e2e assertion
  changes" is therefore read as no other case changes. The loop-0 entry's "only browser check"
  overstated it: `narrative.pw.ts:692-741` also lands on `/#suite` with Lenis mounted, polling
  `toBeInViewport` with no settle window, and the fragment case here is the one with the window.
  The frozen Intent's "beside the hook's tests" is superseded by the approved Tasks line placing
  `app/__tests__/providers.test.tsx` beside the component, accepted by the Operator on 2026-09-15.
  `gsap.ticker.lagSmoothing(0)` moved above the guard so it is set for every visitor as before, and
  the guard gates Lenis only.

## Verification

**Commands:**
- `corepack pnpm typecheck`: expected exit 0.
- `corepack pnpm test --run app/__tests__/providers.test.tsx hooks/__tests__/useReduceMotion.test.ts`: expected: the new file's cases and the hook's seven pass, and pass again under `--sequence.shuffle.tests=true`.
- `corepack pnpm test --run`: expected: every file the diff can reach passes; run all of it, never without `--run`. On this host `ops/__tests__/library-backup.test.ts` fails because WSL is broken (`bash.exe` answers E_UNEXPECTED), which CI on `ubuntu-latest` does not see.
- `corepack pnpm build`: expected exit 0.
- `Get-ChildItem app,hooks -Recurse -Include *.ts,*.tsx | Select-String "addEventListener\(\s*['\"]scroll"`: expected no output (the e2e sweep's own regex, over tracked and untracked files alike).
- `corepack pnpm exec playwright test tests/e2e/suite-directory.pw.ts -g "resolves /#suite"`: expected: both runs of the case pass; this needs a local Chromium (`corepack pnpm exec playwright install chromium`) and builds the site through the config's `webServer`. It is not a baseline test, so running it on this host is fine.

**As run, 2026-09-15**, on the final tree after the loop 1 patches:

- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test --run app/__tests__/providers.test.tsx hooks/__tests__/useReduceMotion.test.ts`: 2 files, 14 passed (7 and 7).
- The same with `--sequence.shuffle.tests=true --sequence.seed=11`: 14 passed; with `--sequence.seed=2`: 14 passed.
- `corepack pnpm test --run`: 56 files, 1342 passed (`ops/__tests__/library-backup.test.ts` passed on this host).
- `corepack pnpm build`: compiled successfully, exit 0.
- `Get-ChildItem app,hooks -Recurse -Include *.ts,*.tsx | Select-String "addEventListener\(\s*['\"]scroll"`: no output.
- A sweep of every added line in `git diff -U0` plus the two untracked files (466 lines) for an em-dash, an en-dash, a double-dash standing in for a dash, or an emoji: no hits.
- `corepack pnpm exec playwright test tests/e2e/suite-directory.pw.ts -g "resolves /#suite"`: 2 passed (`:399` on the pinned context, `:417` under the `no-preference` `test.use`), 25.9s including the build.
- The full `test:e2e` suite runs in CI inside the Playwright image and was not run here.

## Suggested Review Order

**The guard and its teardown**

- Entry point: one early return, and `lagSmoothing` above it so the change gates Lenis only
  [`providers.tsx:26`](../../app/providers.tsx#L26)

- The dependency array is the teardown; a flip reruns the effect and React cleans up the running instance
  [`providers.tsx:43`](../../app/providers.tsx#L43)

- The cleanup itself is unchanged: ticker callback off, then destroy
  [`providers.tsx:39`](../../app/providers.tsx#L39)

- The hook is state and already subscribes to the query, which is what makes it a valid dependency
  [`useReduceMotion.ts:32`](../../hooks/useReduceMotion.ts#L32)

**Proving the flip in a unit**

- The flip is fired through the hook's real `change` handler, captured from one shared spy
  [`providers.test.tsx:45`](../../app/__tests__/providers.test.tsx#L45)

- Flip to reduce: `remove` gets the exact function `add` got, and runs before `destroy`
  [`providers.test.tsx:108`](../../app/__tests__/providers.test.tsx#L108)

- No hydration branch: identical markup under both answers, not merely "children rendered"
  [`providers.test.tsx:93`](../../app/__tests__/providers.test.tsx#L93)

- The restore that keeps the file order-independent under shuffle
  [`providers.test.tsx:69`](../../app/__tests__/providers.test.tsx#L69)

**Proving it in a browser, on both contexts**

- One body, two runs; `lenis` says which condition the run measures and the class proves it
  [`suite-directory.pw.ts:271`](../../tests/e2e/suite-directory.pw.ts#L271)

- The positive run polls for the class before the fixed window, so slow hydration cannot fake a failure
  [`suite-directory.pw.ts:281`](../../tests/e2e/suite-directory.pw.ts#L281)

- The second run differs from the pinned one in one context option and nothing else
  [`suite-directory.pw.ts:415`](../../tests/e2e/suite-directory.pw.ts#L415)

**Peripherals**

- Why the pinned harness context now runs with no Lenis at all
  [`playwright.config.ts:80`](../../playwright.config.ts#L80)

- The consumer count, corrected to five and naming the two the old text missed
  [`useReduceMotion.ts:18`](../../hooks/useReduceMotion.ts#L18)

- The architecture note no longer says Lenis is unconditional
  [`README.md:123`](../../README.md#L123)

- The audit's A-1 now names this spec as its closure
  [`review-apple-design-2026-09-15.md:45`](../planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/review-apple-design-2026-09-15.md#L45)
