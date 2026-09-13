---
title: 'Story 2.15: Nav reshape to two destinations'
type: 'feature'
created: '2026-09-08'
status: 'done'
baseline_commit: '26d9d1bb132155599ee53d1a572f62538256b408'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** `Navbar.tsx:4-21` renders six inline links plus a `mailto:`, which is precisely the AI-nav tell
`EXPERIENCE.md:126` names, and every one of them competes with SM-1's 60% suite-reach target. Two are dead:
`/blog` has no route on disk and `/projects` is a 301 both chrome call sites still prefetch (DW-55, DW-58).
All six measure 22px tall, which is the `chrome-nav` row `ops/hit-target-floor.md` books to this story. The
header is also static, so on `/work` and the 404 it scrolls away carrying the only route back to the payload.

**Approach:** The header carries `Suite` and `CV` and nothing else, sticky at `--z-sticky`, with the current
route marked by `aria-current="page"` and a `--stroke-emphasis` accent underline. Each link is built to
`--tap` on both axes, which is what lets `chrome-nav` be deleted from the ledger in the same commit, and
every count, record and pinned literal that followed the six links moves with them. The homepage panel's
second link is repointed off the redirect at the same time, by the ruling that booked both call sites here.

## Boundaries & Constraints

**Always:**

- **Two destinations, in this order: `Suite` to `/#suite` primary, `CV` to `/cv` secondary.** Labels are
  fixed at `EXPERIENCE.md:285`, placement at `EXPERIENCE.md:115-123`, which is what closing PRD Q8 means.
  `/work` is not in the header. Prominence is an IA fact here, not a visual one: no document gives primary
  and secondary different treatments in the header, so both links take one treatment and the accent
  underline is reserved for the current route.
- **`CV` points at `/cv` even though `/cv` still answers 308 to `/pdf/cv.pdf`** (`next.config.js:75-79`).
  The header names the route the design assigns (`EXPERIENCE.md:95`); Story 2-16 makes it a page. Do not
  point the label at the PDF, and do not touch that redirect: `anchor-aliases.pw.ts:989-996` pins the
  redirect set at exactly `/cv` and `/recommendation`.
- **`--tap` is a token, never a literal** (`DESIGN.md:654-656`). `min-block-size` plus `min-inline-size`
  plus `display: inline-flex` plus `padding-inline`, never `padding-block` on a plain inline element, which
  paints outward without growing the hit area. Three files already carry this shape with that comment:
  `SkipLink.scss:41-47`, `SkipControl.scss:12-20`, `SuiteDirectory.scss:242-256`. `hit-target-floor.test.ts:600-626`
  rejects a bare `44` or `44px` written into the spec file outside a `measured:` cell or a `file.ext:NN` citation.
- **The underline is drawn on an inner span, not on the `--tap` box** (`RESTYLE-SPEC.md:198-199`), or the
  rule floats away from the text by the height of the padding. Weight is `--stroke-emphasis` (2px) in
  `--token-accent`, the same row `DESIGN.md:597` gives the active link underline, which is what "reads
  identically wherever it appears" means concretely.
- **Deleting `chrome-nav` moves four things, and fewer than four is a defect** (`known-violations.md:349-355`):
  the row in `ops/hit-target-floor.md` § The exemption ledger, the `EXEMPTIONS` entry in
  `hit-target-floor.pw.ts`, the "What is in breach" cell at `known-violations.md:301`, and the KV-4 index
  row. Two literals move with it: `hit-target-floor.test.ts:765` and `:781-783` both hold
  `'Stories 2-15, 2-30 and 2-32'`.
- **Two gates name `chrome-nav` and must be repointed at a surviving row rather than deleted.**
  `hit-target-floor.test.ts:385-386` asserts the id is present in both files; the stale-row control at
  `hit-target-floor.pw.ts:1153-1202` plants into `nav.navbar` and asserts the message names `"chrome-nav"`,
  with a `covers 7` literal at `:1201`. The control is the one that proves the ledger can shrink, so it
  keeps a real row rather than becoming synthetic.
- **Row formatting is part of the contract.** `EXEMPTIONS` entries need single-quoted fields, a bracketed
  `routes`, `covers` with a trailing comma and a two-space closing brace; `SURFACES` is one line per surface
  in fixed field order (`hit-target-floor.test.ts:169-249`). The markdown side needs its section heading
  exactly once and equal cell counts per row (`ops/contract-adoption.mjs:85-131`).
- **Re-measure rather than re-derive.** The sweep prints its own numbers; record what the run produces in a
  dated paragraph and leave every dated historical paragraph verbatim (`ops/hit-target-floor.md:123-126`,
  `:212-217`, and `:571-573` which forbids deletion outright).
- **A stylesheet that names a contract role goes in `TOKEN_NATIVE_STYLESHEETS`** (`anchor-contract.test.ts:240-247`)
  or `:805-816` fails naming the file, and a file listed there that names no role fails `:797-803`.
- **Every new predicate is watched failing on a planted control**, injected through the browser so it
  touches no file (`hit-target-floor.pw.ts:54-56`, `ops/rendered-output-harness.md:266`). A new spec file
  takes **no screenshot**: it would create a second snapshot directory, and
  `ops/__tests__/hit-target-floor.test.ts:628-634` rejects it (`hit-target-floor.pw.ts:50-52`).

**Ask First:**

- Anything that makes `Header` render on `/`. Operator ruling of 2026-09-08: it stays `null`
  (`Header.tsx:12`). A-6's first-tabbable claim (`app/page.tsx:61-63`), `page.test.tsx:89` and the dedicated
  case at `celeste-header.pw.ts:166-204` all rest on that absence, and `/` keeps `found: 17`.
- Any surface other than `/work`, `/celeste` and the 404 moving its `found/skipped/measured`, or any
  exemption row other than `chrome-nav` changing.
- Renaming `.nav-link`. `hit-target-floor.pw.ts:124-126` predicts this story renames it; that prediction is
  stale, because `.nav-link` is HomeLayout's class and its row is `closedBy: 'Story 2-32'`. Correct the
  comment, do not do the rename.
- `MINIMUM_SCANNED_FILES` or `MINIMUM_SCSS_FILES` (`anchor-contract.test.ts:131,134`) needing to move. No
  file is added or deleted, so both floors clear untouched.
- Adding a route, a dependency, a CI job, a Playwright project or a top-level directory.

**Never:**

- **Do not do Story 2-32's work.** Sequenced after this one, never inside it (`EXPERIENCE.md:603`,
  `epics.md:3566-3567`). So: header height stays `140px` (`header.scss:2`), `#fff` stays at `navbar.scss:10`,
  the logo stays a raster image, `Container` and `ContactContainer` are untouched, the mono uppercase
  `--t-2xs`/`--tr-label` type treatment is not applied, hover keeps its current behaviour, and the focus-ring
  reference implementation is not authored here. Do not remove or weaken any focus ring either.
- **Do not delete or weaken any exemption row other than `chrome-nav`.** `chrome-logo`, `error-back`,
  `home-nav` and `home-contact` all survive with their current `closedBy`.
- **Do not repair the home panel's link geometry.** Repointing and relabelling `HomeLayout.tsx:145` leaves
  `home-nav` measuring exactly what it measures now; that row is Story 2-32's.
- Do not add a filled control, a CTA button, a `background-color` on any state, or an accent fill anywhere
  (`DESIGN.md:678-680`, `RESTYLE-SPEC.md:138-140`).
- Do not add a scrolled-state treatment: no hide, no shrink, no backdrop change. Unstated everywhere, and
  `EXPERIENCE.md:413-414` says the header does not hide, because that is what costs Marcus the `Suite` link.
- Do not touch `SiteFooter`. Its emptiness is asserted three ways at `SiteFooter.test.tsx:35-46` and footer
  destinations belong to Story 2-17.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| The header | `/work` and the 404 at 360x800 | Exactly two `nav.navbar a`: `Suite` to `/#suite`, `CV` to `/cv`. No `target='_blank'`, no `mailto:` | `Navbar.test.tsx:41-46` requires an external link today and must go: a two-destination header has none |
| The floor | each nav link's `boundingBox()` | At least `--tap` on both axes, read off `:root` in the running page | Measured in the browser, never read off the CSS. This is what deletes the row |
| The current route | pathname is `/cv` | That link carries `aria-current="page"` and the accent underline; the other carries neither | No live instance ships: `/cv` is a 308 until Story 2-16. Assert at the unit level, plus a planted control in the browser |
| Neither current | `/work`, the 404 | No element in the header carries `aria-current` | Today `aria-current` appears nowhere in application code, so this is a new property with no prior assertion |
| Sticky | `/work`, scrolled past the header's height | Header stays at the viewport top; computed `position` is `sticky` and `z-index` equals `--z-sticky` | `html, body { overflow-x: clip }` (`app.scss:93-100`) is what lets sticky work; `hidden` would silently break it |
| The suite click | Click `Suite` from `/work` | Lands on `/`, `hash` is `#suite`, the Directory heading in view | DW-58's expectation flips from `''` to `'#suite'` at `projects-redirect.pw.ts:404-407` |
| The home panel | Click `Suite Directory` from `/` | A same-route fragment navigation that never reaches the redirect | The case at `projects-redirect.pw.ts:373-438` is titled for this story and owns the flip |
| The ledger | `pnpm test:e2e` | No `chrome-nav` row survives, no nav link is reported as a stale row or an unlisted breach, and the arithmetic still holds | `covered <= measured` and `skipped + measured === found` per row |
| The header on `/` | `GET /` | Still zero `<header>` elements, `/` still sweeps 17 found and 17 measured | Unchanged by this story, and `celeste-header.pw.ts:178` is what says so |

</frozen-after-approval>

## Code Map

**The two components**

- `components/atoms/Navbar/Navbar.tsx:4-21`: six `<Link>` children of a bare `<nav className='navbar'>`, no
  list wrapper. Becomes two. It is a **server component**; `aria-current` needs the pathname, so either add
  `'use client'` here or pass it down from `Header.tsx:10`, which already calls `usePathname()`.
- `components/molecules/Header/Header.tsx:9-18`: the client boundary. `path !== '/'` gates the whole header
  and stays exactly as written. `Logo` (`:14`) is a sibling of `Navbar`, not a nav link, so "exactly two
  destinations" is two `nav.navbar a`, while `<header>` still holds three anchors.
- `components/atoms/Navbar/navbar.scss:1-20`: 20 lines, zero comments, zero custom properties. `a` is a
  plain flex item with no `display`, no padding and no `min-height`, which is the whole 22px defect.
  `margin-right: 1rem` at `:17` is the sibling gap; `RESTYLE-SPEC.md:206` wants `var(--s-lg)` between two
  `--tap` boxes. `color: #fff` at `:10` is Story 2-32's to absorb and stays.
- `components/molecules/Header/header.scss:1-8`: `height: 140px`, no `position`, no `z-index`, no ground.
  Sticky needs an opaque token ground, because an alpha or absent one lets content paint through
  (`EXPERIENCE.md:522-523`, and alpha grounds are banned at `DESIGN.md:1281-1283`). The 140px stays.
- `components/organisms/HomeLayout/HomeLayout.tsx:145-147`: the homepage panel's second `.nav-link`.
  Repoint to `/#suite` and relabel `Suite Directory`, by Operator ruling of 2026-09-08. Its sibling at
  `:142` (`/work`, "Professional Experience") does not move.

**Tokens, all of which already ship in Contract v1.0.0**

- `contracts/tokens.css:100` `--tap: 44px`; `:110` `--stroke-emphasis: 2px`; `:34` `--token-accent`;
  `:133` `--z-sticky: 200`; `:87` `--s-lg`. **Nothing new may be minted**: Epic 2 does not move the contract.
- `SkipLink.scss:37-39` already reasons about sitting above "the sticky header the other four surfaces
  carry" at `--z-tooltip` (600). `--z-sticky` (200) stays correctly under it.

**Gates parsed as text, which fail loudly**

- `tests/e2e/hit-target-floor.pw.ts:102-107` `SURFACES` and `ops/hit-target-floor.md:96-101`: three rows
  move. `/work` is 5 + N, `/celeste` is 1 + N found and all skipped, the 404 is 2 + N. `/` does not move.
- `hit-target-floor.pw.ts:223-231` and `ops/hit-target-floor.md:187`: the `chrome-nav` row, deleted. The
  `covers` sum drops from 20 to 8 and the totals at `ops/hit-target-floor.md:103` and `:249-252` follow.
- `hit-target-floor.pw.ts:241-249` `home-nav`: `source` cites `HomeLayout.tsx:64,67`, which is stale by 78
  lines. This story edits the real line, so correct the citation on both sides in the same change.
- `hit-target-floor.pw.ts:1153-1202`: the stale-row control. Plants into `nav.navbar` on `/work` and asserts
  `"chrome-nav"` plus `covers 7`. Repoint at a row that survives.
- `ops/__tests__/hit-target-floor.test.ts:385-386` (id present in both files), `:765` and `:781-783`
  (`'Stories 2-15, 2-30 and 2-32'`), `:549-574` (once `2-15-*` reads `done` on the board no row may name it,
  and a `2-15-` key must stay), `:576-581` (the `source` file must exist on disk).
- `tests/e2e/hit-target-floor.pw.ts:119-128`: the `ENTRANCE_SELECTOR` docblock predicting a `.nav-link`
  rename. Correct the prose.
- `app/__tests__/anchor-contract.test.ts:240-247` `TOKEN_NATIVE_STYLESHEETS`: add `navbar.scss` and
  `header.scss` once they name roles. `anchor-aliases.pw.ts:422,438` do not move, because neither file
  contributes an alias call site.

**Unit tests that break**

- `components/atoms/Navbar/__tests__/Navbar.test.tsx:26-46`: all four cases. `:31-34` and `:36-39` name
  routes that leave; `:41-46` requires a `target='_blank'` link that no longer exists.
- `components/organisms/HomeLayout/__tests__/HomeLayout.test.tsx:104-108`: pins the `/projects` href.
- No test file exists for `Header` or `Logo`, so header mounting and the sticky contract are untested today.

**Records that go stale**

- `ops/known-violations.md:65`, `:287`, `:301-304`, `:310`: the KV-4 census. Thirteen controls become seven,
  the `Blog` link named at `:302` as the one failing on both axes is gone, and `:310` drops this story.
- `ops/hit-target-floor.md:103`, `:159-160`, `:180-182`, `:222-236`, `:249-261`, `:408-413`: totals, the
  per-element table's six nav rows, and the prose about a seventh nav link that no longer has a row to widen.
- `README.md:93` § Routing: DW-60, owned by this story. Four corrections only: the
  `remmendation-letter.pdf` typo and the three omitted routes (`/celeste`, `/api/health`, the 404).

**Idioms**

- The `--tap` box shape, with the comment explaining why `padding-block` does not work:
  `SkipControl.scss:12-20`. Two boxes kept apart by `gap: var(--s-lg)`: `SuiteDirectory.scss:236,242-256`.
- Browser-planted control, touching no file: `hit-target-floor.pw.ts:1052-1084`.
- Reading a computed style in a Playwright case: `suite-directory.pw.ts:285-286`.

## Tasks & Acceptance

**Execution:**

- [x] `components/atoms/Navbar/Navbar.tsx`: render exactly two links, `Suite` to `/#suite` and `CV` to
      `/cv`, marking the current one with `aria-current='page'`. Note in a docblock why `CV` names the route
      and not the PDF, and why the logo is not one of the two.
- [x] `components/atoms/Navbar/navbar.scss`: build the link to `--tap` on both axes with `inline-flex`,
      `min-block-size`, `min-inline-size` and `padding-inline`; carry the comment saying why `padding-block`
      would not work. Replace `margin-right` with `gap: var(--s-lg)` on `.navbar`. Draw the current-route
      underline on an inner span at `--stroke-emphasis` in `--token-accent`. Leave `#fff` at `:10`.
- [x] `components/molecules/Header/header.scss`: `position: sticky`, `top: 0`, `z-index: var(--z-sticky)`
      and an opaque token ground. Leave `height: 140px` and say in a comment that the height is Story 2-32's.
- [x] `components/organisms/HomeLayout/HomeLayout.tsx:145-147`: repoint to `/#suite` and relabel
      `Suite Directory`, which closes DW-55 and DW-58 for this call site.
- [x] `app/__tests__/anchor-contract.test.ts`: add `navbar.scss` and `header.scss` to
      `TOKEN_NATIVE_STYLESHEETS`, keeping the list's ordering convention.
- [x] `components/atoms/Navbar/__tests__/Navbar.test.tsx`: rewrite for the two destinations, their order,
      the absence of any external or `mailto:` link, and `aria-current` present on the current route and
      absent on the other. Drive the pathname rather than mocking the assertion away.
- [x] `components/organisms/HomeLayout/__tests__/HomeLayout.test.tsx:104-108`: follow the repoint.
- [x] `tests/e2e/hit-target-floor.pw.ts` and `ops/hit-target-floor.md`: move the three `SURFACES` rows,
      delete the `chrome-nav` row from both, correct `home-nav`'s stale `source` citation, repoint the
      stale-row control at a surviving row, and fix the `ENTRANCE_SELECTOR` docblock. Update every derived
      sentence to the figures the run prints, and add a dated re-measurement paragraph without editing a
      historical one.
- [x] `ops/__tests__/hit-target-floor.test.ts`: follow `chrome-nav`'s deletion at `:385-386`, `:765` and
      `:781-783`, and confirm the board-versus-ledger check at `:549-574` now passes in the closing direction.
- [x] `tests/e2e/chrome-nav.pw.ts`: **new.** The browser rows of the matrix, each with a control watched
      failing: the two destinations and their order, the floor on both axes, `aria-current` present and
      absent, the computed sticky position and `z-index` against `--z-sticky`, and the `Suite` click landing
      on `/` with `#suite` and the heading in view.
- [x] `tests/e2e/projects-redirect.pw.ts:373-438`: flip the hash expectation from `''` to `'#suite'` for
      both repointed links, which is what the case's own failure message says to do when this story lands.
- [x] `ops/known-violations.md` and `README.md`: bring the KV-4 census and § Routing in line, keeping every
      literal `ops/__tests__/hit-target-floor.test.ts` pins byte-identical.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md`: close DW-55 and DW-58, note DW-60, and file
      the 140px sticky header eating 17.5% of a 360x800 viewport until Story 2-32 makes the height
      content-driven, plus anything the run surfaces.

**Acceptance Criteria:**

- Given `corepack pnpm test --run`, `corepack pnpm typecheck` and `corepack pnpm build`, when they run, then
  all three pass, and no floor in `anchor-contract.test.ts` moved.
- Given `corepack pnpm test:e2e` inside `mcr.microsoft.com/playwright:v1.62.1-noble`, when it runs, then it
  passes, and every control in `tests/e2e/chrome-nav.pw.ts` has been observed failing its clean
  counterpart's measurement on the same build.
- Given the sweep's own output, when the ledger is read, then no row names Story 2-15, every nav link is
  measured rather than exempted, and the four places `known-violations.md:349-355` lists all moved together.
- Given `/`, `/work`, `/celeste`, `/cv`, `/recommendation`, `/api/health` and the 404, when each is
  requested, then each answers exactly as it did at `26d9d1b`, which is NFR-2.
- Given `git grep -n "'/projects'" -- components app`, when it is read, then there is no hit: no chrome call
  site points at the redirect any more.
- Given `git status --porcelain -- tests/e2e/*-snapshots`, when it is read after a full run, then it is
  empty, the `/work` baseline having been regenerated inside the pinned container for the sticky header.

## Design Notes

**Why `aria-current` ships with no live instance.** `Suite` is current only on `/`, where `Header.tsx:12`
renders nothing, and `CV` is current only on `/cv`, which is a 308 to a PDF until Story 2-16. Both are
deliberate and were ruled on 2026-09-08. The mechanism is therefore asserted two ways that do not need a
live instance: a unit test driving the pathname, and a browser control that plants the current pathname's
link and watches the assertion fire. The first live instance arrives with 2-16, and nothing here has to be
revisited when it does.

**The stale-row control needs a real row.** `hit-target-floor.pw.ts:1153-1202` exists to prove the ledger
can shrink, and it does that by planting a compliant link into a row that really is listed. With
`chrome-nav` gone, `home-nav` is the natural host: it is a real row on `/`, its two links stay in the
ledger for Story 2-32, and planting a third makes `covers: 2` drift by one, which is the arithmetic half the
current `covers 7` literal carries. Take the plant out of flow, as `:1172-1178` does, or the flex row
stretches its siblings and the control reports a layout side effect instead of the predicate.

**Expected arithmetic, to check the run against rather than to write down.** At two nav links: `/work`
7 found and 7 measured, `/celeste` 3 found and 3 skipped, the 404 4 found and 4 measured, `/` unchanged at
17. Total 28 measured across four surfaces, `covers` summing to 8, and the KV-4 census at seven controls
rendering as 8 of the 28. If the run disagrees, the run is right.

## Verification

**Commands:**

- `corepack pnpm test --run`: passes. This is the fast job that catches a half-done count edit, because the
  `SURFACES`, `EXEMPTIONS` and KV-4 literal cross-checks are vitest rather than Playwright.
- `corepack pnpm typecheck`: passes. AD-21 makes it blocking.
- `corepack pnpm build`: passes.
- `corepack pnpm test:e2e` inside `mcr.microsoft.com/playwright:v1.62.1-noble`: passes. Regenerate the
  `/work` baseline with `corepack pnpm test:e2e:update` in that same image and never on this host, because
  glyph rasterization is not portable.

**Manual checks:**

- Scroll `/work` at 360x800 and confirm the header stays put, does not shrink or hide, and paints an opaque
  ground rather than letting the page show through it.
- Tab through `/work` and confirm both nav links take a focus ring that appears instantly and is not the
  hover colour.

## Suggested Review Order

**The two destinations, which the rest of the story follows from**

- Start here. Six links become two, and `route` is separate from `href` for a reason.
  [`Navbar.tsx:54`](../../components/atoms/Navbar/Navbar.tsx#L54)

- The one new ARIA property in the codebase, decided against the pathname rather than the link.
  [`Navbar.tsx:70`](../../components/atoms/Navbar/Navbar.tsx#L70)

- The mark drawn on the inner span, because on the tap box it floats off the text.
  [`navbar.scss:59`](../../components/atoms/Navbar/navbar.scss#L59)

- The box built to the floor, with the reason vertical padding cannot do it.
  [`navbar.scss:34`](../../components/atoms/Navbar/navbar.scss#L34)

- Two targets on one line, kept from merging into one by touch.
  [`navbar.scss:21`](../../components/atoms/Navbar/navbar.scss#L21)

**The sticky header, and the two things it costs**

- Sticky, layered and opaque, with the `clip`-not-`hidden` dependency named.
  [`header.scss:51`](../../components/molecules/Header/header.scss#L51)

- A minimum rather than a height: a guard, and the comment says it was measured.
  [`header.scss:34`](../../components/molecules/Header/header.scss#L34)

- Sticky chrome occludes the scrollport, scoped off the header rather than off a route.
  [`header.scss:78`](../../components/molecules/Header/header.scss#L78)

**The ledger shrinks, which is what the floor repair buys**

- The row this story existed to delete is simply gone; four rows remain.
  [`hit-target-floor.pw.ts:226`](../../tests/e2e/hit-target-floor.pw.ts#L226)

- Three surfaces fell by four each, and `/` did not move at all.
  [`hit-target-floor.pw.ts:108`](../../tests/e2e/hit-target-floor.pw.ts#L108)

- The control that proves the ledger can shrink, rehosted on a row that survives.
  [`hit-target-floor.pw.ts:1161`](../../tests/e2e/hit-target-floor.pw.ts#L1161)

- A citation 78 lines stale, corrected because this story edited the line it names.
  [`hit-target-floor.pw.ts:246`](../../tests/e2e/hit-target-floor.pw.ts#L246)

- Thirteen authored controls become seven, in the register that counts them.
  [`known-violations.md:308`](../../ops/known-violations.md#L308)

**The repoint, which closes two deferred entries**

- The homepage panel's second link, off the redirect and relabelled to match.
  [`HomeLayout.tsx:151`](../../components/organisms/HomeLayout/HomeLayout.tsx#L151)

- DW-58's hash flips from empty to `#suite`, with the 2026-09-07 reading kept.
  [`projects-redirect.pw.ts:373`](../../tests/e2e/projects-redirect.pw.ts#L373)

**What the run found that the plan did not**

- The header's second destination, clicked rather than read: it arrives as a download.
  [`chrome-nav.pw.ts:717`](../../tests/e2e/chrome-nav.pw.ts#L717)

- The gap assertion that was missing: delete `gap` and everything else stayed green.
  [`chrome-nav.pw.ts:570`](../../tests/e2e/chrome-nav.pw.ts#L570)

- Scroll padding asserted where a header renders, and asserted absent where none does.
  [`chrome-nav.pw.ts:527`](../../tests/e2e/chrome-nav.pw.ts#L527)

**Peripherals**

- Why the printed `0.02` and the true `0.0103` are both honest numbers.
  [`rendered-output-harness.md:188`](../../ops/rendered-output-harness.md#L188)

- The routing table gains three real surfaces and loses a path nothing serves.
  [`README.md:87`](../../README.md#L87)
