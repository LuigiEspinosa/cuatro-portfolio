---
title: 'Story 9-12: move the duplicated e2e helpers into harness.ts'
type: 'refactor'
created: '2026-10-18'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '66a4e0ebfc18470da54806020b37f061bcbade95'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-plan-2026-10-18.md'
  - '{project-root}/_bmad-output/implementation-artifacts/dw-triage-2026-10-18.md'
  - '{project-root}/ops/rendered-output-harness.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The navigation guard `goTo` is written out in 18 spec files and again inside `expectRouteScreenshot`, `probeComputed` in 5, `plantStyle` in 6, `durationMs` in 2 and `EDGE_SLACK` in 6; the `FINGERPRINTS` table is parsed out of `ops/asset-budget.mjs` as text in 3 specs; `projects-redirect.pw.ts` sweeps a hand-copied `SWEPT`; `contract-anchor.pw.ts` fails the blocking gate on one transient socket error; `premise.pw.ts` sweeps the whole document for overflow (epic-2 retro item 9, DW-22, DW-232, DW-49, DW-40, DW-237, DW-221, DW-105, DW-61, DW-224).

**Approach:** Each helper lives once in `tests/e2e/harness.ts` and every spec imports it. The fingerprint table moves to `ops/asset-budget-fingerprints.json`, which the tool and the harness both load. `SURFACES` moves to the harness so `SWEPT` derives from it. A request helper retries a thrown network error a bounded number of times and never retries a status.

## Boundaries & Constraints

**Always:** each helper keeps its current behaviour and names the route, selector or property in any failure (the harness rule). A new assertion is planted once and its failure recorded here. The full e2e suite runs green in `mcr.microsoft.com/playwright:v1.62.1-noble` with no baseline written.

**Never:** a baseline change, a test title change (`ops/__tests__/status-mark-axes.test.ts` parses titles), a `test.retry` or `retries` change, a new dependency, a change to the application.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Status differs | `goTo(page, '/a-route-that-does-not-exist')` | rejects naming the route and both statuses | throw |
| Stated 404 | `goTo(page, NOT_FOUND, 404)` | resolves after the fonts are ready | N/A |
| Empty probe | `probeComputed(page, 'color:red', '--undeclared')` | rejects naming the property | throw |
| Transient fetch | `request.get` throws twice, then answers | `getWithRetry` answers the third response | N/A |
| Persistent fetch failure | throws on every attempt | rejects naming the URL and the attempt count | throw |
| Real 404 | server answers 404 | answered once, never retried | caller asserts the status |

</frozen-after-approval>

## Code Map

- `tests/e2e/harness.ts`: gains `NOT_FOUND`, `SURFACES` (moved verbatim from `hit-target-floor.pw.ts:144`, with its docblock), `EDGE_SLACK`, `goTo`, `probeComputed`, `plantStyle` (returns its removal, which `display-entrance.pw.ts` uses), `durationMs`, `getWithRetry`, `FINGERPRINTS`. `expectRouteScreenshot` navigates through `goTo`. Docstring lists the helpers, not stories (DW-221).
- `ops/asset-budget.mjs:83`: `FINGERPRINTS` read from the new JSON; its docblock stays. `ops/__tests__/asset-budget.test.ts:792` pins the values and holds unchanged.
- `ops/__tests__/hit-target-floor.test.ts:64-93,553,961`: reads `SURFACES` and `NOT_FOUND` from `harness.ts`; the regexes match an `export const` prefix as they are.
- Local `goTo` copies: accessibility-floor (keeps its init-script arming as a wrapper), anchor-aliases, celeste-header, chrome-nav, cv, display-entrance, error-surface (every call expects 404), front-door, hit-target-floor, narrative, plate-mark-and-work-item, premise, secondary-surfaces, status-mark, suite-directory (the last three keep their readiness waits as wrappers), type-swap, visitor-instrumentation, work-hero. Inline guarded `page.goto` in contract-anchor, contract-fonts, contract-serving, contract-tailwind, narrative, front-door, suite-directory, projects-redirect; unguarded in projects-redirect (`:344`, `:424`, `:490`, `:509`) and rendered-output (all Hub routes that answer 200 or a redirect landing on 200).
- `tests/e2e/projects-redirect.pw.ts:64`: `SWEPT` maps `SURFACES`.
- `tests/e2e/contract-anchor.pw.ts:897,969`: both re-fetches through `getWithRetry`.
- `tests/e2e/premise.pw.ts:236`: `outsideViewport` scoped to `.premise, .site-footer` and their descendants, refusing a sweep that matched nothing.
- `tests/e2e/front-door.pw.ts:257`, `visitor-instrumentation.pw.ts:162`: line citations replaced by symbol citations (DW-105).
- `ops/rendered-output-harness.md` § What the harness asserts: lists the new helpers.

## Tasks & Acceptance

**Execution:**
- [x] `ops/asset-budget-fingerprints.json`, `ops/asset-budget.mjs`: move the table.
- [x] `tests/e2e/harness.ts`: add the helpers above.
- [x] every spec in the Code Map: delete its copy, import the harness's.
- [x] `tests/e2e/rendered-output.pw.ts`: self-tests for `goTo`, `probeComputed`, `plantStyle` and `getWithRetry` covering the matrix.
- [x] `ops/__tests__/hit-target-floor.test.ts`: read the harness for `SURFACES` and `NOT_FOUND`.
- [x] `ops/rendered-output-harness.md`: record the helpers.

**Acceptance Criteria:**
- Given the tree, when `goTo`, `probeComputed`, `plantStyle`, `durationMs`, `EDGE_SLACK` and the fingerprint parse are searched under `tests/e2e`, then each is defined only in `harness.ts`.
- Given the pinned container, when `pnpm test:e2e` runs, then every case passes and the snapshot directory is unchanged.
- Given this host, when `corepack pnpm test -- --run` and `corepack pnpm typecheck` run, then both pass.

## Implementation Notes

- Implemented directly in this session at `6612c2a8a740975636a9b8598894187c7a91cf0f` (refactor) and `46f85d7a7871a78e59a73c5d9a25c9ab9741bcd9` (the `SURFACES` references in `ops/hit-target-floor.md`, the agreement suite's header and `secondary-surfaces.pw.ts`): this workflow sub-agent has no agent tool, so no implementation subagent was launched.
- `tests/e2e/harness.ts` now exports `goTo`, `probeComputed`, `plantStyle`, `durationMs`, `EDGE_SLACK`, `getWithRetry`, `FINGERPRINTS`, `NOT_FOUND` and `SURFACES` beside the original five. `expectRouteScreenshot` navigates through `goTo`, so the screenshot path and the assertion path share one guard (DW-22's ask); it now requires 200 exactly where it accepted any 2xx, and `/work` answers 200.
- `goTo` always waits for `document.fonts.ready`. Ten of the eighteen copies already did; the full container run shows the other eight specs unaffected.
- `probeComputed` now throws on an empty read (the harness rule); no caller relied on an empty answer (348 of 348 passed).
- `plantStyle` returns its removal, from a handle to the planted node, so `display-entrance.pw.ts`'s two sequential plants each remove their own rather than the first element with a shared id.
- Wrappers that add a readiness wait keep a local name and call the harness: `goToArmed` (accessibility-floor, installs its init script first), `goToPremise` (premise), `goToDirectory` (status-mark, suite-directory). error-surface calls `goTo(page, route, 404)` throughout.
- Inline guarded navigations were folded into `goTo` in contract-anchor, contract-fonts, contract-serving, contract-tailwind (fixture origins included: each already required 200 or `ok()`), narrative, front-door and suite-directory. Unguarded Hub navigations gained the guard after checking each target: projects-redirect `/work`, both journey sources (`/work`, `/`), `/` and `/projects#suite` (a 301 the browser follows to a 200 at `/#suite`, as its `:217` case already asserted), and all seven `page.goto(ROUTE)` in rendered-output (`/work`).
- `FINGERPRINTS`: the rows moved to `ops/asset-budget-fingerprints.json`; `ops/asset-budget.mjs` reads them with `readFileSync(new URL(..., import.meta.url))` and keeps its docblock; `ops/__tests__/asset-budget.test.ts` pins the same seven rows unchanged; `node ops/asset-budget.mjs` still loads (it stops at its own missing-build refusal). `narrative.pw.ts`'s "read whole" case lost its parsed-against-declared count, which only guarded the deleted regex; it keeps the non-empty, WebGL-present and non-empty-mark checks. `front-door.pw.ts` keeps its selection rule exactly (WebGL rows whose library includes `postprocessing`, two marks today).
- `SURFACES` moved verbatim with its history and a note saying "below" in that history means `hit-target-floor.pw.ts`. Three readers follow it: `ops/__tests__/hit-target-floor.test.ts` (`NOT_FOUND` and `SURFACES` read from the harness; a new case refuses a `const SURFACES` reappearing in the spec), `secondary-surfaces.pw.ts`'s "equals the swept surfaces" case (reads the harness text; title unchanged), and `projects-redirect.pw.ts` and `type-swap.pw.ts`, whose hand copies are now derived. `secondary-surfaces.pw.ts` keeps its guarded hand copy.
- `premise.pw.ts`'s `outsideViewport` sweeps `.premise, .premise *, .site-footer, .site-footer *` (the plate mark is inside `.premise`) and throws when that matches nothing; both failure messages now name the blocks.
- DW-105's two citations are now symbol citations (`withMotion`, `atAWiderWidth`, and the named front-door case). Other `file:line` citations in comments throughout `tests/e2e` shift with this diff and were not chased; see the findings.
- No baseline changed: `git status` after the container run showed nothing under `rendered-output.pw.ts-snapshots`.

### Planted failures

Each new or repointed assertion was broken once on purpose, observed failing, then restored with `git checkout`. Container plants ran in `mcr.microsoft.com/playwright:v1.62.1-noble` (`epic-scratch-9-12-e2e-harness-consolidation-plant`, volumes `-nm` and `-next`).

- P1 `goTo` status check (`if (false && response.status() !== expected)`): `goTo refuses a status other than the one stated` failed, `Error: expect(received).rejects.toThrow() Received promise resolved instead of rejected` at `goTo(page, NOT_FOUND)`.
- P2 `probeComputed` empty read (`if (false && value.trim() === '')`): `probeComputed resolves a declaration and refuses an empty read` failed, `Received promise resolved instead of rejected` at the `--not-declared-anywhere` read.
- P3 `plantStyle` removal made a no-op: `plantStyle plants a stylesheet ...` failed, `Error: the removal left the planted stylesheet in place ... Expected: "none" Received: "dashed"`.
- P4 `getWithRetry` default `attempts = 1`: `getWithRetry retries a thrown request ...` failed, `Error: Rendered-output harness: GET http://127.0.0.1:3100/a-route-that-does-not-exist threw on all 1 attempts. Last error: socket hang up`.
- P5 premise scope selector renamed to `.premise-x ...`: `puts nothing outside the viewport and paints nothing outside its own box` failed, `Error: no element matches .premise or .site-footer on the home route, so the overflow sweep would read nothing`. P1 to P5 ran together, one plant per case: `5 failed`.
- P6 `getWithRetry` retrying a 404 (`if (answered.status() === 404 && attempt < attempts) continue;`): the same case failed, `Error: a 404 was retried, which would hide a real one behind attempts Expected: 1 Received: 3`.
- P7 a planted row `{ route: '/planted', status: 200, ... }` in the harness `SURFACES`: `secondary-surfaces.pw.ts` "equals the swept surfaces" failed (`- "/planted 200"`); `projects-redirect.pw.ts` "exactly one surface renders the Suite Directory" failed visiting it (`route "/planted" answered HTTP 404, not 200`), which shows `SWEPT` derived; and on the host `ops/__tests__/hit-target-floor.test.ts` failed `parses both tables, and they carry the same pinned counts` with `"/planted is swept by tests/e2e/hit-target-floor.pw.ts and has no row in ops/hit-target-floor.md"`, `Tests 1 failed | 23 passed (24)`. P6 and P7 ran together: `3 failed, 1 passed`.
- P8 `const SURFACES = [];` appended to `hit-target-floor.pw.ts`: `found the record, the spec and the board` failed, `AssertionError: tests/e2e/hit-target-floor.pw.ts declares its own SURFACES again, beside the one in tests/e2e/harness.ts`, `Tests 1 failed | 23 passed (24)`.
- P9 the fingerprint load guard, on the host with `corepack pnpm exec playwright test --list tests/e2e/narrative.pw.ts`: `[]` in the JSON gave `Error: Rendered-output harness: ops/asset-budget-fingerprints.json holds no fingerprint, so every scan would classify nothing`; a row with `"mark": ""` gave `Error: ... gives three an empty mark, which matches every chunk`. Collection fails before any case runs (the config imports the harness too).
- Restored: `ops/__tests__/hit-target-floor.test.ts` and `asset-budget.test.ts` 91 of 91; the container plant cases were green in the full run below.

## Spec Change Log

## Review Triage Log

Every layer ran inline in this session (no agent tool to launch reviewer subagents from a workflow sub-agent). The independent verifier below is the check these layers are not.

| # | Layer | Finding | Verdict | Evidence and route |
|---|---|---|---|---|
| 1 | blind | `goTo` adds a fonts wait to eight specs that never waited, which could change a timing-sensitive read | false | Full container run 348 of 348 passed; `document.fonts.ready` after `load` resolves with the faces already settled, and no case reads a pre-font state off its first navigation |
| 2 | blind | `expectRouteScreenshot` now refuses a 2xx other than 200 | false as a defect | The only route it captures is `/work`, which answers 200; the record row says so |
| 3 | edge-case | `/projects#suite` through `goTo`: a hash navigation could produce a null response | false | A fresh `page.goto` to a different path is a real navigation; the 301 is followed and the 200 at `/#suite` is checked, which the redirect case at `:217` already asserted and the run passed |
| 4 | edge-case | `plantStyle`'s element handle is never disposed when the caller ignores the removal | low, rejected | One handle per planted style per test page, released with the page; fixing it adds API surface for no observed harm |
| 5 | edge-case | Moving `SURFACES` breaks every text reader of it | fixed in the diff | Three readers found by search (`hit-target-floor.test.ts`, `secondary-surfaces.pw.ts`, the record); each repointed and planted (P7, P8) |
| 6 | verification-gap | `contract-anchor.pw.ts`'s retry is exercised only through the harness self-test, never through a real socket hang-up | maybe-false, would be low | The self-test drives the same function with a thrown `socket hang up` (P4, P6); a real transport fault cannot be produced on demand. No change |
| 7 | verification-gap | Every new assertion planted | no defect | P1 to P9 above |
| 8 | ponytail | A new JSON file where a `.ts` module was proposed by DW-40 | false as waste | The tool is run by plain `node`, which loads JSON with no flag; a `.ts` would need type stripping. Same size, works in both loaders. "Lean already. Ship." |
| 9 | ponytail | Wrapper navigators (`goToArmed`, `goToPremise`, `goToDirectory`) | false as waste | Each adds a readiness wait or an init script the harness should not know about, and calls the one guard |
| 10 | verification-loop | Types, tests, build | n/a | `corepack pnpm typecheck` exit 0; root suite and container e2e below; the Hub build ran inside the container's webServer (`Compiled successfully`); lint N/A (no lint command, see AGENTS.md); no secret in the diff |
| 11 | design | No `.scss` or `.tsx` outside tests changed | n/a | No UI surface in this diff. Design review skipped. |

## Independent verifier

pending

## Ledger closures

**DW-22:** **Closed 2026-10-18 by Story 9-12-e2e-harness-consolidation** (`6612c2a`, `tests/e2e/harness.ts`: `goTo`): one navigation guard now lives in the harness and `expectRouteScreenshot` uses it, so the screenshot path and the assertion path cannot drift. The eighteen local copies are gone, every inline `page.goto` plus status check in the contract specs, narrative, front-door and suite-directory routes through it, and the unguarded Hub navigations in `projects-redirect.pw.ts` and `rendered-output.pw.ts` gained it after each target was checked. `rendered-output.pw.ts` plants its refusal.

**DW-232:** **Closed 2026-10-18 by Story 9-12-e2e-harness-consolidation** (`6612c2a`, `tests/e2e/harness.ts`: `goTo`, `plantStyle`, `durationMs`, `EDGE_SLACK`): each lives once in the harness and every spec imports it; no spec declares its own slack figure any more. `ops/__tests__/hit-target-floor.test.ts` reads none of the four, so lifting them out of `hit-target-floor.pw.ts` needed no change there.

**DW-40:** **Closed 2026-10-18 by Story 9-12-e2e-harness-consolidation** (`6612c2a`, `ops/asset-budget-fingerprints.json`, `tests/e2e/harness.ts`: `FINGERPRINTS`): the table moved to a JSON file that `ops/asset-budget.mjs` and the harness both load, so the specs no longer parse the tool as text and a reformatted table cannot fail them with a parse message. `ops/__tests__/asset-budget.test.ts` still pins the seven rows; the harness refuses an empty table, a malformed row or an empty mark at collection.

**DW-49:** **Closed 2026-10-18 by Story 9-12-e2e-harness-consolidation** (`6612c2a`, `tests/e2e/harness.ts`: `FINGERPRINTS`): all three text parses (`narrative.pw.ts`, `front-door.pw.ts`, `work-hero.pw.ts`) are deleted and each imports the harness's table, closed with DW-40.

**DW-237:** **Closed 2026-10-18 by Story 9-12-e2e-harness-consolidation** (`6612c2a`, `tests/e2e/premise.pw.ts`: `outsideViewport`): the sweep reads `.premise` and `.site-footer` and their descendants only, so an overflow elsewhere on `/` no longer turns the premise suite red; the route-wide claim stays `hit-target-floor.pw.ts`'s. A scope that matches nothing throws, planted.

**DW-221:** **Closed 2026-10-18 by Story 9-12-e2e-harness-consolidation** (`6612c2a`, `tests/e2e/harness.ts` header): the docstring no longer lists importing stories; it names the helpers and states that every `.pw.ts` under `tests/e2e` imports the file.

**DW-105:** **Closed 2026-10-18 by Story 9-12-e2e-harness-consolidation** (`6612c2a`, `tests/e2e/front-door.pw.ts`: `onPath` docblock, `tests/e2e/visitor-instrumentation.pw.ts`: `reach`): both stale line citations are replaced by symbol citations (`withMotion`, `atAWiderWidth`, and the front-door case by title), which do not drift with an edit.

**DW-61:** **Closed 2026-10-18 by Story 9-12-e2e-harness-consolidation** (`6612c2a`, `tests/e2e/projects-redirect.pw.ts`: `SWEPT`): `SURFACES` moved to `tests/e2e/harness.ts` and `SWEPT` maps it, so a surface `hit-target-floor.pw.ts`'s walk of `app/` forces into `SURFACES` is swept for NFR-9 too; planted with a fifth row the sweep visited. `type-swap.pw.ts`'s hand copy is derived the same way.

**DW-224:** **Closed 2026-10-18 by Story 9-12-e2e-harness-consolidation** (`6612c2a`, `tests/e2e/harness.ts`: `getWithRetry`): both re-fetches in `contract-anchor.pw.ts` (the stylesheets and the faces) go through a request that is retried up to three times when it throws and never when it answers, so a socket hang-up no longer takes the blocking gate red while a real 404 still fails. No `test.retry` or `retries` change; planted both ways.

**Action items:**
- `epic-2-retro-item-9-move-the-duplicated-e2e-helpers-into-tes`: done 2026-10-18 by Story 9-12 (`6612c2a`): `probeComputed`, `goTo`, `plantStyle` and the `FINGERPRINTS` table live once in `tests/e2e/harness.ts`; DW-22, DW-232 and DW-49 closed.

## Verification

**Commands** (observed 2026-10-18 on this host, the tree at `6612c2a` unless noted):
- `corepack pnpm typecheck`: exit 0 (again at `46f85d7`).
- `corepack pnpm test -- --run`: `Test Files 4 failed | 80 passed (84)`, `Tests 4 failed | 2000 passed | 4 skipped (2008)`; all four failures in WSL-bash suites (demo-reset, library-backup, tournament-backup, tracker-backup), each message naming the DW-135 stall. Re-run of those files plus postgres-backup (which stalled in an earlier full run): `Test Files 5 passed (5)`, `Tests 142 passed | 1 skipped (143)`. At `46f85d7`: `hit-target-floor`, `ops-record-titles`, `hub-accessibility-pass` 47 of 47.
- Container, the AGENTS.md command with `-v epic-scratch-9-12-e2e-harness-consolidation-nm:/w/node_modules -v epic-scratch-9-12-e2e-harness-consolidation-next:/w/apps/hub/.next` mounting this worktree: `Running 348 tests using 1 worker`, `348 passed (11.0m)`, exit 0; `git status` clean afterwards, no snapshot written.
- No `apps/*` file changed, so no per-application suite was due.
