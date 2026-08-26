# The Anchor's token adoption

The written record of step 1 of the Anchor's two-step adoption of the design token contract:
what was wired and where, which contract version, why the Anchor loads `contracts/` directly
rather than vendoring it, what the build pipeline does to the contract's values on the way
through, what the rendered comparison actually proved and what it did not, and what Stories 1-18
and 1-20 do to this file next.

Written during Story 1-17 on **2026-08-26** (ISO 8601 UTC), against baseline commit `b984ca7`.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/token-contract.md`, `ops/font-contract.md`,
`ops/rendered-output-harness.md`, `ops/tailwind-adapter.md` and `ops/contract-serving.md` set:
every value is marked **Observed** with its method or **Decision** with its reason (NFR-9), and
every date is ISO 8601 UTC.

**Story ids are written hyphenated throughout this file**, as `Story 1-17` and `Story 1-18`,
matching the keys in `_bmad-output/implementation-artifacts/sprint-status.yaml`. `epics.md` writes
the same ids dotted. They are the same stories. An earlier version of this file declared the rule
and then wrote `Story 1.18`, `Story 1.20` and `Story 2.20` in its own headings and tables.

## What this story did, in one paragraph

`app/scss/_index.scss` gained two `@use` lines and a comment. Nothing else in the Hub changed.
The contract is now in the stylesheet graph of every route, its eighty-nine custom properties
resolve on `:root` in a real browser, its three `@font-face` blocks are declared with URLs that
answer 200, and not one Anchor stylesheet reads a single name from it. The committed screenshot
baseline is byte-identical to what it was before.

## The wiring

| Property | Value | Nature |
|---|---|---|
| File modified | `app/scss/_index.scss`, the only file this story edits | **Decision.** AD-20: a migration step carries nothing else |
| How it reaches every route | `app/app.scss:1` is `@use './scss/' as *` and `app/layout.tsx:4` imports `app/app.scss` | **Observed 2026-08-26**, by reading both files |
| Load form | `@use '../../contracts/tokens';` then `@use '../../contracts/fonts';` | **Decision.** `@use` is the load-bearing choice; the extensionless spelling is convention. See "Why `@use` is the mechanism, and the extension is not" |
| Order | tokens, then fonts | **Decision.** AD-14's file order, and the order `contracts/tailwind.css` imports them in |
| Contract version wired | **v1.0.0**, from the `Contract v1.0.0` header both files carry | **Observed 2026-08-26**, by reading `contracts/tokens.css:2` and `contracts/fonts.css:2` |
| Vendored copy | **None.** No `cuatro-contracts/` anywhere in this repository | **Observed 2026-08-26**, by `git ls-files -- .` filtered on the path segment, asserted by `app/__tests__/anchor-contract.test.ts` |
| Second authored copy | **None.** No tracked `tokens.css`, `fonts.css` or `tailwind.css` under `app/`, `components/` or `public/` | **Observed 2026-08-26**, same method |
| Consumed by | **Nothing.** Zero references to any contract name from any of the **59** scanned files under **all four** shipped source roots, `app/`, `components/`, `hooks/` and `content/`: nineteen `.scss` **and forty non-test `.ts` and `.tsx` beside them** | **Observed 2026-08-26**, by the scan in `app/__tests__/anchor-contract.test.ts`. The stylesheets alone are not enough: a consumer could arrive as an inline style in a `.tsx` or as a `setProperty('--token-...')` call, and a scan that read only `.scss` would never see it. Both shapes are used as planted controls. `__tests__` directories are excluded, because a test that asserts about a token name is not a consumer of it and this very check names several. **The root list is itself pinned against `git ls-files`**, so a new top-level source directory fails the case rather than escaping it. That guard exists because the scan read only `app/` and `components/` when this record first claimed "nothing consumes it", while `hooks/useGsapContext.ts` and `hooks/useReduceMotion.ts` shipped unread and are imported by eight components. **The extension list covers `.css`, `.js`, `.jsx`, `.mjs` and `.cjs` as well**, none of which a scanned root carries today: those five are anticipatory, so what is asserted for them is that the scan's filter accepts them, while the three that do exist carry the stronger "at least one was read" |
| Published families consumed by | **Nothing.** Zero references to `Bricolage Grotesque`, `Geist` or `Geist Mono` from any of the same 59 files | **Observed 2026-08-26**, by the same scan. This is the font half of the same claim and it went unasserted until the second follow-up review: the token scan loops `--`-prefixed names only, so a Hub stylesheet adding `font-family: Geist` would have started a download and changed what the Hub paints while the token scan, the face-URL check and the `document.fonts` check all stayed green. None of the three asks whether anything in the Hub *uses* a published family. It matters because "an unused `@font-face` is never downloaded" is one of the two pillars the appearance-neutrality argument rests on, and the other one was pinned on both sides from the start |

### Why the Anchor loads `contracts/` directly

`DESIGN.md` § Sequence step 1 says to drop the two files into `app/scss/`. `epics.md:1777-1781`
overrules that in place, and this is the resolution as implemented.

| Reason | Detail |
|---|---|
| AD-1 | `contracts/` is the estate's published surface, and this repository is its publisher. The Anchor is not a consumer reaching for a copy, it is the origin |
| AD-4 | One authored location. A copy under `app/scss/` would be a second file a reviewer must keep in step by hand, and the first time it drifted the Hub would render values no generator produced |
| AD-14 | The vendored folder named exactly `cuatro-contracts/` is a **Satellite** mechanism, so a scheduled drift check has a fixed path to look at across seven repositories. The publisher does not vendor from itself |
| Story 1-16 | `public/contracts/` already exists at build time and is a **generated, gitignored** copy for serving over HTTPS. It is not a stylesheet input, and nothing in the Sass graph reads it |

**This is why the no-second-copy check reads `git ls-files` and not the working tree.** After any
`pnpm build` the working tree carries `public/contracts/tokens.css`. That file is the served copy,
it is invisible to git, and a working-tree scan would report it as an authored duplicate.

### Why `@use` is the mechanism, and the extension is not

An earlier draft of this section said the extension decides it: that an extensionless load
inlines and an explicit `.css` load compiles to a runtime `@import`. **That is true of `@import`
and false of `@use`**, and since `@use` is what this story writes, the rule as stated did not
describe the load it was justifying. It is corrected here rather than deleted, because the wrong
version is the intuitive one and a later reader is likely to arrive carrying it.

**Observed 2026-08-26.** Method: four one-line fixtures, each loading the same one-line plain CSS
file, compiled with this repository's own Dart Sass through
`node node_modules/sass/sass.js <fixture>.scss`. Version, from `--version`: **1.98.0 compiled with
dart2js 3.11.2**.

| Fixture | Output | Reading |
|---|---|---|
| `@use './t';` | the file's contents, inlined | Extensionless `@use` inlines |
| `@use './t.css';` | the file's contents, inlined, **byte-identical to the row above** | The extension changes nothing for `@use` |
| `@import './t';` | the file's contents, inlined, plus `DEPRECATION WARNING [import]` | A bare `@import` inlines too |
| `@import './t.css';` | `@import './t.css';` passed straight through | **The one combination that defers to the browser** |

So the rule is the **pair** of `@import` with an explicit `.css` extension, and the load-bearing
choice in `app/scss/_index.scss` is `@use`. The extensionless spelling is kept as the house
convention because it is unambiguous, not because it is what does the work.

**Why deferring would be silently wrong.** Two things break in the runtime `@import` form, and
neither is loud:

1. The contract would be fetched from a URL Next never emits, so the names would not be on
   `:root` at all.
2. `contracts/fonts.css` carries `url("./fonts/<file>.woff2")` relative to itself. Inlined, Next's
   pipeline rewrites those against the contract folder. Left as a runtime `@import`, they resolve
   against whatever the browser fetched the stylesheet from.

**What is asserted, and at which strength.** `app/__tests__/anchor-contract.test.ts` requires every
contract load in `app/scss/_index.scss` to be `@use` and never `@import`, which is the assertion
that holds the failure mode shut, and separately requires no explicit `.css` extension, which is a
convention check and whose message says so. `tests/e2e/contract-anchor.pw.ts` measures the
consequence from the built Hub: the contract's own declarations (`--c-paper` and `--token-scrim`,
names nothing else in the repository declares) must appear as declarations in **exactly one**
stylesheet the page links, and no stylesheet the page links may carry an `@import` at all.

Two corrections to that measurement, both made on the second follow-up review and both worth
recording because each one made a green assertion mean less than it read as. **The `@import`
matcher required whitespace after the at-keyword.** It runs over minified build output, where
`@import"/x.css";` with no separating space is the ordinary emission and the spaced form is the
unlikely one, so the exact failure the assertion exists to catch could have passed unseen, with both
planted controls green because both were written spaced. The source-side parser in
`app/__tests__/anchor-contract.test.ts` already read `\s*` for this reason; the two now agree, and
the unspaced form is a planted control. **The inlining check was "at least one stylesheet", not
"exactly one".** Two stylesheets both carrying the contract would ship the 89 declarations and the
three `@font-face` blocks twice, which is a payload defect an at-least-one check cannot see. Pinned
at one, on the same rule as every other count here.

**Position is asserted as well as form.** Dart Sass emits module CSS in source order, so a contract
load moved below `@forward './fonts'` would emit the contract's three `@font-face` blocks after the
Anchor's **ten**. Nothing else in the repository notices, so a case pins the order.

**And the premise the order rests on is asserted too.** Emission order between two `@font-face`
blocks only decides anything when both name the same family, so a case intersects the ten families
in `app/scss/_fonts.scss` against the three in `contracts/fonts.css` with both counts pinned, and
requires the intersection to be empty. Without it the order case would pin a spelling rather than
a behaviour. **Observed 2026-08-26**: ten local faces (five General Sans weights, three Monument
Extended weights, `Confillia Normal` and `Confillia`), three published, no shared family. An
earlier version of this file and of the story's Code Map said the Anchor declares nine; the
`@font-face` openers at `app/scss/_fonts.scss:19,29,39,49,59,71,81,91,103,113` are ten.

## What the contract puts on `:root`

| Figure | Value | Nature |
|---|---|---|
| Custom properties declared on `:root` | **89**, and the number is **pinned rather than bounded** | **Observed 2026-08-26**, by parsing `contracts/tokens.css` and reading each one back with `rootCustomPropertyValue` against the built Hub. Both halves of the story pin the literal 89, because a floor cannot see a removal: the loop that reads each name back simply gets shorter and stays green |
| Parsers that produce that list | **Two, cross-checked against each other**, in each half of the story: a flat scan of the whole comment-stripped file, and a structured read of the `:root` block and the media block separately | **Decision.** They truncate differently. The flat one cannot tell the two blocks apart; the structured one would silently shorten its list if a second `:root`, an `@layer` or `@supports` wrapper or any nested brace appeared. Agreement between them is the evidence that neither did |
| Redefined under `prefers-reduced-motion: reduce` | **4**: `--dur-micro`, `--dur-minor`, `--dur-major`, `--dur-exit`, each `1ms` | **Observed 2026-08-26**. The harness runs with `reducedMotion: 'reduce'` (`playwright.config.ts:79`), so these are the four values that resolve there, and the spec reads `matchMedia` rather than assuming the config |
| The **base** motion scale, `120ms`, `220ms`, `420ms`, `165ms` | Measured in a **second browser context** opened with `reducedMotion: 'no-preference'`, and observed arriving as `.12s`, `.22s`, `.42s`, `.165s` | **Observed 2026-08-26**. Without that context these four are only ever compared `1ms` against `1ms`, because the project pins `reduce`, and the claim that all 89 values were measured would be false for four of them. The case asserts the media query really lifted before it compares anything |
| The two `clamp()` tokens, `--t-display` and `--page-pad` | Measured at **360px and again at 600px**. At 360 the `9vw` and `5vw` middle terms lose to their minimum, so the fluid term is inert; at 600 both win. Observed 36px then 54px, and 20px then 30px | **Observed 2026-08-26**. A control pair whose middle terms differ compares **equal** at 360 and **unequal** at 600, which is what makes the blind spot visible rather than argued |
| `@font-face` blocks added to the graph | **3**: `Bricolage Grotesque`, `Geist`, `Geist Mono` | **Observed 2026-08-26**, by parsing every stylesheet `/work` links |
| Face bytes served | **58,992**, **24,124** and **11,284**, each `200`, each `font/woff2`, each beginning with the `wOF2` signature | **Observed 2026-08-26**. The signature is asserted, not only the status and the length: a 200 with a body is also what an error page is, and "a 404 reads identically to a load" is this check's whole stated reason to exist |
| Face load status on `/work` | All three `unloaded` in `document.fonts` | **Observed 2026-08-26**. This is the intended state, not a defect: an `@font-face` no rule uses is never downloaded, which is one of the two reasons the render can be identical by construction |
| Name collisions with the Hub's sixteen existing custom properties | **0**, over **all sixteen against all 89**, with both counts pinned | **Observed 2026-08-26**. `app/__tests__/anchor-contract.test.ts` parses `app/app.scss` for every name it declares, asserts there are exactly sixteen, asserts no other stylesheet under `app/` or `components/` declares one at all, and intersects that list with the contract's 89. An earlier version checked only the four probe names, which left twelve unchecked while the record claimed all sixteen. The intersection is run against a planted control so an empty result cannot mean an empty list |

## The finding: the build rewrites the contract's values

**Observed 2026-08-26.** The compiled stylesheet is **not** `contracts/tokens.css` byte for byte.
Next 16.2.1's Turbopack pipeline minifies the CSS it emits, and forty-three of the eighty-nine
values arrive at the browser written differently from how the contract declares them.

**Every rewrite is semantics-preserving, and that claim is measured rather than asserted.** The
browser-side check canonicalises both sides through the browser's own parser and compares those.
There are **six typed comparator routes**: colours by rasterising to 8-bit sRGB, times through
`transition-duration`, easings through `transition-timing-function`, lengths through a computed
`outline-offset`, stacks through `font-family`, unitless numbers through `line-height`. A seventh,
the `text (var)` route, catches anything still carrying an unresolvable `var()`. There is also a
plain `text` fallback, which no contract value reaches once `var()` has been substituted.

**Fourteen controls, a positive and a negative on each of the six typed routes and on
`text (var)`**, run through the same comparator in the same page, so the comparison can neither
pass a real difference nor fail a real equivalence unnoticed. **A fifteenth rides back from inside
the comparator itself**, and it closes the one way the colour route could fail open: a canvas
`fillStyle` assignment the context cannot parse is specified to be *ignored*, leaving the previous
colour in place, so with `globalCompositeOperation = 'copy'` both sides of a pair would rasterise
the same stale pixel and compare **equal**. The `CSS.supports` gate does not cover that, because
the CSS parser and the canvas answer separately. Two sentinel writes now prove each assignment
took, an unparsed value is reported as `unparsed-by-canvas:<value>` rather than swallowed, and
every call site asserts the guard fired on its own call.

Neither text route is meant to be reached by a contract value, and the case now **asserts** that
neither is, in both directions: each of the six typed routes must be exercised by at least one
real token, and no real token may land on a text route. The per-route guard alone could not see a
whole scale falling to the string comparison while one surviving value held its route open. The
two text routes are treated differently on purpose: `text (var)` is a *failure* route, reached
when substitution does not resolve, so pinning what the comparator does there is worth a control;
the plain `text` route is unreachable rather than merely unused, since a value with no `var()` and
no typed route would have to be a shape CSS has no property for.

**Two of those controls have already earned their place**, which is why they are recorded here
rather than described as diligence. `a different length` caught the comparator reading a
transitioning value instead of the value it had just written, at which point every length in the
contract was comparing equal to every other length. `a different fluid middle term` is what makes
the 360px blind spot visible.

| Kind | Declared | Reaches `:root` as | Count |
|---|---|---|---|
| Palette colour, and every role and elevation step that references one | `oklch(12% 0.011 288)` | `#060509` plus `lab(1.52265% .480853 -1.49071)` behind `@supports (color: lab(0% 0 0))`, so a browser with `lab()` resolves the `lab()` form | **27**: the 12 `--c-*`, the 12 `--token-*` and the 3 `--elev-*` |
| Leading zero on a length | `0.6875rem` | `.6875rem` | **12**: 4 `--t-*`, 5 `--tr-*`, 3 `--s-*` |
| Leading zero in an easing | `cubic-bezier(0.16, 1, 0.3, 1)` | `cubic-bezier(.16, 1, .3, 1)` | **3**, the `--ease-*` set |
| Leading zero on a number | `0.95` | `.95` | **1**, `--lh-display` |
| | | **Total** | **43 of 89** |
| Duration unit, **not counted above** | `120ms` | `.12s` | **4**, the `--dur-*` set. Not in the forty-three because the harness runs under `prefers-reduced-motion: reduce`, where the contract's own media block redefines all four to `1ms` and no rewrite is observable |

**Two consequences worth writing down rather than discovering later.**

1. **The `oklch()` values are downlevelled.** lightningcss emits an sRGB hex fallback and a
   `lab()` override. `lab()` and `oklch()` are both absolute colour spaces, so the conversion is
   faithful for a browser that supports `lab()`, and Chromium in the pinned image resolves every
   one of the twelve palette entries to the same 8-bit sRGB pixel from either form. **A browser
   that supports neither gets the hex fallback, which is sRGB and cannot carry a wide-gamut
   value.** No token in v1.0.0 is outside sRGB, so nothing is lost today. It is recorded because
   the day a token is authored outside sRGB, this is where the value quietly narrows.
2. **A consumer reading `https://cuatro.dev/contracts/tokens.css` gets the authored file, not
   this.** The rewrite happens in the Hub's own bundle. `tests/e2e/contract-serving.pw.ts`
   compares the served bytes against the authored file for all nine published paths, so the two
   paths are separately held and cannot drift into each other.

**The semantic layer resolves, it does not pass through.** `--token-bg` is declared
`var(--c-paper)`, and the computed value of a custom property is its token stream **after**
substitution, so `:root` answers `--token-bg` with `--c-paper`'s value and never with the string
`var(--c-paper)`. The spec substitutes the contract's own declarations before comparing, and
asserts that the substitution really ran, because a comparison against the unsubstituted text
would report all twelve roles and all three elevation steps as drifted while the contract behaved
exactly as designed.

## The rendered comparison

**The claim is that the render did not move, and the instrument is Story 1-10's, unchanged.**

| Field | Value | Nature |
|---|---|---|
| Baseline file | `tests/e2e/rendered-output.pw.ts-snapshots/work-360x800-chromium-linux.png` | **Decision.** Story 1-10 |
| sha256 **before** the wiring | `27f22bb6ff78c62e019cc8f222665436b7a20c2445a90677bead375c7d763f97` | **Observed 2026-08-26**, by `Get-FileHash ... -Algorithm SHA256` at `b984ca7`, and equal to the figure recorded at `ops/rendered-output-harness.md:151` |
| sha256 **after** the wiring | `27f22bb6ff78c62e019cc8f222665436b7a20c2445a90677bead375c7d763f97` | **Observed 2026-08-26**, same command after the closing state. **Unchanged.** The baseline was never regenerated and `playwright.config.ts` sets `updateSnapshots: 'none'`, so a failing run could not have written one |
| Result | `captures /work at 360x800 and matches the committed baseline` passed, and the whole `pnpm test:e2e` run was green: **30 tests, 2.1 m**, across five spec files. Thirteen of the thirty are `rendered-output.pw.ts`'s own and six are `contract-anchor.pw.ts`'s. Re-measured on the second follow-up review after the `@import` matcher and the inlining pin changed; the case count is unmoved because both changes tightened existing cases rather than adding one. The wall clock is the same run on the same host at a different moment and is not a benchmark | **Observed 2026-08-26**, in `mcr.microsoft.com/playwright:v1.62.1-noble`, re-measured on the review pass. An earlier version of this row said "the whole file was green: 28 tests, 1.2 m", which named neither the file (13) nor the run (30) |
| Snapshot directory afterwards | Exactly one PNG, which `keeps exactly one committed baseline` asserts on every run | **Observed 2026-08-26** |
| Tolerance | `maxDiffPixelRatio` 0.001 at 360 x 800, torus masked, per-pixel threshold left at Playwright's default | **Decision.** Inherited unchanged from `ops/rendered-output-harness.md` |

The command, run from the repository root on the Windows development host. It is
`ops/rendered-output-harness.md:156-164` verbatim with `pnpm test:e2e` in place of
`pnpm run test:e2e:update`, so the baseline is compared against and never written:

```
docker run --rm --ipc=host ^
  -v C:/CuatroEcosystem/cuatro-portfolio:/w ^
  -v pw-node-modules:/w/node_modules ^
  -v pw-next:/w/.next ^
  -w /w -e CI=1 ^
  mcr.microsoft.com/playwright:v1.62.1-noble ^
  bash -lc "corepack enable && pnpm install --frozen-lockfile && pnpm test:e2e"
```

### What "visually identical" means here, as a number and as a limit

**These limits are inherited knowingly from `ops/rendered-output-harness.md:65-66`, not
discovered.** Story 1-10 wrote them down in advance as limits Story 1-17 would inherit, and this
is that story doing so.

**A note on the word "route", because this file uses it for two different things.** A **URL route**
is a path the Hub serves, such as `/work`. A **comparator route** is one of the eight paths
the value comparison canonicalises a value through. Every row below is about URL routes.

| Limit | The number | Consequence |
|---|---|---|
| One URL route | `/work` only | Nothing is claimed about `/`, `/projects` or `/celeste`, **by the screenshot or by anything else in this story**. `ROUTE = '/work'` is the only URL any browser assertion in `tests/e2e/contract-anchor.pw.ts` visits, so the computed-value checks carry exactly the same route limit as the screenshot. What they do not share is the viewport limit: two of them deliberately open a second context, one at 600px wide and one with `reducedMotion: 'no-preference'`, and both still load `/work` |
| One viewport for the screenshot | 360 x 800, `deviceScaleFactor: 1` | Nothing below the fold on `/work` is compared. The capture is the viewport, not `fullPage`, and `ScreenshotOptions` in `tests/e2e/harness.ts` exposes only `mask`, so a caller cannot widen it |
| 30 percent of the frame masked | 86,400 of 288,000 pixels, the `.work-hero__canvas-wrap` WebGL torus | The comparison covers the remaining 201,600. A canvas rendering nothing at all would still pass, which is why the same test asserts the masked element has a non-zero bounding box |
| The tolerance is not zero | 0.001, equivalent to 288 differing pixels of 288,000 | A one-pixel heading shift measures 0.007274, which clears it by 7.27 times. That margin is what makes "identical" checkable rather than asserted |

**Why the claim is stronger than that limit sounds.** The screenshot covers the
build-pipeline-surprise case. The name-collision case is covered by construction and asserted
separately, over the whole of both lists: the Hub declares sixteen custom properties, all sixteen
in `app/app.scss`, no other stylesheet under `app/` or `components/` declares one at all, and the
intersection of those sixteen with the contract's 89 is empty. An unused `@font-face` is not
downloaded and paints nothing. So the two ways this change could have moved a pixel are each held
by a different check, and neither rests on the screenshot alone.

### The Hub's own values, and the one transform applied to them

The four pre-change probes (`--white-color`, `--black-color`, `--accent`, `--monument-bold`) are
**named** in `tests/e2e/contract-anchor.pw.ts` and **valued from `app/app.scss` itself**, on the
same rule as everything else this story reads: a value written down twice is a value that can
drift.

| Observation | Detail |
|---|---|
| **Sass normalises single quotes to double on the way out** | `app/app.scss:29` authors `--monument-bold: 'MonumentExtended-Bold'` and `:root` answers `"MonumentExtended-Bold"`. The comparison therefore normalises quotes, and asserts that at least one of the four is single-quoted so the normalisation is not inert. **Observed 2026-08-26**, and the same pair is recorded independently at `ops/rendered-output-harness.md:317-318` |
| The other three pass through unchanged | `#fff`, `#000` and `#5b21b6` are read back exactly as authored. **Observed 2026-08-26** |
| `--accent-dim` is **not** one of the four | It is authored `rgba(91, 33, 182, 0.22)` and arrives as `#5b21b638`, and it is the property `AGENTS.md` records as doing two different jobs across fifteen call sites. Story 1-18 is where it is mapped per call site, and this story does not probe it | 

## A second finding: `/work` does not leave the base `body` background visible

**Observed 2026-08-26.** Story 1-17's spec expected `body` to compute
`background-color: rgb(0, 0, 0)` on `/work` as its did-nothing-change probe. It does not, because
`body { background: var(--black-color) }` (`app/app.scss:41`) is overridden at higher specificity
on four of the Hub's six routes. `components/atoms/Container/Container.tsx:13-15` derives the id
from the path and sets `<body id={route}>`, where
`route = pathname.substring(1).replaceAll('/', '-')`. **That mangling is load-bearing and an
earlier version of this section quoted it wrongly as `<body id={pathname}>`**: as quoted, the ids
would be `/work` and `/`, `body#work` would be invalid and `body[id='']` would match nothing, so
every conclusion in the table below would be wrong. What wins is decided by the stripped,
hyphenated path:

| Route | `body` id | `body` background-color | Rule that wins |
|---|---|---|---|
| `/work`, `/projects` | `work`, `projects` | `rgb(10, 0, 15)` | `body#work, body#projects` (`app/app.scss:53-55`) |
| `/` | `` (empty) | `rgb(10, 0, 15)` | `body[id='']` (`components/organisms/HomeLayout/HomeLayout.scss:1-2`) |
| `/celeste` | `celeste` | `rgb(68, 68, 68)` | `#celeste` (`components/organisms/Celeste/celeste.scss:1-2`) |
| `/cv`, `/recommendation` | `cv`, `recommendation` | `rgb(0, 0, 0)` | **Nothing overrides.** They match none of the three rules above, so the base rule paints and the base rule is `var(--black-color)` |
| any unrouted path (the 404) | the requested path, stripped | `rgb(0, 0, 0)` | **Nothing overrides**, for the same reason. `app/not-found.tsx` renders through the same root layout and the same `Body`, so the 404 surface is a third place the base rule paints. `components/organisms/ErrorPage/error-page.scss:7` paints `#0a000f` on the error container, not on `body` |

**An earlier version of this section said "and it does not on any route", which is wrong**, and
wrong in the direction that matters: it would tell the author of Story 1-18, the story that
redefines `--black-color` as a token reference, that no route in the Hub shows that value. Two
routes and the 404 surface do. None of the three is captured by the screenshot baseline and none is
visited by any browser assertion in this story, so the value they paint is held by the
`--black-color` probe below and by nothing else. **Observed 2026-08-26** by reading the four
stylesheets, `app/not-found.tsx` and `Container.tsx` against `app/*/page.tsx`, not by rendering
`/cv`, `/recommendation` or a 404.

The check therefore asserts what is actually true and observable: `body` still computes
`color: rgb(255, 255, 255)` on `/work`, `body#work` still paints `rgb(10, 0, 15)` over the base
rule, and `var(--black-color)` and `var(--white-color)` still resolve to pure black and pure white
where they are used, read off a probe element rather than off `body`. That is the same claim the
spec wanted, made where it can be made. **This is a pre-existing property of the Hub's
stylesheets, not something this story caused**, and it is recorded here because the next story to
write a "the background is still black" assertion will otherwise rediscover it.

## What Story 1-18 does next

**Story 1-18 is the commit that changes how `cuatro.dev` looks**, and it is deliberately separate
from this one so that the change that could break the build is not the change that changes the
render.

| Story 1-18 | Detail |
|---|---|
| Edits | `app/app.scss` and nothing else. The sixteen `:root` custom properties are redefined as references to token roles, so all fifteen component stylesheets keep working untouched |
| Regenerates | `tests/e2e/rendered-output.pw.ts-snapshots/work-360x800-chromium-linux.png`. That is regeneration case 1 in `ops/rendered-output-harness.md`: a deliberate visual change whose new render is the intended one, reviewed as a change rather than as noise |
| Must not do | Alias a font token family-only. `--monument-bold: 'MonumentExtended-Bold'` bakes the weight into the family name, so `font-weight` is set **by hand** at all four call sites in the same commit and only then asserted (`epics.md:1842-1844`, and the note at `tests/e2e/harness.ts:31-39`) |
| Inherits from here | The eighty-nine names, the value-rewrite table above (an aliased property will arrive at the browser rewritten the same way), and the fact that `--accent-dim` does two different jobs across fifteen call sites and resolves per call site |
| Leaves alone | `--accent-glow`, `--confillia-bold` and `--font-bold` are deletions, and `--confillia-normal` is a retarget, not a deletion. Those are Story 1-18's and Story 2-20's acts and not this story's |

## What Story 1-20 will record here

`epics.md` closes Epic 1 with Story 1-20, "Record the adopted contract version and the automation
policy". This file is where the Anchor's half of that lands.

| To be added by Story 1-20 | Why it is not here yet |
|---|---|
| The contract version the Anchor has **adopted**, as distinct from the version it **loads** | Today they are the same, v1.0.0, because adoption is one repository and one commit away from publication. Once `cs-tracker` vendors a copy (Story 1-19) the two can differ, and the recorded pair is what AD-16's scheduled drift check reads |
| The automation policy: what the scheduled job checks, how often, and what it does when a consumer is behind | Story 1-20's own content. `ops/token-contract.md:177` already points at it |
| The Satellite side of the same table | Story 1-19 is where `cs-tracker` adopts, and `ops/daisyui-route.md` is where its route was decided |

## Stated limits

| Limit | Why it stands | Nature |
|---|---|---|
| **Nothing consumes the contract, so nothing about how it looks is proved** | That is the story. The eighty-nine names resolve and the three faces are declared and fetchable, and not one of them paints a pixel. Contrast ratios, the hit-target floor and the focus-ring rules are asserted by later stories against real call sites | **Decision.** Story 1-17 scope |
| **The three faces were never rasterised** | An unused `@font-face` is not downloaded. The check is that each `url()` answers 200, with a non-zero body, as `font/woff2`, beginning with the `wOF2` signature, and that the family reached `document.fonts`. That is a different claim from "this face rendered", and it stops short of it deliberately. `tests/e2e/contract-fonts.pw.ts` and `tests/e2e/contract-serving.pw.ts` are where the faces are actually used and measured | **Decision**, with the mechanism **Observed 2026-08-26**: all three answer 200 as `font/woff2` with the `wOF2` signature, and all three report `unloaded` |
| **The value comparison is a browser's equivalence, not a byte comparison** | The build rewrites forty-three of the eighty-nine values, so a byte comparison is not available to be made. What is asserted is that each value still means what the contract declares, canonicalised through the browser's own parser, with a positive and a negative control on each of the six typed comparator routes and on `text (var)`, plus a fifteenth control inside the comparator asserting the colour route's canvas guard fired. No contract value may reach either text route, and the case asserts that in both directions | **Decision**, with the transform table **Observed 2026-08-26** |
| **The colour comparison resolves to 1/255 per channel, and no finer** | The colour route rasterises through a 1 x 1 canvas and reads four 8-bit channels back, so two colours that round to the same sRGB byte triple compare equal. That is the right resolution for the question being asked (both sides end up as pixels) and it is a real ceiling: a hypothetical rewrite that shifted a value by less than one 8-bit step would pass. The negative control is deliberately a neighbour exactly one step away, `#070509` against the `#060509` that `oklch(12% 0.011 288)` rasterises to, so the boundary itself is probed rather than a colour nobody would confuse | **Observed 2026-08-26**, by that control being reported unequal |
| **The two `clamp()` tokens are only fluid between two widths** | `--t-display` is pinned to its 36px minimum below 400px and to its 72px maximum above 800px; `--page-pad` is pinned below 400px and above 1280px. The comparison runs at 360 and at 600, so the middle term is measured once and the maximum term never is. A rewrite of the maximum term would not be caught | **Observed 2026-08-26**, from the canonical values at both widths |
| **Everything here was measured against the harness's own server** | `playwright.config.ts:84-93` starts `pnpm build && pnpm start` on `127.0.0.1:3100`. That is the same build the Docker builder stage runs, but it is not the deployed container, not behind Caddy and not behind Cloudflare | **Decision**, with the residual risk stated. Pending Operator action 1 |
| **`next start` is not how production runs** | `next.config.js` sets `output: 'standalone'` and `next start` warns as much. Pre-existing, inherited from Story 1-10, and the CSS pipeline under test is the same in both | **Observed 2026-08-26**, in the harness's own web server output |
| **`pnpm test` now needs a `git` binary and a real checkout** | `app/__tests__/anchor-contract.test.ts` shells out to `git ls-files` at collection time, three times: for the no-second-copy listing, for the repository-wide `cuatro-contracts` scan, and for the source-root pin. Run from an exported tarball, from a shallow copy with no `.git`, or in an image without git, the file fails at collection rather than reporting a finding. That is the right failure, and it is a new prerequisite for the blocking `test` job that did not exist before this story. The alternative, reading the working tree, is the one thing this check must not do (`public/contracts/` is generated and gitignored) | **Decision**, with the mechanism **Observed 2026-08-26** |
| **The length and number routes round to whole pixels** | Both canonicalise through `getComputedStyle` on a probe pinned at `font:16px/1`, so `outline-offset` reads back a rounded px string and `line-height` multiplies a unitless token by 16 before rounding. Two values differing below that step compare equal, the same shape of ceiling the colour row states. It is the right resolution for the question (a length that differs by less than a pixel paints the same) and it is a ceiling all the same | **Observed 2026-08-26**, from the canonical values the run logs |
| **The Windows development host cannot run the comparison** | Playwright names a snapshot per platform, so a bare `pnpm test:e2e` here looks for `work-360x800-win32.png` and fails. That is the intended answer, and `updateSnapshots: 'none'` means the failing run writes nothing to be committed by mistake | **Decision.** `ops/rendered-output-harness.md` |

## Which gate covers this, and why no CI workflow change was needed

**No `.github/workflows/ci.yml` change was made by this story, and that is the finding rather than
an omission.** **Observed 2026-08-26**: `git diff --stat b984ca7 -- .github` is empty.

| Obligation | Job that holds it | Nature |
|---|---|---|
| The wiring is `@use` and never `@import`, both files resolve inside `contracts/`, tokens before fonts, both above the local font forward, no name collides, no vendored copy, no consumer of a token name **and no consumer of a published family** | the blocking `test` job, through `app/__tests__/anchor-contract.test.ts`, in fourteen cases | **Decision.** Story 1-17. `vitest.config.ts:15` excludes `tests/e2e/**` and the Playwright specs are named `*.pw.ts`, so the browser half never runs here |
| The token contract is inlined into a linked stylesheet, all 89 names resolve on `:root` and still mean what the contract declares, the base motion scale resolves without the reduced-motion query, the fluid tokens resolve their middle term, the faces resolve over HTTP as real woff2 files, and the pre-change values are unmoved | the blocking `rendered-output` job, through `tests/e2e/contract-anchor.pw.ts`. `.github/workflows/ci.yml:179-220` runs `pnpm test:e2e` in the pinned image, so a new `*.pw.ts` file is gated with no workflow edit | **Observed 2026-08-26**, by reading the workflow and by running the suite: six cases, all green |
| The render did not move | the same job, through `tests/e2e/rendered-output.pw.ts`, which this story does not edit | **Decision.** Story 1-10's instrument, used rather than modified |
| `contracts/` did not drift | the existing `tokens-contract`, `fonts-contract` and `contract-purity` jobs, untouched | **Observed 2026-08-26**: `git diff --stat b984ca7 -- contracts packages` is empty |

## Pending Operator actions

This file hands the Operator work it cannot do from a development host. They are tracked here
rather than left in prose, in the shape `ops/rendered-output-harness.md`, `ops/token-contract.md`
and `ops/contract-serving.md` use.

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Confirm `cuatro.dev` looks unchanged after the merge to `main`** | Operator | A deploy fires only on a push to `main`, and this story's work is committed on `dev`, so nothing here has been rendered by the deployed container, behind Caddy, behind Cloudflare. The claim being confirmed is narrow and easy to check: the site should look exactly as it did before. **If anything moved, the revert is the two `@use` lines in `app/scss/_index.scss` and nothing else**, which is the whole reason this story was split from Story 1-18. Revert them, redeploy, and hand the difference back as a Block If on Story 1-17: it would mean adding the contract is not appearance-neutral, and choosing between weakening the gate and changing the plan is the Operator's call. Do **not** refresh the committed baseline | _not done_ |
| 2 | **Decide whether the `oklch()` downlevelling is acceptable before a wide-gamut token is authored** | Operator | Turbopack emits an sRGB hex fallback plus a `lab()` override for every `oklch()` in the contract. Faithful today, because no v1.0.0 token is outside sRGB. The day one is, the fallback silently clips it and the only visible symptom is a colour that looks slightly wrong on a display that could have shown it. The options are to accept it, to pin a browserslist target that keeps `oklch()`, or to keep the contract inside sRGB by rule | _not done_ |
| 3 | **Record the first real CI run of the `rendered-output` job with the new spec**, from the Actions run summary | Operator | The six new browser checks have only ever run in a container on a Windows development host. Same open item as `ops/contract-serving.md` action 5 and `ops/rendered-output-harness.md` action 1 | _not done_ |
| 4 | **Run `/bmad-project-context` to refresh the `bmad:context` block in `AGENTS.md`** | Operator | Still open from Stories 1-10, 1-12, 1-13 and 1-16, and this story widens it again. `AGENTS.md:52-53` describes CI as typecheck and tests only, against a file with five jobs, and `AGENTS.md:55-57` says Playwright is not installed and that no acceptance criterion may claim a browser check, which is now false for five spec files. Nothing in `AGENTS.md` yet says that the Hub's stylesheet graph loads `contracts/` directly, which is the first thing an agent editing `app/scss/` needs to know | _not done_ |

**Maintaining this file.** When an action is performed, replace its `_not done_` cell with the ISO
8601 UTC completion date and leave the row in place. When a figure is re-measured, add the new row
with its own date and method and keep the old one, so a later reader can see whether a number
moved or was simply re-stated. Deletion is not used here.

## What would invalidate this record

| If this changes | This record is wrong until it is re-read |
|---|---|
| `app/scss/_index.scss` stops loading `contracts/` | The contract leaves the graph, and the "loads nothing under `contracts/`" case fails first |
| A contract load changes from `@use` to `@import` | **This is the row that matters.** With an explicit `.css` extension it becomes a runtime `@import` and the contract leaves the inlined graph; the `@use`-never-`@import` case is what fails first. A `.css` extension on a `@use` changes nothing at all, per the four-fixture measurement above, and trips only the separately labelled convention check. This row previously said the extension was what decided it, which is the same wrong claim the rest of this file was written to correct |
| A story authors a copy of a contract file under `app/`, `components/` or `public/` | AD-4's one authored location is gone, and the `git ls-files` case fails naming the path |
| `contracts/tokens.css` gains or loses a name | **Both halves of the story fail on the pinned count**, `app/__tests__/anchor-contract.test.ts` and `tests/e2e/contract-anchor.pw.ts` each naming 89 and what they read instead, and the count of **89** here is stale. This row previously claimed a removal would "fail naming the property", which was **not true** while the counts were bounded rather than pinned: the loop that reads each name back simply got shorter and passed. Pinning is what made the claim true. An addition is a MINOR bump and a removal is MAJOR under the contract's own rules, so both are meant to be loud |
| `contracts/tokens.css` changes a value | The browser check fails naming the property, both the authored and the substituted form of what it expected, and what `:root` answered |
| A contract value changes shape, for example a `clamp()` becoming a fixed length | The wide-viewport case fails first: it asserts both fluid tokens are still `clamp()` before it measures them |
| The Next or Turbopack version changes what it emits for `oklch()`, for a leading zero or for a duration unit | The transform table above is stale. The comparison itself is written against the browser's meaning rather than against the text, so it should still pass, and if it does not it fails naming the property and both values |
| `app/app.scss`'s sixteen custom properties are redefined | That is Story 1-18, and this file's "What Story 1-18 does next" section becomes history rather than a plan |
| A component stylesheet starts declaring its own custom property | The "no collision by construction" argument above needs re-checking, because it rests on all sixteen living in one file |
| `contracts/fonts.css` gains or loses a face, or `app/scss/_fonts.scss` does | Both halves pin the counts, **three published and ten local**, and both fail naming what they read instead. The counts here are then stale. The ten is worth its own mention: the Code Map, this record and a test comment all said nine until it was counted |
| A Hub source sets a published family, for example `font-family: Geist` | The face stops being unused, the browser downloads it and the Hub paints different glyphs. The family scan in `app/__tests__/anchor-contract.test.ts` fails naming the file and the family. That case did not exist until the second follow-up review, and until it did, this whole table had no row for the font side of "consumed by nothing" |
| A second stylesheet in the build also carries the contract | The 89 declarations and the three faces ship twice. The inlining check pins the carrying count at one and fails naming the marker |
