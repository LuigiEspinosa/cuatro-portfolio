# The estate's one Postgres

How the estate's one PostgreSQL instance goes onto the box, what it holds (one database and one role
per consumer, each with its connection limit), the discipline every migration against it follows, and
how each later story moves its consumer onto it and back. It is the artifact Story 4-4 delivers under
AD-10 and AD-23, on the major Story 4-1 decided (`ops/settled-inputs-refresh.md` § Decision: PostgreSQL
18), in the shape `ops/traefik-cutover.md` set.

This file is a record, not Registry data. Every value is marked as a decision or an observation, and
the two are never presented as the same kind of fact (NFR-9). Times are UTC.

**Nothing here has run on the box. Written 2026-09-30, committed on `dev`.** The authoring session read
the box but wrote nothing to it. The Operator runs § The placement as `deploy` and dates each Pending
Operator action at the end. **No consumer moves in Story 4-4**: every application keeps its current
database until its own story (4.7, 4.8, 4.10) runs § Moving a consumer.

**Amended 2026-09-30: § The placement ran on the box** that evening, recorded under § Placement run,
2026-09-30. No consumer has moved.

## What runs today

**Observed 2026-09-30T10:59:09Z over SSH as `deploy`, read-only** (`docker ps`, `docker inspect` with a
format naming no environment, `free -m`, `nproc`, `uptime`).

| Container | Image | Database and role | Command | Holds |
|---|---|---|---|---|
| `cuatro-portfolio-anchor-db-1` | `postgres:16-alpine` | `umami`, `umami` | `["postgres"]` | Umami (`analytics.cuatro.dev`) |
| `cuatro-tracker-postgres-1` | `postgres:16-alpine` | `tracker`, `tracker` (`ops/tracker-cutover.md`) | `["postgres"]` | the tracker (`tracker.cuatro.dev`) |
| `cs-tracker-db-1` | `postgres:16` | `POSTGRES_DB` and `POSTGRES_USER` of `/home/deploy/cs-tracker/.env`, not read | `["postgres"]` | `cs-tracker` |

None passes a `-c`, so each runs Postgres 16's default `max_connections` of 100 (a documented default,
not a reading). No role in the estate carries a connection limit except `finance`, which exists only in
`apps/finance/prisma/provision.sql` and no box. The box: 2 cores, 7940 MB of memory with 5494 MB
available, load average 0.75, 0.38, 0.24 at the same instant.

The tournament's store is Supabase Cloud, off the box (§ The tournament stays on Supabase).

## The stack

`ops/postgres/compose.yml`, started by hand from the checkout, never by a deploy:

| Fact | Value | Kind |
|---|---|---|
| Project, service, container | `postgres`, `estate-postgres`, `postgres-estate-postgres-1` | Decision |
| Image | `postgres:18.6-trixie` | Decision: 18.6 is the newest 18 on 2026-09-30 (Docker Hub, pushed 2026-09-24); `-trixie` pins glibc, whose collation changes silently invalidate text indexes under a live volume |
| Connections | `max_connections=100`, set on the command line; `superuser_reserved_connections` left at 3 | Decision |
| Data | named volume `postgres_pgdata` at `/var/lib/postgresql` (the 18 image keeps its cluster under `18/docker` there) | Decision |
| Init | `ops/postgres/init/10-consumers.sh`, run once by the image on an empty volume | Decision |
| Network | `estate-postgres`, joined by consumers only, each declaring it `external`. No ingress network, no published port | Decision |
| Secrets | `ops/postgres/.env`, gitignored: `POSTGRES_PASSWORD` and one `<ROLE>_DB_PASSWORD` per consumer | Decision |

**Why a stack of its own and not a service of `docker-compose.yml`.** The database outlives every
application's deploy and serves consumers from three compose projects, while the Anchor's file is
interpolated and pulled by every Hub deploy. The service is `estate-postgres`, never `postgres` or `db`,
because a consumer on this network and its own project's network would otherwise resolve a name another
database already answers to (the 28P01 of 2026-08-17, `docker-compose.yml`'s header).

**No PgBouncer.** Every consumer is a long-lived container with its own pool; a pooler solves serverless
burst, which the estate does not have (AD-10).

## The budget

**Decision, 2026-09-30, the Operator may overrule.** One database and one role per consumer, the same
name for both, each role the owner of its database and the only role but the superuser that may connect
to it. The limit is set on the role and on the database. `max_connections=100`, less the 3 superuser
slots, leaves 97; the sum below is 80, so the superuser's dumps (Story 4.5) and an Operator's `psql`
always have room.

| Role and database | Limit | Consumer | Its pool today | Where it sets the limit | Changed by |
|---|---|---|---|---|---|
| `umami` | 25 | Umami, its server and its start-time migration | node-postgres's default `max` of 10 per container: Umami 3.4.0 builds its pool as `new PrismaPg({connectionString})` on Prisma 7.10.0 (observed 2026-09-30 in `ghcr.io/umami-software/umami:postgresql-latest`, digest `sha256:85909afc...`; the box runs the 2026-08-12 digest `sha256:87312d33...`, whose version was not read; **amended 2026-09-30:** it is GHCR's `3.3.0`, § Moving Umami) | nowhere in 3.4.0: no pool option reaches it from the environment, so the role's limit is the cap. Two containers across a rollout at 10, plus the migration. Story 4.7 pins the version and re-reads this | Story 4.7 |
| `cuatro_tracker` | 20 | the tracker: `tracker`, `tracker-worker`, `tracker-migrate` | Prisma 6 default, 5 per process, no limit (`apps/tracker/lib/db.ts`) | `connection_limit=4` on `DATABASE_URL`: two servers and two workers across a rollout at 4 each, plus one migrate | Story 4.8 |
| `cs_tracker` | 25 | `cs-tracker`, its `app` and `migrate` | Ecto `pool_size` from `POOL_SIZE`, default 10 (`config/runtime.exs:208` in `cs-tracker`) | `POOL_SIZE=10` in its env file, stated: two containers across a rollout at 10, plus the migrator's pool | Story 4.10 |
| `cuatro_finance` | 10 | finance, placed nowhere | `max: 5` per container (`apps/finance/lib/db.ts`) | already set; its `DATABASE_URL` and `provision.sql` name `finance` until it is placed (DW-300) | its placement (DW-269) |
| **Sum** | **80** | | | of 97 usable | |

`ops/__tests__/postgres-init.test.ts` holds this table equal to the script's and the sum under the budget.
Adding a consumer is one line in the script's `CONSUMERS` table, one row here, and one variable in the
env file, and the suite fails if the three disagree. A new consumer on a running instance takes the same
three statements the script runs, by hand as the superuser, since the script runs only on an empty volume.

Names follow AD-3: the Registry id with hyphens as underscores. **`umami` is the one exception, a
decision the Operator may overrule:** Umami has no Registry id, and naming its database for the Anchor
(`cuatro_portfolio`) would claim the Hub owns data it never reads. The tracker's `tracker` and
finance's `finance` become `cuatro_tracker` and `cuatro_finance`; the restore in § Moving a consumer
renames by restoring into the new database as its owner.

## The tournament stays on Supabase

**Decision, 2026-09-30, the Operator may overrule.** `cs-tournament` does not move in this story or in
this epic. Its store is Supabase (Auth, PostgREST, Realtime and Postgres), kept as AD-10's declared
exception by the Operator's ruling on DW-280 and backed up off Supabase's side by
`ops/tournament-backup.sh` (Operator ruling 2026-09-30, `ops/estate.md` § cs-tournament). Moving the
Postgres alone would leave Auth, PostgREST and Realtime pointing at Supabase; moving all four is a
rebuild of the application's identity and API layers, a story of its own that no Epic 4 story names. Its
worker's direct connection goes through Supabase's session pooler and holds nothing of this budget.

## Migration discipline (AD-23)

Every story that moves a consumer here, and every schema change after, follows AD-23:

1. **A discrete step, before the rollout.** Migrations run from the application's image as a one-shot
   (`<service>-migrate` under the `migrate` profile in `docker-compose.yml`, `bin/migrate` for
   `cs-tracker`), against the consumer's own database with the consumer's own role, and the rollout
   starts only after it exits 0.
2. **Backward-compatible with the version still serving.** `docker-rollout` runs the old and the new
   container side by side, so a migration only expands (add a nullable column, a table, an index); the
   matching contraction ships in a later release, never in the same one. The finance suite already
   refuses a migration that does both (`apps/finance/prisma/__tests__/migrations.test.ts`).
3. **Never on boot.** No server runs migrations when it starts. An application whose framework defaults
   to it turns that off explicitly. Umami's image does today: its command, `scripts/start-docker.sh`, runs
   `scripts/check-db.js`, which runs `prisma migrate deploy` unless `SKIP_DB_MIGRATION` is set (read in
   the 3.4.0 image, 2026-09-30); Story 4.7 sets it on the server and runs the migration as its own
   one-shot (DW-302). `cs-tracker`'s compose today runs `migrate` on every `up`, as a
   separate one-shot, not in the server: Story 4.10 keeps it a separate step before the roll.
4. **The consumer's role owns its schema.** A restore runs as the consumer's role (`--no-owner`), so
   every object belongs to it and its later migrations need no superuser. An extension the dump carries
   is created by the owner when it is trusted (`pg_trgm`, which `cs-tracker`'s first migration needs, is);
   an untrusted one fails the restore loudly, and the Operator creates it as the superuser first.

## Rehearsed off the box

Run 2026-09-30 on the authoring host (Windows 11, Docker 29.8) with throwaway passwords in a throwaway
`ops/postgres/.env`, removed afterwards with every container, volume and network (`docker ps -a`,
`docker volume ls` and `docker network ls` then listed nothing named for the rehearsal). Three anonymous
volumes holding Postgres 16 clusters, left by `docker rm -f` without `-v` on containers of the `postgres`
image (which declares a `VOLUME`), survived that check because their names are bare hex; a verification
found them and they were removed the same day.

**First start**, `docker compose -p cuatro-4-4-proof -f ops/postgres/compose.yml up -d`, healthy at
2026-09-30T11:18:36Z. The image's log, the lines naming the script or `REVOKE` (psql's `CREATE ROLE` and
`CREATE DATABASE` acknowledgements left out):

```
/usr/local/bin/docker-entrypoint.sh: running /docker-entrypoint-initdb.d/10-consumers.sh
REVOKE
REVOKE
10-consumers.sh: database and role umami, connection limit 25
REVOKE
10-consumers.sh: database and role cuatro_tracker, connection limit 20
REVOKE
10-consumers.sh: database and role cs_tracker, connection limit 25
REVOKE
10-consumers.sh: database and role cuatro_finance, connection limit 10
```

`psql -U postgres` in the container:

```
 PostgreSQL 18.6 (Debian 18.6-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit

    rolname     | rolconnlimit | rolsuper
----------------+--------------+----------
 cs_tracker     |           25 | f
 cuatro_finance |           10 | f
 cuatro_tracker |           20 | f
 postgres       |           -1 | t
 umami          |           25 | f

    datname     |     owner      | datconnlimit |               datacl
----------------+----------------+--------------+-------------------------------------
 cs_tracker     | cs_tracker     |           25 | {cs_tracker=CTc/cs_tracker}
 cuatro_finance | cuatro_finance |           10 | {cuatro_finance=CTc/cuatro_finance}
 cuatro_tracker | cuatro_tracker |           20 | {cuatro_tracker=CTc/cuatro_tracker}
 postgres       | postgres       |           -1 | {=T/postgres,postgres=CTc/postgres}
 template0      | postgres       |           -1 | {=c/postgres,postgres=CTc/postgres}
 template1      | postgres       |           -1 | {postgres=CTc/postgres}
 umami          | umami          |           25 | {umami=CTc/umami}

 max_connections
-----------------
 100
```

**Each role against every database**, over TCP from a second `postgres:18.6-trixie` container on
`estate-postgres`, as a consumer connects, at 2026-09-30T11:18:37Z (the client's `connection to server
at "estate-postgres" (172.30.0.2), port 5432 failed:` prefix trimmed from each refusal, and the `DETAIL:  User does not have CONNECT
privilege.` line psql prints after each `permission denied` left out):

```
umami -> umami: umami in umami
umami -> cuatro_tracker: FATAL:  permission denied for database "cuatro_tracker"
umami -> cs_tracker: FATAL:  permission denied for database "cs_tracker"
umami -> cuatro_finance: FATAL:  permission denied for database "cuatro_finance"
umami -> postgres: FATAL:  permission denied for database "postgres"
umami -> template1: FATAL:  permission denied for database "template1"
cuatro_tracker -> umami: FATAL:  permission denied for database "umami"
cuatro_tracker -> cuatro_tracker: cuatro_tracker in cuatro_tracker
cuatro_tracker -> cs_tracker: FATAL:  permission denied for database "cs_tracker"
cuatro_tracker -> cuatro_finance: FATAL:  permission denied for database "cuatro_finance"
cuatro_tracker -> postgres: FATAL:  permission denied for database "postgres"
cuatro_tracker -> template1: FATAL:  permission denied for database "template1"
cs_tracker -> umami: FATAL:  permission denied for database "umami"
cs_tracker -> cuatro_tracker: FATAL:  permission denied for database "cuatro_tracker"
cs_tracker -> cs_tracker: cs_tracker in cs_tracker
cs_tracker -> cuatro_finance: FATAL:  permission denied for database "cuatro_finance"
cs_tracker -> postgres: FATAL:  permission denied for database "postgres"
cs_tracker -> template1: FATAL:  permission denied for database "template1"
cuatro_finance -> umami: FATAL:  permission denied for database "umami"
cuatro_finance -> cuatro_tracker: FATAL:  permission denied for database "cuatro_tracker"
cuatro_finance -> cs_tracker: FATAL:  permission denied for database "cs_tracker"
cuatro_finance -> cuatro_finance: cuatro_finance in cuatro_finance
cuatro_finance -> postgres: FATAL:  permission denied for database "postgres"
cuatro_finance -> template1: FATAL:  permission denied for database "template1"
umami, twenty-sixth connection: FATAL:  too many connections for role "umami"
```

The last line held twenty-five `umami` sessions open with `pg_sleep(8)` and opened a twenty-sixth: the
role's limit refused it by name.

**A missing variable**, 2026-09-30T11:19:34Z: the image with the init directory, `restart:
unless-stopped` and `CS_TRACKER_DB_PASSWORD` unset. The script refused before any statement, the image
restarted into the initialized cluster and skipped the directory, and the cluster held no consumer:

```
/usr/local/bin/docker-entrypoint.sh: running /docker-entrypoint-initdb.d/10-consumers.sh
10-consumers.sh: CS_TRACKER_DB_PASSWORD is unset or empty; no database for cs_tracker
PostgreSQL Database directory appears to contain a database; Skipping initialization
$ docker exec cuatro-4-4-missing psql -U postgres -Atc "select datname from pg_database order by 1"
postgres
template0
template1
```

An earlier draft that checked each variable only as it reached it left `umami` and `cuatro_tracker`
created and the restarted server healthy with half the consumers, which is why every variable is checked
first and why § The placement's step 4 counts the databases.

**A 16 dump restored into 18 as the consumer's role**, 2026-09-30T11:19:10Z, by § Moving a consumer's
own commands: a throwaway `postgres:16-alpine` (`PostgreSQL 16.14 on x86_64-pc-linux-musl`) with
database and role `tracker`, as the box's, holding `pg_trgm`, a table `media` of 1000 rows with a
trigram index, and a table `user` of 2. Dumped with the source's own `pg_dump`, restored with the new
instance's `pg_restore` as `cuatro_tracker`, counted on both sides; then one row was written to the
source and the count run again:

```
$ docker exec "$SRC" pg_dump -U "$SRC_ROLE" -Fc "$SRC_DB" > "$ROLE.dump"      (7864 bytes)
$ docker exec -i NEW pg_restore -U "$ROLE" -d "$ROLE" --no-owner --no-acl --exit-on-error < "$ROLE.dump"
exit=0
$ docker exec "$SRC" psql -U "$SRC_ROLE" -d "$SRC_DB" -Atc "$Q"
media 1000
user 2
$ diff <(... "$SRC" ...) <(... NEW ...) && echo counts-match
counts-match
$ (insert into "user" values (3) on the source, then the same diff)
2c2
< user 3
---
> user 2
$ (every relation in public, with its owner; every extension)
media:cuatro_tracker media_id_seq:cuatro_tracker media_pkey:cuatro_tracker media_title_trgm:cuatro_tracker user:cuatro_tracker user_pkey:cuatro_tracker
pg_trgm 1.6, plpgsql 1.0
```

So the count names a table written after the dump, which is what step 1's freeze is for.

The restore rebuilds every index on the new side, so the move from Alpine's musl to Debian's glibc
carries no collation hazard: the risk the `-trixie` pin guards against is a base image moving later.

## The placement

Run as `deploy` from `/home/deploy/cuatro-portfolio`, once `main` carries `ops/postgres/` (Pending
Operator action 1). Set `P='docker compose -f ops/postgres/compose.yml'` first; `$P` below is that.

1. **Read the load**, `uptime`, and record it with the date: the instance is a fourth Postgres beside the
   three until Story 4.11, and the load average wins every conflict (SM-C4). Placing it is not an
   application placement under AD-9 (no id, no `deploy.yml` entry), so the Capacity Gate is not edited.
2. **Write the env file**, values generated on the box and never printed. Hex, so a password needs no
   escaping inside a `DATABASE_URL`. An existing file is left alone, since the cluster may already hold
   its passwords:
   ```
   if [ -e ops/postgres/.env ]; then echo "ops/postgres/.env exists; not overwritten"; else
     install -m 600 /dev/null ops/postgres/.env
     for v in POSTGRES_PASSWORD UMAMI_DB_PASSWORD CUATRO_TRACKER_DB_PASSWORD CS_TRACKER_DB_PASSWORD CUATRO_FINANCE_DB_PASSWORD; do
       printf '%s=%s\n' "$v" "$(openssl rand -hex 24)" >> ops/postgres/.env
     done
   fi
   git check-ignore -q ops/postgres/.env && echo ignored
   ```
   It must print `ignored`. A deploy's `git reset --hard` leaves an ignored file alone.
3. **First start**: `$P up -d`, then `$P ps` until the service reads `healthy` (up to about three and a
   half minutes on a fresh volume).
4. **Check the consumers**:
   ```
   docker exec postgres-estate-postgres-1 psql -U postgres -Atc "select datname||' '||pg_get_userbyid(datdba)||' '||datconnlimit from pg_database where datname not in ('postgres','template0','template1') order by 1"
   ```
   Expected, exactly: `cs_tracker cs_tracker 25`, `cuatro_finance cuatro_finance 10`,
   `cuatro_tracker cuatro_tracker 20`, `umami umami 25`. **Fewer lines** means the init refused (its
   reason is in `$P logs`): with no consumer moved yet the volume holds nothing, so `$P down -v`, fix
   `.env`, and repeat from step 3. `down -v` is never run after § Moving a consumer has run once.
5. **Read the load again** and record it beside step 1's.

Nothing else changes: every application keeps its current database, and the old containers keep
serving.

## Placement run, 2026-09-30

**Observed 2026-09-30 on the box (`177.7.52.248`) as `deploy`, run by the orchestrator with the Operator
present.** Preconditions: PR #88 merged `dev` into `main` as `f9ea578` at 21:27Z, Deploy run
36779534561 succeeded, and the box checkout read `f9ea578`.

- **Step 1**, 22:15:44Z: load average `0.21, 0.20, 0.18`.
- **Step 2.** `ops/postgres/.env` did not exist, so it was written at mode 600 with the five names
  `POSTGRES_PASSWORD`, `UMAMI_DB_PASSWORD`, `CUATRO_TRACKER_DB_PASSWORD`, `CS_TRACKER_DB_PASSWORD` and
  `CUATRO_FINANCE_DB_PASSWORD`, each value generated on the box by `openssl rand -hex 24` and never
  printed. `git check-ignore` printed `ignored`.
- **Step 3.** `$P up -d`; `postgres-estate-postgres-1` read `healthy` after 8 seconds.
- **Step 4.** The query printed exactly `cs_tracker cs_tracker 25`, `cuatro_finance cuatro_finance 10`,
  `cuatro_tracker cuatro_tracker 20`, `umami umami 25`. The init's log carried
  `10-consumers.sh: database and role cuatro_tracker, connection limit 20` and the same line for
  `cs_tracker` (25) and `cuatro_finance` (10); `umami`'s line had scrolled out of the tail that was read,
  and the query above shows its database and limit. Then `database system is ready to accept connections`
  at 22:16:04Z.
- **Step 5**, 22:16:07Z: load average `0.96, 0.38, 0.24`. The one-minute figure is the init's own work;
  the fifteen-minute figure stayed under the 0.60 threshold (`ops/capacity-threshold.md`). `docker stats`
  for `postgres-estate-postgres-1`: 0.04 % CPU, 30.52 MiB.

No consumer moved: § Moving a consumer has not run for any of them.

## Moving a consumer

Each consumer's own story runs this, in its own window, and owns every application-side change: joining
`estate-postgres` as an `external` network, the new `DATABASE_URL`
(`postgresql://<role>:<password>@estate-postgres:5432/<role>`, the password copied from
`ops/postgres/.env` into that application's env file without printing), and its connection limit per §
The budget. **Precondition, a decision the Operator may overrule: Story 4.5's dump and offsite copy
cover this instance first**, since a moved database otherwise has no backup at all (DW-301).

| Story | Source container | Source role and database | Target |
|---|---|---|---|
| 4.7 | `cuatro-portfolio-anchor-db-1` | `umami`, `umami` | `umami` |
| 4.8 | `cuatro-tracker-postgres-1` | `tracker`, `tracker` | `cuatro_tracker` |
| 4.10 | `cs-tracker-db-1` | `POSTGRES_USER`, `POSTGRES_DB` of `/home/deploy/cs-tracker/.env` | `cs_tracker` |

**Story 4-8, 2026-09-30:** the tracker's move is written in `ops/tracker-cutover.md` § Moving the database
onto the estate Postgres, the record that owns the tracker's placement; it restores the dump
`ops/tracker-backup.sh` wrote and `ops/tracker-restore-verify.sh` proved, rather than a second one.

**Story 4-10, 2026-09-30:** `cs-tracker`'s move is written in `ops/cs-tracker-cutover.md` § The sequence,
a record of its own, since no record here owned how `cs-tracker` runs. It counts every table but Oban's
queue, which the serving application writes throughout, and makes the migration discrete in
`cs-tracker`'s compose, whose `app` started `migrate` through `depends_on`.

With `SRC`, `SRC_ROLE`, `SRC_DB` and `ROLE` set from that row:

1. **Freeze writes**: stop the consumer's writers (server and worker) for the window, or accept that rows
   written after the dump stay behind in the old database. The story chooses and says which.
2. **Dump** with the source's own `pg_dump`:
   ```
   install -d -m 700 /home/deploy/pg-move
   docker exec "$SRC" pg_dump -U "$SRC_ROLE" -Fc "$SRC_DB" > "/home/deploy/pg-move/$ROLE.dump"
   ```
3. **Restore** as the consumer's role, which owns every object it creates:
   ```
   docker exec -i postgres-estate-postgres-1 pg_restore -U "$ROLE" -d "$ROLE" --no-owner --no-acl --exit-on-error < "/home/deploy/pg-move/$ROLE.dump"
   ```
   It must exit 0. The container's local socket trusts its own users, so no password crosses the shell.
4. **Verify by counting** every table on both sides and comparing:
   ```
   Q="select table_name||' '||(xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1"
   diff <(docker exec "$SRC" psql -U "$SRC_ROLE" -d "$SRC_DB" -Atc "$Q") <(docker exec postgres-estate-postgres-1 psql -U "$ROLE" -d "$ROLE" -Atc "$Q") && echo counts-match
   ```
   It must print `counts-match`.
5. **Migrate, then roll**: the application's migrate step against the new database (AD-23, § Migration
   discipline), then its rollout on the new `DATABASE_URL`, then its own health and its hostname's probe.
6. **Leave the old container running** until Story 4.11. It is the rollback.

**Rollback of one consumer**: point its `DATABASE_URL` back at the old container and roll again. Rows
written to the new database since the switch are not in the old one; if any matter, dump them from the
new side (`pg_dump -a -t <table>`) before switching back. The new database stays, unused, for the next
attempt, and is emptied for it with `dropdb` and the three statements of the init script, never with
`down -v` once another consumer has moved.

## Moving Umami (Story 4-7)

Umami, behind `analytics.cuatro.dev`, is the first consumer to move. Story 4-7 changes four things about
it and one about its hostname, and this section is how the Operator runs them. It lives here rather than
in a record of its own because this file owns every consumer move and already lists 4.7's row; the
hostname half reuses `ops/traefik-cutover.md` § Moving a hostname.

| What | Before | After | Kind |
|---|---|---|---|
| Image | `ghcr.io/umami-software/umami:postgresql-latest`; the box's copy has digest `sha256:87312d33...`, which is GHCR's manifest digest for `3.3.0` | `3.4.0@sha256:85909afc45bdcda1917394594a087421fdbb05610fded0fa9f6fb861abb2f367`: the latest stable release (`gh release list`, published 2026-09-17) and the digest `postgresql-latest` resolved to on 2026-09-30 | Decision; both digests observed 2026-09-30 from the GHCR registry API |
| Database | `umami` in `cuatro-portfolio-anchor-db-1`, Postgres 16.14 | `umami` in `postgres-estate-postgres-1`, Postgres 18.6, role limit 25 | Decision (§ The budget) |
| Migrations | on every start: the image's `scripts/check-db.js` runs `prisma migrate deploy` | `SKIP_DB_MIGRATION=1` on the server; `anchor-umami-migrate` under the `migrate` profile runs it, from the same image, before the server starts | Decision (AD-23, DW-302) |
| Healthcheck | none (DW-179) | `curl` to `/api/heartbeat` on loopback: the image sets `HOSTNAME=0.0.0.0`, and the route answers without the database | Decision |
| Hostname | Caddy's `analytics.cuatro.dev` block | the committed `analytics` router in `ops/traefik/dynamic/routes.yml`, reached by one Origin Rule. It already matches Caddy's block (the same three headers, `anchor-umami:3000`), so nothing in `ops/traefik/` changes | Decision |

What it leaves alone: `anchor-db` and its volume (the rollback, until Story 4.11; finance still names it,
DW-300), Caddy's block, `UMAMI_APP_SECRET`, and the Hub's `NEXT_PUBLIC_UMAMI_*` build inputs, since the
restore keeps every website id. Umami 3.4.0 applies migrations 24 to 26 over the box's 23 and, by its
release notes, "binds authenticated sessions to password fingerprints": **every signed-in session ends,
so the Operator needs the admin password before step 5.** It pools node-postgres's default of ten per
container and takes no pool option from the environment (DW-302, read in this same digest), so the
role's 25 is the cap: two containers across a later rollout, plus the migration.

**Decisions, each one the Operator may overrule** (Pending action 4; the Story 4-7 spec's Design Notes
carry the reasoning): the exact release and digest rather than a major; writes frozen for the window
(Umami stopped from step 5 to step 10, a few minutes in which visitors' beacons fail silently) so the
counts prove the copy exactly; the data move first, under Caddy, and the hostname second, each verified
and rolled back on its own; the data rollback by an override file on the box rather than a revert through
CI.

### What serves it today

**Observed 2026-09-30T14:22:50Z over SSH as `deploy`, read-only**: load average 0.20, 0.25, 0.20;
`cuatro-portfolio-anchor-umami-1` on `postgresql-latest`, up six weeks, no health status;
`PostgreSQL 16.14 on x86_64-pc-linux-musl`; the database 9455 kB; the last applied migration
`23_update_session_data`; no `estate-postgres` network yet. The rows Story 2.24's metrics depend on
(`event_type`, `event_name`, count):

```
1||79
2|live-open|1
2|source-open|1
2|suite-reach|7
event_data 5, website 1, user 1; website_event from 2026-08-17 12:08:05 to 2026-09-30 12:48:06 UTC
```

### Rehearsed off the box

Run 2026-09-30 on the authoring host (Windows 11, Docker 29.8) from this checkout, with throwaway
passwords in a throwaway `ops/postgres/.env` and env file, a throwaway `cs-tracker_default` network, and
the rollback override of step 3 below. The box's shape: the estate instance from
`ops/postgres/compose.yml`; `anchor-db` from `docker-compose.yml`; Umami 3.3.0 by the box's digest on it
through the override, its 23 migrations applied, then seeded through its own API with four page views and
the three events (a login, a website, `/api/send` with a browser user agent and each event's data). Then
steps 5 to 10 as written, the fresh page view of step 11 through the API, and rollback R2. Output as
printed, trimmed only where marked:

```
## freeze 2026-09-30T14:31:32Z
 Container p47-anchor-umami-1 Stopped
## dump
exit=0 bytes=61161
## restore
exit=0
## counts                                    (the source's lines, joined; then the diff)
_prisma_migrations 23 app_setting 0 board 0 event_data 3 heatmap_event 0 link 0 pixel 0 report 0 revenue 0 segment 0 session 1 session_data 0 session_link 0 session_replay 0 session_replay_saved 0 share 0 team 0 team_user 0 two_factor_auth 0 two_factor_backup_code 0 two_factor_otp_used 0 two_factor_rate_limit 0 user 1 website 1 website_event 7
counts-match
## events restored
live-open|1
source-open|1
suite-reach|1
## migrate                                   (blank lines left out)
Applying migration `24_lowercase_username`
Applying migration `25_add_annotation`
Applying migration `26_add_api_key`
The following migration(s) have been applied:
...                                          (the tree of the three migration.sql files)
All migrations have been successfully applied.
exit=0
## roll
 Container p47-anchor-umami-1 Healthy
ghcr.io/umami-software/umami:3.4.0@sha256:85909afc45bdcda1917394594a087421fdbb05610fded0fa9f6fb861abb2f367
## server log                                (the first lines; no migration runs)
✓ DATABASE_URL is defined.
✓ Database connection successful.
✓ Database version check successful.
▲ Next.js 16.3.4
## heartbeat
{"ok":true} 200
## sign in                                   (POST /api/auth/login as the seeded admin)
200
## fresh page view                           (event_type 1 rows, before and after one /api/send)
4
200
5
/after-move
## heartbeat with the database paused
200
## connections                               (pg_stat_activity for umami, idle server)
umami|1
## rollback                                  (R2 below)
 Container p47-anchor-umami-1 Healthy
ghcr.io/umami-software/umami:3.3.0@sha256:87312d334d009ee67ee0d2fba8fed01435547cc468e452243aef5133a9984d48 healthy
{"ok":true} 200
sign in 200
7                                            (website_event in anchor-db: untouched since the freeze)
23_update_session_data
8                                            (website_event in the estate umami: the fresh view stays there)
26_add_api_key
```

Also shown there: with `estate-postgres` and `cuatro-tracker_default` absent, `up -d --wait anchor-db`
from `docker-compose.yml` started healthy (exit 0), so compose asks for `estate-postgres` only for a
Umami service, and a Hub deploy on a box where § The placement has not run is unaffected. Everything was
removed afterwards (`down -v` on each project, the network, both env files): `docker ps -a`,
`docker volume ls` and `docker network ls` listed nothing named for the rehearsal, and no dangling volume
was created that hour.

### The sequence

**Preconditions**, each recorded before step 1:

- § The placement steps 1 to 5 here (Pending action 3): step 4 printed `umami umami 25`.
- `ops/postgres-backup.md` § Install and first run: the nightly dump takes every database on the estate
  instance, so the moved `umami` is backed up from its first night (DW-301).
- For steps 12 and 13 only: `ops/traefik-cutover.md` § The sequence steps 1 to 8, and the Origin Rules
  token (`ops/settled-inputs-refresh.md` Pending action 4). Steps 1 to 11 need neither.
- `main` carries Story 4-7's commit and its Deploy ran (Pending action 5). The Deploy rolls `anchor-app`
  alone, so the merge changes nothing about the running Umami.
- The Umami admin password is at hand.

On the box as `deploy` in `/home/deploy/cuatro-portfolio`:

```bash
C='docker compose --env-file .env.production'
SRC=cuatro-portfolio-anchor-db-1; DST=postgres-estate-postgres-1
Q="select table_name||' '||(xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1"
E="select event_name||' '||count(*) from website_event where event_type = 2 and event_name in ('suite-reach','live-open','source-open') group by event_name order by 1"
install -d -m 700 /home/deploy/pg-move
```

1. **Read what the move stands on, and stop at the first difference.**
   ```bash
   uptime
   docker inspect -f '{{.Config.Image}} {{.State.Status}}' cuatro-portfolio-anchor-umami-1
   docker exec "$SRC" psql -U umami -d umami -Atc "select max(migration_name) from _prisma_migrations" -c "$E"
   docker exec "$DST" psql -U umami -d umami -Atc "select count(*) from information_schema.tables where table_schema='public'"
   grep -c 'umami:3.4.0@sha256:85909afc' docker-compose.yml
   ```
   Umami `running`; `23_update_session_data` and the three event names, each count at least the one in §
   What serves it today; `0` tables in the target, so nothing is restored over anything; `2`.
2. **Give the application its password**, copied without printing, once:
   ```bash
   grep -q '^UMAMI_DB_PASSWORD=' .env.production && echo "already set" || { echo; grep '^UMAMI_DB_PASSWORD=' ops/postgres/.env; } >> .env.production
   grep -c '^UMAMI_DB_PASSWORD=.' .env.production
   ```
   `1`. The leading `echo` keeps the line its own if the file ends without a newline. `POSTGRES_PASSWORD` stays: `anchor-db` and the rollback still use it.
3. **Write the data rollback**, the service as it runs today, pinned by the box's own digest:
   ```bash
   cat > /home/deploy/pg-move/umami-rollback.yml <<'YAML'
   services:
     anchor-umami:
       image: ghcr.io/umami-software/umami:3.3.0@sha256:87312d334d009ee67ee0d2fba8fed01435547cc468e452243aef5133a9984d48
       environment:
         - DATABASE_URL=postgresql://umami:${POSTGRES_PASSWORD}@anchor-db:5432/umami
       networks:
         default:
   YAML
   R="$C -f docker-compose.yml -f /home/deploy/pg-move/umami-rollback.yml"
   $R config --images anchor-umami; $R config anchor-umami | grep -c '@anchor-db:5432/umami'
   ```
   The 3.3.0 reference, and `1` (a count, so no password is printed). Compose merges the override's
   environment by name, so `SKIP_DB_MIGRATION=1` stays, and `anchor-db` is already at 3.3.0's last
   migration.
4. **Pull ahead of the window**: `$C pull anchor-umami`. The migrate service runs the same reference.
5. **Freeze.** `$C stop anchor-umami; FROZE=$(date -u +%FT%TZ); echo "$FROZE"; uptime`. Analytics is
   dark from here to step 10.
6. **Dump** with the source's own `pg_dump`:
   ```bash
   docker exec "$SRC" pg_dump -U umami -Fc umami > /home/deploy/pg-move/umami.dump; echo "exit=$?"
   ls -l /home/deploy/pg-move/umami.dump
   ```
   `exit=0`, and a size of the order of the database's.
7. **Restore** as `umami`:
   ```bash
   docker exec -i "$DST" pg_restore -U umami -d umami --no-owner --no-acl --exit-on-error < /home/deploy/pg-move/umami.dump; echo "exit=$?"
   ```
   `exit=0`. Anything else: stop, `$C start anchor-umami` (the old container, unchanged, back on
   `anchor-db`), and bring the error back. The target is emptied for a retry with `dropdb` and the init
   script's three statements (§ Moving a consumer, Rollback of one consumer), never by touching `$SRC`.
8. **Verify by counting**:
   ```bash
   diff <(docker exec "$SRC" psql -U umami -d umami -Atc "$Q") <(docker exec "$DST" psql -U umami -d umami -Atc "$Q") && echo counts-match
   docker exec "$DST" psql -U umami -d umami -Atc "$E"
   ```
   `counts-match`, and the three event names with step 1's counts. Anything else: step 7's recovery.
9. **Migrate**, the discrete step: `$C --profile migrate run --rm anchor-umami-migrate`. It applies
   `24_lowercase_username`, `25_add_annotation` and `26_add_api_key` and ends `All migrations have been
   successfully applied.` Then `uptime`. A failure here: step 7's recovery.
10. **Start the new server**: `$C up -d --wait anchor-umami`, then
    ```bash
    docker inspect -f '{{.Config.Image}} {{.State.Health.Status}}' cuatro-portfolio-anchor-umami-1
    docker logs cuatro-portfolio-anchor-umami-1 2>&1 | grep -c 'Applying migration'
    docker exec cuatro-portfolio-anchor-umami-1 curl -s http://127.0.0.1:3000/api/heartbeat
    uptime
    ```
    The 3.4.0 reference and `healthy`; `0`; `{"ok":true}`. Analytics is back.
11. **Verify, still through Caddy.** From the workstation, `https://analytics.cuatro.dev/api/heartbeat` and
    `https://analytics.cuatro.dev/script.js` answer 200 (`ops/bot-mitigation.md` rule 4 exempts both; the
    dashboard's 403 to a command line is the challenge). In a browser: **sign in** at
    `https://analytics.cuatro.dev` (a fresh sign-in, as above) and see the history back to 2026-08-17;
    then load `https://cuatro.dev` in a private window and scroll to the Suite Directory. On the box:
    ```bash
    docker exec "$DST" psql -U umami -d umami -Atc "select event_type||' '||count(*) from website_event where created_at > '$FROZE' group by event_type order by 1"
    docker exec "$SRC" psql -U umami -d umami -Atc "select count(*) from website_event where created_at > '$FROZE'"
    ```
    A first line of `1 1` or more (the fresh page view landed in the estate database), and `0` (the old
    store took nothing after the freeze).
12. **Move the hostname.** On the box first,
    `curl -sk -o /dev/null -w '%{http_code}\n' --resolve analytics.cuatro.dev:8443:127.0.0.1 https://analytics.cuatro.dev:8443/api/heartbeat`
    prints `200` (Traefik reaches the new container). On the workstation, with `CF` defined as in
    `ops/traefik-cutover.md` § Moving cuatro.dev and www, start a loop and leave it running to step 13:
    ```bash
    while :; do printf '%s %s %s\n' "$(date -u +%H:%M:%S)" \
      "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 https://analytics.cuatro.dev/api/heartbeat)" \
      "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "https://analytics.cuatro.dev/script.js?probe=$(date +%s%N)")"; sleep 1
    done | tee analytics-cutover-probe.log
    ```
    Then add the rule to the ruleset Story 4-6 created. If `RS` prints `none`, that section's step 3 says
    when the `PUT` that creates it is safe; never run it otherwise.
    ```bash
    RS=$(CF /phases/http_request_origin/entrypoint | jq -r 'select(.success) | .result.id'); echo "ruleset ${RS:-none}"
    [ -n "$RS" ] && CF "/$RS/rules" -X POST --data '{"description":"Story 4-7: analytics.cuatro.dev to Traefik on 8443","expression":"(http.host eq \"analytics.cuatro.dev\" and ssl)","action":"route","action_parameters":{"origin":{"port":8443}}}' | jq '.success, .errors'
    ```
    `true` and `[]`; keep the time as `MOVED`. After about a minute,
    `curl -sI "https://analytics.cuatro.dev/script.js?v=$(date +%s)" | grep -iE '^(HTTP|via)'` answers 200
    with **no `via: 1.1 Caddy` line**; on the box, `uptime`.
13. **Stop the loop and count**: `awk '{print $2, $3}' analytics-cutover-probe.log | sort | uniq -c` shows
    `200 200` alone. Then in the browser, sign in again through the new path, load `https://cuatro.dev` in
    a new private window, and re-run step 11's first query with `MOVED` in place of `FROZE`: a first line
    of `1 1` or more. `uptime`.
14. **Record** under a "Umami move run" heading here: the date, step 1's readings, `FROZE`, the step 6
    size, step 8's `counts-match` and event counts, step 9's output, step 11's and step 13's counts, the
    rule id (`CF "/$RS" | jq '.result.rules[] | {id, description}'`), and each `uptime`.
    `ops/routing-inventory.md` § Ingress and § Image identity each take a dated amendment:
    `analytics.cuatro.dev` served by Traefik through an Origin Rule, Umami 3.4.0 by digest on
    `estate-postgres`; Caddy's block and `anchor-db` remain, unreached, until Story 4.11. Keep
    `/home/deploy/pg-move/umami.dump` until Story 4.11.

**Rollback, at any step, the hostname first:**

- **R1, the hostname**: delete the rule. It takes effect at the edge; step 12's `curl -sI` shows
  `via: 1.1 Caddy` again, and Caddy proxies the same container.
  ```bash
  RS=$(CF /phases/http_request_origin/entrypoint | jq -r 'select(.success) | .result.id')
  ID=$(CF "/$RS" | jq -r '.result.rules[] | select(.description == "Story 4-7: analytics.cuatro.dev to Traefik on 8443") | .id')
  echo "rule ${ID:-not found}"; [ -n "$RS" ] && [ -n "$ID" ] && CF "/$RS/rules/$ID" -X DELETE | jq '.success'
  ```
- **R2, the data**: `$R up -d --wait anchor-umami` (with `C` and `R` set as above). The 3.3.0 server
  returns on `anchor-db`, which took no write after `FROZE` and was never migrated, so it serves exactly
  what it held at the freeze. Page views written to the estate `umami` since step 10 stay there and are
  not carried back: analytics rows, a loss stated and accepted (action 4 below). Dump them before anything
  else, so the retry's emptying never destroys the only copy:
  `docker exec "$DST" pg_dump -U umami -Fc umami > /home/deploy/pg-move/umami-after-r2.dump; echo "exit=$?"`,
  `exit=0`, and keep that file beside `umami.dump` until Story 4.11. The estate `umami` then stays as it is
  for the next attempt, which empties it first (step 7's recovery). A plain `$C up` of `anchor-umami` moves
  it forward again, so after R2 nobody runs one until the retry.
- **Never** `down -v`, `dropdb` or any write against `$SRC`, and never delete the dump before Story 4.11.

## Rollback, whole

Before any consumer moved: `$P down -v; rm -f ops/postgres/.env`. The box is as it was. After one has
moved, roll every moved consumer back first, one by one, then the same.

## Pending Operator actions

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| 1 | **Merge the commit carrying `ops/postgres/` into `main`** and let the Deploy run | The box checkout is `main`; nothing here reaches the box another way. PR #88 merged `dev` as `f9ea578`; Deploy run 36779534561 succeeded; the box checkout read `f9ea578` | 2026-09-30T21:27Z |
| 2 | **Confirm or overrule the decisions above**: PostgreSQL `18.6-trixie`, a stack beside the Anchor's, `max_connections=100` and the budget, `umami` keeping its name, finance included, the tournament staying on Supabase, and no move before Story 4.5 | The spec's Design Notes carry the reasoning. The Operator was present for the placement on 2026-09-30 and overruled nothing; an explicit word is awaited, so the row stays open | _not done_ |
| 3 | **Run § The placement, steps 1 to 5** | Nothing moves; only a fourth Postgres starts. Done: § Placement run, 2026-09-30 | 2026-09-30T22:16:07Z |
| 4 | **Confirm or overrule Story 4-7's decisions** in § Moving Umami: 3.4.0 by release and digest, the freeze, data before hostname, the override-file rollback, the page views written after step 10 not carried back by R2 (kept in `umami-after-r2.dump` only), the runbook here | The Story 4-7 spec's Design Notes carry the reasoning | _not done_ |
| 5 | **Merge the commit carrying Story 4-7 into `main`** and let the Deploy run | It rolls the Hub alone; the running Umami is untouched until § Moving Umami step 5. Done by PR #88, merged as `f9ea578`, which includes `6bb4c14` and `ec9d76e`; Deploy run 36779534561 | 2026-09-30T21:27Z |
| 6 | **Run § Moving Umami steps 1 to 14**, after action 3 here and `ops/postgres-backup.md` § Install and first run; steps 12 and 13 also after `ops/traefik-cutover.md` actions 1 to 4 and the Origin Rules token | Step 14 amends `ops/routing-inventory.md` | _not done_ |

**Maintaining this file.** When an action is performed, replace its cell with the ISO 8601 UTC date and
leave the row in place.
