# The daisyUI adoption route

The written record of which of AD-15's two token mappings actually renders in `cs-tracker`: the
answer, the rendered evidence for it, the `app.css` fragment Story 1.19 applies, the versions the
answer is pinned to, what would make it stale, what happens when `cuatro-contracts/tailwind.css`
sits beside daisyUI in one stylesheet, the stated limits, and the work this file hands the Operator.

Written during Story 1-15 on **2026-08-25** (ISO 8601 UTC), against baseline commit `d4404ee`.

**This file closes AD-15 open item O-3.** O-3 asked whether Tailwind v4's `@plugin` option parser
accepts a `var()` reference and renders the token value, or whether the plain `[data-theme="..."]`
rule is the only live path. It is answered below, and Story 1.19 is unblocked.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/token-contract.md`, `ops/font-contract.md`, `ops/rendered-output-harness.md`
and `ops/tailwind-adapter.md` set: every value is marked **Observed** with its method or **Decision**
with its reason (NFR-9), and every date is ISO 8601 UTC.

## The answer

**Both routes are live, they produce the identical rendered result, and route A is the mapping
Story 1.19 applies.**

| Route | AD-15 name | Live | Nature |
|---|---|---|---|
| A | `@plugin ".../daisyui-theme" { --color-primary: var(--token-accent); }` | **yes** | **Observed 2026-08-25**, computed `background-color` of two daisyUI components in Chromium |
| B | unlayered `[data-theme="cuatro"] { --color-primary: var(--token-accent); }` after the plugin | **yes** | **Observed 2026-08-25**, same method, and it won over a competing literal inside the plugin block |

**AD-15 picks route A itself, once the test comes back positive.** Its rule reads: `cs-tracker` maps
daisyUI's variables onto the token roles "through `@plugin "daisyui/theme" { --color-primary:
var(--token-accent); }` if a scratch `mix phx.new` confirms `var()` is accepted there, and through
`[data-theme="…"] { --color-primary: var(--token-accent); }` if it is not"
(`ARCHITECTURE-SPINE.md:170`). The scratch `mix phx.new` confirms it is accepted. So the choice is
not a preference expressed here; it is AD-15's own conditional, resolved by the observation this
story exists to make. Route B stays recorded as live because AD-15 also says both paths produce the
same rendered result, and that half is now measured rather than assumed.

Route A was the one in doubt, because the daisyUI theme plugin transforms no value: whether it works
is a question about Tailwind's `@plugin` option parser rather than about daisyUI. The parser passes
the `var()` through untouched. **Observed 2026-08-25** in the compiled output:

```
plugin-var   --color-primary as EMITTED by the CLI  = oklch(45% 0.24 277.023) | var(--token-accent)
```

The first value is daisyUI's own default light theme at `:root`; the second is what the theme plugin
emitted for `[data-theme="cuatro"]`. The reference survives compilation, so it resolves in the
browser at use time rather than being flattened at build time. That is the explanation, and it is
not the evidence. The evidence is the section below.

## How it was observed, and why it is four builds and not one

The question reads as a yes or no, and a yes tested alone would be worthless. If the fixture never
painted the token colour anywhere, route A and a build with no mapping at all would both compute
daisyUI's default, and the run would report "route A does not work" for a reason with nothing to do
with `var()`.

So four variants compile in one run, differing in exactly one line of one stylesheet:

| Variant | Role | The one line that moves |
|---|---|---|
| `unmapped` | control | the theme declares no `--color-primary`, so daisyUI's own default theme supplies one |
| `literal` | reference | `--color-primary: oklch(66% 0.165 288)`, the value `--token-accent` resolves to |
| `plugin-var` | route A | `--color-primary: var(--token-accent)` inside the `@plugin` block |
| `css-var` | route B | an unlayered `[data-theme="cuatro"]` rule after the plugin, over a plugin block declaring a decoy `oklch(50% 0.2 140)` |

**A route is live when both its components compute equal to `literal` and different from
`unmapped`, and a route that is not live FAILS its case.** `literal` is what "resolved to the token
value" looks like rendered. `unmapped` is what "did not" looks like. Every verdict is a comparison
against both, and the run fails loudly rather than reporting a verdict if the control ever equals
the reference.

**That the failing outcomes actually fail is load-bearing**, because Pending Operator action 2 below
tells the Operator that re-running the probe is the whole check on a toolchain bump. A run in which
route A quietly stopped resolving must not exit 0. The verdict is a pure function fed injected
observations, and `ops/__tests__/daisyui-route-probe.test.ts` holds every outcome to its result: a
dead route fails, a build that did not compile fails and is reported as `does not compile` rather
than as `dead`, a missing reference reports `no reference`, and two components that disagree with
each other report the split.

**Two components are read, not one,** so the finding is about the theme variable rather than about
one component's quirk: `.btn.btn-primary`, which reaches `--color-primary` through `--btn-bg` then
`--btn-color`, and `.badge.badge-primary`, which reaches it through `--badge-bg` then
`--badge-color`. Two different variable chains onto one theme variable. Both chains were read out of
the vendored bundle, `assets/vendor/daisyui.js:652` for the button and `:559` for the badge, where
`".badge-primary"` sets `"--badge-color": "var(--color-primary)"` and `".badge"` paints from
`--badge-bg` over it. That reading is why two components were chosen and it carries no verdict; the
verdict is the computed value. `--color-primary` is also read raw off the document element, and that
too is a diagnostic which never carries the verdict.

**Why route B's plugin block carries a decoy.** `cs-tracker`'s real theme blocks all declare
`--color-primary` today (`assets/css/app.css:37` and `:73`), so a route B that only worked against an
empty slot would not be a route. The decoy is a colour that is neither the accent nor anything daisyUI
ships, so "the unlayered rule won" and "the `var()` did not resolve" cannot be confused. **Decision.**

**The evidence is a rendered-output observation and nothing else.** No claim here rests on reading
daisyUI's or Tailwind's source. The compiled output is quoted where it explains a result, never where
it stands in for one.

## The observed values

**Observed 2026-08-25** on the Windows 11 development host, from `node ops/daisyui-route-probe.mjs`,
started `2026-08-25T22:09:28Z`, exit 0, 7 cases, 7 PASS, elapsed 110.6s. Verbatim:

```
# computed background-color, read in Chromium
  variant      role            component  computed background-color
  unmapped     control         btn        oklch(0.45 0.24 277.023)
  unmapped     control         badge      oklch(0.45 0.24 277.023)
  literal      reference       btn        oklch(0.66 0.165 288)
  literal      reference       badge      oklch(0.66 0.165 288)
  plugin-var   route A         btn        oklch(0.66 0.165 288)
  plugin-var   route A         badge      oklch(0.66 0.165 288)
  css-var      route B         btn        oklch(0.66 0.165 288)
  css-var      route B         badge      oklch(0.66 0.165 288)
  composition  for Story 1.19  btn        oklch(0.66 0.165 288)
  composition  for Story 1.19  badge      oklch(0.66 0.165 288)
```

**Read the four numbers.** `unmapped` is `oklch(0.45 0.24 277.023)`, daisyUI 5.0.35's own light
primary. `literal` is `oklch(0.66 0.165 288)`, which is `--token-accent`. Route A and route B both
compute `literal` exactly, on both components, and both differ from `unmapped`. **So the two routes
produce the same rendered result**, and AD-15's statement that either satisfies FR-18 holds as an
observation rather than as an assumption.

The reference is the browser's own resolution on both sides, not a string written here: the fixture
carries a `<span style="background-color: var(--token-accent)">` beside the components, and every
"equal to the token value" claim is measured against that element.

```
PASS  literal reference: both components computed oklch(0.66 0.165 288) and oklch(0.66 0.165 288), against var(--token-accent) declared inline computing oklch(0.66 0.165 288)
PASS  unmapped control: both components computed oklch(0.45 0.24 277.023) and oklch(0.45 0.24 277.023), differing from literal as a control must
PASS  plugin-var, route A: LIVE: components computed oklch(0.66 0.165 288) and oklch(0.66 0.165 288), against literal oklch(0.66 0.165 288) and unmapped oklch(0.45 0.24 277.023)
PASS  css-var, route B: LIVE: components computed oklch(0.66 0.165 288) and oklch(0.66 0.165 288), against literal oklch(0.66 0.165 288) and unmapped oklch(0.45 0.24 277.023)
PASS  Verdict: plugin-var, route A and css-var, route B are live. The two routes produce the same rendered result.
```

### The diagnostics, which carry no verdict

The whole block, unabridged, for all five builds:

```
# diagnostics, which never carry a verdict
  unmapped     --color-primary raw on <html>          = oklch(45% 0.24 277.023)
               --color-accent raw on <html>           = oklch(77% 0.152 181.912)
               var(--token-accent) declared inline    = oklch(0.66 0.165 288)
               .btn.btn-accent background-color       = oklch(0.77 0.152 181.912)
               .bg-accent background-color            = oklch(0.77 0.152 181.912)
               --color-primary as EMITTED by the CLI  = oklch(45% 0.24 277.023)
               automatic source detection minted m-[13px] = no
               Preflight emitted                      = 1 time(s)
               compiled bytes                         = 18130
  literal      --color-primary raw on <html>          = oklch(66% 0.165 288)
               --color-accent raw on <html>           = oklch(77% 0.152 181.912)
               var(--token-accent) declared inline    = oklch(0.66 0.165 288)
               .btn.btn-accent background-color       = oklch(0.77 0.152 181.912)
               .bg-accent background-color            = oklch(0.77 0.152 181.912)
               --color-primary as EMITTED by the CLI  = oklch(45% 0.24 277.023) | oklch(66% 0.165 288)
               automatic source detection minted m-[13px] = no
               Preflight emitted                      = 1 time(s)
               compiled bytes                         = 18173
  plugin-var   --color-primary raw on <html>          = oklch(66% 0.165 288)
               --color-accent raw on <html>           = oklch(77% 0.152 181.912)
               var(--token-accent) declared inline    = oklch(0.66 0.165 288)
               .btn.btn-accent background-color       = oklch(0.77 0.152 181.912)
               .bg-accent background-color            = oklch(0.77 0.152 181.912)
               --color-primary as EMITTED by the CLI  = oklch(45% 0.24 277.023) | var(--token-accent)
               automatic source detection minted m-[13px] = no
               Preflight emitted                      = 1 time(s)
               compiled bytes                         = 18172
  css-var      --color-primary raw on <html>          = oklch(66% 0.165 288)
               --color-accent raw on <html>           = oklch(77% 0.152 181.912)
               var(--token-accent) declared inline    = oklch(0.66 0.165 288)
               .btn.btn-accent background-color       = oklch(0.77 0.152 181.912)
               .bg-accent background-color            = oklch(0.77 0.152 181.912)
               --color-primary as EMITTED by the CLI  = var(--token-accent) | oklch(45% 0.24 277.023) | oklch(50% 0.2 140)
               automatic source detection minted m-[13px] = no
               Preflight emitted                      = 1 time(s)
               compiled bytes                         = 18237
  composition  --color-primary raw on <html>          = oklch(66% 0.165 288)
               --color-accent raw on <html>           = oklch(77% 0.152 181.912)
               var(--token-accent) declared inline    = oklch(0.66 0.165 288)
               .btn.btn-accent background-color       = oklch(0.77 0.152 181.912)
               .bg-accent background-color            = oklch(0.66 0.165 288)
               --color-primary as EMITTED by the CLI  = oklch(45% 0.24 277.023) | var(--token-accent)
               automatic source detection minted m-[13px] = no
               Preflight emitted                      = 2 time(s)
               compiled bytes                         = 23425
```

### The run's own frame, verbatim

The lines around the table above, so the transcript quoted here is the whole run rather than the
parts that suit it. **Observed 2026-08-26**, from the verification run recorded under "How to re-run
it", which reproduced every figure on this page:

```
# daisyUI adoption route probe, Story 1-15, AD-15 open item O-3
# started 2026-08-26T00:40:00.613Z

PASS  Leftover sweep: 1 scratch directory swept, and the planted one is gone, this sweep having removed it
# scratch tree: C:\Users\NumCuatro\AppData\Local\Temp\cuatro-daisyui-probe-D1dSRj

# versions
  elixir               Elixir 1.19.5
  otp                  Erlang/OTP 28
  phxNew               phx_new-1.8.7
  phoenixRequired      ~> 1.8.7
  phoenixLocked        1.8.13
  tailwindConfigured   4.1.12
  tailwindGenerated    4.1.12
  tailwindBanner       tailwindcss v4.1.12
  esbuildConfigured    0.25.4
  esbuildGenerated     0.25.4
  daisyui              5.0.35
  profileArgs          --input=assets/css/app.css --output=priv/static/assets/css/app.css
  playwright           1.62.1
  node                 v24.15.0

# compile unmapped     ok
# compile literal      ok
# compile plugin-var   ok
# compile css-var      ok
# compile composition  ok
```

That `# versions` block is the evidence for the pin table further down: every row there was read by
the run rather than transcribed from a configuration file by hand. The closing lines:

```
# scratch tree removed: C:\Users\NumCuatro\AppData\Local\Temp\cuatro-daisyui-probe-D1dSRj (exists afterwards: false)

# 7 cases, 7 PASS, 0 FAIL
# elapsed 75.4s
# finished 2026-08-26T00:41:16.018Z
```

Route B's emitted list carries all three declarations, the decoy `oklch(50% 0.2 140)` included, and
the browser resolved the unlayered one. An unlayered author rule beats every layered rule whatever
its specificity, and the theme plugin emits into `@layer base` through `addBase`, so route B wins over
the plugin's own declaration. **Observed 2026-08-25.**

Both routes keep the `var()` in the emitted stylesheet, so neither flattens the token at build time.
That is not a difference between them.

## The fragment Story 1.19 applies

**What this story owns is the mapping declaration.** It is one line, and this is the line:

```css
  --color-primary: var(--token-accent);
```

It is **inserted into** each existing `@plugin "../vendor/daisyui-theme"` block in
`C:\CuatroEcosystem\cs-tracker-workspace\cs-tracker\assets\css\app.css`, replacing that block's
current literal `--color-primary` declaration and leaving its other 27 declarations where they are.
In context, with `cs-tracker`'s own `dark` block abbreviated to show where the line goes:

```css
@plugin "../vendor/daisyui-theme" {
  name: "dark";
  default: false;
  prefersdark: true;
  color-scheme: "dark";
  --color-primary: var(--token-accent);   /* <- the line this story owns */
  /* cs-tracker's remaining 27 declarations stay as they are. Which of them
     Story 1.19 also moves onto tokens is Story 1.19's decision. */
}
```

The second fence is an illustration of placement and is not itself a paste target: pasted whole it
would drop declarations `cs-tracker` currently has. The first fence is.

**What this story does not own is which contract file `cs-tracker` imports.** AD-14 already decides
that, and names `cs-tracker` in bold while doing it:

> Tailwind consumers, `cuatro-finance`, `cuatro-tracker`, `cs-tournament` and **`cs-tracker`**:
> import `tailwind.css`. Non-Tailwind consumers import `tokens.css` and `fonts.css`.
> (`ARCHITECTURE-SPINE.md:164`; `epics.md:1704-1705` repeats that `cs-tracker` is on Tailwind v4
> plus daisyUI, so "the adapter route applies and the plain-CSS route is not in play".)

AD-14 exists to prevent exactly the inverse of that, "a Phoenix application being handed a plain
`:root` file that mints zero utility classes" (`ARCHITECTURE-SPINE.md:163`). So the import line is:

```css
/* AD-14. The folder name is fixed at cuatro-contracts/ across every consumer,
   so AD-16's scheduled drift check has a target rather than a search. */
@import "../vendor/cuatro-contracts/tailwind.css";
```

placed after the `@source` lines and before the `@plugin` lines.

**The mapping is identical under either import, and that was measured rather than argued.**
**Observed 2026-08-25**: the four route variants import `cuatro-contracts/tokens.css` and route A
resolves; the composition variant imports `cuatro-contracts/tailwind.css` instead, carries the same
`--color-primary: var(--token-accent)` line, and route A resolves there too, computing
`oklch(0.66 0.165 288)` on both components against the same reference. The route question and the
import question are independent, which is why this story answers the first and leaves the second
where AD-14 put it.

**Read the fragment as Story 1.19 would apply it:** it names the live route (`@plugin`, not a plain
rule), the theme (`cs-tracker`'s existing `dark` and `light` blocks by name), and the token
(`--token-accent`), and the declaration itself drops into each existing block unedited.

**Route B is equally live and is the fallback**, in this shape, placed after both plugin blocks and
written once per theme, since `cs-tracker` declares `dark` and `light`:

```css
[data-theme="dark"] {
  --color-primary: var(--token-accent);
}
```

| Why route A rather than route B | Nature |
|---|---|
| **AD-15's own rule selects it.** The `@plugin` form is the route "if a scratch `mix phx.new` confirms `var()` is accepted there", and it does. Route B is the branch for the case that did not happen | **Decision.** AD-15, `ARCHITECTURE-SPINE.md:170` |
| The theme's values already all live in the plugin block. Route A adds nothing new to keep in step; route B adds a second place a theme name is written, and a rename of `dark` then silently stops applying | **Decision.** Story 1-15 |
| Route B is unlayered, so it wins over anything the plugin emits, including a later deliberate theme change. That is exactly what makes it a good fallback and a poor default | **Decision** |
| Neither is faster, smaller or more resolvable than the other. The compiled sizes differ by 65 bytes and the rendered results are identical | **Observed 2026-08-25** |

## The composition observation, for Story 1.19

AD-14 assigns `cs-tracker` the adapter import, so the fifth build compiles it: `app.css` imports
`cuatro-contracts/tailwind.css` beside daisyUI and carries route A through it. Verbatim:

```
PASS  Composition: cuatro-contracts/tailwind.css compiles beside daisyUI in one app.css, and route A still resolves there: its components computed oklch(0.66 0.165 288) and oklch(0.66 0.165 288) against literal oklch(0.66 0.165 288). 1 --color-* name is owned by both: --color-accent. On the collided name, .btn.btn-accent computed oklch(0.77 0.152 181.912) here against oklch(0.77 0.152 181.912) in a daisyUI only build, and the adapter utility .bg-accent computed oklch(0.66 0.165 288) here against oklch(0.77 0.152 181.912) there. The adapter's own bare @import "tailwindcss" did not re-enable automatic source detection, and Preflight was emitted 2 time(s) against 1 in a daisyUI only build.
```

Four things Story 1.19 acts on, all **Observed 2026-08-25**:

| Observation | What it means for Story 1.19 |
|---|---|
| **It compiles, and route A resolves through it.** The adapter and daisyUI coexist in one `app.css`, and `--color-primary: var(--token-accent)` inside the theme plugin still computes `oklch(0.66 0.165 288)` on both components | AD-14's assigned import is not in tension with the route this story picked. Nothing here is a blocker |
| **Exactly one `--color-*` name is owned by both: `--color-accent`.** The adapter publishes `--color-accent`, `--color-accent-hover`, `--color-accent-muted`, `--color-bg`, `--color-focus`, `--color-ink`, `--color-line`, `--color-line-strong`, `--color-muted`, `--color-scrim`, `--color-surface`, `--color-surface-2`, and daisyUI's theme also owns `--color-accent` | The two systems disagree about what "accent" means. **Observed**: daisyUI's `.btn-accent` computed daisyUI's teal `oklch(0.77 0.152 181.912)`, the same value it computes in a daisyUI only build, and `--color-accent` read raw off `<html>` computed that teal too, so daisyUI's theme declaration is the one that wins on the element. The adapter utility `.bg-accent` computed the contract's `oklch(0.66 0.165 288)` in the composed build against the same teal in the daisyUI only build. That second half is what `inline` means, and the explanation is not the evidence: Tailwind substitutes the theme variable's value at the use site, so `.bg-accent` emits `background-color: var(--token-accent)` and never reads `--color-accent` at all. **So the same word gives two different colours in one page**, silently, and no compiler says anything. Story 1.19 decides which one `cs-tracker` means and says so |
| **Preflight was emitted twice**, 23,425 bytes against 18,173. `contracts/tailwind.css` opens with its own bare `@import "tailwindcss"`, and `cs-tracker`'s `app.css` already opens with `@import "tailwindcss" source(none)` | A real cost of the adapter import, measured. It renders correctly. **What was measured is the whole 5,252 byte difference between the two builds, not the duplicated Preflight on its own**: that difference also carries the adapter's `@theme inline` block, its `@font-face` rules and the utilities the second import mints, and no build isolated the Preflight from the rest. The two emissions are the Observed figure; the byte split between them is not. Whether the cost is worth absorbing, worked around by dropping `cs-tracker`'s own `@import "tailwindcss"` line and letting the adapter's carry the build, or answered some other way, is Story 1.19's call against AD-14 |
| **The adapter's bare import did not re-enable automatic source detection.** A marker utility planted in an application source file that no `@source` line names was not minted in any of the five builds | The outer `source(none)` governs. `cs-tracker`'s explicit `@source` lines stay the whole scan, so adopting the adapter does not silently start crawling the repository. This was the larger of the two worries. **It rests on a negative with no positive control**: no build in this run had automatic source detection on, so nothing here demonstrates that the marker utility would have been minted if it had been. There is a second unstated assumption underneath it: the marker was planted at `lib/source_detection_marker.ex` in the scratch application, and nothing in the run establishes where detection would have scanned from had it been on, so a not-minted marker does not by itself separate "detection stayed off" from "detection was on and never looked there". Story 1.19 gets a clean negative across five compiles, not a calibrated instrument |

### The compiled output's placement, which is not a blocker

`contracts/tailwind.css` pulls in `fonts.css`, and the pinned CLI copies its `url()` values through
the `@import` unrebased, so a compiled build carries `./fonts/...` relative to wherever it lands.
`cs-tracker` compiles to `priv/static/assets/css/app.css`, which is not the vendored folder.

**`ops/tailwind-adapter.md:176-178` already names two supported routes for exactly that, and neither
is this story's to choose:** rewrite the urls in the consumer's own bundler, or copy `fonts/` next to
wherever the output lands. **This probe uses the second**, copying `contracts/fonts/` beside the
compiled stylesheet it serves, so that the `url()` values a composed build carries point at files the
fixture server can answer for. **No face was measured**: nothing in the probe reads a
`font-family`, a `document.fonts` entry or a font request, because every value this file rests on is a
`background-color` and a face would carry no verdict. That the urls resolve is the placement route
being exercised rather than an observation of a rendered face.
So the placement rule is a decision Story 1.19 makes from two known options, not an obstacle it has
to discover. Variants 1 to 4 import `tokens.css` alone, request no face, and are unaffected either
way.

## The versions this answer is pinned to

Every row is **Observed 2026-08-25** unless marked otherwise, and each names where it was read. The
probe refuses to compile anything if the Tailwind banner does not name 4.1.12 or the vendored
daisyUI does not name 5.0.35, so these two are enforced rather than merely recorded.

| What | Value | Where it was read |
|---|---|---|
| daisyUI | **5.0.35**, asserted | `var version` in the bundle, which is `cs-tracker`'s own `assets/vendor/daisyui.js` copied verbatim into the scratch application |
| daisyUI theme plugin | the `daisyui-theme.js` shipped beside it | `cs-tracker`'s own `assets/vendor/daisyui-theme.js`, copied verbatim |
| Tailwind CLI | **4.1.12**, asserted, banner `tailwindcss v4.1.12` | configured in the scratch `config.exs`, then read off the downloaded standalone binary with `--help` |
| Tailwind, as `cs-tracker` configures it | `4.1.12` | `cs-tracker/config/config.exs:210`. **Decision**, theirs |
| esbuild | **0.25.4** | configured in the scratch `config.exs`, matching `cs-tracker/config/config.exs:200`. Not exercised: no JavaScript is compiled by this probe |
| Phoenix, required | `~> 1.8.7` | the scratch `mix.exs`, which `phx_new-1.8.7` generated, matching `cs-tracker/mix.exs` |
| Phoenix, resolved | **1.8.13** in the scratch application, against **1.8.7** in `cs-tracker/mix.lock` | both `mix.lock` files. The difference cannot reach the observation: `mix tailwind` shells out to the standalone Tailwind binary and Phoenix contributes nothing to CSS compilation |
| `phx_new` archive | `phx_new-1.8.7` | `mix archive` |
| Elixir and OTP | `Elixir 1.19.5`, `Erlang/OTP 28` | `elixir --version` |
| Asset profile args | `--input=assets/css/app.css --output=priv/static/assets/css/app.css` | the scratch `config.exs`, matching `cs-tracker/config/config.exs:212-215` |
| Chromium | **151.0.7922.34** | `browser.version()` |
| Playwright | **1.62.1** | `@playwright/test/package.json`, the pin Story 1-10 set |
| Node | `v24.15.0` | `process.version` |

### What would make this finding stale

| Change | Effect | Nature |
|---|---|---|
| **A Tailwind 4.x bump** | Route A is a fact about Tailwind's `@plugin` option parser, which is the component that could plausibly start validating or rewriting option values. This is the one to re-run the probe against | **Decision.** Pending Operator action 2 |
| **A daisyUI major bump** | The theme plugin's `addBase` shape and the `--color-primary` name are both daisyUI's. A 6.x could move either | **Decision** |
| **A daisyUI 5.0.x bump** | Lower risk, but the `unmapped` control's value `oklch(0.45 0.24 277.023)` is daisyUI's own default light primary and will move with it. The probe asserts the pinned 5.0.35 and refuses to compile against anything else, so a bump is a loud failure that names what to do rather than a quietly different number | **Observed 2026-08-25** |
| **A contract MINOR that changes `--c-accent`'s value** | The `literal` variant's `oklch(66% 0.165 288)` is a copy of what `--token-accent` resolves to, taken from `contracts/tokens.css:17`. It is the one hand-copied value in the probe, and it would have to move with the token. The run fails loudly if it drifts, because `literal` is compared against `var(--token-accent)` read in the browser | **Decision**, with the failure mode made loud on purpose |
| **A Phoenix or esbuild bump** | No effect on this finding. Neither participates in the CSS compile | **Decision** |

## The scratch application

**It was created outside every estate repository, and it is gone.**

| Fact | Value | Nature |
|---|---|---|
| Where it lived | `%TEMP%\cuatro-daisyui-probe-<random>`, under the OS temporary directory. The 2026-08-25 run used `C:\Users\NumCuatro\AppData\Local\Temp\cuatro-daisyui-probe-74ZMsY` | **Observed 2026-08-25**, printed by the probe |
| How it was made | `mix phx.new daisy_probe --install --no-ecto --no-mailer --no-gettext --no-dashboard` | **Decision** |
| Removed | yes, in a `finally`, so a failure removes it too. The probe prints `exists afterwards: false` and every recorded run did. A removal that cannot complete, a file locked under `_build` for instance, is printed as its own line rather than thrown, so it neither hides the real error nor leaves the reader believing the tree is gone, **and it makes the run exit non-zero**, because a promise nothing can fail is not one | **Observed 2026-08-25**, and again 2026-08-26 |
| Swept before building | yes. A directory is planted under the scratch prefix on every run, the sweep runs, and its absence afterwards is an asserted case rather than a hope. The sweep leaves alone both the active root and any tree whose marker names a process that is still running, and an unclaimed tree younger than the claim grace, so two probes at once do not delete each other's application. The sweep itself still runs over the shared temporary directory, because that is where real leftovers are, so the planted directory being **gone** is the assertion rather than which of two concurrent sweeps removed it. A real leftover the sweep could not remove fails the case | **Observed 2026-08-25**, `PASS Leftover sweep`, with the skip and failure behaviour covered by `ops/__tests__/daisyui-route-probe.test.ts` |
| Committed anywhere | **no.** Not the application, not `deps/`, not `_build/`, not the compiled CSS, not the daisyUI bundles | **Decision.** AC3 |
| `cs-tracker` | read only. Two files were copied out of it and nothing was written to it | **Observed 2026-08-25**, by `git status --porcelain` in that repository before and after |
| Nothing written into `cuatro-portfolio` | every spawn runs with its working directory inside the scratch tree, and `ERL_CRASH_DUMP` is redirected there too. The BEAM writes a dump of several megabytes into its working directory when it terminates during boot, which `elixir --version` does under a shell with no console attached, and an 8.8 MB `erl_crash.dump` was **observed** landing in the repository root on 2026-08-25 from a run made there by hand before this was fixed | **Observed 2026-08-25**, then closed, and `git status --porcelain` is empty after a run |

## How to re-run it

```
corepack pnpm install
node ops/daisyui-route-probe.mjs
```

The install line is not decoration. The probe resolves `@playwright/test` out of **this repository's**
`node_modules`, through `createRequire` from `ops/`, and it is the only way it reaches a browser.
A tree with no `node_modules` reports the named Block If condition and reads nothing.

It takes no argument and reads no environment variable that selects what it tests, so the run that
produced the output above is the run anyone else gets. It prints its own elapsed figure on the last
lines: **110.6s** on the development host for the run recorded here, most of it
`mix phx.new --install`.

Beyond the install it needs Elixir with the `hex` and `phx_new` archives, network reach to `hex.pm`
and to the Tailwind release the `tailwind` mix task fetches, `cs-tracker` checked out beside this
repository, and a Playwright Chromium build on the host (`corepack pnpm exec playwright install
chromium`). Each of those missing produces a named Block If message rather than a stack trace. It
reports one named case per row of the story's matrix, PASS or FAIL with the values it read.

**Read the exit code, not just the word non-zero.** A route that stopped resolving and a host with no
Chromium on it are different answers, and Pending Operator action 2 rests on being able to tell them
apart:

| Code | Meaning |
|---|---|
| `0` | every named case passed and the scratch application is gone |
| `1` | a named case failed, or the scratch application survived removal. **This is the regression signal** |
| `2` | a defect in the probe itself, reported as a stack |
| `3` | a Block If condition: no Elixir, no network, no Chromium, no `cs-tracker` beside this repository. Nothing was observed, so nothing was answered |

The reason for a `3` is printed on stdout as a `# BLOCKED:` line as well as on stderr, so a captured
stdout transcript carries it.

**It is reproducible, and here is exactly how that was checked.** Each run's stdout was captured to a
file, and two transcripts were compared with the scratch directory name and the two timestamps
substituted out, by `Compare-Object` over the normalised lines. **Observed 2026-08-25**: an
independent run from `21:49:39Z` to `21:51:02Z`, building its own application from scratch, matched
its predecessor line for line, reproducing every computed value, every emitted declaration and the
compiled byte counts 18130, 18173, 18172, 18237 and 23426. That comparison predates the change that
moved the composition variant from the literal onto route A, so the composition figures quoted in
this file (23425 bytes, and `var(--token-accent)` in its emitted list) come from the later run and
are the ones a re-run reproduces. The four route variants' figures are unchanged across all of them.
**Observed 2026-08-26**: a further run, after the sweep and reporting changes recorded in this
story's Review Triage Log at
`_bmad-output/implementation-artifacts/spec-1-15-determine-cs-tracker-s-daisyui-adoption-route.md`,
reproduced every computed value, every verdict and all five compiled byte counts, at `7 cases,
7 PASS`, exit 0, in 85.0s on a warm hex cache. Only the elapsed figure and the timestamps moved.
**Observed 2026-08-26**, a second time: the run quoted under "The run's own frame" above, made after
the failure-path and reporting changes of the third review pass, again reproduced every computed
value, every emitted declaration, every verdict and all five compiled byte counts, at `7 cases,
7 PASS`, exit 0, in 75.4s. The only line whose text moved is `PASS Leftover sweep`, whose wording
that pass changed.

**Nothing in CI runs it, and that is the finding rather than an omission.** It needs Elixir, a hex
fetch and a browser, and none of the three is on a runner. AD-21's blocking rule is about gates that
exist; this is a reproduction tool. A prose recipe for rebuilding the application is the failure this
repository keeps finding, a claim nothing exercises, so the script that produced the recorded output
is committed instead of a recipe, and its pure parts carry standing unit cases so a later edit
cannot quietly make it unable to fail.

## Stated limits

| Limit | Why it stands | Nature |
|---|---|---|
| **The scratch application is pinned to `cs-tracker`'s toolchain, not to its stylesheet** | Tailwind 4.1.12, esbuild 0.25.4, `{:phoenix, "~> 1.8.7"}` and `cs-tracker`'s own daisyUI 5.0.35 bundles are all matched, and the first and last are asserted. Two things in the stylesheet are deliberately **not** matched. daisyUI is loaded as `themes: light --default` where `cs-tracker` writes `themes: false`, because the `unmapped` control needs a daisyUI default theme underneath it or it would measure an unpainted element rather than a colour, and a control that paints nothing cannot show what "did not resolve" looks like. And `@plugin "../vendor/heroicons"` is not loaded, because it mints icon utilities no fixture here uses. **The first of those two is load-bearing rather than incidental**, and in one direction: loading daisyUI's own light theme is exactly what puts `--color-primary: oklch(45% 0.24 277.023)` at `:root`, which is the value the `unmapped` control measures, so under `cs-tracker`'s real `themes: false` there would be no declaration underneath and a failed mapping would paint nothing instead of a colour. It does not touch what the mapped variants compute: in `literal`, `plugin-var`, `css-var` and `composition` the theme block's own declaration wins on the element, and route B's decoy shows the mapping still wins against a competing declaration inside the plugin block. What was therefore **not** measured is what a failed mapping looks like in `cs-tracker`'s own configuration; Story 1.19 should not expect the four-number comparison to reproduce there as written. The heroicons omission touches nothing here at all | **Decision**, disclosed rather than papered over |
| **One theme was compiled, not `cs-tracker`'s two** | The probe declares a single theme, `name: "cuatro"`, `default: false`, `prefersdark: false`, carrying 13 declarations plus the one under test. `cs-tracker`'s `dark` block is `prefersdark: true` and its `light` block is `default: true`, and each carries 28 declarations. `default: true` changes which selector the theme plugin emits into, adding a `:root` rule beside the `[data-theme]` one. So what was compiled is the `@plugin` option-parser behaviour that route A depends on, in a theme block of the same shape; what was **not** compiled is either of `cs-tracker`'s exact blocks, or two themes in one stylesheet, or a `default: true` theme | **Observed 2026-08-25.** Story 1.19 compiles the real thing |
| **AD-15's own specifier form was never compiled** | AD-15 writes the route as `@plugin "daisyui/theme"`, a bare package specifier. `cs-tracker` has no `package.json` and no `node_modules`: it vendors both bundles and loads them by relative path, so the bare form could not resolve in its build at all. The probe compiled `@plugin "../vendor/daisyui-theme"`, which is what `cs-tracker`'s `app.css:24` actually writes. The finding is about the option parser either way, but the literal string in AD-15 is not the string that was tested | **Observed 2026-08-25**, by reading `cs-tracker`'s tree |
| **The finding is about `--color-primary` and generalises by argument, not by measurement** | Both routes were tested on one theme variable through two components. daisyUI treats every `--color-*` in a theme block identically, and the mechanism observed is Tailwind's option parser rather than anything specific to `primary`, so a second variable would exercise the same code path. It was not measured | **Decision** |
| **`cs-tracker` has a light theme and the contract is dark only** | `contracts/tokens.css` publishes one palette. Mapping `cs-tracker`'s `light` block onto it is Story 1.19's problem, and this probe declares one theme | **Observed 2026-08-25**, by reading `contracts/tokens.css:2` |
| **Nothing was adopted** | This story changes no application file, in this repository or in `cs-tracker`. The outcome gates the step and not the contract, which is what AD-15 says | **Decision.** Story 1-15 scope |
| **The probe pins the Tailwind CLI through the mix task, not through this repository's `node_modules`** | The scratch application downloads the standalone 4.1.12 binary the `tailwind` hex package fetches, which is the compiler `cs-tracker` actually runs. It is a different compiler from the `@tailwindcss/cli` 4.3.3 that `tests/e2e/contract-tailwind.pw.ts` pins, deliberately: this finding is about `cs-tracker`'s toolchain | **Decision** |
| **Five runs, one host, one Chromium** | Every figure is from the Windows 11 development host, three runs on 2026-08-25 and two on 2026-08-26. The composition figures quoted here were produced by three of the five, the two earliest predating the change that moved the composition variant onto route A; the four route variants' figures are reproduced by all five. No other operating system, Chromium build or Elixir release has run it. The probe is committed so the run is repeatable, but nothing re-runs it on a schedule | **Decision.** Pending Operator action 2 |
| **The run populates the host's hex package cache** | `mix phx.new --install` fetches into `~/.hex` and `~/.mix`, outside the scratch tree, which no cleanup removes. Nothing is created or modified in any estate repository | **Observed 2026-08-25** |

## Pending Operator actions

This file hands the Operator work Story 1-15 may not do, in the shape `ops/token-contract.md`,
`ops/font-contract.md`, `ops/rendered-output-harness.md` and `ops/tailwind-adapter.md` use.

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Amend the three places that still say O-3 is open**, pointing each at this file: `EXPERIENCE.md:1048` (the open-items table row), `epics.md:816` (Epic 1's "Also carries" list, "O-3 daisyUI `var()` gate") and AD-15's Binds line at `ARCHITECTURE-SPINE.md:168` | Operator | O-3 is answered: both routes are live, they render identically, and AD-15's own conditional therefore selects route A. The answer is recorded at the `ops/` surface because that is where this estate records observations, and amending a frozen planning record is an Operator act rather than a story's. Until those three lines move, a reader of the planning artefacts is told the question is open | _not done_ |
| 2 | **Add `ops/daisyui-route.md` and its probe to AD-22's refresh scope**, then re-run `node ops/daisyui-route-probe.mjs` on that schedule | Operator | As things stand AD-22's scope does not include this probe, so no schedule picks it up and the action would name a review that never happens. `ops/routing-inventory.md` was written into that scope explicitly (`ARCHITECTURE-SPINE.md:325`) and is the pattern to copy. The real trigger is narrower than the schedule and matters more: **any Tailwind or daisyUI bump reaching `cs-tracker`**, because route A is a fact about Tailwind's `@plugin` option parser at 4.1.12. Nothing in CI can catch it moving, since nothing in CI runs this. The probe exits non-zero if any route stops being live, so re-running it is the whole check | _not done_ |
| 3 | **Decide what `--color-accent` means in `cs-tracker`**, when Story 1.19 lands | Operator | It is the one name daisyUI's theme and the contract adapter both own, and the composed build gives it two different colours in one page: daisyUI's teal on `.btn-accent`, the contract's violet on `.bg-accent`. Nothing errors, nothing warns, and the page looks almost right | **2026-08-27.** Story 1-19 maps daisyUI's `--color-accent` onto `--token-accent`, so one word gives one colour and the collision is closed rather than documented. The decision, and the computed values on both sides after it, are in `ops/cs-tracker-token-adoption.md` § What `--color-accent` means now |
| 4 | **Confirm the adapter import for `cs-tracker` against AD-14, with the two measured costs in hand** | Operator | AD-14 assigns `cs-tracker` `tailwind.css` by name, and this story does not overturn that: the route works identically under either import, measured. What the composition build adds is the price, so the decision is informed rather than reversed. The two costs are a duplicated Preflight (2 emissions, 23,425 bytes against 18,173) and the `--color-accent` collision in action 3. If the adapter is imported, `ops/tailwind-adapter.md:176-178`'s two placement routes apply and one of them has to be chosen, because `cs-tracker` compiles to `priv/static/assets/css/app.css` and not into the vendored folder | **2026-08-27.** Confirmed: `cs-tracker` imports `cuatro-contracts/tailwind.css` and keeps its own `@import "tailwindcss" source(none)` line, so the second Preflight is absorbed deliberately. Both costs were re-measured against the real stylesheet rather than the scratch one, at 131,265 bytes with the import against 123,631 without, and the placement question is answered by the second of `ops/tailwind-adapter.md`'s two routes, a new `mix cuatro.fonts` task. The composition build's other worry is also closed there: that the adapter's bare `@import "tailwindcss"` leaves `source(none)` governing is now a calibrated negative rather than a marker nothing would ever have minted. See `ops/cs-tracker-token-adoption.md` § The two measured costs of the adapter import |

**Maintaining this file.** When an action is performed, replace its `_not done_` cell with the ISO
8601 UTC completion date and leave the row in place. When a figure is re-measured, add the new row
with its own date and method and keep the old one, so a later reader can see whether a number moved
or was simply re-stated. Deletion is not used here.
