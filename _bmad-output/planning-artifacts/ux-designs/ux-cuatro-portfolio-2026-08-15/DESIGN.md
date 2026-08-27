---
name: Cuatro Ecosystem, Industrial Plate
status: final
updated: 2026-08-16
amended-2026-08-16: >-
  Corrections raised by the epics restyle pass. Withdrew the retracted scrim restriction from
  the two redesigned-Hub entries that still carried it (H-10 residue). Minted --tap: 44px into
  the contract (LOW-2). Added the addition and removal categories to Versioning (MED-2). Stated
  that typeset punctuation governs rendered UI copy while the house rule governs repository prose.
theme: dark-only
anchor-hue: 288
colors:
  paper: '#060509'
  surface: '#0d0c13'
  surface-high: '#16151c'
  line: '#282830'
  line-strong: '#656471'
  muted: '#98979f'
  ink: '#eeeef2'
  accent: '#8f7ef0'
  accent-bright: '#ada1ff'
  accent-quiet: '#564c91'
  focus: '#c6bdff'
  scrim: '#060509e0'
typography:
  display:
    fontFamily: Bricolage Grotesque
    fontSize: clamp(2.25rem, 9vw, 4.5rem)
    fontWeight: '800'
    lineHeight: '0.95'
    letterSpacing: -0.05em
    textTransform: uppercase
    fontVariationSettings: '"wdth" 100, "opsz" 48'
  display-s:
    fontFamily: Bricolage Grotesque
    fontSize: 1.9531rem
    fontWeight: '800'
    lineHeight: '1.0'
    letterSpacing: -0.04em
    textTransform: uppercase
    fontVariationSettings: '"wdth" 85, "opsz" 24'
  heading:
    fontFamily: Bricolage Grotesque
    fontSize: 1.25rem
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.03em
    textTransform: uppercase
    fontVariationSettings: '"wdth" 85'
  entry-name:
    fontFamily: Bricolage Grotesque
    fontSize: 1rem
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.015em
    textTransform: uppercase
    fontVariationSettings: '"wdth" 85'
  lede:
    fontFamily: Geist
    fontSize: 1rem
    fontWeight: '300'
    lineHeight: '1.55'
    letterSpacing: '0'
  body:
    fontFamily: Geist
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  meta:
    fontFamily: Geist Mono
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: 0.09em
    textTransform: uppercase
  label:
    fontFamily: Geist Mono
    fontSize: 0.6875rem
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: 0.14em
    textTransform: uppercase
type-scale:
  3xs: 0.6875rem
  2xs: 0.75rem
  xs: 0.8125rem
  sm: 0.875rem
  base: 1rem
  md: 1.25rem
  lg: 1.5625rem
  xl: 1.9531rem
  2xl: 2.4414rem
  display: clamp(2.25rem, 9vw, 4.5rem)
font-family:
  display: '"Bricolage Grotesque", Archivo, system-ui, sans-serif'
  body: '"Geist", ui-sans-serif, system-ui, sans-serif'
  mono: '"Geist Mono", ui-monospace, SFMono-Regular, monospace'
font-weight:
  light: '300'
  regular: '400'
  medium: '500'
  bold: '700'
  black: '800'
line-height:
  display: '0.95'
  heading: '1.1'
  lede: '1.55'
  body: '1.6'
  label: '1.4'
tracking:
  display: -0.05em
  heading: -0.03em
  name: -0.015em
  body: 0em
  meta: 0.09em
  label: 0.14em
rounded:
  none: '0'
  DEFAULT: '0'
  hair: 2px
  pill: 999px
spacing:
  unit: 4px
  2xs: 0.25rem
  xs: 0.5rem
  sm: 0.75rem
  md: 1rem
  lg: 1.5rem
  xl: 2.5rem
  2xl: 4rem
  3xl: 6rem
  page-pad: clamp(1.25rem, 5vw, 4rem)
  measure: 46ch
stroke:
  hair: 1px
  boundary: 1px
  emphasis: 2px
  focus: 2px
  focus-offset: 3px
elevation:
  0: '#060509'
  1: '#0d0c13'
  2: '#16151c'
motion:
  dur-micro: 120ms
  dur-minor: 220ms
  dur-major: 420ms
  dur-exit: 165ms
  ease-entrance: cubic-bezier(0.16, 1, 0.3, 1)
  ease-exit: cubic-bezier(0.7, 0, 0.84, 0)
  ease-toggle: cubic-bezier(0.65, 0, 0.35, 1)
z:
  base: '1'
  raised: '10'
  dropdown: '100'
  sticky: '200'
  modal: '400'
  toast: '500'
  tooltip: '600'
components:
  status-mark: outlined, never filled
  registry-entry: grid row with hairline rule, never a card
  tracker-family-group: bordered container, the only containment layer in the directory
  button: 1px border, square corners, no fill
  nav: wordmark plus two mono links, current route underlined in accent
  framework-band: compressed display caps between hairlines, decorative only
  plate-mark: mono label on a hairline, three variants, absorbs the retired HudLabel
  suite-switcher-panel: raised ground, hairline rows, external glyph per row
  focus-ring: 2px solid focus, 3px offset, no transition
  scrim: flat 88% paper between moving imagery and text, ink only, never interactive
restyle-spec: ./RESTYLE-SPEC.md
sources:
  - ../../prds/prd-cuatro-portfolio-2026-08-15/prd.md
  - ../../prds/prd-cuatro-portfolio-2026-08-15/addendum.md
  - ../../research/technical-cuatro-ecosystem-architecture-2026-08-15/research.md
  - ../../ecosystem-ux-prompt.md
---

# DESIGN.md, Cuatro Ecosystem

Visual identity for the Cuatro Ecosystem: the Hub at `cuatro.dev` and every Satellite that
adopts the Token Contract. Behaviour, information architecture, states and accessibility
behaviour live in [`EXPERIENCE.md`](EXPERIENCE.md). The framework-agnostic component vocabulary
every restyled application implements is in [`RESTYLE-SPEC.md`](RESTYLE-SPEC.md).

**This file wins on conflict** with any mock, wireframe or import, including the artifacts
linked from it, and with `RESTYLE-SPEC.md` on any value.

Reference renders. **This file wins on conflict with all of them:**

| File | Illustrates |
|---|---|
| [`mockups/key-screens.html`](mockups/key-screens.html) | The token block rendered. Homepage, Suite Directory, Registry Entry states, Suite Switcher |
| [`mockups/secondary-screens.html`](mockups/secondary-screens.html) | `/cv`, `/work`, `/recommendation`, `/celeste`: **rendered from the identical token block, introducing no new tokens** |
| [`mockups/redesigned-components.html`](mockups/redesigned-components.html) | **The redesigned Hub components**: the target for Stories 2.27–2.34 and the reference for Epic 8 |
| [`mockups/directions-4.html`](mockups/directions-4.html) | The four directions considered; **C, Industrial Plate, was chosen** |

---

## Brand & Style

The identity is **Industrial Plate**: engineering signage rendered in near-black with a
single violet anchor. Wide uppercase display type set over hairline rules, square corners,
outlined status marks, and a framework band that states the polyglot thesis as ornament
rather than as a claim.

It exists to solve one problem. Six frontend frameworks and five backend languages must
**visibly belong to each other** while sharing no component code. The design answers that
with an identity built almost entirely from things a CSS custom property can carry (a
colour, a rule width, a tracking value, a type scale) and almost nothing from things it
cannot. A hairline rule federates. A drop shadow federates badly. A focus trap does not
federate at all. The visual language is deliberately weighted toward the first kind.

The register is **evidence, not adjectives**. The audience is a hiring audience, and the
strongest thing this design can do is get out of the way of six applications that are
actually running. Nothing decorates. The framework band is the only ornament in the system
and it is made of real facts.

It replaces, and is a deliberate departure from, the current site's `#000` / `#fff`
palette and its General Sans / Monument Extended / Confillia type stack. Bricolage
Grotesque's width axis inherits Monument Extended's job under an open licence that can be
vendored into seven repositories without a legal question. The change is a **reshape of a
shipping site at v2.5.3**, not a rebuild: the structural memory (black ground, wide caps,
hairlines, generous page padding) is carried forward intact.

**Voice.** Declarative, specific, unhurried. Numbers where numbers are true, never where
they are not. No superlatives, no first person in product surfaces, no marketing adjectives
anywhere. Microcopy rules are in [`EXPERIENCE.md`](EXPERIENCE.md) § Voice and Tone.

---

## Colors

**Dark only.** One theme is designed, contrast-tested and shipped. There is no
`[data-theme="light"]` block and no reserved slot for one. This is a decision, and its
cost is recorded in [`EXPERIENCE.md`](EXPERIENCE.md) § Seams Inventory, seam S-7.

Every value is authored in **OKLCH** on a single anchor hue of **288°**. OKLCH is
perceptually uniform, so the lightness number *is* the perceived lightness, which is what
makes the elevation ladder below a reliable ladder rather than a guess. The hex column is
the computed sRGB fallback, not a second source of truth.

### The palette

| Token | Authored | sRGB | Contrast on `paper` | Role |
|---|---|---|---|---|
| `--c-paper` | `oklch(12% 0.011 288)` | `#060509` | n/a | Page ground. Near-black, tinted violet. **Never `#000`.** |
| `--c-surface` | `oklch(16% 0.013 288)` | `#0d0c13` | 1.05:1 | Raised one level |
| `--c-surface-high` | `oklch(20% 0.014 288)` | `#16151c` | 1.12:1 | Raised two levels |
| `--c-line` | `oklch(28% 0.015 288)` | `#282830` | 1.39:1 | Decorative hairline, carries no meaning |
| `--c-line-strong` | `oklch(51% 0.020 288)` | `#656471` | **3.52:1** | Meaning-bearing UI boundary |
| `--c-muted` | `oklch(68% 0.012 288)` | `#98979f` | **7.03:1** | Secondary text |
| `--c-ink` | `oklch(95% 0.005 288)` | `#eeeef2` | **17.54:1** | Primary text. **Never `#fff`.** |
| `--c-accent` | `oklch(66% 0.165 288)` | `#8f7ef0` | **6.20:1** | The only accent |
| `--c-accent-bright` | `oklch(76% 0.145 288)` | `#ada1ff` | **9.00:1** | Hover only |
| `--c-accent-quiet` | `oklch(46% 0.110 288)` | `#564c91` | 2.74:1 | Decorative accent at rest. **Never text** |
| `--c-focus` | `oklch(84% 0.130 288)` | `#c6bdff` | **11.70:1** | Focus ring only |
| `--c-scrim` | `oklch(12% 0.011 288 / 0.88)` | `#060509e0` *(`e0` = `0.87843`, nearest 8-bit)* | Holds every role at its floor | **The one translucent value.** Legibility layer over moving imagery. See § The scrim |

**Hover and focus use different tokens on purpose.** `--c-accent-bright` (9.00:1) sits between
accent (6.20:1) and focus (11.70:1), so a hovered element and a focused element are
distinguishable from each other and from rest: three legible steps on one hue. Spending the
focus token on hover would make a keyboard user unable to tell where focus actually is.

### Semantic roles

Roles are what a Satellite consumes. A Satellite maps its own concepts onto these names and
never reaches for a raw palette value.

**The `--token-` prefix is load-bearing, not decoration.** The Tailwind adapter has to map
Tailwind's own `--color-*` namespace onto this one, and the two namespaces **must differ**:
research §D2's example is `--color-brand: var(--token-brand)` for exactly this reason. A
mapping like `--color-bg: var(--color-bg)` is a self-reference: it survives only if
`tokens.css` happens to be imported unlayered so it out-cascades Tailwind's `theme` layer, and
the moment a bundler flattens the imports or someone wraps it in a layer it becomes a cycle,
invalid at computed-value time, and the property falls back to `transparent`. Distinct
namespaces make that failure structurally impossible instead of accidentally avoided.

| Role token | Resolves to | Applied to |
|---|---|---|
| `--token-bg` | `--c-paper` | Document ground |
| `--token-bg-raised` | `--c-surface` | Panels, grouped containers, switcher body |
| `--token-bg-raised-2` | `--c-surface-high` | Hover ground inside a raised panel |
| `--token-text` | `--c-ink` | Primary copy, headings, entry names |
| `--token-text-secondary` | `--c-muted` | Descriptions, metadata, tech arrays |
| `--token-border` | `--c-line` | Dividers and rules that carry no meaning |
| `--token-border-interactive` | `--c-line-strong` | Any boundary a person can act on or read state from |
| `--token-accent` | `--c-accent` | Links, active state, `Live`, the one highlight |
| `--token-accent-hover` | `--c-accent-bright` | Hover, exclusively |
| `--token-accent-muted` | `--c-accent-quiet` | Ornament only: the framework band, annotation rules |
| `--token-focus` | `--c-focus` | Focus rings, exclusively |
| `--token-scrim` | `--c-scrim` | Between **moving imagery** and text, exclusively. Never a surface |

**`--token-status-*` is deliberately absent.** Status is carried by **border treatment**, not
by hue:

| Status | Dot | Border | Text | Contrast |
|---|---|---|---|---|
| `Live` | **4px filled square** | Solid `--token-accent` | `--token-accent` | 6.20:1 |
| `Complete` | none | Solid `--token-border-interactive` | `--token-text-secondary` | 3.52 / 7.03:1 |
| `In progress` | none | **Dashed** `--token-border-interactive` | `--token-text-secondary` | 3.52 / 7.03:1 |
| `Archived` | none | **none** | `--token-text-secondary` | 7.03:1 |

**The dot is the taxonomy's load-bearing element, not an ornament.** Each value differs from
its neighbour by a *structural* property, never by hue alone: `Live` vs `Complete` by the dot,
`Complete` vs `In progress` by the dash, `In progress` vs `Archived` by the border's presence.
Four values, three structural axes, no two alike in greyscale.

This is stated explicitly because the obvious version of this table is wrong. If `Live` and
`Complete` were distinguished only by border *colour* (both `1px solid`, one accent and one
neutral) they would sit **1.13:1 apart in greyscale**, and the taxonomy would be carried
entirely by reading the word. Only `Live` earns accent, because it is the one value that means
*you can click this right now*; but the accent is confirmation, never the signal.

**`Archived` carries no pill on purpose, and opacity is never used to express it.** An earlier
draft faded the pill to 70%, which computes to **2.25:1 on the border and 3.87:1 on the text**,
both below the floors this file enforces elsewhere. Removing the container instead is
compliant, and it is also the better signal: `Archived` is a record, not a state you can act
on, so it should not wear the same affordance-shaped chrome as the three that are.

**Opacity is barred from expressing state anywhere in this system.** It silently multiplies
against whatever sits behind it and takes contrast with it.

### Rules

- **One accent, and it is a highlighter.** `--c-accent` occupies **≤3% of any viewport**. It
  appears on link underlines, the `Live` mark, the active nav rule, and nothing else. It is
  never a background fill, never a large block, never a button ground.
- **Nothing is pure.** No `#000`, no `#fff` anywhere in the system. Every neutral carries a
  trace of the anchor hue, which is what stops a dark UI reading as synthetic.
- **Elevation is lightness, never glow.** Higher surfaces are lighter by a **+4 lightness
  step**. A coloured halo behind a raised element on a dark ground is banned outright.
- **No gradients.** Not in backgrounds, not in text, not on hover. A three-stop gradient, an
  aurora mesh, a `background-clip: text` fill and a purple-to-cyan sweep are each specifically
  out.
- **Alpha is not a colour.** `rgba(255,255,255,0.15)`, which the current site uses for its
  hairlines, is replaced by a named opaque token. An alpha hairline changes value with
  whatever sits behind it, which is precisely why it cannot federate. **`--c-scrim` is the single
  named exception**, and it is an exception because its ground is unknown *by design*, which is the
  exact inverse of the hairline case this rule was written about. The alpha lives on the palette
  value; `--token-scrim` is a plain `var()` reference like every other role. See § The scrim.

### Conformance

All fifteen meaningful pairings were computed, not estimated. Every one passes:

- **Body and headings**, `ink` on all three grounds: 17.54 / 16.78 / 15.66:1. AAA.
- **Secondary text**, `muted` on all three grounds: 7.03 / 6.73 / 6.28:1. Above the 7:1
  target on page ground; comfortably AA elsewhere.
- **Accent text**, `accent` on all three grounds: 6.20 / 5.93 / 5.53:1. AA everywhere.
- **UI boundaries**, `line-strong` on all three grounds: 3.52 / 3.36 / 3.14:1. Clears
  WCAG 1.4.11's 3:1 floor everywhere, including inside a hovered panel.
- **Hover**, `accent-bright` on all three grounds: 9.00 / 8.61 / 8.04:1.
- **Focus ring**, `focus` on all three grounds: 11.70 / 11.19 / 10.45:1.

`--c-line` (1.39:1) and `--c-accent-quiet` (2.74:1) are **decorative only** and are barred
from carrying text or state. Using either as a meaning-bearing boundary is a defect.

**Two things that must never happen to these numbers.** Do not express state with `opacity`:
it multiplies against the ground and takes contrast with it, which is how the `Archived` mark
came to compute at 2.25:1 before it was caught. And do not change a ground without
recomputing every pairing against it; the ladder is only four lightness steps wide, so a
surface that moves takes the whole matrix with it.

### The scrim

*Added 2026-08-15. This is the disposition of **O-12 item 2**, and it is the one role the restyle
adds to the contract.*

```css
--c-scrim:     oklch(12% 0.011 288 / 0.88);   /* --c-paper at 88% */
--token-scrim: var(--c-scrim);
```

**What it is for, and it is narrow.** A legibility layer between **moving imagery and text**, and
nothing else. The retired cybercore scanline stack was incidentally doing this job on the homepage
and the 404 page. The effect goes; the job survives it. Seam S-1 is why the job cannot be solved
any other way: the Three.js scene's colours are JS values a custom property cannot reach, so **the
imagery beneath a scrim is unknown by construction**.

**The guarantee is a worst case, not an average.** Composited over a **pure white** backdrop (the
worst backdrop that can exist, because a darker backdrop only raises every ratio) the scrim's
effective ground computes to a relative luminance of **`0.01718`**.

> **How that number is computed, because it is the one thing here most easily got wrong.**
> CSS composites alpha in **gamma-encoded sRGB**, not in linear light. The channel arithmetic is
> `255(1 − α) + c·α` on the **encoded** bytes, and only the result is linearised to a luminance.
> `#060509` at `α = 0.88` over white therefore composites to `rgb(35.88, 35.00, 38.52)`, which
> linearises to `L = 0.01718`. Blending the two **luminances** instead, `0.88 × 0.00167 + 0.12`,
> gives `0.1215`, which is wrong by a factor of seven and is not what any browser does. An earlier
> draft of this section made exactly that error; the numbers below are the corrected ones.

| Over the scrim, worst case | Contrast | Floor it must clear | Verdict |
|---|---|---|---|
| `--token-text` | **13.51:1** | 4.5:1 as text | **Permitted** |
| `--token-focus` | **9.02:1** | 3:1, non-text (1.4.11) | **Permitted** |
| `--token-accent-hover` | **6.94:1** | 4.5:1 as text | **Permitted** |
| `--token-text-secondary` | **5.41:1** | 4.5:1 as text | **Permitted** |
| `--token-accent` | **4.77:1** | 4.5:1 as text | **Permitted, and it is the binding one** |

**Why `0.88` and not something lighter.** `--token-accent` is the most demanding role over a scrim,
and it clears 4.5:1 only from about `α = 0.864` upward. **`0.88` is the smallest two-decimal value
at which every role in the palette clears its own floor over any backdrop that can exist**, and it
leaves the binding role 0.27 of a ratio point in hand. That is the whole justification for the
number; it is not a taste call.

**The 8-bit fallback is `#060509e0`, and `e0` is `0.87843`, not `0.88`.** The guarantee holds at
both: accent computes to 4.75:1 at the fallback. The authored OKLCH value is the source of truth
and the hex is the fallback, exactly as for every other colour in this file.

**What follows is binding, not advisory.**

1. **The scrim is never a surface treatment.** Not a card ground, not a section ground, not a
   vignette, not a hover state. Depth is lightness, then a hairline, then a rule; the scrim is not
   a fourth rung on that ladder.
2. **The scrim is flat.** One value, full coverage of the element it belongs to. Never feathered,
   never a gradient, never `#000` at any alpha, never a variable intensity. **A scrim that varies
   is a scrim whose guarantee varies**, and the guarantee is the only reason the role exists.
3. **An element only gets the guarantee if the scrim is actually beneath it.** The guarantee is a
   property of the *stack*, not of the token. Anything painted above imagery at a z-level **higher
   than the scrim's own** is not covered by it: a sticky header at `--z-sticky` over a scrim at
   `--z-raised` is over the *imagery*, not over the *scrim*, and computes against the imagery.
   This is a real trap and it is where `HomeLayout` has to be careful.
4. **Every role is permitted over a scrim, so an interactive element may sit on one.** Rest,
   hover and focus land at 4.77 / 6.94 / 9.02:1, which is three legible steps, all clearing their
   floors. This corrects an earlier draft that forbade it on the strength of the wrong numbers.
5. **Prefer not overlapping text and imagery at all.** The scrim exists for where the overlap is
   genuinely unavoidable. A layout that separates the two needs no scrim and is the better answer.

**It ships in `v1.0.0`, not `v1.1.0`.** Story 1.11 had not opened when this was decided, so the
role goes into the contract's first published version and the contract ships once. Two downstream
consequences follow and both are recorded rather than absorbed: Story 2.28 **consumes** the role
rather than adding it, and Epic 6's trigger (three hand-copied token changes actually performed)
**loses this as one of its three**, because a value present at `v1.0.0` was never a change.

---

## Typography

Three families, which is the ceiling. Two would be canonical; the third earns its place
because metadata density is a real requirement: Marcus reads tech arrays and status marks,
and a monospace makes them scannable in a way a proportional face does not.

| Family | Role | Licence | Axes used |
|---|---|---|---|
| **Bricolage Grotesque** | Display, headings, entry names | OFL | `wdth` 75–100, `opsz` 10–48, `wght` 700–800 |
| **Geist** | Body, lede, UI copy | OFL | `wght` 300–600 |
| **Geist Mono** | Metadata, status, plate marks, tech arrays | OFL | `wght` 400 |

All three are open-licence and self-hostable, which is the whole reason they were chosen:
the type system has to be vendored into seven repositories including a Phoenix application
with no `node_modules`, and a licensed face makes that a legal question instead of a copy
operation.

**Bricolage's width axis is the identity.** It does what Monument Extended did on the
current site, variably and for free. Display sets at `wdth 100`; headings and entry names at
`wdth 85`; the framework band and wordmark compress to `wdth 75`. That single axis is
carrying most of the visual continuity with the site being reshaped.

### Scale

Ratio-based at **1.25 (major third)** from a 16px base. Not arbitrary jumps.

| Token | Value | Used for |
|---|---|---|
| `--t-3xs` | `0.6875rem` / 11px | Status marks, plate marks. **Labels only, never prose** |
| `--t-2xs` | `0.75rem` / 12px | Metadata, tech arrays, footer |
| `--t-xs` | `0.8125rem` / 13px | UI copy floor |
| `--t-sm` | `0.875rem` / 14px | **Body floor.** No prose sets smaller. |
| `--t-base` | `1rem` / 16px | Lede, entry names |
| `--t-md` | `1.25rem` / 20px | Section headings |
| `--t-lg` | `1.5625rem` / 25px | n/a |
| `--t-xl` | `1.9531rem` / 31px | Secondary display |
| `--t-2xl` | `2.4414rem` / 39px | n/a |
| `--t-display` | `clamp(2.25rem, 9vw, 4.5rem)` | The one display line per page |

**Display cap 4.5rem.** Below hallmark's 5.5rem ceiling deliberately, because display sets in
all-caps here, and all-caps at 5.5rem on a 390px viewport wraps into a wall.

### Rules

- **Weight gap ≥ 300 units.** Display 800 against lede 300 is a 500-unit gap. Body 400
  against entry name 700 is 300. Nothing lands at 400-against-600.
- **Line-height.** Display `0.95–1.0` (all-caps, tight). Headings `1.1`. Body `1.6`.
  Lede `1.55`. All-caps never goes below `0.95`.
- **Tracking.** Display `-0.05em`. Headings `-0.03em`. Entry names `-0.015em`. Body `0`.
  Mono labels `+0.09em` to `+0.14em`. Body tracking never exceeds `+0.05em`.
- **Measure 46ch** on descriptions and lede. Never wider.
- **`font-variant-numeric: tabular-nums`** on every count, plate mark and metric.
- **Punctuation is typeset.** Curly quotes, `—` em-dash, `…` ellipsis. Never `"`, `--`, `...`.
  **This rule governs what the product renders; the house writing rule governs what the repository
  stores.** *(Stated 2026-08-16, because the two look contradictory and are not.)* UI copy, Registry
  descriptions and anything a Visitor reads are typeset as above. Prose written **into** the
  repository, meaning documentation, specifications, commit subjects and code comments, takes no
  em-dash at all and reaches for a comma, a colon, parentheses or two sentences instead. A designer
  setting a string and an author writing a spec are following different rules on purpose.
- **`font-display: swap`** on all faces, with `size-adjust` / `ascent-override` /
  `descent-override` set so a swap does not shift layout.
- **Uppercase is structural, not emphatic.** Display, headings, entry names, all mono labels.
  Prose is never uppercase.
- **No gradient text. No synthesised bold or italic. No italic headings.**

---

## Layout & Spacing

A **4pt base** with nine named steps. Spacing is a scale, not a value.

| Token | Value |
|---|---|
| `--s-2xs` | `0.25rem` |
| `--s-xs` | `0.5rem` |
| `--s-sm` | `0.75rem` |
| `--s-md` | `1rem` |
| `--s-lg` | `1.5rem` |
| `--s-xl` | `2.5rem` |
| `--s-2xl` | `4rem` |
| `--s-3xl` | `6rem` |
| `--page-pad` | `clamp(1.25rem, 5vw, 4rem)` |

`--page-pad` is a **direct descendant** of the current site's
`--page-padding: clamp(1.5rem, 4vw, 3rem)`, retuned for a 360px floor and a wider desktop
ceiling. It is the one existing value that survives the migration by intent rather than by
accident.

### The hit-target floor

| Token | Value |
|---|---|
| `--tap` | `44px` |

*Added 2026-08-16.* **This is not a spacing step and it is not on the 4pt scale by coincidence.** It
is the accessibility floor from § Components → Hit targets, WCAG 2.2's 2.5.8 target size, and it is
minted as a token because **three independent reference renders each invented `--tap: 44px`
locally** when the contract did not carry it. Three implementations reaching for the same missing
value is the strongest available evidence that a contract is short one, and every restyled control
in five frameworks needs it.

**It is authored in `px`, deliberately, and it is the only length in the contract that is.** A
target floor is a physical-size guarantee about a fingertip. Expressed in `rem` it would shrink for
any user who reduces their root font size, which is precisely the user least able to afford a
smaller target. Every other length here scales with the reader; this one must not.

**It applies on both axes.** `min-height: var(--tap)` alone passes on the vertical while a
two-character label misses on the horizontal, so `min-width` takes it too. See § Components →
Hit targets for why `inline-flex` is named alongside the number.

- **CSS Grid for page structure, Flexbox inside components.**
- **`gap` for sibling spacing.** `margin` is reserved for optical correction and for breaking
  flow.
- **The row is the unit at every width.** The Suite Directory is a list with rules, not a
  card grid. At ≥760px it gains columns; it never reflows into cards. There is no second
  layout to maintain, which is the point, for a solo maintainer across eight repositories.
- **Section padding varies.** Uniform vertical rhythm across every section is a tell. The
  narrative handoff sits tighter than the directory; the directory sits tighter than the
  footer.
- **`html, body { overflow-x: clip }`** globally. `clip`, not `hidden`, because `hidden` breaks
  sticky positioning. Widths are `100%` with container padding, never `100vw`.
- **Mobile-first.** Every layout is authored at 360px and expanded upward. NFR-5.

### Z-index scale

Six named levels. An ad-hoc z-value anywhere is a defect.

```
--z-base: 1;  --z-raised: 10;   --z-dropdown: 100;
--z-sticky: 200;  --z-modal: 400;  --z-toast: 500;  --z-tooltip: 600;
```

---

## Elevation & Depth

**Depth is lightness and rules. There are no shadows in this system.**

Not "shadows used sparingly", none at all. On a `oklch(12%)` ground a shadow is either invisible or
it reads as a coloured halo, and a halo behind a card on dark is a named slop tell. Removing
shadows entirely also removes the single most framework-divergent visual property in the
estate: every framework's default component shadow differs, so a system with no shadows has
one fewer seam.

The ladder, in order of preference:

1. **Lightness.** `paper` → `surface` → `surface-high`, +4 lightness per level. Two levels
   is the maximum depth the system expresses.
2. **A hairline.** `1px solid var(--token-border)` separates without lifting.
3. **A strong rule.** `1px solid var(--token-border-interactive)` marks something actionable.
4. **Type weight and scale.** Preferred over all of the above where it will carry.

### Border and stroke treatments

| Treatment | Value | Applied to |
|---|---|---|
| Hairline | `1px solid var(--token-border)` | Dividers, entry separators, section rules |
| Boundary | `1px solid var(--token-border-interactive)` | Status pills, buttons, panels, switcher |
| Emphasis | `2px solid var(--token-accent)` | Active link underline, current-nav mark |
| Dashed | `1px dashed var(--token-border-interactive)` | `In progress` status only |
| Hover | Existing underline recoloured to `var(--token-accent-hover)` | Hover, exclusively. Width never changes, width being a layout property |
| Focus | `2px solid var(--token-focus)`, `3px` offset | Focus-visible, everywhere, no exception |

Rules are **1px and opaque**. Never a 4–6px coloured side-stripe on one edge; never an alpha
white.

---

## Shapes

**Square. `--r-DEFAULT: 0`.**

The plate is the metaphor and a plate has corners. Zero radius is also the single most
reliably federated shape value in the estate. It is the one number that cannot drift when
six frameworks each apply their own defaults, because there is nothing to round.

| Token | Value | Used for |
|---|---|---|
| `--r-none` | `0` | Everything structural |
| `--r-hair` | `2px` | Focus ring outline only, so the ring does not read as a hard box |
| `--r-pill` | `999px` | **Declared and currently unused.** Reserved; nothing in the system is a pill |

**The `Live` dot is a 4px *square*, at `--r-none`.** An earlier draft filed it under `--r-pill`,
which contradicted the status table and the anti-pattern list, both of which say square. The plate
has corners and so does the dot. `--r-pill` stays declared because removing a token is a **major**
contract break under AD-16 and the value costs nothing to carry.

A Satellite whose framework applies a default radius to form controls **overrides it to `0`**.
This is the most common single-line fix in the per-app hand-fix list
([`EXPERIENCE.md`](EXPERIENCE.md) § Seams Inventory).

---

## Components

Visual specification only. Behaviour, states and interaction contracts are in
[`EXPERIENCE.md`](EXPERIENCE.md) § Component Patterns.

**Status mark.** Uppercase mono at `--t-3xs`, `+0.14em` tracking, `1px` border,
`--s-2xs`/`--s-xs` padding, square. **Outlined, never filled**, because a filled mark spends accent as
a colour block. Per-value treatment is in § Colors, including the 4px dot that carries the
`Live` / `Complete` distinction structurally. `Archived` alone drops the border. Never
expressed with opacity. Not interactive, so the target floor below does not apply to it.

**Hit targets, every interactive element.** `min-height: var(--tap)`, `display: inline-flex`,
`align-items: center`, with `padding-block` making up the difference. **Vertical padding on a
plain inline element does not grow its hit area.** It paints outward without affecting layout
or hit-testing, so an inline link with `padding: 0.25rem 0` measures ~29px tall no matter what
the padding says. This is the single easiest way to miss the floor while appearing to meet it,
and it is why the rule names `inline-flex` rather than just naming a number.

Where two targets sit on one line (the live and source links on an entry) they take
`--s-lg` of gap so the `--tap` boxes cannot overlap. Where a target is narrow, such as a two-letter
nav label, `padding-inline` brings it to `var(--tap)` wide as well as tall.

**`--tap` is a token, not a literal** *(minted 2026-08-16)*. Writing `44px` by hand in a restyled
application is a contract break like any other hand-written value, and Story 2.34's conformance gate
rejects it. See § The hit-target floor.

**Registry Entry.** A grid row, never a card. Entry name in Bricolage `wdth 85` / 700
uppercase; status hanging right; description at `--t-sm` in `--token-text-secondary` capped
at `46ch`; tech array in mono `--t-3xs` uppercase; links in mono `--t-2xs` uppercase.
Separated from its neighbour by a `1px` hairline. **No containing box**, so card-in-card
cannot occur. The Tracker Family group is the only containment layer in the entire
directory.

**Tracker Family group.** `1px solid var(--token-border)` on all four sides, the only
containment layer in the directory, and the only place a box is drawn around entries. Group
label in mono `--t-3xs` `+0.14em` uppercase in `--token-accent`; framing line beneath it at
`--t-2xs` in `--token-text-secondary`, capped at `--measure`, closed by a hairline. Member
entries sit inside with their usual separators; the last member drops its bottom rule so it
does not double with the container edge.

**Links.** Live link: `--token-text` with a `--stroke-emphasis` accent underline. Source link:
`--token-text-secondary` with a `--stroke-hair` `--token-border-interactive` underline. The
hierarchy of those two underlines is what lets one entry serve both readers: Daniela's eye
goes to the accent, Marcus knows where the quiet one is. **On hover both underlines become
`--token-accent-hover`**; nothing else moves.

**Button.** `1px solid var(--token-border-interactive)`, no fill, square, mono uppercase
label at `--t-2xs`. On hover the border becomes `--token-accent-hover`. There is no filled
button anywhere in the system.

**Framework band.** Bricolage `wdth 75` / 700 uppercase at `--t-3xs`, framework names
alternating `--token-text-secondary` and `--token-accent-muted`, bounded above and below by
hairlines. Decorative rhythm: it carries no state and is not a legend.

**Plate mark.** Mono `--t-3xs`, `--tr-label` tracking, uppercase, `--token-text-secondary`,
sitting on a `1px solid var(--token-border)` hairline, `tabular-nums` always. Section identity in
the top-left, position or domain top-right.

**`HudLabel` is folded into this component and does not survive as a second atom.** *(Decided
2026-08-15.)* They were the same thing under two names (mono, uppercase, tracked, on a hairline,
carrying section identity) and two near-identical label atoms in a fifteen-component system is a
smell. `HudLabel`'s two genuine extras become variants here:

| Variant | Rule | Use |
|---|---|---|
| **Section** | Beneath the label, running the content width | Section identity above a section head |
| **Annotated** | Beneath | Carries a subordinate second line |
| **Side-ruled** | On the **leading** edge, `padding-inline-start: --s-sm` | A label hanging beside content rather than above it. Mirrors to the trailing edge when end-aligned |

The **subordinate line** is mono `--t-3xs` in `--token-accent-muted` at `--tr-meta`.
`--token-accent-muted` computes to 2.74:1 and is **ornament only, never text that means anything**,
so the subordinate line is `aria-hidden` in every implementation without exception. A subordinate
line carrying information is a defect; move that information into the label.

Labels appear where a genuine ordinal or domain exists, **never above every section**. An eyebrow
on every heading is a named anti-pattern.

**Nav.** Wordmark left in Bricolage `wdth 75` / 800; two mono uppercase links right. The
current route carries a **`--stroke-emphasis` (2px) accent underline**, the same weight as an
active link underline everywhere else in the system, so "current" reads identically wherever
it appears. **Two destinations only.** The AI-nav tell is five inline links plus a CTA
button, and this is structurally the opposite.

**Suite Switcher panel.** `--token-bg-raised` ground, `1px` `--token-border-interactive`
boundary, rows separated by hairlines, hover ground `--token-bg-raised-2`. Each row: app name
in Bricolage `wdth 85`, framework subtitle in mono, external-navigation glyph right.

### The redesigned Hub surfaces

*Added 2026-08-15 by the restyle scope change. These are the inherited cybercore components,
respecified token-native. Behaviour is in [`EXPERIENCE.md`](EXPERIENCE.md) § Component Patterns;
the framework-agnostic vocabulary they are built from is in
[`RESTYLE-SPEC.md`](RESTYLE-SPEC.md).*

**The governing decision, applied here:** the glitch loop, the chromatic aberration, the scanline
raster, the radial vignette and the film grain are all retired. The mono signage, the notched panel
silhouette and the readout register survive.

**Display entrance (replaces `GlitchText`).** Display face at `wdth 100` / `--w-black`,
`--t-display`, uppercase, `--tr-display`, in `--token-text`. It is a **heading that arrives**, not
a heading that malfunctions. The entrance is a per-character reveal on `opacity` only, staggered by
DOM index via a custom property and capped at ~500ms total, using `--dur-minor` and
`--ease-entrance`. **No `text-shadow` at any keyframe. No `clip-path`. No `transform` offset. No
second hue.** Under `prefers-reduced-motion` the text is simply present. The `glitch-loop`
animation, its eight keyframes and its two literals are deleted, not tokenized. This closes
**O-12 item 1**.

**Scrim layer (replaces `ScanlineOverlay`).** A single flat `--token-scrim` layer at `--z-raised`,
`pointer-events: none`, covering exactly the imagery it belongs to. **No `radial-gradient`
vignette, no `repeating-linear-gradient` raster, no noise asset, no animation.** Its intensity is
not variable: one value, or the layer is absent. What the layer permits above it is fixed by
§ The scrim, binding rule 4: **every role is permitted over a scrim, and an interactive element may
sit on one**, rest, hover and focus landing at 4.77 / 6.94 / 9.02:1. *(Corrected 2026-08-16. This
sentence previously read "`--token-text` only, and nothing focusable", which was residue of the
draft contrast table that blended luminances instead of compositing in gamma-encoded sRGB. The
restriction has no basis in the corrected numbers.)* **The constraint that does bind is the stack,
not the role:** an element has the guarantee only if the scrim is genuinely beneath it.

**Error surface (`Error404`).** Ground `--token-bg`, no grid overlay, no scrim (there is no moving
imagery here). A **Plate mark** section variant, then the display line, then one line of
`--token-text-secondary` at `--t-sm`, then exactly the exits the header carries, the Suite and the
CV, as controls per § Components → Button. The **decorative numeral** carries **O-12 item 3** and
its two branches are specified in [`EXPERIENCE.md`](EXPERIENCE.md) § Component Patterns → Error
surface; the visual consequence is that a numeral in `--token-accent-muted` is permitted **only**
on the branch where it is `aria-hidden`.

**Home surface (`HomeLayout`).** Panels sit in the corners of a grid at `--page-pad`, each with a
notched silhouette (the `clip-path` corner cut survives, being geometry rather than an effect, and it
costs nothing to federate). Panel content is a Plate mark plus display or mono type. The ground is
`--token-bg`; **the grid-line background is retired**, since it is a `linear-gradient` and § Rules
bans gradients in backgrounds. Where a panel overlaps the canvas, a `--token-scrim` layer sits
between them, and **that panel may carry interactive elements**, since every role clears its floor
over the scrim. *(Corrected 2026-08-16; this previously read "that panel carries no interactive
element" and followed from the same withdrawn contrast table.)* **What the panel must not do is sit
at a z-level above the scrim**: the sticky header at `--z-sticky` over a scrim at `--z-raised` is
over the imagery rather than the scrim, and computes against the imagery. Nav items keep their
**side-ruled** leading edge, at `--token-border` for the rule.

**Work item (`WorkItem`).** A **row** per § Components → Registry Entry, not a card. Separator
`1px solid var(--token-border)`. The left indicator rule becomes `--stroke-emphasis`
`--token-accent` when the item is open and `1px solid var(--token-border)` when closed: a width
and colour change on a **non-layout** property, and the element reserves its widest state so
nothing reflows. Header is a control; hover recolours the border only, never the ground. Tech chips
are **outlined, never filled**: `1px solid var(--token-border-interactive)`, no ground, mono
`--t-3xs`, square. Highlight markers use the mono `//` glyph in `--token-text-secondary`, not
`--token-accent-muted`, because a list marker is read.

**Work hero and timeline (`WorkHero`, `WorkTimeline`).** Hero: display line left, canvas right,
closed beneath by a `1px solid var(--token-border-interactive)` boundary. Meta line is a Plate mark,
not free mono text. Timeline is a list of work-item rows with the last row dropping its separator.
`WorkTimeline` is reused structurally unchanged by Story 2.16 (UX-DR28); this restyles it and
changes nothing about what it renders.

**Chrome (`Navbar`, `Header`, `Logo`, `ContactContainer`, `Container`).** Per § Components → Nav.
`Navbar` links are mono uppercase `--t-2xs` at `--tr-label` in `--token-text`,
`min-height: var(--tap)`, `display: inline-flex`, `padding-inline` to reach `var(--tap)` wide;
current route takes the
`--stroke-emphasis` accent underline. **Hover recolours the existing underline; it does not add
one.** An underline that appears on hover is a width change and it reflows. `Header` height is
content-driven with `padding-block: --s-lg`, not a fixed `140px`. `Container` is
`width: min(100%, 1920px)` with `padding-inline: var(--page-pad)`, never a percentage width, which
is what makes the 360px floor fail. `Logo` sets in the display face at `wdth 75` / `--w-black` as a
wordmark; the raster image is retired.

**`ProjectCard` and `ProjectsHero` are not respecified.** They retire with `/projects` at Story
2.14 and the Registry Entry pattern replaces them.

---

## The Token Contract

The published artefact. Three files, versioned together, consumed by six frameworks.

### Why three files, not two

Research §D2 specifies two artefacts. This design adds a third, for a reason the research
could not have anticipated: **the type system is being replaced**, so woff2 binaries now
travel to seven repositories.

| File | Contents | Consumed by |
|---|---|---|
| `tokens.css` | Plain `:root` custom properties. **Values only.** Names font families; contains no `@font-face`. | Every framework, natively |
| `fonts.css` | `@font-face` rules with `url()` paths **relative to itself** | Every framework, natively |
| `tailwind.css` | Generated `@theme inline` adapter | The Tailwind cluster only |

**`@font-face` must not live in `tokens.css`.** Its `url()` paths resolve relative to the
stylesheet, so the moment `tokens.css` is vendored to a different depth in a Satellite
(`assets/css/` in Phoenix, `src/styles/` in Svelte, `src/` in Angular) every font 404s
silently and the app falls back to a system stack that looks almost right. Splitting them
means a Satellite copies the **folder**, and the relative paths inside `fonts.css` stay valid
wherever the folder lands.

### `tokens.css`

```css
/* Cuatro Ecosystem, Design Tokens
 * Contract v1.0.0 · dark only · anchor hue 288
 * Values only. Font files: see fonts.css (same folder).
 * A value change or an addition is a MINOR bump. A rename or a removal is MAJOR.
 */
:root {
  /* ── colour: palette ───────────────────────────────────── */
  --c-paper:        oklch(12% 0.011 288);
  --c-surface:      oklch(16% 0.013 288);
  --c-surface-high: oklch(20% 0.014 288);
  --c-line:         oklch(28% 0.015 288);
  --c-line-strong:  oklch(51% 0.020 288);
  --c-muted:        oklch(68% 0.012 288);
  --c-ink:          oklch(95% 0.005 288);
  --c-accent:        oklch(66% 0.165 288);
  --c-accent-bright: oklch(76% 0.145 288);
  --c-accent-quiet:  oklch(46% 0.110 288);
  --c-focus:         oklch(84% 0.130 288);
  /* The ONE translucent value in the contract. The FR-17 conformance gate
     (Story 2.34) must permit the alpha on THIS declaration and reject it
     everywhere else, including any hand-written rgba() that reproduces it. */
  --c-scrim:         oklch(12% 0.011 288 / 0.88);

  /* ── colour: semantic roles (consume these) ────────────── */
  --token-bg:                  var(--c-paper);
  --token-bg-raised:           var(--c-surface);
  --token-bg-raised-2:         var(--c-surface-high);
  --token-text:                var(--c-ink);
  --token-text-secondary:      var(--c-muted);
  --token-border:              var(--c-line);
  --token-border-interactive:  var(--c-line-strong);
  --token-accent:              var(--c-accent);
  --token-accent-hover:        var(--c-accent-bright);
  --token-accent-muted:        var(--c-accent-quiet);
  --token-focus:               var(--c-focus);
  --token-scrim:               var(--c-scrim);   /* imagery↔text only. Never a surface. */

  /* ── type: families ────────────────────────────────────── */
  --f-display: "Bricolage Grotesque", "Archivo", system-ui, sans-serif;
  --f-body:    "Geist", ui-sans-serif, system-ui, sans-serif;
  --f-mono:    "Geist Mono", ui-monospace, SFMono-Regular, monospace;

  /* ── type: scale (1.25 from 16px) ──────────────────────── */
  --t-3xs:  0.6875rem;
  --t-2xs:  0.75rem;
  --t-xs:   0.8125rem;
  --t-sm:   0.875rem;
  --t-base: 1rem;
  --t-md:   1.25rem;
  --t-lg:   1.5625rem;
  --t-xl:   1.9531rem;
  --t-2xl:  2.4414rem;
  --t-display: clamp(2.25rem, 9vw, 4.5rem);

  /* ── type: weight ──────────────────────────────────────── */
  --w-light: 300;
  --w-regular: 400;
  --w-medium: 500;
  --w-bold: 700;
  --w-black: 800;

  /* ── type: line-height ─────────────────────────────────── */
  --lh-display: 0.95;
  --lh-heading: 1.1;
  --lh-lede:    1.55;
  --lh-body:    1.6;
  --lh-label:   1.4;

  /* ── type: tracking ────────────────────────────────────── */
  --tr-display: -0.05em;
  --tr-heading: -0.03em;
  --tr-name:    -0.015em;
  --tr-body:    0em;
  --tr-meta:    0.09em;
  --tr-label:   0.14em;

  /* ── measure ───────────────────────────────────────────── */
  --measure: 46ch;

  /* ── space (4pt base) ──────────────────────────────────── */
  --s-2xs: 0.25rem;
  --s-xs:  0.5rem;
  --s-sm:  0.75rem;
  --s-md:  1rem;
  --s-lg:  1.5rem;
  --s-xl:  2.5rem;
  --s-2xl: 4rem;
  --s-3xl: 6rem;
  --page-pad: clamp(1.25rem, 5vw, 4rem);

  /* ── hit target ────────────────────────────────────────── */
  /* The ONE px length in the contract, and deliberately so: a target floor
     is a physical-size guarantee and must not shrink with the root font
     size. Applies on BOTH axes. See DESIGN.md § The hit-target floor. */
  --tap: 44px;

  /* ── shape ─────────────────────────────────────────────── */
  --r-none: 0;
  --r-hair: 2px;
  --r-pill: 999px;

  /* ── stroke ────────────────────────────────────────────── */
  --stroke-hair:     1px;
  --stroke-boundary: 1px;
  --stroke-emphasis: 2px;
  --stroke-focus:    2px;
  --focus-offset:    3px;

  /* ── elevation (lightness, not shadow) ─────────────────── */
  --elev-0: var(--c-paper);
  --elev-1: var(--c-surface);
  --elev-2: var(--c-surface-high);

  /* ── motion ────────────────────────────────────────────── */
  --dur-micro: 120ms;
  --dur-minor: 220ms;
  --dur-major: 420ms;
  --dur-exit:  165ms;                              /* ~75% of minor */
  --ease-entrance: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-exit:     cubic-bezier(0.7, 0, 0.84, 0);
  --ease-toggle:   cubic-bezier(0.65, 0, 0.35, 1);

  /* ── layer ─────────────────────────────────────────────── */
  --z-base: 1;
  --z-raised: 10;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-modal: 400;
  --z-toast: 500;
  --z-tooltip: 600;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --dur-micro: 1ms;
    --dur-minor: 1ms;
    --dur-major: 1ms;
    --dur-exit:  1ms;
  }
}
```

**The `prefers-reduced-motion` block is inside the contract on purpose.** It is the one piece
of *behaviour* the token layer can genuinely federate: a Satellite that adopts the tokens
gets reduced-motion compliance for every token-driven transition without writing a line. It
is the single highest-value thing in this file after the palette, and it is the exception
that proves the rule about behaviour not federating.

### `tailwind.css`, the generated adapter

For `cuatro-finance`, `cuatro-tracker` and `cs-tournament`. **Not the Anchor**, which is
SCSS. Mechanical output from Style Dictionary: a build-step cost, not an authoring cost.

```css
@import "tailwindcss";
@import "./tokens.css";
@import "./fonts.css";     /* REQUIRED. See below. */

@theme inline {
  /* Tailwind's --color-* namespace ← our --token-* namespace. Never the same name. */
  --color-bg:          var(--token-bg);
  --color-surface:     var(--token-bg-raised);
  --color-surface-2:   var(--token-bg-raised-2);
  --color-ink:         var(--token-text);
  --color-muted:       var(--token-text-secondary);
  --color-line:        var(--token-border);
  --color-line-strong: var(--token-border-interactive);
  --color-accent:      var(--token-accent);
  --color-accent-hover:var(--token-accent-hover);
  --color-focus:       var(--token-focus);
  --font-display:      var(--f-display);
  --font-sans:         var(--f-body);
  --font-mono:         var(--f-mono);
  --spacing-lg:        var(--s-lg);
  --radius-DEFAULT:    var(--r-none);
  /* … one line per token that should mint a utility */
}
```

**`tailwind.css` must import `fonts.css` too.** An adapter that pulls in only `tokens.css`
gives the cluster three named font families and **no `@font-face` for any of them**, so every
face falls silently to `system-ui` and the page looks almost right. That is precisely the
failure the three-file split exists to prevent, and it is easier to reintroduce here than
anywhere else, because `tailwind.css` is documented as the cluster's single entry point.

`inline` is **mandatory**, not stylistic. Without it a `var()` reference resolves where the
theme variable is defined rather than where it is used. This system has no `[data-theme]`
override today, so nothing breaks, but the moment one is added, non-`inline` fails
**silently**, and a silent failure across eight repositories with no test suite is the worst
available outcome.

Import order is fixed: `tailwindcss` first, then `tokens.css`, then `fonts.css`, then the
`@theme` block.

### Build

**Style Dictionary 5.5.1** minimum, because 5.5.1 patched a prototype-pollution vulnerability in
`convertTokenData`. Do not pin below it. DTCG format **2025.10**. Terrazzo is rejected: its
CLI is `0.7.2`, pre-1.0, and a pre-1.0 entry point under an eight-repository contract is not
a trade worth making.

### Versioning

Per NL Design System convention, inherited from research §D2:

- A **value** change is a **minor** bump. Pixels move; nothing breaks.
- An **addition** is a **minor** bump. *(Added 2026-08-16. The rule previously had no category for
  one, and the first answer ever given to the question was improvised inside a story's acceptance
  criteria, which is the wrong place for a contract rule to be decided.)* A consumer that has not
  adopted the new token is unaffected, and nothing it already reads changes value. **A token present
  at first publication is not an addition and bumps nothing**, which is why `--token-scrim` ships
  inside `v1.0.0` rather than as a `v1.1.0` release.
- A **rename** is **major**, including fixing a typo in a token name. Contracts break.
- A **removal** is **major**, for the same reason a rename is: a consumer's `var()` silently falls
  back. This is why `--r-pill` stays declared but unused rather than being deleted.
- With no atomic commits across eight repositories, the only workable model is
  **deprecate → migrate → remove**.
- Adoption is **explicit and reviewed** in every Satellite. No unattended dependency merge in
  any repository without a real test suite (FR-19, NFR-10).

### Per-framework consumption

| Framework | Mechanism | Cost |
|---|---|---|
| **Next.js / Anchor (SCSS)** | `@use` the folder; custom properties pass through Sass untouched | Trivial |
| **Tailwind cluster** | Import `tailwind.css` | Trivial, generated |
| **Svelte** | Import `tokens.css` + `fonts.css` in the root layout | Trivial |
| **Vue** | Same | Trivial |
| **Angular** | Add both files to the `styles` array in `angular.json`. `ViewEncapsulation.Emulated` is a non-issue: it stops component styles leaking *out*, not global styles reaching *in* | Trivial |
| **Phoenix LiveView** (`cs-tracker`) | **Vendor all three files** into `assets/css/`. `@import` `tokens.css` + `fonts.css` for raw consumption, **and** apply the `@theme` adapter, see below | Not trivial. The one adopter that needs both artefacts |

**`cs-tracker` is a Tailwind consumer, and the table above nearly hid that.** Phoenix 1.8.0
ships **Tailwind v4 plus daisyUI** in the generated application. Research §D2 is explicit that
a plain external file defining custom properties under `:root` **generates zero utility
classes**: `bg-accent` will not exist in a Phoenix app any more than in `cuatro-finance`.

So the "Tailwind cluster" is not `cuatro-finance` / `cuatro-tracker` / `cs-tournament`. It is
those three **plus `cs-tracker`**, which is the Step 2 adopter that FR-18 is measured on. A
contract that files Phoenix under plain-CSS consumption would have sent Epic 1's first visible
ecosystem moment down a path that silently produces no utilities.

Vendoring remains Phoenix's own sanctioned pattern: the v1.8.0 installer commits
`daisyui.js` (251,614 bytes) into the app and upgrades it via `curl` comments in `app.css`.
Three more files is the identical mechanism.

**Verify before Step 2:** confirm which Phoenix version `cs-tracker` is actually on. Below
1.8.0 the daisyUI layer may be absent and the plain-CSS path is then correct. The version
determines which of the two adoption routes applies, and it is a one-line check.

**One thing to settle empirically before Step 2 ships,** carried forward from research §D2:
whether `@plugin "daisyui/theme" { --token-primary: var(--token-accent); }` accepts a
`var()` reference. Undocumented either way. The documented fallback is plain CSS,
`[data-theme="x"] { --token-primary: var(--token-accent); }`. Cheap to test in a scratch
`mix phx.new`, and **`cs-tracker` being the Step 2 adopter is what front-loads this while it
is still cheap to discover.**

---

## Migrating the Anchor from SCSS to tokens

> ⚠️ **Re-baselined 2026-08-15 against the merged `dev` tree.** This section was originally
> authored against `main`, before the 28-commit "cybercore" rebrand (PRs #46–#70) was merged.
> Every count and line reference below is now measured, not inherited. See
> [`rebaseline-2026-08-15.md`](rebaseline-2026-08-15.md) for the full before/after and for the
> **open palette-reconciliation decision** this section does not resolve.

`cuatro-portfolio` ships at v2.5.3. This is a reshape of a working site. The token surface
today is **sixteen custom properties in one file**, consumed by **fifteen component
stylesheets**.

### What exists

[`app/app.scss`](../../../../app/app.scss) holds all of it:

```scss
:root {
  --white-color: #fff;              --black-color: #000;        /* :5  :6  */
  --light-gray-color: #b3b0aa;      --gray-color: #545454;      /* :7  :8  */
  --accent: …;  --accent-dim: …;    --accent-glow: …;           /* :9 :10 :11  (cybercore) */
  --page-padding: clamp(1.5rem, 4vw, 3rem);                     /* :14 */
  --hero-height: 40vh;                                          /* :17 */
  --font-regular: 'GeneralSans-Regular';   --font-bold: 'GeneralSans-Bold';   /* :20 :21 */
  --confillia-normal: 'Confillia Normal';  --confillia-bold: 'Confillia';     /* :24 :25 */
  --monument-regular: 'MonumentExtended-Regular';                             /* :28 */
  --monument-bold: 'MonumentExtended-Bold';                                   /* :29 */
  --font-mono: …;                                               /* :31 (cybercore) */
}
```

Plus `app/scss/_fonts.scss` (self-hosted `@font-face`), `app/scss/_print.scss`,
`app/scss/_index.scss`, and **fifteen** component stylesheets under
`components/atoms|molecules|organisms/`, the rebrand having added `hud-label.scss`,
`ScanlineOverlay.scss` and `glitch-text.scss`.

Colour literals outside `app.scss` now sit on **28 lines across 9 files**, up from eleven.
The rebrand replaced the old white alpha hairlines with a violet set and introduced its own
hardcoded palette. The bare keyword `color: white` at the old `HomeLayout.scss:122` **no
longer exists**, that file having been rebuilt. Grep for `#`, `rgba(` and named colours anyway; the
sweep is cheap and the file has changed once already.

### The mapping

| Current | Becomes | Note |
|---|---|---|
| `--white-color: #fff` | `--token-text` → `#eeeef2` | Pure white retired |
| `--black-color: #000` | `--token-bg` → `#060509` | Pure black retired |
| `--light-gray-color: #b3b0aa` | `--token-text-secondary` → `#98979f` | **Warm → violet-tinted.** The most visible single change in the migration |
| `--gray-color: #545454` | `--token-border-interactive` → `#656471` | Was untinted and below 3:1; now tinted and compliant |
| `--page-padding` | `--page-pad` | Retuned; survives by intent |
| `--hero-height: 40vh` | *stays local* | Layout constant, not a design token. Contract carries no viewport heights |
| `--font-regular` | `--f-body` + `--w-regular` | General Sans retired |
| `--font-bold` | `--f-body` + `--w-bold` | **Weight, not family.** A family-only alias silently drops bold, see below |
| `--monument-regular` | `--f-display` + `--w-bold` | Monument Extended → Bricolage Grotesque |
| `--monument-bold` | `--f-display` + `--w-black` | Same; the weight distinction must survive the alias |
| `--confillia-normal` | `--f-display` at `wdth 75` | **Two live call sites**: `HomeLayout.scss:117` and `:148`. Needs a target, not a deletion |
| `--confillia-bold` | **dropped** | Zero call sites. Safe to delete outright |
| `--accent` | `--token-accent` → `--c-accent` `#8f7ef0` | Cybercore. 6.20:1 |
| `--accent-dim` | `--token-accent-muted` *or* `--token-border-interactive` | Cybercore, **15 call sites**. It is doing two jobs today: ornament in some places, a readable boundary in others. **Decide per call site**, not globally |
| `--accent-glow` | **dropped** | Declared at `app.scss:11`, **zero call sites**. Dead on arrival. **O-11 closed 2026-08-15**: one occurrence in the whole repository, its own declaration. Delete at step 2 |
| `--font-mono` | `--f-mono` | Cybercore. 10 call sites; the contract needs a mono role it did not previously carry |

**The alias trap is now half gone.** The old properties are *family* aliases, and two encoded
weight in the family name: `--font-bold` and `--monument-bold`. The rebrand retired every
`--font-bold` call site, so **only `--monument-bold` remains live**, at `glitch-text.scss:5`,
`error-page.scss:24`, `ProjectsHero.scss:19` and `WorkHero.scss:19`. Aliasing it to a family
alone still silently drops bold at those four sites. Bricolage and Geist are variable, so set
`font-weight` alongside `font-family` at each, but the regression still lands at **step 2**,
before step 6 exists to fix it. Four call sites by hand in step 2 is what this file recommends.

**O-10 is decided: the contract palette wins.** *(Operator decision, 2026-08-15.)* Cybercore's
hardcoded values are replaced by token roles; the full value-by-value mapping is in
[`rebaseline-2026-08-15.md`](rebaseline-2026-08-15.md) § O-10. Both systems are violet (the
contract's `--c-paper` `#060509` and cybercore's `#0a000f` are near-neighbours) so the shipped
visual identity largely survives. What changes is that every value gains a computed contrast.

One row of the table above is stale in its *reasoning* as a result: `--light-gray-color` is
described as "warm → violet-tinted, the most visible single change." The rebrand already went
violet, so that framing no longer holds; the mapping itself is unaffected.

**O-11 is closed.** `--accent-glow` has exactly one occurrence in the repository: its own
declaration at `app.scss:11`. Zero call sites, nothing reserved. It is **deleted at step 2**, not
carried.

**O-12 is closed, two items dissolved into the redesign and one specified in both branches.**
*(Decided 2026-08-15.)* Item 1, GlitchText's red and cyan aberration, is **dropped**. The effect
structurally requires opposing hues a single-anchor-hue palette cannot supply, and a documented
exception on one of the Hub's most visible components would undermine the contract exactly where a
reviewer looks first. Item 2, ScanlineOverlay's pure blacks, dissolves into `--token-scrim`: the
scanlines, vignette and grain retire, and the **legibility** job they were incidentally doing
survives as a named role (§ The scrim). Item 3, the decorative numeral, is **not** dissolved by any
redesign, being an accessibility question that survives one, and both of its branches are
specified in [`EXPERIENCE.md`](EXPERIENCE.md) § Component Patterns → Error surface so Story 2.30
cannot stall on it.

### Sequence

> **Rewritten 2026-08-15 by the restyle scope change.** The seven-step migration is now **two steps
> plus a redesign programme**. Steps 1 and 2 survive verbatim; step 5 moves to the front of the
> redesign; steps 3, 4 and 6 are struck; step 7 is retargeted. The mapping table above is unchanged
> and remains load-bearing for Story 1.18.

Each step leaves the site working. NFR-2 binds every one.

#### The two migration steps (Epic 1, unchanged)

1. **Add, do not replace.** Drop `tokens.css` + `fonts.css` into `app/scss/`, `@use` them
   from `_index.scss`. Nothing consumes them yet. The site is byte-identical. *Ship this.*
   **Story 1.17.**
2. **Alias the old names.** Redefine the existing properties as `var()` references to the new
   roles. Every one of the fifteen component stylesheets keeps working untouched, and the
   whole site changes appearance in one commit that touches one file, which is also the one
   commit worth a careful visual check. `--accent` → `--token-accent`; `--accent-dim` →
   `--token-accent-muted` or `--token-border-interactive` **per call site**, across fifteen sites;
   `--monument-bold` needs `font-weight` set alongside `font-family` at its four live sites, or
   bold is silently dropped; `--accent-glow` and `--confillia-bold` are deleted outright.
   **Story 1.18.**

**These two are what FR-18 measures, and they are the whole of the Anchor's Token Adoption.**
FR-18 is not raised by anything below it: spine C-13, and Epic 1's standalone claim rests on it.

**The alias layer introduced at step 2 is now more load-bearing, not less.** It is the scaffold
that keeps the un-redesigned stylesheets coherent while eight redesign stories land one at a time,
which is exactly the "every step leaves a working system" guarantee AD-20 demands and the reason
AD-14's all-or-nothing binds the contract *import* rather than the restyle (spine C-11).

#### The redesign programme (Epic 2)

**Step 5 moves to the front and becomes step R0**, because redesigning a component against
`--f-display` while Monument Extended is still the shipped face means designing against a face
about to be deleted.

| # | Step | Story | Was |
|---|---|---|---|
| **R0** | **Swap the type.** New `@font-face` in `fonts.css`, retire `_fonts.scss`, delete the General Sans / Monument Extended / Confillia binaries from `public/fonts/`. `size-adjust` overrides so the swap does not shift layout | **2.20** | Step 5, resequenced first. **Blocking predecessor of every redesign below** |
| **R1** | Display entrance, replacing `GlitchText` | 2.27 | new |
| **R2** | Scrim layer, replacing `ScanlineOverlay`. Consumes `--token-scrim` | 2.28 | new |
| **R3** | Home surface, `HomeLayout` | 2.29 | new |
| **R4** | Error surface, `Error404`. Carries O-12 item 3 as a binding AC | 2.30 | new |
| **R5** | Work item, and the label atom that absorbs `HudLabel` | 2.31 | Absorbs the whole of struck step 3 |
| **R6** | Chrome: `Navbar`, `Header`, `Logo`, `ContactContainer`, `Container` | 2.32 | new |
| **R7** | `WorkHero` and `WorkTimeline` | 2.33 | new |
| **R8** | **FR-17 conformance gate.** A blocking CI grep: no colour, spacing or type literal outside `contracts/` and `_print.scss`. Plus `celeste.scss`'s two literals, which no redesign story reaches | 2.34 | Replaces struck step 4 |

Each redesign story is measured against UX-DR49's 140 KB non-3D budget (SM-C5). R0 deletes three
font binaries and R1 deletes the `glitch-loop` keyframes; those are the offsets available.

#### The three struck steps, and why

| Struck | Was | Why it is gone |
|---|---|---|
| **3. Retire the violet hairlines** | Story 2.18 | Its four replacements live in `WorkItem.scss` and `ProjectCard.scss`. `ProjectCard` retires with `/projects` at Story 2.14; `WorkItem` is redesigned at R5, which absorbs them. Nothing is left for the step to do |
| **4. Sweep the colour literals** | Story 2.19 | The redesigned files absorb their own literals. The residue plus every future regression is held by R8's blocking CI grep, which is cheaper than a hand sweep and, unlike one, permanent. **This converts a task into an invariant** |
| **6. Rename the call sites** | Story 2.21 | A stylesheet rewritten against `--token-*` has no call sites to rename. This is the clearest waste the change removes: the step existed only to undo step 2's aliasing, component by component, on files being replaced |

#### The final step, retargeted

7. **Delete the aliases** from step 2. **Story 2.22.** Its trigger moves from "step 6 complete" to
   **"the last Hub component redesigned"** (R7), and its acceptance moves from "visually identical
   to the pre-deletion build" (which is meaningless once the components have deliberately changed)
   to **"no rule anywhere references an alias name, and R8's gate passes."**

**Print keeps `#fff` and `#000`.** Paper is genuinely white and toner is genuinely black, and the
print stylesheet is outside the contract by nature. R8's grep excludes it explicitly.

### Two things the migration does not touch

- **The Three.js narrative.** Its colours are JS values (`new THREE.Color()`), not CSS, and
  a custom property cannot reach a WebGL scene without a runtime `getComputedStyle` read.
  **FR-17 is scoped to CSS-expressible styling**; the 3D scene is a declared exception, not a
  discovered one. Recorded as seam S-1 in [`EXPERIENCE.md`](EXPERIENCE.md).
- **`_print.scss`.** Outside the contract by nature, as above.

---

## Do's and Don'ts

**Do**

- Consume the **semantic role** tokens. `--token-text`, never `--c-ink`.
- Express depth as **lightness**, then a hairline, then a rule.
- Keep accent **under 3% of the viewport**. It is a highlighter.
- Carry Status in **border style**, so the taxonomy survives greyscale.
- Set focus rings **instantly**. Never transition `outline` or `box-shadow` on focus gain.
- Vary section padding. Uniform rhythm is a tell.
- Use `tabular-nums` on every count.
- Override a framework's default control radius to `0`. It will not match otherwise.
- Type `—`, `…` and curly quotes properly.

**Don't**

- Don't use `#000` or `#fff`. Not once, outside the print stylesheet.
- Don't add a shadow. There are none in this system, deliberately.
- Don't fill a status pill, a button, or any accent-coloured block.
- Don't write a gradient. Not a background, not text, not a hover, not an aurora.
- Don't define a colour with alpha. `rgba(255,255,255,0.15)` cannot federate. **`--c-scrim` is the
  one named exception**, it is the only one, and the alpha lives on `--c-scrim` rather than on
  `--token-scrim`, which is a plain `var()` reference like every other role.
- Don't use the scrim as a surface, a card ground or a hover state. It goes between imagery and
  text, and nowhere else.
- Don't vary the scrim's intensity. One value, or the layer is absent.
- Don't assume something is "over the scrim" because it is over the imagery. Check the z-level.
- Don't blend alpha in linear-light space when checking a contrast claim. CSS composites in
  gamma-encoded sRGB, and the two answers differ by a factor of seven.
- Don't use `transition: all`. Name the properties.
- Don't apply `hover:scale-105`, a lift, or a bounce. One signal per element.
- Don't fade every section in on scroll. One orchestrated entrance, then content simply exists.
- Don't invent a metric. If the number was not supplied, the slot does not exist.
- Don't reach for an emoji as an icon.
- Don't write an ad-hoc `z-index`. Six named levels exist.
- Don't set prose below `--t-sm`, or anything below `--t-3xs`.
- Don't rename a token casually. A rename is a **major** contract break across eight repos.
