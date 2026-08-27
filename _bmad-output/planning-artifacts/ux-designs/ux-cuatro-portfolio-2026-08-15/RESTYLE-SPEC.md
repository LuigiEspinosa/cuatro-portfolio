---
name: Cuatro Ecosystem, Restyle Specification
status: final
updated: 2026-08-16
version: 1.0.1
amended-2026-08-16: >-
  Corrections raised by the epics restyle pass. The floor is twelve checks, not eleven, in all
  three places that undercounted it. --tap replaces the hand-written 44px literal throughout.
design: ./DESIGN.md
experience: ./EXPERIENCE.md
binds: FR-36, FR-37, FR-38, AD-24, AD-25, SM-12
required-by: Epic 2 Stories 2.27–2.34, Epic 8 Stories 8.1–8.6
sources:
  - ../../sprint-change-proposal-2026-08-15.md
  - ../../architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md
  - ../../prds/prd-cuatro-portfolio-2026-08-15/prd.md
  - ./rebaseline-2026-08-15.md
---

# RESTYLE-SPEC.md, the component vocabulary

This is the artifact AD-24 exists to require. Seven applications in five frameworks implement the
same component vocabulary, sharing no code by construction. Something has to federate, and code
cannot. **A written specification is the only form that crosses HEEx, Svelte, Angular, React and
Vue**, and if it is not written, five hand-authored implementations drift and the pressure to
extract a package becomes the path of least resistance. That is spine C-12, recorded as the
decision most likely to break later.

Read with [`DESIGN.md`](DESIGN.md), which owns every value this file names, and
[`EXPERIENCE.md`](EXPERIENCE.md), which owns behaviour. **Both spines win on conflict with this
file.** This file wins on conflict with any implementation.

**Who this is written for.** An Elixir developer, a Svelte developer and an Angular developer who
will each implement from it independently and never see each other's work. Everything below is
stated as a value, a geometry or a check, because those are the three things that survive that
gap. Nothing below is stated as a feeling.

---

## The governing decision: the effects retire, the signage survives

*Operator decision, 2026-08-15. Stated once, here, because it governs every entry below.*

The 2026-02 cybercore rebrand (PRs #46–#70) brought a HUD-and-scanline-and-glitch language. O-10
decided the **palette**; it did not decide the **language**. It is decided now:

| Retired | Survives |
|---|---|
| The `glitch-loop` keyframe animation | Mono uppercase signage on a hairline |
| The red and cyan chromatic aberration | The coordinate and readout register |
| The scanline raster | The corner-notched panel silhouette |
| The radial vignette | The leading-edge rule on a nav item |
| The SVG film grain | Tabular metadata in mono |

**The surviving half is not a compromise; it is already in the contract.** `DESIGN.md` § Components
specifies a **Plate mark**: mono, `--t-3xs`, uppercase, tracked, on a hairline, carrying section
identity. That is what `HudLabel` is. The rebrand and the contract independently arrived at the
same atom, and § Label below folds them into one.

**Two reasons the effects go, and the second is the load-bearing one.**

1. They are in structural collision with the contract independent of colour. `ScanlineOverlay` is
   built from a `radial-gradient` vignette and a `repeating-linear-gradient` raster, and § Rules
   bans gradients in backgrounds outright. The aberration requires two opposing hues that a
   single-anchor-hue palette structurally cannot supply.
2. **They are the half that cannot federate.** A keyframe timeline, a `clip-path` sequence, a
   blend layer and an animated noise asset each have to be authored five times, in five
   frameworks, by one person, and kept in step forever. `phx-update` can replace an element
   mid-animation (seam S-8). Signage is a font, a size, a tracking value and a 1px rule, the
   kind of thing a custom property carries intact across a framework boundary. The design is
   deliberately weighted toward the second kind, and this decision is that weighting applied to
   the inherited surfaces.

**What this does not mean.** It is not a retreat to a generic dark theme. The Hub keeps its
register: wide caps, hairlines, mono readouts, notched panels, a near-black violet ground. It
loses the four effects that were carrying that register on a framework-specific mechanism.

---

## The two tests this specification must pass

### The independent-implementation test

**If two people implement the same element from this file and get visibly different results, this
file is not finished.** Every entry below therefore states geometry as tokens rather than as
description, names its states exhaustively, names what is forbidden, and ends in a **Check** that
can be run in a browser without reference to another implementation.

Where an entry says "no", it means no. An entry that permits a judgement call names the judgement
and who makes it.

### The daisyUI test

`cs-tracker` runs Phoenix 1.8.7 with Tailwind v4 and daisyUI (O-7, closed). **A daisyUI button
carrying token colours is still a daisyUI button**: it is filled, it is rounded, and § Components
has no filled control anywhere in the system. Recolouring a component library does not displace
it.

§ Displacing a component library states what displacement actually requires, per framework family,
so Story 8.1 is bounded by a countable list rather than left open-ended.

---

## The vocabulary

Ten elements: **Control · Link · Row · Separator · Focus treatment · Status affordance · Heading ·
Label · Empty edge · Field · Media.** Every restyled surface in the estate is built from these, and
an application that needs another is telling you the specification is short, never that a package
should exist (AD-24). § What is deliberately not in the vocabulary says what to build the rest from.

Token names below are the semantic `--token-*` roles and the `--t-*` / `--s-*` / `--stroke-*`
scales from [`DESIGN.md`](DESIGN.md) § The Token Contract. **Consume the roles, never the raw
`--c-*` palette.**

**Precedence, as a total order, because "both spines win" left geometry conflicts falling to
nobody.** When two of these documents disagree:

1. **`DESIGN.md`** wins on any **value**: a colour, a size, a weight, a tracking, a duration.
2. **`EXPERIENCE.md`** wins on any **behaviour**: a state, an interaction, an accessibility rule.
3. **This file** wins on **geometry and composition**: how elements are put together, and
   everything neither spine states.
4. Any mock or implementation loses to all three.

If a conflict is genuinely none of the three, it is a defect in these documents. Raise it rather
than deciding it in an implementation, because deciding it in an implementation is how five of them
drift.

---

### 1. Control

**A control is a *boxed* affordance:** a button, a link styled as a button, a disclosure trigger, a
tab, a form submit. **It is not every clickable thing.** A link in prose, a link in a row and a nav
item are **Links** (§ 1b) and take no box. `DESIGN.md` § Components specifies both Nav and Links
unboxed, and boxing them would put a border around every nav item in five Satellites while the
Anchor has none. When in doubt: **if it would look wrong with a border around it, it is a Link.**

**There is no filled control anywhere in this system.** This is the single rule most likely to be
lost in translation, because every component library in the estate ships a filled button as its
default and its most-documented example.

| Property | Value |
|---|---|
| Ground | **Transparent.** Never a `background-color`, not at rest, not on hover, not when current |
| Border | `1px solid var(--token-border-interactive)` on all four sides |
| Corners | `var(--r-none)`, `0`. Explicitly overridden where a framework applies its own |
| Label | `var(--f-mono)`, `var(--t-2xs)`, uppercase, `letter-spacing: var(--tr-label)` |
| Label colour | `var(--token-text)` |
| Geometry | `min-height: var(--tap); display: inline-flex; align-items: center`, `padding-inline: var(--s-md)` |
| Sibling gap | `var(--s-lg)` minimum, so two `--tap` boxes cannot overlap |

**States, exhaustively.**

| State | Treatment |
|---|---|
| Rest | As above |
| Hover | Border becomes `var(--token-accent-hover)`. **Nothing else changes.** No fill, no lift, no scale, no shadow, no width change |
| Focus-visible | `outline: var(--stroke-focus) solid var(--token-focus)`, `outline-offset: var(--focus-offset)`, ring radius `var(--r-hair)`. **Applied instantly** |
| Active | No separate treatment. The action is the feedback |
| Current | Where a control expresses "you are here", a `var(--stroke-emphasis)` `var(--token-accent)` underline, plus `aria-current`. Never a fill |
| Disabled | **Does not exist at MVP.** If a framework forces one: border `var(--token-border)`, label `var(--token-text-secondary)`, `aria-disabled`. **Never expressed with `opacity`** |

**Forbidden.** Any `background-color` other than `transparent`. Any `border-radius` other than `0`.
Any `box-shadow`. Any `transform` on hover or focus. `transition: all`. A border-width change on
hover, width is a layout property and changing it reflows the row.

**Missing geometry, stated rather than left to judgement.** `padding-block: var(--s-xs)` (the
`var(--tap)` `min-height` is what actually sets the height; the padding exists so a two-line label
does not touch the border). `line-height: var(--lh-label)`. `min-width: var(--tap)` **as well as** `min-height`, because
a two-character label otherwise misses the floor on the horizontal axis while passing on the
vertical. Transition: `border-color var(--dur-micro) var(--ease-toggle)`, and that property only.

**`--tap` is a contract token** *(minted 2026-08-16, after three reference renders each invented it
locally)*. **Never hand-write `44px`**: the conformance gate rejects a spacing literal like any
other, and a floor written by hand in five frameworks is a floor that drifts in five frameworks.

**Check.** Screenshot a control at rest and on hover and diff the two images. **The only pixels
that differ are the border.** Then tab to it: the ring appears in one frame, not over a duration.
Then measure the box in DevTools: `≥ var(--tap)` on **both** axes.

---

### 1b. Link

**Unboxed, and it is the most common interactive element in the estate.** Three kinds, and the
distinction between the first two is what lets one row serve two readers.

| Kind | Colour | Underline | Where |
|---|---|---|---|
| **Primary** | `var(--token-text)` | `var(--stroke-emphasis)` in `var(--token-accent)` | The destination the surface exists to send you to |
| **Secondary** | `var(--token-text-secondary)` | `var(--stroke-hair)` in `var(--token-border-interactive)` | A supporting destination on the same row |
| **In prose** | `var(--token-text)` | `var(--stroke-hair)` in `var(--token-accent)` | Inside a paragraph, where a box would break the line |

- **Geometry.** `min-height: var(--tap); display: inline-flex; align-items: center`, and
  `padding-inline` where the label is narrower than `var(--tap)`. **Vertical padding on a plain
  inline element paints outward without growing the hit area**, and it is the single easiest floor
  to miss while appearing to meet it.
- **The underline is drawn on an inner span** not on the `--tap` box, or the rule floats away from
  the text by the height of the padding.
- **Hover:** the existing underline recolours to `var(--token-accent-hover)`. **It never appears on
  hover and never changes width**: both are layout changes and both reflow the line.
- **Focus-visible:** the standard ring (§ 4).
- **Visited is not styled.** A visited link is not different information.
- **Link text is self-describing out of context.** A bare domain and the word `Source` both are;
  "click here" is not.
- **Two links on one line take `var(--s-lg)` of gap** so the `--tap` boxes cannot overlap.

**Check.** Measure both axes. Then read every link's text with the surrounding sentence removed and
confirm it still names its destination.

---

### 2. Row

The repeating unit of any list: a Registry Entry, a match, a book, a work-history item, a switcher
row.

**The row is the unit at every width, and it is never a card.** No containing box, no background,
no radius, no shadow. At `≥760px` it gains columns; the markup does not change and **it never
reflows into cards**. There is one layout to maintain, which is the point for one maintainer
across eight repositories.

| Property | Value |
|---|---|
| Container | None. The row draws no box around itself |
| Ground | Inherited. The row paints no background at rest |
| Separation | A **separator** (§ 3) between siblings. Never `gap` alone, never a card edge |
| Vertical rhythm | `padding-block: var(--s-md)` minimum; a denser list may go to `var(--s-sm)`, never below |
| Primary label | Display face, `wdth 85`, `var(--w-bold)`, uppercase, `var(--t-base)`, `var(--tr-name)` |
| Secondary text | `var(--t-sm)`, `var(--token-text-secondary)`, capped at `var(--measure)` |
| Metadata | `var(--f-mono)`, `var(--t-3xs)` or `var(--t-2xs)`, uppercase, `var(--tr-meta)`, `tabular-nums` |
| Status | Hangs right (§ 5) |

**The geometry at both widths, stated concretely, because "it gains columns" is not a
specification.** This is the single largest piece of shared layout in the estate and three
implementations diverging here would undo most of what this file is for.

```css
.row {
  display: grid;
  gap: var(--s-2xs) var(--s-md);      /* row-gap, column-gap */
  padding-block: var(--s-md);
  padding-inline: 0;                  /* the row is flush; the PAGE is padded */
  align-items: start;

  /* < 760px, single column, reading order is DOM order */
  grid-template-columns: 1fr auto;    /* name | status */
  grid-template-areas:
    "name   status"
    "desc   desc"
    "meta   meta"
    "links  links";
}

@media (min-width: 760px) {
  .row {
    /* name+meta | description+links | status.
       Fractions, not fixed widths, so it holds at any container width. */
    grid-template-columns: minmax(12ch, 3fr) minmax(0, 5fr) auto;
    grid-template-areas:
      "name  desc   status"
      "meta  links  status";
    column-gap: var(--s-lg);
  }
}
```

- **`760px` is the one breakpoint.** No second one is minted for a row.
- **The description is capped at `var(--measure)`** inside its own column, not by the column.
- **Status is `align-self: start`** in both layouts, so it hangs from the top rather than centring
  against a variable-height description.
- **`minmax(0, …)` on the description column** is required, not stylistic: without it a long
  unbroken token (a URL, a stack name) blows the grid out and produces horizontal scroll at 360px,
  which is check F-10's neighbour and the most common way this layout fails in practice.

**The row is never wholly clickable when it carries more than one destination.** A whole-row target
has to pick one, and picking the primary one silently costs the reader the other path. Each
destination is its own target at `≥44×44px`, on the element itself and never on a wrapper.

**Hover.** One signal. The link's underline recolours to `var(--token-accent-hover)`. The row
does not change ground, does not lift, does not scale.

**Containment is the exception, not the rule.** A row group may be drawn inside a
`1px solid var(--token-border)` box **only** when the group carries a name and a framing line that
a reader needs in order to interpret its members, the Tracker Family group is the estate's one
example. The last member inside a container drops its bottom separator so it does not double with
the container edge. **Card-in-card cannot occur** because a row is never a card and a container
never nests.

**Check.** Render the list in greyscale. Every row must read as separate from its neighbour with
no colour information at all. Then narrow to 360px: no horizontal scroll, nothing truncates, no
row becomes a card.

---

### 3. Separator

Three widths exist in this system and no fourth is minted.

| Treatment | Value | Means |
|---|---|---|
| **Hairline** | `1px solid var(--token-border)` | Divides. Carries no meaning |
| **Boundary** | `1px solid var(--token-border-interactive)` | Marks something a person can act on or read state from |
| **Emphasis** | `var(--stroke-emphasis) solid var(--token-accent)` | Current route, active link underline. **Nothing else** |
| **Dashed** | `1px dashed var(--token-border-interactive)` | One value of the status taxonomy, and nothing else |

**Rules are 1px and opaque.** Never an alpha value: an alpha rule changes its computed value with
whatever sits behind it, which is precisely why it cannot federate across five frameworks whose
grounds differ. Never a 4–6px coloured side-stripe on one edge. Never a gradient. Never a
`box-shadow` standing in for a rule.

A separator runs the **content width** of its container, not the padded width, so successive
separators align down the page.

**Check.** Sample the rendered pixel colour of any rule and compare it to the computed value of
`--token-border`. They match exactly, on every ground the rule appears over.

---

### 4. Focus treatment

**Tokens carry the colour of a focus ring; they cannot carry when it appears.** This section is
the one every Satellite copies by hand, and it is the highest-value hand-fix in the estate
(seam S-2).

```
:focus-visible {
  outline: var(--stroke-focus) solid var(--token-focus);
  outline-offset: var(--focus-offset);
  border-radius: var(--r-hair);
}
```

- **`:focus-visible`, never `:focus`.** A mouse click on a link must not paint a ring.
- **Never transitioned.** A ring that fades in over 200ms leaves no indicator at the moment focus
  lands. A `transition` on `outline`, or on a focus-gain `box-shadow`, is a defect.
- **Never removed.** `outline: none` without an equivalent replacement is a defect. Frameworks and
  CSS resets that clear `outline` in a normalize layer must reinstate it explicitly, check this
  first in any application that ships a reset.
- **Never replaced by a ground change.** A focused element that darkens instead of ringing fails
  for anyone who cannot perceive the ground shift.
- Verified visible against all three grounds: **11.70 / 11.19 / 10.45:1**. Over the scrim, worst
  case, it computes to **9.02:1**, comfortably above 1.4.11's 3:1 non-text floor rather than
  marginally above it.

**Focus is never trapped.** There are no modals in this vocabulary. An application that has its own
modals keeps its own trap behaviour, that is seam S-5, accepted permanently, and this
specification does not invent a cross-framework overlay convention.

**Check.** Tab through every reachable surface with the mouse untouched. Every stop shows a ring.
Then click the same elements: no ring appears. Then screenshot the moment focus lands, the ring is
already at full strength.

---

### 5. Status affordance

The estate's own taxonomy is four values, and it is specified in
[`DESIGN.md`](DESIGN.md) § Colors. **What generalises to a Satellite is the discipline, not the
four words.**

**The discipline.** An application with its own state vocabulary (a match state, a loan state, a
wheel state, a build state) expresses it under these rules:

1. **Outlined, never filled.** A filled mark spends accent as a colour block, and accent is a
   highlighter at `≤3%` of the viewport.
2. **Every value differs from its neighbour by a structural property**, never by hue alone. The
   available structural axes are: a **4px square dot at `var(--r-none)`** present or absent; a
   border solid or dashed; a border present or absent. Three axes carry four values with no two
   alike in greyscale. **The dot is square, not round**: the plate has corners and so does the dot.
   Beyond four values the axes run out, and a fifth value is a signal that the vocabulary is being
   asked to carry a taxonomy it was not designed for: split it, or accept that it is dense data UI
   and therefore seam S-6.
3. **At most one value earns accent**, and it is the one that means *actionable right now*. The
   accent is confirmation; the structure is the signal.
4. **Never expressed with `opacity`.** Opacity multiplies against the ground and takes contrast
   with it. A mark faded to 70% computes to 2.25:1 on its border, this is not hypothetical; it is
   how the `Archived` mark was drafted before it was caught.
5. **Not interactive.** No tooltip, no popover, no hover state. A person who wants to know what a
   value means reads the word.

| Property | Value |
|---|---|
| Type | `var(--f-mono)`, `var(--t-3xs)`, uppercase, `letter-spacing: var(--tr-label)` |
| Border | `1px`, square, per the value's structural treatment |
| Padding | `var(--s-2xs)` block, `var(--s-xs)` inline |
| Dot, where present | 4px square at `var(--r-pill)` in `var(--token-accent)` |

**Status strings are verbatim.** Where an application renders the estate's taxonomy, the four
strings are `Live`, `Complete`, `In progress`, `Archived`, with no synonyms anywhere. An
application's *own* domain states are its own words; they are not translated into these four.

**Check.** Render every state value side by side, desaturate to greyscale, and hand the image to
someone with no legend. They can tell all values apart. This is SM-12's per-application evidence
and Story 8.4 records it.

---

### 6. Heading

| Level | Face | Size | Weight | Tracking | Case |
|---|---|---|---|---|---|
| Display | `var(--f-display)` `wdth 100` | `var(--t-display)` | `var(--w-black)` | `var(--tr-display)` | Upper |
| Section | `var(--f-display)` `wdth 85` | `var(--t-md)` | `var(--w-bold)` | `var(--tr-heading)` | Upper |
| Row name | `var(--f-display)` `wdth 85` | `var(--t-base)` | `var(--w-bold)` | `var(--tr-name)` | Upper |

- **One display line per page.** A second display line is a second page.
- **One `<h1>` per document**; heading levels never skip. The visual level and the semantic level
  are chosen independently and both are stated, a section heading that is semantically an `<h3>`
  still sets at `var(--t-md)`.
- Line-height `var(--lh-display)` for display, `var(--lh-heading)` for the rest. All-caps never
  goes below `0.95`.
- **Uppercase is structural, not emphatic.** Prose is never uppercase.
- **Forbidden:** gradient text, `background-clip: text`, synthesised bold, synthesised italic,
  italic headings, a heading below `var(--t-md)`.

**Check.** Run the document outline. One `<h1>`, no skipped levels, and every heading's rendered
face is the display family, not the framework's default sans.

---

### 7. Label

**This entry folds `HudLabel` and UX-DR21's Plate mark into one component.** They were the same
atom under two names: mono, uppercase, tracked, sitting on a hairline, carrying section identity.
Two near-identical label atoms in a fifteen-component system is a smell, and specifying both to
five frameworks would have doubled the cost of the thing this file exists to prevent.

| Property | Value |
|---|---|
| Face | `var(--f-mono)` |
| Size | `var(--t-3xs)`, **labels only, never prose** |
| Case | Uppercase |
| Tracking | `var(--tr-label)` |
| Colour | `var(--token-text-secondary)` |
| Rule | A `1px solid var(--token-border)` hairline, on the side named by the variant |
| Numerals | `font-variant-numeric: tabular-nums`, always |

**Three variants, and no fourth.**

| Variant | Rule position | Use |
|---|---|---|
| **Section** | Beneath the label, running the content width | Section identity above a section head. Ordinal or domain, never by default |
| **Annotated** | Beneath | Carries a subordinate second line (below) |
| **Side-ruled** | On the leading edge, with `padding-inline-start: var(--s-sm)` | A label hanging beside content rather than above it. Mirrors to the trailing edge when the label is end-aligned |

**The subordinate line.** `var(--f-mono)`, `var(--t-3xs)`, `var(--token-accent-muted)`,
`letter-spacing: var(--tr-meta)`. It is **ornament only** `--token-accent-muted` computes to
2.74:1 and is barred from carrying text that means anything. It is therefore `aria-hidden`, always,
in every implementation. **A subordinate line that carries information is a defect** not a styling
choice: move that information into the label itself.

**Forbidden.** A label below `var(--t-3xs)`. A label in prose. A label on every section. An
eyebrow above every heading is a named anti-pattern, and labels appear only where a genuine
ordinal or domain exists.

**Check.** Turn off CSS. Every label still reads as a short uppercase string and every subordinate
line is absent from the accessibility tree.

---

### 8. Empty edge

What a surface does when it has nothing to show. Named as vocabulary because it is where five
independent implementations diverge most reliably, each inventing its own illustration.

| Situation | Treatment |
|---|---|
| **A section with no content** | **Omit it.** Do not render it empty. An empty section reads as unfinished; an absent one reads as scoped |
| **A list that cannot be empty by construction** | **No empty state is designed.** If it renders empty that is a defect, and a defect must not be dressed as a state |
| **A list that genuinely can be empty** | One line of `var(--token-text-secondary)` at `var(--t-sm)`, occupying the same grid position a row would. **No illustration, no icon, no button, no heading** |
| **An error surface** | A heading, one line of `var(--token-text-secondary)`, and exactly the exits the application's header already carries. Never more exits than the header, never fewer |
| **A value that is absent** | The slot does not render. **Never a placeholder, never a dash, never "N/A"** |

**Never invent a metric to fill a slot.** If a number was not supplied it does not exist, and the
slot does not exist either.

**Check.** Force each list to zero items. Nothing renders an illustration, and nothing renders a
box around emptiness.

---

### 9. Field

*Added after the independent-implementation audit found the vocabulary had no form input, while
floor check F-5 explicitly tests one and all three wave-1 applications are input-driven.*

| Property | Value |
|---|---|
| Ground | `var(--token-bg)`. **Never** a lighter fill to suggest an input |
| Border | `1px solid var(--token-border-interactive)` on all four sides |
| Corners | `var(--r-none)`. **This is the estate's single most common framework override** |
| Text | `var(--f-body)`, `var(--t-sm)`, `var(--token-text)` |
| Placeholder | `var(--token-text-secondary)`. **Never** the only label |
| Geometry | `min-height: var(--tap)`, `padding: var(--s-xs) var(--s-sm)` |
| Label | A **Label** (§ 7), above the field, always present and always associated, `for`/`id` or a wrapping `<label>` |

**States.**

| State | Treatment |
|---|---|
| Rest / hover | Identical. A field is not a control; hovering it signals nothing |
| Focus-visible | The standard ring (§ 4). The border does **not** also change: one signal |
| Invalid | **Seam S-4, accepted permanently.** Each application keeps its framework's validation behaviour. What this spec binds is only that the message is **text**, in `var(--token-text)`, adjacent to the field and associated by `aria-describedby`, never colour alone, never an icon alone |
| Disabled | Border `var(--token-border)`, text `var(--token-text-secondary)`, `aria-disabled`. **Never `opacity`** |

**Forbidden.** A rounded field. A filled field. A field with no visible label. A placeholder used as
the label. `outline: none` on focus. An error expressed only in red, there is no red in this
palette and inventing one is a contract break.

**Check.** Tab into every field: the ring appears. Turn the stylesheet off: every field still has a
label above it.

### 10. Media

*Added after the audit found the row-never-a-card rule made a book-cover grid unbuildable with no
alternative offered. `digital-library` renders covers; this is not hypothetical.*

**A row is the unit for a list of *records*. It is not the unit for a grid of *images*.** Where the
image genuinely is the content, a cover, a thumbnail, a screenshot, a grid is correct and this is
the one place the estate's list discipline does not apply.

| Property | Value |
|---|---|
| Container | A CSS grid, `repeat(auto-fill, minmax(<intrinsic>, 1fr))`, `gap: var(--s-md)` |
| The tile | **Still not a card.** No ground, no radius, no shadow, no border box around the whole tile |
| The image | `1px solid var(--token-border)` on the image itself, `var(--r-none)`, `max-width: 100%`, intrinsic `width`/`height` set so it reserves its space and nothing shifts on load |
| Caption | Beneath, outside the image's border: name at `var(--t-sm)` in `var(--token-text)`, metadata as a Label (§ 7) |
| Separation | **The gap, not a rule.** A grid of images needs no hairlines |
| Missing image | The bordered box renders empty at the correct aspect ratio, with the name beneath. **No placeholder graphic, no icon, no "no image" text** |

**Decorative images are `aria-hidden` with empty `alt`.** Content images carry `alt` that says what
the image *is*, not that it is an image.

**Forbidden.** A shadow. A radius. A hover lift, scale or zoom. A gradient scrim baked into the
image, if the image needs a legibility layer beneath text, that is `--token-scrim` and it is
governed by § The scrim.

**Check.** Load the grid on a throttled connection: nothing shifts position as images arrive.

### What is deliberately not in the vocabulary, and what to do instead

The audit asked what a real application needs that these entries do not cover. Answered here rather
than left as a gap, because an unanswered gap is where five implementations diverge:

| Need | Disposition |
|---|---|
| **Pagination** | Build from **Controls** (§ 1) and a **Label** (§ 7) for the position readout. No dedicated component. `tabular-nums` on the numbers |
| **Tabs** | Build from **Controls** in a row, the current one carrying the `var(--stroke-emphasis)` accent underline and `aria-current`, sitting on a shared hairline. It is Nav's treatment applied in place |
| **Loading** | **No skeletons and no spinners.** The Hub is statically rendered. An application that genuinely loads shows the **Empty edge** treatment (§ 8) with the word `Loading`, and never a shape pretending to be content |
| **Toast, dialog, popover, tooltip** | **Seam S-5, accepted permanently.** Each application keeps its own. This spec does not invent a cross-framework overlay convention |
| **Tables and dense data UI** | **Seam S-6, accepted permanently.** What binds is only the separator (§ 3), the label (§ 7) and `tabular-nums` |
| **Icons** | There is no icon set. The three glyphs in the system are an arrow, an external-navigation mark and the 4px status square. **Never an emoji** |

---

## The scrim

A ninth thing, and it is a **value** rather than an element, so it is specified here rather than in
the vocabulary. It is the disposition of O-12 item 2.

```css
--token-scrim: oklch(12% 0.011 288 / 0.88);   /* --c-paper at 88% */
```

**What it is for.** A legibility layer between **moving imagery and text**, and nothing else. The
retired scanline stack was incidentally doing this job on the homepage and the 404 page; the job
survives the effect. Seam S-1 means the Three.js scene's colours are JS values a custom property
cannot reach, so the imagery beneath a scrim is **unknown by construction**.

**Why this is the one legitimate alpha in the system, and it is an exception that needs stating.**
§ Rules says *alpha is not a colour*, and it is right: an alpha hairline changes value with whatever
sits behind it, which is why it cannot federate. **The scrim is the exact inverse case.** Its ground
is unknown by design, so a flat opaque value cannot do its job and translucency is the entire
mechanism. The rule's rationale does not reach it. This is a **named, bounded exception** and it is
the only one:

- It applies to `--token-scrim` and to no other property.
- Story 2.34's FR-17 conformance grep must permit this one declaration inside `contracts/` and
  must still reject alpha anywhere else, including any hand-written `rgba()` that reproduces it.

**The guarantee, and it is a worst case rather than an average.** Composited over a **pure white**
backdrop, the worst that can exist, since a darker backdrop only raises every ratio, the scrim's
effective ground computes to a relative luminance of **`0.01718`**.

> **CSS composites alpha in gamma-encoded sRGB, not in linear light.** The arithmetic is
> `255(1 − α) + c·α` on the **encoded** bytes, and only the result is linearised.
> `#060509` at `α = 0.88` over white composites to `rgb(35.88, 35.00, 38.52)` → `L = 0.01718`.
> Blending the two **luminances** instead gives `0.1215`, wrong by a factor of seven. Check any
> claim about a translucent layer this way, in every framework.

| Over the scrim, worst case | Contrast | Floor | Verdict |
|---|---|---|---|
| `--token-text` | **13.51:1** | 4.5:1 text | **Permitted** |
| `--token-focus` | **9.02:1** | 3:1 non-text | **Permitted** |
| `--token-accent-hover` | **6.94:1** | 4.5:1 text | **Permitted** |
| `--token-text-secondary` | **5.41:1** | 4.5:1 text | **Permitted** |
| `--token-accent` | **4.77:1** | 4.5:1 text | **Permitted, and it is the binding role** |

`0.88` is the smallest two-decimal alpha at which every role clears its own floor over any backdrop.
`--token-accent` sets the threshold at about `0.864`.

**The rules that follow, and they are binding.**

1. **Every role is permitted over a scrim.** Rest, hover and focus land at 4.77 / 6.94 / 9.02:1,
   three legible steps, all clearing their floors, so an interactive element may sit on one.
2. **The guarantee is a property of the stack, not of the token.** An element only has it if the
   scrim is genuinely beneath it. Anything painted above the imagery at a z-level **higher than the
   scrim's** is over the *imagery*, not the *scrim*, and computes against the imagery. A sticky
   header at `--z-sticky` above a scrim at `--z-raised` is the case that catches people.
3. **The scrim is never a surface treatment.** Not a card ground, not a section ground, not a
   vignette, not a hover state. Depth is lightness, then a hairline, then a rule, and the scrim is
   not a fourth rung on that ladder.
4. **The scrim is flat and has one value.** Full coverage of the element it belongs to. Never
   feathered, never a gradient, never `#000` at any alpha, and **never a variable intensity**: a
   scrim that varies is a scrim whose guarantee varies.
5. **Prefer not overlapping text and imagery at all.** The scrim exists for where the overlap is
   genuinely unavoidable. A layout that separates the two needs no scrim and is the better answer.

**The alpha lives on `--c-scrim`, not on `--token-scrim`.** The role is a plain `var()` reference
like every other. Story 2.34's FR-17 gate permits the alpha on that **one palette declaration inside
`contracts/`** and rejects it everywhere else, including any hand-written `rgba()` that reproduces
the same value.

**Check.** Screenshot the composited surface, sample the rendered ground colour beneath the text,
and compute the ratio by hand. Then confirm the text's z-level is genuinely above the scrim's.

---

## The floor

**What makes an application count as restyled.** Story 8.4 records SM-12 against exactly this list,
per application, and an application passes only when all **twelve** hold.

**Scope of the floor: every surface a Visitor can reach without authenticating.** That is the
landing surface, every list and detail view a Visitor can navigate to, the navigation, the footer,
and the error and empty states of those surfaces. Authenticated interiors, admin surfaces and dense
data views are **below the floor** and stay on their framework's defaults, which is seam S-6
accepted permanently. The boundary is deliberately checkable **from outside the application, with
no login**, because a floor that needs credentials to verify will not be verified.

**Twelve checks, and every one has a stated method.** A check whose method is "look at it" is not a
check, and three of these were rewritten after an audit found exactly that.

| # | Check | How it is verified |
|---|---|---|
| **F-1** | Ground is `var(--token-bg)`. No `#000` and no `#fff` anywhere outside a print stylesheet | Sample the rendered pixel |
| **F-2** | The three families **actually render**: display, body, mono. No silent fallback | **`document.fonts.check()` per family, or the Network panel.** `getComputedStyle().fontFamily` returns the declared *stack* and passes identically when every woff2 has 404'd, which is the exact failure the three-file contract split exists to prevent, so it must not be the check |
| **F-3** | Every divider is a 1px opaque hairline at a token value. No alpha rules, no side-stripes | Sample any rule |
| **F-4** | **No filled control on any reachable surface** | Screenshot every surface; no control has a ground |
| **F-5** | Square corners on every control, container and form field | Computed `border-radius` is `0` |
| **F-6** | The focus treatment (§ 4) on every interactive element, instant and never removed | Keyboard-only traversal |
| **F-7** | No `box-shadow` and no `gradient` anywhere | Grep the built CSS |
| **F-8** | **No accent background fill anywhere**, and accent is not the dominant colour of any viewport | **The fill half is the real check and it is binary: grep the built CSS for `--token-accent` used as a `background`, `background-color` or `fill`, at any state including `:hover`. Zero occurrences.** The 3% figure is a design intent, not a gate: it has no defined denominator and eyeballing it is not a check |
| **F-9** | The state vocabulary is carried structurally and survives greyscale with no legend | Greyscale render, **with the legend and the status words masked**. If the values are still tellable apart, it passes. Masking the words is what makes this a test rather than a reading exercise |
| **F-10** | Interactive targets `≥44×44px` on **both axes**, **measured in a browser, not read off the CSS** | DevTools box model. Also confirm two adjacent targets' boxes do not overlap |
| **F-11** | `color-scheme: dark` on `:root`, and `::selection` sets **both** `background` and `color`, accent ground with `--token-bg` text | Computed style; select some text. Accent as a selection ground is the one permitted accent fill and F-8's grep excludes `::selection` explicitly |
| **F-12** | **The vocabulary's geometry is present, not just its colours.** Rows use the § 2 grid at both widths; controls and links meet § 1 and § 1b geometry; the one breakpoint is 760px | Compare the rendered row against § 2's template at 359px, 390px, 759px and 761px. **Without this check, two applications can pass F-1 to F-11 and share none of the layout this specification exists to federate** |

**F-4, F-6 and F-10 are the three that fail most often**, and each fails while appearing to pass:
a component library's button looks unfilled until you check its `:hover`; a reset clears the
outline in a layer nobody reads; and vertical padding on a plain inline element paints outward
without growing the hit area, so a link measures ~29px tall no matter what the padding says.

**AD-19 binds every restyled application**, not `cs-tracker` alone. The manual accessibility pass
is run and recorded per application. A restyle can lower contrast, break a focus ring or shrink a
hit target in ways no CI job on the Anchor can see.

---

## The ceiling

**Where a restyle stops and per-app feature work begins.** PRD §8's carve-out is bounded by exactly
this line: presentation only, never behaviour, routes, data or feature set.

**Markup may change where layout requires it.** A restyle may rewrite templates and class structure,
because the row-not-card rule is a layout rule and it cannot be honoured by CSS alone in an
application whose template emits cards. What must come out unchanged is the **same information, the
same destinations, the same interactions**.

| Permitted | Out of scope |
|---|---|
| Card markup rewritten as row markup | A field appearing that was not rendered before |
| Class structure rewritten | A field disappearing |
| A wrapper added to reach a 44px target | A destination gained or lost |
| An element split so a border can move | The order a reader encounters information in |
| A framework component class replaced with plain markup | A new interaction, a new control, a new route |
| A stylesheet deleted | Any change to data, schema, query or API |
| `color-scheme`, `::selection`, focus and radius hand-fixes | **Microcopy.** Copy stays exactly as it is |

**The reordering ban means DOM order, and this needs saying because the two rules collide
otherwise.** Converting a card to a row almost always changes *visual* order at some width: a
status that sat under a title in a card hangs to its right in a row. That is permitted. What is
forbidden is changing **the order a screen reader and a keyboard encounter the content in** which
is DOM order. § 2's grid template is built on `grid-template-areas` for exactly this reason: it
moves things visually without touching the source. **If a layout cannot be reached without changing
DOM order, change the layout, not the order.**

**Microcopy is out, and it is the tempting one.** Bringing an application's strings onto the Voice
and Tone contract would fix real inconsistency, and it is exactly the change that would put a
restyle story in a position to alter what an application says it does. It stays out.

**Seams S-4, S-5 and S-6 are below the ceiling, not above it.** Form validation states, overlays
and dense data UI are accepted permanently. **The restyle raises the ceiling; it does not dissolve
it.** Do not invent a cross-framework overlay convention, a shared validation vocabulary or a table
system. An application's modal keeps its own focus trap.

**Seam S-1 stands.** The Three.js narrative's colours are JS values a custom property cannot reach.
It is a declared FR-17 exception and is out of scope here.

**One consequence worth knowing before Epic 8 opens.** Because markup may change, a restyle diff is
**not** reviewable as a CSS-only diff. Review has to read templates. That is the price of making
Story 8.1 achievable at all, and it is named rather than discovered.

---

## Displacing a component library

**The daisyUI test, answered per framework family.** The question is never "can the library be
recoloured", it always can, but "what does it take for the library to stop imposing its own
component form".

Every application below is **verified first**: what is actually installed is checked before the
strategy is chosen, because a strategy chosen against an assumed stack is worse than none.

### Family A, utility-first with a component plugin

*`cs-tracker` (Tailwind v4 + daisyUI). Applies to any `apps/*` that later adds one.*

**Strategy: neutralise the component layer, keep the utilities.** Decided, and it is what bounds
Story 8.1.

1. **Map the plugin's theme variables onto the token roles** (seam S-9). Verify first whether
   `@plugin "daisyui/theme" { … }` accepts a `var()` reference, undocumented either way, and the
   documented fallback is plain CSS on a `[data-theme]` selector. This is O-3 and Story 1.19
   front-loads it.
2. **Stop using the plugin's component classes on restyled surfaces.** `btn`, `card`, `badge`,
   `alert`, `menu`, `navbar` and their modifiers are replaced by plain markup carrying token-driven
   styles from § 1 to § 8. The utility classes stay; only the component classes go.
3. **The plugin stays installed and every unrestyled surface keeps working.** Nothing outside the
   floor is touched.

**This is what makes the story bounded rather than open-ended:** the scope is a grep for the
plugin's component class names across the surfaces inside the floor, and that grep returns a
countable list before a line is written. Story 8.1 records the count before and after; after is
zero on those surfaces.

**What the grep does not catch, stated so the estimate is not built on a number that is too
small.** The grep is the *starting* count, not the whole scope:

- **daisyUI has roughly sixty component classes, not the six named above.** Grep the plugin's own
  class list, not a remembered subset.
- **`core_components.ex` is invisible to a template grep** and is itself a component layer. Read
  it; it is one file.
- **Interpolated and conditionally-assembled class names** (`"btn btn-#{variant}"`) do not match a
  literal grep. Search for the prefix, not the full name.
- **A `navbar` and a `btn` are not one unit each.** The count is call sites; the *work* is
  proportional to distinct components, and a navbar is a day where a button is an hour.
- **The surface list depends on O-14**, which is open: which surfaces are Visitor-reachable without
  a login is not yet determined for any wave-1 application, and it sets the denominator.

**Phoenix has a second component layer, and it is easy to miss.** The v1.8 generator commits a
`core_components.ex` module into the application. That module *is* the component library for
everything the generators emit, and restyling means editing it. An application that maps daisyUI
correctly and never opens `core_components.ex` will still render framework defaults.

### Family B, an opinionated component framework

*Any application on Angular Material, PrimeNG, Vuetify or similar. Verify before assuming
`list-wheel` has one.*

These frameworks style components from inside their own encapsulation, and a global stylesheet
does not reach in. Two routes, in this order:

1. **Preferred: do not use the framework's components on surfaces inside the floor.** A control, a
   row and a label from this specification are a handful of elements each, and hand-writing them is
   cheaper than fighting a theming API, and it is the only route that produces the same result in
   five frameworks.
2. **Fallback, where a component is genuinely load-bearing:** drive it through the framework's own
   theming API, mapping to token roles, and then **verify every one of F-1 to F-12 against the
   rendered component** rather than against the theme configuration. A theming API that has no
   input for "unfilled" or "square" is telling you route 1 was correct.

`ViewEncapsulation.Emulated` is not an obstacle: it stops component styles leaking *out*, not
global styles reaching *in*. The obstacle is specificity and the framework's own defaults, not
encapsulation.

### Family C, no component library

*`digital-library` (SvelteKit), the Anchor (Next.js + SCSS), and any plain-Tailwind consumer.*

Nothing to displace. The risk moves to two quieter places, both of which are still F-checks:

- **The browser's own defaults.** Form controls, `<button>`, `<select>` and scrollbars render
  natively unless told otherwise. `color-scheme: dark`, `border-radius: 0` and the focus rule are
  what cover this, which is why they are in the nine-line hand-fix list.
- **A CSS reset in a layer nobody reads.** Resets commonly clear `outline`. Check for it explicitly;
  F-6 fails silently otherwise.

### What none of them may do

**No application imports a component, a class-name library, a stylesheet other than its vendored
`cuatro-contracts/` folder, or any `packages/*` artifact from the Anchor.** AD-1's CI purity check
holds the boundary and is unchanged. **The same component recurring across three or more
applications is evidence that this specification should be better, never that a package should
exist** (AD-24). If a plan implies shared component code crossing the Turborepo boundary, the plan
is mis-scoped, not the rule.

---

## Recording a restyle

Story 8.4 is the Story 1.20 equivalent for restyle. Per application it records:

| Field | Value |
|---|---|
| Application id | The Registry `id` |
| Framework family | A, B or C above |
| Surfaces inside the floor | Enumerated by route |
| F-1 … F-12 | Pass or fail, each with how it was checked |
| Component-class call sites | Before and after, where family A applies |
| AD-19 manual pass | Date, and what was found |
| Greyscale render | Attached |
| Contract version consumed | From the Satellite's `token_contract` Registry field |

**SM-C6 reads zero throughout.** No application is restyled before the Suite Directory renders it
(AD-25). A restyle work item for an unrendered application is a defect, not enthusiasm.

---

## What this specification deliberately does not contain

Named so that a later reader does not mistake an omission for a gap:

- **A component library, in any form.** Not a package, not a class-name convention, not a copy-paste
  snippet directory. AD-24, and it is the whole point.
- **A light theme.** The contract is dark-only and seam S-7 is accepted deliberately.
- **An overlay, dialog, validation or table convention.** Seams S-4, S-5 and S-6, accepted
  permanently.
- **An icon set.** The system's only glyphs are an arrow, an external-navigation mark and a 4px
  square. An emoji is never an icon.
- **Anything for the four unbuilt applications.** `StreamVault`, `MaiCoin`, `poketracker-go`,
  `Mutuo` and `cuatro-finance` are unrendered and therefore unrestyled (AD-25).
- **A raised bar for FR-18.** FR-18 stays satisfied by Token Adoption alone. If it came to mean
  "restyled", Epic 1 would block on Epic 8 and the foundation epic would stop delivering visible
  value on its own. Spine C-13, and it is load-bearing.
