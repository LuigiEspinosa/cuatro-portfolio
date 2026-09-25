---
title: 'DW-43: accessibility, a skip link and a main landmark on every route, the landmark ring inset, colour scheme and selection, the accent-fill check, a scriptless CV, the new-tab glyph and the url() tell'
type: 'bugfix'
created: '2026-09-24'
status: 'done'
baseline_commit: '4a7d1b509d366210c0fca288705dc6bf0e257754'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Only `/` has a skip link and a `main#main`; `/work`, `/celeste` and the 404 have no
landmark and `/cv`'s has no id (DW-43, DW-71, F-13), and the landmark's ring on `/` falls past the
document edge on three sides (F-20). The skip link and skip control have no design row (DW-44). The
Hub declares no `color-scheme` and no `::selection` (DW-95, F-15). No check refuses an accent fill
(F-8, ledger L2297). With scripting off `/cv` shows one company of four (DW-76). Directory links
open a new tab unannounced (ledger L2391). The built-CSS tally cannot see a `url()` grain (DW-102).

**Approach:** Operator ruling 2026-09-24, one package, eight rulings. A `<main id="main"
tabIndex={-1}>` on every route and the skip link moved into `Header` as its first child; a
`main:focus-visible` rule insetting the ring; a `DESIGN.md` row for both skips; `color-scheme:
dark` and an accent `::selection`; a unit test refusing accent fills outside two selectors; a
`@media (scripting: none)` rule opening every panel; the external glyph plus `opens in a new tab`
on both Directory links; a `url(` count in the built-CSS tally.

## Boundaries & Constraints

**Always:**

- Every changed behaviour gets a test that fails without the change, run red on the baseline tree
  first, and every new read gets a planted control that shows it firing.
- `/` keeps exactly one skip link, first in the document, and its DOM does not move.
- The ring stays `--stroke-focus` solid `--token-focus`, never transitioned; only the landmark's
  offset differs, and no length or colour literal is written.
- The two F-8 exemptions are keyed on a path and an exact selector, never on a role.
- Records take the UTC date and cite "Operator ruling 2026-09-24". A ledger entry closes with a
  dated paragraph and `status: done`; an ops row is annotated and kept; a planning document gets a
  dated amendment in its own style.
- No em-dash, en-dash, double-dash standing in for a dash, or emoji in anything written.

**Ask First:** nothing gates this run. It is unattended; each open decision is resolved from
`DESIGN.md`, then `EXPERIENCE.md`, then `RESTYLE-SPEC.md`, and stated under Design Notes.

**Never:**

- No new CI job, so no `ci.yml` job name moves. No new dependency. No `target` change.
- No rebuild of `WorkItem` on `<details>`, no change to the disclosure's tween.
- No edit to `contracts/`, `RESTYLE-SPEC.md`, or `/celeste`'s look (DW-121 is another package's).
- No push, no pull request. Regenerate the `/work` baseline only if the pinned run shows it moved.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Header routes | `/work`, `/cv`, the 404 | one `.skip-link`, the header's first child and first Tab stop; Enter puts focus on the one `main#main[tabindex="-1"]`, which rings inset and whole | N/A |
| Home | `/`, either door | one `.skip-link`, first in `body`, no `header`; Enter as above | N/A |
| `/celeste` | header `display: none` | `main#main` present, no visible control, skip link hidden with the header | N/A |
| Colour scheme | any route | `:root` computes `color-scheme: dark`; selected text paints `--token-accent` under `--token-bg` | N/A |
| Accent fill | every tracked stylesheet | no `background`, `background-color` or `fill` names `--token-accent`, `-hover` or `-muted` except `.suite-directory__dot` in `SuiteDirectory.scss` and `::selection` in `app/app.scss`, each used once | a planted fill, one hidden by nesting, a mixin or a Sass variable, and an exempt selector in another file are refused |
| Scripting off | `/cv`, `/work` | all four panels open; with scripting on, three stay at zero | N/A |
| Directory links | both links, every row | `target="_blank"` kept; an `aria-hidden` north-east arrow (U+2197) after the underlined label; the name ends `opens in a new tab` | N/A |
| Built CSS | `.next/static/chunks/*.css` | zero `url(` outside `@font-face`; the three face `src` urls not counted | a planted `background-image:url(...)` is reported unlisted |

</frozen-after-approval>

## Code Map

- `components/molecules/Header/Header.tsx:12-24`: returns `null` on `/`; gains `<SkipLink />` first
  inside `<header>`, and alone on `/`. `app/page.tsx:3,61-64`: its `SkipLink` import and element go.
- `app/work/page.tsx:17-24`, `app/cv/page.tsx:39-52` (bare `<main>` and its "no skip link"
  comment), `app/celeste/page.tsx:15-17`, `app/not-found.tsx:13-15`: the four landmarks.
- `app/app.scss:27-42`: the global ring; the landmark rule, the `color-scheme` block and
  `::selection` go beside it. `:17-19` is `--hero-height`'s `:root`, which DW-122 deletes, so the
  F-11 `:root` is its own block.
- `components/atoms/WorkItem/WorkItem.scss:139-141`: the "no rule here" note on
  `.work-item__content`; `app/scss/_print.scss:45-53`: the two declarations reused.
- `components/organisms/SuiteDirectory/SuiteDirectory.tsx:126-149`: both anchors;
  `SuiteDirectory.scss:206-222` (the dot and its F-8 note), `:239-256` (the links' shared rule).
- `components/atoms/SkipLink/SkipLink.tsx:11-14` and `SkipLink.scss:10-15`,
  `SkipControl.scss:65-69`: comments naming `app/page.tsx` and DW-44.
- `ops/literal-conformance.mjs:43`: exported `mask()`, reused by the accent-fill test.
- Unit: `Header.test.tsx:46-66`; `app/__tests__/page.test.tsx:85-89`;
  `app/cv/__tests__/page.test.tsx:91-104`; `app/__tests__/anchor-contract.test.ts:207-218,946-993`
  (claim one pins `app/app.scss` to eight roles; `--token-accent` joins as `SELECTION_ROLES`);
  `WorkItem.test.tsx:463-560`; `SuiteDirectory.test.tsx:132-190,370-400` (names and `textContent`).
- E2E: `accessibility-floor.pw.ts` `:88-89` and `:1047-1054` (the one-ring scan), `:805-845`
  (`tally`), `:1336-1372` (the Enter read, whose `ringFindings` demands `--focus-offset`),
  `:1445-1476`; `hit-target-floor.pw.ts:130-136` (`SURFACES` pins); `secondary-surfaces.pw.ts:537-572`;
  `cv.pw.ts:513-585`; `suite-directory.pw.ts`; `contract-anchor.pw.ts:1026` (the base-rule case).
- Records: `deferred-work.md` DW-43 (L3097), DW-44 (L3152), DW-71 (L4188), DW-76 (L4375), DW-95
  (L5026), DW-102 (L5325), the dot entry (L2298), the new-tab entry (L2393);
  `ops/hub-accessibility-pass.md` headline rows, § The accent share, F-13, F-15, F-20, § Decisions,
  § Stated limits, Pending row 3; `ops/hit-target-floor.md` § The surfaces swept (read, never
  computed); `ops/rendered-output-harness.md` rows for the four touched spec files;
  `DESIGN.md` § Components; `EXPERIENCE.md` A-10; `review-rubric.md:40`.

## Tasks & Acceptance

**Execution:**
- [x] Tests first, each run red on the baseline: the unit and e2e cases below.
- [x] `Header.tsx`, `app/page.tsx` and the four pages: the skip link and the landmarks.
- [x] `app/app.scss`: the landmark ring, the F-11 pair, the comments.
- [x] `WorkItem.scss`: the scripting rule. `SuiteDirectory.tsx` and `.scss`: the glyph and names.
- [x] `ops/__tests__/accent-fill.test.ts`: the F-8 check with its fixture.
- [x] `accessibility-floor.pw.ts`: the landmark read on every surface, the ring-scan exception,
  the `url(` count and its plant. `contract-anchor.pw.ts`: the F-11 read and its control.
  `cv.pw.ts` inverted with a scripting-on control. `suite-directory.pw.ts`: the glyph and names.
  `secondary-surfaces.pw.ts`: the hidden skip link. `hit-target-floor.pw.ts`: pins read off the run.
- [x] Records and planning notes per the Code Map; anything out of scope filed as a new DW entry.
- [x] Verify: typecheck, the full unit suite, the literal gate, the build and
  `node ops/asset-budget.mjs` with a dated reading if bytes move, the unfiltered container run.

**Acceptance Criteria:**
- Given the baseline tree, when the new cases run, then each fails for the reason it names.
- Given the final tree, when typecheck, `corepack pnpm test --run`, `node ops/literal-conformance.mjs`,
  the build and the unfiltered container e2e run execute, then all pass.
- Given the pinned image, when a keyboard visitor presses Tab then Enter on `/`, `/work`, `/cv` and
  the 404, then focus lands on `main#main` and its ring is inside the box on all four sides.

## Spec Change Log

- **Review, 2026-09-24, loop 0.** No subagent could be spawned in this session, so the six layers
  ran inline, as the Operator's authorisation of a sub-agent reviewer allows. No intent gap and no
  bad-spec finding. Patches: `Header.tsx` had been rewritten with LF over an index copy in CRLF, so
  every line showed changed (restored to CRLF, eleven lines move); the glyph had landed as literal
  characters where Design Notes 4 says an escape (rewritten as the escapes of U+2197 and U+FE0E, a
  tool having decoded them on the way in); six comments still said `Header.tsx:12` returns `null` on `/`
  (corrected, with the line); the accent-fill listing would have thrown on a stylesheet deleted but
  not yet staged (skipped, as the literal gate skips it); and the scriptless case pinned four
  companies and reported closed panels by the filtered index (derived and fixed). Deferred with
  evidence as DW-127, found by the manual check: on `/`'s default door at 768 and wider the hero's
  canvas and scrim, positioned inside `<main>`, paint over the landmark's inset outline, so the
  ruled rule cannot show it there; the rule's comment says so rather than claiming "whole on every
  route". Rejected: the ponytail layer's finding that the accent-fill test re-lists the tree rather
  than importing the literal gate's listing (the gate exports its scan, not its listing, and
  exporting one would change a gate module for a test). The design layer approved: the mark takes
  the link's own colour, no motion was added, and every hover stays gated. Nothing was re-derived.
- **Verifier rejection, 2026-09-24, fix round 1.** The independent verifier failed stage 2 on ruling
  (7): the new-tab ledger entry, the one without an id that begins "Every Suite Directory link opens
  a new tab", held two `status` keys. `87031fd` wrote its closing paragraph and `status: done` above
  the entry's original `status: open` rather than in its place, as the commit's six other closures
  did, so the entry was a duplicated YAML key whose last value read open and a grep for
  `status: open` still found it, though the package reported it closed. The stale line is deleted
  and the entry closes with one `status: done`, as Boundaries requires. Checked: no ledger entry now
  holds two `status` lines, and js-yaml over every entry, its backticked `source_spec` read as a
  plain scalar, finds no duplicated key where at `87031fd` it refused this one; the six entries it
  cannot parse are the same six at `4a7d1b5`. No check was added: no suite reads the ledger, and
  its shape belongs to the package that gives every entry an id and a status in place (Operator
  ruling 2026-09-24, Epic 1 retrospective item 8). Records only, so no rendered output moved. On
  this tree: typecheck exit 0, `corepack pnpm test --run` 60 files and 1,565 passed, the literal
  gate exit 0, the build exit 0, `node ops/asset-budget.mjs` exit 0 with no measured input dirty
  and the filed reading's bytes unchanged, and the unfiltered container run 338 passed and 0 failed
  in 5.9 minutes, no snapshot written. Nothing was re-derived.
- **Verifier rejection, 2026-09-24, fix round 2.** The independent verifier passed every local stage
  on `44e4a7a` and pushed it, `dev` moving from `4a7d1b5` as a fast-forward, but could not read the
  push's CI run, 35991172984: the permission system denied `gh run watch`, so no conclusion was
  observed and the verdict could not pass. It named no defect. This round read the run with
  `gh run view 35991172984 --json status,conclusion,jobs`, which only reads: completed, conclusion
  success, head `44e4a7a` on `dev`, and all seven jobs success (`literal-conformance`,
  `contract-purity`, `tokens-contract`, `fonts-contract`, `registry-schema`, `test` with 60 files
  and 1,565 passed, `rendered-output` with 338 passed in 5.8 minutes), the tallies the local runs
  gave. Nothing in the package changed; this entry is the round's only edit. On this tree:
  typecheck exit 0 and `corepack pnpm test --run` 60 files and 1,565 passed. No container run:
  nothing rendered moved, and CI's `rendered-output` job ran the harness in the pinned image on
  `44e4a7a`, which this edit leaves unchanged but for this file. Nothing was re-derived.

## Design Notes

Assumptions, resolved unattended in the stated order:

1. **`/` takes its skip link from `Header` too.** The ruling moves the link "into the Header"
   and keeps `/`'s landmark; A-6 needs one on `/`. `Header` renders it alone there, so there is
   one call site and `/`'s DOM is what it was (`EXPERIENCE.md` A-6).
2. **The landmark ring restates the ring and insets it by its own width**:
   `outline-offset: calc(-1 * var(--stroke-focus))`. The `-1` is a sign, not a length. The
   exception is recorded where "verbatim" is claimed, `app/app.scss` and
   `ops/hub-accessibility-pass.md`; `RESTYLE-SPEC.md` binds Satellites and stays untouched.
3. **The F-8 check compiles every tracked `.scss` with Sass**, so a mixin, nesting or a variable
   is read as the selector that ships (`HomeLayout.scss` builds selectors in a mixin), and reads
   `.css` as written. An exemption unused, or used twice, fails.
4. **The glyph is the north-east arrow, U+2197**, the mark `mockups/key-screens.html` and
   `review-accessibility.md:215` draw, followed by U+FE0E so no platform paints it as an emoji
   (`RESTYLE-SPEC.md` § Icons: "Never an emoji"). It takes the link's own colour and type after its
   underline: `DESIGN.md` § Colors → Rules keeps accent to underlines, the `Live` mark and the
   active nav rule. The contract's latin subset does not carry U+2197, so it paints from the
   fallback stack. Written as an escape in source and by name in prose. The name is an
   `aria-label` beginning with the visible label (WCAG 2.5.3), the source keeping A-10's prefix.
5. **The `url(` tell counts every `url(` outside `@font-face`.** In built CSS any other `url(` is
   a painted image, and the ruling names the faces as the one exclusion. Zero today.
6. **The scriptless rule lives in `WorkItem.scss`**, the component's own sheet, with the two
   declarations `_print.scss` uses. The F-11 read goes beside the base-rule case in
   `contract-anchor.pw.ts`, both being global rules of `app/app.scss`.

## Verification

**Commands:**
- `corepack pnpm typecheck`, `corepack pnpm test --run`, `node ops/literal-conformance.mjs`,
  `corepack pnpm build`: exit 0 each.
- The pinned container run of `pnpm test:e2e`, no filter: every case passes.

**Manual checks:**
- Screenshots from the pinned image after Tab and Enter on `/` (both doors), `/work` and `/cv`:
  the landmark's ring visible on four sides.

**As run, 2026-09-24:**
- Red on the baseline tree before any code moved: `corepack pnpm vitest --run` over the touched
  unit suites, 18 failed, each for its reason (the header rendering nothing on `/` and no link in
  its band, `/`'s fragment still `A, MAIN, FOOTER`, `/cv`'s landmark with no id, no scriptless rule
  in the compiled sheet, the Directory's names and marks absent, the `::selection` exemption finding
  no fill). In the pinned image, the five touched e2e files: 6 failed and 54 passed, the landmark
  case naming `/work`, `/cv`, `/celeste` and the 404 and on `/` the ring at `3px`, clipped on the
  top, left and right by `0.00px of 5px` (F-20 as recorded), the root reading `normal`, `/cv` and
  `/work` scriptless at `900.30, 0, 0, 0`, `/celeste`'s header holding no skip link, and every
  Directory link carrying no mark and no new-tab name. The `url(` case, test-only, was run red in the
  pinned image with the tally's counting lines taken out, then green with them.
- One commit per ruling, each verified before it was made on a tree equal to it: `1af8569` typecheck
  exit 0; `ddb63b7` typecheck, 59 files and 1,559 passed, literal gate exit 0; `81f4078` 60 and
  1,563; `1b4fe66` 60 and 1,564; `786e676` 60 and 1,565, each with typecheck and the literal gate
  exit 0.
- The first unfiltered container run, on the working tree before the commits: 334 passed, 4 failed,
  each a consequence measured and fixed (the `/cv` edge read's 0.02px rounding, the minifier's
  `light-dark()` pair on `:root`, the hit-target pins, the `/celeste` link reader counting the skip
  link's own fragment). The four files alone then passed 51 of 51.
- `corepack pnpm build` exit 0 (`L2hNkdPY-jdd0Lk0BmfNZ` at `786e676`); `node ops/asset-budget.mjs`
  exit 0 with no measured input dirty, the reading filed (`ops/asset-budget.md`), every served route
  heavier by 376 to 679 gzipped, the narrative bundle unchanged.
- The final unfiltered container run, on `786e676`: 338 passed, 0 failed, 5.8 minutes, no snapshot
  written and the `/work` baseline unmoved (`93a1aa4e...`, last written by `31f4664`).
- The screenshots, pinned image, after Tab and Enter: the ring's pixels read the focus colour,
  `rgb(198, 189, 255)`, on the top, left and right edges on `/` at 360 on both doors and on `/work`,
  `/cv` and the 404 at 360; on `/`'s default door at 1280 they read `rgb(29, 27, 39)`, the ring under
  the hero's scrim (DW-127). The bottom edge is below the fold in each shot; the e2e geometry read
  holds it unclipped.
- After the records, on the final tree: `corepack pnpm typecheck` exit 0, `corepack pnpm test --run`
  60 files and 1,565 passed, `node ops/literal-conformance.mjs` exit 0.

## Suggested Review Order

**A skip link and a landmark on every route (DW-43, DW-71, F-13)**

- Entry point: the header renders the skip link first, in the band or, on `/`, alone
  [`Header.tsx:18`](../../components/molecules/Header/Header.tsx#L18)

- The band's first child, so `/celeste`'s hidden band hides it with the rest
  [`Header.tsx:20`](../../components/molecules/Header/Header.tsx#L20)

- The landmark each route gained, focusable by script and never a Tab stop
  [`page.tsx:21`](../../app/work/page.tsx#L21)

- `/cv`'s bare landmark given the id the link targets
  [`page.tsx:44`](../../app/cv/page.tsx#L44)

- Every route: one `main#main`, the first Tab on the link, Enter onto the landmark
  [`accessibility-floor.pw.ts:1380`](../../tests/e2e/accessibility-floor.pw.ts#L1380)

**The landmark's ring drawn inset (F-20)**

- The one deliberate exception to § 4 verbatim, from the two roles, no length
  [`app.scss:54`](../../app/app.scss#L54)

- The standard ring but its offset, and no side clipped
  [`accessibility-floor.pw.ts:768`](../../tests/e2e/accessibility-floor.pw.ts#L768)

- The document's edge read off the root's unrounded box, once reach can be zero
  [`accessibility-floor.pw.ts:682`](../../tests/e2e/accessibility-floor.pw.ts#L682)

- The one-ring scan admits that selector in that file alone
  [`accessibility-floor.pw.ts:99`](../../tests/e2e/accessibility-floor.pw.ts#L99)

**Colour scheme and selection (DW-95, F-15)**

- The scheme on its own `:root`, the accent selection under `--token-bg` text
  [`app.scss:64`](../../app/app.scss#L64)

- Read as computed style against the roles, beside a planted control
  [`contract-anchor.pw.ts:1075`](../../tests/e2e/contract-anchor.pw.ts#L1075)

- The minifier's `light-dark()` pair admitted only beside the scheme
  [`anchor-aliases.pw.ts:139`](../../tests/e2e/anchor-aliases.pw.ts#L139)

**No accent fill (F-8)**

- Two exemptions, each a file and an exact selector, each found once
  [`accent-fill.test.ts:47`](../../ops/__tests__/accent-fill.test.ts#L47)

- Declarations read with their shipped selector, strings and comments masked
  [`accent-fill.test.ts:73`](../../ops/__tests__/accent-fill.test.ts#L73)

- The fixture: a fill in every shape Sass can hide one
  [`accent-fill.test.ts:159`](../../ops/__tests__/accent-fill.test.ts#L159)

**The whole CV without script (DW-76)**

- The print sheet's two declarations under `scripting: none`
  [`WorkItem.scss:150`](../../components/atoms/WorkItem/WorkItem.scss#L150)

- Inverted: every panel open on both routes, a scripted context the control
  [`cv.pw.ts:539`](../../tests/e2e/cv.pw.ts#L539)

**Links that say they open a new tab (ledger entry)**

- The mark, escaped, hidden, one element shared by both links
  [`SuiteDirectory.tsx:58`](../../components/organisms/SuiteDirectory/SuiteDirectory.tsx#L58)

- Each name starts with its visible label and ends with the fact
  [`SuiteDirectory.tsx:149`](../../components/organisms/SuiteDirectory/SuiteDirectory.tsx#L149)

- Painted after and clear of the underline, in the link's own type
  [`suite-directory.pw.ts:618`](../../tests/e2e/suite-directory.pw.ts#L618)

**A `url(` grain can no longer return unseen (DW-102)**

- Every `url(` outside `@font-face`, counted as a depth tell
  [`accessibility-floor.pw.ts:866`](../../tests/e2e/accessibility-floor.pw.ts#L866)

- A planted grain beside a planted face, two counted
  [`accessibility-floor.pw.ts:1562`](../../tests/e2e/accessibility-floor.pw.ts#L1562)

**Peripherals**

- The skip link as the band's first child, and alone on `/`
  [`Header.test.tsx:47`](../../components/molecules/Header/__tests__/Header.test.tsx#L47)

- The hidden band takes the link with it on `/celeste`
  [`secondary-surfaces.pw.ts:577`](../../tests/e2e/secondary-surfaces.pw.ts#L577)

- Pins moved by the read, one per surface with a header
  [`hit-target-floor.pw.ts:130`](../../tests/e2e/hit-target-floor.pw.ts#L130)

- The global stylesheet's one new role
  [`anchor-contract.test.ts:228`](../../app/__tests__/anchor-contract.test.ts#L228)

- The compiled scriptless rule held to the print sheet's
  [`WorkItem.test.tsx:600`](../../components/atoms/WorkItem/__tests__/WorkItem.test.tsx#L600)

- Markup and names, beside a planted link with neither
  [`SuiteDirectory.test.tsx:157`](../../components/organisms/SuiteDirectory/__tests__/SuiteDirectory.test.tsx#L157)

- The ledger: DW-43 closed, and DW-127 filed for the hero's layers
  [`deferred-work.md:3178`](deferred-work.md#L3178)

- F-20 annotated closed, the dimmed place stated
  [`hub-accessibility-pass.md:442`](../../ops/hub-accessibility-pass.md#L442)

- The skip controls' design row
  [`DESIGN.md:720`](../planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md#L720)

- The asset-budget reading: every served route 376 to 679 heavier
  [`asset-budget.md:484`](../../ops/asset-budget.md#L484)
