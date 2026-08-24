# Routing inventory

Which hostname reaches which application, on which address, through what. This is Story 1.7's
record: the read-only enumeration of the deployed routing table, which exists in no repository
(forced change C-9). Epic 4's greenfield rebuild recreates the estate from this file.

This file follows the pattern `ops/estate.md` and `ops/monitoring.md` set: every value is
marked as either a decision or an observation, and the two are never presented as the same
kind of fact (NFR-9). Dates and times are ISO 8601 UTC.

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
`docker compose config --services`, `cat`, `ls`, `du`, `tail`, `grep`, `ss`, `systemctl
list-units`, `systemctl list-timers`, `crontab -l`, `iptables -L`, `ip6tables -L`,
`git rev-parse`, `git status`, `git check-ignore`. No `up`, no `restart`, no `reload`, no
`pull`, no edit, no DNS write, no token revocation. Nothing found broken was fixed. Some reads
needed `sudo` (`ss -tlnp`, `iptables -L`, `ip6tables -L`, and listing the root-owned
`digital-library` data directory) and every one of them was a read. The Cloudflare access was
three `GET` requests: `dns_records`, which succeeded, and `audit_logs` and `user/tokens`, which
returned 403 and are recorded as operator actions in the close-out.

Verified by the same probe before and after the pass.

| Check | Before, 2026-08-24T10:13Z | After, 2026-08-24T10:17Z |
|---|---|---|
| `cuatro.dev` | 200 | 200 |
| `www.cuatro.dev` | 301 | 301 |
| `analytics.cuatro.dev` | 403 | 403 |
| `cs-tracker.cuatro.dev` | 302 | 302 |
| `tracker.cuatro.dev` | 307 | 307 |
| `library.cuatro.dev` | 302 | 302 |
| Container set | 14 running, all `Up` | 14 running, all `Up`, same names and same uptimes |

That six-code sequence is the baseline `ops/bot-mitigation.md:100` recorded on 2026-08-17,
unchanged a week later.

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
zone-scoped token. `count=25, total_count=25`, so **all 25 were read**. This closes the
gathering checklist's "one record was not read" gap, which stood from 2026-08-16.

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
the same box do. Already in the deferred-work ledger and still open. The box has an IPv6
address and the shared Caddy binds `[::]:80` and `[::]:443`, so the path very likely works, but
this session had no IPv6 egress either and did not verify it.

## Observed from outside, 2026-08-24

Probed with a browser user agent from a client performing full certificate validation.

| Hostname | Status | Resolved to | Certificate |
|---|---|---|---|
| `cuatro.dev` | 200 | `172.67.181.184` (Cloudflare anycast) | edge certificate below |
| `www.cuatro.dev` | 301 | Cloudflare anycast | edge certificate below |
| `analytics.cuatro.dev` | 403 with `cf-mitigated: challenge` | `172.67.181.184` | edge certificate below |
| `cs-tracker.cuatro.dev` | 302 | Cloudflare anycast | edge certificate below |
| `tracker.cuatro.dev` | 307 | Cloudflare anycast | edge certificate below |
| `library.cuatro.dev` | 302 | `104.21.43.165` (Cloudflare anycast) | edge certificate below |
| `covidmap.cuatro.dev` | 200 | `216.198.79.65` (Vercel) | `CN=covidmap.cuatro.dev`, Let's Encrypt `YR1`, single-name SAN, notBefore 2026-08-06T03:26:32Z, notAfter 2026-11-04T03:26:31Z |
| `future-vizion.cuatro.dev` | 200 | Vercel | `CN=future-vizion.cuatro.dev`, Let's Encrypt `YR1`, single-name SAN, notBefore 2026-08-12T18:56:48Z, notAfter 2026-11-10T18:56:47Z |

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

All six `cuatro.dev` hostnames present the same certificate. **Observed 2026-08-24.**

| Field | Value |
|---|---|
| Subject | `CN=cuatro.dev` |
| SANs | `cuatro.dev`, `*.cuatro.dev` |
| Issuer | `C=US, O=Google Trust Services, CN=WE1` |
| notBefore | 2026-08-21T00:18:46Z |
| notAfter | 2026-11-19T01:16:34Z |

**This answers an open deferred question by observation.** The certificate observed on
2026-08-17 had `notAfter 2026-09-20T23:23:52Z`, and the ledger recorded that the estate had no
visibility into whether Cloudflare would renew it. It renewed. The estate now knows renewal
happens; it still has no monitor that would notice if a future renewal did not, because the
certificate-age alert is a paid UptimeRobot setting. That residual gap is appended to the
ledger rather than claimed closed.

**The Origin CA certificate behind the edge is a separate thing and was not re-read by this
pass.** It expires 2041-08-13, is renewed by nothing, and its recorded detail lives in
`ops/monitoring.md`.

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

### ACME is off, and the box holds no Cloudflare credential

Every site block carries an explicit `tls /data/origin-ca/origin.pem /data/origin-ca/origin.key`
directive, which is what disables automatic certificate management for that site. Applied
2026-08-17 by Story 1.3. **Still true 2026-08-24**, confirmed by reading the file.

Before that, issuance was HTTP-01 into `cs-tracker_caddy_data`, and no `dnsChallenge` provider
appeared anywhere in the config. That confirmed the two Cloudflare API tokens found on
2026-08-16 (`tracker-mac` and `cuatro-tracker`) are orphaned: nothing on this box uses them.

**Port 80 is still bound and still needed.** Caddy serves the HTTP to HTTPS redirect from it.
Disabling ACME does not free that port.

### The origin is firewalled to Cloudflare, and `ufw` alone did not do it

Applied 2026-08-17 by Story 1.3. **Re-read 2026-08-24 and unchanged.**

| Layer | State on 2026-08-24 | Effect |
|---|---|---|
| `ufw` | Ports 80 and 443 from Cloudflare's ranges only, allow-from-anywhere removed | **Correct but insufficient.** Docker publishes container ports by DNAT and that traffic traverses `DOCKER-USER`, never `ufw`'s INPUT chain |
| `DOCKER-USER`, IPv4 | **Observed:** 15 `RETURN` rules on `multiport dports 80,443`, then rule 16 `DROP` on `0.0.0.0/0` | **This is what actually closes it** |
| `DOCKER-USER`, IPv6 | **Observed:** 7 `RETURN` rules, then rule 8 `DROP` on `::/0` | **Rules present, path unverified.** No session so far has had IPv6 egress, so no direct request to `2a02:4780:75:9155::1` has ever been made |
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
(`etag 38f79d050aa027e3be3865e495dcc9bc`). Already in the ledger.

## Nothing outside Docker reaches a hostname

**A negative finding, stated explicitly because a negative finding is a finding.**

Every listening socket on the box, **observed 2026-08-24 with `sudo ss -tlnp`**:

```
LISTEN  127.0.0.53%lo:53    systemd-resolve
LISTEN        0.0.0.0:443   docker-proxy
LISTEN        0.0.0.0:22    sshd
LISTEN        0.0.0.0:80    docker-proxy
LISTEN      127.0.0.1:65529 monarx-agent
LISTEN     127.0.0.54:53    systemd-resolve
LISTEN           [::]:443   docker-proxy
LISTEN           [::]:22    sshd
LISTEN           [::]:80    docker-proxy
```

- **Ports 80 and 443 are held by `docker-proxy` alone**, on both address families, which is
  Docker publishing `cs-tracker-caddy-1`'s ports. No host process competes for them.
- **No web server runs on the host.** `which nginx apache2 caddy traefik cloudflared` returns
  nothing, `/etc/nginx/sites-enabled` does not exist, and no `cloudflared` process is running.
  Cloudflare Tunnel was checked for explicitly and is not present.
- **`monarx-agent` listens on loopback only.** It is Hostinger's bundled security scanner
  (`monarx-agent.service`, "Monarx Agent - Security Scanner"), reachable from nowhere outside
  the box. It is a third-party agent nobody in the planning record chose, so it is appended to
  the ledger as an observation rather than left unmentioned.
- **Nineteen services are running in total**, and none of the other fifteen is a network
  service of ours: the Ubuntu base set (`cron`, `dbus`, `polkit`, `rsyslog`, two `getty`
  units, six `systemd-*` units, `unattended-upgrades`, `user@1000`) plus `containerd`,
  `docker`, `monarx-agent`, and `qemu-guest-agent`, which is the hypervisor channel and
  opens no network listener.

**So the answer to the checklist's question is no: nothing on the box runs outside Docker and
reaches a hostname.** Every hostname reaches its application through `cs-tracker-caddy-1`.

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

`docker compose config` does not read `.env.production` without `--env-file`, and re-running it
with that flag was deliberately **not** attempted, because the point of the enumeration is what
the box does by default and because a second attempt with different arguments would have hidden
the finding. The Anchor's three services were enumerated from `docker inspect` instead. The
other three projects returned their service lists cleanly. The practical consequence: any
operator running a bare `docker compose` command in that directory hits this, and the Anchor's
own deploy path passes `--env-file .env.production` explicitly, which is why it works.

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

## Backup coverage, per project

**Observed 2026-08-24.** The `deploy` crontab holds exactly two jobs and root has none.

```
30 3 * * * /home/deploy/cuatro-backup.sh >> /home/deploy/backups/cuatro-tracker/backup.log 2>&1
45 3 * * * /home/deploy/library-backup.sh >> /home/deploy/backups/digital-library/backup.log 2>&1
```

| Project | Store | Backed up? | Mechanism | Retention | Offsite? |
|---|---|---|---|---|---|
| `cuatro-portfolio` | `cuatro-portfolio_postgres_data` (Umami's Postgres) | **No** | none | n/a | **No** |
| `cs-tracker` | `cs-tracker_pgdata` (Postgres) | **No** | none | n/a | **No** |
| `cs-tracker` | `cs-tracker_caddy_data`, holding the **Origin CA key** | **No** | none | n/a | **No** |
| `cuatro-tracker` | `cuatro-tracker_pg_data` (Postgres) | Yes | `cuatro-backup.sh`, daily 03:30 UTC, `pg_dump -U tracker -Fc tracker` | 14 days by `find -mtime +14 -delete`, **working** | **No.** `/home/deploy/backups/cuatro-tracker` on the same box |
| `cuatro-tracker` | `cuatro-tracker_redis_data` | **No** | none | n/a | **No** |
| `cuatro-tracker` | `cuatro-tracker_qb_config`, `/home/deploy/cuatro-downloads` | **No** | none | n/a | **No** |
| `digital-library` | `data/library.db` (SQLite) | Yes, **but see below** | `library-backup.sh`, daily 03:45 UTC, `sqlite3 .backup` which is WAL-safe | **not working** | **No.** `/home/deploy/backups/digital-library` on the same box |
| `digital-library` | `digital-library_redis_data` | **No** | none | n/a | **No** |
| `digital-library` | `data/books`, `data/covers`, `data/inbox` | **No** | none | n/a | **No.** All three are empty today, so nothing is lost by this today |

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
before the abort, so **a consistent snapshot is written every night**. Everything after line 13
does not run: no `chown`, no `gzip`, and **no retention prune**.

The directory listing is the proof, and it is unambiguous:

- One file from 2026-07-30, `library-2026-07-30_0617.db.gz`, 3106 bytes, owner `deploy`. That
  is the last run before the cron job existed or before the failure began.
- **Twenty-five files from 2026-07-31 to 2026-08-24**, each `library-YYYY-MM-DD_0345.db`,
  90112 bytes, owner **`root`**, uncompressed.
- The 2026-07-30 `.gz` is 25 days old and the prune deletes `library-*.db.gz` older than 14
  days, so its survival independently proves the `find` has not run since.
- The uncompressed `.db` files would never be pruned anyway, because the prune pattern matches
  `.db.gz` only. **Two independent bugs**, and fixing only the `USER` one would start deleting
  the `.gz` files while the 25 stale `.db` files grew without limit.

**So `digital-library` does have a nightly local snapshot, and the estate had no way to know
it.** The script exits non-zero every night, the log says it failed, and the data is fine.
That is the worst shape a backup can be in short of not existing: a real backup that reports
failure is indistinguishable from a broken one, and the operator learns to ignore it.

**This story does not fix it.** The pass is read-only and the fix is Story 1.8's, which is the
story with a restore test in its acceptance. Appended to the ledger with this evidence so the
fix is not re-derived.

`cuatro-backup.sh` by contrast is healthy: sixteen dumps from 2026-08-09 to 2026-08-24, each
22310 bytes, retention working, and the log reads `backup written: ... (24K)` for every run.

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
| Cloudflare API token `tracker-mac` | Unverified | Orphaned. Nothing on the box uses it: ingress holds no Cloudflare credential. Revocation is an operator action, see the close-out |
| Cloudflare API token `cuatro-tracker` | Unverified | Orphaned, same reasoning and same owner |
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

**Three of the four projects build their images on the box**, not just the Anchor.
`cuatro-portfolio-anchor-app`, `cuatro-tracker-app`, `cuatro-tracker-worker`,
`cuatro-tracker-migrate`, `digital-library-api` and `digital-library-web` are all
locally-built image names with no registry prefix; only `cs-tracker:latest` is ambiguous, and
`caddy:2`, `postgres:16`, `postgres:16-alpine`, `redis:7-alpine`,
`ghcr.io/umami-software/umami:postgresql-latest` and `linuxserver/qbittorrent:latest` are
pulled. **Observed 2026-08-24.** KV-1 is scoped to this repository's deploy workflow; the
estate-wide shape of the breach is wider than KV-1 records, and that is appended to the ledger
rather than added to the register, because promoting an entry needs an Operator ruling.

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
| Whether anything on the box runs outside Docker and reaches a hostname | **Answered, and the answer is no.** See "Nothing outside Docker reaches a hostname". The full listener table is pasted there |
| Each hostname recorded against its Registry application id (AD-3) | **Answered.** See the AD-3 table: eleven hostnames, five with an id, six without, and three of those six are gaps rather than correct absences. `analytics.cuatro.dev` is the gap this pass found rather than inherited |
| A confirmation pass on the Cloudflare audit log before either API token is revoked | **Operator action.** See below |
| Backup coverage per project, which Story 1.8 needs | **Answered.** See "Backup coverage, per project", including the nightly failure in `library-backup.sh` that Story 1.8 inherits |
| Enumerate `95.216.143.251` before it is decommissioned | **Permanently unenumerable.** See "The address the estate left". Not pending work |

### Operator actions this story cannot perform

| Action | Why an agent cannot do it |
|---|---|
| Read the Cloudflare account audit log, then revoke `tracker-mac` and `cuatro-tracker` | The only token in the estate is **zone-scoped**. **Observed 2026-08-24:** `GET /accounts/{id}/audit_logs` returns HTTP 403 `Authentication error` (code 10000) and `GET /user/tokens` returns HTTP 403 `Unauthorized to access requested resource` (code 9109). Reading the log needs an account-scoped token and revoking needs `User > API Tokens > Edit`, neither of which the agent holds, and **never revoke, rotate or create a credential** is a standing boundary. Already tracked as `ops/bot-mitigation.md` Pending Operator action 5 |
| Confirm `analytics.cuatro.dev` passes the managed challenge in a real browser | Playwright arrives in Story 1-10 and no acceptance criterion may claim a rendered-output result before it. Already `ops/bot-mitigation.md` action 3 |
| Confirm the Hostinger weekly whole-box snapshot exists | It is claimed in a script comment and appears nowhere on the box. Confirming it needs the Hostinger console, which the agent cannot reach |
| Verify IPv6 serving and the v6 `DOCKER-USER` path | No session so far has had IPv6 egress. One `curl` from a vantage point with IPv6 closes it, and until then the v6 rules are present and the path is unverified, which are different claims |
| Decide whether `analytics.cuatro.dev`, `covidmap.cuatro.dev` and `future-vizion.cuatro.dev` get Estate rows | A Registry membership decision under AD-6, owned by Story 2-4, not by an enumeration |

### What the retired gathering checklist held that is still true

`ops/routing-inventory-checklist.md` was Story 1.7's method file, written 2026-08-16. It is
retired by this record. Its Part 1 was a pre-cutover DNS snapshot that had become wrong in
every proxied column and still named the two-address topology, which is worse than absent
because it reads as current state. Everything from it that is still true is carried here:

- Its Part 1 record set, corrected and completed. All 25 records now, against its 25 of 26.
- Its Part 4 acceptance shape, which is the structure of this document.
- Its finding that `2a02:4780::/29` is Hostinger's range, kept in the box table.
- Its Certificate Transparency reading that `pokemon.cuatro.dev` and `api.pokemon.cuatro.dev`
  were logged 2025-11-07 and appear in no current DNS record, probably `poketracker-go`. Still
  true, already in the ledger, and still not in the zone on 2026-08-24.
- Its two-token table and the reasoning that both are orphaned, kept in the credentials table.
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
