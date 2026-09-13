---
title: '`cs-tracker` adopts the token contract'
type: 'feature'
created: '2026-08-27'
status: 'awaiting-operator'
baseline_commit: '1b7cc1c41e002128ae0718c204047003991eda53'
baseline_revision: '1b7cc1c41e002128ae0718c204047003991eda53'
cs_tracker_baseline_revision: 'ff7667b86c4b9a65acc42c89982eaa29d022d2be'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/ops/daisyui-route.md'
  - '{project-root}/ops/tailwind-adapter.md'
warnings: ['oversized']
operator_actions:
  - 'Push the cs-tracker adoption commits 3f37cce, 8adb8e2 to origin/main and deploy them to cs-tracker.cuatro.dev by the runbook in that repository at docs/deployment.md, confirming the hostname serves through the deploy (NFR-2).'
  - 'After the deploy, read the twelve --token-* roles, the three --f-* families and the ten --t-* sizes off :root on https://cuatro.dev and on https://cs-tracker.cuatro.dev in one browser, and append that deployed-origin table beside the local one in ops/cs-tracker-token-adoption.md, since acceptance criterion 5 asks for both origins and nothing here is deployed.'
  - 'Look at both applications side by side on their own screens and confirm the family resemblance the measurement supports, watching in particular the --depth: 0 change, which removes daisyUI shadow and gradient overlay from every button, input and menu, and any surface the fixture never rendered.'
  - 'Evaluate seam S-8 during that same pass: if LiveView DOM patching visibly interrupts one of the surviving transitions, apply phx-update="ignore" to the affected container. The surviving transitions are enumerated in ops/cs-tracker-token-adoption.md.'
  - 'Decide whether --color-secondary should keep repeating the --token-bg-raised-2 ground, which is pending action 3 of ops/cs-tracker-token-adoption.md, before any surface in cs-tracker uses a secondary fill.'
  - 'Add ops/cs-tracker-adoption-probe.mjs and ops/daisyui-route-probe.mjs to AD-22 refresh scope together, and re-run both on any Tailwind or daisyUI bump reaching cs-tracker and on any contract MINOR, since no CI job runs either.'
deferred:
  - summary: >-
      Nothing that runs on a schedule or in a gate can see the token mapping stop resolving in
      `cs-tracker`, because that repository has no CI at all and the only instrument that reads
      rendered output is a hand-run probe in a different repository.
    evidence: |-
      Observed 2026-08-27. `cs-tracker` has no `.github` directory; `mix precommit` is its only gate,
      and every case in `test/cs_tracker_web/token_contract_test.exs` asserts against the text of
      `assets/css/app.css` rather than against a compiled or rendered stylesheet.
      `ops/cs-tracker-adoption-probe.mjs` is deliberately not a CI job, because it needs a browser
      and a checkout of the other repository and neither is on a runner. So a route-A regression
      that leaves the source text untouched, which is exactly the shape a Tailwind or daisyUI bump
      takes, ships with everything green. This is the standing shape of the verification rather than
      a defect this story introduced, and it is the reason both probes' re-run is handed to the
      Operator. It is recorded here because the estate now has two adopted applications and one
      un-gated hand-run check between them, which is a growing exposure rather than a fixed one.
    location: >-
      C:\CuatroEcosystem\cs-tracker-workspace\cs-tracker
    severity: medium
---

<intent-contract>

## Intent

**Problem:** `cs-tracker.cuatro.dev` renders in the warm-orange daisyUI palette Story 7.1 gave it,
while `cuatro.dev` has rendered from the token contract since Story 1-18. A Visitor moving between
them sees two products. This story is Epic 1's acceptance condition (FR-18, SM-6): the second
application, on a different framework, rendering from the same published contract.

**Approach:** Vendor `contracts/` into `cs-tracker` as `assets/css/cuatro-contracts/`, import the
generated Tailwind adapter (AD-14), map daisyUI's own colour family onto the token roles through
AD-15 route A, which `ops/daisyui-route.md` measured live, drop the light theme (seam S-7), and
apply the five hand-fix lines from `EXPERIENCE.md` § The hand-fix list. Prove the result by reading
computed values off `cs-tracker`'s real compiled stylesheet in a browser, beside the Hub's, rather
than by asserting that both files were imported.

## Boundaries & Constraints

**Always:**
- The vendored folder is named exactly `cuatro-contracts/`, sits inside `assets/css/`, and carries
  all three files plus `fonts/` (AD-14, `epics.md:1880-1886`). Every vendored file is a **byte-identical**
  copy of this repository's `contracts/`, asserted by sha256 per file, so AD-16's drift check has a
  target rather than a search. Nothing under the vendored folder is ever hand-edited.
- `cs-tracker` imports `cuatro-contracts/tailwind.css`, not the plain pair. AD-14 names it in bold
  among the Tailwind consumers, and `ops/daisyui-route.md` § "The fragment Story 1.19 applies"
  measured that the route resolves identically under either import.
- The daisyUI mapping is **AD-15 route A**: `--color-*: var(--token-*)` declarations inside the
  existing `@plugin "../vendor/daisyui-theme"` block. Route B is the recorded fallback and is not
  used. Source: `ops/daisyui-route.md` § "The answer".
- The five hand-fix lines are applied **in the order `EXPERIENCE.md:910-922` states**: `color-scheme: dark`
  on `:root` (S-11), `::selection` from the accent (S-12), the focus-ring rule copied from
  `EXPERIENCE.md` § Interaction Primitives → Focus (S-2), `border-radius: 0` on form controls (S-3),
  then the framework control defaults mapped onto the token roles (S-9).
- The focus rule is copied, not invented: `:focus-visible` only, `outline: var(--stroke-focus) solid
  var(--token-focus)`, `outline-offset: var(--focus-offset)`, never transitioned, never removed
  (`RESTYLE-SPEC.md:326-332`, `EXPERIENCE.md:711-723`).
- Seam S-7 is taken deliberately: the `light` theme block is **deleted**, not carried half way, and
  the three-state theme toggle plus the inline theme bootstrap script go with it, because a control
  that selects among themes that no longer exist is a broken surface rather than a preserved one.
- Every claim about what renders is a **computed value read in a real browser** off the stylesheet
  `cs-tracker`'s own pinned Tailwind 4.1.12 compiled. A reading of daisyUI's or Tailwind's source may
  explain a result and may never stand in for one.
- No assertion may pass vacuously: every parsed list asserts it is non-empty and carries a known
  member, every scan asserts it read a non-zero number of files, and every new matcher is shown
  firing on a planted control.
- Values recorded under `ops/` are marked as a **Decision** with its reason or an **Observation**
  with the method that gathered it (NFR-9), and dates are ISO 8601 UTC.
- `cs-tracker`'s own house rules hold: `mix format` clean, `mix compile --warnings-as-errors` clean,
  the `@import "tailwindcss" source(none)` plus three `@source` lines kept (`cs-tracker/AGENTS.md:31`),
  no `@apply` (`:32`), and no new inline `<script>` in a template (`:37`).
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash and no
  emoji. Each commit is a subject line only, no body and no trailer.

**Block If:**
- The vendored adapter cannot compile inside `cs-tracker`'s real `app.css`. `ops/daisyui-route.md`
  measured the composition against a scratch application with one theme; the real stylesheet is the
  thing this story compiles, and a failure there is the premise AD-14 and this whole step rest on.
- Route A stops resolving against `cs-tracker`'s real configuration (`themes: false`, its own theme
  block). `ops/daisyui-route.md` § Stated limits records that a **failed** mapping was never measured
  under `themes: false`, so a dead route here is a finding the Operator owns rather than one to work
  around by silently falling back to route B.
- No browser is available to read a computed value, or `cs-tracker`'s pinned Tailwind 4.1.12 binary
  cannot be located or run. The rendered half of this story is the acceptance, and there is nothing
  to substitute for it.

**Never:**
- Never restyle a component. Replacing daisyUI's component classes with token-driven markup is
  Story 8.1 under `RESTYLE-SPEC.md` § Family A. This story maps the theme layer and stops (AD-20: a
  migration step carries nothing else).
- Never edit anything under `contracts/`, `packages/`, `app/`, `public/`, `docker/` or `.github/` in
  this repository. The contract is published and this story consumes it.
- Never invent a token role. daisyUI's `--color-info`, `--color-success`, `--color-warning` and
  `--color-error` and their `-content` partners have **no** counterpart in `contracts/tokens.css`,
  so they keep their current values and that is recorded as a stated limit, not papered over.
- Never weaken, skip or soft-fail a gate in either repository, and never add `continue-on-error`
  (AD-21). Never make `ops/cs-tracker-adoption-probe.mjs` a CI job: like the daisyUI probe it needs a
  browser and a checkout of another repository, and neither is on a runner.
- Never push a commit to any remote, and never deploy. Both are Operator acts and both are enumerated
  under `operator_actions` instead.
- Never write `sprint-status.yaml`.

## I/O & Edge-Case Matrix

Every row is a named case one of the new suites runs and reports by name.

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| The folder is a verbatim copy | `contracts/**` against `cs-tracker/assets/css/cuatro-contracts/**` | Same file list and an equal sha256 for every one of the three stylesheets, the three woff2 faces and the three licence files | A differing or missing file fails naming it and both hashes. An empty file list fails rather than passing |
| It compiles at all | `cs-tracker`'s real `assets/css/app.css`, its own pinned Tailwind 4.1.12 | Exit 0 and a non-empty stylesheet | A CLI error is reported with its stderr and blocks, never swallowed |
| Route A resolves in the real stylesheet | `.btn.btn-primary` and `.badge.badge-primary` in the compiled output | Both compute the value `--token-accent` resolves to, read through a probe element in the same page, and neither computes daisyUI's own default | Equal to the daisyUI default, or unequal to the probe, fails naming the component and all three values |
| The whole daisyUI colour family | Every `--color-*` the theme block declares | Each contract-mapped name computes the value of the token role it is mapped onto, read in the same page, count pinned and derived from the file | A name resolving to a literal, or to the wrong role, fails naming it, the role and both values |
| No surface left on the previous theme | The compiled stylesheet's text | None of the eight Story 7.1 warm-neutral `oklch()` literals survives anywhere in it, and there is exactly one `@plugin "../vendor/daisyui-theme"` block | A surviving literal fails quoting it. Two theme blocks fail |
| Hand-fix 1, S-11 | `:root` in the rendered page | Computed `color-scheme` is `dark` | Anything else fails with what was read |
| Hand-fix 2, S-12 | The `::selection` rule in the compiled stylesheet, and its declared value | Background is the `--token-accent` value and foreground the `--token-bg` value, compared against probes in the same page | A missing rule fails. A rule carrying a literal fails |
| Hand-fix 3, S-2 | A focusable element under `:focus-visible` | `outline-width` is the `--stroke-focus` value, `outline-style` is `solid`, `outline-color` is the `--token-focus` value, `outline-offset` is the `--focus-offset` value, and no `transition-property` names `outline` | A ring that is absent, transitioned, or `outline: none` fails naming which |
| Hand-fix 4, S-3 | `input`, `select`, `textarea` and a `.btn` in the rendered page | Computed `border-radius` is `0px` on all four | A rounded control fails naming the element and the value |
| Type comes from the contract | `:root` and a `font-sans` element | `--f-body`, `--f-display` and `--f-mono` are declared, and the computed `font-family` of the shell resolves to the `Geist` stack rather than to Tailwind's default | A default stack fails naming both |
| FR-18 side by side | The twelve `--token-*` roles, the three `--f-*` families and the ten `--t-*` sizes, read off `:root` in the Hub's built stylesheet and in `cs-tracker`'s compiled stylesheet, in one browser | Every role is non-empty in both and equal across them, printed as a two-column table the record quotes | A missing or differing role fails naming the role and both values. A read that returns an empty string throws rather than comparing |
| The font faces resolve | The compiled stylesheet's `url()` values, and the copied `fonts/` directory beside the output | Each of the three woff2 files exists at the path the compiled stylesheet points at | A 404 path fails naming the face and the resolved path |
| Every route still renders | `mix compile --warnings-as-errors`, `mix format --check-formatted`, `mix test` | All green, and the LiveView suites still render every route | A red suite fails the story. NFR-2 is measured on the running application, not assumed |

</intent-contract>

## Code Map

Gathered 2026-08-27. `cuatro-portfolio` clean at `1b7cc1c`, branch `dev`.
`cs-tracker` clean at `ff7667b`, branch `main`, at `C:\CuatroEcosystem\cs-tracker-workspace\cs-tracker`.

**The source of truth being vendored (this repository, read-only):**
- `contracts/tokens.css:1-7` the `Contract v1.0.0` header AD-16's drift check reads; `:27-38` the
  twelve `--token-*` roles, the only namespace a consumer reads; `:41-43` `--f-*`; `:100` `--tap: 44px`;
  `:103-105` `--r-none/-hair/-pill`; `:108-112` `--stroke-*` and `--focus-offset`. **89 properties.**
- `contracts/tailwind.css:17-19` the fixed import order, `:21-94` the `@theme inline` block and its
  55 mappings, of which `--color-*` (12), `--font-*` (3), `--text-*` (10), `--radius-*` (3) matter here.
  `--stroke-*`, `--focus-offset`, `--dur-*`, `--ease-*` and `--z-*` are deliberately **not** mapped
  (`ops/tailwind-adapter.md:109-117`), so the focus rule reaches them as raw custom properties.
- `contracts/fonts.css` plus `contracts/fonts/` (three woff2, three OFL texts). Every `url()` is
  `./fonts/...` relative to `fonts.css`, and the CLI copies them through **unrebased**
  (`ops/tailwind-adapter.md:144-155`). That is what makes the fonts-copy task below necessary.
- `.gitattributes:35-37` forces `contracts/**/*.css|json|txt` to LF and deliberately leaves `.woff2`
  alone. `cs-tracker/.gitattributes:11` is `* text=auto eol=lf`, so a vendored copy keeps LF and git
  leaves the binaries alone. **The byte-identity assertion depends on both.**

**The finding this story applies (this repository, read-only):**
- `ops/daisyui-route.md:19-49` route A is live; `:246-303` the exact fragment and where it goes;
  `:321-337` the composition observation, including the `--color-accent` collision and the duplicated
  Preflight (2 emissions, 23,425 bytes against 18,173); `:339-355` the two supported placement routes
  for the compiled output; `:466-479` the stated limits, of which two bind here: only one theme was
  compiled, and **a failed mapping was never measured under `themes: false`**; `:480-491` the four
  Pending Operator actions, of which **3 and 4 are this story's to close**.

**The consumer (`cs-tracker`, written by this story):**
- `assets/css/app.css` **the one stylesheet this story edits.** `:4-7` the `@import "tailwindcss"
  source(none)` plus three `@source` lines that `cs-tracker/AGENTS.md:31` requires kept; `:14` the
  heroicons plugin; `:19-21` `@plugin "../vendor/daisyui" { themes: false }`; `:24-56` the `dark`
  theme block, 28 declarations, `default: false`, `prefersdark: true`; `:59-91` the `light` block,
  `default: true`, **deleted by this story**; `:94-97` the three `phx-*-loading` variants; `:100`
  the `dark` custom variant; `:103` the `data-phx-session` rule. The forty `oklch()` literals at
  `:33-52` and `:69-88` are the Story 7.1 palette this story retires.
- `assets/vendor/daisyui.js` version `5.0.35`; `:652` `.btn-primary` reaches `--color-primary`
  through `--btn-color`, `:559` `.badge-primary` through `--badge-color`. **Read-only**, and the two
  chains the probe reads.
- `config/config.exs:209-217` tailwind `4.1.12`, args `--input=assets/css/app.css
  --output=priv/static/assets/css/app.css`, `cd` the project root. `:199-206` esbuild `0.25.4`.
- `_build/tailwind-windows-x64.exe` **the pinned 4.1.12 binary already installed on this host**, which
  is the compiler the probe must use. No network fetch is needed.
- `mix.exs:101-110` the `assets.build`, `assets.deploy` and `precommit` aliases. **The fonts-copy task
  is inserted into the first two, before `phx.digest`**, because the digester rewrites `url()` values
  and needs the files present.
- `.gitignore:29` `/priv/static/assets/` is ignored, which is why the copied faces are a build step
  and not a commit.
- `lib/cs_tracker_web/components/layouts/root.html.heex:2` `<html lang="en">` takes `data-theme="dark"`;
  `:11-29` the inline theme bootstrap script, **deleted**; `:31-43` `<body>` and the offline banner,
  whose `bg-red-600` at `:37` is the repository's only Tailwind palette literal and stays (below).
- `lib/cs_tracker_web/components/layouts.ex:99` `<.theme_toggle />` and `:210-245` the component
  itself, **both deleted**; `:50` the shell's `bg-base-200 font-sans text-base-content`, which is what
  makes the whole application follow the theme variables; `:73` the `bg-primary text-primary-content`
  wordmark tile, the highest-contrast use of the primary pair.
- `lib/cs_tracker_web/components/core_components.ex:57-87` flash uses `alert-info` and `alert-error`;
  `:103-130` `button/1` maps to `btn-primary|ghost|soft|error`; `:148-163` `badge/1` maps to
  `badge-neutral|success|info|warning|error|primary`; `:182-191` `card/1`; `:258-370` `input/1` and
  its `input`, `select`, `textarea`, `checkbox` and `*-error` classes; `:430-466` `table table-zebra`;
  `:547-555` `loading-spinner`. **Read-only**: this is the class inventory the probe's fixture carries.
- `test/cs_tracker_web/live/app_shell_test.exs:47-54` `preserves the three-state theme toggle in the
  navbar`, the **one existing test this story falsifies**. `test/cs_tracker_web/components/core_components_test.exs:21,33,45,85,98,144,180-222`
  assert daisyUI class strings and stay green untouched, because no class name moves.
- `test/test_helper.exs:15-17` `exclude: [:live_endpoint]`, SQL sandbox manual. `mix.exs:100`
  `test: ["ecto.create --quiet", "ecto.migrate --quiet", "test"]`, so **the suite needs a Postgres**;
  none is listening on 5432 on this host, and `docker-compose.yml` carries a `db` service.

**Estate facts that bound the work:**
- `epics.md:1867-1925` the story; `:1904-1911` the hand-fix criterion. `EXPERIENCE.md:888-901` the
  seam table, `:910-922` the ordered hand-fix list, `:711-723` the focus block to copy verbatim.
  `ARCHITECTURE-SPINE.md:160-176` AD-14 and AD-16, `:166-170` AD-15.
- `RESTYLE-SPEC.md:726-746` Family A, which is Story 8.1's scope and therefore the boundary of this one.
- `epics.md:1955-1962` the manual 44x44 accessibility pass belongs to **Story 1.20**, not here.
- `_bmad-output/implementation-artifacts/deferred-work.md` **DW-1**: nothing under `contracts/`
  identifies the folder to a repository that vendors it. This story is the first real vendoring and
  therefore the first evidence for it, but the fix edits `contracts/` and is not this story's.

## Tasks & Acceptance

**Execution, in `cs-tracker` (`C:\CuatroEcosystem\cs-tracker-workspace\cs-tracker`):**
- `assets/css/cuatro-contracts/`: new. A byte-identical copy of this repository's `contracts/`:
  `tokens.css`, `fonts.css`, `tailwind.css`, `fonts/` with its three woff2 and three OFL texts.
  Copied, never authored, never edited afterwards.
- `assets/css/app.css`: the adoption. Add `@import "./cuatro-contracts/tailwind.css";` after the
  `@source` lines and before the `@plugin` lines, with a comment naming AD-14 and the fixed folder
  name, plus a `@source not` for the vendored folder so the existing `@source "../css"` does not
  scan a published contract for utility candidates. Keep the existing `@import "tailwindcss"
  source(none)` line: `cs-tracker/AGENTS.md:31` requires it and it is what keeps automatic source
  detection off, so the duplicated Preflight is absorbed deliberately and its measured cost recorded.
  Delete the whole `light` theme block. In the surviving `dark` block set `default: true` and map
  daisyUI's structural colour family onto the token roles with `var()` references, route A: the
  `base-100/200/300` grounds, `base-content`, the `primary`, `secondary`, `accent` and `neutral`
  pairs, `--border` onto `--stroke-boundary`, and the three radii onto `--r-none`. Leave the four
  status pairs (`info`, `success`, `warning`, `error`) at their current values with a comment saying
  the contract publishes no counterpart. Append the four hand-fix rules in `EXPERIENCE.md`'s order,
  each with the seam number it closes.
- `lib/cs_tracker_web/components/layouts/root.html.heex`: set `data-theme="dark"` on `<html>` and
  delete the inline theme bootstrap script, which exists only to switch among themes that no longer
  exist. Removing it also retires an inline `<script>` that `cs-tracker/AGENTS.md:37` forbids.
- `lib/cs_tracker_web/components/layouts.ex`: delete `theme_toggle/1` and its call site in
  `navbar-end`, and correct the `<%!-- right: ... --%>` comment that describes it.
- `lib/mix/tasks/cuatro.fonts.ex`: new. Copies `assets/css/cuatro-contracts/fonts/*.woff2` beside the
  compiled stylesheet at `priv/static/assets/css/fonts/`, because the CLI carries `fonts.css`'s
  `url()` values through unrebased and `cs-tracker` does not compile into the vendored folder. This
  is the second of the two routes `ops/tailwind-adapter.md:176-178` names. It reports what it copied,
  refuses silently copying nothing, and is idempotent.
- `mix.exs`: run the new task inside `assets.build` and inside `assets.deploy` **before** `phx.digest`,
  so the digester sees the faces and rewrites the compiled `url()` values onto their digested names.
- `test/cs_tracker_web/live/app_shell_test.exs`: replace the theme-toggle test with its after-state.
  The navbar carries no `[data-phx-theme]` control and no `phx:theme` script, and `<html>` carries
  `data-theme="dark"`, so S-7 is asserted rather than described.
- `test/cs_tracker_web/token_contract_test.exs`: new. The source-text half, inside `mix test`, which
  is the only gate this repository has. Asserts the vendored folder holds exactly the expected file
  list; that `cuatro-contracts/tokens.css` carries the `Contract v1.0.0` header AD-16 reads; that
  `app.css` imports the adapter by the fixed path and still carries the four lines
  `cs-tracker/AGENTS.md:31` requires; that exactly one `@plugin "../vendor/daisyui-theme"` block
  remains and it is `name: "dark"` with `default: true`; that each contract-mapped `--color-*` name is
  declared as a `var(--token-*)` or `var(--r-*)` or `var(--stroke-*)` reference rather than a literal,
  derived from the file rather than restated; that no Story 7.1 `oklch()` literal survives outside the
  four status pairs; and that the four hand-fix rules are present in `EXPERIENCE.md`'s order. Every
  parse asserts non-emptiness and is shown firing on a planted control.
- `test/mix/tasks/cuatro_fonts_test.exs`: new. The task copies all three faces, refuses an empty
  source, is idempotent, and reports a count rather than exiting 0 having copied nothing.

**Execution, in `cuatro-portfolio`:**
- `ops/cs-tracker-adoption-probe.mjs`: new, in the `ops/*.mjs` house style and following
  `ops/daisyui-route-probe.mjs`'s shape. Compiles `cs-tracker`'s **real** `assets/css/app.css` with
  `cs-tracker`'s **own** pinned Tailwind 4.1.12 binary out of its `_build`, serves the output over
  `node:http` with a fixture page carrying the daisyUI markup `core_components.ex` and `layouts.ex`
  actually emit, and reads computed values in Playwright's Chromium. Runs one named case per row of
  the I/O matrix, PASS or FAIL with the values it read, and exits non-zero if any fails. Reads the
  Hub's built stylesheet in the same browser for the FR-18 side-by-side table. Cleans up every scratch
  path in a `finally`, distinguishes a Block If from a failed case by exit code as the daisyUI probe
  does, and takes no argument that selects what it tests.
- `ops/__tests__/cs-tracker-adoption-probe.test.ts`: new. The probe's pure parts under the blocking
  `test` job, so a later edit cannot quietly make it unable to fail: the fixture builder, the
  declared-name parser, the mapping extractor, the verdict function with a dead mapping, an
  uncompiled build, a missing reference and two components that disagree, and the sha256 comparison
  with a planted mismatch.
- `ops/cs-tracker-token-adoption.md`: new. The record. What was vendored with a sha256 per file, the
  mapping table with the source of every row, the four hand-fix rules with the seam each closes, the
  probe transcript quoted verbatim, the FR-18 side-by-side table, the two measured costs of the
  adapter import and the decision taken on each, what `--color-accent` now means, the four status
  colours the contract does not cover, the stated limits, and the Pending Operator actions.
- `ops/daisyui-route.md`: fill in the completion cells of Pending Operator actions **3** and **4**,
  which this story performs, with the ISO 8601 UTC date and a pointer to the new record. Actions 1
  and 2 stay `_not done_` and are the Operator's.

**Acceptance Criteria:**
- Given AD-14 requires the contract to travel as a folder under a fixed name, when it is vendored,
  then `cs-tracker/assets/css/cuatro-contracts/` holds all three stylesheets, the three woff2 faces
  and the three licence texts, every one byte-identical to `contracts/` by sha256, and no file under
  it differs from the published surface.
- Given `cs-tracker` is a Tailwind consumer on daisyUI 5.0.35, when the contract is imported, then
  `app.css` imports `cuatro-contracts/tailwind.css` rather than the plain pair, the mapping is
  AD-15 route A inside the existing `@plugin` block, and `.btn.btn-primary` and `.badge.badge-primary`
  both compute the `--token-accent` value in a real browser against a probe in the same page,
  differing from daisyUI's own default, so the family resolves to the Cuatro roles rather than to
  daisyUI's.
- Given AD-14 makes adoption all-or-nothing, when adoption is assessed, then exactly one theme block
  remains, it is `dark` and `default: true`, none of the Story 7.1 warm-neutral literals survives in
  the compiled stylesheet outside the four status pairs the contract does not cover, and no
  `[data-phx-theme]` control or `phx:theme` script remains anywhere, so seam S-7 is taken rather than
  half carried.
- Given the hand-fix list is the whole per-application cost beyond importing the files, when the five
  lines are applied in `EXPERIENCE.md`'s order, then `:root` computes `color-scheme: dark`,
  `::selection` paints the accent, `:focus-visible` paints a `--stroke-focus` solid `--token-focus`
  ring at `--focus-offset` that no rule transitions, form controls compute `border-radius: 0px`, and
  daisyUI's control defaults resolve to token roles, each read as a computed value rather than as CSS.
- Given FR-18 is the acceptance condition for "the Ecosystem is visible", when the shared roles are
  read off `:root` in the Hub's built stylesheet and in `cs-tracker`'s compiled stylesheet in one
  browser, then every `--token-*` role, every `--f-*` family and every `--t-*` size is non-empty in
  both and equal across them, recorded side by side with its method, so the resemblance rests on
  measured values rather than on both importing the same file.
- Given NFR-2 and AD-20 bind every step, when the change ships, then `mix compile
  --warnings-as-errors`, `mix format --check-formatted` and `mix test` are green in `cs-tracker` with
  the new cases included, `mix assets.build` compiles and places the three faces where the compiled
  `url()` values point, and `corepack pnpm typecheck` and `corepack pnpm test --run` are green in
  `cuatro-portfolio` with no pre-existing case moved.

## Spec Change Log

## Review Triage Log

### 2026-08-27 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 28: (high 0, medium 9, low 19)
- defer: 1: (high 0, medium 1, low 0)
- reject: 5: (high 0, medium 0, low 5)
- addressed_findings:
  - `[medium]` `[patch]` **Nothing bound `@target_rel` to where the compiled stylesheet's `url()`
    values actually resolve.** Every case in `cuatro_fonts_test.exs` passed its own `target`, so
    changing one token to `priv/static/assets/fonts` left the whole suite green while all three
    faces 404 in production, which is the failure the task's own moduledoc says it exists to
    prevent. The attribute is now asserted against `Path.dirname` of the Tailwind `--output` read
    out of `Application.get_env(:tailwind, :cs_tracker)`, and `run/1` is exercised against the real
    tree rather than only `copy!/2`.
  - `[medium]` `[patch]` **The alias wiring was asserted nowhere.** Deleting `"cuatro.fonts"` from
    `assets.deploy` left every gate green and shipped a stylesheet whose faces 404 out of the Docker
    image, which is the only place the production assets are built. A case now reads
    `Mix.Project.config()[:aliases]` and asserts the task is in both aliases and precedes
    `"phx.digest"`.
  - `[medium]` `[patch]` **`fileList` and `hashTree` were called by no test**, so dropping the
    recursion made both trees return the three top-level stylesheets, `compareHashes` found nothing
    wrong, the `source.size > 0` guard passed, and the verbatim-copy case reported PASS having never
    compared the three woff2 faces or the three licence texts. Both functions now run over the real
    `contracts/` tree in the unit suite with the nine relative paths pinned, and the probe's own case
    pins the compared count.
  - `[medium]` `[patch]` **The retired-literal list was a subset of what the change retired**, so
    "no surface left on the previous theme" overclaimed: eight literals were pinned where the `dark`
    block replaced twelve and the deleted `light` block carried about twenty more. The list is now
    derived from the baseline blocks at `ff7667b` by `git show` rather than transcribed, which
    raised it to **27**. One survivor, `oklch(0% 0 0)`, is present in the compiled output and is
    attributed by measurement rather than excused: the probe compiles a daisyUI-only control with no
    theme block and shows the value comes from daisyUI's own base layer, and that attribution is
    re-made on every run.
  - `[medium]` `[patch]` **The `mapped` list's length was never pinned**, so deleting a mapping
    shortened the loop and left the only Elixir gate green. Pinned at 12 with a message naming the
    cause.
  - `[medium]` `[patch]` **`--color-neutral` on `--token-bg-raised` shipped a visible regression.**
    `badge-neutral` is `core_components.badge/1`'s default variant and is live across the inventory
    and offers components, and it painted the same colour as the shell ground it sits on, so a chip
    degraded to plain text. Moved onto `--token-accent-muted`, which is published, was unused here,
    is distinct from all three grounds, and is the role the Hub already gives its own tech chips, so
    the fix moves the two applications closer. Measured after the change: `badge-neutral` paints
    `rgba(86, 76, 145)` against a shell ground of `rgba(13, 12, 19)`, and its content colour clears
    the text floor at **6.39:1**. `--color-secondary` stays on a repeated ground, which nothing in
    the application uses, and that is now stated rather than silent.
  - `[medium]` `[patch]` **`copy!/2` never converged on the source list**, so a face renamed by a
    contract MINOR left a stale woff2 that `phx.digest` then shipped. The target is pruned to exactly
    the source list, with a case that runs over a dirty target.
  - `[medium]` `[patch]` **The FR-18 row could report equal for a name neither stylesheet declares**,
    two undeclared custom properties inheriting the same default on both sides. The guard is
    extracted as `unreadableRows`, a pure function with its own cases, so an unreadable row fails
    rather than comparing.
  - `[medium]` `[patch]` **Seam S-8 was the one acceptance criterion neither implemented nor named
    anywhere.** Its antecedent can only be observed in a running LiveView application, which is the
    surface nothing here reaches. The record now enumerates the transitions that survive the toggle's
    removal, states that the antecedent was not evaluated and why, and hands it to the Operator as a
    pending action.
  - `[low]` `[patch]` `mix cuatro.fonts` reached no development path: the dev watchers call Tailwind
    and esbuild directly and never reach `assets.build`, so a tree that had only run `mix setup`
    served faces that 404. Added to `assets.setup`.
  - `[low]` `[patch]` Both theme-block matchers used `[^}]*`, which stops at the first `}` inside a
    comment and hides every later mapping from every assertion. Replaced by a brace-counting scan,
    shown firing on a planted control carrying exactly that shape.
  - `[low]` `[patch]` The S-3 matcher hard-coded the four selectors' newlines and indentation, so a
    formatting-only edit turned it red with no behaviour change. Made whitespace-tolerant.
  - `[low]` `[patch]` Both new Elixir test modules resolved `File.cwd!()` at compile time into a
    module attribute, baking an absolute host path into the `.beam`. Resolved at runtime.
  - `[low]` `[patch]` The probe's `The font faces resolve` case staged the fonts itself and then
    asserted against its own scratch layout, so it passed identically whether the task and the
    aliases existed or not. It now says in its own words that it proves the placement route, and the
    pipeline is asserted where a pipeline can be asserted, in `mix.exs` and the task's attribute.
  - `[low]` `[patch]` Nothing showed `source(none)` still governs after the adapter's bare
    `@import "tailwindcss"`, and `@source not` was asserted only as a string. The probe now plants a
    marker in a file no `@source` names and a marker inside the vendored folder, and compiles
    controls that mint each, so both claims are calibrated rather than negative-only. That also
    closes `ops/daisyui-route.md`'s standing "clean negative with no positive control". **The
    measurement came back honest rather than confirming**: with the exclusion removed the build mints
    the identical 366 selectors, so the published contract contributes zero candidates today and the
    line is precautionary rather than load-bearing. The record says so in those words.
  - `[low]` `[patch]` Four mapping rows were marked Observed in Chromium that no probe read, the only
    radius reads being on four controls the unlayered hand-fix squares regardless of the mapping.
    `--radius-selector`, `--radius-field`, `--radius-box` and `--border` are now read off `:root`
    through the same mechanism the colour rows use.
  - `[low]` `[patch]` The eight contrast ratios were introduced as computed by script while no script
    existed and nothing recomputed them. `contrastRatio` is now a pure function in the probe,
    calibrated against black on white at 21:1, and the record quotes the printed figures.
  - `[low]` `[patch]` `--r-none` is authored unitless, and daisyUI emits one declaration of the form
    `border-radius: calc(var(--radius-selector) + min(...) + min(var(--border), ...))`, where a
    unitless zero added to a length makes the declaration invalid so it drops. The affected component
    is `.toggle`, which this application does not use. Written as `calc(var(--r-none) * 1px)` so the
    three still read the role and always produce a length.
  - `[low]` `[patch]` `--depth: 1` was kept and filed under "control geometry". It is not geometry:
    the compiled stylesheet uses it in **35** places to add gradients, inset shadows and text shadows,
    a raised treatment this system does not have, and `contracts/tokens.css:114` says in its own words
    that elevation is lightness rather than shadow. Set to `0` and recorded as a Decision citing that
    line. It is the largest single change to how a control looks and is called out to the Operator.
  - `[low]` `[patch]` `prefersdark: true` was redundant on the only theme, which is `default: true`
    and therefore unconditional, and made daisyUI emit an extra `@media (prefers-color-scheme: dark)`
    block. Resolved and recorded.
  - `[low]` `[patch]` `@custom-variant dark` was unconditionally true with `data-theme="dark"` pinned
    on `<html>` and zero `dark:` utilities in `lib/`. Removed, on the same reasoning the story used
    for the toggle.
  - `[low]` `[patch]` The empty `navbar-end` carried a justification about a three-column grid that
    daisyUI's flex navbar does not have. Corrected.
  - `[low]` `[patch]` Hand-fix 1 was redundant, the surviving theme block already emitting
    `color-scheme: dark` onto `:root`, so the probe's reading would pass with the rule deleted. Given
    the same belt-and-braces note hand-fix 4 already carried.
  - `[low]` `[patch]` The hand-fix list read as four in one place and five in another. The record now
    says plainly that "in order" refers to `EXPERIENCE.md`'s list rather than to position in the file,
    S-9 being the mapping applied a hundred lines above the other four.
  - `[low]` `[patch]` The record stated only which contract roles daisyUI cannot reach. It now carries
    the reverse coverage row as well: `--token-border`, `--token-border-interactive`,
    `--token-text-secondary`, `--token-accent-hover` and `--token-scrim` map onto no daisyUI name and
    reach no surface, so the FR-18 table is not read as coverage.
  - `[low]` `[patch]` The border divergence was undisclosed. `cs-tracker` draws every border from
    `border-base-300` while the Hub draws them from `--token-border`, a different value, and the FR-18
    case cannot see it because it compares `:root` values rather than what a component paints. Recorded
    as a stated limit naming Story 8.1 as where it is settled.
  - `[low]` `[patch]` DW-1's coupling was undisclosed: `contracts/` is exactly nine files and that count
    is pinned twice, so the folder-identifying file DW-1 asks for turns both gates red in `cs-tracker`
    until it re-vendors. Recorded.
  - `[low]` `[patch]` The removed bootstrap script was the only reader and writer of
    `localStorage["phx:theme"]`. Recorded that the key is deliberately abandoned, and that clearing it
    would mean reintroducing the inline script this story removed.
  - `[low]` `[patch]` Nothing inside `cs-tracker` documented the adoption. `cs-tracker/AGENTS.md` now
    carries a short entry naming the vendored folder as generated and never hand-edited, the fonts task
    and its ordering ahead of `phx.digest`, and where the full record lives.

**No loopback, and why.** Nothing was routed to `intent_gap` or `bad_spec`, and nothing inside
`<intent-contract>` was touched. The one finding that came closest was seam S-8, which the spec never
named although the intent's fourth acceptance criterion carries it: its antecedent is observable only
on a running LiveView application, so re-deriving from an amended spec produces the same code and a
record entry, which is what was written instead. Every other finding is a defect in an artifact this
story wrote: nine assertions that could not fail, one mapping that shipped a visible regression, four
values kept without a reason, and eight statements that claimed more than the run measured.

**One finding was deferred.** No gate and no schedule can see the mapping stop resolving in
`cs-tracker`, because that repository has no CI and the only rendered-output instrument is a hand-run
probe in another repository. It is the standing shape of the verification rather than something this
story broke, and it is why both probes' re-run is handed to the Operator.

**Five findings were rejected.** That the hand-fix squares checkbox, range and colour inputs as well
(a square system squares them deliberately, and daisyUI's own selector radius is already zero); that
the probe writes a parallel instrument instead of importing Story 1.10's harness (the reason is
measured and recorded: Next 16 minifies `oklch()` into a hex fallback plus a `lab()` override, so a
raw string comparison would report differences that do not exist, which is why both sides are
rasterised); that neither application is running and the fixtures are synthetic (that is the boundary
this run stops at, and it is enumerated under `operator_actions` rather than hidden); that the spec's
own `status` and empty logs are stale (they are this run's workflow state, rejected on the same
reasoning at Stories 1-15 and 1-18); and the pre-existing em-dash and emoji in `cs-tracker`'s offline
banner and `mix.exs` comments (another repository's prose, and not this story's to rewrite).

## Design Notes

**Why the light theme's removal reaches three files.** Dropping the block alone would leave a
three-state toggle whose `light` and `system` buttons select a theme that no longer exists, and a
bootstrap script that writes `data-theme="light"` into `localStorage`. A visitor who last chose light
would land on an unstyled `[data-theme=light]` document. So the block, the toggle and the script are
one deletion, and `<html data-theme="dark">` replaces the script's whole job.

**Why the status colours stay.** `contracts/tokens.css` publishes twelve semantic roles and none of
them means "success", "warning", "danger" or "info". `badge-success` is the Owned marker and
`badge-info` the Wishlisted marker in `inventory_components.ex`, so they carry meaning the contract
does not cover. Mapping them onto accent or muted would erase a distinction the application makes;
inventing three hues would be inventing a mapping. They stay, and the record names them as the one
part of the surface the contract cannot reach yet.

**What `--color-accent` means after this story.** It is the one name daisyUI's theme and the adapter
both own, and `ops/daisyui-route.md`'s Pending action 3 leaves the decision here. The composed build
gives it two colours in one page: `.btn-accent` reads daisyUI's teal off the element, while the
adapter's `.bg-accent` emits `var(--token-accent)` at the use site because `inline` substitutes there.
This story makes them agree by mapping daisyUI's `--color-accent` onto `--token-accent` as well, so
one word gives one colour. That closes the collision rather than documenting it.

**The mapping, and where each row comes from.**

```css
--color-base-100:     var(--token-bg);              /* the ground the shell paints */
--color-base-200:     var(--token-bg-raised);       /* elev-1, the navbar and card ground */
--color-base-300:     var(--token-bg-raised-2);     /* elev-2, borders and the raised chip */
--color-base-content: var(--token-text);            /* 17.56:1 on --token-bg, measured at 1-18 */
--color-primary:      var(--token-accent);          /* ops/daisyui-route.md, the line it names */
--color-primary-content: var(--token-bg);           /* the dark ink the accent is bright enough for */
```

The `secondary` and `neutral` pairs follow the same two rules: a ground role for the fill and the
role whose contrast against it was already measured for the text. Every pair's contrast is measured
in the record rather than asserted here.

**Why the probe compiles rather than runs the application.** `mix test` needs a Postgres and
`mix phx.server` needs the whole stack, and neither renders CSS any differently from the compiler.
What the acceptance criteria ask for is the computed value of a theme variable on a daisyUI
component, which is a property of the compiled stylesheet plus the markup. The fixture carries the
class strings `core_components.ex` and `layouts.ex` actually emit, read out of those files rather
than invented, so the markup is the application's own even though the server is not running.

## Verification

**Commands:**
- `git -C ..\cs-tracker-workspace\cs-tracker diff --stat ff7667b`, expected: the vendored folder, one
  stylesheet, two view files, one mix task, `mix.exs` and three test files, and nothing else.
- `mix format --check-formatted` in `cs-tracker`, expected: exit 0.
- `mix compile --warnings-as-errors` in `cs-tracker`, expected: exit 0.
- `mix test` in `cs-tracker` against a Postgres brought up for the run, expected: exit 0, the
  pre-existing case count grown by the new suites and no pre-existing case moved.
- `mix assets.build` in `cs-tracker`, expected: exit 0, a compiled `priv/static/assets/css/app.css`,
  and the three woff2 faces present at the path its `url()` values resolve to.
- `node ops/cs-tracker-adoption-probe.mjs`, expected: exit 0, every named case PASS, and a printed
  side-by-side table for the FR-18 row.
- `corepack pnpm typecheck` and `corepack pnpm test --run` in `cuatro-portfolio`, expected: exit 0,
  totals grown by the probe's suite only.
- `git status --porcelain` in both repositories, expected: empty at each closing commit.
- Punctuation sweep over every file written, run against a positive control carrying an em-dash, an
  en-dash, a double-dash and an emoji so it cannot pass vacuously.

**Manual checks:**
- Read the compiled `priv/static/assets/css/app.css` for a surviving Story 7.1 literal outside the
  four status pairs, which is the claim acceptance criterion 3 rests on.

## Auto Run Result

Status: awaiting-operator
Blocking condition: none

**Summary.** `cs-tracker` now renders from the Cuatro token contract. The published `contracts/`
folder is vendored into it verbatim as `assets/css/cuatro-contracts/`, its `app.css` imports the
generated Tailwind adapter that AD-14 assigns to a Tailwind consumer, and daisyUI's own colour family
is mapped onto the token roles through AD-15 route A, the route `ops/daisyui-route.md` measured live.
The light theme, the three-state toggle and the inline theme bootstrap script are gone together, seam
S-7 taken deliberately rather than half carried. The five hand-fix lines from `EXPERIENCE.md` are
applied in its order. Every claim about what renders is a computed value read in Chromium off the
stylesheet `cs-tracker`'s own pinned Tailwind 4.1.12 compiled, never off a reading of CSS. The
repository half of Epic 1's acceptance condition is done; the deployed half is owed to the Operator,
because `cs-tracker.cuatro.dev` still serves the Story 7.1 palette until someone pushes and deploys.

**Files changed.**

In `cs-tracker` at `C:\CuatroEcosystem\cs-tracker-workspace\cs-tracker`, commits `3f37cce` and
`8adb8e2` against `ff7667b`:
- `assets/css/cuatro-contracts/`: the vendored contract, nine files, every one byte-identical to
  `contracts/` by sha256.
- `assets/css/app.css`: the adoption. The adapter import and its `@source not` exclusion, the light
  theme block deleted, the surviving `dark` block at `default: true` mapping twelve `--color-*` names
  onto token roles plus `--border` onto `--stroke-boundary`, the three radii onto `--r-none` and
  `--depth` onto flat, and the four hand-fix rules appended unlayered so they beat daisyUI's own.
- `lib/cs_tracker_web/components/layouts/root.html.heex`: `data-theme="dark"` on `<html>`, the theme
  bootstrap script deleted.
- `lib/cs_tracker_web/components/layouts.ex`: `theme_toggle/1` and its call site deleted.
- `lib/mix/tasks/cuatro.fonts.ex` and `mix.exs`: the faces are copied beside the compiled stylesheet,
  where its unrebased `url()` values resolve, on `assets.setup`, `assets.build` and `assets.deploy`
  ahead of `phx.digest`.
- `AGENTS.md`: a short entry naming the vendored folder as never hand-edited and the fonts task's
  ordering.
- `test/cs_tracker_web/token_contract_test.exs`, `test/mix/tasks/cuatro_fonts_test.exs` and
  `test/cs_tracker_web/live/app_shell_test.exs`: the source-text half, inside the only gate this
  repository has.

In `cuatro-portfolio`, commits `2d508e3` and `7fef4a5` against `1b7cc1c`:
- `ops/cs-tracker-adoption-probe.mjs`: the rendered-output instrument, 18 named cases.
- `ops/__tests__/cs-tracker-adoption-probe.test.ts`: its pure parts under the blocking `test` job, so
  a later edit cannot quietly make it unable to fail.
- `ops/cs-tracker-token-adoption.md`: the record, with the transcript quoted verbatim.
- `ops/daisyui-route.md`: Pending Operator actions 3 and 4 completed with the date and a pointer.
- This spec.

**Review findings breakdown.** 28 patches applied (high 0, medium 9, low 19), 1 deferred, 5 rejected,
0 intent gaps, 0 spec repairs.

**Follow-up review recommendation:** `true`. Patched this pass: high 0, medium 9, low 19. Score is
`3 x 9 + 1 x 19 = 46`, which is 5 or more.

**Verification performed**, re-run in full after the patches:
- `mix format --check-formatted` and `mix compile --warnings-as-errors` in `cs-tracker`: exit 0.
- `mix test` in `cs-tracker`, against a Postgres started and removed for the run: **653 tests, 0
  failures**, 4 excluded, up from 613 at the baseline. No pre-existing case moved.
- `mix assets.build` in `cs-tracker`: exit 0, and the three faces land at
  `priv/static/assets/css/fonts/`, which is where the compiled stylesheet's `url()` values resolve.
- `node ops/cs-tracker-adoption-probe.mjs`: exit 0, **18 cases, 18 PASS**, elapsed 14.4s. Route A is
  LIVE on both components at `rgba(143, 126, 240)` against an inline `var(--token-accent)` probe in
  the same page and against daisyUI 5.0.35's own default. All twelve mapped names compute their
  role's value. Zero of the 27 retired literals survive except one attributed by measurement to
  daisyUI's own base layer. All four hand-fix rules measured. **FR-18: 25 of 25 rows equal** across
  the Hub's built stylesheet and `cs-tracker`'s compiled one, read in one browser, exact rather than
  within a tolerance.
- `corepack pnpm typecheck`: exit 0. `corepack pnpm test --run`: exit 0, 649 tests across 27 files,
  up from 600 across 26 at the baseline, the growth all in the probe's own suite.
- `git status --porcelain`: empty in both repositories.
- Punctuation sweep over every written file against a positive control carrying all four forbidden
  marks: the control matched on all four and the written files matched nothing but CSS custom
  property prefixes.
- Manual check: the compiled stylesheet read for a surviving Story 7.1 literal. The one that survives
  is `oklch(0% 0 0)`, and the probe compiles a daisyUI-only control to show it comes from daisyUI's
  base layer rather than from the retired theme.

**Residual risks.**
- Nothing is deployed. `cs-tracker.cuatro.dev` serves the Story 7.1 warm-orange palette until the
  Operator pushes and deploys, so FR-18's own words, a Visitor moving between the two applications,
  are not yet true in the world. That is `operator_actions` item 1 and it is the largest residual.
- Every figure here is read off a compiled stylesheet in a fixture page carrying class strings copied
  out of `core_components.ex` and `layouts.ex`. No Phoenix server rendered anything, so a surface the
  fixture never carried could still be wrong, and seam S-6, dense data UI, is exactly where a token
  contract's reach ends. The visual pass is `operator_actions` item 3.
- Seam S-8's antecedent was never evaluated, because it is observable only on a running LiveView
  application. The surviving transitions are enumerated in the record.
- `--depth: 0` is the largest single change to how a control looks, removing daisyUI's shadow and
  gradient overlay from every button, input and menu. It follows `contracts/tokens.css:114` and is
  recorded as a Decision, and it is the thing to look at first on the deployed application.
- The mapping is pinned by source-text assertions in a repository with no CI, and by a probe no
  scheduled job runs. A Tailwind or daisyUI bump that changes how `@plugin` option values are parsed
  would ship with every gate green. That is the deferred finding and `operator_actions` item 6.
- `cs-tracker` draws every border from `border-base-300`, which the mapping puts on
  `--token-bg-raised-2`, while the Hub draws borders from `--token-border`. daisyUI publishes no
  separate border role, so the two applications still paint different borders while the FR-18 table
  reports every role equal. Recorded as a stated limit for Story 8.1.

