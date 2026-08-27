# Sprint Change Proposal, 2026-08-16

Triggered during Story 1.2 (external uptime and certificate-age monitoring), which gathered
read-only evidence from outside the VPS and found the estate is not where the plan says it is.

Status: **proposed, awaiting approval.** Nothing in this document has been applied.

---

## 1. Issue summary

**The plan's single-VPS invariant is not true today, and the Anchor is down.**

PRD section 7 states the estate runs on one Hostinger VPS, 2 vCPU / 8 GB / 100 GB, Ubuntu
24.04 (`prd.md:647`). The architecture spine draws every application inside one
`Hostinger VPS` subgraph (`ARCHITECTURE-SPINE.md:307-353`) and scopes itself to "the
single-VPS platform they run on" (`ARCHITECTURE-SPINE.md:7`). Measured from outside on
2026-08-16, that is false in three ways at once.

**Finding 1: the estate spans two addresses.**

| Hostname | Resolves to | State |
|---|---|---|
| `cuatro.dev` | `95.216.143.251` | TLS validation fails, `/api/health` returns 404 |
| `analytics.cuatro.dev` | `95.216.143.251` | same self-signed certificate |
| `cs-tracker.cuatro.dev` | `177.7.52.248` | HTTP 200, valid Let's Encrypt, 90 day lifetime |
| `tracker.cuatro.dev` | `177.7.52.248` | HTTP 200, valid Let's Encrypt, 90 day lifetime |
| `library.cuatro.dev` | `177.7.52.248` | HTTP 200, valid Let's Encrypt, 90 day lifetime |
| `www.cuatro.dev` | Cloudflare proxy | returns `DEPLOYMENT_NOT_FOUND` |

The three satellites serve from the address the Operator identifies as the Hostinger VPS.
The Anchor and Umami serve from a different address, in a range published by Hetzner. The
Operator confirmed on 2026-08-16 that restoring `cuatro.dev` means completing its move onto
the Hostinger VPS, not repairing the current host.

**Finding 2: the Anchor is not serving, and nothing noticed.**

`95.216.143.251` presents a self-signed certificate, subject and issuer
`CN=TRAEFIK DEFAULT CERT`, notBefore 2026-08-15T19:21:43Z, sole SAN under `.traefik.default`.
Every ordinary client gets a TLS error. Behind it, `/api/health` returns `404 page not found`.
This violates NFR-2 (`prd.md:631`) on the one hostname FR-18 and SM-6 are measured on. It was
found by a build run gathering evidence for an unrelated story, which is the argument for
AD-17a made concrete.

Two further facts about that box: a Traefik is answering, while the committed
`docker-compose.yml` runs Caddy; and `.github/workflows/deploy.yml:11` targets an opaque
`secrets.SERVER_HOST`. **The repository's deployment configuration does not describe the
running system**, and no committed file records which box `SERVER_HOST` points at.

**Finding 3: no live subdomain is behind the Cloudflare proxy.**

The zone is on Cloudflare nameservers (`beau.ns.cloudflare.com`, `demi.ns.cloudflare.com`),
but all four live subdomains return origin addresses rather than Cloudflare anycast
addresses, so they are DNS-only records. `www.cuatro.dev` is the only proxied record in the
set, and it points at a deployment that no longer exists.

**How this happened.** PRD section 9 closed the open question "Is `digital-library` actually
on Hostinger?" on 2026-08-15 (`prd.md:809`), correctly. That single-application finding was
then generalised into a whole-estate statement at `prd.md:647` and into the spine's topology
diagram. `cuatro.dev` itself was never verified. This is a settled input that was wrong when
it was settled, which is a different failure from an input that went stale.

**Issue type:** misunderstanding of the original inputs, compounded by a technical fact
discovered during implementation. Not a strategic pivot, and not a failed approach.

---

## 2. Impact analysis

### 2.1 Epic impact

**Epic 1 (in progress) can still be completed, but not in its current order.**

- **Story 1.3, bot mitigation.** Its first Given reads "all four live subdomains sit behind
  Cloudflare" (`epics.md:1069`). They are not: they are DNS-only. Cloudflare bot rules apply
  to proxied traffic, so the story as written cannot be satisfied by adding rules. It first
  has to turn on the proxy for four records, which is a materially larger and riskier action
  than the story describes, and which changes TLS termination.
- **Story 1.5, capacity measurement week.** Its Given reads "the box runs four applications
  plus Caddy, Umami and Postgres" (`epics.md:1146`). No single box does. Measuring the
  Hostinger box today omits the Hub, the largest consumer; measuring both and summing them
  measures a topology that is about to stop existing. Either way the threshold Story 1.6
  writes would describe hardware the estate is leaving.
- **Story 1.6** inherits that, and with it AD-17c, which gates every new placement including
  `list-wheel` in Epic 2 and every id in Epic 4.
- **Story 1.7, routing enumeration.** Written for one box and Caddy (`epics.md:1221`,
  `epics.md:1231`). The real table spans two addresses and at least two proxies. Its value
  has gone up, not down: it is now the only way to know what the Hetzner box was serving
  before it is decommissioned.
- **Story 1.9.** Its Given asserts "the step name is factually wrong: the box is Hostinger,
  not Hetzner" (`epics.md:1314`). For the Anchor today that assertion is itself wrong, or at
  least unproven, since the Anchor answers from Hetzner space and `SERVER_HOST` is opaque.
- **Story 1.2 (just closed) and Story 1.3 conflict.** `ops/monitoring.md` requires the
  monitor to assert Let's Encrypt as the expected issuer. If Story 1.3 turns on the
  Cloudflare proxy, an external probe sees Cloudflare's edge certificate instead, and Rule 1
  fires a false alarm on every host the moment bot mitigation lands. Neither story mentions
  the other.

**Epic 2** is unaffected directly, but is gated by AD-17b (Story 1.3) and AD-17c (Story 1.6),
both of which move.

**Epic 3** is unaffected in substance. Story 3.4's acceptance corrects the deploy step name
"since the box is Hostinger" (`epics.md:3783`), which becomes true only after the Anchor
actually moves.

**Epic 4 is clarified rather than damaged.** Its own flagged ambiguity asks whether the
rebuild runs "on a temporary second box or in place" and assigns the decision to Story 4.1
(`epics.md:4022-4027`). Reality supplies an input: two boxes already exist. Story 4.6,
"Migrate `cuatro.dev`", overlaps with the restoration proposed below, and the two must be
distinguished rather than left to collide.

**No epic is invalidated, and no new epic is needed.**

### 2.2 Artifact conflicts

| Artifact | Location | Conflict |
|---|---|---|
| PRD | `prd.md:647` | States one Hostinger VPS as settled fact. The estate spans two hosts. |
| PRD | `prd.md:809` | Generalises a single-application finding to the estate. |
| PRD | `prd.md:633` | NFR-4 assumes one prepaid VPS, so only marginal spend counts. Two boxes are running and neither document says which is prepaid or what the second costs. |
| PRD | `prd.md:631` | NFR-2 is currently violated. |
| Architecture | `ARCHITECTURE-SPINE.md:307-353` | Topology diagram shows one subgraph containing every application. |
| Architecture | `ARCHITECTURE-SPINE.md:7`, `:49` | "single-VPS platform", "one VPS". |
| Architecture | `ARCHITECTURE-SPINE.md:208-212` | AD-22's fixed re-check scope covers versions and pricing but not the serving topology, so the refresh check could not have caught this. |
| Epics | `epics.md:1069`, `:1146`, `:1221`, `:1314` | Givens that are factually false, listed in 2.1. |
| Repo | `.github/workflows/deploy.yml:11` | Targets an opaque secret; step name unverifiable. |
| Repo | `docker-compose.yml` | Describes a Caddy stack; a Traefik is answering. |
| Repo | `AGENTS.md` | Says "one Hetzner box". Wrong against the plan and against reality. |

**UI/UX specifications: no impact.** Nothing in `DESIGN.md` or `RESTYLE-SPEC.md` depends on
hosting topology. Checklist item 3.3 is N/A.

### 2.3 Technical impact

Deployment, monitoring, and certificate issuance all change hands when the Anchor moves. The
Umami instance and its Postgres volume sit in the same compose stack as the Hub, so they move
together or the stack runs twice. Story 2.24's custom events and SM-1 through SM-3 depend on
that Umami data surviving.

---

## 3. Recommended approach

**Direct Adjustment, with two factual corrections to settled inputs.**

Rollback was evaluated and is not viable in any useful sense: the only completed stories, 1.1
and 1.2, are written records that are correct and that this change does not invalidate. Story
1.2's monitoring record already carries the evidence in its observed-state section.

An MVP review was evaluated and is not warranted. Nothing here makes the MVP unachievable or
requires scope reduction. What changes is sequencing and the accuracy of two inputs.

**Recommendation: add one story, resequence four, correct the PRD and the spine, and widen
AD-22 by one bounded item.**

- **Effort:** medium. One real infrastructure story, the rest are document edits.
- **Risk:** the restoration itself is the risk, and it is the risk that already exists.
- **Timeline:** Epic 1 lengthens by one story and its critical path shifts, because the
  measurement week cannot start until the estate is on one box.

---

## 4. Detailed change proposals

### 4.1 New story

**Story 1.21: Restore `cuatro.dev` by completing the move onto the Hostinger VPS**

Execution position is **first in Epic 1**, ahead of Story 1.3. The number is 21 because the
repository's own convention keeps story keys stable and does not reshuffle numbers, exactly
as recorded for Epic 8 in `sprint-status.yaml`. Epic number and story number are not
execution position.

```
As the Operator,
I want cuatro.dev serving the Anchor from the same VPS as the rest of the estate,
So that the flagship stops being down, and so that every later story that measures,
enumerates or deploys has one box to talk about.

Governing ADs: AD-20, AD-8. Realizes: none directly; restores NFR-2. Depends on: Story 1.7
(the Hetzner side of the routing enumeration, so nothing on the old box is lost).

Acceptance intent:
- cuatro.dev serves the Anchor over a publicly trusted certificate, and /api/health returns
  200 with "status":"ok" to an ordinary client performing full certificate validation.
- analytics.cuatro.dev moves in the same step or its deferral is recorded with a date. The
  two share one compose stack, so splitting them means running that stack twice. AD-20's
  rule that a migration step carries nothing else is read here as one deploy unit moving
  once, and the deviation is recorded rather than assumed.
- The Umami database survives the move, verified by querying it after cutover rather than by
  the container starting. SM-1 through SM-3 and Story 2.24 depend on that data.
- secrets.SERVER_HOST is confirmed to point at the box that actually serves, and the answer
  is recorded in ops/routing-inventory.md rather than left in a secret nobody can read.
- Nothing found on the old box is dropped without being recreated or recorded as
  deliberately dropped.
- ops/monitoring.md's observed-state section is re-gathered and re-dated after cutover.
```

### 4.2 Story amendments

**Story 1.3, bot mitigation.** Add a Given, and one acceptance block.

> OLD (`epics.md:1069`): **Given** all four live subdomains sit behind Cloudflare
>
> NEW: **Given** the zone is on Cloudflare nameservers but all four live subdomains resolve
> to origin addresses, so they are DNS-only records and no proxy is in front of them
>
> ADD a block: **Given** bot rules apply only to proxied traffic **When** the records are
> switched to proxied **Then** each of the four still serves a normal request from a normal
> browser, **And** the certificate an external client observes is recorded, because Story
> 1.2's Rule 1 asserts an expected issuer and proxying changes what a probe sees, **And**
> `ops/monitoring.md` is updated in the same change rather than left to fire a false alarm.

Rationale: the story cannot be satisfied as written, and satisfying it breaks the monitoring
record unless both are changed together.

**Story 1.5, capacity measurement week.** Amend the Given and add a dependency.

> OLD (`epics.md:1146`): **Given** the box runs four applications plus Caddy, Umami and Postgres
>
> NEW: **Given** the estate is consolidated onto one box by Story 1.21, and that box runs the
> applications, the proxy, Umami and Postgres
>
> OLD (`epics.md:1141-1142`): **Depends on:** Story 1.3, Story 1.4
>
> NEW: **Depends on:** Story 1.21 (so the week measures the box the estate is staying on),
> Story 1.3, Story 1.4

Rationale: a threshold measured on a box the estate is leaving is a number with no referent.

**Story 1.7, routing enumeration.** Widen from one box to the real topology.

> OLD (`epics.md:1224`): **Then** `ops/routing-inventory.md` records, for every hostname that
> resolves to the box
>
> NEW: **Then** `ops/routing-inventory.md` records, for every hostname in the zone and for
> every address it resolves to
>
> ADD: **And** the record names each serving address, what terminates TLS on it, and whether
> each DNS record is proxied or DNS-only **And** `www.cuatro.dev` is accounted for, since it
> is proxied and returns `DEPLOYMENT_NOT_FOUND`.

Also amend the Caddy-specific Given at `epics.md:1231` to say the committed compose file
describes a Caddy stack while a Traefik was observed answering on the Anchor's address, and
that the record states what is actually running on each box.

**Story 1.9, the tracked violation.** Correct an assertion that is no longer safe.

> OLD (`epics.md:1314`): **Given** the step name is factually wrong: the box is Hostinger,
> not Hetzner
>
> NEW: **Given** the step is named "Deploy to Hetzner" while `SERVER_HOST` is an opaque
> secret, and the Anchor currently answers from an address in Hetzner's published range
>
> **Then** the record states which box `SERVER_HOST` resolves to, rather than asserting a
> provider the repository cannot verify.

**Story 4.1.** Add to its acceptance intent: two serving addresses already exist as of
2026-08-16, so the temporary-second-box question has a partial answer in reality and Story
4.1 records the observed topology as its starting point rather than assuming one box.

**Story 4.6.** Add to its acceptance intent: the Anchor's host move happened in Story 1.21,
so 4.6 moves `cuatro.dev` onto Traefik on the rebuilt topology and does not repeat the host
migration.

### 4.3 PRD amendments

**Section 7, Capacity (`prd.md:647`).** Replace the opening sentence.

> OLD: **Capacity.** Hostinger VPS, 2 vCPU / 8 GB / 100 GB, Ubuntu 24.04.
>
> NEW: **Capacity.** The target platform is one Hostinger VPS, 2 vCPU / 8 GB / 100 GB, Ubuntu
> 24.04. **As of 2026-08-16 the estate spans two serving addresses** and is consolidated by
> Story 1.21. Every capacity statement below describes the target box, and no measurement
> taken before consolidation describes it.

**Section 9 (`prd.md:809`).** Append to the closed open question: the 2026-08-15 finding was
verified for `digital-library` only and was generalised to the estate without checking
`cuatro.dev`, which was still on the other host on 2026-08-16.

**NFR-4 (`prd.md:633`).** Append: while two boxes run, the second is a recurring charge
against the ceiling and is recorded as a named decision. Record which box is prepaid to 2028,
since the sunk-cost argument applies to exactly one of them.

**NFR-2 (`prd.md:631`).** Append a dated note that the requirement is in violation as of
2026-08-16 on `cuatro.dev`, closed by Story 1.21. NFR-9 puts honesty above completeness, and
a requirement silently in breach is the case that rule exists for.

### 4.4 Architecture amendments

**Deployment topology diagram (`ARCHITECTURE-SPINE.md:307-353`).** The diagram is the target
state and should stay, with a note above it recording that on 2026-08-16 the estate spanned
two addresses and that Story 1.21 makes the diagram true. Redrawing it to show two boxes
would enshrine a transitional state as architecture.

**AD-22 (`ARCHITECTURE-SPINE.md:212`).** Add one item to the fixed re-check scope.

> ADD: and the observed serving topology, meaning which addresses the estate's hostnames
> resolve to, what terminates TLS on each, and whether each record is proxied.

Rationale: AD-22 exists so a settled input is not acted on once it has gone stale. Its scope
covers versions and prices but not where the estate runs, which is why the refresh check
would not have caught this. One bounded item, consistent with the decision's own rule that
nothing outside the list reopens.

### 4.5 Repository

`AGENTS.md` says "deployed by Docker Compose to one Hetzner box", which is wrong against both
the plan and reality. It sits inside the `bmad:context` markers and is replaced on refresh, so
it is corrected by running `/bmad-project-context`, not by hand.

`sprint-status.yaml` gains `1-21-restore-cuatro-dev-onto-the-hostinger-vps: backlog` with a
comment recording that it executes first in Epic 1.

---

## 5. Implementation handoff

**Scope classification: Moderate.** No epic is invalidated, the MVP stands, and no
fundamental replan is required. Two edits inside it are architect-level and should be
reviewed as such: the PRD section 7 correction (4.3) and the AD-22 scope widening (4.4).

| Change | Owner | Deliverable |
|---|---|---|
| Story 1.21 authored and executed | Operator, then Developer | The Anchor serving from the Hostinger VPS |
| Story amendments 4.2 | Developer | Edited `epics.md` |
| PRD amendments 4.3 | Product Manager | Edited `prd.md` |
| Architecture amendments 4.4 | Solution Architect | Edited `ARCHITECTURE-SPINE.md` |
| `AGENTS.md` | Developer | `/bmad-project-context` refresh |
| `sprint-status.yaml` | Developer | New story entry |

**Success criteria.** `cuatro.dev` serves the Anchor over a valid certificate to a client
performing full validation. One box runs the estate. Story 1.5 measures that box. No document
states a single-VPS topology as present fact while two are running.

**Sequencing.** Story 1.7's Hetzner-side enumeration runs before Story 1.21, because nothing
on the old box should be lost. Story 1.3's proxy change and the `ops/monitoring.md` issuer
rule change together, in one step, or the monitor alarms falsely.

---

## Resolution, 2026-08-16

**Approved and applied.** All four open questions below were answered by the Operator on
2026-08-16 and are now pinned in the artifacts.

1. **The Hostinger VPS is the prepaid box**, at $0 marginal per month, paid a year at a time.
   Recorded in NFR-4 and PRD section 7. **One thing did not reconcile:** the PRD said "prepaid
   to 2028" while the Operator describes an annual prepayment, so the expiry date is flagged
   unconfirmed rather than assumed. An annually prepaid VPS with no recorded renewal date is a
   cost cliff nothing in the plan watches.
2. **The second address is retired** once the Anchor moves. In Story 1.21's acceptance, and
   Story 4.11's scope is reduced accordingly.
3. **Both `www.cuatro.dev` and `cuatro.dev` are kept**, apex canonical, `www` redirecting with
   a 301. In Story 1.21, and `www` joins the monitored set in `ops/monitoring.md`.
4. **The four subdomains are switched to proxied.** In Story 1.3, together with the
   `ops/monitoring.md` amendment that has to land in the same change.

**A fifth question opened by answer 4, and settled the same day: AD-26.** Proxying moves TLS
termination to Cloudflare, so an external probe stops being able to see the origin certificate,
which is the one that can silently fail to renew. Three options were weighed. Probing the origin
off-proxy was rejected because a DNS-only hostname pointing at the box serves the same
applications with no bot rules in front, which is a hole through AD-17b. Relying on the `526`
response was rejected because it gives no warning window, and a warning window is the reason
this estate alerts on age rather than expiry. **Adopted: one Cloudflare Origin CA certificate
covering `cuatro.dev` and `*.cuatro.dev`, behind Full (strict), with no ACME on the origin for
a proxied host.** The renewal cycle is removed rather than monitored. The accepted cost is that
a host cannot leave the proxy until a publicly trusted certificate has been issued for it
first. Recorded as AD-26 in the spine, with consequences applied to Stories 1.3 and 4.2.

---

## Open questions for the Operator

1. Which box is prepaid to 2028, and what does the other cost per month? NFR-4's arithmetic
   cannot be checked without this.
2. Is `95.216.143.251` in fact the Hetzner box, and is it to be decommissioned once the
   Anchor moves, or kept?
3. `www.cuatro.dev` is proxied and returns `DEPLOYMENT_NOT_FOUND` from a different provider.
   Retire the record, or point it at the Anchor?
4. Should the four live subdomains be switched to proxied as part of Story 1.3, accepting
   that Cloudflare then terminates TLS and the certificate-age rule watches the edge rather
   than the origin?
