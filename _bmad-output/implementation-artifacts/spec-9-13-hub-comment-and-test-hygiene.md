---
title: 'Story 9-13: fix stale Hub comments and add the missing Hub tests'
type: 'chore'
created: '2026-10-18'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
baseline_commit: 'ba82cbe076785b1038e417c766417be26778be24'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-plan-2026-10-18.md'
  - '{project-root}/_bmad-output/implementation-artifacts/dw-triage-2026-10-18.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Four Hub components cite `lib/__tests__/registry.test.ts:621-668` for the bundle guard, which now sits elsewhere, and `SuiteDirectory.scss` and `useReduceMotion.ts` state counts that stopped being true (Epic 2 retrospective item 7). `PlateMarkProps.label` documents section identity while its call sites pass page identity, site identity and a count (DW-239). The `/api/health` tests mock `NextResponse.json`, so the serialized body the keyword monitor asserts is never observed, and nothing asserts the rendered Umami tag (DW-144, DW-155). `SCANNED_EXTENSIONS` in `anchor-contract.test.ts` omits `.json` (DW-217).

**Approach:** Cite by symbol (the `describe` name, a constant, a component), restate the two counts and the `label` contract against every real call site, test `/api/health` through the real `NextResponse` and the root layout's `Script` element, and add `.json` to the scanned extensions. Every new assertion is planted.

</frozen-after-approval>

## Implementation Notes

Route: oneshot (no intent gap, nothing irreversible, eleven Hub files). Sprint-status sync to `in-progress` and `review` was skipped: the orchestrator's push step owns `sprint-status.yaml`.

**Commits** on `epic9/9-13-hub-comment-and-test-hygiene`:

- `4c39721c83c35fb8655fcf6cc234719741021515` docs(hub): the four `:621-668` citations (`Premise`, `SuiteDirectory`, `SiteFooter`, `CvIntro`) now name the `describe` `the Registry stays out of the browser bundle`; `CvIntro`'s `Premise.tsx:91-110` became "`Premise`'s render"; `Premise.test.tsx`'s `registry.test.ts:36-37` became its `HERE` constant. `SuiteDirectory.scss` says the Hub declares no custom property since `--hero-height` went (DW-122). `useReduceMotion.ts` counts three consumers (`WorkHero`, `WorkItem`, `useNarrativePath`) and says when `HomeLayout` stopped. `PlateMark.tsx`: the component docblock and `label` list the three kinds of call site (page identity, site identity, counted readout) and say the design intends each (DW-239).
- `f2474ee19a328cfbd063a8612ce2e2e44844f158` test(hub): `app/api/health/__tests__/route.test.ts` drops the `next/server` mock and runs under `@vitest-environment node`; `route.ts` gains a comment naming the monitored substring. New `app/__tests__/layout.test.tsx` walks the element tree `RootLayout` returns for the `next/script` element (a static render shows nothing for `afterInteractive`).
- `3c1dcbab952d9d54efd51f8767895dbd8774ba2d` test(hub): `.json` joins `SCANNED_EXTENSIONS`, with its comment and the anticipatory-extensions comment updated. No tracked JSON sits under a scanned root or a new root, so both floors and the root pin held unchanged.

`DESIGN.md` still words the Section variant as "section identity above a section head"; it is a planning artifact and was left as written (see findings for the Operator).

### Planted failures

Each was planted on the working copy, run, then restored from a copy; the restored suite is green.

| Assertion | Plant | Output |
|---|---|---|
| route: `toContain('"status":"ok"')` | body pretty-printed with `JSON.stringify(..., null, 2)` | `AssertionError: expected '{\n  "status": "ok",\n  "version": "u…' to contain '"status":"ok"'` |
| route: `status` is 200 | `NextResponse.json(body, { status: 503 })` | `AssertionError: expected 503 to be 200 // Object.is equality` |
| route: content type JSON | served as `text/plain` | `AssertionError: expected 'text/plain' to contain 'application/json'` |
| route: version is a string | `version: 42` | `AssertionError: expected 'number' to be 'string' // Object.is equality` |
| route: uptime non-negative | `uptime: -1` | `AssertionError: expected -1 to be greater than or equal to 0` |
| layout: one `Script` | condition forced to `false` | `AssertionError: expected [] to have a length of 1 but got +0` |
| layout: `src` | `/script.js` changed to `/umami.js` | `AssertionError: expected 'https://umami.example.test/umami.js' to be 'https://umami.example.test/script.js'` |
| layout: `data-website-id` | id fed from the URL variable | `AssertionError: expected 'https://umami.example.test' to be 'site-1234'` |
| layout: no tag when either variable is empty | `&&` between the variables changed to `\|\|` | both cases: `AssertionError: expected [ { …(10) } ] to deeply equal []` |
| anchor: `.json` is read by the `contracts/` mention check | `lib/planted.json` holding `"contracts/tokens.css"` | `× mentions contracts/ in the wiring file and nowhere else` ... `+   "lib/planted.json",`; control with `.json` removed from the list: 18 passed (18) |
| anchor: `.json` reaches the root pin | tracked (`git add -N`) `apps/hub/data/planted.json` | `× scanned every stylesheet and every shipped source under every source root`: `a top-level directory carries shipped .scss/.css/.ts/.tsx/.js/.jsx/.mjs/.cjs/.json sources and is not in SCANNED` |

## Review Triage Log

The Blind Hunter layer asks for a context-free subagent, and this run had no subagent tool, so it did not run as a separate agent. An inline pass over the diff stood in for it and is not counted as a review layer:

- Comments: each new citation names a symbol that exists (`describe('the Registry stays out of the browser bundle')`, `HERE`, `Premise`, `WorkHero`, `WorkItem`, `useNarrativePath`, `HomeLayout`'s docblock); `DESIGN.md` § Components carries the **Plate mark** paragraph; `mockups/key-screens.html` exists. No issue.
- Tests: the route cases read the real `Response`; the layout cases unstub env after each case. No issue.
- Prose rule: the added lines carry no em-dash, en-dash or double-dash. No issue.

## Independent verifier

Round 1: findings. The verifier planted an envelope (`NextResponse.json({ data: { status, version, uptime } })`) and the substring case stayed green, because compact `{"data":{"status":"ok",...}}` still carries `"status":"ok"`; only the version case went red. So the new docblocks in `route.ts` and `__tests__/route.test.ts` were wrong to say an envelope takes the substring off the wire, and `route.ts` was wrong to require `status` at the top level. Both now name only what removes the substring: pretty-printing the body, or renaming or retyping `status`. This section also read `pending` while the front matter read `done`; this entry records the round. Fixed in the commit that follows this round.

## Ledger closures

**DW-144:** **Closed 2026-10-18 by Story 9-13-hub-comment-and-test-hygiene** (`f2474ee`, `apps/hub/app/api/health/__tests__/route.test.ts`: `GET /api/health`): the `next/server` mock is gone, and the cases run under the node environment against the real `NextResponse`, reading the serialized body: one asserts the literal substring `"status":"ok"` the keyword monitor asserts, one the 200 status and JSON content type, one the version and uptime parsed back from the text. `route.ts` carries a comment naming the monitored substring. Each assertion was planted, pretty-printing the body among them.

**DW-155:** **Closed 2026-10-18 by Story 9-13-hub-comment-and-test-hygiene** (`f2474ee`, `apps/hub/app/__tests__/layout.test.tsx`: `the root layout carries the first-party Umami tag`): the health half closes with DW-144. The tag half is a Vitest case that stubs both Umami variables and finds the `next/script` element in the tree `RootLayout` returns, asserting its `src` (`<url>/script.js`) and `data-website-id`, plus two cases that each empty one variable and find no tag. Each assertion was planted. No job reads a monitor's configuration; `ops/monitoring.md` remains the record of that.

**DW-217:** **Closed 2026-10-18 by Story 9-13-hub-comment-and-test-hygiene** (`3c1dcba`, `apps/hub/app/__tests__/anchor-contract.test.ts`: `SCANNED_EXTENSIONS`): `.json` is scanned. A planted `lib/planted.json` naming `contracts/tokens.css` fails the `contracts/` mention check, and a planted tracked JSON under a new root fails the root pin; no tracked JSON sits under a scanned root, so the floors and `PRESENT_EXTENSIONS` are unchanged.

**DW-239:** **Closed 2026-10-18 by Story 9-13-hub-comment-and-test-hygiene** (`4c39721`, `apps/hub/components/molecules/PlateMark/PlateMark.tsx`: `PlateMarkProps.label`): the prop's contract is restated against every call site rather than one: a page's identity (`CvIntro`, `Error404`), the site's own identity over a block with no heading (`Premise`, as `mockups/key-screens.html` draws it), and a counted readout (`WorkHero`'s meta line, which the old text's "never a count" contradicted). The count is a length read from its source, never a typed number. The component docblock says the same. `DESIGN.md`'s "section identity above a section head" is left as written.

**epic-2-retro-item-7-correct-the-stale-registry-test-ts-621-6:** done 2026-10-18 by Story 9-13 (`4c39721`): the four citations name the `describe` `the Registry stays out of the browser bundle`, and `SuiteDirectory.scss` and `useReduceMotion.ts` state the true counts.

## Verification

- `corepack pnpm vitest run apps/hub/app apps/hub/components/molecules/PlateMark`: 8 files, 74 tests passed.
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test -- --run`: 85 files, 2005 passed, 4 skipped, 7 failed (2016). The seven failures were one case each in the seven WSL-bash suites (DW-135: `demo-reset`, `deploy-remote`, `library-backup`, `postgres-backup`, `postgres-init`, `tournament-backup`, `tracker-backup`). Re-run alone: 7 files, 187 passed, 1 skipped (188).
- `corepack pnpm --filter hub build`: exit 0, `/api/health` listed as dynamic.
- No per-app suite was due: nothing under `apps/finance`, `apps/tracker` or `apps/tournament` changed. No rendered-output baseline was touched: the changes are comments and tests.
