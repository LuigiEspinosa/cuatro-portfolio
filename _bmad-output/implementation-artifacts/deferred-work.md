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

- source_spec: `_bmad-output/implementation-artifacts/spec-1-21-restore-cuatro-dev-onto-the-hostinger-vps.md`
  summary: >-
    SUPERSEDED 2026-08-17 by Operator decision. The entry above asking for the
    Cloudflare zone-edit token to be revoked is withdrawn: the token is retained
    deliberately. Do not action the revoke instruction.
  evidence: |-
    The earlier entry treated the cutover token as a credential with no remaining
    consumer and asked for its revocation. The Operator decided on 2026-08-17 to
    keep it for future estate work, and to keep it in the gitignored local `.env`
    as `CLOUDFLARE_TOKEN`. That is a reasonable call: the estate has repeated DNS
    work ahead of it in Story 1.3 (proxying every record under AD-26) and again in
    Epic 4, and re-minting a token each time has its own cost.

    **What changes is the tracking, not the decision.** A retained credential is a
    standing one, so it now appears in the live-credentials table in
    `ops/routing-inventory.md` beside the two orphaned ACME tokens rather than
    living only in a spec's frontmatter. It is the single most powerful credential
    in the estate: zone DNS edit on `cuatro.dev` can repoint the apex, and it is
    scoped to that zone alone with no account-level rights, which is the correct
    shape for it. Two things worth doing when convenient, neither urgent and
    neither blocking: confirm it carries an expiry in Cloudflare rather than
    living forever, and note that a token in a developer machine's `.env` has a
    different exposure profile from one in a secret store, which is a reasonable
    trade at this estate's size but should be a knowing one.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-bot-mitigation-on-the-four-live-subdomains.md`
  summary: >-
    The estate now has a hard dependency on Cloudflare for all ingress, and the
    documented recovery path runs through a firewall rule rather than DNS.
  evidence: |-
    Story 1-3 restricted `DOCKER-USER` on `eth0` ports 80 and 443 to Cloudflare's
    published ranges, which is what makes the bot rules non-bypassable. The cost,
    which is real and was accepted knowingly, is that a Cloudflare edge outage now
    takes all six hostnames down with no fast bypass: turning a record back to
    DNS-only does not help, because the origin would then present a Cloudflare
    Origin CA certificate that no browser trusts (AD-26's reversibility cost), and
    the firewall would drop the traffic anyway. Recovery requires SSH to the box and
    `systemctl stop cf-origin-firewall.service` plus `iptables -F DOCKER-USER`, and
    that is written in no runbook. Worth a short recovery note in
    `ops/routing-inventory.md` or a dedicated story, since the person needing it
    will be under time pressure.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-bot-mitigation-on-the-four-live-subdomains.md`
  summary: >-
    Cloudflare's IP ranges are hardcoded into the origin firewall script and nothing
    refreshes them, so a new Cloudflare range silently breaks the estate.
  evidence: |-
    `/usr/local/sbin/cf-origin-firewall.sh` embeds the 15 IPv4 and 7 IPv6 CIDRs
    fetched on 2026-08-17 (`etag 38f79d050aa027e3be3865e495dcc9bc`). Cloudflare adds
    ranges occasionally and publishes them at `/client/v4/ips`. If traffic arrives
    from a range not in the script it is dropped, and the failure looks like an
    intermittent outage affecting some visitors and not others, which is among the
    hardest shapes to diagnose. The cheap closure is a scheduled job that re-fetches
    the list, compares the etag, and either rewrites the script or alerts. It must
    run off the box per AD-18, or it shares the failure it is watching for.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-bot-mitigation-on-the-four-live-subdomains.md`
  summary: >-
    The estate now depends on a TLS certificate it does not control and cannot
    renew, and the one rule that would warn about it is still not configured.
  evidence: |-
    After the cutover all six hostnames present one Cloudflare Universal SSL
    certificate, observed 2026-08-17T18:18Z with `notAfter 2026-09-20T23:23:52Z`,
    34 days remaining against the configured threshold of 28. Cloudflare renews it
    automatically and it is expected to roll over, but the estate has no visibility
    into whether that happened until it either renews or expires. Rule 2, the
    certificate age alert, remains unconfigured because it is a paid UptimeRobot
    setting, and AD-26's argument for dissolving it covered the *origin* renewal
    cycle, which is genuinely gone. It did not cover the edge certificate, which is
    new. `ops/monitoring.md` records this under the observed-state section. Worth
    deciding deliberately rather than discovering at expiry.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-bot-mitigation-on-the-four-live-subdomains.md`
  summary: >-
    Bot rule 2 matches self-declared user agents, so a crawler that lies is not
    caught, and the native controls that would not rely on self-declaration were
    unreachable.
  evidence: |-
    The AI crawler policy the Operator chose (allow Search, block Training and
    Agent) is implemented as a WAF custom rule listing 17 user-agent substrings.
    Cloudflare's native AI categories enforce the same policy by verified category
    rather than by name, but they sit behind the Bot Management API and the token
    available to the story returned `Authentication error` on
    `/zones/{id}/bot_management`. `ai_bots_protection` is not a zone setting on this
    account and `ai-crawl-control` has no route. Two consequences: the current
    protection is weaker than it reads, and Cloudflare retires the legacy single
    toggle on 2026-09-15 in favour of independent Search, Agent and Training
    categories, so this should be revisited before that date rather than after.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-bot-mitigation-on-the-four-live-subdomains.md`
  summary: >-
    Authenticated Origin Pulls was never considered as an alternative to the
    hardcoded Cloudflare IP allowlist, and it removes the maintenance problem the
    allowlist creates.
  evidence: |-
    Story 1-3 closed the direct-to-origin bypass with an IP allowlist in
    `DOCKER-USER`. That works today and carries a standing cost: the ranges are
    hardcoded, nothing refreshes them, and the failure mode of a stale list is a
    partial outage affecting some visitors and not others. Cloudflare's mTLS
    Authenticated Origin Pulls solves the same problem by having the edge present a
    client certificate the origin verifies, which does not go stale when Cloudflare
    adds a range. `ops/bot-mitigation.md` explicitly rejects Bot Fight Mode and
    per-hostname rate limiting by name, under its own standard that a control
    considered and rejected reads differently from one nobody thought of. This one
    is simply absent from the record. Worth evaluating alongside the range-refresh
    job rather than instead of it, since Caddy would need `client_auth` configured
    and that touches the shared ingress.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-bot-mitigation-on-the-four-live-subdomains.md`
  summary: >-
    The Origin CA private key has no backup, no recorded fingerprint, and no
    reprovisioning procedure, and losing it now takes every hostname down with no
    ACME fallback.
  evidence: |-
    The key and certificate live only in the `cs-tracker_caddy_data` Docker volume
    at `/data/origin-ca/`, plus a copy in `/home/deploy/origin-ca/` on the same box.
    Both are on the one machine. Every site block now names those paths explicitly,
    and that directive is what disables ACME, so if the volume is recreated Caddy
    cannot load the sites and cannot fall back to issuing anything. `ops/monitoring.md`
    records the issuer, subjects, key type, term and expiry but no serial or SHA-256
    fingerprint, which is the one value that would let a later reader confirm the
    origin still presents this certificate rather than another. Three cheap closures:
    record the fingerprint, copy the key to wherever the estate keeps its other
    secrets, and write the reissue procedure next to the recovery commands. Note the
    certificate is valid for fifteen years, so the person who needs this will not be
    the person who set it up.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-bot-mitigation-on-the-four-live-subdomains.md`
  summary: >-
    Proxy defaults were checked ad hoc rather than swept, and one payload-altering
    feature was found only by accident.
  evidence: |-
    Scrape Shield email obfuscation was discovered injecting a script into the
    Anchor's HTML because a verification step happened to dump the rendered page.
    Nine settings were then read individually (`rocket_loader`, `mirage`, `polish`,
    `brotli`, `always_use_https`, `automatic_https_rewrites`,
    `opportunistic_encryption`, `min_tls_version`, `security_level`,
    `hotlink_protection`) and their values are not written into any `ops/` record.
    Two of those readings are worth acting on separately: `min_tls_version` is 1.0,
    and `always_use_https` is off so plaintext requests still reach the origin rather
    than being redirected at the edge. Neither was changed, because AD-20 says a step
    of this kind carries nothing else. A recorded sweep of what the proxy turns on by
    default, with the current value of each, belongs in `ops/` before Epic 2 ships
    anything that depends on the rendered payload.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-bot-mitigation-on-the-four-live-subdomains.md`
  summary: >-
    Three dated commitments now exist with no mechanism that will surface them, in a
    file the repository itself records as read by nothing.
  evidence: |-
    The Origin CA certificate expires 2041-08-13 with a review written for
    2041-02-13; Cloudflare retires the legacy AI bot toggle on 2026-09-15; and the
    Cloudflare edge certificate needs watching until it is confirmed renewing. All
    three live in `ops/monitoring.md` or `ops/bot-mitigation.md`, and the Code Map for
    this story confirms nothing in the repository reads either file programmatically.
    The nearest one is four weeks out. AD-22 already establishes a bounded re-check
    for settled inputs and would be the natural home for the first two, which is a
    smaller change than building a reminder mechanism.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-bot-mitigation-on-the-four-live-subdomains.md`
  summary: >-
    `sprint-status.yaml` carries a `story_location` pointing at a directory that does
    not exist in this checkout.
  evidence: |-
    It reads `c:/Development/cuatro-portfolio/_bmad-output/implementation-artifacts`
    while the repository is at `C:\CuatroEcosystem\cuatro-portfolio`. Any tool that
    resolves the key reads an empty directory and would report no stories rather than
    failing loudly. Pre-existing and not caused by story 1-3, which touched the file
    only for its own status transitions. Left unfixed here because the spec's frozen
    boundaries forbid this story writing that file beyond the workflow's own sync.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-the-capacity-gate-exists-and-fails-closed.md`
  summary: >-
    The Capacity Gate binds only the Anchor's own deploy workflow, so it is not
    reachable at the moment a genuinely new application is placed.
  evidence: |-
    `.github/workflows/deploy.yml` is the only caller, and it names `cuatro-portfolio`,
    which is in `placements` by construction. The three Satellites deploy from their own
    repositories as separate compose projects on the box and never call the checker.
    `list-wheel` in Epic 2 and every id placed in Epic 4 are the placements AD-9 exists
    to gate, and none of them passes through this workflow. Story 1-4's scope is the
    Anchor, so this is a gap in reach rather than a defect in the story, but the gate is
    weaker than AD-9 reads until Epic 2 or Epic 4 gives it a call site at a real
    placement.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-the-capacity-gate-exists-and-fails-closed.md`
  summary: >-
    `status: open` means yes to every id, and nothing ever compares `reading` against
    `threshold`.
  evidence: |-
    Story 1-4's frozen I/O matrix specifies exactly this ("Open with a threshold: Exit 0
    for any id"), so the code matches its spec. But AD-9 says the gate measures the box's
    15-minute load average, and once Story 1-6 flips one word the check stops
    discriminating for good. `threshold` is also validated only as a non-empty string, so
    `threshold: banana` would open it. Story 1-6 must define what `open` actually checks
    and what shape a threshold takes, rather than inheriting this placeholder.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-the-capacity-gate-exists-and-fails-closed.md`
  summary: >-
    A red CI run does not stop a deploy, because `ci.yml` and `deploy.yml` trigger in
    parallel on a push to `main`.
  evidence: |-
    `ci.yml` fires on `push: ['**']` and `deploy.yml` on `push: [main]`, with no `needs`,
    no `workflow_run`, and no required-check enforcement in the repository. A failing
    typecheck or a failing test therefore does not hold the deploy. That sits against
    AD-21's "CI is the only pre-production gate", and it is pre-existing rather than
    caused by story 1-4, which added a gate inside `deploy.yml` precisely because a check
    in `ci.yml` would not have blocked anything.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-the-capacity-gate-exists-and-fails-closed.md`
  summary: >-
    `placements` is self-serve: the same commit can add an id and deploy it, with no
    review requirement.
  evidence: |-
    There is no `CODEOWNERS` file at the repository root or under `.github/`, and nothing
    checks that an id in `placements` was ever observed running on the box. The gate
    currently refuses only the person who forgets to edit the file. A `CODEOWNERS` entry
    on `ops/capacity-gate.yml` would make widening the gate a reviewed act, which is what
    a fail-closed control needs on a one-operator estate.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-the-capacity-gate-exists-and-fails-closed.md`
  summary: >-
    `deploy.yml` has no `concurrency` group, so two pushes to `main` can race the same
    `git reset --hard` on the box.
  evidence: |-
    The SSH step resets the box checkout to `origin/main` rather than to the commit that
    triggered the run, so overlapping runs can leave the box serving a commit whose gate
    check never ran. Pre-existing, and out of scope for a story whose frozen boundaries
    forbid editing the SSH step. Epic 3 retires this deploy mechanism entirely, so the
    cheap fix in the meantime is a `concurrency` group plus pinning the reset to
    `github.sha`.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-capacity-measurement-week.md`
  summary: >-
    The capacity CSV records no core count and no `MemTotal`, so a box resize mid-week would
    silently change what every "share of the box" figure means, and container RSS has no
    denominator in the week's own data.
  evidence: |-
    `ops/capacity-summary.mjs` carries `DEFAULT_CORES = 2`, matched by hand to what the box has
    today, and the box row carries `MemAvailable` only. Nothing in the twelve-column schema
    records `nproc` or `MemTotal`, so if the VPS were resized during the week the summariser
    would keep dividing by two and every box-share figure, including the two scalars the gate
    takes, would be wrong by a factor with nothing in the data able to reveal it. Not fixed here
    because the fix is a schema change and the week is already running: `parseRows` refuses any
    file whose header differs, so widening the schema mid-week would split the week into two
    incompatible halves. The cheap version, if this recurs, is a `note` row carrying
    `cores=$(nproc)` once per run, which is schema-compatible, plus a close-out assertion that
    the run saw exactly one distinct value.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-capacity-measurement-week.md`
  summary: >-
    The sampler's append is unguarded by any lock, and the day-file header is a check-then-write,
    so two runs meeting at a UTC midnight boundary could truncate a file that already holds
    samples.
  evidence: |-
    `ops/capacity-sampler.sh` writes the header with `printf '%s\n' "${SCHEMA}" > "${out}"` inside
    an `[ ! -f "${out}" ]` test, and appends rows with `>>` and no `flock`. One timer plus
    `Type=oneshot` plus `TimeoutStartSec=45` makes overlap unlikely, but it is not impossible: the
    install deliberately ran the service by hand while the timer was armed, which is exactly how
    two samples landed 18 seconds apart on 2026-08-17. A small `O_APPEND` write is atomic in
    practice, which the file relies on without saying so. The closure is a `flock` around both the
    header creation and the append. Left alone because changing the sampler mid-week means
    reinstalling the thing being measured, and the observed risk over one week on one timer is
    very low.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-capacity-measurement-week.md`
  summary: >-
    The sampler assumes every container cgroup lives under `system.slice`, and silently counts a
    container as vanished if it does not.
  evidence: |-
    `ops/capacity-sampler.sh` builds the path
    `${CGROUP_ROOT}/system.slice/docker-${cid}.scope`, which is correct for the box's current
    setup (Docker 29.6.2, cgroup v2, `systemd` driver, verified 2026-08-17). A container started
    with a `cgroup_parent`, a rootless daemon, or a driver change would land elsewhere, and the
    sampler would increment its `vanished` counter every run and omit that container from the
    entire week with only a note row to show for it. The summariser would then report a footprint
    that is missing an application without anything looking wrong. A fallback search across
    plausible parents, or an explicit assertion at install time that every running container
    resolves to a cgroup, would close it.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-the-capacity-gate-exists-and-fails-closed.md`
  summary: >-
    The capacity gate has no entry in the estate record, no README or AGENTS.md line, and
    `AGENTS.md` still states a test count of 38.
  evidence: |-
    `ops/capacity-gate.yml` is the first file under `ops/` with a machine consumer, and
    grepping `README.md`, `AGENTS.md` and `ops/estate.md` for "capacity" returns nothing.
    An operator who hits `capacity gate: REFUSED` is told what to do by the message
    itself, so this is documentation debt rather than a hole. The suite is 102 tests as of
    story 1-4 against the 38 recorded in the AGENTS.md block, which is managed by
    `bmad-project-context` and refreshed by it rather than edited here.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-9-record-the-build-on-the-box-violation-as-a-tracked-item.md`
  summary: >-
    `anchor-umami` carries no healthcheck, which is a second live AD-8 breach in this
    repository, and `ARCHITECTURE-SPINE.md` asserts the opposite is already true.
  evidence: |-
    AD-8 at `ARCHITECTURE-SPINE.md:128` does not stop at "the box never compiles". It also
    makes real healthchecks, and services without `container_name` or published `ports`,
    "requirements on every compose service", and then asserts "both already true behind
    Traefik". In `docker-compose.yml`, `anchor-app` (`:23`, healthcheck at `:43`) and
    `anchor-db` (`:84`, healthcheck at `:92`) satisfy it; `anchor-umami` at `:62` has no
    healthcheck block at all. The architecture document therefore states as settled fact
    something the repository does not do. This matters beyond tidiness: AD-8 requires
    healthchecks because `docker-rollout` depends on them, and Story 3.4 is the story that
    adopts `docker-rollout`. A service with no healthcheck is one `docker-rollout` cannot
    roll. Found while writing `ops/known-violations.md` and deliberately not recorded there
    as KV-2: by that file's own admission tests an entry needs an Operator ruling that the
    breach is tolerated, and no story has taken that ruling. Either it is ruled and promoted
    to the register, or the healthcheck is added, or `ARCHITECTURE-SPINE.md:128` stops
    claiming it is already true. Story 3.4 is the natural forcing point.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-9-record-the-build-on-the-box-violation-as-a-tracked-item.md`
  summary: >-
    Two of the four places that mention the AD-8 violation still resolve it through the
    string "Story 1-9" rather than through `ops/known-violations.md`, so the register is
    reachable from only one of them.
  evidence: |-
    `AGENTS.md:80` reads "tracked in story 1-9" and `ops/capacity-measurement.md:332` reads
    "the standing AD-8 violation tracked in Story 1-9". Only `ops/routing-inventory.md`
    gained a pointer to the register, because Story 1-9's spec put the other two off limits:
    the `AGENTS.md` line sits inside the machine-managed `bmad:context` block, which a
    `/bmad-project-context` refresh rewrites and which must not be hand-edited, and
    `ops/capacity-measurement.md` belongs to the running measurement week. This is a known
    consequence of that story's boundaries rather than an oversight, but the effect is real:
    a future reader hitting either line has to resolve a story key to a spec file to a
    register, and that story's own stated rationale is that a register nobody can reach from
    the file they are already reading is not a tracked item. Two cheap closures: add the
    pointer to `ops/capacity-measurement.md` at close-out, when that file is being edited
    anyway, and have the `bmad:context` refresh replace "tracked in story 1-9" with the
    register path. That refresh is already queued by the earlier entry about the stale
    "one Hetzner box" line.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-enumerate-the-deployed-routing-table-on-the-box.md`
  summary: >-
    RESOLVED 2026-08-24 by observation. The Cloudflare edge certificate renewed. The
    earlier entry asking whether the estate would find out if it did not renew is
    narrowed rather than closed.
  evidence: |-
    The 2026-08-17 entry recorded `notAfter 2026-09-20T23:23:52Z` on the Universal SSL
    certificate all six hostnames present, with no visibility into whether Cloudflare
    would roll it over. Observed 2026-08-24 from outside on all six hostnames: subject
    `CN=cuatro.dev`, SANs `cuatro.dev` and `*.cuatro.dev`, issuer
    `C = US, O = Google Trust Services, CN = WE1`, notBefore 2026-08-21T00:18:46Z, notAfter
    2026-11-19T01:16:34Z. The issuer string is pasted in the form
    `openssl x509 -noout -issuer` printed it, which is the form
    `ops/routing-inventory.md` now treats as canonical.

    Renewal happened 30 days before the prior certificate's notAfter. **That interval is
    one observation, not a cadence.** Reading it as "the normal Cloudflare cadence" would be
    an inference from a single data point, and it is marked as such here rather than
    asserted: no second renewal has been observed on this zone, and Cloudflare publishes no
    commitment this estate has read. What is observed is one renewal, one interval, and a
    working mechanism.

    Confirmed 2026-08-24 by a second, stronger read that also settles the checklist's
    wildcard question: `GET /zones/{id}/ssl/certificate_packs?status=all` shows two
    Universal SSL packs, both created 2025-08-31T04:48Z at zone activation, both covering
    `cuatro.dev` and `*.cuatro.dev`, validated by `txt`. The active pack is Google Trust
    Services; the backup pack is Let's Encrypt and was last modified 2026-07-14T06:23:39Z.
    Full disposition in `ops/routing-inventory.md` under "The 2026-07-14 wildcard
    certificate, closed by observation".

    What is answered is whether renewal works. What is not answered is whether the
    estate would notice a failed renewal, and that is unchanged: the certificate-age
    alert is a paid UptimeRobot setting and remains unconfigured, so the only signal
    would be six simultaneous TLS failures at expiry. The cheap closure is a scheduled
    off-box check reading `notAfter` on the apex and alerting under a threshold, which
    is the same shape as the Cloudflare IP-range refresh job already proposed and could
    be the same job. Recorded here because a dated observation that renewal works is
    worth more than the open question it replaces.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-enumerate-the-deployed-routing-table-on-the-box.md`
  summary: >-
    `library-backup.sh` has aborted on line 13 every night since 2026-07-31. A valid
    snapshot is still written, so `digital-library` does have a nightly local backup,
    but the script reports failure, leaves every file root-owned and uncompressed, and
    never runs its retention prune. Two separate bugs. Story 1.8 inherits this.
  evidence: |-
    Observed 2026-08-24 on `177.7.52.248`. Every one of the 25 lines in
    `/home/deploy/backups/digital-library/backup.log` reads
    `/home/deploy/library-backup.sh: line 13: USER: unbound variable`. Line 13 is
    `sudo chown "$USER:$USER" "$OUT"`; cron does not set `USER` in the job environment
    and the script runs `set -euo pipefail`, so `set -u` aborts on the unset expansion.
    Line 12, `sudo sqlite3 "$DB" ".backup '$OUT'"`, runs before the abort. Everything
    after line 13 does not run: no `chown`, no `gzip`, no prune.

    **The full evidence is in `ops/routing-inventory.md` under "Backup coverage, per
    project", and is deliberately not duplicated here.** That section carries the file
    listing, the checksums of all 25 snapshots, the `PRAGMA integrity_check` results,
    the live database and WAL sizes and timestamps, and the reconciliation against
    `cuatro-backup.sh`. One place to correct if any of it turns out wrong.

    The three things Story 1.8 needs from it, in one line each. **The snapshot is
    real**: two of the 25 were copied to `/tmp` and both pass `PRAGMA integrity_check`,
    carry the full schema and are WAL-inclusive, which is observed rather than read off
    the script's comment. **The prune has never run**: a `.gz` 25 days old survives a
    14-day policy. **There are two bugs, not one**: fixing only the `USER` expansion
    would start pruning the `.gz` files while the 25 uncompressed `.db` files kept
    growing, because the prune pattern matches `.db.gz` only.

    Two things that make the fix smaller than it looks. The database holds one user,
    one session and **zero books**, and `data/books`, `data/covers` and `data/inbox` are
    all empty, so this is a correctness and offsite problem rather than a volume one.
    And what is still unproven is that a snapshot is consistent **under a concurrent
    writer**: nothing has written to this database since 2026-08-14, so every snapshot
    in the directory was taken against a quiescent file. Story 1.8 carries the restore
    test, which is where that gets settled. Not fixed here because Story 1-7's pass is
    read-only.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-enumerate-the-deployed-routing-table-on-the-box.md`
  summary: >-
    No backup anywhere in the estate is offsite, and two of the four compose projects
    have no logical backup at all. Story 1.8 scopes only `digital-library`.
  evidence: |-
    Observed 2026-08-24. The `deploy` crontab holds exactly two jobs and root has none:
    `cuatro-backup.sh` at 03:30 UTC and `library-backup.sh` at 03:45 UTC. Both write
    under `/home/deploy/backups` on the box they are backing up, which protects against
    a bad migration and against nothing else.

    `cs-tracker`'s Postgres (`cs-tracker_pgdata`) and `cuatro-portfolio`'s Postgres
    (`cuatro-portfolio_postgres_data`, which is Umami's store and therefore SM-1 through
    SM-3's data) have no backup of any kind. Neither do `cuatro-tracker_redis_data`,
    `digital-library_redis_data`, `cuatro-tracker_qb_config`, or
    `cs-tracker_caddy_data`, which holds the Origin CA private key that every hostname's
    TLS depends on and that nothing can reissue automatically.

    `cuatro-backup.sh`'s header comment claims it "Complements Hostinger's weekly
    whole-box snapshot". No evidence of that snapshot exists on the box and this pass
    could not reach the Hostinger console, so it is an unverified claim in a script
    comment rather than an observation. If it is real it is the estate's only offsite
    copy and it should be written into `ops/` with its retention and its restore
    procedure; if it is not real the estate has no offsite copy of anything.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-enumerate-the-deployed-routing-table-on-the-box.md`
  summary: >-
    `analytics.cuatro.dev` is a live hostname with no application id, which AD-3 and
    AD-6 together do not allow for, and no Estate row. Story 2-4 territory.
  evidence: |-
    AD-3 (`ARCHITECTURE-SPINE.md:98`) makes the Registry the only hostname-to-application
    mapping. AD-6 forbids dropping an application by omission. `analytics.cuatro.dev`
    serves Umami from `cuatro-portfolio-anchor-umami-1`, is proxied, carries WAF rule 4
    of its own in `ops/bot-mitigation.md`, and has no row in `ops/estate.md`'s fifteen
    applications and therefore no id Epic 2 could author a `live` value against.

    This is not the same defect as `covidmap` and `future-vizion`, which are live
    applications simply missing from the record. Umami is infrastructure the estate runs
    for itself, so the right answer may well be that infrastructure hostnames sit
    outside the Registry. Either way the exclusion has to be written down, because the
    current state is that a hostname the estate depends on maps to nothing. Story 2-4
    already owns the two Vercel hostnames and is the natural place to land this too.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-enumerate-the-deployed-routing-table-on-the-box.md`
  summary: >-
    The build-on-the-box breach is estate-wide, not Anchor-only. All four compose
    projects build their images on the serving two-core box, while KV-1 records only
    this repository's deploy workflow.
  evidence: |-
    Observed 2026-08-24 by `docker inspect` on all sixteen containers. Seven images
    carry locally-built names with no registry prefix: `cuatro-portfolio-anchor-app`,
    `cuatro-tracker-app`, `cuatro-tracker-worker`, `cuatro-tracker-migrate`,
    `digital-library-api`, `digital-library-web` and `cs-tracker`. Only `caddy:2`,
    `postgres:16`, `postgres:16-alpine`, `redis:7-alpine`,
    `ghcr.io/umami-software/umami:postgresql-latest` and
    `linuxserver/qbittorrent:latest` are pulled. `cuatro-redeploy.sh` and
    `library-redeploy.sh` both run `docker compose up -d --build` on the box, and a
    weekly `/etc/cron.d/docker-builder-prune` exists precisely because the box
    accumulates build cache.

    **`cs-tracker:latest` was recorded as ambiguous and is not.** The intended test,
    that a locally built image has no `RepoDigests`, does not work on this daemon:
    Docker 29.6.2 here reports every image's `RepoDigests` as `<name>@<its own image
    id>`, pulled images included, so the field distinguishes nothing. What settles it is
    `/home/deploy/cs-tracker/docker-compose.yml`, where both `app` and `migrate` declare
    `build: {context: .}` with `image: cs-tracker:latest`, a `Dockerfile` sits beside
    it, and `docker image history` shows a locally built Elixir release. The estate-wide
    claim is therefore exact rather than a lower bound: four projects out of four.

    The disk cost is visible and was not previously recorded: `docker system df -v`
    reports 6.028 GB of build cache plus a 1.3 GB dangling image and a superseded
    390 MB `cuatro-portfolio-app:latest` left by the Story 1-21 rename, on a 96 GB disk
    at 17 percent. The capacity conversation so far has been about cores only.

    `ops/known-violations.md` KV-1 is scoped to `.github/workflows/deploy.yml`, so a
    reader would conclude the Anchor is the exception. It is the rule. This is not added
    to the register here because that file's own admission test requires an Operator
    ruling that a breach is tolerated, and no story has taken that ruling for the
    Satellites. Epic 3 is where AD-8 is closed and is the natural forcing point.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-enumerate-the-deployed-routing-table-on-the-box.md`
  summary: >-
    A BitTorrent client and a third-party security agent both run on the serving box and
    appear in no planning artifact.
  evidence: |-
    Observed 2026-08-24. `cuatro-tracker-qbittorrent-1`
    (`linuxserver/qbittorrent:latest`, `restart: unless-stopped`, no healthcheck) is
    part of the `cuatro-tracker` compose project with a bind mount at
    `/home/deploy/cuatro-downloads`. It is on `cuatro-tracker_default` only, publishes
    no port, and no hostname reaches it, so it is correctly outside the routing table.
    It is still a CPU, disk and egress consumer on a two-vCPU box whose binding
    constraint is CPU, running through the Story 1-5 measurement week without appearing
    in any capacity discussion, and a torrent client on a box that also serves a public
    portfolio is a reputational and legal exposure nobody has recorded a decision about.

    `monarx-agent.service` ("Monarx Agent - Security Scanner") listens on
    `127.0.0.1:65529` and is updated weekly by `/etc/cron.d/monarx-update`. It is
    Hostinger's bundled agent, reachable from nowhere outside the box, so it does not
    reach a hostname. It is third-party software with host-level visibility that nobody
    in the planning record chose, which is worth a knowing decision rather than silence.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-enumerate-the-deployed-routing-table-on-the-box.md`
  summary: >-
    `digital-library`'s box-only ingress override is untracked and NOT gitignored,
    unlike `cuatro-tracker`'s, so it is protected by nobody having run `git clean`
    rather than by a rule.
  evidence: |-
    Observed 2026-08-24. In `/home/deploy/cuatro-tracker`, `git check-ignore -v
    docker-compose.override.yml` reports `.gitignore:23`. In
    `/home/deploy/digital-library` the same command reports no rule and `git status
    --porcelain` lists the file as `??`. `library-redeploy.sh` runs `git fetch` and
    `git reset --hard origin/main`, which preserves untracked files, so the current
    redeploy path is safe. Any `git clean -fd`, or a redeploy script gaining one, would
    delete the file that attaches `library-api` and `library-web` to the shared ingress
    network and take `library.cuatro.dev` off the air with no error until the next
    request. One line in that repository's `.gitignore` closes it. This belongs in the
    `digital-library` repository rather than here.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-enumerate-the-deployed-routing-table-on-the-box.md`
  summary: >-
    `cs-tracker.cuatro.dev` is the only live hostname whose Caddy site block sends no
    security headers, and its site label is an unresolved environment variable.
  evidence: |-
    Observed 2026-08-24 by reading `/home/deploy/cs-tracker/Caddyfile`. Five of the six
    site blocks carry `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy`.
    The `{$PHX_HOST}` block carries only its `tls` directive and
    `reverse_proxy app:4000`. The header set was deliberately matched across the estate
    when the Anchor's and the library's blocks were written, and this one predates that
    convention.

    Separately, that block's site label is `{$PHX_HOST}`, which resolves from
    `PHX_HOST=cs-tracker.cuatro.dev` in `/home/deploy/cs-tracker/.env`. The file alone
    does not tell a reader which hostname the first block serves, and Epic 4 must carry
    that indirection across or resolve it deliberately rather than discovering it. Both
    fixes belong in the `cs-tracker` repository. Recorded here because Story 1-7 is
    read-only and because `ops/routing-inventory.md` is the file Epic 4 rebuilds from.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-enumerate-the-deployed-routing-table-on-the-box.md`
  summary: >-
    Two live third-party credentials sit in project `.env` files on the box that nothing
    in the estate had recorded: a `CLOUDFLARE_API_TOKEN` in `cuatro-tracker` and a
    `HETZNER_DNS_API_TOKEN` in `digital-library`. The second is for a provider the
    estate has left. This also corrects a claim in `ops/routing-inventory.md`.
  evidence: |-
    Observed 2026-08-24 by reading variable names only, with
    `grep -E '^[A-Za-z_][A-Za-z0-9_]*=' <file> | cut -d= -f1`. No value was read and
    none is recorded anywhere.

    `/home/deploy/cuatro-tracker/.env` declares `CLOUDFLARE_API_TOKEN`. Its declared
    consumer is that project's own `caddy` service, which builds
    `docker/Dockerfile.caddy` for DNS-01 issuance and is held out of
    `docker compose up` by the Compose profile `edge` so it does not collide with the
    shared ingress on 80 and 443. So nothing running uses it, which is the conclusion
    the record already drew, but the earlier wording "the box holds no Cloudflare
    credential" is wrong and has been corrected in place. Which of the two orphaned
    tokens this is, or whether it is a third, is unknown from here.

    `/home/deploy/digital-library/.env` declares `HETZNER_DNS_API_TOKEN`. Nothing in the
    estate has been on Hetzner since 2026-08-17. A DNS API token for a provider nobody
    uses is the same shape of unnecessary standing credential that Story 1-3 was
    scheduled to close for the two Cloudflare tokens, and it is in a different vendor's
    console, so it is not covered by the audit-log operator action already tracked.
    Revoking it belongs to whoever owns the `digital-library` repository.

    Two further names worth a decision, neither urgent. `/home/deploy/digital-library/
    .env` declares `SMTP_HOST`, `SMTP_USER` and `SMTP_PASS`, so the estate sends mail
    from the box and no planning artifact, monitor or `ops/` record says so. And eleven
    of the fifty-five variables across the four files are third-party API credentials
    that exist only on this box, are in no repository and are backed up nowhere; losing
    the box loses all of them. Full list of names in `ops/routing-inventory.md` under
    "The variable names each project needs".

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-enumerate-the-deployed-routing-table-on-the-box.md`
  summary: >-
    qBittorrent's WebUI is running on an auto-generated temporary password printed to
    the container log, with `WebUI\Address=*`. It is safe only because no port is
    published and no hostname reaches it.
  evidence: |-
    Observed 2026-08-24. `/var/lib/docker/volumes/cuatro-tracker_qb_config/_data/
    qBittorrent/qBittorrent.conf` contains `WebUI\Address=*` and `WebUI\ServerDomains=*`
    and contains **no** `WebUI\Username` and no `WebUI\Password_PBKDF2`. The container
    log carries "The WebUI administrator username is: admin" and "The WebUI
    administrator password was not set. A temporary password is ...", which is the
    linuxserver image's fallback. The password is not reproduced in any record.

    The compose file sets `WEBUI_PORT=8080` and comments "Internal only - never expose
    port 8080 externally", and that comment is currently true: the port is exposed in
    image metadata, published nowhere, the container is on `cuatro-tracker_default`
    only, and `iptables -t nat -L -n` holds exactly two DNAT rules, both to the ingress
    Caddy. So the exposure today is zero.

    The reason to record it is that the protection is a network boundary alone, and the
    boundary is one `ports:` line or one `--profile edge` away from moving. A regenerated
    password also means the credential changes on every container recreate, while
    `QBITTORRENT_USER` and `QBITTORRENT_PASS` in that project's `.env` are static, so it
    is not obvious the application's own credentials still match. Belongs in the
    `cuatro-tracker` repository. Not touched here: Story 1-7 is read-only.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-enumerate-the-deployed-routing-table-on-the-box.md`
  summary: >-
    Every service in the estate runs on a floating image tag, and no image on the box
    carries a registry manifest digest that a rebuild could pin to. Epic 4 rebuilds from
    `ops/routing-inventory.md` and would not get the same estate.
  evidence: |-
    Observed 2026-08-24. The six pulled images are `caddy:2`, `postgres:16`,
    `postgres:16-alpine`, `redis:7-alpine`,
    `ghcr.io/umami-software/umami:postgresql-latest` and
    `linuxserver/qbittorrent:latest`. Every one of those tags moves. A rebuild in six
    months gets a different Postgres minor, a different Umami and a different
    qBittorrent, and nothing in any repository records which ones are running today.

    The usual mitigation, recording `RepoDigests` so the rebuild can pin
    `image@sha256:...`, does not work from this box: Docker 29.6.2 here reports every
    image's single `RepoDigests` entry as `<name>@<its own image config id>`, for pulled
    images as well as built ones. For example `caddy:2` reports
    `caddy@sha256:844f60b6...`, which is identical to its `Id`. That is not a registry
    manifest digest and cannot be used to pull the same image elsewhere.

    `ops/routing-inventory.md` now records every container's image id and creation date
    under "Image identity, so the rebuild is reproducible", which makes a rebuild
    auditable after the fact. Making it reproducible needs either digests read from the
    registry, or the GHCR path AD-8 requires, which is Epic 3. Recorded so Epic 4 does
    not discover it while rebuilding.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-8-an-offsite-backup-path-for-digital-library.md`
  summary: >-
    RESOLVED IN CODE. Closes the code half of two entries from
    `spec-1-7-enumerate-the-deployed-routing-table-on-the-box.md`, identified below by
    their own summary lines. The offsite half is installed and awaiting an Operator
    credential, tracked in `ops/backup-digital-library.md` rather than here.
  evidence: |-
    Resolved 2026-08-24. Appended rather than edited into the two entries it answers, so
    the trail stays readable.

    **The two entries this closes**, both with
    `source_spec: _bmad-output/implementation-artifacts/spec-1-7-enumerate-the-deployed-routing-table-on-the-box.md`:

    1. The entry whose summary begins "`library-backup.sh` has aborted on line 13 every
       night since 2026-07-31". **Closed in full.**
    2. The entry whose summary begins "No backup anywhere in the estate is offsite, and
       two of the four compose projects have no logical backup at all". **Closed for
       `digital-library` only.** Its estate-wide half stays open, as that entry itself
       says, and is restated at the end of this one.

    **The `library-backup.sh` failure is fixed.** `ops/library-backup.sh` replaces it,
    installed at `/usr/local/sbin/library-backup.sh` mode 0755 root owned, sha256
    `6d1c25f1...` matching the committed file, which a test now holds true against the
    checksum recorded in `ops/backup-digital-library.md`. Ownership is taken with `id -u`
    and `id -g`, never `$USER`. Every acceptance run is performed in the exact environment
    that broke the old one, `env -i` with no `USER` and cron's `PATH`, as `deploy` rather
    than as root: the retired script still prints `line 13: USER: unbound variable` and
    exits 1, while the new one completes its local half and prints a full summary line.
    The `deploy` crontab now points at the installed path, still two jobs at 03:30 and
    03:45. `/home/deploy/library-backup.sh` was renamed to `.retired-2026-08-24`, not
    deleted.

    **Both of Story 1-7's two bugs are fixed, not just the visible one.** The prune
    pattern is `library-*` bounded to regular files at depth one, which covers all three
    generations of naming the directory has held. Its first run removed 11 files, being
    the 25-day-old `.gz` and the ten `.db` files dated 2026-07-31 to 2026-08-09. Both of
    the two distinct SHA-256 contents Story 1-7 recorded survive inside the window, so no
    evidence was lost. The window is `-mtime +14`, which removes a file once it is 15
    whole days old rather than 14, and the record and the summary field both say so
    rather than rounding.

    **The verdict Story 1-7 could not reach is settled.** A `sqlite3 .backup` snapshot
    taken while another connection was committing 600 autocommit transactions landed
    strictly mid-sequence three times (2093, 2093 and 2096 rows against 2000 before and
    2600 after), passed `PRAGMA integrity_check` every time, and had contiguous ids with
    no truncated row. Windows and full evidence in `ops/backup-digital-library.md`.

    **What is not closed is the credential half**, which no agent can perform: the R2
    bucket, its scoped token, the passphrase and the offsite lifecycle rule. Until they
    exist the nightly job exits 75 every night and the estate still has no offsite copy of
    `digital-library`. That is enumerated as seven imperative Operator actions in
    `ops/backup-digital-library.md`, which is the record to read, not this ledger.

    **The estate-wide half of the second entry is untouched and stays open.** Story 1-8
    scopes `digital-library` only. `cs-tracker_pgdata`, `cuatro-portfolio_postgres_data`,
    `cs-tracker_caddy_data` and the rest still have no backup of any kind, no backup
    anywhere is offsite, and `cuatro-backup.sh`'s claim to complement a Hostinger weekly
    snapshot is still an unverified comment in a script.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-8-an-offsite-backup-path-for-digital-library.md`
  summary: >-
    No cron job on the box has its exit status monitored by anything. That is the actual
    reason the `library-backup.sh` failure survived 25 nights, and fixing one script does
    not fix it.
  evidence: |-
    Observed 2026-08-24. The `deploy` crontab's two jobs both append stdout and stderr to
    a log file under `/home/deploy/backups/<project>` and nothing reads either log. There
    is no `MAILTO`, no local MTA observed, and `ops/monitoring.md`'s probes are external
    HTTP and certificate checks against hostnames, which cannot see a backup job at all.

    Story 1-8 makes the signal correct rather than visible: the new job emits exactly one
    greppable summary line and an exit status that agrees with it, so a monitor now has
    something unambiguous to read. Nothing reads it. A backup that reports failure to
    nobody is the same failure mode as one that reports success falsely, and the estate
    has now demonstrated it once for 25 consecutive nights.

    The cheap closure is the same shape as the off-box certificate-age check already
    proposed in this ledger: a scheduled job that reads the last line of each backup log,
    or a healthcheck ping the job makes on exit 0. It is `ops/monitoring.md`'s file and
    another story's decision, so it is recorded rather than taken here.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-8-an-offsite-backup-path-for-digital-library.md`
  summary: >-
    The box now runs two different backup idioms, and `cuatro-backup.sh` is the one still
    uncommitted, unencrypted, unpruned by any reviewed code and local only. The three
    scripts Story 1-8 committed would cover it with a change of source command.
  evidence: |-
    Observed 2026-08-24. `/home/deploy/cuatro-backup.sh` is still an uncommitted script on
    the box, running `pg_dump -U tracker -Fc tracker` at 03:30 into
    `/home/deploy/backups/cuatro-tracker`, with its own inline `find -mtime +14 -delete`.
    Story 1-7 verified its retention arithmetic reconciles, so it is working, and it is
    still the same three defects Story 1-8 was written to remove from its sibling: no copy
    leaves the box, nothing is encrypted, and no committed test covers it.

    `ops/s3-object.sh` and `ops/library-restore-verify.sh` are deliberately generic about
    what they move: the first takes a file and a key, the second takes a key and proves a
    SQLite database. Pointing the same path at `pg_dump` output needs a Postgres flavoured
    restore check and nothing else, and it would reuse the same bucket, the same token and
    the same passphrase file. Recorded rather than done because Story 1-8's boundaries name
    `digital-library` and only `digital-library`, and because the same argument applies to
    `cs-tracker`'s and the Anchor's Postgres, neither of which has any backup at all. That
    is one story, not three, and it is not this one.

### DW-1: Nothing under `contracts/` identifies the folder to a repository that vendors it: no README, no source repository or commit, and no licence line.
origin: spec-deferred 3a3801b1c64f
location: contracts/
source_spec: `spec-1-11-publish-contracts-tokens-css-from-packages-tokens.md`
severity: medium
reason: AD-14 has seven repositories copy the folder under the fixed name `cuatro-contracts/`. The only provenance the published file carries is the header line "Generated from packages/tokens", which names a path that does not exist in a Satellite checkout, so a maintainer who finds a stale copy has no route back to the generator. AD-16 already makes a scheduled job read the `Contract vX.Y.Z` header across those repositories, which is a version but not an origin. Adding a second file under `contracts/` is a published-surface decision rather than a defect in this story, and Story 1.16 (serve `contracts/` at https://cuatro.dev/contracts/) is where the folder first acquires a public identity.
status: open

### DW-2: The bmad:context block in AGENTS.md describes a CI file, a suite size and a browser toolchain that stopped being true four stories ago.
origin: spec-deferred 591fb1589fe3
location: AGENTS.md:52-57
source_spec: `spec-1-14-ci-enforces-the-contract-boundary.md`
severity: low
reason: AGENTS.md:52-53 reads "CI (.github/workflows/ci.yml) runs typecheck and tests only" against a file that now carries five jobs, "The full suite is 38 tests in roughly 45 seconds" against a suite this story leaves at 474, and AGENTS.md:55-57 reads "Playwright is not installed" against a rendered-output job that runs pnpm test:e2e. Pre-existing: stale since Stories 1-10 and 1-11. Every story since has recorded it as a Pending Operator action rather than fixing it, because the block is managed by bmad-project-context and edits inside it are replaced on refresh, which is why this story's boundaries forbid touching it. It needs one bmad-project-context refresh, not a per-story note.
status: open

### DW-3: No job in ci.yml declares a permissions block, so all five inherit the repository default GITHUB_TOKEN scope rather than the contents:read they each need.
origin: spec-deferred 96247ee3936d
location: .github/workflows/ci.yml
source_spec: `spec-1-14-ci-enforces-the-contract-boundary.md`
severity: low
reason: .github/workflows/ci.yml declares no `permissions:` key at the top level and none on any of the five jobs. Every job here only reads the tree and runs a command, so `contents: read` is the whole requirement, and a single top-level block would close it for all five at once. The new contract-purity job's own comment claims that "nothing reaching this runner can redirect it", which is true of argv and of `env:` and says nothing about the token the runner hands the process. Pre-existing: the four jobs at b1e02da have the same gap, and this story's boundaries forbid touching them or any line of the file outside the job it adds, so closing it properly means one top-level key, which is a change to the file as a whole rather than to one job.
status: open

### DW-4: Follow-up review still recommended for 1-14-ci-enforces-the-contract-boundary after the damping cap was spent
origin: review-budget-followup
location: n/a
source_spec: `spec-1-14-ci-enforces-the-contract-boundary.md`
severity: low
reason: The follow-up-review damping cap (limits.max_followup_reviews = 1) was spent with the story finalized (status: done, verify green) while the review pass still recommended an independent follow-up. The work was committed by bmad-loop run 20260825-132509-427b; this entry preserves the lingering recommendation for a deliberate later review.
status: open

### DW-5: Follow-up review still recommended for 1-15-determine-cs-tracker-s-daisyui-adoption-route after the damping cap was spent
origin: review-budget-followup
location: n/a
source_spec: `spec-1-15-determine-cs-tracker-s-daisyui-adoption-route.md`
severity: low
reason: The follow-up-review damping cap (limits.max_followup_reviews = 1) was spent with the story finalized (status: done, verify green) while the review pass still recommended an independent follow-up. The work was committed by bmad-loop run 20260825-161421-c4ac; this entry preserves the lingering recommendation for a deliberate later review.
status: open

### DW-6: Three of the Hub's rendering surfaces, /cv, /recommendation and the 404, are visited by no test in this repository and captured by no screenshot baseline, and they are the only surfaces where the base
origin: spec-deferred 60453c2584eb
location: tests/e2e/rendered-output.pw.ts:21
source_spec: `spec-1-17-anchor-migration-step-1-add-the-contract-change-nothing.md`
severity: medium
reason: components/atoms/Container/Container.tsx:13-15 sets <body id={route}> from the stripped, hyphenated pathname, so /cv and /recommendation produce body#cv and body#recommendation and the 404 produces an id derived from whatever path was requested. None of the three matches body#work/body#projects (app/app.scss:53-55), body[id=''] (HomeLayout.scss:1-2) or #celeste (celeste.scss:1-2), so the base rule body { background: var(--black-color) } is what paints there. tests/e2e/rendered-output.pw.ts pins ROUTE = '/work' and every browser assertion in this story visits /work only, so nothing renders those three surfaces at all. This is pre-existing: Story 1-10 chose one route and one viewport deliberately and ops/rendered-output-harness.md states the limit. It is recorded because Story 1-18 redefines --black-color as a token reference, which is exactly the value those three surfaces paint, so the story most likely to move them is the next one.
status: open

### DW-7: Follow-up review still recommended for 1-17-anchor-migration-step-1-add-the-contract-change-nothing after the damping cap was spent
origin: review-budget-followup
location: n/a
source_spec: `spec-1-17-anchor-migration-step-1-add-the-contract-change-nothing.md`
severity: low
reason: The follow-up-review damping cap (limits.max_followup_reviews = 1) was spent with the story finalized (status: done, verify green) while the review pass still recommended an independent follow-up. The work was committed by bmad-loop run 20260826-004746-da95; this entry preserves the lingering recommendation for a deliberate later review.
status: open

### DW-8: The ground a visitor actually sees is still the cybercore literal on every route, because the hardcoded colour values in the component stylesheets are a later story's act and the alias layer cannot re
origin: spec-deferred a79a806f0a61
location: app/app.scss:107
source_spec: `spec-1-18-anchor-migration-step-2-alias-the-old-names-onto-the-token-r.md`
severity: medium
reason: app/app.scss:107 (body#work, body#projects), HomeLayout.scss:2 and error-page.scss:7 each paint #0a000f as a literal at a higher specificity than the base body rule, so the --token-bg this story wires onto --black-color is visible on the 404 surface and nowhere else. ProjectCard.scss:27,36,67, WorkItem.scss:35,145 and error-page.scss:9-10,28 carry the same shape of literal. Their mapping is rebaseline-2026-08-15.md section O-10 and it is assigned to UX-DR10 and the Epic 2 redesign, not to this migration step, so this is recorded rather than fixed. It matters because the story's user story is written at the pixel surface and the aliases are asserted at the custom-property surface, which is exactly the gap between "the Hub renders in the Ecosystem's visual identity" and what a visitor sees after this commit.
status: open

### DW-9: The retired display face is still preloaded on every route and the face that replaced it is not, so each page fetches roughly 20 KB it never paints and the first-paint width guarantee the preload exis
origin: spec-deferred 295c0abf8f2c
location: app/layout.tsx:41-45
source_spec: `spec-1-18-anchor-migration-step-2-alias-the-old-names-onto-the-token-r.md`
severity: medium
reason: app/layout.tsx:41-45 preloads /fonts/MonumentExtended-Bold.woff2 with as='font', and app/scss/_fonts.scss:92-95 still declares its @font-face. After this commit no rule resolves that family: the four --monument-bold call sites resolve to --f-display, which is Bricolage Grotesque, and contracts/fonts.css:16-22 publishes that face with font-display: swap and nothing preloads it. app/layout.tsx:39 states the preload's own purpose, "Preload display fonts so SplitText measures correct widths on first paint", and .glitch-text__inner is both a SplitText consumer and one of the four sites this story moved onto the display face. Nothing in the story observes the document head: every new assertion reads resolved CSS, and the one pixel baseline is /work, which renders no GlitchText. It is caused by this commit and it is outside this commit's stated edit boundary: the intent limits source edits to app/app.scss and the four font-weight lines, and app/layout.tsx is neither, so it belongs to the stor
status: open

### DW-10: The tech chip label fell from 9.16:1 to 2.56:1, across the 4.5:1 text floor, because --accent-dim lost its alpha to two opaque token roles and the label now reads against the chip fill rather than aga
origin: spec-deferred bc3c95f49531
location: components/organisms/WorkItem/WorkItem.scss:144
source_spec: `spec-1-18-anchor-migration-step-2-alias-the-old-names-onto-the-token-r.md`
severity: medium
reason: ProjectCard.scss:66 and WorkItem.scss:144 set background: var(--accent-dim) on a tech chip and color: var(--light-gray-color) on its label. Before this commit --accent-dim was rgba(91, 33, 182, 0.22), so the chip barely lifted the #0a000f ground and the label kept most of its 10.14:1. Both roles the mapping assigns are opaque. Measured 2026-08-26: the two after ratios already rasterised against #0a000f in ops/anchor-token-adoption.md give the label-on-fill ratio as their quotient, 0.3630 / 0.1418 = 2.56:1; the before figure composites rgba(91, 33, 182, 0.22) over #0a000f to rgb(28, 7, 52) against the pre-change #b4b4cc, giving 9.16:1. It is caused by this commit and every route to a fix is closed to it: the mapping is to be followed rather than invented, a chip-scoped third value would be an invented mapping, and giving the label its own colour means editing a component stylesheet beyond the four font-weight lines. The cheapest real fix is a chip fill of --token-bg-raised with the bord Amended 2026-09-06 by Story 2-9: half of this defect is gone with the component that carried it. ProjectCard.scss:66 was deleted when the Suite Directory replaced the card grid, so the location above moves to the surviving half, WorkItem.scss:144 on /work, which is unchanged and still at 2.56:1. The entry stays open on that half. The Suite Directory renders no tech chip at all: its tech line is unfilled mono text at --token-text-secondary, so the replacement did not reproduce the defect.
status: open

### DW-11: Eight local @font-face declarations are resolved by nothing after this commit, not the one the record previously named, and the story that retires the local faces inherits that inventory plus the publ
origin: spec-deferred 268fa6aabf8d
location: app/scss/_fonts.scss:20-95
source_spec: `spec-1-18-anchor-migration-step-2-alias-the-old-names-onto-the-token-r.md`
severity: low
reason: app/scss/_fonts.scss:20,30,40,50,60,72,82,92 declare GeneralSans-Light, GeneralSans-Regular, GeneralSans-Medium, GeneralSans-Semibold, GeneralSans-Bold, MonumentExtended-Light, MonumentExtended-Regular and MonumentExtended-Bold. --font-regular and --font-bold were the last consumers of the GeneralSans five and --monument-regular and --monument-bold of the Monument three; all four are now aliases onto --f-body and --f-display. Observed 2026-08-26 by git grep over app, components, hooks, content and contracts, which returns only the declarations themselves and the one preload at app/layout.tsx:42. Not fixed here because app/scss/_fonts.scss is neither app/app.scss nor one of the four font-weight lines. Recorded in ops/anchor-token-adoption.md, "Stated limits of step 2".
status: open

### DW-12: The comment carrying the two @use lines that load the contract still states that nothing in the repository consumes any of these names, which is the claim this commit falsified.
origin: spec-deferred dd454bb484eb
location: app/scss/_index.scss:29-32
source_spec: `spec-1-18-anchor-migration-step-2-alias-the-old-names-onto-the-token-r.md`
severity: low
reason: app/scss/_index.scss:29-32 reads "Nothing in this repository consumes any of these names yet, and that is the point: this story adds the contract and changes no pixel", written by Story 1-17. The alias layer in app/app.scss is now a consumer of ten roles and the four font-weight call sites of one more. The comment goes on to name Story 1-18 as the commit that will change it, so it is stale rather than misleading to a careful reader, but it sits directly on the two loads it explains. Not fixed here: app/scss/_index.scss is neither app/app.scss nor one of the four font-weight lines, and this story's contract admits no third source file. Recorded in ops/anchor-token-adoption.md, "Stated limits of step 2".
status: open

### DW-13: Follow-up review still recommended for 1-18-anchor-migration-step-2-alias-the-old-names-onto-the-token-r after the damping cap was spent
origin: review-budget-followup
location: n/a
source_spec: `spec-1-18-anchor-migration-step-2-alias-the-old-names-onto-the-token-r.md`
severity: low
reason: The follow-up-review damping cap (limits.max_followup_reviews = 1) was spent with the story finalized (status: done, verify green) while the review pass still recommended an independent follow-up. The work was committed by bmad-loop run 20260826-202635-4db0; this entry preserves the lingering recommendation for a deliberate later review.
status: open

### DW-14: Nothing that runs on a schedule or in a gate can see the token mapping stop resolving in `cs-tracker`, because that repository has no CI at all and the only instrument that reads rendered output is a
origin: spec-deferred 2a05e43684bb
location: C:\CuatroEcosystem\cs-tracker-workspace\cs-tracker
source_spec: `spec-1-19-cs-tracker-adopts-the-token-contract.md`
severity: medium
reason: Observed 2026-08-27. `cs-tracker` has no `.github` directory; `mix precommit` is its only gate, and every case in `test/cs_tracker_web/token_contract_test.exs` asserts against the text of `assets/css/app.css` rather than against a compiled or rendered stylesheet. `ops/cs-tracker-adoption-probe.mjs` is deliberately not a CI job, because it needs a browser and a checkout of the other repository and neither is on a runner. So a route-A regression that leaves the source text untouched, which is exactly the shape a Tailwind or daisyUI bump takes, ships with everything green. This is the standing shape of the verification rather than a defect this story introduced, and it is the reason both probes' re-run is handed to the Operator. It is recorded here because the estate now has two adopted applications and one un-gated hand-run check between them, which is a growing exposure rather than a fixed one.
status: open

### DW-15: `contracts/tailwind.css` maps the spacing scale onto named keys, which silently redefines Tailwind's `max-w-sm` through `max-w-2xl` from container widths to spacing values in every consumer.
origin: operator-observed 2026-08-27
location: contracts/tailwind.css:76-85
source_spec: `spec-1-19-cs-tracker-adopts-the-token-contract.md`
severity: high
reason: |-
  Observed 2026-08-27 on the deployed `cs-tracker.cuatro.dev`, from a screenshot the
  Operator took after the adoption. An empty-state card reading "Items you view will
  show up here" wrapped to one or two words per line. The container is
  `<div class="flex max-w-md flex-col items-center gap-3">` and it computed to
  `max-width: 16px`, against the 28rem that `max-w-md` means in stock Tailwind v4.

  The cause is the `@theme` block at `contracts/tailwind.css:76-85`, which maps the
  contract's spacing scale onto NAMED keys: `--spacing-md: var(--s-md)` and its seven
  siblings. Tailwind v4 resolves `max-w-md` from `--container-md` when nothing else
  claims the key, but a named `--spacing-md` takes precedence, and `--s-md` is `1rem`.
  So `max-w-md` became 16px. The same applies to `sm`, `lg`, `xl` and `2xl`, which are
  all both spacing names and container names.

  This is a defect in the published contract, not in `cs-tracker`. AD-14 has seven
  repositories vendor this file, and every one that writes `max-w-md` gets a 16px
  container instead of a 448px one. It is high severity because it is silent: nothing
  errors, the utility resolves, and the page merely looks wrong in a way that reads as
  a styling mistake in the consumer rather than as a contract fault.

  It survived Story 1-19's gates because `cuatro.dev` uses Sass rather than Tailwind
  utilities, so the Hub cannot exercise `max-w-*` at all, and `cs-tracker`'s own tests
  assert against the text of `app.css` rather than against rendered output. The first
  instrument to see it was a human looking at a screenshot.

  Not fixed here because the remedy is a published-surface change with more than one
  defensible shape: rename the spacing keys so they cannot collide (`--spacing-s-md`),
  restate the container scale explicitly beside the spacing scale, or drop the named
  spacing keys and require the numeric scale. Choosing between those is a contract
  decision, and the contract is versioned under AD-16.
status: open

### DW-16: `bandit 1.11.1`, the HTTP server in front of `cs-tracker.cuatro.dev`, carries two HIGH advisories that are both remote-triggerable resource exhaustion.
origin: operator-observed 2026-08-27
location: C:\CuatroEcosystem\cs-tracker-workspace\cs-tracker (mix.lock)
source_spec: `spec-1-19-cs-tracker-adopts-the-token-contract.md`
severity: high
reason: |-
  Observed 2026-08-27 in the deploy build log, printed by `mix deps.get` as
  `bandit 1.11.1 VULNERABLE!`. Three advisories:

  - EEF-CVE-2026-74836 (HIGH, CVE-2026-74836, GHSA-xj8g-532w-jv94): HTTP/2
    connection-window starvation pins Plug processes indefinitely.
  - EEF-CVE-2026-65623 (HIGH, CVE-2026-65623, GHSA-vg8x-66vg-5pxh): quadratic CPU
    blow-up reassembling fragmented WebSocket messages.
  - EEF-CVE-2026-75484 (MEDIUM, CVE-2026-75484, GHSA-x3gh-xhj4-3vq8): HTTP/2 header
    values containing CR, LF or NUL are passed to the application unvalidated.

  Why this matters more here than the severities alone suggest: both HIGH entries are
  remote-triggerable resource exhaustion, and `cs-tracker` shares a two vCPU box with
  the Anchor, `cuatro-tracker` and `digital-library`. `ops/capacity-measurement.md`
  measured the whole estate at 3.0% of that box, so there is headroom, but the failure
  mode of both advisories is one application consuming the box rather than degrading
  alone. `cs-tracker` also uses LiveView, which means WebSocket traffic is its normal
  operating mode rather than an edge case, and that is the second advisory's surface.

  Mitigating context, stated so the severity is not overstated: the hostname is proxied
  through Cloudflare (Story 1-3), so the origin is not directly reachable over v4 or v6
  and an attacker has to come through the edge, where the bot mitigation and the managed
  challenge apply.

  Not fixed here because a dependency bump on a serving application is its own change
  with its own verification, and this story's boundary is the token contract. The fix is
  to raise `bandit` in `mix.lock` to a release carrying the patches and redeploy.
status: open

### DW-17: The Operator's cs-tracker commit 32a466a removed cuatro.fonts from the assets.setup alias after this story's rehearsal, so Story 1-19's record, its probe pin "The build pipeline places them" and cs-tr
origin: spec-deferred dd2c45a1f4b2
location: ops/cs-tracker-adoption-probe.mjs
source_spec: `spec-1-20-record-the-adopted-contract-version-and-the-automation-polic.md`
severity: medium
reason: Observed 2026-08-27T22:47:57Z by `node ops/cs-tracker-adoption-probe.mjs` against `cs-tracker` at `32a466a`: 19 cases, 18 PASS, 1 FAIL, the failure reading `It runs in assets.setup: false`. `git -C cs-tracker show 32a466a -- mix.exs` removes `"cuatro.fonts"` from `"assets.setup"` and says why: the Dockerfile runs `assets.setup` before `COPY lib lib` and `COPY assets assets`, so the task could not be found there and the container build broke on 2026-08-27, while `setup` still reaches `assets.build`, which runs it. Not caused by this story and not its to reconcile: the pin, the record row and the `cs-tracker/AGENTS.md` lines are Story 1-19's, which is awaiting-operator. Recorded in `ops/contract-adoption.md` as Pending Operator action 7 and the pin left red deliberately rather than moved.
status: open

### DW-18: Follow-up review still recommended for 1-20-record-the-adopted-contract-version-and-the-automation-polic after the damping cap was spent
origin: review-budget-followup
location: n/a
source_spec: `spec-1-20-record-the-adopted-contract-version-and-the-automation-polic.md`
severity: low
reason: The follow-up-review damping cap (limits.max_followup_reviews = 1) was spent with the story finalized (status: done, verify green) while the review pass still recommended an independent follow-up. The work was committed by bmad-loop run 20260827-161430-4676; this entry preserves the lingering recommendation for a deliberate later review.
status: open

### DW-19: Nothing pins what `contracts/tailwind.css` makes `max-w-*` resolve to, so DW-15 shipped silently and its eventual fix has no gate to prove it landed.
origin: operator-approved 2026-08-28
location: contracts/tailwind.css:76-85, and an absent test under ops/__tests__/
source_spec: n/a, raised by the `bmad-project-context` refresh of 2026-08-28
severity: medium
reason: |-
  Observed 2026-08-28 by compiling the published adapter with the repository's own
  `tailwindcss` 4.3.3: a probe importing `contracts/tailwind.css` and using `max-w-md`
  emits `max-width: var(--s-md)`, which is `1rem`. `--container-md: 28rem` is present
  in the same output and loses. That is DW-15 reproduced mechanically, off a checkout,
  with no browser and no consumer repository involved.

  The gap this entry records is not the defect, which DW-15 holds. It is that the
  `tokens-contract` and `fonts-contract` jobs both compare generated output against
  committed output, so they prove the file is what the generator makes and neither says
  anything about what the file MEANS to a consumer. A named spacing key shadowing a
  container key is invisible to a byte comparison, which is why the first instrument to
  see DW-15 was a human looking at a screenshot.

  **Decision deferred, not taken.** Whether the check asserts today's behaviour, which
  documents the defect and turns red when DW-15's fix lands, or asserts the intended
  container widths, which is red now and green when the fix lands. The second is the
  useful shape if the fix is scheduled and the first is the useful shape if it is not,
  and that ordering belongs to DW-15's contract decision under AD-16 rather than here.
  Either shape is a Node test under `ops/__tests__/` running the same compile, with no
  browser, so it fits the runners the way `contract-purity` already does.
status: open

### DW-20: A failed deploy is reported to nobody, and the monitoring that exists watches the site rather than the pipeline.
origin: operator-approved 2026-08-28
location: .github/workflows/deploy.yml
source_spec: n/a, raised by the `bmad-project-context` refresh of 2026-08-28
severity: medium
reason: |-
  Observed 2026-08-28 by reading the file. `.github/workflows/deploy.yml` runs on push
  to `main` and carries three steps, none of which reports a failure: no `if: failure()`
  step, no issue, no webhook.

  `ops/monitoring.md` covers external uptime and certificate age, which is a different
  instrument answering a different question. An uptime monitor sees the site as it was
  before a deploy that never ran, so a deploy that fails while the previous release
  keeps serving stays green on every signal the estate currently has. That is the exact
  shape of the twelve day break recorded in the AGENTS.md pitfall, and it recurs
  because nothing merges to `main` often enough for a human to notice the absence.

  The remedy is small and has no contract dimension: a step conditioned on failure that
  reaches the Operator on the channel `ops/monitoring.md` already establishes. Recorded
  rather than done because this refresh's boundary was the AGENTS.md block, and a change
  to `deploy.yml` is a deploy path change that deserves its own story and its own
  verification.
status: open
### DW-21: Four content defects of the same class as the one story 2-1 fixed still ship to the page from `content/work.ts`.
origin: spec-deferred 2026-08-29
location: content/work.ts:44
source_spec: `spec-2-1-the-pre-existing-repository-defects.md`
severity: low
reason: |-
  Found by the story 2-1 review while the `Dev.` typo was being corrected, and left alone
  because that spec's Never clause forbids fixing unrelated defects opportunistically and
  padding the diff.

  `content/work.ts:44` reads `'Nests.js'` for Nest.js and `:130` reads `'Emal Development'`
  for email development. The file is also inconsistent about two names it spells both ways:
  `Javascript` at `:34` against `JavaScript` at `:146`, and `Typescript` at `:79` against
  `TypeScript` at `:35`.

  These are not cosmetic. `WorkItem.tsx:98-102` renders every `tech` entry as an `<li>`, so
  all four reach the rendered CV exactly the way `Dev. 2025` did, and this is a page whose
  audience is technical readers judging the author on it. The new guard added by story 2-1,
  `content/__tests__/work.test.ts`, covers `period` only and would not catch any of them.

  Whether the `tech` arrays should be pinned against a vocabulary the way `period` is now
  pinned against the twelve-month set is the open question, and it belongs with story 2-6,
  the editorial voice pass, rather than with a defect fix.
status: open

### DW-22: Two implementations of the same Playwright navigation guard, and six spec files that get neither.
origin: spec-deferred 2026-08-29
location: tests/e2e/celeste-header.pw.ts:25
source_spec: `spec-2-1-the-pre-existing-repository-defects.md`
severity: low
reason: |-
  `tests/e2e/harness.ts:66-84` refuses to read anything off a page that produced no response
  or answered non-2xx, because an unchecked status is how an error page becomes a baseline.
  That guard lives inside `expectRouteScreenshot`, so it is reachable only by a test taking a
  screenshot.

  Story 2-1 needed the same guard for an assertions-only spec and reimplemented it as a local
  `goTo`, with different message wording. The harness header states its contract is that every
  helper names the route, selector or property it was asked for in any failure, and there are
  now two implementations of that rule which can drift apart.

  The remedy is to hoist one navigation helper into `harness.ts` and have both call it, which
  also gives it to the other `.pw.ts` files that today call `page.goto` with no status check at
  all. Deferred rather than done because it edits a file shared by every rendered assertion in
  the repository, which is a change that deserves its own verification rather than riding along
  inside a defect fix.
status: open

### DW-23: The container invocation that actually runs the e2e suite is nowhere recorded, and the one a reader would construct fails.
origin: spec-deferred 2026-08-29
location: ops/rendered-output-harness.md
source_spec: `spec-2-1-the-pre-existing-repository-defects.md`
severity: medium
reason: |-
  Measured 2026-08-29 while verifying story 2-1. `AGENTS.md` says to regenerate baselines inside
  `mcr.microsoft.com/playwright:v1.62.1-noble` and never on the host, which is correct, but no
  file records how to start the suite in that image.

  The obvious invocation does not work. `playwright.config.ts:85` sets `webServer.command` to
  `pnpm build && pnpm start`, and bare `pnpm` is not on PATH in that image: CI only has it
  because `pnpm/action-setup` puts it there. The run dies with `pnpm: not found` and exit 127,
  which reads as a broken harness rather than a missing tool. What works is `corepack enable`
  first, then `corepack pnpm install --frozen-lockfile && corepack pnpm test:e2e`.

  On a Windows host there is a second step: the repository is bind-mounted, so the Linux install
  overwrites the host's `node_modules` unless it is masked with a Docker volume. Without that,
  running the container suite silently breaks the host toolchain, and the symptom appears later
  in an unrelated command.

  Both belong in `ops/rendered-output-harness.md` beside the tolerance and its reasoning, since
  that file is where a reader goes to run this harness. Deferred rather than done because the
  story 2-1 spec's scope was the two defects and their tests, and `ops/` is the estate's
  operational record rather than story output.
status: open

### DW-24: The font reachability pass reads `font-family` declarations only, so a family named through the `font` shorthand or defined only under a theme selector would read as unreachable.
origin: spec-deferred 2026-08-29
location: ops/asset-budget.mjs
source_spec: `spec-2-2-measure-the-narrative-bundle-against-the-asset-budget.md`
severity: low
reason: |-
  Found 2026-08-29 by the story 2-2 review layers. `resolveFontReachability` reads the built CSS
  for `font-family` declarations and follows `var()` chains to a fixed point. Two shapes escape it.
  A family named only through the `font` shorthand (`font: 700 1rem/1.2 Geist`) carries the family
  in its tail and is never read. A custom property redefined under a theme selector or a media
  query is recorded once rather than per definition, so a family reachable only through the earlier
  definition reads as unreachable.

  Neither shape exists in the Hub today, confirmed by grep across `app/` and `components/`, so no
  figure in `ops/asset-budget.md` is wrong because of it. It is filed because the reachability
  column is what a later story would use to justify deleting a face, and a false unreachable is the
  expensive direction. Story 2.20 retires the legacy faces and is the natural place to widen the
  method, since it is the story that acts on the column.
status: open

### DW-25: `ops/asset-budget.mjs` re-reads the whole source tree on every call and re-gzips each chunk once per referencing document.
origin: spec-deferred 2026-08-29
location: ops/asset-budget.mjs
source_spec: `spec-2-2-measure-the-narrative-bundle-against-the-asset-budget.md`
severity: low
reason: |-
  Found 2026-08-29 by the story 2-2 review layers. `collect` calls `findReferences` once per asset
  and `findImporters` once per unique referrer and again per module in the orphan sweep, and each
  call re-reads its whole file list from disk. Separately, every referenced chunk is read and
  gzipped again for each of the eight documents that reference it, even though the `chunks` map
  already holds the gzipped size keyed by that exact path.

  The cost is invisible today: the tool finishes in seconds on eight flat routes and it is run by
  hand rather than in CI, so nothing gates on its runtime. It is filed because the work grows with
  routes and with the source tree, and Epic 2 adds routes while Epic 3 moves the whole application
  under `apps/hub`. One read into a map removes the chunk half of it outright.
status: open

### DW-26: `contracts/registry.schema.json` cannot carry `minItems: 1` on `applications` until Story 2.5 authors entries, so a Registry that loses every entry validates.
origin: spec-deferred 2026-08-29
location: contracts/registry.schema.json
source_spec: `spec-2-3-the-registry-schema-and-its-blocking-ci-gate.md`
severity: medium
reason: |-
  Story 2-3 ships the envelope with `applications: []` so the gate has a real instance from its
  first run rather than a check that passes over nothing. A `minItems: 1` written today would fail
  on the file the same story ships, so the one entry-count rule the schema could carry is
  deliberately absent.

  The consequence is narrow but real: once Story 2.5 authors the entries, an edit that empties the
  array validates, and the Hub would render an empty Suite Directory from a green build. The
  tightening belongs in Story 2.5, in the same commit that first makes it true, and
  `ops/registry-schema.md` names it as a pending Operator action. Filed here as well because the
  record is not the mechanism the estate uses for cross-story carryover, and a tightening that
  survives only if the next author reads one `ops/` file is a tightening that will not happen.

  Closed 2026-09-03 by `spec-2-5-author-contracts-registry-json.md`, in the same commit that
  authored the fourteen entries, and demonstrated failing against an emptied envelope. The standing
  case that asserted `minItems` was absent now asserts it is 1.
status: done

### DW-27: The Registry gate applies one structural rule beyond the schema, so `absorbed_into` and `family` are unchecked references.
origin: spec-deferred 2026-08-29
location: ops/registry-schema.mjs
source_spec: `spec-2-3-the-registry-schema-and-its-blocking-ci-gate.md`
severity: medium
reason: |-
  Found 2026-08-29 by the story 2-3 review layers. Draft-07 cannot express uniqueness or referential
  integrity, so the gate carries those rules itself, and it carries exactly one: duplicate `id`. An
  `absorbed_into` naming an id no entry holds, or naming the entry's own id, validates. So does a
  `family` value only one entry carries, which is a grouping key that groups nothing.

  Nothing is wrong today because `applications` is empty. It becomes live work in Story 2.5, which
  authors `absorbed_into: cuatro-tracker` on `tcg-tracker` and `absorbed_into: cuatro-portfolio` on
  `connect-four-react` under AD-6, and which sets `family` on exactly three of the four Tracker
  entries. A typo in either is caught by nothing: not by the gate, not by the editor, and not by
  AD-18's scheduled check, which verifies `source`, `live` and `token_contract` against reality and
  says nothing about references inside the file. The same argument that justified the duplicate-`id`
  rule justifies this one, and it belongs beside it, in Story 2.5 or before.

  Closed 2026-09-03 by `spec-2-5-author-contracts-registry-json.md`. Two rules were added beside
  the duplicate-id one, `absorbed_into resolves` and `family groups`, both exported by name with
  standing cases and both demonstrated failing against a planted fixture. `family` is deliberately
  not held to naming an entry: it is a grouping label, not a reference, and `tracker-family` is the
  id of none of its three members.
status: done

### DW-28: A Registry object carrying the same key twice validates, because `JSON.parse` silently keeps the last one.
origin: spec-deferred 2026-08-29
location: ops/registry-schema.mjs
source_spec: `spec-2-3-the-registry-schema-and-its-blocking-ci-gate.md`
severity: low
reason: |-
  Found 2026-08-29 by the story 2-3 review layers. An entry written with two `status` keys parses to
  one value, the last, and the gate validates that value. The editor half of AD-4 does flag a
  duplicate key, so the two readers disagree: the author sees a warning while the gate is green, or
  the reverse if the value the editor is looking at is not the one that survived the parse.

  Detecting it needs a scanner rather than a `JSON.parse` option, since a reviver never sees the
  discarded value, which is why it is filed rather than fixed inside the story. The exposure is a
  hand-authored file with one author, so the realistic case is a merge that duplicates a key rather
  than a mistake nobody would make. `ops/registry-schema.md` records it as a stated limit.
status: open

### DW-29: `tests/e2e/contract-serving.pw.ts:68-72` still says `contracts/registry.json` arrives in Story 2-5.
origin: spec-deferred 2026-08-29
location: tests/e2e/contract-serving.pw.ts
source_spec: `spec-2-3-the-registry-schema-and-its-blocking-ci-gate.md`
severity: low
reason: |-
  Found 2026-08-29 by the story 2-3 review layers. The comment was accurate when it was written and
  is not any more: the Registry and its schema arrived in Story 2-3, and the spec that identified
  the file as already correct forbade touching `tests/` and made an unchanged `tests/` an acceptance
  criterion, so the comment could not be corrected in the same story that falsified it.

  Nothing fails because of it. The spec enumerates the surface at runtime and already expected
  `application/json`, so the file's behaviour was right before the comment went stale. It is one
  line, and the natural place to take it is the next story that touches this spec for another
  reason, or Story 2.5 when the file stops being an empty envelope.
status: open

### DW-30: The `test` job has been red on every CI run since 2026-08-28, on one case that asserts Windows path semantics and therefore cannot pass on the runner.
origin: spec-deferred 2026-08-31
location: ops/__tests__/cs-tracker-accessibility-probe.test.ts
source_spec: `spec-2-3-the-registry-schema-and-its-blocking-ci-gate.md`
severity: high
reason: |-
  Observed 2026-08-31 by watching run 33434472577, and confirmed against the four runs before it:
  `c490f33`, `967abfd`, `9662d03` and `cdacfee` all failed the same single case, so the estate's only
  pre-production gate has been red since 2026-08-28 with nobody stopped by it. AD-21 makes every CI
  gate blocking precisely because there is no staging, and a job that is always red is a job whose
  next real failure is indistinguishable from its standing one.

  The failure is not a defect in the probe. `samePath` in `ops/cs-tracker-accessibility-probe.mjs`
  normalises with `resolve(String(p)).replace(/\\/g, '/').toLowerCase()`, which calls `resolve`
  before the separators are converted. On Linux a backslash is an ordinary filename character, so
  `resolve('C:\\Repo\\ops\\..\\ops\\probe.mjs')` prefixes the working directory and collapses
  nothing; the `..` survives the later replace and the two sides compare unequal. The case at
  `ops/__tests__/cs-tracker-accessibility-probe.test.ts:263` therefore passes on the Windows
  authoring host and can never pass on `ubuntu-latest`. The two cases either side of it pass on both,
  because neither carries a `..`.

  Two fixes, and they are not equivalent. Converting the separators before resolving rather than
  after (`resolve(String(p).replace(/\\/g, '/'))`) makes the comparison correct on both platforms and
  keeps all three assertions, which is the better one: the invoked-directly guard this function
  serves must never answer "no" wrongly, or the probe does nothing when it is run. Making the third
  assertion conditional on `process.platform` only stops the red and leaves the same latent wrong
  answer. Either way it belongs to a story that owns `ops/cs-tracker-accessibility-probe.mjs`, since
  the first fix changes production behaviour in an Epic 1 deliverable. Filed at `1b7cc1c` being the
  last green run, and `bf23fac` (Story 1-20) being where the file arrived.

  **Closed 2026-08-31 at `415e05b`**, by the Operator's instruction, taking the first fix:
  `norm` converts separators before it resolves and again after, so `..` collapses on both
  platforms. Demonstrated before the push by running both the old and the new normalisation under
  `path.posix.resolve`, which is what the runner does: the old one answers `false` on the `..` case
  and the new one `true`, with the other three cases unchanged either way. The case at
  `ops/__tests__/cs-tracker-accessibility-probe.test.ts:263` is kept rather than made conditional on
  `process.platform`, and a forward-slash `..` case is added beside it so the pair reads as being
  about the separator rather than about `..`.
status: done
- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-confirm-the-assumed-statuses-hostnames-and-tech-values.md`
  summary: >-
    AD-3 asserts an application id is lowercase kebab-case AND equal to its repository name.
    Four repositories are not lowercase, so both halves cannot hold and Story 2-5 must
    adjudicate id casing mid-flight unless the Operator rules first.
  evidence: |-
    `ARCHITECTURE-SPINE.md:98` states both halves in one sentence. The blocking gate enforces
    the first: `contracts/registry.schema.json:44` pins `^[a-z0-9]+(-[a-z0-9]+)*$`, and
    `ops/__tests__/registry-schema.test.ts:676` has a standing case refusing a capitalised id.
    The four repositories are `Lumen`, `StreamVault`, `MaiCoin` and `Mutuo`, observed
    2026-09-02 by an account listing.

    Three resolutions and they are not equivalent: lowercase the ids and give up "equal to its
    repository name" for those four, rename the repositories, or narrow AD-3's second half to
    a default rather than a rule. The first is cheapest and breaks the derivation AD-3 uses for
    GHCR image, compose service, Traefik router, Postgres role and Clerk client names, all of
    which are already lowercase in practice. Recorded as stated limit 0 in
    `ops/registry-inputs.md`, and the `source` values there are spelled with real
    capitalisation so the drill-through link is correct whichever way the id goes.

    This is pre-existing and was not introduced by Story 2-4. It is filed because Story 2-4
    exists to remove exactly this class of decision from Story 2-5 and did not remove this one.

    Closed 2026-09-03 by an Operator ruling taken at Story 2-5's planning checkpoint, before any
    entry was authored, so it was never the mid-flight escalation it was filed to prevent. The
    first resolution was taken: AD-3's second half narrows to "the lowercase kebab-case form of
    its repository name", the four ids are `lumen`, `streamvault`, `maicoin` and `mutuo`, no
    repository was renamed and the schema pattern is unchanged. `ARCHITECTURE-SPINE.md:98` and
    its conventions row were amended in the same change, and the full reasoning is stated limit 0
    of `ops/registry-inputs.md`.
  status: done

- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-confirm-the-assumed-statuses-hostnames-and-tech-values.md`
  summary: >-
    `ops/routing-inventory.md` still carries four handovers to Story 2-4 as open questions, and
    one citation into `ops/estate.md` that Story 2-4 made false in both its line number and its
    fact.
  evidence: |-
    `AGENTS.md` names `routing-inventory.md` first among the operational records to read, so a
    reader arriving there is sent to look for decisions that have already been taken.

    `:488` states "`ops/estate.md:92` carries `[ASSUMPTION: Live on Vercel]`". That cell now
    reads ``Live``: `inclusivcup.vercel.app`, and `:92` is unrelated prose after this story
    inserted roughly forty lines above it. `:453-454`, `:501`, `:1605` and `:1693` still
    describe the `covidmap` and `future-vizion` membership question as owned by Story 2-4 and
    undecided; it was ruled on 2026-09-02 and is KV-3 in `ops/known-violations.md`.

    Story 2-4's Tasks did not name `routing-inventory.md`, and its acceptance criteria hold the
    diff to four files, so the repair belongs to a story that owns that file. The repair itself
    is what that file already prescribes for drifting citations: name the heading, give the
    dated line number second.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-confirm-the-assumed-statuses-hostnames-and-tech-values.md`
  summary: >-
    `epics.md:2141` says Story 2-4 closes open items O-4, O-5 and PRD section 13 Q9. The
    decisions were taken and recorded, but none of the three registers that carry those items
    was marked closed.
  evidence: |-
    The registers are `ARCHITECTURE-SPINE.md:460` (the open-questions list naming the
    `cs-tournament` and `list-wheel` hostnames) and the equivalent entries in
    `EXPERIENCE.md:1049-1050`. `ops/registry-inputs.md` still refers to "open item O-5" in the
    present tense, which is accurate about the register and misleading about the decision.

    The substance is done: `cs-tournament` is `Live` at `inclusivcup.vercel.app`, `list-wheel`
    takes `wheel.cuatro.dev`, and both Statuses are confirmed. What is missing is the
    bookkeeping in the planning artifacts, which Story 2-4's Tasks did not cover and which its
    acceptance criteria forbid it from touching.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-confirm-the-assumed-statuses-hostnames-and-tech-values.md`
  summary: >-
    The `ops/registry-inputs.md` pointer Story 2-4 added to AGENTS.md sits inside the managed
    `bmad:context` block and will be dropped by the next `/bmad-project-context` refresh, with
    no test turning red.
  evidence: |-
    `AGENTS.md:2` says edits inside the block are replaced on refresh, and the markers are at
    `:1` and `:148`. The edit adding "22 records" and the `registry-inputs.md` clause is at
    `:32-40`, inside them. `ops/__tests__/contract-adoption.test.ts:439-454` is the only test
    over `AGENTS.md` and deliberately asserts the dependency-automation policy sits *after* the
    closing marker, commenting that nothing else would turn red if a refresh dropped it.

    Story 2-3 did the same thing for `registry-schema.md` and the spec directed it here, so
    this is the established pattern rather than a deviation. DW-2 already records the general
    problem and a `/bmad-project-context` refresh is already booked as a reminder in
    `sprint-status.yaml` before epic 3. Filed so the two record pointers are re-checked after
    that refresh runs, not before.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-author-contracts-registry-json.md`
  summary: >-
    `epics.md:2202-2204` still states Story 2.5's acceptance as "each id matches its repository name
    exactly", which four shipped entries deliberately do not satisfy after AD-3 was narrowed. The
    spine was amended and the epic was not, so the two now disagree.
  evidence: |-
    The Operator narrowed AD-3 on 2026-09-03 so an id is the repository name lowercased.
    `ARCHITECTURE-SPINE.md`'s AD-3 rule and its conventions row were amended in the same change.
    `epics.md` was not, and it is the artifact the remaining Epic 2 stories are specced from, so the
    next author reading Story 2.6 or 2.7 finds the superseded rule stated as an acceptance criterion.

    Not fixed in Story 2-5 because amending the acceptance criteria of an epic after the story has
    shipped is a different kind of edit from recording a ruling, and `epics.md` also carries the
    `list-wheel` hostname deviation Story 2-4 already recorded against `:2155-2156`. Both are the
    same job: one pass over Epic 2's text reconciling it with the rulings taken during execution.

    The substance is settled and recorded in `ARCHITECTURE-SPINE.md` and in stated limit 0 of
    `ops/registry-inputs.md`. What is missing is the bookkeeping in the planning artifact.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-author-contracts-registry-json.md`
  summary: >-
    Nothing holds `contracts/registry.json` equal to `ops/registry-inputs.md`, and the Operator
    deferred the check on 2026-09-03. Filed here because the same argument DW-26 makes says an
    `ops/` stated limit is not the mechanism that survives.
  evidence: |-
    Fourteen entries were transcribed by hand from `ops/registry-inputs.md`. No test reads both
    files, the gate validates shape rather than content, and FR-32's scheduled link check is Story
    2.23 and does not exist. A `tech` value corrected in one file and not the other is invisible,
    and FR-9 makes a wrong `tech` value a defect rather than a cosmetic issue.

    `minItems: 1` covers only the degenerate case: an emptied array is now a refusal, an array cut
    from fourteen entries to one is not. `ops/estate.md`'s disposition table is a third listing of
    the same fourteen applications and is equally unguarded.

    Recorded as stated limit 1 of `ops/registry-inputs.md` and in `ops/registry-schema.md`'s stated
    limits. DW-26's own closing argument was that "a tightening that survives only if the next author
    reads one `ops/` file is a tightening that will not happen", which applies to this one too.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-author-contracts-registry-json.md`
  summary: >-
    The `token_contract` value Story 2-5 authored on the `cs-tracker` entry is held equal to nothing,
    so `ops/contract-adoption.md`'s runbook step 5 is the only thing keeping the Registry's adopted
    version in step with the vendored header.
  evidence: |-
    `contracts/registry.json` now carries `"token_contract": "1.0.0"` on `cs-tracker`, the field's
    first populated value anywhere. The schema constrains it to `^\d+\.\d+\.\d+$` and nothing else,
    and no test in the repository reads the value: the only non-prose hits for `token_contract` are
    the schema's own definition, the field name inside the `Object.keys(fields)` list in
    `ops/__tests__/registry-schema.test.ts`, and two comments in `ops/cs-tracker-adoption-probe.mjs`.

    `ops/__tests__/contract-adoption.test.ts` already imports `recordedAdoptedVersion` and parses
    `ops/contract-adoption.md`, so the check is one case in a file that has the record loaded: read
    the committed Registry and compare the two. It was not added here because the spec's Code Map
    scoped the test work to `ops/__tests__/registry-schema.test.ts`.

    Consequence on the next contract bump: the vendored header moves and the record moves, both
    pinned by the blocking `test` job, while the Registry's declaration does not, and the gate still
    exits 0. That is exactly the drift AD-16 and AD-18 exist to catch, and AD-18's scheduled job is
    Story 2.23.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-author-contracts-registry-json.md`
  summary: >-
    Story 2.6 inherits three description problems Story 2-5 found and was ruled not to fix: two of
    the six `EXPERIENCE.md` drafts contradict their repositories, a third contradicts the Registry
    itself, and five of the eight authored descriptions end with the same sentence.
  evidence: |-
    Recorded in full in `ops/registry-inputs.md` under "The transcription happened, 2026-09-03".
    Filed here as well because that is one `ops/` file the next author has to know to open, and
    Story 2.6's own epic text points at `EXPERIENCE.md` rather than at this record.

    `cs-tracker`'s repository describes a "Personal CS2 skins tracker, single-user, local-only"
    where the shipped draft says it tracks "matches and player statistics". `cuatro-tracker`'s
    describes a media tracker for "movies, TV shows, anime, manga, and video games" where the draft
    says "collections and what is still missing from them". `cuatro-portfolio`'s draft says the Hub
    "lists every application that is running", while the file it describes carries five `In progress`
    and three `Archived` entries.

    The drafts shipped verbatim under an Operator ruling of 2026-09-03, on the ground that Story 2.6
    confirms them against the running software and GitHub metadata is a weaker source than either.

    Closed 2026-09-03 by Story `2-6-the-editorial-voice-pass`. All three contradictions were resolved
    against a local checkout rather than against the metadata that raised them: `cs-tracker`'s
    contexts are `catalog`, `inventory`, `wishlist` and `prices` and the word "match" appears in
    `lib/` only as a verb, `cuatro-tracker`'s `prisma/schema.prisma` carries an `enum MediaType` and
    a `release_date` commented "THE sort field", and `cuatro-portfolio`'s claim about "every
    application that is running" was refuted by the Registry it is an entry in. The repeated closing
    sentence is gone from all five entries that carried it, and a standing case in
    `ops/__tests__/registry-schema.test.ts` now refuses any sentence carried by two entries. The
    per-entry evidence and the tier that settled each is in `ops/registry-inputs.md` under "The
    descriptions were confirmed, 2026-09-03".
  status: done

- source_spec: `_bmad-output/implementation-artifacts/spec-2-6-the-editorial-voice-pass.md`
  summary: >-
    `list-wheel` ships `RxJS` in its `tech` array against a README that states signals-first state
    and no source file that imports it. Found while confirming the description; not repaired,
    because changing a `tech` value is a change to `ops/registry-inputs.md`.
  evidence: |-
    Observed 2026-09-03 in the local checkout at `C:\Development\list-wheel-workspace\list-wheel`.
    `package.json` declares `"rxjs": "~7.8.0"`, which is how the array came to name it: the arrays in
    `ops/registry-inputs.md` were read from the manifest on the branch carrying the code, and a
    manifest is what Angular's own dependency tree puts there whether the application uses it or not.

    Nothing under `src/` imports from `rxjs`, and the README's own Highlights say so in as many
    words: "Signals-first state: all shared state lives in `EntryService` as Angular signals; no
    NgRx, no `BehaviorSubject`, no manual subscriptions."

    FR-9 makes a wrong `tech` value a defect rather than a cosmetic issue, and this is the clearest
    instance in the Registry: a reader who can detect an error in `tech` is exactly the reader FR-9
    says the field is for, and `RxJS` tells them the application is built the way it deliberately is
    not. It sits beside the three thin arrays already filed above and is a different failure: those
    understate a stack, this one names something absent.

    Story 2-6 was forbidden from repairing it. Its boundaries put any change to `tech` behind an
    Operator decision, on the ground that those values are `ops/registry-inputs.md`'s and changing
    one is a change to that record. The cheap repair is one array in the Registry and one row in that
    record, in one change, with stated limit 8 there updated.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-6-the-editorial-voice-pass.md`
  summary: >-
    A description and the entry's own `absorbed_into` can contradict each other, and nothing reads
    the two together. `tcg-tracker` says the idea "is set to fold into" Cuatro Tracker while its
    `absorbed_into` asserts the fold as accomplished fact.
  evidence: |-
    Found at the Story 2-6 review, 2026-09-03. Three instances, all pre-existing in substance and one
    sharpened by this story's wording:

    `tcg-tracker` carries `"absorbed_into": "cuatro-tracker"`, whose schema description reads "The id
    of the application this one's code now lives in (AD-6)". Its description now reads "the idea is
    set to fold into Cuatro Tracker as one of its domains", which is intent. The field says done and
    the prose says pending. Story 2-6 changed the prose from the present tense precisely because no
    fold has happened, which makes the field the wrong half rather than the prose.

    `connect-four-react` has the same shape: `absorbed_into: cuatro-portfolio` beside "the game is set
    to be rebuilt inside the Cuatro Ecosystem hub". That wording predates this story.

    And a third, across two entries rather than within one: `cuatro-tracker`'s corrected description
    closes its domain list at five kinds, "movies, TV shows, anime, manga and video games", while
    `tcg-tracker` says a sixth folds into it. Both are true of what exists today and they read as a
    contradiction in a directory column, which is the reading a Visitor gets.

    **Not fixable inside this story.** `absorbed_into` is on the Ask First list, being one of
    `ops/registry-inputs.md`'s values, and cross-entry coherence between a description and a
    structural field is outside the frozen scope. **It is also a candidate rule** rather than only an
    edit: "an `absorbed_into` whose target does not describe the absorption" is a statement about the
    entries as a set, the same shape as the three rules the gate already applies. The cheap first step
    is deciding whether `absorbed_into` means "has moved" or "will move", because the schema
    description says the first and two of the two entries carrying it mean the second.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-6-the-editorial-voice-pass.md`
  summary: >-
    `contract_version` stayed at `1.1.0` while nine of the fourteen `description` values changed, and
    the field's own rule says a value change is a minor bump.
  evidence: |-
    `contracts/registry.schema.json` describes `contract_version` as "The Registry's own semver
    (AD-5). A value change is a minor bump; any field rename is major (AD-16)." Read literally, nine
    changed values in one commit is a bump to `1.2.0`.

    Story 2-6's boundaries put moving the version behind an Operator decision, with the note that a
    text-only pass may not need one, so it was left rather than moved on the story's own judgement.

    The exposure is real but small: AD-4 has Satellites fetch this file over HTTPS at build time, and
    the version is the only signal a Satellite has that a description it renders has changed. The
    exposure in the other direction is that every editorial correction becomes a minor bump and the
    version stops meaning anything a consumer can act on.

    Filed as pending Operator action 6 in `ops/registry-schema.md`. Worth settling once as a rule
    rather than per story. A standing case in `ops/__tests__/registry-schema.test.ts` pins the value
    as a literal, so whichever way it is settled the change is one line there beside the Registry.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-6-the-editorial-voice-pass.md`
  summary: >-
    Two descriptions still restate what `status` already carries, and were left because they were
    outside the set Story 2-6 was scoped to change.
  evidence: |-
    `lumen` ends "It was never built: the repository holds no code, and it is archived" and
    `connect-four-react` opens its second sentence "It is retired as a standalone application". Both
    entries carry `"status": "Archived"`, so the clause is a restatement in the same sense the
    repeated "It is in early development and nothing is deployed yet" was on the other five.

    It is a weaker case than that one was. Neither sentence is shared with another entry, so the
    column-reading defect does not arise, and both descriptions are two sentences rather than three,
    so neither is spending a budget it needs. `connect-four-react`'s clause is also load-bearing: it
    is what makes the following "set to be rebuilt inside the Cuatro Ecosystem hub" parse.

    Left as a note for the next editorial pass rather than as a repair. Recorded so it is found named
    rather than rediscovered.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-6-the-editorial-voice-pass.md`
  summary: >-
    `tcg-tracker`'s description still rests on its id and nothing else, and Story 2-6 confirmed that
    there is no source anywhere to confirm it against.
  evidence: |-
    Observed 2026-09-03. `C:\Development\tcg-tracker` holds `_bmad`, `.claude` and `docs` and no
    product evidence at all: no code, no README, no architecture guide, and the GitHub repository is
    empty at zero bytes and carries no description. It is the only one of the fourteen with no tier
    on the evidence ladder.

    Story 2-6 reworded the second sentence, which said the idea "folds into" Cuatro Tracker in the
    present tense where no fold has happened, to word the relationship as intent the way
    `connect-four-react` already does. The first sentence, "A trading card game collection tracker",
    is read off the id and was not re-sourced, because there is nothing to re-source it against.

    This is the same shape as stated limit 2 of `ops/registry-inputs.md`, which records that the
    entry's `tech` array is an inference from a disposition. Both are inferences and both are the
    weakest values in the file, but they are inferences from different things: the array from PRD
    section 5.2's disposition, the description from the name. The Operator should overwrite either if
    the intent was something else, and nothing else will surface the question.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-author-contracts-registry-json.md`
  summary: >-
    Three `tech` arrays in `contracts/registry.json` are materially thinner than their projects'
    architecture guides, and none was changed because changing one is a change to
    `ops/registry-inputs.md`.
  evidence: |-
    The arrays were read from manifests on the branch carrying the code, which is evidence about what
    an application runs on today; a guide is a plan, which is why the record was left alone.

    `poketracker-go` ships `Go · PostgreSQL · pgx · sqlc` while its guide names Flutter and a Python
    discord.py bot beside the Go backend, so the array describes the backend and not the application.
    `Mutuo` ships `Bun · Vue · Drizzle ORM · Caddy · Docker` while its guide names PostgreSQL, and
    `ops/registry-inputs.md`'s own store list declares a store for nine applications and omits Mutuo.
    `Lumen` ships `Markdown · WSL2` while its guide names Tauri, Rust, React, CodeMirror and tantivy;
    that one is probably right as it stands, because the repository holds no code.

    FR-9 makes a wrong `tech` value a defect rather than a cosmetic issue, and stated limit 8 of
    `ops/registry-inputs.md` already records that the granularity ruling is applied unevenly.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-author-contracts-registry-json.md`
  summary: >-
    DW-29's stale comment at `tests/e2e/contract-serving.pw.ts:68-72` got staler: it says
    `contracts/registry.json` arrives in Story 2-5, which has now happened, and Story 2-5 was
    forbidden from touching `tests/`.
  evidence: |-
    DW-29 was filed by Story 2-3 and names Story 2.5 as "the natural place to take it". Story 2-5's
    spec put `tests/` in its Never list and made an unchanged `tests/` an acceptance criterion, for
    the same reason Story 2-3 could not fix it: the story that falsifies a comment is not always the
    story allowed to edit the file holding it.

    The comment is now wrong twice rather than once. Nothing fails because of it. Filed as a pointer
    so DW-29 is not read as still waiting on Story 2.5, which cannot take it.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-author-contracts-registry-json.md`
  summary: >-
    AD-3 and `contracts/registry.schema.json` both say "three live hostnames already diverge from
    their ids". Against the Registry Story 2-5 shipped, five of the six `Live` entries diverge.
  evidence: |-
    Of the six `Live` entries, only `cs-tracker` sits at `<id>.cuatro.dev`. `cuatro-portfolio` serves
    at `cuatro.dev`, `cuatro-tracker` at `tracker.cuatro.dev`, `digital-library` at
    `library.cuatro.dev`, `cs-tournament` at `inclusivcup.vercel.app` and `list-wheel` at
    `luigiespinosa.github.io/list-wheel/`.

    The claim is pre-existing prose written before the Registry existed, and it is used as the
    justification for the rule rather than as the rule itself, so nothing behaves differently for it
    being wrong. It was not corrected in Story 2-5 because that spec's Ask First covers "any change
    to AD-3 beyond ruling 1's narrowing", and re-counting the divergence is such a change.

    Worth fixing when Epic 2's planning text is reconciled, since the count appears in the published
    schema as well as in the spine and is now checkable against a shipped file.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-author-contracts-registry-json.md`
  summary: >-
    One case in the unit suite failed once and passed on three other runs of the same tree, and it
    was not identified because the run that failed had its output truncated. The suite gates
    production, so a case that fails one run in four is worth naming.
  evidence: |-
    Observed 2026-09-03 on the Windows development host, across four full `corepack pnpm test --run`
    invocations against the same working tree. Run 2 reported `1 failed | 897 passed (898)`; runs 3
    and 4 reported `898 passed (898)` with exit 0, and run 1 (against an earlier tree) reported
    `896 passed (896)`. No source file changed between runs 2, 3 and 4.

    The failing case was not captured: that invocation piped through `Select-Object -Last 8`, which
    kept the summary and discarded the failure block naming the file and the assertion. Runs 3 and 4
    were re-run specifically to identify it and both were green, so it did not reproduce.

    Not this story's change: nothing in it is timing-dependent, and the two runs that bracket the
    failure exercise exactly the same code. The estate has form here, `ops/__tests__/
    cs-tracker-accessibility-probe.test.ts` having been red on every CI run for three days under
    DW-30, which is why an unexplained one-in-four failure is filed rather than assumed away.

    The cheap next step is to run the suite with `--reporter=verbose` into a file a few times and
    watch for a case whose duration swings, rather than to go looking now with nothing to go on.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-7-retire-content-projects-ts-the-hub-imports-the-published-reg.md`
  summary: >-
    Deleting `content/projects.ts` leaves three records citing it by line number, so each now
    points at a file that does not exist.
  evidence: |-
    `ops/backup-digital-library.md:46` cites `content/projects.ts:12` as where the application id
    was observed, and `:54` cites `:23,26,30` for three `tech` values. `CHANGELOG.md:111` describes
    it as a "typed TypeScript array with 1 project entry".
    `portfolio-architecture-guide.docx.md:151,179,192` describes the content-as-code pattern it was
    half of.

    None was corrected here. All four are historical records of what was observed on a date, and
    rewriting an observation because its subject was later deleted is how a record stops being
    evidence. `ops/known-violations.md:175` is the one that had to move, because it stated a
    violation as open in the present tense, and it did move.

    The cheap fix, when someone is in those files anyway, is a trailing "retired by Story 2.7"
    rather than a rewritten citation.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-7-retire-content-projects-ts-the-hub-imports-the-published-reg.md`
  summary: >-
    `ProjectCard` labels every `source` link "// Github", but the Registry schema requires only that
    `source` resolve to a repository.
  evidence: |-
    All fourteen committed entries are `github.com` URLs, so the label is true today and the card
    was not changed: the story swaps the data source and keeps the markup. A GitLab or self-hosted
    source would render under a label naming the wrong host, and nothing would fail.

    Not repaired here because changing the link text is on this spec's Ask First list, and the
    Suite Directory (Story 2.9) rewrites this markup against `RESTYLE-SPEC.md` anyway. Worth
    deciding there rather than twice.


    **Answered 2026-09-06 by Story 2-9, which is where this entry said the decision belonged.**
    The label is now `Source` on every entry, verbatim from `EXPERIENCE.md:290` ("Not `GitHub`, not
    `Code`"), with `Source: {name}` as its accessible name per A-10. It names no host, so a GitLab
    or self-hosted `source` renders correctly with no edit, which is the condition this entry was
    opened about. `ProjectCard` and its `// Github` label were deleted in the same commit.
  status: done

- source_spec: `_bmad-output/implementation-artifacts/spec-2-7-retire-content-projects-ts-the-hub-imports-the-published-reg.md`
  summary: >-
    `/projects` went from one card to six with no rendered-output coverage. The Playwright harness
    holds a baseline for `/work` only.
  evidence: |-
    `tests/e2e/rendered-output.pw.ts` is deliberately one route (Story 1-10 chose `/work` because it
    combines a `--monument-bold` call site, the `body#work` rule and a server-rendered entrance
    tween). So "unchanged in appearance" was established by reading the diff and by
    `app/projects/__tests__/page.test.tsx`, which asserts structure, links and counts, not paint.

    Not worth a baseline of its own: Story 2.14 redirects `/projects` to `/#suite`, and Story 2.9
    builds the surface that replaces it. Filed so the gap is a known one rather than an assumed
    coverage.
  status: open
- source_spec: `_bmad-output/implementation-artifacts/spec-2-7-retire-content-projects-ts-the-hub-imports-the-published-reg.md`
  summary: >-
    The projects hero reads "{count} PROJECTS" over data that can now be 1 or 0, so "1 PROJECTS" and
    "0 PROJECTS // ONGOING" are both reachable strings.
  evidence: |-
    Before Story 2.7 the number was `projects.length` over a one-entry TypeScript array, so the copy
    was effectively fixed. It is now `renderedApplications.length`, which is six today and moves
    with the Registry.

    Not fixed here because the copy is 2023 legacy that Story 2.9 and Story 2.13 rewrite against
    `RESTYLE-SPEC.md`, and this story's boundary is the data source rather than the wording. Pick it
    up there, or when the hero is redesigned, rather than pluralising a line that is about to be
    replaced.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-7-retire-content-projects-ts-the-hub-imports-the-published-reg.md`
  summary: >-
    `/projects` has no empty state. With no rendered entry it draws an empty `<ul>` under a hero
    reading zero.
  evidence: |-
    `selectRendered([])` returns `[]` and is tested, so the rule is safe; the route is what has
    nothing to say. The state is unreachable today (six entries are `Live`) and would need every
    application to leave `Live` or `Complete` at once.

    Filed rather than built because an empty state is a designed surface, and the surface that
    replaces this route is Story 2.9's Suite Directory. Deciding it twice is the waste.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-7-retire-content-projects-ts-the-hub-imports-the-published-reg.md`
  summary: >-
    `AGENTS.md` should record that exactly two sources may name `contracts/`, and that the Registry
    module may name only the Registry pair.
  evidence: |-
    The pitfalls list already records the two guards of this exact shape: the three committed
    listings that pin `contracts/` path by path, and the two suites that pin `ci.yml` job names.
    `app/__tests__/anchor-contract.test.ts` now holds a third of the same kind, so the next agent to
    add a `contracts/` reference finds out from a red test rather than from the guide.

    Not written here because that list sits inside the `bmad:context` block, which is managed by
    `bmad-project-context` and replaced on refresh. It belongs in the refresh the board already
    schedules before epic 3, not in a hand edit that the next run deletes.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-7-retire-content-projects-ts-the-hub-imports-the-published-reg.md`
  summary: >-
    `SCANNED_EXTENSIONS` in `app/__tests__/anchor-contract.test.ts` carries no `.json`, so a JSON
    module under a shipped source root is invisible to both the consumer scan and the new
    `contracts/` mention check.
  evidence: |-
    The list is `.scss .css .ts .tsx .js .jsx .mjs .cjs`, chosen when no shipped source was JSON.
    Story 2.7 makes a JSON import a normal thing for this repository to do, and a `.json` file
    landing under `app/`, `components/`, `hooks/`, `content/` or `lib/` carrying token names or a
    `contracts/` path would pass both guards unread.

    Not widened here because the same constant feeds the root pin, `PRESENT_EXTENSIONS` and two
    count floors in that file, so the change is that file's to make deliberately rather than a
    side effect of this story. Nothing under a scanned root is JSON today, so the gap is latent.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-8-assert-the-44-44-hit-target-floor.md`
  summary: >-
    `app/app.scss:92-102` breaches `DESIGN.md:558`: `width: 100vw` with `overflow-x: hidden` where
    the contract says widths are `100%` and the clip is `clip`. Thirty-six elements really do sit
    past the right edge at 360px, and on one route the clipping is what stops `scrollWidth` from
    saying so. **Promoted to KV-5 in `ops/known-violations.md`; this entry is the evidence behind
    that ruling and is not open work on its own.**
  evidence: |-
    **Read KV-5 first.** An Operator ruling of 2026-09-06 tolerates this breach and Story 2-9 closes
    it (`epics.md:2423-2427`), which by this register's own discriminator makes it a known violation
    rather than deferred work: the test is the ruling, not the severity. KV-5 carries the ruling, the
    owner and the retirement condition. What follows is the measurement it rests on, kept here rather
    than duplicated into that file so a re-measurement has one place to land.

    `DESIGN.md:558-559` states the rule and its reason: `html, body { overflow-x: clip }` globally,
    `clip` rather than `hidden` because `hidden` breaks sticky positioning, and widths `100%` with
    container padding, never `100vw`. `app/app.scss:96-98` ships `width: 100vw` and
    `overflow-x: hidden` on `body`, and `:100-102` adds `overflow: hidden` outright on the home
    route. Two rules broken in one block.

    Measured 2026-09-06 in `mcr.microsoft.com/playwright:v1.62.1-noble` at 360 x 800, by comparing
    every element's right edge against `window.innerWidth` on each of the five HTML surfaces.
    Thirty-six elements overflow: 28 on `/work`, furthest `span.work-item__icon` at 490.67, and 8 on
    `/projects`, furthest `div.projects-hero__text` at 372.00. `/`, `/celeste` and the 404 are clean.

    **`/projects` is the sharp half.** Its eight elements sit 12px past the viewport while
    `document.documentElement.scrollWidth` reads 360. An A-5 check written against `scrollWidth`
    would be green on that route while the condition it exists to detect was present. That is why
    Story 2-8 asserts A-5 on element right edges, and it is the concrete case for `clip` over
    `hidden` that `DESIGN.md:558` argues in the abstract. On `/work` the same reading is 491, so
    nothing hides it there; both readings are in `ops/hit-target-floor.md`.

    Which rule does the hiding differs by route and both were checked. On `/projects` it is the
    hero's own `overflow: hidden` (`ProjectsHero.scss:9`), not `body`'s. On `/work` the work-item
    overflow has no clipping ancestor at all and reaches `scrollWidth`, where `body`'s
    `overflow-x: hidden` then stops it becoming a scrollbar. So `app/app.scss` is the reason a
    visitor cannot scroll to the overflow, and it is one of two reasons a reader cannot see it.

    The overflowing elements are their own components' defects rather than the stylesheet's, and
    they land in two shapes. `.container` is `width: min(80%, 1920px)` with `padding: 0 1rem`
    (`container.scss:2-4`), so at 360 the page content box is 256 and a hero's is 216 after its own
    `--page-padding`; both hero grid columns then measure **300**, because a grid item's
    `min-width: auto` refuses to shrink below its min-content size (`WorkHero.scss:1-9`,
    `ProjectsHero.scss:1-9`). And `.work-item__sub` carries `white-space: nowrap`
    (`WorkItem.scss:64`) inside a `flex: 1` column, so a long period-and-location string pushes
    `.work-item__meta` to 372.38 and the icon beside it to 490.67.

    **Not repaired here, by an Operator ruling of 2026-09-06**: Story 2-8 ships the instrument and
    changes no stylesheet. **Story 2-9 owns the `body` half and already names it as an acceptance
    criterion** (`epics.md:2423-2427`): "`clip` replaces `hidden`, because `hidden` breaks sticky
    positioning" and "widths are `100%` with container padding, never `100vw`". Story 2-22 is the
    other story booked into the same block, deleting the alias layer above it, so whichever lands
    first should expect the other in the same file. The component half belongs to Story 2-31
    (`WorkItem`), Story 2-33 (`WorkHero`) and Story 2-9, which replaces the projects surface.

    **The two halves have to land together.** Replacing `hidden` with `clip` on a tree that still
    overflows changes what a visitor sees from a clipped page to a page with real horizontal
    scroll, which A-5 forbids outright. Whoever takes `epics.md:2423-2427` should re-run the Story
    2-8 sweep and widen its A-5 arm past interactive elements once the overflow is gone, rather
    than take the stylesheet line on its own.

    None of the 36 is interactive, so none fails the Story 2-8 sweep, which measures interactive
    elements. The gap is recorded there under what the assertion deliberately does not cover, so a
    green A-5 is not read as "nothing on the Hub overflows at 360".
  status: promoted to KV-5 in `ops/known-violations.md` on 2026-09-06

- source_spec: `_bmad-output/implementation-artifacts/spec-2-8-assert-the-44-44-hit-target-floor.md`
  summary: `DESIGN.md:645-648` states something the Story 2-8 probe measured to be false, and four
    later stories will read it as guidance.
  evidence: The passage says vertical padding on a plain inline element "paints outward without
    affecting layout or hit-testing" and measures "~29px tall no matter what the padding says".
    The probe recorded in `ops/hit-target-floor.md` shows 0.25rem giving 29.00 and 0.75rem giving
    44.00, so padding does grow the border box that `boundingBox()` reports. The practical warning
    survives, since the real-world case really is ~29px, but the stated mechanism is wrong and
    Stories 2-9, 2-15, 2-30 and 2-32 all repair hit targets against it. Correcting a UX spine is
    outside a story that ships an instrument and changes no component.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-8-assert-the-44-44-hit-target-floor.md`
  summary: `epics.md:3576` premises a Story 2.32 acceptance criterion on a measurement the Story
    2-8 sweep disproved.
  evidence: The criterion reads that the shipped links measure ~16x27px. The sweep measured the
    chrome nav links at 38.41 to 98.13 wide by 22.00 tall, recorded in the ledger and in KV-4. This
    story is the first instrument in the repository positioned to correct that number, and it is
    left standing in the criterion that four surfaces are repaired against. Editing `epics.md` is a
    planning-artifact change, not an implementation one.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-8-assert-the-44-44-hit-target-floor.md`
  summary: `tests/e2e/harness.ts:24` still names only the Epic 1 consumers of the harness, now that
    a sixth spec imports it.
  evidence: The docstring reads "Stories 1.12, 1.17, 1.18 and 1.19 import this file", and
    `hit-target-floor.pw.ts` now imports `RENDERED_VIEWPORT` and `rootCustomPropertyValue` from it.
    `ops/rendered-output-harness.md` was updated to add the story; the file a reader actually opens
    was not. Story 2-8's boundaries made `harness.ts` reuse-only, so this is filed rather than
    fixed.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-8-assert-the-44-44-hit-target-floor.md`
  summary: The hit-target sweep does not skip controls inside an `inert` subtree or at
    `opacity: 0`, and whether it should is an Ask First decision the story did not take.
  evidence: `hit-target-floor.pw.ts` skips `aria-hidden`, `display: none` and zero-area nodes. An
    `inert` subtree and a fully transparent control are both unreachable in fact, so measuring them
    either fails the floor for an element no one can tap or pads the count that proves measurement
    happened. The spec's Ask First list covers any element the sweep should skip beyond the
    visibility and accessibility-tree rule in its frozen matrix, so adding these silently was not
    available.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-8-assert-the-44-44-hit-target-floor.md`
  summary: What shipped departs from the literal wording of Story 2.8's acceptance criteria in two
    places, and nothing records that where `epics.md` is read.
  evidence: `epics.md:2337-2338` requires that for every interactive element the assertion asserts
    `boundingBox()` measures at least 44x44; what shipped asserts at least 44x44 or covered by a
    dated ledger row, with 39 of 43 elements on the ledger. `epics.md:2342` requires A-5 asserted as
    no horizontal scroll at 360px; what shipped scopes A-5 to interactive elements, because `/work`
    reports `documentElement.scrollWidth` 491 and repairing it belongs to Story 2-9. Both departures
    follow from Operator rulings of 2026-09-06 and are argued in `ops/hit-target-floor.md`, KV-4 and
    KV-5, but no sprint change proposal or `epics.md` annotation carries them, so a later reader of
    the epic sees criteria that were not met verbatim and a board row reading done.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-8-assert-the-44-44-hit-target-floor.md`
  summary: `tests/e2e/contract-anchor.pw.ts:903` flakes on a live HTTP fetch and takes the blocking
    `rendered-output` gate red with it.
  evidence: CI run 34020245249, on commit `9f71fba`, failed with `Error: apiRequestContext.get:
    socket hang up` at `contract-anchor.pw.ts:923`, the `expect(sheet.status()).toBe(200)` inside
    the case that walks every contract face URL. 44 passed, 1 failed, and the commit was
    documentation only, so nothing in the tree could have caused it. The run before it and the two
    after it are green on the same case. AD-21 makes every gate blocking and forbids
    `continue-on-error`, which is correct and is exactly why a transient network read inside one
    matters: a gate that goes red for a reason nobody caused is the kind that gets worked around,
    and `ops/rendered-output-harness.md:227-232` already names regenerating to get a build green as
    the failure mode it exists to prevent. Observed 2026-09-06. The fix is a bounded retry on the
    request, or asserting the served bytes rather than re-fetching over the network, not a
    `test.retry` on the whole case, which would hide a real 404 as readily as a hang up.
  status: open
- source_spec: `_bmad-output/implementation-artifacts/spec-2-9-the-suite-directory.md`
  summary: The `Live` status dot fills 4px with `--token-accent`, which F-8's gate greps for and
    expects zero of. It needs a named exemption in Story 2.34 exactly as `::selection` has one at
    F-11, or that gate fails on the taxonomy's load-bearing element.
  evidence: >-
    `components/organisms/SuiteDirectory/SuiteDirectory.scss` sets
    `background: var(--token-accent)` on `.suite-directory__dot`. That is correct and is not the
    thing to change. `DESIGN.md:298-303` specifies the `Live` mark as a **4px filled square** in
    the accent, and `:621-624` settles it as a square at `--r-none` against the residual
    `--r-pill` typo at `RESTYLE-SPEC.md:387`; `DESIGN.md:305-314` is explicit that the dot is the
    taxonomy's load-bearing element rather than an ornament, because without it `Live` and
    `Complete` are both `1px solid` and sit **1.13:1 apart in greyscale**, which is no distinction
    at all. Filled is the specification, and DESIGN.md wins any value.


    The tension is with the enforceable half of the accent budget. `RESTYLE-SPEC.md:654` states
    F-8 as a binary check and says so in those words: grep the built CSS for `--token-accent` used
    as a `background`, `background-color` or `fill`, at any state including `:hover`, expecting
    **zero occurrences**, the 3% figure being design intent rather than a gate because it has no
    defined denominator. The dot is an occurrence. So F-8 as written and the status taxonomy as
    written cannot both hold once anything renders a `Live` mark, and Story 2-9 is the story that
    first renders one.


    The shape of the resolution already exists in the same table. `RESTYLE-SPEC.md:657` gives
    `::selection` an accent ground and says outright that F-8's grep **excludes `::selection`
    explicitly**, so the specification already contemplates named exemptions rather than a
    weakened predicate. The dot wants the same treatment: a second named exemption, scoped to the
    status mark's dot, with the greyscale argument beside it. What must not happen is the gate
    being softened to "accent fill under some size" or dropped to a warning, which AD-21 forbids
    anyway: F-8 is binary precisely so it cannot be argued with per call site, and the value of the
    exemption is that it is a short, readable list somebody has to add to on purpose.


    Filed rather than fixed because the gate does not exist yet. Story 2.34 (`epics.md:3695`) is
    the story that implements FR-17 conformance as a blocking CI grep, its acceptance criteria
    already carry a permitted set and a separately argued alpha exception written against a
    palette entry rather than a role name, and this is a third entry of the same kind. Story 2-9's
    own boundaries make `contracts/` read only and add no CI job, so writing the exemption here
    was not available. Whoever takes 2.34 should also confirm that the exemption is written
    against the dot's selector rather than against `--token-accent`, for the same reason the alpha
    exception is written against the palette entry: an exemption naming the role would readmit
    accent fills everywhere.
  status: open
- source_spec: `_bmad-output/implementation-artifacts/spec-2-9-the-suite-directory.md`
  summary: >-
    `epics.md` books `ProjectCard` and `ProjectCard.scss` retirement to Story 2.14 in five places.
    Story 2-9 retired them, so five planning statements now describe work that is already done.
  evidence: |-
    `epics.md:568` ("`ProjectCard` and `ProjectsHero` are retired with it"), `:2616` (a Story 2.14
    acceptance criterion reading "**Then** `ProjectCard` and `ProjectsHero` are retired along with
    their stylesheets"), `:2736`, `:2744` and `:3543` (each stating `ProjectCard.scss` "is retired
    by Story 2.14" or "needs nothing, being retired"). Story 2-9 deleted the component, its
    stylesheet and its tests, because `tests/e2e/hit-target-floor.pw.ts` carried the
    `directory-links` exemption with `closedBy: 'Story 2-9'` and
    `ops/__tests__/hit-target-floor.test.ts:537-558` fails once 2-9 reads `done` on the board while
    that row survives. The ledger and the epic disagreed about which story owned the retirement,
    and the ledger is the one with a test behind it.

    `ProjectsHero` is **not** retired: it still renders on `/projects` above the directory, so the
    2.14 criterion is half true rather than wholly stale. Editing `epics.md` is a planning-artifact
    change and Story 2-8 set the precedent of filing rather than making one from inside a build.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-9-the-suite-directory.md`
  summary: >-
    On `/projects` the hero and the Suite Directory start at different left edges, because one is
    inside `Container` and the other deliberately is not.
  evidence: |-
    `app/projects/page.tsx` keeps `<ProjectsHero />` inside `Container` and renders
    `<SuiteDirectory />` outside it. `container.scss:2-4` is `width: min(80%, 1920px)` with
    `padding: 0 1rem`, so at a 360px viewport the hero's content starts at roughly 52px;
    `.suite-directory` pads itself with `var(--page-pad)`, which clamps to 20px at that width. The
    two sections on one page are about 32px out of alignment.

    Neither half is wrong on its own. The directory is outside `Container` on purpose, because
    `min(80%, ...)` leaves 288px of content at 360px, which `ops/known-violations.md:399` blames
    for the hero overflow in the first place; the hero keeps the wrapper it was authored against
    because its geometry is Story 2-33's. Filed rather than fixed because Story 2-14 redirects
    `/projects` to `/#suite`, after which the surface renders nothing and the misalignment cannot
    be seen. If 2-14 is descoped or delayed, this becomes visible work.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-9-the-suite-directory.md`
  summary: >-
    Every Suite Directory link opens a new tab and none carries the external-navigation mark the
    contract declares as one of its three glyphs.
  evidence: |-
    `SuiteDirectoryRow` sets `target='_blank' rel='noopener noreferrer'` on both the live and the
    source link, carried over from `ProjectCard`. `RESTYLE-SPEC.md:553` states that the system has
    no icon set and that "the three glyphs in the system are an arrow, an external-navigation mark
    and the 4px status square", so a mark for exactly this exists in the vocabulary and the
    directory uses none of it. WCAG G201 treats warning the user about a new window as advisory
    rather than a violation, so this is a design question and not a floor breach.

    Filed rather than decided because adding a glyph to a row is a composition change and no spine
    states it: `DESIGN.md:658-663` specifies the Registry Entry as name, status, description, tech
    and links, and lists no mark. The alternative resolution is to drop `target='_blank'`
    altogether, which is a behaviour change `EXPERIENCE.md` does not ask for either.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-9-the-suite-directory.md`
  summary: >-
    `list-wheel`'s live link renders as `luigiespinosa.github.io`, which names the operator rather
    than the application and would collide with any second GitHub Pages entry.
  evidence: |-
    `bareDomain` in `components/organisms/SuiteDirectory/SuiteDirectory.tsx` renders
    `new URL(entry.live).hostname`, dropping the path. For five of the six rendered entries that is
    exactly right and is what `EXPERIENCE.md:289` asks for: "The bare domain, `library.cuatro.dev`
    ... The URL *is* the evidence." For `list-wheel`, whose `live` is
    `https://luigiespinosa.github.io/list-wheel/`, the bare domain is the operator's GitHub Pages
    host, and the `/list-wheel/` segment that identifies the application is discarded.

    This is in tension with A-9 (`EXPERIENCE.md:768`), "link text is self-describing out of
    context", which names `library.cuatro.dev` as an example of text that is. A host shared by
    every GitHub Pages project of one account is not, and a second such entry would render an
    identical label pointing somewhere else. The letter of the contract is satisfied and the
    purpose is not.

    Filed rather than fixed because the copy rule is stated in a spine and changing it (to host
    plus first path segment for non-apex URLs, say) is an editorial decision rather than an
    implementation one. Story 2-25 relocates `list-wheel` onto a `cuatro.dev` subdomain, which
    dissolves the case; if that story moves out, this wants deciding on its own.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-10-assert-the-status-mark-s-three-structural-axes.md`
  summary: >-
    `DESIGN.md:310-314` attributes the 1.13:1 greyscale figure to the `Live` and `Complete` border
    pair, and the shipped border pair measures 1.773:1. The 1.13 is the text pair, exactly.
  evidence: |-
    Measured 2026-09-06 in `mcr.microsoft.com/playwright:v1.62.1-noble` at 360 wide, by resolving
    each computed colour to sRGB through a 1 by 1 canvas and computing WCAG relative-luminance
    contrast. Borders: `rgb(143, 126, 240)` against `rgb(101, 100, 113)`, **1.773:1**. Text:
    `rgb(143, 126, 240)` against `rgb(152, 151, 159)`, **1.133:1**. Both readings and the method
    are recorded in `ops/status-mark-axes.md`.

    The sentence at `DESIGN.md:310-314` reads "If `Live` and `Complete` were distinguished only by
    border *colour* ... they would sit 1.13:1 apart in greyscale". That number belongs to the text
    pair as shipped, not the border pair. **The argument is unaffected**: 1.773:1 is still far
    under 3:1, WCAG 2.1 SC 1.4.11's non-text floor, so neither figure rescues a colour-only
    distinction and the dot is load-bearing either way. `tests/e2e/status-mark.pw.ts` asserts the
    bound rather than either number, so nothing depends on which one the prose names.

    Filed rather than fixed because editing `DESIGN.md` is outside Story 2-10 and the design
    documents are a spine: a value in one is changed deliberately, not as a side effect of a story
    that was measuring something else.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-10-assert-the-status-mark-s-three-structural-axes.md`
  summary: >-
    The Status mark is unasserted under `forced-colors`, where a user stylesheet or a high-contrast
    mode can override the border colour and the dot's fill together.
  evidence: |-
    Story 2-10 asserts the three axes in the screen and print media. `forced-colors` is a third
    medium with its own rules: it can replace `background-color` on the dot and `border-color` on
    the mark with system colours, and `forced-color-adjust` governs whether an author may opt out.
    The dashed and dropped borders survive it, being structural, but the dot is a filled box and a
    fill is exactly what that mode reassigns.

    No requirement in this plan names `forced-colors`, so this is not a breach of anything: it is a
    medium nobody has ruled on. `ops/status-mark-axes.md` records it under what the assertion
    deliberately does not cover, with no owner, rather than booking it to a story that does not
    exist. Story 2-26, the Hub's focus standard and manual accessibility pass, is the natural place
    to decide whether the estate makes a claim there at all.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-10-assert-the-status-mark-s-three-structural-axes.md`
  summary: >-
    Three Playwright spec files now carry their own copy of `goTo`, `plantStyle` and
    `EDGE_SLACK = 0.5` instead of importing them from `tests/e2e/harness.ts`.
  evidence: |-
    `tests/e2e/harness.ts` exists precisely to hold what more than one spec file needs, and today
    it exports only `RENDERED_VIEWPORT`, `expectRouteScreenshot`, `computedStyleValue` and
    `rootCustomPropertyValue`. Meanwhile `EDGE_SLACK = 0.5` is declared with the same value and
    nearly the same comment in `tests/e2e/hit-target-floor.pw.ts:252`,
    `tests/e2e/suite-directory.pw.ts:57` and `tests/e2e/status-mark.pw.ts`; `plantStyle` is
    byte-similar in the last two; `durationMs` is now duplicated between them as well; and each
    file has its own `goTo` differing only in which selector it waits for.

    The hazard is not the duplication itself but that these are measurement tolerances. Three
    copies of a slack figure drift, and a spec file whose slack is looser than its neighbours'
    reports a layout as clean that the others would fail, with nothing anywhere saying the two
    disagreed.

    Filed rather than fixed because lifting them touches `hit-target-floor.pw.ts`, whose literals
    `ops/__tests__/hit-target-floor.test.ts` parses as text, and Story 2-10's boundaries put that
    file off limits. A story that owns the harness can lift all four helpers in one change.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-11-the-premise-block-and-the-framework-band.md`
  summary: >-
    `epics.md:2508` specifies the plate mark's tracking one step wider than `DESIGN.md:686` does,
    and the reference mockup follows `epics.md` on its plate marks while following `DESIGN.md` on
    its own nav and count rows. Story 2-11 implemented the token and filed the drift rather than
    correcting either document.
  evidence: |-
    `DESIGN.md:686` specifies the plate mark in mono at `--t-3xs` with `--tr-label` tracking, and
    `contracts/tokens.css:77` declares `--tr-label` at `0.14em`. `epics.md:2508` writes the same
    requirement with the figure spelled out one step wider, and
    `mockups/key-screens.html:117` renders `.plate` at that wider figure while `:104`, `:145`,
    `:148` and `:168` all set the narrower one on the nav, the directory count, the family label
    and the status mark. So the mockup disagrees with itself, and the only file that is
    self-consistent is `DESIGN.md`, which is also the file that wins any value by its own
    declaration at `:187-188`.

    The component names the token and writes no figure, so the shipped mark follows `DESIGN.md`
    and `tests/e2e/premise.pw.ts` reads the token off the running page rather than restating
    either number. That resolves the implementation and leaves the documents disagreeing. Filed
    rather than fixed because `epics.md` is a planning artifact under a frozen approval and the
    design documents are a spine: a value in one is changed deliberately, through a sprint change,
    and not as a side effect of a story that was implementing it.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-11-the-premise-block-and-the-framework-band.md`
  summary: >-
    `EXPERIENCE.md:276` writes the premise opening as `Fifteen personal projects`, and
    `contracts/registry.json` holds fourteen entries. The shipped premise derives its number, so
    the page is right and the canonical copy is one ahead of the Registry.
  evidence: |-
    `EXPERIENCE.md:271-279` is the canonical FR-4 copy and opens `Fifteen personal projects became
    one suite`. `contracts/registry.json` holds fourteen applications, which
    `lib/registry.ts` exposes as `applications` and which the premise block spells through
    `lib/words.ts`. The rendered page therefore reads `Fourteen`, and no test compares it against
    the document, because the whole point of deriving it is that the number is the Registry's.

    The figure is not arbitrary: `ops/estate.md` carries a fifteen-row disposition table, and an
    earlier entry in this ledger records that two live Vercel hostnames appear in neither that
    table nor the Registry, so the estate record and the Registry already disagree about how many
    applications exist and by how much. Correcting `EXPERIENCE.md` to `Fourteen` by hand would
    write a second number that goes stale the day Story 2-4 reconciles that record, which is the
    failure the derivation exists to prevent. The honest closure is either to reconcile the count
    once across `ops/estate.md`, the Registry and `EXPERIENCE.md`, or to rewrite the canonical
    copy so it names no number and points at the derivation instead. Story 2-4 owns the
    reconciliation; this is filed as a sprint-change item rather than a silent correction.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-11-the-premise-block-and-the-framework-band.md`
  summary: >-
    `GlitchText.tsx:72` puts `aria-label` on a plain `<div>`, which is the one ARIA attribute that
    role prohibits, and hides the `<h1>` inside it. The home route therefore ships a page heading
    that is in nobody's accessibility tree, and it is the only audit failing Lighthouse there.
  evidence: |-
    Measured 2026-09-06 in `mcr.microsoft.com/playwright:v1.62.1-noble` against `pnpm build` plus
    `pnpm start`, by `lighthouse --only-categories=accessibility` on `/` and `/work`. The home route
    scores **0.96**, above the 0.95 floor `.lighthouserc.js` asserts, and `color-contrast` passes
    outright. One audit fails: `aria-prohibited-attr`, on the single node
    `main > div.home-container > div.home-panel > div.glitch-text`, snippet
    `<div class="glitch-text glitch" aria-label="Luigi Espinosa">`. The same audit passes on `/work`,
    so it is the component and not the chrome.

    The defect is not cosmetic. A bare `<div>` has the `generic` role, which prohibits an accessible
    name, so the `aria-label` is discarded rather than applied; and `GlitchText.tsx:73` marks the
    `<h1>` it wraps `aria-hidden='true'`, because the animation rewrites its characters. The two
    together mean the home route has no page heading in the accessibility tree at all. The fix is
    small, moving the label onto an element whose role admits one, or giving the wrapper
    `role='heading'` with its level, but it is a change to the hero and this story's boundaries do
    not reach it.

    Pre-existing, and not caused by Story 2-11: the premise block, the plate mark and the footer add
    no ARIA attribute other than `aria-hidden` on the framework band, which is a global attribute no
    role prohibits, and the band is correctly skipped by the contrast audit.

    One observation alongside it, recorded with its uncertainty rather than as a finding. The same
    run scored `/work` at **0.94**, under the same 0.95 floor, on a single run in a container rather
    than on the `ubuntu-latest` runner `lighthouse.yml` uses, and against `numberOfRuns: 3`, whose
    assertion is taken over the median. That is one reading in a different environment, so it is
    not evidence that the gate is red on `main`; it is a reason to look at `/work`'s accessibility
    score deliberately. Story 2-26, the Hub's focus standard and manual accessibility pass, is the
    natural owner of both.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-11-the-premise-block-and-the-framework-band.md`
  summary: >-
    `SiteFooter` is mounted in `app/page.tsx`, so the component named for the site ships on the home
    route only. Every other route still ends without a footer, and the next story to touch the region
    will either move it into the layout or mount it a second time.
  evidence: |-
    Story 2-11 scoped the footer to the homepage deliberately: FR-1 is a claim about the homepage's
    primary scroll, and putting a footer under `/work`, `/celeste` and the 404 in the same change
    would have reached past the story's boundaries into Stories 2-15 and 2-17. So this is a
    consequence of the scope rather than a defect in it.

    It is filed because nothing in the tree says so where the next reader will look. `SiteFooter.tsx`
    explains what it omits (no `<nav>`, no links, both deferred by name) but not where it is mounted
    or why that is not `app/layout.tsx`. Story 2-17 requires `/celeste` to be reachable from the
    footer and only from the footer, and Story 2-15 reshapes the nav; whichever lands first has to
    decide the mount point, and the placement cases in `app/__tests__/page.test.tsx` and
    `tests/e2e/premise.pw.ts` both pin the fragment shape that a move would change. Recording the
    decision now costs one docblock; rediscovering it costs a story.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-11-the-premise-block-and-the-framework-band.md`
  summary: >-
    `tests/e2e/premise.pw.ts`'s `outsideViewport` sweeps `document.querySelectorAll('*')`, so any
    overflow anywhere on the home route fails the premise suite, duplicating the A-5 sweep
    `tests/e2e/hit-target-floor.pw.ts` already runs for `/` and attributing the failure to the wrong
    story.
  evidence: |-
    The premise suite needs to know that the block it adds puts nothing outside the viewport at 360.
    It establishes that with a document-wide rect sweep, which is a strictly larger claim: an
    overflow introduced later by Story 2-31 or 2-33 in `WorkItem` or `WorkHero`, the two components
    `ops/known-violations.md` records as owning 28 of KV-5's 36 overflowing elements, would turn this
    file red while naming the premise.

    The narrow fix is to scope the sweep to `.premise`, `.plate-mark` and `.site-footer`, leaving the
    route-wide claim to the file that owns it. That was not done here because the same four helpers
    (`goTo`, `plantStyle`, `durationMs`, `EDGE_SLACK`) are now duplicated across four spec files and
    an earlier entry in this ledger already books lifting them to a story that owns the harness; the
    scoping and the extraction are one change, and `hit-target-floor.pw.ts` is off limits to Story
    2-11 for the reason recorded there.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-11-the-premise-block-and-the-framework-band.md`
  summary: >-
    `ESTATE_FRAMEWORKS` and `ESTATE_LANGUAGES` cite `DESIGN.md:208`, `EXPERIENCE.md:79` and the
    reference mockup for their names, order and counts, and nothing holds the constants against those
    documents. Only the Registry side is asserted.
  evidence: |-
    `lib/__tests__/registry.test.ts` proves every declared name resolves to some entry's `tech`, that
    the lists hold no duplicate, and that the counts are six and five. That closes the invented-fact
    hole, which is the one `EXPERIENCE.md:299-300` cares about: nothing in the band names software
    the estate does not run.

    The other direction is open. If `DESIGN.md:208` were amended to seven frontend frameworks, or
    `EXPERIENCE.md:79` reordered, the constants would keep their current values and every suite would
    stay green, because the assertion compares the rendered output to the same constant the component
    renders. The story asserts the order case against itself and cannot fail on a reordering.

    The shape that would close it is the agreement suite `ops/__tests__/hit-target-floor.test.ts` and
    `ops/__tests__/status-mark-axes.test.ts` already establish: parse the list out of the document as
    text and hold it equal to the exported constant in both directions. It is deferred rather than
    built because those two suites hold `ops/` records, which are written to be parsed, whereas
    `DESIGN.md:208` is a sentence of prose inside a design spine, and a parser over prose is a
    maintenance liability that fails on a rewording rather than on a change of fact. Choosing between
    a fragile parser and a stated non-goal is a decision, not an oversight.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-11-the-premise-block-and-the-framework-band.md`
  summary: >-
    The Plate mark's `label` is documented as section identity above a section head, and its only
    caller passes the Hub application's own name above a block that deliberately renders no heading.
    The component's contract and its one usage do not describe the same thing.
  evidence: |-
    `DESIGN.md:695-699` defines the Section variant as "section identity above a section head", and
    `PlateMarkProps.label` repeats it. `Premise.tsx` passes `hub.name`, which is `Cuatro Ecosystem`,
    the site's own identity, over a premise block whose Never list forbids a heading because
    `HomeLayout` already renders the page's.

    The usage is not invented: `mockups/key-screens.html:261` renders exactly this mark, identity and
    bare domain, over exactly this block on the non-3D path, so the design intends it. What is
    unresolved is whether "section identity" is the right name for a slot the design fills with site
    identity, and whether the mark belongs to the premise block at all or to the hero above it once
    Story 2-13 builds the non-3D front door and Story 2-12 supplies the narrative ordinal the
    mockup's other plate mark carries (`04 / 04`, `:237`).

    Story 2-31 owns the component next: it adds the Annotated and Side-ruled variants and retires
    `HudLabel` into it. That is the point at which the prop's contract is worth restating against
    every real call site rather than against one.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-12-the-narrative-resolves-into-the-suite-directory.md`
  id: DW-31
  summary: >-
    `glitch-text.scss:15` runs an infinite loop on the home route, animating `text-shadow` and
    `clip-path`. Story 2-12 repaired the homepage entrance and left this one, which is on the same
    route, because Story 2-27 owns it by name.
  evidence: |-
    `components/molecules/GlitchText/glitch-text.scss:15` sets `animation: glitch-loop 6s infinite`
    on `.glitch-text__inner`, and the keyframes drive `text-shadow` and `clip-path`.
    `EXPERIENCE.md:685-699` allows `transform` and `opacity` only and `:693-694` allows one
    orchestrated entrance per page load with no loop in it, so this is two breaches in one rule.

    It is on `/`, which is the route Story 2-12 measured, and `tests/e2e/narrative.pw.ts`'s property
    sweep does not catch it: the sweep reads inline declarations, which is where GSAP writes, and a
    CSS `@keyframes` animation writes nowhere. That is a real limit of that instrument as well as a
    real breach, and both belong to the story that owns the component. The `prefers-reduced-motion`
    guard at `:17-19` is present and correct, so a visitor who asks for stillness gets it; the
    breach is for everyone else.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-12-the-narrative-resolves-into-the-suite-directory.md`
  id: DW-32
  summary: >-
    `ScanlineOverlay.scss:39` runs an infinite grain animation. Story 2-28 owns it and Story 2-12
    left it untouched.
  evidence: |-
    `components/atoms/ScanlineOverlay/ScanlineOverlay.scss:39` sets
    `animation: grain-shift 0.4s steps(2) infinite` on the grain layer, which is a loop
    `EXPERIENCE.md:693-694` does not admit, at 2.5 steps a second for as long as the page is open.
    Its `prefers-reduced-motion` guard at `:41-43` is present.

    Same shape as the `glitch-text` entry above: a CSS animation rather than a tween, so it is
    invisible to the inline-declaration sweep `tests/e2e/narrative.pw.ts` runs, and the component is
    outside Story 2-12's boundaries by name.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-12-the-narrative-resolves-into-the-suite-directory.md`
  id: DW-33
  summary: >-
    `HomeLayout.scss` still transitions `opacity` on hover for the dim-siblings effect and `color` on
    two link rules, all three on the route Story 2-12 repaired. `epics.md:3322-3326` gives the
    dim-siblings retirement to Story 2-29 by name.
  evidence: |-
    `components/organisms/HomeLayout/HomeLayout.scss:80-82` sets `opacity: 0.2` on every unhovered
    panel while any panel is hovered, driven by the `transition: opacity 0.4s ease` at `:40`. `:126`
    and `:159` each set `transition: color 0.2s ease` on a link. (`:127` is the `.nav-link` opacity
    initial state, which is a different line and a conformant one.)

    `opacity` is an allowed property, so the dim-siblings rule is not a property breach; it is a
    retirement `epics.md:3322-3326` already books to Story 2-29, which is also the story that makes
    `HomeLayout.scss` token-native. The two `color` transitions are the ordinary kind of breach:
    `color` is neither `transform` nor `opacity`. All three were explicitly outside Story 2-12's
    boundaries, which permitted exactly one declaration in this file to move, `filter: brightness(0)`
    to `opacity: 0` at `:190`.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-12-the-narrative-resolves-into-the-suite-directory.md`
  id: DW-34
  summary: >-
    `WorkItem.tsx:41-55` animates `height` on every accordion open and close, which is a layout
    property on the main thread. Story 2-31 owns the component.
  evidence: |-
    `components/atoms/WorkItem/WorkItem.tsx:41-48` tweens `height` to the measured `scrollHeight` on
    open and `:51-55` tweens it back to `0` on close, with `overflow: hidden` set around both.
    `EXPERIENCE.md:685-699` allows `transform` and `opacity` only, and `height` is the canonical
    example of the rule's reason: every frame is a layout pass rather than a composite.

    It is honest work rather than careless: animating an accordion to `auto` needs a measured target
    and this is the usual way to get one. The conformant replacement is a grid-template-rows or a
    transform-based reveal, which is a rebuild of the component's open state rather than a tweak, and
    Story 2-31 is the rebuild. The reduced-motion path is handled at `:36`, which sets the duration
    to zero rather than skipping the tween.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-12-the-narrative-resolves-into-the-suite-directory.md`
  id: DW-35
  summary: >-
    `WorkTimeline.tsx:19-29` adds a scroll-triggered fade-up on `/work`, which is a second
    orchestrated entrance on a route that already has one. Story 2-33 owns it, together with
    `WorkHero`.
  evidence: |-
    `components/organisms/WorkTimeline/WorkTimeline.tsx:19-29` calls `ScrollTrigger.batch` on
    `.work-item` and runs `gsap.from` with `y` and `opacity` as each batch enters at `top 85%`. The
    properties are conformant; what is not is `DESIGN.md:1292` and `EXPERIENCE.md:693-694`, which
    allow one orchestrated entrance per page load.

    Recorded from Story 2-12 rather than fixed because that story's boundaries name `WorkTimeline`
    and `WorkHero` as Story 2-33's and forbid touching them, and because `/work` is a route Story
    2-12 was required to leave byte-identical in shape: its R3F boundary carries the same static
    import defect the homepage's did and is deliberately still standing.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-12-the-narrative-resolves-into-the-suite-directory.md`
  id: DW-36
  summary: >-
    `app/providers.tsx:4-6` imports `lenis`, `gsap` and `ScrollTrigger` at module scope and the root
    layout renders `Providers`, so 56,582 gzipped bytes of narrative library ship on every route,
    including `/celeste` and the 404, which have no motion of their own to drive.
  evidence: |-
    Re-measured 2026-09-07 by `node ops/asset-budget.mjs` against `.next/BUILD_ID`
    `rxNy6yw47ecyqZzmT1Jzp`: `08pj4xkz~kajd.js` (gsap, 26,971 gzipped), `0r_9pnds9g3a0.js`
    (gsap/ScrollTrigger, 17,542) and `0nwet2hiefxan.js` (lenis, 12,069) are each referenced by all
    seven prerendered documents. The figure and the shape are unchanged from the 2026-08-29 reading.

    Story 2-12 named this in its boundaries and refused it: the story's subject is the homepage's
    narrative bundle, and these three are on every route, so moving them is a change with a
    different blast radius and a different test surface. It is the larger half of what
    `EXPERIENCE.md` Rule 1 claims and `ops/asset-budget.md` § What this reads against the budget's
    own rules falsifies. The cheap version is a client boundary that mounts `Providers` only where
    something needs it; the honest version needs to decide whether Lenis belongs on `/celeste` and
    the 404 at all, which is a design decision rather than a bundling one.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-12-the-narrative-resolves-into-the-suite-directory.md`
  id: DW-37
  summary: >-
    A dynamically imported chunk that fails to arrive takes the whole route down through Next's
    default error boundary. Story 2-12 caught it for the homepage's gem and left the identical shape
    standing at `TorusCanvas` and `TorusKnotCanvas` on `/work` and `/projects`.
  evidence: |-
    Observed 2026-09-07 in `mcr.microsoft.com/playwright:v1.62.1-noble`, by aborting every script
    carrying a WebGL fingerprint with `page.route` and loading `/`. Before the fix the premise block,
    the Suite Directory and the footer were all gone: `next/dynamic` resolves through `React.lazy`,
    a rejected import throws during render, and the nearest boundary is Next's own, which replaces
    the route rather than the component. A visitor whose connection dropped one request got an error
    page instead of the Directory.

    `components/molecules/GemComponent/GemComponent.tsx:16-38` now resolves the failed import to a
    component that draws nothing, which is what makes the page independent of the payload rather
    than merely deferring it, and `tests/e2e/narrative.pw.ts` holds it there.

    `components/molecules/TorusCanvas/TorusCanvas.tsx:8` and
    `components/molecules/TorusKnotCanvas/TorusKnotCanvas.tsx:8` wrap `Scene` the same way and have
    no such catch, so `/work` and `/projects` still fail whole-route on a dropped chunk. Nothing
    tests it, because Story 2-12's boundaries put both routes out of scope and its aborting test
    visits `/` only. The fix is three lines each.

    **Owners, which no other entry in this cluster leaves unnamed.** `TorusCanvas` is rendered by
    `WorkHero.tsx:71` on `/work`, and **Story 2-33** redesigns `WorkHero` and `WorkTimeline`, so it
    is the story with that file open. `TorusKnotCanvas` is rendered by `ProjectsHero.tsx:70` on
    `/projects`, and **Story 2-14** redirects that route to `/#suite`, which retires the surface
    rather than the component: if 2-14 leaves `ProjectsHero` mounted anywhere the defect outlives
    the redirect and needs an owner of its own. Whichever lands first should take both, because the
    change is identical and a route that shows an error page instead of its content after one
    dropped request is the most user-visible item in this cluster.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-12-the-narrative-resolves-into-the-suite-directory.md`
  id: DW-38
  summary: >-
    The homepage still pulls narrative bytes shortly after hydration, because Next prefetches the
    `/work` and `/projects` route bundles behind the two `<Link>`s in the hero nav. The deferral is
    real for first paint and smaller than it looks for a session.
  evidence: |-
    Observed 2026-09-07 in the pinned container, by recording every script request on `/` and
    subtracting the set the document itself references. Five chunks were fetched that the document
    does not name: the three the gem's boundary defers, plus two carrying `three-stdlib`
    (`0bmu3elf~urvv.js` and `0a3g1m.trcqpl.js` in that build; chunk names are content hashes and
    move every build). The two extra ones are the route bundles behind
    `HomeLayout.tsx`'s `<Link href='/work'>` and `<Link href='/projects'>`, which the App Router
    prefetches once they are in the viewport.

    This does not weaken the acceptance criterion Story 2-12 met, which is about what the `/`
    document references before it can paint, and `ops/asset-budget.md` measures exactly that. It
    does mean the § Every route figure for `/` understates what a homepage visitor's browser ends up
    fetching, and that closing the `TorusCanvas` and `TorusKnotCanvas` boundaries would shrink the
    homepage's real transfer as well as those two routes'. Worth a line in
    `ops/asset-budget.md` § Stated limits when that file is next re-measured, and worth knowing
    before anyone reads `/` at 295,123 gzipped as the whole story.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-12-the-narrative-resolves-into-the-suite-directory.md`
  id: DW-39
  summary: >-
    The `/` document emits its two font preloads twice, four `<link rel=preload as=font>` elements
    for two files, because `app/layout.tsx` declares them and Next re-emits them for the route.
  evidence: |-
    Observed 2026-09-07 in `.next/server/app/index.html`: `MonumentExtended-Bold.woff2` and
    `ConfilliaNormal-Regular.woff2` each appear twice, once with `crossorigin` before `type` and
    once after, so they are two separate emissions rather than one duplicated string.

    It costs no transfer: a browser fetches a URL once whatever the number of links, and
    `ops/asset-budget.mjs` deduplicates on the resolved path, so no figure in `ops/asset-budget.md`
    is affected. `tests/e2e/narrative.pw.ts` therefore asserts on the distinct set of preloaded
    faces rather than on the element count, and says so.

    Filed because it is a document the estate serves saying something twice, which is the kind of
    thing that reads as a bug to whoever finds it next, and because Pending Operator action 2 in
    `ops/asset-budget.md` already has both preloads under review: at least one of the two faces
    (`MonumentExtended-Bold`) is reached by no rule at all, so the cheapest resolution may be to
    remove one of them rather than to deduplicate it.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-12-the-narrative-resolves-into-the-suite-directory.md`
  id: DW-40
  summary: >-
    A Playwright spec cannot import `ops/asset-budget.mjs`, so `tests/e2e/narrative.pw.ts` parses the
    `FINGERPRINTS` table out of the file as text. Two consumers now read one table by two different
    mechanisms, and only one of them would fail loudly if the table's shape changed.
  evidence: |-
    Observed 2026-09-07. `ops/__tests__/asset-budget.test.ts:8-46` imports the tool directly and
    Vitest handles the ES module. Playwright transpiles a spec to CommonJS, the repository declares
    no `"type": "module"`, and the tool uses `import.meta.url` at `:1880` and `:1904`, so the same
    import fails the whole file with `SyntaxError: Cannot use 'import.meta' outside a module` and
    `No tests found`.

    The spec's own rule is that the table is reused rather than restated, so the file reads it out
    of the source with a regex and guards the parse two ways: the entry count is held equal to the
    tool's own declaration count, and the scan is shown discriminating against a real
    narrative-bearing chunk. That closes the vacuity risk and does not close the coupling: a table
    reformatted to double quotes, or to one entry per several lines, would fail the parse guard with
    a message about the parse rather than about the table.

    Two clean closures, neither urgent. Move the fingerprint table into a small `.ts` module both
    consumers import, leaving `ops/asset-budget.mjs` importing it too. Or drop `import.meta.url` from
    the tool's `main` default argument, which is the only thing making it unloadable from CommonJS.
    The first is better and is a change to a file `ops/__tests__/asset-budget.test.ts` pins as
    literals, so it lands with that suite.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-12-the-narrative-resolves-into-the-suite-directory.md`
  id: DW-41
  summary: >-
    `HomeLayout.test.tsx` mocks `useGsapContext` with a function that never invokes its callback, so
    no jsdom case in the repository can observe the homepage entrance at all. That is why the
    reduced-motion branch, which is now the gem's only reveal for that visitor, went unpinned until a
    review caught it.
  evidence: |-
    `components/organisms/HomeLayout/__tests__/HomeLayout.test.tsx:23-27` replaces `useGsapContext`
    with `(_fn: () => void) => ({ current: document.createElement('div') })`. The callback holding
    the whole timeline is received and dropped, so every assertion in that file is about markup and
    none is about motion. The `gsap` mock above it at `:4-19` is consequently never exercised either.

    The cost is not hypothetical. Story 2-12 moved `.home-gem` from `filter: brightness(0)` to
    `opacity: 0`, which makes `gsap.set('.home-gem', { opacity: 1 })` in the reduced-motion branch
    the only thing that ever reveals the gem for a `prefers-reduced-motion` visitor, on the WebGL
    path and on the static fallback alike. Deleting that one line leaves a permanently blank hero,
    and the entire jsdom suite stays green. It is now covered in the browser
    (`tests/e2e/narrative.pw.ts`, `is at its final state immediately under reduced motion`, verified
    failing against the deletion on 2026-09-07), which is the right place for it, but the jsdom mock
    remains a hole that reads like coverage.

    The narrow fix is a mock that invokes the callback, which needs the `gsap` mock to record the
    calls so a case can assert on them. Filed rather than done because Story 2-12's boundaries name
    `HomeLayout.tsx`, its stylesheet and two test files, and rewriting a fifth file's mocking
    strategy is a change with its own failure modes. Story 2-29 redesigns `HomeLayout` and is the
    natural owner.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-12-the-narrative-resolves-into-the-suite-directory.md`
  id: DW-42
  summary: >-
    `.home-gem` is hidden by `opacity: 0` with no floor for a visitor whose scripting never runs, so
    the gem is invisible with JavaScript disabled or broken. Not a regression, the same shape
    `filter: brightness(0)` had, but Story 2-12 is the story that touched the line.
  evidence: |-
    `components/organisms/HomeLayout/HomeLayout.scss:190` declares `opacity: 0` and nothing in CSS
    ever undoes it: both the timeline and the reduced-motion `gsap.set` are JavaScript. A visitor
    with scripting off, or one whose bundle fails before hydration, sees an empty hero panel. The
    same was true of `filter: brightness(0)` before this story, so the disposition is unchanged and
    the risk is not new.

    Three of the four other panels on this route have the identical shape (`:52`, `:90`, `:127` and
    `:160` all open at `opacity: 0`), so a fix belongs to the route rather than to the gem: a
    `<noscript>` rule, or an `html.no-js` class set by an inline script, would lift all five at once.
    Recorded here because a reader comparing `HomeLayout.scss` before and after Story 2-12 will see
    that line change and should be able to find out that the question was asked and deliberately not
    answered. Story 2-29 rebuilds this stylesheet and is where the decision belongs; Story 2-13,
    which builds the non-3D front door, is the other candidate.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-13-the-non-3d-front-door-and-the-skip-control.md`
  id: DW-43
  summary: >-
    A-6, the accessibility skip-link, is named in four planning artifacts and required by none of
    them. No story's acceptance criteria asked for one to be built, so nothing scheduled it, and
    Story 2-13 built it because it was standing next to the skip control.
  evidence: |-
    **Corrected 2026-09-07 after review.** This entry first claimed that no story named A-6 and that
    no story's criteria mentioned a skip-link. Both were false as written. `epics.md:637` books A-6
    in the accessibility floor as "skip-link is the first tabbable element"; `epics.md:580` and
    `:2582-2583` both require the skip control to be distinct from it; `EXPERIENCE.md:421-422` says
    the same; and `review-accessibility.md:245-246` prescribes the markup that was built, down to
    `<a class="skip-link" href="#main">` first in the DOM followed by `<main id="main">`.

    What is true is narrower and is still the finding. Every one of those references describes the
    skip-link as something that already exists, in order to say what the skip control is not. No
    story's acceptance criteria require building one, so no story would have failed for its absence:
    before Story 2-13 the string `skip-link` appeared nowhere in this repository outside planning
    artifacts, and `<main>` carried no `id`, so the target did not exist to be linked to either.

    Story 2-13 shipped it: `components/atoms/SkipLink/` plus `id='main'` and `tabIndex={-1}` on the
    landmark in `app/page.tsx`, asserted in `tests/e2e/front-door.pw.ts`. That closes A-6 on `/` and
    on `/` only. **The other four surfaces still have no skip-link and no `<main>` at all**, which is
    Story 2-26's work and is why this story deliberately did not add one there.

    What is filed is the process finding rather than the code: an accessibility requirement that
    every story assumed someone else owned survived to the thirteenth story of the epic. Story 2-26
    is the Hub's accessibility pass and is the natural place to sweep the rest of the A-numbers for
    the same shape before it starts.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-13-the-non-3d-front-door-and-the-skip-control.md`
  id: DW-44
  summary: >-
    Neither skip has a visual row in any design document, so both were styled from the general rules
    rather than from a specification. `review-rubric.md:40` already booked this for the skip control;
    the skip-link is the same hole and is not even named there.
  evidence: |-
    `review-rubric.md:40` reads, of the skip control: "behaviour is specified (above the fold, moves
    focus not scroll, distinct from the a11y skip-link) with no visual row, though it is load-bearing
    for FR-2's one-interaction requirement and appears styled in the mock. *Fix:* add a row, or state
    that it inherits the Button spec." That finding is still open, and the A-6 link is in a worse
    position: `DESIGN.md` and `EXPERIENCE.md` do not mention it as a component at all.

    Both were therefore built from the rules that do exist rather than from a row: mono uppercase
    signage at `--t-2xs` with `--tr-meta`, a hairline underline in `--token-border-interactive` that
    hover recolours rather than adds, `:focus-visible` painted instantly in `--token-focus` at
    `--focus-offset` (`EXPERIENCE.md:645`, `:716-720`), and `--tap` as the floor on both axes
    (`:727-730`). Every one of those is a real rule from a real document, and none of them is a
    decision about what these two controls should look like.

    The consequence is that a reviewer has nothing to compare the shipped controls against, and the
    next story that touches either has nothing to preserve. Closing it is a `DESIGN.md` edit, which
    is a planning artifact under a frozen approval and not a thing a story may amend on its own.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-13-the-non-3d-front-door-and-the-skip-control.md`
  id: DW-45
  summary: >-
    PRD open question Q7 still reads open at `prd.md:814` while `EXPERIENCE.md:172` states that it is
    closed, and Story 2-13 has now implemented the closed answer. Two planning artifacts disagree
    about a decision the code has already made.
  evidence: |-
    `prd.md:814` reads: "**Does the Hub's narrative survive the reduced-motion path intact?** FR-2
    requires the Suite Directory to be reachable regardless; whether the narrative gets a static
    fallback or is simply skipped is undecided."

    `EXPERIENCE.md:172-178` answers it: "**Q7 is closed: there is one non-3D front door, not two.**
    `prefers-reduced-motion: reduce` and the slow-connection path receive the **same** artefact, a
    typographic hero. No static poster frame of the 3D scene is produced." Three reasons are given,
    the first being that a still of a 3D scene reads as a broken 3D scene.

    Story 2-13 implemented the closed answer: the poster frame is deleted, all four triggers reach
    one flat front door, and `tests/e2e/front-door.pw.ts` measures it. So the repository now agrees
    with `EXPERIENCE.md` and disagrees with the PRD's open-questions list.

    Filed rather than fixed for the reason every other planning-artifact drift in this ledger is: the
    PRD is under a frozen approval and a story does not edit one as a side effect of implementing it.
    The closure is a one-line strike-through in the shape `prd.md:809` and `:813` already use for the
    two questions that closed on 2026-08-15.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-13-the-non-3d-front-door-and-the-skip-control.md`
  id: DW-46
  summary: >-
    A-14 is claimed by Story 2-13 and by Story 2-29, and Story 2-13 ran first. The canvas is now
    `aria-hidden` and outside the tab order; whichever story reaches it second will find the work
    done and must not undo it.
  evidence: |-
    A-14 requires the decorative canvas to be removed from the accessibility tree and from the tab
    order. Before this story `components/atoms/Scene/Scene.tsx` set neither, so the claim was made in
    the plan and held nowhere.

    Story 2-13 closed it, because the non-3D path is the other half of the same question and one
    story could not honestly assert "no canvas on the flat path" while leaving the canvas on the
    default path unlabelled. The treatment is on both the wrapper and the element:
    `@react-three/fiber` spreads unknown props onto its own `<div>` rather than onto the `<canvas>`,
    so `aria-hidden` on `<Canvas>` covers the subtree, and `onCreated` sets `aria-hidden` and
    `tabIndex = -1` on `gl.domElement` itself. `tests/e2e/front-door.pw.ts` asserts both, plus twelve
    Tab presses that never land on it.

    Story 2-29 redesigns `HomeLayout` and names A-14 in its own criteria. It should verify rather
    than re-implement, and it must not drop either half: the element-level `tabIndex` is a guard
    against a future library version or a drei helper adding one, not a repair of something broken
    today.

    **Corrected 2026-09-07 after review: this entry describes two of A-14's three clauses.**
    `EXPERIENCE.md:773` and `epics.md:2591` read "aria-hidden, not focusable, **and its content is
    stated in prose**". The third is not shipped and is filed separately as DW-52.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-13-the-non-3d-front-door-and-the-skip-control.md`
  id: DW-47
  summary: >-
    Two of the four non-3D triggers can only be read from script, so those visitors get one layout
    shift when the hero collapses after hydration. Narrowed from three by the Operator ruling of
    2026-09-07, which moved `Save-Data` to the server. The two that remain are a slow `effectiveType`
    and an absent WebGL context, and neither exists outside the browser.
  evidence: |-
    The spec requires that the undecided state render the default path's geometry and that every
    trigger which can be answered before the document paints is. Two can.

    `prefers-reduced-motion` is a media query, so `HomeLayout.scss` carries the flat shape under
    `@media (prefers-reduced-motion: reduce)` as well as under the `.home-container--flat` modifier:
    that visitor's first paint is already flat, without a line of script.

    `Save-Data` is an HTTP request header, so `app/page.tsx` reads it with `next/headers` and hands
    `HomeLayout` a verdict the hook takes as its starting state. That visitor's first *markup* is
    already flat: no gem container and no skip control are in the document at all.
    `tests/e2e/front-door.pw.ts` asserts exactly that on the served bytes with hydration blocked,
    counting both elements as well as reading the modifier class, and asserts the opposite counts on
    every other door, where the served markup is the default path's and is corrected later. **This
    is the half of this entry that closed.** It cost `/` its static rendering, which DW-50 records.

    A slow `effectiveType` and an absent WebGL context remain. `navigator.connection.effectiveType`
    is carried by no request header and answered by no media query, and WebGL capability is knowable
    only by asking for a context. Those two paint the default geometry, hydrate, and then collapse
    once. Measured 2026-09-07 in `mcr.microsoft.com/playwright:v1.62.1-noble` at a 1024 viewport:
    800.00 served, 520.70 settled, one downward step of 279.30 and no upward one, sampled on every
    animation frame. Both facts are asserted rather than tolerated, and the same sampler asserts
    zero collapses on the three doors that are answered before paint, which is what makes those
    readings measurements.

    Two closures exist for the remainder and both are somebody else's. A blocking inline script in
    `app/layout.tsx` could probe WebGL before first paint and stamp the root element, which is the
    theme-flash pattern; it costs a synchronous WebGL context creation on every page load and adds an
    inline script to a document this epic keeps deliberately thin. Or `prefers-reduced-data` reaches
    Chromium stable, which would answer the slow-connection case in CSS for free. Neither is Story
    2-13's to decide, and the residual shift is a shrink of a hero on a path that is otherwise
    strictly cheaper, so it is recorded with its numbers rather than papered over.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-13-the-non-3d-front-door-and-the-skip-control.md`
  id: DW-48
  summary: >-
    `gsap.set('.home-gem', { opacity: 1 })` in `HomeLayout`'s reduced-motion branch is now
    unreachable, because reduced motion is one of the triggers that renders no `.home-gem` at all. It
    was the line DW-41 records as the gem's only reveal for that visitor.
  evidence: |-
    `components/organisms/HomeLayout/HomeLayout.tsx:21` sets the gem to full opacity when
    `useReduceMotion()` answers true. Since Story 2-13, `useReduceMotion()` answering true also means
    `useNarrativePath()` answers `'flat'`, which means neither `.home-gem` nor `GemComponent` renders.
    The line still runs, against a selector that matches the element only in the frame between the
    first commit and the deciding effect, and it has no observable effect in any of them.

    It is left in place rather than deleted because this story's spec fixes the entrance as Story 2-12
    left it, and because deleting it is only safe while the coupling above holds: a future story that
    let a reduced-motion visitor onto the narrative path would need that line back and would not know
    it. The browser case that covered it (`tests/e2e/narrative.pw.ts`, "is at its final state
    immediately under reduced motion") was rewritten by this story to read `.home-role` instead, which
    is the panel opacity the same branch really does set, and to assert that no `.home-gem` exists on
    that path.

    Story 2-29 rebuilds this component and is the natural owner. DW-41 and DW-42 are the two related
    entries on the same four lines.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-13-the-non-3d-front-door-and-the-skip-control.md`
  id: DW-49
  summary: >-
    The `FINGERPRINTS` parse out of `ops/asset-budget.mjs` now has a third copy, in
    `tests/e2e/front-door.pw.ts`. DW-40 books the fix; this is the second file to pay for it and
    raises the price of leaving it.
  evidence: |-
    DW-40 records that `ops/asset-budget.mjs` cannot be imported from a Playwright spec, because the
    tool is an ES module using `import.meta` and Playwright transpiles a spec to CommonJS, so
    `tests/e2e/narrative.pw.ts` reads the table out of the file as text with a regex. Story 2-13
    needed the same table to prove that no non-3D trigger fetches the gem chunk, and copied a
    narrowed form of that parse: `@react-three/postprocessing` only, which is the one library
    `GemNarrative` imports and nothing else in the repository does.

    Both copies now depend on the tool's exact literal formatting, and a reflow of that array would
    fail two specs with messages about a parse. The remedy DW-40 already names, a small `.ts` module
    both the tool and the specs import, is now worth more: three readers rather than two.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-13-the-non-3d-front-door-and-the-skip-control.md`
  id: DW-50
  summary: >-
    `/` is no longer prerendered. Reading the `Save-Data` header opts the route out of static
    rendering, which is the price of the 2026-09-07 ruling and was paid deliberately. Nothing gates
    on it, but `ops/asset-budget.mjs` weighs prerendered documents, so the homepage's document figure
    is now unmeasurable by the tool, and the origin serves the route per request.
  evidence: |-
    `headers()` is a dynamic API: a route that calls it is server-rendered on demand. `corepack pnpm
    build` now prints `ƒ /` where it printed `○ /`, and `.next/server/app` holds seven documents
    rather than eight. Verified 2026-09-07 that nothing pins the mode: no `export const dynamic`
    anywhere under `app/`, no test reads `.next/server/app` outside its own fixtures
    (`ops/__tests__/asset-budget.test.ts` writes the documents it reads), the CI job names are
    untouched, and `corepack pnpm build`, the full vitest suite and the whole Playwright suite in the
    pinned container are green.

    Two consequences are real and neither is a defect. A third, the `Vary` header this route ought
    to carry now that it varies, is DW-51.

    **The record loses a row it used to be able to take.** `ops/asset-budget.mjs` reads
    `.next/server/app/*.html` as ground truth for what a route references, so `/` now has no row in
    § Every route and the "8 prerendered documents" figures elsewhere in `ops/asset-budget.md` read
    7. The tool still runs, because it refuses only an empty set. Re-measuring the homepage's
    payload now needs a request against a running server rather than a file on disk, which is a
    change to the tool rather than to the record, and `tests/e2e/narrative.pw.ts` already fetches the
    served document that way for its own scan.

    **The origin renders `/` per request.** The Anchor is served by `next start` in Docker on a
    two-core box that also compiles during deploys (`ops/known-violations.md`), and Cloudflare sits
    in front (AD-26). A dynamically rendered route is returned with no-store by default, so the CDN
    stops absorbing homepage traffic that a static file used to satisfy. The page has no data
    fetching in it, so the cost is React SSR on the box rather than anything remote. Worth an
    Operator eye against `ops/capacity-threshold.md` before Epic 3, and worth knowing if `/` ever
    reads slow in production.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-13-the-non-3d-front-door-and-the-skip-control.md`
  id: DW-51
  summary: >-
    `/` now varies on the `Save-Data` request header and the response does not say so. `Vary:
    Save-Data` is declared in `next.config.js` and never reaches the wire, because Next overwrites
    that header with its own RSC list on every App Router response. What forbids a shared cache from
    mis-serving the two documents today is the `no-store, private` a dynamic route is answered with,
    which is a weaker promise than the one the rule is written in.
  evidence: |-
    Measured 2026-09-07 against `.next/standalone/server.js` on the built tree. A custom header
    declared in `next.config.js` for `source: '/'` does reach the response: a probe key added beside
    the `Vary` arrived intact. The `Vary` itself did not. The response carries
    `Vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch,
    Accept-Encoding`, which is Next's own value written after the custom headers are applied, so the
    declaration is replaced rather than merged.

    The declaration is kept anyway. It is the correct statement of what the route does, it costs
    nothing, and it takes effect the day Next merges rather than replaces. Writing Next's four RSC
    tokens into the config beside `Save-Data` would work today and would hardcode framework
    internals into a file that outlives them, which is a worse trade.

    The exposure is currently zero and is worth stating precisely. AD-26 puts Cloudflare in front of
    this origin, and Next answers a dynamically rendered route with `Cache-Control: no-store,
    must-revalidate, no-cache, max-age=0, private`, so no shared cache may store the document at
    all, with or without a `Vary`. The hazard arrives if anyone makes `/` cacheable again: PPR, an
    `s-maxage` rule at the CDN, or a future story that moves the header read somewhere static.
    `tests/e2e/front-door.pw.ts` therefore asserts the guarantee rather than the header, requiring
    that `/` either declares `Vary: Save-Data` or forbids shared storage, and it fails the day
    neither is true.

    Two closures. A `middleware.ts` can set response headers after the render, which is a new
    top-level source file and a per-request hop for one header, and it is a change with its own
    scope. Or the edge does it: `docker/Caddyfile` is already incomplete against
    `ops/routing-inventory.md` and is being rebuilt in Epic 4, which is the natural place for a
    `Vary` on one route.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-13-the-non-3d-front-door-and-the-skip-control.md`
  id: DW-52
  summary: >-
    A-14 has three clauses and this story shipped two. The canvas is `aria-hidden` and out of the tab
    order; its content is nowhere stated in prose, nothing asserts that it is, and the story's own
    matrix scoped the row to the two clauses it met.
  evidence: |-
    `EXPERIENCE.md:773` reads "The 3D canvas is `aria-hidden` and not focusable, being decorative
    with its content stated in prose", and `epics.md:2591` repeats it as an acceptance criterion:
    "**Then** it is `aria-hidden`, not focusable, and its content is stated in prose."

    Story 2-13 closed the first two in `components/atoms/Scene/Scene.tsx` and asserted both in
    `tests/e2e/front-door.pw.ts`. The third is a content question rather than a markup one: nothing
    on `/` describes what the narrative shows. The premise block above the Directory is about the
    estate rather than about the scene, and the `alt`-less canvas leaves a reader who cannot see it
    with no account of what they are missing.

    It is filed rather than done because the prose does not exist to ship: no design document writes
    a description of the scene, `review-rubric.md` records that the narrative has no visual row of
    its own, and inventing one in an implementation story would be writing product copy under a spec
    that forbids invented facts. Story 2-29 rebuilds the hero and Story 2-26 is the Hub's
    accessibility pass; either can carry it, and whichever does needs a sentence from the Operator
    or a decision that a decorative canvas needs no prose, which would be an `EXPERIENCE.md` change.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-13-the-non-3d-front-door-and-the-skip-control.md`
  id: DW-53
  summary: >-
    The cross-surface total in `ops/hit-target-floor.md` is read by no test. Story 2-13's spec said
    the record and the spec file are held equal in both directions, and that is true of the
    per-surface table only: the sentence stating the total could have been left at 53 while every
    number around it moved to 17, with the whole suite green.
  evidence: |-
    `ops/__tests__/hit-target-floor.test.ts` parses two tables out of the record, the exemption
    ledger and the surfaces swept, and holds each against the literal in
    `tests/e2e/hit-target-floor.pw.ts`. The prose line "**54 elements measured across five
    surfaces**" is not in either table, and no other test reads the record's prose. Verified
    2026-09-07 by reading the suite: `recordSurfaces` takes `section(markdown, 'The surfaces swept')`
    and `table(..., 'Surface')`, and nothing else in the file touches that section's text.

    Story 2-13 moved the total from 53 to 54 by hand and correctly, so nothing is wrong in the
    record today. What is wrong is the belief, stated in the story's spec, that the total is held
    equal by a test. It is a derived figure, it is the one a reader quotes, and it drifts silently.

    The fix is small and belongs with the suite that already parses the table: sum the `Measured`
    column and compare it against the number in that sentence, with the same both-directions message
    the other comparisons carry. It was not done here because that suite is Story 2-8's instrument
    and this story's boundaries name the two numbers rather than the agreement between them.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-14-projects-redirects-permanently-to-suite.md`
  id: DW-54
  summary: >-
    Two more derived sentences in `ops/hit-target-floor.md` had already drifted one out before this
    story touched them, in the same way and for the same reason as DW-53's total. They read 27 of 53
    and 26 against a surfaces table summing to 54.
  evidence: |-
    § The tolerated breach opened "**27 of the 53 measured elements are under the floor**" and, two
    paragraphs down, "The 26 elements that clear the floor are the four `.work-item__header` buttons
    and the 22 Suite Directory links". Both were correct on 2026-09-06. Story 2-13 then moved `/`
    from 16 to 17 candidates and updated the table and the total, and these two sentences were not
    carried with it: at `97bfc6b` the table summed to 54 while they described 53.

    Verified 2026-09-07 by summing the record's own `Measured` column at that commit and comparing.
    Story 2-14 re-measured rather than back-dated: both sentences now carry the post-2-14 figures
    (20 of 36, and 16 clearing) with their own date, and the drift is recorded here so a later
    reader can tell the correction from the re-measurement.

    **This is DW-53's shape and not DW-53.** That entry is about the one-line total; these are two
    further derived figures in a different section, and neither is read by any test either. Closing
    DW-53 as written, by summing the `Measured` column and comparing it against the sentence, would
    not catch these. The cheapest honest fix is to derive all three in the same case, which is the
    Story 2-8 instrument's to change and not this story's.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-14-projects-redirects-permanently-to-suite.md`
  id: DW-55
  summary: >-
    Both chrome links to `/projects` were deliberately left pointing at the redirect. Every visitor
    who uses the nav or the homepage panel now pays an extra round trip, and the App Router
    prefetches a 301 rather than a route bundle.
  evidence: |-
    `components/atoms/Navbar/Navbar.tsx:7` renders `<Link href='/projects'>Projects</Link>` and
    `components/organisms/HomeLayout/HomeLayout.tsx:145` renders the homepage panel's
    `<Link href='/projects' className='nav-link'>`. Operator ruling of 2026-09-07: repointing the
    chrome is Story 2-15's job, so Story 2-14 left both untouched and both tests green
    (`Navbar.test.tsx:31-33` and `HomeLayout.test.tsx:104-107` pin the `href`).

    Nothing is broken. The redirect is what keeps them working, which is the whole reason the URL
    survived. What is deferred is the cost and the accuracy: a nav item labelled "Projects" that
    lands on the homepage's Suite Directory is a label the destination no longer matches, and the
    prefetch that used to warm `/projects`'s bundle now warms a redirect.

    Story 2-15 owns the chrome nav by title and already owns `chrome-nav` in
    `ops/hit-target-floor.md`'s exemption ledger, so the repoint and the hit-target repair land
    together. Whichever story takes it moves both call sites, both unit assertions, and the
    `ENTRANCE_SELECTOR` note in `tests/e2e/hit-target-floor.pw.ts` that already anticipates the
    `.nav-link` rename.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-14-projects-redirects-permanently-to-suite.md`
  id: DW-56
  summary: >-
    `next.config.js` matches a redirect `source` case-insensitively, so `/Projects` and `/PROJECTS`
    now answer 301 where they answered 404 before this story. The story's own I/O matrix predicted
    the opposite.
  evidence: |-
    The matrix row read "`/Projects` ... is not a route and 404s", with the note "Next matches
    `source` case-sensitively; assert what it does rather than assuming". Measured 2026-09-07
    against a local production build (`pnpm build && pnpm start --port 3100`) with an HTTP client
    that follows nothing: `/projects`, `/Projects` and `/PROJECTS` all answer `301` with
    `Location: /#suite`. `/projectsX` answers 404, so the source is anchored and only its case
    folding is loose. Next compiles `redirects()` sources with case sensitivity off by default;
    the App Router's own file-based matching is case-sensitive, which is why `/Projects` reached
    `app/not-found.tsx` before.

    Asserted as observed in `tests/e2e/projects-redirect.pw.ts` rather than left unstated, under a
    case whose title says it is Next behaviour rather than this rule's. It is filed rather than
    fixed because the change is in the forgiving direction, no requirement in the plan states a
    case rule for URLs, and none of the paths NFR-2's acceptance criterion names is affected.

    Closing it, if the estate decides a URL should be case-sensitive, means either a `has`
    condition or moving the redirect out of `next.config.js` into middleware, both of which are a
    routing decision rather than an implementation detail.

    **There is nowhere in `ops/` to record such a rule today, and that is part of the finding.**
    `ops/routing-inventory.md` is the estate's edge table: hostnames, DNS, Caddy, compose projects
    and containers. It carries no per-URL disposition for the Hub and was not touched by this
    story, so pointing a reader at it would send them somewhere the answer is not. The two places
    that do carry per-URL behaviour are `next.config.js`, which is the rule, and `README.md`
    § Routing, which is the human-readable table Story 2-14 updated. Neither states a case policy,
    and neither is an `ops/` record with a Nature column.

    **Owner: whichever story next takes a routing decision for the Hub**, which on today's board is
    Story 2-25 (relocating `list-wheel` onto a `cuatro.dev` subdomain), the only remaining Epic 2
    story whose subject is a URL. **Trigger: any of three.** A second redirect being added, at which
    point one loose match becomes a pattern; a case variant showing up in Umami once Story 2-24
    lands visitor instrumentation, which would make this measurable rather than theoretical; or a
    decision that the Hub states a case policy at all, which needs an Operator sentence because no
    requirement in the plan carries one.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-14-projects-redirects-permanently-to-suite.md`
  id: DW-57
  summary: >-
    Two records outside this story's scope now describe a route that no longer exists: KV-5's title
    still counts thirty-six elements where its own entry records twenty-eight, and
    `ops/asset-budget.md` carries `/projects` rows and a pending action naming `TorusKnotCanvas`.
  evidence: |-
    `ops/known-violations.md:66` and `:367` both title KV-5 "Thirty-six elements sit past the right
    edge at 360px", and the entry's own cells were re-measured to 28 by Story 2-14 on 2026-09-07.
    The title was left alone deliberately: that file's rule is that the index row is derived from
    the entry heading, so the two must move together, and a retitled entry breaks every inbound
    citation to it, including two in this file. Renaming it is a decision about the register rather
    than a consequence of this story.

    `ops/asset-budget.md` is untouched for the same reason and is a larger case. Its fingerprint
    tables, its per-route weight tables (`:418`, `:439`) and its 2026-09-07 finding at `:681` all
    name `/projects`, and Operator action 6 at `:710` says `EXPERIENCE.md` Rule 1 "still fails on
    `/work` and `/projects` (`TorusCanvas.tsx:8`, `TorusKnotCanvas.tsx:8`)". Half of that is now
    arithmetically closed: `TorusKnotCanvas.tsx` and `TorusKnot.tsx` were deleted with the route, so
    only `TorusCanvas.tsx` on `/work` and `app/providers.tsx` remain. Every one of those rows is a
    dated observation of a build, and the honest correction is a re-run of `ops/asset-budget.mjs`
    against the new tree with a dated paragraph, not an edit of the readings. Story 2-14's frozen
    boundaries name `ops/hit-target-floor.md`, `ops/known-violations.md`,
    `ops/anchor-token-adoption.md`, `ops/status-mark-axes.md` and `ops/rendered-output-harness.md`,
    and not this one.

    **Owner and trigger, per half, because they are two different closures.**

    KV-5's title is owned by **whichever of Stories 2-31 and 2-33 lands second**, and the trigger is
    the KV-5 retirement itself: the last of the 28 elements on `/work` going means setting `Status`
    to `Retired` and filling `Retired on`, which is an edit to the index row and the entry heading
    anyway. A count in a title that is about to become zero is not worth a commit of its own before
    then. If either story is descoped and KV-5 stays open past Epic 2, the title should be corrected
    to twenty-eight at that point rather than left, and that is the fallback trigger.

    `ops/asset-budget.md` is owned by **Story 2-29**, which redesigns `HomeLayout` and is the next
    story on the board whose subject is the hero the budget's route figures are dominated by; the
    trigger is that story's own re-run of `ops/asset-budget.mjs`, which it needs for its own before
    and after. Failing that, any story that reads a route weight out of that file and finds a
    `/projects` row is the trigger, because that reader is the person the staleness costs. The
    `TorusKnotCanvas` half of Operator action 6 is closed by arithmetic already and can be struck in
    the same pass without a measurement.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-14-projects-redirects-permanently-to-suite.md`
  id: DW-58
  summary: >-
    A chrome click on either `/projects` link lands on the top of the homepage, not on the Suite
    Directory. The App Router resolves the redirect client-side and drops the fragment, so the
    journey most visitors take does not get FR-2's in-page anchor that the redirect pays for.
  evidence: |-
    **Measured 2026-09-07** in `mcr.microsoft.com/playwright:v1.62.1-noble` at the pinned 360 x 800,
    by clicking `nav.navbar a[href='/projects']` from `/work` and the homepage panel's
    `a.nav-link[href='/projects']` from `/`, and reading the landed URL and the scroll position.
    Both give the same answer: `pathname` is `/`, `hash` is empty, `window.scrollY` is 0, and
    `#suite` sits at roughly **886px** in an 800px viewport, so the Directory is below the fold and
    nothing scrolled to it.

    The document-request path is different and is correct: `page.goto('/projects')` lands with
    `hash` `#suite` and the heading in view, which `tests/e2e/suite-directory.pw.ts` also asserts
    for `/#suite` directly. So this is a property of the client-side navigation, not of the
    redirect or of the browser, and the two readings are asserted side by side on the same build in
    `tests/e2e/projects-redirect.pw.ts` under "a chrome link reaches the homepage but not the
    Directory, which Story 2-15 owns". A `<Link>` navigation asks the router for the destination
    and the router applies its own resolution rather than handing the browser a `Location` to act
    on, and a fragment is only ever applied by a browser.

    Nothing is broken. NFR-2 is met, the destination is right, and the Directory is one scroll away.
    What is not met, **on this path only**, is FR-2's "lands on the Directory". Story 2-14 could not
    fix it: its frozen boundaries carry an Operator ruling of 2026-09-07 that
    `components/atoms/Navbar/Navbar.tsx:7` and
    `components/organisms/HomeLayout/HomeLayout.tsx:145` are Story 2-15's to change, and both are
    pinned by `Navbar.test.tsx:31-33` and `HomeLayout.test.tsx:104-107`.

    **Owner: Story 2-15**, which reshapes the nav to two destinations and already owns both call
    sites and the `chrome-nav` row in `ops/hit-target-floor.md`. **Trigger: that story's repoint.**
    The fix is to point both links at `/#suite` rather than at `/projects`, after which the click is
    a same-route fragment navigation and never touches the redirect at all. When it lands, the hash
    expectation in that case flips from `''` to `'#suite'`, which the case says in its own failure
    message, and this entry closes. This is the same journey DW-55 records paying an extra round
    trip for; DW-55 is the cost and this is the behaviour, and one repoint closes both.
  status: open

- source_spec: `_bmad-output/implementation-artifacts/spec-2-14-projects-redirects-permanently-to-suite.md`
  id: DW-59
  summary: >-
    The figures table in `ops/hit-target-floor.md` § Running it states three counts this story moved:
    53 measured elements, eighteen `status-mark` cases, and ten spec files at 89 tests. Every row is
    a dated historical reading, and that file forbids editing one.
  evidence: |-
    The rows, as they stand: "**Cases in this file** | 16 | Observed 2026-09-06, after Story 2-9
    added the A-4 independently-addressable case. The sweep now measures 53 elements rather than 43,
    on the same five surfaces"; and "**Whole `pnpm test:e2e`, ten spec files, 89 tests** | 2.0 min",
    dated 2026-09-06 "after Story 2-10 added `tests/e2e/status-mark.pw.ts` and its eighteen cases".

    All three moved on 2026-09-07. The sweep measures **36** elements on **four** surfaces;
    `status-mark.pw.ts` lost its `/projects` truncation case and runs **seventeen**; and the suite
    is **fourteen** spec files at **186** tests, `tests/e2e/projects-redirect.pw.ts` having been
    added along with the files and cases Stories 2-12 and 2-13 brought. Counted 2026-09-07 off the
    run reporter's own headline in the pinned container and off `tests/e2e/*.pw.ts` on disk.

    It is filed rather than corrected because § Maintaining this file says, in its own words, "When
    a figure is re-measured, add the new row with its own date and method and keep the old one" and
    "Deletion is not used here". Rewriting a 2026-09-06 row to carry 2026-09-07 numbers is exactly
    the back-dating that rule exists to prevent, and appending a fresh timing row is a measurement
    this story did not take: the walls quoted there are `docker run` and Playwright headline figures
    gathered deliberately, several readings apart, to separate cost from host load, and a single run
    taken while verifying a redirect is not that.

    **Owner: whichever story next times a full `pnpm test:e2e` run deliberately**, which the record
    itself frames as a periodic act rather than a per-story one. **Trigger: the next time that
    section is read for a cost comparison**, or the next story that adds a spec file, since the file
    count in the last row is the one figure a reader uses to tell a nine-file run from an eleven-file
    one. Adding the new row costs three readings of the same tree, per the method the section states.
  status: open
