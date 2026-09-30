# The cs-tracker move

How `cs-tracker.cuatro.dev` moves its data from `cs-tracker-db-1` onto the estate's one Postgres and its
traffic from the shared Caddy onto Traefik, without going dark, and how to take each back. It is the
artifact Story 4-10 delivers under AD-10 and AD-23, on the stacks Stories 4-2 and 4-4 wrote, in the
shape `ops/tracker-cutover.md` set.

This file is a record, not Registry data. Every value is marked as a decision or an observation, and
the two are never presented as the same kind of fact (NFR-9). Times are UTC.

**Why a new record here.** This repository holds every cutover record (`ops/tracker-cutover.md`,
`ops/tournament-placement.md`, `ops/traefik-cutover.md`), and the one record about `cs-tracker` it
already has, `ops/cs-tracker-token-adoption.md`, is about the token contract, not about how the
application runs. `cs-tracker`'s own `docs/deployment.md` describes its stack before the move; the
change below points it here.

**Nothing here has run on the box. Written 2026-09-30, committed on `dev`.** The authoring session read
the box but wrote nothing to it, and wrote nothing to `LuigiEspinosa/cs-tracker`: the change that
repository needs is § The cs-tracker change, for the Operator to land. Every box step is a Pending
Operator action at the end.

## What serves it today

**Observed 2026-09-30 between 18:05Z and 18:10Z, read-only, over SSH as `deploy`** (`docker ps`,
`docker inspect`, `git` and `md5sum` in the checkout, variable names of `.env` without values, `psql`
counts inside the container, `crontab -l`):

| Fact | Value |
|---|---|
| Project | `/home/deploy/cs-tracker`, a clone of `LuigiEspinosa/cs-tracker` at `2519fe379251e0e4d8c1a4ae2e8ddfb028fc49b8`, equal to `main`; `docker-compose.yml` md5 `5884e219bfdd9cb607ac3a8ce4e1943a` on the box and on `main`; ` M Caddyfile` and six `Caddyfile.bak-*` untracked, as `ops/routing-inventory.md` explains |
| Containers | `cs-tracker-app-1` (`cs-tracker:latest`, built on the box, up 5 days, no healthcheck, `unless-stopped`, on `cs-tracker_default` only), `cs-tracker-db-1` (`postgres:16`, healthy), `cs-tracker-migrate-1` (exited 0, 5 days ago), `cs-tracker-caddy-1` (the shared ingress for every hostname) |
| Database | Postgres 16.14, database `cs_tracker_prod`, role `postgres` (the only role, superuser), 37 MB, extensions `pg_trgm` 1.6 and `plpgsql` |
| Schema | 10 migrations, the last `20260622181145` |
| Rows | `catalog_sync_state 1`, `inventory_entries 113`, `items 1974`, `oban_jobs 30002`, `oban_peers 1`, `ownership_marks 0`, `price_snapshots 21119`, `schema_migrations 10`, `steam_rate_limit_state 1`, `wishlist_entries 0` |
| Writes | `price_snapshots` last took a row 2026-08-27T22:35:01; `oban_jobs` took one at 18:05:00, the minute of the reading (Oban's cron: the price refresh scheduler every few minutes, the catalog sync at 03:00) |
| Connections | 12 to `cs_tracker_prod` at that instant: the app's pool of 10, Oban's notifier and the reading's own `psql` |
| `.env` | names `ACME_EMAIL BITSKINS_API_KEY BREAKER_WINDOW_HOURS CSFLOAT_API_KEY DATABASE_URL DMARKET_API_KEY KILL_SWITCH PHX_HOST POSTGRES_DB POSTGRES_PASSWORD POSTGRES_USER PRICE_SOURCES_ENABLED SECRET_KEY_BASE SKINPORT_API_KEY STEAM_ID`; **no `POOL_SIZE`**, so the release's default of 10 applies (`config/runtime.exs:208`) |
| Backup | **None.** No cron entry names this database (`crontab -l` lists the tracker's, the library's and the tournament's) |
| Box | load 0.12, 0.13, 0.15; 5488 MB of memory available; 77 GB free; `docker rollout` v0.14 installed |

From the workstation at 18:09:15Z, through Cloudflare: `/` answers `302` to `/auth/steam` with
`via: 1.1 Caddy`; `/auth/steam` answers `302` to `steamcommunity.com/openid/login`; the LiveView socket,
`GET /live/websocket?vsn=2.0.0` with an upgrade and `Origin: https://cs-tracker.cuatro.dev`, answers
`101`; `/assets/css/app.css` answers `200 text/css` with 12 distinct `--token-*` roles, sha256
`1fa1740f30a65d4c961c39daaba43bc68e7d5f81c4b62d4edf1ccd0d30b6dcf5`.

**How it migrates today.** Nothing in the release migrates on start: `bin/server` runs
`PHX_SERVER=true ./cs_tracker start`, and `bin/migrate` runs `CsTracker.Release.migrate`. But compose
gives `app` a `depends_on` on `migrate` (`service_completed_successfully`), so every `up` of `app`, and
the `up --scale` a `docker rollout` runs, starts the migration first. That coupling is what AD-23
forbids, and § The cs-tracker change removes it.

## What the move changes, and what it leaves alone

| Changes | Stays |
|---|---|
| `cs-tracker`'s data, into database `cs_tracker` on `estate-postgres` (role `cs_tracker`, limit 25, `ops/postgres.md` § The budget) | `cs-tracker-db-1`, `cs-tracker_pgdata` and every dump, untouched until Story 4.11: the rollback |
| `DATABASE_URL` in `/home/deploy/cs-tracker/.env`, and `POOL_SIZE=10` written there explicitly | Every other `.env` value, `PHX_HOST` included, which Caddy's site label also reads |
| `cs-tracker`'s compose: `migrate` under a profile, no `depends_on` on `app`, both on `estate-postgres` | The image `cs-tracker:latest`, still built on the box (AD-8, observed and not ruled, `ops/known-violations.md` KV-1 scope) |
| `cs-tracker.cuatro.dev` reaches Traefik on 8443 through its own Origin Rule | **Caddy, `cs-tracker-caddy-1`, up in the `cs-tracker` project**: it still serves every hostname that has not moved, and keeps this one's block, unreached, until Story 4.11 |
| Traefik's `cs-tracker` router gains one middleware, `forwarded-proto-https` (below) | No security headers on this hostname, as Caddy's block sends none |

**The router was wrong, and the rehearsal found it.** Traefik forwards a WebSocket upgrade with
`X-Forwarded-Proto: wss`; Caddy forwards `https`. `cs-tracker`'s Plug.SSL trusts that header
(`config/prod.exs`, `force_ssl: [rewrite_on: [:x_forwarded_proto]]`) and reads only `https` as secure,
so through the router as Story 4-2 wrote it the LiveView socket was answered
`301 Location: https://cs-tracker.cuatro.dev/live/websocket?vsn=2.0.0` while `/` answered its `302`:
every page would have rendered and none would have gone live. The router now sets the header to `https`
(`ops/traefik/dynamic/routes.yml`, held by `ops/__tests__/traefik-config.test.ts`), and the socket
answers `101`. Setting it is truthful, since `websecure` is TLS only, and a client cannot forge it:
Traefik already drops an incoming `X-Forwarded-Proto` from an untrusted peer (a request carrying
`X-Forwarded-Proto: http` still answered `302`). The middleware is on this router alone; whether another upstream reads
the header on an upgrade was not examined here (DW-309).

**Connections, measured.** One app container holds 11 connections: the Ecto pool of 10 and Oban's
notifier. During this move's rollout the new container is on the estate and the old one is not, so the
role peaks at 11. A later rollout on the estate overlaps two containers, 22; the migrator
(`Ecto.Migrator.with_repo`, whose documented default pool is 2) runs before it, beside one container,
13. Each `psql -U cs_tracker` (the runbook's `NEWQ`) takes one more while it runs, so 23 at the worst of
25; a `psql -U postgres` is not counted against the role (a superuser is exempt from both limits).

## The cs-tracker change

For the Operator to land in `LuigiEspinosa/cs-tracker` on `main` (Pending action 2), with the subject
`chore: migrate as a discrete step and join estate-postgres for the estate Postgres move`. It applies to
`2519fe3` with `git apply` (checked 2026-09-30 against an export of that commit; sha256 of the patch as
written below, LF endings, `58cadec9c03b9ddc067d5254cadb38dfeb1933f5e1fab77cd1b8c7b29955ede7`). Only
comments differ from the file the rehearsal ran.

```diff
diff --git a/docker-compose.yml b/docker-compose.yml
index 631332f..9c5afe7 100644
--- a/docker-compose.yml
+++ b/docker-compose.yml
@@ -2,17 +2,25 @@
 #
 # One command brings up the whole thing:  docker compose up -d
 #
-# ⚠️ REDEPLOY: `up -d` reuses the existing `cs-tracker:latest` image — after a
-#   code change it ships STALE code and skips new migrations with no warning.
-#   Rebuild first on any code change:  docker compose up -d --build
-#   (or `docker compose build` then `up -d`). Bare `up -d` is correct only when
-#   the image is unchanged.
+# REDEPLOY (since the estate Postgres move, cuatro-portfolio Story 4-10): migrations are
+#   a discrete step before the rollout (AD-23), never part of `up`. After a code change:
+#     docker compose build app
+#     docker compose run --rm migrate
+#     docker rollout -w 20 app
+#   `up` no longer runs `migrate`, so a bare `up -d --build` ships new code on an
+#   unmigrated schema. The procedure and its rollback: cuatro-portfolio's
+#   ops/cs-tracker-cutover.md.
 #
 # Services:
-#   db      — PostgreSQL 16, internal-only, named volume for persistence.
-#   migrate — one-shot: runs bin/migrate (idempotent) then exits 0.
-#   app     — the Story-8.3 release image; internal-only at app:4000.
-#   caddy   — the ONLY service that publishes ports (80/443); terminates TLS.
+#   db:      PostgreSQL 16, internal-only, named volume for persistence. Since
+#            Story 4-10 nothing reads it: it is the rollback copy, kept until
+#            Story 4-11 retires it. The data lives in database `cs_tracker` on
+#            `estate-postgres`, the estate's one Postgres (cuatro-portfolio
+#            ops/postgres.md), reached over the external network of that name.
+#   migrate: one-shot under the `migrate` profile: runs bin/migrate (idempotent)
+#            then exits 0. Run by hand before each rollout, never by `up`.
+#   app:     the Story-8.3 release image; internal-only at app:4000.
+#   caddy:   the ONLY service that publishes ports (80/443); terminates TLS.
 #
 # 🚨 SECURITY INVARIANT (Story 8.4 §Disaster #1):
 #   NEVER add a `ports:` mapping to `app` or `db`. config/prod.exs trusts
@@ -49,12 +57,10 @@ services:
       start_period: 30s
     # 🚨 NO `ports:` — the DB is reachable only on the internal network at db:5432.
 
-  # First-run (and every-boot) migration. Idempotent: runs `up` migrations and
-  # no-ops once applied, then exits. `app` waits on its successful completion.
-  # The migration role is POSTGRES_USER (a superuser owning POSTGRES_DB), so the
-  # first statement `CREATE EXTENSION pg_trgm` succeeds (Story 8.4 §Disaster #2).
-  # Manual alternative for operators who prefer explicit migration:
-  #   docker compose run --rm app /app/bin/migrate
+  # The discrete migration step (AD-23): `docker compose run --rm migrate`, before
+  # a rollout. Idempotent: runs `up` migrations and no-ops once applied. The role
+  # is `cs_tracker`, the owner of its database; `pg_trgm` is a trusted extension,
+  # so the owner may create it without a superuser.
   migrate:
     build:
       context: .
@@ -62,9 +68,8 @@ services:
     env_file: .env
     command: ["/app/bin/migrate"]
     restart: "no"
-    depends_on:
-      db:
-        condition: service_healthy
+    profiles: ["migrate"]
+    networks: [default, estate-postgres]
     # 🚨 NO `ports:` — internal-only.
 
   app:
@@ -73,9 +78,9 @@ services:
     image: cs-tracker:latest
     env_file: .env
     restart: unless-stopped
-    depends_on:
-      migrate:
-        condition: service_completed_successfully
+    # No `depends_on: migrate`: a server never migrates on start (AD-23). The
+    # pool is POOL_SIZE in .env (10), inside the role's connection limit of 25.
+    networks: [default, estate-postgres]
     # 🚨 NO `ports:` — reachable ONLY at app:4000 on the internal network.
     #    Do NOT set PHX_SERVER/PORT: bin/server sets PHX_SERVER=true and PORT
     #    defaults to 4000. A bare PORT= would crash the release at boot
@@ -101,6 +106,11 @@ services:
     depends_on:
       - app
 
+networks:
+  # Created by cuatro-portfolio's ops/postgres/compose.yml; start that first.
+  estate-postgres:
+    external: true
+
 volumes:
   pgdata:
   caddy_data:
diff --git a/docs/deployment.md b/docs/deployment.md
index b5eda5b..7663510 100644
--- a/docs/deployment.md
+++ b/docs/deployment.md
@@ -4,6 +4,14 @@ Step-by-step guide to stand up cs-tracker on a Hostinger VPS and to run,
 re-deploy, and maintain it. Written so the Owner (or Backup) can execute it
 without prior context.
 
+> **Since the estate Postgres move (cuatro-portfolio Story 4-10), parts of this runbook describe
+> the stack before it.** The data is in database `cs_tracker` on `estate-postgres`, the estate's one
+> Postgres; `DATABASE_URL` names role `cs_tracker` on that host, and `POOL_SIZE=10` is set in `.env`.
+> `migrate` runs only as `docker compose run --rm migrate`, never from `up`. Redeploy is
+> `docker compose build app`, then `docker compose run --rm migrate`, then `docker rollout -w 20 app`.
+> The `db` service is the rollback copy until the old topology is retired. The move and its rollback
+> are in cuatro-portfolio's `ops/cs-tracker-cutover.md`.
+
 ## What this deploys
 
 A single self-contained Docker Compose stack, fronted by Caddy for HTTPS:
```

The removed and context lines are `cs-tracker`'s own text, quoted exactly so the patch applies, its
dashes and emoji included; the added lines carry none. `cs-tracker`
has no CI and no deploy on push (DW-14), so landing it changes nothing running; the box takes it at
step 2 below, after `ops/postgres.md`'s placement. Before that placement the network `estate-postgres`
does not exist, and any compose command that creates an `app` container refuses with
`network estate-postgres declared as external, but could not be found` (seen in the rehearsal before its
estate instance was up); the running container is untouched either way. After the placement, the
patched file with the old `.env` serves the old database (the rehearsal's R2 is exactly that state).

## Rehearsed off the box

**Observed 2026-09-30 between 18:22:14Z and 18:23:51Z on the authoring machine** (Windows 11, Docker
29.8.1), with throwaway values throughout and everything removed afterwards (`docker ps -a`,
`docker volume ls` and `docker network ls` list nothing of it). The pieces:

- `cs-tracker:p410`, built locally from `git archive 2519fe379251e0e4d8c1a4ae2e8ddfb028fc49b8` of the
  local `cs-tracker` checkout, the box's commit, by its own `Dockerfile` (exit 0).
- Project `cs-tracker` in a scratch directory, first from `main`'s `docker-compose.yml`, then from the
  patched one, each with a one-service override naming `cs-tracker:p410` in place of the local
  `cs-tracker:latest`, and a throwaway `.env` shaped like the box's (`postgres` role, `cs_tracker_prod`,
  `KILL_SWITCH=true` so no outbound call left the host). `db` on `postgres:16`, the box's image.
- `main`'s compose brought up `db` and `app`: `migrate` ran all 10 migrations first, as it does on the
  box, and the app booted (`Running CsTrackerWeb.Endpoint with Bandit 1.11.1 at :::4000`) holding 11
  connections. Then synthetic rows in the box's counts: 1974 items, 21119 price snapshots, 113
  inventory entries, one sync state, 3000 completed Oban jobs.
- `ops/postgres/compose.yml` and its init as committed, project `p410pg`, throwaway `ops/postgres/.env`.
- `ops/traefik/` as committed, with the stand-in origin pair, `.env` and offline override of
  `ops/traefik-cutover.md` § Rehearsed off the box.
- `docker-rollout` v0.14 (sha256 `cdeaba6a...`, `ops/deploy-remote.sh`'s pin) as the CLI plugin in a
  `docker:29-cli` container on the host's socket.
- A request loop through Traefik every 0.2 s, `GET /` with `--resolve cs-tracker.cuatro.dev:8443:127.0.0.1`.

The run, verbatim but for the long container ids each `docker rollout` prints and the trailing blanks
of compose's lines; its `.env` edit is step 7's, command for command:

```
## estate Postgres (ops/postgres/compose.yml, project p410pg)
 Container p410pg-estate-postgres-1 Healthy
cs_tracker cs_tracker 25
## Traefik (ops/traefik/, stand-in origin pair)
 Container traefik-traefik-1 Healthy
## through Traefik, before
/ 302 Location: /auth/steam
live socket 101
stylesheet: 12 token roles
estate, role cs_tracker: 0
old, cs_tracker_prod: 11
## dump
exit=0 bytes=219145
## target empty
0
## restore as cs_tracker
exit=0
## counts, every table but Oban's (the source's lines joined; then the diff)
catalog_sync_state 1 inventory_entries 113 items 1974 ownership_marks 0 price_snapshots 21119 schema_migrations 10 steam_rate_limit_state 1 wishlist_entries 0
counts-match
## Oban tables (source; target)
oban_jobs 3001 oban_peers 1 ; oban_jobs 3001 oban_peers 1
## owners and extension
relations in public not owned by cs_tracker: 0
extension pg_trgm 1.6, owner cs_tracker
server 18.6 (Debian 18.6-1.pgdg13+2)
## the new compose and .env
1
1
services up would start: app caddy db
app networks: default estate-postgres
app depends_on lines: 0
## migrate, the discrete step
exit=0
18:22:43.289 [info] Migrations already up
estate, role cs_tracker: 0
old, cs_tracker_prod: 11
## rollout onto the estate database
 Container cs-tracker-app-4 Starting
 Container cs-tracker-app-4 Started
==> Waiting for new containers to be ready (20 seconds)
==> Stopping and removing old containers
cs-tracker-app-4 Up 22 seconds
cs-tracker-db-1 Up 8 minutes (healthy)
cs-tracker-migrate-1 Exited (0) 8 minutes ago
/cs-tracker-app-4
@estate-postgres:5432/cs_tracker
POOL_SIZE=10
estate, role cs_tracker: 11
old, cs_tracker_prod: 0
## the old store took nothing but Oban since the dump
old-unchanged
## through Traefik, after
/ 302 Location: /auth/steam
live socket 101
app log lines naming an error: 0
## R2: back onto the old database
exit=0
/cs-tracker-app-5
@db/cs_tracker_prod
estate, role cs_tracker: 0
old, cs_tracker_prod: 11
/ 302 Location: /auth/steam
## request loop, 18:22:35 to 18:23:51
    213 302
```

What it shows: a Postgres 16 dump of the real schema restores into 18.6 as `cs_tracker` with exit 0,
every non-Oban count equal, every relation owned by `cs_tracker`, and `pg_trgm` created by the owner
without a superuser; the migration is a no-op there; `up` would no longer start `migrate`; `docker
rollout` moves the app onto the estate and back with every one of 213 requests answered `302`; the app
holds 11 connections wherever it is. The app numbers climb (`app-4`, `app-5`) because an earlier run in
the same session had rolled twice. The Oban counts matched only because no job fell between the dump and
the count; on the box one may, which is why they are left out of the comparison (Design decision 1).

An earlier run the same session, through the router as Story 4-2 committed it, answered `live socket
301` before and after the move, which is the finding in § What the move changes. `docker rollout`
without the compose change was not rehearsed; by `depends_on` it is expected to start `migrate` from its
existing container, whose configuration is the old one.

## The sequence

**Preconditions**, each recorded before step 1:

- `ops/postgres.md` § The placement steps 1 to 5 (its Pending action 3): step 4 printed
  `cs_tracker cs_tracker 25`, and the network `estate-postgres` exists.
- `ops/postgres-backup.md` § Install and first run: the nightly dump takes every database on the estate
  instance, so `cs_tracker` is backed up from its first night (DW-301). Until this move nothing backs up
  `cs-tracker`'s data at all; step 4's dump, copied off the box, is its first backup.
- § The cs-tracker change landed on `cs-tracker`'s `main` (Pending action 2).
- For steps 11 and 12 only: `ops/traefik-cutover.md` § The sequence steps 1 to 8 and § Moving cuatro.dev
  and www (Story 4-6 creates the origin rules entrypoint this adds to), the Origin Rules token, and
  `main` carrying Story 4-10's commit with a Deploy run since, so the box's `ops/traefik/dynamic/routes.yml`
  has the `forwarded-proto-https` middleware (Pending action 3). Steps 1 to 10 need none of these.
- Not between 02:45 and 03:15 UTC: the daily catalog sync writes `items` at 03:00.
- The Steam account on the `STEAM_ID` allowlist at hand, for the sign-ins of steps 10 and 12.

On the box as `deploy`:

```bash
cd /home/deploy/cs-tracker
SRC=cs-tracker-db-1; DST=postgres-estate-postgres-1
Q="select table_name||' '||(xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name not like 'oban\_%' order by 1"
OLDQ() { docker exec "$SRC" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$1"' _ "$1"; }
NEWQ() { docker exec "$DST" psql -U cs_tracker -d cs_tracker -Atc "$1"; }
conns() { docker exec "$DST" psql -U postgres -Atc "select 'estate '||count(*) from pg_stat_activity where usename='cs_tracker'"; OLDQ "select 'old '||count(*) from pg_stat_activity where datname=current_database()"; }
install -d -m 700 /home/deploy/pg-move
```

`OLDQ` reads the role and database from the container's own environment, so neither is typed or
printed. `$Q` counts every table but Oban's (decision 1); the old side's `conns` line includes its own
`psql`.

1. **Read what the move stands on, and stop at the first difference.**
   ```bash
   uptime
   docker ps -a --filter label=com.docker.compose.project=cs-tracker --format '{{.Names}} {{.Status}}'
   OLDQ "select count(*)||' '||max(version) from schema_migrations"
   NEWQ "select count(*) from information_schema.tables where table_schema='public'"
   conns
   docker rollout --version
   ```
   `cs-tracker-app-1` up and no other `app` container, running or exited (docker-rollout would replace a
   stopped one alone and roll nothing, `ops/deploy-remote.sh`); `cs-tracker-db-1` healthy;
   `cs-tracker-caddy-1` up; `cs-tracker-migrate-1` exited 0. `10 20260622181145`, or more if a later
   release added migrations. `0` tables in the target. `estate 0`, `old 12`. `docker-rollout version v0.14`.
2. **Take the cs-tracker change**, which changes no running container:
   ```bash
   git pull --ff-only && git log -1 --format='%H %s'
   docker compose config --services | sort | tr '\n' ' '; echo
   docker compose config app | grep -c depends_on
   ```
   The landed commit; `app caddy db` (`migrate` is under its profile now); `0`. `git status --short`
   still shows only ` M Caddyfile` and the `Caddyfile.bak-*` files.
3. **Start the request loop, off the box, and leave it running to step 10.** From the workstation:
   ```bash
   while :; do printf '%s %s\n' "$(date -u +%H:%M:%S)" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 https://cs-tracker.cuatro.dev/)"; sleep 1; done | tee cs-tracker-move-probe.log
   ```
4. **Dump the old store, the move's source and its first backup:**
   ```bash
   DUMP=/home/deploy/pg-move/cs_tracker-$(date -u +%Y%m%dT%H%M%SZ).dump
   docker exec "$SRC" sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "$DUMP"; echo "exit=$? bytes=$(wc -c < "$DUMP")"
   OLDQ "$Q" > "$DUMP.counts"; cat "$DUMP.counts"; uptime
   ```
   `exit=0` and a size above zero, recorded in step 13. Copy both files off the box from the workstation:
   `scp 'deploy@177.7.52.248:/home/deploy/pg-move/cs_tracker-*' .`
5. **Restore that dump** as `cs_tracker`, which owns every object it creates:
   ```bash
   docker exec -i "$DST" pg_restore -U cs_tracker -d cs_tracker --no-owner --no-acl --exit-on-error < "$DUMP"; echo "exit=$?"
   ```
   `exit=0`. Anything else: stop and bring the error back; the old store was only read. The target is
   emptied for a retry with `dropdb` and the init script's three statements (`ops/postgres.md` § Moving a
   consumer, Rollback of one consumer), never by touching `$SRC`.
6. **Verify by counting**, the restore against the live source and against the counts taken with the dump:
   ```bash
   diff <(OLDQ "$Q") <(NEWQ "$Q") && echo counts-match
   diff "$DUMP.counts" <(NEWQ "$Q") && echo counts-match-dump
   NEWQ "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and pg_get_userbyid(c.relowner)<>'cs_tracker'"
   NEWQ "select extname||' '||pg_get_userbyid(extowner) from pg_extension where extname='pg_trgm'"
   ```
   `counts-match`, `counts-match-dump`, `0`, `pg_trgm cs_tracker`. A non-Oban table that differs from the
   live source moved after the dump (a sign-in writes nothing, an inventory sync or a wishlist edit
   does): empty the target as in step 5 and repeat from step 4.
7. **Point the application at the estate**, keeping the old file as the data rollback, outside the
   checkout, and never printing either password:
   ```bash
   cp -p .env /home/deploy/pg-move/cs-tracker.env.pre-4-10
   awk -v f=/home/deploy/cuatro-portfolio/ops/postgres/.env 'BEGIN { while ((getline l < f) > 0) if (l ~ /^CS_TRACKER_DB_PASSWORD=/) { sub(/^CS_TRACKER_DB_PASSWORD=/, "", l); pw = l } }
     /^DATABASE_URL=/ { print "DATABASE_URL=ecto://cs_tracker:" pw "@estate-postgres:5432/cs_tracker"; next } { print }' .env > .env.new && chmod --reference=.env .env.new && mv .env.new .env
   grep -q '^POOL_SIZE=' .env || printf '\nPOOL_SIZE=10\n' >> .env
   grep -c '^DATABASE_URL=ecto://cs_tracker:[0-9a-f]\{48\}@estate-postgres:5432/cs_tracker$' .env
   grep -c '^POOL_SIZE=10$' .env
   ```
   `1` and `1`. Anything else (a `0` on the first means the password did not come across):
   `cp -p /home/deploy/pg-move/cs-tracker.env.pre-4-10 .env` and stop. The running app read its
   environment when it was created, so nothing serving has changed yet. The password is hex
   (`ops/postgres.md` step 2), so it needs no escaping in the URL.
8. **Migrate**, the discrete step: `docker compose run --rm migrate`. It prints `Migrations already up`
   and exits 0. Then `conns` (`estate 0`, the migrator's connections gone) and `uptime`. An
   authentication failure means step 7 did not take: restore the copy as in step 7 and stop.
9. **Roll the app onto the estate:**
   ```bash
   docker rollout -w 20 app
   docker ps -a --filter label=com.docker.compose.project=cs-tracker --format '{{.Names}} {{.Status}}'
   N=$(docker ps -q --filter label=com.docker.compose.project=cs-tracker --filter label=com.docker.compose.service=app)
   docker inspect $N --format '{{.Name}}'; docker inspect $N --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -o -E '@[^/]*/[a-z_]*$|^POOL_SIZE=.*'
   sleep 10; conns
   diff <(OLDQ "$Q") "$DUMP.counts" && echo old-unchanged
   docker logs $N --since 2m 2>&1 | grep -c -i -E 'error|DBConnection'
   uptime
   ```
   `cs-tracker-app-2` alone, with `db`, `caddy` and `migrate` as step 1 read them; `@estate-postgres:5432/cs_tracker`
   and `POOL_SIZE=10` (the host and database, never the password); `estate 11` and `old 1` (only the
   reading's own `psql`); `old-unchanged`; `0`. `-w 20`: the app has no healthcheck, so docker-rollout
   waits 20 seconds before stopping the old container; the release was serving about three seconds
   after it started in the rehearsal. A failed rollout leaves the old container serving on the old database: stop there, restore
   the `.env` copy, and bring the output back.
10. **Verify, still through Caddy.** Stop the loop and count:
    `awk '{print $2}' cs-tracker-move-probe.log | sort | uniq -c` shows `302` alone. From the
    workstation, the socket:
    ```bash
    curl -s -o /dev/null -w '%{http_code}\n' --http1.1 --max-time 4 -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H 'Origin: https://cs-tracker.cuatro.dev' 'https://cs-tracker.cuatro.dev/live/websocket?vsn=2.0.0'
    ```
    `101`. In a browser, sign in with Steam at `https://cs-tracker.cuatro.dev` and see the inventory and
    the catalog as they were, the page live (a filter or a search answers without a reload). UptimeRobot
    monitor 803750016 reads `UP`. The contract check: `node ops/cs-tracker-adoption-probe.mjs` from this
    repository (it reads the `cs-tracker` checkout, which the move does not touch) exits 0, and
    `curl -s https://cs-tracker.cuatro.dev/assets/css/app.css | grep -o -E -- '--token-[a-z0-9-]+' | sort -u | wc -l`
    prints `12`: the vendored `assets/css/cuatro-contracts/` folder is in the image, which the move does
    not rebuild.
11. **Move the hostname.** On the box first:
    ```bash
    curl -sk -o /dev/null -w '%{http_code}\n' --resolve cs-tracker.cuatro.dev:8443:127.0.0.1 https://cs-tracker.cuatro.dev:8443/
    grep -c 'middlewares: \[forwarded-proto-https\]' /home/deploy/cuatro-portfolio/ops/traefik/dynamic/routes.yml
    ```
    `302` (Traefik reaches `app`) and `1`. A `0` means the Deploy carrying Story 4-10 has not run: stop,
    since the page would render and never go live. On the workstation, with `CF` defined as in
    `ops/traefik-cutover.md` § Moving cuatro.dev and www, start the loop of step 3 again into
    `cs-tracker-rule-probe.log` and leave it running to step 12, then add the rule to the ruleset Story
    4-6 created. If `RS` prints `none`, that section's step 3 says when the `PUT` that creates it is safe;
    never run it otherwise.
    ```bash
    RS=$(CF /phases/http_request_origin/entrypoint | jq -r 'select(.success) | .result.id'); echo "ruleset ${RS:-none}"
    [ -n "$RS" ] && CF "/$RS/rules" -X POST --data '{"description":"Story 4-10: cs-tracker.cuatro.dev to Traefik on 8443","expression":"(http.host eq \"cs-tracker.cuatro.dev\" and ssl)","action":"route","action_parameters":{"origin":{"port":8443}}}' | jq '.success, .errors'
    ```
    `true` and `[]`. After about a minute, `curl -sI https://cs-tracker.cuatro.dev/ | grep -iE '^(HTTP|location|via)'`
    answers `302`, `location: /auth/steam` and **no `via: 1.1 Caddy` line**; the socket command of step 10
    answers `101`; on the box, `uptime`.
12. **Stop the loop and count**: `awk '{print $2}' cs-tracker-rule-probe.log | sort | uniq -c` shows
    `302` alone. Sign in again, through the new path, and see the page live. After one five-minute
    interval, 803750016 reads `UP`. `uptime`.
13. **Record** under a "Move run" heading here: the date, step 1's readings, step 2's commit, step 4's
    dump name, size and counts, step 5's exit, step 6's four lines, step 8's output, step 9's container,
    URL host, connection counts and `old-unchanged`, both probes' counts, the socket answers, the rule id
    (`CF "/$RS" | jq '.result.rules[] | {id, description}'`), and each `uptime`. `ops/routing-inventory.md`
    § Ingress and `ops/estate.md` each take a dated amendment: `cs-tracker.cuatro.dev` served by Traefik
    through an Origin Rule, its data in `cs_tracker` on `estate-postgres`; Caddy stays up in the
    `cs-tracker` project, its block and `cs-tracker-db-1` unreached, until Story 4.11.
    `ops/cs-tracker-token-adoption.md` takes step 10's probe exit. Keep the dump, its counts file and the
    `.env` copy until Story 4.11.

**Rollback, at any step, the hostname first:**

- **R1, the hostname**: delete the rule. It takes effect at the edge; step 11's `curl -sI` shows
  `via: 1.1 Caddy` again, and Caddy proxies the same `app`.
  ```bash
  RS=$(CF /phases/http_request_origin/entrypoint | jq -r 'select(.success) | .result.id')
  ID=$(CF "/$RS" | jq -r '.result.rules[] | select(.description == "Story 4-10: cs-tracker.cuatro.dev to Traefik on 8443") | .id')
  echo "rule ${ID:-not found}"; [ -n "$RS" ] && [ -n "$ID" ] && CF "/$RS/rules/$ID" -X DELETE | jq '.success'
  ```
- **R2, the data**, after step 9: first dump what the estate database holds, so a retry's emptying never
  destroys the only copy of a row written since the switch:
  `docker exec "$DST" pg_dump -U cs_tracker -Fc cs_tracker > /home/deploy/pg-move/cs_tracker-after-r2.dump; echo "exit=$?"`,
  `exit=0`, kept until Story 4.11. Then, in `/home/deploy/cs-tracker`:
  `cp -p /home/deploy/pg-move/cs-tracker.env.pre-4-10 .env && docker rollout -w 20 app`, as rehearsed.
  The app returns to `cs-tracker-db-1`, which took nothing but Oban's queue since the dump. Rows written
  on the estate after step 9 stay in that dump, not in the old store: carry any that matter back by hand.
  The compose change stays; it serves the old database as well (the rehearsal's R2).
- **Before step 9**: `cp -p /home/deploy/pg-move/cs-tracker.env.pre-4-10 .env` if step 7 ran. Nothing
  serving changed.
- **Never** `docker compose up -d` or `down` of the whole project (Caddy serves every hostname),
  `down -v`, `dropdb` or any write against `$SRC`, and never delete the dump before Story 4.11.

**Later rollouts** after the move take the compose file's header: `docker compose build app`,
`docker compose run --rm migrate`, `docker rollout -w 20 app`, each migration expand-only (AD-23).

## Pending Operator actions

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| 1 | **Confirm or overrule Story 4-10's decisions**: no freeze with the Oban tables left out of the count, the migration made discrete in `cs-tracker`'s compose, `POOL_SIZE=10` written into `.env`, the `.env` copy outside the checkout, data before hostname, the router's `forwarded-proto-https` middleware, this record | The Story 4-10 spec's Design Notes carry the reasoning | _not done_ |
| 2 | **Land § The cs-tracker change on `LuigiEspinosa/cs-tracker` `main`**: extract the diff from this file with its line endings made LF, `awk '{sub(/\r$/,"")} /^```diff$/{f=1;next} /^```$/{f=0} f' ops/cs-tracker-cutover.md > cs-tracker-4-10.patch` (checked on an LF and a CRLF copy), check `sha256sum cs-tracker-4-10.patch` prints `58cadec9c03b9ddc067d5254cadb38dfeb1933f5e1fab77cd1b8c7b29955ede7`, then in a clean `cs-tracker` checkout at `2519fe3` or later: `git apply cs-tracker-4-10.patch && git add docker-compose.yml docs/deployment.md && git commit -m "chore: migrate as a discrete step and join estate-postgres for the estate Postgres move" && git push origin main` | No CI runs there and no deploy fires; the box takes it at step 2 | _not done_ |
| 3 | **Merge the commit carrying Story 4-10 into `main`** and let the Deploy run | It rolls the Hub alone and brings the router's middleware to the box's watched `ops/traefik/dynamic/`; nothing routes to it until step 11 | _not done_ |
| 4 | **Run § The sequence, steps 1 to 13**, after `ops/postgres.md` action 3, `ops/postgres-backup.md` § Install and first run and action 2 here; steps 11 and 12 also after `ops/traefik-cutover.md` actions 4 and 6, action 3 here and the origin rules token | Step 13 amends `ops/routing-inventory.md`, `ops/estate.md` and `ops/cs-tracker-token-adoption.md` | _not done_ |

**Maintaining this file.** When an action is performed, replace its cell with the ISO 8601 UTC date and
leave the row in place.
