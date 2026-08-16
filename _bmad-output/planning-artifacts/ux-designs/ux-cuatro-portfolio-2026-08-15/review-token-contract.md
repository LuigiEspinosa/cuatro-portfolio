# Token Contract — adversarial conformance review

**Lens:** token-contract conformance, adversarial.
**Target:** `DESIGN.md` § The Token Contract, § Migrating the Anchor from SCSS to tokens;
`EXPERIENCE.md` § Foundation, § Seams Inventory; `mockups/key-screens.html`.
**Benchmarks:** research §D2 (lines 479–786), PRD §4.4 FR-16–FR-19, addendum §C.1/§C.2, and the
Anchor's SCSS on disk.
**Date:** 2026-08-15.

**Severity rule applied:** downstream impact across eight repositories, not fix difficulty.
A defect confined to the Anchor's own migration caps at **high** by construction, because it
lands in one repository with a human watching. A defect that ships silently into the Tailwind
cluster or into every vendored copy is **critical** even where the fix is one character.

---

## Verdict

**The contract does not hold. Do not hand-copy it in its current form.**

The palette is sound and independently verifiable — I recomputed five of the fifteen contrast
pairings from the sRGB hexes and every one matched the table to two decimal places, and the
OKLCH lightness values are consistent with the stated hexes. The versioning semantics, the
Style Dictionary / DTCG version claims, and the Angular consumption claim are all faithful to
research §D2. The `boder:` typo is real and is exactly where the spine says it is.

What fails is the **distribution layer** — the three files as published, and the per-framework
table that tells eight repositories how to consume them. Three defects there are silent,
cross-repository, and land in Epic 1 Step 2:

1. The `@theme inline` adapter maps two of its seven colour keys to **themselves**, which is
   not what research §D2 prescribes and is not what `inline` is for.
2. `cs-tracker` — the named Step 2 adopter, the application FR-18 is measured on — is placed
   in the plain-`tokens.css` row, when research §D2 states that Phoenix 1.8.0 ships **Tailwind
   v4 plus daisyUI** and that a plain `:root` file generates **zero** utilities there.
3. `tailwind.css` imports `tokens.css` and never `fonts.css`, so the Tailwind cluster's
   documented one-line adoption produces a system that names three typefaces and loads none of
   them — the exact "404s silently and falls back to a system stack that looks almost right"
   failure the three-file split was invented to prevent, reproduced inside the contract's own
   example file.

The SCSS migration path is closer to working, but its step 2 — the single commit DESIGN.md
identifies as "the one commit worth a careful visual check" — has three concrete breaks against
the files on disk, and the file counts it cites are wrong in three places.

**Findings: 3 critical · 6 high · 8 medium · 9 low.**

---

## Attack results at a glance

| # | Attack | Result |
|---|---|---|
| 1 | Six-framework consumability (FR-16) | **Fails** for Phoenix (C-2, H-1). Angular claim correct. Next/Vite/Svelte/Vue hold. |
| 2 | The 3-file split | **Rationale is false** (H-2); split introduces a new failure mode (C-3). Does not contradict §D2. |
| 3 | The `@theme inline` adapter | **Fails.** Self-reference on 2 of 7 colour keys (C-1). |
| 4 | `oklch()` with no fallback | **Holds** on Baseline status; degradation is not graceful and the doc misdescribes it (L-5). |
| 5 | Dark-only, no `[data-theme]` | Mandate is moot today; keeping `inline` is reasonable **but self-defeating as named** (C-1). |
| 6 | The SCSS migration path | **Fails** at steps 2, 4 and 6 (H-4, H-5, H-6, M-1, M-2, M-3). Step 3's typo claim verified. |
| 7 | Versioning | **Holds** — matches §D2 verbatim. Two latent renames present (M-5, M-6). |
| 8 | SD 5.5.1 / DTCG 2025.10 | **Holds.** Minor evidence-grade drift only (L-6). |
| 9 | Producible by Style Dictionary | **Fails.** Reduced-motion block and both `clamp()` tokens are not emittable from a DTCG source by stock SD (H-3). |

---

## Critical

**[critical] The `@theme inline` adapter maps two colour keys to themselves — `--color-bg: var(--color-bg)` and `--color-accent: var(--color-accent)` — which is a direct self-reference, not the bridge research §D2 specifies** (`DESIGN.md` § `tailwind.css` — generated adapter, lines 608–622; specifically line 609 `--color-bg:         var(--color-bg);` and line 615 `--color-accent:     var(--color-accent);`).

Research §D2 line 650 gives the shape: `@theme inline { --color-brand: var(--token-brand) }` —
**two distinct namespaces**, a theme key on the left and a contract token on the right. The
adapter as written collapses the namespaces on two of its seven colour lines while renaming the
other five (`--color-surface: var(--color-bg-raised)`, `--color-ink: var(--color-text)`,
`--color-muted: var(--color-text-secondary)`, `--color-line: var(--color-border)`,
`--color-line-strong: var(--color-border-interactive)`). That inconsistency is the signature of
a hand-authored slip, and it falsifies the file's own header claim that it is "**Mechanical
output from Style Dictionary**" (line 602) — no mechanical name transform produces five renames
and two identities from the same input set.

The failure mechanics, stated precisely:

- Tailwind emits `@theme` keys as custom properties into `:root` inside its **`theme` cascade
  layer**. `@import "./tokens.css"` (line 606) is unlayered. Unlayered declarations beat layered
  ones, so `tokens.css`'s `--color-bg: var(--c-paper)` currently wins the cascade and the
  self-referencing declaration is discarded before computed-value time. **The contract survives
  today by a cascade-layer accident that DESIGN.md never states and cannot rely on.**
- The moment those two declarations land in the same origin and layer with the adapter later in
  source order — a Satellite that writes `@import "./tokens.css" layer(theme);`, a bundler that
  flattens imports into a single unlayered sheet, or any consumer that reorders the two imports
  — the declaration becomes a **cycle**, is invalid at computed-value time, and per CSS
  substitution rules `background-color` resets to its **initial** value (`transparent`), not to
  the previous cascade value. On a near-black dark-only system, `--color-bg` resolving to
  transparent is total.
- Independently: `--color-accent` is a name the contract already publishes as a **semantic role
  token** (`DESIGN.md` § Semantic roles). Any Satellite that legitimately hand-writes
  `var(--color-accent)` in its own CSS is now reading a property with two competing definitions
  whose winner depends on layer accidents. That is a landmine in three repositories.
- Finally, the justification given at lines 625–629 is incoherent in this form: "Without it a
  `var()` reference resolves where the theme variable is defined rather than where it is used."
  With the same name on both sides, *"where it is defined"* and *"where it is used"* refer to
  the same custom property. The sentence is copied from §D2 without re-checking that the
  example it justifies still has two names in it.

This also breaks attack 5's future-proofing argument. DESIGN.md keeps `inline` for the day a
`[data-theme]` block arrives — but if one arrives and redefines `--color-bg`, the self-reference
is precisely what makes the resolution ambiguous. The mandate is kept while the naming that
makes it work is discarded.

*Fix:* give the contract and the theme layer disjoint namespaces and generate the adapter from
that, e.g. keep `--color-*` as the published roles and mint theme keys under a distinct prefix,
or rename all seven lines the way five already are: `--color-page: var(--color-bg);`
`--color-brand: var(--color-accent);`. Then add a one-line generator assertion that no
`@theme` key equals its own referent. State the layering assumption explicitly in the file
header, and pin the import as unlayered.

---

**[critical] `cs-tracker` — the named Step 2 adopter that FR-18 is measured on — is assigned the plain-`tokens.css` consumption row, but research §D2 states Phoenix 1.8.0 ships Tailwind v4, where a `:root` file generates zero utilities** (`DESIGN.md` § Per-framework consumption, line 660 "**Phoenix LiveView** | **Vendor** the folder into `assets/css/` and `@import` it"; § `tailwind.css` line 601 "For `cuatro-finance`, `cuatro-tracker` and `cs-tournament`"; line 666 "**`cs-tracker` being the Step 2 adopter**").

Research §D2 line 600: "**Phoenix 1.8.0 (2025-08-05) ships Tailwind v4 plus daisyUI**" and line
603: "Phoenix consumes design as **Tailwind classes and CSS custom properties**." Research §D2
lines 635–640 then state the problem in terms that apply directly: "A plain external CSS file
defining custom properties under `:root` **generates zero utility classes** — `bg-brand` will
not exist… There is **no mechanism for `@theme` to auto-adopt `:root` variables**."

So the contract's own Tailwind-cluster list omits the one Tailwind application in the estate
that Epic 1 Step 2 depends on, and hands it the artefact research says is insufficient there.
DESIGN.md's own `EXPERIENCE.md` seam **S-9** already knows this ("daisyUI defines its own
`--color-primary` family… Phoenix components pick up daisyUI defaults instead of Cuatro
tokens"), which makes the per-framework table internally contradicted by the seams inventory
sitting one document away.

The downstream consequence is not cosmetic. PRD §9.3 waypoint 2 is "Hand-copy tokens into the
Anchor and one other live app" bound to FR-16/17/18, and SM-6 targets "≥ 2" applications
rendering from shared tokens. If the second application is `cs-tracker` and it receives only
`tokens.css`, FR-18's acceptance condition — "A Visitor moving between them encounters the same
palette, type scale and spacing rhythm" — is not reachable without work the contract does not
budget for.

*Fix:* move Phoenix into the Tailwind row of both tables. Publish `tailwind.css` as the Phoenix
artefact too, plus the daisyUI role mapping from S-9. Restate the cluster as "`cs-tracker`,
`cuatro-finance`, `cuatro-tracker`, `cs-tournament`". Resolve O-3 (`@plugin "daisyui/theme"`
accepting `var()`) **before** publishing, not after, since it now gates the FR-18 measurement
rather than trailing it.

---

**[critical] `tailwind.css` imports `tokens.css` but never `fonts.css`, so the Tailwind cluster's documented adoption path — "Import `tailwind.css`", "Trivial, generated" — produces a system that names three typefaces and loads none of them** (`DESIGN.md` § `tailwind.css` lines 605–606 `@import "tailwindcss"; @import "./tokens.css";`; § Per-framework consumption line 656).

This is the three-file split's new failure mode, instantiated in the contract's own example
file. `tokens.css` line 495 declares
`--f-display: "Bricolage Grotesque", "Archivo", system-ui, sans-serif;`. With no `@font-face`
reachable, every Tailwind-cluster Satellite silently resolves to `system-ui` — and the design's
entire continuity argument rests on Bricolage's width axis ("**Bricolage's width axis is the
identity**", line 252; "That single axis is carrying most of the visual continuity"). The
result is not a broken page; it is a page that looks *almost* right, in three or four
repositories, with nothing to catch it.

DESIGN.md diagnoses exactly this class of failure at lines 455–457 — "every font 404s silently
and the app falls back to a system stack that looks almost right" — and then reproduces it in
the file it publishes to the cluster that it says needs zero effort to adopt.

The two-artefact version in research §D2 could not enter this state: whatever mechanism carried
the values carried the faces with them. Splitting into three created a partial-adoption state
that did not previously exist, and the contract's own worked example is in it.

*Fix:* add `@import "./fonts.css";` to `tailwind.css` immediately after the `tokens.css` import.
Change the per-framework table's "Import `tailwind.css`" to name all three files, or state
explicitly that `tailwind.css` is the single entry point and that it pulls the other two.
Add a conformance check to the adoption checklist: `document.fonts.check('1em "Bricolage
Grotesque"')` after load, or a visual diff of one display line.

---

## High

**[high] The Phoenix vendoring instruction produces 404ing fonts, because Tailwind's standalone binary is not a bundler and does not rewrite or copy `url()` assets into `priv/static/`** (`DESIGN.md` § Per-framework consumption line 660; `EXPERIENCE.md` seam S-10).

Research §D2 lines 663–673 establish the Phoenix pipeline precisely: no `package.json`, no
`node_modules`, esbuild and tailwindcss driven as standalone binaries through Hex wrappers.
Those binaries compile CSS; they do not resolve, hash or emit referenced font binaries the way
webpack, Vite or Next's CSS loader do. A vendored `fonts.css` sitting in `assets/css/` with
`url()` paths relative to itself will emit those paths verbatim into the compiled sheet, and the
browser will request them beneath the served static root — where nothing has placed the woff2
files, because Phoenix serves from `priv/static/` and only `Plug.Static`'s configured `:only`
list is exposed.

So Phoenix — the one framework the three-file split was invented for, and the only one whose
vendoring is called out as "**Trivial, and it is Phoenix's own sanctioned pattern**" — is the
framework where the split does not solve the problem. The cost is understated on three counts
at once: folder copy, plus a `priv/static` font placement and `Plug.Static` `:only` entry, plus
the daisyUI role mapping from S-9, plus the unresolved O-3 question.

*Fix:* specify the Phoenix path concretely: fonts to `priv/static/fonts/`, `fonts.css` rewritten
to absolute `url("/fonts/…")` for that consumer, and `fonts` added to the endpoint's
`Plug.Static` `:only`. Alternatively publish a fourth variant of `fonts.css` with root-absolute
paths for non-bundling consumers, and say which consumers those are. Downgrade the Phoenix cost
column from "Trivial" to a named checklist.

---

**[high] The stated rationale for splitting two artefacts into three is factually wrong — relative `url()` in `@font-face` resolves against the stylesheet's own URL and is therefore depth-independent** (`DESIGN.md` § Why three files, not two, lines 442–459).

The argument at lines 454–459: "Its `url()` paths resolve relative to the stylesheet, so the
moment `tokens.css` is vendored to a different depth in a Satellite — `assets/css/` in Phoenix,
`src/styles/` in Svelte, `src/` in Angular — every font 404s silently."

The premise defeats the conclusion. Because `url()` resolves relative to *the stylesheet*,
depth is exactly what does **not** matter: `url("./fonts/x.woff2")` inside `tokens.css` is
valid at `assets/css/`, at `src/styles/` and at `src/` alike, provided the folder travels
together — which is what DESIGN.md itself prescribes two sentences later ("a Satellite copies
the **folder**"). The identical sentence justifies keeping `@font-face` in `tokens.css`.

There are two *real* arguments for the split that DESIGN.md does not make: Style Dictionary
cannot emit `@font-face` from a DTCG source at all, so `fonts.css` is necessarily hand-authored
and should not sit inside a generated file; and a Satellite may legitimately want values
without faces. Both are good. Neither is what is written, and the written one will not survive
a reviewer who knows CSS — which matters when the audience is Marcus.

*Fix:* replace the rationale with the two sound arguments. Keep the split. Then close the new
failure mode it creates (C-3) and the Phoenix case it does not close (H-1).

---

**[high] Neither the `@media (prefers-reduced-motion: reduce)` block nor the two `clamp()` tokens can be produced by stock Style Dictionary from a DTCG source, so `tokens.css` must be hand-authored or hand-patched — which undermines the generated-artefact story and makes silent loss on regeneration the likely outcome** (`DESIGN.md` § `tokens.css` lines 583–590; lines 509 `--t-display: clamp(2.25rem, 9vw, 4.5rem);` and 545 `--page-pad: clamp(1.25rem, 5vw, 4rem);`; § Build lines 635–638).

Three separate problems:

- **The reduced-motion block.** Style Dictionary's `css/variables` format emits one selector
  block per file, parameterised by `options.selector`. Wrapping a second variable set in a
  media query requires a custom format function plus a second token set or mode modelling the
  four `1ms` values. That is buildable, but it is not "mechanical output" and DESIGN.md does not
  mention it. The consequence is the sharp end: DESIGN.md calls this block "**the single
  highest-value thing in this file after the palette**" and "the one piece of *behaviour* the
  token layer can genuinely federate" (lines 592–597). If it is hand-patched onto generated
  output, the first regeneration drops it, in every repository at once, with no visible symptom
  other than motion returning for reduced-motion users — a population that by definition is not
  filing the bug.
- **`clamp()` in a DTCG `dimension`.** The DTCG 2025.10 `dimension` type is a structured
  `{value, unit}` pair. A `clamp()` expression is not expressible as one. It can be smuggled
  through as a raw string, but then it fails DTCG validation and no dimension transform (px↔rem,
  scaling) can touch it. This affects the two most structurally load-bearing tokens in the
  system: the one display size and the page padding that § Layout calls "the one existing value
  that survives the migration by intent".
- **Reference output.** The role layer (`--color-bg: var(--c-paper)`) only emits as a `var()`
  reference if `outputReferences: true` is set. It is never stated. Without it the generated
  file emits literal `oklch()` at every role, the palette→role indirection vanishes from the
  artefact, and the § Do's instruction "Consume the **semantic role** tokens" becomes
  unenforceable at the file level.

*Fix:* state plainly which parts of `tokens.css` are generated and which are appended by a
custom SD format, and commit the format function alongside the token source so regeneration
cannot drop the media block. Model the reduced-motion values as a real token set rather than a
patch. Declare `clamp()` tokens as a documented DTCG extension or accept them as hand-authored
and mark them as such in the file. State `outputReferences: true`.

---

**[high] Step 2's aliasing silently drops every bold weight, because the old system encoded weight in the font-family name and the new system does not** (`DESIGN.md` § Sequence step 2, lines 719–722; § The mapping lines 707–709).

The mapping collapses `--font-regular` **and** `--font-bold` onto `--f-body`, and
`--monument-regular` **and** `--monument-bold` onto `--f-display`. On disk, weight was carried by
the family name via distinct `@font-face` blocks (`app/scss/_fonts.scss` lines 29–37 and
59–67 define `GeneralSans-Regular` at 400 and `GeneralSans-Bold` at 700 as **separate
families**). After aliasing, `font-family: var(--monument-bold)` yields Bricolage at whatever
`font-weight` the element already has.

Two call sites on disk have no adjacent `font-weight` and therefore lose bold outright:

- `components/organisms/ErrorPage/error-page.scss:14` — `font-family: var(--monument-bold);` at
  `font-size: 25vw`, the largest type on the error page.
- `components/organisms/HomeLayout/HomeLayout.scss:284` — `font-family: var(--monument-bold);`
  at `font-size: 3rem`, uppercase.

(`WorkHero.scss:15–17` and `HomeLayout.scss:67–68` do set `font-weight: 700` alongside and
survive.)

This directly falsifies step 2's claim: "**Every one of the sixteen component stylesheets keeps
working untouched**." Two of them do not. And it lands in the commit DESIGN.md nominates as
"the one commit worth a careful visual check" — where a 25vw heading dropping from 700 to 400
is visible, but a reviewer told the step is a no-op is primed not to look.

*Fix:* make step 2 a two-part alias — the family property plus a companion weight — or add
`font-weight: 700` to the two bare call sites as part of step 2 rather than step 6. Add a row to
the mapping table stating explicitly that weight moves from the family name to `font-weight`,
since that is the structural change the migration actually performs.

---

**[high] The mapping table drops `--confillia-*` with no replacement, but two live call sites consume it and step 2 promises the site keeps working** (`DESIGN.md` § The mapping line 710 "`--confillia-*` | **dropped** | No replacement"; § Sequence step 2 line 719).

On disk: `components/organisms/HomeLayout/HomeLayout.scss:8`
(`font-family: var(--confillia-normal);` on the homepage's `p, a` at `font-size: 1.5rem`) and
`HomeLayout.scss:246`. Step 2 says "Redefine **the ten existing properties** as `var()`
references to the new roles" — but there is no role to point `--confillia-normal` at. If the
alias is omitted, `var(--confillia-normal)` is invalid at computed-value time,
`font-family` becomes unset and inherits, and the homepage's primary paragraph type silently
changes face inside a commit described as touching one file with a predictable visual result.

`EXPERIENCE.md` O-6 defers this to migration step 5 ("Confirm nothing on `/celeste` depends on
it"), which is both the wrong step — the break occurs at step 2, three steps earlier — and the
wrong file: the dependency is in `HomeLayout.scss`, not `celeste.scss`. `celeste.scss:13` uses
`font-family: system-ui` and does not touch Confillia at all.

*Fix:* add an explicit row — `--confillia-*` → `--f-display` or `--f-body`, chosen deliberately —
so step 2 has a target. Retarget O-6 from `/celeste` to `HomeLayout.scss:8` and `:246`, and
move it from step 5 to step 2.

---

**[high] The mapping assigns `--gray-color` to `--color-border-interactive`, a role the contract itself bars from carrying text, at a call site that is body text** (`DESIGN.md` § The mapping line 705; § Semantic roles line 191; § Conformance line 230).

`--color-border-interactive` resolves to `--c-line-strong` at **3.52:1** on paper — a value the
contract documents as clearing "WCAG 1.4.11's 3:1 floor", i.e. the **non-text** threshold. The
§ Conformance note is explicit that decorative-grade values are "barred from carrying text" and
that "Using either as a meaning-bearing boundary is a defect."

On disk, `components/organisms/HomeLayout/HomeLayout.scss:9` uses
`color: var(--gray-color);` on the homepage's `p, a` selector — body copy at `font-size: 1.5rem`.
After step 2 that copy renders at 3.52:1, below the 4.5:1 AA floor that `EXPERIENCE.md`
§ Accessibility Floor commits to ("**Target: WCAG 2.1 AA**, exceeded on text contrast").

The pre-migration value (`#545454` on `#000`) is already about 2.77:1, so this is not a
regression the migration introduces — it is a pre-existing failure the migration table *locks
in* by assigning it a token whose documentation says it must never carry text. That is worse
than leaving it, because it converts an unnoticed bug into a documented-conformant state.

*Fix:* map `--gray-color` per call site rather than globally: `--color-border-interactive` where
it is a border, `--color-text-secondary` where it is text. `HomeLayout.scss:9` and `:335` are
text. Note in the mapping table that `--gray-color` is the one old property with two distinct
roles on disk, so it cannot be aliased 1:1 in step 2.

---

## Medium

**[medium] Step 6 is not "purely mechanical" — `HomeLayout.scss` contains an inverted light-on-dark panel for which the contract defines no token** (`DESIGN.md` § Sequence step 6, lines 733–734).

On disk, `--light-gray-color` (`#b3b0aa`) is used as a **background fill** at
`HomeLayout.scss:54`, `:134` and `:149`, and `--black-color` is used as **foreground and border**
at `:31`, `:35`, `:39`, `:167`, `:168`, `:173`, `:174`, `:185`, `:186`, `:191`, `:192` and `:285`.
The mapping sends the first to `--color-text-secondary` and the second to `--color-bg`, so a
mechanical rename produces `background: var(--color-text-secondary)` — a text role used as a
large surface fill, and `color: var(--color-bg)` — a ground role used as type. Both invert the
"Applied to" column of § Semantic roles and violate the § Do's rule "Consume the **semantic
role** tokens".

The underlying issue is that this is a dark-only contract with ten roles and no **inverted
surface** role, applied to a codebase that has one. Step 6 therefore requires a design decision,
not a find-and-replace, and it is the step DESIGN.md marks as safe to trail.

*Fix:* either add an inverted pair to the contract (`--color-bg-inverse` / `--color-text-inverse`),
or record `HomeLayout`'s panel as a declared exception the way S-1 handles Three.js. Change step
6's description from "Purely mechanical" to name the one component that is not.

---

**[medium] Three file and property counts in the migration section are wrong against the files on disk** (`DESIGN.md` § What exists, lines 676–697; § Sequence step 4, line 727).

- **"ten custom properties in one file"** (line 677) and "Redefine **the ten** existing
  properties" (line 719). `app/app.scss` lines 3–28 define **twelve**: `--white-color`,
  `--black-color`, `--light-gray-color`, `--gray-color`, `--page-padding`, `--hero-height`,
  `--font-regular`, `--font-bold`, `--confillia-normal`, `--confillia-bold`,
  `--monument-regular`, `--monument-bold`. DESIGN.md's own quoted snippet at lines 682–691
  shows all twelve, so the prose contradicts the code it quotes.
- **"sixteen component stylesheets under `components/atoms|molecules|organisms/`"** (line 694),
  repeated at line 720. There are **twelve**. Sixteen is the total `.scss` count in the repo
  including `app/app.scss`, `app/scss/_index.scss`, `_fonts.scss` and `_print.scss` — the four
  files the sentence explicitly lists as being *in addition to* the sixteen.
- **"Colour literals outside `app.scss` are confined to six places"** (line 696). There are
  **eleven**: `_print.scss:9`, `:10`, `:23`; `navbar.scss:10`; `celeste.scss:2`, `:16`;
  `WorkItem.scss:2`, `:84`; `ProjectCard.scss:13`, `:36`; and `HomeLayout.scss:122`. Steps 3 and
  4 between them cover ten of the eleven (see M-3).

Individually trivial; together they mean the section that FR-18 measures was written from
recollection rather than from a sweep, which is a signal about the rest of it.

*Fix:* correct all three counts. State the sixteen as "twelve component stylesheets plus four
files under `app/`".

---

**[medium] `HomeLayout.scss:122` `color: white;` is a colour literal that no migration step touches, because the sweep evidently matched hex and `rgba()` only** (`DESIGN.md` § Sequence steps 3–4, lines 723–729).

Step 3 covers the four `rgba(255,255,255,…)` in `ProjectCard.scss` and `WorkItem.scss`. Step 4
covers `#444`/`#fff` in `celeste.scss`, `#fff` in `navbar.scss` and the print greys. Neither
covers `components/organisms/HomeLayout/HomeLayout.scss:122`, which uses the **CSS named
colour** `white` on an `<img>` (the alt-text colour). FR-17's consequence is absolute — "No
colour, spacing or type value in the Hub's own styling bypasses the token contract" — and
§ Don'ts says "Don't use `#000` or `#fff`. **Not once**, outside the print stylesheet."

Related non-colour bypasses in the same class, also untouched by any step and also in scope for
FR-17's "spacing or type value": `WorkItem.scss:85` `border-radius: 2px` (the contract reserves
`--r-hair: 2px` for "**Focus ring outline only**"); `WorkItem.scss:82` `font-size: 0.8rem`,
which is not on the 1.25 scale; `celeste.scss:13` `font-family: system-ui` and
`navbar.scss:6` `font-family: sans-serif`, two components that bypass the font tokens entirely.

*Fix:* re-run the sweep with a pattern covering CSS named colours, and extend step 4's literal
list. Add a step covering the four non-colour bypasses, or scope FR-17 conformance explicitly to
colour and say so.

---

**[medium] `app.scss`'s `body` rule violates § Layout & Spacing on two counts and no migration step touches it** (`app/app.scss` lines 36–47; `DESIGN.md` § Layout & Spacing line 326).

On disk: `body { … width: 100vw; height: 100vh; overflow-x: hidden; }`.

The contract says: "**`html, body { overflow-x: clip }` globally.** `clip`, not `hidden` —
`hidden` breaks sticky positioning. Widths are `100%` with container padding, **never `100vw`**."
`EXPERIENCE.md` § Component Patterns then specifies the nav as "Sticky at `{z.sticky}`", which is
the exact interaction `overflow-x: hidden` on an ancestor breaks. The mockup gets it right
(`key-screens.html:68` `html,body{overflow-x:clip}`); the migration sequence never changes it.

`100vw` also produces horizontal overflow on any platform with a classic scrollbar, against
A-5's "No horizontal scroll at 360px".

*Fix:* add the `body` rule to step 2 or step 4 explicitly. It is two words and it is a
prerequisite for the sticky nav the experience spec assumes.

---

**[medium] `--radius-DEFAULT` is a Tailwind v3 convention that does not exist in v4** (`DESIGN.md` § `tailwind.css` line 620 `--radius-DEFAULT:   var(--r-none);`; front-matter line 79 `DEFAULT: '0'`).

In Tailwind v4 theme keys are literal CSS custom property names, and the JS-config `DEFAULT`
sentinel is gone. `--radius-DEFAULT` mints a utility named `rounded-DEFAULT` — case-sensitive,
since custom property names are — and does **not** set the bare `rounded`. The design's single
most emphasised shape rule ("**Square. `--r-DEFAULT: 0`.**", line 376) is therefore not enforced
in any of the Tailwind repositories by this line. Note also that § Shapes names the token
`--r-DEFAULT` while `tokens.css` does not define it at all — the file has `--r-none`, `--r-hair`,
`--r-pill` only.

*Fix:* use `--radius: var(--r-none);` for the bare utility, or drop the line and rely on the
per-app `border-radius: 0` hand-fix already listed as S-3. Correct the § Shapes heading to name
a token that exists.

---

**[medium] `--elev-0/1/2` duplicate `--color-bg` / `--color-bg-raised` / `--color-bg-raised-2` exactly, creating two published names for one value across eight repositories and a latent major bump** (`DESIGN.md` § `tokens.css` lines 559–562 against lines 483–485).

Both sets alias the identical `--c-*` values. Under the stated versioning model — "A **rename**
is **major**, including fixing a typo in a token name" — the redundant set is the one most
likely to be deprecated once someone notices, and deprecating it is a major bump plus a
deprecate→migrate→remove cycle across every adopter. The contract ships the latent break rather
than resolving it before publication, when it is free.

A second, smaller latent rename: `--color-bg-raised-2` is a positional numeric name paired with
an unnumbered `--color-bg-raised`. Any future symmetry fix (`-1`/`-2`) is a major bump.

*Fix:* pick one set before v1.0.0 ships. Given the "Consume the semantic role tokens" rule, the
`--color-bg-*` set is the one to keep and `--elev-*` is the one to drop. If both are wanted,
name `--color-bg-raised` as `--color-bg-raised-1` now, while nothing consumes it.

---

**[medium] The elevation ladder is 1.05:1 and 1.12:1 by the contract's own table, yet it is the primary depth mechanism with shadows banned outright** (`DESIGN.md` § The palette lines 168–169; § Elevation & Depth lines 351–353).

"**Elevation is lightness, never glow.** Higher surfaces are lighter by a **+4 lightness step**"
and the ladder's first entry is "**Lightness.** `paper` → `surface` → `surface-high`". A 1.05:1
step is at or below the perceptual threshold on an uncalibrated laptop panel, and effectively
invisible on a phone at reduced brightness in daylight — which is Daniela's scenario verbatim
(NFR-5, "arrives on a phone", "between meetings"). With shadows removed there is no fallback
depth cue except the `1px` boundary, which is specified for the Suite Switcher panel and the
raised containers but not for `--color-bg-raised-2`, whose only job is hover ground.

This is not a contract defect so much as a design bet, but it propagates into eight repositories
and is unfalsifiable once distributed, so it deserves a decision rather than an inheritance.

*Fix:* either widen the step (a +6 or +8 OKLCH lightness step still stays far below the accent
and costs nothing), or state explicitly that a hairline is mandatory on every raised surface,
making lightness the secondary cue rather than the first item on the ladder.

---

**[medium] `@theme` extends Tailwind's default palette rather than replacing it, so `bg-red-500`, `rounded-lg` and `shadow-md` all remain available in the Tailwind repositories and the design's hardest rules are unenforceable there** (`DESIGN.md` § `tailwind.css` lines 604–622).

Research §D2 line 648 names the tool: "`--*: initial` wipes the default palette; use it only for
a deliberately closed palette." The Cuatro palette is *exactly* a deliberately closed palette —
"**One accent**", "there are **no shadows in this system**", "**Square. `--r-DEFAULT: 0`**" — and
DESIGN.md declines to use it, without saying so or saying why. A Satellite developer reaching
for `shadow-lg` in `cuatro-tracker` gets it, and the § Don'ts list is enforced only by memory
across three repositories.

*Fix:* add `--color-*: initial;`, `--shadow-*: initial;` and `--radius-*: initial;` to the
`@theme` block so the closed palette is closed by the toolchain, and say in § Do's and Don'ts
that this is why. If the escape hatch is wanted, state that decision explicitly instead.

---

## Low

**[low] The mockup's `:root` block is not the contract rendered — it omits the entire semantic-role layer, and every rule in the file consumes the raw `--c-*` palette that § Do's forbids** (`mockups/key-screens.html` lines 15–61; `DESIGN.md` § Do's line 753 "Consume the **semantic role** tokens. `--color-text`, never `--c-ink`").

The mockup defines none of the ten `--color-*` roles, and none of `--w-*`, `--lh-*`, `--tr-*`,
`--measure`, `--stroke-*`, `--focus-offset`, `--elev-*` or `--dur-exit`. Every consumer in the
file reads `var(--c-ink)`, `var(--c-muted)`, `var(--c-line)`, `var(--c-accent)` directly (lines
69–99 and onward). Since the mockup is the artefact a developer will copy patterns from, the
raw-palette habit is what propagates.

*Fix:* add the role layer to the mockup's `:root` and rewrite its consumers to use it. It is the
cheapest possible demonstration that the indirection is real.

---

**[low] The mockup hardcodes a colour that is not in the contract, immediately below a comment claiming it does not** (`mockups/key-screens.html` line 13 "Nothing hardcodes a value", line 204 "Nothing hardcodes a colour, size, duration or radius — the file is a working proof that the contract is sufficient", against lines 69 and 81 `background:oklch(8% 0.008 288)`).

`oklch(8% 0.008 288)` is a fourth ground, four lightness steps below `--c-paper`, appearing
nowhere in the contract. Three smaller drifts in the same block: the reduced-motion rule at line
63 collapses `--dur-micro/minor/major` but **omits `--dur-exit`**, which `tokens.css` line 588
includes; `--f-mono` at line 31 drops `SFMono-Regular` present at `tokens.css` line 497; and the
`--t-xs` comment at line 35 reads "14px floor for body copy" for a `0.8125rem` (13px) value that
DESIGN.md documents as the *UI copy* floor, with `--t-sm` as the body floor.

*Fix:* promote the page-chrome ground to `--c-void` in the contract or replace it with
`--c-paper`. Add `--dur-exit` to the mockup's reduced-motion rule. Correct the `--t-xs` comment.

---

**[low] The mockup loads all three typefaces from the Google Fonts CDN, contradicting the self-hosting premise the typeface choice rests on** (`mockups/key-screens.html` lines 7–9).

§ Typography's entire licence argument is "All three are open-licence and **self-hostable**,
which is the whole reason they were chosen — the type system has to be **vendored into seven
repositories**". A reader who opens the mock and copies its head gets a third-party CDN
dependency in a Phoenix app with no `node_modules`.

*Fix:* one comment in the head saying the CDN is a mock convenience and that production vendors
`fonts.css`.

---

**[low] `--dur-exit: 165ms` is a hand-computed derivative of `--dur-minor` with no `calc()`, so a minor version bump to `--dur-minor` silently desynchronises it** (`DESIGN.md` § `tokens.css` line 568 `--dur-exit:  165ms;  /* ~75% of minor */`).

The comment states the invariant; the value does not express it. Under "A **value** change is a
**minor** bump. Pixels move; nothing breaks", changing `--dur-minor` from 220ms ships as a minor
release and leaves `--dur-exit` at a ratio the file's own comment says is wrong, in every
adopter.

*Fix:* `--dur-exit: calc(var(--dur-minor) * 0.75);` — which also keeps working when the
reduced-motion block collapses `--dur-minor` to `1ms`, removing one of the four overrides.

---

**[low] The `oklch()` decision is defensible and the Baseline claim is correct, but the described degradation is not what happens, and the palette table calls the hex column a "fallback" that is never emitted** (`EXPERIENCE.md` § Responsive & Platform line 669; `DESIGN.md` § Colors line 161).

Baseline status **holds**: `oklch()` reached Baseline newly available in May 2023 and widely
available around November 2025, so "Baseline widely available" is accurate as of 2026-08-15, and
"no fallback ladder" is a reasonable call for a portfolio estate.

What is wrong is the implied graceful degradation. On a non-supporting engine the custom
property declaration itself parses fine — custom properties accept arbitrary token sequences —
and the failure surfaces at every **use** site as invalid-at-computed-value-time. IACVT does not
fall back to a previous declaration; the property resets to its initial or inherited value. So
`background-color` becomes `transparent`, `border-color` becomes `currentColor`, and
`outline-color` on the focus ring becomes `currentColor` — a system that loses its focus
indicator's colour rather than its background. `color-scheme: dark` (S-11) happens to keep the
canvas dark, which is luck rather than design.

Separately, `DESIGN.md` line 161 states "The hex column is the computed sRGB fallback" while
§ Responsive & Platform states "no fallback ladder is provided". Both cannot be true, and no
hex appears in `tokens.css`.

*Fix:* change "the computed sRGB fallback" to "the computed sRGB equivalent, for reference and
contrast verification". Record the actual IACVT behaviour in one sentence next to the
deliberate-simplification decision so it is a known cost rather than an assumed graceful one.
A two-line `@supports not (color: oklch(0 0 0))` block redefining the ten `--c-*` to their hexes
would close it entirely and is emittable by the same custom SD format H-3 already requires.

---

**[low] Evidence-grade drift from research §D2 in three places** (`DESIGN.md` § Build lines 635–638; § Per-framework consumption line 659).

- Research §D2 line 633 rejects Terrazzo as "an unstable entry point for a **15-repo**
  contract"; DESIGN.md line 638 rewrites it as "an **eight-repository** contract". Eight is the
  §5 *end state*; the estate is twelve at MVP per PRD §9.3 SM-7, which is when the hand-copying
  happens. The version claims themselves (SD 5.5.1, `convertTokenData` prototype pollution, DTCG
  2025.10, Terrazzo CLI 0.7.2) match §D2 exactly.
- Research §D2 line 631 carries "*(Exact release dates are unverified — a source returned
  impossible 2024 stamps — but version numbers are solid.)*" DESIGN.md drops the caveat.
- Research §D2 line 685 explicitly hedges the Angular claim: "*(That custom properties
  specifically inherit through is CSS-cascade reasoning on top of that quote — **labelled as
  inference**.)*" DESIGN.md line 659 restates it as settled fact. The claim is almost certainly
  correct — the `styles`-array mechanism and the `ViewEncapsulation.Emulated` reasoning both
  check out — but a hedge stripped in transit is how an inference becomes a fact nobody re-tests.

*Fix:* restore "twelve repositories today, eight at end state" and carry the two hedges forward
with one clause each.

---

**[low] `--f-display` names `"Archivo"` as its first fallback, a face that is not in the licence table and is not vendored** (`DESIGN.md` § `tokens.css` line 495).

§ Typography's table lists exactly three families and says "Three families, which is the
ceiling." Archivo appears only in the font stack. On a machine that happens to have Archivo
installed the display type renders in a fourth, undeclared face; everywhere else the line is
inert. Harmless, but it is an undeclared dependency in a file being copied into eight
repositories.

*Fix:* drop `"Archivo"` or add a one-line note in § Typography saying it is a deliberate
metric-adjacent fallback and is never shipped.

---

**[low] Two arithmetic slips in `EXPERIENCE.md` that the contract will be read alongside** (`EXPERIENCE.md` § Asset Budget line 620; § The hand-fix list, in order, lines 595–604).

- § Asset Budget's non-3D payload is "HTML + **one CSS file** + three woff2 subsets". The
  contract publishes three CSS files. The ≤140 KB figure is unaffected, but the sentence
  describes the two-artefact contract, not the three-artefact one — a leftover from before the
  split, which is worth correcting because it is the only place the budget names the artefacts.
- § The hand-fix list is introduced as "**Nine lines of CSS per Satellite.** This is the whole
  per-app adoption cost" and then lists **five** numbered items. Since this list is the
  headline adoption-cost number a Satellite owner will quote, it should be the number of items
  in it.

*Fix:* "HTML + three CSS files + three woff2 subsets"; and either "Five rules per Satellite" or
expand the list to nine.

---

## What held

Stated once each, as instructed.

- **Palette and contrast.** I recomputed the sRGB relative luminance for `--c-ink`, `--c-muted`,
  `--c-accent`, `--c-line-strong`, `--c-line` and `--c-surface-high` against `--c-paper` and got
  17.56 / 7.03 / 6.20 / 3.54 / 1.39 / 1.12 — matching the § Colors table. The OKLCH lightness
  values are consistent with the stated hexes (L³ ≈ relative luminance) at every step. The
  fifteen-pairing claim is arithmetically sound.
- **The `boder:` typo.** Verified exactly:
  `components/atoms/WorkItem/WorkItem.scss:84` reads
  `boder: 1px solid rgba(255, 255, 255, 0.3);`. That border has never rendered.
- **Versioning.** Value = minor, rename = major including typo fixes, deprecate→migrate→remove
  as the atomic-commit substitute, adoption explicit and reviewed — matches research §D2 lines
  691–694 and PRD FR-19 with no drift.
- **Style Dictionary 5.5.1 and DTCG 2025.10.** Version numbers, the `convertTokenData`
  vulnerability rationale, the do-not-pin-below instruction and the Terrazzo 0.7.2 rejection all
  match §D2 exactly. Only the repo count and one caveat drifted (L-6).
- **Angular.** `styles` array in `angular.json` and `ViewEncapsulation.Emulated` as a non-issue
  are both correct per research §D2 lines 681–686 — the encapsulation shim rewrites component
  selectors, it does not block inbound global cascade, and custom properties inherit through
  regardless.
- **Next.js, React/Vite, Svelte, Vue.** All four consume `tokens.css` + `fonts.css` with no
  token-specific build step. The bundler `url()` rewriting these toolchains perform is their
  normal CSS pipeline, not a framework-specific step for the tokens, so FR-16's consequence
  holds. The Anchor's existing `_fonts.scss` (relative `url('../../public/fonts/…')` resolved
  from the partial) is on-disk evidence that the Sass→Next path handles this correctly today.
- **Attack 5, in principle.** With no `[data-theme]` block the `inline` mandate is genuinely
  moot, and keeping it anyway against a future theme is sound reasoning — the argument fails
  only because of how the keys are named (C-1), not because the reasoning is wrong.
- **The three-file split against §D2.** Adding a third artefact does not contradict research
  §D2; §D2 specifies a minimum shape, not a maximum. Only the stated rationale is wrong (H-2).
- **`components/atoms/Container`, `Logo`, `molecules/Header`, `organisms/WorkTimeline`.** Four of
  the twelve component stylesheets contain no colour, font or literal token consumption at all
  and are genuinely unaffected by every migration step.

---

## Recommended gate before hand-copy

Five items, in order, all cheap:

1. Fix C-1 — disjoint namespaces in the `@theme` block, plus a generator assertion.
2. Fix C-3 — one `@import` line in `tailwind.css`.
3. Fix C-2 — move Phoenix into the Tailwind row and resolve O-3 first.
4. Fix H-1 — write the Phoenix font-serving path down concretely.
5. Decide H-3 — which parts of `tokens.css` are generated, and commit the SD format that emits
   the reduced-motion block.

Items 1–4 are the ones that ship silently into more than one repository. Everything under
Medium and Low can trail Epic 1 Step 2 without risk.
