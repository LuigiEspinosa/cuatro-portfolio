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
no job, and Story 2-34 is where a gate belongs. **Amended 2026-09-23**: Story 2-34's gate is the FR-17 literal gate,
which reads stylesheets and gates no figure in this file; nothing gates the budget, and no story's
criteria ask for it.

**KB is 1000 bytes throughout**, and gzip is level 9, both matching `ops/font-contract.md:136` and
`packages/fonts/subset.py`, so a figure here and a figure there mean the same thing.

## What in this file is measured, and what is written

Some of this file is printed by a tool and some of it is written by hand, and telling them apart is
the difference between a figure a reader can re-derive and one they have to take on trust. So:

**Three builds, and every verbatim block belongs to exactly one of them.** Story 2-2 measured build
`uXKXS8QHdHPNgUPIdvcnq` on 2026-08-29. Story 2-12 re-ran the tool against build
`rxNy6yw47ecyqZzmT1Jzp` on 2026-09-07 after moving the homepage's narrative behind one dynamic
boundary, and re-measured the sections that moved. Story 2-16 re-ran it against build
`Tg4Y3fYLyWXDQsTh2jZrv` on 2026-09-10 after turning `/cv` from a redirect into a page, and
re-measured § Every route and the findings list, which are the two blocks a new route moves. Nothing
is deleted, per § Maintaining this file, so the column below says which build each block is verbatim
from. A block marked with an older date and no newer counterpart was not re-measured and may have
moved: `node ops/asset-budget.mjs` against a current build is the only thing that answers that.

| Section | Where it comes from |
|---|---|
| § The build this reading was taken from, its first table | **Verbatim**, `node ops/asset-budget.mjs`. **2026-08-29** |
| § The build this reading was taken from, its second table | **Verbatim**. **2026-09-07** |
| § The build this reading was taken from, its third table | **Verbatim**. **2026-09-10** |
| § The narrative bundle, its 2026-09-07 table | **Verbatim**. **2026-09-07**, not re-measured on 2026-09-10 |
| § The narrative bundle, its 2026-08-29 table | **Verbatim**. **2026-08-29**, superseded and kept |
| § The narrative assets, its table and the orphan paragraph | **Verbatim**. **2026-08-29**, not re-measured |
| § The non-3D path, both readings and every table under them | **Verbatim**. **2026-08-29**, with dated 2026-09-07 and 2026-09-10 amendments beside them |
| § Every route, its 2026-08-29 table | **Verbatim**. **2026-08-29**, superseded and kept |
| § Every route, its 2026-09-07 table | **Verbatim**. **2026-09-07**, superseded and kept |
| § Every route, its 2026-09-10 table | **Verbatim**. **2026-09-10** |
| § The faces the built CSS declares, its table and its resolution list | **Verbatim**. **2026-08-29**, and unchanged on 2026-09-07 |
| § Method, including the fingerprint proof table | **Verbatim**. **2026-08-29** |
| § Findings, all three dated lists | **Verbatim**, each from its own run |
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

**The second build, taken during Story 2-12.** Every section marked 2026-09-07 in § What in this
file is measured was read from this one.

| Property | Value | Nature |
|---|---|---|
| `.next/BUILD_ID` | `rxNy6yw47ecyqZzmT1Jzp` | **Observed** |
| Build written | 2026-09-07T15:44:01Z | **Observed**, mtime of `.next/BUILD_ID` |
| Commit | `c887cb034ad7dc92a09d166cbeb4cf72afbbe412` | **Observed**, `git rev-parse HEAD` |
| Measured inputs dirty | none | **Observed**, `git status --porcelain -- app components contracts packages public next.config.js package.json` |
| Prerendered documents | 8 | **Observed** |
| Chunks written | 21 `.js`, 11 `.css` | **Observed** |
| Bytes in `.next/static/chunks` | 2,054,063 on disk, 625,713 gzipped | **Observed** |

**The third build, taken during Story 2-16.** § Every route's 2026-09-10 reading was read from this
one, and nothing else in this file was re-taken on it.

| Property | Value | Nature |
|---|---|---|
| `.next/BUILD_ID` | `Tg4Y3fYLyWXDQsTh2jZrv` | **Observed** |
| Build written | 2026-09-11T06:05:07Z | **Observed**, mtime of `.next/BUILD_ID` |
| Commit | `e61b7e66f6d66b78c2de61d16df226786f235968` | **Observed**, `git rev-parse HEAD` |
| Measured inputs dirty | none | **Observed**, `git status --porcelain -- app components contracts packages public next.config.js package.json` |
| Prerendered documents | 6 | **Observed** |
| Chunks written | 21 `.js`, 13 `.css` | **Observed** |
| Bytes in `.next/static/chunks` | 2,043,272 on disk, 623,127 gzipped | **Observed** |

**The build timestamp is UTC and this file's dates are not, exactly as for the first build above.**
06:05 UTC on 2026-09-11 is the evening of 2026-09-10 on the authoring host, which is the date every
2026-09-10 heading and finding in this file carries. One is the tool's reading of the build and the
other is this record's authoring date; they are a few hours apart rather than a day.

**This block was re-taken once, and the first reading is not kept.** Story 2-16's review moved four
things that reach the wire, a `download` attribute among them, so an earlier reading of the same
story at commit `09e07f02` described a tree that never landed. § Maintaining this file keeps a
reading that a **later** story superseded; a reading of an intermediate tree inside one story is
noise, and the figures below are the ones this story ships. The two differed by 17 document bytes on
`/cv` and by nothing on any other route.

**Six prerendered documents where the two builds above have eight, and two separate things moved.**
Story 2-14 redirected `/projects` and deleted the page, which is one. The other is `/`: it is
`ƒ (Dynamic)` in this build's route list and writes no prerendered HTML, so the tool, which reads
`.next/server/app/*.html`, no longer sees it. `app/page.tsx` has read the `Save-Data` request header
since Story 2-13 and both readings above still carried a `/` row, so what changed is the build
rather than the route. **This is not Story 2-16's** and is not investigated here; that story added a
document rather than removing one, and `/cv` appears in the reading below. The consequence for this
record is that `/` has no row in the 2026-09-10 table and the 2026-09-07 one is where its figures
still live.

## The narrative bundle

`EXPERIENCE.md:946` estimates Three.js, R3F, drei, postprocessing, GSAP, ScrollTrigger and lenis at
300 to 450 KB gzipped, from published library sizes, and says "Measure before trusting". This is the
measurement.

Every chunk in the build a narrative fingerprint hits. The whole chunk is attributed to the
libraries found in it, which overstates wherever a chunk mixes narrative and shell code. That is a
stated limit with a direction, and the direction is the safe one.

**Two readings, and both are kept.** The first was taken during Story 2-2 on 2026-08-29 and is the
one every other figure in this file belongs to. The second was taken during Story 2-12 on
2026-09-07, after that story put the homepage's narrative behind one dynamic boundary, and it is the
current state of the build. Neither replaces the other in place, per § Maintaining this file: a
reader needs to see whether a number moved or was only re-stated, and the two tables side by side
are what makes the answer legible. Every other section of this file is still the 2026-08-29 reading,
and § The build this reading was taken from names that build rather than this one.

### The 2026-09-07 reading, after Story 2-12

Taken from `.next/BUILD_ID` `rxNy6yw47ecyqZzmT1Jzp`, written 2026-09-07T15:44:01Z at commit
`c887cb034ad7dc92a09d166cbeb4cf72afbbe412`, with no measured input dirty. The table is **verbatim**,
`node ops/asset-budget.mjs`; this provenance sentence is editorial.

| Chunk | Bytes on disk | Bytes gzipped | Libraries | On which routes | Nature |
|---|---|---|---|---|---|
| `0g0oqlx4fsym~.js` | 870,402 | 228,423 | three, @react-three/fiber | `/projects`, `/work` | **Observed** |
| `10mmj2_fz7c58.js` | 252,994 | 105,886 | @react-three/postprocessing, postprocessing | none: loaded on demand | **Observed** |
| `08pj4xkz~kajd.js` | 70,032 | 26,971 | gsap | `/`, `/_not-found`, `/celeste`, `/cv`, `/projects`, `/recommendation`, `/work` | **Observed** |
| `0r_9pnds9g3a0.js` | 43,379 | 17,542 | gsap/ScrollTrigger | `/`, `/_not-found`, `/celeste`, `/cv`, `/projects`, `/recommendation`, `/work` | **Observed** |
| `0nwet2hiefxan.js` | 38,538 | 12,069 | lenis | `/`, `/_not-found`, `/celeste`, `/cv`, `/projects`, `/recommendation`, `/work` | **Observed** |
| `0ivkpuv~kqs-g.js` | 28,258 | 9,518 | three-stdlib | `/work` | **Observed** |
| `0smmibz.77jp0.js` | 21,694 | 6,947 | three-stdlib | `/projects` | **Observed** |
| `0qod5vojegloo.js` | 24,566 | 6,464 | three, @react-three/drei | none: loaded on demand | **Observed** |
| `0n9mb1l0dkz1g.js` | 24,526 | 6,459 | three, @react-three/drei | none: loaded on demand | **Observed** |
| `1201sbn6l0o8c.js` | 15,078 | 6,162 | gsap/SplitText | `/` | **Observed** |
| **Total, every narrative chunk in the build** | **1,389,467** | **426,441** |  |  | **Observed** |
| Of that, on the heaviest 3D route `/work` |  | 294,523 |  |  | **Derived** |
| Of that, referenced by no document and loaded on demand |  | 118,809 |  |  | **Derived** |
| Estimate this replaces |  | 300,000 to 450,000 |  |  | **Decision**. `EXPERIENCE.md:946` |
| Against the estimate |  | inside the range, 23,559 below the top |  |  | **Derived** |

**What is deferred now: 118,809 gzipped bytes, 27.9 percent of the narrative, against 6,459 and 1.5
percent on 2026-08-29.** **Derived.** Three chunks are referenced by no prerendered document:
`10mmj2_fz7c58.js` (`@react-three/postprocessing` and `postprocessing`, 105,886), and the two drei
and `three` barrels at 6,464 and 6,459. The homepage requests all of them after hydration, which
`tests/e2e/narrative.pw.ts` observes directly.

**What is still not deferred: 307,632 gzipped bytes, in two unequal parts.** **Derived**, from the
table above. **244,888 of it is `/work` and `/projects`**: `0g0oqlx4fsym~.js`, the 228,423-byte
`three` and `@react-three/fiber` chunk, on both of those documents at first paint, plus the two
`three-stdlib` chunks at 9,518 and 6,947. **The remaining 62,744 is on routes that have no 3D on
them**: `gsap`, `gsap/ScrollTrigger` and `lenis` at 56,582 across all seven prerendered documents,
and `gsap/SplitText` at 6,162 on `/` alone. The two parts have different owners and different fixes,
which is why they are separated here rather than attributed to the 3D routes together.

**Story 2-12 did not touch either part and did not intend to.** The `/work` and `/projects`
boundaries, `TorusCanvas.tsx:8` and `TorusKnotCanvas.tsx:8`, carry exactly the fault
`GemComponent.tsx:5-6` carried, described under the 2026-08-29 reading below; the three
every-route libraries are `app/providers.tsx:4-6`. Read the flip in the § Every route column as a
homepage result and nothing wider: `/` reads **no** for WebGL and `/work` and `/projects` still read
**yes**.

**`/` is a non-3D route as of this reading.** **Observed 2026-09-07.** Its document references no
chunk carrying a WebGL fingerprint, which `tests/e2e/narrative.pw.ts` asserts by fetching every
script the document names and scanning each, and which the same test shows discriminating: run
against a build with the static import restored, it finds `three`, `@react-three/fiber`,
`@react-three/postprocessing` and `postprocessing` in the eager entry. The route's wire total is
295,154 gzipped against 625,823 on 2026-08-29, but **the two are not a clean before and after**: the
2026-08-29 build predates Stories 2-9 and 2-11, and `/`'s own document grew from 14,774 to 32,531
bytes over that span as the premise block and the Suite Directory landed on it. The WebGL column is
the comparison this story is entitled to make; the byte delta spans four stories.

**`gsap` and `lenis` are unchanged, and still the wider defect.** **Observed 2026-09-07.**
`app/providers.tsx:4-6` still imports all three at module scope and the root layout still renders
`Providers`, so 56,582 gzipped bytes of narrative library are on every route including `/celeste` and
the 404. Story 2-12's boundaries named them and left them: they are on every route rather than in
the homepage's narrative bundle, so moving them is a different change with a different blast radius.

**What would be traded, and is not being traded here.** **Decision.** If the narrative had exceeded
450 KB, `EXPERIENCE.md:963` names `@react-three/postprocessing` as the first thing to examine. It
did not, so nothing is traded. For whoever revisits this: `@react-three/postprocessing` and
`postprocessing` are now a chunk of their own at 105,886 gzipped bytes, fetched by `/` after
hydration rather than before first paint, and dropping it would cost the `EffectComposer` and
`Bloom` pass at `GemNarrative.tsx:36-38`, which is the glow the gem reads as. Neither Story 2-2 nor
Story 2-12 makes that call.

### The 2026-08-29 reading, superseded and kept

Taken during Story 2-2 from `.next/BUILD_ID` `uXKXS8QHdHPNgUPIdvcnq` at commit `9662d03`, which is
the build § The build this reading was taken from describes and the one every other section here
still belongs to.

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
**Story 2-12 closed the `GemComponent` third of this on 2026-09-07 and left the other two standing.**

**`gsap` and `lenis` are worse.** **Observed 2026-08-29.** `app/providers.tsx:4-6` imports `lenis`,
`gsap` and `ScrollTrigger` at module scope, and the root layout renders `Providers`, so all three are
on every route including the ones with no 3D at all. 56,582 gzipped bytes of narrative library are on
`/celeste` and on the 404. Still true on 2026-09-07.

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
| `environment_D.hdr` | _deleted 2026-09-24_ (was 14,377) | _deleted 2026-09-24_ (was 9,996) | **nothing**, the file is gone (was `components/atoms/Gem/Gem.tsx:16`, imported by nothing) | **no** | **Observed** |
| `gem-fallback.png` | _deleted 2026-09-07_ (was 1,755,015) | _deleted 2026-09-07_ (was 1,752,140) | **nothing**, the file is gone | **no** | **Observed** |
| `gem.glb` | _deleted 2026-09-24_ (was 600,008) | _deleted 2026-09-24_ (was 189,403) | **nothing**, the file is gone (was `components/atoms/Gem/Gem.tsx:19`, imported by nothing) | **no** | **Observed** |
| `gem.gltf` | _deleted 2026-09-24_ (was 1,826) | _deleted 2026-09-24_ (was 542) | **nothing**, the file is gone | **no** | **Observed** |
| `gem_data.bin` | _deleted 2026-09-24_ (was 598,968) | _deleted 2026-09-24_ (was 188,827) | **nothing**, the file is gone (was `public/assets/home/gem.gltf:91`) | **no** | **Observed** |
| **Total** | **0** (was 1,215,179, and 2,970,194 before that) | **0** (was 388,768, and 2,140,908 before that) |  |  | **Observed** |
| Reachable from a module something imports | 0 (was 1,755,015) |  |  |  | **Derived** |
| Reachable from nothing | 0 (was 1,215,179) |  |  |  | **Derived** |
| Estimate this replaces | not inspected | not inspected |  |  | **Decision**. `EXPERIENCE.md:947` |

**Amended 2026-09-07 by Story 2-13.** The `gem-fallback.png` row and the three figures under it
moved because the file was deleted, not because it was re-weighed: it was the only asset here that
anything imported, so the "reachable from a module something imports" figure is now zero and the
total is exactly the orphan figure that was already carried below it. The four remaining assets are
unchanged and still reachable from nothing. Nothing else in this section was re-measured on that
date.

**Amended 2026-09-24 by DW-36's package, on the Operator ruling of that day (Pending Operator action
3).** The four remaining assets are deleted, and so are `Gem.tsx` and `VenomSculpture.tsx`, the two
components the paragraph below names, in commit `d91a34f`, after `git grep` and graphify found
nothing that imports the components or names the files outside `Gem.tsx` itself and `gem.gltf`'s own
reference to `gem_data.bin`, and no config, Dockerfile line or Caddyfile route that names them. The
2026-09-24 reading under § Every route prints a total of 0 for this directory, which is now empty
and so absent from a fresh checkout, and names no orphaned component. `tests/e2e/narrative.pw.ts`
asks the server for all four and reads 404, against a file under `public/assets/og/` that answers
200. Git history keeps the six files if a gem scene ever wants them back.

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
which is how an orphan survives a green suite. **Superseded 2026-09-24**: the Operator ruled the
deletion and it is done, as the amendment above records; no suite mocked either component by then.

**`gem-fallback.png` was the largest file under `public/`**, at 1,755,015 bytes, gzipping to
1,752,140, which is what a PNG does. It was live: `GemComponent.tsx:24-31` rendered it when the WebGL
probe failed. **Observed 2026-08-29**, and the string `gem-fallback` appeared in none of the eight
prerendered documents, because the probe started at `null` and the server rendered the Scene branch.
So it was in no route total below, and for a visitor without WebGL it was a 1.75 MB image fetched
after hydration on a path the budget never modelled.

**Deleted 2026-09-07 by Story 2-13, and nothing replaced it.** **Observed.** The non-3D front door
now renders no image at all: `EXPERIENCE.md:172-178` closes Q7 with one artefact rather than two, and
`:173-176` refuses a still of the 3D scene by name, because a still of a 3D scene reads as a broken
one. What that visitor gets instead is the typographic hero the same diagram draws, built out of the
premise block and the framework band that were already on the page. So the worst case this record
described, 1.75 MB fetched after hydration by exactly the visitor least able to afford it, is now
zero bytes of image on that path, and `/`'s document total below is unchanged, the file never having
been in it. `tests/e2e/front-door.pw.ts` asserts the absence on all four triggers of that path.

## The non-3D path

`EXPERIENCE.md:945` fixes the number that binds: **140 KB gzipped**, "what Daniela gets on a slow
connection".

A route is non-3D here when no chunk it references carries the WebGL stack. 4 of the 5 prerendered
documents qualify, and 2 of those can actually be loaded: 0 are answered by a redirect and 2 are
Next's own document (`/_global-error`, `/_not-found`), all read from `.next/routes-manifest.json`
rather than asserted here. The § Every route table below carries the same column for every route.
The heaviest route a visitor can load is `/cv`, and a ceiling has to hold for the worst case rather
than the average, so that is the one measured.

**This lede is the 2026-09-11 reading, corrected in passing by Story 2-17.** It read "5 of the 8
prerendered documents qualify, and 1 of those can actually be loaded: 2 are answered by a redirect
(`/cv`, `/recommendation`)" from 2026-08-29, and it was wrong about `/cv` from 2026-09-10, when
Story 2-16 built that page, and wrong about `/recommendation` from 2026-09-11, when Story 2-17
retired it. The tables under this heading are still the readings their own dates name; only the
lede moved, because a lede that contradicts the table beneath it is not a historical reading, it is
an error.

**Amended 2026-09-07 by Story 2-12: the route this section measures has changed, and the figures
below have not been re-taken on it.** **Observed**, `node ops/asset-budget.mjs` against build
`rxNy6yw47ecyqZzmT1Jzp`. With the homepage's narrative deferred, 6 of the 8 prerendered documents
are non-3D and 2 of those can be loaded, so the tool now measures `/` rather than `/celeste` as the
heaviest loadable non-3D route. On that route reading one totals **295,154** gzipped against the
140,000 budget, **155,154 over, 110.8 percent**, and reading two totals **105,583**, inside by
34,417. `/celeste` itself is essentially unmoved at 283,968. **Every table under this heading is
still the 2026-08-29 reading of `/celeste`** and is kept as such: re-taking it on a different route
would silently change the subject of the section rather than update it. The two decompositions and
the gap between them, which is what this section exists to explain, hold in the same shape on either
route.

**Amended 2026-09-10 by Story 2-16: the route this section measures has changed again, and the
figures below have still not been re-taken.** **Observed**, `node ops/asset-budget.mjs` against
build `Tg4Y3fYLyWXDQsTh2jZrv`. That story removed the `/cv` redirect and built the page, so the
count in the paragraph above reads differently in both halves: **5 of the 6** prerendered documents
are non-3D and **2** of those can be loaded, `/cv` and `/celeste`, with one redirect left rather
than two. The tool now measures `/cv` as the heaviest loadable non-3D route, at **290,555** gzipped
against the 140,000 budget, **150,555 over, 107.5 percent**. That is the third different route this
section has been pointed at and it is over by roughly the margin the other two were, which is the
finding rather than a coincidence: the ceiling is missed by the narrative bundle every route
carries, not by anything on the page. `/` left the prerendered set entirely in this build, for the
reason § The build this reading was taken from gives. **Every table under this heading is still the
2026-08-29 reading of `/celeste`** and is kept as such, for the reason the paragraph above gives.

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

### The 2026-09-24 reading, after the DW-113 home-surface package

**Verbatim**, `node ops/asset-budget.mjs` against build `RT9WREDML0Cp4cctih6td`, written
2026-09-24T08:07:49Z at `1a5ada5` with no measured input dirty. It is one reading after the
package's four Operator rulings of 2026-09-24: `04b3f4a` removed the home readout panel (DW-110),
`f97267b` moved the muted-accent ornaments into CSS generated content (DW-113), `123b723` gave the
five hero links a keyframe that hides them until their turn (DW-106), and `9e49b88` moved the
`suite-reach` component into `HomeLayout` so it carries the front door (DW-88). The before is the
DW-36 package's reading below: its build was taken at `d91a34f`, and no measured input changed
between that commit and `d911028`, where this package started.

| Route | Document bytes | Gzipped on the wire | Carries WebGL | Served | Nature |
|---|---|---|---|---|---|
| `/work` | 20,614 | 231,168 | no | yes | **Observed** |
| `/cv` | 21,937 | 229,788 | no | yes | **Observed** |
| `/_not-found` | 17,292 | 196,566 | no | **no**: Next's own document | **Observed** |
| `/celeste` | 13,918 | 196,558 | no | yes | **Observed** |
| `/_global-error` | 9,578 | 188,758 | no | **no**: Next's own document | **Observed** |

**Every route before and after, on the wire.** **Observed** on both sides, **Derived** delta. The five
prerendered documents are the tool's own tables against the DW-36 reading's. `/` is weighed the way
that reading weighed it, the document fetched from `next start` in the pinned image and weighed with
the tool's own `parseDocumentReferences` and `gzipBytes`, on build `bmBRmKwdT9BiS8QM-RfyU` at
`d911028` and `WQ5nO0gJ8OYY3W0IYbvh5` at `1a5ada5`. The before build reproduces the DW-36
reading's `/` exactly, 205,234, and in that image every prerendered route moves within 3 bytes of
the host's delta below.

| Route | Before | After, `1a5ada5` | Delta | Nature |
|---|---|---|---|---|
| `/`, fetched | 205,234 | 205,298 | 64 heavier | **Observed**, pinned image |
| `/work` | 231,167 | 231,168 | 1 heavier | **Observed**, the tool |
| `/cv` | 229,769 | 229,788 | 19 heavier | **Observed**, the tool |
| `/_not-found` | 196,545 | 196,566 | 21 heavier | **Observed**, the tool |
| `/celeste` | 196,539 | 196,558 | 19 heavier | **Observed**, the tool |
| `/_global-error` | 188,760 | 188,758 | 2 lighter | **Observed**, the tool |

**What moved.** **Observed** chunk by chunk on both image builds. On `/` the home route's client
chunk fell from 3,391 to 3,114 gzipped, the Plate mark's code leaving it with the readout panel
(`suite-reach`, already in it as the Directory's client reference, is now `HomeLayout`'s import
in the same chunk). The home stylesheet, which carried `HomeLayout`, `SkipControl`, `Premise` and
`SuiteDirectory` in one file at 2,299, is written as two since the Plate mark left the hero's
import graph, `HomeLayout` with `SkipControl` at 1,355 and `Premise` with `SuiteDirectory` at
1,297: the new keyframe and the two `::before` rules are in them, and so is the cost of one
compression stream split into two. The document is 137 bytes longer on disk, the `data-ornament`
attributes and one more stylesheet link against the readout's markup, and 32 bytes shorter gzipped.
Every prerendered route links the Plate mark's stylesheet, which took the subordinate line's
`::before` rule, 418 to 438 gzipped; `/work`'s copy of the component's code is 26 lighter, its
subordinate line an attribute rather than a child, and its document 10 heavier for the attribute.

**The whole build, before and after.** **Observed**, the tool's tables on each side.

| Figure | Before, DW-36's build | After, `1a5ada5` | Delta | Nature |
|---|---|---|---|---|
| Chunks written | 18 `.js`, 12 `.css` | 18 `.js`, 13 `.css` | one `.css` more, the split home stylesheet | **Observed** |
| Bytes in `.next/static/chunks` | 2,852,353 on disk, 829,907 gzipped | 2,851,114 on disk, 829,976 gzipped | **1,239 lighter on disk, 69 heavier gzipped** | **Observed**; **Derived** delta |
| The narrative total | 619,351 across 5 chunks | the same 619,351 across 5 chunks | 0 | **Observed** |
| The non-3D line | `/work`, 231,167, 91,167 over, 65.1 percent | `/work`, 231,168, 91,168 over, 65.1 percent | 1 heavier | **Observed**; **Derived** delta |

**Against the budget.** **Derived.** Noise: the package moves no narrative byte and no route by more
than 64 gzipped, against Story 2-2's 140,000. What it bought on the wire is on the audit, not the
budget: `/` and `/work` read 1.00 on Lighthouse's accessibility audit where they read 0.96
(`ops/hub-accessibility-pass.md` § Lighthouse readings).

### The 2026-09-24 reading, after DW-36's package

**Verbatim**, `node ops/asset-budget.mjs` against build `ysPv_iPVOqc9Sc90vXp_1`, written
2026-09-24T05:29:00Z at `d91a34f` with no measured input dirty. It is one reading after all three of
the package's rulings, as the Operator ruling of 2026-09-24 asks: `237772c` removed Lenis and
`app/providers.tsx` and moved `ScrollTrigger` behind the torus's boundary (DW-36, Pending action 6),
`16412d1` removed drag-to-rotate from both canvases (DW-119), and `d91a34f` deleted the four orphaned
assets and two orphaned components (Pending action 3). The before reading is the same command
against build `h9ihC9KUuEQ39XtLfRn2X` (written 2026-09-24T04:43:39Z at `9bf4f20` on `dev`, no
measured input dirty). That build is `dev` as the package found it: after the Story 2-22 fix round's
reading came DW-115's fix to two stylesheets (`796f0b1`) and comment corrections in `9bf4f20`, which
is why its `/cv` reads 252,185 against the fix round's 252,173.

| Route | Document bytes | Gzipped on the wire | Carries WebGL | Served | Nature |
|---|---|---|---|---|---|
| `/work` | 20,597 | 231,167 | no | yes | **Observed** |
| `/cv` | 21,937 | 229,769 | no | yes | **Observed** |
| `/_not-found` | 17,292 | 196,545 | no | **no**: Next's own document | **Observed** |
| `/celeste` | 13,918 | 196,539 | no | yes | **Observed** |
| `/_global-error` | 9,578 | 188,760 | no | **no**: Next's own document | **Observed** |

**Every route before and after, on the wire.** **Observed** on both sides, **Derived** delta. The five
prerendered documents are the tool's own tables. `/` renders on demand and the tool cannot weigh it
(DW-50, accepted), so its row is taken the other way: the document fetched from `next start` on a
build of each commit in the pinned image, and weighed with the tool's own `parseDocumentReferences`
and `gzipBytes`. Run on the tool's own build, `ysPv_iPVOqc9Sc90vXp_1`, that read reproduces the
tool's figure for every prerendered route exactly, and each image build reads within 20 bytes of the
host build of the same commit on every one of them. Its builds are `jez20byImNqM2-jDcwVHK` at
`9bf4f20` and `qbWqVpxbHS4T5sesN9ls8` at `d91a34f`.

| Route | Before, `9bf4f20` | After, `d91a34f` | Delta | Nature |
|---|---|---|---|---|
| `/`, fetched | 254,754 | 205,234 | **49,520 lighter** | **Observed**, pinned image |
| `/work` | 253,764 | 231,167 | **22,597 lighter** | **Observed**, the tool |
| `/cv` | 252,185 | 229,769 | **22,416 lighter** | **Observed**, the tool |
| `/_not-found` | 246,125 | 196,545 | **49,580 lighter** | **Observed**, the tool |
| `/celeste` | 246,100 | 196,539 | **49,561 lighter** | **Observed**, the tool |
| `/_global-error` | 188,762 | 188,760 | 2 lighter | **Observed**, the tool |

**What left each document.** **Observed** on `/` chunk by chunk, both builds read in the pinned image.
`gsap` (27,145) and `ScrollTrigger` (17,373) are gone from its document. The root layout's chunk, the
one the tool attributed to Lenis, fell from 10,196 to 5,246 and still carries the header: Lenis and
`lagSmoothing` left with `app/providers.tsx`, and the motion hook's `matchMedia` moved out with it.
The home route's own chunk grew from 3,263 to 3,391 by taking that hook, which `HomeLayout` still
reads. The chunks come to 49,340 lighter and the document itself to 180, which is the 49,520.
`/celeste` and the 404 changed the same way, 49,561 and 49,580 lighter; `/work` and `/cv` kept `gsap`
for the Work item's disclosure, which is why they fell by less than half as much.

**The whole build, before and after.** **Observed**, the tool's tables on each side.

| Figure | Before, `9bf4f20` | After, `d91a34f` | Delta | Nature |
|---|---|---|---|---|
| Chunks written | 19 `.js`, 12 `.css` | 18 `.js`, 12 `.css` | one `.js` fewer | **Observed** |
| Bytes in `.next/static/chunks` | 2,886,921 on disk, 839,882 gzipped | 2,852,353 on disk, 829,907 gzipped | **34,568 lighter on disk, 9,975 gzipped lighter** | **Observed**; **Derived** delta |
| Narrative chunks the fingerprints hit | 7, 2,205,918 on disk, 634,829 gzipped, 54,721 of it on every route's document | 5, 2,155,781 on disk, 619,351 gzipped, 26,971 of it on `/cv` and `/work` alone | 15,478 gzipped lighter; 592,380 on demand where it was 580,108 | **Observed**, the narrative table; **Derived** delta |
| The narrative table, after | | `0x9hgoafoipaz.js` and `0-742gw60ue7o.js`, 894,996 on disk each, 234,536 and 234,535 gzipped, three and R3F and drei, on demand; `031y-gd1885yp.js`, 251,816 and 105,544, the post-processing pair and the wave, on demand; `08pj4xkz~kajd.js`, 70,032 and 26,971, `gsap`, on `/cv` and `/work`; `0te7gr59z3e7w.js`, 43,941 and 17,765, `gsap/ScrollTrigger` with the torus and its binding, on demand | | **Observed**, verbatim rows |
| Narrative assets under `public/assets/home/` | 1,215,179 on disk, 388,768 gzipped, reached by nothing | 0 | the directory is empty | **Observed** |
| The non-3D line | `/work`, 253,764, 113,764 over, 81.3 percent | `/work`, 231,167, 91,167 over, 65.1 percent | 22,597 closer | **Observed**; **Derived** delta |

**Against the estimate.** **Derived.** The narrative total, 619,351, is still over the top of
`EXPERIENCE.md:946`'s range, by 169,351, and the whole of the overage is the three and R3F library
written twice, once per scene's boundary (DW-120, re-read on 2026-09-24: the two copies now hold the
same modules in a different order, so removing the orbit controls did not merge them). The rest of
the narrative is where Rule 1 wants it: § What this reads against the budget's own rules says why the
26,971 of GSAP's core on `/cv` and `/work` is the Work item's and not the narrative's.

### The 2026-09-23 reading, after Story 2-22

**Verbatim**, `node ops/asset-budget.mjs` against build `37FF9P8STslG2tLdxZeOq`, written
2026-09-23T19:06:03Z, taken on the story's working tree at `809bef7` plus its own files, before the
commit that carries them: the tool's dirty-inputs row named seven paths (`app/app.scss`,
`app/scss/_index.scss`, `components/organisms/SuiteDirectory/SuiteDirectory.scss` and four suites the
build does not read) and every one of them is this story's. The before reading is the same command
against build `vgd007GkAU7Lyi6-3J296` (written 2026-09-23T18:38:24Z at `809bef7` on `dev`, no measured
input dirty).

**The before build reproduces the Story 2-34 after figures exactly** in both kinds of chunk: 19 `.js`
at 2,858,402 on disk and 831,372 gzipped, and 12 `.css` at 28,873 on disk and 8,602 gzipped. The
routes read 2 to 4 bytes below that reading on the wire (`/work` 253,877 against 253,879), the rebuild
variance of hashed file names inside each document.

| Route | Document bytes | Gzipped on the wire | Carries WebGL | Served | Nature |
|---|---|---|---|---|---|
| `/work` | 21,962 | 253,763 | no | yes | **Observed** |
| `/cv` | 23,218 | 252,173 | no | yes | **Observed** |
| `/_not-found` | 18,793 | 246,124 | no | **no**: Next's own document | **Observed** |
| `/celeste` | 15,380 | 246,099 | no | yes | **Observed** |
| `/_global-error` | 9,578 | 188,761 | no | **no**: Next's own document | **Observed** |

**Every route moved by the global stylesheet and nothing else.** Against the before build, on the
wire: `/work` and `/_not-found` 114 lighter, `/cv` and `/celeste` 113 lighter, `/_global-error` 2
heavier. **Observed 2026-09-23**, every `.next/static/chunks/*.css` and `*.js` weighed with
`zlib.gzipSync` at level 9 (the tool's method) on both builds, the eleven other stylesheets compared
byte for byte:

| Figure | Before, `dev` at `809bef7` | After, this story | Delta | Nature |
|---|---|---|---|---|
| Bytes in `.next/static/chunks` | 2,887,275 on disk, 839,974 gzipped | 2,886,855 on disk, 839,862 gzipped | **420 lighter on disk, 112 gzipped lighter** | **Observed**, tool's build table; **Derived** delta |
| Every `.js` chunk together | 19, 2,858,402 on disk, 831,372 gzipped | the same 19, 2,858,402 and 831,372 | 0 | **Observed**, tool's totals less the `.css` row |
| Every `.css` chunk together | 12, 28,873 on disk, 8,602 gzipped | 12, 28,453 on disk, 8,490 gzipped | 420 lighter on disk, 112 gzipped lighter | **Observed** per chunk; **Derived** total |
| The global stylesheet | `0.sgj2-qlca8y.css`, 6,020 on disk, 2,310 gzipped | `15iatak4a_jum.css`, 5,600 on disk, 2,198 gzipped | 420 lighter on disk, 112 gzipped lighter: the thirteen aliases off `:root`, and the base rule naming four roles where it read three aliases | **Observed** |

**Against the Story 2-34 reading.** **Derived.** The chunks reproduce it, so the whole of the movement
is this story's: the non-3D line still names `/work`, 113,763 over, 81.3 percent, where Story 2-34's
read 113,879 over; the 116 bytes between them are this story's 114 lighter and 2 of rebuild variance.
Measured against Story 2-2's 140,000 each time. The narrative total, 634,829, did not move. § The faces
the built CSS declares lost one value line in this run's output, `font-family: var(--font-regular)`,
which was the base rule's; the rule names `var(--f-body)`, already listed, and every family the built
CSS declares is still reached.

**Fix round 1, re-read the same day.** **Observed 2026-09-23**, `node ops/asset-budget.mjs` against
build `3ILavmsOL7v4MHooMZ6MG`, written 2026-09-23T19:48:57Z at `5810b4a` plus the round's two dirty
inputs, `SuiteDirectory.scss` and its suite, the second a file the build does not read. The round
wraps the Suite Directory's link hover in `@media (hover: hover)` (DW-115), and that stylesheet is
the one chunk that moved: `0ev.nkernamvc.css`, 12,609 on disk and 2,292 gzipped, became
`0cpcu.c2vi0a1.css`, 12,631 and 2,297, **22 heavier on disk and 5 gzipped**. The other eleven
stylesheets match by sha256, and every `.js` chunk together is the same 2,858,402 on disk and 831,372
gzipped (**Derived**, the tool's chunk total of 2,886,877 and 839,867 less the twelve stylesheets).
No prerendered document links that stylesheet: `/` renders on demand and only its client reference
manifest names it, so no route in the table above carries the 5 bytes. `/work` reads 253,764,
`/_not-found` and `/celeste` 1 heavier, `/_global-error` 1 lighter and `/cv` unchanged, the rebuild
variance of hashed names inside each document; the non-3D line names `/work`, 113,764 over, 81.3
percent.

### The 2026-09-23 reading, after Story 2-34

**Verbatim**, `node ops/asset-budget.mjs` against build `zZ7f-R4Ufn4KQJqPQZi4Q`, written
2026-09-23T17:54:27Z, taken on the story's working tree at `802fbf4` plus its own files, before the
commit that carries them: the tool's dirty-inputs row named three paths (`app/app.scss`,
`components/organisms/Celeste/celeste.scss` and `app/__tests__/anchor-contract.test.ts`, the last a
suite the build does not read) and every one of them is this story's. The before reading is the same
command against build `eZg2jFEWKmNPSm_vK1LsG` (written 2026-09-23T17:27:59Z at `802fbf4` on `dev`, no
measured input dirty).

**The before build reproduces the Story 2-33 after figures exactly** in both kinds of chunk: 19 `.js`
at 2,858,402 on disk and 831,372 gzipped, and 12 `.css` at 28,863 on disk and 8,613 gzipped. The
routes read 3 to 4 bytes above that reading on the wire (`/work` 253,890 against 253,886), the
rebuild variance of hashed file names inside each document.

| Route | Document bytes | Gzipped on the wire | Carries WebGL | Served | Nature |
|---|---|---|---|---|---|
| `/work` | 21,962 | 253,879 | no | yes | **Observed** |
| `/cv` | 23,218 | 252,289 | no | yes | **Observed** |
| `/_not-found` | 18,793 | 246,241 | no | **no**: Next's own document | **Observed** |
| `/celeste` | 15,380 | 246,215 | no | yes | **Observed** |
| `/_global-error` | 9,578 | 188,763 | no | **no**: Next's own document | **Observed** |

**Every route moved by the global stylesheet and nothing else.** Against the before build, on the
wire: `/work` and `/celeste` 11 lighter, `/cv` and `/_not-found` 9 lighter, `/_global-error` 1
heavier. **Observed 2026-09-23**, every `.next/static/chunks/*.css` and `*.js` weighed with
`zlib.gzipSync` at level 9 (the tool's method) on both builds:

| Figure | Before, `dev` at `802fbf4` | After, this story | Delta | Nature |
|---|---|---|---|---|
| Bytes in `.next/static/chunks` | 2,887,265 on disk, 839,985 gzipped | 2,887,275 on disk, 839,974 gzipped | **10 heavier on disk, 11 gzipped lighter** | **Observed**, tool's build table; **Derived** delta |
| Every `.js` chunk together | 19, 2,858,402 on disk, 831,372 gzipped | the same 19, byte for byte | 0 | **Observed** per chunk |
| Every `.css` chunk together | 12, 28,863 on disk, 8,613 gzipped | 12, 28,873 on disk, 8,602 gzipped | 10 heavier on disk, 11 gzipped lighter | **Observed** per chunk; **Derived** total |
| The global stylesheet | `059376_8ige11.css`, 6,044 on disk, 2,321 gzipped | `0.sgj2-qlca8y.css`, 6,020 on disk, 2,310 gzipped | 24 lighter on disk, 11 gzipped lighter: `--accent-glow` and its `rgba()` | **Observed** |
| `/celeste`'s stylesheet | `065o.2hw7ixf9.css`, 206 on disk, 167 gzipped | `13o0xta9_o96y.css`, 240 on disk, 167 gzipped | 34 heavier on disk, 0 gzipped: four role names where four literals stood | **Observed** |

**Against the Story 2-33 reading.** **Derived.** The chunks reproduce it, so the whole of the movement
is this story's, and it is noise against the 140,000: the non-3D line still names `/work`, 113,879
over, 81.3 percent, where Story 2-33's read 113,886 over; the 7 bytes between them are this story's
11 lighter less the 4 of rebuild variance. Measured against Story 2-2's 140,000 each time. The
narrative total, 634,829, did not move. § The faces the built CSS declares lost one value line in
this run's output, `font-family: system-ui`, which was `/celeste`'s heading; every family the built
CSS declares is still reached.

### The 2026-09-23 reading, after Story 2-33

**Verbatim**, `node ops/asset-budget.mjs` against build `3khZaamuAoVzhg3IZI1ZP`, written
2026-09-23T14:36:11Z, taken on the story's working tree at `70cdbbd` plus its own files, before the
commit that carries them: the tool's own dirty-inputs row named nine paths (`app/app.scss`, the hero's
and the timeline's components and stylesheets, `TorusCanvas.tsx`, and the three unit suites that
read them) and every one of them is this story's. The before reading is the same command against build
`xX5gFekkt9wODVOqKSW22` (written 2026-09-23T13:37:55Z at `70cdbbd` on `dev`, no measured input
dirty).

**The before build reproduces the Story 2-32 after figures exactly**: 18 `.js` and 12 `.css` at
2,017,280 on disk and 611,711 gzipped, with 28,771 on disk and 8,614 gzipped of `.css`, and `/work` at
486,682 on the wire, one byte of rebuild variance from 486,681. `dev` carried no measured change
between that reading and this one, so the whole of the movement below is this story's.

| Route | Document bytes | Gzipped on the wire | Carries WebGL | Served | Nature |
|---|---|---|---|---|---|
| `/work` | 21,962 | 253,886 | **no** | yes | **Observed** |
| `/cv` | 23,218 | 252,295 | no | yes | **Observed** |
| `/_not-found` | 18,793 | 246,248 | no | **no**: Next's own document | **Observed** |
| `/celeste` | 15,380 | 246,223 | no | yes | **Observed** |
| `/_global-error` | 9,578 | 188,760 | no | **no**: Next's own document | **Observed** |

**`/work` stopped carrying the WebGL stack**: 232,796 gzipped lighter on the wire, and a non-3D route
for the first time, because the torus, its scene and every library under them sit behind one
`next/dynamic` boundary that is rendered only once motion is known to be allowed. Against the before
build, on the wire: `/cv` 389 heavier, `/celeste` 583 and `/_not-found` 593, and `/_global-error` 2
lighter. The three that grew did so by the `gsap` split in the table below, which every document
references; nothing on those routes changed otherwise.

**The whole build, before and after, and the chunks that moved.** **Observed 2026-09-23**, the tool's
own build table on each side, and every `.next/static/chunks/*.css` and `*.js` weighed with
`zlib.gzipSync` at level 9 (the tool's method) on both builds.

| Figure | Before, `dev` at `70cdbbd` | After, this story | Delta | Nature |
|---|---|---|---|---|
| Chunks written | 18 `.js`, 12 `.css` | 19 `.js`, 12 `.css` | one `.js` more | **Observed** |
| Bytes in `.next/static/chunks` | 2,017,280 on disk, 611,711 gzipped | 2,887,265 on disk, 839,985 gzipped | **869,985 heavier on disk, 228,274 gzipped heavier** | **Observed**, tool's build table; **Derived** delta |
| Every `.css` chunk together | 28,771 on disk, 8,614 gzipped | 28,863 on disk, 8,613 gzipped | **92 heavier on disk, 1 gzipped lighter** | **Observed** per chunk; **Derived** total and delta |
| The global stylesheet | `0wn8wl0h.tdd5.css`, 6,210 on disk, 2,387 gzipped | `059376_8ige11.css`, 6,044 on disk, 2,321 gzipped | 166 lighter on disk, 66 gzipped lighter: `body#work`, its literal and its grid pair | **Observed** |
| The hero's stylesheet | `00oxvo_zdq~fx.css`, 777 on disk, 412 gzipped | `03_4rzt07q3yp.css`, 1,025 on disk, 472 gzipped | 248 heavier on disk, 60 gzipped heavier: the display row, the boundary, the two-column rule and its gate, the ratio, the entrance keyframe and its reduced-motion block | **Observed** |
| The timeline's and the row's stylesheet | `15~vasjft7hvg.css`, 3,137 on disk, 861 gzipped | `0aa~uxd40vt21.css`, 3,147 on disk, 866 gzipped | 10 heavier on disk, 5 gzipped heavier: the last row's separator dropped, the inline padding gone | **Observed** |
| Every `.js` chunk together | 1,988,509 on disk, 603,097 gzipped | 2,858,402 on disk, 831,372 gzipped | **869,893 heavier on disk, 228,275 gzipped heavier** | **Observed** per chunk; **Derived** total and delta |
| The three/R3F chunk `/work` referenced, shared with the gem | `0g0oqlx4fsym~.js`, 870,402 on disk, 228,423 gzipped, "three, @react-three/fiber" on `/work` | two copies, `0vynw~tou1f72.js` and `0w~ig71whmz0p.js`, 895,063 on disk each, 234,553 and 234,552 gzipped, "three, @react-three/fiber, @react-three/drei", both loaded on demand | 240,682 gzipped heavier in the build; **no document references either** | **Observed**. The copies are byte-identical for 870,361 characters and differ in the last 24,702, where the `/work` group's also carries the `three` namespace and a `useThree` re-export drei's orbit controls reach for (DW-120) |
| The torus's own chunk | none (its modules were in `/work`'s page chunks) | `0f-49j-pqi~h-.js`, 16,685 on disk, 5,117 gzipped, the torus, the orbit controls and `three-stdlib`'s `OrbitControls` | 5,117 gzipped, on demand | **Observed** |
| The two `Scene` chunks and `three-stdlib` on `/work` | `0d3ymyos8iowp.js` 6,500, `05e6tciymra6v.js` 6,495, `0_z_ou0-lbari.js` 9,446 gzipped | none | 22,441 gzipped lighter | **Observed** |
| `gsap` and `ScrollTrigger`, on every document | `0lp2sdt4pg9tq.js`, 113,435 on disk, 43,904 gzipped, the two together | `06wq285.0v7oj.js` 27,147 and `12pmsiouzm_k5.js` 17,373 gzipped, split | 616 gzipped heavier across the pair, paid on every route | **Observed**. The timeline no longer imports `ScrollTrigger`, and the bundler now groups the two by different sets of importers |
| The two routes' own page chunks | `173-m8hv7hjla.js`, 6,520 on disk, 2,871 gzipped | `15w3jb3pjlugp.js`, 11,318 on disk, 4,513 gzipped, on `/work`, carrying the hero and the torus's boundary; `0hr.q4x7~~l6g.js`, 6,090 on disk, 2,670 gzipped, on `/cv` | 4,312 gzipped heavier: the hero's code stands in a chunk of its own now, where it rode with the libraries before | **Observed**, the after side by reading each document's references; the before chunk's contents were not read |
| The home chunk | `0lvxja6x.ejpu.js`, 8,498 on disk, 3,278 gzipped | `0fs5q.~.e-s03.js`, 8,465 on disk, 3,267 gzipped | 11 gzipped lighter: module ids renumbered | **Observed** |
| Narrative chunks the fingerprints hit | 7, 1,346,880 on disk, 410,855 gzipped, 291,974 of it on `/work` at first paint | 7, 2,205,918 on disk, 634,829 gzipped, **none on a document but `gsap`, `ScrollTrigger` and `lenis`**, 580,108 on demand | 223,974 gzipped heavier in the build | **Observed**, the tool's narrative table; **Derived** delta |

**What the JavaScript number says.** **Derived.** Per route, the story took 232,796 gzipped off
`/work`'s first paint and added under 600 to the other three documents. Per build, the directory grew
by 228,275 gzipped, and all of it is one library emitted twice: before the story `/work` imported its
three/R3F chunk statically and the homepage's gem boundary happened to resolve to the same file; with
both scenes behind their own boundary, Turbopack emits one large chunk per boundary. A visitor on `/`
fetches one copy, as before; a visitor on `/work` with motion allowed fetches the other, on demand;
a visitor on `/work` under reduced motion fetches neither; and a session that visits both scenes
fetches the library twice, which is the cost DW-120 files. The rows above sum to the 228,275 exactly.

**What the CSS number says.** **Derived.** The hero's sheet grew by its rebuild and the global sheet
shrank by `body#work`, one gzipped byte apart in total.

**Against the Story 2-32 reading.** **Derived.** Today's before build reproduces that reading's after
build exactly, so the whole of today's movement is this story's: 869,985 heavier on disk and 228,274
gzipped heavier across the directory, 92 heavier on disk and 1 gzipped lighter in `.css`. **The
non-3D line names `/work` now**, 113,886 over budget, 81.3 percent, where Story 2-32's reading named
`/cv` at 111,906 over; `/cv` reads 112,295 over today. `/work` became the heaviest non-3D route by
leaving the 3D set, not by growing: it is 232,796 gzipped lighter than it was. Measured against Story
2-2's 140,000 each time. The narrative total, 634,829, is over the top of `EXPERIENCE.md:946`'s
estimate by the duplication above and by nothing that grew; the trade that estimate names was not
weighed on a figure that counts one library twice (DW-120).

### The 2026-09-23 reading, after Story 2-32

**Verbatim**, `node ops/asset-budget.mjs` against build `N4qdBF98aHF4vMMIrE44u`, written
2026-09-23T11:56:50Z, taken on the story's working tree at `cdaf966` plus its own files, before the
commit that carries them: the tool's own dirty-inputs row named twenty-two paths (the four chrome
stylesheets renamed to their PascalCase names, `public/logo.png` deleted, the five chrome
components, `SkipLink.scss`, `HomeLayout.scss`, four comment-only stylesheet edits, and the unit
suites beside them) and every one of them is this story's. The before reading is the same command
against build `1Kac2bThegXv_e_j6smcv` (written 2026-09-23T11:13:06Z at `cdaf966` on `dev`, no
measured input dirty).

**The before build reproduces the Story 2-30 after figures exactly**: 19 `.js` and 12 `.css` at
2,031,526 on disk and 617,053 gzipped, with 27,907 on disk and 8,371 gzipped of `.css`. `dev` carried
no measured change between that reading and this one, so the whole of the movement below is this
story's.

| Route | Document bytes | Gzipped on the wire | Carries WebGL | Served | Nature |
|---|---|---|---|---|---|
| `/work` | 21,536 | 486,681 | yes | yes | **Observed** |
| `/cv` | 22,453 | 251,906 | no | yes | **Observed** |
| `/celeste` | 14,724 | 245,637 | no | yes | **Observed** |
| `/_not-found` | 18,111 | 245,654 | no | **no**: Next's own document | **Observed** |
| `/_global-error` | 9,578 | 188,759 | no | **no**: Next's own document | **Observed** |

Against the before build, on the wire: `/work` 5,589 gzipped lighter, `/cv` 5,582, `/celeste` 5,583
and `/_not-found` 5,593, and `/_global-error` 3 lighter, the rebuild variance § Stated limits
records. Every document shrank on disk too, `/work` by 1,060, `/cv` by 1,018, `/celeste` by 921 and
`/_not-found` by 947, the header's `<img>` and its `srcset` gone from each; `/`, a dynamic route,
still has no row by construction.

**The whole build, before and after, and the chunks that moved.** **Observed 2026-09-23**, the tool's
own build table on each side, and every `.next/static/chunks/*.css` and `*.js` weighed with
`zlib.gzipSync` at level 9 (the tool's method) on both builds.

| Figure | Before, `dev` at `cdaf966` | After, this story | Delta | Nature |
|---|---|---|---|---|
| Chunks written | 19 `.js`, 12 `.css` | 18 `.js`, 12 `.css` | one `.js` fewer | **Observed** |
| Bytes in `.next/static/chunks` | 2,031,526 on disk, 617,053 gzipped | 2,017,280 on disk, 611,711 gzipped | **14,246 lighter on disk, 5,342 gzipped lighter** | **Observed**, tool's build table; **Derived** delta |
| Every `.css` chunk together | 27,907 on disk, 8,371 gzipped | 28,771 on disk, 8,614 gzipped | **864 heavier on disk, 243 gzipped heavier** | **Observed** per chunk; **Derived** total and delta |
| The global stylesheet | `0z.nwkyilu5e..css`, 5,794 on disk, 2,278 gzipped | `0wn8wl0h.tdd5.css`, 6,210 on disk, 2,387 gzipped | 416 heavier on disk, 109 gzipped heavier: the header band, its hairline and the scroll padding's `calc()`, and the wordmark's type | **Observed** |
| The nav's stylesheet | `06.b3.34agec_.css`, 463 on disk, 278 gzipped | `16rnu_sqn25nj.css`, 703 on disk, 338 gzipped | 240 heavier on disk, 60 gzipped heavier: the mono type, the rule at rest and the gated hover | **Observed** |
| The skip link's stylesheet | `0sx._u9-xj1vh.css`, 638 on disk, 332 gzipped | `0_b3v9lcev-t~.css`, 802 on disk, 378 gzipped | 164 heavier on disk, 46 gzipped heavier: the reach inset and the hover gate | **Observed** |
| The container's stylesheet | `0tvend-vkl3zw.css`, 63 on disk, 83 gzipped | `11190o19awian.css`, 85 on disk, 98 gzipped | 22 heavier on disk, 15 gzipped heavier | **Observed** |
| The home stylesheet | `0ahkrv13~wi6m.css`, 12,587 on disk, 2,279 gzipped | `0ev.nkernamvc.css`, 12,609 on disk, 2,292 gzipped | 22 heavier on disk, 13 gzipped heavier: the list reset and the stagger on list items | **Observed** |
| Every `.js` chunk together | 2,003,619 on disk, 608,682 gzipped | 1,988,509 on disk, 603,097 gzipped | **15,110 lighter on disk, 5,585 gzipped lighter** | **Observed** per chunk; **Derived** total and delta |
| The root layout's chunk, which the tool attributes to Lenis | `0lpnzc9vw7rq3.js`, 38,374 on disk, 12,068 gzipped, carrying the header, the raster's `srcSet` and its alternative text | `0xnq42xqfatvg.js`, 32,702 on disk, 10,201 gzipped, carrying the header and the wordmark | 5,672 lighter on disk, 1,867 gzipped lighter | **Observed**, by reading each chunk as text |
| One shared chunk | `0_mmocpo6-784.js`, 9,530 on disk, 3,739 gzipped | none | 3,739 gzipped lighter | **Observed** |
| The home chunk | `14zyd3ba1wiyn.js`, 8,406 on disk, 3,256 gzipped | `0lvxja6x.ejpu.js`, 8,498 on disk, 3,278 gzipped | 92 heavier on disk, 22 gzipped heavier: the contact group's list markup | **Observed** |
| One chunk renamed | `0xas7euhouwkj.js`, 54,650 on disk, 12,839 gzipped | `0oep0lme1dsc8.js`, 54,650 on disk, 12,838 gzipped | 1 gzipped lighter: module ids renumbered | **Observed** |
| Narrative chunks the fingerprints hit | 7, 1,352,552 on disk, 412,722 gzipped | 7, 1,346,880 on disk, 410,855 gzipped | 1,867 gzipped lighter, the Lenis chunk above | **Observed**, the tool's narrative table; **Derived** delta |

**What the JavaScript number says.** **Derived.** The logo was the one importer of `next/image` in
the Hub, and the story's only removed import; the markup it added (one wrapper in the header, a list
in the contact group) is the 22 the home chunk gained. So the 5,606 gzipped that left the layout's
chunk and the shared chunk together is `next/image` and what only it pulled in, on every route,
because the header sits in the root layout. The rows above sum to the 5,585 exactly.

**What the CSS number says.** **Derived.** The chrome was a raster and three 2023 declarations; it is
a band, a hairline, a wordmark and two labelled links with a rule at rest and a gated hover now, all
of it contract roles, and the skip link gained its reach inset and its hover gate. That is the 243,
spread over five chunks, and it is paid on every route that renders a header, and the scripts it
removed repay it more than twenty times over.

**Against the Story 2-30 reading.** **Derived.** Today's before build reproduces that reading's after
build exactly, so the whole of today's movement is this story's: 14,246 lighter on disk and 5,342
gzipped lighter across the directory, 864 heavier on disk and 243 gzipped heavier in `.css`. The
non-3D line names `/cv`, 111,906 over budget, 79.9 percent, where it was 117,488 over before this
story and 117,492 at Story 2-30's reading (four bytes of rebuild variance), measured against Story
2-2's 140,000 each time.

### The 2026-09-23 reading, after Story 2-30

**Verbatim**, `node ops/asset-budget.mjs` against build `9xKq1w4OnW0Bc5Jf53GQ1`, written
2026-09-23T10:02:07Z, taken on the story's working tree at `2eb0aa0` plus its own files, before the
commit that carries them: the tool's own dirty-inputs row named eight paths (`Error404.scss` added,
`error-page.scss` deleted, `app/app.scss`, `app/not-found.tsx`, `Error404.tsx`, and the three unit
suites beside them, every one modified) and every one of them is this story's. The before reading
is the same command against build `gx6qgwAvuy7LjkwmJMVxX` (written 2026-09-23T09:26:46Z at `2eb0aa0`
on `dev`, no measured input dirty). The after side was built twice, `Sbk60a9S_F4Dc7v8z5Zyz` and
`9xKq1w4OnW0Bc5Jf53GQ1`, which wrote the same 31 chunks at the same names and sizes and moved the
`/cv` document by two gzipped bytes, the rebuild variance § Stated limits records. A build between
them, `6yHba_HPNvPNeMUIxs016`, weighed the same component with a client directive added and is the
comparison in the Derived paragraphs below, not a reading.

**The before build reproduces the Story 2-31 after figures exactly**: 21 `.js` and 11 `.css` at
2,033,913 on disk and 618,565 gzipped, with 27,857 on disk and 8,308 gzipped of `.css`. `dev` carried
no measured change between that reading and this one, so the whole of the movement below is this
story's.

| Route | Document bytes | Gzipped on the wire | Carries WebGL | Served | Nature |
|---|---|---|---|---|---|
| `/work` | 22,596 | 492,272 | yes | yes | **Observed** |
| `/cv` | 23,471 | 257,492 | no | yes | **Observed** |
| `/celeste` | 15,645 | 251,225 | no | yes | **Observed** |
| `/_not-found` | 19,058 | 251,250 | no | **no**: Next's own document | **Observed** |
| `/_global-error` | 9,578 | 188,764 | no | **no**: Next's own document | **Observed** |

Against the before build, on the wire: `/work` 975 gzipped lighter, `/cv` 947, `/celeste` 982 and
`/_not-found` 811, and `/_global-error` unchanged. Every document grew on disk, `/work` by 1,797,
`/cv` by 1,700, `/celeste` by 1,897 and `/_not-found` by 5,185, for the reason the second Derived
paragraph gives; `/`, a dynamic route, still has no row by construction.

**The whole build, before and after, and the chunks that moved.** **Observed 2026-09-23**, the tool's
own build table on each side, and every `.next/static/chunks/*.css` and `*.js` weighed with
`zlib.gzipSync` at level 9 (the tool's method) on both builds.

| Figure | Before, `dev` at `2eb0aa0` | After, this story | Delta | Nature |
|---|---|---|---|---|
| Chunks written | 21 `.js`, 11 `.css` | 19 `.js`, 12 `.css` | two `.js` fewer, one `.css` more | **Observed** |
| Bytes in `.next/static/chunks` | 2,033,913 on disk, 618,565 gzipped | 2,031,526 on disk, 617,053 gzipped | **2,387 lighter on disk, 1,512 gzipped lighter** | **Observed**, tool's build table; **Derived** delta |
| Every `.css` chunk together | 27,857 on disk, 8,308 gzipped | 27,907 on disk, 8,371 gzipped | **50 heavier on disk, 63 gzipped heavier** | **Observed** per chunk; **Derived** total and delta |
| The 404's stylesheet | `0ngdt25qujsn2.css`, 1,342 on disk, 558 gzipped | `0ydehnkcsx3lo.css`, 1,455 on disk, 529 gzipped | 113 heavier on disk, 29 gzipped lighter | **Observed** |
| The global stylesheet | `03njxn1smh8rb.css`, 5,857 on disk, 2,294 gzipped | `0z.nwkyilu5e..css`, 5,794 on disk, 2,278 gzipped | 63 lighter on disk, 16 gzipped lighter: the `.error-page__back` scope out | **Observed** |
| The display entrance's stylesheet | inside `04dfo_faqzsrs.css`, 1,198 on disk, 525 gzipped, one chunk with the skip link's | `12osslk_d1pps.css` (560 and 301) beside `0sx._u9-xj1vh.css` (the skip link's, 638 and 332) | the same 1,198 bytes on disk in two chunks, 108 gzipped heavier | **Observed**, by reading each chunk as text |
| Every `.js` chunk together | 2,006,056 on disk, 610,257 gzipped | 2,003,619 on disk, 608,682 gzipped | **2,437 lighter on disk, 1,575 gzipped lighter** | **Observed** per chunk; **Derived** total and delta |
| The 404's own chunk | `0i9pf4zw4lx2x.js`, 2,332 on disk, 885 gzipped, carrying the page, the Plate mark and its GSAP import | none: the component renders on the server | 885 gzipped lighter | **Observed** |
| GSAP and ScrollTrigger | `08pj4xkz~kajd.js` (70,032 and 26,971) and `0r_9pnds9g3a0.js` (43,379 and 17,542) | `0lp2sdt4pg9tq.js`, 113,435 on disk, 43,904 gzipped, the two in one chunk | 24 heavier on disk, 609 gzipped lighter | **Observed**, the tool's fingerprint table |
| Lenis | `0zk544r9xyc8z.js`, 38,087 and 11,971 | `0lpnzc9vw7rq3.js`, 38,374 and 12,068 | 287 heavier on disk, 97 gzipped heavier | **Observed** |
| One shared chunk | `0hmi~~u8b2onv.js`, 9,934 and 3,913 | `0_mmocpo6-784.js`, 9,530 and 3,739 | 404 lighter on disk, 174 gzipped lighter | **Observed** |
| Three chunks renamed | `0lm_ikg6v8~uk.js` (8,406 and 3,264), `0tfhdb1o6m9y7.js` (28,109 and 9,445), `0f5gej2xr49rk.js` (6,526 and 2,868) | `14zyd3ba1wiyn.js` (8,406 and 3,256), `0_z_ou0-lbari.js` (28,103 and 9,446), `173-m8hv7hjla.js` (6,520 and 2,871) | 8 lighter, 1 and 3 heavier, gzipped: module ids renumbered | **Observed** |
| Narrative chunks the fingerprints hit | 8, 1,352,247 on disk, 413,233 gzipped | 7, 1,352,552 on disk, 412,722 gzipped | 511 gzipped lighter, the GSAP pair and Lenis above | **Observed**, the tool's narrative table; **Derived** delta |

**What the JavaScript number says.** **Derived.** The 404 renders on the server now, so its client
chunk left the build, and with it the one importer of GSAP that did not import ScrollTrigger as
well: the bundler emits the two libraries as one chunk, which one gzip stream packs 609 bytes
tighter, and Lenis's chunk and one shared chunk moved with the regrouping. Those rows sum to the
1,575 exactly. `/cv`'s scripts fell by 1,568, from 248,792 to 247,224, which is the same arithmetic
less the two renamed chunks `/cv` does not load, so the 404's chunk was on `/cv`'s document before
this story: the root layout's not-found boundary is on every route, and so was its client code.

**What the documents say, and why the component stays on the server.** **Derived.** Each route's
document grew by 1,700 to 1,900 bytes on disk, `/cv`'s by 365 gzipped (4,722 to 5,087), because the
root layout's not-found boundary travels in every route's flight payload: a client component as a
reference, a server component as its rendered tree, fifteen character spans included. The 404's
stylesheet and the display entrance's are preloaded on every route for the same reason, 558 to 830
gzipped on `/cv`. That cost was weighed against the alternative rather than assumed: the same
component with a client directive (build `6yHba_HPNvPNeMUIxs016`, 20 `.js` and 12 `.css`) put `/cv`
at 258,002 gzipped on the wire (document 4,715, scripts 248,106), 510 heavier than the server
component's 257,492, because its client chunk loads on every route; `/work` read 492,805 (533
heavier), `/celeste` 251,768 (543) and `/_not-found` 251,675 (425). The server component is the
lighter of the two on every route, so it stays.

**What the CSS number says.** **Derived.** The rebuilt 404 stylesheet is 29 gzipped lighter than
the 2023 one and the global stylesheet 16 lighter with the scope gone, but the display entrance's
rules, emitted with the skip link's until today, are a chunk of their own now that the 404 renders
the heading as well as `/`, and two gzip streams over what one covered cost 108. The 63 is those
three.

**Against the Story 2-31 reading.** **Derived.** Today's before build reproduces that reading's
after build exactly, so the whole of today's movement is this story's: 2,387 lighter on disk and
1,512 gzipped lighter across the directory, 50 heavier on disk and 63 gzipped heavier in `.css`. The
non-3D line names `/cv`, 117,492 over budget, 83.9 percent, where it was 118,439 over before this
story and 118,438 at Story 2-31's reading (one byte of rebuild variance), measured against Story
2-2's 140,000 each time.

### The 2026-09-23 reading, after Story 2-31

**Verbatim**, `node ops/asset-budget.mjs` against build `0KxutAmqMQuDuV6dR2omk`, written
2026-09-23T08:03:45Z, taken on the story's working tree at `460230c` plus its own files, before the
commit that carries them: the tool's own dirty-inputs row named nineteen paths (the three
`components/atoms/HudLabel/` files deleted; `app/app.scss`, `app/scss/_print.scss`,
`app/cv/page.tsx`, `app/__tests__/anchor-contract.test.ts`, the `WorkItem` and `PlateMark` sources and
tests, `CvIntro.tsx`, `Error404.tsx`, `HomeLayout.tsx` and its test, `Premise.test.tsx` and
`WorkHero.tsx`, every one modified) and every one of them is this story's. The before reading is the
same command against build `xYaWbFMJEJtFEN4Ffs5N6` (written 2026-09-23T06:09:04Z at `460230c` on
`dev`, no measured input dirty). The after side was built three times. The first two,
`UrWXqz0rhlKgfAkd_0BeV` and `NUFEJaWf2yKbCGCGaweZV`, wrote the same 32 chunks at the same names and
sizes, and moved each prerendered document by one or two gzipped bytes, which is the rebuild
variance § Stated limits records. The story's review then took one inert declaration out of the
row's stylesheet (a `transform-origin` on a transform that never animates), and the third build, the
one read here, differs from those two in that chunk alone: `15~vasjft7hvg.css` in place of
`1563bpat~2q1f.css`, 19 bytes lighter on disk and 5 gzipped. The before side was built once.

**The before build reproduces the Story 2-29 after figures within one commit.** That reading
recorded 21 `.js` and 13 `.css` at 2,030,896 on disk and 618,513 gzipped, with 26,785 on disk and
8,673 gzipped of `.css`. The `.js` figures reproduce exactly; the `.css` is 87 heavier on disk and 1
gzipped heavier here, because `dev` has carried `53df9c0` (the Story 2-29 review patch to
`HomeLayout.scss` and `SkipControl.scss`) since that reading was taken. None of that gap is this
story's.

| Route | Document bytes | Gzipped on the wire | Carries WebGL | Served | Nature |
|---|---|---|---|---|---|
| `/work` | 20,799 | 493,246 | yes | yes | **Observed** |
| `/cv` | 21,771 | 258,438 | no | yes | **Observed** |
| `/celeste` | 13,748 | 252,206 | no | yes | **Observed** |
| `/_not-found` | 13,873 | 252,060 | no | **no**: Next's own document | **Observed** |
| `/_global-error` | 9,578 | 188,763 | no | **no**: Next's own document | **Observed** |

Against the before build, on the wire: `/work` 586 gzipped heavier, `/cv` 171, `/celeste` 282,
`/_not-found` 282, and `/_global-error` 1 lighter, which is the rebuild variance. The `/work` and `/cv` documents grew by 459 and 315
bytes, the new `role`, `aria-labelledby` and heading `id` on every row, and `/`, a dynamic route,
still has no row by construction.

**The whole build, before and after, and the chunks that moved.** **Observed 2026-09-23**, the tool's
own build table on each side, and every `.next/static/chunks/*.css` and `*.js` weighed with
`zlib.gzipSync` at level 9 (the tool's method) on both builds.

| Figure | Before, `dev` at `460230c` | After, this story | Delta | Nature |
|---|---|---|---|---|
| Chunks written | 21 `.js`, 13 `.css` | 21 `.js`, 11 `.css` | two `.css` fewer | **Observed** |
| Bytes in `.next/static/chunks` | 2,030,983 on disk, 618,514 gzipped | 2,033,913 on disk, 618,565 gzipped | **2,930 heavier on disk, 51 gzipped heavier** | **Observed**, tool's build table; **Derived** delta |
| Every `.css` chunk together | 26,872 on disk, 8,674 gzipped | 27,857 on disk, 8,308 gzipped | **985 heavier on disk, 366 gzipped lighter** | **Observed** per chunk; **Derived** total and delta |
| The label's stylesheets | `0-5rhfyxrv3md.css` (the Plate mark, 496 on disk, 303 gzipped) and `0fmvj6dex6cl5.css` (`HudLabel`, 515 and 268) | `10qpy4vobcu5f.css`, 997 on disk, 418 gzipped, carrying all three variants and the subordinate line | 14 lighter on disk, 153 gzipped lighter: two chunks became one | **Observed** |
| The row's stylesheet | `0k~wcaar2jss4.css`, 2,189 on disk, 771 gzipped | `15~vasjft7hvg.css`, 3,137 on disk, 861 gzipped | 948 heavier on disk, 90 gzipped heavier | **Observed** |
| The global stylesheet | `07pbhe.gtum3m.css`, 5,806 on disk, 2,282 gzipped | `03njxn1smh8rb.css`, 5,857 on disk, 2,294 gzipped | 51 on disk, 12 gzipped heavier: the print rule in, the `.work-item::before` scope out | **Observed** |
| The home route's stylesheets | `01dn06xnqi6ak.css` (the home surface, 6,186 and 1,332) and `14iggcube1kma.css` (the premise, the footer and the Directory, 6,401 and 1,262) | `0ahkrv13~wi6m.css`, 12,587 on disk, 2,279 gzipped, carrying all of them | the same bytes on disk, 315 gzipped lighter: two chunks became one | **Observed** |
| Every `.js` chunk together | 2,004,111 on disk, 609,840 gzipped | 2,006,056 on disk, 610,257 gzipped | **1,945 heavier on disk, 417 gzipped heavier** | **Observed** per chunk; **Derived** total and delta |
| The four `.js` chunks that moved | `00j1ooy.0cni2.js` (the 404, 1,744 and 767), `0uifu5rc1y.iv.js` (the home surface, 7,826 and 3,165), `0z9ribvuutp1v.js` (the row, 6,430 and 2,822), `10pryuwzqynw-.js` (`/work`'s hero with `three-stdlib`, 27,428 and 9,291) | `0i9pf4zw4lx2x.js` (2,332 and 885), `0lm_ikg6v8~uk.js` (8,406 and 3,264), `0f5gej2xr49rk.js` (6,526 and 2,868), `0tfhdb1o6m9y7.js` (28,109 and 9,445) | 118, 99, 46 and 154 gzipped heavier; the other 17 are byte-identical by name and size | **Observed**, by reading each chunk as text for the marks `hud-label`, `plate-mark` and `work-item` |
| Narrative chunks the fingerprints hit | 8, 1,351,566 on disk, 413,079 gzipped | 8, 1,352,247 on disk, 413,233 gzipped | 154 gzipped heavier, which is `/work`'s hero chunk above and nothing else | **Observed**, the tool's narrative table; **Derived** delta |

**What the JavaScript number says, and the Plate mark is the mover.** **Derived.** Three of the four
chunks that moved are the three client routes that render a label, the 404, `/` and `/work`, and each
went from carrying `hud-label` to carrying `plate-mark`: the Plate mark is a larger component than the
atom it absorbed (three variants behind a union, and every cell uppercased), and each client route
that renders one compiles its own copy, so the difference lands three times. `/cv` renders its mark
from a server component and ships none of it. The fourth is the row itself, 46 gzipped heavier with
the region's labelling and the lists' roles, and GSAP stays in it: the height tween is the one named
exception and survives the rebuild.

**What the CSS number says.** **Derived.** The rebuilt stylesheets are heavier on disk and lighter on
the wire, for the reason Story 2-29's reading gives: `var(--token-...)` names are long, repeated and
drawn from a small set, which gzip does well, and the 2023 literals they replaced were short and
various. Most of the 366 is not a rewrite at all but a regrouping: with the atom gone, the bundler
emits the label's two stylesheets as one chunk and the home route's two as one, and a single gzip
stream over each pair is 468 bytes shorter than two. The row's own stylesheet is 90 heavier: the
leading rule is two pseudo-elements, the hover is a `:has()` rule, and the marker declares its
content twice.

**Against the Story 2-29 reading.** **Derived.** That reading's after build carried 21 `.js` and 13
`.css` at 2,030,896 on disk and 618,513 gzipped, with 26,785 on disk and 8,673 gzipped of `.css`.
Today's after build is 3,017 heavier on disk and 52 gzipped heavier than that one across the whole
directory, and 1,072 heavier on disk and 365 gzipped lighter in `.css`. Of the 52, this story's own
share is 51 by today's own before listing; the remaining 1 is `53df9c0`. The non-3D line names `/cv`,
118,438 over budget, 84.6 percent, where it was 118,267 over before this story and 118,263 after
Story 2-29, measured against Story 2-2's 140,000 each time.

### The 2026-09-21 reading, after Story 2-29

**Verbatim**, `node ops/asset-budget.mjs` against build `wyW2OiV9VvlHmhcctT2lp`, written
2026-09-22T02:06:29Z, taken on the story's working tree at `88e2099` plus its own files, before the
commit that carries them: the tool's own dirty-inputs row named five paths
(`app/__tests__/anchor-contract.test.ts`, `components/atoms/SkipControl/SkipControl.scss`,
`components/organisms/HomeLayout/HomeLayout.scss`, `HomeLayout.tsx` and its test, every one
modified) and every one of them is this story's. The before reading is the same command against
build `gy6Se_c6bioa2StBLDgHX` (written 2026-09-22T01:37:28Z at `88e2099` on `dev`, no measured input
dirty). Both sides were built twice and reproduced to the byte, the after build also arriving as
`USdhcRswdaCPR2f5s0kYr` with the same 34 chunks at the same sizes and the same names, so the
per-chunk listing below could be taken on both sides.

**The before build does not reproduce the Story 2-28 after figures, and the gap is a commit rather
than a measurement.** That reading recorded 21 `.js` and 13 `.css` at 2,031,505 on disk and 618,931
gzipped, with 25,859 on disk and 8,681 gzipped of `.css`. The `.css` figures reproduce exactly; the
whole-directory figure is 816 lighter on disk and 183 lighter gzipped here, because `dev` has
carried `647315a` (`fix(a-17): scope Lenis smooth scroll to the motion preference`) since that
reading, which is a change to JavaScript on every route. None of that gap is this story's, and it is
recorded rather than smoothed over.

| Route | Document bytes | Gzipped on the wire | Carries WebGL | Served | Nature |
|---|---|---|---|---|---|
| `/work` | 20,340 | 492,656 | yes | yes | **Observed** |
| `/cv` | 21,456 | 258,263 | no | yes | **Observed** |
| `/celeste` | 13,748 | 251,922 | no | yes | **Observed** |
| `/_not-found` | 13,863 | 251,777 | no | **no**: Next's own document | **Observed** |
| `/_global-error` | 9,578 | 188,762 | no | **no**: Next's own document | **Observed** |

**`/` has no row here and does not gain one.** It is a dynamic route: `app/page.tsx` reads the
`Save-Data` request header, so Next writes no prerendered document for it, and this tool reads
prerendered documents. The surface this story rebuilt is therefore invisible in this table by
construction, which is why the movement is recorded in the per-chunk listing and the totals instead.
Every row above is within four gzipped bytes of the before build's, which is the rebuild variance
§ Stated limits records.

**The whole build, before and after, and the four chunks that moved.** **Observed 2026-09-21**, the
tool's own build table on each side, and every `.next/static/chunks/*.css` and `*.js` weighed with
`zlib.gzipSync` at level 9 (the tool's method) on both builds.

| Figure | Before, `dev` at `88e2099` | After, this story | Delta | Nature |
|---|---|---|---|---|
| Chunks written | 21 `.js`, 13 `.css` | 21 `.js`, 13 `.css` | none | **Observed** |
| Bytes in `.next/static/chunks` | 2,030,689 on disk, 618,748 gzipped | 2,030,896 on disk, 618,513 gzipped | **207 heavier on disk, 235 gzipped lighter** | **Observed**, tool's build table; **Derived** delta |
| Every `.css` chunk together | 25,859 on disk, 8,681 gzipped | 26,785 on disk, 8,673 gzipped | **926 heavier on disk, 8 gzipped lighter** | **Observed** per chunk; **Derived** total and delta |
| The chunk carrying the home stylesheet | `0wrloex~kocd~.css`, 5,173 on disk, 1,339 gzipped, carrying `.home-panel` and no `.scanline-overlay` | `0z0c.kxmb03ra.css`, 6,099 on disk, 1,331 gzipped, carrying `.home-panel` and `.scanline-overlay` | 926 heavier on disk, 8 gzipped lighter: the whole `.css` movement is this one chunk, and the other twelve are byte-identical by name and size | **Observed** |
| Every `.js` chunk together | 2,004,830 on disk, 610,067 gzipped | 2,004,111 on disk, 609,840 gzipped | **719 on disk, 227 gzipped lighter** | **Observed** per chunk; **Derived** total and delta |
| The chunk carrying `HomeLayout` | `11o5270alhovv.js`, 8,545 on disk, 3,390 gzipped, carrying `home-panel` and `gsap` | `0uifu5rc1y.iv.js`, 7,826 on disk, 3,165 gzipped, carrying `home-panel` and `scanline-overlay` and **no `gsap`** | 719 on disk, 225 gzipped lighter | **Observed**, by reading each chunk as text for the three marks |
| The other two chunks that moved | `0h-snp3t~clk6.js` 1,744 on disk, 765 gzipped; `0jzyz7fy.nr7f.js` 27,428 on disk, 9,295 gzipped | `00j1ooy.0cni2.js` 1,744 on disk, 767 gzipped; `10pryuwzqynw-.js` 27,428 on disk, 9,291 gzipped | renamed with identical bytes on disk, 2 gzipped heavier and 4 gzipped lighter; the remaining 30 chunks are byte-identical by name and size | **Observed** |
| Narrative chunks the fingerprints hit | 8, 1,351,566 on disk, 413,083 gzipped | 8, 1,351,566 on disk, 413,079 gzipped | 4 gzipped lighter, which is the `three-stdlib` rename above and nothing this story wrote | **Observed**, the tool's narrative table; **Derived** delta |

**What the JavaScript number says, and GSAP is the mover.** **Derived.** The component's chunk is
225 gzipped bytes lighter and the string `gsap` no longer occurs in it: `HomeLayout.tsx` dropped
the `gsap` import, the `useGsapContext` import and the whole timeline, and the entrance is now five
`animation-delay` declarations in the stylesheet. **GSAP left this component, not the route.** Its
own chunk, `08pj4xkz~kajd.js` at 26,971 gzipped, is unchanged and is still referenced by
`/_not-found`, `/celeste`, `/cv` and `/work`; `app/providers.tsx` imports `gsap` and
`gsap/ScrollTrigger` in the root layout, so the library is on every route including `/` whatever
this component does. `WorkItem`, `WorkHero`, `WorkTimeline` and the 404 still tween. The 719 on
disk and 225 gzipped are what one component's removal of the dependency is worth, and no more.

**What the CSS number says.** **Derived.** The home stylesheet's chunk is 926 bytes heavier on disk
and 8 gzipped lighter, which is the shape a token-native rewrite has: `var(--token-text-secondary)`
is longer text than `var(--light-gray-color)` and far longer than `#0a000f`, and the file gained
the `@keyframes`, the five `animation` declarations and the `@media (hover: hover)` block. Against
that it lost the two `linear-gradient` images, the `.home-overlay` and `.home-sys-coords` rules and
the dim-siblings rule. Repetition is what gzip is good at, and 32 `var(--…)` names drawn from one
small set compress far better than the literals they replaced, so the longer file is the smaller
transfer. The scrim's own five declarations arrived in this same chunk, which is the cost Story
2-28's reading deferred to this story: `ScanlineOverlay.scss` was in no chunk at all after that
story removed both of its call sites, and it is in this one now.

**Against the Story 2-28 reading.** **Derived.** That reading's after build carried 21 `.js` and 13
`.css` at 2,031,505 on disk and 618,931 gzipped, with 25,859 on disk and 8,681 gzipped of `.css`.
Today's after build is 609 lighter on disk and 418 gzipped lighter than that one across the whole
directory, and 926 heavier on disk and 8 gzipped lighter in `.css`. Of the 418, this story's own
share is 235 by today's own before listing; the remaining 183 is `647315a`, the A-17 fix, which
landed on `dev` between the two readings. The non-3D line still names `/cv`, 118,263 over budget,
84.5 percent, where it was 118,219 over.

### The 2026-09-14 reading, after Story 2-28

**Verbatim**, `node ops/asset-budget.mjs` against build `HMUMVY1c3c8TaxM8ZpHFr`, written
2026-09-14T19:17:40Z, taken on the story's working tree at `1addf8c` plus its own files, before the
commit that carries them: the tool's own dirty-inputs row named seven paths (`ScanlineOverlay.scss`,
`ScanlineOverlay.tsx` and its test, `WorkHero.tsx`, `Error404.tsx`, `GlitchText.scss` and
`app/__tests__/anchor-contract.test.ts`, every one modified) and every one of them is this story's.
The before reading is the same command against build `Y4h-61hDaR4j-d3q4LPv9` (written
2026-09-14T19:09:11Z at `1addf8c` on `dev`, no measured input dirty), and it was reproduced to the
byte by a second build of `1addf8c` in a detached worktree (`8YbRjiKlzpAMncj0kOYbS`, 35 chunks at
2,033,098 on disk and 619,578 gzipped on both) so the per-chunk listing below could be taken on both
sides. The before build reads 21 `.js` and 14 `.css` at 619,578 gzipped and 9,190 gzipped of `.css`,
against the Story 2-27 after figures of 619,573 and 9,195: five bytes either way on a rebuild of the
same commit, the variance § Stated limits records.

| Route | Document bytes | Gzipped on the wire | Carries WebGL | Served | Nature |
|---|---|---|---|---|---|
| `/work` | 20,340 | 492,588 | yes | yes | **Observed** |
| `/cv` | 21,456 | 258,219 | no | yes | **Observed** |
| `/celeste` | 13,748 | 251,741 | no | yes | **Observed** |
| `/_not-found` | 13,863 | 251,594 | no | **no**: Next's own document | **Observed** |
| `/_global-error` | 9,578 | 188,763 | no | **no**: Next's own document | **Observed** |

**The whole build, before and after, and the one `.css` chunk that left.** **Observed 2026-09-14**,
the tool's own build table on each side, and every `.next/static/chunks/*.css` and `*.js` weighed
with `zlib.gzipSync` at level 9 (the tool's method) on both builds.

| Figure | Before, `dev` at `1addf8c` | After, this story | Delta | Nature |
|---|---|---|---|---|
| Chunks written | 21 `.js`, 14 `.css` | 21 `.js`, 13 `.css` | **one `.css` chunk fewer** | **Observed** |
| Bytes in `.next/static/chunks` | 2,033,098 on disk, 619,578 gzipped | 2,031,505 on disk, 618,931 gzipped | **1,593 on disk, 647 gzipped lighter** | **Observed**, tool's build table; **Derived** delta |
| Every `.css` chunk together | 26,880 on disk, 9,190 gzipped | 25,859 on disk, 8,681 gzipped | **1,021 on disk, 509 gzipped lighter** | **Observed** per chunk; **Derived** total and delta |
| The chunk carrying `.scanline-overlay` | `0d_8a3hzs285~.css`, 1,021 on disk, 509 gzipped, carrying `.scanline-overlay`, the `feTurbulence` data URI, `grain-shift`, one `radial-gradient(`, one `repeating-linear-gradient(` and `z-index:10` | **no chunk**: no built stylesheet carries `.scanline-overlay`, `feTurbulence` or `grain-shift`, and `radial-gradient(` and `repeating-linear-gradient(` occur zero times across the thirteen | 1,021 on disk, 509 gzipped lighter: the whole `.css` movement is this one chunk, and the other thirteen are byte-identical by name and size | **Observed** |
| Every `.js` chunk together | 2,006,218 on disk, 610,388 gzipped | 2,005,646 on disk, 610,250 gzipped | **572 on disk, 138 gzipped lighter** | **Observed** per chunk; **Derived** total and delta |
| The `/work` hero chunk | `01e..b9m1c.09.js`, 28,157 on disk, 9,476 gzipped, carrying `work-hero`, the torus and `scanline-overlay` | `09w7g2xf0b.6r.js`, 27,864 on disk, 9,404 gzipped, carrying `work-hero` and the torus and no `scanline-overlay` | 293 on disk, 72 gzipped lighter | **Observed** |
| The 404 chunk | `0yog-kghohlj1.js`, 2,023 on disk, 831 gzipped, carrying `error-page`, `ERR_NOT_FOUND` and `scanline-overlay` | `0h-snp3t~clk6.js`, 1,744 on disk, 765 gzipped, carrying `error-page` and `ERR_NOT_FOUND` and no `scanline-overlay` | 279 on disk, 66 gzipped lighter: the two chunks above are the whole `.js` movement, and the other nineteen are byte-identical by name and size | **Observed** |
| Narrative chunks the fingerprints hit | 8, 1,352,239 on disk, 413,236 gzipped | 8, 1,351,946 on disk, 413,164 gzipped | 293 on disk, 72 gzipped lighter: the `/work` hero chunk is one of the eight, the `three-stdlib` fingerprint hitting it on both sides | **Observed**, the tool's narrative table; **Derived** delta |

**What the CSS number says.** **Derived.** The raster was 55 lines of source and its whole stylesheet
is 509 gzipped bytes, most of it the `feTurbulence` SVG as a data URI, which is text that gzips
poorly. The rewritten stylesheet is five declarations, and it is in no chunk at all: a component
stylesheet is bundled only where the component is imported, and after this story nothing imports
it, so its cost is zero until Story 2-29 places the layer and the chunk that carries `HomeLayout`
grows by whatever five declarations compress to. The honest figure for the rewrite is therefore
the 509 the raster cost, not a net of two sizes.

**Where the 509 bytes were being fetched, which the per-route table shows and the source did not.**
**Derived** from the before build's prerendered documents, read as text. `0d_8a3hzs285~.css` was
referenced by every served document (`/work` four times, `/cv` three, `/celeste` three, the
`/_not-found` document four) and only `/_global-error` carried none: the root layout's not-found
boundary renders `Error404`, `Error404` imported the overlay, so the raster's stylesheet was on the
wire on `/cv` and `/celeste`, which never rendered it. That is why every served route's document
bytes and wire bytes move here, not only `/work`'s: `/work` 493,296 to 492,588 (708 lighter: the
509 of CSS, the 72 of its hero chunk and the document's own references), `/cv` 258,819 to 258,219
(600), `/celeste` 252,339 to 251,741 (598), `/_not-found` 252,226 to 251,594 (632, the 404 chunk's
66 among them), and `/_global-error` 188,760 to 188,763, three bytes the other way, the rebuild
variance on a document that carried none of it.

**What the JavaScript number says.** **Derived.** The component was imported by two files, the
`/work` hero and the 404, and each's chunk is lighter by the import and the element: 72 and 66
gzipped. `gsap` itself is still on every route (`08pj4xkz~kajd.js`, 26,971 gzipped, unchanged):
`HomeLayout`, `WorkHero`, `WorkItem` and the 404 still tween. Nothing else in `.js` moved by a byte.

**Against the Story 2-27 reading.** **Derived.** That reading's after build carried 21 `.js` and 14
`.css` at 2,033,059 on disk and 619,573 gzipped, with every `.css` chunk together at 26,889 on disk
and 9,195 gzipped. Today's after build is 1,554 bytes lighter on disk and 642 gzipped lighter than
that one across the whole directory, and 1,030 on disk and 514 gzipped lighter in `.css`, of which
this story's chunk is 1,021 and 509 by today's before listing; the remainder is the five-byte
rebuild variance between that reading's build and today's before build of the same commit. The
non-3D line still names `/cv`, 118,219 over budget, 84.4 percent, where it was 118,821 over.

### The 2026-09-14 reading, after Story 2-27

**Verbatim**, `node ops/asset-budget.mjs` against build `M-B5DMR-kefOZdZvPSJTN`, written
2026-09-14T02:31:47Z, taken on the story's working tree at `9ea3e6c` plus its own files, before the
commit that carries them: the tool's own dirty-inputs row named five paths (`GlitchText.scss` added,
`glitch-text.scss` deleted, `GlitchText.tsx`, its test and `app/__tests__/anchor-contract.test.ts`
modified) and every one of them is this story's. The before reading is the same command against
build `sKfqE5wMhvYJLoYujExp_` (written 2026-09-14T02:09:26Z at `9ea3e6c`, no measured input dirty),
and it was reproduced to the byte by a second build of `9ea3e6c` in a detached worktree
(`mJ9UNGASZ8DuD0zGCHIBK`) so the per-chunk listing below could be taken on both sides.

| Route | Document bytes | Gzipped on the wire | Carries WebGL | Served | Nature |
|---|---|---|---|---|---|
| `/work` | 20,976 | 493,296 | yes | yes | **Observed** |
| `/cv` | 21,773 | 258,821 | no | yes | **Observed** |
| `/celeste` | 14,065 | 252,342 | no | yes | **Observed** |
| `/_not-found` | 14,498 | 252,229 | no | **no**: Next's own document | **Observed** |
| `/_global-error` | 9,578 | 188,765 | no | **no**: Next's own document | **Observed** |

**The whole build, before and after, and the one chunk that left.** **Observed 2026-09-14**, the
tool's own build table on each side, and every `.next/static/chunks/*.css` and `*.js` weighed with
`zlib.gzipSync` at level 9 (the tool's method) on both builds.

| Figure | Before, `dev` at `9ea3e6c` | After, this story | Delta | Nature |
|---|---|---|---|---|
| Chunks written | 21 `.js`, 14 `.css` | 21 `.js`, 14 `.css` | none | **Observed** |
| Bytes in `.next/static/chunks` | 2,041,116 on disk, 623,059 gzipped | 2,033,059 on disk, 619,573 gzipped | **8,057 on disk, 3,486 gzipped lighter** | **Observed**, tool's build table; **Derived** delta |
| Every `.css` chunk together | 27,196 on disk, 9,282 gzipped | 26,889 on disk, 9,195 gzipped | **307 on disk, 87 gzipped lighter** | **Observed** per chunk; **Derived** total and delta |
| The chunk carrying `.glitch-text` | `0pyhus-guac9o.css`, 1,514 on disk, 617 gzipped, carrying `glitch-loop` and seven `text-shadow` | `0oduorbtnamoz.css`, 1,207 on disk, 530 gzipped, carrying one `@keyframes glitch-text-arrive` | 307 on disk, 87 gzipped lighter: the whole `.css` movement is this one chunk, and the other thirteen are byte-identical | **Observed** |
| Every `.js` chunk together | 2,013,920 on disk, 613,777 gzipped | 2,006,170 on disk, 610,378 gzipped | **7,750 on disk, 3,399 gzipped lighter** | **Observed** per chunk; **Derived** total and delta |
| The `/`-only client chunk | `0gd8341o2awlf.js`, 16,683 on disk, 6,898 gzipped, carrying `SplitText called before fonts loaded` and the component | `05m6od7kzs7s6.js`, 8,933 on disk, 3,499 gzipped, carrying the component and no `SplitText` mark | 7,750 on disk, 3,399 gzipped lighter: the whole `.js` movement is this one chunk, and the other twenty are byte-identical | **Observed** |
| Narrative chunks the fingerprints hit | 9, 1,368,922 on disk, 420,134 gzipped | 8, 1,352,239 on disk, 413,236 gzipped | 16,683 on disk, 6,898 gzipped lighter: the tool attributes a whole chunk, and the chunk that carried `SplitText` is gone rather than shrunk | **Observed**, the tool's narrative table; **Derived** delta |
| `gsap/SplitText` fingerprint | hits `0gd8341o2awlf.js` (1) | **no chunk**: the tool stopped with "no chunk in this build carries the fingerprint for gsap/SplitText" until the row left `FINGERPRINTS` | | **Observed**, the tool's own refusal, then its fingerprint table with nine rows |

**What the CSS number says, and what it does not.** **Derived.** The loop was 71 lines of source and
its deletion is 87 gzipped bytes, because eight keyframes of near-identical declarations compress
to almost nothing; the honest figure is the one measured, not the one the source suggests. The
story's own additions (the display roles, one two-stop keyframe, the reduced-motion rule) sit in the
same chunk, so 530 gzipped is the whole cost of the rewritten stylesheet and 87 is the net.

**What the JavaScript number says.** **Derived.** `SplitText` and the component that imported it
shared one chunk that only `/` loads, and `/` is `ƒ (Dynamic)` since Story 2-13 reads `Save-Data`,
so the tool's per-route table never saw it on either side (it reads prerendered documents, and
`/` writes none; the 2026-08-29 table attributed the 15,078-byte `SplitText` chunk to `/` because
`/` was prerendered then). The per-chunk listing is what attributes it: the one chunk that changed
lost 7,750 bytes on disk and 3,399 gzipped, which is `SplitText` plus the GSAP scramble, the
`fonts.ready` gate and the `useReduceMotion` subscription the component no longer carries, and no
other chunk moved by a byte. `gsap` itself is still on every route (`08pj4xkz~kajd.js`, 26,971
gzipped, unchanged): `HomeLayout`, `WorkHero`, `WorkItem` and the 404 still tween.

**Against the 2026-08-29 reading.** **Derived.** That build carried 20 `.js` and 11 `.css` at
2,025,358 on disk and 618,713 gzipped (§ The build this reading was taken from), with the
`SplitText` chunk at 15,078 on disk and 6,162 gzipped attributed to `/` (§ The narrative bundle,
the 2026-08-29 table) and the narrative bundle at 426,441 gzipped. Today's after build is 7,701
bytes heavier on disk and 860 gzipped heavier than that one across the whole directory, over
seven stories that added `/cv`, the Suite Directory, the skip controls, the premise block and
three stylesheets, and the narrative bundle is 13,205 gzipped lighter, of which the `SplitText`
chunk is 6,162 by that reading's figure and 6,898 by today's. § Reading one's "Stylesheets" line,
3,063 gzipped on `/celeste` on 2026-08-29, reads 4,150 on `/cv` on both sides of this story, which
is a different route and not a comparison.

**Against the 2026-09-12 reading.** **Derived.** `/work` reads 493,296 against 493,301, `/cv`
258,821 against 258,870, `/celeste` 252,342 against 252,315, `/_not-found` 252,229 against 252,203
and `/_global-error` 188,765 against 188,763: every served route within 50 bytes on the wire, the
rebuild variance § Stated limits records plus Story 2-26's focus rule landing in between, and none
of it this story's, whose only route is the one the tool cannot see. The narrative bundle reads
413,236 across 8 chunks against 419,736 across 9; the deferred share reads 118,881 against 125,381,
the `SplitText` chunk having been counted as deferred on that reading because no prerendered
document referenced it. The non-3D line still names `/cv`, 118,821 over budget, 84.9 percent,
where it was 118,870 over.

### The 2026-09-12 reading, after Story 2-20

**Verbatim**, `node ops/asset-budget.mjs` against build `SWgIhyUw5RIK9pXx1sbr7`, taken on the
story's working tree at `118423b` plus its own files, before the commit that carries them: the
tool's own dirty-inputs row named forty-five paths, thirty-nine of them the deleted `public/fonts/`
binaries, one the deleted `app/scss/_fonts.scss`, and five modified sources, and every one of them is
this story's. This is the second build of the day: the first, `VjZTbSCHSQ0bd6u8DlMd8`, was read
before the tool's two preload sentences were reworded and differed from this one by one to two
bytes on three routes (`/cv` 258,868, `/celeste` 252,317, `/_not-found` 252,204), which is the
rebuild variance § Stated limits records and not a change in what was measured.

| Route | Document bytes | Gzipped on the wire | Carries WebGL | Served | Nature |
|---|---|---|---|---|---|
| `/work` | 20,976 | 493,301 | yes | yes | **Observed** |
| `/cv` | 21,773 | 258,870 | no | yes | **Observed** |
| `/celeste` | 14,065 | 252,315 | no | yes | **Observed** |
| `/_not-found` | 14,498 | 252,203 | no | **no**: Next's own document | **Observed** |
| `/_global-error` | 9,578 | 188,763 | no | **no**: Next's own document | **Observed** |

**Every row that renders the layout fell by the two preloads and a little more.** **Derived.**
Against the 2026-09-11 reading, `/work` is 31,994 gzipped bytes lighter on the wire, `/cv` 31,994,
`/celeste` 32,001 and `/_not-found` 32,003. The two font preloads came to 31,239 gzipped on every
reading since 2026-08-29, and each of those four documents is exactly 1,122 bytes smaller, which is
the four `<link rel=preload>` elements Next emitted for two files (DW-39) leaving the markup; the
remaining 755 to 764 gzipped bytes per route is the document's own share of that and is stated
rather than attributed further. `/_global-error` fell 25 on the wire and 108 in the document: Next's
global error boundary replaces the root layout, so it never carried the preloads, and that movement
is the build writing the shared graph differently. The non-3D line still names `/cv`, now 118,870
over budget, 84.9 percent, where it was 150,864 over, 107.8 percent, on 2026-09-11. **The preload
row of § Reading one reads 1,362 and lists three stylesheets**, where it read 32,601 and led with two
font binaries; the itemised table this file carries in that section is still the 2026-08-29 one and
is left as the reading its heading names.

### The 2026-09-11 reading, after Story 2-17

**Verbatim**, `node ops/asset-budget.mjs` against build `k5AIUPv2f6fm-_ENAZc0_`, taken on the
story's working tree at `c782d79` plus its own files, before the commit that carries them: the
tool's own dirty-inputs row named thirteen paths and every one of them is this story's.

| Route | Document bytes | Gzipped on the wire | Carries WebGL | Served | Nature |
|---|---|---|---|---|---|
| `/work` | 22,098 | 525,295 | yes | yes | **Observed** |
| `/cv` | 22,895 | 290,864 | no | yes | **Observed** |
| `/celeste` | 15,187 | 284,316 | no | yes | **Observed** |
| `/_not-found` | 15,620 | 284,206 | no | **no**: Next's own document | **Observed** |
| `/_global-error` | 9,686 | 188,788 | no | **no**: Next's own document | **Observed** |

**One row is gone and no column moved.** **Derived.** `/recommendation` is absent from the
prerendered set: Story 2-17 deleted its redirect row and the stub behind it, so there is no document
to weigh and no redirect for the `Served` column to report, and the prerendered set is five where it
was six. `.next/routes-manifest.json` carries one redirect, `/projects`, whose source is not a
document, so the `Served` column reads **yes** for every route a visitor can request and **no** only
for Next's own two. The `/_not-found` document is what `/recommendation` answers now, and it is the
row that grew most: 13,297 to 15,620 bytes, which is the second exit, the wrapper around both and
the docblock-free markup the header's list renders, on a route that had one link.

**The other rows grew by a few hundred bytes each over one story, and the growth is stated rather
than attributed.** `/work` grew 512 document bytes, `/cv` 512 and `/celeste` 621 against the
2026-09-10 reading. `/celeste` carries one new tag, the `robots` meta, which is 39 bytes of the 621;
`Navbar.tsx` is unchanged in markup and neither `/work` nor `/cv` renders a line this story wrote,
so the rest is the build writing the shared graph differently and is not something one reading can
pin to a file. **The CSS chunk count went 13 to 14.** Which chunk is new cannot be read off one
build either. What can be read is that `_not-found.html` references six stylesheets and one of them
is `06.b3.34agec_.css`, 463 bytes, the only chunk in the build carrying a `.navbar` rule
(**observed 2026-09-11** by grepping the chunk directory), which is consistent with `Error404.tsx`
importing `DESTINATIONS` from `Navbar.tsx` and that module carrying `navbar.scss` as a side effect.
Nothing new is fetched on any route by that reference: the 404 renders the header and had that
stylesheet on the page already through the layout.

### The 2026-09-10 reading, after Story 2-16

**Verbatim**, `node ops/asset-budget.mjs` against build `Tg4Y3fYLyWXDQsTh2jZrv`.

| Route | Document bytes | Gzipped on the wire | Carries WebGL | Served | Nature |
|---|---|---|---|---|---|
| `/work` | 21,586 | 524,985 | yes | yes | **Observed** |
| `/cv` | 22,383 | 290,555 | no | yes | **Observed** |
| `/celeste` | 14,566 | 283,980 | no | yes | **Observed** |
| `/recommendation` | 14,494 | 283,746 | no | **no**: 308 to `/pdf/recommendation-letter.pdf` | **Observed** |
| `/_not-found` | 13,297 | 283,661 | no | **no**: Next's own document | **Observed** |
| `/_global-error` | 9,686 | 188,789 | no | **no**: Next's own document | **Observed** |

**One column moved and one row is new.** **Derived.** `/cv` flips from **no** to **yes** in the
`Served` column: it answered a 308 to `/pdf/cv.pdf` in both readings below and Story 2-16 removed
that redirect, so its document is one a visitor can now load. Its own weight grew from 14,556 to
22,383 bytes, which is the intro block plus the four accordion entries the page now renders, and its
wire total from 283,718 to 290,555, which is those bytes plus the stylesheet the intro block adds.
**It is now the heaviest non-3D route a visitor can load**, `/` having left the prerendered set for
the reason § The build this reading was taken from gives.

**Every other row's delta spans four stories, not this one, and the arithmetic says so.** **Stated
rather than attributed**, because the reading below it was taken at commit `c887cb03` during Story
2-12, and Stories 2-13, 2-14, 2-15 and 2-16 have landed since. No reading was taken in between, so
nothing here can say which of the four moved a byte.

`/work` **grew** by 83 document bytes, from 21,503 to 21,586, and by 208 on the wire. **Story
2-16's own contribution to that route runs the other way and is 32 bytes**: the open entry no longer
ships `style="height:0;overflow:hidden"`, which is a 32-character attribute, and `work.html` in this
build carries it three times where it carried it four. **Observed 2026-09-10** by counting the
literal in `.next/server/app/work.html`. So this story took 32 bytes off and the document is 83
bytes larger, which leaves **115 bytes of growth belonging to the three stories in between**, Story
2-15's header reshape among them. An earlier draft of this paragraph credited the whole 83 to the
`WorkItem` line and had the direction backwards; the figure is a growth and one line that deletes an
attribute cannot produce one.

`/celeste`, `/recommendation`, `/_not-found` and `/_global-error` are each within a few hundred
bytes of the 2026-09-07 reading, over the same four-story span, and none of them renders anything
this story wrote.

**The CSS chunk count went 11 to 13 over that same span, and one of the two is this story's.**
`components/organisms/CvIntro/CvIntro.scss` compiles to `0cpliri6-1~qx.css`, 1,376 bytes, which is
the only chunk in the build carrying a `.cv-intro` rule, and `cv.html` references one stylesheet
more than `work.html` does. **Observed 2026-09-10** by grepping the chunk directory. The other is
not this story's and is not attributed: Next chunks CSS per entry rather than per source file, so
the count does not map one-to-one onto stylesheets added, and Story 2-13 alone added two source
files after the reading below was taken.

The redirect is `next.config.js`, and the tool reads it from `.next/routes-manifest.json` rather
than from that file, so the column answers what the build does rather than what the source says.
That is what makes the `/cv` flip a measurement of the removal rather than a restatement of it.

### The 2026-09-07 reading, after Story 2-12

**Verbatim**, `node ops/asset-budget.mjs` against build `rxNy6yw47ecyqZzmT1Jzp`.

| Route | Document bytes | Gzipped on the wire | Carries WebGL | Served | Nature |
|---|---|---|---|---|---|
| `/work` | 21,503 | 524,777 | yes | yes | **Observed** |
| `/projects` | 30,803 | 522,686 | yes | yes | **Observed** |
| `/` | 32,447 | 295,154 | no | yes | **Observed** |
| `/celeste` | 14,782 | 283,968 | no | yes | **Observed** |
| `/recommendation` | 14,710 | 283,732 | no | **no**: 308 to `/pdf/recommendation-letter.pdf` | **Observed** |
| `/cv` | 14,556 | 283,718 | no | **no**: 308 to `/pdf/cv.pdf` | **Observed** |
| `/_not-found` | 13,513 | 283,656 | no | **no**: Next's own document | **Observed** |
| `/_global-error` | 9,686 | 188,788 | no | **no**: Next's own document | **Observed** |

**One column moved and one number moved for a reason this story cannot claim.** **Derived.** `/`
flips from **yes** to **no** in the WebGL column, which is Story 2-12's result and the one the
acceptance criterion is about. Its wire total falls from 625,823 to 295,154, which is **not** a
clean before and after: the 2026-08-29 build predates Stories 2-9 and 2-11, and `/`'s own document
grew from 14,774 to 32,447 bytes over that span as the premise block and the Suite Directory landed
on it. `/projects` grew for the same reason. Every other row is within a few bytes of where it was.

### The 2026-08-29 reading, superseded and kept

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

**The ten are gone, and the table above is the 2026-08-29 reading kept as taken.** **Observed
2026-09-12**, `node ops/asset-budget.mjs` against build `SWgIhyUw5RIK9pXx1sbr7`, verbatim:

| Family | Formats | Bytes on disk, all formats | Bytes gzipped, all formats | Reached | Nature |
|---|---|---|---|---|---|
| Bricolage Grotesque | woff2 | 58,992 | 59,030 | yes | **Observed** |
| Geist | woff2 | 24,124 | 24,152 | yes | **Observed** |
| Geist Mono | woff2 | 11,284 | 11,307 | yes | **Observed** |
| **Total** |  | **94,400** | **94,489** |  | **Observed** |
| Of that, reached by no rule |  | 0 | 0 |  | **Derived** |

0 of the 3 families the built CSS declares are reached by no rule. Story 2-20 deleted
`app/scss/_fonts.scss` with its ten blocks, the `@forward` that loaded it and the thirty-nine
binaries under `public/fonts/`, and retargeted `--confillia-normal` onto the display role with
`font-stretch: 75%` set by hand at its two call sites, so `font-family: var(--confillia-normal)` now
resolves to `Bricolage Grotesque`, `Archivo`, `system-ui`, `sans-serif` and the declared set is the
contract's three. The 962,952 bytes on disk and 692,644 gzipped the 2026-08-29 reading found
standing are 0 and 0, and `.next/static/media` holds three woff2 files. The resolver's list gained
`var(--f-display)` and `var(--f-mono)` since the 2026-08-29 reading, which are the Epic 2 rebuilds
naming roles directly, and lost nothing it is not supposed to have lost. Pending Operator action 4
is completed by this paragraph.

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

**Amended 2026-09-07 by Story 2-12, and only for `/`.** **Derived**, from the 2026-09-07 reading
above. The homepage's document now references no chunk carrying a WebGL fingerprint, so on that one
route the sentence "if the narrative is not loaded, nothing on the page is missing" is a claim a
test can and does make: `tests/e2e/narrative.pw.ts` aborts the narrative's request outright and
asserts the premise, the Suite Directory and the footer still render and `/#suite` still moves
focus. Across the build the rule still does not hold: 307,632 of 426,441 gzipped narrative bytes,
72.1 percent, are on a document at first paint, and 56,582 of them are on routes with no 3D at all.
Pending Operator action 6 stays open on that basis rather than closing on the homepage's result.

**Amended 2026-09-24 by DW-36's package, on the Operator ruling of that day: Rule 1 holds.**
**Derived**, from the 2026-09-24 reading under § Every route. Of the 619,351 gzipped bytes the
fingerprints attribute to the narrative, 592,380 are referenced by no document and loaded on demand:
both WebGL chunks, the post-processing chunk, and `ScrollTrigger`, which now loads with the `/work`
torus behind its boundary. The other 26,971 is GSAP's core on `/work` and `/cv`, which the Work
item's disclosure tween uses; `EXPERIENCE.md` § Secondary surfaces names that tween, and the dated
note on `EXPERIENCE.md`'s budget row says it is not narrative. The tool attributes by library, not
by use, so its findings line still counts those bytes as narrative at first paint, and this
paragraph is where the difference is stated. `lenis` is gone, `/`, `/celeste` and the 404 reference
no fingerprinted library at all, and `tests/e2e/narrative.pw.ts` holds that set on every route.
Pending Operator action 6 is completed by this paragraph.

**Rule 4 is the one the preload figures test.** `EXPERIENCE.md:956-957` says "Preload only what the
non-3D path needs." The two preloaded faces cost 31,239 gzipped bytes on a route that is already
143,945 over budget, and at least 19,936 of those are a family no rule can reach. That is a finding
about the preloads, recorded above, and Story 2-2 changes neither of them.

**Amended 2026-09-12 by Story 2-20: Rule 4 holds on the font side, and holds by deletion.** Both
preloads are gone from `app/layout.tsx` and nothing replaced them, so the document preloads no font
at all and the § Reading one preload row is three stylesheets at 1,362 gzipped. A preload of a
contract face was considered and refused: `GlitchText.tsx:37-42` gates `SplitText` on
`document.fonts.ready`, so the old preload bought latency rather than the correctness its comment
claimed, and a contract preload would be an optimisation with no measurement behind it that also
puts `contracts/` in a scanned source (`app/__tests__/anchor-contract.test.ts`). If the display face
is ever observed arriving late, it is one line and one measurement. `tests/e2e/narrative.pw.ts`
pins the distinct preloaded-face count on `/` at zero, against a preload planted into the head.
Pending Operator action 2 is completed by this paragraph.

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
| gsap/SplitText | `SplitText called before fonts loaded` | no | `01l6rdvnhwq_7.js` (1) | **Observed**. **Row deleted from `FINGERPRINTS` on 2026-09-14**, see below |
| lenis | `lenisVersion` | no | `0nwet2hiefxan.js` (1) | **Observed** |

**The `gsap/SplitText` row left `FINGERPRINTS` on 2026-09-14, with Story 2-27.** **Decision**, with
its reason: `GlitchText` was the library's only importer, and the story rebuilt it as
server-rendered spans over one CSS keyframe, so no chunk in the build carries the mark any more. A
mark that matches nothing stops the run rather than reporting the library absent (`proveFingerprints`),
which is exactly what happened on the first run against the story's build: "no chunk in this build
carries the fingerprint for gsap/SplitText ... Fix the table, do not widen it". The row is deleted
rather than loosened, the pin in `ops/__tests__/asset-budget.test.ts` moved with it in the same
commit, and the table above is kept as the 2026-08-29 reading it is. Nine fingerprints since; the
chunk it used to hit is measured in § Every route's 2026-09-14 reading.

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

### The 2026-09-24 run, after the DW-113 home-surface package

**Verbatim**, `node ops/asset-budget.mjs` against build `RT9WREDML0Cp4cctih6td`. § Every route's
2026-09-24 reading after the DW-113 package and this section were filed from this run.

- The narrative bundle is 619,351 bytes gzipped across 5 chunks, against an estimate of 300,000 to
  450,000. That is 169,351 over the top of the range.
- 592,380 bytes of that is genuinely deferred: `0x9hgoafoipaz.js`, `0-742gw60ue7o.js`,
  `031y-gd1885yp.js`, `0te7gr59z3e7w.js` is referenced by no prerendered document. The other 26,971
  is on a document at first paint, so the `next/dynamic` boundaries defer far less than their shape
  suggests.
- The non-3D path is over budget as measured: 231,168 against 140,000, 91,168 over, on route
  `/work`. The largest single contributor is `.next/static/chunks/1416ak9gh4br1.js` at 70,572.
- On the budget's own decomposition it is inside: 103,500 against 140,000, 36,500 of margin. That
  decomposition has no line for the 221,327 of JavaScript or the 830 of preloads the document
  actually carries.

**One line moved by a byte, and one by the split.** **Observed**, against the DW-36 run below. The
non-3D line reads 231,168 where it read 231,167. On the decomposition, HTML and critical CSS read
9,011 where they read 8,984 and `/work`'s JavaScript 221,327 where it read 221,353: the attribute in
the document, the `::before` rule in the Plate mark's stylesheet, and the component's code lighter
by the child it no longer renders. The narrative lines are unchanged to the byte.

### The 2026-09-24 run, after DW-36's package

**Verbatim**, `node ops/asset-budget.mjs` against build `ysPv_iPVOqc9Sc90vXp_1`. § Every route's
2026-09-24 reading and this section were filed from this run; every other section in this file is
still the reading its own heading names.

- The narrative bundle is 619,351 bytes gzipped across 5 chunks, against an estimate of 300,000 to
  450,000. That is 169,351 over the top of the range.
- 592,380 bytes of that is genuinely deferred: `0x9hgoafoipaz.js`, `0-742gw60ue7o.js`,
  `031y-gd1885yp.js`, `0te7gr59z3e7w.js` is referenced by no prerendered document. The other 26,971
  is on a document at first paint, so the `next/dynamic` boundaries defer far less than their shape
  suggests.
- The non-3D path is over budget as measured: 231,167 against 140,000, 91,167 over, on route
  `/work`. The largest single contributor is `.next/static/chunks/1416ak9gh4br1.js` at 70,572.
- On the budget's own decomposition it is inside: 103,473 against 140,000, 36,527 of margin. That
  decomposition has no line for the 221,353 of JavaScript or the 830 of preloads the document
  actually carries.

**Four lines moved and one left.** **Observed**, the tool's tables on each side, against build
`h9ihC9KUuEQ39XtLfRn2X` at `9bf4f20`. The narrative total fell 15,478, from 634,829 across 7 chunks:
`lenis` (10,201) is gone, and so is the torus's own chunk (5,117), which the tool attributed to
`three-stdlib` for the orbit controls in it. The torus and its binding now ride in the chunk the
tool attributes to `ScrollTrigger` (`0te7gr59z3e7w.js`, 17,765, where `ScrollTrigger` alone was
17,373). The post-processing chunk, which also carries the wave's own code, is 342 lighter with the
drag gone; GSAP's core is `08pj4xkz~kajd.js` again, the file the 2026-09-07 reading named, 176
lighter than the chunk that carried it before; and the two WebGL copies are 17 lighter each. The
deferred share rose from 580,108 to 592,380 by that `ScrollTrigger` chunk,
now loaded on demand; the 26,971 left at first paint is GSAP's core, the Work item's (§ What this
reads against the budget's own rules says why that is not the narrative, and why the line above
still counts it). The non-3D line still names `/work`, 22,597 lighter. The line about 1,215,179
orphaned bytes under `public/assets/home/` is gone, because the files are.

### The 2026-09-23 run, after Story 2-22

**Verbatim**, `node ops/asset-budget.mjs` against build `37FF9P8STslG2tLdxZeOq`. § Every route's
2026-09-23 reading after Story 2-22 and this section were filed from this run; every other section
in this file is still the reading its own heading names.

- The narrative bundle is 634,829 bytes gzipped across 7 chunks, against an estimate of 300,000 to
  450,000. That is 184,829 over the top of the range.
- 580,108 bytes of that is genuinely deferred: `0vynw~tou1f72.js`, `0w~ig71whmz0p.js`,
  `10mmj2_fz7c58.js`, `0f-49j-pqi~h-.js` is referenced by no prerendered document. The other 54,721
  is on a document at first paint, so the `next/dynamic` boundaries defer far less than their shape
  suggests.
- The non-3D path is over budget as measured: 253,763 against 140,000, 113,763 over, on route
  `/work`. The largest single contributor is `.next/static/chunks/1416ak9gh4br1.js` at 70,572.
- On the budget's own decomposition it is inside: 103,547 against 140,000, 36,453 of margin. That
  decomposition has no line for the 243,875 of JavaScript or the 830 of preloads the document
  actually carries.
- 1,215,179 bytes under `public/assets/home/` are reachable from no module anything imports:
  `environment_D.hdr`, `gem.glb`, `gem.gltf`, `gem_data.bin`. They are committed, they are served,
  and no route asks for them.

**Two lines moved, each by the global stylesheet's lighter bytes.** **Observed**, the tool's tables on
each side: the non-3D path, 253,877 to 253,763, and the decomposition, 103,661 to 103,547, its HTML
and critical CSS line 9,172 to 9,058. Nothing else in the list moved.

**Fix round 1's re-read**, against build `3ILavmsOL7v4MHooMZ6MG`, moved the same two lines by 1 byte of
rebuild variance, the non-3D path to 253,764 and the decomposition to 103,548, and nothing else in the
list: the stylesheet the round changed is on no prerendered document.

### The 2026-09-23 run, after Story 2-34

**Verbatim**, `node ops/asset-budget.mjs` against build `zZ7f-R4Ufn4KQJqPQZi4Q`. § Every route's
2026-09-23 reading after Story 2-34 and this section were filed from this run; every other section
in this file is still the reading its own heading names.

- The narrative bundle is 634,829 bytes gzipped across 7 chunks, against an estimate of 300,000 to
  450,000. That is 184,829 over the top of the range.
- 580,108 bytes of that is genuinely deferred: `0vynw~tou1f72.js`, `0w~ig71whmz0p.js`,
  `10mmj2_fz7c58.js`, `0f-49j-pqi~h-.js` is referenced by no prerendered document. The other 54,721
  is on a document at first paint, so the `next/dynamic` boundaries defer far less than their shape
  suggests.
- The non-3D path is over budget as measured: 253,879 against 140,000, 113,879 over, on route
  `/work`. The largest single contributor is `.next/static/chunks/1416ak9gh4br1.js` at 70,572.
- On the budget's own decomposition it is inside: 103,663 against 140,000, 36,337 of margin. That
  decomposition has no line for the 243,875 of JavaScript or the 830 of preloads the document
  actually carries.
- 1,215,179 bytes under `public/assets/home/` are reachable from no module anything imports:
  `environment_D.hdr`, `gem.glb`, `gem.gltf`, `gem_data.bin`. They are committed, they are served,
  and no route asks for them.

**Two lines moved, each by the global stylesheet's 11 gzipped bytes.** **Observed**, the tool's
tables on each side: the non-3D path, 253,890 to 253,879, and the decomposition, 103,674 to 103,663,
its HTML and critical CSS line 9,185 to 9,174. Nothing else in the list moved.

### The 2026-09-23 run, after Story 2-33

**Verbatim**, `node ops/asset-budget.mjs` against build `3khZaamuAoVzhg3IZI1ZP`. § Every route's
2026-09-23 reading after Story 2-33 and this section were filed from this run; every other section
in this file is still the reading its own heading names.

- The narrative bundle is 634,829 bytes gzipped across 7 chunks, against an estimate of 300,000 to
  450,000. That is 184,829 over the top of the range.
- 580,108 bytes of that is genuinely deferred: `0vynw~tou1f72.js`, `0w~ig71whmz0p.js`,
  `10mmj2_fz7c58.js`, `0f-49j-pqi~h-.js` is referenced by no prerendered document. The other 54,721
  is on a document at first paint, so the `next/dynamic` boundaries defer far less than their shape
  suggests.
- The non-3D path is over budget as measured: 253,886 against 140,000, 113,886 over, on route
  `/work`. The largest single contributor is `.next/static/chunks/1416ak9gh4br1.js` at 70,572.
- On the budget's own decomposition it is inside: 103,670 against 140,000, 36,330 of margin. That
  decomposition has no line for the 243,875 of JavaScript or the 830 of preloads the document
  actually carries.
- 1,215,179 bytes under `public/assets/home/` are reachable from no module anything imports:
  `environment_D.hdr`, `gem.glb`, `gem.gltf`, `gem_data.bin`. They are committed, they are served,
  and no route asks for them.

**Two figures in this list moved for reasons the reading above states.** **Observed**, the tool's
tables on each side. The narrative total is 223,974 heavier because the three/R3F library is emitted
once per dynamic boundary (DW-120), and the deferred share is 580,108 where it was 118,881 because
`/work`'s document references no WebGL chunk; the 54,721 left at first paint is `gsap`,
`ScrollTrigger` and `lenis`, on every route (DW-36). The route the non-3D line names moved from `/cv`
to `/work`, which left the 3D set.

### The 2026-09-23 run, after Story 2-32

**Verbatim**, `node ops/asset-budget.mjs` against build `N4qdBF98aHF4vMMIrE44u`. § Every route's
2026-09-23 reading after Story 2-32 and this section were filed from this run; every other section
in this file is still the reading its own heading names.

- The narrative bundle is 410,855 bytes gzipped across 7 chunks, against an estimate of 300,000 to
  450,000. That is inside the range, 39,145 below the top.
- 118,881 bytes of that is genuinely deferred: `10mmj2_fz7c58.js`, `0d3ymyos8iowp.js`,
  `05e6tciymra6v.js` is referenced by no prerendered document. The other 291,974 is on a document at
  first paint, so the `next/dynamic` boundaries defer far less than their shape suggests.
- The non-3D path is over budget as measured: 251,906 against 140,000, 111,906 over, on route `/cv`.
  The largest single contributor is `.next/static/chunks/1416ak9gh4br1.js` at 70,572.
- On the budget's own decomposition it is inside: 103,948 against 140,000, 36,052 of margin. That
  decomposition has no line for the 241,617 of JavaScript or the 830 of preloads the document
  actually carries.
- 1,215,179 bytes under `public/assets/home/` are reachable from no module anything imports:
  `environment_D.hdr`, `gem.glb`, `gem.gltf`, `gem_data.bin`. They are committed, they are served,
  and no route asks for them.

**One figure in this list moved for a reason the reading above states.** **Observed**, the tool's
narrative table on each side. The narrative bundle is 1,867 lighter because the chunk the tool
attributes to Lenis is the root layout's, and it carried the logo's `next/image` until this story;
the attribution overstates in the direction § Stated limits names, and the bytes that left were never
Lenis's.

### The 2026-09-23 run, after Story 2-30

**Verbatim**, `node ops/asset-budget.mjs` against build `9xKq1w4OnW0Bc5Jf53GQ1`. § Every route's
2026-09-23 reading after Story 2-30 and this section were filed from this run; every other section
in this file is still the reading its own heading names.

- The narrative bundle is 412,722 bytes gzipped across 7 chunks, against an estimate of 300,000 to
  450,000. That is inside the range, 37,278 below the top.
- 118,881 bytes of that is genuinely deferred: `10mmj2_fz7c58.js`, `0d3ymyos8iowp.js`,
  `05e6tciymra6v.js` is referenced by no prerendered document. The other 293,841 is on a document at
  first paint, so the `next/dynamic` boundaries defer far less than their shape suggests.
- The non-3D path is over budget as measured: 257,492 against 140,000, 117,492 over, on route `/cv`.
  The largest single contributor is `.next/static/chunks/1416ak9gh4br1.js` at 70,572.
- On the budget's own decomposition it is inside: 103,927 against 140,000, 36,073 of margin. That
  decomposition has no line for the 247,224 of JavaScript or the 830 of preloads the document
  actually carries.
- 1,215,179 bytes under `public/assets/home/` are reachable from no module anything imports:
  `environment_D.hdr`, `gem.glb`, `gem.gltf`, `gem_data.bin`. They are committed, they are served,
  and no route asks for them.

**Two figures in this list moved for reasons the reading above states.** **Observed**, the tool's
narrative and preload tables on each side. The narrative bundle is one chunk fewer because GSAP and
ScrollTrigger share one now, and 511 lighter for the same reason. The preloads `/cv` carries rose
from 558 to 830: the 404's stylesheet (529) and the display entrance's (301), both on every route
through the root layout's not-found boundary, where the 2023 404's one stylesheet was 558.

### The 2026-09-23 run, after Story 2-31

**Verbatim**, `node ops/asset-budget.mjs` against build `0KxutAmqMQuDuV6dR2omk`. § Every route's
2026-09-23 reading after Story 2-31 and this section were filed from this run; every other section
in this file is still the reading its own heading names.

- The narrative bundle is 413,233 bytes gzipped across 8 chunks, against an estimate of 300,000 to
  450,000. That is inside the range, 36,767 below the top.
- 118,881 bytes of that is genuinely deferred: `10mmj2_fz7c58.js`, `0d3ymyos8iowp.js`,
  `05e6tciymra6v.js` is referenced by no prerendered document. The other 294,352 is on a document at
  first paint, so the `next/dynamic` boundaries defer far less than their shape suggests.
- The non-3D path is over budget as measured: 258,438 against 140,000, 118,438 over, on route `/cv`.
  The largest single contributor is `.next/static/chunks/1416ak9gh4br1.js` at 70,572.
- On the budget's own decomposition it is inside: 103,577 against 140,000, 36,423 of margin. That
  decomposition has no line for the 248,792 of JavaScript or the 558 of preloads the document
  actually carries.
- 1,215,179 bytes under `public/assets/home/` are reachable from no module anything imports:
  `environment_D.hdr`, `gem.glb`, `gem.gltf`, `gem_data.bin`. They are committed, they are served,
  and no route asks for them.

**One figure in this list moved for a reason the reading above does not state.** **Observed**, the
tool's itemised preload table on each side. The preloads `/cv` carries fell from 826 to 558 bytes
because `0fmvj6dex6cl5.css`, the `HudLabel` stylesheet, 268 gzipped, is no longer among them: `/cv`
preloaded the atom's stylesheet without ever rendering the atom, and the atom is gone. The
stylesheets the document does reference grew from 4,150 to 4,367, the row's and the label's among
them.

### The 2026-09-21 run, after Story 2-29

**Verbatim**, `node ops/asset-budget.mjs` against build `wyW2OiV9VvlHmhcctT2lp`. § Every route's
2026-09-21 reading after Story 2-29 and this section were filed from this run; every other section
in this file is still the reading its own heading names.

- The narrative bundle is 413,079 bytes gzipped across 8 chunks, against an estimate of 300,000 to
  450,000. That is inside the range, 36,921 below the top.
- 118,881 bytes of that is genuinely deferred: `10mmj2_fz7c58.js`, `0d3ymyos8iowp.js` and
  `05e6tciymra6v.js` are referenced by no prerendered document. The other 294,198 is on a document
  at first paint, so the `next/dynamic` boundaries defer far less than their shape suggests.
- The non-3D path is over budget as measured: 258,263 against 140,000, 118,263 over, on route `/cv`.
  The largest single contributor is `.next/static/chunks/1416ak9gh4br1.js` at 70,572.
- On the budget's own decomposition it is inside: 103,298 against 140,000, 36,702 of margin. That
  decomposition has no line for the JavaScript or the preloads the document actually carries.
- 1,215,179 bytes under `public/assets/home/` are reachable from no module anything imports:
  `environment_D.hdr`, `gem.glb`, `gem.gltf`, `gem_data.bin`. They are committed, they are served,
  and no route asks for them.

**Nothing in this list is this story's, and that is the finding.** **Derived.** The surface Story
2-29 rebuilt is `/`, which is a dynamic route with no prerendered document, so every figure the
tool derives from documents is blind to it; the two chunks that moved are weighed in the reading
above instead. `components/atoms/ScanlineOverlay/ScanlineOverlay.tsx` also leaves the tool's
"imported by nothing" list here, which Story 2-28 predicted: it is imported by `HomeLayout.tsx` now.

**DW-57's `ops/asset-budget.md` half is discharged by this run.** **Decision.** That entry records
that this file's fingerprint tables, per-route tables and 2026-09-07 finding all name `/projects`,
a route Story 2-14 redirected on 2026-09-07, and that the honest correction is a re-run against the
current tree with a dated paragraph rather than an edit of readings that were true when they were
taken. This section and the reading above are that re-run: neither names `/projects`, because no
such route exists in either build, and every dated section that does name it is left exactly as it
was taken. The `TorusKnotCanvas` half of Pending Operator action 6 is struck below by the same
arithmetic, with no measurement needed: the file was deleted with the route.

### The 2026-09-14 run, after Story 2-28

**Verbatim**, `node ops/asset-budget.mjs` against build `HMUMVY1c3c8TaxM8ZpHFr`. § Every route's
2026-09-14 reading after Story 2-28 and this section were filed from this run; every other section
in this file is still the reading its own heading names.

- The narrative bundle is 413,164 bytes gzipped across 8 chunks, against an estimate of 300,000 to
  450,000. That is inside the range, 36,836 below the top.
- 118,881 bytes of that is genuinely deferred: `10mmj2_fz7c58.js`, `0d3ymyos8iowp.js`,
  `05e6tciymra6v.js` is referenced by no prerendered document. The other 294,283 is on a document at
  first paint, so the `next/dynamic` boundaries defer far less than their shape suggests.
- The non-3D path is over budget as measured: 258,219 against 140,000, 118,219 over, on route `/cv`.
  The largest single contributor is `.next/static/chunks/1416ak9gh4br1.js` at 70,572.
- On the budget's own decomposition it is inside: 103,301 against 140,000, 36,699 of margin. That
  decomposition has no line for the 248,581 of JavaScript or the 826 of preloads the document
  actually carries.
- 1,215,179 bytes under `public/assets/home/` are reachable from no module anything imports:
  `environment_D.hdr`, `gem.glb`, `gem.gltf`, `gem_data.bin`. They are committed, they are served,
  and no route asks for them.

**Seventy-two gzipped bytes off the narrative bundle, and 509 off every served route's stylesheets.**
**Derived.** The bundle moved by the `/work` hero chunk alone, which the `three-stdlib` fingerprint
attributes whole and which lost the overlay's import. The `.css` movement is not in this list because
the tool's findings are about JavaScript; it is the one-chunk deletion the reading above weighs, and
it was on the wire on every served route through the not-found boundary. Everything else in this
list is the Story 2-27 run to within the rebuild variance.

### The 2026-09-14 run, after Story 2-27

**Verbatim**, `node ops/asset-budget.mjs` against build `M-B5DMR-kefOZdZvPSJTN`. § Every route's
2026-09-14 reading, the fingerprint note under § Method and this section were filed from this run;
every other section in this file is still the reading its own heading names.

- The narrative bundle is 413,236 bytes gzipped across 8 chunks, against an estimate of 300,000 to
  450,000. That is inside the range, 36,764 below the top.
- 118,881 bytes of that is genuinely deferred: `10mmj2_fz7c58.js`, `0d3ymyos8iowp.js`,
  `05e6tciymra6v.js` is referenced by no prerendered document. The other 294,355 is on a document at
  first paint, so the `next/dynamic` boundaries defer far less than their shape suggests.
- The non-3D path is over budget as measured: 258,821 against 140,000, 118,821 over, on route `/cv`.
  The largest single contributor is `.next/static/chunks/1416ak9gh4br1.js` at 70,572.
- On the budget's own decomposition it is inside: 103,328 against 140,000, 36,672 of margin. That
  decomposition has no line for the 248,647 of JavaScript or the 1,335 of preloads the document
  actually carries.
- 1,215,179 bytes under `public/assets/home/` are reachable from no module anything imports:
  `environment_D.hdr`, `gem.glb`, `gem.gltf`, `gem_data.bin`. They are committed, they are served,
  and no route asks for them.

**Eight narrative chunks where every run since 2026-08-29 read nine or ten.** **Derived.** The chunk
that carried `gsap/SplitText` is gone with its importer, and the tool's deferred list is one name
shorter for the same reason: that chunk was "referenced by no prerendered document" only because
`/`, the one route that loaded it, is dynamic and writes none. Everything else in this list is the
2026-09-12 run to within the rebuild variance.

### The 2026-09-12 run, after Story 2-20

**Verbatim**, `node ops/asset-budget.mjs` against build `SWgIhyUw5RIK9pXx1sbr7`. § Every route, the
faces table under § The faces the built CSS declares, the Rule 4 amendment and this section were
re-filed from this run; every other section in this file is still the reading its own heading names.

- The narrative bundle is 419,736 bytes gzipped across 9 chunks, against an estimate of 300,000 to
  450,000. That is inside the range, 30,264 below the top.
- 125,381 bytes of that is genuinely deferred: `10mmj2_fz7c58.js`, `0bq5wyrhev5.1.js`,
  `0d3ymyos8iowp.js`, `05e6tciymra6v.js` is referenced by no prerendered document. The other 294,355
  is on a document at first paint, so the `next/dynamic` boundaries defer far less than their shape
  suggests.
- The non-3D path is over budget as measured: 258,870 against 140,000, 118,870 over, on route `/cv`.
  The largest single contributor is `.next/static/chunks/1416ak9gh4br1.js` at 70,572.
- On the budget's own decomposition it is inside: 103,350 against 140,000, 36,650 of margin. That
  decomposition has no line for the 248,647 of JavaScript or the 1,362 of preloads the document
  actually carries.
- 1,215,179 bytes under `public/assets/home/` are reachable from no module anything imports:
  `environment_D.hdr`, `gem.glb`, `gem.gltf`, `gem_data.bin`. They are committed, they are served,
  and no route asks for them.

**One finding is gone and the tool prints nothing in its place.** **Derived.** Every run since
2026-08-29 carried a fifth bullet, "9 of the 13 families the built CSS declares are reached by no
`font-family` rule", with 962,952 bytes on disk behind it. The tool emits that bullet only when a
family is unreached, and this build declares three and reaches all three, so the list above is four
bullets where the run below is five. The preload figure moved with it: 1,362 where the run below
reads 32,601, which is the two font preloads leaving and the three stylesheet preloads staying. The
narrative bundle, the deferred share and the unreachable `public/assets/home/` bytes are the same
findings as on 2026-09-11 to the byte, and `/cv` is still the heaviest route a visitor can load,
31,994 lighter and still over budget by 118,870.

### The 2026-09-11 run, after Story 2-17

**Verbatim**, `node ops/asset-budget.mjs` against build `k5AIUPv2f6fm-_ENAZc0_`. Only § Every route,
the lede of § The non-3D path and this section were re-filed from this run; every other section in
this file is still the reading its own heading names.

- The narrative bundle is 419,736 bytes gzipped across 9 chunks, against an estimate of 300,000 to
  450,000. That is inside the range, 30,264 below the top.
- 125,381 bytes of that is genuinely deferred: `10mmj2_fz7c58.js`, `0bq5wyrhev5.1.js`,
  `0d3ymyos8iowp.js`, `05e6tciymra6v.js` is referenced by no prerendered document. The other 294,355
  is on a document at first paint, so the `next/dynamic` boundaries defer far less than their shape
  suggests.
- The non-3D path is over budget as measured: 290,864 against 140,000, 150,864 over, on route `/cv`.
  The largest single contributor is `.next/static/chunks/1416ak9gh4br1.js` at 70,572.
- On the budget's own decomposition it is inside: 104,105 against 140,000, 35,895 of margin. That
  decomposition has no line for the 248,647 of JavaScript or the 32,601 of preloads the document
  actually carries.
- 9 of the 13 families the built CSS declares are reached by no `font-family` rule, and their
  962,952 bytes on disk (692,644 gzipped, all formats) are emitted and served regardless: Confillia,
  GeneralSans-Bold, GeneralSans-Light, GeneralSans-Medium, GeneralSans-Regular,
  GeneralSans-Semibold, MonumentExtended-Bold, MonumentExtended-Light, MonumentExtended-Regular.
- 1,215,179 bytes under `public/assets/home/` are reachable from no module anything imports:
  `environment_D.hdr`, `gem.glb`, `gem.gltf`, `gem_data.bin`. They are committed, they are served,
  and no route asks for them.

**Story 2-17 moved none of these findings.** **Derived.** The non-3D line still names `/cv`, 309
bytes heavier on the wire than on 2026-09-10 and still the heaviest of the routes that can be
loaded; the narrative bundle, the deferred share, the unreached faces and the unreachable
`public/assets/home/` bytes are the same findings the run below reports, within the noise of a
rebuild. What this story changed is the set the tool weighs, not what it finds: `/recommendation`
is gone from the prerendered documents, so the tool's own count of routes answered by a redirect
reads zero for the first time.

### The 2026-09-10 run, after Story 2-16

**Verbatim**, `node ops/asset-budget.mjs` against build `Tg4Y3fYLyWXDQsTh2jZrv`. Only § Every route
and the two amendments dated 2026-09-10 above were re-filed from this run; every other section in
this file is still the reading its own heading names.

- The narrative bundle is 419,833 bytes gzipped across 9 chunks, against an estimate of 300,000 to
  450,000. That is inside the range, 30,167 below the top.
- 125,381 bytes of that is genuinely deferred: `10mmj2_fz7c58.js`, `0bq5wyrhev5.1.js`,
  `0d3ymyos8iowp.js`, `05e6tciymra6v.js` is referenced by no prerendered document. The other 294,452
  is on a document at first paint, so the `next/dynamic` boundaries defer far less than their shape
  suggests.
- The non-3D path is over budget as measured: 290,555 against 140,000, 150,555 over, on route `/cv`.
  The largest single contributor is `.next/static/chunks/1416ak9gh4br1.js` at 70,572.
- On the budget's own decomposition it is inside: 103,948 against 140,000, 36,052 of margin. That
  decomposition has no line for the 248,535 of JavaScript or the 32,561 of preloads the document
  actually carries.
- 9 of the 13 families the built CSS declares are reached by no `font-family` rule, and their
  962,952 bytes on disk (692,644 gzipped, all formats) are emitted and served regardless: Confillia,
  GeneralSans-Bold, GeneralSans-Light, GeneralSans-Medium, GeneralSans-Regular,
  GeneralSans-Semibold, MonumentExtended-Bold, MonumentExtended-Light, MonumentExtended-Regular.
- 1,215,179 bytes under `public/assets/home/` are reachable from no module anything imports:
  `environment_D.hdr`, `gem.glb`, `gem.gltf`, `gem_data.bin`. They are committed, they are served,
  and no route asks for them.

**Story 2-16 moved one of these findings and none of the rest.** **Derived.** The non-3D line names
`/cv` because that route can now be loaded and is the heaviest of the two that can; the route it
named before is absent from this build's prerendered set for the reason § The build this reading was
taken from gives. The narrative bundle, the deferred share, the unreached faces and the unreachable
`public/assets/home/` bytes are the same findings the run below reports, within the noise of a
rebuild: none of them is about a page and this story added one.

### The 2026-09-07 run, after Story 2-12

**Verbatim**, `node ops/asset-budget.mjs` against build `rxNy6yw47ecyqZzmT1Jzp`.

- The narrative bundle is 426,441 bytes gzipped across 10 chunks, against an estimate of 300,000 to
  450,000. That is inside the range, 23,559 below the top.
- 118,809 bytes of that is genuinely deferred: `10mmj2_fz7c58.js`, `0qod5vojegloo.js`,
  `0n9mb1l0dkz1g.js` is referenced by no prerendered document. The other 307,632 is on a document at
  first paint, so the `next/dynamic` boundaries defer far less than their shape suggests.
- The non-3D path is over budget as measured: 295,154 against 140,000, 155,154 over, on route `/`.
  The largest single contributor is `.next/static/chunks/1416ak9gh4br1.js` at 70,572.
- On the budget's own decomposition it is inside: 105,583 against 140,000, 34,417 of margin. That
  decomposition has no line for the 251,767 of JavaScript or the 32,293 of preloads the document
  actually carries.

The font and asset findings did not move and are not restated: no story between the two runs touched
`contracts/fonts/`, `app/scss/_fonts.scss` or `public/assets/home/`.

### The 2026-08-29 run, superseded and kept

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
| Declared is not fetched | Every font figure here is the weight of a face the build serves, not of a face a browser downloaded. A browser fetches a face only when a glyph in its `unicode-range` is actually rendered, so reading two's 94,489 is a ceiling on the contract faces rather than an observation of a transfer. The nine unreached families are the opposite case and the claim there is stronger: no rule names them, so no glyph can trigger them. **Amended 2026-09-12:** the nine no longer exist. Story 2-20 deleted them, and the ceiling claim is now the whole of what this row says | **Decision**, amended |
| Reachability reads `font-family` declarations only | A family named through the `font` shorthand, or set from JavaScript, or declared only inside a media query or under a theme selector, would read as unreachable. None occurs today: the built CSS holds zero `font:` shorthands and zero `font-family` inside a `@media` block, and nothing under `app/` or `components/`, tests excluded, carries a `fontFamily` or a `font:` shorthand. The seven declarations listed above are the whole set. A future one would need this method widened rather than trusted | **Observed 2026-08-29**, by regex across the eleven built `.css` chunks and every `.ts`, `.tsx`, `.scss` and `.css` under `app/` and `components/` |
| The whole reading is one build, and two builds from one commit are not byte-identical | Three builds were taken from commit `9662d03` during this story. `/celeste` read 283,949, then 283,942, then 283,945, and the narrative total 418,743, then 418,757 twice. Chunk file names changed completely between the first and the second and not at all between the second and the third, so a rebuild may or may not move them and neither outcome is a defect. The determinism this file asserts is of the tool against one build, not of the build against itself, and every figure and chunk name printed here is good for `BUILD_ID` `uXKXS8QHdHPNgUPIdvcnq` only | **Observed 2026-08-29** |
| The tool re-reads everything on every call, and its cost grows with the build | It walks `app/` and `components/` once per asset and once per orphan check, and gzips each chunk once for the build table and again for each document that references it. On this build that is a second or two and nobody notices. On a build with many more routes it would be quadratic in the wrong place. It is a reading run by hand, not a gate on a runner, so the cost is recorded rather than optimised | **Decision.** Story 2-2 scope |
| No browser was involved | Every figure is a file on disk weighed by a script. Nothing here says what a browser prioritised, what it fetched first, what it fetched at all, or how long any of it took. SM-1 measures Suite Directory interactive, which is a browser measurement this file does not make and does not replace | **Decision.** Story 2-2 scope |
| A route's figure counts what its document references, and not what the router prefetches next | **Added 2026-09-07.** `/` reads 295,154 and carries no WebGL chunk, which is a true statement about first paint and an incomplete one about a session. `HomeLayout` renders `<Link href='/work'>` and `<Link href='/projects'>`, and the App Router prefetches both route bundles once they are in the viewport, so a homepage visitor's browser does fetch `three` and `three-stdlib` shortly after hydration. Observed in the pinned Playwright container by recording every script request on `/` and subtracting the set the document names. The tool reads prerendered documents and cannot see this; closing the `TorusCanvas` and `TorusKnotCanvas` boundaries would shrink the homepage's real transfer as well as those two routes'. **Amended 2026-09-23**: `TorusKnotCanvas` left with `/projects` (Story 2-14), and Story 2-33 closed the `TorusCanvas` boundary, so `/work`'s route bundle carries no WebGL chunk; the homepage's prefetch was not re-measured, and the row stands until it is | **Observed 2026-09-07.** Filed in `deferred-work.md` as DW-38 |
| The `/` figure is the document, not the session | 625,823 is what `/` references at first paint. It excluded `gem-fallback.png`, which only a visitor without WebGL fetched, and it excludes every route chunk a client-side navigation would pull afterwards. **Amended 2026-09-07:** the exclusion no longer has a subject. Story 2-13 deleted that file and the non-3D path renders no image at all, so the figure is unchanged and there is no longer an image outside it. What a non-3D visitor now fetches beyond this document is strictly less than what a default-path one does, and `tests/e2e/front-door.pw.ts` measures the difference on all four triggers | **Decision**, amended |
| `/` is no longer among the prerendered documents this file weighs | **Added 2026-09-07.** Story 2-13 reads the `Save-Data` request header in `app/page.tsx`, on an Operator ruling that a trigger answerable before the document paints must be answered there. `headers()` is a dynamic API, so `/` is server-rendered on demand: the build prints `ƒ /`, `.next/server/app` holds seven documents rather than eight, and this tool, which takes a route's assets from its own prerendered HTML, has no file to read for the homepage. Every `/` figure in this file is therefore the reading of 2026-08-29 and cannot be re-taken by `corepack node ops/asset-budget.mjs` alone; re-measuring it needs a request against a running server, which is how `tests/e2e/narrative.pw.ts` already reads the same document. The tool still runs, refusing only an empty set, and nothing gates on either | **Observed 2026-09-07.** Filed in `deferred-work.md` as DW-50 |
| Nothing gates on the figures | `.github/workflows/ci.yml` gained no job. Two things here are pinned by `ops/__tests__/asset-budget.test.ts` and cannot drift silently, the three contract-face figures and the fingerprint table, and everything else in this file goes stale invisibly until someone re-runs the tool. Story 2-34 is the gate story. **Amended 2026-09-23**: Story 2-34 added `literal-conformance`, a gate on stylesheet literals, and no gate on these figures, which no story's criteria ask for | **Decision.** Story 2-2 boundary |

## What this closes

**`EXPERIENCE.md` open item O-2, "Narrative bundle and asset weight are unmeasured", is closed on
2026-08-29** by this file, in the way Story 1-2 closed AD-17a in `ops/monitoring.md`: the planning
artifact is not edited, and the `ops/` record is where the measurement lives. The narrative bundle is
418,757 gzipped bytes, the narrative assets were 2,970,194 bytes on disk and are 1,215,179 since
Story 2-13 deleted `gem-fallback.png` on 2026-09-07, and both carry their method above.
**Amended 2026-09-24**: the narrative assets are 0 bytes since DW-36's package deleted the last four,
and the narrative bundle reads 619,351 gzipped in the 2026-09-24 reading under § Every route.

`EXPERIENCE.md:946-947` still reads "Unmeasured" and `:961-964` still calls the weight open, and
correcting that wording is a planning-artifact edit this story is not permitted to make. It is
Pending Operator action 1.

## Pending Operator actions

This file hands the Operator work Story 2-2 could not do inside its boundaries. Tracked here rather
than left in prose, in the shape `ops/font-contract.md` and `ops/rendered-output-harness.md` use.

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Replace the stale wording in `EXPERIENCE.md:946-947` and `:961-964` with a pointer to this file** | Operator | `:946-947` still reads "Unmeasured" for both lines. `:961-964` still says the weight is "Open, and worth measuring before Epic 2" and that the estimate is "inference from published sizes, not a measurement of your build". All four statements are now false, and a reader who reaches `EXPERIENCE.md` first will re-open a closed question | _not done_ |
| 2 | **Decide what to do about the two preloads at `app/layout.tsx:40-53`** | Operator | `MonumentExtended-Bold` is reached by no rule, and both preloads point at `/fonts/` while the faces load from `/_next/static/media/`, so 31,239 gzipped bytes are fetched at high priority and at least 19,936 of them are used by nothing. Changing `app/layout.tsx` is outside Story 2-2's boundaries. **Decided by Story 2-20's spec, Boundaries & Constraints**: both deleted, nothing added, reasoning under § What this reads against the budget's own rules, Rule 4 | 2026-09-12 |
| 3 | **Decide the disposition of the four orphaned assets and two orphaned components** | Operator | 1,215,179 bytes under `public/assets/home/` and two `.tsx` files are reachable from nothing. Deleting a published asset is a reversibility question, not a cleanup. **Decided by Operator ruling 2026-09-24: delete all six**, git history keeping them. Done in commit `d91a34f` after proving nothing imports or fetches them; the 2026-09-24 reading under § Every route reads 0 bytes under `public/assets/home/`, and `tests/e2e/narrative.pw.ts` holds the four URLs at 404 | 2026-09-24 |
| 4 | **Re-run `node ops/asset-budget.mjs` when Story 2-20 retires the legacy faces, and add a row** | Operator | 962,952 bytes on disk, 692,644 gzipped across nine unreached families and three formats each, are the largest single thing this reading found that a named story already plans to remove. The figure after it lands is what tells whether it worked. **It worked**: the 2026-09-12 table under § The faces the built CSS declares reads three families, 94,400 on disk, 0 unreached | 2026-09-12 |
| 5 | **Re-run it again once the non-3D front door lands (Story 2-13)** | Operator | The 140 KB budget is 102.8 percent breached today, and 245,605 of the 283,945 is JavaScript on a route with no 3D on it. Whether that story moves the number is the question this record exists to make answerable | _not done_ |
| 6 | **Rule on whether `EXPERIENCE.md` Rule 1 is repaired or retired** | Operator | § What this reads against the budget's own rules shows it does not hold. Either the narrative is genuinely deferred, which is a change to three components and `app/providers.tsx`, or the rule is rewritten to describe what the Hub does. Both are decisions this story may not take. **Narrowed 2026-09-07 by Story 2-12**: one of the three components is done and the rule now holds on `/`. It still fails on `/work` and `/projects` (`TorusCanvas.tsx:8`, `TorusKnotCanvas.tsx:8`) and on every route through `app/providers.tsx`, so the decision is unchanged in kind and smaller in size. **Narrowed again 2026-09-21 by Story 2-29**, by arithmetic and not by measurement (DW-57): `/projects` and `TorusKnotCanvas.tsx` were deleted with the route by Story 2-14 on 2026-09-07, so what remains is `TorusCanvas.tsx:8` on `/work` and `app/providers.tsx` on every route. **Decided by Operator ruling 2026-09-24: repaired, not retired.** Story 2-33 closed the torus's boundary on 2026-09-23; DW-36's package deleted `app/providers.tsx` and Lenis and moved `ScrollTrigger` behind that boundary (commit `237772c`), so no document references a narrative library but GSAP's core, which the Work item's disclosure uses on `/work` and `/cv`. `EXPERIENCE.md` carries the dated notes, and § What this reads against the budget's own rules says Rule 1 holds | 2026-09-24 |

**Maintaining this file.** When an action is performed, replace its `_not done_` cell with the ISO
8601 UTC completion date and leave the row in place. When a figure is re-measured, add the new row
with its own date, its own `BUILD_ID` and its method, and keep the old one, so a later reader can see
whether a number moved or was simply re-stated. Deletion is not used here.
