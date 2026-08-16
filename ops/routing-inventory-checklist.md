# Routing inventory: gathering checklist

**Scaffolding, not the record.** Story 1.7's deliverable is `ops/routing-inventory.md`. This
file is the method you work from to produce it, and its filled-in tables become that record's
observed-state sections. Delete it or fold it in once the inventory lands.

Written 2026-08-16. Two addresses are in scope:

| Label | Address | What resolves to it | Fate |
|---|---|---|---|
| **OLD** | `95.216.143.251` | `cuatro.dev`, `analytics.cuatro.dev` | Decommissioned by Story 1.21 |
| **NEW** | `177.7.52.248` | `cs-tracker.cuatro.dev`, `tracker.cuatro.dev`, `library.cuatro.dev` | Hostinger KVM 2, prepaid to 2028-07-19. Stays |

## Rules for this pass

- [ ] **Read only.** Story 1.7's last acceptance block says nothing on either box is changed by
      this story. No restarts, no config edits, no `docker compose up`, no certificate renewals,
      not even to "just fix" something obviously broken. If you find something broken, write it
      down and leave it.
- [ ] **OLD is enumerated before anything is decommissioned.** Story 1.21 depends on this pass.
      Once that box is gone, whatever was only on it is gone with it.
- [ ] **Paste raw output into the record**, not your summary of it. The value of this document
      to Epic 4 is that it is evidence rather than recollection.
- [ ] Record anything you cannot determine as unknown. An unanswered question written down beats
      a plausible guess.

## Part 1: the DNS side, before you touch either box

Do this first. It is the only part that tells you whether the hostname list you are working
from is complete.

- [ ] Export the full `cuatro.dev` zone from the Cloudflare dashboard. Every record type, not
      just A and CNAME.
- [ ] For each record capture: name, type, content, **proxied or DNS-only**, TTL.
- [ ] Flag every record whose content is neither OLD nor NEW. `www.cuatro.dev` is already known
      to point at a third provider and return `DEPLOYMENT_NOT_FOUND`.
- [ ] Note any hostname in the zone that nobody expected. That set is the point of this step.

Cross-check from outside, so a dashboard misreading does not go unnoticed:

```powershell
'cuatro.dev','www.cuatro.dev','analytics.cuatro.dev','cs-tracker.cuatro.dev',
'tracker.cuatro.dev','library.cuatro.dev' | ForEach-Object {
  "{0,-26} {1}" -f $_, ((Resolve-DnsName $_ -Type A -Server 1.1.1.1 -EA 0 | ? IPAddress).IPAddress -join ', ')
}
```

Cloudflare anycast ranges look like `104.16-31.x`, `172.64-71.x`, `162.159.x`, `188.114.x`.
Anything else is an origin address, which means that record is DNS-only.

| Record | Type | Content | Proxied? | Notes |
|---|---|---|---|---|
| | | | | |

## Part 2: on each box

Run everything in this section on **both** OLD and NEW, and keep the two sets of output
separate. The interesting findings are the differences.

### 2a. What is listening

- [ ] Confirm which box you are on before anything else. It is the single easiest mistake to
      make in this whole pass.

```bash
hostname; hostname -I; curl -s ifconfig.me; echo
uname -a; cat /etc/os-release | head -2
```

- [ ] What holds 80 and 443:

```bash
sudo ss -tlnp | grep -E ':(80|443)\b'
```

### 2b. Containers and compose projects

```bash
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
docker compose ls --all
docker network ls
```

- [ ] Record every container, not only the running ones. A stopped container explains a hostname
      that used to resolve.
- [ ] For each compose project, find its file and record the path:

```bash
docker compose ls --all --format json
```

### 2c. What terminates TLS, and how it is configured

The committed `docker-compose.yml` describes a Caddy stack. A Traefik was observed answering on
OLD. Both boxes need this answered independently rather than assumed.

```bash
# Caddy
docker ps --filter ancestor=caddy --format '{{.Names}}'
docker exec <caddy> caddy list-config 2>/dev/null || true
find / -name 'Caddyfile*' -not -path '*/proc/*' 2>/dev/null

# Traefik
docker ps --format '{{.Names}}\t{{.Image}}' | grep -i traefik
find / -name 'traefik*.y*ml' -not -path '*/proc/*' 2>/dev/null
docker inspect $(docker ps -q) --format '{{.Name}} {{json .Config.Labels}}' | grep -i traefik

# Nginx, in case a third thing is involved
docker ps --format '{{.Names}}\t{{.Image}}' | grep -i nginx
nginx -T 2>/dev/null | head -50
```

- [ ] **Find the ACME client.** This is the question AD-26 makes load-bearing: something is
      issuing real Let's Encrypt certificates for the three NEW hostnames, and Story 1.3 has to
      disable it before installing the Origin CA certificate, or two issuers will fight over the
      same hostname.

```bash
find / -name 'acme.json' -o -name 'acme*.json' 2>/dev/null | grep -v proc
ls -la /data/caddy/certificates 2>/dev/null
docker volume ls
crontab -l; sudo crontab -l
ls -la /etc/letsencrypt/live 2>/dev/null
systemctl list-timers --all | grep -iE 'cert|acme|renew'
```

### 2d. Anything outside Docker

```bash
systemctl list-units --type=service --state=running | grep -viE 'systemd|dbus|cron|ssh|network'
sudo iptables -t nat -L -n 2>/dev/null | head -30
ls -la /etc/nginx/sites-enabled 2>/dev/null
```

- [ ] Cloudflare Tunnel is a real possibility for how three hostnames reach a box with no
      matching proxy config. Check for it explicitly:

```bash
ps aux | grep -i cloudflared | grep -v grep
systemctl status cloudflared 2>/dev/null
```

## Part 3: the specific open questions

These are the things this pass exists to answer. Each one blocks something.

- [ ] **What is actually serving on OLD?** A Traefik answers 443 with a self-signed default
      certificate and `/api/health` returns 404. Is the committed Caddy stack running at all? Is
      the Hub container up, down, or absent? Blocks Story 1.21.
- [ ] **What issues the Let's Encrypt certificates on NEW?** Blocks Story 1.3's Origin CA step
      under AD-26.
- [ ] **Where does `SERVER_HOST` point?** It is an opaque GitHub Actions secret and
      `deploy.yml:11` deploys to it on every push to `main`. If it is OLD, the next merge to
      `main` deploys into the broken box. Blocks Story 1.9 and is worth knowing today.
- [ ] **How do the three NEW hostnames reach their applications?** They appear in no committed
      proxy config anywhere. This is forced change C-9 and it is why this story exists.
- [ ] **Does anything on OLD have state that is not on NEW?** Umami's Postgres volume is the
      known case. Blocks the irreversible step in Story 1.21.
- [ ] **Is there a hostname on either box that resolves from nowhere in the zone?** Record it
      rather than dropping it.

## Part 4: what the record must end up containing

Story 1.7's acceptance, as amended 2026-08-16:

- [ ] One row per hostname per resolving address: hostname, serving address, what terminates
      TLS, what serves it, the container or process behind it, the port.
- [ ] Proxied or DNS-only marked per record.
- [ ] `www.cuatro.dev` accounted for.
- [ ] Per address, what is actually running there and how each hostname reaches it.
- [ ] Which configurations exist **only on a box** and in no repository. That set is exactly what
      Story 1.21 and Epic 4 must recreate.
- [ ] Each hostname recorded against the application id it serves (AD-3), giving Epic 2 its
      Registry `live` values and Epic 4 its router definitions.
- [ ] A plain statement that the pass was read-only and changed nothing.

| Hostname | Address | Terminates TLS | Serves it | Container / process | Port | Only on the box? |
|---|---|---|---|---|---|---|
| | | | | | | |
