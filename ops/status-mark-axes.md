# The Status mark's structural axes

The written record of the instrument Story 2-10 installed: what a machine now asserts about the
Status taxonomy, what each of the four values measures, what the taxonomy looks like in a medium
with no hue, and what this assertion deliberately does not cover.

**The requirement is AD-19**: "the Status mark's **three structural axes** hold per `EXPERIENCE.md`
§ Status mark. **Asserting `border-style` alone is forbidden.** Opacity never expresses state." The
mapping is `EXPERIENCE.md:334-352` and the per-value table is `DESIGN.md:298-323`. **A-3**
(`EXPERIENCE.md:762`) is the accessibility requirement behind it and **FR-7** is what it binds.
This story also closes **A-5's second clause** (`EXPERIENCE.md:764`), "Status never truncates",
which Story 2-8 left open because nothing rendered a Status yet.

Written during Story 2-10 on **2026-09-06** (ISO 8601 UTC), against baseline commit
`472195e`.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/hit-target-floor.md`, `ops/rendered-output-harness.md` and
`ops/known-violations.md` set: every value is marked as either a decision or an observation, and the
two are never presented as the same kind of fact (NFR-9). An observed value carries the method that
gathered it, because a number without a method is a claim.

**Story ids are written hyphenated**, as `Story 2-10`, matching the keys in
`_bmad-output/implementation-artifacts/sprint-status.yaml`. `epics.md` writes the same ids dotted.
They are the same stories.

## What is asserted

`tests/e2e/status-mark.pw.ts` runs inside the existing `rendered-output` job. No job was added to
`.github/workflows/ci.yml`: `:276-277` already runs the whole `tests/e2e` directory, and a seventh
job would fail the two suites that pin the job names as an exact set.

| Assertion | What it answers | Nature |
|---|---|---|
| Axis one, the dot | Does every `Live` mark paint a 4 by 4 square, at `--r-none`, with a real fill | **Decision.** `DESIGN.md:298-314`. **Half the axis, and deliberately so:** that `Complete` has no dot is markup and is asserted in `components/organisms/SuiteDirectory/__tests__/SuiteDirectory.test.tsx`, because a browser only ever sees `Live` dots and a case that made a `Complete` one would be fabricating its own subject |
| Axis two, the dash | Is `Complete` solid on all four sides where `In progress` is dashed, at the same width | **Decision.** AD-19, `EXPERIENCE.md:339-340` |
| Axis three, the border | Does `In progress` carry a non-zero border on all four sides that `Archived` drops to zero | **Decision.** AD-19, `DESIGN.md:316-320` |
| The forbidden shortcut | Are `Live` and `Complete` **identical** in border treatment, so a border-only assertion is demonstrably insufficient | **Decision.** AD-19 states this as a prohibition; it is recorded here as a measured property rather than a convention |
| Greyscale | With hue deleted at source, do the four values stay pairwise distinct | **Decision.** Open item O-9, `EXPERIENCE.md:1057`. Measured in print, not through a filter |
| Opacity | Does any mark, or the dot, express its value with `opacity` | **Decision.** `DESIGN.md:322-323`, AD-19's closing sentence |
| A-5, truncation | At 360 wide, does any Status value clip, ellipsise, wrap or leave the viewport | **Decision.** `EXPERIENCE.md:764`, the clause `ops/hit-target-floor.md` left to this story |
| Not interactive | Does the mark carry a tooltip, a popover, a role, a tab position, a pointer cursor or a hover state | **Decision.** `EXPERIENCE.md:351-352`. This is what keeps the mark's absence from the hit-target sweep honest rather than accidental |

**The four values are read, never written.** **Decision.** They come off the `status` enum in
`contracts/registry.schema.json` at run time, through the local `$ref` the schema uses, so a fifth
value added to the taxonomy arrives in every loop in the spec file instead of going unasserted. The
same principle as the floor being read off `--tap` rather than typed into
`tests/e2e/hit-target-floor.pw.ts`.

**One element, four readings.** **Decision.** Every value is read off the same real
`.suite-directory__status` by varying `data-status` on it, the attribute
`components/organisms/SuiteDirectory/SuiteDirectory.tsx:93` writes and the four selectors at
`SuiteDirectory.scss:192-204` key on. Four different elements would each sit in their own grid area
and inherit their own colour, and any of that would show up as an axis that was really a difference
in context. **Nothing in the committed Registry is `Complete`, `In progress` or `Archived`**, so
without this seam three of the four arms could not be measured at all.

## How to re-run every measurement below

The record's own argument is that a check leaving no record cannot be re-run against a regression,
which applies to the machine half as much as the human one. Every figure in this file came from this
command, run from the repository root on the Windows development host. It is
`ops/anchor-token-adoption.md:229-241` verbatim, narrowed to this spec file:

```
docker run --rm --ipc=host ^
  -v C:/CuatroEcosystem/cuatro-portfolio:/w ^
  -v pw-node-modules:/w/node_modules ^
  -v pw-next:/w/.next ^
  -w /w -e CI=1 ^
  mcr.microsoft.com/playwright:v1.62.1-noble ^
  bash -lc "corepack enable && pnpm install --frozen-lockfile && pnpm exec playwright test status-mark"
```

Drop the trailing `exec playwright test status-mark` for `pnpm test:e2e` and the whole suite runs.
The image is pinned because glyph rasterization is not portable and `--font-mono` falls back to a
different face on Linux than on Windows (`ops/rendered-output-harness.md`).

## The four values, measured

**Observed 2026-09-06** in `mcr.microsoft.com/playwright:v1.62.1-noble` at a 360 by 800 viewport,
by reading `getComputedStyle` on one real mark with `data-status` varied across the schema's enum.

| Status | Dot | Border style | Border width | Border colour | Text colour | Opacity |
|---|---|---|---|---|---|---|
| `Live` | **4 by 4, filled `rgb(143, 126, 240)`** | solid | 1px | `rgb(143, 126, 240)` | `rgb(143, 126, 240)` | 1 |
| `Complete` | none | solid | 1px | `rgb(101, 100, 113)` | `rgb(152, 151, 159)` | 1 |
| `In progress` | none | **dashed** | 1px | `rgb(101, 100, 113)` | `rgb(152, 151, 159)` | 1 |
| `Archived` | none | none | **0px** | no border is painted; the property answers `rgb(152, 151, 159)`, the inherited text colour | `rgb(152, 151, 159)` | 1 |

The ground behind them is `rgb(10, 0, 15)`, and the dot's fill is the accent exactly, which is the
F-8 tension noted below.

**Computed colours arrive as `lab()`, not `rgb()`, and that is a trap worth naming.** **Observed
2026-09-06.** `getComputedStyle` answers `lab(58.348 27.4837 -56.17)` for the accent. Parsing
numbers out of that string and treating them as sRGB is silently wrong: it reads a lightness of 58
as a red channel of 58. The sRGB triples above and every ratio below were obtained by painting each
colour into a 1 by 1 canvas and reading the pixel back, which is the conversion. The one place an
`rgb()` literal is compared against is print, where `app/scss/_print.scss` writes `#000` itself.

**`Live` and `Complete` are identical in border treatment**, both `1px solid`, and that is the
point rather than an oversight. `Complete` takes the shared block at `SuiteDirectory.scss:170-190`
unmodified, and `Live` overrides only colour. Without the dot the two values are separated by hue
alone.

## The distance hue could have carried, measured

**Observed 2026-09-06**, by the method above, as WCAG relative-luminance contrast, which is what
"apart in greyscale" means.

| Pair | Ratio | What it shows |
|---|---|---|
| `Live` border against `Complete` border | **1.773:1** | Far below 3:1. Colour alone cannot carry this distinction |
| `Live` text against `Complete` text | **1.133:1** | This is the **1.13:1** figure `DESIGN.md:312` cites |
| `Live` border against the ground | **6.286:1** | `DESIGN.md:300` records 6.20:1. The mark itself is legible; that was never the question |
| `Complete` border against the ground | **3.544:1** | `DESIGN.md:301` records 3.52:1 |

**Where the 3:1 comes from, stated rather than mis-cited.** **Decision.** It is **WCAG 2.1 SC 1.4.11
Non-text Contrast**, the floor for a visual boundary that carries information. `EXPERIENCE.md` does
not restate it for the Status mark: `:760` applies the same 3:1 to focus indicators (A-1) and `:762`
is A-3, which requires the taxonomy to be legible without colour but names no number. So 3:1 is the
general standard applied here, not a figure lifted from a row of that table, and an earlier draft of
this record cited `:760` for it wrongly.

**The against-ground readings sit slightly above `DESIGN.md`'s and the gap is not rounding.**
**Observed 2026-09-06.** 6.286 against 6.20, and 3.544 against 3.52. The likely cause is the ground:
these were measured against `body`'s actual `rgb(10, 0, 15)` rather than against pure black, which
raises both ratios a little. Not chased further, because nothing depends on the third decimal and
the assertion is a bound rather than a figure. Recorded so a later reader does not take the
difference for a token that moved.

**Why opacity is barred rather than merely unused.** `DESIGN.md:316-320` measured the alternative:
an `Archived` mark faded to 70% computes to **2.25:1 on its border and 3.87:1 on its text**, both
under the floors this system holds elsewhere. Dropping the container is what replaced it. The figure
is carried here because the rule reads as taste without it.

**`DESIGN.md:310-314` attributes the 1.13:1 figure to the border pair and the shipped border pair
measures 1.773:1.** **Observed 2026-09-06.** The 1.13 corresponds to the **text** pair, exactly.
This is a prose attribution in the design document and not an implementation defect: both numbers
sit under the 3:1 floor, so neither rescues a colour-only distinction and the argument for the dot
is unchanged either way. Editing `DESIGN.md` is outside this story, so it is filed in
`_bmad-output/implementation-artifacts/deferred-work.md` rather than corrected here.

**The spec file asserts the bound, not the figure.** **Decision.** A pinned ratio would fail on
every token movement, and the load-bearing claim is not "the number is 1.773" but "the number is
under the floor, so colour is not the signal". The two per-value contrasts against the ground are
asserted above 3:1 in the same case, so a broken colour conversion returning 1 for everything
cannot make the bound pass vacuously.

## In print, where hue is gone

**Print is the greyscale render, and it is real rather than simulated.** **Decision.** The obvious
check applies `filter: grayscale(1)` and measures nothing: a filter is a paint-time operation and
`getComputedStyle` answers with the pre-filter value, so every mark reports exactly the colour it
reported before. `app/scss/_print.scss:16-35` already forces the ground white, the text black, and
the mark's border, text and dot fill to `#000`, so `emulateMedia({ media: 'print' })` deletes hue at
source. Whatever still separates the four values there is structural by construction.

**Observed 2026-09-06**, same run and same method.

| Status | Border colour | Text colour | Dot fill | What is left |
|---|---|---|---|---|
| `Live` | `rgb(0, 0, 0)` | `rgb(0, 0, 0)` | `rgb(0, 0, 0)` | Solid 1px, **and the dot** |
| `Complete` | `rgb(0, 0, 0)` | `rgb(0, 0, 0)` | none | Solid 1px |
| `In progress` | `rgb(0, 0, 0)` | `rgb(0, 0, 0)` | none | **Dashed** 1px |
| `Archived` | `rgb(0, 0, 0)`, on a border of zero width | `rgb(0, 0, 0)` | none | **No border** |

**`Live` and `Complete` measure 1:1 apart in print on both their border and their text.**
**Observed 2026-09-06.** They are the same colour, the same style and the same width. The dot is
the entire distinction, which is `DESIGN.md:305-314` demonstrated rather than quoted, and it is why
`app/scss/_print.scss:12` exempts the dot by name from the sweep that hides every other
`aria-hidden` element.

## A-5's other half: the Status never truncates

**Observed 2026-09-06** at 360 by 800 in the pinned container. Six marks render, all `Live`.

| Figure | Value |
|---|---|
| Marks rendered | 6 |
| Content width against box width | 54px in a 54px box, on every one |
| Rendered box | 56.17 by 25.39 |
| Furthest right edge | 340.00, against a viewport of 360 |
| Lines the value occupies | 1 |
| `white-space` | `nowrap` |
| `text-overflow` | not `ellipsis` |

**The three values that never render are measured too**, by planting the text as well as the
attribute. `In progress` is the longest of the four and is held back by the FR-35 filter, so it is
the value that would truncate first and the one no clean read has ever seen. All four fit.

**Lines are counted on the text node through a `Range`, not by dividing height by line-height.**
**Decision.** The mark is padded `4px 8px` (`SuiteDirectory.scss:179`), so the arithmetic reports a
comfortably single-line `Live` as two, and ranging the element's whole contents is wrong the other
way because the dot is an inline fragment of its own. This was measured, not reasoned: the naive
version failed on a correct implementation.

## Failing loudly rather than vacuously

Every claim above has a case in `tests/e2e/status-mark.pw.ts` that was watched failing on a defect
injected into a live page through the browser, so no fixture is left in the tree. By the rule this
suite inherits from Story 2-8, a branch never observed to fail is not known to work.

| Case | What it proves | Nature |
|---|---|---|
| reads all four values the schema admits, off one real element | The enum really was read, so no loop below runs zero times, and the adjacency map still covers every value the schema declares | **Observed 2026-09-06** |
| separates every adjacent pair on something that is not hue and not opacity | The three axes, stated as one predicate over the three adjacent pairs | **Observed 2026-09-06** |
| computes the border treatment the record states, on every side of every value | The per-value table above, asserted rather than transcribed. Driven by the `EXPECTED` literal that `ops/__tests__/status-mark-axes.test.ts` holds this table equal to | **Observed 2026-09-06** |
| axis two: Complete is solid where In progress is dashed, at the same width | The dash is the axis, and not a thickness change wearing its name | **Observed 2026-09-06** |
| axis three: In progress has a border that Archived drops entirely | Zero on all four sides, and the mark still displayed | **Observed 2026-09-06** |
| and the whole read follows the stylesheet, rather than answering the same thing every time | Overriding the dash and the dropped border changes the reading | **Observed 2026-09-06.** The first version planted `border-width` alone on `Archived` and changed nothing, because a computed border-width is `0px` whenever the style is `none`. The control was wrong and the code was right, which is exactly what a control is for |
| is painted at 4 by 4 with a real fill on every Live mark | The dot exists in paint, not only in markup: 4 by 4, square at `0px` radius, filled, and **one per `Live` mark** rather than merely present somewhere | **Observed 2026-09-06** |
| and the same measurement fails against an implementation with the dot removed | The demonstration AD-19 asks for by name, in both shapes: suppressed, then deleted from the DOM | **Observed 2026-09-06** |
| survives print, where the mark keeps no colour of its own | The taxonomy with hue deleted at source | **Observed 2026-09-06** |
| and hue alone could never have carried the Live and Complete distinction, measured | The 3:1 bound, taken off the running page rather than quoted. The canvas conversion carries a sentinel and an alpha check, so a colour that failed to parse cannot read as a colour that matched | **Observed 2026-09-06** |
| and the print read is a live read, not the screen read under another name | `emulateMedia` really applied the print rules | **Observed 2026-09-06** |
| at 360 on the homepage, where the row has least room | A-5's Status clause on every rendered mark on the homepage | **Observed 2026-09-06** |
| at 360 on /projects, which renders the same component outside Container | The same, on the second route that renders the component. This is the route `ops/known-violations.md` records as already putting eight elements past the right edge | **Observed 2026-09-06** |
| and the same measurement fires against a mark clamped too narrow to hold its value | The truncation read follows the layout | **Observed 2026-09-06** |
| holds for the three values the filter never renders, in every row position | The values only a plant can reach, measured in **both** row positions. `groupByFamily` nests two rows inside `.suite-directory__family`, which is inset by `--s-md` on each side, so a nested mark has strictly less room than a top-level one and planting into the first mark alone would measure the roomiest | **Observed 2026-09-06** |
| carries no tooltip, no popover, no hover affordance and no place in the tab order | The mark is outside the 44 by 44 floor by property, not by omission | **Observed 2026-09-06** |
| and changes nothing at all when the pointer rests on it | Thirteen properties compared as one object before and after `hover()`, waiting on `--dur-major` read from the contract rather than a written figure | **Observed 2026-09-06** |
| and that comparison fires, measured against a hover state planted on the mark | A real `:hover` rule of the kind `EXPERIENCE.md:351` forbids, planted, and both the property comparison and the cursor read seen reacting to it | **Observed 2026-09-06** |

## What this deliberately does not assert

Naming these here is the point of the section: an assertion that exists is easily mistaken for one
that covers everything.

| Not asserted | Why not | Owner |
|---|---|---|
| That a person can tell the four apart | A machine can prove the values differ structurally and cannot prove a reader perceives the difference. That is the half O-9 asks a person for, and it is recorded below rather than claimed here | **Decision.** The Operator check below |
| Any viewport other than 360 by 800 | AD-19 states the floor at 360, and a second Playwright project is a change to the harness rather than to this assertion | **Decision.** Story 2-10 scope, same limit `ops/hit-target-floor.md` takes |
| The axes on `/projects`, as opposed to the A-5 clause | The stylesheet is global and `data-status` is the only seam, so the border treatment cannot differ by route. The **width** can, which is why the truncation cases run on both routes and these do not | **Decision.** Story 2-10 scope. Story 2-14 redirects `/projects` at `/#suite`, after which there is one route |
| The mark under `forced-colors` or a user stylesheet | A different medium with different rules, and no requirement in this plan states one. The dashed and dropped borders survive it, being structural; the dot is a filled box and a fill is what that mode reassigns | **Decision.** No owner, because no requirement exists to own. Filed in `deferred-work.md`, which names Story 2-26 (the manual accessibility pass) as the natural place to decide whether the estate makes a claim there at all |
| Contrast of the mark against the ground as a gate | Measured here at 6.286:1 and 3.544:1 and used to prove the colour conversion works, but not asserted as a floor. `.lighthouserc.js:15` asserts accessibility at 0.95, severity error, and was not touched | **Decision.** Unchanged by this story (AD-19, AD-21) |
| The dot's colour as a contract role | It fills with `--token-accent`, which `RESTYLE-SPEC.md:654` states F-8 as a binary grep expecting zero of. The dot needs a named exemption there rather than a softened predicate | **Decision.** Story 2-34, filed in `deferred-work.md` by Story 2-9 |
| Focus, keyboard reachability, and the manual accessibility pass | A different requirement with a different instrument | **Decision.** Story 2-26 |

## The greyscale check O-9 asks a person for

O-9 (`EXPERIENCE.md:1057`) is a **render check**, not only a computation: render the Directory
desaturated and confirm all four Status values remain distinguishable with no legend. The machine
evidence above stands on its own and is what makes the check re-runnable against a regression. This
row is the human confirmation, and it is recorded because a check that leaves no record cannot be
re-run.

| Field | Value |
|---|---|
| Method | Rendered `/` at a 360 wide viewport against the local dev server, with one of each of the four values planted across the six marks and the page desaturated by `filter: grayscale(1)` on the root element. The plant mirrors what the component renders, the dot removed from the three values that do not carry one, so what was read is the directory as it would ship rather than a picture of one that does not exist. Read with no legend to hand |
| Checked by | The Operator |
| Checked on | **2026-09-06** |
| Result | **Pass.** All four Status values distinguishable in greyscale with no legend. `Live` and `Complete`, the pair with identical boxes and therefore the one the whole argument rests on, separated by the dot alone |

**Three of the four values cannot be seen on the running site, for two different reasons.**
`RENDERED_STATUSES` (`lib/registry.ts:91`) is `Live` and `Complete`, so the FR-35 filter holds back
**`In progress` and `Archived`**; `Complete` would render and no entry in `contracts/registry.json`
carries it. Only `Live` reaches the page. The print preview shows the `Live` rows and the dot in
ink; the other three are reached the same way the spec file reaches them, by setting `data-status`
on a mark in the browser's element inspector.
