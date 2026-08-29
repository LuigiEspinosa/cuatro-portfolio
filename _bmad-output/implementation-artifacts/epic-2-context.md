# Epic 2 Context: The suite becomes visible, Registry as product and the reshaped front door

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

A non-technical visitor scrolls past the narrative into a directory of six running applications
and opens one; a technical reviewer skips the narrative, reads an accurate `tech` array, and
reaches any repository in one hop. Epic 2 turns the App Registry into a published,
schema-validated JSON product the Hub itself consumes, reshapes the homepage so the Suite
Directory is the terminal section of its primary scroll, and rebuilds the Hub's inherited
components against the token contract so the front door becomes the reference implementation the
Satellites later copy. Largest epic in the plan, 31 stories.

## Stories

- Story 2.1: The pre-existing repository defects
- Story 2.2: Measure the narrative bundle against the asset budget
- Story 2.3: The Registry schema and its blocking CI gate
- Story 2.4: Confirm the assumed Statuses, hostnames and `tech` values
- Story 2.5: Author `contracts/registry.json`
- Story 2.6: The editorial voice pass
- Story 2.7: Retire `content/projects.ts`; the Hub imports the published Registry
- Story 2.8: Assert the 44x44 hit-target floor
- Story 2.9: The Suite Directory
- Story 2.10: Assert the Status mark's three structural axes
- Story 2.11: The premise block and the framework band
- Story 2.12: The narrative resolves into the Suite Directory
- Story 2.13: The non-3D front door and the skip control
- Story 2.14: `/projects` redirects permanently to `/#suite`
- Story 2.15: Nav reshape to two destinations
- Story 2.16: `/cv` built around the existing `WorkTimeline`
- Story 2.17: Secondary surface states
- Story 2.20: Migration step 5, swap the type
- Story 2.22: Migration step 7, delete the aliases
- Story 2.23: Scheduled Registry verification, external to the box
- Story 2.24: Hub visitor instrumentation
- Story 2.25: Relocate `list-wheel` onto a `cuatro.dev` subdomain
- Story 2.26: The Hub's focus standard and the manual accessibility pass
- Story 2.27: Redesign `GlitchText` token-native
- Story 2.28: Redesign `ScanlineOverlay` as the scrim layer, consuming `--token-scrim`
- Story 2.29: Redesign `HomeLayout` token-native
- Story 2.30: Redesign `Error404` token-native
- Story 2.31: Redesign `WorkItem`, and retire `HudLabel` into the Plate mark
- Story 2.32: Redesign the chrome: `Navbar`, `Header`, `Logo`, `ContactContainer`, `Container`
- Story 2.33: Redesign `WorkHero` and `WorkTimeline` token-native
- Story 2.34: FR-17 conformance, no colour literal outside the contract

2.18, 2.19 and 2.21 are deliberate holes from the 2026-08-15 restyle scope change, never
renumbered, so every surviving key keeps its meaning.

## Requirements & Constraints

**Registry.** One entry per Estate application, archived and absorbed ones included. Required on
every entry: `id`, `name`, `description`, `status`, `tech`, `source`, `demo`, `identity`.
Optional: `live`, `family`, `absorbed_into`, `token_contract`. `demo` and `identity` carry an
explicit value including `none`, because absence is never "not applicable". `live` is required
when `status` is `Live` and forbidden when `Archived`, and going offline moves `status` and
removes `live` in one change. `status` is exactly `Live`, `Complete`, `In progress` or `Archived`.
`source` has no exceptions and resolves to a repository, not a profile page. The public hostname
is declared in `live`, never derived from an `id`. The published file is consumed over plain HTTPS
with no JavaScript import, by any language and by the Hub itself rather than a private copy.
Descriptions run one to three sentences: no superlative, no first person, and no number that was
not supplied.

**Front door.** The Directory is the terminal section of the homepage's primary scroll, in the
same document, with nothing after it but footer. Which entries render is a declarative rule over
`status`, never a hand-maintained second list: flipping an entry to `Live` surfaces it with no
other edit. A cold arrival reaches it in at most one interaction and no required scrolling. The
narrative may never block the payload: the Directory stays interactive independently of asset
loading and renders fully usable when WebGL is absent, blocked, throwing or suppressed by reduced
motion.

**Asserted, not claimed.** At 360px every interactive element measures at least 44x44 by
`boundingBox()`, with no horizontal scroll and no truncated Status value, and each new assertion
is demonstrated failing against a deliberate fixture removed in the same story. Reaching the
Directory is a distinguishable first-party event from loading the homepage, and opening a `live`
link distinguishable from a `source` link; targets are 60% suite reach and 35% click-through.

## Technical Decisions

The token contract is `Contract v1.0.0` and **Epic 2 does not move it**: `--token-scrim` and
`--tap` (44px, the only `px` length in the contract, never hand-written) already ship in v1.0.0,
so the scrim story consumes the role rather than adding it. An older change proposal says v1.1.0
and is superseded.

The colour-literal gate needs four dispositions written in with their reasons or it meets them at
scale on its first run: `opacity` keyframes, `font-variation-settings` axis literals and
`clip-path` polygon coordinates are allowed, a hand-written `44px` is rejected. The one alpha
allowance is written against the `--c-scrim` palette declaration, never against the
`--token-scrim` role name, or the gate rejects the contract file itself; an `rgba()` reproducing
the composited scrim colour elsewhere is still a breach.

Seam S-1, the Three.js narrative's JS colour values, is the single declared exception to contract
coverage. The Epic 1 aliases survive until the last component is redesigned, which is their named
deletion trigger. Rendered output is asserted through the Playwright harness against the
redesigned baseline, not the pre-redesign build, and the restyle diff is not CSS-only: markup
changes are permitted where layout requires them.

## UX & Interaction Patterns

**Precedence, as a total order:** `DESIGN.md` wins any value, `EXPERIENCE.md` any behaviour,
`RESTYLE-SPEC.md` geometry, composition and anything none of them states. Mocks and existing
implementations lose to all three; a genuine gap is raised, not decided in a stylesheet.

The row is the unit at every width and nothing reflows into cards: a grid row with a hairline
separator and no containing box. The live and source links are two independently addressable
targets, and the row is never wholly clickable. The Status mark differs on three structural axes
and never on hue, `border-style` alone, or opacity: a 4px square dot present or absent, solid
versus dashed, border present or absent.

Only `transform` and `opacity` animate, properties are named individually, `transition: all` is
banned, opacity never expresses state, and no animation loops. Hover is one signal, recolouring an
existing underline or border, never adding one and never changing ground, scale or elevation.
Focus is `:focus-visible` only, painted instantly and never transitioned, on a token distinct from
hover.

Excluded structurally: filled controls, shadows, gradients, rounded corners, card-in-card,
icon-tile grids, full-viewport centred heroes, glassmorphism, emoji as icons, invented metrics,
skeletons, spinners and placeholder states. Accent is at most 3% of the viewport as intent, and
binary as a gate: zero uses of accent as a background or fill at any state. Widths are `100%` with
container padding and `overflow-x: clip`, never `100vw` or `hidden`. The non-3D budget is 140 KB
gzipped, measured per story rather than assumed.

**Retires:** the glitch loop, chromatic aberration, the scanline raster, the vignette, film grain,
the grid-line gradient ground, dim-siblings-on-hover, the scrambling glyph pool. **Survives:**
mono uppercase signage on a hairline, the readout register, the corner-notched `clip-path`
silhouette, the leading-edge nav rule, and the scrim's legibility job as one flat layer at one
value, present or absent, never faint.

## Cross-Story Dependencies

The Registry chain is strictly serial: schema and gate, Operator confirmation, authoring,
editorial pass, retiring the TypeScript module, then the Directory. `/projects` is repointed at
the JSON before it is redirected away, so it never spends a commit broken.

Epic 1 gates this epic three times: bot mitigation before the Directory ships, the capacity
threshold before the `list-wheel` placement, and the routing inventory supplying the hostnames the
Registry declares. Instrumentation needs the Umami database to survive Epic 1's host
consolidation. Relocating `list-wheel` and restyling it are separate shipped steps in different
epics.

The type swap blocks all seven component redesigns, the conformance gate depends on all of them,
and the alias deletion on the last. The scrim redesign precedes the home surface, which carries
the z-level trap: a sticky header above the scrim computes against the imagery, verified by
sampling the rendered ground rather than reading z-index values. Epic 8 is blocked on this epic,
which produces the vocabulary it copies.
