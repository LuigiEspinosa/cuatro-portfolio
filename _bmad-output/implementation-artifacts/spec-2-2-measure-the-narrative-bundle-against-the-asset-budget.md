---
title: 'Story 2.2: Measure the narrative bundle against the asset budget'
type: 'chore'
created: '2026-08-29'
status: 'done'
baseline_commit: '9662d037dd9f01899b94bbe8ccbb7ddfe1b830f7'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** `EXPERIENCE.md` § Asset Budget carries an estimate, not a measurement, and says so.
The narrative bundle is guessed at 300 to 450 KB gzipped from published library sizes, the
narrative assets are marked "not inspected", and the 140 KB non-3D path has never been compared
against a real build. SM-C5 counts Hub asset weight as a counter-metric and Story 2.9 builds the
Suite Directory on top of that number, so it has to be a measurement first. Open item O-2.

**Approach:** Add a zero-dependency measurement tool under `ops/` that reads a production build
and reports gzipped weights, and write the numbers into a new `ops/asset-budget.md` record in the
house style, with every figure marked Decision, Observed or Derived and carrying its method. The
route's own prerendered HTML is the ground truth for what a document references. Nothing about the
build, the bundle or the assets is changed by this story: it measures and records.

## Boundaries & Constraints

**Always:**

- KB is 1000 bytes throughout, matching `ops/font-contract.md:136`. Gzip is level 9, matching the
  font record, so a figure here and a figure there mean the same thing.
- Every recorded figure names the method that gathered it. A number without a method is a claim.
- The measurement runs against a production build (`corepack pnpm build`), never `next dev`, and
  the record carries the `.next/BUILD_ID` and the commit it was taken at, so staleness is visible.
- Chunk-to-library attribution is by fingerprint, and every fingerprint is proved discriminating:
  it appears in the chunks that carry its library and in no chunk that does not.
- The non-3D total counts what the document unconditionally puts on the wire. The two
  `rel="preload"` faces at `app/layout.tsx:40-53` are unconditional, so they are counted and named,
  not set aside because the budget's font line says "three faces".
- Both readings are shown: the total as measured, and the total on the budget's own decomposition.

**Ask First:**

- If two runs of the tool against one build disagree, HALT. A figure that moves is not a
  measurement, and the record must not be written from one of them.
- Any change to `app/layout.tsx`, `next.config.js`, `package.json` dependencies, or any file under
  `components/`, `app/scss/` or `public/`.

A breach of the 140 KB budget is not an Ask First. It is the expected shape of a finding: record
it and carry on.

**Never:**

- Do not make the trade. If the narrative exceeds ~450 KB the record names what would be traded
  (`@react-three/postprocessing`) and what losing it costs, and stops there.
- Do not add a CI gate, a blocking check, or a `ci.yml` job. This story produces a reading, not an
  enforcement point. Story 2.34 is the gate story.
- Do not delete, move or re-encode the orphaned narrative assets, and do not remove the orphaned
  `Gem.tsx` or `VenomSculpture.tsx`. Record them; deleting them is a different story's risk.
- Do not add a bundle-analyzer dependency. Nothing here needs one and `.next/` is enough.
- Do not run the Playwright suite or regenerate a baseline. Nothing rendered changes.
- Do not edit `EXPERIENCE.md` or any planning artifact. O-2 is closed by the `ops/` record, the way
  Story 1-2 closed AD-17a in `ops/monitoring.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Normal run | a fresh `.next/` from `corepack pnpm build` | the markdown block for the record on stdout, plus the findings, exit 0 | N/A |
| No build present | `.next/BUILD_ID` missing | refuses, naming the build command | exit 1, nothing printed to stdout |
| Route enumeration | `.next/server/app/index.html` | every `<script src>`, stylesheet `<link>` and `<link rel=preload>` under `/_next/` and `/` resolved to a file on disk | a referenced file that does not exist fails loudly, naming it |
| Chunk attribution | a chunk carrying `three` | classified narrative-bearing, whole chunk weight attributed, mixing stated as a limit | a fingerprint matching zero chunks fails, naming it |
| Font reachability | built CSS declaring 13 `@font-face` families | each family reported reachable or not, by whether a `font-family` rule names it directly or through one `var()` hop | an unresolvable custom property is reported unresolved, never assumed unreachable |
| Narrative assets | `public/assets/home/*` | measured and reported separately from JS, each with the `path:line` that references it, or marked referenced by nothing | N/A |
| Budget comparison | non-3D total vs 140,000 | total, budget, margin or overage, and the single largest contributor named | N/A |
| Breach | total over 140,000 | recorded as a finding with the largest contributor named | exit 0 still: this is a reading, not a gate |

</frozen-after-approval>

## Code Map

- `.next/server/app/index.html` (14,774 B), `work.html`, `projects.html`, `celeste.html`, `cv.html`,
  `recommendation.html`, `_not-found.html`, `_global-error.html`: eight prerendered documents, not
  five. Ground truth for what each route references. Not committed, `.gitignore:84`. `next.config.js`
  redirects `/cv` and `/recommendation` with a 308, so two of the eight are never served.
- `.next/build-manifest.json`: `rootMainFiles` and `polyfillFiles` only. There is no
  `app-build-manifest.json` under Turbopack, which is why the HTML is parsed instead.
- `.next/static/chunks/`: 20 `.js` (2,003,578 B) and 11 `.css` (21,793 B) at the current build.
  Largest is `0pic-wjg7xk-a.js` at 870,402 B, which carries `three` (35 hits on `WebGLRenderer`,
  2 on `react-three-fiber`). Turbopack minifies to numeric module ids and emits no module paths,
  so per-module attribution inside a chunk is not available. Fingerprints are the only lever.
- `contracts/fonts/*.woff2`: the three latin faces, 94,400 B on disk, 94,489 B gzipped.
  `packages/fonts/faces.json:3-5` holds those totals and `budgetBytes: 120000`.
- `ops/font-contract.md:133-165`: the model for the budget table. Columns
  `| Face | Bytes on disk | Bytes gzipped | Glyphs | Nature |`, bold total, Decision budget row,
  Derived margin row, then a bold `**Method.**` paragraph. Copy this shape.
- `ops/rendered-output-harness.md:1-20`, `:402-405`: the record preamble and the rule that a
  re-measurement adds a row and keeps the old one. Deletion is not used.
- `ops/capacity-summary.mjs:806-813`: the precedent for a tool that prints a markdown block for a
  record rather than writing the record itself. Zero dependencies, usage line at the foot.
- `ops/__tests__/capacity-summary.test.ts`: the test idiom. Pure functions against fixtures.
- `packages/fonts/__tests__/fonts-contract.test.ts:16`, `:574-575`: `zlib.gzipSync({level: 9})`
  re-measuring committed binaries. The pinning idiom to reuse for the three faces.
- `app/layout.tsx:40-53`: the two unconditional preloads,
  `MonumentExtended-Bold.woff2` (19,956 B) and `ConfilliaNormal-Regular.woff2` (11,280 B), served
  from `public/fonts/` while SCSS emits hashed copies into `.next/static/media`, so both ship.
- `app/scss/_fonts.scss:19-121`: ten legacy `@font-face` blocks, no `unicode-range`. Each declares
  woff2, woff and ttf, and the build emits all three, so a woff2-only reading understates them.
  `app/scss/_index.scss:33-34`: `@use` inlines `contracts/tokens` and `contracts/fonts`.
- `public/assets/home/`: `gem-fallback.png` 1,755,015 B (live, `GemComponent.tsx:28`), and
  `gem.glb` 600,008 B, `gem_data.bin` 598,968 B, `gem.gltf` 1,826 B, `environment_D.hdr` 14,377 B,
  all four referenced only from `components/atoms/Gem/Gem.tsx:16,19`, which no component imports.
- `app/providers.tsx:4-6`, `:10`: `gsap`, `ScrollTrigger` and `lenis` imported at module scope in
  the root layout, so they are on every route including the ones with no 3D. Read only.
- `components/molecules/GemComponent/GemComponent.tsx:5-6`, `TorusCanvas.tsx:5-6`,
  `TorusKnotCanvas.tsx:5-6`: the three `next/dynamic` `ssr: false` boundaries defer only
  `Scene.tsx`, while the heavy libraries are imported eagerly beside them. Read only, and the
  reason a route's narrative weight is not behind the split.
- `AGENTS.md:32-38`: the `ops/` inventory, "19 records", to be updated.

## Tasks & Acceptance

**Execution:**

- [x] `ops/asset-budget.mjs`, new: read `.next/`, resolve each route's referenced assets from its
      prerendered HTML, gzip at level 9, classify chunks by library fingerprint, resolve font-face
      reachability, measure `public/assets/home/`, and print the record's markdown block plus the
      findings. Zero dependencies, no arguments, usage line at the foot, exit 1 only when the build
      is missing, when a referenced file is not on disk, or when a fingerprint matches no chunk,
      which is the third case the matrix's Chunk attribution row already requires and which this
      bullet omitted.
- [x] `ops/__tests__/asset-budget.test.ts`, new: hold the pure functions to fixtures, including a
      chunk that must not be classified narrative and a `var()` hop that must resolve. Re-measure
      the three committed faces with `zlib.gzipSync({level: 9})` and pin the figures the record
      states, so they cannot drift. Must pass with no `.next/` present, because the CI unit job
      has no build.
- [x] `ops/asset-budget.md`, new: the record. Preamble in the house style naming the story, the
      date and the baseline commit; the narrative JS table against the 300 to 450 KB estimate; the
      narrative asset table with the orphan finding; the non-3D table against 140 KB in both
      readings with the largest contributor named; the `@react-three/postprocessing` trade named
      and not made if the narrative exceeds 450 KB; a `## Method` section carrying the BUILD_ID,
      the fingerprints and their proof; `## Stated limits` covering chunk-granularity mixing,
      gzip level 9 against the server's own default, and declared-versus-fetched fonts; and one
      line closing O-2 with its date.
- [x] `AGENTS.md`: `ops/` holds 20 records, not 19, and `asset-budget.md` joins the named list.

**Acceptance Criteria:**

- Given a production build, when `node ops/asset-budget.mjs` runs twice against it, then both runs
  print byte-identical output, and that output is what `ops/asset-budget.md` records.
- Given `ops/asset-budget.md`, when it is read, then the narrative JS gzipped weight, the narrative
  asset weight and the non-3D path total are each a number with a method and a Nature marker, and
  each is placed beside the estimate or budget it answers.
- Given a fingerprint used for chunk attribution, when it is checked against every chunk in the
  build, then it matches the chunks carrying its library and no others, and that check is in the
  record.
- Given `corepack pnpm test --run` and `corepack pnpm typecheck`, when both run, then both pass
  with the new test file included and no `.next/` directory required.
- Given the working tree after this story, when the diff is read, then nothing under `app/`,
  `components/`, `public/`, `contracts/`, `packages/` or `.github/` has changed.

## Spec Change Log

All three are corrections to sections outside `<frozen-after-approval>`, made during the review loop.
Nothing inside the frozen block moved.

| # | Date | Section | Change |
|---|---|---|---|
| 1 | 2026-08-29 | Code Map | The prerendered documents were listed as five. The build writes eight: `cv.html`, `recommendation.html` and `_global-error.html` were missing, and the first two are 308-redirected and never served |
| 2 | 2026-08-29 | Code Map | `app/scss/_fonts.scss:19-113` stopped at the start of the tenth `@font-face` block rather than its end. Corrected to `:19-121`, and the woff and ttf sources beside each woff2 are now named, because a woff2-only reading understates the legacy faces by 507,244 gzipped bytes |
| 3 | 2026-08-29 | Tasks & Acceptance, Execution bullet 1 | "exit 1 only when the build is missing or a referenced file is not on disk" contradicted the matrix's Chunk attribution row, which requires a fingerprint matching zero chunks to fail. The third case is now named in the bullet |

## Design Notes

The three `next/dynamic` boundaries look like the narrative is code-split, and it is not: each
parent statically imports `three`, `@react-three/fiber`, `@react-three/drei` or
`@react-three/postprocessing` as a sibling of the dynamic call, so the libraries land in the
parent's chunk regardless and only `Scene.tsx` is deferred. `gsap` and `lenis` are worse: they are
module-scope imports in `app/providers.tsx`, which the root layout renders, so they are on
`/celeste` and the 404 as well. The measurement has to report this rather than trust the shape of
the source, which is exactly why the story exists.

Attribution is at chunk granularity because Turbopack minifies to numeric module ids. A chunk
carrying both narrative and shell code is counted whole to the narrative, which overstates. That is
a stated limit with a direction, not a hidden error, and the direction is the safe one: the
narrative cannot be smaller than the shell-free chunks alone.

The two preloads exist to make `SplitText` measure correct widths on first paint, per the comment
at `app/layout.tsx:39`. That is a real reason and this story does not argue with it. It only
insists the bytes appear in the total, because Rule 4 of § Asset Budget says preload only what the
non-3D path needs, and whether that holds is precisely what the number decides.

## Verification

**Commands:**

- `corepack pnpm build`: succeeds, and `.next/BUILD_ID` is written.
- `node ops/asset-budget.mjs`: prints the block, exit 0. Run twice, diff the two outputs, expect no
  difference.
- `corepack pnpm typecheck`: clean.
- `corepack pnpm test --run`: passes, at 738 tests plus the new file's cases.
- Move `.next/` aside and re-run the tool: expect exit 1 naming `corepack pnpm build`. Restore it.
- `git status --short`: only the four files above.

**Manual checks:**

- Each fingerprint is grepped across every chunk in the build and the hit set recorded, so the
  claim that it discriminates is demonstrated rather than asserted.
- The three face figures the record states are compared against `packages/fonts/faces.json:3-5`.
  They must agree, or one of the two is wrong and that is a finding.

## Suggested Review Order

**The finding, which is two readings of one build that disagree**

- Start here. What the document actually puts on the wire, 102.8 percent over.
  [`asset-budget.md:203`](../../ops/asset-budget.md#L203)

- The budget's own decomposition, same build, 28.4 percent under. Both are true.
  [`asset-budget.md:255`](../../ops/asset-budget.md#L255)

- Why they disagree. Rule 1 of the Asset Budget does not hold.
  [`asset-budget.md:362`](../../ops/asset-budget.md#L362)

**What the measurement found that nobody was looking for**

- Nine of the thirteen families the built CSS declares are reached by no rule.
  [`asset-budget.md:297`](../../ops/asset-budget.md#L297)

- Weighing woff2 alone would have understated those by 507,244 gzipped bytes.
  [`asset-budget.md:350`](../../ops/asset-budget.md#L350)

- The narrative is inside its estimate, and 98.5 percent of it is not deferred.
  [`asset-budget.md:92`](../../ops/asset-budget.md#L92)

- Geometry and an environment map, 1.2 MB, that no route requests.
  [`asset-budget.md:144`](../../ops/asset-budget.md#L144)

**Where the numbers come from, which is what makes them checkable**

- Every fingerprint with the hit set that proves it discriminates.
  [`asset-budget.md:424`](../../ops/asset-budget.md#L424)

- What this reading does not cover, stated rather than left to be inferred.
  [`asset-budget.md:485`](../../ops/asset-budget.md#L485)

- Six decisions the story was not permitted to take.
  [`asset-budget.md:514`](../../ops/asset-budget.md#L514)

- Which sections are the tool's output verbatim and which are editorial.
  [`asset-budget.md:27`](../../ops/asset-budget.md#L27)

**The instrument**

- The per-route arithmetic every published figure derives from.
  [`asset-budget.mjs:948`](../../ops/asset-budget.mjs#L948)

- The route's own HTML is the ground truth, because Turbopack writes no app manifest.
  [`asset-budget.mjs:349`](../../ops/asset-budget.mjs#L349)

- A mark that stops matching halts the run rather than reporting a library absent.
  [`asset-budget.mjs:410`](../../ops/asset-budget.mjs#L410)

- The `var()` chain is followed to a fixed point, because one hop reports the wrong answer.
  [`asset-budget.mjs:677`](../../ops/asset-budget.mjs#L677)

- Orphan detection, the predicate behind the deletion recommendation.
  [`asset-budget.mjs:861`](../../ops/asset-budget.mjs#L861)

**The tests, which is where the review pass spent most of its findings**

- `collect` over a whole scratch build. Nothing executed this before the review.
  [`asset-budget.test.ts:235`](../../ops/__tests__/asset-budget.test.ts#L235)

- A breach built from real tool output, replacing a fixture whose arithmetic was impossible.
  [`asset-budget.test.ts:437`](../../ops/__tests__/asset-budget.test.ts#L437)

- Every refusal, including the referenced file with nothing behind it.
  [`asset-budget.test.ts:522`](../../ops/__tests__/asset-budget.test.ts#L522)

**Supporting**

- The `ops/` inventory gains its twentieth record.
  [`AGENTS.md:32`](../../AGENTS.md#L32)