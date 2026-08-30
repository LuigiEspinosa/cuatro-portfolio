# The asset budget, measured

The written record of what the Hub actually ships: the narrative bundle weighed against the estimate
`EXPERIENCE.md` § Asset Budget carries, the narrative assets weighed for the first time, the non-3D
path weighed against the 140 KB that binds, the method that gathered every figure, and the limits
that method still has.

Written during Story 2-2 on **2026-08-29** (ISO 8601 UTC), against baseline commit `9662d03`.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/font-contract.md`, `ops/rendered-output-harness.md` and
`ops/capacity-measurement.md` set: every value is marked as either a decision or an observation, and
the two are never presented as the same kind of fact (NFR-9). An observed value also carries the
method that gathered it, because a number without a method is a claim.

**Story ids are written hyphenated**, as `Story 2-2`, matching the keys in
`_bmad-output/implementation-artifacts/sprint-status.yaml`. `epics.md` writes the same ids dotted.
They are the same stories.

**Nothing about the build, the bundle or the assets was changed to produce this file.** Story 2-2
measures and records. Every finding below is a reading, not a gate: `.github/workflows/ci.yml` gained
no job, and Story 2-34 is where a gate belongs.

**KB is 1000 bytes throughout**, and gzip is level 9, both matching `ops/font-contract.md:136` and
`packages/fonts/subset.py`, so a figure here and a figure there mean the same thing.

## What in this file is measured, and what is written

Some of this file is printed by a tool and some of it is written by hand, and telling them apart is
the difference between a figure a reader can re-derive and one they have to take on trust. So:

| Section | Where it comes from |
|---|---|
| § The build this reading was taken from | **Verbatim**, `node ops/asset-budget.mjs` |
| § The narrative bundle, its table | **Verbatim** |
| § The narrative assets, its table and the orphan paragraph | **Verbatim** |
| § The non-3D path, both readings and every table under them | **Verbatim** |
| § Every route | **Verbatim** |
| § The faces the built CSS declares, its table and its resolution list | **Verbatim** |
| § Method, including the fingerprint proof table | **Verbatim** |
| § Findings | **Verbatim** |
| The preamble, § What in this file is measured, § What this reads against the budget's own rules, § Stated limits, § What this closes, § Pending Operator actions, and every paragraph headed by a bold sentence | **Editorial.** Written here, around the tool's output |

**How to check it.** Run `corepack pnpm build` and then `node ops/asset-budget.mjs`, and diff the
output against the sections marked verbatim above. Every heading level, every table and every
sentence in them is the tool's. Chunk file names are content hashes, so they move with the build;
what should not move for one `BUILD_ID` is anything else. The editorial sections quote the tool's
figures but restate them in prose, so a re-run does not reproduce them line for line.

**The provenance is the tool's, not this file's.** The commit, the build timestamp and the dirty
check in the next table are read by `ops/asset-budget.mjs` from git and from `.next/` on every run,
so this record cannot claim a commit the reading was not taken at. The one date this file supplies is
its own authoring date, at the top.

## The instrument

`ops/asset-budget.mjs` reads `.next/`, resolves what each route's own prerendered document
references, gzips it, attributes chunks to libraries by fingerprint, resolves which declared faces a
`font-family` rule can reach, reads which routes a request never reaches, measures
`public/assets/home/`, and prints the block below plus its findings. It has no dependencies, takes no
arguments, and changes nothing. It exits 1, printing nothing to stdout, when there is no build to
measure, when a referenced file or a declared face is not on disk, when `contracts/fonts/` holds no
face, or when one of its own fingerprints stops matching anything.

```
corepack pnpm build          # writes .next/BUILD_ID
node ops/asset-budget.mjs    # prints this record's block, exit 0
```

`ops/__tests__/asset-budget.test.ts` writes whole scratch `.next/` trees with known byte counts and
holds the per-route arithmetic to them, plus every refusal and every pure function. It reads no
`.next/` of this repository's, because the CI unit job has no build and a suite that needed one would
assert nothing on the only runner that gates a merge.

## The build this reading was taken from

| Property | Value | Nature |
|---|---|---|
| `.next/BUILD_ID` | `uXKXS8QHdHPNgUPIdvcnq` | **Observed** |
| Build written | 2026-08-30T01:48:17Z | **Observed**, mtime of `.next/BUILD_ID` |
| Commit | `9662d037dd9f01899b94bbe8ccbb7ddfe1b830f7` | **Observed**, `git rev-parse HEAD` |
| Measured inputs dirty | none | **Observed**, `git status --porcelain -- app components contracts packages public next.config.js package.json` |
| Prerendered documents | 8 | **Observed** |
| Chunks written | 20 `.js`, 11 `.css` | **Observed** |
| Bytes in `.next/static/chunks` | 2,025,358 on disk, 618,713 gzipped | **Observed** |

**The build timestamp is UTC and this file's date is not.** The build was written at 01:48 UTC on
2026-08-30, which is the evening of 2026-08-29 on the authoring host. One is the tool's reading of
the build, the other is this record's authoring date, and they are a few hours rather than a day
apart.

## The narrative bundle

`EXPERIENCE.md:946` estimates Three.js, R3F, drei, postprocessing, GSAP, ScrollTrigger and lenis at
300 to 450 KB gzipped, from published library sizes, and says "Measure before trusting". This is the
measurement.

Every chunk in the build a narrative fingerprint hits. The whole chunk is attributed to the
libraries found in it, which overstates wherever a chunk mixes narrative and shell code. That is a
stated limit with a direction, and the direction is the safe one.

| Chunk | Bytes on disk | Bytes gzipped | Libraries | On which routes | Nature |
|---|---|---|---|---|---|
| `0g0oqlx4fsym~.js` | 870,402 | 228,423 | three, @react-three/fiber | `/`, `/projects`, `/work` | **Observed** |
| `01l6rdvnhwq_7.js` | 263,900 | 110,487 | @react-three/postprocessing, postprocessing, gsap/SplitText | `/` | **Observed** |
| `08pj4xkz~kajd.js` | 70,032 | 26,971 | gsap | `/`, `/_not-found`, `/celeste`, `/cv`, `/projects`, `/recommendation`, `/work` | **Observed** |
| `0r_9pnds9g3a0.js` | 43,379 | 17,542 | gsap/ScrollTrigger | `/`, `/_not-found`, `/celeste`, `/cv`, `/projects`, `/recommendation`, `/work` | **Observed** |
| `0nwet2hiefxan.js` | 38,538 | 12,069 | lenis | `/`, `/_not-found`, `/celeste`, `/cv`, `/projects`, `/recommendation`, `/work` | **Observed** |
| `02pspqt~odrwp.js` | 28,196 | 9,506 | three-stdlib | `/work` | **Observed** |
| `118wy7xsvte16.js` | 22,945 | 7,300 | three-stdlib | `/projects` | **Observed** |
| `0n9mb1l0dkz1g.js` | 24,526 | 6,459 | three, @react-three/drei | none: loaded on demand | **Observed** |
| **Total, every narrative chunk in the build** | **1,361,918** | **418,757** |  |  | **Observed** |
| Of that, on the heaviest 3D route `/` |  | 395,492 |  |  | **Derived** |
| Of that, referenced by no document and loaded on demand |  | 6,459 |  |  | **Derived** |
| Estimate this replaces |  | 300,000 to 450,000 |  |  | **Decision**. `EXPERIENCE.md:946` |
| Against the estimate |  | inside the range, 31,243 below the top |  |  | **Derived** |

**The estimate was right about the size and wrong about the shape.** **Derived.** 418,757 sits inside
300,000 to 450,000, so the trade `EXPERIENCE.md:963` names is not triggered. What the estimate did
not say is how little of it is deferred: 6,459 bytes, 1.5 percent. The other 412,298 is referenced by
a prerendered document and fetched at first paint.

**Why the split does almost nothing.** **Observed 2026-08-29**, by reading the three boundaries.
`GemComponent.tsx:8`, `TorusCanvas.tsx:8` and `TorusKnotCanvas.tsx:8` each wrap `Scene.tsx` in
`next/dynamic` with `ssr: false`, and each pulls a heavy library in statically beside that call:
`@react-three/postprocessing` at `GemComponent.tsx:5`, and `three` plus `@react-three/fiber` through
the siblings the other two import at their own line 5 and 6 (`Torus.tsx:4-5`, `TorusKnot.tsx:4-5`,
`CanvasOrbitControls.tsx:3-5`). A static import is not deferred by a dynamic call next to it, so the
libraries land in the parent's chunk regardless and only `Scene.tsx` and the drei
`PerformanceMonitor` it uses at `Scene.tsx:5` end up behind the split. That is the 6,459 bytes.

**`gsap` and `lenis` are worse.** **Observed 2026-08-29.** `app/providers.tsx:4-6` imports `lenis`,
`gsap` and `ScrollTrigger` at module scope, and the root layout renders `Providers`, so all three are
on every route including the ones with no 3D at all. 56,582 gzipped bytes of narrative library are on
`/celeste` and on the 404.

**What would be traded, and is not being traded here.** **Decision.** If the narrative had exceeded
450 KB, `EXPERIENCE.md:963` names `@react-three/postprocessing` as the first thing to examine. It
did not, so nothing is traded. For whoever revisits this: the chunk carrying
`@react-three/postprocessing`, `postprocessing` and `gsap/SplitText` is 110,487 gzipped bytes on `/`
alone, and dropping it would cost the `EffectComposer` and `Bloom` pass at `GemComponent.tsx:37-39`,
which is the glow the gem reads as. Story 2-2 does not make that call.

## The narrative assets

`EXPERIENCE.md:947` records geometry and textures as "Unmeasured. Not inspected in this run". They
are inspected now.

Everything under `public/assets/home/`, with the `path:line` that names it. A reference is a line in
`app/` or `components/` (tests excluded) or in a sibling asset that carries the file name, matched
on a word boundary so one name that is a prefix of another is not a hit. A referrer marked "imported
by nothing" is a module outside `app/` that compiles and that no route reaches; liveness follows the
sibling chain to a fixed point, so an asset named only by a dead asset is dead too.

| Asset | Bytes on disk | Bytes gzipped | Referenced from | Reached | Nature |
|---|---|---|---|---|---|
| `environment_D.hdr` | 14,377 | 9,996 | `components/atoms/Gem/Gem.tsx:16`, imported by nothing | **no** | **Observed** |
| `gem-fallback.png` | 1,755,015 | 1,752,140 | `components/molecules/GemComponent/GemComponent.tsx:28` | yes | **Observed** |
| `gem.glb` | 600,008 | 189,403 | `components/atoms/Gem/Gem.tsx:19`, imported by nothing | **no** | **Observed** |
| `gem.gltf` | 1,826 | 542 | **nothing** | **no** | **Observed** |
| `gem_data.bin` | 598,968 | 188,827 | `public/assets/home/gem.gltf:91` | **no** | **Observed** |
| **Total** | **2,970,194** | **2,140,908** |  |  | **Observed** |
| Reachable from a module something imports | 1,755,015 |  |  |  | **Derived** |
| Reachable from nothing | 1,215,179 |  |  |  | **Derived** |
| Estimate this replaces | not inspected | not inspected |  |  | **Decision**. `EXPERIENCE.md:947` |

Components outside `app/` that nothing imports: `components/atoms/Gem/Gem.tsx`,
`components/atoms/VenomSculpture/VenomSculpture.tsx`. **Observed**, by resolving every `from '...'`,
`import('...')` and bare `import '...'` specifier under `app/` and `components/` against the
repository root and the `@/` alias `tsconfig.json` declares, accepting a directory specifier as its
`index`. `app/` is excluded on both sides: an App Router entry point has no importer by
construction.

**Two components are authored, compile, and are on no page.** **Observed 2026-08-29.** `Gem.tsx` is
the only thing that names `gem.glb` and `environment_D.hdr`, so 614,385 bytes of geometry and
environment map are committed, published under `public/`, served by the origin, and requested by no
route. `gem.gltf` and its `gem_data.bin` are a second copy of the same mesh in a different container,
named by nothing at all, at another 600,794 bytes.

**Nothing here is deleted.** **Decision.** Story 2-2 records; deleting a published asset is a
different story's risk, and `GemComponent.test.tsx:14` still mocks `@/components/atoms/Gem/Gem`,
which is how an orphan survives a green suite.

**`gem-fallback.png` is the largest file under `public/`**, at 1,755,015 bytes, and it gzips to
1,752,140, which is what a PNG does. It is live: `GemComponent.tsx:24-31` renders it when the WebGL
probe fails. **Observed 2026-08-29**, and the string `gem-fallback` appears in none of the eight
prerendered documents, because the probe starts at `null` and the server renders the Scene branch. So
it is in no route total below, and for a visitor without WebGL it is a 1.75 MB image fetched after
hydration on a path the budget never modelled.

## The non-3D path

`EXPERIENCE.md:945` fixes the number that binds: **140 KB gzipped**, "what Daniela gets on a slow
connection".

A route is non-3D here when no chunk it references carries the WebGL stack. 5 of the 8 prerendered
documents qualify, and 1 of those can actually be loaded: 2 are answered by a redirect (`/cv`,
`/recommendation`) and 2 are Next's own document (`/_global-error`, `/_not-found`), all read from
`.next/routes-manifest.json` rather than asserted here. The § Every route table below carries the
same column for every route. The heaviest route a visitor can load is `/celeste`, and a ceiling has
to hold for the worst case rather than the average, so that is the one measured.

### Reading one: what the document puts on the wire

Every `<script src>` and every `<link>` whose `rel` carries `stylesheet`, `preload` or
`modulepreload`, deduplicated on the resolved path and gzipped at level 9, plus the document itself.

| Item | Bytes gzipped | Nature |
|---|---|---|
| The document itself, `celeste.html` | 2,716 | **Observed** |
| Scripts | 245,605 | **Observed** |
| Stylesheets | 3,063 | **Observed** |
| Preloaded, not otherwise referenced | 32,561 | **Observed** |
| **Total** | **283,945** | **Observed** |
| Budget | 140,000 | **Decision**. UX-DR7, `EXPERIENCE.md:945` |
| **Overage** | **143,945, 102.8 percent over** | **Derived** |

The preload row itemised, because a total a reader cannot check is not a measurement:

| Preloaded | `as` | Priority | Bytes gzipped | Nature |
|---|---|---|---|---|
| `.next/static/chunks/0d_8a3hzs285~.css` | style | default | 509 | **Observed** |
| `.next/static/chunks/0fmvj6dex6cl5.css` | style | default | 268 | **Observed** |
| `.next/static/chunks/0vxqa2ji5s6~v.css` | style | default | 545 | **Observed** |
| `public/fonts/ConfilliaNormal-Regular.woff2` | font | default | 11,303 | **Observed** |
| `public/fonts/MonumentExtended-Bold.woff2` | font | default | 19,936 | **Observed** |
| **Total** |  |  | **32,561** | **Observed** |

Of the whole total, 31,239 is font faces preloaded unconditionally at `app/layout.tsx:40-53`, and
39,520 is a `noModule` script that no browser with module support fetches. Both are counted: the
document puts them on the wire without asking anything, and a total that quietly dropped either
could not be checked by a reader. A modern browser's figure is 244,425.

**The single largest contributor is `.next/static/chunks/1416ak9gh4br1.js` at 70,572 bytes
gzipped**, which carries react-dom and no narrative library. **Observed**.

**The remaining 1,322 bytes of that preload row are three stylesheets for other routes**, at 509, 268
and 545 gzipped bytes, none of which `/celeste` links as a stylesheet of its own. **Observed
2026-08-29**, from the itemised table above. They are small, and they are named because a row a
reader cannot decompose is a claim rather than a measurement.

**The two font preloads are counted, and here is what they cost.** **Observed 2026-08-29.**
`MonumentExtended-Bold.woff2` (19,936 gzipped) and `ConfilliaNormal-Regular.woff2` (11,303) are
preloaded unconditionally at `app/layout.tsx:40-53`. The comment at `:39` gives a real reason, that
`SplitText` needs correct widths on first paint, and this story does not argue with it. Rule 4 of
§ Asset Budget says preload only what the non-3D path needs, and whether that holds is what the
number decides. Two things it decides:

- `MonumentExtended-Bold` is reached by no `font-family` rule in the built CSS (see § The faces
  below). Those 19,936 bytes are fetched at high priority and used by nothing.
- Both preloads point at `/fonts/`, while the `@font-face` rules the SCSS emits point at hashed
  copies under `/_next/static/media/`. They are different URLs, so the preload does not prime the
  cache for the face: `ConfilliaNormal` ships twice for a visitor who uses it.

### Reading two: on the budget's own decomposition

`EXPERIENCE.md:936` decomposes the non-3D payload as HTML plus one CSS file plus three woff2
subsets, and names no JavaScript at all. Measured on those line items and nothing else:

| Budget line | Budget | Measured | Nature |
|---|---|---|---|
| HTML + critical CSS | 20,000 | 5,779 | **Observed** |
| Fonts: the 3 latin subsets in `contracts/fonts/` | 120,000 | 94,489 | **Observed**, re-gzipped from the committed binaries |
| **Non-3D path total** | **140,000** | **100,268** | **Derived** |
| Margin |  | 39,732, 28.4 percent | **Derived** |

The two readings are 183,677 bytes apart: the 245,605 of JavaScript and 32,561 of preloads the
decomposition has no line for, less the 94,489 of contract faces the document itself does not
reference.

**Both readings are true, and the gap between them is the finding.** **Derived.** The budget's own
line items come in 28.4 percent under. What is actually on the wire is 102.8 percent over. The
decomposition assumed the narrative was deferred, and § The narrative bundle above shows that 98.5
percent of it is not.

The 94,489 figure agrees with `ops/font-contract.md:145` and `packages/fonts/faces.json:5`, and
`ops/__tests__/asset-budget.test.ts` re-measures the three committed binaries with
`zlib.gzipSync({level: 9})` on every unit run so the two records cannot drift apart silently.

## Every route

| Route | Document bytes | Gzipped on the wire | Carries WebGL | Served | Nature |
|---|---|---|---|---|---|
| `/` | 14,774 | 625,823 | yes | yes | **Observed** |
| `/work` | 21,503 | 524,741 | yes | yes | **Observed** |
| `/projects` | 17,352 | 521,166 | yes | yes | **Observed** |
| `/celeste` | 14,782 | 283,945 | no | yes | **Observed** |
| `/recommendation` | 14,710 | 283,710 | no | **no**: 308 to `/pdf/recommendation-letter.pdf` | **Observed** |
| `/cv` | 14,556 | 283,695 | no | **no**: 308 to `/pdf/cv.pdf` | **Observed** |
| `/_not-found` | 13,513 | 283,633 | no | **no**: Next's own document | **Observed** |
| `/_global-error` | 9,686 | 188,791 | no | **no**: Next's own document | **Observed** |

The two redirects are `next.config.js:13-26`, and the tool reads them from
`.next/routes-manifest.json` rather than from that file, so the column answers what the build does
rather than what the source says.

## The faces the built CSS declares

A family is reached when a `font-family` declaration outside a `@font-face` block names it, directly
or through a `var()` chain followed to a fixed point, matched case-insensitively and with a
`!important` stripped. Declared and reached are different claims: a face no rule names is never
fetched, however faithfully it is built and served. Every format each family declares is weighed,
not only its woff2, because the legacy blocks declare woff and ttf beside it and this build emits
all of them.

| Family | Formats | Bytes on disk, all formats | Bytes gzipped, all formats | Reached | Nature |
|---|---|---|---|---|---|
| Bricolage Grotesque | woff2 | 58,992 | 59,030 | yes | **Observed** |
| Confillia | woff2, woff, ttf | 54,784 | 42,938 | **no** | **Observed** |
| Confillia Normal | woff2, woff, ttf | 54,032 | 42,292 | yes | **Observed** |
| Geist | woff2 | 24,124 | 24,152 | yes | **Observed** |
| Geist Mono | woff2 | 11,284 | 11,307 | yes | **Observed** |
| GeneralSans-Bold | woff2, woff, ttf | 112,872 | 79,113 | **no** | **Observed** |
| GeneralSans-Light | woff2, woff, ttf | 120,100 | 86,167 | **no** | **Observed** |
| GeneralSans-Medium | woff2, woff, ttf | 119,068 | 85,253 | **no** | **Observed** |
| GeneralSans-Regular | woff2, woff, ttf | 119,684 | 85,984 | **no** | **Observed** |
| GeneralSans-Semibold | woff2, woff, ttf | 119,552 | 86,174 | **no** | **Observed** |
| MonumentExtended-Bold | woff2, woff, ttf | 105,020 | 75,066 | **no** | **Observed** |
| MonumentExtended-Light | woff2, woff, ttf | 106,620 | 76,606 | **no** | **Observed** |
| MonumentExtended-Regular | woff2, woff, ttf | 105,252 | 75,343 | **no** | **Observed** |
| **Total** |  | **1,111,384** | **829,425** |  | **Observed** |
| Of that, reached by no rule |  | 962,952 | 692,644 |  | **Derived** |

9 of the 13 families the built CSS declares are reached by no rule. The values it declares outside a
`@font-face`, and what each resolves to:

- `font-family: sans-serif` resolves to `sans-serif`
- `font-family: system-ui` resolves to `system-ui`
- `font-family: var(--confillia-normal)` resolves to `Confillia Normal`
- `font-family: var(--font-mono)` resolves to `Geist Mono`, `ui-monospace`, `SFMono-Regular`,
  `monospace`
- `font-family: var(--font-regular)` resolves to `Geist`, `ui-sans-serif`, `system-ui`, `sans-serif`
- `font-family: var(--monument-bold)` resolves to `Bricolage Grotesque`, `Archivo`, `system-ui`,
  `sans-serif`
- `font-family: var(--monument-regular)` resolves to `Bricolage Grotesque`, `Archivo`, `system-ui`,
  `sans-serif`

**One hop would have been wrong.** **Decision.** `--monument-bold` holds `var(--f-display)`, which
holds the family, so a resolver that stopped after one hop would report Bricolage Grotesque, which is
on every page, as unreachable, and hand a later story a reason to delete it. The chain is followed to
a fixed point, a `var(--x, "Fallback")` arm is followed where the property is not defined, and a
custom property that resolves to neither a family nor a fallback is reported **unresolved**, never
assumed to reach nothing. This build has none.

**The nine unreached families are nine of the ten `@font-face` blocks in `app/scss/_fonts.scss:19-121`.**
**Observed 2026-08-29.** Story 1-18 pointed `--monument-regular`, `--monument-bold`,
`--font-regular`, `--font-bold` and `--font-mono` at the contract families (`app/app.scss:40-59`),
and the legacy blocks stayed behind them, still emitted into `.next/static/media` and still served.
Each of them declares woff2, woff and ttf, and this build emits all three, so the standing cost is
**962,952 bytes on disk, 692,644 gzipped**, and not the 185,400 gzipped that their woff2 files alone
come to. Weighing only the woff2 would have understated it by 507,244 gzipped bytes. The tenth,
`Confillia Normal`, is reached because `app/app.scss:45` still holds the family name itself rather
than an alias, which the comment at `:43-44` says is deliberate and gated on O-6. Retiring the rest
is Story 2-20's, named as such in `ops/font-contract.md:462`. This file only says how much is
standing there.

**None of those bytes is on any route total above**, because no rule names the families and no
document preloads them, except `MonumentExtended-Bold.woff2`, which the layout preloads and which
the § Reading one table therefore counts. **Derived.** They are a standing cost of what the origin
serves, not of what a visitor fetches.

## What this reads against the budget's own rules

§ Asset Budget carries five rules. Two of them this measurement bears on directly, and one of those
it falsifies.

**Rule 1 does not hold.** `EXPERIENCE.md:951-952` states: "The non-3D path is the budget that binds.
Everything narrative is deferred, lazy and non-blocking. If the narrative is not loaded, nothing on
the page is missing." **Derived**, from the two tables above: 412,298 of the 418,757 gzipped
narrative bytes, 98.5 percent, are referenced by a prerendered document and fetched at first paint,
and 56,582 of them ship on routes that have no 3D on them at all. The narrative is not deferred, is
not lazy, and blocks nothing only in the sense that `async` scripts do not block parsing. Rule 1 is
the assumption the budget's own decomposition is built on, which is why reading two passes and
reading one fails by 102.8 percent. It is the rule the central finding actually breaks, and it is
named here rather than left for a reader to infer.

**Rule 4 is the one the preload figures test.** `EXPERIENCE.md:956-957` says "Preload only what the
non-3D path needs." The two preloaded faces cost 31,239 gzipped bytes on a route that is already
143,945 over budget, and at least 19,936 of those are a family no rule can reach. That is a finding
about the preloads, recorded above, and Story 2-2 changes neither of them.

**Rules 2, 3 and 5 are outside what this measurement can say.** Rule 2 is about Suite Directory
interactive, which is a browser measurement; Rule 3 is satisfied and its figures are in
`ops/font-contract.md`; Rule 5 is about the LCP element, which nothing here inspects.

## Method

**The instrument.** `ops/asset-budget.mjs`, run as `node ops/asset-budget.mjs` against the build
above. It reads `.next/`, `contracts/fonts/`, `app/`, `components/` and `public/assets/home/`, and
writes nothing anywhere.

Taken against `.next/BUILD_ID` `uXKXS8QHdHPNgUPIdvcnq`, written by `corepack pnpm build` on
2026-08-30T01:48:17Z, at commit `9662d037dd9f01899b94bbe8ccbb7ddfe1b830f7`. Bytes on disk are
`stat`. Bytes gzipped are `zlib.gzipSync` at level 9, the level `packages/fonts/subset.py` uses, so
a font figure here and a font figure in `ops/font-contract.md` are the same measurement. KB is 1000
bytes throughout.

A route's assets come from its own prerendered HTML under `.next/server/app`, walked recursively,
not from a manifest: Turbopack writes no `app-build-manifest.json`, and `build-manifest.json`
carries only `rootMainFiles` and `polyfillFiles`, so a manifest read would report a subset and call
it the total. Every `<script src>` and every `<link>` whose `rel` token list carries `stylesheet`,
`preload` or `modulepreload` is resolved to a file on disk, deduplicated on that resolved path, and
weighed. `rel=preconnect` and `rel=icon` are not counted: the first fetches nothing and points at
`/`, the second is neither a script, a stylesheet nor a preload. A reference with no file behind it
stops the run rather than being counted as zero, and so does a built `@font-face` naming a file the
build did not write.

Which routes are served comes from `.next/routes-manifest.json`: a literal redirect source is
answered by the redirect, so its prerendered document is never fetched, and a `_`-prefixed document
is Next's own. A parameterised redirect source is not matched against a concrete document rather
than guessed at.

Determinism. Nothing here reads a clock, a locale or a random source. The reading is stamped with
the build's own mtime and with `git rev-parse HEAD`, both properties of what was measured rather
than of when the tool ran, so two runs against one build print the same bytes even across midnight.
Every listing is sorted, and digits are grouped by hand rather than by `toLocaleString`, which
answers differently under a different `LANG`.

**Demonstrated rather than asserted.** **Observed 2026-08-29**, by capturing stdout twice through
`cmd /c "node ops\asset-budget.mjs > FILE"`, which is byte-exact where a PowerShell redirection can
re-line-end the stream, and hashing both: 15,978 bytes and sha256
`C9EC69C7FB7173589B9F16F2D032F05A2C99EBC9B19379D33A460A2B2820A132` each time.

### The fingerprints, and the proof that each discriminates

Turbopack minifies to numeric module ids and emits no module paths, so per-module attribution inside
a chunk is not available and a fingerprint is the only lever. Each mark below is a literal string
from its own library's source. The hit column is every chunk in this build the mark appears in, with
its count, which is what makes the claim that it discriminates a demonstration rather than an
assertion. A mark that matched nothing would stop the run, because an attribution that silently
found no `three` would print a narrative total of zero and read like a passing budget.

| Library | Fingerprint | WebGL | Chunks it hits, with counts | Nature |
|---|---|---|---|---|
| three | `WebGLRenderer` | yes | `0g0oqlx4fsym~.js` (35), `0n9mb1l0dkz1g.js` (2) | **Observed** |
| @react-three/fiber | `react-three-fiber` | yes | `0g0oqlx4fsym~.js` (2) | **Observed** |
| @react-three/drei | `onIncline` | yes | `0n9mb1l0dkz1g.js` (3) | **Observed** |
| three-stdlib | `OrbitControls.js encountered` | yes | `02pspqt~odrwp.js` (3), `118wy7xsvte16.js` (3) | **Observed** |
| @react-three/postprocessing | `@react-three/postprocessing` | yes | `01l6rdvnhwq_7.js` (1) | **Observed** |
| postprocessing | `KawaseBlurPass` | yes | `01l6rdvnhwq_7.js` (1) | **Observed** |
| gsap | `GSAP target ` | no | `08pj4xkz~kajd.js` (1) | **Observed** |
| gsap/ScrollTrigger | `scrollerProxy` | no | `0r_9pnds9g3a0.js` (1) | **Observed** |
| gsap/SplitText | `SplitText called before fonts loaded` | no | `01l6rdvnhwq_7.js` (1) | **Observed** |
| lenis | `lenisVersion` | no | `0nwet2hiefxan.js` (1) | **Observed** |

Two hits for `three` is not a mixed fingerprint. `0g0oqlx4fsym~.js` carries the library and
`0n9mb1l0dkz1g.js` carries its namespace re-export barrel, which exists only because `three` is
imported. Both are narrative-bearing.

**The marks that were rejected, and why**, **observed 2026-08-29** by grepping each across all
20 `.js` chunks:

| Candidate | Why it was rejected |
|---|---|
| `gsap` | 7 chunks, most of them app code. `0.31yxb.7famg.js` is 1,925 bytes, matches it three times through the Hub's own `useGsapContext` helper, and carries no gsap at all |
| `OrbitControls` | matches the app's own `CanvasOrbitControls` as well as the library. `OrbitControls.js encountered`, which is a warning string in the library, does not |
| `EffectComposer` | `@react-three/postprocessing` exports the name and the Hub imports it at `GemComponent.tsx:5`, so it would match a re-export barrel as readily as the implementation |
| `three-stdlib`, `drei`, `useGLTF`, `DRACOLoader` | zero hits. A fingerprint that matches nothing is a defect in the table, and the tool refuses rather than reporting a library as absent |

**Shell marks**, used only so the largest contributor to a total is named rather than quoted as a
content hash, and never to classify anything: `react-dom`, `flightRouterState` for the Next app
router, and `core-js` for the polyfill chunk. **Decision.** A chunk is narrative-bearing if and only
if a fingerprint above hits it.

## Findings

- The narrative bundle is 418,757 bytes gzipped across 8 chunks, against an estimate of 300,000 to
  450,000. That is inside the range, 31,243 below the top.
- 6,459 bytes of that is genuinely deferred: `0n9mb1l0dkz1g.js` is referenced by no prerendered
  document. The other 412,298 is on a document at first paint, so the `next/dynamic` boundaries
  defer far less than their shape suggests.
- The non-3D path is over budget as measured: 283,945 against 140,000, 143,945 over, on route
  `/celeste`. The largest single contributor is `.next/static/chunks/1416ak9gh4br1.js` at 70,572.
- On the budget's own decomposition it is inside: 100,268 against 140,000, 39,732 of margin. That
  decomposition has no line for the 245,605 of JavaScript or the 32,561 of preloads the document
  actually carries.
- 9 of the 13 families the built CSS declares are reached by no `font-family` rule, and their
  962,952 bytes on disk (692,644 gzipped, all formats) are emitted and served regardless: Confillia,
  GeneralSans-Bold, GeneralSans-Light, GeneralSans-Medium, GeneralSans-Regular,
  GeneralSans-Semibold, MonumentExtended-Bold, MonumentExtended-Light, MonumentExtended-Regular.
- 1,215,179 bytes under `public/assets/home/` are reachable from no module anything imports:
  `environment_D.hdr`, `gem.glb`, `gem.gltf`, `gem_data.bin`. They are committed, they are served,
  and no route asks for them.

## Stated limits

Naming these is the point of the section: a measurement that ships is easily mistaken for a
measurement that covers everything.

| Limit | Why it stands | Nature |
|---|---|---|
| Attribution is at chunk granularity, and a mixed chunk is counted whole to the narrative | Turbopack minifies to numeric module ids and emits no module paths, so nothing inside a chunk can be weighed separately. `01l6rdvnhwq_7.js` carries `postprocessing`, `gsap/SplitText` and the Hub's own `/` page code, and all 110,487 of its gzipped bytes are attributed to the narrative. The direction is knowable and it is the safe one: the narrative cannot be smaller than the chunks that carry no shell code at all | **Decision**, recorded rather than corrected |
| Gzip level 9 is not what the origin sends | `next.config.js` sets no `compress` key, so Next's default applies and the standalone server compresses at Node's `Z_DEFAULT_COMPRESSION`, not at 9. Measured on this build, `/celeste` is 283,945 at level 9 and 284,578 at the default, a 633 byte difference, and `/` is 625,823 against 627,245. Cloudflare sits in front of the origin (AD-26) and may re-compress again. Level 9 is used because it is what `ops/font-contract.md` uses, so the two records compare, and because it is the most favourable gzip reading: a budget that fails at level 9 fails harder in production | **Observed 2026-08-29**, by gzipping each route's payload at both levels |
| Declared is not fetched | Every font figure here is the weight of a face the build serves, not of a face a browser downloaded. A browser fetches a face only when a glyph in its `unicode-range` is actually rendered, so reading two's 94,489 is a ceiling on the contract faces rather than an observation of a transfer. The nine unreached families are the opposite case and the claim there is stronger: no rule names them, so no glyph can trigger them | **Decision** |
| Reachability reads `font-family` declarations only | A family named through the `font` shorthand, or set from JavaScript, or declared only inside a media query or under a theme selector, would read as unreachable. None occurs today: the built CSS holds zero `font:` shorthands and zero `font-family` inside a `@media` block, and nothing under `app/` or `components/`, tests excluded, carries a `fontFamily` or a `font:` shorthand. The seven declarations listed above are the whole set. A future one would need this method widened rather than trusted | **Observed 2026-08-29**, by regex across the eleven built `.css` chunks and every `.ts`, `.tsx`, `.scss` and `.css` under `app/` and `components/` |
| The whole reading is one build, and two builds from one commit are not byte-identical | Three builds were taken from commit `9662d03` during this story. `/celeste` read 283,949, then 283,942, then 283,945, and the narrative total 418,743, then 418,757 twice. Chunk file names changed completely between the first and the second and not at all between the second and the third, so a rebuild may or may not move them and neither outcome is a defect. The determinism this file asserts is of the tool against one build, not of the build against itself, and every figure and chunk name printed here is good for `BUILD_ID` `uXKXS8QHdHPNgUPIdvcnq` only | **Observed 2026-08-29** |
| The tool re-reads everything on every call, and its cost grows with the build | It walks `app/` and `components/` once per asset and once per orphan check, and gzips each chunk once for the build table and again for each document that references it. On this build that is a second or two and nobody notices. On a build with many more routes it would be quadratic in the wrong place. It is a reading run by hand, not a gate on a runner, so the cost is recorded rather than optimised | **Decision.** Story 2-2 scope |
| No browser was involved | Every figure is a file on disk weighed by a script. Nothing here says what a browser prioritised, what it fetched first, what it fetched at all, or how long any of it took. SM-1 measures Suite Directory interactive, which is a browser measurement this file does not make and does not replace | **Decision.** Story 2-2 scope |
| The `/` figure is the document, not the session | 625,823 is what `/` references at first paint. It excludes `gem-fallback.png`, which only a visitor without WebGL fetches, and every route chunk a client-side navigation would pull afterwards | **Decision** |
| Nothing gates on the figures | `.github/workflows/ci.yml` gained no job. Two things here are pinned by `ops/__tests__/asset-budget.test.ts` and cannot drift silently, the three contract-face figures and the fingerprint table, and everything else in this file goes stale invisibly until someone re-runs the tool. Story 2-34 is the gate story | **Decision.** Story 2-2 boundary |

## What this closes

**`EXPERIENCE.md` open item O-2, "Narrative bundle and asset weight are unmeasured", is closed on
2026-08-29** by this file, in the way Story 1-2 closed AD-17a in `ops/monitoring.md`: the planning
artifact is not edited, and the `ops/` record is where the measurement lives. The narrative bundle is
418,757 gzipped bytes, the narrative assets are 2,970,194 bytes on disk, and both carry their method
above.

`EXPERIENCE.md:946-947` still reads "Unmeasured" and `:961-964` still calls the weight open, and
correcting that wording is a planning-artifact edit this story is not permitted to make. It is
Pending Operator action 1.

## Pending Operator actions

This file hands the Operator work Story 2-2 could not do inside its boundaries. Tracked here rather
than left in prose, in the shape `ops/font-contract.md` and `ops/rendered-output-harness.md` use.

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Replace the stale wording in `EXPERIENCE.md:946-947` and `:961-964` with a pointer to this file** | Operator | `:946-947` still reads "Unmeasured" for both lines. `:961-964` still says the weight is "Open, and worth measuring before Epic 2" and that the estimate is "inference from published sizes, not a measurement of your build". All four statements are now false, and a reader who reaches `EXPERIENCE.md` first will re-open a closed question | _not done_ |
| 2 | **Decide what to do about the two preloads at `app/layout.tsx:40-53`** | Operator | `MonumentExtended-Bold` is reached by no rule, and both preloads point at `/fonts/` while the faces load from `/_next/static/media/`, so 31,239 gzipped bytes are fetched at high priority and at least 19,936 of them are used by nothing. Changing `app/layout.tsx` is outside Story 2-2's boundaries | _not done_ |
| 3 | **Decide the disposition of the four orphaned assets and two orphaned components** | Operator | 1,215,179 bytes under `public/assets/home/` and two `.tsx` files are reachable from nothing. Deleting a published asset is a reversibility question, not a cleanup | _not done_ |
| 4 | **Re-run `node ops/asset-budget.mjs` when Story 2-20 retires the legacy faces, and add a row** | Operator | 962,952 bytes on disk, 692,644 gzipped across nine unreached families and three formats each, are the largest single thing this reading found that a named story already plans to remove. The figure after it lands is what tells whether it worked | _not done_ |
| 5 | **Re-run it again once the non-3D front door lands (Story 2-13)** | Operator | The 140 KB budget is 102.8 percent breached today, and 245,605 of the 283,945 is JavaScript on a route with no 3D on it. Whether that story moves the number is the question this record exists to make answerable | _not done_ |
| 6 | **Rule on whether `EXPERIENCE.md` Rule 1 is repaired or retired** | Operator | § What this reads against the budget's own rules shows it does not hold. Either the narrative is genuinely deferred, which is a change to three components and `app/providers.tsx`, or the rule is rewritten to describe what the Hub does. Both are decisions this story may not take | _not done_ |

**Maintaining this file.** When an action is performed, replace its `_not done_` cell with the ISO
8601 UTC completion date and leave the row in place. When a figure is re-measured, add the new row
with its own date, its own `BUILD_ID` and its method, and keep the old one, so a later reader can see
whether a number moved or was simply re-stated. Deletion is not used here.
