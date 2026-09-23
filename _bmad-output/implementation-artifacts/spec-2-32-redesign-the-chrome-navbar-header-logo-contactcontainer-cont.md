---
title: 'Story 2.32: Redesign the chrome: `Navbar`, `Header`, `Logo`, `ContactContainer`, `Container`'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_commit: 'cdaf9661629d9a60ef459f4f2f00e753128c30d8'
review_loop_iteration: 0
warnings: ['oversized']
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** The chrome on `/work`, `/cv` and the 404 is still the 2023 shape: a header 140px tall by
declaration whose opaque ground stops at an 80%-wide container and whose block-end edge is an invisible
line, a raster logo whose link measures 184 x 20 (the last row in the hit-target ledger), nav labels in
`sans-serif` at `1.2em`, weight 300 and `#fff` with an ungated hover that adds a second underline over
the current-route mark, a container that spends 20% of a 360px viewport on margin, and a contact group
on `/` that is a bare run of links rather than a list.

**Approach:** Rebuild the five components against `contracts/tokens.css` alone: a full-width sticky
band closed by a hairline over a content-driven row, a text wordmark, mono nav labels whose underline
recolours on a gated hover, a width-capped container at page padding, and a list of contact links;
close in the same change the ledger rows, findings and deferred items booked to the chrome.

## Boundaries & Constraints

**Always:**

- `Navbar.scss`, `Header.scss`, `Logo.scss` and `Container.scss`, which replace the four 2023 lowercase
  files beside their components, read contract roles (`--token-*`, `--f-*`, `--t-*`, `--w-*`, `--lh-*`,
  `--tr-*`, `--s-*`, `--page-pad`, `--stroke-*`, `--z-sticky`, `--tap`) and nothing else: no alias, no
  colour literal, no `rgba()`, gradient, `box-shadow` or `backdrop-filter`, no `z-index` integer, no
  custom property of their own, and no length literal but the `1920px` cap `DESIGN.md` states for the
  container. `font-stretch: 75%` is the `wdth 75` idiom (`Premise.scss:68`).
- Every `:hover` in the chrome sits inside `@media (hover: hover)`, `SkipLink.scss` included. No
  `:active`, no `:focus` rule and no `outline` (the ring is the global rule in `app/app.scss`), no
  transition.
- Every chrome link takes `min-block-size: var(--tap)` and `min-inline-size: var(--tap)`; no `44px` is
  written in any stylesheet.
- No `.tsx` names a contract token or the path `contracts/`, comments included (`anchor-contract.test.ts`).
- `header.header-container`, `nav.navbar`, `.navbar__label`, the `aria-current` comparison and the
  `DESTINATIONS` export keep their names; `Header` renders nothing on `/`; `#celeste header` keeps
  hiding it; no script reads or writes a layout value.
- A ledger row, finding, register cell or deferred entry this story closes moves in the same commit as
  the repair, in every file that holds it.
- The `/work` baseline is regenerated inside `mcr.microsoft.com/playwright:v1.62.1-noble` only, and its
  sha256 recorded in `ops/rendered-output-harness.md`.

**Ask First:**

- Changing `contracts/`, `epics.md`, `DESIGN.md`, `EXPERIENCE.md` or `RESTYLE-SPEC.md`.
- Changing the wordmark's string, the rest underline or any other value Design Notes marks as the
  Operator's, beyond what this spec sets.

**Never:**

- No new dependency, no motion, no script that measures the header or writes onto the root element.
- No skip link, `<main>` or other new control or landmark on `/work`, `/cv`, `/celeste` or the 404
  (F-13, F-20, DW-43, DW-71), and no change to the hero entrance's delays (DW-106): re-booked, not done.
- No `eslint` invocation and no lint criterion.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Chrome at 360 | `/work`, `/cv`, the 404 at 360 x 800 | One row: wordmark left, `Suite` and `CV` right; the band spans 0 to 360; height is `--s-lg` twice plus `--tap` plus `--stroke-hair`; nothing past either edge | A wrapped row grows the band (content-driven) |
| Chrome wide | 1280 and 2400 wide | Band full width; inner container `min(100%, 1920px)`, centred, at `--page-pad` | N/A |
| Current route | `/cv` | `CV` carries `aria-current="page"` and a `--stroke-emphasis` `--token-accent` rule on its label; `Suite` a `--stroke-hair` `--token-border-interactive` rule | N/A |
| Hover, fine pointer | Pointer over a nav link | That label's rule recolours to `--token-accent-hover`, width unchanged; nothing else changes | N/A |
| Tap, touch | `(hover: none)`, tap a nav link | No hover colour starts or sticks | N/A |
| Scroll | Page scrolled | Header stays at the top, same height, opaque `--token-bg`, hairline beneath, no shadow | N/A |
| Fragment | A target scrolled to | Scroll padding equals the header's rendered height; `auto` on `/` | N/A |
| `/celeste` | Route loaded | Header rendered and `display: none` by `#celeste header`, no inline style | N/A |
| Wordmark | Any chrome route | Link to `/` reading `Cuatro`, named `Cuatro`, display face at `wdth 75` / 800, uppercase by CSS, no image and no `alt` | N/A |
| Contact | `/` | One list of three items, one link each, named Github, LinkedIn, Email, each at least `--tap` on both axes; entrance delays unchanged | N/A |
| Keyboard | Tab through the chrome; click | Global ring on `:focus-visible`, instant; a click paints none | N/A |
| Skip link | `/`, Tab once | Revealed one ring-reach inside the viewport corner, ring whole | N/A |

</frozen-after-approval>

## Code Map

**The chrome** (graphify `affected Navbar`: `Navbar.test.tsx:L2`, `Header.tsx:L7`, `layout.tsx:L6`;
`affected Logo`: `Header.tsx:L6`, `layout.tsx:L6`; `affected ContactContainer`: `HomeLayout.tsx:L5`,
`app/page.tsx:L5`, `HomeLayout.test.tsx:L7`)

- `components/atoms/Navbar/Navbar.tsx` (92): markup unchanged; docblock `:29-32` and comment `:81-87`
  cite `chrome-logo` and `navbar.scss`. `navbar.scss` (60) becomes `Navbar.scss`: `:38-46` the 2023 type,
  `#fff` and ungated hover (F-1, DW-69).
- `components/molecules/Header/Header.tsx` (21): `:13` the header is itself `.container`; becomes a
  band holding an inner container. `header.scss` (80) becomes `Header.scss`: `:16` `$header-block-size:
  140px` spent twice, `:34` minimum, `:78-80` scroll padding (DW-62), no block-end edge (review A-6).
- `components/atoms/Logo/Logo.tsx` (11): a `next/image` raster, `alt` describing a picture; the only
  importer of `next/image` and the only reference to `public/logo.png`. `logo.scss` becomes `Logo.scss`.
- `components/molecules/ContactContainer/ContactContainer.tsx` (21): three links in a `div`; its styles
  are `components/organisms/HomeLayout/HomeLayout.scss:110-115` (group), `:190-217` (links and the
  `a:nth-child()` stagger), `:291-300` (below 768), `:419-420` (reduced motion).
- `components/atoms/Container/Container.tsx` (20): `:5` import only; `Body` at `:12-16` is cited by
  `AGENTS.md` and must not move. `container.scss` (5) becomes `Container.scss`. Mounted by
  `app/work/page.tsx:19` and `app/cv/page.tsx:47`.
- `components/atoms/SkipLink/SkipLink.scss` (73): `:33-35` parks the link at the corner (`clip-skip-link`),
  `:62-64` ungated hover (DW-115).
- `public/logo.png`: deleted; `app/__tests__/anchor-contract.test.ts:347` `KNOWN_TRACKED` sentinel.

**Tests that read the chrome**

- `tests/e2e/chrome-nav.pw.ts` (811): the floor `:243-316`, the sticky ground `:373-542`, scroll padding
  equality `:544-585` (its comments cite 140px and Story 2-32). Gains this story's browser cases.
- `tests/e2e/cv.pw.ts:115-122` `LEDGER_EXEMPT = '.logo a'` and `:582-587` its count; `:297-304` the
  unmarked label reads `borderBottomStyle` `none`.
- `tests/e2e/hit-target-floor.pw.ts`: `EXEMPTIONS` `:252-273` (`chrome-logo`, the last row); rows the
  controls plant into, `:845`, `:891`, `:1044-1065`, `:1101-1135`, `:1177-1237` (DW-68); docblocks `:24`,
  `:157-161`, `:240-250`, `:992`.
- `tests/e2e/accessibility-floor.pw.ts:212-219` the `clip-skip-link` row.
- `ops/__tests__/hit-target-floor.test.ts`: `recordRows` `:117-121` and `specRows` `:175-177` refuse zero
  rows; `:382-396` pins `chrome-logo`; `:455-460` the zero-row controls; `:767-795` KV-4 pins.
- `ops/__tests__/hub-accessibility-pass.test.ts:586-631` derives KV-6's closers and spelled counts from
  the ledger (no edit expected).
- Unit files: `Navbar.test.tsx` (118), `Container.test.tsx` (102), `SkipLink.test.tsx`; new beside
  `Header`, `Logo`, `ContactContainer`. `anchor-contract.test.ts:284-331` `TOKEN_NATIVE_STYLESHEETS`.

**Records**

- `ops/hit-target-floor.md`: ledger `:236-400`, § The tolerated breach `:416`, § Failing loudly `:732`.
- `ops/known-violations.md`: KV-4 index `:65`, entry `:322-412`; KV-6 index `:67`, entry `:472-555`;
  pending actions 8 and 9 `:570-571`; KV-5 `:414-470` if the census moves.
- `ops/hub-accessibility-pass.md`: headline rows `:29`, `:40` (families); the clip table `:183-186`; the
  ledger `:329` and `:371-376`; F-1 `:393`, F-13 `:405`, F-20 `:412`; § Decisions `:520`.
- `ops/rendered-output-harness.md`: the chrome-nav row `:44`, baseline `:207-221`.
- `ops/asset-budget.md`: § Every route `:469`, § Findings `:1239`.
- `_bmad-output/implementation-artifacts/deferred-work.md`: DW-62 `:3717`, DW-63 `:3777`, DW-68 `:3947`,
  DW-69 `:3979` close; DW-43 `:3027`, DW-71 `:4054`, DW-106 `:5256`, DW-115 `:5523` annotated.
- Comments citing the old container or file names: `Premise.scss:14-15`, `SuiteDirectory.scss:21-23`,
  `CvIntro.scss:15-17,34-37` (re-measured), `CvIntro.scss:109`, `SiteFooter.scss:81`, `anchor-contract.test.ts:286-291`.

**Found during implementation, and touched for it**

- `ops/known-violations.md` KV-5 and `ops/hit-target-floor.md` § The overflow this assertion does not
  cover: the whole-page census on `/work` at 360 reads **0**, where it read 10 (all the hero's), because
  the wider container feeds the hero a wider box. Recorded as dated re-reads; the retirement, with the
  Story 2-8 sweep's A-5 arm widened, is filed as DW-116 for Story 2-33, KV-5's last closer.
  `tests/e2e/hit-target-floor.pw.ts:43-51` says the same.
- Every comment edit in another story's stylesheet is line-neutral, because other files cite lines in
  `SuiteDirectory.scss`, `Premise.scss` and `CvIntro.scss`; `SiteFooter.scss:82`'s citation of
  `CvIntro.scss:110-118` stays true.
- `.navbar__label` compiles as `.navbar a[aria-current=page] .navbar__label` (Sass drops the quotes),
  which is the form `Header.test.tsx` reads.
- `app/__tests__/anchor-contract.test.ts` "names none of the three families": a comment naming the mono
  face's family counts as naming it, so `Navbar.scss` says "the mono face".
- `deferred-work.md`: DW-116 (KV-5's retirement due), DW-117 (the wordmark's values and "the site name",
  the rest underline), DW-118 (the scroll padding's ceiling, and `/celeste`).

## Tasks & Acceptance

**Execution** (in this order, on `dev`):

- [x] Before any edit: `corepack pnpm build && node ops/asset-budget.mjs`, every chunk weighed at gzip
      level 9, saved to the scratchpad as the before reading.
- [x] `git mv` each lowercase stylesheet to its PascalCase name in two steps; rewrite all four and
      update the four imports.
- [x] `Logo.tsx`: one `Link` to `/` reading `Cuatro`, class `logo`, no image; delete `public/logo.png`.
- [x] `Header.tsx`: `header.header-container` holding `div.header-container__inner.container`, wordmark
      then nav; `Navbar.tsx` comments only.
- [x] `ContactContainer.tsx`: `ul.contact-container` with `role='list'`, one `li` per link, copy and
      attributes unchanged; `HomeLayout.scss`: `list-style: none` on the group, stagger on
      `li:nth-child()`.
- [x] `SkipLink.scss`: reveal inset and hide offset from the ring's reach; hover gated.
- [x] Unit: the five components' markup and compiled-stylesheet guards (roles pinned and read, no
      literal, hover gated, the exact rules Design Notes gives), each guard seen failing on the 2023 file
      or a planted literal first; `anchor-contract.test.ts` list, sentinel and a no-`44px` scan.
      *(As executed: the header suite was written first and read 16 of its 21 cases failing on the 2023
      files; the skip link's two guards were shown failing by compiling the pre-story `SkipLink.scss`
      out of git, since that file had been edited before its guard was written.)*
- [x] `tests/e2e/chrome-nav.pw.ts`: one case per browser criterion below, each with a planted control;
      `cv.pw.ts` and `hit-target-floor.pw.ts` (DW-68) and `accessibility-floor.pw.ts` rows as the Code
      Map says.
      *(As executed: the hover case failed one run in three on four pixels at the wordmark's first
      glyph, a re-rasterisation around `/work`'s late-mounting canvas rather than a style change. It
      now waits for the canvas and reads each state once two consecutive reads agree, and six repeats
      of the whole file were then green, 102 of 102.)*
- [x] Records and `ops/__tests__/hit-target-floor.test.ts` as the Code Map says; comments in other files.
- [x] Branch build, budget and chunk weights; `ops/asset-budget.md` reading and run.
- [x] Container: plain `pnpm test:e2e` (the `/work` comparison is expected to fail), then `pnpm run
      test:e2e:update`, then plain again with no filter, green; sha256 and pixel count recorded; census,
      off-contract list and ring reads copied into the records.
- [x] `deferred-work.md`; `corepack pnpm typecheck`; `corepack pnpm test --run`; commit.

**Acceptance Criteria:**

- Given `/work`, `/cv` and the 404 at 360, when every chrome link is measured by `boundingBox()`, then
  the wordmark and both destinations are each at least the `--tap` read off `:root` on both axes, the
  destinations sit at least `--s-lg` apart without overlapping, and the Story 2-8 sweep passes with an
  empty ledger.
- Given `/cv`, when the nav is read, then each link computes Geist Mono (checked with
  `document.fonts.check`) at `--t-2xs`, weight 400, uppercase, `--tr-label` and `--token-text`; `CV`'s
  label rule is `--stroke-emphasis` `--token-accent`, `Suite`'s `--stroke-hair`
  `--token-border-interactive`, and nothing else in the header carries `aria-current`.
- Given a fine pointer, when a nav link is hovered, then its label's rule computes `--token-accent-hover`
  at the same width, the link's colour, ground and box are unchanged, and every pixel that differs from
  the rest screenshot lies in the rule's rows; given `(hover: none)` with touch, when a nav link is
  tapped, then no border-colour transition starts, where a planted ungated rule does.
- Given each chrome surface, before and after a scroll, then the header is sticky at `top: 0` on
  `--z-sticky` with an opaque `--token-bg` ground and an unchanged height, closed beneath by a
  `--stroke-hair` rule whose pixels read `--token-border` rasterised across the whole viewport, with no
  `box-shadow` and no `backdrop-filter`.
- Given `/work` and `/cv` at 360, 1280 and 2400 wide, when `section.container` and the header's inner
  container are measured, then each is `min(viewport, 1920)` wide, centred, with each inline padding
  equal to `--page-pad` resolved at that width, and the header band spans the whole viewport.
- Given the chrome at 360, when the header is measured, then its height equals `--s-lg` twice plus
  `--tap` plus `--stroke-hair`, its computed `min-height` is `auto`, a child planted taller than `--tap`
  grows it by the difference, scroll padding equals the rendered height on every chrome surface, and no
  element inside it lies past either viewport edge (a planted wide child is reported).
- Given `/work`, when the wordmark is read, then it is a link to `/` named `Cuatro`, the header holds no
  `img`, `svg`, `picture` or `[alt]`, it computes the display face (`document.fonts.check` at 800),
  `--w-black`, `font-stretch: 75%`, uppercase and `--token-text`, it renders narrower than the same
  text planted at `100%`, and `/logo.png` answers 404.
- Given `/` at 360, when the contact group is read, then it is one list of three list items, each
  holding one link at least `--tap` on both axes whose name (Github, LinkedIn, Email) matches its
  destination (`github.com`, `linkedin.com`, `mailto:`), and `tests/e2e/narrative.pw.ts` reads the same
  three delays.
- Given every route, when `tests/e2e/accessibility-floor.pw.ts` runs, then every chrome link rings on
  keyboard focus instantly and not after a click, the skip link rings whole, the ledger carries no
  `clip-skip-link`, and KV-6 reads zero clipped rings with Story 2-33 its only closer.
- Given the tree, when the unit suites run, then no stylesheet under `app/` or `components/` writes
  `44px`, the four chrome files are token-native in `anchor-contract.test.ts`, the hit-target ledger is
  empty in both files, and KV-4 is retired on 2026-09-23 by Story 2-32 in its entry and index row.
- Given the before and after builds, when `ops/asset-budget.md` is read, then a dated reading gives both
  sides, the Derived delta against the Story 2-30 reading and the non-3D line against Story 2-2's
  140,000.
- Given `corepack pnpm typecheck`, `corepack pnpm test --run` and the container `pnpm test:e2e`, when
  run, then every file passes, the last against a regenerated `/work` baseline whose sha256 is recorded.

## Spec Change Log

## Design Notes

Each resolution below is an assumption taken from the documents in their precedence order
(`DESIGN.md` values, `EXPERIENCE.md` behaviour, `RESTYLE-SPEC.md` geometry and the rest).

**The `Celeste` criterion is already met, and is kept rather than rebuilt.** Story 2-1 (`681a4c6`)
moved the suppression into `#celeste header` (`celeste.scss:8-10`), keyed on the id `Body` writes onto
`<body>`; `Celeste.tsx` has no effect; `tests/e2e/celeste-header.pw.ts` holds the header rendered,
`display: none` and carrying no inline `style`. An attribute on `<body>` is the mechanism the criterion
names, and the id is the one `AGENTS.md` makes the house rule. It stays green through the new markup
because `#celeste header` outranks `.header-container`.

**The criterion's premise is stale and the floor is met by measurement.** "~16x27px" was disproved by
Story 2-8 (38.41 to 98.13 x 22.00) and Story 2-15 built both destinations to `--tap`; the deferred entry
at `deferred-work.md:2224` carries the wording. `min-block-size` and `min-inline-size` are `min-height`
and `min-width` in the Hub's one writing mode, the idiom every floor here uses.

**The nav's rest underline.** `DESIGN.md` gives the current route the emphasis underline and says hover
"recolours the existing underline", which presumes one at rest; no document states the non-current
value. `RESTYLE-SPEC.md` § 1b (every Link has an underline at rest, never one that appears on hover)
and `DESIGN.md`'s Links (the Source link) supply it: `--stroke-hair` in `--token-border-interactive`, in
the chrome's `--token-text`, as `SiteFooter.scss:84` draws. The mock's transparent 2px rule loses on
precedence and would appear on hover. Current and rest differ in width as well as hue, so the current
route survives greyscale.

```scss
.navbar__label { border-block-end: var(--stroke-hair) solid var(--token-border-interactive); }
.navbar a[aria-current='page'] .navbar__label { border-block-end: var(--stroke-emphasis) solid var(--token-accent); }
@media (hover: hover) { .navbar a:hover .navbar__label { border-block-end-color: var(--token-accent-hover); } }
```

**No transition, so no motion.** § 1b gives a Link none, and every other Link on the Hub recolours
instantly (Suite Directory, footer, CV intro); § 1's `border-color` transition is a Control's. The
`animate` skill has nothing to decide.

**The wordmark: `Cuatro`, at `--t-sm`, `--tr-name`, `--lh-heading`.** No document states the string,
size or tracking. The string is the word the retired raster draws (CU4TRO) and the mock sets, and the
ceiling keeps copy as it is; it is the link's whole content, so its accessible name is its text, with
no `alt` and no `aria-label`, uppercased by the stylesheet so a reader hears a word (the
`SkipLink.tsx:16-17` precedent). The size is the mock's; `--tr-name` is the name role nearest the mock's
hand-written tracking; `--lh-heading` is § 6's for non-display headings. The Registry calls the Hub
`Cuatro Ecosystem` and `openGraph.siteName` says `Luigi Espinosa`, so "the site name" has three
candidates: filed as a deferred entry for the Operator. `font-stretch: 75%` is the house `wdth 75`
idiom (font matching, not `font-variation-settings`); Story 2-34's type-axis disposition covers the
coordinate either way.

**The header is a band with a container inside it (DW-63).** The ground and the hairline span the
viewport at every width and the content aligns to the page's `--page-pad` edge; the header as the
container itself would reopen the gutters above 1920.

**Content-driven height, and a scroll padding restating it from the same tokens (DW-62).** The band
declares no height: `padding-block: var(--s-lg)`, one row of controls held to `--tap`, a hairline. The
scroll padding is the same four tokens:

```scss
html:has(.header-container) {
  scroll-padding-block-start: calc(var(--s-lg) + var(--tap) + var(--s-lg) + var(--stroke-hair));
}
```

It is exact while the band is one row, which it is at 360 and above (asserted). A script-measured value
was rejected because it writes onto the root element from a component, the pattern `AGENTS.md` bans.
The ceiling (a band wrapped below the supported floor, or text zoomed past `--tap`) is named in the
stylesheet and filed.

**`ContactContainer` is a list; its styles stay where the group is laid out.** `ul role='list'` of
three `li`, one link each, copy and `target`/`rel` unchanged; `role='list'` because `list-style: none`
drops list semantics in WebKit (the Story 2-31 precedent). Github, LinkedIn and Email each name their
destination out of context by A-9's standard (`Source` qualifies). `HomeLayout.scss` already lays the
group out, so the list reset joins it there, and the stagger moves from `a:nth-child()` to
`li:nth-child() a` with the same three delays: not a change to the entrance, so DW-106 stays unfired.

**The skip link's two booked repairs are taken.** `clip-skip-link` and DW-115's `SkipLink.scss` half
are booked to this story by ownership of the top-of-page chrome, and a ledger row closed by a story
marked `done` fails `hub-accessibility-pass.test.ts`. Revealed, the link sits one ring-reach
(`--focus-offset` plus `--stroke-focus`) inside the viewport's corner, and hides by its own height plus
that inset; the sweep's clip read is `distance < reach`, so the ring lands whole.

**Re-booked rather than taken.** F-13, F-20, DW-43 and DW-71 put a skip link and a `<main>` on four
routes: a new control and a landmark, which the restyle ceiling puts out of scope and epics.md's
criteria do not ask for. DW-106 is the hero entrance's behaviour, unfired. Each is annotated where it
lives with the reason and left unassigned for an Operator ruling.

**The empty hit-target ledger (DW-68).** Deleting `chrome-logo` empties the ledger and retires KV-4 on
this commit. The instrument outlives the breaches: an unlisted element under the floor still fails. The
controls that planted into a real row now plant a real element on a real page against an invented row,
through `measureSurface`'s and `judge`'s own `exemptions` parameter, the shape the ghost-row case uses;
the agreement suite accepts a ledger empty by declaration (an empty literal, a header-only table) and
still refuses one it could not read.

**Stylesheet names and the raster.** The four 2023 lowercase files give way to PascalCase ones beside
their components (`AGENTS.md`; the `Error404.scss` precedent), moved by `git mv` in two steps so the
case reaches the index. `public/logo.png` has no other reference and leaves with the component, taking
`next/image` out of the build with its one importer; the `public/` sentinel moves to `public/pdf/cv.pdf`.

**Rollback.** Revert the commit: the files, the raster, the ledger row, KV-4's open state and the old
baseline return together.

## Verification

**Commands:**

- `corepack pnpm typecheck`: expected clean.
- `corepack pnpm test --run`: expected every file to pass (1,393 tests in 55 files after Story 2-30).
- `corepack pnpm build && node ops/asset-budget.mjs`: expected a reading the Derived paragraph accounts for.
- Container `pnpm test:e2e` with no filter: expected green after the baseline update.

**As run, 2026-09-23:**

- `corepack pnpm typecheck`: clean.
- `corepack pnpm test --run`: 58 files, 1,423 tests, all passed. The header suite read 16 of its 21
  cases failing on the 2023 chrome before the rebuild; the skip link's guards fail on the pre-story
  `SkipLink.scss` compiled out of git; `hit-target-floor.test.ts` and `hub-accessibility-pass.test.ts`
  pass against the emptied hit-target ledger, KV-4 retired and KV-6 at zero clipped rings.
- `corepack pnpm build && node ops/asset-budget.mjs`: before `1Kac2bThegXv_e_j6smcv` (Story 2-30's
  after figures exactly), after `N4qdBF98aHF4vMMIrE44u`: 5,342 gzipped lighter overall, `.css` 243
  heavier, `.js` 5,585 lighter (`next/image` gone with the raster); the non-3D line 111,906 over on `/cv`
  against Story 2-2's 140,000, where it was 117,488. Filed in `ops/asset-budget.md`.
- Container `pnpm test:e2e`, `mcr.microsoft.com/playwright:v1.62.1-noble`: plain run 306 passed and 2
  failed, the `/work` comparison at 47,941 differing pixels and its capability guard; `pnpm run
  test:e2e:update` wrote `916c5460...` (23,763 bytes), 306 passed and 2 skipped; a plain run then failed
  the hover case once (the re-rasterisation the task note records), and after the fix six repeats of
  `chrome-nav.pw.ts` were 102 of 102 and the final plain run with no filter was **308 of 308** in 5.9
  minutes, no stray snapshot written.
- Measured in those runs: the header 93.00 tall on `/work`, `/cv` and the 404 with scroll padding 93px;
  the wordmark link 44.00 x 44.00, its word 37.75 wide at `wdth 75` against 49.75 at 100; the container
  360, 1280 and 1920 (at x 240) wide at 360, 1280 and 2400, padded 20, 64 and 64; the whole-page
  census 0 on `/work` and `/cv`; the off-contract list `/celeste`'s heading alone; 345 text reads.
- Lighthouse, which this spec does not ask for and which gates on `main` only, read in the same image
  the way `.github/workflows/lighthouse.yml` takes it, three runs per URL: accessibility `/work` and
  `/cv` 1.00 and `/` 0.96, best practices and SEO 1.00 everywhere, every assertion green. `/`'s one
  failing audit, itemised by a further run after the review, is DW-113's six ornaments exactly; the
  three contact links this story made a list are not among them.

**The Step-04 review, 2026-09-23.** All six layers ran in this session, because it had no tool to
start a subagent, so none of them is independent of the implementation (the 2-30 and 2-31
precedent). One patch, from the Ponytail layer: `chrome-nav.pw.ts` had grown a second probe helper
beside the file's own `probeComputed`, and a context factory with one caller. Its ten reads, and the
two helpers built on it, go through `probeComputed` now, and the touch context is built where it is
used. No deferral. Rejected: the contact links' `target='_blank'` on `mailto:` and the `Github`
casing, which are the copy and the interaction the restyle ceiling keeps; the floor scan matching
`44px` alone, where Story 2-34's gate owns every spelling of a spacing literal; and the scroll
padding's ceiling on a wrapped row, which is DW-118 already. The ECC loop read the build, the types
and the whole suite green, and found no secret-like string and no `console.log` in a shipped source.
The design layer approved: the labels and the wordmark take their tracking and leading from the
`--tr-*` and `--lh-*` roles; both hovers recolour a rule already drawn, behind `(hover: hover)` and
with no transition, which `RESTYLE-SPEC.md` § 1 settles for a Link; the band is opaque with a
hairline and no alpha or blur, which `DESIGN.md` § Rules settles; the skip link's reveal stays
instant on `:focus`, a keyboard action and never animated; and the contact stagger keeps Story
2-29's 80ms steps, re-keyed on the list items. Re-run after the patch: typecheck clean;
58 files, 1,423 tests, all passed; the container suite 308 of 308 in 5.9 minutes, the
`/work` baseline still `916c5460...` and no snapshot written. The build and the budget were not
re-read, because the patch touches a browser spec and nothing the build reads.

**Manual checks:**

- Look at `/work`, `/cv` and the 404 at 360 and 1280 on a hover-capable pointer and on a phone: the
  wordmark, the two labels, the hairline, a hover that recolours one rule, and no hover on a tap.

## Suggested Review Order

**The band and the container**

- Start here: the band spans the viewport, its content sits in the page's own container.
  [`Header.tsx:13`](../../components/molecules/Header/Header.tsx#L13)

- Sticky, opaque, a hairline beneath, and no block size declared anywhere (DW-62).
  [`Header.scss:12`](../../components/molecules/Header/Header.scss#L12)

- Scroll padding restated from the four tokens that make the band; its ceiling is DW-118.
  [`Header.scss:58`](../../components/molecules/Header/Header.scss#L58)

- Capped rather than percentaged, so a phone loses nothing before the page padding.
  [`Container.scss:8`](../../components/atoms/Container/Container.scss#L8)

**The two destinations**

- Mono uppercase at the label size and tracking, held to `--tap` on both axes.
  [`Navbar.scss:20`](../../components/atoms/Navbar/Navbar.scss#L20)

- Every label carries a rule at rest, so hover recolours and never adds (DW-69).
  [`Navbar.scss:45`](../../components/atoms/Navbar/Navbar.scss#L45)

- The current mark keys on `aria-current`: wider, and in the accent.
  [`Navbar.scss:54`](../../components/atoms/Navbar/Navbar.scss#L54)

- Hover gated on a pointer that can hover, with no transition, as a Link.
  [`Navbar.scss:64`](../../components/atoms/Navbar/Navbar.scss#L64)

**The wordmark**

- Text where the raster stood, named by its words; which name is DW-117.
  [`Logo.tsx:19`](../../components/atoms/Logo/Logo.tsx#L19)

- The display face at wdth 75 and the black weight; size and tracking are assumptions.
  [`Logo.scss:9`](../../components/atoms/Logo/Logo.scss#L9)

**The contact list and the skip link**

- One list of three links naming their destinations; copy, targets and order unchanged.
  [`ContactContainer.tsx:19`](../../components/molecules/ContactContainer/ContactContainer.tsx#L19)

- The stagger counts list items now, on Story 2-29's three delays.
  [`HomeLayout.scss:216`](../../components/organisms/HomeLayout/HomeLayout.scss#L216)

- Parked one ring's reach inside the corner, so the ring lands whole.
  [`SkipLink.scss:40`](../../components/atoms/SkipLink/SkipLink.scss#L40)

- Its hover gated too, the half of DW-115 this story owns.
  [`SkipLink.scss:71`](../../components/atoms/SkipLink/SkipLink.scss#L71)

**The records, moved in the same change**

- KV-4 retired: the ledger's last row left with the raster.
  [`known-violations.md:322`](../../ops/known-violations.md#L322)

- The ledger reads empty in both files, and says so in words.
  [`hit-target-floor.md:254`](../../ops/hit-target-floor.md#L254)

- The clip read at none of 39 stops; F-1 closed beside it.
  [`hub-accessibility-pass.md:29`](../../ops/hub-accessibility-pass.md#L29)

- The weighed build: 5,342 gzipped lighter, `next/image` gone with the raster.
  [`asset-budget.md:471`](../../ops/asset-budget.md#L471)

- The new `/work` baseline, and why 47,941 pixels moved.
  [`rendered-output-harness.md:224`](../../ops/rendered-output-harness.md#L224)

- Three entries filed: KV-5's retirement, the site's name, the padding's ceiling.
  [`deferred-work.md:5631`](deferred-work.md#L5631)

**Peripherals**

- Eight browser cases for the rebuilt chrome, each read against a planted control.
  [`chrome-nav.pw.ts:969`](../../tests/e2e/chrome-nav.pw.ts#L969)

- An empty ledger still runs every refusal, against a planted row.
  [`hit-target-floor.pw.ts:289`](../../tests/e2e/hit-target-floor.pw.ts#L289)

- The four chrome sheets pinned to contract roles and to the rules each exists for.
  [`Header.test.tsx:165`](../../components/molecules/Header/__tests__/Header.test.tsx#L165)

- No stylesheet writes the floor by hand; four files join the token-native list.
  [`anchor-contract.test.ts:1190`](../../app/__tests__/anchor-contract.test.ts#L1190)

- The record's empty ledger and KV-4's retirement, pinned.
  [`hit-target-floor.test.ts:388`](../../ops/__tests__/hit-target-floor.test.ts#L388)

- The wordmark as one link named by its text, with no image anywhere.
  [`Logo.test.tsx:25`](../../components/atoms/Logo/__tests__/Logo.test.tsx#L25)

- The contact list's shape, and each name matched to its destination.
  [`ContactContainer.test.tsx:35`](../../components/molecules/ContactContainer/__tests__/ContactContainer.test.tsx#L35)

- The skip link's inset and hide, compiled and read.
  [`SkipLink.test.tsx:44`](../../components/atoms/SkipLink/__tests__/SkipLink.test.tsx#L44)
