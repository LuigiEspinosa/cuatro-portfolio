# Rendered-output harness

The written record of the instrument Story 1-10 installed: what a machine can now assert about
what the Hub actually renders, what it deliberately cannot assert yet, what the assertions cost
to run, and what "visually identical" means as a number rather than as an opinion.

Written during Story 1-10 on **2026-08-24** (ISO 8601 UTC), against baseline commit
`4f4c751`.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/estate.md`, `ops/monitoring.md`, `ops/routing-inventory.md`,
`ops/bot-mitigation.md` and `ops/known-violations.md` set: every value is marked as either a
decision or an observation, and the two are never presented as the same kind of fact (NFR-9).
An observed value also carries the method that gathered it, because a number without a method
is a claim.

**Story ids are written hyphenated**, as `Story 1-10` and `Story 1-18`, matching the keys in
`_bmad-output/implementation-artifacts/sprint-status.yaml`. `epics.md` writes the same ids
dotted. They are the same stories.

## What the harness asserts

`tests/e2e/harness.ts` exposes exactly three capabilities. Stories 1-12, 1-17, 1-18, 1-19 and 2-8
import that file rather than reaching for Playwright directly, so the viewport, the browser and
the failure behaviour are settled in one place. Story 2-8 imports two of the three,
`RENDERED_VIEWPORT` and `rootCustomPropertyValue`, and edited none of them.

**Story ids in this paragraph and in the rows Story 2-8 added are hyphenated**, per the rule at the
head of `ops/known-violations.md`. The dotted forms elsewhere in this file are older text and were
left as written rather than rewritten by a story that was not editing them.

| Capability | Helper | What it answers | Nature |
|---|---|---|---|
| Route screenshot | `expectRouteScreenshot` | Did this route's render change beyond the stated tolerance | **Decision.** Scope set by Story 1-10 |
| Computed property on a selector | `computedStyleValue` | What value does a named CSS property resolve to on a named selector, in a real browser | **Decision.** Same |
| Custom property on `:root` | `rootCustomPropertyValue` | What value does a named custom property resolve to on `:root` | **Decision.** Same |

**What the specs built on those three capabilities assert.** This table is the coverage answer, and
it lives here rather than under the heading below saying what is not covered: a reader scanning for
whether something is asserted reads the heading before the cell.

| Assertion | Spec file | What it answers | Nature |
|---|---|---|---|
| The 44x44 hit-target floor, and A-5's no-horizontal-scroll half | `tests/e2e/hit-target-floor.pw.ts` | Does every interactive element on every Hub surface measure at least `--tap` on both axes, or appear in a dated exemption ledger that can only shrink; and does any measured element's edge sit outside the viewport at 360 wide. The floor is read off `--tap` on `:root` rather than written, and the route set is derived from `app/` rather than hand-listed. The ledger, the probe output and the stated limits are in `ops/hit-target-floor.md` | **Decision.** Story 2-8, **2026-09-06**. This supersedes the row that used to sit under "what it deliberately does not assert" claiming the floor needed a Suite Directory. **That reason was wrong about its own blocker**: a sweep over every interactive element needs no Directory to measure, and scoping it to compliant surfaces is what would have made it vacuous. **A-5 reads every element with a box since Story 2-33, 2026-09-23**, which retired KV-5 on that reading: `outsideTheViewport` compares both edges of everything on every surface, not only what the floor measures, and a standing case shows it reporting two planted blocks the interactive arm cannot see |
| The Status mark's three structural axes, and A-5's Status clause | `tests/e2e/status-mark.pw.ts` | Does each of the four Status values differ from its neighbour on a structural property rather than on hue: a 4 by 4 painted dot, a dashed border, a dropped border. **`Live` and `Complete` are asserted identical in border treatment**, so a border-only assertion is demonstrably insufficient, which is what AD-19 forbids. Greyscale is measured in the print medium, where `app/scss/_print.scss` forces `#000` and hue is gone at source, rather than through a `filter` that `getComputedStyle` cannot see. Also: no mark expresses its value with `opacity`, no Status truncates or wraps at 360, and the mark carries no tooltip, popover, role, tab position or hover state. The measured values, the greyscale distances and the stated limits are in `ops/status-mark-axes.md` | **Decision.** Story 2-10, **2026-09-06**. This supersedes the row that used to sit under "what it deliberately does not assert" saying the axes needed a Suite Directory: Story 2-9 built one, and this is the different instrument that row said the axes would need. Which values emit a dot stays in `components/organisms/SuiteDirectory/__tests__/SuiteDirectory.test.tsx`, because a browser only ever sees `Live` dots: `Complete` renders under the FR-35 filter and no entry carries it, and `In progress` and `Archived` the filter holds back |
| The Suite Directory's row geometry and its hover | `tests/e2e/suite-directory.pw.ts` | Does a long unbroken token planted in a description or a live link stay inside the viewport **and** inside its own box, at 360 and one pixel past the 760px breakpoint; and does hover recolour the underline and change nothing else. **Since 2026-09-24** (Operator ruling, the ledger entry on new-tab links): does each link that opens a new tab end in the external-navigation mark, `aria-hidden`, painted after and clear of its underline in the link's own colour and face, with its accessible name ending `opens in a new tab`, a planted link carrying neither shown named. Two measurements, because a cell spanning a flexible grid track contributes nothing to track sizing, so its overflow never moves an element rect and is invisible to the A-5 sweep above | **Decision.** Story 2-9, **2026-09-06**. Kept out of `hit-target-floor.pw.ts` because that file's literals are parsed as text by `ops/__tests__/hit-target-floor.test.ts` |
| The alias layer's deletion, and the base rule | `tests/e2e/anchor-aliases.pw.ts` | **Since Story 2-22 (2026-09-23), the layer's absence where only a browser sees it.** Does every stylesheet the build writes, parsed by the browser's own parser with every grouping rule walked, put on a rule reaching the root element (a selector naming `:root`, or one the root matches) exactly the contract's custom properties and `--hero-height`, none missing and none extra (since 2026-09-24 admitting the minifier's two `light-dark()` switches, `--lightningcss-light` and `--lightningcss-dark`, on the one rule that declares `color-scheme` and nowhere else, DW-95), a nested style rule reported rather than skipped, each claim shown firing on planted stylesheets; does `--hero-height` still hold its authored `40vh`; does the base `body` rule on the 404 paint `--token-bg`, `--token-text`, the `--f-body` family and the `--w-regular` weight, each read against a probe declared with the role and the probe against a control, neither colour pure; and does every route answer 2xx. **Until then it measured the layer itself**: every alias resolving to its role on `:root`, the `--accent-dim` call sites against the ornament or boundary role their use earned (fifteen at Story 1-18, then twelve, eight, two and one as Stories 2-9, 2-31, 2-30 and 2-33 rebuilt or deleted the files that carried them), the `--monument-bold` sites carrying the weight a family alias cannot (four, then three, two, one), the `--monument-regular` clamp, the pseudo-element read and each retired alias pinned at zero call sites on disk. Each left with its last row, and `app/__tests__/anchor-contract.test.ts` searches every file git tracks for the thirteen names now | **Decision.** Story 1-18, counts amended 2026-09-06 by Story 2-9, 2026-09-14 by Story 2-27 and 2026-09-23 by Stories 2-31, 2-30 and 2-33; rewritten 2026-09-23 by Story 2-22 |
| The header suppression on `/celeste` | `tests/e2e/celeste-header.pw.ts` | Is the header rendered and hidden by a stylesheet rather than mutated by an effect, and is that a different mechanism from the home route rendering no header at all | **Decision.** Story 2-1 |
| The chrome nav's two destinations, and the sticky header; the chrome as Story 2-32 rebuilt it | `tests/e2e/chrome-nav.pw.ts` | Does the header carry exactly `Suite` to `/#suite` and `CV` to `/cv`, in that order, with no external link and no `mailto:`; does each link measure at least `--tap` on both axes and sit `--s-lg` from its neighbour, which is A-4's independently-addressable clause on the second surface in the Hub to put two targets on one line at 360; does `aria-current` mark the current route and nothing else, with the accent rule drawn on the inner span rather than on the tap box; is the header `position: sticky` at `--z-sticky` on an opaque token ground and still at the top of the viewport when the page is scrolled past it, **on both surfaces that render it**, `/work` and the 404 being two different render paths and stickiness being breakable by an ancestor on either; does the root element reserve `scroll-padding-block-start` for it where there is a header and not where there is none; and do both destinations reach what they name when clicked, `Suite` landing on `/` with `#suite` applied and the Directory heading in view, `CV` landing on `/cv` and starting no download, with the file the removed 308 used to serve reached by a planted control so the listener that reports "no download" is shown able to report one. **Since Story 2-32**: do both labels compute the mono role at `--t-2xs`, weight 400, uppercase, `--tr-label` and `--token-text` in a face that loaded, the current one carrying the emphasis rule in the accent and the other the hairline in the interactive border role; does a fine pointer's hover recolour that rule to the hover role at its own width and change no pixel outside it, and does a tap on a touch context start no transition towards it; does the band span the document with a `--stroke-hair` rule whose pixels read `--token-border` on every column, with no shadow and no blur; is `.container` `min(100%, 1920px)` at `--page-pad` at 360, 1280 and 2400 wide, the header's content inside it; is the header as tall as its padding, one `--tap` row and its hairline, with scroll padding equal to it and nothing past either edge at 360; is the wordmark a link home named `Cuatro`, in the display face at `wdth 75` and 800, narrower than at 100 and with no image; and is the contact group on `/` one list of three self-describing links at the floor. Each is shown failing on a planted control | **Decision.** Story 2-15, **2026-09-08**; the rebuilt chrome's cases, Story 2-32, **2026-09-23**. The floor is re-measured here on the nav alone so a failure names the header rather than a surface; the universal sweep that deleted the `chrome-nav` exemption is the row above. No screenshot is taken, so no second snapshot directory is written. **The `CV` clause was rewritten in place on 2026-09-10 by Story 2-16** rather than corrected at the end of this cell: until then it read "`CV` reaching `/pdf/cv.pdf` through the 308 that stands in for the page until Story 2-16", and a reader scanning this column for what is covered reads the clause, not a note after it. The case is rewritten, not deleted, and what it measures is now the opposite. That file also keeps its two-surface list deliberately, both of them surfaces that are neither destination; the third, `/cv`, has its own row below |
| The `/cv` page and what it reuses | `tests/e2e/cv.pw.ts` | Does `/cv` answer a 200 `text/html` document with no `Location` where it answered a 308 to a PDF, while `/pdf/cv.pdf` stays served at its own URL; does `body#cv` match no override so the base `body` rule paints, controlled against `/work`, which did override it until Story 2-33 deleted `body#work` on 2026-09-23 (`/work` is read the same way since, and the control is an override planted for its id); does the header mark `CV` and only `CV` as the current page with the accent rule on the inner span, which is the first live `aria-current` in the repository; does a click on `CV` from `/work` land here, download nothing and keep the mark through a client-side navigation; is the accordion's first entry open with a panel taller than zero while the other three measure zero, and does every trigger's `aria-controls` resolve; with scripting off, since the Operator ruling of 2026-09-24 (DW-76), is every panel on `/cv` and on `/work` open with its text, a context running script being the control that reads the others at zero; does every interactive element measure at least `--tap` on both axes with the ledger's one exemption named rather than the floor loosened; and do both intro links take the standard focus ring, reached by tabbing because `:focus-visible` does not match a scripted focus | **Decision.** Story 2-16, **2026-09-10**. The universal sweep that added `/cv` as a surface is two rows up; this file is the page's own reading, so a failure names the page rather than a sweep. No screenshot is taken, so no second snapshot directory is written |
| The secondary surfaces, and A-13 on every surface | `tests/e2e/secondary-surfaces.pw.ts` | Is this file's surface list equal to the one `hit-target-floor.pw.ts` derives from `app/`, read as text with the same regex the ops suite uses; does `/recommendation` answer the 404 document, `text/html` with no `Location`, rendered by `Error404` with the two exits, while `/pdf/recommendation-letter.pdf` stays served and `/cv/` still answers Next's own trailing-slash 308, which is the reader's control; does the home footer carry exactly one link, to `/celeste`, inside `<nav aria-label='Footer'>`, at or above `--tap` on both axes, taking the Secondary treatment (`--stroke-hair` in `--token-border-interactive` on the inner span and `0px` on the box, `--token-text-secondary`, a recolour to `--token-accent-hover` on hover with no change of width, the standard ring in `--stroke-focus` and `--token-focus` reached by tabbing), and does no anchor on any surface resolve to the `/celeste` pathname other than that one, with the absolute trailing-slash form planted as a control; does `/celeste` render zero visible controls, its skip link hidden as the hidden header's first child since 2026-09-24 (DW-43), carry `<meta name="robots" content="noindex">` and still hide the header, with no routed page other than it carrying a `robots` meta and the 404 carrying exactly the one Next's own not-found boundary injects; do the 404's exits read `Suite` to `/#suite` and `CV` to `/cv`, equal to `nav.navbar a` on the same page, each at or above `--tap` on both axes, `--s-lg` apart on their separating axis with the gap-removal control, none marked `aria-current`, and do the two clicks land, `Suite` on `/` with `#suite` applied and the Directory heading in view, `CV` on `/cv` with its own `<h1>`; does every one of the five surfaces set `lang="en"` on its root element and a `<title>` no other surface shares, with `/recommendation` carrying the 404's rather than a sixth; and does the 404's `og:title` equal its document title rather than the retired route's | **Decision.** Story 2-17, **2026-09-11**, widened the same day by its review pass. The universal sweep that counts the footer link and both exits is three rows up; this file is where each is named, so a failure names the control rather than a count. No screenshot is taken, so no second snapshot directory is written. **The 404's `noindex` was a finding**: the story's matrix predicted no `robots` meta on any surface but `/celeste`, and the pinned container showed Next injecting one into every not-found response, so it is pinned as the framework's rather than asserted absent (DW-78) |
| The focus standard, A-1, on every interactive element on every route | `tests/e2e/accessibility-floor.pw.ts` | Does every tabbable on every route `app/` serves compute `--stroke-focus` solid `--token-focus` at `--focus-offset` when reached by Tab, with `:focus-visible` matched and no `transition-property` entry naming `outline` or `all` over its own duration above zero; is the ring painted whole, no ancestor's `clip-path` or `overflow` box and no document edge within the ring's reach of the element's box, with every clipped stop a dated ledger row; does it paint nothing under the pointer and nothing after a mouse click with navigation prevented; does the ring contrast at least 3:1 against the first painted ground beneath it, with each of the three token grounds read at least once and a control planted and labelled where no shipped element sits on one; are `--token-focus`, `--token-accent-hover` and `--token-accent` pairwise different colours; and do `main#main` and `h2#suite` ring when the skip-link and the skip control put focus on them by Enter; **since 2026-09-24 on every route** (DW-43, F-13, F-20): does each carry one `main#main` at tabindex -1, does the first Tab on each route with a visible header land on the skip link, the header's first child, and does the landmark then ring at the inset `-1` times `--stroke-focus` with no side clipped, the old offset planted back on `/work` shown naming the offset and the clipped sides. Every threshold is resolved through a probe on the page, never typed, and the four ring roles are read off `:root` first | **Decision.** Story 2-26, **2026-09-13**, the clip read and the Enter read added by its review pass the same day. The rule is one global `:focus-visible` in `app/app.scss`, `RESTYLE-SPEC.md` § 4 verbatim, replacing nine per-component blocks, with `main:focus-visible`'s inset beside it the one deliberate exception since the Operator ruling of 2026-09-24 (F-20); the readings, the six clipped stops, the grounds and the stated limits are in `ops/hub-accessibility-pass.md`. No screenshot is taken |
| DOM-order traversal and the skip control | `tests/e2e/accessibility-floor.pw.ts` | Does Tab from `body` visit exactly the tabbables in document order on every route, `:disabled` controls and `[inert]` subtrees left out and a focusable inside an `aria-hidden` subtree named as its own finding; does the next Tab leave the document or wrap to the first stop, anything else being a landing on something untagged; does no `tabindex` compute above zero; and on the animated door, opened on a context that has not asked for reduced motion, is `.skip-control` a Tab stop that paints the ring whole | **Decision.** Story 2-26, **2026-09-13**. `EXPERIENCE.md:739` |
| The built CSS's z-index literals and depth tells | `tests/e2e/accessibility-floor.pw.ts` | Is every `z-index:<number>`, `box-shadow`, `text-shadow`, `linear-gradient(`, `radial-gradient(`, `repeating-linear-gradient(` and `conic-gradient(` occurrence in `.next/static/chunks/*.css`, vendor prefixes included, and since 2026-09-24 every `url(` outside `@font-face` (DW-102), claimed by a dated ledger row, and is every row claimed back, tallied per value, property or function with the sum of the rows' counts held equal to what was observed; is a `z-index: var()` naming anything but a layer `contracts/tokens.css` declares an unlisted value; and does an empty or absent build throw rather than pass over nothing | **Decision.** Story 2-26, **2026-09-13**. Read as text because `ScanlineOverlay.scss` wrote a literal equal to a token by value, which a computed read passes (the case that held until Story 2-28 rewrote the line as `var(--z-raised)` on 2026-09-14; the reason outlives it). The ledger is `ops/hub-accessibility-pass.md` § The exemption ledger, the register entry KV-6. **Empty since Story 2-33, 2026-09-23, and KV-6 retired**: the tally observes nothing over the twelve built stylesheets, so its vacuity guard reads the contract layers the build does set and a planted literal and grid reported against the empty ledger |
| The type floor, A-11 and A-12 | `tests/e2e/accessibility-floor.pw.ts` | Does every visible element carrying its own text, and every `::before` or `::after` whose generated content is not blank, outside `aria-hidden` subtrees, compute at least `--t-3xs` on every route; every `<p>` at least `--t-2xs`, the four labels `DESIGN.md` places on `<p>` at the smallest step excepted by name; the six prose selectors at least `--t-sm`; nothing italic; no weight above the family's published range in `contracts/fonts.css` except what a ledger row claims, a family's `@font-face` blocks merged into one range and families the contract does not publish listed rather than judged; does no `.scss` under `app/` or `components/` set `font-size` or a `font` shorthand in `px`; and does no `:focus-visible` rule outside `app/app.scss`, or any but the bare one and, since 2026-09-24, the landmark's inside it, declare an `outline` | **Decision.** Story 2-26, **2026-09-13**. `DESIGN.md:461-502`; the thresholds are resolved on the page |
| One level-1 heading per document, A-7 | `tests/e2e/accessibility-floor.pw.ts` | Does every route carry exactly one level-1 heading in its accessibility tree, read with `getByRole('heading', { level: 1 })`, which until 2026-09-14 was what made the home route's `GlitchText` wrapper count and its `aria-hidden` `<h1>` not, and is the home route's named `Luigi Espinosa`, a real `<h1>` named by its own text since Story 2-27; a route off the rule is a dated ledger row, and the 404, which rendered its numeral and title as paragraphs, was one until Story 2-30 rebuilt it on 2026-09-23 with the display entrance as its one `<h1>`, `Page not found.`; no route is off the rule since, and the planted second heading keeps the count a measurement | **Decision.** Story 2-26's review pass, **2026-09-13**. Both route-level unit suites mock `GlitchText` away, so this is the only place the heading lands on a real document |
| Autoplay, A-16 | `tests/e2e/accessibility-floor.pw.ts` | Is there no `video`, `audio`, `marquee`, refresh meta or `[autoplay]` on any route | **Decision.** Story 2-26, **2026-09-13**. The GSAP loops are motion, not autoplay, and stop under reduced motion; the `/work` torus keeps ticking and is scroll-driven, which is stated in the record rather than claimed to stop. **Since Story 2-33 (2026-09-23) the torus is not requested at all under reduced motion**, and `tests/e2e/work-hero.pw.ts` reads no WebGL request and no canvas on that preference |
| The type swap, on the Hub's own routes | `tests/e2e/type-swap.pw.ts` | Do the two Confillia call sites on `/` (`a.nav-link`, two elements, and `.contact-container a`, three) compute the display family first and `font-stretch: 75%`, with `--confillia-normal` on `:root` reading the `--f-display` stack until Story 2-22 deleted the alias, controlled by a rule that widens one element back to `100%`; on every one of the five surfaces `hit-target-floor.pw.ts` pins, are the `@font-face` families in the document exactly the contract's three, grouping rules walked, with nothing fetched under `/fonts/`, and does the old preloaded binary's URL answer 404, controlled once by a `@font-face` planted inside `@supports`, a planted fetch and a served contract face answering 200; does every element that reaches the display face, on `/` (the two Confillia sites and `.glitch-text`, the heading itself since Story 2-27 unwrapped it on 2026-09-14), `/work` (`.work-hero__heading`, four `.work-item__company`) and the 404 (`.error-page__code`, and `.error-page__title` until Story 2-30 made the heading the display entrance on 2026-09-23, `.glitch-text` since, both reaching the face through `--f-display` directly and both read at 0.00% in the pinned image that day), hold its height within 1% across the swap (the four `.work-item__company` their height per line since 2026-09-23, when Story 2-31 set the row name at the display face's `wdth 85`, a width the fallback has no axis to reach, so the first company wraps on the fallback and not on the face; DW-82 carries the reading), measured with every woff2 aborted and then allowed on the same route with the element set held equal across the two passes, every aborted pass taken before any allowed one so a face the browser cached never reaches a fallback pass, and `/work` settled on its on-demand canvas mount first because that mount widens the hero's grid column at 360 (no settle since Story 2-33: under the pinned reduced motion the torus is never requested and its box is omitted, and the heading, uppercase at the display step since that story, read 0.00% on three lines in the pinned image on 2026-09-23), the protocol `contract-fonts.pw.ts` runs against a scratch page, with widths, rendered line counts and height per line printed and not asserted, and does a family planted from the display face's own `src` with the four metric overrides stripped breach on every one of those routes; and does one string measure two widths at `var(--f-display)` and at `var(--f-display)` with `--w-black` (at the two display aliases until Story 2-22 deleted them), and two widths at `font-stretch` 75% and 100%, each pair controlled by a twin span at the second setting measuring the same width | **Decision.** Story 2-20, **2026-09-12**. The alias-layer row above goes on reading the weight sites, and read the `--monument-regular` clamp until Story 2-30 deleted the last call site it protected on 2026-09-23, and `narrative.pw.ts` goes on pinning that `/` preloads no font; this file is where the width axis and the swap itself are measured, so a failure names the face rather than an alias. No screenshot is taken, so no second snapshot directory is written. The `/work` baseline is untouched: no rule on that route ever reached a local face |
| The display entrance on `/` | `tests/e2e/display-entrance.pw.ts` | Is the page heading a real `<h1>` inside the name panel, split into one inline `span` per character indexed `--i` in DOM order with `--count` and `--delay` inline on the heading, carrying no `aria-label`, `aria-hidden`, `role` or `aria-level` on any node; does it compute the display roles read off the page (family `--f-display`, weight `--w-black`, `font-stretch` 100%, size `--t-display`, line-height `--lh-display`, tracking `--tr-display`, uppercase, colour `--token-text`) and `text-shadow`, `clip-path` and `transform` all `none`; on a `no-preference` context, does every span run one iteration of one keyframe over `--dur-minor` on `--ease-entrance` with fill `both`, delays strictly increasing from `--delay` and the whole run from the first start to the last end inside `--dur-major` and under half a second, every span at full opacity once the window has passed; on the project's `reduce` context, does every span compute `animation-name: none` at full opacity at the first evaluation with every other read equal to the moving one; with every `_next/static/chunks/*.js` request aborted, are the words in the served markup and does every span still reach full opacity; on a planted one-character heading, does the span's delay equal `--delay`, the last of fourteen equal `--delay` plus `--dur-major` less `--dur-minor`, and a missing `--count` fall to `0s`; does the accessibility tree carry exactly one level-1 heading named `Luigi Espinosa` whose aria snapshot names nothing generic; and do the built CSS and every `.scss` under `app/` and `components/` carry no `glitch-loop`, no `text-shadow` in the build, and neither of the loop's two `rgba()` hues. Every read is seen firing on a planted shadow, a planted `infinite`, a planted half-opacity and a planted `aria-label` before its green result is read | **Decision.** Story 2-27, **2026-09-14**. The type and motion roles are resolved on the page through `:root` and a probe, never typed; the grapheme and `tag` rows of the story's matrix are jsdom's, in the component's own unit test. No screenshot is taken, so no second snapshot directory is written |
| The Plate mark's three variants and the work item, as painted | `tests/e2e/plate-mark-and-work-item.pw.ts` | Does every Plate mark (section on `/cv` and, since Story 2-30 on 2026-09-23, on the 404; annotated on `/work`, side-ruled and mirrored on `/` at 1024 on the animated door, and a planted leading-edge side-ruled mark) compute Geist Mono at `--t-3xs`, uppercase, `--tr-label`, `--token-text-secondary` and `tabular-nums`, with one 1px `--token-border` rule on the side its variant names and no other; does the subordinate line compute the muted accent at `--tr-meta`, carry `aria-hidden` and stay out of the mark's aria snapshot (on `/work`, the one annotated mark since 2026-09-23); is every mark's rule, and the timeline's separator and closed leading hairline, one row or column of pixels exactly `--token-border` rasterised on both `/work`'s ground and `/cv`'s, and the open leading rule two columns of `--token-accent`; with every stylesheet disabled, does every label cell read as a short uppercase string present in the tree while no subordinate line is, with the marks counted per route (two, one, one, one, none; two, two, one, one, none since Story 2-33 made `/work`'s meta line a section mark on 2026-09-23), and a `//` marker in a read cell reported, on a plant since Story 2-30 gave the 404 a plain word; is every row free of a ground, radius, shadow or box; does opening a row keep the open rule's reserved width while its `transform` switches, with the trigger text unmoved; does a fine pointer's hover change only pixels inside the rule, and does a tap on a `(hover: none)` touch context start no colour transition on the rule; are the chips outlined, square, unfilled and out of the tab order; is the row set in the contract's type, the meta line and the initiative in Geist Mono at the face's own `400`, the highlights and the description in the secondary role and the description at the body leading (F-3, F-4, F-5, F-9); is the `//` marker generated in the secondary role and absent from the list's aria snapshot, both lists exposed as lists and each panel a region named by its company; do Tab presses walk the triggers in DOM order and leave, each ring inside its own row and clear of the rule (F-19); does no element of the timeline sit past either viewport edge at 360 on `/work` or `/cv`, the whole-page census printed; and does the print medium show all four panels while the screen collapses three. Every read is seen answering the other way on a planted control first, and each pixel read waits for the page to be still twice in a row, because `WorkTimeLine.tsx`'s scroll entrance moved a row after the scroll that reveals it (deleted by Story 2-33; the wait stays and costs two reads when the page is still). **Since 2026-09-24** (Operator ruling, DW-110) no route renders the side-ruled variant, its one call site the removed home readout panel, so both of its forms are read on marks planted in `/cv`'s intro, and the marks counted per route are one, two, one, one, none; the subordinate line is read as generated content, its string the span's `data-ornament` (DW-113) | **Decision.** Story 2-31, **2026-09-23**. Colours are compared rasterised through one canvas, never as strings, because a colour mid-transition serialises in another space. No screenshot is compared: viewport captures are decoded in the page and none is written, so no second snapshot directory is written |
| The 404 as rebuilt, O-12 item 3 and O-13 | `tests/e2e/error-surface.pw.ts` | Does the 404, on the unrouted path and on `/recommendation`, read top to bottom as exactly a section Plate mark, one level-1 heading named `Page not found.`, one paragraph and the header's two links, with no element carrying a name by attribute and the numeral out of the tree; with the numeral removed from the document, do the title, the heading and the message each say the page was not found (branch A of O-12 item 3, logged), a page planted to say none of it reading as branch B through the same predicate; does the label read `ERROR` as plain words with the stylesheets off, the shipped `// ERR_NOT_FOUND` planted back failing the same predicate; is the numeral `aria-hidden`, unnamed, the muted accent, the display family at the heaviest weight and `--t-xl`; does the heading compute the display roles and the line the secondary role at `--t-sm` within the measure; is every pixel across the surface's top padding `--token-bg`, with no image on the surface or an ancestor and no scrim, the 2023 grid planted back seen; are the exits transparent, square, bordered on four sides at the boundary stroke in the interactive role, mono uppercase at `--t-2xs` and `--tr-label` in the text role, at the floor; does a fine pointer's hover change only the border's pixels, a finger's tap start no border transition, and Tab paint the standard ring on each exit untransitioned while a click paints none; does the entrance run one opacity keyframe at `--dur-minor` on `--ease-entrance` at 100, 300 and 500ms with the heading's display entrance from 300ms, run nothing under reduced motion, and end whole at full opacity with every script aborted; and does nothing sit past either edge at 360. Every reading is seen answering the other way on a planted control first | **Decision.** Story 2-30, **2026-09-23**. Keyed on `.error-page` markup, never on `<body id>`, which differs between the prerender and the client on this route. No screenshot is compared: viewport captures are decoded in the page and none is written, so no second snapshot directory is written |
| The `/work` hero and the timeline as rebuilt | `tests/e2e/work-hero.pw.ts` | On a context that allows motion, does the display line sit left of the canvas at 768, 1280 and 2400 with the two side by side, the columns split 3 to 2, the canvas filling a 4:3 box, and the hero closed beneath by the boundary stroke in the interactive border role, its last row of pixels exactly that role rasterised across the hero's width; at 360, does the canvas box follow the text at the column's width with nothing of the hero past an edge; is the heading the document's one level-1 heading, named by its own words and outside any `aria-hidden` subtree on both contexts, and is the canvas `aria-hidden`, inside a hidden wrapper, at `tabindex="-1"` and never reached by twelve Tab presses; on the project's reduced-motion context, does the page request no script carrying a WebGL fingerprint from `ops/asset-budget.mjs`, draw no canvas and omit the canvas box, the hero one column, and does turning reduced motion on mid-session take the torus away; with every WebGL-carrying script aborted, is the page whole, no page error thrown, and the containment logged; does the heading compute the display roles at 360, 768, 1024, 1280 and 2400 with no word broken across lines; is the meta line a section Plate mark reading the row count in positions and the period, with no `//` and no mono text outside a mark; does the entrance run one opacity keyframe on the heading and the meta at the minor duration on the entrance curve at 100 and 400ms, fill `both`, nothing else in the hero or the timeline animating and both ending at full opacity with no inline style, nothing under reduced motion, and a whole hero with every script aborted; are the timeline's rows at rest in the six frames after each scroll that reveals them on `/work` and `/cv`; and does the first row start at the container's content edge, flush with the block above it. Every reading is seen answering the other way on a planted control first | **Decision.** Story 2-33, **2026-09-23**. The WebGL fingerprints are read out of `ops/asset-budget.mjs` rather than restated, the way `tests/e2e/narrative.pw.ts` reads them. No screenshot is compared: viewport captures are decoded in the page and none is written, so no second snapshot directory is written |

`tests/e2e/rendered-output.pw.ts` runs one test per capability against `/work`, nine tests that
prove the loud-failure behaviour below, and a guard that the run exercised all three
capabilities rather than passing over an empty selection. Thirteen tests, all green, in
**22.7 s of test time** (**observed 2026-08-24** in the pinned container). Two of the thirteen
stand aside from a `--update-snapshots` run, for the reason given under "Regenerating the
baseline".

**Why `/work`.** **Decision.** It is the only route that combines a `--monument-bold` call site
(`.work-hero__heading`, `components/organisms/WorkHero/WorkHero.scss:19`), the `body#work` grid
background keyed off `<body id={route}>` (`app/app.scss:137-143` since Story 2-30 lengthened the alias layer's comment above it, `:133-139` since Story 2-26 inserted the focus rule above it, `:105-112` after Story 1-18 inserted the
alias layer above it, `:53-60` before that,
`components/atoms/Container/Container.tsx:12-16`), and server-rendered content whose GSAP
entrance tweens already sit behind `if (!reduceMotion)`. A screenshot of `/work` therefore
covers three separate mechanisms at once.

**None of the three holds since Story 2-33 (2026-09-23), and the route stays.** **Decision.** The
heading names the display family directly, `body#work` is deleted, and the entrance is one CSS
keyframe the pinned reduced motion turns off. The baseline is `/work`'s history and the route still
carries the most the Hub renders on one surface (the chrome, a display line, two Plate marks and the
timeline's rows), so it is kept rather than traded for another, which would be a second instrument
rather than this one. The two capability reads now take `--f-display`, which the heading declares,
rather than the alias it used to.

**Why the torus is masked.** **Decision.** `components/molecules/TorusCanvas/TorusCanvas.tsx` is
WebGL driven by `useFrame` and can never be stable between two captures. The harness masks
`.work-hero__canvas-wrap` rather than waiting for it. Masking is honest about what is not being
measured. Adding a test hook to the application to freeze the canvas would change the thing
being measured, which Story 1-10's boundaries forbid.

**Nothing is masked since Story 2-33 (2026-09-23).** **Decision.** Under the pinned
`reducedMotion: 'reduce'` the torus is never requested and its box is omitted, so there is no
unstable region in the frame and all 288,000 pixels are compared. The capture asserts it rather than
trusting it: no `canvas` on the page, and the canvas box present in the markup with no box. A canvas
arriving under that preference fails there first, naming it, rather than making the comparison flaky.
The `mask` option stays in the harness, and `refuses a mask selector that matches nothing` still
proves its refusal.

## What it deliberately does not assert yet

Naming these here is the point of the section: a harness that exists is easily mistaken for a
harness that covers everything.

| Not asserted | Why not | Owner |
|---|---|---|
| Any `--token-*` name, and anything under `contracts/` other than the font faces | Story 1-10 shipped the instrument, not the contract. Story 1-12 added the second spec file, `tests/e2e/contract-fonts.pw.ts`, which asserts that `contracts/fonts.css` resolves from a folder vendored at an arbitrary depth and that the font swap moves no sample block beyond a recorded tolerance. No `--token-*` role is asserted in a browser yet | **Decision.** Stories 1.11 through 1.14, amended 2026-08-25 by Story 1-12 |
| Colour contrast ratios | **Superseded in place by Story 2-26 on 2026-09-13, for the one ratio the plan asks a machine for.** The focus ring's contrast against the ground beneath it is measured on every Tab stop on every route in `tests/e2e/accessibility-floor.pw.ts` (row above) and held to the 3:1 non-text floor; the Status mark's contrast is measured in `tests/e2e/status-mark.pw.ts` to prove the colour conversion and not asserted as a floor. **Text contrast stays with Lighthouse**: `.lighthouserc.js` asserts accessibility at 0.95 on `/`, `/work` and, since 2026-09-13, `/cv`, and its `color-contrast` audit is where the one text finding of the pass (F-5 in `ops/hub-accessibility-pass.md`) was read. No spec computes text contrast, because a browser audit already does and a second reader would drift from it | **Decision.** Epic 1 token stories until 2026-09-13; Story 2-26 since |
| Any route other than `/work` | One route is enough to establish the instrument. Adding routes is cheap once the instrument exists | **Decision.** Story 1-10 scope |
| Anything below the fold on `/work` | The comparison is the 360 x 800 viewport, not `fullPage`. `ScreenshotOptions` in `tests/e2e/harness.ts` exposes only `mask`, so a caller cannot widen it today. Story 1.17's "visually identical to the pre-change build" therefore rests on one viewport of one route unless that story widens the capture first. Unlike the route axis, this one is pinned in the config by design and is not free to extend | **Decision.** Story 1-10 scope, and a limit Stories 1.17 and 1.20 inherit knowingly |
| The 86,400 masked pixels, **superseded 2026-09-23 by Story 2-33: nothing is masked and the whole frame is compared** | `.work-hero__canvas-wrap` is 360 x 240 at this viewport, so 30 percent of the frame is excluded. The comparison covers the remaining 201,600. A canvas that renders nothing at all would still pass the screenshot gate, which is why the same test asserts the masked element has a non-zero bounding box | **Observed 2026-08-24**, from `components/organisms/WorkHero/WorkHero.scss:46-48` and the element's bounding box |
| That `--font-mono` renders for a visitor the way it renders here | **Closed by Story 1-18, and the reason it was open is gone.** Until 2026-08-26 this read `--font-mono: 'Courier New', monospace` (`app/app.scss:31`), which has no Courier New in the Linux image, so `.work-hero__meta` (`WorkHero.scss:27`) was baselined against a fallback face no real visitor sees. `app/app.scss:59` now reads `--font-mono: var(--f-mono)`, which is `"Geist Mono", ui-monospace, SFMono-Regular, monospace`, and `contracts/fonts.css` serves that face to the container and to a visitor alike, so the baselined text is representative for the first time | **Observed 2026-08-24**, superseded **2026-08-26** by Story 1-18 |
| That the `@font-face` src still resolves | `computedStyleValue` returns the resolved declaration, not the face that rasterized. Until 2026-08-26 it would still have answered `MonumentExtended-Bold` if `app/scss/_fonts.scss:91-99` broke and Chromium fell back; since Story 1-18 the same hole exists one family over, against the contract's `Bricolage Grotesque`. Only the screenshot covers rasterization, and only for `.work-hero__heading`. The other three `--monument-bold` call sites live on routes the harness does not capture. **Amended 2026-09-23 by Story 2-33**: no `--monument-bold` call site is left anywhere, the heading names `--f-display` directly and the two capability reads take that role, and the hole is the same one against the same face | **Observed 2026-08-24**, restated against the adopted face **2026-08-26** |
| Accessibility | **Superseded in place by Story 2-26 on 2026-09-13.** Until then this row read "unchanged and untouched": `.lighthouserc.js` asserted accessibility at 0.95 on two URLs and nothing in `tests/e2e` asserted the behavioural floor. Now the five rows above assert A-1, the DOM-order traversal, A-11, A-12 and A-16 on every route, `tests/e2e/hit-target-floor.pw.ts` asserts A-4 and A-5, `tests/e2e/status-mark.pw.ts` A-3, `tests/e2e/front-door.pw.ts` A-6 and A-14's two markup clauses, and `tests/e2e/secondary-surfaces.pw.ts` A-13. `.lighthouserc.js` still asserts accessibility at 0.95 with severity error, on three URLs since `/cv` joined on a local reading, and `.github/workflows/lighthouse.yml` still runs it. What no machine asserts is the two human confirmations, greyscale and one keyboard traversal, recorded in `ops/hub-accessibility-pass.md` and outstanding until the Operator performs them | **Observed 2026-08-24** by `git diff --stat 4f4c751`; superseded **2026-09-13** by Story 2-26 |
| A render change that stays under the per-pixel `threshold` on every pixel it touches | It counts as zero differing pixels, whatever its extent, because `maxDiffPixelRatio` counts only pixels `threshold` has already called different. The case on record: Story 2-28 removed the hero's `light` raster and grain from `/work`, 80,831 of 288,000 pixels changed, the largest YIQ distance among them was 662.5 against the 1,408.6 the default 0.2 allows, the plain run passed and the update run wrote nothing (§ Regenerating the baseline). A faint overlay returning to `/work` would pass this gate the same way; the two unit assertions Story 2-28 added to `Error404.test.tsx` and `WorkHero.test.tsx` are what would catch it, and `node ops/baseline-diff.mjs` is what states the number | **Observed 2026-09-14** by Story 2-28. The `threshold` question is DW-102's, unassigned, trigger the next baseline change the comparator measures as none |

## The tolerance

**The rule, stated before the number.** **Decision.** Playwright's per-pixel `threshold` stays
at its default, so `maxDiffPixelRatio` is the only knob and it is written down here.
`maxDiffPixelRatio` is then set so the shift probe's measured ratio clears it by at least five
times. If the smallest shift Story 1.17 would care about does not clear it by a wide margin,
the tolerance is wrong and gets lowered, rather than the probe being made louder.
*(Amended 2026-09-14 by Story 2-28: "the only knob" overstated it. `maxDiffPixelRatio` counts
only the pixels `threshold` has already called different, so `threshold` decides first on every
pixel and the ratio bounds what is left. On that day `threshold` decided the outcome alone on
80,831 pixels, 28 percent of the frame, for a change a person sees, the hero's raster and grain
leaving `/work`, and the ratio saw zero of them. The decision to leave `threshold` at its default
stands; the claim that the ratio alone bounds what a human would see does not. § Regenerating the
baseline carries the measurement.)*

| Value | Number | Nature |
|---|---|---|
| Viewport | 360 x 800, `deviceScaleFactor: 1` | **Decision.** `playwright.config.ts`, exported as `RENDERED_VIEWPORT` so a spec cannot re-declare it and drift from the baseline |
| Total pixels in the frame | 288,000 | **Derived** from the viewport |
| Pixels actually compared | 201,600 until 2026-09-23; **288,000 since**, when Story 2-33 took the torus off the pinned reduced-motion render and the mask with it | **Derived**: 288,000 less the 86,400 the torus mask covered. The ratio below is Playwright's, computed over the whole frame, so the tolerance is looser over the compared region than the raw number suggests. It is recorded here rather than corrected, because changing the denominator would put this file at odds with every number Playwright prints |
| Per-pixel `threshold` | Playwright default (0.2, YIQ colour space) | **Decision.** Left alone deliberately, so there is one number to reason about rather than two. *(Amended 2026-09-14 by Story 2-28: there are two numbers, and this one acts first. A change that stays under it on every pixel it touches, however many, reaches the ratio as zero; 80,831 such pixels on that day. The default stays, and the blind spot is a row under § What it deliberately does not assert yet)* |
| `maxDiffPixelRatio` | **0.001** | **Decision.** Equivalent to 288 differing pixels out of 288,000 |
| Shift probe measured ratio | **0.007274** (2,095 pixels of 288,000) | **Observed 2026-08-24**, by adding `transform: translateX(1px)` to `.work-hero__heading` and running the harness in the pinned container. Playwright's own report rounds this to "ratio 0.01"; 0.007274 is 2095 divided by 288000 |
| Margin | **7.27 times** the tolerance | **Derived**: 2,095 divided by 288 |

**Why 0.001 and not smaller.** **Decision.** Both sides of the comparison are pinned to one
container image, so an unchanged render is essentially byte-identical and the honest floor would
be zero. 0.001 is deliberately a little above that floor: it absorbs a handful of stray pixels
from a font-rasterization or compositing detail without absorbing anything a human would see.
*(Amended 2026-09-14 by Story 2-28: true of the ratio's own allowance of 288 pixels, and not a
claim about the comparison as a whole, because the per-pixel `threshold` runs first and can hand
the ratio zero for a change spread thin across a region a person does see. The 80,831-pixel case
under § Regenerating the baseline is the one on record.)*
The 7.27 times margin is what makes that claim checkable rather than asserted. If a future
change to `/work` makes an unchanged render produce more than a few dozen differing pixels, the
answer is to find out why, not to raise this number.

**Why 0.001 and not larger.** **Decision.** Story 1.17 adds the token contract and changes
nothing visible, and Story 1.20 turns on whether a render changed. A tolerance loose enough to
absorb a one-pixel shift would let exactly the regression those stories exist to catch through.

## What provisioning the browser costs

C-7 (`ARCHITECTURE-SPINE.md:433`) records browser provisioning as a real setup cost never paid,
so this section pays it in writing.

**The mechanism is an image pull, not a browser download.** **Decision.** The CI job runs inside
`mcr.microsoft.com/playwright:v1.62.1-noble`, which ships the browsers already built for the
`@playwright/test` version it is tagged with. There is no `playwright install` step in
`.github/workflows/ci.yml`, and there must not be one: a download step would reintroduce the
version drift the pinning exists to prevent.

| Figure | Value | Nature |
|---|---|---|
| Image | `mcr.microsoft.com/playwright:v1.62.1-noble` | **Decision.** Pinned to the exact `@playwright/test` version in `package.json` |
| Index digest | `sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e` | **Observed 2026-08-24**, by `docker pull` then `docker image inspect` |
| linux/amd64 manifest digest | `sha256:c091b21d9fae78c76e85cd4356431e9b018402f172a214fc7d7a5e9a7e29d8ac` | **Observed 2026-08-24**, by `docker manifest inspect` on the index |
| Download size, linux/amd64 | **949,411,114 bytes (905 MiB) across 7 layers** | **Observed 2026-08-24**, by summing the `size` field of every layer in the amd64 manifest. This is the figure a GitHub-hosted runner transfers, and it is the harder of the two provisioning numbers because it does not depend on whose network measured it |
| Pull wall time on this host | **50.9 s** | **Observed 2026-08-24** on the Windows 11 development host, Docker server 29.7.2, by `docker rmi` on the tag followed by a timed `docker pull`. **Read this as an upper-bound-shaped local figure, not as the CI figure.** `docker rmi` untags and deletes the image but does not guarantee every layer left the local content store, and this host's network is not the runner's. The CI number is unknown until the first real run, which is Pending Operator action 1 below |
| Node in the image | v24.18.1 | **Observed 2026-08-24**, by `node -v` inside the container. Note that the existing `test` job pins Node 22 through `setup-node`; the container job takes the image's Node instead, which is the version the pinned browsers were built against |
| Harness run, cold `.next`, six-test file | **27.8 s wall** for `pnpm build`, `pnpm start` and all six tests | **Observed 2026-08-24**, by emptying the container's `.next` volume and timing one `docker run` of `pnpm test:e2e`. Playwright reported 24.1 s of that as test time. Measured before the file grew to thirteen tests, and kept rather than overwritten |
| Harness run, warm `.next`, six-test file | **24.3 s wall**, 21.5 s reported as test time | **Observed 2026-08-24**, same method without emptying the volume |
| Harness run, thirteen-test file | **22.7 s** reported as test time | **Observed 2026-08-24**, by running the full file in the pinned container after the review pass added the seven further failure-path tests. Nine of the thirteen tests never take a screenshot, so the count grew faster than the clock |
| Whole `pnpm test:e2e` run, nine spec files, **71 tests** | Two readings on the same tree: **1.7 min** headline with a **108.8 s** docker wall, and **3.7 min** headline with a **229.1 s** wall | **Observed 2026-09-06** on the same host, after Story 2-9 added `tests/e2e/suite-directory.pw.ts` (ten cases) and one case to `hit-target-floor.pw.ts`. **The two readings are the same command on the same tree minutes apart**, and the spread is host load rather than anything in the code, which is why nothing asserts on any of these. Eleven more tests than the row below for a cost still dominated by the one `pnpm build` its `webServer` performs. Kept beside that row rather than replacing it |
| Whole `pnpm test:e2e` run, eight spec files, **60 tests** | **1 m 41.3 s** measured by `time` around the command; **1.7 min** as Playwright's own headline for the same run. The `docker run` wall around it was **105.2 s** | **Observed 2026-09-06** on the Windows development host, after Story 2-8 added `tests/e2e/hit-target-floor.pw.ts`. **Read what each figure covers**: the command is `pnpm build && pnpm start` plus all sixty tests, Playwright's headline starts when the run does and so includes that build, and the docker wall adds four seconds of `corepack enable` and `pnpm install --frozen-lockfile` against the warm named volumes. The image pull is in none of them; it is the 28 s row in the CI table below. **This is the figure the CI job actually pays**, because `.github/workflows/ci.yml:276-277` runs the whole directory rather than one file; every row above describes one spec file inside that run and is kept rather than overwritten |
| Of that run, the hit-target spec alone | **24.6 s** across its fifteen cases, of which the sweep case was **13.7 s** | **Observed 2026-09-06**, same run, by summing the per-case durations the list reporter printed. Five navigations, five hydration waits and 43 elements measured at two round trips each. `ops/hit-target-floor.md` carries the breakdown and the same numbers |

### The CI figures, measured on a runner

**Observed 2026-08-25** from Actions run `32801557172`, the first execution of this job on a
GitHub runner. These are the figures C-7 asked for; the local rows above are kept beside them
rather than overwritten, because they were measured by a different method on a different machine.

| Step | Wall | Nature |
|---|---|---|
| Whole job | **69 s**, 02:28:58Z to 02:30:07Z | **Observed** |
| `Initialize containers`, which is the image pull | **28 s** | **Observed.** The provisioning cost C-7 names, paid on a cold runner |
| `actions/checkout@v4` | 1 s | **Observed** |
| `pnpm/action-setup@v4` | 1 s | **Observed** |
| `pnpm install --frozen-lockfile` | **6 s** | **Observed.** Against 4 m 33 s on the Windows development host below, which is the bind-mount penalty rather than a real install cost |
| `Rendered-output harness`, the thirteen tests | **28 s** | **Observed.** Against 22.7 s of reported test time locally, so the runner is close to the development host once provisioned |

**The image pull and the harness cost the same**, 28 s each, so roughly half this job is
provisioning that no amount of test tuning will remove. That is the number C-7 wanted written down.

**`actions/checkout@v4` and `pnpm/action-setup@v4` both behaved correctly inside the pinned
container job**, which had never been exercised in this repository before this run. Both completed
in about a second with no warnings. That closes the second thing the first run existed to answer.

**These timings also predate every spec file added after 2026-08-25.** The 28 s row measures the
thirteen tests in `rendered-output.pw.ts`, which was the whole of `tests/e2e` on the day it was
taken. The job has always run the directory (`ci.yml:276-277`), and the directory now holds eight
spec files and 58 tests, so the CI figure for the step is stale in scale rather than in method. The
local 2026-09-06 row above is the closest measurement of the current shape, and no re-run on a
runner has been made. Whoever next reads an Actions summary for this job should add a CI row beside
it rather than editing this one.

**These timings predate the Node 22 pin** recorded in Operator action 2 below. They describe the
job as it ran on the image's own Node v24.18.1. The pin changes the runtime, not the image, so the
image-pull figure is unaffected; the install and harness figures could move slightly and have not
been re-measured.

**What these numbers do not include.** `pnpm install --frozen-lockfile` inside the container took
**4 m 33 s** on this host (**observed 2026-08-24**), but that figure is dominated by pnpm writing
its store onto a bind-mounted Windows filesystem and says nothing about CI, where the store is on
the runner's own disk. It is recorded only so a later reader does not mistake its absence for an
omission.

## Regenerating the baseline

The committed baseline is `tests/e2e/rendered-output.pw.ts-snapshots/work-360x800-chromium-linux.png`.
Its sha256 is `93a1aa4e9c8374207ae689707b1e843285ba927fb762ed2f09d105050b9a59d8` (**Observed
2026-09-23**, by `sha256sum`). It has been regenerated six times, each time under case 1 below, and
each earlier value is kept so a reader can tell which file an older dated observation was made
against:

| sha256 | Regenerated by | On | What changed on `/work` |
|---|---|---|---|
| `27f22bb6ff78c62e019cc8f222665436b7a20c2445a90677bead375c7d763f97` | Story 1-10, the original capture | 2026-08-24 | n/a |
| `4203eccab7a108cb2b9c9f0fd04106f85595145474c89c9c7c55139bb18d278f` | Story 1-18 | 2026-08-26 | The alias layer retargeted `--monument-bold` onto the published display family |
| `03df32bb790bae482ea3b878d0d715542ec2d05a44d3a30df14992ad86417270` | Story 2-15 | 2026-09-08 | The header carries two destinations instead of five inline links plus a `mailto:`, each built to `--tap` on both axes, on a sticky opaque token ground. **2980 pixels differed**, which the run printed before the baseline was refreshed |
| `b9961fccc83e0ada42baca30aad6130a3850faf32d14065875609a8f60538295` | Story 2-28 | 2026-09-14 | The hero's `light` raster and grain left with the `ScanlineOverlay`. **80,831 of 288,000 pixels differ** from the previous file, every one of them under the per-pixel threshold, so the comparator counted none, the plain run stayed green and the update had to be forced with `--update-snapshots=all` by Operator ruling (the paragraph below). The file is 26,692 bytes where the previous one was 166,326: the grain was what the PNG spent its bytes on |
| `7c05902467e2e84edd850cd54ab793fcfa51d02fca1394210c119c43687459db` | Story 2-31 | 2026-09-23 | The hero's label became the Plate mark's annotated variant: `EXPERIENCE` over a hairline where `// EXPERIENCE` hung beside a side rule, the kanji beneath it in the muted accent. The first timeline row, whose top enters the frame at the bottom, took the rebuilt row type: the name in the display face at `wdth 85` and uppercase, the meta line in mono and wrapping, and the state glyph back inside the viewport, where the unwrapped meta line had pushed it to 490.67. **7134 of 288,000 pixels differed** (a true ratio of 0.0248 against the gate's 0.001), which the plain run printed before `pnpm run test:e2e:update` rewrote the file in the pinned image (that run failed one of this story's own new pixel reads on a race with the timeline's scroll entrance, which the spec file then closed; the baseline is not that test's), and a plain run with no filter was then green, 286 of 286, against it. The file is 24,322 bytes |
| `916c546007739aa5da2af340b579431b879bc45d1d2e1a53ff17954b45116938` | Story 2-32 | 2026-09-23 | The chrome, rebuilt: the header is a full-width band 93px tall rather than 140, closed by a hairline, holding the wordmark `CUATRO` as text in the display face where the raster stood and the two destinations in mono uppercase, `Suite` over its hairline rule; the container is `min(100%, 1920px)` at `--page-pad`, so the hero and the first timeline row set 320 wide at 360 where they set 256, and the hero's column sits inside the viewport. **47,941 of 288,000 pixels differed**, which the plain run printed before `pnpm run test:e2e:update` rewrote the file in the pinned image, and a plain run with no filter was then green against it. The file is 23,763 bytes |
| `93a1aa4e9c8374207ae689707b1e843285ba927fb762ed2f09d105050b9a59d8` | Story 2-33 | 2026-09-23 | The hero and the timeline, rebuilt, and the first capture with nothing masked: under the pinned reduced motion the torus is not requested and its box is omitted, so the frame holds the annotated mark, the display line `FRONTEND DEVELOPER AND TEAM LEAD` uppercase in the text role on three lines, the meta line as a section Plate mark (`4 POSITIONS`, `2017 - PRESENT`) over its hairline, the hero's boundary rule, and the first timeline row flush at the page's gutter, all on `--token-bg` where `body#work` painted `#0a000f` under its grid. **85,590 of 288,000 pixels differed** (ratio 0.30), which the plain run printed before `pnpm run test:e2e:update` rewrote the file in the pinned image (321 passed, the two cases that stand aside from an update skipped); a plain run with no filter was then green, 323 of 323, after one case of the new `tests/e2e/work-hero.pw.ts` was made to wait for the renderer (its fault, not the baseline's), and 325 of 325 after the review ran the new spec's composition case at three widths. The file is 35,763 bytes |

The 2026-08-24 observations further down this section were made against the first file and are
dated as such; the table above is where the current value lives.

**Story 2-22 compared against this file and did not regenerate it.** **Observed 2026-09-23**, in
`mcr.microsoft.com/playwright:v1.62.1-noble`: with the alias layer deleted from `app/app.scss` and the
base rule naming its roles, a plain `pnpm test:e2e` with no filter passed 325 of 325 in 6.0 minutes,
and again in 5.8 minutes on the tree the story commits after its review patches, against the file at
`93a1aa4e…`, Story 2-33's capture after the last redesign, and wrote nothing: its sha256 read the same
afterwards. That is Story 2-22's criterion, the rendered result asserted against
the redesigned baseline and not against the pre-redesign build. **Decision**, taken by that story:
`app/__tests__/anchor-contract.test.ts` holds the committed file to the value this section states as
current and to the Story 2-33 row of the table or a later one, so a regeneration nobody recorded here,
or an earlier capture put back, fails the blocking `test` job before the comparison can pass against it.

**Story 2-28 changed how `/work` renders, the harness measured the change as none, and the update
was forced.** **Observed 2026-09-14**, in `mcr.microsoft.com/playwright:v1.62.1-noble`, three runs
in the order the story's spec set. The story deleted the `ScanlineOverlay` raster from the hero (the
`light` scanlines at 35 percent over `rgba(0, 0, 0, 0.12)` lines and the `feTurbulence` grain at 20
percent, both over the `#0a000f` ground), which is case 1 below. A plain `pnpm test:e2e` against
the file at `03df32bb…` then **passed, 253 of 253**, and `pnpm run test:e2e:update` **wrote
nothing** (251 passed, the two update-mode skips), because bare `--update-snapshots` is the
`changed` mode described below and a capture that matches is not rewritten. The difference is real
and under the gate: a fresh masked capture of `/work` at 360 x 800 in the same image, taken twice a
second apart and byte-identical both times, differs from that file on **80,831 of 288,000 pixels**
(a raw ratio of 0.2807), every one of them inside x 52 to 307, y 140 to 676, which is the hero's box
in the container (x 52 to 308, y 140 to 677.7), and **on 0 of them** by more than the per-pixel
`threshold` of 0.2 Playwright compares at, the largest YIQ distance being 662.5 against the 1,408.6
that threshold allows. So `maxDiffPixelRatio` never came into it: the comparator counted no
differing pixel, which is why the run was green and the update run had nothing to write. Measured
on the authoring host against captures made in the image, by
`node ops/baseline-diff.mjs 03df32bb.png tests/e2e/rendered-output.pw.ts-snapshots/work-360x800-chromium-linux.png`
(the previous file kept aside under its own hash, the forced file in place), which printed:

```
{"size":"360x800","total":288000,"differing":80831,"differingRatio":0.2807,"differingBox":{"x":[52,307],"y":[140,676]},"threshold":0.2,"thresholdDelta":1408.6,"over":0,"overRatio":0,"overBox":null,"largestDelta":662.5}
```

The script's header states what it recomputes and where Playwright's comparator defines it.
**Decision.** **The Operator ruled on
2026-09-14 to force the update**, run in the same image as
`pnpm exec playwright test --update-snapshots=all rendered-output` (the two tests that stand aside
from an update run skip themselves in that mode too, 11 passed and 2 skipped), followed by a plain
`pnpm test:e2e` with no filter, 253 of 253 green against the new file. The reason: the committed
reference is the intended render, and case 1 is about the render changing, not about the comparator
noticing. A baseline that still carries the grain would be a picture of something the site no
longer paints, and the next story to move `/work` past the tolerance would have had the raster's
absence folded into its own diff. **This forced invocation is the one exception to "updating is
the explicit `pnpm test:e2e:update` invocation and nothing else" below**, taken by Operator ruling
and recorded here rather than silently; the rule stands for every run that is not ruled on. The
file written is pixel-identical to the measurement capture above and its sha256 is the fourth row
of the table.

**What 2980 differing pixels is, in the units the gate is set in.** **Observed 2026-09-08.** The
capture is 360 x 800 at `deviceScaleFactor: 1`, which is **288000 pixels**, so 2980 is a true ratio
of **0.0103**. `MAX_DIFF_PIXEL_RATIO` is 0.001, which `playwright.config.ts` hands to Playwright as
`maxDiffPixelRatio` and Playwright turns into an allowance of **288 pixels**; the render therefore
exceeded the gate by a factor of **ten**.

**The runner's own message said `ratio 0.02`, and that is not a second measurement.** Playwright
computes the figure it prints as `Math.ceil(count / (width * height) * 100) / 100`
(`playwright-core@1.62.1`, `lib/coreBundle.js:7563`), so any ratio between 0.01 and 0.02 prints as
0.02. It rounds **up** to two decimals rather than to nearest, which is the right behaviour for a
number a reader is about to compare against a threshold and the wrong number to copy into a record
as an observation. The count is the reading; the printed ratio is a presentation of it.

**It must be generated inside `mcr.microsoft.com/playwright:v1.62.1-noble`.** **Decision.**
Playwright names a snapshot per platform, so a baseline made on the Windows host would be
`-win32.png` and CI would fail on a missing `-linux.png`. Even forcing the name, the render
would differ, because glyph rasterization is not portable. Until 2026-08-26 the sharper half of
that argument was `--font-mono: 'Courier New', monospace` (`app/app.scss:31`), a family Linux does
not carry at all; Story 1-18 mapped that property onto `--f-mono` and the contract serves the face
to both platforms, so what remains is the rasterizer difference alone. Pinning both sides to one
image is what makes the tolerance a real number rather than a fudge factor.

**Two tests stand aside from an update run, and must keep doing so.** **Decision.** Bare
`--update-snapshots` presets Playwright's mode to `changed`, in which a mismatching screenshot is
**written over** rather than failed on, and a missing one is written rather than reported. The
two tests that exist to prove those very failures would therefore, in an update run, overwrite
the real baseline with their deliberately shifted render and write a second, unwanted baseline
under the absent-baseline name. Both carry
`test.skip(testInfo.config.updateSnapshots !== 'none', ...)` for exactly that reason, and
`keeps exactly one committed baseline` fails the run if a stray snapshot appears anyway.
**Observed 2026-08-24** in the pinned container: an update run skipped 2 of 13, passed 11, left
`work-360x800-chromium-linux.png` byte-identical at
`sha256:27f22bb6ff78c62e019cc8f222665436b7a20c2445a90677bead375c7d763f97`, and left the snapshot
directory holding that one file.

The command used on 2026-08-24, from the repository root on the Windows host:

```
docker run --rm --ipc=host ^
  -v C:/CuatroEcosystem/cuatro-portfolio:/w ^
  -v pw-node-modules:/w/node_modules ^
  -v pw-next:/w/.next ^
  -w /w -e CI=1 ^
  mcr.microsoft.com/playwright:v1.62.1-noble ^
  bash -lc "corepack enable && pnpm install --frozen-lockfile && pnpm run test:e2e:update"
```

The two named volumes matter. `node_modules` and `.next` on the Windows host hold Windows
binaries (`sharp`, `@next/swc`), which a Linux container cannot execute, so both are masked with
container-local volumes rather than read through the bind mount. `corepack enable` is needed
because Playwright's `webServer` command calls `pnpm` by name and only `corepack` is on the
image's PATH; on a GitHub runner `pnpm/action-setup@v4` does that job instead. `--ipc=host` is
not optional either: Chromium in a container gets a 64 MB `/dev/shm` by default and crashes the
renderer when it runs out. The CI job carries the same flag as `container.options`, so both
sides of the comparison run on one configuration.

**The harness does not run on this Windows host, by design.** **Observed 2026-08-24.** Playwright
names a snapshot per platform, so a bare `pnpm test:e2e` here looks for `work-360x800-win32.png`,
does not find it, and fails. That is the intended answer: a Windows capture is not comparable to
the committed Linux one, and `updateSnapshots: 'none'` means the failing run writes nothing to
be committed by mistake. The supported way to run or refresh the harness locally is the docker
command above, and nothing else. The server it starts listens on port **3100** rather than 3000,
so a `next dev` already running cannot be mistaken for the production build the config builds,
and `reuseExistingServer` is `false` for the same reason.

**When regenerating is legitimate.** **Decision.** Exactly three cases:

1. A story deliberately changed how `/work` renders, and the new render is the intended one. The
   regenerated PNG is part of that story's diff and is reviewed as a change, not as noise. When
   this case applies and `pnpm test:e2e:update` declines to write, because the change stays under
   the per-pixel threshold and `changed` mode rewrites only a mismatch, the run is
   `pnpm exec playwright test --update-snapshots=all rendered-output` in the same image, by
   Operator ruling, recorded the way the 2026-09-14 paragraph above records it (added 2026-09-14
   by Story 2-28).
2. The pinned Playwright version moved. The `package.json` pin, the image tag in
   `.github/workflows/ci.yml` and the baseline are one change, made together.
3. The route, viewport or mask in `tests/e2e/rendered-output.pw.ts` changed on purpose.

**When it is not.** A red screenshot test on a story that did not intend a visual change is a
finding, not a baseline to refresh. Regenerating to get a build green is the failure mode this
whole file exists to make visible, and it is why the baseline is never written as a side effect:
`playwright.config.ts` sets `updateSnapshots: 'none'`, so a missing or mismatched baseline fails
the run and writes nothing. Updating is the explicit `pnpm test:e2e:update` invocation and
nothing else (one recorded exception, taken by Operator ruling on 2026-09-14 when that invocation
declined to write a change it could not measure: the forced `--update-snapshots=all` run under
§ Regenerating the baseline, and case 1 above says when it applies).

**Observed 2026-08-24**, by renaming the committed PNG aside and running the harness: the run
failed with `A snapshot doesn't exist at /w/tests/e2e/rendered-output.pw.ts-snapshots/work-360x800-chromium-linux.png.`
and the snapshot directory was still empty afterwards.

## The two probe demonstrations

A gate never observed to fail is not known to work. Each probe was applied, run, its output
recorded here, and reverted. **Neither probe exists in the tree at this story's closing commit**,
which is why their output lives in this file.

**A probe is a one-time demonstration; the standing tests are something else.** **Decision.** A
demonstration recorded in a file proves the gate could fail on 2026-08-24. It proves nothing
about the run after someone raises `maxDiffPixelRatio` or sets `updateSnapshots` to `all`. So the
two screenshot failure paths are also asserted permanently, by `fails when the render is shifted
past the tolerance` and `fails naming the baseline when none is committed` in
`tests/e2e/rendered-output.pw.ts`. Both keep the suite green: they assert that the comparison
rejects, rather than being a broken assertion left behind. The shift they use is injected into
one page through `addStyleTag` and touches no file, which is what separates them from Probe 1's
edit to `WorkHero.scss`.

What they do not cover is worth stating, because a standing test invites more trust than it has
earned. The shift they inject lands on `.work-hero__heading`, so they catch a mask widened over
the heading and not a mask widened over some other region; `refuses a mask selector that matches
nothing` covers the other common way a mask stops masking. And because the shift is injected
through the browser, they exercise the comparator rather than the source-to-render path Probe 1
went through.

### Probe 1: a deliberately shifted render

| Field | Value | Nature |
|---|---|---|
| The probe | `transform: translateX(1px)` added to `&__heading` in `components/organisms/WorkHero/WorkHero.scss` | **Decision.** One pixel, because one pixel is the smallest shift Story 1.17 would care about. A larger probe would prove less |
| Result | The screenshot test failed | **Observed 2026-08-24** in the pinned container |
| Measured difference | 2,095 pixels, ratio 0.007274 of 288,000 | **Observed**, from Playwright's failure output |
| Artifacts written | `work-360x800-expected.png`, `work-360x800-actual.png`, `work-360x800-diff.png` and `trace.zip` under `test-results/` | **Observed.** The CI job uploads `playwright-report/` on failure, so a red run on a pull request carries its diff image |
| Reverted | Yes, by `git checkout -- components/organisms/WorkHero/WorkHero.scss` | **Observed**, confirmed by `git status --porcelain` |

Playwright's own line, quoted:

```
Error: expect(page).toHaveScreenshot(expected) failed

  2095 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: work-360x800.png
```

### Probe 2: a deliberately wrong expected value

| Field | Value | Nature |
|---|---|---|
| The probe | The expected computed `font-family` on `.work-hero__heading` changed from `MonumentExtended-Bold` to `MonumentExtended-Regular` in `tests/e2e/rendered-output.pw.ts` | **Decision.** The wrong value is the other real family in the same token block, not a nonsense string, so the probe tests the read rather than the string comparison |
| Result | The computed-style test failed | **Observed 2026-08-24** in the pinned container |
| Reverted | Yes | **Observed**, confirmed by the final green run of the whole file |

Playwright's own line, quoted:

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "MonumentExtended-Regular"
Received: "MonumentExtended-Bold"
```

## Failing loudly rather than vacuously

`getPropertyValue` answers an undeclared custom property with an empty string. A helper that
returned that string would pass any equality check against another empty string, and a gate that
passes over nothing is worse than no gate. Both reads therefore throw, naming what was missing.
Every row below is asserted by a permanent test rather than by a probe, and by the story's own
rule a branch that has never been observed to fail is not known to work.

| Case | Behaviour | Nature |
|---|---|---|
| A render differs past the tolerance | The comparison rejects, and Playwright's message carries the differing pixel count and ratio | **Observed 2026-08-24.** `tests/e2e/rendered-output.pw.ts`, "fails when the render is shifted past the tolerance", which injects a one-pixel shift through `addStyleTag` and asserts the rejection |
| No baseline is committed for the name asked for | The comparison rejects naming the exact path it looked for, and writes nothing | **Observed 2026-08-24.** Same file, "fails naming the baseline when none is committed". The snapshot directory held only `work-360x800-chromium-linux.png` after the run |
| Selector matches nothing | Throws naming the selector and the URL it was looked for on | **Observed 2026-08-24.** `tests/e2e/rendered-output.pw.ts`, "fails naming the selector when nothing matches it" |
| Custom property not declared on `:root` | Throws naming the property | **Observed 2026-08-24.** Same file, "fails naming the custom property when it is not declared" |
| Property resolves to an empty string | Throws naming the property, because an empty string is what an unknown property name yields | **Observed 2026-08-24.** Same file, "fails naming the property when it resolves to an empty string", which reads an undeclared custom property off an element |
| A name that is not a custom property is passed to the `:root` read | Throws saying so, rather than answering with a real property's real value | **Observed 2026-08-24.** Same file, "refuses a name that is not a custom property". `font-family` resolves on `:root`, so without the guard the mistake returns a plausible answer |
| Route answers a non-2xx status | Throws naming the route and the status, rather than photographing an error page | **Observed 2026-08-24.** Same file, "refuses to photograph a route that does not answer 2xx", against `/a-route-that-does-not-exist` |
| A navigation produces no response at all | Throws naming the route, because an unchecked status is how an error page becomes a baseline | **Decision.** `tests/e2e/harness.ts`. This is the same-document-navigation case; no route in the Hub reaches it today |
| A mask selector matches nothing | Throws naming the selector, rather than masking nothing and comparing an animated region | **Observed 2026-08-24.** Same file, "refuses a mask selector that matches nothing". This is what a renamed `.work-hero__canvas-wrap` would otherwise do: unmask the WebGL torus and make the gate intermittently red for no stated reason |
| A stray or extra baseline appears on disk | The run fails, because one test asserts the snapshot directory holds exactly the one committed PNG | **Observed 2026-08-24.** Same file, "keeps exactly one committed baseline" |
| An element renders a tick after the read is asked for | `computedStyleValue` waits up to 5 s for the selector to attach before deciding it is absent | **Decision.** `tests/e2e/harness.ts`. A bare `count()` answers immediately and would report "not there" when the truth was "not yet" |
| The run matched no tests | Playwright exits non-zero by default and no `--pass-with-no-tests` flag is passed anywhere | **Observed 2026-08-24**, by reading `playwright test --help` in the pinned image |
| The run matched some but not all capability tests | The last test in the file fails, because each capability test records itself and that test asserts all three were recorded | **Decision.** Note that Playwright restarts its worker after any failure, which resets that ledger, so this guard also fails on a run that was already failing. That is redundant noise on a red run, not a hole: the guard can only pass when all three capability tests ran and passed |

## The finding Story 1-18 inherits

**A `font-weight` read at the `--monument-bold` call sites is meaningful only because Story 1.18
sets that weight by hand in the same commit. Read against the tree as it stands, it proves
nothing.** **Observed 2026-08-24**, by reading the four call sites, `app/scss/_fonts.scss:91-99`
and `epics.md:1838-1846`.

`WorkHero.scss:19`, `ProjectsHero.scss:19` and `error-page.scss:24` set the family alone, so
their computed `font-weight` is `400` today and would still be `400` after an alias silently
dropped bold. (`ProjectsHero.scss` left the tree on **2026-09-07**, deleted by Story 2-14 with the
`/projects` route it styled, so two of the three named here survive. The 2026-08-24 reading is left
as it was taken.) The weight lives in the family name, declared by the `@font-face` block. Only
`glitch-text.scss:7` sets `font-weight: 700` itself. (That file left the tree on **2026-09-14**,
deleted by Story 2-27 with the loop it carried; `GlitchText.scss` names `--w-black` directly and is
read by `tests/e2e/display-entrance.pw.ts` rather than as an alias site.)

Story 1.18's own acceptance criteria already close that hole, and the order matters: `epics.md:1842-1843`
requires all four call sites to have `font-weight` **set alongside `font-family` by hand in that
same commit**, and only then does `:1844` assert them bold by reading computed `font-weight`. So
the read is not wrong, it is second. A story that performed the read without the by-hand step
first would get four green assertions that mean nothing.

The practical consequence for Story 1.18: assert **both**. `font-family` catches an alias that
retargets the family, `font-weight` catches a weight that was never set or was set at only three
of the four sites, and neither one alone covers the other. The harness therefore exposes a
generic "computed value of a named property" helper rather than a font-weight helper. Story
1-10's own Probe 2 used a deliberately wrong **family** rather than a wrong weight, because on
today's tree a wrong weight is what the correct code already computes.

Two shapes of the same name come back, and both are asserted so neither surprises a later story.
**Observed 2026-08-24** in the pinned container:

| Read | Value returned | Why |
|---|---|---|
| Computed `font-family` on `.work-hero__heading` | `MonumentExtended-Bold` | Chromium serialises a family name that is a valid identifier sequence without quotes |
| Computed `--monument-bold` on `:root` | `"MonumentExtended-Bold"` | A custom property carries its declared token stream through untouched, and Sass normalises the single quotes at `app/app.scss:29` to double quotes on the way out |

**Closed by Story 1-18 on 2026-08-26, and the two rows above no longer describe this tree.** The
story set `font-weight: var(--w-black)` at all four `--monument-bold` call sites in the same commit
that aliased the family, in that order, so the read is no longer second. Both values above moved
with it: the computed `font-family` on `.work-hero__heading` is now the contract's display stack
and the computed `--monument-bold` on `:root` is now the `var(--f-display)` reference rather than a
quoted family name. `tests/e2e/rendered-output.pw.ts` was amended in that commit to read both
expectations off a probe in the same page rather than to restate either literal, which is why the
capability tests survived a change that falsified the strings they had been asserting. The four
weights are asserted at their own call sites by `tests/e2e/anchor-aliases.pw.ts`, on four different
routes, which is the part this harness said it could not cover. **Observed 2026-08-26**, by reading
the amended file and by running the suite in the pinned container. `ops/anchor-token-adoption.md`
§ "The four hand-set weights, and why a family alias needed them" is the full record.

## The CI job

`.github/workflows/ci.yml` gained one job, `rendered-output`. The existing `test` job was not
modified.

| Property | Value | Nature |
|---|---|---|
| Blocking | Yes. No `continue-on-error`, no `|| true`, no soft-fail, no `--pass-with-no-tests` | **Decision.** AD-21, and `AGENTS.md` under "Policy" |
| Triggers | `push` to `**` and `pull_request` to `main` | **Observed 2026-08-24.** The job sits in the existing file and inherits that file's `on:` block at `:3-7` rather than declaring its own, so the two can never drift |
| Runner | `ubuntu-latest` with `container: mcr.microsoft.com/playwright:v1.62.1-noble` | **Decision** |
| Container options | `--ipc=host` | **Decision.** The default 64 MB `/dev/shm` crashes the Chromium renderer, `retries` is 0 by design, and the documented baseline command carries the same flag, so both sides of the comparison run on one configuration |
| Ceiling | `timeout-minutes: 20` | **Decision.** The job builds the Hub and drives a browser, so it is the slowest thing in the file. A hung browser becomes a failure with a cause rather than a job the platform eventually kills |
| On failure | Uploads `playwright-report/` for 7 days, `if-no-files-found: ignore` | **Decision.** A red screenshot gate is unreadable without its diff image, and an install failure that produces no report should not add a second, unrelated warning on top of the real cause |
| No dependency cache | The job pays a full `pnpm install` every run | **Decision**, recorded rather than fixed. Caching inside a container job is a different mechanism from the `test` job's `setup-node` cache, and adding one that has never been observed working would trade a known cost for an unknown failure mode on a blocking gate |

**Vitest never sees a Playwright spec.** Two independent guards, because one would be a single
point of failure. The specs are named `*.pw.ts`, which Vitest's default include globs
(`**/*.{test,spec}.?(c|m)[jt]s?(x)`) do not match, and `vitest.config.ts` additionally excludes
`tests/e2e/**` while spreading `configDefaults.exclude` back in so the guard cannot itself drop
`node_modules`. **Observed 2026-08-24**, by `pnpm exec vitest list` with and without the exclude:
215 tests collected either way, and no `tests/e2e` file in either listing.

## Pending Operator actions

This file hands the Operator work it cannot do from a development host. They are tracked here
rather than left in prose, in the shape `ops/known-violations.md` and `ops/capacity-measurement.md`
use.

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Record the first real CI timing of the `rendered-output` job**: image pull, install, and the harness step, from the Actions run summary | Operator | The provisioning figures above are a local host's, and say so. The CI figure is the one C-7 actually asks for, and it cannot be observed until this job runs on a runner. Replace the "Pull wall time on this host" row with a CI row when it is, keeping the local row and its method rather than overwriting it | **2026-08-25.** Run `32801557172`, recorded in "The CI figures, measured on a runner" above. The local rows were kept beside them. The same run also confirmed `actions/checkout@v4` and `pnpm/action-setup@v4` behave inside the pinned container |
| 2 | **Confirm the container job's Node version is acceptable**, or pin it | Operator | The `test` job pins Node 22 through `setup-node`. The `rendered-output` job takes the image's Node, observed as v24.18.1, because that is the runtime the pinned browsers were built against. Two Node versions in one workflow is a deliberate consequence of pinning the image, and it is recorded rather than hidden | **2026-08-27. Ruling: pinned to Node 22.** A `setup-node` step was added to the job, so every job in the workflow now runs one Node major. The reasoning against leaving it: two Node majors means a browser check can pass on one runtime and fail on the other, and catching real rendered output is what this job is for, so a runtime difference between it and the `test` job undermines the signal rather than adding coverage. The argument for leaving it, that the browsers were built against the image's Node, applies to the browser binaries and not to the Node that runs Playwright's test process. The image tag still governs the browser and the fonts, so the committed baseline PNG is unaffected |
| 3 | **Run `/bmad-project-context` to refresh the `bmad:context` block in `AGENTS.md`** | Operator | Three lines in that block are false as of this story. `AGENTS.md:52-53` says CI "runs typecheck and tests only"; `:55-57` says "Playwright is not installed" and "until then no acceptance criterion may claim a rendered-output or browser check". A later agent reading that will refuse to write the browser assertions Stories 1.12 and 1.17 through 1.19 now depend on. The block is machine-managed and this story is forbidden from hand-editing it, and `sprint-status.yaml:95-97` already carries the same reminder for other reasons | **2026-08-27**, found done and closed here on 2026-09-23. The refresh landed in `4112ee8` and replaced all three lines: CI was named as its five jobs, and "Playwright is not installed", with "until then no acceptance criterion may claim a rendered-output or browser check", became "Playwright is installed and `rendered-output` is a blocking CI job". The `bmad-project-context` refresh of 2026-08-28, `967abfd`, rewrote the block again (`Verified 2026-08-28 against c490f33`). **Observed 2026-09-23** in `AGENTS.md` at `304767f`: Playwright is in the stack line (`:9`), the rendered-output job and its pinned-image baselines are at `:64-67`, and nothing describes CI as typecheck and tests only or bars a browser check. The board's reminder is annotated the same day |

**Maintaining this file.** When an action is performed, replace its `_not done_` cell with the
ISO 8601 UTC completion date and leave the row in place. When a figure is re-measured, add the
new row with its own date and method and keep the old one, so a later reader can see whether a
number moved or was simply re-stated. Deletion is not used here.

**When the Playwright version moves.** Four things change together and a change to fewer than
all four is a defect: the `@playwright/test` pin in `package.json`, the `container.image` tag in
`.github/workflows/ci.yml`, the committed baseline PNG, and the figures in this file. The pin is
exact (`"1.62.1"`, no caret, unlike every neighbouring range) precisely so that this stays a
deliberate act rather than something a lockfile refresh can do quietly.

## The actions moved off Node 20, 2026-08-31

**Changed 2026-08-31.** The timings above were taken on `actions/checkout@v4` and
`pnpm/action-setup@v4`, and the paragraph recording that both behaved correctly inside the pinned
container was about those versions. The job now runs `checkout@v7`, `action-setup@v6`,
`setup-node@v7` and `upload-artifact@v7`, because all three of the originals target Node.js 20, which
is deprecated. The 1 s figures are left as they were taken rather than restated: they are observed
values with a date, and no re-measurement has been made on the new versions.

**One input was added, and it is what keeps the install timing meaningful.** From `setup-node` v5 the
action caches automatically whenever `package.json` carries a `packageManager` field, and this
repository's carries `pnpm@10.31.0`. This job deliberately omits `cache: pnpm` so that the **6 s**
install above measures a cold one, and that omission would have silently stopped meaning anything.
`package-manager-cache: false` is now written into the job, so the recorded figure still describes
what the job does. Anyone re-measuring the install should check that line is still there first: a
warm cache would move the number without moving anything this file says.
