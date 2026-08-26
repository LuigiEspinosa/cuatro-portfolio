---
title: 'Anchor migration step 2, alias the old names onto the token roles'
type: 'feature'
created: '2026-08-26'
status: 'in-progress'
baseline_commit: '3e9bb257b8b8f9bdf2878af6b28256948dc8fb90'
baseline_revision: '3e9bb257b8b8f9bdf2878af6b28256948dc8fb90'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/ops/rendered-output-harness.md'
  - '{project-root}/ops/anchor-token-adoption.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 1-17 put `contracts/tokens.css` and `contracts/fonts.css` into the Hub's
stylesheet graph and deliberately consumed none of it. `cuatro.dev` therefore still renders the
cybercore rebrand's hardcoded values while `cs-tracker.cuatro.dev` is about to render the
contract, and a Visitor moving between them does not see one product family. This is the second
and last of the Anchor's two migration commits (UX-DR9, FR-17), and the one that changes how the
site looks.

**Approach:** Redefine the Hub's own custom properties in `app/app.scss` as `var()` references to
the contract's semantic roles, following `DESIGN.md` § The mapping. The alias layer is what lets
fifteen component stylesheets keep working untouched while Epic 2 rebuilds them one at a time, so
the change lands in one file plus the small number of call sites that a family-only or
role-ambiguous alias would silently break: four `--monument-bold` sites that need `font-weight`
set by hand, and three `--accent-dim` sites where the property is a boundary a person reads state
from rather than ornament. The claim that the site changed and still works is carried by Story
1-10's harness: computed values read in a real browser, and a deliberately regenerated screenshot
baseline.

## Boundaries & Constraints

**Always:**
- The mapping is `DESIGN.md` § The mapping and `rebaseline-2026-08-15.md` § O-10, not an invented
  one. Every alias points at a `--token-*`, `--f-*`, `--w-*` or spacing role, never at a raw
  `--c-*` palette value: the palette is not consumed outside `contracts/` (AD-14).
- `--hero-height` stays local and keeps its literal `40vh`. A viewport height is a layout
  constant and the contract carries none.
- `--accent-dim` is decided **per call site across its fifteen**, not by one global alias. The
  rule that decides it is mechanical and must be stated in the record: a site is a boundary a
  person reads state from when a sibling rule rewrites that same property under `:hover`,
  `:focus-visible` or a state attribute. Everything else is ornament.
- The four live `--monument-bold` call sites (`glitch-text.scss:5`, `error-page.scss:24`,
  `ProjectsHero.scss:19`, `WorkHero.scss:19`) get `font-weight` set alongside `font-family` in
  this same commit, and are then asserted bold by reading computed `font-weight` in the browser.
  A family-only alias drops bold invisibly to a screenshot and to a reading of the CSS, which is
  the whole reason the check is a computed-value one.
- The screenshot baseline **is** regenerated here, deliberately and once, by the explicit
  `pnpm test:e2e:update` run inside `mcr.microsoft.com/playwright:v1.62.1-noble`. This story is
  the documented "when it is" case in `ops/rendered-output-harness.md`: the render is meant to
  move. The old and new sha256 are both recorded, and the snapshot directory still holds exactly
  one PNG.
- Every assertion Story 1-17 wrote that says "nothing consumes the contract" is now false by
  design and must be **replaced by the invariant that succeeds it**, never deleted into a gap.
  The successor invariant is that every contract reference under a shipped source root is either
  in `app/app.scss` or is one of the named per-call-site resolutions, enumerated in the test.
- Every new assertion carries its own vacuous-pass guard, in the shape the two 1-17 suites
  already use: counts pinned rather than bounded, name lists asserted non-empty with a known
  member, planted positive and negative controls that call the same named predicate the assertion
  beside them calls.
- Colour equality is asserted through the browser's own parser rather than against a hex literal.
  The build downlevels every `oklch()` to a `#rrggbb` sRGB fallback plus a `lab()` override
  (recorded in `ops/anchor-token-adoption.md` § "The finding"), so a text comparison against the
  authored value is wrong and a text comparison against the emitted value pins a minifier.
- Every value recorded under `ops/` is marked as a decision or an observation, and an observation
  carries the method that gathered it (NFR-9). Dates are ISO 8601 UTC.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash and
  no emoji. The commit is a subject line only, no body and no trailer.

**Block If:**
- The rendered-output harness cannot be run at all: Docker is unavailable, the pinned image
  cannot be pulled, or the container cannot start a browser. The baseline regeneration and the
  computed-value assertions are the whole of this story's evidence and there is nothing to
  substitute for them.
- A route stops rendering, `/api/health` stops answering, or the build fails, and the cause is
  not a defect in the aliases this story wrote. NFR-2 binds every migration step, and trading a
  live route for the identity is the Operator's call.

**Never:**
- Never rewrite a component stylesheet's colour, spacing or type literals. The cybercore
  hardcoded values (`#0a000f`, `rgba(140, 90, 210, 0.06)`, `rgba(91, 33, 182, 0.06)`,
  `rgba(91, 33, 182, 0.3)`, `error-page.scss:28`, ScanlineOverlay's blacks, `celeste.scss`) are
  Stories 2.27 to 2.34. AD-20 forbids a migration step carrying anything else.
- Never delete `--confillia-bold`, and never retarget `--confillia-normal` to `--f-display` at
  `wdth 75`. Story 2.20's acceptance criteria own both, and O-6 (does the substitute read
  acceptably) is still open.
- Never edit `contracts/`, `packages/`, `public/`, `docker/`, `package.json` or `pnpm-lock.yaml`.
  The contract is published, served and gated; this story consumes it.
- Never weaken, skip or soft-fail a CI gate, and never add `continue-on-error` (AD-21). In
  particular, never lower `maxDiffPixelRatio` or set `updateSnapshots` to anything but `none` in
  the committed config.
- Never touch the Three.js narrative's JS colour values. Seam S-1 is a declared FR-17 exception
  and is out of scope here, not a defect found here.
- Never add a Tailwind import. The Anchor is SCSS and consumes the plain pair (AD-14).

## I/O & Edge-Case Matrix

Every row is a named case one of the suites runs and reports by name.

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Every alias points at a role | `app/app.scss` parsed | Each of the Hub's fifteen properties except `--hero-height` and `--confillia-bold` is a `var(--<role>)` reference; every referenced name is declared by `contracts/tokens.css`; none is a `--c-*` palette name | A literal value, an undeclared target or a palette target fails naming the property and its value |
| The mapping is the decided one | `app/app.scss` parsed | The alias targets equal the pinned table derived from `DESIGN.md` § The mapping, all fifteen rows compared | A drifted target fails naming the property, the expected role and the read one |
| `--accent-glow` is gone | `app/app.scss` and a repository-wide search | The property is not declared and is referenced nowhere | A surviving declaration or a call site fails naming it |
| Ground and copy left pure black and pure white | The built Hub at `/cv` and `/work` | `body` computes `background-color` equal to `--token-bg` on `/cv` and `color` equal to `--token-text` on both, both canonicalised through the browser, and neither is `rgb(0, 0, 0)` or `rgb(255, 255, 255)` | A value that still reads pure fails naming the route, the property and both readings |
| Bold survives the family alias | The built Hub at `/work`, `/projects` and the 404 | All four `--monument-bold` call sites compute `font-weight: 800` and a `font-family` whose first family is the contract's display family | A computed `400` fails naming the selector and the route, which is the alias trap firing |
| The display face actually loads | The built Hub | The contract's display family reports `loaded` through `document.fonts`, and its `url()` answers 200 as `font/woff2` with a `wOF2` body | A face still `unloaded` fails, because an alias nothing renders is not an adoption |
| Ornament and boundary are separated | `components/**/*.scss` parsed | Exactly three call sites reference `--token-border-interactive` directly, and they are the three where a sibling rule rewrites the same property under a state selector; the other twelve still read `var(--accent-dim)` | A fourth direct reference, or a state-bearing site left on the ornament alias, fails naming the file and line |
| The render moved, once, on purpose | `pnpm test:e2e` in the pinned container | Green against the **regenerated** baseline, which differs from `27f22bb6...` and is the only PNG in the snapshot directory | A run that still matches the old baseline means the aliases did not land and fails as such |
| Every route still renders | The built Hub | `/`, `/cv`, `/work`, `/projects`, `/recommendation`, `/celeste` answer 200 and `/api/health` answers its documented shape | A non-2xx fails naming the route, and is an NFR-2 Block If candidate |

</intent-contract>

## Code Map

Gathered 2026-08-26 against `3e9bb25`, working tree clean, branch `dev`.

- `app/app.scss:3-32`: the sixteen `:root` custom properties. **This is the file the story is
  about.** `:40-51` is the `body` rule whose `background: var(--black-color)` and
  `color: var(--white-color)` are the ground and copy AC3 is written against. `:53-60` is
  `body#work, body#projects`, a hardcoded `#0a000f` plus a violet grid that **stays**, being
  Story 2.29 and Story 2.34's work: it is why the base `body` background is not observable on
  `/work`.
- `app/scss/_index.scss:33-34`: Story 1-17's two `@use` lines. **Read-only.** Its 32-line comment
  says "Story 1-18 redefines the Hub's sixteen existing custom properties"; that sentence is now
  history and is the one line worth updating.
- `contracts/tokens.css:26-38`: the twelve `--token-*` roles, the only colour names a consumer
  may read. `:40-43` `--f-display`, `--f-body`, `--f-mono`. `:57-62` `--w-light` through
  `--w-black`. `:91` `--page-pad: clamp(1.25rem, 5vw, 4rem)`, against the Hub's current
  `clamp(1.5rem, 4vw, 3rem)`. **Read-only.**
- `contracts/fonts.css:16-28`: `"Bricolage Grotesque"`, `font-weight: 700 800`,
  `font-stretch: 75% 100%`. **`--w-black` (800) and `--w-bold` (700) are both inside its range and
  `wdth 75` is reachable, which is what makes Story 2.20's later retarget possible.** `:35-46`
  Geist at `300 600`; `--w-bold` is 700 and therefore **outside** it, which matters for
  `--font-bold` and does not bite, because `--font-bold` has zero call sites. `:53-64` Geist Mono
  at `400` only, while `WorkItem.scss:90` asks for 600, so that one site synthesises.
- The fifteen `--accent-dim` call sites, all of them, with the classification this story applies:
  - **Boundary (3)**, each with a sibling rule rewriting the same property under a state
    selector: `components/atoms/WorkItem/WorkItem.scss:12` (`&[data-open='true']::before` at
    `:16-18`), `components/molecules/ProjectCard/ProjectCard.scss:29` (`&:hover
    border-left-color` at `:34-37`), `components/organisms/ErrorPage/error-page.scss:58`
    (`&:hover border-left-color` at `:65-68`).
  - **Ornament (12)**: `WorkItem.scss:2,126,144`, `ProjectCard.scss:28,66`,
    `components/atoms/HudLabel/hud-label.scss:8,14`,
    `components/organisms/HomeLayout/HomeLayout.scss:121,154,234`,
    `components/organisms/ProjectsHero/ProjectsHero.scss:8`,
    `components/organisms/WorkHero/WorkHero.scss:8`.
  - `WorkItem.scss:126` is the one site where the property carries **text**: a decorative `//`
    marker in a `::before`. It stays on the ornament alias and the choice is recorded, because
    the contract bars a decorative role from a meaning-bearing boundary and this glyph carries no
    meaning the list item's own text does not.
- The four live `--monument-bold` call sites: `components/molecules/GlitchText/glitch-text.scss:5`
  (**already carries `font-weight: 700` at `:7`**, which becomes `var(--w-black)`),
  `components/organisms/ErrorPage/error-page.scss:24`,
  `components/organisms/ProjectsHero/ProjectsHero.scss:19`,
  `components/organisms/WorkHero/WorkHero.scss:19` (the last three set family alone today, so
  their computed weight is `400` before and after a family-only alias, which is the trap).
- `components/organisms/HomeLayout/HomeLayout.scss:117,148`: the two live `--confillia-normal`
  call sites. **They move to the display family here and gain `wdth 75` at Story 2.20**, which is
  where O-6 is closed.
- Call-site counts, observed 2026-08-26 by grep over `app/**/*.scss` and `components/**/*.scss`:
  `--accent` 21, `--accent-dim` 15, `--light-gray-color` 15, `--font-mono` 10, `--page-padding` 7,
  `--font-regular` 6, `--gray-color` 5, `--monument-bold` 4, `--monument-regular` 3,
  `--confillia-normal` 2, `--white-color` 1 and `--black-color` 1 (both in `app/app.scss` itself),
  and **zero** for `--accent-glow`, `--confillia-bold`, `--font-bold` and `--hero-height`. No
  `.ts`, `.tsx` or `.js` source references any of them.
- `app/__tests__/anchor-contract.test.ts`: Story 1-17's source half. **Three of its four describe
  blocks survive; one is retired by this story.** `:127` `HUB_PROPERTY_COUNT = 16` becomes 15.
  `:495-547` the collision block stays true and stays. `:549-707` `nothing in the Anchor consumes
  the contract yet` is the block this story replaces. `:658-698` (no source names a published
  family) and `:709+` (no second authored copy) stay true and must survive the replacement.
  `:169-181` `gitLsFiles`, `:193` `withoutComments`, `:205` `DECLARATION`, `:312` `referenceTo`,
  `:290` `scannedUnder`: **reuse these rather than writing new parsers.**
- `tests/e2e/contract-anchor.pw.ts:989-1047`: `the Hub renders the values it rendered before the
  contract was wired in`, pinned to `rgb(255, 255, 255)`, `rgb(0, 0, 0)` and
  `'MonumentExtended-Bold'`. **This is the test this story inverts.** `:52-58` the `__dirname`
  and `REPO_ROOT` pattern, `:262` `TYPED_ROUTES` and the canvas-backed colour comparator, `:443`
  the comparator's own control: **reuse the comparator; do not write a second one.** Everything
  above `:989` (89 roles resolve, faces, fluid tokens, inlining) stays true and untouched.
- `tests/e2e/rendered-output.pw.ts:69,84`: Story 1-10's two capability assertions, pinned to
  `MonumentExtended-Bold` and `"MonumentExtended-Bold"`. **Both move to the contract's display
  family**, and `:29` builds the snapshot name from the viewport so the regenerated PNG keeps its
  name. `:147-154` `keeps exactly one committed baseline` must still pass after the update run.
- `tests/e2e/rendered-output.pw.ts-snapshots/work-360x800-chromium-linux.png`: the committed
  baseline, sha256 `27f22bb6ff78c62e019cc8f222665436b7a20c2445a90677bead375c7d763f97`
  (`ops/rendered-output-harness.md:151`). **Regenerated here, and the record's figure with it.**
- `tests/e2e/harness.ts:31-39`: a note written for this story, telling it to set the weight before
  reading it. `:60-189` the three helpers. **Read-only.**
- `ops/anchor-token-adoption.md`: the record Story 1-17 wrote. `§ "What Story 1-18 does next"` at
  `:314` is the section this story answers; `§ "A second finding"` at `:276` is the route table
  that says `/cv`, `/recommendation` and the 404 are the only surfaces the base `body` rule
  paints. **Extend this file rather than starting a new one.**
- `ops/rendered-output-harness.md:151` the baseline sha256, `:156-164` the exact `docker run`
  command with the two named volumes and `--ipc=host`, `:192-197` the "when it is not" rule that
  this story is the documented exception to. **Use that command verbatim, once with
  `test:e2e:update` and then again with `test:e2e`.**
- `.github/workflows/ci.yml:10-29` the blocking `test` job, `:179-220` the blocking
  `rendered-output` job in the pinned image. **No workflow edit is needed or permitted.**
- `AGENTS.md:35-40,86-101`: the pitfall lines this story retires or makes stale (the migration
  steps are `1-17` and `1-18`, not `1-18` and `1-19`; `--monument-bold`; `--accent-dim`;
  `--accent-glow`). **Do not edit the managed block**; a `bmad-project-context` refresh already
  owed before Epic 2 is where it lands, and this story records that it is now owed harder.
- Host, observed 2026-08-26: `docker version` server 29.7.2, `corepack pnpm` 10.31.0, `pnpm` not
  on PATH so every command is prefixed `corepack`.

## Tasks & Acceptance

**Execution:**
- `app/app.scss` -- replace the sixteen-property `:root` block with the fifteen-property alias
  layer -- this is the story. `--white-color: var(--token-text)`,
  `--black-color: var(--token-bg)`, `--light-gray-color: var(--token-text-secondary)`,
  `--gray-color: var(--token-border-interactive)`, `--accent: var(--token-accent)`,
  `--accent-dim: var(--token-accent-muted)`, `--page-padding: var(--page-pad)`,
  `--font-regular: var(--f-body)`, `--font-bold: var(--f-body)`,
  `--confillia-normal: var(--f-display)`, `--monument-regular: var(--f-display)`,
  `--monument-bold: var(--f-display)`, `--font-mono: var(--f-mono)`. `--hero-height: 40vh` stays
  literal, `--confillia-bold: 'Confillia'` stays literal with a comment naming Story 2.20 as its
  owner, and `--accent-glow` is deleted. A comment block states that this is the transitional
  alias layer Story 2.22 removes, that the weight half of the font mapping lives at the call
  sites because a family alias cannot carry it, and that O-11 is closed. Leave `:34-60` alone.
- `components/atoms/WorkItem/WorkItem.scss`, `components/molecules/ProjectCard/ProjectCard.scss`,
  `components/organisms/ErrorPage/error-page.scss` -- at `WorkItem.scss:12`,
  `ProjectCard.scss:29` and `error-page.scss:58` only, swap `var(--accent-dim)` for
  `var(--token-border-interactive)` with a one-line comment naming the state rule that makes each
  one a boundary -- these three are the boundary half of the per-call-site resolution, and a
  blanket ornament alias would drop them below AD-19's 3:1 floor. Change nothing else in these
  files except the weight below.
- `components/molecules/GlitchText/glitch-text.scss`,
  `components/organisms/ErrorPage/error-page.scss`,
  `components/organisms/ProjectsHero/ProjectsHero.scss`,
  `components/organisms/WorkHero/WorkHero.scss` -- add `font-weight: var(--w-black)` beside
  `font-family: var(--monument-bold)` at the four call sites, replacing `glitch-text.scss:7`'s
  existing literal `700` -- the alias trap. `--monument-bold` maps to `--f-display` **plus**
  `--w-black`, and the weight half cannot ride inside a family alias.
- `app/__tests__/anchor-contract.test.ts` -- retire the `nothing in the Anchor consumes the
  contract yet` describe block and put the alias layer's source-level invariants in its place,
  keeping the file's other three blocks, its parsers and its guards -- the retired invariant is
  exactly what this story spends. The replacement pins the fifteen-row mapping table derived from
  `DESIGN.md`, asserts every alias target is declared by the contract and is not a `--c-*`
  palette name, asserts `--accent-glow` is declared and referenced nowhere, asserts
  `--hero-height` is still the literal `40vh`, asserts `--confillia-bold` still holds its local
  family, and asserts that the only direct contract references under the four shipped source
  roots are `app/app.scss` plus exactly the three named boundary call sites. Move
  `HUB_PROPERTY_COUNT` to 15 and keep the collision block, which is still true and still
  load-bearing. Keep the published-family scan: after this story the Hub reaches the faces
  through `--f-*` and still names none of them literally.
- `tests/e2e/anchor-alias.pw.ts` -- new. The browser half. Reuses `harness.ts` and the
  comparator, controls and parsers already in `tests/e2e/contract-anchor.pw.ts` rather than
  duplicating them. One named test per matrix row it owns: every alias resolves on `:root` to the
  same canonicalised value as the role it points at; `body` on `/cv` computes the ground as
  `--token-bg` and not pure black, and `color` as `--token-text` and not pure white, with the
  reading repeated on `/work` for copy and the `/work` ground left as the `#0a000f` override it
  still is; the secondary text colour is the contract's muted role rather than the inherited
  `#b4b4cc`; all four `--monument-bold` call sites compute weight `800` and the contract's display
  family, each visited on the route that renders it; the display family reports `loaded` through
  `document.fonts` and its `url()` answers 200 with a `wOF2` body; and every route in AC4 answers
  200. Each colour claim is asserted in both directions, against the role and against the retired
  literal, so a comparator that silently agreed with everything cannot pass.
- `tests/e2e/contract-anchor.pw.ts` -- invert `the Hub renders the values it rendered before the
  contract was wired in` into the post-alias claim and leave the rest of the file alone -- the
  pre-change pins are now the thing that must not be true. `PRE_CHANGE_NAMES` becomes the alias
  set, the probe reads the roles rather than the literals, and the collision assertion at
  `:1044-1046` stays as it is, because the alias layer references contract names without
  declaring any.
- `tests/e2e/rendered-output.pw.ts` -- move the two capability assertions at `:69` and `:84` off
  `MonumentExtended-Bold` and onto the contract's display family, derived from
  `contracts/tokens.css` rather than restated -- Story 1-10's harness tests pin a value this
  story deliberately changes. Change nothing else: the ledger guard, the deliberately-shifted
  probe and `keeps exactly one committed baseline` all stay.
- `tests/e2e/rendered-output.pw.ts-snapshots/work-360x800-chromium-linux.png` -- regenerate, once,
  by the recorded `docker run` with `pnpm run test:e2e:update` -- this story is the documented
  case where a moved render is intended. Record both sha256 values.
- `ops/anchor-token-adoption.md` -- extend with step 2: the fifteen-row mapping as shipped, the
  per-call-site `--accent-dim` table with the rule that decided each of the fifteen, the weight
  half of the font mapping and where it lives, the measured contrast of every colour role against
  the ground it lands on with the method, the observations about Geist's `300 600` range against
  `--w-bold` and Geist Mono's single `400` against `WorkItem.scss:90`, the baseline's before and
  after sha256 with the command, what Story 2.20 and Story 2.22 do next, and Pending Operator
  actions -- the record is the artifact for every value a machine did not assert.
- `ops/rendered-output-harness.md` -- update the baseline sha256 at `:151` and add a dated line
  recording that Story 1-18 is the first intended regeneration and why -- the figure is quoted by
  two stories and a stale one is worse than none.

**Acceptance Criteria:**
- Given `app/app.scss` declared sixteen custom properties consumed by fifteen component
  stylesheets, when each is redefined as a `var()` reference to a token role per `DESIGN.md`
  § The mapping, then `--white-color`, `--black-color`, `--light-gray-color`, `--gray-color`,
  `--page-padding`, `--font-mono` and the five font aliases point at the mapped roles,
  `--hero-height` is still the literal `40vh`, `--accent` points at `--token-accent`, no alias
  points at a `--c-*` palette name, and `--accent-glow` no longer exists anywhere in the
  repository, O-11 having been closed on 2026-08-15 with the evidence this story re-verifies.
- Given `--accent-dim` was doing two jobs across fifteen call sites, when the resolution is
  applied, then exactly the three sites where a sibling rule rewrites the same property under a
  state selector read `var(--token-border-interactive)`, the other twelve still read
  `var(--accent-dim)` which resolves to `--token-accent-muted`, and the classification of all
  fifteen is recorded with the rule that decided it.
- Given the alias trap turns on a computed value rather than on a screenshot, when the aliases are
  written, then `glitch-text.scss:5`, `error-page.scss:24`, `ProjectsHero.scss:19` and
  `WorkHero.scss:19` carry `font-weight` beside `font-family`, all four compute `font-weight: 800`
  in a real browser through Story 1-10's harness, all four compute the contract's display family,
  and that family reports `loaded` through `document.fonts` so the adoption is rendered rather
  than merely declared.
- Given pure white and pure black are retired from the system, when the site is rendered, then
  `body` on `/cv` computes its ground as `--token-bg` and not `rgb(0, 0, 0)`, `body` computes its
  copy colour as `--token-text` and not `rgb(255, 255, 255)`, the secondary text role resolves to
  the contract's muted value rather than the inherited `#b4b4cc`, and every comparison is made
  against the role's own value canonicalised by the browser rather than against a hex literal
  this story typed.
- Given NFR-2 binds every migration step, when the change ships, then `pnpm typecheck`,
  `pnpm test --run` and `pnpm build` all exit 0, `pnpm test:e2e` is green in the pinned container
  against a baseline **regenerated once and on purpose** whose sha256 differs from
  `27f22bb6ff78c62e019cc8f222665436b7a20c2445a90677bead375c7d763f97` and which is the only PNG in
  the snapshot directory, and `/`, `/cv`, `/work`, `/projects`, `/recommendation`, `/celeste` and
  `/api/health` all still answer.
- Given the Three.js narrative's colours are JS values a custom property cannot reach, when FR-17
  is assessed, then the 3D scene is recorded as declared exception seam S-1 and is out of scope,
  and `git diff 3e9bb25 -- contracts packages public docker .github package.json pnpm-lock.yaml`
  is empty, so the story carried nothing but the migration step.

## Design Notes

**Why `--accent-glow` is deleted here although `epics.md:1835` says "left alone pending O-11".**
That clause is pre-closure wording. O-11 was closed on 2026-08-15 by the UX restyle pass, with
evidence, in three places: `DESIGN.md` § The mapping ("Delete at step 2"), `EXPERIENCE.md`'s open
items table (struck through, "Deleted at Story 1.18") and the pass's own decision log. The same
acceptance criterion opens by requiring the mapping to follow `DESIGN.md` § The mapping
**exactly**, which is the row that says dropped, and `epics.md:824` carries the same stale
"confirm before deleting" phrasing that the closure answered. The condition the clause makes the
deletion wait on is therefore met rather than pending, and this story re-verifies the evidence
itself: one occurrence in the repository, its own declaration, zero call sites in any `.scss`,
`.ts`, `.tsx` or `.js`. `--confillia-bold` is the opposite case and is left alone, because Story
2.20's own acceptance criteria claim its deletion by name alongside the `--confillia-normal`
retarget that O-6 still gates.

**The two-tier rule that decides `--accent-dim`.** "Ornament or boundary" is a judgement unless it
is given a mechanical test, and a judgement made once in an unattended run is a judgement nobody
can re-derive. The test used is: a call site is a boundary a person reads state from when a
sibling rule in the same stylesheet rewrites that same property under `:hover`, `:focus-visible`
or a state attribute. It selects three sites, each of which is genuinely the affordance carrying
the state change, and it is checkable by a test rather than by re-reading the CSS with fresh eyes.
Twelve static rules and separators stay on the ornament alias, which is the majority and is what
keeps twelve of the fifteen component stylesheets edit-free.

**Why the weight half of the font mapping lives at the call sites.** `--monument-bold` maps to
`--f-display` plus `--w-black`, and a custom property that holds a family cannot also hold a
weight. Three of the four call sites set family alone today and their computed weight is `400`
both before and after a family-only alias, so the regression is invisible to CSS review and to a
screenshot, which is exactly why `epics.md:1844` demands a computed-value assertion. The three
`--monument-regular` sites are deliberately not touched: Bricolage Grotesque declares
`font-weight: 700 800`, so a request for `400` or `500` clamps to `700`, which is `--w-bold` and
is the mapped target. That it lands by clamping rather than by declaration is an observation for
the record and a note for Story 2.20, not a reason to widen this story's diff.

**Why the baseline is regenerated, and why that is not the failure mode the harness guards
against.** `ops/rendered-output-harness.md` § "When it is not" says a red screenshot on a story
that intends no visual change is a finding rather than a baseline to refresh. This story intends
the visual change: it is the one commit in the migration whose whole purpose is that the site
looks different. The distinction is kept honest by recording both sha256 values and by asserting
the new one is different, so a regeneration that changed nothing would fail rather than pass
quietly.

**Why the 1-17 assertions are inverted rather than deleted.** "Nothing consumes the contract" was
Story 1-17's entire content and is now false. Deleting the block would leave a gap exactly where
the strongest evidence used to be. The successor invariant is narrower and stronger: contract
names are referenced from `app/app.scss` and from three named call sites, and from nowhere else.
That keeps the alias layer's shape asserted rather than assumed, which is what Story 2.22 will
need when it comes to delete it.

## Verification

**Commands:**
- `corepack pnpm typecheck` -- expected: exit 0.
- `corepack pnpm test --run` -- expected: exit 0, the anchor-contract suite's case count changed
  by the replacement block and no unrelated case moved.
- `corepack pnpm build` -- expected: exit 0, all ten routes generated, the Sass compile resolving
  both contract loads and every `url()`.
- The `docker run` at `ops/rendered-output-harness.md:156-164` verbatim, first with
  `pnpm run test:e2e:update` -- expected: the baseline rewritten, the two update-run tests
  skipped, the snapshot directory holding exactly one PNG.
- The same command with `pnpm test:e2e` -- expected: every spec green, including the regenerated
  `/work` comparison and every case in `tests/e2e/anchor-alias.pw.ts`.
- `Get-FileHash tests/e2e/rendered-output.pw.ts-snapshots/work-360x800-chromium-linux.png
  -Algorithm SHA256` before and after -- expected: `27f22bb6...` before, a different value after,
  and that value written into `ops/rendered-output-harness.md` and
  `ops/anchor-token-adoption.md`.
- `git diff --stat 3e9bb25 -- contracts packages public docker .github package.json
  pnpm-lock.yaml` -- expected: empty.
- `git grep -n -- '--accent-glow'` -- expected: no match outside `_bmad-output/` and `ops/`.
- `git status --porcelain` -- expected: empty at the closing commit.
- Punctuation sweep over every file written, run against a positive control carrying an em-dash,
  an en-dash used as a dash, a double-dash and an emoji, so it cannot pass vacuously.

**Manual checks:**
- Read the regenerated baseline PNG once and confirm the change is the intended one: violet-tinted
  paper rather than pure black, the contract's display face on the heading, and no missing glyph
  or collapsed layout. The comparison is a machine's job from the next run onward, but the first
  capture after a deliberate change is the one a person should look at, and `epics.md:1816` calls
  this the one commit in the migration worth a careful visual check.
