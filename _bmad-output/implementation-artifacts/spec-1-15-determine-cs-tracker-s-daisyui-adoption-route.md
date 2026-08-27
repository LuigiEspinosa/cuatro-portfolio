---
title: "Determine cs-tracker's daisyUI adoption route"
type: 'chore'
created: '2026-08-25'
status: 'done'
baseline_commit: 'd4404ee73a195d507279b003a8b9d45a03074303'
baseline_revision: 'd4404ee73a195d507279b003a8b9d45a03074303'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/ops/tailwind-adapter.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** AD-15 leaves `cs-tracker`'s token adoption carrying two mappings because nobody has
run the test that picks one: whether Tailwind v4's `@plugin "daisyui/theme" { --color-primary:
var(--token-accent); }` accepts a `var()` reference and renders the token value, or whether the
plain `[data-theme="..."] { --color-primary: var(--token-accent); }` fallback is the live route.
Open item O-3 blocks Story 1.19, and the public record answers it neither way.

**Approach:** Build a throwaway `mix phx.new` application outside every estate repository, pinned
to what `cs-tracker` actually runs (Phoenix 1.8.7, Tailwind 4.1.12, daisyUI 5.0.35 copied from its
own vendored bundles), compile four variants of its `app.css` through the application's own asset
pipeline, and read the computed `background-color` of real daisyUI components in Chromium. Commit
the reproduction probe and the finding under `ops/`, and delete the scratch application.

## Boundaries & Constraints

**Always:**
- The answer is a rendered-output observation: a computed value read in a real browser off a real
  Tailwind v4 compile, never a reading of daisyUI's or Tailwind's source. Source reading may
  explain a result and may never stand in for one.
- Four variants compile in one run, so neither a pass nor a failure can be vacuous:
  `unmapped` (no mapping, daisyUI's own primary), `literal` (`--color-primary` set to the literal
  value `--token-accent` resolves to), `plugin-var` (AD-15 route A), `css-var` (AD-15 route B).
  A route is live when its components compute **equal to `literal` and different from `unmapped`**.
- Two daisyUI components are read, not one, so the finding is about the theme variable rather than
  about one component's quirk. `--color-primary` is also read raw off the document element as a
  diagnostic, and a diagnostic never carries the verdict.
- The scratch application pins what `cs-tracker` runs: `{:phoenix, "~> 1.8.7"}`, tailwind
  `4.1.12`, esbuild `0.25.4`, and `assets/vendor/daisyui.js` plus `assets/vendor/daisyui-theme.js`
  copied verbatim from `cs-tracker` (daisyUI 5.0.35). Every version is recorded with where it was
  read and whether it is an observation or a decision (NFR-9). Dates are ISO 8601 UTC.
- The scratch application is created under the OS temporary directory, never inside
  `cuatro-portfolio`, `cs-tracker-workspace`, or any other estate repository, and is removed when
  the probe finishes, including on failure.
- `cs-tracker` is read-only in this story. Nothing under `C:\CuatroEcosystem\cs-tracker-workspace`
  is written, and no file outside `cuatro-portfolio` is created or modified except inside the
  scratch tree.
- The probe records what it observed even when a variant fails to compile: a Tailwind CLI error on
  the `@plugin` route is the finding, not a crash to report.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash and no
  emoji. The commit is a subject line only, no body and no trailer.

**Block If:**
- Neither route renders the token value. AD-15 assumes at least one path works, and a step with no
  route is a decision the Operator owns rather than one to invent here.
- The scratch application cannot be created or built at all, so no route can be observed: `mix
  phx.new` fails, hex or the Tailwind binary cannot be fetched, or no Chromium is available. The
  story's whole content is the observation, so there is nothing to record without it.

**Never:**
- Never edit `contracts/`, `packages/`, `app/`, `public/`, `.github/`, `package.json`,
  `pnpm-lock.yaml`, `docker/` or any existing file under `ops/`. AD-15 says this test gates the
  step and not the contract, so a finding either way changes no published file.
- Never adopt the contract in `cs-tracker`, and never write the chosen mapping into it. That is
  Story 1.19.
- Never add a CI job or a workspace dependency. The probe needs Elixir, a network fetch and a
  browser, so it is a reproduction tool run by hand, not a gate, and AD-21's blocking rule is
  about gates that exist.
- Never commit the scratch application, its `deps/`, `_build/`, its compiled CSS, or the daisyUI
  bundles into any estate repository.
- Never let a variant that failed to compile be reported as a route that failed to resolve. The two
  are different findings and the record distinguishes them.

## I/O & Edge-Case Matrix

Every row below is a named case the probe runs and reports PASS or FAIL for by name, in one run,
so the table and the recorded output are the same list.

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| `unmapped` control | Theme declared with no `--color-primary` override | Both components compute daisyUI's own primary, different from `literal` | Equal to `literal` fails the case: the fixture is not measuring the mapping |
| `literal` reference | `--color-primary: oklch(66% 0.165 288)` | Both components compute the value `--token-accent` resolves to, and it is a real colour rather than `rgba(0, 0, 0, 0)` | A compile failure or an unpainted background fails the case: the harness itself is broken |
| `plugin-var`, route A | `@plugin ".../daisyui-theme" { --color-primary: var(--token-accent); }` | Equal to `literal` means live, unequal means dead, and the case passes on either as long as it observed a value | A Tailwind CLI error is recorded as "does not compile", never as "does not resolve" |
| `css-var`, route B | Unlayered `[data-theme="cuatro"] { --color-primary: var(--token-accent); }` after the plugin | Same two outcomes, reported the same way | Same |
| Verdict | The four variants' computed values | At least one route equals `literal`; the record names it | Neither route equal to `literal`: FAIL, and the story HALTs blocked per Block If |
| Composition | `cuatro-contracts/tailwind.css` imported beside daisyUI in one `app.css` | Reported for Story 1.19: whether it compiles, and every `--color-*` name daisyUI and the adapter both own | A compile failure is an observation the case reports, never a blocked story |
| Leftover sweep | A scratch directory from an earlier run left on disk | The probe removes it before building and prints how many it swept | A leftover that survives the sweep fails the case |

</intent-contract>

## Code Map

Gathered 2026-08-25 against `d4404ee`, working tree clean.

- `C:\CuatroEcosystem\cs-tracker-workspace\cs-tracker\assets\css\app.css:4-18`: `@import
  "tailwindcss" source(none)` plus `@source` lines, then `@plugin "../vendor/daisyui" { themes:
  false }`. `:24-97` the two `@plugin "../vendor/daisyui-theme"` blocks, `dark` (`prefersdark:
  true`) and `light` (`default: true`), each listing `--color-primary` and friends as literal
  `oklch()` values. **This is the exact shape route A has to slot into.** `:105` shows the
  `[data-theme=dark]` custom variant and `:108` an unlayered author rule, which is why route B's
  plain rule beats the plugin's `@layer base` output. Read-only in this story.
- `...\cs-tracker\assets\vendor\daisyui.js`: `var version = "5.0.35"`. Line 652 carries
  `".btn-primary": { "--btn-color": "var(--color-primary)", "--btn-fg":
  "var(--color-primary-content)" }`, so a `.btn.btn-primary` background reaches `--color-primary`
  through `--btn-bg` then `--btn-color`. **The property to read is `background-color` on a
  `.btn.btn-primary` and on a `.badge.badge-primary`.** Both bundles are copied into the scratch
  app so the finding is about the version `cs-tracker` runs.
- `...\cs-tracker\assets\vendor\daisyui-theme.js:59-96`: the theme plugin is
  `plugin.withOptions`, spreading its options into one `addBase` rule at
  `:root:has(input.theme-controller[value=NAME]:checked),[data-theme="NAME"]`. It transforms no
  value, so whether route A works is a question about **Tailwind's `@plugin` option parser**, not
  about daisyUI. That is the explanation, and it is not the evidence.
- `...\cs-tracker\config\config.exs:198-216`: esbuild `0.25.4`, tailwind `4.1.12`, and the
  `--input=assets/css/app.css --output=priv/static/assets/css/app.css` profile args. `mix.exs`
  carries `{:phoenix, "~> 1.8.7"}` and the `assets.build` alias. The scratch app pins these.
- `contracts/tokens.css:17` `--c-accent: oklch(66% 0.165 288)` and `:34` `--token-accent:
  var(--c-accent)`. **The `literal` variant uses `oklch(66% 0.165 288)`**, which is what
  `--token-accent` resolves to, so the reference build and the route builds can only agree if the
  `var()` chain actually resolved.
- `contracts/tailwind.css:17-19,30`: `@import "tailwindcss"` then tokens then fonts, and
  `--color-accent: var(--token-accent)` inside `@theme inline`. daisyUI's own theme also owns
  `--color-accent`, `--color-primary`, `--color-neutral` and more, so the composition variant
  exists to observe that overlap rather than to reason about it.
- `tests/e2e/contract-tailwind.pw.ts:54-59,189-222,324-340,389-395`: **the pattern to follow.** Why
  a scratch tree sits where the compiler can resolve its inputs, resolving the pinned CLI through
  Node rather than a shell, the tiny `node:http` static server with a MIME map and a path guard,
  and the leftover sweep by directory prefix. The probe reuses the shape and not the file: this one
  spawns `mix`, so it cannot live in the Playwright project.
- `ops/tailwind-adapter.md:140-179`: the placement rule, why a compiled build must land inside the
  vendored folder. It applies to the composition variant only, since variants 1 to 4 import
  `tokens.css` alone and request no face.
- `ops/capacity-gate.mjs:22-29,99-101,381-399`: the `ops/*.mjs` house style, exported path
  constants and the invoked-directly guard. `ops/contract-purity.md` and `ops/tailwind-adapter.md`
  are the record shape: what was probed, output quoted verbatim, stated limits, Pending Operator
  actions.
- Host, observed 2026-08-25: `elixir` 1.19.5 on OTP 28, `mix archive` carries `hex-2.4.2` and
  `phx_new-1.8.7`, `node` on PATH, `pnpm` **not** on PATH (use `corepack pnpm`),
  `@playwright/test` 1.62.1 installed with chromium builds present under
  `%LOCALAPPDATA%\ms-playwright`. `hex.pm` and `github.com` both answered 200.

## Tasks & Acceptance

**Execution:**
- `ops/daisyui-route-probe.mjs`: new. The reproduction probe, in the `ops/*.mjs` house style.
  Creates the scratch application under `tmpdir()` with `mix phx.new <name> --install --no-ecto
  --no-mailer --no-gettext --no-dashboard`, copies `cs-tracker`'s two daisyUI bundles and the
  repository's `contracts/` folder (as `assets/vendor/cuatro-contracts/`) into it, then for each
  variant writes `assets/css/app.css`, compiles through the application's own pipeline, and writes
  a fixture page carrying real daisyUI markup. Serves the tree over `node:http` on a loopback port
  and reads the computed values in Playwright's chromium. Prints a table of variant, component,
  computed value and verdict, plus every version it observed. Removes the scratch tree in a
  `finally`, sweeps a leftover from an earlier run before building, and records a compile failure
  as a result rather than throwing it away. Takes no argument and reads no environment variable
  that selects what it tests. It reports one named case per row of the I/O matrix, each PASS or
  FAIL with the values it read, and exits non-zero if any case fails, so the run is the test and
  its output is what the record quotes. The leftover-sweep case plants a directory under the
  scratch prefix before the sweep runs and asserts it is gone afterwards, so the sweep is exercised
  on every run rather than only after a crash.
- `ops/daisyui-route.md`: new. The finding. Which of AD-15's two routes is live, the computed
  values for all four variants quoted verbatim from the probe output, the exact `app.css` fragment
  Story 1.19 should use, the versions the answer is pinned to and what would invalidate it, whether
  both routes produce the same rendered result, the composition observation for Story 1.19, that
  the scratch application was deleted and where it lived, stated limits, and Pending Operator
  actions. States that it closes open item O-3.

**Acceptance Criteria:**
- Given the behaviour is undocumented either way, when the probe runs against a scratch `mix
  phx.new` application carrying `cs-tracker`'s own daisyUI 5.0.35 bundles, then `ops/daisyui-route.md`
  records whether `@plugin "daisyui/theme" { --color-primary: var(--token-accent); }` resolves to
  the token value or fails, and the evidence is the computed `background-color` of two daisyUI
  components read in Chromium rather than any reading of source.
- Given AD-15 says the Phoenix route carries both paths and either satisfies FR-18, when the result
  is recorded, then the record names which of the two is live, quotes both routes' observed values
  beside the `literal` reference and the `unmapped` control, and states from those four numbers
  whether the two routes produce the same rendered result, so the outcome gates the step and not
  the contract.
- Given a control that cannot fail proves nothing, when the probe runs, then the `unmapped` variant
  is observed to differ from the `literal` variant, and the run fails loudly rather than reporting
  a verdict if it does not.
- Given the scratch application is throwaway, when the story closes, then the finding is committed
  under `ops/`, no directory of the scratch application remains on disk, `git status --porcelain`
  is empty, and nothing under `C:\CuatroEcosystem\cs-tracker-workspace` was modified.
- Given Story 1.19 has to act on this, when `ops/daisyui-route.md` is read, then it carries the
  literal `app.css` fragment to use, the daisyUI, Tailwind and Phoenix versions the finding is
  pinned to, what would make it stale, and the observed behaviour of importing
  `cuatro-contracts/tailwind.css` beside daisyUI in one stylesheet.
- Given this story changes no published file, when the diff against `d4404ee` is read, then the
  only files added are `ops/daisyui-route-probe.mjs`, `ops/daisyui-route.md`,
  `ops/__tests__/daisyui-route-probe.test.ts` and this spec, and `contracts/`, `packages/`, `app/`,
  `public/`, `docker/`, `tests/`, `.github/`, `package.json` and `pnpm-lock.yaml` are
  byte-identical.

## Spec Change Log

## Review Triage Log

### 2026-08-25, Review pass (third)

- intent_gap: 0
- bad_spec: 0
- patch: 22: (high 0, medium 2, low 20)
- defer: 0
- reject: 16: (high 0, medium 0, low 16)
- addressed_findings:
  - `[medium]` `[patch]` **A scratch application that survived removal exited 0.** AC4 promises no
    directory of it remains on disk, and the `finally` only printed `exists afterwards: true` and
    carried on: a full Phoenix tree with `deps/` and `_build/` could be left behind by a green run.
    Every other promise in that file is an asserted PASS or FAIL. A leak now prints a named
    `# FAILURE:` line and makes the run non-zero, without becoming an eighth case, so the run's case
    list still matches the story's matrix row for row.
  - `[medium]` `[patch]` **Nothing in the blocking `test` job held `ACCENT_LITERAL` to the contract.**
    The previous pass added a runtime guard reading `contracts/tokens.css`, but it lives inside
    `buildApplication`, which needs Elixir, a hex fetch and a browser to reach, and the unit case
    asserted the same hardcoded string the probe declares. A contract MINOR moving `--c-accent` would
    have left `corepack pnpm test --run` green while every real run refused to compile. Added a case
    that reads `contracts/tokens.css` and asserts the `literal` variant declares what it finds.
  - `[low]` `[patch]` The `Leftover sweep` case broke on the one thing it claimed to handle. Two
    concurrent probes sweep the same shared temporary directory, so one removes the other's planted
    directory and the loser reported "the planted directory survived the sweep", the opposite of what
    happened. Gone is now the assertion and the detail says which sweep removed it. Separately, a real
    leftover the sweep could not remove still passed the case, where the story's matrix row says a
    leftover that survives fails it; `failed` is now part of the predicate.
  - `[low]` `[patch]` A Block If condition and a dead route were the same exit code, and the reason
    went only to stderr while the record's own reproducibility method is a captured stdout transcript.
    A missing Chromium read exactly like route A dying, which is what Pending Operator action 2 tells
    the Operator to watch for. Exit `1` is now a failed case or a leaked tree, `2` a defect in the
    probe, `3` a Block If, the reason is printed on stdout as `# BLOCKED:` as well, and the record
    carries the table.
  - `[low]` `[patch]` The `Composition` case still carried the conflation `routeVerdict` was written
    to remove: a `literal` build that never compiled made it report "route A STOPPED resolving there",
    when there was no reference to compare against. It now reports that it could not be compared, and
    does not fail for it.
  - `[low]` `[patch]` `sameRendered` read a build that had not compiled as a build that rendered
    differently, so the Verdict line asserted "The two routes do NOT produce the same rendered result"
    about a comparison nobody made. That sentence answers one of AC2's clauses and is quoted straight
    into the record. It now says the comparison was not measured.
  - `[low]` `[patch]` The `unmapped control` detail claimed "which EQUALS literal, so the fixture is
    not measuring the mapping" whenever the literal build was never read, which is a different finding.
  - `[low]` `[patch]` The `Verdict` case reported AD-15's Block If, the Operator's decision, for a run
    whose routes came back `no reference`, `no control` or `vacuous`. That is a broken harness, not a
    step with no route, and the two are now separate outcomes with separate wording.
  - `[low]` `[patch]` Every reported figure hardcoded `components.btn` and `components.badge` while
    the verdict iterated `COMPONENT_IDS`, so adding or renaming a component would leave the verdict
    correct and print `undefined` into a transcript that gets published verbatim. All reporting reads
    through `COMPONENT_IDS` now, and the text is byte-identical for the two components that exist.
  - `[low]` `[patch]` `routeVerdict` could report `LIVE` from measurements nobody took: an empty id
    list makes every `every` and `some` vacuously true, and an id missing from both the route and the
    reference compares `undefined` against `undefined`. Both are `no value observed` now, with cases.
  - `[low]` `[patch]` `ownerAlive` accepted `pid: 0` and negative pids, where POSIX `process.kill(0, 0)`
    signals the caller's own process group and answers "alive" for a marker naming nothing. Guarded,
    with a case. The `pid: null` branch, which is the production path for the probe's own sweep
    self-test, also had no standing case; it has one now.
  - `[low]` `[patch]` `emittedValues` interpolated its property into a `RegExp` unescaped and
    unanchored, so a name containing regex metacharacters would break it and a longer custom property
    merely ending in the requested name could contribute its value. Escaped and bounded, with a case.
    The re-run reproduced every emitted list unchanged.
  - `[low]` `[patch]` The scratch root leaked if the marker write or the `ERL_CRASH_DUMP` assignment
    threw, because both sat between `mkdtempSync` and the `try` whose `finally` removes the tree. Both
    moved inside.
  - `[low]` `[patch]` `findTailwindBinary` walked `_build` with an unguarded `readdirSync`, so an
    unreadable directory raised an EACCES stack instead of the named Block If below it. And a CLI that
    exited 0 having written no output read identically to a stylesheet it rejected; the harness fault
    now says so in its own words.
  - `[low]` `[patch]` `describeRun` hardcoded "600 second timeout" beside `run`'s `timeout: 600_000`,
    in a string published as evidence. Both read one constant now.
  - `[low]` `[patch]` The record's limits row said the two stylesheet departures "neither touches
    `--color-primary`", contradicted by its own diagnostics: loading daisyUI as `themes: light
    --default` is exactly what puts `oklch(45% 0.24 277.023)` at `:root`, and that is the value the
    `unmapped` control measures. Restated as load-bearing in one direction, with the consequence
    Story 1.19 needs: what a failed mapping looks like under `cs-tracker`'s real `themes: false` was
    not measured.
  - `[low]` `[patch]` The block labelled Verbatim was still a selection. The `# versions` block, which
    is the whole evidence for the pin table, the five compile lines, the sweep line and the closing
    summary were asserted in prose and quoted nowhere. All now quoted, from a fresh run made after
    these changes.
  - `[low]` `[patch]` "It is one line" was followed by a fence that, pasted unedited, would replace
    `cs-tracker`'s 28 declaration theme block with four declarations and a comment, while the spec's
    manual check says the fragment drops in unedited. The one line is now its own fence and the
    context block is labelled as an illustration.
  - `[low]` `[patch]` The `.badge.badge-primary` variable chain was asserted with no source, in a file
    whose stated standard is Observed with its method. Both chains now cite the vendored bundle,
    `daisyui.js:652` and `:559`.
  - `[low]` `[patch]` The source-detection negative rested on a second undisclosed assumption beyond
    the missing positive control: the marker was planted at `lib/source_detection_marker.ex`, and
    nothing in the run establishes where detection would have scanned from had it been on. Disclosed
    in place.
  - `[low]` `[patch]` "the sweep and reporting changes described below" pointed at nothing in that
    file; they are in this log. It names the file now.
  - `[low]` `[patch]` "Four runs ... reproduced across runs that agreed line for line" flattened the
    two runs that predate the composition change. The row now says which figures each set of runs
    reproduces, and counts five.

Nothing was deferred: no reviewer surfaced a pre-existing issue outside this story. Sixteen findings
were rejected. The larger ones: that the first triage entry's "35 cases" is wrong (it was right for
the pass that wrote it, and these entries are records of what each pass did, not a running total);
that the same entry's "AC5 enumerates three" paragraph should be retracted in place (same reason);
that `## Spec Change Log` should carry the AC5 amendment (that log records spec repairs made on a
bad_spec loopback, and AC5 moved as a patch, logged where patches are logged); that `daisyColours` is
not really daisyUI's names (checked: the probe's own theme block declares no `--color-accent` and
`contracts/tokens.css` declares no `--color-*` at all, so the published overlap claim is true as
written); that `findTailwindBinary` could match a non-executable file (it already ends in the named
Block If, because no banner is read); that the route cases being stricter than the story's matrix rows
is undeclared (it is declared in the probe header and in the previous pass's entry, and the intent's
own no-vacuous-pass clause is what it rests on); that the composition case's extra predicate is
likewise stricter (same, and its compile-failure half is exactly the matrix's); that putting the pure
suite in the existing blocking `test` job contradicts "not a gate" (no CI job and no workspace
dependency were added, and the suite is the reason a script was committed instead of a prose recipe);
that the unit cases wrongly pin the probe's disclosed departures as invariants (that is what they are
for: flipping either silently invalidates the control while every other case stays green); that the
verdict-to-exit wiring inside `probe()` needs its own standing case (decided on the previous pass);
that the story should close its own row on the board (`sprint-status.yaml` is the orchestrator's);
that the four Pending Operator actions belong in the deferred ledger, and that nothing carries the O-3
closure into `EXPERIENCE.md`, `epics.md` and `ARCHITECTURE-SPINE.md` (Pending action 1 owns it, and
amending a frozen planning record is an Operator act, decided twice before); and that this spec's
`review_loop_iteration` and `status` are stale (they are this run's own workflow state).

### 2026-08-25, Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 19: (high 0, medium 4, low 15)
- defer: 0
- reject: 3: (high 0, medium 0, low 3)
- addressed_findings:
  - `[medium]` `[patch]` **The two route cases could not fail.** `record(route.label, route.verdict
    !== 'no value observed', detail)` passed on `LIVE`, on `dead` and on `does not compile` alike,
    and the `no value observed` branch was unreachable, so a Tailwind bump that killed route A while
    route B survived would have ended `7 cases, 7 PASS`, exit 0. The record meanwhile tells the
    Operator that re-running the probe is the whole check on such a bump. The verdict is now
    `routeVerdict`, a pure function in which only `LIVE` passes and `dead`, `does not compile`,
    `no reference`, `no control`, `vacuous` and a components-disagree `SPLIT` are distinct named
    failures.
  - `[medium]` `[patch]` **The composition variant declared the literal**, so the fifth build
    compiled the adapter beside daisyUI and never exercised the `var()` at all, while the record
    claimed "the primary route still works there". It carries route A now, its case asserts the
    route resolves rather than passing on a hardcoded `true`, and every composition figure in the
    record was re-taken from the run that followed.
  - `[medium]` `[patch]` **The recommended fragment contradicted AD-14** and never named it. AD-14
    assigns `tokens.css` plus `fonts.css` to non-Tailwind consumers and names `cs-tracker` in bold
    among the Tailwind consumers that import `tailwind.css`. The record now separates the two
    questions: the mapping declaration is what this story owns and it is identical under either
    import, measured; which contract file `cs-tracker` imports stays where AD-14 put it, with the
    two measured costs handed to Story 1.19 as input rather than as an overruling.
  - `[medium]` `[patch]` **Nothing kept the probe able to fail after a later edit.** Every other
    `ops/*.mjs` in this repository carries a suite inside the blocking `test` job, which is the
    argument `ops/__tests__/contract-purity.test.ts:20-24` makes in its own words. Added
    `ops/__tests__/daisyui-route-probe.test.ts`, 35 cases with no Elixir, no network and no browser,
    over `appCss` per variant, `fixtureHtml`, `declaredColourNames`, `emittedValues`,
    `preflightCount`, `sweepLeftovers` including the concurrent-run skip, and the verdict function,
    where a dead route, a build that did not compile, a missing reference and two components that
    disagree each hold their failure permanently.
  - `[low]` `[patch]` Failure paths conflated distinct causes. A `literal` build that did not compile
    reported both routes as `dead`, which is the conflation the intent contract's Never clause
    forbids; a timed-out `mix phx.new --install` read as a generator refusal because `signal` was
    never surfaced; an unguarded `mix.lock` read, a missing Tailwind binary and a Chromium that would
    not launch each threw a raw stack instead of the named Block If condition. All now report by
    name through a `BlockedError`.
  - `[low]` `[patch]` `process.exit` on a pipe can cut the transcript off mid flush, and this
    probe's whole value is a transcript quoted verbatim. `process.exitCode` now carries the verdict.
    This is the same trap Story 1-14 recorded against `ops/capacity-gate.mjs`.
  - `[low]` `[patch]` The pins the finding rests on were read and asserted nowhere: the Tailwind
    banner and the vendored daisyUI version. Both are enforced now, and a mismatch refuses to compile
    anything and says what to do.
  - `[low]` `[patch]` The leftover sweep would delete a concurrent run's live scratch tree, and its
    self-test planted a fixed name a second run would also claim. The planted name carries the pid
    and the clock, and a tree whose marker names a live process is left alone.
  - `[low]` `[patch]` The `DIAGNOSTIC_ELEMENTS` comment claimed `bg-accent` reads unpainted in
    variants 1 to 4. The recorded output shows it computing daisyUI's teal, because daisyUI registers
    `--color-accent` as a theme variable of its own.
  - `[low]` `[patch]` The probe loads daisyUI as `themes: light --default` where `cs-tracker` writes
    `themes: false`, and loads no heroicons plugin, while the record claimed without qualification
    that the scratch application is pinned to what `cs-tracker` runs. Both differences are disclosed
    now, with the reason the control needs a daisyUI default theme underneath it.
  - `[low]` `[patch]` "The probe compiled this exact shape" overclaimed: one theme named `cuatro`,
    `default: false`, 13 declarations, against `cs-tracker`'s two themes at 28 declarations each, one
    of them `default: true`, which changes which selector the plugin emits into. Stated as a limit.
  - `[low]` `[patch]` The diagnostics block labelled "Verbatim" silently dropped three of the nine
    printed lines per variant. It quotes the whole block now.
  - `[low]` `[patch]` Pending action 1 justified leaving O-3 open with "This story may not edit a
    planning artefact", a constraint the spec never states. Replaced with the real reasoning, and the
    action now names the three lines that still say O-3 is open.
  - `[low]` `[patch]` Pending action 2 named AD-22's refresh schedule, whose scope does not include
    this probe, so nothing would ever pick it up. The action is now to add it to that scope, on the
    `ops/routing-inventory.md` precedent, and it names the real trigger.
  - `[low]` `[patch]` The placement paragraph handed Story 1.19 a blocker the estate has already
    solved: `ops/tailwind-adapter.md:176-178` names two supported routes, and the probe silently uses
    one of them. Both are named now, and so is the one the probe uses.
  - `[low]` `[patch]` The reproducibility and timing claims were Observed assertions nothing could
    check, and the probe accumulated every line and wrote them nowhere. It prints its own elapsed
    figure now, and the record says how the run comparison was actually made and which figures
    predate the composition change.
  - `[low]` `[patch]` "How to re-run it" omitted that `@playwright/test` resolves out of this
    repository's `node_modules`, so `corepack pnpm install` is a prerequisite.
  - `[low]` `[patch]` AD-15's own `@plugin "daisyui/theme"` package-specifier form was never
    compiled, only the relative vendored spelling `cs-tracker` actually writes, and the limits table
    did not say so. It does now. The route A tie-break also cited three of this story's own Decisions
    without citing AD-15, whose conditional already selects route A once the scratch test confirms
    `var()` is accepted.
  - `[low]` `[patch]` The Code Map cited `contracts/tokens.css:18` for `--c-accent`, which is at
    `:17`, and the Verification section still said the story adds no `.ts` file and no test.

**One deliberate departure from AC5's file list**, made on this review pass: the story adds a fourth
file, `ops/__tests__/daisyui-route-probe.test.ts`, where AC5 enumerates three. AC5's substantive
clause is untouched: `contracts/`, `packages/`, `app/`, `public/`, `docker/`, `tests/`, `.github/`,
`package.json` and `pnpm-lock.yaml` are byte-identical to `d4404ee`.

Nothing was deferred. Three findings were rejected: that the spec's "pinned to Phoenix 1.8.7" wording
disagrees with the resolved 1.8.13 (the requirement is matched, the resolution is disclosed in the
record, and nothing about CSS compilation passes through Phoenix); that the story should close its own
row on the board (`sprint-status.yaml` is the orchestrator's, and this run may not write it); and that
the spec should finalize to `awaiting-operator` with an `operator_actions` key (none of this story's
acceptance criteria needs a human action outside the repository, and the four Pending Operator actions
in the record are follow-ups owned by Story 1.19 and the planning surface, not acceptance of this one).

### 2026-08-25, Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 14: (high 0, medium 2, low 12)
- defer: 0
- reject: 22: (high 0, medium 0, low 22)
- addressed_findings:
  - `[medium]` `[patch]` **The leftover sweep could throw before a single variant compiled.** Its
    `rmSync` carried no retries where the probe's own cleanup carries five, and `readdirSync(tmpdir())`
    was unguarded, so a locked file under a leftover `_build`, which is a Windows commonplace, ended
    the run in a raw stack rather than in a named result. Neither is a finding about the routes.
    `sweepLeftovers` now retries, reports an unremovable tree and an unreadable base in a third
    `failed` list the sweep case prints, and no longer raises.
  - `[medium]` `[patch]` **The record attributed the whole 5,252 byte difference to the duplicated
    Preflight.** That difference also carries the adapter's `@theme inline` block, its `@font-face`
    rules and the utilities the second import mints, and no build isolated the Preflight from the
    rest. The two emissions are the Observed figure; the byte split between them was an inference
    presented as a measured cost Story 1.19 acts on. Restated as what was actually measured.
  - `[low]` `[patch]` A concurrent run's root was unprotected between `mkdtempSync` and its marker
    write, which is the exact failure the marker exists to prevent. An unclaimed tree younger than
    `CLAIM_GRACE_MS` is now left alone, and the planted sweep-probe directory carries a marker naming
    no process so the grace does not also protect it.
  - `[low]` `[patch]` The planted sweep-probe directory leaked on the one path the case exists to
    catch: nothing but the sweep itself removed it, so a broken sweep left it behind permanently while
    the file's promise is that it leaves nothing behind. It is removed explicitly when the case fails.
  - `[low]` `[patch]` The unit cases swept the shared `tmpdir()`, so `corepack pnpm test` could delete
    a concurrently running probe's planted directory and fail its sweep case for an unrelated reason.
    `sweepLeftovers` takes a base directory and the cases run against one of their own.
  - `[low]` `[patch]` Nothing pinned the sweep's production branch. Every real leftover carries a
    well-formed marker naming a process that has since died, and the five existing cases covered only
    marker-less, non-prefixed, activeRoot, live-pid and unparseable-marker trees, so a guard that
    answered "alive" for every marker would leak a full Phoenix tree per crashed run with all cases
    green. Added the dead-pid case, plus one for the claim grace and one for an unreadable base.
  - `[low]` `[patch]` A Block If condition escaping mid run skipped the `# N cases, N PASS, N FAIL`,
    elapsed and finished lines entirely, because they sat after the try/finally. The transcript is
    this probe's whole deliverable and it gets quoted verbatim, so a run that stopped early must not
    trail off. The summary moved into the `finally`.
  - `[low]` `[patch]` `ACCENT_LITERAL` was hand-copied from `contracts/tokens.css` and asserted
    nowhere, so a drift would have made both routes read as dead for a reason that has nothing to do
    with `var()`, which is a wrong answer rather than a failure. It is now checked against
    `contracts/tokens.css` before the generator runs, and a missing `contracts/tokens.css` reports the
    named Block If condition instead of a raw `cpSync` stack.
  - `[low]` `[patch]` Nothing pinned the two settings that make the `unmapped` control valid. Flipping
    `themes: light --default` or `default: false` would leave the control measuring an unpainted
    element while all other cases still passed. Both are asserted for every variant now.
  - `[low]` `[patch]` The probe's two route cases fail on `dead`, which is stricter than the story's
    own matrix rows for `plugin-var` and `css-var`. The strictness was chosen deliberately on the
    previous pass and is right, but nothing said it was a departure. The header now records it and why.
  - `[low]` `[patch]` The record claimed the copied `contracts/fonts/` "is why the composition build's
    faces resolve in the fixture". No face was measured: nothing in the probe reads a `font-family`, a
    `document.fonts` entry or a font request. Restated as the placement route being exercised.
  - `[low]` `[patch]` The source-detection result is a negative with no positive control, and the
    record concluded from it that "the larger of the two worries is closed". Nothing demonstrates the
    marker utility would have been minted had detection been on. Disclosed in place.
  - `[low]` `[patch]` The probe was re-run after these changes and reproduced every computed value,
    every verdict and all five compiled byte counts at `7 cases, 7 PASS`, exit 0. Recorded in the
    reproducibility paragraph, and the "Three runs" limit row is now four.
  - `[low]` `[patch]` AC5 enumerated three added files where four shipped. The previous pass recorded
    the departure in this log but left the criterion itself stale, so the story's own verification read
    as failing against the diff. AC5 now names `ops/__tests__/daisyui-route-probe.test.ts`.

Nothing was deferred: no reviewer surfaced a pre-existing issue outside this story. Twenty-two findings
were rejected. The larger ones: that the composition case passing on a compile failure is a case that
cannot fail (the story's I/O matrix says a compile failure there is an observation and never a blocked
story); that a `literal` build which compiled but was never read is misreported (unreachable, a build
is only read when it compiled); that the verdict-to-exit wiring inside `probe()` needs its own standing
case (it would take a refactor of `probe()`, and every real run exercises it, while the semantics it
carries are pinned in `routeVerdict`); that the four Pending Operator actions belong in the deferred
ledger (they are Story 1.19's and the planning surface's, which the previous pass already decided);
that `23426` contradicts `23425` (the record explains in place that the first predates the composition
change); and that the recommended fragment covers only the `dark` block (the record already says it is
written once per theme, naming both).

## Design Notes

**Why a four-variant run and not one test.** The question reads as a yes or no, and a yes tested
alone is worthless: if the fixture never painted the token colour anywhere, `plugin-var` and
`unmapped` would both compute daisyUI's default and the run would report "route A does not work"
for a reason that has nothing to do with `var()`. The `literal` build is what "resolved to the
token value" looks like rendered, and the `unmapped` build is what "did not" looks like. Every
verdict is a comparison against both.

**Why the scratch application is thrown away and the probe is kept.** AC3 forbids committing the
application. A prose recipe for rebuilding it is the failure this repository keeps finding, a claim
nothing exercises, so the script that produced the recorded output is committed instead. It is not
a gate and nothing in CI runs it: it needs Elixir, a hex fetch and a browser, and none of the three
is on a runner. That is a stated limit in the record, not a hole to close with a CI job.

**Why the composition variant is in scope.** A route that cannot sit in `cs-tracker`'s real
`app.css` beside AD-14's prescribed `@import "cuatro-contracts/tailwind.css"` is not a live route.
Observing that composition costs one more compile in a harness that is already standing, and Story
1.19 is where it gets acted on. This story records what happened and changes no application file.

## Verification

**Commands:**
- `node ops/daisyui-route-probe.mjs`, expected: exit 0, a table carrying all four variants for both
  components, `unmapped` differing from `literal`, and a named verdict for each route.
- `git status --porcelain`, expected: empty at the closing commit, and no scratch directory left
  under `tmpdir()`.
- `git diff --stat d4404ee -- contracts packages app public docker tests .github package.json
  pnpm-lock.yaml`, expected: empty.
- `git -C C:\CuatroEcosystem\cs-tracker-workspace\cs-tracker status --porcelain`, expected:
  unchanged from before the run.
- `corepack pnpm typecheck`, expected: exit 0 with the new `.ts` test file included.
- `corepack pnpm test --run`, expected: exit 0, and the totals grow by the cases the story adds.
  The story adds one `.ts` file, `ops/__tests__/daisyui-route-probe.test.ts`, covering the probe's
  pure parts with no Elixir, no network and no browser: `appCss` per variant, `fixtureHtml`,
  `declaredColourNames`, `emittedValues`, `preflightCount`, `sweepLeftovers` including the
  concurrent-run skip, and above all the verdict as a pure function, so a dead route, a build that
  did not compile, a missing reference and two components that disagree each keep failing their
  case after a later edit. Nothing under `app/`, `packages/` or `contracts/` is touched, so every
  pre-existing case is expected unchanged from `d4404ee`.
- Punctuation sweep over every file written, run against a positive control carrying an em-dash, an
  en-dash, a double-dash and an emoji so it cannot pass vacuously.

**Manual checks:**
- Read the recorded `app.css` fragment as Story 1.19 would apply it and confirm it names the live
  route, the theme name and the token, and would drop into `cs-tracker`'s `app.css` unedited.

## Auto Run Result

Status: done
Blocking condition: none

**Summary.** A third pass, a follow-up review of an already complete story, run because the previous
pass set `followup_review_recommended: true`. The finding is unmoved and was re-measured rather than
re-asserted: both AD-15 routes are live, they render identically, route A is the one Story 1.19
applies. What changed is the probe's behaviour on every path that is not the happy one, three places
where a failure was reported as a different failure, and four claims in the record that stated more
than the run measured.

**Files changed.**
- `ops/daisyui-route-probe.mjs`: a scratch tree that survived removal now fails the run instead of
  exiting 0; three exit codes separate a failed case, a probe defect and a Block If, and a blocked
  run prints its reason on stdout; the `Leftover sweep` case survives a concurrent probe and fails on
  a leftover it could not remove; `Composition`, `Verdict` and `unmapped control` no longer report an
  unread reference as a route that stopped resolving, as routes that render differently, or as a
  control that equals the literal; every reported figure reads through `COMPONENT_IDS`; `routeVerdict`
  refuses a verdict with no components or no readings; `ownerAlive` rejects pid 0 and negatives;
  `emittedValues` escapes and bounds its property; the scratch root can no longer leak between
  `mkdtempSync` and the `try`; `findTailwindBinary` guards its `readdirSync`; the timeout is one
  constant.
- `ops/__tests__/daisyui-route-probe.test.ts`: six cases added, 39 to 45. The one that matters most
  reads `contracts/tokens.css` and asserts the `literal` variant declares what it finds, so the
  probe's single hand-copied value is finally held by something the blocking `test` job runs. The
  others cover the `pid: null` branch the probe's own self-test depends on, pid 0 and negative pids,
  an empty id list, a missing reading, and the `emittedValues` boundary.
- `ops/daisyui-route.md`: the `# versions` block, the compile lines, the sweep line and the closing
  summary are now quoted rather than only asserted; the "neither touches `--color-primary`" claim is
  restated as load-bearing, with what was therefore not measured under `themes: false`; the one-line
  fragment is separated from its illustration; the badge chain cites its source; the source-detection
  negative discloses its second assumption; the exit-code table is added; the runs row counts five and
  says which figures each set reproduces.
- This spec: this pass in the Review Triage Log, and this result.

**Review findings breakdown.** 22 patches applied (high 0, medium 2, low 20), 0 deferred, 16
rejected, 0 intent gaps, 0 spec repairs.

**Follow-up review recommendation:** `true`. Patched this pass: high 0, medium 2, low 20. Score is
`3 x 2 + 1 x 20 = 26`, which is 5 or more.

**Verification performed.**
- `node ops/daisyui-route-probe.mjs`: exit 0, `7 cases, 7 PASS, 0 FAIL`, elapsed 75.4s, started
  2026-08-26T00:40:00.613Z, finished 2026-08-26T00:41:16.018Z. Every computed value, every emitted
  declaration, every verdict and all five compiled byte counts (18130, 18173, 18172, 18237, 23425)
  reproduced the recorded run. The only transcript line whose text moved is `PASS Leftover sweep`,
  whose wording this pass changed. Chromium 151.0.7922.34, tailwindcss v4.1.12, daisyUI 5.0.35,
  phoenix locked 1.8.13 against `~> 1.8.7`.
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test --run`: exit 0, 23 files, 537 cases, of which 45 are this probe's suite, up from
  the 39 the previous pass left. No pre-existing case moved.
- `git diff --stat d4404ee -- contracts packages app public docker tests .github package.json
  pnpm-lock.yaml`: empty.
- `git -C C:\CuatroEcosystem\cs-tracker-workspace\cs-tracker status --porcelain`: empty.
- No directory matching `cuatro-daisyui-probe-*` under `%TEMP%` after the run.
- Punctuation sweep over all four written files against a positive control carrying an em-dash, an
  en-dash used as a dash, a double-dash and an emoji: the control matched on all four, and the written
  files matched nothing but a `git diff --` pathspec separator inside a quoted command.
- Manual check: the recorded fragment read as Story 1.19 would apply it. It now names the single
  declaration to insert, separately from the surrounding block that shows where it goes.

**Residual risks.**
- The failure paths this pass fixed are exercised by unit cases over the pure functions, not by a run
  that actually leaks a tree or loses its Chromium. `probe()` itself still has no standing case, which
  the previous pass decided against on the grounds that pinning it would take a refactor out of
  proportion to the file. That reasoning is unchanged and so is the gap.
- The finding remains a single-host observation on five runs, pinned to Tailwind 4.1.12 and daisyUI
  5.0.35, with nothing in CI able to notice either moving. That is Pending Operator action 2 in the
  record.
- The `unmapped` control depends on a daisyUI default theme that `cs-tracker` does not load. The
  record now says so and says what follows, but the consequence is real: Story 1.19 cannot reproduce
  the four-number comparison in `cs-tracker`'s own configuration as written.
- Three planning lines still say O-3 is open. Pending Operator action 1 owns that, and nothing
  detects the contradiction in the meantime.

