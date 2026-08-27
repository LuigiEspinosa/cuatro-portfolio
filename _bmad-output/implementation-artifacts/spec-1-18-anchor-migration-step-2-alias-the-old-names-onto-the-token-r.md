---
title: 'Anchor migration step 2, alias the old names onto the token roles'
type: 'feature'
created: '2026-08-26'
status: 'done'
baseline_commit: '3e9bb257b8b8f9bdf2878af6b28256948dc8fb90'
baseline_revision: '3e9bb257b8b8f9bdf2878af6b28256948dc8fb90'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/ops/rendered-output-harness.md'
  - '{project-root}/ops/anchor-token-adoption.md'
warnings: ['oversized']
deferred:
  - summary: >-
      The ground a visitor actually sees is still the cybercore literal on every route, because
      the hardcoded colour values in the component stylesheets are a later story's act and the
      alias layer cannot reach them.
    evidence: |-
      app/app.scss:107 (body#work, body#projects), HomeLayout.scss:2 and error-page.scss:7 each
      paint #0a000f as a literal at a higher specificity than the base body rule, so the
      --token-bg this story wires onto --black-color is visible on the 404 surface and nowhere
      else. ProjectCard.scss:27,36,67, WorkItem.scss:35,145 and error-page.scss:9-10,28 carry the
      same shape of literal. Their mapping is rebaseline-2026-08-15.md section O-10 and it is
      assigned to UX-DR10 and the Epic 2 redesign, not to this migration step, so this is
      recorded rather than fixed. It matters because the story's user story is written at the
      pixel surface and the aliases are asserted at the custom-property surface, which is exactly
      the gap between "the Hub renders in the Ecosystem's visual identity" and what a visitor
      sees after this commit.
    location: >-
      app/app.scss:107
    severity: medium
  - summary: >-
      The retired display face is still preloaded on every route and the face that replaced it is
      not, so each page fetches roughly 20 KB it never paints and the first-paint width guarantee
      the preload exists to give is dropped for the four display headings.
    evidence: |-
      app/layout.tsx:41-45 preloads /fonts/MonumentExtended-Bold.woff2 with as='font', and
      app/scss/_fonts.scss:92-95 still declares its @font-face. After this commit no rule resolves
      that family: the four --monument-bold call sites resolve to --f-display, which is
      Bricolage Grotesque, and contracts/fonts.css:16-22 publishes that face with
      font-display: swap and nothing preloads it. app/layout.tsx:39 states the preload's own
      purpose, "Preload display fonts so SplitText measures correct widths on first paint", and
      .glitch-text__inner is both a SplitText consumer and one of the four sites this story moved
      onto the display face. Nothing in the story observes the document head: every new assertion
      reads resolved CSS, and the one pixel baseline is /work, which renders no GlitchText. It is
      caused by this commit and it is outside this commit's stated edit boundary: the intent limits
      source edits to app/app.scss and the four font-weight lines, and app/layout.tsx is neither,
      so it belongs to the story that retires the local faces. Recorded in
      ops/anchor-token-adoption.md, "Stated limits of step 2".
    location: >-
      app/layout.tsx:41-45
    severity: medium
  - summary: >-
      The tech chip label fell from 9.16:1 to 2.56:1, across the 4.5:1 text floor, because
      --accent-dim lost its alpha to two opaque token roles and the label now reads against the
      chip fill rather than against the page ground behind it.
    evidence: |-
      ProjectCard.scss:66 and WorkItem.scss:144 set background: var(--accent-dim) on a tech chip
      and color: var(--light-gray-color) on its label. Before this commit --accent-dim was
      rgba(91, 33, 182, 0.22), so the chip barely lifted the #0a000f ground and the label kept
      most of its 10.14:1. Both roles the mapping assigns are opaque. Measured 2026-08-26: the
      two after ratios already rasterised against #0a000f in
      ops/anchor-token-adoption.md give the label-on-fill ratio as their quotient,
      0.3630 / 0.1418 = 2.56:1; the before figure composites rgba(91, 33, 182, 0.22) over
      #0a000f to rgb(28, 7, 52) against the pre-change #b4b4cc, giving 9.16:1. It is caused by
      this commit and every route to a fix is closed to it: the mapping is to be followed rather
      than invented, a chip-scoped third value would be an invented mapping, and giving the label
      its own colour means editing a component stylesheet beyond the four font-weight lines. The
      cheapest real fix is a chip fill of --token-bg-raised with the border keeping --accent-dim,
      which is a UX-DR10 shaped decision. It is also below the .lighthouserc.js floor on /work
      and /projects, which that config asserts at 0.95 severity error. Recorded in
      ops/anchor-token-adoption.md as a contrast-table row with its method and as Pending
      Operator action 9.
    location: >-
      components/molecules/ProjectCard/ProjectCard.scss:66
    severity: medium
  - summary: >-
      Eight local @font-face declarations are resolved by nothing after this commit, not the one
      the record previously named, and the story that retires the local faces inherits that
      inventory plus the public/fonts/ payload behind it.
    evidence: |-
      app/scss/_fonts.scss:20,30,40,50,60,72,82,92 declare GeneralSans-Light, GeneralSans-Regular,
      GeneralSans-Medium, GeneralSans-Semibold, GeneralSans-Bold, MonumentExtended-Light,
      MonumentExtended-Regular and MonumentExtended-Bold. --font-regular and --font-bold were the
      last consumers of the GeneralSans five and --monument-regular and --monument-bold of the
      Monument three; all four are now aliases onto --f-body and --f-display. Observed 2026-08-26
      by git grep over app, components, hooks, content and contracts, which returns only the
      declarations themselves and the one preload at app/layout.tsx:42. Not fixed here because
      app/scss/_fonts.scss is neither app/app.scss nor one of the four font-weight lines.
      Recorded in ops/anchor-token-adoption.md, "Stated limits of step 2".
    location: >-
      app/scss/_fonts.scss:20-95
    severity: low
  - summary: >-
      The comment carrying the two @use lines that load the contract still states that nothing in
      the repository consumes any of these names, which is the claim this commit falsified.
    evidence: |-
      app/scss/_index.scss:29-32 reads "Nothing in this repository consumes any of these names
      yet, and that is the point: this story adds the contract and changes no pixel", written by
      Story 1-17. The alias layer in app/app.scss is now a consumer of ten roles and the four
      font-weight call sites of one more. The comment goes on to name Story 1-18 as the commit
      that will change it, so it is stale rather than misleading to a careful reader, but it sits
      directly on the two loads it explains. Not fixed here: app/scss/_index.scss is neither
      app/app.scss nor one of the four font-weight lines, and this story's contract admits no
      third source file. Recorded in ops/anchor-token-adoption.md, "Stated limits of step 2".
    location: >-
      app/scss/_index.scss:29-32
    severity: low
---

<intent-contract>

## Intent

**Problem:** Story 1-17 put `contracts/tokens.css` and `contracts/fonts.css` into the Hub's
stylesheet graph and left them consumed by nothing. The Hub still renders in the inherited
cybercore palette on pure black and pure white, so `cuatro.dev` does not yet look like the rest of
the Ecosystem. This is the second and last commit of the Anchor's adoption (UX-DR9, FR-17): the one
that changes the whole site's appearance.

**Approach:** Redefine the Hub's sixteen custom properties in `app/app.scss` as `var()` references
to token roles, following `epics.md:1821-1836` and `DESIGN.md` § The mapping exactly. The fifteen
component stylesheets keep working untouched, with one named exception the acceptance criteria
require: the four `--monument-bold` call sites get `font-weight` set alongside `font-family` by
hand, because a family alias cannot carry the weight that lives in the old family name. `--accent-dim`
is doing two jobs across its fifteen call sites, so it resolves per call site through scoped
redefinitions of that one property inside `app/app.scss`, never by editing a call site. Prove the
result rather than assert it: computed values read in a real browser, the four weights read as
weights, and a deliberately regenerated screenshot baseline reviewed as a change.

## Boundaries & Constraints

**Always:**
- The mapping is `epics.md:1821-1836` and `DESIGN.md` § The mapping, whose value-by-value half for
  the cybercore properties is `rebaseline-2026-08-15.md` § O-10. Follow the table, do not invent a
  mapping (`AGENTS.md`, Known pitfalls).
- `app/app.scss` is the one file that carries the alias layer, including every scoped
  `--accent-dim` redefinition. The only other source edits in this story are the four `font-weight`
  lines named below.
- `--accent-dim` resolves **per call site across its fifteen** (`epics.md:1831-1834`). The rule that
  decides a site is stated and falsifiable: a declaration is a boundary a person reads state from
  when some selector changes that same property under `:hover`, `:focus-visible` or a data-state
  attribute, or when it is the only visual indicator of a component's state. Everything else is
  ornament. The per-site table is in Design Notes and every row is asserted on the real element.
- The four `--monument-bold` call sites (`glitch-text.scss:5`, `error-page.scss:24`,
  `ProjectsHero.scss:19`, `WorkHero.scss:19`) get `font-weight` set alongside `font-family` **in
  this same commit, before anything reads it**. Read against a tree where the weight was not set,
  the weight assertion is green and meaningless (`ops/rendered-output-harness.md` § "The finding
  Story 1-18 inherits", `tests/e2e/harness.ts:31-39`).
- Regenerating `work-360x800-chromium-linux.png` is legitimate **here and only here**: this is case
  1 of `ops/rendered-output-harness.md` § "When regenerating is legitimate", a story that
  deliberately changed how `/work` renders. The regenerated PNG is part of this story's diff and is
  reviewed as a change. It is written by the documented `docker run` command with
  `pnpm run test:e2e:update` and by nothing else.
- Story 1-17's "consumed by nothing" assertions are **inverted, never deleted**. After this story
  the alias layer in `app/app.scss` is the only consumer, and that is asserted by name and by count
  in both halves, so a contract name appearing in a component stylesheet still fails.
- Every new assertion carries its own vacuous-pass guard: a parsed list asserts it is non-empty and
  carries a known member, a scan asserts it read a non-zero number of files, and every matcher is
  shown firing on a planted control that calls the same named predicate the assertion beside it
  calls.
- Values recorded under `ops/` are marked as a decision or an observation, an observation carries
  the method that gathered it (NFR-9), and dates are ISO 8601 UTC.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash and no
  emoji. The commit is a subject line only, no body and no trailer.

**Block If:**
- The rendered-output harness cannot be run at all: Docker is unavailable, the pinned image cannot
  be pulled, or the container cannot start a browser. The visual half of this story is that
  comparison and there is nothing to substitute for it.
- Applying the mapping at a call site is impossible without editing a component stylesheet beyond
  the four `font-weight` lines. That would mean the alias layer cannot carry the migration, which
  is the premise UX-DR9 and the whole two-commit split rest on, and choosing between editing
  component stylesheets and changing the plan is the Operator's call.
- A route stops answering 2xx, or `pnpm build` fails, and the only way to bring it back is to depart
  from the mapping.

**Never:**
- Never delete `--accent-glow`. `epics.md:1835` leaves it alone pending **O-11**, which is open.
  `DESIGN.md` § The mapping and `rebaseline-2026-08-15.md` § O-10 both say to delete it at step 2;
  the story's own acceptance criteria are the later and more specific instruction and they win.
- Never retarget `--confillia-normal` and never delete `--confillia-bold`. Both belong to the type
  swap (UX-DR12, `epics.md:2786-2790`), and the retarget is gated on **O-6**, which is open.
- Never replace a hardcoded `rgba()` or hex literal in a component stylesheet. Those are UX-DR10 and
  the Epic 2 redesign programme, not this step (AD-20: a migration step carries nothing else).
- Never change `--hero-height`. A viewport height is a layout constant and the contract carries none.
- Never edit `contracts/`, `packages/`, `public/`, `.github/`, `docker/`, `package.json` or
  `pnpm-lock.yaml`.
- Never weaken, skip or soft-fail a CI gate, and never add `continue-on-error` (AD-21).
- Never widen the screenshot capture, add a second baseline route, or raise `maxDiffPixelRatio`.
  One route at one viewport is Story 1-10's stated scope and this story inherits it knowingly.
- Never treat the Three.js scene's JS colours as in scope. Seam S-1, a declared exception
  (`epics.md:1860-1863`).

## I/O & Edge-Case Matrix

Every row is a named case one of the new or amended suites runs and reports by name.

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Aliases resolve to their roles | The built Hub, `:root` | Each aliased Hub property computes to exactly the same string as the token role it references, read in the same page, all of them, count pinned | A mismatch fails naming the property, the role, and both values |
| The three that must not move | The built Hub, `:root` | `--hero-height`, `--accent-glow`, `--confillia-normal` and `--confillia-bold` compute to the literals `app/app.scss` authors today | Any drift fails naming the property and both values |
| `--accent-dim` per call site | The fifteen call sites, on the routes that render them | Each computes to the role its Design Notes row assigns, read off the real element and compared against that role read through a probe in the same page | A site resolving to the other role fails naming the file, the line and the two values. A selector that matches nothing fails rather than passing |
| The alias trap | `.glitch-text__inner` on `/`, `.error-page__code` on the 404 surface, `.projects-hero__heading` on `/projects`, `.work-hero__heading` on `/work` | Computed `font-family` is `Bricolage Grotesque` and computed `font-weight` is `800` at all four | Family alone, green at weight `400`, is the exact failure this row exists to catch, so both are asserted and the weight is set first |
| Body ground and body copy | The built Hub at `/cv`, where the base `body` rule paints | `background-color` equals the `--token-bg` value and `color` equals the `--token-text` value, and neither is `rgb(0, 0, 0)` or `rgb(255, 255, 255)` | This closes Story 1-17's deferred finding: `/cv` was rendered by no test and is the surface the base rule paints |
| Every route still renders | `/`, `/cv`, `/work`, `/projects`, `/recommendation`, `/celeste`, `/api/health` | Each answers 2xx | A non-2xx fails naming the route and the status, so NFR-2 is measured rather than assumed |
| The render changed on purpose | `pnpm test:e2e` in the pinned container | Green against the **regenerated** baseline, and the snapshot directory still holds exactly one PNG | A stray or second baseline fails. A red comparison after the regeneration is a defect, not a second refresh |
| Consumed by the alias layer only | Every `.scss`, `.ts`, `.tsx`, `.css` and `.js`-family file under `app/`, `components/`, `hooks/`, `content/` | Only `app/app.scss` references a name declared in `contracts/tokens.css`, every other scanned file references none, and the set of roles it references is pinned | A component stylesheet reaching for a role fails naming the file. The matcher is shown firing on planted controls in both shapes |

</intent-contract>

## Code Map

Gathered 2026-08-26 against `3e9bb25`, working tree clean, branch `dev`.

- `app/app.scss:3-32`: the sixteen `:root` custom properties. **This is the file the story edits**,
  and the alias layer plus the three scoped `--accent-dim` blocks land here. `:40-51` is the base
  `body` rule whose `var(--black-color)` and `var(--white-color)` become token values; `:53-60` is
  the `body#work, body#projects` pair that overrides the base background with a hardcoded `#0a000f`
  and stays untouched (UX-DR10).
- `app/scss/_index.scss:33-34`: the two `@use` lines Story 1-17 added. **Read-only**: the contract
  is already in the graph and this story consumes it.
- `contracts/tokens.css:26-38`: the twelve `--token-*` roles, the only namespace a consumer reads.
  `:41-43` the three `--f-*` families, `:58-62` the five `--w-*` weights, `:91` `--page-pad`.
  **Read-only, never edited.**
- `contracts/fonts.css:19,38,56`: the published weight ranges, `Bricolage Grotesque` **700 800**,
  `Geist` 300 600, `Geist Mono` 400. **This is why `--monument-regular` needs no hand-set weight**
  and `--monument-bold` does: see Design Notes.
- The four `--monument-bold` call sites, each of which gains one `font-weight` line:
  `components/molecules/GlitchText/glitch-text.scss:5` (already sets `font-weight: 700` at `:7`,
  which becomes `var(--w-black)`), `components/organisms/ErrorPage/error-page.scss:24`,
  `components/organisms/ProjectsHero/ProjectsHero.scss:19`,
  `components/organisms/WorkHero/WorkHero.scss:19`. The last three set family alone today.
- The fifteen `--accent-dim` call sites, counted 2026-08-26 by
  `git grep -o -- "var(--accent-dim)" -- components`: `hud-label.scss:8,14`;
  `WorkItem.scss:2,12,126,144`; `ProjectCard.scss:28,29,66`; `error-page.scss:58`;
  `HomeLayout.scss:121,154,234`; `ProjectsHero.scss:8`; `WorkHero.scss:8`. The three state pairs
  that decide the scoping are `WorkItem.scss:16-18` (`[data-open='true']::before` repaints the
  bar), `ProjectCard.scss:34-37` (`:hover` repaints `border-left-color`) and
  `error-page.scss:65-68` (same shape on the back link).
- `components/atoms/Container/Container.tsx:13-15`: sets `<body id={route}>` from the stripped,
  hyphenated pathname. **This is why `/cv` and `/recommendation` are the surfaces the base `body`
  rule paints**: `body#cv` matches none of `body#work, body#projects` (`app/app.scss:53-55`),
  `body[id='']` (`HomeLayout.scss:1-2`) or `#celeste` (`celeste.scss:1-2`).
- `tests/e2e/harness.ts:11,60-189`: `RENDERED_VIEWPORT`, `expectRouteScreenshot`,
  `computedStyleValue`, `rootCustomPropertyValue`. **The new spec imports these rather than reaching
  for Playwright directly** (`ops/rendered-output-harness.md:23-25`). All three throw rather than
  return an empty string. `:31-39` is the note this story is the subject of.
- `tests/e2e/contract-anchor.pw.ts:989-1047`: `the Hub renders the values it rendered before the
  contract was wired in`. **Its expectations are false after this story** (`body` colour, the
  `--black-color` and `--white-color` probe, the four pre-change literals) and it is the one test in
  that file this story amends. `:844-987` (faces) and `:499-843` (roles resolve) stay green
  untouched. `:1026-1038` is the probe pattern the new per-call-site reads follow.
- `app/__tests__/anchor-contract.test.ts:625-656`: `references no name the token contract declares,
  from any of them`, whose own failure message says a consumer "is Story 1-18's act and not this
  one's". **This is the case this story inverts.** `:658-699` (no scanned source names a published
  family) stays true and untouched, because the aliases reference `--f-*` roles rather than family
  names. `:496-553` (sixteen Hub properties, no name collision) stays true. `:554-624` is the scan
  and its guards, reused as-is.
- `tests/e2e/rendered-output.pw.ts:21,29,147-154`: `ROUTE = '/work'`, the snapshot name built from
  the viewport, and `keeps exactly one committed baseline`. **Not edited.** Its baseline PNG is
  regenerated.
- `tests/e2e/rendered-output.pw.ts-snapshots/work-360x800-chromium-linux.png`: sha256
  `27f22bb6ff78c62e019cc8f222665436b7a20c2445a90677bead375c7d763f97` at `3e9bb25`
  (`ops/rendered-output-harness.md:151`). **This story replaces it, once.**
- `playwright.config.ts:19,30,52,84-93`: port 3100, `maxDiffPixelRatio` 0.001,
  `updateSnapshots: 'none'`, `webServer` running `pnpm build && pnpm start`.
- `ops/rendered-output-harness.md:130-201,287-310`: the regeneration procedure with the exact
  `docker run` command at `:156-164`, the two tests that stand aside from an update run, and the
  inherited finding about the four weights.
- `ops/anchor-token-adoption.md`: Story 1-17's record, which already states what Story 1-18 does
  next. **This story appends its step-2 sections to that file rather than starting a new record.**
- `.github/workflows/ci.yml:10-29,179-220`: the blocking `test` job (`pnpm typecheck`,
  `pnpm test --run`) and the blocking `rendered-output` job (`pnpm test:e2e` in the pinned image).
  A new `*.pw.ts` file is gated with no workflow edit.
- `.lighthouserc.js:5-15`: accessibility asserted at 0.95, severity error, over `/`, `/work` and
  `/projects`. Every colour this story changes moves contrast **up**, which is recorded rather than
  assumed: `--gray-color` `#6b5f80` becomes `--token-border-interactive`, still short of 4.5:1 at
  its text call sites and better than what it replaces.
- Host, observed 2026-08-26: working tree clean at `3e9bb25`, branch `dev`, `pnpm` is not on PATH so
  every command is prefixed `corepack`.

## Tasks & Acceptance

**Execution:**
- `app/app.scss`: the alias layer. Redefine, in place and in the existing order,
  `--white-color: var(--token-text)`, `--black-color: var(--token-bg)`,
  `--light-gray-color: var(--token-text-secondary)`, `--gray-color: var(--token-border-interactive)`,
  `--accent: var(--token-accent)`, `--accent-dim: var(--token-accent-muted)`,
  `--page-padding: var(--page-pad)`, `--font-regular: var(--f-body)`, `--font-bold: var(--f-body)`,
  `--monument-regular: var(--f-display)`, `--monument-bold: var(--f-display)`,
  `--font-mono: var(--f-mono)`. Leave `--accent-glow`, `--hero-height`, `--confillia-normal` and
  `--confillia-bold` exactly as they are, each with a comment naming the open question or the reason
  (O-11, layout constant, O-6 and UX-DR12). Then the three scoped `--accent-dim` redefinitions that
  resolve the property per call site without touching a call site:
  `.work-item::before`, `.project-card` and `.error-page__back` take
  `var(--token-border-interactive)`, and `.project-card__tech li` takes `var(--token-accent-muted)`
  back, because it inherits from the card and is ornament. A comment block records that this alias
  layer is deliberate scaffolding UX-DR14 deletes, that the mapping's source is
  `epics.md:1821-1836`, and why three component selectors appear in a global file.
- `components/molecules/GlitchText/glitch-text.scss`,
  `components/organisms/ErrorPage/error-page.scss`,
  `components/organisms/ProjectsHero/ProjectsHero.scss`,
  `components/organisms/WorkHero/WorkHero.scss`: set `font-weight: var(--w-black)` alongside
  `font-family: var(--monument-bold)` at the four call sites, replacing the literal `700` at
  `glitch-text.scss:7`. This is the alias trap and the only edit any component stylesheet takes.
- `tests/e2e/anchor-aliases.pw.ts`: new. The browser half, one named test per matrix row it owns.
  Parses `app/app.scss` off disk for the sixteen declarations rather than restating them, derives
  the alias map from the file, and asserts each aliased property computes on `:root` to the same
  string as the role it names, read in the same page, with the count pinned at twelve and the four
  unaliased properties asserted to still hold their authored literals. Asserts the fifteen
  `--accent-dim` call sites one by one, each read on its real element by `computedStyleValue` for
  the property that call site declares and compared against the assigned role read through a probe
  in the same page, on whichever of `/`, `/work`, `/projects` and the 404 surface renders it, with
  the site list pinned at fifteen and derived from a table that carries the file, the line and the
  role. Asserts computed `font-family` and computed `font-weight` at the four `--monument-bold`
  sites, both, on their own routes. Asserts on `/cv` that `body` computes the `--token-bg` and
  `--token-text` values and neither pure black nor pure white. Sweeps the seven routes for a 2xx.
  Follows the `__dirname` and `REPO_ROOT` pattern of the existing contract specs, and carries a
  planted control for every predicate it introduces.
- `tests/e2e/contract-anchor.pw.ts`: amend the one test whose expectations this story falsifies,
  `the Hub renders the values it rendered before the contract was wired in`. It becomes the
  after-state of the same reads: `body` colour and the `--black-color` and `--white-color` probe
  now assert the token values rather than pure white and pure black, sourced from the roles rather
  than restated as literals, with the comment saying what changed and which story changed it. The
  rest of the file is untouched.
- `app/__tests__/anchor-contract.test.ts`: invert the consumer scan rather than delete it.
  `references no name the token contract declares, from any of them` becomes `is consumed by the
  alias layer in app/app.scss and by nothing else`: zero references from every scanned file except
  `app/app.scss`, and from `app/app.scss` exactly the pinned set of roles the mapping names, so both
  a component stylesheet reaching for a role and an alias silently retargeted fail. Keep both
  planted controls, keep the file-count and root guards, and add a case that reads the four
  properties this story must not move and asserts they are still authored as literals rather than as
  `var()` references.
- `ops/anchor-token-adoption.md`: append the step-2 sections. The mapping as applied, property by
  property, with the source of each row; the per-call-site `--accent-dim` table with the rule that
  decided each of the fifteen and the three scoped selectors; the four hand-set weights and why a
  family alias needed them; the four properties deliberately left alone with the open question that
  holds each; the baseline regeneration with the old and new sha256, the command that produced it
  and the case in `ops/rendered-output-harness.md` that makes it legitimate; the contrast direction
  of each colour change as an observation with its method; and Pending Operator actions.

**Acceptance Criteria:**
- Given `app/app.scss` declares sixteen custom properties consumed by fifteen component
  stylesheets, when each is redefined as a `var()` reference to a token role, then the mapping
  matches `epics.md:1821-1836` row for row, `--hero-height` stays local, `--accent-glow` is
  unchanged pending O-11, `--confillia-normal` and `--confillia-bold` are unchanged pending O-6, and
  `git diff 3e9bb25 -- components` touches nothing but the four `font-weight` lines, so every
  component stylesheet keeps working with no other edit.
- Given `--accent-dim` is doing two jobs across its fifteen call sites, when the aliases are
  written, then each of the fifteen resolves to the role its Design Notes row assigns, read on the
  real element in a real browser, and the four call sites in a state pair resolve to
  `--token-border-interactive` while the other eleven resolve to `--token-accent-muted`, so a single
  global alias cannot pass.
- Given `--monument-bold` encodes weight in a family name, when the aliases are written, then
  `glitch-text.scss`, `error-page.scss`, `ProjectsHero.scss` and `WorkHero.scss` set `font-weight`
  alongside `font-family` in this same commit, and all four call sites are read through the harness
  as computed `font-family: Bricolage Grotesque` and computed `font-weight: 800`, so the trap that
  is invisible to a screenshot and to a reading of the CSS is closed by a computed-value check.
- Given pure white and pure black are retired from the system, when the Hub is rendered at `/cv`
  where the base `body` rule paints, then `body` computes the `--token-bg` value as its background
  and the `--token-text` value as its colour, and neither is `rgb(0, 0, 0)` nor `rgb(255, 255, 255)`.
- Given NFR-2 binds every migration step, when the change ships, then `/`, `/cv`, `/work`,
  `/projects`, `/recommendation`, `/celeste` and `/api/health` all answer 2xx, `pnpm typecheck`,
  `pnpm test --run` and `pnpm build` are green, and `pnpm test:e2e` is green in
  `mcr.microsoft.com/playwright:v1.62.1-noble` against a baseline regenerated once by the documented
  update command, with the new PNG in this story's diff and exactly one committed baseline on disk.

## Spec Change Log

Four reconciliations made during implementation on 2026-08-26. Each is a place where two parts of
this spec could not both be satisfied, or where the spec asserted something the tree falsified.
All four are recorded in `ops/anchor-token-adoption.md` as well.

1. **The consumer scan allows one named exception, and the I/O matrix said it allowed none.**
   The matrix row "Consumed by the alias layer only" reads "Only `app/app.scss` references a name
   declared in `contracts/tokens.css`, every other scanned file references none". The Execution
   step requires `font-weight: var(--w-black)` at the four `--monument-bold` call sites, and
   `--w-black` is declared at `contracts/tokens.css:62`, so the two cannot both hold. The
   Execution step is the more specific instruction and wins. `app/__tests__/anchor-contract.test.ts`
   partitions the scan three ways instead of two: `app/app.scss` must reference exactly the ten
   roles the mapping names, the four named call sites exactly `--w-black`, every other scanned
   file none. The exception is pinned by file and by role, so a fifth file reaching for
   `--w-black`, or one of the four reaching for anything else, still fails.

2. **`tests/e2e/rendered-output.pw.ts` was edited, and the Code Map said it would not be.** Two of
   its capability tests carried the literals `MonumentExtended-Bold` and `"MonumentExtended-Bold"`,
   which this story retires, so leaving them would have left the blocking `rendered-output` job
   red against an acceptance criterion that requires it green. Both now read the expectation off a
   probe in the same page and assert the pair of shapes rather than the pair of literals. Nothing
   else in the file moved, and its baseline PNG was regenerated as planned.

3. **The body ground is read on the 404 surface, not on `/cv`.** The I/O matrix and the Code Map
   both put that read on `/cv`, inheriting the conclusion `ops/anchor-token-adoption.md` § "A
   second finding" reached by reading stylesheets rather than by rendering. `next.config.js:13-26`
   redirects `/cv` and `/recommendation` permanently to a PDF, so neither renders a Hub page at
   all and `page.goto('/cv')` rejects with "Download is starting". The 404 surface is the only
   place the base `body` rule paints, and the assertion is made there. The route sweep uses
   `page.request` rather than `page.goto` for the same reason, and pins the redirect pair so the
   fact stays visible.

4. **Two contrast ratios move down, and the Code Map said every colour moves up.** Measured
   2026-08-26 from the rasterised sRGB values: `--white-color` on the base body ground goes 21.00:1
   to 17.56:1 and `--light-gray-color` on `#0a000f` goes 10.14:1 to 7.12:1, both still far above
   4.5:1. Retiring pure white on pure black can only lower the maximum the gamut allows. The four
   values that were at or below a floor all move up, including `--accent` from 2.29:1 to 6.29:1
   and `--accent-dim`'s boundary uses from 1.11:1 to 3.54:1, across the 3:1 floor AD-19 asserts.
   The full table with its method is in `ops/anchor-token-adoption.md`.

## Review Triage Log

### 2026-08-26: Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 10: (high 0, medium 6, low 4)
- defer: 1: (high 0, medium 1, low 0)
- reject: 13: (high 0, medium 0, low 13)
- addressed_findings:
  - `[medium]` `[patch]` **`app/app.scss` was rewritten with LF endings against a CRLF blob**, so
    the whole file diffed as deleted and re-added: 172 changed lines for roughly fifty real ones,
    with the `*`, `body` and `body#work` blocks appearing as changes they are not. This is the one
    commit the two-story split exists to make reviewable. Converted back to CRLF, and the file's
    diff is now 67 insertions and 15 deletions. `tests/e2e/anchor-aliases.pw.ts` converted too, its
    two neighbours in the same directory being CRLF.
  - `[medium]` `[patch]` **The per-property mapping, which is the whole content of the first
    acceptance criterion, was pinned only as a set.** `ALIAS_ROLES` held ten roles and each of the
    twelve aliases was asserted to name *some* member through `toContain`, so swapping
    `--light-gray-color` and `--gray-color` onto each other's roles left the set unchanged and
    passed every gate in both halves. Replaced by a property-to-role `MAPPING` cited to
    `epics.md:1821-1836`, from which both lists are derived, asserted row by row. The swap was
    planted, confirmed failing by name, and reverted. The `--accent-dim` row's second role is
    pinned at source as well: the scoped blocks are parsed out of `app/app.scss` and required to
    carry `var(--token-border-interactive)` then `var(--token-accent-muted)`, all four selectors
    named.
  - `[medium]` `[patch]` **Both call-site tables were pinned against themselves.**
    `CALL_SITES.length` was compared to a literal in the same file and nothing read the component
    stylesheets, so a sixteenth `var(--accent-dim)` call site would silently take the ornament role
    and a fifth `var(--monument-bold)` one would silently lose its weight, with the suite green.
    `ops/anchor-token-adoption.md` claimed the opposite in its invalidation table. The counts are
    now derived by walking `components/` and counting per stylesheet, with planted controls on the
    counter, and the record's row is true as written.
  - `[medium]` `[patch]` **The `--monument-regular` alias was argued rather than measured.** Its
    three call sites request a weight below the display face's published `700 800` range and were
    said to clamp to 700, but nothing pinned that range and the record promises that a MINOR
    retune fails nothing here. A republish as `400 800` would drop two headings to 400 and 500 with
    every gate green: the alias equality compares `:root` token streams, `WEIGHT_SITES` never
    visits those three, and the screenshot covers neither `/projects` nor the 404. The range is now
    parsed out of `contracts/fonts.css` and its lower bound asserted above the heaviest weight the
    three request, and all three are read for the display family. No `font-weight` line was added
    to them: the criteria name four call sites, not seven.
  - `[medium]` `[patch]` **`probedFamily` in `tests/e2e/rendered-output.pw.ts` failed open.** With
    `var(--monument-bold)` unresolvable, the probe and the heading both fall back to the inherited
    body family and compare equal, so the capability test would be green while the display family
    reached no heading. It now proves the reference resolved against a probe of a name nothing
    declares.
  - `[medium]` `[patch]` **Three false statements in `tests/e2e/contract-anchor.pw.ts`**, all in
    comments this story wrote or amended: that the new spec renders `/cv` (it cannot, which is this
    story's own finding), the inherited claim that the base body background is visible on `/cv` and
    `/recommendation`, and the faces case's reasoning that nothing in the Hub sets a contract
    family, which the alias layer falsified. All three corrected in place.
  - `[low]` `[patch]` `rasterise` returned `no-2d-context` for every input when the page gave no 2D
    context, so the drift loop compared two identical sentinels and reached its verdict over a
    measurement that never happened. It throws now.
  - `[low]` `[patch]` The 404 guard asserted `background-image` is `none` under a message claiming
    it caught any override of the base body rule; a `background-color` override, which is the shape
    `body[id='']` and `#celeste` take, sets no image and passed it. Reworded to what it covers, with
    the `--token-bg` comparison named as what catches a colour-only override.
  - `[low]` `[patch]` Argument order in the partition `toEqual` put the pinned list in the received
    position and the tree in the expected one, backwards from every neighbouring assertion.
  - `[low]` `[patch]` Six corrections to `ops/anchor-token-adoption.md`: the stated revert is the
    whole commit rather than the two sources and the PNG, since reverting less leaves three test
    files demanding the alias layer and the tree red; `glitch-text.scss` recorded as a deliberate
    700 to 800 weight change the mapping assigns rather than as closing the trap, it being the one
    of the four that did not have it; a stated limit that `--gray-color` and `--accent-dim`'s
    boundary half now paint the same colour, retiring a distinction that existed before; a stated
    limit giving all four zero-call-site properties rather than the one previously named, for
    UX-DR14 to read; the weight table split into family and weight line numbers, which were cited
    inconsistently against the tests; and `next.config.js:12-24` corrected to `:13-26`.

**No loopback, and why.** Nothing was routed to `intent_gap` or `bad_spec`. Every finding is a
defect in an artifact this story wrote rather than in what it decided to build: re-deriving from a
corrected spec produces the same twelve aliases, the same three scoped blocks and the same four
hand-set weights. What changed is two pins made real, two fail-open guards closed, one premise
turned into a checked precondition, and six statements made true. Nothing inside
`<intent-contract>` was touched, and the render did not move: the regenerated baseline from the
implementation pass still matches, byte for byte, after every patch.

**One finding was deferred.** The visible ground on every route is still the cybercore `#0a000f`
literal, because the hardcoded values in the component stylesheets are UX-DR10 and the Epic 2
redesign rather than this step. It is real, it is not caused by this story, and it is the gap
between the user story's pixel surface and the alias layer's property surface, so it is recorded
rather than dropped.

Thirteen findings were rejected. The larger ones: that `tests/e2e/anchor-aliases.pw.ts` is
untracked and so ships nothing (the run's finalization commits it); that `inWideContext` builds a
context with no `baseURL` and cannot navigate (it read its row and the run was green, the `browser`
fixture inheriting the project's `use` options); that the aliases should carry `var()` fallbacks
such as `var(--token-text, #fff)` (that reinstates exactly the literals this story retires, and
`#fff` is one of the two the criteria name as retired); that the consumer scan should strip
comments before matching (Story 1-17 decided the opposite deliberately and stated why, a token name
in a comment being a consumer waiting to be uncommented); that `glitch-text.scss` moving 700 to 800
is an unrequested appearance change (`DESIGN.md` § The mapping assigns `--monument-bold` onto
`--f-display` plus `--w-black`, so it is the mapping, and it is now recorded as such); that the two
browser specs duplicate `probeRoleColours` and a pseudo-element read (Story 1-17 rejected the same
finding on two separate passes); that `normaliseQuotes` is orphaned in `contract-anchor.pw.ts` (it
is still used, over everything `app/app.scss` declares); that the literal hexes `#060509`, `#eeeef2`
and `#98979f` from the criteria should be pinned as values (a MINOR retune of a role must not fail
the Hub, which is why identity against the role is the pin and the parenthetical hexes are the
role's value today); that a contrast ratio should be computed from rendered pixels (Story 2.34 owns
the conformance gate, and the Lighthouse assertion this story leaves untouched is unchanged); and
four smaller shapes the generated contract and the parsed `:root` block cannot take.

### 2026-08-26: Review pass 2

- intent_gap: 0
- bad_spec: 0
- patch: 10: (high 0, medium 4, low 6)
- defer: 1: (high 0, medium 1, low 0)
- reject: 21: (high 0, medium 0, low 21)
- addressed_findings:
  - `[medium]` `[patch]` **`COMPONENT_STYLESHEETS` was keyed by basename and overwrote on
    collision**, which reopened the hole pass 1 closed. Two stylesheets sharing a file name in
    different directories collapsed into one, so one file's `var(--accent-dim)` and
    `var(--monument-bold)` call sites dropped out of the counts with nothing failing, and the only
    thing standing between that and a green suite was `expect(COMPONENT_STYLESHEETS.size).toBe(15)`.
    The collision is now refused where the map is built, naming the file. That literal 15 is gone
    with it: it conflated "stylesheets under `components/`" with "the fifteen consumers of the Hub's
    properties", two different fifteens, and it moved for any unrelated component added. The vacuity
    guard it was doing duty for is now non-empty plus a check that every file the three tables name
    was actually read off disk.
  - `[medium]` `[patch]` **"What moved in the frame" was incomplete, and it is the row a reader uses
    to decide whether the regenerated baseline is the intended render.** Two changes were missing.
    `--page-padding` maps onto `--page-pad`, `clamp(1.5rem, 4vw, 3rem)` to
    `clamp(1.25rem, 5vw, 4rem)`, so the gutter at its seven call sites goes 24px to 20px at the 360
    baseline and its ceiling rises from 3rem to 4rem above 1280px, the upper half of which one
    360-wide frame cannot see. And `--accent-dim` lost its alpha: it was
    `rgba(91, 33, 182, 0.22)` and both roles are opaque, so the tech chips at `WorkItem.scss:144`
    and `ProjectCard.scss:66` now paint a solid colour where they washed the ground behind them.
    Both recorded with their method.
  - `[medium]` `[patch]` **The invalidation row for a MINOR contract retune said "nothing here
    fails, by design", which this story is exactly what falsified.** Every assertion is still read
    from the role, but the committed baseline PNG is a restated pixel value, and before this commit
    the Hub painted cybercore literals so a retune moved nothing in the frame. After it,
    `--c-ink`, `--c-accent`, `--c-line-strong`, `--c-accent-quiet` and `--f-display` all reach
    `/work` against a `maxDiffPixelRatio` of 0.001, which is 288 of 288,000 pixels. The row now says
    the blocking `rendered-output` job fails, that this is new as of step 2, and which case of
    `ops/rendered-output-harness.md` the regeneration then falls under.
  - `[medium]` `[patch]` **The stale font preload was not recorded anywhere**, so the one artifact a
    later story reads would not have carried it. `ops/anchor-token-adoption.md` § "Stated limits of
    step 2" now names it with its method. The code change itself is out of this story's edit
    boundary and is deferred below.
  - `[low]` `[patch]` The four `font-weight` lines shifted every citation below them by one and the
    citations were not updated: `error-page.scss:58` to `:59`, `:65-68` to `:66-69`, `:39` to `:40`,
    `:47` to `:48`, `:28` to `:29`, and `ProjectsHero.scss:29` and `WorkHero.scss:29` to `:30`.
    These are the `at` labels printed in failure messages and the rows of the record's tables, so
    every one of them pointed a reader one line off. Corrected in `tests/e2e/anchor-aliases.pw.ts`,
    in Design Notes and in the record. The Code Map's copies are left alone: that section states
    the revision it was gathered against.
  - `[low]` `[patch]` The scoped-selector check was substring-satisfied. `.project-card` is a
    substring of `.project-card__tech li`, so `toContain('.project-card')` passed even with the card
    dropped out of the boundary block, which is the deletion that puts its two borders on the
    ornament role below the 3:1 floor AD-19 asserts. The selector lists are parsed now, compared as
    a set, with the parser shown firing on a control carrying exactly that containment.
  - `[low]` `[patch]` `callSitesOf` matched only the bare `var(--name)` form, so a call site
    authored `var(--accent-dim, #fff)` escaped the table and took the `:root` ornament role in
    silence. The fallback form counts now, the name is still bounded so `--accent-dimmer` does not
    match, and a control for the fallback form sits beside the other three.
  - `[low]` `[patch]` `rasterise` reported `unparsed-by-canvas` for any value that was another
    spelling of its single `#123456` sentinel, which is a measurement it never made. Two sentinels
    now: a value can equal one, never both.
  - `[low]` `[patch]` Two stale citations: `next.config.js:12-24` in Spec Change Log item 3, which
    the previous pass corrected in the record but not here, and `app/app.scss:55-58` in the record's
    Stated limits, a pre-change citation for a block that sits at `:105-111` in the file the record
    describes.
  - `[low]` `[patch]` Step 2's Pending Operator action 8 pointed at "action 3 above" and at the step
    1 sections, which sit **below** the step 2 block in the file rather than above it. The reference
    now says where to find it.

**No loopback, and why.** Nothing was routed to `intent_gap` or `bad_spec`. Every patch is a defect
in an artifact this story wrote, not in what it decided to build, and nothing inside
`<intent-contract>` was touched. The render did not move: the regenerated baseline is byte-identical
at `4203ecca...` after every patch, and `pnpm test:e2e` is green against it.

**One finding was deferred.** The retired display face is still preloaded. It is caused by this
commit and it is outside this commit's stated edit boundary, so it is recorded rather than fixed.

Twenty-one findings were rejected. The larger ones: that acceptance criterion 4 and its matrix row
still name `/cv`, a route this story proved cannot render (the row's own parenthetical, "where the
base `body` rule paints", leaves exactly one reading, which is what was implemented and what Spec
Change Log item 3 records, and `<intent-contract>` is frozen); that a Hub-level
`--monument-bold-weight` would have kept `app/app.scss` the only contract consumer (the Execution
step names `font-weight: var(--w-black)` at four call sites, so this is a redesign of a decided
thing); that the property-to-role mapping is pinned in only one place and that place never runs a
browser (true, and it is the source-text surface, which is the only surface a swap is visible at:
`var()` substitution makes the browser comparison identity by construction); that the alias equality
could pass vacuously on two empty reads (the reads throw rather than return empty, and every aliased
role is asserted declared in `contracts/tokens.css` before any of them run); that no accessibility
run was recorded (Lighthouse is not a job in `.github/workflows/ci.yml`, and the contrast direction
of every colour is recorded as a measurement with its method); that the route sweep proves routes
answer rather than render (which is what the matrix row says, and `page.request` is Spec Change Log
item 3's recorded reason); that parsing helpers are triplicated across the three suites (Story 1-17
rejected this shape on two separate passes); that `publishedWeightRange` reads only the first
`@font-face` per family and that `expect(declared).toMatch(/"/)` restates a shape (a shape
assertion is what the previous pass asked for, and `contracts/` is read-only here); that the scoped
blocks are order-pinned and the wide-context row is read under a different colour scheme (both sides
of that comparison are read in the same context); that `--font-bold` is aliased while
`--accent-glow` is not (both are direct instructions from the criteria); and six smaller shapes.

### 2026-08-26: Review pass 3

- intent_gap: 0
- bad_spec: 0
- patch: 7: (high 0, medium 4, low 3)
- defer: 3: (high 0, medium 1, low 2)
- reject: 21: (high 0, medium 0, low 21)
- addressed_findings:
  - `[medium]` `[patch]` **`ops/rendered-output-harness.md` was never updated, and this commit
    falsified four standing statements in it while its sibling record was rewritten in full.** Two
    rows of § "What it deliberately does not assert yet" rested on `--font-mono: 'Courier New',
    monospace` and on the harness answering `MonumentExtended-Bold`; § "Regenerating the baseline"
    argued the Linux requirement from the same Courier New premise and named no current baseline
    hash, so a future regenerator read the section with `27f22bb6...` as the only sha256 in view;
    and § "The finding Story 1-18 inherits" sat open with two value rows describing a tree that no
    longer exists. Each is now either superseded in place with both dates kept or annotated as
    closed by this story, the current sha256 leads the regeneration section, and the dated
    2026-08-24 observations further down are left standing as history rather than rewritten. The
    `app/app.scss:53-60` citation for the `body#work` block is corrected to `:105-112` with the old
    range kept as the pre-change form.
  - `[medium]` `[patch]` **The record's orphaned-face inventory was under-reported by seven.**
    § "Stated limits of step 2" named only `MonumentExtended-Bold`, because that is the one with a
    preload behind it. Aliasing `--font-regular` and `--font-bold` onto `--f-body` retired the five
    GeneralSans faces at the same moment, and `--monument-regular` retired two more, so eight
    `@font-face` declarations at `app/scss/_fonts.scss:20,30,40,50,60,72,82,92` are now resolved by
    nothing. That count and the `public/fonts/` payload behind it are what the story that retires
    the local faces inherits, so the record carries the full inventory with its method.
  - `[medium]` `[patch]` **"What moved in the frame" still omitted the two largest changes**, having
    already been corrected once for the gutter and the alpha. `--font-regular` moved the whole body
    face from the local `GeneralSans-Regular` to `Geist` at every text node on every route, and
    `--font-mono` moved from `'Courier New', monospace` to `Geist Mono` at ten call sites, five of
    them inside the baselined frame. This is the row a reader uses to decide whether the
    regenerated baseline is the intended render, and a whole-site face change was missing from it.
    Both recorded, with the note that the mono swap is what closes the harness limit about
    `.work-hero__meta` being baselined against a fallback face no visitor sees.
  - `[medium]` `[patch]` **The contrast table omitted the one pair this story pushes across a
    floor.** Every row measured a value against the page ground, which is the right question for
    six of them and the wrong one for the tech chip: `--accent-dim` lost its `0.22` alpha to two
    opaque roles, so the label at `ProjectCard.scss:66` and `WorkItem.scss:144` now reads against
    the chip fill rather than through it, falling from 9.16:1 to 2.56:1 across the 4.5:1 text
    floor. The table said "two ratios move down and neither is a regression against a floor", which
    was true only because the pair was not in it. Added with its method, both figures derived from
    values this record already measured, and raised as Pending Operator action 9 because no fix is
    available inside a story whose mapping is to be followed rather than invented. The regression
    itself is deferred below.
  - `[low]` `[patch]` Two stale citations pass 2 corrected in the record but not in the spec:
    Design Notes § "What this story does not fix" still cited `error-page.scss:...,28` for a line
    the four `font-weight` insertions moved to `:29`, and `app/app.scss:55-58` for a block that
    sits at `:105-111`. The record's own § "The contrast direction" carried the third copy of the
    same pre-change citation, `app/app.scss:55`, and is corrected to `:107`.
  - `[low]` `[patch]` The invalidation row for a new `--accent-dim` call site promised more reach
    than the counter has. `callSitesOf` walks `components/` and only `components/`, so a call site
    added under `app/`, `hooks/` or `content/` would take the `:root` ornament role in silence
    while the row claimed it "fails naming the file it appeared in". All three call-site sets live
    under `components/` today, verified by `git grep` over the four scanned roots, so the row now
    promises `components/` and states why the Vitest consumer scan does not close the gap either.
  - `[low]` `[patch]` The record's verification-run row reported counts from a tree two review
    passes old, having been written before pass 2 patched seven files. Re-run on the final tree in
    the pinned container: **39 passed**, green against the same baseline, still
    `sha256:4203ecca...` with one PNG in the directory. The row now carries all three runs and
    names which tree the last one was made against.

**No loopback, and why.** Nothing was routed to `intent_gap` or `bad_spec`, and nothing inside
`<intent-contract>` was touched. Every patch is a defect in a record this story wrote or falsified,
not in what it decided to build: no source file, no test file and no baseline byte moved in this
pass, which the re-run confirms. The shape of this pass differs from the first two: they hardened
the assertions, and what was left is the second ops record, which the story had been treating as
someone else's file while changing the premises three of its sections rest on.

**Three findings were deferred.** The tech chip label at 2.56:1 is a real accessibility regression
caused by this commit, and every route to a fix is closed to a story whose contract says to follow
the mapping rather than invent one and limits its source edits to `app/app.scss` and four
`font-weight` lines. The eight orphaned `@font-face` declarations and the now-false comment on the
two `@use` lines at `app/scss/_index.scss:29-32` are the same shape as the preload deferred in pass
2: caused here, outside the edit boundary, recorded rather than dropped.

Twenty-one findings were rejected. The larger ones: that the two new `deferred-work.md` ledger
entries are truncated mid-word (real, and that file is the orchestrator's to own; this run does not
write it); that `app/scss/_print.scss:9-10` still hardcodes `#fff` and `#000` against a criterion
retiring both (a print stylesheet on paper, and pre-existing); that nothing reads `font-family` on
a real element for the body and mono faces the way it does for the display face (the criteria name
four call sites and the aliases are pinned row by row at the source-text surface); that the
`--monument-regular` clamp is still an inference rather than a rendered measurement (pass 1 turned
it into a checked precondition, which is what was asked for); that `normaliseQuotes`'s remaining
guard will fail when UX-DR12 moves the Confillia pair (a future story's tree); that
`expect(declared).toMatch(/"/)` pins the contract's quoting style, that the mapping is pinned at
only one surface, that the route sweep proves answering rather than rendering, that a Hub-level
weight property would have kept one consumer, and that parsing helpers are triplicated (all five
rejected on an earlier pass, on the same reasoning); that acceptance criterion 4 still names `/cv`
(frozen contract, rejected twice); that contrast should be gated in CI rather than recorded (Story
2.34 owns the conformance gate, and action 9 now carries the one number that matters); that
`--f-mono` publishes 400 while `WorkItem.scss:90` asks for 600 (synthetic bold before and after,
and the family swap is now in the frame row); that a chip fill of `--token-bg-raised` should just
be written here (that is the invented mapping the contract forbids, which is why it is action 9);
that the pixel-versus-property surface gap is unaddressed (it is this story's first deferred
finding); that `rendered-output.pw.ts` was edited against the "only other source edits" bullet
(Spec Change Log item 2); that the baseline PNG is invisible in a text diff (it is in the commit,
and its hash and pixel delta are recorded in two files); and four smaller shapes.

## Design Notes

**The mechanism that makes "per call site" possible without editing a call site.** A custom
property is inherited and can be redeclared on any selector, so `--accent-dim` is declared once on
`:root` as the ornament role and redeclared on the three selectors where it is a boundary. Every
call site still reads `var(--accent-dim)` and no component stylesheet changes. That is what
reconciles `epics.md:1831-1834` ("resolved per call site across its fifteen") with `:1836` ("every
one of the fifteen component stylesheets keeps working with no edit"), which otherwise read as
contradictory. The counter-scope on `.project-card__tech li` is needed because a chip inherits from
the card it sits in.

```scss
:root { --accent-dim: var(--token-accent-muted); }        // ornament, 11 of 15
.work-item::before,                                        // repainted at [data-open='true']
.project-card,                                             // border-left-color repainted on hover
.error-page__back { --accent-dim: var(--token-border-interactive); }
.project-card__tech li { --accent-dim: var(--token-accent-muted); }  // inherits the card, is ornament
```

**The fifteen, and the rule that decides each.** A site is a boundary a person reads state from when
some selector repaints that same property under `:hover`, `:focus-visible` or a data-state
attribute, or when it is the only visual indicator of a state. Everything else is ornament. Observed
2026-08-26 by reading each file.

| Call site | Declares | Verdict | Why |
|---|---|---|---|
| `hud-label.scss:8`, `:14` | `border-left`, `border-right` | ornament | A static rule beside a non-interactive label. Nothing repaints it |
| `WorkItem.scss:2` | `border-bottom` | ornament | A separator between rows. The control inside carries its own hover background and focus outline |
| `WorkItem.scss:12` | `background` of `::before` | **boundary** | `:16-18` repaints it `var(--accent)` at `[data-open='true']`. It is the only indicator of open or closed |
| `WorkItem.scss:126` | `color` of a `//` glyph | ornament | A decorative list marker, `::before` content, duplicated by nothing |
| `WorkItem.scss:144` | `background` of a tech chip | ornament | A fill |
| `ProjectCard.scss:28`, `:29` | `border`, `border-left` | **boundary** | `:34-37` repaints `border-left-color` on hover. Both edges of one box read as one boundary, so they take one value |
| `ProjectCard.scss:66` | `background` of a tech chip | ornament | A fill, counter-scoped back off the card |
| `error-page.scss:59` | `border-left` | **boundary** | `:66-69` repaints `border-left-color` on hover |
| `HomeLayout.scss:121`, `:154`, `:234` | `border-left`, `border-right` | ornament | The link's hover repaints its `color`, never this rule |
| `ProjectsHero.scss:8`, `WorkHero.scss:8` | `border-bottom` | ornament | A static section divider |

**Why `--monument-bold` needs a hand-set weight and `--monument-regular` does not.**
`contracts/fonts.css:19` publishes `Bricolage Grotesque` at `font-weight: 700 800`. Aliasing
`--monument-bold` to `--f-display` carries the family and drops the bold that lived in the name
`MonumentExtended-Bold`, so `font-weight: var(--w-black)` goes in beside it at all four sites, per
`DESIGN.md` § The mapping. `--monument-regular`'s three sites (`WorkItem.scss:52` and
`ProjectCard.scss:40` at `font-weight: 500`, `error-page.scss:40` at the initial `400`) request a
weight below the published range, which the variable face clamps to 700, which is exactly the
`--f-display` plus `--w-bold` the mapping assigns them. No hand edit, and the reason is written down
rather than left to look like an oversight.

**Four conflicts between planning documents, resolved here rather than rediscovered.**
`epics.md:1835` leaves `--accent-glow` alone pending O-11 while `DESIGN.md` § The mapping and
`rebaseline-2026-08-15.md` § O-10 both delete it at step 2; the story's own acceptance criteria are
the later and more specific instruction, so it stays, and it has zero call sites either way.
`epics.md:1827` says "the five font aliases" where six font-family properties exist; four are
aliased here and Confillia's two wait for the type swap and O-6 (`epics.md:2786-2790`), which is the
only reading that leaves both open questions open. `epics.md:1852-1853` describes
`--light-gray-color` as warm `#b3b0aa` becoming violet-tinted, which the cybercore rebrand already
made stale (`app/app.scss:7` reads `#b4b4cc`), and `rebaseline-2026-08-15.md:142-144` says so; the
mapping row itself is unaffected. `DESIGN.md` § Sequence step 2 also deletes `--confillia-bold`,
which `epics.md:2790` assigns to the type swap.

**What this story does not fix, deliberately.** The hardcoded `rgba()` literals in the component
stylesheets (`WorkItem.scss:35,145`, `ProjectCard.scss:27,36,67`, `error-page.scss:7,9-10,29`,
`app/app.scss:105-111`) keep their cybercore values. Their mapping is `rebaseline-2026-08-15.md`
§ O-10, and it lands in the Epic 2 redesign, not in step 2. So the site after this commit is the
token palette on the custom properties with a few literal violet surfaces still underneath, which is
the expected intermediate state, not a defect found in this story.

## Verification

**Commands:**
- `corepack pnpm typecheck`, expected: exit 0 with the new `.ts` file included.
- `corepack pnpm test --run`, expected: exit 0, the inverted consumer case green, and no
  pre-existing case moved except the ones this story deliberately amends.
- `corepack pnpm build`, expected: exit 0, all ten routes generated, the Sass compile resolving
  every `var()` in the alias layer.
- The `docker run` command at `ops/rendered-output-harness.md:156-164` with
  `pnpm run test:e2e:update`, run **once**, expected: the baseline rewritten, 2 tests skipped for
  the reason that file records, and the snapshot directory still holding exactly one PNG.
- The same command with `pnpm test:e2e` afterwards, expected: every spec green against the
  regenerated baseline, including all four weight reads and all fifteen `--accent-dim` reads.
- `Get-FileHash tests/e2e/rendered-output.pw.ts-snapshots/work-360x800-chromium-linux.png
  -Algorithm SHA256` before and after, expected: it moves, once, from
  `27f22bb6ff78c62e019cc8f222665436b7a20c2445a90677bead375c7d763f97` to the value recorded in
  `ops/anchor-token-adoption.md`.
- `git diff --stat 3e9bb25 -- components`, expected: exactly four files, one changed line each.
- `git diff --stat 3e9bb25 -- contracts packages public docker .github package.json pnpm-lock.yaml
  app/scss`, expected: empty.
- `git status --porcelain`, expected: empty at the closing commit.
- Punctuation sweep over every file written, run against a positive control carrying an em-dash, an
  en-dash used as a dash, a double-dash and an emoji, so it cannot pass vacuously.

**Manual checks:**
- None. The visual check the story is named for is the regenerated baseline read as a diff image,
  which the harness produces, plus the computed-value assertions that cover what a screenshot cannot
  see.

## Auto Run Result

Status: done

**Summary of the implemented change.** The story is unchanged in substance from the two passes
before it: `app/app.scss` redefines twelve of the Hub's sixteen custom properties as `var()`
references to token roles, leaves four alone as literals with the open question that holds each,
and carries three scoped `--accent-dim` blocks that resolve that one property per call site without
editing a call site. Four component stylesheets gain one `font-weight: var(--w-black)` line each.
The `/work` baseline PNG was regenerated once. This third pass was a follow-up review and changed
no source file, no test file and no baseline byte: it repaired the two `ops/` records and three
citations, and recorded three findings it could not fix inside the story's edit boundary.

**Files changed in this pass.**
- `ops/rendered-output-harness.md`: the sibling harness record, never updated by the first two
  passes. Four standing statements this commit falsified are superseded in place with both dates
  kept or annotated as closed; the current baseline sha256 now leads § "Regenerating the baseline";
  the `body#work` citation moves to `:105-112`. Dated 2026-08-24 observations are left as history.
- `ops/anchor-token-adoption.md`: the full orphaned-face inventory (eight, not one) and the stale
  `app/scss/_index.scss` comment added to § "Stated limits of step 2"; the body and mono family
  swaps added to "What moved in the frame"; the tech chip contrast pair added to the contrast table
  with its method and raised as Pending Operator action 9; the `--accent-dim` invalidation row
  narrowed to the tree its counter actually walks; the verification-run row re-observed against the
  final tree; one pre-change citation corrected.
- `spec-1-18-...md`: two stale citations in Design Notes, three new `deferred` entries, and the
  pass 3 triage log.

**Review findings breakdown.** 7 patched (high 0, medium 4, low 3), 3 deferred (high 0, medium 1,
low 2), 21 rejected (all low). 0 intent_gap, 0 bad_spec, so no loopback and nothing inside
`<intent-contract>` was touched.

**Follow-up review recommendation: true.** Patched this pass: high 0, medium 4, low 3. Score is
`3 x 4 + 1 x 3 = 15`, which is at or above 5.

**Verification performed**, all on 2026-08-26 against the final tree.
- `corepack pnpm typecheck`: exit 0, no output.
- `corepack pnpm test --run`: 26 files, **600 passed**, exit 0.
- `pnpm test:e2e` in `mcr.microsoft.com/playwright:v1.62.1-noble` by the documented `docker run`
  command: **39 passed** in 2.9m, green against the committed baseline. No update run was made in
  this pass and none was needed.
- `Get-FileHash` on the baseline: `4203eccab7a108cb2b9c9f0fd04106f85595145474c89c9c7c55139bb18d278f`,
  unchanged, and the snapshot directory holds exactly one PNG.
- Punctuation sweep over the three files written, run against a positive control carrying an
  em-dash, an en-dash, a double-dash and an emoji: the control fired on all four shapes, and every
  hit in the three files is a `git ... -- <pathspec>` separator inside a code span.
- `pnpm build` was not re-run in this pass. Only Markdown changed, and the same tree built inside
  the container's `webServer` for the e2e run above.

**Residual risks.**
- The chip label at 2.56:1 is below the 4.5:1 text floor on `/work` and `/projects`, both of which
  `.lighthouserc.js` asserts at 0.95 severity error. Lighthouse is not a job in
  `.github/workflows/ci.yml`, so nothing in CI will catch it. Pending Operator action 9.
- Nothing here has been rendered by the deployed container. Pending Operator action 5 remains the
  human half of a commit whose whole point is a change in appearance.
- The two new entries this story contributed to `_bmad-output/implementation-artifacts/deferred-work.md`
  are truncated mid-word in that file, and `DW-9`'s `reason` loses its closing clause and its
  pointer to `ops/anchor-token-adoption.md`. That ledger is the orchestrator's to own and this run
  did not write it; the untruncated text is in this spec's `deferred` frontmatter.
- `callSitesOf` walks `components/` only. That is where all three call-site sets live today, and
  the record now says so rather than promising the repository.

