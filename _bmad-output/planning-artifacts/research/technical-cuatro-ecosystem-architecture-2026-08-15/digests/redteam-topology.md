# Red team: deployment topology

Lens: the deployment topology will not survive contact with reality. Every claim below is
grounded in `research.md` (bracketed source numbers are that file's) or in a stated logical
flaw in `provisional-verdict.md`. Where an attack fails, it is reported as failing.

---

## Attacks that land

### 1. The capacity plan is built on a number that says it cannot work, and there is no admission-control gate: STRENGTH: fatal (to "all ~12 on the box, unconditionally")

**The arithmetic.** A 2 vCPU box has **200% of CPU** to sell. The one measured datapoint in
the entire dimension is a single Next.js `next start` at **103.3% CPU** [51]. That is not a
supporting detail: D3 opens by calling it "the whole capacity argument in one datapoint" and
concludes "**CPU is the wall**."

Taken at face value, that number says the box holds **two** saturated Next.js processes and
nothing else. The pick puts on it: four Next.js apps, a BEAM node, Fastify, Python, Go,
Postgres, Traefik, plus the Docker daemon, restic, and the host. Four Next.js apps under the
measured condition demand **412% of a 200% box**: 2× oversubscription from *one app class*,
before anything else is counted.

**The evidentiary inversion.** The research states plainly that the two-source bar was met
**zero times** for BEAM, Fastify, Postgres and proxy footprints, that circulating figures trace
to "AI-generated SEO content farms," and that it therefore "gives none." That is the right
call. But the verdict then proceeds as if the missing numbers were *small* numbers. They are
**unknown** numbers. The claim "RAM fits comfortably and CPU is the wall" is one measured
figure plus seven blanks; the RAM half of it is not evidenced at all. Absence of evidence is
being read as permission.

**The gate that is missing.** The research's own instruction is unambiguous: "Measure on the
actual box: `docker stats` for ten minutes beats any figure available online." The verdict's
sequencing step 5 is "Rebuild the VPS greenfield… migrate apps one subdomain at a time." That
is a *de facto* incremental measurement and is the verdict's best defence. But there is **no
written threshold, no abort criterion, and no pre-committed overflow target**. Migrating one at
a time only helps if something tells you to stop. Nothing does. The plan as written has no
state in which it concludes "app #9 does not fit."

**The amplifier the verdict builds itself.** [51] establishes that the CPU spike's trigger was
**bot crawlers**, and D3 reasons that for a no-users portfolio "bot traffic *is* the dominant
load profile." Crawlers walk link graphs, and they walk registered domains. Sequencing **step 3
adds an app registry to the portfolio hub**: a single public page linking all twelve
subdomains. That step converts twelve independently-discovered apps into one crawlable
fan-out, making *concurrent* multi-app crawl markedly more likely. The verdict's headline
portfolio feature is a direct multiplier on the verdict's binding constraint, and the two are
never connected.

**The deploy-time doubling.** `docker-rollout` works by scaling a service **up** before draining
the old container [67]. On a box already oversubscribed, every deploy transiently requires a
second copy of the largest container: ~640 MB and up to another full core. Zero-downtime
deploys and the capacity ceiling are in direct conflict and neither the research nor the
verdict connects them.

**In fairness:** 103.3% is a *load* measurement under crawl, not an idle footprint, and idle
Next.js is far cheaper. The topology is very likely survivable at idle. But the research's own
framing is that this box's dominant load profile is exactly the condition under which that
number was taken, so the charitable reading does not rescue the plan, it just relocates the
failure to the moment a crawler arrives.

**What should change.** The verdict must add, as a first-class element, an **admission-control
policy**: (a) a per-container PSI/`docker stats` baseline captured *before* migration, (b) a
written stop threshold (e.g. 15-min load > 1.6 on 2 cores, or `cpu.pressure` `avg300` `some`
above a chosen figure sustained), and (c) a **pre-committed overflow target** (Railway) so
that "app N+1 does not fit" has an answer that is already decided rather than improvised. Also:
rank the twelve apps by expected footprint and state the admission order. The plan currently
names neither the apps nor their weights.

---

### 2. Railway is dismissed on arithmetic the research gets wrong, and the four-source lever is ranked last while the one-source lever is ranked first: STRENGTH: serious

**The arithmetic error.** The research states that ~**$61/mo** memory-only for all 12 is "**at
or over your stated ceiling**." The stated budget is **$40–100/mo**. $61 is neither at nor over
$100: it sits comfortably inside the stated range, nearer the floor than the ceiling. The
verdict inherits this mischaracterisation and uses it to relegate Railway to "only in the shape
where it makes sense," a phrase carrying no decision content.

**The sunk-cost frame.** The VPS is prepaid to 2028. Marginal spend today is therefore
approximately **zero** against a budget the user explicitly sized at $40–100/mo. A
recommendation that keeps marginal spend at zero is not satisfying the stated constraint: it
is silently optimising a constraint the user never stated ("spend nothing"). The user asked for
a $40–100/mo solution and is being handed a $0/mo one with a CPU wall.

**Where the conclusion survives, and why that matters.** Railway is $20/vCPU/mo on top of
$10/GB [64]. If Next.js apps genuinely consume near a full core under the measured condition,
twelve apps at even 0.5 vCPU each is ~$120/mo in CPU alone, so "don't put all 12 on Railway"
is probably the **right conclusion for a reason the research never states**, while the reason it
does state is arithmetically wrong. Classification: **(c) right for weak reasons.**

**The inversion that actually lands.** Partial offload of 2–3 apps is priced at **$15–30/mo**,
squarely inside budget. Offloading the **two heaviest Next.js apps** removes up to ~200% of
potential CPU demand from a 200% box: an entire box's worth of headroom, bought for roughly the
price of two coffees, with **primary, four-times-corroborated pricing** [64]. Compare the
verdict's ranked-first capacity move, bot filtering, whose entire basis is **one contested
GitHub thread with no maintainer fix** [51].

> The recommendation sequences the single-source, uncertain lever **first** and the
> four-source, certain lever **last**. That ordering is backwards on evidence quality and
> backwards on effect size.

**What should change.** Move 2–3 named apps to Railway **permanently and from day one**, not
conditionally. Frame the single box as the *default* tier with a *standing* overflow tier, and
re-evaluate inward (pull apps back if the box proves roomier than feared) rather than outward
under duress. Delete "at or over your stated ceiling."

---

### 3. `next build` is the research's own top unmeasured risk and the recommendation is silent (and `docker-rollout` structurally presupposes the answer) STRENGTH: serious

The research names it explicitly: "**Top unmeasured risk: running `next build` on the box while
serving from it.**" The verdict does not mention builds anywhere, not in the deployment
paragraph, not in the eight-step sequencing. The single loudest warning the dimension produced
gets no response.

**Why the silence is worse than an omission.** The verdict picks `docker-rollout`, whose
mechanism is to start a **new container from an image** and drain the old one [67]. That
presupposes a prebuilt image. So the pick has already implicitly committed to image-based
deploys without saying where images are built. If they are built on the box, the deploy moment
becomes: `next build` (CPU-hungry, on 2 cores) **plus** the old container still serving
**plus** the new container starting **plus** Traefik **plus** Postgres, three-way contention on
a box that attack #1 shows is already oversubscribed. Four Next.js apps rebuilding on that box
is not a tuning problem, it is a deploy story that does not close.

**The fix is already in the design and simply unconnected.** The hub repo `cuatro-ecosystem`
is specified as owning "**reusable GitHub Actions workflows**." Build in CI, push to GHCR, `docker
pull` on the box, `docker-rollout` swaps. Zero new machinery, zero new services, and it removes
the entire build load from the constrained host. That this is not stated is the clearest
gap-to-recommendation mismatch in the document.

**Adjacent unpriced item:** 100 GB disk must now hold ~12 apps' image layers (Next.js images are
not small), retained previous tags for rollback, Postgres data, restic cache and `pg_dump`
staging. The research flags disk gaps elsewhere (devcontainer footprint, Docker Desktop VHDX)
but never sizes VPS disk for a 12-app image cache. Not evidenced either way: flagged as an
unpriced item, not asserted as a failure.

**What should change.** Add an explicit build-and-ship stanza: images built in GitHub Actions,
pushed to GHCR, pulled on the box, with a stated image-retention policy. Never `next build` on
the VPS.

---

### 4. The "null option" is scored on one axis and probably loses the criterion it was chosen to win: STRENGTH: serious

The research states, correctly, that "**A self-hosted PaaS's real value here is UI, git-push
deploys and backups, not zero-downtime**." It then declares the null option "strong" on the
basis that `docker-rollout` + own Traefik "delivers the same zero-downtime property."

That is a comparison **scoped to the single axis on which the null option wins**, and it is the
axis the same sentence just called low-value. On the three axes the research identifies as the
PaaS's *actual* value, the null option's ledger is:

| Axis | PaaS | Null option as picked |
|---|---|---|
| Git-push deploys | built in | hand-built GH Actions the hub must author and maintain |
| Backups | built in | hand-rolled `pg_dump` + restic, restore path untested |
| UI / visibility | built in | `docker stats`, PSI files, nothing surfaced |

The requester's **#1 ranked criterion is solo-maintainer sustainability**. The null option's
total maintenance ledger is plausibly *higher* than Coolify's, and the research never totals it
it wins the argument on the axis that does not matter and declares the matter closed.

**Coolify was rejected for a reason that has an obvious unexamined answer.** The stated
principal risk is cadence: "five releases in 3.5 weeks is a treadmill for a solo operator."
But release cadence is only a treadmill if you ride it. **Pinning a version and upgrading
quarterly** is never considered. And Coolify uniquely *preserves* the Traefik v3.7 + Cloudflare
DNS-01 design [69], so it is the one PaaS whose adoption does not discard the rest of the pick.

**Fairness:** Coolify adds its own unmeasured footprint to a CPU-starved box, which, per attack
#1, is a real cost the research cannot price. That is a legitimate reason for hesitation. It is
not the reason given.

**What should change.** Either total the maintenance ledger honestly across all three axes and
show the null option winning, or reconsider Coolify-pinned. If the null option stands, the
verdict must explicitly own the git-push and backup work as *deliverables of this plan*, not
assume them.

---

### 5. Postgres consolidation is justified by a tunable default, in the resource the research says is not scarce, while the real couplings go unstated: STRENGTH: serious

**The stated rationale collapses under its own source.** The argument is that each additional
instance "pre-commits its own `shared_buffers`: 128 MB by default, so five containers reserve
roughly 640 MB" [61]. But `shared_buffers` is a **configuration parameter**, documented as such
on the very page cited (`runtime-config-resource.html`). The 128 MB is a default, not a floor.
Five containers at `shared_buffers=32MB` reserve 160 MB: noise on 8 GB. **The entire memory
argument evaporates under a one-line config change documented by the recommendation's own
primary source.**

**And it optimises the wrong resource.** D3's headline is "**RAM fits comfortably and CPU is the
wall.**" The consolidation is then justified by saving **640 MB of RAM**: a resource the same
section declares non-scarce, while doing nothing for CPU. Worse, one shared cluster means one
contention pool: a runaway query in any of the twelve apps competes for the same two cores as
all eleven others, and evicts their pages from the shared buffer cache. The rationale is
internally inconsistent with the section's own binding constraint.

**The coupling it rejected is smaller than the coupling it accepted.** Schema-per-app is
rejected because it "couples Prisma migrations across apps." Fair, and database-per-app does
genuinely fix that (separate `DATABASE_URL`, separate `_prisma_migrations` per database). But
the couplings that remain in a single cluster are *larger and permanent*:

- **`max_connections` is cluster-wide.** The research acknowledges this as arithmetic ("keep the
  sum under `max_connections`") without recognising it as coupling. One app's connection leak
  starves all twelve.
- **Major-version upgrades are cluster-wide.** You cannot upgrade Postgres for one app. All
  twelve must be simultaneously compatible, forever. Migration coupling was solvable; this is
  not.
- **Blast radius.** One container failing takes down all twelve apps. The verdict never states
  this.

**The backup story does not cover the consolidation it enables.** `pg_dump` + restic offsite is
defensible at this scale and the research is right that "no official source says dump-only is
inadequate at this scale." But the research also records: "**Restore-testing guidance was
searched for and not found: the researcher declined to invent it.**" The verdict adopts the
backup design and inherits the gap silently. Consolidation *multiplies* the cost of an
unverified restore path: it is now twelve apps' data riding on one never-exercised procedure,
for a single operator with nobody to page.

To be fair: absence of published restore *guidance* is not evidence that `pg_dump`/`pg_restore`
is unreliable: it is among the most trodden paths in the ecosystem. The honest form of this
attack is that the recommendation should **schedule a restore drill as an explicit deliverable**,
not that the backup choice is wrong.

**Classification: (c) right for weak reasons.** Consolidation is probably correct, for
*operational* reasons (one thing to back up, monitor, upgrade, which serves criterion #1), but
the reason given is the one that does not survive.

**What should change.** Restate the rationale as operational, not memory-based. Set
`shared_buffers` explicitly rather than inheriting a default the argument depends on. State the
blast radius and the permanent cluster-upgrade coupling openly. Add "restore one database from
restic to a scratch container" as a dated deliverable, not an assumption.

---

### 6. Bot filtering is a duty-cycle fix sold as a capacity fix, on a single contested source, and it is in tension with criterion #2: STRENGTH: serious

**The evidentiary double standard.** This run refused to publish a proxy RAM number because the
available sources were content farms, and flagged a web-components claim as "*Single-source;
below this run's two-source bar*." It then makes "**the most actionable finding of this entire
run**" out of **one GitHub discussion** [51]: described in D2's own vocabulary elsewhere as
"reported-and-unfixed, not vendor-acknowledged", and the verdict promotes it to **sequencing
step 1** and "the cheapest capacity win available." The single-source caveat that is applied
scrupulously elsewhere is not applied here.

**The category error.** Even taking the finding at face value: bot filtering reduces the
**frequency** of the load, not its **amplitude**. The 103.3% figure is what one Next.js process
costs *when serving*. Filtering removes requests; it does not make a served request cheaper. So
the box's ceiling (two saturated Next.js processes) is **unchanged** by bot filtering. What
changes is how often you approach it. That is a genuinely valuable risk reduction, and it is
*not* capacity. Calling it "the cheapest capacity win" conflates duty cycle with headroom and
invites exactly the mistake attack #1 identifies: treating a probability reduction as a budget
line that permits admitting more apps.

**Unspecified metric.** "Cloudflare filtering cut it by over 90%": cut *what*? Bot request
volume, or CPU? The research does not say, and the two are not interchangeable.

**The conflict with the #2 criterion.** The requester's second-ranked criterion is **portfolio
value**. A portfolio exists to be found: by search engines, and increasingly by AI crawlers
that route recruiters and collaborators. Sequencing step 1 is to reduce crawler traffic by
90%+ across the four live subdomains. Cloudflare distinguishes verified bots from unverified
ones, so this is entirely mitigable, but the verdict says nothing about the distinction, and a
naive "turn on bot fighting mode" is a direct hit on the second-ranked criterion in service of
the fifth (future headroom).

**What should change.** Reframe as: verified-crawler allowlist (Googlebot, Bingbot, and the AI
crawlers you want indexing you) + challenge/block for the unverified tail. Capture `docker stats`
CPU before and after so the "90%" becomes a number *from your box*, satisfying the research's own
instruction. And stop describing it as capacity: it is variance reduction, and it must not be
spent as headroom in the admission-control policy from attack #1.

---

### 7. Two monitoring needs are named as mandatory; zero mechanisms are specified: STRENGTH: moderate

The research says of shortening certificate lifetimes (90 → 64 days Feb 2027 → 45 days Feb
2028): "the window between 'renewal silently broke' and 'site down' halves, then halves again.
**Alerting on certificate *age* stops being optional.**" [56]

The verdict specifies Traefik, Cloudflare DNS-01, and: nothing. No alerting mechanism, no
destination, no threshold. The same is true of the other monitoring item it *does* name: "PSI
per-container monitoring on cgroup v2" is listed with no collector, no threshold and no alert
destination. For a solo operator, an unread file under `/sys/fs/cgroup/` is not monitoring; it
is a forensic tool for after the outage. **The pick names two monitoring requirements and
specifies zero mechanisms for either.**

**The inversion that makes this bite.** "No real users" is used throughout to relax
requirements. For this risk it does the opposite: with no users, **there is no one to report
the outage**. Absent users are absent monitoring. A silently-broken renewal on a portfolio is
discovered by the recruiter who hits the interstitial: the single worst possible detector.

**The option that was surfaced and then dropped.** The research raises Cloudflare Origin CA as
sitting "**outside the shortening public-CA treadmill entirely**" for proxied origins [57], and
establishes elsewhere that the live subdomains are proxied ("safe behind the orange cloud"). On
criterion #1 that is the maintenance-minimising choice, and it received no evaluation in the
verdict. It is genuinely a trade, not a free win: Origin CA hard-couples you to Cloudflare
staying in front, breaks direct-to-origin and grey-cloud debugging, and the research notes its
validity periods "were not documented on the page read." It deserved a paragraph and got none.

**What should change.** (a) Name a TLS-expiry alert mechanism with a destination that reaches a
phone. (b) Obtain a **single wildcard `*.cuatro.dev`** via DNS-01: the research already notes
wildcards eliminate per-subdomain certificate cost, reducing the renewal surface from twelve
failure points to one; carry that into the deployment paragraph, where it currently is not.
(c) Evaluate Origin CA explicitly and record the reason for rejecting it. (d) Give PSI a
collector and a threshold or drop it from the pick as decoration.

---

### 8. The cadence-as-burden test is applied to Coolify and not to Traefik: STRENGTH: moderate

Coolify is downgraded because "five releases in 3.5 weeks is a treadmill for a solo operator
whose ranked top criterion is maintenance burden." Traefik is selected while the same research
records "**near-weekly point releases across three branches**"; Caddy ships roughly monthly [52].
Applied consistently, the heuristic that sank Coolify counts *against* Traefik and *for* Caddy.

There is a real distinction available: a PaaS pushes upgrades on you while a proxy's point
releases are opt-in, but the research never draws it; it simply does not run the test on its
own pick. Additionally, the fact that decides the proxy is self-flagged as "*Medium-high
confidence: Cloudflare is not named inline on the page read*" [55]. The load-bearing fact in
the proxy decision is explicitly not fully verified, and the alternative's disqualifier (xcaddy
rebuild for the Cloudflare DNS module [54]) partly evaporates if Origin CA or a
manually-obtained wildcard removes the DNS-01 dependency.

**What should change.** State the opt-in-vs-pushed distinction that rescues Traefik, and re-verify
[55] before building on it. The conclusion is probably right; the reasoning is inconsistent.

---

### 9. The migration plan implies hours of downtime while the same paragraph adopts a tool for seconds of it: STRENGTH: moderate

Sequencing step 5: "**Rebuild the VPS greenfield** on Traefik + one Postgres; migrate apps one
subdomain at a time," with four apps live today. A greenfield rebuild of the only box means
either (a) real downtime across the live four during cutover, or (b) a second box for the
duration: an unstated cost. Meanwhile the same pick adopts `docker-rollout` to eliminate a few
seconds of connection loss on apps with **no real users**.

The priorities are inverted relative to each other: the plan tolerates the large, certain outage
and engineers away the small, hypothetical one. Wiping the VPS is stated as acceptable in the
context, so this is not fatal, but the internal inconsistency exposes that zero-downtime was
adopted as a default good rather than as a reasoned requirement.

**What should change.** Either state the migration downtime budget openly and accept it, or
price the temporary second box. And defer `docker-rollout` (see below).

---

## Attacks that fail

### `docker-rollout` is abandonware and a maintenance liability

This was the assigned lens and it does not hold up. One release in twelve months is a weak
signal for a **~200-line MIT bash wrapper** around the Compose CLI: low release frequency on a
small, feature-complete script is evidence of *doneness*, not abandonment. Decisively, it is
MIT-licensed and vendorable: copy it into `cuatro-ecosystem`, and upstream cadence becomes
irrelevant because there is no upstream dependency. For a solo operator, a small readable script
you own is close to the ideal shape. The research also establishes that its two constraints (no
`container_name`, no published `ports`) are **already satisfied** by the Traefik design [67], so
adoption cost is genuinely near zero.

**What survives is a different, weaker objection**, which I record rather than inflate: the pick
is *premature* against criterion #4 (incremental adoption), and its real unpriced cost is not the
tool but its prerequisite: `docker-rollout` "requires real healthchecks" [67], meaning **twelve
meaningful health endpoints across six frameworks and five backend languages**, each of which
must actually detect brokenness or rollout will happily swap in a dead container. That cost is
stated in the research as a requirement and never priced. Recommendation: ship plain
`compose up` first, add rollout once healthchecks exist for their own sake, and vendor the
script when you do.

### Subdomains over paths

The research flags its own weakness here honestly ("only one search was run" for
regret-subdomains). But the attack still fails: subdomains are the **incumbent** (zero migration
cost), the wildcard certificate removes the usual objection, and the Buttondown evidence [60] is
eight-years-in and concrete: a shared browser origin means cookies, `localStorage` and XSS
blast radius cross every app. For a portfolio explicitly planning `Domain=.cuatro.dev` SSO
cookies, the origin-isolation argument is *stronger* here than in the cited case, not weaker.
Confirming the incumbent at zero cost on good evidence is a sound outcome.

### Supabase → plain Postgres

Nothing to attack. Self-hosting needs "10+ containers and 8 GB of RAM for itself alone" [62],
the entire box. The free tier "pauses after 7 days of inactivity" [63], which is precisely a
low-traffic portfolio's steady state. And the verdict's hedge: "unless auth/realtime is
genuinely used": is the correct conditional, since migrating off Supabase Auth is the one
expensive case. Well-evidenced and appropriately qualified.

### Database-per-app does not decouple Prisma migrations

I was asked to press this and it does not land. Separate databases give each app its own
`DATABASE_URL` and its own `_prisma_migrations` table; migration histories are genuinely
independent in a way schema-per-app does not achieve. The stated mechanism works. The attack on
the *consolidation* has to be made on other grounds: memory rationale, blast radius, and
cluster-upgrade coupling, which is where attack #5 puts it.

### "RAM fits comfortably" is unevidenced

The *epistemics* are bad (one measured figure, seven blanks) and I fold that into attack #1.
But the *conclusion* is likely correct: four Next.js at ~640 MB is ~2.5 GB, leaving ~5 GB for
everything else on an 8 GB box. This is right for weak reasons rather than wrong, and inflating
it into a standalone attack would be manufacturing an objection.

---

## What I would recommend instead, if anything

The single-box story is not wrong. **Unconditional** single-box is. Six changes:

1. **Add admission control.** Baseline every app with `docker stats` / per-container PSI before
   migrating it. Write down a stop threshold. Pre-commit Railway as the overflow tier so
   "it doesn't fit" has a decided answer.
2. **Offload two or three named heavy apps to Railway from day one**: $15–30/mo, inside a
   $40–100/mo budget currently spending ~$0. This is the highest capacity-per-dollar move
   available and rests on the best-sourced pricing in the run. Re-evaluate *inward*.
3. **Build in CI, never on the box.** Images in GitHub Actions → GHCR → `docker pull` → rollout.
   The hub already owns reusable workflows; connect them. State an image-retention policy
   against the 100 GB disk.
4. **Demote bot filtering from capacity to variance reduction**, implement it as a
   verified-crawler allowlist plus challenge for the tail (protecting criterion #2), and measure
   CPU before/after on your own box so the 90% stops being someone else's number.
5. **Specify alerting, once, for everything.** One wildcard `*.cuatro.dev` cert, one TLS-expiry
   alert that reaches a phone, one PSI threshold with a collector. Record why Origin CA was or
   was not taken.
6. **Restate the Postgres rationale as operational, not memory-based**; set `shared_buffers`
   explicitly; state the blast radius; schedule one restore drill as a dated deliverable.

Defer `docker-rollout` until healthchecks exist; vendor it when adopted. Reconsider
Coolify-pinned only if the null option's full maintenance ledger: git-push deploys and backups
included: is honestly totalled and still wins.

---

## Residual risks the recommendation should state openly

- **Every footprint except one Next.js process is unmeasured.** BEAM, Fastify, Python, Go,
  Postgres and Traefik idle and loaded costs are unknown, deliberately, because the only
  available sources were content farms. The topology is a hypothesis until `docker stats` runs.
- **The one measured number is a load figure under bot crawl**, from a single contested source
  with no maintainer fix. Both the capacity ceiling and the capacity remedy trace to the same
  unreplicated thread.
- **The portfolio hub's app registry increases correlated crawl across all twelve subdomains.**
  The flagship feature and the binding constraint point the same direction.
- **`next build` on the box is untested and unaddressed.** Until builds move to CI, deploy is
  the highest-risk moment on the box.
- **One Postgres means all twelve apps share a failure domain, a `max_connections` pool, a CPU
  contention pool, and a permanent major-version upgrade schedule.**
- **The restore path is untested and no published restore-testing guidance was found.** Backups
  that have never been restored are an assumption, not a control.
- **Certificate lifetimes halve twice on a known calendar (Feb 2027, Feb 2028)** and the pick
  currently contains no alerting mechanism. With no users, nothing will report the outage.
- **Compose resource-limit enforcement outside Swarm is uncertified by documentation.** The
  `cpus:` / `mem_limit:` caps the plan relies on to contain a runaway app must be verified via
  `docker inspect` before they are trusted as a control.
- **The greenfield rebuild implies real downtime on four live subdomains**, or an unpriced
  second box for the cutover window.
- **VPS disk is unsized** against twelve apps' image layers, retained rollback tags, Postgres
  data, restic cache and `pg_dump` staging on 100 GB.
