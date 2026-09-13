---
title: 'Record the adopted contract version and the automation policy'
type: 'feature'
created: '2026-08-27'
status: 'done'
baseline_commit: 'b1ab8248e4673c4e80e1eb8a0d33ffef0cec0dfe'
baseline_revision: 'b1ab8248e4673c4e80e1eb8a0d33ffef0cec0dfe'
cs_tracker_baseline_revision: '8adb8e254d4243b46a120659e12ada8934e002ef'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/ops/token-contract.md'
  - '{project-root}/ops/cs-tracker-token-adoption.md'
warnings: ['oversized', 'multiple-goals']
deferred:
  - summary: >-
      The Operator's cs-tracker commit 32a466a removed cuatro.fonts from the assets.setup alias
      after this story's rehearsal, so Story 1-19's record, its probe pin "The build pipeline
      places them" and cs-tracker/AGENTS.md:36-39 now assert an alias that no longer runs the task.
    evidence: |-
      Observed 2026-08-27T22:47:57Z by `node ops/cs-tracker-adoption-probe.mjs` against `cs-tracker`
      at `32a466a`: 19 cases, 18 PASS, 1 FAIL, the failure reading `It runs in assets.setup: false`.
      `git -C cs-tracker show 32a466a -- mix.exs` removes `"cuatro.fonts"` from `"assets.setup"` and
      says why: the Dockerfile runs `assets.setup` before `COPY lib lib` and `COPY assets assets`, so
      the task could not be found there and the container build broke on 2026-08-27, while `setup`
      still reaches `assets.build`, which runs it. Not caused by this story and not its to reconcile:
      the pin, the record row and the `cs-tracker/AGENTS.md` lines are Story 1-19's, which is
      awaiting-operator. Recorded in `ops/contract-adoption.md` as Pending Operator action 7 and the
      pin left red deliberately rather than moved.
    location: >-
      ops/cs-tracker-adoption-probe.mjs
    severity: medium
---

<intent-contract>

## Intent

**Problem:** The contract is published at `v1.0.0` and two applications render from it, but nothing
records which version each adopter is on, so the Epic 2 drift check (Story 2.23) and the Registry's
`token_contract` field (Story 2.5) have no record to read and Epic 6's trigger has no counter to
count. The no-unattended-automation rule (NFR-10, FR-19, AD-16) lives only in planning documents,
the versioning rule's "addition" category lives in `DESIGN.md` rather than beside the contract,
`cs-tracker` has never been measured against the accessibility floor after adoption (AD-19), and
the AD-16 change-propagation process has never once been executed, because `--token-scrim`
shipping inside `v1.0.0` deleted the cheap rehearsal `epics.md` had planned.

**Approach:** Write the Story 1.20 record, `ops/contract-adoption.md`: the adopted version of every
application with the exact file the drift check reads, the automation policy with the observed
state of all eleven estate repositories, the four versioning categories with what a pure addition
is, the AD-16 change-propagation runbook, and the propagation counter Epic 6 reads. State the policy
where it binds, in both repositories' `AGENTS.md`. Measure `cs-tracker` in a real browser at a
360px viewport on a locally running, seeded instance, against the 44x44 floor and the focus-ring
rules, and record every failure as a finding. Validate the runbook by walking it on a throwaway
`v1.0.1` on scratch branches in both repositories that are never pushed, never merged, and deleted
afterwards, and record what the walk found. Guard the record with a unit test so the recorded
published version and the header in `contracts/tokens.css` cannot drift apart in silence.

## Boundaries & Constraints

**Always:**
- The record is the artifact and the acceptance criteria are written against it (Epic 1 context,
  "Operator-action stories commit their evidence"). Every value in it is marked as a **Decision**
  with its reason or an **Observation** with the method that gathered it (NFR-9), and every date is
  ISO 8601 UTC.
- `cs-tracker`'s adopted version is **read off the header** of its vendored
  `assets/css/cuatro-contracts/tokens.css` at `8adb8e2`, never restated from memory, and the record
  names the exact target the Epic 2 check reads: repository, branch, path, the line, and the
  pattern `Contract v(\d+\.\d+\.\d+)`.
- The policy quotes NFR-10 (`prd.md:639`) and FR-19's three consequences (`prd.md:361-363`) and
  states a **checkable** definition of "a real test suite": one that exists, exercises the
  application's own code rather than tooling or scaffolding, and runs on a CI service on every
  push to the default branch, so that a merge nobody is watching is still gated by something.
  Every one of the eleven repositories `ops/estate.md:73-75` names gets a row, observed by `gh api`
  on the day, with the method stated.
- The versioning rule states all four categories (value change minor, addition minor, rename major
  including a typo fix, removal major), the first-publication rule, and deprecate then migrate then
  remove, each cited to the header (`contracts/tokens.css:4-5`), `DESIGN.md` § Versioning
  (`:1028-1045`) and `ops/token-contract.md:163-169`. A pure addition is defined in the record: a
  new name whose presence changes no value any existing consumer already reads.
- The accessibility pass reads `boundingBox()` and computed styles in Playwright's Chromium at a
  360px-wide viewport (AD-19) against the **running** application (`mix phx.server` on a seeded
  development database), never off the text of a stylesheet. A failure is recorded as a finding
  with route, selector, text and size, and is **not** corrected. The focus ring is read under real
  keyboard focus on an element sitting on each of the three grounds (`--token-bg`,
  `--token-bg-raised`, `--token-bg-raised-2`), with the ring's contrast against that ground computed
  by the WCAG 2.1 formula, and `transition-property` read for `outline` or `all`.
- The rehearsal bumps `packages/tokens/package.json` to `1.0.1` on a scratch branch, regenerates
  all three published files with the repository's own generators, records which gates go red in
  each repository, re-vendors into `cs-tracker` on a scratch branch there, runs the existing drift
  detector (`ops/cs-tracker-adoption-probe.mjs`) with one side bumped to show it fires, and tears
  down: both scratch branches deleted, both trees clean, both headers back at `1.0.0`, and every
  file under `contracts/` hashing to the value it had before the walk. The record says in words
  that the rehearsal counts for nothing toward Epic 6.
- Every new parser asserts it read something, every list is pinned rather than bounded, and every
  matcher is shown firing on a planted control, in the shape `app/__tests__/anchor-contract.test.ts`
  and `ops/__tests__/cs-tracker-adoption-probe.test.ts` use.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash and no
  emoji. Each commit is a subject line only. Every `pnpm` command is prefixed `corepack`.

**Block If:**
- `cs-tracker` cannot be started locally (no Postgres can be brought up, `mix` fails to compile
  the tree at `8adb8e2`) or no Chromium can be launched. The AD-19 pass is a measurement in a
  browser against real pages, and substituting a fixture page for the application is a decision
  the Operator owns.
- `gh api` cannot answer for one of the eleven repositories. The policy's list is an observation,
  and a row that cannot be observed may not be filled by assumption.
- A scratch commit reaches a remote, or the tree cannot be restored to `1.0.0` byte for byte after
  the walk. Stop and report rather than repair by hand.

**Never:**
- Never publish `v1.0.1`: never push a scratch branch, never merge one, and never leave a bumped
  header under `contracts/`, `public/contracts/` or `cs-tracker/assets/css/cuatro-contracts/` when
  the story closes. No contract change ships in this story; the published header stays `1.0.0`.
- Never edit a name, a value or a file under `contracts/` or `packages/` on `dev`, and never touch
  `.github/`, `app/`, `public/` or `docker/` in this repository.
- Never fix an accessibility finding in `cs-tracker`. daisyUI's control geometry is Story 8.1's
  restyle under `RESTYLE-SPEC.md` § Family A (AD-20: a step carries nothing else). The only file
  this story edits in `cs-tracker` is `AGENTS.md`.
- Never enable any dependency automation anywhere, and never add a Dependabot or Renovate
  configuration to any repository.
- Never make the accessibility probe a CI job: it needs a browser and a running Phoenix application
  with a database, and neither is on a runner (AD-21 is about gates that exist).
- Never push to any remote and never deploy. Both are Operator acts and are enumerated under
  `operator_actions` instead.
- Never count the rehearsal toward Epic 6's trigger, and never edit a planning artefact or
  `sprint-status.yaml`.

## I/O & Edge-Case Matrix

Every row is a named case one of the new suites runs and reports by name.

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| The record and the header agree | `ops/contract-adoption.md`, `contracts/tokens.css`, `packages/tokens/package.json` | The published version the record states equals the `Contract vX.Y.Z` header and the manifest version, all three `1.0.0` today | A disagreement fails naming all three values. A record with no published-version line fails rather than comparing nothing |
| The adopter row parses | The adopted-versions table in the record | A row for `cs-tracker` carrying a semver and the fixed path `assets/css/cuatro-contracts/tokens.css`, and a row for every one of the eleven repositories, adopted or not | A missing row, a non-semver, or a path that is not the fixed folder fails naming the row. A table with zero rows fails |
| The policy lists the estate | The policy table in the record, `ops/estate.md:73-75` | The set of repository names in the table equals the eleven `ops/estate.md` names, no more and no fewer, each with a test-suite column and an automation column filled | A missing or extra name fails naming it. An estate parse that yields fewer than eleven names fails before comparing |
| The counter equals the ledger | The propagation count line and the propagation-events table | The integer equals the number of event rows, `0` today | A mismatch fails naming both. A count line that does not parse as an integer fails |
| The Anchor row matches the tree | The Anchor's automation cell and the repository root | The cell reads none, and `.github/dependabot.yml`, `renovate.json`, `renovate.json5`, `.renovaterc`, `.renovaterc.json`, `.github/renovate.json` and `.github/renovate.json5` are all absent | A planted config with the cell still reading none fails naming the file |
| The session cookie is Plug's shape | Secret key base, signing salt, steam id | A three-segment token whose first segment decodes to `HS256`, whose payload decodes to an ETF map (`131,116`) carrying `"steam_id"`, and whose signature is HMAC-SHA256 over the first two segments under the PBKDF2-derived key | A different secret or salt yields a different signature. The running application is the real verifier: `GET /` with the cookie answers `200` and without it answers a redirect to `/auth/steam` |
| Hit-target verdict | A bounding box and the floor read off `:root` as `--tap` | `44 x 44` or larger on both axes passes; `43.5` on either axis fails naming the axis and the value; a hidden or zero-area element is skipped and counted as skipped, never as passed | A floor that could not be read off `:root` throws rather than defaulting to 44 |
| Focus-ring verdict | Computed `outline-width`, `outline-style`, `outline-color`, `outline-offset`, `transition-property` on a focused element, and the four contract values read off `:root` | Width equals `--stroke-focus`, style is `solid`, colour equals `--token-focus`, offset equals `--focus-offset`, and `transition-property` names neither `outline` nor `all` | Each departure fails naming which. A read that returns an empty string throws rather than comparing |
| Ground classification | The focused element and its ancestors | The effective ground is the first painted `background-color` from the element upward, classified as one of the three grounds by equality with the `:root` values; the ring's contrast against it is computed and must clear 3:1 | A ground that matches none of the three is reported by value, never silently binned, and the case fails |
| Route sweep | `/`, `/browse`, `/inventory`, `/wishlist`, `/items/:id`, and `/auth/steam/callback?openid.mode=bad` | The five owner routes answer `200` with the cookie and a redirect without it; the callback renders the sign-in failure page at `401` | A route answering anything else fails naming the route and the status |
| The rehearsal bump turns the right pins red | The scratch branch at `1.0.1` | `corepack pnpm test --run` fails at `packages/tokens/__tests__/tokens-contract.test.ts:645` and at the new record test, and nowhere else; `mix test test/cs_tracker_web/token_contract_test.exs` fails at `:342` after the re-vendor | Any other suite going red is recorded as a finding. A suite that stays green when the record says it should fail is recorded as a finding too |
| The drift detector fires | `contracts/` at `1.0.1`, the vendored folder at `1.0.0` | `node ops/cs-tracker-adoption-probe.mjs` reports the verbatim-copy case FAIL naming `tokens.css` and both hashes | A PASS in that state is a finding about the detector |
| Teardown restores the world | Both repositories after branch deletion | `git status --porcelain` empty in both, `git branch --list 'scratch/*'` empty in both, both `tokens.css` headers read `1.0.0`, and every file under `contracts/` hashes to its pre-walk sha256 | Any difference is a Block If |

</intent-contract>

## Code Map

Gathered 2026-08-27. `cuatro-portfolio` clean at `b1ab824`, branch `dev`. `cs-tracker` clean at
`8adb8e2`, branch `main`, at `C:\CuatroEcosystem\cs-tracker-workspace\cs-tracker`, not yet pushed
(Story 1-19 `operator_actions` item 1).

**The version, and where it is pinned (what a bump turns red):**
- `packages/tokens/package.json:3` `"version": "1.0.0"`, **the single source**. `packages/tokens/build.mjs:62-73`
  reads it, refuses anything but exact `X.Y.Z`, and writes it at `:234` (tokens header) and `:582`
  (adapter header). `packages/fonts/build.mjs:88-100,141,299` reads the same manifest for the fonts
  header. So a bump is one edit plus `corepack pnpm tokens:build` and `corepack pnpm fonts:build`
  (`package.json:18,21`; the fonts build is arithmetic over committed JSON, no Python).
- `contracts/tokens.css:2`, `contracts/tailwind.css:2`, `contracts/fonts.css:2`: the three headers.
  `contracts/tokens.css:4-5` states the versioning rule in the published file.
- `packages/tokens/__tests__/tokens-contract.test.ts:641-652`: header equals manifest, **and `:645`
  pins the literal `1.0.0`**. `ops/token-contract.md:573-580` "When the contract version moves" lists
  the four things that change together in this repository.
- `cs-tracker/test/cs_tracker_web/token_contract_test.exs:338-343`: the adopter's own pin,
  `assert tokens =~ "Contract v1.0.0"` at `:342`. `:31-41` `@expected_files` pins the nine-file list.
- `ops/cs-tracker-adoption-probe.mjs`: `hashTree` and `compareHashes` compare `contracts/` against
  the vendored folder file by file (`ops/cs-tracker-token-adoption.md:41-62`); this is the only
  drift detector that exists today, and it is hand-run. `:89` resolves `cs-tracker` beside this
  repository; `:975-977` loads `@playwright/test`; `:1106` launches Chromium; `:215` `say`; `:1862-1884`
  the exit-code discipline (0 pass, 1 fail, 2 defect, 3 Block If) that the new probe copies.
- `ops/cs-tracker-token-adoption.md:47-57`: the nine sha256 values the vendored folder carries at
  `8adb8e2`, which the teardown check compares against. `:77` records the adopted version as an
  Observation asserted by the Elixir suite.
- Served surface, **Observed 2026-08-27T21:20Z** by `curl -D -`: `https://cuatro.dev/contracts/tokens.css`
  answers `200`, `last-modified: Thu, 27 Aug 2026 19:06:39 GMT`, body header `Contract v1.0.0`.

**The records this story extends (read, then append a pointer):**
- `ops/token-contract.md:149-178` § Versioning; `:177-178` says recording adopted versions "is Story
  1.20". Append one sentence pointing at the new record.
- `ops/anchor-token-adoption.md:637-644` "To be added by Story 1-20" table. Append one sentence
  saying where each row landed. `:642` names the adopted-versus-loaded distinction the ledger makes.
- `ops/cs-tracker-token-adoption.md:710` Stated-limits row "The 44x44 hit-target pass was not made
  here", owner Story 1.20. Append a pointer to the pass record; keep the row.
- `ops/estate.md:73-75`: the eleven repository names, the source of the policy table's row set.
  `:186-213` shows the `gh repo view` method and the owner `LuigiEspinosa`.

**The governing text:**
- `ARCHITECTURE-SPINE.md:172-176` AD-16 (the rule, `token_contract`, the fixed folder name);
  `:184-188` AD-18 (what the scheduled job checks); `:190-194` AD-19 (360px, `boundingBox()` at least
  44x44, focus rules, "measured once by hand ... and the result recorded", "a failure is recorded as
  a finding").
- `prd.md:356-363` FR-19 and `:639` NFR-10. `DESIGN.md:1028-1045` § Versioning, the settled
  addition rule and the first-publication rule. `epics.md:1928-1987` the story; `:4371-4397` the
  trigger restated and the rehearsal's exclusion; `:4399-4420` Story 6.1's ledger shape (date, from,
  to, which Satellites re-vendored, count stated explicitly, appended to this record as events occur);
  `:2223-2224` Story 2.5 sets `token_contract` on `cs-tracker` "to the version Story 1.20 recorded";
  `:2885-2896` Story 2.23's check reads `Contract vX.Y.Z` out of the vendored `tokens.css`;
  `:4818-4824` Story 8.4 later wants every application's vendored version at a glance.
- `contracts/tokens.css:93-100` `--tap: 44px`, `:107-112` `--stroke-focus: 2px`, `--focus-offset: 3px`,
  `:27-38` the grounds and `--token-focus`.

**The estate, Observed 2026-08-27 between 21:16Z and 21:27Z by `gh api` as `LuigiEspinosa` (token
scopes `repo`, `workflow`, `read:org`), to be re-gathered and re-dated by the implementation:**
- All eleven: `allow_auto_merge=false`; `automated-security-fixes` `{"enabled":false}`; no
  `.github/dependabot.yml`, no `renovate.json`/`.json5`, no `.renovaterc`, no `.github/renovate.json`
  on the default branch; zero pull requests authored by `dependabot[bot]` or `renovate[bot]` on the
  first page of each repository's PR list. Dependabot **alerts** are enabled on `cuatro-portfolio`
  only (`vulnerability-alerts` 204) and disabled on the other ten (404). GitHub App installations
  could not be listed with this token (`user/installations` 403), so an app-based Renovate is
  excluded by the absence of its config file and of any bot-authored PR, and the record says so.
- CI runs a suite on push: `cuatro-portfolio` (`ci.yml` `test` job, `pnpm test --run`, plus the
  `rendered-output` Playwright job), `cuatro-tracker` (`ci.yml` `test` job `pnpm test --coverage`
  and an `e2e` job, 122 test-shaped files), `digital-library` (`ci.yml` `pnpm test -- --coverage`,
  34 test files). Suites with no CI: `cs-tracker` (ExUnit, 653 tests at `8adb8e2`, no `.github`),
  `cs-tournament` (58 Vitest files under `lib/`, `"test": "vitest run"`, no workflow), `list-wheel`
  (4 Angular spec files, substantive, `ng test --no-watch`, no workflow), `MaiCoin` (one Hardhat
  test of 34 lines, no workflow). No suite at all: `cuatro-finance`, `StreamVault`, `poketracker-go`
  (default branch holds only `LICENSE`; each has a `dev` branch, not inspected), `Mutuo` (ten files,
  a `frontend/assets/css/tokens.css` that is Mutuo's own design tokens, `--color-bg-base: #0f0b1f`,
  not the vendored folder and not an adoption).
- `cuatro-tracker/.github/workflows/ci.yml` runs on push to `main` and `dev`; `digital-library`'s on
  every push. Neither carries an auto-merge step.

**`cs-tracker`, for the accessibility pass (read-only except `AGENTS.md`):**
- `config/dev.exs:4-11` Postgres `postgres`/`postgres` at `localhost`, database `cs_tracker_dev`;
  `:22` endpoint `127.0.0.1:4000`; `:26` the dev `secret_key_base`. `config/test.exs:35-41` the test
  database, the same credentials, so one Postgres serves both `mix test` and `mix phx.server`.
- `lib/cs_tracker_web/endpoint.ex:7-25` `@session_options`: cookie store, key `_cs_tracker_key`,
  a signing salt (read at run time, deliberately not recorded here), no encryption salt,
  `same_site: Lax`. `:37` `session_options/0` exposes
  them. **Plug's cookie store signs `:erlang.term_to_binary(session)` with `Plug.Crypto.MessageVerifier`
  (HS256 over `base64url("HS256") <> "." <> base64url(binary)`) under a key derived by PBKDF2-SHA256,
  1000 iterations, 32 bytes, salt = signing salt**, which the probe reproduces in Node so it can mint
  an Owner session without the Steam round-trip.
- `lib/cs_tracker_web/plugs/require_owner.ex:29-40` and `lib/cs_tracker_web/live_assigns.ex:19-32`:
  the gate compares session `"steam_id"` (string key, `live_assigns.ex:20-24`) with
  `Application.get_env(:cs_tracker, :steam_id)`. `config/runtime.exs:59-101`: in `:dev` that value
  comes from `STEAM_ID`, must be 17 digits, and is `nil` when unset (fail closed). The server is
  started with `STEAM_ID=76561198000000000`, the id `test/support/conn_case.ex:39` uses.
- `config/runtime.exs:28` `KILL_SWITCH=true` disables all outbound HTTP (price refresh, catalog and
  inventory sync), which keeps the run hermetic; `root.html.heex:16-25` then renders the offline
  banner (`bg-red-600`, the repository's one Tailwind palette literal), a real surface the pass
  measures like any other.
- `lib/cs_tracker_web/router.ex:24-61`: `/auth/steam`, `/auth/steam/callback`, then behind the owner
  gate `/` (`DashboardLive`), `/browse`, `/wishlist`, `/items/:id`, `/inventory`. `auth_controller.ex:59-70,176-177,206-210`:
  a callback with `openid.mode` other than `id_res` renders `auth_html/failure.html.heex` at `401`,
  the one page an anonymous visitor sees.
- `lib/cs_tracker_web/components/layouts.ex:50-127` the shell: `navbar min-h-14` on `bg-base-100`
  with the hamburger `btn btn-ghost btn-sm btn-square md:hidden` (`:56-68`), the wordmark link
  (`:69-82`), and the mobile disclosure `#mobile-nav` toggled client-side (`:105-119`), whose links
  the probe reveals by clicking the hamburger. `core_components.ex:103-130` `button/1` is a daisyUI
  `btn`; **daisyUI 5's `--size-field` makes a default `btn` and `input` 40px tall and `btn-sm` 32px,
  so 44x44 findings are expected and are the reason AD-19 asks for the pass.**
- `lib/cs_tracker/catalog/item.ex:30-61,78-103` (`market_hash_name`, `name`, `source` in
  `bymykel|itsrythem` required), `lib/cs_tracker/inventory/entry.ex:51-69` (`assetid`, `classid`
  joins to items by `classid`, `item_id` optional), `lib/cs_tracker/wishlist/entry.ex:22-29`
  (`item_id` unique). `priv/repo/seeds.exs` is empty and `test/support/` carries JSON fixtures only,
  so the pass seeds a dozen items, a few inventory entries and wishlist rows through these schemas
  from a scratch `.exs` **outside the repository** (`mix run <scratchpad>/seed.exs`), so `/browse`,
  `/inventory`, `/wishlist` and `/items/:id` render rows, cards, badges and controls rather than
  empty states. `dashboard_live.ex:78-86` reads counts and the recently-viewed strip, which fills
  after `/items/:id` is visited (`item_live.ex:57`).
- `_build/dev` exists and `_build/tailwind-windows-x64.exe` is the pinned 4.1.12 binary
  (`config/config.exs:209-217`); `mix.exs:97-100,116` `setup`, `test` and `assets.build` aliases.
- `cs-tracker/AGENTS.md:32-41`: the Cuatro entries Story 1-19 added, where the policy bullet goes.

**This repository's harness for the new suites:**
- `vitest.config.ts:15` excludes only `tests/e2e/**`, so `ops/__tests__/*.test.ts` runs under the
  blocking `test` job (`.github/workflows/ci.yml:10-29`). `AGENTS.md:46-47`: 600 tests across 26
  files at the block's date; **649 across 27 at `b1ab824`** (Story 1-19's result).
- `ops/__tests__/cs-tracker-adoption-probe.test.ts:1-57` the import shape (`// @vitest-environment
  node`, pure exports only, `HERE` constant). `ops/cs-tracker-adoption-probe.mjs:77-85` the guarded
  `moduleDir` idiom for `import.meta.url` under Vitest; `:1106-1112` the Chromium launch and its
  install hint. `contrastRatio` is exported there and is reused rather than rewritten.
- `AGENTS.md:1-2,133`: the whole file is the managed `bmad:context` block, replaced on refresh;
  "Keep anything you want preserved outside the markers". The policy goes **after** `<!-- /bmad:context -->`.
- Host: Windows 11, `pnpm` not on PATH (`corepack` prefix), Playwright `1.62.1` with Chromium
  installed (Story 1-19 ran it this afternoon), Docker `29.7.2`, Elixir on OTP 28 with Mix `1.19.5`,
  `gh` authenticated.

## Tasks & Acceptance

**Execution, in `cuatro-portfolio`, in this order:**
- `ops/cs-tracker-accessibility-probe.mjs`: new, in the `ops/*.mjs` house style. Reads the dev
  `secret_key_base` out of `cs-tracker/config/dev.exs` and the session options out of
  `endpoint.ex`, mints the Owner cookie, launches Chromium at `360x800`, and for each route reads
  every visible interactive element's bounding box (`a[href]`, `button`, `input`, `select`,
  `textarea`, `summary`, `[role=button]`, `[role=link]`, `[tabindex]:not([tabindex="-1"])`),
  revealing the mobile menu first, then focuses one element on each ground with keyboard focus and
  reads the ring. Prints PASS or FAIL per named case with the values read, exits non-zero on any
  failure, `3` when nothing could be observed, and takes the base URL from `CS_TRACKER_URL`
  (default `http://127.0.0.1:4000`) and the id from `CS_TRACKER_STEAM_ID` (default the
  `conn_case.ex` id). Pure parts exported: cookie minting, the hit-target and ring verdicts, ground
  classification, the summary.
- `ops/__tests__/cs-tracker-accessibility-probe.test.ts`: new. The pure parts under the blocking
  `test` job with planted controls: the cookie's three segments and HS256 header, the ETF payload's
  leading bytes and key, a changed secret changing the signature, the verdicts on boxes of `44`,
  `43.5`, `0` and hidden, the ring verdict on a transitioned outline and on `all`, and the ground
  classifier on an unclassifiable value.
- `ops/cs-tracker-accessibility-pass.md`: new, written from the probe's run. The AD-19 record:
  environment (host, Chromium, viewport, `cs-tracker` revision, how the server was started, the
  seed script quoted so the run is repeatable), method (what "interactive" means, how the floor and
  the four ring values were read off `:root`, how the ground is classified), the per-route table
  (elements read, passes, skipped, failures), the findings numbered `F-1..` with route, selector,
  text and measured size, the focus-ring table across the three grounds with the computed contrast,
  the probe transcript verbatim, stated limits, and Pending Operator actions.
- `ops/contract-adoption.md`: new. The Story 1.20 record, in the house shape of `ops/token-contract.md`
  and `ops/cs-tracker-token-adoption.md`. Sections, in order: what this story did; **the adopted
  versions**, a table with one row per estate application (consumption route, the vendored path or
  the reason there is none, the header read, the adopted version, nature and method), with the
  Anchor at `1.0.0` because it `@use`s `contracts/` in place and `cs-tracker` at `1.0.0` from
  `assets/css/cuatro-contracts/tokens.css:2` at `8adb8e2`; **the exact target of the Epic 2 drift
  check**, stated as repository, branch, path, line and pattern, plus what the check compares it
  against (`token_contract`) and the served surface at `https://cuatro.dev/contracts/tokens.css`;
  **the automation policy**, quoting NFR-10 and FR-19, the checkable definition of a real test suite,
  where the rule is stated so it binds, the eleven-row table (test suite: files, runner, CI runs it;
  dependency automation: config files, security updates, auto-merge, bot-authored PRs; nature and
  method), the confirmation for the Anchor and `cs-tracker`, and the stated limit about app
  installations; **the versioning rules**, the four categories, the first-publication rule, the
  deprecate then migrate then remove model, and what a pure addition is, each with its source;
  **the change-propagation runbook**, the six steps `epics.md:1978-1980` names (bump the header,
  publish, notify each adopter, re-vendor the folder, update the Registry `token_contract` value,
  confirm the scheduled drift check reads the new value) with the exact commands and the pins each
  turns red, for a MINOR and for a MAJOR, where "notify" is defined as appending a ledger row naming
  the adopter and the from and to versions and opening a work item in the adopter's own tracker
  (for `cs-tracker`, a story under `C:\CuatroEcosystem\cs-tracker-workspace\_bmad-output`) with the
  pointer written into that row; **the rehearsal**, the transcript of the `v1.0.1` walk, what was
  found, what could not be walked and why (the notice is quoted as a dry run and nothing is opened,
  the Registry field is Story 2.5, the scheduled check is Story 2.23), and that it counts for
  nothing; **the propagation ledger**, the line `Propagation count: **0**` and the empty events
  table in Story 6.1's columns, with the exclusions named; **the AD-19 pass**, one paragraph with
  the headline result and a pointer to the pass record; stated limits; Pending Operator actions;
  maintaining this file.
- `ops/__tests__/contract-adoption.test.ts`: new. Parses the record off disk and asserts the first
  five matrix rows, with a planted control per parser and a vacuity guard per parse. Written
  against the record's tables so the rehearsal can show it going red on the bump.
- `AGENTS.md`: append, after `<!-- /bmad:context -->`, a short section stating the policy (no
  automated dependency merge in any estate repository without a real test suite as the record
  defines one; none enabled here; enabling one is a recorded decision) and pointing at the record.
- `ops/token-contract.md`, `ops/anchor-token-adoption.md`, `ops/cs-tracker-token-adoption.md`: one
  appended sentence each, at the lines the Code Map names, saying where Story 1.20's content landed.

**Execution, in `cs-tracker` (`C:\CuatroEcosystem\cs-tracker-workspace\cs-tracker`):**
- `AGENTS.md`: one bullet beside the Cuatro entries at `:32-41`: no automated dependency merge is
  enabled here, none may be enabled while nothing runs `mix test` on a push, and the record that
  governs it is `ops/contract-adoption.md` in `cuatro-portfolio`. Committed on `main`; the push is
  the Operator's, as it was for Story 1-19.

**Execution, transient (nothing committed):**
- A Postgres 16 container for the run, the seed script under the scratchpad, the running server,
  and the two scratch branches `scratch/ad16-rehearsal-v1.0.1`, all removed before the story closes.

**Acceptance Criteria:**
- Given AD-16 requires each Satellite's adopted version declared and later verified, when the record
  is read, then it states `cs-tracker` adopted `1.0.0`, read off the `Contract v1.0.0` header of its
  vendored `cuatro-contracts/tokens.css` at `8adb8e2`, names the exact file the Epic 2 drift check
  reads as repository, branch, path, line and pattern, and the blocking `test` job fails if the
  record's published version and the header of `contracts/tokens.css` ever disagree.
- Given NFR-10 and FR-19 forbid unattended automation in repositories lacking a real test suite,
  when the policy is read, then it states the rule, defines a real test suite checkably, lists all
  eleven estate repositories with their observed state and the method, names which have one, shows
  that none is enabled in the Anchor or in `cs-tracker` (no configuration file, auto-merge off,
  security updates off, zero bot-authored pull requests), and both repositories' `AGENTS.md` carry
  the rule where it binds.
- Given AD-19 requires `cs-tracker` measured once by hand after adoption, when the pass is run, then
  every visible interactive element on `/`, `/browse`, `/inventory`, `/wishlist`, `/items/:id` and
  the sign-in failure page has its bounding box read in Chromium at 360px on the running
  application, every element under 44 on either axis is listed as a numbered finding with route,
  selector, text and size, the focus ring is read under keyboard focus on an element on each of the
  three grounds with its computed width, style, colour, offset, contrast and `transition-property`,
  and nothing in `cs-tracker` changes but `AGENTS.md`.
- Given AD-16's model has no atomic commits across eight repositories, when the record is read, then
  it states value change minor, addition minor, rename major including a typo fix, removal major,
  the first-publication rule, deprecate then migrate then remove, and what a pure addition is, each
  cited to its source.
- Given the runbook must be validated by walking it, when the walk is made on a throwaway `v1.0.1`,
  then each of its six steps is either executed with its transcript quoted or marked not walkable
  with the reason, the findings are recorded (which pins went red in each repository and whether the
  drift detector fired with one side bumped), both scratch branches are deleted, both trees are
  clean, both headers read `1.0.0`, every file under `contracts/` hashes as before, and the
  propagation count reads `0` with the rehearsal excluded by name.
- Given NFR-2 and AD-21 bind every step, when the change ships, then `corepack pnpm typecheck` and
  `corepack pnpm test --run` are green with the new cases counted and no pre-existing case moved,
  `git diff b1ab824 --stat -- contracts packages .github app public docker` is empty, and
  `git diff 8adb8e2 --stat` in `cs-tracker` names `AGENTS.md` and nothing else.

## Spec Change Log

## Review Triage Log

### 2026-08-27: Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 23: (high 0, medium 8, low 15)
- defer: 1: (high 0, medium 1, low 0)
- reject: 8: (high 0, medium 0, low 8)
- addressed_findings:
  - `[medium]` `[patch]` **The Anchor-row guard was one-directional and the documented enable path
    turned CI red at its first step.** The test pinned the cell to the literal `none` and asserted no
    configuration file existed, as two unconditional expectations, so moving the row first (as the
    policy said to) failed the blocking job until the test itself was rewritten. The guard now holds
    the cell and the tree equal in both directions: `none` requires nothing present, and any other
    cell must name every configuration present and nothing more, shown firing on planted controls
    both ways. `AGENTS.md` and the record now say the row and the configuration land in one commit.
  - `[medium]` `[patch]` **Runbook step 6 expected a failure the check cannot produce.** It said the
    scheduled check must fail between step 1 and step 4, but AD-18's check compares the vendored
    header with `token_contract`, both of which still read the old version in that window. Step 5 is
    now pinned to the re-vendor (the `cs-tracker` commit first, the Registry edit second, both named
    in the ledger row), and step 6 states what proves the check reads the header: a run after both
    passes, a run in the window between them fails, and a check that passes across a moved header
    with an unmoved field is broken.
  - `[medium]` `[patch]` **"A merge nobody is watching is still gated" was claimed and never
    observed.** A workflow gates nothing unless its run is a required status check. Branch protection,
    branch rules and rulesets were observed for all eleven repositories (22:38:57Z to 22:41:09Z): no
    repository requires its suite, the Anchor's `main` protection names zero required contexts,
    `digital-library`'s ruleset carries only deletion and non-fast-forward rules, and the four private
    repositories answer `403` because protection is not on the plan. A "Required check on the default
    branch" column carries each observation, condition 3 is narrowed to what it establishes, and a
    fourth condition for enabling automation (the run is a required check) is stated in the policy
    sentence, the record and `AGENTS.md`, holding nowhere today.
  - `[medium]` `[patch]` **The record's `cs-tracker` adopted-version cell was pinned to nothing.**
    The test held the published version to the Anchor's header; the adopter row was only checked for
    a semver and the fixed path; `cs-tracker`'s own pin is a literal; the hand-run probe never read
    the record. A re-vendor that moved every other pin and forgot the row left every gate green. The
    parsers now live in `ops/contract-adoption.mjs`, and `ops/cs-tracker-adoption-probe.mjs` carries
    a nineteenth case holding the row equal to the vendored `Contract vX.Y.Z` header, failing naming
    both, with its verdict pinned in the sibling suite. The record names it as the hand-run stand-in
    for step 6's declaration-against-header comparison until Story 2.23 exists.
  - `[medium]` `[patch]` **The ring case's pass condition, the per-route condition and the transition
    vacuity guard lived inline in `probe()`, which no test enters.** Dropping the 3:1 comparison left
    all 32 cases green. Extracted `ringCaseVerdict` and `routeCaseVerdict` as pure functions, used in
    the run and pinned with planted controls at 2.99, 3, null contrast, a mismatched ground,
    `:focus-visible` false, and a route with elements read but none measured, which now fails.
  - `[medium]` `[patch]` **`:focus-visible` was computed and discarded**, so the method's claim that
    the ring was read under it had no evidence. It is now printed on every ring line, fails the ring
    case when false, and is a column of the pass record's focus-ring table.
  - `[medium]` `[patch]` **The configuration-location list was seven paths and missed the rest of
    what Dependabot and Renovate document** (`renovate.jsonc` and the `.github/`, `.gitlab/` and
    `.renovaterc` variants, `.github/dependabot.yaml`, a `renovate` key in `package.json`). The
    module, the test, the record's method paragraph and `AGENTS.md` now carry the full set of fifteen
    locations plus the `package.json` key, and a second `gh api` sweep observed every one absent on
    all eleven default branches.
  - `[medium]` `[patch]` **The by-shape section attributed all 74 hit-target findings to daisyUI or
    Tailwind geometry**, when the wordmark's padding, the mobile nav links' padding, the Remove
    buttons, the bare item title links and the small text links are the application's own markup.
    Recounted by cause (18 daisyUI defaults, 56 the application's own), with the routing to Story
    8.1 restated as AD-20's rule rather than as attribution, and Pending action 3 reworded so "two
    causes" cannot read as two findings.
  - `[low]` `[patch]` Added the PATCH row to the versioning table: not a category the contract uses,
    the third number stays `0` in a real release, and `1.0.1` was used because `epics.md:1981` names
    it and no real release can produce it.
  - `[low]` `[patch]` The MAJOR path (alias, deprecate, later removal, migrating `var(--token-*)` in
    `app.css`) was never rehearsed and is now on the list of steps that remain a guess written in the
    imperative.
  - `[low]` `[patch]` The ledger header could not hold what steps 3 and 6 say a row carries; added
    the deprecated-names-and-removal-version and detector-run columns while the table is empty, and
    updated the test's fragment.
  - `[low]` `[patch]` "The 12 controls that do not transition it are daisyUI `.btn` elements" was
    wrong (eleven `.btn` plus the recently-viewed card link); corrected from the new transcript.
  - `[low]` `[patch]` The hyphenation claim was narrowed to Epic 1 stories with `sprint-status.yaml`
    keys, later epics keep `epics.md`'s dotted form, and the `ops/cs-tracker-token-adoption.md` row
    uses that file's own form.
  - `[low]` `[patch]` The test-file counting rule is stated (blobs only, directories excluded), which
    is why the spec's same-day sweep counted 122, 58 and ten where the record counts 118, 57 and 7.
  - `[low]` `[patch]` "Maintaining this file" and the test comment now say a waypoint change moves
    the `ops/estate.md` sentence, the pinned count and both tables together.
  - `[low]` `[patch]` The private repository's signing salt value is elided from the pass record,
    the probe's header line and this spec; the cookie name stays; a stated limit says the salt is
    read at run time and deliberately not recorded.
  - `[low]` `[patch]` Extracted `assertEstateCovered`, which throws naming every missing and extra
    name, used in the real assertions and shown firing on planted controls.
  - `[low]` `[patch]` The environment row records the runtime `Erlang/OTP 28 [erts-16.4]` line
    beside the compiled-with note.
  - `[low]` `[patch]` The column "Vendored file read" is "File read", since the Anchor's cell is not
    a vendored file; the header lookup and fragment moved with it.
  - `[low]` `[patch]` Small corrections: the empty Measured cell filled, "at the root" replaced by
    "in the repository", and the citation `ops/token-contract.md:573-580` corrected to `:576-583`
    after this story's own three-line insertion above it, with the other appended files checked for
    the same shift.
  - `[low]` `[patch]` Probe robustness: early `BlockedError` for an undeclared ring token, a bounded
    hamburger click, environment failures after the first request classified as blocked (3) rather
    than a defect (2), up-front validation of the two environment variables, a case-insensitive
    realpath comparison so the probe cannot run nothing and exit 0, background-image ancestors
    treated as painted and unclassifiable, animations awaited and the interactive count checked
    stable during a sweep, and UNREACHABLE distinguished from PLANTED when real elements exist on a
    ground that Tab could not reach.
  - `[low]` `[patch]` A transition finding now requires a `transition-duration` above zero; the
    duration is printed on each line, and the pass record says 29 elements were excluded as `all`
    over `0s`, which is why T-1 to T-67 became T-1 to T-38 on the re-run and the `--token-bg-raised`
    ring now passes.
  - `[low]` `[patch]` Runbook step 4 chains `Remove-Item -ErrorAction Stop` with `&&` so a failed
    removal cannot be followed by a nested copy, and says why.

**No loopback, and why.** Nothing was routed to `intent_gap` or `bad_spec`, and nothing inside
`<intent-contract>` was touched. Every finding is a defect in an artifact this story wrote: three
guards that could not fail or failed the wrong way, one runbook step that expected a failure the
check cannot produce, one claim about gating that was never observed, one attribution that routed
findings under a false premise, and a set of statements that claimed more than the run measured.
Re-deriving from an amended spec would produce the same record, the same probe and the same tests
with these corrections, which is what the patches did. The one finding that came closest to a spec
defect, the adopter-cell pin, was resolved by adding one named case to the existing hand-run probe,
which the spec's edit boundary permits.

**One finding was deferred.** After this story's rehearsal, the Operator committed `32a466a` to
`cs-tracker`, removing `cuatro.fonts` from the `assets.setup` alias so the container build could run;
Story 1-19's record, its probe pin and `cs-tracker/AGENTS.md:36-39` now assert an alias that no
longer runs the task, and the sibling probe's re-run reports that one FAIL. Not caused here, and not
this story's to reconcile.

**Eight findings were rejected.** That the spec file is untracked (the orchestrator commits it, as
it did for Stories 1-18 and 1-19); that the drift check's target does not exist on the remote until
`cs-tracker` is pushed (disclosed in the record and already Story 1-19's operator action); that the
policy binds `cs-tracker` by prose only (it has no CI to bind it otherwise, which the record states);
that "a real test suite" is the diff's own definition (disclosed as a Decision, and the intent left
the term undefined); that the third ground's ring was read on a planted control (no real element
sits there, labelled as such, and the absence is recorded as a finding); that the rehearsal's
folder-hash stand-in validates a different property than step 6 names (now closed by the nineteenth
case); that the story should end at `awaiting-operator` (no acceptance criterion needs a human act;
the records' Pending Operator actions are follow-ups owned by Stories 1-19, 2.5, 2.23 and 8.1); and
that the footprint is larger than a documentation story implies (the spec chose the record-plus-guard
reading deliberately, and no contract surface moved).

### 2026-08-27: Follow-up review pass

- intent_gap: 0
- bad_spec: 0
- patch: 21: (high 0, medium 2, low 19)
- defer: 0
- reject: 14: (high 0, medium 0, low 14)
- addressed_findings:
  - `[medium]` `[patch]` **`cs-tracker/AGENTS.md`'s bullet carried three conditions where the record
    carries four.** A reader who added a workflow there would have concluded automation was then
    permitted. The bullet now states the required-check condition, that it cannot hold on a private
    repository on the current plan, and that the decision lands in the record before any
    configuration; committed on `main` as `ae34619`, the push the Operator's. The record's
    "Where the rule is stated" row and its line citation (`:42-50` among `:32-50`) follow.
  - `[medium]` `[patch]` **"Maintaining this file" told the next editor to add a second row per
    re-observed repository, which `assertEstateCovered` fails as "listed twice".** The instruction
    now says the adopted-versions and policy tables keep one row per repository, the cells are
    replaced and the old value and date carried in the Nature and method cell, and every other table
    gains a row.
  - `[low]` `[patch]` The prose in "What the walk found" cited `contract-adoption.test.ts:266` as
    current; it is `:132` (`assertVersionsAgree`) since the parsers moved. Both are now named, the
    transcript's as historical.
  - `[low]` `[patch]` Step 4 prescribes `Remove-Item ... -ErrorAction Stop && Copy-Item` and the walk
    ran the `;` form; the runbook now says so beside the command, and that the `&&` form has not
    itself been walked.
  - `[low]` `[patch]` The policy sentence's "in the same commit as the configuration" is achievable
    only in the Anchor; a Satellite paragraph states the order (row here first, configuration there
    second, the row's pointer updated) and that the re-observation is what finds a breach.
  - `[low]` `[patch]` A stated limit names DW-15: the versioning table maps `--token-*` changes and
    `contracts/tailwind.css` publishes generated `@theme` keys under the same version, and which
    category a change to one of those falls in is that release's decision, named in its ledger row.
  - `[low]` `[patch]` "122, 58 and ten where this table counts 118, 57 and 7" now names the three
    repositories and what each figure counts.
  - `[low]` `[patch]` `transitionDurationsMs` read an unparseable entry as `0`, which filed the
    element among the "never animates" exclusions in silence while `ringVerdict` failed the same
    read; it now throws naming the value, pinned in the suite.
  - `[low]` `[patch]` Exit-code boundaries: a `dev.exs` or `endpoint.ex` the cookie cannot be minted
    from, a `--tap` that is not a px length, and a handle detached by a LiveView re-render are now
    `BlockedError` (3) rather than a defect (2); `isConnectionFailure` no longer matches a bare
    "timeout", so a defect whose message mentions one stays a defect, pinned on a planted control.
  - `[low]` `[patch]` A route the sweep did not read as its own page is no longer navigated and
    measured (the reading would be the redirect target's); its hit-target case fails naming what
    the sweep read.
  - `[low]` `[patch]` `readSessionOptions` reads inside the `@session_options [...]` list only, so a
    `key:` elsewhere in the module is never taken for the cookie's name, pinned on two controls.
  - `[low]` `[patch]` `section()` and `publishedVersion()` strip fenced code blocks first, so the
    record's quoted rehearsal (a `Propagation count: **1**` line and a dry-run `|` row inside a
    fence) can never be read as structure; pinned on a control carrying a fenced heading, count
    line, version line and row.
  - `[low]` `[patch]` `publishedVersion()` refuses a record with two published-version lines rather
    than reading the first in silence; `estateNames()` is pinned at exactly eleven rather than
    bounded below, shown on a twelve-name control.
  - `[low]` `[patch]` The "names each departure separately" case asserted five departures and
    checked four; the transition departure's text is now asserted.
  - `[low]` `[patch]` "How to re-run it, in six commands" now states the once-only prerequisites
    (`mix deps.get`, `corepack pnpm install`, `playwright install chromium`) and that the seed is
    re-created from the quoted listing outside the repository.
  - `[low]` `[patch]` "The two differing in `mix.exs` only" (record and pass record) corrected: the
    two commits differ in this story's `AGENTS.md` bullet and the `mix.exs` change.
  - `[low]` `[patch]` Pending Operator action 1 names the head to push (`ae34619`, four commits past
    the remote) rather than two of the commits.
  - `[low]` `[patch]` The versioning section says the three texts are held by reading, were read
    equal on the day with the typo clause in `DESIGN.md:1039` in the same words, and that the
    header is the text quoted where they ever differ.
  - `[low]` `[patch]` Condition 3's check names why it reads `.github/workflows/` (all eleven are on
    GitHub) and that another CI service would need its own read.
  - `[low]` `[patch]` The `cs-tracker/AGENTS.md:32-41` citation moved with the bullet.
  - `[low]` `[patch]` `contract-adoption.test.ts` and the probe suite carry the new controls; the
    blocking suite is 720 across 29 files, up from 717.

**No loopback, and why.** Nothing was routed to `intent_gap` or `bad_spec`, and nothing inside
`<intent-contract>` was touched. Every patch is a defect in an artifact this story wrote: two
instructions that, if followed, turned a guard red or misled a reader in the adopter, and a set of
parsers and boundaries that could pass or misclassify in silence. The record's substance, the pass
and the rehearsal are unchanged.

**Fourteen findings were rejected.** That the rollout row says "eight repositories" (the phrase is
AD-16's and the intent's own); that the three versioning texts "already differ" (`DESIGN.md:1039`
carries the typo clause in the header's words, verified); that the policy should say how a security
advisory reaches the Operator in the ten repositories without alerts (the intent's policy is about
unattended merges, and advisory routing is not in it); that `AGENTS.md` embeds dated observations
(they are dated, which is the convention); that the `invokedDirectly` guard is untested (importing
the module in the suite without a run starting is the test); that the spec, `sprint-status.yaml`
and the `source_spec` fields of DW-15 and DW-16 are outside the reviewed diff (the orchestrator
owns all three); and seven descriptive divergences from the intent auditor, each already triaged in
the first pass or not a departure: the accessibility rows are tested at pure functions and the
application by hand (the intent says "measured once by hand"); the transition rule passes `all`
over `0s` (the initial value of `transition-property` is `all` with a `0s` duration, so the
literal reading flags every element on every page and measures nothing); the third ground was read
on a planted control (disclosed, and the absence recorded); fifteen configuration paths where the
matrix wrote seven (a superset); the pin edit that landed on `cs-tracker`'s `main` and was reset
(nothing reached a remote and the tree was restored, which is what the Block If guards); the
nineteenth detector case (the first pass's own patch); and the re-run at `32a466a` (disclosed).

### 2026-08-27: Third review pass

- intent_gap: 0
- bad_spec: 0
- patch: 23: (high 0, medium 1, low 22)
- defer: 0
- reject: 22: (high 0, medium 0, low 22)
- addressed_findings:
  - `[medium]` `[patch]` **The detector's vendored read path and the record's `File read` pin were
    two constants nothing held equal.** `ops/cs-tracker-adoption-probe.mjs` pinned `VENDORED_REL` on
    its own while `ops/contract-adoption.mjs` pinned `CS_TRACKER_TOKENS` for the record's row, so a
    folder move in `cs-tracker` could carry the detector's read away from the path the record hands
    Story 2.23 with every suite green. `VENDORED_REL` is now derived from `CS_TRACKER_TOKENS`, and
    the sibling suite pins `join(VENDORED_REL, 'tokens.css')` equal to it.
  - `[low]` `[patch]` The quoted seed's `~w(Rifle Rifle Sniper\ Rifle Pistol)` is five words, not
    four (`elixir -e` confirmed it), so no item was seeded as `Pistol` and the `/browse` category
    select reads two categories in F-15. The pass record now says what the line seeded, why the
    transcript shows it, that the geometry is unaffected, and the list literal a re-run would use;
    the script stays quoted as it ran.
  - `[low]` `[patch]` "43 unit cases" corrected to 44, counted by the suite's own run, and dated.
  - `[low]` `[patch]` The `cuatro-portfolio` policy row's 26 and 27 are two branches: the remote
    `main` lacks Story 1-19's `ops/__tests__/cs-tracker-adoption-probe.test.ts`, which `dev` at
    `b1ab824` carries. Verified against `origin/main` and stated in the cell.
  - `[low]` `[patch]` `assertEstateCovered` names missing, extra and duplicated names in
    case-insensitive name order rather than in the order `ops/estate.md` lists them, so a reordered
    sentence there cannot turn the planted control red; the control's expectation moved with it.
  - `[low]` `[patch]` `cells()` on an escaped pipe and `table()` on a row whose cell count differs
    from the header had no planted control; both now have one, and the escaped-pipe case also
    asserts the real record leans on it (`\|\| true` in the `cuatro-tracker` row).
  - `[low]` `[patch]` `AGENTS.md` and the record's confirmed paragraph claimed the test holds "the
    configuration" when it holds the fifteen files and the `package.json` key; `allow_auto_merge`,
    security fixes, bot-authored pull requests and a merging workflow step are named as the
    `gh api` sweep's, held by re-observation.
  - `[low]` `[patch]` Nothing pinned the Anchor `AGENTS.md` policy section the record calls "where
    it binds"; a case now holds it present after the managed block, naming the rule, the required
    check, "none is enabled here", the record and the suite.
  - `[low]` `[patch]` "A version no real release can produce" was false of the gates, which accept
    any `X.Y.Z`; the cell now reads "may produce" and says the rule, not a parser, keeps the third
    number at `0`.
  - `[low]` `[patch]` The pass record's method now says what the Selector column carries
    (`describeElement`'s description, unescaped classes, not a CSS selector).
  - `[low]` `[patch]` The route line printed "N under the floor" twice on a failing route; the
    count reason is no longer repeated after the count sentence.
  - `[low]` `[patch]` The pass record's Pending action 2 now carries the "add this probe to that
    scope beside the two sibling probes" clause its mirror in the record carries.
  - `[low]` `[patch]` The stated limit cited WCAG 2.5.8 (24 by 24) for a 44 by 44 floor; it now
    names 2.5.5 as the criterion the floor matches and 2.5.8 as the minimum, with the exceptions.
  - `[low]` `[patch]` `withoutElixirComments` stripped whole-line comments only, so a `key:` decoy
    in a trailing comment before the real line would have been read; it now drops trailing comments
    outside double-quoted strings (interpolations and escaped quotes kept), pinned on planted
    controls for both files.
  - `[low]` `[patch]` The record says the "CI runs it on push" and "Real test suite" cells are held
    by reading: `policyRows` checks fill and coverage, not the verdict against the evidence.
  - `[low]` `[patch]` The record's "Where the rule is stated" row said `AGENTS.md` calls enabling a
    decision "made in this file first"; aligned with the bullet's "lands in one commit with the
    configuration".
  - `[low]` `[patch]` The two literal pins at `contract-adoption.test.ts` § the Anchor row matches
    the tree (`none`, empty present list) go red on the enabling commit and were not named among
    the pins that move; the record's confirmed paragraph, "Maintaining this file" and `AGENTS.md`
    now name them.
  - `[low]` `[patch]` `table()` accepts a separator row with alignment colons, so a formatter's
    `|:---|` cannot hide a table; shown on planted controls.
  - `[low]` `[patch]` `ledger()` refuses two `Propagation count` lines rather than reading the
    first in silence, as `publishedVersion` already did; shown on a control.
  - `[low]` `[patch]` `section()` refuses a heading that appears twice rather than parsing the
    first section only; shown on a control through `section` and `ledger`.
  - `[low]` `[patch]` `validateInputs` accepted a base URL with a path, query, fragment or trailing
    slash, which the route concatenation would have swept as `//browse`; it now requires a bare
    origin, with the message, the pass record's sentence and four planted controls updated.
  - `[low]` `[patch]` The stated limit on zero-duration exclusions says the longest entry of the
    `transition-duration` list is compared whichever entry the outline occupies, so the rule
    over-counts and never under-counts, and that no reading in the run carried more than one
    duration.
  - `[low]` `[patch]` `transitionFindings` and `transitionExclusions` filed a measured element
    whose `transition-duration` was not read among the "never animates" exclusions in silence;
    they now throw naming the element, pinned on controls, with a skipped element exempt.

**No loopback, and why.** Nothing was routed to `intent_gap` or `bad_spec`, and nothing inside
`<intent-contract>` was touched. Every patch is a defect in an artifact this story wrote: one pair
of constants a test should have held equal, a set of parsers and boundaries that could pass or
misclassify in silence, and statements in the records that claimed slightly more or slightly other
than what was run. The record's substance, the pass and the rehearsal are unchanged; the blocking
suite is 730 across 29 files, up from 720 by this pass's ten cases.

**Twenty-two findings were rejected.** That the rollout row says "eight repositories" and that the
story-id forms mix (both triaged in earlier passes); that the `cs-tracker/AGENTS.md` bullet sits
among CSS rules (the spec places it beside the Cuatro entries); that both `AGENTS.md` edits carry
dated observations (triaged in the second pass); that the probe would send a dev-minted cookie to a
non-loopback host (the dev secret is committed and public, and the server is the verifier); that
the route-sweep length pin is true by construction (it is, and it costs nothing); that CRLF
checkouts break the fence stripper (the record is CRLF in this working copy under
`core.autocrlf=true`, and every parser was shown passing on it, `$` in multiline mode matching
before `\r`); that a stale "The 11 repositories" sentence could survive a waypoint change (the
maintaining note moves the sentence, the count and both tables together); that the Tab budget
could label a reachable element UNREACHABLE (the label is printed, never a pass); that a LiveView
patch could strip the probe's index attributes between tagging and the sweep (detached handles are
already classified blocked); and twelve descriptive divergences from the intent auditor, each
already triaged in the first or second pass, disclosed in the record, a superset of the intent's
list, or the orchestrator's own files.

## Design Notes

**Why the pass runs the application rather than a fixture page.** Story 1-19's probe compiled a
stylesheet and rendered class strings in a fixture, because its question was what a theme variable
computes to, a property of the stylesheet. AD-19's question is the size of a control in its real
layout and the visibility of a ring on the ground a page actually paints under it, which only the
application's own markup at its own width can answer. `mix phx.server` against a Postgres started for
the run, seeded through the application's own schemas, is the cheapest surface that answers it.

**Why the probe mints the session cookie.** Every owner route sits behind a Steam OpenID round trip
that no automation can complete. The development endpoint's session store is a signed cookie whose
secret and salt are committed in `config/dev.exs` and `endpoint.ex`, so a token Plug's own verifier
accepts can be produced from those two values and a 17-digit id, and the server is started with the
same id in `STEAM_ID`. The application is the verifier of that token: the route sweep's first case is
that `/` answers `200` with it and a redirect without it, so the cookie is proved by the gate it
passes rather than by a unit test of its bytes.

```text
protected = base64url("HS256")
payload   = base64url(term_to_binary(%{"steam_id" => id}))   # 131,116,0,0,0,1, 109,<len>,"steam_id", 109,<len>,id
key       = pbkdf2_sha256(secret_key_base, signing_salt, 1000 iterations, 32 bytes)
cookie    = protected <> "." <> payload <> "." <> base64url(hmac_sha256(key, protected <> "." <> payload))
```

**Why "a real test suite" means one CI runs.** NFR-10's own words are "a repository that cannot
detect its own breakage". A suite nobody runs on a push detects nothing on a merge, so an automated
merge into `cs-tracker` today would be gated by no check at all despite 653 tests on disk. The
definition in the record makes the list checkable from outside the repository: a workflow file that
runs the suite on push, or none. The table shows both columns so the reader is not misled either way.

**Why the scratch branches are deleted.** A local branch is not published, so keeping one would meet
the criterion, but a branch named `scratch/*` in a repository whose remote is pushed by hand is one
`git push --all` away from being published. The record carries the exact commands and the transcript,
so the walk is repeatable, and the teardown check is what proves nothing of it survived.

**Why the counter lives here.** Story 6.1 says the count is "appended to the Story 1.20 record as
each event occurs, rather than reconstructed from git history", and reads "the count's current value
explicitly". The line and the table are shaped so the unit test can hold them equal, and the
exclusions (first publication, documentation changes, this rehearsal) are written beside the count.

## Verification

**Commands:**
- `corepack pnpm typecheck` and `corepack pnpm test --run`, expected: exit 0, totals grown by the two
  new suites only.
- `node ops/cs-tracker-accessibility-probe.mjs` against the running application, expected: exit 0 or
  1 with every named case reported and the findings enumerated; never 2 or 3.
- `git -C ..\cs-tracker-workspace\cs-tracker diff --stat 8adb8e2`, expected: `AGENTS.md` only.
- `git diff --stat b1ab824 -- contracts packages .github app public docker`, expected: empty.
- `git branch --list "scratch/*"` in both repositories, expected: empty. `git status --porcelain`
  in both, expected: empty at each closing commit.
- `Get-FileHash -Algorithm SHA256 contracts\* , contracts\fonts\*` compared against
  `ops/cs-tracker-token-adoption.md:47-57`, expected: all nine equal.
- Punctuation sweep over every file written, against a positive control carrying an em-dash, an
  en-dash, a double-dash and an emoji so it cannot pass vacuously.

**Manual checks:**
- Read the record's eleven-row table against the `gh api` transcript for the same day.
- Read the pass record's findings against the probe transcript, and confirm each is a finding and
  not a fix.

## Auto Run Result

Status: done (third review pass, 2026-08-27, on a spec supplied at `done`)

**Summary of the change.** A fresh review of the whole Story 1-20 diff since `b1ab824` (and
`cs-tracker/AGENTS.md` since `8adb8e2`) by the four layers; 23 findings patched, none deferred, 22
rejected, no loopback. The substance of the record, the AD-19 pass and the rehearsal is unchanged.

**Files changed in this pass:**
- `ops/contract-adoption.mjs`: `section()` refuses a duplicated heading, `table()` accepts
  alignment colons, `ledger()` refuses two count lines, `assertEstateCovered` names in name order.
- `ops/cs-tracker-adoption-probe.mjs`: `VENDORED_REL` derived from `CS_TRACKER_TOKENS`.
- `ops/cs-tracker-accessibility-probe.mjs`: `validateInputs` requires a bare origin,
  `withoutElixirComments` drops trailing comments outside strings, the transition functions throw on
  an unread duration, the route line no longer repeats the count reason.
- `ops/__tests__/contract-adoption.test.ts`: six new cases (two count lines, escaped pipe, cell
  count, alignment colons, duplicated heading, the `AGENTS.md` policy section); the missing-names
  control's order updated.
- `ops/__tests__/cs-tracker-accessibility-probe.test.ts`: three new cases (bare origin, trailing
  comment decoys, unread duration); the origin message updated.
- `ops/__tests__/cs-tracker-adoption-probe.test.ts`: one new case pinning the read path to the
  record's path.
- `ops/contract-adoption.md`: the `AGENTS.md` row, the `cuatro-portfolio` row's two counts, the
  held-by-reading paragraph, the confirmed paragraph's scope and literal pins, the PATCH cell, and
  "Maintaining this file".
- `ops/cs-tracker-accessibility-pass.md`: what the seed's category line produced, the origin
  sentence, the Selector column's meaning, the WCAG citation, the longest-duration limit, the case
  count, Pending action 2's clause.
- `AGENTS.md`: the fourth policy bullet's scope and the literal pins.

**Review findings breakdown.** Patches 23 (high 0, medium 1, low 22); deferred 0; rejected 22.

**Follow-up review recommendation:** `true`. Patched by severity: high 0, medium 1, low 22; score
`3 x 1 + 1 x 22 = 25`, at or over 5.

**Verification performed:**
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test --run`: 29 files, 730 tests passed (720 before this pass, plus its ten cases).
- Punctuation sweep over the nine files written, against a positive control that hit 4 of 4: no
  em-dash, en-dash or emoji; the only matches are `<!-- -->` markers, `--coverage`, `--token`
  prefixes inside regexes and the `❯` glyph in the quoted Vitest transcript.
- `git diff b1ab824 --stat -- contracts packages .github app public docker`: empty.
- `git -C ..\cs-tracker-workspace\cs-tracker diff --stat 8adb8e2`: `AGENTS.md` and the Operator's
  own `mix.exs` (`32a466a`, disclosed in both records); porcelain empty.
- `git branch --list "scratch/*"` empty in both repositories.
- `contracts/tokens.css`, `tailwind.css`, `fonts.css` hash to the values
  `ops/cs-tracker-token-adoption.md` records.
- `elixir -e 'IO.inspect(~w(Rifle Rifle Sniper\ Rifle Pistol))'` printed five words, confirming the
  seed finding; `origin/main` was listed to confirm the 26-file count.
- The record's parsers were run against a CRLF copy of the record and passed, which is what
  rejected the line-ending finding.

**Residual risks.** The AD-19 pass and the rehearsal remain one day's measurements; the probe's
per-entry transition durations are compared by their longest value, which over-counts and is now
stated; the `cs-tracker` head (`ae34619`) is still unpushed (Pending Operator action 1); Story
1-19's pipeline pin is red at `32a466a` (Pending Operator action 7, deferred in the first pass).
The spec file, `deferred-work.md` and `sprint-status.yaml` are left to the orchestrator, as before.

