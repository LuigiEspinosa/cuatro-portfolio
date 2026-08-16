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
