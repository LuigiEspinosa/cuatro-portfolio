# Deep Recon prompt: Cuatro Ecosystem architecture decision

Drafted 2026-08-15. Paste the block below into a **fresh** Claude Code session
opened at `c:\Development\cuatro-portfolio`.

---

/bmad-deep-recon select

## The decision

I have 15 personal projects and I want to unify them into a "Cuatro Ecosystem",
one coherent suite in the spirit of Google Suite or Adobe Suite, with my personal
website/portfolio (`cuatro-portfolio`) as the main entry point and hub. Everything
will be deployed to a **single VPS**.

I need to choose the **source layout, deployment topology, and design-system
strategy**. Treat these as three separable sub-decisions and say explicitly where
they couple and where they don't: I have been conflating them.

### Candidate options to evaluate

1. **Full monorepo**: all 15 projects merged into one repository, one toolchain,
   one CI, shared packages.
2. **Polyrepo, unchanged**: keep 15 independent repos; unify only at deploy time
   via a reverse proxy.
3. **Hub + federated satellites**: one new "ecosystem" repo owning design tokens,
   the deploy layer, and an app registry; satellites stay independent and consume
   tokens. Optionally one shared React component package scoped to the Next.js
   cluster only.
4. **Partial monorepo**: merge only the stack-compatible cluster (the four
   Next.js apps) into one repo; leave the rest independent.

Add a fifth option if the evidence supports one I haven't listed. Do not assume
option 3 is correct because I described it in most detail: I want it attacked as
hard as the others.

### The hard constraint

This is the crux and I want the analysis to be honest about it rather than
routing around it. The projects are **radically heterogeneous**:

- **Six frontend frameworks**: Next.js, React/Vite, Svelte, Vue, Angular,
  Phoenix LiveView
- **Five backend languages**: Node/TypeScript, Go, Python, Elixir, Solidity

I want a direct verdict on: **can a shared component library realistically span
these, or does only a design-token layer federate?** If the answer is "tokens
only," say so plainly and show what the ceiling is on visual consistency achieved
through tokens alone (CSS custom properties, type scale, spacing, color, motion),
how close to a real "suite" feel that actually gets me, with examples from
real-world multi-framework design systems.

## Verified project inventory

Surveyed on disk 2026-08-15. Stacks and artifact counts confirmed by reading
`package.json`, lockfiles, `go.mod`, `requirements.txt`, and `_bmad-output/` trees.

| Project | Stack | Deploy artifacts | BMad artifacts | Notes |
|---|---|---|---|---|
| `cuatro-portfolio` | Next.js + React + TS | docker-compose, `docker/Dockerfile`, GitHub Actions | 0 | v2.5.3, shipping. **Intended hub.** |
| `cuatro-finance` | Next.js + Prisma + Tailwind + TS | docker-compose | 0 | v0.2.0, has Storybook |
| `cuatro-tracker` | Next.js + Prisma + Tailwind + TS | docker-compose, `docker/Dockerfile` | **191** | v0.1.0. Has `deploy-runbook.md`, `00-design-system.md`, `project-context.md` |
| `cs-tournament` (`inclusivcup`) | Next.js + Supabase + TS, **Go** worker | Vercel + Cloudflare Wrangler | 87 | Only project on a PaaS today, not Docker |
| `cs-tracker` | **Elixir / Phoenix LiveView** | docker-compose, Dockerfile | 68 | Nested git repo inside a `-workspace` wrapper |
| `digital-library` | **pnpm monorepo**: Fastify API + **Svelte** web + shared pkg | docker-compose, 2 Dockerfiles | 21 | Already internally a monorepo. Has `DESIGN.md` |
| `Mutuo` | frontend + Docker | docker-compose | 25 | Has `ARCHITECTURE-SPINE.md`, `epics.md`, `sprint-status.yaml` |
| `poketracker-go` | **Go** backend + **Python** bot | n/a | 23 | |
| `StreamVault` | **Python** backend + **Vue** frontend | docker-compose, 2 Dockerfiles | 19 | |
| `MaiCoin` | **Solidity** contracts + React/Vite | n/a | 0 | Web3; deploy model differs fundamentally |
| `list-wheel` | **Angular** | n/a | 1 | |
| `connect-four-react` (`find-four`) | React + Vite | n/a | 0 | v2.0.0 |
| `Lumen` | *empty: idea only* | n/a | 0 | |
| `tcg-tracker` | *empty: idea only* | n/a | 0 | |
| `apple-music-workspace` | *`requirements.txt` only: idea stage* | n/a | 0 | Python |

**Layout note:** six projects use a `<name>-workspace/` wrapper containing a
nested git repo plus BMad planning files; the other nine are plain git roots. Any
recommendation must say how to normalize this: it's currently inconsistent.

## Sub-questions I need answered

1. **Source layout.** Which option, and what specifically triggers a re-evaluation
   later? Quantify the monorepo costs for a *polyglot* repo at this scale,
   CI fan-out, build caching (does Nx/Turborepo/Bazel actually help when five
   languages are involved?), tooling conflicts, and the cost to a **solo
   developer** specifically. Most monorepo literature assumes a team; discount
   accordingly and say so.

2. **Design system.** Token-only vs. token + per-cluster component libraries.
   What is the concrete token contract (naming, distribution format, versioning,
   how a Phoenix LiveView app and an Angular app both consume it)? How do I
   propagate a token change across 15 apps without a monorepo's atomic commit?

3. **Deployment.** Single VPS with Docker Compose per app + one reverse proxy
   (Traefik vs Caddy vs nginx: pick one and justify it) versus alternatives.
   Cover: TLS/cert automation, subdomain vs path routing, shared Postgres vs
   per-app databases (several use Prisma, one uses Supabase, one is Phoenix/Ecto),
   resource limits, zero-downtime deploys, backups, and what happens when 12+
   containers contend on one box. Flag when this outgrows one VPS.

4. **Dev environment.** Where do devcontainers actually fit? I originally framed
   this as "monorepo *or* devcontainers": confirm or correct that framing, and
   say whether devcontainers are worth adopting independent of the layout choice.

5. **Consolidation.** Four projects are trackers: `cuatro-tracker`, `cs-tracker`,
   `tcg-tracker`, `poketracker-go`. Are these one product with four domains, or
   genuinely separate? `tcg-tracker` is empty, so folding it is nearly free;
   `cs-tracker` (Elixir) and `poketracker-go` (Go) would be expensive. Give me a
   merge/keep/archive call on each, plus on the three empty shells (`Lumen`,
   `tcg-tracker`, `apple-music-workspace`).

6. **Migration sequencing.** Whatever you recommend, give an incremental path
   where **every step leaves a working system**. I am not accepting a plan with a
   big-bang cutover. Identify the smallest first step that delivers visible
   ecosystem value.

7. **Repo relocation.** My personal repos currently sit in `C:\Development`
   alongside my employer's repos, under a `C:\Development\CLAUDE.md` that is a
   work-ownership charter. Confirm whether relocating personal work to a separate
   root is worth the churn, and what breaks when I move git repos on Windows
   (IDE workspaces, CI paths, Docker bind mounts, absolute paths in configs).

## Inputs you must ask me for before concluding

Do **not** assume values for these: ask me:

- VPS specs (vCPU, RAM, disk) and provider
- Which projects are currently deployed and publicly reachable, and at what domains
- Whether any project has real users or is purely portfolio demonstration
- My monthly hosting budget ceiling
- Whether `cs-tournament` must stay on Vercel/Cloudflare or can move to the VPS

## Decision criteria, ranked

1. **Solo-maintainer sustainability**: I am one person. Ongoing maintenance
   burden outranks theoretical elegance.
2. **Portfolio value**: this is my public showcase; the architecture should be
   something I'd want a hiring manager to read about.
3. **Visual coherence**: the suite must *feel* like one product.
4. **Incremental adoption**: no step may break a working app.
5. **Future headroom**: I don't plan new projects now, but the design should
   absorb one without restructuring.

## Non-goals

- Kubernetes, service mesh, or multi-region anything
- Rewriting apps into a single framework (explicitly rejected: say so if you
  disagree, but the bar is high)
- Microservices decomposition
- Any option requiring a team to operate

## Deliverable

A scored comparison of the options against the ranked criteria, a clear primary
recommendation with the strongest counter-argument to it stated fairly, the
concrete token contract, the VPS topology, the per-project merge/keep/archive
calls, and a sequenced migration path. Cite sources for external claims
(monorepo tooling limits, multi-framework design systems, reverse-proxy
trade-offs). Mark anything you inferred rather than verified.
