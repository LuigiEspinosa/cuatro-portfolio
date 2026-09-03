# Contract adoption, the automation policy and the propagation ledger

The written record of Story 1-20, the last story of Epic 1: which version of the token contract
every application in the estate has adopted and the exact file each version was read from, the
exact target the Epic 2 drift check reads, the no-unattended-automation policy with the observed
state of all eleven repositories, the four versioning categories and what a pure addition is, the
AD-16 change-propagation runbook, the rehearsal that validated it on a throwaway `v1.0.1`, the
propagation ledger and counter Epic 6 reads, and the headline of the AD-19 accessibility pass.

Written during Story 1-20 on **2026-08-27** (ISO 8601 UTC), against baseline commit `b1ab824` in
`cuatro-portfolio` and `8adb8e2` in `cs-tracker`.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/token-contract.md`, `ops/anchor-token-adoption.md` and
`ops/cs-tracker-token-adoption.md` set: every value is marked **Observed** with its method or
**Decision** with its reason (NFR-9), and every date is ISO 8601 UTC.

**Epic 1 story ids are written hyphenated**, as `Story 1-20`, matching the keys in
`_bmad-output/implementation-artifacts/sprint-status.yaml`; `epics.md` writes the same ids dotted,
and they are the same story. Stories in later epics have no key in that file yet and keep
`epics.md`'s dotted form here, as `Story 2.23`.

**This file is held equal to the tree by two readers.** The parsers live in
`ops/contract-adoption.mjs`. `ops/__tests__/contract-adoption.test.ts` runs them under the blocking
`test` job and fails if the published version stated here disagrees with the `Contract vX.Y.Z`
header of `contracts/tokens.css` or the version in `packages/tokens/package.json`, if the
adopted-versions or policy table stops naming the eleven repositories `ops/estate.md` names, if the
propagation count stops equalling the number of ledger rows, or if the Anchor's automation cell and
the dependency-automation configuration present in this repository stop agreeing, in either
direction. `ops/cs-tracker-adoption-probe.mjs`, the hand-run drift detector, runs them too and holds
the `cs-tracker` row to the header of the vendored `tokens.css`. The table shapes are therefore part
of the contract of this file: keep the header rows as they are.

## What this story did, in one paragraph

It read the adopted contract version off the header of every vendored copy rather than restating
it, named the one file the Epic 2 drift check reads down to the line and the pattern, observed all
eleven estate repositories through `gh api` on one day for a test suite, a workflow that runs it and
any dependency automation, wrote the policy where it binds in both repositories' `AGENTS.md`,
wrote the four versioning categories beside the contract with the definition of a pure addition
that `DESIGN.md` carried and the contract's own header did not, wrote the six-step
change-propagation runbook and walked it on a throwaway `v1.0.1` on scratch branches that were
never pushed, never merged and were deleted afterwards, recorded what the walk found, started the
propagation ledger at zero with the rehearsal excluded by name, and measured `cs-tracker` in a
real browser at 360px against the 44x44 floor and the focus-ring rules on a running, seeded
instance, recording every failure as a finding and fixing none.

## The adopted versions

Published contract version: **1.0.0**, read off `contracts/tokens.css:2` (`Contract v1.0.0 · dark
only · anchor hue 288`) and `packages/tokens/package.json:3` (`"version": "1.0.0"`) at `b1ab824`.
**Observed 2026-08-27** by reading both files, and held equal to this line by
`ops/__tests__/contract-adoption.test.ts` on every run of the blocking `test` job, so the record
and the header cannot drift apart in silence.

One row per application `ops/estate.md:73-75` names at the eleven-repository waypoint. **Adopted**
means the application renders from the contract; **loaded** would mean it merely has the file. For
the Anchor the two are one version, because it loads `contracts/` in place and vendors nothing; for
every Satellite the adopted version is the header of its vendored copy and nothing else.

| Application | Consumption route | File read | Header read | Adopted version | Nature and method |
|---|---|---|---|---|---|
| `cuatro-portfolio` | The publisher. `app/scss/_index.scss` `@use`s `contracts/tokens.css` and `contracts/fonts.css` in place (Story 1-17) and the alias layer in `app/app.scss` reads the roles (Story 1-18). No vendored copy exists, by rule (AD-1, AD-4) | `contracts/tokens.css` | `Contract v1.0.0` | 1.0.0 | **Observed 2026-08-27** by reading `contracts/tokens.css:2` at `b1ab824`. `app/__tests__/anchor-contract.test.ts` asserts there is no second authored copy |
| `cs-tracker` | Vendored `contracts/` verbatim as `assets/css/cuatro-contracts/`, nine files, and imports its `tailwind.css` from `assets/css/app.css` (Story 1-19, AD-15 route A) | `assets/css/cuatro-contracts/tokens.css` | `Contract v1.0.0` | 1.0.0 | **Observed 2026-08-27** by `git -C cs-tracker show 8adb8e2:assets/css/cuatro-contracts/tokens.css`, line 2, never restated from memory. Asserted by `test/cs_tracker_web/token_contract_test.exs:342`. The nine sha256 values are in `ops/cs-tracker-token-adoption.md:47-57` |
| `cuatro-finance` | none | none | none | not adopted | **Observed 2026-08-27** by `gh api repos/LuigiEspinosa/cuatro-finance/git/trees/main?recursive=1`: the default branch holds one blob, `LICENSE`. A `dev` branch exists and was not inspected |
| `cuatro-tracker` | none | none | none | not adopted | **Observed 2026-08-27** by the same call: 400 blobs, none under a `cuatro-contracts` path |
| `cs-tournament` | none | none | none | not adopted | **Observed 2026-08-27** by the same call: 662 blobs, none under a `cuatro-contracts` path |
| `digital-library` | none | none | none | not adopted | **Observed 2026-08-27** by the same call: 157 blobs, none under a `cuatro-contracts` path |
| `list-wheel` | none | none | none | not adopted | **Observed 2026-08-27** by the same call: 43 blobs, none under a `cuatro-contracts` path |
| `StreamVault` | none | none | none | not adopted | **Observed 2026-08-27** by the same call: the default branch holds one blob, `LICENSE`. A `dev` branch exists and was not inspected |
| `MaiCoin` | none | none | none | not adopted | **Observed 2026-08-27** by the same call: 43 blobs, none under a `cuatro-contracts` path. Declared non-participating in identity (FR-24) |
| `poketracker-go` | none | none | none | not adopted | **Observed 2026-08-27** by the same call: the default branch holds one blob, `LICENSE`. A `dev` branch exists and was not inspected |
| `Mutuo` | none | none | none | not adopted | **Observed 2026-08-27** by the same call: 7 blobs. `frontend/assets/css/tokens.css` is there and is **Mutuo's own** token file (header `Mutuo Design Tokens`, `--color-bg-base: #0f0b1f`), not the vendored folder and not an adoption |

**`cs-tracker`'s adoption is local until it is pushed.** **Observed 2026-08-27** by
`gh api repos/LuigiEspinosa/cs-tracker/git/trees/main?recursive=1`: the remote default branch, last
pushed 2026-08-13, carries no path under `cuatro-contracts` and no `.github`. The version above is
read off the local checkout at `8adb8e2`, which is Story 1-19's closing commit plus nothing. Until
Pending Operator action 1 lands, the drift check's target exists on this host and not on GitHub,
and this file says so rather than implying otherwise.

**The `cs-tracker` row is held to the vendored header by the hand-run detector.**
`ops/cs-tracker-adoption-probe.mjs` carries a case, added after the rehearsal below, that parses
this table's `cs-tracker` row through `ops/contract-adoption.mjs` and holds its Adopted version
equal to the `Contract vX.Y.Z` header read out of `assets/css/cuatro-contracts/tokens.css`, failing
naming both values. It is the hand-run stand-in for step 6's declaration-against-header comparison
until Story 2.23's job exists, because every other pin on this version is either a literal in a
test or a check that never reads this file: a re-vendor that moved every other pin and forgot this
row would otherwise leave every gate green while the row states a version Story 2.5 would seed
from. **Observed 2026-08-27**, `node ops/cs-tracker-adoption-probe.mjs` with both sides at `1.0.0`:

```
PASS  The record states the version the vendored header carries: the record states 1.0.0 and the vendored tokens.css header reads Contract v1.0.0 (ops/contract-adoption.md against assets/css/cuatro-contracts/tokens.css)
```

That run, started 2026-08-27T22:47:57Z against `cs-tracker` at `32a466a`, reported **19 cases,
18 PASS, 1 FAIL**. The one failure is not this story's: `The build pipeline places them` reads
`It runs in assets.setup: false`, because the Operator's `32a466a` (`fix: keep cuatro.fonts out of
assets.setup so the container build can run it`, committed to `cs-tracker`'s `main` at 22:39:39Z,
after this story's rehearsal) took `cuatro.fonts` out of the `assets.setup` alias that Story 1-19's
record and its probe pin as a decision. The detector is reporting a real change in the adopter, which
is what it is for; whether Story 1-19's record, its probe pin and `cs-tracker/AGENTS.md:36-39` follow
the commit is Pending Operator action 7 below, and this story edits none of them.

## The exact target of the Epic 2 drift check

Story 2.23 (`epics.md:2885-2896`) has one scheduled job read `Contract vX.Y.Z` out of each
Satellite's vendored `cuatro-contracts/tokens.css` and compare it with the Registry entry's
`token_contract` (AD-16, AD-18). This is the target, stated so the check has a file rather than a
search:

| Field | Value | Nature |
|---|---|---|
| Repository | `LuigiEspinosa/cs-tracker` | **Decision.** The one Satellite that has adopted |
| Branch | `main` | **Observed 2026-08-27**, `default_branch` from `gh api repos/LuigiEspinosa/cs-tracker` |
| Path | `assets/css/cuatro-contracts/tokens.css` | **Decision.** AD-14's fixed folder name under `assets/css/`, `ops/cs-tracker-token-adoption.md:76` |
| Line | 2 | **Observed 2026-08-27**, the second line of the file at `8adb8e2` |
| Pattern | `Contract v(\d+\.\d+\.\d+)` | **Decision.** The generator refuses anything but exact `X.Y.Z` (`packages/tokens/build.mjs:68-77`), so the capture is always three dot-separated integers |
| Compared against | `token_contract` on the `cs-tracker` entry of `contracts/registry.json`, which Story 2.5 sets to `1.0.0`, the value recorded here (`epics.md:2223-2224`) | **Observed 2026-09-03.** The field now exists and carries `1.0.0`, authored by Story 2-5. It said "the field does not exist yet" until then. **Nothing holds the two equal**: no test reads the Registry's value, and the schema constrains it only to `^\d+\.\d+\.\d+$`, so step 5 below is the only thing keeping them in step |
| When the folder is renamed or moved | The check **fails** rather than skipping (`epics.md:2893-2896`) | **Decision.** AD-16: a Satellite that renames the folder breaks the check rather than the styling |
| The served surface it may also read | `https://cuatro.dev/contracts/tokens.css` | **Observed 2026-08-27T21:54:08Z** by `Invoke-WebRequest`: `200`, `content-type: text/css; charset=UTF-8`, `last-modified: Thu, 27 Aug 2026 19:06:39 GMT`, `etag: W/"1851-1a0449dfa18"`, `server: cloudflare`, line 2 of the body `Contract v1.0.0 · dark only · anchor hue 288` |

The same three values, published, vendored and served, all read `1.0.0` today.

## The automation policy

### The rule

`prd.md:639`, quoted:

> **NFR-10: No unattended automation without a test suite.** Automation without users is automation
> without feedback. Nothing merges or deploys unattended in a repository that cannot detect its own
> breakage.

`prd.md:361-363`, FR-19's three testable consequences, quoted:

> - Token adoption by a Satellite is an explicit, reviewed action, never an unattended automatic
>   merge.
> - The Operator can determine which Satellites are on which version of the Token Contract.
> - No automated dependency merge is enabled for any repository lacking a real test suite.

AD-16 (`ARCHITECTURE-SPINE.md:172-176`) binds both: "Adoption in a Satellite is an explicit reviewed
commit. No unattended dependency automation is enabled in any repository lacking a real test suite."

**The policy, as a sentence:** no automated dependency merge is enabled in any estate repository
without a real test suite as defined below **and** without that suite's run being a required status
check on the repository's default branch; none is enabled anywhere in the estate today; the required
check holds nowhere today and cannot hold in the four private repositories on the current GitHub
plan; and enabling one is a recorded decision made in this file, in the same commit as the
configuration, never a repository setting made on its own. **Decision.**

**For a Satellite the row and the configuration cannot share a commit**, because they live in
different repositories, and nothing holds them equal the way the Anchor's test does. So the order
is stated instead: the row in this file lands first, naming the required check and the reason,
and the configuration commit in the Satellite lands second, with the row's pointer updated to name
that commit. A Satellite configuration with no row here is a policy breach, and the policy table's
re-observation (Pending Operator action 5) is what finds it. **Decision.**

### What a real test suite is

NFR-10's own words are "a repository that cannot detect its own breakage". A suite nobody runs on a
push detects nothing on a merge, so the definition has to be checkable from outside the repository
and has three parts, all required. **Decision.**

| # | Condition | How it is checked |
|---|---|---|
| 1 | The suite **exists**: at least one test file in the tree | `gh api .../git/trees/<default>?recursive=1`, counting paths under `__tests__/`, `test/`, `tests/`, or named `*.test.*`, `*.spec.*`, `*_test.exs`, `*_test.go` |
| 2 | It **exercises the application's own code**, not tooling or scaffolding | Reading what the files are: a test of a bmad skill script or a generated fixture does not count |
| 3 | It **runs on a CI service on every push to the default branch** | A workflow under `.github/workflows/` whose `on:` includes `push` reaching the default branch and whose steps run the suite, with no `continue-on-error` and no `\|\| true` on that step. This establishes that the suite runs on every push, and only that. All eleven repositories are on GitHub, which is why the check reads `.github/workflows/`; a repository on another CI service would need that service's equivalent read, and none is today |

A repository that fails any one of the three has no real test suite for the purpose of this policy,
however many tests are on disk. `cs-tracker` is the case the definition exists for: 653 tests and
nothing that runs them on a push.

**A fourth condition applies to enabling automation, and it is separate from having a real test
suite.** A workflow that runs gates nothing on its own: a merge nobody is watching lands whether the
run is red or green unless the run is a **required status check** on the default branch, through
branch protection or a ruleset. So automation may be enabled only where, in addition to conditions 1
to 3, the suite's run is a required check on the default branch. **Observed 2026-08-27 between
22:38:57Z and 22:41:09Z** by `gh api` as `LuigiEspinosa` against `branches/<default>/protection`,
`rules/branches/<default>` and `rulesets` for every repository: the condition holds **nowhere** in
the estate today, and it **cannot hold** in the four private repositories (`cs-tournament`,
`cs-tracker`, `StreamVault`, `Mutuo`) on the current plan, where all three endpoints answer
`403 Upgrade to GitHub Pro or make this repository public to enable this feature`. The column
"Required check on the default branch" below carries each observation. **Decision**, with the
observation.

### Where the rule is stated so it binds

| Where | What it says | Nature |
|---|---|---|
| `AGENTS.md` in this repository, § Dependency automation policy, outside the managed `bmad:context` block so a refresh keeps it | The rule, the definition with its fourth condition, that none is enabled here, and that enabling one is a recorded decision that lands in one commit with the configuration, the unit test holding the row and the tree equal. `ops/__tests__/contract-adoption.test.ts` holds the section present after the managed block and pointing here | **Decision.** Story 1-20 |
| `cs-tracker/AGENTS.md`, the bullet beside the Cuatro entries, at `:42-50` among the entries at `:32-50` | None is enabled there, none may be while nothing runs `mix test` on a push nor while that run is not a required check on `main`, which cannot hold on the current plan, and this file governs it, the decision landing here before any configuration there | **Decision.** Story 1-20; the only file this story edits in `cs-tracker` |
| This file | The rule, the definition, the eleven-row observation and the method | **Decision** |

### The estate, observed

**Observed 2026-08-27 between 21:36:04Z and 21:37:28Z** by `gh api` as `LuigiEspinosa` (token
scopes `gist`, `project`, `read:org`, `repo`, `workflow`), one repository at a time, by a script
under the scratchpad that called, per repository, `repos/{owner}/{repo}` (`default_branch`,
`allow_auto_merge`), `repos/{owner}/{repo}/automated-security-fixes`,
`repos/{owner}/{repo}/vulnerability-alerts`, `repos/{owner}/{repo}/contents/<file>?ref=<default>`
for each of seven configuration paths, `repos/{owner}/{repo}/pulls?state=all&per_page=100&page=1`
filtered to `dependabot[bot]` and `renovate[bot]`, `repos/{owner}/{repo}/git/trees/<default>?recursive=1`
for the test-file count and the workflow list, and `contents/` for each workflow's text. That sweep
looked for seven configuration paths. A **second sweep, Observed 2026-08-27 between 22:38:57Z and
22:41:09Z** by the same means, read each default branch's protection, rules and rulesets, and looked
for the full set of locations Dependabot and Renovate document: `.github/dependabot.yml`,
`.github/dependabot.yaml`, `renovate.json`, `renovate.json5`, `renovate.jsonc`, `.github/renovate.json`,
`.github/renovate.json5`, `.github/renovate.jsonc`, `.renovaterc`, `.renovaterc.json`,
`.renovaterc.json5`, `.renovaterc.jsonc`, `.gitlab/renovate.json`, `.gitlab/renovate.json5`,
`.gitlab/renovate.jsonc`, and a top-level `renovate` key in `package.json`. Every one of the fifteen
paths answered `404` on every one of the eleven default branches, and none of the seven
`package.json` files on a default branch carries the key. The first page of pull requests held every
pull request each repository has (the largest count is 69, under the page size of 100), so "page 1"
below is the whole list.

**Test-file counts are counts of test-shaped paths on the remote default branch**, not counts of
test cases, and they include support and fixture files that sit under a `test/` directory. The
counting rule: entries of `type` `blob` in the recursive tree of the default branch, directories
excluded, matched by the patterns condition 1 names. A sweep that counts tree entries including
directories gives higher figures, which is why the story's own same-day spec counted 122 test-shaped
entries in `cuatro-tracker`, 58 Vitest files under `cs-tournament`'s `lib/` and ten entries in
`Mutuo`, where this table counts 118 blobs, 57 blobs and 7 blobs, `Mutuo`'s 7 being every blob on
its default branch, none of them test-shaped. The two figures that are test-case counts say so and
name the run that produced them.

| Repository | Test suite (files, runner) | CI runs it on push | Required check on the default branch | Dependency automation (config files) | Security updates | Auto-merge | Bot-authored PRs | Real test suite | Nature and method |
|---|---|---|---|---|---|---|---|---|---|
| `cuatro-portfolio` | 34 test-shaped files: 26 under `__tests__/` across `app/`, `components/`, `docker/`, `hooks/`, `ops/` and `packages/`, plus 8 Playwright specs under `tests/e2e/`. Vitest (`"test": "vitest"`), `corepack pnpm test --run`: **649 tests across 27 files at `b1ab824`** (Story 1-19's closing run, on `dev`; the 27th file is `ops/__tests__/cs-tracker-adoption-probe.test.ts`, which Story 1-19 added on `dev` and the remote `main` does not yet carry, so 26 counts the default branch and 27 counts `dev`) | **yes**: `ci.yml` on `push` to `**` and `pull_request` to `main`, `test` job runs `pnpm test --run` and `rendered-output` runs `pnpm test:e2e`; `tokens-contract`, `fonts-contract` and `contract-purity` beside them. No `continue-on-error`, no soft fail: the only matches for either string are two comments forbidding them (`ci.yml:150`, `deploy.yml:21`) | **none required**: `main` is protected, `required_status_checks` has `strict: true` with `contexts` and `checks` both empty, so no check is named; `enforce_admins` on; pull request reviews required with `required_approving_review_count` 0, `dismiss_stale_reviews` off, `require_code_owner_reviews` off; `allow_force_pushes` off; `allow_deletions` off; `required_linear_history` off; no rules and no rulesets. **Observed 2026-08-27T22:38:57Z** | none | off (`{"enabled":false,"paused":false}`) | off (`allow_auto_merge=false`) | 0 of 18 | **yes** | Dependabot **alerts** are on (`vulnerability-alerts` `204`), which is notification and not automation. Public |
| `cuatro-finance` | none: the default branch `main` holds one blob, `LICENSE` | no workflow | none: `404 Branch not protected`, no rules, no rulesets. **Observed 2026-08-27T22:39:08Z** | none | off | off | 0 of 0 | **no** | A `dev` branch exists and was not inspected; the policy is about the default branch, where an automated merge would land. Public |
| `cuatro-tracker` | 118 test-shaped files: 105 under `__tests__/` across `app/`, `components/`, `lib/`, `store/` and the root, 12 `*.spec.ts` under `e2e/`, 1 under `tests/`. Vitest (`"test": "vitest --run --passWithNoTests"`) plus Playwright | **yes**: `ci.yml` on `push` to `main` and `dev`, `pull_request` to `main`; `test` job runs `pnpm test --coverage`, `e2e` job runs `pnpm test:e2e`. One `run: cat worker.log \|\| true` at `:212` prints a log and gates nothing | none: `404 Branch not protected`, no rules, no rulesets. **Observed 2026-08-27T22:39:19Z** | none | off | off | 0 of 69 | **yes** | Public |
| `cs-tournament` | 119 test-shaped files: 57 `*.test.ts` under `lib/`, 25 `*_test.go` under `worker/`, 30 `supabase/tests/*_test.sql`, 2 support files under `test/`, and 5 `test_*.py` under `.claude/skills/*/scripts/tests/` which are bmad tooling and do not count. `"test": "vitest run"` | **no workflow**: no `.github/` in 662 blobs | not available: `403 Upgrade to GitHub Pro or make this repository public` on protection, rules and rulesets. **Observed 2026-08-27T22:39:30Z** | none | off | off | 0 of 0 | **no** | A suite exists and nothing runs it on a push. Private |
| `cs-tracker` | 66 test-shaped files on the remote (49 `*_test.exs`, 17 support and fixture files under `test/`); the local checkout at `8adb8e2` adds Story 1-19's two files. ExUnit, `mix test`: **653 tests, 0 failures, 4 excluded**, **Observed 2026-08-27** on this host in 13.2 s against a Postgres 16 container | **no workflow**: no `.github/` in 175 blobs on the remote and none in the local checkout | not available: `403 Upgrade to GitHub Pro or make this repository public` on protection, rules and rulesets. **Observed 2026-08-27T22:39:41Z** | none | off | off | 0 of 0 | **no** | The case the definition exists for. Private |
| `digital-library` | 34 test-shaped files, all under `__tests__/` beneath `apps/`. Vitest (`"test": "vitest run"`) | **yes**: `ci.yml` on `[push, pull_request]`, every push, `test` job runs `pnpm test -- --coverage`; `deploy.yml` on `push` to `main` also runs `pnpm test` before deploying | none required: `404 Branch not protected`; one active ruleset, `protect-main`, on `~DEFAULT_BRANCH` with the rules `deletion` and `non_fast_forward` and no required check. **Observed 2026-08-27T22:39:52Z** | none | off | off | 0 of 21 | **yes** | Public |
| `list-wheel` | 4 `*.spec.ts` under `src/`, substantive component and service specs. Angular, Karma (`"test": "ng test --no-watch"`) | **no workflow** | none: `404 Branch not protected`, no rules, no rulesets. **Observed 2026-08-27T22:40:10Z** | none | off | off | 0 of 0 | **no** | Serves from GitHub Pages with no workflow in the tree. Public |
| `StreamVault` | none: the default branch `main` holds one blob, `LICENSE` | no workflow | not available: `403 Upgrade to GitHub Pro or make this repository public` on protection, rules and rulesets. **Observed 2026-08-27T22:40:22Z** | none | off | off | 0 of 0 | **no** | A `dev` branch exists and was not inspected. Private |
| `MaiCoin` | 1 file, `test/MaiCoin.test.ts`, a Hardhat test | **no workflow** | none: `404 Branch not protected`, no rules, no rulesets. **Observed 2026-08-27T22:40:33Z** | none | off | off | 0 of 1 | **no** | Public |
| `poketracker-go` | none: the default branch `main` holds one blob, `LICENSE` | no workflow | none: `404 Branch not protected`, no rules, no rulesets. **Observed 2026-08-27T22:40:44Z** | none | off | off | 0 of 0 | **no** | A `dev` branch exists and was not inspected. Public |
| `Mutuo` | none: 7 blobs, no test-shaped path | no workflow | not available: `403 Upgrade to GitHub Pro or make this repository public` on protection, rules and rulesets. **Observed 2026-08-27T22:40:56Z** | none | off | off | 0 of 1 | **no** | Private |

**Which repositories have a real test suite:** `cuatro-portfolio`, `cuatro-tracker` and
`digital-library`, three of eleven. Four more carry a suite that nothing runs on a push
(`cs-tracker`, `cs-tournament`, `list-wheel`, `MaiCoin`), and four carry none (`cuatro-finance`,
`StreamVault`, `poketracker-go`, `Mutuo`). **Observed 2026-08-27**, the table above. **None of the
three has its run as a required status check on its default branch**, so none satisfies the fourth
condition today, and the four private repositories cannot satisfy it on the current plan; automation
is therefore enabled nowhere and may be enabled nowhere yet.

**The "CI runs it on push" and "Real test suite" cells are held by reading.** They are conclusions
drawn from the workflow text and the tree listing the sweep fetched, written by hand. `policyRows`
in `ops/contract-adoption.mjs` checks that every row fills its test-suite, required-check and
automation cells and that the row set equals the estate; it does not derive a yes or a no from the
other cells, so a row whose verdict contradicts its own evidence is a reading error the
re-observation (Pending Operator action 5) finds, not one the unit test finds. **Decision.**

### The Anchor and `cs-tracker`, confirmed

Both rows read `none`, `off`, `off`, `0`. For the Anchor that is checked twice: by the two `gh api`
sweeps above, and on every run of the blocking `test` job by
`ops/__tests__/contract-adoption.test.ts`, which holds the Anchor's automation cell and the
configuration present **in the repository** (the fifteen file locations under the root, `.github/`
and `.gitlab/`, plus `package.json#renovate`) equal **in both directions**: a cell reading `none`
requires nothing present, and any other cell must name, in backticks, every location present and
nothing more, so a configuration with no row and a row with no configuration both fail naming the
path. The test shows both directions firing on planted controls. Enabling automation is therefore
**one commit that carries the row and the configuration together**; a row moved first or a setting
landed first turns the `test` job red until the other half arrives. What the test holds is the
configuration files and the `package.json` key, nothing more: `allow_auto_merge`, automated
security fixes, bot-authored pull requests and any workflow step that merges (`gh pr merge --auto`
and its kind) are repository settings and workflow text that the `gh api` sweep observes and the
tree does not carry, so they are held by re-observation (Pending Operator action 5). That same
commit also moves two literals in `ops/__tests__/contract-adoption.test.ts` § the Anchor row
matches the tree, which pin today's state beside the two-directional guard: the cell read as
`none` and `automationConfigsPresent` returning an empty list. For `cs-tracker` there is no
`.github/` at all, locally or on the remote, which is also why it has no real test suite.
**Observed 2026-08-27.**

### Stated limit: app installations

`gh api user/installations` answered `403` with this token, so a GitHub App based Renovate could not
be listed directly. It is excluded by two absences instead: no Renovate configuration file on any
default branch (the app reads one from the repository and does nothing without it), and zero pull
requests authored by `renovate[bot]` or `dependabot[bot]` across every pull request the eleven
repositories have. **Observed 2026-08-27**, and it is an exclusion by evidence rather than a
listing, which is why it is written here rather than left implicit.

## The versioning rules

The rule lives in three places that must agree: the published header (`contracts/tokens.css:4-5`),
`DESIGN.md` § Versioning (`:1028-1045`), and `ops/token-contract.md:163-169`. Stated here beside the
adoption record so the next change has it at hand rather than in a spine document. Nothing holds
the three texts equal the way the version is held; they are held by reading, and were read equal
on **2026-08-27**, the header's typo clause standing in `DESIGN.md:1039` in the same words. Where
they ever differ, the header is the text consumers vendor, and it is the one quoted here.

| Change | Bump | Source | Nature |
|---|---|---|---|
| A **value** changes | MINOR | `contracts/tokens.css:4` ("A value change or an addition is a MINOR bump"), `DESIGN.md:1032`, `ops/token-contract.md:165` | **Decision.** Pixels move, nothing breaks |
| A token is **added** | MINOR | `contracts/tokens.css:4`, `DESIGN.md:1033-1038`, `ops/token-contract.md:166` | **Decision.** A consumer that has not adopted it is unaffected |
| A token is **renamed**, including fixing a typo in its name | MAJOR | `contracts/tokens.css:4-5` ("A rename, including fixing a typo in a token name, or a removal is MAJOR"), `DESIGN.md:1039`, `ops/token-contract.md:167` | **Decision.** Contracts break |
| A token is **removed** | MAJOR | `contracts/tokens.css:5`, `DESIGN.md:1040-1041`, `ops/token-contract.md:168` | **Decision.** A consumer's `var()` silently falls back, which is why `--r-pill` stays declared but unused |
| **First publication** | nothing | `DESIGN.md:1036-1038`, `ops/token-contract.md:166` | **Decision.** A token present at first publication is not an addition and bumps nothing, which is why `--token-scrim` ships inside `v1.0.0` |
| **Rollout model** | deprecate, then migrate, then remove | `DESIGN.md:1042-1043`, `ops/token-contract.md:169` | **Decision.** There are no atomic commits across eight repositories, so a MAJOR ships the old name aliased to the new one first, every adopter migrates, and only then is the old name removed in a later MAJOR |
| **Adoption** | explicit and reviewed | `DESIGN.md:1044-1045`, AD-16 | **Decision.** Never an unattended merge, which is the policy above |
| **PATCH** | not a category | `contracts/tokens.css:4-5`, `DESIGN.md:1032-1041` map every change to MINOR or MAJOR | **Decision.** The third number stays `0` in a real release. The rehearsal below used `1.0.1` because `epics.md:1981` names it and because a version no release may produce cannot be mistaken for one. "May", not "can": the generator and every gate accept any `X.Y.Z`, and it is this rule, not a parser, that keeps the third number at `0` |

**What a pure addition is.** **Decision**, recorded here because the rule as published had no
category for one and the first answer ever given was improvised inside a story's acceptance
criteria (`epics.md:1969-1971`, review finding MED-2). A pure addition is **a new name whose
presence changes no value any existing consumer already reads**. Three consequences follow:

| If the change also... | Then it is... | Bump |
|---|---|---|
| changes nothing an existing consumer reads | a pure addition | MINOR |
| retunes an existing token's value beside the new name | an addition and a value change at once | still MINOR, and the ledger row names both |
| introduces the new name by renaming an old one, or removes an old one to make room | a rename or a removal wearing an addition's clothes | MAJOR, through deprecate, migrate, remove |

The test that pins this in the tree is `packages/tokens/__tests__/tokens-contract.test.ts`, which
pins `EXPECTED_NAMES` and thirteen category counts: an addition changes the list and the counts and
nothing else, a rename changes the list without changing the counts, and a removal shrinks both.

## The change-propagation runbook

`epics.md:1978-1980` names six steps: bump the header, publish, notify each adopter, re-vendor the
folder, update the Registry `token_contract` value, and confirm the scheduled drift check reads the
new value. This is each step with its exact commands and the pins it turns red, for a MINOR and for
a MAJOR. `corepack` prefixes every `pnpm` command because `pnpm` is not on this host's PATH.
**Decision** throughout, with the pins **Observed** in the rehearsal below.

**Notify** is defined here, because "notify" without a definition is a wish: appending a ledger row
to this file naming the adopter and the from and to versions, **and** opening a work item in the
adopter's own tracker (for `cs-tracker`, a story under
`C:\CuatroEcosystem\cs-tracker-workspace\_bmad-output`), with the pointer to that work item written
into the row. A notification that exists only in this repository has told nobody who works in the
other one.

### Step 1: bump the header, in `cuatro-portfolio`

| | MINOR (value change or addition) | MAJOR (rename or removal) |
|---|---|---|
| The change | Edit the DTCG source under `packages/tokens/tokens/*.json` | Add the new name beside the old one and make the old one an alias of the new (deprecate); the removal is a later MAJOR after every adopter has migrated |
| The version | `packages/tokens/package.json:3`, the single source: `1.0.0` to `1.1.0` | `1.0.0` to `2.0.0` |
| Regenerate | `corepack pnpm tokens:build` (writes `contracts/tokens.css` and `contracts/tailwind.css`, headers at `:2`) then `corepack pnpm fonts:build` (writes `contracts/fonts.css`, header at `:2`, from the same manifest via `packages/fonts/build.mjs:95-104`) | the same two commands |
| Pins that go red until updated | Three, **Observed** in the rehearsal: `packages/tokens/__tests__/tokens-contract.test.ts:645`, which pins the literal `1.0.0`; `:649-651` in the same file, whose expected message text carries `Contract v1.0.0`; and `ops/__tests__/contract-adoption.test.ts`, which holds this file's published-version line equal to the header. Beyond the suite, the `tokens-contract` and `fonts-contract` CI jobs, if the regenerated files are not committed with the manifest. For an addition, `EXPECTED_NAMES` and the category counts in the same test, and the counts in `ops/token-contract.md` § What v1.0.0 publishes | the same, plus the alias cases in `tokens-contract.test.ts` if the old name is now a `var()` to the new |
| Update together | The four things `ops/token-contract.md:576-583` names, plus this file's published-version line and a ledger row | the same, plus the deprecation written into the token's `$description` so it is published as a comment |
| Commit | One subject line, on `dev` | the same |

### Step 2: publish, in `cuatro-portfolio`

Merge `dev` into `main`. `.github/workflows/deploy.yml` deploys on every push to `main` and
`packages/contracts-serve/publish.mjs` copies `contracts/` into `public/contracts/` during the
build, so the served surface moves with the merge. Confirm with
`curl -sD - https://cuatro.dev/contracts/tokens.css -o - | Select-Object -First 12`, reading
`last-modified` and the `Contract vX.Y.Z` line. Pushing, merging and deploying are Operator acts
(`AGENTS.md` § Policy), so this step is the Operator's and not a story's.

### Step 3: notify each adopter

Append a row to the ledger below: the date, the version moved from and to, the adopter, and the
pointer to the work item opened in the adopter's own tracker. For a MAJOR the row also names the
deprecated names and the version they are removed in. Today the adopters are `cs-tracker` and the
Anchor itself; the Anchor's notification is the same commit as step 1, because the alias layer in
`app/app.scss` reads the roles in place and a MAJOR changes it there. **The row has a pin**,
**Observed** in the rehearsal: `ops/__tests__/contract-adoption.test.ts` holds the count line equal
to the number of rows and pins the count literally (`0 today`), so an event is the row, the count
line and that literal, in one change. Before editing any pin in either repository, confirm
`git branch --show-current` is the branch the change belongs on.

### Step 4: re-vendor the folder, in `cs-tracker`

```
Remove-Item -Recurse -Force assets\css\cuatro-contracts -ErrorAction Stop && Copy-Item -Recurse ..\..\cuatro-portfolio\contracts assets\css\cuatro-contracts
mix assets.build
```

One statement, not two, and `-ErrorAction Stop` with `&&` (PowerShell 7) so that a removal that
fails is never followed by the copy: `Copy-Item -Recurse` into a folder that still exists nests a new
`contracts` directory inside the old one rather than replacing it, and the drift detector then reports
an extra directory instead of a verbatim copy. The walk ran the two statements joined by `;` (the
step 4 transcript below); the `&&` form above was written afterwards, from finding 6, and has not
itself been walked. It is the form the next re-vendor uses.

The copy is the whole folder, nine files, never one file: `test/cs_tracker_web/token_contract_test.exs:31-41`
pins the file list and the sibling probe compares every file by sha256. Then update the pin at
`token_contract_test.exs:342` to the new version, and `@expected_files` if the file list changed.
For a MAJOR, also migrate every `var(--token-*)` in the theme block of `assets/css/app.css` off the
deprecated name. Run `mix test`, then from `cuatro-portfolio` run
`node ops/cs-tracker-adoption-probe.mjs`, whose first case is that the vendored folder is a verbatim
copy and whose FR-18 case is that the two applications still compute the same values. Commit on
`main`; the push is the Operator's.

| Pins that go red until updated | Where |
|---|---|
| `assert tokens =~ "Contract v1.0.0"` | `test/cs_tracker_web/token_contract_test.exs:342` |
| `@expected_files`, if a file was added or removed | `test/cs_tracker_web/token_contract_test.exs:31-41` |
| "The folder is a verbatim copy", until the copy is made | `ops/cs-tracker-adoption-probe.mjs`, hand-run |

### Step 5: update the Registry `token_contract` value

**Pinned to the re-vendor, never to the bump.** `token_contract` moves in the same session as the
step 4 commit: the re-vendor commit in `cs-tracker` first, the Registry edit in `cuatro-portfolio`
second, and the ledger row names both commits. Edit the `cs-tracker` entry of
`contracts/registry.json` so `token_contract` reads the new version; the Registry schema is validated
in CI (AD-4). The field moving with the bump instead would declare a version the folder does not yet
carry, and the check in step 6 would then be red for as long as the re-vendor took rather than
proving anything. **Walkable from 2026-09-03**: Story 2-5 authored the field and it reads `1.0.0`.
This step said "not walkable today: the field is Story 2.5's and does not exist yet" until then.
**It is also the step most likely to be skipped**, because nothing turns red if it is: the vendored
header and this record are both pinned by the blocking `test` job, and the Registry's copy of the
version is pinned by nothing at all.

### Step 6: confirm the scheduled drift check reads the new value

Story 2.23's job reads the target named above and compares it with `token_contract` (AD-18). It
compares the Satellite's own header with the Satellite's own declaration and nothing else, so it
cannot see that a Satellite is behind the published version; the view of who is behind is Story 8.4's
(`epics.md:4818-4824`). What it proves is that the declaration matches reality, and what shows that
it reads the header rather than the field is this: a run after both the re-vendor commit and the
Registry edit must pass; a run in the window between them, header moved and field not, must fail;
and a check that passes across a moved header with an unmoved field is broken, which is a finding
about the job. **Not walkable today**: the job is Story 2.23's. Until it exists, the hand-run
`node ops/cs-tracker-adoption-probe.mjs` is the only drift detector, and its recorded-version case
(§ The adopted versions) is the stand-in for the declaration-against-header comparison: it holds this
file's `cs-tracker` row to the vendored header, failing naming both values. The ledger row for the
event records that the detector was run and what it said.

## The rehearsal

The runbook was walked once on a throwaway `v1.0.1` on scratch branches named
`scratch/ad16-rehearsal-v1.0.1` in both repositories, never pushed, never merged, and deleted
afterwards. **It counts for nothing toward Epic 6's trigger**, which counts a contract release after
`v1.0.0` actually hand-propagated into at least one Satellite's vendored folder, and this release
was never published and never reached an adopter (`epics.md:4383-4385`, `:4411-4412`).

**Scope.** Steps 1 and 4 were executed, step 3 was executed as a dry run, and the hand-run drift
detector stood in for step 6 twice, once with one side bumped and once with both. Step 2 is an
Operator act and the branch was never allowed near a remote; steps 5 and 6 cannot be walked because
the Registry field is Story 2.5's and the scheduled check is Story 2.23's. Every command ran on the
development host on **2026-08-27 between 22:06:38Z and 22:12:01Z**, and every output below is quoted
from the transcript files the walk wrote. **Observed** throughout.

### Pre-walk, 22:06:38Z

```
> git checkout -b scratch/ad16-rehearsal-v1.0.1        (cuatro-portfolio, from dev at e5f1744)
Switched to a new branch 'scratch/ad16-rehearsal-v1.0.1'
> sha256 of every file under contracts/
4c954f73c713a01023e2bb22b56b73f343f17bf9d0a8beeb5ea844f8ea19872f  contracts/fonts.css
1b0e3c609f0a2851885801d5fc0a75e31d9754fa30ead847c4e5b3d80d3fdc5f  contracts/tailwind.css
319a825597995cbecacc43f08da9b24b48db636abc2b1e023ea4387a5cb38462  contracts/tokens.css
f27b91934aa5559116b55e670d5d0e0c00d4408b0e1a44c3d0b59ab20afb792c  contracts/fonts/bricolage-grotesque-latin.woff2
db540d97a0afd5f39a8f331c2b4aa259c56e943e05acfae752637fcf1976e336  contracts/fonts/geist-latin.woff2
14bf6b01f51a5172bc24327b63ee2a3b3e04d87329fccba275dc9789e7cbb89c  contracts/fonts/geist-mono-latin.woff2
4b5a7d8f37f5602621c8a8d7358a6a2e71317e6c231c661e15aef0275d3e07ba  contracts/fonts/OFL-bricolage-grotesque.txt
c683bfbcc7e087f5d37a54ef628f10387c451a83ddc459b151403a164ac46c90  contracts/fonts/OFL-geist-mono.txt
c683bfbcc7e087f5d37a54ef628f10387c451a83ddc459b151403a164ac46c90  contracts/fonts/OFL-geist.txt
```

The same nine values `ops/cs-tracker-token-adoption.md:47-57` records for the vendored folder.

### Step 1, executed: bump the header, 22:06:48Z

`packages/tokens/package.json:3` edited from `"1.0.0"` to `"1.0.1"`, then:

```
> corepack pnpm tokens:build
packages/tokens: reading  C:/CuatroEcosystem/cuatro-portfolio/packages/tokens/tokens/*.json
packages/tokens: reading  C:/CuatroEcosystem/cuatro-portfolio/packages/tokens/theme-map.json
packages/tokens: writing  C:/CuatroEcosystem/cuatro-portfolio/contracts/tokens.css
packages/tokens: writing  C:/CuatroEcosystem/cuatro-portfolio/contracts/tailwind.css
> corepack pnpm fonts:build
packages/fonts: reading  C:/CuatroEcosystem/cuatro-portfolio/packages/fonts/faces.json
packages/fonts: reading  C:/CuatroEcosystem/cuatro-portfolio/packages/fonts/fallback-metrics.json
packages/fonts: writing  C:/CuatroEcosystem/cuatro-portfolio/contracts/fonts.css
packages/fonts: 94400 bytes of faces, budget 120000 bytes
> the three headers
tokens.css:2: * Contract v1.0.1 · dark only · anchor hue 288
tailwind.css:2: * Contract v1.0.1 · generated @theme inline · dark only
fonts.css:2: * Contract v1.0.1 · latin subset · variable woff2
> git status --porcelain
 M contracts/fonts.css
 M contracts/tailwind.css
 M contracts/tokens.css
 M packages/tokens/package.json
> corepack pnpm test --run, 22:06:50Z
exit 1
 ❯ packages/tokens/__tests__/tokens-contract.test.ts (64 tests | 2 failed) 8767ms
     × equals the version in packages/tokens/package.json 21ms
     × fails naming both values when the two disagree 3ms
 ❯ ops/__tests__/contract-adoption.test.ts (18 tests | 1 failed) 36ms
     × states the published version, and it equals the Contract vX.Y.Z header and the manifest 11ms
 FAIL  ops/__tests__/contract-adoption.test.ts > the record and the header agree > states the published version, and it equals the Contract vX.Y.Z header and the manifest
AssertionError: expected [Function] to not throw an error but 'Error: the record says 1.0.0, the con…' was thrown
 ❯ ops/__tests__/contract-adoption.test.ts:266:101
 FAIL  packages/tokens/__tests__/tokens-contract.test.ts > the contract version in the header > equals the version in packages/tokens/package.json
AssertionError: expected '1.0.1' to be '1.0.0' // Object.is equality
 ❯ packages/tokens/__tests__/tokens-contract.test.ts:645:28
 FAIL  packages/tokens/__tests__/tokens-contract.test.ts > the contract version in the header > fails naming both values when the two disagree
AssertionError: expected [Function] to throw error matching /the header says Contract v1\.0…/tokens\ but got 'the header says Contract v1.0.1 and p…'
 ❯ packages/tokens/__tests__/tokens-contract.test.ts:649:53
 Test Files  2 failed | 27 passed (29)
      Tests  3 failed | 696 passed (699)
> git commit
bfe534c rehearsal: bump the contract to 1.0.1, never published
```

### The drift detector with one side bumped, executed, 22:08:16Z

`contracts/` at `1.0.1` on the scratch branch, `cs-tracker`'s vendored folder still at `1.0.0` on
`main`:

```
> node ops/cs-tracker-adoption-probe.mjs
FAIL  The folder is a verbatim copy: not a verbatim copy. 6 equal, 0 missing (none), 0 extra (none), 3 differing (fonts.css: contracts d85c573a1ae23a9ed5a58188aa2005a6bf4a64597954ed83b5f156a168b239ef against vendored 4c954f73c713a01023e2bb22b56b73f343f17bf9d0a8beeb5ea844f8ea19872f; tailwind.css: contracts 9182c8986697a78343a4e78e642f3340ba93a822945af594e85b8b09b8bc9e7e against vendored 1b0e3c609f0a2851885801d5fc0a75e31d9754fa30ead847c4e5b3d80d3fdc5f; tokens.css: contracts 3cb10bb233d6b665f4d26745a2231ac034e25333e70afdb5ec874ad550ed6428 against vendored 319a825597995cbecacc43f08da9b24b48db636abc2b1e023ea4387a5cb38462)
# 18 cases, 17 PASS, 1 FAIL
# elapsed 14.1s
exit 1
```

The other seventeen cases stayed green, including FR-18: a version bump moves no value, so the two
applications still compute the same 25 rows.

### Step 2, not executed: publish

Merging to `main` and the deploy that follows are Operator acts, and the whole point of the scratch
branch is that it never reaches a remote. `public/contracts/` was also never regenerated, because
nothing ran `packages/contracts-serve/publish.mjs`; on a real release the build does.

### Step 3, executed as a dry run: notify

A ledger row was written on the scratch branch, quoted here and never merged:

```
Propagation count: **1**
| 1 | 2026-08-27 | 1.0.0 | 1.0.1 | `cs-tracker` | DRY RUN, rehearsal only: no work item opened under `C:\CuatroEcosystem\cs-tracker-workspace\_bmad-output`, this row is never merged |
```

No work item was opened in `cs-tracker`'s tracker: a rehearsal that opens a real story asks a
consumer to migrate to a version that does not exist.

### Step 4, executed: re-vendor into `cs-tracker`, 22:10:43Z

```
> git checkout -b scratch/ad16-rehearsal-v1.0.1        (cs-tracker, from main at 6807f7a)
> Remove-Item -Recurse -Force assets\css\cuatro-contracts; Copy-Item -Recurse ..\..\cuatro-portfolio\contracts assets\css\cuatro-contracts
> git status --porcelain
 M assets/css/cuatro-contracts/fonts.css
 M assets/css/cuatro-contracts/tailwind.css
 M assets/css/cuatro-contracts/tokens.css
fonts.css:2: * Contract v1.0.1 · latin subset · variable woff2
tailwind.css:2: * Contract v1.0.1 · generated @theme inline · dark only
tokens.css:2: * Contract v1.0.1 · dark only · anchor hue 288
> mix test test/cs_tracker_web/token_contract_test.exs
  1) test the vendored contract folder (AD-14) tokens.css carries the Contract version header AD-16's drift check reads (CsTrackerWeb.TokenContractTest)
     test/cs_tracker_web/token_contract_test.exs:338
     Assertion with =~ failed
     code:  assert tokens =~ "Contract v1.0.0"
     right: "Contract v1.0.0"
       test/cs_tracker_web/token_contract_test.exs:342: (test)
26 tests, 1 failure
> mix test
Finished in 13.0 seconds (2.9s async, 10.1s sync)
653 tests, 1 failure (4 excluded)
> git commit
7035705 rehearsal: re-vendor the contract at 1.0.1, never published
```

The one failure in the whole suite is the pin at `:342`. `@expected_files` stayed green because the
file list did not change, and `cuatro_fonts_test.exs` stayed green because the faces did not.

### Step 5, not walkable: the Registry `token_contract` value

`contracts/registry.json` carries no `cs-tracker` entry and no `token_contract` field until
Story 2.5 writes them.

### Step 6, not walkable, and the detector re-run with both sides at `1.0.1`, 22:11:02Z

The scheduled check is Story 2.23's. Its hand-run stand-in, re-run after the re-vendor:

```
> node ops/cs-tracker-adoption-probe.mjs
PASS  The folder is a verbatim copy: 9 file(s) (pinned at 9) under assets/css/cuatro-contracts are byte-identical to contracts/ by sha256: fonts.css d85c573a1ae23a9ed5a58188aa2005a6bf4a64597954ed83b5f156a168b239ef, fonts/OFL-bricolage-grotesque.txt 4b5a7d8f37f5602621c8a8d7358a6a2e71317e6c231c661e15aef0275d3e07ba, fonts/OFL-geist-mono.txt c683bfbcc7e087f5d37a54ef628f10387c451a83ddc459b151403a164ac46c90, fonts/OFL-geist.txt c683bfbcc7e087f5d37a54ef628f10387c451a83ddc459b151403a164ac46c90, fonts/bricolage-grotesque-latin.woff2 f27b91934aa5559116b55e670d5d0e0c00d4408b0e1a44c3d0b59ab20afb792c, fonts/geist-latin.woff2 db540d97a0afd5f39a8f331c2b4aa259c56e943e05acfae752637fcf1976e336, fonts/geist-mono-latin.woff2 14bf6b01f51a5172bc24327b63ee2a3b3e04d87329fccba275dc9789e7cbb89c, tailwind.css 9182c8986697a78343a4e78e642f3340ba93a822945af594e85b8b09b8bc9e7e, tokens.css 3cb10bb233d6b665f4d26745a2231ac034e25333e70afdb5ec874ad550ed6428
# 18 cases, 18 PASS, 0 FAIL
# elapsed 13.9s
exit 0
```

So the detector reads the new value once both sides carry it, which is what step 6 will ask the
scheduled job to show. The transcript above shows eighteen cases: the recorded-version case
(§ The adopted versions) was added to the detector after this walk, on the review's finding that
nothing held this file's `cs-tracker` row to the vendored header, so a re-run today reports nineteen.

### The pins moved, and both suites green, 22:09:46Z to 22:11:16Z

On the `cuatro-portfolio` scratch branch: `tokens-contract.test.ts:645` to `'1.0.1'`, the expected
message at `:650` to `Contract v1\.0\.1`, this file's published-version line and its Anchor and
`cs-tracker` rows to `1.0.1`, and the dry-run ledger row above. `corepack pnpm vitest run` over the
two files then reported `81 passed, 1 failed`: the ledger pin `equals the number of event rows, 0
today` in `ops/__tests__/contract-adoption.test.ts`, which had to move to `1` as well, after which
`82 passed (82)`. Commits `9d3d074` and `b232347`. On the `cs-tracker` scratch branch:
`token_contract_test.exs:342` to `"Contract v1.0.1"`, then `26 tests, 0 failures`, commit `7feaecd`.

### Teardown, 22:12:01Z

```
> cuatro-portfolio: git checkout dev; git branch -D scratch/ad16-rehearsal-v1.0.1
Switched to branch 'dev'
Deleted branch scratch/ad16-rehearsal-v1.0.1 (was b232347).
git log -1: e5f1744 story 1-20: record the adopted contract versions, the automation policy and the AD-19 pass
git status --porcelain:                                (empty but for the story's own untracked spec file)
git branch --list 'scratch/*': []
contracts\tokens.css:2: * Contract v1.0.0 · dark only · anchor hue 288
contracts\tailwind.css:2: * Contract v1.0.0 · generated @theme inline · dark only
contracts\fonts.css:2: * Contract v1.0.0 · latin subset · variable woff2
public\contracts\tokens.css:2: * Contract v1.0.0 · dark only · anchor hue 288
public\contracts\tailwind.css:2: * Contract v1.0.0 · generated @theme inline · dark only
public\contracts\fonts.css:2: * Contract v1.0.0 · latin subset · variable woff2
  "version": "1.0.0",
hash comparison before against after: all 9 equal
> cs-tracker: git checkout main; git branch -D scratch/ad16-rehearsal-v1.0.1
Switched to branch 'main'
Deleted branch scratch/ad16-rehearsal-v1.0.1 (was 7feaecd).
git log -1: 6807f7a docs: state the no-unattended-automation policy beside the Cuatro entries
git status --porcelain:                                (empty)
git branch --list 'scratch/*': []
git diff --stat 8adb8e2:
 AGENTS.md | 6 ++++++
assets\css\cuatro-contracts\tokens.css:2: * Contract v1.0.0 · dark only · anchor hue 288
test\cs_tracker_web\token_contract_test.exs:342: assert tokens =~ "Contract v1.0.0"
```

The nine vendored hashes after teardown are the nine in `ops/cs-tracker-token-adoption.md:47-57`.

### What the walk found

1. **Step 1 turns three pins red, not two.** `tokens-contract.test.ts:645` pins the literal, and
   `:649-651` pins the *message* of the disagreement case, which also carries `Contract v1.0.0`; the
   record line in `ops/__tests__/contract-adoption.test.ts` is the third: at `:266` when the walk
   ran, as the transcript above shows, and at `:132` (`assertVersionsAgree`) since the review moved
   the parsers into `ops/contract-adoption.mjs`. The runbook above now names all three. Nothing else in the 699-case suite moved, so the bump reaches exactly the pins
   that exist for it.
2. **Step 3 has a pin of its own.** Appending a ledger row also moves the `0 today` literal in
   `ops/__tests__/contract-adoption.test.ts`; an event is the row, the count line and that pin, in
   one change. The runbook's step 3 now says so.
3. **Step 4 turns exactly one pin red** in `cs-tracker`, `:342`, and the whole 653-case suite runs
   in 13 seconds, so the adopter's gate is cheap to run at the re-vendor.
4. **The detector fires on all three stylesheets**, not on `tokens.css` alone, naming both hashes for
   each, and passes 9 of 9 after the re-vendor. A version bump moves three files in the vendored
   folder, which is what a re-vendor that copied only `tokens.css` would get wrong.
5. **The fonts header walks with the tokens header** from the one manifest, confirming
   `packages/fonts/build.mjs:95-104`; a bump that ran only `tokens:build` would publish two versions
   in one folder.
6. **A process finding about the walk itself.** The first attempt at step 4 never ran: the tool
   harness refused the command as a whole, so no scratch branch was created in `cs-tracker`, and the
   pin edit and its commit that followed landed on `main` as `b7ca08a`. It was reset to `6807f7a`
   with `git reset --hard` before the branch was created properly, and the reset is the first lines
   of the step 4 transcript file. Nothing had been pushed. The runbook's lesson: confirm
   `git branch --show-current` before editing any pin, in both repositories.
7. **Three steps and one column are still a guess written in the imperative**: publish, the Registry
   field and the scheduled check, for the reasons stated at each, and the whole MAJOR column of step 1
   and step 4 (adding the new name beside the old, aliasing the old to the new, migrating every
   `var(--token-*)` in `cs-tracker`'s `app.css` off the deprecated name, and the later removal), which
   this walk, a MINOR-shaped bump with no token change, never exercised. The first real MINOR walks
   the three steps; the first real MAJOR is where the column is walked, and it should be rehearsed on
   a scratch branch the same way before it is needed.

**The rehearsal counts for nothing toward Epic 6.** The count below stays at zero, the dry-run row
above was deleted with its branch, and the exclusion is written beside the count by name.

## The propagation ledger

Story 6.1 counts contract releases after `v1.0.0` that were actually hand-propagated into at least
one Satellite's vendored `cuatro-contracts/` folder; three such events fire Epic 6's trigger
(`epics.md:4379-4381`). The count is kept here, appended as each event occurs, never reconstructed
from git history (`epics.md:4415-4420`), and `ops/__tests__/contract-adoption.test.ts` holds the
line and the table equal.

Propagation count: **0**

| # | Date (UTC) | From | To | Satellites re-vendored | Deprecated names and removal version | Detector run and what it said | Pointer |
|---|---|---|---|---|---|---|---|

The two columns after the Satellites were added while the table was still empty, so a row can carry
what step 3 and step 6 say it carries: for a MAJOR, the deprecated names and the version they are
removed in (`none` for a MINOR); and for every event, that the drift detector was run after the
re-vendor and what it said. The dry-run row quoted in the rehearsal above was written in the table's
earlier six-column shape.

**What the count excludes, by name** (`epics.md:4383-4385`, `:4411-4412`): anything present at first
publication, including `--token-scrim`; any change to a document rather than to `contracts/`,
including this file; and **Story 1-20's rehearsal above**, which walked the process on a `v1.0.1`
that was never published and never reached an adopter. **Decision.**

**How to append an event.** Add a row with the ISO 8601 UTC date, the from and to versions, every
Satellite whose folder was re-vendored, the deprecated names and their removal version or `none`,
the detector run and what it said, and the pointer to the adopter's work item, naming the re-vendor
commit and the Registry edit; raise the count by one and move the `0 today` pin in
`ops/__tests__/contract-adoption.test.ts` in the same change; leave every earlier row in place. A
row with no re-vendored Satellite is not an event and is not added.

## The AD-19 pass

`cs-tracker` was measured on **2026-08-27** in Playwright's Chromium 151.0.7922.34 at a 360x800
viewport against the running application (`mix phx.server` on a Postgres 16 container seeded through
the application's own schemas; first at `8adb8e2`, then re-run at `32a466a` after the review patched
the probe, the two differing in this story's `AGENTS.md` bullet and the Operator's `mix.exs` change
only), not against a stylesheet or a fixture. **Observed**,
the re-run: across `/`, `/browse`, `/inventory`, `/wishlist`, `/items/1` and the sign-in failure
page, 117 interactive elements were read, 38 were hidden or zero-area and skipped, **5 measured at
or over 44x44 and 74 measured under the floor on at least one axis**, every one a numbered finding
with route, selector, text and size; 18 of the 74 are daisyUI's control defaults and 56 are sizes the
application authors itself. The focus ring read `2px solid rgba(198, 189, 255)` at `3px` offset with
`:focus-visible` matched on all three grounds, at 11.73:1, 11.24:1 and 10.47:1, on a real element on
`--token-bg` and on `--token-bg-raised` and on a planted `.btn` on `--token-bg-raised-2`, because no
interactive element in the application sits on that ground. **38 elements transition their outline
over a duration above zero**: Tailwind v4's `transition-colors` includes `outline-color` at 150 ms on
35 of them, and the three quick-link cards on `/` declare `transition-property: all` at 150 ms; 29
more name `all` over `0s`, never animate, and are excluded by reading. The probe exited 1 with 13
cases, 6 PASS, 7 FAIL. Nothing was fixed; daisyUI's control geometry is Story 8.1's restyle (AD-20).
The environment, the method, the seed script, the per-route table, every finding, the focus-ring
table and the verbatim transcript are in **`ops/cs-tracker-accessibility-pass.md`**.

## Stated limits

| Limit | Why it stands | Nature |
|---|---|---|
| **The estate observation is one day's, by one token** | Every cell in the policy table was read on 2026-08-27 by `gh api` and says so. A repository that gains a workflow or a configuration file tomorrow makes the table stale, not wrong; the method is recorded so it can be re-run | **Decision.** Pending Operator action 5 |
| **App installations could not be listed** | `user/installations` answered `403`. App-based automation is excluded by the absence of any of the sixteen configuration locations and of any bot-authored pull request, which is evidence rather than a listing | **Observed 2026-08-27** |
| **A required status check holds nowhere, and cannot hold in four repositories** | The fourth condition for enabling automation is that the suite's run is a required check on the default branch. The Anchor's `main` protection names no check, `digital-library`'s ruleset requires none, five repositories are unprotected, and the four private ones answer `403` on protection, rules and rulesets on the current plan. So automation is enabled nowhere and, until a check is required somewhere, may be enabled nowhere | **Observed 2026-08-27 between 22:38:57Z and 22:41:09Z** |
| **Test-file counts are path counts on the remote default branch** | They count test-shaped paths, support files included, not test cases. Only `cuatro-portfolio` and `cs-tracker` carry a test-case count, from suites run on this host | **Decision**, disclosed in the table |
| **`cs-tracker`'s adoption is not on the remote** | The remote `main` was last pushed 2026-08-13 and carries no vendored folder. The adopted version was read off the local checkout at `8adb8e2` | **Observed 2026-08-27.** Pending Operator action 1 |
| **Three repositories have a `dev` branch that was not inspected** | `cuatro-finance`, `StreamVault` and `poketracker-go` hold only `LICENSE` on `main`. The policy is about the default branch, where an unattended merge would land, and that is what was observed | **Decision** |
| **Steps 5 and 6 of the runbook cannot be walked** | The Registry `token_contract` field is Story 2.5's and the scheduled check is Story 2.23's; neither exists. The rehearsal marks both not walkable with the reason rather than pretending | **Decision** |
| **The notification in the rehearsal was a dry run** | The ledger row was written on the scratch branch and no work item was opened in `cs-tracker`'s tracker, because a rehearsal that opens a real story asks a consumer to migrate to a version that does not exist | **Decision** |
| **The published header stayed `1.0.0` throughout** | The bump lived on scratch branches only. Every file under `contracts/` hashes to its pre-walk value, both trees are clean and both scratch branches are gone, as the teardown check in the rehearsal shows | **Observed**, in the rehearsal |
| **The AD-19 pass is one host, one Chromium, one viewport, one day** | AD-19 asks for the pass once by hand after adoption and that is what was made. Story 8.1's restyle is the next time it must be run | **Decision.** Pending Operator action 4 |
| **The versioning table maps changes to `--token-*` names and values, and `contracts/tailwind.css` publishes generated `@theme` keys under the same version** | The table does not say which category a change to one of those keys falls in. The first release to need the answer is the `--spacing-*` collision filed as DW-15 in `_bmad-output/implementation-artifacts/deferred-work.md`; the category is that release's decision, and its ledger row names it | **Decision** |
| **The focus ring on `--token-bg-raised-2` was read on a planted control** | No interactive element in `cs-tracker` sits on that ground on any of the six routes. The ring's visibility on that ground is a property of the stylesheet the application ships and was read on a daisyUI `.btn` planted in the browser only; the absence of a real element is stated in the pass record as its own finding | **Observed 2026-08-27** |

## Pending Operator actions

This file hands the Operator work Story 1-20 may not do, in the shape `ops/token-contract.md` and
`ops/cs-tracker-token-adoption.md` use.

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Push `cs-tracker`'s `main`**, at `ae34619` today (`8adb8e2`, this story's two `AGENTS.md` commits `6807f7a` and `ae34619`, and the Operator's `32a466a`, four commits past the remote's 2026-08-13 push), so the drift check's target exists on the remote | Operator | The same act as `ops/cs-tracker-token-adoption.md` action 1. Until it happens the adopted-versions table describes a checkout on one host | _not done_ |
| 2 | **Set `token_contract` to `1.0.0` on the `cs-tracker` Registry entry in Story 2.5, and point Story 2.23's check at the target named here** | Operator, through those stories | Both stories name this record as their source. The target is repository, branch, path, line and pattern, above | _not done_ |
| 3 | **Decide the disposition of the 74 hit-target findings and the 38 transition findings** | Operator | They are Story 8.1's restyle under `RESTYLE-SPEC.md` § Family A (AD-20: a step carries nothing else), 18 of the 74 being daisyUI's defaults and 56 the application's own markup. The two causes behind the 38 transition findings are not geometry and may deserve an earlier decision: Tailwind v4's `transition-colors` transitions `outline-color` at 150 ms on every link that uses it, and the application's own `transition-all` on the three quick-link cards names `all`, so the ring's colour animates in on those controls; 29 more controls name `all` over `0s` and are excluded because they never animate. `EXPERIENCE.md`'s S-2 rule says never transitioned. The pass record names each | _not done_ |
| 4 | **Re-run `node ops/cs-tracker-accessibility-probe.mjs` after Story 8.1, after any Tailwind or daisyUI bump reaching `cs-tracker`, and on AD-22's refresh schedule**, and add this probe to that scope beside the two sibling probes | Operator | The probe needs a Postgres, a seeded database, a running `mix phx.server` and a Chromium, and the pass record says how to get all four in six commands. Nothing in CI can run it | _not done_ |
| 5 | **Re-gather the policy table on AD-22's schedule and whenever a repository gains a workflow or a dependency-automation configuration** | Operator | The script that gathered it is described in § The estate, observed, and takes about ninety seconds. A row that changes is a decision to record before the setting lands | _not done_ |
| 6 | **Decide whether the three LICENSE-only repositories' `dev` branches should be observed too** | Operator | The policy is about the default branch. If work on `dev` is where an automated merge could ever be enabled, the table needs a second column | _not done_ |
| 7 | **Reconcile Story 1-19's pipeline pin with `cs-tracker`'s `32a466a`** | Operator | `32a466a` took `cuatro.fonts` out of `assets.setup` so the container build can run; `ops/cs-tracker-token-adoption.md` § Where the compiled output lands records the alias as a decision, `ops/cs-tracker-adoption-probe.mjs` pins it (its `The build pipeline places them` case is red at `32a466a`), and `cs-tracker/AGENTS.md:36-39` still says the task runs in `assets.setup`. Either the pin and the two records follow the commit, or the commit is revisited; this story changed none of them because none is its | _not done_ |

**Maintaining this file.** When an action is performed, replace its `_not done_` cell with the ISO
8601 UTC completion date and leave the row in place. When a figure is re-measured or a repository is
re-observed, the adopted-versions and policy tables keep one row per repository, because
`assertEstateCovered` fails a name listed twice: replace the cells, and write the new date and
method into the Nature and method cell beside the old value and its date when the value moved, so a
later reader can see whether it moved or was simply re-stated. Every other table gains a row rather
than losing one. When a propagation event occurs, append the
ledger row and raise the count in the same change. Keep the header rows of the adopted-versions,
policy and ledger tables as they are: `ops/contract-adoption.mjs` parses them for the unit test and
for the hand-run detector. When automation is ever enabled in this repository, the Anchor's policy
cell and the configuration land in one commit, because the test holds them equal in both directions,
and that commit also moves the two literal pins in `ops/__tests__/contract-adoption.test.ts` § the
Anchor row matches the tree (the cell at `none`, the present list empty), which state today's state
and go red on their own otherwise.
When the estate moves to its next waypoint (`ops/estate.md` already schedules eight), four things
move together: the sentence in `ops/estate.md` that names the repositories, `ESTATE_COUNT` in
`ops/contract-adoption.mjs`, and both the adopted-versions and the policy table here. Deletion is not
used here.
