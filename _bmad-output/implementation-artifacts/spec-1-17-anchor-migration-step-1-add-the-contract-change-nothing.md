---
title: 'Anchor migration step 1, add the contract, change nothing'
type: 'feature'
created: '2026-08-26'
status: 'done'
baseline_commit: 'b984ca7f2ac8c3fe4aa34ece4485fd763ed6356b'
baseline_revision: 'b984ca7f2ac8c3fe4aa34ece4485fd763ed6356b'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/ops/rendered-output-harness.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Three of the Hub's rendering surfaces, /cv, /recommendation and the 404, are visited by no
      test in this repository and captured by no screenshot baseline, and they are the only
      surfaces where the base body background rule paints.
    evidence: |-
      components/atoms/Container/Container.tsx:13-15 sets <body id={route}> from the stripped,
      hyphenated pathname, so /cv and /recommendation produce body#cv and body#recommendation and
      the 404 produces an id derived from whatever path was requested. None of the three matches
      body#work/body#projects (app/app.scss:53-55), body[id=''] (HomeLayout.scss:1-2) or #celeste
      (celeste.scss:1-2), so the base rule body { background: var(--black-color) } is what paints
      there. tests/e2e/rendered-output.pw.ts pins ROUTE = '/work' and every browser assertion in
      this story visits /work only, so nothing renders those three surfaces at all. This is
      pre-existing: Story 1-10 chose one route and one viewport deliberately and
      ops/rendered-output-harness.md states the limit. It is recorded because Story 1-18 redefines
      --black-color as a token reference, which is exactly the value those three surfaces paint,
      so the story most likely to move them is the next one.
    location: >-
      tests/e2e/rendered-output.pw.ts:21
    severity: medium
---

<intent-contract>

## Intent

**Problem:** The token contract is published and served, and the Anchor consumes none of it. The
Anchor's adoption is deliberately two commits (UX-DR8 and UX-DR9), and this is the first: get
`contracts/tokens.css` and `contracts/fonts.css` into the Hub's stylesheet graph while the site
renders exactly as it does today, so that the commit that changes how `cuatro.dev` looks is
separated from the commit that could break how it is built.

**Approach:** Wire the two contract files into `app/scss/_index.scss` with `@use`, consuming
nothing. Prove the wiring landed and the render did not move: the token roles resolve on `:root`
in a real browser, the three contract faces resolve over HTTP from the compiled stylesheet, no
Anchor stylesheet references a contract name, and Story 1-10's committed baseline still matches
byte for byte.

## Boundaries & Constraints

**Always:**
- The Anchor `@use`s `contracts/` **directly**. It is the publisher, not a Satellite, so there is
  no vendored `cuatro-contracts/` folder and no second authored copy anywhere. This is the
  documented resolution of the `DESIGN.md` step 1 wording ("drop the files into `app/scss/`")
  against AD-1 and AD-4, decided in `epics.md:1777-1781`.
- The two contract files are **inlined** into the compiled stylesheet. A load that emits a plain
  CSS `@import` at runtime (which is what an explicit `.css` extension on a Sass load produces) is
  wrong: it would leave the contract fetched by the browser at a URL nothing in this repository
  controls, and would break the relative `url()` resolution below.
- `contracts/fonts.css` carries `url("./fonts/<file>.woff2")` relative to itself. After the wiring,
  each of those three URLs must answer 200 with non-zero bytes from the running Hub. A face that
  404s reads identically to a face that loaded in every computed style, which is the trap
  `tests/e2e/contract-fonts.pw.ts` records against `RESTYLE-SPEC.md:648`.
- Consumed by nothing means asserted, not asserted-by-absence-of-intent: the check reads every
  custom property name `contracts/tokens.css` declares and requires zero references to any of them
  from any `.scss` under `app/` or `components/`, with the wiring lines themselves the only
  mention of `contracts/` in the Anchor's sources.
- Every new assertion carries its own vacuous-pass guard. A name list parsed from
  `contracts/tokens.css` asserts it is non-empty and carries a known member; a file scan asserts it
  read a non-zero number of files and that its own matcher fires on a planted positive control; a
  `git ls-files` read asserts it returned a list containing a file known to be tracked.
- "Visually identical" is Story 1-10's number and its documented limit, not an opinion:
  `maxDiffPixelRatio` 0.001 at 360x800 on `/work`, one viewport of one route, torus masked. The
  comparison runs inside `mcr.microsoft.com/playwright:v1.62.1-noble` because a Windows capture is
  not comparable to the committed Linux baseline (`ops/rendered-output-harness.md`).
- Every value recorded under `ops/` is marked as a decision or an observation, and an observation
  carries the method that gathered it (NFR-9). Dates are ISO 8601 UTC.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash and no
  emoji. The commit is a subject line only, no body and no trailer.

**Block If:**
- The render moves past the tolerance and the only way to bring it back is to edit a component
  stylesheet, `app/app.scss`, or the contract. That would mean adding the contract is not
  appearance-neutral, which contradicts the premise the two-commit split rests on, and choosing
  between weakening the gate and changing the plan is the Operator's call.
- The rendered-output harness cannot be run at all: Docker is unavailable, the pinned image cannot
  be pulled, or the container cannot start a browser. AC2's whole content is that comparison and
  there is nothing to substitute for it.

**Never:**
- Never edit `app/app.scss` or any of the fifteen component stylesheets. Redefining the sixteen
  existing custom properties as token references is Story 1.18, and AD-20 forbids a migration step
  carrying anything else.
- Never edit `contracts/`, `packages/`, `public/`, `.github/`, `docker/`, `package.json` or
  `pnpm-lock.yaml`. The contract is already published, served and gated; this story consumes it.
- Never regenerate the committed baseline PNG. A red screenshot on a story that intends no visual
  change is a finding, not a baseline to refresh (`ops/rendered-output-harness.md`, "When it is
  not").
- Never weaken, skip or soft-fail a CI gate, and never add `continue-on-error` (AD-21).
- Never add a Tailwind import. `contracts/tailwind.css` is for Tailwind consumers; the Anchor is
  SCSS and consumes the plain pair (AD-14).
- Never delete `--accent-glow`, `--confillia-bold` or `--font-bold`, and never retarget
  `--confillia-normal`. Those are Story 1.18 and Story 2.20 acts.

## I/O & Edge-Case Matrix

Every row is a named case one of the two new suites runs and reports by name.

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Roles resolve | The built Hub at `/work` | Every custom property `contracts/tokens.css` declares resolves on `:root` to the value that file declares, all of them, count asserted equal | A missing or empty property throws naming it, through `rootCustomPropertyValue` |
| Name list is real | `contracts/tokens.css` parsed for declared names | The list is non-empty and contains `--token-bg`, `--f-body` and `--tap` | An empty or short list fails the case rather than passing a vacuous loop |
| Faces resolve | The compiled stylesheet the page loads | The three `@font-face` families appear, and each `url()` answers 200 with non-zero bytes | A 404, a non-200, or a zero-length body fails naming the URL. A stylesheet carrying no contract face at all fails separately, as "not wired" rather than "wired and broken" |
| Nothing consumes it | Every `.scss` under `app/` and `components/` | Zero references to any name from the list, from any file | The scan asserts it read at least 19 files (four under `app/`, fifteen under `components/`) and that its matcher fires on a planted control string |
| Old values unmoved | The built Hub at `/work` | `body` computes `background-color: rgb(0, 0, 0)` and `color: rgb(255, 255, 255)`; `--white-color`, `--black-color`, `--accent` and `--monument-bold` hold their pre-change literals | Any drift fails naming the property, its expected value and what it read |
| No authored copy | `git ls-files -- app components public` | No tracked path is named `tokens.css`, `fonts.css` or `tailwind.css`, and no path segment is `cuatro-contracts` | An empty or failed listing fails the case, so a broken git call cannot read as "nothing found" |
| Render unchanged | `pnpm test:e2e` in the pinned container | `rendered-output.pw.ts` passes against the committed baseline; the snapshot directory still holds exactly one PNG, byte-identical | A mismatch is a defect in the wiring and a Block If candidate, never a baseline refresh |

</intent-contract>

## Code Map

Gathered 2026-08-26 against `b984ca7`, working tree clean.

- `app/scss/_index.scss:1-2`: the entire file, `@forward './fonts'` and `@forward './print'`.
  **This is the one file the story edits.** `app/app.scss:1` reaches it as `@use './scss/' as *`,
  and `app/layout.tsx:4` imports `app/app.scss`, so anything loaded here reaches every route.
- `app/app.scss:3-32`: the sixteen `:root` custom properties. **Read-only here, and the whole of
  Story 1.18.** `:40-60` is the `body` and `body#work` rule pair whose computed values are this
  story's did-nothing-change probe: `background: var(--black-color)` and `color:
  var(--white-color)` resolve to pure black and pure white today and must still do so after.
- `app/scss/_fonts.scss:19-121`: **ten** `@font-face` blocks for General Sans, Monument Extended
  and Confillia, with `url('../../public/fonts/…')`. (Corrected on the review pass: this said
  nine, and so did `ops/anchor-token-adoption.md`. The openers are at `:19,29,39,49,59,71,81,91,
  103,113`, five General Sans weights, three Monument Extended weights, `Confillia Normal` and
  `Confillia`.) **Evidence that a relative `url()` inside a Sass
  partial resolves against the partial rather than the entry file** in this Next pipeline: from
  `app/scss/` that path is `<root>/public/fonts/`, and from `app/` it would be above the repository
  root and the build would fail. No family name here collides with a contract family.
- `contracts/tokens.css:8-136`: one `:root` block, `--c-*` palette then `--token-*` roles then
  type, space, shape, motion and layer scales. `:138-145` a `prefers-reduced-motion` block that
  redefines four `--dur-*` values. **The name list the assertions derive from.**
- `contracts/fonts.css:16-64`: three `@font-face` blocks, `"Bricolage Grotesque"`, `"Geist"` and
  `"Geist Mono"`, each `url("./fonts/<file>.woff2")` relative to the contract folder.
- **No custom property name collides.** `grep '--[a-z0-9-]*:' **/*.scss` returns sixteen
  declarations and every one is in `app/app.scss`; no component stylesheet declares a custom
  property at all. The contract's namespaces (`--c-`, `--token-`, `--f-`, `--t-`, `--w-`, `--lh-`,
  `--tr-`, `--s-`, `--r-`, `--stroke-`, `--elev-`, `--dur-`, `--ease-`, `--z-`, `--measure`,
  `--page-pad`, `--tap`, `--focus-offset`) intersect none of them. **Observed 2026-08-26.** This is
  why the wiring can be appearance-neutral by construction rather than by luck.
- `tests/e2e/harness.ts:60-189`: `expectRouteScreenshot`, `computedStyleValue` and
  `rootCustomPropertyValue`. **The new spec imports these rather than reaching for Playwright
  directly**, per `ops/rendered-output-harness.md:23-25`. All three throw rather than return an
  empty string, which is what keeps a `:root` read from passing vacuously.
- `tests/e2e/rendered-output.pw.ts:29,45-46,147-154`: the baseline name is built from
  `RENDERED_VIEWPORT`, a ledger guard asserts all three capabilities ran, and `keeps exactly one
  committed baseline` fails on a stray PNG. **This file is not edited**; it is the AC2 instrument
  and it must stay green untouched.
- `tests/e2e/rendered-output.pw.ts-snapshots/work-360x800-chromium-linux.png`: the committed
  baseline, captured at `4f4c751` before this wiring. **Must be byte-identical at the closing
  commit.**
- `tests/e2e/contract-serving.pw.ts:38-58` and `tests/e2e/contract-fonts.pw.ts:34-47`: **the house
  pattern for a new `.pw.ts` file.** `__dirname` rather than `import.meta.url` (Playwright
  transpiles a spec to CommonJS and the repository declares no `"type": "module"`), `REPO_ROOT`
  resolved from it, contract inputs read off disk rather than restated, and the reason a face check
  is an HTTP status rather than a computed style.
- `playwright.config.ts:19,30,52,84-93`: port 3100, `maxDiffPixelRatio` 0.001, `updateSnapshots:
  'none'`, and `webServer` running `pnpm build && pnpm start`. `pnpm build` begins with
  `packages/contracts-serve/publish.mjs`, so the served tree under test is the deploy's.
- `ops/rendered-output-harness.md:65,130-182`: the inherited limit stated in Story 1-10's own
  words, "Story 1.17's visually identical therefore rests on one viewport of one route", and the
  exact `docker run` command with the two named volumes and `--ipc=host`. **Use that command
  verbatim without `test:e2e:update`.**
- `.github/workflows/ci.yml:179-220`: the blocking `rendered-output` job runs `pnpm test:e2e`
  inside the pinned image, so a new `*.pw.ts` file is gated with no workflow edit. `:10-29` is the
  blocking `test` job that runs `pnpm typecheck` and `pnpm test --run`, which is where the new
  Vitest suite lands.
- `vitest.config.ts:15`: `tests/e2e/**` is excluded and the specs are named `*.pw.ts`, so Vitest
  never sees a Playwright spec. The new unit suite must therefore not live under `tests/e2e/`.
- `packages/contracts-serve/publish.mjs:83-91` and `.gitignore` (final block): `public/contracts/`
  is written by `pnpm build` and is deliberately gitignored. **This is why the no-authored-copy
  check reads `git ls-files` rather than the working tree**: after any build the working tree
  carries `public/contracts/tokens.css`, which is the generated served copy and not an authored
  one.
- `ops/token-contract.md`, `ops/font-contract.md`, `ops/contract-serving.md`: the record shape this
  story's record follows. Decision or observation per value, method with every observation, stated
  limits, Pending Operator actions table.
- Host, observed 2026-08-26: `docker version` server 29.7.2, working tree clean at `b984ca7`,
  branch `dev`. `pnpm` is not on PATH; every command is prefixed `corepack`.

## Tasks & Acceptance

**Execution:**
- `app/scss/_index.scss`: wire the contract in. Load `contracts/tokens.css` then
  `contracts/fonts.css` ahead of the two existing forwards, by a Sass load that **inlines** them.
  **The rule that decides inlining is `@use` against `@import`, not the extension.** Measured
  2026-08-26 against this repository's own Dart Sass 1.98.0 on four one-line fixtures: `@use './t'`
  and `@use './t.css'` both inline and emit identical output, a bare `@import './t'` also inlines,
  and only `@import './t.css'` passes through as a runtime `@import` for the browser to resolve.
  So use `@use`, and keep the extensionless spelling as the house convention rather than as the
  mechanism. Order is tokens then fonts, matching AD-14's file order and `contracts/tailwind.css`,
  and both sit above `@forward './fonts'` because Dart Sass emits module CSS in source order. A
  comment says why the Anchor loads `contracts/` directly rather than vendoring, and that nothing
  consumes it until Story 1.18.
- `tests/e2e/contract-anchor.pw.ts`: new. The browser half, one named test per matrix row it owns.
  Parses `contracts/tokens.css` for every declared custom property name and its declared value, by
  two independent parsers cross-checked against each other, and asserts each resolves on `:root`
  through `rootCustomPropertyValue`, with the count **pinned** at 89 (and 4 under reduced motion)
  rather than bounded, so a removed name fails rather than shortening the loop. Asserts the name
  list carries `--token-bg`, `--f-body` and `--tap`. Because the harness pins
  `reducedMotion: 'reduce'`, opens a second context with `no-preference` so the four base
  `--dur-*` values are measured too, and a second at 600px wide so the two `clamp()` tokens are
  measured where their fluid middle term wins rather than where it is pinned to the minimum.
  Fetches every stylesheet the page links, asserts the token contract is inlined into one of them
  by finding declarations the contract alone makes, asserts no `@import` survives in any of them,
  asserts the three contract families appear, extracts their `url()` values and asserts each
  answers 200 as `font/woff2` with a non-zero body beginning with the `wOF2` signature,
  distinguishing "no contract face in the stylesheet" from "face present and its URL does not
  resolve". Asserts `body` still computes `color: rgb(255, 255, 255)` on `/work`, that `body#work`
  still paints `rgb(10, 0, 15)` over the base rule, that `var(--black-color)` and
  `var(--white-color)` still resolve to pure black and pure white where they are used, and that
  four pre-change custom properties still hold the values `app/app.scss` authors for them. Follows
  the `__dirname` and `REPO_ROOT` pattern of the two existing contract specs, and reads both the
  contract and `app/app.scss` off disk rather than restating any value. The colour route carries
  its own fail-open guard, because a canvas `fillStyle` the context cannot parse is ignored rather
  than rejected and both sides of a pair would otherwise rasterise the same stale pixel and compare
  equal: two sentinel writes prove each assignment took, an unparsed value is reported as such, and
  a fifteenth control rides back from inside the comparator so every call site asserts the guard
  fired on its own call. No contract value may reach either text route, asserted in both
  directions, so a whole scale cannot fall to the string comparison while one surviving value holds
  its route open.
- `app/__tests__/anchor-contract.test.ts`: new. The source half, with no browser and no network.
  Asserts every contract load in `app/scss/_index.scss` is `@use` and never `@import`, which is
  the rule that keeps the contract inlined, and separately that none carries an explicit `.css`
  extension, which is a convention check and says so; asserts both loads resolve inside
  `contracts/`, that tokens precedes fonts, and that both precede `@forward './fonts'`; parses
  `app/app.scss` for all sixteen custom properties the Hub declares, asserts no other stylesheet
  declares one, and asserts the intersection with the contract's 89 is empty with both counts
  pinned; asserts the ten `@font-face` families in `app/scss/_fonts.scss` and the three in
  `contracts/fonts.css` do not intersect, which is the premise the emission-order pin rests on;
  scans every `.scss`, `.ts` and `.tsx` under every shipped source root, `app/`, `components/`,
  `hooks/` and `content/`, excluding
  `__tests__`, for a reference to any name declared in `contracts/tokens.css` and requires zero,
  having asserted it read the expected file count (at least 59, of which at least nineteen are
  stylesheets), that the root list itself covers every top-level directory `git ls-files` reports
  shipped sources under, and that its matcher fires on planted controls in both a stylesheet and a
  `setProperty` shape; and asserts, over a NUL-delimited `git ls-files` with `core.quotePath=false`
  so a C-quoted path cannot evade it, that no tracked path under `app/`, `components/` or
  `public/` is named `tokens.css`, `fonts.css` or `tailwind.css` and that no path segment anywhere
  in the repository is `cuatro-contracts`, having asserted the listing is non-empty and contains
  `app/app.scss`. Every planted control calls the same named predicate the assertion beside it
  calls, so changing the predicate cannot leave its control green.
- `ops/anchor-token-adoption.md`: new. The record of step 1 of the Anchor's two-step adoption: what
  was wired and where, the contract version wired, why the Anchor loads `contracts/` directly, the
  screenshot comparison result with the baseline's sha256 before and after and the command that
  produced it, how many custom properties the contract puts on `:root`, the limits inherited from
  `ops/rendered-output-harness.md` (one viewport, one route, 30 percent of the frame masked), what
  Story 1.18 does next and what Story 1.20 will record here, and Pending Operator actions.

**Acceptance Criteria:**
- Given the Anchor is SCSS and custom properties pass through Sass untouched, when
  `contracts/tokens.css` and `contracts/fonts.css` are wired into `app/scss/_index.scss` and the
  Hub is built and served, then every custom property those files declare is reachable from the
  compiled stylesheet as observed in a real browser, and `git diff b984ca7 -- app/app.scss
  components` is empty, so no existing selector, property or value in any of the fifteen component
  stylesheets changed.
- Given NFR-2 and AD-20 require every step to leave a working system, when `pnpm test:e2e` runs
  inside `mcr.microsoft.com/playwright:v1.62.1-noble`, then the whole run is green, the `/work`
  comparison passes against the baseline captured before the wiring landed, and
  `work-360x800-chromium-linux.png` is byte-identical to its pre-change sha256, so the claim rests
  on the harness rather than on inspection.
- Given the contract must be present and consumed by nothing, when the Anchor's sources are scanned
  and the built Hub is read in the browser, then no `.scss`, `.ts` or `.tsx` under any shipped
  source root, `app/`, `components/`, `hooks/` or `content/`, references any name declared in
  `contracts/tokens.css`, `body` still computes
  `color: rgb(255, 255, 255)` on `/work`, `body#work` still paints `background-color:
  rgb(10, 0, 15)` over the base rule at the higher specificity it always had, and
  `var(--black-color)` and `var(--white-color)` still resolve to `rgb(0, 0, 0)` and
  `rgb(255, 255, 255)` where they are used. **Corrected on the first review pass**: this criterion
  previously required `body` itself to compute `background-color: rgb(0, 0, 0)` on `/work`, which
  is false there and was false before this story. **Corrected again on the second**: it then said
  that was false "on every route in the Hub", which is also wrong. `body#cv` and
  `body#recommendation` match none of the three override rules, so the base rule paints and `body`
  does compute `rgb(0, 0, 0)` on `/cv` and `/recommendation`. Neither route is visited by any
  assertion in this story nor captured by the baseline, so on those two the value is held by the
  `--black-color` probe alone. The scan root list widened on the second pass for the same reason:
  it read `app/` and `components/` while `hooks/` and `content/` shipped unread. See the Spec
  Change Log and `ops/anchor-token-adoption.md` § "A second finding".
- Given the Anchor is the publisher and not a Satellite, when the tracked tree is listed, then no
  file tracked by git under `app/`, `components/` or `public/` is named `tokens.css`, `fonts.css`
  or `tailwind.css`, and no `cuatro-contracts/` directory exists anywhere in this repository, so
  the only authored copy is under `contracts/`.
- Given this is the safe half of a two-commit change, when the diff against `b984ca7` is read, then
  the only file modified is `app/scss/_index.scss`, the only files added are
  `tests/e2e/contract-anchor.pw.ts`, `app/__tests__/anchor-contract.test.ts`,
  `ops/anchor-token-adoption.md` and this spec, and `app/app.scss`, `components/`, `contracts/`,
  `packages/`, `public/`, `docker/`, `.github/`, `package.json`, `pnpm-lock.yaml` and the committed
  baseline PNG are byte-identical, with the appearance change left to Story 1.18.

## Spec Change Log

### 2026-08-26, Implementation pass

Three statements in the I/O matrix turned out not to be true of this codebase. Each is recorded
here with what was implemented instead and where the evidence lives, because each one is a fact a
later story would otherwise rediscover. None of them changes what the story does; all three change
how a check is written.

- **"Roles resolve": "resolves on `:root` to the value that file declares" is not literally
  achievable, because the build rewrites the values.** Next 16.2.1's Turbopack pipeline minifies
  the CSS it emits, and **43 of the 89** declared values arrive at the browser written differently:
  every `oklch()` becomes a `#rrggbb` sRGB fallback plus a `lab()` override behind `@supports
  (color: lab(0% 0 0))`, `0.6875rem` becomes `.6875rem`, `cubic-bezier(0.16, 1, 0.3, 1)` becomes
  `cubic-bezier(.16, 1, .3, 1)`, and `120ms` becomes `.12s`. Every rewrite is semantics-preserving.
  **Implemented instead:** each value is asserted to still *mean* what the contract declares,
  canonicalised through the browser's own parser on both sides (colours rasterised to 8-bit sRGB,
  times through `transition-duration`, easings through `transition-timing-function`, lengths
  through a computed `outline-offset`, stacks through `font-family`, unitless numbers through
  `line-height`), with **fourteen controls: a positive and a negative on each of the six typed
  comparator routes just listed, and one pair on the seventh, the `text (var)` route**. The plain
  `text` fallback carries no control, because no contract value reaches it once `var()` has been
  substituted, and a control for a route nothing uses would be a claim about the comparator rather
  than about this contract. All fourteen run through the same comparator in the same page, and each
  of the six typed routes is separately asserted to have been exercised by at least one real token.
  Note that a **comparator route** is not a **URL route**: every browser assertion in this story
  visits `/work` and only `/work`. The transform table is recorded in
  `ops/anchor-token-adoption.md` § "The finding: the build rewrites the contract's values", along
  with the one consequence that is not cosmetic: a token authored outside sRGB would be clipped by
  the hex fallback, which is Pending Operator action 2.
- **The semantic roles never carry their declared text, by design.** The computed value of a
  custom property is its token stream **after** `var()` substitution, so `--token-bg`, declared
  `var(--c-paper)`, resolves on `:root` to `--c-paper`'s value. A comparison against the authored
  text reported all twelve `--token-*` roles and all three `--elev-*` steps as drifted while the
  contract behaved exactly as designed. **Implemented instead:** `contracts/tokens.css`'s own
  declarations are substituted into the expected value before comparing, with a case asserting the
  substitution ran on at least ten names and that an unresolvable reference is left as itself
  rather than dropped.
- **"Old values unmoved": `body` does not compute `background-color: rgb(0, 0, 0)`, and not on any
  route.** `body { background: var(--black-color) }` (`app/app.scss:41`) is overridden at higher
  specificity everywhere: `body#work, body#projects` (`app/app.scss:53-55`) paints
  `rgb(10, 0, 15)`, `body[id='']` (`components/organisms/HomeLayout/HomeLayout.scss:1-2`) paints
  the same on `/`, and `#celeste` (`components/organisms/Celeste/celeste.scss:1-2`) paints
  `rgb(68, 68, 68)`. This is pre-existing and not caused by this story. **Implemented instead:**
  `body` still computes `color: rgb(255, 255, 255)` on `/work`, `body#work` still paints
  `rgb(10, 0, 15)` over the base rule, and `var(--black-color)` and `var(--white-color)` still
  resolve to pure black and pure white where they are used, read off a probe element. Recorded in
  `ops/anchor-token-adoption.md` § "A second finding".

One further note, which is a clarification rather than a change. **"Faces resolve" is asserted as
status plus bytes plus signature, and deliberately not as `document.fonts.check`.** All three
contract faces report `unloaded` on `/work`, which is correct: an `@font-face` no rule uses is
never downloaded, and that is one of the two reasons the render can be identical by construction.
The browser-side half of the face check is therefore that each family reached `document.fonts` at
all, which proves the rules were parsed on this page rather than merely present in a response body.

### 2026-08-26, Review pass

- patch: 19: (high 0, medium 4, low 15)
- **The Design Notes' "Why the extension matters" was factually wrong** and is corrected in place.
  An explicit `.css` extension makes a load a runtime `@import` only for `@import`, not for `@use`.
  Measured against this repository's own Dart Sass 1.98.0 on four one-line fixtures: `@use './t'`
  and `@use './t.css'` both inline with identical output, a bare `@import './t'` inlines too, and
  only `@import './t.css'` defers to the browser. The claim is corrected in the comment in
  `app/scss/_index.scss`, in both new test files, in `ops/anchor-token-adoption.md` (where the
  four-variant measurement is now recorded as an Observation with its method) and in the Execution
  bullet above. The standing assertion that actually holds the failure mode shut is now that every
  contract load is `@use` and never `@import`; the no-extension assertion is kept as a convention
  check whose message says which of the two it is.
- **AC3 and the `tests/e2e/contract-anchor.pw.ts` Execution bullet were corrected in place** to the
  claim that is actually observable and actually asserted, since both still required `body` to
  compute `background-color: rgb(0, 0, 0)`. The I/O matrix row that says the same thing is inside
  `<intent-contract>` and **stands unchanged**, with its deviation logged in the implementation-pass
  entry above. That is the intended shape: the contract records what was asked for, and the log
  records what was true.
- Sixteen further patches, applied without changing what the story does: the collision check now
  covers all sixteen Hub properties against all 89 contract names with both counts pinned rather
  than four probe names; the counts themselves are pinned rather than bounded in both halves, and
  the two parsers that produce them are cross-checked against each other; the four base `--dur-*`
  values and the two `clamp()` tokens are measured in second browser contexts, because the
  project's pinned `reducedMotion: 'reduce'` and 360px viewport left both sets comparing something
  to itself; the face check asserts the `wOF2` signature and the content type, not only a 200 with
  a body; the token half's inlining is asserted from the built stylesheet rather than left to a
  Manual check; the consumer scan reads `.ts` and `.tsx` as well as `.scss`; `git ls-files` runs
  NUL-delimited with `core.quotePath=false`; the load parser strips comments; every planted control
  calls the same named predicate its assertion calls; the colour route's negative control is now a
  neighbour one 8-bit step away and the route's 1/255 resolution is stated as a limit; the four
  pre-change values are derived from `app/app.scss` rather than restated, with Sass's single-to-
  double quote normalisation recorded as an observation; the load assertions are split so each
  claim is separately falsifiable; the contract loads' position above `@forward './fonts'` is
  pinned, because Dart Sass emits module CSS in source order; the scanned-directory constant now
  drives the scan; and the comparator's route arithmetic is made consistent everywhere it is
  stated.

### 2026-08-26, Second review pass

- patch: 20: (high 0, medium 4, low 16)
- **Three factual errors in artifacts this story wrote, each corrected in place with the
  measurement that settles it.** The record's "What would invalidate this record" table still
  carried the `.css`-extension claim the first pass corrected everywhere else, which is the exact
  regression that table exists to prevent. `app/scss/_fonts.scss` declares **ten** `@font-face`
  blocks, not nine, as the Code Map, the record and a test comment all said. The rendered run is
  **30 tests in 1.6 m** across five spec files, re-measured on this pass; the record said "the
  whole file was green: 28 tests, 1.2 m", which named neither the file (13) nor the run (30).
- **"`body` does not compute `rgb(0, 0, 0)` on any route" is wrong**, and the correction is worth
  more than the sentence. `components/atoms/Container/Container.tsx:13-16` sets `<body id={path}>`,
  so `/cv` and `/recommendation` render `body#cv` and `body#recommendation`, which match none of
  `body#work, body#projects`, `body[id='']` or `#celeste`. The base rule paints there, and the base
  rule is `var(--black-color)`. Story 1.18 redefines `--black-color` as a token reference, and the
  claim as written would have told its author that no route shows that value. Corrected in AC3, in
  the record, and in the probe's comment, with the routes' absence from every instrument stated.
- **The consumer scan read two of the Anchor's four shipped source roots.** `hooks/` and `content/`
  were never opened while the record claimed "Consumed by: Nothing", and `hooks/useGsapContext.ts`
  is the most likely place in this repository for a `setProperty('--token-...')` to arrive. Every
  other guard in that file checks the scanned roots against themselves and so could not see a
  missing one. `SCANNED` now covers all four, and a new case pins the root list against
  `git ls-files` so a new top-level source directory fails rather than escapes.
- **The colour comparator failed open.** A canvas `fillStyle` the context cannot parse is
  *ignored*, leaving the previous colour in place, so with `globalCompositeOperation: 'copy'` both
  sides would rasterise the same stale pixel and compare equal, and the control pair beside them is
  the same shape and would go stale too. The `CSS.supports` gate does not cover it. Two sentinel
  writes now prove each assignment took, and a fifteenth control rides back from inside the
  comparator so every call site asserts the guard fired on its own call.
- Fifteen further patches, none of which changes what the story does: the exercised-route guard now
  asserts no real token fell to a text route, not only that each typed route was reached; `@import`
  absence is checked through a named matcher with a planted control in both halves; the published
  face count is pinned at three rather than bounded; a case asserts the ten local families and the
  three published ones do not intersect, which is the premise the emission-order pin rests on;
  `expandVars` throws on non-convergence rather than returning a half-expanded string; the
  substitution control derives the palette entry from the role instead of naming it, so a MINOR
  remap does not fail as a substitution bug; the load parser accepts `@use'...'` with no space,
  which Sass does; the path resolver no longer appends a second `.css`; the two halves now strip
  `//` comments by the same guarded rule; `app/app.scss:53-60` becomes `53-55` and
  `ci.yml:179-221` becomes `179-220`; the record's declared hyphenated story ids are used in the
  record's own headings; the new `git` prerequisite for `pnpm test` and the whole-pixel resolution
  of the length and number routes are stated as limits; and Pending Operator action 1 now names the
  revert.

### 2026-08-26, Third review pass

- patch: 12: (high 0, medium 3, low 9)
- **Two assertions were fail-open, and both are the assertion their own section leans on.** The
  built-stylesheet `@import` matcher required whitespace after the at-keyword (`/@import\s+/`)
  while running over **minified** output, where `@import"/x.css";` is the ordinary emission and the
  spaced form is the unlikely one. Both planted controls were written spaced, so neither could see
  the gap, and the source-side parser in the other half already read `\s*` for exactly this reason.
  The inlining check asked whether the contract appears in *at least one* linked stylesheet, so two
  stylesheets each carrying the 89 declarations and three faces would have passed. Both fixed, with
  the unspaced form as a new control and the carrying count pinned at one.
- **The font half of "consumed by nothing" was never asserted.** The scan loops `--`-prefixed token
  names, so a Hub stylesheet adding `font-family: Geist` would start a download and paint different
  glyphs while the token scan, the face-URL check and the `document.fonts` check all stayed green:
  none of the three asks whether anything in the Hub *uses* a published family. "An unused
  `@font-face` is never downloaded" is one of the two pillars the appearance-neutrality argument
  rests on, and the other was pinned on both sides from the start. A fourteenth case scans the same
  59 files for the three published families, with controls in both directions.
- **The two halves' `//` strip still differed**, `[^:(]` against `[^:]`, while a comment in the
  browser half stated they had been made to agree and the previous pass's log recorded it as fixed.
  That pass corrected the browser half and left this one. The unit half now carries the same rule,
  which is the one that also survives a protocol-relative `url(//host/...)`.
- Nine further patches, none of which changes what the story does: the `git ls-files` sentinel is
  now one tracked file per pathspec rather than `app/app.scss` standing for all three, so a
  `components/` or `public/` that dropped out of the listing fails instead of passing over a tree it
  never read; `SCANNED_EXTENSIONS` gains `.css` and the `.js` family, with the presence guard split
  so the three extensions that exist today keep the stronger "at least one was read" and the five
  anticipatory ones assert only that the filter accepts them; the not-shipped root list is named
  rather than pattern-matched; a shared `DECLARATION` matcher anchors custom-property parsing on the
  character that opens a declaration, so a BEM modifier carrying a pseudo-class cannot be counted as
  one; `expandVars` substitutes from the map the caller is comparing against rather than always from
  the base one; the canvas control measures each side once instead of four times against a stateful
  context, and reports both sides in the same shape; the record's `Container.tsx` quotation is
  corrected to the mangling the conclusions actually depend on; the 404 surface is added to the
  route table and to the probe's comment as a third place the base rule paints; and the second
  finding is lifted to the heading level of its peer.

## Review Triage Log

### 2026-08-26, Third review pass

- intent_gap: 0
- bad_spec: 0
- patch: 12: (high 0, medium 3, low 9)
- defer: 1: (high 0, medium 1, low 0)
- reject: 17: (high 0, medium 0, low 17)
- addressed_findings:
  - `[medium]` `[patch]` **The `@import` absence check could not see the form it exists to
    catch.** `importsIn` was `/@import\s+[^;]+;/g` and runs over minified build output, where
    `@import"/x.css";` with no separating space is what a minifier emits. `loadsIn` in the unit
    half already used `\s*` and says why in a comment. Both planted controls carried the space, so
    the control could not fire on the gap either. Now `\s*`, with the unspaced quoted and
    `url()` forms both planted.
  - `[medium]` `[patch]` **Nothing asserted that no Hub source names a published `@font-face`
    family.** The consumer scan iterates token names only. `font-family: Geist` in a component
    stylesheet would download the face and change what the Hub paints, and every existing gate
    would stay green: the token scan looks for `--` names, the face check asserts the URL resolves
    (it still would), and `document.fonts` asserts the family was declared (it still is). Added as
    a fourteenth case over the same 59 files, with a positive control on both a stylesheet and a
    JS shape and a negative control on a stylesheet naming no contract family.
  - `[medium]` `[patch]` **The two halves still stripped `//` comments by different rules**, and
    the browser half's comment claimed otherwise. `[^:(]` there against `[^:]` here: the second
    covers `url(https://...)` but not a protocol-relative `url(//host/face.woff2)`, which would
    take the rest of its line with it in one half and not the other, on the same files. The
    previous pass logged this as fixed having fixed one side.
  - `[low]` `[patch]` The inlining check was satisfied by any linked stylesheet carrying the
    contract. Two of them would ship the 89 declarations and the three `@font-face` blocks twice,
    which is a payload defect the at-least-one shape cannot see. `markers` now collects every
    carrying href and the count is pinned at one.
  - `[low]` `[patch]` `gitLsFiles(['app', 'components', 'public'])` was proved non-vacuous by
    `app/app.scss` alone, so a `components/` or `public/` that left the listing (a rename, a move,
    an over-broad ignore rule) would leave the copy check green over a directory it never read.
    One sentinel per pathspec now.
  - `[low]` `[patch]` `SCANNED_EXTENSIONS` was `.scss`, `.ts`, `.tsx`, so a consumer arriving in a
    plain global `.css` or in a `.js`-family source was invisible to the scan **and** to the root
    pin, which filters on the same list. Widened to eight. The per-extension presence guard is
    split, because five of the eight exist nowhere under a scanned root and demanding a file that
    does not exist would fail the run for the wrong reason: the three that exist keep "at least one
    was read", the five anticipatory ones assert the filter accepts them.
  - `[low]` `[patch]` The root pin's not-shipped filter was the literal `root !== 'tests'` plus a
    `.`/`_` prefix rule. Widening the extension list would have made it demand `contracts/`,
    `packages/` and `ops/` be scanned for consumers. Replaced with a named `NOT_SHIPPED_ROOTS` list
    carrying each one's reason, so a genuinely new source root still fails the pin.
  - `[low]` `[patch]` Custom properties were parsed with a bare `/(--[A-Za-z0-9_-]+)\s*:/g` in
    three places, which reads `.btn--primary:hover` as a declaration of `--primary`. That would
    inflate the Hub's pinned sixteen and fail the collision argument for a reason unrelated to the
    contract. A shared `DECLARATION` anchors on `;`, `{` or a line start, with a planted pair.
  - `[low]` `[patch]` `expandVars` always substituted from `DECLARED`, including in the case whose
    expected map has `REDUCED` merged over it. A reduced-motion value referencing a name that block
    redefines would have resolved to the base value and reported drift on a property behaving
    correctly. It takes the active map now. Nothing exercises it today, because the four reduced
    values are literal `1ms`, which is the reason to fix it before something does.
  - `[low]` `[patch]` The canvas control called `canvasAccepts` four times to produce one row,
    mutating the shared 2D context between calls, so the evidence the failure prints and the
    verdict it prints it for were separate observations of a stateful thing. Each side is measured
    once now. Its message also printed one side raw and the other as a derived boolean, so `true`
    on the right meant the canvas answered `false`; both sides read the same way now.
  - `[low]` `[patch]` `ops/anchor-token-adoption.md` quoted `Container.tsx` as setting
    `<body id={pathname}>`. It sets `id={pathname.substring(1).replaceAll('/', '-')}`, and the
    whole route table depends on that mangling: as quoted the ids would be `/work` and `/`,
    `body#work` would be invalid and `body[id='']` would match nothing. Corrected, with the id
    column added and the wrong version called out.
  - `[low]` `[patch]` The route table stopped at the six routed pages. `app/not-found.tsx` renders
    through the same root layout and the same `Body`, gets an id matching none of the four override
    rules, and so is a third surface where the base `var(--black-color)` rule paints;
    `error-page.scss:7` paints its own colour on the error container, not on `body`. Added to the
    table, to the probe's comment and to the statement of what no instrument in this story visits.
    The record's second finding was also an `H3` nested under "The rendered comparison" while its
    peer is an `H2`, and it is a fact about the Hub's stylesheets rather than about the comparison.

**No loopback, and why.** Unchanged in shape from the previous two passes. Every finding is a
defect in an artifact this story wrote, not in what it decided to build. Re-deriving from a
corrected spec produces the same two `@use` lines and the same six browser cases; what changed is
two matchers widened, one assertion added, one count pinned and four statements made true. Nothing
inside `<intent-contract>` was touched.

**One finding was deferred.** `/cv`, `/recommendation` and the 404 surface are rendered by no test
in this repository and captured by no baseline, which this story's record already states as a limit
and which is not a defect this story introduced: Story 1-10 chose one route and one viewport
deliberately. It is recorded in `deferred` because Story 1-18 redefines `--black-color`, which is
precisely the value those three surfaces paint, so the gap is about to matter more than it does now.

Seventeen findings were rejected. The larger ones: that the 89 `:root` reads should be one
`page.evaluate` rather than 89 sequential ones (rejected on the same reasoning as the first pass, a
few seconds of test time against losing the harness helper's named-failure behaviour); that the two
halves duplicate about forty lines of parser (kept deliberately, and the one place they had actually
diverged is patched above); that the consumer scan should strip comments (the opposite is deliberate
and stated: a token name in a comment is a consumer waiting to be uncommented); that
`mentions contracts/ in the wiring file and nowhere else` is over-broad because a future source
linking to `https://cuatro.dev/contracts/` would fail it (the intent asks for exactly this check, in
those words, so narrowing it is not this pass's call); that `scannedUnder` uses `Dirent` rather than
`statSync` and would skip a symlinked directory (rejected on the first pass, unchanged: there are
none, and a vendored copy behind one is what the `git ls-files` case is for); that
`NOT_SHIPPED_ROOTS` would false-positive on a first non-test `.ts` under `ops/` or `packages/` (it
fails loud, and a shipped source appearing in a build-tooling directory deserves the look); that the
contract's version header is asserted nowhere (no acceptance criterion names it, and Story 1-20
owns the adopted-version record); that inline `<style>` elements are not scanned for `@import` (the
marker assertion fails closed if the CSS is not in a linked stylesheet); that `@forward './print'`
is unpinned (not a claim this story makes); that the comparator's `not a <route>` and `no-canvas:`
branches carry no control (they are error branches, not assertions); that the Dart Sass measurement
is written out in four places (deliberate redundancy against an error that has already recurred
once); that `sass` is pinned `^1.97.3` in `package.json` while the record names 1.98.0 (the lockfile
fixes the installed version, which is what was measured); and six edge-case shapes the generated
contract cannot take, including a `data:` face URI, a semicolon inside a value, a `@font-face`
without a trailing semicolon and an `_index.scss` appearing beside `contracts/fonts/`.

**On `awaiting-operator`, unchanged from both previous passes.** This story's four acceptance
criteria in `epics.md:1783-1805` are the wiring, the rendered comparison, the absence of a second
copy, and shipping on its own. Every one is agent-doable and every one was done, so the run
finalizes at `done` and the frontmatter carries no `operator_actions`. The four Pending Operator
actions in `ops/anchor-token-adoption.md` are follow-ups, not acceptance of this one.

### 2026-08-26, Second review pass

- intent_gap: 0
- bad_spec: 0
- patch: 20: (high 0, medium 4, low 16)
- defer: 0
- reject: 18: (high 0, medium 0, low 18)
- addressed_findings:
  - `[medium]` `[patch]` **The record's own invalidation table reinstated the false `.css`
    claim.** `ops/anchor-token-adoption.md` § "What would invalidate this record" said loading the
    contract "with a `.css` extension" leaves it as a runtime `@import`, three sections after the
    same file's measured table records `@use './t.css'` inlining byte-identically. The row also
    named the wrong standing case: the extension check is labelled a convention check, and the
    correctness one is `@use`-never-`@import`. Split into two rows that say which case fails and
    why, with the old wording called out so it is not re-derived a third time.
  - `[medium]` `[patch]` **The consumer scan read `app/` and `components/` only, while the record
    claimed the contract is consumed by nothing.** `hooks/useGsapContext.ts` and
    `hooks/useReduceMotion.ts` are shipped sources imported by eight components, and `content/`
    likewise; neither was ever opened. The file's own vacuous-pass guards (`MINIMUM_SCANNED_FILES`,
    `MINIMUM_SCSS_FILES`, the per-root and per-extension checks) all measure the scanned roots
    against themselves, so none could see a missing root. `SCANNED` now covers all four shipped
    roots, the count floor moves 55 to 59, and a new case derives the root list from `git ls-files`
    and fails on any top-level directory carrying shipped sources that is not in it.
  - `[medium]` `[patch]` **The colour comparator route failed open.** `context.fillStyle = value`
    is specified to ignore a value it cannot parse. With `globalCompositeOperation = 'copy'` both
    sides of a pair then rasterise the previous colour and compare **equal**, and the positive
    control (an `oklch()` against its `lab()` rewrite) is precisely the pair that would also be
    ignored, so it would stay green too. `CSS.supports('color', x)` does not cover it: the CSS
    parser and the canvas answer separately. `canvasAccepts` now writes two different sentinels
    around each assignment and reads `fillStyle` back, an unparsed value returns
    `unparsed-by-canvas:<value>` instead of a stale pixel, and the predicate's own control rides
    back with every `compareInPage` call so the guard is asserted where the comparison ran.
  - `[medium]` `[patch]` **"`body` does not compute `background-color: rgb(0, 0, 0)`, and not on
    any route" is false for two of the Hub's six routes.** `Container.tsx:13-16` sets
    `<body id={pathname}>`, so `/cv` and `/recommendation` produce `body#cv` and
    `body#recommendation`, matching none of the three override rules; the base
    `body { background: var(--black-color) }` paints there. The claim was the stated reason AC3 was
    rewritten and is the first thing Story 1.18's author reads about `--black-color`. Corrected in
    AC3, in the record's table (with the two routes added and their absence from every instrument
    stated), and in the probe's comment in `tests/e2e/contract-anchor.pw.ts`.
  - `[low]` `[patch]` The exercised-route guard asserted each of the six typed routes was reached
    by a real token but never that no real token fell **to** a text route, so a whole scale could
    drop to the uncontrolled string comparison while one surviving value held its route open. Both
    directions are asserted now. The asymmetry the reviewers found in the rationale (why
    `text (var)` carries a control and plain `text` does not) is settled in the same place:
    `text (var)` is a failure route worth pinning, plain `text` is unreachable rather than unused.
  - `[low]` `[patch]` `app/scss/_fonts.scss` declares **ten** `@font-face` blocks, not nine. The
    Code Map, the record and a test comment all said nine. Openers at `:19,29,39,49,59,71,81,91,
    103,113`, verified by count.
  - `[low]` `[patch]` Nothing asserted the premise the emission-order pin rests on: order between
    two `@font-face` blocks decides something only when both name the same family, and "no family
    collides" lived in prose alone. A case intersects the ten local families with the three
    published ones, with both counts pinned and a planted control on the same comparison.
  - `[low]` `[patch]` The published face count was bounded at `> 0` while every other count in the
    story is pinned, in a suite where every face assertion loops over that list. Pinned at three,
    with the families asserted distinct.
  - `[low]` `[patch]` Two `@import` absence checks carried no planted control, against this story's
    own rule that every new assertion has one. The built-stylesheet scan now runs through a named
    `importsIn` the control calls, and the source-level `@import url(` matcher is shown firing and
    not firing before its absence is read as good news.
  - `[low]` `[patch]` `expandVars` gave up silently after ten passes and returned a half-expanded
    string, so a cycle would have surfaced as an unrelated-looking value mismatch. It throws now,
    naming the value and what it reached.
  - `[low]` `[patch]` The substitution control pinned `--token-bg` to `--c-paper` specifically,
    which the contract is free to change under its own MINOR rule; the remap would have failed as a
    substitution bug. The palette entry is now read out of the role's own declaration.
  - `[low]` `[patch]` The load parser required whitespace after the rule, but Sass accepts
    `@use'../../contracts/tokens';`, so a load written that way was invisible and the
    `@use`-never-`@import` assertion would have passed straight over a runtime `@import`. `\s*`
    now, with a control.
  - `[low]` `[patch]` `resolve(dirname(INDEX_SCSS), \`${load.path}.css\`)` appended `.css`
    unconditionally, so an explicit-extension load resolved to `tokens.css.css` and the case
    written to name that mistake reported a nonexistent file instead. Extracted as
    `resolvedTarget`, used by both call sites, with controls on both spellings.
  - `[low]` `[patch]` The two halves parse `app/app.scss` with two different `//`-stripping rules,
    the Playwright one unguarded, so a `url(https://...)` or a protocol-relative `url(//host/...)`
    would take the rest of its line with it there and not in the other half. Made to agree.
  - `[low]` `[patch]` The rendered run is 30 tests in 1.6 m across five spec files, re-measured on
    this pass. The record said "the whole file was green: 28 tests, 1.2 m", which is neither the
    file (13) nor the run (30), and gave no way to reproduce the figure.
  - `[low]` `[patch]` Pending Operator action 3 said "the four new browser checks" where the gate
    table two sections above says six, and `tests/e2e/contract-anchor.pw.ts` declares six.
  - `[low]` `[patch]` The record opens by declaring that story ids are written hyphenated and then
    writes `Story 1.18`, `Story 1.20` and `Story 2.20` in its own headings and tables;
    `app/scss/_index.scss` mixed both in one comment block. Normalised, with the lapse noted where
    the rule is stated.
  - `[low]` `[patch]` Two citations were wrong: `app/app.scss:53-60` for a rule at `53-55`, and
    `.github/workflows/ci.yml:179-221` for a 220-line file.
  - `[low]` `[patch]` `pnpm test` now needs a `git` binary and a real checkout, because three
    `git ls-files` calls run at collection time in the blocking `test` job. A new prerequisite that
    appeared in no limits table. Added, along with the whole-pixel resolution of the length and
    number comparator routes, which is the same shape of ceiling the colour row already states.
  - `[low]` `[patch]` Pending Operator action 1 named a Block If without saying what to do about
    it. It now names the revert (the two `@use` lines and nothing else, which is why the story was
    split) and repeats that the baseline is not to be refreshed.

**No loopback, and why.** Every finding is a defect in an artifact this story wrote rather than in
what it decided to build. Re-deriving from a corrected spec would produce the same two `@use`
lines, the same six browser cases and the same fourteen comparator controls; what changes is a
guard added, a root list widened and six statements made true. The one finding that touches the
frozen contract, the I/O matrix's "Old values unmoved" row, was already logged as a deviation on
the implementation pass and stands unchanged, as it should: the contract records what was asked
for and the log records what was true.

Nothing was deferred. Eighteen findings were rejected. The larger ones: that the record does not
address the OFL licence text for the three woff2 files the build now emits into
`_next/static/media/` (`contracts/fonts/` ships the licences beside the faces, the same pattern the
Anchor's own ten faces already follow, and a licensing decision is not this story's to make); that
the build-output payload cost of the change is never measured (the story's claim is about the
render, and the record already states that nothing consumes the contract); that the `__tests__`
carve-out is directory-shaped rather than file-shaped (deliberate and stated: a test naming a token
is not a consumer, and this very file names several); that `MINIMUM_SCANNED_FILES` is a floor while
the record states an exact (deliberate and stated: a later story adding a component must not fail
this file); that inline `<style>` elements are not scanned for `@import` (the marker assertion fails
closed if the CSS is not in a linked stylesheet, and a source-level case pins the absence anyway);
that `faceBlocksIn` counts braces without tracking strings (both inputs are generated, and a
misaligned boundary fails the family assertion loudly rather than passing); that `scannedUnder`
uses `Dirent` rather than `statSync` and so would skip a symlinked directory (there are none, and a
vendored copy behind one is what the `git ls-files` case is for); that the pre-change values should
run through the equivalence comparator (an exact-value pin by design, rejected on the same reasoning
as the first pass); that `normaliseQuotes` is applied to the authored side only (same reason: the
observed side is pinned, not normalised); that the basename check should run repository-wide rather
than under `app/`, `components/` and `public/` (it would flag `contracts/` itself, and the three
directories are the intent's own); that the two halves duplicate about forty lines of parser (kept
deliberately, and the one place they had actually diverged is patched above); that the second
browser contexts restate `playwright.config.ts`'s settings rather than importing them; that the
`time` route's exercised guard is satisfied by `1ms` against `1ms` (the guard still fails if the
route stops matching, which is what it is for, and the base scale is measured in its own context);
that the cascade order of the contract's `:root` block against `app/app.scss`'s is asserted nowhere
(it decides nothing while the intersection is empty, and the intersection is pinned on both sides);
that `expandVars` does not handle `var(--x, fallback)` (the contract is generated and cannot carry
one); that the 33-line comment in `_index.scss` restates the record; that the spec's frontmatter
disagrees with its body (workflow bookkeeping, not an artifact defect); and that the diff is
disproportionate at roughly five hundred lines of test and record per line of shipped CSS (the
epic's precedent is that a contract story commits its evidence, and the spec carries `oversized`).

**On `awaiting-operator`, unchanged from the first pass.** This story's four acceptance criteria in
`epics.md:1783-1805` are the wiring, the rendered comparison, the absence of a second copy, and
shipping on its own. Every one is agent-doable and every one was done, so the run finalizes at
`done` and the frontmatter carries no `operator_actions`. The four Pending Operator actions in
`ops/anchor-token-adoption.md` are follow-ups, not acceptance of this one.

### 2026-08-26, Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 19: (high 0, medium 4, low 15)
- defer: 0
- reject: 18: (high 0, medium 0, low 18)
- addressed_findings:
  - `[medium]` `[patch]` **The story's central rationale was factually wrong, in five places at
    once.** "An explicit `.css` extension on a Sass load emits a runtime `@import`" is true of
    `@import` and false of `@use`. Measured against this repository's own Dart Sass 1.98.0 on four
    one-line fixtures: `@use './t'` and `@use './t.css'` both inline with identical output,
    `@import './t'` inlines, and only `@import './t.css'` passes through. The claim was repeated in
    the `_index.scss` comment, both test docblocks, a test's failure message, the ops record and
    this spec's Design Notes, and the failure message actively misdirected a future reader. The
    real rule is the pair, and what keeps the contract inlined is `@use`. Corrected everywhere,
    the four-variant measurement recorded in `ops/anchor-token-adoption.md` as the evidence, and a
    new standing assertion added that every contract load is `@use` and never `@import`, with the
    extensionless spelling kept as a separately labelled convention check.
  - `[medium]` `[patch]` **"No collision with the Hub's sixteen custom properties" was asserted for
    four of them.** The "identical by construction" argument in both the record and this spec rests
    on all sixteen, while the check covered only the four `PRE_CHANGE` names. It now parses
    `app/app.scss`, intersects all sixteen against all eighty-nine, pins both counts so an empty
    intersection cannot come from an empty list, and additionally asserts no other stylesheet under
    `app/` or `components/` declares a custom property at all, which is the other half of the
    argument.
  - `[medium]` `[patch]` **Four of the eighty-nine values were never compared to anything.**
    `playwright.config.ts:79` pins `reducedMotion: 'reduce'` on the single project, so the spec's
    own reduced-motion branch always fired and `--dur-micro`, `--dur-minor`, `--dur-major` and
    `--dur-exit` were only ever `1ms` against `1ms`, while the record claimed all eighty-nine were
    measured. It also meant the `time` route's exercised-guard was satisfied by that vacuous pair.
    A second context at `reducedMotion: 'no-preference'` now reads the four off `:root` and runs
    them through the same comparator against the base declared values, asserting first that the
    media query really lifted. Observed there: `120ms` reaches the browser as `.12s`.
  - `[medium]` `[patch]` **AC3 and one Execution bullet still required `body` to compute
    `rgb(0, 0, 0)`**, which this spec's own Spec Change Log records as false on every route. The
    spec therefore shipped an acceptance criterion the implementation knowingly did not meet.
    Acceptance Criteria and Tasks sit outside `<intent-contract>`, so both were corrected in place
    to the claim that is actually observable and actually asserted. The I/O matrix row is inside
    the contract and is left standing with its logged deviation.
  - `[low]` `[patch]` The two `clamp()` tokens were canonicalised only at 360px, where `9vw` and
    `5vw` both lose to the minimum term, so the fluid middle term was inert and a rewrite of it
    would have compared equal. They now run at a second width as well, with a control that
    reproduces the blind spot exactly: `clamp(2.25rem, 9vw, ...)` against `clamp(2.25rem, 8vw, ...)`
    compares equal at 360 and unequal at 600.
  - `[low]` `[patch]` `git ls-files` output was split as plain stdout, but git C-quotes paths with
    non-ASCII bytes by default, so a vendored copy under such a path would have evaded both the
    basename filter and the `cuatro-contracts` segment filter. Now `-z` with `core.quotePath=false`
    and a NUL split. The two collection-time helpers also lost the file's own error attribution;
    both are wrapped now.
  - `[low]` `[patch]` Two of the four planted controls re-wrote their predicate inline instead of
    calling it, which is precisely the failure controls exist to prevent: change the real filter
    and the control stays green. Both now call the same named function the assertion calls.
  - `[low]` `[patch]` The load parser read raw file text, and the new `_index.scss` comment
    discusses `@import` and contains the literal string `'../../contracts/tokens.css'`. It escaped
    the parser only because a backtick rather than whitespace followed `@import`, so a reworded
    comment would have failed the run and a commented-out `// @use` would have counted as live
    wiring. Comments are stripped before parsing now, with a case pinning it.
  - `[low]` `[patch]` The face check asserted only `status === 200` and a non-zero body, which any
    200 satisfies, in a check whose whole stated reason to exist is that a 404 reads identically to
    a load. It asserts the `wOF2` signature and the content type now.
  - `[low]` `[patch]` Nothing asserted the token half was actually inlined into a linked
    stylesheet: the token test read computed values, which would pass whatever route the names
    arrived by, and the inlining check was left to a Manual check. The face test already fetches
    every linked stylesheet, so it now asserts in that same loop that declarations only the
    contract makes appear in one of them. The Manual check is gone, replaced by a standing one.
  - `[low]` `[patch]` The comparator's route arithmetic disagreed in four places: six typed routes
    in the code, "seven" in the record and this spec, six in the exercised-guard, and "all eight"
    in a comment over fourteen controls. Made consistent, and the record now says which route has
    no control and why.
  - `[low]` `[patch]` The record claimed the computed-value checks are "not route-limited in the
    same way" as the screenshot. They are: `/work` is the only URL any browser test visits.
    Corrected, and the limits table no longer overloads "route" for two different things.
  - `[low]` `[patch]` The scanned-directory constant was decorative, used only to interpolate a
    failure message while the scan hardcoded the same two names. It drives the scan now.
  - `[low]` `[patch]` The colour route's negative control was a whole-palette difference while its
    own comment claimed every negative is the smallest real difference of the same shape, and
    nothing probed the 1/255 boundary the canvas rasterisation imposes. Replaced with a near
    neighbour, and the comparator's real resolution is stated as a limit.
  - `[low]` `[patch]` The four pre-change expectations were restated as literals three lines after
    the file's own rule against restating values. They are derived from `app/app.scss` now, with
    the single-to-double quote normalisation recorded as an observation rather than left as an
    unexplained literal.
  - `[low]` `[patch]` The consumer scan read only `.scss`, so a future consumer arriving in a
    `.tsx` inline style or a `setProperty('--token-...')` call would have been invisible to it.
    Extended to `.ts` and `.tsx` under both roots.
  - `[low]` `[patch]` Neither half pinned the property count (both guards were "more than fifty"),
    and the two halves derived their name lists with two non-equivalent parsers, so a removed name
    would have shrunk a loop and passed while the record claimed the check "fails naming the
    property". The two parsers are cross-checked against each other now, the counts are pinned at
    eighty-nine and four, the reduced-motion block's values are asserted non-empty like the base
    block's, and that row of the record is corrected.
  - `[low]` `[patch]` Three assertions in the load test were unreachable as failures, because one
    strict equality already pinned rule, path and order, which also turned the test into a spelling
    check on `../../`. Split so each claim is separately falsifiable.
  - `[low]` `[patch]` The contract loads' position above `@forward './fonts'` is load-bearing,
    because Dart Sass emits module CSS in source order and moving them below would emit the
    contract's `@font-face` blocks after the Anchor's own. Nothing pinned it; a case does now.

**Why the wrong rationale was patched rather than looped back as a spec repair.** Its root cause is
partly in this spec's Design Notes, which is outside `<intent-contract>` and so is reachable by a
`bad_spec` loopback. The test applied was whether re-deriving from a corrected spec would produce
materially different code, and it would not: the wiring (`@use`, extensionless, tokens then fonts)
is exactly what a corrected spec asks for, and every browser assertion is unaffected. A loopback
would have discarded nine hundred lines of correct work to fix an explanation, so the explanation
was fixed where it is wrong and the assertion it justifies was strengthened to match.

Nothing was deferred: no reviewer surfaced a pre-existing issue outside this story. Eighteen
findings were rejected. The larger ones: that AC3 is checked against the git index while its own
wording says "anywhere under `public/`" (`public/contracts/` exists on disk after any build, is
gitignored, and is blessed as generated by Story 1.16's own acceptance at `epics.md:1757-1758`;
reading the working tree there would report the served copy as an authored duplicate); that AC1's
"no component stylesheet changes" has no standing gate (it is a closing-diff property, and a
standing gate would be wrong, since Story 1.18 legitimately changes `app/app.scss`); that the
consumer scan should strip comments (the opposite is deliberate and stated: a token name in a
comment is a consumer waiting to be uncommented); that the new record should be back-linked from
`ops/contract-serving.md` and `ops/rendered-output-harness.md` (editing two records this story does
not own to add cross-references is scope this story has no claim on, and the new record already
points outward); that the eighty-nine `:root` reads should be one `page.evaluate` rather than
eighty-nine (a few seconds of test time against losing the harness helper's named-failure
behaviour); that the pre-change literals should go through the equivalence comparator (they are an
exact-value pin by design, and running them through it would weaken exactly the check that catches
a moved Hub value); that the diff is disproportionate at roughly four hundred and fifty lines of
test and record per line of shipped CSS (the epic's own precedent is that a contract story commits
its evidence, and the spec already carries `oversized`); and eleven edge-case shapes the contract
cannot take, because `contracts/tokens.css` and `contracts/fonts.css` are generated by
`packages/tokens` and `packages/fonts` and cannot contain a `var()` fallback, a third `:root`, a
semicolon inside a `url()`, an unterminated block, a `data:` face URI or a competing `.scss` beside
the `.css`.

**On `awaiting-operator`.** This story's four acceptance criteria in `epics.md:1783-1805` are the
wiring, the rendered comparison, the absence of a second copy, and shipping on its own. Every one
is agent-doable and every one was done, so the run finalizes at `done` and the frontmatter carries
no `operator_actions`. The four Pending Operator actions in `ops/anchor-token-adoption.md` are
follow-ups (a post-merge sanity check, a policy decision about colour downlevelling, a CI timing to
record, and the `AGENTS.md` refresh owed since Story 1-10), not acceptance of this one. Story 1-15
made the same call on the same reasoning.

## Design Notes

**Why the wiring is a Sass load and not a copy.** `DESIGN.md` § Sequence step 1 says to drop the
two files into `app/scss/`. `epics.md:1777-1781` overrules that in place: AD-1 makes `contracts/`
the published surface and AD-4 forbids a second authored copy, so the Anchor loads the published
folder directly. The vendored `cuatro-contracts/` folder AD-14 mandates is a Satellite mechanism,
and the Anchor is the publisher. Story 1-16 already copies `contracts/` into `public/contracts/` at
build time for serving, which is a generated copy and gitignored, and is not what the stylesheet
graph reads.

**Why the rule is `@use`, and not the extension.** This note said the opposite until the review
pass, and the wrong version is the intuitive one, so it is corrected here rather than deleted.
Measured 2026-08-26 against this repository's own Dart Sass (`node node_modules/sass/sass.js`,
version 1.98.0) on four one-line fixtures each loading the same one-line plain CSS file:
`@use './t';` inlines, `@use './t.css';` inlines with byte-identical output, `@import './t';`
inlines (with a deprecation warning), and only `@import './t.css';` passes straight through as a
runtime `@import`. The rule is therefore the **pair** of the old rule with an explicit extension,
and what keeps the contract inlined here is that the wiring uses `@use`. A runtime `@import` would
put the token contract behind a second network request at a path Next does not emit, and would
break the relative `url()` resolution the face check asserts. That is the one detail of the wiring
that is easy to get wrong and silent when wrong, which is why a source-level case pins the rule
(`@use`, never `@import`) as a correctness check and the extensionless spelling separately as a
convention check. The full four-variant measurement is recorded in `ops/anchor-token-adoption.md`.

**Why the face URLs are fetched rather than inspected.** `contracts/fonts.css` uses `url()` values
relative to itself, and Next's SCSS pipeline rewrites them relative to the source file (which is
what makes `_fonts.scss`'s `../../public/fonts/…` work today). "Rewrites them correctly" is a
claim about a build pipeline, so it is measured: fetch the emitted URL, assert 200 and non-zero
bytes. `document.fonts.check` cannot do this job, because it answers `true` for a family with no
matching `@font-face` rule at all, as `tests/e2e/contract-serving.pw.ts:28-35` records.

**Why the render can be identical by construction.** Sixteen custom properties exist in the Anchor
today and all sixteen are declared in `app/app.scss`; no component stylesheet declares one. None of
the sixteen names appears in `contracts/tokens.css`, and none of the contract's names appears in
any Anchor stylesheet. An unused `@font-face` is not downloaded and paints nothing. So the only
ways this change could move a pixel are a name collision (there is none) and a build-pipeline
surprise, and the screenshot comparison is what covers the second.

## Verification

**Commands:**
- `corepack pnpm typecheck`, expected: exit 0 with the two new `.ts` files included.
- `corepack pnpm test --run`, expected: exit 0, totals grow by the new suite's cases, and no
  pre-existing case moves.
- `corepack pnpm build`, expected: exit 0, the publish step prints its file list, and the Sass
  compile resolves both contract loads and the three woff2 `url()` values.
- The `docker run` command at `ops/rendered-output-harness.md:156-164`, with `pnpm test:e2e` in
  place of `pnpm run test:e2e:update`, expected: every spec green, `rendered-output.pw.ts` matching
  the committed baseline, and the new `contract-anchor.pw.ts` cases all passing.
- `Get-FileHash tests/e2e/rendered-output.pw.ts-snapshots/work-360x800-chromium-linux.png
  -Algorithm SHA256` before and after, expected: unchanged, and equal to
  `27f22bb6ff78c62e019cc8f222665436b7a20c2445a90677bead375c7d763f97` as recorded at
  `ops/rendered-output-harness.md:151`.
- `git diff --stat b984ca7 -- app/app.scss components contracts packages public docker .github
  package.json pnpm-lock.yaml tests/e2e/rendered-output.pw.ts-snapshots`, expected: empty.
- `git status --porcelain`, expected: empty at the closing commit.
- Punctuation sweep over every file written, run against a positive control carrying an em-dash, an
  en-dash used as a dash, a double-dash and an emoji, so it cannot pass vacuously.

**Manual checks:**
- None. The one that was here, reading the compiled stylesheet to confirm the contract's `:root`
  block and the three `@font-face` blocks are inlined with no `@import` left for the browser, is
  now a standing assertion instead: `tests/e2e/contract-anchor.pw.ts` already fetches every
  stylesheet the page links, so it asserts in that same loop that declarations only the contract
  makes (`--c-paper` and `--token-scrim`) appear in one of them, that the three contract families
  appear, and that no `@import` survives in any of them. A check a machine makes on every run is
  worth more than one a person makes once.

## Auto Run Result

Status: done
Blocking condition: none

**Summary.** Anchor migration step 1, after a third review pass. `app/scss/_index.scss` carries the
same two `@use` lines that load `contracts/tokens.css` and `contracts/fonts.css` into the Hub's
stylesheet graph, and nothing in the Hub reads a name or a family from either. **The shipped CSS is
byte-identical to the previous pass and to the pass before it**; this story has not changed what the
site renders since it was first implemented. What changed here is that two assertions which could
have passed over the failure they exist to catch no longer can, and one invariant that was argued in
prose is now asserted.

**Files changed in this pass.**
- `tests/e2e/contract-anchor.pw.ts`: the `@import` matcher widened to `\s*` with the unspaced
  minified form planted as a control; the inlining check pinned to exactly one carrying stylesheet;
  `expandVars` substituting from the map the caller compares against; the canvas control measuring
  each side once against the stateful context and reporting both sides in the same shape; the
  probe's comment extended to the 404 surface.
- `app/__tests__/anchor-contract.test.ts`: a fourteenth case asserting no scanned source names any
  of the three published `@font-face` families; the `//` strip brought into line with the browser
  half; `KNOWN_TRACKED` become one sentinel per `git ls-files` pathspec; `SCANNED_EXTENSIONS`
  widened to eight with the presence guard split into "exists today" and "anticipatory";
  `NOT_SHIPPED_ROOTS` named with reasons; a shared `DECLARATION` matcher anchoring custom-property
  parsing on the character that opens a declaration. Thirteen cases became fourteen.
- `ops/anchor-token-adoption.md`: the `Container.tsx` quotation corrected to the path mangling the
  route table's conclusions depend on, with an id column added; the 404 surface added as a third
  place the base rule paints; a published-families row added to the consumed-by table; three new
  rows in the invalidation table covering the font side and the double-inlining case; the two
  matcher corrections recorded with why each one mattered; the second finding lifted to its peer's
  heading level; the harness run re-measured.
- This spec: this pass's entries in the Spec Change Log and the Review Triage Log, and one
  `deferred` entry.
- `app/scss/_index.scss`: **unchanged this pass.**

**Review findings breakdown.** 12 patches applied (high 0, medium 3, low 9), 1 deferred (medium),
17 rejected, 0 intent gaps, 0 spec repairs.

**Follow-up review recommendation:** `true`. Patched this pass: high 0, medium 3, low 9. Score is
`3 x 3 + 1 x 9 = 18`, which is 5 or more.

**Verification performed**, all of it after the patches.
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test --run`: exit 0, 26 files, **599** cases, up one from 598 for the new
  published-families case. No pre-existing case moved.
- `corepack pnpm build`: exit 0, all ten routes generated, the Sass compile resolving both contract
  loads and the three woff2 `url()` values.
- The pinned-container harness run, `ops/rendered-output-harness.md:156-164` verbatim with
  `pnpm test:e2e` in place of `pnpm run test:e2e:update`: exit 0, **30 passed in 2.1 m**, including
  `captures /work at 360x800 and matches the committed baseline` and all six
  `contract-anchor.pw.ts` cases.
- `Get-FileHash` on the committed baseline before and after:
  `27f22bb6ff78c62e019cc8f222665436b7a20c2445a90677bead375c7d763f97` both times, equal to the figure
  at `ops/rendered-output-harness.md:151`. Never regenerated, and the snapshot directory still holds
  exactly that one PNG.
- `git diff --stat b984ca7 -- app/app.scss components contracts packages public docker .github
  package.json pnpm-lock.yaml tests/e2e/rendered-output.pw.ts-snapshots`: empty.
- Punctuation sweep over all five files written, against a positive control carrying an em-dash, an
  en-dash used as a dash, a double-dash and an emoji. The control fired on all four. Eleven hits in
  the files, every one of them a regex character class (`--[A-Za-z0-9_-]+`) or a `git ls-files --`
  pathspec separator, both exempt as CLI and code tokens. No prose violation.

**Residual risks.**
- Unchanged and stated: everything was measured against the harness's own `pnpm build && pnpm start`
  on `127.0.0.1:3100`, not against the deployed container behind Caddy and Cloudflare. Pending
  Operator action 1 is the post-merge confirmation.
- `/cv`, `/recommendation` and the 404 surface are rendered by nothing in this repository, and they
  are the only surfaces the base `var(--black-color)` rule paints. Recorded in `deferred` this pass
  because Story 1-18 redefines that property.
- The five anticipatory entries in `SCANNED_EXTENSIONS` are asserted only at the filter, not by a
  file that exists. If a `.css` or `.js` consumer ever arrives the scan will read it, but until one
  does, that half of the widening is unexercised by anything but its own guard.

