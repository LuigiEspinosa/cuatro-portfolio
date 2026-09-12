# Scheduled Registry verification, external to the box

The written record of `.github/workflows/registry-verification.yml` and `ops/registry-verification.mjs`,
Story 2.23's job: what it checks per Registry entry and what it deliberately does not, its triggers,
runner, secret and user agent, what "resolves" means, the sources tolerated to answer 404 to an
anonymous reader (KV-2), the procedure when a `live` URL stops resolving (FR-28), who a failed run
mails and when that path was last proven, the SM-4 readings table, the stated limits, the work this
file hands the Operator, and the runs observed.

Written during Story 2.23 on **2026-09-12** (ISO 8601 UTC), against baseline commit `c358109`.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/contract-purity.md`, `ops/monitoring.md` and `ops/contract-adoption.md` set:
every value is marked **Observed** with its method or **Decision** with its reason (NFR-9), and every
date is ISO 8601 UTC.

**This file is held equal to the tree by two readers.** `ops/__tests__/registry-verification.test.ts`
runs under the blocking `test` job and pins every figure the job table below states about the
workflow, parses the two tables this file carries, and holds the Registry's `token_contract` for
`cs-tracker` equal to the version `ops/contract-adoption.md` records. `ops/registry-verification.mjs`
itself parses § Sources tolerated to answer 404 anonymously on every run, so striking a row there is
an edit to this file and to the pins that hold it in `ops/__tests__/registry-verification.test.ts`,
never to the script. The header rows of both tables are therefore part of the contract of this file:
keep them as they are.

**AD-17a was read before this automation was enabled.** `ops/monitoring.md` § AD-17a status reads
`satisfied as of 2026-08-17`, closed by Story 1.3 when AD-26 dissolved the certificate-age
requirement. Cited, not re-derived; this story adds a scheduled job, which is exactly the kind of
automation that line gates, and its row in `ops/monitoring.md` § Which stories read this line now
carries the date it was read.

## What the job checks, and what it deliberately does not

| It checks | It does not check | Nature |
|---|---|---|
| Every `source` **exists**: `GET api.github.com/repos/<owner>/<repo>` with the PAT answers 200 with a `default_branch`. `archived: true` is not a failure; `Lumen` and `tcg-tracker` are archived by design. A github.com URL of any other shape (a `/tree/...` path, a `.git` suffix, a query or a fragment) fails this check by name rather than being skipped; a source off github.com has no authenticated half | What the repository contains, whether it is maintained, or whether its application runs | **Decision.** AD-18 asks "exists"; a renamed repository answers 301 on this call and fails it, which is the Registry naming a stale URL. A 200 without a `default_branch` fails saying so, never blaming the token |
| Every `source` **resolves anonymously**: one GET of the URL itself with no credential, 2xx or 3xx at the first hop. A 404 on a repository named in § Sources tolerated is a tolerated pass; a 404 on any other is a failure (a public repository went private, FR-10). A 2xx on a tolerated row passes and says the row can be struck | The Visitor's browser: the job sends its own user agent from a GitHub-hosted runner, so a Cloudflare rule keyed on either could differ. `ops/bot-mitigation.md` records the agent so a rule edit is a recorded change | **Decision.** Both halves, because anonymous alone is red from the first run on KV-2's four and `ops/monitoring.md` names a permanently red signal as the one failure to avoid, and authenticated alone hides a public repository quietly going private |
| Every `live` **resolves**, wherever the field is present, not only when `status` is `Live` | The `Location` of a redirect, or the body: `tracker.cuatro.dev` 307 to `/login`, `cs-tracker.cuatro.dev` 302 into Steam and `library.cuatro.dev` 302 to `/login` all pass | **Decision.** The schema forbids `live` only on `Archived`, so an entry demoted to `In progress` that kept its URL is caught by this job and by nothing else. What counts as up and what is not asserted follow UptimeRobot; not following the redirect is this job's own decision, § What resolves means |
| Every `token_contract` equals the `Contract vX.Y.Z` header of the adopter's vendored `cuatro-contracts/tokens.css`, read through `repos/<owner>/<repo>/contents/<path>?ref=<default_branch>` with `Accept: application/vnd.github.raw`, at the path `ops/contract-adoption.md` § The adopted versions records for that repository, a leading `./` or `/` stripped and every segment URL-encoded | Who is behind the published version. The comparison is the Satellite's own declaration against the Satellite's own header, and nothing else; the view of who is behind is Story 8.4's | **Decision.** AD-16. Five distinct failures, each by name: the repository unreadable (token or visibility); the path answering 401 or 403 after the repository answered 200 (a permission gap: the PAT lacks Contents read on that repository, or expired mid-run), naming the secret and the repository; the path absent after the repository answered 200 (folder moved or renamed, AD-14); the header absent, or the body cut mid-read; and a version mismatch, both values named. A `token_contract` on an entry whose record row reads `not adopted` fails as "declared but no recorded target" rather than searching the tree, which `ops/contract-adoption.md` § The exact target forbids |
| That the Registry in the **checkout** says all of this | What `https://cuatro.dev/contracts/registry.json` serves: it is 404 until Epic 2 merges, and reading the box defeats the whole-box case AD-18 exists for | **Decision** |

## The job

| Property | Value | Nature |
|---|---|---|
| Blocking | Yes. The job carries no `continue-on-error`, no `\|\| true`, no `if:` and no soft exit, so a check that fails is a red run and a failure mail | **Decision.** AD-18: any failure notifies the Operator. Pinned by standing cases |
| **How far that reach goes** | A red run holds **nothing mechanically**: no merge, no deploy, no edit. The job never commits, opens an issue or writes anything but its own job summary. What it reaches is the Operator's inbox, and the Registry is corrected by hand under § When a live URL stops resolving | **Decision.** A daily bot commit would deploy on every push to `main` (`deploy.yml:3-5`), compile on the two-core box and breach the automation policy's spirit (AD-16) |
| Where it lives | Its own file, `.github/workflows/registry-verification.yml`, never a job in `ci.yml` | **Decision.** `ops/__tests__/contract-purity.test.ts` and `ops/__tests__/registry-schema.test.ts` both pin `ci.yml`'s six-job set and its `on:` block verbatim, and a schedule is a different trigger from a push |
| Triggers | `schedule`, `workflow_dispatch`, and `push` with `paths` limited to the workflow, `ops/registry-verification.mjs`, this file and `contracts/registry.json` | **Decision.** `schedule` fires only from `main`, which lacks the Registry until Epic 2 merges; `push` on the four paths is the pre-merge proof on `dev` and the "confirms it resolves" later stories expect after a Registry edit. `ops/contract-adoption.md` is read by the script and is not a trigger path: an edit there that matters to this job is a re-vendor, which edits the Registry too. Pinned verbatim by a standing case |
| Schedule | `17 6 * * *` UTC, daily | **Decision.** Once a day is the interval AD-18 implies and SM-4's "continuously" tolerates; an off-the-hour minute avoids GitHub's top-of-hour queue. Any other interval is an Ask First of the story |
| Runner | `ubuntu-latest`, Node 22 through `setup-node`, `RUNNER_ENVIRONMENT` asserted equal to `github-hosted` in a step of its own before the script runs | **Decision.** AD-18: external to the VPS, verified by confirming the execution environment rather than assumed from where it was configured. A self-hosted runner registered on the box later fails that step rather than satisfying the rule by accident. The first real run's "Set up job" lines are the observation, § Observed runs |
| Installs | Nothing. No `pnpm/action-setup`, no `pnpm install`, `package-manager-cache: false` | **Decision.** The `contract-purity` shape: the script imports `node:` builtins and two sibling modules only, so the Registry is still verified on a run where an install would have failed |
| Ceiling | `timeout-minutes: 10` | **Decision.** Checkout, `setup-node`, and at most four requests per entry (eight with retries) with a 15 s ceiling each, all fourteen entries in parallel. Pinned by a standing case |
| Command | `node ops/registry-verification.mjs`, no argument | **Decision.** The Registry and both records are resolved beside the module, so no argument can point it at another tree. Pinned as the whole run line |
| Secret | `REGISTRY_VERIFICATION_TOKEN`, a fine-grained PAT with Contents read on `cs-tracker`, `cs-tournament`, `StreamVault` and `Mutuo`, passed as `env:` on the script step only | **Decision.** The four are the private repositories the Registry names (`ops/known-violations.md` KV-2). Absent, the script exits 2 naming the secret and fetches nothing. It is never printed, logged or written: the only environment reads in the module are this name and `GITHUB_STEP_SUMMARY`, and a standing case holds the planted token out of every line and every summary row. Minting it is Pending Operator action 1 |
| User agent | `cuatro-registry-verification/1 (+https://cuatro.dev/contracts/registry.json)` on every request | **Decision.** Named so `ops/bot-mitigation.md` can record it: rule 1 blocks a named list this is not on, rule 3 challenges empty agents, rule 2 skips only `UptimeRobot`. Recorded there under a dated note so a rule edit cannot silently redden the live check |
| Exit codes | 0 every check passed; 1 a check failed; 2 a defect: the secret absent, the Registry or a record unreadable, or the job summary unwritable | **Decision.** `ops/contract-purity.mjs`'s discipline: the verdict is set before anything is written and the exit happens in the write callback, so a pipe cannot truncate the lines or let the process fall off the end at 0 |
| Output | One `PASS  <id> <check>: <detail>` or `FAIL  <id> <check>: <detail>` line per check, `<check>` one of `source exists`, `source resolves`, `live`, `token_contract`, then `# N of M checks passed`; the same rows as a markdown table appended to `$GITHUB_STEP_SUMMARY`. An entry whose checks throw mid-way is one `FAIL <id> entry: threw: <cause>` line, and every other entry keeps its rows. Any control character in an id or a detail is escaped, so a line is always one line and a row one row | **Decision.** The line is `ops/cs-tracker-adoption-probe.mjs`'s shape. The summary is the per-run record; the monthly reading below is the durable one, because run history expires (§ Stated limits) |
| Expected on the Registry as committed | 35 checks: 14 `source exists`, 14 `source resolves` (10 by 2xx, 4 tolerated by KV-2), 6 `live` (3 by 2xx, 3 by 3xx), 1 `token_contract` | **Observed 2026-09-12** on this host: the six repositories by `gh api repos/LuigiEspinosa/<name>` (default branch `main` on all; `cs-tracker`, `cs-tournament`, `StreamVault`, `Mutuo` private; `Lumen`, `tcg-tracker` archived), the anonymous answers by one `fetch` with `redirect: 'manual'` and the user agent above (`github.com/LuigiEspinosa/cs-tracker` 404, `Lumen` 200, `cuatro.dev` 200, `tracker.cuatro.dev` 307, `cs-tracker.cuatro.dev` 302, `library.cuatro.dev` 302, `inclusivcup.vercel.app` 200, `luigiespinosa.github.io/list-wheel/` 200), and the vendored header by the contents call (`Contract v1.0.0`, line 2). The planted-fetcher case in the suite answers the same fourteen entries with these statuses and asserts the 35 |

## What resolves means

**Decision.** One GET of the URL as the Registry carries it, `redirect: 'manual'`, the user agent
above, a 15 s timeout, and one immediate retry on a network error or a 5xx and on nothing else; the
last answer decides. A status of 2xx or 3xx at the first hop **resolves**. A 404 is **absent**.
Anything else, a 429, a timeout and a refused connection included, is **unreachable**. Absent and
unreachable both fail.

**What UptimeRobot is the precedent for, and what it is not.** `ops/monitoring.md` § What is probed,
"Redirects and which responses count as up", records the monitors as `followRedirections: true`
with `successHttpResponseCodes` `2xx` and `3xx` evaluated on the **final** answer, and the `www`
monitor alone not following; `library.cuatro.dev` reads UP there because the followed 302 lands on
a 2xx. So UptimeRobot is the precedent only for two things this job copies: **2xx or 3xx counts as
up**, and **the `Location` is not asserted**. **Not following the redirect is this job's own
decision**, with its own reason: a followed chain couples SM-4 to a third party. `cs-tracker.cuatro.dev`
answers 302 into `steamcommunity.com`, so a run that followed it would read a Steam outage as a
`cuatro.dev` outage, and SM-4 measures the estate's links, not its identity providers'. Following
redirects, a same-origin rule on the final URL, and `HEAD` before `GET` (several hosts answer `HEAD`
differently from `GET`, and the Visitor sends `GET`) are each an Ask First of the story rather than
a default. The cost, a 3xx to a dead target passing, stays a stated limit below.

Three of the six `live` URLs answer 3xx at the first hop today (`tracker.cuatro.dev` 307 to
`/login`, `cs-tracker.cuatro.dev` 302 into Steam, `library.cuatro.dev` 302 to `/login`), all
healthy. **Observed 2026-09-12**, the job table above.

## Sources tolerated to answer 404 anonymously

`ops/known-violations.md` KV-2 records four Registry `source` links that resolve for nobody but the
Operator, tolerated deliberately, with the ruling on each. This table is the copy the script reads:
`kv2Rows` in `ops/registry-verification.mjs` parses it on every run, and an anonymous 404 on a
repository named here, whose Ruling does not begin `Struck` (in any case, behind any bold, italic or
strikethrough markup), is `PASS ... tolerated by KV-2` rather than a failure. The authenticated half
still runs on all four, so a tolerated repository that is deleted or renamed still fails.

| Repository | Ruling | Since |
|---|---|---|
| `LuigiEspinosa/cs-tracker` | Private. Repairable; the Operator's call under `ops/known-violations.md` action 5 | 2026-09-02 |
| `LuigiEspinosa/cs-tournament` | Private. Repairable; the Operator's call under `ops/known-violations.md` action 5 | 2026-09-02 |
| `LuigiEspinosa/StreamVault` | Private by decision, a personal tool never to be published. Excluded from repair, not from the breach | 2026-09-02 |
| `LuigiEspinosa/Mutuo` | Private. Repairable; the Operator's call under `ops/known-violations.md` action 5 | 2026-09-02 |

**Observed 2026-09-12** by `gh api repos/LuigiEspinosa/<name>`: all four read `"private": true`, and
`github.com/LuigiEspinosa/cs-tracker` answered 404 to the anonymous GET above. The `Since` column is
the date KV-2 was opened. **Decision**: the list lives here rather than in the script so that striking
a row is an edit to this file and to the pins that hold it in
`ops/__tests__/registry-verification.test.ts`, never to the script.

**How a row is struck.** When the job reports `its KV-2 row can be struck` (the repository answered
2xx anonymously), or when the Operator rules a repository public, replace the Ruling cell with
`Struck YYYY-MM-DD: <why>` and leave the row in place; the script ignores a struck row and the next
run holds that source to the ordinary rule. The same change moves the suite's pins: it lists the four
repositories with none struck, and its committed-Registry fixture answers 404 for exactly those four.
Never delete a row, and never add a row without a ruling in `ops/known-violations.md` first: this
table tolerates, it does not decide.

## When a live URL stops resolving

**Decision**, FR-28 and AD-18. When the job reports `live` absent or unreachable and the cause is the
application rather than a transient (the next scheduled run, or a `workflow_dispatch`, answers that),
the Registry is corrected in **one change** that does two things: the entry's `status` moves off
`Live` (to `In progress` or `Archived`, whichever is true), and its `live` field is **removed**,
whatever the destination status. The schema enforces the second half only for `Archived`, where
`live` is forbidden; for `In progress` it is this job that catches a `live` left behind, because the
check runs wherever the field is present. The Registry never presents a URL that does not resolve.

The same change edits `contracts/registry.json`, which is one of the four `push` paths, so the run
that follows the push is the confirmation. Record the run URL beside the entry in
`ops/registry-inputs.md`'s expected-state table when it changes, and the monthly reading below picks
the new count up.

When a `source` stops resolving anonymously and is not tolerated, the entry is not demoted: the
repository is either made public again, or ruled private and added to the table above with its KV-2
ruling. When `source exists` fails, the repository is gone or renamed and the `source` URL is
corrected.

## Alert path

| Field | Value | Nature |
|---|---|---|
| What fails | The run, exit 1 on any failed check, exit 2 on a defect | **Decision** |
| Who is mailed | GitHub's own workflow-failure notification. For a `schedule` run it goes to the user who last modified the `cron` syntax in the workflow file; for a `push` or `workflow_dispatch` run, to the actor. Both are the Operator's account today | **Decision.** No second channel: `ops/monitoring.md` § The watcher is itself a single point of failure records the one mailbox and why. The mail goes to the address on the GitHub account, which must keep "Actions" notifications on by email. An edit to the `cron` line by anyone else moves the scheduled-run mail to them |
| Where the table is | The run's job summary, and the log | **Decision.** Both expire, § Stated limits; the monthly reading is the durable copy |
| Alert path last verified | **2026-09-12.** The first `push` run on `dev`, before the secret existed, was the deliberate failure that proves the mail path: run 34721281941 (§ Observed runs) exited 2 naming `REGISTRY_VERIFICATION_TOKEN` at 21:54:50Z, and the Operator confirmed GitHub's failure mail arrived within minutes, at the address on the account, on 2026-09-12 at about 22:00Z. Pending Operator action 3 carries the date | **Observed 2026-09-12**, by the Operator's confirmation in the story's session. `ops/monitoring.md` § Re-testing the alert path: a test that was not recorded did not happen |
| Re-test cadence | Every 3 months, and after any change to the account's notification settings, by deleting the secret, running `workflow_dispatch` (exit 2 naming it) and re-adding the secret, or by the next real failure, whichever comes first | **Decision.** The same cadence the monitoring record sets for its own path. GitHub offers no way to rename or disable a secret, so the deliberate failure is a delete and a re-add |

## Readings

SM-4 targets 100% link resolution continuously; AD-18 asks that the job's result be recorded in a
form the Operator can read historically, not only as a transient notification. One row per month,
taken from a green run's summary or from the last run of the month where none was green. **Links
checked** counts `source resolves` and `live` rows; **Resolved** counts those that passed without a
KV-2 tolerance; **Share** is the second over the first.

The table was created empty on 2026-09-12 with a `_none recorded_` placeholder, so that an absent
reading would be visibly absent; the first row replaced the placeholder the same day, from the
first green run (Pending Operator action 4). A later month's row is added beneath, never beside a
placeholder; the suite holds the two shapes apart.

| Month (ISO 8601) | Links checked | Resolved | Share | Run URL | Taken by |
|---|---|---|---|---|---|
| 2026-09 | 20 | 16 | 80% | [34722748245](https://github.com/LuigiEspinosa/cuatro-portfolio/actions/runs/34722748245) | The story's agent, from the run's log, on 2026-09-12. The four not counted as resolved are KV-2's tolerated 404s (`cs-tracker`, `cs-tournament`, `StreamVault`, `Mutuo`); every `live` resolved |

## Stated limits

| Limit | Why it stands | Nature |
|---|---|---|
| **Run history and job summaries expire at 90 days** | GitHub retains workflow logs and summaries for 90 days in a public repository. The job writes nothing durable: no artifact (7-day retention says nothing durable either), no commit, no issue. The monthly reading above is what survives | **Decision.** The alternative is a bot commit, refused in § The job. Filed as deferred work |
| **A scheduled workflow in a public repository is disabled after 60 days without a push to any branch** | GitHub disables `schedule` triggers after 60 days without repository activity, where a push to any branch, `dev` included, resets the clock, and mails once when it does. An estate that goes quiet on every branch loses this check silently after that mail. The dead-man's switch that would catch it, an UptimeRobot heartbeat monitor pinged after a fully passing run, is an Ask First of the story and is not decided here: the free plan may refuse it as it refused `sslExpirationReminder` | **Decision**, outcome pending: Pending Operator action 5. Filed as deferred work |
| **The fine-grained PAT expires** | A fine-grained token carries an expiry the Operator chooses at minting. After it, every `source exists` check answers 401 at once and every `token_contract` reads unreadable: fourteen exists failures on one run read as an expired or revoked token first, never as fourteen deleted repositories. The date goes in Pending Operator action 1 and the rotation in action 6 | **Decision.** Filed as deferred work |
| **"Who is behind the published version" is not checked** | The `token_contract` comparison holds the Satellite's own declaration to the Satellite's own header. A Satellite pinned at `1.0.0` while the contract is at `1.1.0` passes. That blind spot is designed and is Story 8.4's, `sprint-change-proposal-2026-08-15.md` | **Decision** |
| **A 3xx to a dead target passes** | Redirects are not followed, by this job's own decision under § What resolves means, so a `live` host that redirects somewhere dead reads as resolving. Following them is an Ask First | **Decision** |
| **An anonymous 429 reads as unreachable, and is not retried** | github.com and any `live` host may rate-limit a burst of fourteen parallel requests from one runner. The retry fires on a network error or a 5xx only, so a 429 is the answer on the first request. A red run whose every anonymous check reads 429 is a transient; the next scheduled run, or a `workflow_dispatch`, is the second opinion | **Decision** |
| **The job runs from GitHub's address space with a named agent, not from a Visitor's browser** | Cloudflare's rules see both. Rule 2 skips only `UptimeRobot`; this agent passes rules 1 and 3 today and is recorded in `ops/bot-mitigation.md` so a rule edit is a recorded change | **Observed 2026-09-12**: the four `live` hostnames behind those rules (`cuatro.dev`, `tracker.cuatro.dev`, `cs-tracker.cuatro.dev`, `library.cuatro.dev`) answered 2xx or 3xx to the agent from this host; `inclusivcup.vercel.app` and `luigiespinosa.github.io` are not Cloudflare hostnames and answered 200 on their own terms. The runner's own address is first observed in § Observed runs |
| **It reads the committed Registry on a runner, not what is served** | A file changed at `https://cuatro.dev/contracts/registry.json` on the box without a commit is invisible here, and the served copy is 404 until Epic 2 merges. The same limit `ops/registry-schema.md` records for its gate | **Decision** |
| **The record's adopted-versions table is the only map from an entry to a vendored path** | Story 8.2's second adopter is picked up from its row in `ops/contract-adoption.md` and from nothing else. A row that names the wrong path fails as "moved or renamed", which is the right failure; a `token_contract` added to an entry whose row still reads `not adopted` fails as "no recorded target" | **Decision.** AD-14 fixes the folder name and not its parent |
| **The `push` trigger does not fire on an edit to `ops/contract-adoption.md`** | An edit there that matters to this job is a re-vendor, which also edits `contracts/registry.json` (runbook step 5); an edit that moves only the `File read` cell is caught by the next scheduled run | **Decision** |
| **One immediate retry, then the last answer decides** | A flapping host that answers 503 twice in immediate succession is red; the 15 s figure is the per-request timeout, not a pause between the two. The next scheduled run is the second opinion | **Decision** |

## Pending Operator actions

This file hands the Operator work Story 2.23 may not do, in the shape `ops/monitoring.md` and
`ops/contract-adoption.md` use. None of them is a repository edit an agent can make: minting a token
and adding a secret are console acts, and pushing is the Operator's.

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Mint the fine-grained PAT**: resource owner `LuigiEspinosa`, repository access limited to `cs-tracker`, `cs-tournament`, `StreamVault` and `Mutuo`, permission Contents read-only, and write its expiry date into this cell | Operator | Read-only on four repositories is the least the `token_contract` and authenticated `source exists` checks need. Public repositories answer the authenticated call with any valid token | **2026-09-12.** Fine-grained, the four repositories, Contents read-only, **expires 2026-12-11** (action 6 falls due before then). Minted twice the same day: the first token was pasted onto a command line in the story's session and revoked as exposed; the second replaced it and is the one in the secret |
| 2 | **Add the repository secret `REGISTRY_VERIFICATION_TOKEN`** carrying it, in this repository's Actions secrets | Operator | Byte-exact, as `AGENTS.md` prescribes: `cmd /c "gh secret set REGISTRY_VERIFICATION_TOKEN < token.txt"`, then delete `token.txt`. Never from a PowerShell pipe, which appends CRLF, and `<` is not redirection in PowerShell. Nothing in the repository ever prints it | **2026-09-12T22:25:31Z.** Set by `gh secret set` reading the value over stdin from the gitignored `.env`, no trailing newline, the value printed nowhere; `gh secret list` shows the name and that timestamp |
| 3 | **Confirm the failure mail arrived** from the first `push` run on `dev`, the one before action 2, and date § Alert path "last verified" | Operator | The run exits 2 naming the secret. This is the deliberately induced failure `ops/monitoring.md` asks for, on this path | **2026-09-12.** Run 34721281941 at 21:54:50Z; the mail confirmed by the Operator at about 22:00Z. § Alert path is dated |
| 4 | **Take the first SM-4 reading** from the first green run into § Readings | Operator | 20 links checked, 16 resolved and 4 tolerated is what the Registry as committed should read | **2026-09-12.** Read off run 34722748245: 20, 16, 80%, exactly the expected figures. The row replaced the placeholder |
| 5 | **Rule on the heartbeat**: create an UptimeRobot HEARTBEAT monitor on alert contact 8726805, or record that the free plan refused it | Operator | Ask First of the story. If it lands, the script gains a ping of `$REGISTRY_VERIFICATION_HEARTBEAT_URL` after a fully passing run, the URL is a second secret on the workflow's script step, and the same change moves the suite, which today pins `HEARTBEAT` absent from the workflow and `env:` appearing exactly once; if it does not, the 60-day disable stands as a stated limit with no mitigation, and `ops/monitoring.md` § The watcher is itself a single point of failure carries the outcome | _not done_ |
| 6 | **Rotate the PAT before its expiry**, replace the secret, and re-run by `workflow_dispatch` | Operator | The expiry date is in action 1. An expired token is fourteen `source exists` failures on one run | _not done_ |
| 7 | **Record the observed runs** below: the first `push` run (exit 2), the run after the secret (green), both run URLs, and the "Set up job" runner lines | Operator, with the story's review | Until then § Observed runs says so | **2026-09-12.** Runs 34721281941 (exit 2) and 34722748245 (35 of 35), both with their runner lines, in § Observed runs |

**Maintaining this file.** When an action is performed, replace its `_not done_` cell with the ISO
8601 UTC completion date and leave the row in place. When a source is made public or ruled private,
edit the tolerated table under its own rule above; when a `live` URL stops resolving, follow § When a
live URL stops resolving. Add a reading row each month and never rewrite an earlier one. Keep the
header rows of the tolerated and readings tables as they are: the script parses the first and the
unit suite parses both.

## Observed runs

This section records, for each run that matters to the story: the run URL, the trigger, the exit
code, the "Set up job" lines naming the runner (the AD-18 confirmation that the job ran on a
GitHub-hosted runner), and the check count. The first run, before the secret, was expected to exit 2
with one line naming `REGISTRY_VERIFICATION_TOKEN`; the second, after it, to exit 0 with 35 checks
passed and the table in its job summary.

| # | Run | Trigger | Outcome | Nature |
|---|---|---|---|---|
| 1 | [34721281941](https://github.com/LuigiEspinosa/cuatro-portfolio/actions/runs/34721281941), `dev` at `d91fe09`, 2026-09-12T21:54:50Z | `push`, the commit that added the workflow | Failure, exit 2, one line on stderr: `REGISTRY_VERIFICATION_TOKEN is not set, so nothing was fetched. Add the repository secret (ops/registry-verification.md).` The step before it, `test "$RUNNER_ENVIRONMENT" = github-hosted`, passed. Nothing was fetched | **Observed 2026-09-12** by `gh run view 34721281941 --log`. Set up job: `Current runner version: '2.337.0'`, `Runner Image Provisioner` version `20260828.587`, `Runner Image` `ubuntu-24.04` version `20260907.300.1`, `Included Software: .../ubuntu24/20260907.300/...`. A GitHub-hosted image by name and version, which is AD-18's confirmation; the VPS runs no runner and its address is `177.7.52.248` (`ops/monitoring.md`). This is the deliberate failure of Pending Operator action 3 |
| 2 | [34722748245](https://github.com/LuigiEspinosa/cuatro-portfolio/actions/runs/34722748245), `dev` at `8e80290`, 2026-09-12T22:26:12Z | `push`, the commit that recorded run 1, after the secret was set at 22:25:31Z | Success, exit 0, `# 35 of 35 checks passed`: 14 `source exists` (all `default branch main`, `Lumen` and `tcg-tracker` `archived`), 14 `source resolves` (10 by 200, 4 `answered 404 anonymously, tolerated by KV-2`), 6 `live` (`cuatro.dev` 200, `tracker` 307, `cs-tracker` 302, `library` 302, `inclusivcup.vercel.app` 200, `list-wheel` 200), 1 `token_contract` (`the Registry declares 1.0.0 and LuigiEspinosa/cs-tracker:assets/css/cuatro-contracts/tokens.css@main reads Contract v1.0.0`). The table is in the run's job summary | **Observed 2026-09-12** by `gh run view 34722748245 --log`. Same runner image and version as run 1 (`ubuntu-24.04`, `20260907.300.1`, runner `2.337.0`). The first § Readings row is taken from this run |
