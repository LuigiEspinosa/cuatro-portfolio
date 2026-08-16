# Provisional verdict — TO BE ATTACKED

This is a draft recommendation written to be red-teamed. It is not final.

## Context

Solo developer, 15 personal projects, 6 frontend frameworks (Next.js, React/Vite, Svelte,
Vue, Angular, Phoenix LiveView), 5 backend languages (Node/TS, Go, Python, Elixir,
Solidity). One Hostinger VPS: **2 vCPU, 8 GB RAM, 100 GB disk**, Ubuntu 24.04, prepaid to
2028. DNS on Cloudflare. Live today: `cuatro.dev`, `cs-tracker.cuatro.dev`,
`tracker.cuatro.dev`, `library.cuatro.dev`. Budget $40–100/mo. **No real users** — portfolio
demos and personal-use tools. Wiping the VPS is acceptable. Existing Supabase and Railway
accounts. Open to migrating *one* project's stack but **values stack variety**.

Ranked criteria: (1) solo-maintainer sustainability, (2) portfolio value, (3) visual
coherence, (4) incremental adoption, (5) future headroom.

Non-goals: Kubernetes, rewriting to one framework, microservices, anything needing a team.

## The provisional pick

### Source layout — Option 3 variant: hub + federated satellites

A new small repo `cuatro-ecosystem` owns: design tokens (published to npm), reusable GitHub
Actions workflows, the app registry that feeds the portfolio hub, and the deploy layer
(Compose fragments, Traefik config). The 15 satellites stay independent and each carries two
frozen files: a one-line `renovate.json` and a workflow caller stub.

**Option 4 (merge the four Next.js apps) is deferred, not rejected** — gated on whether a
shared React component package actually accumulates real components. If it never does, the
merge buys nothing.

### Deployment — single VPS, Traefik, subdomains

Traefik v3.7 (stock image, Cloudflare DNS-01 via env vars), subdomain routing (already the
incumbent), one Postgres container with one database + one role per app, `docker-rollout` for
zero-downtime, `pg_dump` + restic offsite, PSI per-container monitoring on cgroup v2.
**Cloudflare bot filtering first** — it is the cheapest capacity win available. `cs-tournament`
moves off Vercel to the VPS. Supabase → plain Postgres on the box unless auth/realtime is
genuinely used.

### Design system — tokens only

Style Dictionary → two artefacts: `tokens.css` (plain `:root`, universal) and `tailwind.css`
(generated `@theme inline` adapter). Published publicly to npmjs.com. Propagated by Renovate
shareable presets from one central config repo. No shared component library across frameworks.
Optionally one React-only component package scoped to the Next.js cluster.

### Dev environment

Devcontainers are an independent axis and low priority. The real win is relocating repos from
`C:\` into the **WSL2 ext4 filesystem**.

## Sequencing (provisional)

1. Cloudflare bot filtering on the four live subdomains (hours, immediate visible win)
2. Create `cuatro-ecosystem`; publish v0.1.0 tokens; adopt in `cuatro-portfolio` only
3. Add the app registry to the portfolio → the visible "suite" moment
4. Adopt tokens in the other three live apps, one at a time
5. Rebuild the VPS greenfield on Traefik + one Postgres; migrate apps one subdomain at a time
6. Move `cs-tournament` off Vercel
7. Relocate repos into WSL2
8. Revisit the Next.js merge only if a shared component package has earned itself

## Your job

Attack this. The full evidence base is in `research.md` in the same folder — read it.
