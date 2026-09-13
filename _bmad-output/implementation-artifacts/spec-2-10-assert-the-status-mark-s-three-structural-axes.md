---
title: "Story 2.10: Assert the Status mark's three structural axes"
type: 'feature'
created: '2026-09-06'
status: 'done'
baseline_commit: '472195ed2f4ee235f9e86642ace7448b136d8eec'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Story 2-9 rendered the Status mark with all three structural axes
(`SuiteDirectory.scss:159-222`) and deliberately asserted nothing about them, so the highest-leverage
field in the Registry ships unverified. AD-19 requires the axes asserted, and is explicit that
`border-style` alone is forbidden because `Live` and `Complete` are both `1px solid` and sit 1.13:1
apart in greyscale. Three records already name this story as the owner of that hole and of A-5's
Status-truncation half: `ops/hit-target-floor.md:12,41,326`, `ops/known-violations.md:369-371` and
`ops/rendered-output-harness.md:77`. Nothing in the committed Registry is `Complete`, so three of the
four taxonomy arms have never reached a browser at all.

**Approach:** One new Playwright spec, `tests/e2e/status-mark.pw.ts`, reading the shipped stylesheet
through `data-status` planted on a real mark in the live page, with the print medium as the genuine
zero-hue render. The dot's presence rule is markup, so it is asserted in jsdom beside the component.
Record the result in a new `ops/status-mark-axes.md` held equal to the spec by a new Vitest agreement
suite, and close the ledger rows that point here.

## Boundaries & Constraints

**Always:**

- **Assert each axis where it can be seen.** Which values render a dot is `SuiteDirectory.tsx:96`, a
  markup fact jsdom sees; `border-style`, `border-width` and the dot's painted box are the
  stylesheet's and need a browser. A case that fabricates both sides of a claim asserts nothing.
- **Vary only `data-status`.** The four values reach the browser by setting that one attribute on a
  real `.suite-directory__status` in the running page, the plant-into-the-page idiom
  `suite-directory.pw.ts:157-163` sets. No fixture route, no test-only component, no fixture left in
  the tree.
- **The forbidden shortcut is proved forbidden, not declared so.** A standing case reads `Live` and
  `Complete` as **identical** on `border-style`, so the border-only assertion AD-19 bans is shown to
  pass a broken implementation rather than merely described as doing so.
- **Print is the greyscale render.** `app/scss/_print.scss:28-35` forces `#000` on the mark's border,
  its text and the dot, so under `emulateMedia({ media: 'print' })` hue is gone from the mark and the
  axes are all that is left. A `filter: grayscale(1)` would prove nothing: `getComputedStyle` returns
  pre-filter values.
- **Every claim carries a control that fires**, on the same page, in the same run
  (`suite-directory.pw.ts:400-429`). Suppress the dot, restyle the border, clamp the mark, and see
  each measurement fail before its clean read is believed.
- **Nothing here reads `--tap`.** `EXPERIENCE.md:351` puts the mark outside the floor. It is not added
  to `SURFACES`, not exempted in `EXEMPTIONS`, and the A-5 half asserted here is truncation, measured
  on the mark's own box.
- **A repair moves the whole ledger in one commit.** Each of the five cited lines names Story 2-10 as
  owner of something this story delivers, and a row left behind claims a hole that is filled.

**Ask First:**

- **Any axis that does not hold in the shipped stylesheet.** This story asserts the mark; it does not
  redesign it. A failing axis is a finding to raise, not a stylesheet to edit.
- Adding a route, a Playwright project, a second viewport, a CI job, or a dependency.
- Editing anything under `contracts/`, or `DESIGN.md` / `EXPERIENCE.md`.
- Unfilling the dot to settle the F-8 tension. `deferred-work.md` books that to Story 2-34 as a named
  exemption scoped to the dot's selector.

**Never:**

- No `toHaveScreenshot` and no `expectRouteScreenshot`: `rendered-output.pw.ts:216-223` keeps exactly
  one committed baseline, and a capture here would create a second snapshot directory.
- Do not touch `EXEMPTIONS` or `SURFACES` in `tests/e2e/hit-target-floor.pw.ts`, whose literals
  `ops/__tests__/hit-target-floor.test.ts` parses as text; and do not move KV-4 or KV-5's status,
  closing stories or index rows, which `:679-722` pins as literals.
- Do not mock `@/lib/registry`, and do not add an `entries` prop to `SuiteDirectory`.
- Do not give the mark a tooltip, popover, hover state, `title` or focusability. Asserting their
  absence is the work; adding one is the defect.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Axis 1, the rule | `SuiteDirectoryRow` given each of the four values | `Live` renders `.suite-directory__dot`; the other three render none | Absent, never hidden: a `display: none` dot would satisfy a presence check while deleting the axis |
| Axis 1, painted | The real page's `Live` marks | The dot measures 4 by 4 with a non-transparent background | Demonstrated failing with the dot suppressed, which is the criterion AD-19 names |
| Axis 2, the dash | `data-status` planted `Complete`, then `In progress` | `border-style` reads solid then dashed, with border-width unchanged across the pair | A pair that agrees means the dash axis is gone |
| Axis 3, the border | `data-status` planted `In progress`, then `Archived` | Non-zero border-width on all four sides, then zero on all four | `border: 0` and a transparent border look alike to a colour read and differ here |
| The forbidden shortcut | `Live` beside `Complete` | Identical `border-style` | If they ever differ, a border-only assertion has become viable and this case says so out loud |
| Greyscale | `emulateMedia({ media: 'print' })` | Border and text colours collapse to one value across all four; the four stay pairwise distinct on dot, style and width | A colour still separating two values in print means the taxonomy leans on hue |
| Opacity | All four planted values, and the dot | Computed `opacity` is exactly `1` everywhere | `Archived` drops its container; a faded one computes to 2.25:1 and fails |
| A-5, truncation | The marks at 360px | `scrollWidth` within `clientWidth`, box inside the viewport, no ellipsis | Demonstrated failing with the mark clamped narrow |
| Not interactive | The mark at rest and hovered | No `title`, no `aria-describedby`, no popover, not focusable, and every read property equal before and after hover | A hover difference is a state the mark is forbidden to have |

</frozen-after-approval>

## Code Map

**The subject, read only**

- `components/organisms/SuiteDirectory/SuiteDirectory.scss:159-222`: the mark. `:170-190` the shared
  block, `:192-195` `Live` (accent border and text), `:197-199` `In progress` (`border-style: dashed`),
  `:201-204` `Archived` (`border: 0`, `padding-inline: 0`), `:216-222` the 4px square dot at
  `--r-none` filled with `--token-accent`. `Complete` takes the shared block unmodified, which is why
  the dot is the only thing separating it from `Live`.
- `components/organisms/SuiteDirectory/SuiteDirectory.tsx:93-98`: `data-status={entry.status}` is the
  attribute the stylesheet keys on and the one seam a test may vary. `:96` is the dot's conditional.
- `app/scss/_print.scss:12,28-35`: the dot survives the decorative sweep by name; the mark's border
  and text are forced `#000` and the dot's background too. This is the zero-hue medium.
- `_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md:298-323`: the
  per-value table, the 1.13:1 figure and the bar on opacity. `EXPERIENCE.md:334-352` is the mapping
  AD-19 names as the single source; `:764` is A-5; `:351` is the not-interactive clause.

**Where the assertions go**

- `tests/e2e/status-mark.pw.ts`: **new.** A separate file for the same reason `suite-directory.pw.ts`
  is separate (`:10-15`): `hit-target-floor.pw.ts`'s literals are parsed as text by a Vitest suite,
  and the axes are a different predicate on a non-interactive element.
  `playwright.config.ts:33-34` collects every `.pw.ts` under `tests/e2e` by glob and
  `.github/workflows/ci.yml:276-277` runs the whole directory, so **no config and no CI job change**.
- `components/organisms/SuiteDirectory/__tests__/SuiteDirectory.test.tsx:33-34`: the docblock that
  says the axes are rendered here and asserted by this story. The dot-presence cases belong beside it,
  driven through the exported `SuiteDirectoryRow` over fixtures, the idiom already at `:240`.

**Idioms to copy rather than reinvent**

- `tests/e2e/suite-directory.pw.ts`: `goTo` `:128-136`, `plantStyle` `:157-163`, `roleColour`
  `:184-193`, and the clean-read-then-plant shape at `:376-398` with its control at `:400-429`.
  `linkState` `:201-233` is the model for reading many properties as one object and comparing them in
  a single `toEqual`.
- `tests/e2e/harness.ts:164` `rootCustomPropertyValue` and `:119` `computedStyleValue`, for anything
  read off the contract rather than written down.
- `ops/__tests__/hit-target-floor.test.ts`: the agreement-suite shape, including `read()` `:54-60`
  normalising CRLF, which a Windows checkout needs, and the planted-control rule that every parser is
  shown firing before an agreement is read as good news.

**Records that move**

- `ops/status-mark-axes.md`: **new.** The Story 2-10 record, in the shape `ops/hit-target-floor.md`
  sets: what is asserted, the measured values, what it deliberately does not assert with an owner per
  row, and a failing-loudly table. It carries the greyscale reading and the Operator's manual render
  check, which is the half O-9 asks a person for.
- `ops/__tests__/status-mark-axes.test.ts`: **new.** Holds the record equal to
  `tests/e2e/status-mark.pw.ts` in both directions, and pins that the record is named by
  `ops/rendered-output-harness.md` under what the harness **asserts**.
- `ops/rendered-output-harness.md`: delete the `:77` row under "does not assert" and add one to the
  `:42-47` table with the spec file and this story. `ops/__tests__/hit-target-floor.test.ts:664-677`
  enforces exactly this placement rule for the floor's row; do not disturb it.
- `ops/hit-target-floor.md:12`, `:41`, `:326`: three restatements of "less the Status half, which
  nothing renders yet and Story 2-10 owns". Point them at this story's spec and record instead.
  `:326` sits in "What this deliberately does not assert", which is prose: only
  `## The exemption ledger` and `## The surfaces swept` are parsed
  (`ops/__tests__/hit-target-floor.test.ts:116,138`). `:479-486` is a timing table whose top row now
  says nine spec files; add a reading rather than editing one, per `:485`'s own note.
- `ops/known-violations.md:369-371`: KV-5's scope note. Rewrite the Status sentence only. **The entry
  stays `Open`**, its closing stories stay `Stories 2-31, 2-33 and 2-14`, and the index row at `:66`
  is untouched.

## Tasks & Acceptance

**Execution:**

- [x] `components/organisms/SuiteDirectory/__tests__/SuiteDirectory.test.tsx`: assert the dot's
      presence rule over all four values through `SuiteDirectoryRow`, and amend the `:33-34` docblock
      that says this story owns it.
- [x] `tests/e2e/status-mark.pw.ts`: **new.** Every browser row of the matrix, each with a control
      verified to fire: the painted dot, the two border axes through planted `data-status`, the
      identical-`border-style` case, the print-medium greyscale read, opacity, A-5 truncation, and the
      not-interactive claim.
- [x] `ops/status-mark-axes.md`: **new.** The record, with every value marked decision or observation,
      and the greyscale figures taken from a real run in the pinned container.
- [x] `ops/__tests__/status-mark-axes.test.ts`: **new.** The agreement suite, both directions, every
      parser shown firing on a planted control.
- [x] `ops/rendered-output-harness.md`, `ops/hit-target-floor.md`, `ops/known-violations.md`: move or
      restate the five lines that name Story 2-10 as the owner of a hole this story fills.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md`: file anything the run surfaces that
      this story's boundaries refuse, an axis that does not hold included.

Added during execution, beyond the list above:

- [x] `tests/e2e/status-mark.pw.ts`: a case measuring **the greyscale distance itself**, not planned
      for. AD-19's argument for the dot rests on `Live` and `Complete` being too close in greyscale
      for colour to carry them, and that was quoted from `DESIGN.md` rather than asserted anywhere.
      It now measures the ratio on the running page and asserts it stays **under the 3:1 non-text
      floor**, with each mark's own contrast against the ground asserted **above** 3:1 in the same
      case so a broken colour conversion cannot make the bound pass vacuously.
- [x] Two findings filed in `deferred-work.md`. **`DESIGN.md:310-314` attributes the 1.13:1 greyscale
      figure to the border pair, and the shipped border pair measures 1.773:1**; 1.133:1 is the text
      pair, exactly. The argument is unaffected, both being far under 3:1, and the spec asserts the
      bound rather than either number. Second: the mark is unasserted under `forced-colors`, a medium
      no requirement in this plan names, recorded with no owner rather than booked to a story that
      does not exist.
- [x] `ops/hit-target-floor.md:479-486`: a tenth-spec-file timing row. The `docker run` wall is left
      blank rather than carried over from the nine-file row, which would present one run's figure as
      another's.
- [x] Two instrument defects found by their own controls and fixed. Counting lines as
      `height / line-height` reported a single-line `Live` as two, the mark being padded on both
      axes; it is now a `Range` over the text node. And the `Archived` control planted `border-width`
      alone, which changes nothing, because a computed border-width is `0px` whenever the style is
      `none`. Both are recorded in `ops/status-mark-axes.md` as findings rather than smoothed over.

Applied after the adversarial review, all patch-level:

- [x] **Three factual errors in the records, all verified against source.** The 3:1 bound was cited
      to `EXPERIENCE.md:760`, which is A-1 and governs focus indicators; it is WCAG 2.1 SC 1.4.11 and
      now says so. "Two of the four values cannot be seen" then named three, and misattributed them:
      `RENDERED_STATUSES` is `Live` and `Complete`, so the filter holds back **two**, and `Complete`
      is renderable but absent from the data. The print table gave `Archived` a border colour of
      "n/a" while the case asserts `rgb(0, 0, 0)`, `_print.scss:29` setting the colour regardless of
      the zero width.
- [x] **Two real coverage gaps closed.** The longest-value plant reached only
      `document.querySelector`'s first mark, always a top-level row, while `groupByFamily` nests two
      rows inside a container inset by `--s-md` on each side, so the narrower position was never
      measured; it now plants into every mark and asserts a nested one was among them. And every case
      ran on `/` alone while `app/projects/page.tsx` renders the same component outside `Container`,
      which is the route `ops/known-violations.md` already records as overflowing; the A-5 cases now
      run on both.
- [x] **The record's measured values were held against nothing.** Changing `dashed` to `dotted` in
      the stylesheet and in the spec would have left the record stating a treatment nothing had, with
      every suite green, while `ops/rendered-output-harness.md` sends readers to that record for "the
      measured values". The spec now declares one `EXPECTED` literal that both drives its own
      assertions and is parsed as text by the agreement suite, the shape
      `ops/__tests__/hit-target-floor.test.ts` uses for the exemption ledger.
- [x] **Four vacuity holes.** The canvas conversion had no guard that it converted anything, and
      `fillStyle` fails silently on an unparseable string, which is the shape `lab()` colours arrive
      in; it now carries a sentinel and an alpha check. The dot count was asserted non-zero rather
      than reconciled against the `Live` mark count, so five of six could vanish. The truncation read
      would have compared `0 > 0` on a mark restyled to `display: inline`. And blanking all three
      O-9 cells satisfied the consistency check as "wholly answered".
- [x] **A gate that outlives this session:** the agreement suite now fails if the board marks 2-10
      `done` while the O-9 check reads "not yet performed", the same shape
      `ops/__tests__/hit-target-floor.test.ts:552-573` uses to hold an exemption against its closing
      story's status.
- [x] Smaller corrections: the hover case waits on `--dur-major` read from the contract rather than a
      written 400ms and now has a planted control, both of which the blanket "every claim carries a
      control" claim had assumed; `cursor` is asserted `not.toBe('pointer')` rather than pinned to
      `auto`, `default` being equally non-interactive; the dot's `border-radius` is asserted, settling
      the square-versus-pill ruling `SuiteDirectory.scss:206-215` argues at length and nothing held;
      the component fixture now separates the dot's key from `live` presence, which AD-5 otherwise
      confounds; every agreement scan strips comments first, the print-emulation guard having been
      satisfiable by the docblock alone; the harness-placement guard gained the uniqueness check its
      precedent pairs with; `deferred-work.md` regained its trailing newline; and the record gained
      the container command to re-run every figure in it.
- [x] One finding deferred rather than fixed: `goTo`, `plantStyle`, `durationMs` and
      `EDGE_SLACK = 0.5` are now duplicated across three spec files. Lifting them touches
      `hit-target-floor.pw.ts`, which this story's boundaries put off limits.

**Acceptance Criteria:**

- Given `corepack pnpm test:e2e` inside `mcr.microsoft.com/playwright:v1.62.1-noble`, when it runs,
  then it passes, and every control case in `tests/e2e/status-mark.pw.ts` has been observed failing
  its clean counterpart's measurement on the same page.
- Given the three axes, when they are asserted, then each is read from the running stylesheet rather
  than from a value written in the spec file, and `Live` and `Complete` are read as identical on
  `border-style`, so a border-only assertion is demonstrably insufficient.
- Given `corepack pnpm test --run` and `corepack pnpm typecheck`, when they run, then both pass,
  `ops/__tests__/hit-target-floor.test.ts` included, and no test mocks `@/lib/registry`.
- Given `git grep -n "Story 2-10"`, when it runs after the change, then every surviving hit is a
  record of what this story delivered, not a row waiting on it.
- Given `git status --porcelain -- tests/e2e/*-snapshots`, when it is read after a full run, then it
  is empty.
- Given the mark is not interactive, when the change lands, then `tests/e2e/hit-target-floor.pw.ts`,
  `ops/hit-target-floor.md`'s ledger and surfaces tables, and KV-4 and KV-5's index rows are all
  byte-identical to `472195e`.

## Spec Change Log

## Design Notes

**Why print rather than a grayscale filter.** The obvious greyscale check applies
`filter: grayscale(1)` and reads the marks back, and it measures nothing: a filter is a paint-time
operation and `getComputedStyle` returns the pre-filter value, so all four marks report exactly the
colours they reported before. The Hub already ships a real zero-hue medium. Under
`emulateMedia({ media: 'print' })` the rules at `_print.scss:28-35` force border, text and dot to
`#000`, which is the strongest possible form of the claim: with hue deleted at source rather than
simulated, whatever still separates the four values is structural by construction, and if two values
become indistinguishable there the taxonomy was leaning on colour.

**Why the dot is split across two suites.** The claim "`Complete` has no dot" has two halves that
fail independently: the component may render one, and the stylesheet may paint one that is not there
or hide one that is. jsdom sees the first and no browser is needed for it; only a browser sees the
second. Asserting both in the browser would mean the test fabricating the dot for the three values
that never render, which makes the test the author of the thing under assertion.

**Why `data-status` is the only seam.** It is the contract between `SuiteDirectory.tsx:93` and the
stylesheet's four selectors, and varying it exercises exactly the mapping AD-19 points at. Anything
wider (a fixture route, a test-only component, an `entries` prop) would put a second rendering of the
mark in the tree, and a second rendering is the thing that can silently disagree with the shipped one.

## Verification

**Commands:**

- `corepack pnpm test --run`: passes, including the two new suites and the amended component suite.
- `corepack pnpm typecheck`: passes. AD-21 makes it blocking.
- `corepack pnpm test:e2e`: run inside the pinned image only; DW-23 records the working container
  invocation. Take the timing reading for `ops/hit-target-floor.md:479-486` from this run.
- `corepack pnpm build`: passes.

**Manual checks:**

- Confirm every control case was watched failing, not merely written. A control that passes for an
  unrelated reason is the failure mode `hit-target-floor.pw.ts:1323` already found once.
- Confirm no `4px`, no colour literal and no `1.13` figure is hand-written into the Playwright spec
  where it could be read off the running page instead.
- **Operator action, and the half O-9 asks a person for:** render the Directory desaturated at 360px,
  by eye, and confirm all four Status values remain distinguishable with no legend. Record the result
  and the date in `ops/status-mark-axes.md`. The machine evidence stands on its own; this is the
  human confirmation the open item names. The board is left at `review` rather than
  `awaiting-operator`, that label being `bmad-loop`'s to write, and
  `ops/__tests__/status-mark-axes.test.ts` fails the build if the board reaches `done` while the
  three O-9 cells still read `_not yet performed_`. So the gate is mechanical either way.

## Suggested Review Order

**The argument, which is where the design actually lives**

- Start here: `Live` and `Complete` are asserted **identical** in border treatment, so AD-19's ban on
  a border-only assertion is a measured fact rather than a convention.
  [`status-mark.pw.ts:139`](../../tests/e2e/status-mark.pw.ts#L139)

- Why the dot has to exist, taken off the running page: the distance colour could have carried, held
  under 3:1 rather than pinned to a figure that drifts.
  [`status-mark.pw.ts:588`](../../tests/e2e/status-mark.pw.ts#L588)

- Print is the greyscale render and it is real, not simulated. A `filter` would have measured nothing.
  [`status-mark.pw.ts:542`](../../tests/e2e/status-mark.pw.ts#L542)

- The same argument as prose, with the sRGB triples and the three ratios behind it.
  [`status-mark-axes.md:118`](../../ops/status-mark-axes.md#L118)

**The seam, and why it is the only one**

- `data-status` varied on one real element: three of the four values reach no browser any other way.
  [`status-mark.pw.ts:226`](../../tests/e2e/status-mark.pw.ts#L226)

- The four values read out of the published schema, so a fifth cannot go unasserted.
  [`status-mark.pw.ts:91`](../../tests/e2e/status-mark.pw.ts#L91)

- Adjacency is the one list written down, so it is checked for coverage against that enum instead.
  [`status-mark.pw.ts:139`](../../tests/e2e/status-mark.pw.ts#L139)

- The literal both the spec asserts against and the record is held equal to.
  [`status-mark.pw.ts:158`](../../tests/e2e/status-mark.pw.ts#L158)

**The axis a browser cannot see on its own**

- Split deliberately: markup here, paint in the browser, because a browser only ever sees `Live` dots.
  [`SuiteDirectory.test.tsx:361`](../../components/organisms/SuiteDirectory/__tests__/SuiteDirectory.test.tsx#L361)

- The confound AD-5 creates: the dot must follow `status`, not the `live` URL that always accompanies it.
  [`SuiteDirectory.test.tsx:433`](../../components/organisms/SuiteDirectory/__tests__/SuiteDirectory.test.tsx#L433)

- Painted, square, and reconciled against the `Live` mark count rather than merely present.
  [`status-mark.pw.ts:476`](../../tests/e2e/status-mark.pw.ts#L476)

**What holds the change honest**

- The record and the spec held equal on the measured border treatment, not only on case titles.
  [`status-mark-axes.test.ts:206`](../../ops/__tests__/status-mark-axes.test.ts#L206)

- A gate that outlives this session: the board cannot read `done` while O-9 reads not yet performed.
  [`status-mark-axes.test.ts:372`](../../ops/__tests__/status-mark-axes.test.ts#L372)

- Scans strip comments first, or a file arguing against an approach satisfies the guard forbidding it.
  [`status-mark-axes.test.ts:72`](../../ops/__tests__/status-mark-axes.test.ts#L72)

- Both row positions planted, the family group being inset and therefore narrower.
  [`status-mark.pw.ts:773`](../../tests/e2e/status-mark.pw.ts#L773)

- `/projects` renders the same component on a different width budget, and KV-5 already flags it.
  [`status-mark.pw.ts:751`](../../tests/e2e/status-mark.pw.ts#L751)

- The control the not-interactive cases were missing until review asked.
  [`status-mark.pw.ts:916`](../../tests/e2e/status-mark.pw.ts#L916)

**The records, where the holes that named this story closed**

- The axes move from what the harness does not assert to what it does.
  [`rendered-output-harness.md:45`](../../ops/rendered-output-harness.md#L45)

- KV-5 points at the record rather than restating a count that rots on the next Registry entry.
  [`known-violations.md:370`](../../ops/known-violations.md#L370)

- The human half of O-9, outstanding by design and gated by the suite above.
  [`status-mark-axes.md:240`](../../ops/status-mark-axes.md#L240)
