# The tournament placement

How `cs-tournament` goes onto the box at `tournament.cuatro.dev`: its two deploy units, `tournament`
(the Next.js server) and `tournament-worker` (the Go demo worker), started from the images CI builds
from `apps/tournament`, behind the shared Caddy, and how to take it back. It is the artifact the
placement half of Story 3-7 delivers, in the shape `ops/tracker-cutover.md` set.

This file is a record, not Registry data. Every value is marked as a decision or an observation, and
the two are never presented as the same kind of fact (NFR-9).

**Nothing here has run on the box. Written 2026-09-29, committed on `dev`.** The session that wrote it
has no route to the box. The orchestrator runs the sequence below as `deploy`, and dates each Pending
Operator action at the end as it goes. Until action 3 is dated, nothing serves `tournament.cuatro.dev`.

## What is already done

**Observed 2026-09-29 by the Operator and the orchestrator, relayed to the authoring session** (all
times UTC). None of these is repeated by the sequence; step 1 re-reads the ones the box holds.

| Fact | Value |
|---|---|
| WAF | Rules 1 (crawler block) and 3 (empty user agent challenge) list `"tournament.cuatro.dev"`, ruleset versions 5 and 6 at 22:03:32Z, read back (`ops/bot-mitigation.md`) |
| DNS | `A tournament.cuatro.dev 177.7.52.248`, proxied, created 22:03:33Z with the comment `cs-tournament placement, Story 3-7`; it resolves through Cloudflare (`ops/routing-inventory.md`) |
| Certificate | The Caddy origin certificate on the box covers `*.cuatro.dev`, so the block needs no new one |
| Secrets | `/home/deploy/cuatro-portfolio/.env.production` carries fifteen `TOURNAMENT_` values, moved from the Operator's local `cs-tournament` `.env.local` without printing: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `STEAM_API_KEY`, `STEAM_REALM` (`https://tournament.cuatro.dev`), `STEAM_RETURN_URL` (`https://tournament.cuatro.dev/auth/steam/callback`), `AUTH_NONCE_SECRET`, `ADMIN_STEAMIDS`, `DATABASE_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_S3_ENDPOINT`, `WORKER_MATCHZY_SHARED_SECRET` |
| Build inputs | Repository variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set on `LuigiEspinosa/cuatro-portfolio` (public by design), which `image-tournament.yml` passes as build arguments (DW-281) |
| Images | The GHCR packages `tournament` and `tournament-worker` are public: anonymous manifest pulls answered 200, so the box needs no read token (DW-278) |
| Supabase | The project was paused when first probed (its host resolved nowhere); the Operator restored it, and its auth endpoint answers 401, alive, from the box and elsewhere |
| Database route | `TOURNAMENT_DATABASE_URL` is the session pooler, `postgres.<ref>@aws-0-us-east-1.pooler.supabase.com:5432` with `sslmode=require`, proved from a container on the box (PostgreSQL 17.6 answered) |
| Identity | `node ops/tournament-identity.mjs export` refused, by design, naming the project's one Auth user, the admin (a Steam-style synthetic email, created 2026-07-02), because it holds a password hash. See Identity below |

## Decisions

**Operator rulings, 2026-09-29:**

- **The data stays in Supabase Cloud** (DW-280, option one). It is declared as the tournament's store,
  an exception to AD-10's one Postgres on the box, and its offsite backup is the Operator's, on
  Supabase's side. Nothing moves, so `anchor-db` gains nothing and no migrate service exists.
- **The hostname is `tournament.cuatro.dev`**, declared in the Registry's `live` and never derived (AD-3).
- **The Go worker gets no public hostname.** It stays on the project's own compose network. A consequence
  is filed as DW-287: MatchZy's upload and the admin's presigned demo upload need the worker reachable
  from outside, so both wait for a route.

**Decisions of the authoring session:**

- **The pooler, not the direct host.** Supabase's direct host `db.<ref>.supabase.co` answers on IPv6
  only, and `cuatro-portfolio_default` has no IPv6 (`docker network inspect`: `EnableIPv6` false), so
  the worker reaches Postgres through the session pooler. `apps/tournament/worker/config/config.go`
  already says a host without IPv6 must use it.
- **By hand, from the checkout.** No deploy starts the `tournament` profile; wiring it into `deploy.yml`
  is DW-275's, in Epic 4. Placement is the tracker's pattern (DW-275 names both now).
- **The Registry release lands after the placement.** `dev` carries the compose networks, the build
  inputs, the gate's placement, the Caddyfile fragment, this file and the records, with the Registry at
  1.6.0: Registry 1.7.0 (`9099973`, `cs-tournament` `Live` at `https://tournament.cuatro.dev`) was
  committed and then held back by `6d72963`, so `dev` pushes whole at any time. The release is
  `git revert 6d72963`, made only after step 6 has answered from off the box, so no Registry on `main`
  points at a URL that does not serve (FR-28), and the Suite Directory never renders a dead link.
- **Containers before Caddy.** The site block is added once both containers are healthy, so the
  hostname never proxies to nothing for longer than the reload.

## Identity

The merge half's spec said no user holds a password (its Decision 4). **That premise is off by one.**
The export refused on the project's only Auth user, the admin, created 2026-07-02 with a Steam-style
synthetic email, because it holds a password hash. The script's refusal stays as it is: it exists so a
move never forces anyone through a reset. The data does not move under the ruling above, so no hash is
touched and no reset can be forced, and the export and verify pair has nothing to carry.

The criterion "authenticate as an existing user after the move" is therefore proven by the Operator
signing in through Steam on `https://tournament.cuatro.dev` once it serves, landing as the admin. The
Operator dates it in action 4.

## The sequence

On the box as `deploy`, in `/home/deploy/cuatro-portfolio` unless a step says otherwise.
**Preconditions:** `dev` through `6d72963` or later, without the release, is on `main` and the Deploy workflow has run, so this checkout
holds it; and a commit on `main` carrying it has a green **Image (tournament)** run (both jobs), whose
sha is `TOURNAMENT_TAG`. An image from before that commit was built without the public Supabase values.

Every compose command names `HUB_TAG` too. Compose interpolates the whole file whichever service it
runs, and the Hub's image line refuses an unset tag; the running Hub's sha is the value that changes
nothing.

```bash
cd /home/deploy/cuatro-portfolio
export HUB_TAG="$(git rev-parse HEAD)"
export TOURNAMENT_TAG=<the sha whose Image (tournament) run is green>
C='docker compose --env-file .env.production'
```

1. **Re-read what the placement stands on, and stop at the first difference.**
   `docker ps --format '{{.Image}}' | grep "hub:$HUB_TAG"` prints the running Hub;
   `grep -c '^TOURNAMENT_' .env.production` prints 15;
   `grep -n 'tournament' /home/deploy/cs-tracker/Caddyfile` prints nothing;
   `$C --profile tournament config --services` lists `tournament` and `tournament-worker`;
   `docker ps --format '{{.Names}}' | grep tournament` prints nothing; and `uptime`, whose load
   averages are the before reading for step 7. A difference is a finding: record it here.
2. **The gate, from the workstation.** The box has no `node` (`ops/backup-digital-library.md`, observed
   2026-08-24), so this step runs in a checkout on the workstation at the sha step 1's `HUB_TAG` names:
   `node ops/capacity-gate.mjs cs-tournament` exits 0, naming `placements`, and
   `grep -x 'status: open' ops/capacity-gate.yml` prints the line. The first command alone passes whatever
   `status` says, because the id is already an incumbent (the run before the entry was appended is in the
   Story 3-7 spec), so the second is the check that the gate is open. The gate reads only its own file
   (`ops/capacity-threshold.md` § limits), so the live check is step 1's `uptime`: if its load15 reads
   0.60 or more, stop and follow `ops/capacity-threshold.md` before placing.
3. **Pull.** `docker pull ghcr.io/luigiespinosa/tournament:$TOURNAMENT_TAG` and
   `docker pull ghcr.io/luigiespinosa/tournament-worker:$TOURNAMENT_TAG`, both without credentials.
4. **Start both, and wait for both healthchecks.**
   `$C --profile tournament up -d tournament tournament-worker`, then repeat
   `docker inspect --format '{{.State.Health.Status}}' cuatro-portfolio-tournament-1 cuatro-portfolio-tournament-worker-1`
   until both print `healthy` (about a minute; `unhealthy` means stop and read `docker logs`).
   `docker logs cuatro-portfolio-tournament-worker-1 2>&1 | tail -20` shows no configuration error.
   Then from the ingress: `docker exec cs-tracker-caddy-1 wget -qO- http://tournament:3000/api/health`
   prints `{"status":"ok"}`, and `docker exec cs-tracker-caddy-1 wget -qO- http://tournament-worker:8080/healthz`
   fails, since the worker is not on that network.
5. **Add the site block and reload Caddy.**
   ```bash
   cp /home/deploy/cs-tracker/Caddyfile /home/deploy/cs-tracker/Caddyfile.bak-3-7
   { printf '\n# --- cs-tournament: tournament.cuatro.dev. Story 3-7. ---\n'
     sed -n '/^tournament\.cuatro\.dev {/,/^}/p' docker/Caddyfile; } >> /home/deploy/cs-tracker/Caddyfile
   docker exec cs-tracker-caddy-1 caddy validate --config /etc/caddy/Caddyfile
   docker exec cs-tracker-caddy-1 caddy reload --config /etc/caddy/Caddyfile
   ```
   `validate` prints `Valid configuration` before the reload; if it does not, restore the backup as
   the rollback below says and stop. The block is the one `docker/Caddyfile` carries, copied rather than retyped.
6. **Probe from off the box**, from the workstation, with a browser user agent:
   `https://tournament.cuatro.dev/api/health` answers 200 `{"status":"ok"}` with a `cf-ray` header and
   the three origin headers; `https://tournament.cuatro.dev/` answers 200. The rules, as
   `ops/bot-mitigation.md` proved them for `wheel`: as `GPTBot` 403; with an empty user agent 403 and
   `cf-mitigated: challenge`; as `UptimeRobot/2.0` 200; as
   `cuatro-registry-verification/1 (+https://cuatro.dev/contracts/registry.json)` 200. Then re-check
   that `cuatro.dev`, `tracker.cuatro.dev`, `cs-tracker.cuatro.dev`, `library.cuatro.dev`,
   `wheel.cuatro.dev` and `analytics.cuatro.dev` answer as before the reload.
7. **The load reading (SM-C4).** Fifteen minutes after step 4, `uptime` and
   `docker stats --no-stream cuatro-portfolio-tournament-1 cuatro-portfolio-tournament-worker-1`, written
   here under a "Placement run" heading beside step 1's reading and against the 0.60 threshold.
   `ops/capacity-threshold.md` charged `cs-tournament` one Anchor-shaped pair (Step 2); the reading says
   whether the charge stands. SM-C4 wins every conflict with any other metric.
8. **Monitor it.** An UptimeRobot monitor on `https://tournament.cuatro.dev/api/health` with the settings
   `ops/monitoring.md` fixes for every monitor, and a row there, since the monitored set is every live
   `cuatro.dev` subdomain.
9. **The identity proof.** The Operator signs in through Steam on `https://tournament.cuatro.dev` and
   lands as the admin (action 4).
10. **Release the Registry.** On the workstation, on `dev`: `git revert --no-commit 6d72963`, which
    restores Registry 1.7.0 and its pins exactly as `9099973` and `28bc579` left them, then one
    subject-only `git commit -m "feat(3-7): release Registry 1.7.0 ..."`; run the suite; push `dev` and
    merge it into `main`. The next Registry verification reads
    `PASS  cs-tournament live: https://tournament.cuatro.dev`. A push that changes
    `contracts/registry.json` starts `registry-verification.yml`, which fetches the URL, so this commit
    is made only after step 6 has answered; before it, `dev` holds Registry 1.6.0 and a push of `dev`
    verifies only what already serves.

**Rollback, at any step:** remove the site block by restoring the backup in place,
`cp /home/deploy/cs-tracker/Caddyfile.bak-3-7 /home/deploy/cs-tracker/Caddyfile`, never `mv`: the
Caddyfile is a single-file read-only bind mount into `cs-tracker-caddy-1` (`ops/routing-inventory.md`),
so a new inode leaves the container reading the old file across the reload. Reload as in step 5, then
`$C --profile tournament stop tournament tournament-worker`. The data never moved, so nothing is
restored. If Registry 1.7.0 is already on `main`, the same change that rolls back takes the entry to
`Complete` and removes its `live` (FR-28). If the placement is abandoned rather than retried, that change
also removes `cs-tournament` from `placements` in `ops/capacity-gate.yml`: an id listed there always
deploys, so a stale entry would let a later attempt pass the gate as an incumbent (AD-9).

**Later rollouts** of a new tournament sha are by hand until DW-275 wires a deploy per id: pull both tags,
then `$C --profile tournament up -d tournament tournament-worker` with the new `TOURNAMENT_TAG`, which
recreates both. Not rehearsed: `docker rollout --env-file .env.production tournament` would keep the
server up across it, as Story 3-4 proved for the Hub alone.

## After the placement

- This file: a "Placement run" heading with the date, step 1's and step 7's readings, step 6's codes,
  and each Pending Operator action dated. If the placement runs on a later day than 2026-09-29, the
  `observed` date of `cs-tournament` in `ops/capacity-gate.yml` moves to that day.
- `ops/routing-inventory.md`: the block as installed under § The site blocks, and `tournament` in the
  shared network's alias table, dated.
- `ops/estate.md` § `cs-tournament`: the placement dated, and the identity proof.

## Placement run

**Observed 2026-09-30 (UTC, the evening of 2026-09-29 for the Operator) on the box as `deploy`, over
the Operator's WSL key, with the Operator watching.** `HUB_TAG` and `TOURNAMENT_TAG` were both
`019394ddfad3e2063847c1da047749b611fe0764`, the merge commit of PR #86 (dev at `793af18`), which the
Deploy run 36648915282 had put on the box (gate, image / hub and deploy green) and whose Image
(tournament) run passed both jobs on that sha.

- **Step 1, no difference.** The running Hub was `hub:019394d...`; `.env.production` held 15
  `TOURNAMENT_` lines; the shared Caddyfile had no `tournament` line; the profile listed `tournament`
  and `tournament-worker`; no tournament container ran. Before reading, 00:11:30Z: load average
  `0.20, 0.17, 0.11`.
- **Step 2.** From the workstation at the same sha: `capacity gate: cs-tournament is in placements,
  the deploy may proceed`, exit 0, and `status: open`. load15 0.11 against the 0.60 threshold.
- **Step 3.** Both tags pulled without credentials.
- **Step 4.** Both containers started at 00:11:55Z and read `healthy healthy` after 8 s. The worker
  logged `worker listening on :8080 (POST /ingest/matchzy, POST /ingest/parse, POST /ingest/presign)`.
  From `cs-tracker-caddy-1`, `http://tournament:3000/api/health` answered `{"status":"ok"}` and
  `http://tournament-worker:8080/healthz` was unreachable, as intended.
- **Step 5.** Backup written to `Caddyfile.bak-3-7`; the block appended from `docker/Caddyfile`;
  `caddy validate` printed `Valid configuration` (with the standing OCSP-stapling warning for the
  origin certificate, which every reload prints); reload exit 0 at 00:12:23Z.
- **Step 6, from the workstation.** `/api/health` with a browser user agent: 200 `{"status":"ok"}`,
  `cf-ray` present, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`; `/` 200. `GPTBot` 403; empty user agent 403 with
  `cf-mitigated: challenge`; `UptimeRobot/2.0` 200; the registry-verification agent 200. Afterwards
  `cuatro.dev` and `tracker.cuatro.dev` `/api/health` 200, `cs-tracker.cuatro.dev` and
  `library.cuatro.dev` 302, `wheel.cuatro.dev` 200, `analytics.cuatro.dev/api/heartbeat` 200, as before.
- **Step 7 (SM-C4), 00:26:57Z, fifteen minutes after step 4:** load average `0.19, 0.26, 0.19`;
  `cuatro-portfolio-tournament-1` 0.00 % CPU, 68.45 MiB; `cuatro-portfolio-tournament-worker-1`
  0.00 % CPU, 8.29 MiB; both `healthy`. load15 stayed under the 0.60 threshold, so the charge
  `ops/capacity-threshold.md` made for `cs-tournament` stands.
- **Step 8.** UptimeRobot monitor 804128109, `tournament.cuatro.dev /api/health`, HTTP, 300 s, timeout
  30 s, SSL errors checked, alert contact 8726805, created 00:13:10Z, UP from its first check
  (`ops/monitoring.md`).
- **`ops/capacity-gate.yml`:** the entry's `observed` moved from 2026-09-29 to 2026-09-30, the UTC
  day the placement ran, as § After the placement says.
- **Step 9, and what it found.** The Operator's first two Steam sign-ins came back to `/` with no
  `login=error` and no visible change. Server side, everything answered: the login route 307s to
  Steam with realm `https://tournament.cuatro.dev` and the nonce cookie `SameSite=lax`; the container
  reaches Steam and Supabase; the service role key is accepted. The container log carried
  `Could not find the table 'public.leaderboard' in the schema cache`, and the Supabase project
  turned out to hold migrations 0001 to 0003 only, against 0029 in `apps/tournament/supabase/migrations`:
  the project the Operator's `.env.local` named is the development project, 26 migrations behind the
  code, with one Auth user and one player. **Operator ruling 2026-09-30:** it is the store; apply the
  migrations. Done as a discrete step from the box through the pooler at 00:54Z: a `pg_dump -Fc -n public`
  first, kept at `/home/deploy/backups/cs-tournament/pre-migrations-20260930T005415Z.dump` (28,571
  bytes), then `0004_roster.sql` to `0029_verification_bundle.sql` in order, one transaction each,
  every one `OK`, each recorded in `supabase_migrations.schema_migrations` (29 rows after), then
  `NOTIFY pgrst, 'reload schema'`; the `leaderboard` view then answered through the API and the home
  page rendered with no error logged. The next sign-in completed: `auth.users.last_sign_in_at` reads
  **2026-09-30T01:01:26Z** for the admin, whose `app_metadata` carries `steamid64` and `role`
  (`admin`, matching `public.app_role`). That is the identity proof (action 4). The viewer surface
  shows no signed-in state at all, since `app/(viewer)/page.tsx` renders the sign-in link
  unconditionally and only the API routes read the session, which is why the Operator read a
  working login as a failed one: filed as DW-290. That the app's schema changes have no discrete
  step on this store is DW-291.

## Backup

**Written 2026-09-30 for the Epic 3 retrospective's action 4 (finding M4, AD-10). Nothing here has run on
the box yet.** The ruling above made the store's offsite backup "the Operator's, on Supabase's side",
and what the Supabase project's plan backs up was never confirmed. This is the copy off Supabase's side
that the estate controls: a nightly dump from the box, proved by a restore.

**What runs.** `ops/tournament-backup.sh`, installed as `/home/deploy/tournament-backup.sh` and run by
`deploy`'s crontab the way `~/cuatro-backup.sh` runs. It reads `TOURNAMENT_DATABASE_URL` from
`/home/deploy/cuatro-portfolio/.env.production` without sourcing the file, runs
`pg_dump -Fc -n public -n supabase_migrations` through the session pooler in a one-shot
`postgres:17-alpine` client (the URL reaches the container through its environment, never an argv),
and writes `tournament-<stamp>.dump`, `.dump.counts` (every table with its row count, read right after
the dump) and `.dump.sha256` into `/home/deploy/backups/cs-tournament`, all `0600`. After a good dump it
removes `tournament-*` files older than 14 whole days (`find -mtime +14`, so 15 in effect, as
`ops/backup-digital-library.md` § Retention reckons it); the placement's `pre-migrations-*` dump is never
matched. One summary line, exit 0 or 1. `supabase_migrations` rides along because it is the migration
ledger the proof compares.

**The proof.** `ops/tournament-restore-verify.sh <dump>` restores into a throwaway `postgres:17-alpine`
with no network (the three Supabase roles the policies name created first, owners and grants skipped),
requires the sha256, every table and every count equal, and every file under
`apps/tournament/supabase/migrations` present in the restored ledger by version, then removes the
container on every path. The nightly job does not run it; it is run by hand after the first dump and
whenever a dump is about to be relied on.

**The cron line**, the third in `deploy`'s crontab beside the two `ops/backup-digital-library.md`
records. 03:45 UTC is the library job's minute too; this dump is tens of kilobytes, so the two overlap at
no measurable cost.

```
45 3 * * * /home/deploy/tournament-backup.sh >> /home/deploy/backups/cs-tournament/backup.log 2>&1
```

**Install and first run, as `deploy` on the box** (action 6 below). The box's checkout follows `main`, so
until this commit reaches `main` the two files come from a `dev` checkout, copied into `/home/deploy/`.

1. `sha256sum ~/tournament-backup.sh ~/tournament-restore-verify.sh` must print, as committed on
   2026-09-30, `25fe9d02f235e0a43a579d037d06ab9ce10a9c158bfac8e1c3ea1a4edf3be35d` and
   `9ed8b79a68d2a75881edc70f0614901c4ea364b84e72460ec17e781bd70d805d`. Stop if not: a CRLF copy
   (`.gitattributes` keeps `*.sh` LF in a checkout) or a later edit both show here.
2. `chmod 0700 ~/tournament-backup.sh ~/tournament-restore-verify.sh`.
3. One run in the shape cron runs it:
   `env -i HOME=/home/deploy LOGNAME=deploy PATH=/usr/bin:/bin SHELL=/bin/sh /home/deploy/tournament-backup.sh`.
   It must exit 0 and its line read `dump=ok list=ok`, `supabase_migrations.schema_migrations` must be in
   the `.counts` file at 29, and `sha256=` must be a digest.
4. `TOURNAMENT_MIGRATIONS_DIR=/home/deploy/cuatro-portfolio/apps/tournament/supabase/migrations
   ~/tournament-restore-verify.sh /home/deploy/backups/cs-tournament/tournament-<stamp>.dump`, the dump
   step 3 named. It must end `restore=ok` and `migrations=29-applied-0-pending exit=0`. The store is
   live, so a sign-in between steps 3 and 4 can fail the count comparison by one row; if it names a
   table, repeat steps 3 and 4 once before reading it as a fault. The proof takes each migration's
   version as its file name's digits before the first `_`, as the Supabase CLI records it; the
   placement wrote rows 0004 to 0029 by hand, so if it names every one of those as missing, read
   `SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY 1` through the pooler
   before reading it as a store behind the code, and record what it shows.
5. `( crontab -l; echo '45 3 * * * /home/deploy/tournament-backup.sh >> /home/deploy/backups/cs-tournament/backup.log 2>&1' ) | crontab -`,
   then `crontab -l` must list three jobs.

**What to record here** under a dated "First backup run" heading: both summary lines as printed, the
dump's byte size, the `.counts` file, `crontab -l`, and the two installed digests; then date action 6,
amend `ops/estate.md` § `cs-tournament` from "written" to "running", and mark the board's
`epic-3-retro-item-32-establish-and-record-the-tournament-stor` done. If step 3 or 4 fails, record the
line and the stderr, leave the cron uninstalled, and file a DW entry.

**Named limits.**

1. **One copy, on the box.** The dump is off Supabase's side, which is what AD-10's exception needs, but
   it is not shipped anywhere else: losing the box and Supabase together loses both. `library-backup.sh`
   is the estate's one job with a third site.
2. **RPO 24 hours**, and nothing alerts on a failing night: the log is read by hand, as for the other two
   jobs (`ops/backup-digital-library.md` named limit 3).
3. **Row level security.** `pg_dump` runs with `row_security` off, so if the pooler's `postgres` user did
   not bypass the policies the dump would fail loudly rather than write a partial copy. The placement's
   pre-migration dump of `public` succeeded as that user, which answers it for the schema then; step 3
   answers it for all 29 migrations.
4. **What Supabase itself keeps is still unconfirmed.** The retrospective's open question (which plan,
   what it backs up) stands; this job does not depend on the answer.

## Pending Operator actions

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| 1 | **Push `dev` and merge it into `main`** without the release, and let the Deploy run | The compose networks, the gate's placement and the build inputs reach the box and GHCR only this way. The Registry stays at 1.6.0 (`6d72963`). PR #86 merged as `019394d`; Deploy run 36648915282 green | 2026-09-29T23:58Z |
| 2 | **Note the green Image (tournament) run** on a `main` sha carrying it | Its sha is `TOURNAMENT_TAG`. The workflow ran on the merge commit `019394d` itself, both jobs green | 2026-09-30T00:05Z |
| 3 | **Run steps 1 to 8 above** | Step 1's and step 7's readings and step 6's codes go into this record. § Placement run | 2026-09-30T00:27Z |
| 4 | **Sign in through Steam** on `https://tournament.cuatro.dev` as the admin | The identity proof (§ Identity). Observed server side as `last_sign_in_at` with the `steamid64` and `role` claims bound (§ Placement run, step 9), after the migration catch-up | 2026-09-30T01:01:26Z |
| 5 | **Release Registry 1.7.0** (step 10: the revert of `6d72963`) and merge it into `main` after step 6 answered | FR-28. Released as `4d467ba` on `dev`; its push's Registry verification run passed 41 of 41 with `PASS cs-tournament live: https://tournament.cuatro.dev answered 200`; the home surface's hit-target pin moved to 22 for the new live link (`ops/hit-target-floor.md`); PR #87 merged as `373e33d`, Deploy run 36655346368 green, and `https://cuatro.dev/contracts/registry.json` served `contract_version` 1.7.0 with the entry `Live` right after | 2026-09-30T01:30:33Z |
| 6 | **Install the nightly dump and run it once** (§ Backup, steps 1 to 5) | The store's copy off Supabase's side (AD-10, retrospective action 4). Record what § Backup lists under a "First backup run" heading | _not done_ |

**Maintaining this file.** When an action is performed, replace its cell with the ISO 8601 UTC date and
leave the row in place.
