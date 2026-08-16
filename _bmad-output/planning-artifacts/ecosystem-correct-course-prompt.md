# Correct Course prompt: satellite restyling scope change

Drafted 2026-08-15. Paste the block below into a **fresh** Claude Code session opened at
`c:\Development\cuatro-portfolio`.

---

/bmad-correct-course

## The change

**Operator decision: every application gets a visual restyle, not just token adoption.**

The plan as written scopes per-application work out. PRD §8 says *"Not feature work inside
individual applications. This PRD covers the Ecosystem Layer only."* AD-14 has each Satellite
vendor the token contract and consume it natively: a *contract* adoption, not a redesign.

The Operator now wants:

1. **The Hub's own components redesigned token-native**: `GlitchText`, `ScanlineOverlay`,
   `HomeLayout`, `ErrorPage` and the rest of `cuatro-portfolio`'s cybercore surfaces rebuilt
   against the token contract rather than migrated through the seven SCSS steps.
2. **Each Satellite visually restyled in its own framework** as it adopts the contract, so the
   suite reads as one product at the component level and not only at the token level.

This is a scope expansion, made deliberately and with the cost stated. Your job is to work out
what it breaks and propose the corrected plan, not to talk the Operator out of it.

## Read these

Under `_bmad-output/planning-artifacts/`:

- `prds/prd-cuatro-portfolio-2026-08-15/prd.md` + `addendum.md`: **§8 non-goals and §9 MVP
  scope are the two sections this change directly contradicts**; §11 success metrics and their
  counter-metrics are the two most likely to need rework
- `architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md`: AD-1…AD-23
- `epics.md`: 94 stories; Epic 2's Stories 2.18–2.22 are the seven-step SCSS migration this
  change may collapse
- `implementation-artifacts/sprint-status.yaml`: 82 actionable stories
- `ux-designs/ux-cuatro-portfolio-2026-08-15/`: `DESIGN.md`, `EXPERIENCE.md`, and
  `rebaseline-2026-08-15.md` (O-10 decided, O-12 open)

## The invariant that does not move

**AD-2 and the contracts-federate principle still hold.** "Restyle each Satellite" means each
one is restyled **natively in its own framework**, consuming the same tokens. It does **not**
mean a shared component library. That was ruled out on evidence: Google defunded Material Web
(2024-06), GitHub retired Primer ViewComponents (2026-02), Adobe maintains parallel
implementations with no consolidation plan. Nothing in this change reopens it.

If your corrected plan implies shared component code crossing the Turborepo boundary, you have
mis-scoped it.

## Facts the correction must account for

**Seven Satellites, five languages.** `cs-tracker` (Elixir/Phoenix LiveView), `digital-library`
(Svelte/SvelteKit + Fastify), `StreamVault` (Python + Vue), `MaiCoin` (Solidity + React/Vite),
`poketracker-go` (Go + Python), `Mutuo`, `list-wheel` (Angular). One solo maintainer.

**Four of the seven are unbuilt.** `StreamVault`, `MaiCoin`, `poketracker-go` and `Mutuo` are
early scaffolding with real feature work remaining. FR-35 keeps them **unrendered** in the Suite
Directory until ready, and PRD §13 Q10 records that nothing in the plan causes them to be
finished: archiving them is a legitimate outcome. **Restyling an unrendered, unbuilt
application is work with no Visitor-visible return.** Address this head-on: propose a
sequencing that does not spend the estate's scarcest resource on invisible surfaces, or state
plainly why restyling them first is right.

**Three Satellites would show a return today:** `cs-tracker`, `digital-library`, `list-wheel`,
live, rendered, and on three different frameworks, which is also the strongest polyglot proof.

**Capacity is still unproven.** 2 vCPU / 8 GB, measurement week gated by AD-9 which defaults to
blocked. SM-C4 wins every conflict. Restyling does not add serving load, but bringing more
applications Live does.

**O-12's status changes under this decision.** Items 1 and 2 (GlitchText's red/cyan aberration,
ScanlineOverlay's pure blacks) largely dissolve if those components are redesigned token-native
rather than migrated. **Item 3 does not dissolve**: whether the large decorative numeral at
`error-page.scss:28` is redundant to the visible 404 message and `aria-hidden` is an
accessibility question that survives any redesign. And if a redesign keeps a darkening layer,
"nothing is pure" still bars `#000`, so a `--token-scrim` role is needed regardless.

## What I need decided

1. **PRD §8 and §9.** Per-app restyling is currently a non-goal and out of MVP scope. Propose
   the exact rewording, and say whether restyling lands in MVP or in a later phase.
2. **Do Stories 2.18–2.22 collapse?** The seven-step SCSS migration exists to move the *current*
   stylesheets onto tokens. If the Hub's components are being redesigned token-native, most of
   that is wasted motion: you would tokenize a value in step 4 and delete the component later.
   Say which steps survive, which merge into redesign stories, and which are deleted outright.
   **Step 1 (add the contract) and Step 2 (alias) are Epic 1 and FR-18 is measured on them**,
   be careful before touching those.
3. **New epic, or new stories inside existing epics?** Satellite restyling is per-application
   work across seven repositories. Decide whether it is Epic 8, or distributed into the epics
   that already touch each Satellite.
4. **Sequencing against the estate.** Which Satellites restyle, in what order, and what the
   trigger is for the four unbuilt ones.
5. **Success metrics.** SM-6 currently counts *applications on different frameworks rendering
   from shared tokens, target ≥2*. Under a restyle programme that target is probably wrong.
   SM-C2 warns against growing the estate to look busy, and SM-C3 warns against wiring more
   applications than the proof needs: check whether either now conflicts with the plan.
6. **The impact on `sprint-status.yaml`.** 82 stories are actionable today and Epic 1 is
   unblocked. Say explicitly whether Epic 1 can still start now, unchanged.

## Constraints that do not change

- Solo maintainer, one session at a time
- One environment, no staging (AD-21); every CI gate blocking
- Four subdomains live throughout: `cuatro.dev`, `cs-tracker.cuatro.dev`,
  `tracker.cuatro.dev`, `library.cuatro.dev`
- Every step leaves a working system (NFR-2, AD-20)
- No shared component library across frameworks: a decision, not a deferral

## Output

A change proposal that says what is amended, what is added, what is deleted, and what the
corrected sequencing is: concrete enough that `bmad-sprint-planning` can regenerate tracking
from it. Flag anything where this change makes a settled architectural decision untenable,
rather than quietly working around it.
