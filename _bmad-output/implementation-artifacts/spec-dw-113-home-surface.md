---
title: 'DW-113: home surface, readout panel removed, ornaments moved to CSS, hero links hidden until they appear, suite-reach split by door'
type: 'bugfix'
created: '2026-09-24'
status: 'done'
baseline_commit: 'd911028394f8cfc0016a6aa549b365644d2ce55a'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Four defects on `/`. The readout panel's label is a code, `SYS_ONLINE`, that no document
gives words for (DW-110), and the panel blanks for 1.6s after a rotation across 768 (DW-107).
Lighthouse reads `/` and `/work` at 0.96 on accessibility against the 0.95 gate because axe scores
seven `aria-hidden` ornaments in the muted accent at 2.74:1 (DW-113). The five hero links are
focusable and clickable while invisible for up to 2.36s of the entrance (DW-106). `suite-reach`
carries no data, so SM-1 cannot be read per front door (DW-88).

**Approach:** Operator ruling 2026-09-24, one package. Delete the readout panel and every rule, test
and record that exists only for it. Carry each ornament string in `data-ornament`, painted by
`::before { content: attr(data-ornament) }`, the element staying `aria-hidden`. Then take a local
Lighthouse reading. Give the five links an entrance keyframe whose `from` also holds
`visibility: hidden`. Send `{ door }` from `HomeLayout`'s decided path on the reach event, and add the
door join to the SM-1 query.

## Boundaries & Constraints

**Always:**

- Every changed behaviour gets a test that fails without the change. Run it red on the baseline tree
  before believing it, and give every new read a planted control that shows it firing.
- Every ornament keeps its colour, size, family and tracking, and stays `aria-hidden`.
- Under reduced motion the five links are present and focusable at first paint (`animation: none`),
  as today.
- The reach event stays one event with one key, `door`, whose value is `flat` or `narrative`.
  Nothing is observed while the door is undecided.
- Records take the UTC date and cite "Operator ruling 2026-09-24". A ledger entry closes with a
  dated paragraph naming the commit, an ops row's figure gets a dated re-reading and keeps the old
  one, and a planning document gets a dated amendment in its own style.
- No em-dash, en-dash, double-dash standing in for a dash, or emoji in anything written.

**Ask First:** nothing gates this run. It is unattended, and each open decision is resolved from
`DESIGN.md`, then `EXPERIENCE.md`, then `RESTYLE-SPEC.md`, and stated under Design Notes.

**Never:**

- No new event and no new dependency. No change to the entrance's delays, durations or easing, or to
  the role line's or the gem's animation.
- No recolouring unless the Lighthouse reading shows axe still scoring the generated content (the
  ruling's fallback).
- No push and no pull request. Regenerate the `/work` baseline only if the container run shows it
  moved, and only in the pinned image.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Wide hero | default door, 768 and 1280 | three panels; the point where the readout sat resolves inside `.home-gem` | N/A |
| Stacked hero | 360, either door | name, imagery, nav, contact; no readout element in the document | N/A |
| Tab at the entrance's start | default door, every animation paused at its start | Tab from the top: skip-link, skip control, then the Directory; no hero link is focused or hit-tested | N/A |
| Same page, entrance finished | the animations finished | Tab reaches the five links in DOM order | N/A |
| Reduced motion | `reduce` | the five links are Tab stops at once | N/A |
| Ornaments | `/`, `/work` | no text node; `data-ornament` painted by `::before` in its role and size; `aria-hidden` | N/A |
| Lighthouse | three runs per URL | `/` and `/work` read 1.00 on accessibility, `color-contrast` passing | If axe still scores them, recolour to `--token-text-secondary`, amend `DESIGN.md`, read again |
| Reach | door `flat`, `narrative` or `undecided` | `track('suite-reach', { door })` once when decided; nothing while undecided | a throwing tracker or storage is contained, as today |

</frozen-after-approval>

## Code Map

- `components/organisms/HomeLayout/HomeLayout.tsx:7,85-93`: `PlateMark` import (the readout is its
  only use here) and the panel. `:79-80,136-145`: the three `jp` ornaments. `:48`: `path`, the page's
  one decision, handed to `SuiteReach` below the panels.
- `components/organisms/HomeLayout/HomeLayout.scss`: `&--sys` at `:87-93`, `:289-291`, `:384-387`
  and `:423`; the keyframe at `:46-50`; the link animations at `:172` and `:210`; `jp` rules at
  `:141-147`, `:182-189` and `:225-233`; the "five animated rules", "five delays" and "four panels"
  comments at `:13-15`, `:39`, `:72-74` and `:420-422`.
- `components/molecules/PlateMark/PlateMark.tsx:92-96` and `PlateMark.scss:72-75`: the subordinate
  line. The side-ruled variant and its `end` mirror stay (Design Notes 1).
- `components/organisms/Premise/Premise.tsx:102-108` and `Premise.scss:78-84`: the band's names.
- `components/organisms/SuiteDirectory/SuiteReach.tsx:71-127`: the effect and the `track` call at
  `:85`. `SuiteDirectory.tsx:8,20-25,192-194`: the import, the docblock and the render that moves.
- Unit: `HomeLayout.test.tsx:424-495` (the mobile block and the keyframe count);
  `PlateMark.test.tsx:120-135,166-171,280-286`; `Premise.test.tsx:156-160`; `SuiteReach.test.tsx`
  (every `toHaveBeenCalledWith(REACH_EVENT)` and `mount`); `SuiteDirectory.test.tsx:321-345`, whose
  mount case moves to `HomeLayout.test.tsx`; `ops/__tests__/visitor-instrumentation.test.ts:78-85`.
- E2E: `front-door.pw.ts:1157-1170,1200,1220,1255-1303` (`sys`, panel count, the below-768 case);
  `narrative.pw.ts:1157-1163,1440-1470` and the `ALLOWED` read at `:1475-1492`;
  `accessibility-floor.pw.ts:1869-1870,2004-2052` (`SCRIM_PANELS` and the hairline probe that exists
  for the readout); `plate-mark-and-work-item.pw.ts:25,313-352,399,419-420,445-475,488-499,519-540`;
  `premise.pw.ts:64-71,283-296,795-801`; `visitor-instrumentation.pw.ts:158-182`.
- Records: `deferred-work.md` DW-88, DW-106, DW-107, DW-110 and DW-113; `ops/hub-accessibility-pass.md`
  § The headline result, § The scrim's composited contrast and § Lighthouse readings;
  `.lighthouserc.js:17-19`; `ops/visitor-instrumentation.md` § The events, § How each metric is read,
  § Stated limits and § Verification session; `ops/rendered-output-harness.md:60`;
  `ops/asset-budget.md` § Every route; `EXPERIENCE.md:529-531` and § Motion; `DESIGN.md:758-769`;
  `epics.md:3341-3344`; `SkipControl.scss:26`.

## Tasks & Acceptance

**Execution:**
- [x] Write the tests first and run them red on the baseline: the unit and e2e cases below.
- [x] `HomeLayout.tsx` and `HomeLayout.scss`: delete the panel, its rules and the `PlateMark` import;
  move the three ornaments to `data-ornament`; add the links' keyframe; render
  `<SuiteReach target='suite' door={path} />`.
- [x] `PlateMark` and `Premise`: move the subordinate line and every band name to `data-ornament`.
- [x] `SuiteReach.tsx`: take `door`, return early while it is `undecided`, and send `{ door }`.
  `SuiteDirectory.tsx`: stop rendering it, and correct the docblock.
- [x] Unit cases: three panels and no Plate mark; each ornament empty, carrying its string, with the
  `::before` rule compiled; the link keyframe pinned; the reach door sent, withheld while undecided
  and handed down from `HomeLayout`; the record's `door` cell and join held to the component.
- [x] E2E: the corner at 768 and 1280, and the panel counts; the tab case with its hit-test, control
  and reduced-motion run; the sites and the `visibility` exception in `narrative.pw.ts`; the scrim's
  three panels; the planted side-ruled mirror and the ornament reads; the door on each door's event.
- [x] Records and planning notes per the Code Map, and one new ledger entry (Design Notes 1).
- [x] Verify: the build, `node ops/asset-budget.mjs` with a dated reading, the container run, and
  the Lighthouse reading.

**Acceptance Criteria:**
- Given the baseline tree, when the new cases run, then each fails for the reason it names.
- Given the final tree, when typecheck, the full unit suite, `node ops/literal-conformance.mjs`, the
  build and the unfiltered container e2e run execute, then all pass.
- Given the final build in the pinned image, when Lighthouse runs three times per URL the way
  `lighthouse.yml` runs it, then `/` and `/work` read 1.00 on accessibility and every assertion passes.
- Given 360, 768 and 1280 on both doors, when `/` renders, then the hero holds with no hole where the
  panel was.

## Spec Change Log

- **Review, 2026-09-24, loop 0.** No subagent could be spawned in this session, so the six layers
  ran inline, as the Operator's authorisation of a sub-agent reviewer allows. No intent gap and no
  bad-spec finding. One patch, from the verification-gap pass: the SM-1 by-door query has never run
  against Umami's database, so `ops/visitor-instrumentation.md` gains Pending Operator action 6 with
  the steps. Two findings deferred with evidence: DW-125, the LCP shift DW-106's mechanism causes on
  `/`, found by the Lighthouse reading; DW-126, focus lost when reduced motion turns off mid-session,
  found by the edge-case pass and confirmed by a scratch probe. Rejected: the ponytail layer's three
  shrinks (one global `[data-ornament]::before` rule, one shared `reachData()` read, an inlined
  `ALLOWED_VISIBILITY`), each against a repository convention, stylesheets that belong to their
  component and are read by its suite, and cases that stand alone. The design layer approved: the
  entrance, its tokens and its delays are settled, and the one new property is discrete. Nothing was
  re-derived.

## Design Notes

Assumptions, resolved unattended in the stated order:

1. **The side-ruled variant stays.** `DESIGN.md` § Plate mark defines three variants, and the
   mirror is part of the side-ruled one ("Mirrors to the trailing edge when end-aligned"). They are
   the design system's vocabulary, not the panel's. The removal leaves them with no call site, so
   their painted read becomes a planted mark (the leading-edge precedent), and a new ledger entry
   asks the Operator whether the variant should go.
2. **The links get their own keyframe.** The ruling names the five links, and `EXPERIENCE.md`
   § Motion allows transform and opacity only, so the `visibility` exception stays with the elements
   the ruling names. The role line and the gem keep the opacity-only `home-enter`, so no reader loses
   text from the tree during the entrance. `visibility` is discrete: hidden at progress 0 and through
   the delay (the `both` fill), and visible from the first frame of the fade.
3. **Every band name moves, not only the muted ones.** The ruling names "the premise band's
   `aria-hidden` framework names", and the whole band is `aria-hidden`. One mechanism across the
   band keeps the alternation a stylesheet matter.
4. **The reach render moves into `HomeLayout`.** The door is `HomeLayout`'s state, and the Directory
   is a server component that cannot see it. A second hook call would be a second decision. A module
   variable could be stale across a client navigation, and reading the flat modifier cannot tell
   `undecided` from `narrative`. `SuiteReach` stays in its folder and still finds the heading by id.
5. **The SM-1 split is of the numerator.** A visit that never reaches sends no event, so its door is
   never recorded, and a per-door denominator would need a new event, which the ruling rules out.
   The joined query reports reached visits per door, with `unrecorded` for events sent before the
   change, and § Stated limits says so.
6. **DW-107 closes as moot:** its panel is gone. `RESTYLE-SPEC.md` does not describe the panel
   (searched), so the dated notes go to `EXPERIENCE.md`, `DESIGN.md` and `epics.md` only.

## Verification

**Commands:**
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test --run`: every file passes.
- `node ops/literal-conformance.mjs`: exit 0.
- `corepack pnpm build`, then `node ops/asset-budget.mjs`: exit 0 each.
- The pinned container run of `pnpm test:e2e`, no filter: every case passes.
- Lighthouse in the pinned image: build with the Umami variables empty, `pnpm start`,
  `@lhci/cli@0.15.1 collect` (three runs per URL), then `assert` against `.lighthouserc.js`.

**Manual checks:**
- Screenshots of `/` at 360, 768 and 1280 on both doors, from the pinned image: the three panels in
  place and no hole where the readout sat.

**As run, 2026-09-24:**
- Red on the tree before each ruling's code moved, `corepack pnpm vitest --run` over the touched
  suites: ruling 1, 3 failed (four panels, four notches, five animated rules); ruling 2, 6 failed (no
  `data-ornament`, the strings still text, no `::before` rule); ruling 3, 1 failed (one keyframe);
  ruling 4, 9 failed (`track` called with the bare name, an undecided door observing, the record
  stating `none` and no join). In the pinned image, on a worktree at `d911028` carrying the new e2e
  files, `-g` over the new and changed cases: 14 failed, each for its reason (the corner resolved to
  `div.home-panel--sys` at 768 and 1280; four panels; the readout in the document; Tab reached all
  five hero links at `opacity: 0`; no keyframe declared `visibility`; the ornaments were text; `/`
  carried two marks; the reach data read `undefined` on both doors), and 2 passed as they should (the
  reduced-motion Tab case, and a 404 case the filter matched).
- One commit per ruling, each verified before it was made: `04b3f4a` typecheck exit 0, unit 59
  files and 1,547 passed; `f97267b` 59 and 1,551; `123b723` 59 and 1,551; `9e49b88` 59 and 1,555.
- The first unfiltered container run, on `57593b9`: 334 passed, 1 failed, 6.2 minutes. The DW-106
  case's control hit-tested the links after its Tab had ended in the Directory and scrolled the hero
  out of the viewport; fixed in `1a5ada5`, after which `front-door.pw.ts` alone passed 51 of 51.
- Lighthouse in the pinned image, three runs per URL, `lhci assert` green on both builds: at
  `d911028`, `/` and `/work` 0.96 on every run with `color-contrast` failing on the seven ornaments
  and `/cv` 1.00; at `1a5ada5`, all three 1.00 on every run with `color-contrast` passing and no
  item. `/`'s ungated performance fell from 0.65, 0.65, 0.67 to 0.49 on each run, its LCP element
  moved to the first hero link (DW-125).
- `corepack pnpm build` exit 0 (`RT9WREDML0Cp4cctih6td` at `1a5ada5`), `node ops/asset-budget.mjs`
  exit 0 and the reading filed; `node ops/literal-conformance.mjs` exit 0; in the review round,
  build exit 0, `corepack pnpm typecheck` exit 0 and `corepack pnpm test --run` 59 files and 1,555
  passed; after the records, `vitest --run ops` 17 files and 839 passed.
- A scratch probe in the pinned image (deleted, never committed) confirmed DW-126: focus on the first
  nav link falls to the body when reduced motion turns off mid-session.
- The final unfiltered container run, on the final code: 335 passed, 0 failed, 6.0 minutes, the
  `/work` baseline unmoved and no snapshot written.
- The screenshots, pinned image, entrance finished: at 1280 and 768 the default door keeps the name,
  navigation and contact in their corners with the imagery where the readout sat; at 360 it stacks
  name, imagery, navigation, contact; the reduced-motion door stacks the three panels at every width.
  No hole anywhere.

## Suggested Review Order

**The five hero links wait for their turn (DW-106)**

- Entry point: the links' own keyframe, whose `from` also hides them until the fade begins
  [`HomeLayout.scss:65`](../../components/organisms/HomeLayout/HomeLayout.scss#L65)

- Both link groups move onto it; the role line and the gem keep the opacity-only keyframe
  [`HomeLayout.scss:184`](../../components/organisms/HomeLayout/HomeLayout.scss#L184)

- Held at its start, Tab skips all five and a click lands beneath; played out, both find them
  [`front-door.pw.ts:1866`](../../tests/e2e/front-door.pw.ts#L1866)

- `visibility` allowed in exactly one keyframe frame, beside a planted control
  [`narrative.pw.ts:1482`](../../tests/e2e/narrative.pw.ts#L1482)

**The ornaments are generated content (DW-113)**

- The three Japanese lines, painted from their attribute; colour and size stay on each rule
  [`HomeLayout.scss:255`](../../components/organisms/HomeLayout/HomeLayout.scss#L255)

- Each string moves from text to `data-ornament` on an empty `aria-hidden` span
  [`HomeLayout.tsx:82`](../../components/organisms/HomeLayout/HomeLayout.tsx#L82)

- The subordinate line the same way, so `/work`'s audit stops scoring it
  [`PlateMark.tsx:95`](../../components/molecules/PlateMark/PlateMark.tsx#L95)

- Every band name, odd and even, so the alternation stays the stylesheet's
  [`Premise.tsx:106`](../../components/organisms/Premise/Premise.tsx#L106)

- In the browser: each ornament empty, hidden, and painting its string in its own type
  [`accessibility-floor.pw.ts:2149`](../../tests/e2e/accessibility-floor.pw.ts#L2149)

- The reading: `/` and `/work` at 1.00, where the baseline read 0.96 in the same image
  [`hub-accessibility-pass.md:543`](../../ops/hub-accessibility-pass.md#L543)

**The readout panel is gone (DW-110, DW-107)**

- What left the stylesheet, stated where its removals are listed
  [`HomeLayout.scss:17`](../../components/organisms/HomeLayout/HomeLayout.scss#L17)

- Three panels and no Plate mark on either door
  [`HomeLayout.test.tsx:104`](../../components/organisms/HomeLayout/__tests__/HomeLayout.test.tsx#L104)

- The corner it held resolves to the imagery at 768 and 1280, beside a planted box
  [`front-door.pw.ts:1342`](../../tests/e2e/front-door.pw.ts#L1342)

- The side-ruled variant stays, read on planted marks since its one call site left (DW-124)
  [`plate-mark-and-work-item.pw.ts:337`](../../tests/e2e/plate-mark-and-work-item.pw.ts#L337)

**The front door on the reach event (DW-88)**

- Nothing is polled or observed while the door is undecided, so no event lacks one
  [`SuiteReach.tsx:81`](../../components/organisms/SuiteDirectory/SuiteReach.tsx#L81)

- The event's one key
  [`SuiteReach.tsx:94`](../../components/organisms/SuiteDirectory/SuiteReach.tsx#L94)

- The hero renders the instrument, because it holds the decision the Directory cannot see
  [`HomeLayout.tsx:138`](../../components/organisms/HomeLayout/HomeLayout.tsx#L138)

- SM-1 split by door, of the numerator only, the undivided denominator stated
  [`visitor-instrumentation.md:96`](../../ops/visitor-instrumentation.md#L96)

- The record's join held to the key the component actually sends
  [`visitor-instrumentation.test.ts:126`](../../ops/__tests__/visitor-instrumentation.test.ts#L126)

**Peripherals**

- The hero hands the decided door down, read through a fake observer
  [`HomeLayout.test.tsx:212`](../../components/organisms/HomeLayout/__tests__/HomeLayout.test.tsx#L212)

- The two keyframes and their four rules pinned in the compiled sheet
  [`HomeLayout.test.tsx:564`](../../components/organisms/HomeLayout/__tests__/HomeLayout.test.tsx#L564)

- The ledger: five entries closed, DW-124 to DW-126 filed for the Operator
  [`deferred-work.md:5658`](deferred-work.md#L5658)

- The dated note on the motion rule
  [`EXPERIENCE.md:693`](../planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/EXPERIENCE.md#L693)

- The asset-budget reading: no route moves by more than 64 bytes on the wire
  [`asset-budget.md:484`](../../ops/asset-budget.md#L484)
