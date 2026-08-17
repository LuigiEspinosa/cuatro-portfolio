# Deferred work

Findings surfaced incidentally by a build run, real but not caused by the story that
found them. Append only. Each entry names the spec that surfaced it.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-external-uptime-and-certificate-age-monitoring.md`
  summary: >-
    `cuatro.dev` is not serving the Anchor. It presents a self-signed
    `CN=TRAEFIK DEFAULT CERT` and returns 404 at `/api/health`, so every browser
    gets a TLS error page.
  evidence: |-
    Observed 2026-08-16 from outside the VPS, and independently re-verified in the
    main session by direct TLS handshake. `cuatro.dev` resolves to `95.216.143.251`
    through both the local resolver and `1.1.1.1`. Port 443 completes a handshake
    presenting subject and issuer `CN=TRAEFIK DEFAULT CERT`, notBefore
    2026-08-15T19:21:43Z, notAfter 2027-08-15T19:21:43Z, sole SAN under
    `.traefik.default`, so validation fails for any ordinary client. Behind it,
    `/api/health` returns `404 page not found`. `analytics.cuatro.dev` is on the same
    address with the same certificate. The three satellite hostnames are healthy on
    valid 90-day Let's Encrypt certificates. This violates NFR-2, nothing live may
    break, and it is the Anchor, the one hostname FR-18 and SM-6 are measured on. It
    is not this story's work to fix and this story changed nothing on the box, but
    nothing in the repository will notice it until Story 1.2's Operator actions are
    performed.

    Cause supplied by the Operator on 2026-08-16: the Anchor has not yet been
    migrated to the Hostinger VPS, and bringing `cuatro.dev` back is that migration
    rather than a repair of the current host. The consequence for Story 1.2 is that
    the `cuatro.dev` monitor alerts continuously from the moment it is created until
    the migration lands, which is the condition `ops/monitoring.md` covers under what
    closes the gate: an outage alert is not the induced test alert.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-external-uptime-and-certificate-age-monitoring.md`
  summary: >-
    The estate does not serve from one address, which the AGENTS.md "one Hetzner
    box" framing and Story 1-7's routing enumeration both assume.
  evidence: |-
    Observed 2026-08-16. `cuatro.dev` and `analytics.cuatro.dev` resolve to
    `95.216.143.251`; `cs-tracker.cuatro.dev`, `tracker.cuatro.dev` and
    `library.cuatro.dev` resolve to `177.7.52.248`. The Operator confirmed on
    2026-08-16 that a migration to a Hostinger VPS is in flight: the three satellites
    have moved and the Anchor has not, which is why the two addresses exist and why a
    Traefik is answering ahead of Epic 4. This does not change the monitoring
    decision, since UptimeRobot sits outside both, but three things downstream now
    rest on a stale assumption. Story 1-7 enumerates a routing table that spans two
    addresses and two proxies. Epic 4 plans a Traefik rebuild on a topology that has
    partly happened already, so AD-22's refresh check should re-open it. And the
    AGENTS.md orientation still says "deployed by Docker Compose to one Hetzner box",
    which is no longer true of the estate and is a `/bmad-project-context` refresh
    item rather than an edit to make by hand.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-external-uptime-and-certificate-age-monitoring.md`
  summary: >-
    AD-17a has no mechanical enforcement. The gate exists only as prose in a file
    that no script, workflow or source file reads.
  evidence: |-
    `ops/monitoring.md` is referenced by nothing in the repository except its own
    spec, and `.github/workflows/ci.yml` runs typecheck and vitest only. Stories
    1-10, 1-11, 1-14 and 2.23 are each expected to read one line in that file before
    enabling automation, but a story can add a CI job while the line still reads
    `not-satisfied` and no command in the repository would fail. Either the gate
    needs a check that reads the line, or the epic should state that it is an
    honour-system gate. This is an architectural question spanning several stories,
    not a defect in this record.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-external-uptime-and-certificate-age-monitoring.md`
  summary: >-
    `app/api/health/route.ts` is now a monitored contract, and neither the route nor
    its tests know it.
  evidence: |-
    `ops/monitoring.md` directs the monitor to assert the literal substring
    `"status":"ok"` against the serialized response body. The route's tests at
    `app/api/health/__tests__/route.test.ts:4-8` mock `next/server` so
    `NextResponse.json` becomes `(body) => ({ json: async () => body })`, and the
    assertions inspect the plain object. Serialization is therefore never observed by
    any test. Pretty-printing, an envelope wrapper, or middleware reshaping would
    keep all three tests green while the substring disappears from the wire, and the
    monitor would report the Anchor down while it is healthy. A comment on the route
    and a test asserting the serialized form would close it. Left out of this story
    because its task list is confined to `ops/monitoring.md`.

- source_spec: none, found during the Story 1.7 DNS pass on 2026-08-16
  summary: >-
    Two live applications serve from `cuatro.dev` subdomains and appear nowhere in
    `ops/estate.md`, so the Estate record's fifteen applications is wrong and AD-6's
    "no application is ever dropped by omission" is already breached.
  evidence: |-
    `covidmap.cuatro.dev` and `future-vizion.cuatro.dev` both returned HTTP 200 on
    2026-08-16 with valid single-name Let's Encrypt certificates, served from Vercel
    (`216.198.79.65` and `64.29.17.65`) via `vercel-dns-017.com` CNAMEs. Neither
    appears in `ops/estate.md`'s fifteen-row disposition table, in PRD section 5.1,
    or anywhere in `epics.md`. AD-6 makes Registry membership a property of the
    application, and SM-4 requires every Registry link to resolve, so Epic 2 cannot
    author a complete Registry from an Estate record that omits two live
    applications. Also relevant to SM-7: the repository count of 11 was reconciled
    against a set that did not include these. Either they are Ecosystem applications
    and the record and count are wrong, or they are deliberately outside the Estate
    and that exclusion needs writing down. Story 2-4 confirms assumed statuses and is
    the natural place to land it, but the Estate record is wrong today.

- source_spec: none, found during the Story 1.7 DNS pass on 2026-08-16
  summary: >-
    `n8n.cuatro.dev` resolves to the box being decommissioned, is not in any planning
    artifact, and is the leading suspect for the `cuatro.dev` outage.
  evidence: |-
    The record points at `95.216.143.251`, the old box, and returns 404 behind the
    same `CN=TRAEFIK DEFAULT CERT` that `cuatro.dev` and `analytics.cuatro.dev`
    present. The committed `docker-compose.yml` uses Caddy, not Traefik, and the
    Traefik default certificate was issued 2026-08-15T19:21:43Z, one day before the
    outage was found. n8n is commonly deployed behind Traefik. If an n8n stack bound
    ports 80 and 443 on that box, Caddy could not bind them and the Anchor would fail
    exactly as observed. This is a hypothesis, not a diagnosis: it needs one
    `docker ps` on the box to confirm or kill. Two consequences either way. n8n holds
    workflows and credentials in its own database, and Story 1.21 decommissions that
    box, so its fate is a decision owed before then. And an n8n instance is
    automation running in an estate whose AD-17a gate reads `not-satisfied`, which is
    either a governance gap or evidence that n8n is personal rather than Ecosystem.

- source_spec: none, found during the Story 1.7 DNS pass on 2026-08-16
  summary: >-
    The `cuatro.dev` zone carries several leftovers from previous providers that
    nothing in the plan accounts for.
  evidence: |-
    Four apex NS records point at `ns-cloud-c{1..4}.googledomains.com` while the real
    delegation is `beau`/`demi.ns.cloudflare.com`, so they are vestigial. A proxied
    `_domainconnect` CNAME points at `_domainconnect.domains.squarespace.com`. A TXT
    record carries a ProtonMail verification token while the MX records are Google
    Workspace, so two mail providers are half-configured in one zone. That last one
    is not cosmetic: `luigi@cuatro.dev` is now the UptimeRobot account identity, so
    account recovery and any email fallback depend on that mailbox actually
    receiving. Confirm it receives before relying on it. Certificate Transparency
    also shows retired `pokemon.cuatro.dev` and `api.pokemon.cuatro.dev` names with
    no current DNS record, probably `poketracker-go`.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-21-restore-cuatro-dev-onto-the-hostinger-vps.md`
  summary: >-
    Two containers answer to the DNS name `app` on the shared ingress network, and
    `cs-tracker.cuatro.dev` is reverse-proxied to `app:4000`. Pre-existing, not
    caused by Story 1.21, and a live intermittent-failure risk.
  evidence: |-
    Observed 2026-08-17 on `177.7.52.248`. `getent ahosts app` inside
    `cs-tracker-caddy-1` returns both `172.18.0.3` (`cs-tracker-app-1`) and
    `172.18.0.5` (`cuatro-tracker-app-1`), because Compose gives a service its own
    name as a network alias and both projects call their service `app`. The shared
    Caddyfile's `{$PHX_HOST}` block proxies `app:4000`, and `cuatro-tracker-app-1`
    listens on 3000, so any request Docker's round-robin steers to it cannot
    connect. `cs-tracker.cuatro.dev` was returning its normal 302 throughout, so
    either Caddy's retry masks it or the failure is intermittent; neither is a fix.
    The clean closure is a `cuatro-app`-style rename of `cuatro-tracker`'s service,
    or an explicit unique alias in the shared Caddyfile, in the `cuatro-tracker`
    repository rather than this one. Story 1.21 avoided adding a third claimant by
    naming every Anchor service `anchor-*`, which is pinned in `docker-compose.yml`.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-21-restore-cuatro-dev-onto-the-hostinger-vps.md`
  summary: >-
    Every hostname in the estate depends on a Caddyfile that lives inside another
    project's git checkout, where a routine `git reset --hard` would discard it.
  evidence: |-
    `/home/deploy/cs-tracker/Caddyfile` carries the site blocks for all six live
    hostnames, and it sits in the `cs-tracker` working tree. The sibling projects'
    redeploy scripts run `git fetch && git reset --hard origin/main` in their own
    directories; the same command run in `cs-tracker` would revert every appended
    block and take the whole estate off the air until someone noticed. Dated backups
    exist beside it by convention (`Caddyfile.bak-ops1`, `Caddyfile.bak-library-`,
    `Caddyfile.bak-1-21`) but nothing enforces or restores them. Epic 4 replaces this
    with Traefik and per-application routers, which dissolves the problem; until
    then the cheap mitigation is to move the shared Caddyfile out of any project
    checkout, or to add its blocks to a directory Caddy imports.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-21-restore-cuatro-dev-onto-the-hostinger-vps.md`
  summary: >-
    No host in the estate sends Strict-Transport-Security, and Story 1.21
    deliberately did not add it.
  evidence: |-
    The Anchor's site blocks were written to match the header set already used by
    `tracker.cuatro.dev`, which is `X-Content-Type-Options`, `X-Frame-Options` and
    `Referrer-Policy` and nothing else. HSTS and a `Server` header strip were drafted
    and then removed, because AD-20 says a migration step carries nothing else and
    HSTS is a transport-policy decision with a long cache lifetime that a host move
    has no mandate to make. It is a real gap: without it, a first visit over plain
    HTTP is strippable. Worth a small dedicated story covering the whole estate at
    once, including whether `includeSubDomains` is safe from the apex, which it is
    not while any Satellite could need to serve over HTTP for a challenge.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-21-restore-cuatro-dev-onto-the-hostinger-vps.md`
  summary: >-
    `cuatro.dev`, `www.cuatro.dev` and `analytics.cuatro.dev` have no AAAA record
    while the three Satellites on the same box do.
  evidence: |-
    The routing checklist flagged on 2026-08-16 that Story 1.21 should decide whether
    the apex gains an AAAA record on the move. It did not add one. The session had no
    IPv6 egress, so it could not verify IPv6 serving for the new hostnames or even
    confirm that the existing AAAA records work, and adding a record whose behaviour
    cannot be observed would be asserting a property rather than measuring it. The
    box does have an IPv6 address (`2a02:4780:75:9155::1`) and the shared Caddy binds
    `[::]:443`, so the path very likely works. Close this from a vantage point with
    IPv6, by verifying a Satellite over IPv6 first and then adding the three records.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-21-restore-cuatro-dev-onto-the-hostinger-vps.md`
  summary: >-
    The `AGENTS.md` context block is stale in two ways that a `/bmad-project-context`
    refresh would fix.
  evidence: |-
    It says the project is "deployed by Docker Compose to one Hetzner box". As of
    2026-08-17 it is deployed to the Hostinger VPS at `177.7.52.248` as a sibling
    stack behind a shared Caddy it does not own, which is a materially different
    deployment model, and the pitfall line telling agents that `docker/Caddyfile` is
    an incomplete standalone config is now wrong in a new way: that file is a
    fragment for another project's Caddy. It also states the suite is "38 tests in
    roughly 45 seconds" while the suite now runs 56 tests in 14 files. Both sit
    inside the `bmad:context` markers and are replaced on refresh, so they are a
    refresh item and not an edit to make by hand. The sprint change proposal already
    assigns this; it is repeated here because Story 1.21 changed the deployment model
    that the block describes.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-external-uptime-and-certificate-age-monitoring.md`
  summary: >-
    RESOLVED 2026-08-16 by AD-26. The spec's deferred item, that Story 4.2 must
    confirm Traefik's ACME renewal trigger is relative rather than a fixed day
    count, is narrowed to hostnames outside the Cloudflare proxy.
  evidence: |-
    That item assumed the origin keeps renewing its own certificates, which made the
    48 hour grace depend on the issuer attempting renewal at two thirds of lifetime.
    AD-26 removes ACME from the origin for every proxied host, so no live hostname
    depends on Traefik's renewal trigger any more. The check survives only for
    hostnames not behind the proxy, of which there are none today. Story 4.2 still
    proves DNS-01 against a scratch hostname so the capability exists the day a host
    has to leave the proxy, which AD-26 requires before that can happen. Recorded
    here rather than by editing the closed spec, since a done spec is a record of
    what was known then.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-21-restore-cuatro-dev-onto-the-hostinger-vps.md`
  summary: >-
    RESOLVED 2026-08-17. Three earlier entries are closed by the Anchor's move: the
    `cuatro.dev` outage, the estate spanning two serving addresses, and
    `n8n.cuatro.dev`.
  evidence: |-
    The outage entry recorded that `cuatro.dev` presented a self-signed
    `CN=TRAEFIK DEFAULT CERT` and returned 404 at `/api/health`. On 2026-08-17 the
    apex serves the Hub over a Let's Encrypt certificate and `/api/health` returns
    200 with `"status":"ok"` to a client performing full validation. NFR-2 is out of
    breach and UptimeRobot monitor 803749849 flipped UP.

    The two-address entry recorded that the estate did not serve from one address.
    All six live hostnames now resolve to `177.7.52.248`. The full topology, and the
    part of it that is still only on the box, is written down in
    `ops/routing-inventory.md`.

    The `n8n.cuatro.dev` entry asked what that hostname served, whether its state was
    worth keeping, and whether it explained the outage. **None of those questions was
    answered; the record simply no longer exists.** The zone held 26 records on
    2026-08-16 and holds 25 on 2026-08-17, with no `n8n` among them and no
    resolution from any public resolver. The port-conflict hypothesis it carried is
    therefore neither confirmed nor refuted, and cannot now be, because the box it
    concerned is gone. Recorded as closed-by-disappearance rather than as answered,
    so nobody later reads it as a diagnosis that was made.

    The one open thread from that cluster is not closed: the entry about
    `covidmap.cuatro.dev` and `future-vizion.cuatro.dev` being live and absent from
    `ops/estate.md` still stands. Both were re-confirmed present in the zone on
    2026-08-17. Story 2-4 owns it.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-21-restore-cuatro-dev-onto-the-hostinger-vps.md`
  summary: >-
    No test or CI job observes the serialized body of `/api/health`, which is the
    contract an external keyword monitor asserts, and no job reads a monitor's
    configuration. That combination is what let an inverted monitor run for a day.
  evidence: |-
    `app/api/health/__tests__/route.test.ts:4-8` mocks `next/server` so
    `NextResponse.json` returns the plain object, and the assertions read
    `body.status` off it. Serialization is never observed, so pretty-printing the
    response, reordering keys, or wrapping it in an envelope keeps all 56 tests
    green while the substring `"status":"ok"` leaves the wire. `ci.yml` runs
    typecheck and vitest; `lighthouse.yml` builds and runs Lighthouse with both
    Umami variables set empty. Nothing anywhere asserts the rendered layout carries
    the tracking script either. Two cheap closures, neither needing Playwright: a
    Vitest case asserting the serialized JSON string contains the exact substring,
    and a Vitest render of `RootLayout` with both env values stubbed asserting the
    script `src` and `data-website-id`. This is the same class of gap that produced
    incident 3 in Story 1-21 and hid the inverted monitor.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-21-restore-cuatro-dev-onto-the-hostinger-vps.md`
  summary: >-
    `docker/Caddyfile` is a mirror of the file that actually serves, and nothing
    compares the two, so the repository's claim to describe the running system
    decays silently from the first edit.
  evidence: |-
    The fragment is read by no process. `deploy.yml` never installs it, no CI job
    runs `caddy validate` against it, and the installed blocks live in another
    project's checkout at `/home/deploy/cs-tracker/Caddyfile`. Editing the repo copy
    changes nothing on the box; editing the box copy leaves no trace in git. Two
    cheap improvements: wrap the installed blocks in `# BEGIN anchor` / `# END
    anchor` markers so they can be located, diffed and replaced mechanically, and
    add a deploy or scheduled step that diffs the fragment against the installed
    region and fails loudly on drift. Related: `ops/routing-inventory.md` already
    records that a `git reset --hard` in the `cs-tracker` checkout would erase every
    appended block, and Story 1-21 made `deploy.yml` do exactly that in the Anchor's
    own directory.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-21-restore-cuatro-dev-onto-the-hostinger-vps.md`
  summary: >-
    The `www.cuatro.dev` monitor asserts a 301 status but cannot see the `Location`
    header, so a redirect to the wrong target, or a loop, reads UP.
  evidence: |-
    Monitor 803756083 is configured `followRedirections: false` with success code
    301 and no keyword. Changing the Caddy block to drop `{uri}`, or pointing it at
    `www` itself, keeps the status code at 301 and every automated signal green
    while deep links break or loop. `ops/monitoring.md` records the limitation and
    names the compensating control as a check by hand at cutover, which has no owner
    and no schedule. Closing it needs either a probe that can assert a response
    header, or the re-gather step proposed for the Caddyfile drift item above,
    capturing the observed `Location` alongside the status code.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-21-restore-cuatro-dev-onto-the-hostinger-vps.md`
  summary: >-
    A Cloudflare API token with zone DNS edit rights on `cuatro.dev` was created for
    the Story 1-21 cutover and must be revoked. It is tracked only in a spec
    frontmatter line marked DONE.
  evidence: |-
    The Operator supplied a zone-scoped token so the agent could repoint three A
    records on 2026-08-17. The instruction to revoke it sits inside an
    `operator_actions` entry whose line begins `DONE`, which a later reader will
    take as complete, and it appears in no `ops/` record. It is a live credential
    that can rewrite the apex A record of the estate's flagship, which is a larger
    capability than either of the two orphaned ACME tokens Story 1-3 is already
    scheduled to revoke. Revoke it, and record the revocation date in
    `ops/routing-inventory.md` beside those two so all three are tracked in one
    place. Until then it is an unrevoked standing credential with no consumer, the
    exact condition that story calls out as an unnecessary key.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-21-restore-cuatro-dev-onto-the-hostinger-vps.md`
  summary: >-
    `analytics.cuatro.dev` is unmonitored, and Story 1-21 made that a worse trade
    than when the exclusion was written.
  evidence: |-
    `ops/monitoring.md` excludes it as infrastructure rather than an application a
    Visitor is sent to. That reasoning predates two facts Story 1-21 established:
    all Umami history before 2026-08-17 was discarded, and SM-1 through SM-3 now
    depend entirely on an instance nobody probes. Silent Umami downtime is now
    silent metric loss with no baseline against which the gap would look anomalous,
    and the Hub's tracking script fails quietly when its host is down. One more
    monitor costs nothing on a free tier holding 6 of 50.
