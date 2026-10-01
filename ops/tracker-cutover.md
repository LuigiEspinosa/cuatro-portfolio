# The tracker cutover

How `tracker.cuatro.dev` moves from the containers the box builds from `cuatro-tracker` to the image
CI builds from `apps/tracker`, without going dark, and how to take it back. It is the artifact Story 3-6
delivers for the one live merge of AD-20's three.

This file is a record, not Registry data. It follows the pattern `ops/backup-digital-library.md` and
`ops/routing-inventory.md` set: every value is marked as a decision or an observation, and the two are
never presented as the same kind of fact (NFR-9).

**Nothing here has run on the box. Written 2026-09-29, committed on `dev`.** No session that wrote it
can reach the box (no key and no host entry exist on the authoring machine), and the compose services
it starts reach the box only with the Epic 3 merge to `main`. Every box step is a Pending Operator
action at the end, and until the last is dated the old containers serve `tracker.cuatro.dev`.

**Amended 2026-09-29, the same day:** the sequence ran on the box that evening (§ Cutover run below),
driven from the Operator's workstation over the `deploy` user's key in its Ubuntu WSL, which the
authoring session had not found: the claim above that no session here could reach the box was wrong
for that machine. Since 21:33:20Z `cuatro-portfolio-tracker-1` alone serves `tracker.cuatro.dev`.

## What serves it today

**From `ops/routing-inventory.md`, observed 2026-08-24, not re-observed since.** Step 1 below re-reads
each of these before anything changes, because the cutover is built on them.

| Fact | Value | Where the inventory says it |
|---|---|---|
| Ingress | `cs-tracker-caddy-1`, `reverse_proxy cuatro-app:3000` in the `tracker.cuatro.dev` block of `/home/deploy/cs-tracker/Caddyfile` | § The site blocks, as installed |
| The upstream | `cuatro-tracker-app-1`, aliases `app` and `cuatro-app` on `cs-tracker_default`, `app` on `cuatro-tracker_default`, image `cuatro-tracker-app:latest` built on the box | § `cuatro-tracker`, services ...; § The shared network |
| The stores | `cuatro-tracker-postgres-1` (`tracker` database and role, volume `cuatro-tracker_pg_data`), `cuatro-tracker-redis-1`, `cuatro-tracker-qbittorrent-1`, all on `cuatro-tracker_default` only | same |
| The worker | `cuatro-tracker-worker-1`, `tsx worker.ts`, on `cuatro-tracker_default` | same |
| The checkout | `/home/deploy/cuatro-tracker` at `5d49da7`, clean; ingress by a gitignored `docker-compose.override.yml` | § Per-project git state; § Declared against running |
| The secrets | `/home/deploy/cuatro-tracker/.env`, fifteen names, none read | § The variable names each project needs |
| The nightly backup | `~/cuatro-backup.sh`, 03:30 UTC, `pg_dump -U tracker -Fc tracker` into `/home/deploy/backups/cuatro-tracker`, 14 days, never restored | § Backup coverage, per project |

**Observed 2026-09-29 from the authoring machine:** `https://tracker.cuatro.dev/api/health` answered
200 and `https://tracker.cuatro.dev/` 307, with curl's own user agent.

### Where the inventory falls short, recorded against Story 1.7

Filed as DW-274 rather than worked around. None blocks the cutover, because step 1 reads each one on
the box before anything changes.

1. **The override's text is not recorded.** The inventory records what
   `/home/deploy/cuatro-tracker/docker-compose.override.yml` does (the `cs-tracker_default` attachment
   and the `cuatro-app` alias) but not the file, and it is gitignored and box-only. A rollback that
   rebuilt the old project from its repository would come back without an ingress.
2. **`~/cuatro-redeploy.sh` is listed, never read.** Its contents are not in the inventory. If it runs
   `docker compose up` in the old project after the cutover, it starts the old app and worker again
   beside the new ones. Step 8 retires it.
3. **The inventory is 36 days old for this project.** Nothing re-observed `cuatro-tracker` after
   2026-08-24, so the checkout's head, the aliases and the containers are dated facts, which is why
   step 1 exists.

## What the cutover changes, and what it leaves alone

**Decisions, Story 3-6** (Decisions 3 and 4 of its spec):

- **Only the app and the worker change.** `tracker` and `tracker-worker` in the Anchor's
  `docker-compose.yml` run `ghcr.io/luigiespinosa/tracker:<sha>` in place of the two containers the old
  project built. Postgres, Redis and qBittorrent keep running in the old project with their volumes,
  and the new containers reach them over `cuatro-tracker_default` by container name. One Postgres for
  the estate (AD-10) is Stories 4.4 and 4.8, so the data moves once, then.
- **No Caddyfile edit.** `tracker` answers to `cuatro-app` on `cs-tracker_default`, the name Caddy
  already proxies. While the old and the new container both run, Docker's DNS returns both addresses and
  both serve the same data; stopping the old one leaves the new one alone behind the name.
- **Rollback is starting the old containers again.** No data moves and the merged code carries no
  migration the box lacks (`985e3c5` against the box's `5d49da7` differs only in one e2e spec), so the
  old app reads the same schema it left.
- **A side effect worth having.** Stopping `cuatro-tracker-app-1` ends the `app` alias collision on
  `cs-tracker_default` the inventory records, since the new service is `tracker`, not `app`.

## Rehearsed off the box

**Observed 2026-09-29 on the authoring machine** (Docker 29.8.1, Compose 5.5.1), against stand-ins: two
networks named as the box's, a Postgres and a Redis under the old project's container names, the tracker
image run as `cuatro-tracker-app-1` with the `cuatro-app` alias standing in for the old app, and a
`caddy:2` with `reverse_proxy cuatro-app:3000`. Requests one at a time, 100 ms apart, through that Caddy ran across the
whole sequence below with the real `docker-compose.yml`: `tracker-migrate` ("No pending migrations to
apply."), `up -d tracker` (healthy on `/api/ready`), `up -d tracker-worker` (`worker.ready` logged),
the old app stopped, then the rollback (old app started, new two stopped). **1,160 requests, 1,160
answered 200.** What that does not prove: the old app was the new image under the old name, not the
box's own build, and the Caddy was not the box's.

The two scripts step 2 runs were run the same day against a real Postgres 16 holding the tracker's
eleven migrations and two rows: `tracker-backup.sh` wrote a 22,270-byte dump (the box's nightly dumps
are 22,310 bytes), and `tracker-restore-verify.sh` restored it and matched all nine tables,
`migrations=11-applied-0-pending`, exit 0. With one row written after the dump, it failed naming the
table, and removed its container both times.

## The sequence

On the box as `deploy`, in `/home/deploy/cuatro-portfolio` unless a step says otherwise. **Preconditions:**
the Epic 3 merge is on `main` and deployed, so this checkout holds `apps/tracker` and the tracker
services; and a commit on `main` has a green **Image (tracker)** run, whose sha is `TRACKER_TAG` below.

Every compose command names `HUB_TAG` too. Compose interpolates the whole file whichever service it
runs, and the Hub's image line refuses an unset tag; the running Hub's sha is the value that changes
nothing.

```bash
cd /home/deploy/cuatro-portfolio
export HUB_TAG="$(git rev-parse HEAD)"
export TRACKER_TAG=<the sha whose Image (tracker) run is green>
C='docker compose --env-file .env.production'
```

1. **Re-read what the cutover stands on, and stop at the first difference.**
   `docker network inspect cs-tracker_default --format '{{range .Containers}}{{.Name}} {{end}}'` lists
   `cuatro-tracker-app-1`; `docker inspect cuatro-tracker-app-1 --format '{{json .NetworkSettings.Networks}}'`
   shows `cuatro-app` among its aliases on `cs-tracker_default`;
   `grep -n 'reverse_proxy cuatro-app:3000' /home/deploy/cs-tracker/Caddyfile` prints one line;
   `docker ps --format '{{.Names}}' | grep cuatro-tracker-` lists the five running containers the table
   above names (app, worker, postgres, redis, qbittorrent; `migrate` exits by design); `cat /home/deploy/cuatro-tracker/docker-compose.override.yml`
   and `cat ~/cuatro-redeploy.sh`, whose text goes into this record (DW-274). A difference is a finding
   against Story 1.7: record it, and do not work around it.
2. **Back up and prove the restore, before anything else changes.** Stop the old worker first, so the
   counts are read against a database nothing writes, and write nothing in the tracker until step 6:
   `(cd /home/deploy/cuatro-tracker && docker compose stop worker)`, then
   `bash ops/tracker-backup.sh` and `bash ops/tracker-restore-verify.sh <the dump it names>`. Both must
   exit 0, and the verification's summary reads `migrations=11-applied-0-pending`. It refuses a backup
   missing a migration the checkout carries, since the image would then migrate the live database in
   step 5, which this cutover does not plan for: stop there, and restart the old worker. Copy the
   three files off the box from the workstation:
   `scp deploy@177.7.52.248:/home/deploy/backups/cuatro-tracker/tracker-<stamp>.dump* .`
3. **Start the request loop, off the box, and leave it running to step 7.** From the workstation:
   ```bash
   while :; do printf '%s %s\n' "$(date -u +%H:%M:%S)" \
     "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 https://tracker.cuatro.dev/api/health)"; sleep 1
   done | tee tracker-cutover-probe.log
   ```
4. **Give the new containers their inputs.** The secrets are the old project's, copied with a `TRACKER_`
   prefix and never printed. First `sed -i '/^TRACKER_/d' .env.production`, so a re-run after a partial
   attempt replaces the copy rather than doubling it; then `grep -E '^(ADMIN_PASS|DB_PASS|DOWNLOAD_PATH|IGDB_CLIENT_ID|IGDB_CLIENT_SECRET|LOG_LEVEL|NEXTAUTH_SECRET|NEXTAUTH_URL|QBITTORRENT_PASS|QBITTORRENT_USER|STEAM_API_KEY|STEAM_USER_ID|TMDB_API_KEY|TMDB_WATCH_PROVIDER_COUNTRY)=' ../cuatro-tracker/.env | sed 's/^/TRACKER_/' >> .env.production`,
   then `grep -c '^TRACKER_' .env.production` prints 14 (the fifteenth name, `CLOUDFLARE_API_TOKEN`,
   belongs to the old project's dormant Caddy and is not copied). Then `docker pull
   ghcr.io/luigiespinosa/tracker:$TRACKER_TAG`, which needs the package public or this account logged
   in to GHCR (action 1).
5. **Migrate.** `$C --profile migrate run --rm tracker-migrate` prints "No pending migrations to apply."
6. **Start the new server beside the old one, then the new worker.** `$C --profile tracker up -d tracker`; wait until
   `docker inspect --format '{{.State.Health.Status}}' cuatro-portfolio-tracker-1` prints `healthy`
   (`/api/ready`, so its database and Redis both answered). Then `$C --profile tracker up -d tracker-worker`, and
   `docker logs cuatro-portfolio-tracker-worker-1 2>&1 | grep -c worker.ready` prints 1. From here both
   servers answer `cuatro-app`.
7. **Stop the old server.** `(cd /home/deploy/cuatro-tracker && docker compose stop app)`. Its store
   services keep running; never `down` that project, which would remove the network and the stores the
   new containers use. Leave the loop running a minute more, then stop it and count:
   `awk '{print $2}' tracker-cutover-probe.log | sort | uniq -c` must show 200 alone.
8. **Keep the old ones from coming back.** `mv ~/cuatro-redeploy.sh ~/cuatro-redeploy.sh.retired-<date>`,
   after step 1 has copied its text here.

**Rollback, at any step:** `(cd /home/deploy/cuatro-tracker && docker compose start app worker)`, wait
for `cuatro-tracker-app-1` to answer, then `$C --profile tracker stop tracker tracker-worker`. The data never moved, so
nothing is restored; the dump from step 2 is for a failure nobody planned.

**Later rollouts** of a new tracker sha use the pull and the same two commands the Hub's deploy uses,
by hand until a story wires the tracker into `deploy.yml` (DW-275). Not rehearsed: `docker-rollout` is not installed on the authoring machine, and Story 3-4 proved it on the Hub alone.
`$C --profile migrate run --rm tracker-migrate`, then `docker rollout --env-file .env.production tracker`,
then `$C --profile tracker up -d tracker-worker`.

## After the cutover

- This file: the date and the probe's count under a "Cutover run" heading, the text step 1 read, and
  each Pending Operator action dated.
- `ops/estate.md` and `ops/routing-inventory.md`: a dated amendment saying which containers now serve
  `tracker.cuatro.dev`, and that the `app` collision is gone.
- `ops/capacity-gate.yml` keeps its `cuatro-tracker` placement: the cutover replaces the deploy unit of
  an existing placement and places nothing new (AD-9). Whether the entry takes the id `tracker` is
  DW-275's.
- The nightly `~/cuatro-backup.sh` keeps dumping the same database, which never moved.

## Cutover run

**Observed 2026-09-29 on the box as `deploy`, over SSH from the Operator's WSL, with the Operator
watching.** `HUB_TAG=5117673f3834f9368eecd7fe459bc0ca4ddd5b3c` (the merge commit the box ran) and
`TRACKER_TAG=5117673f3834f9368eecd7fe459bc0ca4ddd5b3c` (Image (tracker) run 36627621124 on `main`,
green).

- **Step 1, no difference found.** `cs-tracker_default` listed `cuatro-tracker-app-1` among nine
  members; its aliases there were `cuatro-tracker-app-1`, `app` and `cuatro-app`, and on
  `cuatro-tracker_default` `cuatro-tracker-app-1` and `app`; `reverse_proxy cuatro-app:3000` sat at
  `Caddyfile:46`; the five containers ran (`app`, `worker`, `postgres`, `redis`, `qbittorrent`);
  `/home/deploy/cuatro-tracker` was clean at `5d49da7`; `.env` carried the fifteen names the inventory
  lists. The two files DW-274 wanted recorded:

  `docker-compose.override.yml`:
  ```yaml
  # Gitignored shared-host override (ops-1, E1). cuatro-tracker runs as its own
  # stack with NO published ports; cs-tracker's Caddy (sole 80/443 ingress) fronts
  # it. Attach `app` to cs-tracker's network so that Caddy can reach it by the
  # alias `cuatro-app`, while keeping app on this project's default network for
  # postgres/redis.
  name: cuatro-tracker

  services:
    app:
      networks:
        default:
        cs-tracker_default:
          aliases:
            - cuatro-app

  networks:
    cs-tracker_default:
      external: true
  ```

  `~/cuatro-redeploy.sh` (592 bytes, dated 2026-07-30), which would have rebuilt and restarted the
  old app and worker on every run:
  ```bash
  #!/usr/bin/env bash
  # cuatro-tracker manual redeploy (ops-1). Pulls main, rebuilds, prunes, smokes.
  # Release first from your workstation: git push origin dev:main
  set -euo pipefail
  cd /home/deploy/cuatro-tracker
  git fetch origin
  git reset --hard origin/main
  docker compose up -d --build
  docker image prune -f
  echo "=== smoke ==="
  for i in 1 2 3 4 5; do
    if curl -fsS https://tracker.cuatro.dev/api/health >/dev/null; then
      echo "health OK in $i/5"
      curl -fsS https://tracker.cuatro.dev/api/ready && echo
      exit 0
    fi
    sleep 5
  done
  echo "health FAILED after 5 attempts" >&2
  exit 1
  ```
- **Step 2.** `cuatro-tracker-worker-1` stopped at 21:05Z. `tracker-backup.sh`:
  `file=/home/deploy/backups/cuatro-tracker/tracker-20260929T210552Z.dump dump=ok list=ok tables=9
  rows=12 bytes=22310 sha256=1cdb83bc... exit=0`. `tracker-restore-verify.sh`: `sha256=match
  restore=ok tables=9 rows=12 migrations=11-applied-0-pending exit=0`. The dump, its counts and its
  sha256 were copied to the workstation by `scp`.
- **Step 3.** The probe ran from the workstation at one request per second to `/api/health` with a
  browser user agent, in two windows because the first reached its 25-minute cap while the Operator
  was consulted: 21:07Z to 21:32Z, **1,487 requests, all 200**, both servers answering the alias; then
  21:32:27Z to 21:34:15Z across the switch, **108 requests, all 200**, every second from 21:33:10Z to
  21:33:35Z answered, with the stop at 21:33:20Z inside it.
- **Step 4.** Fourteen `TRACKER_` lines in `.env.production` (the `sed` first removed none, this being
  the first attempt); `ghcr.io/luigiespinosa/tracker:5117673f...` pulled without credentials.
- **Step 5.** `tracker-migrate`: "No pending migrations to apply."
- **Step 6.** `cuatro-portfolio-tracker-1` healthy after 8 s; `cuatro-portfolio-tracker-worker-1`
  logged `worker.ready` once. Before step 7, `cuatro-portfolio-tracker-1` was confirmed on
  `cs-tracker_default` with the `cuatro-app` alias and answering `/api/health` 200 from that network.
- **Step 7.** `cuatro-tracker-app-1` stopped at 21:33:20Z; `cuatro-app` then resolved to one address,
  the new container's. From outside afterwards: `/api/health` 200 (`version 0.1.0`, the new
  container's uptime), `/api/ready` 200 with `db ok` and `redis ok`, `/` 307 to `/login`.
- **Step 8.** `~/cuatro-redeploy.sh` moved to `~/cuatro-redeploy.sh.retired-2026-09-29`.
- **Left running in the old project:** `postgres`, `redis` and `qbittorrent`, with `app` and `worker`
  exited (0), as the decision above says. The `app` alias collision on `cs-tracker_default` ended with
  step 7. The optional reclaim of the old images was not run.

## Moving the database onto the estate Postgres (Story 4-8, 2026-09-30)

The cutover above left the tracker's data where it was: `tracker` in `cuatro-tracker-postgres-1`, a
Postgres 16 of the old project. Story 4-8 moves it into `cuatro_tracker` on the estate's one Postgres
18.6 (`ops/postgres.md`, AD-10), then moves `tracker.cuatro.dev` from Caddy to Traefik. This section is
how the Operator runs both. It lives here rather than in `ops/postgres.md` because this file owns the
tracker's placement and its rollback; `ops/postgres.md` § Moving a consumer points here, and the
hostname half reuses `ops/traefik-cutover.md` § Moving cuatro.dev and www.

**Nothing in this section has run on the box. Written 2026-09-30, committed on `dev`.**

| What | Before | After | Kind |
|---|---|---|---|
| Database | `tracker`, role `tracker`, in `cuatro-tracker-postgres-1`, Postgres 16.14 | `cuatro_tracker`, role `cuatro_tracker`, in `postgres-estate-postgres-1`, Postgres 18.6, CONNECTION LIMIT 20 on both | Decision (`ops/postgres.md` § The budget) |
| `DATABASE_URL` of `tracker`, `tracker-worker`, `tracker-migrate` | `postgresql://tracker:${TRACKER_DB_PASS-}@cuatro-tracker-postgres-1:5432/tracker` | `postgresql://cuatro_tracker:${CUATRO_TRACKER_DB_PASSWORD-}@estate-postgres:5432/cuatro_tracker?connection_limit=4`, and `DB_PASS` the same password (`lib/env.ts` requires it and reads it nowhere else) | Decision |
| Pool | Prisma 6's default, `2 × physical cores + 1` per process: five on the box's two vCPUs, as `ops/postgres.md` § The budget reads it | four per process, from the URL: two servers and two workers across a rollout plus one migration stay under 20 | Decision; measured below |
| Networks | server and worker on `cuatro-tracker_default` | all three on `estate-postgres`; server and worker keep `cuatro-tracker_default`, where Redis and qBittorrent stay; the migration joins nothing else | Decision |
| Migrations | `tracker-migrate`, a one-off before a rollout; the image's `CMD` is `next start` alone (`docker/__tests__/tracker-image.test.ts`) | unchanged, against the new database | Already AD-23's shape |
| Hostname | Caddy's `tracker.cuatro.dev` block, `reverse_proxy cuatro-app:3000` | the committed `cuatro-tracker` router in `ops/traefik/dynamic/routes.yml`, reached by one Origin Rule. It already matches Caddy's block (the same three headers, `cuatro-app:3000`), so nothing in `ops/traefik/` changes | Decision |

What it leaves alone: `cuatro-tracker-postgres-1` and its volume `cuatro-tracker_pg_data` (the rollback,
until Story 4.11); Redis and qBittorrent in the old project (DW-306); the `TRACKER_` secrets in
`.env.production`, `TRACKER_DB_PASS` included, which the rollback reads; the nightly `~/cuatro-backup.sh`,
which goes on dumping the old database, the rollback's copy, until Story 4.11 retires it, while the
estate's nightly dump (`ops/postgres-backup.md`) covers `cuatro_tracker` from its first night (DW-301);
and Caddy's block.

**Decisions, each one the Operator may overrule** (Pending action 5; the Story 4-8 spec's Design Notes
carry the reasoning): Redis and qBittorrent stay in the old project in this story; the freeze stops the
worker while the server keeps serving reads, and the Operator writes nothing in the tracker for the
window; the server moves by `docker rollout`, so the hostname serves throughout; the data moves first,
under Caddy, and the hostname second; the data rollback is an override file on the box; this record
holds the runbook.

**Between the merge and step 10, never start or roll the tracker from the plain file.** Once `main`
carries this change, `$C --profile tracker up` or `docker rollout ... tracker` points the tracker at
`cuatro_tracker`. Before step 7 that database is empty and `/api/ready` still answers 200 (it runs
`SELECT 1`), so a healthy container would serve an empty library. A rollout needed in that window uses
the rollback override of step 3.

### What serves it today

**Observed 2026-09-30T15:18:28Z over SSH as `deploy`, read-only**: load average 0.20, 0.25, 0.20;
`cuatro-portfolio-tracker-1` on `ghcr.io/luigiespinosa/tracker:5117673f...`, up 18 hours, healthy;
`cuatro-tracker-app-1` and `cuatro-tracker-worker-1` exited since the cutover; `postgres`, `redis` and
`qbittorrent` up two months. The database: `PostgreSQL 16.14 on x86_64-pc-linux-musl`, 8015 kB, eleven
migrations applied, the last `20260721120000_merge_suggestion_unique_pair`, extension `plpgsql` alone;
`User` 1 row and every other table 0, as the 2026-09-29 backup counted. Redis: 343 keys, RDB only, no
AOF. `/home/deploy/cuatro-downloads` empty. `docker-rollout version v0.14` installed. No
`estate-postgres` network yet. The disk 21 percent used, 5480 MB of memory available.

**Found the same day:** a dangling anonymous volume created `2026-09-29T21:05:53Z`, the second the
cutover's step 2 ran `ops/tracker-restore-verify.sh`. That script removed its throwaway container
without `--volumes`, and the `postgres` image declares a `VOLUME`, so the restored copy of the tracker's
database outlived it. Reproduced locally (two runs, two volumes), fixed in this story
(`docker rm --force --volumes`, held by `ops/__tests__/tracker-backup.test.ts`), and the box's copy is
Pending action 7.

### Rehearsed off the box

Run 2026-09-30 between 15:29Z and 15:34Z on the authoring host (Windows 11, Docker 29.8) from a scratch
directory holding copies of this commit's `docker-compose.yml` and `ops/postgres/`, throwaway passwords
in its `.env.production` and `postgres/.env`, and `docker-rollout` v0.14 (sha256 `cdeaba6a...`, equal to
`ops/deploy-remote.sh`'s pin) run as the Docker CLI plugin in a `docker:29-cli` container on the host's
socket, as the deploy runs it. The box's shape: networks `cs-tracker_default` and
`cuatro-tracker_default`; `cuatro-tracker-postgres-1` (`postgres:16-alpine`, database and role
`tracker`) and `cuatro-tracker-redis-1` under the old names; the estate instance from
`ops/postgres/compose.yml` under the throwaway project `p48pg` (so its container was `p48pg-estate-postgres-1`, where the box's is `postgres-estate-postgres-1`); the **real tracker image the box runs**, `5117673f...`, migrating the old
database (eleven migrations), seeding the admin user with its own `prisma/seed.ts`, then 50 `MediaItem`
and 20 `UserEntry` rows by SQL; the server and worker started on the old database through step 3's
override, `/api/ready` answering `{"status":"ok","db":"ok","redis":"ok",...}`. Then steps 5 to 10 and
R2 as written (step 6's verification run a second time on 18.6, to see the 16 dump restore there before
the estate instance took it), with a request loop inside `cs-tracker_default` against `cuatro-app:3000/api/ready`, the
name Caddy and Traefik both proxy. Output as printed, trimmed only where marked:

```
## freeze: stop the worker
2026-09-30T15:30:08Z
## ops/tracker-backup.sh
tracker-backup file=.../tracker-20260930T153009Z.dump dump=ok list=ok tables=9 rows=82 bytes=23000 sha256=83277ed2... exit=0
## ops/tracker-restore-verify.sh (default postgres:16-alpine)
tracker-restore-verify sha256=match restore=ok tables=9 rows=82 migrations=11-applied-0-pending exit=0
## the same, TRACKER_VERIFY_IMAGE=postgres:18.6-trixie
tracker-restore-verify sha256=match restore=ok tables=9 rows=82 migrations=11-applied-0-pending exit=0
## target empty
0
## restore the proven dump as cuatro_tracker
exit=0
## counts                                    (live source against target; then the counts file against target)
counts-match
counts-match-dump
## owners                                    (every relation in public)
cuatro_tracker
PostgreSQL 18.6 (Debian 18.6-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
## migrate, before step 2 copied the password
Error: P1000: Authentication failed against database server, the provided database credentials for `cuatro_tracker` are not valid.
## the password, copied without printing
1
## migrate                                   (Prisma's config deprecation notice left out)
Datasource "db": PostgreSQL database "cuatro_tracker", schema "public" at "estate-postgres:5432"
11 migrations found in prisma/migrations
No pending migrations to apply.
exit=0
## rollout onto the estate database
15:31:16
==> Scaling 'tracker' to '2' instances
==> Waiting for new containers to be healthy (timeout: 120 seconds)
==> Stopping and removing old containers
15:31:25
cuatro-portfolio-tracker-2 Up 7 seconds (healthy)
@estate-postgres:5432/cuatro_tracker?connection_limit=4
## worker onto the estate database
 Container cuatro-portfolio-tracker-worker-1 Started
1                                            (worker.ready lines)
## ready through the alias
{"status":"ok","db":"ok","redis":"ok",...}
## 200 concurrent /api/ready
    200 200
## the old store took nothing since the freeze
old-unchanged
## probe across the move                     (15:31:11 to 15:33:38)
    667 200
## R2: rollout back onto the old database through the override
==> Scaling 'tracker' to '2' instances
==> Waiting for new containers to be healthy (timeout: 120 seconds)
==> Stopping and removing old containers
cuatro-portfolio-tracker-3 Up 9 seconds (healthy)
@cuatro-tracker-postgres-1:5432/tracker      (the server's URL host and database)
@cuatro-tracker-postgres-1:5432/tracker      (the worker's)
## probe across the rollback
    103 200
```

**The pool cap, measured.** Inside the rolled container, twenty concurrent `select pg_sleep(3)` through
the image's own `PrismaClient`, counted in `pg_stat_activity` two seconds in: `with-limit: 4 connections
running pg_sleep`; the same with `connection_limit` cut from the URL: `without-limit: 9` (the host's
Docker VM reports eight CPUs on four physical cores, and Prisma counts physical cores: nine). The cap has the shape
any pool has: with four connections held for three seconds each, the burst finished `16 fulfilled 4
rejected P2024`, the four that waited past Prisma's 10 second `pool_timeout`. The tracker's queries take
milliseconds and it has one user, so this is a stated ceiling, not a finding; raise the limit (and the
role's, `ops/postgres.md` § The budget) if a job ever holds connections for seconds.

Also shown there: `docker rollout` rolled the profiled `tracker` service without `COMPOSE_PROFILES`
(compose enables a profiled service named on its command line), so § The sequence's later-rollout line
above holds as written. Everything was removed afterwards: every container with `-v`, the estate project
with `down -v`, both networks, the scratch directory; the two anonymous volumes the unfixed
`tracker-restore-verify.sh` left were removed by id, and the fixed script, re-run the same way against a
fresh migrated database, printed `migrations=11-applied-0-pending exit=0` and left `new dangling volumes: 0`.

### The sequence

**Preconditions**, each recorded before step 1:

- `ops/postgres.md` § The placement steps 1 to 5 (its Pending action 3): step 4 printed
  `cuatro_tracker cuatro_tracker 20`.
- `ops/postgres-backup.md` § Install and first run: the nightly dump takes every database on the estate
  instance, so `cuatro_tracker` is backed up from its first night (DW-301).
- For steps 12 and 13 only: `ops/traefik-cutover.md` § The sequence steps 1 to 8 and § Moving cuatro.dev
  and www (Story 4-6 creates the origin rules entrypoint this adds to), and the Origin Rules token.
  Steps 1 to 11 need neither.
- `main` carries Story 4-8's commit and its Deploy ran (Pending action 6). The Deploy rolls `anchor-app`
  alone, so the merge changes nothing about the running tracker; the bold note above holds from then on.
- The tracker's admin password is at hand, for the sign-in of step 11.

On the box as `deploy`:

```bash
cd /home/deploy/cuatro-portfolio
export HUB_TAG="$(git rev-parse HEAD)"
export TRACKER_TAG="$(docker ps --filter label=com.docker.compose.service=tracker --format '{{.Image}}' | cut -d: -f2)"
echo "$TRACKER_TAG"
C='docker compose --env-file .env.production'
SRC=cuatro-tracker-postgres-1; DST=postgres-estate-postgres-1
Q="select table_name||' '||(xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1"
install -d -m 700 /home/deploy/pg-move
```

`TRACKER_TAG` is the sha the running server already runs, so the move changes the database and nothing
else; `echo` prints one 40-character sha.

1. **Read what the move stands on, and stop at the first difference.**
   ```bash
   uptime
   docker ps -a --filter label=com.docker.compose.project=cuatro-portfolio --filter name=tracker --format '{{.Names}} {{.Status}}'
   docker exec "$SRC" psql -U tracker -d tracker -Atc "select count(*)||' '||max(migration_name) from _prisma_migrations where finished_at is not null and rolled_back_at is null"
   docker exec "$DST" psql -U cuatro_tracker -d cuatro_tracker -Atc "select count(*) from information_schema.tables where table_schema='public'"
   grep -c 'estate-postgres:5432/cuatro_tracker?connection_limit=4' docker-compose.yml
   docker rollout --version
   ```
   `cuatro-portfolio-tracker-<n>` healthy, `cuatro-portfolio-tracker-worker-1` up, and no exited `tracker`
   container (docker-rollout would replace a stopped one alone and roll nothing, `ops/deploy-remote.sh`); `11
   20260721120000_merge_suggestion_unique_pair`, or more if a later tracker release added migrations,
   which step 6 checks against this checkout; `0` tables in the target, so nothing is restored over
   anything; `2` (the server's URL, which the worker shares, and the migration's);
   `docker-rollout version v0.14`.
2. **Give the application its password**, copied without printing, once:
   ```bash
   grep -q '^CUATRO_TRACKER_DB_PASSWORD=' .env.production && echo "already set" || { echo; grep '^CUATRO_TRACKER_DB_PASSWORD=' ops/postgres/.env; } >> .env.production
   grep -c '^CUATRO_TRACKER_DB_PASSWORD=.' .env.production
   ```
   `1`. The leading `echo` keeps the line its own if the file ends without a newline. `TRACKER_DB_PASS`
   stays: the rollback reads it.
3. **Write the data rollback**, the two services' database as it is today:
   ```bash
   cat > /home/deploy/pg-move/tracker-rollback.yml <<'YAML'
   services:
     tracker:
       environment:
         - DATABASE_URL=postgresql://tracker:${TRACKER_DB_PASS-}@cuatro-tracker-postgres-1:5432/tracker
         - DB_PASS=${TRACKER_DB_PASS-}
     tracker-worker:
       environment:
         - DATABASE_URL=postgresql://tracker:${TRACKER_DB_PASS-}@cuatro-tracker-postgres-1:5432/tracker
         - DB_PASS=${TRACKER_DB_PASS-}
   YAML
   R="$C -f docker-compose.yml -f /home/deploy/pg-move/tracker-rollback.yml"
   $R --profile tracker config tracker | grep -c '@cuatro-tracker-postgres-1:5432/tracker'
   $R --profile tracker config tracker-worker | grep -c '@cuatro-tracker-postgres-1:5432/tracker'
   ```
   `1` and `1` (counts, so no password is printed). Compose merges the override's environment by name,
   and the services keep every other key of the committed file, `estate-postgres` included.
4. **Start the request loop, off the box, and leave it running to step 11.** From the workstation, the
   loop of § The sequence step 3 above, into `tracker-move-probe.log` in place of its file name.
5. **Freeze.** `$C --profile tracker stop tracker-worker; FROZE=$(date -u +%FT%TZ); echo "$FROZE"; uptime`.
   From here to step 11 the Operator writes nothing in the tracker; the server keeps serving reads.
6. **Back up and prove the restore before anything else changes:**
   ```bash
   docker volume ls -q -f dangling=true | wc -l
   bash ops/tracker-backup.sh
   TRACKER_DUMP=<the file= path it printed>
   bash ops/tracker-restore-verify.sh "$TRACKER_DUMP"
   docker volume ls -q -f dangling=true | wc -l
   ```
   Each script exits 0 and the verification ends `migrations=<n>-applied-0-pending exit=0`; the two
   volume counts are equal (the fixed script leaves none). Anything else: stop, and `$C --profile tracker start tracker-worker` (the stopped
   container, unchanged, on the old database). Copy the three files off the box from the workstation:
   `scp 'deploy@177.7.52.248:<the dump path>*' .`
7. **Restore that same proven dump** as `cuatro_tracker`:
   ```bash
   docker exec -i "$DST" pg_restore -U cuatro_tracker -d cuatro_tracker --no-owner --no-acl --exit-on-error < "$TRACKER_DUMP"; echo "exit=$?"
   ```
   `exit=0`. Anything else: stop, `$C --profile tracker start tracker-worker`, and bring the error back.
   The target is emptied for a retry with `dropdb` and the init script's three statements (`ops/postgres.md`
   § Moving a consumer, Rollback of one consumer), never by touching `$SRC`.
8. **Verify by counting**, against the live source and against the counts the backup wrote:
   ```bash
   diff <(docker exec "$SRC" psql -U tracker -d tracker -Atc "$Q") <(docker exec "$DST" psql -U cuatro_tracker -d cuatro_tracker -Atc "$Q") && echo counts-match
   diff <(tr '\t' ' ' < "$TRACKER_DUMP.counts") <(docker exec "$DST" psql -U cuatro_tracker -d cuatro_tracker -Atc "$Q") && echo counts-match-dump
   ```
   `counts-match` and `counts-match-dump`. Anything else: step 7's recovery.
9. **Migrate**, the discrete step: `$C --profile migrate run --rm tracker-migrate`. It prints
   `Datasource "db": PostgreSQL database "cuatro_tracker"` and `No pending migrations to apply.` Then
   `uptime`. `P1000` means step 2 did not take; any other failure: step 7's recovery.
10. **Roll the server, then the worker**, onto the new database:
    ```bash
    docker rollout --env-file .env.production --timeout 120 tracker
    N=$(docker ps -q --filter label=com.docker.compose.service=tracker)
    docker inspect -f '{{.Name}} {{.State.Health.Status}}' $N
    docker inspect $N --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -o '@[^/]*/[a-z_]*?connection_limit=4'
    $C --profile tracker up -d tracker-worker
    sleep 10; docker logs cuatro-portfolio-tracker-worker-1 --since 1m 2>&1 | grep -c worker.ready
    diff <(docker exec "$SRC" psql -U tracker -d tracker -Atc "$Q") <(tr '\t' ' ' < "$TRACKER_DUMP.counts") && echo old-unchanged
    uptime
    ```
    One container, numbered one higher, `healthy`; `@estate-postgres:5432/cuatro_tracker?connection_limit=4`
    (the host and database, never the password); `1`; `old-unchanged` (the old store took no write since
    the dump, so the move lost nothing). A rollout that fails removes the new container and leaves the old
    one serving: stop there, `$C --profile tracker start tracker-worker`, and bring the output back.
11. **Verify, still through Caddy.** Stop the loop and count:
    `awk '{print $2}' tracker-move-probe.log | sort | uniq -c` shows `200` alone. From the workstation,
    `curl -s https://tracker.cuatro.dev/api/ready` answers `"db":"ok"` and `"redis":"ok"`. In a browser,
    sign in at `https://tracker.cuatro.dev` and see the library as it was. The UptimeRobot monitor
    803750023 reads `UP`. The Operator may write in the tracker again from here.
12. **Move the hostname.** On the box first,
    `curl -sk -o /dev/null -w '%{http_code}\n' --resolve tracker.cuatro.dev:8443:127.0.0.1 https://tracker.cuatro.dev:8443/api/health`
    prints `200` (Traefik reaches `cuatro-app`). On the workstation, with `CF` defined as in
    `ops/traefik-cutover.md` § Moving cuatro.dev and www, start the loop again into
    `tracker-rule-probe.log` and leave it running to step 13, then add the rule to the ruleset Story 4-6
    created. If `RS` prints `none`, that section's step 3 says when the `PUT` that creates it is safe;
    never run it otherwise.
    ```bash
    RS=$(CF /phases/http_request_origin/entrypoint | jq -r 'select(.success) | .result.id'); echo "ruleset ${RS:-none}"
    [ -n "$RS" ] && CF "/$RS/rules" -X POST --data '{"description":"Story 4-8: tracker.cuatro.dev to Traefik on 8443","expression":"(http.host eq \"tracker.cuatro.dev\" and ssl)","action":"route","action_parameters":{"origin":{"port":8443}}}' | jq '.success, .errors'
    ```
    `true` and `[]`. After about a minute,
    `curl -sI "https://tracker.cuatro.dev/api/health?v=$(date +%s)" | grep -iE '^(HTTP|via)'` answers 200
    with **no `via: 1.1 Caddy` line**; on the box, `uptime`.
13. **Stop the loop and count**: `awk '{print $2}' tracker-rule-probe.log | sort | uniq -c` shows `200`
    alone. Sign in again through the new path; after one five-minute interval, 803750023 reads `UP`.
    `uptime`.
14. **Record** under an "Estate Postgres move run" heading here: the date, step 1's readings, `FROZE`,
    step 6's two summary lines and volume counts, step 7's exit, step 8's two lines, step 9's output,
    step 10's container, URL host and `old-unchanged`, both probes' counts, the rule id
    (`CF "/$RS" | jq '.result.rules[] | {id, description}'`), and each `uptime`.
    `ops/routing-inventory.md` § Ingress and `ops/estate.md` each take a dated amendment:
    `tracker.cuatro.dev` served by Traefik through an Origin Rule, the tracker's data in `cuatro_tracker`
    on `estate-postgres`; Caddy's block and `cuatro-tracker-postgres-1` remain, unreached, until Story
    4.11. Keep `$TRACKER_DUMP` and its two files until Story 4.11.

**Rollback, at any step, the hostname first:**

- **R1, the hostname**: delete the rule. It takes effect at the edge; step 12's `curl -sI` shows
  `via: 1.1 Caddy` again, and Caddy proxies the same `cuatro-app`.
  ```bash
  RS=$(CF /phases/http_request_origin/entrypoint | jq -r 'select(.success) | .result.id')
  ID=$(CF "/$RS" | jq -r '.result.rules[] | select(.description == "Story 4-8: tracker.cuatro.dev to Traefik on 8443") | .id')
  echo "rule ${ID:-not found}"; [ -n "$RS" ] && [ -n "$ID" ] && CF "/$RS/rules/$ID" -X DELETE | jq '.success'
  ```
- **R2, the data**, after step 10: first dump what the estate database holds, so a retry's emptying
  never destroys the only copy of a row written since the switch:
  `docker exec "$DST" pg_dump -U cuatro_tracker -Fc cuatro_tracker > /home/deploy/pg-move/cuatro_tracker-after-r2.dump; echo "exit=$?"`,
  `exit=0`, kept until Story 4.11. Then
  `docker rollout --env-file .env.production -f docker-compose.yml -f /home/deploy/pg-move/tracker-rollback.yml --timeout 120 tracker`
  and `$R --profile tracker up -d tracker-worker` (with `C` and `R` set as above), as rehearsed. The
  server and worker return to `cuatro-tracker-postgres-1`, which took no write after the freeze, so they
  serve exactly what it held then. Rows the Operator wrote after step 11 stay in the estate database and
  in that dump, not in the old one: carry any that matter back by hand from the dump. Until the retry,
  every tracker `up` or rollout runs through `$R`.
- **Before step 10**: `$C --profile tracker start tracker-worker`. Nothing else moved.
- **Never** `down -v`, `dropdb` or any write against `$SRC`, never `down` the `cuatro-tracker` project
  (its Redis and qBittorrent still serve the tracker), and never delete a dump before Story 4.11.

**Later rollouts** after the move take the commands of § The sequence above: `tracker-migrate` now
migrates `cuatro_tracker`, and `docker rollout ... tracker` rolls onto it.

### Estate Postgres move run, 2026-09-30

**Observed from 2026-09-30T23:53Z to 2026-10-01T00:02Z on the box as `deploy`, run by the orchestrator
with the Operator present; the Operator did the browser steps.** Preconditions, each recorded:
`ops/postgres.md` § Placement run, 2026-09-30 (step 4 printed `cuatro_tracker cuatro_tracker 20`);
`ops/postgres-backup.md` § First run; `ops/traefik-cutover.md` § Cutover run and § Cutover run, cuatro.dev
and www; `main` at `f9ea578` carrying Story 4-8's commits (`30aa927`, `e6ad48a`, `6dcb2bc`), Deploy run
36779534561; the Origin Rules token on the workstation. `jq` is not in the workstation's Git Bash, so
`node` parsed the JSON of steps 12 and 14.

- **Step 1**, 23:53:55Z: `HUB_TAG=f9ea578`, `TRACKER_TAG=5117673f3834f9368eecd7fe459bc0ca4ddd5b3c` (40
  characters, the running server's sha); load average `0.10, 0.29, 0.30`. `cuatro-portfolio-tracker-1 Up 27
  hours (healthy)`, `cuatro-portfolio-tracker-worker-1 Up 27 hours`, no exited `tracker` container; the
  source's migrations `11 20260721120000_merge_suggestion_unique_pair`; `0` public tables in the target; the
  compose grep counted `2`; `docker-rollout version v0.14`. The source database 8015 kB;
  `CUATRO_TRACKER_DB_PASSWORD` not yet in `.env.production`, `TRACKER_DB_PASS` present. Two dangling
  volumes: `7f76c782d62d50edfde41eb55b62230c267075761cfe4445f2e1e7e04d93bdb3` (created 2026-09-29T21:05:53Z,
  no container, `PG_VERSION` 16) and `4fc208dc72207d649d6ae09d4d7cfbc374dca965787537f1cc5869ad92953a49`
  (created 2026-09-30T08:04:07Z, no container, `PG_VERSION` 17, DW-307's, left alone). From the
  workstation: `/api/health` 200, `/api/ready` `{"status":"ok","db":"ok","redis":"ok"}`.
- **Pending action 7**, before step 2: the volume `7f76c782...` read as above (no container, `PG_VERSION`
  16) and was removed; `docker volume ls` no longer lists it.
- **Step 2**: `CUATRO_TRACKER_DB_PASSWORD` appended to `.env.production` without printing, count `1`.
- **Step 3**: `/home/deploy/pg-move/tracker-rollback.yml` written; the two counts `1` and `1`.
- **Step 4**: the request loop ran on the workstation from 23:54:54Z to 23:56:35Z, 70 lines.
- **Step 5**: `tracker-worker` stopped, **`FROZE=2026-09-30T23:54:51Z`**; load average `0.36, 0.31, 0.31`.
  The Operator wrote nothing in the tracker during the window.
- **Step 6**: dangling volumes before `1` (DW-307's). `ops/tracker-backup.sh`:
  `tracker-backup file=/home/deploy/backups/cuatro-tracker/tracker-20260930T235451Z.dump dump=ok list=ok
  tables=9 rows=12 bytes=22310 sha256=6e82df4ccb731bbecce7cb8029048737f37f5f77c0db3fcc3fabb299859dfec3
  exit=0`. `ops/tracker-restore-verify.sh`: `tracker-restore-verify sha256=match restore=ok tables=9
  rows=12 migrations=11-applied-0-pending exit=0`. Dangling volumes after `1`, unchanged. The three files
  were copied to the workstation by `scp`, and the dump's sha256 matched there.
- **Step 7**: `pg_restore` `exit=0`.
- **Step 8**: `counts-match` and `counts-match-dump`.
- **Step 9**: `tracker-migrate` printed `Datasource "db": PostgreSQL database "cuatro_tracker", schema
  "public" at "estate-postgres:5432"` and `No pending migrations to apply.`, exit 0; load average `0.41,
  0.33, 0.31` at 23:54:58Z.
- **Step 10 started about a minute late, an orchestration fault and not a runbook defect.** The script was
  piped into `ssh` over stdin, where `docker rollout` would have read the script's remaining lines as its
  own input, so step 10 was run from a file on the box at 23:55:3xZ. The server kept serving on the old
  database meanwhile, and the worker stayed stopped.
- **Step 10**: `docker rollout --env-file .env.production --timeout 120 tracker` exit 0 ("Stopping and
  removing old containers"); the new container `/cuatro-portfolio-tracker-2` `healthy`, its environment
  `@estate-postgres:5432/cuatro_tracker?connection_limit=4`. `tracker-worker` started, `worker.ready` count
  `1`, its environment the same `@estate-postgres:5432/cuatro_tracker?connection_limit=4`. `old-unchanged`
  (the old store equals the dump's counts). At 23:55:55Z: `tracker-worker-1 Up 10 seconds`, `tracker-2 Up
  16 seconds (healthy)`; load average `0.77, 0.42, 0.35`.
- **Step 11**, 23:56:56Z: the 70 probe lines counted `200` alone. `/api/ready` answered 200 with `db ok`
  and `redis ok`, `via: 1.1 Caddy`. The monitor 803750023 read `UP` (45d 13h, no incident). The Operator
  signed in at `https://tracker.cuatro.dev` and saw the library, and observed that the sign-in accepted
  any password (DW-311; nothing in this move touches authentication).
- **Step 12**, 00:00:05Z on 2026-10-01: Traefik on 8443 answered `/api/health` 200; load average `0.17,
  0.32, 0.33`. The request loop ran from 00:00:16Z to 00:02:14Z, 80 lines. The rule was added to ruleset
  `518ad07108bc402fa36ad71fe1e76862` at **`MOVED=2026-10-01T00:00:30Z`**: rule
  **`1ee043e45b2d46619c9881d2ae005902`**, "Story 4-8: tracker.cuatro.dev to Traefik on 8443", `true` and
  `[]`. The ruleset then held five rules: wheel, www, apex, analytics and tracker. At 00:00:50Z:
  `/api/health` `HEAD` 200 with no `via` line, `/api/ready` 200 with `db ok` and `redis ok` and no `via`
  line, `/` 307 to `/login?callbackUrl=%2F` with no `via` line. On the box at 00:00:46Z: load average
  `0.13, 0.29, 0.32`, and Traefik's `ESTABLISHED` count 11.
- **Step 13**, 00:02:35Z: the 80 probe lines counted `200` alone. The monitor 803750023's reading after a
  full interval on the new path is to be confirmed.

Rollbacks R1 and R2 were not needed and not run. `/home/deploy/pg-move` holds `tracker-rollback.yml`,
`TRACKER_FROZE`, `TRACKER_DUMP`, `tracker-backup.out`, `tracker-verify.out`, `tracker-migrate.log` and
`tracker-rollout.log`; the dump and its two files stay in `/home/deploy/backups/cuatro-tracker/` until
Story 4.11. Redis and qBittorrent stay in the `cuatro-tracker` project (DW-306), and
`cuatro-tracker-postgres-1` and Caddy's `tracker.cuatro.dev` block remain, unreached, until Story 4.11.

## Pending Operator actions

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| 1 | **Let the box pull `ghcr.io/luigiespinosa/tracker`.** Make the package public, as `hub` is, or log `deploy` in to GHCR with a `read:packages` token | A new package is private. Changing its visibility or creating a token is the Operator's. Made public by the Operator, with the finance, tournament and tournament-worker packages; an anonymous manifest pull of `tracker:2dfc099...` answered 200 | 2026-09-29 |
| 2 | **Merge Epic 3 into `main`** and let the deploy run | The compose services and both scripts reach the box only this way. PR #84 merged as `5117673`; the dispatch run 36627964371 was the deploy that put the checkout and the scripts on the box (`ops/contract-serving.md` action 11) | 2026-09-29T20:41:37Z |
| 3 | **Run steps 1 to 8 above**, on a day the Operator can watch the probe | Step 2's two exit codes and summary lines, step 7's count and step 1's two files go into this record. Done: § Cutover run | 2026-09-29T21:34:15Z |
| 4 | **Archive `cuatro-tracker`** once action 3 has held for a week | DW-285 then writes `absorbed_into` and moves `source` to the Anchor (AD-6); Story 3.8 left it there, no source repository being archived on 2026-09-29. The box's `/home/deploy/cuatro-tracker` checkout stays: it runs the stores until Story 4.8. **Operator ruling 2026-09-29:** archived the same evening rather than a week later, the Operator judging the week unnecessary because the rollback reads nothing from GitHub (the old project's checkout and images stay on the box) and an archive is reversible; `gh repo archive`, kept public, the new containers healthy 45 minutes after the switch. DW-285 then wrote `absorbed_into: cuatro-portfolio` and moved `source` to `https://github.com/LuigiEspinosa/cuatro-portfolio/tree/main/apps/tracker` in Registry 1.6.0 the same day | 2026-09-29T21:53:16Z |
| 5 | **Confirm or overrule Story 4-8's decisions** in § Moving the database onto the estate Postgres: Redis and qBittorrent staying in the old project (DW-306), the worker-only freeze with the Operator writing nothing for the window, the move by `docker rollout`, data before hostname, the override-file rollback, rows written after step 11 not carried back by R2 (kept in `cuatro_tracker-after-r2.dump`), `connection_limit=4`, this record | The Story 4-8 spec's Design Notes carry the reasoning. The Operator was present for the move on 2026-09-30 and overruled nothing; an explicit word is awaited, so the row stays open | _not done_ |
| 6 | **Merge the commit carrying Story 4-8 into `main`** and let the Deploy run | It rolls the Hub alone. From then until § Moving the database step 10, no tracker `up` or rollout from the plain file (the bold note in that section). PR #88 merged as `f9ea578`, and Deploy run 36779534561 ran | 2026-09-30T21:27Z |
| 7 | **Remove the restored copy the 2026-09-29 verification left**: the dangling volume `7f76c782d62d50edfde41eb55b62230c267075761cfe4445f2e1e7e04d93bdb3`, created 2026-09-29T21:05:53Z | Read first: `docker ps -a --filter volume=7f76c782d62d50edfde41eb55b62230c267075761cfe4445f2e1e7e04d93bdb3` prints no container, and `docker run --rm -v 7f76c782d62d50edfde41eb55b62230c267075761cfe4445f2e1e7e04d93bdb3:/v:ro alpine ls /v` lists a Postgres data directory. Then `docker volume rm 7f76c782d62d50edfde41eb55b62230c267075761cfe4445f2e1e7e04d93bdb3`. A copy of a restore, never the only copy: the live database and the dump stay. Done before step 2 of § Estate Postgres move run, 2026-09-30 | 2026-09-30 |
| 8 | **Run § Moving the database onto the estate Postgres, steps 1 to 14**, after `ops/postgres.md` action 3 and `ops/postgres-backup.md` § Install and first run; steps 12 and 13 also after `ops/traefik-cutover.md` actions 4 and 6 and the origin rules token | Step 14 amends `ops/routing-inventory.md` and `ops/estate.md`. Done: § Estate Postgres move run, 2026-09-30, ending 2026-10-01T00:02Z | 2026-09-30 |

**Maintaining this file.** When an action is performed, replace its cell with the ISO 8601 UTC date and
leave the row in place.
