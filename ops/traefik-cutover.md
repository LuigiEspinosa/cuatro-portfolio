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

**Maintaining this file.** When an action is performed, replace its cell with the ISO 8601 UTC date and
leave the row in place.
