---
title: 'Story 2.14: `/projects` redirects permanently to `/#suite`'
type: 'refactor'
created: '2026-09-07'
status: 'done'
baseline_commit: '97bfc6bb0c388d72265d2b81fc8643c23ce61abe'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** `app/projects/page.tsx:36` mounts a second `<SuiteDirectory />`, so the same Registry data
renders on two surfaces and NFR-9 is breached the moment they disagree. That route is also the only
thing keeping `ProjectsHero` alive, and with it the eight elements `ops/known-violations.md:412` books
to this story as the other half of KV-5. `/projects` is live at v2.5.3 and is the direct ancestor of
the Suite Directory, so NFR-2 forbids deleting the URL.

**Approach:** The URL survives as a permanent redirect and the page behind it does not. `next.config.js`
answers `/projects` with a literal 301 to `/#suite`; `app/projects/` and `ProjectsHero` are deleted with
the modules that only they reached; and every pinned count, route list, ledger row and record that named
that surface moves in the same commit, because half of them are parsed as text by a test.

## Boundaries & Constraints

**Always:**

- **A literal 301, via `statusCode: 301`.** Operator ruling of 2026-09-07. Next's `permanent: true`
  emits **308**, which `narrative.pw.ts:68` already records for `/cv` and `/recommendation`, and the
  acceptance criterion says 301. Next forbids `permanent` alongside `statusCode`, so this row
  deliberately differs in shape from the two PDF rows at `next.config.js:40-49`; say so in a comment or
  the next reader will "fix" it.
- **The URL is not deleted, the page is.** Deleting `app/projects/` without the redirect answers 404 and
  breaches NFR-2. The redirect is what keeps every inbound link, bookmark and search result working, and
  it is what satisfies FR-2's "stable in-page anchor **or** route" for free.
- **`/projects` belongs in neither `SURFACES` nor `NON_HUB_ROUTES`** (`hit-target-floor.pw.ts:93-109`).
  Leaving it in either fails: `:802-805` reports it `phantom` once `app/projects/page.tsx` leaves disk,
  and `:1594-1598` rejects a non-Hub route that answers `text/html`. `app/cv/page.tsx` is the precedent
  for a shadowed page file and it does not apply here, because its redirect lands on a PDF.
- **Playwright follows redirects, so a route list that merely keeps `/projects` goes green while
  measuring `/` twice.** `goTo` asserts the final status. Every case that would silently double up is
  deleted rather than left passing under a false title: `status-mark.pw.ts:751-757` and the
  `/projects` entry of `narrative.pw.ts:72`.
- **The counts move in the spec and the record together, in one commit.**
  `ops/__tests__/hit-target-floor.test.ts` parses `SURFACES` (`:232-234`) and `EXEMPTIONS` (`:168-203`)
  out of the spec as text and holds them equal to the tables in `ops/hit-target-floor.md` in both
  directions. Row formatting, field order and trailing commas are part of the contract.
  `ops/__tests__/status-mark-axes.test.ts:164-169` holds case names equal **and in order**.
- **KV-5 stays `**Open**` and `_not retired_`, and both places still read
  `Stories 2-31, 2-33 and 2-14`.** `ops/__tests__/hit-target-floor.test.ts:704-707` and `:719-721` pin
  those literals in the index row and in the entry. This story closes one of three halves; 2-31 and 2-33
  own the 28 on `/work`.
- **Re-measure rather than re-derive.** The sweep prints its own numbers. Record what the run produces in
  a dated paragraph, and leave every dated historical paragraph and probe transcript in
  `ops/hit-target-floor.md` verbatim (`:83-87`, `:106-112`, `:223-226`, `:263-282`, `:359-395`,
  `:490-496`); `:302-304` forbids editing the transcript outright.

**Ask First:**

- Any surface other than `/projects` changing its `SURFACES` row, its `found/skipped/measured`, or its
  `EXEMPTIONS` coverage. Only the `/projects` row and the two `covers` totals should move.
- `MINIMUM_SCANNED_FILES` or `MINIMUM_SCSS_FILES` (`anchor-contract.test.ts:131,134`) needing to move.
  Seven files leave; 72/24 becomes 67/23 and both floors clear untouched.
- Removing any package from `package.json`. Nothing becomes unused: `three-stdlib` still reaches `/work`
  through `WorkHero -> TorusCanvas -> CanvasOrbitControls -> @react-three/drei`, and `gsap` keeps eight
  importers.
- Adding a route, a dependency, a CI job, a Playwright project or a top-level directory.

**Never:**

- **Do not touch `Navbar.tsx:7` or `HomeLayout.tsx:145`.** Operator ruling of 2026-09-07: repointing the
  chrome is Story 2-15's job. Both links keep working through the redirect and both tests stay green.
- **Do not add a replacement URL to `.lighthouserc.js`.** Drop the `/projects` line; `/` and `/work`
  remain, both real pages, and the `>=0.95` accessibility assertion at severity `error` stays exactly as
  written. Adding an unaudited surface to a blocking gate is a different story's risk.
- **Do not delete `HudLabel`, `ScanlineOverlay` or `useGsapContext`.** Each keeps other importers, and
  `HudLabel` is Story 2-31's to retire.
- Do not touch `.premise`, `SuiteDirectory` or anything Story 2-9 through 2-13 shipped. The directory
  takes no props and reads nothing route-dependent (`SuiteDirectory.tsx:129-130`), so `/` needs no edit.
- Do not repair the eight overflowing elements. They cease to exist because the route that rendered them
  does; that is what `ops/known-violations.md:412` books to this story.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| The inbound link | `GET /projects`, redirects not followed | Status is exactly `301`, `Location` is `/#suite` | The story's payload. `maxRedirects: 0` is required, or the assertion reads the landing instead |
| The visitor | A browser opening `/projects` | Lands on `/`, the Directory heading is present and `#suite` resolves | The fragment never reaches the server; it is the browser that scrolls |
| Query and case | `/projects?ref=x`, `/Projects` | The first redirects and keeps nothing it was not given; the second redirects too, `source` being matched case-insensitively | Amended by Operator ruling of 2026-09-07, the original clause predicting a 404. `/projectsX` is the control: the source is anchored and only its case folding is loose |
| One rendering | Every Hub surface, swept | Exactly one surface renders `.suite-directory`, and it is `/` | This is NFR-9. `Premise` and `SiteFooter` render derived counts, not entries, and are out of scope |
| The two PDF routes | `GET /cv`, `GET /recommendation` | Unchanged: 308, landing on a `.pdf` | `anchor-aliases.pw.ts:969-976` pins that set at exactly two and stays as written |
| The floor sweep | `pnpm test:e2e` | Four surfaces swept, none of them `/projects`, and the ledger arithmetic still holds | `covered <= measured` (`hit-target-floor.test.ts:485-489`) and `skipped + measured === found` per row |
| The route walk | `routesOnDisk(app/)` versus the registered set | Equal, with `/projects` in neither | `unregistered` and `phantom` both `[]` (`hit-target-floor.pw.ts:792-805`) |
| Lighthouse | `npx @lhci/cli autorun` | Three runs each over `/` and `/work`, no run against a redirect | Left in place, LHCI audits `/` under the label `/projects` and the record lies |

</frozen-after-approval>

## Code Map

**The redirect**

- `next.config.js:38-51`: `redirects()` already exists and returns two rows using `permanent: true`. The
  new row uses `statusCode: 301` and `destination: '/#suite'`. `output: 'standalone'` at `:5` and the
  `Vary` header at `:30-37` are untouched.
- `playwright.config.ts:84-93`: the harness runs `pnpm build && pnpm start`, a real production server, so
  a config redirect is observable in e2e and invisible to vitest. Port is 3100 (`:19-20`).

**What is deleted**

- `app/projects/page.tsx` and `app/projects/__tests__/page.test.tsx`: the whole route. Its docblock at
  `:19-29` already names this story as its retirer.
- `components/organisms/ProjectsHero/`: `.tsx`, `.scss`, `__tests__/`. Sole importer is the route.
- `components/molecules/TorusKnotCanvas/TorusKnotCanvas.tsx` and
  `components/atoms/TorusKnot/TorusKnot.tsx`: sole importer is `ProjectsHero.tsx:8`, and neither has a
  test. Left on disk they are modules no route can reach, which `ops/asset-budget.mjs:1181-1186` reports
  as `orphanModules`.
- `app/app.scss:112-119`: `body#projects` in the selector list. `Container.tsx:12-16` derives the body id
  from `usePathname()`, so no request can match it again. `body#work` keeps the rule alive.

**Gates parsed as text, which fail loudly**

- `tests/e2e/hit-target-floor.pw.ts:96` the `SURFACES` row; `:210-211` `chrome-logo` (`covers: 3`);
  `:219-220` `chrome-nav` (`covers: 18`). Mirrors at `ops/hit-target-floor.md:100`, `:165`, `:166`.
  One logo link and six nav links per route, so 3 becomes 2 and 18 becomes 12. Measured totals become
  17 + 11 + 0 + 8 = 36, covered 20, and both `hit-target-floor.test.ts:485-495` checks still hold.
- `app/__tests__/anchor-contract.test.ts:215`: `WEIGHT_CALL_SITES` names `ProjectsHero.scss`. `:761-763`
  fails first, with "was not among the scanned files".
- `tests/e2e/anchor-aliases.pw.ts:410` and `:421`, against `:414` `CALL_SITE_COUNT = 12` and `:425`
  `WEIGHT_SITE_COUNT = 4`, asserted at `:535-540` and cross-checked against the on-disk walk at
  `:576-587`. Eleven and three. `BOUNDARY_COUNT` stays 2; ornament drops from ten to nine.
- `tests/e2e/anchor-aliases.pw.ts:943-980`: `/projects` leaves `ROUTES` (`:123`), which becomes six.
  Operator ruling of 2026-09-07: the redirect pin at `:969-976` keeps naming exactly `/cv` and
  `/recommendation`, both landing on a PDF, and does not widen. Left in, `/projects` would land on `/`,
  fail that pin, and duplicate what `projects-redirect.pw.ts` asserts more precisely.
- `ops/__tests__/status-mark-axes.test.ts:144-169`: `ops/status-mark-axes.md:218` is a case-name row that
  must go in the same change as `status-mark.pw.ts:751`, and order is asserted.

**Records that go stale**

- `ops/hit-target-floor.md`: the table row `:100` and the total at `:104` ("54 elements measured across
  five surfaces"); the ledger rows `:165-166`; the "nineteen" example at `:159-160`; the derived
  sentences at `:210-215`, `:219-221`, `:228-230` and `:408-413`. Note `:219-221` and `:228-230` are
  **already** one out against the post-2-13 table (53 and 26 against a table summing to 54); record the
  measured figures and file the pre-existing drift rather than back-dating it.
- `ops/known-violations.md:386,387,393,412`: the KV-5 census cells. Everything except the four pinned
  literals is prose and should say the eight are gone.
- `ops/anchor-token-adoption.md:461,469-478,486-501,518,549-550,649,654`: unparsed prose, but it is the
  record the two e2e counts cite. Twelve becomes eleven, four becomes three, and the redirect row at
  `:654` now has three routes.
- `ops/status-mark-axes.md:234`, `ops/rendered-output-harness.md:355`, `README.md:91`,
  `tests/e2e/suite-directory.pw.ts:33`, `tests/e2e/narrative.pw.ts:565`,
  `app/__tests__/page.test.tsx:16` (a dangling cross-reference to a deleted file),
  `tests/e2e/hit-target-floor.pw.ts:45-47`, `components/atoms/Container/__tests__/Container.test.tsx:8`.

**Idioms**

- No 3xx is asserted anywhere in this repo today. `request.get(url, { maxRedirects: 0 })` plus
  `response.status()` and `response.headers()['location']` is the shape; `narrative.pw.ts:1190-1195` and
  `hit-target-floor.pw.ts:1586-1602` are the follow-the-redirect cases to sit beside, not to copy.
- `hit-target-floor.pw.ts:311-323` `goTo` with a status guard, duplicated per spec by DW-22.

## Tasks & Acceptance

**Execution:**

- [x] `next.config.js`: add the `/projects -> /#suite` row with `statusCode: 301`, and a comment stating
      why it is not `permanent: true`.
- [x] Delete `app/projects/`, `components/organisms/ProjectsHero/`,
      `components/molecules/TorusKnotCanvas/`, `components/atoms/TorusKnot/`, and the `body#projects`
      half of the selector at `app/app.scss:112`.
- [x] `.lighthouserc.js`: drop the `/projects` collect URL, leaving the accessibility assertion
      unweakened.
- [x] `tests/e2e/hit-target-floor.pw.ts` and `ops/hit-target-floor.md`: delete the `/projects` surface
      row, drop the route from both exemption rows, move `covers` to 2 and 12, and update every derived
      sentence to the figures the run prints. Add a dated re-measurement paragraph; edit no historical
      one.
- [x] `app/__tests__/anchor-contract.test.ts` and `tests/e2e/anchor-aliases.pw.ts`: remove the three
      `ProjectsHero` entries, move `CALL_SITE_COUNT` to 11 and `WEIGHT_SITE_COUNT` to 3, and drop
      `/projects` from `ROUTES`, leaving the redirect pin exactly as written.
- [x] `tests/e2e/status-mark.pw.ts` and `ops/status-mark-axes.md`: delete the `/projects` case, retire
      `ROUTES`, rewrite the docblock that justified two routes, and delete the matching record row.
- [x] `tests/e2e/narrative.pw.ts`: drop `/projects` from `NAVIGABLE_ROUTES` and correct the chunk comment
      at `:565`.
- [x] `tests/e2e/projects-redirect.pw.ts`: **new.** Every browser row of the matrix, each with a control
      watched failing: the 301 and its `Location`, the fragment, query and case, the landing, and the
      single rendering of `.suite-directory` across the swept surfaces.
- [x] `ops/known-violations.md`, `ops/anchor-token-adoption.md`, `ops/rendered-output-harness.md`,
      `README.md`, `tests/e2e/suite-directory.pw.ts:33`, `app/__tests__/page.test.tsx:16`,
      `tests/e2e/hit-target-floor.pw.ts:45-47`, `Container.test.tsx:8`: bring the prose in line, keeping
      KV-5's four pinned literals byte-identical.
- [x] `ops/__tests__/hit-target-floor.test.ts`: assert `.lighthouserc.js` collects no URL that
      `next.config.js` redirects, which is the half of the Lighthouse matrix row nothing covered.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md`: file the pre-existing 53/54 and 26/27
      drift in `ops/hit-target-floor.md`, the chrome links still pointing at a redirect until Story 2-15,
      and anything the run surfaces.

**Acceptance Criteria:**

- Given `corepack pnpm test --run`, `corepack pnpm typecheck` and `corepack pnpm build`, when they run,
  then all three pass, and no floor in `anchor-contract.test.ts` moved.
- Given `corepack pnpm test:e2e` inside `mcr.microsoft.com/playwright:v1.62.1-noble`, when it runs, then
  it passes, and every control case in `tests/e2e/projects-redirect.pw.ts` has been observed failing its
  clean counterpart's measurement on the same build.
- Given `/`, `/work`, `/celeste`, `/cv`, `/recommendation`, `/api/health` and the 404, when each is
  requested, then each answers exactly as it did at `97bfc6b`, which is NFR-2.
- Given `git grep -n ProjectsHero -- . ':!_bmad-output' ':!CHANGELOG.md'`, when it is read, then every
  surviving hit is a dated historical record, not a live reference.
- Given `git status --porcelain -- tests/e2e/*-snapshots`, when it is read after a full run, then it is
  empty.

## Spec Change Log

**2026-09-07, during step 3. The matrix predicted a 404 for `/Projects` and the runtime answers 301.**
The frozen row asserted that `next.config.js` matches `source` case-sensitively, which it does not: Next
compiles a redirect source with case sensitivity off and exposes no option to change it. Before this
story `/Projects` reached `app/not-found.tsx`, the App Router's own file matching being case-sensitive,
so this is a real behaviour change on a path NFR-2's list does not name, in the forgiving direction.

Amended, by Operator ruling, to state the observed behaviour rather than the assumed one. The
alternative, a `middleware.ts` running on every request to restore a 404 nobody asked for, was declined:
it is a new top-level file this spec's Ask First list gates, and it buys nothing. The implementation had
already pinned the observed behaviour with a control, and filed DW-56.

**KEEP:** the `/projectsX` control. Without it the case reads as a claim that the redirect swallows
anything beginning with the source, and the finding would be about prefixes rather than about case.

**2026-09-07, during step 3. The Lighthouse matrix row was half uncovered.** `hit-target-floor.test.ts`
already pinned the `>=0.95` assertion, so the "unweakened" half was held, but nothing asserted that the
collect list names no redirected route, which is the half that makes the report honest. A case was added
rather than the row softened. Its first draft read every `source:` in `next.config.js`, counted the
`headers()` source, and reported `/` as redirected: the scoping to the `redirects()` block was found by
watching that failure rather than argued. The clean version was then watched failing with the
`/projects` URL planted back into `.lighthouserc.js`.

## Verification

**Commands:**

- `corepack pnpm test --run`: passes. This is the fast job that catches a half-done count edit, because
  the `SURFACES`, `EXEMPTIONS` and status-mark case cross-checks are vitest, not Playwright.
- `corepack pnpm typecheck`: passes. AD-21 makes it blocking.
- `corepack pnpm build`: passes, and is what proves nothing still imports a deleted module.
- `corepack pnpm test:e2e`: run inside the pinned image only; DW-23 records the container invocation.

**Manual checks:**

- `curl -sI http://localhost:3100/projects` against the started build: read the status line and the
  `Location` header directly, rather than trusting a client that follows redirects.
- Open `/projects` in a browser and confirm it lands on the Directory rather than the top of the page.

## Suggested Review Order

**The redirect, which everything else follows**

- Start here. Three lines, and the whole story's payload.
  [`next.config.js:66`](../../next.config.js#L66)

- Why this row differs in shape from the two below it, and what a 301 costs.
  [`next.config.js:40`](../../next.config.js#L40)

- The status read without following, controlled against `/cv`'s 308 on the same build.
  [`projects-redirect.pw.ts:153`](../../tests/e2e/projects-redirect.pw.ts#L153)

**What the run found that the plan did not**

- The matrix predicted a 404 here. Next folds case, and the Operator ratified it.
  [`projects-redirect.pw.ts:263`](../../tests/e2e/projects-redirect.pw.ts#L263)

- The journey most visitors take, and the one path the fragment does not survive.
  [`projects-redirect.pw.ts:373`](../../tests/e2e/projects-redirect.pw.ts#L373)

- Two hops, walked one at a time rather than assumed from the first.
  [`projects-redirect.pw.ts:115`](../../tests/e2e/projects-redirect.pw.ts#L115)

**NFR-9, the defect the redirect exists to remove**

- The predicate named once, so the control can exercise it rather than resemble it.
  [`projects-redirect.pw.ts:145`](../../tests/e2e/projects-redirect.pw.ts#L145)

- The planted reading fed back through that same function: 1 becomes 2.
  [`projects-redirect.pw.ts:332`](../../tests/e2e/projects-redirect.pw.ts#L332)

- NFR-2 as this story's own claim, with the loop's comparison watched producing drift.
  [`projects-redirect.pw.ts:363`](../../tests/e2e/projects-redirect.pw.ts#L363)

**The counts, which are parsed as text and fail loudly**

- The route belongs in neither list, and the docblock says why each rejects it.
  [`hit-target-floor.pw.ts:94`](../../tests/e2e/hit-target-floor.pw.ts#L94)

- One logo and six nav links per route, so the ledger drops by exactly that.
  [`hit-target-floor.pw.ts:219`](../../tests/e2e/hit-target-floor.pw.ts#L219)

- Eleven and three, both compared against the tree rather than restated.
  [`anchor-aliases.pw.ts:422`](../../tests/e2e/anchor-aliases.pw.ts#L422)

- Six routes, and the redirect pin left naming exactly the two PDFs.
  [`anchor-aliases.pw.ts:130`](../../tests/e2e/anchor-aliases.pw.ts#L130)

**The gate nobody was watching**

- A collect URL that redirects makes the report name a surface it never measured.
  [`hit-target-floor.test.ts:655`](../../ops/__tests__/hit-target-floor.test.ts#L655)

- Case and trailing slash folded before comparing, because this story proved both matter.
  [`hit-target-floor.test.ts:703`](../../ops/__tests__/hit-target-floor.test.ts#L703)

- Two real pages left, and the comment saying why no third was added.
  [`.lighthouserc.js:5`](../../.lighthouserc.js#L5)

**Peripherals**

- The dated re-measurement, beside the historical paragraphs rather than over them.
  [`hit-target-floor.md:103`](../../ops/hit-target-floor.md#L103)

- KV-5's other half closes; the entry stays open for the 28 on `/work`.
  [`known-violations.md:412`](../../ops/known-violations.md#L412)

- A selector no request can match again, and the comment recording why.
  [`app.scss:112`](../../app/app.scss#L112)
