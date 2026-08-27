---
title: 'Bot mitigation on every live cuatro.dev hostname'
type: 'feature'
created: '2026-08-17'
status: 'done'
baseline_commit: '01134a9b2f396677d76069b2cac0b06cd88dd5f7'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/ops/monitoring.md'
  - '{project-root}/ops/routing-inventory.md'
operator_actions:
  - 'DONE 2026-08-17, by Operator. Cloudflare token widened to carry Zone SSL and Certificates Edit, Zone Settings Edit, and WAF Edit. Bot Management was NOT included, which is why the native AI crawler categories are still outstanding below.'
  - 'DONE 2026-08-17, by Operator. SSH restored. The key lives only in the Ubuntu WSL distribution, so every command against the box must run through `wsl -- ssh deploy@177.7.52.248`. Windows OpenSSH has no key and fails with publickey.'
  - 'OUTSTANDING. Read the Cloudflare audit log to confirm which records `tracker-mac` and `cuatro-tracker` actually touched, then revoke both. The zone-scoped token returns `Unauthorized` on `user/tokens`, so this cannot be done by the agent and needs the dashboard or a User API Tokens token.'
  - 'OUTSTANDING. Grant Zone > Bot Management > Edit and set the native AI crawler categories to allow Search and block Agent and Training. WAF rule 2 delivers the same policy by user-agent matching today, which is weaker because it trusts self-declaration. Worth closing before 2026-09-15, when Cloudflare retires the legacy toggle.'
  - 'OUTSTANDING. Open `https://analytics.cuatro.dev` in a real browser once and confirm the managed challenge passes. A command-line client receives 403 by design and Playwright is not installed until Story 1-10, so no agent in this story could assert it.'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** All six live `cuatro.dev` hostnames are DNS-only, verified against the zone on 2026-08-17, so no bot filter sits in front of any of them. AD-17b gates the whole of Epic 2 on that filter, and the one citable capacity figure in the record was captured during a bot crawl. The AD-17a gate is still shut, holding 1-10, 1-11, 1-14 and 2-23.

**Approach:** Pin TLS mode to Full (strict), proxy every record, move the origin onto one Cloudflare Origin CA certificate with ACME disabled per site, then apply per-hostname WAF custom rules. The monitoring record is amended in the same change, never afterwards.

## Boundaries & Constraints

**Always:**
- All six hostnames serve throughout, verified by a client performing full certificate validation. A result obtained with validation disabled is evidence about what is behind the certificate, never evidence that the host serves.
- **Nine records, not six.** `cs-tracker`, `tracker` and `library` each carry an `AAAA` beside their `A`. An `AAAA` left DNS-only while its `A` is proxied is an unfiltered path straight to the origin for any client with IPv6, which satisfies AD-17b on paper and not in fact.
- Full (strict) is pinned explicitly before any record goes orange, and Automatic SSL/TLS is disabled if it is managing the mode. On Flexible, Cloudflare fetches the origin over plain HTTP and Caddy's port 80 redirect sends it back, producing a redirect loop on every host at once.
- One hostname at a time, with the previous one verified serving before the next is touched.
- `ops/monitoring.md` is amended in the same change that switches the records. An alarm caused by this change is a defect in this story, not an outage.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash, and no emoji. The commit is a subject line only, with no body and no trailer.
- Decided state is never written as observed state (NFR-9).

**Ask First:**
- Before every reload of `/home/deploy/cs-tracker/Caddyfile`. Three live Satellites sit behind it and are not this story's to risk unattended.
- Before revoking either API token, and only after the audit log has been read.
- If any UptimeRobot monitor flips DOWN at any point, stop rather than continue and explain it afterwards.

**Never:**
- Never enable Bot Fight Mode. On Free it is zone-wide, sits outside the Ruleset Engine so `skip` cannot reach it, and Cloudflare's own guidance is that traffic it challenges can only be fixed by turning it off or upgrading. It can challenge the probes that are this estate's only error signal.
- Never use Flexible, and never leave the mode at whatever Automatic SSL/TLS chooses.
- Never install the Origin CA certificate on a site block while that hostname is still DNS-only. The certificate is not publicly trusted, so that is a browser trust error for every visitor.
- Never revoke a token before every hostname is verified serving. A revoked issuance token fails silently at the next renewal, weeks later.
- Never introduce third-party analytics, a tag manager, a session recorder or a tracking script (NFR-8).
- Never write `sprint-status.yaml`, and never touch `contracts/` or `content/projects.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Host serves proxied | `GET https://cuatro.dev/api/health`, validating client | 200, body contains `"status":"ok"` | N/A |
| Edge certificate | TLS handshake to any proxied hostname | Issuer is Cloudflare, not Let's Encrypt | N/A |
| www canonicalises | `GET https://www.cuatro.dev/some/path` | 301 to `https://cuatro.dev/some/path` | N/A |
| Mode left Flexible | Records proxied, SSL mode not `strict` | Redirect loop on every host | Set `strict` before flipping. If seen, set it immediately, do not un-proxy |
| Origin cert installed too early | `tls` directive live while record is DNS-only | Public browser trust error on that host | Restore the backup, reload, verify, then flip the record first |
| AAAA missed | `A` proxied, `AAAA` DNS-only | IPv6 clients reach the origin unfiltered | Flip both records for a hostname in the same step |
| Bad Caddyfile | `caddy validate` fails, or reload errors | Reload refused, previous config still serving | Restore `Caddyfile.bak-1-3`, reload, re-verify all six, then diagnose |
| Monitor flips DOWN | Any of the six UptimeRobot monitors alerts | Treated as a defect in this story | Stop. Roll back the last step before continuing |

</frozen-after-approval>

## Code Map

Gathered 2026-08-17. The zone state is observed by API; the box state is inherited from Story 1.21's live enumeration and is not re-verified here, because SSH access is currently unavailable.

- **Zone `cuatro.dev`, id `e90c26d4127883f3b0a56d5932c500f5`, Free plan.** Read by API on 2026-08-17: 25 records, and all nine estate records are `proxied=false`. TTLs vary and matter: `library.cuatro.dev` A is **3600**, `tracker` A is 120, `cs-tracker` A is 1, apex, `www` and `analytics` are 60.
- **Not in scope, same zone.** `covidmap` and `future-vizion` are Vercel CNAMEs and are not the estate's (Story 2-4 owns them). `_domainconnect` is an already-proxied Squarespace leftover.
- `ops/monitoring.md` is the main edit. Anchors: **`:35`** and **`:553-559`** carry the Let's Encrypt issuer expectation; **`:582-629`** already describes this switch as pending and becomes the applied record; **`:347-395`** is the observed-state table to re-gather and re-date; **`:631-651`** explains why Rule 2 becomes moot; **`:795-801`** is the exactly-once `AD-17a status:` line to flip, whose parse contract is at **`:827-852`**; **`:940-954`** row 6 is this story's to strike.
- `ops/routing-inventory.md`: **`:38-45`** the per-hostname table, every row marked DNS-only; **`:63-82`** the ingress and the HTTP-01 finding; **`:178-187`** the live-credentials table where both revocations are recorded.
- `docker/Caddyfile`: **`:16-18`** states the three hostnames must be DNS-only or HTTP-01 breaks. Flatly wrong after this story. The three site blocks at `:33`, `:45` and `:54` each gain a `tls` directive. The file is a mirror of the installed blocks and is read by no process, so editing it changes nothing on the box.
- `/home/deploy/cs-tracker/Caddyfile` on the box is the file that actually serves, carrying site blocks for all six hostnames. Back up as `Caddyfile.bak-1-3`, matching the established `.bak-<story>` convention.
- **Clean, and confirmed so.** No CI workflow and no test requests a live `cuatro.dev` URL. `.lighthouserc.js:5-9` targets `http://localhost:3000` against a server `lighthouse.yml:33` starts locally. `deploy.yml` is SSH only. A bot filter in front of the estate cannot break the build.
- **Nothing reads `ops/monitoring.md` programmatically.** The `AD-17a status:` line is an honour-system gate today, recorded as deferred work rather than closed here.
- Read-only sources: `epics.md:1132-1229` (this story), `ARCHITECTURE-SPINE.md:233-242` (AD-26), `:182` (AD-17b).

**Free plan limits, researched 2026-08-17.** 5 WAF custom rules, actions include block, managed challenge and skip. Rate limiting is 1 rule, counting by IP only, fixed 10 second period, and its expression may reference Path and Verified Bot only, so a per-hostname rate limit is **not expressible** and must not be promised. Origin CA offers 7, 30, 90, 365, 730, 1095 and 5475 day terms. Cloudflare retires the single "Block AI bots" toggle on **2026-09-15**, replacing it with independent Search, Agent and Training categories.

## Tasks & Acceptance

**Execution:**

Preparation, changing nothing that serves:
- [x] Lower every estate record's TTL to 60 and let the old TTL expire before the first flip, so a cached DNS-only answer cannot outlive the cutover. `library.cuatro.dev` at 3600 sets the wait. **Done 2026-08-17T17:05:03Z.** All nine records now TTL 60, proxy flags untouched. Changed were `library` A (3600), `tracker` A (120), and `cs-tracker` A plus all three AAAA records (automatic, 300). All six hostnames re-verified serving immediately after: 200, 301, 200, 302, 307, 302. The old `library` TTL of 3600 sets the earliest safe first flip at **2026-08-17T18:05Z**.
- [x] Pin the zone SSL mode to `strict` and disable Automatic SSL/TLS if it is managing the mode. **Done 17:12:16Z.** Mode was `full`, not `flexible`, so the redirect-loop risk was never live. Automatic SSL/TLS was already `custom` and is not managing the mode, so no change was needed there. No traffic is proxied yet, so this is inert until it is needed, which is the point.

Cutover, one hostname at a time, verifying each before the next:
- [x] Flip all nine records to proxied, **done 17:14Z to 17:26Z**, one hostname at a time with all six verified between each, `A` and `AAAA` together per hostname, while the origin still presents its Let's Encrypt certificates. Full (strict) validates them, so nothing breaks and no visitor sees an untrusted certificate.
- [x] Back up the shared Caddyfile as `Caddyfile.bak-1-3`, **done 18:13Z**, validated before reload and confirmed by Caddy logging `skipping automatic certificate management` per hostname, add a `tls` directive naming the Origin CA certificate and key to all six site blocks, `caddy validate`, then reload. This disables ACME per site. Keep port 80 bound: Caddy still serves the HTTP to HTTPS redirect from it.
- [x] `docker/Caddyfile`: mirror the `tls` directives and rewrite the `:16-18` comment, which now says the opposite of the truth.

Mitigation:
- [x] Author the WAF custom rules against the 5 rule budget. **Done 17:27:46Z**, four rules, one held in reserve. Field acceptance was confirmed with a probe rule scoped to match nothing, then deleted. Scoped per hostname by `http.host`. A normal browser was verified serving on all six afterwards, and each rule was proven to fire by a request rather than inferred from its expression. **Reordered during review** so the AI-crawler block runs first: as originally applied, any request claiming `UptimeRobot` skipped every rule below it.
- [ ] **NOT DONE, blocked.** Set the AI crawler categories: allow Search, block Training and Agent. The token returned `Authentication error` on `/zones/{id}/bot_management`; `ai_bots_protection` is not a zone setting and `ai-crawl-control` has no route. WAF rule 2's user-agent block list delivers the same policy today and is weaker for it. Parked as Operator action 4. Use the three new controls, not the toggle that is retired on 2026-09-15.

Records:
- [x] `ops/bot-mitigation.md`: create it in the house style. Record the rules per hostname, the effective date and time in ISO 8601 UTC so Story 1.5's measurement week can be attributed to a post-mitigation box, the verification that each hostname still serves, the AI category policy, why Bot Fight Mode was rejected rather than omitted, and a plain statement that AD-17b is satisfied.
- [x] `ops/monitoring.md`: change the expected issuer to Cloudflare per proxied host, record the Origin CA expiry read off the issued certificate in the Decisions table with a dated review, re-gather and re-date the observed-state table, flip the `AD-17a status:` line to the positive form, and strike Operator action row 6. The record must say the certificate-age requirement was **dissolved by AD-26**, not waived and not purchased.
- [x] `ops/routing-inventory.md`: mark every record proxied, **except the two token revocation dates, which stay open because the zone-scoped token cannot list or revoke tokens**, record what now terminates TLS, and date both token revocations in the live-credentials table.

**Acceptance Criteria:**
- Given AD-17b gates Epic 2, when this story closes, then rules are active on all six live hostnames and `ops/bot-mitigation.md` states plainly that AD-17b is satisfied.
- Given the estate's only error signal is six external monitors, when the work is finished, then all six read UP, and any monitor that flipped DOWN during the change is recorded as a defect in this story rather than as an outage.
- Given 1-10, 1-11, 1-14 and 2-23 wait on one line, when `ops/monitoring.md` is amended, then it carries exactly one `AD-17a status:` line, it matches the parse contract at `:827-852`, and it reads the positive form with today's date.
- Given nothing renews the origin certificate, when it is installed, then its observed expiry is written into the Decisions table with a dated review, and the record states that a host may not leave the proxy until a publicly trusted certificate has been issued for it first.
- **UNMET, parked as an Operator action rather than claimed.** Given both API tokens are the credential for a mechanism this story retires, when every hostname is verified serving, then the audit log is read first and only then are both revoked and dated. The zone-scoped token returns `Unauthorized` on `user/tokens`, so listing, revoking and audit-log reading were all impossible from this session. `ops/routing-inventory.md` deliberately still shows both tokens live and undated: writing a revocation date for something that did not happen is the exact decided-as-observed failure NFR-9 forbids.

## Spec Change Log

### Execution findings, 2026-08-17

**1. The filter was bypassable, and the plan did not anticipate it.** After the records were
proxied and the rules were live, a request to `177.7.52.248` with correct SNI reached the
applications untouched: `GPTBot` got 403 through Cloudflare and **200 direct**. Every acceptance
criterion in this spec would have passed while the gate it exists to close stood open. Closed
by restricting `DOCKER-USER` to Cloudflare's ranges with a persistent systemd unit, and
re-tested. **The lesson worth keeping: a filter is only as real as the paths that must traverse
it, and the plan tested the rules rather than the routes.**

**2. `ufw` does not protect published container ports, and the first fix was inert.** Rules
allowing 80 and 443 only from Cloudflare ranges were applied and the bypass survived, because
Docker DNATs published ports through `DOCKER-USER` rather than INPUT. The `ufw` rules were kept
because they are correct for non-containerised services, and `ops/bot-mitigation.md` records
that they are not the control doing the work, so a later reader does not mistake them for it.

**3. The prescribed cutover order would have breached NFR-2, and was inverted before approval.**
`epics.md:1173` fixes the per-host order as install Origin CA, disable ACME, verify, then flip.
Origin CA certificates are not publicly trusted, so that order serves a browser trust error on
every hostname between the two steps, stretched to an hour by `library.cuatro.dev`'s 3600 second
TTL. Records were flipped first, behind still-valid Let's Encrypt certificates that Full (strict)
validates, and the certificate was swapped afterwards behind the proxy. Zero public breakage.

**4. Proxying changed what the Anchor serves, without anyone editing the Anchor.** Cloudflare's
Scrape Shield email obfuscation switched on with the proxy and injected a `cdn-cgi` script into
the Hub's HTML. Not an NFR-8 violation, since it is neither analytics nor a tracker, but a
change this story had no mandate to make under AD-20 and a variable in the payload that Story
1-10's harness will assert against. Turned off and verified gone.

**5. The expected issuer is Google Trust Services, not "Cloudflare".** Cloudflare Universal SSL
is issued by GTS (`CN=WE1`). `ops/monitoring.md` had been written expecting the vendor name.
An assertion naming Cloudflare would never have matched what a probe sees.

**6. Two PowerShell quoting defects, both caught by verification rather than by review.** A
here-string used backslash instead of backtick to escape `$`, so the first firewall script wrote
empty `iptables` arguments and the unit failed cleanly without applying partial rules. An earlier
verification command expanded `$h` into a hashtable and produced a meaningless `http=000` that
briefly looked like an outage. Both are arguments for running the verification against a known
positive control, which is what caught the second one.

**7. Scope was widened twice with Operator approval**, recorded so the diff is not read as
drift: from four hostnames to six (`www` and `analytics` joined the box in Story 1.21, after
`epics.md` was written), and from six DNS records to nine (the three Satellites carry `AAAA`
records that would otherwise have been an unfiltered IPv6 route).

## Design Notes

**The written order is inverted, deliberately, and this is the deviation to read first.** `epics.md:1173` fixes the per-host order as install Origin CA, disable ACME, verify, then flip to proxied. An Origin CA certificate is not publicly trusted, so following that literally means every hostname serves a browser trust error between the install and the flip, and `library.cuatro.dev`'s 3600 second TTL stretches that to an hour. That is a certain NFR-2 breach. This spec flips the records first, while the origin still presents Let's Encrypt certificates that Full (strict) validates, and swaps the certificate afterwards behind the proxy, where the public never sees the origin certificate at all.

The risk the written order was guarding against is two issuers contending for one hostname, and a renewal that breaks not surfacing for weeks. That risk is bounded here rather than dismissed: every certificate was issued 2026-07-29 or later, Caddy renews at one third of lifetime remaining, so the nearest renewal is roughly forty days away and the window between the flip and the certificate swap is hours. The epics order was written on 2026-08-16, before Story 1.21 established both the challenge type and the certificate ages.

**Why the mitigation is WAF rules and not Bot Fight Mode.** AD-17b asks for rules on every live subdomain. On Free, Bot Fight Mode is a single zone-wide switch with no per-hostname scoping, which is a worse fit for that wording than five rules that can each name an `http.host`. It also cannot be skipped, because it does not run on the Ruleset Engine, and Cloudflare documents API and app traffic as collateral. This story is the one that declares the monitoring gate closed, so shipping a filter that can silently challenge the monitors would close the gate and blind it in the same change.

**Rate limiting is named as unavailable rather than left out.** The Free tier's single rule counts by IP over a fixed 10 second window and cannot reference the hostname, so it cannot express what this story would want. The record says so, because an absent control that was considered reads differently from one nobody thought of.

## Verification

**Commands:**
- `curl` each of the six hostnames with validation enabled. Expected: 200, 301, **403**, 302, 307, 302. The `analytics` 403 is rule 4's managed challenge answering a client that cannot solve one, and is the correct result rather than a regression. Every other code matches the pre-cutover baseline.
- `curl -sS https://cuatro.dev/api/health`. Expected: body contains `"status":"ok"`.
- `curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' https://www.cuatro.dev/foo`. Expected: `301 https://cuatro.dev/foo`. The monitor cannot assert the `Location` header, so this is the compensating check.
- TLS handshake per hostname. Expected: issuer **`CN=WE1, O=Google Trust Services`** on all six, and no hostname still presenting Let's Encrypt. Cloudflare is the vendor; Google Trust Services is what Universal SSL puts on the wire, so an assertion naming Cloudflare would never match. The origin certificate is not externally visible and is checked on the box against `127.0.0.1:443` per SNI, expecting CloudFlare Origin SSL Certificate Authority.
- `docker exec cs-tracker-caddy-1 caddy validate --config /etc/caddy/Caddyfile`. Expected: valid. Run before every reload.
- The three Satellites before and after every reload. Expected: unchanged status codes.
- `corepack pnpm typecheck` and `corepack pnpm test --run`. Expected: pass. No TypeScript changes, so this only confirms nothing else was disturbed.
- Punctuation sweep over every file written, using regex escapes rather than literal characters, checked against a positive control so it cannot pass vacuously.

**Manual checks:**
- A normal browser loads all six hostnames with no certificate warning and no challenge interstitial.
- All six UptimeRobot monitors read UP after the rules are live.
- `ops/monitoring.md` carries exactly one `AD-17a status:` line and it reads the positive form.

## Suggested Review Order

**The one change everything rests on: the estate stopped being directly reachable**

- The bypass that made the whole filter decorative, found after the rules were already live.
  [`bot-mitigation.md:114`](../../ops/bot-mitigation.md#L114)

- What actually closed it. `ufw` did not, because Docker DNAT never touches its INPUT chain.
  [`routing-inventory.md:88`](../../ops/routing-inventory.md#L88)

- Recovery, written down because a Cloudflare outage now has no DNS-level escape.
  [`routing-inventory.md:96`](../../ops/routing-inventory.md#L96)

**A skip rule keyed on client-supplied text, which is the sharpest defect in this story**

- Any request claiming `UptimeRobot` skipped every rule below it. Ordering was the fix.
  [`bot-mitigation.md:60`](../../ops/bot-mitigation.md#L60)

- Why `/api/` stays exempt on analytics: an XHR cannot solve a managed challenge.
  [`bot-mitigation.md:84`](../../ops/bot-mitigation.md#L84)

- The rules as they now stand, block first, skip second.
  [`bot-mitigation.md:50`](../../ops/bot-mitigation.md#L50)

**The gate four other stories read**

- Flipped, with the evidence that lets it be audited rather than trusted.
  [`monitoring.md:848`](../../ops/monitoring.md#L848)

- Dissolved by AD-26, not waived and not bought. The distinction a later reader needs.
  [`monitoring.md:869`](../../ops/monitoring.md#L869)

- AD-17b, and its three-value parse contract that AD-17a's two-value pattern cannot match.
  [`bot-mitigation.md:250`](../../ops/bot-mitigation.md#L250)

**Assertions that would have been wrong**

- The issuer is Google Trust Services, not "Cloudflare". Naming the vendor never matches.
  [`monitoring.md:559`](../../ops/monitoring.md#L559)

- The threshold column states the rule, not a configured setting. Nothing will fire.
  [`monitoring.md:384`](../../ops/monitoring.md#L384)

- One certificate now covers all six hostnames, and the estate does not control it.
  [`monitoring.md:360`](../../ops/monitoring.md#L360)

**Peripherals**

- The origin certificate, its 2041 expiry, and a review date nothing will surface.
  [`monitoring.md:39`](../../ops/monitoring.md#L39)

- The mirror gains `tls`, and its comment no longer says the opposite of the truth.
  [`Caddyfile:16`](../../docker/Caddyfile#L16)

- Five findings this story surfaced but did not fix.
  [`deferred-work.md:369`](../deferred-work.md#L369)
