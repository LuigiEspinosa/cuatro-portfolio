# Monitoring

The written record of how the Ecosystem learns that an application has stopped serving or
that a certificate renewal has failed silently. It names the service, what is probed, the
alert channel, the certificate rule, the recurring cost, and whether the AD-17a gate is
open or closed.

This file is a record, not Registry data, and nothing here is a published contract surface.
It follows the pattern `ops/estate.md` sets: every value is marked as either a decision or
an observation, and the two are never presented as the same kind of fact (NFR-9).

Governing decision: **AD-17a, external uptime and certificate-age monitoring exists before
any automation is enabled anywhere in the Ecosystem.** AD-17a is explicit that this is a
blocking predecessor and never a parallel task. AD-18 adds the reason the probe must run
somewhere else: a job that checks the estate from inside the estate reports nothing when the
estate is what failed.

Realizes FR-31. Measured by SM-5 (at least 99% monthly externally measured uptime) and
SM-10 (minimum days remaining across all certificates, alerted on age).

## Decisions

Recorded **2026-08-16** (ISO 8601 UTC).

| Decision | Value | Nature of the figure |
|---|---|---|
| Monitoring service | **UptimeRobot** | **Decided, not observed.** No account exists. See Pending Operator actions |
| Alert channel | **Telegram** | **Decided, not observed.** Not configured, and no test alert has arrived |
| Where the probe runs | External to the VPS, on UptimeRobot's own infrastructure | Decided, and required by AD-17a. See below |
| Recurring cost | **$0 per month** intended, on the free tier | **Decided intent, not an observed charge.** The Operator writes the actual figure here |
| Certificate rule | Age greater than two thirds of nominal lifetime, plus a 48 hour grace | Decided. See The certificate rule |
| Probe interval | Whatever the chosen tier gives, provided a failure is noticed within hours | Decided loosely on purpose. FR-31 asks for hours, not minutes |

**Why the service must run off the box.** AD-17a and AD-18 both require it, and the reason is
mechanical rather than stylistic. A monitoring agent, exporter, healthcheck or cron job
installed on the VPS shares the VPS's failure modes: if the host is unreachable, out of
memory, or has lost its network, the thing that was supposed to notice is exactly as dead as
the thing it was watching, and the Operator's evidence is silence. UptimeRobot probes from
its own infrastructure, so a whole-box failure still produces a notification. Nothing in this
story installs anything on the box.

**Why the alert channel is Telegram.** A probe failure that lands somewhere the Operator does
not read is the same as no probe at all. Telegram is the channel he actually reads. That is
the whole argument, and it is why the gate below stays open until a test alert has
demonstrably arrived rather than until the channel has been configured.

### The cost against NFR-4

NFR-4 caps all-in spend at $40 to $100 per month, and the VPS is prepaid to 2028 so only
marginal spend counts against the ceiling. The spine adds that any new recurring charge for
identity, monitoring or overflow hosting is a named decision recorded against that ceiling
and never an incidental subscription.

**The intended figure is $0 per month**, on UptimeRobot's free tier, which is why the service
was chosen at all. **Zero is recorded here as a named decision, not left out as an
omission.** A charge of nothing is still a charge the record has to account for, because the
alternative is a later reader who cannot tell whether the line was zero or whether nobody
looked.

**This figure is intent, not an observation.** No account exists, so no plan has been chosen
and no invoice has been seen. If the tier that actually supports the certificate rule below
turns out to cost money, the Operator records the real number here, against this ceiling,
before configuring it. A monitor that quietly became a paid subscription is precisely the
outcome the spine's recurring-charge rule exists to prevent.

## What is probed

The monitored set is **every live `cuatro.dev` subdomain**. Stating it that way rather than
as a fixed list of four is deliberate: it makes a new subdomain a monitored host by
consequence rather than by somebody remembering.

Today that set is the four hostnames named in Story 1.2's acceptance.

| Hostname | Probe target | Expected response | Nature |
|---|---|---|---|
| `cuatro.dev` | `/api/health` | HTTP 200, and the body contains the keyword `"status":"ok"` | **Decided.** `app/api/health/route.ts` returns that shape |
| `cs-tracker.cuatro.dev` | `/` | HTTP 200 | **Decided.** Another repository, so no health endpoint is assumed |
| `tracker.cuatro.dev` | `/` | HTTP 200 | **Decided.** Another repository, same reason |
| `library.cuatro.dev` | `/` | HTTP 200 | **Decided.** Another repository, same reason |

**Why the Anchor gets a keyword assertion and the others do not.** `GET /api/health` in this
repository returns `{"status":"ok", version, uptime}`, so the monitor can assert on body
content instead of on a status code alone. That distinction matters: a proxy that is up while
the application behind it is down can still answer 200, and a keyword assertion catches that
case where a bare status check does not. The other three hostnames belong to repositories
this story cannot change, so their probe target is `/` and their assertion is the status code
until those repositories grow an equivalent endpoint.

**The hostname list does not come from `docker/Caddyfile`.** That file routes `cuatro.dev` and
`analytics.cuatro.dev` only, while four hostnames resolve, so it is incomplete and is not
authoritative for this table. Story 1-7 enumerates the real routing table on the box. When it
lands, this table is checked against it.

### Why the monitored set is what it is

**`list-wheel` is not monitored today.** Its Status is `Live`, but it serves from GitHub Pages
rather than from a `cuatro.dev` subdomain, so it is neither our host nor our certificate and
there is nothing here for a certificate-age rule to watch. Story 2-25 relocates it to the VPS.
Because the set above is stated as every live `cuatro.dev` subdomain, that relocation makes
`list-wheel` monitored as a consequence of the move, rather than as a gap somebody has to
notice afterwards.

**`analytics.cuatro.dev` is on the box but is not in the table.** It is the self-hosted Umami
instance: infrastructure that supports the estate rather than an application the Registry
describes or a Visitor is sent to. It is recorded here with that reasoning rather than
dropped silently, so a later reader can see it was considered and can reverse the call
cheaply. Its certificate shares the fate of the Anchor's, so the observation below covers it.

**Applications with Status `In progress` are not monitored.** `StreamVault`, `MaiCoin`,
`poketracker-go` and `Mutuo` are early scaffolding, are not `Live`, and serve nothing to
probe. FR-31 scopes external monitoring to applications with Status `Live`.

### Observed state, 2026-08-16

Read only, gathered from a developer machine outside the VPS. HTTP status came from a plain
request to the probe target; the certificate fields came from a direct TLS handshake against
port 443 for each hostname.

**Scope of this check: the four hostnames below, plus `analytics.cuatro.dev`, on 2026-08-16
only.** Nothing here is evidence about any other application, and nothing here is evidence
about what a monitor would report on any other day.

| Hostname | Probe target | HTTP status | Certificate issuer | notBefore (UTC) | notAfter (UTC) | Nominal lifetime |
|---|---|---|---|---|---|---|
| `cuatro.dev` | `/api/health` | **404**, and TLS validation **fails** | `CN=TRAEFIK DEFAULT CERT`, self signed | 2026-08-15T19:21:43Z | 2027-08-15T19:21:43Z | 365 days |
| `cs-tracker.cuatro.dev` | `/` | 200 | `CN=YE1, O=Let's Encrypt, C=US` | 2026-07-29T03:20:20Z | 2026-10-27T03:20:19Z | 90 days |
| `tracker.cuatro.dev` | `/` | 200 | `CN=YE1, O=Let's Encrypt, C=US` | 2026-07-29T23:27:08Z | 2026-10-27T23:27:07Z | 90 days |
| `library.cuatro.dev` | `/` | 200 | `CN=YE2, O=Let's Encrypt, C=US` | 2026-07-30T05:15:02Z | 2026-10-28T05:15:01Z | 90 days |

The three satellite hostnames each returned their own application: a sign-in page behind
nginx for `cs-tracker.cuatro.dev`, `Cuatro Tracker` for `tracker.cuatro.dev`, and a library
sign-in page for `library.cuatro.dev`. Their certificates are Let's Encrypt with the 90 day
nominal lifetime the conversion table below assumes.

**`cuatro.dev` did not serve the Anchor when this check ran, and this record does not say
why.** What was observed, and only what was observed: the hostname resolved to
`95.216.143.251` through the local resolver and again through `1.1.1.1`; port 80 answered
with a 301 to the HTTPS URL; port 443 completed a TLS handshake presenting a self-signed
certificate with subject `CN=TRAEFIK DEFAULT CERT` and a single subject alternative name
under `.traefik.default`, so certificate validation fails for any ordinary client; and behind
that certificate the request for `/api/health` returned `404 page not found`.
`analytics.cuatro.dev` resolved to the same address and presented the same self-signed
certificate. `www.cuatro.dev` resolved to a different provider entirely and returned
`DEPLOYMENT_NOT_FOUND`.

**This is an observation, not a diagnosis, and closing it is not this story's work.** No
change was made to the box, to DNS, or to any deployment by the session that wrote this file.
The observation is recorded because NFR-9 puts honesty above completeness and because it is
the single most useful piece of evidence this file can carry: it is exactly the class of
failure AD-17a exists to catch, it was found by hand rather than by a machine, and nobody was
notified. That is the argument for the gate below, made concrete.

**The estate does not serve from one address.** `cuatro.dev` and `analytics.cuatro.dev`
resolved to `95.216.143.251`, while `cs-tracker.cuatro.dev`, `tracker.cuatro.dev` and
`library.cuatro.dev` resolved to `177.7.52.248`. Both figures are observations from
2026-08-16 and neither is a decision this record makes. The practical consequence for
monitoring is that "off the box" is not satisfied by probing from the other address: a
monitor must sit outside both, which UptimeRobot does.

## The certificate rule

The alert fires on certificate **age**, never on days to expiry.

**The rule:** alert when a certificate's age is greater than **two thirds of its own nominal
lifetime, plus a 48 hour grace**.

The fraction is the rule. Every day count in this section is derived from it.

**Why age and not expiry.** Let's Encrypt lifetimes fall from 90 days to 64 in February 2027
and to 45 in February 2028. A threshold written as a fixed number of days remaining does not
move when the lifetime does, so the same number that was a comfortable margin at 90 days is
most of the certificate at 45. The window between a renewal that broke silently and a site
that stops loading halves twice in two years, and a fixed day count spends that reduction out
of the safety margin without anybody deciding to. A fraction of the certificate's own
lifetime narrows the window automatically at each cliff instead, which is the behaviour
AD-17a asks for.

### Why the threshold is not exactly two thirds

Caddy renews when less than one third of a certificate's lifetime remains. Two thirds of
nominal lifetime is therefore the instant renewal is **attempted**, not a point by which it
should have **completed**. An alert placed exactly there fires on every healthy renewal, and
an alert that fires on healthy behaviour is an alert the Operator learns to ignore.

The 48 hour grace is a retry allowance for a renewal already in progress. It is deliberately
**not** the safety margin, which is why it does not scale with lifetime while the fraction
does. At 45 day certificates two days is still ample room for an ACME client to retry, and
holding it flat keeps the shrinking part of the rule in the part of the rule that is supposed
to shrink.

### Configured equivalents

UptimeRobot alerts on **days remaining**, not on age, so the rule has to be converted before
it can be typed into a form. The conversion is
`remaining = lifetime / 3 - 2`, rounded **down** so the alert fires later rather than earlier,
and `age = lifetime - remaining`.

| Nominal lifetime | Alert at age | Configured as days remaining | In force from |
|---|---|---|---|
| 90 days | 62 days | **28** | today |
| 64 days | 45 days | **19** | February 2027 |
| 45 days | 32 days | **13** | February 2028 |

**The day counts in this table are derived values, not the rule.** They are a workaround for
what the tool accepts. If UptimeRobot offers no field that expresses this exactly, the
Operator configures the nearest value it does support and **writes the actually configured
number into this table beside the row**, so the gap between the rule and the configuration is
visible rather than assumed away.

### The two dates the configured value must change

This section is the one part of the record that goes stale on a calendar rather than on an
event, so the dates are written down instead of left to be noticed.

| Date | Change | Configured value moves |
|---|---|---|
| February 2027 | Let's Encrypt nominal lifetime drops from 90 days to 64 | 28 days remaining becomes 19 |
| February 2028 | Nominal lifetime drops from 64 days to 45 | 19 days remaining becomes 13 |

**The review is tied to AD-22**, which already carries the Let's Encrypt lifetime schedule
inside its fixed re-check scope. That is where these two dates are picked up rather than
depending on this file being reread. Nothing outside AD-22's list reopens, and the rule
itself does not change on either date: only the derived day count does.

## AD-17a status

`AD-17a status: not-satisfied` as of **2026-08-16** (ISO 8601 UTC).

**Nothing this session did satisfies the gate.** Creating the account, adding the four
monitors, connecting Telegram and setting the certificate threshold are all web console
actions, and none of them has happened. Writing them down is not doing them, and a record
that claimed otherwise would be worse than no record, because it would read as evidence.

**The gate is satisfied only when a test alert has actually arrived on Telegram**, not when
the channel has been configured. A configured channel that silently drops messages looks
identical to a working one until the first real failure, which is the moment it must not be
discovered.

**These stories read this line:**

| Story | Why it reads the line |
|---|---|
| Story 1-10 | Installs Playwright and adds a CI job, which is enabling automation |
| Story 1-11 | Publishes `contracts/tokens.css` from a generator, with the CI work that follows |
| Story 1-14 | Adds the blocking contract-boundary CI check |

Each of the three cites AD-17a rather than re-deriving the gate, and each is entitled to
treat this single line as the answer. That is the whole reason the line exists in this
shape: one line, one value, one date. If this file asserted the gate closed on the strength
of a document, three later stories would enable automation against a monitor that does not
exist, and the failure would not surface until something broke with nothing watching.

## Pending Operator actions

Buying and configuring a monitor is web console work outside this repository. **No account
was created, no plan was bought and no monitor was configured by the session that wrote this
file.** The five actions below are outstanding.

| Action | Constraint |
|---|---|
| Create the UptimeRobot account and add an HTTPS monitor for each of `cuatro.dev`, `cs-tracker.cuatro.dev`, `tracker.cuatro.dev` and `library.cuatro.dev` | Use the probe targets in the table above, including the `"status":"ok"` keyword assertion for `cuatro.dev` |
| Add Telegram as an alert contact and send a test alert | Record here whether it went through a native integration or a webhook to a bot, since the two fail differently |
| Configure the TLS certificate alert | Use the nearest value UptimeRobot supports for the recorded rule, and write the actually configured value into the conversion table beside its row |
| Record the actual recurring cost | Write it against the NFR-4 ceiling as a named decision, including if it is zero |
| Flip the status line above to `satisfied` with the ISO 8601 UTC date | Only once a test alert has actually arrived on Telegram. Stories 1-10, 1-11 and 1-14 read that line |

**Maintaining this file.** When an Operator action is performed, strike its row from the table
above, then re-gather the observed-state table and re-date it. A pending row carrying a stale
date is not evidence that the action is still outstanding, only evidence that nobody has
looked since that date. The same rule applies to the observed-state section as a whole: it
records what one check saw on one day, and it is worth exactly that until it is gathered
again.
