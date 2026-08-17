# Routing inventory

Which hostname reaches which application, on which address, through what. Written during
Story 1-21 (the Anchor's move onto the Hostinger VPS) on **2026-08-17**.

This file follows the pattern `ops/estate.md` and `ops/monitoring.md` set: every value is
marked as either a decision or an observation, and the two are never presented as the same
kind of fact (NFR-9).

**This is not the whole of Story 1.7.** Story 1.7 is a read-only enumeration of the estate's
routing across every address. This file records what Story 1.21 had to know in order to move
the Anchor safely, gathered by SSH against the serving box on 2026-08-17, plus the DNS pass
Story 1.7 already completed on 2026-08-16. What Story 1.7 still owes is listed at the end.
**Unlike Story 1.7's pass, this one changed things**, and every change it made is named below.

## The estate serves from one address

**As of 2026-08-17T08:00Z every `cuatro.dev` hostname resolves to `177.7.52.248`.** Before
that date the estate spanned two addresses, which is the condition the 2026-08-16 topology
correction recorded and Story 1.21 closed.

| Field | Value | Nature |
|---|---|---|
| Address | `177.7.52.248` | **Observed 2026-08-17** |
| Hostname | `srv1842312` | **Observed** |
| Provider | Hostinger KVM 2 | **Observed 2026-08-16.** The IPv6 range `2a02:4780::/29` is Hostinger's |
| Term | Prepaid to 2028-07-19 | Recorded 2026-08-16 from the Operator |
| OS | Ubuntu 24.04.4 LTS, kernel 6.8.0 | **Observed** |
| Capacity | 2 vCPU, 7.9 GB RAM, 96 GB disk | **Observed.** 76 GB free, 6.1 GB memory available, load 0.17 before the Anchor was added |
| Docker | 29.6.2, Compose v5.3.1 | **Observed** |
| Access | `deploy`, in groups `docker` and `sudo`, passwordless sudo | **Observed** |

## Hostnames

One row per hostname. All six were verified from outside on 2026-08-17 with a client
performing full certificate validation.

| Hostname | Address | DNS record | Terminates TLS | Serves it | Container | Port |
|---|---|---|---|---|---|---|
| `cuatro.dev` | `177.7.52.248` | A, DNS-only, TTL 60 | `cs-tracker-caddy-1` | `cuatro-portfolio` (the Hub) | `cuatro-portfolio-anchor-app-1` | 3000 |
| `www.cuatro.dev` | `177.7.52.248` | A, DNS-only, TTL 60 | `cs-tracker-caddy-1` | 301 redirect to the apex, no application behind it | none | n/a |
| `analytics.cuatro.dev` | `177.7.52.248` | A, DNS-only, TTL 60 | `cs-tracker-caddy-1` | Umami | `cuatro-portfolio-anchor-umami-1` | 3000 |
| `cs-tracker.cuatro.dev` | `177.7.52.248` | A + AAAA, DNS-only | `cs-tracker-caddy-1` | `cs-tracker` (Phoenix) | `cs-tracker-app-1` | 4000 |
| `tracker.cuatro.dev` | `177.7.52.248` | A + AAAA, DNS-only | `cs-tracker-caddy-1` | `cuatro-tracker` | `cuatro-tracker-app-1` | 3000 |
| `library.cuatro.dev` | `177.7.52.248` | A + AAAA, DNS-only | `cs-tracker-caddy-1` | `digital-library`, path split | `digital-library-api-1` (`/api/*`, `/files/*`), `digital-library-web-1` (everything else) | 4000, 3000 |

**Not ours, in the same zone.** `covidmap.cuatro.dev` and `future-vizion.cuatro.dev` are
CNAMEs to Vercel and both serve. `_domainconnect.cuatro.dev` is a proxied Squarespace
leftover. `_vercel.cuatro.dev` is a Vercel domain-verification TXT. None is in `ops/estate.md`,
which is recorded as deferred work rather than fixed here.

**`n8n.cuatro.dev` no longer exists.** It was in the zone on 2026-08-16 pointing at the old
address. On 2026-08-17 the zone holds 25 records and none is `n8n`. Its two open questions,
what it was serving and whether it held state worth keeping, are closed by the record being
gone rather than by anyone answering them.

**No AAAA record was added for the three moved hostnames**, though the three Satellites have
them on the same box. The session doing the move had no IPv6 egress and therefore could not
verify IPv6 serving for any hostname, including the ones that already have AAAA records.
Adding a record that cannot be tested would be asserting a property rather than observing it.
Recorded as deferred work.

## One shared Caddy is the sole ingress

**`cs-tracker-caddy-1` (image `caddy:2`) is the only container on the box publishing ports**,
`0.0.0.0:80` and `0.0.0.0:443`. Every hostname above reaches its application through it.

| Field | Value |
|---|---|
| Config | `/home/deploy/cs-tracker/Caddyfile`, mounted read-only into the container |
| Certificates | Let's Encrypt, in the `cs-tracker_caddy_data` volume, one directory per hostname |
| Challenge type | **HTTP-01.** Observed: certificate storage under `acme-v02.api.letsencrypt.org-directory`, and no `dnsChallenge` provider anywhere in the config |
| Admin API | `127.0.0.1:2019`, IPv4 only. `caddy reload` works; a probe to `localhost` fails because it resolves to `::1` first |
| Reload | Graceful config swap, listeners are not dropped |

**The ACME finding closes an open question that was blocking two stories.** The routing
checklist could not tell whether the box used HTTP-01 or DNS-01, and Story 1.3 needs the
answer before it can disable ACME under AD-26. It is HTTP-01, and **the box holds no
Cloudflare credential of any kind**. That confirms the checklist's working conclusion that the
two Cloudflare API tokens found on 2026-08-16 (`tracker-mac` and `cuatro-tracker`) are
orphaned: nothing on this box uses them to issue anything.

### Sibling stacks attach to that Caddy's network

Four compose projects run on the box. Only `cs-tracker` publishes ports; the rest join the
`cs-tracker_default` network under stable aliases, and the shared Caddyfile reverse-proxies
those aliases by name.

| Project | Directory | Aliases it adds to the shared network |
|---|---|---|
| `cs-tracker` | `/home/deploy/cs-tracker` | owns the network, plus `caddy`, `app`, `db` |
| `cuatro-tracker` | `/home/deploy/cuatro-tracker` | `cuatro-app` |
| `digital-library` | `/home/deploy/digital-library` | `library-api`, `library-web` |
| `cuatro-portfolio` | `/home/deploy/cuatro-portfolio` | `anchor-app`, `anchor-umami` |

**A name collision on that network is a live hazard, and one already exists.** Compose gives a
service its own name as a DNS alias on every network it joins. On 2026-08-17 `app` resolves to
**two** containers, `cs-tracker-app-1` and `cuatro-tracker-app-1`, because the latter's service
is also called `app`. The shared Caddyfile proxies `app:4000` for `cs-tracker.cuatro.dev`, and
`cuatro-tracker-app-1` does not listen on 4000. This predates Story 1.21 and is recorded as
deferred work. It is also why every service in the Anchor's compose file is named `anchor-*`.

## Where the deploy actually goes

| Field | Value | Nature |
|---|---|---|
| `SERVER_HOST` before 2026-08-17 | Not this box | **Observed, by absence.** `.github/workflows/deploy.yml` ran `cd ~/projects/cuatro-portfolio`, and no `~/projects` directory has ever existed on `177.7.52.248`. The secret's value is not readable from the repository |
| `SERVER_HOST` after | `177.7.52.248` | **Operator action, completed 2026-08-17** |
| Checkout path | `/home/deploy/cuatro-portfolio` | **Decided 2026-08-17**, matching the sibling convention. `deploy.yml` was corrected in the same change |
| Deploy mechanism | `docker compose up --build -d` over SSH | Unchanged. A standing AD-8 violation tracked in Story 1-9 and retired in Epic 3 |

**Deploy repoint status: DONE 2026-08-17.** The secret now resolves to this box, so a merge to
`main` is a real deploy against the machine serving all six hostnames.

**That makes one ordering constraint load-bearing for the rest of Epic 1.** The Operator's
standing policy is that `main` is merged only when an epic completes, so the gap below persists
by design rather than for a few hours.

As of 2026-08-17 the box's checkout sits at `main` (`54d3a0d`) with `docker-compose.yml` and
`docker/Dockerfile` **modified in place**, because the corrected versions were applied directly
during the cutover and are committed on `dev`, not `main`. `origin/main` still carries the
pre-move compose file: a `caddy` service publishing `80:80` and `443:443`, and services named
`app`, `db` and `umami`. A deploy from that commit would `reset --hard` the box onto it,
discard the working files, recreate the shared-network name collisions, and contend for the
ports `cs-tracker-caddy-1` holds. **The blast radius is the whole estate, not just the Anchor.**

**In the normal flow this cannot fire**, because `deploy.yml` triggers only on `main` and
nothing reaches `main` mid-epic. The live risk is a direct push to `main`, or a hotfix merged
ahead of the epic close.

**Recovering the box's configuration if it is ever lost** is cheap, because the correct files
are pushed and reachable from the box:

```
cd /home/deploy/cuatro-portfolio
git fetch origin dev
git checkout origin/dev -- docker-compose.yml docker/Dockerfile .dockerignore
docker compose --env-file .env.production up -d --remove-orphans
```

When Epic 1 closes and `dev` reaches `main`, the box's checkout and its running configuration
agree for the first time, `git status` there goes clean, and this whole section expires.

## The address the estate left

| Field | Value | Nature |
|---|---|---|
| Address | `95.216.143.251` | **Observed.** Served `cuatro.dev`, `analytics.cuatro.dev` and `n8n.cuatro.dev` until 2026-08-17 |
| Fate | The box no longer exists | **The Operator's statement, 2026-08-16 and 2026-08-17.** Recorded as a decision, not an observation |
| What a probe still sees | Port 443 completes a handshake presenting a self-signed `CN=TRAEFIK DEFAULT CERT` | **Observed 2026-08-17T08:00Z**, after the move |
| Estate exposure | None | **Observed.** No `cuatro.dev` record resolves there as of 2026-08-17T08:00Z |

**These last two rows disagree, and the disagreement is the point.** The Operator states the
box is gone; something still answers on that address. This record does not resolve the
contradiction and does not claim a decommissioning that this session performed, because it
performed none. What matters for the acceptance is the fourth row: nothing of the estate's
points there any more. If the address was recycled to another customer, that is also the
explanation for the certificate having been reissued on 2026-08-16.

**Nothing was carried across, and that was not a loss.** The only state known to have been on
that address was the Umami database. It was not recoverable: the session had no credential for
the box and the Operator states it is gone. The discarded history is recorded as a deliberate
drop in `ops/monitoring.md`.

## Configuration that exists only on the box

This set is what a rebuild has to recreate from nothing, and it is the reason Story 1.7 exists.

| What | Where | In any repository? |
|---|---|---|
| Every site block for every hostname | `/home/deploy/cs-tracker/Caddyfile` | **Partially.** The Anchor's three blocks are now mirrored in `docker/Caddyfile`. The other four hostnames' blocks are box-only |
| `cuatro-tracker`'s ingress override | `~/cuatro-tracker/docker-compose.override.yml` | No, git-ignored by design |
| `digital-library`'s ingress override | `~/digital-library/docker-compose.override.yml` | No, git-ignored by design |
| Per-project secrets | `.env` / `.env.production` in each project directory | No, and correctly so |
| Redeploy and backup scripts | `~/cuatro-redeploy.sh`, `~/library-redeploy.sh`, `~/cuatro-backup.sh`, `~/library-backup.sh` | No |
| Operator notes | `~/README.md` and its `.bak-*` copies | No |

### Live credentials, tracked here so none is forgotten

| Credential | Scope | Status |
|---|---|---|
| Cloudflare zone-edit token, created 2026-08-17 | DNS edit on the `cuatro.dev` zone only. No account-level rights, no other zone | **Retained deliberately** by Operator decision on 2026-08-17, for future estate work. Held in the gitignored local `.env` as `CLOUDFLARE_TOKEN`. This is the only credential in the estate that can rewrite the apex A record, so it is written down rather than left implicit |
| Cloudflare API token `tracker-mac` | Unverified | Orphaned. Nothing on the box uses it: ingress issues over HTTP-01 and holds no Cloudflare credential. Story 1.3 sequences its revocation after Origin CA lands |
| Cloudflare API token `cuatro-tracker` | Unverified | Orphaned, same reasoning and same owner |
| Umami admin password | `analytics.cuatro.dev` | Set by the Operator on 2026-08-17, replacing both the shipped default and the agent-generated rotation. The agent-written `.umami-admin` file was shredded from the box the same day |
| `deploy` SSH key, GitHub `SSH_PRIVATE_KEY` | Shell on `177.7.52.248`, passwordless sudo | In use by `deploy.yml`. `SERVER_HOST` repointed 2026-08-17 |
| `github_deploy`, `cuatro_tracker_deploy` | Read on one GitHub repository each | In use by the sibling stacks. Neither can clone `cuatro-portfolio`, which is why that repository is cloned over HTTPS |

**The Anchor deliberately does not follow the override convention.** Its network attachment
and aliases are committed in `docker-compose.yml` rather than hidden in a box-only override,
so the repository describes the running system. That was the sharpest complaint in the
2026-08-16 topology correction, and this is the part of it Story 1.21 could close.

**The shared Caddyfile is fragile in one specific way.** It lives inside the `cs-tracker` git
checkout, and every hostname on the box depends on it. A `git reset --hard` in
`/home/deploy/cs-tracker`, which is what the other projects' redeploy scripts do in their own
directories, would discard every appended site block. Backups exist beside it
(`Caddyfile.bak-ops1`, `Caddyfile.bak-library-`, `Caddyfile.bak-1-21`) but nothing enforces
this. Recorded as deferred work.

## What Story 1.21 changed

Named explicitly, because this file otherwise reads like an observation-only record.

| Change | Where | When (UTC) |
|---|---|---|
| Cloned the Anchor and wrote its production secrets | `/home/deploy/cuatro-portfolio` | 2026-08-17T07:02Z |
| Brought up the Hub, Umami and Postgres, no published ports | same | 2026-08-17T07:39Z, corrected 07:52Z |
| Appended three site blocks and reloaded Caddy | `/home/deploy/cs-tracker/Caddyfile`, backup `Caddyfile.bak-1-21` | 2026-08-17T07:58Z |
| Repointed three DNS records to `177.7.52.248`, DNS-only, TTL 60 | Cloudflare zone `cuatro.dev` | 2026-08-17T07:55Z |
| Added the `www.cuatro.dev` monitor, id 803756083 | UptimeRobot | 2026-08-17T07:59Z |

**One defect was introduced and corrected inside the same story.** Between 07:39Z and 07:46Z
the Anchor's stack was attached to the shared network with services named `app`, `db` and
`umami`, which took second leases on names three other stacks already used. `app` resolved to
the Anchor's container instead of `cs-tracker`'s, and the Anchor's own Umami authenticated
against `cs-tracker`'s database and failed with `28P01`. Sampled checks of the three
Satellites returned their normal status codes throughout, but requests Docker's DNS steered to
the wrong container during that window would have failed, so **this record does not claim the
impact was zero**. The stack was removed from the network at 07:46Z, every service was renamed
`anchor-*`, and the reason is pinned in `docker-compose.yml` so it cannot be reintroduced.

## What Story 1.7 still owes

This file is not a substitute for that story.

- The three Satellite projects' internals: their own compose services, volumes, and what each
  container actually runs. Only their ingress path is recorded here.
- Whether anything on the box runs outside Docker and reaches a hostname.
- Each hostname recorded against its Registry application id (AD-3), which Epic 2 needs.
- A confirmation pass on the Cloudflare audit log before either API token is revoked, which
  Story 1.3 sequences after Origin CA lands.
- Backup coverage per project, which Story 1.8 needs for `digital-library`.
