# Research brief: Cuatro Ecosystem architecture

**Type:** technical · **Shape:** select · **Preset:** deep · **Validation:** normal · **Red team:** on
**Created:** 2026-08-15

## The decision

Choose a **source layout**, a **deployment topology**, and a **design-system strategy**
for unifying 15 heterogeneous personal projects into one coherent "Cuatro Ecosystem"
suite, with `cuatro-portfolio` as the hub, deployed to a single VPS.

The three are treated as **separable sub-decisions**; the report must state explicitly
where they couple and where they do not.

## Candidates

| # | Option |
|---|---|
| 1 | **Full monorepo**: all 15 projects in one repo, one toolchain, one CI, shared packages |
| 2 | **Polyrepo unchanged**: 15 independent repos, unified only at deploy time via reverse proxy |
| 3 | **Hub + federated satellites**: one ecosystem repo owning tokens, deploy layer, app registry; satellites independent |
| 4 | **Partial monorepo**: merge only the Next.js cluster; rest independent |
| 5 | *Reserved*: to be proposed if evidence supports an option not listed |

Option 3 is described in most detail by the requester and must be attacked as hard
as the others. No option is privileged going in.

## Requirements frame (from the requester, not from research)

### Hard gates

- **Solo maintainer.** One person. No option may require a team to operate.
- **No framework rewrite.** Apps are not consolidated onto a single framework.
- **No Kubernetes**, service mesh, multi-region, or microservices decomposition.
- **Incremental source migration.** No step may leave a broken app.

### Confirmed constraints (asked and answered 2026-08-15)

| Input | Value |
|---|---|
| VPS | Hostinger **KVM 2**: **2 vCPU**, **8 GB RAM**, 100 GB disk, 8 TB bandwidth |
| OS / region | Ubuntu 24.04 LTS · US-Boston 2 · `srv1842312.hstgr.cloud` · prepaid to 2028-07-19 |
| Access | SSH from WSL as `deploy@177.7.52.248` |
| Budget ceiling | **$40–100/mo** all-in |
| Real users | **None intended.** Mix of portfolio demos and personal-use tools |
| Live today | `cuatro.dev`, `cs-tracker.cuatro.dev`, `tracker.cuatro.dev`, `library.cuatro.dev`: **subdomain routing is the incumbent** |
| `cs-tournament` PaaS | **Can move** off Vercel/Cloudflare to the VPS |
| Host rebuild | **Wiping the VPS and starting from scratch is explicitly acceptable** |
| Domain registrar | Squarespace (`cuatro.dev`) |
| DNS | **Cloudflare**: makes DNS-01 wildcard ACME cheap; proxy-mode interactions must be checked |
| Existing accounts | **Supabase** and **Railway** both active: managed options carry zero migration cost |

### Consequences of the registrar/DNS/account facts (added mid-run 2026-08-15)

- Cloudflare DNS is first-class for DNS-01 in Traefik; Caddy historically needs a
  custom build for DNS providers: D3a must verify current status and price that into
  the config-burden verdict.
- Cloudflare proxy mode interacts with TLS termination (Flexible mode redirect loops,
  Origin Certificates) and with **long-lived WebSockets**: material because Phoenix
  LiveView holds a persistent socket.
- **Railway must be screened as a candidate deploy target**, not ignored. A hybrid
  VPS + Railway topology is a live option and is evidence-gathered in D3b.
- Managed Supabase is a zero-migration-cost option; the DB question is a three-way
  (self-hosted Supabase vs managed Supabase vs plain Postgres), not a two-way.

### Ranked weighted criteria

1. Solo-maintainer sustainability (highest)
2. Portfolio value: the architecture is itself a public showcase
3. Visual coherence: must *feel* like one product
4. Incremental adoption
5. Future headroom: absorb one new project without restructuring

### Resolved tension (logged)

The original prompt forbids a big-bang cutover; the requester then stated the VPS may
be wiped and rebuilt. These reconcile as: **source-layout migration must be
incremental; the host may be rebuilt greenfield.** Deploy-target churn is cheap here
because no project has real users. This materially lowers the cost of the deployment
sub-decision relative to the source-layout one.

### Binding physical constraint

**2 vCPU is the ceiling, not 8 GB.** Four Next.js SSR runtimes, a BEAM node, a Fastify
API, a Python backend and a Go service contending on two shared cores is the load case.
Any topology recommendation must be argued against CPU, and must name the threshold at
which this outgrows one box.

## Dimensions

| ID | Dimension | Serves sub-question |
|---|---|---|
| D1 | Polyglot monorepo economics: Nx/Turborepo/Bazel/Moon/Pants multi-language reality, CI fan-out, caching across 5 languages, solo-dev discount on team-oriented literature | 1 |
| D2 | Multi-framework design systems: the token-only ceiling vs per-cluster component libraries; concrete token contract, distribution, versioning, cross-framework consumption, propagation without atomic commits | 2 |
| D3 | Single-VPS multi-app topology: Traefik vs Caddy vs nginx, TLS automation, subdomain vs path routing, shared vs per-app Postgres, resource limits, zero-downtime, backups, contention, outgrow threshold | 3 |
| D4 | Devcontainers' actual fit (is "monorepo *or* devcontainers" a false dichotomy?) and Windows git-repo relocation breakage | 4, 7 |

### Not web-researched: derived at synthesis, marked inferred

- **Sub-question 5**: merge/keep/archive calls on the four trackers and three empty shells.
- **Sub-question 6**: migration sequencing.

Both are judgments over the requester's own project facts. They will be written from
the D1–D4 verdicts and explicitly flagged as inferred rather than verified.

## Epistemics

1. **Never conclude from training data alone.** Prior knowledge proposes queries and
   structure; conclusions require evidence retrieved this run.
2. **Research firewall.** This brief shapes *what to ask*, never *what is true*.
   Researchers receive their sub-brief and nothing else: no project files, no
   repository access, no ambient context. Every claim traces to a digest with a
   publisher and a date.

## Freshness bars (technical pack)

versions & compatibility ≤ 1 mo · ecosystem signals ≤ 6 mo · landscape ≤ 12 mo ·
patterns ≤ 2 yr · **pricing ≤ 3 mo** (select shape) · **screening sources ≤ 6 mo**

## Two-source classes

Technical pack: version/compatibility claims · performance or scale numbers a
recommendation rests on · claims that a technology or pattern failed.
Select shape adds: pricing figures · any cell deciding between the top two finalists.

## Staleness

A selection report older than two quarters should be refreshed before acting on it.
This one: refresh after **2026-11-15**.
