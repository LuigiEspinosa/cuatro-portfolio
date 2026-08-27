---
title: 'Technical research: Cuatro Ecosystem architecture'
type: 'technical'
shape: 'select'
topic: 'Cuatro Ecosystem architecture'
decision: 'Source layout, deployment topology, and design-system strategy for unifying 15 polyglot personal projects into one suite on a single VPS'
source: 'native run (bmad-deep-recon)'
status: complete
preset: 'deep'
validation: 'normal'
red_team: 'on'
dimensions: 5
claims_verified: 81
claims_unverified: 9
claims_disputed: 1
claims_overturned: 1
recommendation: 'Anchored Hub, cuatro-portfolio becomes a Turborepo monorepo of the four Next.js apps and publishes tokens, reusable workflows and the app registry to independent satellites; 15 repos to 8; tokens-only design system; Traefik on one VPS with a measured capacity gate; managed identity (Clerk) over OIDC; no devcontainers, relocate repos to WSL2'
verified_by: 'red-team pass (3 adversaries), semantic citation check (13 claims / 12 sources, 0 mismatches, 3 corrections applied), editorial review (structure + prose)'
created: '2026-08-15'
updated: '2026-08-15'
refresh_after: '2026-11-15'
---

# Technical research: Cuatro Ecosystem architecture

**Decision this research serves:** Choose a source layout, a deployment topology, and a
design-system strategy for unifying 15 heterogeneous personal projects into one coherent
suite, with `cuatro-portfolio` as the hub, on a single 2 vCPU / 8 GB VPS.

_Sections are appended per the approved research plan; the executive summary is written
last and placed here, first._

_Requirements frame, candidates, constraints and dimension list: see [`brief.md`](brief.md)._

---

## Executive summary

**The recommendation in one sentence: call it the *Anchored Hub*:** make `cuatro-portfolio`
a Turborepo monorepo holding the four Next.js apps *and* the ecosystem's shared contracts,
design tokens, reusable workflows, the app registry, with the remaining projects staying
independent **satellites** that consume those contracts. Archive three empty shells and absorb
one finished toy: **15 repos → 8.**

Two terms used throughout, fixed here: the **anchor** is `cuatro-portfolio` in its new dual
role (merged Next.js cluster + owner of the shared contracts). **Satellites** are the
independent repos that consume those contracts. The **app registry** is a small versioned
manifest, one entry per app: name, URL, one-line description, status, tech, published from
the anchor, rendered as the portfolio's suite directory and consumable by any app that wants
to show an ecosystem switcher.

### The three findings that drive it

**1. Contracts federate; implementations do not.** This is the architectural spine, and it
falls out of combining two dimensions. A shared *component library* cannot span your six
frameworks: Google defunded Material Web (2024-06), GitHub retired Primer ViewComponents
(2026-02), and Adobe deliberately maintains two full implementations with no consolidation
plan. But design tokens (a *format*), OIDC (a *protocol*) and reusable workflows (a
*reference*) all federate cleanly across every stack you own. **Build the ecosystem out of
contracts, never out of shared code.** Everything else follows from this.

**2. CPU is the binding constraint, and it decided more than the deployment question.** Your
box is 2 vCPU / 8 GB: RAM-generous, CPU-poor. The one measured datapoint is a single Next.js
process at **639,880 KB RSS and 103.3% CPU**: though see the caveat below, because that
figure was captured *during a bot crawl*, not at steady state. That constraint then
disqualified most of the self-hosted identity field: **authentik's vendor-stated floor is 2
CPU cores plus its own Postgres, and Logto's stated minimum is 2 vCPU / 8 GiB: your whole
machine.** *(Keycloak is heavy but publishes no minimum; see D5 for the corrected reading.)*
**Deployment and identity looked separable and were not.**

**3. Tokens get you "reads as one author", not "feels like one product".** Tokens federate
everything that is a *value*: color, type, spacing, radii, elevation, motion. Nothing
federates *behaviour*: form controls, focus management, overlays and dense data UI will
differ across apps permanently. That ceiling is worth accepting. For a hiring-manager
audience, six frameworks under one coherent visual identity is arguably a stronger artifact
than one framework repeated fifteen times, and you have said you value the variety.

### The biggest caveat, stated plainly

**Capacity is unproven in both directions, and this report cannot settle it.** 2 vCPU is a
200% budget. Four Next.js apps at the one measured figure would demand 412%: **but that
figure is an attack peak, not steady state**, so 412% is an upper bound on a bad day rather
than expected demand. Equally, the two-source bar was met **zero times** for every other
footprint, so the rest are *unknown* numbers, not small ones. The honest position is that
nobody (including this report) knows whether the estate fits. **Step 1 of the migration
path is a week of `docker stats` with a written stop threshold and Railway named as the
overflow target ($15–30/mo for two apps, comfortably inside your budget).** Do not skip it.

A second caveat worth equal weight: **with no real users, there is no error signal.** Nothing
in this estate will tell you when a token update breaks a layout, a certificate renewal
silently fails, or a LiveView socket misses a logout. That is why external uptime and
certificate-age monitoring is Step 0, *before* any automation, and why Renovate automerge is
removed entirely.

### What to do first

**Step 0, measured in hours:** archive `Lumen`, `tcg-tracker` and `apple-music-workspace`; buy
an external uptime + cert monitor; turn on Cloudflare bot rules for the four live subdomains.
**Step 2 is the smallest step that delivers visible ecosystem value:** hand-copy one
`tokens.css` into `cuatro-portfolio` and one other live app: no npm package, no Renovate, no
machinery. Two apps visibly become one family in an afternoon.

> **This recommendation was substantially rebuilt by an adversarial pass.** The original
> justification was invalid, the capacity plan had no gate, the automerge policy was
> dangerous, and your #2 criterion went unscored. See [Contrary evidence](#contrary-evidence)
>, including the strongest surviving argument *against* this pick, which is not fully
> answered.

### Where each of your seven sub-questions is answered

| # | Sub-question | Answer | Where |
|---|---|---|---|
| 1 | **Source layout** | Anchored Hub (Option 5). Re-evaluate if you ever want one repo for profile reasons. | [D1](#d1--source-layout-polyglot-monorepo-economics) · [matrix](#the-scored-decision-matrix) |
| 2 | **Design system** | Tokens only; concrete two-artefact contract; Renovate-free propagation until earned. | [D2](#d2--design-system-can-components-span-six-frameworks) |
| 3 | **Deployment** | Traefik, subdomains, one Postgres, build in CI, measured capacity gate. | [D3](#d3--deployment-topology-on-one-2-vcpu-vps) · [topology table](#deployment-topology) |
| 4 | **Dev environment** | **Do not adopt devcontainers.** Do the WSL2 move. | [D4](#d4--dev-environment-and-repo-relocation) · [explicit call](#dev-environment--the-explicit-call) |
| 5 | **Consolidation** | 15 → 8. Trackers are one *family*, not one product. | [Per-project calls](#per-project-calls) |
| 6 | **Migration sequencing** | Steps 0–8, trigger-gated after Step 2. | [Sequenced path](#the-sequenced-migration-path) |
| 7 | **Repo relocation** | Yes, but to **WSL2 ext4**, not another Windows folder. | [D4](#d4--dev-environment-and-repo-relocation) · Step 8 |

*Sub-questions 5 and 6 were derived at synthesis from the D1–D5 verdicts rather than
web-researched, and are **marked inferred** as you requested.*

**Reading order.** The dimensions that drive the recommendation are **D1, D2, D3, D5**.
**D4 sits earlier in the file than its importance warrants**: an artifact of the order the
research landed, and its only load-bearing output is Step 8. Skip it on a first read.

**Report contents:** [D1 source layout](#d1--source-layout-polyglot-monorepo-economics) ·
[D2 design system](#d2--design-system-can-components-span-six-frameworks) ·
[D3 deployment](#d3--deployment-topology-on-one-2-vcpu-vps) ·
[D5 identity](#d5--identity-one-login-across-the-ecosystem) ·
[D4 dev environment](#d4--dev-environment-and-repo-relocation) *(supporting)* ·
[Cross-dimension insights](#cross-dimension-insights) · [Contrary evidence](#contrary-evidence) ·
[Recommendations](#recommendations) · [Verification note](#verification-note) ·
[Open questions](#open-questions) · [Staleness map](#staleness-map)

---

## D1: Source layout: polyglot monorepo economics

**Status:** closed on coverage after 2 rounds. Serves sub-question 1.

### The finding that decides it: no orchestrator covers this language set

The case for a monorepo at this scale rests on shared tooling, one build graph, one
cache, one CI. For a JavaScript estate that case is strong. For *this* estate it does not
exist, because no monorepo orchestrator supports the languages involved.

**Turborepo** scopes itself, in its own repository description, to "a build system
optimized for JavaScript and TypeScript" [1]; an independent walkthrough states plainly
that a monorepo "with components in other languages, such as Go or Rust" cannot use it
[16]. Non-JS projects can still be wrapped as opaque shell tasks, but nothing in the
vendor's material claims language-aware graphing or hashing for them: the JS/TS boundary
is a product decision, not a marketing simplification.

**Nx** ships first-party non-JS plugins for Docker, .NET and Maven; Python support is
listed as a 2026 *plan*, and Go, Elixir and Solidity appear in neither the shipped nor the
planned list [2]. Nx 21 added custom version actions so `nx release` can version Go and
Rust packages, but that is release tooling, not build-graph or caching support, and must
not be read as polyglot build support (medium confidence: summary-level source). Nx's
roadmap also closes its language section with "What languages we support next depends on
what you need," so no dated commitment exists [2].

**Pants 2.33** documents backends for Python, Go, Java, Scala, Kotlin and Shell, plus
Docker, Kubernetes, Helm, Terraform and SQL. Elixir, Solidity and Node/TypeScript are not
listed [3]: note that Pants misses the *majority* of this estate from the other direction.

**moon** was the most promising candidate and warranted a second round, because a 2024
maintainer statement that Python and Go get nothing beyond `PATH` execution predates moon
v2.0, which replaced hard-coded platforms with WASM plugin toolchains [7]. Repeating the
stale complaint would have been a false claim, so it was checked. Current state, from
moon's own toolchain configuration reference read 2026-08-15: `go` and `rust` are now
stable first-class toolchains alongside the JS cluster; Python and Ruby exist only under
an `unstable_` prefix; **Elixir and Solidity are absent entirely** [6]. So the 2024
complaint is now wrong for Go, half-wrong for Python, and still fully correct for Elixir
and Solidity. moon does allow a user to supply their own `.wasm` toolchain plugin [6],
but authoring one is a Rust/WASM development project, not configuration, and must be
priced as such. Whether any community Elixir or Solidity plugin exists was not
established; that is an untested assumption, not a negative finding.

> **Convergent negative finding.** Across four independent tool ecosystems: Nx,
> Turborepo, moon, Pants: Elixir/Mix support is not weak, it is *absent*. There is also no
> open-source Bazel ruleset for Elixir; practitioners on the Elixir Forum in 2025-11
> describe that ecosystem as "pretty early" and report deliberately separating Elixir
> tooling from their other languages, staying on Mix-native `elixir-workspace` [5].
> Solidity fares no better: no first-party plugin in any of the eight tools examined.

### The one tool that does span languages, and why it is not the answer

Bazel genuinely handles polyglot builds. Its problem is cost, not capability. Kubernetes
migrated *off* Bazel to Make, and the maintainers' stated reasons were build-infrastructure
complexity, onboarding friction, contribution barriers and maintenance burden [4]. That is
a project with vastly more maintainer capacity than one person choosing to stop paying
Bazel's tax. The paper's quantified build-time penalties were not verifiable within budget
and are deliberately not cited here.

### Discounting the literature for a solo maintainer

The prompt asked for this explicitly, and it turns out to cut both ways.

Proton moved ~15 repositories into a monorepo with ~15 front-end developers; the stated
driver was mirroring "branching, committing, opening merge requests, reviewing, rebasing"
across repos [8]. Every benefit Proton names: atomic multi-repo change, cross-project
visibility "encourag[ing] developers to contribute across projects they don't directly
own", unified governance across teams, one-click onboarding: is a coordination benefit
between people.

The mainstream *anti*-monorepo case is equally team-shaped. Ken Muse's costs are merge
queues delaying releases, minor changes forcing larger deployments, notification overload,
and contractor access boundaries [12]. At N=1 there is no merge queue, no access boundary,
no notification fan-out.

**Both sides of the standard argument therefore fail to bind here.** What survives at N=1,
on the evidence:

| Survives at N=1 | Source |
|---|---|
| Atomic cross-project change and rollback: "no single operation could perform a rollback on separate Git histories simultaneously" | [8] |
| Dependency version-chain coordination: Losoviz, working *alone* across ~200 packages, was defeated by version-of-a-version chains, not by people | [11] |
| **Project liveness and audience navigation signal** | [9] |

That third row is the strongest surviving pro-monorepo argument, and it is the one that
maps onto this decision. Streamdal consolidated ~10 repos in about a week of hands-on work,
and the driver was *perception*: the flagship repo read "Last updated: 6 months ago",
GitHub's language bar showed only shell and markdown, and users could not tell which repo
to file a bug against [9]. For a public portfolio of 15 projects, that is not a side
benefit: it is close to the point. The same author still calls monorepos "mostly terrible"
in general and frames the migration as justified by discoverability rather than engineering
economics [9], which is the strongest anti-hype signal retrieved, and it comes from someone
who migrated *in*.

### Costs that do not apply here

Git scale pain is driven by commit count, ref count and history depth, not project count.
Grab's monorepo hit 214 GB, ~13M commits and 12.2M refs before clone time reached 7.9
minutes; 99.9% of their remediation came from deleting commits and refs, while deleting 59%
of bytes bought only a 36% clone improvement [10]. Those quantities accumulate per
contributor-year. Fifteen personal projects cannot approach them.

Correspondingly, **modern git tooling is a non-factor at this scale and argues neither
way.** `scalar` is scoped by the git project to "large repositories" with no published size
threshold [14], and GitHub's own guidance recommends full clones when a repository is
"reasonably-sized", advises developers against treeless clones, and advises against shallow
clones except for builds deleted immediately [15]. A ~15-project personal repository is
squarely inside "reasonably-sized."

### The hub-and-satellite pattern: its documented failure has been fixed

Option 3 has a real name and a real precedent: the **multi-monorepo** or federated
pattern, an upstream repo consumed by downstream repos via submodule, sharing workflows and
config downward [11]. Its documented failure mode was abstraction leakage, and specifically
that "GitHub Actions only loads workflows from `.github/workflows`, so shared workflows must
be manually copied downstream despite upstream being the declared source of truth" [11].

That complaint is from 2021 and it no longer holds. GitHub Actions reusable workflows are
called cross-repository as `{owner}/{repo}/.github/workflows/{file}@{ref}`, documented as
working for private repositories, with SHA pinning described as "the safest option for
stability and security" [13]. The documented limits, ten nesting levels, no loops, no
environment secrets via `workflow_call`, permissions may only narrow, matrix outputs report
the last successful leg: none of which bind a solo developer with one level of nesting
[13].

**Residue:** each satellite still needs its own ~10-line caller stub containing `on:` and
`uses:`. Central *definition* is solved; central *installation* is not. Organization
rulesets could remove even the stub but appear to be Enterprise-gated: medium confidence,
snippet-only, re-verify before relying on it [13].

### Reversibility

Roughly one focused week at 10–15 repos: Proton used a scheduled weekend cutover [8],
Streamdal about a week [9]. Cheap enough not to agonise over; expensive enough not to do
twice.

### Documented re-evaluation triggers

Notably, **none of the four triggers found is performance**: cross-repo change ceremony
[8], dependency version-chain unmanageability [11], needing a public/private split within
one repo [11], and a flagship repo that looks stale to its audience [9].

### Honest gaps in this dimension

- **There is zero published study on solo or very-small-maintainer repository layout** [D1b
  digest]. This is a genuine gap, not a search failure: the literature is written by and
  for teams. Every solo-specific conclusion above is team evidence with the team-dependent
  parts subtracted, and is marked as such.
- The two-source bar for "a monorepo failed for someone" was **not met**, so no such claim
  is made here.
- No measured CI fan-out numbers for a polyglot monorepo exist in any source retrieved.
- moon's current version number is contradictory across sources (a releases snippet says
  2.4.6; the docs badge a feature as added in 2.5.0) and its v2.0 GA date is disputed
  (2026-02-18 vs a 2026-05 secondary URL). **No moon version should be quoted downstream
  without reading the releases page directly** [6][7].
- Nx `affected` marks all projects affected on any lockfile change, mitigated by
  `projectsAffectedByDependencyUpdates: "auto"`; the version introducing the mitigation was
  not established, so the currency of the complaint is uncertain.

### D1 sources

| # | Source | Publisher | Date | Accessed |
|---|---|---|---|---|
| 1 | [vercel/turborepo](https://github.com/vercel/turborepo) | Vercel (primary) | current at access | 2026-08-15 |
| 2 | [Nx 2026 roadmap](https://nx.dev/blog/nx-2026-roadmap) | Nx / Nrwl (primary) | 2026-02-04 | 2026-08-15 |
| 3 | [Welcome to Pants](https://www.pantsbuild.org/dev/docs/introduction/welcome-to-pants) | Pants Build (primary) | dev channel | 2026-08-15 |
| 4 | [The Cost of Downgrading Build Systems: Kubernetes](https://arxiv.org/abs/2510.20041) | Ranjan, Alfadel, Sun, McIntosh (arXiv) | 2025-10-24 | 2026-08-15 |
| 5 | [Monorepository tooling thread](https://elixirforum.com/t/any-tips-or-advice-for-monorepository-tooling/73165) | Elixir Forum (practitioners) | 2025-11-04 | 2026-08-15 |
| 6 | [moon toolchain config](https://moonrepo.dev/docs/config/toolchain) | moonrepo (primary docs) | current at access | 2026-08-15 |
| 7 | [moon v2.0 announcement](https://moonrepo.dev/blog/moon-v2.0) | moonrepo (primary) | 2026-02-18 (disputed) | 2026-08-15 |
| 8 | [From polyrepo to monorepo](https://proton.me/blog/engineering-polyrepo-monorepo) | Proton Engineering | 2022-08-18 | 2026-08-15 |
| 9 | [Mostly terrible: the monorepo](https://medium.com/streamdal/mostly-terrible-the-monorepo-5db704f76bdb) | Streamdal / D. Selans | 2024-01-03 | 2026-08-15 |
| 10 | [Taming the monorepo beast](https://engineering.grab.com/taming-monorepo-beast) | Grab Engineering | 2025-09-16 | 2026-08-15 |
| 11 | [Single repo → multi-repo → monorepo → multi-monorepo](https://css-tricks.com/from-a-single-repo-to-multi-repos-to-monorepo-to-multi-monorepo/) | CSS-Tricks / L. Losoviz | 2021-08-17 | 2026-08-15 |
| 12 | [Why you should not prefer monorepos for git](https://www.kenmuse.com/blog/why-you-should-not-prefer-monorepos-for-git/) | Ken Muse (independent) | 2023-06-23 | 2026-08-15 |
| 13 | [Reusing workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows) | GitHub (primary) | living doc | 2026-08-15 |
| 14 | [git scalar](https://git-scm.com/docs/scalar) | git project (primary) | git 2.53.0 | 2026-08-15 |
| 15 | "Get up to speed with partial clone and shallow clone": GitHub Blog. **⚠ Exact article URL not captured; the appendix held only the bare domain. Re-locate before citing.** | GitHub / D. Stolee | 2020-12-21, upd. 2021-04-28 | 2026-08-15 |
| 16 | [Build a monorepo with Turborepo](https://earthly.dev/blog/build-monorepo-with-turporepo/) | Earthly | n/a | 2026-08-15 |
| 17 | [Multi vs mono repo](https://www.indiehackers.com/post/multi-vs-mono-repo-pros-cons-380cb63ae6) | Indie Hackers (community) | 2020-02-18 | 2026-08-15 |

_Freshness note: [15] and [17] fall outside the 12-month landscape window and [11], [12],
[8] outside the 2-year pattern window. Each is cited as history or as primary guidance with
no newer official replacement located, and is labelled where it matters._

---

## D4: Dev environment and repo relocation

> **Supporting material: skip on a first read.** This section sits earlier in the file than
> its importance warrants (an artifact of research order). Its only load-bearing output is
> **Step 8, the WSL2 relocation**, and the decision it feeds is
> [*do not adopt devcontainers*](#dev-environment--the-explicit-call). The dimensions that
> drive the recommendation are D1, D2, D3 and D5.

**Status:** closed after 1 round, with four sub-items explicitly unevidenced. Serves
sub-questions 4 and 7.

### "Monorepo *or* devcontainers" is a false dichotomy: corrected

The framing is wrong, and the evidence is structural rather than rhetorical. The two
decisions answer different questions:

- **Repository layout** answers *where code lives relative to other code*: colocation,
  atomic commits, one dependency graph, one CI trigger surface.
- **Dev containers** answer *what toolchain a folder gets when you open it*. A
  `devcontainer.json` describes an image, features and lifecycle commands for **a workspace
  folder**, not for a repository.

The decisive evidence is that the Dev Container Specification explicitly accommodates
*many* dev containers inside one repository, via `.devcontainer/{name}/devcontainer.json`
with the tool prompting which to build [19]. That is devcontainers *with* a monorepo, as a
supported layout. The one-repo-one-`.devcontainer` case is the documented default
everywhere: devcontainers *with* a polyrepo. Both combinations are documented and in use.

**The real axes are: (1) source layout, one repo or many; (2) environment provisioning,
host-native toolchain managers or containerised toolchains. Pick each independently.**

Two genuine interactions, neither a coupling:

1. Multiple `devcontainer.json` files under `.devcontainer/` is implemented in GitHub
   Codespaces but was **reported as not implemented in the VS Code Dev Containers
   extension** [19]. Medium confidence: issue-thread snippets whose state may have changed.
   Verify before this drives anything.
2. A monorepo pushes toward *one* container definition covering N language runtimes: a
   fatter image; a polyrepo gives N small ones. A sizing consequence, not a coupling.

### Are devcontainers worth adopting on their own merits?

Qualified, and less urgent than the framing implies.

**Maturity.** `@devcontainers/cli`, the specification's reference implementation, is at
**0.88.0 (June 2026)** on a roughly 2–4 week cadence, and remains **pre-1.0 after years of
releases** [20]. Actively maintained; not declared stable.

**Editor-agnostic? Not really.** containers.dev's own supporting-tools page lists VS Code
with full support, Visual Studio 2022 17.4+ limited to **C++/CMake Presets only**, IntelliJ
IDEA described as **early-stage**, and Emacs as a community package [18]. JetBrains' own
2026.2 help documents working support but defers every constraint to a separate limitations
page carrying an October 2024 update stamp [21]. Implementations also diverge on which
`devcontainer.json` properties they honour: CodeSandbox ignores `forwardPorts`, Codespaces
does not support `bind` mounts other than the Docker socket [18]. A `devcontainer.json` is
not automatically portable across hosts.

**Alternatives are complements, not substitutes.** containers.dev itself lists Cachix
devenv (which auto-generates `.devcontainer.json`) and Jetify Devbox as supporting tools
[18]. `mise` is reported as lower-ceremony but less reproducible: "a new minor version can
leak in" (low-medium confidence, secondary source).

### The finding that outranks the devcontainer question entirely

> **On Windows, the dominant avoidable cost is repository *placement*, not
> containerisation.**

Microsoft's current guidance (page updated **2026-06-02**) is unambiguous: "We recommend
against working across operating systems with your files… For the fastest performance
speed, store your files in the WSL file system if you are working in a Linux command line."
Explicitly: use `/home/<user>/Project`, **not** `/mnt/c/Users/<user>/Project` or
`C:\Users\<user>\Project` [22].

The same penalty reappears inside containers: VS Code documents that on Windows and macOS
"bind mounts are not as fast as using the container's filesystem directly", because
containers run in a VM. Its recommended mitigations are storing source in the **WSL 2
filesystem**, or using a Docker **named volume** via "Clone Repository in Container
Volume…" [23].

**This reframes sub-question 7.** The relocation worth doing is not
`C:\Development` → some other Windows folder. It is **`C:\...` → the WSL2 ext4 filesystem**.
A move that merely relabels the Windows path pays the churn and buys none of the
performance. If the repos land in `\\wsl$`, VS Code should attach via WSL remote, and
note the corollary that Windows-native tools reaching in via `\\wsl$` pay the penalty in
the other direction.

**On magnitude: refused.** Neither Microsoft page nor the VS Code page publishes a single
measurement; both are purely directional [22][23]. Third-party figures in circulation
("~6% of native", "10–20× slower") are uncorroborated snippets and are **not quoted here as
fact**. Any decision framed on "10–20×" is resting on blog posts. The *direction* is solid
and primary; the ratio is not.

### What actually breaks when you move a git repo on Windows

| Thing | Breaks? | Fix |
|---|---|---|
| Plain repo, no worktrees/submodules | **No** | Nothing: *inference, not directly sourced* |
| `git worktree` (either main or linked moved) | **Yes** | `git worktree repair`. `worktree.useRelativePaths` **defaults to `false`**, so absolute paths are the default; set it true to make worktrees move-tolerant. `git worktree move` refuses on the main worktree and on linked worktrees containing submodules [24] |
| Submodules | **Mostly no** | Gitdirs absorbed into `$GIT_DIR/modules` use a *relative* path, which is what lets them survive a move. `git submodule absorbgitdirs` before moving. *Medium confidence: snippet-level, verify* [25] |
| `safe.directory` | **Yes, likely** | `fatal: detected dubious ownership`: git 2.35.2 / CVE-2022-24765. Add `safe.directory` entries or fix ownership. Existing entries are absolute and go stale on a move (*that clause is inference*) [26] |
| `MAX_PATH` on deep trees | **Yes** | `core.longpaths true`; **OS-level long-path enablement is separately required** for non-git tools [27] |
| Case sensitivity crossing filesystems | **Yes** | Files differing only in case collide moving `\\wsl$` → `C:\`; case-only renames go undetected on `C:\` [22] |
| WSL path translation | **Yes, by construction** | Any tooling holding `/mnt/c/...` or `C:\...` strings is wrong after the move [22] |
| **IDE workspace files (`.code-workspace`, `.idea`)** | **UNEVIDENCED** | Not established |
| **Docker Compose absolute bind mounts** | **UNEVIDENCED** | Not established |
| **`core.filemode` / symlinks / Developer Mode** | **UNEVIDENCED** | Not established |
| **OneDrive-synced folders** | **UNEVIDENCED** | Not established |

**Four of eight relocation sub-items are unevidenced and are marked as such rather than
filled in from plausibility.** They are named in the open-questions register.

**Order of operations: no published guidance exists.** No vendor runbook, no git doc, no
widely-cited practitioner post was found. The sequence below is **synthesis, not citation**:

1. Commit/stash and push everything; `git status` clean per repo.
2. Enumerate `git worktree list` **before** moving; either set
   `worktree.useRelativePaths=true` or plan a repair pass.
3. Prefer `git worktree move` over a filesystem move.
4. `git submodule absorbgitdirs` before moving.
5. Move: **copy first, delete after verification**.
6. Post-move: `git worktree repair`; `git status` and `git submodule status` per repo; add
   `safe.directory` entries; enable `core.longpaths` before the first deep checkout.
7. Re-point external absolute paths last: IDE workspace files, compose bind mounts,
   scripts, scheduled tasks.

### Honest gaps in this dimension

- **No primary or corroborated number exists anywhere for the ongoing cost of devcontainers
  at 6–12 months**: rebuild times, per-project disk consumption, or the burden of
  maintaining N definitions. Microsoft publishes no disk-footprint guidance. This is a gap
  in the public record, not merely in this run's budget, and it is directly relevant to a
  100 GB disk budget.
- Docker Desktop's WSL2 `docker-desktop-data` VHDX growth (and `wsl --manage --set-sparse`)
  was not examined and is directly relevant to disk.
- The spec's own version and governance status, distinct from the CLI's 0.88.0, was not
  established.

### D4 sources

| # | Source | Publisher | Date | Accessed |
|---|---|---|---|---|
| 18 | [containers.dev/supporting](https://containers.dev/supporting) | Dev Container spec site (primary) | undated | 2026-08-15 |
| 19 | [devcontainers/spec#159](https://github.com/devcontainers/spec/issues/159), [vscode-remote-release#7548](https://github.com/microsoft/vscode-remote-release/issues/7548) | Microsoft / spec org | issue threads | 2026-08-15 |
| 20 | [devcontainers/cli CHANGELOG](https://github.com/devcontainers/cli) | devcontainers org (primary) | 0.88.0, 2026-06 | 2026-08-15 |
| 21 | [Connect to a dev container](https://www.jetbrains.com/help/idea/connect-to-devcontainer.html) | JetBrains | 2026.2 help, upd. 2024-10-23 | 2026-08-15 |
| 22 | [Working across file systems](https://learn.microsoft.com/windows/wsl/filesystems) | Microsoft Learn (primary) | **updated 2026-06-02** | 2026-08-15 |
| 23 | [Improve container performance](https://code.visualstudio.com/remote/advancedcontainers/improve-performance) | Microsoft / VS Code (primary) | undated | 2026-08-15 |
| 24 | [git-worktree](https://git-scm.com/docs/git-worktree) | The Git project (primary) | current | 2026-08-15 |
| 25 | [git-submodule](https://git-scm.com/docs/git-submodule) | The Git project | snippet-level | 2026-08-15 |
| 26 | `safe.directory` / CVE-2022-24765: Atlassian KB, JetBrains YouTrack SUPPORT-A-662, Microsoft Learn Q&A | three independent vendors | git 2.35.2 | 2026-08-15 |
| 27 | `core.longpaths`: Atlassian Bamboo KB, andrewlock.net, daily.dev | three consistent secondary | n/a | 2026-08-15 |

---

## D2: Design system: can components span six frameworks?

**Status:** closed on coverage after 3 rounds. Serves sub-question 2 and the prompt's headline
question.

### The direct verdict

> **No. Only a token layer federates. A shared component library cannot realistically span
> Next.js, React/Vite, Svelte, Vue, Angular and Phoenix LiveView.**
>
> This is stated plainly because you asked for it plainly. The evidence is behavioural and
> convergent: **the two best-resourced attempts in the industry both died**, and the vendors
> who kept going pay for duplicate implementations on purpose.

**Google defunded the single best attempt.** Material Web: the Lit-based web-component
implementation of Material 3, the most credible "one component set for every framework"
effort ever staffed: went into maintenance mode on **2024-06-10**, with engineers reassigned
to Google's internal Wiz framework. New features and components are no longer planned and PRs
are not accepted by default; Google's staffing was withdrawn with "ongoing support will
require volunteer time" [28]. A December 2025 comment asking about a restart sits unanswered
[28].

**GitHub retired the closest analogue to your exact problem.** Primer shipped both
`@primer/react` and `primer/view_components` (Rails, server-rendered ERB): a JS-framework
cluster and a server-rendered cluster sharing one visual system, which is structurally your
Next.js cluster plus Phoenix LiveView. As of **February 2026** `primer/view_components` is in
maintenance mode, citing "GitHub's move to React-based interfaces", taking no new components
and directing internal consumers to Primer React [32]. **The canonical precedent was resolved
by deleting the server-rendered half, not by unifying it.**

**Adobe pays for duplication deliberately.** Spectrum ships React Spectrum / React Aria *and*
Spectrum Web Components, because "we have applications built in many different frameworks, the
most common of which is React" and the React library's API was designed around React's
lifecycle and context. There is no stated consolidation plan and maintainers concede "there
will be differences" [29]. A third artefact, `swc-react`, wraps the web components for React,
so even inside one vendor with vastly more resources than a solo developer, which
implementation is canonical remains unresolved.

**Every verified precedent lands on the same shape:** a web-component core, plus per-framework
wrappers, plus community ports for the tail. IBM Carbon is React-first with official web
components; Angular, Vue and Svelte are **community**-supported rather than core-team
maintained [30]. Nobody ships one component consumed natively by all frameworks without a
wrapper.

The nearest thing to a counter-example is Nordhealth's Nord, which markets web components
plus tokens as working with "plain HTML, React, Vue, or any framework" [31]: a live
commercial instance of the WC-plus-tokens shape including the server-rendered case. It is
reported here at **low confidence**: that is the vendor's own marketing surface, it was not
checked against the repository, and it discloses neither the underlying web-component
library, nor SSR support, nor team size. It does not disturb the verdict.

**And Primer, the one system examined in detail, shares tokens and only tokens.**
`@primer/primitives` is JSON built with Style Dictionary and distributed as themed CSS
custom-property files, feeding the React, Rails and CSS implementations independently;
components and behaviour are reimplemented per stack [33].

### Where the ceiling actually is

The honest formulation, and the one that survives scrutiny:

> **Tokens federate everything that is a *value*. Nothing federates a *behaviour*.**

| Holds with tokens alone | Drifts without shared components |
|---|---|
| Color, including semantic roles and light/dark theming | Form controls: focus rings, invalid states, keyboard handling, label association |
| Type scale, spacing scale, radii, elevation | Focus and keyboard interaction states: tokens carry the *color* of a focus ring, not *when* it appears |
| Motion durations and easings | Dense data UI: tables, date pickers, comboboxes, modals (focus trap, scroll lock, portal strategy) |

**Confidence caveat, stated rather than buried:** the left column is well-evidenced, those
are pure value layers expressible as CSS custom properties consumed identically by all six
stacks. The right column is **inference from structural evidence** (what these systems chose
to ship and where they chose to spend engineering), not from organisations reporting their own
outcomes. No first-hand retrospective quantifying where token-only coherence breaks was found
in three rounds of searching.

**How close does that get you to a "suite" feel?** Further than the framing suggests, though
the honest answer is that **nobody has published a measurement of this**: see this
dimension's gap list. What *is* evidenced is that color, type, spacing, radii, elevation and
motion are precisely the payload Primer distributes to three unrelated implementations [33];
a system with GitHub's resources chose that as the layer worth federating. What you will not
get is *behavioural* parity: a date picker in the Angular app will feel different from the one
in the Next.js app no matter how identical their colors. **The defensible claim is that the
ceiling is "reads as one author", not "feels like one product"**: and for a portfolio suite
that is an acceptable place to stop.

### Why web components are not the escape hatch

They are closer than in 2021, and it would be a false claim to repeat the old objections
unqualified. Two of the three classic blockers are genuinely fixed:

- **Form participation: FIXED.** Form-associated custom elements are Baseline **widely
  available since 2025-09-27** (Chrome 77, Edge 79, Firefox 98, Safari 16.4). Repeating this
  as a blocker in 2026 would be wrong. *(Single-source; below this run's two-source bar.)*
- **Styling across the shadow boundary: FIXED for tokens.** `::part()` has been Baseline
  widely available since July 2020, and CSS custom properties pierce the shadow boundary by
  design, which is exactly how Primer ships its themes [33].
- **SSR: NOT FIXED.** `@lit-labs/ssr` remains **pre-1.0 in Labs** (4.1.0, ~2026-05),
  self-described as pre-release that may break or be dropped [36].

And the seam that matters most for you:

**Declarative Shadow DOM** shipped in Chrome/Edge 111 (2023-03), Safari 16.4 (2023-03-27) and
Firefox 123 (2024-02-20); Baseline **"newly available" since 2024-02-20 and not yet "widely
available"** as of 2026-08-15, with the 30-month flip due around 2026-08-20; caniuse reports
94.27% global support [34]. But **React will not convert `<template shadowrootmode>` into a
shadow root**, producing SSR hydration mismatches: corroborated across `facebook/react`
issues #33698 (2025-07-04, React 19.0/19.1) and #26071 (React 18.2) [35]. Issue #33698 was
closed as *not planned*, labelled stale and unconfirmed, with no maintainer reply, so this is
corroborated as **reported-and-unfixed, not React-acknowledged**. The workaround is
`hydrateShadowRoots()` from `@webcomponents/template-shadowroot`.

React 19 *did* fix the client-side half: objects and arrays pass as properties, custom events
work without manual refs [35]. So "React 19 fixed web components" is **half true: client-side
interop improved; SSR/DSD did not**: and SSR is exactly where a suite containing both Next.js
and Phoenix LiveView lives.

### The Phoenix LiveView outlier

Phoenix does not consume design systems as components at all, which turns out to make the
token story *easier*, not harder.

**Phoenix 1.8.0 (2025-08-05) ships Tailwind v4 plus daisyUI** with a light/dark toggle in the
layout, and deliberately **trimmed** `core_components.ex` to only the main building blocks.
Every Phoenix UI library surfaced (SaladUI, Petal, PrimerLive, Fluxon, Mishka Chelekom) is
HEEx plus Tailwind; **none is web-component based** [42]. Phoenix consumes design as Tailwind
classes and CSS custom properties.

LiveView v1.2.9 does document three client-owned-DOM mechanisms: `phx-update="ignore"`,
`phx-hook` with a full lifecycle, and the `LiveSocket` `dom` option's `onBeforeElUpdated`,
which the docs recommend for libraries needing broad DOM management [46]. **Notably, those
pages never use the words "custom element", "web component" or "shadow DOM"**: the story is
generic "client-side libraries" and custom-element support is left to be inferred. Whether
custom elements break under LiveView patching is **unproven either way** by this run; four
forum threads with exactly the predicted titles were surfaced but not read to the two-source
bar. Since the verdict is tokens-only, this is moot for the recommendation: it would only
matter if you pursued shared components, which the evidence says not to.

**No published design system serving both a Phoenix/LiveView app and a JS-framework app was
found** across multiple searches [D2-r2-2 digest]. That part is genuinely unwritten territory,
you would be building it without precedent to copy.

### The concrete token contract

This is buildable today, and every piece below was verified against primary documentation.

**Format.** The W3C DTCG **Design Tokens Format Module reached its first stable version,
2025.10, on 2025-10-28**: covering theming, multi-brand, Oklch/Display-P3 and aliases [37].
It is safe to build on. *(Resolver stability was not addressed in the announcement.)*

**Build.** **Style Dictionary 5.5.1** is current, defaults to DTCG JSON output, targets the
2025.10 spec, and ships roughly monthly [38]. 5.5.1 patched a prototype-pollution
vulnerability in `convertTokenData`, so **do not pin below it**. *(Exact release dates are
unverified (a source returned impossible 2024 stamps) but version numbers are solid.)*
Terrazzo is alive and shipping but its **CLI is still 0.7.2, pre-1.0** [39]: an unstable
entry point for a 15-repo contract.

**The Tailwind v4 problem, and its fix.** A plain external CSS file defining custom properties
under `:root` **generates zero utility classes**: `bg-brand` will not exist. Tailwind's own
docs are explicit: theme variables "also instruct Tailwind to create new utility classes",
and `:root` is for "variables that shouldn't have corresponding utility classes" [40]. There
is **no mechanism for `@theme` to auto-adopt `:root` variables**: the docs are the exact place
such a feature would be documented and they spell out the opposite [40].

Two documented mechanisms make this cheap anyway:

1. **`@theme` blocks can live in a shared, NPM-publishable CSS file.** Tailwind documents
   exactly this: "You can put shared theme variables like this in their own package… or even
   publish them to NPM and import them just like any other third-party CSS files" [40].
   Ordering matters: `@import "tailwindcss"` first, then the theme file. `--*: initial` wipes
   the default palette; use it only for a deliberately closed palette.
2. **`@theme inline` bridges to an external variable**: and `inline` is **mandatory** for
   runtime theming. Without it, `--color-brand: var(--token-brand)` resolves *where
   `--color-brand` is defined* (`:root`), so a `[data-theme="dark"]` override deeper in the
   tree is **silently ignored** [40].

**Therefore the contract publishes two artefacts from Style Dictionary:**

| Artefact | Contents | Consumed by |
|---|---|---|
| `tokens.css` | Plain `:root` / `[data-theme=…]` custom properties | Svelte, Vue, **Angular**, **Phoenix**, and every non-Tailwind consumer |
| `tailwind.css` | Generated adapter: `@import "./tokens.css"; @theme inline { --color-brand: var(--token-color-brand); … }`, one line per token that should mint a utility | The Next.js / Tailwind cluster |

The adapter is mechanical and generatable, so "restate every value" is a **build-step cost, not
an authoring cost**.

**Phoenix consumption: vendoring, and only vendoring.** Phoenix drives esbuild and tailwindcss
through Elixir/Hex wrappers around standalone binaries, so "newly generated applications do not
have dependencies on Node.js": **there is no `package.json` and no `node_modules` by default**
[41]. npm is opt-in per package and drags Node into every deploy and CI runner. Crucially,
**vendoring is Phoenix's own sanctioned pattern**: the v1.8.0 installer commits `daisyui.js`
(251,614 bytes) and `daisyui-theme.js` (46,759 bytes) into the app, upgraded via `curl`
commands in `app.css` comments [42]. A vendored `tokens.css` copied into `assets/css/` and
`@import`ed is the identical mechanism, one more file. **daisyUI theming is CSS-custom-property
based** (`--color-primary`, `--color-accent`, `--radius-field`, `--border`, `--depth`…) [43],
which is what makes the contract land.

> **One thing to settle empirically before writing code:** whether
> `@plugin "daisyui/theme" { --color-primary: var(--token-brand); }` accepts a `var()`
> reference. Undocumented either way. The safe documented fallback is plain CSS,
> `[data-theme="x"] { --color-primary: var(--token-brand); }` [43]. Cheap to test in a scratch
> `mix phx.new` app.

**Angular consumption: trivial.** Add the token file to the `styles` array in `angular.json`
[44]. `ViewEncapsulation.Emulated` is a non-issue: it stops a component's styles leaking
*out*, and Angular's docs state directly that "global styles defined outside of a component may
still affect elements inside a component with emulated encapsulation" [45]. *(That custom
properties specifically inherit through is CSS-cascade reasoning on top of that quote,
labelled as inference.)*

### Propagating a change across 15 repos without atomic commits

This is the hardest part of sub-question 2, and it resolves cleanly.

**Versioning semantics.** A color *value* change is a **minor** bump; a token *rename*: even
fixing `colour` → `color`: is **major**. Contract changes break, pixel changes don't. Without
atomic commits the only workable model is **deprecate → migrate → remove** [50].

**Publish publicly to npmjs.com.** GitHub Packages requires "an access token to publish,
install, and delete private, internal, and public packages" (auth even for *public* packages)
which would mean an `.npmrc` token on every dev machine and every CI job across 15 repos [48].
Public npm needs `npm publish --access public`, a free account and 2FA, with **zero consumer
auth**. For tokens that are not secret, there is no reason to choose GitHub Packages.

**Renovate, not Dependabot**: and the deciding feature is shareable presets, not grouping.
Renovate **44.30.3** (2026-08-15, ~2–3 releases/day) supports `extends: ["github>owner/repo"]`,
resolving to `default.json` on that repo's default branch and pinnable by tag as `#1.2.3`; the
docs frame it explicitly as holding config "in one location rather than having to copy/paste it
to every repository individually" [47]. **Dependabot has no cross-repo config inheritance at
all** [47].

> **Folklore correction:** Dependabot *does* now support grouping (`groups` with `patterns`,
> `exclude-patterns`, `update-types`, `group-by`). What it still lacks is shareable central
> config and any native automerge [47]. The common claim that Dependabot "can't group" is out
> of date.

**Two things that do *not* work**, both worth stating because they are the obvious guesses:

- **GitHub template repositories are one-time scaffolds only.** "Branches created from a
  template have unrelated histories" and no propagation mechanism is documented [49]. Useful
  for creating repo #16; useless for updating repos #1–15.
- **Organization rulesets are not a propagation mechanism.** They govern branch and push
  *protection*, not file content [49]. *(They are also **not** Enterprise-gated as an earlier
  round suggested (Free for public repos, Pro/Team for private) but that correction doesn't
  rescue them for this purpose. Single-source; re-verify.)*

**The resulting mechanism: this is the atomic-commit substitute:**

1. Hub publishes `@scope/tokens` publicly to npmjs.com on tag, via GitHub Actions.
2. Each of the 15 repos carries exactly **two small frozen files**: a one-line
   `renovate.json` (`{"extends": ["github>owner/renovate-config"]}`) and a reusable-workflow
   caller stub.
3. A `renovate-config` repo holds `default.json` with all policy: grouped token updates,
   automerged on green CI for minor/patch, majors left as PRs.

Every future policy change is then **one commit in the hub**. Renovate's documented guardrails
apply: passing checks required by default, one branch per target per run, ~2h settle window,
and the vendor's own warning that you should have tests wherever you regularly update
dependencies [47].

### Honest gaps in this dimension

- **No published number exists for the N-framework maintenance multiplier.** That search
  surface is entirely design-system agency and SaaS marketing making unsourced assertions. The
  "N implementations cost N times" belief is widely repeated and essentially unevidenced in
  public. The only credible evidence is **behavioural**: Google defunding, Adobe
  double-paying, GitHub retiring.
- **No first-hand retrospective on where token-only coherence breaks** was found. The
  holds/drifts split is inference and is marked so.
- **9 of 13 named design systems went unverified** (Lightning, Fluent, Polaris, SAP,
  Atlassian, USWDS, Porsche detail, Scale). Rows were left blank rather than filled from
  memory.
- **Zero published case studies name any real design system's cross-repo distribution
  mechanism**: none of npm, CDN, submodule, subtree or bot was evidenced *in practice*. The
  mechanism above is assembled from primary tool documentation, not copied from a precedent.
- daisyUI **5.7.17** and Angular **22.1.2** are single-source version claims: provisional.
- Phoenix v1.8.0's `app.css` was read as a structural summary, not verbatim; **re-read it
  byte-for-byte before authoring the adapter**.

### D2 sources

| # | Source | Publisher | Date | Accessed |
|---|---|---|---|---|
| 28 | [material-web discussion #5642](https://github.com/material-components/material-web/discussions/5642) | Material Web team (primary) | 2024-06-10 | 2026-08-15 |
| 29 | [react-spectrum discussion #7445](https://github.com/adobe/react-spectrum/discussions/7445) | Adobe (maintainer) | 2024-11→2025-06 | 2026-08-15 |
| 30 | [Carbon FAQ](https://carbondesignsystem.com/help/faq/) | IBM | living docs | 2026-08-15 |
| 31 | [Nord](https://nordhealth.design/) | Nordhealth (vendor surface) | undated | 2026-08-15 |
| 32 | [primer/view_components](https://github.com/primer/view_components) | GitHub (primary) | maint. mode 2026-02 | 2026-08-15 |
| 33 | [@primer/primitives](https://github.com/primer/primitives) | GitHub (primary) | current | 2026-08-15 |
| 34 | [caniuse: declarative shadow DOM](https://caniuse.com/declarative-shadow-dom) + Baseline/BCD | caniuse / web-platform-dx | Baseline 2024-02-20 | 2026-08-15 |
| 35 | [facebook/react #33698](https://github.com/facebook/react/issues/33698), [#26071](https://github.com/facebook/react/issues/26071) | React issue tracker (primary) | 2025-07-04 / React 18.2 | 2026-08-15 |
| 36 | [@lit-labs/ssr](https://github.com/lit/lit/tree/main/packages/labs/ssr) | Lit (primary) | 4.1.0, ~2026-05 | 2026-08-15 |
| 37 | [DTCG Design Tokens Format Module](https://tr.designtokens.org/format/) | W3C DTCG (primary) | **2025.10**, 2025-10-28 | 2026-08-15 |
| 38 | [Style Dictionary](https://github.com/amzn/style-dictionary) | Amazon (primary) | 5.5.1 | 2026-08-15 |
| 39 | [Terrazzo](https://terrazzo.app/) | Terrazzo (primary) | CLI 0.7.2 | 2026-08-15 |
| 40 | [Tailwind theme docs](https://tailwindcss.com/docs/theme) | Tailwind Labs (primary) | v4.3.3, 2026-07-16 | 2026-08-15 |
| 41 | [Phoenix asset management](https://phoenix.hexdocs.pm/asset_management.html) | Phoenix Framework (primary) | v1.8 | 2026-08-15 |
| 42 | [Phoenix v1.8.0 installer assets](https://github.com/phoenixframework/phoenix/tree/v1.8.0/installer/templates/phx_assets) | Phoenix (primary, tag-pinned) | 2025-08-05 | 2026-08-15 |
| 43 | [daisyUI themes](https://daisyui.com/docs/themes/) | daisyUI (primary) | 5.7.17 (provisional) | 2026-08-15 |
| 44 | [Angular workspace config](https://angular.dev/reference/configs/workspace-config) | Angular (primary) | v22 | 2026-08-15 |
| 45 | [Angular component styling](https://angular.dev/guide/components/styling) | Angular (primary) | v22 | 2026-08-15 |
| 46 | [LiveView JS interop](https://hexdocs.pm/phoenix_live_view/js-interop.html) | Phoenix LiveView (primary) | v1.2.9 | 2026-08-15 |
| 47 | [Renovate config presets](https://docs.renovatebot.com/config-presets/) | Renovate (primary) | 44.30.3, 2026-08-15 | 2026-08-15 |
| 48 | [GitHub Packages npm registry](https://docs.github.com/en/packages) · [npm docs](https://docs.npmjs.com/) | GitHub / npm (primary) | living | 2026-08-15 |
| 49 | [Template repositories](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template) · rulesets docs | GitHub (primary) | living | 2026-08-15 |
| 50 | NL Design System token versioning convention | NL Design System | n/a | 2026-08-15 |

---

## D3: Deployment topology on one 2 vCPU VPS

**Status:** closed on coverage after 3 rounds. Serves sub-question 3.

### The binding constraint is CPU, and one number proves it

A single Next.js 15.4.3 `next start` process was measured at **639,880 KB RSS and 103.3%
CPU**: one container consuming **half of a 2-vCPU box** [51]. That is the whole capacity
argument in one datapoint. With 8 GB of RAM and 2 shared cores, RAM fits comfortably and
**CPU is the wall**.

> **A cheap experiment worth running first, but weaker evidence than it first appears.** The
> trigger for that CPU spike was **bot crawlers, not human users**, and Cloudflare filtering
> reportedly cut it by over 90% [51]. For a portfolio box with no real users, bot traffic is
> plausibly the dominant load profile, and you already run Cloudflare.
>
> **Held to this run's own standard, however, that rests on a single contested thread**: the
> same evidence tier this report refused elsewhere for proxy RAM figures. It is retained
> because it is cheap, reversible and low-risk, not because it is well-evidenced. Treat it as
> a first experiment, **not** as the capacity plan. See [Contrary evidence](#contrary-evidence).

**Honesty about the rest of the numbers:** the two-source bar for performance claims was met
**zero times** for BEAM, Fastify, Postgres and proxy idle footprints. Those figures are simply
not published in citable form. Two separate researchers independently found that every
circulating proxy RAM figure (85/120/180 MB) traces to **AI-generated SEO content farms
recycling each other**, and both correctly declined to report a number. **This report gives
none.** Measure on the actual box: `docker stats` for ten minutes beats any figure available
online.

**Predicted failure order**: reasoned from the one measured datapoint, *not independently
evidenced*: 15-minute load average past 2.0 while RAM still looks fine → Node event-loop delay
and `ResponseAborted` errors → p99 degradation across **unrelated** apps sharing the cores.
Top unmeasured risk: running `next build` **on the box while serving from it**.

### Reverse proxy: Traefik

**nginx is cut on TLS grounds**: no built-in ACME client, and it does not reload itself after
renewal [53]. That is a silent-failure surface, and it gets materially worse as certificate
lifetimes shorten (below).

Between the two remaining, **one fact decides it**: Caddy's Cloudflare DNS module is not
bundled. Caddy's own module page states it "does not come with Caddy" and must be added via
`xcaddy` or the download page: no official image, no `caddy add-package`, no dynamic loading
[54]. **That rebuild recurs on every Caddy upgrade.** Traefik v3.7 configures ACME DNS-01
through Lego via **environment variables with no install or build step**, so Cloudflare DNS-01
works on the stock image [55]. *(Medium-high confidence: Cloudflare is not named inline on
the page read.)*

Current versions: **Traefik v3.7.10** (2026-07-31, near-weekly point releases across three
branches); **Caddy v2.11.4** (2026-06-03, roughly monthly) [52]. nginx 1.30.0 is
aggregator-sourced only and unverified.

Given you are on Cloudflare DNS, Traefik wins on the one axis that generates recurring work
for a solo operator.

### The certificate-lifetime clock is ticking

Let's Encrypt certificate lifetimes move **90 days → 64 days (Feb 2027) → 45 days (Feb 2028)**,
with the `tlsserver` profile already at 45 days since 2026-05-13 [56]. Renewals remain exempt
from rate limits and ARI-coordinated renewals are exempt from *all* limits, so no rate-limit
problem. But **the window between "renewal silently broke" and "site down" halves, then halves
again.** Alerting on certificate *age* stops being optional.

Documented limits that actually bite during config iteration are not the headline 50
certs/registered-domain/week but the **5 duplicates/week and 5 failed validations/identifier/hour**
[56].

**Cloudflare Origin CA is worth considering precisely because of this.** Origin certificates
are not publicly trusted, pair with Full (strict), and send no expiry notifications, which
means they sit **outside the shortening public-CA treadmill entirely** for proxied origins
[57].

### Cloudflare specifics you need to get right

- **Five SSL/TLS modes, not four.** The redirect loop is **bidirectional**: Flexible combined
  with an origin HTTP→HTTPS redirect, *and* Full/Full-strict combined with an origin
  HTTPS→HTTP redirect [57].
- **WebSockets are supported on all plans**, and Cloudflare **deliberately does not publish**
  its idle-close period; it publishes only a keepalive recommendation [58]. The widely-cited
  "100-second Free/Pro timeout" **is not in Cloudflare's documentation** and is not asserted
  here.
- **The LiveView concern is retired regardless.** Phoenix sets `heartbeatIntervalMs` to
  **30000** by default in `assets/js/phoenix/socket.js` [59]: a LiveView socket pings every 30
  seconds, so any idle timeout above 30 s never fires. `cs-tracker.cuatro.dev` is safe behind
  the orange cloud.

### Subdomain routing wins, and you already have it

Buttondown's CEO, **eight years in**, publicly regrets path-based routing: a shared browser
origin means cookies, `localStorage` and XSS **cross every app**, plus shared SEO blast radius,
namespace conflicts and harder rate limiting [60]. The SSO counter-argument is solvable with
`Domain=.cuatro.dev` cookies, and the certificate cost is eliminated by a single DNS-01
wildcard.

**No account of anyone regretting subdomains was found**: though only one search was run for
it, so treat that asymmetry as suggestive rather than settled. Your four live subdomains are
the right shape already; this dimension confirms the incumbent rather than overturning it.

### Database: one Postgres, one database and role per app

Each additional Postgres instance **pre-commits its own `shared_buffers`**: 128 MB by default,
so five containers reserve roughly 640 MB before serving a single query [61]. On a box where
CPU is scarce and every container competes, that is pure waste.

**Schema-per-app is rejected** for a specific reason: it couples Prisma migrations across apps
[61]. One cluster, one database per app, one role per app keeps migrations independent while
sharing the memory floor.

Prisma's connection behaviour is arithmetic, not fate: set an explicit `connection_limit` per
app and keep the sum under `max_connections`. **Skip PgBouncer**: it solves serverless burst,
which does not apply to long-lived containers [61].

**The Supabase three-way collapses to a two-way.** Self-hosting Supabase requires **10+
containers and 8 GB of RAM for itself alone** [62]: it would consume your entire box. That
leaves managed vs plain Postgres. And the free tier is a trap for exactly your use case:
**projects pause after 7 days of inactivity**, capped at 500 MB and 2 projects, with no backups;
Pro is **$25/mo** and never pauses [63]. A low-traffic portfolio app is precisely the workload
that gets paused.

### Railway as a partial offload: priced honestly

Railway charges **$20/vCPU/mo, $10/GB RAM/mo, $0.05/GB egress**, with Hobby at $5/mo including
$5 of credit [64]. **Memory dominates for idle apps**: one idle Next.js at 640 MB is about
**$6.40/mo in RAM alone**, so all 12 apps would be roughly **$77/mo memory-only**: near the
top of your stated ceiling, before any vCPU charge, for a box you have already paid for
through 2028. *(An earlier draft of this report said $61/mo; that was an arithmetic error
caught in citation verification: 12 × $6.40 = $76.80.)* Partial offload of 2–3 apps lands
around **$15–30/mo**, which is the shape in which Railway makes sense here.

### Zero-downtime deploys: the vendor does not document what you'd hope

**Plain `docker compose up` drops connections.** Docker's CLI reference states verbatim that
when a service's config or image changed, `up` "picks up the changes by **stopping and
recreating** the containers" [65]. Stop-first by construction; the page never mentions
zero-downtime or rolling updates.

**`deploy.update_config.order` outside Swarm is a documented absence.** Both
`docs.docker.com/reference/compose-file/deploy/` and the upstream normative `compose-spec`
`deploy.md` document `order: start-first|stop-first` with **zero runtime scoping**: neither
mentions Swarm versus `compose up`, and the only adjacent line is the generic "deploy is
optional and may be ignored" [66]. Two authoritative documents read directly. **Treat `deploy:`
as inert under `compose up`.**

**`--wait` does not close the gap.** It means "wait for services to be running|healthy, implies
detached mode": a *command-completion* guarantee, not a *traffic* guarantee. The connection
gap has already happened before it returns [65].

**The working pattern is scale-then-drain.** `docker-rollout` v0.14 (2026-07-12) is alive,
unarchived, MIT, ~3.3k stars, but shipped **only one release in the trailing 12 months** [67].
Its documented limitation is that services "cannot have `container_name` and `ports` defined",
so it works **only behind a proxy**, never with published host ports, and it requires real
healthchecks [67]. **Both constraints are already satisfied by a Traefik architecture**: which
is the useful part.

### Resource limits: use the right keys, then verify empirically

Use **service-level `cpus:` and `mem_limit:`**: both are documented in the current Compose
services reference as ordinary service attributes with no Swarm qualifier, and the old "ignored
outside Swarm" warning is absent from current official pages [68]. But **neither page
positively states that `deploy.resources.limits` is enforced by `docker compose up`**, so
enforcement cannot be certified from documentation. `cpu_shares` is a relative *soft* weight
and is the wrong key for capping [68].

> **Settle it in one command rather than more documentation archaeology:** bring up a service
> with limits set, then `docker inspect` and read `HostConfig.NanoCpus` and `HostConfig.Memory`.

### The self-hosted PaaS field, and why the null option wins

None of these has stopped shipping; all four released within 60 days [69]:

| Tool | Version | Released | Cadence | Proxy | Zero-downtime |
|---|---|---|---|---|---|
| **Coolify** | v4.3.3 | 2026-08-15 | 5 releases in 3.5 weeks | **Traefik** (v4.3.0 added Traefik 3.7 support) | yes |
| **Dokku** | v0.38.27 | 2026-08-12 | 7 releases in 5 weeks | own | documents 10 s wait + 60 s drain |
| **CapRover** | v1.15.2 | 2026-08-15 | **lumpy**: dead Jun–Nov 2025 and Nov 2025–May 2026 | nginx on Swarm | start-first **only for apps without volumes** |
| **Kamal** | v2.12.0 | 2026-06-18 | ~8 in 12 mo, decelerating to quarterly | kamal-proxy | "gapless deployments" |

**The PaaS decision comes first and makes the proxy decision downstream**, because all four own
their own front door [69]. Coolify *preserves* the Traefik v3.7 + Cloudflare DNS-01 design;
CapRover discards it for nginx on Swarm **and** forces a Compose v3 format migration across all
12 apps, since Docker documents `stack deploy` as incompatible with the current spec [69];
Kamal discards it for kamal-proxy.

**The null option is strong.** `docker-rollout` plus your own Traefik delivers the same
zero-downtime property on the already-designed stack. **A self-hosted PaaS's real value here is
UI, git-push deploys and backups, not zero-downtime**, which you can have without it. Coolify's
principal risk is not footprint but **upgrade cadence**: five releases in 3.5 weeks is a
treadmill for a solo operator whose ranked top criterion is maintenance burden.

### Backups

Live and shipping: **restic 0.19.0** (2026-06-09), **Borg 1.4.5** (2026-07-19, with 2.0 still
beta and explicitly not for production), **pgBackRest 2.59.0** (2026-07-20, single-source),
**Barman 3.14.0** (2025-05-15, slower cadence) [70]. **wal-g's liveness could not be
established**: no dated 2026 release retrieved, so it should not be adopted on this evidence
[70].

PostgreSQL 18's documentation states a running server's data directory **cannot** be tar-copied,
but a **frozen snapshot is usable** (it restores as a crash-recovered server replaying WAL)
*provided snapshots across all volumes are simultaneous* [71]. That is the documented hazard
for multi-volume setups, and a provider snapshot is additionally **not offsite from the
provider**. The docs call filesystem backups "inferior to the `pg_dump` method" [71].

**No official source says dump-only is inadequate at this scale, so this report does not claim
it.** PITR buys a smaller loss window, not correctness. For portfolio and personal-use apps with
no real users, scheduled `pg_dump` plus an offsite copy is defensible.

**Restore-testing guidance was searched for and not found**: the researcher declined to invent
it. Stated as a gap.

### The outgrow threshold

**Pressure Stall Information is the right instrument.** PSI exposes `avg10`/`avg60`/`avg300` as
percentages plus a `total` in microseconds, where "full" means all non-idle tasks stalled [72].
The kernel publishes **no universal trouble threshold**: only a trigger format with worked
examples of **150 ms/1 s (some, memory)** and **50 ms/1 s (full, io)** [72].

The operationally important part for you: **on Ubuntu 24.04's cgroup v2, the same data is
available per-container** via `cpu.pressure`, `memory.pressure` and `io.pressure`: which
attributes pressure to a *single app* rather than to the box [72]. That is what turns "the
server feels slow" into "the tracker is eating the cores."

Load-average-per-core thresholds, post-hoc OOM detection, swap guidance and the
next-step-short-of-Kubernetes question all **ran out of budget and are unanswered**.

### Honest gaps in this dimension

- **Every footprint number except the Next.js one is missing**, and deliberately so. The
  available sources were content farms.
- Compose resource-limit **enforcement** is uncertified by documentation: verify empirically.
- Backup **restore-testing** guidance: not found.
- Swap-on-a-container-host guidance, OOM post-hoc detection, load-average thresholds:
  unanswered.
- Dokku's default single-host router is unverified (only the k3s/Traefik path was evidenced);
  three PaaS zero-downtime doc pages were read via search extraction rather than direct fetch.
- Cloudflare Origin CA **validity periods** were not documented on the page read, and
  HTTP-01-while-proxied was not reached.

### D3 sources

| # | Source | Publisher | Date | Accessed |
|---|---|---|---|---|
| 51 | [vercel/next.js discussion #81967](https://github.com/vercel/next.js/discussions/81967) | Vercel issue tracker | 2025-07→2026-02 | 2026-08-15 |
| 52 | [Traefik releases](https://github.com/traefik/traefik/releases) · [Caddy releases](https://github.com/caddyserver/caddy/releases) | Traefik / Caddy (primary) | v3.7.10 2026-07-31 · v2.11.4 2026-06-03 | 2026-08-15 |
| 53 | nginx ACME / post-renewal reload behaviour. **⚠ LOAD-BEARING (it is why nginx is cut) but no URL was captured. Re-verify against nginx's own docs before relying on it**: nginx's ACME story has been changing, and an out-of-date claim here would be a false claim | nginx | n/a | 2026-08-15 |
| 54 | [caddy-dns/cloudflare module page](https://caddyserver.com/docs/modules/dns.providers.cloudflare) | Caddy (primary) | current | 2026-08-15 |
| 55 | [Traefik ACME docs](https://doc.traefik.io/traefik/https/acme/) | Traefik (primary) | v3.7 | 2026-08-15 |
| 56 | [Let's Encrypt rate limits](https://letsencrypt.org/docs/rate-limits/) · certificate-lifetime policy | ISRG (primary) | page upd. 2026-08-05 | 2026-08-15 |
| 57 | [Cloudflare SSL/TLS encryption modes](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/) · Origin CA | Cloudflare (primary) | current | 2026-08-15 |
| 58 | [Cloudflare WebSockets](https://developers.cloudflare.com/network/websockets/) | Cloudflare (primary) | page upd. 2026-08-14 | 2026-08-15 |
| 59 | [phoenix/assets/js/phoenix/socket.js](https://github.com/phoenixframework/phoenix/blob/main/assets/js/phoenix/socket.js) | Phoenix (primary source code) | v1.8.11 | 2026-08-15 |
| 60 | Subpaths retrospective, J. Duke (Buttondown). **⚠ LOAD-BEARING (it is the evidence for subdomains over paths) but no URL was captured. Re-locate before relying on it** | Buttondown CEO | 2026-02-18 | 2026-08-15 |
| 61 | [PostgreSQL `shared_buffers`](https://www.postgresql.org/docs/current/runtime-config-resource.html) · Prisma connection-limit guidance | PostgreSQL / Prisma (primary) | PG 16–18 | 2026-08-15 |
| 62 | [Supabase self-hosting](https://supabase.com/docs/guides/self-hosting) | Supabase (primary) | current | 2026-08-15 |
| 63 | [Supabase pricing](https://supabase.com/pricing) | Supabase (primary) | read 2026-08-15 | 2026-08-15 |
| 64 | [Railway pricing](https://railway.com/pricing) + 4 corroborating | Railway (primary) | read 2026-08-15 | 2026-08-15 |
| 65 | [docker compose up reference](https://docs.docker.com/reference/cli/docker/compose/up/) | Docker (primary) | current | 2026-08-15 |
| 66 | [Compose deploy spec](https://docs.docker.com/reference/compose-file/deploy/) · [compose-spec deploy.md](https://github.com/compose-spec/compose-spec/blob/main/deploy.md) | Docker / compose-spec (both normative) | current | 2026-08-15 |
| 67 | [wowu/docker-rollout](https://github.com/wowu/docker-rollout) | W. Ostrowski (primary) | v0.14, 2026-07-12 | 2026-08-15 |
| 68 | [Compose services reference](https://docs.docker.com/reference/compose-file/services/) · resource constraints | Docker (primary) | current | 2026-08-15 |
| 69 | Coolify / Dokku / CapRover / Kamal release pages | each project (primary) | see table | 2026-08-15 |
| 70 | restic / Borg / pgBackRest / Barman release pages | each project (primary) | see text | 2026-08-15 |
| 71 | [PostgreSQL 18 backup docs](https://www.postgresql.org/docs/18/backup.html) | PostgreSQL (primary) | page dated 2026-08-13 | 2026-08-15 |
| 72 | [Linux PSI documentation](https://docs.kernel.org/accounting/psi.html) | Linux kernel (primary) | current | 2026-08-15 |

---

## D5: Identity: one login across the ecosystem

**Status:** added mid-run at the requester's instruction; closed after 2 rounds plus a
ForwardAuth pass. Serves a requirement not present in the original prompt.

### Why this dimension deserved first-class treatment

A shared account is arguably a **stronger suite signal than visual coherence**: Google
Workspace reads as one product largely because one login carries across it. And there is a
structural symmetry with D2 worth naming explicitly:

> **Components cannot span six frameworks because they are a *code* dependency. OIDC can,
> because it is a *network protocol*.** Auth is the one layer that genuinely federates
> across this entire estate.

**Confirmed scope (from the requester, 2026-08-15):** nine apps need logins,
`cs-tournament`, `cuatro-finance`, `cuatro-tracker`, `cs-tracker`, `digital-library`,
`StreamVault`, `MaiCoin`, `poketracker-go`, `tcg-tracker`: plus `Mutuo`, which needs demo
accounts only. That is materially more than assumed, and it makes the **application-cap**
question decisive rather than incidental. Two qualifications: `MaiCoin` is Solidity/Web3
where wallet-based auth is the norm rather than OIDC, and `tcg-tracker` is an empty shell.

### Architecture: OIDC, not a shared cookie

**Verdict: OIDC Authorization Code + PKCE.** The deciding fact is mechanical, not stylistic:
**`__Host-` cookies must not specify a `Domain` attribute** [86]. A domain-scoped
`.cuatro.dev` session therefore permanently forfeits the strongest cookie hardening across
all ten apps, and any one subdomain can set a cookie its siblings will accept. Beneath that
sits the deeper problem (six languages sharing one session *format*) for which **JWKS is
the only lingua franca available**.

**The shape that wins is hybrid:** OIDC federates between a central provider and each app;
each app then keeps its own ordinary **host-only `__Host-` session**. Language-neutral SSO,
no cross-subdomain forgery surface.

**RFC 9700 / BCP 240 (January 2025)** settles the flow question: the implicit flow SHOULD NOT
be used, the password grant MUST NOT be used, and public clients MUST use PKCE. Code + PKCE
applies to SPAs and server-rendered apps alike [87].

**Consent screens are skippable for first-party clients** across products (Ory
`require_consent: false`, Better Auth `skipConsent`, Duende `RequireConsent=false`, Auth0's
first-party flag) [88], which is what makes a Workspace-like no-prompt experience between
your own apps achievable rather than aspirational.

### Phoenix LiveView is not the obstacle it appeared to be

The anticipated tension: OAuth redirect is a full page navigation, LiveView holds a
persistent socket: **dissolves on primary documentation**. LiveView v1.2.9: "LiveView begins
its life-cycle as a regular HTTP request… they share the authentication logic with regular
requests through plugs" [88]. So: run the OIDC callback in a plain Phoenix controller
(`oidcc_plug`), write the session, and `mount/3` receives it when the socket later connects.
Use router-level `on_mount` hooks and put authenticated and unauthenticated routes in
different `live_session`s.

> **Documented gotcha worth pre-empting:** an open LiveView socket **will not observe a
> logout** unless the user reloads the page. Wire `live_socket_id` broadcast to force the
> disconnect [88]. This is precisely the class of silent failure a no-users estate would
> never surface on its own.

### Logout

All four OIDC logout specifications are Final. **Front-channel logout is structurally broken
by third-party cookie blocking** [89][90], though note that a single-apex topology like this
one is same-site, the one case where it may still function. **Recommend RP-Initiated +
Back-Channel logout.**

### The self-hosted field is nearly empty on this hardware

This is the dimension's most decision-relevant finding, and every disqualification comes from
**the vendor's own published minimums**, not from critics:

| Product | Vendor-stated requirement | Verdict on 2 vCPU / 8 GB |
|---|---|---|
| **Keycloak** | ~1250 MB base RAM (10k cached sessions), 70% of container limit to JVM heap + ~300 MB non-heap, 1 vCPU per 15 password logins/sec, 150% headroom. **Keycloak publishes no minimum**; the often-quoted 3 vCPU is one pod of a *three-pod cluster sized for 45 logins/sec* [73] | **Poor fit, not formally disqualified.** Confidence downgraded to medium after citation verification: the earlier reading of "3 vCPU floor" was an overstatement. JVM footprint still makes it the wrong tenant for 2 shared cores. |
| **authentik** | "at least 2 CPU cores and 2 GB of RAM", multi-container, requires own Postgres [74] | **Disqualified**: wants the entire CPU budget as its floor |
| **Logto** | minimum recommended 2 vCPU / 8 GiB / 256 GiB + PostgreSQL ^14 [77] | **Disqualified**: the whole box |
| **ZITADEL** | states no CPU/RAM at all; requires PostgreSQL 14–18 and an **h2c/HTTP-2 upstream** proxy (Traefik v3.x listed as tested) [76] | Viable but adds a Postgres and a proxy constraint |
| **Pocket ID** | v2.13.0 (2026-08-07), 1–3 week cadence, Go backend, **SQLite default** so no extra Postgres, OpenID Connect Certified: a real authorization server. No stated resource needs anywhere [75] | Cheapest by far: **but see below** |
| **Casdoor** | v3.153.0 (2026-08-13), **ten tags in four days** [78]; DB/runtime requirements unestablished | Release velocity is itself a churn signal for a solo operator |
| **Ory Kratos** | v26.2.0 (2026-03-20) after a ~16-month gap from v25.4.0 [79] | Cadence observation only: **not** a maintenance verdict; two-source bar not met. **Ory Hydra, the piece that actually matters for OIDC, was never reached.** |

**Pocket ID is effectively passkey-only.** Its repository states it "only supports passkey
authentication, which means you don't need a password": there is no password login, with
only email one-time codes (`EMAIL_ONE_TIME_ACCESS_AS_UNAUTHENTICATED_ENABLED`) and LDAP as
fallbacks [75]. For a portfolio suite where a visitor might create an account, that is a real
constraint, not a detail.

### Managed options, priced at vendor source

| Product | Free tier | Application / client cap | First paid |
|---|---|---|---|
| **Clerk** | 50,000 MRU **per app** | **"Every plan supports unlimited applications"**: explicit [80] | $25/mo |
| **WorkOS** | **1M MAU** | **Silent**: reported as silence, not "unlimited" [81] | SSO/SCIM $125/connection |
| **Auth0** | 25,000 MAU | Silent [82] | B2C Essentials from $35/mo; B2B from $150/mo |
| **Kinde** | 10,500 MAU | Applications "unlimited" but **meters environments** (1 prod + 1 non-prod on Pro, $5 each extra) [83] | n/a |
| **Stytch** | 10,000 MAU | **Silent** [84] | n/a |
| **Supabase** | 50,000 MAU | **Caps at 2 active projects** [85] | Pro $25/mo |

*Every figure above was read from the vendor's own pricing page on 2026-08-15. A previous
researcher **refused** to report Clerk/Kinde/Stytch/Supabase numbers found only in listicles
and content farms; these replace those refusals with vendor-source reads.*

### Migration: consolidating does not force a password reset

Supabase Auth uses **bcrypt**, `auth.users.encrypted_password` is exportable, and Better
Auth's official migration guide maps it straight across with `bcrypt.compare()` verification
[85]. So moving `cs-tournament`'s existing users to a new provider is a data migration, not a
user-facing reset: **except** if the target is Pocket ID, which having no password login at
all would force passkey enrollment for everyone regardless [75].

### Traefik ForwardAuth: evaluated and rejected as the primary architecture

Because every app already sits behind one Traefik, centralised auth at the proxy is a third
architecture, and it was priced rather than assumed.

**What it does:** ForwardAuth delegates every request to an auth service (2XX allows; non-2XX
returns the auth service's own response), forwards `X-Forwarded-Method/Proto/Host/Uri/For`,
and **can inject identity upstream** via `authResponseHeaders`, `authResponseHeadersRegex`
and `headerField` [94]. So it genuinely *can* replace per-app OIDC for identity delivery.

**Why it is rejected here, three grounds:**

1. **No caching is documented**, meaning a per-request round trip: the wrong tax on a box
   whose binding constraint is CPU [94]. `forwardBody: true` additionally "breaks streaming"
   verbatim, and `maxBodySize`/`maxResponseBodySize` default unbounded with an explicit DoS
   warning [94].
2. **WebSockets are not mentioned anywhere in the v3.7 ForwardAuth reference** [94]. The
   reading that a LiveView socket is authorized once at handshake and never re-checked is
   **inference, not citation**. One of your apps is LiveView.
3. **Header trust has no cryptographic binding.** If an app trusts the injected header,
   anyone reaching it *not* through Traefik becomes any user: network position is the only
   control, and on one VPS running ten apps that is the default condition. *(Flagged as
   reasoning; one source short of the security bar, and Traefik was not found documenting
   it.)*

**It is retained for one genuinely good narrow use:** gating things that have **no auth of
their own**: the Traefik dashboard, admin surfaces, and any static demo that should not be
public. `oauth2-proxy` v7.15.3 (2026-06-09) is a CVE-remediation release, so that project is
not stalled [95] *(only two releases retrieved; 12-month cadence unestablished)*.

### Client libraries

| Stack | Library | Version | Note |
|---|---|---|---|
| Elixir / Phoenix | **`oidcc`** | v3.8.0 | ErlEF Security WG governance, **OpenID Certified**; `oidcc_cowboy` explicitly deprecated [91] |
| Svelte / Vue / React SPA | **`oidc-client-ts`** | 3.5.0 | the common denominator [92] |
| Angular | `angular-auth-oidc-client` | 21.0.2 | [92] |
| Go | `go-oidc` v3 `RemoteKeySet` | n/a | auto-refreshes JWKS on unknown `kid` [93] |
| Python | `PyJWKClient` | n/a | auto-refreshes JWKS on unknown `kid` [93] |

**On Next.js: a folklore correction that matters.** The circulating claim that Auth.js is in
"maintenance mode" was found only in content farms and is **the wrong word**. What two
primary sources actually say is that "Auth.js is now part of Better Auth", with new projects
recommended to start with Better Auth [96]: a **merger and stewardship change**, not
abandonment. `next-auth@4.24.15` and `5.0.0-beta.32` shipped **2026-07-20 with security
fixes including auth "failing open"**, and v5 remains beta (npm `latest` is 4.24.15) [96].

**Better Auth** v1.6.29 (2026-08-14), near-weekly cadence, v1.7.0 in RC with breaking OAuth
changes [97]. It documents both roles **asymmetrically**: usable as an OIDC *client* via the
SSO plugin, while its OIDC *provider* plugin self-warns it "may not be suitable for
production use" and is slated for deprecation [97]. **Relevant here as a client only, never
as the central identity provider.**

### Honest gaps in this dimension

- **Ory Hydra was never reached**: the component that actually matters for OIDC in the Ory
  stack.
- A **Logto version/date conflict was not resolved** (GitHub releases returned 2024 dates,
  search returned 2026); the researcher correctly refused to average.
- Casdoor's database and runtime requirements are unestablished.
- Authelia's OIDC provider is reportedly an open beta, off by default: search-summary only,
  low confidence.
- **No authoritative published guidance exists** on cookie-vs-OIDC for first-party suites;
  that verdict is derived from spec mechanics rather than quoted from a source.
- ForwardAuth's WebSocket behaviour and the header-trust caveat are both reasoning, not
  citation.

### D5 sources

| # | Source | Publisher | Date | Accessed |
|---|---|---|---|---|
| 73 | [Keycloak: memory and CPU sizing](https://www.keycloak.org/high-availability/multi-cluster/concepts-memory-and-cpu-sizing) *(path corrected after the original redirected)* | Keycloak (primary) | current | 2026-08-15 |
| 74 | [authentik requirements](https://docs.goauthentik.io/install-config/install/docker-compose/) | authentik (primary) | current | 2026-08-15 |
| 75 | [Pocket ID](https://github.com/pocket-id/pocket-id) | Pocket ID (primary) | v2.13.0, 2026-08-07 | 2026-08-15 |
| 76 | [ZITADEL requirements](https://zitadel.com/docs/self-hosting/manage/production) | ZITADEL (primary) | current | 2026-08-15 |
| 77 | [Logto requirements](https://docs.logto.io/logto-oss/get-started) | Logto (primary) | current | 2026-08-15 |
| 78 | [Casdoor releases](https://github.com/casdoor/casdoor/releases) | Casdoor (primary) | v3.153.0, 2026-08-13 | 2026-08-15 |
| 79 | [Ory Kratos releases](https://github.com/ory/kratos/releases) | Ory (primary) | v26.2.0, 2026-03-20 | 2026-08-15 |
| 80 | [Clerk pricing](https://clerk.com/pricing) | Clerk (primary) | read 2026-08-15 | 2026-08-15 |
| 81 | [WorkOS pricing](https://workos.com/pricing) | WorkOS (primary) | read 2026-08-15 | 2026-08-15 |
| 82 | [Auth0 pricing](https://auth0.com/pricing) | Auth0 (primary) | read 2026-08-15 | 2026-08-15 |
| 83 | [Kinde pricing](https://kinde.com/pricing/) | Kinde (primary) | read 2026-08-15 | 2026-08-15 |
| 84 | [Stytch pricing](https://stytch.com/pricing) | Stytch (primary) | read 2026-08-15 | 2026-08-15 |
| 85 | [Supabase pricing](https://supabase.com/pricing) · [Better Auth Supabase migration guide](https://www.better-auth.com/docs/guides/supabase-migration-guide) | Supabase / Better Auth (primary) | read 2026-08-15 | 2026-08-15 |
| 86 | [MDN: Set-Cookie, `__Host-` prefix](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) | MDN (primary) | current | 2026-08-15 |
| 87 | [RFC 9700: OAuth 2.0 Security BCP](https://www.rfc-editor.org/rfc/rfc9700.html) | IETF (primary) | 2025-01 | 2026-08-15 |
| 88 | [LiveView security & auth](https://hexdocs.pm/phoenix_live_view/security-model.html) | Phoenix LiveView (primary) | v1.2.9 | 2026-08-15 |
| 89 | [OpenID Connect logout specs](https://openid.net/developers/specs/) | OpenID Foundation (primary) | Final | 2026-08-15 |
| 90 | [Mozilla bug 1660574](https://bugzilla.mozilla.org/show_bug.cgi?id=1660574) · Microsoft Learn | Mozilla / Microsoft | n/a | 2026-08-15 |
| 91 | [oidcc](https://github.com/erlef/oidcc) | Erlang Ecosystem Foundation (primary) | v3.8.0 | 2026-08-15 |
| 92 | [oidc-client-ts](https://github.com/authts/oidc-client-ts) · [angular-auth-oidc-client](https://github.com/damienbod/angular-auth-oidc-client) | authts / damienbod | 3.5.0 · 21.0.2 | 2026-08-15 |
| 93 | [go-oidc](https://github.com/coreos/go-oidc) · [PyJWT `PyJWKClient`](https://pyjwt.readthedocs.io/) | CoreOS / PyJWT | v3 | 2026-08-15 |
| 94 | [Traefik ForwardAuth middleware](https://doc.traefik.io/traefik/middlewares/http/forwardauth/) | Traefik (primary) | v3.7 | 2026-08-15 |
| 95 | [oauth2-proxy releases](https://github.com/oauth2-proxy/oauth2-proxy/releases) | oauth2-proxy (primary) | v7.15.3, 2026-06-09 | 2026-08-15 |
| 96 | [nextauthjs/next-auth](https://github.com/nextauthjs/next-auth) · [authjs.dev](https://authjs.dev) · [npm next-auth](https://registry.npmjs.org/next-auth) | Auth.js / npm (primary) | 4.24.15 · 5.0.0-beta.32, 2026-07-20 | 2026-08-15 |
| 97 | [Better Auth](https://github.com/better-auth/better-auth) | Better Auth (primary) | v1.6.29, 2026-08-14 | 2026-08-15 |

---

## Cross-dimension insights

What only the *combination* of dimensions shows. Four of these changed the recommendation.

### 1. The architectural spine: contracts federate, implementations do not

This is the single idea that unifies the whole ecosystem, and it only appears when D2 and D5
are read together.

| Layer | Federates? | Because it is… |
|---|---|---|
| UI components | **No** (D2) | a *code* dependency: must be reimplemented per framework |
| Design tokens | **Yes** (D2) | a *format*: CSS custom properties are consumed identically by all six stacks |
| Identity | **Yes** (D5) | a *network protocol*: OIDC/JWKS is language-neutral by construction |
| CI definitions | **Yes** (D1) | a *reference*: reusable workflows called by `owner/repo/…@sha` |

**The Cuatro Ecosystem is federated by contracts, never by shared implementations.** That is
the sentence to build the architecture spine around, and it is what makes a six-framework
suite tractable for one person. Every place the estate tries to share *code* across framework
boundaries, the evidence says it fails; every place it shares a *contract*, it works.

### 2. A deployment constraint silently decided an identity question

D3 established that **CPU is the binding constraint**. D5 then found most of the popular
self-hosted identity field ruled out on the vendors' own published requirements: **authentik
at 2 CPU cores plus its own Postgres, Logto at 2 vCPU / 8 GiB**, each meeting or exceeding
the whole box. These looked like separable sub-decisions and were not. **The box narrowed the
identity field.**

*Correction applied after citation verification:* Keycloak belongs to this group by weight
but **not** by published minimum: it publishes none. Its 3 vCPU figure is one pod of a
three-pod cluster sized for 45 logins/sec, which is a capacity-planning example, not a floor.
Keycloak remains a poor fit for 2 vCPU on JVM-footprint grounds, but the report no longer
claims it is disqualified by a stated minimum.

### 3. The same failure pattern appears repeatedly, always in the vendor's own words

Google defunded Material Web (2024-06). GitHub retired Primer ViewComponents (2026-02).
authentik and Logto publish minimums exceeding this hardware. In every case **the popular
answer is the wrong one here, and the disqualifying evidence comes from the vendor rather
than from critics.** This is why the run's epistemics mattered: the marketing surface for all
of them would have said the opposite.

### 4. "No real users" cuts both ways, and the second edge was nearly missed

D3 used the absence of users to justify cheap deploy churn and a greenfield host rebuild,
correct. But the sustainability red team inverted it: **no users means no error signal.**
Automated token updates, a broken renewal, a LiveView socket that never observes a logout,
none of these produce a complaint, because there is nobody to complain. **Automation without
users is automation without feedback**, which is why external monitoring must precede
automation rather than follow it.

### 5. Source layout and design system are genuinely decoupled; layout and portfolio value are not

The prompt asked where the three sub-decisions couple. Answer:

- **Design system ⟂ source layout.** Tokens propagate by npm package or vendored CSS
  regardless of repo count. Nothing in D2 depends on D1.
- **Deployment ⟂ source layout.** D3's constraints are CPU and bots; repo topology is
  irrelevant to them.
- **Layout ↔ portfolio value: tightly coupled.** This is the one real coupling, and the
  original analysis missed it. Repo count *is* the portfolio surface.
- **Identity ↔ deployment: tightly coupled** (see #2).

### 6. Stack variety and suite coherence are in direct tension: own it deliberately

Stated in full as executive-summary finding 3; recorded here because it is a cross-dimension
result (D2's ceiling meeting the requester's stated preference), not a D2 finding. **The
tension does not resolve: it gets chosen.** The recommendation chooses variety, and prices
the cost as a coherence ceiling rather than pretending tokens dissolve it.

---

## Contrary evidence

A red-team pass ran with three independent adversaries, each instructed to default to finding
the recommendation wrong. It materially changed the recommendation. The strongest surviving
counter-arguments, stated fairly:

### Against the source-layout pick: the strongest argument, and it is not fully answered

**The one monorepo benefit that survives at N=1 is exactly the one that maps onto the
requester's #2 criterion, and the recommendation does not fully deliver it.** D1 found that
project liveness and audience navigation is the surviving benefit, and Streamdal's symptoms
were **on GitHub**: a stale "last updated", a wrong language bar, users unable to tell which
repo to file against. An app registry on `cuatro.dev` **never touches
`github.com/<your-profile>`**. The Anchored Hub takes the estate 15 → 12 and makes the
flagship genuinely active, which is a partial answer. **Twelve repos still each show their own
staleness to anyone browsing the profile. A full monorepo would answer this completely and the
recommendation does not.** This is accepted as a real cost, not argued away.

**Also landing:** the original justification was invalid. "No orchestrator supports
Elixir/Solidity" establishes that a monorepo would not be *accelerated*: not that it would be
*worse* than fifteen repos. Absence of a bonus is not presence of a cost, and D1 found **no
measured CI fan-out numbers exist**, so the one real monorepo cost is unevidenced. The
recommendation now rests on incremental adoption, which is defensible; the orchestrator
finding is demoted to a supporting note.

### Against the deployment topology: fatal to the original plan

**The capacity arithmetic does not close.** 2 vCPU is a **200% budget**. The sole measured
datapoint is one Next.js at **103.3%**. Four Next.js apps would demand 412% before the BEAM
node, Postgres or Traefik. The two-source bar was met **zero times** for every other
footprint: meaning *unknown* numbers were being treated as *small* ones. The revised plan
adds a measure-first gate and a named overflow target; **it does not make the arithmetic
close, and nobody should pretend it does until the box is measured.**

> **Partial rebuttal, from citation verification.** The 103.3% figure was captured *during a
> bot crawl* (the report's own finding) so the 412% projection treats an attack peak as
> steady state. It is an upper bound on a bad day, not expected demand. The red team's
> attack lands on the *absence of a gate*, which is real and now fixed; it overstates the
> *certainty of failure*. Both the attack and this rebuttal point to the same remedy: measure
> before placing apps.

**Railway was dismissed on wrong arithmetic.** The correct figure is **~$77/mo** memory-only
for all twelve (an earlier draft said $61: arithmetic error), which is near the top of but
still within the stated $40–100 budget; and with the VPS sunk to 2028, marginal spend is what
matters. Offloading two heavy apps buys back a full box of CPU for $15–30/mo on **four-source
primary pricing**: while the bot filter originally ranked *first* rests on **one contested
thread**. The ordering was backwards on both evidence quality and effect size.

### Against the propagation machinery

**Renovate automerge-on-green-CI is vacuous where no CI exists**: "no failing checks"
degrades to *merge*, not *block*. Compounded by this run's own finding that a colour **value**
change is a **minor** bump, the mechanism would route the most visually breaking payload to
unattended merges across every repo, in an estate with no users to notice. Accepted in full;
automerge is removed.

**And the machinery is amortised over a change frequency that will not occur.** A solo
developer does not change design tokens weekly. Building npm publishing, a Renovate preset and
a config repo before any token has ever changed is speculative infrastructure.

### A methodological hit against this run itself

**The two-source bar was applied asymmetrically.** Proxy RAM figures were refused for resting
on content farms, while the headline bot-filter recommendation was built on a single contested
discussion thread. Both cannot be right. The bot-filter claim is retained because it is
cheap, reversible and low-risk, but it is hereby **demoted from "the cheapest capacity fix"
to "a cheap experiment worth running first"**, which is what its evidence actually supports.

### Attacks that were tested and failed

Reported for completeness, because a red team that only finds problems is not calibrated:

- **"The 16th repo is self-defeating"**: repo *count* as a cost driver appears nowhere in the
  evidence; Grab's pain was commits and refs.
- **"Pick Bazel instead"**: Kubernetes' off-ramp answers this.
- **Traefik over Caddy**: the xcaddy-rebuild-per-upgrade argument *is* a maintenance
  argument, and maintenance is the top-ranked criterion.
- **Subdomain routing**: a zero-cost incumbent with a published regret case against the
  alternative.
- **The tokens-only design verdict**: D2 is the best-evidenced section in the report; four
  independent vendors converge.
- **Database-per-app in one cluster**: it genuinely does decouple Prisma migrations.
- **WSL2 relocation**: one-time cost, no recurring obligation.

---

## Recommendations

### The scored decision matrix

Weights derive from the requester's ranking. **Re-weight the columns and the answer may
change: that is the point of showing the working.** Scores are 1–5.

| Option | Solo sustain. (30) | Portfolio (25) | Coherence (20) | Incremental (15) | Headroom (10) | **Total** |
|---|---|---|---|---|---|---|
| 1. Full monorepo | 3 | **5** | 4 | 2 | 3 | **355** |
| 2. Polyrepo unchanged | 4 | 1 | 3 | **5** | 3 | **310** |
| 3. Hub + satellites (new repo) | 3 | 2 | 4 | **5** | **5** | **345** |
| 4. Partial monorepo (Next.js only) | 4 | 3 | 4 | 3 | 4 | **360** |
| **5. Anchored Hub** ⭐ | **4** | 4 | 4 | 4 | **5** | **410** |

**Option 5 is the fifth option your prompt invited**, and it is the pick:

> **`cuatro-portfolio` becomes a Turborepo monorepo containing the four Next.js apps, and
> also publishes the design tokens, reusable workflows and app registry consumed by the
> remaining independent satellites.**

It beats Option 3 because it needs no sixteenth repo and makes the flagship genuinely active.
It beats Option 4 because the hub duties have to live somewhere. It beats Option 1 because it
keeps Turborepo strictly inside the JS/TS boundary where it actually works, and never asks an
orchestrator to handle Elixir, Go, Python or Solidity.

**Runner-up and the condition under which it wins instead:** **Option 1, the full monorepo.**
If you re-rank *portfolio value* to first place with a weight of roughly 50% or more: that
is, if you decide the GitHub profile is the product: Option 1 overtakes. It is the only
option that completely answers the staleness problem, because it is the only one that leaves
you with a single repo. Its cost is that four unrelated toolchains share a tree with no
orchestrator able to help.

*Confidence basis: the matrix rests on D1, which contains this run's weakest evidence, there
is **zero published study** on solo-maintainer repo layout, and every solo conclusion is team
evidence with the team-dependent parts subtracted. Treat this as a reasoned position, not a
finding.*

### Per-project calls

**Archive now, three empty shells, zero cost, immediate estate reduction:**

| Project | Call | Why |
|---|---|---|
| `Lumen` | **Archive** | Empty. An idea, not a project. Keep the idea in the hub's roadmap note. |
| `tcg-tracker` | **Archive → fold** | Empty, so folding is nearly free. Becomes a *domain* inside `cuatro-tracker`, not a repo. |
| `apple-music-workspace` | **Archive** | `requirements.txt` only. |

**Merge into the anchor (`cuatro-portfolio`): the Next.js cluster:**

| Project | Call | Note |
|---|---|---|
| `cuatro-finance` | **Merge** | Next.js + Prisma + Tailwind. Has Storybook: becomes the component workbench for the cluster. |
| `cuatro-tracker` | **Merge** | Harvest its `00-design-system.md` and `deploy-runbook.md` into the hub: they are ecosystem assets sitting in one app. |
| `cs-tournament` | **Merge + migrate** | Move off Vercel/Cloudflare Wrangler to the VPS. Its Go worker stays a separate service. |

**Keep as satellites, each earns its place:**

| Project | Call | Why it stays independent |
|---|---|---|
| `cs-tracker` | **Keep** | Elixir/LiveView, live, and the app that *proves* OIDC federates beyond JS. |
| `digital-library` | **Keep** | Already internally a pnpm monorepo: do not nest a monorepo in a monorepo. Live. |
| `StreamVault` | **Keep** | Python + Vue. The Vue representation. |
| `MaiCoin` | **Keep** | Solidity/Web3. Fundamentally different deploy model; wallet auth, not OIDC. |
| `poketracker-go` | **Keep** | The Go representation. **If you ever consolidate one project, this is the candidate**: it is the weakest keep. |
| `Mutuo` | **Keep** | Demo accounts only. Has `ARCHITECTURE-SPINE.md` worth harvesting. |
| `list-wheel` | **Keep, low effort** | The only Angular app. Framework breadth is portfolio value; it is cheap to leave alone. |
| `connect-four-react` | **Absorb** | A finished toy. Delivers more embedded as a playable demo *in* the portfolio than as its own repo. |

**On the four trackers: the direct answer:** they are **not one product with four domains,
and not four separate products. They are one product *family* with four implementations.**
Unify them through the token layer and a shared "Trackers" section in the app registry, not
by merging code. `tcg-tracker` folds because it is empty; `cs-tracker` (Elixir) and
`poketracker-go` (Go) would cost real weeks to merge and would delete two of your six
frameworks from the portfolio. Given you explicitly value stack variety, **paying weeks to
reduce variety is the wrong trade.**

**Net effect: 15 repos → 8.** Three archived (`Lumen`, `tcg-tracker`, `apple-music-workspace`),
three merged into the anchor (`cuatro-finance`, `cuatro-tracker`, `cs-tournament`), one
absorbed (`connect-four-react`). What remains: the anchor `cuatro-portfolio`, plus seven
satellites: `cs-tracker`, `digital-library`, `StreamVault`, `MaiCoin`, `poketracker-go`,
`Mutuo`, `list-wheel`.

*Intermediate checkpoint: Step 0 alone (archiving) takes 15 → 12. The remaining reduction to 8
happens across Steps 3 and beyond, and is not required for the ecosystem to start working.*

### Deployment topology

| Decision | Call | Confidence |
|---|---|---|
| Reverse proxy | **Traefik v3.7**: stock image handles Cloudflare DNS-01 via env vars; Caddy needs an `xcaddy` rebuild on every upgrade | Medium-high (Cloudflare not named inline in the Traefik page read) |
| Routing | **Subdomains**: already the incumbent; published regret case against paths | High |
| Database | **One Postgres container, one database + one role per app.** Not schema-per-app (couples Prisma migrations) | High |
| Supabase | **Plain Postgres on the box** unless auth/realtime is genuinely used. Self-hosting Supabase needs 10+ containers and 8 GB for itself | High |
| Builds | **Build in CI → push to GHCR. The box never compiles.** `next build` on a serving 2-core box is the top unmeasured risk | High |
| Zero-downtime | `docker-rollout`: *only if* you first have real healthchecks. Plain `compose up` stop-then-recreates; `deploy:` is inert outside Swarm | High |
| Resource caps | Service-level `cpus:` and `mem_limit:`. **Verify with `docker inspect`: documentation does not certify enforcement** | Medium |
| Backups | `pg_dump` on cron + **restic 0.19.0** offsite. PITR buys a smaller loss window, not correctness | High |
| Monitoring | **External uptime + certificate-age check, bought before any automation** | High: no users means no error signal |
| Overflow | **Railway** for 2–3 heavy apps if the box does not hold: $15–30/mo, inside budget | High (four-source pricing) |

### Identity: per your decision, managed

**Pick: Clerk.** With **ten** login-bearing clients, Clerk's explicit vendor statement that
"every plan supports unlimited applications" (free to 50,000 MRU per app) beats WorkOS's
**silence** on any application cap. WorkOS's 1M MAU free tier is more generous on volume, but
volume is not your constraint and silence is not a guarantee.

- **Architecture:** OIDC Authorization Code + PKCE per app, each app keeping its own host-only
  `__Host-` session. Not a domain-scoped cookie.
- **Logout:** RP-Initiated + Back-Channel. Wire `live_socket_id` broadcast in `cs-tracker` or
  logout will not reach an open socket.
- **Migration:** `cs-tournament`'s Supabase users move without a password reset, bcrypt
  hashes are exportable and mappable.
- **ForwardAuth:** not the primary architecture, but **do** use it to gate the Traefik
  dashboard and any admin surface that has no auth of its own.
- **Reversibility hedge:** OIDC *is* the abstraction seam. Swapping Clerk for a self-hosted
  provider later changes issuer configuration, not application code.

### Design system

Exactly as specified in D2: `tokens.css` (plain `:root`) for universal consumption plus a
generated `@theme inline` adapter for the Tailwind cluster. **But do not build the
distribution machinery yet**: see sequencing.

### Dev environment: the explicit call

**Do not adopt devcontainers.** The framing "monorepo *or* devcontainers" is a false
dichotomy (they are independent axes) but independence cuts both ways: nothing in the
ecosystem decision requires them, and the tooling is still **pre-1.0 after years** with
support that is materially VS Code-centric. For a solo developer they add N definitions to
maintain against no evidenced benefit; the public record contains **no data at all** on their
6–12 month cost.

**Do the WSL2 relocation instead** (Step 8). It is a one-time cost with no recurring
obligation, it is backed by Microsoft's own current guidance, and it addresses the dominant
avoidable expense on your machine: file I/O across the OS boundary. Revisit devcontainers
only if you hit a concrete toolchain-version conflict between projects that `mise` or
per-project version files cannot resolve.

*Confidence: medium. The recommendation against adoption rests partly on an evidence
**absence** (nobody publishes devcontainer running costs) which is a weaker basis than a
finding.*

### The sequenced migration path

Every step leaves a working system. **Steps 0–2 are the ones that matter; everything after is
trigger-gated rather than scheduled.**

**Step 0: hours, do it first.** Archive `Lumen`, `tcg-tracker`, `apple-music-workspace`. Buy
an external uptime + certificate-age monitor. Add Cloudflare bot rules to the four live
subdomains. → *Estate 15→12, and for the first time you have an error signal.*

**Step 1, one week, passive.** Run `docker stats` on the current box and record real idle and
loaded footprints per container. **Gate: if 15-minute load average exceeds ~1.4 with today's
four apps, offload to Railway before adding anything.** This replaces the number the research
could not obtain.

**Step 2: the visible ecosystem moment.** Hand-copy one `tokens.css` into `cuatro-portfolio`
and one other live app. No npm package, no Renovate, no hub machinery. *Two apps visibly
become one family: this is the smallest step that delivers real ecosystem value.*

**Step 3: the anchor merge, one app at a time.** `cuatro-finance` into `cuatro-portfolio` as
a Turborepo workspace (preserve history with `git subtree` or `git-filter-repo`). Verify.
Then `cuatro-tracker`. Then `cs-tournament`, moving it off Vercel.

**Step 4: build in CI, push to GHCR.** The box stops compiling. Prerequisite for Step 5.

**Step 5: greenfield VPS rebuild** on Traefik + one Postgres, migrating one subdomain at a
time. Cheap because nothing has real users and you have said the box may be wiped.

**Step 6 (identity.** Clerk on `cuatro-portfolio` first, then `cs-tracker`) because proving
OIDC across the JS/Elixir boundary is the whole thesis.

**Step 7: earned, not scheduled.** *Only after you have hand-copied a token change three
times* should you build the npm package, the Renovate shareable preset and the reusable
workflows. Let the frequency justify the mechanism.

**Step 8: independent of everything above.** Relocate repos from `C:\` into the **WSL2 ext4
filesystem**. Copy first, delete after verification; `git worktree repair`; expect
`safe.directory` and `core.longpaths`.

### Standing rules that fall out of the evidence

- **No Renovate automerge** unless a project has a real test suite. Renovate opens PRs; you
  merge them.
- **The app registry ships only after the bot filter**: it is a crawler amplifier by
  construction.
- **Alert on certificate age**, not just expiry: lifetimes drop to 64 days in Feb 2027 and 45
  in Feb 2028.
- **Do not adopt `wal-g`** on current evidence: its liveness could not be established.

### Downstream bindings

| Output | Consumes |
|---|---|
| **Architecture spine** | The contracts-federate principle (Cross-dimension #1); the VPS topology table; the OIDC + per-app-session shape |
| **Product brief** | The 15→11 estate decision and the tracker-family framing |
| **Roadmap / epics** | Steps 0–8, with Steps 0–2 as the first epic |
| **Risk register** | The capacity gate at Step 1; certificate-age alerting; the no-error-signal problem |

---

## Open questions

What this research could not answer, and what it would take.

### Blocking nothing, but you should settle these before writing code

| Question | Why it is open | How to close it |
|---|---|---|
| **Does this estate actually fit on 2 vCPU?** | Only one footprint number exists in citable form. Everything else is unpublished. | **Step 1: `docker stats` for a week.** One measurement beats all further searching. |
| Does `deploy.resources.limits` take effect under `docker compose up`? | Both Docker's page and the upstream compose-spec document `order:` with **zero runtime scoping**: a documented absence, not a search failure. | `docker inspect` → read `HostConfig.NanoCpus` / `HostConfig.Memory`. One command. |
| Does `@plugin "daisyui/theme"` accept `var()` references? | Undocumented either way; daisyUI's docs show only literal oklch. | Scratch `mix phx.new` app, ten minutes. Fallback is plain `[data-theme]` CSS. |
| Does Traefik ForwardAuth re-check WebSockets after handshake? | **WebSockets are not mentioned anywhere** in the v3.7 ForwardAuth reference. | Test with a LiveView socket: only matters if you use ForwardAuth for an app, which is not recommended. |
| Phoenix v1.8.0 `app.css` exact contents | Fetched as a structural summary, not verbatim; directive spellings are paraphrased. | Read the file byte-for-byte before authoring the adapter. |

### Genuinely unanswered by the public record

- **Solo-maintainer repository layout has zero published study.** Not a search failure: the
  literature is written by and for teams. Every solo conclusion here is team evidence with the
  team-dependent parts subtracted. This is the weakest foundation in the report and it sits
  under the highest-stakes decision.
- **No published number exists for the N-framework design-system maintenance multiplier.** The
  search surface is entirely agency marketing. Only behavioural evidence exists.
- **No first-hand retrospective on where token-only coherence breaks.** The holds/drifts split
  is inference.
- **No published case study names any design system's cross-repo token distribution
  mechanism.** The recommended mechanism is assembled from primary tool docs, not copied.
- **No design system serving both a Phoenix/LiveView app and a JS-framework app exists in
  public.** You would be building it without precedent.
- **No authoritative guidance on cookie-vs-OIDC for first-party suites.** That verdict derives
  from spec mechanics.
- **Backup restore-testing guidance** was searched for and not found.
- **Devcontainer ongoing cost at 6–12 months**: rebuild times, disk consumption, is
  unpublished by Microsoft or anyone else.
- **Proxy, BEAM, Fastify and Postgres idle footprints** are not published in citable form; the
  available tier was AI-generated content farms and two researchers independently refused it.

### Ran out of budget, not out of sources

- **Ory Hydra**: the piece that actually matters for OIDC in the Ory stack, was never
  reached.
- Casdoor's database and runtime requirements; a Logto version/date conflict (2024 vs 2026)
  the researcher correctly refused to average.
- Four of eight Windows relocation sub-items: IDE workspace absolute paths, Compose bind
  mounts, `core.filemode`/symlinks, OneDrive-synced folders.
- Load-average-per-core thresholds, post-hoc OOM detection, swap-on-a-container-host guidance.
- Cloudflare Origin CA validity periods; HTTP-01 behaviour while proxied.
- 9 of 13 named design systems were left unverified rather than filled from memory.

---

## Verification note

A fresh-context pass re-fetched sources and checked whether each says what this report claims.
**13 claims across 12 sources were checked: 0 mismatches**, and every quoted string appears in
its source exactly as printed. Three corrections were applied to the text above, and are noted
inline where they land:

| # | Finding | Correction applied |
|---|---|---|
| [73] | **OVERSTATED.** Keycloak publishes *no* minimum; the 3 vCPU figure is one pod of a three-pod cluster sized for 45 logins/sec. | Confidence downgraded high → medium. Keycloak reclassified "poor fit" rather than "disqualified". Cross-dimension insight #3 narrowed to authentik and Logto. |
| [51] | **OVERSTATED.** The 639,880 KB / 103.3% figure is exact and correctly transcribed, but was measured during a bot crawl, so the "four apps = 412%" projection treats an attack peak as steady state. | Reframed as an upper bound, not expected demand, in the executive summary and in Contrary evidence. Confidence → medium-low. Step 1's measurement gate is unchanged and is the right remedy. |
| [64] | **Arithmetic error.** Railway unit prices verified correct, but 12 × $6.40 = **$76.80**, not the $61/mo stated. | Corrected to ~$77/mo throughout. |

**Scope limit, stated plainly:** roughly **85% of the 97 sources were not re-checked**. The
verified spine (the numbers and quotations the recommendation rests on) is sound. The whole
citation apparatus is *not* established, and this report should not be read as though it were.
Unchecked areas include the Turborepo quotation [1], the Supabase evidence [62][63], the
design-system evidence [28][29][32], and the entirety of D4.

**Rows carrying no captured URL: [26][27][50][53][60].** Two of these are load-bearing:
**[53]** (why nginx is cut) and **[60]** (why subdomains beat paths). Both are flagged in place
and should be re-located before either conclusion is treated as settled.

---

## Staleness map

Computed from the claim ledger via `recon_kit.py staleness`, not hand-derived. Windows follow
the technical pack (`version` 1 mo · `ecosystem` 6 mo · `performance` 6 mo · `pattern` 24 mo ·
`failure` 24 mo) plus the select shape's `cost`/pricing bar of 3 months.

**12 of 40 tracked claims are already past their re-check window as of 2026-08-15.**

| Re-check by | Claims | Note |
|---|---|---|
| **Already stale** | Phoenix 1.8.0 ships Tailwind v4 + daisyUI · Nx non-JS plugin roster · `primer/view_components` maintenance mode · the Next.js 103.3% CPU measurement · the Cloudflare 90% bot reduction · Material Web maintenance mode · devcontainers CLI 0.88.0 · `docker-rollout` v0.14 · Traefik/Caddy versions · Tailwind v4.3.3 · next-auth versions · backup-tool versions | Version numbers age in **one month** by the pack's own bar. Re-read release pages before pinning anything. |
| **2026-09-01** | Style Dictionary · Renovate · Pocket ID · Better Auth · `oidcc` · PaaS versions · DSD Baseline status | The one-month version bar |
| **2026-11-01** | **All pricing**: Clerk, WorkOS, Supabase, Railway, Keycloak sizing · Let's Encrypt lifetime schedule · Lit SSR status | Pricing bar, 3 months |
| **2027-02-01** | moon v2 toolchains · Turborepo scope · LiveView heartbeat | 6-month ecosystem bar |
| **2027-10-01 →** | DTCG format stability · RFC 9700 flows · Kubernetes/Bazel · React DSD | Long-lived pattern and failure claims |

**Earliest re-check: already due.** The two load-bearing numbers, the Next.js CPU
measurement and the Cloudflare bot reduction: are both past their six-month performance
window *and* were single-source to begin with. **Step 1 of the migration path replaces both
with your own measurements**, which is the correct fix rather than re-searching.

**Whole-report staleness:** a selection report older than two quarters should be refreshed
before anyone acts on it. **Refresh this after 2026-11-15.**
