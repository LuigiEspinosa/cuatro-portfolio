---
title: 'Story 2.30: Redesign `Error404` token-native'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_commit: '2eb0aa0bbd161553426bcca190b7ae9ffdcc6a11'
review_loop_iteration: 0
warnings: ['oversized']
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** The 404 is the last Hub surface still painted from 2023 literals and driven by GSAP: a
`#0a000f` ground under a two-gradient grid, a bare `z-index: 2`, exits that read four aliases and
carry an invalid transition (F-6, DW-80) and an ungated hover, three `gsap.from` tweens (two of them
spatial) that ignore reduced motion (DW-77, review A-2), a numeral off the type scale carrying
`aria-label` on a `<p>` (O-13, F-12), a Plate mark label that is decoration read aloud
(`// ERR_NOT_FOUND`), no `<h1>` at all (F-18), and a full-viewport centred composition.

**Approach:** Rebuild `Error404` as a server component on the documents' structure (a section Plate
mark, the display entrance as the one `<h1>`, one secondary line, the header's exits as controls),
run the redundancy test and take branch A with the numeral `aria-hidden`, write `Error404.scss`
against `contracts/tokens.css` alone with a CSS opacity entrance, and close the three ledger rows,
the findings and the deferred items this story owns in the same change.

## Boundaries & Constraints

**Always:**

- `Error404.scss` reads `--token-*`, `--f-*`, `--t-*`, `--w-*`, `--lh-*`, `--tr-*`, `--s-*`,
  `--stroke-*`, `--dur-*`, `--ease-*`, `--measure`, `--page-pad` and `--tap` from the contract and
  nothing else: no alias, no colour, length or type literal, no `rgba()`, gradient, shadow,
  `z-index` or `outline`, and no custom property of its own. The three `animation-delay` values are
  plain `ms` literals, the Story 2-29 precedent, because the contract mints no delay role.
- No `.tsx` names a contract token or the path `contracts/`, and no source names a published family,
  comments included (`app/__tests__/anchor-contract.test.ts` reads raw text).
- Every `:hover` inside `@media (hover: hover)`; no `:active`; no `transition: all`, the one
  transition being `border-color`; only `opacity` animates.
- The exits stay `DESTINATIONS` rendered as `.error-page a[href]` inside `.error-page__exits`: equal
  to `nav.navbar a` on the same page, at or above `--tap` on both axes, `--s-lg` apart, none marked
  current. `/recommendation` still answers this document. `.error-page` and `.error-page__code`
  (text `404`) keep their names, because four specs key on them.
- Anything read about the 404 in a browser keys on `.error-page` markup, never on `<body id>`,
  which differs between the prerender and the client (`AGENTS.md` pitfalls).
- Every ledger row, finding and register count this story closes moves in the same commit as the
  repair, in every file that holds it; `Error404.test.tsx` keeps its no-`.scanline-overlay` read,
  which DW-102 names as one of the two things catching a returning overlay.

**Ask First:**

- Editing `contracts/`, `GlitchText`, `PlateMark`, `Navbar` or `DESTINATIONS`, `Header`, the chrome
  stylesheets (Story 2-32), or `app/app.scss` beyond removing the `.error-page__back` scope.
- Rewording any visible string beyond the label, the title's casing and the line's apostrophe.
- Regenerating the `/work` baseline: this story must not move it.

**Never:**

- No new dependency; GSAP leaves this component and stays installed for the others.
- No scrim, no ground but `--token-bg`, no grid, no filled or rounded control, no shadow, no
  full-viewport centring, no bounce, overshoot, gesture or scroll-triggered motion, and no opacity
  expressing state.
- No `eslint` invocation and no lint criterion.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Arrival | Any unrouted path, `/recommendation` included | 404; `.error-page` renders, in DOM order: section Plate mark `ERROR`, `aria-hidden` numeral `404`, `<h1>` `Page not found.`, one secondary line, exits `Suite` then `CV`; title `Page not found \| Luigi Espinosa` | N/A |
| Redundancy test | Numeral removed from the tree, accessible output read top to bottom | The title, the heading and the message each say the page was not found: branch A | N/A |
| Redundancy control | Title, heading and message planted to say nothing of it, numeral removed | The same read reports branch B | N/A |
| CSS off | Every stylesheet disabled | The label reads `ERROR`, uppercase, no `//` and no `_`; the numeral is absent from the tree | N/A |
| Reduced motion | `prefers-reduced-motion: reduce` | Numeral, line, exits and heading characters compute `animation-name: none` at full opacity at the first read | N/A |
| Motion allowed | `no-preference` | Numeral, line and exits each run one `error-page-enter` on opacity at `--dur-minor` on `--ease-entrance`, delays 100, 300 and 500ms; the heading runs the display entrance from 300ms; nothing translates | N/A |
| No script | Every `_next/static/chunks/*.js` aborted | The whole surface present at full opacity | N/A |
| Hover, fine pointer | Pointer over an exit | Its border computes `--token-accent-hover`; only border pixels differ from rest | N/A |
| Tap, touch | `(hover: none)`, tap an exit | No `border-color` transition starts and the hover role is never computed | N/A |
| Keyboard | Tab to each exit, then click one | The standard ring, `--stroke-focus` solid `--token-focus` at `--focus-offset`, at full strength the frame focus lands; a click paints none | N/A |
| 360 viewport | The 404 at 360 x 800 | No element past either viewport edge; exits wrap rather than overflow | N/A |

</frozen-after-approval>

## Code Map

**The component** (graphify `affected Error404`: `app/not-found.tsx:2`,
`Error404.test.tsx:2`, `not-found.test.tsx:1`; its imports `PlateMark.tsx`, `Navbar.tsx`
`DESTINATIONS`, `useGsapContext.ts`, `gsap`)

- `components/organisms/ErrorPage/Error404.tsx` (85 lines): rewritten. `:1` `'use client'`, `:6-7`
  the hook and `gsap` imports and `:34-55` the three tweens go; `:62` the annotated mark, `:64-66`
  the named `<p>`, `:68-71` the message pair and `:73-79` the exits are rebuilt; `:10-32` docblock
  rewritten. Server component afterwards (`Navbar.tsx` has no client directive, so `DESTINATIONS`
  imports as a value).
- `components/organisms/ErrorPage/error-page.scss` (92): deleted. `Error404.scss` written beside the
  component, the 2-27 precedent for a rebuilt 2023 lowercase file (`AGENTS.md` naming rule).
  Literals leaving: `:7` ground, `:9-11` grid, `:19` `z-index`, `:20` `--page-padding`, `:24-30`
  `--monument-bold` and the clamp, `:40-42` `--monument-regular`, `--light-gray-color`, `:47-48`
  `--gray-color`, `:55-59` `--font-mono`, `--accent-dim`, `:71-74` the invalid transition and
  tracking, `:76-79` the ungated hover.
- `components/molecules/GlitchText/GlitchText.tsx` (read-only): the display entrance, `tag='h1'`
  default, `delay` in seconds; `EXPERIENCE.md:447-448` names it the error surface's heading.
- `components/molecules/PlateMark/PlateMark.tsx` (read-only): section variant is the default arm,
  `label` uppercased, optional `domain`.
- `app/not-found.tsx:9`: title `Page not Found` to `Page not found`. `app/__tests__/not-found.test.tsx:20`.
- `components/organisms/ErrorPage/__tests__/Error404.test.tsx` (127): rewritten; the gsap mock
  goes, the exits' three cases stay in shape, the splice needle `:115` moves.

**The alias layer, which loses its last boundary and its last display sites**

- `app/app.scss:82-87`: the `.error-page__back` scope deleted, the comment above it amended.
- `app/__tests__/anchor-contract.test.ts:322` `TOKEN_NATIVE_STYLESHEETS` entry and its comment
  `:315-321`; `:1030-1033` `scopedValues` and `:1073-1079` scoped selectors become `[]`.
- `tests/e2e/anchor-aliases.pw.ts`: `CALL_SITES` row `:347-350` and counts `:366-367` (2 to 1,
  boundaries 1 to 0), messages `:482-484`; `WEIGHT_SITES` `:379-384` (2 to 1); `DISPLAY_REGULAR_SITES`
  `:408-411`, the clamp case `:762-819` and `publishedWeightRange` `:419-432` become a zero-call-site
  pin in the `--confillia-normal` shape `:549-552`; comment `:842`.
- `tests/e2e/harness.ts:41-45`: the `--monument-bold` count note.

**Pins that move with the surface**

- `tests/e2e/plate-mark-and-work-item.pw.ts:304` the 404 row becomes `section`; `:436` the
  subordinate-line loop drops `NOT_FOUND`; `:510-519` the CSS-off read's 404 exception becomes a
  planted `//` cell; header docblock.
- `tests/e2e/type-swap.pw.ts:156-163`: the 404's display sites `.error-page__code` and `.glitch-text`.
- `tests/e2e/secondary-surfaces.pw.ts:635-637`, `:825-827`; `tests/e2e/celeste-header.pw.ts:155`:
  comments only (the tween, the measured title, a stale citation).
- `tests/e2e/error-surface.pw.ts`: new, every browser criterion (Tasks).

**The ledger and its records** (held equal by `ops/__tests__/hub-accessibility-pass.test.ts`)

- `tests/e2e/accessibility-floor.pw.ts:205-212,221-228,237-244` delete `z-error-content`,
  `gradient-error-ground`, `heading-404`; comment `:1438-1442`.
- `ops/hub-accessibility-pass.md`: ledger rows `:328,330,332`; headline rows `:32,35,36,38`; grounds
  table `:146`; paragraphs `:359-376`; F-6 `:390`, F-11 `:395`, F-12 `:396`, F-18 `:402`, closed in the
  F-8 shape (annotated, never deleted).
- `ops/known-violations.md` KV-6: index row `:67`, heading `:472`, counts `:474-497`, breach `:518`,
  booking `:524`, retired-by `:526`; counts spelled (`two`, `two`, `one`, `zero`, `zero`), closers
  `2-32` and `2-33` only.
- `ops/rendered-output-harness.md:47,56,58,60` dated clauses, and a row for the new spec file.
- `ops/anchor-token-adoption.md:503-511,543-549,566-569,736`: dated notes, tables kept as taken.
- `ops/asset-budget.md:471` a reading after Story 2-30, and a run under § Findings `:1156`.
- `_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/EXPERIENCE.md:1058` O-13's
  `Error404` half closed, the 2-27 precedent on the same row.
- `_bmad-output/implementation-artifacts/deferred-work.md`: DW-77, DW-80 close; DW-81 gets a dated
  count; a new entry for the copy (Design Notes).

**Read-only evidence gathered during planning**

- The before build at `2eb0aa0` (`gx6qgwAvuy7LjkwmJMVxX`) reproduces Story 2-31's after figures
  exactly: 21 `.js`, 11 `.css`, 2,033,913 on disk, 618,565 gzipped, `.css` 27,857 and 8,308. The 404's
  own chunks are `0i9pf4zw4lx2x.js` (2,332 and 885, carrying `gsap`) and `0ngdt25qujsn2.css` (1,342
  and 558).
- The 404 title today is `Page not Found | Luigi Espinosa` and Story 2-17 asserts it distinct from
  the other four surfaces (`secondary-surfaces.pw.ts:773-820`), so A-13 already holds for this route.
- `hit-target-floor.pw.ts:1380-1420` requires the 404 to carry nothing past either edge at 360.

## Tasks & Acceptance

**Execution** (in this order, on `dev`):

- [x] Before any edit: `corepack pnpm build && node ops/asset-budget.mjs` and every chunk gzipped at
      level 9, saved to the scratchpad as the before reading (done at planning, figures above).
- [x] `Error404.tsx`, `Error404.scss` (delete `error-page.scss`), `app/not-found.tsx`: the structure,
      values and entrance Design Notes state.
- [x] `Error404.test.tsx`: structure and order, one `<h1>`, the numeral hidden and unnamed, no name on
      any element, the label's words, the exits (kept), no overlay (kept), no GSAP or client
      directive in the source, and the compiled-CSS guards; see the guards fail on the 2023
      `error-page.scss` compiled the same way first. `not-found.test.tsx` title.
      *(As executed: the new file ran against the 2023 component with the 2023 stylesheet copied
      to `Error404.scss`, and sixteen of its nineteen cases failed, every guard among them; the three
      that passed were the exits' equality, its control and the planted-literals control.)*
- [x] `app/app.scss` scope, `anchor-contract.test.ts` (see claim four fail naming `Error404.scss`
      with the path unlisted first), `anchor-aliases.pw.ts`, `harness.ts`.
      *(As executed: removing the scope added lines above `body#work`, so the `gradient-work-ground`
      citation moved from `app/app.scss:136-137` to `:140-141` in the ledger, the record and
      `ops/rendered-output-harness.md`; `hub-accessibility-pass.test.ts` reads those lines off disk.
      `WEIGHT_SITES` is typed rather than `as const`, because one literal route made the loop's 404
      branch a comparison `tsc` refuses.)*
- [x] `plate-mark-and-work-item.pw.ts`, `type-swap.pw.ts`, `secondary-surfaces.pw.ts`,
      `celeste-header.pw.ts`.
- [x] `tests/e2e/error-surface.pw.ts`: every browser criterion below, each with a planted control
      that makes the reading fail.
      *(As executed: the first container run failed one case, the entrance's duration, because the
      test compared the element's `0.22s` with the token stream's `220ms` divided by a thousand; both
      roles are read through a probe now, in the element's own serialisation.)*
- [x] Ledger and records: the three `accessibility-floor.pw.ts` rows, `hub-accessibility-pass.md`,
      `known-violations.md`; `corepack pnpm test --run ops/__tests__/hub-accessibility-pass.test.ts`
      seen failing on the unmoved KV-6 heading first.
      *(As executed: seen failing three ways in turn: the record and the literal disagreeing on the
      three rows, the index row naming a closer no row has, and a dotted story id this story wrote.)*
- [x] Branch build: `corepack pnpm build && node ops/asset-budget.mjs`, the same chunk weights, the
      `ops/asset-budget.md` reading and run against Story 2-2's 140,000 and Story 2-31's reading.
      *(As executed: the same component was also built with a client directive to weigh the one
      real alternative; the server component is lighter on every route, Design Notes.)*
- [x] Container `pnpm test:e2e`, no filter, green; census and readings into the records.
- [x] `EXPERIENCE.md` O-13, `ops/` notes, `deferred-work.md`; `corepack pnpm typecheck`;
      `corepack pnpm test --run`; commit.

**Acceptance Criteria:**

- Given the 404 at 360, when `.error-page`'s aria snapshot is read, then its top-level roles are
  exactly text, heading, paragraph, link, link (mark, display line, one line, two exits), the page
  carries one level-1 heading named `Page not found.`, the numeral is not in the snapshot, and no
  element in the surface carries `aria-label` or `aria-labelledby` (O-13, corrected as pre-existing).
- Given the numeral removed from the tree, when the title, the heading and the message are read,
  then each says the page was not found, so branch A holds and is recorded; a planted page saying
  none of it reads as branch B through the same predicate.
- Given the numeral, when read, then it carries `aria-hidden="true"` and no name, computes
  `--token-accent-muted`, the display family at `--w-black`, and `--t-xl` exactly.
- Given the heading, when read, then it computes the display roles (`--f-display`, `--t-display`,
  `--w-black`, `--lh-display`, `--tr-display`, uppercase, `--token-text`); the line computes
  `--token-text-secondary` at `--t-sm`, at most `--measure` wide.
- Given the mark, when read, then it is the section variant (class list exactly `plate-mark`), one
  cell reading `ERROR`, no `//`, no `_`, ruled beneath in `--token-border`.
- Given the surface, when its ground is sampled across its top padding, then every pixel equals
  `--token-bg` rasterised, no ancestor paints a `background-image`, and no `.scanline-overlay`
  exists; the old grid planted back makes the strip non-uniform.
- Given each exit, when read, then its ground is transparent, its border 1px solid
  `--token-border-interactive` on four sides, radius `0px`, label in the mono family at `--t-2xs`,
  uppercase, `--tr-label`, `--token-text`, and its box at or above `--tap` on both axes.
- Given a fine pointer over an exit, when rest and hover captures are diffed, then only pixels on
  the border's ring differ and the border computes `--token-accent-hover`; given `(hover: none)`,
  when an exit is tapped, then no `border-color` transition starts.
- Given Tab reaching each exit, when its ring is read, then `:focus-visible` matches and it
  computes `--stroke-focus` solid `--token-focus` at `--focus-offset` with no transition naming
  `outline` or `all` over a duration; given a mouse click on an exit, then no ring is painted.
- Given `no-preference`, when the entrance runs, then numeral, line and exits run `error-page-enter`
  (opacity only) at `--dur-minor` on `--ease-entrance` at 100, 300 and 500ms and the heading's
  characters their display entrance from 300ms; given `reduce`, every one computes `animation-name:
  none` at full opacity at the first read; given every script aborted, everything is at full
  opacity.
- Given the built CSS, when `accessibility-floor` sweeps, then the ledger carries no
  `z-error-content`, `gradient-error-ground` or `heading-404`, every route carries one level-1
  heading, and `hub-accessibility-pass.test.ts` passes with KV-6 reading two, two, one, zero and zero
  and closers 2-32 and 2-33.
- Given the before and after builds, when `ops/asset-budget.md` is read, then a dated reading gives
  the `.css` and `.js` gzipped totals on both sides, the Derived delta against Story 2-31's reading
  and the non-3D line against Story 2-2's 140,000.
- Given `corepack pnpm typecheck`, `corepack pnpm test --run` and the container `pnpm test:e2e`, when
  run, then every file passes and the `/work` baseline is unchanged.

## Spec Change Log

## Design Notes

Each resolution is an assumption taken from the documents in precedence order: `DESIGN.md` values,
`EXPERIENCE.md` behaviour, `RESTYLE-SPEC.md` geometry and anything neither states.

**Markup**, a server component (nothing client-side remains):

```tsx
<div className='error-page'>
  <PlateMark label='Error' />
  <p className='error-page__code' aria-hidden='true'>404</p>
  <GlitchText text='Page not found.' delay={0.3} />
  <p className='error-page__sub'>The page you’re looking for does not exist.</p>
  <div className='error-page__exits'>{/* DESTINATIONS as Link.error-page__exit */}</div>
</div>
```

**The display line is the display entrance.** `EXPERIENCE.md:447-448` names `GlitchText` "the
homepage and error-surface heading", and `DESIGN.md:730` gives its values, so the `<h1>` reuses it
rather than restating the display roles here; its CSS entrance and reduced-motion rule come with it.

**Branch A, made true by the title.** The test is run by `error-surface.pw.ts`. The title already
distinguished the route before this story (A-13, asserted by Story 2-17), and the message says it;
the rebuild adds the heading. The title's `Page not Found` is set in sentence case because 2-17's
docblock booked the title to this story and the casing reads unfinished; recorded as the title fix
the criterion prefers. The numeral is therefore `aria-hidden`, unnamed, in `--token-accent-muted`.

**The numeral at `--t-xl`.** `DESIGN.md`'s scale gives `--t-xl` the role "Secondary display" and
reserves `--t-display` for the one display line; the numeral is secondary to the heading, and at
31px it sits under the heading's 36px floor at every width. Display family, `--w-black`,
`--lh-display`, `--tr-display`; the reset in `app/app.scss` already takes every margin off.

**The label is `Error`, section variant, no domain.** `EXPERIENCE.md` § Plate mark asks for plain
words; `ERR` is the word the code abbreviates, `NOT_FOUND` is what the heading already says (the
story's "say one thing once"), and a `404` domain would state the numeral a third time. The
annotated sub `// SIGNAL_LOST` retires with the variant. No document supplies the words, so the
choice is filed for the Operator with the supporting line (below).

**The supporting line keeps its words.** It restates the heading, and no document supplies a string
for it; changing copy is the Operator's, so it stays verbatim, with the apostrophe typeset
(`DESIGN.md` § Typography rules govern what the product renders), and a DW entry records the
restatement and the label choice. Body family inherited, `--t-sm`, `--lh-body`, `--tr-body`,
`--token-text-secondary`, `max-inline-size: var(--measure)`.

**Composition, not centred.** `EXPERIENCE.md:1021` excludes the full-viewport centred hero ("hero
height follows content; display type is left-biased") and `epics.md:3056` makes it a floor, so the
2023 `min-height: 100dvh` and centring go and the mock's centred render loses. `.error-page` is a
grid (page structure, `DESIGN.md` § Layout) at `gap: var(--s-md)`, `padding-block: var(--s-2xl)
var(--s-3xl)`, `padding-inline: var(--page-pad)`, start-aligned text; children stretch, so the
mark's rule runs the content width. It paints no ground: `body` already paints `--token-bg` there,
and a second paint of the same role is nothing to assert.

**Exits are controls** (`RESTYLE-SPEC.md` § 1, `DESIGN.md` § Border and stroke treatments):
`display: inline-flex; align-items: center; min-block-size: var(--tap); min-inline-size: var(--tap);
padding-block: var(--s-xs); padding-inline: var(--s-md)`, `border: var(--stroke-boundary) solid
var(--token-border-interactive)`, mono `--t-2xs`, `--lh-label`, `--tr-label`, uppercase,
`--token-text`, no underline, `transition: border-color var(--dur-micro) var(--ease-toggle)`;
`@media (hover: hover)` recolours the border to `--token-accent-hover`. No `border-radius` is
declared: the initial `0` is square at rest, and the global ring rule's `--r-hair` is the ring
radius § 4 asks for. The class becomes `error-page__exit`, retiring the 2023 `__back` (the
Story 2-17 docblock's own forecast); the wrapper keeps `flex-wrap: wrap` and `gap: var(--s-lg)`.

**The entrance** replaces the three tweens with one keyframe, the preferred form of the criterion:

```scss
@keyframes error-page-enter { from { opacity: 0; } }
.error-page__code { animation: error-page-enter var(--dur-minor) var(--ease-entrance) 100ms both; }
// .error-page__sub 300ms, .error-page__exits 500ms; @media (prefers-reduced-motion: reduce): none
```

The delays keep the shipped sequence (numeral, message, exits); the heading enters at the message's
300ms. The translates go (`DESIGN.md:734`: no offset in an entrance). No ancestor of the heading
animates (the Story 2-29 finding about a ramping parent).

**The alias layer.** The exits were the last `--accent-dim` boundary, so `app/app.scss` scopes it
nowhere and the mapping's boundary half has no subject until Story 2-22 deletes the layer.
`--monument-bold` keeps one call site (`WorkHero.scss:19`) and `--monument-regular` none: pinned at
zero in the `--confillia-normal` shape, the clamp case leaving with the last site it protected.

**A server component, measured against the client one rather than assumed** (found in the branch
build). The root layout's not-found boundary travels in every route's flight payload, so a server
404 inlines its rendered tree into every document (`/cv` 365 gzipped heavier) and its stylesheets
are preloaded everywhere, where a client 404 travels as a reference whose chunk every route loads.
The same component with a client directive weighed 510 gzipped heavier on `/cv`, 533 on `/work`, 543
on `/celeste` and 425 on the 404, so the server form stays. `ops/asset-budget.md` carries both.

**The redundancy test, as run** (`tests/e2e/error-surface.pw.ts`, the pinned image, 2026-09-23): the
numeral removed from the document, the title read `Page not found | Luigi Espinosa`, the heading
`Page not found.` and the message `The page you’re looking for does not exist.`, each saying it, so
**branch A**, made true through the title as the criterion prefers: the title already distinguished
the route (A-13, asserted since Story 2-17) and this story set it in sentence case; the heading is
new. The same predicate read a page planted to say none of it as branch B.

**O-13 is a pre-existing defect corrected**, not one this redesign introduced: the 2023 numeral
carried `aria-label` on a `<p>`, and no element in the rebuilt component carries a name by attribute.

**Deferred work.** DW-77 and DW-80 close on this rebuild. DW-81 gets a dated count; its trigger
(an edit to `app/app.scss:49-58`) does not fire. DW-114 records the copy for the Operator.

**Rollback.** Revert the commit: the stylesheet, the tweens, the scope, the three ledger rows and
the findings' open state return together.

## Verification

**Commands:**

- `corepack pnpm typecheck`: expected clean.
- `corepack pnpm test --run`: expected every file passes (55 files, 1,377 tests before this story).
- `corepack pnpm build && node ops/asset-budget.mjs`: expected a reading the Derived paragraph
  accounts for, the 404's chunk lighter without GSAP.
- Container `pnpm test:e2e` (`mcr.microsoft.com/playwright:v1.62.1-noble`, the command in
  `ops/rendered-output-harness.md`), no filter: expected green with `error-surface.pw.ts` included and
  no snapshot written.

**As run, 2026-09-23:**

- `corepack pnpm typecheck`: clean, after `WEIGHT_SITES` was typed (Tasks).
- `corepack pnpm test --run`: 55 files, 1,393 tests, all passed (1,377 before; `Error404.test.tsx` went
  from three cases to nineteen). Seen failing first: sixteen of the nineteen on the 2023 component
  and stylesheet; claim four of `anchor-contract.test.ts` naming `Error404.scss` with the path
  unlisted; `hub-accessibility-pass.test.ts` on the record, on the KV-6 closers and on a dotted id.
- `corepack pnpm build && node ops/asset-budget.mjs`: before `gx6qgwAvuy7LjkwmJMVxX` at `2eb0aa0`,
  after `Sbk60a9S_F4Dc7v8z5Zyz` and `9xKq1w4OnW0Bc5Jf53GQ1` (the one filed), every chunk identical;
  1,512 gzipped lighter overall, `.css` 63 heavier, `.js` 1,575 lighter; the non-3D line `/cv`
  257,492, 117,492 over Story 2-2's 140,000, where it was 118,439. A client-directive build,
  `6yHba_HPNvPNeMUIxs016`, was weighed against it (Design Notes). Filed in `ops/asset-budget.md`.
- Container `pnpm test:e2e`, no filter: first run 299 passed and 1 failed, the new file's entrance
  read comparing `0.22s` with `220ms` / 1000 (a test defect, fixed in the test); `error-surface.pw.ts`
  alone then 15 of 15; the full suite 300 of 300 in 6.1 min. The `/work` baseline is `7c059024...`,
  unchanged, and no snapshot was written. The 404's two display elements held at 0.00% across the
  type swap; the sweep read `z-index=2 x2`, `linear-gradient x2` and one level-1 heading on every
  route.

**The Step-04 review, 2026-09-23.** All six layers ran in this session, because it had no tool to
start a subagent, so none of them is independent of the implementation (the 2-31 precedent). Four
patches: the entrance and no-script waits in `error-surface.pw.ts` wait on the surface's own
animations rather than on every animation in the document, which an unrelated loop would have held
until the timeout (edge case); a comment in `secondary-surfaces.pw.ts` named the deleted
`error-page.scss` (deletion check); an over-long docblock line in `Error404.tsx`, reflowed, which
moved the citation in `celeste-header.pw.ts` with it; and a constant assertion in
`anchor-contract.test.ts` added only to keep a binding in use, deleted with the binding (the 2-31
precedent). One deferral, DW-115: five ungated `:hover` rules in files no remaining story rebuilds,
found reading the built CSS. The design layer approved: the entrance is one opacity keyframe on the
entrance curve inside the spec's ~500ms stagger cap, the hover a border recolour gated on
`(hover: hover)`, reduced motion `animation: none`, each settled by `EXPERIENCE.md` § Motion or
`RESTYLE-SPEC.md` § 1; its one observation, that the exits are invisible for their first half second
on a motion-allowed context, is the shipped order kept and within that cap, so it is recorded rather
than changed. Re-run after the patches: typecheck clean; 55 files, 1,393 tests; the build
`OKRwq49_nsEP0V7BX2_DI` reproducing the filed reading chunk for chunk; and the container suite 300
of 300 in 5.7 min, the `/work` baseline unchanged.

**Manual checks:**

- Look at the 404 at 360 and 1280 on a hover-capable pointer and on a phone: the exits' borders
  light on hover only where a pointer can hover, and the page reads mark, numeral, heading, line,
  exits, left-aligned beneath the header.

## Suggested Review Order

**The surface, four parts and an ornament**

- Start here: a server component, the documents' structure in DOM order, nothing to hydrate.
  [`Error404.tsx:41`](../../components/organisms/ErrorPage/Error404.tsx#L41)

- The numeral is hidden and unnamed: branch A, and O-13's name on a paragraph gone.
  [`Error404.tsx:44`](../../components/organisms/ErrorPage/Error404.tsx#L44)

- The display line is the display entrance, reused rather than restated.
  [`Error404.tsx:48`](../../components/organisms/ErrorPage/Error404.tsx#L48)

- The label is a plain word; the heading says the rest.
  [`Error404.tsx:42`](../../components/organisms/ErrorPage/Error404.tsx#L42)

- The title in sentence case, one of the three places branch A rests on.
  [`not-found.tsx:9`](../../app/not-found.tsx#L9)

**The stylesheet, roles only**

- Content-high and start-aligned, no ground of its own: the centred hero is gone.
  [`Error404.scss:21`](../../components/organisms/ErrorPage/Error404.scss#L21)

- The numeral on the secondary display step, in the ornament role branch A permits.
  [`Error404.scss:35`](../../components/organisms/ErrorPage/Error404.scss#L35)

- Each exit a control: transparent, square, bordered, at the floor, one transition.
  [`Error404.scss:75`](../../components/organisms/ErrorPage/Error404.scss#L75)

- Hover recolours the border only, and only where a pointer can hover.
  [`Error404.scss:95`](../../components/organisms/ErrorPage/Error404.scss#L95)

- One opacity keyframe replaces three GSAP tweens; nothing runs under reduced motion.
  [`Error404.scss:108`](../../components/organisms/ErrorPage/Error404.scss#L108)

**The redundancy test and the browser criteria**

- The test run, not assumed: numeral removed, three carriers read, a planted branch B.
  [`error-surface.pw.ts:327`](../../tests/e2e/error-surface.pw.ts#L327)

- The accessible structure on both unrouted paths, and no name by attribute anywhere.
  [`error-surface.pw.ts:241`](../../tests/e2e/error-surface.pw.ts#L241)

- The ground sampled as pixels, the 2023 grid planted back as the control.
  [`error-surface.pw.ts:430`](../../tests/e2e/error-surface.pw.ts#L430)

- Hover changes border pixels only; a tap starts no border transition.
  [`error-surface.pw.ts:533`](../../tests/e2e/error-surface.pw.ts#L533)

- The entrance as the browser runs it, and the no-script reading.
  [`error-surface.pw.ts:715`](../../tests/e2e/error-surface.pw.ts#L715)

**The alias layer loses its last boundary and display sites**

- The `.error-page__back` scope left with the class it scoped.
  [`app.scss:86`](../../app/app.scss#L86)

- Both scoped readings pinned empty, the planted matcher keeping them measurements.
  [`anchor-contract.test.ts:1036`](../../app/__tests__/anchor-contract.test.ts#L1036)

- One ornament call site left, no boundary.
  [`anchor-aliases.pw.ts:351`](../../tests/e2e/anchor-aliases.pw.ts#L351)

- `--monument-regular` pinned at zero; the clamp case left with its last site.
  [`anchor-aliases.pw.ts:522`](../../tests/e2e/anchor-aliases.pw.ts#L522)

**The ledger and its records, moved in the same change**

- Three rows gone from the ledger literal; the `heading` check has no row left.
  [`accessibility-floor.pw.ts:196`](../../tests/e2e/accessibility-floor.pw.ts#L196)

- KV-6 reads two, two, one, zero, zero; closers 2-32 and 2-33.
  [`known-violations.md:472`](../../ops/known-violations.md#L472)

- The closure paragraph for the three rows, beside the findings annotated closed.
  [`hub-accessibility-pass.md:331`](../../ops/hub-accessibility-pass.md#L331)

- The weight reading, with the client form weighed and refused.
  [`asset-budget.md:471`](../../ops/asset-budget.md#L471)

**Peripherals**

- Server markup and the compiled stylesheet read; guards seen failing on the 2023 files.
  [`Error404.test.tsx:146`](../../components/organisms/ErrorPage/__tests__/Error404.test.tsx#L146)

- The 404's mark is the section variant now; the marker read has a planted control.
  [`plate-mark-and-work-item.pw.ts:535`](../../tests/e2e/plate-mark-and-work-item.pw.ts#L535)

- The 404's display sites in the type swap, both at 0.00%.
  [`type-swap.pw.ts:169`](../../tests/e2e/type-swap.pw.ts#L169)

- O-13's `Error404` half closed on the planning record, the 2-27 precedent.
  [`EXPERIENCE.md:1058`](../planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/EXPERIENCE.md#L1058)

- The copy for the Operator, and the ungated hovers the review found.
  [`deferred-work.md:5497`](deferred-work.md#L5497)
