# Red team: solo-maintainer sustainability

Lens: this will be abandoned in six months. Criterion #1 is solo-maintainer sustainability;
"ongoing maintenance burden outranks theoretical elegance." Everything below is grounded in
`research.md` or in a stated logical flaw in `provisional-verdict.md`. Where I infer, I say so.

The single structural observation that organises this review: **the verdict's sequencing
front-loads benefit and back-loads cost, while its architecture front-loads permanent
obligations and back-loads their payoff.** Steps 1–4 are cheap and visible; steps 5–8 are
expensive and invisible. Meanwhile the hub, the npm pipeline, the Renovate presets, Traefik,
`docker-rollout` and PSI are all *permanent* costs justified by *future* change frequency that
a solo portfolio will not generate.

## The recurring-obligation inventory

Nothing in the provisional verdict counts these. There are at least 18. Frequencies marked
(inf) are my inference from the mechanism, not from a cited source.

| Chore | Frequency | Decays when | Order of decay |
|---|---|---|---|
| Backup **restore verification** | quarterly-ish (inf) | never had a defined procedure: research found **no guidance at all** and declined to invent it | **1 (never starts)** |
| Per-container PSI monitoring (`cpu.pressure` etc.) | continuous read, weekly glance (inf) | kernel publishes **no universal trouble threshold** [72]; nothing to alert on, so nothing gets watched | **2** |
| Compose limit verification (`docker inspect` NanoCpus/Memory) | per new app (inf) | enforcement is uncertified by docs [68]; done once at rebuild, never again | **3** |
| `pg_dump` + restic offsite: retention, prune, repo password custody | weekly cron + occasional attention | cron keeps running; the *checking* stops immediately | **4** |
| Token semver discipline (rename = major, value = minor; deprecate→migrate→remove) [50] | per token change | one rename shipped as a minor because a major means touching 15 repos | **5** |
| Renovate PR triage across 15 repos | continuous; Renovate itself ships ~2–3 releases/day [47] | volume exceeds attention → resolved by automerging everything or muting the bot | **6** |
| Reusable-workflow SHA pin bumps in 15 caller stubs (SHA pinning = "safest option" [13]) | per hub workflow change | stubs silently diverge; some repos run a year-old workflow | **7** |
| Caller stub + `renovate.json` install in each new repo (central *installation* is **not** solved [11][13]; rulesets are not a propagation mechanism [49]) | per repo, forever | repo #16 just doesn't get them | **8** |
| npm publish credentials: automation token for 2FA-enforced publish, rotation (inf from [48]) | on expiry | first expiry → token release blocked → tokens stop being released | **9** |
| Vendored `daisyui.js` (251 KB) + `daisyui-theme.js` upgraded by hand via `curl` [42] | per daisyUI release | **Renovate cannot see vendored files**: invisible drift from day one | **10** |
| Certificate-**age** alerting (90 → 64 d Feb-2027 → 45 d Feb-2028 [56]) | build once, watch forever | no tooling is named in the verdict; unbuilt until the first outage | **11** |
| Traefik upgrades (**near-weekly point releases across three branches** [52]) | weekly-to-monthly | skipped until a CVE or a broken renewal forces it | **12** |
| `docker-rollout` upkeep: **1 release in the trailing 12 months**, single maintainer [67] | on breakage | it breaks on a Docker CLI change and gets ripped out | **13** |
| Postgres shared-cluster arithmetic: sum of per-app `connection_limit` < `max_connections` [61] | per app deploy | forgotten around app #7; surfaces as a confusing outage | **14** |
| Postgres **major-version** upgrades on the one shared cluster | yearly | deferred indefinitely because it now moves *every* app at once | **15** |
| Hub's own CI (token build, publish-on-tag, Style Dictionary ≥5.5.1 pin [38]) | per release | fine while releases happen; releases stop | 16 |
| App-registry entries kept current | per project change | stale registry = the exact Streamdal "last updated 6 months ago" pathology [9] the hub exists to cure | 17 |
| Cloudflare bot rules | set once, revisit rarely | genuinely low: this one survives | 18 (survives) |
| Tokens adopted per framework (6 stacks × adapter/vendoring paths) | one-time per app | fine, one-time | n/a |

**Realistic steady-state cost.** Renovate across 15 repos alone plausibly produces PRs most
weeks. Add Traefik's near-weekly releases, monthly token/registry hygiene, and quarterly
backup and PSI work. Call it 2–5 h/month at best behaviour, spiking on any upgrade that
breaks. That is not obviously unaffordable, but it is **unaffordable for a portfolio with no
users**, because none of it produces any felt benefit, and unrewarded recurring work is
exactly the category a solo maintainer stops doing.

**The order of decay is not random.** It is sorted by *absence of signal*. Chores 1–5 have no
observable consequence when skipped. That is the whole finding: the verdict adds many chores
whose failure mode is silence, into an environment the research itself establishes has no
error signal at all.

## Attacks that land

### 1. Automerge into an environment with no error signal: STRENGTH: fatal (to the automerge policy; serious to the whole propagation design)

The verdict's mechanism: Renovate presets, "grouped token updates, **automerged on green CI for
minor/patch**, majors left as PRs." The research quotes the vendor's own warning verbatim: "you
should have tests wherever you regularly update dependencies" [47]. It then does not ask whether
these 15 repos have tests.

Three facts compose into a failure the document never assembles:

1. **Renovate's stated guardrail is vacuous without checks.** The research lists "passing checks
   required by default" [47] as a safety property. On a repo with no test workflow, "no failing
   checks" is trivially true. The guardrail does not degrade gracefully to "block": it degrades
   to "merge." The safety property is *inverted* precisely in the repos that need it most.
2. **Tokens are the worst possible payload for automerged minors.** By the document's own
   versioning rule [50], a colour *value* change is a **minor**. So the change class most likely
   to be visually breaking: a contrast regression, a dark-mode value, a radius that wrecks a
   layout: is exactly the class routed to unattended merge across all 15 repos.
3. **No real users means no error signal, ever.** D3 establishes the load profile on this box is
   **bot crawlers, not human users** [51]. There is no one to complain. A recruiter who opens a
   broken demo does not file an issue; they close the tab. The damage lands squarely on
   criterion #2 (portfolio value) and is undetectable by construction.

So the mechanism sold as reducing maintenance actually **converts maintenance debt into silent
portfolio damage**. It does not fail loudly and get fixed; it fails quietly and stays broken.
And it is worse than doing nothing, because doing nothing leaves the apps in whatever working
state they were last observed in.

Note the tie to attack 7: the research derived its solo conclusions by subtracting the
team-dependent parts of team evidence. Code review was subtracted as a *coordination cost*. But
review is also the *error-detection mechanism*. At N=1 there is no reviewer, no teammate who
notices the staging site looks wrong, and (here) no user. The subtraction removed the safety
net along with the overhead, and the verdict then adds automation on top of the hole.

**What should change.** (a) Never automerge into a repo with no test job: make the preset's
automerge conditional on the existence of a real check, not on its absence of failure. (b) Buy a
synthetic error signal *before* any automation that can break things: an external uptime + HTTP
status check on the four live subdomains, plus a visual-diff or at minimum a screenshot on the
hub. It is the cheapest item in this entire document and it is the one the plan omits. (c) If
(a) and (b) are not done, do not automerge at all: leave PRs open and batch them.

### 2. The hub gives you monorepo blast radius with polyrepo rollback cost: STRENGTH: serious

The research contains both premises and never joins them. From D1: the surviving pro-monorepo
argument at N=1 is atomic change and rollback, because "no single operation could perform a
rollback on separate Git histories simultaneously" [8]. The verdict then adopts federation: 15
separate histories, and *adds* a shared hub publishing tokens and reusable workflows into all
of them.

That is the worst quadrant. A bad token release or a broken reusable workflow now propagates to
15 repos (monorepo-scale blast radius) with **no atomic rollback** (polyrepo-scale recovery
cost). Recovery is: publish a fix, then wait for or force 15 Renovate PRs, then confirm 15
deploys. That is a multi-hour incident on a portfolio, triggered by a colour change.

The federated pattern's *documented* failure mode (workflow copying) is indeed fixed [13]. Its
*undocumented* one (coupled failure without coupled recovery) is not, and the verdict inherits
it silently. This also compounds attack 1: automerge means the bad release reaches all 15 repos
before any human sees it.

**What should change.** State the blast radius explicitly. Then reduce it: pin consumers by
version rather than floating, keep majors manual (the verdict does), and keep the number of
consumers small, which is attack 4.

### 3. The propagation machinery is amortised over a change frequency that will not occur: STRENGTH: serious

The token distribution pipeline is: a hub repo, a Style Dictionary build, a publish-on-tag CI
workflow, npm publishing with automation credentials, a second `renovate-config` repo, and two
frozen files installed by hand in 15 satellites. The research assembles it carefully from primary
docs and is explicit that **"zero published case studies name any real design system's cross-repo
distribution mechanism"**: it is built from tool documentation, not copied from a precedent.

The unexamined premise is that token changes will be *frequent*. For a solo personal portfolio,
design tokens converge after the initial design pass and then change perhaps two or three times a
year. The machinery's cost is constant and recurring; its benefit is proportional to change
frequency, which tends to zero. Hand-copying one `tokens.css` into four apps takes minutes and
happens twice a year. The pipeline costs more than that in credential rotation alone.

Worse, the pipeline's cost is paid in the *lowest-signal* chores from the inventory: token
semver decisions, PR triage, SHA pin bumps, npm credentials, which are precisely items 5–9 in
the decay order.

The research's own reversibility finding cuts the right way here: the layout decision is
"cheap enough not to agonise over; expensive enough not to do twice" (~one focused week [8][9]).
That argues for deferring the pipeline until it is *demanded*, not for building it speculatively.

**What should change.** Make npm + Renovate presets a **trigger-gated** upgrade, not a step.
Trigger: "I have made three or more token changes in one quarter and hand-copying has actually
annoyed me." Until then, `tokens.css` lives in `cuatro-portfolio` and is copied.

Note this also dissolves most of step 2 and all of the `renovate-config` repo, without touching
step 3: see attack 5.

### 4. Failing to archive aggressively is the largest single sustainability risk, and the plan does not mention it once: STRENGTH: serious

Eight sequencing steps, zero of them are "delete." Three empty projects and four trackers are
acknowledged as deferred to synthesis and then simply do not appear.

**Every kept project is a permanent multiplier on every per-repo obligation in the inventory
above**: a caller stub, a `renovate.json`, a Renovate PR stream, a token adoption path in its
framework, a container, a subdomain, a certificate, a database and role, a connection-limit
allocation, a backup line, a registry entry. Fifteen repos is not 15 units of work: it is 15 ×
N. Cutting to eight cuts ~45% off every recurring line item, permanently, in one afternoon.

The research supplies the *portfolio* argument too, and it is the strongest one available.
Streamdal's consolidation driver was **perception**: a flagship reading "Last updated: 6 months
ago", a language bar showing only shell and markdown, and users unable to tell which repo to file
against [9]. Four trackers is that pathology verbatim: a visitor cannot tell which is the real
one, and the answer "they are all half-real" is worse than any single answer. Three empty
projects are strictly negative portfolio value: a visitor who clicks one learns something bad
about the author that they did not know before. Note also that two of the four *live* subdomains
are tracker-shaped (`cs-tracker`, `tracker`), so the ambiguity is already public.

**The most ruthless defensible position:**

- **Archive all three empty projects immediately.** GitHub archive is read-only, still visible,
  and carries zero ongoing tax. There is no argument for keeping an empty repo unarchived.
- **Collapse four trackers to one.** Pick the best; archive the other three, or fold their one
  good idea into the survivor. Do not deploy more than one.
- **Do not deploy anything that is not either (a) actually used by you or (b) a portfolio piece
  you would show someone this month.** Deployment is the most expensive form of keeping.
- **Target: ≤8 active repos, ≤5 deployed subdomains** before any other work begins.

This should be **step 0**. It is the only step that makes every other step cheaper, and unlike
everything else in the plan it is finished the day it is done.

### 5. Steps 1–3 carry the value; the rest has no forcing function and should be demoted, not sequenced: STRENGTH: serious

The plan's own weighting condemns it. Step 1 (bot filtering) is described by the research as
"the most actionable finding of this entire run" and takes hours. Step 3 (app registry) is
labelled "the visible 'suite' moment." Those two are the deliverable. Steps 5–8 are the largest,
riskiest and least visible work in the document, and they sit *after* the reward has been banked.

A solo maintainer with the visible win already in hand does not begin a greenfield VPS rebuild
(step 5): a step which, note, is also where the *majority of the recurring obligations get
created*: Traefik upgrades, `docker-rollout`, cert-age alerting, PSI monitoring, backup
scripting, shared-cluster connection arithmetic. So the plan's realistic outcome is: steps 1–4
done, step 5 abandoned mid-flight or never started, and a hub repo left behind that now needs
maintaining for the benefit of four apps.

There is a sharper point about step 2. **The hub is not load-bearing for step 3.** The app
registry that produces the "suite moment" is a JSON or Markdown file listing projects. It can
live in `cuatro-portfolio` itself. Coupling the highest-value visible step to the creation of a
new repo and an npm publishing pipeline is unnecessary sequencing debt, and it is what makes
attack 3 expensive.

**What should change.** Truncate explicitly. Steps 1 and 3 (registry inside the portfolio) plus a
hand-copied `tokens.css` deliver the great majority of the value. Everything else becomes a
trigger-gated backlog with the trigger written down: the way the verdict *already* correctly
handles the Next.js merge ("gated on whether a shared React component package actually
accumulates real components"). That gate is the best piece of engineering judgement in the
document. Apply the same discipline to the other six steps instead of only to that one.

### 6. The "suite feel" claim is under-justified, and coherence is in direct conflict with the stack variety the requester values: STRENGTH: moderate-to-serious (under-justified, not wrong)

The research's central reassurance is: "Color, type, spacing, radii, elevation and motion carry
the overwhelming majority of perceived brand coherence: that is precisely the payload Primer
distributes to three unrelated implementations [33]."

The citation does not support the claim. [33] evidences **what Primer ships**. It says nothing
about **what visitors perceive**. The inference "they ship it, therefore it carries most of
perceived coherence" is a non-sequitur, and the research elsewhere admits, correctly, that "no
first-hand retrospective quantifying where token-only coherence breaks was found" in three
rounds. So criterion #3's satisfiability rests on an unevidenced perceptual assertion presented
in the voice of a finding. This is the one place where the research's otherwise excellent
citation discipline slips.

The deeper problem the research never states: **stack variety and suite coherence are in direct
conflict, and the requester explicitly wants both.** Tokens are the only thing that federates
*precisely because* six frameworks were chosen. So the requester pays the full cost of variety,
six upgrade treadmills, six token adoption paths, six component vocabularies, no shared component
work possible, and receives the *minimum* coherence the industry knows how to deliver. Adobe
pays for duplication with vastly more resources [29]; Google defunded the best attempt [28];
GitHub resolved the exact analogue by **deleting the server-rendered half** [32]. The precedent
for "one visual system across a JS cluster and a server-rendered app" is not "hard": it is
"abandoned by its only serious practitioner."

Is "one product" achievable? No. Is that fatal? No, but the ambition should be **restated
honestly** rather than quietly under-delivered.

**What should change.** Rewrite criterion #3 from *"the suite must feel like one product"* to
*"the suite must read as one author."* That target is genuinely achievable with tokens plus a
consistent hub shell, consistent naming, consistent READMEs and consistent OG images, and it is
arguably a *better* portfolio pitch, since it lets the stack variety read as range rather than as
inconsistency. Chasing "one product" will generate per-framework component work that has no
precedent to copy (the research found **no published design system serving both Phoenix/LiveView
and a JS framework**) and that will be the first thing abandoned.

### 7. The evidence base has a hole exactly under the decision, and the verdict launders the research's hedges into confidence: STRENGTH: serious (presentation), moderate (substance)

The research is admirably honest: "**There is zero published study on solo or very-small-maintainer
repository layout**… Every solo-specific conclusion above is team evidence with the team-dependent
parts subtracted, and is marked as such."

Two problems.

**The subtraction method has a specific invalidity.** It assumes the team-dependent parts are
*pure overhead*. Some of them are *pure safety*. Code review, a second pair of eyes on a deploy,
a colleague noticing a broken page: these are coordination costs that also perform error
detection. Subtracting them removes a cost and a safeguard at once, and the method has no way to
notice. Attack 1 is the concrete instance: the verdict adds unattended automation into exactly
the gap the subtraction created.

**The verdict then drops the hedges.** The research qualifies; the provisional verdict asserts.
Compare:

| Verdict says | Research actually says |
|---|---|
| "Traefik v3.7 (stock image, Cloudflare DNS-01 via env vars)" | "*Medium-high confidence: Cloudflare is not named inline on the page read*" [55] |
| "`docker-rollout` for zero-downtime" | alive but "**only one release in the trailing 12 months**" [67] |
| "PSI per-container monitoring on cgroup v2" | kernel publishes "**no universal trouble threshold**" [72] |
| "`pg_dump` + restic offsite" | "**Restore-testing guidance was searched for and not found**" |
| "Cloudflare bot filtering first: cheapest capacity win" | rests on **one** GitHub discussion thread [51] |

That last row is a methodological inconsistency worth naming. The run held a **two-source bar for
performance claims, met it zero times**, and correctly refused to publish proxy RAM figures traced
to AI content farms. It then built its headline recommendation on a single uncorroborated
discussion thread. The rigour was applied asymmetrically: strictly where it produced a refusal,
loosely where it produced a recommendation.

**How much confidence does this deserve?** Enough to act on the cheap, reversible parts; not
enough to justify multi-week irreversible work. Which is, conveniently, exactly the truncation
argument in attack 5.

**What should change.** The verdict should carry the hedges forward verbatim, and should state
the subtraction method's limitation in one sentence where a reader will see it.

### 8. The null option was rejected on the one property that does not matter here: STRENGTH: serious

The research concludes: "A self-hosted PaaS's real value here is **UI, git-push deploys and
backups, not zero-downtime**, which you can have without it," and picks the null option
(hand-rolled Traefik + `docker-rollout`).

That reasoning is inverted against criterion #1. For a solo maintainer, *UI, git-push deploys and
backups* **is** the sustainability payload. Zero-downtime deploys are the property that matters
least on a box the research itself describes as having **no real users** and whose dominant load
is bot crawlers [51]. The verdict optimises for theoretical elegance (gapless deploys nobody
observes) over ongoing burden: the precise inversion criterion #1 forbids.

And the null option's bill is not small: hand-rolled Traefik upgrades (near-weekly across three
branches [52]), `docker-rollout` on the deploy critical path with **one release in twelve months**
and a bus factor of one [67], self-built cert-age alerting against a shrinking window
[56], self-scripted backups with no restore-test guidance in existence, and self-interpreted PSI
against no published threshold [72]. Coolify would collapse several of those into a single upgrade
stream and *preserves* the Traefik v3.7 + Cloudflare DNS-01 design [69].

I do not conclude "adopt Coolify." Its **five releases in 3.5 weeks** is a real treadmill and a
real counter-argument, and a Coolify failure has a wider blast radius. But that is the argument
the verdict should be making and losing on, and it isn't: it rejected Coolify for not being
needed for zero-downtime, which is a category error. If the null option wins, it must win on
*total recurring burden*, and that comparison was never run.

**What should change.** Either re-run the comparison on burden, or (better, per attack 5) defer
the entire VPS rebuild until something forces it, at which point the comparison can be made
against a real measurement instead of a projection.

### 9. One shared Postgres couples what schema-per-app was rejected for coupling: STRENGTH: moderate

The research rejects schema-per-app because it "couples Prisma migrations across apps" [61], and
picks one cluster / one database / one role per app. That correctly decouples migrations. It does
**not** decouple: major-version upgrades, `max_connections` tuning, restore blast radius, or
maintenance windows. A `pg_upgrade` now moves every app at once; a bad restore takes down all of
them.

For a solo maintainer this is probably still the right call, one upgrade beats five, and the
`shared_buffers` arithmetic (128 MB pre-committed per instance, ~640 MB for five [61]) is decisive
on a 2 vCPU / 8 GB box. So: **right answer, incompletely reasoned.** The coupling should be stated,
and the per-app `connection_limit` sum rule needs to live somewhere durable: it is inventory item
14 and it will be forgotten around the seventh app.

### 10. Vendored files are outside the propagation mechanism entirely: STRENGTH: moderate

The Phoenix token path is vendoring, and vendoring is Phoenix's own sanctioned pattern: the
v1.8.0 installer commits `daisyui.js` (251,614 bytes) and `daisyui-theme.js` (46,759 bytes),
upgraded via `curl` commands in `app.css` comments [42]. A vendored `tokens.css` is the same
mechanism.

The consequence the verdict does not draw: **Renovate cannot see any of it.** The whole
centralised propagation story has a hole shaped exactly like the Phoenix app, and that hole is
permanent: it is not fixable by better configuration. So the design-system contract is "automated
for the JS cluster, manual for Phoenix," and the manual half will drift first because it is the
half with no PR to nag you.

This is a small, sharp argument for attack 3's conclusion: if one consumer is manual anyway,
hand-copying to all of them is a smaller inconsistency than maintaining two propagation regimes.
There is also an untested prerequisite in the way: whether `@plugin "daisyui/theme"` accepts a
`var()` reference is **undocumented either way** and must be settled in a scratch `mix phx.new`
app before any of this is designed around.

## Attacks that fail

### "Traefik over Caddy is the wrong pick"
It fails, and it fails cleanly. The deciding fact: Caddy's Cloudflare DNS module "does not come
with Caddy" and requires an `xcaddy` rebuild **on every upgrade** [54], versus Traefik doing
DNS-01 through env vars on the stock image [55]: is *itself* a recurring-maintenance argument.
This is one of the few places the document reasons directly on criterion #1. It stands. (The
medium-high confidence caveat should be carried forward, but it does not change the pick.)

### "Subdomains are wrong / path routing would be simpler"
Fails. Subdomains are the incumbent (all four live apps already use them) so the migration cost
is zero, which is unbeatable on criterion #1. The evidence is one-directional (Buttondown's CEO
regretting paths after eight years [60]; no account of anyone regretting subdomains found), and
the research correctly flags that asymmetry as suggestive rather than settled. Confirming the
incumbent is the cheapest possible verdict and it is right.

### "The WSL2 relocation is unjustified churn"
Fails as a *sustainability* attack. The guidance is primary and current (Microsoft Learn, updated
2026-06-02 [22]), the research correctly refuses to quote the circulating "10–20×" figures as
fact, and (decisively for this lens) relocation creates **no recurring obligation**. It is a
one-time cost with a permanent benefit. My only quibble is positional: as step 7 it will never
happen, and it does not depend on steps 1–6. Do it on a wet afternoon or drop it; it is orthogonal
to everything else. (Four of eight relocation sub-items are unevidenced [D4], so budget for
surprises.)

### "Devcontainers are being wrongly deprioritised"
Fails. The verdict is right and for good reasons: the reference CLI is **pre-1.0 after years of
releases** [20], editor support is uneven (VS 2022 is C++/CMake only, IntelliJ early-stage [18]),
implementations diverge on which properties they honour [18], and (most relevant here) **no
primary or corroborated number exists anywhere for the ongoing cost of devcontainers at 6–12
months** against a 100 GB disk. Adding an unmeasurable recurring cost is exactly what criterion
#1 forbids. Correctly deferred.

### "The Next.js merge should be decided now"
Fails. Gating the merge on "whether a shared React component package actually accumulates real
components" is the single best piece of judgement in the verdict: a genuine forcing function tied
to observable evidence, with an explicit null result ("if it never does, the merge buys nothing").
My complaint is that this discipline was applied to exactly one of eight steps.

### "The single VPS is under-provisioned and this will fall over"
Fails on the evidence presented. The research's one hard number: a `next start` process at
639,880 KB RSS and 103.3% CPU, i.e. half a 2-vCPU box [51]: looks alarming until you read the
attached finding that the trigger was **bot crawlers, not humans**, and that Cloudflare filtering
cut it by >90%. With the filter on, capacity is not the binding problem. (Single-source, per
attack 7, but the action is hours of work and instantly reversible, so it is worth doing even at
low confidence. Right answer, weaker reasons than stated.)

## The smallest plan that still delivers a real ecosystem

Ordered. Everything here is finishable, and nothing here creates a recurring obligation without a
signal attached.

**Step 0: Archive (one afternoon).** Three empty projects → GitHub archive. Four trackers → one
survivor, three archived. Target **≤8 active repos, ≤5 deployed subdomains**. This is the only
step that makes every subsequent step cheaper, and it is the highest-ROI hour in the document.

**Step 1: Cloudflare bot filtering on the four live subdomains (hours).** The run's own most
actionable finding. Cheap, reversible, immediately visible in `docker stats`.

**Step 2: Buy an error signal before building anything that can break (30 minutes).** An external
uptime + HTTP-status + certificate-expiry check on the four live subdomains. Not self-hosted, not
PSI, not something you have to maintain. **This is the step the verdict omits and the one that
makes every other step safe**, because it substitutes for the user complaints you will never
receive. It also retires the cert-age alerting obligation before the 64-day and 45-day cliffs
arrive [56].

**Step 3: App registry inside `cuatro-portfolio` (a day).** A checked-in list feeding the hub
page. This is the "suite moment," and it needs **no new repo and no npm**. It also directly
answers the Streamdal discoverability problem [9], which is the strongest surviving pro-unification
argument at N=1.

**Step 4: One `tokens.css`, authored once in `cuatro-portfolio`, copied by hand into the other
three live apps (a day or two).** Plus the generated Tailwind `@theme inline` adapter for the
Next.js cluster [40]. Copy, do not publish. Settle the daisyUI `var()` question in a scratch
`mix phx.new` app first [43]. Re-read Phoenix v1.8.0's `app.css` byte-for-byte before writing the
adapter.

**Step 5: `pg_dump` to offsite on a cron, plus one calendar-forced restore test per year.** The
only ops obligation that has no recovery if skipped. Put the restore test in a calendar, because
nothing else will force it: no published guidance for it exists.

**Then stop, and convert the rest into a trigger-gated list:**

| Deferred | Trigger to revisit |
|---|---|
| npm publishing + Renovate presets + `renovate-config` repo | ≥3 token changes in one quarter *and* hand-copying has actually annoyed you |
| The `cuatro-ecosystem` hub repo | ≥2 genuinely shared artefacts exist that are not the registry |
| VPS greenfield rebuild (Traefik, one Postgres, `docker-rollout`) | measured pressure via `docker stats`/PSI, **or** you want `cs-tournament` off Vercel anyway, and re-run the Coolify-vs-null comparison **on recurring burden** at that moment, not now |
| Supabase → plain Postgres | a project actually hits the 7-day inactivity pause [63] |
| WSL2 relocation | any wet afternoon; independent of everything else |
| Next.js merge | the verdict's existing gate: a shared component package earns itself |
| Renovate automerge | a repo has a real test job **and** the step-2 signal is live |

The test of this plan is that after step 5 you could walk away for six months and nothing rots
except dependency freshness, which is a visible, recoverable, non-silent form of decay.

## Residual risks the recommendation should state openly

1. **No published study exists on solo repository layout.** Every solo conclusion is team evidence
   with team-dependent parts subtracted: an inference method, not evidence. The method
   systematically removes safeguards along with overheads.
2. **No user error signal exists.** With no real users and bot-dominated traffic [51], any silent
   breakage is permanent until noticed by accident. This is the governing risk for the entire plan.
3. **`docker-rollout` is a bus-factor-1 dependency on the deploy critical path**: one release in
   twelve months [67]: proposed to deliver a property (zero-downtime) with no beneficiary.
4. **The Traefik + Cloudflare DNS-01-on-stock-image claim is medium-high confidence**; Cloudflare
   is not named inline on the page read [55]. Verify before the rebuild depends on it.
5. **Compose resource-limit enforcement is uncertified by documentation** [68]: must be settled
   with `docker inspect` (`HostConfig.NanoCpus`, `HostConfig.Memory`).
6. **Every footprint number except the one Next.js datapoint is missing**, and the surviving one,
   plus the >90% bot-filter reduction: is single-source [51], despite the run's stated two-source
   bar for performance claims never being met.
7. **Restore-testing guidance does not exist in the public record.** Whatever procedure is adopted
   is invented, and unverified backups are indistinguishable from no backups.
8. **No published design system serves both a Phoenix/LiveView app and a JS-framework app.** There
   is no precedent to copy for the central design-system ambition.
9. **PSI has no published trouble threshold** [72]; per-container monitoring produces numbers with
   no interpretation attached until you establish your own baseline.
10. **The hub couples 15 repos for failure without coupling them for rollback** [8].
11. **Vendored assets (Phoenix/daisyUI) are permanently outside Renovate's view** [42].
12. **One shared Postgres cluster couples major-version upgrades and restore blast radius** across
    every app: likely the right trade, but a real one.
13. **Four of eight Windows relocation sub-items are unevidenced** [D4], including Docker Compose
    absolute bind mounts, which interacts directly with the deployment work.
14. **Single-source version claims** (daisyUI 5.7.17, Angular 22.1.2) and moon's version is
    contradictory across sources; do not quote any moon version downstream without reading the
    releases page directly [6][7].
