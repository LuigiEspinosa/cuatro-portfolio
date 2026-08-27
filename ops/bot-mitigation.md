# Bot mitigation

The written record of what filters automated traffic in front of the Ecosystem, on which
hostnames, from which date, and what that filter does not cover. It names the rules, the
verification, the rejected alternatives, and the state of the AD-17b gate.

This file is a record, not Registry data, and nothing here is a published contract surface.
It follows the pattern `ops/estate.md`, `ops/monitoring.md` and `ops/routing-inventory.md`
set: every value is marked as either a decision or an observation, and the two are never
presented as the same kind of fact (NFR-9).

Governing decision: **AD-17b, bot mitigation is live on every live subdomain before the Suite
Directory ships.** AD-17b is a blocking predecessor of Epic 2 and never a parallel task. The
Suite Directory is a crawler amplifier by construction, and the one citable capacity figure in
the record (639,880 KB RSS, 103.3% CPU) was captured during a bot crawl, so the box's ceiling
has never been measured under normal conditions.

Related: **AD-26** puts TLS termination at Cloudflare, which is what makes any of this
possible. Rules apply only to proxied traffic.

## The estate is proxied, as of 2026-08-17

Before this story all six live hostnames were DNS-only and no filter sat in front of any of
them. **Observed by API on 2026-08-17:** nine records, all `proxied=false`.

| Change | Value | When (UTC) | Nature |
|---|---|---|---|
| Zone SSL mode | `full` to **`strict`** | 2026-08-17T17:12:16Z | **Applied.** Full (strict), never Flexible, per AD-26 |
| Automatic SSL/TLS | already `custom` | not changed | **Observed.** Not managing the mode, so it cannot drift it |
| Records switched to proxied | **nine records** | 2026-08-17T17:14Z to 17:26Z | **Applied**, one hostname at a time |
| WAF custom rules | four rules | **2026-08-17T17:27:46Z** | **Applied.** This is the effective date Story 1.5 attributes its measurement week to |

**Nine records, not six, and the difference matters.** `cs-tracker`, `tracker` and
`library` each carry an `AAAA` beside their `A`. An `AAAA` left DNS-only while its `A` is
proxied is an unfiltered path straight to the origin for any client with IPv6. `epics.md`
names four subdomains and predates Story 1.21, which added `www` and `analytics` to the box.

## The rules as they actually exist

**Observed 2026-08-17** by reading the ruleset back after applying it. Ruleset
`57602610aea04496a2f8ed13ec584b6c`, phase `http_request_firewall_custom`. Four of the Free
plan's five custom rules are used and one is deliberately held in reserve.

| # | Action | Applies to | What it does |
|---|---|---|---|
| 1 | **block** | all six hostnames | Blocks AI training and agent crawlers by user agent: `GPTBot`, `ChatGPT-User`, `ClaudeBot`, `Claude-User`, `CCBot`, `Bytespider`, `PerplexityBot`, `Perplexity-User`, `meta-externalagent`, `cohere-ai`, `Diffbot`, `ImagesiftBot`, `Omgilibot`, `YouBot`, `AI2Bot`, `Timpibot`, `Scrapy` |
| 2 | **skip** | every hostname except `analytics` | Skips the rules below when the user agent contains `UptimeRobot`. The estate's only error signal can never be challenged by the estate's own rules |
| 3 | **managed challenge** | the five application hostnames, `www` included | Challenges requests with an empty user agent that are not verified bots |
| 4 | **managed challenge** | `analytics.cuatro.dev` | Challenges everything except `/api/` and `/script.js`, so the dashboard is not browsable by automation while the tracker and collector stay open |

**Rule 2 exists because of AD-17a, not as a convenience.** This is the story that closes the
monitoring gate. A filter that can silently challenge the probes would close the gate and blind
it in the same change.

### Rule order is load-bearing, and the first ordering was wrong

**Found and corrected during this story's own review, 2026-08-17.** The skip rule was
originally first and matched `UptimeRobot` anywhere in the user agent on any hostname. A user
agent is client-supplied text, so **any crawler could have sent the string `UptimeRobot` and
skipped every rule below it**, including the AI-crawler block. The filter would have been
trivially defeated by nine characters, and every acceptance criterion would still have passed.

Two changes closed it, and both were verified by request:

| Test | Result |
|---|---|
| `GPTBot UptimeRobot` on `cuatro.dev` | **403.** The block now runs first, so the skip cannot reach past it |
| `UptimeRobot/2.0` on `analytics.cuatro.dev` | **403.** The skip is scoped off analytics, so a spoofed agent cannot reach the dashboard |
| Genuine probe on `cuatro.dev/api/health` and `/` | **200.** The error signal is still protected |

**The general lesson, which outlives this rule set: a skip rule keyed on client-supplied data
is an authentication bypass wearing a whitelist's clothing.** It should be ordered after
anything that must not be skippable, and scoped as narrowly as the thing it protects. The
residual risk is stated rather than hidden: an attacker can still avoid rules 3 and 4 on the
five application hostnames by claiming to be UptimeRobot, which buys them nothing that a normal
browser user agent would not also buy, since those rules challenge empty agents and the
analytics host only.

**Why `/api/` stays wholly exempt on analytics, rather than only `/api/send`.** Narrowing it
would be tighter on paper and would break the product: once the Operator passes the challenge
and loads the Umami dashboard, the page makes XHR calls to `/api/`, and **an XHR cannot solve a
managed challenge**. The dashboard would authenticate and then fail every request. Umami's own
token auth protects those endpoints, so the exposure is the unauthenticated surface only,
chiefly the login route. A per-hostname rate limit would be the right additional control and is
not expressible on this plan, as recorded below.

**Rule 4's two exemptions are load-bearing.** The Hub loads
`https://analytics.cuatro.dev/script.js` (`app/layout.tsx:61`) and the browser posts to
`/api/send`. Challenging either would stop analytics silently, with no error anywhere, which
is the failure SM-1 through SM-3 would discover months later. Both were verified serving after
the rules went live.

### Verified, not assumed

**Observed 2026-08-17T17:28Z**, immediately after the rules took effect. Each row is a request
actually made, not a property inferred from the configuration.

| Test | Result | What it proves |
|---|---|---|
| All six hostnames, normal browser user agent | 200, 301, 403, 302, 307, 302 | Unchanged from the pre-cutover baseline except `analytics`, see below |
| `cuatro.dev` as `GPTBot` | **403** | Rule 2 fires |
| `cuatro.dev` as `ClaudeBot` | **403** | Rule 2 is not a single-agent special case |
| `cuatro.dev` as `Googlebot` | **200** | Search crawlers are not blocked |
| `cuatro.dev/api/health` as `UptimeRobot` | **200** | Rule 1 protects the probes |
| `analytics.cuatro.dev/script.js` | **200** | The tracking script is exempt |
| `analytics.cuatro.dev/api/send` | 400 | Reached Umami and was rejected by Umami, so it was not filtered |
| All six UptimeRobot monitors after the rules | **UP** | No alarm was caused by this change |

**The `analytics` root returning 403 to `curl` is the managed challenge working, not a
defect.** A non-browser client cannot solve a challenge and receives 403. A real browser
should receive an interstitial and pass. **This has not been verified in a real browser from
this session**, because Playwright is not installed until Story 1-10 and no acceptance
criterion here may claim a rendered-output result. It is listed under Pending Operator actions
rather than asserted.

## The filter is bypassable, and this is the most important line in this file

**Observed 2026-08-17T17:31Z.** A request sent directly to the origin address with correct SNI
reaches the application with no filter in front of it:

| Request | Through Cloudflare | Direct to `177.7.52.248` |
|---|---|---|
| `GPTBot` on `cuatro.dev` | **403 blocked** | **200 served** |
| `library.cuatro.dev` | 302 | 302 |

The origin address is not secret. It was in public DNS until 2026-08-17, it appears in
Certificate Transparency logs, and it is written in this repository.

**`ufw` was configured and is not sufficient.** Rules allowing ports 80 and 443 only from
Cloudflare's 15 IPv4 and 7 IPv6 ranges were added on 2026-08-17, and the allow-from-anywhere
rules were removed. **The bypass survived**, because Docker publishes container ports by DNAT
and that traffic traverses the `DOCKER-USER` chain rather than `ufw`'s INPUT chain. The `ufw`
rules are correct for anything on the host that is not containerised, and they are kept for
that reason, but they do not protect a published container port. This is recorded because a
reader who sees the `ufw` rules would otherwise reasonably conclude the origin is closed.

**Closed 2026-08-17T18:14Z.** `RETURN` rules for the Cloudflare ranges in `DOCKER-USER` on
`eth0` for ports 80 and 443, followed by a catch-all `DROP`, applied by
`/usr/local/sbin/cf-origin-firewall.sh` and made persistent by `cf-origin-firewall.service`.
The unit is enabled, because the chain does not survive a reboot and an unpersisted firewall
rule is worse than none: it fails silently and leaves the record claiming a protection that
is gone.

**Verified closed, by the same test that found it open:**

| Test | Before | After |
|---|---|---|
| `cuatro.dev` direct to origin, correct SNI | 200 | **timeout, no response** |
| `library.cuatro.dev` direct to origin | 302 | **timeout, no response** |
| `GPTBot` direct to origin | 200 | **timeout, no response** |
| All six through Cloudflare | serving | **serving, unchanged** |

The timeout rather than a refusal is the `DROP` behaving correctly: the packet is dropped
without an RST, so a scanner learns nothing.

**IPv6 is covered by the same script and is not separately tested.** `iptables` and `ip6tables`
are different chains, so the script writes both: **observed on 2026-08-17**, the v4
`DOCKER-USER` chain holds 15 `RETURN` rules plus a `DROP`, and the v6 chain holds 7 plus a
`DROP`. What was **not** done is a direct-to-origin request against the box's IPv6 address
(`2a02:4780:75:9155::1`), because the executing session had no IPv6 egress, which is the same
limitation Story 1.21 recorded. **The rules are present and the path is unverified**, and those
are different claims. Closing it needs one `curl` from a vantage point with IPv6.

**Recovering from this firewall, written down because it will be needed under time pressure.**
A Cloudflare edge outage now takes all six hostnames down with no DNS-level escape: turning a
record back to DNS-only makes the origin present an untrusted Origin CA certificate, and the
firewall drops the traffic anyway. Recovery is over SSH on port 22, which is unaffected:

```
sudo systemctl disable --now cf-origin-firewall.service
sudo iptables -F DOCKER-USER && sudo ip6tables -F DOCKER-USER
```

**`systemctl stop` alone does not undo it.** The unit is `Type=oneshot` with
`RemainAfterExit=yes` and declares no `ExecStop`, so stopping it marks it inactive and leaves
every rule in place. The explicit flush is the part that matters.

**`ufw` is kept even though it did not close this.** It is correct for anything on the host
that is not a published container port, and removing it would leave the host less protected
than the containers. It is recorded here so a later reader does not mistake it for the control
that is doing the work.

## Bot Fight Mode was rejected, not overlooked

**Decided 2026-08-17.** Cloudflare's Bot Fight Mode is the obvious free-plan answer and it is
deliberately not used.

| Reason | Detail |
|---|---|
| It is zone-wide | No per-hostname scoping on Free, which fits AD-17b's "every live subdomain" wording worse than four rules that each name an `http.host` |
| It cannot be exempted | It does not run on the Ruleset Engine, so `skip`, `bypass` and `allow` do not reach it. Cloudflare's own guidance is that traffic it challenges can only be fixed by turning it off or upgrading |
| It can challenge the probes | Documented as challenging API and application traffic. This is the story that declares the monitoring gate closed, so a filter that can blind the monitors is the wrong trade |

**Super Bot Fight Mode**, which does run on the Ruleset Engine and would accept a skip, is
Pro plan and above. Not bought. Any purchase would be a named recurring charge against the
NFR-4 ceiling and is not justified by this story's requirement.

## The AI crawler policy

**Decided 2026-08-17 by the Operator: allow Search, block Training and Agent.** A portfolio
exists to be found, so search indexing stays. Training-corpus collection and autonomous agent
fetching do not.

**The native controls were not used, because they were not reachable.** Cloudflare's AI crawler
categories sit behind the Bot Management API, and the token available to this story returned
`Authentication error` on `/zones/{id}/bot_management`. The zone setting names
`ai_bots_protection` and the route `ai-crawl-control` do not exist on this account's API
surface. **Observed 2026-08-17.**

Rule 2's user-agent block list is the substitute and delivers the same policy today: the
blocked list contains no search crawler, and `Googlebot` was verified passing. The substitute
is weaker in one specific way, which is that it matches on a self-declared user agent and a
crawler that lies about its identity is not caught by it.

**This needs revisiting before 2026-09-15.** Cloudflare retires the single "Block AI bots"
toggle on that date and replaces it with independent Search, Agent and Training categories.
Adopting the native controls then would make this policy enforceable by category rather than
by name.

## Rate limiting is unavailable, stated rather than omitted

The Free plan allows one rate-limiting rule, counting by IP only, over a fixed 10 second
period, and its expression may reference **Path and Verified Bot only**. It cannot reference
the hostname. **A per-hostname rate limit is therefore not expressible on this plan**, so none
is configured. Recorded because a control that was considered and found unavailable reads
differently from one nobody thought of.

## No third-party measurement was introduced

**NFR-8 holds.** This story adds no third-party analytics, tag manager, session recorder or
tracking script to any application. The filter runs at the edge and injects nothing into any
page.

**One side effect was found and closed inside this story.** Proxying silently enabled
Cloudflare's Scrape Shield email obfuscation, which injected
`/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js` into the Anchor's HTML.
**Observed 2026-08-17T17:2xZ.** It is neither analytics nor a tracker, so it was not an NFR-8
violation, but it meant this story had changed what the Anchor serves, which AD-20 says a step
of this kind has no mandate to do, and it would have introduced a variable into the rendered
payload that Story 1-10's Playwright harness will later assert against.

**Turned off 2026-08-17T18:17Z and verified.** The `cdn-cgi` script is gone from the rendered
HTML, the Umami script and website id are still present, and the page is 147 bytes smaller.
Recorded rather than quietly fixed, because the general lesson is that turning on a proxy can
change what an origin serves without anybody editing the origin.

## AD-17b status

```
AD-17b status: satisfied as of 2026-08-17
Rules live on: cuatro.dev, www.cuatro.dev, analytics.cuatro.dev, cs-tracker.cuatro.dev, tracker.cuatro.dev, library.cuatro.dev
```

**Why this reads `satisfied`, and what that claim is actually resting on.** Rules are live on
every live hostname, and each was proven to fire by a request rather than inferred from the
configuration. The direct-to-origin bypass that would have made the whole thing decorative was
found, closed, and re-tested. Both halves were necessary: rules with an open origin are a
filter nobody has to use.

**What `satisfied` does not claim.** It does not claim the filter is complete. Rule 2 matches
self-declared user agents, so a crawler that lies about its identity passes. That is a known
and accepted limit of user-agent filtering on a Free plan, not an oversight, and the native AI
categories under Pending Operator actions are the stronger replacement.

### The parse contract

Later stories read this line rather than re-deriving the gate, so its shape is a contract and
not a formatting choice.

- **Location:** inside the fenced block immediately under the `## AD-17b status` heading, and
  nowhere else in this file.
- **Form:** the literal token `AD-17b`, a space, `status:`, a space, then exactly one of
  `not-satisfied`, `partially-satisfied` or `satisfied`, then ` as of ` and an ISO 8601 UTC
  date as `YYYY-MM-DD`.
- **Safe match pattern:** `^AD-17b[ ]status:[ ](not-satisfied|partially-satisfied|satisfied)[ ]as[ ]of[ ](\d{4}-\d{2}-\d{2})$`

**This vocabulary is three values, where AD-17a's is two.** A consumer that reuses AD-17a's
pattern verbatim will fail to match a `partially-satisfied` line at all, and a failed match
reads as a missing or malformed record rather than as a partly open gate. Use the pattern
above, not the one in `ops/monitoring.md`.

**The substring trap, which is worse here than for AD-17a.** Both `not-satisfied` and
`partially-satisfied` **contain** `satisfied`. A consumer that greps for the bare word matches
an open gate and reads it as closed. Match the whole line, anchored. If only a containment
check is available, test for `not-satisfied` and `partially-satisfied` **first** and treat
either as the gate being open, rather than testing for the positive form.

**Treat `partially-satisfied` as not satisfied** for any gating decision. It exists to say
which part is open, not to authorise proceeding.

## The challenge does not clear for an automated browser

**Observed 2026-08-27**, Pending Operator action 3. Story 1-10 installed Playwright, which is what
made this testable at all: the action was written when no agent here could drive a browser.

**Method.** Headed Chromium through Playwright, not headless, navigating to
`https://analytics.cuatro.dev/` and waiting fifteen seconds for the interstitial to resolve. Headed
deliberately: a managed challenge is entitled to treat a headless signature as a bot, so a headless
result would prove nothing either way.

**Result: the challenge never cleared.** The hostname answered `307`, then `403` with
`cf-mitigated: challenge`. The challenge platform ran a full orchestration cycle, then the document
answered `403 cf-mitigated: challenge` a second time and ran a second cycle. The page left in front
of the browser was titled `Just a moment...` reading *"Verifying you are human. This may take a few
seconds."* It never became Umami.

**What this does and does not prove.**

- **It proves the interstitial is not trivially passed**, and that two full challenge cycles can
  complete without admitting the client. Whatever is being scored, this client failed it twice.
- **It does not prove a human cannot get in.** Playwright-driven Chromium carries automation
  signatures, `navigator.webdriver` among them, that an ordinary browser does not. A managed
  challenge refusing an automation-controlled browser is the feature working, not failing.

**Answered 2026-08-27 by the Operator: the site loads normally in an ordinary browser.** So the
two readings resolve in the reassuring direction. The managed challenge admits a human and refuses
an automation-controlled browser, which is the rule working as designed rather than a
misconfiguration. **Rule 4 does not need relaxing**, and this action is closed.

**The useful residue is a testing constraint, not a defect.** No agent in this repository can reach
`analytics.cuatro.dev` through a browser, now or later, because the thing that stops it is the
automation signature itself and not a setting anyone intends to change. Any future acceptance
criterion that needs a rendered result from that hostname has to be written as an Operator action.

## Umami is still collecting, verified against the database

**Observed 2026-08-27.** Story 1-7 filed a deferred entry noting that nobody had confirmed Umami
kept **receiving** events after the managed challenge went live on 2026-08-17. Collection and
dashboard access are different paths, and rule 4 exempts `/api/` and `/script.js` precisely so
collection is unaffected, but that was a design claim rather than an observation.

**It is now an observation, and it did not need the dashboard.** Counting rows in `website_event`
directly, from `cuatro-portfolio-anchor-db-1`:

| Reading | Value |
|---|---|
| Total events | 37 |
| First event | `2026-08-17 12:08:05+00` |
| Latest event | `2026-08-27 19:13:42+00` |

Per day: 3, 5, 4, 0, 6, 4, 2, 2, 4, 2, 5 across 2026-08-17 to 2026-08-27. **Events on nine of the
eleven days, including today**, so the exemption works and the filter has not silently cut
collection off. The two zero days (2026-08-20 and one other) are consistent with a personal site
that some days nobody visits, not with a break: collection resumed by itself either side of them.

**Why this was worth checking rather than assuming.** All Umami history before 2026-08-17 was
discarded, `analytics.cuatro.dev` is deliberately unmonitored, and SM-1 through SM-3 depend on this
instance. A collection failure would have been silent and would have had no baseline against which
the gap looked anomalous. The volume is low enough that it is worth saying plainly: 37 events over
eleven days is a real signal but a thin one, and any metric built on it should say so.

**The query is the cheap repeat**, and needs no Umami credentials:

```
docker exec cuatro-portfolio-anchor-db-1 psql -U umami -d umami -t \
  -c 'select date(created_at) d, count(*) from website_event group by d order by d;'
```

## Pending Operator actions

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| 1 | Apply the `DOCKER-USER` rules and the `cf-origin-firewall.service` unit | The action that closed the bypass and made AD-17b real | **2026-08-17T18:14Z** |
| 2 | Turn off Scrape Shield email obfuscation | Verified afterwards: the `cdn-cgi` script is gone from the Anchor's HTML and the Umami script and website id are intact | **2026-08-17T18:17Z** |
| 3 | Confirm `analytics.cuatro.dev` loads in a real browser | The managed challenge cannot be solved by a command-line client, and Playwright is not installed until Story 1-10, so no agent here can assert a rendered result. **Open the dashboard once and confirm the interstitial passes.** If it does not, rule 4 is the one to relax | **2026-08-27.** The Operator confirmed the site loads normally in an ordinary browser. A headed Chromium under Playwright did **not** pass, so the challenge admits humans and refuses automation, which is the rule working. Rule 4 needs no relaxing. See "The challenge does not clear for an automated browser" |
| 4 | Grant Zone > Bot Management > Edit and set the native AI categories | Allow Search, block Agent and Training. Stronger than rule 2's user-agent list because it does not rely on self-declaration. **Worth doing before 2026-09-15**, when the legacy toggle is retired | _not done_ |
| 5 | Read the Cloudflare audit log, then revoke `tracker-mac` and `cuatro-tracker` | The token available to this story is zone-scoped and returned `Unauthorized` on `user/tokens`, so it cannot list or revoke tokens. **Read the log first**, per the epic: a token doing something other than ACME must not be revoked by assumption | _not done_ |
| 6 | Re-fetch Cloudflare's IP ranges into `cf-origin-firewall.sh` when they change | The script hardcodes the list fetched 2026-08-17 and nothing refreshes it. A new Cloudflare range would be dropped and those hostnames would fail | _standing_ |

**Maintaining this file.** When an action is performed, replace the `_not done_` cell with the
ISO 8601 UTC completion date and leave the row in place. Deletion is not used: the history of
when each part of the filter was established is what a later reader needs when it stops
working. Then re-run the verification table above and re-date it, because it records what one
check saw on one day and is worth exactly that until it is gathered again.
