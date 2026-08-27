# Accessibility review: Cuatro Ecosystem UX spine pair

**Lens:** accessibility · **Target:** WCAG 2.1 AA · **Date:** 2026-08-15
**Scope:** `EXPERIENCE.md`, `DESIGN.md`, `mockups/key-screens.html`, `mockups/directions-4.html`,
against `prds/prd-cuatro-portfolio-2026-08-15/prd.md` (NFR-5, NFR-6, FR-3, FR-7, FR-10).

---

## Overall verdict

**Conditional: the spine is sound, the reference implementation is not shippable as the thing seven satellites copy.**

Two things are true at once and they pull in opposite directions.

The **written contract is unusually rigorous** and its arithmetic is real. I recomputed all ten
OKLCH tokens to sRGB and all fifteen stated pairings from relative luminance. Every one of the
fifteen is correct to within ±0.03, and every hex in the palette table is the exact computed
sRGB value. The claim "computed, not estimated" survives audit. That is rarer than it sounds.

But `mockups/key-screens.html` is not a diagram: the design documents call it a *reference
render*, EXPERIENCE.md calls the focus section "what gets copied," and the whole federation
thesis is that satellites hand-copy this file's rules. Audited as code, it **fails four things
its own Accessibility Floor promises** (A-4 targets, A-8 semantics, A-1 focus coverage, and
the Archived contrast that § Colors never computed), and **two claims in the spine documents
are false as built**: the Status-by-border-style taxonomy, and the framework band's colour.

Severity here is weighted by the brief's own rule: a defect the Hub propagates by being copied
is worse than a local one. On that scale, the 44px target failure and the Archived opacity
failure are both defects that would be replicated eight times over.

The floor itself is well-chosen. The gap is between the floor and the demonstration of it.
Every finding below is cheap to fix at this stage and expensive to fix after seven satellites
have copied it.

---

## Method note: the contrast arithmetic

All values recomputed independently: OKLCH → OKLab → linear sRGB → 8-bit sRGB (clamped, sRGB
transfer function) → WCAG 2.x relative luminance → `(L1+0.05)/(L2+0.05)`.

| Token | Authored | Computed sRGB | DESIGN.md sRGB | Y |
|---|---|---|---|---|
| `paper` | `oklch(12% .011 288)` | `#060509` | `#060509` ✔ | 0.001670 |
| `surface` | `oklch(16% .013 288)` | `#0d0c13` | `#0d0c13` ✔ | 0.003955 |
| `surface-high` | `oklch(20% .014 288)` | `#16151c` | `#16151c` ✔ | 0.007907 |
| `line` | `oklch(28% .015 288)` | `#282830` | `#282830` ✔ | 0.021821 |
| `line-strong` | `oklch(51% .020 288)` | `#656471` | `#656471` ✔ | 0.130733 |
| `muted` | `oklch(68% .012 288)` | `#98979f` | `#98979f` ✔ | 0.313118 |
| `ink` | `oklch(95% .005 288)` | `#eeeef2` | `#eeeef2` ✔ | 0.857370 |
| `accent` | `oklch(66% .165 288)` | `#8f7ef0` | `#8f7ef0` ✔ | 0.270526 |
| `accent-quiet` | `oklch(46% .110 288)` | `#564c91` | `#564c91` ✔ | 0.091917 |
| `focus` | `oklch(84% .130 288)` | `#c6bdff` | `#c6bdff` ✔ | 0.556210 |

The fifteen stated pairings, recomputed (claimed → computed):

| Pairing | paper | surface | surface-high |
|---|---|---|---|
| `ink` | 17.54 → **17.56** | 16.78 → **16.82** | 15.66 → **15.67** |
| `muted` | 7.03 → **7.03** | 6.73 → **6.73** | 6.28 → **6.27** |
| `accent` | 6.20 → **6.20** | 5.93 → **5.94** | 5.53 → **5.54** |
| `line-strong` | 3.52 → **3.50** | 3.36 → **3.35** | 3.14 → **3.12** |
| `focus` | 11.70 → **11.73** | 11.19 → **11.24** | 10.45 → **10.47** |

**All fifteen confirmed.** None computed against a wrong background. The only systematic
drift is `line-strong`, overstated by ~0.02 on all three grounds: immaterial to the pass, but
it puts `line-strong` on `surface-high` at **3.12:1**, only 4% above the 1.4.11 floor. That is
the tightest margin in the system and it is the token that carries every meaning-bearing
boundary, so it has no room left for a future lightness tweak.

The refutations below are all about pairings the conformance matrix **did not compute**:
opacity-composited values, `accent-quiet` used as text, and `line` used as a meaning-bearing
boundary. The matrix is correct about what it covers; its coverage is the problem.

---

## Findings

### Critical

- **[critical]** **`Archived` at 70% opacity fails both 1.4.3 and 1.4.11, and the conformance
  matrix never computed it.** `.st.arch{opacity:.7}` composites the *whole element*: border
  and text: against `--c-paper`. Recomputed:
  - text: `muted` #98979f at α=0.7 over #060509 → `rgb(108.2, 107.2, 114.0)`, Y = 0.14973 →
    **(0.14973+0.05)/(0.001670+0.05) = 3.87:1**. This is 11px uppercase mono. Normal text.
    **1.4.3 requires 4.5:1. Fail.**
  - border: `line-strong` #656471 at α=0.7 over #060509 → `rgb(72.5, 71.5, 81.8)`, Y = 0.06574 →
    **(0.06574+0.05)/(0.001670+0.05) = 2.24:1**. This border is, by the design's own account,
    the sole non-hue carrier of the Status taxonomy: a meaning-bearing boundary.
    **1.4.11 requires 3:1. Fail, by 25%.**

  DESIGN.md § Colors claims "All fifteen meaningful pairings were computed… Every one passes."
  The Archived pairing is meaningful and was not among the fifteen. DESIGN.md § Components
  specifies the 70% treatment, so the failure is in the *contract*, not just the mockup,
  it propagates to every satellite that renders a status.
  (`DESIGN.md` § Components "Status pill"; `key-screens.html:154`; `key-screens.html:406`)
  *Fix:* stop expressing state with `opacity`. Give `Archived` its own opaque pair,
  e.g. border `--c-line-strong` unchanged (3.50:1) and text `--c-muted` unchanged (7.03:1),
  with the differentiator being a **shape** cue that survives greyscale and forced-colors
  (a hollow 4px square before the label, mirroring `Live`'s filled one). If a faded look is
  non-negotiable, author a dedicated `--c-archived` token at ≥4.5:1 and add it to the matrix.
  Then add a standing rule: **`opacity` may never be applied to text or to a meaning-bearing
  boundary**: alpha is already banned as a colour in § Colors; this is the same argument.

- **[critical]** **Not one interactive element in the reference mockup reaches the stated
  44×44px floor.** A-4 and FR-3 both require it, and EXPERIENCE.md § Registry Entry asserts it
  is "achieved with padding **on the link itself**." Measured from the CSS as rendered:

  | Element | Selector | Rendered target | Verdict |
  |---|---|---|---|
  | Header nav (`CV`) | `.hd nav a` (`key-screens.html:96`) | **≈16 × 26.6px** | fail |
  | Header nav (`Suite`) | `.hd nav a` | ≈41 × 26.6px | fail |
  | Entry live / source link | `.ent .links a` (`:143`) | ≈47 × **29.2px** | fail |
  | Hub's own `Source` | `.ent .here a` (`:316`) | ≈47 × **~16px** (zero padding) | fail |
  | Skip control | `.skip` (`:121`) | ≈180 × **37.2px** | fail |
  | Switcher trigger | `.sw-btn` (`:162`) | ≈78 × **35.6px** | fail |
  | Footer nav | `.ft nav a` (`:180`) | ≈30–110 × **~21px** | fail |
  | Switcher row | `.sw-panel a` (`:166`) | full-width × ≈66px | **pass**: the only one |

  Arithmetic for the entry link, the one the brief flags: `.ent .links` is `display:flex`, so
  its `<a>` children *are* blockified and vertical padding *does* apply: the parent brief's
  suspicion about inline hit-testing is not the failure mode here. The failure is simpler:
  `12px × 1.6 line-height = 19.2px` content + `2 × var(--s-2xs)` = 8px padding + 2px
  `border-bottom` = **29.2px**. To reach 44 you need ~11.4px vertical padding, which would
  detach the 2px accent underline from the text and break the component's whole look.
  The Hub's own `Source` link (`:316`) is worse: it sits inside `<p class="here">`, not
  inside `.links`, is a bare inline with **no padding at all**, and its hit box is the ~16px
  em box.

  This is the highest-propagation defect in the file: FR-3's tap-target consequence is one of
  only two testable consequences it has, NFR-5 makes touch users primary, and the pattern gets
  copied eight times.
  *Fix:* `min-height` rather than padding, so the box grows without moving the underline:
  `.ent .links a{display:inline-flex;align-items:flex-end;min-height:44px}` and
  `.hd nav a{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px}`
  with the `aria-current` underline moved to an `::after` so it still hugs the text. Same for
  `.skip`, `.sw-btn`, `.ft nav a`. Give `.ent .here a` the `.links a` rules rather than an
  inline `style=` override. Then add a fifth item to the § Accessibility Floor verification
  list: *measure* the targets, don't assert them, this is the check that would have caught it.

### High

- **[high]** **The Status-by-border-style claim is refuted: `Live` and `Complete` have the
  same border style and differ only by hue.** EXPERIENCE.md § Status mark and DESIGN.md
  § Colors both state the taxonomy is "carried by **border style**, not hue" and is therefore
  "legible in greyscale… and in print, with no legend." In the actual CSS, `.st` is
  `1px solid var(--c-line-strong)` and `.st.live` changes only `color` and `border-color`
  (`key-screens.html:150–152`). Both are 1px solid. In greyscale (i.e. relative luminance):
  - `Live` label Y = 0.2705 vs `Complete` label Y = 0.3131 → separation **1.13:1**. Effectively
    identical, and `Live` is the *darker* of the two.
  - `Live` border Y = 0.2705 vs `Complete` border Y = 0.1307 → separation **1.77:1**. Weak.

  What actually separates the two marks without colour is the 4px `::before` square, which the
  documents never credit, plus the word. FR-7 is satisfied: by the **word**, which is the
  right answer. The problem is that the spine documents claim a redundant visual channel that
  does not exist, and seven satellite authors will copy that belief. `Archived` is worse:
  after the opacity fix above it would be visually *identical* to `Complete`.
  (`EXPERIENCE.md` § Component Patterns → Status mark; `DESIGN.md` § Colors → Semantic roles)
  *Fix:* either make the claim true or retire it. Making it true is cheap and consistent with
  the identity: give each value a distinct **mark shape** before the label, `Live` filled 4px
  square (exists), `Complete` hollow 4px square, `In progress` a 4px square at 45°, `Archived`
  a 4px horizontal bar: all in the same token colour. Shape survives greyscale, all forms of
  colour-blindness, monochrome print *and* forced-colors, which border-colour does not. Then
  rewrite both documents to say "carried by mark shape and the word, reinforced by border
  style", which is honest and still federates as a single CSS rule.

- **[high]** **DESIGN.md § Components specifies `--color-accent-muted` as text in the framework
  band: 2.75:1, and its own palette table forbids it.** § Components reads: "framework names
  alternating `--color-text-secondary` and `--color-accent-muted`." `accent-quiet` #564c91 on
  `paper` = **(0.091917+0.05)/(0.001670+0.05) = 2.75:1**, set at `--t-3xs` (11px). Normal text;
  1.4.3 needs 4.5:1. **Fail.** The same document's palette table says `--c-accent-quiet` is
  "Decorative accent at rest: **never text**," and § Colors → Rules says "Using either as a
  meaning-bearing boundary is a defect." Three statements inside one file, two of which
  contradict the third.

  The mockup gets this right: `.band em{color:var(--c-accent)}` = 6.20:1 (`key-screens.html:118`).
  But **DESIGN.md declares itself the winner on conflict with any mock**, so the failing
  version is currently normative. A satellite author implementing from the spec ships the
  failure; one implementing from the mock does not. That divergence is itself the defect.
  (`DESIGN.md` § Components → "Framework band"; contradicted at `DESIGN.md` § Colors palette table)
  *Fix:* change § Components to `--color-text-secondary` / `--color-accent`, matching the mock.
  Add `accent-quiet` on all three grounds (2.75 / 2.63 / 2.45) to the conformance matrix as an
  explicitly-failing, decoration-only row: a matrix that lists only passes cannot be used to
  check a proposed usage.

- **[high]** **`role="menu"` on the switcher panel is invalid ARIA and contradicts the stated
  keyboard model.** `<div class="sw-panel" role="menu">` contains six `<a href>` (role `link`)
  and one `<p>` (`key-screens.html:444–451`). `role="menu"` requires owned children of role
  `menuitem` / `menuitemradio` / `menuitemcheckbox`; it has none, so `aria-required-children`
  fails outright and AT announces a menu with zero items. Separately, `menu` implies the
  application keyboard model: roving `tabindex`, arrow keys as the *only* navigation, Tab
  exits and closes, which directly contradicts EXPERIENCE.md § Keyboard: "`Tab` from the last
  row leaves the panel normally: it is a disclosure, not a trap." The document is right about
  the behaviour and wrong about the role.

  **Resolution: this is a navigation disclosure, not a menu.** Every row is a link to a
  different origin (FR-14 makes full navigation the whole point); menus are for application
  *actions*. Dropping `role="menu"` also deletes the arrow-key/`Home`/`End` roving-tabindex
  requirement from EXPERIENCE.md § Keyboard, which is exactly the class of behaviour § Seams
  Inventory S-5 says does not federate, and which would otherwise have to be reimplemented
  correctly in six frameworks. Removing it makes the pattern *cheaper* as well as correct.

  Three smaller defects in the same panel: it has **no accessible name** despite A-15 ("the
  panel is labelled"); the trigger has `aria-expanded` but no `aria-controls`; and the
  "You are here" row is `<a href="#" aria-current="true">` when EXPERIENCE.md § Suite Switcher
  item 6 says the current application "is **not** a link."
  (`key-screens.html:442–452`; `EXPERIENCE.md` § Keyboard, § Suite Switcher, A-15)
  *Fix:*
  ```html
  <button class="sw-btn" aria-expanded="false" aria-controls="suite-panel">…</button>
  <nav id="suite-panel" class="sw-panel" aria-labelledby="suite-panel-h">
    <p class="ph" id="suite-panel-h">Part of the Cuatro Ecosystem</p>
    <ul>
      <li><span aria-current="true">…Digital Library… You are here</span></li>
      <li><a href="https://tracker.cuatro.dev">…<span aria-hidden="true">↗</span>…</a></li>
    </ul>
  </nav>
  ```
  Keep `Escape` → close + restore focus. Delete the arrow-key/`Home`/`End` clause from
  EXPERIENCE.md § Keyboard. Every `↗` glyph needs `aria-hidden="true"` plus text in the
  accessible name ("Cuatro Tracker: opens tracker.cuatro.dev"), or the external-navigation
  signal that FR-14 depends on reaches sighted users only.

- **[high]** **The demonstrated markup contradicts A-8, A-10 and A-6, and the mockup is the
  reference, so the stated floor is the part that will not be copied.** Against § Accessibility
  Floor:
  - **A-8** ("Directory is a `<ul>`; Family group a nested `<ul>` with an accessible name"):
    the Directory is `<div class="sd">` of `<div class="ent">` (`:271–318`). No list, so AT
    gets no item count: "6 running" is visible text only. The Family group is `<div class="fam">`
    labelled by `<p class="fh">Tracker Family</p>`: a paragraph, not a heading, with **no
    programmatic relationship** to the group it names and no group role. FR-11's entire
    containment semantic is unavailable non-visually. (Ironically, rejected Direction A in
    `directions-4.html:209–225` used a real `<table>` with `<th>` and had better structure
    than the direction that was chosen.)
  - **A-10** ("Source links carry an accessible name naming the application"): six links whose
    accessible name is exactly `Source`, no `aria-label`, no `aria-labelledby`
    (`:252, 278, 288, 294, 302, 309, 316`). A screen-reader link list shows six identical
    entries. 2.4.4 in-context rescue does not apply: the enclosing `<p class="links">` names
    the domain, not the app. This is FR-10's requirement and it is not demonstrated once.
  - **A-6** ("Skip-link is the first tabbable element"): there is **no skip link anywhere in
    the file**. There is also no `<main>`, no `<header>`, no `<footer>` element, and two
    `<nav>` elements with no distinguishing `aria-label` (`:214`, `:321`).
  - Links are wrapped in `<p class="links">`: a paragraph containing two navigation links.
  (`key-screens.html:248–318`; `EXPERIENCE.md` § Accessibility Floor A-6, A-8, A-10)
  *Fix:* rebuild the S3 device markup as the semantic reference:
  `<a class="skip-link" href="#main">` first in DOM → `<header>` → `<main id="main">` →
  `<section aria-labelledby="suite-h"><h2 id="suite-h">The Suite</h2><ul>…<li class="ent">` →
  Family as `<li><ul aria-labelledby="fam-h">` with `fh` promoted to `<h3 id="fam-h">` →
  links as `<ul class="links"><li>` → `<a href="…" >Source<span class="vh">: Digital Library</span></a>`.
  Add `<nav aria-label="Primary">` / `<nav aria-label="Secondary">`. None of this changes a
  pixel; all of it is what the satellites need to copy.

- **[high]** **The Tracker Family boundary is drawn in `--c-line` (1.39:1), the token
  DESIGN.md explicitly forbids for meaning-bearing boundaries.** `.fam{border:1px solid var(--c-line)}`
  (`key-screens.html:132`). `line` #282830 on `paper` = **(0.021821+0.05)/(0.001670+0.05) = 1.39:1**.
  DESIGN.md § Colors: "`--c-line` (1.39:1) … **decorative only** and … barred from carrying
  text or state. Using either as a meaning-bearing boundary is a defect." The family box is
  the *only* containment layer in the entire directory and is the sole visual carrier of FR-11
  Daniela's step 6, "the shape of the thing lands," is this rectangle. At 1.39:1 on a phone
  in daylight it is not there. Every other structural boundary in the file correctly uses
  `line-strong`: `.sd-h` (`:128`), `.sw-panel` (`:164`), `.skip` (`:121`), `.st` (`:150`).
  The family box is the one that got the wrong token, and it is the one that matters most.
  *Fix:* `.fam{border:1px solid var(--c-line-strong)}`: 3.50:1, clears 1.4.11. Keep
  `--c-line` for the internal `.fn` divider and the `.ent` separators, which genuinely are
  decorative. Add a lint note to § Do's and Don'ts: any boundary that answers "what is this
  a group *of*?" is `--color-border-interactive`.

- **[high]** **Two interactive elements have no focus style, and the focus ring: the single
  most-copied rule in the system: is hardcoded rather than tokenised.** The focus *spec* is
  correct and complete in prose: `:focus-visible` only, 2px/3px, never transitioned, never
  removed, ≥3:1. And I confirm the "never transitioned" claim holds in the actual CSS,
  every `transition` in the file names `color` and/or `border-color` only, never `outline`
  and never a focus-gain `box-shadow`. But:
  - **`.sw-btn` has no `:focus-visible` rule** (`key-screens.html:162`). It is a `<button>`,
    so it falls back to the UA ring today, but the very first line of any satellite's reset
    (`*{outline:none}`, ubiquitous in the Tailwind and Angular clusters) deletes it silently.
  - **`.ent .here a` has no `:focus-visible` rule** (`:316`). `.ent .links a:focus-visible`
    does not match it (it is inside `.here`, not `.links`) and it carries an inline
    `style="…text-decoration:none"`. This is the **Hub's own Source link**, the one entry
    that exists to prove FR-10 has no exceptions.
  - `--stroke-focus` and `--focus-offset` exist in DESIGN.md's `tokens.css` but are **absent
    from the mockup's `:root`**; `outline:2px solid var(--c-focus);outline-offset:3px` is
    literally hardcoded five times (`:99, 123, 146, 158, 182`). The file's own headline claim
    "Nothing hardcodes a value": is false precisely where it matters most. (Same for
    `--dur-exit`, `--stroke-*`, `--measure`, `--lh-*`, `--tr-*`, `--w-*`, all of which the
    mockup hardcodes.)
  *Fix:* add `--stroke-focus:2px; --focus-offset:3px` to the mockup's `:root`, then define the
  ring **once** and share it:
  `.hd nav a, .skip, .sw-btn, .sw-panel a, .ft nav a, .ent a { &:focus-visible{ outline: var(--stroke-focus) solid var(--c-focus); outline-offset: var(--focus-offset); border-radius: var(--r-hair) } }`
  one rule, selector-listed, is what a satellite can copy verbatim. Add the missing tokens
  to the block so the mockup and `tokens.css` are actually the same contract.

- **[high]** **At 200% text zoom the mobile entry grid overflows, and `overflow-x: clip` makes
  the overflow unreachable: 1.4.4 with content loss.** `.ent{grid-template-columns:1fr auto}`
  (`key-screens.html:137`). The `1fr` track has `min-width:auto`, so its floor is the h3's
  min-content width; the `auto` track is sized to the status pill's max-content and `.st` sets
  `white-space:nowrap`. At a 32px root (200%), inside `.fam` at a 360px viewport:
  - container = 360 − 2×32 (`.sd` pad) − 2×32 (`.fam` pad) − 2 (border) = **230px**
  - `Complete` pill = 8 glyphs × (0.6em + 0.14em tracking) × 22px + 32px padding + 2px border
    ≈ **166px**; `In progress` ≈ 215px
  - h3 min-content ("ECOSYSTEM", 9 glyphs, Bricolage wdth 85) ≈ **158px**
  - required = 158 + 32 gap + 166 = **356px > 230px** → 126px of overflow, **even at MVP**
    where `In progress` never renders.

  `html,body{overflow-x:clip}` (`:68`) then makes it unrecoverable: `clip` suppresses the
  scrollbar *and* blocks programmatic scrolling, so overflowed content cannot be reached by any
  means. DESIGN.md's reasoning for preferring `clip` over `hidden` (sticky positioning) is
  correct, but the consequence is that every future overflow bug becomes silent content loss
  rather than a visible scrollbar. Note the **desktop** grid already guards this,
  `.d .ent{grid-template-columns:minmax(0,15rem) minmax(0,1fr) auto}` (`:188`), so the
  mobile-first design is the unguarded one.
  (`key-screens.html:68, 137`; `DESIGN.md` § Layout & Spacing)
  *Fix:* `grid-template-columns: minmax(0,1fr) auto` on `.ent`, matching what `.d .ent`
  already does; and drop `white-space:nowrap` from `.st` above a container-width threshold, or
  let the status take its own grid row below ~30rem. Scope `overflow-x:clip` to the specific
  containers that need it (the narrative section) rather than `html, body`, and add
  "360px at 200% text zoom" as a fifth item on § Accessibility Floor's verification list,
  the current list checks 360px at 100% only, which is why this passes today.

- **[high]** **Nothing addresses lenis + ScrollTrigger, and the reduced-motion answer stops at
  the 3D asset.** A-14 (`aria-hidden`, not focusable) is necessary and not sufficient: it
  covers the canvas *element* and says nothing about the scroll mechanism wrapped around it.
  The Anchor uses lenis smooth-scroll plus GSAP ScrollTrigger (§ Asset Budget names both).
  Four unaddressed hazards, none mentioned in § Accessibility Floor or § Interaction Primitives:
  1. **lenis is not scoped to the motion preference.** The design says reduced-motion takes the
     non-3D path and the narrative "is never requested, never decoded", but nothing says lenis
     itself is not initialised on that path. A reduced-motion user who avoids the 3D scene and
     still gets rAF-driven momentum scrolling has had their preference half-honoured, and
     smooth-scroll is a first-order vestibular trigger independently of any 3D.
  2. **Focus-driven scroll fights the rAF loop.** When Tab moves focus to an off-screen
     element, the browser calls scroll-into-view; lenis's loop overwrites the scroll position
     on the next frame. Inside a pinned ScrollTrigger this can leave focus permanently
     off-screen: a 2.4.7 failure that reads to the user as a keyboard trap even though focus
     is technically moving.
  3. **Keyboard scrolling is not intercepted by lenis by default**, so Space / PageDown /
     arrows jump natively while the wheel eases, and inside a `scrub` pin they skip the whole
     narrative or land mid-pin with the DOM in an intermediate state.
  4. `aria-hidden` alone does not remove descendants from the tab order. If the canvas or its
     fallback content contains anything focusable, it stays reachable and now has a hidden
     accessible name: the worst combination.
  (`EXPERIENCE.md` A-14, § Interaction Primitives → Reduced motion, § Asset Budget)
  *Fix:* add to the floor, as named requirements the satellites can check:
  **A-17**: smooth-scroll (lenis) is initialised only when `matchMedia('(prefers-reduced-motion: reduce)').matches`
  is false, and is destroyed if it flips; **A-18**: while any ScrollTrigger pin is active,
  keyboard scroll keys and `scrollIntoView` are delegated to lenis (`lenis.scrollTo`) so the
  two never fight; **A-19**: every ScrollTrigger pin has a keyboard escape: the skip control
  is reachable from inside the pinned region and jumps past it; **A-20**: the canvas carries
  `aria-hidden="true"` **and** `tabindex="-1"` **and** `inert`, and contains no focusable
  fallback. Also state that reduced-motion must never be evaluated only at load: bind a
  `change` listener, because a user who enables the setting mid-session currently gets nothing.

### Medium

- **[medium]** **The reduced-motion token block is the right idea but is not sufficient, and
  1ms is the wrong value for animations specifically.** For `transition-duration`, 1ms is
  defensible and arguably better than 0: it still fires `transitionend`, so JS awaiting that
  event does not hang, which is a real failure mode with `0s`. Keep it for transitions. But
  the block has four gaps:
  1. **No `animation` coverage.** The tokens only reach properties that consume `--dur-*`.
     Nothing collapses `animation-duration`, and critically nothing sets
     `animation-iteration-count: 1`: so any pre-existing infinite animation in a satellite
     becomes a **1ms infinite loop**, i.e. a strobe. That is actively more harmful than the
     unreduced original and is a 2.3.1 flash risk. EXPERIENCE.md bans infinite loops for new
     work, but the token file is being dropped into seven *existing* codebases.
  2. **No `!important`**, so any component-level `transition: transform 300ms` written
     directly (not via a token) is untouched. EXPERIENCE.md is honest that only token-driven
     transitions are covered, but the honesty does not make the gap smaller.
  3. **No `scroll-behavior: auto`**, which is the single highest-value line for this product
     given the skip control is `href="#suite"` and the site uses smooth scroll.
  4. **`--dur-exit` is absent from the mockup's `:root` entirely** while present in DESIGN.md's
     `tokens.css`: the two "contracts" are not the same file.

  On spatial motion: EXPERIENCE.md says "per-app: spatial motion collapses to an opacity
  crossfade," which is the correct answer and correctly scoped as non-federating. But it is
  stated in prose and demonstrated nowhere, so in practice satellites will get transform-based
  motion running at 1ms: a hard snap rather than a crossfade. A hard snap is acceptable under
  2.3.3; it is just not what the document promises.
  (`DESIGN.md` § The Token Contract; `key-screens.html:62–64`)
  *Fix:* keep the token collapse and add the belt-and-braces global to the contract, so it
  federates too:
  ```css
  @media (prefers-reduced-motion: reduce){
    :root{--dur-micro:1ms;--dur-minor:1ms;--dur-major:1ms;--dur-exit:1ms}
    *,*::before,*::after{
      animation-duration:1ms!important;
      animation-iteration-count:1!important;
      transition-duration:1ms!important;
      scroll-behavior:auto!important}
  }
  ```
  Add `--dur-exit` to the mockup's `:root`. Add one worked crossfade example to
  § Interaction Primitives so "collapses to an opacity crossfade" is copyable, not aspirational.

- **[medium]** **`In progress` is not reliably distinguishable from `Complete` at 11px with a
  1px dashed border on a phone, and the dashed border's effective contrast falls below 3:1.**
  `.st.prog{border-style:dashed}` over the base `1px solid var(--c-line-strong)`
  (`key-screens.html:153`): the *only* difference from `Complete` is the dash pattern; colour,
  weight, size and text colour are identical. Dash geometry is UA-defined; Chrome and Firefox
  both land near a 2:1 dash:gap for hairline borders, i.e. duty ≈ 0.67, period ≈ 3 CSS px
  (~0.8mm at phone viewing distance). Averaged over the period, the perceived luminance of the
  line is `0.67 × 0.1307 + 0.33 × 0.00167 = 0.0882` → **(0.0882+0.05)/(0.001670+0.05) = 2.67:1**
  against `paper`. Below 1.4.11's 3:1 for a boundary that carries state. Two consequences:
  the distinction is unreliable for anyone with reduced acuity, and, because dash rendering is
  UA-specific: it is one of the few visual values in the system that **cannot federate**,
  which contradicts § Brand & Style's whole selection criterion ("things a CSS custom property
  can carry"). FR-35 keeps `In progress` unrendered at MVP, which is why this is medium and
  not high; but S5 is the anatomy screen satellites copy, and the moment one entry flips
  status it goes live.
  *Fix:* covered by the mark-shape fix above, a 45°-rotated 4px square carries `In progress`
  at full token contrast and identical rendering in every engine. If the dash is kept for
  flavour, raise it to `2px dashed` so the duty-cycle-averaged contrast clears 3:1, and accept
  that the exact pattern will differ between browsers.

- **[medium]** **S3 and S4 use different DOM orders for the same component, contradicting
  "same markup, one grid change," and the S3 order puts visual order out of sync with DOM at
  desktop (1.3.2).** S3 mobile: `<h3>` → `<span class="st">` → `<p class="desc">`
  (`key-screens.html:275–278`). S4 desktop: `<h3>` → `<p class="desc">` → `<span class="st">`
  (`:345–349`). EXPERIENCE.md § Responsive says "**Same markup**, one grid change," and the
  desktop CSS assigns every child an explicit `grid-column`/`grid-row` (`:189–194`), so both
  DOM orders render identically at ≥760px. That means the reorder is invisible, and if the
  real implementation ships the S3 order (the mobile-first one, per NFR-5), then at ≥760px the
  visual reading order is name → description → status while DOM order is name → status →
  description. Explicit grid placement that reorders content relative to DOM is the textbook
  1.3.2 hazard. It also fractures EXPERIENCE.md's own reading-order contract, which says
  "name → status → description" serves Daniela: true at mobile, false at desktop.
  *Fix:* pick one DOM order (the S3 mobile one, since NFR-5 makes mobile normative) fix both
  mockup screens to it, and re-word § Registry Entry to state the reading order is
  name → status → description **at every width**. Then either place the status in column 3
  row 1 without reordering anything else (it already works), or accept the desktop visual order
  and change the prose. What cannot stand is two mockups disagreeing about the markup that
  eight repositories will copy.

- **[medium]** **`outline-offset: -2px` in the switcher is an undocumented exception to a
  contract that says "no exception," and the +3px default is genuinely unsafe inside panels.**
  `.sw-panel a:focus-visible{outline:2px solid var(--c-focus);outline-offset:-2px}`
  (`key-screens.html:169`) against DESIGN.md § Elevation ("Focus | 2px solid, 3px offset |
  Focus-visible, **everywhere, no exception**"). The `-2px` is the *correct* engineering call
  here: the rows are full-bleed inside a 1px-bordered panel, so a +3px outline would straddle
  the panel border and collide with the adjacent row's ring, and it is not clipped, since
  `.sw-panel` sets no `overflow`. Contrast is fine either way: the inset ring sits on
  `--c-surface` (11.24:1) or `--c-surface-high` on hover (10.47:1). **So `-2px` is not the
  defect; the contract's "no exception" is.** Evidence that this matters: the sibling reference
  `directions-4.html:47` sets `.frame{overflow:hidden}`: exactly the container pattern that
  *would* clip a +3px ring, in a file both spine documents still link as a reference render.
  A satellite author copying "3px offset, no exception" into their own overflow-hidden
  disclosure loses the indicator entirely, which is a 2.4.7 failure.

  Checked the other +3px sites for clipping and they are safe: the sticky header has 16px
  padding (`:93`), `.sd` has 16px (`:127`), `.ft` has 16px (`:177`), and no ancestor of any of
  them clips. Only the switcher was at risk, and it was already handled.
  *Fix:* make the exception a rule rather than a silent deviation. In EXPERIENCE.md
  § Interaction Primitives → Focus and DESIGN.md § Elevation: "`outline-offset: 3px` by
  default; `-2px` on full-bleed rows inside a bordered container, where a positive offset would
  cross the container boundary. Never `0`, which reads as a border." Add `--focus-offset-inset: -2px`
  to `tokens.css` so the exception is a token, not a magic number copied by hand.

- **[medium]** **The skip control targets a non-focusable `<div>`, so it moves scroll but not
  focus, which is exactly what EXPERIENCE.md promises it will not do.** `<a class="skip" href="#suite">`
  (`key-screens.html:221`) targets `<div class="sd" id="suite">` (`:271`). A `<div>` with no
  `tabindex` is not focusable; modern browsers set the sequential-focus-navigation starting
  point there, so the *next* Tab lands in roughly the right place, but focus itself never moves
  and nothing is announced. EXPERIENCE.md § Skip control states it "**Moves focus**, not just
  scroll position, to the Suite Directory heading": the heading, specifically, which is
  `<h2>The Suite</h2>` and is not the anchor target. Same defect will apply to the missing
  accessibility skip-link (A-6) when it is added.
  *Fix:* move the `id` to the heading and make it programmatically focusable without adding it
  to the tab order: `<h2 id="suite" tabindex="-1">The Suite</h2>`, and add
  `:focus{outline:none}` + `:focus-visible{…ring…}` so a mouse user does not see a ring on a
  heading. Apply the identical pattern to `<main id="main" tabindex="-1">` for A-6.

- **[medium]** **The sticky header will obscure elements that receive focus by keyboard.**
  `.hd{position:sticky;top:0;z-index:var(--z-sticky)}` (`key-screens.html:93`), ~59px tall.
  When Tab moves focus to an element just below the viewport top, the browser scrolls it flush
  to the top: underneath the header. This is 2.4.11 Focus Not Obscured, which is **2.2 AA and
  therefore outside the stated 2.1 target**: but it is a genuine keyboard-usability defect,
  it will be worse once lenis is in play (finding above), and it is one CSS line to prevent.
  EXPERIENCE.md § Nav correctly argues the header must not hide on scroll; that decision is
  what creates the obligation.
  *Fix:* `:root{scroll-padding-top: 4.5rem}`: one line, federates through `tokens.css`, and
  it fixes the skip control's landing position at the same time. Worth adding to the floor as
  A-21 since every satellite with a sticky header inherits the problem.

- **[medium]** **The Status mark has no programmatic identity: it is a bare `<span>` floating
  between the heading and the description.** `<h3>Digital Library</h3><span class="st live">Live</span>`
  (`key-screens.html:249`). A screen reader announces "Digital Library, heading level 3" then,
  as loose text, "Live", with nothing indicating that "Live" is this entry's *status* rather
  than part of the name or a stray label. FR-7 requires Status be "a visually distinct element
  on every entry"; it is silent on the non-visual channel, but A-3's premise ("Status legible
  without colour") should extend to "Status identifiable without sight." The 4px `::before`
  square is `content:""` and correctly contributes nothing (`:152`), so no defect there.
  *Fix:* `<p class="st live"><span class="vh">Status: </span>Live</p>` with a visually-hidden
  utility, or `<span class="st live" aria-label="Status: Live">Live</span>`. Prefer the first,
  `aria-label` on a `<span>` with no role is unreliably supported, and the visually-hidden
  prefix also fixes the greyscale/print case for free.

- **[medium]** **No `forced-colors` pass, and forced-colors is where this design's two
  redundancy channels both collapse.** Windows High Contrast Mode overrides `color`,
  `background-color`, `border-color` and `outline-color` with system colours while preserving
  `border-style` and `opacity`. Consequences for this specific system: `Live`'s accent border
  and `Complete`'s `line-strong` border become the **same** system colour, so the hue channel
  is gone; `Archived`'s `opacity:.7` survives and now fades a system colour, which is the one
  case where the fade is *most* likely to fall below the OS's own contrast guarantee; the live
  link's 2px accent underline and the source link's 1px `line-strong` underline become
  indistinguishable, collapsing the two-tier link hierarchy that DESIGN.md § Components says
  "is what lets one card serve both readers"; and `outline-color: var(--c-focus)` is replaced
  by `Highlight`, which is fine, but only if the ring is an `outline` and not a `box-shadow`
  (it is: good). For a public hiring-audience site whose author states accessibility is not
  optional, and a design whose entire premise is dark-only with no light theme, skipping
  forced-colors is a real gap.
  *Fix:* add to `tokens.css` so it federates:
  ```css
  @media (forced-colors: active){
    .st{border-color:CanvasText;forced-color-adjust:none;opacity:1}
    .st.live{border-color:Highlight;color:Highlight}
    :focus-visible{outline-color:Highlight}
  }
  ```
  and add A-22: "verified in forced-colors mode" as a fifth manual check, it is as cheap as
  the greyscale check already on the list.

- **[medium]** **`directions-4.html` is still linked as a "Reference render" from both spine
  documents but contains the rejected reduced-motion answer and no focus styles at all.**
  Both `EXPERIENCE.md` and `DESIGN.md` link it under "Reference renders." It shows, four times,
  `<p class="fallback">Reduced motion: narrative replaced by a **still frame**</p>`
  (`directions-4.html:226, 266, 304, 340`), which is precisely the option EXPERIENCE.md § IA
  records as **closed and rejected** ("Q7 is closed… No static poster frame of the 3D scene is
  produced"). It also has zero `:focus-visible` rules across all four directions
  (`.A .lk a`, `.B .lk a`, `.C .lk a`, `.D .lk a`), uses `opacity:.62` to express state in the
  fallback strip (reinforcing the pattern that fails in finding 1) and Direction C's status
  pill is bordered in `--line` at ~1.3:1 (`:141`), the defect that was fixed in `key-screens.html`
  for `.st` but not for `.fam`. An implementer told "these are the reference renders" gets the
  wrong reduced-motion answer and no focus model.
  *Fix:* relabel the link in both spine documents as "Superseded, direction exploration only,
  not a conformance reference," or add a banner to the top of `directions-4.html` itself. It
  has archival value; it just must not be described as a reference for a file that satellites
  copy.

### Low

- **[low]** **`--c-focus` is spec'd as "Focus rings, exclusively" and then used for hover.**
  DESIGN.md § Colors semantic roles: `--color-focus` → "Focus rings, exclusively." But
  EXPERIENCE.md § State Patterns says hover is "the link's underline brightens to
  `{color.focus}`," and the mockup implements it (`.ent .links a:hover{border-bottom-color:var(--c-focus)}`,
  `key-screens.html:145`). A hovered link and a focused link then share the same colour on
  adjacent properties, which slightly muddies the one signal each state is allowed.
  *Fix:* either relax the token's stated exclusivity to "focus rings and the hover underline,"
  or use `--c-ink` for the hover brighten: it is brighter still (17.56:1) and keeps `focus`
  meaning exactly one thing.

- **[low]** **`--t-xs` is commented "14px floor for body copy" but is 13px, and `.hub`'s base
  font-size is set to it.** `--t-xs: 0.8125rem; /* 14px floor for body copy */`
  (`key-screens.html:35`): 0.8125rem is **13px**; the 14px token is `--t-sm`. DESIGN.md's
  scale table has this right ("`--t-xs` 0.8125rem / 13px: UI copy floor"; "`--t-sm` 0.875rem /
  14px: **Body floor**"), so this is a comment error in the copied artifact, not a spec error.
  But `.hub{font-size:var(--t-xs)}` (`:89`) makes 13px the Hub's inherited base, one step below
  A-11's stated 14px body floor. In practice almost every descendant sets its own size, so
  little prose actually renders at 13px: the risk is a satellite inheriting the base for real
  copy on the strength of a comment that says it is 14px.
  *Fix:* correct the comment to `/* 13px, UI copy floor, not prose */` and set
  `.hub{font-size:var(--t-sm)}`.

- **[low]** **`color-scheme: dark`: item #1 on the hand-fix list, is absent from the
  reference mockup.** EXPERIENCE.md § Seams S-11 and § Responsive & Platform both require
  `color-scheme: dark` on `:root` in every satellite, and it heads "The hand-fix list, in
  order" as the highest return per line. `key-screens.html` never sets it. It has genuine
  accessibility weight beyond scrollbars: it is what makes native form controls, `<select>`
  popups and the browser's own UI render dark rather than blazing white on a near-black page.
  *Fix:* add `color-scheme: dark` to the mockup's `:root` block. It is one line and the file
  is supposed to be the proof that the contract is sufficient.

- **[low]** **`aria-current="page"` on an in-page anchor.** `<a href="#" aria-current="page">Suite</a>`
  (`key-screens.html:214, 239, 270, 341`): `Suite` resolves to `#suite` on the homepage, not
  to a separate page, so `page` is the wrong token; `aria-current="true"` or `location` is
  closer. EXPERIENCE.md § Nav specifies `aria-current="page"` generically. Minor, but it is
  announced on every screen.
  *Fix:* `aria-current="true"` for the in-page `Suite` link; keep `page` for `/cv`.

- **[low]** **All-caps is applied to every label in the system including the 11px tracked mono
  Status mark, with no escape hatch.** DESIGN.md § Typography: "Uppercase is structural…
  Display, headings, entry names, all mono labels." That is a defensible identity decision and
  prose is correctly exempt. But `Live` / `Complete` / `In progress` / `Archived` render as
  11px uppercase mono at +0.14em: the smallest, most tracked, least word-shaped text in the
  product, carrying FR-7's entire payload. All-caps removes ascender/descender word shape and
  measurably slows reading for dyslexic and low-vision readers; at 11px that cost is at its
  maximum. It compounds every other Status finding above. (`text-transform` does not affect the
  accessible name in Chrome or Firefox, so AT is unaffected: this is a low-vision and
  cognitive issue, not a screen-reader one.)
  *Fix:* not a WCAG failure and not worth losing the identity over, but bump the Status mark
  specifically from `--t-3xs` (11px) to `--t-2xs` (12px) and reduce its tracking from `+0.14em`
  to `+0.09em` (the `--tr-meta` value). It stays unmistakably part of the system, gains real
  legibility at the one place legibility is load-bearing, and costs ~12px of row width, which
  finding 9's `minmax(0,1fr)` fix absorbs.

- **[low]** **Reduced-motion is treated as a load-time decision.** EXPERIENCE.md § State
  Patterns: "`prefers-reduced-motion` → Non-3D path. Never requested, never decoded." Correct
  and good, but a user who enables the OS setting *during* a session (often precisely because
  the motion made them unwell) gets no relief until reload, and there is no reload prompt.
  *Fix:* one `matchMedia(...).addEventListener('change', …)` that tears down lenis and any
  active ScrollTrigger. Folded into A-17 above; noted separately because it also applies to the
  non-3D path where lenis may still be running.

- **[low]** **The mockup loads fonts from Google Fonts, contradicting the contract it
  demonstrates.** `<link href="https://fonts.googleapis.com/css2?…">` (`key-screens.html:9`)
  against DESIGN.md § The Token Contract, which requires self-hosted `@font-face` in a separate
  `fonts.css` with `font-display: swap` plus `size-adjust` / `ascent-override` /
  `descent-override` "so a swap does not shift layout." The accessibility consequence is that
  the mockup cannot demonstrate the no-layout-shift behaviour it promises, and a satellite
  copying the `<link>` inherits a third-party render-blocking request plus an unmitigated FOUT
  layout shift during load being a real problem for anyone using magnification or reading
  slowly. Not a conformance failure; a fidelity gap in the artifact that is supposed to be
  the proof.
  *Fix:* note in the mockup's `doc-head` that the CDN link is a preview convenience and that
  production uses `fonts.css`; or vendor the woff2 subsets alongside the file.

---

## What holds

Stated in one line each, as requested: these were tested and are correct:

- **All fifteen contrast pairings in DESIGN.md § Colors are confirmed** to within ±0.03, and all ten hex values are the exact computed sRGB of their OKLCH source.
- **`ink`, `muted`, `accent` and `focus` clear their targets on all three grounds** with real margin (15.67–17.56, 6.27–7.03, 5.54–6.20, 10.47–11.73).
- **The focus ring is never transitioned**: every `transition` in `key-screens.html` names only `color` and `border-color`; no `outline`, no focus-gain `box-shadow`. The § Interaction Primitives rule holds in the actual CSS.
- **`:focus-visible` is used throughout, never bare `:focus`**: no mouse-click rings anywhere.
- **A-5 holds at 360px at 100% text size, including the longest Status value.** Worst case is `In progress` inside the Family group: pill ≈107.5px + 16px gap + h3 min-content ≈62px = 185.5px against 294px available. No horizontal scroll, no truncation. (It is 200% zoom that breaks it, finding 9.)
- **Type is authored in `rem` throughout the product CSS** (A-12); the only `px` values are in the harness chrome and in 2px optical nudges.
- **`transition: all` appears nowhere**; every transition names its properties, as § Interaction Primitives requires.
- **No `@keyframes`, no infinite animation, no scroll-triggered fade-up, no non-token motion** exists in the mockup: the "one orchestrated entrance, then content simply exists" rule is respected by the reference.
- **`z-index` is always a named token**; no ad-hoc value anywhere.
- **The switcher row is the one target that passes 44px** (≈66px tall) and shows the pattern the other seven targets should follow.
- **`--c-line` and `--c-accent-quiet` are correctly identified as decorative-only** in DESIGN.md, with the right numbers (1.39:1, 2.75:1), the failures above are misuses of that correct rule, not errors in it.
- **The Status *word* satisfies FR-7 without a legend** for every reader including screen-reader users. The taxonomy itself is sound; only the claimed visual redundancy is overstated.

---

## Summary

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 8 |
| Medium | 9 |
| Low | 7 |
| **Total** | **26** |

The two critical findings and five of the eight high findings live in `key-screens.html` or in
DESIGN.md § Components: i.e. in the artifacts that seven satellites copy by hand. Weighted by
the brief's own propagation rule, fixing the reference mockup is worth more than everything
else on this list combined, and none of the fixes above changes the design's appearance in any
way a reviewer would notice.
