# The Tailwind adapter

The written record of `contracts/tailwind.css`: what the adapter publishes, the mapping table, what
is deliberately not mapped and why, why publishing it bumps no version, where a consumer must put
its compiled output, how the file is regenerated, which gate covers it and why no new job was added,
the two dependencies the browser check needed with their measured cost, the probe output, the stated
limits, and the work this file hands the Operator.

Written during Story 1-13 on **2026-08-25** (ISO 8601 UTC), against baseline commit `c07038d`.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/token-contract.md`, `ops/font-contract.md` and
`ops/rendered-output-harness.md` set: every value is marked **Observed** with its method or
**Decision** with its reason (NFR-9), and every date is ISO 8601 UTC.

## Why the file exists at all

Research and `DESIGN.md:1058-1066` are explicit that a plain external file defining custom
properties under `:root` generates **zero utility classes** in Tailwind v4. `contracts/tokens.css`
and `contracts/fonts.css` are exactly such files, so `cuatro-finance`, `cuatro-tracker`,
`cs-tournament` and `cs-tracker` could import the whole contract and still have no `bg-accent`.

That is not a claim this record repeats on authority. It is measured, on every harness run, by the
negative control in `tests/e2e/contract-tailwind.pw.ts`: the same fixture compiled against
`tailwindcss` plus `tokens.css` with no `@theme` block. **Observed 2026-08-25** in
`mcr.microsoft.com/playwright:v1.62.1-noble` with Tailwind 4.3.3: of the 55 utilities the adapter
mints, **42 do not exist at all** in that build, and the remaining 13 exist only because Tailwind
already ships a utility of that name carrying its own default value. Not one rule in that compiled
output reads a contract token.

## What v1.0.0 publishes

`contracts/tailwind.css` is the third and last file of the v1.0.0 folder. It is the single entry
point for a Tailwind v4 consumer, and it is generated: `packages/tokens/build.mjs` emits it from the
same Style Dictionary run that writes `tokens.css`, driven by the committed translation table
`packages/tokens/theme-map.json`.

| Property | Value | Nature |
|---|---|---|
| Published path | `contracts/tailwind.css` | **Decision.** AD-1, AD-14 |
| Header version | `Contract v1.0.0`, read from `packages/tokens/package.json` and validated as exact `X.Y.Z` | **Decision.** AD-16 |
| Statements, in fixed order | `@import "tailwindcss"`, `@import "./tokens.css"`, `@import "./fonts.css"`, then one `@theme inline` block | **Decision.** `DESIGN.md:1018-1019` |
| Mappings | **55** | **Observed 2026-08-25**, by counting the entries in `theme-map.json` and the declarations in the published block, which a unit case asserts equal |
| Bytes on disk | **4,522** bytes over 3,862 characters and 94 lines | **Observed 2026-08-25**, by `Get-Item` and by reading the file as text. The two figures differ because the section rules and the header's middot are multi-byte UTF-8, not because the file carries a CR: a unit case asserts LF endings and one trailing newline |
| Line endings | LF, one trailing newline | **Observed**, asserted by `packages/tokens/__tests__/tailwind-adapter.test.ts`. Pinned by `.gitattributes` rule `contracts/**/*.css` |
| Executable content | none, and none anywhere under `contracts/` | **Decision.** AD-1, asserted by three unit cases |

**The `inline` keyword is mandatory rather than stylistic.** Without it a `var()` reference resolves
where the theme variable is defined rather than where it is used. This system has no `[data-theme]`
override today, so nothing breaks now, but the moment one is added a non-`inline` block fails
**silently** across the cluster (`DESIGN.md:1012-1016`, AD-14).

**The `fonts.css` import is not optional either.** An adapter that pulled in only `tokens.css` would
hand the cluster three named families with no `@font-face` for any of them, so every face would fall
to `system-ui` and the page would look almost right (`DESIGN.md:1006-1010`). That is the exact
failure the three-file split exists to prevent, and it is easier to reintroduce here than anywhere
else, because the adapter is documented as the cluster's single entry point.

## The mapping table

Every row is a **Decision**: the names differ on purpose, and the table is the decision. `--color-ink`
reads `--token-text` and `--color-surface` reads `--token-bg-raised`, which no rule could derive.
The `Utility` column names the class the browser check probes, and the property it reads.

### Colour, 12 mappings

| Tailwind theme key | Contract token | Utility probed | Nature |
|---|---|---|---|
| `--color-bg` | `--token-bg` | `bg-bg`, `background-color` | **Decision.** `DESIGN.md:987` |
| `--color-surface` | `--token-bg-raised` | `bg-surface` | **Decision.** `DESIGN.md:988` |
| `--color-surface-2` | `--token-bg-raised-2` | `bg-surface-2` | **Decision.** `DESIGN.md:989` |
| `--color-ink` | `--token-text` | `bg-ink` | **Decision.** `DESIGN.md:990` |
| `--color-muted` | `--token-text-secondary` | `bg-muted` | **Decision.** `DESIGN.md:991` |
| `--color-line` | `--token-border` | `bg-line` | **Decision.** `DESIGN.md:992` |
| `--color-line-strong` | `--token-border-interactive` | `bg-line-strong` | **Decision.** `DESIGN.md:993` |
| `--color-accent` | `--token-accent` | `bg-accent` | **Decision.** `DESIGN.md:994` |
| `--color-accent-hover` | `--token-accent-hover` | `bg-accent-hover` | **Decision.** `DESIGN.md:995` |
| `--color-accent-muted` | `--token-accent-muted` | `bg-accent-muted` | **Decision.** Story 1-13, covering the twelfth role the authored block did not sample |
| `--color-focus` | `--token-focus` | `bg-focus` | **Decision.** `DESIGN.md:996` |
| `--color-scrim` | `--token-scrim` | `bg-scrim` | **Decision.** Story 1-13, same reason. The published declaration keeps `--token-scrim`'s own rule: imagery to text only, never a surface |

### Type, 29 mappings

| Tailwind theme key | Contract token | Utility probed | Nature |
|---|---|---|---|
| `--font-display` | `--f-display` | `font-display`, `font-family` | **Decision.** `DESIGN.md:997` |
| `--font-sans` | `--f-body` | `font-sans` | **Decision.** `DESIGN.md:998` |
| `--font-mono` | `--f-mono` | `font-mono` | **Decision.** `DESIGN.md:999` |
| `--text-3xs` … `--text-2xl`, `--text-display` | `--t-3xs` … `--t-2xl`, `--t-display` | `text-*`, `font-size` | **Decision.** Ten steps, one per scale step |
| `--font-weight-light`, `-regular`, `-medium`, `-bold`, `-black` | `--w-light` … `--w-black` | `font-*`, `font-weight` | **Decision.** Five weights |
| `--leading-display`, `-heading`, `-lede`, `-body`, `-label` | `--lh-*` | `leading-*`, `line-height` | **Decision.** Five line heights |
| `--tracking-display`, `-heading`, `-name`, `-body`, `-meta`, `-label` | `--tr-*` | `tracking-*`, `letter-spacing` | **Decision.** Six tracking values |

### Space, shape and measure, 14 mappings

| Tailwind theme key | Contract token | Utility probed | Nature |
|---|---|---|---|
| `--spacing-2xs` … `--spacing-3xl` | `--s-2xs` … `--s-3xl` | `p-*`, `padding` | **Decision.** Eight scale steps |
| `--spacing-page-pad` | `--page-pad` | `p-page-pad` | **Decision.** The page gutter is a spacing value even though its name carries no `--s-` prefix |
| `--spacing-tap` | `--tap` | `p-tap`, and `min-w-tap` and `min-h-tap` | **Decision.** The 44px hit-target floor. **Observed 2026-08-25**: all three compile to `var(--tap)`, and the harness asserts the two beyond the namespace's own probe rule, so the reachability claim in this row is exercised rather than stated |
| `--radius-none`, `--radius-hair`, `--radius-pill` | `--r-none`, `--r-hair`, `--r-pill` | `rounded-*`, `border-radius` | **Decision.** Three radii |
| `--container-measure` | `--measure` | `max-w-measure`, `max-width` | **Decision.** `46ch` is a container width, and `--container-*` is the namespace `max-w-*` reads |

## What is deliberately not mapped

Naming these here is the point of the section: an adapter that exists is easily mistaken for an
adapter that covers everything.

| Not mapped | Why not | Nature |
|---|---|---|
| `--ease-entrance`, `--ease-exit`, `--ease-toggle` | **The one true collision.** Tailwind v4's easing namespace is also `--ease-*`, so a mapping would carry the identical property name on both sides of its `var()`. AD-14 forbids exactly that, and the epic's second acceptance criterion names it as a cycle: it survives only by cascade accident and resolves to `transparent` the moment a bundler flattens the imports. Renaming a contract token is a MAJOR bump under AD-16 and is not this story's call. A consumer reaches them as `[transition-timing-function:var(--ease-entrance)]` or in plain CSS | **Decision.** The generator refuses a self-reference, so this is enforced and not merely intended |
| `--dur-micro`, `--dur-minor`, `--dur-major`, `--dur-exit` | Tailwind v4 has no theme namespace for a transition duration. A key such as `--duration-micro` is accepted by the compiler, stored, and mints nothing at all, silently. `duration-[var(--dur-minor)]` is the consumer's route | **Observed 2026-08-25.** Tailwind 4.3.3's namespace list carries no duration namespace |
| `--stroke-hair`, `--stroke-boundary`, `--stroke-emphasis`, `--stroke-focus`, `--focus-offset` | Same reason: v4 themes no border-width or outline-offset namespace | **Observed 2026-08-25** |
| `--z-base` … `--z-tooltip` | Same reason: v4 themes no z-index namespace | **Observed 2026-08-25** |
| `--elev-0`, `--elev-1`, `--elev-2` | They are aliases of three palette entries the `--color-*` rows already carry through their roles. A second key for the same value is a second thing to keep in step | **Decision** |
| The whole `--c-*` palette | AD-14: the raw palette is never consumed outside `contracts/`, and the semantic role layer is the only thing a consumer reads. The generator refuses a mapping that reaches for it | **Decision.** Enforced |
| `--radius-DEFAULT`, which the authored block in `DESIGN.md:1001` names | In Tailwind v4 that key mints `.rounded-DEFAULT`, **not** the bare `.rounded`, which keeps its own hardcoded `0.25rem`. The `*-DEFAULT` convention is a v3 idiom. It would also be a second key for `--r-none`, which `--radius-none` already carries | **Observed 2026-08-25** against Tailwind 4.3.3, by compiling a scratch build declaring it and reading the emitted selectors. Pending Operator action 1 |

**One thing that is mapped, and was questioned.** `--radius-none` looks inert, because
`rounded-none` exists in stock Tailwind and the negative-control output further down prints
`.rounded-none { border-radius: 0; }` from a build with no `@theme` block at all. It is not inert.
**Observed 2026-08-25** against 4.3.3: in the themed build the same selector compiles to
`.rounded-none { border-radius: var(--r-none); }`. Defining `--radius-none` in the theme replaces
Tailwind's static declaration with one that reads the contract token, so the mapping does change the
utility and the row stays. The harness asserts it by rule body rather than by computed value, which
is the only way to tell the two apart: both compute to `0px`.

## Why publishing this file bumps no version

The same reading Stories 1-11 and 1-12 recorded, and `DESIGN.md:805-815` and `:1036-1038` support it:
v1.0.0 was authored as a folder of three files, and **a token present at first publication is not an
addition**. `contracts/tokens.css`'s own shipped header has pointed at a sibling `fonts.css` since
Story 1-11, and `DESIGN.md`'s three-file table has named `tailwind.css` since before either shipped.
So the adapter is the third instalment of a first publication rather than an addition to a shipped
contract. It reads `Contract v1.0.0`, and neither published file beside it is regenerated.

**Verified rather than asserted**, **observed 2026-08-25**: `contracts/tokens.css`,
`contracts/fonts.css` and everything under `contracts/fonts/` are byte-identical to `c07038d`.

## Where a consumer must put its compiled output

**This is the one operational rule a Tailwind consumer has to get right, and it is not obvious.**

**Observed 2026-08-25** against `@tailwindcss/cli` 4.3.3: the CLI copies the `url()` values out of
`fonts.css` through the `@import` **unrebased**. The compiled stylesheet therefore carries
`url("./fonts/bricolage-grotesque-latin.woff2")` verbatim, relative to wherever the compiled file
itself lands, not to the vendored folder it came from.

So the rule is:

> A consumer does not compile `tailwind.css` itself. It writes its own entry stylesheet, which
> `@import`s the vendored adapter, and points its build at that. **The rule is about where that
> build's output lands: inside the vendored `cuatro-contracts/` folder, beside `fonts.css` and the
> `fonts/` directory.** Serving the compiled stylesheet from anywhere else 404s every face, silently,
> and the page falls back to a system stack that looks almost right.

The published header carries the same rule, in the same terms, because the header is what a
maintainer in a Satellite actually reads. It used to say "compile this file into the same folder it
sits in", which describes something no consumer does.

That is measured on every harness run, both ways. The check that loads the compiled file from inside
the vendored folder asserts each woff2 answers HTTP 200, by URL and per face. The check beside it
compiles the identical input one directory above the vendored folder and asserts each of the three
faces answers **404 at its own URL**, having first asserted that at least one woff2 was requested at
all, so a browser that requested nothing cannot satisfy it. Together they make the rule above an
observation rather than an assumption, and one that cannot quietly stop being true.

**A note on `document.fonts.check`, which sits beside the status assertion and does not carry it.**
It answers `true` for a family with no matching `@font-face` rule at all, because an unmatched family
resolves to a system font the browser considers available. It would therefore pass against an adapter
that never imported `fonts.css`. The HTTP 200 assertion is what proves the faces were fetched. What
availability adds is the other half of F-2 (`RESTYLE-SPEC.md:648`): a computed `font-family` read
returns the declared stack and passes identically when every woff2 has 404'd, so it cannot be the
check either. The two together are the check.

A consumer that would rather place its output elsewhere has two supported routes and neither is this
story's to choose: rewrite the urls in its own bundler, or copy `fonts/` next to wherever the output
lands.

## How the file is regenerated

```
corepack pnpm tokens:build
```

One command writes both `contracts/tokens.css` and `contracts/tailwind.css`. Nothing under
`contracts/` is ever hand-edited.

### The build inputs

`packages/tokens/build.mjs` reads three things and honours the two environment overrides Story 1-11
introduced.

| Input | Default | Nature |
|---|---|---|
| `tokens/*.json` | `packages/tokens/tokens/*.json`, or `$CUATRO_TOKENS_SOURCE/*.json` | **Decision.** Story 1-11 |
| `theme-map.json` | resolved as `<source directory>/../theme-map.json` | **Decision.** Story 1-13 |
| Version | `packages/tokens/package.json`'s `version`, validated as exact `X.Y.Z` | **Decision.** AD-16 |
| Output directory | `contracts/`, or `$CUATRO_TOKENS_OUTPUT` | **Decision.** Story 1-11 |

**Why the map resolves from the source directory and not from the package root.** A scratch run that
redirects `CUATRO_TOKENS_SOURCE` picks up that scratch tree's own map, so the generator still has two
build inputs rather than three and a test can corrupt the map without touching the real one. The
`tokens-contract` CI job pins both variables to the empty string, which the generator treats as
unset, so no runner environment can redirect the rebuild.

**Why the map sits beside `tokens/` and not inside it.** The Style Dictionary source glob is
`tokens/*.json`, and a map file in that directory would be read as tokens. **Decision.**

### What the generator refuses

Each refusal names the offending key and the file it came from, and each ends with the exact clause
"Nothing was published." **That is structural**: `refuseAdapter` appends the clause rather than each
message site writing it out, so the claim this record makes about the whole set cannot drift row by
row. It is also true, as a fact about Style Dictionary rather than a hope: **observed 2026-08-25**
against 5.5.2, `buildPlatform` formats every file in the platform before it writes any of them, so a
throw in either format leaves the output directory untouched. Verified by running the generator with
a corrupted map into an empty scratch directory and finding it still empty afterwards.

| Refusal | Matrix row |
|---|---|
| A mapping names a token the dictionary does not publish | "A mapping names a token that is gone" |
| A key and its token are the same name | "A mapping is a cycle" |
| A token in the raw `--c-*` palette | "A mapping reads the raw palette" |
| **A mapping whose token is the wrong kind for its namespace** | **"A mapping crosses a type"**, added 2026-08-25. `--color-bg: var(--s-md)` is a length in a colour slot. It satisfies every other refusal, publishes, and mints, and the browser check compares it **equal**, because the control element it is compared against reads the same wrong token. Nothing downstream of the generator can see it, so the generator carries a per-namespace table of which contract tokens may feed it |
| A key in a namespace Tailwind v4 does not theme, listing the permitted ones | "A key in an unknown namespace" |
| A key in a Tailwind namespace this adapter feeds no token into | Beyond the matrix: minting into a new namespace means deciding which tokens may feed it, which is a reviewed line in the generator rather than an accident in the map |
| A key that is a bare namespace with nothing after it (`--font-weight-`) | Beyond the matrix: Tailwind stores it and mints nothing. The namespace match is by **longest** prefix, so `--font-weight-bold` is a weight and not a font family |
| A map with no mappings, or a section with no entries | "An empty map" |
| The same Tailwind key declared twice | Beyond the matrix: one of the two would be discarded silently |
| A key or token that is not a plain custom property name | Beyond the matrix: a name carrying `;` or a brace would end its declaration early |
| A section title carrying a CSS comment delimiter | Beyond the matrix: it would close the generated comment and inject prose as CSS |
| A missing or unparseable `theme-map.json` | Beyond the matrix |
| A `theme-map.json` that parses to `null`, a number, a string or an array | Beyond the matrix: all four are valid JSON, and reading `.sections` off them used to throw a raw `TypeError` naming no file and no key |

Every one of them has a standing case in `packages/tokens/__tests__/tailwind-adapter.test.ts` that
runs the real generator against a corrupted copy of both inputs, asserts the message names the key
and ends with the clause, and asserts the output directory is empty afterwards. They are permanent
tests, not one-time probes, on the rule Story 1-11's review established: a gate never observed to
fail is not known to work, and a probe proves only the day it ran.

## Which gate covers the adapter, and why no new job was added

**No CI job was added by this story, and that is the finding rather than an omission.**

`.github/workflows/ci.yml`'s `tokens-contract` job already runs `pnpm tokens:build` and then
`git status --porcelain --ignored=matching -- contracts/`. That check reads the **whole** published
directory and reports an untracked path as well as a modified one, which is precisely why Story 1-11
wrote it that way: `ops/token-contract.md:419-441` records Probe 3, the demonstration that the check
sees a newly appeared file under `contracts/`. A third generated output from the same command needs
no new job and no edit to that file at all.

**Verified rather than assumed**, **observed 2026-08-25**: `git diff` against `c07038d` leaves
`.github/workflows/ci.yml` byte-identical.

## Probe output

### Probe 1: the drift gate over the adapter

**Observed 2026-08-25** on the Windows 11 development host. One mapping hand-edited in
`contracts/tailwind.css` and committed, then `corepack pnpm tokens:build`, then the two commands the
`tokens-contract` job runs. Verbatim:

```
$ git status --porcelain --ignored=matching -- contracts/
 M contracts/tailwind.css

$ git --no-pager diff -- contracts/
diff --git a/contracts/tailwind.css b/contracts/tailwind.css
index e1d26d7..53277bb 100644
--- a/contracts/tailwind.css
+++ b/contracts/tailwind.css
@@ -27,7 +27,7 @@
   --color-muted:        var(--token-text-secondary);
   --color-line:         var(--token-border);
   --color-line-strong:  var(--token-border-interactive);
-  --color-accent:       var(--token-accent-hover);
+  --color-accent:       var(--token-accent);
   --color-accent-hover: var(--token-accent-hover);
   --color-accent-muted: var(--token-accent-muted);
   --color-focus:        var(--token-focus);
```

The probe commit was removed and the working tree restored; nothing of it exists at the closing
commit.

**A note on what this gate can and cannot see.** It compares the committed file against what the
generator produces. A hand-edit that is never committed is simply overwritten by the rebuild and
leaves no trace, which is correct: the published artefact is what is committed.

### Probe 2: a generator refusal

**Observed 2026-08-25**, one mapping in a scratch copy of the map pointed at the raw palette, run
through `CUATRO_TOKENS_SOURCE` and `CUATRO_TOKENS_OUTPUT` into an empty scratch directory. Verbatim,
with the scratch paths shortened:

```
packages/tokens: reading  <scratch>/tokens/*.json
packages/tokens: reading  <scratch>/theme-map.json
packages/tokens: writing  <scratch>/out/tokens.css
packages/tokens: writing  <scratch>/out/tailwind.css

Error: packages/tokens/build.mjs: the theme key --color-bg in <scratch>/theme-map.json reads
--c-accent, which is the raw --c-* palette. AD-14 keeps the palette inside contracts/: the semantic
role layer is the only thing a consumer reads. Nothing was published.
```

The output directory held **0 files** afterwards, which is the half of the message that matters. The
two "reading" and two "writing" lines are printed before the build and say which inputs a run read
and where it would have written, which is what makes a redirected run visible in a job log even when
the build then fails.

### Probe 3: every mapping mints a working utility

**Observed 2026-08-25** in `mcr.microsoft.com/playwright:v1.62.1-noble` with Tailwind 4.3.3, from
`tests/e2e/contract-tailwind.pw.ts`. Each line is the utility's computed value on a probe element,
and each was asserted equal to the computed value of the same contract token declared directly on a
control element beside it, so both sides are the browser's own resolution rather than an expected
string.

**The computed-value comparison is not the whole check, and on its own it would not be enough.** It
is vacuous wherever the contract's value happens to equal Tailwind 4.3.3's own default, and seven of
the 55 rows are in that position: `--r-none` is `0` and so is Tailwind's, `--w-light` is `300`,
`--w-medium` `500`, `--w-bold` `700`, `--t-sm` `0.875rem`, `--t-base` `1rem`, and `--tr-body` is
`0em`, which computes to `normal` on both sides. Deleting any of those from the map would leave the
comparison green. So every row is also required to have a **compiled rule that reads its contract
token**: `.bg-bg` must emit `background-color: var(--token-bg)`. It is the token and not the theme
key because that is exactly what `inline` means, Tailwind substitutes the theme variable's value at
the use site. A row minting from Tailwind's own default reads no `var(--<token>)` at all and fails.

**What makes the compile hermetic.** `@source` **adds** to Tailwind's automatic source detection
rather than replacing it, and that detection is rooted at the compiler's working directory. Spawned
with the inherited repository root it would crawl the whole repository for class names, and the
`SHIPPED_BY_TAILWIND` split below would then be a fact about unrelated repository text. The CLI is
therefore spawned with `cwd` set to the scratch root, so the scan sees the three fixture pages and
the vendored folder and nothing else. **Observed 2026-08-25**: the explicit `@source` is honoured
even though the scratch directory is `.gitignore`d, which automatic detection would skip.

Verbatim:

```
contract-tailwind minted utilities (55):
--color-bg -> .bg-bg { background-color } = oklch(0.12 0.011 288)
--color-surface -> .bg-surface { background-color } = oklch(0.16 0.013 288)
--color-surface-2 -> .bg-surface-2 { background-color } = oklch(0.2 0.014 288)
--color-ink -> .bg-ink { background-color } = oklch(0.95 0.005 288)
--color-muted -> .bg-muted { background-color } = oklch(0.68 0.012 288)
--color-line -> .bg-line { background-color } = oklch(0.28 0.015 288)
--color-line-strong -> .bg-line-strong { background-color } = oklch(0.51 0.02 288)
--color-accent -> .bg-accent { background-color } = oklch(0.66 0.165 288)
--color-accent-hover -> .bg-accent-hover { background-color } = oklch(0.76 0.145 288)
--color-accent-muted -> .bg-accent-muted { background-color } = oklch(0.46 0.11 288)
--color-focus -> .bg-focus { background-color } = oklch(0.84 0.13 288)
--color-scrim -> .bg-scrim { background-color } = oklch(0.12 0.011 288 / 0.88)
--font-display -> .font-display { font-family } = "Bricolage Grotesque", Archivo, system-ui, sans-serif
--font-sans -> .font-sans { font-family } = Geist, ui-sans-serif, system-ui, sans-serif
--font-mono -> .font-mono { font-family } = "Geist Mono", ui-monospace, SFMono-Regular, monospace
--text-3xs -> .text-3xs { font-size } = 11px
--text-2xs -> .text-2xs { font-size } = 12px
--text-xs -> .text-xs { font-size } = 13px
--text-sm -> .text-sm { font-size } = 14px
--text-base -> .text-base { font-size } = 16px
--text-md -> .text-md { font-size } = 20px
--text-lg -> .text-lg { font-size } = 25px
--text-xl -> .text-xl { font-size } = 31.2496px
--text-2xl -> .text-2xl { font-size } = 39.0624px
--text-display -> .text-display { font-size } = 36px
--font-weight-light -> .font-light { font-weight } = 300
--font-weight-regular -> .font-regular { font-weight } = 400
--font-weight-medium -> .font-medium { font-weight } = 500
--font-weight-bold -> .font-bold { font-weight } = 700
--font-weight-black -> .font-black { font-weight } = 800
--leading-display -> .leading-display { line-height } = 15.2px
--leading-heading -> .leading-heading { line-height } = 17.6px
--leading-lede -> .leading-lede { line-height } = 24.8px
--leading-body -> .leading-body { line-height } = 25.6px
--leading-label -> .leading-label { line-height } = 22.4px
--tracking-display -> .tracking-display { letter-spacing } = -0.8px
--tracking-heading -> .tracking-heading { letter-spacing } = -0.48px
--tracking-name -> .tracking-name { letter-spacing } = -0.24px
--tracking-body -> .tracking-body { letter-spacing } = normal
--tracking-meta -> .tracking-meta { letter-spacing } = 1.44px
--tracking-label -> .tracking-label { letter-spacing } = 2.24px
--spacing-2xs -> .p-2xs { padding } = 4px
--spacing-xs -> .p-xs { padding } = 8px
--spacing-sm -> .p-sm { padding } = 12px
--spacing-md -> .p-md { padding } = 16px
--spacing-lg -> .p-lg { padding } = 24px
--spacing-xl -> .p-xl { padding } = 40px
--spacing-2xl -> .p-2xl { padding } = 64px
--spacing-3xl -> .p-3xl { padding } = 96px
--spacing-page-pad -> .p-page-pad { padding } = 20px
--spacing-tap -> .p-tap { padding } = 44px
--radius-none -> .rounded-none { border-radius } = 0px
--radius-hair -> .rounded-hair { border-radius } = 2px
--radius-pill -> .rounded-pill { border-radius } = 999px
--container-measure -> .max-w-measure { max-width } = 460px
```

Two figures in that list are worth reading twice. `--spacing-page-pad` reports **20px** and
`--text-display` reports **36px** because both are `clamp()` values measured at the 360px viewport
`RENDERED_VIEWPORT` fixes, and `--container-measure` reports **460px** because `46ch` resolves
against the fixture's own font. All three are the browser's resolution of the same value on both
sides of the comparison, which is why the check compares against a control element rather than
against a number written here.

### Probe 4: the same fixture with no `@theme` block

**Observed 2026-08-25**, same run. Verbatim:

```
contract-tailwind negative control: 55 utilities probed against a build of tailwindcss plus
tokens.css with no @theme block. 42 do not exist at all; 13 exist as stock Tailwind utilities
carrying Tailwind's own values:
.font-sans { font-family: var(--font-sans); }
.font-mono { font-family: var(--font-mono); }
.text-xs { font-size: var(--text-xs);
    line-height: var(--tw-leading, var(--text-xs--line-height)); }
.text-sm { font-size: var(--text-sm);
    line-height: var(--tw-leading, var(--text-sm--line-height)); }
.text-base { font-size: var(--text-base);
    line-height: var(--tw-leading, var(--text-base--line-height)); }
.text-lg { font-size: var(--text-lg);
    line-height: var(--tw-leading, var(--text-lg--line-height)); }
.text-xl { font-size: var(--text-xl);
    line-height: var(--tw-leading, var(--text-xl--line-height)); }
.text-2xl { font-size: var(--text-2xl);
    line-height: var(--tw-leading, var(--text-2xl--line-height)); }
.font-light { --tw-font-weight: var(--font-weight-light);
    font-weight: var(--font-weight-light); }
.font-medium { --tw-font-weight: var(--font-weight-medium);
    font-weight: var(--font-weight-medium); }
.font-bold { --tw-font-weight: var(--font-weight-bold);
    font-weight: var(--font-weight-bold); }
.font-black { --tw-font-weight: var(--font-weight-black);
    font-weight: var(--font-weight-black); }
.rounded-none { border-radius: 0; }
```

**Read that carefully, because the naive reading of the acceptance criterion is wrong.** Thirteen of
the 55 utility **names** already exist in stock Tailwind v4. What they do not do is read a contract
token: every one of them resolves to Tailwind's own default theme variable, and the check asserts
exactly that, name by name. The other 42 do not exist at all. So the premise holds in the form that
matters: without the `@theme` block, not one utility anywhere in the compiled output is bound to the
contract. The list of 13 is pinned in the spec file, so a Tailwind version bump that moves it becomes
a reviewed line in a diff rather than a quietly smaller negative control.

In the browser, on the same build, all twelve `bg-*` probes computed `rgba(0, 0, 0, 0)` while their
controls computed the token colour.

### Probe 5: the compiled build placed outside the vendored folder

**Observed 2026-08-25**, same run, the identical compiler input written one directory above the
vendored folder. Verbatim:

```
contract-tailwind misplaced build:
404 http://127.0.0.1:34905/fonts/geist-latin.woff2
404 http://127.0.0.1:34905/fonts/bricolage-grotesque-latin.woff2
404 http://127.0.0.1:34905/fonts/geist-mono-latin.woff2
```

The port is whatever the scratch server was given on the day, since it listens on an ephemeral one;
the three paths and the three statuses are the observation. Each 404 is asserted by its own URL, and
the check first asserts that at least one woff2 was requested, so a page that fetched nothing cannot
satisfy it. `document.fonts.check` reported all three families unavailable. This is what makes the
placement rule above an observation.

## The two new dependencies, and what they cost

The browser check needs a real Tailwind v4 compiler. The alternatives were an unpinned `dlx` in CI,
which is a moving compiler under a contract that ships to seven repositories, or asserting the
compiled CSS by reading it, which the acceptance criterion rules out because reading the text is
exactly what cannot tell a working mapping from a mapping that mints nothing.

| Figure | Value | Nature |
|---|---|---|
| Added to `devDependencies` | `tailwindcss` and `@tailwindcss/cli`, both pinned exact at **4.3.3** | **Decision.** The exact-pin convention `@playwright/test` set in Story 1-10 |
| New lockfile entries | **36**, of which **23** are other-platform optional binaries (`@parcel/watcher-*`, `@tailwindcss/oxide-*`) that are never materialised on a given host | **Observed 2026-08-25**, by diffing the `packages:` keys of `pnpm-lock.yaml` against `c07038d` |
| Lockfile entries removed | **0** | **Observed 2026-08-25**, same method |
| Materialised on disk, this host | **7,116,175 bytes (6.8 MiB)** across 13 packages, of which `@tailwindcss/oxide-win32-x64-msvc` is 3,191,981 and `jiti` is 1,751,293 | **Observed 2026-08-25**, by summing file sizes under each new package directory in `node_modules/.pnpm` on the Windows development host. A Linux runner materialises the equivalent Linux binaries instead |
| `pnpm install --frozen-lockfile` wall time | **764 ms**, "Lockfile is up to date, resolution step is skipped", "all 2 workspace projects" | **Observed 2026-08-25** on the development host with a warm store. Not a CI figure |
| New workspace packages | **0**. Both are root devDependencies | **Decision.** A second `package.json` under `packages/` would change the lockfile importers and oblige a `COPY` line in the Docker `deps` stage |
| `docker/Dockerfile`, `pnpm-workspace.yaml` | untouched | **Observed 2026-08-25**, by `git diff` against `c07038d` |

**Where the cost lands.** On the `deps` and `builder` layers of a build that already runs on the
serving box, because `deploy.yml` builds there (the standing AD-8 violation Story 1-9 tracks). It
does not land on the served image: `docker/Dockerfile`'s `runner` stage copies `.next/standalone`,
`.next/static` and `public` and no `node_modules` at all, so nothing here reaches production bytes.

**What does not touch the Hub.** No PostCSS config, no `tailwind.config.*`, no Tailwind import
anywhere in `app/`. The Anchor is SCSS and is not a Tailwind consumer. Both dependencies exist for
one Playwright spec.

## Stated limits

| Limit | Why it stands | Nature |
|---|---|---|
| Nothing adopts the adapter yet | Publishing is not adopting. `cuatro-finance`, `cuatro-tracker`, `cs-tournament` and `cs-tracker` are all outside this repository, and Story 1.19 is where `cs-tracker` first consumes it | **Decision.** Story 1-13 scope |
| The adapter is verified against Tailwind 4.3.3 and nothing else | Every figure here, the list of 13 stock utilities and the unrebased-`url()` observation included, is a fact about that version. A consumer on a different 4.x may see a different stock set | **Observed 2026-08-25.** Pending Operator action 2 |
| **Adopting the adapter changes a consumer's base body and code font** | Tailwind v4 derives `--default-font-family` from `--font-sans` and `--default-mono-font-family` from `--font-mono`, and those two defaults are what the Preflight base layer sets on `html` and on `code`, `pre`, `kbd` and `samp`. Overriding the two theme keys therefore retargets the whole document's type, not only the elements a `font-sans` or `font-mono` utility is written on. That is the intended outcome of adopting a type contract, and it is stated here because it is the one mapping whose effect reaches elements nobody opted in | **Decision**, with the mechanism **observed 2026-08-25** in the compiled output |
| Tailwind's paired `--text-*--line-height` defaults survive underneath the overridden sizes | Overriding `--text-sm` does not clear Tailwind's own `--text-sm--line-height`, so `.text-sm` still sets a line height derived from Tailwind's scale rather than the contract's. A consumer that wants the contract's line heights pairs the size utility with a `leading-*` utility. Clearing them would mean publishing a second key per size, which the map's one-key-per-token shape does not have | **Observed 2026-08-25**, in the compiled output |
| The default Tailwind colour palette is still present | `@theme inline` adds to the default theme rather than replacing it, so `bg-red-500` still exists beside `bg-accent`. Clearing it is `--color-*: initial`, which is a consumer decision about its own build and not a property of the contract | **Observed 2026-08-25** |
| The unit suite reads `DESIGN.md` out of a dated planning directory | `packages/tokens/__tests__/tailwind-adapter.test.ts` compares the published mappings against the authored block. That couples a test to a planning artefact this story does not own. Every way the coupling can break throws naming the coupling rather than failing obscurely | **Decision**, inherited from Story 1-11 |
| The browser check's scratch tree is built inside the repository | The Tailwind CLI resolves `@import "tailwindcss"` by walking up from the input file for `node_modules`, so a tree under `tmpdir()` cannot find the pinned compiler. The tree is removed in `afterAll`, which Playwright runs on failure as well as on success, but a hard kill of the process would leave one behind | **Decision**, with the residual risk stated |
| No CI job builds a Tailwind bundle | The adapter's real verification lives in the `rendered-output` job, which runs the whole Playwright suite in the pinned container. If that job is ever narrowed, the adapter loses its only executing check | **Observed 2026-08-25**, by reading `.github/workflows/ci.yml` |

## Pending Operator actions

This file hands the Operator work it cannot do from a development host. They are tracked here rather
than left in prose, in the shape `ops/token-contract.md`, `ops/font-contract.md` and
`ops/rendered-output-harness.md` use.

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Correct `--radius-DEFAULT` in `DESIGN.md:1001`** to `--radius-none`, or delete the line | Operator | The authored block names a key that mints `.rounded-DEFAULT` in Tailwind v4 rather than the bare `.rounded` it was clearly meant to produce. A v3 idiom carried into a v4 design. This story may not edit a planning artefact, and the adapter records the exclusion instead | _not done_ |
| 2 | **Re-check the Tailwind pin on the settled-inputs schedule** (AD-22), and re-check `TAILWIND_NAMESPACES` against the installed compiler at the same time | Operator | `tailwindcss` and `@tailwindcss/cli` are pinned exact at 4.3.3. Two things in this repository are hand-copied facts about that version and will drift silently from it. The pinned set of stock utility names in `tests/e2e/contract-tailwind.pw.ts` fails loudly when it moves, which is the easy half. `TAILWIND_NAMESPACES` in `packages/tokens/build.mjs` does not: it is a transcription of v4's theme namespace list, nothing compares it to the compiler, and a namespace **added** upstream would be refused here as one Tailwind does not theme, while a namespace **removed** upstream would be accepted here and mint nothing. Bump both packages together, read the negative control's output, and diff the list against the release notes | _not done_ |
| 3 | **Tell each Tailwind Satellite where to compile its output**, when Stories 1.16 and 1.19 hand them the folder | Operator | The unrebased-`url()` rule above is the one adoption instruction that fails silently if it is missed: the page renders, looks almost right, and every face has 404'd | _not done_ |
| 4 | **Record the first real CI run of the `rendered-output` job with the new spec**, from the Actions run summary | Operator | The four new browser checks have only ever run in the pinned container on a Windows development host. The runner figure is unknown until the job runs once | _not done_ |
| 5 | **Run `/bmad-project-context` to refresh the `bmad:context` block in `AGENTS.md`** | Operator | Still open from Stories 1-10 and 1-12, and this story widens it twice more. `AGENTS.md:55-57` says Playwright is not installed and that no acceptance criterion may claim a browser check, which is now false for three spec files. `AGENTS.md:52-53` still describes CI as typecheck and tests only, against a file with four jobs. And `AGENTS.md:7` now reads "Sass (no Tailwind)", which is inaccurate at the toolchain level: the Hub's styling is still Sass and no Tailwind reaches `app/`, but `tailwindcss` and `@tailwindcss/cli` are root devDependencies and one Playwright spec compiles with them. An agent reading that line would reasonably conclude the packages are not installed | _not done_ |

**Maintaining this file.** When an action is performed, replace its `_not done_` cell with the ISO
8601 UTC completion date and leave the row in place. When a figure is re-measured, add the new row
with its own date and method and keep the old one, so a later reader can see whether a number moved
or was simply re-stated. Deletion is not used here.
