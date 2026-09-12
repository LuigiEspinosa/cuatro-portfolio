---
title: 'Story 2.23: Scheduled Registry verification, external to the box'
type: 'feature'
created: '2026-09-12'
status: 'done'
baseline_commit: 'c358109497e5ad50941f585a487a576711f023d7'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Nothing checks that the Registry tells the truth. Fourteen entries carry a `source`, six
a `live`, one a `token_contract`, and the only instruments are a schema gate that cannot see a URL
stop resolving (`ops/registry-schema.md:651`) and a hand-run probe that needs a local checkout of
`cs-tracker` (DW-14). In an estate with no user to discover it, a dead link stays in the Registry until
a Visitor finds it, the failure FR-32 and AD-18 exist to prevent.

**Approach:** One scheduled GitHub Actions workflow, off the box, runs a new
`ops/registry-verification.mjs` over the committed `contracts/registry.json`: `source` exists
(authenticated, api.github.com, a PAT in a repository secret) and resolves anonymously except where KV-2
tolerates a private one; `live` answers 2xx or 3xx at the first hop wherever the field is present; and
for every entry carrying `token_contract` the vendored `cuatro-contracts/tokens.css`, at the path
`ops/contract-adoption.md` records, carries a `Contract vX.Y.Z` header equal to the declaration, failing
by name when the repository is unreadable, the path is gone, the header is absent or the record names no
target. A failure fails the run, which emails the Operator; every run writes its table to the job
summary; a new record `ops/registry-verification.md` fixes the definitions, the AC4 procedure, the SM-4
readings table and the Operator actions.

## Boundaries & Constraints

**Always:**

- **A new workflow file, never a job in `ci.yml`.** Two suites pin the six-job set and the `on:` block
  verbatim (`contract-purity.test.ts:976,1027`, `registry-schema.test.ts:1703,1721`). Triggers:
  `schedule` daily at `17 6 * * *` UTC, `workflow_dispatch`, and `push` with `paths` limited to the
  workflow, the script, the record and `contracts/registry.json`: the pre-merge proof on `dev`
  (`schedule` fires only from `main`, which lacks the Registry until Epic 2 merges) and the
  "confirms it resolves" later stories expect after a Registry edit (`epics.md:3003,4072,4147,4266`).
  The node-only shape of `ci.yml:166-185`: `checkout@v7`, `setup-node@v7` node 22 with
  `package-manager-cache: false`, `runs-on: ubuntu-latest`, `timeout-minutes: 10`, no
  `continue-on-error`, no `|| true`, no `if:`, no `permissions:`.
- **AC3 is a step, then an observation.** `test "$RUNNER_ENVIRONMENT" = github-hosted` runs before the
  script, so a self-hosted runner registered on the VPS later fails the job rather than satisfying it;
  the first real run's "Set up job" lines (runner image, machine name) and run URL are quoted in the
  record as the confirmation.
- **The Registry is read from the checkout**, never from `https://cuatro.dev/contracts/registry.json`:
  the served copy is 404 until Epic 2 merges, and reading the box defeats the whole-box case AD-18 names.
- **The script is pure exports plus a thin `main`.** `verify({ registry, record, fetch, token })` takes
  the fetcher as an argument (`asset-budget.mjs:901-908` idiom; nothing in the repository stubs
  `fetch`), `node:` builtins only, the `invokedDirectly` guard and exit discipline of
  `contract-purity.mjs:432-461`. Exit 0 every check passed, 1 a check failed, 2 defect (secret absent,
  record or Registry unparseable). One `PASS  name: detail` or `FAIL  name: detail` line per check
  (`cs-tracker-adoption-probe.mjs:1028-1031`), and the same rows as a markdown table appended to
  `$GITHUB_STEP_SUMMARY` when set.
- **"Resolves" is one GET with `redirect: 'manual'`, 2xx or 3xx passes** (UptimeRobot precedent,
  `monitoring.md:100-109`; tracker 307, cs-tracker 302 into Steam, library 302 are all healthy), sent as
  `User-Agent: cuatro-registry-verification/1 (+https://cuatro.dev/contracts/registry.json)` with a 15 s
  timeout and one retry on a network error or 5xx. 404 reports `absent`, anything else `unreachable`;
  both fail.
- **`source` has two halves.** For `https://github.com/<owner>/<repo>` (every entry today): `GET
  api.github.com/repos/<owner>/<repo>` with `Authorization: Bearer <token>`, 200 means exists, and
  `archived: true` is not a failure (Lumen, tcg-tracker); then the URL itself anonymously: 2xx or 3xx
  resolves; 404 on a repository named in the record's KV-2 table is `PASS ... tolerated by KV-2`; 404 on
  any other is FAIL (a public repository went private, FR-10); 2xx on a KV-2 row passes and says the row
  can be struck. A non-GitHub `source` gets the anonymous half only.
- **`live` is checked wherever the field is present**, not only when `status` is `Live` (Decision): the
  schema forbids `live` only on `Archived` (`registry.schema.json:64,134-143`), so a demoted entry that
  kept its URL is caught by the job and by nothing else.
- **`token_contract` resolves to a recorded target, never a search** (`contract-adoption.md:109-110`).
  For every entry carrying it, the path is the `File read` cell of the row in
  `ops/contract-adoption.md` § The adopted versions whose Application equals the last segment of
  `source` (`adopterRows`, `contract-adoption.mjs:183-193`); `not adopted` or `none` is FAIL "declared
  but no recorded target". Read `repos/<owner>/<repo>/contents/<path>?ref=<default_branch>` with
  `Accept: application/vnd.github.raw`, `default_branch` from the repos call. Four distinct failures:
  repository unreadable (token or visibility); path absent after the repository answered 200 (folder
  moved or renamed, AC2); header absent (`headerVersion` throws); mismatch (`recordedVersionVerdict`
  detail, `contract-adoption.mjs:335-345`).
- **The secret is `REGISTRY_VERIFICATION_TOKEN`**, a fine-grained PAT with Contents read on
  `cs-tracker`, `cs-tournament`, `StreamVault`, `Mutuo`, passed as `env:` on the script step only.
  Absent means exit 2 naming the secret and nothing fetched. Never printed, logged or written.
- **Every figure the record states about the workflow has a standing case** in
  `ops/__tests__/registry-verification.test.ts` (`contract-purity.md:55-56`), the YAML read with CRLF
  normalised (`contract-purity.test.ts:897-899`). Every verdict is shown firing on a planted fetcher and
  every parser asserts it read something.
- **Records are appended and dated, never rewritten where dated.** `ops/contract-adoption.md` keeps its
  three parsed headings, its header rows, its one published-version line and its one
  propagation-count line (`contract-adoption.mjs:76-139,150,258`).

**Ask First:**

- Creating an UptimeRobot HEARTBEAT monitor on alert contact 8726805 as the dead-man's switch for
  GitHub's 60-day inactivity disable and for a schedule that never fires: the free plan may refuse it
  as it refused `sslExpirationReminder` (`monitoring.md:171-175`). If it lands, the script pings
  `$REGISTRY_VERIFICATION_HEARTBEAT_URL` after a fully passing run and the URL is a second secret;
  either outcome is recorded.
- Minting the PAT and adding the secrets is the Operator's. The first run before the PAT exists is the
  deliberate failure that proves the mail path (`monitoring.md:554-564`) and is dated as "Alert path
  last verified".
- Following redirects, a same-origin final-URL rule, HEAD before GET, or any interval other than daily.
- Any file under `contracts/` (three listings pin it) or any edit to `ops/registry-schema.mjs`
  (standing cases forbid env, argv and fetch there, `registry-schema.md:80-84`).

**Never:**

- The job never edits, commits or opens anything: no bot commit (`deploy.yml:3-5` deploys every push
  to `main`; AD-16), no `permissions:` beyond default, no issue creation.
- No job in `ci.yml`; no edit to `AGENTS.md` (managed block; the "22 records" count is already stale
  at 24 and belongs to the refresh booked before Epic 3).
- No "who is behind the published version" check: that blind spot is designed and is Story 8.4's
  (`sprint-change-proposal-2026-08-15.md:758-762`).
- No hard-coded vendored path in the script: `CS_TRACKER_TOKENS` is the record's value and the
  script reads the record, so Story 8.2's second adopter is picked up from its row.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| All fourteen, PAT present | Committed Registry, adoption record, live network | 14 exists PASS; 10 resolves PASS and 4 `tolerated by KV-2`; 6 live PASS (3 via 3xx); 1 token PASS `1.0.0` against `Contract v1.0.0`; exit 0; summary table | none |
| Secret absent | `REGISTRY_VERIFICATION_TOKEN` unset | exit 2, one line naming the secret, nothing fetched | The forced failure that proves the mail path |
| Public source went private | Anonymous 404, repository not in the KV-2 table | FAIL naming the entry and KV-2 | |
| KV-2 repository made public | Anonymous 2xx on a KV-2 row | PASS, "KV-2 row can be struck" | |
| `live` down | Two 5xx, or a timeout | FAIL `unreachable`; a 404 is FAIL `absent` | One retry, then the last answer decides |
| `live` on a non-Live entry | `In progress` entry carrying `live` | Checked the same; FAIL when it does not resolve (AC4) | |
| Folder moved | repos 200, contents 404 | FAIL "cuatro-contracts folder moved or renamed" (AC2) | Distinct from unreadable |
| Repository unreadable | repos 404 or 401 | FAIL naming the repository and the secret, never "moved" | |
| Header moved, field not | Vendored `Contract v1.0.1`, `token_contract` 1.0.0 | FAIL naming both (`contract-adoption.md:419-421`) | |
| Declared, not adopted | Planted entry with `token_contract`, record row `not adopted` | FAIL "no recorded target" | |
| Not GitHub-hosted | `RUNNER_ENVIRONMENT` is not `github-hosted` | The step fails before the script runs (AC3) | |

</frozen-after-approval>

## Code Map

**Governing text**

- `ARCHITECTURE-SPINE.md:185-189` AD-18 (the three checks, off the box, notify); `:173-177` AD-16 (same
  job verifies `token_contract`; a renamed folder breaks the check); `:161-165` AD-14 (only the folder
  name is fixed, not its parent: cs-tracker's is under `assets/css/`); `:259` secrets live in Actions.
- `prd.md:546-553` FR-32; `:495-502` FR-28; `:356-363` FR-19; `:740` SM-4. `epics.md:2872-2915` the
  story; `:4692-4695` Story 8.2 adds a second `token_contract`; `:3003,4072,4147,4266` re-runs expected.
- `ops/monitoring.md:848-851` AD-17a `satisfied as of 2026-08-17` (cite, do not re-derive); `:994` this
  story's row in "Which stories read this line" (stale `epics.md:2722`); `:100-109` 2xx or 3xx; `:29-31,
  142-150` the mailbox and its single point of failure; `:554-564` alert path re-test; `:566-588` no
  watchdog, "a decision for a later story"; `:539-552` the readings table shape; `:1013-1026` Pending
  Operator actions shape.

**The Registry**

- `contracts/registry.json:5-156`: fourteen entries, `source` on all, `live` at `:14,25,37,50,61,72`,
  `token_contract` only at `:39` (cs-tracker, `1.0.0`). Every `source` is
  `https://github.com/LuigiEspinosa/<Repo>` at real capitalisation (`registry.schema.json:46`).
- `contracts/registry.schema.json:76-80` source pattern; `:102-106` live; `:117-121` token_contract;
  `:123-143` Live requires `live`, Archived forbids it, `:64` Complete and In progress unconstrained.
- Observed 2026-09-12: cs-tracker, cs-tournament, StreamVault, Mutuo answer 404 anonymously and 200
  authenticated (`gh api`, default branch `main` on all four); Lumen and tcg-tracker `archived: true`,
  200 anonymously; `raw.githubusercontent.com` 503-flapped on public repositories, so the contents API
  is the read.
- `ops/known-violations.md:63,205-215,223-234` KV-2: the four tolerated private sources; `:448` action
  5. `ops/estate.md:326-332` the same four by `gh repo list`. `ops/registry-inputs.md:63-90` the
  expected-state table per source and live.

**What to reuse**

- `ops/contract-adoption.mjs:33-34` `VENDORED_TOKENS`, `CS_TRACKER_TOKENS`; `:64-65` `SEMVER`,
  `HEADER_PATTERN`; `:76-139` `withoutFences`, `section`, `cells`, `table`, `unticked` (parse the new
  record's KV-2 table with them); `:162-166` `headerVersion` (throws when absent); `:183-193`
  `adopterRows`, returning `{ application, path, version }`; `:335-345` `recordedVersionVerdict`.
- `ops/contract-adoption.md:61-73` the adopted-versions table (Application is the repository name,
  File read is the path); `:75-80` "local until pushed", stale: the folder is on remote `main` since
  2026-08-27T22:39:15Z (`cs-tracker-token-adoption.md:842`); `:82-94` the probe is the stand-in "until
  Story 2.23's job exists"; `:105-123` the exact target table; `:413-426` runbook step 6; `:748-749`
  actions 1 and 2 `_not done_`; `:756-757` maintaining rule.
- `ops/contract-purity.mjs:432-461` the guard and exit discipline. `ops/registry-schema.mjs:112-127`
  `printable` for anything the job prints that came off the network.
- `ops/cs-tracker-adoption-probe.mjs:1028-1031` the PASS/FAIL line; `:1177-1203` the hand-run step-6
  case whose comment names this story.
- `.github/workflows/ci.yml:166-185` the node-only job shape; `deploy.yml:53-55` the `secrets.NAME`
  wiring; `ci.yml:279-288` the only artifact upload (not used: 7-day retention says nothing durable).
- `ops/__tests__/contract-purity.test.ts:41-55` `atCollection` and the spawned guard; `:897-932` the
  workflow reader (CRLF normalise, `\njobs:\n`, `JOB_ID`, `blockFor`, `instructionsOf`); `:946-1016`
  the per-job pins to mirror. `ops/__tests__/contract-adoption.test.ts:1-110` the suite skeleton and
  `fragment()` planted controls. `.gitattributes:14-17` pins `eol=lf` for `.mjs` not `.yml`.
- `ops/bot-mitigation.md:44-49` rule 1 blocks a named UA list, rule 3 challenges empty UAs, rule 2
  skips only `UptimeRobot`: the job's named UA passes today and is recorded so a rule edit cannot
  silently redden the live check.

**Pins a new file trips**

- None under `.github/workflows/`: `contract-purity.test.ts:33` and `registry-schema.test.ts:39` read
  `ci.yml` by path, `capacity-gate.test.ts:16` reads `deploy.yml`, `contract-adoption.mjs:45-61`
  scans fixed Dependabot and Renovate paths. Nothing enumerates `ops/`.
- Anything under `contracts/` fails three listings and `cs-tracker-adoption-probe.test.ts:147-156`.

**Deferred work**

- `deferred-work.md:1724-1745` (source_spec 2-5, open): `token_contract` held equal to nothing;
  proposes one case reading the Registry. Closed by the new suite. `:1704-1722` names this job as
  nonexistent, in passing. `:1214-1220` DW-14 stays open (the probe's checkout half). `:52-64` the
  AD-17a honour gate: read, not closed. Next free id after DW-82 (`:4154`).

## Tasks & Acceptance

**Execution:**

- [x] `.github/workflows/registry-verification.yml`: new. `on:` `schedule` `17 6 * * *`,
      `workflow_dispatch`, `push` `paths` the four files; one job `registry-verification`, `ci.yml:166-185`
      shape, `timeout-minutes: 10`; step "Runner is GitHub-hosted" `test "$RUNNER_ENVIRONMENT" =
      github-hosted`; step "Registry verification" `node ops/registry-verification.mjs` with `env:`
      `REGISTRY_VERIFICATION_TOKEN: ${{ secrets.REGISTRY_VERIFICATION_TOKEN }}` (and the heartbeat URL if
      Ask First lands). Comment block in the file's own voice, as `ci.yml:147-163` does.
- [x] `ops/registry-verification.mjs`: new. Exports `RECORD_REL`, `USER_AGENT`, `SECRET`, `kv2Rows(record)`,
      `vendoredTarget(entry, adopters)`, `classify(response)`, `verify({ registry, record, fetch, token })`
      returning `{ ok, lines, rows }`, `summaryTable(rows)`; `main()` reads the two records and the Registry beside
      the module, `process.env`, `globalThis.fetch`, appends to `GITHUB_STEP_SUMMARY`, guard and exit
      codes 0/1/2. Entries fetched with `Promise.all`.
- [x] `ops/__tests__/registry-verification.test.ts`: new. Planted-fetcher cases for every matrix row;
      `kv2Rows` and `vendoredTarget` on `fragment()` controls; the spawned script with the secret unset
      exits 2 naming it; workflow-text pins (triggers, `runs-on`, node 22, `package-manager-cache:
      false`, `timeout-minutes`, the environment step text, the run line, the secret name, no
      `continue-on-error`, `|| true`, `if:`, `permissions:`); the real Registry's cs-tracker
      `token_contract` equals `recordedAdoptedVersion(record, 'cs-tracker')`.
- [x] `ops/registry-verification.md`: new record in the `contract-adoption.md:1-32` head shape. Sections:
      "The job" property table (`contract-purity.md:42-59` rows plus Triggers, Secret, User agent,
      Schedule); "What resolves means"; "Sources tolerated to answer 404 anonymously" (the KV-2 table the
      script parses: Repository, Ruling, Since); "When a live URL stops resolving" (AC4: status off Live
      and `live` removed in one change whatever the destination; the schema enforces the Archived half,
      the job the rest); "Alert path" (who receives a failed-run mail and why: the last committer of the
      workflow file; last verified date); "Readings" (SM-4 monthly table: month, links checked, resolved,
      share, run URL, taken by; first row from the first green run); "Stated limits" (run history and
      summaries expire at 90 days; the AD-18 blind spot; the 60-day schedule disable and its mitigation
      or its absence; fine-grained PAT expiry); "Pending Operator actions" (mint the PAT with its expiry
      date, add the secret, confirm the failure mail, first reading, heartbeat decision, rotate before
      expiry).
- [x] `ops/contract-adoption.md`: date actions 1 (`2026-08-27T22:39:15Z`, observed 2026-09-12 by `gh api`)
      and 2 in `:748-749`; dated paragraphs appended after `:80` (the folder is on remote `main`), after
      `:94` and inside `:413-426` (the job exists; the probe remains the local instrument, DW-14).
      `ops/cs-tracker-adoption-probe.mjs:1177-1203`: one comment line.
- [x] `ops/monitoring.md:994`: the row gains the date read and the current `epics.md:2872` anchor;
      `:566-588` a dated note on the heartbeat outcome. `ops/bot-mitigation.md`: a dated note under the
      rules table recording the job's user agent.
- [x] `deferred-work.md`: assign an id to `:1724-1745` and close it naming the case; note on DW-14; file
      the 90-day retention ceiling, the 60-day disable (if no heartbeat) and the PAT expiry as new entries.
- [x] Observed runs, in the record: the first push run on `dev` before the secret (exit 2, mail received,
      dated), the run after the secret (green), the "Set up job" runner lines and both run URLs.

**Acceptance Criteria:**

- Given `corepack pnpm test --run` and `corepack pnpm typecheck`, when they run, then both pass, every
  planted control in the new suite has been observed failing its clean counterpart, and
  `ops/__tests__/contract-adoption.test.ts` still passes over the edited record.
- Given the workflow on `dev`, when it runs on a GitHub-hosted runner with the secret absent and then
  present, then the first run exits 2 naming `REGISTRY_VERIFICATION_TOKEN` and the Operator confirms the
  failure mail arrived, the second run exits 0 with fourteen exists, ten resolves plus four tolerated, six
  live and one token line all PASS, and both run URLs and the runner lines are in the record.
- Given the record, when the Operator reads it, then it states the schedule, the definition of resolves,
  the KV-2 table, the AC4 procedure, the alert path with its verified date, the first SM-4 reading, the
  stated limits and the pending actions, each Observed with method or Decision with reason.
- Given `contracts/registry.json` and `ops/contract-adoption.md`, when either side's `1.0.0` moves alone,
  then the new suite fails naming both values.

## Design Notes

**Why both halves of the source check.** Anonymous only is red from the first run (KV-2's four), and
`monitoring.md:302` says a permanently red signal is the one failure to avoid. Authenticated only hides
a public repository quietly going private, the exact FR-10 regression a Visitor would hit. AD-18 asks
"exists"; SM-4 measures published links. Two requests per entry answer both, and the tolerated list
lives in the record so striking a row is an edit, not a deploy.

**Why the record carries the path.** AD-14 fixes the folder name, not its parent, and the record
already parses a per-application `File read` column. Hard-coding cs-tracker makes Story 8.2 pass
silently; searching the tree is what `contract-adoption.md:109-110` forbids. Joining on the `source`
URL's last segment costs one line and means an adopter that renames its folder without editing the
record fails with "moved or renamed", which is AC2.

**Why no bot commit.** `deploy.yml` deploys every push to `main` with no paths filter and `ci.yml`
runs on every push; a daily bot commit would compile on the two-core box daily and breach the
automation policy's spirit. The job summary is the per-run record and the monthly reading is the
durable one; the 90-day ceiling is written down rather than hidden.

**Why `push` on four paths.** `schedule` runs only from the default branch, which is `main`, which
this branch reaches per epic; without `push` the job would first run weeks after review, unproven.
The same trigger is what lets Story 2.25 edit `live` and read the answer in the same push.

## Verification

**Commands:**

- `corepack pnpm test --run`: passes. **Run 2026-09-12 after the review pass**: `Test Files  51 passed
  (51)`, `Tests  1265 passed (1265)`, `Duration  69.84s`. The new suite,
  `ops/__tests__/registry-verification.test.ts`, is 55 of those; `ops/__tests__/contract-adoption.test.ts`
  still passes over the edited record (30).
- `corepack pnpm typecheck`: **exit 0**, run 2026-09-12 after the review pass.
- `node ops/registry-verification.mjs` on this host with the secret unset: **exit 2**, one line on
  stderr: `REGISTRY_VERIFICATION_TOKEN is not set, so nothing was fetched. Add the repository secret
  (ops/registry-verification.md).` Run 2026-09-12.
- The same script with the `gh` CLI's `repo`-scoped token standing in for the PAT (value never
  echoed): **exit 0, `# 35 of 35 checks passed`**, the table appended to a scratch
  `GITHUB_STEP_SUMMARY`. Run 2026-09-12 against the live estate; the token line read `the Registry
  declares 1.0.0 and LuigiEspinosa/cs-tracker:assets/css/cuatro-contracts/tokens.css@main reads
  Contract v1.0.0`.
- Every planted control observed failing its clean counterpart, on the reviewed module, 2026-09-12:
  twelve mutations (404 read as resolves, KV-2 tolerance removed, no retry, token sent anonymously,
  struck rows tolerating, moved read as unreachable, the secret guard dropped, the permission gap
  read as unreachable, entries not validated, `allSettled` dropped to `all`, the github.com shape
  not checked, the exit-1 path collapsed to 0) each turned the expected cases red, and the module was
  restored byte-identical after each.
- `gh run list --workflow registry-verification.yml --branch dev`: **pending the push**, which is the
  Operator's act. Expected: two runs, the first failed, the second success; `gh run view <id> --log`
  showing "Runner Image: ubuntu" under Set up job.
- `node ops/cs-tracker-adoption-probe.mjs` still runs: exit 0 on 2026-09-12 (DW-14's local instrument
  is untouched but for one comment line).

**Manual checks:**

- The failed-run mail is in the Operator's inbox, dated in the record. **Pending the push.**
- The Actions summary of the green run shows the 35-row table. **Pending the push.**

## Spec Change Log

**2026-09-12, review pass.** Non-frozen sections only; the frozen block stands as written.

- `verify` takes `adoption` as a fifth input beside `registry`, `record`, `fetch` and `token`, because
  the `token_contract` check reads `ops/contract-adoption.md`, which the frozen block itself names as
  the path source (`adopterRows`, `contract-adoption.mjs:183-193`), and `main` reads both records.
- `main` takes injected effects with defaults, `main(fetch = globalThis.fetch, env = process.env)`,
  so the suite drives the exit 1 path, the summary append and the unwritable-summary exit 2 without a
  network; the guard still calls `main()`. Added because the reviewer showed the exit-1 path
  collapsing to 0 left the suite green.
- The extra exports beyond the frozen list (`REGISTRY_REL`, `API`, `GITHUB_SOURCE`,
  `TOLERATED_HEADING`, `TIMEOUT_MS`, `main`) exist for the suite's pins.
- Review findings applied in the module: a github.com `source` of any other shape fails `source
  exists` by name rather than being skipped; the `token_contract` detail is composed locally as "the
  Registry declares X and <where> reads Contract vY"; a contents 401 or 403 after a 200 repository
  call is its own permission-gap failure; a body cut mid-read is `unreachable`; struck-row detection
  is lenient and case-insensitive; the `File read` path is encoded per segment; entries are validated
  before any fetch; `Promise.allSettled` keeps every entry's rows; `printable` on every line and row;
  one secret check, in `verify`.
- **KEEP:** the record carries the KV-2 table and the script parses it; the four-way (now five-way,
  with the permission gap) token failure classification; no bot commit.

**2026-09-12, at close.** The build workflow ends with the tree unpushed by rule, so the last task
(Observed runs) and the second acceptance criterion stay open until the push: the first `push` run
on `dev` before the secret exists (exit 2, the failure mail confirmed and dated as "Alert path last
verified"), the PAT minted and `REGISTRY_VERIFICATION_TOKEN` added, the run after it (35 of 35),
both run URLs and the runner lines into `ops/registry-verification.md` § Observed runs, and the first
§ Readings row. The heartbeat is an Ask First still undecided (Pending Operator action 5, DW-85).
One review finding was deferred rather than fixed: DW-87, the estate's workflows pin actions by tag
and restrict no token permissions.

**2026-09-12, after the push.** The two runs happened as specified and the second acceptance
criterion is met: run 34721281941 (push of `d91fe09`, before the secret) exited 2 naming
`REGISTRY_VERIFICATION_TOKEN` and the Operator confirmed the failure mail; the PAT was minted
(twice: the first was pasted onto a command line in this session and revoked as exposed), the secret
set over stdin at 22:25:31Z, and run 34722748245 (push of `8e80290`) passed 35 of 35 on a
GitHub-hosted `ubuntu-24.04` runner. Both runs, the alert-path date, the first SM-4 reading (20
checked, 16 resolved, 80%) and actions 1 to 4 and 7 are in `ops/registry-verification.md`. Still
open: action 5 (the heartbeat) and action 6 (rotate before 2026-12-11).

**2026-09-12, the heartbeat ruled.** The Operator said yes; the free plan refused the HEARTBEAT
type on three `create-monitor` attempts, nothing was created, no ping is wired, and the refusal is
recorded in the record's action 5 and § Stated limits, in `ops/monitoring.md`, and on DW-85, which
stays open naming the `workflow_dispatch` fallback. Action 6 (rotate before 2026-12-11) is the one
open item. The Operator moved the story to `done` on the board the same day.

## Suggested Review Order

**The job, off the box**

- Start here: schedule fires only from `main`, so `push` on four paths is the proof on `dev`.
  [`registry-verification.yml:24`](../../.github/workflows/registry-verification.yml#L24)

- AC3 as a mechanism: a runner registered on the VPS fails this step before the script runs.
  [`registry-verification.yml:59`](../../.github/workflows/registry-verification.yml#L59)

- The only `env:` in the file, on the one step that reads the secret.
  [`registry-verification.yml:65`](../../.github/workflows/registry-verification.yml#L65)

- Every figure the workflow states, Decision or Observed, each held by a standing case.
  [`registry-verification.md:42`](../../ops/registry-verification.md#L42)

**Three checks per entry**

- The order of checks and the two halves of `source`: exists authenticated, resolves anonymously.
  [`registry-verification.mjs:191`](../../ops/registry-verification.mjs#L191)

- A github.com URL of the wrong shape fails by name; nothing is skipped in silence.
  [`registry-verification.mjs:225`](../../ops/registry-verification.mjs#L225)

- KV-2 tolerance: a 404 on a listed repository passes and says which row tolerates it.
  [`registry-verification.mjs:240`](../../ops/registry-verification.mjs#L240)

- Folder moved or renamed, distinct from unreadable and from the permission gap on the same call.
  [`registry-verification.mjs:291`](../../ops/registry-verification.mjs#L291)

- The vendored path comes from the adoption record's `File read` cell, joined on the source's last segment.
  [`registry-verification.mjs:111`](../../ops/registry-verification.mjs#L111)

- The KV-2 table the script parses on every run; a struck row tolerates nothing.
  [`registry-verification.mjs:76`](../../ops/registry-verification.mjs#L76)

- One GET, redirects not followed, 15 s, one retry on a 5xx or a network error.
  [`registry-verification.mjs:156`](../../ops/registry-verification.mjs#L156)

- Entries validated before any fetch, then `allSettled` so one throw hides no other entry.
  [`registry-verification.mjs:363`](../../ops/registry-verification.mjs#L363)

- `main(fetch, env)`: injected effects, exit 0, 1 or 2, the job summary appended.
  [`registry-verification.mjs:410`](../../ops/registry-verification.mjs#L410)

**What the record fixes**

- The tolerated sources, KV-2's copy, and how a row is struck without touching the script.
  [`registry-verification.md:86`](../../ops/registry-verification.md#L86)

- Not following redirects is this job's own decision, with its reason; UptimeRobot follows them.
  [`registry-verification.md:61`](../../ops/registry-verification.md#L61)

- The AC4 procedure, and why `live` is checked wherever the field is present.
  [`registry-verification.md:116`](../../ops/registry-verification.md#L116)

- Who a failed run mails, and the verification still pending the push.
  [`registry-verification.md:136`](../../ops/registry-verification.md#L136)

- The SM-4 readings table, the stated limits, and what the Operator is handed.
  [`registry-verification.md:146`](../../ops/registry-verification.md#L146)

**The suite**

- The estate as observed: 35 checks on a planted fetcher answering what the hosts answered today.
  [`registry-verification.test.ts:217`](../../ops/__tests__/registry-verification.test.ts#L217)

- `main`'s exit paths, the case the review added after showing exit 1 could collapse to 0 unseen.
  [`registry-verification.test.ts:287`](../../ops/__tests__/registry-verification.test.ts#L287)

- The Registry's `token_contract` held to the adoption record's row, DW-83's case.
  [`registry-verification.test.ts:795`](../../ops/__tests__/registry-verification.test.ts#L795)

- The workflow pins: triggers, runner, the environment step before the script, the secret once.
  [`registry-verification.test.ts:869`](../../ops/__tests__/registry-verification.test.ts#L869)

**Peripherals**

- The adoption record: the folder observed on remote `main`, actions 1 and 2 dated.
  [`contract-adoption.md:82`](../../ops/contract-adoption.md#L82)

- The two pending actions this story closes.
  [`contract-adoption.md:777`](../../ops/contract-adoption.md#L777)

- AD-17a read and dated before the automation was enabled.
  [`monitoring.md:1005`](../../ops/monitoring.md#L1005)

- The watcher's single point of failure, reopened for the heartbeat ruling.
  [`monitoring.md:590`](../../ops/monitoring.md#L590)

- The job's user agent recorded against the four WAF rules.
  [`bot-mitigation.md:58`](../../ops/bot-mitigation.md#L58)

- KV-2 told that a parsed copy of its four rows now exists.
  [`known-violations.md:242`](../../ops/known-violations.md#L242)

- DW-83 assigned and closed; DW-84 to DW-87 filed.
  [`deferred-work.md:1734`](deferred-work.md#L1734)