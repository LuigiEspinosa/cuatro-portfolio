---
title: 'Restore cuatro.dev by completing the move onto the Hostinger VPS'
type: 'feature'
created: '2026-08-17'
status: 'done'
baseline_commit: '6737a1abe7b8012d3253476c3c2b304a1ff0189a'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/ops/monitoring.md'
  - '{project-root}/ops/routing-inventory-checklist.md'
operator_actions:
  - 'DONE 2026-08-17, by agent. Cloudflare DNS: `cuatro.dev`, `analytics.cuatro.dev` and `www.cuatro.dev` all repointed to 177.7.52.248, DNS-only, TTL 60. Performed with a zone-scoped API token the Operator supplied. REVOKE THAT TOKEN now that the cutover is confirmed.'
  - 'DONE 2026-08-17, by agent. Umami site created (website id b5e26621-88fa-4746-98a0-f045a131163c) and the Hub image rebuilt with it baked in. Tracking script verified in the rendered payload.'
  - 'DONE 2026-08-17, by Operator. `SERVER_HOST` repointed at 177.7.52.248. This makes the next merge to `main` a real deploy, which is why the merge order below is now load-bearing.'
  - 'DONE 2026-08-17, by Operator. Umami admin password changed to one the Operator chose. The agent-written `/home/deploy/cuatro-portfolio/.umami-admin` was shredded from the box on the same date; the website id it also held is still in `.env.production`.'
  - 'DECIDED 2026-08-17, not outstanding. The Cloudflare zone-edit token is RETAINED at the Operator''s instruction, kept in the local gitignored `.env` as `CLOUDFLARE_TOKEN` for future estate work. It is a standing credential that can rewrite the apex A record, so it is recorded in `ops/routing-inventory.md` as a live credential rather than left implicit. This supersedes the revoke instruction in the deferred-work ledger.'
  - 'ORDERING, spans the epic. `main` is not merged until Epic 1 completes, which is the Operator''s standing policy. Until then `origin/main` carries the pre-move compose file, whose `caddy` service publishes 80 and 443 and whose services are named `app`, `db` and `umami`. Any deploy from that commit would reset the box onto it and contend for the ports `cs-tracker-caddy-1` holds, taking the whole estate down rather than only the Anchor. Nothing deploys while nothing reaches `main`, so the standing risk is an accidental direct push, not the normal flow.'
deferred:
  - summary: 'Two containers answer to `app` on the shared ingress network; cs-tracker.cuatro.dev proxies app:4000. Pre-existing.'
    location: 'cuatro-tracker repository'
    severity: high
  - summary: 'Every hostname depends on a Caddyfile inside another project git checkout, where a reset --hard would erase it.'
    location: '/home/deploy/cs-tracker/Caddyfile'
    severity: high
  - summary: 'No test observes the serialized /api/health body or the rendered tracking script, and no job reads monitor configuration.'
    location: 'app/api/health/__tests__/route.test.ts, .github/workflows/ci.yml'
    severity: high
  - summary: 'docker/Caddyfile mirrors the serving config with nothing comparing the two, so drift is invisible.'
    location: 'docker/Caddyfile'
    severity: medium
  - summary: 'The Cloudflare zone-edit token created for this cutover must be revoked and is tracked only in a DONE frontmatter line.'
    location: 'Cloudflare account'
    severity: medium
  - summary: 'analytics.cuatro.dev is unmonitored while SM-1 to SM-3 now depend entirely on it with no historical baseline.'
    location: 'ops/monitoring.md'
    severity: medium
  - summary: 'The www monitor asserts a 301 status but cannot see the Location header, so a wrong target or a loop reads UP.'
    location: 'ops/monitoring.md'
    severity: medium
  - summary: 'No host in the estate sends Strict-Transport-Security; deliberately not added here under AD-20.'
    location: 'docker/Caddyfile'
    severity: medium
  - summary: 'The three moved hostnames have no AAAA record; IPv6 serving could not be verified from the executing session.'
    location: 'Cloudflare zone cuatro.dev'
    severity: low
  - summary: 'AGENTS.md context block is stale on the deployment model and the test count; a /bmad-project-context refresh item.'
    location: 'AGENTS.md'
    severity: low
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** `cuatro.dev` has not served the Anchor since at least 2026-08-16. It resolves to 95.216.143.251, a host the Operator states no longer exists, where something answers 443 with a self-signed `CN=TRAEFIK DEFAULT CERT` and 404s `/api/health`. NFR-2 is in breach on the one hostname FR-18 and SM-6 are measured on, and the deploy workflow still pushes every merge to `main` at that address.

**Approach:** Complete the move onto the Hostinger VPS (177.7.52.248), where the estate's other three hostnames already serve. That box runs one shared Caddy owning ports 80 and 443, with sibling stacks attached to its network under aliases. The Anchor becomes the third sibling: the committed compose file drops its own Caddy, the Hub and Umami join the shared network with no published ports, and the shared Caddyfile gains site blocks for the apex, `www` and analytics. Umami starts empty and the discarded history is recorded as a deliberate drop.

## Boundaries & Constraints

**Always:**
- The three live Satellite hostnames (`cs-tracker`, `tracker`, `library`) serve throughout. They sit behind the same Caddy this story edits, so every change to that file is backed up and validated before reload, and all three are re-verified immediately after.
- The apex is canonical. `www.cuatro.dev` redirects to it with a 301 and never serves a duplicate.
- Acceptance is measured by a client performing full certificate validation. A result obtained with validation disabled is evidence about what is behind the certificate, never evidence that the host serves.
- DNS records for the three moved hostnames are DNS-only, proxy off. Caddy issues via HTTP-01 on this box, which a proxied record breaks.
- Decided state is never written as observed state (NFR-9). The old address's fate is the Operator's statement, and what an external probe still sees from it is recorded beside it rather than in place of it.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash, and no emoji.
- The commit is a subject line only, with no body and no trailer.

**Ask First:**
- Before reloading the shared Caddy, and before any step whose failure mode reaches `cs-tracker.cuatro.dev`, `tracker.cuatro.dev` or `library.cuatro.dev`. Those three are live and are not this story's to risk unattended.
- If Let's Encrypt fails to issue for any of the three new hostnames after DNS is confirmed correct. Retrying into a rate limit is worse than stopping.

**Never:**
- Never run a second Caddy, Traefik or any other process binding 80 or 443 on the box. `cs-tracker-caddy-1` is the sole ingress and publishing a competing port is the exact failure that took `cuatro.dev` down.
- Never add a `ports:` mapping to the Hub, Umami or Postgres. Ingress is Caddy only.
- Never switch any record to proxied, install an Origin CA certificate, or disable an ACME client. That is Story 1.3 under AD-26, and doing it here breaks issuance for hosts that have no certificate yet.
- Never edit the `bmad:context` block in `AGENTS.md` by hand. Its "one Hetzner box" line is corrected by a `/bmad-project-context` refresh.
- Never fix the build-on-the-box deploy. It is a known AD-8 violation tracked in Story 1-9 and retired in Epic 3.
- Never write `sprint-status.yaml`, and never touch `contracts/` or `content/projects.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Anchor serves | `GET https://cuatro.dev/api/health`, validating client | 200, body contains `"status":"ok"` | N/A |
| Front door serves | `GET https://cuatro.dev/`, validating client | 200, the Hub renders | N/A |
| www canonicalises | `GET https://www.cuatro.dev/some/path` | 301 to `https://cuatro.dev/some/path` | N/A |
| Analytics serves | `GET https://analytics.cuatro.dev/` | 200, Umami login | N/A |
| Record still proxied | Caddy asks for a certificate while the record is proxied | HTTP-01 fails, host has no certificate | Stop. Set the record DNS-only and retry; do not loop into a rate limit |
| Bad Caddyfile | `caddy validate` fails, or a reload errors | Reload refused, previous config still serving | Restore the backup, reload, re-verify all live hosts, then diagnose |
| Deploy to an unprepared host | `deploy.yml` runs against a box without `~/cuatro-portfolio` | `cd` exits non-zero, job fails loudly | Deliberate. A deploy that cannot find its checkout must fail, not half-succeed |

</frozen-after-approval>

## Code Map

Enumerated live over SSH on 2026-08-17 as `deploy@177.7.52.248`, read-only. This is observation, not inference from committed files.

- **The box, 177.7.52.248** (`srv1842312`, Ubuntu 24.04.4, 2 vCPU, 7.9 GB, 96 GB with 76 GB free). `deploy` is in `docker` and `sudo` with passwordless sudo. Three compose projects live under `/home/deploy/`: `cs-tracker`, `cuatro-tracker`, `digital-library`. There is no `~/projects` directory, which is why `deploy.yml`'s `cd ~/projects/cuatro-portfolio` proves the secret does not point here.
- **`cs-tracker-caddy-1` is the sole ingress.** Only container publishing `0.0.0.0:80` and `0.0.0.0:443`. Config is `/home/deploy/cs-tracker/Caddyfile`, mounted read-only. Certificates are Let's Encrypt via HTTP-01 in the `cs-tracker_caddy_data` volume, one directory per hostname. Backups already exist beside it as `Caddyfile.bak-ops1` and `Caddyfile.bak-library-`, so `.bak-<story>` is the established convention.
- **The sibling pattern, already used twice.** `cuatro-tracker` and `digital-library` publish no ports and attach their app containers to the external network `cs-tracker_default` under stable aliases (`cuatro-app`, `library-api`, `library-web`), which the shared Caddyfile reverse-proxies by name. Their aliases live in git-ignored, box-only `docker-compose.override.yml` files. The Anchor is the third sibling and follows the same shape.
- `docker-compose.yml`: **the file that must change.** Its `caddy` service publishes 80 and 443, which cannot bind on this box. Drop that service and its two volumes, attach `app` and `umami` to the shared network under aliases, keep `db` internal only.
- `docker/Caddyfile:1-7`: routes `cuatro.dev` and `analytics.cuatro.dev` for a Caddy this story stops running. Becomes the site-block fragment that is installed into the shared Caddyfile, so the repository describes the running system instead of a stack that does not exist.
- `.github/workflows/deploy.yml:11,18`: step named "Deploy to Hetzner" against an opaque `SERVER_HOST`, then `cd ~/projects/cuatro-portfolio`. Both are wrong for this box. The `docker compose up --build -d` on line 20 is the tracked AD-8 violation and stays.
- `docker/Dockerfile:13-16`: `NEXT_PUBLIC_UMAMI_WEBSITE_ID` is a build ARG baked at build time. A fresh Umami mints a new website id, so the image must be rebuilt after the id exists. This is a two-pass deploy and the single easiest thing to get wrong.
- `app/api/health/route.ts:5-11`: returns compact JSON containing `"status":"ok"`, the substring UptimeRobot monitor 803750027 asserts.
- `ops/monitoring.md`: observed-state section dated 2026-08-16 and now stale. Carries the exactly-once `AD-17a status:` line, which this story does not touch: it is Story 1.3's to flip.
- `ops/routing-inventory-checklist.md`: Story 1.7's method file. Part 1 (DNS) is complete; Part 2 (on-box) is answered for this box by the enumeration above.
- Read-only planning sources: `epics.md:1056-1128` (Story 1.21), `ARCHITECTURE-SPINE.md:196` (AD-20), `:233` (AD-26), `:124` (AD-8).

**Live state re-verified 2026-08-17.** `cuatro.dev` and `analytics.cuatro.dev` still resolve to 95.216.143.251 and still fail validation behind a Traefik default certificate, now reissued `notBefore 2026-08-16T14:52:20Z`. `www.cuatro.dev` resolves to Cloudflare anycast (proxied) and 404s. `n8n.cuatro.dev` no longer resolves at all, so the record recorded on 2026-08-16 is gone and its open questions close with it. The three Satellites are healthy.

## Tasks & Acceptance

**Execution:**

Repository:
- [x] `docker/Dockerfile` and `docker-compose.yml`: pass `NEXT_PUBLIC_UMAMI_URL` as a build arg alongside the website id. **Added during execution, not planned.** `app/layout.tsx:59` renders the tracking script only when both values are set, Next inlines `NEXT_PUBLIC_*` at build time, and only the id was ever passed, so the script had never rendered and the analytics half of this story could not have been satisfied without it.
- [x] `docker-compose.yml`: remove the `caddy` service and the `caddy_data` / `caddy_config` volumes; set `name: cuatro-portfolio`; attach `app` and `umami` to an external `cs-tracker_default` network under aliases `anchor-app` and `anchor-umami`; leave `db` off that network. The box's sole ingress already owns 80 and 443, and a second binder is what broke the Anchor.
- [x] `docker/Caddyfile`: replace the standalone-Caddy config with the site-block fragment installed into the shared Caddyfile, meaning apex proxying `anchor-app:3000`, `www` redirecting 301 to the apex, analytics proxying `anchor-umami:3000`, and security headers matching the `tracker.cuatro.dev` block. The repository then carries the routing that is actually deployed.
- [x] `.github/workflows/deploy.yml`: rename the step to name the host honestly rather than a provider the repository cannot verify, and correct the checkout path to `~/cuatro-portfolio`, so a deploy that cannot find its checkout fails loudly instead of half-succeeding.
- [x] `.env.example`: document that `NEXT_PUBLIC_UMAMI_WEBSITE_ID` is baked at build time and must be set before the image is built, not after.

Cutover on the box, in this order:
- [x] Clone the repository to `/home/deploy/cuatro-portfolio` and write `.env.production` with a fresh `POSTGRES_PASSWORD` and `UMAMI_APP_SECRET`. Bring the stack up with `NEXT_PUBLIC_UMAMI_WEBSITE_ID` empty and verify `app` answers `/api/health` on the internal network, before any hostname points here.
- [x] **Operator:** repoint the three DNS records, DNS-only. Confirm from outside before continuing.
- [x] Back up `/home/deploy/cs-tracker/Caddyfile` as `Caddyfile.bak-1-21`, append the fragment, `caddy validate`, then reload. Re-verify all three Satellites immediately; restore the backup if any regressed.
- [x] Confirm Let's Encrypt issued for all three new hostnames, then verify the matrix above from a validating client.
- [x] **Operator:** create the Umami site and hand back the website id. Rebuild the image with it set, redeploy, and confirm the tracking script loads on the Hub.
- [x] **Operator:** repoint `SERVER_HOST`. Done 2026-08-17. The merge-order constraint this creates is recorded in `ops/routing-inventory.md`.

Records:
- [x] `ops/routing-inventory.md`: create it from the enumeration above, carrying one row per hostname per address with what terminates TLS, the container behind it and the port; where `SERVER_HOST` points and what it was repointed to; the old address recorded as the Operator's statement with the contradicting external observation beside it; and what is configured only on the box and in no repository. Note that Story 1.7 completes and verifies the rest rather than claiming this story finished it.
- [x] `ops/monitoring.md`: re-gather and re-date the observed-state section after cutover, add the `www.cuatro.dev` probe row asserting the 301 rather than a 200, and record the discarded Umami history as a deliberate drop with today's date. Leave the `AD-17a status:` line alone.
- [x] UptimeRobot: add the `www.cuatro.dev` monitor so the monitored set stays every live `cuatro.dev` subdomain, and record its id in the monitors table.

**Acceptance Criteria:**
- Given the Anchor served nothing on 2026-08-17, when the move completes, then `cuatro.dev` presents a publicly trusted certificate and both `/` and `/api/health` satisfy the matrix above for a validating client.
- Given `analytics.cuatro.dev` shares one compose stack with the Hub, when the move completes, then it moves in the same step, and the reading of AD-20 that treats one compose stack as one deploy unit is written down rather than assumed.
- Given the Umami history was not recoverable because the box holding it is gone, when the record is read, then the loss is a dated deliberate drop naming what depended on it, not a silence.
- Given three live Satellites sit behind the Caddy this story edits, when the work is finished, then each still returns its own application, and any interruption to them is a defect in this story.
- Given `SERVER_HOST` pointed at the box that is gone, when the story closes, then the repointing and the workflow's corrected step name are both recorded in `ops/routing-inventory.md`, so no later story guesses which host a deploy reaches.

## Spec Change Log

### Execution incidents, 2026-08-17

Two defects were introduced by this story's own execution and corrected inside it. Both are recorded because the acceptance criteria say an interruption to a live host is a defect in this story, and because a fix nobody wrote down is a fix that gets undone.

**1. Name collision on the shared ingress network, 07:39Z to 07:46Z.** The Anchor's stack was first brought up with services named `app`, `db` and `umami`. Compose gives a service its own name as a DNS alias on every network it joins, so joining `cs-tracker_default` took second leases on names three other stacks already used. `app` then resolved to the Anchor's container as well as cs-tracker's, and cs-tracker's Caddyfile reverse-proxies `app:4000`, which the Anchor does not listen on. The Anchor's own Umami separately resolved `db` to `cs-tracker-db-1` and failed authentication with `28P01`, which is how the collision was found. Sampled checks of the three Satellites returned their normal status codes throughout, but requests steered to the wrong container would have failed, so **no claim is made that the impact was zero**. Corrected by removing the stack from the network, renaming every service `anchor-*`, and pinning the reason in `docker-compose.yml` so it cannot be reintroduced.

**2. Umami shipped with a live default credential on a public host.** The image's default `admin` / `umami` login authenticated successfully from the public internet from the moment DNS pointed at the box. The exposure window was roughly 07:52Z to 08:20Z. It was made worse before it was fixed: an endpoint-discovery probe sent a real password-change payload rather than an inert one, so it changed the password to the probe string instead of merely reporting that the route existed. The password was then rotated to a generated value, both the default and the probe string were verified rejected, and the credential was written to `/home/deploy/cuatro-portfolio/.umami-admin` at mode 600. **Nothing but an empty analytics instance sat behind it**, and no data existed to take. The Operator still owns changing it to a password of their choosing.

**The lesson worth keeping from the second one:** a probe that writes is not a probe. Discovery against an authenticated API should send a payload that cannot succeed, or should read a route listing, never a well-formed mutation.

**Post-incident audit of the Umami exposure, completed 2026-08-17.** A password rotation does
not undo persistence, so the database was read directly rather than through the API: one user
(`admin`, created 07:50:20Z, last updated 08:09:17Z by the rotation), one website (the one this
story created), and zero rows in `team`, `team_user`, `share`, `report`, `two_factor_auth`,
`session` and `website_event`. No account, share token or scheduled report was left behind.
**`UMAMI_APP_SECRET` was also rotated**, because Umami signs auth tokens as JWTs with it and a
token minted during the exposure window would otherwise stay valid until expiry regardless of
the new password. Umami was verified serving and the admin login verified working afterwards.

**4. Findings from the review layers that were fixed in place.** The deploy workflow gained
`--remove-orphans` (without it, a redeploy on a host holding the pre-rename containers leaves
the old Caddy binding 80 and 443, which is the original outage), `set -euo pipefail` and a
`reset --hard` instead of a `pull`. A `.dockerignore` was added because `COPY . .` was pulling
`.env.production` and `.umami-admin` into the builder layer. `.umami-admin` was added to
`.gitignore`. The Umami build args became `${VAR:?}` so an unset value fails the build rather
than silently producing a site that measures nothing. `anchor-app` gained a healthcheck, and
`anchor-db`'s retry budget was widened because the deploy builds Next on the same two cores
that Postgres initialises on.

**3. The tracking script had never rendered.** Not introduced here, but found here. `app/layout.tsx:59` requires both `NEXT_PUBLIC_UMAMI_WEBSITE_ID` and `NEXT_PUBLIC_UMAMI_URL`, Next inlines `NEXT_PUBLIC_*` at build time, and `docker/Dockerfile` declared a build ARG for only the first. Analytics could not have worked on any previous deploy. Both are now passed, and the rendered payload was verified to carry the script URL and the website id.

## Design Notes

**Why the committed compose file is the load-bearing change.** The sprint change proposal's sharpest finding was that the repository's deployment configuration does not describe the running system. That is fixable here rather than deferrable: the Anchor's compose file describes a standalone Caddy stack that cannot run on the box it is moving to, because `cs-tracker-caddy-1` already holds 80 and 443. The two applications that moved before it solved this with box-only, git-ignored overrides, which works but leaves the repository still describing a fiction. Committing the external network and the aliases instead makes the topology visible in the repository and makes `docker compose up` fail loudly on a box where that network is absent, which is the correct failure.

**The ordering that actually matters.** Caddy obtains a certificate over HTTP-01 the first time a site block is asked for, which requires the hostname to already resolve to this box and to not be proxied. So the sequence is: stack up and verified internally, then DNS, then the Caddyfile edit and reload. Doing the Caddyfile first means three site blocks failing issuance against a live rate limit. `www.cuatro.dev` is the trap, because it is proxied today and looks like it is already ours.

**The Umami website id is a two-pass deploy.** The id is a build ARG, so it is baked into the image. A fresh Umami cannot mint an id until it is serving, and it cannot serve until the stack is up. The first build therefore ships with the id empty and the second build is the real one. Skipping the second pass produces a site that looks healthy and measures nothing, which is the failure SM-1 through SM-3 would discover months later.

**What this story deliberately does not close.** The old address is recorded, not decommissioned: the Operator states the box is gone, while an external probe on 2026-08-17 still gets a reissued Traefik certificate from it. Both go in the record, marked for what they are. Once DNS moves, nothing of the estate's points there, which is what the acceptance actually needs.

## Verification

**Commands:**
- `docker compose config` on the box. Expected: no `ports:` on any service, `cs-tracker_default` present as external.
- `docker exec cs-tracker-caddy-1 caddy validate --config /etc/caddy/Caddyfile`. Expected: valid. Run before every reload.
- `curl -sS -o /dev/null -w '%{http_code}' https://cuatro.dev/api/health` and `curl -sS https://cuatro.dev/api/health`, validation on. Expected: 200, body containing `"status":"ok"`.
- `curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' https://www.cuatro.dev/foo`. Expected: `301 https://cuatro.dev/foo`.
- `openssl s_client -connect cuatro.dev:443 -servername cuatro.dev`. Expected: issuer Let's Encrypt, not `TRAEFIK DEFAULT CERT`.
- The three Satellites, before and after every Caddy reload. Expected: unchanged status codes (302, 307, 302).
- `corepack pnpm typecheck` and `corepack pnpm test --run`. Expected: pass. No TypeScript changes, so this only confirms nothing else was disturbed.
- Punctuation sweep over every file this story writes, using regex escapes rather than literal characters. Expected: no match, checked against a positive control so it cannot pass vacuously.

**Manual checks:**
- The Hub renders in a browser at `https://cuatro.dev` with no certificate warning.
- The Umami tracking script loads on the Hub with a non-empty website id, and a page view appears in the Umami dashboard.
- `ops/monitoring.md` carries exactly one `AD-17a status:` line and it still reads `not-satisfied`.

## Suggested Review Order

**The one change everything else rests on: the Anchor stops being a host and becomes a tenant**

- Why every service is named `anchor-*`. This is the whole story in one comment.
  [`docker-compose.yml:14`](../../docker-compose.yml#L14)

- No Caddy, no ports, joined to another stack's network by declaration rather than a hidden override.
  [`docker-compose.yml:113`](../../docker-compose.yml#L113)

- The database is the one service kept off the shared network.
  [`docker-compose.yml:73`](../../docker-compose.yml#L73)

- The site blocks installed into the shared Caddyfile, mirrored here so the repo describes reality.
  [`Caddyfile:33`](../../docker/Caddyfile#L33)

**Failure modes that are silent by construction, each now made loud**

- Next binds to `$HOSTNAME`, not loopback, so a 127.0.0.1 probe calls a healthy container sick.
  [`docker-compose.yml:43`](../../docker-compose.yml#L43)

- `:?` on the build args. An unset value used to ship a site that served fine and measured nothing.
  [`docker-compose.yml:33`](../../docker-compose.yml#L33)

- `--remove-orphans` is the guard against a surviving old Caddy rebinding 80 and 443.
  [`deploy.yml:14`](../../.github/workflows/deploy.yml#L14)

- Postgres health gates Umami, sized for a Next build competing for the same two cores.
  [`docker-compose.yml:92`](../../docker-compose.yml#L92)

**The monitor that was reporting the opposite of the truth**

- Alerted when the health string was present. It would have gone green the moment the Anchor broke.
  [`monitoring.md:60`](../../ops/monitoring.md#L60)

- Re-gathered observed state: six hostnames, one address, every certificate publicly trusted.
  [`monitoring.md:324`](../../ops/monitoring.md#L324)

- Truncation convention, stated because the previous gathering had none and drifted.
  [`monitoring.md:347`](../../ops/monitoring.md#L347)

- The discarded Umami history, dated and costed rather than silently absent.
  [`monitoring.md:369`](../../ops/monitoring.md#L369)

**The record a rebuild will need**

- What terminates TLS, and the HTTP-01 finding that unblocks Story 1.3's Origin CA step.
  [`routing-inventory.md:63`](../../ops/routing-inventory.md#L63)

- Two containers already answer to `app`. Pre-existing, and the reason for the naming rule above.
  [`routing-inventory.md:83`](../../ops/routing-inventory.md#L83)

- Where the deploy actually goes, and the one thing still outstanding.
  [`routing-inventory.md:103`](../../ops/routing-inventory.md#L103)

- The Operator's statement and the contradicting probe, recorded side by side rather than resolved.
  [`routing-inventory.md:116`](../../ops/routing-inventory.md#L116)

- Config that exists only on the box, which is what a rebuild must recreate.
  [`routing-inventory.md:137`](../../ops/routing-inventory.md#L137)

**Peripherals**

- Secrets were being copied into the builder layer on every deploy.
  [`.dockerignore:1`](../../.dockerignore#L1)

- Both Umami variables are build-time, and only one was ever passed.
  [`Dockerfile:13`](../../docker/Dockerfile#L13)

- The documented local Docker workflow no longer exists; production compose cannot run locally.
  [`README.md:32`](../../README.md#L32)
