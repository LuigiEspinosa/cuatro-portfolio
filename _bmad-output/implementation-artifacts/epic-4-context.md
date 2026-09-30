# Epic 4 Context: Greenfield VPS rebuild

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Rebuild the estate's serving layer on the one Hostinger KVM 2 box: Traefik replaces the shared Caddy as the proxy, one PostgreSQL instance replaces the per-project databases, every application deploys by pulling a CI-built image with `docker-rollout`, and the live subdomains keep serving through every step. The epic exists because the incumbent topology grew by hand (one Caddyfile owned by `cs-tracker`, four Postgres containers, a floating Umami tag) and cannot be reproduced from source. Whether the rebuild runs in place or on a temporary second box is not assumed; Story 4.1 decides it from the observed topology.

## Stories

- Story 4.1: Refresh the settled inputs and choose the rebuild topology
- Story 4.2: Traefik with Host-matched routers and DNS-01
- Story 4.3: Migrate `list-wheel`: the static first candidate
- Story 4.4: One Postgres, one database and one role per consumer
- Story 4.5: `pg_dump` on cron plus restic offsite
- Story 4.6: Migrate `cuatro.dev`
- Story 4.7: Migrate `analytics.cuatro.dev` and pin Umami
- Story 4.8: Migrate `tracker.cuatro.dev`
- Story 4.9: Migrate `library.cuatro.dev`
- Story 4.10: Migrate `cs-tracker.cuatro.dev`
- Story 4.11: Retire Caddy and decommission the old topology

## Requirements & Constraints

- Nothing live may break: `cuatro.dev`, `cs-tracker.cuatro.dev`, `tracker.cuatro.dev`, `library.cuatro.dev` and `list-wheel` serve through every step, and no step leaves a broken application.
- The box is 2 vCPU and its ceiling is unproven beyond the measured Capacity Gate threshold (load15 0.60); no step assumes headroom, and the load average wins every conflict with any other metric.
- All-in marginal spend stays within $40 to $100 a month; the box itself is prepaid to 2028-07-19 at $0 marginal.
- One environment, no staging: every CI gate is blocking and CI is the only pre-production check.
- No third-party analytics; Umami is the only measurement and it is self-hosted.
- Backups are verified by a real restore, never by a job exiting zero.

## Technical Decisions

- Each application is one deploy unit: one image, one compose service, one Traefik router matched on `Host`; `PathPrefix` routing between applications is forbidden.
- Images are built in GitHub Actions and pushed to GHCR by git sha; the box pulls a tag and rolls it with `docker-rollout` and never builds. Compose services carry real healthchecks and no `container_name` or published `ports`.
- One Postgres container; one database and one role per consuming application, never schema-per-app; explicit `connection_limit` per role summing under `max_connections`; no PgBouncer. A non-Postgres store is declared in the Registry `tech` array and carries its own offsite backup (`digital-library` is the declared exception).
- Backups: `pg_dump` on cron plus restic offsite; point-in-time recovery stays deferred.
- Migrations run as a discrete step before a rollout, backward-compatible with the version still serving, never on container boot.
- TLS terminates at Cloudflare in Full (strict); the origin presents a Cloudflare Origin CA certificate for `cuatro.dev` and `*.cuatro.dev` and runs no ACME for a proxied host. DNS-01 is proven against a scratch hostname so a host can leave the proxy later; a public certificate is issued before any host leaves the proxy.
- Settled inputs (versions, prices, the observed topology, the adoption probes and the other AD-22 items) are re-checked by a bounded refresh before the epic opens; nothing outside that list re-opens.
- A change that places nothing may ship with others; a placement or a cutover is its own shipped and verified step.
- Third-party infrastructure images are pinned to a major at minimum; Umami's `postgresql-latest` is the one inherited floating tag.

## Cross-Story Dependencies

- Blocked by the routing inventory (`ops/routing-inventory.md`) and by Epic 3's pull-based deploys, both done.
- 4.2 depends on 4.1's topology and mechanism decision; 4.3, 4.4 and 4.6 depend on 4.2; 4.5 on 4.4; 4.7, 4.8 and 4.10 on 4.4 and 4.6; 4.9 on 4.5; 4.11 on 4.3 and 4.6 to 4.10.
- 4.3 also depends on Story 2.25 (`list-wheel` on the box); 4.8 carries DW-275 (per-id deploys for the tracker and the tournament).
- Box-side steps are the Operator's, run from runbooks the stories write.
