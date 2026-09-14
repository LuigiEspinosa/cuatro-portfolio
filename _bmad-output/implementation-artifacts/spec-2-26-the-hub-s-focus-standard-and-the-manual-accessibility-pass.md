---
title: "Story 2.26: The Hub's focus standard and the manual accessibility pass"
type: 'feature'
created: '2026-09-13'
status: 'in-review'
baseline_commit: '3435ec3d6ea977bbfce974173351d238cbca243f'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** The Hub paints its focus ring nine times in eight stylesheets, and three of those
paint `1px solid var(--accent)`, the hover token, so a keyboard user on the home nav, the contact
links, the 404 exits and the timeline triggers cannot tell focus from hover (A-1). Nothing asserts
the ring on every interactive element, DOM-order traversal, the named z-levels, the type floor, the
depth tells or autoplay; the four manual checks `EXPERIENCE.md:777-779` fixes have never been run
against the Hub and recorded; and five deferred entries name this story as their owner.

**Approach:** One global `:focus-visible` rule in `app/app.scss`, `RESTYLE-SPEC.md` § 4 verbatim
on the tokens, replaces the nine (Operator ruling 2026-09-13). A new Playwright spec sweeps every
route the app serves for the ring, the traversal, the z-levels and depth tells in the built CSS,
the type floor and autoplay, held green by one dated exemption ledger that can only shrink and one
register entry, the Story 2-8 mechanism the Operator ruled for again. `ops/hub-accessibility-pass.md`
records the four manual checks, the Operator's two eyeball confirmations, the accent share, the
Lighthouse readings and every finding with its owner. The parked items close: GlitchText's heading
enters the accessibility tree, `/cv` joins the Lighthouse gate once a local reading clears,
`forced-colors` and the canvas prose become recorded Decisions, and the non-home `<main>` is
re-booked to its chrome owner.

## Boundaries & Constraints

**Always:**

- **The 2-8 ruling, restated (`ops/known-violations.md:349`).** The sweep is universal; the known
  breaches are carried in a dated ledger that can only shrink; every row names a `Story n-n` that
  exists on the board and is not `done`; a repaired row left behind fails as stale; a repair moves
  four things (the ledger row in the record, the `EXEMPTIONS` entry, the cell in the register entry,
  the register's index row).
- **Thresholds are read off the contract on the page, never typed.** `--stroke-focus`,
  `--token-focus`, `--focus-offset`, `--t-3xs`, `--t-2xs`, `--t-sm` and the seven `--z-*` names come
  from `:root` or from `contracts/tokens.css`; the spec text carries no bare `11` or `14`, and the
  agreement suite scans for them the way `ops/__tests__/hit-target-floor.test.ts:605-631` scans for
  `44`.
- **Nothing is corrected out of scope (AD-19, AD-20).** A breach owned by a redesign story is a
  ledger row or a recorded finding, never a fix here. This story makes exactly four fixes: the focus
  rule, the footer line's size token (`DESIGN.md:468` names the footer at `--t-2xs`; `--t-3xs` is
  "Labels only, never prose", `:467`), GlitchText's heading role, and the `/cv` Lighthouse URL if
  the local reading clears.
- **Every new assertion is demonstrated failing against a deliberate fixture removed in the same
  story** (`epic-2-context.md:75-78`): a planted `outline: none !important`, a planted `transition`
  on `outline`, a planted positive `tabindex`, fabricated CSS for the built-CSS tally, fabricated
  ledger rows for the agreement suite, a planted text node under the floor.
- **The record's every value is Observed with its method or Decision with its reason**, dates ISO
  8601 UTC, story ids hyphenated (`ops/known-violations.md:17-20`; the dotted-id scan at
  `hit-target-floor.test.ts:801-824` reads the register from KV-4 to the end).
- **The existing e2e job runs it.** No new `ci.yml` job (`contract-purity.test.ts:1024-1027` and
  `registry-schema.test.ts:1718-1721` pin the six names), no `toHaveScreenshot` in the new spec
  (`rendered-output.pw.ts:216-223` pins one PNG), no new dependency, no `playwright.config.ts` edit.
- **The Operator's two confirmations** (greyscale, one keyboard traversal) are `Method / Checked by /
  Checked on / Result` tables reading `_not yet performed_` until done, and the agreement suite
  fails the build if the board reaches `done` while either does (`status-mark-axes.test.ts:337-391`).
- **Counts in the ledger are read off a run in `mcr.microsoft.com/playwright:v1.62.1-noble`**, never
  computed from the census in this spec (`ops/hit-target-floor.md:766-771`).

**Ask First:**

- A breach the container run finds that no board story owns: a ledger row cannot be written
  without a `Story n-n` that exists and is not `done`.
- `/cv` failing any Lighthouse threshold locally: then DW-70 stays open and the URL is not added.
- Any edit to `contracts/`, `.github/workflows/`, `playwright.config.ts`, or to another story's
  Playwright spec beyond the prose citations the deletions shift.
- A skip-link or `<main>` on the four non-home surfaces. Ruled a finding for Story 2-32 during
  planning: `<main>` is four per-page edits, not one shared change, because a layout-level `<main>`
  swallows `<SiteFooter />` on `/` (`app/page.tsx:79-81`, pinned at `page.test.tsx:89`). See Design
  Notes.
- Widening the sweep beyond the listed checks. F-8's accent-fill grep and the colour-literal grep
  are Story 2-34's; F-11 (`color-scheme`, `::selection`) is filed, not swept.

**Never:**

- No restyle, no z-index re-levelling, no gradient removed, no `rem` literal retokenised in
  `WorkItem.scss`, `HomeLayout.scss`, `error-page.scss`, `hud-label.scss`, `WorkHero.scss`,
  `glitch-text.scss`, `navbar.scss`, `celeste.scss` (`anchor-contract.test.ts:878-886` claim four;
  Stories 2-27 to 2-34).
- No `:focus` for the ring, no `!important`, no transition on `outline`, no `outline: none`, no
  selector above `(0,1,0)` for the global rule (the two planted controls at `cv.pw.ts:728` and
  `secondary-surfaces.pw.ts:482` rely on a scoped `!important` beating it).
- No second reader of `prefers-reduced-motion` (`hooks/useReduceMotion.ts:31-49` is the one).
- No edit inside `AGENTS.md`'s managed block; the "22 records" count drifts there and a refresh owns
  it.
- No `EXPERIENCE.md` change beyond one dated amendment at A-14 (`:773`), the Operator's ruling.
- No `git` operation on the box, no deploy, no merge to `main`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Ring on every interactive element, every route | Tab reaches the element (`tabTo`) | `outline-style` solid, width `--stroke-focus`, colour `--token-focus`, offset `--focus-offset`, `matches(':focus-visible')` true, `transition-property` names neither `outline` nor `all` | A miss is a numbered finding naming route, selector, text and the five values; the case fails on a non-empty list |
| Mouse never paints the ring | `page.hover()` on each element; one `mouse.click` per route on a link with navigation prevented by a capture-phase listener, and on a button where one exists | `outline-style` none while hovered; after the click `:focus-visible` false and `outline-style` none | Finding |
| Ring visible on all three grounds | The ring colour against the element's nearest opaque ancestor `background-color` | WCAG ratio at least 3:1 on every element (`status-mark.pw.ts:603-663`); each of `--token-bg`, `--token-bg-raised`, `--token-bg-raised-2` read on at least one element, a control planted and labelled `planted` where no element sits on a ground (`cs-tracker-accessibility-probe.mjs:1062-1095`) | A `background-image` met before a colour is classified by the first opaque colour beneath it and the image is named in the reading; `body#work`'s literal ground is read as what it is |
| Focus and hover are different tokens | `--token-focus`, `--token-accent-hover`, `--token-accent` resolved through `probeComputed` | The three computed colours are pairwise different | Fails naming the pair |
| Traversal in DOM order | Tab from `body` N times, N = visible tabbables (`INTERACTIVE` minus `[tabindex="-1"]`, the 2-8 visibility rule) | The sequence of `activeElement`s equals the DOM-ordered list; the (N+1)th Tab leaves the document or returns to the first; no `[tabindex]` computes above 0; `/celeste` has N = 0 and the first Tab leaves | Finding naming the first stop that diverges |
| Skip control on the animated door | `/` opened with `reducedMotion: 'no-preference'` (`front-door.pw.ts:189-196`, `onPath`) | `.skip-control` is a stop and paints the ring | Finding |
| Built CSS z-index | Every `.next/static/chunks/*.css` (`ops/asset-budget.mjs:970-982`) | Every `z-index:<number>` occurrence is claimed by a ledger row with `check: 'z-index'`, tallied by value; `var(--z-*)` never counted; the seven names come from `contracts/tokens.css:129-135` | Unlisted value, stale row or count mismatch fails naming value, ledger sum and observed count |
| Built CSS shadow and gradient | Same files | Every `box-shadow:`, `text-shadow:`, `linear-gradient(`, `radial-gradient(`, `repeating-linear-gradient(`, `conic-gradient(` occurrence claimed by a row, tallied by function or property | Same |
| Empty build | No `.css` under `.next/static/chunks` | Throws before any tally, never passes vacuously (`asset-budget.mjs:993-998`) | The thrown message names the directory |
| Type floor, rendered | Every visible element with a direct non-whitespace text node, outside `aria-hidden` subtrees, every route | Computed `font-size` at least `--t-3xs`; every `p` at least `--t-2xs` except the four labels `DESIGN.md` places at `--t-3xs` by name, pinned by selector with their `DESIGN.md` line (Operator ruling 2026-09-13, see the Spec Change Log); the pinned prose selectors at least `--t-sm`; `font-style` never `italic`; computed `font-weight` never above the family's published range (`contracts/fonts.css`), families outside the contract skipped and listed | Finding per element; a synthesised weight is a ledger row with `check: 'weight'` tallied by selector across routes |
| Type source | `app/**/*.scss`, `components/**/*.scss` | No `font-size` whose value carries `px` | Fails naming path and line |
| Autoplay | Every route | No `video`, `audio`, `marquee`, `meta[http-equiv="refresh"]`, no `[autoplay]` | Fails naming the element |
| Ledger drift | Record table and `EXEMPTIONS` differ | Agreement suite names the direction and the row; `closedBy` must be on the board and not `done`; `source` must exist on disk | |
| Operator confirmation pending | Board key `2-26-*` is `done` while a `Checked by` cell reads `_not yet performed_` | Agreement suite fails naming the table | |

</frozen-after-approval>

## Code Map

**Governing text**

- `epics.md:3007-3065` the story; `:3021-3029` the ring; `:3031-3040` the four manual checks;
  `:3042-3051` type; `:3053-3061` tells and z-levels ("six": the contract has seven, see below);
  `:3063-3065` autoplay. `:665-676` UX-DR44 and UX-DR45. `ARCHITECTURE-SPINE.md:191-195` AD-19
  (amended: every restyled application measured once by hand and recorded); `:203-207` AD-21.
- `RESTYLE-SPEC.md:322-352` § 4, the rule text at `:327-331` (`outline: var(--stroke-focus) solid
  var(--token-focus); outline-offset: var(--focus-offset); border-radius: var(--r-hair);`), the four
  bullets `:334-341`, the check `:350-352`; `:652-655` F-6, F-7 (`box-shadow` and `gradient`), F-8
  (the 3% share "has no defined denominator" and is not a gate; the fill grep is Story 2-34's),
  `:657` F-11. `EXPERIENCE.md:711-722` § Focus; `:739` DOM order and no positive `tabindex`;
  `:757-775` A-1 to A-16; `:777-779` the four checks. `DESIGN.md:461-476` the scale (`--t-3xs`
  "Labels only, never prose" `:467`; `--t-2xs` "Metadata, tech arrays, footer" `:468`; `--t-sm`
  "Body floor" `:470`); `:483-502` DR45's numbers; `:565-568` and `:1295` say six z-levels while
  `contracts/tokens.css:129-135` declares seven (`--z-base` 1, `--z-raised` 10, `--z-dropdown` 100,
  `--z-sticky` 200, `--z-modal` 400, `--z-toast` 500, `--z-tooltip` 600): derive the set from the
  contract, record the miscount.
- `epic-2-context.md:75-78` every new assertion demonstrated failing against a fixture;
  `:125-129` focus is `:focus-visible` only, painted instantly, on a token distinct from hover.

**The ring today, nine blocks in eight files (all deleted)**

- Standard, verbatim § 4: `SkipLink.scss:74-78` (keep the `:focus` reveal at `:66-72`; comments
  `:14-15`, `:68-69` say the ring is local, reword); `SkipControl.scss:44-48` (comment `:9`);
  `CvIntro.scss:126-132` (comment `:126-127`); `SiteFooter.scss:87-93` (comment `:44`);
  `SuiteDirectory.scss:299-304`.
- Wrong, `1px solid var(--accent)`, the hover token beside it: `HomeLayout.scss:135-138` (hover
  `:131-133`) and `:169-172` (hover `:165-167`); `error-page.scss:81-84` (hover `:76-79`; note the
  unitless `0.2` at `:72` drops the whole `transition`, pre-existing, Story 2-30's, a finding);
  `WorkItem.scss:38-41` (inset `-2px`; hover `:34-36` is an alpha fill, Story 2-31's).
- No block transitions `outline`; no `outline: none` exists outside the two planted controls
  (`cv.pw.ts:728`, `secondary-surfaces.pw.ts:482`); no reset touches `outline` (`app.scss:88-92`).
- **Where the rule goes:** `app/app.scss` after the reset at `:88-92`. **The pin that trips:**
  `app/__tests__/anchor-contract.test.ts:848-852` holds `app.scss`'s references equal to the ten
  `ALIAS_ROLES` (`:188-206`), scanning comments too (`:826-829`; `app.scss:54-56`). Add a pinned
  `FOCUS_ROLES` (`--stroke-focus`, `--token-focus`, `--focus-offset`, `--r-hair`) and assert the
  union. The rule declares no custom property, so `HUB_PROPERTY_COUNT` 15 (`:169`) and the
  no-declaration case (`:706-720`) hold; claim three (`:867-873`) holds because every stylesheet
  losing its block keeps `--tap` and other roles.
- **Citations that shift** (labels and prose, never assertions: `anchor-aliases.pw.ts:110-117` keeps
  only the basename): `HomeLayout.scss:N` moves by 4 for N > 138 and by 8 for N > 172, cited at
  `anchor-aliases.pw.ts:414-431` (`:159`, `:238`, `:239`), `narrative.pw.ts:933` (`:190`),
  `type-swap.pw.ts:86` (`:152`); `WorkItem.scss:N` by 4 for N > 41, cited at `anchor-aliases.pw.ts:395,
  403, 477` (`:126`, `:144`, `:52`) and `ops/known-violations.md:459` (`:64`); `error-page.scss:N` by 4
  for N > 84, cited at `Error404.tsx:27` (`52-85`). Grep each basename for `:\d+` and shift. The
  control prose at `cv.pw.ts:727-733` and `secondary-surfaces.pw.ts:481-487` names the component
  stylesheet as the ring's source; it becomes `app/app.scss`.

**Reading a ring, a traversal and a token on the page**

- `cv.pw.ts:174-180` `tabTo(page, locator, limit)` and the rationale `:169-172` (`locator.focus()`
  never matches `:focus-visible`); `:101-112` `probeComputed`; `:697-733` the at-rest, focused,
  planted-`outline: none !important` triplet with the three probes `:713-720`. Same at
  `secondary-surfaces.pw.ts:148-159, 203-209, 458-487`. `front-door.pw.ts:1258-1275` `focused()`
  (tag, class, href, box of `activeElement`); `:1277-1355` the skip-link is the first tabbable per
  door; `:161-228` the door table and `:259-275` `onPath` (`reducedMotion` per door). The project
  default is `reducedMotion: 'reduce'` (`playwright.config.ts:79`), which hides `.skip-control`.
- `hit-target-floor.pw.ts:166-191` `INTERACTIVE`; `:548-556` the visibility rule (aria-hidden or
  hidden ancestor, no rects, zero area, `visibility: hidden`); `:365-389` `routesOnDisk` (walks
  `app/`, `not-found.tsx` to `NOT_FOUND`, `:69`); `:405-441` `settle` (fonts, then opacity 1 on
  `ENTRANCE_SELECTOR` `:155`); `:139` `NON_HUB_ROUTES`. Copy, do not import: a `.pw.ts` imported by
  another registers its tests twice, and `hit-target-floor.test.ts:641-649` pins `routesOnDisk` in
  that spec's text.
- Contrast in-page: `status-mark.pw.ts:603-663` `luminance`/`ratio` with the opaque guard; the
  ground walk `cs-tracker-accessibility-probe.mjs:535-550` `classifyGround`; the planted-ground
  control `:1062-1095`; `focusAndRead` `:1229-1270` reads the outline quartet, `transitionProperty`
  and `matches(':focus-visible')`. `anchor-aliases.pw.ts:293-336` `rasterise` for an sRGB read of an
  oklch colour.
- Tokens: `harness.ts:168-193` `rootCustomPropertyValue`, `:123-158` `computedStyleValue`,
  `premise.pw.ts:186-197` `typeScale` (a size token resolved to px through a probe),
  `anchor-aliases.pw.ts:488-501` `publishedWeightRange(family)` over `contracts/fonts.css`
  (Bricolage `700 800`, Geist `300 600`, Geist Mono `400`; no italic face anywhere).

**What the sweeps will find on day one** (census by reading; the ledger's counts come from the
container run)

- z-index literals, seven: `HomeLayout.scss:28` `20`, `:39` `5`, `:191` `3` (Story 2-29; `SkipControl.scss:22-24`
  depends on the gem's 3); `ScanlineOverlay.scss:4` `10` (Story 2-28; equals `--z-raised` by value,
  which is why the check reads text, not computed style); `WorkHero.scss:15, 40` `2` twice (Story
  2-33); `error-page.scss:19` `2` (Story 2-30). Tokenised and never counted: `header.scss:53`,
  `SkipLink.scss:39`, `SkipControl.scss:24`.
- Shadows: `text-shadow` seven times inside `@keyframes glitch-loop`, `glitch-text.scss:26-68` (Story
  2-27). No `box-shadow` anywhere.
- Gradients: `linear-gradient` twice each at `app/app.scss:118-121` (`body#work`, booked to Story
  2-33 by ownership of the `/work` surface, the way `HomeLayout.scss:8-14`'s pair is 2-29's),
  `HomeLayout.scss:8-14` (2-29), `error-page.scss:7-11` (2-30); `radial-gradient` `ScanlineOverlay.scss:6`
  and `repeating-linear-gradient` `:12-18` (2-28). The grain `feTurbulence` at `:37` is neither and is
  a recorded finding for 2-28.
- Type: no `px` font-size anywhere (`_print.scss:19` is `12pt`, print only). Under `--t-3xs`: only
  `.work-item__icon` `0.65rem` (`WorkItem.scss:70`), aria-hidden (`WorkItem.tsx:119`), so the
  visibility rule never measures it. `p` under `--t-2xs`: `.site-footer__line` at `--t-3xs`
  (`SiteFooter.scss:31`; fixed here to `--t-2xs`). Prose selectors, all at or above `--t-sm`:
  `.premise__lede`, `.cv-intro__lede`, `.suite-directory__description`, `.work-item__description`,
  `.work-item__highlights li`, `.error-page__sub`. Synthesised bold: `.work-item__initiative`
  `font-weight: 600` on Geist Mono (`WorkItem.scss:88-90`; Story 2-31), a ledger row. Off-contract
  families skipped and recorded: `.navbar a` `sans-serif` (`navbar.scss:38-40`, 2-32), `#celeste h1`
  `system-ui` (`celeste.scss:13`, 2-34). Recorded, not swept: `.glitch-text__inner` line-height 0.9
  (2-27), `.work-item__description` 1.7 (2-31), the alpha hover fill `WorkItem.scss:35` (2-31).
- Autoplay: nothing. Loops are motion only and stop under reduced motion (`glitch-text.scss:15-19`,
  `ScanlineOverlay.scss:39-43`, `HomeLayout.tsx:55-59`); the `/work` torus loop keeps ticking but is
  scroll-driven (`Torus.tsx:16-19`, `CanvasOrbitControls.tsx:7`); state that, never claim it stops.
- Tabbables per route under reduced motion: `/` 18 (skip-link, 2 nav, 3 contact, directory links,
  footer); `/work` 7; `/cv` 9; 404 5; `/celeste` 0 (`ops/hit-target-floor.md:96-124`). No `tabindex`
  other than `-1` (`app/page.tsx:68`, `SuiteDirectory.tsx:162`, `Scene.tsx:50`).
- Grounds: today's interactive elements sit on `--token-bg` and on `body#work`'s literal `#0a000f`
  (`app.scss:116-122`); `--token-bg-raised` and `-2` are planted.

**The 2-8 mechanism to copy**

- Spec side: `hit-target-floor.pw.ts:218-226` `Exemption`, `:243-282` `EXEMPTIONS` (two-space
  indent, `  },` closers, `id: '` per row, the reflow guard at `hit-target-floor.test.ts:176-188`
  depends on that shape); `:667-743` `judge` and `:768-808` `ledgerDrift` as pure predicates driven
  by planted cases; `:846-916` well-formedness (unique ids, `closedBy` matches `/^Story \d+-\d+$/`).
  Its `SOURCE_SHAPE` (`:200`) admits `.tsx` only; the new ledger admits `\.(tsx|scss):\d+(-\d+)?(,\d+)*`.
- Record side: `ops/hit-target-floor.md:236-258` the ledger table and its header row; `:757-778`
  § Maintaining; `:438-523` the probe demonstration; `:672-698` § Failing loudly.
- Agreement suite: `ops/__tests__/hit-target-floor.test.ts` whole, especially `:55-61` CRLF read,
  `:117, 139` `section`/`table` from `ops/contract-adoption.mjs:76-139`, `:169-188` the literal
  parser, `:261-300` both directions, `:535-579` board and not-`done`, `:581-593` source on disk,
  `:605-631` the bare-number scan, `:724-747` harness-record placement, `:749-799` KV pins.
- Register: `ops/known-violations.md:24-36` admission, `:47-53` numbering and status words,
  `:60-66` index (header `| Id | Violation | Rule breached | Status | Opened | Retired by | Retired on |`),
  `:321-354` KV-4's fields and the count-in-heading idiom, `:389-409` the four-things-move rule,
  `:469-471` where KV-6 goes (after KV-5's `---`, before `## Pending Operator actions`), closed by its
  own `---` (`entryOf` slices to `\n---`). `hit-target-floor.test.ts:749-799` pins KV-4 and KV-5 rows
  only; KV-6 needs no edit there.
- Harness record: `ops/rendered-output-harness.md` `## What the harness asserts` and `## What it
  deliberately does not assert` (rows must sit between, `hit-target-floor.test.ts:724-747`); `:83`
  "Colour contrast ratios" and `:89` are the rows to supersede in place (the 2-8 precedent at `:44`).

**Built CSS**

- Next 16 writes `.next/static/chunks/*.css` (fourteen hashed files today), never
  `.next/static/css/`. `ops/asset-budget.mjs:970-982` `listFiles` reads them as text and `:993-998`
  refuses an empty build; `narrative.pw.ts:315` already imports from that module inside a spec.
  Minified text keeps `z-index:20` and `var(--z-sticky)` distinguishable by `/z-index:\s*-?\d/`.

**The parked items**

- GlitchText: `GlitchText.tsx:71-77` `<div className='glitch-text' aria-label={text}>` wrapping
  `<Tag className='glitch-text__inner' aria-hidden='true'>`; `Tag` defaults to `h1` (`:23`). The fix
  the entry itself names (`deferred-work.md:2545-2547`): `role='heading'` with `aria-level` derived
  from `Tag` (`h1` 1, `h2` 2; `p` and `span` get neither) on the wrapper, label and `aria-hidden`
  untouched. `GlitchText.test.tsx:38-60` pins label, `h1.glitch-text__inner` and `aria-hidden`, all
  kept; add the role and level cases. `front-door.pw.ts:316-317` and `visitor-instrumentation.pw.ts:124`
  read `.glitch-text__inner`'s inline opacity, so that element stays the `gsap.set` target.
- Lighthouse: `.lighthouserc.js:21` `url: ['http://localhost:3000', 'http://localhost:3000/work']`,
  `:27` accessibility 0.95, comment `:9-20` explains `/cv`'s absence; `lighthouse.yml:39` runs
  `npx @lhci/cli autorun` unpinned on push and PR to `main` only. `hit-target-floor.test.ts:651-658`
  pins the 0.95 line and `:660-722` holds the URL array against `next.config.js` redirects (`/cv` is a
  page, not a redirect). Local: `corepack pnpm build`, `corepack pnpm start` (port 3000), then
  `npx @lhci/cli autorun` with `/cv` in the array; whether `--collect.url` replaces the array is
  unverified, so edit the array for the reading and keep the edit only if it clears.
- `forced-colors`: `ops/status-mark-axes.md:234` Owner cell names Story 2-26; `:237` books "Focus,
  keyboard reachability, and the manual accessibility pass" to it. No test pins either cell.
- Canvas prose: `EXPERIENCE.md:773` A-14's third clause; `epics.md:2591` restates it;
  `front-door.pw.ts:1445+` asserts the two met clauses; `ScanlineOverlay.tsx:8` is the decorative
  precedent. DW-52 `deferred-work.md:3199-3222`.
- Non-home `<main>`: `app/layout.tsx:42-45` renders `<Header />{children}`; `/` owns
  `<SkipLink />` and `<main id='main' tabIndex={-1}>` (`page.tsx:64-68`) with `<SiteFooter />`
  outside on purpose (`:79-81`, `page.test.tsx:89`); `/cv` owns a `<main>` with no id (`cv/page.tsx:46`)
  whose comment `:41-45` books the others to Story 2-32; `/work`, `/celeste` and the 404 have none.
  A skip-link on `/celeste` also trips `secondary-surfaces.pw.ts:546-552` and moves four `SURFACES`
  rows (`hit-target-floor.pw.ts:118-124`). DW-43 `deferred-work.md:2930-2959` says "Story 2-26's
  work" at `:2952-2953`: corrected with a dated paragraph, stays open, owner 2-32.

**Records and the board**

- `ops/cs-tracker-accessibility-pass.md:1-24` header idiom, `:42-56` headline table, `:826-841`
  § Stated limits, `:843-855` § Pending Operator actions: the sibling shape. `ops/status-mark-axes.md:58-77`
  the one-spec re-run block; `:239-252` the Operator confirmation table.
- `deferred-work.md`: closing idiom `:1849-1857`, `:2407-2414` (a dated `Closed 2026-09-13 by Story
  2-26` paragraph appended to `evidence`, then `status: done`); entries to touch: 2-10 forced-colors
  `:2439-2455` (no id), 2-11 GlitchText and the `/work` 0.94 reading `:2527-2560` (no id), DW-43
  `:2930-2959` (correct, keep open), DW-52 `:3199-3222`, DW-70 `:3848-3876`; next id DW-95 after
  `:4569`.
- `sprint-status.yaml:190` the key; `:180-189` the comment idiom at review and at done; the
  vocabulary `:8-16` (`review`: "waiting on a human to read it").
- `ops/hub-accessibility-probe.mjs` follows `cs-tracker-accessibility-probe.mjs:734-754` (`chromium`
  through `createRequire` from `@playwright/test`); `sharp` is a root dependency (`package.json:34`)
  and decodes `page.screenshot()` with `.raw().toBuffer({ resolveWithObject: true })`; token sRGB
  values are read on the page (`ops/cs-tracker-accessibility-pass.md:596-599` records
  `--token-focus` `rgb(198, 189, 255)`, `--token-accent` `rgb(143, 126, 240)`).

**Pins a new file trips:** none (`playwright.config.ts:33-34` picks up `tests/e2e/**/*.pw.ts`;
nothing enumerates `ops/*.md`).

## Tasks & Acceptance

**Execution** (in this order):

- [x] `app/app.scss` after `:88-92`: the § 4 rule verbatim on the tokens, with a comment that names
      no role beyond the four and cites `RESTYLE-SPEC.md:326-341`; `app/__tests__/anchor-contract.test.ts:848-852`:
      `FOCUS_ROLES` pinned beside `ALIAS_ROLES`, the union asserted, seen failing with the rule present
      and the pin absent.
- [x] Delete the nine blocks in the eight stylesheets the Code Map lists; reword the five comments
      that called the ring local; shift every citation the Code Map names; update the control prose
      in `cv.pw.ts` and `secondary-surfaces.pw.ts`.
- [x] `components/organisms/SiteFooter/SiteFooter.scss:31`: `--t-2xs`; header comment `:6-8`
      cites `DESIGN.md:468`.
- [x] `components/molecules/GlitchText/GlitchText.tsx:72`: `role='heading'` and `aria-level` from
      `Tag`; `__tests__/GlitchText.test.tsx`: the role and level for `h1`, `h2`, and their absence for
      `p`.
- [x] `tests/e2e/accessibility-floor.pw.ts` (new): `routesOnDisk`, `INTERACTIVE`, the visibility
      rule, `settle`, `tabTo`, `probeComputed`, `focused`, the in-page contrast and ground walk; the
      five sweeps of the matrix; `Exemption` `{ id, check, match, count, source, closedBy }` and
      `EXEMPTIONS` in the 2-8 literal shape; pure `tally(css, ledger)` and `typeVerdict` driven by
      fabricated inputs; the planted controls; the animated-door case for `.skip-control`; the
      thresholds read off the page.
- [x] `ops/hub-accessibility-pass.md` (new): header, headline table, environment, § The four manual
      checks (each with method, result, date; the two Operator tables at `_not yet performed_`),
      § The focus standard (the rule, the three grounds' contrast readings, the planted grounds
      labelled), § The exemption ledger (table `| Id | Check | Match | Count | Source | Closed by |`),
      § The findings (numbered, each with owner), § The accent share (Observed, method, both viewports,
      not a gate per F-8), § Lighthouse readings (`/`, `/work`, `/cv`, the versions), § Decisions
      (`forced-colors` no claim; the canvas needs no prose; the footer's token; the built-CSS
      instrument; the non-home `<main>` re-booked), § Failing loudly, § How to re-run, § Stated limits,
      § Pending Operator actions.
- [x] `ops/__tests__/hub-accessibility-pass.test.ts` (new): both-direction agreement between the
      record's ledger and `EXEMPTIONS`; `closedBy` on the board and not `done`; `source` on disk; no
      bare `11` or `14` in the spec; the two confirmation tables' all-or-none `_not yet performed_`
      and the board not `done` while pending; KV-6 index row and entry name the same closers; the
      dotted-id scan over the record; the harness-record placement; four planted-direction cases on
      fabricated tables.
- [x] `ops/hub-accessibility-probe.mjs` (new) and `ops/__tests__/hub-accessibility-probe.test.ts`:
      against a running server, at 360x800 and 1280x800, write the desaturated renders of `/`
      (`html { filter: grayscale(1) }`) to a directory argument and print the accent share of the
      viewport screenshot (pixels within a stated RGB distance of `--token-accent`,
      `--token-accent-hover`, `--token-accent-muted` read off the page) as a transcript; pure
      `accentShare` and the argument parsing unit-tested.
- [x] `ops/known-violations.md`: KV-6 entry (count in the heading, the KV-4 fields, `Ruled by` the
      Operator on 2026-09-13 at this story's planning, `Where it is tracked mechanically`, § Maintaining
      the ledger this entry counts) and its index row.
- [x] `ops/rendered-output-harness.md`: rows for the five assertions under `## What the harness
      asserts`; supersede `:83` in place.
- [x] `ops/status-mark-axes.md:234, 237`: point both cells at the record's Decision and the spec.
- [x] `EXPERIENCE.md:773`: the dated amendment (Operator ruling 2026-09-13, Story 2-26: decorative,
      no prose; the third clause withdrawn).
- [x] Local Lighthouse: `corepack pnpm build`, `corepack pnpm start`, `npx @lhci/cli@0.15.1 collect`
      then `npx @lhci/cli@0.15.1 assert` (never `autorun`: `upload.target` is public storage) with
      `/cv` in the array; record all three readings and the versions; keep `/cv` in
      `.lighthouserc.js:21` only if it clears, and rewrite the comment `:9-20`.
- [x] Container run: the re-run block of `ops/status-mark-axes.md:65-73` narrowed to
      `accessibility-floor`; read every ledger count and every finding off its output; then the
      full `pnpm exec playwright test` in the same image.
- [x] `deferred-work.md`: close the 2-10 and 2-11 entries, DW-52 and (if the URL landed) DW-70;
      correct DW-43; file DW-95 (F-11 unmet on the Hub, unassigned) and anything the run found
      unowned after asking.
- [x] `corepack pnpm test --run`, `corepack pnpm typecheck`, commit on a branch off `dev`, push,
      PR to `dev`; `sprint-status.yaml:190` to `review` with the comment naming what waits on the
      Operator (the two confirmations).

**Acceptance Criteria:**

- Given the global rule and the nine deletions, when `accessibility-floor` runs in the pinned
  image, then every interactive element on every route on disk paints `--stroke-focus` solid
  `--token-focus` at `--focus-offset` under Tab with `:focus-visible` true and no transition on
  `outline`, paints nothing under hover or click, and contrasts at least 3:1 against its ground;
  and the three token grounds are each read at least once, planted ones labelled; and with
  `:focus-visible { outline: none !important }` planted the same case names every element.
- Given each route, when Tab is pressed from `body`, then the stops equal the DOM-ordered visible
  tabbables, the next Tab leaves the document, no `tabindex` computes above 0; and with
  `<a href="#" tabindex="1">` planted the case fails naming it; and on the animated door
  `.skip-control` is a stop that paints the ring.
- Given the built CSS, when the tally runs, then every `z-index:<number>`, `box-shadow`,
  `text-shadow` and `*-gradient(` occurrence is claimed by a ledger row and every row is claimed
  back, the seven `--z-*` names come from the contract, an empty build throws; and on fabricated
  CSS the pure tally reports unlisted, stale and miscounted rows by name.
- Given each route, when the type sweep runs, then no visible text outside an aria-hidden subtree
  computes under `--t-3xs`, no `p` under `--t-2xs`, no pinned prose selector under `--t-sm`, nothing
  italic, and the only weight above its family's published range is the ledger's
  `.work-item__initiative`; no stylesheet under `app/` or `components/` sets `font-size` in `px`;
  and a planted text node under the floor is named.
- Given the record and the spec, when `corepack pnpm test --run` runs, then the ledger table and
  `EXEMPTIONS` agree both ways, every `Closed by` is a board story that is not `done`, every
  `Source` exists, the KV-6 row and entry name the same closers, and the build fails if
  `2-26-*` reads `done` while either Operator table reads `_not yet performed_`.
- Given `/`, when Lighthouse runs locally, then `aria-prohibited-attr` no longer fails and the
  home route has a level-1 heading in the accessibility tree; and given `/cv` clearing 0.95 / 0.9
  / 0.9 locally, when the URL is added, then the `.lighthouserc.js` pins in `hit-target-floor.test.ts`
  still pass.
- Given the record, when the Operator reads it, then each of the four manual checks has a method,
  a result and a date, the accent share is stated with its denominator at both viewports, every
  finding names its owner, and the two confirmation tables await the Operator's eyeball checks.

## Spec Change Log

- **2026-09-13, build.** The matrix's paragraph floor, "every `p` at least `--t-2xs`", was written
  on a census that saw one `<p>` under `--t-2xs`, the footer line. The run met four more on `/`,
  `.suite-directory__count`, `.suite-directory__tech`, `.suite-directory__status` and
  `.suite-directory__family-name`, every one a label `DESIGN.md` places at `--t-3xs` by name
  (`:490`, `:660`, `:637`, `:667`) and marked up as `<p>` by Story 2-9. None is a breach of the
  design, none has a board story that is not `done` to carry a ledger row, and retagging them is a
  fix outside the four this story is allowed. The sweep therefore excepts those four `<p>` by name
  (`LABEL_PARAGRAPHS`), each with its `DESIGN.md` line and each asserted to match on some route, on
  the same reasoning the matrix already uses for prose: not derivable from markup, so `DESIGN.md`'s
  classification. This narrows the frozen wording and is recorded as a Decision in
  `ops/hub-accessibility-pass.md`, filed with the one place `DESIGN.md` disagrees with itself
  about the tech array (DW-96, F-14), and flagged in the completion report for the Operator to
  renegotiate or confirm. **Confirmed by the Operator on 2026-09-13**, option 1 of the two put to
  them (the exception, not a retag of the four `<p>`), after the PR had merged; the frozen row now
  carries the exception in its own words.
- **2026-09-13, build.** The census predicted eight synthesised weights and the container run read
  two: the timeline carries an initiative line on one entry, rendered on `/work` and `/cv`. The
  ledger carries the run's count, as the boundaries require.
- **2026-09-13, build.** "`transition-property` names neither `outline` nor `all`" is read together
  with `transition-duration`: the initial value of `transition-property` is `all` on every element,
  so the property alone names every stop, and only a duration above zero animates. Same reading as
  `ops/cs-tracker-accessibility-probe.mjs`.
- **2026-09-13, build.** The probe plants the four Status values across the Directory's marks
  before the greyscale render, the dot removed from the three that do not carry one, because only
  `Live` reaches the shipped page and a render showing one value cannot confirm four are tellable
  apart. The accent share is counted before the plant, on the page as shipped.
- **2026-09-13, review.** The Intent's "three of those paint `1px solid var(--accent)`" reads as
  three files, and that is what it counts: four blocks in three files painted the hover token,
  `HomeLayout.scss` twice and `error-page.scss` once at a `4px` offset, `WorkItem.scss` once inset at
  `-2px`. The frozen text is left as written; `app/app.scss`'s comment and the record's § The focus
  standard say four blocks in three files.
- **2026-09-13, review.** The review pass added what the first run could not see: the sweep now
  reads whether an ancestor's `clip-path` or `overflow` box, or the document's edge, sits within the
  ring's reach of every Tab stop, and six stops on `/` paint a fragment (a fifth ledger kind, `clip`,
  five rows to Story 2-29 and one to Story 2-32 by ownership, flagged for the Operator); reads the
  two skip targets after Enter; counts the accessibility tree's level-1 headings per route, which
  found the 404 with none (a `heading` row, Story 2-30's); and reads generated `::before` and
  `::after` text. The Lighthouse table is held to `.lighthouserc.js`'s `collect.url`, every ledger
  row's cited lines to carrying its tell, and KV-6's heading and index row to the ledger's sums.
- **2026-09-13, build.** Lighthouse was run as `lhci collect` then `lhci assert`, not `autorun`,
  because `.lighthouserc.js` uploads to public temporary storage and a local reading has no
  business there.

## Design Notes

**Why the built CSS, not computed style, for z-index and depth.** `ScanlineOverlay.scss:4` is the
literal `10`, equal to `--z-raised` by value, so a computed read passes it; the text of what ships
does not. `ops/asset-budget.mjs` already reads the same files for the same reason, and the seven
names come from the contract so the docs' "six" is never typed.

**Why one ledger with a `check` column.** The Operator asked for one ledger and one entry; rows of
three kinds fit one table when the row carries its kind and a `match` whose meaning the record
states per kind (a z value, a property or function name, a selector). The sweep tallies
occurrences per `match` and holds the sum of the rows' `count`s equal to it in both directions, so
a repaired site with its row left behind fails as stale, and no row can be vacuous.

**Why the footer line moves and the family line does not.** `DESIGN.md` wins any value: `:468`
places the footer at `--t-2xs` and `:667-668` places the family framing line at `--t-2xs`. The
shipped footer took the mockup's smallest step, which `DESIGN.md:467` reserves for labels and
`SiteFooter.scss:5-8` itself argues the line is not. One token moves; the family line is already at
its owner's value, and "prose" for the sweep is `DESIGN.md`'s classification (the six selectors),
because prose is not derivable from markup.

**Why the non-home `<main>` is a finding.** The Operator's condition was one change in the shared
layout. `<SkipLink />` is; `<main id='main' tabIndex={-1}>` is not, because a layout-level `<main>`
wraps the footer `/` keeps outside it by design, so it is four per-page edits plus four `SURFACES`
pins and the `/celeste` no-control case. Booked to Story 2-32, where `app/cv/page.tsx:41-45` already
put it.

**Why the accent share is Observed and not gated.** F-8 (`RESTYLE-SPEC.md:654`) says the 3% has no
defined denominator; the story asks for it measured. The probe states one (viewport pixels at
360x800 and 1280x800, scroll top, within a stated RGB distance of the three accent roles) and
records the figure. A gate on it would be a gate on a number the design owner disowned.

**Why a probe script beside the spec.** The two eyeball checks need renders a person looks at, and
the accent count needs a PNG decoded off CI; a check that leaves no re-runnable command cannot be
re-run against a regression (`ops/status-mark-axes.md:243-245`). Skipping a spec in CI would read as
a downgraded gate, which AGENTS.md forbids.

**Rollback.** Revert the commit; the nine component rules return and the sweep leaves with them.
The record and the register entry are documentation and carry no runtime.

## Verification

**Commands:**

- `corepack pnpm test --run`: expected all files pass, the new agreement suite and the probe suite
  among them; the `anchor-contract` claim one seen failing first with the rule present and the pin
  absent.
- `corepack pnpm typecheck`: expected exit 0.
- `corepack pnpm exec playwright test accessibility-floor` on this host: expected green apart from
  what glyph rasterisation moves (nothing here is a screenshot).
- The `docker run --rm --ipc=host ... mcr.microsoft.com/playwright:v1.62.1-noble` block of
  `ops/status-mark-axes.md:65-73` with `accessibility-floor`, then with no filter: expected every
  spec green; the ledger counts and the findings in the record are this run's output.
- `node ops/hub-accessibility-probe.mjs --base-url http://127.0.0.1:3100 --out <dir>`: expected two
  PNGs and a transcript naming the share at both viewports.
- `npx @lhci/cli@0.15.1 collect` then `npx @lhci/cli@0.15.1 assert` against `corepack pnpm start`
  (never `autorun`, whose `upload.target` is public storage): expected `/` with no `aria-prohibited-attr`
  failure, three scores per route recorded.

**Manual checks:**

- The Operator, in their own browser: `/` desaturated (the two PNGs, or `filter: grayscale(1)` on
  `html`), the four Status values still tellable apart with no legend; one keyboard-only traversal
  of `/` with the mouse untouched, every stop ringed, clicking the same stops rings nothing. Each
  result and its date go into the record's two tables; the board moves to `done` after both.
