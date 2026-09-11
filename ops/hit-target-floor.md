# The hit-target floor

The written record of the instrument Story 2-8 installed: what a machine now asserts about the
size of every tappable thing the Hub renders, which surfaces are knowingly under the floor and
what closes each one, how the floor is sourced, and what this assertion deliberately does not
cover.

**The requirement is A-4**, `EXPERIENCE.md:763`: "Targets at least 44x44px, independently
addressable, via `min-height` plus `inline-flex`, **measured, not assumed**", binding on FR-3.
This story implements the measured-not-assumed half of it and the first clause. **A-5**,
`EXPERIENCE.md:764`, is asserted alongside it, less the Status half, which Story 2-10 closed on
2026-09-06 in `tests/e2e/status-mark.pw.ts` and recorded in `ops/status-mark-axes.md`. Where this
file says "the floor" it means A-4; where it says A-5 it means the no-horizontal-scroll half of
A-5. **Independently addressable** is the clause of A-4 this story does **not** close, and it is
filed as such under the stated limits below.

Written during Story 2-8 on **2026-09-06** (ISO 8601 UTC), against baseline commit
`9f71fba`.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/rendered-output-harness.md`, `ops/known-violations.md` and
`ops/estate.md` set: every value is marked as either a decision or an observation, and the two
are never presented as the same kind of fact (NFR-9). An observed value carries the method that
gathered it, because a number without a method is a claim.

**Story ids are written hyphenated**, as `Story 2-8` and `Story 2-15`, matching the keys in
`_bmad-output/implementation-artifacts/sprint-status.yaml`. `epics.md` writes the same ids
dotted. They are the same stories.

## What is asserted

`tests/e2e/hit-target-floor.pw.ts` runs inside the existing `rendered-output` job. No job was
added to `.github/workflows/ci.yml`: `:276-277` already runs the whole `tests/e2e` directory, and
a seventh job would fail the two suites that pin the job names as an exact set.

| Assertion | What it answers | Nature |
|---|---|---|
| The floor (A-4) | Does every interactive element on every Hub surface measure at least `--tap` on both axes, or appear in the exemption ledger below | **Decision.** AD-19, `EXPERIENCE.md:763`, `epics.md:2334-2342` |
| The route set | Is every route `app/` serves either a swept surface or a declared non-Hub route | **Decision.** Derived from the filesystem, so a route a later story adds cannot go unswept while KV-4 claims every route is covered |
| The ledger, forwards | Does anything under the floor escape the ledger | **Decision.** An unlisted breach fails the build naming the route, a stable selector and the measured box |
| The ledger, backwards | Does the ledger still describe the tree | **Decision.** A listed element that now clears the floor fails as a **stale row**; so does a row that has stopped matching **on any one of the routes it lists**; and so does a row that covers a different number of elements than it says. The list can only shrink |
| A-5 | Does any measured element's right **or left** edge sit outside the viewport at 360 wide | **Decision.** `EXPERIENCE.md:764`, less the Status half, which Story 2-10 asserts in `tests/e2e/status-mark.pw.ts` because the mark is not interactive and this sweep never reaches it |
| The count | Did each surface yield exactly what it is registered to yield | **Decision.** The three per-surface counts are pinned rather than bounded, and the guard is a predicate driven by a standing case with synthetic counts rather than an inline assertion inside the sweep |

**The floor is read, never written.** **Decision.** It comes off `--tap` on `:root` in the
running page through `rootCustomPropertyValue` (`tests/e2e/harness.ts:164`), and the spec file
contains no pixel literal for it. `contracts/tokens.css:93-100` authors `--tap` as the one length
in the contract that is a physical-size guarantee rather than a reader-scaled value, and Story
2-34's conformance gate rejects a hand-written copy of it like any other spacing literal
(`epics.md:3740`, `DESIGN.md:654-656`). A floor restated in a test is a floor that drifts from the
contract it claims to enforce.

**Verified by `git grep -nE "\b44(px)?\b" -- tests/e2e/hit-target-floor.pw.ts`, which returns
nothing.** **Observed 2026-09-06.** The same scan runs as a standing case in
`ops/__tests__/hit-target-floor.test.ts`, with two exemptions stated rather than assumed: a
`measured:` string literal in the ledger and a `file.ext:NN` citation both carry those digits
without being a hand-written floor, and failing on either would make this record unwritable for
the exact values it exists to hold. What is left is a `44` used as a number in code or in prose.

## What counts as an interactive element, and what is skipped

**Decision.** Native interactive elements plus the WAI-ARIA widget roles, listed in `INTERACTIVE`
in the spec file. `a` without `href` is not a target and is not matched. `[tabindex="-1"]` is
programmatically focusable rather than tappable and is not matched either.

A matched candidate is then removed before measurement, and **not counted**, when any of these
holds. This is the whole of the rule; anything else the sweep should skip is a change to it
rather than a special case.

| Rule | Why | The real case |
|---|---|---|
| Inside an `[aria-hidden="true"]` subtree | Removed from the accessibility tree is not a target a person can reach | Nothing in the Hub today. `.work-item__icon` (`WorkItem.tsx:80`) carries `aria-hidden` and is a `<span>`, so it never enters the candidate set in the first place: it is the button around it that is measured, at 216.00 x 88.80 |
| Inside a subtree carrying the `hidden` attribute | Same | None today |
| Generates no box (`display: none`, or detached) | There is nothing to measure and nothing to tap | **`/celeste`.** `celeste.scss:8-10` hides the header, so all of its candidates are removed. **Seven, observed 2026-09-06**; **three, observed 2026-09-08**, after Story 2-15 reshaped the header |
| Zero area on either axis | Same | None today |
| `visibility: hidden` | Same | None today |

## The surfaces swept

**Observed 2026-09-06** in `mcr.microsoft.com/playwright:v1.62.1-noble`, at the pinned 360 x 800
viewport, by reading the counts the sweep prints when it fails (see the probe below).

**Re-measured 2026-09-06** by the same method, after Story 2-9 replaced the `/projects` card grid
with the Suite Directory and mounted the same directory on `/`. `/` went from 5 to 16 and
`/projects` from 19 to 18; the other three did not move. Both numbers were read off the sweep's own
failure output in the pinned container, not computed from the six rendered Registry entries, which
is the arithmetic that would have been wrong had a link failed to render.

**These three numbers are pinned, not bounded.** **Decision.** They are `SURFACES` in
`tests/e2e/hit-target-floor.pw.ts`, held equal to this table by
`ops/__tests__/hit-target-floor.test.ts` the same way the exemption ledger is. A bounded "at least
one element" guard would let a seventh chrome link, or a control that stopped rendering, pass with
no number moving. A story that changes what a surface renders moves the number in both places, in
one commit.

| Surface | Status | Candidates found | Skipped | Measured |
|---|---|---|---|---|
| `/` | 200 | 17 | 0 | 17 |
| `/work` | 200 | 7 | 0 | 7 |
| `/cv` | 200 | 9 | 0 | 9 |
| `/celeste` | 200 | 3 | 3 | 0 |
| `/a-route-that-does-not-exist` | 404 | 4 | 0 | 4 |

**37 elements measured across five surfaces.**

**Re-measured 2026-09-07** after Story 2-13 built the non-3D front door. `/` went from 16 to 17 and
the other four did not move. The one new element is the A-6 skip-link, which renders on every path
and is positioned above the viewport rather than clipped to a pixel, so it keeps a real box this
floor can measure and clears it on both axes. The story's other control, the skip control, renders
on the default path only, and this sweep runs the `reducedMotion: 'reduce'` context
(`playwright.config.ts:79`), which is the non-3D path: it is measured in
`tests/e2e/front-door.pw.ts` instead, on a context that has not asked for reduced motion.

**Re-measured 2026-09-07** after Story 2-14 redirected `/projects` to `/#suite` and deleted the page
behind it. That surface left the table rather than moving a number: `app/projects/page.tsx` is off
disk, so the derived route walk no longer produces the route and a row left here would fail as a
phantom. **The other four did not move**, and that is a reading rather than an assumption: the four
rows below are pinned, not bounded, so the sweep passing in
`mcr.microsoft.com/playwright:v1.62.1-noble` on 2026-09-07 is what says each surface yielded exactly
these numbers. A count that had moved would have failed and printed its own `found`, `skipped` and
`measured` per route, which is the reading § Maintaining this file describes taking; nothing here
was computed from the Registry.

The eighteen elements the deleted route measured were one logo link, six chrome nav links and the
eleven Suite Directory links its second rendering of the directory produced. None of them existed
anywhere else, which is why two ledger rows lost a route in the same commit and the sweep's total
fell from 54 to 36 rather than by the seven chrome elements alone.

**Re-measured 2026-09-08** after Story 2-15 reshaped the header to two destinations. `/work` went
from 11 to 7, `/celeste` from 7 to 3 and the 404 from 8 to 4; `/` did not move. The three surfaces
that carry chrome each lost four candidates, which is the five inline links plus the `mailto:` the
header rendered, **six anchors**, less the two that replace them. `/` is unchanged for two reasons
rather than one:
`Header.tsx:12` renders no header on the home route at all, and the homepage panel's second link
was **repointed and relabelled rather than removed**, so it is the same element at the same size
answering a different `href`.

**How these four were established, stated rather than implied.** The rows are pinned, not bounded,
so the sweep passing in `mcr.microsoft.com/playwright:v1.62.1-noble` on 2026-09-08 is what says
each surface yielded exactly these numbers: a count that had moved would have failed and printed
its own `found`, `skipped` and `measured` per route, which is the reading § Maintaining this file
prescribes. The pins were written from what the reshaped header renders and then confirmed by that
run; nothing here was computed from the Registry or from the markup after the fact.

**Re-measured 2026-09-10 after Story 2-16 built `/cv`.** That route answered a 308 to `/pdf/cv.pdf`
and was one of the three non-Hub routes below; the story removed the redirect and built the page
behind it, so the route left that list and arrived here as a fifth surface. **The other four did not
move.** `/cv` yields nine: the chrome logo, the two nav links and the four accordion triggers `/work`
also yields, plus the two links the intro block adds. `PlateMark` contributes none, nothing in it
being interactive by its own docblock, and the page carries no button, no CTA and no skeleton. The
whole-run total goes from 28 across four surfaces to 37 across five, and seven of the nine are
renderings of controls that already existed rather than new authored ones: the logo, the nav and the
accordion are the same components mounted on one more route. Only the intro block's two links are
authored here, and both are built to `--tap` on both axes, so the exemption ledger gains no row and
`chrome-logo` simply covers one element more.

**How this fifth row was established.** The rows are pinned, not bounded, so the sweep passing in
`mcr.microsoft.com/playwright:v1.62.1-noble` on 2026-09-10 is what says `/cv` yielded exactly these
numbers: the pins were written from what the new page renders and then confirmed by that run, which
would have failed and printed its own `found`, `skipped` and `measured` per route had any of the
three been wrong. Nothing here was computed from the Registry or from the markup after the fact.

**`/projects` is in neither this table nor the non-Hub list, and that is deliberate.** A browser
asked for it now gets a 301 to `/#suite` and lands on `/`, which is a Hub surface this sweep already
measures. Playwright follows redirects, so a row that merely kept the route would have gone green
while measuring `/` twice, and the non-Hub list refuses anything answering `text/html`. The redirect
is asserted on its own in `tests/e2e/projects-redirect.pw.ts`, where the status and the `Location`
header are read without following.

**The route set itself is derived from `app/`, not from this table.** **Decision.** A standing case
walks `app/` for `page.tsx`, `route.ts` and `not-found.tsx`, in the shape
`tests/e2e/contract-serving.pw.ts:88-95` uses over `contracts/`, and fails naming any route that is
neither a swept surface nor a non-Hub route. Without it, Story 2-9 could add a surface that the
sweep never visits while KV-4 goes on stating in writing that the floor is enforced on every route.
A dynamic segment is refused rather than guessed, because there is no single URL to sweep for it.

**`/celeste` is the one surface that measures zero, and it says so rather than reaching it by
accident.** **Decision.** `SURFACES` in the spec file carries `expectsMeasured: false` for that
route alone, and the sweep asserts both halves there: the selector still matches three candidates,
and all three are removed by the visibility rule. Written as a bare "at least one element per
route" guard it would have been the one route where a broken selector looked exactly like a
correct skip. **Seven candidates until 2026-09-08**, when Story 2-15 reshaped the header the rule
hides; the argument is unchanged and only the count moved.

**Two routes render no Hub markup and are excluded by measurement, not by omission.**
**Observed 2026-09-10** by `page.request.get`, which follows the redirect and reports where a
visitor lands. `/recommendation` lands on `/pdf/recommendation-letter.pdf`, `application/pdf`, and
`/api/health` answers `application/json`. A standing case asserts both, so a route that quietly
starts rendering HTML fails there rather than leaving a hole in the sweep.

**Three until 2026-09-10**, when Story 2-16 built `/cv` and it moved into the table above. The
argument is unchanged and only the count moved: left in this list it would have failed the standing
case for answering `text/html`, which is exactly the hole that case exists to close, rather than
passing quietly. The 2026-09-06 reading of the same three was `/cv` landing on `/pdf/cv.pdf` and
`/recommendation` on `/pdf/recommendation-letter.pdf`, both `application/pdf`, with `/api/health`
answering `application/json`; the only figure that moved is the number of PDF landings, from two to
one.

## The floor

| Value | Number | Nature |
|---|---|---|
| `--tap` | **44px**, on both axes | **Decision.** `contracts/tokens.css:100`, minted 2026-08-16 (`epics.md:3740`) |
| Viewport | 360 x 800 | **Decision.** `RENDERED_VIEWPORT` in `tests/e2e/harness.ts:11`, which holds the width and the height and nothing else. The sweep imports it rather than restating either number |
| `deviceScaleFactor` | **1** | **Decision.** `playwright.config.ts:73`, not `RENDERED_VIEWPORT`. It is a project option rather than part of the viewport constant, and a sweep that assumed otherwise would be citing a file that does not carry the value |
| Slack on the floor | **None.** A box measured under `--tap` is under it | **Decision** |
| Slack on the A-5 right edge | **0.5px** | **Decision.** Layout produces fractional positions, and a target ending a third of a pixel past the viewport is rounding rather than horizontal scroll |

## The exemption ledger

**Every row names the story whose own acceptance criteria close it.** **Decision.** Story 2-8
ships the instrument; it changes no component and no stylesheet. The repairs are booked, and each
of those stories already names this floor as its own acceptance condition, so a row is deleted by
the commit that repairs the surface rather than by a later tidy-up.

`ops/__tests__/hit-target-floor.test.ts` holds this table and the `EXEMPTIONS` const in
`tests/e2e/hit-target-floor.pw.ts` equal **in both directions**: a row here with no entry there
fails, and an entry there with no row here fails the same way. Neither file is the only reader of
the other.

**`Covers` is an expectation, not a note.** It is the exact number of measured elements the row
accounts for across the routes it lists, and it is what stops a selector exempting more than it was
written for: a third `a.nav-link` at 320 x 23 would make that row cover three and fail, rather
than inherit an exemption written for two links. The run also fails if a row matches nothing **on
one of its routes**, so a row covering two surfaces cannot go half stale in silence.

| Id | Selector | Source | Routes | Covers | Measured (2026-09-06) | Closed by |
|---|---|---|---|---|---|---|
| `chrome-logo` | `.logo a` | `components/atoms/Logo/Logo.tsx:7` | `/work`, `/cv`, `/a-route-that-does-not-exist` | 3 | 184.00 x 20.00 | Story 2-32 |
| `error-back` | `a.error-page__back` | `components/organisms/ErrorPage/Error404.tsx:50` | `/a-route-that-does-not-exist` | 1 | 108.58 x 38.19 | Story 2-30 |
| `home-nav` | `a.nav-link` | `components/organisms/HomeLayout/HomeLayout.tsx:142,150` | `/` | 2 | 320.00 x 23.00 | Story 2-32 |
| `home-contact` | `.contact-container a` | `components/molecules/ContactContainer/ContactContainer.tsx:5,8,15` | `/` | 3 | 58.00 x 23.00 to 84.00 x 23.00 | Story 2-32 |

**`chrome-logo` gained a route on 2026-09-10 and gained no breach.** Story 2-16 built `/cv`, which
renders the same header, so the same authored link is measured on a third surface and `Covers` moves
from 2 to 3. No control was repaired, none was added and the recorded box is untouched: this is the
one direction the ledger is allowed to grow in, a surface arriving rather than a breach. The
alternative would have been the sweep reporting the `/cv` logo as an element under the floor that
no row lists, which is what a row narrower than the tree looks like.

**`home-nav`'s `source` was corrected on 2026-09-08 and its measurement was not.** It cited
`HomeLayout.tsx:64,67` from Story 2-8 onwards, which was 78 lines stale: Story 2-15 edited the
second of the two real lines and read the citation while doing it. The agreement suite holds the
**file** to disk and holds nothing about the line numbers, so a citation like this one stays true
only because somebody editing the file keeps it true. The box the row records is untouched, which
is the point of repointing a link rather than rebuilding it.

**Every size above was measured in the browser, never read off the CSS.** **Observed 2026-09-06**
by `Element.getBoundingClientRect()` in the pinned image at 360 x 800, after `document.fonts.ready`
resolved and after the home entrance had settled. `EXPERIENCE.md:731-732` says this floor is the
single easiest one to miss while appearing to meet it, and reading a stylesheet is exactly how it
gets missed.

**Six rows at Story 2-8, five after Story 2-9, four now, where that story's code map named four.**
**Observed 2026-09-06**, and re-read **2026-09-08** after Story 2-15 deleted `chrome-nav`.
`chrome-logo` was not on that list and was found by sweeping: `Logo.tsx:7` is a plain
inline `<a>` wrapping a 184 x 66 image, so the element's own box is the 20px text line box while
the image paints past the bottom of it. That is the same class of defect the ledger exists to
record, and it is the clearest argument for a universal sweep over a list of surfaces someone
remembered. Story 2-32 names `Logo` in its own title (`epics.md:3559`) and is what closes it. The
home surface is carried as two rows because it is authored in two files at two different sizes.

**`directory-links` was deleted by Story 2-9**, in the commit that replaced the `/projects` card
grid with the Suite Directory. **Observed 2026-09-06** in the pinned container: the directory's
live and source links measure at or above the floor on both axes, so the sweep reports no unlisted
element under it on either surface the directory renders on. This is the ledger shrinking in the
direction it is only allowed to move.

**`chrome-logo` and `chrome-nav` each lost a route on 2026-09-07**, with no row deleted and no
selector narrowed. **Observed 2026-09-07.** Story 2-14 redirected `/projects`, so the two chrome
rows now list `/work` and the 404 only, and `covers` fell from 3 to 2 and from 18 to 12: one logo
link and six nav links per route, on one route fewer. Both authored controls are untouched and both
are still under the floor, so this is the same breach measured on one surface fewer rather than a
partial repair. Neither closing story moved.

**`chrome-nav` was deleted by Story 2-15 on 2026-09-08**, in the commit that rebuilt the header's
links against the floor. **Observed 2026-09-08** in the pinned container: the two destinations that
replace the five inline links plus the `mailto:` measure at or above `--tap` on both axes, so the sweep
reports no unlisted element under it on either surface the header renders on, and the row went
stale in the direction that forces its own deletion. `chrome-logo` is untouched and stays: the logo
is a sibling of the nav rather than one of its links, and it is Story 2-32's. This is the second
time the ledger has shrunk and the first time a row named in KV-4's closing list has gone.

**Per-element detail behind the ranges**, **observed 2026-09-06**, so a later reader can see how
far under the floor each one is without running anything. **The six `nav.navbar a` rows left this
table on 2026-09-08 with the `chrome-nav` row they detailed**: they were the breakdown behind a
range this file no longer carries, and the elements they measured no longer exist. Their sizes are
not lost, because the deleted ledger row and the paragraph above both record the range, and the
one that read `38.41 x 22.00`, the narrowest chrome link and the only element in the whole census
failing on both axes, is named in KV-4 as well.

| Element | Measured | Which axis fails |
|---|---|---|
| `.logo a` | 184.00 x 20.00 | Height |
| `a.error-page__back` | 108.58 x 38.19 | Height. The nearest miss, 5.81px short |
| `a.nav-link`, both home links | 320.00 x 23.00 | Height |
| `.contact-container a`, "Github" | 68.00 x 23.00 | Height |
| `.contact-container a`, "LinkedIn" | 84.00 x 23.00 | Height |
| `.contact-container a`, "Email" | 58.00 x 23.00 | Height |
| `button.work-item__header`, all four | 216.00 x 88.80 | **None.** These clear the floor, which is what keeps the comparison from being a check that always fails |

**The four `.work-item__header` buttons are load-bearing for the whole assertion.** **Decision.**
A standing case asserts that at least one measured element clears the floor and at least one does
not. Without it, a floor misread as an enormous number would put every element under it, and the
sweep would still be green because everything under the floor is on the ledger today. Story 2-9
added 22 more elements that clear the floor, which strengthens the same case rather than replacing
it: the buttons are on a route the directory does not render on. **Eleven of those 22 left with
Story 2-14** on 2026-09-07, the second rendering of the directory going with the route, and the
buttons keep the case load-bearing on their own as they did before Story 2-9. **Story 2-15 added
four on 2026-09-08**, two nav links on each of `/work` and the 404, and they are the first controls
on a route the buttons do not render on that clear the floor, so the standing case's other half
now holds on the 404 without leaving that surface.

## The tolerated breach

**9 of the 37 measured elements are under the floor.** Behind those 9 rendered instances are
**7 authored controls**: one logo link, one back link, two home nav links and three home contact
links. **Observed 2026-09-10**, after Story 2-16. Only the rendered count moved and the reason is a
route rather than a regression: `/cv` became a page and renders the same header, so the logo link is
measured on a third surface. The two controls that page authors itself, the intro block's links, are
built to `--tap` on both axes and are in the twenty-eight that clear it.

**Re-measured 2026-09-08**, and that reading is kept rather than overwritten: it was 8 of 28 behind
the same 7 controls. Both counts moved that time and the reason was a repair rather than a route:
the six chrome nav links met the floor and their row was deleted, so six authored controls left the
census along with the twelve instances they rendered as.

**Re-measured 2026-09-07**, and that reading is kept rather than overwritten: it was 20 of 36
behind 13 controls, the six extra being the chrome nav links rendered on two surfaces each. The
authored count had not moved at that point and the rendered one had, the seven chrome controls
being rendered on two surfaces rather than three after Story 2-14.

**Re-measured 2026-09-06**, and the earlier reading is kept rather than overwritten: it was 39 of
43 behind 15 controls, the extra two being the card links `.project-card__links a` rendered six
times each on `/projects`. Story 2-9 deleted the component and its ledger row together, so both the
authored count and the rendered count fell.

The 28 elements that clear the floor are the eight `.work-item__header` buttons, four on each of
`/work` and `/cv`, the eleven Suite Directory links on `/`, the A-6 skip link Story 2-13 added, the
six chrome nav links Story 2-15 rebuilt, two on each of `/work`, `/cv` and the 404, and the two
intro links Story 2-16 authored on `/cv`. **Observed 2026-09-10.** The 2026-09-08 reading of the
same figure was 20, over four buttons and four nav links, and the 2026-09-07 one was 16.

**The two figures above were one out before this re-measurement, and that is filed rather than
back-dated.** **Observed 2026-09-07.** They read 27 of 53 and 26 respectively while the surfaces
table summed to 54: Story 2-13 moved `/` from 16 to 17 and updated the table and the total, and
these two derived sentences were not carried with it. Nothing reads them, which is DW-53's subject,
and the drift is recorded in `deferred-work.md` so a later reader can tell a correction from a
re-measurement.

Those 7 are a live breach of AD-19 and are recorded as **KV-4** in
`ops/known-violations.md`, with the ruling that tolerates them and the two stories that retire
it. **Three stories until 2026-09-08**, when Story 2-15 closed its own row and left that entry's
list. The A-5 half is **KV-5** in the same file: Story 2-9 repaired its stylesheet half, and the
component half, 28 elements owned by `WorkItem.scss` and `WorkHero.scss`, keeps that entry `Open`.
This file describes the instrument; that file is the register of what the estate is knowingly
running in breach.

## The probe demonstration

A gate never observed to fail is not known to work. The probe was applied, run, its output
recorded here verbatim, and reverted. **The probe is not in the tree at this story's closing
commit**, which is why its output lives in this file. Same rule as
`ops/rendered-output-harness.md:238-252`.

**A probe is a one-time demonstration; the standing cases are something else.** **Decision.** A
demonstration recorded in a file proves the gate could fail on 2026-09-06. It proves nothing about
the run after someone widens the ledger or loosens the candidate selector. So every predicate this
story introduced is **also** asserted permanently, by the fourteen further cases in the same spec
file, most of them injecting their defect into one page through the browser so it touches no file.

### Probe 1: an element compliant only through vertical padding on a plain inline element

| Field | Value | Nature |
|---|---|---|
| The probe | `<a href='/probe' style={{ display: 'inline', padding: '0.25rem 0' }}>Read the documentation</a>` added after the back link in `components/organisms/ErrorPage/Error404.tsx` | **Decision.** The case `DESIGN.md:645-648` and `EXPERIENCE.md:727-732` single out by name. The label is deliberately long, so the width axis clears the floor and the failure is the height alone rather than "it is a small element" |
| Result | The sweep failed | **Observed 2026-09-06** in the pinned container |
| Measured box | **174.00 x 29.00** | **Observed.** `DESIGN.md:646` predicts "~29px tall no matter what the padding says". The prediction was made by reading the CSS; this is the number a browser produced |
| Reverted | Yes, by `git checkout -- components/organisms/ErrorPage/Error404.tsx` | **Observed**, confirmed by `git status --porcelain` |

The runner's own output, quoted:

```
Error: an interactive element is under the 44 floor and no exemption lists it. AD-19 makes this the build's problem rather than a reviewer's:
/a-route-that-does-not-exist: body#_not-found > div.error-page:nth-of-type(2) > div.error-page__content:nth-of-type(2) > a:nth-of-type(2) ("Read the documentation") measures 174.00 x 29.00, and the floor is 44 on both axes. Nothing in the exemption ledger lists it.

/: found 5, skipped 0, measured 5
/work: found 11, skipped 0, measured 11
/projects: found 19, skipped 0, measured 19
/celeste: found 7, skipped 7, measured 0
/a-route-that-does-not-exist: found 9, skipped 0, measured 9

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "/a-route-that-does-not-exist: body#_not-found > div.error-page:nth-of-type(2) > div.error-page__content:nth-of-type(2) > a:nth-of-type(2) (\"Read the documentation\") measures 174.00 x 29.00, and the floor is 44 on both axes. Nothing in the exemption ledger lists it.",
+ ]
```

**Two tests went red on that run and both are the correct answer**, so both outputs are here
rather than one: this section's rule is that output is pasted verbatim, and a summarised second
failure is a claim about a run rather than a record of it. The second is the standing case that
plants an undersized control on the same surface and asserts exactly one unlisted breach is
reported. It counted two, because the probe was the other:

```
  2) [chromium] › tests/e2e/hit-target-floor.pw.ts:661:7 › the hit-target floor › fails on an unlisted element under the floor, naming the route, the selector and the box

    Error: the planted undersized control was not reported

    expect(received).toHaveLength(expected)

    Expected length: 1
    Received length: 2
    Received array:  ["/a-route-that-does-not-exist: body#_not-found > div.error-page:nth-of-type(2) > div.error-page__content:nth-of-type(2) > a:nth-of-type(2) (\"Read the documentation\") measures 174.00 x 29.00, and the floor is 44 on both axes. Nothing in the exemption ledger lists it.", "/a-route-that-does-not-exist: body#_not-found > a#planted-undersized (\"x\") measures 10.00 x 10.00, and the floor is 44 on both axes. Nothing in the exemption ledger lists it."]
```

**The line numbers in both quoted blocks are the ones the file had on 2026-09-06 before the review
pass, and they have moved since.** They are left as the runner printed them, because editing a
quoted transcript to keep its citations current is how a record stops being evidence.

### What the probe corrected about the design's wording

**Observed 2026-09-06**, by measuring five planted shapes on the 404 surface with
`getBoundingClientRect()` in the pinned image. This is a finding, and it is recorded rather than
smoothed over, because the story's own matrix restated the design's phrasing.

| Planted | Measured | What it shows |
|---|---|---|
| `display: inline` with no padding | 174.00 x 20.00 | The line box |
| `display: inline; padding: 0.25rem 0` | 174.00 x **29.00** | Vertical padding **is** in the border box of an inline element, and the box still lands nowhere near the floor. 20 plus 8 is 28, plus a fraction of a pixel of line box the round trip rounds to 29 |
| `display: inline; padding: 0.75rem 0` | 174.00 x **44.00** | **The limit.** A plain inline element padded to 12px on each side reaches the floor and **passes this sweep**, while its line box is still 20px and it still overlaps its neighbours |
| `display: inline-flex; align-items: center; min-height: 44px; padding-inline: 12px` | 60.00 x 44.00 | The shape `EXPERIENCE.md:727-728` prescribes |

So the accurate statement is not that `boundingBox()` measures the line box and ignores the
painted padding. It is that **vertical padding on a plain inline element does not grow the line
box, and reaching 44 that way takes so much padding that the element overlaps whatever is above
and below it.** The sweep catches the ~29px case, which is the one that occurs in practice and the
one AD-19 names. It does not catch a plain inline element padded all the way to the floor. That
limit is stated below rather than papered over.

## What this deliberately does not assert

Naming these here is the point of the section: an assertion that exists is easily mistaken for one
that covers everything.

| Not asserted | Why not | Owner |
|---|---|---|
| A plain inline element padded to exactly the floor | It measures 44.00 and passes, as the table above shows. Closing it means asserting something about `display` or about overlap rather than about a box, which is a different predicate from the one AD-19 states | **Decision.** Story 2-8 scope. Story 2-32 asserts the shape (`min-height` plus `inline-flex` plus `padding-inline`) at the surface it rebuilds (`epics.md:3579-3580`) |
| Non-interactive elements against A-5 | The sweep measures interactive elements, and A-5 is asserted on the right edge of each one. **The Hub does overflow at 360 today, on elements that are not targets**, and that is measured rather than assumed: see the row below | **Decision.** Filed as deferred work. Story 2-9 repaired the stylesheet half; Stories 2-31, 2-33 and 2-14 own the elements that still sit outside the viewport |
| The Status mark's axes, and Status truncation | Not interactive (`EXPERIENCE.md:351`), so this sweep never reaches the mark and the three structural axes are a different predicate needing a different instrument. **Closed elsewhere, not still open:** Story 2-10 built that instrument on 2026-09-06 as `tests/e2e/status-mark.pw.ts`, recorded in `ops/status-mark-axes.md`. Nothing moved in this file's ledger or surfaces, because a non-interactive element is outside the floor by property rather than by exemption | **Decision.** Story 2-10, **2026-09-06** |
| Any viewport other than 360 x 800 | AD-19 states the floor at 360, and a second Playwright project is a change to the harness rather than to this assertion | **Decision.** Story 2-8 scope |
| Whether a target is reachable by keyboard, or has a focus ring | A different requirement with a different instrument | **Decision.** Story 2-26 |
| The union of an element and what it paints | `boundingBox()` measures the element's own border box. `.logo a` is the live case: its box is 20px tall and the image inside it is 66px, so the thing a finger actually hits is larger than the thing the floor measures. The floor is deliberately about the element itself (`EXPERIENCE.md:727`), and the row is exempted rather than argued away | **Decision.** Story 2-32 |
| Contrast, and anything Lighthouse covers | `.lighthouserc.js:15` still asserts accessibility at 0.95, severity error, and was not touched. **Observed 2026-09-06**, by `git diff --stat 9f71fba -- .lighthouserc.js`, which was empty | **Decision.** Unchanged by this story (AD-19, AD-21) |

**One row left this table on 2026-09-06.** **A-4's "independently addressable" clause**
(`EXPERIENCE.md:763`) asks whether two adjacent targets are separately hittable as well as big
enough, which is a statement about the relationship between two boxes rather than about one box.
At Story 2-8 nothing on the shipped Hub put two targets on one line at 360 wide, so there was
nothing to overlap, and the row said the check lands with the surface that first does. Story 2-9's
Suite Directory is that surface, and the clause is now a standing case in the same spec file: the
two destinations on a row are measured against `--s-lg`, resolved through a probe element because
it is authored in `rem` and has no pixel value until something lays it out.

**The chrome nav joined it on 2026-09-08.** Story 2-15 made the header the second surface in the
Hub to put two targets on one line at 360, and the same predicate is asserted over both chrome
surfaces in `tests/e2e/chrome-nav.pw.ts`, with `--s-lg` resolved on a probe in the same way and a
control that removes the `gap` and watches the pair report as too close. Without it, deleting
`gap: var(--s-lg)` from `navbar.scss` left every other assertion in that story green: the floor is
measured per element, and this file's pairwise case is scoped to `.suite-directory__row`. Story
2-32 (`epics.md:3583-3584`) still owns the header's **treatment**; what it no longer owns is
whether the two boxes can overlap.

### The overflow this assertion does not cover, measured

**Observed 2026-09-06** in the pinned image, by comparing every element's **right edge** against
`window.innerWidth` on each surface. Recorded here because a green A-5 could otherwise be read as
"nothing on the Hub overflows at 360", which is false. **The left edge was not swept in this
census**, so the counts below are a floor on the number rather than the whole of it; the standing
A-5 assertion checks both edges, on interactive elements only.

| Surface | Elements past the right edge | Furthest | `document.documentElement.scrollWidth` |
|---|---|---|---|
| `/` | 0 | n/a | 360 |
| `/work` | **28** | `span.work-item__icon` at **490.67** | **491** |
| `/projects` | **8** | `div.projects-hero__text` at **372.00** | 360 |
| `/celeste` | 0 | n/a | 360 |
| `/a-route-that-does-not-exist` | 0 | n/a | 360 |

**`/projects` is the case that settles the method.** Eight elements sit 12px past the viewport
while `scrollWidth` reports 360. An A-5 check written against `scrollWidth` would have been green
on that route while the condition it exists to detect was present. That is why A-5 is measured on
element right edges here, and it is the argument `DESIGN.md:558` makes for `overflow-x: clip` over
`hidden` in the first place.

**Which rule does the hiding differs by route, and both were checked.** **Observed 2026-09-06**,
before Story 2-9. On `/projects` it is the hero's own `overflow: hidden` (`ProjectsHero.scss:9`),
not `body`'s. On `/work` the work-item overflow has no clipping ancestor, so it reached
`scrollWidth` at 491, where `body`'s `overflow-x: hidden` then stopped it becoming a scrollbar
rather than stopping it being reported.

**Re-measured 2026-09-06, after Story 2-9 swapped `hidden` for `clip`**, by the same method in the
pinned container. The swap was the hazard KV-5's own note named: `clip` on a tree that still
overflows could have turned a clipped page into one with real horizontal scroll, which A-5 forbids
outright. It did not.

| Surface | `document.scrollingElement.scrollWidth` | `body.scrollWidth` | `window.innerWidth` | Past the right edge | Past the left edge |
|---|---|---|---|---|---|
| `/` | 360 | 360 | 360 | 0 | 0 |
| `/work` | 360 | **491** | 360 | **28** | 0 |
| `/projects` | 360 | 360 | 360 | **8** | 0 |
| `/celeste` | 360 | 360 | 360 | 0 | 0 |
| `/a-route-that-does-not-exist` | 360 | 360 | 360 | 0 | 0 |

**No route gained horizontal scroll**, which is the one thing the swap could have got wrong. The
element counts are unchanged, and `/`'s is still zero with the directory on it. The left edge was
swept this time and is clean everywhere, so the earlier census's caveat that 36 was a floor on the
count rather than the whole of it is now closed: 36 is the number.

**`/work` is where the two readings separate, and it is worth reading carefully.**
`document.scrollingElement.scrollWidth` is 360 while `document.body.scrollWidth` is 491. The root
element's `overflow-x: clip` propagates to the viewport, so the viewport's scrolling area is
clamped and there is nothing to scroll to; `body` is a separate box whose own scroll width still
reports the overflow it contains. The visitor-facing fact is the first number. The second is why a
`scrollWidth` check is a poor instrument for A-5 either way, which is the argument this section
already made from the other direction on `/projects`.

`/` scrolls to **2442px** tall against an 800px viewport, so the Suite Directory below the hero is
reachable. Under the rule Story 2-9 removed, `body` was clamped to one viewport and it was not.

None of the 36 overflowing elements is interactive, so none of them fails this sweep. All of them
are recorded as **KV-5** in `ops/known-violations.md`, with the Operator ruling of 2026-09-06 that
tolerates the breach and the stories that retire it; the measurements and the two shapes the
overflow takes are in the `deferred-work.md` entry that KV-5 cites. Story 2-9 landed the stylesheet
half (`epics.md:2423-2427`); Stories 2-31 and 2-33 own the 28 on `/work` and Story 2-14 owned the 8
on `/projects`, and KV-5 stays `Open` until the other two land.

**Eight of those 36 overflowing elements ceased to exist on 2026-09-07.** Story 2-14 redirected
`/projects` to `/#suite` and deleted `ProjectsHero` with the route, so the elements are gone rather
than repaired: there is no surface left on which to measure them and no stylesheet rule left to
correct. **28 overflowing elements remain**, all of them on `/work`, and the census tables above are
the pre-2-14 readings and are kept as such. The count that would be produced by re-running that
census today is 28.

**The census has a second surface since 2026-09-10 and has not been re-read on it.** Story 2-16
mounted the same `WorkTimeline` on `/cv`, and every one of the 28 comes from `WorkItem.scss`, whose
`&__sub` sets `white-space: nowrap` and `flex-shrink: 0` inside a 256px content area. So the same
overflow is very likely rendered on that route too. **No new breach exists**: the standing A-5
assertion measures interactive elements, and it passed in
`mcr.microsoft.com/playwright:v1.62.1-noble` on 2026-09-10 with `/cv` swept as a surface, so no
interactive element's edge sits outside the viewport there. What has not been run is the wider
census, which counts elements of any kind, and "very likely" is not a measurement, which is the
whole reason this section separates the two. Filed as **DW-72**, with the same owner DW-67 already
carries: whichever of Stories 2-31 and 2-33 lands first.

**This section's 36 is not § The surfaces swept's 36, and the collision is an accident of timing.**
That one is the number of interactive elements the floor **measures**, across four surfaces, and it
fell from 54 to 36 when `/projects` left. This one was the number of elements of any kind sitting
**outside the viewport**, across two surfaces, and it fell from 36 to 28 in the same commit. The two
were 54 and 36 before Story 2-14 and are 36 and 28 after it, so a reader skimming for "36" between
2026-09-07 and whenever either number next moves can land on either. Where this file needs the
overflow figure it now says "overflowing elements"; where it needs the measured one it says
"measured". **The collision got worse on 2026-09-08, not better.** Story 2-15 moved the measured
figure from 36 to 28, which is what the overflow figure has read since Story 2-14, so the two are
now the **same number at the same time** rather than one being the other's predecessor. Between
2026-09-07 and 2026-09-08 a reader skimming for "36" could land on either; from 2026-09-08 a reader
skimming for "28" lands on both. Neither is derived from the other and both are read rather than
computed, so the disambiguating words are the only thing separating them and this file uses them
without exception.

**The collision ended on 2026-09-10 and the words stay.** Story 2-16 moved the measured figure from
28 to 37, so the two numbers are apart again and "28" now means the overflow census and nothing
else. That is the accident going the other way rather than a rule changing: the two figures are
still read rather than computed, still count different things over different surface sets, and the
next story that moves either can put them back on the same number without noticing. The
disambiguating words are what make that harmless, so they are kept.

**`overflow-x: clip` acquired a second consumer on 2026-09-08, and it is not an A-5 one.**
**Decision**, recorded here because this section is where the argument for `clip` over `hidden`
lives. Story 2-15 made the header `position: sticky`, which works only because `app/app.scss:97-100`
clips rather than hides: the two clip identically and `hidden` additionally makes the element a
scroll container, which breaks a descendant's stickiness with nothing failing anywhere. Until that
story the argument for `clip` was entirely about not clamping the document's scroll height, which
Story 2-9 made for the homepage. A swap back would now cost two unrelated things at once, and both
are asserted: the computed values on `html` and `body` in `tests/e2e/suite-directory.pw.ts`, and the
header staying at the top of the viewport under scroll in `tests/e2e/chrome-nav.pw.ts`.

## Failing loudly rather than vacuously

Every row is asserted by a permanent case in `tests/e2e/hit-target-floor.pw.ts`, on a defect
injected into one page through the browser. By this story's own rule a branch never observed to
fail is not known to work.

| Case | Behaviour | Nature |
|---|---|---|
| An unlisted element under the floor | Fails naming the route, a stable selector, the element's text and the measured box, and the floor it was compared against | **Observed 2026-09-06.** "fails on an unlisted element under the floor, naming the route, the selector and the box", which plants a 10 x 10 link |
| A plain inline element padded to look compliant | Fails on the height axis while the width axis clears the floor, so the failure is the padding rather than the size | **Observed 2026-09-06.** "fails on an element that reaches the floor only through vertical padding on a plain inline element" |
| A listed element that now clears the floor | Fails as a stale row, naming the row id and both files that carry it | **Observed 2026-09-06** against the chrome nav, and **re-observed 2026-09-08** against the homepage panel. The case injects a compliant link into a surface a real row lists, so a real row goes stale rather than a synthetic one. It hosted in `nav.navbar` until Story 2-15 repaired that surface and deleted `chrome-nav`; the host is now `nav.home-panel--nav` and the row is `home-nav`, which stays in the ledger for Story 2-32. The plant is taken out of flow deliberately, or an in-flow 80px child reflows its siblings and the control reports a layout side effect rather than the predicate |
| A row that matches nothing **on one of the routes it lists** | Fails naming the row **and the route**, its selector, its source and its closing story. A row covering more than one surface cannot go half stale, and since Story 2-14 the widest row covers two | **Observed 2026-09-06.** "fails a row that has stopped matching on one of the routes it lists", driven through the pure verdict with a two-route row that matches on one of them |
| A row covering more elements than it says | Fails naming the row and both counts. This is what stops an existing selector exempting a newly added control for free | **Observed 2026-09-06.** The same case, plus the stale-row case, which plants a third `a.nav-link` on the homepage panel and asserts the row reports covering three. It planted a seventh chrome link and asserted seven until 2026-09-08, when that row was repaired away |
| A row matching an element that is not under the floor | Fails on the arithmetic as well as on the element, which is what wires the per-row `under` tally to something | **Observed 2026-09-06.** Same case |
| A route `app/` serves that nothing sweeps | Fails naming the unregistered route. The route set is walked off the filesystem rather than restated | **Observed 2026-09-06.** "every route app/ serves is registered as a swept surface or as a non-Hub route" |
| A hidden or decorative candidate | Skipped with a stated reason, never measured and never counted | **Observed 2026-09-06.** "never sweeps a hidden or decorative node, and never counts one", which asserts `/celeste`'s real skips, seven of them until 2026-09-08 and three since, and then plants one node per arm of the rule: `aria-hidden`, the `hidden` attribute, `display: none`, zero area and `visibility: hidden`. **Each arm is looked up by name**, so an arm that stopped being planted fails rather than quietly stopping being demonstrated |
| An element outside **either** edge | A-5 fails naming the element and the edge it measured. An element at a negative x scrolls the page as surely as one past the right edge | **Observed 2026-09-06.** "A-5 fails on an element outside either edge, which a scroll width check reports inconsistently". The case asserts its **own premise** first, that the surface carries no element outside the viewport before anything is planted. **Re-measured 2026-09-06 after Story 2-9** and re-stated in both directions: on that planted page `document.body.scrollWidth` does not grow, both planted elements being absolutely positioned against the initial containing block, while `document.documentElement.scrollWidth` does, `overflow-x: clip` on the root not clamping out-of-flow content the way it clamps in-flow overflow. On `/work` the same root read answers 360 against elements at 490, the opposite result from the same call. Both are now asserted, because the disagreement is the measurement the element-edge method rests on. The earlier form asserted only that `body` did not grow and attributed it to `body`'s `overflow-x: hidden`, which was true for an unrelated reason and stayed true after that rule was replaced |
| A surface that yields nothing, or a count that moved | Fails naming the route and the count. Driven as a predicate over synthetic counts rather than as an inline assertion inside the sweep, because the earlier shape asserted a message it had itself supplied and was green with the guard deleted | **Observed 2026-09-06.** "the count guard fires on every way a surface can go vacuous", plus the empty-fixture half of "the candidate selector matches controls and passes over ordinary content" |
| An element under the floor matched by a row that does not list this route | Reported as a route mismatch naming the row, not as "nothing lists it", which would send a reader hunting for a row that exists | **Observed 2026-09-06.** "separates an unlisted element from one whose row does not list this route" |
| An exemption selector the browser cannot parse | Throws naming the row rather than a page-side `SyntaxError` from inside `Element.matches` | **Observed 2026-09-06.** "the ledger is well formed before anything is measured against it" |
| The candidate selector matching the wrong things | A fixture asserts it matches an `<a href>`, a `<button>` and a `role="button"`, and passes over prose, an `<a>` with no `href` and `tabindex="-1"` | **Observed 2026-09-06.** "the candidate selector matches controls and passes over ordinary content" |
| `--tap` not declared, or not a length | The harness throws naming the property; the parser refuses `""`, `auto`, `0px`, `-8px`, `3rem`, `48` and `48 px` | **Observed 2026-09-06.** "the ledger is well formed before anything is measured against it" and "the floor is read from the contract on every surface it is applied to" |
| A candidate the visibility rule admitted whose box comes back `null` | Throws naming the element. A candidate is either skipped with a stated reason or measured; it is never dropped in silence | **Decision.** `measureSurface` in the spec file |
| The entrance not settled | Throws naming the route **and carrying the underlying failure**, so a crashed page and a genuinely unsettled entrance are not reported as the same thing | **Decision.** `settle` in the spec file |
| The entrance selector matching nothing | Fails naming the surface. `Array.every` over an empty NodeList is `true`, so a renamed class turns the settle into a no-op that reports nothing. **Corrected 2026-09-08:** this row and the spec file's own docblock both predicted Story 2-15 would rename `.nav-link`, and it did not. That class is `HomeLayout`'s, on the homepage panel, and its ledger row is `closedBy: 'Story 2-32'`; Story 2-15 reshaped `Navbar`, whose links carry no class. The guard is unchanged and is what will fire whenever the rename happens | **Decision.** `settle`, on any surface declaring `entrance: true` |
| A row whose recorded size claims a compliant box | Fails naming the row. The recorded size is documentation, and this is the one thing it is held to mechanically | **Decision.** "the ledger is well formed before anything is measured against it" |
| The record and the ledger disagreeing | Vitest fails in whichever direction is short | **Decision.** `ops/__tests__/hit-target-floor.test.ts`, on the pattern `ops/__tests__/contract-adoption.test.ts` sets |

## No snapshot is written

**Decision.** This file takes no screenshot and never calls `toHaveScreenshot`, on the precedent
`tests/e2e/celeste-header.pw.ts:24-26` set. So it writes no snapshot directory, and the
`keeps exactly one committed baseline` case in `tests/e2e/rendered-output.pw.ts:216-223`, which
reads the snapshot directory of its own spec file, is untouched.

**Observed 2026-09-06** by `git status --porcelain -- tests/e2e/hit-target-floor.pw.ts-snapshots`
after a full run, which was empty.

## Running it

The suite runs inside `mcr.microsoft.com/playwright:v1.62.1-noble` only, for the reasons
`ops/rendered-output-harness.md` gives under "Regenerating the baseline". The invocation, which is
the one DW-23 asks to have written down:

```
docker run --rm --ipc=host ^
  -v C:/CuatroEcosystem/cuatro-portfolio:/w ^
  -v pw-node-modules:/w/node_modules ^
  -v pw-next:/w/.next ^
  -w /w -e CI=1 ^
  mcr.microsoft.com/playwright:v1.62.1-noble ^
  bash -lc "corepack enable && pnpm install --frozen-lockfile && pnpm test:e2e"
```

`corepack enable` is needed because `playwright.config.ts:85` calls `pnpm` by name and only
`corepack` is on the image's PATH. The two named volumes mask the Windows host's `node_modules`
and `.next`, which hold binaries a Linux container cannot execute. `--ipc=host` is not optional:
Chromium in a container gets a 64 MB `/dev/shm` by default and crashes the renderer when it runs
out.

**These are timings, not thresholds.** **Observed 2026-09-06**: three runs of the same tree on this
host reported **1.6 min**, **1.7 min** and **2.3 min** for the whole suite, the spread being host
load rather than anything in the code. Nothing asserts on any of them. They are recorded so a later
reader can tell a change in cost from a change in weather, which needs more than one reading.

**What each figure covers, stated before the numbers**, because the wall clock and Playwright's
own total measure different things and reading one as the other makes the arithmetic look wrong.
Playwright's headline total starts when the run does, which includes waiting for `webServer` to run
`pnpm build && pnpm start`; it is therefore build plus tests, not tests. The `docker run` wall adds
`corepack enable` and, where it is run, `pnpm install --frozen-lockfile` against the warm named
volumes. Neither includes the image pull, which `ops/rendered-output-harness.md` records
separately at 28 s on a cold runner.

| Figure | Value | Nature |
|---|---|---|
| Cases in this file | 15 | **Observed 2026-09-06**, before Story 2-9 |
| Cases in this file | 16 | **Observed 2026-09-06**, after Story 2-9 added the A-4 independently-addressable case. The sweep now measures 53 elements rather than 43, on the same five surfaces |
| This file inside a whole `pnpm test:e2e` run | **24.6 s** across its fifteen cases, of which the sweep case was **13.7 s** | **Observed 2026-09-06** in the pinned container on the Windows development host, by summing the per-case durations Playwright's list reporter printed. The sweep is five navigations, five hydration waits and 43 elements measured at two round trips each |
| This file run alone | Playwright total **49.7 s**, of which its fifteen cases were **26.6 s** and the sweep **14.6 s** | **Observed 2026-09-06**, by `pnpm exec playwright test hit-target-floor` in the same container. The gap between the total and the cases is the `pnpm build` the `webServer` performs before the first test, which a whole-suite run pays once for eight spec files rather than for one |
| Whole `pnpm test:e2e`, sixteen spec files, 203 tests | **4.2 min**, Playwright's own headline, with a `docker run` wall of **255.3 s** | **Observed 2026-09-10**, same host, after Story 2-16 added `tests/e2e/cv.pw.ts` and its eight cases and made `/cv` a fifth swept surface. This file's sixteen cases came to **12.5 s** of that and the new one's eight to **5.2 s**, summed from the list reporter's per-case durations. **This file gained a surface and got faster, which looks wrong and is not**: the row below records fifteen cases at 24.6 s on 2026-09-06, when the sweep visited five surfaces including `/projects` and measured **53** elements at two round trips each. It visits five again today, `/cv` having replaced `/projects`, and measures **37**, which is 32 fewer round trips; the sweep case itself was **3.9 s** here against **13.7 s** there. Host load accounts for the rest and is the reason this table records more than one reading. The suite has also grown from ten spec files to sixteen since the whole-run row below, so that figure is not a comparison either |
| Whole `pnpm test:e2e`, ten spec files, 89 tests | **2.0 min**, Playwright's own headline for the run | **Observed 2026-09-06**, same host, after Story 2-10 added `tests/e2e/status-mark.pw.ts` and its eighteen cases. **The `docker run` wall was not timed on this run**, so it is left blank rather than carried over from the row below, which would present a nine-file figure as a ten-file one. An earlier reading of the same file at fifteen cases was 2.2 min, so the spread here is host load rather than the three cases added by review |
| Whole `pnpm test:e2e`, nine spec files, 71 tests | **1.7 min** and **3.7 min** on two runs of the same tree, with `docker run` walls of **108.8 s** and **229.1 s** | **Observed 2026-09-06**, same host, after Story 2-9 added `tests/e2e/suite-directory.pw.ts` and one case here. The spread is host load, which is the point of recording more than one reading. The row below is the eight-file reading and is kept rather than overwritten |
| Whole `pnpm test:e2e`, eight spec files, 60 tests | **1 m 41.3 s** by `time` around the command, **1.7 min** as Playwright's own headline for the same run. The `docker run` wall around it was **105.2 s** | **Observed 2026-09-06**, same host. The command covers `pnpm build && pnpm start` plus all sixty tests; the extra four seconds of docker wall are `corepack enable` and `pnpm install --frozen-lockfile` against the warm named volumes. **The image pull is in none of these**: `ops/rendered-output-harness.md` records it separately at 28 s on a cold runner, and that is the figure the `rendered-output` job pays on top |

## Maintaining this file

**When a story repairs a surface, it deletes the row.** The sweep fails on the commit that repairs
it otherwise, in the stale direction, naming the row. Three things move together and a change to
fewer than all three is a defect: the row in the table above, the entry in `EXEMPTIONS` in
`tests/e2e/hit-target-floor.pw.ts`, and the corresponding line in `ops/known-violations.md` under
KV-4. The Vitest agreement suite holds the first two equal; the third is prose and is the reason
KV-4 lists the surfaces individually rather than as a count.

**The per-surface counts move with it, and they are read rather than computed.** Deleting a control
changes what the sweep measures, so § The surfaces swept moves in the same commit. Take the numbers
off the sweep's own failure output in the pinned container: the run prints `found`, `skipped` and
`measured` per route when a pin disagrees, which is the reading. Arithmetic over the Registry looks
identical and is wrong the moment a control fails to render, which is the case the pin exists to
catch.

**When the ledger empties, KV-4 retires.** Set its `Status` to `Retired`, fill `Retired on`, and
bring the derived index row in line, which is what that file's own rules require.

**When a figure is re-measured**, add the new row with its own date and method and keep the old
one, so a later reader can see whether a number moved or was simply re-stated. Deletion is not
used here.
