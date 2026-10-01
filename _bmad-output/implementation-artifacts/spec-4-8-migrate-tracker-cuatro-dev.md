---
title: 'Story 4-8: Migrate tracker.cuatro.dev'
type: 'feature'
created: '2026-09-30'
status: 'done'
baseline_commit: 'ec9d76ea8c21e01ca151df8a8a06ed1f4bcf274c'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/ops/tracker-cutover.md'
  - '{project-root}/ops/postgres.md'
  - '{project-root}/ops/traefik-cutover.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** `cuatro-portfolio-tracker-1` serves `tracker.cuatro.dev` from the CI image, but its database is still `tracker` in `cuatro-tracker-postgres-1`, a Postgres 16 of the old `cuatro-tracker` project, which Story 4-4's estate Postgres 18.6 replaces (AD-10), and the hostname still reaches it through Caddy.

**Approach:** In `docker-compose.yml`, point `tracker`, `tracker-worker` and `tracker-migrate` at `estate-postgres:5432/cuatro_tracker` as role `cuatro_tracker` with `connection_limit=4` on the URL (`ops/postgres.md` § The budget) through an env placeholder, and join them to `estate-postgres`, keeping Redis and qBittorrent where they run. Prove it locally in Docker: a tracker-shaped Postgres 16 seeded by the real image's migrations, backed up and restore-verified with the repository's scripts, dumped and restored into 18.6 with `counts-match`, `tracker-migrate` a no-op there, and the server rolled onto it by `docker-rollout` under a request loop, then rolled back. Write the Operator's runbook as a new dated section of `ops/tracker-cutover.md`.

## Boundaries & Constraints

**Always:** `cuatro-tracker-postgres-1`, its volume and every dump stay untouched and kept until Story 4.11 (the rollback); `ops/tracker-backup.sh` and `ops/tracker-restore-verify.sh` both exit 0 before anything else in the move; counts match before the switch and again after it; a load reading at each box step; placeholders only in the repository, passwords copied on the box without printing; every proof claim quotes real output.

**Never:** write to the box or the Cloudflare zone in this run; drop, truncate or `down -v` any store; `down` the `cuatro-tracker` project; a migration on the server's or worker's start; a routing change unless the committed `cuatro-tracker` router is wrong; a change to the Hub, Umami, finance or tournament services; DW-275's per-id deploy (not in this run's scope).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Estate database | `DATABASE_URL` of all three services | `postgresql://cuatro_tracker:${CUATRO_TRACKER_DB_PASSWORD-}@estate-postgres:5432/cuatro_tracker?connection_limit=4` | the old host or a missing limit fails the compose suite |
| Networks | `tracker`, `tracker-worker`, `tracker-migrate` | all join `estate-postgres`; server and worker keep `cuatro-tracker_default` for Redis and qBittorrent; migrate joins nothing else | a stray `cuatro-tracker-postgres-1` fails the suite |
| No boot migration | server and worker | no `migrate` in either; image `CMD` is `next start` (`tracker-image.test.ts`) | existing cases hold it |
| Restore | Postgres 16 `tracker` dump into 18.6 `cuatro_tracker` | `pg_restore` exit 0, `counts-match`, `tracker-migrate` "No pending migrations to apply." | a mismatch stops the runbook before the switch |

</frozen-after-approval>

## Code Map

- `docker-compose.yml:203-276`: the tracker's three services (env anchor `&tracker-environment`, networks, `/api/ready` healthcheck); `networks:` already declares `estate-postgres` external (Story 4-7).
- `docker/__tests__/compose.test.ts:300-349`: the tracker describe block; `DATABASE` constant and network regex change; Umami's block (`umamiFaults`) is the planted-defect pattern.
- `docker/__tests__/tracker-image.test.ts:35-40`: already holds CMD `next start`, no migration on boot. Unchanged.
- `apps/tracker/lib/env.ts:9-10`: requires `DATABASE_URL` (a URL) and `DB_PASS` (non-empty, read nowhere else); `lib/db.ts`: `new PrismaClient()` on Prisma 6.19, Rust engine, reads `connection_limit` from the URL.
- `ops/tracker-backup.sh`, `ops/tracker-restore-verify.sh` (`TRACKER_VERIFY_IMAGE`, default `postgres:16-alpine`): run as written, unchanged.
- `ops/postgres.md` § Moving a consumer (row 4.8, `cuatro_tracker`), § The budget (limit 20, `connection_limit=4`), § Moving Umami (the shape of the new section: override-file rollback, freeze, counts, R1/R2).
- `ops/traefik/dynamic/routes.yml`: router `cuatro-tracker`, `Host(tracker.cuatro.dev)`, `house-headers`, `http://cuatro-app:3000`, equal to Caddy's block (`ops/routing-inventory.md:611-619`). No change.
- `ops/traefik-cutover.md` § Moving cuatro.dev and www: the `CF` helper and the ruleset guard the hostname step reuses. `ops/monitoring.md:50`: monitor 803750023 on `tracker.cuatro.dev`.
- Box, read 2026-09-30T15:18Z, read-only: Postgres 16.14, 8015 kB, 11 migrations, last `20260721120000_merge_suggestion_unique_pair`, only `plpgsql`; `User` 1 row, all else 0; Redis 343 keys, RDB only; `/home/deploy/cuatro-downloads` empty; `docker-rollout v0.14` installed; load 0.20.
- Ledger: DW-275, DW-292 (per-id deploy, owner 4.8), DW-301 (backup before move), DW-186 and DW-190 (qBittorrent).

## Tasks & Acceptance

**Execution:**
- [x] `docker-compose.yml`: the estate `DATABASE_URL` and `DB_PASS` on the three services, `estate-postgres` on each, comments updated (AD-10).
- [x] `docker/__tests__/compose.test.ts`: the tracker block asserts the matrix's first three rows, each planted defect seen failing.
- [x] Local Docker proof (scratchpad, throwaway values, removed afterwards), quoted in the runbook.
- [x] `ops/tracker-cutover.md`: new § Moving the database onto the estate Postgres (Story 4-8, 2026-09-30) and Pending actions 5 to 8.
- [x] `ops/postgres.md`: one dated line in § Moving a consumer pointing at that section.
- [x] `ops/tracker-restore-verify.sh` and `ops/__tests__/tracker-backup.test.ts`: `--volumes` on the throwaway's removal, required by the suite (found by the proof; see Implementation Notes).
- [x] `deferred-work.md`: DW-301, DW-275 and DW-292 dated notes; DW-306 (Redis and qBittorrent before 4.11) and DW-307 (the tournament script's same defect) new.
- [x] `sprint-status.yaml`: 4-8 `awaiting-operator` with a dated comment.

**Acceptance Criteria:**
- Given a Postgres 16 `tracker` database migrated by the real tracker image and seeded, when `ops/tracker-backup.sh` and `ops/tracker-restore-verify.sh` run, then both exit 0 with `migrations=11-applied-0-pending`.
- Given its dump restored as `cuatro_tracker` into the estate 18.6 instance, when the counts are compared and `tracker-migrate` runs from the new compose, then `counts-match` prints and the migration applies nothing.
- Given the server serving on the old URL under a request loop, when `docker rollout` moves it onto the new URL and a rollback override moves it back, then every request answers 200 and the estate connections for `cuatro_tracker` never exceed 4 per process.
- Given the runbook, when read end to end, then no step deletes, drops or overwrites the old database, its volume or a dump, and each rollback names its exact command.

## Implementation Notes

- Implemented inline (no subagent tool in this run). Files: `docker-compose.yml`, `docker/__tests__/compose.test.ts`, `ops/tracker-cutover.md`, `ops/postgres.md`, `ops/tracker-restore-verify.sh`, `ops/__tests__/tracker-backup.test.ts`, `deferred-work.md`, `sprint-status.yaml`.
- Migrate-on-boot was already off: the image's only `CMD` is `next start` (held by `tracker-image.test.ts`), no service `depends_on` the migration, and neither Next nor Prisma migrates by default. Nothing to disable; the compose suite keeps `migrate` out of the server and worker.
- The runbook restores the dump `ops/tracker-backup.sh` wrote and `ops/tracker-restore-verify.sh` proved, rather than taking a second, unproven dump. The rehearsal also ran the verification on 18.6 (`TRACKER_VERIFY_IMAGE`); the runbook does not, since step 7's real restore and step 8's counts prove the same against an empty target a retry can empty again.
- **Found by the proof, fixed:** `ops/tracker-restore-verify.sh` removed its throwaway `postgres` container without `--volumes`, so the restored copy outlived it as an anonymous volume (two local runs left two). The box holds one from 2026-09-29T21:05:53Z, the cutover's verification second: Pending action 7. The script's own header promises the copy is removed; the fix is the flag, and the suite now requires it. The tournament's script has the same line: DW-307, not touched here.
- The pool cap measured: 4 connections with `connection_limit=4`, 9 without (four-core VM), and a 20-query burst of 3 s sleeps ended `16 fulfilled 4 rejected P2024` against the 10 s `pool_timeout`. Recorded in the runbook as a stated ceiling.
- `docker rollout` rolls the profiled `tracker` without `COMPOSE_PROFILES`, tested, so Story 3-6's later-rollout line stands.
- A first scripted edit of the compose suite failed its own string assertion before writing (a heredoc quoting fault); the edits were redone with the Edit tool and the diff re-read.
- DW-306 and DW-307 are the next free ids at the time of writing; a concurrent story taking either would need a renumber at merge.

## Spec Change Log

- 2026-10-01: box half ran from 2026-09-30T23:53Z to 2026-10-01T00:02Z (runbook § Moving the database onto the estate Postgres, steps 1 to 14), recorded in `ops/tracker-cutover.md` § Estate Postgres move run, 2026-09-30; status `done`. Step 10 started about a minute late from an orchestration fault (the script piped into `ssh` over stdin), not a runbook defect. The Operator saw the tracker's sign-in accept any password (DW-311). Pending Operator action 5 stays open.

## Review Triage Log

Pass 1, 2026-09-30, all six layers run inline by this session (no subagent tool in this run), against the diff from `ec9d76e` (61 kB; blind floor N = floor(sqrt(59.7) + 1) = 8).

| # | Layer | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | edge-case | Step 1 lists running containers only; an exited `tracker` container would make `docker rollout` replace it alone and roll nothing | low | `ops/deploy-remote.sh` states that behaviour of docker-rollout v0.14; step 10's checks would show it late | patch: `docker ps -a`, and step 1 expects no exited `tracker` container |
| 2 | edge-case (claim) | "`2 × cores + 1`" and "the host's Docker VM has four cores" misstate Prisma's default | low | Prisma counts physical cores; the VM reports 8 CPUs (`docker info`), and the measured default was 9 | patch: wording in the table and the measurement |
| 3 | ponytail | `yagni:` step 6's second verification on 18.6 duplicates steps 7 and 8, which restore into the real, empty, re-emptiable target and count | low | A failed step 7 leaves only an empty database to drop; the extra run costs load on the box | patch: removed from the runbook; the rehearsal keeps its line as evidence |
| 4 | blind | The rehearsal's estate container is `p48pg-estate-postgres-1` while the runbook's `DST` is `postgres-estate-postgres-1`, unexplained | low | A reader matching output to commands would stall | patch: the project name stated |
| 5 | blind | The AC's "never exceed 4 per process" was measured on the server only | false | The worker takes the same URL through `*tracker-environment` (asserted by the suite); the cap is the URL's, per process | reject |
| 6 | blind | Pending action 7's `docker volume rm` deletes data | false | It is the restore-verify's copy; the live database and the dump stay, and the action reads the volume and its users first | reject |
| 7 | blind | `TRACKER_TAG` from `docker ps` may be empty or two lines | false | Empty makes compose refuse `tracker:` as invalid (the file's comment); two lines print at the `echo`, which expects one sha | reject |
| 8 | blind | Step 2 appends a blank line when `ops/postgres/.env` lacks the variable | false | The count then prints 0 and the Operator stops; a blank line in an env file is inert | reject |
| 9 | blind | A burst holding more than four connections for seconds fails `P2024` after 10 s | low | Measured (`16 fulfilled 4 rejected`); one user and millisecond queries make it unreachable in use; raising the cap adds complexity to no end | reject: recorded as a stated ceiling in the runbook |
| 10 | blind | The epic context says 4.8 carries DW-275 (per-id deploy); this diff does not do it | medium | True; the frozen intent's Never excludes it, as the orchestrator's scope did | reject as out of scope; dated note on DW-275 and DW-292, reported as an unmet criterion |
| 11 | blind | The tracker's Redis, declared in the Registry `tech`, has no offsite backup (AD-10) | medium | Pre-existing; not caused by this change | defer: carried by DW-306 (filed this story) |
| 12 | edge-case | A write reaching the old container during step 10's overlap is lost | false | Step 10's `old-unchanged` diff runs after the roll and names such a write before the Operator goes on | reject |
| 13 | verification-gap | No verification gaps found. Compose values are the artifact and the suite asserts them exactly (each planted defect fails; the baseline file failed five cases); dropping `--volumes` fails four restore-verify cases | n/a | Run: baseline and planted runs quoted under Verification | none |
| 14 | ecc-verification-loop | Build PASS, types PASS, tests PASS (WSL flakes re-run), lint N/A (no lint command, AGENTS.md), no secret in the diff (placeholders, `${...}`, digests and a volume id only) | n/a | Outputs quoted under Verification | none |
| 15 | design | No UI surface in this diff. Design review skipped. | n/a | No `.scss`/`.tsx` outside tests, no motion term in added lines | none |

## Design Notes

**Spec size.** The spec measured about 1,750 tokens at step 2's check (1,314 words at 1.33 tokens a word), over the SCOPE STANDARD's 1,600. The Operator's instruction of 2026-09-30, relayed by the orchestrator for this named spec: **Keep**. The story is one deploy unit's database move; a split would separate the compose change from the proof and the runbook that first run it.

Decisions, each one the Operator may overrule (Pending action 5 in `ops/tracker-cutover.md`):

1. **Redis and qBittorrent stay in the `cuatro-tracker` project in this story.** The acceptance intent is the data backed up and restore-verified and the subdomain serving; AD-10 names Postgres. Redis holds BullMQ state (343 keys, RDB only) and qBittorrent an empty download directory and a config volume with open findings (DW-186, DW-190): moving them is two more cutovers, each with its own data question, in a window that needs none. A new DW, owner Story 4.11 (before it decommissions the old project), carries them.
2. **Freeze by stopping the worker; the server keeps serving reads.** The tracker is the Operator's alone and its sessions are JWT (`Session` 0 rows), so writes come from the worker and the Operator. The Operator writes nothing in the window, and the counts diff runs again after the switch to prove the old store took nothing.
3. **The server switches by `docker rollout`**, installed on the box (v0.14): old and new overlap and read identical data, so the hostname serves throughout. Rehearsed locally.
4. **Data first, under Caddy; the Origin Rule second.** Each verified and rolled back on its own.
5. **Rollback by an override file on the box** restoring the old `DATABASE_URL` and `DB_PASS`, rolled with `-f`: no CI round trip; the old store took no write after the freeze.
6. **The runbook lives in `ops/tracker-cutover.md`**, the record that owns the tracker's placement, with a one-line pointer from `ops/postgres.md`.
7. **`~/cuatro-backup.sh` keeps dumping the old database** until Story 4.11: it then backs up the rollback copy; the estate nightly (Story 4-5) covers `cuatro_tracker`.
8. **DW-275 stays open**: the orchestrator's scope for this run names the database move; a per-id deploy is its own change to `deploy.yml` and the Capacity Gate.

## Verification

**Commands:**
- `corepack pnpm typecheck`: exit 0
- `corepack pnpm --filter hub build`: exit 0
- `corepack pnpm test --run`: all files pass (DW-135 flakes re-run)
- `corepack pnpm --filter tracker test` with a Redis on 6379: all pass
- `docker compose config` with throwaway env: the three services render the estate URL

**Observed 2026-09-30 on the final tree:**
- `corepack pnpm typecheck`: `tsc --noEmit`, exit 0.
- `corepack pnpm --filter hub build`: exit 0.
- `corepack pnpm test --run`, twice: `Tests  6 failed | 1832 passed | 1 skipped (1839)`, then `3 failed | 1835 passed`; every failure one case of about 30 s in a suite that spawns WSL's bash (`deploy-remote`, `library-backup`, `postgres-backup`, `postgres-init`, `tournament-backup`, `tracker-backup`), a different case each run, the DW-135 and DW-303 shape. Those six files re-run: `Test Files  6 passed (6)`, `Tests  150 passed | 1 skipped (151)`; the second run's three: `107 passed | 1 skipped`.
- `docker/__tests__/compose.test.ts` and `tracker-image.test.ts`: 33 passed; the compose block against the baseline `docker-compose.yml`: its five tracker cases failed.
- `ops/__tests__/tracker-backup.test.ts`: against the unfixed script its four restore-verify cases failed; fixed, 11 passed.
- `corepack pnpm --filter tracker test` with `redis:7-alpine` on 6379: `Test Files  105 passed (105)`, `Tests  1211 passed (1211)`.
- The local Docker proof: quoted in `ops/tracker-cutover.md` § Moving the database onto the estate Postgres, Rehearsed off the box.

**Box half (the Operator's):** `ops/tracker-cutover.md` § Moving the database onto the estate Postgres steps 1 to 14, Pending Operator actions 5 to 8.
