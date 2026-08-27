# `cs-tracker` adopts the token contract

The written record of Story 1-19, the second application in the estate rendering from the published
design token contract: what was vendored and its sha256 per file, how daisyUI's colour family was
mapped onto the token roles and where every row comes from, the four hand-fix rules and the seam
each one closes, the probe transcript verbatim, the FR-18 side-by-side reading, the two measured
costs of importing the generated adapter and the decision taken on each, what `--color-accent` means
now, the four status colours the contract cannot reach, the roles that reach no surface, the stated
limits, and the work this file hands the Operator.

Written during Story 1-19 on **2026-08-27** (ISO 8601 UTC), against baseline commit `1b7cc1c` in
`cuatro-portfolio` and `ff7667b` in `cs-tracker`.

**This file closes Pending Operator actions 3 and 4 of `ops/daisyui-route.md`.** Action 3 asked what
`--color-accent` means in `cs-tracker`; action 4 asked for the adapter import to be confirmed against
AD-14 with the two measured costs in hand. Both are answered below and both rows in that file now
carry a completion date.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/token-contract.md`, `ops/font-contract.md`, `ops/tailwind-adapter.md`,
`ops/daisyui-route.md` and `ops/anchor-token-adoption.md` set: every value is marked **Observed**
with its method or **Decision** with its reason (NFR-9), and every date is ISO 8601 UTC.

**Story ids are written hyphenated throughout**, as `Story 1-19`, matching the keys in
`_bmad-output/implementation-artifacts/sprint-status.yaml`. `epics.md` writes the same ids dotted.
They are the same story.

## What this story did, in one paragraph

`cs-tracker` vendored `contracts/` as `assets/css/cuatro-contracts/`, imported the generated Tailwind
adapter from its own `assets/css/app.css`, deleted its `light` theme block along with the three-state
toggle, the inline bootstrap script and the `dark` custom variant that all served it, mapped twelve
of daisyUI's twenty theme colour names plus its border width and three radii onto the contract's
roles through AD-15 route A, and appended the four hand-fix rules `EXPERIENCE.md` lists. A new
`mix cuatro.fonts` task places the three woff2 faces beside the compiled stylesheet, because the
Tailwind CLI carries the contract's `url()` values through unrebased. Read in one Chromium at one
viewport, every `--token-*` role, every `--f-*` family and every `--t-*` size now computes the same
value in `cs-tracker`'s compiled stylesheet as in `cuatro.dev`'s built one. That is FR-18, measured
rather than argued.

## What was vendored

**Observed 2026-08-27** by `node ops/cs-tracker-adoption-probe.mjs`, which hashes both trees and
compares them file by file, with the file count pinned at nine so a tree walk that stopped recursing
cannot report a verbatim copy having compared only the three top-level stylesheets.

| Path under `assets/css/cuatro-contracts/` | sha256 |
|---|---|
| `tokens.css` | `319a825597995cbecacc43f08da9b24b48db636abc2b1e023ea4387a5cb38462` |
| `fonts.css` | `4c954f73c713a01023e2bb22b56b73f343f17bf9d0a8beeb5ea844f8ea19872f` |
| `tailwind.css` | `1b0e3c609f0a2851885801d5fc0a75e31d9754fa30ead847c4e5b3d80d3fdc5f` |
| `fonts/bricolage-grotesque-latin.woff2` | `f27b91934aa5559116b55e670d5d0e0c00d4408b0e1a44c3d0b59ab20afb792c` |
| `fonts/geist-latin.woff2` | `db540d97a0afd5f39a8f331c2b4aa259c56e943e05acfae752637fcf1976e336` |
| `fonts/geist-mono-latin.woff2` | `14bf6b01f51a5172bc24327b63ee2a3b3e04d87329fccba275dc9789e7cbb89c` |
| `fonts/OFL-bricolage-grotesque.txt` | `4b5a7d8f37f5602621c8a8d7358a6a2e71317e6c231c661e15aef0275d3e07ba` |
| `fonts/OFL-geist.txt` | `c683bfbcc7e087f5d37a54ef628f10387c451a83ddc459b151403a164ac46c90` |
| `fonts/OFL-geist-mono.txt` | `c683bfbcc7e087f5d37a54ef628f10387c451a83ddc459b151403a164ac46c90` |

The last two rows carry the same hash because the two OFL texts are the same file. That is a property
of the published contract, not a copy fault, and it is stated here so a later reader does not read it
as one. `ops/__tests__/cs-tracker-adoption-probe.test.ts` pins both that equality and the inequality
of two woff2 faces, so a walk that never descended into `fonts/` fails there as well as here.

**The byte-identity survives git, which is the half that matters.** `cuatro-portfolio/.gitattributes`
forces `contracts/**/*.css|json|txt` to LF and deliberately leaves `.woff2` alone;
`cs-tracker/.gitattributes` is `* text=auto eol=lf`. **Observed 2026-08-27**, by hashing the staged
blob against the working-tree file for `tokens.css`, `fonts.css`, `tailwind.css` and one woff2: all
four equal, so a fresh checkout on any host reproduces the hashes above.

**Nothing under the vendored folder is ever hand-edited.** `test/cs_tracker_web/token_contract_test.exs`
asserts the folder holds exactly those nine paths and no others, and plants its control in a scratch
copy rather than in the folder itself, so not even one assertion writes to a published surface.

| Property | Value | Nature |
|---|---|---|
| Folder name | `cuatro-contracts/`, exactly, under `assets/css/` | **Decision.** AD-14 and AD-16: a scheduled drift check needs a target rather than a search |
| Contract version | **v1.0.0**, from the `Contract v1.0.0` header `tokens.css` carries | **Observed 2026-08-27**, asserted by the Elixir suite |
| Import form | `@import "./cuatro-contracts/tailwind.css";` in `assets/css/app.css`, after the `@source` lines and before the `@plugin` lines | **Decision.** AD-14 names `cs-tracker` in bold among the Tailwind consumers that import the adapter rather than the plain pair |
| Scan exclusion | `@source not "../css/cuatro-contracts";` | **Decision**, and measured below: it works, and today it is precautionary |

## The mapping

**AD-15 route A**, `--color-*: var(--token-*)` declarations inside the existing
`@plugin "../vendor/daisyui-theme"` block. Route B, an unlayered `[data-theme="dark"]` rule after the
plugin, is equally live and stays the recorded fallback; it is not used, for the three reasons
`ops/daisyui-route.md` § Why route A rather than route B gives.

Every row's computed value below is **Observed 2026-08-27** in Chromium 151.0.7922.34 off
`cs-tracker`'s own compiled stylesheet, canonicalised to 8-bit sRGB where it is a colour, read beside
a probe element declaring the role inline in the same page. The shape and stroke rows are read the
same way, through a probe declaring the daisyUI name beside one declaring the role: the four form
controls the S-3 hand-fix squares cannot stand in for them, because that rule squares those whether
the theme maps a radius or not.

| daisyUI name | Contract role | Computed | Source |
|---|---|---|---|
| `--color-base-100` | `--token-bg` | `rgba(6, 5, 9, 1)` | The ground the shell paints. `epics.md` § Story 1.19 |
| `--color-base-200` | `--token-bg-raised` | `rgba(13, 12, 19, 1)` | `elev-1`, the navbar and card ground |
| `--color-base-300` | `--token-bg-raised-2` | `rgba(22, 21, 28, 1)` | `elev-2`, borders and the raised chip |
| `--color-base-content` | `--token-text` | `rgba(238, 238, 242, 1)` | 17.56:1 on `--token-bg`, measured below |
| `--color-primary` | `--token-accent` | `rgba(143, 126, 240, 1)` | `ops/daisyui-route.md` § The fragment Story 1.19 applies, the one line it names |
| `--color-primary-content` | `--token-bg` | `rgba(6, 5, 9, 1)` | The dark ink the accent is bright enough for, 6.20:1 |
| `--color-secondary` | `--token-bg-raised-2` | `rgba(22, 21, 28, 1)` | A ground role for the fill. Nothing in this application paints a secondary surface, so repeating `base-300` costs nothing visible; said out loud below rather than left silent |
| `--color-secondary-content` | `--token-text` | `rgba(238, 238, 242, 1)` | The role whose contrast against that ground was already measured, 15.67:1 |
| `--color-neutral` | `--token-accent-muted` | `rgba(86, 76, 145, 1)` | **Not a ground.** See "Why neutral is the one fill that is not a ground" below |
| `--color-neutral-content` | `--token-text` | `rgba(238, 238, 242, 1)` | 6.39:1, measured below |
| `--color-accent` | `--token-accent` | `rgba(143, 126, 240, 1)` | The collision `ops/daisyui-route.md` action 3 left open. See below |
| `--color-accent-content` | `--token-bg` | `rgba(6, 5, 9, 1)` | Same pair as primary, so one word gives one colour |
| `--border` | `--stroke-boundary` | `1px` | The contract's boundary stroke. **Read off `:root` through a probe**, not inferred |
| `--radius-selector` | `--r-none` | `0px` | This system is square (seam S-3). Written `calc(var(--r-none) * 1px)`, see below |
| `--radius-field` | `--r-none` | `0px` | Same |
| `--radius-box` | `--r-none` | `0px` | Same |

`--size-selector` and `--size-field` keep their Story 7.1 values: they are daisyUI's own control
geometry and the contract publishes no counterpart. `--depth` and `--noise` do not, and the reasons
are below.

### Why the three radii are written `calc(var(--r-none) * 1px)`

`contracts/tokens.css:103` authors `--r-none: 0`, **unitless**. That is correct for the contract, and
it is a trap for one daisyUI declaration. **Observed 2026-08-27** in the compiled stylesheet, daisyUI
emits `.toggle`'s corner as:

```css
border-radius: calc( var(--radius-selector) + min(var(--toggle-p), var(--radius-selector-max)) + min(var(--border), var(--radius-selector-max)) )
```

A unitless zero added to a length makes that `calc()` invalid at computed-value time, so the whole
declaration drops and `.toggle` falls back to whatever it would otherwise round to. Multiplying by
`1px` keeps the declaration reading the contract role and always yields a length. **The affected
component is `.toggle` and this application does not use it today**, so nothing visible was broken;
the fix is here because the next component that uses a radius in a `calc()` would be.

### Why `--depth` is zero

`--depth: 1` was kept in the first pass and filed as "daisyUI's own control geometry". That was wrong.
**Observed 2026-08-27**: the compiled stylesheet reads `var(--depth)` in **35** places, all of them
gradients, inset `box-shadow`s and `text-shadow`s on buttons, inputs, menus and tabs. That is a raised
treatment, and `contracts/tokens.css:114` states the rule in its own words, as a section heading:
elevation is **"lightness, not shadow"**.

**Decision:** `--depth: 0`. What it changes is that buttons, inputs, menus and tabs lose the shadow
and gradient overlay daisyUI adds at depth 1, and take their elevation from the ground roles instead,
which is the mechanism the contract publishes. Nothing else moves: `--depth` feeds no colour, no size
and no radius.

### Why `prefersdark` and the `dark` custom variant are gone

Both were true unconditionally after seam S-7 was taken, and a rule that can only ever match is a
broken surface on exactly the reading that retired the theme toggle.

| Removed | Why | Nature |
|---|---|---|
| `prefersdark: true` in the theme block | It is only consulted to choose among themes, and there is one theme, declared `default: true`. Keeping it made daisyUI emit an extra `@media (prefers-color-scheme: dark)` block that decided nothing | **Decision**, pinned by `token_contract_test.exs` so it is not reintroduced unexamined |
| `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))` | `<html>` carries `data-theme="dark"` unconditionally, so the variant matched everything, and **Observed 2026-08-27** `lib/` writes zero `dark:` utilities | **Decision**, with the zero-usage claim asserted by a case that scans `lib/**/*.{ex,heex}` |

### Why neutral is the one fill that is not a ground

The first pass mapped `--color-neutral` onto `--token-bg-raised`, a ground. That shipped a visible
regression: `badge-neutral` is `core_components.badge/1`'s **default** variant, it is live at
`inventory_components.ex:177` on the inventory chip, and a chip painted the colour of the surface
behind it degrades to plain text.

**Decision:** `--color-neutral: var(--token-accent-muted)`.

| Why that role | Nature |
|---|---|
| It is a published role, so nothing is invented | **Decision.** AD-14 |
| Nothing else in `cs-tracker` reads it, so it collides with no other surface | **Observed 2026-08-27** |
| It is distinct from all three grounds, which is the property the first mapping lacked | **Observed 2026-08-27**: `rgba(86, 76, 145, 1)` against grounds `rgba(6, 5, 9)`, `rgba(13, 12, 19)` and `rgba(22, 21, 28)` |
| It is the role the Hub gives its own tech chips, at `ProjectCard.scss:66` and `WorkItem.scss:144`, both of which resolve `--accent-dim` to `--token-accent-muted` after Story 1-18 | **Observed 2026-08-27**, by reading `app/app.scss:27` and `:83`. So the change moves the two applications closer rather than further apart |

`--color-secondary` stays on `--token-bg-raised-2` and therefore stays equal to `--color-base-300`.
That is deliberate and it is said here rather than left silent: **nothing in `cs-tracker` paints a
secondary surface today**, so the repetition costs nothing visible, and inventing a hue for an unused
role would be inventing a mapping. `token_contract_test.exs` asserts only that *neutral* is not a
ground, because neutral is the one that is live.

## The contrast of every pair, measured

**Observed 2026-08-27**, printed by `node ops/cs-tracker-adoption-probe.mjs` and quoted verbatim from
its transcript. The probe computes WCAG 2.1 relative luminance over the same 8-bit sRGB values it
canonicalised for the FR-18 table, so every figure here names a committed method and moves when a
mapping moves. The floors are asserted, not just reported: 4.5:1 for a text pair, 3:1 for the focus
ring, and a run below either fails.

```
# contrast, WCAG 2.1 over the 8-bit sRGB values read above
  --color-base-100 on --color-base-content             17.56:1
  --color-base-200 on --color-base-content             16.82:1
  --color-base-300 on --color-base-content             15.67:1
  --color-primary on --color-primary-content           6.20:1
  --color-secondary on --color-secondary-content       15.67:1
  --color-neutral on --color-neutral-content           6.39:1
  --color-accent on --color-accent-content             6.20:1
  --token-bg on --token-focus                          11.73:1
  --token-bg-raised on --token-focus                   11.24:1
  --token-bg-raised-2 on --token-focus                 10.47:1
```

## What `--color-accent` means now

`ops/daisyui-route.md` Pending action 3 left this decision here, and this is it.

**Decision:** `cs-tracker`'s `--color-accent` reads `--token-accent`, the same role
`--color-primary` reads.

`--color-accent` is the one `--color-*` name daisyUI's theme and the contract adapter both own. Before
this story the composed build gave it two colours in one page: `.btn-accent` read daisyUI's teal off
the element, while the adapter utility `.bg-accent` emitted `var(--token-accent)` at the use site,
because that is what `inline` means. Nothing errored, nothing warned, and the page looked almost
right. **Observed 2026-08-27**, after the mapping: `--color-accent` is emitted as
`var(--token-accent)` by the CLI and computes `rgba(143, 126, 240, 1)`, the same value
`.bg-accent` computes. One word, one colour. The collision is closed rather than documented.

The cost of closing it is that `accent` and `primary` are now the same colour in `cs-tracker`. That is
correct for this contract, which publishes one accent role and no second brand hue.

## The four status colours the contract does not cover

`contracts/tokens.css` publishes twelve semantic roles and **none of them means "success", "warning",
"danger" or "info"**. `badge-success` is the Owned marker and `badge-info` the Wishlisted marker in
`inventory_components.ex`, so they carry meaning the contract does not carry. Mapping them onto accent
or muted would erase a distinction the application makes; inventing three hues would be inventing a
mapping this story has no authority to invent.

So these eight names keep their Story 7.1 values, and that is a **Decision** recorded rather than
papered over:

```css
--color-info:            oklch(58% 0.158 241.966);
--color-info-content:    oklch(97% 0.013 236.62);
--color-success:         oklch(60% 0.118 184.704);
--color-success-content: oklch(98% 0.014 180.72);
--color-warning:         oklch(66% 0.179 58.318);
--color-warning-content: oklch(98% 0.022 95.277);
--color-error:           oklch(62% 0.2 25);
--color-error-content:   oklch(98% 0.015 25);
```

They are one of the two places the contract cannot reach `cs-tracker`'s surface today. The count is
pinned at eight in both `test/cs_tracker_web/token_contract_test.exs` and the probe, so quietly
mapping one of them onto a role, or quietly leaving a thirteenth name on a literal, fails a case
rather than passing.

## The other direction: which roles reach no surface

The section above says which daisyUI names the contract cannot reach. This is the reverse, and it
matters because the FR-18 table below is a `:root` equality table and reads like coverage if nothing
says otherwise. **It is not coverage.** It says the two applications resolve the same values for the
same names; it says nothing about how many of those names either one paints.

**Observed 2026-08-27**, by reading the theme block's twelve mapped names against the twelve roles:

| Role | Reaches a daisyUI name | Note |
|---|---|---|
| `--token-bg` | yes | `--color-base-100`, `--color-primary-content`, `--color-accent-content` |
| `--token-bg-raised` | yes | `--color-base-200` |
| `--token-bg-raised-2` | yes | `--color-base-300`, `--color-secondary` |
| `--token-text` | yes | `--color-base-content` and three `-content` partners |
| `--token-accent` | yes | `--color-primary`, `--color-accent` |
| `--token-accent-muted` | yes | `--color-neutral` |
| `--token-focus` | yes | not through daisyUI: through the S-2 hand-fix rule |
| `--token-border` | **no** | daisyUI publishes no border colour role. See the limit below |
| `--token-border-interactive` | **no** | nothing in daisyUI's theme means "interactive boundary" |
| `--token-text-secondary` | **no** | `cs-tracker` writes `text-base-content/65` and similar instead, which is the full-strength role at an opacity |
| `--token-accent-hover` | **no** | daisyUI derives its own hover with `color-mix()` off `--color-primary` |
| `--token-scrim` | **no** | nothing in this application layers text over imagery |

**Seven of the twelve roles reach a surface in `cs-tracker` today; five do not.** All twelve are
published, vendored and equal across the two applications, which is what FR-18 asks; five of them are
simply not consumed here yet. Closing that is Story 8.1's Family A work, not this story's.

## The hand-fix list, as applied

`EXPERIENCE.md` § The hand-fix list gives five lines **in order of return per line**, and that is the
only sense in which "in order" is used here and in the tests. It is not a claim about position in the
file: hand-fix 5 is the mapping, which necessarily sits inside the `@plugin` block roughly a hundred
lines above the other four. The four appended rules are the ones whose file order is asserted, and
they are asserted against `EXPERIENCE.md`'s sequence.

They are written unlayered in `assets/css/app.css` on purpose: an unlayered author rule beats every
rule in Tailwind's `base`, `components` and `utilities` layers whatever its specificity, which is what
lets one plain `:focus-visible` rule replace daisyUI's per-component rings.

| # | Seam | Rule | Measured |
|---|---|---|---|
| 1 | **S-11** | `:root { color-scheme: dark; }` | `:root` computes `color-scheme: dark`. **Observed 2026-08-27** |
| 2 | **S-12** | `::selection { background-color: var(--token-accent); color: var(--token-bg); }` | Computed background `rgba(143, 126, 240, 1)` against the `--token-accent` probe, foreground `rgba(6, 5, 9, 1)` against the `--token-bg` probe. **Observed 2026-08-27** |
| 3 | **S-2** | `:focus-visible { outline: var(--stroke-focus) solid var(--token-focus); outline-offset: var(--focus-offset); }` | On a daisyUI `.btn` under real keyboard focus: `outline-width` `2px` against `--stroke-focus` `2px`, `outline-style` `solid`, `outline-color` `rgba(198, 189, 255, 1)` against `--token-focus`, `outline-offset` `3px` against `--focus-offset`, and `transition-property` is `color, background-color, border-color, box-shadow`, which does not name `outline`. **Observed 2026-08-27** |
| 4 | **S-3** | `input, select, textarea, .btn { border-radius: var(--r-none); }` | All four compute `0px`. **Observed 2026-08-27** |
| 5 | **S-9** | The mapping table above, inside the `@plugin` block | Every mapped name computes the value of its role. **Observed 2026-08-27** |

**The focus rule is copied, not invented.** It is `RESTYLE-SPEC.md:326-332` and `EXPERIENCE.md:711-723`
verbatim in substance: `:focus-visible` only so a mouse click paints no ring, `--stroke-focus` solid
`--token-focus` at `--focus-offset`, never transitioned, never removed. The probe reads it on a
`.btn` rather than on a bare anchor deliberately, because daisyUI ships its own `.btn:focus-visible`
ring and a bare element would never show that the contract's rule wins over it.

**Two of the five are belt and braces, and both say so in the file.** Hand-fix 1 is redundant today:
the surviving theme block declares `color-scheme: "dark"` and daisyUI emits it onto `:root`, so the
probe's reading would pass with the rule deleted. Hand-fix 4 is redundant for the same kind of reason:
the three radii already map onto `--r-none`, so daisyUI's own `--radius-field` chain produces `0px`
without the rule. Both stay, on the same two grounds: a later theme edit would silently take the
scrollbar back to light or round every form control again, and `EXPERIENCE.md`'s list is what a
Satellite maintainer copies. Neither is claimed here as evidence that the seam was closed by the rule.

## Seam S-8, which was not evaluated

S-8 is **LiveView DOM patching against CSS transitions**: `phx-update` can replace an element mid
transition, so a hover or entrance animation snaps in `cs-tracker` where it eases elsewhere.
`EXPERIENCE.md` marks it **Fix if visible**, with `phx-update="ignore"` on animated containers as the
remedy.

**Its antecedent was not evaluated, and this is the one acceptance criterion in the story that is
neither implemented nor closed.** "If visible" can only be observed in a running LiveView application
patching real DOM, and the whole rendered half of this story reads a compiled stylesheet in a fixture
page. Nothing here reaches that surface.

What survives in the tree after the toggle's removal, **Observed 2026-08-27** by scanning
`lib/**/*.{ex,heex}`:

| Transition | Where |
|---|---|
| `transition-colors` | the wordmark link and both `nav_link/1` variants, `layouts.ex:71`, `:142`, `:158`; and hover states in `dashboard_live.ex` |
| `transition-shadow` | the catalog, inventory and dashboard cards, `catalog_components.ex:28`, `inventory_components.ex:52` and `:158`, `dashboard_live.ex:218` |
| `transition-all` | the flash show/hide JS transitions, `core_components.ex:621` and `:632`, and `dashboard_live.ex:275` |
| `motion-safe:animate-spin` | the reconnect icon in both flash groups, `core_components.ex:603`, `layouts.ex:194` and `:206` |

The three-state toggle's own `transition-[left]` went with it, which is the only transition this story
removed. Nothing this story did adds a transition or changes a `phx-update` attribute. Whether any of
the survivors visibly snaps under patching falls to the Operator's visual pass, and it is Pending
action 5 below rather than an unstated gap.

## Seam S-7, taken whole

`contracts/tokens.css` publishes one palette and it is dark. `EXPERIENCE.md` S-7's mitigation is
sequencing: **a Satellite adopts fully or not at all, because a half-adopted application is worse
than an unadopted one.** So four things moved together, and they had to:

| Removed | Why it could not stay |
|---|---|
| The `light` theme block in `assets/css/app.css`, 28 declarations, `default: true` | It is the palette the contract replaces. The surviving `dark` block takes `default: true` |
| `theme_toggle/1` in `lib/cs_tracker_web/components/layouts.ex` and its call site in `navbar-end` | Its `light` and `system` buttons would select a theme that no longer exists |
| The inline `<script>` in `lib/cs_tracker_web/components/layouts/root.html.heex` | It writes `data-theme="light"` into `localStorage`. A visitor who last chose light would land on an unstyled `[data-theme=light]` document on their next visit |
| The `dark` custom variant | It could only ever match, and nothing wrote a `dark:` utility |

`<html lang="en" data-theme="dark">` replaces the script's whole job. Removing the script also retires
an inline `<script>` in a template, which `cs-tracker/AGENTS.md:37` forbids, so the deletion pays a
standing debt as well as this story's.

**`localStorage["phx:theme"]` is abandoned, not cleaned up.** The removed script was its only reader
and its only writer, **Observed 2026-08-27** by scanning `assets/js/` and `lib/` for the key: nothing
else in the application touches it. A returning visitor who once chose a theme keeps a dead key in
their browser for ever, and it has no effect, because nothing reads it and `data-theme` is now written
into the markup. **Decision:** it stays. Clearing it would mean shipping a script whose only job is to
delete a key, which is reintroducing exactly the inline `<script>` this story removed to satisfy
`AGENTS.md:37`.

`test/cs_tracker_web/live/app_shell_test.exs` asserts the after-state rather than describing it: the
navbar carries no `[data-phx-theme]` control, the dead render carries no `phx:theme` string, and
`<html>` carries `data-theme="dark"`. That case replaces the one this story falsified, `preserves the
three-state theme toggle in the navbar`.

## The two measured costs of the adapter import, and the decision on each

`ops/daisyui-route.md` Pending action 4 asked for AD-14's assigned import to be confirmed with the two
costs in hand. Both are now measured against `cs-tracker`'s **real** stylesheet rather than against a
scratch application.

### Cost 1: a second Preflight

**Observed 2026-08-27.** Method: `cs-tracker`'s real `assets/css/app.css` compiled with its own pinned
`tailwindcss v4.1.12`, then the identical file with only the
`@import "./cuatro-contracts/tailwind.css";` line removed, compiled the same way into a scratch
directory and deleted.

| Build | Compiled bytes | Preflights |
|---|---|---|
| With the adapter import, as shipped | **131,265** | **2** |
| The same file with only the import line removed | **123,631** | **1** |

**The whole difference is 7,634 bytes, and it is not the duplicated Preflight on its own.** That
difference also carries the adapter's `@theme inline` block, the contract's 89 custom properties, its
three `@font-face` rules and the utilities the second import mints. No build isolated the Preflight
from the rest, and this record does not claim one did. The no-adapter build is a measurement and not
an alternative: without the import every `var(--token-*)` in the theme block resolves to nothing and
the application does not render.

**Decision: the cost is absorbed, and `cs-tracker` keeps its own `@import "tailwindcss" source(none);`
line.** `ops/daisyui-route.md` action 4 named dropping that line as one way to avoid the second
Preflight. It is not taken. `cs-tracker/AGENTS.md:24-31` requires that exact import syntax kept, and
the `source(none)` half is what holds Tailwind's automatic source detection off. Trading a documented
repository rule and a bounded class scan for roughly 7 KB before compression is the wrong trade.

### Cost 2: the `--color-accent` collision

Answered above under "What `--color-accent` means now". It is closed by making both systems name the
same role, not by documenting a divergence.

**Decision: AD-14's assigned import stands.** `cs-tracker` imports `cuatro-contracts/tailwind.css`,
not the plain `tokens.css` plus `fonts.css` pair. The route resolves identically under either import
(**Observed 2026-08-25**, `ops/daisyui-route.md` § The composition observation), so this is a decision
about utilities and not about the mapping: a plain `:root` file mints zero utility classes in Tailwind
v4, and `cs-tracker` is a Tailwind consumer.

### That `source(none)` still governs, calibrated

`ops/daisyui-route.md` recorded the same claim as "a clean negative across five compiles, not a
calibrated instrument", because no build in that run had automatic source detection on and nothing
showed the marker would have been minted if it had. That is now closed against the real build.

**Observed 2026-08-27.** A marker candidate `m-[13px]` was planted at
`cs-tracker/cuatro_probe_source_marker.ex`, a file no `@source` line in `app.css` names. The real
build did **not** mint `.m-\[13px\]`. A control stylesheet naming that same file **did** mint it. So
the negative is calibrated: the adapter's own bare `@import "tailwindcss"` does not re-enable
detection, and the outer `source(none)` governs.

### That the vendored folder is excluded, and what that is worth

**Observed 2026-08-27**, two halves.

| Half | Result |
|---|---|
| With nothing planted, the real build and a control with only the `@source not` line removed mint the **same 366 selectors**, the unexcluded build adding **0** | The published contract contributes no utility candidate of its own today, so the exclusion is **precautionary rather than load bearing**. It is stated that way rather than implied to be doing work |
| With `p-[7px]` planted inside the vendored folder, the real build did **not** mint `.p-\[7px\]` and the unexcluded control **did** | The exclusion is what stops it, rather than the candidate never having been reachable. So the line works, and it will keep working if a future contract file happens to carry a class-like token |

**The probe plants five files inside `cs-tracker` for those two cases and the daisyUI-only control,
removes all five in a `finally`, and asserts `git status --porcelain` in that repository is
byte-identical before and after.** That assertion is its own named case, because a probe that reads
another repository and leaves a file behind has edited it.

## Where the compiled output lands, and the fonts task

`contracts/tailwind.css` pulls in `fonts.css`, and the pinned CLI carries its `url()` values through
the `@import` **unrebased**. The compiled stylesheet therefore asks for `./fonts/<face>.woff2`
relative to wherever it lands, and `cs-tracker` compiles to `priv/static/assets/css/app.css`, which is
not the vendored folder.

`ops/tailwind-adapter.md:176-178` names two supported routes. **This story takes the second: copy
`fonts/` next to wherever the output lands.** The first, rewriting the urls in the consumer's own
bundler, would mean adding a CSS post-processing step to an asset pipeline that today is two standalone
binaries and nothing else.

| Property | Value | Nature |
|---|---|---|
| Task | `mix cuatro.fonts`, at `lib/mix/tasks/cuatro.fonts.ex` | **Decision** |
| Source | `assets/css/cuatro-contracts/fonts/*.woff2` | **Decision** |
| Target | `priv/static/assets/css/fonts/` | **Decision.** Exactly where the compiled `url()` values point |
| Wired into | `assets.setup`, `assets.build`, and `assets.deploy` **before** `phx.digest` | **Decision.** `assets.setup` as well, because the dev watchers at `config/dev.exs:27-30` call Tailwind and esbuild directly and never reach `assets.build`, so a tree that has only ever run `mix setup` would serve a stylesheet whose faces 404 |
| Committed | **No.** `cs-tracker/.gitignore:29` ignores `/priv/static/assets/`, so the copied faces are a build step | **Observed 2026-08-27** |
| Refuses to copy nothing | Yes, `Mix.raise` on a missing directory and on a directory with no `.woff2` | **Decision.** Missing this step is the one adoption instruction that fails silently: every face 404s and the page falls back to a system stack that looks almost right |
| Converges rather than adds | Yes. Any `.woff2` in the target the source no longer carries is pruned | **Decision.** A face renamed by a contract MINOR would otherwise survive as a stale file, be fingerprinted by `phx.digest`, and ship for ever |

**The target is bound to the compiled stylesheet, not to a string.** `cuatro_fonts_test.exs` reads
the Tailwind profile's `--output` out of `Application.get_env(:tailwind, :cs_tracker)` and asserts
`@target_rel` equals `Path.dirname` of it plus `fonts`, and the probe reads the same two values out of
`config/config.exs` and the task itself. Editing either alone turns a case red rather than 404ing
three faces in production. The alias wiring is asserted the same way, including that `cuatro.fonts`
precedes `phx.digest` in `assets.deploy`.

**Observed 2026-08-27**, `mix assets.build` from a removed `priv/static/assets`:

```
cuatro.fonts: copied 3 face(s) into priv/static/assets/css/fonts: bricolage-grotesque-latin.woff2, geist-latin.woff2, geist-mono-latin.woff2
```

and the three faces are present at the path the compiled stylesheet's `url()` values resolve to.

**What the probe's `The font faces resolve` case does and does not prove.** It serves the compiled
stylesheet beside a `fonts/` directory it staged itself and asserts each face answers 200. That is the
**placement route**: faces sitting beside the compiled file resolve. It is **not** the pipeline, and
it reads identically whether `mix cuatro.fonts` exists or not, which the case's own text now says.
The pipeline is the separate `The build pipeline places them` case, which reads `mix.exs`, the task
and `config/config.exs`, plus the Elixir suite's `run/1` case against the real tree.

## The probe

`ops/cs-tracker-adoption-probe.mjs`. It compiles `cs-tracker`'s **real** `assets/css/app.css` with
`cs-tracker`'s **own** pinned Tailwind 4.1.12 binary out of its `_build`, serves the output over
`node:http` beside the contract's three faces, renders a fixture page carrying the daisyUI class
strings `core_components.ex` and `layouts.ex` actually emit, and reads computed values in Playwright's
Chromium. It then loads the Hub's own built stylesheet in the same browser for the FR-18 row.

**Why it compiles rather than running the application.** `mix test` needs a Postgres and
`mix phx.server` needs the whole stack, and neither renders CSS any differently from the compiler.
What the acceptance criteria ask for is the computed value of a theme variable on a daisyUI component,
which is a property of the compiled stylesheet plus the markup.

**The fixture carries the application's own markup, and that is checkable rather than claimed.** Every
class string in it names the `cs-tracker` file it came from, and the probe re-reads those files and
refuses to run if one token is no longer there, delimited on both sides so `btn-primary` cannot stand
in for `btn`. `ops/__tests__/cs-tracker-adoption-probe.test.ts` shows that matcher firing on a planted
drift.

**It writes nothing into `cs-tracker` that survives the run.** The compiled output goes to a scratch
directory under the OS temporary directory, removed in a `finally`; five control files are planted
inside `cs-tracker` for the scan cases, removed in the same `finally`, and the tree is compared
against what it was before the run as a named case.

### How to re-run it

```
corepack pnpm install
corepack pnpm build
node ops/cs-tracker-adoption-probe.mjs
```

The build line is not decoration: the FR-18 row reads the Hub's **built** stylesheet, and a tree with
no `.next/static` reports the named Block If condition and reads nothing. Beyond that it needs
`cs-tracker` checked out beside this repository with its pinned Tailwind binary installed
(`mix assets.setup`), its git history reachable at `ff7667b`, and a Playwright Chromium build on the
host (`corepack pnpm exec playwright install chromium`).

It takes no argument and reads no environment variable that selects what it tests, so the run that
produced the transcript below is the run anyone else gets.

**Read the exit code, not just the word non-zero:**

| Code | Meaning |
|---|---|
| `0` | every named case passed, the scratch tree is gone and `cs-tracker` is untouched |
| `1` | a named case failed, or something was left behind. **This is the regression signal** |
| `2` | a defect in the probe itself, reported as a stack |
| `3` | a Block If condition: no `cs-tracker`, no pinned Tailwind binary, no Chromium, no built Hub stylesheet, no reachable baseline commit, or the vendored adapter does not compile inside the real `app.css`. Nothing was observed, so nothing was answered |

**Nothing in CI runs it, and that is the finding rather than an omission.** It needs a browser and a
checkout of another repository, and neither is on a runner. AD-21's blocking rule is about gates that
exist; this is a reproduction tool. Its pure parts carry standing unit cases under the blocking `test`
job, so a later edit cannot quietly make it unable to fail.

### The transcript, verbatim

**Observed 2026-08-27**, `node ops/cs-tracker-adoption-probe.mjs`, started `2026-08-27T20:56:29.662Z`,
exit 0, 18 cases, 18 PASS, elapsed 14.4s, on the Windows 11 development host.

```
# cs-tracker token adoption probe, Story 1-19, FR-18 and SM-6
# started 2026-08-27T20:56:29.662Z

# scratch tree: C:\Users\NumCuatro\AppData\Local\Temp\cuatro-cs-tracker-adoption-6BczrC
# cs-tracker:   C:\CuatroEcosystem\cs-tracker-workspace\cs-tracker
# tailwind:     C:\CuatroEcosystem\cs-tracker-workspace\cs-tracker\_build\tailwind-windows-x64.exe (tailwindcss v4.1.12)
# daisyui:      5.0.35
# hub css:      .next\static\chunks\0_u9bwwtyuv6_.css

PASS  The folder is a verbatim copy: 9 file(s) (pinned at 9) under assets/css/cuatro-contracts are byte-identical to contracts/ by sha256: fonts.css 4c954f73c713a01023e2bb22b56b73f343f17bf9d0a8beeb5ea844f8ea19872f, fonts/OFL-bricolage-grotesque.txt 4b5a7d8f37f5602621c8a8d7358a6a2e71317e6c231c661e15aef0275d3e07ba, fonts/OFL-geist-mono.txt c683bfbcc7e087f5d37a54ef628f10387c451a83ddc459b151403a164ac46c90, fonts/OFL-geist.txt c683bfbcc7e087f5d37a54ef628f10387c451a83ddc459b151403a164ac46c90, fonts/bricolage-grotesque-latin.woff2 f27b91934aa5559116b55e670d5d0e0c00d4408b0e1a44c3d0b59ab20afb792c, fonts/geist-latin.woff2 db540d97a0afd5f39a8f331c2b4aa259c56e943e05acfae752637fcf1976e336, fonts/geist-mono-latin.woff2 14bf6b01f51a5172bc24327b63ee2a3b3e04d87329fccba275dc9789e7cbb89c, tailwind.css 1b0e3c609f0a2851885801d5fc0a75e31d9754fa30ead847c4e5b3d80d3fdc5f, tokens.css 319a825597995cbecacc43f08da9b24b48db636abc2b1e023ea4387a5cb38462
PASS  It compiles at all: cs-tracker's real assets/css/app.css compiled with its own pinned tailwindcss v4.1.12 to 131265 bytes, Preflight emitted 2 time(s)
PASS  Route A resolves in the real stylesheet: LIVE: .btn.btn-primary computed rgba(143, 126, 240, 1.000) and .badge.badge-primary computed rgba(143, 126, 240, 1.000), against var(--token-accent) declared inline in the same page computing rgba(143, 126, 240, 1.000), and against daisyUI 5.0.35's own default primary oklch(0.45 0.24 277.023)
PASS  The whole daisyUI colour family: 12 of the 20 --color-* names the theme block declares are mapped onto a contract role (pinned at 12), and 8 keep a literal (pinned at 8: --color-info, --color-info-content, --color-success, --color-success-content, --color-warning, --color-warning-content, --color-error, --color-error-content). Every mapped name computes the value of its role: --color-base-100 = --token-bg = rgba(6, 5, 9, 1.000); --color-base-200 = --token-bg-raised = rgba(13, 12, 19, 1.000); --color-base-300 = --token-bg-raised-2 = rgba(22, 21, 28, 1.000); --color-base-content = --token-text = rgba(238, 238, 242, 1.000); --color-primary = --token-accent = rgba(143, 126, 240, 1.000); --color-primary-content = --token-bg = rgba(6, 5, 9, 1.000); --color-secondary = --token-bg-raised-2 = rgba(22, 21, 28, 1.000); --color-secondary-content = --token-text = rgba(238, 238, 242, 1.000); --color-neutral = --token-accent-muted = rgba(86, 76, 145, 1.000); --color-neutral-content = --token-text = rgba(238, 238, 242, 1.000); --color-accent = --token-accent = rgba(143, 126, 240, 1.000); --color-accent-content = --token-bg = rgba(6, 5, 9, 1.000)
PASS  Shape and stroke come from the contract: 4 shape and stroke rows (pinned at 4), each read off :root through a probe declaring the daisyUI name beside one declaring the role: --radius-selector = --r-none = 0px; --radius-field = --r-none = 0px; --radius-box = --r-none = 0px; --border = --stroke-boundary = 1px
PASS  No surface left on the previous theme: 27 oklch() literals (pinned at 27) were retired between ff7667b and now, derived from git rather than transcribed, and the pinned list agrees with the derivation. 0 survive in the compiled stylesheet. 1 of them (oklch(0% 0 0)) are also emitted by a daisyUI only build carrying no theme block at all, so they are daisyUI's own and are not attributed to the retired theme. 1 @plugin "../vendor/daisyui-theme" block(s) remain in app.css, name dark
PASS  Hand-fix 1, S-11: :root computed color-scheme: dark
PASS  Hand-fix 2, S-12: ::selection declares { background-color: var(--token-accent); color: var(--token-bg); }, which reads the accent and the ground rather than a literal, and computed background rgba(143, 126, 240, 1.000) against --token-accent rgba(143, 126, 240, 1.000), foreground rgba(6, 5, 9, 1.000) against --token-bg rgba(6, 5, 9, 1.000)
PASS  Hand-fix 3, S-2: button#btn under :focus-visible computed outline-width 2px against --stroke-focus 2px, outline-style solid, outline-color rgba(198, 189, 255, 1.000) against --token-focus rgba(198, 189, 255, 1.000), outline-offset 3px against --focus-offset 3px, and transition-property "color, background-color, border-color, box-shadow"
PASS  Hand-fix 4, S-3: 4 controls read: input = 0px, select = 0px, textarea = 0px, btn = 0px
PASS  Type comes from the contract: 3 of 3 --f-* families are declared on :root (--f-display = "Bricolage Grotesque", "Archivo", system-ui, sans-serif; --f-body = "Geist", ui-sans-serif, system-ui, sans-serif; --f-mono = "Geist Mono", ui-monospace, SFMono-Regular, monospace), and the shell's computed font-family is Geist, ui-sans-serif, system-ui, sans-serif
PASS  The font faces resolve: 3 non-data url() value(s) in the compiled stylesheet, each answering 200 from a directory this probe staged itself beside the output: ./fonts/bricolage-grotesque-latin.woff2 -> 200, ./fonts/geist-latin.woff2 -> 200, ./fonts/geist-mono-latin.woff2 -> 200. This proves the PLACEMENT ROUTE, that faces sitting beside the compiled file resolve, and NOT the pipeline: the probe copied them there, so it reads identically whether mix cuatro.fonts exists or not. The pipeline is the next case.
PASS  The build pipeline places them: mix cuatro.fonts writes to priv/static/assets/css/fonts, and the Tailwind profile writes its stylesheet to priv/static/assets/css/app.css, whose url() values therefore resolve in priv/static/assets/css/fonts. The two agree. It runs in assets.setup: true, in assets.build: true, in assets.deploy: true, and there before phx.digest, which rewrites the url() values onto the digested names and needs the files present to do it
PASS  Automatic source detection stays off: m-[13px] planted at cuatro_probe_source_marker.ex, which no @source line in app.css names. The real build did not mint .m-\[13px\], and a control stylesheet that names that file did mint it, so the negative is calibrated rather than a marker nothing would ever have minted. The adapter's own bare @import "tailwindcss" therefore does not re-enable detection: the outer source(none) governs
PASS  The vendored contract is excluded from the scan: p-[7px] planted inside the vendored folder. The real build did not mint .p-\[7px\], and a control with only the @source not line removed did mint it, so the exclusion is what stops it rather than the candidate never being reachable. Measured before anything was planted, the two builds mint the same 366 selectors and the unexcluded one adds 0 (none), so the published contract contributes no candidate of its own today and the exclusion is precautionary rather than load bearing

# FR-18, the shared contract read in one browser, canonicalised to 8-bit sRGB where it is a colour
  name                       cuatro.dev (built)                                     cs-tracker (compiled)
  --token-bg                 rgba(6, 5, 9, 1.000)                                   rgba(6, 5, 9, 1.000)
  --token-bg-raised          rgba(13, 12, 19, 1.000)                                rgba(13, 12, 19, 1.000)
  --token-bg-raised-2        rgba(22, 21, 28, 1.000)                                rgba(22, 21, 28, 1.000)
  --token-text               rgba(238, 238, 242, 1.000)                             rgba(238, 238, 242, 1.000)
  --token-text-secondary     rgba(152, 151, 159, 1.000)                             rgba(152, 151, 159, 1.000)
  --token-border             rgba(40, 40, 48, 1.000)                                rgba(40, 40, 48, 1.000)
  --token-border-interactive rgba(101, 100, 113, 1.000)                             rgba(101, 100, 113, 1.000)
  --token-accent             rgba(143, 126, 240, 1.000)                             rgba(143, 126, 240, 1.000)
  --token-accent-hover       rgba(173, 161, 255, 1.000)                             rgba(173, 161, 255, 1.000)
  --token-accent-muted       rgba(86, 76, 145, 1.000)                               rgba(86, 76, 145, 1.000)
  --token-focus              rgba(198, 189, 255, 1.000)                             rgba(198, 189, 255, 1.000)
  --token-scrim              rgba(6, 6, 9, 0.878)                                   rgba(6, 6, 9, 0.878)
  --f-display                "Bricolage Grotesque", Archivo, system-ui, sans-serif  "Bricolage Grotesque", Archivo, system-ui, sans-serif
  --f-body                   Geist, ui-sans-serif, system-ui, sans-serif            Geist, ui-sans-serif, system-ui, sans-serif
  --f-mono                   "Geist Mono", ui-monospace, SFMono-Regular, monospace  "Geist Mono", ui-monospace, SFMono-Regular, monospace
  --t-3xs                    11px                                                   11px
  --t-2xs                    12px                                                   12px
  --t-xs                     13px                                                   13px
  --t-sm                     14px                                                   14px
  --t-base                   16px                                                   16px
  --t-md                     20px                                                   20px
  --t-lg                     25px                                                   25px
  --t-xl                     31.2496px                                              31.2496px
  --t-2xl                    39.0624px                                              39.0624px
  --t-display                72px                                                   72px

PASS  FR-18 side by side: 12 --token-* roles (pinned 12), 3 --f-* families (pinned 3) and 10 --t-* sizes (pinned 10) were read off :root in the Hub's built stylesheet and in cs-tracker's compiled stylesheet, in one browser at 1280x720. 25 of 25 are equal across them.
# contrast, WCAG 2.1 over the 8-bit sRGB values read above
  --color-base-100 on --color-base-content             17.56:1
  --color-base-200 on --color-base-content             16.82:1
  --color-base-300 on --color-base-content             15.67:1
  --color-primary on --color-primary-content           6.20:1
  --color-secondary on --color-secondary-content       15.67:1
  --color-neutral on --color-neutral-content           6.39:1
  --color-accent on --color-accent-content             6.20:1
  --token-bg on --token-focus                          11.73:1
  --token-bg-raised on --token-focus                   11.24:1
  --token-bg-raised-2 on --token-focus                 10.47:1

PASS  Every pair clears its contrast floor: 10 pairs computed from the values this run read, 3 grounds against --color-base-content, 4 fill-and-content pairs and 3 focus-ring readings. All clear their floor (4.5:1 for text, 3:1 for the ring).
# diagnostics, which never carry a verdict
  compiled bytes                      = 131265
  Preflight emitted                   = 2 time(s)
  --color-primary as EMITTED          = var(--token-accent)
  --color-accent as EMITTED           = var(--token-accent)
  --color-* names in the compiled css = 23
  shell                              background-color = rgba(13, 12, 19, 1.000)
  navbar                             background-color = rgba(6, 5, 9, 1.000)
  wordmark                           background-color = rgba(143, 126, 240, 1.000)
  btn                                background-color = rgba(143, 126, 240, 1.000)
  btn-ghost                          background-color = rgba(0, 0, 0, 0.000)
  badge                              background-color = rgba(143, 126, 240, 1.000)
  badge-neutral                      background-color = rgba(86, 76, 145, 1.000)
  badge-success                      background-color = rgba(0, 150, 137, 1.000)
  card                               background-color = rgba(6, 5, 9, 1.000)
  alert                              background-color = rgba(13, 12, 19, 1.000)
  spinner                            background-color = rgba(238, 238, 242, 1.000)
  chromium                            = 151.0.7922.34

PASS  cs-tracker's tree is unchanged: 5 file(s) were planted inside it for the scan and control builds and 5 were removed, and git status --porcelain is byte-identical to what it was before the run
# scratch tree removed: C:\Users\NumCuatro\AppData\Local\Temp\cuatro-cs-tracker-adoption-6BczrC (exists afterwards: false)

# 18 cases, 18 PASS, 0 FAIL
# elapsed 14.4s
# finished 2026-08-27T20:56:44.112Z
```

## The retired palette, derived rather than transcribed

The first pass of this story checked eight warm-neutral literals and called it "no surface left on the
previous theme". That overclaimed: the `dark` block declared twelve colour literals and the deleted
`light` block declared its own, none of which were checked.

**The set is now derived.** The probe runs `git show ff7667b:assets/css/app.css` inside `cs-tracker`,
takes every `oklch()` literal the baseline declared, subtracts every one the current file still
declares, and gets **27**. `cs-tracker`'s own suite cannot reach this repository's reasoning, so it
carries the same 27 as a pinned list, and the probe fails if the derivation and the list disagree.
That is what keeps the transcription honest in the repository that cannot derive it.

**One survivor is attributed correctly rather than excused.** `oklch(0% 0 0)` appears in the compiled
stylesheet. It was the deleted `light` block's `--color-accent`, and it is **also** emitted by a
daisyUI-only control build carrying no theme block at all, so it is daisyUI's own and not a survivor
of the retired theme. That attribution is measured on every run against that control build rather than
written into an exception list here. The other 26 are absent.

## FR-18, read twice

The table above is the acceptance condition for "the Ecosystem is visible", and how it was read
matters as much as what it says.

| Property | Value | Nature |
|---|---|---|
| What was read | 12 `--token-*` roles, 3 `--f-*` families, 10 `--t-*` sizes. **25 rows**, all equal | **Observed 2026-08-27** |
| Where | `:root` in `cuatro.dev`'s built stylesheet (`.next/static/chunks/0_u9bwwtyuv6_.css`, the one chunk that declares `--c-paper`) and in `cs-tracker`'s compiled stylesheet | **Observed 2026-08-27** |
| How | One Chromium 151.0.7922.34, one viewport (1280x720), one probe shape: an element declaring `background-color: var(--role)`, `font-family: var(--family)` or `font-size: var(--size)` inline, read back with `getComputedStyle` | **Decision** |
| Guarded per name | Every row asserts the name is DECLARED on `:root` on **both** sides and that both computed values are non-empty and painted, before comparing | **Decision.** An undeclared `--f-*` or `--t-*` makes both probes inherit the same document default, so the row would report agreement between two values nobody published. `unreadableRows` is a pure function with its own unit cases, including the case where both sides read `16px` from nothing |
| Colours canonicalised | To 8-bit sRGB, by rasterising the computed colour through a 1x1 canvas in the page | **Decision**, and load-bearing. See below |
| The names | Derived from `contracts/tokens.css` by namespace rather than restated, with the three counts pinned at 12, 3 and 10 | **Decision.** A floor cannot see a removed name |
| Viewport fixed | Yes. `--t-display` is `clamp(2.25rem, 9vw, 4.5rem)`, so a comparison across two viewports would compare two different numbers | **Decision** |

**Why the colours are canonicalised, and why that is not a weakening.** Next 16's build minifies
`oklch(12% 0.011 288)` into a `#rrggbb` fallback plus a `lab()` override behind
`@supports (color: lab(0% 0 0))`, which Chromium takes. So the two stylesheets serialise the same
colour in different colour spaces, and a string comparison would report a difference that does not
exist. Rasterising both sides through the same engine to the same 8-bit sRGB triple is the comparison
FR-18 actually asks for: what a Visitor sees. **The comparison is exact, not tolerant**: all 25 rows
are equal to the byte, with no epsilon anywhere in the probe, so a real drift still fails.

One row reads slightly differently on both sides and is worth naming. `--token-scrim` reports
`rgba(6, 6, 9, 0.878)` where `--token-bg` reports `rgba(6, 5, 9, 1.000)`, because a semi-transparent
fill is premultiplied on its way through the canvas and the green channel rounds up by one. Both
sides take the identical path and report the identical value, so the row is a valid comparison; the
figure is simply not the un-premultiplied triple.

## Which gates cover this, and which do not

| Gate | Covers | Nature |
|---|---|---|
| `mix test` in `cs-tracker` | `test/cs_tracker_web/token_contract_test.exs` (26 cases), `test/mix/tasks/cuatro_fonts_test.exs` (13 cases), and the rewritten `app_shell_test.exs` cases (7, one more than the 6 it carried) | **Observed 2026-08-27.** 653 tests, 0 failures, 4 excluded. 613 before this story |
| `mix format --check-formatted`, `mix compile --warnings-as-errors` | The house rules | **Observed 2026-08-27**, both exit 0 |
| `corepack pnpm test --run` in `cuatro-portfolio` | `ops/__tests__/cs-tracker-adoption-probe.test.ts`, 49 cases over the probe's pure parts | **Observed 2026-08-27** |
| `node ops/cs-tracker-adoption-probe.mjs` | Everything rendered, 18 named cases | **Not a CI job**, and cannot be: no browser and no `cs-tracker` on a runner |

**Every matcher in the Elixir suite is shown firing on a planted control**, and every parse asserts it
read something: the file-list parser is run against a scratch copy carrying a planted extra file and
against one with `tokens.css` removed, the theme-block finder against a planted second block **and
against a planted `}` inside a comment** with the naive `[^}]*` matcher shown getting that one wrong,
the declaration parser against a commented-out declaration, the retired-literal matcher against a
planted literal, the alias matcher against a planted alias list with the task removed, and the
outline-transition matcher against a planted `transition-property: color, outline`. The same
discipline holds in the probe's unit suite: `compareHashes` refuses to call two empty trees a verbatim
copy, `fileList` and `hashTree` are pinned against the real nine paths so a walk that stopped
recursing fails, and `routeVerdict` reports `does not compile`, `no reference`, `SPLIT` and `dead` as
four distinct findings rather than flattening them into one failure.

## Stated limits

| Limit | Why it stands | Nature |
|---|---|---|
| **No component was restyled** | Replacing daisyUI's component classes with token-driven markup is Story 8.1 under `RESTYLE-SPEC.md` § Family A. This story maps the theme layer and stops (AD-20: a migration step carries nothing else). Every class name in `core_components.ex` is unchanged, which is why the existing component tests stayed green untouched | **Decision.** Story 1-19 scope |
| **The four status pairs are not on the contract** | `contracts/tokens.css` publishes no role meaning success, warning, danger or info. They keep their Story 7.1 values | **Decision**, recorded above |
| **Five of the twelve roles reach no surface here** | `--token-border`, `--token-border-interactive`, `--token-text-secondary`, `--token-accent-hover` and `--token-scrim` map onto no daisyUI name. They are published, vendored and equal across the two applications; they are simply not consumed yet | **Observed 2026-08-27**, recorded above so the FR-18 table is not read as coverage |
| **The two applications still paint visibly different borders** | `cs-tracker` draws every border from `border-base-300`, which maps to `--token-bg-raised-2` (`rgba(22, 21, 28)`). The Hub draws borders from `--token-border` (`rgba(40, 40, 48)`), a different value. daisyUI publishes no separate border **colour** role, only `--border` for the width, so there is nowhere in the theme layer to put it. **The FR-18 case reports 25 of 25 equal and this divergence at the same time, and both are true**: that case compares `:root` values, not what a component paints. Settled in Story 8.1, where the components stop reading daisyUI's names | **Observed 2026-08-27** |
| **`--color-secondary` repeats `--color-base-300`** | The contract publishes three grounds; daisyUI wants five fills. Nothing in this application paints a secondary surface, so the repetition costs nothing visible today. `--color-neutral` was moved off a ground because it is live | **Decision**, disclosed rather than discovered later |
| **Seam S-8's antecedent was not evaluated** | "If visible" needs a running LiveView application. Recorded in its own section above, with the surviving transitions enumerated, and handed to the Operator | **Decision** |
| **The 44x44 hit-target pass was not made here** | `epics.md:1955-1962` puts the manual accessibility pass in Story 1.20. The contract's `--tap` is vendored and reachable; nothing in this story measures a hit target | **Decision.** Story 1.20 |
| **The probe reads a compiled stylesheet, not a running Phoenix server** | `mix test` needs a Postgres and `mix phx.server` needs the whole stack, and neither renders CSS differently from the compiler. What was NOT exercised is LiveView actually serving those class strings; that is what `mix test`'s LiveView suites cover, separately | **Decision**, with the split disclosed |
| **The FR-18 reading is one host, one Chromium, one viewport** | Windows 11 development host, Chromium 151.0.7922.34, 1280x720. No other operating system, browser engine or viewport has run it, and nothing re-runs it on a schedule | **Decision.** Pending Operator action 2 |
| **`DAISYUI_DEFAULT_PRIMARY` is hand-copied** | The value the components must DIFFER from, `oklch(0.45 0.24 277.023)`, comes from `ops/daisyui-route.md`'s `unmapped` control rather than from a build made here. Under `cs-tracker`'s real `themes: false` there is no daisyUI default at `:root` to measure. Every "equal to the token value" claim is measured against a probe element in the same page, so the hand-copied value carries only the negative half of the comparison | **Decision**, disclosed |
| **The `@source not` exclusion is precautionary** | Measured: with it removed and nothing planted, the build mints the identical 366 selectors. It stops a planted candidate, so it works; it stops nothing today | **Observed 2026-08-27** |
| **DW-1 will turn two gates red when it is fixed** | `contracts/` is exactly nine files today, and that count is pinned twice: by `@expected_files` in `cs-tracker`'s Elixir suite and by the probe's whole-tree comparison. The folder-identifying file DW-1 asks for is a tenth file, so adding it fails both **in `cs-tracker`** until that repository re-vendors. That is the correct behaviour for a drift check and it is a real coordination cost, so it is written down rather than discovered | **Decision.** `_bmad-output/implementation-artifacts/deferred-work.md` |
| **The `mix assets.deploy --minify` figure is unknown** | Both compiled-byte figures here are unminified. The deploy path adds `--minify`, and no run recorded here used it | **Observed 2026-08-27**, by reading `mix.exs` |
| **Nothing is deployed** | `cs-tracker.cuatro.dev` still serves the Story 7.1 palette until the Operator deploys. This story changes a repository, not a running site | **Decision.** Pending Operator action 1 |

## Pending Operator actions

This file hands the Operator work Story 1-19 may not do, in the shape `ops/token-contract.md`,
`ops/font-contract.md`, `ops/tailwind-adapter.md` and `ops/daisyui-route.md` use.

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Push and deploy `cs-tracker`** | Operator | Pushing to a remote and deploying are Operator acts and neither is a story's. Until it happens, `cs-tracker.cuatro.dev` serves the Story 7.1 warm-orange palette and a Visitor moving between the two applications still sees two products, which is the very thing FR-18 measures | _not done_ |
| 2 | **Add this probe to AD-22's refresh scope**, then re-run `node ops/cs-tracker-adoption-probe.mjs` on that schedule | Operator | The real trigger is narrower than the schedule and matters more: **any Tailwind or daisyUI bump reaching `cs-tracker`**, and **any contract MINOR**. Nothing in CI can catch either, since nothing in CI runs this. The probe exits non-zero if the mapping stops resolving or the two stylesheets stop agreeing, so re-running it is the whole check. `ops/daisyui-route.md`'s own action 2 asks for the same thing for the sibling probe, and the two should go into the scope together | _not done_ |
| 3 | **Decide whether `--color-secondary` should stay on a repeated ground** | Operator | The contract has three grounds and daisyUI wants five fills. `--color-neutral` was moved off a ground in this story because it is live; `--color-secondary` is not used anywhere in `cs-tracker` today, so it was left repeating `--color-base-300`. The first surface that wants a secondary fill will need this decided, and both alternatives cost something a story may not spend: publishing a fourth ground is a contract MINOR, and mapping it onto an accent role changes what the word means | _not done_ |
| 4 | **Record the visual check of the deployed application**, once action 1 lands | Operator | Every figure here is read off a compiled stylesheet in a fixture page. What no probe here has seen is the application's own screens at their own widths, and the seam list is explicit that S-6, dense data UI, is where a token contract's reach ends. This is the pass that would find a surface the fixture never rendered. **Watch the `--depth: 0` change in particular**: buttons, inputs, menus and tabs lose daisyUI's shadow and gradient overlay, which is the intended outcome and is also the largest single change to how a control looks | _not done_ |
| 5 | **Evaluate seam S-8 on the running application**, during the same pass | Operator | S-8 is the one seam whose antecedent, "if LiveView DOM patching visibly interrupts a transition", cannot be observed anywhere this story reaches. The transitions that survive are enumerated above. If one snaps under `phx-update`, the fix is `phx-update="ignore"` on the animated container, and it is cheap once known | _not done_ |

**Maintaining this file.** When an action is performed, replace its `_not done_` cell with the ISO
8601 UTC completion date and leave the row in place. When a figure is re-measured, add the new row
with its own date and method and keep the old one, so a later reader can see whether a number moved
or was simply re-stated. Deletion is not used here.
