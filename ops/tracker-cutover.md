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

## Pending Operator actions

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| 1 | **Let the box pull `ghcr.io/luigiespinosa/tracker`.** Make the package public, as `hub` is, or log `deploy` in to GHCR with a `read:packages` token | A new package is private. Changing its visibility or creating a token is the Operator's | _not done_ |
| 2 | **Merge Epic 3 into `main`** and let the deploy run | The compose services and both scripts reach the box only this way | _not done_ |
| 3 | **Run steps 1 to 8 above**, on a day the Operator can watch the probe | Step 2's two exit codes and summary lines, step 7's count and step 1's two files go into this record | _not done_ |
| 4 | **Archive `cuatro-tracker`** once action 3 has held for a week | Story 3.8 then writes `absorbed_into` and moves `source` to the Anchor (AD-6). The box's `/home/deploy/cuatro-tracker` checkout stays: it runs the stores until Story 4.8 | _not done_ |

**Maintaining this file.** When an action is performed, replace its cell with the ISO 8601 UTC date and
leave the row in place.
