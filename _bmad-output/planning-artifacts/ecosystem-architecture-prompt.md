# Architecture prompt — Cuatro Ecosystem

Drafted 2026-08-15, after `bmad-deep-recon`, `bmad-prd` and `bmad-ux` completed.
Paste the block below into a **fresh** Claude Code session opened at
`c:\Development\cuatro-portfolio`.

---

/bmad-architecture

## The three inputs, and how to read them

All under `_bmad-output/planning-artifacts/`:

1. **Research** — `research/technical-cuatro-ecosystem-architecture-2026-08-15/research.md`
   The *how*. Source layout, deployment topology, design-system strategy, identity and
   dev environment, all with cited evidence and an adversarial pass.
2. **PRD** — `prds/prd-cuatro-portfolio-2026-08-15/prd.md` + `addendum.md`
   The *what*. FR-1…FR-35, NFRs, the estate decision, MVP scope, success metrics.
   **Start at §12** — it records seven places where product framing collided with a
   settled technical decision, and it is the section most likely to change what you
   build. Then §5 (estate of record) and §10 (mapping onto research Steps 0–8).
3. **UX** — `ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md` + `EXPERIENCE.md`
   The *look and feel*. The full token contract with real values, the SCSS migration
   path, component and state patterns, the seams inventory, the accessibility floor.
   Also read `validation-report.md` — three review lenses found 82 findings including
   6 criticals, all resolved, and the pattern it names is worth absorbing.

**Do not re-decide any of it.** Where these documents disagree with each other, say so
explicitly rather than silently picking one — that is exactly what PRD §12 did for the
research, and it is the behaviour I want repeated here.

## What the architecture must produce

The spine — the invariants that keep eight repositories, six frontend frameworks and
five backend languages consistent as they are built and changed independently.

The research names four downstream bindings and says the architecture spine consumes
three of them: **the contracts-federate principle, the VPS topology table, and the
OIDC + per-app-session shape.** That is the starting frame, not the whole job.

### The load-bearing invariants I expect

1. **The contracts boundary.** "Contracts federate; implementations do not" is the
   architectural spine per research Cross-dimension #1. Make it enforceable rather than
   aspirational: what exactly is a contract in this system (tokens, OIDC, the registry
   schema, CI workflow references), what is forbidden from becoming shared code, and
   how does a future me tell the difference when tempted?

2. **The Anchor's internal structure.** `cuatro-portfolio` becomes a Turborepo monorepo
   holding the four Next.js apps *and* publishing the shared contracts. Define the
   workspace layout, the boundary between "hub app" and "published contracts", and how
   `git subtree` / `git-filter-repo` history preservation works for the three merges
   (`cuatro-finance`, `cuatro-tracker`, `cs-tournament`). Turborepo must stay strictly
   inside the JS/TS boundary — it is not asked to handle Elixir, Go, Python or Solidity.

3. **The App Registry's published form.** PRD §13 Q4 is explicitly left for you:
   FR-12 requires it be consumable by six frameworks **without a JS dependency**, and
   deliberately does not pick a format. Pick one and justify it. `addendum.md` §C.1
   documents the registry's existing shape.

4. **The token distribution mechanism** — but note it is *earned, not scheduled*
   (research Step 7, PRD §9.2). Specify what it will be so nothing blocks it later;
   do not build it. Hand-copying is correct until it has happened three times.

5. **The deployment topology.** Traefik v3.7, subdomain routing, one Postgres with one
   database + one role per app, build-in-CI-push-to-GHCR, `docker-rollout` gated on
   real healthchecks, `pg_dump` + restic. Research §D3 has the table with confidence
   levels. Turn it into a concrete topology for **eight** repositories and the four
   subdomains live today.

6. **The identity architecture.** Clerk, OIDC Authorization Code + PKCE per app, each
   app keeping its own `__Host-` session — not a domain-scoped cookie. RP-Initiated +
   Back-Channel logout, with `live_socket_id` broadcast wired in `cs-tracker` or logout
   will not reach an open LiveView socket. `MaiCoin` is **structurally exempt** (wallet
   auth, not OIDC) per PRD FR-24. ForwardAuth is not the primary architecture but does
   gate the Traefik dashboard and admin surfaces.

7. **The Demo Account reset mechanism.** PRD §13 Q3 is explicitly left for you. FR-26
   requires a defined baseline and a bounded reset window; the mechanism differs per
   stack. Specify it per stack, or specify one pattern each stack implements.

## Closed since the UX run — use these, do not re-derive

**O-7 is closed.** `cs-tracker` is on `{:phoenix, "~> 1.8.7"}`. Its
`assets/css/app.css` uses Tailwind v4 (`@import "tailwindcss" source(none)`), loads
daisyUI via `@plugin "../vendor/daisyui" { themes: false }`, and declares named light
and dark themes through `@plugin "../vendor/daisyui-theme"`. **`cs-tracker` takes the
Tailwind adapter route, not the plain-CSS route.** This was blocking Epic 1 Step 2.

That makes **O-3 the live question**: whether `@plugin "daisyui/theme"` accepts a
`var()` reference is undocumented either way. The research and the UX run both flag a
scratch `mix phx.new` test as the ten-minute close, with plain `[data-theme]` CSS as
the fallback. Fold the answer — or the fallback — into the token contract's Phoenix
consumption route.

## Open items you inherit

From the UX run (`EXPERIENCE.md` § Open Items) — the ones that are architecture's
business:

- **O-3** — daisyUI `var()` support. Above. Blocks Epic 1 Step 2, seam S-9.
- **O-8** — the 44×44px hit-target floor must be *measured in a browser*, not read off
  CSS. Specify where that verification lives in the workflow.
- **O-9** — greyscale render check of the Status taxonomy. Same question.

From the PRD (§13):

- **Q1** — does the estate fit on 2 vCPU? The `docker stats` week is the only thing
  that answers it. **Design the capacity gate as a real mechanism**: what is measured,
  what the written threshold is, and what concretely happens when it trips (the named
  overflow path is Railway, $15–30/mo for two heavy apps).
- **Q11** — the research sets `refresh_after: 2026-11-15` and says a selection report
  older than two quarters should be refreshed before being acted on. Steps 5–8 will
  plausibly run after that date. Decide how the architecture records that shelf life.

## Defects found in the repository during the UX run

Not architecture's job to fix, but they should land somewhere traceable — fold them
into the epic breakdown or a defect list, do not let them evaporate:

- **FR-9 defect:** `digital-library` runs on **SQLite**, not Postgres. Real stack is
  SvelteKit · Fastify · SQLite · Redis · BullMQ · Docker. The Registry entry is wrong.
  *(Note the knock-on: the "one Postgres, one database per app" topology does not apply
  to this satellite. Confirm whether that changes anything.)*
- `aria-hidden="true"` wraps the only `<h1>` on `/work` — `components/organisms/WorkHero/WorkHero.tsx:39`
- `boder:` typo — `components/atoms/WorkItem/WorkItem.scss:84`
- `Dev. 2025` should read `Dec.` — `content/work.ts:18`
- `Celeste.tsx` hides the header by mutating the DOM in an effect

## Constraints

- **Solo maintainer, indefinitely.** Sustainability is the top-ranked criterion.
- **2 vCPU / 8 GB Hostinger VPS**, prepaid to 2028, budget $40–100/mo. Capacity is
  **unproven** — SM-C4 (VPS load average) wins every conflict with any other metric.
- **Four subdomains live today** and must keep working through every step:
  `cuatro.dev`, `cs-tracker.cuatro.dev`, `tracker.cuatro.dev`, `library.cuatro.dev`.
- **Every step leaves a working system** (NFR-2). No big-bang cutover.
- **No cross-framework component library.** A decision, not a deferral.
- Wiping and rebuilding the VPS greenfield is acceptable (research Step 5).

## Non-goals

- Kubernetes, service mesh, microservices, multi-region
- Rewriting applications to one framework — the polyglot estate *is* the product
- Devcontainers (explicitly rejected; WSL2 relocation instead, Step 8)
- Per-app feature work — this is the Ecosystem Layer only
- Building the token distribution machinery now (specify, don't build)

## What I want out of it

An architecture spine that `bmad-create-epics-and-stories` can consume directly, and
that maps cleanly onto the seven epics already sketched in PRD §10:

| Epic | Content |
|---|---|
| 1 | Research Steps 0–2 — archive, monitor, bot rules, capacity week, first token adoption |
| 2 | The product layer — Registry as product, Suite Directory, front-door reshape |
| 3 | Anchor merge + build-in-CI |
| 4 | Greenfield VPS rebuild |
| 5 | Identity |
| 6 | Token distribution machinery (earned) |
| 7 | WSL2 relocation |

Epic 1 is unblocked today and I intend to start it immediately — so **make Epic 1's
architecture concrete and complete even if later epics stay coarser.**

Flag any place where the three input documents contradict each other, and any place
where the architecture forces a change to a PRD requirement or a UX decision. I would
rather resolve it here than during implementation.
