# The Hub's focus standard and the manual accessibility pass

The written record of Story 2-26: the one focus rule the Hub now paints and the Satellites copy
by hand, the machine sweep that holds the ring, the DOM-order traversal, the built stylesheet's
depth tells and z-levels, the type floor and autoplay on every route the Hub serves, the four
manual checks `EXPERIENCE.md:777-779` fixes with each result and its date, the accent share of
the rendered homepage with its denominator, the Lighthouse readings that put `/cv` behind the
gate, and every finding with its owner. Nothing here is corrected out of scope: this story made
four fixes and recorded the rest (AD-19, AD-20).

Written during Story 2-26 on **2026-09-13** (ISO 8601 UTC), against baseline commit `3435ec3`.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/hit-target-floor.md`, `ops/status-mark-axes.md` and
`ops/cs-tracker-accessibility-pass.md` set: every value is marked **Observed** with the method
that gathered it or **Decision** with its reason (NFR-9), every date is ISO 8601 UTC, and a number
without a method is a claim. **Story ids are written hyphenated**, as `Story 2-26` and
`Story 2-31`, matching the keys in `_bmad-output/implementation-artifacts/sprint-status.yaml`;
`epics.md` writes the same ids dotted.

## The headline result

| Figure | Value | Nature |
|---|---|---|
| The focus rule | One global `:focus-visible` rule in `app/app.scss`, `RESTYLE-SPEC.md:326-341` § 4 verbatim on `--stroke-focus`, `--token-focus`, `--focus-offset` and `--r-hair`, replacing nine per-component blocks in eight stylesheets. **One deliberate exception since 2026-09-24**: `main:focus-visible` beside it draws the same ring from `--stroke-focus` and `--token-focus` inset by its own width, `calc(-1 * var(--stroke-focus))`, on the skip link's target alone (F-20) | **Decision.** Operator ruling of 2026-09-13 at this story's planning. The nine are deleted, not overridden. The exception is the Operator ruling of 2026-09-24, and `tests/e2e/accessibility-floor.pw.ts` allows an outline on that one selector in that one file and nowhere else |
| Routes swept | 5: `/`, `/work`, `/cv`, `/celeste` and `/a-route-that-does-not-exist` (the 404), derived from `app/` rather than listed | **Decision.** `routesOnDisk` in `tests/e2e/accessibility-floor.pw.ts`, less `/api/health` |
| Tab stops read | **39**: `/` 18, `/work` 7, `/cv` 9, the 404 5, `/celeste` 0; none inside an `aria-hidden` subtree, none disabled or inert. **Re-read 2026-09-24: 42**: `/` 18, `/work` 8, `/cv` 10, the 404 6, `/celeste` 0, the one new stop on each route with a visible header being the skip link, its first (DW-43) | **Observed 2026-09-13** in `mcr.microsoft.com/playwright:v1.62.1-noble` at 360 x 800, by tagging every tabbable in DOM order and pressing Tab once per tabbable from `body`. **Observed 2026-09-24** by the DW-43 accessibility package, the same sweep in the same image |
| Every stop computes the ring | `2px solid lab(79.9388 18.6867 -44.8585) at 3px`, `:focus-visible` true, `transition-property` `all` over `0s` on every stop, which never animates | **Observed 2026-09-13**, same run. The `lab()` string is Chromium's computed form of `--token-focus`; rasterised through a canvas it is `rgb(198, 189, 255)`. Computed, not painted whole: the next row is what a visitor sees |
| Stops that paint a fragment of the ring | **33 of 39 stops paint the ring whole. Six do not**, all on `/`: the two home nav links and the three contact links sit flush inside panels whose `clip-path` is bounded by the panel's own border box, so the ring paints on one or two sides only; the skip-link is parked at the viewport's top-left corner, so its top and left sides are past the edge when it is revealed. **Re-read 2026-09-21: one**, the skip-link alone. Story 2-29 gave `.home-panel` `padding: var(--s-sm)`, 12px on every side, which is more than the ring's 5px reach on a straight edge and more than the 10px corner cut on a notched one, so the five home stops ring whole inside a silhouette whose four polygons did not move. **Re-read 2026-09-23: none.** Story 2-32 parked the skip-link one ring-reach inside the viewport's corner when it is revealed, so all 39 stops paint the ring whole. **Re-read 2026-09-24: none of 42**, the three new skip links, inside the sticky header on `/work`, `/cv` and the 404, parked and revealed as `/`'s is | **Observed 2026-09-13** in the review re-run, by reading every stop's box against each ancestor's `clip-path` and `overflow` box and against the document's edge, within the ring's reach of 5px (offset plus stroke). Carried as the six `clip` rows of the ledger, Story 2-29's and Story 2-32's. **Observed 2026-09-21** by Story 2-29 in the pinned image, the same read, with its five rows deleted and `clip-skip-link` the one that remains. **Observed 2026-09-23** by Story 2-32 in the pinned image, the same read, with `clip-skip-link` deleted and the sweep green |
| The two skip targets ring on Enter | `main#main` after Enter on the skip-link and `h2#suite` after Enter on the skip control both match `:focus-visible` and compute `2px solid` at `3px`; the landmark's ring is clipped by the document's edge on its top, left and right, the heading's paints whole. **Re-read 2026-09-24 on every route**: `main#main` computes `2px solid` at `-2px` and nothing clips it on `/`, `/work`, `/cv` and the 404, each reached by Enter on the skip link its first Tab lands on; `h2#suite` unchanged (F-13, F-20; DW-127 for the hero's layers on `/`'s default door at 768 and wider) | **Observed 2026-09-13** in the review re-run. See § Decisions. **Observed 2026-09-24** in the pinned image by the landmark case, which also plants the old offset back on `/work` and is shown naming it and the clipped sides |
| Traversal in DOM order | Every route's stops equal its DOM-ordered visible tabbables; the extra Tab leaves the document; no `tabindex` computes above zero | **Observed 2026-09-13**, same run |
| The ring against its ground | `--token-bg` **11.73:1** on a shipped element; `--token-bg-raised` **11.24:1** and `--token-bg-raised-2` **10.47:1** on planted controls; the cybercore literal `#0a000f` **11.89:1** on `/work` and the 404's exits, and on `/` until 2026-09-21, and on the 404's exits until 2026-09-23 | **Observed 2026-09-13**, same run, WCAG 2.1 relative luminance on canvas-rasterised sRGB. The 3:1 non-text floor holds everywhere the ring can land. **Amended 2026-09-21** by Story 2-29, which replaced `HomeLayout.scss`'s `body[id='']` literal with `var(--token-bg)`, so every ring on `/` is read against the first ground in this row rather than the fourth. **Amended 2026-09-23** by Story 2-30, which deleted `error-page.scss`'s `#0a000f` ground with the file, so the 404's exits are read against the base rule's `--token-bg`; the sweep's list of grounds that are none of the three names `/work` alone, observed in the pinned image. **Amended 2026-09-23 by Story 2-33**, which deleted `body#work`, the last of the three literals: the sweep's list of ring grounds outside the three tokens reads `none` on every route in the pinned image, so every ring on `/work` is read against `--token-bg` too |
| The mouse paints nothing | 38 elements hovered (every tabbable but the parked skip-link), `outline-style` `none` under the pointer on each; one prevented click per route on a link and, where one exists, on a button, `:focus-visible` false and `outline-style` `none` after it | **Observed 2026-09-13**, same run |
| Focus and hover are different tokens | `--token-focus` `rgb(198, 189, 255)`, `--token-accent-hover` `rgb(173, 161, 255)`, `--token-accent` `rgb(143, 126, 240)`, pairwise different on every route | **Observed 2026-09-13**, same run, rasterised |
| z-index literals in the built CSS | **7**: `20`, `5`, `3`, `10`, and `2` three times, over 14 built stylesheets, all carried by ledger rows below; seven `--z-*` names read off the contract. **Re-read 2026-09-14: 6**, `20`, `5`, `3`, and `2` three times, over 13 built stylesheets, the `10` gone with the stylesheet that wrote it. **Re-read 2026-09-21: 3**, `2` three times, over 13 built stylesheets, the `20`, the `5` and the `3` gone with the home stylesheet that wrote them; four `--z-*` names are read off the contract in what ships, `--z-base` and `--z-raised` (both new to the build with this story), `--z-sticky` and `--z-tooltip`. **Re-read 2026-09-23: 2**, `2` twice, over 12 built stylesheets, the 404's `2` gone with the stylesheet that wrote it. **Re-read 2026-09-23 by Story 2-33: 0** over 12 built stylesheets, the hero's `2` twice gone with the stylesheet that wrote them | **Observed 2026-09-13**, same run, by reading `.next/static/chunks/*.css` as text. **Observed 2026-09-14** by Story 2-28, by reading the branch build's `.next/static/chunks/*.css` as text on the authoring host after `ScanlineOverlay.scss` was rewritten to `var(--z-raised)` and its two call sites removed (no chunk carries `.scanline-overlay`, so the stylesheet is not in the build at all), and by the sweep in the pinned image the same day, whose tally printed `z-index=2 x3, z-index=20 x1, z-index=5 x1, z-index=3 x1` over 13 built stylesheets. **Observed 2026-09-21** by Story 2-29, the same host read of `.next/static/chunks/*.css` after the branch build, which printed `z-index literals 2 x3` and no other value, and by the sweep in the pinned image the same day. **Observed 2026-09-23** by Story 2-30, the sweep in the pinned image printing `z-index=2 x2` over 12 built stylesheets and no other value. **Observed 2026-09-23** by Story 2-33, the sweep in the pinned image printing `observed nothing` over 12 built stylesheets |
| Depth tells in the built CSS | `text-shadow` **7**, `linear-gradient(` **6**, `radial-gradient(` **1**, `repeating-linear-gradient(` **1**, `box-shadow` **0**, `conic-gradient(` **0**, all carried by rows below. **Re-read 2026-09-14**: `text-shadow` **0**, the other five unchanged, eight in all. **Re-read again 2026-09-14**: `radial-gradient(` **0** and `repeating-linear-gradient(` **0**, `linear-gradient(` still **6**, six in all. **Re-read 2026-09-21**: `linear-gradient(` **4**, the home ground's pair gone with the stylesheet that wrote it, four in all. **Re-read 2026-09-23**: `linear-gradient(` **2**, the 404's grid pair gone with the stylesheet that wrote it, two in all. **Re-read again 2026-09-23 by Story 2-33**: none of the six, `/work`'s grid pair gone with `body#work`. **Re-read 2026-09-24 with a seventh tell**, every `url(` outside `@font-face` (DW-102): none of the seven; the build's three `url(` are the contract faces' `src`, inside `@font-face` | **Observed 2026-09-13**, same run. **Observed 2026-09-14** by Story 2-27, by reading the branch build's `.next/static/chunks/*.css` as text on the authoring host after `glitch-text.scss` and its seven `text-shadow` steps were deleted, and by the sweep in the pinned image the same day, whose tally printed `depth=linear-gradient x6, depth=radial-gradient x1, depth=repeating-linear-gradient x1` and no `text-shadow` over 14 built stylesheets. **Observed 2026-09-14** by Story 2-28, later the same day, the same two methods after the raster's vignette and scanlines were deleted: the host read counts `radial-gradient(` and `repeating-linear-gradient(` zero times across the thirteen chunks, and the pinned image's tally printed `depth=linear-gradient x6` and nothing else. **Observed 2026-09-21** by Story 2-29, the same host read after the branch build, which printed `linear-gradient( x4` and no other tell, and by the sweep in the pinned image the same day. **Observed 2026-09-23** by Story 2-30, the sweep in the pinned image printing `depth=linear-gradient x2` and no other tell. **Observed 2026-09-23** by Story 2-33, the same tally observing nothing. **Observed 2026-09-24** by the DW-43 accessibility package, the same tally with the `url(` count, printing `observed nothing` over 13 built stylesheets in the pinned image |
| Text reads | **318** across the five routes, 28 of them generated `::before` text (the timeline's `//` highlight markers), none under `--t-3xs`, no paragraph under `--t-2xs` outside the four labels `DESIGN.md` places there, no prose under `--t-sm`, nothing italic. **Re-read 2026-09-14: 331**, 28 generated, the same verdict: the home heading's thirteen non-blank character spans are read where its one `aria-hidden` `<h1>` was not, each at 36px in Bricolage Grotesque at 800. **Re-read 2026-09-23: 342**, 28 generated, the same verdict, the 404's heading read as the display entrance's character spans. **Re-read 2026-09-23 by Story 2-32: 345**, 28 generated, the same verdict, the wordmark read as text on `/work`, `/cv` and the 404 where the raster it replaced carried none. **Re-read 2026-09-23 by Story 2-33: 346**, 28 generated, the same verdict, the hero's meta line read as the Plate mark's two cells where it was one paragraph. **Re-read 2026-09-24: 349**, 28 generated, the same verdict, the skip link's label read on `/work`, `/cv` and the 404 now that each carries one; its new-tab mark is `aria-hidden` and not read | **Observed 2026-09-13** in the review re-run, which added the pseudo-elements; the first run read 290 elements and no generated text. **Observed 2026-09-14** by Story 2-27 in the pinned image. **Observed 2026-09-23** by Story 2-30 in the pinned image, and again by Stories 2-32 and 2-33. **Observed 2026-09-24** by the DW-43 accessibility package in the pinned image |
| Level-1 headings per route | `/` one, named `Luigi Espinosa`, off the accessibility tree; `/work`, `/cv` and `/celeste` one each; **the 404 none**. **Re-read 2026-09-23: the 404 one**, named `Page not found.`, so every route carries exactly one | **Observed 2026-09-13** in the review re-run by `getByRole('heading', { level: 1 })`. The 404 is the ledger's `heading-404` row, Story 2-30's. **Observed 2026-09-23** by Story 2-30 in the pinned image by the same read, with `heading-404` deleted |
| Synthesised weights | **2**: `.work-item__initiative` on `/work` and `/cv`, `font-weight: 600` on Geist Mono, whose published range is `400`. **Re-read 2026-09-23: 0**, the initiative line asking for no weight of its own since Story 2-31 rebuilt `WorkItem.scss`, which deleted the ledger row in the same commit | **Observed 2026-09-13**, same run; ledger row `weight-work-initiative`. **Observed 2026-09-23** by Story 2-31 in the pinned image, the sweep printing `synthesised weights: none` |
| Families outside the contract | **23** elements, skipped rather than judged on weight, all three shapes booked below: `sans-serif` on the header's labels, `system-ui` on `/celeste`'s heading, and the user agent's button face on the timeline's role and period spans. **Re-read 2026-09-23: 7**, the header's six labels across `/work`, `/cv` and the 404 and `/celeste`'s heading; the sixteen timeline spans left with Story 2-31, whose trigger inherits the page's type and whose meta line sets the mono family itself (F-3). **Re-read 2026-09-23 by Story 2-32: 1**, `/celeste`'s heading alone: the header's six labels set the mono family since that story rebuilt the nav (F-1) | **Observed 2026-09-13**, same run. **Observed 2026-09-23** by Story 2-31, the sweep's off-contract list in the pinned image, and by Story 2-32 the same way |
| `font-size` in `px` under `app/` and `components/` | **none** | **Observed 2026-09-13**, by the spec's scan of every `.scss`, comments stripped |
| Autoplay | **nothing**: no `video`, `audio`, `marquee`, refresh meta or `[autoplay]` on any route | **Observed 2026-09-13**, same run |
| The scrim's composited contrast on `/` | **Five roles sampled, every one above the table and clear of its floor**: `--token-text` 17.66:1, `--token-focus` 11.80:1, `--token-accent-hover` 9.07:1, `--token-text-secondary` 7.07:1, `--token-accent` 6.24:1, all against a ground sampled at `rgb(5, 4, 9)` beneath all four panels. **Re-read 2026-09-24**: three panels, the readout's removed (DW-110), the same ground and the same five ratios | **Observed 2026-09-21** by Story 2-29 in the pinned image at 1024 x 800 on the default door, by screenshotting the composited surface and reading each panel's modal ground through a canvas. See § The scrim's composited contrast on the home surface |
| Accent share of the homepage viewport | **0.17%** at 360 x 800, **0.05%** at 1280 x 800, scroll top, reduced-motion door | **Observed 2026-09-13** by `ops/hub-accessibility-probe.mjs`. Not a gate (RESTYLE-SPEC F-8, `RESTYLE-SPEC.md:654`) |
| Lighthouse | `/` 1.00 / 1.00 / 1.00, `/work` 1.00 / 1.00 / 1.00, `/cv` 0.96 / 1.00 / 1.00 (accessibility / best practices / SEO). **Re-read 2026-09-14** with the new heading markup: `/` 1.00 / 1.00 / 1.00, `/work` 1.00 / 1.00 / 1.00, `/cv` 0.96 / 1.00 / 1.00, every run; on `/`, `aria-prohibited-attr` and `heading-order` both pass on all three runs. **Re-read 2026-09-23** by Story 2-31 in the pinned image: `/` 0.96 / 1.00 / 1.00, `/work` 1.00 / 1.00 / 1.00, `/cv` 1.00 / 1.00 / 1.00, every run; `/cv`'s `color-contrast` now passes (F-5), and `/`'s fails on six `aria-hidden` ornaments none of which is that story's (DW-113). **Re-read 2026-09-24** by the DW-113 home-surface package in the pinned image: `/`, `/work` and `/cv` 1.00 / 1.00 / 1.00 on every run, `color-contrast` passing everywhere, the seven ornaments CSS generated content; `/` and `/work` read 0.96 on the package's baseline in the same image | **Observed 2026-09-13** locally, Lighthouse 12.6.1, three runs per URL. `/cv` joined `.lighthouserc.js`. **Observed 2026-09-14** by Story 2-27, `@lhci/cli` 0.15.1 driving Lighthouse 12.6.1 under headless Chrome 152.0.0.0 against `corepack pnpm build` and `corepack pnpm start --port 3000`, `lhci collect` then `lhci assert`, three runs per URL, every assertion green. **Observed 2026-09-23** by Story 2-31, the same two tool versions under the Chromium that `mcr.microsoft.com/playwright:v1.62.1-noble` ships, the build taken with the Umami variables empty as the workflow takes it, `lhci collect` then `lhci assert`, three runs per URL, every assertion green, nothing uploaded |
| Fixed | Four things: the focus rule, `.site-footer__line` to `--t-2xs`, `GlitchText`'s wrapper as a heading, `/cv` in the Lighthouse gate | **Decision.** AD-19, AD-20: everything else is a ledger row or a finding |
| The spec in the pinned image | 14 cases, all green, **32.4 s** Playwright headline for the file alone, the sweep case **5.6 s**; 11 cases, **25.8 s** and **4.3 s** before the review pass added the clip read, the Enter read and the heading count. **Re-read 2026-09-21** by Story 2-29: **15 cases**, all green, **33.8 s** summed from the list reporter's per-case durations, the built-CSS sweep case **7.3 s** and the new scrim case **18.0 s**, which screenshots the composited surface twice and decodes both through a canvas | **Observed 2026-09-13**, both runs. **Observed 2026-09-21** by Story 2-29 in the same image |
| The whole suite in the pinned image | 22 spec files, **245 tests**, all green, **4.1 min** Playwright headline after the review pass (242 tests, 3.9 min before it); no snapshot directory written by this file. **Re-run 2026-09-14**: 23 spec files, **253 tests**, all green, **5.6 min**, `display-entrance.pw.ts` the eight new cases and the `shadow-glitch-loop` row gone. **Re-run again 2026-09-14** by Story 2-28: 23 spec files, **253 tests**, all green, with the three `ScanlineOverlay` ledger rows fewer and the `/work` baseline regenerated; **5.3 min**, **5.5 min** and **4.6 min** on the story's three plain runs (before the update, after it, and after the forced update), and **6.7 min** on the coordinator's independent plain run on the final tree. **Re-run 2026-09-21** by Story 2-29: **261 tests**, all green, **7.6 min**, with the scrim's sampling case added here and eight cases where there were four in `front-door.pw.ts` (DW-98). **It took three runs, and the first two are the finding.** The first reported three failures and the second five, and every one was a consequence of this story that had to be measured rather than a defect in it: `home-nav` going stale because the display step took the first nav link past the hit-target floor, the entrance's inline-declaration sweep observing nothing once the timeline became a keyframe, the collapse margin at 1024 narrowing from 152.95 to 104.83 as the flat hero grew, the `/#suite` landing reading -0.31 on a hero with fractional heights, and two ledger controls hosted on rows this story deleted. `git status --porcelain -- tests/e2e/accessibility-floor.pw.ts-snapshots` was empty on all three and the committed `/work` baseline matched on all three. **Re-run again 2026-09-21** after the audit of that story: **262 tests**, all green, **8.0 min**, the count up one on the below-768 case the audit added to `front-door.pw.ts` for the matrix row nothing covered. **Re-run again 2026-09-22** after the Step-04 review of the same story: **264 tests**, all green, **6.2 min**, the count up two on the skip control's non-overlap case at each of the two widths. That review found a third assertion in the story that could not fail and two more that were porous, so the run before this one is not evidence for the patch and this one is: it was taken on the committed code with only record markdown edited afterwards, and no Playwright spec reads a record. **Re-run 2026-09-23** by Story 2-31: **287 tests**, all green, **8.3 min**, the count up twenty-four on `plate-mark-and-work-item.pw.ts`, taken after the `/work` baseline was regenerated; the plain run before the regeneration failed the baseline comparison and its capability guard and nothing else (284 passed, the new file then carrying twenty-three cases). **Re-run again 2026-09-23** after the Step-04 review of the same story: **287 tests**, all green, **7.5 min**, the count unchanged, because the review strengthened an existing case rather than adding one: the CSS-off read in `plate-mark-and-work-item.pw.ts` now fails a label carrying a `//`, and the row's stylesheet lost one inert declaration. No snapshot was written and the `/work` baseline is still `7c059024...`. **Re-run 2026-09-23** by Story 2-30: **300 tests**, all green, **5.7 min**, the count up thirteen: fifteen cases in the new `error-surface.pw.ts`, less the 404's subordinate-line case in `plate-mark-and-work-item.pw.ts` (the 404's mark is the section variant and has none) and the `--monument-regular` clamp case in `anchor-aliases.pw.ts` (no call site left for it to protect). **The first of three runs failed one case, and it was the new file's own**: the entrance read compared the element's `0.22s` with the token stream's `220ms` divided by a thousand, 299 passed; the read takes both roles through a probe now, and the two runs after it were 300 of 300 (6.1 min, then 5.7 min after the Step-04 review's patches). No snapshot was written and the `/work` baseline is still `7c059024...`. **Re-run 2026-09-24** by the DW-113 home-surface package: **335 tests**, all green, **6.0 min**, the count up with that package's new cases; its first unfiltered run was 334 of 335, one of its own cases reading a hit-test after its Tab had scrolled the hero away, fixed the same day (`spec-dw-113-home-surface.md` § Verification). No snapshot was written and the `/work` baseline did not move. **Re-run 2026-09-24** by the DW-43 accessibility package: **338 tests**, all green, **5.8 min**, on the package's final code at `786e676`. Its first unfiltered run was 334 of 338, four failures each a consequence of the package measured rather than a defect in it: the landmark read took a 0.02px rounding of `scrollHeight` on `/cv` for a clip once the inset ring's reach was zero (the edge read now takes the root's own box), the root read in `anchor-aliases.pw.ts` met the minifier's two `light-dark()` switches beside `color-scheme` (admitted there by name, on that rule alone), the hit-target pins moved by the skip link (read off the run), and the `/celeste` link reader counted the skip link's own fragment (a fragment alone is left out now). No snapshot was written and the `/work` baseline did not move | **Observed 2026-09-13**, `pnpm test:e2e` in the same image, both runs, then `git status --porcelain -- tests/e2e/accessibility-floor.pw.ts-snapshots`, which was empty. **Observed 2026-09-14** by Story 2-27, same command, same image. **Observed 2026-09-14** by Story 2-28, same command, same image, the story's runs earlier in the day and the coordinator's after them. **Observed 2026-09-21** by Story 2-29, same command, same image, three runs. **Observed 2026-09-23** by Story 2-31, same command, same image, before its review and after it. **Observed 2026-09-23** by Story 2-30, same command, same image, three runs |

## Environment

| Property | Value | Nature |
|---|---|---|
| Image | `mcr.microsoft.com/playwright:v1.62.1-noble`, the `rendered-output` job's | **Decision.** `ops/rendered-output-harness.md` |
| Viewport | 360 x 800 at device scale factor 1, `reducedMotion: 'reduce'`, `colorScheme: 'light'` | **Decision.** `playwright.config.ts`, the project's context. The skip control's case opens its own `no-preference` context because that control renders on the animated door only |
| Server | `pnpm build && pnpm start --port 3100`, started by Playwright's `webServer` | **Decision.** Same as every other spec |
| Probe host | Windows 11, Playwright's Chromium 151.0.7922.34, Node 24.15.0, `sharp` 0.34 | **Observed 2026-09-13**. The probe writes renders a person looks at and is not a gate, so it ran on the authoring host |
| Lighthouse | `@lhci/cli` 0.15.1 driving Lighthouse 12.6.1 under headless Chrome 152.0.0.0, mobile emulation 412 x 823 at 1.75, against `corepack pnpm build` and `corepack pnpm start` on port 3000, `numberOfRuns: 3` | **Observed 2026-09-13**. `lhci collect` then `lhci assert`, never `autorun`, because `upload.target` is public storage and a local reading has no business there |

## The four manual checks

`EXPERIENCE.md:777-779` fixes verification as four checks, all manual, all cheap, sized for one
person. Each is recorded here with the method that answered it and the date, because a check
that leaves no record cannot be re-run against a regression. Two of them have a machine half
that runs on every push and a human half only the Operator can answer; the human halves are the
two tables that follow this section, and the board cannot reach `done` while either reads
`_not yet performed_` (`ops/__tests__/hub-accessibility-pass.test.ts`).

| # | Check | Method | Result | Nature |
|---|---|---|---|---|
| 1 | Keyboard-only traversal of the homepage | **Machine half.** `tests/e2e/accessibility-floor.pw.ts` tags every visible tabbable on `/` in DOM order, presses Tab from `body` once per tabbable, reads which element holds focus and its ring at each stop, then presses Tab once more. **Human half.** The Operator, in their own browser, with the mouse untouched: the table below | **18 stops on `/` in DOM order** (the skip-link, two nav links, three contact links, eleven Suite Directory links, the footer link), every stop ringed, **six of them as a fragment** (the skip-link, the two nav links and the three contact links, § The focus standard; **one of them since 2026-09-21**, the skip-link alone, Story 2-29 having padded the panels that clipped the other five), the nineteenth Tab leaving the document, no positive `tabindex`, Enter on the skip-link ringing the landmark it lands on, and clicking the same stops ringing nothing. The one Satellite `EXPERIENCE.md` names is `cs-tracker`, recorded on 2026-08-27 in `ops/cs-tracker-accessibility-pass.md` | **Observed 2026-09-13** in the pinned image; the human half awaits the Operator |
| 2 | 360px viewport with no horizontal scroll and no truncated Status | `tests/e2e/hit-target-floor.pw.ts` measures every interactive element's edges against the viewport at 360 on every route (A-5's scroll half); `tests/e2e/status-mark.pw.ts` measures every rendered Status mark's box for clipping, ellipsis and wrap (A-5's Status half). Both ran in the same container invocation as the full suite | **No interactive element outside either edge on any route; no Status truncates or wraps.** The 28 non-interactive elements past the right edge on `/work` are KV-5, Stories 2-31 and 2-33, and are deliberately not re-measured here | **Observed 2026-09-13**, the whole `pnpm test:e2e` run in the pinned image |
| 3 | Greyscale render with the Status taxonomy still readable | **Machine half.** `tests/e2e/status-mark.pw.ts` asserts the three structural axes and reads greyscale in the print medium. **Human half.** `ops/hub-accessibility-probe.mjs` renders `/` at 360 x 800 and 1280 x 800 with one of each of the four values planted across the six marks, the dot removed from the three that do not carry one, and `html { filter: grayscale(1) }` applied; the Operator reads the two PNGs with no legend: the table below | **Two PNGs written** to the `--out` directory on 2026-09-13; the axes assertion is green in the same run as check 2. The 2026-09-06 confirmation in `ops/status-mark-axes.md` stands and is confirmed alongside, not replaced | **Observed 2026-09-13** for the renders; the human half awaits the Operator |
| 4 | `prefers-reduced-motion` forced and the Suite Directory fully reachable | Every case in `tests/e2e/accessibility-floor.pw.ts` runs on the project's `reducedMotion: 'reduce'` context, which is the forced preference: the traversal on `/` reaches all eleven Directory links by Tab, each ringed, and the prevented click lands on one. `tests/e2e/front-door.pw.ts` asserts the flat door's layout and the skip-link on the same context | **Reachable**: the eleven Directory links are stops 7 to 17 of the 18 on `/`, and `/#suite` resolves to the heading with `tabindex="-1"` (`app/__tests__/page.test.tsx`) | **Observed 2026-09-13** in the pinned image |

## The Operator's greyscale confirmation

The human half of check 3. The machine evidence is what makes the check re-runnable; this table
is the confirmation, and it is recorded because a check that leaves no record cannot be re-run.

| Field | Value |
|---|---|
| Method | Read the two PNGs `node ops/hub-accessibility-probe.mjs --base-url http://127.0.0.1:3100 --out <dir>` writes, `home-greyscale-360x800.png` and `home-greyscale-1280x800.png`, or render `/` in a browser with `html { filter: grayscale(1) }` applied and the four values planted across the marks as `ops/status-mark-axes.md:249` describes. With no legend to hand, confirm the four Status values are tellable apart: `Live` by the dot, `Complete` by the solid border, `In progress` by the dashed border, `Archived` by no border |
| Checked by | The Operator |
| Checked on | 2026-09-14 |
| Result | **Pass.** Read on the two PNGs the probe wrote at 2026-09-14T00:54Z against the production build served on this host at `acb0c55`, the six marks planted `Live`, `Complete`, `In progress`, `Archived`, `Live`, `Complete`. All four Status values tellable apart in greyscale with no legend, at both widths |

## The Operator's keyboard confirmation

The human half of check 1.

| Field | Value |
|---|---|
| Method | Open `/` in your own browser at any width with the mouse untouched. Press Tab from the top of the document until focus leaves it, counting the stops: the skip-link first, then the two nav links, the three contact links, the eleven Directory links and the footer link. Every stop shows the ring, at full strength the moment it lands. **Expect a fragment, not a whole ring, on one of them today**: the skip-link shows its bottom and right sides only, because it is parked at the viewport's corner (§ The focus standard, Story 2-32's). **This read six until 2026-09-21**, the two nav links and the three contact links showing one or two sides because their panels clipped the ring; Story 2-29 padded those panels and the five ring whole now. The Directory links and the footer link show it whole. Then press Tab until the skip-link holds focus again and press Enter: focus lands on the main landmark and its bottom edge rings across the page. Then click the same elements with the mouse: no ring appears on any of them |
| Checked by | The Operator |
| Checked on | 2026-09-14 |
| Result | **Pass.** One keyboard-only traversal of `/` in the Operator's own browser against the production build served on this host at `acb0c55`, mouse untouched: every stop ringed the moment it landed, the six recorded fragments as described and no seventh, the main landmark ringed after Enter on the skip-link, and a mouse click on the same elements painted nothing. **The confirmation stands for its date and is not re-taken here.** It was read against the surface as Story 2-28 left it; five of its six fragments closed on 2026-09-21 with Story 2-29, which is a change in the Hub's favour and is recorded in the method above rather than by rewriting a dated reading |

## The focus standard

**The rule, and where it is.** **Decision.** `app/app.scss`, after the reset, at specificity
(0,1,0), `RESTYLE-SPEC.md:326-341` § 4 verbatim on the four roles it names:

```
:focus-visible {
  outline: var(--stroke-focus) solid var(--token-focus);
  outline-offset: var(--focus-offset);
  border-radius: var(--r-hair);
}
```

**Why one global rule.** **Decision**, the Operator's ruling of 2026-09-13. Until this story the
Hub painted its ring nine times in eight stylesheets. Five were the standard verbatim
(`SkipLink.scss`, `SkipControl.scss`, `CvIntro.scss`, `SiteFooter.scss`, `SuiteDirectory.scss`)
and four, in three files, were `1px solid var(--accent)`, the hover token: three at a `4px` offset,
on the home nav links and the home contact links (`HomeLayout.scss`, two blocks, in the file as
Story 2-26 found it; Story 2-29 rebuilt it on 2026-09-21 and the citation is history rather than a
place to look) and on the 404's exits (`error-page.scss`), and one inset at `-2px`, on the
timeline's triggers (`WorkItem.scss`),
so a keyboard visitor on those surfaces could not tell focus from hover (A-1).
One rule replaces all nine; a component that needs the ring needs nothing, and a component that
wants to remove it has to write `outline: none`, which the sweep names. The rule stays at
(0,1,0) on purpose: the two planted controls in `tests/e2e/cv.pw.ts` and
`tests/e2e/secondary-surfaces.pw.ts` take the ring off with a scoped `!important` to prove the
reading is of this rule, and would stop proving it if the rule outranked them.

**What the ring was read against.** **Observed 2026-09-13** in the pinned image. Every stop's
`outline-width`, `outline-style`, `outline-color`, `outline-offset`, `transition-property` and
`transition-duration` were read off `getComputedStyle` while it held focus after a real Tab, and
compared with `--stroke-focus`, `--token-focus` and `--focus-offset` resolved through a probe
element on the same page, never typed. Every one of the 39 stops read `2px solid lab(79.9388
18.6867 -44.8585) at 3px`, `:focus-visible` true, `transition-property` `all` over `0s`. `all` is
the initial value of that property on every element; only a duration above zero makes it a
transition, and none was found.

**The ring against the three grounds, and the one that is none of them.** The ground under a
ring is the first painted `background-color` walking from the focused element's parent to the
root, the colour of an ancestor that also paints a `background-image` being read with the image
named beside it.

| Ground | Where it was read | Ring contrast | Nature |
|---|---|---|---|
| `--token-bg` (`rgb(6, 5, 9)`) | The 404's logo link, on `.header-container`, which paints `--token-bg` under the sticky header; the same header on `/work` and `/cv` | **11.73:1** | **Observed 2026-09-13**, on a shipped element |
| `--token-bg-raised` (`rgb(14, 12, 20)` by `oklch`, `lab(3.62 0.99 -3.09)` as computed) | A **planted** link inside a wrapper painting the role, appended to the 404, because no shipped interactive element sits on this ground on any route: the skip-link paints it on itself, and a ring is drawn outside the element | **11.24:1** | **Observed 2026-09-13**, labelled planted in the run's own output |
| `--token-bg-raised-2` (`lab(7.10 1.63 -4.87)` as computed) | The same **planted** control, because nothing in the Hub paints this ground at all today | **10.47:1** | **Observed 2026-09-13**, planted |
| `#0a000f` (`rgb(10, 0, 15)`), none of the three | `.error-page` under the 404's two exits; `body#work` under every stop on `/work`. Each also paints the cybercore grid as two `linear-gradient` images at 6% alpha, named in the reading and carried as ledger rows below. **`body[id='']` on `/` left this row on 2026-09-21**: Story 2-29 replaced that rule's literal and its grid pair with `var(--token-bg)`, so every home stop's ring is now read against the first ground in this table rather than against a fourth one. **`.error-page` left this row on 2026-09-23**: Story 2-30 deleted `error-page.scss` with its literal and its grid pair, and the rebuilt surface paints no ground of its own, so the 404's exits stand on the base rule's `--token-bg` and `body#work` is the one surface left on this literal. **`body#work` left this row on 2026-09-23 too, and no surface paints the literal since**: Story 2-33 deleted the rule with its grid pair, so `/work`'s stops are read against the base rule's `--token-bg` | **Observed 2026-09-13**. Read as what it is: a literal Stories 2-30 and 2-33 own, not a token ground. The ring is visible on it; the finding is the literal, not the ring. **Observed 2026-09-23** by Story 2-30 in the pinned image: the sweep's grounds that are none of the three list `/work` alone. **Observed 2026-09-23** by Story 2-33 in the pinned image: that list reads none |

`RESTYLE-SPEC.md:342` publishes 11.70 / 11.19 / 10.45 for the same three grounds. The readings
here are within 0.05 of each, the difference being the canvas rasterisation of `oklch` into sRGB
at 8 bits per channel.

**Focus and hover are two signals.** **Observed 2026-09-13**, rasterised on every route:
`--token-focus` `rgb(198, 189, 255)`, `--token-accent-hover` `rgb(173, 161, 255)`,
`--token-accent` `rgb(143, 126, 240)`, pairwise different, asserted on every route before any ring
is read.

**The mouse.** **Observed 2026-09-13.** Every tabbable but the skip-link was hovered by moving the
pointer to the centre of its box after scrolling it into view; each matched `:hover` and painted
`outline-style` `none`. The skip-link is parked above the viewport by `translateY(-100%)` and a
pointer cannot be put over it, which the run records rather than skips, and the case refuses any
other element in that state. One click per route, with a capture-phase listener calling
`preventDefault` so no navigation happens, on the first link that is not the skip-link and on the
first accordion trigger where the route has one: focus landed on the clicked element, `:focus-visible`
did not match, `outline-style` was `none`, and the pathname was unchanged.

**The skip control.** **Observed 2026-09-13** on a context that has not asked for reduced motion,
the animated door: `.skip-control` is among the first ten Tab stops and paints the standard ring,
whole. It does not render on the project's reduced-motion context at all, which is why it has its
own case.

**Six stops paint a fragment of the ring, and computed style cannot see it.** **Observed
2026-09-13** in the review re-run, and the one serious finding of the review. **One since
2026-09-21**, the skip-link alone: the reading below is kept as it was taken and the four home rows
of its table carry their closure beside them. `getComputedStyle`
answers the ring's four values whatever an ancestor does to them, so the first run's "every stop
paints the ring" was green for five stops on `/` where a keyboard visitor sees one or two sides.
The sweep now walks every ancestor of the focused element and reports any whose `clip-path` is
not `none`, or whose `overflow` on an axis is not `visible`, with its clipping box within the
ring's reach of the element's box, the reach being `outline-offset` plus `outline-width`, 5px
here; and any side where the element's own box is within that reach of the document's edge (the
viewport's, for a fixed element). What it found:

| Stop | Clipped on | By | Owner |
|---|---|---|---|
| `a.skip-link` | top, left | The viewport's edge: the link is parked at `inset-block-start: 0; inset-inline-start: 0` (`SkipLink.scss:33-34`) and revealed in place, so the ring's top and left sides sit past the edge and `overflow-x: clip` on the root clips them | **Closed 2026-09-23 by Story 2-32**, which took the row it was booked by ownership of the top-of-page chrome: the link is parked one ring-reach inside the corner and its ring lands whole |
| `a.nav-link`, first | top, left, right | `.home-panel--nav` carries `clip-path: polygon(...)` bounded by its own border box and no padding (`HomeLayout.scss:62` as read on 2026-09-13), and the link fills the panel's width | **Closed 2026-09-21 by Story 2-29**, with the panel |
| `a.nav-link`, second | left, right | The same panel | **Closed 2026-09-21 by Story 2-29** |
| `.contact-container a`, first | top, left | `.home-panel--contact`'s `clip-path` (`HomeLayout.scss:69` as read on 2026-09-13), no padding, the link a full-width block | **Closed 2026-09-21 by Story 2-29** |
| `.contact-container a`, second and third | left | The same panel | **Closed 2026-09-21 by Story 2-29** |

The other 33 stops paint the ring whole. Each of the six was a `clip` row in the ledger below when
this was written, and one still is,
tallied by the stop's selector, so a repair that pads the panel or moves the clip fails the row
as stale on the commit that makes it. **The reach is read off the element, never typed**, so a
contract that widened the offset would widen what counts as clipped.

**Five of the six closed on 2026-09-21, and the mechanism above is what forced them to.** Story
2-29 rebuilt `HomeLayout.scss` and gave `.home-panel` `padding: var(--s-sm)` on every side, 12px,
which clears both the ring's 5px reach on a straight edge and the notch's 10px corner cut, so the
four polygons are byte-identical and no ring falls outside the clipped region. The two ledger rows
`clip-home-nav` and `clip-home-contact` were deleted in that commit, which is what the stale-row
check required rather than permitted. `clip-skip-link` was untouched then and was Story 2-32's.

**The sixth closed on 2026-09-23 with Story 2-32.** `SkipLink.scss` parks the link at
`calc(var(--focus-offset) + var(--stroke-focus))` from the viewport's top and left edges, the ring's
reach summed from the two roles rather than written, and hides it by its own height plus that inset,
so nothing of the box shows while it is parked and the ring lands whole when it is revealed. The
sweep reads the reach off the element and calls a side clipped when the edge is closer than the reach;
at exactly the reach it is not, and the ledger's last `clip` row went stale and was deleted in the same
commit. **Observed 2026-09-23** in the pinned image.

**The trigger's ring paints outside a full-width button.** **Observed 2026-09-13** in the review
re-run. `button.work-item__header` is `width: 100%` inside `article.work-item`, whose `::before`
is the 2px accent bar at the article's left edge; the button's box and the article's are the same
216px wide at 360, and the ring is drawn 3px outside the button, so its left side paints over the
bar and its top and bottom sides paint into the rows above and below. Before this story the
trigger painted an inset ring, `outline-offset: -2px`, inside its own box. The global rule is
right and the trigger's geometry is Story 2-31's to settle when it rebuilds `WorkItem`
(`WorkItem.scss:20-32`); nothing here is clipped, so it is a finding (F-19), not a ledger row.
**Settled 2026-09-23 by Story 2-31.** The row now pads its trigger by `--s-xs` above, below and at
its end and by `--s-md` at its start, so the ring's 5px reach falls inside the row's own box and 11px
clear of the leading rule; the global rule is unchanged. **Observed 2026-09-23** in the pinned image
by `tests/e2e/plate-mark-and-work-item.pw.ts`, which tabs every trigger on `/cv` and holds each ring's
reach box inside its row and clear of the rule.

**The two skip targets ring on keyboard activation.** **Observed 2026-09-13** in the review
re-run. Both targets carry `tabindex="-1"` and are never Tab stops, so the sweep never lands on
them; a keyboard visitor reaches them through Enter. After Tab to the skip-link and Enter,
`main#main` holds focus, matches `:focus-visible` and computes `2px solid` at `3px`; on the
animated door, after Tab to the skip control and Enter, `h2#suite` does the same. The landmark is
the full width of the document with no page padding, so its ring is clipped by the document's edge
on the top, left and right and what a visitor sees is its bottom edge, a line across the page under
the Directory; the heading sits inside the Directory's padding and rings whole. See § Decisions.

## The scrim's composited contrast on the home surface

Added 2026-09-21 by Story 2-29, which placed `ScanlineOverlay` inside `.home-gem` across the home
canvas and so gave `--token-scrim` its first consumer. `epics.md:3254-3261` asks for the guarantee
to be verified by **screenshotting the composited surface, sampling the rendered ground beneath the
text and computing the ratio by hand**, never by trusting the table, and DW-101 carried that
verification from Story 2-28 to this one because until now no surface composited the layer beneath
text.

**Observed 2026-09-21** in `mcr.microsoft.com/playwright:v1.62.1-noble`, by
`tests/e2e/accessibility-floor.pw.ts` § the scrim over the home canvas, on a `no-preference`
context so the default door renders. The viewport screenshot is decoded through a canvas in the
page, and the ground beneath each panel's text is read as the **modal** colour of that panel's box,
the glyphs covering a minority of it.

**Read at 1024 x 800, not at DW-101's stated 360 x 800.** Below 768 `HomeLayout.scss` stacks the
hero into a flex column, the gem becomes a static item between the name and the nav, and the mobile
block hides the scrim because no text overlays imagery there. At 360 there is no composited surface
to sample; 1024 is the narrowest width at which the four panels sit over the canvas.

| Ground sampled | Where | Share of the box | Nature |
|---|---|---|---|
| `rgb(5, 4, 9)` | `.home-panel--name` | 60.8% of 80,852px | **Observed 2026-09-21** |
| `rgb(5, 4, 9)` | `.home-panel--sys` | 70.2% of 6,996px | **Observed 2026-09-21** |
| `rgb(5, 4, 9)` | `.home-panel--nav` | 75.8% of 52,392px | **Observed 2026-09-21** |
| `rgb(5, 4, 9)` | `.home-panel--contact` | 74.5% of 29,600px | **Observed 2026-09-21** |

**Re-read 2026-09-24 over three panels.** The Operator's ruling of that day removed the readout
panel (DW-110), so the `.home-panel--sys` row above reads a panel that no longer exists; it is kept,
as this file keeps every reading. The same case in the same image samples `.home-panel--name` at
63.8% of 80,852px, `.home-panel--nav` at 72.4% of 52,392px and `.home-panel--contact` at 74.4% of
29,600px, every one `rgb(5, 4, 9)`, and the five ratios below are unchanged to two places. Over the
repainted scrim each of the three paints an exact hit on a role (nearest distance 0.0), so the
hairline probe the readout's small type needed left with it. **Observed 2026-09-24.**

| Role | Measured over the sampled ground | `epics.md:3254-3256` | Its own floor | Nature |
|---|---|---|---|---|
| `--token-text` | **17.66:1** | 13.51:1 | 4.5:1 (WCAG 1.4.3) | **Observed 2026-09-21** |
| `--token-focus` | **11.80:1** | 9.02:1 | 3:1 (WCAG 1.4.11) | **Observed 2026-09-21** |
| `--token-accent-hover` | **9.07:1** | 6.94:1 | 4.5:1 | **Observed 2026-09-21** |
| `--token-text-secondary` | **7.07:1** | 5.41:1 | 4.5:1 | **Observed 2026-09-21** |
| `--token-accent` | **6.24:1** | 4.77:1 | 4.5:1 | **Observed 2026-09-21** |

Each role's colour is rasterised through the same 1 by 1 canvas the ring readings use, and the ratio
is WCAG 2.1 relative luminance on the sampled sRGB. The figure recorded is the **worst** of the four
panels for that role, and all four sampled the same ground.

**Every measured ratio is above the tabled one, and that is the table being read correctly rather
than a disagreement.** **Derived.** The table is the worst case: the scrim's 0.88 alpha over a
**pure white** backdrop. The real backdrop is the near-black narrative canvas over `--token-bg`, so
the composite is darker than the worst case and every role contrasts better against it. What the
table fixes is the floor, and the floor holds with margin.

**That the scrim is genuinely beneath the text is proved by sampling, not by reading a z-index.**
**Observed 2026-09-21**, same run. The layer is repainted an unmistakable colour and the surface
screenshotted again: beneath every one of the four panels the ground becomes that colour, which
says the scrim covers the imagery there, and a panel still paints a role colour over it, which says
the panel is above the scrim. Neither half depends on what the WebGL canvas draws, which is what
makes this readable in a container running SwiftShader.

**The z-level trap `epics.md:3300-3304` names is resolved by the header not being on this route.**
**Observed 2026-09-21**, same case, which reads zero `.header-container` on `/`: `Header.tsx:12`
returns `null` there, so no `--z-sticky` element exists to sit above a `--z-raised` scrim and
compute against the imagery. The other permitted resolution also holds and is not relied on
(`header.scss:59` sets `background-color: var(--token-bg)`), and neither was read off a `z-index`
value.

**The stack itself is two roles and no more.** **Decision**, Story 2-29. `.home-gem` takes
`var(--z-base)` while positioned, which makes it a stacking context, so `ScanlineOverlay.scss`'s own
`var(--z-raised)` is confined to it: the scrim paints above the canvas and below everything outside
the gem. The four panels and `.skip-control` take `var(--z-raised)` at container level and so clear
the gem's whole subtree, scrim included. The contract's next level above `--z-raised` is
`--z-dropdown` at 100, and a corner panel is not a dropdown.

## The exemption ledger

**Every row names the story whose redesign owns the file.** **Decision.** Story 2-26 ships the
instrument and makes four fixes, none of them in a redesign story's file; the breaches the
built CSS and the type sweep found are booked to Stories 2-27 to 2-33, each of which rebuilds
the stylesheet its rows point at. A row is deleted by the commit that repairs the file, or the
sweep fails as stale on that commit.

`ops/__tests__/hub-accessibility-pass.test.ts` holds this table and the `EXEMPTIONS` const in
`tests/e2e/accessibility-floor.pw.ts` equal **in both directions**: a row here with no entry there
fails, and an entry there with no row here fails the same way. Neither file is the only reader of
the other.

**One ledger, five kinds of row.** **Decision.** `Check` says which sweep the row belongs to
and what `Match` means there: for `z-index` the literal value as written in the built CSS; for
`depth` the property or gradient function as written; for `weight` a selector whose elements
compute a `font-weight` above their family's published range; for `clip` a selector whose
elements' ring is clipped within its reach by an ancestor or the document's edge; for `heading` a
route whose accessibility tree carries a number of level-1 headings other than one. **`Count` is
an expectation, not a note.** The sweep tallies occurrences per `Match` over the whole build, or
per selector or route over every route, and holds the sum of the rows' counts equal to it: a
repaired site with its row left behind fails as stale, a row whose count drifted fails naming both
numbers, and no row can be vacuous. Two rows may share a `Match` when two files carry the same
value, as the three `z-index: 2` do; their counts sum. **Every row's `Source` cites the lines that
carry the tell**, and `ops/__tests__/hub-accessibility-pass.test.ts` reads those lines off disk
and refuses a citation that a reflow has left pointing at something else.

**Every count below was read off the sweep's own output in the pinned image on 2026-09-13**,
never computed from a census of the source. The census the story's spec made by reading agreed
on every figure but one: it predicted eight synthesised weights and the run read two, because the
timeline carries an initiative line on one entry, not four.

| Id | Check | Match | Count | Source | Closed by |
|---|---|---|---|---|---|

**The ledger is empty since 2026-09-23, and KV-6 retired with it.** **Observed.** Story 2-33 deleted
the last two rows in the commit that repaired their files: `z-work-hero` closed with `WorkHero.scss`,
rebuilt against the contract with no `z-index` at all (its two `2`s had stacked the text and the canvas
over a scrim Story 2-28 took off the hero), and `gradient-work-ground` closed with `app/app.scss`'s
`body#work` rule, the cybercore literal under its two-gradient grid, deleted rather than tokenised, so
`/work` paints the base rule's ground as every route does. The header row stays, because an empty
table is how this record says the ledger is empty and `ops/__tests__/hub-accessibility-pass.test.ts`
reads it that way; that suite still refuses a record or a literal it cannot read. **The instrument
outlives the breaches**: a literal, a tell, a clipped ring, a synthesised weight or a route off the
one-heading rule fails the sweep on arrival, and a row can only come back as a dated ruling.

**The 404's three rows left on 2026-09-23 with Story 2-30**, which rebuilt the surface against the
contract, deleted `error-page.scss` and wrote `Error404.scss` beside the component. `z-error-content`
closed with the file: the new stylesheet sets no `z-index` at all, the content wrapper it sat on
going with the full-viewport centring it served. `gradient-error-ground` closed with the grid pair,
deleted rather than tokenised, and the surface paints no ground of its own over the base rule's.
`heading-404` closed with the display entrance as the surface's one `<h1>`, named `Page not
found.` by its own words. The `heading` check stands with no row, as the `weight` check has since
Story 2-31. **Every one was deleted in the same commit as the repair**, here and in `EXEMPTIONS`.

**The weight row left on 2026-09-23 with Story 2-31**, which rebuilt `WorkItem.scss` against the
contract. `weight-work-initiative` closed with the line it counted: `.work-item__initiative` sets the
mono family at the size and tracking of the row's metadata and asks for no weight, so it renders at the
`400` Geist Mono publishes and the sweep reads nothing synthesised on any route. It was the ledger's
only `weight` row, and the check stands with no row to claim a breach, which is the shape the ledger
is for. Deleted here and in `EXEMPTIONS` in the same commit.

**The six home rows left on 2026-09-21 with Story 2-29**, which rebuilt `HomeLayout.scss` against
the contract. `z-home-overlay` closed by deletion rather than by re-levelling: `.home-overlay` was
a rule no markup matched anywhere in the repository, so the `20` went with the rule. `z-home-panel`
and `z-home-gem` became `var(--z-raised)` and `var(--z-base)`, the two levels the stack needs and
no more, the gem positioned at the base level so it is a stacking context and the scrim inside it
is confined to it. `gradient-home-ground` closed with the grid pair, deleted rather than tokenised,
and the ground it sat on is `var(--token-bg)`. `clip-home-nav` and `clip-home-contact` closed with
`padding: var(--s-sm)` on `.home-panel`, the four polygons unmoved. **Every one was deleted in the
same commit as the repair**, which the sweep makes unavoidable rather than optional.

**Why `z-scanline` was a row although `10` equalled `--z-raised`.** The row left the ledger on
2026-09-14 with Story 2-28, which rewrote `ScanlineOverlay.scss` to `z-index: var(--z-raised)`;
from 2026-09-13 until then it was the case the decision below rests on. **Decision.** The sweep
reads the text of what ships, not computed style: that file wrote the literal and a computed read
would have passed it as the token it happened to equal. UX-DR44 is about every `z-index` resolving
to a named level, and a literal that coincides with one resolves to nothing. The decision stands
with the row gone, because the next literal that equals a level by value will be read the same way.

**`body#work`'s gradients are booked to Story 2-33 by ownership of the `/work` surface**, the way
`HomeLayout.scss`'s pair was Story 2-29's, which deleted it on 2026-09-21, and `error-page.scss`'s
pair was Story 2-30's, which deleted it with the file on 2026-09-23. The
declaration sits in `app/app.scss`, which no redesign story names; the surface it paints is the
one Story 2-33 rebuilds. **Closed 2026-09-23 by Story 2-33**, which took it as booked and deleted the
rule with the literal beneath it; the paragraph is kept as the booking was written.

**`clip-skip-link` left on 2026-09-23 with Story 2-32**, which took it as booked: the link is parked
one ring-reach inside the viewport's corner and hides by its own height plus that inset, so its ring
lands whole (§ The focus standard, the sixth stop). The `clip` check stands with no row, as the
`weight` and `heading` checks do. What follows is the booking as it was written on 2026-09-13.

**`clip-skip-link` is booked to Story 2-32 by ownership of the top-of-page chrome, and nothing
else.** **Decision**, flagged in this story's completion report for the Operator to confirm or
reassign. `SkipLink` was built by Story 2-13, which is `done`; no redesign story names it; the row
needs a story on the board that is not `done`, and Story 2-32 is the one that rebuilds the header,
the logo and the contact links that sit at the top of every surface, which is where the link is
parked. The repair itself is small (an inset of the ring's reach when revealed, or a padding on the
link's box) and is stated here so whichever story takes the row knows what closes it.

**`heading-404` was the one `heading` row, and it left on 2026-09-23.** The 404 rendered its numeral
and its title as `<p>` (`Error404.tsx:62-68` as it stood) and carried no level-1 heading in its
accessibility tree; A-7 asks for one per document. Story 2-30 rebuilt the surface with the display
entrance as its one `<h1>`, and closed F-12, the `aria-label` on that numeral, in the same commit:
the numeral is `aria-hidden` and unnamed, because the title, the heading and the message each say
the page was not found without it (O-12 item 3, branch A, read in `tests/e2e/error-surface.pw.ts`).
**Since 2026-09-24 the title and the heading say it and the message does not**: the Operator's ruling
on DW-114 gave the line the next step, `Check the address, or use one of the links below.`, so the
surface says it once, in its heading; branch A holds on the title and the heading, and the same file
reads exactly those two carriers.

## The findings

Numbered, each with its owner, none corrected here. A finding is something the pass observed
that a later story repairs; the ledger rows above are findings too, and are not repeated.

| # | Finding | Where | Owner | Nature |
|---|---|---|---|---|
| F-1 | The header's two labels are set in `sans-serif` at `1.2em` and weight `300`, a family the contract does not publish, so the weight check skips them and the type swap never reached them | `components/atoms/Navbar/navbar.scss:38-40`, six elements across `/work`, `/cv` and the 404 | Story 2-32 | **Observed 2026-09-13**, listed by the sweep as off-contract. **Closed 2026-09-23 by Story 2-32**: `navbar.scss` left disk and `Navbar.scss` sets the labels in the mono role at `--t-2xs` and `--tr-label` with no weight of its own, so the six compute the published mono face at 400 and the sweep's off-contract list names `/celeste`'s heading alone, read in the pinned image; `tests/e2e/chrome-nav.pw.ts` reads the family, the size, the tracking and the loaded face on `/cv` |
| F-2 | `/celeste`'s heading is set in `system-ui` on a `#444` ground with `#fff` text, three literals outside the contract | `components/organisms/Celeste/celeste.scss:2,13-16` | Story 2-34 | **Observed 2026-09-13**, listed by the sweep as off-contract. **Closed 2026-09-23 by Story 2-34**, with the fourth literal the finding did not count, `font-size: min(8vw, 5rem)` at `:14`: the FR-17 conformance gate (`ops/literal-conformance.mjs`) named all four on its first run, and the block now names `--token-bg`, `--f-display`, `--t-display` and `--token-text`. `tests/e2e/celeste-header.pw.ts` reads each against its role in the pinned image, the heading in the display face at 700, which the face publishes, so the sweep's weight check reads it and its off-contract list names nothing on any route |
| F-3 | The timeline's role and period spans render in the user agent's button face (`Arial` in Chromium) because `button.work-item__header` sets no `font-family` and a button does not inherit one; sixteen elements across `/work` and `/cv` | `components/atoms/WorkItem/WorkItem.scss:20-32`, `WorkItem.tsx:112-117` | Story 2-31 | **Observed 2026-09-13**, listed by the sweep as off-contract. The company heading beside them names `--monument-regular` and is unaffected. **Closed 2026-09-23 by Story 2-31**: the trigger takes `font: inherit`, the meta line sets the mono family at the metadata step, and the sweep's off-contract list names no timeline element on either route, read in the pinned image with the meta spans computing Geist Mono in `tests/e2e/plate-mark-and-work-item.pw.ts` |
| F-4 | `.work-item__initiative` asks Geist Mono for weight `600` and the face publishes `400`, so the browser synthesises the bold `DESIGN.md:502` forbids | `components/atoms/WorkItem/WorkItem.scss:85` | Story 2-31 | **Observed 2026-09-13**, ledger row `weight-work-initiative`. **Closed 2026-09-23 by Story 2-31**: the line asks for no weight, computes `400` in the pinned image, and its ledger row is deleted |
| F-5 | The timeline's highlights are text in `--gray-color`, which is the border role `--token-border-interactive`, and contrast **3.49:1** against `/cv`'s `--token-bg` ground at 14.08px, under the 4.5:1 text floor. On `/work` the same text sits on the darker `#0a000f` literal and the audit passes there | `components/atoms/WorkItem/WorkItem.scss:108-111`, `app/app.scss:23` | Story 2-31 | **Observed 2026-09-13** by Lighthouse's `color-contrast` audit on `/cv`, every one of three runs, the only failing audit on that surface. **Closed 2026-09-23 by Story 2-31** in the stylesheet: the highlights take `--token-text-secondary`, the role `DESIGN.md` gives descriptions and computes at 7.03:1 on `--token-bg`, read on the running page in `tests/e2e/plate-mark-and-work-item.pw.ts`. **Re-read 2026-09-23** by Lighthouse in the pinned image: `/cv` 1.00 on all three runs, `color-contrast` passing (§ Lighthouse readings) |
| F-6 | `transition: border-left-color 0.2 ease, color 0.2s ease` carries a unitless `0.2`, which is invalid and drops the whole declaration, so the 404's exits transition nothing. Pre-existing, and harmless to the ring because the ring is never transitioned | `components/organisms/ErrorPage/error-page.scss:71-73` | Story 2-30 | **Observed 2026-09-13** by reading; the sweep read `transition-property` `all` over `0s` on both exits, which is what a dropped declaration computes to. **Closed 2026-09-23 by Story 2-30**, with DW-80: the declaration left disk with `error-page.scss`, and `Error404.scss` transitions `border-color` alone over the micro duration on the toggle curve, which `components/organisms/ErrorPage/__tests__/Error404.test.tsx` reads off the compiled stylesheet as the one transition the file declares |
| F-7 | The grain layer is an SVG `feTurbulence` noise as a `background-image`, animated on the default door. It is neither a shadow nor a gradient, so the depth sweep does not count it, and it is the one thing on the Hub that reads as the aurora-or-grain layer `epics.md:3056` excludes | `components/atoms/ScanlineOverlay/ScanlineOverlay.scss:37-39` | Story 2-28 | **Observed 2026-09-13** by reading. Recorded, not swept, because a sweep for it would be a check the spec did not name. **Closed 2026-09-14 by Story 2-28**: the grain, its `feTurbulence` data URI and its `grain-shift` loop are deleted with the raster, and `ScanlineOverlay.scss` is five declarations on one selector, `var(--token-scrim)` at `var(--z-raised)`. `components/atoms/ScanlineOverlay/__tests__/ScanlineOverlay.test.tsx` compiles the stylesheet with `sass` and holds the compressed output equal to exactly those five declarations on that one selector, so a `url(`, an `animation`, a `@keyframes`, a second rule or a sixth declaration fails as a different string |
| F-8 | `.glitch-text__inner` sets `line-height: 0.9`, under the `0.95` floor `DESIGN.md:486` gives all-caps display | `components/molecules/GlitchText/glitch-text.scss:8` | Story 2-27 | **Observed 2026-09-13** by reading. Not swept: DR45's line-height rule was not among the listed checks. **Closed 2026-09-14 by Story 2-27**: `glitch-text.scss` is deleted and `GlitchText.scss` sets `line-height: var(--lh-display)`, which `tests/e2e/display-entrance.pw.ts` reads off the heading as `0.95` times its size and refuses under the floor |
| F-9 | `.work-item__description` sets `line-height: 1.7` against the body `1.6` `DESIGN.md:485` fixes | `components/atoms/WorkItem/WorkItem.scss:95` | Story 2-31 | **Observed 2026-09-13** by reading. Not swept, same reason. **Closed 2026-09-23 by Story 2-31**: the description takes `--lh-body`, read as the body leading at its own size on the running page |
| F-10 | The trigger's hover is an alpha fill, `rgba(91, 33, 182, 0.06)`, which `DESIGN.md:1281-1283` bars | `components/atoms/WorkItem/WorkItem.scss:35` | Story 2-31 | **Observed 2026-09-13** by reading. **Closed 2026-09-23 by Story 2-31**: hover recolours the row's leading rule to `--token-accent-hover` behind `@media (hover: hover)` and paints no ground, and a fine pointer's hover changes no pixel outside the rule in the pinned image |
| F-11 | Three surfaces paint the cybercore literal `#0a000f` with the grid as two `linear-gradient` images, so every ring on `/`, on `/work` and on the 404's exits was read against a ground that is none of the three tokens (11.89:1, visible) | `components/organisms/HomeLayout/HomeLayout.scss:8-14`, `app/app.scss:133-139`, `components/organisms/ErrorPage/error-page.scss:7-11` | Stories 2-29, 2-33 and 2-30 | **Observed 2026-09-13** by the sweep's ground walk; the gradients are ledger rows. **Partly closed 2026-09-21 by Story 2-29**, in the F-8 shape: findings are annotated, never deleted. `HomeLayout.scss`'s `body[id='']` names `var(--token-bg)` and paints no image at all, so `/` is off this finding and every ring there is read against `--token-bg` at 11.73:1. **Two surfaces remain**, `app/app.scss:136-137` on `/work` (Story 2-33) and `components/organisms/ErrorPage/error-page.scss:9-10` on the 404 (Story 2-30); the finding closes when the later of the two lands. **Partly closed again 2026-09-23 by Story 2-30**: `error-page.scss` left disk with its ground and its grid, and `Error404.scss` paints no ground at all, so the 404's exits stand on the base `body` rule's `--token-bg`, sampled as exactly that role across the surface's top padding in `tests/e2e/error-surface.pw.ts`. **One surface remains**, `app/app.scss:140-141` on `/work` (Story 2-33), whose rebuild closes the finding. **Closed 2026-09-23 by Story 2-33**: `body#work` left `app/app.scss` with its literal and its grid, so `/work` paints the base rule's `--token-bg`, read by `tests/e2e/cv.pw.ts` and `tests/e2e/contract-anchor.pw.ts`, and the sweep's list of ring grounds outside the three tokens reads none on any route in the pinned image |
| F-12 | `.error-page__code` carries `aria-label` on a `<p>`, whose `paragraph` role prohibits a name, the same defect `GlitchText` had on `/`. Lighthouse refuses to audit a page answering 404, so no gate can see it | `components/organisms/ErrorPage/Error404.tsx:62` | Story 2-30 | **Observed 2026-09-13** by reading, and by `lighthouse` refusing the URL with "Status code: 404". **Closed 2026-09-23 by Story 2-30**, recorded as a pre-existing defect corrected rather than one the redesign introduced (O-13): the numeral is `aria-hidden` and carries no name, and no element in the component carries a name by attribute. A browser gate reads it now where Lighthouse cannot: `tests/e2e/error-surface.pw.ts` counts every `aria-label` and `aria-labelledby` on the surface, on the 404 and on `/recommendation`, against a planted one |
| F-13 | `/work`, `/celeste` and the 404 render no skip-link and no `<main>`; `/cv` has a `<main>` with no id. `<main>` is four per-page edits, not one shared change, because a layout-level landmark would wrap the footer `/` keeps outside it by design (`app/page.tsx:79-81`), and a skip-link on `/celeste` would be the one visible control on a surface asserted to have none | `app/layout.tsx:42-45`, `app/cv/page.tsx:46`, `app/work/page.tsx`, `app/celeste/page.tsx`, `app/not-found.tsx` | The DW-43 accessibility package, on the Operator ruling of 2026-09-24 (was Story 2-32, then unassigned) | **Decision**, at this story's planning, re-booking what DW-43 had booked to Story 2-26. See § Decisions. **Re-booked 2026-09-23 by Story 2-32**, whose criteria ask for neither and whose restyle ceiling (`RESTYLE-SPEC.md` § The ceiling) keeps a new control and a landmark out; DW-43 and DW-71 carry the work as it stands. **Closed 2026-09-24 on the Operator ruling of that day**, commit `ddb63b7`: every route carries one `<main id="main" tabIndex={-1}>`, four per-page edits as this row foresaw, and the skip link is `Header`'s first child, alone on `/` where there is no band, so `/celeste`'s hidden band hides it and that surface still shows no control. **Observed 2026-09-24** in the pinned image by the landmark case in `tests/e2e/accessibility-floor.pw.ts`: one `main#main` at tabindex -1 on all five routes, and on the four with a visible control the first Tab lands on the skip link and Enter puts focus on the landmark |
| F-14 | `DESIGN.md` places the tech array at `--t-2xs` in its scale table (`:468`) and at `--t-3xs` in the Registry Entry component (`:660`); the shipped `.suite-directory__tech` follows `:660`. The two lines disagree and one of them is wrong | `DESIGN.md:468,660`, `components/organisms/SuiteDirectory/SuiteDirectory.scss:152` | The design owner, filed as DW-96, unassigned | **Observed 2026-09-13** by reading, when the paragraph floor met four labels marked up as `<p>`. See § Decisions. **Closed 2026-09-24 on the Operator ruling of that day**: the tech array stays at `--t-3xs`, so `:660` (`:675` that day) was the right line, and `DESIGN.md`'s scale table now lists tech arrays on the `--t-3xs` row with the `--t-2xs` entry struck and dated. `.suite-directory__tech` and the paragraph floor's exception for it stand unchanged |
| F-15 | RESTYLE-SPEC F-11 (`RESTYLE-SPEC.md:657`) is unmet: `:root` declares no `color-scheme`, and no `::selection` rule sets background and colour | `app/app.scss`, `contracts/tokens.css` | The DW-43 accessibility package, on the Operator ruling of 2026-09-24 (was unassigned, filed as DW-95) | **Observed 2026-09-13** by `git grep -n "color-scheme\|::selection" -- app components contracts`, which returns one comment (`SuiteDirectory.scss:213`, which mentions the rule) and no declaration. Filed, not swept, because the sweep's checks are the ones the story named. **Closed 2026-09-24 on the Operator ruling of that day**, commit `81f4078`: `app/app.scss` declares `color-scheme: dark` on `:root` and `::selection` on `--token-accent` with `--token-bg` text, the one accent fill F-8 permits, which `ops/__tests__/accent-fill.test.ts` exempts by selector. **Observed 2026-09-24** in the pinned image by `tests/e2e/contract-anchor.pw.ts`, as computed style: the root computes `dark`, the selection the two roles |
| F-16 | No shipped interactive element sits on `--token-bg-raised` or `--token-bg-raised-2`, so the ring on those grounds is known from planted controls only | Every route | No owner: an observation about what the Hub paints, not a breach of anything | **Observed 2026-09-13** by the sweep's ground walk |
| F-17 | `DESIGN.md:565-568` and `:1295` say the contract carries six z-levels and `contracts/tokens.css:129-135` declares seven (`--z-base`, `--z-raised`, `--z-dropdown`, `--z-sticky`, `--z-modal`, `--z-toast`, `--z-tooltip`). The sweep derives the set from the contract and never types the count | `DESIGN.md:565-568,1295` | The design owner, filed under DW-96 with F-14 | **Observed 2026-09-13** by reading both files. **Closed 2026-09-24 on the Operator ruling of that day**: the four places that said six, `DESIGN.md` § Z-index scale and its Don'ts line and `epics.md`'s UX-DR44 and its hallmark criterion, say seven with a dated note. The sweep still derives the set from the contract |
| F-18 | The 404 carries no level-1 heading in its accessibility tree: the numeral and the title are `<p>`, and `HudLabel` renders spans. A-7 asks for one `<h1>` per document | `components/organisms/ErrorPage/Error404.tsx:62-68` | Story 2-30 | **Observed 2026-09-13** in the review re-run by `getByRole('heading', { level: 1 })`, which answered zero. Ledger row `heading-404`. **Closed 2026-09-23 by Story 2-30**: the display entrance is the surface's one `<h1>`, named `Page not found.` by its own words, read by the same sweep and by `tests/e2e/error-surface.pw.ts`; the row is deleted |
| F-19 | The timeline trigger's ring paints outside a full-width button, over the article's `::before` accent bar and into the neighbouring rows, where it painted inset at `-2px` before this story | `components/atoms/WorkItem/WorkItem.scss:20-32`, `:5-14` | Story 2-31 | **Observed 2026-09-13** in the review re-run: the button's box and the article's are both 216px wide at 360 and the bar sits at the article's left edge, 2px wide, under the ring's 3px offset. See § The focus standard. **Closed 2026-09-23 by Story 2-31**: see the paragraph there, settled |
| F-20 | The main landmark's ring, when the skip-link puts focus on it, is clipped by the document's edge on its top, left and right: `<main>` is the full width of the document with no page padding, so what a visitor sees is its bottom edge | `app/page.tsx:68` | The DW-43 accessibility package, on the Operator ruling of 2026-09-24 (was Story 2-32, then unassigned with F-13) | **Observed 2026-09-13** in the review re-run, by the same clip read the sweep makes on every stop. See § Decisions. **Re-read 2026-09-23** in the pinned image, unchanged: clipped on the top, left and right by the document's edge. **Re-booked 2026-09-23 by Story 2-32** with F-13, since the landmark's geometry goes with the landmarks that story did not add. **Re-read 2026-09-24** on the package's baseline, unchanged: `0.00px of 5px` on the top, left and right. **Closed 2026-09-24 on the Operator ruling of that day**, commit `ddb63b7`: `main:focus-visible` in `app/app.scss` draws the same ring from `--stroke-focus` and `--token-focus` at `calc(-1 * var(--stroke-focus))`, inside the box, the one deliberate exception to `RESTYLE-SPEC.md` § 4's verbatim ring (§ The focus standard, § Decisions). **Observed 2026-09-24** in the pinned image: `2px solid at -2px, clipped []` on `/`, `/work`, `/cv` and the 404, and in screenshots at 360 the ring's pixels on the top, left and right edges on every route and on both doors of `/`, the bottom edge being below the fold. **One place it still reads dimmed, filed as DW-127**: on `/`'s default door at 768 and wider the hero's canvas and scrim are positioned inside the landmark and paint over its outline, `rgb(29, 27, 39)` where the ring is `rgb(198, 189, 255)`; the geometry read cannot see a layer above the ring |

## The accent share

**Observed 2026-09-13** by `node ops/hub-accessibility-probe.mjs --base-url http://127.0.0.1:3100 --out <dir>`
on the authoring host, against `corepack pnpm build` and `corepack pnpm start --port 3100`, on a
context that has asked for reduced motion (the flat front door, so the render is the same on
every run; the animated door's canvas never draws the same frame twice).

**The denominator is stated, because RESTYLE-SPEC F-8 says the figure has none.** **Decision.** The count is
over every pixel of the viewport screenshot at scroll top, and a pixel counts as accent when its
RGB is within a Euclidean distance of 32 (in 0 to 255 units) of `--token-accent`,
`--token-accent-hover` or `--token-accent-muted`, each read off the page and rasterised through a
canvas. Antialiased glyph edges and the muted role's dark value both sit near other colours, so
the figure is an approximation whose tolerance is written down beside it.

| Viewport | Accent pixels | Of | Share | Nature |
|---|---|---|---|---|
| 360 x 800 | 499 | 288,000 | **0.17%** | **Observed 2026-09-13** |
| 1280 x 800 | 537 | 1,024,000 | **0.05%** | **Observed 2026-09-13** |

Both are under the 3% `epics.md:3058` names as design intent. **Not a gate.** **Decision.**
`RESTYLE-SPEC.md:654` says the 3% has no defined denominator and is not a check; the story asked
for it measured, and a gate on a number the design owner disowned would be a gate on a guess. The
binary half of RESTYLE-SPEC F-8, the fill grep, is Story 2-34's. **Re-booked 2026-09-23 by Story 2-34**, which
built the FR-17 literal gate its criteria name and not this grep: F-8 is a rule about where a role
is used, not about a literal, and the exemptions it needs for the status dot and `::selection` are
component-level entries the story's criteria forbid in its permitted set. The grep is unassigned,
for an Operator ruling, with the deferred entry Story 2-9 filed for the dot and DW-95.

**Built 2026-09-24 on the Operator ruling of that day**, commit `81f4078`: `ops/__tests__/accent-fill.test.ts`
reads every stylesheet git tracks, compiled, and refuses `--token-accent`, `--token-accent-hover` or
`--token-accent-muted` as a `background`, `background-color` or `fill`, in the existing `test` job. Its
two exemptions are selectors in named files, never a role: the status dot in `SuiteDirectory.scss` and
`::selection` in `app/app.scss`, each required to be found exactly once, and a planted fixture shows it
refusing every other shape a fill can take. It reads source, compiled, where RESTYLE-SPEC F-8 names the
built CSS; the literal gate made the same choice for the same reason, a failure that names a file and
a selector.

The three roles as rasterised: `--token-accent` `rgb(143, 126, 240)`, `--token-accent-hover`
`rgb(173, 161, 255)`, `--token-accent-muted` `rgb(86, 76, 145)`.

## Lighthouse readings

**Observed 2026-09-13** on the authoring host: `@lhci/cli` 0.15.1, Lighthouse 12.6.1, headless
Chrome 152.0.0.0, mobile emulation, three runs per URL, `lhci collect` against `corepack pnpm
build` and `corepack pnpm start` on port 3000, then `lhci assert` against `.lighthouserc.js`'s
three thresholds, which passed on every URL. Scores per run, in the order the runs were made.

| URL | Accessibility | Best practices | SEO | Performance (not gated) | Failing audits |
|---|---|---|---|---|---|
| `/` | 1.00, 1.00, 1.00 | 1.00, 1.00, 1.00 | 1.00, 1.00, 1.00 | 0.90, 0.92, 0.92 | none in the three gated categories |
| `/work` | 1.00, 1.00, 1.00 | 1.00, 1.00, 1.00 | 1.00, 1.00, 1.00 | 0.82, 0.81, 0.82 | none in the three gated categories |
| `/cv` | 0.96, 0.96, 0.96 | 1.00, 1.00, 1.00 | 1.00, 1.00, 1.00 | 0.95, 0.95, 0.95 | `color-contrast`, F-5 |

**Re-read 2026-09-14 by Story 2-27**, same tool and versions, same command, against the build that
carries the rebuilt heading: `/` 1.00, 1.00, 1.00 on accessibility, 1.00 on best practices and 1.00
on SEO on every run (performance 0.91, 0.89, 0.89, not gated); `/work` 1.00 / 1.00 / 1.00 on every
run (performance 0.79, 0.79, 0.80); `/cv` 0.96, 0.96, 0.96 / 1.00 / 1.00 with `color-contrast` (F-5)
still its one failing audit (performance 0.98, 0.95, 0.90). On `/`, `aria-prohibited-attr` and
`heading-order` both score 1 on all three runs, so the real `<h1>` passes the audit the wrapper's
role had been passing and the outline it heads skips no level. `lhci assert` reported every
assertion green. **Observed 2026-09-14.**

**What moved.** `/` scored 0.96 on accessibility on 2026-09-06 with `aria-prohibited-attr` its
one failing audit (the Story 2-11 entry in `deferred-work.md`); it scores 1.00 now and that audit
passes, because `GlitchText`'s wrapper carries `role='heading'` with `aria-level` derived from
its tag, so the home route has a level-1 heading in the accessibility tree for the first time.
**Since 2026-09-14** that wrapper is gone: Story 2-27 rebuilt `GlitchText` as a real `<h1>` whose
accessible name is its own text content, with no `aria-label`, `aria-hidden`, `role` or
`aria-level` on any node, and `tests/e2e/display-entrance.pw.ts` reads the tree as one level-1
heading named `Luigi Espinosa` with nothing generic named. That closes the `GlitchText` half of
O-13 (`EXPERIENCE.md:1058`, the `aria-label` on a generic role, a pre-existing defect corrected
rather than one the redesign introduced, per the epic's own criterion; the `Error404` half stays
with Story 2-30) and O-12 item 1 (`EXPERIENCE.md:1055`, the red and cyan aberration dropped, not
excepted).
`/work` was read at 0.94 on 2026-09-06 on a single run in a container; it reads 1.00 on all
three runs here. **The two environments differ**, so the earlier reading is not contradicted so
much as superseded by one taken the way the gate takes it.

**`/cv` joined `.lighthouserc.js` on this reading.** **Decision.** DW-70's trigger was a local
`lhci` run against `/cv` clearing the three thresholds; 0.96 / 1.00 / 1.00 clears them, so the
URL and the reading land in one commit and DW-70 closes. `ops/__tests__/hit-target-floor.test.ts`
holds the array against `next.config.js`'s redirects and against the 0.95 line, and both still
pass.

**Re-read 2026-09-23 by Story 2-31**, in `mcr.microsoft.com/playwright:v1.62.1-noble` rather than on
the host: `@lhci/cli` 0.15.1, Lighthouse 12.6.1, mobile emulation at 412, three runs per URL, `lhci
collect` then `lhci assert` against `.lighthouserc.js`, the build taken with
`NEXT_PUBLIC_UMAMI_WEBSITE_ID` and `NEXT_PUBLIC_UMAMI_URL` empty as `.github/workflows/lighthouse.yml`
takes it, and nothing uploaded. `lhci assert` reported every assertion green. Performance was not
recorded.

| URL | Accessibility | Best practices | SEO | Failing audits |
|---|---|---|---|---|
| `/` | 0.96, 0.96, 0.96 | 1.00, 1.00, 1.00 | 1.00, 1.00, 1.00 | `color-contrast`, DW-113 |
| `/work` | 1.00, 1.00, 1.00 | 1.00, 1.00, 1.00 | 1.00, 1.00, 1.00 | none in the three gated categories |
| `/cv` | 1.00, 1.00, 1.00 | 1.00, 1.00, 1.00 | 1.00, 1.00, 1.00 | none in the three gated categories |

**What moved.** `/cv` reads 1.00 because F-5 closed: the timeline's highlights take the secondary
role, and `color-contrast` passes on every run. `/` fell from 1.00 to 0.96 between the 2026-09-14
reading and this one, and none of the fall is Story 2-31's. A further single run itemised the audit
as six nodes: `.home-role__jp`, `.home-nav-jp`, `.home-contact-jp`, and three of the premise band's
`.premise__framework` names, every one hidden from assistive technology (the three lines by their own
`aria-hidden`, the three names by the band's) and set in `--token-accent-muted`, `#564c91` on
`#060509`, 2.74:1. The design settles that colour as ornament, but axe does not exempt `aria-hidden`
text, so the gate scores it. `/work`'s annotated Plate mark sets its subordinate line in the same
colour and `/work` still reads 1.00, so the audit does not reach every such node. Filed as DW-113.
**Observed 2026-09-23.**

**Re-read 2026-09-24 by the DW-113 home-surface package**, after the Operator's ruling of that day
moved the muted-accent ornaments into CSS generated content. In `mcr.microsoft.com/playwright:v1.62.1-noble`:
`@lhci/cli` 0.15.1 driving Lighthouse 12.6.1 under the image's Chrome for Testing 151.0.7922.34,
mobile emulation, three runs per URL, `lhci collect` then `lhci assert` against
`.lighthouserc.js`, the build taken with `NEXT_PUBLIC_UMAMI_WEBSITE_ID` and
`NEXT_PUBLIC_UMAMI_URL` empty and served by `pnpm start` on port 3000, as
`.github/workflows/lighthouse.yml` takes it, and nothing uploaded. The same method ran twice in the
same image, on build `bmBRmKwdT9BiS8QM-RfyU` at `d911028`, the package's baseline, and on build
`WQ5nO0gJ8OYY3W0IYbvh5` at `1a5ada5`, its final code commit. `lhci assert` reported every
assertion green on both. Scores per run, in the order the runs were made; performance is not gated.

| URL | Accessibility | Best practices | SEO | Performance (not gated) | Failing audits | Build |
|---|---|---|---|---|---|---|
| `/` | 0.96, 0.96, 0.96 | 1.00, 1.00, 1.00 | 1.00, 1.00, 1.00 | 0.65, 0.65, 0.67 | `color-contrast`, six items: `.home-role__jp`, `.home-nav-jp`, `.home-contact-jp` and three `.premise__framework` | before |
| `/work` | 0.96, 0.96, 0.96 | 1.00, 1.00, 1.00 | 1.00, 1.00, 1.00 | 0.91, 0.92, 0.95 | `color-contrast`, one item: `.plate-mark__sub` | before |
| `/cv` | 1.00, 1.00, 1.00 | 1.00, 1.00, 1.00 | 1.00, 1.00, 1.00 | 0.86, 0.91, 0.86 | none in the three gated categories | before |
| `/` | **1.00, 1.00, 1.00** | 1.00, 1.00, 1.00 | 1.00, 1.00, 1.00 | 0.49, 0.49, 0.49 | none in the three gated categories | after |
| `/work` | **1.00, 1.00, 1.00** | 1.00, 1.00, 1.00 | 1.00, 1.00, 1.00 | 0.93, 0.93, 0.89 | none in the three gated categories | after |
| `/cv` | 1.00, 1.00, 1.00 | 1.00, 1.00, 1.00 | 1.00, 1.00, 1.00 | 0.90, 0.90, 0.88 | none in the three gated categories | after |

**What moved.** `color-contrast` scores 1 with no item on every run of all three routes after the
change, where it failed on the seven ornaments before, so `/` and `/work` read 1.00 and the audit
sees their real text again: a contrast regression there now moves the score. Each ornament is an
empty `aria-hidden` span whose string is its `data-ornament`, painted by `::before` in the colour
and size it had, and axe scores contrast only on an element with text nodes of its own (axe-core
4.11.1's `colorContrastMatches` returns false without `hasRealTextChildren`, read in
`node_modules` on 2026-09-24). The fallback the ruling held in reserve, recolouring to
`--token-text-secondary`, was not needed, and `DESIGN.md` is unchanged. DW-113 closes on this
reading.

**`/`'s performance fell, and why.** **Observed**, the same runs. Its largest contentful paint moved
from `a.skip-control` at 2,410 to 2,726ms to the first hero link, `a.nav-link`, at 5,320 to
5,483ms under Lighthouse's simulated mobile throttling; first contentful paint (1,810 to 1,823ms),
total blocking time and layout shift did not move. The link is invisible until its turn either way,
but Chrome never reports an element first painted at `opacity: 0`, so before the change the
entrance's largest text was not a candidate at all; under DW-106's `visibility: hidden` its first
paint is its reveal, and that is what LCP now reports. Performance is not gated
(`.lighthouserc.js` comments it out), and the ruling fixed the mechanism, so this is recorded and
filed as DW-125 rather than tuned. **Observed 2026-09-24.**

## Decisions

Each of these is a call this story made rather than a value it measured, with the reason.

| Decision | Reason |
|---|---|
| **`forced-colors`: no claim.** The estate makes no claim about the Status mark, the ring or anything else under `forced-colors` or a user stylesheet | No requirement in the plan names that medium (`ops/status-mark-axes.md:234`, the Story 2-10 entry in `deferred-work.md`). Asked to decide whether the estate claims anything there, the answer is that it does not, and a claim nobody asked for is a gate nobody agreed to. Recorded so the question stops being open; the day a requirement names the medium, this row is where it starts |
| **The canvas needs no prose.** A-14's third clause, "with its content stated in prose", is withdrawn by the Operator's ruling of 2026-09-13; the canvas is decorative | `EXPERIENCE.md:773` amended in place with the date. `ScanlineOverlay.tsx:8` is the precedent (amended 2026-09-14: the rebuilt component renders that element at `ScanlineOverlay.tsx:16`, still `aria-hidden` and nothing else): a decorative layer is `aria-hidden` and that is the whole of its accessibility. The narrative has no visual row in any design document, so no sentence exists to ship and inventing one would be product copy written under a spec that forbids invented facts (DW-52). The two met clauses stay asserted in `tests/e2e/front-door.pw.ts`. **The withdrawn clause survives in four other places this story does not edit**: `EXPERIENCE.md:527-528`, `epics.md:644`, `epics.md:2591` and `epics.md:3328`, the last of them Story 2-29's own acceptance criterion, so that story would inherit it unknowingly; the coordinator files the deferred entry that names them |
| **The footer line moves to `--t-2xs`; the footer link does not** | `DESIGN.md` wins any value. `:468` places the footer at `--t-2xs`; `:467` reserves `--t-3xs` for labels and never prose, and `SiteFooter.scss` itself argues the line is a sentence. The link beside it is a label and stays at the smallest step; the story's fix list names one token and this is it |
| **The paragraph floor excepts four labels by name.** `.suite-directory__count`, `.suite-directory__tech`, `.suite-directory__status` and `.suite-directory__family-name` are `<p>` elements `DESIGN.md` places at `--t-3xs` (`:490`, `:660`, `:637`, `:667`), and the sweep's "every `p` at least `--t-2xs`" does not bind them | The story's matrix wrote the paragraph floor as a tag test on a census that saw one `<p>` under `--t-2xs`, the footer line. The run met four more, every one a label by the design's own classification and every one at the step the design places it. Prose is not derivable from markup, which is why the `--t-sm` floor already takes `DESIGN.md`'s six prose selectors rather than a tag; the paragraph floor takes the same document's four labels as its exception. Each is pinned with the line that places it and asserted to match on some route, so the list cannot rot. **This narrows the matrix's wording and is reported as such** in the story's completion report; the alternative, retagging four elements in Story 2-9's component, is a fix outside the four this story is allowed. F-14 records the one place `DESIGN.md` disagrees with itself about them |
| **The built CSS is read as text, not computed style, for z-index and depth** | The case that held until 2026-09-14: `ScanlineOverlay.scss:4` was the literal `10`, equal to `--z-raised` by value, and a computed read passed it. Story 2-28 rewrote the line to `var(--z-raised)` that day and the reason outlives the case, because the next literal equal to a level would be read the same way. `ops/asset-budget.mjs` reads the same files for the same reason. The seven `--z-*` names come from the contract, so the documents' "six" is never typed and F-17 is recorded rather than repeated |
| **The non-home `<main>` and skip-link are Story 2-32's, not this story's.** DW-43's "Story 2-26's work" is corrected | The Operator's condition for doing it here was one change in the shared layout. `<SkipLink />` would be; `<main id='main' tabIndex={-1}>` is not, because a layout-level `<main>` wraps the footer `/` keeps outside it on purpose (`app/page.tsx:79-81`, pinned at `page.test.tsx:89`). So it is four per-page edits plus four `SURFACES` pins in `hit-target-floor.pw.ts` and the `/celeste` no-control case in `secondary-surfaces.pw.ts`, which is the chrome change `app/cv/page.tsx:41-45` already booked to Story 2-32. **Re-booked 2026-09-23 by Story 2-32**, unassigned for an Operator ruling: that story kept to its criteria, which ask for neither, and to the restyle ceiling, which keeps a new control and a landmark out (F-13, DW-43, DW-71). **Ruled and done 2026-09-24**: the Operator ruled the landmark on every route and the skip link into `Header` as its first child, the one-change shape this row's reasoning pointed at, and commit `ddb63b7` landed it (F-13) |
| **One ledger with a `check` column, one register entry** | The Operator asked for one ledger and one entry. Rows of five kinds fit one table when the row carries its kind and a `Match` whose meaning the record states per kind, and one tally per kind holds the sum of the rows' counts to what was observed in both directions |
| **The `[tabindex="-1"]` targets the two skips move focus to ring on keyboard activation, and stay ringed.** After Enter on the skip-link, `main#main` matches `:focus-visible` and computes the standard ring; after Enter on the skip control, so does `h2#suite`. The story forbids `outline: none` on either | The ring is A-1's visible indicator of where focus went, and after a skip that is the one thing a keyboard visitor needs to see. The landmark's ring is clipped by the document's edge on three sides (F-20), so on `/` it reads as a line under the Directory rather than a box; that is a geometry of the landmark for Story 2-32 to settle with the other landmarks, not a reason to suppress the ring. The heading's ring paints whole. Both are read by a permanent case and the Operator's keyboard method includes the Enter step. **Settled 2026-09-24 by Operator ruling (F-20)**: the landmark's ring is drawn inside its box, `main:focus-visible` at `calc(-1 * var(--stroke-focus))`, the one deliberate exception to § 4's verbatim ring, so no document edge takes a side on any route; the permanent case reads it on all four routes that reach it. Where a positioned layer inside the landmark paints over it, on `/`'s default door at 768 and wider, is DW-127 |
| **The accent share is Observed and not gated** | RESTYLE-SPEC F-8 disowns the denominator; the story asks for the figure. The probe states a denominator and a tolerance and records the number; a gate on it would be a gate on a number the design owner said is not a check |
| **`/cv` is in the Lighthouse gate** | The reading cleared the three thresholds, which was DW-70's trigger |
| **A probe script beside the spec, not a skipped case in CI** | The two eyeball checks need renders a person looks at, and the accent count needs a PNG decoded off CI. A skipped spec would read as a downgraded gate, which `AGENTS.md` forbids; a script that leaves a re-runnable command is what makes the check re-runnable |

## Failing loudly rather than vacuously

Every assertion is shown firing on a planted control before its green result is read as good
news, by a permanent case in `tests/e2e/accessibility-floor.pw.ts`. The plants are injected
through the browser or fabricated in memory, so none is left in the tree.

| Case | Behaviour | Nature |
|---|---|---|
| The ring taken off | With `:focus-visible { outline: none !important; transition: color 1ms, outline 200ms !important }` planted on the 404, the sweep names every one of its five stops for the missing ring **and** for the transition, each line carrying the route, the element's path, its text and the five values; the transition read pairs each property with its own duration by index, so `color, outline` over `0.2s, 0s` is not a transitioned ring and `0s, 0.2s` is | **Observed 2026-09-13.** "with the ring taken off, the sweep names every element on the route with the five values" |
| A clipped ring | A link planted inside a `clip-path` wrapper on the 404, padded on the left only, is named as clipped on its top, right and bottom by that wrapper and not on its left; a link planted `position: fixed` at the viewport's top-left corner is named as clipped on its top and left by the viewport's edge and on neither far side; a stop with a clipped ring no row claims, a `clip` row nothing matched, and a `clip` row whose count moved are each named | **Observed 2026-09-13.** "a ring clipped by a clip-path ancestor and by the document edge is named, side by side" |
| A second level-1 heading | A `role="heading" aria-level="1"` planted on `/cv` makes the count two, and a route off the rule with no `heading` row is named | **Observed 2026-09-13.** "every route carries exactly one accessible level-1 heading, and the home route names it" |
| A positive `tabindex`, an `aria-hidden` focusable, an untagged landing | An `<a href="#" tabindex="1">` planted on the 404 is named as a positive `tabindex`, and the traversal names Tab number 1 landing on it where DOM order puts the logo; a link planted inside an `aria-hidden` subtree stays in the expected order, because Tab reaches it, and is named as a focusable the accessibility tree does not have; a planted disabled button and a link inside an `[inert]` subtree are left out of the expected order; and the extra Tab landing on anything but `body`, nothing or the first stop is named as a landing, an iframe or a focusable scroller, not a departure | **Observed 2026-09-13.** "a planted positive tabindex, an aria-hidden focusable and an untagged landing fail the traversal, naming each", plus the pure verdict on fabricated sequences: a swapped pair, a stop that never came, an extra Tab that stayed inside, an untagged landing, a positive index, a hidden focusable |
| Fabricated CSS against a fabricated ledger | The tally names an unlisted value (`z-index=7`, `radial-gradient`), a stale row (`z-one`), a count that moved (`shadow-one` 2 against 1), two rows sharing a match summing their counts, a `z-index: var()` naming anything but a contract layer as an unlisted value (`var(--z-tooltip)` against a fabricated contract without it, `var(--depth, 4)`), a `--foo-z-index` custom property never counted, `-webkit-` and `-moz-` prefixes counted as the function they prefix, and `repeating-linear-gradient(` counted as itself and never as `linear-gradient(` | **Observed 2026-09-13.** "the tally names an unlisted value, a stale row and a count that moved, on fabricated CSS" |
| An empty or absent build | `builtStyles` throws naming the directory on a directory holding no `.css`, and on one that is not there, and reads a nested stylesheet whole | **Observed 2026-09-13.** "an empty or absent build throws naming the directory, never passing over nothing" |
| Text under the floor | A `<p>` at `calc(var(--t-3xs) - 1px)`, a `<p>` at `calc(var(--t-2xs) - 1px)`, a prose `<p>` at `calc(var(--t-sm) - 1px)`, an italic span, a Geist Mono span at weight `700`, a span in Papyrus and a `::before` whose generated `//` is set under the floor are each named for their own defect, the Papyrus one listed as off-contract and never judged on weight, a `::after` whose content is a blank string never read; the same plants under `aria-hidden` are never read; the shipped 404 beneath them reads clean; a family published in two `@font-face` blocks merges into one weight range | **Observed 2026-09-13.** "a planted text under the floor, an italic, a synthesised weight and a small pseudo-element are named by the type sweep" |
| The `px` scan and the one-ring scan | The `px` scan fires on `font-size: 12px`, on a `px` inside `clamp()` and on a `font:` shorthand with a `px` size, passes `var(--t-sm)`, `12pt`, a `font-family` and a `padding`; the ring scan names a nested `&:focus-visible` with an `outline`, a `.y:focus-visible` with an `outline-color`, and a scoped `:focus-visible` in `app/app.scss` itself, passes a `:focus-visible` with no outline and the bare global rule | **Observed 2026-09-13.** "no stylesheet under app/ or components/ sets type in px, and none but app/app.scss paints a ring" |
| The autoplay selector | Matches a planted `<video autoplay>` and a planted refresh meta | **Observed 2026-09-13.** Inside the type case |
| The label exception | Each of the four `LABEL_PARAGRAPHS` selectors is asserted to match a visible `<p>` on some route, so an entry cannot outlive the element it excuses | **Observed 2026-09-13.** Inside the type case |
| The weight, clip and heading ledgers | A row matching nothing fails as stale, and one whose count moved fails naming both numbers, through one tally shared by the three kinds | **Observed 2026-09-13.** Driven on fabricated hits inside the clipped-ring case, and applied to the real rows inside the type, sweep and heading cases |
| The four ring roles | `--stroke-focus`, `--token-focus`, `--focus-offset` and `--r-hair` are read off `:root` through the harness before any ring is read, which throws naming an undeclared one; a probe and an element agree on `0px` for an undeclared offset, so the later "resolved to nothing" guard alone would never fire | **Decision.** `ringContract` in the spec file |
| The record and the ledger disagreeing | Vitest fails in whichever direction is short, on a field edited in one place, and on a repeated id, driven by fabricated tables; every row's cited source lines have to carry the tell, checked on planted lines per kind; the Lighthouse table and `.lighthouserc.js`'s `collect.url` have to name the same surfaces; KV-6's heading and index row have to carry the ledger's sums per kind spelled out; and an Operator table counts as answered only on an ISO date in `Checked on`, a variant placeholder being neither answered nor the one placeholder | **Observed 2026-09-13.** `ops/__tests__/hub-accessibility-pass.test.ts` |
| The `anchor-contract` pin | With the global rule present and `FOCUS_ROLES` absent, claim one failed naming exactly the four roles the rule adds | **Observed 2026-09-13**, before the pin was added |

## How to re-run every measurement here

The Playwright half, from the repository root on the Windows development host, which is
`ops/status-mark-axes.md:65-73` narrowed to this spec file:

```
docker run --rm --ipc=host ^
  -v C:/CuatroEcosystem/cuatro-portfolio:/w ^
  -v pw-node-modules:/w/node_modules ^
  -v pw-next:/w/.next ^
  -w /w -e CI=1 ^
  mcr.microsoft.com/playwright:v1.62.1-noble ^
  bash -lc "corepack enable && pnpm install --frozen-lockfile && pnpm exec playwright test accessibility-floor"
```

Drop the trailing `exec playwright test accessibility-floor` for `pnpm test:e2e` and the whole
suite runs. The sweep prints its readings (stops per route, the ring, the grounds and their
contrast, the clipped stops side by side, the two skip targets after Enter, the level-1 headings
per route, the built-CSS tally, the off-contract families, the synthesised weights) whether it
passes or fails, so a re-run is a re-reading.

The renders and the accent share, against a running production server:

```
corepack pnpm build
corepack pnpm start --port 3100
node ops/hub-accessibility-probe.mjs --base-url http://127.0.0.1:3100 --out test-results/hub-accessibility-probe
```

Lighthouse, against a server on port 3000, collecting and asserting without the public upload:

```
corepack pnpm start --port 3000
npx @lhci/cli@0.15.1 collect
npx @lhci/cli@0.15.1 assert
```

The version is pinned to the one the reading was taken at (`@lhci/cli` 0.15.1 driving Lighthouse
12.6.1), so a re-run compares like with like; `.github/workflows/lighthouse.yml:39`'s own
`npx @lhci/cli autorun` floats, so the gate on `main` runs whatever is current on the day.
`lhci collect` writes `.lighthouseci/`, which is run output and is deleted after reading, never
committed.

## Stated limits

| Limit | Why it stands | Nature |
|---|---|---|
| **Two grounds were read on planted controls** | No interactive element sits on `--token-bg-raised` or `--token-bg-raised-2` on any route (F-16). The reading answers whether the shipped rule paints a visible ring there; it says nothing about a real control's layout, because there is none | **Observed 2026-09-13**, labelled planted in the run's output |
| **The ground under a ring is the first painted ancestor colour** | The ring is drawn outside the element's border box, so the element's own background is not under it and the walk starts at the parent. An ancestor painting an image is classified by the first opaque colour beneath the image and the image is named; the grid gradients are at 6% alpha, so the classification is the colour's | **Decision** |
| **Visibility is the 2-8 rule, which does not see clipping** | A text inside a collapsed accordion panel (`height: 0; overflow: hidden` on the parent) has a box of its own and is read. That is why the type sweep reads 318 texts, the collapsed panels' text among them, and why `weight-work-initiative` counted the initiative line whether its panel was open or not (the row left with Story 2-31 on 2026-09-23; the rule stands) | **Decision**, the rule `ops/hit-target-floor.md` states, kept rather than widened |
| **The clip read is a box test, not a raster** | A `clip-path` is read as clipping to the ancestor's border box whatever its shape, and `overflow` to its padding box; the reach is `outline-offset` plus `outline-width` off the focused element. A polygon that leaves a corner open, or a ring that survives under a translucent clip, is not seen; a clip that the box test misses, an `overflow` on a scroller that could scroll the ring into view, is reported as clipped. `html` and `body` hand their overflow to the viewport and are read as the document's edge, the viewport's for a fixed element. Whether a fragment reads as a ring to a person is the Operator's keyboard confirmation | **Decision** |
| **Tabbable is what Tab reaches** | A focusable inside an `aria-hidden` subtree is a Tab stop and stays in the expected order, named as its own finding; a `:disabled` control, an `[inert]` subtree and a box-less element are not stops and leave the expectation. A zero-area focusable would still be a stop and is dropped by the 2-8 rule; none ships today | **Decision** |
| **Hover is read on all but one element** | The skip-link is parked above the viewport by `translateY(-100%)` and a pointer cannot be put over it; the run records it as unreachable and the case refuses any other element in that state | **Observed 2026-09-13** |
| **One click per route** | On the first link that is not the skip-link and, where the route has one, the first accordion trigger, with navigation prevented at the capture phase. Every element's hover is read; the click is a sample, because a click per element is a navigation per element | **Decision** |
| **`transition-property` `all` over `0s` is not a transition** | The initial value of the property is `all`; only a duration above zero animates. The check reads both and fires on the pair, the way `ops/cs-tracker-accessibility-probe.mjs` does | **Decision** |
| **The depth sweep counts six tells and no more** | `box-shadow:`, `text-shadow:`, `linear-gradient(`, `radial-gradient(`, `repeating-linear-gradient(` and `conic-gradient(`, the story's list, each admitted with a `-webkit-` or `-moz-` prefix. `repeating-radial-gradient(` and `repeating-conic-gradient(` are not counted, and neither is an SVG filter (F-7). A `z-index: var()` naming anything but a contract layer is an unlisted value. Widening the list is a change to the story's checks | **Decision** |
| **Line-height, tracking, the measure and uppercase are recorded, not swept** | DR45's rules beyond the size floor, the italic ban and the weight range were not among the checks the story named; F-8 and F-9 are the two departures reading found | **Decision** |
| **RESTYLE-SPEC F-8's fill grep and the colour-literal grep are Story 2-34's; RESTYLE-SPEC F-11 is filed, not swept** | The story's boundaries name both as another story's. **Amended 2026-09-23 by Story 2-34**: the colour-literal grep is `ops/literal-conformance.mjs`, a blocking job since that story; F-8's fill grep is not in its criteria and is unassigned (see § The accent share). **Amended 2026-09-24 by the DW-43 accessibility package, on the Operator ruling of that day**: F-8's fill check is `ops/__tests__/accent-fill.test.ts` (§ The accent share), and F-11 is met and read as computed style by `tests/e2e/contract-anchor.pw.ts` (F-15) | **Decision** |
| **The accent share is one door at scroll top** | Reduced motion, so the flat hero, at two viewports. The animated door's canvas is a moving picture and its share is a moving number; measuring it would be recording weather | **Decision** |
| **The probe ran on the authoring host, not in the pinned image** | It writes renders a person looks at and prints a figure nothing gates on. Glyph rasterisation differs across platforms and would move the share by a few pixels either way | **Decision** |
| **Lighthouse cannot audit the 404** | It refuses a page answering 404 ("Lighthouse was unable to reliably load the page"), so F-12 is by reading and no gate can see that surface. **Narrowed 2026-09-23 by Story 2-30**: Lighthouse still refuses the page, and `tests/e2e/error-surface.pw.ts` now reads the surface's accessible output in the pinned image on every push (the structure, the one heading, no name by attribute, the numeral out of the tree), so the parts F-12 and F-18 named are gated even though the audit is not | **Observed 2026-09-13**. **Decision 2026-09-23**, Story 2-30 |
| **The two Operator confirmations are outstanding** | A machine can prove the values differ and the stops are in order; it cannot prove a reader perceives the difference or that the ring reads as a ring. The two tables above are where those land, and the board cannot reach `done` until they do | **Decision.** Pending action 1 |

## Pending Operator actions

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Perform the two confirmations**, greyscale and keyboard, and fill the two tables above | Operator | The renders come from the probe command under § How to re-run; the traversal is a browser and a Tab key. Fill `Checked by`, `Checked on` and `Result` together, never one of them, and then move the story to `done` | **2026-09-14.** Both tables above read `Checked on` 2026-09-14 and `Result` **Pass**, recorded in `6f031ea` with the story moved to `done` on the board; only this cell was never filled. Closed on the Operator ruling of 2026-09-24 |
| 2 | **Rule on F-14 and F-17**, the two places `DESIGN.md` disagrees with itself or with the contract | Operator | DW-96. Neither is a defect in the Hub: the tech array follows `:660`, and the sweep follows the contract's seven layers. One line in each pair wants correcting | **2026-09-24.** Operator ruling 2026-09-24. F-14: tech arrays stay at `--t-3xs`, and `DESIGN.md`'s scale table is corrected rather than the shipped Directory. F-17: the four places that said six z-levels say seven. Both are dated amendments in the planning documents, and DW-96 closes with them (F-14 and F-17 above) |
| 3 | **Rule on F-15**, whether the Hub takes `color-scheme` and a `::selection` rule, and which story | Operator | DW-95. `RESTYLE-SPEC.md:657` names it as a check every application meets; nothing on the Hub does today. **Ruled 2026-09-24**: both, in `app/app.scss`, with F-8's check in the same package; landed in commit `81f4078` (F-15 above) | 2026-09-24 |
| 4 | **Read `/` with a screen reader** and record whether the page heading is announced once as a level-1 heading reading "Luigi Espinosa", not letter by letter and not with a pause between letters | Operator | Story 2-27, added 2026-09-14. **Method**: open `/` against a production build (`corepack pnpm build && corepack pnpm start`) in the browser the reader pairs with, on a context with no motion preference so the entrance runs, and navigate to the first heading by the reader's heading key (NVDA and JAWS `H`, VoiceOver `VO-Cmd-H`, TalkBack the headings granularity). The heading is fourteen inline `<span>` elements inside one `<h1>`; Chromium's and Playwright's name computation read them as one string, which is what the machine half asserts, and whether a reader speaks them as one word is the half only a person can answer. **Result and date go here**, beside the reader and browser used; the board moves to `done` after it. A read that finds letters or pauses is a renegotiation of the markup, not a fix, per the story's spec | _not done_ |

**Maintaining this file.** When a story repairs a file a ledger row points at, it deletes the row
here and in `EXEMPTIONS` in the same commit, moves the surface named in KV-6's "What is in breach"
cell in `ops/known-violations.md`, and brings that entry's index row into line: four things, and
a change to fewer than four is a defect (`ops/known-violations.md` § KV-6). When an action is
performed, replace its `_not done_` cell with the ISO 8601 UTC completion date and leave the row in
place. When a figure is re-measured, add the new reading with its own date and method and keep the
old one, so a later reader can see whether a number moved or was simply re-stated. Deletion is not
used here.
