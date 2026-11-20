---
title: 'Story 9-15: fix the header scroll-padding and the dead Vary: Save-Data'
type: 'bugfix'
created: '2026-10-18'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'eb76d24b8aed199df7c3d54258f3fcf06ead0c64'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-plan-2026-10-18.md'
  - '{project-root}/_bmad-output/implementation-artifacts/dw-triage-2026-10-18.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The header's scroll padding restates its one-row block size from four tokens, so a fragment target
lands a line under a wrapped header, and the rule also applies on `/celeste`, where the band is hidden (DW-118).
`next.config.js` declares `Vary: Save-Data` for `/`, and Next replaces `Vary` on every App Router response, so the
source promises a header the wire never carries (DW-51).

**Approach:** The band measures itself and writes its real height as the root's scroll padding, taking it back
when it leaves or measures zero; the first-paint rule stays and excludes `/celeste`. The dead `Vary` declaration
goes, and a browser case holds every header `next.config.js` declares for `/` to the wire.

## Boundaries & Constraints

**Always:** Hub only (`apps/hub`, its unit tests, `tests/e2e`). `Header.scss` stays token-native (no custom
property, no literal). The `/` guarantee (varies on `Save-Data` or unstorable by a shared cache) keeps its case.
Rendered-output baselines change only where `ops/rendered-output-harness.md` allows.

**Never:** No `proxy.ts` or middleware for one header (it is applied before Next's `setHeader('Vary')`, so it
is overwritten too). No Traefik change. No new dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| One row | `/work`, `/cv`, 404 at 360 | root scroll padding equals the header's height | N/A |
| Wrapped row | a full-width child forces a second line | padding follows to the taller height | N/A |
| Hidden band | `/celeste` | computed padding `auto` | N/A |
| Band leaves | route becomes `/` | inline padding removed, `/` reads `auto` | N/A |
| Config header | a `headers()` entry for `/` | arrives on the wire as declared, or the case fails | N/A |

</frozen-after-approval>

## Code Map

- `apps/hub/components/molecules/Header/Header.tsx`: `reserveScrollPadding`, a module-scope ref callback with a
  `ResizeObserver`; React 19 runs its returned cleanup when the `<header>` leaves.
- `apps/hub/components/molecules/Header/Header.scss`: first-paint rule, selector now
  `html:has(body:not(#celeste) .header-container)` (`Body` writes the route onto `<body id>`, `Container.tsx`).
- `apps/hub/next.config.js`: `headers()` removed, comment says why.
- `next/dist/build/templates/app-page.js:453-454` (Next 16.2.1): `res.setHeader('Vary', varyHeader)` before
  render: the replacement point, read 2026-10-18.
- `tests/e2e/chrome-nav.pw.ts` fragment case, `tests/e2e/front-door.pw.ts` `the served document`,
  `apps/hub/components/molecules/Header/__tests__/Header.test.tsx`, `ops/__tests__/hit-target-floor.test.ts:784`
  (comment named the `headers()` source).
- Citations of `Header.tsx` by line, repointed to `:40` (the component) and `:48` (`path !== '/'`): `Navbar.tsx`,
  `Navbar.test.tsx`, `accessibility-floor.pw.ts`, `celeste-header.pw.ts`, `chrome-nav.pw.ts`,
  `hit-target-floor.pw.ts`, `ops/hit-target-floor.md`, `ops/hub-accessibility-pass.md`.

## Tasks & Acceptance

**Execution:**
- [x] `Header.tsx`: measure the band, write and retract the root padding (DW-118 ceiling 1).
- [x] `Header.scss`: exclude `/celeste` from the first-paint rule, rewrite the ceiling comment (DW-118 ceiling 2).
- [x] `next.config.js`: drop the dead `Vary` (DW-51).
- [x] `Header.test.tsx`, `chrome-nav.pw.ts`, `front-door.pw.ts`: planted cases for every matrix row.

**Acceptance Criteria:**
- Given the pinned container, when `pnpm test:e2e` runs, then it is green and the rendered-output baselines are
  untouched.

## Implementation Notes

- **I-1 (open inference, needs an Operator ruling before the push).** `AGENTS.md` § Known pitfalls says a route
  needing different chrome "takes a rule on that id, never an effect that mutates another component's node", and
  DW-118's own text read that as ruling out measuring the band from script. The epic plan's done line ("follows the
  real header height") cannot be met in CSS: `scroll-padding` accepts no `anchor-size()`, and the root cannot read
  a descendant's size. The reading taken: the rule's subject is per-route chrome and its failure is a mutation that
  outlives a cleanup that never runs; this write is a measurement, owned by the component that already owned the
  property (`Header.scss` on `html:has(...)`), retracted by a ref cleanup that runs whenever the band leaves.
  Ruling: pending.
- jsdom has no `ResizeObserver`; `Header.test.tsx` stubs one that records its callback.
- `/` measured 2026-10-18 on the local build: `Vary: rsc, next-router-state-tree, next-router-prefetch,
  next-router-segment-prefetch, Accept-Encoding`, `Cache-Control: private, no-cache, no-store, max-age=0,
  must-revalidate`, before and after the removal (the declaration never arrived).

## Planted failures

Each new assertion was made to fail once by breaking what it guards, then restored from a copy (`git diff --stat`
checked after each). Unit plants ran on the host with `corepack pnpm vitest --run apps/hub/components/molecules/Header`;
e2e plants ran in `mcr.microsoft.com/playwright:v1.62.1-noble` on volumes `epic-scratch-9-15-nm` and
`epic-scratch-9-15-next`, `pnpm test:e2e <spec> -g <case>`.

- **U1, the `ref={reserveScrollPadding}` removed from `<header>`:** `× writes its measured height, follows it when
  it grows, and takes it back when it leaves`, `AssertionError: the measured one-row band did not reach the root:
  expected '' to be '93px'`; `× writes nothing for a band that measures zero, which is /celeste hiding it`,
  `AssertionError: a hidden band still reserves scroll padding: expected '93px' to be ''`; `Tests 2 failed | 25
  passed (27)`.
- **U2, the cleanup's `removeProperty` dropped:** `AssertionError: the padding outlived the band, so \`/\` would
  inherit it: expected '151.5px' to be ''`, `Tests 1 failed | 26 passed (27)`.
- **E1, the ref removed and Story 2-13's `headers()` block planted back in `next.config.js`:** `✘ chrome-nav.pw.ts:710
  keeps a fragment target out from under the sticky header`, `Error: /work reserves the one-row height for a header
  wrapped to 157`, `Expected: 157`, `Received: 93`; `✘ front-door.pw.ts:557 carries every header next.config.js
  declares for it, as declared`, `Error: next.config.js declares Vary: Save-Data for / and the response carries Vary:
  rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding`; `2 failed`.
- **E2, the `Header.scss` selector put back to `html:has(.header-container)`:** `Error: /celeste reserves scroll
  padding for a header it hides`, `Expected: "auto"`, `Received: "93px"`, `1 failed`.
- **E3, `observe(band)` without `{ box: 'border-box' }`:** `Error: /work reserves 157 for a header whose padding grew
  it to 189`, `Expected: 189`, `Received: 157`, `1 failed`.
- **E4, the cleanup's `removeProperty` dropped:** `Error: the home route, reached from /work by the wordmark, keeps
  the padding the band wrote`, `Expected: "auto"`, `Received: "93px"`, `1 failed`.

The front-door declared-headers case iterates zero declarations on the shipped config, stated in its comment; E1
is what it guards.

## Review Triage Log

Layers: Blind Hunter, Edge Case Hunter, Verification Gap and `verification-loop`, run inline by this workflow
sub-agent (it has no tool to launch review subagents). Design review: no motion; the surface change is one selector
and a measurement, no visual value moves. Findings and verdicts:

- The observer watched the default content box, so a padding change in `rem` (a reader's text size) with the
  `--tap` row unchanged would not fire it. **medium, patched**: `{ box: 'border-box' }`, planted as E3.
- The matrix row "band leaves" was held only by the unit test with a stub; a real client navigation was not.
  **medium, patched**: the fragment case navigates `/work` to `/` by the wordmark, planted as E4.
- The new comments in `Header.tsx` named `--tap` and `--s-lg`, which `anchor-contract.test.ts` refuses outside the
  token-native list (it failed in the first full suite run). **high, patched**: reworded without role names.
- The insertion moved `Header.tsx`'s `path !== '/'` from line 18 to 48 and the component from 10 to 40, so five
  citations went stale, and three citing `:12` were already stale. **low, patched**: all eight repointed.
- Before hydration a wrapped header still gets the one-row padding, so a fragment URL loaded cold under a wrap
  lands a line short until the page hydrates, and the browser does not re-scroll. **low, rejected**: the wrap
  happens only below the supported 360 floor or under heavy text zoom, and closing it needs script before paint.
- The front-door declared-headers case passes on zero declarations. **false as a defect**: stated in the case,
  and E1 shows it failing on the declaration it exists for.
- `getBoundingClientRect().height` could read a transformed box. **false**: nothing transforms the header.
- `narrative.pw.ts:839` failed once in the first full run (`Test timeout of 60000ms exceeded`, `End of central
  directory record signature not found`, a trace artifact). **false for this story**: `/` renders no header, and
  the spec re-run alone passed 31 of 31.

## Ledger closures

- **DW-118:** **Closed 2026-10-18 by Story 9-15-hub-chrome-and-headers** (`apps/hub/components/molecules/Header/Header.tsx`:
  `reserveScrollPadding`): the band measures itself with a `ResizeObserver` and writes its real height as the root's
  `scroll-padding-block-start`, retracting it when the band leaves the document or measures zero, so a wrapped row
  is covered; the four-token rule in `Header.scss` stays as the first paint's value and now reads
  `html:has(body:not(#celeste) .header-container)`, so `/celeste` reserves nothing. `tests/e2e/chrome-nav.pw.ts`
  holds the padding equal to a header wrapped by a planted full-width child and to one grown by its own padding on
  `/work` and the 404, `auto` on `/celeste`, and `auto` on `/` reached from `/work` by the wordmark; `Header.test.tsx`
  holds the write, the follow and both retractions.
- **DW-51:** **Closed 2026-10-18 by Story 9-15-hub-chrome-and-headers** (`apps/hub/next.config.js`): the
  `Vary: Save-Data` declaration is removed, since Next 16.2.1's App Router handler sets `Vary` before every render
  (`app-page.js:453-454`) and a proxy or the config cannot reach it. `/` stays guarded by the `private, no-store`
  a dynamic route is answered with, which `tests/e2e/front-door.pw.ts` keeps asserting, and a new case there fails
  any header a `headers()` block declares for `/` that does not arrive as written.

No sprint-status action item names this story.

## Verification

**Commands, run 2026-10-18 in this worktree:**
- `corepack pnpm test -- --run` (full root suite, final tree): `Test Files 85 passed (85)`, `Tests 2020 passed | 4
  skipped (2024)`. An earlier run failed 10: one real (`anchor-contract.test.ts`, the role names in `Header.tsx`
  comments, patched) and nine DW-135 30-second WSL stalls in `library-backup`, `postgres-backup`,
  `tournament-backup` and `tracker-backup`, which passed re-run (`Tests 157 passed | 1 skipped (158)` with
  `anchor-contract` and `Header`).
- `corepack pnpm typecheck`: exit 0. Only `apps/hub` changed, which the root suite covers; no per-application
  suite applies.
- Container e2e, final tree (`pnpm test:e2e` in `mcr.microsoft.com/playwright:v1.62.1-noble`, volumes
  `epic-scratch-9-15-nm` and `epic-scratch-9-15-next`): `344 passed`, `1 failed`, the failure
  `narrative.pw.ts:839` (`Test timeout of 60000ms exceeded`, a trace zip error) on `/`, which renders no header;
  the same case failed the same way in the first full run and `tests/e2e/narrative.pw.ts` alone then passed
  `31 passed`. `rendered-output.pw.ts` passed on both full runs and `git status` shows no snapshot change, so the
  `/work` baseline is untouched.
- `/` headers on the local build (`next start`): `Vary: rsc, next-router-state-tree, next-router-prefetch,
  next-router-segment-prefetch, Accept-Encoding`, `Cache-Control: private, no-cache, no-store, max-age=0,
  must-revalidate`.

**Independent verifier:** PASS on round 1, 2026-10-18, separate agent; tests: all runs on the story worktree at
`66d32e1` (before the rebase onto `7219305`, which touched nothing under `apps/hub`).
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test -- --run`, full root suite: 81 of 85 files passed; 4 failed, 2016 passed, 4 skipped (2024
  tests). The 4 failures were all DW-135 WSL-bash cases (`demo-reset`, `library-backup`, `tournament-backup`,
  `tracker-backup`) while a container e2e run loaded the host; re-run, 4 of 4 files passed, 122 of 122 tests.
- No per-application suite applies: nothing under `apps/finance`, `apps/tracker` or `apps/tournament` changed.
- Container e2e, full `pnpm test:e2e` in `mcr.microsoft.com/playwright:v1.62.1-noble` on volumes
  `epic-scratch-9-15-nm` and `epic-scratch-9-15-next`: 344 passed, 1 failed, `visitor-instrumentation.pw.ts:265`,
  whose own message calls it a slow runner (stub installed 26974 ms after settle, bound 18500) under the concurrent
  Vitest run; `visitor-instrumentation.pw.ts` and `chrome-nav.pw.ts` re-run in the same container: 25 passed,
  0 failed. The new and changed cases `chrome-nav.pw.ts:710` and `front-door.pw.ts:557` passed, and the builder's
  `narrative.pw.ts:839` flake passed (58.1s). `rendered-output.pw.ts` passed, the `/work` 360 x 800 baseline
  included, and `git status` was clean after every run, so no snapshot was written.
- Verifier's plant: deleting the cleanup's `root.style.removeProperty` in `Header.tsx` failed
  `vitest --run apps/hub/components/molecules/Header` 1 of 27 ("the padding outlived the band, so `/` would
  inherit it: expected '151.5px' to be ''"); restored, `git status` clean.
- Also checked: the Next citation holds (`next/dist/build/templates/app-page.js` lines 453-454 in next 16.2.1 set
  `Vary` before render); no em-dash, en-dash, dash-standing double hyphen or emoji on any added line; nothing under
  `contracts/`, and `ci.yml`, `deferred-work.md` and `sprint-status.yaml` untouched; every `Header.tsx:N` citation
  matches the file. The scratch volumes were removed afterwards.
