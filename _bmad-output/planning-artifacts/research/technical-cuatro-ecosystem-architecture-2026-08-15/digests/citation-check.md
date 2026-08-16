# Semantic citation check

Performed 2026-08-15 against `research.md` (97 sources). Scope: the semantic half only,
does each cited source say what the report claims. Mechanical marker/appendix resolution was
already verified elsewhere and was not re-done.

**Budget used:** 12 of 12 fetches. 13 claims checked across 12 sources.

## Verdicts

| [n] | Claim as stated in report | Verdict | Evidence | Recommended action |
|---|---|---|---|---|
| [51] | "A single Next.js 15.4.3 `next start` process was measured at **639,880 KB RSS and 103.3% CPU**" | **OK** | Discussion #81967 reports exactly `639880` KB resident and `103.3%` CPU for the `next-server` process, Next.js 15.4.3 / Node 18.18.2. | None. |
| [51] | "the trigger for that CPU spike was **bot crawlers, not human users**: and **Cloudflare filtering cut it by over 90%**" | **OK** | OP: "the main cause of the high load was bots performing a full site scan," naming the Claude AI bot; confirms Cloudflare "reduced the load by more than 90%." | None. Report's existing single-source flag is correct and sufficient. |
| [51] | Derived: "four Next.js apps at the one measured figure would demand **412%**" (exec summary + Contrary evidence) | **OVERSTATED** | The 103.3% figure is a **peak under an active bot crawl**, which the report itself establishes two paragraphs later. Using it as a per-app steady-state footprint and multiplying by four silently converts an attack peak into a baseline. The 412% number is therefore an upper bound under adversarial load, not an expected demand. | Downgrade the 412% arithmetic from **high → medium-low**. Restate as "four apps *under simultaneous bot load* would demand 412%; idle demand is unmeasured." Does not change the recommendation (Step 1's `docker stats` gate is exactly the right remedy) but the caveat as written reads more binding than the evidence supports. |
| [73] | Keycloak: "~1250 MB base RAM (10k cached sessions), 70% of container limit to JVM heap + ~300 MB non-heap, 1 vCPU per 15 password logins/sec, 150% headroom; **worked example requests 3 vCPU per pod**" | **OK on every figure** | All five verbatim at the redirect target: "1250 MB of RAM"; "70% of the memory limit for heap-based memory… approximately 300 MB of non-heap"; "For each 15 password-based user logins per second, allocate 1 vCPU"; "Leave 150% extra head-room"; worked example = 3 vCPU requested per Pod. | None on the figures. See next row on the use made of them. |
| [73] | Exec summary: "Keycloak's own worked example wants 3 vCPU", used to disqualify Keycloak on a 2 vCPU box | **OVERSTATED** | The 3 vCPU is **load-derived, not a floor**: it is the request for one pod of a **three-pod cluster sized for 45 logins/sec**. At a portfolio's login rate the CPU term collapses toward zero and the binding number becomes the 1250 MB RAM + headroom, which an 8 GB box holds comfortably. Keycloak publishes no minimum, so "the vendor's own published minimums disqualify it" is not what this page says. | Downgrade **high → medium**. The disqualification may still hold on JVM idle footprint and operational weight, but not on the cited arithmetic. The report's own hedge ("single source, two-source bar not met; silent on whether a native build changes it") is present but does not cover this specific misreading. Cross-dimension insight #3 ("Keycloak, authentik and Logto publish minimums exceeding this hardware") inherits the error, Keycloak publishes no minimum at all. |
| [73] | URL `keycloak.org/high-availability/concepts-memory-and-cpu-sizing` | **Wrong URL (redirect)** | Returns only a redirect notice pointing to `/high-availability/multi-cluster/concepts-memory-and-cpu-sizing`. Content is real, address is stale. | Update the appendix URL to the `multi-cluster/` path. |
| [74] | authentik: "at least 2 CPU cores and 2 GB of RAM", multi-container, requires own Postgres | **OK** | Verbatim: "A host with at least 2 CPU cores and 2 GB of RAM". Compose stack bundles its own PostgreSQL service. | None. This is a genuine vendor-stated minimum (unlike Keycloak) so the disqualification stands here. |
| [80] | Clerk: "Every plan supports unlimited applications", explicit; 50,000 MRU per app; first paid $25/mo | **OK, quotation exact** | Page states verbatim "Every plan supports unlimited applications. No credit card required to start."; Hobby = "50,000 MRU (monthly retained user) limit per app"; Pro = "$25/mo" ($20 annual). | None. The load-bearing identity pick is soundly sourced. |
| [64] | Railway: "$20/vCPU/mo, $10/GB RAM/mo, $0.05/GB egress", Hobby $5/mo incl. $5 credit | **OK** | Page publishes per-second rates: $0.00000772/vCPU/s × 2,592,000 s = **$20.01/mo**; $0.00000386/GB/s = **$10.00/mo**; egress "$0.05 per GB"; "Hobby… $5/month, including $5 of monthly usage credits." Report's monthly conversion is correct. | None on the pricing. |
| [64] | Derived: "one idle Next.js at 640 MB is about **$6.40/mo** in RAM alone, so all 12 apps would be roughly **$61/mo** memory-only" | **Internal arithmetic error** | $6.40 × 12 = **$76.80**, not $61. $61 corresponds to ~9.5 apps. The per-app figure and the unit price are both correct; the aggregate does not follow from them. | Recompute. Material because Contrary evidence leans on "~$61/mo is *inside* the stated $40–100 budget", at $77 that argument weakens, though the recommended $15–30/mo partial offload is unaffected. |
| [52] | "Traefik **v3.7.10** (2026-07-31, near-weekly point releases across three branches)" | **OK** | Releases page: v3.7.10 dated 31 Jul 2026, alongside v3.6.25 and v2.11.54 same day, v3.7.9/v3.6.24 on 24 Jul. Three maintained branches, weekly cadence, both confirmed. | None. |
| [52] | "Caddy **v2.11.4** (2026-06-03, roughly monthly)" | **OK on version; "roughly monthly" not supported** | v2.11.4 dated June 3 2026 confirmed as latest. But the preceding releases returned are v2.11.3 (May 2025), v2.11.2 (Mar 2025), v2.11.1 (Feb 2025): a ~13-month gap before v2.11.4, not a monthly cadence. | Version claim OK. Downgrade the "roughly monthly" cadence descriptor **high → low** or drop it; it does not affect the Traefik pick, which rests on the module-bundling argument below. |
| [54] | Caddy's Cloudflare DNS module "does not come with Caddy" and must be added via `xcaddy` or the download page | **OK: quotation exact** | Page states verbatim "This module does not come with Caddy." and "It can be added by using xcaddy or our download page." | None. The single fact the proxy decision rests on is correctly sourced. |
| [40] | Tailwind theme variables "also instruct Tailwind to create new utility classes"; `:root` is for "variables that shouldn't have corresponding utility classes"; no mechanism for `@theme` to auto-adopt `:root` | **OK, both quotations exact** | Verbatim: "Theme variables aren't *just* CSS variables, they also instruct Tailwind to create new utility classes…" and "use `:root` for defining regular CSS variables that shouldn't have corresponding utility classes." The docs draw exactly the opposition the report describes. | None. |
| [40] | "You can put shared theme variables like this in their own package… or even publish them to NPM and import them just like any other third-party CSS files" | **OK, with an eliding ellipsis** | Source reads "…in their own package **in monorepo setups** or even publish them to NPM…". The ellipsis is marked, but what it removes is the framing that Tailwind presents this as a monorepo pattern: mildly convenient for a report recommending cross-repo npm distribution. | Optional: restore the elided words. Not a misrepresentation; the NPM clause is independently stated. |
| [40] | "`@theme inline` bridges to an external variable, and `inline` is **mandatory** for runtime theming" | **OK, slightly strengthened** | Docs say "When defining theme variables that reference other variables, use the `inline` option" and explain that inline substitutes the *value* rather than a reference. The mechanical consequence the report describes (a `[data-theme]` override being ignored) follows correctly. "Mandatory" is firmer than the docs' "use", but is the accurate reading of the mechanism. | None. |
| [40] | Version cited as "v4.3.3, 2026-07-16" | **Unverifiable precision** | Page badges **v4.3**; neither the patch number nor the date appears on it. | Drop to "v4.3" or cite the release page. Cosmetic. |
| [86] | "`__Host-` cookies must not specify a `Domain` attribute" | **OK: quotation exact** | MDN: "they must not have a `Domain` attribute specified, and the `Path` attribute must be set to `/`", with an explicit rejected example carrying `Domain=example.com`. | None. The mechanical fact the whole identity architecture turns on is correct. |
| [65] | "Docker's CLI reference states verbatim that… `up` 'picks up the changes by **stopping and recreating** the containers'"; `--wait` means "wait for services to be running\|healthy, implies detached mode" | **OK, both quotations exact** | Page: "docker compose up picks up the changes by stopping and recreating the containers (preserving mounted volumes)." and "Wait for services to be running\|healthy. Implies detached mode." | None. |

**Tally of what was checked:** 19 verdict rows over 13 distinct claims / 12 sources,
**14 OK**, **2 OVERSTATED**, **1 internal arithmetic error**, **1 wrong URL**, **1 unverifiable
precision**, plus 1 marked-ellipsis note. Zero outright MISMATCHes: no source was found saying
something materially different from what the report attributes to it. Every quotation marked
verbatim or placed in quotation marks that was checked ([51] figures, [54], [40] ×2, [65] ×2,
[80], [86], [74]) **appears in its source as written**.

## Broken or wrong URLs

1. **[73] Keycloak sizing**: `https://www.keycloak.org/high-availability/concepts-memory-and-cpu-sizing`
   serves only a redirect stub. Live path is
   `https://www.keycloak.org/high-availability/multi-cluster/concepts-memory-and-cpu-sizing`.
   Content verified at the target; fix the address.
2. **[15] "Partial clone and shallow clone"**: cited as bare `https://github.blog/`, the blog
   homepage, not the Stolee article. This is a non-resolving citation as written: a reader
   cannot reach the claimed content from the address given. Not fetched (budget), but the
   defect is visible on inspection. Supply the full article permalink.
3. **Appendix rows carrying no URL at all**: [26] `safe.directory`/CVE-2022-24765, [27]
   `core.longpaths`, [50] NL Design System token versioning, [53] nginx ACME/reload, [60]
   Buttondown subpaths retrospective. Several of these are described as multi-vendor or
   multi-source aggregations, which is an honest construction, but they are
   **unverifiable-as-cited**: no address, no title for [53]/[60] beyond a description. [60] is
   load-bearing for the subdomain recommendation and [53] is load-bearing for cutting nginx,
   both deserve a resolvable address.
4. Every other URL fetched in this pass ([51] [74] [80] [64] [86] [52]×2 [54] [40] [65])
   resolved to the expected page on the first request. No 404s, no paywalls, no guessed-looking
   documentation paths among those checked.

## Not checked (and why)

Budget was 12 fetches; these were ranked below the cut. **None of the following should be read
as verified.**

- **[1] Turborepo "a build system optimized for JavaScript and TypeScript"**: a quoted string
  and load-bearing for D1's headline finding. Highest-value item left unchecked; check it first
  in any follow-up pass. Mitigating: Contrary evidence already demotes the orchestrator finding
  to "a supporting note", so the recommendation no longer rests on it.
- **[62] Supabase self-hosting "10+ containers and 8 GB of RAM"** and **[63] free-tier
  7-day pause / $25 Pro**: load-bearing for rejecting Supabase. Second-highest priority.
- **[2] Nx roadmap, [3] Pants backends, [6][7] moon toolchains**: the report already flags
  moon's version numbers as contradictory and instructs downstream not to quote them, which is
  correct handling; the substantive Elixir/Solidity absence claim is unchecked.
- **[28] Material Web maintenance mode, [32] Primer ViewComponents, [29] Adobe Spectrum**: the
  three behavioural datapoints under D2's verdict. Convergent and mutually corroborating, which
  is why they ranked below the single-source numbers, but the D2 verdict is the report's most
  confident and would benefit from a check.
- **[56] Let's Encrypt 90→64→45 day schedule**: drives the "alert on certificate age" standing
  rule.
- **[47] Renovate 44.30.3 / shareable presets, [48] GitHub Packages auth, [49] template repos**,
  Step 7 is explicitly deferred until earned, lowering the stakes.
- **[87] RFC 9700, [88] LiveView security model, [94] Traefik ForwardAuth, [96] next-auth /
  Auth.js merger, [97] Better Auth**: D5 supporting layer.
- **[59] Phoenix `heartbeatIntervalMs` 30000, [67] docker-rollout, [68] Compose resource keys,
  [71] PostgreSQL 18 backup, [72] Linux PSI**: D3 supporting layer.
- **[81]–[85] WorkOS / Auth0 / Kinde / Stytch / Supabase pricing**: the comparison table Clerk
  wins. Clerk itself (the pick) was checked; the losers were not. Note that [81]/[84]'s claims
  are *silences*, which are the hardest kind to verify and the easiest to get wrong: the report
  is commendably explicit that it reports silence rather than "unlimited".
- **All of D4 ([18]–[27])**: the WSL2 relocation finding is Step 8, independent of everything
  else, and the report already marks four of eight sub-items UNEVIDENCED and the order of
  operations as "synthesis, not citation".

## Overall assessment

**The report survives semantic citation checking well.** Across 12 sources spanning every
dimension the recommendation depends on, **no source was found contradicting what the report
attributes to it**, and every checked verbatim quotation appears in its source exactly as
printed, including the ones doing the most work: `__Host-` must not carry `Domain` [86],
Caddy's Cloudflare module "does not come with Caddy" [54], Clerk's "every plan supports
unlimited applications" [80], Docker's "stopping and recreating" [65], and both halves of the
Tailwind `@theme`/`:root` opposition [40]. The precision of the numbers is notably good: the
Next.js `639880` KB / `103.3%` pair, Keycloak's five sizing figures, authentik's "at least 2 CPU
cores and 2 GB of RAM", Traefik v3.7.10 / 2026-07-31, and Railway's per-second rates all
reproduce exactly. The report's habit of labelling inference, single-source claims and
unevidenced items is not decorative: the flags land where they should, and no checked claim was
found carrying a *missing* flag.

**Two substantive problems, both in how figures are used rather than in whether they were read
correctly.**

The more consequential is **[73]**. Keycloak's 3 vCPU is one pod of a three-pod cluster sized
for 45 logins per second. The report converts a load-scaled worked example into a hardware
floor, and the conversion propagates: the executive summary's "Keycloak's own worked example
wants 3 vCPU" is literally true but rhetorically positioned as a minimum, and Cross-dimension
insight #3 generalises it into "Keycloak, authentik and Logto publish minimums exceeding this
hardware", which is accurate for authentik and (unchecked) Logto but false for Keycloak, which
publishes no minimum. **This does not change the identity recommendation**: the requester chose
managed, Clerk's evidence is clean, and Keycloak carries independent operational weight for a
solo maintainer. But the specific evidentiary claim should be downgraded high → medium and the
cross-dimension sentence corrected, because that insight is presented as one of the run's
headline syntheses.

The second is **[51]**'s extrapolation. The measurement is real and correctly transcribed, but
it was taken during a bot crawl: a fact the report establishes itself, then does not carry into
the arithmetic. Multiplying an attack peak by four to reach 412% makes the capacity caveat read
as an established shortfall when it is an upper bound under adversarial load. The remedy the
report already prescribes is exactly right and needs no change: Step 1's week of `docker stats`
replaces the number rather than re-litigating it. Only the confidence label needs adjusting.

Add to those the **$61 vs $76.80** Railway aggregate, which does not follow from the report's own
per-app figure and unit price, and which the Contrary evidence section uses to argue the full
offload sits inside budget.

**Net:** high confidence in the report's sourcing discipline; the recommendation stands.
Three numeric/labelling corrections are warranted, one URL is stale, one is a bare domain, and
five appendix rows carry no address at all. **Roughly 85% of sources were not reached**: most
consequentially [1], [62] and [63], so this pass establishes that the checked spine is sound,
not that the whole apparatus is.
