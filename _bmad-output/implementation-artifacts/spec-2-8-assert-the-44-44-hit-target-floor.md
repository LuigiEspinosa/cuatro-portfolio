---
title: 'Story 2.8: Assert the 44x44 hit-target floor'
type: 'feature'
created: '2026-09-06'
status: 'done'
baseline_commit: '9f71fbaeedfc6f5464aab48ab68c5fb929988460'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** AD-19 requires the accessibility floor to be asserted rather than claimed, and
`ops/rendered-output-harness.md:61` records the 44x44 half as deliberately unasserted, owned by
this story. Nothing in the repository measures a hit target. `--tap` ships in the contract
(`contracts/tokens.css:100`) with zero consumers, and the shipped Hub is below the floor in four
places, so the gap is real and currently invisible.

**Approach:** Add one standing Playwright assertion at 360px that sweeps every interactive element
on every route, measures `boundingBox()` against `--tap` read from the page, and fails on anything
below the floor that is not on an explicit exemption list. Each exemption carries its measured size
and the story that closes it, and a stale exemption fails too, so the list can only shrink. Assert
A-5 alongside, and demonstrate every new predicate failing against planted controls.

## Boundaries & Constraints

**Always:**

- **The sweep is universal and the exemptions are the only escape.** Every route, every interactive
  element. An element below the floor that is not listed fails the build, and an element that is
  listed but now passes fails as a stale row. Nothing else may make the sweep green.
- **Every exemption names its closing story.** Four are known today: the nav links
  (`Navbar.tsx:6-19`, Story 2-15), the project card links (`ProjectCard.tsx:45,49`, Story 2-9), the
  404 back link (`Error404.tsx:50`, Story 2-30), and the home nav and contact links
  (`HomeLayout.tsx:64,67`, `ContactContainer.tsx:5,8,15`, Story 2-32). Measure them; do not
  transcribe the sizes above, which were read off CSS.
- **The floor is read, never written.** Take it from `--tap` on `:root` through
  `rootCustomPropertyValue` (`harness.ts:164`). A hand-written `44px` or a bare `44` is what Story
  2.34's gate rejects (`epics.md:3740`, `DESIGN.md:654-656`).
- **The sweep is counted.** A route yielding zero interactive elements fails loudly rather than
  looping zero times (`harness.ts:28`, and the `wrong[]` accumulator idiom at
  `anchor-aliases.pw.ts:720-756`).
- **Each new predicate is demonstrated failing, twice over.** A one-time probe, its output pasted
  verbatim into the ops record, removed from the tree in this story; plus a permanent standing case
  that injects the defect in-page so it touches no file
  (`ops/rendered-output-harness.md:240-252`). The AC names the probe: an element reaching the floor
  only through vertical padding on a plain inline element.
- **The exemption list and its ops record agree in both directions**, pinned by a Vitest case, on
  the pattern `ops/__tests__/contract-adoption.test.ts` sets: a row in the record with no entry in
  the list fails, and an entry with no row fails the same way.
- `.lighthouserc.js:15` keeps `'categories:accessibility': ['error', { minScore: 0.95 }]`
  unchanged and unweakened (AD-19, AD-21).

**Ask First:**

- Adding a dependency, a CI job, a Playwright project, or a second viewport.
- Exempting anything that has no named closing story.
- Any element the sweep should skip that is not covered by the visibility and accessibility-tree
  rule in the matrix.

**Never:**

- **Do not change a component or a stylesheet to make an element pass.** Those repairs are Stories
  2-9, 2-15, 2-30 and 2-32, which name the floor as their own acceptance condition
  (`epics.md:2655-2658`, `:3568-3584`, `:3441-3442`). This story ships the instrument only.
- **Do not edit `app/app.scss:92-102`.** Its `width: 100vw` and `overflow-x: hidden` breach
  `DESIGN.md:558`, and A-5 is asserted by element right edges precisely so the clipping cannot mask
  overflow. Record it; do not repair it (Operator ruling, 2026-09-06).
- Do not assert the Status mark: it is not interactive (`EXPERIENCE.md:351`) and Story 2.10 owns its
  three axes. Do not assert Status truncation either; nothing renders a Status yet.
- Do not take a screenshot or call `toHaveScreenshot`. Assertions only, so no snapshot directory is
  written and `keeps exactly one committed baseline` (`rendered-output.pw.ts:216-223`) stays true.
- Do not add a job to `.github/workflows/ci.yml`. `:276-277` already runs the whole directory, and a
  seventh job fails `ops/__tests__/contract-purity.test.ts:1027` and
  `ops/__tests__/registry-schema.test.ts:1721` at once.
- Do not add a file under `contracts/`, and do not hoist the shared navigation helper DW-22 asks for.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| An element clears the floor | `boundingBox()` at least `--tap` on both axes | Passes, and counts toward the route's read count | N/A |
| Below the floor, unlisted | A new or regressed control | Fails, naming the route, a stable selector, and the measured box | The message states the measured size and the floor, never just "too small" |
| Below the floor, listed | One of the four known rows | Passes; the row carries its measured size and closing story | N/A |
| A listed element now passes | Story 2-15 lands and the nav clears the floor | **Fails as a stale exemption**, naming the row to delete | This is what forces the list to shrink rather than rot |
| Padding-only compliance | A plain inline element padded to look compliant | Fails: `boundingBox()` measures the line box, not the painted padding | The named probe case, held permanently by an in-page injection |
| A route yields no elements | A selector that matches nothing | Fails naming the route | Guards the vacuous pass; a green run means elements were measured |
| Horizontal overflow at 360px | An element whose right edge exceeds the viewport | A-5 fails naming the element | Measured on the element, so `overflow-x: hidden` cannot hide it |
| Record and list disagree | A row edited in only one place | Vitest fails in whichever direction is short | Both directions asserted, so neither file is the only reader |
| Hidden or decorative nodes | `aria-hidden`, `display: none`, zero-area | Not swept, and not counted | The `/celeste` header and `.work-item__icon` are the real cases |

</frozen-after-approval>

## Code Map

- `tests/e2e/hit-target-floor.pw.ts`: **new.** The standing assertion, the A-5 assertion, the
  exemption list as a typed const, and the planted-control cases. Picked up automatically by
  `playwright.config.ts:33-34`.
- `tests/e2e/harness.ts`: **reuse, do not edit.** `:11` `RENDERED_VIEWPORT` is already 360x800 and
  already the project default (`playwright.config.ts:72`), so import it rather than typing 360.
  `:164` `rootCustomPropertyValue` sources the floor. `:28` names the vacuous-pass hazard.
- `tests/e2e/anchor-aliases.pw.ts`: `:123` `ROUTES` (all seven), `:130` `NOT_FOUND`, `:481-485` the
  status-checked `goTo`. Copy the local idiom as `celeste-header.pw.ts:36-40` did; DW-22 records the
  duplication and this is not where it is fixed. `celeste-header.pw.ts:24-26` is the precedent for
  taking no screenshot.
- `contracts/tokens.css`: **read only.** `:100` `--tap: 44px`, the only `px` length in the contract.
- **The four exempted surfaces, all read only**, each cited so the implementer measures rather than
  hunts: `Navbar.tsx:6,7,8,9,12,19` (six links, zero padding at 19.2px; `:8` points at a `/blog`
  that does not exist, so chrome reaches the 404); `ProjectCard.tsx:45,49` with
  `ProjectCard.scss:76-92` (smallest on the site, 12.8px mono, no padding); `Error404.tsx:50` with
  `error-page.scss:52-75` (the nearest miss); `HomeLayout.tsx:64,67` and
  `ContactContainer.tsx:5,8,15` with `HomeLayout.scss:116-168`.
- `components/organisms/HomeLayout/HomeLayout.tsx`: `:34,39` animate the home links from
  `opacity: 0` at roughly t=2.0s and t=2.2s (`HomeLayout.scss:124,157`). The sweep must settle that
  entrance or it races it.
- `components/molecules/Header/Header.tsx`: `:12`, `path !== '/'`, so chrome is absent on `/` and
  present on the other six routes and the 404. `/celeste` renders it `display: none`
  (`celeste.scss:8-10`): the hidden-node case in the matrix. **Read only.**
- `app/app.scss`: `:92-102`, `width: 100vw` with `overflow-x: hidden`, plus `overflow: hidden` on
  the home route. **Read only, deliberately.** Filed, not fixed.
- `ops/rendered-output-harness.md`: `:61` states the floor is deliberately unasserted and owned by
  Story 2.8, and changes here. `:238-296` is the demonstration format to copy, `:244-252` the
  probe-versus-standing-test rule.
- `ops/hit-target-floor.md`: **new.** The floor, the exemption table, the probe output, the A-5
  method. `ops/known-violations.md` takes one new `KV-n` entry for the four tolerated AD-19
  breaches; `:24-36` is the admission test it must meet and `:47-58` the numbering and
  derived-index rules.
- `ops/__tests__/hit-target-floor.test.ts`: **new.** Pins the record and the exemption list against
  each other in both directions.
- `.lighthouserc.js:15` and `.github/workflows/ci.yml` (`:225` job `rendered-output`, `:276-277`
  runs `pnpm test:e2e`): **read only.** No job is added, so neither job-name pin moves.

## Tasks & Acceptance

**Execution:**

- [x] `tests/e2e/hit-target-floor.pw.ts`: sweep every route, measure `boundingBox()` against `--tap`,
      apply the exemption list, count the reads, and assert A-5 by element right edges.
- [x] `tests/e2e/hit-target-floor.pw.ts`: hold the failure paths permanently with in-page injections,
      the padded plain inline element among them, so no probe is left in the tree.
- [x] `ops/hit-target-floor.md`: write the record with the exemption table, the measured sizes, and
      the probe output pasted from a real run.
- [x] `ops/__tests__/hit-target-floor.test.ts`: assert the record and the exemption list agree in
      both directions.
- [x] `ops/rendered-output-harness.md`: update `:61` from deliberately-unasserted to asserted here,
      and refresh the job timing figures if they move.
- [x] `ops/known-violations.md`: open one entry for the four sub-floor surfaces, with its ruling
      date and the stories that retire it, then bring the derived index row into line.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md`: file the `app/app.scss:92-102`
      breach of `DESIGN.md:558` (`100vw` and `overflow-x: hidden` where the contract says `100%` and
      `clip`), naming the restyle story that owns that stylesheet. Filed here, repaired there.

**Acceptance Criteria:**

- Given `corepack pnpm test:e2e` inside `mcr.microsoft.com/playwright:v1.62.1-noble`, when it runs,
  then it passes, and the new spec reports a non-zero measured-element count for every route.
- Given the probe described in the AC, an element compliant only through vertical padding on a plain
  inline element, when it is planted and the suite is run, then the floor assertion fails naming the
  measured box, and the probe is absent from the tree at this story's closing commit.
- Given `git status --porcelain -- tests/e2e/hit-target-floor.pw.ts-snapshots`, when it is read after
  a full run, then it is empty: no snapshot directory was created.
- Given `git diff --stat` against `9f71fbaeedfc6f5464aab48ab68c5fb929988460`, when it is read, then
  no file under `app/`, `components/` or `contracts/` changed, and `.github/workflows/ci.yml`,
  `.lighthouserc.js` and `package.json` are untouched.
- Given `git grep -nE "\b44(px)?\b" -- tests/e2e/hit-target-floor.pw.ts`, when it runs, then it
  returns nothing: the floor is read from the contract.
- Given `corepack pnpm test --run` and `corepack pnpm typecheck`, when they run, then both pass.

## Design Notes

**Why a sweep plus a ledger, rather than a list of surfaces.** A sweep scoped to what is already
compliant matches almost nothing today and would go green while proving nothing, the failure
`harness.ts:28` names. Sweeping everything and listing the four known breaches keeps it honest: a
new undersized control fails on arrival, and because a listed element that starts passing also
fails, Stories 2-9, 2-15, 2-30 and 2-32 must delete their row as they land. The list is empty by the
end of the epic and nothing has to remember to widen a scope.

**Why A-5 is measured on elements.** `body` ships `overflow-x: hidden` and the home route adds
`overflow: hidden` outright, so `scrollWidth` is clamped by the clipping rather than by the absence
of overflow. Comparing each element's right edge to the viewport detects the real condition while
`app/app.scss` still breaches `DESIGN.md:558`.

**Why the probe is not enough alone.** A demonstration recorded in `ops/` proves the gate could fail
on one date, and nothing about the run after someone loosens a predicate
(`ops/rendered-output-harness.md:244-252`). Injecting the defect in-page keeps the standing case
permanent without leaving a fixture in the tree.

## Verification

**Commands:**

- `corepack pnpm test:e2e`: run inside the pinned image only. The container invocation a reader
  would construct fails; DW-23 records the working one (`corepack enable`, then install, then run).
- `corepack pnpm test --run`: passes. Expect roughly 900 cases plus the new agreement suite.
- `corepack pnpm typecheck`: passes. AD-21 makes it blocking.
- `git status --porcelain`: empty of probe files and snapshot directories before the closing commit.

**Manual checks:**

- Confirm the probe output in `ops/hit-target-floor.md` was pasted from a real failing run, not
  composed, and that the exemption table's sizes were measured in the browser rather than read off
  the CSS. `EXPERIENCE.md:729-732` says this floor is the single easiest one to miss while appearing
  to meet it, which is the whole reason the story exists.
- Confirm every exemption row names a story that exists on the board in `sprint-status.yaml`.

## Suggested Review Order

**The rule, and why it is a ledger rather than a scope**

- Start here: the whole design argued in one comment, sweep everything and list the breaches.
  [`hit-target-floor.pw.ts:15`](../../tests/e2e/hit-target-floor.pw.ts#L15)

- Six rows for five surfaces. The story's code map predicted four; the sweep found the logo.
  [`hit-target-floor.pw.ts:191`](../../tests/e2e/hit-target-floor.pw.ts#L191)

- `covers` is why a selector cannot quietly exempt a seventh nav link added later.
  [`hit-target-floor.pw.ts:176`](../../tests/e2e/hit-target-floor.pw.ts#L176)

**Where the gate was dishonest before review, and now is not**

- Routes are walked off disk, so Story 2-9's new surface cannot ship unswept.
  [`hit-target-floor.pw.ts:329`](../../tests/e2e/hit-target-floor.pw.ts#L329)

- The vacuous-pass guard is a pure predicate now, so deleting it fails a case.
  [`hit-target-floor.pw.ts:579`](../../tests/e2e/hit-target-floor.pw.ts#L579)

- The settle fails loudly on a `.nav-link` rename instead of waiting on an empty list.
  [`hit-target-floor.pw.ts:369`](../../tests/e2e/hit-target-floor.pw.ts#L369)

- Floor, exemption and A-5 verdicts in one place, driven by synthetic rows in tests.
  [`hit-target-floor.pw.ts:631`](../../tests/e2e/hit-target-floor.pw.ts#L631)

**The floor is read from the contract, never written**

- Parses `--tap` off `:root`, so Story 2.34's literal gate has nothing to reject here.
  [`hit-target-floor.pw.ts:421`](../../tests/e2e/hit-target-floor.pw.ts#L421)

- One source shape, stated once and read back by the agreement suite.
  [`hit-target-floor.pw.ts:153`](../../tests/e2e/hit-target-floor.pw.ts#L153)

**Two files holding each other honest**

- The suite reads the spec's own regex rather than restating it.
  [`hit-target-floor.test.ts:60`](../../ops/__tests__/hit-target-floor.test.ts#L60)

- Ledger parsed from TypeScript, and a reflow reports as a reflow, not a missing row.
  [`hit-target-floor.test.ts:152`](../../ops/__tests__/hit-target-floor.test.ts#L152)

- Both directions, so neither file is the only reader.
  [`hit-target-floor.test.ts:245`](../../ops/__tests__/hit-target-floor.test.ts#L245)

**The records, where the tolerated breach is written down**

- Fifteen controls, admitted on the Operator act rather than on an invented sentence.
  [`known-violations.md:306`](../../ops/known-violations.md#L306)

- Promoted out of deferred work: the ruling, not the severity, is the discriminator.
  [`known-violations.md:365`](../../ops/known-violations.md#L365)

- The probe, run red and reverted, with both failures quoted verbatim.
  [`hit-target-floor.md:210`](../../ops/hit-target-floor.md#L210)

- Read this before trusting a green A-5: it is scoped, and says so.
  [`hit-target-floor.md:297`](../../ops/hit-target-floor.md#L297)

**Peripherals**

- The floor moved out of the "not asserted" table it had outgrown.
  [`rendered-output-harness.md:61`](../../ops/rendered-output-harness.md#L61)

- What this pass found and may not fix, including a false claim in `DESIGN.md`.
  [`deferred-work.md`](deferred-work.md)
