---
title: 'Story 2.20: Migration step 5, swap the type'
type: 'feature'
created: '2026-09-12'
status: 'done'
baseline_commit: '118423b6e980ba9848bc2d768e69a7a3cb9b3fe3'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** The Hub still self-hosts ten legacy faces (five General Sans, three Monument Extended,
two Confillia: 39 binaries, 1.5 MB tracked under `public/fonts/`) through `app/scss/_fonts.scss`,
although since Story 1-18 only one rule reaches any of them: `--confillia-normal`, at two `HomeLayout`
sites. The root layout preloads two of those binaries on every route, one of which nothing resolves
(DW-9), the built CSS declares 13 families of which 9 are reached by no rule (`ops/asset-budget.md`),
and every redesign story from 2-27 on is blocked until the type layer is the contract's alone.

**Approach:** Retarget `--confillia-normal` onto `var(--f-display)` with `font-stretch: 75%` at its two
call sites, delete `--confillia-bold`, delete `_fonts.scss` with its `@forward`, delete `public/fonts/`
outright, and drop both preloads without replacing them. Observe the swap on the Hub's real routes
with the instrument `contract-fonts.pw.ts` already uses (abort every woff2, measure, allow, measure
again), and assert the weight distinction as a width difference between the two display aliases on one
string. Move every literal that pinned the old state to what the run prints, and close O-6, DW-9, DW-11
and DW-39 in the records.

## Boundaries & Constraints

**Always:**

- **Width rides on the call site, never on the alias.** `--confillia-normal: var(--f-display);` in
  `app/app.scss`, and `font-stretch: 75%` beside `font-family` at `HomeLayout.scss:120` and `:151`, the
  shape `Premise.scss:68` has. No `font-weight` line at either: the published `700 800` range clamps the
  inherited 400 to 700, the mechanism `anchor-aliases.pw.ts:852-909` already asserts for
  `--monument-regular`, and a `--w-*` name in `HomeLayout.scss` trips `anchor-contract.test.ts` claim
  four (`:829-840`) because the file is in neither `WEIGHT_CALL_SITES` nor `TOKEN_NATIVE_STYLESHEETS`.
- **`--monument-regular` gets no hand-set weight.** The AC's `--f-display` + `--w-bold` is what the
  clamp delivers today at `WorkItem.scss:52` and `error-page.scss:40`, and `DISPLAY_REGULAR_SITES`
  (`anchor-aliases.pw.ts:449-471`) asserts it; a `--w-bold` line there fails that case (`700 > 700`) and
  claim four. The distinction is asserted by rendering: one string at the two aliases measures two widths.
- **Preloads go and nothing replaces them.** `GlitchText.tsx:37-42` gates `SplitText` on
  `document.fonts.ready`, so the preload bought latency, not correctness. A preload of
  `/contracts/fonts/*.woff2` from `app/layout.tsx` puts `contracts/` in a scanned source and fails
  `anchor-contract.test.ts:1057-1062`. `narrative.pw.ts:846` moves from two distinct faces to zero.
- **`public/fonts/` goes entirely** (`git rm -r`, 39 files), the four Italic and six `.eot` no
  `@font-face` ever named included. The `KNOWN_TRACKED` sentinel at `anchor-contract.test.ts:284` moves
  to `public/logo.png`.
- **Every count that pinned the old state moves in both suites, never one.** 16 to 15
  (`anchor-contract.test.ts:147`, `anchor-aliases.pw.ts:147`, `contract-anchor.pw.ts:598`), 12 to 13
  (`MAPPING` gains `['--confillia-normal', ['--f-display']]`), 4 to 2 (`LITERAL_PROPERTIES` in both
  files, and the prose that says "four" and "sixteen"). The local-face test (`anchor-contract.test.ts:614-639`)
  and claim four of `:591-612` are deleted, not skipped, and the slot becomes the retired-family guard: no
  scanned source names `Confillia`, `MonumentExtended`, `GeneralSans` or a `/fonts/` path.
- **The swap is observed, not read.** New `tests/e2e/type-swap.pw.ts` on `contract-fonts.pw.ts:206-272`'s
  shape (`page.route('**/*.woff2', abort)`, `fonts.ready`, measure; unroute, reload, `fonts.check`,
  measure) over the real elements that reach the display face on `/` (`a.nav-link`,
  `.contact-container a`) and the 404 (`.error-page__code`, `.error-page__title`): each element's height
  within 1% across the swap, which is what the overrides guarantee (`ops/font-contract.md:263-269`);
  widths are reported, not asserted. Watched failing on a planted family that points at the same woff2
  with the four override descriptors stripped, `probe.html`'s trick on a real route.
- **The ledger stays true.** `home-nav` and `home-contact` `measured` heights (`hit-target-floor.pw.ts:267,276`,
  `ops/hit-target-floor.md:257-258,338-341`) are re-read at 360 in the container and written into both
  files, which `hit-target-floor.test.ts:282` holds string-equal, with a dated paragraph.
- Every new predicate is watched failing on a browser-planted control that touches no file. The new
  spec takes no screenshot (`rendered-output.pw.ts:216-223`). Records are appended, never edited
  where dated.

**Ask First:**

- A preload for any contract face, or any edit under `contracts/` or `packages/fonts/`.
- A `font-weight` line at any `--monument-regular` or `--confillia-normal` site, or a width other
  than 75 at the two Confillia sites.
- Regenerating the `/work` baseline. No rule on `/work` ever reached a local face, so it must not move;
  if it does, stop and report which pixels.

**Never:**

- Do not restyle `.nav-link` or `.contact-container a` beyond the one `font-stretch` line: size,
  colour, rules and hover are Story 2-29's and 2-32's. Do not touch `WorkItem.scss:54`'s literal 500 (2-31).
- Do not write `Bricolage Grotesque` or any contract family as a literal anywhere
  (`anchor-contract.test.ts:1015-1055`).
- Do not edit `AGENTS.md:87-90` or `app/app.scss:48-55`'s Monument call-site counts: stale since 2-9 and
  2-17, not this story's. File them.
- Do not remove `narrative.pw.ts:866-891`'s planted `/fonts/planted.woff2`: it is never fetched.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Confillia sites | `/`, fonts loaded | `a.nav-link` (2) and `.contact-container a` (3) compute `font-family` leading `"Bricolage Grotesque"` and `font-stretch: 75%`; `--confillia-normal` on `:root` reads the `--f-display` stack | Control: `font-stretch` cleared on one element reads `100%` |
| Retired families | Any route, the built CSS | `CSSFontFaceRule` families in `document.styleSheets` equal exactly the contract's three; no resource entry under `/fonts/`; `GET /fonts/ConfilliaNormal-Regular.woff2` answers 404 | 200 today; six inventories in the Code Map say so and move |
| Preloads | `/` document | Zero `<link rel=preload as=font>` | `narrative.pw.ts:846` pins two today and moves |
| Swap | woff2 aborted, then allowed | Each measured element's height within 1% across the swap; `fonts.check` true for all three families after | Control: a planted span in an override-stripped copy of the display face breaches |
| Weight | One string planted twice, `var(--monument-regular)` and `var(--monument-bold)` + `var(--w-black)` | Both lead `"Bricolage Grotesque"`; widths differ | Control: both at `--w-black` measure equal |
| Unit sweep | Every scanned file under `app/`, `components/`, `hooks/` | No `Confillia`, `MonumentExtended`, `GeneralSans`, `/fonts/`; `app/scss/_fonts.scss` absent; `_index.scss` forwards no `./fonts` | The deleted local-face test's slot |
| `/work` baseline | `test:e2e` in the container | Byte-identical | Ask First |
| Asset budget | `node ops/asset-budget.mjs` after `corepack pnpm build` | 3 families declared, 0 unreached, 0 gzipped font bytes preloaded, `public/fonts/` absent | Pasted verbatim into the record |

</frozen-after-approval>

## Code Map

**The type layer**

- `app/scss/_fonts.scss:19-121`: ten `@font-face` blocks, `src` into `../../public/fonts/`. Delete.
  Loaded by one chain only: `app/layout.tsx:4` `import './app.scss'`, `app.scss:1` `@use './scss/'`,
  `_index.scss:36` `@forward './fonts'`. Delete that line and rewrite the docblock at `:24-32` (`:24-27`
  says the contract loads sit above the forwards to precede the Anchor's own `@font-face`; `:29-32`
  says nothing consumes the names, false since 1-18 and filed as DW-12: closes in passing).
- `app/app.scss:14-16` "Four properties are deliberately left as literals"; `:43-46` the Confillia
  block and its O-6 comment. After: `--confillia-normal: var(--f-display);` with a comment saying width
  is set at the call sites, `--confillia-bold` gone, "two properties".
- `components/organisms/HomeLayout/HomeLayout.scss:119-138` `.nav-link` and `:149-172`
  `.home-panel--contact .contact-container a`: `font-family: var(--confillia-normal)` at `:120` and `:151`,
  no weight. Add `font-stretch: 75%;` directly after each. `Premise.scss:68` and `SuiteDirectory.scss:48,130`
  are the shape; `premise.pw.ts:499-516` reads `font-stretch` back, reuse that read.
- `app/layout.tsx:42-56`: the comment and two `<link rel='preload' as='font'>`. Delete all fifteen lines.
- `public/fonts/`: 39 tracked files, `git rm -r`. Nothing in `next.config.js`, `docker/`, `.dockerignore`
  or `.github/workflows/` names the path; `Dockerfile:34` copies `public/` whole.
- `contracts/fonts.css:16-28` Bricolage `700 800`, `font-stretch: 75% 100%`, `size-adjust 92.271%`,
  overrides tuned against the container's fallback (`:13-14`). `contracts/tokens.css:41` `--f-display`,
  `:61-62` `--w-bold: 700`, `--w-black: 800`. No width token exists; `font-stretch` is the only route.

**Unit pins, `app/__tests__/anchor-contract.test.ts`**

- `:52` `LOCAL_FONTS_SCSS`, `:55-61` "Ten, not nine" and `LOCAL_FACE_COUNT`: delete.
- `:147` `HUB_PROPERTY_COUNT = 16` and "sixteen" at `:24,146,347,396,643-648,681,884-889`: 15.
- `:166-179` `MAPPING` (twelve rows): add `['--confillia-normal', ['--f-display']]`; `:184` and `:861`
  "twelve" / "four": thirteen / two.
- `:196-202` `LITERAL_PROPERTIES`: `['--accent-glow', '--hero-height']`; `:997-1005` failure text drops
  the O-6 clause.
- `:281-285` `KNOWN_TRACKED`: `public/logo.png` for `public/fonts/ConfilliaBold-Regular.woff`; `:1104-1106`
  reads it.
- `:591-612` claim four (`@forward './fonts'` last) and its comment `:602-604`: delete the claim, keep
  tokens-before-fonts. `:614-639` the local-face test: delete; write the retired-family guard in its
  place over the same `SCANNED` set, the four strings asserted absent, and the matcher shown live on a
  planted string the way `anchor-aliases.pw.ts:619-620` does.
- `:131,134` floors 59 / 19 hold at 67 / 23 scanned. `:222-228` `WEIGHT_CALL_SITES` unchanged.
- `:1057-1062` the `contracts/` mention list: unchanged, which is why no preload is added.

**Browser pins**

- `tests/e2e/anchor-aliases.pw.ts:147-152` `16 / 12 / 4` and `LITERAL_PROPERTIES`; `:525,534-540` count
  messages; `:656-690` "the four properties" test and its O-6 message at `:681-683`; `:9,146,177,195,531-533`
  prose. `:155` `LITERAL_COLOUR_COUNT = 1` stays, `:671-673` then reads `2 - 1`. `:619-620` string
  controls stay.
- `tests/e2e/contract-anchor.pw.ts:598` bare `16`; `:616-623` asserts some `:root` value is
  single-quoted, true only of the two Confillia literals: delete that assertion and rewrite the comment,
  keep the `:624` control. `:110,135,595,1154` "sixteen".
- `tests/e2e/narrative.pw.ts:834-846`: title, `:840-841` comment, `toBe(2)` to `toBe(0)`; `:838` stays.
- `tests/e2e/hit-target-floor.pw.ts:263-277` the two `measured` strings; `ops/hit-target-floor.md:257-258,
  338-341` mirror them. `tests/e2e/contract-serving.pw.ts:262-266` comment says `/fonts/` exists on
  this server: one clause.
- `tests/e2e/contract-fonts.pw.ts:191-272` `geometryOf`, `measureSwap`, `deltas`, `toleranceFor`,
  module-local: copy the shape, not the file. `:215` the abort, `:236-239` `fonts.check`. `tests/e2e/cv.pw.ts`
  for `goTo`, planted controls, `rootCustomPropertyValue`. A new `.pw.ts` needs no config.
- `tests/e2e/rendered-output.pw.ts:129-152` asserts `--monument-bold` is unquoted and not Monument:
  still true. `tests/e2e/harness.ts:31-39` cites `_fonts.scss:91-99` in a dated paragraph: leave.

**Records**

- `ops/asset-budget.mjs:1603-1604` emits "preloaded unconditionally at `app/layout.tsx:40-53`" and
  `:1693` "the legacy blocks declare woff and ttf": both false after; reword, check
  `ops/__tests__/asset-budget.test.ts` for pins on either string first.
- `ops/asset-budget.md:919` pending action 2 (the preloads) and `:921` action 4 (re-run when 2-20
  retires the faces): complete both; new dated reading under § Every route and § Findings pasted
  verbatim, `spec-2-17` § Tasks shows the shape. `:646-656`, `:687-690`, `:889` are dated, append.
- `ops/anchor-token-adoption.md:403-415` the four literals table, `:698-699` stated limits (the preload,
  the eight faces), `:713` the invalidation row that says O-6 closing "without being recorded", `:802`
  "three published and ten local": one dated section closing each by name.
- `ops/font-contract.md:462` "Story 2.20 retires the old binaries": the closing clause.
- `ops/rendered-output-harness.md:48-49` one row per browser spec: add `type-swap.pw.ts`.
- `deferred-work.md`: DW-9 (`:1144`), DW-11 (`:1160`), DW-12 (`:1168`), DW-39 (`:2731`) to `status: done`
  with a dated closing paragraph in the shape at `:1588-1595`; file the stale Monument counts
  (`AGENTS.md:87-90`, `app/app.scss:48-55`); file what the run surfaces. DW-24 stays open.

## Tasks & Acceptance

**Execution:**

- [x] `app/app.scss`, `components/organisms/HomeLayout/HomeLayout.scss`: retarget `--confillia-normal`,
      delete `--confillia-bold`, two `font-stretch: 75%` lines, comments to "two".
- [x] `app/scss/_fonts.scss`, `app/scss/_index.scss`, `public/fonts/`: delete the partial, the
      `@forward`, the directory; rewrite the `_index.scss` docblock.
- [x] `app/layout.tsx`: delete the preload block.
- [x] `app/__tests__/anchor-contract.test.ts`: the pins above; the retired-family guard replaces the
      local-face test.
- [x] `tests/e2e/anchor-aliases.pw.ts`, `contract-anchor.pw.ts`, `narrative.pw.ts`,
      `contract-serving.pw.ts`: counts, the single-quote assertion, the preload count, one comment.
- [x] `tests/e2e/type-swap.pw.ts`: **new, no screenshot.** The matrix rows Confillia sites, Retired
      families, Preloads, Swap and Weight, each watched failing on its planted control.
- [x] `tests/e2e/hit-target-floor.pw.ts`, `ops/hit-target-floor.md`: the two `measured` heights read
      off the container at 360, a dated paragraph.
- [x] `ops/asset-budget.mjs`, `ops/asset-budget.md`: the two emitted sentences; `corepack pnpm build`
      then `node ops/asset-budget.mjs`, reading pasted, actions 2 and 4 completed.
- [x] `ops/anchor-token-adoption.md`, `ops/font-contract.md`, `ops/rendered-output-harness.md`: the
      dated closures and the new row.
- [x] `deferred-work.md`: close DW-9, DW-11, DW-12, DW-39; file the stale counts; file what the run
      surfaces.

**Acceptance Criteria:**

- Given `corepack pnpm test --run`, `corepack pnpm typecheck` and `corepack pnpm build`, when they run,
  then all three pass, `git ls-files public/fonts` is empty, and no floor in `anchor-contract.test.ts` moved.
- Given `corepack pnpm test:e2e` inside `mcr.microsoft.com/playwright:v1.62.1-noble`, when it runs, then it
  passes with the `/work` baseline untouched, and every control in the new spec has been observed failing
  its clean counterpart on the same build.
- Given `/` rendered in the container, when the swap is measured, then every display-face element holds
  its height within 1%, and the planted override-stripped face does not.
- Given `/` at 360 and 1024, when the Operator views the two nav links and three contact links set in
  Bricolage at 75% width, then they read acceptably (O-6), confirmed before the story closes.
- Given `node ops/asset-budget.mjs` after the build, when its reading is pasted, then it declares three
  families, zero unreached, zero preloaded font bytes, and the record's actions 2 and 4 are complete.

## Spec Change Log

- **2026-09-12, review pass, no change to the frozen intent.** Two Code Map lines were amended by
  the review rather than re-derived. The `contract-anchor.pw.ts` line said "keep the `:624` control":
  the review found `normaliseQuotes` had no caller but that control once the single-quote assertion
  went, so helper, control and docblock were deleted. The Browser pins line implied the new spec
  would carry its own preload case: `narrative.pw.ts:834-895` already pins zero distinct font
  preloads on `/` against a planted control, so `type-swap.pw.ts` carries none and the DW-9, DW-39
  and asset-budget Rule 4 closures cite that one pin. KEEP: the retired-family guard strips comments
  and anchors the path match (`/fonts/` root-relative or `public/fonts/`, never `./fonts/` or
  `/contracts/fonts/`), so a comment may name the retired face and the contract's own `url()` prose
  cannot trip it; the exactly-three-families read and the `/fonts/` resource read run on all five
  surfaces, not `/` alone; the swap is measured on twelve display elements across `/`, `/work` and
  the 404, with every aborted pass run before any allowed one, because a face fetched on one route's
  allowed pass is served from memory cache on the next route's aborted pass and never reaches
  `page.route`.
- **2026-09-12, implementation finding.** The matrix row "Unit sweep" names `app/`, `components/`
  and `hooks/`; the guard runs over the suite's existing `SCANNED` set, which also holds `content/`
  and `lib/`. A superset, so the row holds; left as written because the frozen block is human-owned.
- **2026-09-12, implementation finding.** `.work-hero__heading` measured 300.00 x 70.38 on some runs
  and 216.00 x 105.56 on others, and the cause was not the font: `.work-hero`'s grid column reads
  216px at `load` and at `fonts.ready`, and 300px once the on-demand torus canvas mounts about 250 ms
  later. Both passes on `/work` now wait for that canvas; three consecutive runs then read 70.38 over
  two lines, 0.00%.
- **2026-09-12, review pass.** O-6 is not closed by any record this story writes. The two sites were
  rendered and screenshotted in the container on 2026-09-12; the records say the item closes on the
  Operator's confirmation at this story's review and is recorded there with its date when given.
  Given 2026-09-12 at review, on the three container screenshots; recorded in
  `ops/anchor-token-adoption.md` § Step 5. O-6 is closed.

## Design Notes

**Why no preload replaces the two.** The old comment's purpose ("so SplitText measures correct widths
on first paint") is served by `document.fonts.ready` in `GlitchText.tsx:37-42`, which is what actually
gates the split. A contract preload would be a measured optimisation with no measurement, would put
`contracts/` in a scanned source, and would bring back the duplicate-emission DW-39 records as six
elements instead of four. If the display face is ever observed arriving late, it is one line.

**Why the weight distinction is a width, not a computed style.** `getComputedStyle().fontWeight` answers
the requested value (400 at `error-page__title`), not the instance the variable face clamped to, so it
cannot see the distinction the AC names. Advance width at 700 versus 800 can, on the same string.

**Why heights, not widths, across the swap.** `size-adjust` is fitted to one sample string
(`ops/font-contract.md:263-269`); the line box is what the four descriptors hold still on arbitrary text,
so that is the assertion, and the width delta is printed for the record.

## Verification

**Commands**, each with what it printed on 2026-09-12 on the story's working tree:

- `corepack pnpm test --run`: passes. Observed: 50 files, 1210 tests, all passed, 91.12 s.
- `corepack pnpm typecheck`: passes. Observed: exit 0.
- `corepack pnpm build`: passes; `.next/static/media` holds exactly the three contract woff2 and no
  other font binary of the Hub's; `node ops/asset-budget.mjs` after it reports the figures in the
  matrix. Observed against build `SWgIhyUw5RIK9pXx1sbr7`: 3 families declared, 0 reached by no rule,
  0 gzipped font bytes preloaded, `/cv` 258,870 on the wire where the 2026-09-11 reading had 290,864.
- `corepack pnpm test:e2e` inside `mcr.microsoft.com/playwright:v1.62.1-noble`: passes;
  `git status --porcelain -- tests/e2e/*-snapshots` empty. Observed: 223 passed across 18 spec files
  in 3.6 min, snapshots status empty. From `type-swap.pw.ts`'s own output: every display element's
  height moved 0.00% across the swap on `/` (five hero links at 32.00, `.glitch-text__inner` at
  86.38 over two lines), `/work` (`.work-hero__heading` 70.38 over two lines, four
  `.work-item__company` at 21.00) and the 404 (`.error-page__code` 96.00, `.error-page__title`
  24.00); the planted override-stripped control moved 12.50% (32.00 to 28.00) on all three routes,
  which is the "observed failing" the second criterion asks for; widths, printed and not asserted,
  moved 18.57 to 19.59% on the three contact links (DW-82) and 2.46% on the 404 title; the weight
  pair read 749.00 at `var(--monument-regular)` against 755.00 at `var(--monument-bold)` with
  `--w-black`, twin 755.00; the width pair read 578.00 at `font-stretch: 75%` against 755.00 at
  `100%`, twin 755.00 (52 characters at 32px). The retired-families read ran on all five surfaces,
  and the planted `@font-face` inside `@supports`, the planted fetch under `/fonts/` and the served
  contract face answering 200 all fired.
- `git ls-files public/fonts | wc -l`: 0. Observed: 0.
  `git grep -n -E "Confillia|MonumentExtended|GeneralSans" -- app components hooks lib content`:
  no declaration, no `url()`, no `font-family` value. Observed: twelve lines in
  `app/__tests__/anchor-contract.test.ts`, which names the strings it guards against and is not a
  scanned source, and two comment lines at `app/app.scss:43-44`, which name the retired face in
  prose beside the alias that replaced it; the guard in that suite strips comments before it
  matches, so those two are prose to it and to a reader. The earlier `-i` form of this command
  could never be empty, because `-i` matches the retained alias `--confillia-normal`.

**Manual checks:**

- `/` at 360 and 1024, in the container's screenshot saved to the scratchpad: nav and contact links in
  Bricolage at 75% width, weight 700, read acceptably. O-6 closes on the Operator's word.
- The 404: `404` numeral visibly heavier than the title line.

## Suggested Review Order

**The alias carries the family, the call site carries the width**

- Start here: `--confillia-normal` lands on the display role; width cannot ride on a family alias.
  [`app.scss:47`](../../app/app.scss#L47)

- The one line each site gains, the `Premise.scss:68` shape; no weight line, the clamp does that.
  [`HomeLayout.scss:121`](../../components/organisms/HomeLayout/HomeLayout.scss#L121)

- The second site, same line, same reason.
  [`HomeLayout.scss:153`](../../components/organisms/HomeLayout/HomeLayout.scss#L153)

- The contract's two loads are now the only `@font-face` source; the `./fonts` forward is gone.
  [`_index.scss:35`](../../app/scss/_index.scss#L35)

- Fifteen lines of preload deleted, nothing put back: `GlitchText` waits on `fonts.ready` already.
  [`layout.tsx:41`](../../app/layout.tsx#L41)

**The swap, observed on the real routes**

- Twelve display elements across three surfaces, every aborted pass before any allowed one.
  [`type-swap.pw.ts:69`](../../tests/e2e/type-swap.pw.ts#L69)

- Why the order matters: a memory-cached face never reaches `page.route` on the next route.
  [`type-swap.pw.ts:368`](../../tests/e2e/type-swap.pw.ts#L368)

- `probe.html`'s trick on a real route: the display face's own `src`, four overrides stripped.
  [`type-swap.pw.ts:324`](../../tests/e2e/type-swap.pw.ts#L324)

- Heights within 1%, the control breaching 12.50%, `/work` waiting on the torus canvas first.
  [`type-swap.pw.ts:619`](../../tests/e2e/type-swap.pw.ts#L619)

- The weight distinction as a width: 749 against 755 on one string, twin equal.
  [`type-swap.pw.ts:689`](../../tests/e2e/type-swap.pw.ts#L689)

- The width axis the same way: 578 against 755, so a dropped `wdth` axis cannot pass.
  [`type-swap.pw.ts:721`](../../tests/e2e/type-swap.pw.ts#L721)

- Exactly the contract's three families on all five surfaces, nested rules walked, `/fonts/` unfetched.
  [`type-swap.pw.ts:561`](../../tests/e2e/type-swap.pw.ts#L561)

- Both Confillia sites compute the display family at 75%, and the read is shown live.
  [`type-swap.pw.ts:514`](../../tests/e2e/type-swap.pw.ts#L514)

**Nothing brings a local face back**

- The retired-family guard: comments stripped, path match anchored, `@font-face` refused in stylesheets.
  [`anchor-contract.test.ts:73`](../../app/__tests__/anchor-contract.test.ts#L73)

- The case itself, in the slot the deleted local-face test held.
  [`anchor-contract.test.ts:636`](../../app/__tests__/anchor-contract.test.ts#L636)

- No tracked path under `public/fonts/`, in the test that already reads `git ls-files`.
  [`anchor-contract.test.ts:1169`](../../app/__tests__/anchor-contract.test.ts#L1169)

- A third `--confillia-normal` site without its `font-stretch` line fails by name.
  [`anchor-aliases.pw.ts:624`](../../tests/e2e/anchor-aliases.pw.ts#L624)

**The counts move together**

- Sixteen to fifteen, twelve to thirteen, four to two, in the unit suite.
  [`anchor-contract.test.ts:169`](../../app/__tests__/anchor-contract.test.ts#L169)

- The same three in the browser suite.
  [`anchor-aliases.pw.ts:153`](../../tests/e2e/anchor-aliases.pw.ts#L153)

- The bare literal, and the single-quote assertion that lost its only subject.
  [`contract-anchor.pw.ts:599`](../../tests/e2e/contract-anchor.pw.ts#L599)

- Two distinct font preloads to none, the one pin the closures cite.
  [`narrative.pw.ts:834`](../../tests/e2e/narrative.pw.ts#L834)

- The tracked-file sentinel moved off a binary this story deletes.
  [`anchor-contract.test.ts:313`](../../app/__tests__/anchor-contract.test.ts#L313)

**The records**

- The ledger re-read: 23.00 to 32.00 tall, still under the floor, both files held equal.
  [`hit-target-floor.pw.ts:270`](../../tests/e2e/hit-target-floor.pw.ts#L270)

- The dated paragraph beside it.
  [`hit-target-floor.md:260`](../../ops/hit-target-floor.md#L260)

- Three families, zero unreached, zero preloaded: the reading pasted, actions 2 and 4 closed.
  [`asset-budget.md:471`](../../ops/asset-budget.md#L471)

- The emitted sentence, one arm, no story number in tool output.
  [`asset-budget.mjs:1605`](../../ops/asset-budget.mjs#L1605)

- Six rows across four of step 2's sections closed by name; O-6 left to the Operator.
  [`anchor-token-adoption.md:727`](../../ops/anchor-token-adoption.md#L727)

- DW-82 pointed at from the record that owns `size-adjust`.
  [`font-contract.md:466`](../../ops/font-contract.md#L466)

- The new row, one per browser spec.
  [`rendered-output-harness.md:52`](../../ops/rendered-output-harness.md#L52)

**Peripherals**

- DW-9 closed, the truncated fragment repaired.
  [`deferred-work.md:1152`](deferred-work.md#L1152)

- The stale Monument counts filed, with this story's own line drift named.
  [`deferred-work.md:4118`](deferred-work.md#L4118)

- The contact links narrow by a fifth across the swap: heights hold, widths do not, and why.
  [`deferred-work.md:4154`](deferred-work.md#L4154)
