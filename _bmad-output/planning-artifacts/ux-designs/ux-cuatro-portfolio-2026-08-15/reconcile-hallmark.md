# Reconciliation: `nutlope/hallmark`

Input supplied at intake: <https://github.com/nutlope/hallmark>, named as the reference for
avoiding "AI slop." Read at `skills/hallmark/references/`: `anti-patterns.md`, `color.md`,
`typography.md`, `motion.md`, `layout-and-space.md`.

Treated as a **conformance floor**, not a style source. The visual direction came from the
user; hallmark supplied the constraints it had to survive.

---

## Adopted into the spines

| Hallmark rule | Where it landed |
|---|---|
| OKLCH only; perceptually uniform | `DESIGN.md` § Colors: every value authored in OKLCH, hex is computed fallback |
| One accent, max two, ≤3% of viewport | `DESIGN.md` § Colors → Rules; § Do's and Don'ts |
| Never `#000` / `#fff`; tint toward the anchor hue | `DESIGN.md` § Colors; drives the whole migration table |
| Tint the greys | Every neutral carries chroma 0.005–0.020 at hue 288 |
| Dark paper L 12–18%, ink L 92–96% | `paper` 12%, `ink` 95%, both at the edge of the stated range, deliberately |
| On dark, elevate by lightness not glow | `DESIGN.md` § Elevation & Depth: **no shadows at all**, which goes further than the rule |
| Contrast: body 4.5 min / 7 target, UI boundaries 3:1 | `DESIGN.md` § Colors → Conformance. **Caught two real failures**: see below |
| ≤3 font families; weight gap ≥300 units | `DESIGN.md` § Typography, three families, 500-unit display/lede gap |
| Ratio-based scale, not arbitrary jumps | 1.25 major third from 16px |
| Display LH 1.05–1.2, body 1.5–1.65, measure 45–75ch | `--lh-*` tokens; `--measure: 46ch` |
| Display tracking −0.02…−0.04em, labels +0.08…+0.14em | `--tr-*` tokens (display goes to −0.05em; all-caps needs it) |
| `font-display: swap` + metric overrides | `DESIGN.md` § The Token Contract → `fonts.css`; seam S-10 |
| `tabular-nums` on data | `DESIGN.md` § Typography → Rules |
| Only `transform`/`opacity`; 3 duration tiers; exit ~75% | `--dur-*`, `--dur-exit: 165ms` |
| Exact easing curves | `--ease-entrance/exit/toggle`, verbatim cubic-beziers |
| Reduced motion collapses spatial motion | Inside the Token Contract, so it federates |
| 4pt spacing scale; `gap` not `margin` | `DESIGN.md` § Layout & Spacing |
| Six-level z scale | `--z-*` tokens |
| `overflow-x: clip`, never `100vw` | `DESIGN.md` § Layout & Spacing |
| Focus rings appear instantly, never transitioned | `EXPERIENCE.md` § Interaction Primitives → Focus |
| No hover-only affordances | § Interaction Primitives → Pointer and touch |
| One orchestrated entrance, not universal fade-up | § Interaction Primitives → Motion |
| No invented metrics | `EXPERIENCE.md` § Voice and Tone → Rules |
| Typeset punctuation | § Voice and Tone → Rules |
| Full anti-pattern catalogue | `EXPERIENCE.md` § Inspiration & Anti-patterns |

**Two real defects caught by applying the contrast rule rather than eyeballing:**

- `line-strong` was `oklch(38% …)` = **2.02:1**, failing WCAG 1.4.11's 3:1 floor for UI
  component boundaries, and it carries the Status pill borders, which are meaning-bearing.
  Raised to `oklch(51% …)` = **3.52:1**, verified against all three grounds.
- `muted` was `oklch(60% …)` = **5.13:1**, passing AA but below the 7:1 body target, and it
  carries the entry descriptions Daniela reads on a phone. Raised to `oklch(68% …)` =
  **7.03:1**.

Both would have shipped unnoticed. Neither is visible by eye.

---

## Deliberately not adopted

| Hallmark guidance | Why not |
|---|---|
| **Free font defaults** (Fraunces, Newsreader, Instrument Serif, Cabinet Grotesque…) | Direction C was chosen for its width axis, which none of these has. Bricolage Grotesque and Geist are both open-licence and satisfy the actual constraint: vendorable into seven repos including a Phoenix app |
| **Two permitted shadows** (whisper, hairline) | This system has **zero**. On a 12%-lightness ground a shadow is either invisible or reads as a halo, and removing them entirely also removes the most framework-divergent visual property in the estate |
| **Default radius guidance** | Radius is `0` by identity. The plate has corners |
| **Macrostructure routing** (N1–N9 nav, Ft1–Ft8 footer variants) | Sized for generating varied marketing sites. This is one hub plus seven satellites under one identity; deliberate sameness is the product |
| **Icon library defaults** (Lucide, Phosphor) | The system has no icon set. Three glyphs total |
| **`--space-4xl: 9rem`** | Nine steps is enough for one person to hold in their head. The scale stops at `3xl` |
| **Hero enrichment / imagery kit** | The 3D narrative already exists and is out of scope to redesign |

---

## Nothing dropped silently

No qualitative idea from the input was discarded without a reason above. The one place this
design deliberately **exceeds** hallmark rather than following it is shadows: stated in
`DESIGN.md` § Elevation & Depth with the reasoning attached.
