---
title: 'Story 2.31: Redesign `WorkItem`, and retire `HudLabel` into the Plate mark'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_commit: '460230c6fd09ccf839bbd5bba89aba713388fe37'
review_loop_iteration: 0
warnings: ['oversized']
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** The Hub carries two near-identical label atoms (`HudLabel` and the Plate mark), and
the timeline row still paints itself from 2023 literals: an alpha hover ground and an alpha chip
border, a filled chip, an ungated `:hover` that sticks on touch, a close tween that eases in, a
synthesised mono bold, secondary text in a border colour at 3.49:1, a meta line that cannot wrap and
pushes 28 elements past the 360 viewport, and a focus ring that paints over the row's own rule and
into its neighbours.

**Approach:** Fold `HudLabel` into the Plate mark as its annotated and side-ruled variants, move all
three call sites onto it and delete the atom, then rewrite `WorkItem.scss` against
`contracts/tokens.css` alone and retune the disclosure's tweens to the contract's durations on an
ease-out, closing the ledger row, the findings and the deferred items this story owns in the same
change.

## Boundaries & Constraints

**Always:**

- `WorkItem.scss` and `PlateMark.scss` read `--token-*`, `--f-*`, `--t-*`, `--w-*`, `--lh-*`, `--tr-*`,
  `--s-*`, `--r-*`, `--stroke-*`, `--dur-*`, `--ease-*` and `--tap` from the contract and nothing else:
  no alias, no colour literal, no length literal, no `rgba()`, no gradient, no `box-shadow`, and no
  custom property of their own (`anchor-contract.test.ts` holds every declared `--name` to
  `app/app.scss`). `font-stretch: 85%` is the `wdth 85` idiom `SuiteDirectory.scss:130` set.
- Every `:hover` rule sits inside `@media (hover: hover)`. No `:active` rule. No `transition: all`.
  CSS transitions name `border-color` only; the one animated layout property is the GSAP height tween.
- No shipped source under `app/`, `components/`, `hooks/`, `content/` or `lib/` writes the path
  `contracts/`, and no `.tsx` names a contract token, comments included: `anchor-contract.test.ts`
  reads raw text at `:853-856` and `:1136`. Prose in `.tsx` says "the major duration", never the name.
- Exactly one label component remains. `HudLabel` is deleted, not aliased; the Plate mark has three
  variants and no fourth; the subordinate line is `aria-hidden` in every render.
- Accent (`--token-accent`) appears on the open item's leading rule and nowhere else in either file
  (`DESIGN.md:327-329`); hover uses `--token-accent-hover` only.
- `WorkItem` keeps its class names, its `${entry.id}-content` panel ids, the `<button>` with
  `aria-expanded` and `aria-controls`, and the first-render freeze of the collapsed style
  (`WorkItem.tsx:52`). `/work` and `/cv` both keep rendering it.
- Every ledger row, finding and register count this story closes moves in the same commit as the
  repair, in every file that holds it (`hub-accessibility-pass.md`, `accessibility-floor.pw.ts`,
  `known-violations.md`).
- The `/work` baseline is regenerated inside `mcr.microsoft.com/playwright:v1.62.1-noble` only, and its
  sha256 recorded in `ops/rendered-output-harness.md`.

**Ask First:**

- Changing `contracts/tokens.css` or reading `--ease-exit` (DW-103: it is an ease-in, a contract minor).
- Editing `WorkTimeLine.tsx`, `WorkTimeline.scss`, `WorkHero.scss`, `error-page.scss` or
  `HomeLayout.scss` (Stories 2-33, 2-30 and 2-29). This story changes a call site in their `.tsx`
  files and nothing else of theirs.
- Rewording any label beyond removing decoration from it, including the 404's `// ERR_NOT_FOUND`
  (Story 2-30's criterion).

**Never:**

- No new dependency. GSAP stays; the height tween stays as the single named exception.
- No opacity expressing state, no alpha ground, no filled chip or control, no bounce, overshoot or
  scroll-triggered motion, no radius, no containing box around a row.
- No `eslint` invocation and no lint criterion.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Section mark | `label`, optional `domain` (Premise, CvIntro) | `.plate-mark`, identity then domain, both uppercase in the DOM, hairline beneath | Blank label draws nothing; blank domain draws no cell |
| Annotated mark | `variant='annotated'`, `label`, `sub` (WorkHero, the 404) | `.plate-mark--annotated`, label then an `aria-hidden` sub line in `--token-accent-muted` at `--tr-meta`, hairline beneath | Blank sub draws no sub line |
| Side-ruled mark | `variant='side-ruled'`, optional `align='end'` (the home readout) | Hairline on the leading edge with `padding-inline-start: var(--s-sm)`; mirrored to the trailing edge when `end` | Readout panel still `display: none` below 768 |
| CSS turned off | Every stylesheet disabled on `/`, `/work`, `/cv`, the 404 | Every label reads as a short uppercase string; no sub line in the accessibility tree | N/A |
| Arrival | `/work` or `/cv`, first entry open | No collapsed-height flash; open rule is `--stroke-emphasis` in `--token-accent`; panel is a region named by its company | N/A |
| Toggle | Click a trigger | Open tweens on `power2.out` over `--dur-major`; close on `power2.out` over `--dur-exit`; the rule changes by `transform`, nothing reflows | N/A |
| Reduced motion | `prefers-reduced-motion: reduce` | Both tweens run at duration 0 | N/A |
| Hover, fine pointer | Pointer over a trigger | The item's leading rule recolours to `--token-accent-hover`; the ground stays transparent | N/A |
| Tap, touch | `(hover: none)`, tap a trigger | No hover colour is painted, before or after the tap | N/A |
| Keyboard | Tab through `/cv` | Triggers in DOM order, each ring painted inside its own row and clear of the rule, never trapped | N/A |
| 360 viewport | `/work`, `/cv` | No element inside `.work-timeline` past either viewport edge | N/A |
| Print | `/cv` in the print medium | Every panel prints expanded (DW-73) | N/A |
| Scripting off | `/cv` without JavaScript | Unchanged: first entry open, the rest collapsed (DW-76 re-booked) | N/A |

</frozen-after-approval>

## Code Map

**The label, and its retirement** (graphify `affected HudLabel`: `HudLabel.test.tsx:2`,
`Error404.tsx:4`, `HomeLayout.tsx:7`, `WorkHero.tsx:8`)

- `components/atoms/HudLabel/HudLabel.tsx`, `hud-label.scss`, `__tests__/HudLabel.test.tsx`: deleted
  with the directory.
- `components/molecules/PlateMark/PlateMark.tsx` (63 lines): `:3-27` docblock says Section only and
  names this story; `:28-47` props; `:49-63` render. Becomes a discriminated union on `variant`.
- `components/molecules/PlateMark/PlateMark.scss` (55): base rule is the Section variant; the two
  new modifiers and `.plate-mark__sub` are added. On `TOKEN_NATIVE_STYLESHEETS` already.
- `components/molecules/PlateMark/__tests__/PlateMark.test.tsx` (100): `:26`, `:76-77`, `:84` read
  mixed-case text and move to uppercase.
- Call sites: `WorkHero.tsx:56` (`// EXPERIENCE`, sub `経験`), `Error404.tsx:60` (`// ERR_NOT_FOUND`,
  sub `// SIGNAL_LOST`) and its docblock `:23`, `HomeLayout.tsx:86` (`// SYS_ONLINE ◕`, right).
  `HomeLayout.test.tsx:63-65` mocks `HudLabel` and loses the mock.
- `components/organisms/Premise/__tests__/Premise.test.tsx:133-134,144`: label and domain read
  uppercase. `:120` pins the Section class list as exactly `plate-mark`, which the design keeps.
- `tests/e2e/premise.pw.ts:80,589,613-614,628,641,659,670-672`: `.plate-mark` and
  `ruleGeometry(page, '.plate-mark', ...)` resolve the first mark on `/`, which becomes the readout's
  (display: none at 360) and breaks strict mode; every one is scoped to `.premise .plate-mark`.

**The row** (graphify `affected WorkItem`: `WorkTimeLine.tsx:6`, `cv/page.tsx:4`, `work/page.tsx:4`)

- `components/atoms/WorkItem/WorkItem.tsx` (145): `:75-95` the two tweens (0.4 `power2.out`, 0.3
  `power2.in`); `:103-143` markup: `h2` gains `id`, panel gains `role='region'` and
  `aria-labelledby`, both `ul` gain `role='list'`. `:52` freeze and `:66-72` mount guard untouched.
- `components/atoms/WorkItem/WorkItem.scss` (145): rewritten. Literals at `:25`, `:35` (rgba hover),
  `:59-61` (nowrap, KV-5), `:85` (weight 600, F-4), `:95` (1.7, F-9), `:111` (`--gray-color`, F-5),
  `:140` (rgba chip border), `:139` (chip fill).
- `components/atoms/WorkItem/__tests__/WorkItem.test.tsx` (312): gsap mocked at `:42-53`; tween args
  read at `:114-123`. New cases per Tasks.
- `app/app.scss:77-86`: `.work-item::before` leaves the `--accent-dim` boundary scope.
- `app/scss/_print.scss:37-43`: gains the DW-73 rule.

**Pins that move with the rebuild**

- `app/__tests__/anchor-contract.test.ts:284-319` add `components/atoms/WorkItem/WorkItem.scss` in
  path order after `SkipLink.scss`; `:1064-1068` expected scoped selectors become
  `['.error-page__back']`.
- `tests/e2e/anchor-aliases.pw.ts`: `CALL_SITES` `:372-400` lose the two `hud-label.scss` and four
  `WorkItem.scss` rows (count 8 to 2, boundaries 2 to 1, `:417-418`, messages `:533-537`, title
  `:715`); `computedPseudoValue` `:243-278` and its control `:756-778` go with the last pseudo row,
  left as a note in the `inWideContext` shape `:492-502`; `DISPLAY_REGULAR_SITES` `:458-462` loses
  `WorkItem.scss:47`.
- `tests/e2e/accessibility-floor.pw.ts:229-236`: the `weight-work-initiative` row.
- `tests/e2e/hit-target-floor.pw.ts:37-47`: the KV-5 sentence names the half this story closes.

**Records**

- `ops/hub-accessibility-pass.md`: ledger row `:326`; headline rows `:39-40`; the trigger paragraph
  `:204-211`; findings F-3 `:376`, F-4 `:377`, F-5 `:378`, F-9 `:382`, F-10 `:383`, F-19 `:392`,
  each closed in the F-8 shape (annotated, never deleted).
- `ops/known-violations.md`: KV-6 index row `:67`, heading `:472`, counts `:474-497`, breach
  `:512`, booking `:518`, retired-by `:520`; the weight sum spelled `zero`
  (`hub-accessibility-pass.test.ts:615`) and `2-31` out of the index row's closers (`:603-606`).
  KV-5: `:432-433` dated re-read, half row `:460` closed; index row literal unchanged
  (`hit-target-floor.test.ts:785`).
- `ops/hit-target-floor.md` § The overflow census `:596-708`: a dated re-measurement of `/work` and
  `/cv`.
- `ops/anchor-token-adoption.md:482-500,544-550`: dated notes, table kept as taken.
- `ops/rendered-output-harness.md:207-221`: current sha256 and a table row; `:21-60` a row for the
  new spec file.
- `ops/asset-budget.md:471`: a reading after Story 2-31 above Story 2-29's, and a run under
  § Findings `:1075`, in their shape.
- `_bmad-output/implementation-artifacts/deferred-work.md`: DW-34, DW-67, DW-72, DW-73 close; DW-76
  and DW-107 re-booked with reasons; new entries per Design Notes.

**Found during implementation, and touched for it**

- `tests/e2e/accessibility-floor.pw.ts` § the scrim over the home canvas: the readout's glyphs at
  `--t-3xs` come no closer than 13.1 to any of the five role colours over the repainted scrim, one
  past the threshold, so the mark's hairline role joins the probes of that one read.
- `tests/e2e/type-swap.pw.ts`: the four row names are held to their line box, not their height (see
  Design Notes, the row name's width).
- `app/cv/page.tsx:18`, `components/organisms/CvIntro/CvIntro.tsx:31`, `content/__tests__/work.test.ts`:
  line citations into `WorkItem.tsx` that the edit moved, three of them already stale before it.

## Tasks & Acceptance

**Execution** (in this order, on `dev`):

- [x] Before any edit: `corepack pnpm build && node ops/asset-budget.mjs` and every
      `.next/static/chunks/*.css` and `*.js` gzipped (level 9) saved to the scratchpad as the before
      reading.
- [x] `PlateMark.tsx`, `PlateMark.scss`: the union and the variants as Design Notes state;
      `PlateMark.test.tsx`: uppercase reads, variant class sets, sub `aria-hidden`, blank cases, the
      compiled-CSS guards, and a tree read that no source names `HudLabel` or `hud-label`.
- [x] Delete `components/atoms/HudLabel/`; move the three call sites; drop the `HomeLayout.test.tsx`
      mock; update `Premise.test.tsx` and `premise.pw.ts`.
- [x] `WorkItem.scss` rewrite; `WorkItem.tsx` tweens and markup; `WorkItem.test.tsx` cases: durations
      equal the contract's `--dur-major` and `--dur-exit` read off `contracts/tokens.css`, both eases
      front-loaded by the real `gsap.parseEase`, the labelled region, `role='list'`, no `//` in DOM
      text, chips not focusable, and the compiled-CSS guards. See the new guards fail on the old
      `WorkItem.scss` first.
- [x] `app/app.scss` scope, `anchor-contract.test.ts` (see claim four at `:907-918` fail naming
      `WorkItem.scss` with the path absent first), `anchor-aliases.pw.ts`, `_print.scss`.
- [x] `tests/e2e/plate-mark-and-work-item.pw.ts`: every browser criterion below, each with a planted
      control that makes the reading fail.
      *(As executed: the first run read every timeline rule as a blend. `WorkTimeLine.tsx`'s scroll
      entrance fades a row up after the scroll that reveals it, so each pixel read now waits for the
      page to be still on two consecutive reads; the tap is read as the colour transitions it starts,
      because the emulation's hover is transient; and a strip is cut to the painted part of its box,
      because `/work`'s hero clips the Plate mark's rule at its own edge. A 24th case reads the row's
      type for F-3, F-4, F-5 and F-9. Four repeats of the file were then green, 92 of 92.)*
- [x] Ledger and records: `accessibility-floor.pw.ts` row, `hub-accessibility-pass.md`,
      `known-violations.md`, `hit-target-floor.pw.ts` comment; `corepack pnpm test --run
      ops/__tests__/hub-accessibility-pass.test.ts` seen failing on the unmoved KV-6 heading first.
- [x] Branch build: `corepack pnpm build && node ops/asset-budget.mjs`, the same chunk weights,
      `ops/asset-budget.md` reading and run.
- [x] Container: plain `pnpm test:e2e` (the `/work` comparison is expected to fail and print its
      differing pixels), then `pnpm run test:e2e:update`, then plain again, green with no filter; sha256
      and pixel count into `ops/rendered-output-harness.md`; the census figures and the sweep's
      off-contract and text-read lines into the records.
- [x] `deferred-work.md` entries; `corepack pnpm typecheck`; `corepack pnpm test --run`; commit.

**Acceptance Criteria:**

- Given the tree, when `PlateMark.test.tsx` runs, then no source under `app/` or `components/` names
  `HudLabel` or `hud-label`, `components/atoms/HudLabel` does not exist, and every prop combination
  renders one of exactly four class sets (section, annotated, side-ruled, side-ruled end).
- Given `/cv` (section), `/work` and the 404 (annotated) at 360 and `/` at 1024 (side-ruled end),
  when each mark is read in the browser, then it computes Geist Mono at `--t-3xs`, uppercase,
  `--tr-label`, `--token-text-secondary` and `tabular-nums`, its only border is one 1px
  `--token-border` rule on the side its variant names, the side-ruled padding is `--s-sm`, and a
  planted side-ruled start mark rules its leading edge.
- Given `/work` and the 404, when the sub line is read, then it computes Geist Mono at `--t-3xs` in
  `--token-accent-muted` at `--tr-meta`, carries `aria-hidden`, and is absent from the mark's aria
  snapshot.
- Given every stylesheet disabled on `/`, `/work`, `/cv` and the 404, when every mark's label and
  domain cells are read, then each is uppercase, at most 32 characters and four words, and no sub
  line text appears in the page's aria snapshot; and `/` carries two marks, `/work`, `/cv` and the 404
  one each, `/celeste` none.
- Given `/work` and `/cv` at 360, when each row and its rules are read, then no row draws a ground,
  radius, shadow or any border but its 1px `--token-border` separator, and the sampled pixels of the
  separator, the closed leading hairline and every Plate mark rule equal `--token-border` rasterised,
  on both grounds.
- Given an entry toggled open and closed, when the leading rule is sampled, then it is two
  `--token-accent` pixels wide open and one `--token-border` pixel closed, the `::after` computes the
  same width in both states while its `transform` differs, and the trigger text's box does not move.
- Given a fine pointer, when a closed trigger is hovered, then the rule computes
  `--token-accent-hover`, the trigger's ground stays transparent, and every pixel that differs from
  the rest screenshot lies inside the rule's box; given `(hover: none)` with touch, when a trigger is
  tapped, then the rule never computes `--token-accent-hover`.
- Given a chip, when read, then it has a 1px solid `--token-border-interactive` border on every side,
  a transparent ground, Geist Mono at `--t-3xs`, radius `0px` and no tab stop; given a highlight,
  when read, then its `::before` renders `//` in `--token-text-secondary` and the list's aria snapshot
  names each item without it, and both lists expose the list role.
- Given `/cv`, when Tab moves through the triggers, then focus follows DOM order and leaves the
  timeline, and each ring's reach box lies inside its own row and clear of the leading rule (F-19).
- Given `/work` and `/cv` at 360, when every element inside `.work-timeline` is measured, then none
  lies past either viewport edge, and the whole-page census is logged for the record.
- Given `/cv` in the print medium, when the panels are measured, then all four have height, and the
  same read in the screen medium shows three at zero.
- Given the built CSS, when `accessibility-floor` sweeps, then no synthesised weight is found and the
  ledger carries no `weight-work-initiative`, and `hub-accessibility-pass.test.ts` passes with KV-6
  reading zero synthesised weights and closers 2-30, 2-32 and 2-33.
- Given the before and after builds, when `ops/asset-budget.md` is read, then a dated reading gives
  the `.css` and `.js` gzipped totals on both sides and the Derived delta against the Story 2-29
  reading, and states the non-3D line.
- Given `corepack pnpm typecheck`, `corepack pnpm test --run` and the container `pnpm test:e2e`, when
  run, then every file passes.

## Spec Change Log

## Design Notes

Each resolution below is an assumption taken from the documents in their precedence order
(`DESIGN.md` values, `EXPERIENCE.md` behaviour, `RESTYLE-SPEC.md` geometry and the rest).

**The Plate mark's shape.** Section stays the unmodified `.plate-mark`, so the two existing marks
render byte-identical markup and `Premise.test.tsx:120` holds. Annotated adds
`.plate-mark--annotated` (column, rule beneath) and `.plate-mark__sub`; side-ruled adds
`.plate-mark--side-ruled` (rule on the leading edge, `padding-inline-start: var(--s-sm)`) and, for
`align='end'`, `.plate-mark--end` (the mirror). The props are a union keyed on `variant`, so `domain`
exists only on section, `sub` only on annotated and `align` only on side-ruled: a fourth
combination does not type-check.

```ts
type PlateMarkProps =
  | { variant?: 'section'; label: string; domain?: string }
  | { variant: 'annotated'; label: string; sub: string }
  | { variant: 'side-ruled'; label: string; align?: 'start' | 'end' };
```

**Labels are uppercase in the DOM.** `RESTYLE-SPEC.md` § 7's check reads every label with CSS off
as an uppercase string, and § 6 calls uppercase structural. The component uppercases what it
renders (`toUpperCase()` on label, domain and sub), so all five marks pass without a call site
change and `text-transform` stays as the spec lists it.

**Call-site strings: decoration leaves, no word changes.** `EXPERIENCE.md` § Plate mark (behaviour)
says the label is read, so `//` inside it is decoration a screen reader speaks, and it outranks the
ceiling's microcopy rule; `DESIGN.md` gives the Plate mark no marker value, so the `//` is dropped
rather than moved to CSS. WorkHero reads `EXPERIENCE`; the readout reads `SYS_ONLINE` (its `//`
and `◕` are both decoration). `SYS_ONLINE` is still a code rather than words and no document
supplies its words: filed as a DW for the Operator, not decided here. The 404 moves verbatim,
because Story 2-30's criteria own that label's wording.

**The trigger's border is the item's leading rule.** `DESIGN.md` § Work item lists two rules on the
item and no box on the header; a four-sided Control box around each header would draw a containing
box round the row's name, which `RESTYLE-SPEC.md` § 2 bars. So hover recolours the leading rule,
through `.work-item:has(> .work-item__header:hover)` inside `@media (hover: hover)`, and paints
nothing where no rule is drawn at rest.

**The rule, built on two pseudo-elements so no ratio is written.** `::before` is the closed hairline,
`border-inline-start: var(--stroke-hair) solid var(--token-border)`; `::after` is the open rule,
`var(--stroke-emphasis) solid var(--token-accent)`, held at `transform: scaleX(0)` from the left and
`none` when `[data-open='true']`. Both are absolutely positioned, so the widest state is reserved
and nothing reflows; the state change is `transform`; both draw with `border`, never a background, so
F-8's fill grep stays clean. No transform transition: the height tween carries the motion.

**Colours from `DESIGN.md`'s roles table.** Company `--token-text`; meta line, initiative,
description, highlights, marker, chips and icon `--token-text-secondary`; chip border
`--token-border-interactive`. Accent on the open rule only (F-5 closes; the initiative and icon lose
their accent).

**Type from `RESTYLE-SPEC.md` § 2.** Company: `--f-display`, `--t-base`, `--w-bold`,
`font-stretch: 85%`, `--lh-heading`, `--tr-name`, uppercase. Meta line and initiative: mono
`--t-2xs`, `--lh-label`, `--tr-meta`, uppercase, `tabular-nums`, wrapping (KV-5's half closes).
Description and highlights: `--t-sm`, `--lh-body`, capped at `--measure` (F-9). Chips: mono `--t-3xs`,
`--tr-meta`, uppercase. The trigger takes `font: inherit` (F-3). No `font-weight` on mono (F-4).

**Geometry.** Row: `padding-block: var(--s-xs)`, `padding-inline: var(--s-md) var(--s-xs)`, separator
beneath. Trigger: flex, `inline-size: 100%`, `min-block-size: var(--tap)`, `padding-block: var(--s-md)`,
no border, no ground. The ring reaches 5px (`--focus-offset` plus `--stroke-focus`); 8px of row
padding keeps it inside the row and 16px keeps it clear of the 2px rule (F-19).

**The marker.** `content: '//'` then `content: '//' / ''`, so it is out of the accessible name where
alternative text is supported, on an `li` that is `display: flex; align-items: baseline`, which lines
it up without an offset literal.

**The tweens.** `OPEN_DURATION = 0.42` and `CLOSE_DURATION = 0.165` seconds, both `power2.out`
(`review-apple-design-2026-09-15.md` A-4), pinned to the contract by the unit test rather than read at
run time; `useReduceMotion` still forces 0.

**Deferred work.** DW-34 closes by ruling (the height tween is the named exception). DW-73 closes with
`.work-item__content { height: auto !important; overflow: visible !important; }` under `@media print`,
the house idiom of that file. DW-76 is re-booked: forcing panels open without script leaves three
triggers announcing `collapsed` over visible content, which is a behaviour decision, and inverts
Story 2-16's standing no-script reading. DW-107 is re-booked: the defect is the readout panel's
`display: none` in `HomeLayout.scss`, which this story does not edit. DW-67 and DW-72 close on the
census this story takes.

**The row name's width, found in the swap test.** `tests/e2e/type-swap.pw.ts` held every display
element's height within 1% across the font swap, and at `wdth 85` the first company set on two lines
in the fallback and one in the face (35.19 to 17.59), its line box held. That is DW-82's structural
half: the contract publishes one `size-adjust` fitted at the default width, and the fallback has no
width axis. Two ways out were weighed. Dropping the name to `100%`, as Story 2-29 did for the hero
links by Operator ruling, would decide a value `RESTYLE-SPEC.md` § 2 and `DESIGN.md`'s Registry Entry
state, in a stylesheet. Holding the four names to their height per line keeps the claim the test was
written for (the four override descriptors hold line boxes), prints the line counts as before, and
records the wrap where it belongs. The second was taken: `DisplaySite.holds: 'lineBox'` on the one
site, the reason beside it, and the reading in DW-82. **This is the one place the story changed what a
gate asserts**, and it is flagged for the reviewer.

**The hairline probe in the scrim read.** The readout's text is the Plate mark at `--t-3xs` now, and
over the repainted scrim its glyphs came no closer than 13.1 to any role, where the threshold is 12.
The test's own comment anticipated an exemption for that panel; the mark's hairline is one opaque
pixel of `--token-border` painted by the panel, so it proves the panel is above the layer as exactly as
a glyph does, and it was added as a probe of that read only. The panel is not exempt.

**Rollback.** Revert the commit: the atom, the literals, the ledger row, the findings' open state and
the old baseline return together.

## Verification

**Commands:**

- `corepack pnpm typecheck`: expected clean; the union refuses a fourth combination.
- `corepack pnpm test --run`: expected every file passes (about 900 tests in 34 files before this story).
- `corepack pnpm build && node ops/asset-budget.mjs`: expected a reading the Derived paragraph accounts for.
- Container `pnpm test:e2e` with no filter: expected green after the baseline update, the new spec file included.

**As run, 2026-09-23:**

- `corepack pnpm typecheck`: clean.
- `corepack pnpm test --run`: 55 files, 1,377 tests, all passed. The stylesheet guards were seen
  failing on the 2023 `WorkItem.scss` (eight of nine) and the tween and region cases on the 2023
  `WorkItem.tsx` (four) before the rebuild; claim four of `anchor-contract.test.ts` was seen failing
  naming `WorkItem.scss` before it was listed; `hub-accessibility-pass.test.ts` was seen failing on the
  ledger's two halves and then on the KV-6 closers before the register moved.
- `corepack pnpm build && node ops/asset-budget.mjs`: before `xYaWbFMJEJtFEN4Ffs5N6`, after
  `UrWXqz0rhlKgfAkd_0BeV` (reproduced by `NUFEJaWf2yKbCGCGaweZV`, every chunk identical), and after
  the review's patch `0KxutAmqMQuDuV6dR2omk`, which is the reading filed: 51 gzipped bytes heavier
  overall, `.css` 366 lighter, `.js` 417 heavier; the non-3D line 118,438 over on `/cv`. Filed in
  `ops/asset-budget.md`.
- Container `pnpm test:e2e`, `mcr.microsoft.com/playwright:v1.62.1-noble`: plain run 284 passed and 2
  failed, the `/work` comparison at 7,134 differing pixels and its capability guard; `pnpm run
  test:e2e:update` wrote `7c059024...` (24,322 bytes); plain runs after it 286 of 286, then 287 of 287
  with the row-type case, 8.3 minutes, no stray snapshot.

**The Step-04 review, 2026-09-23.** All six layers ran in this session, because it had no tool to
start a subagent, so none of them is independent of the implementation. Three patches: the constant
assertion in `PlateMark.test.tsx`'s discrimination case is deleted; the CSS-off case in
`plate-mark-and-work-item.pw.ts` now fails a read cell carrying a `//`, with the 404's label, Story
2-30's wording, as the control the same read must find; and `transform-origin: left` left
`WorkItem.scss`, because the transform it anchored never animates. One deferral, DW-112: the company
heading sits inside the trigger `<button>`, which predates this story. The design layer approved: the
one layout animation, the durations, the `border-color` transition and the hover gate are each
settled by `EXPERIENCE.md` § Motion and § Work item or by this spec. Re-run after the patches:

- `corepack pnpm typecheck`: clean.
- `corepack pnpm test --run`: 55 files, 1,377 tests, all passed, twice: after the patches, and again
  after the records below were written.
- `corepack pnpm build && node ops/asset-budget.mjs`: build `0KxutAmqMQuDuV6dR2omk`, the row's
  stylesheet 19 bytes lighter on disk and 5 gzipped, every other chunk unchanged.
- Container `pnpm test:e2e`, same image, no filter: 287 of 287 passed, 7.5 minutes, no snapshot
  written, the `/work` baseline still `7c059024...`.
- Lighthouse, which this spec does not ask for and which gates on `main` only, read in the same image
  the way `.github/workflows/lighthouse.yml` takes it, three runs per URL: accessibility `/cv` 1.00
  (F-5's audit passing), `/work` 1.00 and `/` 0.96, best practices and SEO 1.00 everywhere, every
  assertion green. `/`'s one failing audit is six `aria-hidden` ornaments, none of them this
  story's (DW-113).

**Manual checks:**

- Look at `/work` and `/cv` at 360 and at 1280 on a hover-capable pointer and on a phone: the rule
  lights on hover only where a pointer can hover, and the open item reads by the rule's width in
  greyscale.

## Suggested Review Order

**One label component, three variants**

- Start here: a union on `variant`, so a fourth combination fails to type-check.
  [`PlateMark.tsx:40`](../../components/molecules/PlateMark/PlateMark.tsx#L40)

- The subordinate line is ornament, hidden from assistive technology in every render.
  [`PlateMark.tsx:91`](../../components/molecules/PlateMark/PlateMark.tsx#L91)

- A variant moves the rule and adds none; the mirror is logical properties throughout.
  [`PlateMark.scss:80`](../../components/molecules/PlateMark/PlateMark.scss#L80)

- The readout loses its `//` and `◕` decoration, and no word changes (DW-110).
  [`HomeLayout.tsx:92`](../../components/organisms/HomeLayout/HomeLayout.tsx#L92)

- The 404 label moves verbatim: its `//` is Story 2-30's to remove.
  [`Error404.tsx:62`](../../components/organisms/ErrorPage/Error404.tsx#L62)

**The row, a rule and not a card**

- Two out-of-flow layers reserve the widest state; `transform` switches it, nothing reflows.
  [`WorkItem.scss:35`](../../components/atoms/WorkItem/WorkItem.scss#L35)

- Hover recolours the rule alone, and only where a pointer can hover.
  [`WorkItem.scss:66`](../../components/atoms/WorkItem/WorkItem.scss#L66)

- The trigger inherits the page type and keeps the tap floor (F-3).
  [`WorkItem.scss:76`](../../components/atoms/WorkItem/WorkItem.scss#L76)

- The row name at `wdth 85`, which is what moved the type-swap gate.
  [`WorkItem.scss:105`](../../components/atoms/WorkItem/WorkItem.scss#L105)

- The meta line wraps, which closes KV-5's component half at 360.
  [`WorkItem.scss:119`](../../components/atoms/WorkItem/WorkItem.scss#L119)

- The `//` marker is generated content with empty alternative text.
  [`WorkItem.scss:186`](../../components/atoms/WorkItem/WorkItem.scss#L186)

**The disclosure's timing and semantics**

- Durations held to the contract; both tweens ease out, closing A-4 without `--ease-exit`.
  [`WorkItem.tsx:30`](../../components/atoms/WorkItem/WorkItem.tsx#L30)

- The panel is a region named by its company heading, not the trigger's sentence.
  [`WorkItem.tsx:157`](../../components/atoms/WorkItem/WorkItem.tsx#L157)

- Print outranks GSAP's inline height, so a printed CV carries every company (DW-73).
  [`_print.scss:50`](../../app/scss/_print.scss#L50)

**Gates that moved, the first flagged**

- Flagged: the row names hold their line box, not their height, across the swap.
  [`type-swap.pw.ts:150`](../../tests/e2e/type-swap.pw.ts#L150)

- The scrim read probes the mark's hairline rather than exempting the readout panel.
  [`accessibility-floor.pw.ts:2015`](../../tests/e2e/accessibility-floor.pw.ts#L2015)

- The alias scope loses `.work-item::before`, and one boundary remains.
  [`app.scss:82`](../../app/app.scss#L82)

- `WorkItem.scss` joins the files allowed to name contract roles directly.
  [`anchor-contract.test.ts:305`](../../app/__tests__/anchor-contract.test.ts#L305)

**Peripherals**

- Every browser criterion, each with a planted control that makes its read fail.
  [`plate-mark-and-work-item.pw.ts:365`](../../tests/e2e/plate-mark-and-work-item.pw.ts#L365)

- The stylesheet read at source: roles only, the hover gated, `border-color` the one transition.
  [`WorkItem.test.tsx:429`](../../components/atoms/WorkItem/__tests__/WorkItem.test.tsx#L429)

- The tween durations read off the published contract, and the curve measured as an ease-out.
  [`WorkItem.test.tsx:357`](../../components/atoms/WorkItem/__tests__/WorkItem.test.tsx#L357)

- Scans `app/` and `components/` so `HudLabel` cannot come back under its old name.
  [`PlateMark.test.tsx:295`](../../components/molecules/PlateMark/__tests__/PlateMark.test.tsx#L295)

- KV-5's re-read: `/work` 10, all the hero's, and `/cv` 0.
  [`known-violations.md:432`](../../ops/known-violations.md#L432)

- The three entries this story filed, the last from its review.
  [`deferred-work.md:5365`](deferred-work.md#L5365)
