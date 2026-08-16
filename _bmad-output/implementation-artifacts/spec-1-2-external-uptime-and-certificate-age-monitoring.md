---
title: 'External uptime and certificate-age monitoring'
type: 'chore'
created: '2026-08-16'
status: 'done'
baseline_commit: 'f51bdd7af3b14e7a9c8a30cacfc993c6e689bc8b'
review_loop_iteration: 0
operator_actions_completed_on: '2026-08-16'
ad_17a_gate_owner: 'story-1-3'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/ops/estate.md'
operator_actions:
  - 'DONE 2026-08-16. Five monitors created through the UptimeRobot v3 API, ids 803749849, 803750016, 803750023, 803750025, 803750027.'
  - 'DONE 2026-08-16. Telegram dropped; email to luigi@cuatro.dev confirmed receiving real cuatro.dev down alerts, which proves the same chain end to end.'
  - 'PARTLY DONE 2026-08-16. Rule 1 (checkSSLErrors) enabled on all five. Rule 2 (sslExpirationReminder) is a paid setting, rejected 009-005, deliberately not bought because AD-26 removes the renewal cycle it would watch.'
  - 'DONE 2026-08-16. Zero dollars per month, free tier, observed from the account: no payment processor, no active subscription.'
  - 'REASSIGNED 2026-08-16 to Story 1.3. The gate flips when AD-26 lands (Origin CA installed, ACME disabled), which is when the certificate-age half becomes moot rather than unmet.'
deferred:
  - summary: >-
      Story 4.2 must confirm that Traefik's ACME renewal trigger is relative to
      certificate lifetime, not a fixed day count, before the certificate-age
      threshold can be trusted after the rebuild.
    evidence: |-
      The recorded threshold assumes the issuer attempts renewal at two thirds of
      nominal lifetime, which is Caddy's convention and what makes a 48 hour grace
      the right size. Epic 4 replaces Caddy with Traefik and DNS-01, and
      `epics.md:4044` states this monitor sees the new certificates. If Traefik's
      renewal window is configured in absolute days, renewal moves relative to the
      alert as lifetimes shorten and the threshold either goes noisy or goes silent.
      This is a check Story 4.2 performs, not a defect here.
    location: 'ops/monitoring.md'
    severity: medium
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** The Ecosystem has no product users, so nothing tells the Operator when a subdomain stops serving or when a certificate renewal fails silently. AD-17a makes external uptime and certificate-age monitoring a blocking predecessor of every story that enables automation anywhere, and no monitor and no record of one exists.

**Approach:** Create `ops/monitoring.md` as the written monitoring record: the chosen service and its cost against the NFR-4 ceiling, the probed hostnames with their probe targets, the alert channel, the certificate-age rule expressed as a fraction of issued lifetime, and one `AD-17a status:` line that later stories cite instead of re-deriving the gate. Buying and configuring the monitor is web console work, so it is handed to the Operator and the record states plainly that AD-17a is not satisfied until a test alert has arrived.

## Boundaries & Constraints

**Always:**
- The monitored set is every live `cuatro.dev` subdomain. Today that is the four named in Story 1.2's acceptance: `cuatro.dev`, `cs-tracker.cuatro.dev`, `tracker.cuatro.dev` and `library.cuatro.dev`.
- The service is UptimeRobot and the alert channel is Telegram. Both are recorded as named decisions.
- The certificate threshold is expressed as a fraction of the certificate's own nominal lifetime, never as a fixed day count, so a shortening lifetime narrows the window automatically instead of consuming the safety margin.
- The recurring cost is recorded against the $40 to $100 monthly all-in ceiling (NFR-4), including when it is zero. Zero is still a named decision, not an omission.
- The record carries exactly one `AD-17a status:` line with an ISO 8601 UTC date, and names the stories that read it.
- Decided state is never written as observed state (NFR-9), following the pattern `ops/estate.md` already sets.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash, and no emoji.
- The commit is a subject line only, with no body and no trailer.

**Ask First:**
- If UptimeRobot turns out to have no way to express the certificate rule even approximately, or no way to reach Telegram at all. The service and the channel are the human's decisions, not values to substitute silently.

**Never:**
- Never create an account, buy a plan, or configure a monitor from this session. Those are console actions and belong in `operator_actions`.
- Never write `AD-17a status: satisfied`. Nothing this session can do satisfies the gate.
- Never infer the live hostname set from `docker/Caddyfile`. It routes two of the four (C-9), and Story 1-7 enumerates the real table.
- Never add a monitoring agent, exporter, healthcheck or cron job to the box. AD-17a requires the signal to be off the box.
- Never write `_bmad-output/implementation-artifacts/sprint-status.yaml`, and never touch `contracts/` or `content/projects.ts`.

</frozen-after-approval>

## Code Map

- `ops/monitoring.md`: the file this story creates. Does not exist. `ops/` exists and holds one file.
- `ops/estate.md`: the house-style precedent to follow. Its Counts table (`:22-25`), its decided-versus-observed column, its Pending Operator actions section (`:151-184`) and its maintenance rule (`:181-184`) are the shapes to reuse. Read-only.
- `app/api/health/route.ts:5-11`: `GET` returns 200 with `{"status":"ok", version, uptime}`. This is the Anchor's probe target and it gives a keyword assertion (`"status":"ok"`) rather than a bare status code. The other three hostnames belong to other repositories, so they are probed at `/`.
- `docker/Caddyfile:1-7`: routes `cuatro.dev` and `analytics.cuatro.dev` only. Read-only, and not authoritative for the hostname list.
- Planning sources, all read-only, all already distilled into this spec. `planning-artifacts/epics.md:1013-1052` Story 1.2 and its four acceptance blocks, `:951-956` the operator-evidence rule. `.../ARCHITECTURE-SPINE.md:178-182` AD-17a, `:212` AD-22 (its fixed re-check scope already carries the lifetime schedule), `:243` the recurring-charge rule. `.../prd.md:536-544` FR-31, `:633` NFR-4, `:638` NFR-9, `:741` SM-5, `:750` SM-10.
- `AGENTS.md`: prose punctuation rule, commit subject only, and the `docker/Caddyfile` pitfall.

## Tasks & Acceptance

**Execution:**
- [x] Gather read-only evidence: request each of the four hostnames over HTTPS and capture the response status and the observed certificate `notBefore` and `notAfter`. If a host is unreachable from this session, record that it was not checked rather than record a result.
- [x] `ops/monitoring.md`: create the record with a decision table naming the service, the alert channel, the recurring cost against the NFR-4 ceiling, and the date `2026-08-16` in ISO 8601 UTC.
- [x] `ops/monitoring.md`: add a probe table with one row per hostname giving the probe target, the expected response, and whether the row is decided or observed. Include the evidence gathered above as a separately dated observed-state subsection.
- [x] `ops/monitoring.md`: add the certificate section stating the rule as a fraction of nominal lifetime with its reasoning, a conversion table for the 90, 64 and 45 day lifetimes, and the two dates on which the configured value must change. Tie the review to AD-22, which already carries the lifetime schedule.
- [x] `ops/monitoring.md`: add the `AD-17a status:` line reading `not-satisfied`, state which stories read it, and add a Pending Operator actions section plus a maintenance rule for keeping it honest.

**Acceptance Criteria:**
- Given four live subdomains and AD-17a requiring the signal off the box, when the probe table is read, then each of `cuatro.dev`, `cs-tracker.cuatro.dev`, `tracker.cuatro.dev` and `library.cuatro.dev` appears exactly once with a probe target, and the record states that UptimeRobot runs external to the VPS so a whole-box failure still notifies.
- Given a probe failure must reach a channel the Operator actually reads, when the record is read, then it names Telegram as the alert channel and requires a test alert to have arrived before the gate is treated as closed.
- Given Let's Encrypt lifetimes drop to 64 days in February 2027 and 45 in February 2028, when the certificate section is read, then the threshold is stated as a fraction of nominal lifetime with its reasoning, the conversion table gives the configured equivalent at all three lifetimes, and no absolute day count is presented as the rule.
- Given NFR-4 caps all-in spend and any new recurring charge is a named decision, when the decision table is read, then the recurring cost is recorded against that ceiling explicitly, including a cost of zero.
- Given nothing this session does configures a monitor, when the record is read, then `AD-17a status:` reads `not-satisfied`, the record says which stories depend on that line, and every value that is decided rather than observed is marked as such.

## Design Notes

**The threshold, and why it is not exactly two thirds.** Caddy renews when less than one third of a certificate's lifetime remains, so two thirds of nominal lifetime is the instant renewal is attempted, not a point after it should have completed. An alert placed exactly there fires on every healthy renewal. The recorded rule is therefore **age greater than two thirds of nominal lifetime, plus a 48 hour grace**. The fraction is what narrows automatically at each lifetime cliff; the grace is a retry allowance for a renewal already in progress and does not need to scale, because it is not the safety margin.

Configured equivalents, since UptimeRobot alerts on days remaining rather than on age (`remaining = lifetime / 3 - 2`, rounded down so the alert fires later rather than earlier, and `age = lifetime - remaining`):

| Nominal lifetime | Alert at age | Configured as days remaining | In force from |
|---|---|---|---|
| 90 days | 62 days | 28 | today |
| 64 days | 45 days | 19 | February 2027 |
| 45 days | 32 days | 13 | February 2028 |

The conversion is a workaround the tool imposes, and the one thing in this record that goes stale on a calendar. So the record states the fraction as the rule and the day count as a derived value, with the two review dates written down against AD-22 rather than left to be noticed.

**Why the gate stays open.** Stories 1-10, 1-11 and 1-14 cite AD-17a before adding a CI job. If this record asserted the gate closed on the strength of a document, three later stories would enable automation against a monitor that does not exist. One line, one value, one date, flipped by the Operator after a test alert lands, is the smallest thing that keeps that honest.

**`list-wheel` is not in the monitored set today.** It is Status `Live` but serves from GitHub Pages, so it is not a `cuatro.dev` subdomain yet and its certificate is not ours. Story 2-25 relocates it. Stating the monitored set as every live `cuatro.dev` subdomain makes adding it a consequence of that story rather than a gap someone has to remember. `analytics.cuatro.dev` is on the box but is infrastructure rather than a Registry application, and is recorded with that reasoning rather than dropped.

## Verification

**Commands:**
- `Test-Path ops/monitoring.md`: expected True.
- `Select-String -Path ops/monitoring.md, _bmad-output/implementation-artifacts/spec-1-2-external-uptime-and-certificate-age-monitoring.md -Pattern '[\u2014\u2013]| -{2} |\w-{2}\w'`: expected no matches, over both files. The pattern uses regex escapes rather than the literal characters so it does not match the file it is written in, and it requires spaces or word characters around the dash pair so table separator rows and CLI flags do not match. Verify against a positive control so it is not passing vacuously.
- Non-ASCII sweep of `ops/monitoring.md`: expected no character above U+007E.
- `$r=[Net.HttpWebRequest]::Create('https://cuatro.dev/api/health'); $r.GetResponse().StatusCode; $r.ServicePoint.Certificate.GetEffectiveDateString()` and the equivalent at `/` for the other three: used to fill the observed-state subsection. A failure here is recorded, not retried into a claim.
- `corepack pnpm typecheck`: expected to pass. The change adds no TypeScript, so this only confirms nothing else was disturbed.

**Manual checks:**
- The four hostnames each appear exactly once in the probe table, and the probe target for `cuatro.dev` is `/api/health` with the `"status":"ok"` assertion.
- The certificate section carries all three lifetimes, states the rule as a fraction before any day count, and names February 2027 and February 2028.
- `AD-17a status:` appears exactly once and reads `not-satisfied`.

## Suggested Review Order

**The gate, which is the thing this record exists to produce**

- The one line later stories read, deliberately left open.
  [`monitoring.md:562`](../../ops/monitoring.md#L562)

- Exact-match contract, because a bare `satisfied` also matches `not-satisfied`.
  [`monitoring.md:572`](../../ops/monitoring.md#L572)

- Only a deliberately induced test alert closes it, never the first alert that arrives.
  [`monitoring.md:599`](../../ops/monitoring.md#L599)

- The epic asked for "now satisfied". Honesty won, and the conflict is named rather than buried.
  [`monitoring.md:644`](../../ops/monitoring.md#L644)

**The certificate design, where the real thinking is**

- Two independent rules: age catches stalled renewal, validity catches a wrong certificate.
  [`monitoring.md:385`](../../ops/monitoring.md#L385)

- Age alone would have stayed silent for eight months on the failure observed today.
  [`monitoring.md:397`](../../ops/monitoring.md#L397)

- The fraction is the rule; every day count below it is derived.
  [`monitoring.md:422`](../../ops/monitoring.md#L422)

- Caddy sized the grace, Traefik is answering, and the record admits the gap.
  [`monitoring.md:444`](../../ops/monitoring.md#L444)

- General formula with a floor, because the threshold dies below a 9 day lifetime.
  [`monitoring.md:485`](../../ops/monitoring.md#L485)

- The lifetime cliffs are not calendar switches; certificates straddle them.
  [`monitoring.md:528`](../../ops/monitoring.md#L528)

**What is watched, and how loudly**

- Probe table, four rows, keyword assertion only where a health endpoint exists.
  [`monitoring.md:103`](../../ops/monitoring.md#L103)

- Confirmation threshold and recovery notices, so the signal does not become noise.
  [`monitoring.md:301`](../../ops/monitoring.md#L301)

- The file's own argument turned on the watcher itself.
  [`monitoring.md:361`](../../ops/monitoring.md#L361)

**The evidence, gathered by hand precisely because nothing was watching**

- The Anchor is not serving, recorded as observation and not diagnosis.
  [`monitoring.md:236`](../../ops/monitoring.md#L236)

**Operator handoff**

- Five actions, none performed, each with its constraint.
  [`monitoring.md:684`](../../ops/monitoring.md#L684)
