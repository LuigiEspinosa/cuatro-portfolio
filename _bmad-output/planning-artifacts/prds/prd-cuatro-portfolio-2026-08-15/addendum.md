# Addendum: Cuatro Ecosystem PRD

Depth that belongs to a downstream document (architecture, UX spec) or that earned a place
in the record but does not fit the PRD's main narrative. Companion to [`prd.md`](prd.md).

---

## A. The portfolio-value interrogation and why the technical pick survived

The PRD prompt named one question capable of overturning the research's recommendation:
*is the GitHub profile the product, or is the running suite the product?* The research had
scored five source-layout options and picked **Option 5, Anchored Hub** at 410 points, naming
**Option 1, full monorepo** as runner-up and stating that Option 1 overtakes if portfolio value
is re-ranked to roughly 50% weight or more.

### A.1 The threshold, stated precisely

The research's "roughly 50% or more" understates how sharp the boundary is. Holding the
relative ordering of the other four criteria constant and inflating only portfolio value, the
crossover sits at **≈ 51.5%**.

| Portfolio weight | Option 1 | Option 5 | Winner |
|---|---|---|---|
| 25% (original) | 355 | 410 | Option 5 |
| 50% | ~403 | ~407 | Option 5 |
| 51.5% | n/a | n/a | crossover |
| 52% | ~407 | ~406 | Option 1 |
| 55% | ~413 | ~406 | Option 1 |

So the question is not "does portfolio value matter more than ranked second?" It is: **is
portfolio value worth more than solo-maintainer sustainability, visual coherence, incremental
adoption and future headroom combined?**

### A.2 The answer, and why it does not flip the pick

The maintainer's answer: both links are shared, but recruiters are more comfortable navigating
`cuatro.dev`, and the GitHub repository is linked **from inside the applications** so technical
reviewers can drill down if they want.

That answer does not lower portfolio value. It **relocates** it.

The research's strongest surviving counter-argument against Option 5 was:

> *"Twelve repos still each show their own staleness to anyone browsing the profile. A full
> monorepo would answer this completely and the recommendation does not."*

That argument is conditional on **someone browsing the profile listing**. In the actual traffic
pattern nobody does. Recruiters land on the Hub. Technical reviewers reach a repository by deep
link from a Registry Entry, arriving at exactly the repository they wanted, having already seen
the software running. The profile *listing* (the surface Option 1 exists to fix) is never
rendered.

The full monorepo therefore solves a problem this audience does not encounter, and charges for
it. Its cost is the one the research names: four unrelated toolchains sharing a tree with no
orchestrator able to help, since no orchestrator covers Elixir, Solidity, Go, Python and
TypeScript together.

### A.3 The counter the research never scored

The research assigns Option 1 a portfolio score of **5/5** without interrogating it. That five
is not free.

Option 1 produces a single repository containing an Elixir application, a Solidity contract, a
Go service, a Python backend, an Angular application and four Next.js applications. On a
profile, that collapses six framework signals into one repository whose language bar reads
predominantly TypeScript. **Option 1 is the option that makes the deliberate variety hardest
to see**: and variety is the stated thesis (`prd.md` §1).

The honest re-score is therefore not "portfolio value stays at 25%." It is that **Option 5's
portfolio score was too low and Option 1's was too high**, because the matrix assumed the
GitHub profile is the shop window. It is not; the Hub is. Option 5's lead widens.

### A.4 What this hands to architecture

- The Anchored Hub pick stands unchanged. No technical decision is overturned.
- A requirement the research does not contain: **every Registry Entry links to its source
  repository** (`prd.md` FR-10), with direction of travel Hub → repository.
- A product mechanism replacing what Option 1 would have bought: the **Status taxonomy**
  (`prd.md` FR-7) converts an old last-commit date from evidence of abandonment into
  confirmation of completion. Repo layout cannot do this; an honest `Complete` label can.

---

## B. Status taxonomy: options considered

Three vocabularies were put to the maintainer. **Lifecycle-honest** was chosen.

### B.1 Chosen: lifecycle-honest, four terms

```
Live       : running, in active use, maintained
Complete   : finished and running; done, not abandoned
In progress: being built now, may be rough
Archived   : read-only, kept for the record
```

Chosen because it attacks the staleness problem head-on: `Complete` is defined as a
destination, so an old commit date confirms the label rather than undermining it. Cost: it
requires honesty about what is actually rough.

### B.2 Rejected: readiness-for-visitor, three terms

```
Try it now : live, usable, no setup
See it run : live but read-only / demo account
Source only: code is here, nothing deployed
```

Answers the Visitor's immediate question directly, but says nothing about maintenance or
liveness, so it leaves the staleness problem entirely unaddressed, which was the field's
primary job.

### B.3 Rejected, two fields, both

```
status: Live | Complete | In progress | Archived
access: Try it now | See it run | Source only
```

No information collapsed; both questions answered. Rejected as over-specified for eight
entries maintained by one person, and it produces a busier card.

**Note on the residue:** the readiness question does not disappear just because the readiness
taxonomy was rejected. It reappears as the `demo` field in the entry contract
(`prd.md` FR-6, FR-27), which is narrower: it declares access rather than classifying it.

---

## C. Technical notes carried forward, not decided here

These are architecture's calls. Recorded so they are not rediscovered.

### C.1 The registry's existing shape

`content/projects.ts` already defines:

```ts
export interface ProjectEntry {
  id: string;
  name: string;
  description: string;
  tech: string[];
  github?: string;
  live?: string;
}
```

with exactly one populated entry (`digital-library`), rendered at `app/projects/page.tsx`.
The PRD's entry contract (FR-6) is a superset: it adds `status`, `family`, `demo` and
`absorbed_into`, renames `github` to `source`, and makes `source` required rather than optional.
**The registry is a promotion of an existing structure, not a green-field build.**

Open for architecture: the *published* form. FR-12 requires consumability by six frameworks
without a JavaScript dependency on the Anchor, which a TypeScript module does not satisfy for
an Elixir or Go consumer. A build-time emission from the TypeScript source into a
language-neutral artifact is the obvious shape but is deliberately not specified in the PRD.

### C.2 The Anchor's actual stack

Next.js 16 (App Router, standalone output) · React 19 · TypeScript 5.9 · Three.js 0.183 +
React Three Fiber v9 + drei · @react-three/postprocessing · GSAP 3.14 + ScrollTrigger · lenis ·
**Sass 1.97 (SCSS)** · Vitest + Playwright · pnpm 10.31 · Docker three-stage build
(deps → builder → runner, node:22-slim).

Currently fronted by **Caddy**, with **Umami self-hosted at `analytics.cuatro.dev`** backed by
Postgres. Routes today: `/`, `/cv`, `/work`, `/projects`, `/recommendation`, `/celeste`,
`/api/health`. Components organised atoms/molecules/organisms.

Two consequences for architecture:

1. **The Anchor is not a Tailwind consumer.** The research's token contract pairs a plain
   `:root` file with a generated Tailwind `@theme inline` adapter for "the Tailwind cluster."
   The Anchor is SCSS. Plain custom properties are consumed natively by Sass, so research
   Step 2 works, but the adapter is for `cuatro-finance` / `cuatro-tracker` /
   `cs-tournament`, which are merge *targets*, not the Anchor as it exists.
2. **Caddy → Traefik is a live migration, not a green-field choice.** The research picked
   Traefik partly on the xcaddy-rebuild-per-upgrade maintenance argument. The incumbent is
   Caddy. This is research Step 5 (greenfield VPS rebuild) and is unaffected by the PRD, but
   the "already have it" framing applies to subdomains, not to the proxy.

### C.3 Analytics as the measurement substrate

`prd.md` §11 rests on Hub visitor events being distinguishable: reaching the Suite Directory,
opening a `live` link, opening a `source` link. Umami is already self-hosted and first-party,
satisfying NFR-8 without introducing a vendor. Whether these are custom events, distinct
routes, or outbound-link tracking is an implementation choice.

The important point for architecture: **SM-1 through SM-3 are unmeasurable without deliberate
instrumentation.** Page views alone do not distinguish "loaded the homepage" from "scrolled to
the suite," and the whole value of story-then-suite is the difference between those two.

### C.4 Capacity arithmetic, for the gate's sake

2 vCPU is a **200% CPU budget**. The single citable measurement is one Next.js process at
**639,880 KB RSS / 103.3% CPU**: captured during a bot crawl, so it is an upper bound on a
bad day rather than steady-state demand. Four Next.js processes at that figure would demand
412% before the BEAM node, Postgres or the proxy. The two-source evidence bar was met **zero
times** for every other footprint in the estate, meaning those are *unknown* numbers rather
than small ones.

This is why `prd.md` FR-33 requires that a written threshold exist and bind, rather than
specifying a number: the number is being measured now and any figure written here would be a
guess dressed as a requirement.

Named overflow path: managed hosting for two heavy applications at $15–30/month, inside the
$40–100 ceiling, with the VPS sunk to 2028 so only marginal spend counts.

### C.5 Two inherited claims the research flagged as unverified

The research's own verification note lists rows carrying no captured URL and names two as load-bearing: **[53]** (why nginx is cut) and **[60]** (why subdomains beat paths). It asks that both be re-located before either conclusion is treated as settled.

`prd.md` inherits the subdomain conclusion throughout: §5.3, NFR-2 and the whole `cuatro.dev` addressing model assume it. The practical risk is nil, because subdomain routing is also the **incumbent** and would be the status-quo choice regardless of what [60] says. But architecture should know it is standing on a citation the research itself flagged rather than on a verified one.

Separately: roughly 85% of the research's 97 sources were not re-checked. The verified spine (the numbers and quotations the recommendation rests on) is sound; the whole citation apparatus is not established. Unchecked areas include the Turborepo quotation, the Supabase evidence and the entirety of D4 (dev environment).

### C.6 Identity mechanism

Managed provider (Clerk) over **OIDC Authorization Code + PKCE**, each application holding its
own host-scoped session rather than a domain-scoped shared cookie. Logout is RP-Initiated plus
Back-Channel, and the Phoenix LiveView case requires a socket-level broadcast or an open socket
will not observe the logout: this is the specific mechanism behind `prd.md` FR-22.

OIDC is itself the reversibility seam (FR-23): substituting the provider changes issuer
configuration, not application code. ForwardAuth at the proxy is *not* the primary architecture,
but is appropriate for gating admin surfaces that have no authentication of their own.

`cs-tournament`'s existing users migrate without a password reset: bcrypt hashes are
exportable and mappable.

---

## D. Research findings that constrain the product but are not product decisions

Recorded so the PRD does not have to restate them and architecture does not have to rediscover
them.

- **Contracts federate; implementations do not.** UI components are a *code* dependency and
  must be reimplemented per framework. Design tokens are a *format*, OIDC is a *protocol*,
  reusable CI definitions are a *reference*: all three cross every language boundary in the
  estate. This is the architectural spine and the reason `prd.md` §8 rules out a shared
  component library as a decision rather than a deferral.
- **The precedent for cross-framework component libraries is uniformly negative,** in the
  vendors' own words: Google defunded Material Web (2024-06), GitHub retired Primer
  ViewComponents (2026-02), Adobe maintains two full implementations with no consolidation plan.
- **The token ceiling is real.** Tokens federate *values*; nothing federates *behaviour*. Form
  controls, focus management, overlays and dense data UI will differ across the estate
  permanently. `prd.md` §4.4 accepts "reads as one author" rather than claiming "feels like one
  product."
- **No design system serving both a Phoenix/LiveView application and a JS-framework
  application exists in public.** This estate would be building it without precedent.
- **Solo-maintainer repository layout has zero published study.** Every solo conclusion in the
  research is team evidence with the team-dependent parts subtracted. It is the weakest
  foundation in the report and it sits under the highest-stakes decision, which is a further
  reason the §A interrogation was worth running rather than deferring to the score.
- **Automation without users is automation without feedback.** Unattended dependency merging
  routes the most visually breaking payload (a colour *value* change ships as a *minor* version
  bump) into an estate with nobody to notice. Hence `prd.md` NFR-10.
- **Database shape:** one Postgres instance, one database and one role per application, not
  schema-per-app, which couples migrations across applications.
- **Build in CI, push images; the box never compiles.** Compiling on a serving 2-core box is
  named as the top unmeasured risk.

---

## E. Deferred with reasons: the "earned, not scheduled" list

Items deliberately not built until a trigger fires, with the trigger named.

| Item | Trigger that earns it |
|---|---|
| Token package publishing + automated propagation | Three hand-copied token changes actually performed |
| Reusable CI workflows published from the Anchor | The same workflow copy-pasted into a third repository |
| A React component package for the merged Next.js cluster | Real shared components accumulating in the cluster after the merge |
| Devcontainers | A concrete toolchain-version conflict that per-project version files cannot resolve |
| Point-in-time database recovery | A loss window that `pg_dump` frequency cannot cover |
| Merging `poketracker-go` into another tracker | Never, unless the Go representation stops earning its place: it is the weakest keep but framework breadth is the thesis |

---

## F. The unbuilt four: options considered

Late in discovery it emerged that `StreamVault`, `MaiCoin`, `poketracker-go` and `Mutuo` are
**early scaffolding**, not finished-but-undeployed applications. The research's per-project
calls describe their stacks and in one case their internal documents, which reads as more
maturity than exists. Four options were put to the maintainer.

### F.1 Chosen: ship the suite smaller, add later

The Suite Directory renders only `Live` and `Complete`; the four stay in the App Registry
unrendered until genuinely ready (`prd.md` FR-35). First public suite is six entries.

Chosen because it removes the ratio problem without weakening the taxonomy, requires no new
work, and keeps `prd.md` §8's Per-App Layer non-goal intact. Its cost: nothing in the PRD
causes those four to ever get finished, so six may be the permanent size. That is accepted,
`prd.md` SM-C2 explicitly refuses entry count as a growth target.

### F.2 Rejected: out of scope, Registry shows everything honestly

The originally drafted behaviour: render all entries including four `In progress`. Rejected on
the ratio argument in `prd.md` FR-35: an honest warning label about one rough application
becomes a pattern signal at four-in-ten, producing the opposite of the intended impression.

### F.3 Rejected: reconsider the keeps

Reopen the estate decision: if four of seven satellites do not exist, some may deserve
archiving rather than building. The research already called `poketracker-go` "the weakest keep."

Not chosen, but **not foreclosed**: it survives as `prd.md` §13 Q10, where archiving is named
as a legitimate outcome. The argument for it: building a Go tracker from scratch purely to
preserve framework breadth is a real cost paid for a portfolio signal, and the polyglot claim
already has five other languages behind it. The argument against: `poketracker-go` and
`StreamVault` are two of the six frameworks, and removing them narrows the thesis.

### F.4 Rejected: bringing them online is ecosystem scope

Deploying the four becomes part of the ecosystem effort. Rejected: they are not deployable,
the remaining work is feature work, not deployment work, so this would have imported an
unbounded amount of Per-App Layer scope into an ecosystem-layer PRD, and collided with the
Capacity Gate on top.

---

## G. `list-wheel` and domain coherence

`list-wheel` is built and deployed at `luigiespinosa.github.io/list-wheel/`. This is not in the
research's estate model, which assumes everything either runs on the VPS or on the external
PaaS that `cs-tournament` is leaving.

**Decision: relocate to a `cuatro.dev` subdomain on the VPS** (`prd.md` §5.3).

The alternative considered and rejected was a CNAME to a `cuatro.dev` subdomain still pointing
at GitHub Pages: coherent domain, zero VPS cost, GitHub continues hosting. It was rejected in
favour of full consolidation on the VPS, consistent with the maintainer's stated intent that
everything runs on one box.

**For architecture:** GitHub Pages serves only static assets, so the deployed artifact is a
static Angular build. Serving it from the VPS is static file serving, not an application
runtime, and its cost against the Capacity Gate should be close to zero: materially unlike
adding another SSR application. This assumption is recorded in `prd.md` §15 and should be
verified rather than trusted, since it is the basis for treating this relocation as cheap.

A second consequence: this is the estate's only application with **no server-side component at
all**, which makes it the natural first candidate for verifying that the reverse proxy serves
static sites correctly during the greenfield rebuild.
