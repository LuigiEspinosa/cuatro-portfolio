---
title: 'Story 4-10: Migrate cs-tracker.cuatro.dev'
type: 'feature'
created: '2026-09-30'
status: 'done'
baseline_commit: '65e762f900ef6c83a38a4cc47c6e8f7afe4360aa'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/ops/postgres.md'
  - '{project-root}/ops/traefik-cutover.md'
  - '{project-root}/ops/tracker-cutover.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** `cs-tracker.cuatro.dev` is served by `cs-tracker-app-1` from database `cs_tracker_prod` in `cs-tracker-db-1` (`postgres:16`, role `postgres`, never backed up), which the estate Postgres 18.6 replaces (AD-10), and it reaches the app through Caddy. The project's compose runs `migrate` as a dependency of every `app` start, so no rollout can happen without a migration riding on it (AD-23).

**Approach:** Write `ops/cs-tracker-cutover.md`: the cs-tracker compose change (the `migrate` one-shot moved under a profile and off `app`'s `depends_on`, `app` and `migrate` joined to `estate-postgres`) as an exact diff for the Operator to land in `LuigiEspinosa/cs-tracker`; then, on the box, a dump of `cs_tracker_prod` restored into `cs_tracker` with counts compared, `DATABASE_URL` and `POOL_SIZE=10` in `/home/deploy/cs-tracker/.env`, the migration as its own step, `docker rollout` of `app`, the verification, the Origin Rule, and rollbacks for both. Prove it locally in Docker first, with the real image built at the box's sha.

## Boundaries & Constraints

**Always:** `cs-tracker-db-1`, its volume `cs-tracker_pgdata` and every dump stay untouched and kept until Story 4.11; the subdomain serves throughout (a rollout, not a restart); counts compared before the switch and again after it; a load reading at each box step; passwords copied on the box without printing; placeholders only in the repository; every proof claim quotes real output; Caddy (`cs-tracker-caddy-1`) stays up in the `cs-tracker` project, because it still serves every hostname that has not moved.

**Never:** write to the box, the Cloudflare zone or another repository in this run; `docker compose up -d` or `down` of the whole `cs-tracker` project during the move (it would recreate or stop Caddy); drop, truncate or `down -v` any store; a migration on the server's start; a Traefik change unless the committed `cs-tracker` router is wrong; the image-on-box build (AD-8) or the missing security headers, which are not this story's.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Restore | Postgres 16 dump of `cs_tracker_prod` into 18.6 `cs_tracker` as `cs_tracker` | `pg_restore` exit 0; `pg_trgm` created by the owner; counts of every non-Oban table match | a mismatch stops the runbook before the `.env` edit |
| Oban tables | the running app inserts a job every few minutes | `oban_jobs` and `oban_peers` are left out of the comparison, and said so | a user table that moved stops the runbook |
| Migrate | `docker compose run --rm migrate` against `cs_tracker` | "Migrations already up", exit 0 | anything else: rollback before the roll |
| Rollout | `docker rollout -w 20 app` under a request loop | every request answers 302 `/auth/steam`; `cs_tracker` holds 11 connections (pool 10 plus Oban's notifier) | a failed rollout leaves the old container serving |
| Hostname | Origin Rule to 8443 | 302 with no `via: 1.1 Caddy`; LiveView socket 101 | R1 deletes the rule |

</frozen-after-approval>

## Code Map

- `ops/traefik/dynamic/routes.yml`: router `cs-tracker`, `Host(cs-tracker.cuatro.dev)`, no middleware, service `http://app:4000`; equal to Caddy's `{$PHX_HOST}` block (`ops/routing-inventory.md` § The site blocks). No change expected; `ops/__tests__/traefik-config.test.ts` already holds it.
- `ops/postgres.md` § The budget (`cs_tracker` 25, `POOL_SIZE=10`), § Migration discipline (item 3 names this story), § Moving a consumer (row 4.10, generic steps). Takes a dated pointer line, as 4-8 did.
- `ops/postgres/compose.yml`, `ops/postgres/init/10-consumers.sh`: the estate instance, used as is in the local proof.
- `ops/traefik-cutover.md` § Moving cuatro.dev and www: the `CF` helper, the ruleset guard, the `via: 1.1 Caddy` sign. `ops/tracker-cutover.md` § Moving the database onto the estate Postgres: the runbook shape to mirror.
- `ops/monitoring.md:49`: monitor 803750016 on `cs-tracker.cuatro.dev`, status code.
- `ops/cs-tracker-adoption-probe.mjs`: reads the local checkout at `../cs-tracker-workspace/cs-tracker`, not the live host; `ops/cs-tracker-token-adoption.md` holds its re-run table.
- `LuigiEspinosa/cs-tracker` at `2519fe3` (main, equal to the box checkout, compose md5 `5884e219...` on both): `docker-compose.yml` (`app` `depends_on` `migrate`; `migrate` `depends_on` `db`), `config/runtime.exs:208` (`POOL_SIZE`, default 10), `lib/cs_tracker/release.ex` (`Ecto.Migrator.with_repo`), `rel/overlays/bin/server` (no migration), `config/config.exs` (Oban cron: catalog sync 03:00 UTC, price refresh scheduler every N minutes).
- Box, read 2026-09-30T18:05Z read-only: Postgres 16.14, 37 MB, `pg_trgm` 1.6, 10 migrations (last `20260622181145`), role `postgres` only; counts `items 1974`, `price_snapshots 21119` (last 2026-08-27), `inventory_entries 113`, `oban_jobs 30002` (last insert that minute), 12 connections; `.env` has no `POOL_SIZE`; `docker rollout` v0.14 installed; load 0.12; no cron backs up this database.
- Ledger: DW-301 (backup before move, open for 4.10).

## Tasks & Acceptance

**Execution:**
- [x] Local Docker proof (scratchpad, throwaway values, removed afterwards), quoted in the runbook.
- [x] `ops/cs-tracker-cutover.md`: new record: what serves today, what the move changes, the cs-tracker diff, the rehearsal, the sequence, rollbacks, Pending Operator actions.
- [x] `ops/traefik/dynamic/routes.yml` and `ops/__tests__/traefik-config.test.ts`: the `forwarded-proto-https` middleware on the `cs-tracker` router, found by the proof (Implementation Notes), with its case.
- [x] `ops/postgres.md`: one dated line in § Moving a consumer pointing at it.
- [x] `ops/cs-tracker-token-adoption.md`: the probe's 2026-09-30 re-run row.
- [x] `deferred-work.md`: DW-301 dated note; DW-309 new (the header on other routers).
- [x] `sprint-status.yaml`: 4-10 `awaiting-operator` with a dated comment.

**Acceptance Criteria:**
- Given a Postgres 16 `cs_tracker_prod` migrated and served by the real image at `2519fe3`, when it is dumped and restored into the estate 18.6 `cs_tracker`, then the restore exits 0 and the non-Oban counts match.
- Given the patched compose and the new `.env`, when `migrate` runs and `docker rollout` moves `app` under a request loop through Traefik, then the migration applies nothing, every request answers 302, and the role holds at most 25 connections.
- Given the rollback `.env` copy, when `app` rolls back, then it serves from the old database and every request still answers 302.
- Given the runbook, when read end to end, then no step deletes, drops or overwrites the old database, its volume or a dump, and each rollback names its exact command.

## Implementation Notes

- Implemented inline (no subagent tool in this run). Files: `ops/cs-tracker-cutover.md` (new), `ops/traefik/dynamic/routes.yml`, `ops/__tests__/traefik-config.test.ts`, `ops/postgres.md`, `ops/cs-tracker-token-adoption.md`, `deferred-work.md`, `sprint-status.yaml`, this spec. Nothing under `apps/` or `docker-compose.yml`: `cs-tracker` is not a service of this repository.
- **Found by the proof, fixed:** through the committed `cs-tracker` router the LiveView socket answered `301 Location: https://cs-tracker.cuatro.dev/live/websocket?vsn=2.0.0`: Traefik forwards an upgrade as `X-Forwarded-Proto: wss`, and `cs-tracker`'s Plug.SSL (`rewrite_on: [:x_forwarded_proto]`) takes only `https`. A headers middleware setting `https` on that router alone gives `101`; a forged `X-Forwarded-Proto: http` from the client still answered `302` (Traefik drops untrusted forwarded headers). The Traefik suite's new case fails against the baseline file (1 failed, 23 passed) and passes with it (24). Other routers not examined for the same: DW-309. Docker Desktop's bind mount did not deliver the file change to Traefik's watcher; a restart loaded it (the box, on Linux, relies on the watch, as Story 4-2 recorded).
- The cs-tracker diff's Services comment was rewritten after the rehearsal to drop the em-dashes its format carried into added lines; only comment lines differ from the rehearsed file (checked by diff). The patch applies to `2519fe3` with `git apply`, and the record's diff block is byte-identical to the checked patch (sha256 `58cadec9...`).
- Where the pool is set: `POOL_SIZE` in `/home/deploy/cs-tracker/.env`, read by `config/runtime.exs:208` in `cs-tracker`; absent on the box today (default 10), written explicitly by step 7. Measured 11 connections per app container (pool plus Oban's notifier), locally and on the box (12 with the reading's `psql`).
- The adoption probe reads the local checkout, not the live host (it takes no argument); run 2026-09-30T18:09:47Z, exit 0, 19 PASS, against the box's commit. The live stylesheet was read separately (12 roles, sha256 `1fa1740f...`).
- A box read attempted to pass a heredoc to `psql` without `docker exec -i` and printed nothing; re-run with `-i`. All box reads were read-only (`docker ps`, `docker inspect`, `git log`/`status`, `md5sum`, `.env` variable names only, `psql` selects, `crontab -l`, `docker rollout --help`).
- Local cleanup verified: no container, volume or network of the rehearsal remains; `cs-tracker:p410` and the pulled `postgres:16` removed; throwaway env files and dumps deleted from the scratchpad.

## Spec Change Log

- 2026-10-01: box half ran from 00:06Z to 02:16Z (runbook `ops/cs-tracker-cutover.md` § The sequence, steps 1 to 13), recorded in that file's § Move run, 2026-10-01; status `done`. Pending action 2 landed the patch on `cs-tracker` `main` as `ca75686` on the Operator's explicit go; the app moved onto `cs_tracker` at 00:36Z and the hostname onto Traefik at 00:56:08Z (rule `86b7df5f45ea4c998398cc724000196d`). Pending Operator action 1 stays open. DW-310 closed.

## Review Triage Log

Pass 1, 2026-09-30, all six layers run inline by this session (no subagent tool in this run), against the diff from `65e762f` with the untracked files (57 kB; blind floor N = floor(sqrt(57.4) + 1) = 8).

| # | Layer | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | blind | § What the move changes put the worst case at 24 of 25 by adding the migrator to an overlap it never joins, and said the Operator's `psql` does not count, while the runbook's `NEWQ` connects as `cs_tracker` | low | The migrator runs before the roll, beside one container (13); `NEWQ` is `psql -U cs_tracker` and counts | patch: the paragraph restated, 23 at the worst |
| 2 | blind | Pending action 2 said "save the diff above": copied from a CRLF checkout or a rendered page, the patch may not apply | medium | The working copy is CRLF under `core.autocrlf`; `git apply` of CRLF hunks onto LF files is not assured | patch: an `awk` extraction that strips CR, checked on an LF and a CRLF copy to the same sha256, which the action now checks |
| 3 | blind | The probe note said the Hub was built at `65e762f`; the run read build output already in the tree | low | No Hub build ran before the 18:09Z probe in this session | patch: wording |
| 4 | edge-case | "Pulled before the move, it is also safe on its own" ignores the network: before `ops/postgres.md`'s placement a compose command creating `app` refuses | low | Seen in the rehearsal's first attempt: `network estate-postgres declared as external, but could not be found` | patch: the paragraph states it; step 2 already follows the placement |
| 5 | edge-case | Step 7 named only the `0` outcome; two `DATABASE_URL` lines would print `2` with no instruction | low | `awk` rewrites every such line, and the expected output is `1` | patch: "Anything else" restores and stops |
| 6 | blind | The router's middleware is held by a source-text case only; the socket's `101` is proven by the rehearsal, not by CI | low | `ops/__tests__/traefik-config.test.ts` reads files as text by design (no Traefik runs in CI, Story 4-2); the case fails on the baseline file (1 failed, 23 passed) | reject: a runtime Traefik in CI is new machinery for a one-line router setting the rehearsal quoted |
| 7 | blind | The request loop watches `/` only, not the socket, through the roll | low | Step 10 and step 11 check the socket after each change; LiveView reconnects on its own when the old container stops | reject |
| 8 | blind | The sprint-status comment runs eight lines | low | Neighbouring 4-8 and 4-9 comments run six and seven; the board's convention is a dated summary | reject |
| 9 | blind | Pending action 2 pushes straight to `cs-tracker`'s `main` | false | That repository has no CI (DW-14), its history is the Operator's, and the push is the Operator's act, never this run's | reject |
| 10 | blind | DW-309's owner, Story 4.11, comes after other hostnames move, so a socket failure could ship first | low | Its trigger includes any moved hostname's application reporting a failed socket; no other rehearsal record mentions a socket (searched `ops/*.md` for websocket and upgrade) | reject: carried by DW-309's trigger |
| 11 | edge-case | `-w 20` stops the old container before a slow-booting new one listens | low | The release served about 3 s after start in the rehearsal; step 3's loop would show any gap, and R2 is one command | reject |
| 12 | edge-case | Shell variables and functions (`DUMP`, `OLDQ`) vanish if the session drops mid-run | low | The same shape as `ops/tracker-cutover.md`; step 4 prints the dump's name and step 13 records it | reject |
| 13 | verification-gap | The `forwarded-proto-https` behaviour has only a source-text assertion, which the layer's rules do not count; disposition defer, since CI runs no Traefik | low | Same fact as row 6 | reject, as row 6 |
| 14 | ponytail | Lean already. Ship. (The owners and extension checks of step 6 were weighed: a restore owned by anyone but `cs_tracker` would fail its next migration, so they stay.) | n/a | | none |
| 15 | ecc-verification-loop | Build PASS, types PASS, tests PASS (75 files, 1842 passed, 1 skipped), lint N/A (no lint command, AGENTS.md), no secret in the diff (added hex strings are shas and digests only) | n/a | Outputs under Verification | none |
| 16 | design | No UI surface in this diff. Design review skipped. | n/a | No `.scss`/`.tsx` outside tests, no motion term in added lines | none |

## Design Notes

**Spec size.** The spec measured about 1,760 tokens at step 2's check (1,323 words at 1.33 tokens a word), over the SCOPE STANDARD's 1,600. The Operator's instruction of 2026-09-30, relayed by the orchestrator for this named spec: **Keep**. The story is one deploy unit's database and hostname move; a split would separate the compose change from the proof and the runbook that first run it.

Decisions, each one the Operator may overrule (Pending action 1 in `ops/cs-tracker-cutover.md`):

1. **No freeze; the Oban tables are left out of the count.** The app is its own writer (Oban's cron inserts a job every few minutes; `price_snapshots` last took a row 2026-08-27), so stopping writers means stopping the site, against NFR-2. Every other table is counted before the switch and again after it (`old-unchanged`); a user table that moved stops the runbook. Queue history left in the old store is not data anyone reads. The window avoids 02:45 to 03:15 UTC, the daily catalog sync.
2. **The migration becomes discrete in cs-tracker's compose**, not by a flag: nothing in the release migrates on start (`bin/server`), but compose runs `migrate` on every `app` start through `depends_on`, and `docker rollout` would start it too. The `migrate` profile and the removed `depends_on` make `docker compose run --rm migrate` the only way it runs.
3. **`POOL_SIZE=10` written into `.env`**, the value `ops/postgres.md` § The budget states. Measured in the rehearsal: 11 connections per app container, the pool plus Oban's notifier; across a rollout's overlap only the new container reaches the estate. The migrator (pool of 2) runs before a later rollout's two-container overlap, not during it, so the worst case is 22 plus one `psql -U cs_tracker`, 23 of 25 (`ops/cs-tracker-cutover.md` § What the move changes).
4. **Rollback copy of `.env` outside the checkout**, `/home/deploy/pg-move/cs-tracker.env.pre-4-10`, mode kept, so git never sees a file holding the old password.
5. **Data first, under Caddy; the Origin Rule second**, each verified and rolled back on its own, as 4-8.
6. **The dump the move restores is also the old store's first backup**; it is kept until Story 4.11, and the estate nightly (Story 4-5) covers `cs_tracker` from its first night (DW-301).
7. **The probe**: `ops/cs-tracker-adoption-probe.mjs` reads the local checkout at the box's sha, not the live host, so the live side is read separately: the served `/assets/css/app.css` digest and its `--token-*` roles, before and after.

## Verification

**Commands:**
- `corepack pnpm typecheck`: exit 0
- `corepack pnpm --filter hub build`: exit 0
- `corepack pnpm test --run`: all files pass (DW-135 flakes re-run)
- `node ops/cs-tracker-adoption-probe.mjs`: exit 0

**Observed 2026-09-30 on the final tree:**
- `corepack pnpm typecheck`: `tsc --noEmit`, exit 0 (before and after the review patches).
- `corepack pnpm --filter hub build`: exit 0.
- `corepack pnpm test --run`, twice (before and after the review patches): `Test Files  75 passed (75)`, `Tests  1842 passed | 1 skipped (1843)`, exit 0 both times; no DW-135 flake this run.
- `ops/__tests__/traefik-config.test.ts`: 24 passed; its new case against the baseline `routes.yml`: 1 failed, 23 passed.
- `node ops/cs-tracker-adoption-probe.mjs` at 18:09:47Z: exit 0, `# 19 cases, 19 PASS, 0 FAIL`, against `cs-tracker` at `2519fe3`, the box's commit.
- The local Docker proof: quoted in `ops/cs-tracker-cutover.md` § Rehearsed off the box (18:22:14Z to 18:23:51Z): `counts-match`, `Migrations already up`, `old-unchanged`, `estate, role cs_tracker: 11`, `live socket 101`, `213 302`.
- The cs-tracker patch: `git apply` onto an export of `2519fe3`, result equal to the rehearsed file but for comments; extraction from the record by the action's `awk` gives sha256 `58cadec9...` from an LF and a CRLF copy.

**Box half (the Operator's):** `ops/cs-tracker-cutover.md` § The sequence steps 1 to 13, § Pending Operator actions 1 to 4.
