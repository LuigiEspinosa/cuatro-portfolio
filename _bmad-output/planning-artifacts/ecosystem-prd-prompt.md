# PRD prompt: Cuatro Ecosystem

Drafted 2026-08-15, after `bmad-deep-recon` completed. Paste the block below into a
**fresh** Claude Code session opened at `c:\Development\cuatro-portfolio`.

---

/bmad-prd

## Read this first

The technical decision is already made and evidence-backed. Read it before asking me
anything:

- `_bmad-output/planning-artifacts/research/technical-cuatro-ecosystem-architecture-2026-08-15/research.md`
- Start with the **Executive summary**, then **Recommendations** (the scored matrix,
  per-project calls, sequenced migration path), then **Open questions**.

**Do not re-derive or re-litigate the technical calls.** Source layout, deployment
topology, design-system strategy, identity provider and dev environment are settled
with cited evidence. Treat them as inputs. The one exception is spelled out below.

## What this PRD is for

I have 15 personal projects. I want them to become the **Cuatro Ecosystem**: one
coherent suite in the spirit of Google Suite or Adobe Suite, with `cuatro.dev`
(`cuatro-portfolio`) as the hub and main entry point. Everything runs on one VPS.

The research answered **how to build it**. This PRD must answer **what it is**. Those
are genuinely unresolved:

- What does a visitor to `cuatro.dev` actually experience? What makes it read as a
  *suite* rather than a list of links?
- What is the **app registry**? The research defines it structurally: name, URL,
  description, status, tech, published from the anchor, but not editorially. What
  belongs in an entry, who is it written for, what does "status" mean to a reader?
- Is there a cross-app **suite switcher**, and what does it do?
- What does one login across the ecosystem buy the *user*, given there are no real
  users? Is Clerk serving a real need or is it portfolio demonstration? Say so plainly
  either way: "it exists to prove OIDC federates across six frameworks" is a
  legitimate answer, but it should be a decision, not a drift.
- What is the ecosystem's **narrative**? Six frameworks under one visual identity is
  either a coherence failure or the entire point. The research says it can be the
  point. This PRD should commit.

## The one question that can overturn the technical pick

**Settle this first: it changes the answer.**

The research scored five options against my ranked criteria and picked **Option 5,
Anchored Hub** (410 points). But it names **Option 1, full monorepo**, as runner-up and
states explicitly: *if portfolio value is re-ranked to first place at roughly 50% weight
or more, Option 1 overtakes.* Option 1 is the only option that leaves a single repo and
so is the only one that fully solves the "stale GitHub profile" problem.

My criteria were ranked: (1) solo-maintainer sustainability 30, (2) portfolio value 25,
(3) visual coherence 20, (4) incremental adoption 15, (5) future headroom 10.

**Interrogate that ranking with me.** The underlying question is: *is the GitHub profile
the product, or is the running suite the product?* I ranked sustainability first
somewhat reflexively. If the honest answer is that this whole effort exists to be seen,
by hiring managers, by peers, then portfolio value may deserve the top slot and the
architecture should change accordingly.

Do not let me hand-wave this. Push until I give a real answer, then state clearly which
option my answer implies. If it implies Option 1, say so directly rather than
rationalizing the existing pick.

## Inputs already settled: carry these forward

**Estate decision (15 → 8):**

- **Archive:** `Lumen`, `tcg-tracker`, `apple-music-workspace`: all empty shells
- **Merge into the anchor:** `cuatro-finance`, `cuatro-tracker`, `cs-tournament`
  (the Next.js cluster; `cs-tournament` also moves off Vercel)
- **Absorb:** `connect-four-react` → a playable demo embedded in the portfolio
- **Keep as satellites:** `cs-tracker` (Elixir), `digital-library` (Svelte/Fastify),
  `StreamVault` (Python/Vue), `MaiCoin` (Solidity), `poketracker-go` (Go), `Mutuo`,
  `list-wheel` (Angular)

⚠️ **Flag to resolve:** the report says **15 → 8** in the executive summary and
per-project calls, but its "Downstream bindings" table says the product brief consumes
a **15 → 11** decision. Those disagree. Ask me which is intended and record the answer,
I believe 11 is an intermediate state after archiving and absorbing but before the three
merges, but it should not stay ambiguous in a downstream artifact.

**Also settled:** tokens-only design system (no cross-framework component library);
Traefik + subdomains + one Postgres on one VPS; Clerk for identity via OIDC + PKCE; no
devcontainers; relocate repos to WSL2 ext4.

**Trackers:** `cuatro-tracker`, `cs-tracker`, `tcg-tracker`, `poketracker-go` are **one
product family with four implementations**: unified through tokens and a "Trackers"
section in the registry, not by merging code. That framing needs product language.

## Constraints

- **Solo developer.** Every scoped item is maintained by one person indefinitely.
- **No real users.** Portfolio demos and personal-use tools. This means no error signal,
  the research treats it as a first-class risk, and the PRD should not assume feedback
  loops that don't exist.
- **Hardware:** Hostinger VPS, 2 vCPU / 8 GB / 100 GB, Ubuntu 24.04, prepaid to 2028.
  Budget $40–100/mo. **Capacity is unproven**: a week of `docker stats` is running in
  parallel with this PRD. Do not scope anything that assumes headroom.
- **Live today:** `cuatro.dev`, `cs-tracker.cuatro.dev`, `tracker.cuatro.dev`,
  `library.cuatro.dev`. These must keep working through every step.
- I **value stack variety**: six frameworks is deliberate, not accidental debt.

## Non-goals

- Re-deciding source layout, proxy, database, identity provider or dev environment
  (the portfolio-value question above is the sole exception)
- Kubernetes, microservices, rewriting apps to one framework
- Anything requiring a team
- Feature work inside individual apps: this PRD covers the **ecosystem layer** only

## What I want out of it

A PRD that a fresh `bmad-architecture` run can consume directly, covering:

1. The ecosystem's purpose and audience, stated in one paragraph I'd be willing to put
   on the site
2. The visitor experience at `cuatro.dev` and what makes it a suite
3. The app registry as a **product**: entry contract, editorial voice, status taxonomy
4. Cross-app identity: what it's for, and honestly whether it's justified
5. Scope boundary: ecosystem layer vs. per-app work
6. Success criteria that are checkable **without users** (this is the hard one; the
   research flags the missing error signal as a standing risk)
7. The estate decision recorded unambiguously, with the 8-vs-11 discrepancy resolved
8. Explicit sequencing alignment with the research's Steps 0–8, since Steps 0–2 should
   become the first epic

Flag anything where the product framing genuinely contradicts a technical decision: I
would rather find that now than in architecture.
