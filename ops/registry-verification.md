# Scheduled Registry verification, external to the box

The written record of `.github/workflows/registry-verification.yml` and `ops/registry-verification.mjs`,
Story 2.23's job: what it checks per Registry entry and what it deliberately does not, its triggers,
runner, secret and user agent, what "resolves" means, the sources tolerated to answer 404 to an
anonymous reader (KV-2), the procedure when a `live` URL stops resolving (FR-28), who a failed run
mails and when that path was last proven, the SM-4 readings table, the stated limits, the work this
file hands the Operator, and the runs observed.

Written during Story 2.23 on **2026-09-12** (ISO 8601 UTC), against baseline commit `c358109`.
**Extended by Story 5.11 on 2026-10-03**, at baseline commit `405f310`: every entry's `demo` and
`identity` declaration is held to what a Visitor meets (§ Demo and identity declarations), and the
release the Operator's live steps unlock is written, unapplied (§ The release the live steps unlock).

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
| Every `source` **exists**: `GET api.github.com/repos/<owner>/<repo>` with the PAT answers 200 with a `default_branch`. `archived: true` is not a failure; `Lumen` and `tcg-tracker` are archived by design. A github.com URL of any other shape (a `.git` suffix, a query or a fragment) fails this check by name rather than being skipped; a source off github.com has no authenticated half. **Widened 2026-09-29 by DW-285** (Operator ruling 2026-09-29): a `https://github.com/<owner>/<repo>/tree/<branch>/<path>` source is accepted too, and exists only when, after the repository answers, `GET repos/<owner>/<repo>/contents/<path>?ref=<branch>` with the PAT also answers 200, so the path is proven on the branch the URL names, not just the repository. A 404 there fails as absent, 401 or 403 names the secret, anything else is unreachable, all inside the one `source exists` row. A branch holding a slash, a `.` or `..` segment, or a `tree` URL with no path stays refused by name. The three absorbed entries of Registry 1.6.0 are the only tree sources | What the repository contains, whether it is maintained, or whether its application runs | **Decision.** AD-18 asks "exists"; a renamed repository answers 301 on this call and fails it, which is the Registry naming a stale URL. A 200 without a `default_branch` fails saying so, never blaming the token |
| Every `source` **resolves anonymously**: one GET of the URL itself with no credential, 2xx or 3xx at the first hop. A 404 on a repository named in § Sources tolerated is a tolerated pass; a 404 on any other is a failure (a public repository went private, FR-10). A 2xx on a tolerated row passes and says the row can be struck | The Visitor's browser: the job sends its own user agent from a GitHub-hosted runner, so a Cloudflare rule keyed on either could differ. `ops/bot-mitigation.md` records the agent so a rule edit is a recorded change | **Decision.** Both halves, because anonymous alone is red from the first run on KV-2's four and `ops/monitoring.md` names a permanently red signal as the one failure to avoid, and authenticated alone hides a public repository quietly going private |
| Every `live` **resolves**, wherever the field is present, not only when `status` is `Live` | The `Location` of a redirect, or the body: `tracker.cuatro.dev` 307 to `/login`, `cs-tracker.cuatro.dev` 302 into Steam and `library.cuatro.dev` 302 to `/login` all pass | **Decision.** The schema forbids `live` only on `Archived`, so an entry demoted to `In progress` that kept its URL is caught by this job and by nothing else. What counts as up and what is not asserted follow UptimeRobot; not following the redirect is this job's own decision, § What resolves means |
| Every `token_contract` equals the `Contract vX.Y.Z` header of the adopter's vendored `cuatro-contracts/tokens.css`, read through `repos/<owner>/<repo>/contents/<path>?ref=<default_branch>` with `Accept: application/vnd.github.raw`, at the path `ops/contract-adoption.md` § The adopted versions records for that repository, a leading `./` or `/` stripped and every segment URL-encoded | Who is behind the published version. The comparison is the Satellite's own declaration against the Satellite's own header, and nothing else; the view of who is behind is Story 8.4's | **Decision.** AD-16. Five distinct failures, each by name: the repository unreadable (token or visibility); the path answering 401 or 403 after the repository answered 200 (a permission gap: the PAT lacks Contents read on that repository, or expired mid-run), naming the secret and the repository; the path absent after the repository answered 200 (folder moved or renamed, AD-14); the header absent, or the body cut mid-read; and a version mismatch, both values named. A `token_contract` on an entry whose record row reads `not adopted` fails as "declared but no recorded target" rather than searching the tree, which `ops/contract-adoption.md` § The exact target forbids |
| Every `demo` declaration against what an anonymous Visitor meets at `live`, reusing the `live` row's answer: `open` answers 2xx, `none` answers 3xx, `not-deployed` carries no `live`, and `demo-account` has its dated observation and an own sign-in page naming `demo@cuatro.dev`. **Added 2026-10-03 by Story 5.11**, § Demo and identity declarations | Whether the demo account signs in today: its working half is a person's dated observation, § Stated limits | **Decision.** FR-27's accuracy half and AD-13: a declaration states only what is observed (NFR-9) |
| Every `identity` declaration: `wallet` is `maicoin`'s recorded structural exemption; `none` is contradicted by `/auth/session` answering 401; `oidc` has its dated observation and answers `/auth/session` 401 and `/auth/sign-in` with an Authorization Code + PKCE redirect to its own callback. **Added 2026-10-03 by Story 5.11** | Which provider issues the session: nothing in the job names one | **Decision.** FR-24's behaviour half, AD-11 and AD-12 |
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
| Ceiling | `timeout-minutes: 10` | **Decision.** Checkout, `setup-node`, and at most four requests per entry (eight with retries) with a 15 s ceiling each, all fourteen entries in parallel (sixteen from Registry 1.5.0, 2026-09-26). Pinned by a standing case. **Amended 2026-10-03 by Story 5.11:** an `oidc` entry adds two requests and a `demo-account` entry at most `MAX_HOPS` (5), so the worst entry makes about eleven, 330 s with every retry spent, still inside the ceiling |
| Command | `node ops/registry-verification.mjs`, no argument | **Decision.** The Registry and both records are resolved beside the module, so no argument can point it at another tree. Pinned as the whole run line |
| Secret | `REGISTRY_VERIFICATION_TOKEN`, a fine-grained PAT with Contents read on `cs-tracker`, `cs-tournament`, `StreamVault` and `Mutuo`, passed as `env:` on the script step only | **Decision.** The four are the private repositories the Registry names (`ops/known-violations.md` KV-2). **Amended 2026-09-25** (KV-2, Operator ruling 2026-09-24): three since `cs-tournament` was published that day; the token still names all four, which costs nothing, since a fine-grained token reads any public repository. Absent, the script exits 2 naming the secret and fetches nothing. It is never printed, logged or written: the only environment reads in the module are this name and `GITHUB_STEP_SUMMARY`, and a standing case holds the planted token out of every line and every summary row. Minting it is Pending Operator action 1 |
| User agent | `cuatro-registry-verification/1 (+https://cuatro.dev/contracts/registry.json)` on every request | **Decision.** Named so `ops/bot-mitigation.md` can record it: rule 1 blocks a named list this is not on, rule 3 challenges empty agents, rule 2 skips only `UptimeRobot`. Recorded there under a dated note so a rule edit cannot silently redden the live check |
| Exit codes | 0 every check passed; 1 a check failed; 2 a defect: the secret absent, the Registry or a record unreadable, or the job summary unwritable | **Decision.** `ops/contract-purity.mjs`'s discipline: the verdict is set before anything is written and the exit happens in the write callback, so a pipe cannot truncate the lines or let the process fall off the end at 0 |
| Output | One `PASS  <id> <check>: <detail>` or `FAIL  <id> <check>: <detail>` line per check, `<check>` one of `source exists`, `source resolves`, `live`, `token_contract`, `demo`, `identity` (the last two from Story 5.11), then `# N of M checks passed`; the same rows as a markdown table appended to `$GITHUB_STEP_SUMMARY`. An entry whose checks throw mid-way is one `FAIL <id> entry: threw: <cause>` line, and every other entry keeps its rows. Any control character in an id or a detail is escaped, so a line is always one line and a row one row | **Decision.** The line is `ops/cs-tracker-adoption-probe.mjs`'s shape. The summary is the per-run record; the monthly reading below is the durable one, because run history expires (§ Stated limits) |
| Expected on the Registry as committed | 41 checks: 16 `source exists`, 16 `source resolves` (13 by 2xx, 3 tolerated by KV-2), 8 `live` (5 by 2xx, 3 by 3xx), 1 `token_contract` | **Observed 2026-09-12** on this host: the six repositories by `gh api repos/LuigiEspinosa/<name>` (default branch `main` on all; `cs-tracker`, `cs-tournament`, `StreamVault`, `Mutuo` private; `Lumen`, `tcg-tracker` archived), the anonymous answers by one `fetch` with `redirect: 'manual'` and the user agent above (`github.com/LuigiEspinosa/cs-tracker` 404, `Lumen` 200, `cuatro.dev` 200, `tracker.cuatro.dev` 307, `cs-tracker.cuatro.dev` 302, `library.cuatro.dev` 302, `inclusivcup.vercel.app` 200, `luigiespinosa.github.io/list-wheel/` 200), and the vendored header by the contents call (`Contract v1.0.0`, line 2). The planted-fetcher case in the suite answers the same fourteen entries with these statuses and asserts the 35. **Corrected 2026-09-13 by Story 2-25**: `list-wheel`'s `live` is `https://wheel.cuatro.dev` from that date, which answered 200 to the user agent above from this host at 17:37Z, through Cloudflare; `luigiespinosa.github.io/list-wheel/` is no longer a Registry `live`. A 200 for a 200, so the count stays 35 and the `live` split stays 3 by 2xx and 3 by 3xx; the planted-fetcher case plants every committed `live` at 200 unless it is in `REDIRECTING`, so the new URL needs no fixture. The push run that confirms it on a runner joins § Observed runs. **Amended 2026-09-25 by KV-2** (Operator ruling 2026-09-24): `cs-tournament` was published that day, so the 14 `source resolves` split 11 by 2xx and 3 tolerated by KV-2 (`cs-tracker`, `StreamVault`, `Mutuo`); the count stays 35, and the planted-fetcher case answers `cs-tournament`'s source 200. **Amended 2026-09-25** (Operator ruling 2026-09-24): the value cell read 35 checks, with the `source resolves` split 10 by 2xx and 4 tolerated, and 6 `live` of which 3 by 2xx. Vercel left the estate, and Registry 1.4.0 made `cs-tournament` `Complete` with no `live`, so `inclusivcup.vercel.app` is no longer checked and the count is 34; the planted-fetcher case asserts the 34. The push run that confirms it on a runner joins § Observed runs. **Amended 2026-09-26** (Operator ruling 2026-09-25): the value cell read 34 checks with 14, 14 (11 by 2xx) and 5 `live` (2 by 2xx). Registry 1.5.0 added `covidmap` and `future-vizion` as `Live`, three checks each, so the count is 40. **Observed 2026-09-26** on this host by `node ops/registry-verification.mjs` with `REGISTRY_VERIFICATION_TOKEN` set from `gh auth token` for the one run and printed nowhere: `# 40 of 40 checks passed`, `covidmap` `default branch master` and `future-vizion` `default branch main` on `source exists`, both sources `answered 200 anonymously`, and both `live` URLs `answered 200` from Vercel. The planted-fetcher case asserts the 40. The push run that confirms it on a runner joins § Observed runs when `dev` is pushed. **Amended 2026-09-29 by DW-285:** Registry 1.6.0 points `cuatro-finance`, `cuatro-tracker` and `cs-tournament` at the Anchor's `tree/main/apps/<dir>`, so the count stays 40 and the splits stay as stated, the Anchor not archived and each tree URL answering 200 anonymously (`curl`, 2026-09-29); the run makes 43 requests, three being the contents calls inside those three `source exists` rows, which the planted-fetcher case asserts. **Amended 2026-09-29 by Story 3-7's placement** (the value cell read 40 checks, with 7 `live` of which 4 by 2xx): Registry 1.7.0 gives `cs-tournament` its `live` again, `https://tournament.cuatro.dev`, so the count is 41, with 8 `live` (5 by 2xx, 3 by 3xx), and the run makes 44 requests; the planted-fetcher case plants the new URL at 200 and asserts the 41. The release reaches `main` only after the URL has answered from off the box (`ops/tournament-placement.md` step 6), and the first run that fetches it joins § Observed runs. **Amended 2026-10-03 by Story 5.11** (the value cell read 41 checks): every entry gains a `demo` and an `identity` row, so the count is **73** (16 `demo`, 16 `identity` beside the 41), and the run makes **52** requests, the eight `live` hosts declaring `identity: none` each asked `/auth/session` once, the `demo` rows reusing the `live` answer. **Observed 2026-10-03T17:13:20Z** on this host by `node ops/registry-verification.mjs` with `REGISTRY_VERIFICATION_TOKEN` set from `gh auth token` for the one run and printed nowhere, on Registry 1.8.0: exit 0, `# 73 of 73 checks passed`. The planted-fetcher case asserts the 73 and the 52 |

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
healthy. **Observed 2026-09-12**, the job table above. **Amended 2026-09-25:** three of five, since
Registry 1.4.0 dropped `inclusivcup.vercel.app` when Vercel left the estate (Operator ruling
2026-09-24).

## Sources tolerated to answer 404 anonymously

`ops/known-violations.md` KV-2 records four Registry `source` links that resolve for nobody but the
Operator, tolerated deliberately, with the ruling on each. This table is the copy the script reads:
`kv2Rows` in `ops/registry-verification.mjs` parses it on every run, and an anonymous 404 on a
repository named here, whose Ruling does not begin `Struck` (in any case, behind any bold, italic or
strikethrough markup), is `PASS ... tolerated by KV-2` rather than a failure. The authenticated half
still runs on all four, so a tolerated repository that is deleted or renamed still fails.

| Repository | Ruling | Since |
|---|---|---|
| `LuigiEspinosa/cs-tracker` | Private by decision, Operator ruling 2026-09-24: kept private because a gitleaks scan of its full history found two hits, its dev and test `secret_key_base` values (committed 2026-05-23); publishing waits on the Operator's own review of them | 2026-09-02 |
| `LuigiEspinosa/cs-tournament` | Struck 2026-09-24: published by Operator ruling 2026-09-24 after a clean gitleaks scan of its full history; it answers 200 anonymously | 2026-09-02 |
| `LuigiEspinosa/StreamVault` | Private by decision, a personal tool never to be published. Excluded from repair, not from the breach | 2026-09-02 |
| `LuigiEspinosa/Mutuo` | Private by decision, Operator ruling 2026-09-24: kept private because a gitleaks scan of its full history found a Twilio API key and a JWT (committed 2021-04-16) and hard-coded test passwords (2021) | 2026-09-02 |

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
that follows the push is the confirmation. ~~Record the run URL beside the entry in
`ops/registry-inputs.md`'s expected-state table when it changes~~ Record the run URL in § Observed
runs below and in the change's story record (**amended 2026-09-24**: `ops/registry-inputs.md` is
frozen by Operator ruling, and `contracts/registry.json` is the only source of Registry values),
and the monthly reading below picks the new count up.

When a `source` stops resolving anonymously and is not tolerated, the entry is not demoted: the
repository is either made public again, or ruled private and added to the table above with its KV-2
ruling. When `source exists` fails, the repository is gone or renamed and the `source` URL is
corrected.

## Demo and identity declarations

**Added 2026-10-03 by Story 5.11** (FR-24 behaviour, FR-27 accuracy, AD-11, AD-12, AD-13). Every entry
gets one `demo` row and one `identity` row, each a **Decision** checked anonymously from the runner with
the job's own user agent and no new secret. Nothing names a provider.

| Declared | Passes when | Fails when |
|---|---|---|
| `demo: open` | `live` answers 2xx at the first hop (the `live` row's answer, not a second request) | no `live`; a 3xx (a Visitor meets a sign-in, or another page); no 2xx or 3xx at all, as "cannot be verified" |
| `demo: none` | `live` answers 3xx: a sign-in stands before the application. The `Location` is printed, not asserted | no `live`; a 2xx, which is `open` and fails as **understated** |
| `demo: not-deployed` | no `live` | a `live` is still carried |
| `demo: demo-account` | its row in `ops/demo-principal.md` (DR1 `cuatro-tracker`, DR2 `cs-tracker`, DR3 `digital-library`) carries a date, **and** the page reached from `live` by at most 5 same-origin redirects answers 2xx naming `demo@cuatro.dev` (FR-25: obtainable from the application's own sign-in surface) | no `live`; no row names the entry; the row undated; a redirect off the host (an issuer's page is not the application's own); more than 5 redirects; a page that does not name the address. Each half fails alone |
| `identity: wallet` | the entry is `maicoin`: **structurally exempt, not unimplemented**, its identity a wallet signature with no user record for an issuer to own (AD-12, FR-24). The row says so, by name | any other entry declaring it; `maicoin` declaring anything else |
| `identity: none` | no `live`, or `<origin>/auth/session` answers anything but 401 | a 401 there: the estate's OIDC session route (Stories 5.3 and 5.4) is serving, so the declaration is **understated**; no answer, as "cannot be verified" |
| `identity: oidc` | its row in `ops/identity-issuer.md` (H3 `cuatro-portfolio`, CT5 `cs-tracker`) carries a date, and, with `live`, `<origin>/auth/session` answers 401 without a session and `<origin>/auth/sign-in` answers 3xx to an `https` URL carrying `response_type=code`, `code_challenge_method=S256`, `code_challenge`, `state`, `client_id` and `redirect_uri` equal to `<origin>/auth/callback` | any one of those, each named. Without `live` the dated row alone decides, below |

**Where the observation map lives.** `OBSERVED_BY` in `ops/registry-verification.mjs` names, per value,
the record row each participant's declaration stands on, and `WALLET_EXEMPT` names the one exemption.
The module reads `ops/identity-issuer.md` and `ops/demo-principal.md` on every run and exits 2 when a
named row is missing or carried twice, so renaming an action breaks the job the day it happens. A row is
dated when its last cell, Completed (UTC), begins with an ISO date behind any bold or italic markup. A
new participant is one change: its record row and its `OBSERVED_BY` line together. Neither record is a
`push` path: dating a row does not run the job, and the release that relies on it edits
`contracts/registry.json`, which does.

**The release valve (FR-28).** An application taken offline when capacity forces it loses its `live` and
leaves `Live` in one change (§ When a live URL stops resolving), and in that same change its `demo`
becomes **`not-deployed`**: `open`, `none` and `demo-account` each need a `live` and fail without one,
so the job refuses a valve change that leaves a Visitor promised something nothing serves. Its
`identity` is left as it was: `none` passes with nothing to probe, and `oidc` stands on its dated row
alone, unprobed (the row says so), since participation is a property of the application and returns
with it. A participant taken offline is also set `off` in `ops/demo-reset.schedule`
(`ops/demo-principal.md` § The scheduler item 5). Bringing it back is the reverse, in one change.

**Today, observed 2026-10-03T17:01Z and 17:13Z** from this host with the job's agent: every `open`
host answered 200 (`cuatro.dev`, `tournament`, `wheel`, `covidmap`, `future-vizion`), every `none` host
3xx (`tracker` 307 to `/login`, `cs-tracker` 302 to `/auth/steam`, `library` 302 to `/login`), and
`/auth/session` answered 404 on six hosts, 307 on `tracker` and 200 on `wheel` (a single-page server
answering any path): no OIDC session route serves anywhere, so no `identity` is understated. Registry
1.7.0's `cs-tournament` `demo: none` failed the new check (`understated: ... answered 200 with no
sign-in`), observed by the same module on that one entry; § The correction below.

### The correction: `cs-tournament` reads `open` (Registry 1.8.0)

**Observed 2026-10-03T17:09:55Z**, anonymously with the job's agent: `https://tournament.cuatro.dev`
answered 200 (title `InclusivCup`), and its viewer pages `/bracket` and `/leaderboards` answered 200
with no redirect. The only sign-in it links is `/auth/steam/login`, a player proving a Steam account to
enroll (DW-332). So a Visitor uses its whole surface without authentication, which is `open`, and
`none` ("deployed, and no demo access is offered") was inaccurate. **Decision:** corrected in Registry
**1.8.0** (a value change, so a minor, `ops/registry-schema.md`). This needs no ruling first: it states
what the host answers now, whichever way DP8 goes. DP8 still decides whether `cs-tournament` becomes a
demo participant (`ops/demo-principal.md`); if it does, the value moves to `demo-account` only through
the release below, once its account works.

### The release the live steps unlock

**Prepared 2026-10-03 by Story 5.11, not applied.** No value below changes until the observation named
beside it is dated, and the job above then proves it on the next run. Each due change is the next minor
of whatever `contract_version` then reads (1.9.0 if all land together on 1.8.0); changes due on the same
day share one minor.

| Order | Entry | Field: from, to | Unlocked by (all dated) | Closes |
|---|---|---|---|---|
| 1 | `cuatro-portfolio` | `identity`: `none`, `oidc` | `ops/identity-issuer.md` H2 and H3 | DW-322 |
| 2 | `cs-tracker` | `identity`: `none`, `oidc` | CT3 and CT5 | DW-323 |
| 3 | `cuatro-tracker` | `demo`: `none`, `demo-account` | `ops/demo-principal.md` DP6, DR1, DS1 to DS3; DW-335 for its sign-in page | |
| 4 | `digital-library` | `demo`: `none`, `demo-account` | DP7 (after DR4 is ruled), DR3, DS1 to DS3; DW-335 | |
| 5 | `cs-tracker` | `demo`: `none`, `demo-account` | order 2 applied, DP5, DR2, DS1 to DS3; DW-335 | |

Rows 3 to 5 may land in any order among themselves; row 5 follows row 2 because `cs-tracker`'s demo
principal signs in through the issuer. **The red window, by design:** from H2 (or CT3) the host answers
`/auth/session` 401, so the scheduled run on `main` fails `identity: understated` until that entry's
release is on `main`. Do H2, H3 and release 1 in one sitting, and CT3, CT5 and release 2 in another.

**By hand, per release, any session, after the Operator's rows are dated:**

1. Read the rows: `grep -nE '^\| (H2|H3|CT3|CT5|DP[5-7]|DR[1-4]|DS[1-3]) \|' ops/identity-issuer.md ops/demo-principal.md`.
   Each row the release names must end in a date. For a `demo-account` row, also check the page:
   `curl -sL --max-redirs 5 -A 'cuatro-registry-verification/1 (+https://cuatro.dev/contracts/registry.json)' <live> | grep -c 'demo@cuatro.dev'`
   prints at least `1`, and `curl -s -o /dev/null -w '%{redirect_url}\n' <live>` names the same host.
2. Edit `contracts/registry.json`: each due value as the table gives it, and `contract_version` to the next minor.
3. Move the pins, in the same commit: `ops/__tests__/registry-schema.test.ts` (the `contract_version` value
   and its comment); `ops/__tests__/registry-verification.test.ts`, the committed-Registry case: for an
   `oidc` entry plant `<live>/auth/session` at 401 and `<live>/auth/sign-in` at a 302 to an authorization
   URL in the shape `authorize()` builds, which adds one request per entry (54 with both); for a
   `demo-account` entry plant each same-origin hop to a page naming the address, one request per hop after
   the first (`tracker` and `library` one each); and the `byDemo` and `oidc` expectations. The row count
   stays 73.
4. Run `corepack pnpm vitest run ops/__tests__/registry-verification.test.ts ops/__tests__/registry-schema.test.ts`,
   then the job itself with `REGISTRY_VERIFICATION_TOKEN` set from `gh auth token` for that one command,
   printed nowhere: `# 73 of 73 checks passed`.
5. Commit with a subject line only, as `feat(registry): release Registry 1.9.0 with <entry> <field> <value>`,
   push, and read the `push` run (`contracts/registry.json` is a trigger path). Record its URL in § Observed
   runs and date this record's action 8 or 9. It reaches `main` by a pull request whose required checks are
   green; the scheduled run on `main` the next morning is the last confirmation.

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

**Accepted 2026-09-24 as the job's history, by Operator ruling (DW-84).** Nothing more durable is
built: no bot commit, no issue comment. Any session takes a month's row from `gh run list
--workflow registry-verification.yml` and the chosen run's summary or log, within 90 days of the
month's end, after which that month's runs are gone. **Observed 2026-09-24** by that command: all twelve
scheduled runs on `main`, from 2026-09-13 to 2026-09-24, concluded `success`, the last being
[35994948290](https://github.com/LuigiEspinosa/cuatro-portfolio/actions/runs/35994948290); the
October row falls due in early November.

| Month (ISO 8601) | Links checked | Resolved | Share | Run URL | Taken by |
|---|---|---|---|---|---|
| 2026-09 | 20 | 16 | 80% | [34722748245](https://github.com/LuigiEspinosa/cuatro-portfolio/actions/runs/34722748245) | The story's agent, from the run's log, on 2026-09-12. The four not counted as resolved are KV-2's tolerated 404s (`cs-tracker`, `cs-tournament`, `StreamVault`, `Mutuo`); every `live` resolved |

## Stated limits

| Limit | Why it stands | Nature |
|---|---|---|
| **Run history and job summaries expire at 90 days** | GitHub retains workflow logs and summaries for 90 days in a public repository. The job writes nothing durable: no artifact (7-day retention says nothing durable either), no commit, no issue. The monthly reading above is what survives | **Decision.** The alternative is a bot commit, refused in § The job. Filed as deferred work. **Accepted 2026-09-24** by Operator ruling: the monthly reading is the job's history, taken by any session from `gh run list` within 90 days of the month's end (§ Readings), and DW-84 is closed |
| **A scheduled workflow in a public repository is disabled after 60 days without a push to any branch** | GitHub disables `schedule` triggers after 60 days without repository activity, where a push to any branch, `dev` included, resets the clock, and mails once when it does. An estate that goes quiet on every branch loses this check silently after that mail. The dead-man's switch that would catch it, an UptimeRobot heartbeat monitor pinged after a fully passing run, was an Ask First of the story; the Operator said yes on 2026-09-12 and **the free plan refused the monitor type** | **Observed 2026-09-12** through the UptimeRobot MCP: `create-monitor` with `type: HEARTBEAT` answered `You are not allowed to use some settings with your current plan` three times, with a full configuration (daily interval, 24 h grace, contact 8726805), with the contact only, and with the bare type; `list-monitors` confirms nothing was created. The same refusal shape as `sslExpirationReminder` (`ops/monitoring.md`). So no ping is wired, the suite keeps pinning `HEARTBEAT` absent from the workflow, and the fallback is a `workflow_dispatch` run on AD-22's refresh schedule, which re-enables a disabled schedule. Pending Operator action 5 is dated with the refusal; DW-85 stays open naming the fallback. **Mitigated 2026-09-24** by Operator ruling: AD-22's fixed refresh scope now names dispatching `registry-verification.yml` and confirming it green, so the fallback is a step of every refresh check rather than a practice, and DW-85 is closed as mitigated. A quiet spell can still leave the schedule off until the next check, with GitHub's one mail as the only notice |
| **The fine-grained PAT expires** | A fine-grained token carries an expiry the Operator chooses at minting. After it, every `source exists` check answers 401 at once and every `token_contract` reads unreadable: fourteen exists failures on one run read as an expired or revoked token first, never as fourteen deleted repositories. The date goes in Pending Operator action 1 and the rotation in action 6 | **Decision.** Filed as deferred work |
| **"Who is behind the published version" is not checked** | The `token_contract` comparison holds the Satellite's own declaration to the Satellite's own header. A Satellite pinned at `1.0.0` while the contract is at `1.1.0` passes. That blind spot is designed and is Story 8.4's, `sprint-change-proposal-2026-08-15.md` | **Decision** |
| **A 3xx to a dead target passes** | Redirects are not followed, by this job's own decision under § What resolves means, so a `live` host that redirects somewhere dead reads as resolving. Following them is an Ask First | **Decision** |
| **An anonymous 429 reads as unreachable, and is not retried** | github.com and any `live` host may rate-limit a burst of fourteen parallel requests from one runner. The retry fires on a network error or a 5xx only, so a 429 is the answer on the first request. A red run whose every anonymous check reads 429 is a transient; the next scheduled run, or a `workflow_dispatch`, is the second opinion | **Decision** |
| **The job runs from GitHub's address space with a named agent, not from a Visitor's browser** | Cloudflare's rules see both. Rule 2 skips only `UptimeRobot`; this agent passes rules 1 and 3 today and is recorded in `ops/bot-mitigation.md` so a rule edit is a recorded change | **Observed 2026-09-12**: the four `live` hostnames behind those rules (`cuatro.dev`, `tracker.cuatro.dev`, `cs-tracker.cuatro.dev`, `library.cuatro.dev`) answered 2xx or 3xx to the agent from this host; `inclusivcup.vercel.app` and `luigiespinosa.github.io` are not Cloudflare hostnames and answered 200 on their own terms. The runner's own address is first observed in § Observed runs. **Corrected 2026-09-13 by Story 2-25**: five `live` hostnames sit behind the rules now, `wheel.cuatro.dev` having been added to rules 1 and 3 at 17:31:31Z, before its DNS record existed; the agent answered 200 there from this host at 17:37Z (`ops/bot-mitigation.md` carries the dated table). `inclusivcup.vercel.app` is the one non-Cloudflare `live` left, and `luigiespinosa.github.io` is no longer a Registry `live`. **Amended 2026-09-25** (Operator ruling 2026-09-24): none is left. Registry 1.4.0 dropped `inclusivcup.vercel.app` when Vercel left the estate, so every `live` hostname the job checks sits behind the rules |
| **It reads the committed Registry on a runner, not what is served** | A file changed at `https://cuatro.dev/contracts/registry.json` on the box without a commit is invisible here, and the served copy is 404 until Epic 2 merges. The same limit `ops/registry-schema.md` records for its gate | **Decision** |
| **The record's adopted-versions table is the only map from an entry to a vendored path** | Story 8.2's second adopter is picked up from its row in `ops/contract-adoption.md` and from nothing else. A row that names the wrong path fails as "moved or renamed", which is the right failure; a `token_contract` added to an entry whose row still reads `not adopted` fails as "no recorded target" | **Decision.** AD-14 fixes the folder name and not its parent |
| **The `push` trigger does not fire on an edit to `ops/contract-adoption.md`** | An edit there that matters to this job is a re-vendor, which also edits `contracts/registry.json` (runbook step 5); an edit that moves only the `File read` cell is caught by the next scheduled run | **Decision** |
| **The demo account is not signed in by the job** (Story 5.11) | `demo-account`'s working half is a person's dated observation (DR1 to DR3), and its live half is the application's own page naming `demo@cuatro.dev`. A sign-in that breaks after the observation, while the page still names the address, passes until someone notices. Signing in daily would need the demo password as a workflow secret and a sign-in script per application, and `cs-tracker`'s demo signs in at the issuer, which a provider-neutral job cannot drive | **Decision.** Needs a secret the workflow does not hold, so it is the Operator's ruling, Pending Operator action 11 (DW-336) |
| **`open` and `none` read the first hop only** (Story 5.11) | A host whose `live` URL redirects within itself before the application (`/` to `/en`) reads as a sign-in, so `open` fails and `none` passes. The `live` URL is the one a Visitor lands on, so it should be the page itself; a `none` 3xx to a page that is not a sign-in also passes | **Decision.** The `live` row's own rule, § What resolves means |
| **`identity: none` sees the estate's session route only** (Story 5.11) | It reads `/auth/session`, the path Stories 5.3 and 5.4 built; an application that federated at another path would not be seen. A new participant follows the estate's routes or adds its own row here | **Decision** |
| **One immediate retry, then the last answer decides** | A flapping host that answers 503 twice in immediate succession is red; the 15 s figure is the per-request timeout, not a pause between the two. The next scheduled run is the second opinion | **Decision** |

## Pending Operator actions

This file hands the Operator work Story 2.23 may not do, in the shape `ops/monitoring.md` and
`ops/contract-adoption.md` use. None of them is a repository edit an agent can make: minting a token
and adding a secret are console acts, and pushing is the Operator's. **Amended 2026-10-03 by Story
5.11:** actions 8 and 9 end in a Registry edit any session makes, but only once the Operator's own rows
are dated, which no agent can do.

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Mint the fine-grained PAT**: resource owner `LuigiEspinosa`, repository access limited to `cs-tracker`, `cs-tournament`, `StreamVault` and `Mutuo`, permission Contents read-only, and write its expiry date into this cell | Operator | Read-only on four repositories is the least the `token_contract` and authenticated `source exists` checks need. Public repositories answer the authenticated call with any valid token | **2026-09-12.** Fine-grained, the four repositories, Contents read-only, **expires 2026-12-11** (action 6 falls due before then). Minted twice the same day: the first token was pasted onto a command line in the story's session and revoked as exposed; the second replaced it and is the one in the secret |
| 2 | **Add the repository secret `REGISTRY_VERIFICATION_TOKEN`** carrying it, in this repository's Actions secrets | Operator | Byte-exact, as `AGENTS.md` prescribes: `cmd /c "gh secret set REGISTRY_VERIFICATION_TOKEN < token.txt"`, then delete `token.txt`. Never from a PowerShell pipe, which appends CRLF, and `<` is not redirection in PowerShell. Nothing in the repository ever prints it | **2026-09-12T22:25:31Z.** Set by `gh secret set` reading the value over stdin from the gitignored `.env`, no trailing newline, the value printed nowhere; `gh secret list` shows the name and that timestamp |
| 3 | **Confirm the failure mail arrived** from the first `push` run on `dev`, the one before action 2, and date § Alert path "last verified" | Operator | The run exits 2 naming the secret. This is the deliberately induced failure `ops/monitoring.md` asks for, on this path | **2026-09-12.** Run 34721281941 at 21:54:50Z; the mail confirmed by the Operator at about 22:00Z. § Alert path is dated |
| 4 | **Take the first SM-4 reading** from the first green run into § Readings | Operator | 20 links checked, 16 resolved and 4 tolerated is what the Registry as committed should read | **2026-09-12.** Read off run 34722748245: 20, 16, 80%, exactly the expected figures. The row replaced the placeholder |
| 5 | **Rule on the heartbeat**: create an UptimeRobot HEARTBEAT monitor on alert contact 8726805, or record that the free plan refused it | Operator | Ask First of the story. If it lands, the script gains a ping of `$REGISTRY_VERIFICATION_HEARTBEAT_URL` after a fully passing run, the URL is a second secret on the workflow's script step, and the same change moves the suite, which today pins `HEARTBEAT` absent from the workflow and `env:` appearing exactly once; if it does not, the 60-day disable stands as a stated limit with no mitigation, and `ops/monitoring.md` § The watcher is itself a single point of failure carries the outcome | **2026-09-12.** Ruled yes by the Operator; **refused by the free plan** on three `create-monitor` attempts (§ Stated limits has the error text and the shapes tried). Nothing created, nothing wired; the fallback is the `workflow_dispatch` run on AD-22's refresh schedule. Recorded in `ops/monitoring.md` beneath the reopened note. AD-22's fixed scope names that dispatch from 2026-09-24, by Operator ruling (DW-85) |
| 6 | **Rotate the PAT before its expiry**, replace the secret, and re-run by `workflow_dispatch` | Operator | The expiry date is in action 1. An expired token is fourteen `source exists` failures on one run | _not done_ |
| 7 | **Record the observed runs** below: the first `push` run (exit 2), the run after the secret (green), both run URLs, and the "Set up job" runner lines | Operator, with the story's review | Until then § Observed runs says so | **2026-09-12.** Runs 34721281941 (exit 2) and 34722748245 (35 of 35), both with their runner lines, in § Observed runs |
| 8 | **Apply the identity release** (§ The release the live steps unlock, orders 1 and 2) | Operator dates H2, H3, CT3 and CT5; then any session makes the edit | Story 5.11. Order 1 in the sitting that does H2 and H3, order 2 in the one that does CT3 and CT5, so the red window stays inside a sitting | _not done_ |
| 9 | **Apply the demo release** (orders 3 to 5), each participant when its rows are dated and DW-335 has given its own sign-in page the demo address | Operator dates DP5 to DP7, DR1 to DR3, DS1 to DS3 and rules DR4; then any session | Story 5.11 | _not done_ |
| 10 | **Read the extended job green on a runner**: the `push` run of the commit that adds Story 5.11's checks, and the first scheduled run on `main` after Epic 5 merges, each `# 73 of 73 checks passed`; record both in § Observed runs | Operator, or the session that pushes | Story 5.11 ran it on this host only | _not done_ |
| 11 | **Rule on a daily demo sign-in** (DW-336). Options: (a) accept the stated limit, the dated observation plus the page; (b) add the demo password as a second secret on the script step and a sign-in probe for `cuatro-tracker` and `digital-library`, whose sign-ins are their own, leaving `cs-tracker` on its observation; (c) as (b), with a browser-driven sign-in at the issuer for `cs-tracker` | Operator | **Recommendation: (a)** until the demo release lands, then (b): the password is published on the page by FR-25 anyway, the two probes are small, and (c) puts provider-specific steps in the job, which AD-11's seam exists to avoid. (b) moves the suite's pin that `env:` appears once | _not done_ |

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
| 3 | [34773443302](https://github.com/LuigiEspinosa/cuatro-portfolio/actions/runs/34773443302), `2-25-relocate-list-wheel` at `8a68f59`, 2026-09-13T18:03:25Z | `push`, the commit that moved `list-wheel`'s `live` to `https://wheel.cuatro.dev` (Story 2-25), on a branch: the `push` trigger carries no branch filter, so the live check ran before any merge | Success, exit 0, `# 35 of 35 checks passed`: the same split as run 2 except the sixth `live` row, `PASS  list-wheel live: https://wheel.cuatro.dev answered 200`; the other five `live` codes unchanged (200, 307, 302, 302, 200) | **Observed 2026-09-13** by `gh run view 34773443302 --log`. Runner `2.337.0`, image `ubuntu-24.04` from `ubuntu24/20260907.300`. This is the confirmation § When a live URL stops resolving asks for after a `live` edit, and the first run that saw a `cuatro.dev` hostname added by a story rather than inherited |
| 4 | [36690453047](https://github.com/LuigiEspinosa/cuatro-portfolio/actions/runs/36690453047), `main` at `373e33d`, 2026-09-30T08:33:35Z | `workflow_dispatch` by `gh workflow run registry-verification.yml --ref main`, the dispatch AD-22 names, run for the Epic 4 refresh (Story 4-1, `ops/settled-inputs-refresh.md`) | Success, `# 41 of 41 checks passed`, completed 08:33:55Z; the eight `live` rows `cuatro.dev` 200, `tracker` 307, `cs-tracker` 302, `library` 302, `tournament` 200, `wheel` 200, `covidmap` 200, `future-vizion` 200; `cs-tracker token_contract` reads `Contract v2.0.0` against the Registry's 2.0.0; the workflow's `state` reads `active` afterwards | **Observed 2026-09-30** by `gh run view 36690453047 --log` and `gh api .../actions/workflows/registry-verification.yml`. Runner `2.337.0`, image `ubuntu-24.04`, and the `RUNNER_ENVIRONMENT` step ran |
