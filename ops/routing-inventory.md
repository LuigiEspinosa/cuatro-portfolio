# Routing inventory

Which hostname reaches which application, on which address, through what. This is Story 1.7's
record: the read-only enumeration of the deployed routing table, which exists in no repository
(forced change C-9). Epic 4's greenfield rebuild recreates the estate from this file.

This file follows the pattern `ops/estate.md` and `ops/monitoring.md` set: every value is
marked as either a decision or an observation, and the two are never presented as the same
kind of fact (NFR-9). Dates and times are ISO 8601 UTC.

## Contents

1. [What would invalidate this record](#what-would-invalidate-this-record)
2. [Two gathering passes, deliberately kept apart](#two-gathering-passes-deliberately-kept-apart)
3. [This pass was read-only, and here is the evidence](#this-pass-was-read-only-and-here-is-the-evidence)
4. [The box](#the-box)
5. [The whole zone, all 25 records](#the-whole-zone-all-25-records)
6. [Zone settings and rules at the edge](#zone-settings-and-rules-at-the-edge)
7. [Every hostname in the zone](#every-hostname-in-the-zone)
8. [Observed from outside, 2026-08-24](#observed-from-outside-2026-08-24)
9. [AD-3: hostname against application id](#ad-3-hostname-against-application-id), including the
   reverse pass from every application id back to a hostname
10. [Ingress: one shared Caddy, and nothing else](#ingress-one-shared-caddy-and-nothing-else),
    including the site blocks, the running-config comparison, ACME and the origin firewall
11. [Nothing outside Docker reaches a hostname](#nothing-outside-docker-reaches-a-hostname),
    including port 22
12. [What each compose project actually runs](#what-each-compose-project-actually-runs),
    including image identity and declared against running
13. [Volumes, sizes, and the one unbounded path](#volumes-sizes-and-the-one-unbounded-path)
14. [Backup coverage, per project](#backup-coverage-per-project)
15. [Scheduled work on the box](#scheduled-work-on-the-box)
16. [Configuration that exists only on the box](#configuration-that-exists-only-on-the-box),
    including the variable names each project needs and the live credentials
17. [Where the deploy goes](#where-the-deploy-goes)
18. [The address the estate left](#the-address-the-estate-left)
19. [What Story 1.21 changed](#what-story-121-changed)
20. [Story 1.7 close-out, 2026-08-24](#story-17-close-out-2026-08-24)
21. [How to re-gather this record](#how-to-re-gather-this-record)

## What would invalidate this record

This file is a dated observation, not a contract. It stops describing the estate the moment
any of the following happens, and each one is a reason to re-run the appendix at the end
rather than to trust what is written above.

| Event | What it invalidates |
|---|---|
| A deploy to `main`, or any `docker compose up` in any of the four project directories | Container ids, image ids, uptimes, and possibly the network aliases and the declared-against-running comparison |
| Any edit to `/home/deploy/cs-tracker/Caddyfile`, or a `caddy reload` | The site blocks, the running-config comparison, and every hostname-to-container row |
| A reboot of the box | The `DOCKER-USER` chain, unless `cf-origin-firewall.service` starts cleanly. Also every uptime figure |
| Any DNS write in the `cuatro.dev` zone | The 25-record table, the hostname table and the AD-3 mapping |
| Any change to Cloudflare zone settings, rulesets or Universal SSL | The edge behaviour section, and possibly the observed status codes |
| Story 1.8 landing its backup fix | The whole of "Backup coverage, per project" |
| Epic 3 landing AD-8, or Epic 4 replacing Caddy with Traefik | The ingress, image and deploy sections in their entirety |

**Review by 2026-11-19**, the notAfter of the Cloudflare edge certificate recorded below,
which is the nearest dated fact in this file that expires on its own. **A decision**, taken
here so that the file carries a date rather than drifting silently.

## Two gathering passes, deliberately kept apart

| Pass | Date | What it was | Did it change anything? |
|---|---|---|---|
| Story 1-21 | 2026-08-17 | The Anchor's move onto the Hostinger VPS. It recorded what the move had to know. | **Yes.** Every change it made is named under "What Story 1.21 changed" |
| Story 1.7 | **2026-08-24** | This one. The full enumeration: the whole zone off the box, the whole box over SSH. | **No.** See the read-only statement below |

**Where the two disagree, the newer observation wins and the older one is kept with its date
rather than overwritten.** A rebuild reading this later needs to know which facts were stable
across a week and which were not.

## This pass was read-only, and here is the evidence

**Nothing on the box, in the Cloudflare zone, or in any vendor console was changed on
2026-08-24.** Every on-box command was a read: `docker ps`, `docker inspect`,
`docker image inspect`, `docker image history`, `docker volume ls`, `docker system df -v`,
`docker logs`, `docker compose config`, `cat`, `ls`, `stat`, `du`, `df`, `wc`, `tail`, `head`,
`grep`, `cut`, `sha256sum`, `md5sum`, `cmp`, `ss`, `sshd -T`, `ufw status`, `systemctl
list-units`, `systemctl list-timers`, `crontab -l`, `iptables -L`, `iptables -t nat -L`,
`ip6tables -L`, `git rev-parse`, `git status`, `git diff`, `git check-ignore`. No `up`, no
`restart`, no `reload`, no `pull`, no edit, no DNS write, no token revocation. Nothing found
broken was fixed.

**Four qualifications, stated rather than glossed.** Each is a read in effect, and each is
named here so a reader can judge it rather than take the word "read-only" on trust.

| What | Why it is still a read |
|---|---|
| Some reads needed `sudo`: `ss -tulnp`, `iptables -L`, `iptables -t nat -L`, `ip6tables -L`, `sshd -T`, `ufw status`, and listing the root-owned `digital-library` data directory and the qBittorrent config | `deploy` has passwordless sudo. Every one of these commands prints state and writes none |
| Scratch files were written under `/tmp` on the box: two Caddy config dumps, two copies of a backup snapshot, and one comparison script | `/tmp` is scratch, holds nothing the estate depends on, and no live file was opened for writing. Nothing outside `/tmp` was created |
| `docker exec cs-tracker-caddy-1 caddy adapt` and `wget http://127.0.0.1:2019/config/` ran inside the running ingress container | `caddy adapt` parses a file and prints JSON. The admin API `GET /config/` prints the loaded config. Neither loads, reloads or mutates anything, and the Caddy log records both as `GET` requests |
| Two HTTPS requests were made to the origin from the box itself over loopback, with `--resolve` | An ordinary `GET` and `HEAD`, the same thing a visitor's browser does. They exist to settle whether the `www` redirect comes from Caddy or from the edge |

The Cloudflare access was `GET` only: `dns_records`, `settings`, `rulesets`, one ruleset by id,
`ssl/verification`, `ssl/universal/settings`, `ssl/certificate_packs` and the zone itself, all
of which succeeded; and `accounts/{id}/audit_logs`, `user/tokens`, `pagerules` and four ruleset
phase entrypoints, which returned 403 and are recorded as unknown or as operator actions.

### The real window, and the confirmation after it

**The window recorded in the first draft of this file, 10:13Z to 10:17Z, was the interval
between the two probe runs, not the duration of the pass.** Stating it as the pass window was
wrong: four minutes does not cover an SSH enumeration, `docker inspect` of sixteen containers,
two iptables dumps, several directory listings and three Cloudflare API calls. The pass ran in
two segments on the same day, and the honest span is below.

| Segment | Span (UTC) | What ran in it |
|---|---|---|
| 1, the enumeration | 2026-08-24T10:13Z to about 10:25Z | First probe 10:13Z, box reads from 10:15:09Z, second probe 10:17Z, and the remainder of the enumeration after it. The second probe did not close the pass |
| 2, the re-gather | 2026-08-24T10:39:15Z to 2026-08-24T11:11:16Z | The checks this file's review asked for: `ss -tulnp`, the NAT table, `sshd -T`, `ufw status`, the Caddy running-config comparison, the backup checksums and integrity checks, image identity, the compose sources, the volume inventory, the variable names, and the Cloudflare settings, rulesets and certificate packs |

Verified by the same probe at four points, the last two of them after every command above had
run.

| Check | 10:13Z, before | 10:17Z | 10:49:16Z | 11:11:16Z, after everything |
|---|---|---|---|---|
| `cuatro.dev` | 200 | 200 | 200 | 200 |
| `www.cuatro.dev` | 301 | 301 | 301 | 301 |
| `analytics.cuatro.dev` | 403 | 403 | 403 | 403 |
| `cs-tracker.cuatro.dev` | 302 | 302 | 302 | 302 |
| `tracker.cuatro.dev` | 307 | 307 | 307 | 307 |
| `library.cuatro.dev` | 302 | 302 | 302 | 302 |
| Container set | 14 running, all `Up` | 14 running, all `Up` | 14 running at 10:46:32Z, uptimes 7 days, 9 days, 11 days and 3 weeks | 14 running at 11:11Z, same names and the same four uptimes |

That six-code sequence is the baseline `ops/bot-mitigation.md:100` recorded on 2026-08-17,
unchanged a week later and unchanged across both segments of this pass. **The uptimes are the
stronger evidence of the two**: a container restarted by anything this pass did would read
minutes rather than weeks.

## The box

One address serves the whole estate. **Observed 2026-08-24T10:15:09Z over SSH**, with the
2026-08-17 reading kept beside it where the two differ.

| Field | 2026-08-24 | 2026-08-17 | Nature |
|---|---|---|---|
| Address | `177.7.52.248` | same | **Observed** |
| IPv6 | `2a02:4780:75:9155::1` | same | **Observed.** `2a02:4780::/29` is Hostinger's range |
| Hostname | `srv1842312` | same | **Observed** |
| Provider | Hostinger KVM 2 | same | **Observed 2026-08-16** |
| Term | Prepaid to 2028-07-19 | same | Recorded 2026-08-16 from the Operator. A **decision**, not observed by this pass |
| OS | Ubuntu 24.04.4 LTS, kernel 6.8.0-134-generic | Ubuntu 24.04.4 LTS, kernel 6.8.0 | **Observed** |
| Docker | 29.6.2 (build `dfc4efb`), Compose 5.3.1 | 29.6.2, Compose v5.3.1 | **Observed** |
| Cores | 2 | 2 | **Observed** (`nproc`) |
| Memory | 7940 MB total, 5456 MB available | 7.9 GB, 6.1 GB available | **Observed** (`free -m`) |
| Disk | 96 GB, 80 GB free, 17% used | 96 GB, 76 GB free | **Observed** (`df -h /`) |
| Load | 0.09, 0.14, 0.15 | 0.17 before the Anchor was added | **Observed** (`uptime`) |
| Uptime | 35 days | n/a | **Observed.** No reboot since the Anchor moved, so nothing here has been tested across one |
| Access | `deploy`, groups `docker` and `sudo`, passwordless sudo | same | **Observed** |

**Memory available fell from 6.1 GB to 5.456 GB and free disk rose from 76 GB to 80 GB across
the week.** Both are consistent with the Anchor's stack settling and the Wednesday
`docker builder prune` running. Neither is near a limit.

## The whole zone, all 25 records

**Observed 2026-08-24 by `GET /zones/{id}/dns_records`** on zone `cuatro.dev`
(id `e90c26d4127883f3b0a56d5932c500f5`, account `cd0752bce97437c466e4786a20ea6618`) with the
zone-scoped token. `count=25, total_count=25`, so **all 25 were read**.

**What that does and does not close.** It establishes that the enumeration on 2026-08-24 is
complete: the API reported 25 records and returned 25. It says nothing about which record the
2026-08-16 dashboard reading missed, because the zone held 26 records that day and holds 25
now, and `n8n.cuatro.dev` was deleted in between. **The identity of the record that went unread
on 2026-08-16 is now unrecoverable**, and no later reading can recover it. The gap is therefore
closed as unanswerable rather than answered, and nobody should carry it as open work.

Six A, three AAAA, three CNAME, five MX, four NS, four TXT.

| Record | Type | Content | Proxied | TTL |
|---|---|---|---|---|
| `cuatro.dev` | A | `177.7.52.248` | **proxied** | auto |
| `www.cuatro.dev` | A | `177.7.52.248` | **proxied** | auto |
| `analytics.cuatro.dev` | A | `177.7.52.248` | **proxied** | auto |
| `cs-tracker.cuatro.dev` | A | `177.7.52.248` | **proxied** | auto |
| `tracker.cuatro.dev` | A | `177.7.52.248` | **proxied** | auto |
| `library.cuatro.dev` | A | `177.7.52.248` | **proxied** | auto |
| `cs-tracker.cuatro.dev` | AAAA | `2a02:4780:75:9155::1` | **proxied** | auto |
| `tracker.cuatro.dev` | AAAA | `2a02:4780:75:9155::1` | **proxied** | auto |
| `library.cuatro.dev` | AAAA | `2a02:4780:75:9155::1` | **proxied** | auto |
| `covidmap.cuatro.dev` | CNAME | `b1f36414641d604e.vercel-dns-017.com` | DNS-only | 600 |
| `future-vizion.cuatro.dev` | CNAME | `75207fd2296392d3.vercel-dns-017.com` | DNS-only | 600 |
| `_domainconnect.cuatro.dev` | CNAME | `_domainconnect.domains.squarespace.com` | **proxied** | auto |
| `cuatro.dev` | MX | `aspmx.l.google.com` | n/a | auto |
| `cuatro.dev` | MX | `alt1.aspmx.l.google.com` | n/a | auto |
| `cuatro.dev` | MX | `alt2.aspmx.l.google.com` | n/a | auto |
| `cuatro.dev` | MX | `alt3.aspmx.l.google.com` | n/a | auto |
| `cuatro.dev` | MX | `alt4.aspmx.l.google.com` | n/a | auto |
| `cuatro.dev` | NS | `ns-cloud-c1.googledomains.com` | n/a | auto |
| `cuatro.dev` | NS | `ns-cloud-c2.googledomains.com` | n/a | auto |
| `cuatro.dev` | NS | `ns-cloud-c3.googledomains.com` | n/a | auto |
| `cuatro.dev` | NS | `ns-cloud-c4.googledomains.com` | n/a | auto |
| `cuatro.dev` | TXT | `v=spf1 include:_spf.google.com ~all` | n/a | auto |
| `cuatro.dev` | TXT | `protonmail-verification=9e0a4441...` | n/a | auto |
| `google._domainkey.cuatro.dev` | TXT | `v=DKIM1; k=rsa; p=MIIBIjANBg...` | n/a | auto |
| `_vercel.cuatro.dev` | TXT | `vc-domain-verify=future-vizion.cuatro.dev,8f5cf281917fc876bd43,dc` | n/a | 600 |

**Every `cuatro.dev` A and AAAA record is proxied and points at `177.7.52.248`.** That is the
complete inversion of the 2026-08-16 state, where only `www` and `_domainconnect` were proxied
and neither was an application of ours. Story 1.3 made the change on 2026-08-17.

**Nothing in the zone resolves to `95.216.143.251` any more.**

**Two Vercel CNAMEs and one Squarespace CNAME are in the zone and are not ours.** They are
recorded here rather than dropped, per AD-6. `_domainconnect` is proxied Squarespace
scaffolding with no application behind it. The `_vercel` TXT is the domain-verification token
for `future-vizion` and confirms that record's owner.

**The four `googledomains.com` NS records are vestigial**, because the real delegation is
`beau`/`demi.ns.cloudflare.com`. The ProtonMail TXT conflicts with the Google Workspace MX set,
so two mail providers are half-configured in one zone. Both were already in the deferred-work
ledger and are unchanged. Neither is this story's to fix.

**`n8n.cuatro.dev` is still absent.** It was in the zone on 2026-08-16 pointing at the old
address and gone by 2026-08-17. Confirmed absent again on 2026-08-24.

## Zone settings and rules at the edge

**The A records are only half of what a client observes.** The zone's behavioural settings and
its rulesets shape the response as much as the addresses do, and until this pass none of them
was written into any `ops/` record. **Observed 2026-08-24** by `GET /zones/{id}/settings`,
`GET /zones/{id}/rulesets`, and `GET /zones/{id}` with the zone-scoped token.

| Setting | Value | Why it is here |
|---|---|---|
| `ssl` | `strict` | **Full (strict).** The edge validates the origin certificate, which is what makes the Origin CA install load-bearing rather than decorative |
| `always_use_https` | `off` | A plaintext request is not redirected at the edge. It reaches the origin, and Caddy's own port 80 redirect is what upgrades it. That is why port 80 is still bound |
| `automatic_https_rewrites` | `on` | The edge rewrites plain-HTTP subresource URLs in HTML it serves |
| `min_tls_version` | `1.0` | Already in the deferred-work ledger from Story 1-3 and unchanged |
| `tls_1_3` | `on`, `http3` `on`, `0rtt` `off`, `ech` `on`, `pq_keyex` `on` | Edge transport features. HTTP/3 is served at the edge even though the origin's `443/udp` is unpublished |
| `security_header.strict_transport_security` | empty | **No HSTS at the edge either.** The estate's HSTS gap is not closed by the proxy, which is worth knowing because it is the cheapest place to close it |
| `email_obfuscation` | `off` | The Scrape Shield injection the ledger records from Story 1-3 is off as of this reading |
| `security_level` | `medium`, `challenge_ttl` 1800, `browser_check` `on` | The baseline challenge posture the WAF rules sit on top of |
| `waf` | `off` | The **legacy** WAF toggle. The live protection is the managed ruleset plus the four custom rules below, not this setting |
| `cache_level` `aggressive`, `browser_cache_ttl` 14400, `edge_cache_ttl` 7200 | as shown | Recorded because a cached response is what a probe sees, and Epic 4 will need to know it |
| `ipv6` | `on` | The edge accepts IPv6 from clients for every proxied hostname, including the three with no origin `AAAA` |
| `cname_flattening` | `flatten_at_root` | Zone-level, and no apex CNAME exists today |
| Zone activated | 2025-08-31T04:48:37Z, nameservers `beau`/`demi.ns.cloudflare.com`, original `ns-cloud-c1..c4.googledomains.com` | **This is why the four `googledomains` NS records are vestigial.** They are the pre-migration delegation, left in the record set |

**Four rulesets exist in the zone and none of them redirects.** **Observed 2026-08-24.**

| Ruleset | Phase | Kind |
|---|---|---|
| Cloudflare Normalization Ruleset | `http_request_sanitize` | managed |
| Cloudflare Managed Free Ruleset | `http_request_firewall_managed` | managed |
| DDoS L7 ruleset | `ddos_l7` | managed |
| `default` (id `57602610aea04496a2f8ed13ec584b6c`) | `http_request_firewall_custom` | zone |

The zone ruleset holds exactly the four rules `ops/bot-mitigation.md` records, and their
actions are `block`, `skip`, `managed_challenge`, `managed_challenge`. **No rule in it performs
a redirect**, and no ruleset exists in the `http_request_dynamic_redirect` or
`http_request_transform` phases.

**What the token could not read is written as unknown, not as absent.** `GET` on the
`http_request_dynamic_redirect`, `http_request_transform`,
`http_response_headers_transform` and `http_config_settings` phase entrypoints each returned
`request is not authorized`, and `GET /zones/{id}/pagerules` returned HTTP 403 code 9109.
**Legacy Page Rules are therefore unknown from here**, and a Page Rule can forward a URL. Only
an operator with a broader token or the dashboard can rule that out.

### The `www` 301 comes from Caddy, and that is settled by observation

The record previously attributed the `301` to the Caddy site block without ruling out an edge
rule producing the same observation. It is now ruled out directly. **Observed
2026-08-24T10:48:35Z**, a request made on the box against the origin over loopback with
`--resolve`, which bypasses Cloudflare entirely:

```
$ curl -k -I --resolve www.cuatro.dev:443:127.0.0.1 'https://www.cuatro.dev/some/path?q=1'
HTTP/2 301
location: https://cuatro.dev/some/path?q=1
server: Caddy
x-content-type-options: nosniff
x-frame-options: DENY
referrer-policy: strict-origin-when-cross-origin
alt-svc: h3=":443"; ma=2592000
```

**The origin produces the 301 by itself, with the path and query preserved, and identifies
itself as `Caddy`.** The same request through the edge returns the identical `location` with
`server: cloudflare`, which is the edge relabelling the origin's response. Combined with the
ruleset listing above, the attribution is settled: **the `www.cuatro.dev` site block in
`/home/deploy/cs-tracker/Caddyfile` is what redirects.** The one residual is the Page Rules
read, which is unknown; a Page Rule duplicating this redirect would be redundant rather than
contradictory, and would not change any hostname's behaviour.

That same request recorded the origin certificate directly, which is the first reading of it
since Story 1-3 installed it: subject `O = "CloudFlare, Inc.", OU = CloudFlare Origin CA,
CN = CloudFlare Origin Certificate`, issuer `C = US, O = "CloudFlare, Inc.", OU = CloudFlare
Origin SSL Certificate Authority, L = San Francisco, ST = California`, notBefore
2026-08-17T17:15:00Z, notAfter 2041-08-13T17:15:00Z. **Observed 2026-08-24.** It matches what
`ops/monitoring.md` records.

## Every hostname in the zone

One row per hostname, per resolving address. The origin address column is where the origin is,
not what a client resolves: a client resolving a proxied name gets Cloudflare anycast.
**Observed 2026-08-24.**

| Hostname | Origin address | DNS record | Terminates TLS | Origin certificate | Serves it | Container or process | Port |
|---|---|---|---|---|---|---|---|
| `cuatro.dev` | `177.7.52.248` | A, proxied | **Cloudflare edge** | Cloudflare Origin CA | `cuatro-portfolio` (the Hub) | `cuatro-portfolio-anchor-app-1`, alias `anchor-app` | 3000 |
| `www.cuatro.dev` | `177.7.52.248` | A, proxied | **Cloudflare edge** | Cloudflare Origin CA | 301 redirect to the apex. No application behind it | none. Caddy answers from the site block itself | n/a |
| `analytics.cuatro.dev` | `177.7.52.248` | A, proxied | **Cloudflare edge** | Cloudflare Origin CA | Umami | `cuatro-portfolio-anchor-umami-1`, alias `anchor-umami` | 3000 |
| `cs-tracker.cuatro.dev` | `177.7.52.248` | A + AAAA, both proxied | **Cloudflare edge** | Cloudflare Origin CA | `cs-tracker` (Phoenix / Elixir) | `cs-tracker-app-1`, alias `app` | 4000 |
| `tracker.cuatro.dev` | `177.7.52.248` | A + AAAA, both proxied | **Cloudflare edge** | Cloudflare Origin CA | `cuatro-tracker` | `cuatro-tracker-app-1`, alias `cuatro-app` | 3000 |
| `library.cuatro.dev` | `177.7.52.248` | A + AAAA, both proxied | **Cloudflare edge** | Cloudflare Origin CA | `digital-library`, split by path | `digital-library-api-1` (alias `library-api`) for `/api/*` and `/files/*`; `digital-library-web-1` (alias `library-web`) for everything else | 4000, 3000 |
| `covidmap.cuatro.dev` | **not this box.** `216.198.79.65` observed | CNAME, DNS-only | **Vercel** | n/a, TLS is not terminated on any box of ours | A Vercel deployment | **unknown.** Not on this box and no console access | **unknown** |
| `future-vizion.cuatro.dev` | **not this box** | CNAME, DNS-only | **Vercel** | n/a | A Vercel deployment | **unknown** | **unknown** |
| `_domainconnect.cuatro.dev` | **not this box** | CNAME, proxied | **unknown.** Squarespace scaffolding, not probed as an application | n/a | Nothing of ours | **unknown** | **unknown** |
| `google._domainkey.cuatro.dev` | n/a | TXT only | n/a | n/a | Nothing. Not a serving hostname | n/a | n/a |
| `_vercel.cuatro.dev` | n/a | TXT only | n/a | n/a | Nothing. Not a serving hostname | n/a | n/a |

**Every unknown above is written as unknown rather than guessed.** The three not-ours hostnames
are observable from outside only, and the columns that need box access or a vendor console are
not observable for them.

**Both records per hostname, never one.** The three Satellites carry an `AAAA` beside their
`A` and both are proxied. Proxying only the `A` would leave an unfiltered IPv6 route to the
origin, satisfying AD-17b on paper while any client with IPv6 walked around the bot rules.

**The apex, `www` and `analytics` still have no `AAAA` record** while the three Satellites on
the same box do. Already in the deferred-work ledger and still open. Whether the v6 path
serves at all is unverified for the same reason everywhere in this file: see
[The IPv6 caveat, stated once](#the-ipv6-caveat-stated-once).

## Observed from outside, 2026-08-24

Probed with a browser user agent from a client performing full certificate validation. **Every
cell in the "Resolved to" column is the address `curl` actually connected to on the probe run
recorded**, not a category. The two Cloudflare addresses below alternate between runs: the same
hostname returned `172.67.181.184` at 10:13Z and `104.21.43.165` at 10:49:16Z, which is
ordinary anycast round-robin and not a per-hostname property. **Reading either address as
belonging to a hostname would be wrong.**

| Hostname | Status | Connected to, 10:49:16Z | Also seen | Certificate |
|---|---|---|---|---|
| `cuatro.dev` | 200 | `104.21.43.165` | `172.67.181.184` | edge certificate below |
| `www.cuatro.dev` | 301 | `104.21.43.165` | `172.67.181.184` | edge certificate below |
| `analytics.cuatro.dev` | 403 with `Cf-Mitigated: challenge` | `104.21.43.165` | `172.67.181.184` | edge certificate below |
| `cs-tracker.cuatro.dev` | 302 | `172.67.181.184` | `104.21.43.165` | edge certificate below |
| `tracker.cuatro.dev` | 307 | `172.67.181.184` | `104.21.43.165` | edge certificate below |
| `library.cuatro.dev` | 302 | `104.21.43.165` | `172.67.181.184` | edge certificate below |
| `covidmap.cuatro.dev` | 200 | `64.29.17.1` (Vercel) | `216.198.79.65` | `CN=covidmap.cuatro.dev`, Let's Encrypt `YR1`, single-name SAN, notBefore 2026-08-06T03:26:32Z, notAfter 2026-11-04T03:26:31Z |
| `future-vizion.cuatro.dev` | 200 | `216.198.79.1` (Vercel) | n/a | `CN=future-vizion.cuatro.dev`, Let's Encrypt `YR1`, single-name SAN, notBefore 2026-08-12T18:56:48Z, notAfter 2026-11-10T18:56:47Z |

**The `analytics` 403 is the managed challenge working, not a defect.** A command-line client
cannot solve a challenge and receives 403 with `cf-mitigated: challenge`, which was read off
the response headers rather than inferred. **This is not a browser check.** Playwright arrives
in Story 1-10, so nothing here asserts that a real browser passes the interstitial. That stays
open as `ops/bot-mitigation.md` Pending Operator action 3.

**`www` preserves path and query.** `GET https://www.cuatro.dev/some/path?q=1` returned
`301` with `location: https://cuatro.dev/some/path?q=1`. **Observed 2026-08-24.** The
deferred-work entry noting that monitor 803756083 cannot see the `Location` header still
stands, because a monitor still cannot see it; what this pass adds is one dated human-run
observation that the target was correct on this day.

### The Cloudflare edge certificate rolled over

All six `cuatro.dev` hostnames present the same certificate. **Observed 2026-08-24**, pasted in
the form `openssl x509 -noout -subject -issuer -dates -ext subjectAltName` printed it. **That
form is canonical for this estate**: where any other file spells the issuer differently, this
is the string that was observed.

```
subject=CN = cuatro.dev
issuer=C = US, O = Google Trust Services, CN = WE1
notBefore=Aug 21 00:18:46 2026 GMT
notAfter=Nov 19 01:16:34 2026 GMT
X509v3 Subject Alternative Name:
    DNS:cuatro.dev, DNS:*.cuatro.dev
```

| Field | Value |
|---|---|
| Subject | `CN = cuatro.dev` |
| SANs | `cuatro.dev`, `*.cuatro.dev` |
| Issuer | `C = US, O = Google Trust Services, CN = WE1` |
| notBefore | 2026-08-21T00:18:46Z |
| notAfter | 2026-11-19T01:16:34Z |

**This answers an open deferred question by observation.** The certificate observed on
2026-08-17 had `notAfter 2026-09-20T23:23:52Z`, and the ledger recorded that the estate had no
visibility into whether Cloudflare would renew it. It renewed. The estate now knows renewal
happens; it still has no monitor that would notice if a future renewal did not, because the
certificate-age alert is a paid UptimeRobot setting. That residual gap is appended to the
ledger rather than claimed closed.

**The Origin CA certificate behind the edge is a separate thing.** It expires 2041-08-13, is
renewed by nothing, and its recorded detail lives in `ops/monitoring.md`. It was re-read
directly from the origin by this pass and matches: see the loopback probe under
[Zone settings and rules at the edge](#zone-settings-and-rules-at-the-edge).

### The 2026-07-14 wildcard certificate, closed by observation

**This is the one security-relevant open thread the retired gathering checklist carried, and it
is answered here rather than dropped.** The checklist recorded, from Certificate Transparency
on 2026-08-16, that a wildcard `*.cuatro.dev` certificate was logged 2026-07-14, that no live
host presented it, and it drew the inference that **a wildcard can only be issued through
DNS-01, which means something held Cloudflare API credentials for this zone**. That inference
was the reason the two orphaned tokens looked worse than idle.

**The inference is wrong, and the reason is observable.** Cloudflare's own Universal SSL issues
apex-plus-wildcard certificates for any zone on its nameservers, validating by DNS TXT records
it writes itself, and needs no customer API token to do it. **Observed 2026-08-24** by
`GET /zones/{id}/ssl/certificate_packs?status=all` and `GET /zones/{id}/ssl/universal/settings`
with the zone-scoped token:

| Pack | Type | Hosts | Issuer | Status | Validation | Created | Last modified | Expires |
|---|---|---|---|---|---|---|---|---|
| `10b6a5e9-6206-4cfc-8d22-ec21923120f3` | universal | `cuatro.dev`, `*.cuatro.dev` | `GoogleTrustServices` | `active` | `txt` | 2025-08-31T04:48:38Z | 2026-08-21T01:18:53Z | 2026-11-19T01:16:34Z |
| `04d55a25-361a-404f-a833-eb11e4ffa6ae` | universal, **backup** | `cuatro.dev`, `*.cuatro.dev` | `LetsEncrypt` | `backup_issued` | `txt` | 2025-08-31T04:48:39Z | **2026-07-14T06:23:39Z** | 2026-10-12T05:25:06Z |

Universal SSL is `enabled: true` with `certificate_authority: google`, and
`ssl/verification` reports `hostname: *.cuatro.dev`, `validation_method: txt`,
`certificate_status: active`.

**Disposition.** The 2026-07-14 wildcard is Cloudflare's **backup** Universal SSL pack, issued
by Let's Encrypt, last modified 2026-07-14T06:23:39Z, on a pack created 2025-08-31T04:48:39Z
when the zone was activated. Nothing outside Cloudflare held a credential to produce it, and
nothing needs to be revoked because of it. **Observed, not inferred.**

**And the specific question this record was asked to answer plainly.** Does the edge
certificate observed 2026-08-21, which also carries a `*.cuatro.dev` SAN, explain the
2026-07-14 issuance? **No.** A certificate whose notBefore is 2026-08-21 cannot account for one
logged five weeks earlier. What explains the 2026-07-14 issuance is the *second* row above, the
Let's Encrypt backup pack, which is a different certificate from the one being served. The two
share a mechanism and not an identity, and this record says so rather than letting the SAN
match stand in for a cause.

**One method note, so a later reader does not think the log was re-read.** `crt.sh` was queried
three times on 2026-08-24 to re-read the 2026-07-14 entry directly and returned HTTP 502 each
time. **The Certificate Transparency log itself was not re-read by this pass.** The disposition
above rests on the Cloudflare certificate-pack API, which is the stronger evidence anyway: it
names the issuer, the validation method and the pack's creation date, none of which a CT entry
carries.

## AD-3: hostname against application id

AD-3 (`ARCHITECTURE-SPINE.md:98`) makes the public hostname a **declared** value per Registry
entry, never derived from the id: three live hostnames already diverge from their ids. This
table is the mapping. Epic 2 authors Registry `live` values from it; Epic 4 authors router
definitions from it.

| Hostname | Application id | Nature | Note |
|---|---|---|---|
| `cuatro.dev` | `cuatro-portfolio` | **Observed.** The site block proxies `anchor-app`, which is the Anchor's own container | The apex is canonical |
| `www.cuatro.dev` | `cuatro-portfolio` | **Decision**, recorded by Story 1-21 | Redirect only. The Registry `live` value is the apex, never `www` |
| `analytics.cuatro.dev` | **none** | **Observed absence** | Umami is infrastructure, not an Estate application. It has no row in `ops/estate.md`'s fifteen and therefore no id. See the note below |
| `cs-tracker.cuatro.dev` | `cs-tracker` | **Observed.** `PHX_HOST=cs-tracker.cuatro.dev` in `/home/deploy/cs-tracker/.env` drives both the Caddy site label and the Phoenix host | The id diverges from the hostname's leading label only by coincidence here |
| `tracker.cuatro.dev` | `cuatro-tracker` | **Observed.** Hostname and id differ, which is exactly the divergence AD-3 exists for | none |
| `library.cuatro.dev` | `digital-library` | **Observed.** Hostname and id differ | Two containers serve one hostname, split by path |
| `covidmap.cuatro.dev` | **unknown** | **Observed absence** | Live, in the zone, in no planning artifact. Story 2-4 owns it |
| `future-vizion.cuatro.dev` | **unknown** | **Observed absence** | Same |
| `_domainconnect.cuatro.dev` | **none** | **Observed** | Vendor scaffolding, not an application |
| `google._domainkey.cuatro.dev` | **none** | **Observed** | TXT only. Not a serving hostname, so AD-3 does not reach it |
| `_vercel.cuatro.dev` | **none** | **Observed** | TXT only. Not a serving hostname |

**`analytics.cuatro.dev` has no application id and this is a real gap, not an oversight in this
table.** AD-3 says the Registry is the only hostname mapping, and AD-6 says no application is
ever dropped by omission. A live hostname the estate depends on for SM-1 through SM-3 currently
maps to nothing the Registry will contain. Either Umami gets an Estate row, or the record says
in writing that infrastructure hostnames sit outside the Registry. That is a Registry decision
and belongs to Story 2-4, so it is appended to the ledger rather than decided here.

**Eleven hostnames, five with an id, six without, and only three of those six are gaps.**
`_domainconnect` and the two TXT names are not serving hostnames and AD-3 does not reach them.
`covidmap` and `future-vizion` breach AD-6 and were already in the ledger from 2026-08-16.
`analytics` is the one this pass found.

### The reverse pass: every application id against a hostname

**A one-directional table is not enough for Epic 2.** The table above answers "what does this
hostname serve". Epic 2 authors a Registry `live` value per application id, so it needs the
other direction: given an id, is there a hostname, and does that hostname resolve? Without this
pass an id could be given a `live` value pointing at a hostname that is in no DNS record.

All fifteen ids from `ops/estate.md:83-99`, each against a zone hostname or an explicit none.
**Observed 2026-08-24** against the 25-record enumeration above.

| Application id | Hostname in the `cuatro.dev` zone | Nature | Note |
|---|---|---|---|
| `cuatro-portfolio` | `cuatro.dev`, with `www.cuatro.dev` redirecting to it | **Observed** | The apex is the `live` value. Never `www` |
| `cs-tracker` | `cs-tracker.cuatro.dev` | **Observed** | A + AAAA, both proxied |
| `cuatro-tracker` | `tracker.cuatro.dev` | **Observed** | A + AAAA, both proxied. Id and hostname differ, which is what AD-3 exists for |
| `digital-library` | `library.cuatro.dev` | **Observed** | A + AAAA, both proxied |
| `list-wheel` | **none in this zone** | **Observed absence** | `ops/estate.md:95` records it `Live` on GitHub Pages and relocating to the VPS. Its `live` value is not a `cuatro.dev` hostname today, and no record in this zone points at GitHub Pages. Epic 2 must take the value from that story, not from this zone |
| `cs-tournament` | **none in this zone** | **Observed absence** | `ops/estate.md:92` carries `[ASSUMPTION: Live on Vercel]`. Two Vercel CNAMEs exist in this zone (`covidmap`, `future-vizion`) and **neither is evidence that either is `cs-tournament`**. Story 2-4 resolves it |
| `cuatro-finance` | **none** | **Observed absence** | `[ASSUMPTION: built, not deployed]`. No hostname, correctly |
| `Lumen` | **none** | **Observed absence** | `Archived`, empty shell. Correct absence |
| `apple-music-workspace` | **none** | **Observed absence** | `Archived`, empty shell. Correct absence |
| `tcg-tracker` | **none** | **Observed absence** | `Archived`, `absorbed_into: cuatro-tracker`. Correct absence |
| `connect-four-react` | **none** | **Observed absence** | `Archived`, `absorbed_into: cuatro-portfolio`. Correct absence |
| `StreamVault` | **none** | **Observed absence** | `In progress`, early scaffolding. Correct absence |
| `MaiCoin` | **none** | **Observed absence** | `In progress`, early scaffolding. Correct absence |
| `poketracker-go` | **none today** | **Observed absence** | `In progress`. `pokemon.cuatro.dev` and `api.pokemon.cuatro.dev` appear in Certificate Transparency from 2025-11-07 and in **no** record in this zone on 2026-08-24. Retired names, already in the ledger |
| `Mutuo` | **none** | **Observed absence** | `In progress`, early scaffolding. Correct absence |

**Exactly four ids have a hostname in this zone that resolves**, and the apex is a fifth
hostname on one of them. **Epic 2 must not author a `live` value for any other id from this
file.** Where an id needs one (`list-wheel`, `cs-tournament`), the value comes from Story 2-4 or
from the relocation story, and this record says explicitly that it does not hold it.

**The two directions disagree in exactly three places, and each is already tracked.**
`analytics.cuatro.dev` serves and has no id. `covidmap.cuatro.dev` and
`future-vizion.cuatro.dev` serve and are in no Estate row. Nothing else fails to reconcile.

## Ingress: one shared Caddy, and nothing else

**`cs-tracker-caddy-1` (image `caddy:2`) is the only container on the box publishing ports.**
**Observed 2026-08-24.**

| Field | Value |
|---|---|
| Published | `0.0.0.0:80->80/tcp`, `[::]:80->80/tcp`, `0.0.0.0:443->443/tcp`, `[::]:443->443/tcp` |
| Exposed but not published | `443/udp` (HTTP/3, unreachable from outside), `2019/tcp` (admin API) |
| Command | `caddy run --config /etc/caddy/Caddyfile --adapter caddyfile` |
| Config | bind mount `/home/deploy/cs-tracker/Caddyfile` to `/etc/caddy/Caddyfile`, **read-only** |
| Data volume | `cs-tracker_caddy_data` at `/data`, read-write. Holds `/data/origin-ca/origin.pem` and `origin.key` |
| Config volume | `cs-tracker_caddy_config` at `/config`, read-write |
| Restart policy | `unless-stopped` |
| Healthcheck | **none** |
| Admin API | `127.0.0.1:2019`, IPv4 only. `caddy reload` works; a probe to `localhost` fails because it resolves to `::1` first |
| Network | `cs-tracker_default`, aliases `cs-tracker-caddy-1` and `caddy`, address `172.18.0.4` |

### The site blocks, as installed

Read from `/home/deploy/cs-tracker/Caddyfile` on 2026-08-24. Six site blocks, one per live
hostname. Comments and the file's ACME-contact preamble are omitted; the directives are
verbatim.

```
{$PHX_HOST} {
	tls /data/origin-ca/origin.pem /data/origin-ca/origin.key
	reverse_proxy app:4000
}

tracker.cuatro.dev {
	tls /data/origin-ca/origin.pem /data/origin-ca/origin.key
	header {
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
	}
	reverse_proxy cuatro-app:3000
}

library.cuatro.dev {
	tls /data/origin-ca/origin.pem /data/origin-ca/origin.key
	header {
		X-Content-Type-Options "nosniff"
		X-Frame-Options "SAMEORIGIN"
		Referrer-Policy "strict-origin-when-cross-origin"
	}
	handle /api/* {
		reverse_proxy library-api:4000
	}
	handle /files/* {
		reverse_proxy library-api:4000
	}
	handle {
		reverse_proxy library-web:3000
	}
}

cuatro.dev {
	tls /data/origin-ca/origin.pem /data/origin-ca/origin.key
	header {
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
	}
	reverse_proxy anchor-app:3000
}

www.cuatro.dev {
	tls /data/origin-ca/origin.pem /data/origin-ca/origin.key
	header {
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
	}
	redir https://cuatro.dev{uri} permanent
}

analytics.cuatro.dev {
	tls /data/origin-ca/origin.pem /data/origin-ca/origin.key
	header {
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
	}
	reverse_proxy anchor-umami:3000
}
```

**`cs-tracker`'s site label is a variable, not a literal.** `{$PHX_HOST}` resolves from
`/home/deploy/cs-tracker/.env`, where `PHX_HOST=cs-tracker.cuatro.dev`. **Observed 2026-08-24.**
Epic 4 must carry that indirection across or resolve it deliberately: the file alone does not
tell a reader which hostname the first block serves.

**`cs-tracker` is the only hostname whose block sends no security headers.** The other five
each carry `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy`. This is an
observed inconsistency, not a defect this story fixes, and it is appended to the ledger.

**No host in the estate sends `Strict-Transport-Security`.** Already in the ledger, unchanged.

**The installed file carries one emoji, in a comment.** It is not reproduced here. A repository
prose rule does not reach another project's box file, and this story changes nothing on the box.

### The running config matches the file, and the `M` in `git status` does not mean drift

**The file above is only useful to Epic 4 if Caddy actually loaded it.** `git status` in
`/home/deploy/cs-tracker` reports ` M Caddyfile`, which reads like drift and is not. The
comparison was made directly. **Observed 2026-08-24.**

| Check | Result |
|---|---|
| `docker exec cs-tracker-caddy-1 caddy adapt --config /etc/caddy/Caddyfile --adapter caddyfile` | 2821 bytes of JSON |
| `docker exec cs-tracker-caddy-1 wget -qO- http://127.0.0.1:2019/config/` | 2821 bytes of JSON |
| Byte comparison | **Differs at byte 67.** The admin API emits `handle` before `match`; the adapter emits `match` before `handle` |
| Canonical comparison, `json.load` on both and `==` | **EQUAL.** The two documents are the same config with different key order |
| Host set in the loaded config | `analytics.cuatro.dev`, `cs-tracker.cuatro.dev`, `cuatro.dev`, `library.cuatro.dev`, `tracker.cuatro.dev`, `www.cuatro.dev` |
| Caddy version | `v2.11.4 h1:XKxkMTgNSizEvKG6QHue6cAsFOteU2qA61w2tKkCWi0=` |

**So the running config is the file on disk, and the six site blocks above are what serves.**
The `{$PHX_HOST}` indirection is resolved in the loaded config to the literal
`cs-tracker.cuatro.dev`, which is worth knowing: the admin API shows the resolved hostname while
the file does not.

**What the ` M` actually means.** `git diff Caddyfile` in that checkout is **70 insertions and
0 deletions**: the `tls` line on the `{$PHX_HOST}` block plus the five appended site blocks for
`tracker`, `library`, the apex, `www` and `analytics`. The committed version at HEAD is the
upstream `cs-tracker` file, which knows nothing about the other three projects. **The working
tree is correct and `HEAD` is stale, not the other way round.** That is exactly why a
`git reset --hard` in that directory would take the estate off the air, and it is why the
diff being purely additive matters: there is nothing on disk that Caddy has not loaded.

**A note on the version of `caddy` here.** `caddy list-config` is not a subcommand in v2.11.4
and returns `Error: unknown command`. The admin API read above is the working equivalent, and
it must be issued from inside the container: `127.0.0.1:2019` is bound in the container's
network namespace, so the same request from the host returns nothing at all.

### ACME is off, and the ingress holds no Cloudflare credential

Every site block carries an explicit `tls /data/origin-ca/origin.pem /data/origin-ca/origin.key`
directive, which is what disables automatic certificate management for that site. Applied
2026-08-17 by Story 1.3. **Still true 2026-08-24**, confirmed by reading the file.

Before that, issuance was HTTP-01 into `cs-tracker_caddy_data`, and no `dnsChallenge` provider
appeared anywhere in the config.

**A correction this pass makes to its own earlier wording.** The record previously said the box
holds no Cloudflare credential and that nothing on the box uses the two orphaned tokens. **The
first half is wrong.** `/home/deploy/cuatro-tracker/.env` declares a variable named
`CLOUDFLARE_API_TOKEN`. **Observed 2026-08-24** by reading variable names only, never values.
Its declared consumer is `cuatro-tracker`'s own `caddy` service, which builds
`docker/Dockerfile.caddy` and is held out of `docker compose up` by the Compose profile
`edge` precisely so it does not collide with the shared ingress on this box. So:

| Claim | Status on 2026-08-24 |
|---|---|
| The **ingress** Caddy holds no Cloudflare credential | **True, observed.** `cs-tracker`'s compose passes only `PHX_HOST` and `ACME_EMAIL` to the `caddy` service, and every site block names an explicit `tls` file pair |
| The **box** holds no Cloudflare credential | **False.** `/home/deploy/cuatro-tracker/.env` declares `CLOUDFLARE_API_TOKEN` |
| The two tokens found 2026-08-16 are orphaned | **Still the working conclusion, and now for a better-stated reason.** The token in that `.env` has a declared consumer that **never starts on this box**, so nothing running uses it. Which of the two tokens it is, or whether it is a third, is **unknown**: the value was not read and the audit log needs an account-scoped token |
| A wildcard in Certificate Transparency implies a third party held zone credentials | **Refuted.** See [The 2026-07-14 wildcard certificate, closed by observation](#the-2026-07-14-wildcard-certificate-closed-by-observation) |

**A second credential for a provider the estate has left.**
`/home/deploy/digital-library/.env` declares `HETZNER_DNS_API_TOKEN`. **Observed 2026-08-24**,
name only. Nothing on this box is on Hetzner any more. Appended to the ledger.

**Port 80 is still bound and still needed.** Caddy serves the HTTP to HTTPS redirect from it.
Disabling ACME does not free that port.

### The origin is firewalled to Cloudflare, and `ufw` alone did not do it

Applied 2026-08-17 by Story 1.3. **Re-read 2026-08-24 and unchanged.**

| Layer | State on 2026-08-24 | Effect |
|---|---|---|
| `ufw` | Ports 80 and 443 from Cloudflare's ranges only, allow-from-anywhere removed | **Correct but insufficient.** Docker publishes container ports by DNAT and that traffic traverses `DOCKER-USER`, never `ufw`'s INPUT chain |
| `DOCKER-USER`, IPv4 | **Observed:** 15 `RETURN` rules on `multiport dports 80,443`, then rule 16 `DROP` on `0.0.0.0/0` | **This is what actually closes it** |
| `DOCKER-USER`, IPv6 | **Observed:** 7 `RETURN` rules, then rule 8 `DROP` on `::/0` | **Rules present, path unverified.** See [The IPv6 caveat, stated once](#the-ipv6-caveat-stated-once) |
| Persistence | `cf-origin-firewall.service` is `enabled` and `active`. **Observed 2026-08-24** | The chain does not survive a reboot, and an unpersisted firewall rule is worse than none because it fails silently |

**Undoing it is not `systemctl stop`.** The unit is `Type=oneshot` with `RemainAfterExit=yes`
and declares no `ExecStop`, so stopping it leaves every rule in place. Recovery, over SSH on
port 22, which this firewall does not touch:

```
sudo systemctl disable --now cf-origin-firewall.service
sudo iptables -F DOCKER-USER && sudo ip6tables -F DOCKER-USER
```

**This is the estate's recovery path from a Cloudflare edge outage**, because no DNS change can
substitute: an unproxied hostname presents the Origin CA certificate, which no browser trusts.

**Cloudflare's ranges change and nothing re-fetches them.**
`/usr/local/sbin/cf-origin-firewall.sh` hardcodes the list fetched 2026-08-17
(`etag 38f79d050aa027e3be3865e495dcc9bc`). Already in the ledger. `ufw`'s own copy of the same
list was re-read 2026-08-24 and holds 15 IPv4 and 7 IPv6 ranges on ports 80 and 443, matching
the `DOCKER-USER` rule counts.

### The IPv6 caveat, stated once

**This caveat is stated here and cross-referenced everywhere else in this file, rather than
repeated.** It applies to the `AAAA` gap on the apex, `www` and `analytics`, to the v6
`DOCKER-USER` chain, and to the corresponding operator action in the close-out.

**No session so far, including both segments of this pass, has had IPv6 egress.** The
consequence is precise, and the two halves must not be run together:

| Claim | Status |
|---|---|
| The box has an IPv6 address, `2a02:4780:75:9155::1` | **Observed** |
| The shared Caddy binds `[::]:80` and `[::]:443` | **Observed**, in `sudo ss -tulnp` below |
| The v6 `DOCKER-USER` chain holds 7 `RETURN` rules then a `DROP` on `::/0` | **Observed** |
| Cloudflare's edge accepts IPv6 from clients for every proxied hostname | **Observed**, zone setting `ipv6: on` |
| A client with IPv6 actually reaches an application over v6, and a direct v6 request to the origin is actually dropped | **Unverified.** Not observed, not inferred, not claimed |

**Rules present and path verified are different claims**, and this file makes only the first.
One `curl` from a vantage point with IPv6 closes it. It is an operator action in the close-out
and it also unblocks adding the three missing `AAAA` records.

## Nothing outside Docker reaches a hostname

**A negative finding, stated explicitly because a negative finding is a finding.** The earlier
version of this section rested on `sudo ss -tlnp`, which is TCP only, and ran no host-level NAT
check. Both gaps are closed below, and the conclusion survives both.

### Every listening socket, TCP and UDP

**Observed 2026-08-24 with `sudo ss -tulnp`**, pasted verbatim:

```
Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:PortProcess
udp   UNCONN 0      0         127.0.0.54:53         0.0.0.0:*    users:(("systemd-resolve",pid=670170,fd=16))
udp   UNCONN 0      0      127.0.0.53%lo:53         0.0.0.0:*    users:(("systemd-resolve",pid=670170,fd=14))
udp   UNCONN 0      0          127.0.0.1:1721       0.0.0.0:*    users:(("monarx-agent",pid=3412724,fd=8))
tcp   LISTEN 0      4096   127.0.0.53%lo:53         0.0.0.0:*    users:(("systemd-resolve",pid=670170,fd=15))
tcp   LISTEN 0      4096         0.0.0.0:443        0.0.0.0:*    users:(("docker-proxy",pid=52128,fd=8))
tcp   LISTEN 0      4096         0.0.0.0:22         0.0.0.0:*    users:(("sshd",pid=2104050,fd=3),("systemd",pid=1,fd=116))
tcp   LISTEN 0      4096         0.0.0.0:80         0.0.0.0:*    users:(("docker-proxy",pid=52108,fd=8))
tcp   LISTEN 0      4096       127.0.0.1:65529      0.0.0.0:*    users:(("monarx-agent",pid=3412724,fd=11))
tcp   LISTEN 0      4096      127.0.0.54:53         0.0.0.0:*    users:(("systemd-resolve",pid=670170,fd=17))
tcp   LISTEN 0      4096            [::]:443           [::]:*    users:(("docker-proxy",pid=52133,fd=8))
tcp   LISTEN 0      4096            [::]:22            [::]:*    users:(("sshd",pid=2104050,fd=4),("systemd",pid=1,fd=117))
tcp   LISTEN 0      4096            [::]:80            [::]:*    users:(("docker-proxy",pid=52113,fd=8))
```

- **Ports 80 and 443 are held by `docker-proxy` alone**, on both address families, which is
  Docker publishing `cs-tracker-caddy-1`'s ports. No host process competes for them.
- **Adding UDP changes the picture by exactly one socket, and it is on loopback.**
  `monarx-agent` also holds `udp 127.0.0.1:1721`, which the TCP-only reading missed.
- **Nothing listens on UDP beyond loopback.** In particular **there is no UDP 443 listener**,
  which confirms from a second direction that Caddy's `443/udp` is exposed and unpublished, so
  HTTP/3 to the origin is unreachable while HTTP/3 at the edge is on.
- **No web server runs on the host.** `which nginx apache2 caddy traefik cloudflared` returns
  nothing, `/etc/nginx/sites-enabled` does not exist, and no `cloudflared` process is running.
  Cloudflare Tunnel was checked for explicitly and is not present.
- **`monarx-agent` listens on loopback only**, on both its sockets. It is Hostinger's bundled
  security scanner (`monarx-agent.service`, "Monarx Agent - Security Scanner"), reachable from
  nowhere outside the box. It is a third-party agent nobody in the planning record chose, so it
  is in the ledger as an observation rather than left unmentioned.

### The NAT table, so a redirect cannot hide behind the listener list

**A listener list cannot rule out a DNAT rule sending port 443 somewhere else.**
**Observed 2026-08-24 with `sudo iptables -t nat -L -n`**, pasted verbatim:

```
Chain PREROUTING (policy ACCEPT)
target     prot opt source               destination
DOCKER     0    --  0.0.0.0/0            0.0.0.0/0            ADDRTYPE match dst-type LOCAL

Chain INPUT (policy ACCEPT)
target     prot opt source               destination

Chain OUTPUT (policy ACCEPT)
target     prot opt source               destination
DOCKER     0    --  0.0.0.0/0           !127.0.0.0/8          ADDRTYPE match dst-type LOCAL

Chain POSTROUTING (policy ACCEPT)
target     prot opt source               destination
MASQUERADE  0    --  172.21.0.0/16        0.0.0.0/0
MASQUERADE  0    --  172.20.0.0/16        0.0.0.0/0
MASQUERADE  0    --  172.19.0.0/16        0.0.0.0/0
MASQUERADE  0    --  172.18.0.0/16        0.0.0.0/0
MASQUERADE  0    --  172.17.0.0/16        0.0.0.0/0

Chain DOCKER (2 references)
target     prot opt source               destination
DNAT       6    --  0.0.0.0/0            0.0.0.0/0            tcp dpt:80 to:172.18.0.4:80
DNAT       6    --  0.0.0.0/0            0.0.0.0/0            tcp dpt:443 to:172.18.0.4:443
```

**Exactly two DNAT rules exist and both point at `172.18.0.4`, which is
`cs-tracker-caddy-1`.** The five `MASQUERADE` rules are the four project networks plus
`docker0`, and are egress source-NAT, not ingress. No hand-written redirect, no port
forwarding, no `REDIRECT` target, nothing in `PREROUTING` beyond the Docker jump.

### The claim, restated across all three checks

| Question | Answer | Evidence |
|---|---|---|
| Does any non-Docker process listen on a TCP port that reaches a hostname? | **No** | `sudo ss -tulnp` above. Only `sshd` on 22, and `sshd` serves no hostname |
| Does any process listen on a UDP port that reaches a hostname? | **No** | Same output. The only UDP sockets are loopback DNS and the loopback `monarx-agent` port |
| Does host-level NAT send hostname traffic anywhere other than the ingress container? | **No** | `sudo iptables -t nat -L -n` above. Two DNAT rules, both to `172.18.0.4` |

**So the answer to the checklist's question is no, across TCP, UDP and NAT: nothing on the box
runs outside Docker and reaches a hostname.** Every hostname reaches its application through
`cs-tracker-caddy-1`.

### Port 22 is open to the world, and this record says so

**A document that inventories exposure this carefully must not leave out the one port that is
open to everyone.** `sshd` binds `0.0.0.0:22` and `[::]:22`, `ufw` restricts only 80 and 443 to
Cloudflare's ranges, and `deploy` has passwordless sudo. That combination is the estate's
highest-value single target, and it appeared nowhere in the earlier version of this file.

**Observed 2026-08-24** with `sudo ufw status verbose` and `sudo sshd -T`.

| Field | Value | Nature |
|---|---|---|
| `ufw`, port 22 | `22/tcp ALLOW IN Anywhere` and `22/tcp (v6) ALLOW IN Anywhere (v6)` | **Observed.** Unrestricted by source, deliberately: this is the recovery path from a Cloudflare edge outage, and the firewall recovery commands above are run over it |
| `ufw`, ports 80 and 443 | `80,443/tcp ALLOW IN` from 15 IPv4 and 7 IPv6 Cloudflare ranges only | **Observed.** No allow-from-anywhere rule remains |
| `ufw` defaults | `deny (incoming)`, `allow (outgoing)`, `deny (routed)`, logging `on (low)` | **Observed** |
| `sshd` `passwordauthentication` | `no` | **Observed.** A password guess cannot succeed |
| `sshd` `permitrootlogin` | `no` | **Observed** |
| `sshd` `pubkeyauthentication` | `yes` | **Observed.** Key-only, which is what makes the open port acceptable |
| `sshd` `kbdinteractiveauthentication` | `no` | **Observed** |
| `sshd` `permitemptypasswords` | `no` | **Observed** |
| `sshd` `maxauthtries` / `logingracetime` | `6` / `120` | **Observed** |
| `sshd` `usepam` / `x11forwarding` | `yes` / `yes` | **Observed.** `x11forwarding yes` on a headless server is the Ubuntu default and is not needed here. Recorded, not changed |
| `AllowUsers` / `AllowGroups` | **not set** | **Observed absence.** Any account with a key may log in; today that is `deploy` |
| No `fail2ban`, no rate limit on 22 | **Observed absence.** Not in the running-service list below | Key-only auth makes brute force futile, so this is noise rather than risk. Recorded so the absence is a known one |

**The verdict, stated plainly.** Port 22 is exposed to the whole internet on both address
families, and it is protected by public-key authentication alone. That is a defensible posture
and it is also the estate's single point of total compromise: the key that opens it is the
GitHub Actions secret `SSH_PRIVATE_KEY`, and the account it opens has passwordless sudo. **No
change is proposed here and none was made.** It is written down because an exposure inventory
that omits its largest item is worse than none.

### Nineteen running services, and the arithmetic that now reconciles

The earlier version of this section said nineteen services were running and that "none of the
other fifteen is a network service of ours", then listed fourteen base units, and `sshd`
appeared in the listener table but in neither count. **That did not add up, and the reason was
that `ssh.service` was left out of both the count and the list.** The full output is pasted
here so the arithmetic can be checked rather than trusted.

**Observed 2026-08-24 with `systemctl list-units --type=service --state=running`:**

```
  UNIT                        LOAD   ACTIVE SUB     DESCRIPTION
  containerd.service          loaded active running containerd container runtime
  cron.service                loaded active running Regular background program processing daemon
  dbus.service                loaded active running D-Bus System Message Bus
  docker.service              loaded active running Docker Application Container Engine
  getty@tty1.service          loaded active running Getty on tty1
  monarx-agent.service        loaded active running Monarx Agent - Security Scanner
  polkit.service              loaded active running Authorization Manager
  qemu-guest-agent.service    loaded active running QEMU Guest Agent
  rsyslog.service             loaded active running System Logging Service
  serial-getty@ttyS0.service  loaded active running Serial Getty on ttyS0
  ssh.service                 loaded active running OpenBSD Secure Shell server
  systemd-journald.service    loaded active running Journal Service
  systemd-logind.service      loaded active running User Login Management
  systemd-networkd.service    loaded active running Network Configuration
  systemd-resolved.service    loaded active running Network Name Resolution
  systemd-timesyncd.service   loaded active running Network Time Synchronization
  systemd-udevd.service       loaded active running Rule-based Manager for Device Events and Files
  unattended-upgrades.service loaded active running Unattended Upgrades Shutdown
  user@1000.service           loaded active running User Manager for UID 1000

19 loaded units listed.
```

**Nineteen units, partitioned once, with every unit in exactly one row.**

| Group | Count | Units | Does it open a socket reachable from off the box? |
|---|---|---|---|
| The container runtime | 2 | `containerd`, `docker` | **Yes, indirectly.** `docker` is what publishes 80 and 443 through `docker-proxy` on behalf of `cs-tracker-caddy-1`. It is the only path any hostname takes |
| Remote access | 1 | `ssh` | **Yes.** Port 22, both families. See the section above. It serves no hostname |
| Third party on the host | 1 | `monarx-agent` | **No.** Loopback only, TCP 65529 and UDP 1721 |
| Hypervisor channel | 1 | `qemu-guest-agent` | **No.** Talks to the host over a virtio channel, opens no network listener |
| Ubuntu base | 14 | `cron`, `dbus`, `polkit`, `rsyslog`, `getty@tty1`, `serial-getty@ttyS0`, `systemd-journald`, `systemd-logind`, `systemd-networkd`, `systemd-resolved`, `systemd-timesyncd`, `systemd-udevd`, `unattended-upgrades`, `user@1000` | **No.** `systemd-resolved` is the only one with a socket at all and it binds `127.0.0.53` and `127.0.0.54` only |

2 + 1 + 1 + 1 + 14 = **19**, which matches the unit count and matches the listener table: three
distinct listening programs, `docker-proxy`, `sshd` and `monarx-agent`, plus `systemd-resolved`
on loopback. **No service of ours runs outside Docker.**

## What each compose project actually runs

Four compose projects, sixteen containers, fourteen running. **Observed 2026-08-24 with
`docker compose ls --all`, `docker ps -a` and `docker inspect`.** This is the half Story 1-21
did not gather.

| Project | Config files | Own network |
|---|---|---|
| `cs-tracker` | `/home/deploy/cs-tracker/docker-compose.yml` | `cs-tracker_default` (`172.18.0.0/16`). **Owns the shared ingress network** |
| `cuatro-tracker` | `/home/deploy/cuatro-tracker/docker-compose.yml` plus `docker-compose.override.yml` | `cuatro-tracker_default` (`172.19.0.0/16`) |
| `digital-library` | `/home/deploy/digital-library/docker-compose.yml` plus `docker-compose.override.yml` | `digital-library_default` (`172.20.0.0/16`) |
| `cuatro-portfolio` | `/home/deploy/cuatro-portfolio/docker-compose.yml` | `cuatro-portfolio_default` (`172.21.0.0/16`) |

### `cs-tracker`, services `db`, `migrate`, `app`, `caddy`

| Container | Image | Runs | Restart | Health | Ports | Aliases | Volumes |
|---|---|---|---|---|---|---|---|
| `cs-tracker-caddy-1` | `caddy:2` | `caddy run --config /etc/caddy/Caddyfile --adapter caddyfile` | `unless-stopped` | **no** | **publishes 80 and 443, v4 and v6** | `cs-tracker_default`: `caddy` | `cs-tracker_caddy_data` at `/data`; `cs-tracker_caddy_config` at `/config`; bind `Caddyfile` at `/etc/caddy/Caddyfile` read-only |
| `cs-tracker-app-1` | `cs-tracker:latest` | `/app/bin/server` | `unless-stopped` | **no** | none published, none exposed | `cs-tracker_default`: `app` at `172.18.0.3` | none |
| `cs-tracker-db-1` | `postgres:16` | `postgres` | `unless-stopped` | yes | `5432/tcp` exposed, not published | `cs-tracker_default`: `db` | `cs-tracker_pgdata` at `/var/lib/postgresql/data` |
| `cs-tracker-migrate-1` | `cs-tracker:latest` | `/app/bin/migrate` | `no` | no | none | `cs-tracker_default`: `migrate` | none |

`cs-tracker-migrate-1` is **`Exited (0)` 11 days ago** and is expected to be: it is a one-shot
release migration with `restart: no`. Recorded rather than omitted, because a stopped container
sometimes explains a hostname that used to resolve, and here it does not.

`cs-tracker-app-1` is the only container behind a hostname with **no healthcheck and no exposed
port** in its image metadata. It listens on 4000 inside the network, which is how
`reverse_proxy app:4000` reaches it, and the absence of an exposed port means `docker ps` gives
no hint of that. `anchor-umami` is the other container behind a hostname with no healthcheck,
which is already in the ledger as a live AD-8 breach.

### `cuatro-tracker`, services `postgres`, `migrate`, `redis`, `app`, `qbittorrent`, `worker`

| Container | Image | Runs | Restart | Health | Ports | Aliases | Volumes |
|---|---|---|---|---|---|---|---|
| `cuatro-tracker-app-1` | `cuatro-tracker-app` (**built on the box**) | `node server.js` | `unless-stopped` | yes | `3000/tcp` exposed | `cs-tracker_default`: `app` **and** `cuatro-app` at `172.18.0.5`; `cuatro-tracker_default`: `app` | none |
| `cuatro-tracker-worker-1` | `cuatro-tracker-worker` | `node_modules/.bin/tsx worker.ts` | `unless-stopped` | **no** | none | `cuatro-tracker_default`: `worker` | none |
| `cuatro-tracker-postgres-1` | `postgres:16-alpine` | `postgres` | `unless-stopped` | yes | `5432/tcp` exposed | `cuatro-tracker_default`: `postgres` | `cuatro-tracker_pg_data` |
| `cuatro-tracker-redis-1` | `redis:7-alpine` | `redis-server` | `unless-stopped` | yes | `6379/tcp` exposed | `cuatro-tracker_default`: `redis` | `cuatro-tracker_redis_data` at `/data` |
| `cuatro-tracker-qbittorrent-1` | `linuxserver/qbittorrent:latest` | `/init` | `unless-stopped` | **no** | `6881/tcp`, `8080/tcp`, `6881/udp` exposed, **none published** | `cuatro-tracker_default`: `qbittorrent` | `cuatro-tracker_qb_config` at `/config`; bind `/home/deploy/cuatro-downloads` at `/downloads` |
| `cuatro-tracker-migrate-1` | `cuatro-tracker-migrate` | `pnpm prisma migrate deploy` | `no` | no | none | `cuatro-tracker_default`: `migrate` | none |

**A BitTorrent client runs on the serving box.** `cuatro-tracker-qbittorrent-1` is on
`cuatro-tracker_default` only, is not on the shared ingress network, and publishes no port, so
**no hostname reaches it and it is not part of the routing table**. It is recorded because
Epic 4 rebuilds from this file and because a torrent client is a capacity and egress consumer
that appears in no planning artifact. Appended to the ledger.

**`cuatro-tracker`'s override is gitignored by design**, at `.gitignore:23`. **Observed** with
`git check-ignore -v`.

### `digital-library`, services `redis`, `api`, `web`

| Container | Image | Runs | Restart | Health | Ports | Aliases | Volumes |
|---|---|---|---|---|---|---|---|
| `digital-library-api-1` | `digital-library-api` (**built on the box**) | `node apps/api/dist/index.js` | `unless-stopped` | yes | `4000/tcp` exposed | `cs-tracker_default`: `api` **and** `library-api` at `172.18.0.6`; `digital-library_default`: `api` | **bind** `/home/deploy/digital-library/data` at `/data`, read-write |
| `digital-library-web-1` | `digital-library-web` | `node apps/web/build/index.js` | `unless-stopped` | yes | `3000/tcp` exposed | `cs-tracker_default`: `web` **and** `library-web` at `172.18.0.7`; `digital-library_default`: `web` | none |
| `digital-library-redis-1` | `redis:7-alpine` | `redis-server` | `unless-stopped` | yes | `6379/tcp` exposed | `digital-library_default`: `redis` | `digital-library_redis_data` at `/data` |

**The SQLite store is a host bind mount, not a Docker volume.** `/home/deploy/digital-library/data`
holds `library.db`, `library.db-shm`, `library.db-wal`, and the directories `books`, `covers`
and `inbox`. **Observed 2026-08-24:** the whole tree is 216 KB, `library.db` is 4096 bytes with
a 152472-byte WAL last written 2026-08-14, and **all three content directories are empty**. That
matters for Story 1.8: there is no book payload to back up today, so the backup problem is the
database and Redis, not bulk file transfer, and the shape of the answer can be small.

**`digital-library`'s override is untracked and NOT gitignored.** **Observed** with
`git check-ignore`, which reported no ignore rule, and `git status --porcelain`, which lists it
as `??`. A `git reset --hard` preserves it; a `git clean -fd` would delete it, and
`library-redeploy.sh` runs the former and not the latter. The `cuatro-tracker` override is
protected by an ignore rule and this one is protected only by nobody having run `git clean`.
Appended to the ledger.

### `cuatro-portfolio`, services `anchor-app`, `anchor-umami`, `anchor-db`

| Container | Image | Runs | Restart | Health | Ports | Aliases | Volumes |
|---|---|---|---|---|---|---|---|
| `cuatro-portfolio-anchor-app-1` | `cuatro-portfolio-anchor-app` (**built on the box**) | `node server.js` | `unless-stopped` | yes | `3000/tcp` exposed | `cs-tracker_default`: `anchor-app` at `172.18.0.8` | none |
| `cuatro-portfolio-anchor-umami-1` | `ghcr.io/umami-software/umami:postgresql-latest` | `sh scripts/start-docker.sh` | `unless-stopped` | **no** | `3000/tcp` exposed | `cs-tracker_default`: `anchor-umami` at `172.18.0.9`; `cuatro-portfolio_default`: `anchor-umami` | none |
| `cuatro-portfolio-anchor-db-1` | `postgres:16-alpine` | `postgres` | `unless-stopped` | yes | `5432/tcp` exposed | `cuatro-portfolio_default`: `anchor-db` | `cuatro-portfolio_postgres_data` at `/var/lib/postgresql/data` |

**`anchor-app` is on the ingress network only and `anchor-db` is on the project network only**,
so the Hub cannot reach the database and does not need to. `anchor-umami` bridges both, which
is the whole reason it is on two networks.

**`anchor-umami` has no healthcheck.** Already recorded as a live AD-8 breach in the
deferred-work ledger, confirmed again here by `docker inspect`.

**One command in this pass failed, and it is recorded rather than worked around.**

```
$ cd /home/deploy/cuatro-portfolio && docker compose config --services
error while interpolating services.anchor-app.build.args.[]: required variable
NEXT_PUBLIC_UMAMI_WEBSITE_ID is missing a value: set it in .env.production; the
tracking script needs it at build time
```

`docker compose config` does not read `.env.production` without `--env-file`. The bare command
is recorded above **as it failed**, because the point of the enumeration is what the box does by
default and because quietly replacing it with a working variant would have hidden the finding.
The practical consequence: any operator running a bare `docker compose` command in that
directory hits this, and the Anchor's own deploy path passes `--env-file .env.production`
explicitly, which is why it works.

**Having recorded the failure, the same question was then answered from source, which is a
read.** `cat /home/deploy/cuatro-portfolio/docker-compose.yml` and
`docker compose --env-file .env.production config --services` both succeed and both agree with
`docker inspect`. Recording only the failure would have left the Anchor's declared shape
reconstructed from running containers when the declaration was one `cat` away. See
[Declared against running, per project](#declared-against-running-per-project).

### Image identity, so the rebuild is reproducible

**Every service in the estate is pinned to a floating tag**, and this file opens by saying
Epic 4 recreates the estate from it. A rebuild from `caddy:2` or `postgres:16` a year from now
gets a different image. The identities below are what make the rebuild reproducible, or at
least auditable. **Observed 2026-08-24** with `docker inspect` and `docker image inspect`.

| Container | Image reference | Image id | Image created |
|---|---|---|---|
| `cs-tracker-caddy-1` | `caddy:2` | `sha256:844f60b64e4724a5aa8245e019dace0d3f199f7433ce6c57676cb30a920dbad9` | 2026-06-22T20:09:05Z |
| `cs-tracker-db-1` | `postgres:16` | `sha256:33f923b05f64ca54ac4401c01126a6b92afe839a0aa0a52bc5aeb5cc958e5f20` | 2026-07-16T22:06:30Z |
| `cs-tracker-app-1`, `cs-tracker-migrate-1` | `cs-tracker:latest` | `sha256:fc9156acd42364584385c0697b97b00bd991811c96857bd9412789fedc76261a` | 2026-08-13T06:40:30Z |
| `cuatro-tracker-app-1` | `cuatro-tracker-app:latest` | `sha256:cc8ba536741bd15e7e643d745948805fb53af6f38b87dd19645400d72c0d374b` | 2026-08-14T14:07:07Z |
| `cuatro-tracker-worker-1` | `cuatro-tracker-worker:latest` | `sha256:298c4b97fa3597f01850cc57381e7bd2666dcef39affbdbe9f72ae46d8c3d7e7` | 2026-08-14T14:05:25Z |
| `cuatro-tracker-migrate-1` | `cuatro-tracker-migrate:latest` | `sha256:9fd9d8c91ce7e41f2a6f7455453a7e949174d4e9c209474eee103786e60c7e9c` | 2026-08-14T14:07:04Z |
| `cuatro-tracker-postgres-1`, `cuatro-portfolio-anchor-db-1` | `postgres:16-alpine` | `sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777` | 2026-07-07T17:47:20Z |
| `cuatro-tracker-redis-1`, `digital-library-redis-1` | `redis:7-alpine` | `sha256:e7723ff73d963f5cc6d9c4643ea3d989527a402a319239054e9472a7fb9219a2` | 2026-07-26T04:42:13Z |
| `cuatro-tracker-qbittorrent-1` | `linuxserver/qbittorrent:latest` | `sha256:b024436f8ca665d16d9a997d26fd27fdf867ee5566ba09f32764e7b2976d3e02` | 2026-07-19T09:03:02Z |
| `digital-library-api-1` | `digital-library-api:latest` | `sha256:07c263ef304c231aa0dbc86ef6a87c05d1ef17612d2284de566ed256543fabec` | 2026-07-30T06:05:45Z |
| `digital-library-web-1` | `digital-library-web:latest` | `sha256:fa59d39726d6086202d2494f522d8b936e4e60d8bf13fad748ae625dad42830e` | 2026-07-30T06:04:34Z |
| `cuatro-portfolio-anchor-app-1` | `cuatro-portfolio-anchor-app:latest` | `sha256:af3ae531d762358419b2739b307e1083e83d4c9ae2ea522e03a9dbfe21cd1244` | 2026-08-17T08:10:30Z |
| `cuatro-portfolio-anchor-umami-1` | `ghcr.io/umami-software/umami:postgresql-latest` | `sha256:87312d334d009ee67ee0d2fba8fed01435547cc468e452243aef5133a9984d48` | 2026-08-12T02:25:33Z |

**`RepoDigests` is useless on this daemon, and that is itself worth recording.** Docker 29.6.2
here reports every image's single `RepoDigests` entry as `<name>@<the image id>`, for locally
built images as well as pulled ones. For example `caddy:2` reports
`caddy@sha256:844f60b6...`, which is the same digest as its `Id`, not a registry manifest
digest. **So `RepoDigests` cannot be used on this box to tell a pulled image from a built one**,
and the usual `RepoDigests` is empty test does not apply here. **Observed 2026-08-24.** A
rebuild that wants a real registry digest has to read it from the registry, not from this box.

**What this means for a rebuild, stated as a decision rather than an observation.** Six of the
thirteen distinct images cannot be pulled from anywhere: they exist only in this daemon's image
store. Epic 4 must either rebuild them from their repositories at a named commit or push them to
GHCR first, and the image ids above are how a rebuild proves it got the same thing.

#### `cs-tracker:latest` is built on the box, and the estate-wide claim is now exact

The record previously left `cs-tracker:latest` "ambiguous". It is not ambiguous. The intended
test, whether `RepoDigests` is empty, does not work on this daemon for the reason above, so a
different and stronger read settles it. **Observed 2026-08-24** by reading
`/home/deploy/cs-tracker/docker-compose.yml`:

```
  migrate:
    build:
      context: .
    image: cs-tracker:latest
  app:
    build:
      context: .
    image: cs-tracker:latest
```

A `Dockerfile` sits at `/home/deploy/cs-tracker/Dockerfile`, and `docker image history
cs-tracker:latest` shows a locally built Elixir release (`COPY --chown=nobody:root
/app/_build/prod/rel/cs_tracker ./ # buildkit`, `ENV MIX_ENV=prod`, `CMD ["/app/bin/server"]`).
The compose file's own header comment warns the operator to run `docker compose up -d --build`
after a code change. **`cs-tracker:latest` is built on this box.** No registry anywhere holds an
image by that name; the tag has no namespace and no registry prefix.

**So the estate-wide claim is no longer a lower bound.** **All four compose projects build their
application images on the serving two-core box**, and the built set is seven images, not six:
`cs-tracker`, `cuatro-portfolio-anchor-app`, `cuatro-tracker-app`, `cuatro-tracker-worker`,
`cuatro-tracker-migrate`, `digital-library-api` and `digital-library-web`. Only `caddy:2`,
`postgres:16`, `postgres:16-alpine`, `redis:7-alpine`,
`ghcr.io/umami-software/umami:postgresql-latest` and `linuxserver/qbittorrent:latest` are
pulled. This is the corrected form of what the ledger records against KV-1's scope.

### Declared against running, per project

**The running set and the declared set are not the same thing, and Epic 4 rebuilds from the
declaration.** Every compose file was read from source. **Observed 2026-08-24** with `cat` and
with `docker compose config --services` and `--volumes`.

| Project | Declared services | Running | Declared volumes | Existing volumes | Declared networks |
|---|---|---|---|---|---|
| `cs-tracker` | `db`, `migrate`, `app`, `caddy` | all four, `migrate` `Exited (0)` by design | `pgdata`, `caddy_data`, `caddy_config` | all three | project default only. **It owns the shared ingress network** |
| `cuatro-tracker` | `caddy` (profile `edge`), `migrate`, `app`, `worker`, `postgres`, `redis`, `qbittorrent` | six. **`caddy` is not running** | `caddy_data`, `caddy_config`, `pg_data`, `redis_data`, `qb_config` | **three: `pg_data`, `redis_data`, `qb_config`** | project default, plus `cs-tracker_default` as `external` in the override |
| `digital-library` | `caddy` (profile `edge`), `api`, `web`, `redis` | three. **`caddy` is not running** | `caddy_data`, `caddy_config`, `redis_data` | **one: `redis_data`** | project default, plus `cs-tracker_default` as `external`, aliased `edge`, in the override |
| `cuatro-portfolio` | `anchor-app`, `anchor-umami`, `anchor-db` | all three | `postgres_data` | `postgres_data` | project default, plus `cs-tracker_default` as `external`. **Declared in `docker-compose.yml`, not in an override** |

**Where declared and running disagree, and why.** In exactly two places, and both are
deliberate:

- **`cuatro-tracker` and `digital-library` each declare a `caddy` service that never runs
  here.** Both are held out of `docker compose up` by the Compose profile `edge`, so that on a
  shared box they do not collide with `cs-tracker`'s Caddy on 80 and 443.
  `cuatro-tracker`'s comment says so in as many words: "On a shared box this service must NOT
  start, or it collides on those ports". **This is the single most important thing in this
  section for Epic 4**: each Satellite still carries a complete, working, self-contained TLS
  edge of its own, dormant behind one profile flag. A rebuild that omits the profile brings up
  three Caddys and two of them fail to bind.
- **Four declared volumes do not exist**, `cuatro-tracker_caddy_data`,
  `cuatro-tracker_caddy_config`, `digital-library_caddy_data` and
  `digital-library_caddy_config`, because Compose only creates a volume a running service
  mounts. Their absence is the same fact as the profiled `caddy` service, seen from the volume
  side, and it is **not** an orphan or a loss.

**Everything else reconciles exactly.** No service runs that is not declared, no container has
been started by hand outside a compose project, and no declared service that should be running
is missing. **Observed 2026-08-24.**

**Two declarations worth carrying across verbatim**, because a rebuild that misses them breaks:

| Declaration | Where | Why it matters |
|---|---|---|
| `qbittorrent` mounts `"${DOWNLOAD_PATH:?DOWNLOAD_PATH is required; see .env.example}:/downloads"` | `cuatro-tracker/docker-compose.yml` | The one bind mount whose host path comes from a variable. `DOWNLOAD_PATH` resolves to `/home/deploy/cuatro-downloads` |
| `api` mounts `./data:/data` | `digital-library/docker-compose.yml` | The SQLite store is declared in source, not just observed. It is relative to the checkout, so a rebuild in a different directory moves the database |

### The shared network, and a name collision that is still live

Only `cs-tracker` publishes ports. The other three projects join `cs-tracker_default` under
stable aliases, and the shared Caddyfile reverse-proxies those aliases by name.

| Alias on `cs-tracker_default` | Resolves to | Reached by |
|---|---|---|
| `caddy` | `cs-tracker-caddy-1` | nothing, it is the ingress |
| `app` | **`cs-tracker-app-1` (`172.18.0.3`) and `cuatro-tracker-app-1` (`172.18.0.5`)** | `cs-tracker.cuatro.dev` proxies `app:4000` |
| `cuatro-app` | `cuatro-tracker-app-1` | `tracker.cuatro.dev` |
| `library-api` | `digital-library-api-1` | `library.cuatro.dev` for `/api/*` and `/files/*` |
| `library-web` | `digital-library-web-1` | `library.cuatro.dev` for everything else |
| `anchor-app` | `cuatro-portfolio-anchor-app-1` | `cuatro.dev` |
| `anchor-umami` | `cuatro-portfolio-anchor-umami-1` | `analytics.cuatro.dev` |
| `api`, `web`, `db`, `migrate` | the obvious containers | nothing routes to these |

**The `app` collision is still live on 2026-08-24.** Compose gives a service its own name as a
DNS alias on every network it joins, and both `cs-tracker` and `cuatro-tracker` call their
service `app`. `cuatro-tracker-app-1` does not listen on 4000, so any request Docker's DNS
steers to it cannot connect. **Observed unchanged in `docker inspect` network aliases**, seven
days after Story 1-21 first recorded it. Already in the ledger; the closure belongs in the
`cuatro-tracker` repository.

**This is why every service in the Anchor's compose file is named `anchor-*`.**

## Volumes, sizes, and the one unbounded path

**A volume list without sizes cannot answer the question a 96 GB disk actually poses.**
**Observed 2026-08-24** with `docker volume ls` and `docker system df -v`.

| Volume | Size | Links | Mounted by | At |
|---|---|---|---|---|
| `cs-tracker_pgdata` | 85.63 MB | 1 | `cs-tracker-db-1` | `/var/lib/postgresql/data` |
| `cuatro-portfolio_postgres_data` | 50.01 MB | 1 | `cuatro-portfolio-anchor-db-1` | `/var/lib/postgresql/data` |
| `cuatro-tracker_pg_data` | 48.64 MB | 1 | `cuatro-tracker-postgres-1` | `/var/lib/postgresql/data` |
| `cuatro-tracker_qb_config` | 8.185 MB | 1 | `cuatro-tracker-qbittorrent-1` | `/config` |
| `cuatro-tracker_redis_data` | 88.45 kB | 1 | `cuatro-tracker-redis-1` | `/data` |
| `cs-tracker_caddy_data` | 38.05 kB | 1 | `cs-tracker-caddy-1` | `/data`. **Holds the Origin CA key** |
| `cs-tracker_caddy_config` | 2.82 kB | 1 | `cs-tracker-caddy-1` | `/config` |
| `digital-library_redis_data` | **0 B** | 1 | `digital-library-redis-1` | `/data`. Empty: Redis has never persisted |

**Eight volumes, eight in use, no orphans.** Every volume reports `LINKS 1`, so none is
dangling and `docker volume prune` would remove nothing. **Observed absence**, and it is the
answer to the orphan question rather than a silence about it. Total volume footprint is roughly
**193 MB**.

### The bind mounts, including the unbounded one

| Bind | Size | Owner | Note |
|---|---|---|---|
| `/home/deploy/digital-library/data` | 216 KB | `root` | `library.db` 4096 bytes, `library.db-wal` 152472 bytes, `library.db-shm` 32768 bytes, plus three empty directories |
| `/home/deploy/cuatro-downloads` | **4.0 KB, and it is empty** | `deploy` | `sudo ls -la` shows `.` and `..` and nothing else. **Observed 2026-08-24** |
| `/home/deploy/cs-tracker/Caddyfile` | 3 KB, read-only into the container | `deploy` | The routing table |

**`/home/deploy/cuatro-downloads` is the estate's one unbounded growth path, and today it holds
nothing.** It is qBittorrent's `/downloads`, it has no quota, no retention and no monitor, and
the disk it sits on is the same 96 GB root filesystem that holds every Postgres volume, every
backup and 6 GB of build cache. **Observed 2026-08-24**: `df -h /` reports 96 G total, 17 G
used, 80 G available, 17 percent. **The risk is real and the current consumption is zero**, and
this record states both rather than folding one into the other.

**What is actually consuming the disk is build cache, not data.** **Observed 2026-08-24**:
`docker system df -v` reports **6.028 GB of build cache**, one dangling image of 1.3 GB
(`fc9bbaa78625`), and a superseded `cuatro-portfolio-app:latest` of 390 MB left behind by the
Story 1-21 rename. `/etc/cron.d/docker-builder-prune` runs `docker builder prune -f` on
Wednesdays, which is why the number is 6 GB rather than larger. **This is the disk cost of
AD-8's standing violation**, showing up as storage rather than as CPU, and it is worth naming
because the capacity conversation so far has been about cores.

### How qBittorrent is administered

**Its WebUI is exposed on 8080, unpublished, and no hostname reaches it, so the obvious question
is who ever talks to it.** **Observed 2026-08-24.**

| Field | Value | Nature |
|---|---|---|
| WebUI port | `WEBUI_PORT=8080` in the compose environment; `8080/tcp` exposed, **not published** | **Observed** |
| WebUI bind | `WebUI\Address=*`, `WebUI\ServerDomains=*` in `qBittorrent.conf` | **Observed.** Bound on all interfaces **inside the container**, on `cuatro-tracker_default` only |
| Reachable from | `cuatro-tracker_default` only. Not on the ingress network, no published port, no NAT rule | **Observed.** Nothing outside the box can reach it |
| Who administers it | **`cuatro-tracker`'s own `app` and `worker` containers**, over the project network. `/home/deploy/cuatro-tracker/.env` declares `QBITTORRENT_USER` and `QBITTORRENT_PASS` | **Observed**, variable names only |
| Credentials in the container | `WebUI\Username` and `WebUI\Password_PBKDF2` are **absent from `qBittorrent.conf`**. The container log reads "The WebUI administrator username is: admin" and "The WebUI administrator password was not set. A temporary password is ..." | **Observed.** The password is not reproduced here |
| How a human would reach it | An SSH tunnel to the container address, or `docker exec`. There is no other path | **Decision**, following from the rows above |

**So the answer is that no human administers it and no hostname reaches it.** It is driven by
the sibling application over an internal network. **The finding worth carrying forward** is that
its WebUI is running on an auto-generated temporary password printed to the container log,
which is fine while the network boundary holds and is one published port away from not being.
Appended to the ledger. Not changed by this pass.

## Backup coverage, per project

**Observed 2026-08-24.** The `deploy` crontab holds exactly two jobs and root has none.

```
30 3 * * * /home/deploy/cuatro-backup.sh >> /home/deploy/backups/cuatro-tracker/backup.log 2>&1
45 3 * * * /home/deploy/library-backup.sh >> /home/deploy/backups/digital-library/backup.log 2>&1
```

**The table below covers every one of the eight volumes enumerated above and every bind mount,
with no store left out.** That completeness is the point: a coverage table that silently omits a
store reads as coverage.

| Project | Store | Backed up? | Mechanism | Retention | Offsite? |
|---|---|---|---|---|---|
| `cuatro-portfolio` | `cuatro-portfolio_postgres_data`, Umami's Postgres, 50.01 MB | **No** | none | n/a | **No** |
| `cs-tracker` | `cs-tracker_pgdata`, Postgres, 85.63 MB | **No** | none | n/a | **No** |
| `cs-tracker` | `cs-tracker_caddy_data`, 38.05 kB, holding the **Origin CA key** | **No** | none | n/a | **No** |
| `cs-tracker` | `cs-tracker_caddy_config`, 2.82 kB, Caddy's autosaved JSON config | **No** | none | n/a | **No.** Low value: it is a rederivable copy of the Caddyfile, and the Caddyfile itself is the thing to keep. Listed so no volume is missing from this table |
| `cs-tracker` | bind `/home/deploy/cs-tracker/Caddyfile`, the routing table for all six hostnames | **No** | none, beyond four dated `Caddyfile.bak-*` files kept by hand beside it | n/a | **No.** Already in the ledger as the estate's sharpest single-file risk |
| `cuatro-tracker` | `cuatro-tracker_pg_data`, Postgres, 48.64 MB | Yes | `cuatro-backup.sh`, daily 03:30 UTC, `pg_dump -U tracker -Fc tracker` | 14 days by `find -mtime +14 -delete`. **Running, and the arithmetic is reconciled below** | **No.** `/home/deploy/backups/cuatro-tracker` on the same box |
| `cuatro-tracker` | `cuatro-tracker_redis_data`, 88.45 kB | **No** | none | n/a | **No** |
| `cuatro-tracker` | `cuatro-tracker_qb_config`, 8.185 MB | **No** | none | n/a | **No** |
| `cuatro-tracker` | bind `/home/deploy/cuatro-downloads`, empty today | **No** | none | n/a | **No.** Nothing to lose today |
| `digital-library` | bind `data/library.db`, SQLite, 4096 bytes plus a 152472-byte WAL | Yes, **and the verdict below is not the one this file first recorded** | `library-backup.sh`, daily 03:45 UTC, `sqlite3 .backup` | **Not running.** Two separate bugs, below | **No.** `/home/deploy/backups/digital-library` on the same box |
| `digital-library` | `digital-library_redis_data`, **0 B** | **No** | none | n/a | **No.** Empty, so nothing is lost by this today |
| `digital-library` | bind `data/books`, `data/covers`, `data/inbox` | **No** | none | n/a | **No.** All three are empty today, so nothing is lost by this today |

**Not one backup in the estate is offsite.** Every dump and every snapshot lands under
`/home/deploy/backups` on the box being backed up, which protects against a bad migration and
against nothing else. That is the gap Story 1.8 exists to close for `digital-library`, and this
pass shows it is the same gap for three of the four projects.

**`cuatro-backup.sh`'s header comment claims the script "Complements Hostinger's weekly
whole-box snapshot".** That snapshot was **not observed by this pass** and no evidence of it
exists on the box. It is recorded as an unverified claim in a script comment, not as an
observation, and it must not be relied on as the offsite half until somebody confirms it in the
Hostinger console.

### `library-backup.sh` has been failing every night since 2026-07-31

**Observed 2026-08-24**, and this is the finding Story 1.8 most needs.

```
$ tail -1 /home/deploy/backups/digital-library/backup.log
/home/deploy/library-backup.sh: line 13: USER: unbound variable
```

The same line repeats for every run in the log. Line 13 is `sudo chown "$USER:$USER" "$OUT"`.
`cron` does not set `USER` in the job environment, the script runs `set -euo pipefail`, and
`set -u` aborts on the unset expansion.

**What still works and what does not.** Line 12, `sudo sqlite3 "$DB" ".backup '$OUT'"`, runs
before the abort. Everything after line 13 does not run: no `chown`, no `gzip`, and **no
retention prune**.

The directory listing is the proof that the prune has not run, and it is unambiguous:

- One file from 2026-07-30, `library-2026-07-30_0617.db.gz`, 3106 bytes, owner `deploy`. That
  is the last run before the cron job existed or before the failure began.
- **Twenty-five files from 2026-07-31 to 2026-08-24**, each `library-YYYY-MM-DD_0345.db`,
  90112 bytes, owner **`root`**, uncompressed.
- The 2026-07-30 `.gz` is 25 days old and the prune deletes `library-*.db.gz` older than 14
  days, so its survival independently proves the `find` has not run since.
- The uncompressed `.db` files would never be pruned anyway, because the prune pattern matches
  `.db.gz` only. **Two independent bugs**, and fixing only the `USER` one would start deleting
  the `.gz` files while the 25 stale `.db` files grew without limit.
- The log holds **25 lines and every one is the same error**, one per night, which matches the
  25 files exactly.

#### The backup verdict, rewritten after opening the snapshots

**The first version of this section said "a consistent snapshot is written every night". That
sentence was read off line 12 of a script and off the file listing, and no snapshot had been
opened, checksummed or integrity-checked.** By this file's own NFR-9 standard that is an
inference dressed as an observation. The snapshots have now been opened. **Observed
2026-08-24**, with copies taken into `/tmp` so no live file was touched, `sqlite3` version
`3.45.1 2024-01-30`.

| Check | Result | Nature |
|---|---|---|
| `PRAGMA integrity_check` on a `/tmp` copy of `library-2026-08-24_0345.db` | `ok` | **Observed** |
| `PRAGMA integrity_check` on a `/tmp` copy of `library-2026-07-31_0345.db`, the oldest | `ok` | **Observed** |
| Snapshot pragmas | `page_size` 4096, `page_count` 22, `journal_mode` wal, `user_version` 0 | **Observed** |
| Snapshot schema | 11 objects: `users`, `sessions`, `libraries`, `user_libraries`, `books`, `reading_progress`, and the five `books_fts*` FTS5 shadow tables | **Observed** |
| Snapshot contents | `users` 1 row, `sessions` 1 row, `books_fts_config` 1, `books_fts_data` 2. **`books`, `libraries`, `user_libraries` and `reading_progress` are all 0** | **Observed** |
| Size of all 25 snapshots | 90112 bytes each | **Observed** |
| **Distinct contents among the 25** | **Two, not one.** SHA-256 `eab517fa...` for the 15 files dated 2026-07-31 to 2026-08-14, and `74aebac1...` for the 10 files dated 2026-08-15 to 2026-08-24 | **Observed** |
| Live `library.db` | 4096 bytes, one page, mtime **2026-07-30T06:09:04Z**, sha256 `d405fbc2...` | **Observed** |
| Live `library.db-wal` | 152472 bytes, mtime **2026-08-14T09:16:05Z** | **Observed** |

**Three facts the earlier record captured and never remarked on, now given their meaning.**

1. **`library.db` is 4096 bytes, which is a single SQLite page: a header and nothing else.** The
   entire database lives in the write-ahead log. A backup strategy that copied the `.db` file
   would capture an empty database, and this is exactly the trap `sqlite3 .backup` exists to
   avoid.
2. **The WAL was last written 2026-08-14T09:16:05Z**, and the main file has not been written
   since 2026-07-30. **Nothing has written to this database in ten days.**
3. **The 25 snapshots are not byte-identical.** They are the same size and split into exactly
   two contents, and **the boundary falls precisely at the WAL's last write**: every snapshot
   taken at 03:45 up to and including 2026-08-14, which is before 09:16 that day, carries one
   content; every snapshot from 2026-08-15 onward carries the other.

**That third fact is the verdict, and it is now an observation rather than a reading of a script
comment.** The main database file did not change, yet the snapshot content changed on the first
night after a WAL write. **The snapshot therefore includes WAL content**: it is a checkpointed
copy of the live database, not a file copy. That is what "WAL-safe" was claiming, and it is now
evidenced rather than asserted.

**The two verdicts, restated with their nature markers.**

| Verdict | Wording | Nature |
|---|---|---|
| The snapshot | **A valid, complete, WAL-inclusive SQLite database is written every night.** It opens, passes `integrity_check`, carries the full schema, and tracks WAL changes | **Observed 2026-08-24**, by copying two snapshots to `/tmp`, checksumming all 25 and integrity-checking two |
| The snapshot, the part still not observed | **That the snapshot would be consistent under a concurrent writer is not established.** The database has had no writer since 2026-08-14, so every snapshot in the directory was taken against a quiescent file. `sqlite3 .backup` is documented to be safe under concurrent write; that documentation was not tested here and could not be, because constructing the test needs a write | **Inference from documentation, explicitly not observed.** Story 1.8's restore test is where this is settled |
| The retention | **No prune has run since at least 2026-07-30**, and two separate bugs each independently prevent one | **Observed**, by the 25-day-old `.gz` and by the pattern mismatch |

**And the size of the problem, which the numbers make small.** One user, one session, zero
books, an empty `books`/`covers`/`inbox` tree, and a 90 KB snapshot. **Story 1.8's problem is a
correctness and offsite problem, not a volume problem.** The whole of `digital-library`'s state
today would fit in an email.

**So `digital-library` does have a nightly local snapshot, and the estate had no way to know
it.** The script exits non-zero every night, the log says it failed, and the data is fine.
That is the worst shape a backup can be in short of not existing: a real backup that reports
failure is indistinguishable from a broken one, and the operator learns to ignore it.

**This story does not fix it.** The pass is read-only and the fix is Story 1.8's, which is the
story with a restore test in its acceptance. **The full evidence lives here and only here**; the
deferred-work ledger carries a summary and a pointer to this section rather than a second copy,
so there is one place to correct if any of it turns out wrong.

### `cuatro-backup.sh`'s retention, held to the same standard

**The earlier record called this retention "working" while sixteen dumps sat under a 14-day
policy, and used exactly this kind of file-age arithmetic to prove the other script's prune had
not run.** Applying the same standard to both is what this section does, and the answer is that
this one does reconcile. **Observed 2026-08-24.**

| Fact | Value |
|---|---|
| Dumps present | **16**, `cuatro-2026MMDD-0330.dump`, 2026-08-09 to 2026-08-24, one per day, no gaps |
| Size | 22310 bytes each |
| Content | **16 distinct SHA-256 values.** Same size, different bytes, which is what a `pg_dump -Fc` of a live database looks like |
| Log | **26 lines**, every one `backup written: ... (24K)`. The first is `cuatro-20260730-0330.dump` |

**Twenty-six successful runs, sixteen surviving files. Ten dumps have been deleted.** That is
the reconciliation, and it is the same subtraction the `library-backup.sh` section runs in the
other direction. Nothing but the prune deletes files in that directory.

**Why sixteen and not fourteen, which is the part that looked wrong.** `find -mtime +14`
matches a file whose age in whole 24-hour units is **greater than 14**, that is 15 or more, and
the prune runs on line 10 immediately **after** line 9 has written that night's dump. At
2026-08-24T03:30:01.658Z the oldest surviving dump, written 2026-08-09T03:30:01.978Z, was
14 days 23:59:59.68 old. That integer-divides to 14, `+14` did not match it, and it survived by
about three tenths of a second. It will be deleted on the next run. **A working `-mtime +14`
prune that runs after the write retains sixteen files, not fourteen**, and the count is
therefore evidence that it works rather than evidence that it does not.

**Contrast with `library-backup.sh`, which is what makes the two verdicts different rather than
inconsistent.** There, a file **25 days old** survives. No `-mtime +14` prune can produce that,
whatever the boundary arithmetic. One directory's oldest file is 15 days old and one's is 25,
and the policy is the same 14 days in both.

**What is still not claimed about `cuatro-backup.sh`.** **No dump has been restored.**
`pg_restore --list` was not run and no test database was created, because both are writes.
"The dumps exist, are distinct, and are the size the log reports" is observed; "the dumps
restore" is not, and this record does not say it. That test belongs with Story 1.8's.

## Scheduled work on the box

**Observed 2026-08-24** with `systemctl list-timers --all` and by reading `/etc/cron.d`.

| Unit or job | Schedule | What it is |
|---|---|---|
| `capacity-sampler.timer` | every minute | **Story 1-5's measurement sampler, still armed and still firing.** Last run 2026-08-24T10:10:34Z |
| `cf-origin-firewall.service` | at boot, `Type=oneshot` | Story 1-3's origin firewall. `enabled` and `active` |
| `deploy` cron 03:30 | daily | `cuatro-backup.sh` |
| `deploy` cron 03:45 | daily | `library-backup.sh` |
| `/etc/cron.d/docker-builder-prune` | Wednesdays 03:12, root | `docker builder prune -f` |
| `/etc/cron.d/monarx-update` | vendor schedule | Hostinger's security agent updater |
| `sysstat-collect.timer`, `sysstat-summary.timer` | 10 minutes, daily | Ubuntu system activity accounting |
| `logrotate`, `man-db`, `apt-daily`, `apt-daily-upgrade`, `dpkg-db-backup`, `update-notifier-*`, `systemd-tmpfiles-clean`, `e2scrub_all`, `fstrim` | various | Ubuntu base timers, untouched |

**`unattended-upgrades` is running.** The box applies security updates on its own schedule, so
its package state is not pinned by anything in any repository. Recorded because Epic 4 rebuilds
from this file and because an unattended reboot would drop the `DOCKER-USER` chain if
`cf-origin-firewall.service` ever failed to start.

## Configuration that exists only on the box

This set is what a rebuild has to recreate from nothing, and it is the reason Story 1.7 exists.
**Observed 2026-08-24.**

| What | Where | In any repository? |
|---|---|---|
| The six site blocks that route the whole estate | `/home/deploy/cs-tracker/Caddyfile` | **Partially.** The Anchor's three blocks are mirrored in `docker/Caddyfile` and nothing compares the two. The `cs-tracker`, `tracker` and `library` blocks are box-only |
| `PHX_HOST=cs-tracker.cuatro.dev`, which the `cs-tracker` site label resolves from | `/home/deploy/cs-tracker/.env` | No |
| `cuatro-tracker`'s ingress override | `/home/deploy/cuatro-tracker/docker-compose.override.yml` | No, gitignored by design at `.gitignore:23` |
| `digital-library`'s ingress override | `/home/deploy/digital-library/docker-compose.override.yml` | No. **Untracked and not gitignored**, so it is protected by convention only |
| The Origin CA certificate and private key | `cs-tracker_caddy_data` volume at `/data/origin-ca/`, plus copies at `/home/deploy/origin-ca/origin.pem`, `origin.key`, `origin.csr` | No, and correctly so. **Backed up nowhere.** Already in the ledger |
| The origin firewall | `/usr/local/sbin/cf-origin-firewall.sh` and `cf-origin-firewall.service` | No |
| Per-project secrets | `/home/deploy/cs-tracker/.env` (4255 bytes), `/home/deploy/cuatro-tracker/.env` (686), `/home/deploy/digital-library/.env` (1347), `/home/deploy/cuatro-portfolio/.env.production` (322). All mode `0600`, owner `deploy` | No, and correctly so |
| Redeploy and backup scripts | `~/cuatro-redeploy.sh`, `~/library-redeploy.sh`, `~/cuatro-backup.sh`, `~/library-backup.sh` | No |
| The `deploy` crontab, two backup jobs | `crontab -l` as `deploy` | No |
| Operator notes | `~/README.md`, `~/README.md.bak-library`, `~/README.md.bak-ops1` | No |
| Story 1-5's sampler and timer | `capacity-sampler.service` and `.timer` | The sampler script is in this repository at `ops/capacity-sampler.sh`; the installed unit files are not |
| Caddyfile backups | `Caddyfile.bak-ops1`, `Caddyfile.bak-library-`, `Caddyfile.bak-1-3`, `Caddyfile.bak-1-21` | No. **Four, not the three previously recorded** |

### The variable names each project needs

**A path, a size and a mode do not tell a rebuild anything.** The variable names do, and a
variable name is not a secret. **Observed 2026-08-24** with `grep -E '^[A-Za-z_][A-Za-z0-9_]*='
<file> | cut -d= -f1`. **No value was read, and none is recorded here or anywhere else.**

| File | Count | Variable names |
|---|---|---|
| `/home/deploy/cs-tracker/.env` | 15 | `ACME_EMAIL`, `BITSKINS_API_KEY`, `BREAKER_WINDOW_HOURS`, `CSFLOAT_API_KEY`, `DATABASE_URL`, `DMARKET_API_KEY`, `KILL_SWITCH`, `PHX_HOST`, `POSTGRES_DB`, `POSTGRES_PASSWORD`, `POSTGRES_USER`, `PRICE_SOURCES_ENABLED`, `SECRET_KEY_BASE`, `SKINPORT_API_KEY`, `STEAM_ID` |
| `/home/deploy/cuatro-tracker/.env` | 15 | `ADMIN_PASS`, `CLOUDFLARE_API_TOKEN`, `DB_PASS`, `DOWNLOAD_PATH`, `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`, `LOG_LEVEL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `QBITTORRENT_PASS`, `QBITTORRENT_USER`, `STEAM_API_KEY`, `STEAM_USER_ID`, `TMDB_API_KEY`, `TMDB_WATCH_PROVIDER_COUNTRY` |
| `/home/deploy/digital-library/.env` | 21 | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `BOOKS_PATH`, `COMICVINE_API_KEY`, `COVERS_PATH`, `DATABASE_PATH`, `HETZNER_DNS_API_TOKEN`, `HOST`, `INBOX_LIBRARY_ID`, `INBOX_PATH`, `MAX_UPLOAD_BYTES`, `NODE_ENV`, `ORIGIN`, `PORT`, `PUBLIC_API_URL`, `REDIS_URL`, `SMTP_HOST`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_USER`, `WEB_ORIGIN` |
| `/home/deploy/cuatro-portfolio/.env.production` | 4 | `NEXT_PUBLIC_UMAMI_URL`, `NEXT_PUBLIC_UMAMI_WEBSITE_ID`, `POSTGRES_PASSWORD`, `UMAMI_APP_SECRET` |

**Four names in that list are the interesting ones, and none of them was visible before.**

| Name | Why it matters |
|---|---|
| `CLOUDFLARE_API_TOKEN`, in `cuatro-tracker` | The box **does** hold a Cloudflare credential. See the correction under [ACME is off](#acme-is-off-and-the-ingress-holds-no-cloudflare-credential) |
| `HETZNER_DNS_API_TOKEN`, in `digital-library` | A live credential for a provider the estate left. Nothing on this box is on Hetzner. Appended to the ledger |
| `QBITTORRENT_USER`, `QBITTORRENT_PASS`, in `cuatro-tracker` | These are what administer the torrent client, and they are the reason its WebUI needs no hostname |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, in `digital-library` | The estate sends mail from the box, which appears in no planning artifact and in no monitoring |

**Eleven of the fifty-five variables are third-party API credentials** (`BITSKINS`, `CSFLOAT`,
`DMARKET`, `SKINPORT`, `STEAM_ID`, `IGDB` two, `STEAM_API_KEY`, `TMDB`, `COMICVINE`, plus the
two DNS tokens above). None of them is in any repository, none is backed up, and losing this box
loses all of them. **That is the practical shape of what Epic 4 must recreate**, and it is why
the file paths alone were not enough.

**The shared Caddyfile is tracked by git in another project's checkout, and that is the
fragility.** **Observed 2026-08-24:** in `/home/deploy/cs-tracker`, `git status --porcelain`
reports ` M Caddyfile` and the four `Caddyfile.bak-*` files as untracked. A `git reset --hard`
there, which is exactly what the sibling projects' redeploy scripts do in their own
directories, would discard every appended site block and take the whole estate off the air.
Already in the ledger.

### Per-project git state on the box

| Directory | HEAD | Working tree |
|---|---|---|
| `/home/deploy/cs-tracker` | `3b29ace` | ` M Caddyfile`, four untracked `Caddyfile.bak-*` |
| `/home/deploy/cuatro-tracker` | `5d49da7` | clean |
| `/home/deploy/digital-library` | `46d6e5f` | `?? docker-compose.override.yml` |
| `/home/deploy/cuatro-portfolio` | `54d3a0d` | ` M docker-compose.yml`, ` M docker/Dockerfile`, `?? .dockerignore` |

### Live credentials, tracked here so none is forgotten

| Credential | Scope | Status |
|---|---|---|
| Cloudflare zone-edit token, created 2026-08-17 | DNS edit on the `cuatro.dev` zone only. No account-level rights, no other zone | **Retained deliberately** by Operator decision on 2026-08-17. Held in the gitignored local `.env` as `CLOUDFLARE_TOKEN`. This is the only credential in the estate that can rewrite the apex A record. **Used read-only by this story** for the zone enumeration above |
| Cloudflare API token `tracker-mac` | Unverified | Orphaned. **Nothing running uses it.** The ingress Caddy holds no Cloudflare credential, and the one `CLOUDFLARE_API_TOKEN` on the box, in `/home/deploy/cuatro-tracker/.env`, belongs to a `caddy` service the `edge` profile keeps stopped. Whether that variable holds this token, the other one, or a third is **unknown**: the value was not read. Revocation is an operator action, see the close-out |
| Cloudflare API token `cuatro-tracker` | Unverified | Orphaned, same reasoning and same owner |
| `CLOUDFLARE_API_TOKEN` in `/home/deploy/cuatro-tracker/.env` | Unknown. The value was not read | **Newly recorded 2026-08-24**, by variable name. Its declared consumer is that project's own profiled `caddy` service, which never starts on this box. It is very likely one of the two above and that is **not** established |
| `HETZNER_DNS_API_TOKEN` in `/home/deploy/digital-library/.env` | Unknown. The value was not read | **Newly recorded 2026-08-24**, by variable name. Nothing in the estate is on Hetzner any more. A live credential for a provider the estate has left. Appended to the ledger |
| `QBITTORRENT_USER`, `QBITTORRENT_PASS` in `/home/deploy/cuatro-tracker/.env` | The qBittorrent WebUI on the project network | **Observed 2026-08-24** by name. See [How qBittorrent is administered](#how-qbittorrent-is-administered). The WebUI itself is running on an auto-generated temporary password printed to the container log |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` in `/home/deploy/digital-library/.env` | Outbound mail from the box | **Newly recorded 2026-08-24**, by name. The estate sends mail and no planning artifact says so |
| Umami admin password | `analytics.cuatro.dev` | Set by the Operator on 2026-08-17. The agent-written `.umami-admin` file was shredded from the box the same day |
| `deploy` SSH key, GitHub `SSH_PRIVATE_KEY` | Shell on `177.7.52.248`, passwordless sudo | In use by `deploy.yml`. `SERVER_HOST` repointed 2026-08-17 |
| `github_deploy`, `cuatro_tracker_deploy` | Read on one GitHub repository each | In use by the sibling stacks. Neither can clone `cuatro-portfolio`, which is why that repository is cloned over HTTPS |
| Cloudflare Origin CA private key | The origin's TLS identity for every hostname, valid to 2041-08-13 | On the box in two places and **nowhere else**. Losing it takes every hostname down with no ACME fallback. Already in the ledger |

**The Anchor deliberately does not follow the override convention.** Its network attachment and
aliases are committed in `docker-compose.yml` rather than hidden in a box-only override, so the
repository describes the running system.

## Where the deploy goes

**The deploy mechanism is a tracked violation, recorded in `ops/known-violations.md` as KV-1**
(added 2026-08-18 by Story 1-9), which carries the AD-8 citation, the ruling that tolerates the
breach, and why it is not fixed before Story 3-4 retires it. **This pointer sits above the
section deliberately and outlives it.** The section below expires when Epic 1 closes and `dev`
reaches `main`; KV-1 stays open until Epic 3.

| Field | Value | Nature |
|---|---|---|
| `SERVER_HOST` before 2026-08-17 | Not this box | **Observed, by absence.** `.github/workflows/deploy.yml` ran `cd ~/projects/cuatro-portfolio`, and no `~/projects` directory has ever existed on `177.7.52.248`. **Re-confirmed absent 2026-08-24** |
| `SERVER_HOST` after | `177.7.52.248` | **Operator action, completed 2026-08-17** |
| Checkout path | `/home/deploy/cuatro-portfolio` | **Decided 2026-08-17**, matching the sibling convention |
| Deploy mechanism | `docker compose up --build -d` over SSH | A standing AD-8 violation. **Status derived from KV-1**, which is the single place to edit it |

**All four projects build their images on the box**, not just the Anchor, and this is no longer
a lower bound. `cuatro-portfolio-anchor-app`, `cuatro-tracker-app`, `cuatro-tracker-worker`,
`cuatro-tracker-migrate`, `digital-library-api`, `digital-library-web` and **`cs-tracker`** are
seven locally-built images; `caddy:2`, `postgres:16`, `postgres:16-alpine`, `redis:7-alpine`,
`ghcr.io/umami-software/umami:postgresql-latest` and `linuxserver/qbittorrent:latest` are
pulled. **Observed 2026-08-24.** The `cs-tracker` half is settled under
[`cs-tracker:latest` is built on the box](#cs-trackerlatest-is-built-on-the-box-and-the-estate-wide-claim-is-now-exact),
by reading that project's compose `build:` stanza rather than by a digest test that this
Docker version makes meaningless. KV-1 is scoped to this repository's deploy workflow; the
estate-wide shape of the breach is wider than KV-1 records, and that is appended to the ledger
rather than added to the register, because promoting an entry needs an Operator ruling.

**The disk cost of that breach is visible and is recorded above**: 6.028 GB of build cache and
a 1.3 GB dangling image, held down only by a weekly `docker builder prune`.

**As of 2026-08-24 the box's checkout still sits at `main` (`54d3a0d`) with
`docker-compose.yml` and `docker/Dockerfile` modified in place**, because the corrected versions
are committed on `dev`, not `main`. `origin/main` still carries the pre-move compose file: a
`caddy` service publishing `80:80` and `443:443`, and services named `app`, `db` and `umami`. A
deploy from that commit would `reset --hard` the box onto it, discard the working files,
recreate the shared-network name collisions, and contend for the ports `cs-tracker-caddy-1`
holds. **The blast radius is the whole estate, not just the Anchor.**

**In the normal flow this cannot fire**, because `deploy.yml` triggers only on `main` and
nothing reaches `main` mid-epic. The live risk is a direct push to `main`, or a hotfix merged
ahead of the epic close. **This condition has now persisted for seven days**, which is longer
than the Story 1-21 wording implied and is the reason it is re-dated here rather than left.

**Recovering the box's configuration if it is ever lost** is cheap, because the correct files
are pushed and reachable from the box:

```
cd /home/deploy/cuatro-portfolio
git fetch origin dev
git checkout origin/dev -- docker-compose.yml docker/Dockerfile .dockerignore
docker compose --env-file .env.production up -d --remove-orphans
```

## The address the estate left

| Field | Value | Nature |
|---|---|---|
| Address | `95.216.143.251` | **Observed.** Served `cuatro.dev`, `analytics.cuatro.dev` and `n8n.cuatro.dev` until 2026-08-17 |
| Fate | The box no longer exists | **The Operator's statement, 2026-08-16 and 2026-08-17.** A decision, not an observation |
| What a probe saw after the move | Port 443 completing a handshake with a self-signed `CN=TRAEFIK DEFAULT CERT` | **Observed 2026-08-17T08:00Z** |
| Estate exposure | None | **Observed 2026-08-24.** No record in the zone resolves there |

**This address is permanently unenumerable, and that is a close-out rather than pending work.**
The gathering checklist required Part 2 to be run on both addresses before either was
decommissioned. It never was: the session that had the checklist had no credential for that box,
and the Operator states the box is gone. There is no read path to it and there never will be.
Nobody should carry "enumerate the old box" as an open item, and nothing downstream should wait
on it. What was on it is known only by inference: a Traefik answering 443, an `n8n` hostname
pointing at it, and Umami's Postgres, whose history was discarded as a recorded deliberate drop
in `ops/monitoring.md`.

**The `n8n` port-conflict hypothesis is neither confirmed nor refuted and cannot now be.**
Recorded as closed by disappearance, never as diagnosed.

## What Story 1.21 changed

Named explicitly, because the rest of this file is an observation-only record.

| Change | Where | When (UTC) |
|---|---|---|
| Cloned the Anchor and wrote its production secrets | `/home/deploy/cuatro-portfolio` | 2026-08-17T07:02Z |
| Brought up the Hub, Umami and Postgres, no published ports | same | 2026-08-17T07:39Z, corrected 07:52Z |
| Appended three site blocks and reloaded Caddy | `/home/deploy/cs-tracker/Caddyfile`, backup `Caddyfile.bak-1-21` | 2026-08-17T07:58Z |
| Repointed three DNS records to `177.7.52.248`, DNS-only, TTL 60 | Cloudflare zone `cuatro.dev` | 2026-08-17T07:55Z |
| Added the `www.cuatro.dev` monitor, id 803756083 | UptimeRobot | 2026-08-17T07:59Z |

**One defect was introduced and corrected inside the same story.** Between 07:39Z and 07:46Z
the Anchor's stack was attached to the shared network with services named `app`, `db` and
`umami`, taking second leases on names three other stacks already used. The stack was removed
from the network at 07:46Z, every service was renamed `anchor-*`, and the reason is pinned in
`docker-compose.yml`. Sampled checks of the three Satellites returned their normal status codes
throughout, but **this record does not claim the impact was zero**.

## Story 1.7 close-out, 2026-08-24

The list this file previously carried under "What Story 1.7 still owes" is closed. Each former
item is either answered here or named as an operator action with the reason an agent cannot
perform it.

| Former item | Disposition |
|---|---|
| The three Satellite projects' internals: services, volumes, and what each container runs | **Answered.** See "What each compose project actually runs". All four projects, sixteen containers, with image, command, restart policy, healthcheck, exposed ports, network aliases and volumes each |
| Whether anything on the box runs outside Docker and reaches a hostname | **Answered, and the answer is no, across TCP, UDP and NAT.** See "Nothing outside Docker reaches a hostname". The `sudo ss -tulnp` output, the `sudo iptables -t nat -L -n` output and the nineteen running services are pasted there verbatim, and port 22's exposure is recorded in the same section |
| Each hostname recorded against its Registry application id (AD-3) | **Answered, in both directions.** See the AD-3 table: eleven hostnames, five with an id, six without, and three of those six are gaps rather than correct absences. `analytics.cuatro.dev` is the gap this pass found rather than inherited. The reverse pass runs all fifteen Estate ids back against a hostname or an explicit none, so Epic 2 cannot author a `live` value for a hostname that does not resolve |
| A confirmation pass on the Cloudflare audit log before either API token is revoked | **Operator action.** See below |
| Backup coverage per project, which Story 1.8 needs | **Answered.** See "Backup coverage, per project", including the nightly failure in `library-backup.sh` that Story 1.8 inherits |
| Enumerate `95.216.143.251` before it is decommissioned | **Permanently unenumerable.** See "The address the estate left". Not pending work |

### Operator actions this story cannot perform

| Action | Why an agent cannot do it |
|---|---|
| Read the Cloudflare account audit log, then revoke `tracker-mac` and `cuatro-tracker` | The only token in the estate is **zone-scoped**. **Observed 2026-08-24:** `GET /accounts/{id}/audit_logs` returns HTTP 403 `Authentication error` (code 10000) and `GET /user/tokens` returns HTTP 403 `Unauthorized to access requested resource` (code 9109). Reading the log needs an account-scoped token and revoking needs `User > API Tokens > Edit`, neither of which the agent holds, and **never revoke, rotate or create a credential** is a standing boundary. Already tracked as `ops/bot-mitigation.md` Pending Operator action 5 |
| Confirm `analytics.cuatro.dev` passes the managed challenge in a real browser | Playwright arrives in Story 1-10 and no acceptance criterion may claim a rendered-output result before it. Already `ops/bot-mitigation.md` action 3 |
| Confirm the Hostinger weekly whole-box snapshot exists | It is claimed in a script comment and appears nowhere on the box. Confirming it needs the Hostinger console, which the agent cannot reach |
| Verify IPv6 serving and the v6 `DOCKER-USER` path | One `curl` from a vantage point with IPv6 closes it. See [The IPv6 caveat, stated once](#the-ipv6-caveat-stated-once) for what is and is not claimed |
| Decide whether `analytics.cuatro.dev`, `covidmap.cuatro.dev` and `future-vizion.cuatro.dev` get Estate rows | A Registry membership decision under AD-6, owned by Story 2-4, not by an enumeration |
| Read the zone's legacy Page Rules, and the `http_request_dynamic_redirect`, `http_request_transform`, `http_response_headers_transform` and `http_config_settings` ruleset phases | The zone-scoped token returns HTTP 403 code 9109 on `pagerules` and `request is not authorized` on each phase entrypoint. **Observed 2026-08-24.** The zone-level `GET /rulesets` listing shows no redirect or transform ruleset, and the `www` 301 is settled independently by a direct origin probe, so nothing depends on this. It is listed so the unknown is a known one |

### What the retired gathering checklist held that is still true

`ops/routing-inventory-checklist.md` was Story 1.7's method file, written 2026-08-16. It is
retired by this record. Its Part 1 was a pre-cutover DNS snapshot that had become wrong in
every proxied column and still named the two-address topology, which is worse than absent
because it reads as current state. Everything from it that is still true is carried here:

- Its Part 1 record set, corrected and completed. All 25 records now, against its 25 of 26. Its
  "one record was not read" note is closed as unanswerable rather than answered: see
  [The whole zone, all 25 records](#the-whole-zone-all-25-records).
- **Its Part 2 command set, carried forward and updated**, as
  [How to re-gather this record](#how-to-re-gather-this-record). The checklist held runnable
  commands and this record named them only in prose, which would have made the method
  unreproducible. That is now fixed, and the appendix is the answer to "how do I check this is
  still true".
- Its Part 4 acceptance shape, which is the structure of this document.
- Its finding that `2a02:4780::/29` is Hostinger's range, kept in the box table.
- Its Certificate Transparency reading that `pokemon.cuatro.dev` and `api.pokemon.cuatro.dev`
  were logged 2025-11-07 and appear in no current DNS record, probably `poketracker-go`. Still
  true, already in the ledger, and still not in the zone on 2026-08-24.
- **Its Certificate Transparency finding about the wildcard `*.cuatro.dev` certificate logged
  2026-07-14, which is the one security-relevant thread it carried.** Carried forward with an
  explicit disposition and **closed by observation**: see
  [The 2026-07-14 wildcard certificate, closed by observation](#the-2026-07-14-wildcard-certificate-closed-by-observation).
  The short version is that the checklist's inference, that a wildcard implies something held
  zone credentials, is refuted: it is Cloudflare's own Let's Encrypt **backup** Universal SSL
  pack, validated by TXT records Cloudflare writes itself on a zone it is authoritative for, on
  a pack created 2025-08-31 when the zone was activated. Nothing outside Cloudflare produced it.
- Its two-token table and the reasoning that both are orphaned, kept in the credentials table.
  **One clause of that reasoning is corrected here**: the box does hold a Cloudflare credential,
  in `/home/deploy/cuatro-tracker/.env`, wired to a service the `edge` profile keeps stopped.
  Its instruction not to revoke before Story 1.3 landed Origin CA is now moot: Origin CA landed
  2026-08-17 and the blocker is the missing account-scoped token, recorded above.
- Its observation that `tracker.cuatro.dev` showed three Certificate Transparency issuances
  inside one week in 2026-07, flagged as "worth a glance on the box". That question is **moot
  rather than answered**: ACME was disabled on every site block on 2026-08-17, the origin no
  longer issues anything, and all six hostnames now present one Cloudflare edge certificate.
  Recorded so nobody re-opens it as an unresolved thread.
- Its rule that a broken thing found is written down and left. This pass found one nightly
  backup failure and one command failure and did exactly that.

Its Part 3 open questions are all closed or reassigned: what served the old box and whether n8n
held state are closed by disappearance; what issued the Let's Encrypt certificates is answered
(HTTP-01 from the shared Caddy, now disabled); `SERVER_HOST` is answered; how the three
Satellite hostnames reach their applications is answered by the site blocks above; and whether
anything on the old box held state not on the new one is permanently unanswerable.

## How to re-gather this record

**The checklist this record retired held runnable commands, and a record that names commands
only in prose is not reproducible.** This appendix carries that command set forward, corrected
for what is true now: one box rather than two, Origin CA rather than ACME, and a shared ingress
rather than a per-project one. Run it when anything under
[What would invalidate this record](#what-would-invalidate-this-record) happens, or on the
review-by date.

**Every command below is a read.** Nothing here starts, stops, reloads, builds or writes
outside `/tmp`. Keep it that way: the value of this file is that it is evidence, and a gather
that changes the thing it measures is not evidence.

### 0. Get on the box, and confirm which box

```bash
wsl -- ssh deploy@177.7.52.248
# Windows OpenSSH holds no key for this box and fails with `publickey`. Use WSL.
hostname; hostname -I; date -u +%Y-%m-%dT%H:%M:%SZ
uname -a; head -2 /etc/os-release
nproc; free -m; df -h /; uptime
```

### 1. The zone, off the box

The token lives in the gitignored repository-root `.env` as `CLOUDFLARE_TOKEN`. Zone
`e90c26d4127883f3b0a56d5932c500f5`, account `cd0752bce97437c466e4786a20ea6618`.

```
GET /zones/{zone}/dns_records?per_page=100   # expect count == total_count
GET /zones/{zone}                            # nameservers, activation date
GET /zones/{zone}/settings                   # ssl, always_use_https, min_tls_version, hsts
GET /zones/{zone}/rulesets                   # expect no dynamic_redirect, no transform phase
GET /zones/{zone}/rulesets/{custom-ruleset-id}
GET /zones/{zone}/ssl/certificate_packs?status=all
GET /zones/{zone}/ssl/universal/settings
```

`accounts/{id}/audit_logs`, `user/tokens`, `pagerules` and the per-phase ruleset entrypoints
return 403 with this token. **Record them as unknown rather than dropping them.**

### 2. The hostnames, from outside

```powershell
$names = 'cuatro.dev','www.cuatro.dev','analytics.cuatro.dev','cs-tracker.cuatro.dev',
         'tracker.cuatro.dev','library.cuatro.dev','covidmap.cuatro.dev','future-vizion.cuatro.dev'
foreach ($n in $names) {
  curl.exe -sS -o NUL -A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' `
    --max-time 20 -w "$n %{http_code} %{remote_ip}`n" "https://$n/"
}
```

Expect `200, 301, 403, 302, 307, 302` for the six `cuatro.dev` hostnames, which is the baseline
`ops/bot-mitigation.md:100` records. **The two Cloudflare addresses alternate between runs and
are not a per-hostname property.** For the certificate, in one consistent form:

```bash
echo | openssl s_client -connect cuatro.dev:443 -servername cuatro.dev 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
```

### 3. What is listening, and what NAT does

The checklist ran `ss -tlnp`, which is TCP only and missed a UDP socket. Use `-tulnp`, and
check NAT, which the checklist listed and which was not run.

```bash
sudo ss -tulnp
sudo iptables -t nat -L -n
sudo iptables -L DOCKER-USER -n --line-numbers
sudo ip6tables -L DOCKER-USER -n --line-numbers
systemctl is-enabled cf-origin-firewall.service; systemctl is-active cf-origin-firewall.service
sudo ufw status verbose
sudo sshd -T | grep -iE '^(port|passwordauthentication|permitrootlogin|pubkeyauthentication|permitemptypasswords|maxauthtries|allowusers|allowgroups)'
systemctl list-units --type=service --state=running --no-pager
```

The checklist also asked, explicitly, whether anything reaches a hostname from outside Docker.
Keep asking it, and keep recording the negative:

```bash
which nginx apache2 caddy traefik cloudflared
ls -la /etc/nginx/sites-enabled 2>/dev/null
ps aux | grep -i cloudflared | grep -v grep
systemctl status cloudflared 2>/dev/null
```

`cloudflared` and Traefik have never been present on this box. **Check anyway**: the reason the
checklist listed them was a Traefik answering on the address the estate has since left.

### 4. Containers, images and networks

```bash
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
docker compose ls --all
docker network ls
docker inspect $(docker ps -aq) --format \
  '{{.Name}} {{.Config.Image}} {{.Image}} {{.HostConfig.RestartPolicy.Name}} {{range $k,$v := .NetworkSettings.Networks}}{{$k}}:{{$v.Aliases}} {{end}}'
docker image inspect <image> --format 'Id: {{.Id}} Created: {{.Created}} RepoDigests: {{json .RepoDigests}}'
```

**`RepoDigests` does not distinguish a built image from a pulled one on this daemon**, which is
what the checklist-era method would have assumed. Read the project's compose `build:` stanza
instead:

```bash
for d in cs-tracker cuatro-tracker digital-library cuatro-portfolio; do
  echo "== $d"; grep -nE '^  [a-z-]+:|^    (image|build|profiles):|^      (context|dockerfile):' \
    /home/deploy/$d/docker-compose.yml
done
```

### 5. Declared against running

```bash
for d in cs-tracker cuatro-tracker digital-library; do
  (cd /home/deploy/$d && docker compose config --services && docker compose config --volumes)
done
# The Anchor needs its env file. The bare command fails, and that failure is itself a finding.
(cd /home/deploy/cuatro-portfolio && docker compose config --services)
(cd /home/deploy/cuatro-portfolio && docker compose --env-file .env.production config --services)
cat /home/deploy/cuatro-tracker/docker-compose.override.yml
cat /home/deploy/digital-library/docker-compose.override.yml
```

**Watch for the `edge` profile.** Two projects declare a `caddy` service that must never start
here.

### 6. Ingress, and whether the running config is the file

The checklist's `docker exec <caddy> caddy list-config` is not a subcommand in Caddy v2.11.4.
This is the working form, and both halves must run inside the container:

```bash
cat /home/deploy/cs-tracker/Caddyfile
(cd /home/deploy/cs-tracker && git status --porcelain && git diff --stat -- Caddyfile)
docker exec cs-tracker-caddy-1 caddy version
docker exec cs-tracker-caddy-1 caddy adapt --config /etc/caddy/Caddyfile --adapter caddyfile > /tmp/adapt.json
docker exec cs-tracker-caddy-1 sh -c 'wget -qO- http://127.0.0.1:2019/config/' > /tmp/running.json
python3 -c "import json;a=json.load(open('/tmp/adapt.json'));b=json.load(open('/tmp/running.json'));print('EQUAL' if a==b else 'DIFFERENT')"
```

A byte comparison always differs: the admin API and the adapter order JSON keys differently.
**Compare parsed, not byte for byte.** To settle whether a redirect comes from Caddy or from the
edge, ask the origin directly, over loopback, which bypasses Cloudflare:

```bash
curl -k -I --resolve www.cuatro.dev:443:127.0.0.1 'https://www.cuatro.dev/some/path?q=1'
```

### 7. Volumes, disk and the growth paths

```bash
docker volume ls
docker system df -v
sudo du -sh /home/deploy/cuatro-downloads
sudo du -sh /home/deploy/digital-library/data
sudo ls -la --time-style=full-iso /home/deploy/digital-library/data
df -h /
```

### 8. Backups, checked rather than assumed

The checklist had no backup section at all. This is the part Story 1.8 reads.

```bash
crontab -l; sudo crontab -l
cat -n /home/deploy/cuatro-backup.sh /home/deploy/library-backup.sh
ls -la --time-style=full-iso /home/deploy/backups/cuatro-tracker
ls -la --time-style=full-iso /home/deploy/backups/digital-library
wc -l /home/deploy/backups/*/backup.log
tail -3 /home/deploy/backups/cuatro-tracker/backup.log
tail -3 /home/deploy/backups/digital-library/backup.log
sha256sum /home/deploy/backups/digital-library/*.db | cut -c1-64 | sort | uniq -c
```

**Do not stop at the listing.** A file of the right size and date is not a backup. Copy one to
`/tmp` and open it, which touches no live file:

```bash
cp /home/deploy/backups/digital-library/library-$(date -u +%F)_0345.db /tmp/snap.db
sqlite3 /tmp/snap.db "PRAGMA integrity_check;"
sqlite3 /tmp/snap.db "PRAGMA page_count; PRAGMA journal_mode;"
sqlite3 /tmp/snap.db ".tables"
```

**Compare run count against file count.** Log lines minus surviving files is how many the prune
deleted, and that number is what tells you whether retention runs. Do it for both scripts and
hold them to the same standard.

### 9. Secrets, names only

```bash
for f in /home/deploy/cs-tracker/.env /home/deploy/cuatro-tracker/.env \
         /home/deploy/digital-library/.env /home/deploy/cuatro-portfolio/.env.production; do
  echo "== $f"; grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$f" | cut -d= -f1
done
```

**Never `cat` these files and never record a value.** `cut -d= -f1` is the whole method.

### 10. Scheduled work and git state

```bash
systemctl list-timers --all --no-pager
ls -la /etc/cron.d; cat /etc/cron.d/*
for d in cs-tracker cuatro-tracker digital-library cuatro-portfolio; do
  echo "== $d"; (cd /home/deploy/$d && git rev-parse --short HEAD && git status --porcelain)
done
```

### 11. Close the pass the way it opened

Re-run step 2 and step 4's `docker ps`. **The status codes and the container uptimes together
are the evidence that the pass changed nothing**, and the uptimes are the stronger half: a
container restarted by anything in this appendix would read minutes rather than weeks.
