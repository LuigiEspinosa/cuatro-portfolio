# Clerk's pricing and terms before Epic 5

AD-22's bounded refresh of Clerk, run by Story 5.1 before Story 5.2 creates the issuer, and the
named decision NFR-4 requires before identity becomes a recurring charge. It is the artifact
Story 5.1 delivers.

This file is a record, not Registry data. Every value is marked as an observation or a decision,
and the two are never presented as the same kind of fact (NFR-9). Dates and times are ISO 8601
UTC.

**The scope is AD-22's Clerk item** (`ARCHITECTURE-SPINE.md` § AD-22, "Clerk and Railway
pricing"), plus the terms Story 5.1 names. Railway, the versions and every other AD-22 item were
not re-opened. AD-22's full check is not due: Epic 5's first story opened on 2026-10-02, before
the 2026-11-15 trigger date. **Read 2026-10-02 between 14:01:42Z and 14:01:53Z** from the Windows 11
development host, from `dev` at `942833b`, with no Clerk account and no credential. Only pages
Clerk publishes were read.

## Contents

1. [Sources](#sources)
2. [Pricing, as published](#pricing-as-published)
3. [What prices each part of AD-11](#what-prices-each-part-of-ad-11)
4. [Terms, as published](#terms-as-published)
5. [Decision: the plan the issuer runs on](#decision-the-plan-the-issuer-runs-on)
6. [Found in passing, filed](#found-in-passing-filed)
7. [Pending Operator actions](#pending-operator-actions)

## Sources

| Source | URL | Retrieved (UTC) | Page's own date |
|---|---|---|---|
| Pricing | `https://clerk.com/pricing` | 2026-10-02T14:01Z (HTTP 200, 624,478 bytes) | Undated |
| Standard Terms and Conditions | `https://clerk.com/legal/terms` | 2026-10-02T14:01Z (HTTP 200) | "Last updated: July 2, 2026" |
| Use OAuth for Single Sign-On | `https://clerk.com/docs/advanced-usage/clerk-idp` | 2026-10-02T14:01Z (HTTP 200) | "Last updated on Oct 1, 2026" |
| How Clerk implements OAuth | `https://clerk.com/docs/guides/configure/auth-strategies/oauth/how-clerk-implements-oauth` | 2026-10-02T14:01Z (HTTP 200) | "Last updated on Oct 1, 2026" |

The prior readings are the research of 2026-08-15 (`research.md` source 80, checked in
`digests/citation-check.md`) and Story 4-1's row of 2026-09-30 (`ops/settled-inputs-refresh.md`
§ The list, item by item).

## Pricing, as published

All observed 2026-10-02 on `https://clerk.com/pricing`.

| Line | Hobby | Pro | Business | Since 2026-09-30 |
|---|---|---|---|---|
| Base price | "$0", "No credit card required" | "$25/mo, $20/mo billed annually" | "$300/mo, $250/mo billed annually" | Unchanged |
| Applications | "Every plan gets unlimited applications." | Unlimited | Unlimited | Unchanged |
| Included users | "50,000 MRU limit per app" | "50,000 MRUs included per app", then "$0.02/mo each" to 100,000 | As Pro | Unchanged |
| What an MRU is | "A user is counted as retained when they return 24+ hours after signing up." | Same | Same | First recorded here |
| Over the limit | "Once you exceed 50,000 monthly retained users you will be required to upgrade to the Pro plan", with "a one-month grace period" | Billed per MRU | Billed per MRU | First recorded here |
| Session lifetime | "Fixed, 7 day session lifetime" | "Custom session lifetime" | As Pro | First recorded here |
| Custom domain | Included | Included | Included | First recorded here |
| Multi-factor authentication ("authenticator applications, SMS codes, and backup codes") | Not included | Included | Included | First recorded here |
| "Secured by Clerk" branding removed | Not included | Included | Included | First recorded here |
| Social connections | "Up to 3" | Unlimited | Unlimited | First recorded here |
| Passwords | Included, "Automatically checked against leaked password databases" | Included | Included | First recorded here |
| Satellite domains, "Use the same session across applications hosted on different domains." | Not included | "$10/mo each" | "$10/mo each" | First recorded here |
| Enterprise connections (EASIE, SAML, OIDC) | Not included | "1 connection included per app", then "$75/mo each" | As Pro | Unchanged since 2026-08-15 |
| Full data exports | Included | Included | Included | First recorded here |
| Email support | "Billing, registration, and abuse queries only" | Included | Priority | First recorded here |
| Dashboard seats | "Up to 3" | "Up to 3" | "10 included" | First recorded here |

No line on the page names OAuth applications, the OAuth or OIDC identity provider, or PKCE. The
page's one OAuth mention is a changelog card: "CIMD is now available for every Clerk
application."

## What prices each part of AD-11

AD-11's shape is one Clerk issuer, one OIDC client per application, Authorization Code with PKCE,
each application minting its own `__Host-` session. Epic 5 adds a shared demo principal (AD-13)
and the Operator's own sign-in.

| AD-11 element | What Clerk calls it | What prices or limits it | Nature |
|---|---|---|---|
| The one issuer | One Clerk application's production instance, served on the Operator's domain (`https://clerk.<INSERT_YOUR_APP_DOMAIN>.com/.well-known/jwks.json` "for a production environment", the SSO docs page) | "unlimited applications" and "Custom domain" on every plan, Hobby included. $0 | Observed |
| One OIDC client per application | An OAuth application on the instance's "OAuth applications" page, each with its own Client ID and Client Secret | **No Clerk page read prices or limits it.** The pricing page has no line for it, and neither docs page states a plan requirement. Absence on a page is not a guarantee: Pending Operator action 2 confirms it on the dashboard | Observed absence |
| PKCE | "Require PKCE is enabled by default for newly created Clerk instances" (how Clerk implements OAuth) | No plan line. $0 | Observed |
| Token lifetimes | "OAuth access tokens expire after 1 day", "Refresh tokens never expire", "Authorization codes expire after 10 minutes", "OIDC `id_token`s expire after 1 day" | No plan line. Bears on Story 5.3's session design, not on cost | Observed |
| The demo principal `demo@cuatro.dev` | One user, password sign-in | One MRU at most, however many Visitors use it, because it is one user. Passwords on every plan | Observed price; the count is derived from the MRU definition |
| The Operator's sign-in | One user | One MRU. On Hobby: no Clerk-enforced MFA, up to three social connections, and Clerk's own session fixed at 7 days, so the Operator re-authenticates at the issuer at most weekly. Each application's `__Host-` session is its own and is not set by that limit | Observed price; the consequence is derived |
| Sessions shared across domains | Clerk's "Satellite domains", $10 a month each on Pro | **Not used.** AD-11 federates each application over OIDC and forbids a session that leaves its host, so this charge does not arise | Decided by AD-11 |
| Enterprise connections | Clerk signing users in through another company's SAML or OIDC provider | Not used: the estate has one provider. $0 | Decided by AD-11 |

So at the estate's scale (two users, the Operator and the demo principal, against 50,000 per
application) no usage line can produce a charge. The only cost question is the base plan.

## Terms, as published

All observed 2026-10-02 on `https://clerk.com/legal/terms`, the version headed "Last updated:
July 2, 2026". Creating the account in Story 5.2 accepts this agreement, which incorporates the
Data Processing Addendum and the Privacy Policy by reference.

| Term | Quotation | What it means here |
|---|---|---|
| Fee changes | "Company reserves the right to change the Fees or applicable usage charges and to institute new usage charges and Fees"; the Company "may (and where required by law, will) send an email to you at the last email address you provided to us"; "Updated Fee amounts shall apply to you no sooner than 30 days from the date the Company has notified you of the proposed changes" | A price rise, or a new charge on a plan that is free today, applies no sooner than 30 days after Clerk notifies the account. The email itself is a "may", so the account's address must be one the Operator reads |
| Refunds | "paid Fees are non-refundable" | Annual Pro is $240 paid up front and not recoverable if Epic 5 is abandoned |
| Suspension for usage | Clerk may suspend access "upon notice" if it "reasonably determines that Customer's use of the Service is in excess of the applicable Fees paid for by Customer" | Exceeding the Hobby allowance is the trigger, and the pricing page grants a one-month grace first. At two users this is remote |
| Licence purpose | Use "solely for Customer's internal business purposes", and no use "for the benefit of a third party except its own customers and its end users" | A Visitor using the demo principal is the Operator's end user, which the clause permits |
| Free plan | The terms never name Hobby or a free plan. Their "Free Trial" clause (terminable "at any time in the Company's sole discretion", data "may be permanently lost", capitals in the original) covers only functionality "clearly designated as a 'free trial,' 'evaluation' or similar designation" | **Not settled by the text.** Hobby is presented as a plan ("Free", "No credit card required"), not as a trial, so the clause reads as not applying; that is a reading, not a statement Clerk makes. The hedge is AD-11 itself: no application holds Clerk-specific logic, and "Full data exports" are on every plan |
| Term | The agreement runs "for so long as Customer continues to use the Service and until Customer has affirmatively elected to cancel" | No fixed term to watch, unlike the box's 2028-07-19 |
| Publicity | "Company may refer to Customer by name, logo and trademark in Company's marketing materials and website" | Clerk may name the Operator as a customer. The clause states no opt-out |
| Disputes | Delaware law; "SECTION 10 CONTAINS A BINDING ARBITRATION AND CLASS ACTION WAIVER CLAUSE FOR U.S. BASED CUSTOMERS" | Recorded, no consequence for the build |

## Decision: the plan the issuer runs on

**Ruled by the Operator 2026-10-03T22:04Z: Hobby, $0 a month** (option A, the recommendation). This
row is the named decision NFR-4 and the spine's Recurring cost row require before any identity charge
exists. Story 5.2 opens the account on Hobby.

**The ceiling.** NFR-4's $40 to $100 band, read as `ops/monitoring.md` § The cost against NFR-4
reads it: the ceiling is **$100 a month all-in**, and only marginal spend counts.

**The estate's recorded marginal spend today: $0 a month.** The box is prepaid to 2028-07-19
(`prd.md` NFR-4); UptimeRobot is on its free tier (`ops/monitoring.md`, observed 2026-08-16); R2
holds every offsite backup inside its free tier (`ops/backup-digital-library.md`, derived
2026-08-27, and `ops/postgres-backup.md`); Cloudflare runs on its Free plan
(`ops/bot-mitigation.md`). The domain's registration is in no ops record and is not counted here.

| Option | Monthly figure | Estate total against $100 | What it buys this estate | What it costs this estate |
|---|---|---|---|---|
| **A. Hobby (recommended)** | **$0** | **$0**, ceiling untouched | Everything AD-11 and AD-13 need, as § What prices each part of AD-11 lists | No Clerk-enforced MFA; "Secured by Clerk" on Clerk's prebuilt sign-in UI wherever a Visitor or the Operator meets it; Clerk's session fixed at 7 days; email support for billing, registration and abuse only |
| B. Pro, monthly | $25 | $25, a quarter of the ceiling | MFA, branding removed, custom session lifetime | $300 a year, cancellable at the end of a month |
| C. Pro, annual | $20 ($240 a year up front) | $20 | As B | Non-refundable, committed before Story 5.4 proves the pairing works |

**Why Hobby.** It prices every element AD-11 and AD-13 use at $0, the MRU allowance is four orders
of magnitude above the estate's two users, and every dollar of Pro would count against NFR-4's
ceiling while buying nothing a requirement names. The Hobby limits are real but none is a requirement in the
PRD or the spine: no planning artifact requires MFA, and the Operator can get second-factor
protection through a social connection whose provider enforces it (Hobby allows three), a choice
for Story 5.2.

**What would move it to Pro.** Any one of: the Operator wants MFA enforced by Clerk itself; the
"Secured by Clerk" mark on the Visitor's demo path is judged a defect of the portfolio; a session
lifetime other than 7 days is needed at the issuer; or the estate passes 50,000 MRU per
application. If one fires, B before C: monthly is cancellable, annual is not refundable. Either way
the figure is recorded here against the $100 ceiling before the upgrade, never after.

**Re-opening this** is AD-22's to trigger at the next refresh, or the Operator's at any time; never
time's alone.

## Found in passing, filed

Neither OAuth docs page read here mentions logout, an `end_session_endpoint` or back-channel logout,
which AD-11 requires and Story 5.5 builds. That is a capability question outside this story's
pricing scope, so it was not researched further and is filed as DW-319 for Story 5.2 (which reads
the issuer's discovery document) and Story 5.5.

## Pending Operator actions

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| 1 | **Rule on the plan decision**: Hobby ($0, recommended), Pro monthly ($25) or Pro annual ($20, $240 up front) | Write the ruling and its date into § Decision: the plan the issuer runs on, replacing "Pending the Operator's ruling". Story 5.1 is done when this cell is dated. Story 5.2 opens the account on the ruled plan | 2026-10-03T22:04Z (Hobby) |
| 2 | **Confirm OAuth applications are not plan-gated**, when Story 5.2 creates the first one: on the ruled plan, the dashboard's "OAuth applications" page creates an application with the `openid` scope and shows no upgrade prompt | No Clerk page read prices or limits OAuth applications (§ What prices each part of AD-11). Record what the dashboard showed here. If it is gated, stop and re-open action 1 with the real figure | _not done_ |
| 3 | **Re-read the terms' date at sign-up** | Creating the account accepts the Standard Terms. If the page's "Last updated" is no longer "July 2, 2026", re-read the clauses in § Terms, as published and record any change here before accepting | _not done_ |

**Maintaining this file.** When an action is performed, replace its cell with the ISO 8601 UTC date
and leave the row in place. The next refresh is a new dated section here, never an edit of this
run's observations.
