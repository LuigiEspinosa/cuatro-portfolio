# Red team: source layout

Scope: the source-layout pick only (Option 3, hub + federated satellites). D3/D4 are touched
only where they bear on layout. Every claim below is traced to `research.md` line content or
is flagged as a logical objection to the verdict's own structure.

**Overall position:** the pick is not demonstrably *wrong*, but it is **under-justified to the
point that the stated justification does not survive contact with the research's own D1
section**. Two sub-decisions inside the pick: the hub as a *separate 16th repo*, and the
deferral of Option 4: I do argue are **wrong**, not merely under-argued.

---

## Attacks that land

### 1. The "finding that decides it" decides a different question, and the research's own re-evaluation triggers fire against the pick on day one: STRENGTH: fatal (to the justification)

This is the attack that actually lands, and it is entirely internal to `research.md`.

D1 is architected around a heading: *"The finding that decides it: no orchestrator covers
this language set"*: and the evidence under it is solid: Turborepo is JS/TS by product
decision [1][16]; Nx has no Go/Elixir/Solidity in shipped or planned [2]; Pants misses the
majority of the estate from the other side [3]; moon has Go stable but Elixir and Solidity
absent entirely [6]; no Bazel Elixir ruleset [5]; Bazel itself is priced out by the Kubernetes
off-ramp [4]. The convergent negative finding is real and well-made.

But look at what it establishes. It establishes that **a monorepo here would be
un-accelerated**. It does not establish that a monorepo here would be **worse than fifteen
repos**. Those are different propositions, and the research silently substitutes the first for
the second at the exact point where the decision is made.

The absence of a *bonus* is not the presence of a *cost*. Strip the orchestrator away and a
monorepo is a directory tree under one `git` history with one issue tracker and one CI
trigger surface, which is precisely what D4 says in another context: "Repository layout
answers *where code lives relative to other code*: colocation, atomic commits, one dependency
graph, one CI trigger surface." Not one of those four properties is delivered by Turborepo. All
four are delivered by `mkdir`. The research proves you cannot get *cache-aware task graphs*
across Elixir and Solidity. Nobody was asking for cache-aware task graphs across Elixir and
Solidity. The requester asked for a suite.

And the research knows it cannot price the monorepo downside, because it says so: **"No
measured CI fan-out numbers for a polyglot monorepo exist in any source retrieved."** So the
one genuine cost that survives the no-orchestrator finding: every push triggering work for
unrelated projects: is *explicitly unevidenced in this run*. The decisive finding removes an
upside; the corresponding downside is admitted to be unmeasured. That is not a decision, it is
a tie that was scored as a win.

Now the part that turns this from "weak reasoning" into fatal. D1 closes with **"Documented
re-evaluation triggers"** and lists four, noting pointedly that none is performance:

1. cross-repo change ceremony [8]
2. dependency version-chain unmanageability [11]
3. needing a public/private split within one repo [11]
4. a flagship repo that looks stale to its audience [9]

Trigger 3 is a monorepo→split trigger. **Triggers 1, 2 and 4 are polyrepo→monorepo triggers,
and all three describe the state the recommendation ships you into.** Worse, the recommendation
*manufactures* trigger 1 and trigger 2 where they did not previously exist: before the hub,
there was no cross-repo change ceremony because there was nothing shared; after the hub there
is a published npm package, a SHA-pinned reusable workflow, and a Renovate preset, each of
which is a version chain across fifteen consumers. Trigger 4 (Streamdal) is attack 2 below.

So D1 documented three conditions under which you should abandon the chosen option, then chose
it, then designed a mechanism that induces two of them. The verdict never reconciles this. It
never even scores Option 3 against the trigger list it just wrote.

**What the recommendation should change:** either (a) score all three options explicitly against
the four documented triggers and show Option 3 winning, or (b) demote the no-orchestrator
finding from "the finding that decides it" to "the finding that rules out orchestrator-driven
monorepo tooling", and re-run the layout decision on the criteria that actually bind,
portfolio value, liveness, and cross-cutting change cost. As written, the headline finding is
load-bearing for a conclusion it cannot bear.

---

### 2. Criterion #2 (portfolio value) was never scored, and the one evidenced mechanism for it was replaced by an unevidenced substitute: STRENGTH: serious

D1 does something unusual and good: it discounts *both* sides of the standard literature as
team-shaped (Proton's benefits are all coordination-between-people [8]; Ken Muse's costs are
merge queues, access boundaries and notification fan-out [12]), then asks what survives at N=1.
Three rows survive. The research itself names row three as decisive: **"That third row is the
strongest surviving pro-monorepo argument, and it is the one that maps onto this decision"**,
project liveness and audience navigation signal [9]. It goes further: *"For a public portfolio
of 15 projects, that is not a side benefit: it is close to the point."*

The requester's ranked criterion #2 is portfolio value.

So: the research isolates one surviving argument, states that it maps onto this decision, states
it is close to the point, and then the verdict picks the option that scores *worst* on it,
without a sentence explaining the trade. That is the shape of an evasion, not a judgement.

The substitute offered is "the app registry that feeds the portfolio hub", and the sequencing
document calls step 3 **"the visible 'suite' moment."** Two problems.

**(a) It solves a different surface than the one Streamdal fixed.** Streamdal's symptoms were
*on GitHub*: the flagship repo read "Last updated: 6 months ago", and the language bar showed
only shell and markdown [9]. A registry page on `cuatro.dev` does not touch `github.com/<user>`.
Anyone assessing a developer portfolio (the audience criterion #2 exists for) opens the
GitHub profile, and will see fifteen repos each advertising its own staleness, exactly as
before. The registry is a second front door, not a fix to the first one. There is **zero
evidence anywhere in `research.md`** that a registry page produces the liveness signal; the
only evidence on liveness is [9], and [9] is about repository surfaces.

**(b) The hub reproduces Streamdal's precise symptom in the new flagship.** `cuatro-ecosystem`
owns design tokens, Actions workflows, a registry manifest, and Compose/Traefik fragments. Its
GitHub language bar will read JSON, YAML and CSS. That is Streamdal's "only shell and markdown"
complaint, recreated deliberately, in the repo the architecture nominates as the centre of the
estate. Meanwhile the single strongest *portfolio* asset this developer has, six frontend
frameworks and five backend languages, which the brief says he explicitly values: is the one
thing a merged repo would render as a single visible artefact: a language bar showing
TypeScript, Go, Python, Elixir and Solidity at once. The research's own evidence says the
language bar is a perceived signal [9]. Option 3 is the only option that guarantees it is never
displayed.

**Honest discount.** Half of Streamdal's driver does not transfer: "users could not tell which
repo to file a bug against" presupposes users, and the brief states there are none. The
staleness half transfers cleanly; the navigation half is weaker here. And [9] is single-source,
and its own author calls monorepos "mostly terrible" [9]: the research is right to flag that
as the strongest anti-hype signal available. So this attack does not force the flip on its own.
It does establish that **criterion #2 was not scored at all**, which for the second-ranked
criterion is a defect the verdict must repair before it can be accepted.

**What should change:** the verdict must contain an explicit paragraph reading roughly "Option 3
loses on criterion #2 relative to a merge, and here is why we accept that loss", or it must
change the pick. Silence is not available.

---

### 3. Option 4 was deferred on a gate that the deferral itself prevents from ever opening: STRENGTH: serious

The verdict: *"Option 4 (merge the four Next.js apps) is deferred, not rejected, gated on
whether a shared React component package actually accumulates real components."*

This is circular, and the research supplies the proof of the circularity.

Once the apps are in separate repos, the *only* documented mechanism for sharing a component
between them is the one D2 assembles: publish to npmjs.com, consume via Renovate, and version
under **"deprecate → migrate → remove"** because there are no atomic commits [50]. D2 states the
semantics plainly: a rename is a **major** bump. So the cost of adding one shared component is:
write it, cut a release, wait for Renovate's ~2h settle window and green CI across consumers,
and accept that any subsequent API change to it is a migration campaign. Inside one repo the
same act is: move the file, fix the imports, one commit.

That friction differential is not incidental: it is the entire subject of D2's "Propagating a
change across 15 repos without atomic commits" section. A package facing that tax **will not
accumulate**. The gate therefore never trips, the deferral is permanent, and "deferred, not
rejected" is functionally "rejected without argument." The verdict compounds this by describing
the package itself as optional: *"Optionally one React-only component package scoped to the
Next.js cluster."* An optional artefact is being used as the trigger condition for a structural
decision.

Two aggravating facts:

- **The decisive D1 finding does not apply to Option 4 at all.** Four Next.js apps are exactly
  the JS/TS estate Turborepo scopes itself to [1] and Nx serves natively [2]. The
  no-orchestrator argument (the thing the verdict says decides the layout) is silent here.
  Option 4 was deferred on a *different*, circular gate, and the verdict does not note that its
  own headline objection is inapplicable to the sub-option it deferred.
- **D1 prices reversibility at "roughly one focused week" and warns it is "expensive enough not
  to do twice"** [8][9]. That argues for deciding once, now, with the estate at its smallest,
  not for a wait-and-see whose observation window is corrupted by the choice being observed.

**What should change:** decide Option 4 on its merits now, or replace the gate with one that can
actually fire independently of the layout: e.g. "if I copy-paste the same React component into
a second Next.js app, merge," which is observable under either layout. Classification: this
sub-decision is **wrong**, not merely under-justified.

---

### 4. The hub's real cost is a permanent version-chain tax, and the research already names version chains as one of the three things that still bites a solo maintainer: STRENGTH: serious

The blunt form of this objection ("you created a 16th repo to fix having 15") fails on its own
see *Attacks that fail*. The version-chain form lands.

Row 2 of the "survives at N=1" table: **"Dependency version-chain coordination, Losoviz,
working *alone* across ~200 packages, was defeated by version-of-a-version chains, not by
people"** [11]. The research placed that row there because it is one of exactly three costs it
believes still binds a single developer. The recommendation then constructs one:

- `@scope/tokens` on npmjs.com → 15 consumers, governed by deprecate → migrate → remove [50]
- a reusable workflow in the hub → 15 caller stubs, where GitHub's own guidance calls SHA
  pinning "the safest option for stability and security" [13]
- a `renovate-config` preset repo → resolved via `github>owner/repo`, pinnable by tag `#1.2.3`
  [47]

Note the third bullet: D2's mechanism puts the preset in **a separate `renovate-config` repo**,
while the verdict says the hub owns it. If both are true the estate is 17 repos, not 16; if the
verdict means to collapse them, it should say so, because D2's `extends` string names a distinct
repo.

Three further frictions the verdict does not price:

- **"Two frozen files" is not accurate for the workflow stub.** A SHA-pinned `uses:` is by
  definition not frozen: it must be bumped on every hub workflow change. Either it is pinned
  (and churns) or it tracks a branch (and abandons the security posture GitHub recommends [13]).
  Renovate can automate the bump, which mitigates but does not eliminate: it converts a manual
  edit into fifteen PRs that must go green.
- **D1's escape hatch was refuted by D2 and the verdict inherited the optimism.** D1: "Organization
  rulesets could remove even the stub but appear to be Enterprise-gated: medium confidence" [13].
  D2, later and more definite: rulesets "govern branch and push *protection*, not file content"
  and are **not** Enterprise-gated [49]. So the correct finding is not "gated behind Enterprise",
  it is "rulesets cannot do this at all." The stub is permanent. `research.md` contains both
  statements and never reconciles them; the verdict does not mention either.
- **Template repos are dead on arrival for maintenance**: "branches created from a template have
  unrelated histories", no propagation documented [49]. So repo #16 can be scaffolded from a
  template exactly once and then diverges forever.

Net: the hub carries its own CI, its own npm publish with 2FA, its own semver discipline where a
token rename is a breaking change requiring a migration window, and a dependency on Style
Dictionary's roughly-monthly cadence (5.5.1 already carries a prototype-pollution fix that must
not be pinned below [38]). None of that exists in a merged layout, where a token rename is a
find-and-replace in one commit.

**Honest discount, stated plainly:** Losoviz was defeated at ~200 packages with deep transitive
chains. This estate has one or two shared packages at depth 1, and Renovate's preset mechanism
[47] is a genuine and well-evidenced mitigation the 2021 source did not have. The magnitude gap
is large. This is a real tax, correctly identified by the research's own framework, at maybe a
tenth of the severity of the cited case. Serious, not fatal.

**What should change:** the verdict should state the hub's standing cost in one honest sentence,
"one npm package with semver obligations, one preset repo, and 30 files that Renovate keeps in
sync but that no mechanism can remove", rather than presenting the residue as two frozen files.

---

### 5. "Suite" is being delivered as a coat of paint, and the research half-admits it: STRENGTH: moderate

The requester asked for something in the spirit of Google Workspace or Adobe Creative Cloud. What
ships is: identical colors, type, spacing, radii and motion, plus a registry page listing fifteen
apps.

D2's evidence for tokens-only is genuinely strong and I do not attack it (see below). But it
concedes the ceiling: **"Tokens federate everything that is a *value*. Nothing federates a
*behaviour*."** And the "holds/drifts" table's right column is explicitly labelled **inference
from structural evidence**, with the admission that **"No first-hand retrospective quantifying
where token-only coherence breaks was found in three rounds of searching."** So the load-bearing
claim (*"For a portfolio suite, that is an acceptable ceiling) visitors perceive palette, type
and rhythm, not focus-trap semantics"*: is an unevidenced assertion about audience perception
sitting directly under criterion #3.

Where this becomes a *layout* attack: the token layer is the only thing delivering visual
coherence, and **the token layer is completely indifferent to source layout.** Style Dictionary
emitting `tokens.css` and `tailwind.css` works identically from a directory in a merged repo, a
directory in `cuatro-portfolio`, or a dedicated hub. So D2 provides **no support whatsoever** for
Option 3, yet the hub is justified largely by owning tokens. Strip that out and the hub's
remaining justification is reusable workflows (which [13] shows work cross-repo from *any* repo,
including a merged one) and the registry (a JSON file).

**Conclusion:** the "suite" outcome is layout-invariant. Anything that claims Option 3 delivers
the suite is claiming credit that belongs to Style Dictionary. This does not prove Option 3 wrong;
it removes it from the credit line. Category: **the recommendation may be right but this part of
the reasoning is weak.**

---

## Attacks that fail

### "A 16th repo to solve a problem caused by 15 is self-defeating"

As a counting argument, this fails, and I want to be explicit that I tried it and it does not
work. `research.md` shows repo *count* is not a cost driver anywhere in the evidence. Git-scale
pain is commit-count, ref-count and history-depth driven: Grab needed 214 GB, ~13M commits and
12.2M refs before clone time reached 7.9 minutes, and 99.9% of the remediation came from deleting
commits and refs [10]. None of the four documented re-evaluation triggers is repo count. Fifteen
versus sixteen repositories is a rounding error on every axis the research measured. The hub's
cost is real but it is *sync tax*, not *repo count*: which is why I argued it that way in attack
4 instead.

### "The deployment topology proves the layout wrong"

Fails cleanly. D3's binding constraint is CPU, evidenced by one Next.js process at 639,880 KB RSS
and 103.3% CPU [51], with bot traffic as the trigger and Cloudflare filtering cutting it 90%+.
None of that is affected by where source code lives. Layout and deployment are genuinely
orthogonal here, and the research never conflates them. No attack available.

### "The design-system verdict (tokens only) is wrong, so the layout built on it is wrong"

Fails. D2 is the best-evidenced section in the file and its argument is behavioural and
convergent, not speculative: Google defunded Material Web into maintenance mode 2024-06-10 [28];
GitHub put `primer/view_components` into maintenance mode in Feb 2026 citing the move to React,
resolving the server-rendered-plus-JS-framework problem *by deletion* [32]; Adobe pays for
duplicate implementations on purpose with no consolidation plan [29]; Carbon's Angular/Vue/Svelte
support is community, not core [30]; and Primer ships tokens and only tokens across its three
implementations [33]. The SSR seam is correctly identified as unfixed: `@lit-labs/ssr` pre-1.0
[36] and React declining to hydrate `<template shadowrootmode>`, corroborated across two issues
[35]. I can find no purchase here. Tokens-only is right.

### "It should have picked an orchestrator / Bazel and gone monorepo properly"

Fails. Bazel is the only tool that spans the languages and the Kubernetes off-ramp is decisive
against it for a solo maintainer: build-infrastructure complexity, onboarding friction,
contribution barriers, maintenance burden, from a project with vastly more capacity than one
person [4]. Authoring a moon WASM toolchain plugin for Elixir is a Rust/WASM development project,
correctly priced as such [6]. My attack 1 is that the monorepo should be considered *without* an
orchestrator, not that an orchestrator should be adopted.

---

## What I would recommend instead, if anything

I am not confident enough in the evidence to demand "merge all fifteen", and I want to be honest
that the reason is stated in the research itself: **"There is zero published study on solo or
very-small-maintainer repository layout."** Nobody, including me, can cite a study here. But three
concrete changes follow from the attacks above, in descending confidence:

1. **Kill the 16th repo. Make `cuatro-portfolio` the hub.** It already exists, it is already the
   audience-facing flagship, and the registry already feeds it. Publish `@scope/tokens` from a
   `packages/tokens` directory inside it; host the reusable workflows in its `.github/workflows`
   (cross-repo `uses:` works from any repo [13]); hold `default.json` for Renovate there too. This
   costs nothing the verdict's design does not already cost, deletes one or two repos from the
   estate, and (the point) routes *all* central churn into the one repo the audience actually
   looks at. That is Streamdal's fix [9] applied at the only place it is cheap. The verdict
   currently names `cuatro-portfolio` as the hub in the brief and then builds a *different* repo
   to be the hub; that inconsistency should be resolved in the portfolio's favour.
2. **Decide Option 4 now, and decide it as a merge.** Four Next.js apps are the one cluster where
   the no-orchestrator finding is inapplicable [1][2], where shared React components are actually
   feasible, and where a merge produces a visibly-alive repo. Merging them takes the estate from
   15 to 12 and creates one repo with real, human commit traffic. If it must stay gated, use an
   observable gate ("the second copy-pasted component triggers the merge"), not one suppressed by
   the layout being tested.
3. **Score criterion #2 explicitly, in writing, in the verdict.** Either show Option 3 winning on
   portfolio value or state the loss and why it is accepted. The research did the hard work of
   isolating the surviving N=1 argument; the verdict must engage with it rather than route around
   it.

Adopting 1 and 2 leaves you with roughly 12 repos, no dedicated hub repo, tokens published from
the flagship, and a Next.js monorepo with a live commit history, which keeps every property the
verdict wanted and loses none of D3 or D2.

## Residual risks the recommendation should state openly

- **The entire layout decision rests on zero published evidence for the actual population.**
  `research.md` says so: no study exists on solo-maintainer repository layout; every conclusion is
  team evidence with the team-dependent parts subtracted. The verdict presents its pick with more
  confidence than the evidence base licenses.
- **The liveness argument is single-source** [9], and that source's author calls monorepos "mostly
  terrible" in general. It is the strongest surviving pro-monorepo argument *and* it is thin. Both
  halves should be stated.
- **The two-source bar for "a monorepo failed for someone" was never met**, which cuts against the
  polyrepo pick as much as it protects it. The research is right not to claim it; the verdict
  should not silently benefit from the absence.
- **The hub's standing cost is understated as "two frozen files."** It is 30 files across 15 repos
  that no mechanism can remove: template repos cannot propagate [49], rulesets govern protection
  not content [49], plus a SHA pin that must churn, plus an npm package with semver obligations.
- **`research.md` contains an unreconciled internal contradiction on organization rulesets** (D1:
  "appear to be Enterprise-gated"; D2: not Enterprise-gated but also structurally incapable of
  propagating file content). The correct reading is the D2 one and it is worse for Option 3. Fix
  it in the research before anything downstream quotes D1.
- **Criterion #4 (incremental adoption) is the pick's genuine and unattacked strength** and should
  be the headline justification instead of the orchestrator finding: Option 3 lets tokens land in
  one app at a time with no big-bang cutover. That argument is honest, survives every attack above,
  and is currently buried under a finding that cannot carry the weight.
