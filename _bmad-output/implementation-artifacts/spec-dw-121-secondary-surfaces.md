---
title: 'DW-121: secondary surfaces, the 404 next-step line, /celeste restyled to S10, --hero-height deleted, the wordmark confirmed'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_commit: 'f414711b21687e6fd4f36449a06918b5a3e50599'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Four Operator-owned ledger entries on the Hub's secondary surfaces. The 404's supporting
line restates its heading (DW-114). `/celeste` is token-coloured but keeps the user agent's weight,
case and leading where the S10 mock draws a restyle (DW-121). `--hero-height` is declared, pinned by
three suites and read by nothing (DW-122). The wordmark's string, size and tracking and the nav's rest
underline were never confirmed (DW-117).

**Approach:** Operator ruling 2026-09-24, one package. The 404 line reads exactly `Check the address,
or use one of the links below.` and the label stays `Error`; the redundancy pin moves so the title and
the heading carry "not found". `/celeste`'s heading takes S10 through contract roles, and its two emoji
move onto a mono line of their own inside it. `--hero-height` is deleted and its pins go to zero. The
wordmark is recorded as shipped. Each ref closes where it lives, with dated amendments.

## Boundaries & Constraints

**Always:**

- Every changed behaviour gets a test that fails on the baseline tree for the reason it names, and
  every new browser read is shown firing on a planted control.
- `/celeste` stays footer-only, `noindex`, without an exit or a visible control, and its header stays
  hidden by `#celeste header`. Its heading's text content stays byte for byte.
- Every type and spacing value on `/celeste` is a contract role, so `node ops/literal-conformance.mjs`
  stays green.
- Records take the UTC date and cite "Operator ruling 2026-09-24". A ledger entry closes with a dated
  paragraph naming the commit and `status: done`; a planning document gets a dated amendment in its
  own style; dated history (spec files, CHANGELOG, sprint-status comments) is not rewritten.
- No em-dash, en-dash, double-dash standing in for a dash, or emoji in anything written (the
  heading's two emoji are the page's existing copy, reached by escape in tests).

**Ask First:** nothing gates this run. It is unattended; each open decision is resolved from
`DESIGN.md`, then `EXPERIENCE.md`, then `RESTYLE-SPEC.md`, and stated under Design Notes.

**Never:**

- No change to the 404's structure, label, heading, title or description, and no change to any
  surface but the 404 and `/celeste`.
- No edit under `contracts/` or `packages/`, no new dependency, no rename of `celeste.scss`.
- No push and no pull request. Regenerate the `/work` baseline only if the container run shows it
  moved, and only in the pinned image.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 404 line | unrouted path and `/recommendation` | one line reading the ruled string; mark `ERROR`, heading `Page not found.` | N/A |
| Redundancy test | numeral removed | branch A, carried by `title` and `heading` exactly | a page planted to say none of it reads branch B |
| `/celeste` heading | 360 x 800, faces loaded | display family at 85%, `--w-black`, uppercase, `--lh-display`, `--tr-display`, `--t-display`, centred, within `14ch` | planted 700 weight and `none` case are reported |
| `/celeste` emoji | same | a block `span` after the words, mono at `--t-2xs`, `--w-regular`, `--tr-label`, `--lh-label`, `--s-md` above, below the words' last line | a planted `display: inline` puts it back on the words' line |
| Root set | the built CSS | the contract's names alone, plus the minifier's scheme pair beside `color-scheme` | a name outside the contract is extra |

</frozen-after-approval>

## Code Map

- `components/organisms/ErrorPage/Error404.tsx:50` the line; `:15-20` the docblock's "three times
  over". Pins: `Error404.test.tsx:170-177` (the line case) and `:203-205`; `tests/e2e/error-surface.pw.ts`
  `:16-20`, `:212-219` (`branchOf`, reused) and `:327-340` (the verdict pin).
- `components/organisms/Celeste/Celeste.tsx:4` the heading; `celeste.scss:12-17` the `h1` rule, whose
  lines 1-10 are cited by line in `hit-target-floor.pw.ts:93,1409`, `Container.test.tsx:10-11` and
  `ops/hit-target-floor.md:74`. Pins: `Celeste.test.tsx:18-27,74-78`; `tests/e2e/celeste-header.pw.ts:88-160`
  (the 700 pin at `:137`). Reuse: the `probe`, `size` and `tracking` shape in `error-surface.pw.ts:85-113`.
- `app/app.scss:3-19` the property and its comment, `:59-63` the scheme block's comment. Pins:
  `app/__tests__/anchor-contract.test.ts:25-28,171-182,230-241,318-323,355-368,830-878,1054-1057,1060-1119`;
  `tests/e2e/anchor-aliases.pw.ts:17-34,77-90,125-129,141,368-379,402-444,494,497-521`;
  `tests/e2e/contract-anchor.pw.ts:112-131,585-594`.
- `components/atoms/Logo/Logo.tsx:14-17`, `Logo.scss:4-8`, `Logo/__tests__/Logo.test.tsx:22`,
  `tests/e2e/chrome-nav.pw.ts:210-214`: comments that say DW-117 is filed.
- `tests/e2e/type-swap.pw.ts:124`: says `/celeste` reaches no display face, stale since Story 2-34.
- Records: `deferred-work.md` DW-114 (`:5871`), DW-117 (`:6002`), DW-121 (`:6159`), DW-122 (`:6188`),
  DW-82 (`:4693`); `EXPERIENCE.md:281-295` (§ UI strings); `DESIGN.md:740-824` (§ The redesigned Hub
  surfaces) and `:1162` (§ The mapping); `epics.md:1828,2823,2859,3354`; `AGENTS.md:87-90`;
  `ops/anchor-token-adoption.md:898-951`; `ops/rendered-output-harness.md:47,48,61`;
  `ops/literal-conformance.md:171`; `ops/hub-accessibility-pass.md:413-414`; `ops/asset-budget.md`.

## Tasks & Acceptance

**Execution:**
- [x] Tests first, run red on the baseline: the unit and e2e cases below.
- [x] `Error404.tsx`: the ruled line and the docblock; `Error404.test.tsx` and `error-surface.pw.ts`:
  the line pinned exactly, carriers `['title', 'heading']`.
- [x] `Celeste.tsx`: wrap the emoji in `span.celeste__emoji`; `celeste.scss`: the heading's roles and
  the emoji line's rule below line 10; `Celeste.test.tsx` and `celeste-header.pw.ts`: the new reads.
- [x] `app.scss`: delete the property; the three suites: zero Hub properties, the root set from the
  contract alone, the kept-literal case deleted with a note.
- [x] Comments per the Code Map; records and planning notes per Design Notes; the ledger closings.
- [x] Verify per § Verification, with an asset-budget reading.

**Acceptance Criteria:**
- Given the baseline tree, when the new and moved cases run, then each fails for the reason it names.
- Given the final tree, when typecheck, the full unit suite, the literal gate, the build and the
  unfiltered container e2e run execute, then all pass and the `/work` baseline is unmoved.
- Given `/celeste` at 360 and 1280, when it renders, then the heading stacks centred with the emoji
  line beneath and nothing past either edge.

## Spec Change Log

- **Review, 2026-09-24, loop 0.** No subagent could be spawned in this session, so the six layers
  ran inline, as the Operator's authorisation of a sub-agent reviewer allows. No intent gap and no
  bad-spec finding. Four patches, each committed after its checks: the tool-call encoding had decoded
  the new Celeste unit case's `\u00ED` escape into the letter, where that file writes every non-ASCII
  character as an escape (blind pass); the own-line read passed on a heading with no line box, and
  the leading and tracking probes could agree while both unresolved (edge-case pass); a literal `800`
  restated `--w-black`'s value, now read against `--w-bold` with the face check keyed on the resolved
  weight (verification-gap pass), all three in `211eab0`; and `app/__tests__/not-found.test.tsx` still
  called the title one of three carriers, `be7fcef`. Rejected: `overflow-wrap` on the heading (the
  widest line is 153 of a 252 box at 320, measured), the emoji line's trailing tracking (1.7px off
  centre), and a rename of `celeste.scss` (Design Notes 6). The ponytail layer found the diff lean;
  the design layer approved. No new ledger entry: the one consequence, `/celeste` as an unmeasured
  narrowed site, is a note on DW-82.

## Design Notes

Assumptions, resolved unattended in the stated order:

1. **Tracking `--tr-display`**: the line is the page's one display line at `--t-display` and 800, and
   `DESIGN.md` § Typography gives display `-0.05em`; the mock's hand-written `-0.04em` loses. Size stays
   `--t-display` and leading is `--lh-display`, so the mock's clamp and `1.05` lose too.
2. **`wdth 85` through `font-stretch: 85%`**, the Hub's idiom (`SuiteDirectory.scss:46-48`), not
   `font-variation-settings`; the mock's `opsz 48` is left to optical sizing. The ruling's 85 departs
   from "Display sets at `wdth 100`", so `DESIGN.md` gets a dated `/celeste` row.
3. **`14ch` is a literal**, as `85%` is: the contract's one measure is `46ch`, and the gate reads type
   and spacing properties only, where every value here is a role.
4. **The emoji line**, the mock's `span` inside the `h1` so the heading's name keeps both: `--f-mono`,
   `--t-2xs` and `--s-md` above as the mock sets them; `--w-regular`, because Geist Mono publishes
   400 alone and the heading's 800 would be a synthesised weight the accessibility sweep refuses;
   `--tr-label`, the role nearest the mock's `0.2em`; `--lh-label`, the Hub's mono line leading. No
   colour: `DESIGN.md` § Colors spends the accent on underlines, `Live` and the active rule only.
5. **Copy unchanged**: text content stays ` Te amo muchísimo hermosa ` then the two emoji with no
   space between (`RESTYLE-SPEC.md` § The ceiling); the mock's inner space is not copied.
6. **No body padding and no rename**: the heading clears both edges at 360, and lines 1-10 of
   `celeste.scss` stay as cited.
7. **DW-114**: title and heading carry "not found", so branch A holds; `description` metadata is not
   the line and stays. The mock keeps its old line; the § UI strings row is the copy's record.
8. **DW-122**: the root set derives from the contract, so a Hub name put back fails the build read.
   `DESIGN.md` § What exists is a dated snapshot and stays.
9. **Consequences recorded**: `ops/hub-accessibility-pass.md:413-414` (the message no longer carries
   branch A), `ops/anchor-token-adoption.md`, `ops/rendered-output-harness.md` rows 47, 48 and 61,
   `ops/literal-conformance.md:171`, and a DW-82 note: `/celeste` now asks for 85% and is unmeasured.
10. **Found while building: the published-family scan reads comments.** `anchor-contract.test.ts`
    refuses a contract family's name anywhere in a shipped source, so `celeste.scss` says "the mono
    face"; the suite named the first wording before the commit.
11. **The type-swap comment** said `/cv` and `/celeste` reach no display face, stale since Stories
    2-16 and 2-34; it now says both do and that `/celeste`'s narrowed line is unmeasured.
12. **`DESIGN.md` § Typography** gets a dated note beside "Display sets at `wdth 100`", pointing at
    the `/celeste` entry, so the exception is not found only by reading the surfaces.

## Verification

**Commands:**
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test --run`: every file passes.
- `node ops/literal-conformance.mjs`: exit 0.
- `corepack pnpm build`, then `node ops/asset-budget.mjs`: exit 0 each, a dated reading filed.
- The pinned container run of `pnpm test:e2e`, no filter: every case passes.

**Manual checks:**
- Screenshots of `/celeste` at 360 and 1280 and of the 404 at 360, from the pinned image.

**As run, 2026-09-24:**
- Red on the baseline code with the new tests in place. `corepack pnpm vitest --run` over the three
  touched suites: 5 failed, each for its reason (app.scss still declared `--hero-height`, its count
  read 1, its first `:root` block was the property's; the emoji had no element; the line was the old
  one). In the pinned image, the four touched specs: 5 failed, 27 passed (the build's `:root` carried
  `--hero-height` in both anchor suites, the heading read 700 where 800 was asked, the message was a
  third carrier).
- One commit per ruling, each verified before it was made, the other rulings' test edits held aside
  by a path-scoped stash: `e03a380` typecheck exit 0, unit 60 files and 1,565 passed; `2cbbccf`
  typecheck exit 0, unit 60 and 1,565, literal gate exit 0; `8e98285` typecheck exit 0, unit 60 and
  1,566, literal gate exit 0, and in the pinned image `celeste-header`, `secondary-surfaces`,
  `hit-target-floor`, `type-swap` and `accessibility-floor` 58 passed of 58; `bc23bab` typecheck exit 0,
  unit 60 and 1,566. The review patches: `211eab0` typecheck exit 0, unit 60 and 1,566 with every
  record edit in the tree, `celeste-header` 6 of 6 in the pinned image; `be7fcef` its suite 4 of 4.
- `corepack pnpm build` exit 0 at `bc23bab` (`BQB_cRpzq_XDxi6F5Pk-M`); `node ops/asset-budget.mjs`
  exit 0, the reading filed; `/` weighed from `next start` in the pinned image.
- The unfiltered container run at `bc23bab`, the task's command verbatim: 337 passed, 0 failed, 5.9
  minutes, the `/work` baseline unmoved and no snapshot written.
- Screenshots and geometry, pinned image, a scratch script never committed: `/celeste` at 320 and
  360 sets three lines in a 252 box, the widest 153, the emoji line below them, nothing past either
  edge; at 1280, two lines in 518; the 404 at 360 reads the ruled line above the two exits.

## Suggested Review Order

**`/celeste` restyled to S10 (DW-121)**

- Entry point: the display row's roles at `wdth 85`, capped at `14ch`
  [`celeste.scss:18`](../../components/organisms/Celeste/celeste.scss#L18)

- The emoji line; the regular weight keeps the mono face from being synthesised
  [`celeste.scss:36`](../../components/organisms/Celeste/celeste.scss#L36)

- Same copy byte for byte; the emoji now in an element of their own
  [`Celeste.tsx:13`](../../components/organisms/Celeste/Celeste.tsx#L13)

- Every value against its role, beside planted controls; the 700 pin moved
  [`celeste-header.pw.ts:131`](../../tests/e2e/celeste-header.pw.ts#L131)

- The own-line read, refusing a heading with no line box
  [`celeste-header.pw.ts:253`](../../tests/e2e/celeste-header.pw.ts#L253)

**The 404's next step (DW-114)**

- The ruled line, verbatim; the label and heading unchanged
  [`Error404.tsx:55`](../../components/organisms/ErrorPage/Error404.tsx#L55)

- Branch A now rests on exactly the title and the heading
  [`error-surface.pw.ts:344`](../../tests/e2e/error-surface.pw.ts#L344)

**`--hero-height` deleted (DW-122)**

- The rule is gone; the comment says why and what holds it
  [`app.scss:14`](../../app/app.scss#L14)

- The root set derives from the contract alone, so a Hub name put back is extra
  [`anchor-aliases.pw.ts:129`](../../tests/e2e/anchor-aliases.pw.ts#L129)

- The source half holds the file to declaring none, on any selector
  [`anchor-contract.test.ts:1067`](../../app/__tests__/anchor-contract.test.ts#L1067)

**Records**

- The two § UI strings rows, the wordmark confirmed (DW-117) and the error surface
  [`EXPERIENCE.md:296`](../planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/EXPERIENCE.md#L296)

- The dated `/celeste` entry, and the width exception it records
  [`DESIGN.md:824`](../planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md#L824)

- Four ledger entries closed, DW-121 among them
  [`deferred-work.md:6219`](deferred-work.md#L6219)

- The asset-budget reading: no route moves more than 139 gzipped
  [`asset-budget.md:484`](../../ops/asset-budget.md#L484)

**Peripherals**

- The emoji's own element, read in the unit suite
  [`Celeste.test.tsx:81`](../../components/organisms/Celeste/__tests__/Celeste.test.tsx#L81)

- The ruled line pinned exactly in the server markup
  [`Error404.test.tsx:176`](../../components/organisms/ErrorPage/__tests__/Error404.test.tsx#L176)

- The browser half of the Hub's empty list
  [`contract-anchor.pw.ts:594`](../../tests/e2e/contract-anchor.pw.ts#L594)
