---
name: Cuatro Ecosystem — Industrial Plate
status: final
updated: 2026-08-15
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
  plate-mark: mono label pair on a hairline
  suite-switcher-panel: raised ground, hairline rows, external glyph per row
  focus-ring: 2px solid focus, 3px offset, no transition
sources:
  - ../../prds/prd-cuatro-portfolio-2026-08-15/prd.md
  - ../../prds/prd-cuatro-portfolio-2026-08-15/addendum.md
  - ../../research/technical-cuatro-ecosystem-architecture-2026-08-15/research.md
  - ../../ecosystem-ux-prompt.md
---

# DESIGN.md — Cuatro Ecosystem

Visual identity for the Cuatro Ecosystem: the Hub at `cuatro.dev` and every Satellite that
adopts the Token Contract. Behaviour, information architecture, states and accessibility
behaviour live in [`EXPERIENCE.md`](EXPERIENCE.md).

**This file wins on conflict** with any mock, wireframe or import, including the artifacts
linked from it.

Reference renders — **this file wins on conflict with all of them**:

| File | Illustrates |
|---|---|
| [`mockups/key-screens.html`](mockups/key-screens.html) | The token block rendered. Homepage, Suite Directory, Registry Entry states, Suite Switcher |
| [`mockups/secondary-screens.html`](mockups/secondary-screens.html) | `/cv`, `/work`, `/recommendation`, `/celeste` — **rendered from the identical token block, introducing no new tokens** |
| [`mockups/directions-4.html`](mockups/directions-4.html) | The four directions considered; **C, Industrial Plate, was chosen** |

---

## Brand & Style

The identity is **Industrial Plate**: engineering signage rendered in near-black with a
single violet anchor. Wide uppercase display type set over hairline rules, square corners,
outlined status marks, and a framework band that states the polyglot thesis as ornament
rather than as a claim.

It exists to solve one problem. Six frontend frameworks and five backend languages must
**visibly belong to each other** while sharing no component code. The design answers that
with an identity built almost entirely from things a CSS custom property can carry — a
colour, a rule width, a tracking value, a type scale — and almost nothing from things it
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
shipping site at v2.5.3**, not a rebuild: the structural memory — black ground, wide caps,
hairlines, generous page padding — is carried forward intact.

**Voice.** Declarative, specific, unhurried. Numbers where numbers are true, never where
they are not. No superlatives, no first person in product surfaces, no marketing adjectives
anywhere. Microcopy rules are in [`EXPERIENCE.md`](EXPERIENCE.md) § Voice and Tone.

---

## Colors

**Dark only.** One theme is designed, contrast-tested and shipped. There is no
`[data-theme="light"]` block and no reserved slot for one — this is a decision, and its
cost is recorded in [`EXPERIENCE.md`](EXPERIENCE.md) § Seams Inventory, seam S-7.

Every value is authored in **OKLCH** on a single anchor hue of **288°**. OKLCH is
perceptually uniform, so the lightness number *is* the perceived lightness — which is what
makes the elevation ladder below a reliable ladder rather than a guess. The hex column is
the computed sRGB fallback, not a second source of truth.

### The palette

| Token | Authored | sRGB | Contrast on `paper` | Role |
|---|---|---|---|---|
| `--c-paper` | `oklch(12% 0.011 288)` | `#060509` | — | Page ground. Near-black, tinted violet. **Never `#000`.** |
| `--c-surface` | `oklch(16% 0.013 288)` | `#0d0c13` | 1.05:1 | Raised one level |
| `--c-surface-high` | `oklch(20% 0.014 288)` | `#16151c` | 1.12:1 | Raised two levels |
| `--c-line` | `oklch(28% 0.015 288)` | `#282830` | 1.39:1 | Decorative hairline, carries no meaning |
| `--c-line-strong` | `oklch(51% 0.020 288)` | `#656471` | **3.52:1** | Meaning-bearing UI boundary |
| `--c-muted` | `oklch(68% 0.012 288)` | `#98979f` | **7.03:1** | Secondary text |
| `--c-ink` | `oklch(95% 0.005 288)` | `#eeeef2` | **17.54:1** | Primary text. **Never `#fff`.** |
| `--c-accent` | `oklch(66% 0.165 288)` | `#8f7ef0` | **6.20:1** | The only accent |
| `--c-accent-bright` | `oklch(76% 0.145 288)` | `#ada1ff` | **9.00:1** | Hover only |
| `--c-accent-quiet` | `oklch(46% 0.110 288)` | `#564c91` | 2.74:1 | Decorative accent at rest — **never text** |
| `--c-focus` | `oklch(84% 0.130 288)` | `#c6bdff` | **11.70:1** | Focus ring only |

**Hover and focus use different tokens on purpose.** `--c-accent-bright` (9.00:1) sits between
accent (6.20:1) and focus (11.70:1), so a hovered element and a focused element are
distinguishable from each other and from rest — three legible steps on one hue. Spending the
focus token on hover would make a keyboard user unable to tell where focus actually is.

### Semantic roles

Roles are what a Satellite consumes. A Satellite maps its own concepts onto these names and
never reaches for a raw palette value.

**The `--token-` prefix is load-bearing, not decoration.** The Tailwind adapter has to map
Tailwind's own `--color-*` namespace onto this one, and the two namespaces **must differ** —
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
| `--token-accent-muted` | `--c-accent-quiet` | Ornament only — the framework band, annotation rules |
| `--token-focus` | `--c-focus` | Focus rings, exclusively |

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
`Complete` were distinguished only by border *colour* — both `1px solid`, one accent and one
neutral — they would sit **1.13:1 apart in greyscale**, and the taxonomy would be carried
entirely by reading the word. Only `Live` earns accent, because it is the one value that means
*you can click this right now*; but the accent is confirmation, never the signal.

**`Archived` carries no pill on purpose, and opacity is never used to express it.** An earlier
draft faded the pill to 70%, which computes to **2.25:1 on the border and 3.87:1 on the text**
— both below the floors this file enforces elsewhere. Removing the container instead is
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
- **Alpha is not a colour.** `rgba(255,255,255,0.15)` — which the current site uses for its
  hairlines — is replaced by a named opaque token. An alpha hairline changes value with
  whatever sits behind it, which is precisely why it cannot federate.

### Conformance

All fifteen meaningful pairings were computed, not estimated. Every one passes:

- **Body and headings** — `ink` on all three grounds: 17.54 / 16.78 / 15.66:1. AAA.
- **Secondary text** — `muted` on all three grounds: 7.03 / 6.73 / 6.28:1. Above the 7:1
  target on page ground; comfortably AA elsewhere.
- **Accent text** — `accent` on all three grounds: 6.20 / 5.93 / 5.53:1. AA everywhere.
- **UI boundaries** — `line-strong` on all three grounds: 3.52 / 3.36 / 3.14:1. Clears
  WCAG 1.4.11's 3:1 floor everywhere, including inside a hovered panel.
- **Hover** — `accent-bright` on all three grounds: 9.00 / 8.61 / 8.04:1.
- **Focus ring** — `focus` on all three grounds: 11.70 / 11.19 / 10.45:1.

`--c-line` (1.39:1) and `--c-accent-quiet` (2.74:1) are **decorative only** and are barred
from carrying text or state. Using either as a meaning-bearing boundary is a defect.

**Two things that must never happen to these numbers.** Do not express state with `opacity` —
it multiplies against the ground and takes contrast with it, which is how the `Archived` mark
came to compute at 2.25:1 before it was caught. And do not change a ground without
recomputing every pairing against it; the ladder is only four lightness steps wide, so a
surface that moves takes the whole matrix with it.

---

## Typography

Three families, which is the ceiling. Two would be canonical; the third earns its place
because metadata density is a real requirement — Marcus reads tech arrays and status marks,
and a monospace makes them scannable in a way a proportional face does not.

| Family | Role | Licence | Axes used |
|---|---|---|---|
| **Bricolage Grotesque** | Display, headings, entry names | OFL | `wdth` 75–100, `opsz` 10–48, `wght` 700–800 |
| **Geist** | Body, lede, UI copy | OFL | `wght` 300–600 |
| **Geist Mono** | Metadata, status, plate marks, tech arrays | OFL | `wght` 400 |

All three are open-licence and self-hostable, which is the whole reason they were chosen —
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
| `--t-3xs` | `0.6875rem` / 11px | Status marks, plate marks — **labels only, never prose** |
| `--t-2xs` | `0.75rem` / 12px | Metadata, tech arrays, footer |
| `--t-xs` | `0.8125rem` / 13px | UI copy floor |
| `--t-sm` | `0.875rem` / 14px | **Body floor.** No prose sets smaller. |
| `--t-base` | `1rem` / 16px | Lede, entry names |
| `--t-md` | `1.25rem` / 20px | Section headings |
| `--t-lg` | `1.5625rem` / 25px | — |
| `--t-xl` | `1.9531rem` / 31px | Secondary display |
| `--t-2xl` | `2.4414rem` / 39px | — |
| `--t-display` | `clamp(2.25rem, 9vw, 4.5rem)` | The one display line per page |

**Display cap 4.5rem.** Below hallmark's 5.5rem ceiling deliberately — display sets in
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

- **CSS Grid for page structure, Flexbox inside components.**
- **`gap` for sibling spacing.** `margin` is reserved for optical correction and for breaking
  flow.
- **The row is the unit at every width.** The Suite Directory is a list with rules, not a
  card grid. At ≥760px it gains columns; it never reflows into cards. There is no second
  layout to maintain — which is the point, for a solo maintainer across eight repositories.
- **Section padding varies.** Uniform vertical rhythm across every section is a tell. The
  narrative handoff sits tighter than the directory; the directory sits tighter than the
  footer.
- **`html, body { overflow-x: clip }`** globally. `clip`, not `hidden` — `hidden` breaks
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

Not "shadows used sparingly" — none. On a `oklch(12%)` ground a shadow is either invisible or
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
| Hover | Existing underline recoloured to `var(--token-accent-hover)` | Hover, exclusively. Width never changes — width is a layout property |
| Focus | `2px solid var(--token-focus)`, `3px` offset | Focus-visible, everywhere, no exception |

Rules are **1px and opaque**. Never a 4–6px coloured side-stripe on one edge; never an alpha
white.

---

## Shapes

**Square. `--r-DEFAULT: 0`.**

The plate is the metaphor and a plate has corners. Zero radius is also the single most
reliably federated shape value in the estate — it is the one number that cannot drift when
six frameworks each apply their own defaults, because there is nothing to round.

| Token | Value | Used for |
|---|---|---|
| `--r-none` | `0` | Everything structural |
| `--r-hair` | `2px` | Focus ring outline only, so the ring does not read as a hard box |
| `--r-pill` | `999px` | The 4px `Live` dot. Nothing else. |

A Satellite whose framework applies a default radius to form controls **overrides it to `0`**.
This is the most common single-line fix in the per-app hand-fix list
([`EXPERIENCE.md`](EXPERIENCE.md) § Seams Inventory).

---

## Components

Visual specification only. Behaviour, states and interaction contracts are in
[`EXPERIENCE.md`](EXPERIENCE.md) § Component Patterns.

**Status mark.** Uppercase mono at `--t-3xs`, `+0.14em` tracking, `1px` border,
`--s-2xs`/`--s-xs` padding, square. **Outlined, never filled** — a filled mark spends accent as
a colour block. Per-value treatment is in § Colors, including the 4px dot that carries the
`Live` / `Complete` distinction structurally. `Archived` alone drops the border. Never
expressed with opacity. Not interactive, so the target floor below does not apply to it.

**Hit targets — every interactive element.** `min-height: 44px`, `display: inline-flex`,
`align-items: center`, with `padding-block` making up the difference. **Vertical padding on a
plain inline element does not grow its hit area** — it paints outward without affecting layout
or hit-testing, so an inline link with `padding: 0.25rem 0` measures ~29px tall no matter what
the padding says. This is the single easiest way to miss the floor while appearing to meet it,
and it is why the rule names `inline-flex` rather than just naming a number.

Where two targets sit on one line — the live and source links on an entry — they take
`--s-lg` of gap so the 44px boxes cannot overlap. Where a target is narrow, such as a two-letter
nav label, `padding-inline` brings it to 44px wide as well as tall.

**Registry Entry.** A grid row, never a card. Entry name in Bricolage `wdth 85` / 700
uppercase; status hanging right; description at `--t-sm` in `--token-text-secondary` capped
at `46ch`; tech array in mono `--t-3xs` uppercase; links in mono `--t-2xs` uppercase.
Separated from its neighbour by a `1px` hairline. **No containing box**, so card-in-card
cannot occur — the Tracker Family group is the only containment layer in the entire
directory.

**Tracker Family group.** `1px solid var(--token-border)` on all four sides — the only
containment layer in the directory, and the only place a box is drawn around entries. Group
label in mono `--t-3xs` `+0.14em` uppercase in `--token-accent`; framing line beneath it at
`--t-2xs` in `--token-text-secondary`, capped at `--measure`, closed by a hairline. Member
entries sit inside with their usual separators; the last member drops its bottom rule so it
does not double with the container edge.

**Links.** Live link: `--token-text` with a `--stroke-emphasis` accent underline. Source link:
`--token-text-secondary` with a `--stroke-hair` `--token-border-interactive` underline. The
hierarchy of those two underlines is what lets one entry serve both readers — Daniela's eye
goes to the accent, Marcus knows where the quiet one is. **On hover both underlines become
`--token-accent-hover`**; nothing else moves.

**Button.** `1px solid var(--token-border-interactive)`, no fill, square, mono uppercase
label at `--t-2xs`. On hover the border becomes `--token-accent-hover`. There is no filled
button anywhere in the system.

**Framework band.** Bricolage `wdth 75` / 700 uppercase at `--t-3xs`, framework names
alternating `--token-text-secondary` and `--token-accent-muted`, bounded above and below by
hairlines. Decorative rhythm — it carries no state and is not a legend.

**Plate mark.** Mono `--t-3xs`, `+0.16em` tracking, uppercase, `--token-text-secondary`,
sitting on a hairline. Section identity in the top-left, position or domain top-right.

**Nav.** Wordmark left in Bricolage `wdth 75` / 800; two mono uppercase links right. The
current route carries a **`--stroke-emphasis` (2px) accent underline** — the same weight as an
active link underline everywhere else in the system, so "current" reads identically wherever
it appears. **Two destinations only** — the AI-nav tell is five inline links plus a CTA
button, and this is structurally the opposite.

**Suite Switcher panel.** `--token-bg-raised` ground, `1px` `--token-border-interactive`
boundary, rows separated by hairlines, hover ground `--token-bg-raised-2`. Each row: app name
in Bricolage `wdth 85`, framework subtitle in mono, external-navigation glyph right.

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
stylesheet, so the moment `tokens.css` is vendored to a different depth in a Satellite —
`assets/css/` in Phoenix, `src/styles/` in Svelte, `src/` in Angular — every font 404s
silently and the app falls back to a system stack that looks almost right. Splitting them
means a Satellite copies the **folder**, and the relative paths inside `fonts.css` stay valid
wherever the folder lands.

### `tokens.css`

```css
/* Cuatro Ecosystem — Design Tokens
 * Contract v1.0.0 · dark only · anchor hue 288
 * Values only. Font files: see fonts.css (same folder).
 * A value change is a MINOR bump. A rename is MAJOR.
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
of *behaviour* the token layer can genuinely federate — a Satellite that adopts the tokens
gets reduced-motion compliance for every token-driven transition without writing a line. It
is the single highest-value thing in this file after the palette, and it is the exception
that proves the rule about behaviour not federating.

### `tailwind.css` — generated adapter

For `cuatro-finance`, `cuatro-tracker` and `cs-tournament`. **Not the Anchor**, which is
SCSS. Mechanical output from Style Dictionary — a build-step cost, not an authoring cost.

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
gives the cluster three named font families and **no `@font-face` for any of them** — every
face falls silently to `system-ui` and the page looks almost right. That is precisely the
failure the three-file split exists to prevent, and it is easier to reintroduce here than
anywhere else, because `tailwind.css` is documented as the cluster's single entry point.

`inline` is **mandatory**, not stylistic. Without it a `var()` reference resolves where the
theme variable is defined rather than where it is used. This system has no `[data-theme]`
override today, so nothing breaks — but the moment one is added, non-`inline` fails
**silently**, and a silent failure across eight repositories with no test suite is the worst
available outcome.

Import order is fixed: `tailwindcss` first, then `tokens.css`, then `fonts.css`, then the
`@theme` block.

### Build

**Style Dictionary 5.5.1** minimum — 5.5.1 patched a prototype-pollution vulnerability in
`convertTokenData`. Do not pin below it. DTCG format **2025.10**. Terrazzo is rejected: its
CLI is `0.7.2`, pre-1.0, and a pre-1.0 entry point under an eight-repository contract is not
a trade worth making.

### Versioning

Per NL Design System convention, inherited from research §D2:

- A **value** change is a **minor** bump. Pixels move; nothing breaks.
- A **rename** is **major**, including fixing a typo in a token name. Contracts break.
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
| **Angular** | Add both files to the `styles` array in `angular.json`. `ViewEncapsulation.Emulated` is a non-issue — it stops component styles leaking *out*, not global styles reaching *in* | Trivial |
| **Phoenix LiveView** (`cs-tracker`) | **Vendor all three files** into `assets/css/`. `@import` `tokens.css` + `fonts.css` for raw consumption, **and** apply the `@theme` adapter — see below | Not trivial. The one adopter that needs both artefacts |

**`cs-tracker` is a Tailwind consumer, and the table above nearly hid that.** Phoenix 1.8.0
ships **Tailwind v4 plus daisyUI** in the generated application. Research §D2 is explicit that
a plain external file defining custom properties under `:root` **generates zero utility
classes** — `bg-accent` will not exist in a Phoenix app any more than in `cuatro-finance`.

So the "Tailwind cluster" is not `cuatro-finance` / `cuatro-tracker` / `cs-tournament`. It is
those three **plus `cs-tracker`** — which is the Step 2 adopter that FR-18 is measured on. A
contract that files Phoenix under plain-CSS consumption would have sent Epic 1's first visible
ecosystem moment down a path that silently produces no utilities.

Vendoring remains Phoenix's own sanctioned pattern — the v1.8.0 installer commits
`daisyui.js` (251,614 bytes) into the app and upgrades it via `curl` comments in `app.css`.
Three more files is the identical mechanism.

**Verify before Step 2:** confirm which Phoenix version `cs-tracker` is actually on. Below
1.8.0 the daisyUI layer may be absent and the plain-CSS path is then correct. The version
determines which of the two adoption routes applies, and it is a one-line check.

**One thing to settle empirically before Step 2 ships,** carried forward from research §D2:
whether `@plugin "daisyui/theme" { --token-primary: var(--token-accent); }` accepts a
`var()` reference. Undocumented either way. The documented fallback is plain CSS —
`[data-theme="x"] { --token-primary: var(--token-accent); }`. Cheap to test in a scratch
`mix phx.new`, and **`cs-tracker` being the Step 2 adopter is what front-loads this while it
is still cheap to discover.**

---

## Migrating the Anchor from SCSS to tokens

`cuatro-portfolio` ships at v2.5.3. This is a reshape of a working site, and the migration
surface is genuinely small — the entire token surface today is **twelve custom properties in
one file**, consumed by **twelve component stylesheets**.

### What exists

[`app/app.scss`](../../../../app/app.scss) holds all of it:

```scss
:root {
  --white-color: #fff;              --black-color: #000;
  --light-gray-color: #b3b0aa;      --gray-color: #545454;
  --page-padding: clamp(1.5rem, 4vw, 3rem);
  --hero-height: 40vh;
  --font-regular: 'GeneralSans-Regular';   --font-bold: 'GeneralSans-Bold';
  --confillia-normal: 'Confillia Normal';  --confillia-bold: 'Confillia';
  --monument-regular: 'MonumentExtended-Regular';
  --monument-bold: 'MonumentExtended-Bold';
}
```

Plus `app/scss/_fonts.scss` (self-hosted `@font-face`), `app/scss/_print.scss`,
`app/scss/_index.scss`, and **twelve** component stylesheets under
`components/atoms|molecules|organisms/`.

Colour values outside `app.scss` sit in **eleven places**, and they are not all hex —
`HomeLayout.scss:122` uses the bare keyword `color: white`, which a hex-and-`rgba` sweep
misses entirely. Grep for `white`, `black` and named colours as well as `#` and `rgba(`.

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
| `--font-bold` | `--f-body` + `--w-bold` | **Weight, not family.** A family-only alias silently drops bold — see below |
| `--monument-regular` | `--f-display` + `--w-bold` | Monument Extended → Bricolage Grotesque |
| `--monument-bold` | `--f-display` + `--w-black` | Same; the weight distinction must survive the alias |
| `--confillia-normal` | `--f-display` at `wdth 75` | **Two live call sites** — `HomeLayout.scss:8` and `:246`. Needs a target, not a deletion |
| `--confillia-bold` | **dropped** | Zero call sites. Safe to delete outright |

**The alias trick has one trap.** The old properties are *family* aliases, and two of them
encode weight in the family name — `--font-bold`, `--monument-bold`. Aliasing them to a family
alone drops the weight, so `ErrorPage.scss:14` and `HomeLayout.scss:284` would silently render
regular where they render bold today. Bricolage and Geist are variable, so the fix is to set
`font-weight` alongside `font-family` at each of those call sites during step 6 — but the
regression lands at **step 2**, before step 6 exists to fix it.

Either accept two call sites rendering light for one commit, or handle those two by hand in
step 2. The second is three lines and is what this file recommends.

### Sequence

Each step leaves the site working. NFR-2 binds every one.

1. **Add, do not replace.** Drop `tokens.css` + `fonts.css` into `app/scss/`, `@use` them
   from `_index.scss`. Nothing consumes them yet. The site is byte-identical. *Ship this.*
2. **Alias the old names.** Redefine the ten existing properties as `var()` references to the
   new roles. Every one of the sixteen component stylesheets keeps working untouched, and the
   whole site changes appearance in one commit that touches one file — which is also the one
   commit worth a careful visual check.
3. **Retire the alpha hairlines.** Replace `rgba(255,255,255,0.15)` and
   `rgba(255,255,255,0.3)` in `ProjectCard.scss` and `WorkItem.scss` with
   `var(--token-border)` and `var(--token-border-interactive)`. **Fix the `boder:` typo at
   [`WorkItem.scss:84`](../../../../components/atoms/WorkItem/WorkItem.scss#L84) while you are
   in there** — that border has never rendered.
4. **Sweep the eleven literals.** `#444` and `#fff` in `celeste.scss`, `#fff` in `navbar.scss`,
   the greys in `_print.scss`, and — **easy to miss** — the bare keyword `color: white` at
   `HomeLayout.scss:122`. Grep for named colours, not only `#` and `rgba(`. Print keeps
   `#fff`/`#000`: paper is genuinely white and toner is genuinely black, and the print
   stylesheet is outside the contract by nature.
5. **Swap the type.** New `@font-face` in `fonts.css`, retire `_fonts.scss`, delete the
   General Sans / Monument Extended / Confillia binaries from `public/fonts/`. Apply
   `size-adjust` overrides so the swap does not shift layout.
6. **Rename call sites.** Component stylesheets move from `var(--white-color)` to
   `var(--token-text)`. Purely mechanical; do it per component, not in one commit.
7. **Delete the aliases** from step 2. The contract is now the only source.

Steps 1–2 are **Epic 1 Step 2** and are what FR-18 measures. Steps 3–7 can trail.

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
- Don't define a colour with alpha. `rgba(255,255,255,0.15)` cannot federate.
- Don't use `transition: all`. Name the properties.
- Don't apply `hover:scale-105`, a lift, or a bounce. One signal per element.
- Don't fade every section in on scroll. One orchestrated entrance, then content simply exists.
- Don't invent a metric. If the number was not supplied, the slot does not exist.
- Don't reach for an emoji as an icon.
- Don't write an ad-hoc `z-index`. Six named levels exist.
- Don't set prose below `--t-sm`, or anything below `--t-3xs`.
- Don't rename a token casually. A rename is a **major** contract break across eight repos.
