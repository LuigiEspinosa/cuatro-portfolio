---
title: "Story 2.27: Redesign `GlitchText` token-native"
type: 'feature'
created: '2026-09-13'
status: 'done'
baseline_commit: '9ea3e6c777f12ebe3815124b3da383f33d923143'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** `GlitchText` is the surface a reviewer looks at first and the estate's only infinite
loop: `glitch-loop` drives `text-shadow`, `clip-path` and `transform` every six seconds in two
off-contract hues (`glitch-text.scss:14-70`), the type sets in the retired face's alias at a
hand-written size and a `0.9` line-height under the `0.95` all-caps floor, the entrance scrambles
the characters through a glyph pool so the accessible name is unstable while it runs, and it gates
on `document.fonts.ready` after writing `opacity: 0`, so a font that never loads leaves the page
heading invisible. The name sits on a wrapper `<div>` (Story 2-26's `role='heading'` made it land,
as the interim it was recorded as).

**Approach:** Rebuild it as the display entrance the design specifies: a real heading element
carries the words, split at render time into inline per-character spans that enter on `opacity`
only through one CSS keyframe, staggered by DOM index via a custom property and fitted inside one
`--dur-major`, with the type set from the contract's display roles. GSAP, `SplitText`, the glyph
pool, the loop and the wrapper go, and every ledger row, pin and record that names the old file
moves in the same commit. The CSS weight it sheds is measured, not assumed.

## Boundaries & Constraints

**Always:**

- **Precedence** (`RESTYLE-SPEC.md` § The vocabulary): `DESIGN.md:730-737` wins any value,
  `EXPERIENCE.md:447-469` any behaviour, `RESTYLE-SPEC.md:399-418` geometry. The reference mockup's
  820ms entrance loses to all three (review finding MED-3).
- **The heading's computed style, read through the harness, never off the CSS** (AD-24, FR-37):
  family `--f-display`, weight `--w-black`, `font-stretch: 100%` for `wdth 100` (the
  `SuiteDirectory.scss:46-48` idiom, never `font-variation-settings`), size `--t-display`,
  line-height `--lh-display`, tracking `--tr-display`, uppercase, colour `--token-text`. No `--c-*`
  and no colour, spacing, type or duration literal in the rewritten stylesheet.
- **The entrance:** `opacity` only, one `@keyframes`, `--dur-minor` per character,
  `--ease-entrance`, `animation-fill-mode: both`, `animation-iteration-count` of one,
  `animation-delay` computed from `--delay`, `--i` (DOM index, inline on each span) and `--count`
  (inline on the heading), the whole run from the first character's start to the last character's
  end fitting inside `--dur-major` (420ms, under the ~500ms cap of `EXPERIENCE.md:695`). Under
  `prefers-reduced-motion: reduce` the spans carry `animation: none`: present at full opacity at
  first paint, and nothing else about the component changes.
- **The words are in the served markup**, nothing writes `opacity: 0` from JavaScript, and the
  heading is readable and reaches full opacity with the client bundle blocked.
- **The accessible name is the heading element's own text content**: no `aria-label`, `aria-hidden`,
  `role` or `aria-level` anywhere in the component, at any `tag`.
- **The four things move** for the `shadow-glitch-loop` row (`ops/known-violations.md:523-529`):
  the record row, the `EXEMPTIONS` entry, the "What is in breach" cell, and KV-6's heading and index
  row (fifteen depth tells become eight, `2-27` leaves the Retired by cell;
  `ops/__tests__/hub-accessibility-pass.test.ts:596-620` pins the sums and the closers exactly).
- **Every pin that names the alias site moves**: the `WEIGHT_SITES` row and `WEIGHT_SITE_COUNT`
  (`tests/e2e/anchor-aliases.pw.ts:448-454`; `:612-616` compares the on-disk `--monument-bold` call
  sites against the table), and the stylesheet's path moves from `WEIGHT_CALL_SITES` to
  `TOKEN_NATIVE_STYLESHEETS` in `app/__tests__/anchor-contract.test.ts` (the `error-page.scss`
  precedent at `:300-307`).
- **The `gsap/SplitText` fingerprint leaves `FINGERPRINTS`** (`ops/asset-budget.mjs:82`) and its
  pin (`ops/__tests__/asset-budget.test.ts:793`) in the commit that drops the import, because a mark
  that matches nothing stops the run (`:70-71`), with a dated note in `ops/asset-budget.md` § The
  fingerprints.
- **CSS weight is Observed against Story 2.2's baseline**: `corepack pnpm build && node
  ops/asset-budget.mjs` on `dev` before the change and on the branch after it, plus the gzipped
  bytes of every `.next/static/chunks/*.css` both times, recorded in `ops/asset-budget.md` as a dated
  reading with a Derived delta against the 2026-08-29 figures (`:99-100`, `:401`) and the 2026-09-12
  reading (`:471-502`), in Story 2-20's shape. The `glitch-loop` deletion is a number, never a claim.
- **Every new harness assertion is demonstrated failing against a planted fixture removed in the
  same story** (`epic-2-context.md:75-78`): a planted `animation-iteration-count: infinite`, a
  planted `text-shadow`, a planted `aria-label`.
- **Records:** every value Observed with its method or Decision with its reason, dates ISO 8601,
  story ids hyphenated (`ops/known-violations.md:17-20`). Prose carries no dash-as-punctuation and no
  emoji.

**Ask First:**

- The Operator's screen-reader read of `/` finding the name read letter by letter or with pauses.
  The fallback changes the markup and is a renegotiation, not a fix.
- Any edit to `contracts/`, `.github/workflows/`, `playwright.config.ts`, or to another story's
  Playwright spec beyond the pins, the hydration signal and the prose citations this story moves.
- Widening `tests/e2e/front-door.pw.ts`'s no-shift case to the narrow viewport now that the
  below-768 rewrap it cites (`:974-975`, `:1033-1035`) no longer exists. Filed to Story 2-29 as a
  deferred entry unless the Operator says otherwise.
- Keeping GSAP in the component for any reason, or adding a dependency.

**Never:**

- No restyle of `HomeLayout.scss`, no re-sequencing of `HomeLayout.tsx:52-84`'s timeline (Story
  2-29). The `delay` prop and its `1.0` at `HomeLayout.tsx:110` stay, carried as `--delay`.
- No visually hidden copy of the text, no `display: inline-block` on the character spans (a box per
  character is what makes assistive technology read letters), no `aria-*` on any node.
- No JavaScript reader of `prefers-reduced-motion` in the component (`hooks/useReduceMotion.ts:31-49`
  stays the one; this component reads none, and the stylesheet's media query is its whole answer).
- No `text-shadow`, `clip-path`, `transform`, second hue or loop in the rewritten stylesheet, and
  no `glitch-loop`, `rgba(255, 0, 80, …)` or `rgba(0, 255, 255, …)` anywhere under `app/` or
  `components/` after the rewrite.
- No new `ci.yml` job, no `toHaveScreenshot`, no `playwright.config.ts` edit, no edit inside
  `AGENTS.md`'s managed block, no `CHANGELOG.md` entry (unmaintained since 2026-03-30).
- No `git` operation on the box, no deploy, no merge to `main`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default render on `/`, `reducedMotion: 'no-preference'` | `<GlitchText text='Luigi Espinosa' delay={1.0} />` | `h1.glitch-text` with `--count: 14` and `--delay: 1s`, fourteen `span.glitch-text__char` with `--i` 0 to 13 in DOM order, text content `Luigi Espinosa`; every span's `animation-name` is the keyframe, duration equals `--dur-minor`, timing function equals `--ease-entrance`, iteration count `1`; delays strictly increase with `--i`; last delay plus duration minus first delay is at most 0.5s; after `--delay` plus `--dur-major` every span computes `opacity: 1` and the heading computes `text-shadow: none`, `clip-path: none`, `transform: none` | A span read below opacity 1 after the window, or any delay out of order, is a numbered finding naming the index and the values |
| Reduced motion | `reducedMotion: 'reduce'` | At the first evaluation every span has `animation-name: none` and `opacity: 1`; every other computed property read in the row above is identical to the no-preference read | Fails naming the property that differs |
| Client bundle blocked | `page.route` aborting `**/_next/static/chunks/*.js` | The heading is in the served markup with its text, and every span reaches `opacity: 1` within the window | The served markup carries the words; nothing depends on hydration |
| Grapheme clusters | `text` of `Ñandú`, `e` followed by U+0301, a regional-indicator flag | One span per grapheme (`Intl.Segmenter`), never per code unit; the heading's text content equals `text` | |
| A one-character heading | `text='A'` | The stagger's divisor floors at one; the single span's delay equals `--delay` | |
| `tag` without a level | `tag='p'`, `tag='span'` | The element is that tag with the same classes and spans; no heading role anywhere | |
| Accessibility tree on `/` | The rendered page | `getByRole('heading', { level: 1, name: 'Luigi Espinosa' })` resolves; `ariaSnapshot` of the heading reads `heading "Luigi Espinosa" [level=1]` with no named `generic`; `tests/e2e/accessibility-floor.pw.ts:1537` still reads exactly `['Luigi Espinosa']` | |
| Built CSS after the deletion | `.next/static/chunks/*.css` | The accessibility-floor tally reads zero `text-shadow` occurrences with zero ledger rows for it; no `glitch-loop`, `rgba(255, 0, 80`, `rgba(0, 255, 255` in any stylesheet under `app/` or `components/` | The tally fails naming an unlisted occurrence |
| Hydration signal in two specs | `settled` in `front-door.pw.ts:311-331` and `visitor-instrumentation.pw.ts:115-130` | Hydration is read off React's own mark on `.home-container` (an own property whose name starts with `__reactFiber$`, which React attaches to every host node it hydrates and the server never writes), not off an inline style this component no longer writes; verified in the running page on all four doors before the edit lands | The poll's message names both halves, as today |

</frozen-after-approval>

## Code Map

**The component**

- `components/molecules/GlitchText/GlitchText.tsx` (99 lines): `'use client'`, `gsap`, `SplitText`
  (`:3-4, :9`), `GLYPH_POOL` (`:11`), `TextTag` (`:15`), `GlitchTextProps` (`:17-21`, keep `text`,
  `tag`, `delay`), `HEADING_LEVEL` (`:32`), the `useGsapContext` callback (`:37-80`: `opacity: 0`
  at `:46`, `fonts.ready` at `:50`, the scramble `:59-78`, `.glitch` at `:74`), the wrapper with
  `aria-label` and `role` (`:85-90`), the `aria-hidden` tag (`:91-93`). All of it goes. The new
  file has no hook, no `'use client'` (nothing client-side happens; `HomeLayout` is the client
  boundary), imports `./GlitchText.scss`, and renders
  `<Tag className='glitch-text' style={{ '--count': n, '--delay': `${delay}s` }}>` over
  `Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (s, i) =>
  <span className='glitch-text__char' style={{ '--i': i }} key={i}>{s.segment}</span>)`.
  `tsconfig.json` `lib: esnext` types `Intl.Segmenter`; the inline custom properties need a
  `CSSProperties` cast (no `--*` index signature in `@types/react`); no CSP exists on the site
  (spec-1-7 `:83`) so inline `style` is safe.
- `components/molecules/GlitchText/glitch-text.scss` (71 lines): deleted, and `GlitchText.scss`
  created beside the component (the PascalCase convention; this is the story that rewrites it).
  `.glitch-text { margin: 0 (the reset at app.scss:88-91 already zeroes it, state it anyway);
  font-family: var(--f-display); font-weight: var(--w-black); font-stretch: 100%; font-size:
  var(--t-display); line-height: var(--lh-display); letter-spacing: var(--tr-display);
  text-transform: uppercase; color: var(--token-text); --entrance-stagger: calc((var(--dur-major)
  - var(--dur-minor)) / max(var(--count) - 1, 1)); }`, `.glitch-text__char { animation:
  glitch-text-arrive var(--dur-minor) var(--ease-entrance) both; animation-delay:
  calc(var(--delay, 0s) + var(--i) * var(--entrance-stagger)); }`, `@keyframes
  glitch-text-arrive { from { opacity: 0 } to { opacity: 1 } }`, `@media
  (prefers-reduced-motion: reduce) { .glitch-text__char { animation: none; } }`. A comment beside
  the keyframes names Story 2-34's allowed-pattern disposition for `opacity` keyframes
  (`epics.md:3738`). The roles: `contracts/tokens.css:41` `--f-display`, `:55` `--t-display`,
  `:62` `--w-black`, `:65` `--lh-display`, `:72` `--tr-display`, `:121-122` `--dur-minor`,
  `--dur-major`, `:124` `--ease-entrance`, `:30` `--token-text`; the reduced-motion collapse at
  `:138-142` is why `animation: none` is stated rather than relied on. `contracts/fonts.css:19-20`
  publishes Bricolage at `700 800` and `75% 100%`, so both values match a declared face.
- `components/molecules/GlitchText/__tests__/GlitchText.test.tsx` (97 lines): rewritten. The
  `gsap`, `gsap/SplitText`, `useReduceMotion` and `useGsapContext` mocks (`:4-30`) go; the cases at
  `:38-41`, `:57-60`, `:67-95` invert. New cases: the matrix rows for graphemes, one character,
  `tag='p'`/`'span'`, `--i`/`--count`/`--delay`, `getByRole('heading', { level: 1, name })` with
  `container.querySelectorAll('[aria-label], [aria-hidden], [role], [aria-level]')` empty, and a
  source read of `GlitchText.scss` refusing `glitch-loop`, `text-shadow`, `clip-path`,
  `transform`, `infinite`, `rgba(`. The suite has 890 tests in 34 files today.

**Consumers and helpers**

- `components/organisms/HomeLayout/HomeLayout.tsx:110`: `<GlitchText text='Luigi Espinosa'
  delay={1.0} />` inside `.home-panel--name`, a flex column (`HomeLayout.scss:34-40`), so the
  heading is the flex item the wrapper was; untouched. `__tests__/HomeLayout.test.tsx:70-72` mocks
  the default export as `({ text }) => <div>{text}</div>`; untouched.
- `hooks/useReduceMotion.ts:18` "four consumers" and `:26-27` cite `GlitchText.tsx:24`: three
  consumers, `HomeLayout.tsx:27`, `WorkHero.tsx:23`, `WorkItem.tsx:18`, with a dated clause.
- `hooks/useGsapContext.ts`: loses a consumer, untouched.
- `app/__tests__/anchor-contract.test.ts:252` ("two now"), `:263` the path in `WEIGHT_CALL_SITES`,
  `:284-311` `TOKEN_NATIVE_STYLESHEETS`; claim two (`:872-879`) allows a weight site to name
  exactly `['--w-black']`, claim three (`:885-891`) wants one or more roles from a token-native
  sheet, claim four (`:893-904`) whitelists it. The pre-check at `:854-855` reads the four roles
  off `contracts/tokens.css`.

**Playwright specs**

- `tests/e2e/display-entrance.pw.ts` (new): the first eight matrix rows against `/`, reading
  `--dur-minor`, `--dur-major`, `--ease-entrance`, `--w-black`, `--lh-display` off `:root`
  (`harness.ts:168` `rootCustomPropertyValue`, `:123` `computedStyleValue`) and the type roles
  through a probe element, never typed; the planted-fixture demonstrations recorded in Verification.
- `tests/e2e/front-door.pw.ts:296-331`: the `settled` comment (`:305-309`) and predicate
  (`:316-317`) move to the React mark; `:974-975` and `:1033-1035` (the rewrap the split caused)
  reworded as history, the scope left to Story 2-29. `tests/e2e/visitor-instrumentation.pw.ts:115-130`
  is the same helper by citation; same edit.
- `tests/e2e/type-swap.pw.ts:97-98` "three `--monument-bold` sites" (two); `:114-117` the row
  `{ selector: '.glitch-text__inner', count: 1 }` becomes `.glitch-text` with its comment rewritten
  (the inner element is gone; the count stays one, `:646-647` and the total of seven at `:511` hold).
- `tests/e2e/anchor-aliases.pw.ts:444-446` doc comment, `:448-452` `WEIGHT_SITES` row, `:454`
  `WEIGHT_SITE_COUNT = 3` (two), messages at `:569`, `:614`, `:859`.
- `tests/e2e/accessibility-floor.pw.ts:38-39` header prose; `:244-251` the `EXEMPTIONS` entry
  (two-space indent, `id: '` per row, the parser at `hub-accessibility-pass.test.ts:90-122` depends
  on the shape); `:374` the dead `glitch` class filter in `path()`; `:1525-1526` the A-7 comment.
  The type-floor sweep (`:1012-1053`) now reads every span (no `aria-hidden` subtree): size far above
  `--t-3xs`, family Bricolage, weight 800 inside the published range, so it passes by design.
- `tests/e2e/harness.ts:41` "Three call sites since 2026-09-07" (a dated clause for two);
  `tests/e2e/narrative.pw.ts:843` the `SplitText` clause (history).
- `tests/e2e/rendered-output.pw.ts:21-29`: the one PNG is `/work` at 360x800; the heading renders
  only on `/`, so no baseline regenerates.

**Ops records and their agreement suites**

- `ops/hub-accessibility-pass.md:241-249`: delete the `shadow-glitch-loop` row; `:298` F-8 gets a
  dated "Closed by Story 2-27" clause (findings are annotated, never deleted, `:484-485`); `:36` the
  headline depth tally gets a dated re-reading beside it; `:354` gets a dated sentence (the name now
  sits on a real `<h1>`); § Pending Operator actions gets the screen-reader read of `/` with its
  method. `ops/__tests__/hub-accessibility-pass.test.ts:284-290` (both directions), `:337-350`
  (closer on the board and not `done`), `:356-366` (the cited lines carry the tell), `:596-620`
  (KV-6 sums and closers), `:632-646` (six harness rows, edit prose in place only).
- `ops/known-violations.md:67` index row, `:472` heading ("fifteen depth tells" to "eight"),
  `:479-481` ("`text-shadow` seven times"), `:507` the "What is in breach" cell (reads "Seventeen
  depth tells in five files" against a heading that says fifteen; corrected to eight in four
  files), `:513` the surface line, `:515` Retired by.
- `ops/asset-budget.mjs:59-84` `FINGERPRINTS` (row `:82`); `ops/__tests__/asset-budget.test.ts:780-797`
  the verbatim pin. `ops/asset-budget.md:99-100` the 2026-08-29 totals (20 `.js`, 11 `.css`;
  2,025,358 on disk, 618,713 gzipped), `:190` the `SplitText` chunk (15,078 on disk, 6,162 gzipped,
  `/` only), `:401` stylesheets 3,063 gzipped on the one route the tool prints, `:471-502` the
  2026-09-12 reading and its Derived paragraph (the shape to copy), `:764` the command, `:819` the
  fingerprint row to annotate, `:1022-1025` the maintaining rule (new dated row, keep the old).
- `ops/anchor-token-adoption.md:519-529`: the Story 1-18 table is kept as taken; a dated "since"
  paragraph. `ops/rendered-output-harness.md:47`, `:56` (prose in place), `:58` (`.glitch-text__inner`
  to `.glitch-text`), `:391` history.
- `_bmad-output/implementation-artifacts/deferred-work.md:2667-2685` DW-31 (close, the `:1177-1185`
  shape); `:2533-2576` the Story 2-11 entry (a dated line: the interim wrapper role is gone);
  `:4235-4267` DW-81 (annotate the count, owner 2-22); a new entry for the `front-door.pw.ts`
  scope, Story 2-29.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:201-204`: `backlog` to `review` with a
  comment block in the `:190-200` form naming what waits on the Operator; `done` only after it.

## Tasks & Acceptance

**Execution** (in this order):

- [x] On `dev` before branching: `corepack pnpm build && node ops/asset-budget.mjs` and the gzipped
      size of every `.next/static/chunks/*.css`, saved to the scratchpad as the before reading.
- [x] `components/molecules/GlitchText/GlitchText.scss` (new) and delete `glitch-text.scss`; rewrite
      `GlitchText.tsx` as the Code Map states; rewrite `__tests__/GlitchText.test.tsx`.
- [x] `hooks/useReduceMotion.ts:18, :26-27`: three consumers, dated.
- [x] `app/__tests__/anchor-contract.test.ts`: move the path, the `:252` comment; run the file and
      see claim two fail first with the path left in `WEIGHT_CALL_SITES`.
- [x] `tests/e2e/anchor-aliases.pw.ts`, `tests/e2e/type-swap.pw.ts`, `tests/e2e/harness.ts:41`,
      `tests/e2e/narrative.pw.ts:843`: the pins and prose the Code Map lists.
- [x] `tests/e2e/front-door.pw.ts` and `tests/e2e/visitor-instrumentation.pw.ts`: the hydration
      signal, verified first in the running page on the four doors (`Save-Data`, reduced motion,
      WebGL blocked, default); the two rewrap comments.
- [x] `tests/e2e/accessibility-floor.pw.ts`: the `EXEMPTIONS` row, the `glitch` filter, the two
      comments.
- [x] `tests/e2e/display-entrance.pw.ts` (new): the matrix; each assertion seen failing against its
      planted fixture, the fixture removed.
- [x] `ops/asset-budget.mjs` and `ops/__tests__/asset-budget.test.ts`: the `gsap/SplitText` row.
- [x] `ops/hub-accessibility-pass.md`, `ops/known-violations.md`: the four things, the annotations,
      the pending Operator action; `corepack pnpm test --run ops/__tests__/hub-accessibility-pass.test.ts`
      green.
- [x] Branch build: `corepack pnpm build && node ops/asset-budget.mjs` and the `.css` sizes again;
      `ops/asset-budget.md`: the dated reading, the Derived delta, the fingerprint note.
- [x] `ops/anchor-token-adoption.md`, `ops/rendered-output-harness.md`: the dated prose.
- [x] Container run: the `docker run --rm --ipc=host ... mcr.microsoft.com/playwright:v1.62.1-noble`
      block of `ops/status-mark-axes.md:65-73` with `display-entrance`, then with no filter.
- [x] `deferred-work.md`: close DW-31; annotate the 2-11 entry and DW-81; file the 2-29 entry.
- [x] `corepack pnpm test --run`, `corepack pnpm typecheck`; commit on a branch off `dev` (no push
      and no remote operation from the implementation step; the push and the PR to `dev` follow the
      review); `sprint-status.yaml:204` to `review` with a comment block naming the screen-reader
      read, and the stale `:201-203` block corrected (the block was lifted on 2026-08-15,
      `epics.md:4966`).

**Acceptance Criteria:**

- Given `/` in the pinned image with no motion preference, when `display-entrance` runs, then the
  heading is an `<h1>` whose computed family, weight, stretch, size, line-height, tracking, case and
  colour equal the display roles read off the page; every character span enters on `opacity` alone
  inside `--dur-major` after `--delay`, in DOM order, once; and with `animation-iteration-count:
  infinite` planted on the span the case fails naming it.
- Given the same page with reduced motion, when the first evaluation runs, then every span computes
  `animation-name: none` at `opacity: 1` and no other read differs from the no-preference read.
- Given the client bundle aborted, when the page is read after the window, then the heading's text
  is present and every span computes `opacity: 1`.
- Given the accessibility tree of `/`, when it is read, then one level-1 heading named
  `Luigi Espinosa` exists with no named generic, and with an `aria-label` planted on the heading the
  case fails; and the Operator's screen-reader read is recorded in `ops/hub-accessibility-pass.md`
  before the board reads `done`.
- Given the built CSS, when the accessibility-floor tally runs, then `text-shadow` has zero
  occurrences and zero rows, KV-6 reads eight depth tells with `2-27` gone from Retired by, and
  `hub-accessibility-pass.test.ts` passes both directions.
- Given the before and after builds, when `ops/asset-budget.md` is read, then the dated reading
  states the `.css` gzipped bytes before and after, the `SplitText` chunk's absence, and the Derived
  delta against 2026-08-29 and 2026-09-12, each a number with its method.
- Given `corepack pnpm test --run` and `corepack pnpm typecheck`, when they run, then every file
  passes, `anchor-contract` claim two having been seen failing first, and the `asset-budget` pin
  holding nine fingerprints.

## Spec Change Log

## Design Notes

**Why no GSAP.** On the ladder, the platform covers it: a per-character reveal is markup plus one
CSS keyframe, and rendering the spans on the server is what makes "the words are in the DOM before
any split runs" true by construction rather than by a `fonts.ready` guard. There is then no split
that can throw, no measurement to wait for, and no `opacity: 0` written by script. `SplitText` was
this component's only importer, so the 6,162 gzipped bytes of its chunk leave `/` with it.

**Why `--dur-major` is the window.** The design caps the whole entrance at ~500ms and names
durations as tokens; 420ms is the largest one under the cap, so the stagger is
`(--dur-major - --dur-minor) / max(--count - 1, 1)` and the last character finishes exactly one
major duration after the first starts. A missing `--count` invalidates the delay to `0s` and every
character fades together, which is a worse entrance and never an invisible one.

**Why inline spans.** `opacity` animates on inline boxes; only `transform` needs `inline-block`.
Keeping the spans inline keeps one line box, lets the line break at the space as it always did,
and gives assistive technology one text run rather than fourteen boxes. The Operator's
screen-reader read is the check the markup cannot give.

**Why the hydration signal changes.** The old signal was a side effect this story removes by
design. React attaches an own property named `__reactFiber$<key>` to every host node it hydrates
and the server writes none, so its presence on `.home-container` is the fact the two polls were
after; it is a library mark, stated as such in the comment, chosen over adding an effect to the
application whose only reader would be a test.

**What moved that the boundaries did not name.** Two things, both recorded in `deferred-work.md`
rather than fixed here. The clock (DW-100): `HomeLayout.tsx:61-83`'s timeline counts from
hydration, and the heading's `--delay` now counts from first style resolution, so the `1.0` kept
at `HomeLayout.tsx:110` is the same number on a different clock from the `1.3`, `1.6`, `2.0` and
`2.2` beside it, offset by the hydration time; the "no re-sequencing" boundary is met to the
letter and changed in effect, and the re-orchestration is Story 2-29's with the hero. The JS-less
first second: the old component wrote `opacity: 0` from script, so a document that ran none showed
the heading at first paint; the new one holds the spans at `opacity: 0` in CSS through `--delay`
plus the stagger, so a scriptless document is without its heading for the first 1.0 to 1.42
seconds, and `display-entrance.pw.ts` asserts that it arrives, not when. The preload question
reopens with the `fonts.ready` gate gone (DW-99).

**Rollback.** Revert the commit; the loop, the alias site, the fingerprint and the ledger rows
return together, and the records carry no runtime.

## Verification

**Commands:**

- `corepack pnpm test --run`: expected all files pass; `anchor-contract` claim two seen failing first
  with the path left in `WEIGHT_CALL_SITES`; `hub-accessibility-pass` seen failing first with the
  record row deleted and the `EXEMPTIONS` entry still present.
- `corepack pnpm typecheck`: expected exit 0.
- `corepack pnpm exec playwright test display-entrance` on this host: expected green (no screenshot
  in it); each planted fixture (`infinite`, `text-shadow`, `aria-label`) seen failing first.
- The `docker run --rm --ipc=host ... mcr.microsoft.com/playwright:v1.62.1-noble` block of
  `ops/status-mark-axes.md:65-73` with `display-entrance`, then with no filter: expected every spec
  green, `accessibility-floor` included with the row gone.
- `corepack pnpm build && node ops/asset-budget.mjs` before and after: expected the run completes
  (nine fingerprints, each matching), the `SplitText` chunk absent after, and the `.css` gzipped
  total lower after; the figures go into the record.

**Manual checks:**

- The Operator, with a screen reader on `/`: the page heading is announced once as a level-1
  heading reading "Luigi Espinosa", not letter by letter. Result and date go into
  `ops/hub-accessibility-pass.md` § Pending Operator actions; the board moves to `done` after it.

**Results, 2026-09-14** (the implementation step, on the story branch off `dev` at `9ea3e6c`):

- The planted fixtures, each in the source, each seen failing on this host through
  `corepack pnpm exec playwright test display-entrance -g <case>`, each removed before the next:
  `animation-iteration-count: infinite` on `.glitch-text__char` failed "every character enters on
  opacity alone" naming all fourteen spans (`0: animation-iteration-count infinite, expected 1` and
  so on); `text-shadow: 3px 0 red` on `.glitch-text` failed "computes the display roles" with
  `text-shadow computes rgb(255, 0, 0) 3px 0px 0px` and "no trace of the loop" with the built chunk
  named; `aria-label={text}` on the heading failed "a real h1 carrying the words" with the
  attribute quoted (the tree case stayed green on that plant because the planted name equals the
  words, which is why its own in-page control plants a different one and sees it). Each read also
  fires on a permanent in-page control in the spec file.
- `anchor-contract` claim two seen failing first with `GlitchText.scss` left in `WEIGHT_CALL_SITES`:
  "is a --monument-bold call site and may name --w-black and no other contract name: expected
  [ '--dur-major', '--dur-minor', …(7) ] to deeply equal [ '--w-black' ]". The same run named two
  pins the Code Map did not: no stylesheet but `app/app.scss` may declare a custom property, so
  the `--entrance-stagger` the Code Map sketched is written out inside `animation-delay` instead,
  and no scanned source may mention `contracts/`, so the stylesheet's comment names the token
  contract without the path.
- `hub-accessibility-pass` seen failing first with the `EXEMPTIONS` entry deleted and the record
  row still present: `"shadow-glitch-loop" is in ops/hub-accessibility-pass.md and has no entry in
  tests/e2e/accessibility-floor.pw.ts`, plus the citation of the deleted file; 21 passed after the
  four things moved.
- `node ops/asset-budget.mjs` against the branch build with the `gsap/SplitText` row still in
  `FINGERPRINTS` stopped with "no chunk in this build carries the fingerprint for gsap/SplitText";
  nine fingerprints after, each matching. The before reading (`sKfqE5wMhvYJLoYujExp_` on `dev`) was
  reproduced to the byte by a detached-worktree build of `9ea3e6c` (`mJ9UNGASZ8DuD0zGCHIBK`), which
  is where the per-chunk `.js` listing on the before side comes from; the worktree was removed.
- The hydration mark: `__reactFiber$<key>` on `.home-container` read absent at `commit` and at
  `load` and present three seconds later on the default, reduced-motion, `Save-Data` and no-WebGL
  doors against `corepack pnpm start --port 3100` on the branch build, and never present with
  `**/_next/static/chunks/*.js` aborted, before the two `settled` helpers were edited.
- `corepack pnpm exec playwright test display-entrance` on this host: 8 passed. In
  `mcr.microsoft.com/playwright:v1.62.1-noble` with `display-entrance`: 8 passed, 1.2 min. The
  whole suite in the same image: 23 spec files, 253 passed, 5.6 min, `accessibility-floor` green
  with the row gone (its tally printed six `linear-gradient(`, one `radial-gradient(`, one
  `repeating-linear-gradient(` and no `text-shadow`; the type sweep read 331 texts; the level-1
  read on `/` printed `[Luigi Espinosa]`), and no snapshot directory written.
- `corepack pnpm test --run`: 55 files, 1334 tests, all passed, 82 s.
- `corepack pnpm typecheck`: exit 0.
- One departure from the Code Map's unit-test list: `getByRole('heading', { level: 1, name })` on
  the two-word text cannot pass under jsdom, because `dom-accessibility-api` 0.5.16 (what Testing
  Library computes names with) drops a whitespace-only inline span and reads `LuigiEspinosa`. The
  unit test asserts the level-1 role and the text content there, proves the spans feed the name on
  a one-word text, and leaves the two-word name to the browser, where Chromium and Playwright read
  it whole (`display-entrance.pw.ts`, and the aria snapshot `heading "Luigi Espinosa" [level=1]`).

**Results, 2026-09-14** (the orchestrator's own runs on the committed branch, `aeda04f`, before the
review step; nothing above was taken on trust):

- `corepack pnpm test --run`: 55 files, 1334 tests, all passed, 87.29 s. `corepack pnpm typecheck`:
  exit 0.
- `corepack pnpm exec playwright test display-entrance` on this host: 8 passed in 35.3 s. The spec's
  own output: `h1.glitch-text` computes Bricolage Grotesque, `800`, `100%`, `36px`, line-height
  `34.2px`, tracking `-1.8px`, uppercase, `text-shadow` `none`, `clip-path` `none`; fourteen spans
  with delays `1.0000` to `1.2000` in steps of `0.0154`, `0.4200` s from the first start to the last
  end; the aria snapshot `heading "Luigi Espinosa" [level=1]`.
- `front-door`, `visitor-instrumentation`, `type-swap`, `anchor-aliases` and `accessibility-floor`
  on this host: 74 passed, 1 failed. The one is `type-swap.pw.ts:621`, `.error-page__title` on the
  404 moving 23.00 to 24.00 across the font swap, an element this story does not touch: the same
  case fails the same way on `dev` at `9ea3e6c` (run there and back, 5 passed, 1 failed), and
  Story 2-20's container reading has it at 24.00 on both sides, so it is this host's fallback
  metrics and not the branch. The container run is the gate, and CI runs it on the pull request.
- **Review patches applied 2026-09-14**, one commit on top of `aeda04f`: the `Intl.Segmenter`
  guard with a code-point fallback and its unit case; the stylesheet's "one of two" loop sentence
  and `margin: 0` gone; the unit test folded, retitled, its ARIA read a walk over every attribute,
  its escapes explained; `hydrated(page)` in `harness.ts` used by `front-door`,
  `visitor-instrumentation` and `display-entrance`; `display-entrance` reads `--w-black` off
  `:root` with no typed weight, counts the name's graphemes once, drops the `text-shadow` count
  and the `--lh-display` probe, matches the two hues whitespace-tolerant on the built chunks and
  the sources, walks `readdirSync` recursively, and reads the document outline (one `h1`, no level
  skipped: `h1`, `h2`, six `h3` on `/`); the `anchor-aliases` title without its number; the
  `narrative` preload clause said straight; `useReduceMotion.test.ts` at three consumers; the
  harness record's alias row rewritten in place and a row for the new spec; O-13's `GlitchText`
  half closed on `EXPERIENCE.md:1058` and named with O-12 item 1 in the record; DW-99 and DW-100
  filed; Lighthouse re-read with the new markup (`/` 1.00 / 1.00 / 1.00, `/work` 1.00 / 1.00 /
  1.00, `/cv` 0.96 / 1.00 / 1.00, `aria-prohibited-attr` and `heading-order` 1 on every run of
  `/`, `lhci assert` green). Re-run: `corepack pnpm test --run` 55 files, 1334 tests, all passed,
  89 s; `corepack pnpm typecheck` exit 0; `display-entrance front-door visitor-instrumentation
  anchor-aliases accessibility-floor` on this host 77 passed, 2.4 min.
- **Re-verified by the orchestrator on `d1f0461`**: `corepack pnpm test --run` 55 files, 1334
  tests, all passed, 88.31 s; `corepack pnpm typecheck` exit 0; the same five specs on this host
  77 passed, 2.3 min, the outline read printing `h1 "Luigi Espinosa", h2 "The Suite"` and six
  `h3`. Not re-run after the patches: the pinned image (the patch commit changes tests and prose,
  no rendered output; CI runs the image on the pull request).

## Suggested Review Order

**The component, a heading that arrives**

- The entry point: a real heading, one span per grapheme, `--count` and `--delay` inline, nothing ARIA.
  [`GlitchText.tsx:41`](../../components/molecules/GlitchText/GlitchText.tsx#L41)

- The split guarded on `Intl.Segmenter`; the server always has it, an old Firefox falls to code points.
  [`GlitchText.tsx:22`](../../components/molecules/GlitchText/GlitchText.tsx#L22)

- The display roles, `font-stretch: 100%` carrying `wdth 100` the way `SuiteDirectory.scss` does.
  [`GlitchText.scss:7`](../../components/molecules/GlitchText/GlitchText.scss#L7)

- The stagger: `(major - minor) / max(count - 1, 1)`, so the last character ends one `--dur-major` in.
  [`GlitchText.scss:35`](../../components/molecules/GlitchText/GlitchText.scss#L35)

- One two-stop keyframe on `opacity`, Story 2-34's allowed pattern named beside it.
  [`GlitchText.scss:40`](../../components/molecules/GlitchText/GlitchText.scss#L40)

- Reduced motion: `animation: none`, stated because 1ms durations would still wait out `--delay`.
  [`GlitchText.scss:54`](../../components/molecules/GlitchText/GlitchText.scss#L54)

- The one call site, untouched: `delay={1.0}` now rides `--delay` on the CSS clock (DW-100).
  [`HomeLayout.tsx:110`](../../components/organisms/HomeLayout/HomeLayout.tsx#L110)

**The hydration signal the old side effect used to give**

- React's `__reactFiber$` mark on `.home-container`, once, with why a library mark was chosen.
  [`harness.ts:179`](../../tests/e2e/harness.ts#L179)

- The two `settled` polls read it instead of an inline opacity nothing writes any more.
  [`front-door.pw.ts:308`](../../tests/e2e/front-door.pw.ts#L308)
  [`visitor-instrumentation.pw.ts:121`](../../tests/e2e/visitor-instrumentation.pw.ts#L121)

**The rendered assertions**

- The entrance: per-span `animation-*` against `:root`, delays in DOM order, the 0.42s window.
  [`display-entrance.pw.ts:306`](../../tests/e2e/display-entrance.pw.ts#L306)

- The roles computed on the heading against a probe, never typed.
  [`display-entrance.pw.ts:267`](../../tests/e2e/display-entrance.pw.ts#L267)

- Reduced motion: `animation-name: none` at first evaluation, every other read identical.
  [`display-entrance.pw.ts:361`](../../tests/e2e/display-entrance.pw.ts#L361)

- The client bundle aborted: the served words, the mark absent, full opacity after the window.
  [`display-entrance.pw.ts:383`](../../tests/e2e/display-entrance.pw.ts#L383)

- The tree: one level-1 heading named by the text, the outline with no skipped level, a planted label.
  [`display-entrance.pw.ts:435`](../../tests/e2e/display-entrance.pw.ts#L435)

- Planted markup on the shipped stylesheet: one character, fourteen, and a missing `--count`.
  [`display-entrance.pw.ts:401`](../../tests/e2e/display-entrance.pw.ts#L401)

**The ledger and the register, four things moved**

- `shadow-glitch-loop` gone from `EXEMPTIONS`; the tally now refuses any `text-shadow` in the build.
  [`accessibility-floor.pw.ts:196`](../../tests/e2e/accessibility-floor.pw.ts#L196)

- The record's ledger without the row; F-8 annotated closed, never deleted.
  [`hub-accessibility-pass.md:209`](../../ops/hub-accessibility-pass.md#L209)

- KV-6's heading and index row at eight depth tells, `2-27` out of Retired by, the cell's arithmetic fixed.
  [`known-violations.md:472`](../../ops/known-violations.md#L472)
  [`known-violations.md:67`](../../ops/known-violations.md#L67)

- The Operator's pending action: the screen-reader read of `/`, with its method.
  [`hub-accessibility-pass.md:493`](../../ops/hub-accessibility-pass.md#L493)

**The weight, measured**

- The `gsap/SplitText` fingerprint gone: a mark that matches nothing stops the run.
  [`asset-budget.mjs:78`](../../ops/asset-budget.mjs#L78)

- Before and after per chunk: 87 gzipped bytes of CSS, 3,399 of JavaScript, one chunk each side.
  [`asset-budget.md:471`](../../ops/asset-budget.md#L471)

- The fingerprint table kept as the 2026-08-29 reading, the deletion dated beside it.
  [`asset-budget.md:893`](../../ops/asset-budget.md#L893)

**The alias pins that named the old file**

- The stylesheet moves to the token-native list; claim two no longer holds it to `--w-black` alone.
  [`anchor-contract.test.ts:298`](../../app/__tests__/anchor-contract.test.ts#L298)

- `WEIGHT_SITES` at two rows, the on-disk call sites compared against it.
  [`anchor-aliases.pw.ts:451`](../../tests/e2e/anchor-aliases.pw.ts#L451)

- The swap measures `.glitch-text` at count one, the inner element being gone.
  [`type-swap.pw.ts:119`](../../tests/e2e/type-swap.pw.ts#L119)

**Peripherals**

- The unit suite: markup, tree, graphemes, the Segmenter fallback, the source scans.
  [`GlitchText.test.tsx:24`](../../components/molecules/GlitchText/__tests__/GlitchText.test.tsx#L24)

- The hook's consumer count, dated.
  [`useReduceMotion.ts:18`](../../hooks/useReduceMotion.ts#L18)

- O-13's `GlitchText` half closed in the design's own open-items table.
  [`EXPERIENCE.md:1058`](../planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/EXPERIENCE.md#L1058)

- DW-31 closed; DW-98 (front-door widening), DW-99 (preload premise), DW-100 (the clock) filed.
  [`deferred-work.md:2675`](deferred-work.md#L2675)
  [`deferred-work.md:4725`](deferred-work.md#L4725)

- The board at `review`, naming the screen-reader read it waits on.
  [`sprint-status.yaml:214`](sprint-status.yaml#L214)
