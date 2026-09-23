# The literal-conformance gate

The written record of `ops/literal-conformance.mjs` and the `literal-conformance` job in
`.github/workflows/ci.yml`: why the gate exists, what it reads and what it deliberately does not, the
permitted set, the one alpha allowance and the four dispositions with the reason for each, the job's
properties, the first run over the tree with its output verbatim, what holds the failure paths
permanently, and the stated limits.

Written during Story 2-34 on **2026-09-23** (ISO 8601 UTC), against baseline commit `802fbf4`.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/contract-purity.md` and `ops/registry-schema.md` set: every value is marked
**Observed** with its method or **Decision** with its reason (NFR-9). **The gate's configuration is
the source of truth for every allowance**: the tables below quote it, and where the two disagree the
module wins and this file is stale.

## Why the gate exists at all

FR-17 says no colour, spacing or type value in the Hub's own styling bypasses the token contract.
`DESIGN.md` § Sequence names the check that holds it **R8**, "a blocking CI grep: no colour, spacing or
type literal outside `contracts/` and `_print.scss`", the spine's Styling convention says the same, and
AD-21 lists "the FR-17 colour-literal conformance check" among the gates that may never become
warnings. **None of it was true before this story.** **Observed 2026-09-23** by reading
`.github/workflows/ci.yml` at `802fbf4`: six jobs, none of them a literal check. Story 2.19's one-time
hand sweep was replaced by this gate on 2026-08-15 because a sweep cannot hold a property: eight
redesign stories made the Hub's stylesheets token-native (Stories 2-27 to 2-33, plus the Epic 2
builds before them), and before this job a ninth commit could write `#fff` or `44px` back and ship
green.

## What the gate reads, and what it deliberately does not

| It reads | It does not read | Nature |
|---|---|---|
| Every `*.css`, `*.scss` and `*.sass` file `git ls-files --cached --others --exclude-standard` lists: the committed tree plus whatever a commit would carry | Built CSS, `.ts`, `.tsx` or any script. Gitignored output (`public/contracts/`, `.next/`) is never a stylesheet a commit carries | **Decision.** A source scan is what a commit changes and what a reviewer reads. The build's CSS is read by `tests/e2e/accessibility-floor.pw.ts`'s tally, which is a different question |
| Declarations, custom properties and Sass variables included, and the arguments of Sass at-rules that carry values (`@include`, `@mixin` and `@function` defaults, `@return`, `@if`, `@each`) | Selectors, comments, strings, `url()`, `#{}` interpolation, `@use`, `@forward`, `@import`, `@extend`, and the conditions of `@media`, `@supports`, `@container`, `@keyframes`, `@font-face`, `@layer` and `@page` | **Decision.** `#fed` in a selector is an id, a `44px` in a media query is a breakpoint, and a literal in a comment paints nothing. Masking keeps every offset, so a finding quotes the original text at its real line |
| A statement that is neither a declaration nor an at-rule | | **Decision.** It is a finding, so the gate fails closed rather than skip text it cannot read |
| A `.sass` file | Its contents | **Decision.** Indented syntax is not parsed here, so the file is refused rather than skipped |
| The Three.js scene | | **Decision.** Seam S-1: the scene's colours are JS values a custom property cannot reach (`EXPERIENCE.md` § Seams), the one declared FR-17 exception. The gate covers stylesheets only |

**The listing is git's, deliberately.** A directory walk would have to name every generated directory
to skip, and `public/contracts/` carries a copy of the contract's literals after every `pnpm build`.
`git ls-files -z` with `core.quotePath=false` is the listing `app/__tests__/anchor-contract.test.ts`
already uses for the same reason. A tracked stylesheet deleted from the working tree but not yet
staged is skipped, because no build reads it; any other read failure is a finding.

## The rules

**Outside the permitted set:**

| Rule | What it refuses | Nature |
|---|---|---|
| Colour | Any colour literal in any declaration or Sass argument: a 3, 4, 6 or 8 digit hex, `rgb(`, `rgba(`, `hsl(`, `hsla(`, `hwb(`, `lab(`, `lch(`, `oklab(`, `oklch(`, `color(`, `color-mix(`, or one of the 148 CSS named colours in any case | **Decision.** Story 2.34 names hex, `rgb(`, `rgba(`, `hsl(` and a named colour; the other functions are the same literal spelled another way. `transparent`, `currentcolor` and the system colours are keywords with no hue and are not named colours |
| `44px` | A hand-written `44px` in any declaration, custom properties and Sass variables included | **Decision.** Disposition 3 below |
| Spacing | A non-zero absolute or font-relative length (`px`, `rem`, `em` and their kin) in the `margin`, `padding`, `scroll-margin`, `scroll-padding`, `gap` and `inset` families, their longhands, and `top`, `right`, `bottom` and `left`, a `var()` fallback included | **Decision.** "Spacing is a scale, not a value" (`DESIGN.md` § Layout & Spacing). The story names the shorthands; a check its own longhand bypasses is not a check, so the longhands and the physical offsets `inset` expands to are read too. Zero, `auto`, a `var()` reference and a unitless `calc()` factor pass. A percentage or a viewport length placing a panel is geometry, the same kind of value as a polygon coordinate, and the contract carries none |
| Type | Anything but a `var()` or Sass variable reference and a CSS-wide keyword in `font`, `font-family`, `font-size`, `font-weight`, `line-height` and `letter-spacing` | **Decision.** The five properties the contract's roles scale (`--f-*`, `--t-*`, `--w-*`, `--lh-*`, `--tr-*`) and their shorthand. `font: inherit`, the button reset, passes |

**Everywhere, the permitted set included:** any alpha colour, meaning `rgba(`, `hsla(`, a four or
eight digit hex, a colour function with a slash or a fourth comma argument, and `color-mix()` with
`transparent`, except the one allowance below. **Decision.** `DESIGN.md` § Rules: "Alpha is not a
colour", with `--c-scrim` the single named exception.

## The permitted set, the allowance and the dispositions

Quoted from the configuration block at the top of `ops/literal-conformance.mjs`, where each entry
carries its reason. A change to any of them is a reviewed edit to that list, and the suite pins all
three.

| Permitted | Reason | Nature |
|---|---|---|
| `contracts/` | The contract defines the values. Every literal in the estate is authored there once and consumed everywhere else as a role (AD-1, AD-14) | **Decision.** Story 2.34 |
| `app/scss/_print.scss` | Paper is genuinely white and toner genuinely black, so the print stylesheet is outside the contract by nature (`DESIGN.md` § Sequence) | **Decision.** Story 2.34 |

**No component-level entry exists at all.** Story 2.27 dropped the chromatic aberration rather than
excepting it, so the set is exactly these two, and an entry is a path rather than a basename: a
`_print.scss` anywhere else is read like any other stylesheet.

**The one alpha allowance** names the palette declaration `--c-scrim` in `contracts/tokens.css`,
never the role `--token-scrim`, which is a plain `var()` reference like every other. **Observed
2026-09-23**: a scan of the real `contracts/tokens.css` with the allowance written against the role
refuses the contract itself at `--c-scrim: oklch(12% 0.011 288 / 0.88)` (review finding HIGH-4), and
with the allowance as configured it allows exactly that one alpha and nothing else. A hand-written
copy of the scrim value is refused everywhere outside `contracts/`: as a colour in a component, and as
an alpha in the print stylesheet.

| # | Collision | Verdict | Reason | Nature |
|---|---|---|---|---|
| 1 | `opacity` keyframes in the display entrance (Story 2-27) | **Allowed** | The alpha check reads colour functions only, never the `opacity` property. A grep cannot tell an entrance from a state, so barring opacity for state stays a design rule held in review | **Decision.** Story 2.34, review finding HIGH-5 |
| 2 | `clip-path` notch geometry (Story 2-29) | **Allowed** | The spacing check reads spacing properties only. Polygon coordinates are shape geometry, not values on the `--s-*` scale, and so are the percentages that place a panel | **Decision.** Same |
| 3 | The `44px` hit-target literal | **Rejected** | `--tap: 44px` is minted in the contract, so a hand-written `44px` is refused in every declaration with no local-constant allowance: a floor hand-written in five frameworks drifts in five frameworks | **Decision.** Same, review finding LOW-2 |
| 4 | `font-variation-settings` axis literals, `"wdth" 100 / 85 / 75` and `"opsz" 48 / 24` | **Allowed** | Font-internal axis coordinates from `DESIGN.md` § Typography, not values on the `--t-*` scale, and no token exists or should. `font-stretch`, the same `wdth` axis as a percentage, stands here too | **Decision.** Same |

**Suppression is a named entry, never a comment.** Comments are masked before anything is read, so
`/* literal-conformance: ignore */` or a linter's disable comment beside a literal silences nothing;
the suite shows three such comments failing to.

## The job

`.github/workflows/ci.yml` gained one job, `literal-conformance`, **last in the file** so the line
numbers other records and specs cite in the jobs above it did not move. No other job was modified.

| Property | Value | Nature |
|---|---|---|
| Blocking | Yes. No `continue-on-error`, no `\|\| true`, no `if:` and no `needs:` | **Decision.** AD-21 |
| **How far that reach goes** | A red job stops nothing mechanically: `main` names no required status check (`ops/contract-adoption.md`), and `deploy.yml` fires on the same push with no `needs:` | **Observed** in those records; unchanged by this story, as for every other job in the file |
| Triggers | The file's own, `push` to `**` and `pull_request` to `main`; the job declares no `on:` | **Decision** |
| Runner | `ubuntu-latest`, Node 22 through `setup-node` with `package-manager-cache: false` | **Decision.** The Node major every job pins |
| Installs | Nothing. The gate imports only `node:` builtins and lists the tree with the `git` the checkout carries | **Decision.** It still reports on the run where `pnpm install --frozen-lockfile` fails, as `contract-purity` and `registry-schema` do |
| Ceiling | `timeout-minutes: 5` | **Decision.** The other two no-install gates' ceiling |
| Command | `node ops/literal-conformance.mjs`, no argument and no `env:`. The root is the module's parent directory, so nothing reaching the runner redirects what it reads | **Decision** |
| Lines added to `ci.yml` | 38 added, **0 removed** | **Observed 2026-09-23** by `git diff --numstat -- .github/workflows/ci.yml` |
| Run time | 296 ms for the whole tree, 25 stylesheets | **Observed 2026-09-23** on the authoring host, a spawned `node ops/literal-conformance.mjs` timed around the call |

## The first run

**Observed 2026-09-23**, `node ops/literal-conformance.mjs` over the tree at `802fbf4`, the gate
module present and nothing else changed, exit 1:

```text
literal conformance: REFUSED
  FR-17 (R8): no colour, spacing or type literal in any stylesheet outside the permitted set,
  contracts/ and app/scss/_print.scss, and no alpha anywhere but
  --c-scrim in contracts/tokens.css. AD-21 makes this blocking.
  5 findings:
    app/app.scss:29: --accent-glow: rgba(139, 92, 246, 0.4), a colour literal outside the permitted set. Name a --token-* role.
    components/organisms/Celeste/celeste.scss:2: background-color: #444, a colour literal outside the permitted set. Name a --token-* role.
    components/organisms/Celeste/celeste.scss:13: font-family: system-ui, a type literal. Name the --f-*, --t-*, --w-*, --lh-* or --tr-* role.
    components/organisms/Celeste/celeste.scss:14: font-size: min(8vw, 5rem), a type literal. Name the --f-*, --t-*, --w-*, --lh-* or --tr-* role.
    components/organisms/Celeste/celeste.scss:16: color: #fff, a colour literal outside the permitted set. Name a --token-* role.
  The permitted set, the one alpha allowance and the four dispositions are named entries in
  ops/literal-conformance.mjs, each with its reason; changing one is a reviewed edit to that
  list. No comment in a stylesheet silences this gate. See ops/literal-conformance.md.
```

**An earlier draft of the spacing rule refused ten more**, every one a percentage: the four home
panels' corners in `HomeLayout.scss` (`top: 12%`, `left: 8%` and their kin, Story 2-29) and the skip
control's `inset-block-end: 4%` and `inset-inline-start: 50%` (Story 2-13). Those place a panel inside
a composition, which is exactly what disposition 2 already keeps out of the check for polygon
coordinates, so the rule was amended to lengths a scale step replaces before the run above. **Decision
2026-09-23**, recorded in the spec's change log.

**What cleared the five.** `/celeste`'s block names `--token-bg`, `--f-display`, `--t-display` and
`--token-text` (`RESTYLE-SPEC.md` F-1, `DESIGN.md` § Typography, § Scale and § The mapping), and
`--accent-glow` is deleted from the alias layer: `DESIGN.md` § The mapping dropped it and closed O-11
on 2026-08-15, it had zero call sites, and its `rgba()` is a colour and an alpha outside the permitted
set. `ops/anchor-token-adoption.md` § Story 2-34 closes O-11 carries the second half. **Observed
2026-09-23**, the same command after both, exit 0:

```text
literal conformance: read 25 stylesheets, 21 outside the permitted set and 4 inside it; no colour, spacing or type literal outside it, and 1 alpha, on --c-scrim in contracts/tokens.css (FR-17, AD-21).
```

## What holds the failure paths permanently

`ops/__tests__/literal-conformance.test.ts`, inside the already-blocking `test` job, so the job and
the suite are independent readers of one rule. One standing case per row of the story's I/O matrix,
each against a fixture that fails where it should and passes where it should: every colour form, the
permitted set as paths rather than basenames, the alpha allowance on the real contract and against a
role-named allowance, the four dispositions, every spacing property, every type property, comments,
strings, `url()`, interpolation, selectors and conditions left unread, three suppression comments
suppressing nothing, a script never opened, a `.sass` file refused, the listing's gitignore and
deleted-file behaviour, both refusals (a tree that cannot be listed and one with nothing outside the
permitted set), the committed tree passing, the command's exit 0 on it and exit 1 on a scratch
repository carrying a literal, the verdict recorded before the write, `node:` imports only, and the
job's wiring. `ops/__tests__/contract-purity.test.ts` and `ops/__tests__/registry-schema.test.ts` pin
the file's seven job names as a set and read this job's command.

## Stated limits

| Limit | Why it stands | Nature |
|---|---|---|
| A spacing or type literal laundered through a local custom property or Sass variable (`--x: 12px; padding: var(--x)`) passes | The spacing and type checks read the property a value lands in, and a custom property's declaration has none. `--hero-height: 40vh`, which Story 2-22 keeps as the alias layer's one literal, is the same shape. Colour and `44px` are read in every declaration, so neither can be laundered that way | **Decision** |
| A percentage or a viewport length in a spacing property passes | Relative geometry, which the spacing scale does not carry (disposition 2). A `padding-inline: 5vw` that should have been `--page-pad` is a review question | **Decision** |
| A value built in Sass (`darken()`, `math.div()`) is read as written, not as computed | A source scan reads source. A colour literal passed to a Sass function is still refused, because the literal is in the source | **Decision** |
| The built CSS is not read | A literal the build introduces is out of reach: Turbopack's `lab()` downlevel of every `oklch()` is the contract's own values, and a literal from a dependency's stylesheet would be one no source commit here writes | **Decision** |
| `rem` equivalents of the floor (`2.75rem`) are not the `44px` rule's | In a spacing property the spacing rule refuses them; in `min-height` nothing does. The floor is asserted rendered by `tests/e2e/hit-target-floor.pw.ts` at 44 by 44 whatever wrote it | **Decision** |
| Stroke widths, radii, `z-index` levels and motion values are not read | R8 is colour, spacing and type, as FR-17 is. The contract carries roles for the rest (`--stroke-*`, `--r-*`, `--z-*`, `--dur-*`, `--ease-*`), each redesigned stylesheet's own suite pins the roles it names, and `tests/e2e/accessibility-floor.pw.ts` counts `z-index` literals in the built CSS | **Decision** |
| A CSS escape (`1\32 px`) or a Sass nested property (`font: { size: 12px; }`) can carry a literal past the scan | Both are syntax this repository does not write, and the scan reads text as written. A reviewer meeting either reads it as the bypass it is | **Decision** |
| The job is not a required status check | A repository setting, the same for every job in the file; `ops/contract-adoption.md` records why none is | **Observed**, unchanged |

## Pending Operator actions

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Record the first real CI run of the `literal-conformance` job** from the Actions run summary | Operator | The gate and its suite have run on the authoring host only. A push to `dev` runs the job; the run's number and outcome belong here | _not done_ |
