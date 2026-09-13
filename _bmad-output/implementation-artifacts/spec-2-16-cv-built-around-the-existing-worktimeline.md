---
title: 'Story 2.16: `/cv` built around the existing `WorkTimeline`'
type: 'feature'
created: '2026-09-10'
status: 'done'
baseline_commit: 'cfd5f51057192c9a5e684ef630482947def0b598'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** `/cv` is the header's second destination (Story 2-15) and it is not a page: `next.config.js:75-79`
answers it with a 308 to `/pdf/cv.pdf`, which shadows the one-line stub at `app/cv/page.tsx` so the stub has
never rendered. Clicking `CV` starts a download (`chrome-nav.pw.ts:717-780` measures exactly that), the
`aria-current` mark Story 2-15 built has no reachable instance, and DW-64 is open because `next/link`
prefetches a redirect on both chrome surfaces.

**Approach:** Remove the redirect and build the page behind it, reusing `WorkTimeline` exactly as `/work`
mounts it. Above the timeline sits a small intro block using components that already ship. `/work` keeps
rendering standalone. Everything that follows is bookkeeping: `/cv` stops being a redirect in four route
inventories, becomes a swept surface in the hit-target ledger, and gains the accordion assertions nothing in
the repository makes today.

## Boundaries & Constraints

**Always:**

- **`WorkTimeline` is mounted, not touched.** `app/work/page.tsx:21` and `/cv` mount the identical
  component with no props. Story 2-33 restyles it and its AC at `epics.md:3678-3682` says it must not
  alter this story's structure, props or behaviour, so a prop added here is work 2-33 is forbidden to undo.
- **One `WorkTimeline` per document.** `WorkItem.tsx:69,86` builds the panel id as `${entry.id}-content`,
  so a second mount in one document duplicates all four ids and breaks `aria-controls` on both.
- **The PDF affordance survives the redirect's removal.** `cuatro.dev/cv` serves `/pdf/cv.pdf` today and
  people hold that URL. The page links it; the file at `public/pdf/cv.pdf` is not moved or renamed.
- **No number is typed.** `Premise.tsx:96` is the pattern: counts come from `applications.length` or
  `work.length` through `lib/words`, so nothing on the page can go stale. A claim that cannot be derived
  from `content/work.ts` or the Registry is not written.
- **A new stylesheet that names a contract role goes in `TOKEN_NATIVE_STYLESHEETS`**
  (`anchor-contract.test.ts:240-256`), or `:806` fails naming the file, and a listed file naming no role
  fails too. `MINIMUM_SCANNED_FILES` (`:131`) and `MINIMUM_SCSS_FILES` (`:134`) are floors, so adding files
  clears them untouched.
- **`SURFACES` and `EXEMPTIONS` are parsed as text.** `ops/__tests__/hit-target-floor.test.ts:234` matches
  each surface line with a fixed field-order regex, and `:175,182-188` requires two-space indent plus a
  trailing comma on ledger objects. A reflow fails as a parse error, not as a count.
- **Every new predicate is watched failing on a control planted through the browser**, touching no file
  (`chrome-nav.pw.ts:25-27,319-329`, `premise.pw.ts:459-474`). A new spec file takes **no screenshot**:
  `rendered-output.pw.ts:216-223` permits exactly one committed baseline.
- **Re-measure rather than re-derive.** Record what the sweep prints in a dated paragraph in
  `ops/hit-target-floor.md` and leave every historical paragraph verbatim (`:571-573` forbids deletion).

**Ask First:**

- Any change to `content/work.ts`. Its `tech` arrays carry four casing defects (DW-19) and its contrast and
  overflow costs are DW-10 and KV-5, all owned by other stories. This story renders that data, it does not
  edit it.
- Adding `/cv` to `.lighthouserc.js`. Ruled out on 2026-09-10: the gate runs only on push to `main`, so it
  would first fire at the epic merge with nothing measured behind it, which is the risk the file's own
  comment at `:5-8` declined. File it as deferred work instead.
- Touching the `/recommendation` redirect, or linking `/recommendation` from `/cv`. Story 2-17 decides
  whether that route is linked at all, and its AC forbids linking an unattributed placeholder.
- A `body#cv` ground rule. `/cv` deliberately falls through to the base `body` rule: the grid-line gradient
  ground on `body#work` is on the restyle's retire list (`epic-2-context.md` § UX).
- `MINIMUM_SCANNED_FILES` or `MINIMUM_SCSS_FILES` needing to move, or any `SURFACES` row other than a new
  `/cv` one changing.

**Never:**

- **Do not do Story 2-31's or 2-33's work.** No restyle of `WorkItem`, `WorkTimeline` or `WorkHero`, no
  new tokens, no touching `WorkItem.scss` or `WorkTimeline.scss`. The intro block reuses `PlateMark`
  because it already ships, not as a step in the redesign.
- Do not put `WorkHero` on `/cv`. It carries the `<h1>` and a WebGL canvas, and both routes would then
  claim the same heading.
- Do not render an Education or a Contact section, empty, stubbed or commented out.
- Do not remove `/work` from disk, from `SURFACES`, or from `.lighthouserc.js`, and do not add it to the
  header.
- Do not add a filled control, a CTA button or an accent fill (`DESIGN.md:678-680`), a skeleton, or a
  second committed screenshot baseline.
- Do not touch `SiteFooter`, whose emptiness is asserted three ways until Story 2-17.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| The route | `GET /cv` | 200, `text/html`, no `Location` header | It is 308 to `/pdf/cv.pdf` today; `projects-redirect.pw.ts:80` and `:173-176` both pin that and must move |
| The click | `CV` clicked from `/work` | Lands on `/cv`, starts no download | `chrome-nav.pw.ts:717-780` asserts the opposite today and is rewritten, not deleted: the control is now that no click downloads |
| The current mark | pathname is `/cv` | The `CV` link carries `aria-current='page'` and the accent underline; `Suite` carries neither | The first live instance in the repository. `chrome-nav.pw.ts:319-329` plants it today; the plant is replaced by the real surface, and the read is still controlled |
| Headings | `/cv` and `/work` | Exactly one `<h1>` each, then `<h2>` per company, no level skipped | `WorkItem.tsx:72` owns the `<h2>`, so no heading between `<h1>` and it may be an `<h3>` |
| First panel, server output | `renderToStaticMarkup` of the page | The open entry's panel carries no `height: 0` | `WorkItem.tsx:89` writes it unconditionally today, so the entry is collapsed until hydration: the flash the AC forbids |
| Reduced motion | `useReduceMotion` returns `true`, entry toggled | `gsap.to` is called with `duration: 0` on both the open and the close branch | Never read in render output (`useReduceMotion.ts:22-30`), so it is asserted through the tween's arguments, not through markup |
| `aria-controls` | Any entry | Every trigger's `aria-controls` resolves to a panel `id` present in the document | Nothing asserts this anywhere today; a typo in either half is invisible |
| The floor | Each interactive element on `/cv` at 360x800 | At least `--tap` on both axes, read off `:root` in the running page | The intro block's two links are new targets. `PlateMark` is not interactive (`PlateMark.tsx:24-26`) and adds none |
| Base ground | `/cv` renders | `body#cv` matches no override, so the base `body` rule paints | Three records claim the 404 is the only such surface and all three must be amended, not silently falsified |
| NFR-2 | `/`, `/work`, `/celeste`, `/recommendation`, `/api/health`, 404 | Each answers exactly as it did at `cfd5f51` | Only `/cv` changes status |

</frozen-after-approval>

## Code Map

**The route and the redirect**

- `next.config.js:75-79`: the `{ source: '/cv', destination: '/pdf/cv.pdf', permanent: true }` row. Deleting
  it is the story's hinge. The docblock at `:40-47` names `/cv` as one of the two `permanent: true` rows and
  goes stale with it.
- `app/cv/page.tsx`: the stub. `:4` exports the full string `'CV | Luigi Espinosa - Frontend Developer'`
  while `app/layout.tsx:15-18` applies a `'%s | Luigi Espinosa'` template, so the first render this page
  ever gets would read `... - Frontend Developer | Luigi Espinosa`. `app/work/page.tsx:6-15` is the
  metadata shape to copy, including the relative `openGraph.url` and its comment.
- `app/work/page.tsx:17-24`: the composition to mirror. `Container` (`Container.tsx:18-20`) is a plain
  `<section class='container'>`; `Body` (`:12-16`) derives `<body id>` from the pathname, giving `body#cv`.

**What is reused unchanged**

- `components/organisms/WorkTimeline/WorkTimeLine.tsx:13-49`: note the filename's capital `L`. Client
  component, no props, `useState(work[0]?.id)` is what opens the first entry.
- `components/atoms/WorkItem/WorkItem.tsx`: `:68-69` `aria-expanded` and `aria-controls`, `:86` the panel
  id, `:89` the unconditional `height: 0` that causes the flash, `:36,42,52` the reduced-motion duration
  branch. **`:89` is the one line this story changes here**, and it is `WorkItem`, not `WorkTimeline`.
- `components/molecules/PlateMark/PlateMark.tsx:49-63`: `label` plus optional `domain`, non-interactive by
  its own docblock, already in `TOKEN_NATIVE_STYLESHEETS`.
- `components/organisms/Premise/Premise.tsx:91-110`: the golden example for the intro block. Server
  component, `PlateMark` then a lede, every number derived, no heading of its own.
- `lib/registry.ts:107` `renderedApplications` (six), `lib/words.ts` `capitalise`/`pluralise`/`spellOut`.
- `hooks/useReduceMotion.ts:31-49`: correct on the client's first render; `:22-30` forbids branching render
  output on it.

**Route inventories that classify `/cv` as a redirect**

- `tests/e2e/anchor-aliases.pw.ts:990-993`: the redirect set, `['/cv', '/recommendation']`, becomes one
  entry. `:960-965` and `:908-913` prose both assert `/cv` never renders.
- `tests/e2e/projects-redirect.pw.ts:80` (`UNTOUCHED`, 308 to 200) and `:173-176`, where `/cv` is the
  **control that makes the 301 assertion discriminate**. It needs a surviving 308, which is
  `/recommendation`. `:72-73` prose follows.
- `tests/e2e/narrative.pw.ts:79`: `/cv` moves from `REQUESTED_ROUTES` to `NAVIGABLE_ROUTES` (`:78`), whose
  loop at `:1186-1196` asserts 200 plus rendered text. Docblock `:68-71` follows.
- `tests/e2e/hit-target-floor.pw.ts:123` `NON_HUB_ROUTES`, and `:1632` `'the two PDF redirects have
  changed'` expecting `2`, which becomes 1.

**The hit-target ledger, three places in lockstep**

- `tests/e2e/hit-target-floor.pw.ts:108-113` `SURFACES`: a `/cv` row is added and measured. `:1034` requires
  `/celeste` to be the only zero-measured surface. `:838-858` requires every `EXEMPTIONS` route to be a
  surface, so if `chrome-logo` (`:228-235`, `covers: 2`) now also matches on `/cv`, its `covers` becomes 3
  and the drift check at `:782-789` enforces it. `:872-878` keeps `pinnedMeasured` at or above the ledger sum.
- `ops/hit-target-floor.md:96-103` the surfaces table and the `28 elements` total, `:166-171` "three routes
  render no Hub markup", `:201-206` the ledger table, `:614-616` the run-record rows, `:618-635` the rule
  that these move together.
  **Corrected 2026-09-10 during implementation: a new spec file makes sixteen, not eleven.** `tests/e2e`
  holds fifteen `*.pw.ts` files at `cfd5f51`, counted on disk. The `eleven` in this line came from the
  run-record row it points at, which is a dated 2026-09-06 reading taken when the suite held ten, and the
  suite has grown by five files since without that table being re-run. The row written for this story says
  sixteen, which is what the run printed. The rule at `:637-639` is what makes the two consistent: a
  re-measurement is a new dated row beside the old one rather than an edit to it.
- `ops/known-violations.md:65,287,311,322-329`: the KV-4 census, which counts controls per surface.

**Chrome, which gains a third header surface**

- `tests/e2e/chrome-nav.pw.ts:48-51` `CHROME_SURFACES`: `/cv` is a third one, but **`:301-354` asserts no
  destination is marked current** and `/cv` marks one, so that case must keep its two-surface list while the
  new live-instance assertion goes to the `/cv` spec. `:62-63` `CV_PDF` and `:717-780` die with the
  redirect. `:35-41` docblock predicted this story and is corrected.
- `components/atoms/Navbar/Navbar.tsx:19-23` and `__tests__/Navbar.test.tsx:52-58`: the assertions still
  pass; the rationale text citing the 308 is stale.

**Records and the ledger**

- `README.md:93` § Routing, `:104-107`; `ops/asset-budget.md:144,213,314-317,421-422,441-442` (regenerated
  by `ops/asset-budget.mjs`, not hand-edited); `ops/rendered-output-harness.md:49`;
  `ops/anchor-token-adoption.md:283-286,306,607-626` and `tests/e2e/contract-anchor.pw.ts:1098-1118`, both
  of which claim the 404 is the only surface where the base `body` rule paints.
- `deferred-work.md`: DW-64 closes on its own stated trigger; DW-69's collision becomes reachable; DW-6 is
  re-scoped now that `/cv` gains tests; DW-34, DW-35 and DW-10 follow the components onto a second route.

**Test conventions**

- A new `tests/e2e/*.pw.ts` is picked up with no config (`playwright.config.ts:33-34`); one chromium
  project at 360x800 with `reducedMotion: 'reduce'` (`:67-82`).
- Page-level unit test style, including exact-list assertions and a custom message on every non-obvious
  `expect`: `app/__tests__/page.test.tsx:57-126`. `Container.test.tsx` is the `renderToStaticMarkup`
  precedent for asserting server output.
- `components/organisms/WorkTimeline/__tests__/WorkTimeline.test.tsx:26` hard-mocks `useReduceMotion` to
  `false` and mocks gsap wholesale, which is why the duration branch has never been exercised.

## Tasks & Acceptance

**Execution:**

- [x] `next.config.js`: delete the `/cv` row and correct the docblock at `:40-47` so it describes one
      permanent redirect, not two.
- [x] `components/organisms/CvIntro/CvIntro.tsx` and `CvIntro.scss`: **new.** A server component on
      `Premise`'s shape: `<PlateMark label='Curriculum Vitae' domain='cuatro.dev/cv' />`, then
      `<h1>Luigi Espinosa</h1>`, then one lede whose only number is derived, carrying an in-prose link to
      `/#suite`, then a `Download PDF` link to `/pdf/cv.pdf`. Both links built to `--tap` on both axes with
      `inline-flex` and `padding-inline`, underline on an inner span, per `RESTYLE-SPEC.md:188-206`.
- [x] `app/cv/page.tsx`: mount `Container`, `CvIntro` and `WorkTimeline`; fix the title so the layout
      template is applied once; add the relative `openGraph.url`. Wrap the content in `<main>` and say in a
      comment why (a sticky 140px header, no skip link on this surface).
- [x] `components/atoms/WorkItem/WorkItem.tsx:89`: render the panel's collapsed inline style only when the
      entry is closed, so the open entry is not collapsed in server output. `isOpen` is deterministic on
      both sides, so this adds no hydration branch. Comment why the mount-time `gsap.set` at `:27-33` is
      not enough on its own.
- [x] `app/__tests__/anchor-contract.test.ts`: add `CvIntro.scss` to `TOKEN_NATIVE_STYLESHEETS`, keeping the
      list's ordering convention and its comment style.
- [x] `components/atoms/WorkItem/__tests__/WorkItem.test.tsx`: **new.** `aria-controls` resolving to a real
      panel id, and the reduced-motion branch asserted through `gsap.to`'s arguments on both open and close,
      each watched failing against a planted counterpart.
- [x] `app/cv/__tests__/page.test.tsx`: **new.** One `<h1>`, no `<h3>`, no Education or Contact text, the
      timeline present once, and the open panel carrying no `height: 0` in `renderToStaticMarkup` output.
- [x] `tests/e2e/cv.pw.ts`: **new, no screenshot.** `/cv` answers 200 as a document; `CV` clicked from
      `/work` lands there and starts no download; `aria-current` and the accent underline on the real
      surface; the accordion's first entry open with its panel taller than zero; every interactive element
      at or above `--tap`; `/work` still renders the same timeline. Each predicate watched failing on a
      browser-planted control.
- [x] `tests/e2e/hit-target-floor.pw.ts` and `ops/hit-target-floor.md`: move `/cv` out of `NON_HUB_ROUTES`
      into `SURFACES` with the figures the run prints, fix the `/pdf/` count at `:1632`, follow
      `chrome-logo`'s `covers` if it now matches on `/cv`, and add a dated re-measurement paragraph without
      editing a historical one.
- [x] `tests/e2e/anchor-aliases.pw.ts`, `projects-redirect.pw.ts`, `narrative.pw.ts`: reclassify `/cv` in
      each inventory, and repoint the 301 control at `/recommendation` so it still discriminates.
- [x] `tests/e2e/chrome-nav.pw.ts`: retire `CV_PDF` and rewrite `:717-780` as a click that lands on `/cv`
      and downloads nothing; correct the `:35-41` docblock now that the live instance exists. Leave
      `CHROME_SURFACES` at two entries and say why in its comment: every loop over it assumes the surface is
      not a destination, which `/cv` is.
- [x] `tests/e2e/contract-anchor.pw.ts` and `ops/anchor-token-adoption.md`: amend the "only the 404" claim
      about the base `body` rule, which `/cv` now falsifies.
- [x] `README.md`, `ops/rendered-output-harness.md`, `ops/known-violations.md`, `ops/asset-budget.md`
      (regenerated): bring the routing table, the capability row, the KV-4 census and the budget rows in
      line, keeping every literal the ops tests pin byte-identical.
- [x] `components/atoms/Navbar/Navbar.tsx` and its test: correct the comments that describe `/cv` as a 308.
- [x] `deferred-work.md`: close DW-64 on its stated trigger, re-scope DW-6, note DW-69 as reachable, file
      Lighthouse coverage for `/cv` and anything the run surfaces.

**Acceptance Criteria:**

- Given `corepack pnpm test --run`, `corepack pnpm typecheck` and `corepack pnpm build`, when they run, then
  all three pass and no floor in `anchor-contract.test.ts` moved.
- Given `corepack pnpm test:e2e` inside `mcr.microsoft.com/playwright:v1.62.1-noble`, when it runs, then it
  passes, and every control in `tests/e2e/cv.pw.ts` and in the new unit file has been observed failing its
  clean counterpart's measurement on the same build.
- Given the sweep's own output, when the ledger is read, then `/cv` is a measured surface, the totals in
  `ops/hit-target-floor.md` equal what the run printed, and no exemption row was added.
- Given `/`, `/work`, `/celeste`, `/recommendation`, `/api/health` and the 404, when each is requested, then
  each answers exactly as it did at `cfd5f51`, and `/cv` answers 200 rather than 308.
- Given `git status --porcelain -- tests/e2e/*-snapshots`, when it is read after a full run, then it is
  empty and no second baseline directory exists.

## Design Notes

**Why there is no `Experience` heading.** `WorkItem.tsx:72` renders each company as an `<h2>` and
`WorkTimeline` is reused unchanged, so a section label above the list could only be another `<h2>`. That
satisfies A-7, which forbids skipped levels and not repeated ones, but it tells a screen reader the four
companies are peer sections to the word `Experience` rather than inside it. On a CV the companies are the
sections, so the label is dropped rather than the outline bent. Decided 2026-09-10; the alternative was
offered and declined.

**Why `/cv` gets a `<main>` and `/work` does not.** Story 2-15 made the header sticky at 140px, and `/cv`
has no skip link, so without a landmark there is no way past the chrome for assistive tech. Adding one here
is one element on a page being written from scratch. Doing the same to `/work`, `/celeste` and the 404 is a
chrome change and belongs to Story 2-32, so it is filed rather than done.

**The flash is in the server output, not in the effect.** `WorkItem.tsx:20-33` already skips the animation
on first render and sets `height: 'auto'` for the open entry, and the comment there claims there is no
flash. That is true only after hydration: `:89` writes `height: 0` into the markup unconditionally, so a
statically rendered page shows the first entry collapsed until JavaScript runs. The fix is at the point the
style is written, and it is asserted on server output rather than in a browser, because a browser fast
enough to hydrate before the first paint would hide the defect.

**Expected arithmetic, to check the run against rather than to write down.** `/work` measures 7: the logo,
two nav links and four accordion triggers. `/cv` carries the same seven plus the intro block's two links,
so 9 found and 9 measured, taking the four-surface total of 28 to 37 across five. If the run disagrees with
any figure written into the record, the run is right and the record follows it.

## Verification

**Commands:**

- `corepack pnpm test --run`: passes. This is the fast job that catches a half-done count edit, the
  `SURFACES` and KV-4 literal cross-checks being vitest rather than Playwright.
- `corepack pnpm typecheck`: passes. AD-21 makes it blocking.
- `corepack pnpm build`: passes, and `/cv` appears in the route list as a static page rather than a
  redirect.
- `corepack pnpm test:e2e` inside `mcr.microsoft.com/playwright:v1.62.1-noble`: passes. No baseline is
  regenerated, because no new screenshot is taken and `/cv` is not the snapshot route.
- `curl -sS -o NUL -w "%{http_code} %{redirect_url}\n" http://localhost:3000/cv` against `pnpm start`:
  `200` with no redirect URL.

**Manual checks:**

- Load `/cv` at 360x800 with JavaScript disabled and confirm the first entry's detail is visible, which is
  the flash assertion seen rather than measured.
- Tab through `/cv` and confirm the `CV` nav link is marked current, and that both intro links take a focus
  ring that appears instantly and is not the hover colour.
- Print-preview `/cv` and note, without fixing, what the collapsed entries do: the accordion's closed panels
  do not open for print, which is a real observation for the deferred-work ledger and not this story's.

## Suggested Review Order

**The route stops being a redirect, which the rest follows from**

- Start here. The row whose deletion turns a shadowed stub into the served document.
  [`next.config.js:49`](../../next.config.js#L49)

- Three components, no props, no state: the whole page.
  [`page.tsx:46`](../../app/cv/page.tsx#L46)

- A landmark this route has and the other three do not, with the reason and the deferral.
  [`page.tsx:41`](../../app/cv/page.tsx#L41)

**The one line in a component this story was told to reuse**

- The style prop React must never diff away, because GSAP owns that box.
  [`WorkItem.tsx:128`](../../components/atoms/WorkItem/WorkItem.tsx#L128)

- A frozen state initializer rather than a ref read during render.
  [`WorkItem.tsx:52`](../../components/atoms/WorkItem/WorkItem.tsx#L52)

- The guard the review found missing: the unfrozen shape, kept in the file as the control.
  [`WorkItem.test.tsx:102`](../../components/atoms/WorkItem/__tests__/WorkItem.test.tsx#L102)

- Both readings fired against that counterpart, so the clean ones are measurements.
  [`WorkItem.test.tsx:254`](../../components/atoms/WorkItem/__tests__/WorkItem.test.tsx#L254)

**The intro block, where every number is read rather than typed**

- Reuse, not redesign: a shipped mark, non-interactive, so it moves no floor count.
  [`CvIntro.tsx:78`](../../components/organisms/CvIntro/CvIntro.tsx#L78)

- The affordance the redirect used to be, and the attribute that makes the label true.
  [`CvIntro.tsx:100`](../../components/organisms/CvIntro/CvIntro.tsx#L100)

- Padding that reaches the floor on a block link and paints a gap inside a sentence.
  [`CvIntro.scss:103`](../../components/organisms/CvIntro/CvIntro.scss#L103)

**The gates that classified `/cv` as a redirect**

- A fifth swept surface at nine elements, the figure the run printed rather than the plan's.
  [`hit-target-floor.pw.ts:116`](../../tests/e2e/hit-target-floor.pw.ts#L116)

- The 301 control repointed at the redirect that survives, so it still discriminates.
  [`projects-redirect.pw.ts:188`](../../tests/e2e/projects-redirect.pw.ts#L188)

- The click that used to arrive as a download, rewritten to land on a page.
  [`chrome-nav.pw.ts:732`](../../tests/e2e/chrome-nav.pw.ts#L732)

**What the run found that the plan did not**

- The defect's own medium, made a standing case instead of a comment recording one reading.
  [`cv.pw.ts:499`](../../tests/e2e/cv.pw.ts#L499)

- A-7 on both routes, which is what the criterion said and one route is not.
  [`cv.pw.ts:432`](../../tests/e2e/cv.pw.ts#L432)

- Uppercase paths lost an answer: the config matcher was case-insensitive, the file route is not.
  [`deferred-work.md:3857`](deferred-work.md#L3857)

**Peripherals**

- Why one reading was replaced rather than kept, in a file whose rule is to keep them.
  [`asset-budget.md:141`](../../ops/asset-budget.md#L141)

- The lead sentence a reader skims, corrected rather than only amended beneath.
  [`hit-target-floor.md:185`](../../ops/hit-target-floor.md#L185)
