# The settled-inputs refresh before Epic 4

The refresh check AD-22 requires before an epic whose inputs have a shelf life, run for Epic 4 by
Story 4-1, and the three decisions the epic cannot open without: which PostgreSQL major the rebuild
targets, whether it runs in place or on a second box, and how every hostname keeps serving while one
box holds one 80/443 pair (NFR-2). It is the artifact Story 4-1 delivers.

This file is a record, not Registry data. Every value is marked as a decision or an observation, and
the two are never presented as the same kind of fact (NFR-9). Dates and times are ISO 8601 UTC.

**The scope is AD-22's own list in the spine** (`ARCHITECTURE-SPINE.md` § AD-22), not the copy in
`epics.md` Story 4.1, which the epic's amendment of 2026-09-24 says has fallen behind. Nothing outside
that list was re-opened, and no decision was re-litigated because time passed. **Run 2026-09-30
between 08:28Z and 08:48Z** on the Windows 11 development host, from `dev` at `f4f9935`; the public
DNS, the edge certificates and the Caddy container's usage were read at 09:05Z to 09:07Z the same day.

## Contents

1. [The list, item by item](#the-list-item-by-item)
2. [The observed serving topology](#the-observed-serving-topology)
3. [Decision: PostgreSQL 18](#decision-postgresql-18)
4. [Decision: rebuild in place on the one box](#decision-rebuild-in-place-on-the-one-box)
5. [Decision: how NFR-2 holds on one 80/443 pair](#decision-how-nfr-2-holds-on-one-80443-pair)
6. [What moved, and where it went](#what-moved-and-where-it-went)
7. [Pending Operator actions](#pending-operator-actions)

## The list, item by item

| Item | Settled value | Observed 2026-09-30 | Method | Verdict |
|---|---|---|---|---|
| Traefik | v3.7.10 (2026-07-31) | **v3.7.13**, released 2026-09-04; no `v3.8` or later tag and no prerelease on the v3 line | `gh api repos/traefik/traefik/releases`; Docker Hub `library/traefik` tags list `v3.7.13` and `v3.7` | **Moved, patch.** Stack row updated. Story 4.2 pins what is current the day it lands |
| PostgreSQL | 18.6; 19 GA expected September 2026 | **18.6** is the newest 18 (tag `REL_18_6`, 2026-08-11; Docker Hub `18.6`). **19 is at Beta 4** (`REL_19_BETA4`, 2026-09-21; Docker Hub `19beta4`), no RC tag. postgresql.org's roadmap: "This release is planned for October 2026", "September 24, 2026: PostgreSQL 19 Beta 4 Released!", next minor release "November 12th, 2026" | `gh api repos/postgres/postgres/tags` (paginated); Docker Hub `library/postgres` tags; `https://www.postgresql.org/developer/roadmap/` | **19 is not GA.** Decided below: 18 |
| restic | 0.19.1 (2026-07-05) | **0.19.1**, still the latest | `gh api repos/restic/restic/releases` | Unchanged |
| `docker-rollout` | v0.14 (2026-07-12) | **v0.14**, still the latest | `gh api repos/wowu/docker-rollout/releases` | Unchanged. The box's deploy already runs it (`ops/deploy-remote.sh`) |
| Clerk pricing | Free to 50,000 MRU per app, every plan unlimited applications, Pro 25 USD a month (read 2026-08-15) | "50,000 per app" on Free; Pro "$25/mo" (or "$20/mo billed annually"); "Every plan gets unlimited applications"; overage "$0.02/mo each" beyond 50,000 MRUs on Pro and Business | `https://clerk.com/pricing` | Unchanged. The annual price and the overage are recorded, not new decisions |
| Railway pricing | Hobby 5 USD a month including 5 USD credit; 20 USD per vCPU, 10 USD per GB RAM a month; egress 0.05 USD per GB (read 2026-08-15) | Hobby "$5/month, including $5 of monthly usage credits"; Pro "$20/month per workspace, including $20 of monthly usage credits"; CPU "$0.00000772 per vCPU/s", memory "$0.00000386 per GB/s", egress "$0.05 per GB (services)" | `https://railway.com/pricing` | Unchanged. AD-9's overflow path ($15 to $30 a month for two heavy applications) still costs what it did |
| Style Dictionary security floor | ≥ 5.5.1 | **The floor is now 5.5.5.** Two high advisories published 2026-09-20 are patched only in 5.5.5: GHSA-cr3w-v879-f973 (prototype pollution in `convertTokenData` through nested `constructor.prototype` and `__proto__` keys) and GHSA-5pgh-4v89-hfqj (the GHSA-vj5c-m527-mpff fix incomplete in 5.4.4 and 5.5.0). Latest is 5.5.5 (npm, 2026-09-20). **This repository pins 5.5.2** (`packages/tokens/package.json`, `pnpm-lock.yaml`), inside both advisories' vulnerable ranges (`>= 5.5.1, <= 5.5.4` and `>= 4.3.0`) | `gh api repos/style-dictionary/style-dictionary/security-advisories`; `npm view style-dictionary` | **Moved, and the pin is below it.** Stack row updated; the bump is filed as DW-295, not made here |
| Let's Encrypt lifetime schedule | 90 days, then 64 in February 2027, then 45 in February 2028 | Unchanged: "May 13, 2026", the `tlsserver` profile at 45 days; "February 10, 2027", the classic profile at 64 days with a 10-day authorization reuse period; "February 16, 2028", 45 days with a 7-hour authorization reuse period | `https://letsencrypt.org/2025/12/02/from-90-to-45` (published 2025-12-02) | Unchanged. Under AD-26 no origin ACME runs for a proxied host, so the schedule binds only Story 4.2's DNS-01 scratch hostname |
| Observed serving topology | `ops/routing-inventory.md` | See the next section: the eight box hostnames resolve only to Cloudflare anycast (proxied) and present an edge certificate from Google Trust Services; `covidmap` and `future-vizion` are DNS-only CNAMEs to Vercel | Read-only box reads over the `deploy` key; public DNS over DNS-over-HTTPS; `openssl s_client` and `curl -I` against each hostname | Unchanged in shape: one box, one Caddy, every box hostname proxied |
| daisyUI route probe | exit 0, 7 of 7 (2026-09-24) | **exit 0**, 7 cases, 7 PASS, started 2026-09-30T08:29:53.244Z, 83.1s, against `cs-tracker` at `2519fe3` | `node ops/daisyui-route-probe.mjs` | Reproduced. Written into `ops/daisyui-route.md` |
| `cs-tracker` token adoption probe | exit 0 | **exit 0**, 19 cases, 19 PASS, started 2026-09-30T08:31:41.849Z, against the Hub built at `f4f9935` | `node ops/cs-tracker-adoption-probe.mjs` after `corepack pnpm --filter hub build` | Reproduced. Written into `ops/cs-tracker-token-adoption.md` |
| Scheduled Registry verification | dispatched and green | Run [36690453047](https://github.com/LuigiEspinosa/cuatro-portfolio/actions/runs/36690453047), `workflow_dispatch` on `main` at `373e33d`, created 08:33:35Z, **success**, `# 41 of 41 checks passed`; the workflow's state reads `active` | `gh workflow run registry-verification.yml --ref main`; `gh run view`; `gh api .../actions/workflows/registry-verification.yml` | Green. Written into `ops/registry-verification.md` |
| `cs-tracker` accessibility probe | exit 1, 13 cases, 6 PASS, 7 FAIL, 74 hit-target and 38 transition findings (2026-08-27) | **exit 1**, 13 cases, 6 PASS, 7 FAIL, **74** elements under the floor and **38** transitioned rings, the same counts, started 2026-09-30T08:33:02.518Z, 22.4s | The record's six commands, a throwaway `postgres:16` container removed afterwards | Reproduced, no regression and no fix. Written into `ops/cs-tracker-accessibility-pass.md` |
| Estate automation-policy sweep | automation enabled nowhere (2026-09-25) | **Enabled nowhere.** Ten repositories: no configuration at any of the fifteen paths, no `renovate` key, security fixes off, `allow_auto_merge` false, no bot-authored pull request | `gh api`, by the maintenance rule of `ops/contract-adoption.md` | Unchanged. Written into `ops/contract-adoption.md` |
| Upstream font pins | the three sources pinned 2026-08-25, re-checked 2026-09-25 | Each pinned path's last upstream commit is still the pinned commit, and the file at the upstream head has the pinned bytes and sha256; Geist is still 13 commits past its pin with v1.7.2 its latest release, Bricolage 4 past with no release | `gh api` commits, compare and releases; `curl` of each file at the head, `sha256sum` | Unchanged since 2026-09-25. Written into `ops/font-contract.md` |
| Tailwind pin | `tailwindcss` and `@tailwindcss/cli` at 4.3.3 | **4.3.3** is the latest release of both (released 2026-07-16; npm `dist-tags.latest`) | `npm view`; `gh api repos/tailwindlabs/tailwindcss/releases` | Unchanged, so `TAILWIND_NAMESPACES` has no release notes to be diffed against |

## The observed serving topology

**Observed 2026-09-30T08:28:09Z over SSH as `deploy`**, read-only (`uptime`, `docker ps`, `free -m`,
`df -h /`, `nproc`, `docker version`, and `grep` over the shared Caddyfile). **Public DNS and the edge
observed 2026-09-30T09:05:59Z** from the development host, with no credential: A and AAAA for the ten
hostnames from Cloudflare's DNS-over-HTTPS resolver (`https://cloudflare-dns.com/dns-query`), the
edge certificate's issuer by `openssl s_client`, and the `server` header by `curl -I`. What only the
zone token can show (the zone's SSL mode and its ruleset phases) was not read; those cells stay
`ops/routing-inventory.md`'s of 2026-08-24, and re-reading them is Pending Operator action 1.

| Fact | Value | Nature |
|---|---|---|
| Serving addresses | **One**: `177.7.52.248` (`srv1842312`, Hostinger KVM 2). The second address of 2026-08-16 was retired by Story 1.21 | Box observed 2026-09-30; the retirement is `ops/routing-inventory.md` § The address the estate left |
| Hostnames on the box | Eight site blocks in `/home/deploy/cs-tracker/Caddyfile`: `{$PHX_HOST}` (`cs-tracker.cuatro.dev` by the record; the variable's value was not read), `tracker`, `library`, the apex, `www`, `analytics`, `wheel`, `tournament` | **Observed** by `grep` over the file |
| DNS | The apex, `www`, `tracker`, `cs-tracker`, `library`, `analytics`, `wheel` and `tournament` each resolve to `104.21.43.165` and `172.67.181.184` (A) and `2606:4700:3035::6815:2ba5` and `2606:4700:3037::ac43:b5b8` (AAAA), Cloudflare anycast, TTL 300, so every one is proxied and none publishes `177.7.52.248`. `covidmap` and `future-vizion` are CNAMEs to `*.vercel-dns-017.com` (A records in Vercel's `216.198.79.0/24` and `64.29.17.0/24`, whose host octet varies by hostname and over time: `covidmap` answered `.65` and `future-vizion` `.1` at about 09:15Z, and both `.65` when re-read later that day), so DNS-only (KV-7) | **Observed** 2026-09-30T09:05:59Z over DNS-over-HTTPS |
| TLS | Cloudflare terminates at the edge: each of the eight box hostnames presents a certificate issued by `Google Trust Services, CN=WE1` and answers `server: cloudflare`, while `covidmap` and `future-vizion` present `Let's Encrypt, CN=YR1` and answer `server: Vercel`. The origin presents the Origin CA certificate: the file holds eight `tls /data/origin-ca/origin.pem /data/origin-ca/origin.key` lines, one inside each site block (lines 23, 40, 55, 77, 88, 98, 112 and 123), and the ACME `email` block is commented out. The zone's SSL mode, Full (strict), is the record's | **Observed** 2026-09-30T09:05Z at the edge and by `grep` at the origin; the SSL mode is the record's, 2026-08-24, Pending Operator action 1 |
| Ingress | `cs-tracker-caddy-1` (`caddy:2`) is the only container publishing ports: `0.0.0.0:80`, `[::]:80`, `0.0.0.0:443`, `[::]:443` | **Observed** by `docker ps` |
| Running | 17 containers: the Hub (`hub:373e33d`), `tournament` and `tournament-worker` (`019394d`), `tracker` and `tracker-worker` (`5117673`), `list-wheel`, `cs-tracker-app-1` (`cs-tracker:latest`, built on the box), `anchor-db` (`postgres:16-alpine`), `anchor-umami` (`postgresql-latest`), `digital-library` `web`, `api`, `redis`, the old tracker project's `postgres`, `redis`, `qbittorrent`, `cs-tracker-db-1` (`postgres:16`) and the Caddy | **Observed** |
| Postgres containers today | Three: `cuatro-portfolio-anchor-db-1`, `cuatro-tracker-postgres-1`, `cs-tracker-db-1`; the tournament's store is Supabase Cloud (AD-10 exception, `ops/tournament-placement.md`) | **Observed**, and the record |
| Load | `0.13, 0.17, 0.17`; load15 0.17 against the Capacity Gate's 0.60 | **Observed** by `uptime` |
| Memory, disk | 7,940 MB total, 5,519 MB available, swap 10 of 2,047 MB used; 96 GB disk, 77 GB free (21%) | **Observed** |
| Host | 2 cores, uptime 72 days, Docker 29.6.2, Compose 5.3.1 | **Observed** |
| Origin firewall | `DOCKER-USER` returns only Cloudflare's ranges on `multiport dports 80,443`, then drops | From the record, re-read 2026-08-24; not re-read here |

## Decision: PostgreSQL 18

**Decision, 2026-09-30, the Operator may overrule.** The rebuild's one Postgres is **PostgreSQL 18**,
the image pinned to the newest 18 minor the day Story 4.4 lands (`postgres:18.6` or its successor, and
at least the major, per the spine's pinning rule).

- 19 is not GA on 2026-09-30: Beta 4, no release candidate, GA "planned for October 2026". The epic's
  expectation of a September GA did not hold.
- Story 4.4 is the next story that needs it, and would otherwise target a beta or a `.0` a few weeks
  old. A greenfield with no users gains nothing from 19 that 18 lacks for these consumers.
- Every consumer today runs 16 (`postgres:16-alpine` and `postgres:16`), so Story 4.4 crosses majors
  by dump and restore either way; 18 to 19 later is the same `pg_dump` path Story 4.5 proves, one
  database at a time.
- Re-opening this is AD-22's to trigger, not time's: the next refresh reads whether 19 is GA and has
  had its first minor.

## Decision: rebuild in place on the one box

**Decision, 2026-09-30, the Operator may overrule.** The rebuild runs **in place on the one box**. No
temporary second box.

**The starting point is the observed topology, not an assumption.** The epic's amendment of
2026-08-16 noted two serving addresses; that partial answer has since been undone, because Story 1.21
retired the second address and every hostname now resolves through one box. So a second box would be
bought fresh rather than inherited.

| Question | In place | Temporary second box |
|---|---|---|
| Marginal cost (NFR-4, $40 to $100 a month all-in) | **$0.** The box is prepaid to 2028-07-19 | A second Hostinger KVM 2 is advertised at "$8.99/mo", renewing at "$14.99/mo for 2 years" (`https://www.hostinger.com/vps-hosting`, read 2026-09-30; the shortest term and its price were not read). Within NFR-4, but spent on nothing the end state keeps |
| Load (SM-C4, load15 threshold 0.60) | Load15 0.17 at 08:28Z and 0.23 at 09:06Z. The incumbent proxy's own cost, taken as the nearest measured stand-in for an idle Traefik: `cs-tracker-caddy-1` at 0.15% CPU and 20.95 MiB (`docker stats --no-stream`, 2026-09-30T09:06:04Z, one sample). Traefik's own cost is not measured until Story 4.2 starts it, so each placement step reads load and per-container CPU as the tournament placement's step 7 did, and the gate's line stands | A second box's load does not count against this one, but the old box keeps every service until the last cutover, so SM-C4 gains nothing until the end |
| Data | Stores move between containers on one host: volumes and dumps stay local, and the old containers stay as the rollback | Every store (three Postgres databases, `digital-library`'s SQLite and Redis, qBittorrent's state) crosses hosts, twice if the box is then rebuilt, over a link this estate has never measured |
| Certificates and DNS | The Origin CA certificate on the box serves every hostname; no DNS record changes | The certificate and key must be copied to a second host; every A and AAAA record changes at cutover, and the origin firewall must be rebuilt there first |
| Capacity Gate (AD-9) | The ids already placed keep deploying | A new box has no measurement, and AD-9 says unmeasured capacity fails closed |

## Decision: how NFR-2 holds on one 80/443 pair

**Decision, 2026-09-30, the Operator may overrule. This is the mechanism Story 4.2 implements.**

**Traefik runs beside Caddy on a second published port, and each hostname moves by a Cloudflare
Origin Rule that overrides its destination port.** Caddy keeps 80 and 443 for the whole epic. Traefik
publishes one extra port, `8443` (Decision: one of the HTTPS ports Cloudflare proxies anyway), and
presents the same Origin CA certificate. A hostname moves when an Origin Rule matching
`http.host eq "<hostname>"` sets destination port 8443: from then on Cloudflare sends that hostname's
traffic to Traefik, and every other hostname still reaches Caddy. Deleting the rule moves it back,
which is the per-hostname rollback, taking effect without touching the box.

One side effect, stated so nobody mistakes it for a leak: because 8443 is a port the edge proxies
anyway, a client asking for `https://<hostname>:8443` reaches Traefik before that hostname moves.
The zone's WAF rules still apply (they match on host, not port), and Traefik answers 404 for a
hostname it has no router for yet.

**Why this and not the alternatives.**

- **A single cutover of 80/443 from Caddy to Traefik** puts every hostname through one port handoff:
  between Caddy releasing 443 and Traefik binding it, the edge gets connection refused and serves
  error 521 on all eight at once, and a Traefik router that is wrong for one host is found under live
  traffic on all of them. It also contradicts the epic's one-hostname-at-a-time migration.
- **Caddy forwarding a hostname to Traefik** (a `reverse_proxy traefik:8443` block per host) works on
  the box alone, but every step is an edit to the shared Caddyfile that is not in git (`docker/Caddyfile`
  is a fragment no process reads), and the path through two proxies is not the one the end state runs.
- **Origin Rules are on the Free plan**: Cloudflare's availability table gives Free 10 origin rules
  with the destination port override (host header, SNI and DNS record overrides are Enterprise only),
  read 2026-09-30 at `https://developers.cloudflare.com/rules/origin-rules/`. Eight hostnames fit.

**What Story 4.2 needs before the first rule** (each an Operator item below, none done here):

1. The origin firewall admits 8443: `cf-origin-firewall.sh`'s `DOCKER-USER` rules match
   `multiport dports 80,443` today, and `ufw` holds the same ports, so both gain 8443 for Cloudflare's
   ranges only, and a direct request to `177.7.52.248:8443` from elsewhere must still be dropped.
2. A Cloudflare API token that may edit the zone's origin rules. The zone token of 2026-08-24 could
   not read several ruleset phases (`ops/routing-inventory.md` § Zone settings); whether it can write
   `http_request_origin` is unknown.
3. Traefik joins `cs-tracker_default` (where every upstream's alias lives today) so its routers can
   reach the same containers Caddy does before any service moves.

**What it leaves to Story 4.11.** Once every hostname runs through Traefik, Caddy serves nothing and
can stop. Whether Traefik then takes 80 and 443 (a second Traefik service bound to them, each rule
deleted one at a time, then the 8443 service removed, so again no handoff under traffic) or keeps 8443
with the rules as permanent configuration is 4.11's decision; the first keeps the routing in git.

## What moved, and where it went

| Moved | Where it is recorded | What follows |
|---|---|---|
| Traefik v3.7.10 to v3.7.13 | `ARCHITECTURE-SPINE.md` § Stack, dated | Story 4.2 pins the current patch the day it lands |
| PostgreSQL target decided, 18 | `ARCHITECTURE-SPINE.md` § Stack, dated | Story 4.4 |
| Style Dictionary floor 5.5.1 to 5.5.5, with the pin at 5.5.2 | `ARCHITECTURE-SPINE.md` § Stack, dated; DW-295 | The bump, a dependency change with its own review and a `tokens:build` drift check |

Every other item re-read its settled value. The three probe records, the policy table, the font
record and the Registry verification record carry their own dated entries for this run.

## Pending Operator actions

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| 1 | **Re-read the zone settings** with the zone token: `GET /zones/{id}/settings/ssl` (the SSL mode, Full (strict) by the record) and the ruleset phases the token of 2026-08-24 could not read, compared with `ops/routing-inventory.md` § Zone settings | The addresses, the proxied state and the edge certificate were observed publicly on 2026-09-30 (§ The observed serving topology); only these zone-internal settings need the token | _not done_ |
| 2 | **Confirm or overrule the three decisions**: PostgreSQL 18; in place on the one box; Traefik beside Caddy on 8443 with one Origin Rule per hostname | Each is recorded as a decision the Operator may overrule. Story 4.2 builds on the third | _not done_ |
| 3 | **Rule on DW-295**, the Style Dictionary bump to 5.5.5 | The pin is below the new floor | _not done_ |
| 4 | **Before Story 4.2's first Origin Rule**: widen the origin firewall to 8443 for Cloudflare's ranges, and provide a token that may edit origin rules | Story 4.2's runbook will name the exact commands; the two prerequisites are recorded here so that story opens knowing them | _not done_ |

**Maintaining this file.** When an action is performed, replace its cell with the ISO 8601 UTC date and
leave the row in place. The next refresh is a new dated file or a new dated section here, never an
edit of this run's observations.
