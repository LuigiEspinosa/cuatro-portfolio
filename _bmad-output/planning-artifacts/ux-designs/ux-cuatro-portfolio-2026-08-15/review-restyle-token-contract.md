---
lens: token-contract
date: 2026-08-15
verdict: do-not-ship
severity-counts:
  critical: 4
  high: 6
  medium: 7
  low: 6
  total: 23
scope:
  - DESIGN.md
  - RESTYLE-SPEC.md
  - EXPERIENCE.md (Component Patterns, Open Items)
  - mockups/redesigned-components.html
  - epics.md (Story 2.28, Epic 6) as corroborating evidence
---

# Token contract conformance review: `--token-scrim` at Contract v1.0.0

Every number below was recomputed from the hex values in `DESIGN.md` § Colors, from first
principles, using the WCAG 2.x relative luminance definition and the standard
`(L1 + 0.05) / (L2 + 0.05)` contrast formula. Nothing was taken from the documents.

**Headline.** The scrim's entire numeric guarantee was computed in the wrong colour space. The
composite ground luminance is not `0.121`, it is `0.01718`. All five contrast ratios published in
the scrim table are wrong, in both spines and in the mockup annotation. One of the five is wrong
even under the run's own (incorrect) method. The minimum-alpha threshold is wrong by a wide margin.
Separately, `epics.md` still instructs a developer to add the role and bump the contract to
`v1.1.0`, which `DESIGN.md` now forbids.

The errors are conservative in direction (the real contrasts are all better than claimed), so
nothing shipped from these numbers would be inaccessible. That is not a reason to ship them. These
numbers are the artifact. They are hand-copied into seven repositories, they are quoted as a
guarantee in three files, and they impose a binding layout constraint on `HomeLayout` that the
correct arithmetic does not support.

---

## Method, stated up front

**The colour space question, answered.** CSS alpha compositing is defined by the CSS Compositing
and Blending specification to run in the device colour space. For an ordinary page that is
**gamma-encoded (non-linear) sRGB**. A browser painting `background: oklch(12% 0.011 288 / 0.88)`
over a white backdrop converts the colour to sRGB, then blends the **8-bit encoded** channel
values, not the linear-light ones. Every composite figure in this report is computed in
gamma-encoded sRGB, and where the linear-light figure is shown it is labelled as such and given
only to demonstrate what the run actually did.

**WCAG relative luminance**, for reference:

```
c_srgb = channel / 255
c_lin  = c_srgb / 12.92                      when c_srgb <= 0.04045
c_lin  = ((c_srgb + 0.055) / 1.055) ^ 2.4    otherwise
L      = 0.2126 * R_lin + 0.7152 * G_lin + 0.0722 * B_lin
```

---

## Critical

### CRIT-1. The composite ground luminance is computed in linear-light space. It is `0.01718`, not `0.121`

**Where:** `DESIGN.md` § The scrim ("the scrim's effective ground computes to a relative luminance
of `0.121`"); `RESTYLE-SPEC.md` § The scrim (identical sentence).

**Step 1: luminance of `--c-paper`, `#060509`.**

```
R = 6   -> 6/255  = 0.0235294118  (<= 0.04045) -> 0.0235294118 / 12.92 = 0.0018211618
G = 5   -> 5/255  = 0.0196078431  (<= 0.04045) -> 0.0196078431 / 12.92 = 0.0015176349
B = 9   -> 9/255  = 0.0352941176  (<= 0.04045) -> 0.0352941176 / 12.92 = 0.0027317428

L = 0.2126 * 0.0018211618 = 0.0003871790
  + 0.7152 * 0.0015176349 = 0.0010854126
  + 0.0722 * 0.0027317428 = 0.0001972318
L(#060509) = 0.0016698234
```

All three channels fall under the `0.04045` knee, so paper is entirely in the linear segment of the
sRGB transfer function. This matters: it is exactly the regime in which "blend the luminances" and
"blend the channels" give wildly different answers.

**Step 2: composite over pure white at alpha 0.88, in gamma-encoded sRGB (what browsers do).**

```
c_out = 0.88 * c_src + 0.12 * 255

R = 0.88 * 6 + 30.6 = 5.28 + 30.6 = 35.88
G = 0.88 * 5 + 30.6 = 4.40 + 30.6 = 35.00
B = 0.88 * 9 + 30.6 = 7.92 + 30.6 = 38.52
```

Every channel is now well above the `0.04045` knee, so the power segment applies:

```
R: 35.88/255 = 0.1407058824 -> ((0.1407058824+0.055)/1.055)^2.4 = 0.1855032061^2.4 = 0.01753856
G: 35.00/255 = 0.1372549020 -> (0.1822321327)^2.4                              = 0.01680631
B: 38.52/255 = 0.1510588235 -> (0.1953164204)^2.4                              = 0.01984811

L = 0.2126 * 0.01753856 = 0.00372870
  + 0.7152 * 0.01680631 = 0.01201987
  + 0.0722 * 0.01984811 = 0.00143303
L(composite) = 0.01718160
```

**Answer to 4 significant figures: `0.01718`.** Space used: **gamma-encoded sRGB**, which is the
space browsers actually composite in.

For completeness, if the browser rounded to 8-bit integers first (`rgb(36, 35, 39)`) the answer is
`0.01724`. The claim is wrong by roughly a factor of seven either way.

**Step 3: proof the run composited in linear-light space.** Blending luminances directly is
algebraically identical to compositing in linear light:

```
L = 0.88 * L(paper) + 0.12 * L(white)
  = 0.88 * 0.0016698234 + 0.12 * 1.0
  = 0.0014694446 + 0.12
  = 0.1214694
```

That is `0.121` to three significant figures, matching the documents exactly. The run took the
luminance of paper and alpha-blended it against `1.0`. That is the definition of compositing in
linear light, and browsers do not do it.

**Consequence.** Every number in the scrim table, the alpha threshold in CRIT-2 and HIGH-1, and the
binding rules derived from them all inherit this error.

---

### CRIT-2. All five contrast ratios in the scrim table are wrong

**Where:** `DESIGN.md` § The scrim (table), `RESTYLE-SPEC.md` § The scrim (identical table),
`redesigned-components.html` (token comment line 31, doc prose, and the `.ann` annotation at C3),
`RESTYLE-SPEC.md` § 4 Focus treatment ("Over the scrim (§ 8) it computes to 3.53:1").

Foreground luminances, recomputed from the palette hexes:

```
#eeeef2  R_lin=G_lin=0.855993  B_lin=0.887923   L = 0.858298
#c6bdff  R_lin=0.564713  G_lin=0.508881  B_lin=1.0        L = 0.556210
#98979f  R_lin=0.311964  G_lin=0.310446  B_lin=0.348959   L = 0.313137
#8f7ef0  R_lin=0.275582  G_lin=0.208068  B_lin=0.871309   L = 0.270527
#ada1ff  R_lin=0.418895  G_lin=0.355121  B_lin=1.0        L = 0.415937
```

These are validated against the document's own on-paper figures, which they reproduce to within
rounding: ink `(0.858298+0.05)/(0.0016698+0.05) = 17.58` against a claimed 17.54; muted `7.03`;
accent `6.20`; accent-bright `9.02` against a claimed 9.00; focus `11.73` against a claimed 11.70.
The palette hexes and the on-paper column are sound. Only the scrim column is not.

Contrast against the correct composite ground, `L2 = 0.0171816`, denominator `0.0671816`:

| Token | Hex | Claimed | **Recomputed** | Arithmetic | Claimed verdict | Verdict survives? |
|---|---|---|---|---|---|---|
| `--token-text` | `#eeeef2` | 5.29:1 | **13.52:1** | `0.908298 / 0.0671816` | Permitted | Yes, and by a far wider margin (AAA, not marginal AA) |
| `--token-focus` | `#c6bdff` | 3.53:1 | **9.02:1** | `0.606210 / 0.0671816` | Permitted as non-text | Yes, and it is not marginal at all |
| `--token-text-secondary` | `#98979f` | 2.12:1 | **5.41:1** | `0.363137 / 0.0671816` | Forbidden | **No.** Clears 4.5:1 AA |
| `--token-accent` | `#8f7ef0` | 1.87:1 | **4.77:1** | `0.320527 / 0.0671816` | Forbidden | **No.** Clears 4.5:1 AA |
| `--token-accent-hover` | `#ada1ff` | 1.31:1 | **6.94:1** | `0.465937 / 0.0671816` | Forbidden | **No.** Clears 4.5:1 AA comfortably |

**On the focus ring specifically, since the whole "focus survives over the scrim" claim was staked
on a marginal 3.53:1.** It is not marginal. `--token-focus` computes to **9.02:1** over the
worst-case scrim ground, a factor of three above WCAG 1.4.11's 3:1 floor. The claim is true. The
number supporting it was not, and a reviewer who recomputed 3.53 and found it 0.53 above the floor
would rightly have treated the focus ring as the system's most fragile guarantee. It is one of its
most robust.

**The "worst backdrop" reasoning is itself sound.** For a dark scrim, a brighter backdrop produces
a brighter composite ground, and every one of these five foregrounds is far lighter than the ground
in all cases, so contrast falls monotonically as the backdrop brightens. Pure white is genuinely
the worst case. The framing is right; only the arithmetic underneath it is wrong.

---

### CRIT-3. `--token-accent-hover` at 1.31:1 is wrong even under the run's own incorrect method

The other four claimed figures are internally consistent with the linear-light error. Verify:

```
Using the run's ground, L2 = 0.1214694, denominator = 0.1714694:
  ink    0.908298 / 0.1714694 = 5.297  -> matches the claimed 5.29
  focus  0.606210 / 0.1714694 = 3.535  -> matches the claimed 3.53
  muted  0.363137 / 0.1714694 = 2.118  -> matches the claimed 2.12
  accent 0.320527 / 0.1714694 = 1.869  -> matches the claimed 1.87
  hover  0.465937 / 0.1714694 = 2.717  -> the document claims 1.31
```

**`1.31` is not reproducible by any method.** It is a second, independent error sitting on top of
CRIT-1. The tell is structural and should have been caught by inspection: `--c-accent-bright` is
**brighter** than `--c-accent` (9.00:1 versus 6.20:1 on paper). Over a ground lighter than both, the
brighter foreground must have the **higher** contrast, not the lower. The table places hover below
accent and assigns it the smallest number in the set, which is the opposite of what the physics
requires. The table appears to have been sorted descending and the last cell filled to match the
sort rather than computed.

This error is replicated verbatim in `RESTYLE-SPEC.md` § The scrim and in
`redesigned-components.html` C3 ("accent-hover to 1.31:1").

---

### CRIT-4. `epics.md` still requires adding the role and bumping to `Contract v1.1.0`, which `DESIGN.md` now forbids

`DESIGN.md` § The scrim states: "Story 2.28 **consumes** the role rather than adding it." The
epics file has not been changed to match.

Live text in `epics.md`:

- Line 2921, story title: "Story 2.28: Redesign `ScanlineOverlay` token-native **and add**
  `--token-scrim`".
- Line 2938, binding AC: "**Or** a `--token-scrim` role is added to `contracts/tokens.css` and the
  component consumes it".
- Lines 2941 to 2943, binding AC: "**Given** a role addition is a value change and therefore a
  minor bump under AD-16 / **When** `--token-scrim` lands / **Then** the contract header moves to
  `Contract v1.1.0`".
- Line 2951, binding AC: "**Then** it is recorded as the first of the three hand-copied token
  changes that earn Epic 6".
- `sprint-status.yaml` line 101: the story key is still
  `2-28-redesign-scanlineoverlay-token-native-and-add-token-scrim`.

A developer implementing Story 2.28 from its acceptance criteria will add a token that is already
present and move the contract header to `v1.1.0` for a release containing no value change, in a
contract already vendored into other repositories. `DESIGN.md` claims both downstream consequences
are "recorded rather than absorbed". They are recorded in `DESIGN.md` only, which is not the file
the story is built from.

`sprint-change-proposal-2026-08-15.md` line 375 also still reads "It counts as one of the three
hand-copied token changes that earn Epic 6", though as an approved historical record that is
defensible; the epics file is not.

---

## High

### HIGH-1. The minimum-alpha threshold is `~0.587`, not `0.85`

**Where:** the run asserts alpha `>= 0.85` is where `--token-text` clears 4.5:1 over white, and that
`0.88` was chosen for margin.

**The requirement.** With `L(#eeeef2) = 0.858298`:

```
(0.858298 + 0.05) / (L_ground + 0.05) >= 4.5
0.908298 / 4.5 = 0.2018440 >= L_ground + 0.05
L_ground <= 0.1518440
```

**Solved in gamma-encoded sRGB.** Composite channels are `R = 255 - 249a`, `G = 255 - 250a`,
`B = 255 - 246a`. Evaluating:

```
a = 0.570 -> rgb(113.07, 112.50, 114.78) -> L = 0.164469 -> contrast = 0.908298/0.214469 = 4.235
a = 0.585 -> rgb(109.34, 108.75, 111.09) -> L = 0.153075 -> contrast = 0.908298/0.203075 = 4.473
a = 0.590 -> rgb(108.09, 107.50, 109.86) -> L = 0.149358 -> contrast = 0.908298/0.199358 = 4.556
a = 0.600 -> rgb(105.60, 105.00, 107.40) -> L = 0.142127 -> contrast = 0.908298/0.192127 = 4.728
```

Linear interpolation between `0.585` and `0.590` puts the crossing at **alpha ~= 0.5866**.

**Confirming the run's 0.85 is the same linear-light error.** Under linear blending,
`L = a * 0.0016698 + (1 - a) * 1.0 = 1 - 0.9983302a`. Setting that to the required `0.1518440`
gives `a = 0.848156 / 0.9983302 = 0.8496`, which rounds to the claimed `0.85`. The threshold and
the composite luminance are the same mistake, twice.

**Does 0.88 leave adequate margin?** Yes, overwhelmingly, but the documented safety story is
fiction. The documents present `0.88` as three points of headroom over a `0.85` cliff. The real
headroom is roughly **0.29 in alpha**, and the contrast delivered is **13.52:1 against a 4.5:1
requirement**, three times the floor. Anyone tuning the scrim later against the stated `0.85` floor
would believe the value is near a cliff edge that is nowhere near it.

### HIGH-2. `#060509e0` is not alpha 0.88, and the palette table presents it as the equivalent value

**Where:** `DESIGN.md` frontmatter `scrim: '#060509e0'`; `DESIGN.md` § Colors palette table, sRGB
column, which the file itself describes as "the computed sRGB fallback".

```
0.88 * 255 = 224.4          -> not an integer, so 0.88 is not expressible as 8-bit alpha
0xE0       = 224            -> 224 / 255 = 0.8784313725...
```

`e0` is the **nearest** 8-digit hex to 0.88 (224.4 rounds to 224), so the choice is right, but the
conversion is **lossy**: `#060509e0` encodes alpha `0.87843137`, a shortfall of `0.4/255` or
`0.00157` against the authored `0.88`. Two values that the palette table presents as the same value
are not the same value.

The practical effect on contrast is negligible (composite luminance moves from `0.017182` to
roughly `0.017328`, and ink contrast from 13.52:1 to 13.49:1). The problem is not the pixel, it is
that a contract hand-copied into seven repositories publishes a hex fallback that does not equal the
authored value, and offers no note saying so. The nearest lossless alternatives are `0.87843137`
(`e0`), `0.88235294` (`e1`) or a stated rounding note.

### HIGH-3. Binding rule 2 and the `HomeLayout` layout constraint rest entirely on the wrong numbers

**Where:** `DESIGN.md` § The scrim rule 2 and § Components "Home surface"; `RESTYLE-SPEC.md`
§ The scrim rule 2; `EXPERIENCE.md` § Component Patterns "Scrim layer" and "Home surface";
`redesigned-components.html` C3.

The argument as written is: "A control needs three legible steps, rest, hover, focus, and only two
survive." That premise required accent (claimed 1.87:1) and accent-hover (claimed 1.31:1) to be
illegible over the scrim. Recomputed, all three steps clear their floors:

```
rest   --token-accent        4.77:1   clears 4.5:1
hover  --token-accent-hover  6.94:1   clears 4.5:1
focus  --token-focus         9.02:1   clears 3:1 (1.4.11) and 4.5:1
```

The stated reason for the rule does not hold. `EXPERIENCE.md` § Component Patterns then converts it
into a hard placement constraint on the largest surface in the redesign: "Interactive content moves
clear of the canvas overlap ... the redesign resolves the overlap by **placement**." That is a real
architectural cost imposed on Story 2.29 on the strength of a computation that is wrong.

The rule may still be **wanted** (a control over moving imagery is genuinely harder to acquire than
one over a static ground, and there are legitimate non-contrast reasons for the constraint). It is
not **derived** from these numbers, and it must be rewritten to say so, or dropped.

### HIGH-4. The FR-17 grep exception names a token that carries no alpha

**Where:** `RESTYLE-SPEC.md` § The scrim: "It applies to `--token-scrim` and to no other property.
Story 2.34's FR-17 conformance grep must permit this one declaration inside `contracts/` and must
still reject alpha anywhere else". Repeated in `DESIGN.md` § Rules and § Do's and Don'ts, both of
which also name `--token-scrim`.

In `tokens.css` the two declarations are:

```css
--c-scrim:     oklch(12% 0.011 288 / 0.88);   /* this line carries the alpha */
--token-scrim: var(--c-scrim);                 /* this line carries no alpha at all */
```

The exception, as written, permits the line with no alpha in it and says nothing about the line that
has one. A gate implemented literally from this instruction rejects the contract file itself at
`--c-scrim`. This is the single instruction Story 2.34 has to implement, and it points at the wrong
symbol in all three places it appears.

### HIGH-5. The FR-17 gate has at least four uncovered collisions the run introduced and did not flag

Story 2.34's gate is described in `DESIGN.md` § Sequence R8 as "no colour, spacing or type literal
outside `contracts/` and `_print.scss`", and in `RESTYLE-SPEC.md` as additionally rejecting alpha
anywhere outside `contracts/`. Newly specified material collides with it:

1. **`opacity` in the display entrance (Story 2.27).** `DESIGN.md` § Components: "a per-character
   reveal on `opacity` only". The mockup implements it as `opacity:0` plus
   `@keyframes rise{to{opacity:1}}`. Under "reject alpha anywhere else" these are alpha
   declarations in Anchor CSS, outside `contracts/`. The design permits opacity for entrance while
   barring it for state; the gate as specified does not know the difference.
2. **`clip-path` notch geometry (Story 2.29).** `DESIGN.md` § Components: "the `clip-path` corner
   cut survives, it is geometry, not an effect". A `clip-path` polygon is a set of length literals,
   the contract mints no token for the notch size, and the gate rejects spacing literals.
3. **`44px` hit targets, everywhere.** `min-height: 44px` and `min-width: 44px` appear in
   `DESIGN.md` § Components, `RESTYLE-SPEC.md` § 1 and floor check F-10. **There is no hit-target
   token in `tokens.css`.** All three mockups had to invent `--tap: 44px` locally precisely because
   the contract does not carry it. Every restyled control therefore ships a spacing literal outside
   `contracts/`.
4. **`font-variation-settings: "wdth" 100 / 85 / 75` and `"opsz" 48 / 24`.** Specified in
   `DESIGN.md` § Typography and § Components and used on the Display entrance, the row name and the
   `Logo` wordmark. These are type literals, no tokens exist for them, and the gate rejects type
   literals.

Items 3 and 4 are pre-existing, but they are restated by every one of the newly specified
components, so R8 will meet them at scale on its first run. Item 1 and item 2 are new with this
run. None of the four is named as an exception anywhere.

### HIGH-6. Shipping at v1.0.0 deletes the AD-16 rehearsal, and the run does not record that consequence

`epics.md` lines 2949 to 2953 make the case explicitly: "**Given** AD-16's change process has never
been exercised / **When** this change ships / **Then** ... the process is rehearsed here on the
cheapest possible change rather than discovered later on an expensive one." The approved change
proposal makes the same point at line 373: "That is a benefit, not a cost."

`DESIGN.md` § The scrim lists exactly two downstream consequences ("Two downstream consequences
follow and both are recorded"): Story 2.28 consuming rather than adding, and Epic 6 losing one of
its three. There is a third, and it is the one the epics file argued was the point. The contract's
change process now goes unexercised until the first change that is not cheap.

---

## Medium

### MED-1. `--c-focus` and `--c-accent-bright` are outside the sRGB gamut, so the hex column is not the authored colour

`DESIGN.md` § Colors: "The hex column is the computed sRGB fallback, not a second source of truth."
For two tokens the hex is not a conversion at all, it is a clip.

Converting `oklch(84% 0.130 288)` through Oklab to linear sRGB:

```
a = 0.130 * cos(288 deg) =  0.04017221
b = 0.130 * sin(288 deg) = -0.12363741
l' = 0.829240   m' = 0.843654   s' = 0.996081
l  = 0.570232   m  = 0.600497   s  = 0.988290
R_lin = 0.566684   G_lin = 0.506523   B_lin = 1.262824   <- B exceeds 1.0 by 26%
```

Naive channel clipping (`B -> 1.0`) yields exactly `#c6bdff`, which is what the document publishes.
Round-tripping `#c6bdff` back into OKLCH gives **`oklch(82.87% 0.0921 290.4)`**: the chroma is 29%
below what was authored, the lightness is 1.1 points low, and the hue has moved 2.4 degrees. The
same check on `oklch(76% 0.145 288)` gives `B_lin = 1.076211`, also out of gamut, also clipped to
`#ada1ff`.

CSS Color 4 specifies gamut mapping by chroma reduction with a deltaEOK threshold, not naive
clipping, and browser implementations have differed on this. A framework that consumes the OKLCH
value and one that consumes the hex fallback can therefore render **different focus ring colours**,
which is precisely the federation failure the contract exists to prevent. The contrast consequences
are small (focus lands near 9:1 over the scrim either way), so this is Medium, not High, but the
palette table should state that these two values are gamut-clipped rather than converted.

### MED-2. The versioning rule has no category for an addition, and two artifacts have already improvised one

`tokens.css` header and `DESIGN.md` § Versioning: "A **value** change is a **minor** bump. A
**rename** is **major**." An addition is neither. `epics.md` line 2941 had to invent the missing
rule ("a role addition is a value change and therefore a minor bump") to write Story 2.28's AC.

Adding `--token-scrim` and `--c-scrim` to `v1.0.0` **before first publication is coherent**: Story
1.11, which publishes the contract, is confirmed `backlog` in `sprint-status.yaml` line 54, so there
is nothing to bump and no consumer to notify. That part of the claim holds. But the rule as written
still cannot answer what happens the next time a role is added after publication, and the first
answer given to that question lives in a story AC rather than in the contract. Add an explicit
"an addition is MINOR" clause.

### MED-3. The mockup's display entrance runs 820ms, not "~500ms"

`DESIGN.md` § Components, `EXPERIENCE.md` § Component Patterns and the mockup's own C3 prose all say
the entrance is "capped at ~500ms total". `redesigned-components.html` line 120:

```css
.disp span{ animation:rise var(--dur-minor) ...; animation-delay:calc(var(--i) * 40ms) }
```

with sixteen spans, `--i` running 0 to 15 (line 275):

```
last delay     = 15 * 40ms = 600ms
plus duration  =            220ms   (--dur-minor)
total          =            820ms
```

That is 64% over the stated cap. Either the cap is wrong or the stagger step is. Note also that
`40ms` is a motion literal with no token behind it, and that the cap itself (`~500ms`) is not a
token, so the constraint cannot be enforced by anything.

### MED-4. The mockup uses `--c-scrim` as a label background over a static ground, violating scrim rules 1, 3 and 4

`redesigned-components.html` line 197:

```css
.strike span{ ... color:var(--c-ink); background:var(--c-scrim); border:1px solid var(--c-line-strong); ... }
```

This is the "retired effect" strike-through label. It uses the scrim as a **surface treatment on a
static ground**, which the spec forbids three separate ways: "Between **moving imagery** and text,
exclusively. Never a surface" (`DESIGN.md` role table), rule 3 "The scrim is never a surface
treatment. Not a card ground", and rule 5 "It is present only where text overlays moving imagery.
On a static ground it is absent, not faint" (`EXPERIENCE.md`). The reference render that Epic 8
implementers copy from breaks the role's own boundary on its first use outside the demo.

### MED-5. The mockup's two headline self-descriptions are both false

Line 12 to 14 header comment: "THE TOKEN SET, identical to key-screens.html and
secondary-screens.html, plus ONE addition: `--c-scrim`. ... **Nothing below hardcodes a value.**"
Repeated in the visible doc-head, line 207.

- **Not one addition.** `--measure: 46ch`, `--tr-label: 0.14em` and `--tr-meta: 0.09em` are present
  in `redesigned-components.html` and absent from `key-screens.html`. Four additions, not one. (The
  three mockup token blocks are not identical to one another in the first place, which the claim
  presumes.)
- **Values are hardcoded.** Line 79 and line 93 paint `oklch(8% 0.008 288)`, a ground that exists in
  no palette. Line 194 uses `#0a000f` and `rgba(140,90,210,.06)`. Line 195 uses `#b4b4cc`,
  `rgba(255,0,80,.75)` and `rgba(0,255,255,.75)`. Lines 192 to 193 use `rgba(0,0,0,.65)` and
  `rgba(0,0,0,.12)`, which is `#000` at alpha, explicitly named as forbidden by scrim rule 4. Most
  of these sit in page chrome or in deliberately-retired-effect demos, which is defensible, but the
  blanket claim is not, and R8's grep will not distinguish demo CSS from product CSS.

### MED-6. The mockup's work-item focus ring uses a negative outline offset

`redesigned-components.html` line 168:

```css
.wi__hd:focus-visible{ outline:... ; outline-offset:calc(var(--focus-offset) * -1); ... }
```

`DESIGN.md` § Components declares `focus-ring: 2px solid focus, 3px offset` and § Elevation states
`Focus: 2px solid var(--token-focus), 3px offset, Focus-visible, everywhere, **no exception**`.
`RESTYLE-SPEC.md` § 4 gives the one block every Satellite hand-copies as
`outline-offset: var(--focus-offset)`. The reference render inverts the sign on one component
without naming it as a variant. Five independent implementers reading the mockup and the spec get
two different rings.

### MED-7. `EXPERIENCE.md` and the mockup disagree on which O-12 item 3 branch is likely

`EXPERIENCE.md` line 555: "**Branch B is the likely outcome and the cheaper fix is to make branch A
true.**" `redesigned-components.html` C7 annotation, line 514: "**Branch A is the likely outcome
and the cheaper fix is to make it true.**" These are opposite predictions. Story 2.30 runs a test
either way so nothing breaks, but the two artifacts cannot both be the guidance.

---

## Low

### LOW-1. The alpha exception's boundary differs between its four statements

| Location | Statement | Boundary asserted |
|---|---|---|
| `DESIGN.md` § Rules | "`--token-scrim` is the single named exception" | By token. No file scope, no grep instruction |
| `DESIGN.md` § The scrim | Rules 1 to 5; rule 4 says "never `#000` at any alpha" | Does not restate the alpha exception's boundary at all |
| `DESIGN.md` Do's and Don'ts | "`--token-scrim` is the one named exception and it is the only one" | By token. No file scope |
| `RESTYLE-SPEC.md` § The scrim | "applies to `--token-scrim` and to no other property ... permit this one declaration **inside `contracts/`** ... reject alpha anywhere else, including any hand-written `rgba()` that reproduces it" | By token **and** by directory, plus an explicit anti-reproduction clause |

Only `RESTYLE-SPEC.md` scopes the exception to `contracts/` and only it bars hand-reproducing the
value with `rgba()`. A reader of `DESIGN.md` alone would conclude the exception is a property of the
token and would be entitled to write the literal wherever the token is used. All four also name the
wrong token, per HIGH-4. Fold the RESTYLE-SPEC wording back into both DESIGN.md statements.

### LOW-2. The contract mints no hit-target token although all three mockups need one

`--tap: 44px` appears in `key-screens.html` line 31, `secondary-screens.html` line 41 and
`redesigned-components.html` line 34. It appears nowhere in `DESIGN.md` § The Token Contract. Three
renders independently invented the same missing token, which is the strongest possible signal that
the contract is short one value. See HIGH-5 item 3 for the gate consequence.

### LOW-3. `secondary-screens.html` uses the `--color-*` namespace the contract reserves for Tailwind

Lines 82, 91, 106, 108, 114 and 124 read `var(--color-text)` and `var(--color-text-secondary)`.
`DESIGN.md` § Semantic roles devotes a paragraph to why the base namespace and Tailwind's
`--color-*` namespace **must differ**, warning that collision produces a self-reference that
"falls back to `transparent`". `DESIGN.md` line 190 describes this file as "rendered from the
identical token block, introducing no new tokens", which is not the case. Outside this run's scope,
but it is a token-contract conformance defect in a linked reference render.

### LOW-4. The Story 2.28 tracking key still says "and add token scrim"

`sprint-status.yaml` line 101. Renaming a story key churns tracking, so this may be deliberate, but
it should be reconciled or annotated alongside the CRIT-4 fix so the key does not remain the last
surviving statement that the role is added.

### LOW-5. "Epic 6 loses one of its three" is loose framing

A change that is never performed was never one of the three. The framing is defensible against the
plan of record (`epics.md` line 2951 and `sprint-change-proposal-2026-08-15.md` line 375 both banked
it), but "the plan of record must be corrected" is the accurate statement, and it is the one that
would have surfaced CRIT-4.

### LOW-6. `err__num` sets a type literal off the scale and above the display cap

`redesigned-components.html` line 184: `font-size:clamp(3.5rem,14vw,7rem)`. `DESIGN.md`
§ Typography sets a display cap of `4.5rem` and states the reason (all-caps at larger sizes wraps
into a wall on a 390px viewport). `7rem` is 56% above that cap and is not on the `--t-*` scale. The
numeral is a decorative glyph rather than the display line, so the cap arguably does not bind it,
but no token or exception covers it and R8 will reject the literal.

---

## What must change before this ships

1. **Recompute and republish the scrim table** in `DESIGN.md` § The scrim, `RESTYLE-SPEC.md` § The
   scrim, `RESTYLE-SPEC.md` § 4, and `redesigned-components.html` C3, with the composite ground at
   `0.01718` and the five ratios at 13.52 / 9.02 / 5.41 / 4.77 / 6.94. State the compositing space
   explicitly so the next reader can check the work.
2. **Rewrite the alpha threshold sentence.** The threshold is `~0.587`; `0.88` is a comfort choice,
   not a margin over a cliff.
3. **Re-derive or re-justify scrim rules 1 and 2.** With correct numbers, secondary text, accent and
   accent-hover all clear 4.5:1 over the scrim. If the restrictions stay, they need a reason that is
   not contrast.
4. **Fix the grep instruction** to name `--c-scrim`, and add the four uncovered FR-17 collisions
   (opacity keyframes, `clip-path` geometry, `44px`, `wdth` and `opsz`) as either exceptions or new
   tokens.
5. **Amend `epics.md` Story 2.28** so its title and its three ACs stop requiring an addition, a
   `v1.1.0` bump and an Epic 6 credit, and record the lost AD-16 rehearsal where Epic 6's trigger is
   defined.
6. **Correct or footnote `#060509e0`**, and mark `--c-focus` and `--c-accent-bright` as
   gamut-clipped rather than converted.
