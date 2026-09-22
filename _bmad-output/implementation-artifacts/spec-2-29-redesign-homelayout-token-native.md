---
title: 'Story 2.29: Redesign `HomeLayout` token-native'
type: 'feature'
created: '2026-09-21'
status: 'in-progress'
baseline_commit: '88e209937b10bf40cb83d018bec3b29394c3e4b7'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** The homepage is the Hub's largest surface and the last one still painting itself from
2023 literals: a `#0a000f` ground under a two-gradient grid, three raw `z-index` values, a
`opacity: 0.2` dim-siblings behaviour that expresses state with opacity, two ungated `:hover` rules
that stick on touch, a synthesised narrow face, hand-written tracking, and a GSAP entrance whose
durations and clock sit outside the contract's reach. It is also the only surface where text
overlays moving imagery, so it is where `--token-scrim` finally gets a consumer and where the
scrim's stack guarantee is either built correctly or quietly broken.

**Approach:** Rewrite `HomeLayout.scss` against `contracts/tokens.css` alone, place
`ScanlineOverlay` inside the canvas's own stacking context so the panels sit genuinely above the
scrim, convert the entrance from a GSAP timeline to CSS keyframes on opacity, and close the six
ledger rows and their records in the same commit.

## Boundaries & Constraints

**Always:**

- The stylesheet reads `--token-*`, `--f-*`, `--t-*`, `--w-*`, `--lh-*`, `--tr-*`, `--s-*`,
  `--r-*`, `--stroke-*`, `--dur-*`, `--ease-*` and `--z-*` from the contract and nothing else. No
  alias (`--accent`, `--accent-dim`, `--light-gray-color`, `--font-regular`, `--font-mono`,
  `--confillia-normal`, `--page-padding`), no colour literal, no `rgba()`, no gradient.
- The file declares **no custom property of its own**. `anchor-contract.test.ts` holds every
  declared `--name` to `app/app.scss`, so a `--home-enter-delay` would fail it. Delays are plain
  `animation-delay` declarations.
- The four `clip-path` notch polygons survive byte for byte (`epics.md:3304-3305`).
- Every `:hover` block is wrapped in `@media (hover: hover)` (`epics.md:3332-3333`, review A-5).
- Only `transform` and `opacity` animate, properties are named individually, `transition: all` is
  barred, opacity never expresses state, nothing loops (`EXPERIENCE.md:689-699`).
- `--hero-height` stays at `app/app.scss:36` with its value and its name. It has zero call sites and
  is pinned as a literal in two suites; the criterion is discharged by leaving it alone.
- `HomeLayout` keeps its class names, its markup order and its two front doors. `front-door.pw.ts`,
  `narrative.pw.ts`, `hit-target-floor.pw.ts` and `visitor-instrumentation.pw.ts` key on
  `.home-container`, `.home-container--flat`, `.home-panel--name`, `.home-panel--nav`, `.home-gem`,
  `#gem-canvas` and `.skip-control`.
- Every ledger row deleted here is deleted from `accessibility-floor.pw.ts`,
  `hub-accessibility-pass.md` and the `known-violations.md` counts in one commit. The record and the
  spec are held equal in both directions and neither failure says "a row was removed".

**Ask First:**

- Giving any panel a ground, a border or a shadow. The silhouette stays invisible geometry by
  ruling; making it read is a UX change and `RESTYLE-SPEC.md:133-136` bars a boxed nav.
- Changing `contracts/tokens.css`. Epic 2 does not move the contract; a missing role is raised, not
  minted.
- Editing `header.scss`, `navbar.scss`, `Header.tsx`, `Navbar.tsx`, `Logo`, `ContactContainer`,
  `Container` or `container.scss`. All are Story 2.32's.
- Editing `ScanlineOverlay.scss` or `ScanlineOverlay.tsx`. Story 2.29 places the layer; it does not
  reopen it. A `ScanlineOverlay.scss` edit also fails that file's exact-CSS-equality case.
- Regenerating `work-360x800-chromium-linux.png`. It depicts `/work` and this story must not move it.

**Never:**

- No scroll-triggered entrance, no second entrance, no loop, no bounce, overshoot or gesture, no
  `:active` treatment, no `backdrop-filter`, no alpha ground outside `--token-scrim`.
- No scrim as a surface treatment: not a panel ground, not a section ground, not a vignette, not a
  hover state, and never faint. One value, present or absent.
- No new dependency. GSAP stays installed for the narrative and `WorkTimeline`; it simply leaves
  this component.
- No touching the Three.js scene's colours. Declared seam S-1.
- No `eslint` invocation and no lint acceptance criterion. There is no lint gate in this repository.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default front door, >= 768px | `path` resolves `narrative` | Gem spans the container at `--z-base`; `.scanline-overlay` paints inside it at `--z-raised`; the four panels and `.skip-control` sit above the gem's whole subtree at `--z-raised` | N/A |
| Default front door, < 768px | Same, viewport 360 | Panels static in reading order (name, imagery, navigation, contact); the readout panel is not rendered; the scrim is absent, because no text overlays imagery here | N/A |
| Flat front door | `path` resolves `flat`, or `servedPath='flat'` | `.home-container--flat`, no `.home-gem`, no `.skip-control`, so no scrim; hero is as tall as its content | N/A |
| Reduced motion | `prefers-reduced-motion: reduce` | Flat hero on first paint from the CSS mixin; every entrance keyframe is `animation: none` with the final state already painted | N/A |
| No script | JavaScript disabled or the chunk never arrives | Every panel, the role line and the links are at full opacity: the base state is the final state and the keyframe supplies only the `from` | Closes DW-42 |
| Touch tap on a link | `pointer: coarse` | No hover colour is painted at all, so none can stick | Closes review A-5 for this file |
| Keyboard traversal | Tab through the five links | Each `:focus-visible` ring is painted whole; no panel's notch clips it | N/A |

</frozen-after-approval>

## Code Map

**The component**

- `components/organisms/HomeLayout/HomeLayout.tsx` (168 lines). `:3` the `gsap` import, `:10` the
  `useGsapContext` import and `:52-84` the whole timeline go; `containerRef` goes with them, so the
  root `<div>` loses its `ref`. `:27` `useReduceMotion` and `:49-50` `useNarrativePath` stay: the
  path decision is Story 2-13's and is untouched. `:136-139` the gem block gains
  `aria-hidden='true'` on `.home-gem` and renders `<ScanlineOverlay />` as its last child, after
  `<GemComponent />`. The docblock at `:88-106` cites `HomeLayout.scss:80-82` for the dimming that
  this story retires: that sentence is rewritten, not deleted, because the control being outside
  every panel is still load-bearing for the entrance.
- `components/organisms/HomeLayout/HomeLayout.scss` (340 lines): rewritten. Detail in Design Notes.
  Deletions that need no replacement: `.home-overlay` (`:25-31`) and `.home-sys-coords`
  (`:108-116`) are **dead rules**, matched by no markup anywhere in the repository (verified by a
  tree-wide grep on 2026-09-21), so `z-index: 20` closes by deleting the rule that carried it.
- `components/organisms/HomeLayout/__tests__/HomeLayout.test.tsx` (202 lines): `:57-61` the
  `useGsapContext` mock goes with the hook (DW-41 dissolves rather than being fixed). `:122-124` the
  comment citing the dimming is rewritten. New cases per Tasks.

**The layer this story places**

- `components/atoms/ScanlineOverlay/ScanlineOverlay.tsx` and `.scss`: **read-only.** The component's
  placement contract is that it covers the positioned box it is placed in, so the parent is the
  imagery's box. `.home-gem` is that box. `ScanlineOverlay.scss:11` fixes it at `var(--z-raised)`.
- `components/atoms/SkipControl/SkipControl.scss:23-25`: the comment cites `.home-gem` at
  "`z-index: 3`". Amended in place to `--z-base` with the date. The declaration at `:25`
  (`var(--z-raised)`) is unchanged and is the precedent this story follows for the panels.

**The ledger, and the three files that hold it equal**

- `tests/e2e/accessibility-floor.pw.ts`: delete four rows, `z-home-overlay` (`:197-204`),
  `z-home-panel` (`:205-212`), `z-home-gem` (`:213-220`) and `gradient-home-ground` (`:245-252`).
  `clip-home-nav` (`:269-276`) and `clip-home-contact` (`:277-284`) also go, because the rings stop
  being clipped. Two-space indent for the brace, four per field, fields in the order
  `id, check, match, count, source, closedBy`; the parser at `hub-accessibility-pass.test.ts:90-122`
  refuses a reflow.
- `ops/hub-accessibility-pass.md`: the six ledger rows at `:243`, `:244`, `:245`, `:249`, `:252`,
  `:253`. The counts at `:29` (six stops to one), `:35` (six z-index literals to three), `:36` (six
  depth tells to four) and `:70`. The clip table rows `:181-184` and the paragraph at `:168` and
  `:186`. F-11 at `:300` gets a dated closure clause naming what remains (`app/app.scss:136-137`
  and `error-page.scss:9-10`), in the F-8 shape: findings are annotated, never deleted
  (`:484-485`). `:115` the focus-standard prose (three of the four non-standard rings were the home
  links). `:143` the ground row. `:93`, `:96`, `:266`.
- `ops/__tests__/hub-accessibility-pass.test.ts`: no edit expected, and that is the point. `:276-277`
  pins `z-work-hero`, not a home row, so it survives. `:357-384` re-reads each surviving row's cited
  lines off disk, so a HomeLayout reflow is caught there. `:608-620` regenerates the spelled-out
  sums from the ledger and matches them against the KV-6 heading and index row, so the three
  `known-violations.md` counts below must move with the rows or this fails.
- `ops/known-violations.md`: index row `:67`, heading `:472`, counts paragraph `:484-490`, "What is
  in breach" `:512`, "Where the repairs are booked" `:518`, "Retired by" `:520`. Each count is
  spelled out in both the heading and the index row. `:352` (KV-4) and `:562` (pending Operator
  action 9, whether 2-32's criteria widen or 2-29 takes the home pair) get a dated clause: 2-29
  took the home pair.

**Pins on the contract partition and the alias layer**

- `app/__tests__/anchor-contract.test.ts:284-319` `TOKEN_NATIVE_STYLESHEETS`: add
  `'components/organisms/HomeLayout/HomeLayout.scss'` in path order, with a comment in the `:293-295`
  shape. `:855-857` is the case seen failing first when the path is absent; claim three at `:889-898`
  and claim four at `:900-` follow.
- `tests/e2e/anchor-aliases.pw.ts`: three `--accent-dim` `CALL_SITES` rows go (`:415`, `:416-426`
  including its `wide: true` 1024 read, `:427-433`), and `CALL_SITE_COUNT` at `:438` moves with
  them. `:629-636` asserts `--confillia-normal` has exactly two call sites, both in
  `HomeLayout.scss`, both setting `font-stretch: 75%` on the line after `font-family`: that pin
  becomes a zero-call-site pin in the shape `--hero-height` already uses at `:158`.
- `tests/e2e/type-swap.pw.ts:86-92` `CONFILLIA_SITES` and `CONFILLIA_STRETCH`, and the read at
  `:558`: same retirement.

**The ground literal, pinned in two more places**

- `tests/e2e/contract-anchor.pw.ts:1067` and `:1072`: assert `body` background is exactly
  `rgb(10, 0, 15)` on `/`. Becomes `--token-bg`'s computed value.
- `ops/__tests__/hub-accessibility-probe.test.ts:31`: `const ground: Rgb = [10, 0, 15]`. Same.

**Weight**

- `ops/asset-budget.md`: a new `### The 2026-09-21 reading, after Story 2-29` above the Story 2-28
  reading at `:471`, in its shape (`:473-484` Verbatim provenance, `:498-507` the before/after
  table, `:509-540` the Derived paragraphs), and a matching
  `### The 2026-09-21 run, after Story 2-29` under § Findings at `:993`. The before is `dev` at
  `88e2099`, whose build should reproduce the Story 2-28 after figures (21 `.js`, 13 `.css`;
  618,931 gzipped; 8,681 gzipped of `.css`). `/` is a dynamic route and writes no prerendered
  document, so it has never had a row in the per-route table and will not gain one; the movement is
  in the per-chunk listing and the totals. DW-57's `/projects` rows are cleaned in the same pass.
- `ops/asset-budget.mjs` takes no arguments; run `corepack pnpm build` first.

**Records**

- `_bmad-output/implementation-artifacts/deferred-work.md`: close DW-33, DW-41, DW-42, DW-48,
  DW-97, DW-98, DW-100, DW-101 and DW-57's second half; close DW-82's HomeLayout half; correct
  DW-46's premise. Entry format is the YAML list item
  (`source_spec`, `id`, `summary: >-`, `evidence: |-`, `status`), closure appended as a final
  paragraph opening `Closed 2026-09-21 by Story 2-29, ...`.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:230`: `backlog` to `review`, with a
  comment block above it in the `:215-228` form.

**Read-only evidence gathered during planning**

- There is exactly one committed Playwright baseline and it depicts `/work`. **No baseline PNG
  changes in this story**, and `rendered-output.pw.ts:216` fails the run if a stray snapshot appears.
- `Header.tsx:12` returns `null` on `/`, so no sticky header renders over the home canvas, and
  `header.scss:59` already sets `background-color: var(--token-bg)`. Both permitted resolutions of
  the z-level trap hold; the criterion is about proving it by sampling, not about changing code.
- No `aria-hidden` and no `tabIndex` exists anywhere on the gem canvas subtree (`GemComponent.tsx`,
  `GemNarrative.tsx`, `Gem.tsx`, `CanvasOrbitControls.tsx`). DW-46's premise that Story 2-13 shipped
  both halves is wrong.
- `app/app.scss:115-118` already sets `overflow-x: clip` on `html, body`, and `:120-128` already
  uses `width: 100%`. The criterion at `epics.md:3362-3366` was discharged by Story 2-9.

## Tasks & Acceptance

**Execution** (in this order):

- [ ] On `dev` at `88e2099` before branching: `corepack pnpm build && node ops/asset-budget.mjs`
      plus the gzipped size of every `.next/static/chunks/*.css`, saved to the scratchpad as the
      before reading; confirm it reproduces the Story 2-28 after figures.
- [ ] Branch `story/2-29-redesign-homelayout-token-native` off `dev`.
- [ ] `deferred-work.md`: close DW-97 first, before the criteria are frozen, because its trigger is
      this story's planning. Its finding stands: the withdrawn A-14 clause "its content is stated in
      prose" is not implemented here, and `epics.md:3336-3338` is read as the `aria-hidden` and
      not-focusable half only. Correct DW-46's premise in the same pass.
- [ ] `HomeLayout.scss`: the rewrite as Design Notes states. Run
      `corepack pnpm test --run app/__tests__/anchor-contract.test.ts` with the path left out of
      `TOKEN_NATIVE_STYLESHEETS` and see `:855-857` fail naming `HomeLayout.scss`; then add the entry.
- [ ] `HomeLayout.tsx`: the timeline, the `gsap` and `useGsapContext` imports and `containerRef` out;
      `aria-hidden='true'` and `<ScanlineOverlay />` into the gem block; the two stale docblock
      sentences rewritten.
- [ ] `SkipControl.scss:23-25`: the comment amended to `--z-base` with the date.
- [ ] `HomeLayout.test.tsx`: drop the `useGsapContext` mock; add cases for the scrim's presence
      inside `.home-gem` and its absence on the flat path, for `aria-hidden` on `.home-gem` with no
      focusable descendant, and for the stylesheet read (the ScanlineOverlay ordering: verify each
      pinned role against `contracts/tokens.css` first, then against the source). See each fail
      against the old files first.
- [ ] `accessibility-floor.pw.ts`, `hub-accessibility-pass.md`, `known-violations.md`: the six rows,
      the four counts, the clip table, F-11's closure, the three KV-6 cells. Then
      `corepack pnpm test --run ops/__tests__/hub-accessibility-pass.test.ts` green, having seen
      `:608-620` fail first against the unmoved counts.
- [ ] `anchor-aliases.pw.ts`, `type-swap.pw.ts`, `contract-anchor.pw.ts`,
      `ops/__tests__/hub-accessibility-probe.test.ts`: the `--accent-dim` rows and count, the
      `--confillia-normal` retirement to a zero-call-site pin, the two ground literals.
- [ ] Branch build: `corepack pnpm build && node ops/asset-budget.mjs` and the `.css` sizes again;
      `ops/asset-budget.md`: the dated reading and run, the Derived delta, DW-57's `/projects` rows.
- [ ] Container, `corepack pnpm test:e2e`: the full suite, with the DW-101 sampling case added to
      `accessibility-floor.pw.ts`. Record each measured ratio beside the table's figure.
- [ ] `deferred-work.md`: close the remaining entries. `corepack pnpm test --run`,
      `corepack pnpm typecheck`; commit on the branch (no push and no remote operation from the
      implementation step); `sprint-status.yaml`: `review` and the comment block.

**Acceptance Criteria:**

- Given the rewritten stylesheet, when `corepack pnpm test --run components/organisms/HomeLayout`
  runs, then the source names no alias, no colour literal, no `rgba(`, no `linear-gradient`, no
  `transition: all` and no bare `z-index:` integer, every pinned role is declared in
  `contracts/tokens.css`, and the file declares no custom property of its own.
- Given the pinned image's build, when `accessibility-floor` runs, then the tally reads three
  `z-index` literals, four depth tells and one clipped ring with no stale row and no unlisted
  occurrence, and `hub-accessibility-pass.test.ts` passes in both directions with `2-29` gone from
  the KV-6 index row.
- Given `/` at 1024x800 on the default path, when the composited surface is screenshotted and the
  rendered ground beneath each panel's text is sampled, then the scrim is genuinely beneath every
  one of the five roles, each measured ratio is recorded beside the table's figure from
  `epics.md:3254-3256`, and each clears its own floor. Sampled at 1024 rather than at DW-101's
  stated 360, because below 768 the layout stacks and no text overlays imagery, so at 360 there is
  no composited surface to sample.
- Given `/` on the default path, when the DOM is read, then no `.header-container` is present, so
  the sticky header is outside the canvas's box; and the resolution is recorded as proven by the
  sampled ground rather than by reading z-index values.
- Given a keyboard traversal of `/`, when each of the five links takes focus, then its
  `:focus-visible` ring is painted whole with no fragment clipped by a panel's notch, and all four
  `clip-path` polygons are byte-identical to their pre-story values.
- Given a `pointer: coarse` context, when a nav or contact link is tapped, then no hover colour is
  computed on it at any point, and no panel changes opacity because a sibling was tapped.
- Given the served document with scripting disabled, when `/` is rendered, then every panel, the
  role line and all five links are at full opacity, and under `prefers-reduced-motion: reduce` the
  same holds with `animation: none`.
- Given the before and after builds, when `ops/asset-budget.md` is read, then the dated reading
  states the `.css` and `.js` gzipped bytes before and after, names GSAP's departure from this
  component's chunk as a mover, and gives the Derived delta against the Story 2-28 reading, each a
  number with its method.
- Given `corepack pnpm test --run`, `corepack pnpm typecheck` and `corepack pnpm test:e2e`, when
  they run, then every file passes, with `anchor-contract.test.ts:855-857` and
  `hub-accessibility-pass.test.ts:608-620` each having been seen failing first.

## Spec Change Log

## Design Notes

**The layering, and why it needs only two z roles.** `.home-gem` takes
`z-index: var(--z-base)` while positioned, which makes it a stacking context. `ScanlineOverlay`
renders inside it, and its own `var(--z-raised)` is then confined to that context: it paints above
the canvas and below everything outside the gem. The four panels and `.skip-control` take
`var(--z-raised)` at container level, so they clear the gem's entire subtree, scrim included. That
is the stack guarantee built rather than asserted, and it is the only arrangement the contract
affords, because the contract's next role above `--z-raised` is `--z-dropdown` at 100 and a corner
panel is not a dropdown. `SkipControl.scss:25` already reached for `--z-raised` for exactly this
reason, so the panels follow an existing decision rather than inventing one. The scrim spanning the
canvas's full extent (`epics.md:3314-3315`) falls out of `.home-gem` being `inset: 0`, so a panel
cannot drift off its cover.

**Why the scrim is absent below 768.** There the hero is a flex column: the gem is a static item
between the name and the nav, and no text overlays it. A scrim there would be a treatment on
imagery, which `DESIGN.md:414-416` bars, and `DESIGN.md:428-429` prefers not overlapping text and
imagery at all where the layout allows. So the mobile block hides it, which is the layer's own
"present or absent, never faint" rule honoured rather than softened. The flat front door needs no
rule: `flat-hero` already hides `.home-gem`, and the scrim goes with its parent.

**The entrance, as CSS.** Base state is the final state, the keyframe supplies only the `from`, and
`animation-fill-mode: both` holds the `from` through the delay:

```scss
@keyframes home-enter { from { opacity: 0; } }

.home-role { animation: home-enter var(--dur-major) var(--ease-entrance) 1300ms both; }
```

Opacity alone: the `translateY(20px)` goes, because the converted form is a keyframe on opacity and
`DESIGN.md:734` bars a transform offset in the entrance. Duration is `--dur-major`, easing
`--ease-entrance`, and the five delays keep the shipped sequence (500, 1300, 1600, 2000, 2200ms)
with an 80ms stagger inside the two link groups. They are plain `animation-delay` literals, not
custom properties, because `anchor-contract.test.ts` would refuse a `--name` declared here; the
contract mints no delay role, which is the honest gap and is why `GlitchText` already passes
`--delay` as an inline style. Three things fall out that GSAP could not give: one clock measured
from first paint rather than from hydration, so the heading's `--delay: 1s` and these delays finally
agree (DW-100); a no-script floor, because the base state is already the final state (DW-42); and
reduced motion reaching the durations through the contract's own 1ms collapse, restated explicitly
as `animation: none` in the `GlitchText.scss:50-58` shape.

**The clipped rings, closed without touching the silhouette.** Each notch cuts a 10px triangle from
one corner of a panel that contains focusable links, and a ring at `--stroke-focus` with
`--focus-offset` runs 5px past the link's box, so five rings paint as fragments. The four polygons
are kept exactly; what changes is that each panel gains `padding` on its two notched sides at
`var(--s-sm)` (12px), which is more than the 10px cut plus the ring's reach, so every ring falls
inside the clipped region. The silhouette is untouched and the ledger's clipped-ring count drops
from six to one, the survivor being the skip-link row that belongs to Story 2.32.

**What the silhouette actually paints, recorded rather than fixed.** The panels carry no background
and no border, so a `clip-path` on them clips only their children: the notched outline is invisible
on the shipped site, and the criterion's reasoning that it "carries most of what read as cybercore"
presumes a ground that does not exist. Ruled on 2026-09-21 to keep it as invisible geometry, exactly
as `epics.md:3304-3305` says, and to raise the observation rather than resolve it in a stylesheet.
Story 2.34 still needs its `clip-path` disposition either way.

**Role mapping.** `#0a000f` to `--token-bg`; the grid pair deleted, not tokenised. `--accent-dim` on
the three leading-edge rules to `--token-border` (`DESIGN.md:768`). `--light-gray-color` on the role
line to `--token-text-secondary`, on the links to `--token-text`. `--accent` on hover to
`--token-accent-hover`. `--accent` on the three `aria-hidden` Japanese ornaments to
`--token-accent-muted`: no document dispositions them, and the nearest binding rule is the
subordinate-line one at `RESTYLE-SPEC.md:447-451` (ornament only, `--token-accent-muted`,
`aria-hidden` always), which they already satisfy on the accessibility half. `--font-regular` to
`--f-body`, `--page-padding` to `--page-pad`. Tracking literals `0.06em`, `0.08em` and `0.1em` to
`--tr-body` on the role line and `--tr-meta` on the ornaments. Hover transitions to
`color var(--dur-micro) var(--ease-toggle)`; the `opacity 0.4s ease` on `.home-panel` goes with the
dimming it drove.

**The nav and contact type, an assumption to check at the checkpoint.** `--confillia-normal` and its
`font-stretch: 75%` retire to `--f-display` at `--w-bold` and `--tr-heading` by the ruling of
2026-09-21. The size is the open part: the shipped `clamp(1.5rem, 2.5vw, 2.5rem)` is a hand-written
length pair with no contract equivalent, and the contract's only clamp is `--t-display`, which is
the name's role and would make the nav compete with it. Specified as `--t-xl` (1.9531rem), the
largest fixed step that does not overflow 360px, which reads smaller than today on a wide desktop
and larger on a phone. `DESIGN.md:760` names no role for these links, so this is a reading of the
gap, not a value the design supplied.

**Rollback.** Revert the commit; the literals, the GSAP timeline, the six ledger rows, F-11's open
state and the alias call sites return together, and no record carries a runtime.

## Verification

**Commands:**

- `corepack pnpm test --run`: expected every file passes. Roughly 890 tests across 34 files in 85
  to 120 seconds before this story's additions; treat the figure as an expectation, never assert on
  it.
- `corepack pnpm typecheck`: expected clean, and it refuses `containerRef` if the timeline was
  removed without its `ref`.
- `corepack pnpm build && node ops/asset-budget.mjs`: expected a build that publishes the
  contract first, then a reading whose `.css` and `.js` figures differ from the 2-28 reading by an
  amount the Derived paragraph accounts for.
- `corepack pnpm test:e2e`: expected green with no filter, including the new DW-101 sampling case
  and the six-row harness count at `hub-accessibility-pass.test.ts:633-651`.

**Manual checks:**

- The DW-101 sampling is read by a human against `epics.md:3254-3256`: five roles, five measured
  ratios, each one recorded beside the table's figure and each clearing its own floor. A ratio that
  disagrees with the table by more than rounding is a finding, not a number to write down.
- Play the entrance at 2x to 5x duration in the DevTools animation inspector. The five delays were
  tuned against a GSAP clock that started at hydration and now start at first paint, so the sequence
  is correct by construction but its feel is not, and the gap between the heading's reveal and the
  panels' is the part to look at with fresh eyes the next day.
