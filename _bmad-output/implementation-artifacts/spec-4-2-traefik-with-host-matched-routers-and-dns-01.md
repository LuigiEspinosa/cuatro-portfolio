---
title: 'Story 4-2: Traefik with Host-matched routers and DNS-01'
type: 'feature'
created: '2026-09-30'
status: 'awaiting-operator'
baseline_commit: 'f8319a80a5406923b254312b045bc264bd763d26'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/ops/settled-inputs-refresh.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** Epic 4 moves every hostname off the hand-grown shared Caddy, and nothing exists yet to move them onto: no Traefik definition, no Host-matched routers, no dashboard guard, and no DNS-01 capability for the day a host leaves the Cloudflare proxy (AD-7, AD-26).

**Approach:** Commit a Traefik v3.7.13 stack under `ops/traefik/` that runs beside Caddy on 8443 (Story 4.1's decided mechanism), routes all eight box hostnames by `Host` to the same `cs-tracker_default` aliases Caddy uses, serves the box's existing Origin CA certificate, guards the dashboard with basic auth on a loopback-only entrypoint, and carries a Cloudflare DNS-01 resolver exercised only by a scratch hostname with no DNS record. Prove it locally in Docker, hold it with a Vitest suite, and write `ops/traefik-cutover.md` for the Operator's box half. No hostname moves in this story.

## Boundaries & Constraints

**Always:** every router's rule begins with exactly one `Host(...)`; a `PathPrefix` appears only to split one hostname between its own application's containers (library); secrets reach Traefik only from a gitignored `ops/traefik/.env` on the box; the proof quotes real output; box-side steps are Operator items with exact commands.

**Never:** write to the box; publish 80 or 443; mount the Docker socket; run ACME for a proxied hostname; commit a token, hash or key; weaken a gate; touch `contracts/`; move a hostname (Origin Rules are Stories 4.3 and 4.6 to 4.10).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Routed host | `Host: <each of the eight>` on 8443 | reaches that host's upstream | N/A |
| www | `Host: www.cuatro.dev`, `/p?q=1` | 301 to `https://cuatro.dev/p?q=1` | N/A |
| library split | `/api/x`, `/files/x`, `/` | api, api, web | N/A |
| Unknown host | `Host: nope.cuatro.dev` | 404 from Traefik | N/A |
| Dashboard | loopback `:8080`, no credentials / with | 401 / 200 | never on 8443 |
| No token | DNS-01 resolver without `CF_DNS_API_TOKEN` | Traefik still serves every router; issuance error logged | proof is an Operator item |

</frozen-after-approval>

## Code Map

- `docker-compose.yml`: Anchor stack; joins `cs-tracker_default` as `anchor-app`, `anchor-umami`, `tracker`/`cuatro-app`, `tournament`. Not edited: `docker/__tests__/compose.test.ts` forbids published ports there, and Traefik publishes 8443.
- `docker/Caddyfile`: Anchor's fragment no process reads; source of the house header set. Not edited.
- `ops/routing-inventory.md` § Every hostname in the zone (the table the test parses), § The site blocks, as installed (upstreams, headers, www 301, library split), § The shared network (aliases). The table lacks `tournament.cuatro.dev`, placed 2026-09-30 (§ What Story 3-7 changes): add its row, dated.
- `ops/settled-inputs-refresh.md` § Decision: how NFR-2 holds on one 80/443 pair: 8443 beside Caddy, one Origin Rule per hostname, firewall and token prerequisites.
- `ops/tracker-cutover.md`: runbook shape to copy (preconditions, sequence, rollback, Pending Operator actions table).
- `ops/monitoring.md` § The certificate rule: Rule 1 issuer per host, Rule 2 unconfigured; Traefik's renewal trigger question (DW-153).
- `ops/__tests__/capacity-gate.test.ts`, `docker/__tests__/compose.test.ts`: test shape; no YAML parser is installed, so files are read as indented text (precedent).
- Box, read-only 2026-09-30T09:45Z: eight `tls /data/origin-ca/origin.pem /data/origin-ca/origin.key` lines; `/data` is volume `cs-tracker_caddy_data`; Docker 29.6.2, Compose 5.3.1; `/usr/local/sbin/cf-origin-firewall.sh` matches `--dports 80,443`.

## Tasks & Acceptance

**Execution:**
- [x] `ops/traefik/compose.yml`: project `traefik`, image `traefik:v3.7.13`, publishes `8443:8443` and `127.0.0.1:8080:8080`, joins external `cs-tracker_default`, mounts the static file, the `dynamic/` directory, `cs-tracker_caddy_data` subpath `origin-ca` read-only, and named volume `acme`; `env_file: .env`; ping healthcheck; no socket.
- [x] `ops/traefik/traefik.yml`: entrypoints `websecure` :8443, `traefik` :8080, `ping`; file provider on `dynamic/` with watch; `api.dashboard` true, insecure false; resolver `cloudflare` (DNS-01, storage `/acme/acme.json`).
- [x] `ops/traefik/dynamic/routes.yml`: one router per hostname, the Origin CA as default certificate, header middlewares as Caddy's, www redirect, library api router, dashboard router with basic auth from `{{ env }}`, scratch router `dns01-probe.scratch.cuatro.dev` on the resolver.
- [x] `ops/__tests__/traefik-config.test.ts`: inventory hostnames equal router hosts (plus the scratch host, which is absent from the zone); every rule starts with `Host`; `PathPrefix` only inside a host that also has a Host-only router; dashboard only on `traefik` with basic auth; resolver only on the scratch router; no secret literal in any file under `ops/traefik/`; `.env` ignored.
- [x] `ops/routing-inventory.md`: dated `tournament.cuatro.dev` row.
- [x] `ops/traefik-cutover.md`: the runbook.
- [x] board and ledger: `4-2` awaiting-operator with dated comment; DW for any consequence.

**Acceptance Criteria:**
- Given the local proof stack, when curl sends each hostname's Host header to 8443, then a whoami stand-in behind that alias answers, and the output is quoted in Implementation Notes.
- Given the dashboard, when requested without and with credentials on 8080, then 401 and 200; and on 8443 it is 404.
- Given the full suite, typecheck and Hub build, when run, then green.

## Implementation Notes

- Files: `ops/traefik/compose.yml`, `ops/traefik/traefik.yml`, `ops/traefik/dynamic/routes.yml`, `ops/__tests__/traefik-config.test.ts` (19 cases), `ops/traefik-cutover.md`; a dated `tournament.cuatro.dev` row in `ops/routing-inventory.md`; a dated renewal amendment in `ops/monitoring.md`; DW-296 (4.11 keeps the certificate volume) and DW-297 (60 s default `readTimeout`).
- **Local proof, 2026-09-30T09:58:47Z**, committed files, throwaway stand-ins, Let's Encrypt production blocked by a scratch `extra_hosts` override; quoted in full in `ops/traefik-cutover.md` § Rehearsed off the box. Excerpt: `traefik-traefik-1 traefik:v3.7.13 Up 6 seconds (healthy)`; each of the seven application hosts `200 Name: <its alias>`; `library.cuatro.dev/api/x Name: library-api`, `/books Name: library-web`; `www 301 https://cuatro.dev/some/path?q=1`; `nope.cuatro.dev 404`; `dashboard, no credentials 401`, `credentials 200`, `dashboard on 8443, Host: localhost 404`; `12 routers, statuses: enabled`.
- **Traefik has no check command** (`traefik --help`: `healthcheck`, `version`). Substitutes: a misspelled static key exits 1 with `field not found, node: dashbord`; zero `Error while building configuration`; the routers API; the suite.
- **DNS-01** reached Cloudflare against Let's Encrypt staging and failed only on the throwaway token: `cloudflare: failed to find zone cuatro.dev.: [status code 400] 6003: Invalid request headers; 6111: Invalid format for Authorization header`. Issuance is Operator item (runbook step 7).
- **Surprises.** (1) A one-label scratch name is never issued: `No ACME certificate generation required for domains`, because the default `*.cuatro.dev` certificate covers it; the scratch host is `dns01-probe.scratch.cuatro.dev`. (2) Traefik 3.7 warns until `aliasHeadersStrategy` is set; set to `delete` on every entrypoint. (3) `email` is optional: registration without one succeeded on staging, so none is committed. The first staging run registered one account with `hostmaster@cuatro.dev` before the address was dropped; nothing touched the production directory. (4) `global.checkNewVersion: false`, so the box does not phone home. (5) v3.7.13 still logs one `WRN` at start, `Traefik can reject some encoded characters in the request path` (the v3 encoded-characters defaults); `%2F`, `%20`, `%25` and `%3B` on `library` all answered 200 in the verifier's run, but it is a difference from Caddy to watch as each hostname moves.
- Mutation check of the suite: wheel as an apex `PathPrefix` (2 fail), a resolver on `cs-tracker` (1 fail), the dashboard on `websecure` (1 fail), a committed `$apr1$` hash (2 fail); restored, 19 pass.
- **Renewal, forced, 2026-09-30T10:20Z to 10:27Z**: Pebble issuing 22 minute certificates (both `profiles.default` and `profiles.shortlived` at `validityPeriod: 1320`), the committed static file with `caServer` at Pebble, `certificatesDuration: 1` and an `exec` DNS provider; logged `Attempt to renew certificates "20m0s" before expiry and check every "1m0s"`, then `Renewing ACME certificate` at 10:23:13Z and 10:26:13Z, and the served certificate went from serial `5FF6F62A70D4485D` (notBefore 10:20:17) to `7E3C606E3229AE82` (notBefore 10:26:13). Setup and output in `ops/traefik-cutover.md` § Rehearsed off the box, with the rehearsal's re-run commands.
- **Certificate monitoring** departs from the epic's "certificate-age monitoring sees the new certificates": no monitored hostname gets a new certificate and the scratch one is unreachable by design. Raised as Pending action 3 for the Operator to confirm or overrule.
- Every throwaway container, volume, network, `.env` and scratch file removed; `docker ps -a` and `docker volume ls` show none.

## Spec Change Log

## Review Triage Log

Six layers, run inline (no Agent tool in this run): blind hunter (floor 8 at 57.7 kB), edge case hunter with claims check, verification gap, ponytail, ECC verification loop, design review (skipped: no `.scss`, `.tsx` or motion in the diff).

| # | Layer | Finding | Verdict | Route and evidence |
|---|---|---|---|---|
| 1 | blind | A flow-style `tls: {certResolver: ...}` on a proxied router evades `parseRouters`, so AD-26 could break unseen | medium | patch: text count of `certResolver` must be 1; passes |
| 2 | edge | The published-port case reads only quoted `- '...'` lines; an unquoted `- 443:443` passes | medium | patch: text guard on any 80 or 443 mapping; mutation `- 443:443` fails 1 case, restored 19 pass |
| 3 | blind | Runbook step 8 does not amend `routing-inventory.md` and `estate.md`, as `tracker-cutover.md` § After the cutover does | low | patch: step 8 names both amendments |
| 4 | ponytail | `sendAnonymousUsage: false` restates the default | low | patch: deleted; the final static file started, `Stats collection is disabled.`, ping `OK` |
| 5 | ponytail | `export` on two test-local parsers | low | patch: dropped |
| 6 | verification | No CI job starts Traefik; routing and auth are proven once, locally | medium | defer DW-299 (a CI job changes the two suites pinning `ci.yml`; nothing public depends on Traefik until 4.3) |
| 7 | blind | AGENTS.md's `ops/` record count is now one short | low | defer DW-298 (agent-context file) |
| 8 | blind | Traefik `redirectRegex` `permanent` answers 308, not 301, to a non-GET on www | low | reject: a POST to www is not everyday use; GET proven 301 |
| 9 | blind | Default 60 s `readTimeout` differs from Caddy | medium | already DW-297, owner 4.9 |
| 10 | blind | A deploy's `git reset` mid-write could hand Traefik a partial file | maybe-false | reject as low: git writes by rename; would settle by reading Traefik's file-provider error path |
| 11 | blind | `Host(`localhost`)` may not match `localhost:8080` | false | proven 401 and 200 at `http://localhost:8080/dashboard/` |
| 12 | blind | X-Forwarded-For from Cloudflare differs from Caddy | false | neither trusts the edge's header by default; `CF-Connecting-IP` passes through both unchanged |
| 13 | edge | `parseRouters` crashes on a key before any router name | false | loud TypeError fails the suite, which is correct |
| 14 | claims | "exactly as the shared Caddyfile's library block does" | false | `handle /api/*` and `PathPrefix(`/api/`)` both exclude a bare `/api`; `/files/*` likewise |
| 15 | claims | "renewal proven" (epic intent) | medium | first routed as unprovable in one run, which was wrong (independent verifier, 2026-09-30); patched: renewal forced against a throwaway Pebble server, the served certificate replaced twice without a restart (Implementation Notes). Issuance on the box stays step 7 |
| 16 | ECC | Build, types, suite, secret scan | pass | Hub build exit 0; typecheck exit 0; 73 files, 1795 tests pass; lint N/A; no token, hash or PEM in the diff |

## Design Notes

- **Oversized spec, kept.** Measured at step 2 at about 1,950 tokens (7,738 bytes over four), against the 1600 target. The Operator's instruction of 2026-09-30, relayed by the orchestrator: Keep. Answer recorded here per the ruling of 2026-09-24.
- **`ops/traefik/`, not `docker/`.** `docker/` holds the Anchor's image and compose surface, whose suite forbids published ports; Traefik is a box stack the Operator runs by hand, like the capacity sampler's files in `ops/`. The box's `git reset --hard` on deploy updates `dynamic/`, which Traefik watches, so a routing change on `main` goes live on the next deploy: a directory mount, because a single-file bind would keep the old inode.
- **library's split** is a second router under the same `Host`, because a Traefik service cannot hold a path rule: AD-7 forbids `PathPrefix` between applications, and `/api` and `/files` are `digital-library`'s own API container. Decision; the Operator may overrule.
- **Router names** are Registry ids where one exists (`cuatro-portfolio`, `cuatro-tracker`, `cs-tracker`, `digital-library`, `list-wheel`, `cs-tournament`), else `www`, `analytics`.
- **Certificate** from `cs-tracker_caddy_data` subpath `origin-ca`, read-only: the exact file the edge validates today. Story 4.11 must keep that volume or move the files (DW).
- **Plain HTTP** stays on Caddy's :80 redirect: the runbook's Origin Rule expression is `http.host eq "<h>" and ssl`.
- **Renewal.** Traefik renews 30 days before expiry at the default `certificatesDuration` of 2160h (doc table), before two thirds of age at 90, 64 and 45 days; only the scratch certificate renews.
