---
title: 'Story 4-7: Migrate analytics.cuatro.dev and pin Umami'
type: 'feature'
created: '2026-09-30'
status: 'done'
baseline_commit: 'e72a7c655911a8f4b49ba12653447e7698ecef40'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/ops/postgres.md'
  - '{project-root}/ops/traefik-cutover.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** Umami runs `ghcr.io/umami-software/umami:postgresql-latest`, the estate's one floating third-party tag (the box holds the 3.3.0 digest `sha256:87312d33...`, the tag now resolves to 3.4.0), migrates its schema on every container start against AD-23 (DW-302), has no healthcheck (DW-179), and keeps its data in `cuatro-portfolio-anchor-db-1`, a Postgres 16 that Story 4-4's estate Postgres 18.6 replaces. `analytics.cuatro.dev` still reaches it through Caddy.

**Approach:** In `docker-compose.yml`, pin `anchor-umami` to the exact latest stable release and its digest, point its `DATABASE_URL` at `estate-postgres:5432/umami` as role `umami` (limit 25, `ops/postgres.md` § The budget) through an env placeholder, set `SKIP_DB_MIGRATION` on the server, add an `anchor-umami-migrate` one-shot under the `migrate` profile, and give the server a `/api/heartbeat` healthcheck. Prove it locally in Docker against Postgres 18.6 with the 4-4 init script, including a dump and restore with matching counts and the three Story 2.24 events. Write the Operator's runbook section: freeze, dump, restore, count, migrate, roll, verify, then the Origin Rule move, each with its rollback.

## Boundaries & Constraints

**Always:** every step of the runbook keeps `anchor-db` and its volume untouched (the rollback, until Story 4.11); counts match before the switch; a load reading at each box step; placeholders only in the repository, passwords copied on the box without printing; every proof claim quotes real output.

**Never:** write to the box or the Cloudflare zone in this run; drop, truncate or `down -v` any store; remove the `anchor-db` service; a migration inside the server's start; a routing change unless the committed `analytics` router is wrong; a change to finance, the tracker or the tournament services.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Pinned image | `anchor-umami` and `anchor-umami-migrate` image lines | exact `X.Y.Z@sha256:<64 hex>`, the same on both | a floating tag or a missing digest fails the compose suite |
| Server never migrates | `anchor-umami` environment | carries `SKIP_DB_MIGRATION=1` | its absence fails the suite |
| Discrete migration | `anchor-umami-migrate` | under `profiles: [migrate]`, runs `prisma migrate deploy`, `restart: 'no'` | absent or unprofiled fails the suite |
| Estate database | both services' `DATABASE_URL` | `postgresql://umami:${UMAMI_DB_PASSWORD-}@estate-postgres:5432/umami`, both join `estate-postgres`, neither names `anchor-db` | a stray `anchor-db` fails the suite |
| Healthcheck | `anchor-umami` | probes `/api/heartbeat` | missing or disabled fails the suite |

</frozen-after-approval>

## Code Map

- `docker-compose.yml`: `anchor-umami` (image, env, `depends_on: anchor-db`, networks `default` and `cs-tracker_default` alias `anchor-umami`); `anchor-db` stays; `networks:` gains `estate-postgres` external. Finance's `-` interpolation and `tracker-migrate`'s shape are the precedent.
- `docker/__tests__/compose.test.ts`: text-parsed suite; `parts()` and the finance/tracker describe blocks are the pattern for a new `the Umami services` block.
- `ops/postgres/compose.yml`, `ops/postgres/init/10-consumers.sh`: the estate instance and `umami` role (limit 25) the proof starts.
- `ops/traefik/dynamic/routes.yml`: `analytics` router already matches Caddy's block (three headers, `anchor-umami:3000`); no change.
- `ops/postgres.md`: § Moving a consumer is the generic move; the story's runbook section goes here, plus Pending Operator actions rows.
- `ops/traefik-cutover.md` § Moving a hostname: the Origin Rule helpers the runbook reuses.
- `ops/visitor-instrumentation.md`: events `suite-reach`, `live-open`, `source-open`, `event_type = 2`.
- `ops/estate.md` finance Data note: says Umami pools five; DW-302 asks for the correction.
- `deferred-work.md` DW-179, DW-301, DW-302: touched.
- Image facts read 2026-09-30: 3.4.0 is `sha256:85909afc45bdcda1917394594a087421fdbb05610fded0fa9f6fb861abb2f367` (also today's `postgresql-latest`); 3.3.0 is `sha256:87312d33...`, the box's. `scripts/check-db.js` skips migration on `SKIP_DB_MIGRATION`, requires server version 9.4 or later. `HOSTNAME=0.0.0.0` in the image; `curl` and `wget` present.

## Tasks & Acceptance

**Execution:**
- [x] `docker-compose.yml`: pin, estate `DATABASE_URL`, `SKIP_DB_MIGRATION=1`, healthcheck, `anchor-umami-migrate`, `estate-postgres` external; drop `depends_on: anchor-db` and the `default` network from Umami; comments updated.
- [x] `docker/__tests__/compose.test.ts`: a describe block holding the five matrix rows, each with a planted defect seen failing.
- [x] Local Docker proof (scratchpad, throwaway values): estate Postgres 18.6 from `ops/postgres/compose.yml`; migrate one-shot exits 0; server healthy and `/api/heartbeat` 200; a 16-alpine source seeded by Umami 3.3.0 with page views and the three events, dumped and restored into the estate-shaped `umami` with `counts-match`; migrate on the restored copy; events counted; the rollback override runs 3.3.0 against the source. Everything removed.
- [x] `ops/postgres.md`: § Moving Umami (Story 4-7): preconditions, freeze, dump, restore, counts and events, migrate, roll, verify, Origin Rule move, rollbacks, record; the proof quoted; Pending Operator actions 4 to 6.
- [x] `ops/estate.md`: dated correction of the Umami pool note.
- [x] `deferred-work.md`: DW-179 and DW-302 done with a dated note; DW-301 noted for 4.7.
- [x] `sprint-status.yaml`: 4-7 `awaiting-operator` with a dated comment.

**Acceptance Criteria:**
- Given the pinned image and an estate-shaped Postgres 18.6, when the migrate one-shot runs and then the server starts, then the one-shot applies every migration and exits 0, the server log shows no migration, and `/api/heartbeat` answers 200.
- Given a seeded 3.3.0 database on Postgres 16, when it is dumped and restored as `umami` into the estate instance, then per-table counts match and `suite-reach`, `live-open` and `source-open` rows are present in the restored `website_event`.
- Given the runbook, when read end to end, then no step deletes, drops or overwrites `anchor-db` or its volume, and each rollback names its exact command.

## Implementation Notes

- Implemented inline (no subagent tool in this run). Files: `docker-compose.yml`, `docker/__tests__/compose.test.ts`, `ops/postgres.md` (§ Moving Umami, Pending actions 4 to 6), `ops/estate.md`, `deferred-work.md` (DW-179, DW-301, DW-302), `sprint-status.yaml`.
- Read on the box, read-only, 2026-09-30T14:22:50Z: Umami's database 9455 kB on 16.14, last migration `23_update_session_data`, 79 page views and `suite-reach` 7, `live-open` 1, `source-open` 1. The box's digest `87312d33...` equals GHCR's `3.3.0` manifest digest, so the move is 3.3.0 to 3.4.0 with migrations 24 to 26.
- The local proof ran the runbook's own commands against the pre-move shape built through the rollback override itself, so R2 is proven, not only written. Output is quoted in `ops/postgres.md` § Moving Umami, Rehearsed off the box.
- `/api/heartbeat` answered 200 with the estate Postgres paused, so the healthcheck is liveness and does not flap on a database blip.
- A first scripted edit of `docker-compose.yml` matched `  anchor-db:` inside `depends_on` and left a stale fragment; `docker compose config` refused the file, the fragment was removed, and the diff was re-read.
- The compose suite's new block was run against the baseline `docker-compose.yml` and failed its three cases (unpinned image, no one-off, no `estate-postgres`), then passed on the new file.

## Spec Change Log

- 2026-09-30: box half ran from 22:54Z (runbook § Moving Umami, steps 1 to 14), recorded in `ops/postgres.md` § Umami move run, 2026-09-30; status `done`. A first attempt failed at step 9 because the runbook's compose prefix lacked `HUB_TAG`; the helper block now exports it (DW-310), and the retry from step 3 completed. Pending Operator action 4 stays open.

## Review Triage Log

Pass 1, 2026-09-30, all six layers run inline by this session (no subagent tool in this run), against the diff from `e72a7c6`.

| # | Layer | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | edge-case | Step 2 appends to `.env.production` with `>>`; a file ending without a newline would join the new line to the last one | low | Real on any file without a trailing newline; `grep -c` would then read 0 and stop the Operator, but the joined line corrupts the previous variable | patch: a leading `echo` in the append |
| 2 | blind | "A load reading at each box step" (frozen Always) is not met: steps 5 to 9 read no load | medium | Steps 1, 10, 12, 13 had `uptime`; 5 and 9 did not | patch: `uptime` in steps 5 and 9 (6 to 8 run in seconds inside the same window) |
| 3 | verification-gap | Matrix row "missing or disabled fails the suite": no planted case for a disabled Umami healthcheck | low | `umamiFaults` handles `disable: true`, but no case saw it fail | patch: one planted case, seen passing on the fault |
| 4 | blind | `ops/postgres.md` § The budget still says the box digest's version "was not read" | low | Now read: GHCR's `3.3.0` manifest digest | patch: dated amendment in the cell |
| 5 | blind | The brief asks for `connection_limit` on the URL; none is set | false | The adapter reads no pool option from the URL (DW-302); the role limit is the cap. Recorded as Design Note 9 | reject |
| 6 | blind | Umami no longer `depends_on` a database, so a box reboot may start it before the estate Postgres | false | `check-db.js` exits 1 on no connection and `restart: unless-stopped` retries; a cross-project `depends_on` is not expressible in compose | reject |
| 7 | blind | A future Umami image without `curl` would fail the healthcheck and the suite would not see it | false | The image is pinned by digest; a version change is a new proof run, as the compose comment says | reject |
| 8 | edge-case | R2 after the hostname moved: does Traefik reach the 3.3.0 container | false | The override keeps the `cs-tracker_default` alias `anchor-umami` (merged config read locally: aliases kept, `default` added); both proxies target that alias | reject |
| 9 | edge-case | Step 7 recovery `$C start anchor-umami` after the merge would start the new definition | false | `start` starts the existing stopped container with its own config; only `up` recreates | reject |
| 10 | ponytail | Lean already. Ship. | n/a | The one-shot, the healthcheck and the suite block each carry a stated requirement | none |
| 11 | ecc-verification-loop | Build, types, tests PASS; lint N/A; no secret in the diff (placeholders and `${...}` only) | n/a | Outputs quoted under Verification | none |
| 13 | blind | `anchor-umami-migrate` run before § The placement has no database to reach | false | Compose refuses at once: `estate-postgres` is external and absent, a loud failure before any write; step 1's preconditions put the placement first | reject |
| 14 | blind | `ops/deploy-remote.sh` lists the `migrate` profile and would now see `anchor-umami-migrate` | false | It runs only `$SERVICE-migrate`, `anchor-app-migrate` (line 105); `config --services` read locally lists the new name beside `finance-migrate` and `tracker-migrate`, which it already skips | reject |
| 12 | design | No UI surface in this diff. Design review skipped. | n/a | No `.scss`/`.tsx` outside tests, no motion term in added lines | none |

## Design Notes

**Spec size.** The spec measured about 1,730 tokens at step 2's check (1,304 words at 1.33 tokens a word), over the SCOPE STANDARD's 1,600. The Operator's instruction of 2026-09-30, relayed by the orchestrator for this named spec: **Keep**. The story is one deploy unit's move; a split would separate the pin from the move that first runs it.

Decisions, each one the Operator may overrule (Pending Operator action 4 in `ops/postgres.md`):

1. **Pin `3.4.0@sha256:85909afc...`, exact release plus digest.** The spine's rule asks a major at minimum; the release and digest make the rebuild reproducible (DW-191). 3.4.0 is the latest stable (`gh release list`, 2026-09-17). Its notes name no Postgres floor; `check-db.js` requires 9.4 or later and the proof runs it on 18.6. It carries migrations 24 to 26 over the box's 3.3.0 (the box's last applied is `23_update_session_data`, read 2026-09-30), and "binds authenticated sessions to password fingerprints", so the Operator signs in again after the move.
2. **AD-23 by `SKIP_DB_MIGRATION=1` on the server** and `anchor-umami-migrate` running `node node_modules/prisma/build/index.js migrate deploy`, the tracker's shape; `prisma.config.ts` reads `DATABASE_URL`.
3. **A healthcheck on `/api/heartbeat`** closes DW-179: the move's `up` must report healthy, and a later `docker-rollout` needs it.
4. **Freeze writes for the window**: stop `anchor-umami`, dump, restore, count, migrate, start. Minutes of lost beacons on a low-traffic instance buy an exact count proof; the alternative leaves rows behind unproven.
5. **Data move first, under Caddy; the Origin Rule second.** Each is its own verified step with its own rollback, so a fault is attributable to one change.
6. **Data rollback by an override file on the box** (`/home/deploy/pg-move/umami-rollback.yml`: 3.3.0 digest, `anchor-db` URL, `default` network), run with `-f docker-compose.yml -f` it. It needs no CI round trip and restores the exact prior image; `anchor-db` was never migrated.
7. **The runbook lives in `ops/postgres.md`**, the record that owns consumer moves and already lists 4.7's row, rather than a new record; the hostname half reuses `ops/traefik-cutover.md`'s helpers.
8. **`anchor-db` stays in the compose file** until Story 4.11: it is the rollback and finance's current target (DW-300).
9. **No `connection_limit` in `DATABASE_URL`.** The brief asks for the table's connection limit; the table's "where it sets the limit" cell for `umami` is "nowhere in 3.4.0": the server builds `new PrismaPg({connectionString})`, node-postgres's pool takes `max` from its options, not the URL, and a Prisma `connection_limit` parameter is not read by the adapter (DW-302). A parameter that does nothing would read as a control. The limit is the role's and the database's 25, set by the 4-4 init script and proven there to refuse the twenty-sixth connection.

## Verification

**Commands:**
- `corepack pnpm typecheck`: exits 0
- `corepack pnpm --filter hub build`: exits 0
- `corepack pnpm test --run`: all files pass (DW-135 flakes re-run)
- `docker compose -f docker-compose.yml config` with throwaway env: renders the pinned image and the `migrate` profile service

**Observed 2026-09-30 on the final tree:**
- `corepack pnpm typecheck`: `tsc --noEmit`, exit 0.
- `corepack pnpm --filter hub build`: exit 0 (after the compose change; later edits touched tests and Markdown only).
- `corepack pnpm test --run`: `Test Files  75 passed (75)`, `Tests  1836 passed | 1 skipped (1837)`, first run, no flake.
- `docker/__tests__/compose.test.ts` alone: 25 passed; against the baseline `docker-compose.yml` its three new cases failed.
- `docker compose config --images anchor-umami`: the 3.4.0 reference by digest; with the rollback override, the 3.3.0 one; `--profile migrate config --services` lists `anchor-umami-migrate`.
- The local Docker proof: quoted in `ops/postgres.md` § Moving Umami, Rehearsed off the box.

**Box half (the Operator's):** `ops/postgres.md` § Moving Umami steps 1 to 14, Pending Operator actions 4 to 6.

