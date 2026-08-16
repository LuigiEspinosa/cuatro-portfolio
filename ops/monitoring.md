# Monitoring

The written record of how the Ecosystem learns that an application has stopped serving or
that a certificate renewal has failed silently. It names the service, what is probed, the
alert channel, the alerting policy, the certificate rules, the recurring cost, and whether
the AD-17a gate is open or closed.

This file is a record, not Registry data, and nothing here is a published contract surface.
It follows the pattern `ops/estate.md` sets: every value is marked as either a decision or
an observation, and the two are never presented as the same kind of fact (NFR-9).

Governing decision: **AD-17a, external uptime and certificate-age monitoring exists before
any automation is enabled anywhere in the Ecosystem.** AD-17a is explicit that this is a
blocking predecessor and never a parallel task. AD-18 adds the reason the probe must run
somewhere else: a job that checks the estate from inside the estate reports nothing when the
estate is what failed.

Realizes FR-31. Measured by SM-5 (at least 99% monthly externally measured uptime) and
SM-10 (minimum days remaining across all certificates, alerted on age). Where each of those
two figures is read and written down is set out under Alerting policy, because a metric with
no recorded reading is a target nobody is meeting or missing.

## Decisions

Recorded **2026-08-16** (ISO 8601 UTC).

| Decision | Value | Nature of the figure |
|---|---|---|
| Monitoring service | **UptimeRobot** | **Decided, not observed.** No account exists. See Pending Operator actions |
| Alert channel | **Telegram** | **Decided, not observed.** Not configured, and no test alert has arrived |
| Where the probe runs | External to the VPS, on UptimeRobot's own infrastructure | Decided, and required by AD-17a. See below |
| Recurring cost | **$0 per month** intended, on the free tier | **Decided intent, not an observed charge.** The Operator writes the actual figure here |
| Probe interval | **5 minutes**, every host, uniform | Decided. See Alerting policy for why this number and not "whatever the tier gives" |
| Certificate validity rule | Chain validates and issuer is the expected one, asserted per host | Decided. Rule 1, and independent of age. See The certificate rule |
| Certificate age rule | Age greater than two thirds of nominal lifetime, plus a 48 hour grace | Decided. Rule 2. See The certificate rule |
| Down threshold | 2 consecutive failed probes, so roughly 10 minutes to first alert | Decided. See Alerting policy |

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

### Account ownership and the alert path credentials

These fields exist so the alert path has a named owner and a known authentication mode rather
than living only in one person's browser session.

| Field | Value | Nature |
|---|---|---|
| UptimeRobot account owner | `luigi@cuatro.dev` | **Observed 2026-08-16.** The account exists and is registered under this address |
| Telegram integration mode | _unset, Operator fills_ | Native integration, or a webhook to a bot. The two fail differently and are debugged differently |
| Telegram destination | _unset, Operator fills_ | Which chat, channel or direct message the alert lands in |

**An account existing is not a monitor running.** The four probes, the Telegram contact, the
certificate threshold and the induced test alert are all still outstanding, so the gate below
stays shut. This row records ownership only.

If the integration is a webhook to a bot, the bot token is a credential. It lives in the
UptimeRobot console and **never in this repository**, in line with the spine's rule that
secrets live in GitHub Actions secrets and the on-box env file and never in the repository.
Recording that a token exists is not recording the token.

### The cost against NFR-4

**What the ceiling actually is.** NFR-4 states that all-in spend stays within $40 to $100 per
month. That is a band, and only its **upper bound of $100 per month is the ceiling**; the $40
is the bottom of the observed range and constrains nothing. The VPS is prepaid to 2028, so
only marginal spend counts against the figure. Everywhere this file says "against that
ceiling" it means against **$100 per month all-in**. The spine adds that any new recurring
charge for identity, monitoring or overflow hosting is a named decision recorded against that
ceiling and never an incidental subscription.

**The intended figure is $0 per month**, on UptimeRobot's free tier, which is why the service
was chosen at all. **Zero is recorded here as a named decision, not left out as an
omission.** A charge of nothing is still a charge the record has to account for, because the
alternative is a later reader who cannot tell whether the line was zero or whether nobody
looked.

**This figure is intent, not an observation.** No account exists, so no plan has been chosen
and no invoice has been seen.

**Three of this record's requirements are commonly paid features, not one.** The hedge is not
only about the certificate threshold:

1. A **configurable** certificate threshold, as opposed to a fixed vendor default.
2. The **keyword assertion** on the Anchor's health endpoint.
3. The **5 minute probe interval**, where free tiers often impose a longer one.

**The escalation branch.** If the cheapest tier that supports the rules in this file costs
money, the Operator records the real number here, against the $100 per month ceiling, before
configuring anything. **If that figure would take all-in spend past the ceiling, the Operator
stops and raises it rather than configuring the service and recording the overrun after the
fact.** Choosing between breaching NFR-4 and weakening a monitoring rule is a decision for
the human, not something a console session settles by picking the affordable tier. A monitor
that quietly became a paid subscription is precisely the outcome the spine's recurring-charge
rule exists to prevent.

## What is probed

The monitored set is **every live `cuatro.dev` subdomain**.

| Hostname | Probe target | Expected response | Nature |
|---|---|---|---|
| `cuatro.dev` | `/api/health` | HTTP 200, and the body contains the keyword `"status":"ok"` | **Decided from source, never observed.** See the caveat below |
| `cs-tracker.cuatro.dev` | `/` | HTTP 200 | **Decided.** Another repository, so no health endpoint is assumed |
| `tracker.cuatro.dev` | `/` | HTTP 200 | **Decided.** Another repository, same reason |
| `library.cuatro.dev` | `/` | HTTP 200 | **Decided.** Another repository, same reason |

**The keyword assertion is decided from source and has never been observed passing.** It is
read off `app/api/health/route.ts`, which returns `{"status":"ok", version, uptime}`. On the
only date this record checked, that endpoint returned **404**, so the string
`"status":"ok"` was never seen on the wire. Two consequences the Operator should hold:

- It is a **whitespace-sensitive substring match**. `"status":"ok"` matches the compact JSON
  that `NextResponse.json` emits today. Pretty-printing the response, reordering to put a
  space after the colon, or wrapping the payload in an envelope such as `{"data":{...}}` all
  break the assertion while leaving the endpoint healthy. That failure looks exactly like an
  outage.
- Changing the shape of that endpoint is therefore a monitoring change. If the response
  format changes, the assertion in the console changes in the same commit, and this row
  changes with it.

**Why the Anchor gets a keyword assertion.** A proxy that is up while the application behind
it is down can still answer 200. A keyword assertion catches that case where a bare status
check does not. The other three hostnames belong to repositories this story cannot change, so
their probe target is `/` and their assertion is the status code until those repositories
grow an equivalent endpoint.

#### One additional monitor on the Anchor, outside the probe table

The probe table above carries **exactly one row per monitored hostname**, which is the
canonical probe for that host. The Anchor carries **one further monitor** beyond its
canonical row, recorded here rather than as a second table row so that the one-row-per-host
reading of the table stays true.

| Host | Additional probe target | Expected response | Nature |
|---|---|---|---|
| `cuatro.dev` | `/` | HTTP 200, status code only | **Decided.** Supplementary to the canonical `/api/health` row above |

**Why.** The keyword argument cuts both ways, and this record would be inconsistent if it
stopped at the health endpoint. `/api/health` is a route handler that returns a static
object; it can answer perfectly while the rendered site in front of it fails to build, fails
to hydrate, or returns a 500 on every page a Visitor would actually open. A healthy health
check in front of a dead home page is the same class of error as a healthy proxy in front of
a dead app.

**The root probe deliberately asserts the status code only, with no keyword.** Asserting a
string from the rendered page would be a rendered-output check, and Playwright is not
installed in this repository yet: Story 1-10 establishes that harness, and until it lands no
acceptance criterion here may claim a rendered-output result. A status assertion on `/` is
what can be honestly asserted today. When Story 1-10 lands, whether to add a content
assertion here is worth revisiting.

### Redirects and which responses count as up

| Rule | Value |
|---|---|
| Follow redirects | **Yes**, and evaluate the assertion against the **final** response |
| Redirect limit | A small bound, and exhausting it counts as **down** (a redirect loop is an outage) |
| Counts as up | Final **200** only |
| Counts as down | Final 3xx that never resolves, any 4xx including 401 and 403, any 5xx, TLS failure, connection failure, timeout |

**A sign-in page counts as up.** Two of the three satellites served sign-in pages on the check
date, and that is the correct healthy response for those applications. The probe asserts that
the **host is serving its application**, not that a user is authenticated. What it must not do
is treat an authentication **error** as healthy, which is why 401 and 403 count as down while
a 200 that happens to render a login form does not.

`cuatro.dev` answered port 80 with a 301 to the HTTPS URL on the check date. Following
redirects is what makes that normal rather than an alert.

**The hostname list does not come from `docker/Caddyfile`.** That file routes `cuatro.dev` and
`analytics.cuatro.dev` only, while four hostnames resolve, so it is incomplete and is not
authoritative for this table. Story 1-7 enumerates the real routing table on the box. When it
lands, this table is checked against it.

### Why the monitored set is what it is

**"Every live `cuatro.dev` subdomain" is a documentation convention, not a mechanism.**
Nothing scans DNS, nothing reads the Registry, and nothing reconciles this table against
what is actually resolving. Adding a subdomain to the monitored set is a human action in a
web console, and it happens because somebody followed the rule below, not because the
sentence at the top of this section is enforced anywhere. Stating it as a self-maintaining
set would be exactly the kind of decided-state-as-observed-state claim NFR-9 forbids.

The rule, therefore, in two directions:

| Event | Operator action |
|---|---|
| A new `cuatro.dev` subdomain goes live | Add its monitor **in the same change that makes it live**, add its row to the probe table above, and confirm it inherits the certificate rules below |
| A host is retired, relocated, or moves off `cuatro.dev` | Delete or pause its monitor **and** strike its row here in the same change, so a permanently red monitor never becomes background noise |

A monitor left running against a retired host is not a harmless leftover: it is a false alarm
that trains the Operator to ignore the channel, which is the single failure mode this whole
file exists to prevent.

The exclusions, each named rather than left as a silence:

**`www.cuatro.dev` is not monitored, and is not currently ours to monitor.** On the check date
it resolved to a different provider than the apex and returned `DEPLOYMENT_NOT_FOUND` from an
external platform, so it is neither served by the VPS nor covered by the certificate rules
below. It is recorded here because it resolves, a Visitor could type it, and an undocumented
resolving hostname is worse than a documented excluded one. Whether it should redirect to the
apex, be monitored, or be withdrawn is an open question this record does not settle.

**`list-wheel` is not monitored today.** Its Status is `Live`, but it serves from GitHub Pages
rather than from a `cuatro.dev` subdomain, so it is neither our host nor our certificate and
there is nothing here for a certificate-age rule to watch. Story 2-25 relocates it to the VPS,
at which point the add rule above applies.

**`www.cuatro.dev` joins the monitored set when Story 1.21 lands.** On 2026-08-16 it was the
only proxied record in the zone and it returned `DEPLOYMENT_NOT_FOUND` from a different
provider, so there was nothing of ours to probe. The Operator decided on that date to keep both
`www.cuatro.dev` and `cuatro.dev`, with the apex canonical and `www` redirecting to it with a
301. That makes `www` a live `cuatro.dev` subdomain under the rule above, so it gets a probe row
asserting the redirect rather than a 200, and Story 1.21 adds it.

**`analytics.cuatro.dev` is on the box but is not in the probe table.** It is the self-hosted
Umami instance: infrastructure that supports the estate rather than an application the
Registry describes or a Visitor is sent to. It is recorded here with that reasoning rather
than dropped silently, so a later reader can see it was considered and can reverse the call
cheaply. Its certificate shares the fate of the Anchor's, and it is included in the
observed-state table below for that reason.

**`cuatro-finance` and `cs-tournament` are not monitored because it is not established that
they serve anything.** Their Statuses in `ops/estate.md` are the unresolved assumption text
`[ASSUMPTION: built, not deployed]` and `[ASSUMPTION: Live on Vercel]`, neither of which is a
valid Registry status and neither of which asserts a reachable hostname on `cuatro.dev`.
Story `2-4-confirm-the-assumed-statuses-hostnames-and-tech-values` resolves both. **If either
resolves to `Live` on a `cuatro.dev` subdomain, the add rule above applies and it joins the
probe table.** If either turns out to be live on external hosting, that is a placement
question for the Capacity Gate and not silently a monitoring gap.

**Applications with Status `In progress` are not monitored.** `StreamVault`, `MaiCoin`,
`poketracker-go` and `Mutuo` are early scaffolding, are not `Live`, and serve nothing to
probe. FR-31 scopes external monitoring to applications with Status `Live`.

### Observed state, 2026-08-16

Read only, gathered from a developer machine outside the VPS. HTTP status came from a plain
request to the probe target; the certificate fields came from a direct TLS handshake against
port 443 for each hostname.

**Scope of this check: the five hostnames below, on 2026-08-16 only.** Nothing here is
evidence about any other application, and nothing here is evidence about what a monitor would
report on any other day.

Age and days remaining are computed against **2026-08-16T00:00:00Z** and floored to whole
days. The threshold column applies the general formula from The certificate rule, so the
evidence can be tested against the rule rather than merely sitting beside it.

| Hostname | HTTP status | Certificate issuer | notBefore (UTC) | notAfter (UTC) | Nominal lifetime | Age | Days remaining | Alert threshold | Age rule firing |
|---|---|---|---|---|---|---|---|---|---|
| `cuatro.dev` | **404**, TLS validation **fails** | `CN=TRAEFIK DEFAULT CERT`, self signed | 2026-08-15T19:21:43Z | 2027-08-15T19:21:43Z | 365 days | 0 | 364 | 119 | **no** |
| `analytics.cuatro.dev` | not requested | `CN=TRAEFIK DEFAULT CERT`, self signed | 2026-08-15T19:21:43Z | 2027-08-15T19:21:43Z | 365 days | 0 | 364 | 119 | **no** |
| `cs-tracker.cuatro.dev` | 200 | `CN=YE1, O=Let's Encrypt, C=US` | 2026-07-29T03:20:20Z | 2026-10-27T03:20:19Z | 90 days | 17 | 72 | 28 | no |
| `tracker.cuatro.dev` | 200 | `CN=YE1, O=Let's Encrypt, C=US` | 2026-07-29T23:27:08Z | 2026-10-27T23:27:07Z | 90 days | 17 | 72 | 28 | no |
| `library.cuatro.dev` | 200 | `CN=YE2, O=Let's Encrypt, C=US` | 2026-07-30T05:15:02Z | 2026-10-28T05:15:01Z | 90 days | 16 | 73 | 28 | no |

`analytics.cuatro.dev` had its certificate read but **no HTTP request was made to it**, so its
status column is "not requested" rather than a result. It is not in the probe table and this
record makes no claim about whether Umami was serving.

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

**Obtaining that 404 required deliberately bypassing certificate validation.** The request was
made with certificate checking disabled, because a validating client cannot complete the
handshake at all. This matters for reading the row above: the 404 is evidence about what is
answering behind the bad certificate, and it is **not** evidence that any ordinary client
could reach it. A browser or a default HTTP library fails earlier, at the handshake, and
never sees a status code.

**This is an observation, not a diagnosis, and closing it is not this story's work.** No
change was made to the box, to DNS, or to any deployment by the session that wrote this file.
The observation is recorded because NFR-9 puts honesty above completeness and because it is
the single most useful piece of evidence this file can carry: it is exactly the class of
failure AD-17a exists to catch, it was found by hand rather than by a machine, and nobody was
notified.

**The estate does not serve from one address.** `cuatro.dev` and `analytics.cuatro.dev`
resolved to `95.216.143.251`, while `cs-tracker.cuatro.dev`, `tracker.cuatro.dev` and
`library.cuatro.dev` resolved to `177.7.52.248`. Both are observations from 2026-08-16 and
neither is a decision this record makes. **This record does not identify `177.7.52.248` as
anyone's infrastructure**: no reverse lookup, no provider attribution and no ownership check
was performed, and the address is written down only because it differs from the first one.
The practical consequence for monitoring is that "off the box" is not satisfied by probing
from the other address: a monitor must sit outside both, which UptimeRobot does.

## Alerting policy

Absent a policy, "the monitor alerts" is not a specification: it leaves open how fast a
failure is noticed, how often a passing blip wakes the Operator, and whether recovery is
ever communicated. FR-31 asks that the Operator learn of breakage **within hours**, which is
the number every value below is sized against.

| Setting | Value | Reasoning |
|---|---|---|
| Probe interval | **5 minutes**, uniform across hosts | See below |
| Failures before "down" | **2 consecutive** failed probes | One failed probe is a blip; two 5 minutes apart is a pattern |
| Time to first alert | Roughly **10 minutes** after the first failed probe | Well inside FR-31's "within hours", with room for a slow tier |
| Recovery notification | **Yes**, sent when a host returns to up | Without it the Operator cannot tell a fixed outage from an ignored one |
| Repeat alerts while down | At a **low** frequency, not per probe | A permanently failing host must not generate an alert every 5 minutes |

**Why the interval is pinned and not left to the tier.** SM-5 targets at least 99% monthly
externally measured uptime. That figure is arithmetic over samples, and its meaning depends
entirely on how often the samples are taken: 99% of 5 minute samples is roughly 7 hours of
downtime a month, while 99% of 30 minute samples is the same percentage computed from six
times fewer observations and can hide a short outage completely. Writing "whatever the chosen
tier gives" would leave SM-5 a number nobody can reproduce. **5 minutes is the decided
interval**, and if the chosen tier cannot provide it, the actual interval is written into this
table and the escalation branch under the cost section applies.

**Blip suppression is the two-failure rule and nothing more.** No other smoothing is applied,
because every additional layer of suppression is another way for a real outage to be quiet.
Two consecutive failures at a 5 minute interval is the whole mechanism.

### Where the two metrics are read and recorded

Both SM-5 and SM-10 are cited at the top of this file, and neither means anything until
somebody reads a number and writes it down. Neither reading has been taken.

| Metric | Source | Cadence | Recorded |
|---|---|---|---|
| SM-5, monthly uptime per host, target at least 99% | UptimeRobot's own uptime figure per monitor | Monthly | In the readings table below, one row per month per host |
| SM-10, minimum days remaining across all certificates | The lowest days-remaining value across every monitored host | Monthly, in the same sitting | In the readings table below, as one figure across the estate |

#### Readings

**No readings have been taken.** The table is created empty rather than omitted, so that an
absent reading is visibly absent instead of being indistinguishable from a metric nobody
ever defined.

| Month (ISO 8601) | Host | SM-5 uptime | SM-10 minimum days remaining | Taken by |
|---|---|---|---|---|
| _none recorded_ | | | | |

### Re-testing the alert path

**A configured alert path decays silently.** A revoked bot token, a deleted chat, a bot
removed from a channel, or an integration disconnected during an unrelated account change all
return the estate to exactly the silence this file exists to end, and none of them announces
itself. The status line below would go on reading `satisfied` throughout, which is the failure
mode of writing a gate down at all.

**Cadence: send a deliberate test alert every 3 months, and after any change to the account,
the bot, or the destination chat.** Record the date in the `Alert path last verified` field
beside the status line. A test that was not recorded did not happen.

### The watcher is itself a single point of failure

This file argues at length that monitoring must not share the failure modes of the thing it
monitors. Applied honestly, the same argument lands on the monitoring:

- **One recipient.** There is one Operator and one Telegram destination. If he loses access to
  that account or that device, there is no second recipient and no fallback channel.
- **One service.** UptimeRobot is a single external dependency. If it has an outage, changes
  its free tier, pauses the account for inactivity, or deactivates it, monitoring stops. Free
  tiers in particular are commonly paused or deactivated without a paid relationship to
  protect, and the notification about that would arrive on the same channel.
- **No watchdog.** Nothing checks that UptimeRobot is still checking. A monitoring service
  that silently stopped looks identical, from inside the estate, to an estate with nothing
  wrong.

**None of this is solved here, and no second channel is added by this story.** It is written
down because an unrecorded single point of failure is the one that surprises somebody. The
quarterly re-test above is the cheap partial mitigation: it converts "the alert path is
probably fine" into an observation on a known date. A genuine second channel, or a
dead-man's-switch that alerts when the monitor stops reporting, is a decision for a later
story rather than something to bolt on here.

## The certificate rule

**There are two rules, and they are independent.** The age rule catches a renewal that has
quietly stopped happening. The validity rule catches a certificate that is wrong right now.
Either one firing is an alert.

### Rule 1: certificate validity and expected issuer

**The monitor asserts, per host, that the certificate chain validates and that the issuer is
the expected one. A validation failure or an unexpected issuer alerts immediately,
regardless of age.**

The expected issuer today is **Let's Encrypt** for every host in the probe table.

**Age alone would have missed the failure this record observed, and it is worth being precise
about by how much.** On 2026-08-16 `cuatro.dev` was serving a self-signed
`CN=TRAEFIK DEFAULT CERT` with a 365 day nominal lifetime, 0 days old. Applying the age rule
to it gives an alert threshold of 119 days remaining, which is an age of 246 days, which
falls on **2027-04-18**. A monitor built only on the age rule would have been created that
day, seen a brand new certificate with 364 days remaining, reported everything healthy, and
stayed silent for eight months while no ordinary client could establish a connection at all.

The failure mode is general rather than particular to Traefik. **A fresh wrong certificate is
indistinguishable from a fresh right one on age**, and every mechanism that substitutes a
default or placeholder certificate does so with a long lifetime and a recent issue date:
proxy defaults, a fallback self-signed pair, a misrouted virtual host, an ACME client that
never obtained a real certificate in the first place. Age measures whether renewal is
**happening**. It says nothing about whether the thing being renewed is **correct**. Both
questions have to be asked, and this record asks the second one first because it is the one
that fires today.

An unexpected but valid issuer is also an alert rather than a silent pass. A certificate that
switched to a different public CA without anybody deciding to is either a configuration change
nobody recorded or something worse, and in both cases the Operator should hear about it.

#### Rule 1 changes when Story 1.3 turns on the Cloudflare proxy

**Decided 2026-08-16, not yet applied.** The Operator approved switching the four live
subdomains from DNS-only to proxied. On 2026-08-16 they were DNS-only, which is why the issuer
observed below is Let's Encrypt and why this record was written expecting it.

Once the proxy is on, **Cloudflare terminates TLS**, so an external probe sees Cloudflare's
edge certificate. Two consequences, both load-bearing:

1. **The expected issuer becomes Cloudflare for every proxied host.** Left unchanged, Rule 1
   alarms on all four the moment Story 1.3 lands. Story 1.3's acceptance now requires this
   file to be amended in the same change, never afterwards, and states that an alarm caused by
   that change is a defect in the story rather than a real outage.
2. **The origin certificate stops being visible from outside**, and it is the one that can
   silently fail to renew. Cloudflare's edge certificate is Cloudflare-managed and renews
   itself, so watching it proves very little. Story 1.3 must say how the origin is watched.

**Decided 2026-08-16: Cloudflare Origin CA, wildcard, behind Full (strict).** This is AD-26.
The origin presents one Cloudflare Origin CA certificate covering `cuatro.dev` and
`*.cuatro.dev`, issued for the longest term offered, and **no ACME client runs on the origin
for a proxied host**. The renewal cycle is removed rather than watched.

Two alternatives were considered and rejected, recorded so Story 1.3 does not re-derive them:

| Rejected | Why |
|---|---|
| Probe the origin directly, off-proxy | A DNS-only hostname pointing at the box serves the same applications outside the proxy, so crawlers reach them with no bot rules in front. That is a hole through AD-17b, which gates Epic 2, and closing it needs a hand-maintained IP allowlist against NFR-1 |
| Rely on the `526 Invalid SSL Certificate` response | It gives no warning window at all. A warning window is the entire reason this record alerts on age rather than expiry |

**What each rule watches after the switch.**

| Certificate | Who renews it | What watches it |
|---|---|---|
| Cloudflare edge, per proxied hostname | Cloudflare, automatically | Rule 1 asserts the expected issuer is Cloudflare. Rule 2's age threshold applies to whatever the probe observes |
| Origin, `cuatro.dev` plus `*.cuatro.dev` | Nobody. It does not renew | Its expiry date is written into the Decisions table when it is issued, with a dated review well before it. A long horizon is not a reason to leave it unwritten |

**The deprecation notice in the Cloudflare console is about something else.** Cloudflare
deprecated the legacy **Origin CA Key**, an API credential for issuing origin certificates
programmatically, and points you at account or user API tokens instead. **Origin CA
certificates are current and supported.** Story 1.3 issues one by hand from SSL/TLS, Origin
Server, so it uses neither the deprecated key nor a token. Noted here because the two names are
one word apart and the banner appears next to the feature this record depends on.

**The reversibility cost, stated plainly.** An Origin CA certificate is not publicly trusted, so
a host cannot leave the Cloudflare proxy until a publicly trusted certificate has been issued
for it first. Turning off the orange cloud on a host, even briefly to debug, breaks it
immediately. That failure is self-catching: Rule 1 asserts the expected issuer, so a host that
drops out of the proxy alarms rather than degrading quietly.

### Rule 2: certificate age

The age alert fires on certificate **age**, never on days to expiry.

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

**Source of the 90 to 64 to 45 schedule.** Three rows of the conversion table and both review
dates hang on this, so it is cited rather than assumed: Story 1.2's second acceptance block at
`_bmad-output/planning-artifacts/epics.md:1034-1040`, and the research digest at
`_bmad-output/planning-artifacts/research/technical-cuatro-ecosystem-architecture-2026-08-15/digests/D3a-r1-1.md:73`,
which also records that the `tlsserver` ACME profile switches to 45 day certificates on
2026-05-13 and that renewal volume roughly doubles across the transition. AD-22 carries the
schedule inside its fixed re-check scope, which is where it is re-verified rather than here.

### What terminates TLS today is not what the grace was sized against

The 48 hour grace below is reasoned from **Caddy's** renewal behaviour, because Caddy is what
this repository's committed configuration describes. **The observed-state section above
records something else answering.** On 2026-08-16 the Anchor's address presented a
certificate whose subject was `CN=TRAEFIK DEFAULT CERT`. This record does not diagnose why,
and does not claim to know what is terminating TLS on the box today.

Stated plainly, so it is not discovered later as a contradiction:

- **What was observed:** a self-signed certificate identifying itself as a Traefik default on
  the Anchor's address, and valid Let's Encrypt certificates on the three satellite hosts,
  whose issuing software was not identified at all.
- **What the grace assumes:** that whatever issues these certificates attempts renewal at
  **two thirds of nominal lifetime**. That is Caddy's convention, and the research digest
  records the same two thirds ratio in Let's Encrypt's own description of the transition
  (renewal moving from about day 60 of 90 to about day 30 of 45).
- **What is unconfirmed:** that the software actually running today renews on that ratio
  rather than on a fixed day count. **The assumption is unverified for whatever is serving
  now.**

**Why this matters and not merely tidiness.** If the issuer renews at a fixed number of days
instead of at a fraction, renewal moves relative to the alert as lifetimes shorten, and the
threshold either fires on every healthy renewal or stops firing before a broken one. Story
4.2 confirms the ACME renewal trigger of whatever the rebuild lands on, and the age threshold
should be treated as provisional until it does. Rule 1 above is not affected by any of this,
which is a further reason it is not optional.

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

### The general conversion formula

UptimeRobot alerts on **days remaining**, not on age, so the rule has to be converted before
it can be typed into a form. **The conversion is general in the nominal lifetime L, so that a
lifetime with no row in the table below still has an answer:**

```
remaining(L) = max(1, floor(L / 3 - 2))
age(L)       = L - remaining(L)
```

The `floor` rounds the remaining figure **down**, which moves the alert **later** rather than
earlier, so the rule errs toward a missed hour rather than toward a false alarm.

**Why the `max(1, ...)` floor exists.** Without it the formula silently disarms itself on
short certificates. `floor(L / 3 - 2)` reaches zero at **L = 9 days** and goes negative below
that, and a threshold of "alert when 0 or fewer days remain" is a threshold that fires only
once the certificate has already expired, which is to say never in any useful sense. Very
short lifetimes are not hypothetical: Let's Encrypt already offers a short-lived profile
measured in days, and the direction of the whole 90 to 64 to 45 schedule is downward. The
floor of 1 day keeps the alert armed at any lifetime. **It also means the rule degrades
honestly rather than silently**: at a six day lifetime, one day of warning is very little
warning, and that is a visible fact about the configuration rather than a threshold that
looks configured and does nothing.

Worked at the lifetime this record actually observed: `L = 365` gives
`remaining = max(1, floor(119.67)) = 119` and `age = 246`. That is the 2027-04-18 figure cited
under Rule 1, and it is why Rule 1 exists.

### Configured equivalents

| Nominal lifetime | Alert at age | Configured as days remaining | In force from |
|---|---|---|---|
| 90 days | 62 days | **28** | 2026-08-16 |
| 64 days | 45 days | **19** | see the overlap rule below |
| 45 days | 32 days | **13** | see the overlap rule below |

**The day counts in this table are derived values, not the rule.** They are a workaround for
what the tool accepts. If UptimeRobot offers no field that expresses this exactly, the
Operator configures the nearest value it does support and **writes the actually configured
number into this table beside the row**, so the gap between the rule and the configuration is
visible rather than assumed away.

### The two lifetime cliffs, and why they are not calendar switches

**A certificate issued before a cliff keeps its full original lifetime for its whole term.**
Let's Encrypt shortening new issuance from 90 days to 64 in February 2027 does not shorten a
90 day certificate issued in January 2027; that certificate lives out its 90 days and expires
in April. So for roughly one full lifetime after each cliff, **90 day and 64 day certificates
coexist in this estate**, and after the second cliff so do 64 and 45 day ones.

The consequence is that flipping the configured value on the calendar month is wrong in both
directions. Flip early and the threshold is too tight for certificates still on the longer
lifetime, producing alerts on healthy renewals. Flip late and the threshold is too loose for
certificates already on the shorter one, which is the silent-failure case.

**The rule for the transition:**

| Rule | Value |
|---|---|
| When the estate-wide configured value changes | When the **last** certificate on the longer lifetime has expired, not in the calendar month of the cliff |
| During the overlap | A **per-monitor** value is permitted and expected: hosts on the shorter lifetime take the shorter threshold, hosts still on the longer one keep the longer threshold |
| How to tell which is which | The nominal lifetime column of the observed-state table, re-gathered. `notAfter` minus `notBefore` is the nominal lifetime for that certificate, and it is the only figure the rule needs |

**Per-monitor values are the normal state during a transition, not a workaround.** The rule
is a fraction of *each certificate's own* lifetime, so certificates with different lifetimes
having different configured day counts is the rule working correctly rather than drift.

**The review is tied to AD-22**, which already carries the Let's Encrypt lifetime schedule
inside its fixed re-check scope. That is where these cliffs are picked up rather than
depending on this file being reread. Nothing outside AD-22's list reopens, and the rule
itself does not change at either cliff: only the derived day count does, and only as each
certificate rolls over.

## AD-17a status

```
AD-17a status: not-satisfied as of 2026-08-16
Alert path last verified: never
```

**Nothing this session did satisfies the gate.** Creating the account, adding the monitors,
connecting Telegram, setting the certificate rules and confirming the cost are all web
console actions, and none of them has happened. Writing them down is not doing them, and a
record that claimed otherwise would be worse than no record, because it would read as
evidence.

### The parse contract

Later stories read this line rather than re-deriving the gate, so its shape is a contract and
not a formatting choice.

- **Location:** inside the fenced block immediately under the `## AD-17a status` heading, and
  nowhere else in this file.
- **Form:** the literal token `AD-17a`, a space, `status:`, a space, then exactly one of
  `not-satisfied` or `satisfied`, then ` as of ` and an ISO 8601 UTC date as `YYYY-MM-DD`.
- **Safe match pattern:** `^AD-17a[ ]status:[ ](not-satisfied|satisfied)[ ]as[ ]of[ ](\d{4}-\d{2}-\d{2})$`

The character classes in that pattern are deliberate: they let the contract be written down
here without the pattern text itself matching as a second occurrence of the line.

**The trap, which will otherwise be walked into.** `not-satisfied` **contains** the substring
`satisfied`. A consumer that greps for the bare word, or for `status: satisfied` without
anchoring, matches the open gate and reads it as closed. That is a failure that opens
automation across the estate on the strength of a substring.

- **Match the whole line, anchored**, as the pattern above does.
- If a simple containment check is all that is available, test for **`not-satisfied` first**
  and treat its presence as the gate being open, rather than testing for the positive form.
- Never branch on the presence of the word `satisfied` alone.

**This file carries exactly one such line.** If a reader finds two, the file is broken and the
gate must be treated as open until a human resolves it.

### What closes the gate, and what does not

**The gate closes only on a deliberately induced test alert.** Not on the first alert that
happens to arrive.

This is not a hypothetical distinction here. **`cuatro.dev` is failing right now**, as the
observed-state section records. A monitor created against it today will alert immediately and
keep alerting until the host is fixed. That alert proves the probe works; it does **not**
prove the alert path was deliberately exercised end to end, and treating it as the test alert
would close the gate on an accident. The Operator must send an explicit test notification, or
point a throwaway monitor at a deliberately failing URL and watch it arrive, and record that
date in the `Alert path last verified` field.

**What to do about the `cuatro.dev` monitor while the host is broken: configure it anyway. Do
not suppress it, do not pause it, and do not leave it until the host is fixed.** The reasoning:

- A monitor that is never created cannot tell the Operator when the host **recovers**, and
  recovery is the event most likely to go unnoticed.
- Suppressing a known outage is how a known outage becomes a forgotten one. The whole argument
  of this file is that the estate's failure mode is silence.
- The alert is interpretable rather than mysterious, because the outage is written down in
  the observed-state section above with the date it was seen.

The cost is a period of known-red noise on one monitor, and the repeat-alert setting in the
alerting policy is what keeps that from becoming a message every 5 minutes. That is the right
trade against losing the recovery signal.

### What the line reads when the work is partly done

**Anything short of all five Operator actions completed, plus a test alert that has actually
arrived, reads `not-satisfied`.** There is no partial value and no intermediate state.

Two examples, because the temptation runs the other way:

- Account created, all monitors added, Telegram connected, but no test alert sent: the line
  reads `not-satisfied`. A configured channel that silently drops messages is indistinguishable
  from a working one until the first real failure, which is the moment it must not be
  discovered.
- Everything done and a test alert received, but the certificate rules not yet configured:
  the line reads `not-satisfied`. AD-17a names uptime **and** certificate-age monitoring, and
  half the gate is not the gate.

The line is a gate, not a progress bar. Anything else and three later stories enable
automation against a monitor that is partly imaginary.

### The deviation from Story 1.2's fourth acceptance block, stated rather than left to be found

`_bmad-output/planning-artifacts/epics.md:1051` requires that this record "states plainly that
AD-17a is now satisfied, so later stories can cite it rather than re-derive it."
**This record does the opposite: it states `not-satisfied`.** The deviation is named here so a
reader comparing the two documents finds the reasoning rather than a defect.

**Why honesty wins.** The acceptance block was written on the assumption that the story
includes the console work, so that by the time the record exists the monitor exists too. That
assumption does not hold: no account, no monitors and no alert channel exist, and none of
them can be created from a repository commit. Writing `satisfied` would satisfy the letter of
the acceptance block by asserting something false, and NFR-9 puts honesty above completeness
precisely for this case. The consequence of the false version is concrete rather than
philosophical: Stories 1-10, 1-11 and 1-14 would each enable automation against a monitor that
does not exist, and the first thing to break would break unwatched.

**What closes the deviation.** The Operator completes the five actions below, receives a
deliberately induced test alert, and flips this line. At that point the record satisfies
`epics.md:1051` in substance as well as in wording, and the deviation ceases to exist rather
than being waived.

### Which stories read this line

| Story or block | Why it reads the line |
|---|---|
| Story 1-10 | Installs Playwright and adds a CI job, which is enabling automation |
| Story 1-11 | Publishes `contracts/tokens.css` from a generator, with the CI work that follows |
| Story 1-14 | Adds the blocking contract-boundary CI check |
| Story 2-23 | Scheduled Registry verification, external to the box. `epics.md:2722` names Story 1.2 as a dependency |
| Epic 2, epic level | `epics.md:856` records Epic 2 as blocked by AD-17a, which gates the automation Story 2.8 adds |

**This list is indicative, not exhaustive.** It is accurate as of 2026-08-16 and it will go
stale, because a story added later can depend on this gate without anybody editing this table.

**The rule is the authority, not the list: every story that enables automation anywhere in
the Ecosystem reads this line first.** That is AD-17a's own wording. If a story adds a
scheduled job, a CI gate, an unattended deploy, a bot, or anything else that acts without a
human watching, it is governed by this line whether or not it appears above. A story that
cannot find itself in the table has not thereby been exempted.

## Pending Operator actions

Buying and configuring a monitor is web console work outside this repository. **No account
was created, no plan was bought and no monitor was configured by the session that wrote this
file.** The six actions below are outstanding.

| # | Action | Constraint | Completed (ISO 8601 UTC) |
|---|---|---|---|
| 1 | Create the UptimeRobot account and add an HTTPS monitor for each row of the probe table, plus the one additional `cuatro.dev` root monitor recorded beneath it | Use the probe targets and the redirect rules above, including the `"status":"ok"` keyword assertion on `/api/health`. Configure both `cuatro.dev` monitors even though the host is currently failing | _not done_ |
| 2 | Enable certificate chain validation and the expected-issuer assertion per host | Rule 1. This is separate from the age threshold and must not be skipped because the age alert is configured | _not done_ |
| 3 | Configure the TLS certificate age alert | Use the nearest value UptimeRobot supports for the recorded rule, and write the actually configured value into the conversion table beside its row | _not done_ |
| 4 | Add Telegram as an alert contact and send a **deliberately induced** test alert | Record here whether it went through a native integration or a webhook to a bot, since the two fail differently. Fill the ownership table. A real outage alert is not a test alert | _not done_ |
| 5 | Record the actual recurring cost | Write it against the $100 per month ceiling as a named decision, including if it is zero. If the required tier would breach the ceiling, stop and raise it rather than configuring | _not done_ |
| 6 | Flip the status line above to the positive form with the ISO 8601 UTC date, and set `Alert path last verified` | Only once actions 1 to 5 are done **and** a deliberately induced test alert has arrived. Anything less reads `not-satisfied` | _not done_ |

**Maintaining this file.** When an Operator action is performed, **strike its row by replacing
the `_not done_` cell with the ISO 8601 UTC completion date, and leave the row in place.**
Deletion is not used, because the history of when each part of the alert path was established
is exactly what a later reader needs when the path stops working. "Struck" here means
completed and dated, never removed.

Then re-gather the observed-state table and re-date it. A pending row carrying a stale date is
not evidence that the action is still outstanding, only evidence that nobody has looked since
that date. The same rule applies to the observed-state section as a whole: it records what one
check saw on one day, and it is worth exactly that until it is gathered again.

**On re-gathering: a host that cannot be reached is written down as "not checked", never
omitted.** An absent row is indistinguishable from a host nobody thought about, while an
explicit "not checked" records that somebody looked and failed. The same applies to any
individual field: a certificate that could not be read is "not checked" rather than a blank
cell or a value carried forward from the previous gathering. Carrying a stale value forward
into a freshly dated table is the one thing that would make this section actively misleading.
