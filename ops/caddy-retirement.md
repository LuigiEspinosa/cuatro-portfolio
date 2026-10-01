# The Caddy retirement

How the shared Caddy leaves the box, Traefik takes 80 and 443 itself, the Cloudflare Origin Rules that
carried each hostname to 8443 go, and the three Postgres 16 stores the Epic 4 moves left behind as rollback
copies are retired, each after a final dump is written and copied offsite. It is the artifact Story 4-11
delivers (AD-7, AD-8, AD-10, AD-20, AD-26), on the stacks Stories 4-2 to 4-10 placed, in the shape
`ops/traefik-cutover.md` and `ops/cs-tracker-cutover.md` set.

This file is a record, not Registry data. Every value is marked as a decision or an observation, and the
two are never presented as the same kind of fact (NFR-9). Times are UTC.

**Nothing here has run on the box, in the zone or in another repository. Written 2026-10-01, committed on
`dev`.** The authoring session read the box but wrote nothing to it, and wrote nothing to
`LuigiEspinosa/cs-tracker`: the two changes that repository needs are § The cs-tracker changes, for the
Operator to land. Every box step is a Pending Operator action at the end.

**Amended 2026-10-01: § The sequence ran**, steps 1 to 15 from 05:02Z to 06:12Z, by the orchestrator with the
Operator present, recorded under § Retirement run, and step 16 is this record's amendments. Both `cs-tracker`
changes landed on that repository's `main` (`9a5a4be`, `bde2b3f`). Caddy, the 8443 instance, every Origin
Rule and the three old Postgres stores are gone; `traefik-ingress-1` holds 80 and 443. The sections above
keep the tense they were written in: "today" in them is before the run.

**Why a record of its own.** Decision, Story 4-11, the Operator may overrule. It retires stores as well as
a proxy: `ops/traefik-cutover.md` owns the per-hostname mechanism and its rollback, which step 2 and step 6
reference rather than restate, and `ops/postgres.md` owns the estate instance, which this file only reads.
A section in either would split one decommissioning across two files.

## Contents

1. [What serves today](#what-serves-today)
2. [Every hostname, accounted on the new topology](#every-hostname-accounted-on-the-new-topology)
3. [Plain HTTP and TLS once Caddy is gone](#plain-http-and-tls-once-caddy-is-gone)
4. [Why two instances at once](#why-two-instances-at-once)
5. [What Story 1.7 found, and what becomes of it](#what-story-17-found-and-what-becomes-of-it)
6. [The old stores](#the-old-stores)
7. [What this story leaves open](#what-this-story-leaves-open)
8. [Rehearsed off the box](#rehearsed-off-the-box)
9. [The cs-tracker changes](#the-cs-tracker-changes)
10. [The sequence](#the-sequence)
11. [Retirement run](#retirement-run)
12. [Pending Operator actions](#pending-operator-actions)

## What serves today

**Observed 2026-10-01T02:33Z to 02:38Z over SSH as `deploy`, read-only** (`docker ps -a`, `docker volume
ls`, `docker inspect` of environment names only, `crontab -l`, `ss -ltn`, `git` and `sha256sum` in
`/home/deploy/cs-tracker`, `ls`, `cat` of the move's stamp and counts files, `sudo iptables -S`,
`sudo ufw status`, `sudo ls` of one volume's directory). Load `0.17, 0.33, 0.31`.

| Fact | Value |
|---|---|
| Listening | `0.0.0.0` and `[::]` on 80 and 443 (`cs-tracker-caddy-1`), on 8443 (`traefik-traefik-1`), and `127.0.0.1:8080` (Traefik's dashboard); 22; loopback DNS and `monarx-agent` |
| Caddy | `cs-tracker-caddy-1`, `caddy:2`, `Up 2 months`, a service of the `cs-tracker` compose project; `/home/deploy/cs-tracker/Caddyfile` sha256 `0a3a92f7a1f3bca4dac867481894702cc2491d443b6895aeed2059df4d0a7a01`, `git diff --stat` 95 insertions over `HEAD` (`ca75686`); six untracked backups beside it (§ What Story 1.7 found) |
| Traefik | `traefik-traefik-1`, `traefik:v3.7.13`, `Up 5 hours (healthy)`, service `traefik` of project `traefik`, from `ops/traefik/` at `f9ea578`; the Origin CA pair from `cs-tracker_caddy_data`'s `origin-ca` subpath |
| Origin Rules | Seven in ruleset `518ad07108bc402fa36ad71fe1e76862`, each `(http.host eq "<host>" and ssl)` to port 8443 (the table below); not re-read here, from the move records |
| The estate Postgres | `postgres-estate-postgres-1`, `postgres:18.6-trixie`, healthy; databases `umami`, `cuatro_tracker`, `cs_tracker`, `cuatro_finance`; nightly `postgres-backup.sh` at 03:15 to restic in R2 (`/etc/cuatro/postgres-backup.env`, `root:deploy` `0640`) |
| The old stores | `cuatro-portfolio-anchor-db-1` (`postgres:16-alpine`, volume `cuatro-portfolio_postgres_data`), `cuatro-tracker-postgres-1` (`postgres:16-alpine`, `cuatro-tracker_pg_data`), `cs-tracker-db-1` (`postgres:16`, `cs-tracker_pgdata`), all healthy and unreached; each container's environment names `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` |
| Old containers stopped | `cuatro-tracker-app-1` and `cuatro-tracker-worker-1` (`Exited (0) 29 hours ago`), `cuatro-tracker-migrate-1` (6 weeks), `cs-tracker-migrate-1` (5 days) |
| Still running in `cuatro-tracker` | `cuatro-tracker-redis-1` and `cuatro-tracker-qbittorrent-1`, which the tracker uses (DW-306) |
| Cron, `deploy` | 03:15 `postgres-backup.sh`, 03:30 `cuatro-backup.sh` (dumps `cuatro-tracker-postgres-1`), 03:45 `library-backup.sh` and `tournament-backup.sh` |
| The move leftovers | `/home/deploy/pg-move`: `umami.dump` (68577 bytes), `cs_tracker-20261001T003549Z.dump` (1261786) and its `.counts`, the stamps `FROZE` (`2026-09-30T22:56:35Z`), `TRACKER_FROZE` (`2026-09-30T23:54:51Z`), `TRACKER_DUMP`, `CST_DUMP`, five logs and two `.out` files, `umami-rollback.yml`, `tracker-rollback.yml` (an override naming the old `DATABASE_URL`) and `cs-tracker.env.pre-4-10` (`0600`). `/home/deploy/backups/cuatro-tracker`: fifteen nightly `cuatro-*.dump`, `backup.log`, and `tracker-20260929T210552Z.dump` and `tracker-20260930T235451Z.dump`, each with `.counts` and `.sha256` |
| Firewall | `DOCKER-USER`: 15 IPv4 and 7 IPv6 `RETURN` rules on `--dports 80,443,8443`, then the drop (17 and 9 lines of `-S`); `ufw`: 22 rules `8443/tcp ALLOW` beside the 22 on `80,443/tcp`; `/usr/local/sbin/cf-origin-firewall.sh.bak-4-2` holds the 80 and 443 version |
| Volumes | `cs-tracker_caddy_config`, `cs-tracker_caddy_data`, `cs-tracker_pgdata`, `cuatro-portfolio_postgres_data`, `cuatro-tracker_pg_data`, `cuatro-tracker_qb_config`, `cuatro-tracker_redis_data`, `digital-library_redis_data`, `postgres_pgdata`, `traefik_acme`, and one anonymous volume, `4fc208dc72207d649d6ae09d4d7cfbc374dca965787537f1cc5869ad92953a49`, created 2026-09-30T08:04:07Z, no container, a Postgres data directory (DW-307's) |

The counts the moves recorded, which steps 12 to 14 hold the old stores to:

| Store | Recorded | Where |
|---|---|---|
| Umami, `anchor-db` | the source frozen at `2026-09-30T22:56:35Z`, `website_event` 88 rows; the estate copy `counts-match` at the move, 97 events by 23:51:55Z | `ops/postgres.md` § Umami move run, 2026-09-30 |
| The tracker | `Account 0`, `Achievement 0`, `MediaItem 0`, `MergeSuggestion 0`, `Session 0`, `User 1`, `UserEntry 0`, `VerificationToken 0`, `_prisma_migrations 11` | `/home/deploy/backups/cuatro-tracker/tracker-20260930T235451Z.dump.counts`, tab separated; `ops/tracker-cutover.md` § Estate Postgres move run |
| `cs-tracker` | `catalog_sync_state 1`, `inventory_entries 113`, `items 1974`, `ownership_marks 0`, `price_snapshots 21119`, `schema_migrations 10`, `steam_rate_limit_state 1`, `wishlist_entries 0` (Oban's tables left out, as the move did) | `/home/deploy/pg-move/cs_tracker-20261001T003549Z.dump.counts`; `ops/cs-tracker-cutover.md` § Move run, 2026-10-01 |

## Every hostname, accounted on the new topology

Every row of `ops/routing-inventory.md` § Every hostname in the zone, before anything is removed. Step 1
re-reads each claim, and nothing after step 2 starts until every box row reads Traefik.

| Hostname | DNS | Today, 2026-10-01 | Its Origin Rule | Traefik router, upstream | After this runbook | Monitor |
|---|---|---|---|---|---|---|
| `cuatro.dev` | A, proxied | Traefik on 8443 | `7fe531a5bc864203a3ba3a234b388aa4` (Story 4-6) | `cuatro-portfolio`, `anchor-app:3000` | `ingress` on 443, no rule | 803749849, 803756371 |
| `www.cuatro.dev` | A, proxied | Traefik on 8443 | `a74dce8a8d774473b9ed9cca0e0643c8` (Story 4-6) | `www`, `www-to-apex` (301 to a GET) | the same | 803756083 (GET) |
| `analytics.cuatro.dev` | A, proxied | Traefik on 8443 | `71197cf5c82d48ca80bddc5d5a89d23a` (Story 4-7) | `analytics`, `anchor-umami:3000` | the same | none, the managed challenge stops a monitor |
| `cs-tracker.cuatro.dev` | A and AAAA, proxied | Traefik on 8443 | `86b7df5f45ea4c998398cc724000196d` (Story 4-10) | `cs-tracker`, `app:4000`, `forwarded-proto-https` | the same | 803750016 |
| `tracker.cuatro.dev` | A and AAAA, proxied | Traefik on 8443 | `1ee043e45b2d46619c9881d2ae005902` (Story 4-8) | `cuatro-tracker`, `cuatro-app:3000` | the same | 803750023 |
| `library.cuatro.dev` | A and AAAA, proxied | Traefik on 8443 | `041740b5be6f41e588bbbc41f2af4e81` (Story 4-9) | `digital-library`, `library-web:3000`; `digital-library-api` for `/api/` and `/files/`, `library-api:4000` | the same | 803750025 |
| `wheel.cuatro.dev` | A, proxied | Traefik on 8443 | `a186cf20b402453fa147ec4b0626c50b` (Story 4-3) | `list-wheel`, `list-wheel:80` | the same | 803983277 |
| `tournament.cuatro.dev` | A, proxied | **Caddy on 443**, the one hostname no Epic 4 story moved (the epic predates the tournament) | **none; step 2 creates it** | `cs-tournament`, `tournament:3000`, the house headers: Caddy's block exactly (`ops/routing-inventory.md` § What Story 3-7 changes), held by `ops/__tests__/traefik-config.test.ts` | the same | 804128109 |
| Plain HTTP, every box hostname | n/a | Caddy on 80, 308 to `https://<host><path>` | none: the rules match `ssl` only | the `web` entrypoint's redirection | `ingress` on 80, 301 to a GET and 308 to the rest, same `Location` | none |
| `covidmap.cuatro.dev`, `future-vizion.cuatro.dev` | CNAME, DNS-only, to Vercel | Vercel, **not this box** | n/a | n/a | unchanged (KV-7) | 804092499, 804092500 |
| `_domainconnect.cuatro.dev` | CNAME, proxied, to Squarespace | **not this box**; no application | n/a | n/a | unchanged | none |
| The DNS-01 scratch hostname, `dns01-probe.scratch.cuatro.dev` | **no record**, by design (AD-26) | Traefik's `dns01-probe` router, its Let's Encrypt certificate in `traefik_acme`, reached only by SNI on the box | n/a | `dns01-probe`, `noop@internal` | `ingress` on 443, the same certificate (the volume is shared) | none, by design (`ops/traefik-cutover.md` § How certificate monitoring sees this) |
| `google._domainkey.cuatro.dev`, `_vercel.cuatro.dev` | TXT only | not serving names | n/a | n/a | unchanged | n/a |

**The ruleset reaches eight rules at step 2**, under the Free plan's ten, and none at step 6.

## Plain HTTP and TLS once Caddy is gone

**Decision, Story 4-11, the Operator may overrule.** Traefik takes 80 and 443 itself. `websecure` moves
from 8443 to 443, a `web` entrypoint on 80 redirects every request to https, every Origin Rule is deleted,
8443 is closed again at the origin firewall (the reverse of `ops/traefik-cutover.md` § The sequence step 3),
and the Origin CA pair moves into a volume of Traefik's own, `traefik-origin-ca`, filled from the box's
`/home/deploy/origin-ca/` copy, so nothing depends on `cs-tracker_caddy_data` any more (DW-296).

**Weighed against keeping 8443 and the rules as permanent configuration**, the alternative
`ops/settled-inputs-refresh.md` § What it leaves to Story 4.11 named:

| Question | Traefik on 80 and 443 | 8443 and the rules, permanent |
|---|---|---|
| Where routing lives | `ops/traefik/` alone, in git | eight rules in the zone, outside git, beside the routers that must agree with them |
| A new hostname | one router | one router and one rule, against the Free plan's ten (eight used) |
| The origin's open ports | 80 and 443, as before Epic 4 | 80, 443 and 8443, the third for nothing but the rules |
| Plain HTTP | Traefik's `web` redirect | something must still hold 80: Caddy, or a second entrypoint anyway |
| Cost of the change | one handover, below | none now, and the rules are a dependency nobody can see from the box |

**Plain HTTP keeps reaching the origin.** The zone's `always_use_https` is `off` (`ops/routing-inventory.md`
§ Zone settings), so a plaintext request travels to port 80, where Caddy answered `308 Permanent Redirect`
to the same host, path and query over https, to every method (observed 2026-10-01 from the workstation:
`GET` and `POST` on `http://cuatro.dev/some/path?q=1` and `HEAD` on four hostnames, each `308` with
`Location: https://<host>/some/path?q=1`). Traefik's entrypoint redirection with `permanent: true` answers
`301` to a GET and `308` to every other method, with the same `Location` and no port (§ Rehearsed off the
box). **Accepted**, as Story 4-6 accepted it for www: both are permanent, every browser follows both to the
same place, and no monitor watches plain HTTP. Turning `always_use_https` on instead would answer at the
edge and leave port 80 unused, a zone change this story does not need.

**TLS is unchanged for every client.** The edge still terminates (Full (strict), AD-26); the origin still
presents the same Origin CA certificate, now from `traefik-origin-ca`; no ACME runs for a proxied host; the
scratch hostname keeps its DNS-01 certificate in `traefik_acme`, which the new instance shares.

**The rollback, until step 11 removes Caddy's container:** stop the new instance and start Caddy again,
`$T stop ingress && docker start cs-tracker-caddy-1`. Caddy still holds all eight site blocks, every upstream
alias they name still answers, and Caddy's 443 serves every hostname whose rule is gone. Before step 7 the
8443 instance also still runs, so re-creating a hostname's rule moves just that hostname back to it.

## Why two instances at once

**Decision, Story 4-11, the Operator may overrule.** HTTPS never changes hands under traffic. A single
instance would have to be recreated to move from 8443 to 443, and during that recreate every hostname would
answer 521: the edge sends every hostname's HTTPS to 8443 until its rule is deleted, and nothing else can
listen there. So the new instance, service `ingress` of the same compose project, starts on 80 and 443 while
the 8443 instance (service `traefik`, Story 4-2's) keeps serving every rule; the rules are then deleted one
at a time, each hostname moving from one Traefik to the other with both answering; and the 8443 instance
stops last. `docker compose up` names it an orphan and leaves it running (§ Rehearsed off the box).

Three consequences, all deliberate:

- **The dashboard moves to loopback 8081.** The 8443 instance holds `127.0.0.1:8080` until step 7, so the
  new one cannot bind it; recreating the new instance later to take 8080 back would be a second handover
  for a loopback port. The SSH tunnel becomes `ssh -N -L 8080:127.0.0.1:8081 deploy@177.7.52.248`.
- **The service is named `ingress`, not `traefik`.** Two services of one project need two names. The
  container is `traefik-ingress-1`; the project, its network and its `traefik_acme` volume keep their names,
  so the scratch certificate carries over without a new issuance.
- **From step 4 to step 7 both instances mount the same `traefik_acme` and its `/acme/acme.json`.** Nothing
  coordinates two writers of that file, so the window must hold no write: its one certificate is the scratch
  hostname's, `notAfter` 2026-12-29, which Traefik renews only once thirty days remain, so not before
  2026-11-29, and the window is one session. Run steps 4 to 7 before 2026-11-29; later, read
  `docker logs traefik-traefik-1 2>&1 | grep -ci acme` first and stop the 8443 instance before a renewal is due.

**The one gap left is plain HTTP**, between Caddy's stop and `ingress` binding 80: about a second in the
rehearsal (the 443 column failed on two lines and the 80 column on one). Only plaintext requests, which receive a redirect,
fall in it; every HTTPS request is on 8443 at that moment.

**Between the merge and step 7 the 8443 instance must not restart.** It reads its static file once, at
start; the checkout's `ops/traefik/traefik.yml` becomes the 443 version at the merge's Deploy, and a restart
(a reboot, an unattended upgrade of Docker) would make it listen on 80 and 443 inside a container that
publishes 8443, and every rule would answer 521. So the merge comes right before step 3, in the same
session. If it does restart first: delete every rule (step 6's `del`, all eight), which sends every
hostname to Caddy's 443, and continue from step 3.

## What Story 1.7 found, and what becomes of it

Every item the routing inventory found on the old topology that this runbook touches, with its fate. **No
item is removed without being recreated or recorded here as dropped.**

| Found | Where | Fate | Step |
|---|---|---|---|
| Eight site blocks in a box-only Caddyfile, tracked in another project's checkout as ` M`, the `cs-tracker` block labelled `{$PHX_HOST}` | `/home/deploy/cs-tracker/Caddyfile` | **Recreated** as `ops/traefik/dynamic/routes.yml`'s routers, the label as the literal `cs-tracker.cuatro.dev` (the suite holds each router to its block). The file is **archived** with `git diff` against `HEAD`, then **dropped** by the `cs-tracker` change | 11 |
| Six hand-kept backups: `Caddyfile.bak-ops1` (`4ccdb298...`), `Caddyfile.bak-library-` (`e568267f...`), `Caddyfile.bak-1-3` (`ca2a9764...`), `Caddyfile.bak-1-21` (`a4b8f383...`), `Caddyfile.bak-2-25` (`47578600...`), `Caddyfile.bak-3-7` (`4de4bc19...`), sha256 read 2026-10-01 | beside it, untracked | **Archived offsite, then dropped**: each is an earlier state of the file above and routes nothing | 11 |
| The security headers per block, none on `cs-tracker`'s, `SAMEORIGIN` on the library's | the Caddyfile | **Recreated**: `house-headers`, `library-headers`, `library-api-headers`, and none on `cs-tracker` | done, Stories 4-2 to 4-10 |
| The HTTP to HTTPS redirect on port 80 | Caddy's automatic HTTPS | **Recreated**: the `web` entrypoint | 4 |
| The ACME contact preamble and `ACME_EMAIL` | the Caddyfile; `cs-tracker`'s compose and `.env` | **Dropped**: no ACME runs for a proxied host (AD-26), and the DNS-01 resolver registers without a contact. The `.env` line stays, unread (Pending action 6) | 11 |
| The admin API on `127.0.0.1:2019` and `443/udp`, exposed and unpublished | the Caddy container | **Dropped**: Traefik's dashboard on loopback replaces the one; HTTP/3 stays at the edge | 11 |
| `via: 1.1 Caddy` on every proxied response | Caddy's `reverse_proxy` | **Dropped**: Traefik adds none. Epic 4's runbooks used it to tell the two proxies apart, and no later check needs it | 4 |
| The Origin CA pair | `cs-tracker_caddy_data` at `origin-ca/`, and `/home/deploy/origin-ca/` | **Recreated** in `traefik-origin-ca` from `/home/deploy/origin-ca/`, compared byte for byte with Caddy's copy; `/home/deploy/origin-ca/` **kept** as the source | 3 |
| Caddy's ACME state from before 2026-08-17 (HTTP-01 certificates and account) | `cs-tracker_caddy_data` | **Archived offsite, then dropped**: the Origin CA replaced it on 2026-08-17 | 11 |
| Caddy's autosaved JSON | `cs-tracker_caddy_config` | **Archived offsite, then dropped**: a derived copy of the Caddyfile | 11 |
| The shared network, owned by the `cs-tracker` project | `cs-tracker_default` | **Kept, name unchanged.** Traefik and every upstream join it; renaming it would recreate every container on it. It outlives Caddy because `cs-tracker`'s `app` keeps it as that project's default network | none |
| The `cuatro-tracker` ingress override (gitignored) and `digital-library`'s untracked one (DW-187) | each project's checkout | **Kept**: they put the upstreams on `cs-tracker_default` under the aliases Traefik dials | none |
| A dormant `caddy` service under the `edge` profile in `cuatro-tracker` and in `digital-library`, and the four volumes they declare and never created | those projects' compose files | **Left as found**: other repositories' files, never started on this box, holding nothing. Removing them is a change in each repository, filed with DW-185's owners | none |
| The origin firewall | `/usr/local/sbin/cf-origin-firewall.sh`, its unit, `ufw` | **Kept**; 8443 removed again, the script restored from `cf-origin-firewall.sh.bak-4-2` | 9 |
| The `app` alias collision on the shared network | `cs-tracker_default` | Already ended, 2026-09-29 (Story 3-6) | none |
| `~/cuatro-backup.sh` and its 03:30 cron line | `deploy`'s crontab | **Dropped** with the store it dumps; its dumps archived offsite; the script kept beside the others as `.retired-<date>` | 13, 15 |
| The pre-Epic 3 tracker containers `cuatro-tracker-app-1`, `cuatro-tracker-worker-1`, `cuatro-tracker-migrate-1`, exited, no volume | `cuatro-tracker` project | **Dropped**: they read the store step 13 retires, and the tracker runs from GHCR since 2026-09-29 | 13 |
| `cs-tracker-migrate-1`, exited, the one-shot from before Story 4-10 | `cs-tracker` project | **Dropped**: `docker compose run --rm migrate` replaced it; it holds nothing | 14 |
| `CLOUDFLARE_API_TOKEN` in `cuatro-tracker`'s `.env`, `HETZNER_DNS_API_TOKEN` in `digital-library`'s | box `.env` files | **Unchanged**: the Operator's decision of 2026-08-27 not to revoke stands, and no step here reads them | none |
| `/home/deploy/backups/pre-9-3-20260813T063633Z.dump`, a `cs-tracker` dump of the old store from its own Story 9.3 | `/home/deploy/backups` | **Kept**: that project's artifact, not one this epic made; the Operator's clean start may drop it | none |
| The images nothing runs after this: `caddy:2`, `postgres:16`, `postgres:16-alpine`, `cuatro-tracker-app`, `cuatro-tracker-worker`, `cuatro-tracker-migrate` | the image store | **Kept**: images hold no data. Pruning them is Pending action 7 | none |
| The anonymous volume `4fc208dc...` of 2026-09-30T08:04:07Z | the volume store | **Left**: a tournament restore-verification copy (DW-307), not the old topology | none |

The inventory's own shortfalls that `ops/tracker-cutover.md` § Where the inventory falls short recorded
(the override's text, `~/cuatro-redeploy.sh`, the inventory's age) were each closed by Story 3-6's cutover
run, which recorded the override's text and retired the script as `cuatro-redeploy.sh.retired-2026-09-29`.

## The old stores

Each goes in its own step, in this order, and each step ends with the removal of its volume, after:

1. **a precondition check** that the old store is unchanged since its move (the counts above, or no row
   after the freeze) and that the estate's copy holds every table it held, at the same count or more
   (`ok`); any `LOWER` or `MISSING` line stops the step for the Operator, who either finds the rows or
   records them as dropped;
2. **a final dump** written to `/home/deploy/retired-4-11/stores/`, read back by `pg_restore --list`, counted
   and checksummed;
3. **an offsite copy**: one restic snapshot, tag `retired-4-11`, in the estate repository in R2, restored
   into a scratch directory and compared file by file by sha256 (`offsite`, § The sequence). The nightly
   `forget` selects `--tag estate-postgres` and never touches this tag, so these snapshots stay until the
   Operator forgets them. The local copy in `/home/deploy/retired-4-11` stays too.

| Step | Store | Holds | Precondition |
|---|---|---|---|
| 12 | `cuatro-portfolio-anchor-db-1`, volume `cuatro-portfolio_postgres_data` | Umami's history to the freeze | no `website_event` row after `FROZE`; every table `ok` against the estate's `umami` |
| 13 | `cuatro-tracker-postgres-1`, volume `cuatro-tracker_pg_data` | the tracker's data to its freeze | equal to `tracker-20260930T235451Z.dump.counts`; every table `ok` against `cuatro_tracker` |
| 14 | `cs-tracker-db-1`, volume `cs-tracker_pgdata` | `cs-tracker`'s data to its move | equal to `cs_tracker-20261001T003549Z.dump.counts` (Oban's tables apart); every such table `ok` against `cs_tracker` |

**`anchor-db`'s declaration stays in `docker-compose.yml`.** Finance names it (`finance`, `finance-migrate`,
DW-300) and is placed nowhere; nothing a deploy runs starts it (`ops/deploy-remote.sh` rolls `anchor-app`
and runs `anchor-app-migrate` alone, neither depending on it). After step 12, starting it would create an
empty database, which the file's comment now says.

**What the Operator said about data, recorded as context only.** On 2026-10-01 the Operator said every
application's data will be wiped for a clean start after this project. That changes nothing here: each
store is still dumped, copied offsite and verified before it goes.

## What this story leaves open

**Decision, Story 4-11, the Operator may overrule: the story retires the topology, not every application's
deploy.** Each item below changes how an application ships or runs, in its own repository or deploy path,
and none blocks retiring Caddy or the old stores.

| Item | Why not here |
|---|---|
| `list-wheel` still built on the box, KV-1's `list-wheel` half (DW-308) | A CI image, a compose `image:` and a pull deploy in that repository: its own shipped step under AD-20's Epic 4 reading. KV-1 stays open on that half; its Anchor half retired 2026-09-29 |
| `digital-library`'s two images built on the box (DW-185) and its untracked override (DW-187) | The same shape of change in `digital-library`; the override is what puts its upstreams on the shared network, so it stays until that repository carries the attachment |
| The tracker's Redis and qBittorrent in the old `cuatro-tracker` project (DW-306) | They serve the running tracker. Step 13 removes only that project's Postgres and its three exited containers; never run `docker compose up` in `/home/deploy/cuatro-tracker`, which would recreate an empty Postgres and the old app |
| A deploy path per id (DW-275) | `deploy.yml`, `ops/deploy-remote.sh` and the Capacity Gate's placements; no routing change needs it |
| The tracker's sign-in accepting any password (DW-311) | Authentication, not topology; before any real user signs in |
| The tournament worker's public route (DW-287) | Unchanged: the worker has no router, as ruled 2026-09-29 |

**The Capacity Gate.** Traefik takes no `placements` entry: it is ingress, not an application id, and a
routing move places nothing (AD-9, `ops/traefik-cutover.md` step 4). `ops/capacity-gate.yml` is unchanged.

**The second serving address of 2026-08-16.** Story 1.21 decommissioned it, and that is recorded:
`ops/routing-inventory.md` § The address the estate left (`95.216.143.251`, the box gone by the Operator's
statement of 2026-08-16 and 2026-08-17, no zone record resolving there on 2026-08-24) and § What Story 1.21
changed. Per the story's 2026-08-16 amendment, nothing here repeats it.

## Rehearsed off the box

**Observed 2026-10-01 between 02:44Z and 03:00Z on the authoring machine** (Docker 29.8.1), with throwaway
stand-ins, all removed afterwards: a network named `cs-tracker_default`; a self-signed pair for `cuatro.dev`
and `*.cuatro.dev` in a volume named `cs-tracker_caddy_data` and the same pair in a volume standing for
`/home/deploy/origin-ca`; one `traefik/whoami:v1.11` per upstream alias; Story 4-2's instance from
`git archive HEAD ops/traefik` at `04ab448` (service `traefik`, 8443); a `caddy:2` holding 80 and 443 with
`tls internal`; this commit's `ops/traefik/`; and an override sending Let's Encrypt's hostname to loopback,
so no account was registered. A request loop ran across the whole sequence, one line every 0.2 seconds plus
the requests' own time, each line `cuatro.dev` over https on 8443, over https on 443, and over http on 80.

To re-run the handover, from the repository root in Git Bash (re-run 2026-10-01 at 03:32Z; every line it
printed matched the block below, minus the request loop, the rollback rehearsal, steps 9 and 10 and the
archive helpers, which this shorter form does not run; a volume stands for `/home/deploy/origin-ca`):

```bash
docker network create cs-tracker_default && docker volume create cs-tracker_caddy_data && docker volume create origin-ca-stand-in
MSYS_NO_PATHCONV=1 docker run --rm -v cs-tracker_caddy_data:/data -v origin-ca-stand-in:/home alpine:3 sh -c 'apk add -q openssl && mkdir /data/origin-ca && openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=throwaway-origin -addext "subjectAltName=DNS:cuatro.dev,DNS:*.cuatro.dev" -keyout /data/origin-ca/origin.key -out /data/origin-ca/origin.pem && cp /data/origin-ca/origin.* /home/'
for a in anchor-app:3000 anchor-umami:3000 app:4000 cuatro-app:3000 library-web:3000 library-api:4000 list-wheel:80 tournament:3000; do
  docker run -d --name "stand-in-${a%%:*}" --network cs-tracker_default --network-alias "${a%%:*}" traefik/whoami:v1.11 --port "${a##*:}" --name "${a%%:*}"
done
# Caddy holding 80 and 443, as on the box today.
MSYS_NO_PATHCONV=1 docker run -d --name stand-in-caddy -p 80:80 -p 443:443 caddy:2 sh -c 'printf "{\n local_certs\n}\ncuatro.dev, *.cuatro.dev {\n respond caddy 200\n}\n" > /etc/caddy/Caddyfile && exec caddy run --config /etc/caddy/Caddyfile'
# Story 4-2's 8443 instance, from the commit before this story, and this story's files; one throwaway `.env` each.
O=$(mktemp -d) && git archive 04ab448 ops/traefik | tar -x -C "$O"
for d in "$O/ops/traefik" ops/traefik; do
  install -m 600 /dev/null "$d/.env"
  printf "TRAEFIK_DASHBOARD_USERS='operator:%s'\nCF_DNS_API_TOKEN=throwaway\n" "$(openssl passwd -apr1 throwaway)" >> "$d/.env"
done
printf 'services:\n  traefik:\n    extra_hosts: ["acme-v02.api.letsencrypt.org:127.0.0.1"]\n' > "$O/ops/traefik/offline.yml"
printf 'services:\n  ingress:\n    extra_hosts: ["acme-v02.api.letsencrypt.org:127.0.0.1"]\n' > ops/traefik/offline.yml
OLD="docker compose -f $O/ops/traefik/compose.yml -f $O/ops/traefik/offline.yml"
T='docker compose -f ops/traefik/compose.yml -f ops/traefik/offline.yml'
$OLD up -d --wait
# step 3, with a volume standing for /home/deploy/origin-ca.
docker volume create traefik-origin-ca
MSYS_NO_PATHCONV=1 docker run --rm --entrypoint sh -v origin-ca-stand-in:/src:ro -v cs-tracker_caddy_data:/caddy:ro -v traefik-origin-ca:/dst traefik:v3.7.13 -c \
  'cmp /src/origin.pem /caddy/origin-ca/origin.pem && cmp /src/origin.key /caddy/origin-ca/origin.key && cp /src/origin.pem /src/origin.key /dst/ && chmod 644 /dst/origin.pem && chmod 600 /dst/origin.key && cmp /src/origin.pem /dst/origin.pem && cmp /src/origin.key /dst/origin.key && echo pair-equal && ls -l /dst | tail -n +2'
# step 4.
docker stop stand-in-caddy && $T up -d --wait
docker ps --filter label=com.docker.compose.project=traefik --format '{{.Names}} {{.Status}} {{.Ports}}'
# step 5: each path on the 8443 instance against ingress on 443, then plain HTTP on 80.
for u in cuatro.dev/ 'www.cuatro.dev/some/path?q=1' analytics.cuatro.dev/ cs-tracker.cuatro.dev/ tracker.cuatro.dev/ library.cuatro.dev/ library.cuatro.dev/api/x library.cuatro.dev/files/y wheel.cuatro.dev/ tournament.cuatro.dev/; do
  h=${u%%/*}; p=/${u#*/}
  for port in 8443 443; do echo "$u $port $(curl -sk -o /dev/null -w '%{http_code}' --resolve "$h:$port:127.0.0.1" "https://$h:$port$p") $(curl -sk --resolve "$h:$port:127.0.0.1" "https://$h:$port$p" | grep ^Name)"; done
done
for m in '' '-I' '-X POST'; do echo "${m:-GET} $(curl -s -o /dev/null -D - $m --max-time 5 --resolve cuatro.dev:80:127.0.0.1 'http://cuatro.dev/some/path?q=1' | tr -d '\r' | awk 'NR==1 {c=$2} tolower($1)=="location:" {l=$2} END {print c, l}')"; done
echo | openssl s_client -connect 127.0.0.1:443 -servername tracker.cuatro.dev 2>/dev/null | openssl x509 -noout -subject
curl -sk -D - -o /dev/null --resolve cuatro.dev:443:127.0.0.1 https://cuatro.dev/ | tr -d '\r' | grep -E '^(Referrer-Policy|X-Content-Type-Options|X-Frame-Options):'
curl -s -o /dev/null -w 'dashboard 8081, no credentials %{http_code}\n' http://localhost:8081/dashboard/
curl -s -o /dev/null -w 'dashboard 8081, credentials %{http_code}\n' -u operator:throwaway http://localhost:8081/dashboard/
echo "routers $(curl -s -u operator:throwaway http://localhost:8081/api/http/routers | grep -o '"status":"enabled"' | wc -l)"
echo "ingress log error lines: $(docker logs traefik-ingress-1 2>&1 | grep -cE 'level=error|ERR ')"
# step 7: stop the 8443 instance; 443 and 80 keep answering.
docker stop traefik-traefik-1
curl -sk -o /dev/null -w 'after the stop, 443 %{http_code}\n' --resolve cuatro.dev:443:127.0.0.1 https://cuatro.dev/
curl -s -o /dev/null -w 'after the stop, 80 %{http_code}\n' --resolve cuatro.dev:80:127.0.0.1 http://cuatro.dev/
# Remove everything; `git status --short` prints nothing afterwards.
$T down; $OLD down -v; rm -rf "$O" ops/traefik/.env ops/traefik/offline.yml
docker rm -f $(docker ps -aq --filter name=stand-in-)
docker volume rm traefik-origin-ca origin-ca-stand-in cs-tracker_caddy_data && docker network rm cs-tracker_default
```

```
## step 3: the origin pair into Traefik's own volume
traefik-origin-ca
pair-equal
-rw-------    1 root     root          1704 Oct  1 02:47 origin.key
-rw-r--r--    1 root     root          1184 Oct  1 02:47 origin.pem
02:47:03.696 MARK step 4: stop Caddy, start ingress
level=warning msg="Found orphan containers (traefik-traefik-1) for this project. If you removed or renamed this service in your compose file, you can run this command with the --remove-orphans flag to clean it up."
 Container traefik-ingress-1 Healthy
02:47:12.225 MARK ingress up
traefik-ingress-1 Up 7 seconds (healthy) 0.0.0.0:80->80/tcp, [::]:80->80/tcp, 0.0.0.0:443->443/tcp, [::]:443->443/tcp, 127.0.0.1:8081->8080/tcp
traefik-traefik-1 Up 25 seconds (healthy) 127.0.0.1:8080->8080/tcp, 0.0.0.0:8443->8443/tcp, [::]:8443->8443/tcp
## step 5: pairs, the 8443 instance against ingress on 443
cuatro.dev/ old=[Name: anchor-app  200  ] ingress=[Name: anchor-app  200  ]
analytics.cuatro.dev/ old=[Name: anchor-umami  200  ] ingress=[Name: anchor-umami  200  ]
cs-tracker.cuatro.dev/ old=[Name: app  200  ] ingress=[Name: app  200  ]
tracker.cuatro.dev/ old=[Name: cuatro-app  200  ] ingress=[Name: cuatro-app  200  ]
library.cuatro.dev/ old=[Name: library-web  200  ] ingress=[Name: library-web  200  ]
library.cuatro.dev/api/x old=[Name: library-api  200  ] ingress=[Name: library-api  200  ]
library.cuatro.dev/files/y old=[Name: library-api  200  ] ingress=[Name: library-api  200  ]
wheel.cuatro.dev/ old=[Name: list-wheel  200  ] ingress=[Name: list-wheel  200  ]
tournament.cuatro.dev/ old=[Name: tournament  200  ] ingress=[Name: tournament  200  ]
## step 5: plain HTTP on 80
GET cuatro.dev/some/path?q=1 301
GET www.cuatro.dev/x 301
GET library.cuatro.dev/api/health 301
HEAD cuatro.dev/some/path?q=1 308
HEAD www.cuatro.dev/x 308
POST cuatro.dev/some/path?q=1 308
POST www.cuatro.dev/x 308
POST library.cuatro.dev/api/health 308
HTTP/1.1 308 Permanent Redirect
Location: https://cuatro.dev/some/path?q=1
## step 5: certificate, headers, dashboard
subject=CN=throwaway-origin
Referrer-Policy: strict-origin-when-cross-origin X-Content-Type-Options: nosniff X-Frame-Options: DENY
dashboard 8081, none 401, credentials 200; 8080 (the 8443 instance's) 200
routers  13 "status":"enabled"
ingress log error lines: 0
02:53:50.320 MARK step 7: stop the 8443 instance (the Origin Rules are gone by then)
02:53:54.706 MARK rollback rehearsal: stop ingress, start Caddy
02:54:01.666 MARK forward again: stop Caddy, start ingress
 Container traefik-ingress-1 Healthy
## step 9: the firewall's DOCKER-USER sees the container port; ingress's are
443/tcp->0.0.0.0:443 :::443 ; 80/tcp->0.0.0.0:80 :::80 ; 8080/tcp->127.0.0.1:8081 ;
## step 10: remove the stopped 8443 instance
traefik-ingress-1 Up 13 seconds (healthy)
```

A GET's `Location` read with `curl -i`: `HTTP/1.1 301 Moved Permanently`, `Location:
https://cuatro.dev/some/path?q=1`, so no port. The www pair printed empty on both sides: the probe's `grep`
read only a `Name:` line, which a redirect has not, and the redirect itself is `ops/traefik-cutover.md`'s
proof. Thirteen routers are the eleven of `routes.yml`, Traefik's own `ping` router (Story 4-2's rehearsal counted
twelve with the same file) and the `web` entrypoint's redirect. One `HEAD`
without `-I` waited for a body until it was killed; the script's fault, not Traefik's (step 5 below uses
`-I`).

The loop's 706 lines, by phase (`8443 443 80`):

| Phase | Lines |
|---|---|
| Before the handover, Caddy on 443 and 80 | 8 `200 200 308` |
| Caddy stopped, `ingress` starting (02:47:03.7Z to 02:47:12.2Z) | 1 `200 000 000`, 1 `200 000 301`, 8 `200 200 301` |
| Both instances (to 02:53:50.3Z) | 678 `200 200 301` |
| The 8443 instance stopped | 1 `000 000 000`, 2 `000 200 301` |
| Rollback: `ingress` stopped, Caddy started | 2 `000 200 308` |
| Forward again, and after | 5 `000 200 301` |

So the 8443 column never failed while that instance ran, which is where every hostname's HTTPS is during
the box's handover; the 443 and 80 columns failed for one to two lines, about a second, while the port
changed hands. **One line failed on all three ports at the moment the 8443 instance stopped.** It did not
recur when the same stop was repeated three times beside `ingress` (94 lines, all `200 301` on 443 and 80),
nor across five stops of an unrelated container publishing a port (75 lines, all `200 301`); unexplained,
and step 7's probe watches for it on the box.

**The archive and offsite helpers**, run 2026-10-01T02:59Z as uid 1001 (the `deploy` shape) in a
`docker:29-cli` container against a local restic repository standing for R2, with the Caddy volume stood in
by a root-owned tree holding a `0600` key: the tar listed `./caddy/certificates/x.json`,
`./origin-ca/origin.key` and `./origin-ca/origin.pem` and came out owned by 1001; `offsite` printed
`snapshot a2b07cb6 saved`, `Restored 5 files/dirs`, `offsite-match 1 files`, then after a second file
`snapshot ab654dc2 saved`, `offsite-match 2 files`, and `snapshots --tag retired-4-11` listed both under host
`estate-postgres`. The tar came out `0644` there, so step 11 sets `0600` on it, since it holds the key.

**Not proven here:** the real edge, the Origin Rules and their deletion, the box's firewall, R2 itself (the
nightly job proves the repository every night), the three real stores' dumps (the moves' own runbooks
dumped them the same way), and the `cs-tracker` changes against the running project (checked to apply,
below).

## The cs-tracker changes

Two commits for the Operator to land in `LuigiEspinosa/cs-tracker` on `main`, each at its own step: the
first when Caddy goes (step 11), the second when the old database goes (step 14). `cs-tracker` has no CI and
no deploy on push (DW-14), so landing one changes nothing running; the box takes each by `git pull` in its
step. Both apply to `ca75686` in order, checked 2026-10-01 with `git apply` against an export of that commit,
and the result equals the files the authoring session wrote. The removed and context lines are `cs-tracker`'s
own text, quoted exactly so each patch applies, its dashes and emoji included; the added lines carry none.

**Change A**, subject `chore: retire caddy and the Caddyfile now that the estate's Traefik holds 80 and 443`.
sha256 of the patch as written below, LF endings,
`0616f33a026398f9e58da9c85121f6a712688e170c11e0f9cb08168663f9affd`. It is applied, then the Caddyfile is
deleted with `git rm Caddyfile` in the same commit (the deletion is left out of the patch, so the patch need
not quote the file).

```diff
diff --git a/docker-compose.yml b/docker-compose.yml
index 9c5afe7..40ed27f 100644
--- a/docker-compose.yml
+++ b/docker-compose.yml
@@ -20,14 +20,19 @@
 #   migrate: one-shot under the `migrate` profile: runs bin/migrate (idempotent)
 #            then exits 0. Run by hand before each rollout, never by `up`.
 #   app:     the Story-8.3 release image; internal-only at app:4000.
-#   caddy:   the ONLY service that publishes ports (80/443); terminates TLS.
+#
+# The ingress is not a service of this file. Since cuatro-portfolio Story 4-11 it
+# is the estate's Traefik (cuatro-portfolio ops/traefik/), which holds 80 and 443,
+# terminates TLS and reaches `app` as app:4000 on this project's default network,
+# `cs-tracker_default`. The `caddy` service that held 80 and 443 before it is
+# retired (cuatro-portfolio ops/caddy-retirement.md).
 #
 # 🚨 SECURITY INVARIANT (Story 8.4 §Disaster #1):
 #   NEVER add a `ports:` mapping to `app` or `db`. config/prod.exs trusts
-#   `x-forwarded-proto` from ANY client — safe ONLY because Caddy is the sole
-#   ingress. Publishing the app port lets anyone forge X-Forwarded-Proto: https
-#   and defeat HTTPS enforcement + the `secure` auth cookie. Only `caddy`
-#   publishes ports. Verify with `docker compose config`.
+#   `x-forwarded-proto` from ANY client, safe ONLY because the estate's Traefik is
+#   the sole ingress. Publishing the app port lets anyone forge X-Forwarded-Proto: https
+#   and defeat HTTPS enforcement and the `secure` auth cookie. No service in this
+#   file publishes ports. Verify with `docker compose config`.
 #
 # All secrets come from a git-ignored `.env` (template: .env.example).
 
@@ -86,26 +91,6 @@ services:
     #    defaults to 4000. A bare PORT= would crash the release at boot
     #    (Story 8.4 §Disaster #3).
 
-  caddy:
-    image: caddy:2
-    restart: unless-stopped
-    # The ONLY service that publishes ports.
-    ports:
-      - "80:80"
-      - "443:443"
-    environment:
-      # Lets the Caddyfile's {$PHX_HOST} (and optional {$ACME_EMAIL}) resolve.
-      PHX_HOST: ${PHX_HOST}
-      ACME_EMAIL: ${ACME_EMAIL:-}
-    volumes:
-      - ./Caddyfile:/etc/caddy/Caddyfile:ro
-      # 🚨 Persist issued certs + ACME account keys, or every restart re-issues
-      #    certs and hits Let's Encrypt's rate limit (Story 8.4 §Disaster #4).
-      - caddy_data:/data
-      - caddy_config:/config
-    depends_on:
-      - app
-
 networks:
   # Created by cuatro-portfolio's ops/postgres/compose.yml; start that first.
   estate-postgres:
@@ -113,5 +98,3 @@ networks:
 
 volumes:
   pgdata:
-  caddy_data:
-  caddy_config:
diff --git a/docs/deployment.md b/docs/deployment.md
index 7663510..4310c71 100644
--- a/docs/deployment.md
+++ b/docs/deployment.md
@@ -12,6 +12,14 @@ without prior context.
 > The `db` service is the rollback copy until the old topology is retired. The move and its rollback
 > are in cuatro-portfolio's `ops/cs-tracker-cutover.md`.
 
+> **Since cuatro-portfolio Story 4-11, every part of this runbook about Caddy describes a stack that is
+> gone.** The `caddy` service and the `Caddyfile` are removed. The estate's Traefik
+> (cuatro-portfolio's `ops/traefik/`) holds 80 and 443, presents the Cloudflare Origin CA certificate
+> and reaches `app` as `app:4000` on `cs-tracker_default`; its `cs-tracker.cuatro.dev` router sets
+> `X-Forwarded-Proto: https`, which `config/prod.exs` reads. `PHX_HOST` still sets the Phoenix host and
+> no longer labels a site block. The retirement and its rollback are in cuatro-portfolio's
+> `ops/caddy-retirement.md`.
+
 ## What this deploys
 
 A single self-contained Docker Compose stack, fronted by Caddy for HTTPS:
```

**Change B**, subject `chore: retire the db service now that the data lives on the estate Postgres`. sha256
`c25aad24f55235de01d02dd7d9576bfbaf0a46ed77980005c15d6988ef00b041`. It applies on top of change A.

```diff
diff --git a/docker-compose.yml b/docker-compose.yml
index 40ed27f..f45a300 100644
--- a/docker-compose.yml
+++ b/docker-compose.yml
@@ -12,11 +12,6 @@
 #   ops/cs-tracker-cutover.md.
 #
 # Services:
-#   db:      PostgreSQL 16, internal-only, named volume for persistence. Since
-#            Story 4-10 nothing reads it: it is the rollback copy, kept until
-#            Story 4-11 retires it. The data lives in database `cs_tracker` on
-#            `estate-postgres`, the estate's one Postgres (cuatro-portfolio
-#            ops/postgres.md), reached over the external network of that name.
 #   migrate: one-shot under the `migrate` profile: runs bin/migrate (idempotent)
 #            then exits 0. Run by hand before each rollout, never by `up`.
 #   app:     the Story-8.3 release image; internal-only at app:4000.
@@ -28,7 +23,7 @@
 # retired (cuatro-portfolio ops/caddy-retirement.md).
 #
 # 🚨 SECURITY INVARIANT (Story 8.4 §Disaster #1):
-#   NEVER add a `ports:` mapping to `app` or `db`. config/prod.exs trusts
+#   NEVER add a `ports:` mapping to `app`. config/prod.exs trusts
 #   `x-forwarded-proto` from ANY client, safe ONLY because the estate's Traefik is
 #   the sole ingress. Publishing the app port lets anyone forge X-Forwarded-Proto: https
 #   and defeat HTTPS enforcement and the `secure` auth cookie. No service in this
@@ -37,31 +32,6 @@
 # All secrets come from a git-ignored `.env` (template: .env.example).
 
 services:
-  db:
-    image: postgres:16
-    restart: unless-stopped
-    environment:
-      POSTGRES_USER: ${POSTGRES_USER}
-      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
-      POSTGRES_DB: ${POSTGRES_DB}
-    volumes:
-      - pgdata:/var/lib/postgresql/data
-    healthcheck:
-      # `service_healthy` becomes meaningful only once this passes. Target TCP
-      # (-h 127.0.0.1), NOT the default unix socket: on a FRESH volume the
-      # postgres image runs a bootstrap postmaster on the socket only (TCP off)
-      # while it creates POSTGRES_DB. A socket check can pass during that window
-      # and flip `healthy` early — then `migrate` dials db:5432 over TCP, is
-      # refused, exits non-zero, and (restart: "no") the whole bring-up wedges.
-      # The TCP check + start_period keep the gate honest until the real server
-      # is accepting network connections.
-      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
-      interval: 5s
-      timeout: 5s
-      retries: 10
-      start_period: 30s
-    # 🚨 NO `ports:` — the DB is reachable only on the internal network at db:5432.
-
   # The discrete migration step (AD-23): `docker compose run --rm migrate`, before
   # a rollout. Idempotent: runs `up` migrations and no-ops once applied. The role
   # is `cs_tracker`, the owner of its database; `pg_trgm` is a trusted extension,
@@ -95,6 +65,3 @@ networks:
   # Created by cuatro-portfolio's ops/postgres/compose.yml; start that first.
   estate-postgres:
     external: true
-
-volumes:
-  pgdata:
diff --git a/docs/deployment.md b/docs/deployment.md
index 4310c71..88aeda6 100644
--- a/docs/deployment.md
+++ b/docs/deployment.md
@@ -9,7 +9,7 @@ without prior context.
 > Postgres; `DATABASE_URL` names role `cs_tracker` on that host, and `POOL_SIZE=10` is set in `.env`.
 > `migrate` runs only as `docker compose run --rm migrate`, never from `up`. Redeploy is
 > `docker compose build app`, then `docker compose run --rm migrate`, then `docker rollout -w 20 app`.
-> The `db` service is the rollback copy until the old topology is retired. The move and its rollback
+> The `db` service, that move's rollback copy, is removed since cuatro-portfolio Story 4-11. The move and its rollback
 > are in cuatro-portfolio's `ops/cs-tracker-cutover.md`.
 
 > **Since cuatro-portfolio Story 4-11, every part of this runbook about Caddy describes a stack that is
```

## The sequence

**Preconditions**, each recorded before step 1:

- Story 4-9 done: `ops/backup-digital-library.md` § Cutover run, library.cuatro.dev step 6 read (the night's
  `library-backup` line), so every Epic 4 move this one depends on is closed.
- The commit carrying this file and `ops/traefik/`'s 443 version is merged into `main`, and a Deploy has
  run since, so `/home/deploy/cuatro-portfolio` holds it (Pending action 2). The Deploy rolls the Hub alone
  and touches neither Traefik nor Caddy. **Merge it right before step 3, in the same session** (§ Why two
  instances at once). Steps 1 and 2 need nothing from it.
- The Origin Rules token on the workstation as `CF_RULES_TOKEN`, never printed; `jq` there (or `node` for the
  JSON, as the earlier runs did); `gh` for step 8.
- Not between 02:45 and 03:50 UTC: `cs-tracker`'s catalog sync at 03:00, then the backups from 03:15.

Two sessions, as `ops/traefik-cutover.md` § Moving cuatro.dev and www sets them up. **Workstation** helpers:

```bash
read -rs CF_RULES_TOKEN && export CF_RULES_TOKEN; export ZONE=<zone id>
CF() { curl -s -H "Authorization: Bearer $CF_RULES_TOKEN" -H 'Content-Type: application/json' "https://api.cloudflare.com/client/v4/zones/$ZONE/rulesets$1" "${@:2}"; }
rule() { printf '{"description":"Story 4-11: %s to Traefik on 8443","expression":"(http.host eq \\"%s\\" and ssl)","action":"route","action_parameters":{"origin":{"port":8443}}}' "$1" "$1"; }
del() { local id; id=$(CF "/$RS" | jq -r --arg h "$1" '.result.rules[] | select(.expression == "(http.host eq \"\($h)\" and ssl)") | .id'); echo "$1 rule ${id:-not found}"; [ -n "$RS" ] && [ -n "$id" ] && CF "/$RS/rules/$id" -X DELETE | jq '.success'; }
HOSTS='wheel.cuatro.dev www.cuatro.dev cuatro.dev analytics.cuatro.dev tracker.cuatro.dev library.cuatro.dev cs-tracker.cuatro.dev tournament.cuatro.dev'
probe() { while :; do q="probe=$(date +%s%N)"; printf '%s' "$(date -u +%H:%M:%S)"
  for u in cuatro.dev/api/health www.cuatro.dev/ analytics.cuatro.dev/api/heartbeat cs-tracker.cuatro.dev/ \
           tracker.cuatro.dev/api/health library.cuatro.dev/api/health wheel.cuatro.dev/ tournament.cuatro.dev/api/health; do
    printf ' %s' "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "https://$u?$q")"; done
  printf ' %s\n' "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://cuatro.dev/?$q")"; sleep 1; done; }
```

`del` selects a rule by its expression, so it finds each story's rule whatever its description says.
`probe` prints one line a second: the time, the eight hostnames over https, then `cuatro.dev` over plain
HTTP. **Box** helpers, as `deploy`:

```bash
cd /home/deploy/cuatro-portfolio
T='docker compose -f ops/traefik/compose.yml'
R=/home/deploy/retired-4-11; install -d -m 700 "$R"
pair() { for u in cuatro.dev/api/health 'www.cuatro.dev/some/path?q=1' analytics.cuatro.dev/api/heartbeat cs-tracker.cuatro.dev/ \
           tracker.cuatro.dev/api/health library.cuatro.dev/ library.cuatro.dev/api/health wheel.cuatro.dev/ tournament.cuatro.dev/api/health; do
  h=${u%%/*}; p=/${u#*/}
  echo "$u $1=[$(curl -sk -o /dev/null -w '%{http_code}' --resolve "$h:$2:127.0.0.1" "https://$h:$2$p")] $3=[$(curl -sk -o /dev/null -w '%{http_code}' --resolve "$h:$4:127.0.0.1" "https://$h:$4$p")]"; done; }
est() { docker exec "$1" netstat -tn 2>/dev/null | grep -c ":$2 .*ESTABLISHED"; }
offsite() {
  docker run --rm --user "$(id -u):$(id -g)" --env-file /etc/cuatro/postgres-backup.env -v "$R:$R:ro" restic/restic:0.19.1 --no-cache backup --host estate-postgres --tag retired-4-11 "$R" | tail -1
  rm -rf /home/deploy/retired-4-11-check && install -d -m 700 /home/deploy/retired-4-11-check
  docker run --rm --user "$(id -u):$(id -g)" --env-file /etc/cuatro/postgres-backup.env -v /home/deploy/retired-4-11-check:/home/deploy/retired-4-11-check restic/restic:0.19.1 --no-cache restore latest --host estate-postgres --tag retired-4-11 --target /home/deploy/retired-4-11-check | tail -1
  diff <(cd "$R" && find . -type f -print0 | sort -z | xargs -0 sha256sum) \
       <(cd "/home/deploy/retired-4-11-check$R" && find . -type f -print0 | sort -z | xargs -0 sha256sum) \
    && echo "offsite-match $(find "$R" -type f | wc -l) files"
  rm -rf /home/deploy/retired-4-11-check; }
Q="select table_name||' '||(xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1"
QN="select table_name||' '||(xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name not like 'oban\_%' order by 1"
OLDQ() { docker exec "$SRC" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$1"' _ "$1"; }
NEWQ() { docker exec postgres-estate-postgres-1 psql -U postgres -d "$1" -Atc "$2"; }
cmpq() { LC_ALL=C join -a1 -e MISSING -o 0,1.2,2.2 <(OLDQ "$2" | LC_ALL=C sort) <(NEWQ "$1" "$2" | LC_ALL=C sort) \
  | awk '{ print $0, ($3 == "MISSING") ? "MISSING" : ($3 + 0 >= $2 + 0) ? "ok" : "LOWER" }'; }
final() { install -d -m 700 "$R/stores"; D="$R/stores/$1-$(date -u +%Y%m%dT%H%M%SZ).dump"
  docker exec "$SRC" sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "$D"; echo "exit=$? bytes=$(wc -c < "$D")"
  OLDQ "$Q" > "$D.counts"; echo "tables $(docker exec -i "$SRC" pg_restore --list < "$D" | grep -c 'TABLE DATA')"
  (cd "$R/stores" && sha256sum "$(basename "$D")" > "$(basename "$D").sha256" && cat "$(basename "$D").sha256"); }
```

`offsite` backs up the whole of `$R` (restic stores only what is new), restores the latest snapshot into a
scratch directory, and prints `offsite-match <n> files` only when every file's sha256 equals the local one;
no output line names a password. `OLDQ` reads the role and database from the old container's own
environment, so neither is typed or printed; `NEWQ` connects as `postgres`, which no role limit counts.
`final` writes the dump, its counts and its checksum. Each step records its readings and `uptime`.

1. **Account every hostname, and stop at the first difference.** Read-only. On the workstation:
   ```bash
   E=$(CF /phases/http_request_origin/entrypoint); RS=$(echo "$E" | jq -r 'select(.success) | .result.id'); echo "$RS"
   echo "$E" | jq -r '.result.rules[] | "\(.id) \(.expression) \(.action_parameters.origin.port)"'
   for h in $HOSTS; do echo "$h $(curl -sI "https://$h/?v=$(date +%s%N)" | tr -d '\r' | grep -ic '^via: 1.1 Caddy')"; done
   for n in covidmap.cuatro.dev future-vizion.cuatro.dev _domainconnect.cuatro.dev dns01-probe.scratch.cuatro.dev; do
     echo "$n $(curl -s "https://cloudflare-dns.com/dns-query?name=$n&type=CNAME" -H 'accept: application/dns-json' | jq -c '[.Status, [.Answer[]?.data]]')"; done
   ```
   The ruleset id `518ad07108bc402fa36ad71fe1e76862`; seven rules, the seven ids of the table above, each
   port `8443`; `0` for every hostname but `tournament.cuatro.dev`, which prints `1` (`analytics` prints `0`
   whichever proxy serves it, since the edge's challenge answers a bare `curl` with `403`; its rule is the
   proof); the two Vercel names answering `[0,["...vercel-dns-017.com."]]`, `_domainconnect` `[0,[]]`
   (proxied, so the edge hides its target), and the scratch name `[3,[]]`, NXDOMAIN, each as read from the
   workstation on 2026-10-01. The eight monitors of the table read `UP`. On the box:
   ```bash
   uptime; ss -ltn | grep -E ':(80|443|8443|8080|8081) '
   docker ps --format '{{.Names}} {{.Status}}' | grep -E 'caddy|traefik'
   pair caddy 443 traefik 8443
   grep -c "url: http://tournament:3000" ops/traefik/dynamic/routes.yml
   est traefik-traefik-1 8443
   ```
   Listeners as § What serves today; Caddy up, `traefik-traefik-1` healthy; every pair's status equal
   (`200`, `301`, `200`, `302`, `200`, `302`, `200`, `200`, `200`), as at `ops/traefik-cutover.md` step 5;
   `1`; and the 8443 instance's established connections, the baseline step 2 compares with.
2. **Move `tournament.cuatro.dev` onto Traefik**, by `ops/traefik-cutover.md` § Moving a hostname, and moving
   it back. Its store is Supabase Cloud, off the box, so no data step. Start `probe | tee retire-probe-2.log`
   on the workstation and leave it to the end of the step, then:
   ```bash
   CF "/$RS/rules" -X POST --data "$(rule tournament.cuatro.dev)" | jq '.success, .errors'
   ```
   `true` and `[]`. After about a minute: `curl -sI "https://tournament.cuatro.dev/api/health?v=$(date +%s)"`
   answers `200` with no `via` line; on the box, `est traefik-traefik-1 8443` is above step 1's reading. After
   one five-minute interval of monitor 804128109 more, stop the loop: `awk '{print $9}' retire-probe-2.log |
   sort | uniq -c` shows `200` alone, and every other column keeps its first line's value. Record the rule id
   (`CF "/$RS" | jq -r '.result.rules[] | select(.description | startswith("Story 4-11")) | .id'`). **Now no
   HTTPS request reaches Caddy: every hostname has a rule.** Rollback: `del tournament.cuatro.dev`.
3. **Put the Origin CA pair in Traefik's own volume.** After the merge's Deploy (preconditions):
   `git log -1 --format=%H` is that commit, and `grep -c "name: traefik-origin-ca" ops/traefik/compose.yml`
   prints `1`. Then:
   ```bash
   docker volume create traefik-origin-ca
   docker run --rm --entrypoint sh -v /home/deploy/origin-ca:/src:ro -v cs-tracker_caddy_data:/caddy:ro -v traefik-origin-ca:/dst traefik:v3.7.13 -c \
     'cmp /src/origin.pem /caddy/origin-ca/origin.pem && cmp /src/origin.key /caddy/origin-ca/origin.key && cp /src/origin.pem /src/origin.key /dst/ && chmod 644 /dst/origin.pem && chmod 600 /dst/origin.key && cmp /src/origin.pem /dst/origin.pem && cmp /src/origin.key /dst/origin.key && echo pair-equal && ls -l /dst | tail -n +2'
   ```
   `pair-equal` and the two files, the key `-rw-------`. `cmp` compares without printing either file, so the
   key never reaches the terminal. Anything else: stop; nothing has changed but a new, unused volume
   (`docker volume rm traefik-origin-ca` undoes it).
4. **Hand 80 and 443 to Traefik.** Start `probe | tee retire-probe-4.log` on the workstation and leave it
   running to step 8. On the box:
   ```bash
   docker stop cs-tracker-caddy-1 && $T up -d --wait; date -u +%H:%M:%S
   docker ps --filter label=com.docker.compose.project=traefik --format '{{.Names}} {{.Status}} {{.Ports}}'
   ss -ltn | grep -E ':(80|443|8443|8080|8081) '; uptime
   ```
   Compose warns that `traefik-traefik-1` is an orphan and leaves it running; `traefik-ingress-1` healthy on
   80, 443 and `127.0.0.1:8081`, `traefik-traefik-1` still healthy on 8443 and `127.0.0.1:8080`. The probe's
   last column turns from `308` to `301` within seconds, and may show one or two `000` across the handover
   (§ Why two instances at once); every https column keeps its value throughout. **Rollback:**
   `$T stop ingress && docker start cs-tracker-caddy-1`, which gives 80 and 443 back to Caddy; the https
   columns never left the 8443 instance.
5. **Verify `ingress` against the 8443 instance, on the box.**
   ```bash
   pair traefik 8443 ingress 443
   for m in '' '-I' '-X POST'; do echo "${m:-GET} $(curl -s -o /dev/null -D - $m --max-time 5 --resolve cuatro.dev:80:127.0.0.1 'http://cuatro.dev/some/path?q=1' | tr -d '\r' | awk 'NR==1 {c=$2} tolower($1)=="location:" {l=$2} END {print c, l}')"; done
   echo | openssl s_client -connect 127.0.0.1:443 -servername tracker.cuatro.dev 2>/dev/null | openssl x509 -noout -subject -enddate
   echo | openssl s_client -connect 127.0.0.1:443 -servername dns01-probe.scratch.cuatro.dev 2>/dev/null | openssl x509 -noout -issuer -enddate
   docker logs traefik-ingress-1 2>&1 | grep -cE 'level=error|ERR '
   ```
   Every pair's status equal; `GET 301`, `-I 308`, `-X POST 308`, each to `https://cuatro.dev/some/path?q=1`
   (the same line against Caddy through the edge printed `308` three times on 2026-10-01);
   `CN = CloudFlare Origin Certificate` and `notAfter=Aug 13 17:15:00 2041 GMT`; issuer Let's Encrypt and
   `notAfter=Dec 29 20:53:46 2026 GMT`, the scratch certificate `ops/traefik-cutover.md` step 7 issued, read
   from the shared `traefik_acme`; `0`. The dashboard, from the workstation:
   `ssh -N -L 8080:127.0.0.1:8081 deploy@177.7.52.248`, then `http://localhost:8080/dashboard/` answers `401`,
   and `200` with the Operator's credentials. A pair that differs: record it, and roll back as step 4.
6. **Delete the eight Origin Rules, one at a time.** Each moves one hostname from the 8443 instance to
   `ingress`, both answering. On the workstation, for each hostname in `$HOSTS`, in that order (wheel first,
   as Story 4-3 moved it first; the tournament last):
   ```bash
   del <hostname>
   ```
   `true`. After about a minute: the hostname's probe column keeps its value, `curl -sI "https://<hostname>/"`
   answers as before, and on the box `est traefik-ingress-1 443` rises while `est traefik-traefik-1 8443` falls.
   Then the next. After the last: `CF "/$RS" | jq '.result.rules | length'` prints `0`; the empty entrypoint
   ruleset stays (it is what a later rule would be added to). If the API refuses to delete a phase's last
   rule, delete the entrypoint ruleset itself, `CF "/$RS" -X DELETE`, which a later rule recreates with
   `ops/traefik-cutover.md`'s `PUT`. **Rollback of one hostname:**
   `CF "/$RS/rules" -X POST --data "$(rule <hostname>)" | jq '.success'`, which sends it back to the 8443
   instance until step 7.
7. **Stop the 8443 instance.** Some minutes after step 6, when `est traefik-traefik-1 8443` reads `0`:
   ```bash
   docker stop traefik-traefik-1; ss -ltn | grep -cE ':(8443|8080) '; uptime
   ```
   `0` listeners on 8443 and 8080. The probe keeps every column; a `000` at this moment is the one the
   rehearsal could not explain: note its time and keep watching, since a lasting one is a finding.
   **Rollback:** `docker start traefik-traefik-1`, then step 6's rollback for each hostname to send back.
8. **Prove 443 for every hostname.** After at least one five-minute monitor interval past step 7: the eight
   monitors read `UP`. From the workstation:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' --http1.1 -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' \
     -H "Sec-WebSocket-Key: $(openssl rand -base64 16)" -H 'Origin: https://cs-tracker.cuatro.dev' 'https://cs-tracker.cuatro.dev/live/websocket?vsn=2.0.0' --max-time 5
   gh workflow run deploy.yml --ref main -R LuigiEspinosa/cuatro-portfolio
   ```
   The socket `101` (DW-309: the only upstream that serves an upgrade through the origin). **Amended
   2026-10-01 after the run:** `--http1.1` added, as `ops/cs-tracker-cutover.md` step 10 has it. Without it
   curl negotiates HTTP/2 with the edge, where a `Connection: Upgrade` request is invalid, and the line
   prints `400` whatever the origin does; the run read `400` without the flag and `101` with it. Watch the
   dispatched run to green as `ops/traefik-cutover.md` § Moving cuatro.dev and www step 5 does; it rolls the
   Hub through `ingress`, and on the box afterwards one Hub container, numbered one higher, healthy. Then stop
   the loop: `awk '{$1=""; print}' retire-probe-4.log | sort | uniq -c` shows the first line's eight codes and
   `308` before step 4, the same eight and `301` after, and at most the handover's one or two `000` in the
   last column; anything else is a finding to trace against the step times.
   The Operator signs in once at `https://cs-tracker.cuatro.dev` with Steam and loads `https://cuatro.dev` in
   a browser. **This is the proof every later step stands on.**
9. **Close 8443 at the origin firewall.**
   ```bash
   sudo cp -p /usr/local/sbin/cf-origin-firewall.sh /usr/local/sbin/cf-origin-firewall.sh.bak-4-11
   sudo cp -p /usr/local/sbin/cf-origin-firewall.sh.bak-4-2 /usr/local/sbin/cf-origin-firewall.sh
   sudo systemctl restart cf-origin-firewall.service
   sudo iptables -S DOCKER-USER | grep -c -- '--dports 80,443 '; sudo ip6tables -S DOCKER-USER | grep -c -- '--dports 80,443 '
   sudo iptables -S DOCKER-USER | grep -c 8443; sudo ip6tables -S DOCKER-USER | grep -c 8443
   for n in $(sudo ufw status numbered | awk -F'[][]' '/8443\/tcp/ {gsub(/ /, "", $2); print $2}' | sort -rn); do sudo ufw --force delete "$n"; done
   sudo ufw status | grep -c 8443; sudo ufw status | grep -c '80,443/tcp'
   ```
   `16` and `8` (the returns and the drop), `0` and `0`, then `0` and `22`. From the workstation,
   `curl -sk --max-time 5 https://177.7.52.248:8443/` and `https://177.7.52.248/` both time out, and the
   probe or a single request per hostname still answers. **Rollback:** copy `.bak-4-11` back, restart the
   service, and re-add the `ufw` rules with `ops/traefik-cutover.md` step 3's loop.
10. **Remove the 8443 instance's container.** It holds nothing: its static and routing files are the
    checkout's, the scratch certificate is in `traefik_acme`, which `ingress` uses, and its pair was
    Caddy's. Removes exactly `traefik-traefik-1`:
    ```bash
    docker inspect -f '{{.State.Status}}' traefik-traefik-1 && docker rm traefik-traefik-1
    docker ps -a --filter label=com.docker.compose.project=traefik --format '{{.Names}} {{.Status}}'
    ```
    `exited`, then `traefik-ingress-1` alone.
11. **Retire Caddy.** Its container is stopped since step 4 and nothing reaches it.
    1. **Archive.** In `/home/deploy/cs-tracker`:
       ```bash
       docker ps -a --filter volume=cs-tracker_caddy_data --format '{{.Names}}'; docker ps -a --filter volume=cs-tracker_caddy_config --format '{{.Names}}'
       install -d -m 700 "$R/caddy"; cd /home/deploy/cs-tracker
       cp -p Caddyfile Caddyfile.bak-ops1 Caddyfile.bak-library- Caddyfile.bak-1-3 Caddyfile.bak-1-21 Caddyfile.bak-2-25 Caddyfile.bak-3-7 "$R/caddy/"
       git diff Caddyfile > "$R/caddy/Caddyfile.box.diff"
       for v in cs-tracker_caddy_data cs-tracker_caddy_config; do
         docker run --rm -e OWN="$(id -u):$(id -g)" --entrypoint sh -v "$v:/v:ro" -v "$R/caddy:/out" traefik:v3.7.13 -c \
           "tar czf /out/$v.tar.gz -C /v . && chown \$OWN /out/$v.tar.gz && chmod 600 /out/$v.tar.gz && tar tzf /out/$v.tar.gz | wc -l"; done
       (cd "$R/caddy" && sha256sum Caddyfile Caddyfile.bak-*)
       offsite
       ```
       `cs-tracker-caddy-1` alone, twice; two file counts; the seven digests read 2026-10-01 (§ What serves
       today, § What Story 1.7 found); `offsite-match`. The `cs-tracker_caddy_data` archive holds the Origin
       CA key, so the snapshot is its first copy off the box, encrypted (Decision, the Operator may overrule:
       the alternative is excluding `origin-ca/` from the tar and recording the key as live in
       `traefik-origin-ca` and `/home/deploy/origin-ca`).
    2. **Land change A** on `cs-tracker`'s `main` (Pending action 3), then on the box:
       ```bash
       git checkout -- Caddyfile && git pull --ff-only && git log -1 --format='%H %s'
       test ! -e Caddyfile && echo caddyfile-gone; docker compose config --services | sort | tr '\n' ' '; echo
       rm Caddyfile.bak-ops1 Caddyfile.bak-library- Caddyfile.bak-1-3 Caddyfile.bak-1-21 Caddyfile.bak-2-25 Caddyfile.bak-3-7
       git status --short
       ```
       The landed commit; `caddyfile-gone`; `app db`; `git status` empty. Removes exactly the six backups,
       archived in 11.1.
    3. **Remove Caddy's container**, exactly `cs-tracker-caddy-1`: `docker rm cs-tracker-caddy-1`.
    4. **Last, its two volumes**, exactly `cs-tracker_caddy_config` and `cs-tracker_caddy_data`, both archived
       in 11.1: `docker volume rm cs-tracker_caddy_config cs-tracker_caddy_data`.

    **Rollback.** Before 11.2: `$T stop ingress && docker start cs-tracker-caddy-1`. After 11.2 and before
    11.3, put the files back first, since the container bind-mounts `./Caddyfile` by path:
    `git checkout HEAD~1 -- docker-compose.yml && cp "$R/caddy/Caddyfile" .`, then the same start. After 11.4:
    `docker volume create cs-tracker_caddy_data`, then untar the archive into it with the `docker run` of
    11.1 reversed (`tar xzf /out/cs-tracker_caddy_data.tar.gz -C /v`, the volume mounted read-write), the same
    for `cs-tracker_caddy_config`, the files as above, and with `ingress` stopped,
    `docker compose up -d --no-deps caddy`.
12. **Retire Umami's old store.** `SRC=cuatro-portfolio-anchor-db-1`.
    ```bash
    OLDQ "select count(*) from website_event where created_at > '$(cat /home/deploy/pg-move/FROZE)'"
    OLDQ "select count(*) from pg_stat_activity where datname = current_database()"
    cmpq umami "$Q"
    final umami-anchor-db; offsite
    ```
    `0` (no event after the freeze); `1` (the query itself); every line `ok`; `exit=0`, the tables count, the
    checksum; `offsite-match`. Any `LOWER` or `MISSING`: stop (§ The old stores). Then, removing exactly the
    container `cuatro-portfolio-anchor-db-1`:
    ```bash
    docker stop cuatro-portfolio-anchor-db-1 && docker rm cuatro-portfolio-anchor-db-1
    ```
    and last, exactly the volume `cuatro-portfolio_postgres_data`:
    `docker volume rm cuatro-portfolio_postgres_data`. **Rollback:** before the volume goes,
    `export HUB_TAG="$(git rev-parse HEAD)"; docker compose --env-file .env.production up -d anchor-db` recreates
    the container on the same volume; after, the dump restores into that fresh container
    (`docker exec -i cuatro-portfolio-anchor-db-1 pg_restore -U umami -d umami --no-owner --exit-on-error < <the dump>`),
    though nothing reads it: Umami serves from the estate.
13. **Retire the tracker's old store.** `SRC=cuatro-tracker-postgres-1`.
    ```bash
    diff <(tr '\t' ' ' < /home/deploy/backups/cuatro-tracker/tracker-20260930T235451Z.dump.counts | LC_ALL=C sort) <(OLDQ "$Q" | LC_ALL=C sort) && echo old-unchanged
    OLDQ "select count(*) from pg_stat_activity where datname = current_database()"
    cmpq cuatro_tracker "$Q"
    final tracker-cuatro-tracker-postgres
    crontab -l > "$R/crontab.before-4-11"; offsite
    docker ps -a --filter label=com.docker.compose.project=cuatro-tracker --format '{{.Names}} {{.Status}}'
    ```
    `old-unchanged`; `1`; every line `ok`; the dump's three lines; `offsite-match`; `redis` and `qbittorrent`
    up, `postgres` up, `app`, `worker` and `migrate` exited. Then retire its nightly dump, which would fail
    without the store, removing exactly the 03:30 line:
    ```bash
    crontab -l | grep -v '^30 3 \* \* \* /home/deploy/cuatro-backup.sh ' | crontab -; crontab -l
    mv /home/deploy/cuatro-backup.sh "/home/deploy/cuatro-backup.sh.retired-$(date -u +%F)"
    ```
    Three lines remain (03:15, and the two at 03:45). Then, removing exactly the containers
    `cuatro-tracker-postgres-1`, `cuatro-tracker-app-1`, `cuatro-tracker-worker-1` and `cuatro-tracker-migrate-1`:
    ```bash
    docker stop cuatro-tracker-postgres-1 && docker rm cuatro-tracker-postgres-1 cuatro-tracker-app-1 cuatro-tracker-worker-1 cuatro-tracker-migrate-1
    curl -s https://tracker.cuatro.dev/api/ready
    ```
    `{"status":"ok","db":"ok","redis":"ok"}` from the workstation (the running tracker never read that store
    since its move). Last, exactly the volume `cuatro-tracker_pg_data`: `docker volume rm cuatro-tracker_pg_data`.
    **Rollback:** before the volume goes, `cd /home/deploy/cuatro-tracker && docker compose up -d --no-deps postgres`;
    the cron line from `$R/crontab.before-4-11` with `crontab "$R/crontab.before-4-11"` and the script by `mv`
    back; after the volume goes, the dump restores into that fresh container.
14. **Retire `cs-tracker`'s old store.** `SRC=cs-tracker-db-1`.
    ```bash
    diff <(LC_ALL=C sort /home/deploy/pg-move/cs_tracker-20261001T003549Z.dump.counts) <(OLDQ "$QN" | LC_ALL=C sort) && echo old-unchanged
    OLDQ "select count(*) from pg_stat_activity where datname = current_database()"
    cmpq cs_tracker "$QN"
    final cs-tracker-db; offsite
    ```
    `old-unchanged`; `1`; every line `ok` (Oban's tables apart, as the move counted); the dump's three lines;
    `offsite-match`. **Land change B** on `cs-tracker`'s `main` (Pending action 4), then in
    `/home/deploy/cs-tracker`:
    ```bash
    git pull --ff-only && git log -1 --format='%H %s'; docker compose config --services | tr '\n' ' '; echo
    docker stop cs-tracker-db-1 && docker rm cs-tracker-db-1 cs-tracker-migrate-1
    ```
    The landed commit; `app`; the two containers removed, exactly `cs-tracker-db-1` and `cs-tracker-migrate-1`.
    Last, exactly the volume `cs-tracker_pgdata`: `docker volume rm cs-tracker_pgdata`. `POSTGRES_USER`,
    `POSTGRES_PASSWORD` and `POSTGRES_DB` stay in `.env`, unread (Pending action 6). **Rollback:** before the
    volume goes, `git checkout HEAD~1 -- docker-compose.yml && docker compose up -d --no-deps db` and then
    `git checkout HEAD -- docker-compose.yml`; after, the dump restores into that fresh container.
15. **The move leftovers.** Archive, then shred what only the rollbacks needed, then remove the rest by a
    manifest of exactly what was archived:
    ```bash
    install -d -m 700 "$R/pg-move" "$R/backups-cuatro-tracker"
    (cd /home/deploy/pg-move && ls -1 | grep -vxE 'cs-tracker.env.pre-4-10|umami-rollback.yml|tracker-rollback.yml') > "$R/pg-move.manifest"
    (cd /home/deploy/backups/cuatro-tracker && ls -1) > "$R/backups-cuatro-tracker.manifest"
    (cd /home/deploy/pg-move && xargs -a "$R/pg-move.manifest" -d '\n' cp -p -t "$R/pg-move/")
    (cd /home/deploy/backups/cuatro-tracker && xargs -a "$R/backups-cuatro-tracker.manifest" -d '\n' cp -p -t "$R/backups-cuatro-tracker/")
    wc -l < "$R/pg-move.manifest"; wc -l < "$R/backups-cuatro-tracker.manifest"; offsite
    ```
    Fourteen files in the first manifest (§ What serves today, less the three rollback files), the second's
    count whatever the 03:30 job left before step 13, and `offsite-match`. Then **dropped, not archived**:
    the three files that hold the old passwords and served only the rollbacks, which steps 12 to 14 ended,
    removing exactly them:
    `shred -u /home/deploy/pg-move/cs-tracker.env.pre-4-10 /home/deploy/pg-move/umami-rollback.yml /home/deploy/pg-move/tracker-rollback.yml`.
    Last, exactly the archived files and their two directories:
    ```bash
    (cd /home/deploy/pg-move && xargs -a "$R/pg-move.manifest" -d '\n' rm --) && rmdir /home/deploy/pg-move
    (cd /home/deploy/backups/cuatro-tracker && xargs -a "$R/backups-cuatro-tracker.manifest" -d '\n' rm --) && rmdir /home/deploy/backups/cuatro-tracker
    ```
    `rmdir` refuses a directory that still holds anything, which is the check that nothing unlisted went.
    `/home/deploy/retired-4-11` stays, the final dumps' local copy (mode `0700`).
16. **Record.** Under § Retirement run below: each step's time, readings and `uptime`, the tournament's rule
    id, the probe counts, the eight `del` results, each `offsite` line and snapshot id, the two `cs-tracker`
    commits, and each removal. Then date each Pending Operator action, and take the dated amendments the
    records name for this run: `ops/routing-inventory.md` (§ Ingress, § The routers, § The shared network,
    § Backup coverage, per project, and the hostname table each name the sentence that changes when it
    runs; also § What each compose project actually runs, whose `cs-tracker` heading names `caddy` and `db`,
    § Scheduled work on the box, whose 03:30 `cuatro-backup.sh` line step 13 retires, and § How to re-gather
    this record, 6, whose procedure reads `cs-tracker-caddy-1`, rewritten for `traefik-ingress-1`), `ops/estate.md`, `ops/known-violations.md` KV-1, `ops/monitoring.md`'s "What terminates TLS" row
    (Traefik v3.7.13, `traefik-ingress-1`), `ops/traefik-cutover.md` (§ Rollback to Caddy, whole, retired by
    this run; the dashboard tunnel on 8081), and `ops/postgres.md` (the three old stores retired). Close DW-296
    and file what the run found.

## Retirement run

**Observed from 05:02Z to 06:12Z on 2026-10-01, on the box as `deploy` and from the workstation, run by the
orchestrator with the Operator present; the Operator merged PR #89, did the Steam sign-in and gave the go
for both `cs-tracker` pushes.** Preconditions, each recorded: Story 4-9 done (`ops/backup-digital-library.md`
§ Cutover run, library.cuatro.dev, the 03:45Z `library-backup` line read at 03:49Z); PR #89 merged `dev`
`da3d82f` into `main` as `50fde81` at about 05:19Z, between steps 2 and 3 as § Why two instances at once
requires, and Deploy run 36819206014 green (gate, image / hub, deploy); `CF_RULES_TOKEN` on the workstation,
never printed; run outside 02:45 to 03:50. `jq` is not on the workstation, so `node` parsed the JSON in
every workstation helper, one clause each. Every box script was written to a file on the box before it ran,
so stdin stayed free for `docker compose` and `docker rollout`. Times are UTC.

- **Step 1**, 05:02Z: ruleset `518ad07108bc402fa36ad71fe1e76862`; seven rules, `a186cf20`, `a74dce8a`,
  `7fe531a5`, `71197cf5`, `1ee043e4`, `041740b5`, `86b7df5f` (the table's ids), each port `8443`. The
  `via: 1.1 Caddy` count `0` for every hostname but `tournament.cuatro.dev`, `1`. DoH: `covidmap`
  `[0,["b1f36414641d604e.vercel-dns-017.com."]]`, `future-vizion` `[0,["75207fd2296392d3.vercel-dns-017.com."]]`,
  `_domainconnect` `[0,[]]`, `dns01-probe.scratch` `[3,[]]`. The eight monitors `UP`. On the box at 05:02:49Z:
  load average `0.26, 0.30, 0.28`; listeners `0.0.0.0:443`, `:8443`, `:80`, `127.0.0.1:8080` and the three
  IPv6; `traefik-traefik-1 Up 7 hours (healthy)`, `cs-tracker-caddy-1 Up 2 months`; every pair equal (`200`,
  `301`, `200`, `302`, `200`, `302`, `200`, `200`, `200`); the tournament `url` line count `1`;
  `est traefik-traefik-1 8443` baseline `9`; the checkout at `f9ea578`.
- **Step 2**: the probe `retire-probe-2` ran from 05:03:18Z to 05:09:28Z, 91 lines. The rule was added at
  **`MOVED=2026-10-01T05:03:24Z`**: rule **`24428c40a067407983ee72b4abf32016`**, `true` and `[]`, the eighth
  in the ruleset. At 05:03:33Z `tournament.cuatro.dev/api/health` answered `HEAD` `200` and `GET` `200`
  `{"status":"ok"}`, neither with a `via` line. On the box at 05:03:29Z: load average `0.13, 0.26, 0.26`,
  `est traefik-traefik-1 8443` `39`. Monitor 804128109 read `UP` after its interval (read 05:10Z). The
  count: the tournament column `200` alone, and every line the same nine values,
  `200 301 200 302 200 200 200 200 308`. No rollback.
- **Pending action 2**: PR #89 opened at about 05:10Z. Its CI run on `da3d82f` (36812668126) had failed once
  on `apps/finance` `lib/__tests__/crypto.test.ts`, "throws CryptoError when auth tag is modified": the case
  overwrites the tag's last byte with `ff`, a no-op one run in 256, and `da3d82f` changed documentation only
  after `5b324ba`'s green run (DW-313). The failed job re-run passed, every check was green, and the Operator
  merged; `main` `50fde81`, Deploy 36819206014 success.
- **Step 3**, 05:21:13Z: the checkout at `50fde815ba1e0c4359b3b3b333ca500e0eba75bd`; the compose volume line
  count `1`; `traefik-traefik-1` running, healthy, `restarts=0`. The volume `traefik-origin-ca` created; the
  container printed `pair-equal`, `origin.key` `-rw-------` 1704 bytes and `origin.pem` `-rw-r--r--` 1663
  bytes. Load average `0.20, 0.28, 0.26`.
- **Step 4**, 05:21:41Z: the probe `retire-probe-4` started at 05:21:25Z. `docker stop cs-tracker-caddy-1`,
  then `$T up -d --wait`: `traefik-ingress-1` `Started`, `Waiting`, `Healthy`. Then `traefik-ingress-1 Up 5
  seconds (healthy)` on `0.0.0.0:80`, `:443` and `127.0.0.1:8081`, and `traefik-traefik-1` still `Up 7 hours
  (healthy)` on 8443 and `127.0.0.1:8080`. Compose's orphan warning was not captured: the command's output
  was read through `tail`. Listeners 443, 8443, 80, 8080 and 8081; load average `0.34, 0.30, 0.27`.
- **Step 5**, 05:21:41Z: every pair, the 8443 instance against `ingress` on 443, equal (`200`, `301`, `200`,
  `302`, `200`, `302`, `200`, `200`, `200`). Plain HTTP on 80: `GET 301`, `-I 308`, `-X POST 308`, each to
  `https://cuatro.dev/some/path?q=1`. 443 served `CN = CloudFlare Origin Certificate`,
  `notAfter=Aug 13 17:15:00 2041 GMT`; the scratch name served issuer Let's Encrypt `YR2`,
  `notAfter=Dec 29 20:53:46 2026 GMT`. Ingress log error lines `0`; `est` 8443 `36`, 443 `0`. The dashboard
  over the tunnel to 8081 answered `401` without credentials and `200` with the Operator's.
- **Step 6**: `del` for each hostname of `$HOSTS`, a minute apart, each answered `true`. After each, the
  hostname's status, then `est traefik-traefik-1 8443` and `est traefik-ingress-1 443`:

  | Hostname | Deleted | Status after | 8443 | 443 |
  |---|---|---|---|---|
  | `wheel.cuatro.dev` | 05:22:22Z | `200` | 51 | 4 |
  | `www.cuatro.dev` | 05:23:29Z | `301` | 54 | 12 |
  | `cuatro.dev` | 05:24:36Z | `200` | 51 | 20 |
  | `analytics.cuatro.dev` | 05:25:44Z | `403`, the edge's challenge to a bare `curl` | 46 | 26 |
  | `tracker.cuatro.dev` | 05:26:51Z | `307` for `/`, its sign-in redirect | 35 | 33 |
  | `library.cuatro.dev` | 05:27:58Z | `302` | 27 | 43 |
  | `cs-tracker.cuatro.dev` | 05:29:04Z | `302` | 23 | 51 |
  | `tournament.cuatro.dev` | 05:30:12Z | `200` | 14 | 50 |

  Afterwards the entrypoint read `success` `true` with `0` rules, `[true,0,[]]`; the empty ruleset stays. The
  script's own "rules left" line printed blank, because its helper could not parse the empty ruleset; the
  direct read above is the reading.
- **Step 7**: `est traefik-traefik-1 8443` reached `0` after 95 seconds; `docker stop traefik-traefik-1` at
  05:33:24Z; listeners on 8443 and 8080 `0`; load average `0.71, 0.41, 0.33`; `traefik-ingress-1 Up 11
  minutes (healthy)`, `traefik-traefik-1 Exited (0)`; `est` 443 `52`. The probe showed no `000` at the stop:
  the rehearsal's unexplained line did not recur.
- **Step 8**: the socket upgrade through 443 answered `101` with `--http1.1` and `400` without it (curl
  negotiates HTTP/2 with the edge, where the upgrade is invalid); the runbook line lacked the flag, fixed in
  step 8 above. The Deploy was dispatched at 05:33:50Z: run 36820359454 success on `50fde81` (gate, image /
  hub, deploy). On the box at 05:35:43Z: `cuatro-portfolio-anchor-app-8` on
  `ghcr.io/luigiespinosa/hub:50fde815ba1e0c4359b3b3b333ca500e0eba75bd` `Up 40 seconds (healthy)`, load
  average `0.21, 0.31, 0.30`, `est` 443 `57`, ingress log error lines `0`. The probe stopped at 05:39:22Z:
  264 lines from 05:21:25Z to 05:38:59Z, 260 reading `200 301 200 302 200 200 200 200 301` and 4 reading
  `200 301 200 302 200 200 200 200 308` (before step 4), and no `000` in any column. All eight monitors
  `UP` at 05:40Z with no new incident. The Operator signed in with Steam at `https://cs-tracker.cuatro.dev`
  and loaded `https://cuatro.dev`: both fine.
- **Step 9**, 05:56:00Z: the script copied to `cf-origin-firewall.sh.bak-4-11`, the `.bak-4-2` copy restored,
  the service active. `DOCKER-USER` `16` and `8` lines on `--dports 80,443`; 8443 lines `0` and `0`; `ufw`
  8443 lines `0`, `80,443/tcp` lines `22`. Load average `0.25, 0.24, 0.27`. From the workstation
  `https://177.7.52.248:8443/` and `https://177.7.52.248/` both timed out (curl exit 28), and `cuatro.dev`,
  `wheel.cuatro.dev` and `tournament.cuatro.dev` answered `200`.
- **Step 10**: `traefik-traefik-1` `exited`, removed; `traefik-ingress-1 Up 34 minutes (healthy)` alone in the
  project.
- **Step 11.1**, 05:56:55Z: both volumes used by `cs-tracker-caddy-1` alone. The seven files copied;
  `Caddyfile.box.diff` 110 lines; `cs-tracker_caddy_data.tar.gz` 47 entries, `cs-tracker_caddy_config.tar.gz`
  3. The digests, first 16 hex: `Caddyfile` `0a3a92f7a1f3bca4`, `bak-1-21` `a4b8f383d0263ad1`, `bak-1-3`
  `ca2a976442141d3b`, `bak-2-25` `47578600e2cbd035`, `bak-3-7` `4de4bc19955852cc`, `bak-library-`
  `e568267f2e7295bb`, `bak-ops1` `4ccdb29875101529`. **All seven match** the values read before the run:
  the Caddyfile's the first 16 of § What serves today's full digest, and each backup's the 8 hex § What Story
  1.7 found records. `offsite`: snapshot **`7850bacb`** saved, restore `14 files/dirs`, `offsite-match 10
  files`. Load average `0.17, 0.22, 0.26`.
- **Step 11.2**, change A: extracted with Pending action 3's `awk`, sha256
  `0616f33a026398f9e58da9c85121f6a712688e170c11e0f9cb08168663f9affd`, the recorded value; applied to a clean
  clone at `ca75686`, committed and pushed to `cs-tracker` `main` as
  **`9a5a4be2c6916f71624ecb98ce1f51294097c1ff`**. On the box: `git checkout -- Caddyfile`, then the pull
  brought `9a5a4be` (`delete mode 100644 Caddyfile`); `caddyfile-gone`; services `app db`; the six
  `Caddyfile.bak-*` files removed; `git status --short` empty.
- **Step 11.3**: `cs-tracker-caddy-1` removed.
- **Step 11.4**: `cs-tracker_caddy_config` and `cs-tracker_caddy_data` removed; no Caddy volume left. Load
  average `0.46, 0.27, 0.28` at 05:57:36Z; `cs-tracker.cuatro.dev` through `ingress` `302`.
- **Step 12**, 05:58Z, `SRC=cuatro-portfolio-anchor-db-1`: events after `FROZE` `0`; connections `1`; `cmpq`
  every line `ok`, the estate ahead where it differs (`_prisma_migrations` 23 against 26, `event_data` 5
  against 8, `session` 47 against 48, `website_event` 88 against 99). Final dump
  **`umami-anchor-db-20261001T055804Z.dump`**, 68577 bytes, 25 tables, sha256
  `0ca0a9c49621b6b8050d4af04014f795a88224c56fb873564231ad9d2fe8b149`. `offsite`: snapshot **`fd14edeb`**,
  `offsite-match 13 files`. The container `cuatro-portfolio-anchor-db-1` stopped and removed; the volume
  `cuatro-portfolio_postgres_data` removed. Umami's heartbeat `{"ok":true}`. Load average
  `0.49, 0.29, 0.28` at 05:58:09Z.
- **Change B**: sha256 `c25aad24f55235de01d02dd7d9576bfbaf0a46ed77980005c15d6988ef00b041`, the recorded value;
  pushed to `cs-tracker` `main` as **`bde2b3fff2ec9842d5f89c4dcef23c76403b81f5`** with the recorded subject,
  between steps 12 and 13, before step 14's checks; the box pulled it in step 14.
- **Step 13**, 06:10Z, `SRC=cuatro-tracker-postgres-1`: `old-unchanged`; connections `1`; `cmpq` every line
  `ok` (9 tables, all equal). Final dump **`tracker-cuatro-tracker-postgres-20261001T061043Z.dump`**, 22310
  bytes, 9 tables, sha256 `f75814cb5a2a4107526636515a30a290f7dda359c7174befc54e70ae4f4ddd85`. The crontab saved
  to `$R/crontab.before-4-11`. `offsite`: snapshot **`0b5d5e60`**, `offsite-match 17 files`. The project
  showed `app`, `worker` and `migrate` exited, `postgres`, `redis` and `qbittorrent` up. The 03:30
  `cuatro-backup.sh` line removed; three jobs remain (03:15 `postgres-backup.sh`, 03:45 `library-backup.sh`,
  03:45 `tournament-backup.sh`); the script moved to `cuatro-backup.sh.retired-2026-10-01`. `postgres`
  stopped and the four containers removed, exactly `cuatro-tracker-postgres-1`, `cuatro-tracker-app-1`,
  `cuatro-tracker-worker-1` and `cuatro-tracker-migrate-1`; the volume `cuatro-tracker_pg_data` removed;
  `redis` and `qbittorrent` still `Up`. Load average `0.41, 0.26, 0.25` at 06:10:49Z; the tracker's
  `/api/ready` through `ingress` `200`, `db` ok, `redis` ok.
- **Step 14**, 06:11Z, `SRC=cs-tracker-db-1`: `old-unchanged` (Oban's tables apart); connections `1`; `cmpq`
  every line `ok`, the estate ahead where it differs (`inventory_entries` 113 against 130, `price_snapshots`
  21119 against 21183). Final dump **`cs-tracker-db-20261001T061118Z.dump`**, 1261712 bytes, 10 tables,
  sha256 `f1c36ff498a56fb142fc68ebcc56707390e61714910ba07c1854b7c4560882fb`. `offsite`: snapshot
  **`a4032342`**, `offsite-match 20 files`. The pull brought `bde2b3f` (2 files changed, 2 insertions, 35
  deletions); services `app`. Exactly `cs-tracker-db-1` and `cs-tracker-migrate-1` removed; the volume
  `cs-tracker_pgdata` removed; `cs-tracker-app-2 Up 6 hours` alone in the project. Load average
  `0.49, 0.30, 0.27` at 06:11:24Z; `cs-tracker.cuatro.dev` through `ingress` `302`.
- **Step 15**, 06:11:56Z: the `pg-move` manifest 14 files (`CST_DUMP`, `FROZE`, `TRACKER_DUMP`,
  `TRACKER_FROZE`, `cs_tracker-20261001T003549Z.dump` and its `.counts`, `cst-migrate.log`, `cst-rollout.log`,
  `migrate.log`, `tracker-backup.out`, `tracker-migrate.log`, `tracker-rollout.log`, `tracker-verify.out`,
  `umami.dump`); the `backups-cuatro-tracker` manifest 22 files. `offsite`: snapshot **`4a4f714a`**, restore
  `65 files/dirs`, `offsite-match 58 files`. The three rollback files shredded (`cs-tracker.env.pre-4-10`,
  `umami-rollback.yml`, `tracker-rollback.yml`); `/home/deploy/pg-move` and
  `/home/deploy/backups/cuatro-tracker` removed by manifest, both `rmdir` succeeded.
  `/home/deploy/retired-4-11` stays, mode `700`, 58 files, 3.2M. The containers then:
  `cs-tracker-app-2`, `cuatro-portfolio-anchor-app-8`, `cuatro-portfolio-anchor-umami-1`,
  `cuatro-portfolio-tournament-1`, `cuatro-portfolio-tournament-worker-1`, `cuatro-portfolio-tracker-2`,
  `cuatro-portfolio-tracker-worker-1`, `cuatro-tracker-qbittorrent-1`, `cuatro-tracker-redis-1`,
  `digital-library-api-1`, `digital-library-redis-1`, `digital-library-web-1`, `list-wheel-list-wheel-1`,
  `postgres-estate-postgres-1`, `traefik-ingress-1`. The volumes: `4fc208dc...` (DW-307's, left),
  `cuatro-tracker_qb_config`, `cuatro-tracker_redis_data`, `digital-library_redis_data`, `postgres_pgdata`,
  `traefik-origin-ca`, `traefik_acme`. Load average `0.27, 0.27, 0.26`; disk 22G of 96G used (23%).
- **Step 16**: this record, the Pending Operator actions below, and the amendments the step names, written
  2026-10-01 on `dev`.

The five `retired-4-11` snapshots, in order: `7850bacb` (Caddy), `fd14edeb` (Umami's store), `0b5d5e60` (the
tracker's), `a4032342` (`cs-tracker`'s), `4a4f714a` (the move leftovers). No rollback was needed and none
ran.

**Deviations, each recorded rather than corrected.**

- **Change A's subject.** It was committed as "chore: retire caddy and the Caddyfile now that Traefik serves
  cs-tracker.cuatro.dev", not the recorded "chore: retire caddy and the Caddyfile now that the estate's
  Traefik holds 80 and 443". The content is identical (the patch's sha256 matched); `cs-tracker`'s published
  history was not rewritten to change a subject.
- **Step 8's socket line** lacked `--http1.1` and printed `400`; with the flag it printed `101`. The runbook
  line is fixed above, with the reason.
- **Step 13's first attempt** was refused by the workstation's permission classifier before any command
  reached the box; it was re-run unchanged in manual mode at 06:10Z.
- **Step 4's orphan warning** was not captured (the output was read through `tail`); `docker ps` showed
  both instances as expected.

## Pending Operator actions

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| 1 | **Confirm or overrule Story 4-11's decisions**: this record; Traefik on 80 and 443 with the rules deleted and 8443 closed, against 8443 and the rules kept; two instances at once, the service `ingress` and the dashboard on loopback 8081; the plain HTTP redirect answering 301 to a GET; the pair in `traefik-origin-ca`; the offsite snapshots under `retired-4-11`, Caddy's volume and so the Origin CA key among them; the rollback files shredded; `anchor-db`'s declaration kept for finance; and § What this story leaves open | The Story 4-11 spec's Design Notes carry the reasoning. **2026-10-01:** the Operator's word, given before the retirement run, "We can do whatever you recommend for each item", recorded as confirmation of every decision as written | 2026-10-01 |
| 2 | **Merge the commit carrying this record and `ops/traefik/`'s 443 version into `main`**, and let the Deploy run, right before step 3 | The box checkout is `main`. The Deploy rolls the Hub alone; Traefik and Caddy keep running as they are until step 4. PR #89 merged `da3d82f` as `50fde81` after one re-run of a flaky finance case (DW-313); Deploy run 36819206014 green; the checkout read `50fde81` at step 3 | 2026-10-01T05:19Z |
| 3 | **Land change A on `LuigiEspinosa/cs-tracker` `main`**, at step 11.2: extract it with LF endings, `awk '{sub(/\r$/,"")} /^```diff$/{n++; if (n==1) {f=1; next}} /^```$/{f=0} f' ops/caddy-retirement.md > cs-tracker-4-11-caddy.patch`, check `sha256sum cs-tracker-4-11-caddy.patch` prints `0616f33a026398f9e58da9c85121f6a712688e170c11e0f9cb08168663f9affd`, then in a clean checkout at `ca75686`: `git apply cs-tracker-4-11-caddy.patch && git rm -q Caddyfile && git add docker-compose.yml docs/deployment.md && git commit -m "chore: retire caddy and the Caddyfile now that the estate's Traefik holds 80 and 443" && git push origin main` | No CI runs there and no deploy fires. Landed at step 11.2 as `9a5a4be2c6916f71624ecb98ce1f51294097c1ff`, the sha256 matching, under a different subject (§ Retirement run, Deviations) | 2026-10-01 |
| 4 | **Land change B** the same way at step 14, with `n==2` in the `awk`, sha256 `c25aad24f55235de01d02dd7d9576bfbaf0a46ed77980005c15d6988ef00b041`, on top of change A: `git apply cs-tracker-4-11-db.patch && git add docker-compose.yml docs/deployment.md && git commit -m "chore: retire the db service now that the data lives on the estate Postgres" && git push origin main` | The same. Landed between steps 12 and 13 as `bde2b3fff2ec9842d5f89c4dcef23c76403b81f5`, the sha256 and subject as recorded; the box pulled it at step 14 | 2026-10-01 |
| 5 | **Run § The sequence, steps 1 to 16**, after action 2 (for step 3 on) and the preconditions | Steps 1 and 2 need nothing merged. Done: § Retirement run, steps 1 to 15 from 05:02Z to 06:12Z, step 16 the same day | 2026-10-01T06:12Z |
| 6 | **Decide the dead `.env` lines**: `ACME_EMAIL`, `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` in `/home/deploy/cs-tracker/.env`, and `POSTGRES_PASSWORD` in `/home/deploy/cuatro-portfolio/.env.production` once finance no longer names `anchor-db` (DW-300) | Unread after steps 11 and 14; removing a secret's line is the Operator's edit. **2026-10-01, decided: deferred** to the Operator's planned clean start of every application after this project, on the same word as action 1; the lines stay, unread, and nothing was done today | _not done, deferred to the clean start_ |
| 7 | **Prune the images nothing runs**, after step 15: `caddy:2`, `postgres:16`, `postgres:16-alpine`, `cuatro-tracker-app`, `cuatro-tracker-worker`, `cuatro-tracker-migrate` (`docker image rm`, each by name) | Images hold no data; disk only. Or leave them to the clean start. **2026-10-01, decided: deferred** to the Operator's planned clean start of every application after this project, on the same word as action 1; disk read 22G of 96G used after step 15, and nothing was pruned today | _not done, deferred to the clean start_ |

**Maintaining this file.** When an action is performed, replace its cell with the ISO 8601 UTC date and
leave the row in place.
