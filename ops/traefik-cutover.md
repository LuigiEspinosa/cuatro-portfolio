# The Traefik cutover

How Traefik goes onto the box beside the shared Caddy, with a router for every hostname the box
serves, the dashboard behind basic auth, and DNS-01 proven against a scratch hostname; how a hostname
later moves onto it and back; and how to take the whole thing away. It is the artifact Story 4-2
delivers, in the shape `ops/tracker-cutover.md` set, on the mechanism Story 4-1 decided
(`ops/settled-inputs-refresh.md` § Decision: how NFR-2 holds on one 80/443 pair).

This file is a record, not Registry data. Every value is marked as a decision or an observation, and
the two are never presented as the same kind of fact (NFR-9). Times are UTC.

**Nothing here has run on the box. Written 2026-09-30, committed on `dev`.** The authoring session
read the box but wrote nothing to it. The Operator runs the sequence below as `deploy` and dates each
Pending Operator action at the end. **No hostname moves in Story 4-2**: until a later story creates an
Origin Rule, Caddy serves every public request exactly as today.

## What serves today

**Observed 2026-09-30T09:45:54Z over SSH as `deploy`, read-only.**

| Fact | Value |
|---|---|
| Ingress | `cs-tracker-caddy-1`, the only container publishing ports: `0.0.0.0:80`, `[::]:80`, `0.0.0.0:443`, `[::]:443` |
| Site blocks | Eight in `/home/deploy/cs-tracker/Caddyfile`, each with `tls /data/origin-ca/origin.pem /data/origin-ca/origin.key` (lines 23, 40, 55, 77, 88, 98, 112, 123) |
| The certificate | `/data` in that container is volume `cs-tracker_caddy_data`; a copy of the pair also sits in `/home/deploy/origin-ca/` (`origin.key` mode 600). Traefik reads the volume's, the one the edge validates today |
| Origin firewall | `/usr/local/sbin/cf-origin-firewall.sh` returns Cloudflare's 15 IPv4 and 7 IPv6 ranges on `--dports 80,443` in `DOCKER-USER`, then drops |
| Engine | Docker 29.6.2, Compose 5.3.1 (volume `subpath` needs Compose 2.23 or later) |
| Load | `0.23, 0.24, 0.24` |

## What this changes, and what it leaves alone

**Decisions, Story 4-2** (the spec's Design Notes; the Operator may overrule each):

- **Traefik publishes 8443 and a loopback-only 8080.** Caddy keeps 80 and 443 for the whole epic.
- **The stack is `ops/traefik/`**, its own compose project `traefik`, started by hand; no deploy
  starts, rolls or stops it. The box's deploy resets the checkout to `main`, and Traefik watches
  `ops/traefik/dynamic/`, so a routing change merged to `main` goes live at the next deploy.
- **Routing is the file provider alone.** No Docker socket is mounted.
- **Every router matches on `Host`.** Upstreams are the aliases the Caddyfile proxies on
  `cs-tracker_default`, so no application changes. `library.cuatro.dev`'s `/api/` and `/files/` go to
  `library-api` by a second router under the same `Host`, as Caddy's `handle` blocks do.
- **Plain HTTP stays on Caddy.** A moved hostname's Origin Rule matches `ssl` only, so a plaintext
  request still reaches Caddy's port 80, which redirects it to HTTPS, until Story 4.11.
- **DNS-01 is exercised by `dns01-probe.scratch.cuatro.dev` alone**, a name with no DNS record, so it
  is never proxied (AD-26). It is two labels deep because Traefik requests no certificate for a name a
  loaded certificate already covers, and the Origin CA's `*.cuatro.dev` covers every one-label name.
- **Headers carried over as Caddy sends them**: the house set on every host but `cs-tracker`, which
  Caddy sends none for, and `SAMEORIGIN` on `library`. Traefik adds `aliasHeadersStrategy: delete` on
  every entrypoint, which Caddy lacks: a header named like one Traefik manages (`X_Forwarded_For`) is
  dropped rather than forwarded.

## Rehearsed off the box

**Observed 2026-09-30 between 09:50Z and 09:59Z on the authoring machine** (Docker 29.8.1, Compose
5.5.1), with the committed `ops/traefik/` files and throwaway stand-ins: a network named
`cs-tracker_default`, a volume named `cs-tracker_caddy_data` holding a self-signed pair for
`cuatro.dev` and `*.cuatro.dev` under `origin-ca/`, one `traefik/whoami:v1.11` per upstream alias on
its port, and a throwaway `.env`. Let's Encrypt's production directory was unreachable from the final
run on purpose (a scratch `extra_hosts` override), so no account was registered there. Everything was
removed afterwards.

To re-run it, from the repository root in Git Bash (re-run 2026-09-30 at 10:35Z, and at 10:43Z with the 8443 dashboard line; the lines it printed
matched the block below, minus the lines this shorter form does not request):

```bash
docker network create cs-tracker_default && docker volume create cs-tracker_caddy_data
MSYS_NO_PATHCONV=1 docker run --rm -v cs-tracker_caddy_data:/data alpine:3 sh -c 'apk add -q openssl && mkdir /data/origin-ca && openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=throwaway-origin -addext "subjectAltName=DNS:cuatro.dev,DNS:*.cuatro.dev" -keyout /data/origin-ca/origin.key -out /data/origin-ca/origin.pem'
for a in anchor-app:3000 anchor-umami:3000 app:4000 cuatro-app:3000 library-web:3000 library-api:4000 list-wheel:80 tournament:3000; do
  docker run -d --name "stand-in-${a%%:*}" --network cs-tracker_default --network-alias "${a%%:*}" traefik/whoami:v1.11 --port "${a##*:}" --name "${a%%:*}"
done
install -m 600 /dev/null ops/traefik/.env
printf "TRAEFIK_DASHBOARD_USERS='operator:%s'\nCF_DNS_API_TOKEN=throwaway\n" "$(openssl passwd -apr1 throwaway)" >> ops/traefik/.env
printf 'services:\n  traefik:\n    extra_hosts: ["acme-v02.api.letsencrypt.org:127.0.0.1"]\n' > ops/traefik/offline.yml
T='docker compose -f ops/traefik/compose.yml -f ops/traefik/offline.yml'
$T up -d --wait
for h in cuatro.dev analytics.cuatro.dev cs-tracker.cuatro.dev tracker.cuatro.dev library.cuatro.dev wheel.cuatro.dev tournament.cuatro.dev; do
  echo "$h $(curl -sk -o /dev/null -w '%{http_code}' --resolve $h:8443:127.0.0.1 https://$h:8443/) $(curl -sk --resolve $h:8443:127.0.0.1 https://$h:8443/ | grep ^Name)"
done
curl -sk --resolve library.cuatro.dev:8443:127.0.0.1 https://library.cuatro.dev:8443/api/x | grep ^Name
curl -sk -o /dev/null -w 'www %{http_code} %{redirect_url}\n' --resolve www.cuatro.dev:8443:127.0.0.1 'https://www.cuatro.dev:8443/some/path?q=1'
curl -sk -o /dev/null -w 'nope.cuatro.dev %{http_code}\n' --resolve nope.cuatro.dev:8443:127.0.0.1 https://nope.cuatro.dev:8443/
curl -s -o /dev/null -w 'dashboard, no credentials %{http_code}\n' http://localhost:8080/dashboard/
curl -s -o /dev/null -w 'dashboard, credentials %{http_code}\n' -u operator:throwaway http://localhost:8080/dashboard/
curl -sk -o /dev/null -w 'dashboard on 8443, Host: localhost %{http_code}\n' -H 'Host: localhost' https://127.0.0.1:8443/dashboard/
echo | openssl s_client -connect 127.0.0.1:8443 -servername cuatro.dev 2>/dev/null | openssl x509 -noout -subject
# Remove everything; `git status --short` prints nothing afterwards.
$T down -v; rm -f ops/traefik/.env ops/traefik/offline.yml
docker rm -f $(docker ps -aq --filter name=stand-in-)
docker volume rm cs-tracker_caddy_data && docker network rm cs-tracker_default
```

```
traefik-traefik-1 traefik:v3.7.13 Up 6 seconds (healthy) 127.0.0.1:8080->8080/tcp, 0.0.0.0:8443->8443/tcp, [::]:8443->8443/tcp
cuatro.dev             200 Name: anchor-app
analytics.cuatro.dev   200 Name: anchor-umami
cs-tracker.cuatro.dev  200 Name: app
tracker.cuatro.dev     200 Name: cuatro-app
library.cuatro.dev     200 Name: library-web
wheel.cuatro.dev       200 Name: list-wheel
tournament.cuatro.dev  200 Name: tournament
library.cuatro.dev/api/x   Name: library-api
library.cuatro.dev/files/y Name: library-api
library.cuatro.dev/books   Name: library-web
www 301 https://cuatro.dev/some/path?q=1
nope.cuatro.dev 404
dashboard, no credentials 401
dashboard, wrong password 401
dashboard, credentials 200
dashboard on 8443, Host: localhost 404
12 routers, statuses: enabled
subject=CN=throwaway-origin
```

Each request went with `curl --resolve <host>:8443:127.0.0.1`, so SNI was the hostname, as Cloudflare
sends it. The www response carried `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and
`Referrer-Policy: strict-origin-when-cross-origin`; `library` answered `X-Frame-Options: SAMEORIGIN`.
The dashboard line asks 8443 with `Host: localhost`, which no router matches, so neither `/dashboard/`
nor `/api/rawdata` is reachable there; `https://cuatro.dev:8443/dashboard/` reaches `anchor-app`, the
Hub's own path, as step 6 expects.

**Traefik has no configuration check command.** `traefik --help` lists two commands, `healthcheck` and
`version`. What stands in for one: the static file is read strictly, so a misspelled key refuses to
start (`api.dashbord` gave `command traefik error: field not found, node: dashbord`, exit 1); the
dynamic file loaded with `Error while building configuration` absent from the log and all twelve
routers `enabled` in `/api/http/routers`; and `ops/__tests__/traefik-config.test.ts` holds the shape.

**DNS-01, against Let's Encrypt's staging directory**, with a copy of the static file at `DEBUG` and
`caServer` set to staging, and a throwaway token:

```
DBG ... Attempt to renew certificates "720h0m0s" before expiry and check every "24h0m0s"
DBG ... Domains need ACME certificates generation for domains "dns01-probe.scratch.cuatro.dev".
INF ... Registering the account.
ERR ... Unable to obtain ACME certificate for domains error="unable to generate a certificate for the domains [dns01-probe.scratch.cuatro.dev]: resolver: one or more domains had a problem: [dns01-probe.scratch.cuatro.dev: dns01: error presenting token (dns01-probe.scratch.cuatro.dev): cloudflare: failed to find zone cuatro.dev.: [status code 400] 6003: Invalid request headers; 6111: Invalid format for Authorization header]"
```

So the resolver reaches Cloudflare's API with the token from `.env`, and a real token is the one thing
missing. A one-label scratch name (`dns01-probe.cuatro.dev`, the first attempt) logged `No ACME
certificate generation required for domains`: the default certificate already covered it. Registration
without an `email` succeeded against staging, so the static file carries none. **Not proven here:**
issuance, the Origin CA's real pair, the box's aliases, the edge, and the firewall. Step 7 proves
issuance. To re-run it, start the block above without `offline.yml`, with a copy of `traefik.yml` whose
`log.level` is `DEBUG` and whose `acme` block adds
`caServer: https://acme-staging-v02.api.letsencrypt.org/directory`, mounted over the committed file.

**Renewal, forced against a throwaway Pebble ACME server**, observed 2026-09-30 between 10:20Z and
10:27Z. Pebble (`ghcr.io/letsencrypt/pebble:latest`, `PEBBLE_VA_ALWAYS_VALID=1`) issued 22 minute
certificates from a config whose `profiles.default.validityPeriod` and
`profiles.shortlived.validityPeriod` are both 1320 (with only the first set, the first issuance came
back with the `shortlived` profile's 518400 seconds, six days, per the independent verifier's re-run).
Traefik v3.7.13 ran a copy
of the committed static file with four changes under `acme`: `caServer: https://pebble:14000/dir`,
`certificatesDuration: 1` (hours, which Traefik's table maps to a 20 minute renew window checked every
minute), and `dnsChallenge.provider: exec` with `propagation.disableChecks: true` (`EXEC_PATH=/bin/true`,
`LEGO_CA_CERTIFICATES` naming Pebble's `pebble.minica.pem`), with the committed `dns01-probe` router
alone in `dynamic/`. Nothing else differs from the committed file: the schedule, the storage and the
renewal loop are Traefik's own. It renewed without a restart, and the served certificate changed:

```
DBG ... Attempt to renew certificates "20m0s" before expiry and check every "1m0s"
INF ... Server responded with a certificate. domains=dns01-probe.scratch.cuatro.dev
INF ... Renewing ACME certificate: {Main:dns01-probe.scratch.cuatro.dev SANs:[]}      (10:23:13Z)
INF ... Trying renewal. domains=dns01-probe.scratch.cuatro.dev hoursRemaining=0
INF ... Server responded with a certificate. domains=dns01-probe.scratch.cuatro.dev
INF ... Renewing ACME certificate: {Main:dns01-probe.scratch.cuatro.dev SANs:[]}      (10:26:13Z)

openssl x509 -serial -dates on the served certificate, 10:20:23Z:
  serial=5FF6F62A70D4485D  notBefore=Sep 30 10:20:17 2026 GMT  notAfter=Sep 30 10:42:16 2026 GMT
the same, 10:27:41Z:
  serial=7E3C606E3229AE82  notBefore=Sep 30 10:26:13 2026 GMT  notAfter=Sep 30 10:48:12 2026 GMT
```

What that leaves unproven is only what issuance already covers: the production directory and the
Cloudflare provider, which step 7 exercises with the real token. On the box the committed
`certificatesDuration` default gives the 720 hour window logged above, so a box renewal first happens
about 60 days after step 7; step 7's `openssl` line re-read after that date shows a later `notBefore`.

## The sequence

On the box as `deploy`, in `/home/deploy/cuatro-portfolio`. **Preconditions:** the commit carrying
`ops/traefik/` is on `main` and deployed, so the checkout holds it (Pending action 1); and a Cloudflare
API token scoped to the `cuatro.dev` zone with **Zone, DNS, Edit** and **Zone, Zone, Read** exists
(action 2). Two sessions help: one on the box, and one on the workstation for the checks from outside.

```bash
cd /home/deploy/cuatro-portfolio
T='docker compose -f ops/traefik/compose.yml'
```

1. **Re-read what this stands on, and stop at the first difference.**
   `docker volume inspect cs-tracker_caddy_data --format '{{.Name}}'` prints the name;
   `grep -c 'tls /data/origin-ca/origin.pem /data/origin-ca/origin.key' /home/deploy/cs-tracker/Caddyfile`
   prints 8;
   `docker network inspect cs-tracker_default --format '{{range .Containers}}{{.Name}} {{end}}'` lists
   the Hub, Umami, `cs-tracker-app-1`, `cuatro-portfolio-tracker-1`, both `digital-library` servers,
   `list-wheel-list-wheel-1` and `cuatro-portfolio-tournament-1`;
   `docker exec cs-tracker-caddy-1 sha256sum /data/origin-ca/origin.pem` and
   `sha256sum /home/deploy/origin-ca/origin.pem` print the same digest (the public half only; this
   shows the two copies are one certificate); `ss -ltn | grep -c ':8443 '` prints 0.
2. **Write the env file, never printing a value.**
   ```bash
   install -m 600 /dev/null ops/traefik/.env
   printf "TRAEFIK_DASHBOARD_USERS='operator:%s'\n" "$(openssl passwd -apr1)" >> ops/traefik/.env
   read -rs CF && printf 'CF_DNS_API_TOKEN=%s\n' "$CF" >> ops/traefik/.env; unset CF
   git check-ignore -q ops/traefik/.env && echo ignored
   ```
   `openssl passwd -apr1` prompts twice for the dashboard password and prints only the hash. The single
   quotes are load-bearing: Compose reads a single-quoted value literally, so the hash's `$` signs are
   not interpolated. `ignored` must print.
3. **Admit 8443 at the origin firewall, for Cloudflare's ranges only.**
   ```bash
   sudo cp /usr/local/sbin/cf-origin-firewall.sh /usr/local/sbin/cf-origin-firewall.sh.bak-4-2
   sudo sed -i 's/--dports 80,443 -j/--dports 80,443,8443 -j/' /usr/local/sbin/cf-origin-firewall.sh
   sudo systemctl restart cf-origin-firewall.service
   sudo iptables -S DOCKER-USER | grep -c '80,443,8443'    # 16
   sudo ip6tables -S DOCKER-USER | grep -c '80,443,8443'   # 8
   for c in $(sudo ufw status | awk '$1 ~ /^(80|443)/ && /ALLOW/ {print $NF}' | sort -u); do
     sudo ufw allow proto tcp from "$c" to any port 8443; done
   ```
   The service is a oneshot that flushes `DOCKER-USER` and rebuilds it, so a restart applies the edit.
   `ufw` does not filter a published container port, and its rules are kept in step with the chain for
   the record's reason (`ops/routing-inventory.md` § The origin is firewalled to Cloudflare). Host and
   container port are both 8443 on purpose: `DOCKER-USER` sees the port after DNAT.
4. **Start Traefik.** `$T up -d`, then `docker inspect -f '{{.State.Health.Status}}' traefik-traefik-1`
   until it prints `healthy`; `docker logs traefik-traefik-1 2>&1 | grep -c 'Error while building configuration'`
   prints 0. Read the cost 4.1 left unmeasured: `uptime` and
   `docker stats --no-stream traefik-traefik-1 cs-tracker-caddy-1`. Load15 stays under the Capacity
   Gate's 0.60 (`ops/capacity-threshold.md`); Traefik is not an application placement and takes no
   `placements` entry.
5. **Verify per hostname: Traefik answers what Caddy answers.** On the box:
   ```bash
   for u in cuatro.dev/api/health www.cuatro.dev/some/path?q=1 analytics.cuatro.dev/api/heartbeat \
            cs-tracker.cuatro.dev/ tracker.cuatro.dev/api/health library.cuatro.dev/ \
            library.cuatro.dev/api/health wheel.cuatro.dev/ tournament.cuatro.dev/api/health; do
     h=${u%%/*}; p=/${u#*/}
     c=$(curl -sk -o /dev/null -w '%{http_code} %{redirect_url}' --resolve "$h:443:127.0.0.1" "https://$h$p")
     t=$(curl -sk -o /dev/null -w '%{http_code} %{redirect_url}' --resolve "$h:8443:127.0.0.1" "https://$h:8443$p")
     echo "$u caddy=[$c] traefik=[$t]"
   done
   echo | openssl s_client -connect 127.0.0.1:8443 -servername tracker.cuatro.dev 2>/dev/null | openssl x509 -noout -subject -enddate
   ```
   Every pair's status matches (www: 301 and `https://cuatro.dev/some/path?q=1` on both sides, the
   redirect URL on Traefik's side carrying no port); the certificate prints
   `CN = CloudFlare Origin Certificate` and `notAfter=Aug 13 17:15:00 2041 GMT`. A pair that differs is
   a finding: record it and stop. Then **through the edge, from the workstation**:
   `curl -s -o /dev/null -w '%{http_code}\n' https://cuatro.dev:8443/api/health` prints 200, which is
   Cloudflare validating Traefik's Origin CA certificate under Full (strict) with no Origin Rule; and
   `curl -sk --max-time 5 https://177.7.52.248:8443/` must time out (the firewall drops it).
6. **The dashboard.** From the workstation: `ssh -N -L 8080:127.0.0.1:8080 deploy@177.7.52.248`, then
   `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/dashboard/` prints 401, and with
   `-u operator` (prompting) 200. `curl -s -o /dev/null -w '%{http_code}\n' https://cuatro.dev:8443/dashboard/`
   answers what `https://cuatro.dev/dashboard/` answers, the Hub's page, never Traefik's API.
7. **Prove DNS-01 against the scratch hostname (AD-26).** Traefik requests the certificate at start:
   ```bash
   docker logs traefik-traefik-1 2>&1 | grep -iE 'acme|dns01-probe' | tail -5
   echo | openssl s_client -connect 127.0.0.1:8443 -servername dns01-probe.scratch.cuatro.dev 2>/dev/null \
     | openssl x509 -noout -issuer -subject -dates
   docker exec traefik-traefik-1 sh -c 'wc -c /acme/acme.json; stat -c %a /acme/acme.json'
   ```
   The issuer is Let's Encrypt, the subject `CN = dns01-probe.scratch.cuatro.dev`, the dates 90 days
   apart (64 from February 2027, 45 from February 2028), and `acme.json` non-empty at mode 600. From the
   workstation, `curl -s 'https://cloudflare-dns.com/dns-query?name=dns01-probe.scratch.cuatro.dev&type=A' -H 'accept: application/dns-json'`
   answers with no `Answer`: the name never entered DNS, so it was never proxied. A log line
   `Unable to obtain ACME certificate` is the proof failing: record its text, and check the token's
   two permissions first.
8. **Record.** The date, step 1's digests, step 4's readings, step 5's pairs, step 6's codes and step
   7's certificate go under a "Cutover run" heading here, and each Pending Operator action is dated.
   `ops/routing-inventory.md` § Ingress and `ops/estate.md` each take a dated amendment: Traefik runs
   beside Caddy on 8443 and loopback 8080, serves no public request until an Origin Rule exists, and the
   origin firewall admits 8443 for Cloudflare's ranges.

## Moving a hostname, and moving it back

**For Stories 4.3 and 4.6 to 4.10, not run in 4-2.** Each is its own shipped and verified step (AD-20).
A hostname moves when one Origin Rule sends its HTTPS requests to 8443:

```bash
# ZONE is the zone id; CF_RULES_TOKEN may edit the zone's origin rules (action 2 of the refresh record).
curl -s https://api.cloudflare.com/client/v4/zones/$ZONE/rulesets/phases/http_request_origin/entrypoint \
  -H "Authorization: Bearer $CF_RULES_TOKEN"
```

If that answers a ruleset, add a rule to it with
`POST /zones/$ZONE/rulesets/<its id>/rules`; if it answers not found, create it with
`PUT /zones/$ZONE/rulesets/phases/http_request_origin/entrypoint` and a `rules` array of one. The rule:

```json
{ "description": "Story 4.N: <hostname> to Traefik on 8443",
  "expression": "(http.host eq \"<hostname>\" and ssl)",
  "action": "route",
  "action_parameters": { "origin": { "port": 8443 } } }
```

Verify with the same request loop `ops/tracker-cutover.md` step 3 runs, off the box, against the
hostname's health path, across the rule's creation: it shows 200 alone. **Rollback of one hostname is
deleting its rule** (`DELETE /zones/$ZONE/rulesets/<id>/rules/<rule id>`), which takes effect at the
edge without touching the box; Caddy still holds that hostname's site block.

## Moving cuatro.dev and www (Story 4-6)

The first live use of § Moving a hostname: `www.cuatro.dev`, then `cuatro.dev`, each by its own Origin
Rule, with one CI-built deploy of the Hub rolled while the apex runs through Traefik. **Nothing here has
run on the box or in the zone. Written 2026-09-30, committed on `dev`.** The Operator runs it and dates
Pending Operator actions 5 and 6 below.

**Why here and not a new `ops/anchor-cutover.md`.** Decision, Story 4-6, the Operator may overrule. This
record owns the per-hostname mechanism and its rollback. The Hub owns no store, so its move has no
backup, restore or migration step, and the one thing specific to it is the deploy through Traefik; a
separate record would restate the mechanism around one step.

### What serves them today

**Observed 2026-09-30T13:15:14Z over SSH as `deploy`, read-only.**

| Fact | Value |
|---|---|
| The Hub | `cuatro-portfolio-anchor-app-4`, `ghcr.io/luigiespinosa/hub:373e33d8e36e4ce92efb58ca8289157c42656b1e`, `Up 12 hours (healthy)`. The `-4` is docker-rollout's: each deploy's container takes the next number |
| Its names on `cs-tracker_default` | Aliases `cuatro-portfolio-anchor-app-4` and `anchor-app`; only `anchor-app` outlives a deploy, and it is the name both Caddy and Traefik's `cuatro-portfolio` service dial |
| The checkout | `/home/deploy/cuatro-portfolio` at `373e33d8e36e4ce92efb58ca8289157c42656b1e`, no `ops/traefik/` yet; nothing listens on 8443 |
| Load | `0.03, 0.08, 0.13` |

**Observed 2026-09-30 through the UptimeRobot API:** 803749849 (`cuatro.dev` root), 803756371
(`/api/health` keyword) and 803756083 (`www` 301) all `UP`, for 44 days. **Observed 2026-09-30 from the
authoring machine:** `https://www.cuatro.dev/some/path?q=1` answered `301` with
`location: https://cuatro.dev/some/path?q=1`; `https://cuatro.dev/contracts/tokens.css` answered `200`,
`Content-Type: text/css; charset=UTF-8`, `Cache-Control: public, max-age=14400` and **`via: 1.1 Caddy`**.
Caddy's `reverse_proxy` adds that `Via` header and Traefik v3.7.13 adds none (observed 2026-09-30 on
the authoring machine: a throwaway Traefik in front of `traefik/whoami` returned no `Via` header, and
sent none upstream). Its absence on an apex response the edge did not cache
is how step 4 tells which proxy answered.

### What the move changes, and what it leaves alone

**Decisions, Story 4-6** (the spec's Design Notes; the Operator may overrule each):

- **No routing change.** The `cuatro-portfolio` and `www` routers in `dynamic/routes.yml` already match
  Caddy's two blocks: the house headers, `anchor-app:3000`, and a permanent redirect keeping path and
  query. `ops/__tests__/traefik-config.test.ts` now also holds the apex upstream to an alias
  `docker-compose.yml` gives `anchor-app`, never a container name.
- **`contracts/` stays the Hub's.** The Operator's ruling of 2026-09-24: Traefik does not serve
  `contracts/`. It reaches the Hub through the apex router like any other path, and the suite refuses a
  routing file that names it.
- **www first, then the apex, two rules.** www only answers a redirect, so it puts Traefik under live
  traffic at the least cost, and its monitor asserts the 301. Two rules rather than one, so each rolls
  back alone (eight hostnames against the Free plan's ten rules).
- **Story 4.4 does not bind this move.** The epic lists it as a dependency, but the Hub has no database
  (Umami's store moves in Story 4.7), so `ops/postgres.md` and `ops/postgres-backup.md` need not have run.
- **Caddy keeps both blocks** until Story 4.11. Deleting a rule sends the hostname back to them.
- **No capacity entry.** A routing move places nothing (AD-9).

### Rehearsed off the box: a rollout under the alias, through Traefik

**Observed 2026-09-30 between 13:16Z and 13:23Z on the authoring machine** (Docker 29.8.1), with the
committed `ops/traefik/` files and § Rehearsed off the box's throwaway network, certificate volume,
`.env` and `offline.yml`; the **real Hub image the box runs**, pulled from GHCR; the **real
`docker-compose.yml`** (a byte-identical copy, sha256 `24495620...95bece0`, run from a scratch directory
with an empty `.env.production`); and **docker-rollout v0.14**, the release asset whose sha256 matched
`ops/deploy-remote.sh`'s pin, installed as the Docker CLI plugin in a `docker:29-cli` container on the
host's socket, which is how the deploy runs it. Everything was removed afterwards and `git status --short`
printed nothing.

To re-run it, from the repository root in Git Bash, after the setup lines of the block under § Rehearsed
off the box (the network, the volume and its certificate, the `.env`, `offline.yml`, then
`$T up -d --wait`); `W` is a scratch directory holding the `docker-compose.yml` copy, an empty
`.env.production` and the downloaded `docker-rollout`:

```bash
export MSYS_NO_PATHCONV=1 TAG=373e33d8e36e4ce92efb58ca8289157c42656b1e
R() { docker run --rm -e HUB_TAG=$TAG -v /var/run/docker.sock:/var/run/docker.sock -v "$W:/w" -w /w docker:29-cli \
  sh -c "apk add -q bash && mkdir -p /root/.docker/cli-plugins && cp /w/docker-rollout /root/.docker/cli-plugins/ && chmod +x /root/.docker/cli-plugins/docker-rollout && $1"; }
R 'docker compose --env-file .env.production up -d --wait anchor-app'
( i=0; p=(/ /api/health /contracts/tokens.css); while [ ! -e stop ]; do u=${p[$((i++%3))]}
    echo "$(date -u +%T) $u $(curl -sk -o /dev/null -w '%{http_code} %{time_total}' --max-time 10 --resolve cuatro.dev:8443:127.0.0.1 https://cuatro.dev:8443$u)"
  done > probe.log ) &
for n in 1 2 3 4 5; do R 'docker rollout --env-file .env.production --timeout 120 anchor-app'; sleep 3; done
touch stop; wait; awk '{print $2, $3}' probe.log | sort | uniq -c
# Then remove the Hub's containers with the rest:
docker rm -f $(docker ps -aq --filter label=com.docker.compose.project=cuatro-portfolio); rm -f stop probe.log
```

Before the first rollout, through Traefik on 8443 with `--resolve`:

```
traefik / 200 text/html; charset=utf-8
traefik /api/health 200 application/json
traefik /contracts/tokens.css 200 text/css; charset=UTF-8
www 301
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

The three headers are the apex stylesheet's. The `www` line's `%{redirect_url}` printed empty for
`https://www.cuatro.dev:8443/contracts/tokens.css?q=1`; the response's own header, read afterwards, was
`Location: https://cuatro.dev/contracts/tokens.css?q=1`, with the same three headers. Each rollout
printed docker-rollout's three lines and left one container, numbered one higher:

```
==> Scaling 'anchor-app' to '2' instances
==> Waiting for new containers to be healthy (timeout: 120 seconds)
==> Stopping and removing old containers
--- after rollout 1: cuatro-portfolio-anchor-app-2 Up 6 seconds (healthy)
```

Back-to-back requests, one at a time, three paths in turn, across four runs:

| Run | Rollouts | Requests | Answered 200 | Other | Slowest 200 |
|---|---|---|---|---|---|
| 1, from a fresh `up` | 2 | 237 | 236 | **1 `000`** | not recorded |
| 2 | 5 | 446 | 446 | none | 0.118 s |
| 3 | 10 | 866 | 866 | none | 0.109 s |
| 4, from a fresh `up`, run 1's shape | 3 | 273 | 273 | none | 0.129 s |

**The one `000` is not explained, and is stated rather than dropped (DW-305).** It was run 1's last request,
started at 13:17:32Z, after both rollouts had finished and the script's 5 second pause after them had
run out; it hit curl's 10 second `--max-time` (the script's closing `date` read 13:17:42Z). No container
was starting or stopping then, and runs 2 to 4 (18 rollouts, 1,585 requests) did not reproduce it, run 4
in run 1's own shape. Docker Desktop's port forwarding on the authoring host is one candidate and is not
proven. On the box, step 5's probe is the check: a non-200 there during the deploy is a finding.

**What this does not prove:** the box's engine, network and load; Cloudflare in front; concurrent
requests (the probe sends one at a time, seven to nine a second); and a long request in flight at the
moment the old container stops. Step 5 covers the first two with the real edge.

### The sequence

**Preconditions:** § The sequence steps 1 to 8 have run and are recorded, with step 5's pairs matching
for `cuatro.dev/api/health` and `www.cuatro.dev` (Pending actions 1 to 4 dated); and a Cloudflare API
token that may edit the zone's origin rules exists (`ops/settled-inputs-refresh.md` Pending action 4).
Two sessions: one on the box as `deploy` in `/home/deploy/cuatro-portfolio`, one on the workstation (WSL,
with `curl` and `jq`; `gh` may run from any workstation shell). **`jq` is not installed in the authoring
machine's WSL** (observed 2026-09-30, `jq: command not found`): `sudo apt-get install -y jq` there first.
The filters below were checked with `jq` 1.8.1 against sample answers of both shapes. The token stays on
the workstation and is never printed:

```bash
# Workstation. ZONE is the cuatro.dev zone id.
read -rs CF_RULES_TOKEN && export CF_RULES_TOKEN; export ZONE=<zone id>
CF() { curl -s -H "Authorization: Bearer $CF_RULES_TOKEN" -H 'Content-Type: application/json' "https://api.cloudflare.com/client/v4/zones/$ZONE/rulesets$1" "${@:2}"; }
rule() { printf '{"description":"Story 4-6: %s to Traefik on 8443","expression":"(http.host eq \\"%s\\" and ssl)","action":"route","action_parameters":{"origin":{"port":8443}}}' "$1" "$1"; }
```

1. **Re-read what the move stands on, and stop at the first difference.** On the box:
   ```bash
   uptime
   docker ps --filter label=com.docker.compose.service=anchor-app --format '{{.Names}} {{.Image}} {{.Status}}'
   docker inspect -f '{{.State.Health.Status}}' traefik-traefik-1
   grep -c 'url: http://anchor-app:3000' ops/traefik/dynamic/routes.yml
   for u in cuatro.dev/ cuatro.dev/api/health cuatro.dev/contracts/tokens.css 'www.cuatro.dev/some/path?q=1'; do
     h=${u%%/*}; p=/${u#*/}
     echo "$u caddy=[$(curl -sk -o /dev/null -w '%{http_code} %{redirect_url}' --resolve "$h:443:127.0.0.1" "https://$h$p")]" \
          "traefik=[$(curl -sk -o /dev/null -w '%{http_code} %{redirect_url}' --resolve "$h:8443:127.0.0.1" "https://$h:8443$p")]"
   done
   docker exec traefik-traefik-1 netstat -tn | grep -c ':8443 .*ESTABLISHED'
   ```
   One Hub container, healthy; Traefik `healthy`; `1`; every pair's status equal (200, 200, 200, and 301
   on both sides; § The sequence step 5 read the redirect targets); the connection count is the
   baseline, normally `0`. On the workstation:
   `CF /phases/http_request_origin/entrypoint | jq '.success, [.result.rules[]?.expression]'` lists no
   rule for either hostname, and the UptimeRobot dashboard shows 803749849, 803756371 and 803756083 `UP`.
   Record `curl -s "https://cuatro.dev/contracts/tokens.css?v=$(date +%s)" | sha256sum`.
2. **Start the request loop on the workstation, and leave it running to step 6.**
   ```bash
   while :; do printf '%s %s %s %s\n' "$(date -u +%H:%M:%S)" \
     "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 https://cuatro.dev/api/health)" \
     "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 https://www.cuatro.dev/)" \
     "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "https://cuatro.dev/contracts/tokens.css?probe=$(date +%s%N)")"; sleep 1
   done | tee anchor-cutover-probe.log
   ```
   The query string is unique per request, so the edge cannot answer the stylesheet from its cache.
3. **Move `www.cuatro.dev`.** Read the entrypoint again and look at the answer before writing:
   ```bash
   E=$(CF /phases/http_request_origin/entrypoint); echo "$E" | jq '.success, .errors, .result.id'
   ```
   If `.success` is `true`, a ruleset exists (Story 4.3 may have created it): add the rule to it.
   ```bash
   RS=$(echo "$E" | jq -r 'select(.success) | .result.id'); [ -n "$RS" ] && CF "/$RS/rules" -X POST --data "$(rule www.cuatro.dev)" | jq '.success, .errors'
   ```
   Only if `.success` is `false` **and** `.errors` says the phase has no entrypoint ruleset, create it
   with this rule alone. Never run the `PUT` against an entrypoint that exists, or after any other error
   (a token without read access looks the same as a missing ruleset to a script): a `PUT` replaces the
   whole entrypoint, and with it every other hostname's rule.
   ```bash
   CF /phases/http_request_origin/entrypoint -X PUT --data "{\"rules\":[$(rule www.cuatro.dev)]}" | jq '.success, .errors'
   ```
   `true` and `[]`. Then, after about a minute: `curl -sI 'https://www.cuatro.dev/some/path?q=1'` answers
   `301` and `location: https://cuatro.dev/some/path?q=1`; on the box, the step 1 `netstat` count is above
   its baseline (Cloudflare now holds connections to Traefik), and `uptime`. The probe's second column
   stays `301`.
4. **Move `cuatro.dev`.** The same, with the apex, into the ruleset step 3 left:
   ```bash
   RS=$(CF /phases/http_request_origin/entrypoint | jq -r 'select(.success) | .result.id'); [ -n "$RS" ] && CF "/$RS/rules" -X POST --data "$(rule cuatro.dev)" | jq '.success, .errors'
   ```
   Then, after about a minute:
   `curl -sI "https://cuatro.dev/contracts/tokens.css?v=$(date +%s)" | grep -iE '^(HTTP|content-type|via|cf-cache-status)'`
   answers `200`, `text/css`, **no `via: 1.1 Caddy` line**, and a `cf-cache-status` other than `HIT`;
   `curl -s "https://cuatro.dev/contracts/tokens.css?v=$(date +%s)" | sha256sum` prints step 1's digest;
   `curl -s https://cuatro.dev/api/health` contains `"status":"ok"`; and on the box, `uptime`.
5. **Roll one CI-built deploy through Traefik.** On the workstation:
   `gh workflow run deploy.yml --ref main -R LuigiEspinosa/cuatro-portfolio`; then
   `gh run list -R LuigiEspinosa/cuatro-portfolio -w deploy.yml -e workflow_dispatch -L 1` until its line is
   the run just dispatched (its age reads seconds, not an earlier dispatch), and
   `gh run watch --exit-status -R LuigiEspinosa/cuatro-portfolio <its id>` until it ends green. It builds `main`'s image, and the box pulls it and runs
   `docker rollout ... anchor-app` (a Markdown-only push to `main` deploys nothing, which is why this
   dispatches). On the box afterwards: the step 1 `docker ps` line shows one container, numbered one
   higher, healthy, on `main`'s sha; `uptime`; and the step 4 `curl -sI` still shows no `via` line.
6. **Stop the loop and count.** After a minute more:
   `awk '{print $2, $3, $4}' anchor-cutover-probe.log | sort | uniq -c` must show `200 301 200` alone.
   Anything else is a finding: note its times against steps 3 to 5, and roll back the hostname it names.
   Then, after at least one five-minute monitor interval, the three monitors of step 1 read `UP`.
7. **Record.** Under a "Cutover run, cuatro.dev and www" heading here: the date, step 1's pairs and
   digest, each step's load, the two rule ids (`CF "/$RS" | jq '.result.rules[] | {id, description}'`),
   step 5's run id and the container it left, and step 6's counts. `ops/routing-inventory.md` § Ingress and
   `ops/estate.md` each take a dated amendment: `cuatro.dev` and `www.cuatro.dev` are served by Traefik
   through an Origin Rule, and Caddy's two blocks remain, unreached, until Story 4.11.

**Rollback, at any step, one hostname at a time, apex first:**

```bash
RS=$(CF /phases/http_request_origin/entrypoint | jq -r 'select(.success) | .result.id')
ID=$(CF "/$RS" | jq -r '.result.rules[] | select(.description == "Story 4-6: cuatro.dev to Traefik on 8443") | .id')
echo "rule ${ID:-not found}"; [ -n "$RS" ] && [ -n "$ID" ] && CF "/$RS/rules/$ID" -X DELETE | jq '.success'
```

The same with `www.cuatro.dev` in the description for www. It takes effect at the edge without touching
the box, and step 4's `curl -sI` shows `via: 1.1 Caddy` again. Nothing on the box changed, so nothing is
restored. To take Traefik away as well, delete both rules first, then § Rollback to Caddy, whole.

## Rollback to Caddy, whole

While no Origin Rule points at 8443, nothing public depends on Traefik:

```bash
$T down                       # keeps the acme volume; `down -v` also drops the scratch certificate
sudo cp /usr/local/sbin/cf-origin-firewall.sh.bak-4-2 /usr/local/sbin/cf-origin-firewall.sh
sudo systemctl restart cf-origin-firewall.service
sudo ufw status numbered      # then `sudo ufw delete <n>` for each 8443 rule step 3 added
```

Once a later story has moved a hostname, delete its Origin Rule first, then the above.

## How certificate monitoring sees this

`ops/monitoring.md` § The certificate rule, applied to Traefik:

- **Proxied hostnames: nothing changes for the monitors.** Every probe still observes Cloudflare's edge
  certificate, so Rule 1's expected issuer stays Google Trust Services and no monitor is edited.
- **The origin certificate is the same file**, presented by Traefik instead of Caddy, so its expiry
  stays the Decisions table's 2041-08-13 with its 2041-02-13 review. If Traefik ever served something
  else (its self-signed `TRAEFIK DEFAULT CERT`, if the mount failed), Full (strict) would refuse it with
  a 526 on every moved hostname, and the HTTP monitors would alarm. Step 5's edge request is that check
  on demand.
- **The scratch certificate is the one Traefik renews**, and no external monitor can see it: it has no
  DNS record, by design. Traefik tries renewal 720 hours (30 days) before expiry and checks every 24
  hours at the default `certificatesDuration` of 2160 hours (logged above; Traefik's table maps
  a configured duration of 90 days up to a year to that period). That is before two thirds of the certificate's age at
  every step of the lifetime schedule: day 60 of 90, day 34 of 64 and day 15 of 45, so Rule 2's
  threshold would not fire on a healthy renewal. Rule 2 itself stays unconfigured (the free plan
  refuses it). Step 7's `openssl` line is the check, and a hostname that leaves the proxy gets its
  public certificate, and a monitor, before it does (AD-26).
- **This departs from the epic's wording.** Story 4.2's acceptance intent says Story 1.2's
  certificate-age monitoring sees the new certificates. Under AD-26 no monitored hostname gets a new
  certificate in this story, and the one new certificate is unreachable by design, so no monitor is
  added or edited. Pending action 3 asks the Operator to confirm that reading or overrule it (the
  overrule would be a DNS record for the scratch host and a paid certificate monitor on it).

## Pending Operator actions

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| 1 | **Merge the commit carrying `ops/traefik/` into `main`** and let the Deploy run | The box checkout is `main`; nothing here reaches the box another way | _not done_ |
| 2 | **Create a Cloudflare API token** for the `cuatro.dev` zone with Zone, DNS, Edit and Zone, Zone, Read, for step 2 | DNS-01 writes only `_acme-challenge` TXT records. The Origin Rules token of the refresh record's action 4 is a separate question, needed from Story 4.3 | _not done_ |
| 3 | **Confirm or overrule the decisions above**, and the certificate monitoring reading in § How certificate monitoring sees this | Each is a decision the Operator may overrule; the spec's Design Notes carry the reasoning. The monitoring reading departs from the epic's "certificate-age monitoring sees the new certificates" | _not done_ |
| 4 | **Run steps 1 to 8 above** | Step 3 is also the refresh record's action 4, firewall half | _not done_ |
| 5 | **Confirm or overrule Story 4-6's decisions** in § Moving cuatro.dev and www: this record rather than a new one, no routing change, www before the apex as two rules, Story 4.4 not a precondition | The Story 4-6 spec's Design Notes carry the reasoning | _not done_ |
| 6 | **Run § Moving cuatro.dev and www steps 1 to 7**, after actions 1 to 4 here and the refresh record's action 4 (the origin rules token) | Step 5 dispatches the Deploy workflow; step 7 amends `ops/routing-inventory.md` and `ops/estate.md` | _not done_ |

**Maintaining this file.** When an action is performed, replace its cell with the ISO 8601 UTC date and
leave the row in place.
