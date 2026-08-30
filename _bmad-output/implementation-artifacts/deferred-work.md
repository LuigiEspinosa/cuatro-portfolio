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
location: components/molecules/ProjectCard/ProjectCard.scss:66
source_spec: `spec-1-18-anchor-migration-step-2-alias-the-old-names-onto-the-token-r.md`
severity: medium
reason: ProjectCard.scss:66 and WorkItem.scss:144 set background: var(--accent-dim) on a tech chip and color: var(--light-gray-color) on its label. Before this commit --accent-dim was rgba(91, 33, 182, 0.22), so the chip barely lifted the #0a000f ground and the label kept most of its 10.14:1. Both roles the mapping assigns are opaque. Measured 2026-08-26: the two after ratios already rasterised against #0a000f in ops/anchor-token-adoption.md give the label-on-fill ratio as their quotient, 0.3630 / 0.1418 = 2.56:1; the before figure composites rgba(91, 33, 182, 0.22) over #0a000f to rgb(28, 7, 52) against the pre-change #b4b4cc, giving 9.16:1. It is caused by this commit and every route to a fix is closed to it: the mapping is to be followed rather than invented, a chip-scoped third value would be an invented mapping, and giving the label its own colour means editing a component stylesheet beyond the four font-weight lines. The cheapest real fix is a chip fill of --token-bg-raised with the bord
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