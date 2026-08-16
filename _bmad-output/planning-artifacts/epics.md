---
stepsCompleted: [1, 2, 3, 4]
status: final
inputDocuments:
  - _bmad-output/planning-artifacts/architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/prds/prd-cuatro-portfolio-2026-08-15/prd.md
  - _bmad-output/planning-artifacts/prds/prd-cuatro-portfolio-2026-08-15/addendum.md
  - _bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/EXPERIENCE.md
  - _bmad-output/planning-artifacts/research/technical-cuatro-ecosystem-architecture-2026-08-15/research.md
  - _bmad-output/planning-artifacts/ecosystem-epics-prompt.md
---

# Cuatro Ecosystem - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the Cuatro Ecosystem,
decomposing the requirements from the PRD, the UX design contract and the Architecture Spine
into implementable stories.

**Scope is the Ecosystem Layer**: the Anchor (`cuatro-portfolio`), seven Satellites, the
published contracts binding them, and the single VPS they run on. Per-App Layer feature work
is out of scope in every application (PRD §8).

**The Architecture Spine's Capability → Architecture Map is the epic skeleton.** The seven
epics are fixed by it and are not re-cut here. Every story names the AD that governs it; a
story that satisfies its acceptance criteria but violates its AD is a defect.

**Four forced changes are already applied below** — the requirements inventory records the
*corrected* FRs, not the originals. See § Forced Changes Applied.

---

## Requirements Inventory

### Functional Requirements

Source: `prd.md` §4, as corrected by `ARCHITECTURE-SPINE.md` § Contradictions and Forced
Changes. FR IDs are global and stable, not positional — FR-35 sits beside FR-5 because it
modifies it.

**§4.1 The Hub Front Door**

- **FR-1** — Narrative resolves into the Suite Directory as the terminal section of the primary
  scroll, no click and no route change. `/cv`, `/work`, `/recommendation`, `/celeste` remain
  reachable and functional. Nothing follows the Directory except footer content.
- **FR-2** — The Suite is reachable without the narrative: a stable in-page anchor or route
  resolves straight to it; it renders and is fully usable when the 3D narrative fails, is
  blocked, or is disabled by reduced-motion; at most one interaction from a cold arrival with no
  intervening scroll requirement.
- **FR-3** — The Suite Directory is legible at 360px: every rendered entry's name, description,
  Status and `tech` readable without horizontal scrolling; Status never truncates; the live link
  and source link are independently addressable tap targets.
- **FR-4** — The Hub declares what the Ecosystem is: one statement of the premise, at most three
  sentences, encountered before or with the Suite Directory, parseable by a reader who cannot
  name a single framework involved.

**§4.2 The App Registry**

- **FR-5** — The App Registry is exhaustive: exactly one Registry Entry per application in the
  Estate, including Archived and unbuilt ones. Archived applications appear as entries with
  Status `Archived`, not by omission. Exhaustiveness is a property of the Registry (the data),
  not of the Suite Directory (its rendering) — see FR-35.
  **[CORRECTED — C-3 / AD-6]** The Registry's unit is the **application**, not the repository.
  An archived or absorbed application keeps its entry. Registry entry count and the
  eight-repository Estate count are deliberately different numbers, and neither validates the
  other. *(This replaces the original third consequence bullet, "No Registry Entry exists for an
  application not in the Estate.")*
- **FR-35** — The Suite Directory renders a curated subset: at MVP only entries with Status
  `Live` or `Complete`. The filter is a declarative rule over Status, never a hand-maintained
  second list — changing an entry's Status to `Live` makes it appear with no other edit. The
  Registry stays complete behind it for link verification (FR-32), the Estate record (§5) and
  any consumer wanting the full picture.
- **FR-6** — The Registry Entry contract. Downstream consumers may rely on field presence.
  Validation failure fails the build; a malformed entry cannot ship. `source` is required on
  every entry without exception. `live` is required when `status` is `Live` and forbidden when
  `status` is `Archived`.
  **[CORRECTED — C-4, C-5 / AD-5, AD-12, AD-16]** Required on every entry: `id`, `name`,
  `description`, `status`, `tech[]`, `source`, **`demo`**, **`identity`**. Optional: `live`,
  `family`, `absorbed_into`, `token_contract`. `demo` and `identity` are **required with an
  explicit value including `none`** — an absent field is never a permitted way to say "not
  applicable". `identity` takes exactly one of `oidc`, `wallet`, `none`. `token_contract`
  records the Satellite's adopted contract version and is what makes AD-18's scheduled drift
  check possible. The envelope carries `contract_version`.
- **FR-7** — The Status taxonomy: exactly `Live`, `Complete`, `In progress`, `Archived`, each
  with a fixed meaning inferable without a legend. No fifth value passes validation. The Hub
  renders Status as a visually distinct element on every entry, never buried in description
  prose.
- **FR-8** — Editorial voice of `description`: written for Daniela not Marcus — what the
  application does *for a person*; one to three sentences, never four; plain declarative voice,
  no superlatives, no marketing adjectives, no first person; leads with the thing itself.
- **FR-9** — The `tech` array reflects what the application runs on today. The
  `digital-library` entry's stale value is corrected before the Registry ships. An inaccurate
  entry is a defect, not a cosmetic issue.
  **[NARROWED — C-1]** The only stale value is `Hetzner VPS`. `content/projects.ts:23` already
  lists `SQLite` correctly; the broader "runs on SQLite not Postgres" claim from the UX
  validation report does not carry forward.
- **FR-10** — Every entry drills through to source in one interaction. The `source` link
  resolves to the repository, not the maintainer's profile. Present and functional on every
  entry including `Archived`. Direction of travel is Hub → repository.
- **FR-11** — The Tracker Family is grouped and explained: `cuatro-tracker`, `cs-tracker` and
  `poketracker-go` share a `family` value; the Directory renders whichever members pass the
  FR-35 filter as a labelled group; the group carries a one-line framing statement that holds
  regardless of member count and names no count. `tcg-tracker` appears as `Archived` with
  `absorbed_into: cuatro-tracker`, not as a family member.
- **FR-12** — The Registry is published as a consumable contract: retrievable by a Satellite in
  Elixir, Go, Python, Svelte, Vue or Angular without importing JavaScript from the Anchor; the
  published shape is versioned so a consumer can detect a change; the Hub consumes the same
  published Registry it publishes, with no private second copy.
  **[CORRECTED — C-6 / AD-4]** `content/projects.ts` is **retired, not promoted**.
  `contracts/registry.json` is hand-authored JSON validated by `contracts/registry.schema.json`
  in CI. A TypeScript module cannot satisfy FR-12 for an Elixir or Go consumer, and an emitted
  copy would give the Hub a second representation to drift from.

**§4.3 The Suite Switcher** *(v2 — deferred from MVP, PRD §9.2)*

- **FR-13** — Discovering the Ecosystem from inside a Satellite: the switcher is present in
  every `Live` application; it lists entries drawn from the published Registry, never a
  hardcoded per-app list; it applies the same Status filter as the Suite Directory; each listed
  application is one interaction away; adding a Registry entry makes it appear in every switcher
  with no per-application code change.
- **FR-14** — The switcher reads as siblings, not tabs: selecting an application performs a full
  navigation to that application's own origin; no implication of shared state, shared history or
  a common shell; the Hub is present and distinguishable from the applications.
- **FR-15** — The switcher is cheap for a Satellite to adopt: consuming the published Registry
  plus the Design Tokens plus framework-native rendering. No Satellite imports a component
  package from the Anchor.

**§4.4 Shared Visual Identity**

- **FR-16** — One token contract, consumable by every framework in the Estate: Next.js,
  React/Vite, Svelte, Vue, Angular and Phoenix LiveView, without a framework-specific build step
  in the consuming application and without a JavaScript runtime dependency on the Anchor.
  Covers at minimum colour, typography, spacing, radii, elevation, motion.
- **FR-17** — The Anchor consumes its own tokens: no colour, spacing or type value in the Hub's
  own styling bypasses the token contract for values the contract covers. Scoped to
  CSS-expressible styling — the Three.js narrative is a declared exception (seam S-1).
- **FR-18** — Visible family resemblance across at least two Live applications on different
  frameworks rendering from the shared tokens, encountering the same palette, type scale and
  spacing rhythm. This is the acceptance condition for "the Ecosystem is visible" and is
  reachable before any distribution machinery exists.
- **FR-19** — Token changes propagate without breaking a Satellite silently: adoption is an
  explicit reviewed action, never an unattended automatic merge; the Operator can determine which
  Satellites are on which version; no automated dependency merge in any repository lacking a real
  test suite.

**§4.5 Cross-App Identity** *(v2 — deferred by sequence, PRD §9.2)*

- **FR-20** — One identity across applications: authenticating at one application and opening a
  second results in an authenticated session with no credential prompt; each application
  maintains its own host-scoped session with no cross-subdomain cookie; federation is
  protocol-based so language and framework are irrelevant.
- **FR-21** — The polyglot boundary is crossed and demonstrable: the Hub (Next.js) and
  `cs-tracker` (Phoenix LiveView) both participate; a Visitor can observe the same identity
  carrying across that boundary. This pair is the acceptance condition; further applications are
  optional.
- **FR-22** — Sign-out reaches every session including open sockets: after sign-out a previously
  authenticated application requires re-authentication; an application holding an open persistent
  socket observes the sign-out and does not continue serving authenticated state; verified
  against the Phoenix LiveView case specifically.
- **FR-23** — Identity is replaceable without touching application code: no participating
  application contains provider-specific logic beyond issuer configuration and client
  credentials.
- **FR-24** — Non-participating applications are declared, not silently excluded. `MaiCoin` is
  declared non-participating (wallet auth, structurally exempt). Any application with no
  authentication declares that in its Registry Entry rather than appearing broken.

**§4.6 Demo Access** *(v2 — deferred with identity, PRD §9.2)*

- **FR-25** — A Visitor can use a real application without registering: every `Live` application
  requiring authentication provides a Demo Account obtainable from its own sign-in surface;
  it reaches the core function, not a stripped-down preview; no registration, email verification
  or personal data at any point.
- **FR-26** — Demo state is bounded and self-recovering: demo data isolated from Operator data;
  a defined baseline dataset per application; state returns to baseline without manual
  intervention within a window short enough that two Visitors arriving the same day both find a
  usable application; a Visitor cannot delete or lock out the Demo Account.
- **FR-27** — Demo Access is declared per entry: every entry carries a `demo` declaration
  covering at least usable-with-demo-account / usable-without-authentication / not-deployed; the
  declaration is accurate; structurally exempt applications declare their actual access model.
- **FR-28** — Demo Access degrades honestly under capacity pressure: an application taken offline
  has its Status moved off `Live` and its `live` URL removed **in the same change**; no entry
  ever presents a `live` URL that does not resolve.

**§4.7 Embedded Playable Demo** *(v2, PRD §9.2)*

- **FR-29** — Connect Four playable inside the Hub, no authentication, no external service, no
  VPS capacity beyond the Hub's own serving.
- **FR-30** — Absorption is recorded, not hidden: `connect-four-react` appears as a Registry
  Entry with `absorbed_into` naming the Anchor, and its `source` resolves to where the code now
  lives.

**§4.8 Ecosystem Observability**

- **FR-31** — The Operator learns of breakage from a machine: every `Live` application externally
  monitored for reachability; certificate **age** monitored, not only expiry; monitoring external
  to the VPS so a whole-box failure still notifies; monitoring exists **before any automation is
  enabled anywhere** in the Ecosystem.
- **FR-32** — The Registry cannot lie: every `live` URL on a `Live` entry and every `source` URL
  on every entry checked on a schedule; a failing link notifies the Operator.
- **FR-33** — The Capacity Gate governs what may run: per-container resource usage measured and
  recorded before any additional application is placed; a written threshold exists and crossing
  it blocks further placement rather than triggering a judgement call; the response at the
  threshold is a named overflow path, not a downgrade of honesty.
- **FR-34** — Visitor behaviour at the Hub is measurable: reaching the Suite Directory is a
  distinguishable event from loading the homepage; opening a `live` link and opening a `source`
  link are distinguishable events; first-party and self-hosted only.

### NonFunctional Requirements

Source: `prd.md` §6.

- **NFR-1 — Solo-maintainable indefinitely.** Operable by one person with no coordination.
  Anything implying a second maintainer, a review queue or an on-call rotation is out of scope by
  construction.
- **NFR-2 — Nothing live may break.** `cuatro.dev`, `cs-tracker.cuatro.dev`,
  `tracker.cuatro.dev` and `library.cuatro.dev` serve today, as does `list-wheel` on its current
  host. All keep serving through every step, including the relocation. No step may leave a broken
  application.
- **NFR-3 — Capacity-bound.** 2 vCPU is a hard ceiling and is unproven. No requirement may assume
  headroom; where capacity is unmeasured the requirement is gated (FR-33), not assumed.
- **NFR-4 — Cost-bound.** All-in spend within $40–100/month. The VPS is prepaid to 2028, so only
  marginal spend counts.
- **NFR-5 — Mobile-first for the Hub.** Hub requirements are satisfied on a mobile viewport
  before a desktop one.
- **NFR-6 — Reduced-motion respect.** Honoured without denying access to the Suite Directory.
- **NFR-7 — Crawler exposure is managed.** Bot mitigation is a prerequisite for shipping the
  Suite Directory, not a follow-up.
- **NFR-8 — First-party data only.** No third-party analytics, tag manager, session recorder or
  tracking script anywhere in the Ecosystem, Anchor or Satellite.
- **NFR-9 — Honesty over completeness.** Where the Registry could overstate or under-promise, it
  under-promises.
- **NFR-10 — No unattended automation without a test suite.** Nothing merges or deploys
  unattended in a repository that cannot detect its own breakage.

### Additional Requirements

Source: `ARCHITECTURE-SPINE.md`. The ADs are the invariants stories are measured against.

**No starter template.** This is a brownfield reshape of `cuatro-portfolio@2.5.3`, a shipping
Next.js 16 / React 19 / SCSS site. Epic 1 Story 1 is not a scaffold step. The Turborepo
structure in the Structural Seed (`apps/`, `packages/`, `contracts/`) does not exist yet —
`pnpm-workspace.yaml` declares only `onlyBuiltDependencies` and has no `packages:` key, and
`turbo` is not in `package.json`. Creating that structure is real work in Epics 2 and 3.

**Architecture Decisions (AD-1 … AD-23)**

- **AD-1** — The contract boundary is a directory, and CI holds it. Entire published surface is
  `contracts/`, served at `https://cuatro.dev/contracts/`. CI fails if any file under
  `contracts/` matches `\.(ts|js|tsx|jsx|mjs|cjs)$`. Generators live in `packages/` and are never
  published.
- **AD-2** — Code may be shared inside the Turborepo boundary, never across it. `apps/*` may
  depend on `packages/*`; no Satellite may depend on any `packages/*` artifact. Turborepo governs
  JS/TS only. A shared React package is created only after real duplication accumulates across
  two or more apps.
- **AD-3** — One application id, mechanically derived everywhere: lowercase kebab-case equal to
  the repository name → GHCR image, compose service, Traefik router, Postgres database and role
  (hyphens → underscores), Clerk client. **The public hostname is not derived** — it is declared
  per entry in the Registry, which is the only mapping.
- **AD-4** — The App Registry is authored JSON validated by schema. `contracts/registry.json` is
  the only Registry; `contracts/registry.schema.json` fixes the shape; the file carries `$schema`
  so the editor validates while writing; CI validates and fails the build. The Hub imports it
  directly. Satellites fetch it at **build** time, never at request time — a Satellite's switcher
  is stale until its next rebuild, deliberately.
- **AD-5** — The Registry entry shape (see corrected FR-6). `status` accepts exactly four
  strings. The envelope carries `contract_version`; value change = minor bump, field rename =
  major.
- **AD-6** — Registry membership is by application, not by repository.
- **AD-7** — Each application is one independent deploy unit, addressed by host. One Dockerfile,
  one GHCR image, one compose service, one Traefik router per id, including the four inside the
  Anchor. A deploy names exactly one id. Every router matches on `Host`; `PathPrefix` routing
  between applications is forbidden.
- **AD-8** — Build in CI, push to GHCR; the box never compiles. Images built in GitHub Actions,
  tagged with the git sha; deployment pulls a tag and runs `docker-rollout`, never a build. For
  the four Anchor applications the build context is the repository root **narrowed by
  `turbo prune --docker`** with the Dockerfile at `apps/<id>/Dockerfile`. `docker-rollout`
  requires real healthchecks and services without `container_name` or published `ports`.
  **The current `deploy.yml` is a standing violation until Epic 3.**
- **AD-9** — The Capacity Gate blocks new placement mechanically and defaults to blocked.
  `ops/capacity-gate.yml` records `measured_at`, `baseline`, `threshold`, `reading`, `status`,
  `overflow`, `placements`. The deploy workflow reads it: placing a **new** id fails while
  `status: blocked`; existing ids always deploy so NFR-2 is never traded against the gate. The
  gate measures 15-minute load average; per-container `cpu.pressure` (cgroup v2) is the
  diagnostic. **Until Epic 1's measurement week writes a threshold, `status` is `blocked`.**
- **AD-10** — One Postgres, one database and role per consumer; never schema-per-app. Explicit
  `connection_limit` per application, sum under `max_connections`; no PgBouncer. An application
  using a different store declares it in `tech` and **carries its own offsite backup path**.
  `digital-library` (SQLite + Redis) is the declared exception. Backups are `pg_dump` on cron
  plus restic offsite; a declared non-Postgres store without an equivalent offsite path is
  unbacked data, which is a defect.
- **AD-11** — Identity federates by protocol; sessions never leave their host. OIDC Authorization
  Code + PKCE per application against one Clerk issuer; each application mints its own
  `__Host-` session; no `Domain=.cuatro.dev` cookie anywhere. Logout is RP-Initiated plus
  Back-Channel, and `cs-tracker` additionally broadcasts on `live_socket_id`. Traefik ForwardAuth
  gates only surfaces with no authentication of their own, never an application's identity path.
- **AD-12** — Identity participation is declared, never inferred.
- **AD-13** — Demo access is one contract, implemented per stack. The demo principal is
  `demo@cuatro.dev` in every application and owns every demo row. Each application exposes an
  idempotent `demo:reset` that deletes by owner and reseeds a baseline fixture committed in its
  own repository. **Reset is scheduled on the host, outside the application containers** — one
  scheduler for the estate. Hourly by default, per-application override permitted. The demo
  principal cannot be deleted and its credentials cannot be changed from inside the application.
- **AD-14** — Token consumption route is a property of the consumer, and adoption is
  all-or-nothing. `tokens.css`, `fonts.css` and `tailwind.css` are versioned together and copied
  as a **folder named `cuatro-contracts/`**, never as individual files and never under another
  name. Tailwind consumers — `cuatro-finance`, `cuatro-tracker`, `cs-tournament` **and
  `cs-tracker`** — import `tailwind.css`; non-Tailwind consumers import `tokens.css` +
  `fonts.css`; the Anchor is SCSS and consumes the plain pair. `--token-*` and Tailwind's
  `--color-*` never share a name across a `var()`. `inline` is mandatory on `@theme`. A Satellite
  adopts the whole contract or none of it.
- **AD-15** — The Phoenix route carries both daisyUI paths: `@plugin "daisyui/theme"` with
  `var()` if a scratch `mix phx.new` confirms it is accepted, and `[data-theme="…"]` plain CSS if
  not. The test gates the step, not the contract; both paths satisfy FR-18.
- **AD-16** — Contract changes are versioned; adoption is explicit and recorded. Value change =
  minor, any rename = major including a typo fix. Model is deprecate → migrate → remove. Each
  Satellite's adopted version is declared in `token_contract` and **verified** against the
  `Contract vX.Y.Z` header in its vendored `cuatro-contracts/tokens.css` by the same scheduled
  job that checks links.
- **AD-17** — Three prerequisite gates, each a blocking predecessor, never a parallel task:
  (a) external uptime + certificate-**age** monitoring before any automation is enabled anywhere;
  (b) bot mitigation live on every live subdomain before the Suite Directory ships;
  (c) the Capacity Gate carries a written threshold before any new id is placed.
- **AD-18** — The Registry is verified against reality on a schedule, from off the box. One job
  checks, per entry: `source` resolves; `live` resolves whenever `status` is `Live`; the
  Satellite's vendored token version matches `token_contract`. Any failure notifies the Operator.
  Runs external to the VPS.
- **AD-19** — The accessibility floor is asserted, not claimed. Playwright runs in CI against the
  Hub at 360px asserting (a) every interactive element's `boundingBox()` measures at least
  44×44, and (b) the Status mark's **three structural axes** hold per `EXPERIENCE.md` § Status
  mark. **Asserting `border-style` alone is forbidden.** Lighthouse CI's accessibility assertion
  (≥0.95, severity error) stays and is not weakened. After token adoption `cs-tracker` is
  measured once by hand against the same floor and the result recorded. Opacity never expresses
  state.
- **AD-20** — Every step leaves a working system, and the Epic 3 order is fixed. Four subdomains
  serve through every step of every epic. In Epic 3 the Hub moves to `apps/hub` as its **own
  shipped step with nothing else changing** — rewriting `ci.yml`, `lighthouse.yml`, `deploy.yml`,
  `docker/Dockerfile`, `tsconfig.json` and `vitest.config.ts` and nothing more. Then
  `cuatro-finance`, then `cuatro-tracker`, then `cs-tournament`, one shipped and verified step
  each, using `git filter-repo --to-subdirectory-filter apps/<id>` then
  `git merge --allow-unrelated-histories`.
- **AD-21** — One environment; CI is the only pre-production gate. No staging exists and none is
  introduced. Every CI gate is blocking and none may be made a warning: typecheck, unit tests,
  Registry schema validation, `contracts/` purity, the Playwright floor, Lighthouse accessibility.
- **AD-22** — Settled inputs have a shelf life, and the re-check is bounded. An epic whose first
  story opens after **2026-11-15** records a refresh check first, scoped to exactly: Traefik,
  PostgreSQL, restic and `docker-rollout` versions; Clerk and Railway pricing; the Style
  Dictionary ≥5.5.1 security floor; the Let's Encrypt lifetime schedule. Nothing outside that
  list re-opens.
- **AD-23** — Migrations are a discrete step and must survive the rollout overlap. Never on
  container boot. They run against the application's own database before the rollout starts, and
  each must be backward-compatible with the version still serving — expand first, contract later,
  never both in one release.

**Consistency conventions that bind stories** (spine § Consistency Conventions): ISO 8601 UTC
dates; `ghcr.io/luigiespinosa/<id>:<git-sha>` with no floating tags on estate applications and
third-party infrastructure images pinned to a major at minimum (Umami's `postgresql-latest` is
the one inherited floating tag, pinned during Epic 4); environment variables only, with
`.env.example` documenting every required variable and secrets never in the repository; a failing
gate fails the build or the deploy and never logs and continues; consume `--token-*` semantic
roles and never the raw `--c-*` palette; `color-scheme: dark` on `:root` in every consumer.

**Verified working-tree facts that stories must account for**

- `.github/workflows/deploy.yml` runs `docker compose --env-file .env.production up --build -d`
  over SSH; its step is named "Deploy to Hetzner" (AD-8 standing violation, C-8).
- `docker/Caddyfile` routes **only** `cuatro.dev` and `analytics.cuatro.dev`, while
  `docker-compose.yml` binds Caddy to `:80`/`:443`. `cs-tracker.cuatro.dev`,
  `tracker.cuatro.dev` and `library.cuatro.dev` all resolve but appear nowhere in source (C-9).
- `@playwright/test` is **not** in `package.json` — only a transitive entry in `pnpm-lock.yaml`.
  AD-19 *adds* Playwright; this is real setup cost, not free (C-7).
- CI and Lighthouse workflows pin `node-version: 22`; the target stack is Node 24 LTS.
- `docker-compose.yml` runs `postgres:16-alpine` and `ghcr.io/umami-software/umami:postgresql-latest`.
- `content/projects.ts` holds one entry (`digital-library`) with `github`/`live` optional fields;
  `tech` correctly lists `SQLite` and incorrectly lists `Hetzner VPS` at line 30.
- No `turbo` dependency and no `packages:` key in `pnpm-workspace.yaml`.

### UX Design Requirements

Source: `DESIGN.md` + `EXPERIENCE.md`, treated as one contract. Both files declare they win on
conflict with any mock.

**Token contract — the published artifact**

- **UX-DR1** — Publish `tokens.css`: plain `:root` custom properties, **values only**, naming
  font families but containing no `@font-face`. The full property set is fixed in `DESIGN.md`
  § `tokens.css` — palette (`--c-*` ×11), semantic roles (`--token-*` ×11), families (×3), type
  scale (×10), weight (×5), line-height (×5), tracking (×6), `--measure`, space (×9), shape (×3),
  stroke (×5), elevation (×3), motion (×7), z-index (×7). Header carries `Contract v1.0.0`.
- **UX-DR2** — Publish `fonts.css`: `@font-face` for Bricolage Grotesque, Geist and Geist Mono
  with `url()` paths **relative to itself**, `font-display: swap`, and
  `size-adjust` / `ascent-override` / `descent-override` set so a swap does not shift layout.
  Splitting it from `tokens.css` is what lets a Satellite vendor the folder to any depth.
- **UX-DR3** — Publish `tailwind.css`: generated `@theme inline` adapter. Import order is fixed —
  `tailwindcss`, then `tokens.css`, then `fonts.css`, then the `@theme` block. It **must** import
  `fonts.css`, or the cluster gets three named families and no `@font-face` for any of them.
  Tailwind's `--color-*` maps from `--token-*` and the two namespaces never share a name.
  `inline` is mandatory.
- **UX-DR4** — The three files ship as a folder named `cuatro-contracts/`, copied whole, never as
  individual files and never renamed (this is what makes AD-16's drift check implementable).
- **UX-DR5** — The `@media (prefers-reduced-motion: reduce)` block lives **inside** the contract,
  collapsing `--dur-micro`, `--dur-minor`, `--dur-major` and `--dur-exit` to `1ms`. It is the one
  piece of behaviour the token layer federates.
- **UX-DR6** — Build with Style Dictionary **≥5.5.1** (security floor — 5.5.1 patched a
  prototype-pollution vulnerability in `convertTokenData`), DTCG format 2025.10. Terrazzo is
  rejected.
- **UX-DR7** — Fonts are subset to **latin only**, three variable faces, ≤120 KB gzipped total.

**Anchor SCSS → tokens migration** (`DESIGN.md` § Migrating the Anchor, seven steps, each leaving
the site working)

- **UX-DR8** — *Step 1:* add `tokens.css` + `fonts.css` to `app/scss/`, `@use` from `_index.scss`.
  Nothing consumes them; the site is byte-identical. Ship it.
> ⚠️ **Re-baselined 2026-08-15** against the merged `dev` tree (the cybercore rebrand, PRs
> #46–#70). UX-DR9 through UX-DR13 were authored against `main` and every count and line
> reference in them was stale. See
> [`rebaseline-2026-08-15.md`](ux-designs/ux-cuatro-portfolio-2026-08-15/rebaseline-2026-08-15.md).

- **UX-DR9** — *Step 2:* alias the sixteen existing `:root` properties in `app/app.scss` as
  `var()` references to the new roles, per the mapping table. **The alias trap is now half
  gone:** `--font-bold` and `--monument-bold` encode *weight* in a *family* name, but the
  rebrand retired every `--font-bold` call site. Only `--monument-bold` remains live, at
  `glitch-text.scss:5`, `error-page.scss:24`, `ProjectsHero.scss:19` and `WorkHero.scss:19` —
  set `font-weight` alongside `font-family` at those **four** call sites by hand in step 2.
  **Blocked by O-10** (palette reconciliation): `--accent` and `--accent-dim` cannot be aliased
  until it is decided whether the contract palette or the shipped cybercore palette wins.
- **UX-DR10** — *Step 3:* the old white alpha hairlines are **gone** — the rebrand replaced them
  with a violet set. Replace `rgba(91, 33, 182, 0.06)` (`WorkItem.scss:35`,
  `ProjectCard.scss:36`), `rgba(91, 33, 182, 0.3)` (`WorkItem.scss:145`, `ProjectCard.scss:67`)
  and `rgba(10, 0, 20, 0.6)` (`ProjectCard.scss:27`) with `var(--token-border)` and
  `var(--token-border-interactive)` as the treatment warrants. *(The `boder:` typo this step
  used to also fix no longer exists — that file was rewritten by PR #61.)*
- **UX-DR11** — *Step 4:* sweep the remaining colour literals — **28 lines across 9 files**, up
  from eleven. `#444`/`#fff` in `celeste.scss:2`/`:16`, `#fff` in `navbar.scss:10`, `#0a000f` in
  `HomeLayout.scss:2` and `error-page.scss:7`, the `rgba(140, 90, 210, 0.06)` grid lines in
  both, `rgba(139, 92, 246, 0.15)` at `error-page.scss:28`, the `rgba(0, 0, 0, …)` scanlines at
  `ScanlineOverlay.scss:6`/`:16`/`:17`, and the greys in `_print.scss`. The bare keyword
  `color: white` at the old `HomeLayout.scss:122` **no longer exists** — that file was rebuilt.
  **`glitch-text.scss:33`–`:68` is deliberate, not a stray literal** — `rgba(255, 0, 80, …)` /
  `rgba(0, 255, 255, …)` encode chromatic aberration; tokenize only if O-10 gives them roles.
  `_print.scss` keeps real `#fff`/`#000` and is outside the contract by nature.
- **UX-DR12** — *Step 5:* swap the type — new `@font-face` in `fonts.css`, retire
  `app/scss/_fonts.scss`, delete the General Sans / Monument Extended / Confillia binaries from
  `public/fonts/`, apply `size-adjust` overrides. `--confillia-bold` has zero call sites and is
  deleted; `--confillia-normal` has two (`HomeLayout.scss:117`, `:148`) and is retargeted to
  `--f-display` at `wdth 75` — **O-6: confirm that reads acceptably before this step**.
  `--accent-glow` (`app.scss:11`) has zero call sites and is deleted — **O-11: confirm it is
  genuinely unused, not reserved.**
- **UX-DR13** — *Step 6:* move component stylesheets from `var(--white-color)` to
  `var(--token-text)` and equivalents, per component, never in one commit.
- **UX-DR14** — *Step 7:* delete the step-2 aliases. The contract is then the only source.

**Components — visual and behavioural specification**

- **UX-DR15** — **Status mark.** Uppercase mono at `--t-3xs`, `+0.14em` tracking, `1px` border,
  `--s-2xs`/`--s-xs` padding, square, **outlined never filled**. Per value: `Live` = 4px filled
  square dot + solid `--token-accent`; `Complete` = no dot, solid `--token-border-interactive`;
  `In progress` = **dashed** `--token-border-interactive`; `Archived` = **no border at all**.
  Three structural axes, no two alike in greyscale. Never expressed with opacity. Not interactive
  — no tooltip, no popover, no hover state — so the 44px floor does not apply to it.
- **UX-DR16** — **Registry Entry.** A grid row, **never a card**, with no containing box. Name in
  Bricolage `wdth 85`/700 uppercase; status hanging right; description at `--t-sm` in
  `--token-text-secondary` capped at `46ch`; tech array in mono `--t-3xs` uppercase; links in mono
  `--t-2xs` uppercase; `1px` hairline separator. Reading order serves Daniela (name → status →
  description → tech → links); tab order serves Marcus (live link, then source link — two stops).
  **The row is never wholly clickable.** `Complete` has no live link at all, not a disabled one.
  Source is present on every entry without exception, including the Hub's own.
- **UX-DR17** — **Tracker Family group.** `1px solid var(--token-border)` on all four sides — the
  only containment layer in the entire directory. Label in mono `--t-3xs` `+0.14em` uppercase in
  `--token-accent`; framing line beneath at `--t-2xs` in `--token-text-secondary` capped at
  `--measure`, closed by a hairline. The last member drops its bottom rule. Not collapsible, not
  a tab set, not reorderable.
- **UX-DR18** — **Links.** Live link: `--token-text` with a `--stroke-emphasis` accent underline.
  Source link: `--token-text-secondary` with a `--stroke-hair` `--token-border-interactive`
  underline. On hover **both** underlines become `--token-accent-hover` and nothing else moves —
  no lift, no scale, no shadow, no background change, no width change.
- **UX-DR19** — **Button.** `1px solid var(--token-border-interactive)`, no fill, square, mono
  uppercase label at `--t-2xs`; border → `--token-accent-hover` on hover. There is no filled
  button anywhere in the system.
- **UX-DR20** — **Framework band.** Bricolage `wdth 75`/700 uppercase at `--t-3xs`, framework
  names alternating `--token-text-secondary` and `--token-accent-muted`, bounded above and below
  by hairlines. Decorative rhythm; carries no state and is not a legend.
- **UX-DR21** — **Plate mark.** Mono `--t-3xs`, `+0.16em` tracking, uppercase,
  `--token-text-secondary`, sitting on a hairline. Section identity top-left, position or domain
  top-right. Appears on section heads carrying a genuine ordinal or domain, never by default.
- **UX-DR22** — **Nav.** Wordmark left in Bricolage `wdth 75`/800; **two** mono uppercase links
  right (`Suite`, `CV`) and no more. Current route carries a `2px` accent underline plus
  `aria-current="page"`. Sticky at `--z-sticky`; does not hide on scroll.
- **UX-DR23** — **Suite Switcher panel** *(v2)*. `--token-bg-raised` ground, `1px`
  `--token-border-interactive` boundary, rows separated by hairlines, hover ground
  `--token-bg-raised-2`; each row is app name in Bricolage `wdth 85`, framework subtitle in mono,
  external-navigation glyph right. It is a **disclosure, not a menu** — `<button>` with
  `aria-expanded` and `aria-controls`, panel is a labelled region of ordinary links, `Tab` moves
  through and out normally, `Escape` closes and returns focus, focus never trapped. **Do not put
  `role="menu"` on it.** If the Registry is unreachable the trigger does not render at all.
- **UX-DR24** — **Focus ring.** `outline: 2px solid var(--token-focus)` at `3px` offset,
  `--r-hair` 2px radius, `:focus-visible` only never `:focus`, applied **instantly** and never
  transitioned, never removed without an equivalent replacement. A different token from hover so
  a keyboard user can always tell focus from hover.
- **UX-DR25** — **Hit targets.** `min-height: 44px; display: inline-flex; align-items: center` on
  the interactive element itself, never as vertical padding on a plain inline element (which
  paints outward without growing the hit area — an inline link with `padding: 0.25rem 0` measures
  ~29px no matter what the padding says). Two targets on one line take `--s-lg` of gap. Narrow
  labels take `padding-inline` to reach 44px wide. **Verified by measurement, not by reading the
  CSS.**

**Information architecture and front door**

- **UX-DR26** — `/projects` **301-redirects permanently to `/#suite`**, not deleted — this keeps
  every inbound link working and satisfies FR-2's "stable anchor **or** route" for free.
  `ProjectCard` and `ProjectsHero` are retired with it.
- **UX-DR27** — Header carries exactly two destinations: `Suite` (primary) and `CV` (secondary).
  Every header link competes with SM-1's ≥60% target.
- **UX-DR28** — `/cv` is **built around the existing `WorkTimeline` component**, reused unchanged
  — `app/cv/page.tsx` and `app/recommendation/page.tsx` are one-line stubs today while `/work` is
  the fully built page. `/work` keeps rendering standalone for anyone holding the URL.
  `/recommendation` is linked from `/cv` and the footer; `/celeste` is footer only.
- **UX-DR29** — **One** non-3D front door: `prefers-reduced-motion: reduce` and the
  slow-connection path receive the **same** typographic hero. No static poster frame of the 3D
  scene is produced. That path reaches the Suite Directory in **zero** interactions.
- **UX-DR30** — Skip control `Skip to the suite ↓` sits **above the fold** on the default path and
  **moves focus**, not just scroll position, to the Suite Directory heading. Distinct from the
  accessibility skip-link, which is the first tabbable element and targets main content.
- **UX-DR31** — Suite Directory ordering is `Live` before `Complete`, then Registry order — not
  alphabetical, not by date. The Hub renders as itself, marked `You are here` rather than linking
  to the page you are on, and this stays declarative (a property of the current origin, not an
  exception to the FR-35 filter).
- **UX-DR32** — State patterns. Registry unreachable → the Directory renders from the build-time
  snapshot. **Empty cannot occur**; if it ever renders empty that is a defect and no empty-state
  illustration is designed. A `live` URL that stops resolving is not a UI state — FR-32 catches
  it and FR-28 degrades the entry. Globally: **no toast system, no confirmation dialogs, no
  skeletons** — do not build them.
- **UX-DR33** — 404: the existing `Error404` inherits the tokens with no new work and offers
  exactly two exits, Suite and CV, matching the header.
- **UX-DR34** — `/cv` accordion: `aria-expanded` on the trigger, `aria-controls` on the panel,
  the first entry opens on load **without a collapsed-height flash**, and the existing
  `useReduceMotion` hook drops the GSAP height tween to `0` duration. Education and Contact do not
  exist in the repository and are **omitted, not rendered empty**.
- **UX-DR35** — `/recommendation` ships **loaded with an attributed quote, or the route is not
  linked at all**. No unattributed and no placeholder state ships.

**Voice and microcopy**

- **UX-DR36** — Six Registry descriptions written to the FR-8 contract. Drafts are supplied in
  `EXPERIENCE.md` § Voice and Tone for Digital Library, Cuatro Tracker, CS Tracker, List Wheel,
  CS Tournament and Cuatro Ecosystem. The existing `digital-library` description is three
  sentences and stack-led — **non-conforming and rewritten**, not grandfathered, with every
  implementation noun moved into `tech`.
- **UX-DR37** — UI strings verbatim: header nav `Suite` · `CV`; skip control `Skip to the suite ↓`;
  directory heading `The Suite` (not "Projects", not "Portfolio"); count `6 running` (a real
  count, never rounded or aspirational); live link is **the bare domain** (`library.cuatro.dev`),
  never "View Live"; source link `Source`, not "GitHub" or "Code"; self-reference `You are here`;
  family framing `One product family, distinct implementations, deliberately not merged.`;
  switcher trigger `Suite`; switcher header `Part of the Cuatro Ecosystem`; footer
  `Six applications · five languages · one operator` — **update when the count changes, or delete
  it**.
- **UX-DR38** — **Never invent a metric** — if a number was not supplied, the slot does not exist.
  Status words are the taxonomy verbatim with no synonyms anywhere, ever. Punctuation is typeset:
  `—`, `…`, curly quotes; never `"`, `--`, `...`.

**Motion and interaction**

- **UX-DR39** — Only `transform` and `opacity` animate — never width, height, margin or any
  layout property. Name the transitioned properties; `transition: all` is banned. **One**
  orchestrated entrance per page load, then content simply exists — universal scroll-triggered
  fade-up is banned. Stagger by DOM index via a custom property, capped at ~500ms total. Scroll
  work uses `IntersectionObserver`, never a raw `scroll` listener. Banned: bounce, elastic and
  overshoot easings on UI; parallax outside the narrative; infinite loops; `hover:scale-105`;
  cursor followers; animated hover gradients; browser default `ease`/`ease-in-out`. Beyond the
  token block, spatial motion collapses to an opacity crossfade under reduced motion and the 3D
  narrative is **never requested**.

**Accessibility floor — WCAG 2.1 AA, exceeded on text contrast**

- **UX-DR40** — The sixteen behavioural requirements, each binding:
  **A-1** visible `:focus-visible` indicator ≥3:1 on every interactive element, never animated ·
  **A-2** reduced motion honoured without denying access to the Suite Directory ·
  **A-3** Status legible without colour — dot plus border treatment carries the taxonomy, hue
  never alone · **A-4** targets ≥44×44px, independently addressable, measured not assumed ·
  **A-5** no horizontal scroll at 360px and Status never truncates · **A-6** skip-link is the
  first tabbable element · **A-7** one `<h1>` per document, heading levels never skip ·
  **A-8** the Directory is a `<ul>` of entries with the Family group a nested `<ul>` carrying an
  accessible name · **A-9** link text self-describing out of context · **A-10** source links carry
  an accessible name naming the application (`Source — Digital Library`) · **A-11** body text
  ≥14px, nothing below 11px · **A-12** `rem` throughout, never `px` for type · **A-13** `lang` set
  and page title distinguishes the route · **A-14** the 3D canvas is `aria-hidden` and not
  focusable, its content stated in prose · **A-15** switcher trigger carries `aria-expanded`, the
  panel is labelled, `Escape` restores focus · **A-16** nothing autoplays with sound, nothing
  auto-advances.
- **UX-DR41** — Verification is four manual checks — keyboard-only traversal of the homepage and
  one Satellite; 360px viewport with no horizontal scroll; **greyscale render with the Status
  taxonomy still readable**; `prefers-reduced-motion` forced — plus AD-19's automated Playwright
  assertions in CI.

**Layout and responsive**

- **UX-DR42** — Mobile-first, authored at 360px. 360px is the design floor where every
  requirement holds; 390px is the reference width; at **≥760px** Directory rows gain columns
  (name and metadata left, description and links centre, status right) via **the same markup and
  one grid change**; at ≥1280px content is capped by `--measure` and the page does not stretch.
  **The row is the unit at every width — nothing reflows into cards.**
- **UX-DR43** — `html, body { overflow-x: clip }` globally — `clip` not `hidden`, because
  `hidden` breaks sticky positioning. Widths are `100%` with container padding, never `100vw`.
  *(The shipping `app/app.scss` currently sets `width: 100vw` and `overflow-x: hidden` on `body`
  — both change.)* CSS Grid for page structure, Flexbox inside components, `gap` for sibling
  spacing with `margin` reserved for optical correction. Section padding varies deliberately;
  uniform vertical rhythm is a tell.
- **UX-DR44** — Colour and depth rules: accent occupies **≤3% of any viewport** and is never a
  background fill, a large block or a button ground; **no `#000` and no `#fff`** anywhere outside
  the print stylesheet; **no shadows at all** — depth is lightness (+4 step), then a hairline,
  then a strong rule, then type weight; **no gradients** anywhere; alpha is not a colour;
  **opacity never expresses state**; six named z-levels only and an ad-hoc `z-index` is a defect.
- **UX-DR45** — Typography rules: weight gap ≥300 units between any two roles; line-heights
  display `0.95–1.0`, headings `1.1`, body `1.6`, lede `1.55`; tracking display `-0.05em` through
  mono labels `+0.14em`, body never above `+0.05em`; measure `46ch` on descriptions and lede;
  `font-variant-numeric: tabular-nums` on every count, plate mark and metric; prose never below
  `--t-sm` and nothing below `--t-3xs`; uppercase is structural (display, headings, entry names,
  mono labels) and prose is never uppercase; no gradient text, no synthesised bold or italic, no
  italic headings.

**Seams — where token-only federation visibly fails**

- **UX-DR46** — The per-Satellite hand-fix list, in order, ordered by return per line: (1)
  `color-scheme: dark` on `:root` (S-11); (2) `::selection` from the accent (S-12); (3) the
  focus-ring rule copied verbatim from § Interaction Primitives (S-2); (4) `border-radius: 0` on
  form controls (S-3); (5) map the framework's control defaults onto the token roles (S-9, where
  applicable). **A Satellite that does only steps 1–4 already reads as family.**
- **UX-DR47** — S-8: `phx-update="ignore"` on animated containers in `cs-tracker` if LiveView DOM
  patching visibly interrupts a transition. S-10: `font-display: swap` plus `size-adjust`
  overrides in `fonts.css`, which is why they belong in the contract.
- **UX-DR48** — Seams **accepted and documented rather than fixed**, because a documented seam
  reads as judgement while a discovered one reads as an oversight: S-1 (Three.js narrative
  colours are JS values, a declared FR-17 exception), S-4 (form invalid/error states), S-5
  (overlays — do not build a cross-framework overlay convention), S-6 (dense data UI — this is
  the ceiling), S-7 (dark-only against existing light themes — mitigated by sequencing, a
  Satellite adopts fully or not at all).

**Asset budget** (SM-C5 is a counter-metric, so it needs a number)

- **UX-DR49** — Non-3D path total **≤140 KB gzipped** — HTML + critical CSS ≤20 KB, three
  subsetted variable faces ≤120 KB. That is the number that binds, because it is what Daniela
  gets on a slow connection. Everything narrative is deferred, lazy and non-blocking; the
  narrative bundle is **never preloaded and never `fetchpriority="high"`**; no `loading="lazy"`
  on an LCP element. **Suite Directory interactive is the metric**, not page-load-complete.
- **UX-DR50** — Anti-pattern conformance floor (`nutlope/hallmark`, treated as a floor not a
  suggestion). Structurally excluded: three-column icon-tile feature grid; card-in-card;
  full-viewport centred hero; shadow-glow on dark; the five-links-plus-CTA nav; the four-column
  footer; aurora blobs, floating orbs, glassmorphism; an eyebrow on every section;
  Inter-everywhere; invented metrics; emoji as icons. Purple is not the problem — purple *used as
  a fill* is.

---

## Forced Changes Applied

The Architecture Spine forces four PRD changes and narrows one recorded defect. Stories are cut
against the **corrected** requirements above, never the originals.

| # | Change | Where applied |
|---|---|---|
| **C-1** | The FR-9 defect is narrower than recorded. `content/projects.ts:23` already lists `SQLite` correctly; the only stale value is `Hetzner VPS` at line 30. The broader "runs on SQLite, not Postgres" claim does **not** carry forward | FR-9 above |
| **C-2** | `digital-library` is SQLite + Redis, so `pg_dump` + restic covers **none** of its data. A live application has no backup path in any input document. AD-10 requires the exemption to carry its own offsite path — and the data is live **now**, so this is not Epic 4 work | Story in Epic 1 |
| **C-3** | FR-5's third consequence bullet reworded — Registry membership is by application, not repository (AD-6) | FR-5 above |
| **C-4** | `demo` is required with an explicit value including `none`, not optional. Same for `identity` (AD-5) | FR-6 above |
| **C-5** | Two new required fields: `identity` (AD-12) and `token_contract` (AD-16) | FR-6 above |
| **C-6** | `content/projects.ts` is retired, not promoted. `contracts/registry.json` is hand-authored JSON validated by `contracts/registry.schema.json` in CI (AD-4) | FR-12 above |
| **C-7** | Playwright is **not** installed. AD-19's accessibility floor *adds* it — real setup cost, paid in Epic 1 because Epic 1's own migration stories assert rendered output | Story in Epic 1 |
| **C-8** | The box compiles today. A standing AD-8 violation until Epic 3, tracked explicitly rather than silently tolerated | Tracked item, Epic 1 |
| **C-9** | The deployed routing table exists nowhere in source. Enumerating it on the box is a **prerequisite of Epic 4, not a task inside it** — placed in Epic 1 | Story in Epic 1 |

---

### FR Coverage Map

Every FR is placed. Thirty-one are covered by an epic, four are recorded deferrals (three of
which the spine already names), and none is unaccounted for.

| FR | Epic | Note |
|---|---|---|
| FR-1 | 2 | Narrative resolves into the Suite Directory |
| FR-2 | 2 | `/projects` → `/#suite` 301 + above-fold skip control |
| FR-3 | 2 | 360px legibility; asserted by Playwright (AD-19) |
| FR-4 | 2 | Premise block, ≤3 sentences |
| FR-5 | 2 | Exhaustive Registry, corrected per AD-6 |
| FR-6 | 2 | Entry contract + JSON Schema, corrected per AD-5 / AD-12 / AD-16 |
| FR-7 | 2 | Status taxonomy; three structural axes asserted (AD-19) |
| FR-8 | 2 | Editorial voice pass; O-1 confirms accuracy |
| FR-9 | 2 | `Hetzner VPS` correction only (C-1) |
| FR-10 | 2 | `source` on every entry, including `Archived` |
| FR-11 | 2 | Tracker Family grouping, framing line names no count |
| FR-12 | 2 | `contracts/registry.json` published (C-6) |
| FR-13 | **deferred** | Spine § Deferred — v2. Data contract ships in Epic 2 |
| FR-14 | **deferred** | Spine § Deferred — v2 |
| FR-15 | **deferred** | Spine § Deferred — v2 |
| FR-16 | 1 | Token contract published |
| FR-17 | 1 | Anchor consumes its own tokens (migration steps 1–2) |
| FR-18 | 1 | **Epic 1's acceptance condition** — Anchor + `cs-tracker` |
| FR-19 | 1 / 2 / 6 | Policy + versioned header (1) · `token_contract` + drift check (2) · machinery (6) |
| FR-20 | 5 | |
| FR-21 | 5 | Hub + `cs-tracker` — the acceptance pair |
| FR-22 | 5 | Including the `live_socket_id` broadcast |
| FR-23 | 5 | OIDC is the reversibility seam |
| FR-24 | 2 / 5 | `identity` field declared (2) · verified against implementation (5) |
| FR-25 | 5 | Capacity-gated |
| FR-26 | 5 | `demo:reset`, scheduled on the host |
| FR-27 | 2 / 5 | `demo` field declared (2) · declaration accurate (5) |
| FR-28 | 2 | Honest degradation; the mechanism is the Registry plus the verification job |
| FR-29 | **deferred** | See § Deferred and Uncovered below |
| FR-30 | 2 | `absorbed_into` entry for `connect-four-react` |
| FR-31 | 1 | AD-17a — blocking predecessor of all automation |
| FR-32 | 2 | AD-18 scheduled job, external to the box |
| FR-33 | 1 | AD-9 / AD-17c — the gate defaults to blocked |
| FR-34 | 2 | Umami custom events for SM-1 … SM-3 |
| FR-35 | 2 | Declarative Status filter |

### Deferred and Uncovered

- **FR-13, FR-14, FR-15 — the Suite Switcher.** A recorded deferral: spine § Deferred names it
  as v2, and Epic 2 ships everything it depends on (AD-4's published `registry.json`, fetched at
  build time), so nothing blocks it later.
- **FR-29 — embedded playable Connect Four.** PRD §9.2 defers it as "delightful, not
  load-bearing", but unlike the Switcher it was never picked up by the spine's § Deferred list or
  by the Capability → Architecture Map. **Recorded here as an explicit deferral** so it does not
  read as an oversight. FR-30's *record* half still ships in Epic 2 as a Registry entry with
  `absorbed_into: cuatro-portfolio`; only the *playable* half defers.
- **FR-19's distribution machinery** — Epic 6, earned by three real hand-copied token changes,
  not scheduled.
- Everything in the spine's own § Deferred list: a shared React package for the Next.js cluster,
  point-in-time database recovery, a light theme, cross-framework conventions for seams S-4/S-5/
  S-6, authorization, the greenfield PostgreSQL major, whether the four `In progress`
  applications are ever built, and hostnames for `cs-tournament` and `list-wheel`.

## Epic List

The seven epics are **fixed by the spine's Capability → Architecture Map** and are not re-cut
here. Epics 3, 4 and 7 are frankly technical rather than user-value-shaped; that is deliberate
and correct. PRD §12.5 argues explicitly that engineering order and product order diverge after
research Step 2, which is why Epic 2 — the entire hiring-audience payoff — is inserted *ahead* of
the Anchor merge rather than after it.

**Specification depth:** Epics 1–3 are fully specified with executable stories and complete
acceptance criteria. Epics 4–7 carry story titles, goals and dependencies but not full AC —
AD-22 forces a bounded refresh check before Epic 4's first story opens, and writing acceptance
criteria now against decisions that must be re-verified would be inventing detail that expires.

### Epic 1: Foundation — error signal, measured capacity, and the first visible ecosystem moment

After Epic 1 the Operator learns of breakage from a machine rather than from a Visitor, knows
*in writing* what the box can hold, and a Visitor moving between `cuatro.dev` and
`cs-tracker.cuatro.dev` sees two applications on different frameworks that visibly belong to one
product family. The Estate drops from 15 repositories to 11.

**FRs covered:** FR-16, FR-17, FR-18, FR-31, FR-33, FR-19 *(policy and versioned header only)*
**Also carries:** §5 archiving to the 11 waypoint · C-2 `digital-library` backup gap ·
C-9 routing enumeration *(prerequisite of Epic 4, done here because it is cheap and de-risks the
rebuild)* · C-8 standing AD-8 violation, tracked explicitly · O-3 daisyUI `var()` gate ·
C-7 Playwright installation *(here rather than in Epic 2, because this epic's migration stories
assert rendered output and AD-19 forbids claiming it)*
**Blocking open item added at re-baseline:** **O-10 — the palette reconciliation.** The token
contract was authored without knowledge of the cybercore rebrand now merged into `dev`. Two
design systems must become one before Story 1.18 can alias `--accent`/`--accent-dim`. **This is
a design decision and does not belong inside a dev story** — settle it in a UX pass before the
loop reaches 1.18. See
[`rebaseline-2026-08-15.md`](ux-designs/ux-cuatro-portfolio-2026-08-15/rebaseline-2026-08-15.md).
Also **O-11** — `--accent-glow` is declared with zero call sites; confirm before deleting.
**Governing ADs:** AD-1, AD-9, AD-10, AD-14, AD-15, AD-16, AD-17, AD-18, AD-19, AD-20
**Standalone:** yes. Delivers SM-5 (external uptime), SM-6 (≥2 applications on shared tokens),
SM-7 (Estate 11) and a written Capacity Gate threshold, none of which depend on a later epic.

### Epic 2: The suite becomes visible — Registry as product and the reshaped front door

Daniela lands on `cuatro.dev`, scrolls into a directory of six running applications, and opens
one. Marcus skips the narrative, reads an accurate `tech` array, and reaches any repository in
one hop. The Registry cannot lie about either of them, and the Operator can see how Visitors move
through the Hub.

**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12,
FR-35, FR-24 *(declaration)*, FR-27 *(declaration)*, FR-28, FR-30 *(record)*, FR-32, FR-34
**Also carries:** the AD-19 hit-target and Status-mark assertions, on the harness Epic 1 installed
(C-7) · `list-wheel` relocation onto a `cuatro.dev` subdomain (§5.3) · open items O-1, O-2, O-4,
O-5, O-8, O-9 · three of the four pre-existing repository defects
**Governing ADs:** AD-1, AD-3, AD-4, AD-5, AD-6, AD-7, AD-9, AD-18, AD-19, AD-21
**Blocked by:** AD-17a (monitoring) from Epic 1, which gates the automation Story 2.8 adds; and
AD-17b (bot mitigation), which binds at Story 2.9 — the Suite Directory is a crawler amplifier by
construction and ships only after the bot filter. `list-wheel` placement is additionally blocked
by AD-17c's written threshold.

### Epic 3: One repository, one deploy unit each — the Anchor merge and build in CI

Operator-facing and invisible to every Visitor in PRD §2.3, which is exactly why it sits after
Epic 2. The Estate drops from 11 to 8, and the serving two-core box stops compiling.

**FRs covered:** none directly. Supports NFR-2 and NFR-3, and closes the standing AD-8 violation
opened as a tracked item in Epic 1.
**Governing ADs:** AD-2, AD-3, AD-7, AD-8, AD-20, AD-21, AD-23
**Fixed order (AD-20):** the Hub moves to `apps/hub` as its own shipped step with nothing else
changing, then `cuatro-finance`, then `cuatro-tracker`, then `cs-tournament` — one shipped and
verified step each.
**Expects from Epic 2:** the Playwright job and the Registry schema gate already exist in
`ci.yml`; the Hub-move story rewrites that file and must carry them across rather than
rediscover them.

### Epic 4: Greenfield VPS rebuild

Traefik, one Postgres, `docker-rollout`. Four live subdomains serve throughout.

**FRs covered:** none directly. NFR-2, NFR-3; AD-10's backup topology and AD-23's migration
discipline become real here.
**Governing ADs:** AD-7, AD-8, AD-10, AD-20, AD-22, AD-23
**Blocked by:** Epic 1's C-9 enumeration — the rebuild must preserve four subdomains it cannot
enumerate from source. Also by Epic 3, since a greenfield host that pulls images requires images
to exist. AD-22's refresh check runs before this epic's first story if that story opens after
2026-11-15.

### Epic 5: One login, and a Visitor who can use the real thing

Cuatro signs in once across his own tools. One identity demonstrably crosses the
JavaScript/Elixir boundary. A Visitor uses real software without registering anything.

**FRs covered:** FR-20, FR-21, FR-22, FR-23, FR-24 *(behaviour)*, FR-25, FR-26, FR-27 *(accuracy)*
**Governing ADs:** AD-11, AD-12, AD-13, AD-18, AD-22, AD-23
**Blocked by:** Epic 4 — research sequences identity behind the host rebuild. Demo Access is
additionally capacity-gated under AD-9.

### Epic 6: Token distribution machinery — deferred, earned

npm package, Renovate shareable preset, published reusable workflows. The published *shape* is
already fixed by AD-14 and AD-16, so nothing blocks later.

**FRs covered:** FR-19 *(machinery half)*
**Governing ADs:** AD-14, AD-16, AD-22
**Trigger:** three hand-copied token changes actually performed. Not scheduled.

### Epic 7: WSL2 relocation

Developer machine only. No ecosystem invariant depends on it, and it is independent of every
other epic.

**FRs covered:** none. Operator ergonomics.
**Governing ADs:** none — the spine records no invariant here.

---

## Story Conventions

Two additions to the base story template, both required by the epics prompt:

- **Governing ADs** — named on every story. The spine's ADs are the invariants; a story that
  satisfies its acceptance criteria but violates an AD is a defect the loop should catch.
- **Depends on** — named explicitly, especially across the three AD-17 gates and the Capacity
  Gate. "None" means the story can open the moment its epic does.

**Operator-action stories commit their evidence.** Several Epic 1 stories are actions taken in a
web console or on the box rather than code changes — archiving repositories, buying a monitor,
adding Cloudflare rules, reading `docker stats`. A story whose entire acceptance is "you did a
thing in a dashboard" cannot be verified by a review session, so each one commits a record under
`ops/`, extending the pattern AD-9 already establishes with `ops/capacity-gate.yml`. The record
is the artifact; the acceptance criteria are written against it.

---

## Epic 1: Foundation — error signal, measured capacity, and the first visible ecosystem moment

After Epic 1 the Operator learns of breakage from a machine rather than from a Visitor, knows in
writing what the box can hold, and a Visitor moving between `cuatro.dev` and
`cs-tracker.cuatro.dev` sees two applications on different frameworks that visibly belong to one
product family. The Estate drops from 15 repositories to 11.

Twenty stories in four ordered groups — AD-17 gates and estate (1.1–1.6), discovery and defect
prerequisites (1.7–1.10), the token contract (1.11–1.16), adoption (1.17–1.20). No story depends
on a later one.

### Story 1.1: Archive the four retired repositories

As the Operator,
I want `Lumen`, `apple-music-workspace`, `tcg-tracker` and `connect-four-react` archived and the
Estate waypoint recorded,
So that the repository count reflects a deliberate decision rather than accumulated history, and
Epic 2 has a written disposition to author Registry entries from.

**Governing ADs:** AD-6 · **Depends on:** none.
Three are empty shells; `connect-four-react` is a finished toy whose PRD §5 disposition is
**Absorb**. Archiving it here is what produces the 11 waypoint. FR-29's *playable* half stays
deferred, so until it is taken up the code has not moved and its `source` resolves to the archived
repository — exactly as `tcg-tracker`'s does.

**Acceptance Criteria:**

**Given** fifteen repositories under Ecosystem governance
**When** the four retired repositories are archived on GitHub
**Then** `Lumen`, `apple-music-workspace`, `tcg-tracker` and `connect-four-react` are each in
GitHub's archived (read-only) state
**And** all four remain publicly readable, because AD-6 requires them to keep Registry entries
with a resolving `source` link
**And** no repository outside those four changes state.

**Given** AD-6 makes Registry membership a property of the application, not the repository
**When** `ops/estate.md` is written
**Then** it records all fifteen applications with their disposition, current Status and — where
one applies — their `absorbed_into` target
**And** `tcg-tracker` is recorded as `absorbed_into: cuatro-tracker` and `connect-four-react` as
`absorbed_into: cuatro-portfolio`, the latter noting that its code has not moved because FR-29 is
deferred, so Epic 2 authors its `source` against the archived repository
**And** the file states the repository count (11) and the application count separately, with a
line saying the two are deliberately different and neither validates the other.

**Given** SM-7 targets 12 repositories at MVP and PRD §5 records 11 after absorption
**When** the story closes
**Then** `ops/estate.md` records the count as 11 with an ISO 8601 UTC date
**And** the record states that 11 satisfies the MVP target rather than missing it, so a later
reader does not read the gap as an error.

---

### Story 1.2: External uptime and certificate-age monitoring

As the Operator,
I want an external service probing every live application and alerting on certificate *age*,
So that I learn about breakage from a machine within hours rather than from a Visitor who never
tells me — and so that automation may be enabled anywhere in the Ecosystem at all.

**Governing ADs:** AD-17a, AD-18 · **Realizes:** FR-31 · **Depends on:** none.
**This story is a blocking predecessor of every other story in the breakdown that enables
automation.** AD-17a is explicit that this is never a parallel task.

**Acceptance Criteria:**

**Given** four live subdomains — `cuatro.dev`, `cs-tracker.cuatro.dev`, `tracker.cuatro.dev`,
`library.cuatro.dev`
**When** monitoring is configured
**Then** each is probed for reachability from outside the VPS
**And** a probe failure notifies the Operator through a channel he actually reads
**And** the monitoring service runs external to the VPS, so a whole-box failure still produces a
notification.

**Given** Let's Encrypt lifetimes drop from 90 days to 64 in February 2027 and to 45 in February
2028
**When** certificate monitoring is configured
**Then** the alert fires on certificate **age**, not on days-to-expiry
**And** the threshold is expressed so that a shortening lifetime narrows the alert window
automatically rather than silently consuming the safety margin
**And** the chosen threshold and its reasoning are recorded.

**Given** NFR-4 caps all-in spend at $40–100/month with only marginal spend counting
**When** the service is chosen
**Then** its recurring cost is recorded in `ops/monitoring.md` as a named decision against that
ceiling.

**Given** AD-17a gates all automation on this story
**When** `ops/monitoring.md` is written
**Then** it records the service, what is probed, the alert channel, the certificate-age
threshold, the cost, and an ISO 8601 UTC date
**And** it states plainly that AD-17a is now satisfied, so later stories can cite it rather than
re-derive it.

---

### Story 1.3: Bot mitigation on the four live subdomains

As the Operator,
I want bot rules live on every live subdomain before anything crawler-attractive ships,
So that the Suite Directory — a crawler amplifier by construction, and now the homepage climax —
cannot spend scarce CPU on a box whose ceiling is unproven.

**Governing ADs:** AD-17b · **Depends on:** none.
**This story is a blocking predecessor of Epic 2.** NFR-7 and PRD §12.4 both make it a hard
prerequisite rather than a sequencing preference.

**Acceptance Criteria:**

**Given** all four live subdomains sit behind Cloudflare
**When** bot mitigation is configured
**Then** rules are active on `cuatro.dev`, `cs-tracker.cuatro.dev`, `tracker.cuatro.dev` and
`library.cuatro.dev` — every live subdomain, not only the Hub
**And** each of the four still serves a normal request from a normal browser after the rules are
live, verified by hand.

**Given** the one citable capacity measurement in the record (639,880 KB RSS / 103.3% CPU) was
captured **during a bot crawl**
**When** the rules take effect
**Then** the date and time they took effect are recorded, so Story 1.5's measurement week can be
attributed to a post-mitigation box rather than confounded with a pre-mitigation one.

**Given** NFR-8 forbids third-party tracking anywhere in the Ecosystem
**When** the mitigation is configured
**Then** it introduces no third-party analytics, tag manager, session recorder or tracking
script into any application.

**Given** AD-17b gates Epic 2 on this story
**When** `ops/bot-mitigation.md` is written
**Then** it records the rules applied per subdomain, the effective date in ISO 8601 UTC, the
verification that each subdomain still serves, and a plain statement that AD-17b is satisfied.

---

### Story 1.4: The Capacity Gate exists and fails closed

As the Operator,
I want a machine-readable Capacity Gate that refuses new placement until a threshold is measured,
So that no application is ever placed on unmeasured capacity by a judgement call made at the
moment judgement is least reliable.

**Governing ADs:** AD-9, AD-21 · **Depends on:** none

**Acceptance Criteria:**

**Given** AD-9 fixes the gate's shape
**When** `ops/capacity-gate.yml` is created
**Then** it carries exactly the keys `measured_at`, `baseline`, `threshold`, `reading`, `status`,
`overflow` and `placements`
**And** `status` is `blocked`, because unproven capacity fails closed
**And** `threshold` is empty or null — a guessed number written here would be a guess dressed as
a requirement (PRD §15, FR-33's assumption)
**And** `overflow` names the decided path: managed hosting for two heavy applications at
$15–30/month, inside the NFR-4 ceiling.

**Given** the gate must bind mechanically rather than by prose
**When** the enforcement check is added
**Then** a check exists that fails when a deploy names an id absent from `placements` while
`status` is `blocked`
**And** the check passes for any id already present in `placements`, because AD-9 requires
existing ids to always deploy so NFR-2 is never traded against the gate
**And** per AD-21 the check is blocking and is not downgraded to a warning.

**Given** the four applications running today
**When** `placements` is populated
**Then** it lists the ids currently on the box, so the first genuinely new placement is
distinguishable from the incumbents.

**Given** a reviewer needs to confirm the gate is real and not decorative
**When** the check is run against a fabricated new id
**Then** it fails, and the failure names the gate file and the `blocked` status.

---

### Story 1.5: Capacity measurement week

As the Operator,
I want one week of real per-container footprint readings from the box,
So that the Capacity Gate's threshold replaces the number the research could not obtain, rather
than inheriting a figure captured during a bot crawl.

**Governing ADs:** AD-9, AD-17c · **Depends on:** Story 1.3 (so the week measures a
post-mitigation box), Story 1.4 (the file the readings land in)

**Acceptance Criteria:**

**Given** the box runs four applications plus Caddy, Umami and Postgres
**When** measurement runs for a full seven days
**Then** per-container CPU and memory readings are captured at a regular interval across the
whole period
**And** the 15-minute load average is captured alongside them, because that is what AD-9's gate
actually measures
**And** both an idle and a loaded footprint are distinguishable in the record.

**Given** AD-9 names per-container `cpu.pressure` (cgroup v2, Ubuntu 24.04) as the diagnostic
that attributes pressure to one application rather than to the box
**When** the readings are captured
**Then** `cpu.pressure` is captured per container as well as the aggregate load average
**And** the record makes clear which application dominates under load.

**Given** the one citable prior figure was an upper bound on a bad day
**When** the week's data is summarised into `ops/capacity-gate.yml`
**Then** `baseline` records the measured steady-state and `reading` records the observed peak
**And** `measured_at` carries the ISO 8601 UTC date the week closed
**And** `status` remains `blocked` — this story measures, it does not open the gate.

---

### Story 1.6: Write the Capacity Gate threshold and open the gate

As the Operator,
I want a written, binding threshold in the gate file,
So that placing a new application becomes a mechanical check against measured evidence, and
AD-17c stops blocking the work that depends on it.

**Governing ADs:** AD-9, AD-17c, AD-21 · **Depends on:** Story 1.5.
**This story is a blocking predecessor of every new placement** — `list-wheel` in Epic 2, and
every id placed in Epic 4.

**Acceptance Criteria:**

**Given** a full week of measured readings exists
**When** the threshold is written
**Then** `threshold` in `ops/capacity-gate.yml` carries a specific 15-minute load-average figure
derived from the measurement, not from the research's provisional ~1.4
**And** the derivation is recorded — what the baseline was, what headroom was reserved, and why
**And** `status` moves to `open` only if the measured baseline sits below the written threshold.

**Given** the measurement might show the box is already at or over its ceiling
**When** the baseline exceeds the threshold
**Then** `status` stays `blocked`, the named overflow path is invoked, and the story still closes
successfully — a blocked gate is a valid outcome, not a failed story
**And** the record says so explicitly, so a later reader does not mistake a blocked gate for
unfinished work.

**Given** SM-C4 says VPS load average wins every conflict with any other metric
**When** the threshold is chosen
**Then** the reserved headroom accounts for the near-term additions the estate already intends —
`list-wheel` (static, near-zero) and `cs-tournament` arriving from external hosting — rather than
for today's four applications alone.

**Given** AD-17c gates new placement on this story
**When** the gate file is committed
**Then** the enforcement check from Story 1.4 passes for a new id if and only if `status` is
`open`.

---

### Story 1.7: Enumerate the deployed routing table on the box

As the Operator,
I want the real routing table that serves four live subdomains written down and committed,
So that Epic 4's greenfield rebuild can preserve routes it currently cannot enumerate from
source.

**Governing ADs:** AD-3, AD-7, AD-20 · **Depends on:** none.
**This story is a blocking predecessor of Epic 4.** C-9 makes it a prerequisite of that epic, not
a task inside it.

**Acceptance Criteria:**

**Given** `docker/Caddyfile` routes only `cuatro.dev` and `analytics.cuatro.dev`, while
`cs-tracker.cuatro.dev`, `tracker.cuatro.dev` and `library.cuatro.dev` all resolve
**When** the box is inspected
**Then** `ops/routing-inventory.md` records, for every hostname that resolves to the box: the
hostname, what terminates TLS for it, what serves it, the container or process behind it, and the
port
**And** the record covers at minimum `cuatro.dev`, `analytics.cuatro.dev`,
`cs-tracker.cuatro.dev`, `tracker.cuatro.dev` and `library.cuatro.dev`
**And** any hostname found on the box that nobody expected is recorded rather than dropped.

**Given** the committed compose file binds Caddy to `:80` and `:443` yet its Caddyfile does not
mention three of the live hosts
**When** the discrepancy is investigated
**Then** the record states how those three actually reach the box — a second Caddy instance, a
separate compose project, an uncommitted Caddyfile, a Cloudflare tunnel, or whatever is true
**And** it states which of those configurations exist **only on the box** and not in any
repository, because that is the set Epic 4 must recreate from this document.

**Given** AD-3 makes the public hostname a declared value rather than a derived one
**When** the inventory is written
**Then** each hostname is recorded against the application id it serves, giving Epic 2 the
`live` values to author into the Registry and Epic 4 the router definitions to recreate.

**Given** NFR-2 requires all four subdomains to serve through every step
**When** the inspection is performed
**Then** it is read-only — nothing on the box is changed by this story.

---

### Story 1.8: An offsite backup path for `digital-library`

As the Operator,
I want `digital-library`'s SQLite and Redis data backed up offsite,
So that a live application stops being the one thing in the estate whose data no backup design
covers.

**Governing ADs:** AD-10 · **Depends on:** none.
**Not Epic 4 work** — the data is live now, and the `pg_dump` + restic design covers none of it.

**Acceptance Criteria:**

**Given** `digital-library` runs on SQLite + Redis and is AD-10's declared non-Postgres exception
**When** the backup path is built
**Then** the SQLite database is captured with a method that is consistent under concurrent writes
— an online backup or a checkpointed copy, never a naive file copy of a live database
**And** any Redis state that is not reconstructible from SQLite is captured too, or the record
states explicitly that Redis is a pure cache and needs no backup.

**Given** AD-10 says a declared non-Postgres store without an equivalent offsite path is unbacked
data, which is a defect
**When** the backup runs
**Then** it lands offsite, outside the VPS, on the same schedule discipline as the `pg_dump` plus
restic path the rest of the estate will use
**And** the backup is verified by a real restore into a scratch location, not by the backup job
exiting zero.

**Given** the exemption must be visible rather than implicit
**When** the story closes
**Then** the store and its offsite path are recorded so Epic 2 can carry the store into the
`digital-library` Registry entry's `tech` array, and Epic 4 can carry the backup into the
rebuilt box.

**Given** NFR-4 caps marginal spend
**When** offsite storage is chosen
**Then** its recurring cost is recorded as a named decision against the ceiling.

---

### Story 1.9: Record the build-on-the-box violation as a tracked item

As the Operator,
I want the fact that the serving box compiles recorded as a known, dated, owned violation,
So that the estate's top unmeasured risk is tolerated deliberately until Epic 3 retires it,
rather than silently.

**Governing ADs:** AD-8 · **Depends on:** none

**Acceptance Criteria:**

**Given** `.github/workflows/deploy.yml` runs `docker compose --env-file .env.production up
--build -d` over SSH, with its step still named "Deploy to Hetzner"
**When** the violation is recorded
**Then** `ops/known-violations.md` names it, cites the workflow file and the offending line,
names AD-8 as the rule it breaches, and names Epic 3 as what retires it
**And** it records why it is tolerated rather than fixed now: fixing it early means building the
CI-to-GHCR path twice, once against today's single-app layout and once after the Epic 3 merge.

**Given** research names compiling on a serving two-core box as the top unmeasured risk
**When** Story 1.5's measurement week runs
**Then** the record states that a deploy during the measurement week will distort the readings,
and names the mitigation — either avoid deploying during the week, or annotate the readings where
a deploy occurred.

**Given** the step name is factually wrong — the box is Hostinger, not Hetzner
**When** the record is written
**Then** the misnaming is recorded alongside the stale `Hetzner VPS` value in
`content/projects.ts:30`, so Epic 2's FR-9 correction and Epic 3's workflow rewrite each pick up
their half.

---

### Story 1.10: Install Playwright and establish the rendered-output harness

As the Operator,
I want a browser harness that reads computed styles and compares renders before anything in this
epic claims a visual property,
So that "the site is visually identical" and "this call site renders bold" are assertions a machine
makes rather than claims a document makes.

**Governing ADs:** AD-19, AD-21 · **Depends on:** Story 1.2 (AD-17a — this story adds a CI job,
which is automation).
Applies forced change **C-7**: `@playwright/test` is **not** in `package.json`, only a transitive
entry in `pnpm-lock.yaml`, so this is real setup cost paid once here. **Pulled into Epic 1
deliberately** — Stories 1.12, 1.17, 1.18 and 1.19 each assert a rendered-output property, and
AD-19's rule that a floor is asserted rather than claimed binds this epic exactly as it binds
Epic 2. The 44×44 hit-target floor stays in Story 2.8, which needs a Suite Directory to measure.

**Acceptance Criteria:**

**Given** the Anchor has Vitest but no Playwright
**When** Playwright is installed
**Then** `@playwright/test` is a direct devDependency at the pinned stack version
**And** a browser is provisioned in CI, and the CI run-time cost of doing so is recorded, because
C-7 makes this a real cost rather than a free addition.

**Given** Stories 1.17 and 1.20 turn on whether a render changed
**When** the harness is built
**Then** it can capture a screenshot of a given route at a given viewport and compare it against a
committed baseline, failing on a difference beyond a stated tolerance
**And** the tolerance is written down with its reasoning, so "visually identical" has a definition
rather than an opinion.

**Given** Story 1.18's alias trap turns on a computed value, not on a screenshot
**When** the harness is built
**Then** it can read the computed value of a named CSS property on a named selector — the check
the four `--monument-bold` call sites need to prove `font-weight` survived the alias
**And** it can read the computed value of a custom property on `:root`, which is how Story 1.17
proves the contract is present and consumed by nothing.

**Given** a gate that has never been observed to fail is not known to work
**When** the harness is verified
**Then** each capability is demonstrated failing — a baseline comparison against a deliberately
shifted render, and a computed-style read against a deliberately wrong weight — and both probes
are removed in the same story.

**Given** AD-21 makes every CI gate blocking because no staging environment exists
**When** the job is wired into `.github/workflows/ci.yml`
**Then** it fails the build rather than warning
**And** it runs on every push and every pull request to `main`, matching the existing CI triggers
**And** the existing Lighthouse accessibility assertion is untouched and unweakened.

---

### Story 1.11: Publish `contracts/tokens.css` from `packages/tokens`

As a consumer in any of the six frameworks in the Estate,
I want the design tokens published as a plain CSS custom-property file,
So that I can adopt the Ecosystem's visual identity with a file read and no dependency on the
Anchor's toolchain.

**Governing ADs:** AD-1, AD-14, AD-16, AD-21 · **Depends on:** Story 1.2 (AD-17a — this story
enables a CI build step, which is automation)

**Acceptance Criteria:**

**Given** the Anchor has no `packages:` key in `pnpm-workspace.yaml` and no Turborepo today
**When** `packages/tokens` is created
**Then** `pnpm-workspace.yaml` gains a `packages:` entry covering it
**And** the package builds with Style Dictionary at **≥5.5.1** — the security floor that patched
prototype pollution in `convertTokenData` — using DTCG format 2025.10
**And** per AD-1 the generator lives in `packages/` and is never published.

**Given** `DESIGN.md` § `tokens.css` fixes the exact property set
**When** `contracts/tokens.css` is generated
**Then** it contains the eleven `--c-*` palette values in OKLCH on anchor hue 288, the eleven
`--token-*` semantic roles, three families, the ten-step type scale, five weights, five
line-heights, six tracking values, `--measure`, nine spacing steps, three shape values, five
stroke values, three elevation values, seven motion values and seven z-index values
**And** it carries the header `Contract v1.0.0`
**And** it contains **no `@font-face` rule** — those live in `fonts.css`, because a `url()` in
`tokens.css` breaks the moment a Satellite vendors it to a different depth
**And** it carries the `@media (prefers-reduced-motion: reduce)` block collapsing the four
duration tokens to `1ms`.

**Given** AD-14 forbids `--token-*` and Tailwind's `--color-*` sharing a name across a `var()`
**When** the semantic roles are emitted
**Then** every `--token-*` role resolves to a `--c-*` palette value and no role is
self-referential.

**Given** AD-16 makes versioning a contract obligation
**When** the file header is written
**Then** it states that a value change is a minor bump and any rename — including fixing a typo
in a token name — is major.

---

### Story 1.12: Publish `contracts/fonts.css` with latin-subset faces

As a Satellite vendoring the contract folder,
I want `@font-face` rules whose paths resolve wherever the folder lands,
So that adopting the type system is a copy operation rather than a silent fallback to
`system-ui`.

**Governing ADs:** AD-1, AD-14 · **Depends on:** Stories 1.10 (the harness that verifies the swap),
1.11

**Acceptance Criteria:**

**Given** three open-licence variable families — Bricolage Grotesque, Geist and Geist Mono
**When** the faces are prepared
**Then** each is subset to **latin only** and the three together total **≤120 KB gzipped**
**And** the woff2 binaries sit in `contracts/fonts/`
**And** the measured total is recorded, because UX-DR7's number is a budget that binds.

**Given** a Satellite may vendor the folder to `assets/css/`, `src/styles/` or `src/`
**When** `contracts/fonts.css` is written
**Then** every `url()` is relative to `fonts.css` itself, never to a document root
**And** the folder can be moved to an arbitrary depth and the faces still resolve, verified by
actually moving it in a scratch location and loading a page.

**Given** a font swap must not shift layout
**When** each `@font-face` is declared
**Then** it carries `font-display: swap` together with `size-adjust`, `ascent-override` and
`descent-override` tuned against the fallback named in `--f-display`, `--f-body` or `--f-mono`
**And** the absence of a layout shift on swap is verified through Story 1.10's harness — a
baseline comparison across the swap — rather than assumed from the presence of the overrides.

**Given** AD-1 bars executable code from `contracts/`
**When** the fonts are published
**Then** nothing under `contracts/` is a `.ts`, `.js`, `.tsx`, `.jsx`, `.mjs` or `.cjs` file.

---

### Story 1.13: Publish `contracts/tailwind.css`, the generated `@theme inline` adapter

As a Tailwind consumer — `cuatro-finance`, `cuatro-tracker`, `cs-tournament` and `cs-tracker`,
I want an adapter that mints real utility classes from the token roles,
So that importing the contract produces `bg-accent` rather than eleven custom properties that
generate nothing.

**Governing ADs:** AD-14 · **Depends on:** Stories 1.11, 1.12

**Acceptance Criteria:**

**Given** a plain `:root` file defining custom properties generates **zero** utility classes in
Tailwind v4
**When** `contracts/tailwind.css` is generated
**Then** its import order is exactly `tailwindcss`, then `./tokens.css`, then `./fonts.css`, then
the `@theme` block
**And** it **imports `fonts.css`** — an adapter pulling in only `tokens.css` gives the cluster
three named families with no `@font-face` for any of them, and the page looks almost right
**And** the `@theme` block carries the `inline` keyword, which is mandatory rather than
stylistic.

**Given** AD-14 requires the two namespaces to differ
**When** the theme mappings are emitted
**Then** every line maps Tailwind's `--color-*` from this system's `--token-*`, and no mapping
has the same name on both sides of the `var()`
**And** a mapping like `--color-bg: var(--color-bg)` cannot appear, because it is a cycle that
resolves to `transparent` the moment a bundler flattens the imports.

**Given** the adapter is generated output, not authored
**When** the token source changes
**Then** rebuilding `packages/tokens` regenerates `tailwind.css` with no hand editing.

**Given** the adapter must actually mint utilities
**When** it is verified
**Then** a scratch Tailwind v4 build importing it produces working utility classes for at least
the colour, font and spacing mappings, checked in rendered output rather than read off the
source.

---

### Story 1.14: CI enforces the contract boundary

As the Operator,
I want CI to fail if executable code appears under `contracts/`,
So that the one dependency no framework boundary in this estate can carry cannot be introduced by
accident.

**Governing ADs:** AD-1, AD-21 · **Depends on:** Stories 1.2 (AD-17a), 1.11

**Acceptance Criteria:**

**Given** AD-1 defines a contract as an artifact any estate language uses without executing
Anchor-authored code
**When** the CI job runs
**Then** it fails if any file under `contracts/` matches `\.(ts|js|tsx|jsx|mjs|cjs)$`
**And** the failure message names AD-1 and the offending path.

**Given** AD-21 makes every CI gate blocking because no staging environment exists
**When** the job is added to `.github/workflows/ci.yml`
**Then** it fails the build rather than emitting a warning
**And** it runs on every push and every pull request to `main`, matching the existing CI triggers.

**Given** a gate that has never been observed to fail is not known to work
**When** the job is verified
**Then** it is demonstrated failing against a deliberately planted `contracts/probe.ts`, and the
probe is removed in the same story.

---

### Story 1.15: Determine `cs-tracker`'s daisyUI adoption route

As the Operator,
I want to know empirically whether `@plugin "daisyui/theme"` accepts a `var()` reference,
So that Epic 1's first visible ecosystem moment does not block on a question the public record
cannot answer.

**Governing ADs:** AD-15 · **Depends on:** Story 1.11.
Closes open item **O-3**. O-7 is already closed — `cs-tracker` is on `{:phoenix, "~> 1.8.7"}`
with Tailwind v4 + daisyUI, so the adapter route applies and the plain-CSS route is not in play.

**Acceptance Criteria:**

**Given** the behaviour is undocumented either way
**When** a scratch `mix phx.new` application is created and the two candidate mappings are tried
**Then** the result records whether `@plugin "daisyui/theme" { --color-primary:
var(--token-accent); }` resolves to the token value or fails
**And** the test is a rendered-output check — reading the computed value of a daisyUI-driven
property in a browser — not a reading of the source.

**Given** AD-15 says the Phoenix route carries **both** paths and either satisfies FR-18
**When** the result is recorded
**Then** it names which of the two routes is live: the `@plugin` mapping, or the documented
fallback `[data-theme="…"] { --color-primary: var(--token-accent); }`
**And** the record states that both produce the same rendered result, so the outcome gates the
step and not the contract.

**Given** the scratch application is throwaway
**When** the story closes
**Then** the finding is committed to `ops/` and the scratch application is not committed to any
estate repository.

---

### Story 1.16: Serve `contracts/` at `https://cuatro.dev/contracts/`

As a Satellite fetching the Registry and the token contract at build time,
I want the published surface reachable at a stable public URL,
So that consuming the contract requires nothing but an HTTP GET from any language.

**Governing ADs:** AD-1, AD-4 · **Depends on:** Stories 1.11, 1.12, 1.13

**⚠ Assumption stated, not inherited.** No input document specifies *how* a Next.js application
serves a repository-root directory at that path. The mechanism below is the least-coupled option
— it survives the Epic 3 move to `apps/hub` and the Epic 4 proxy change without either of them
re-deciding it. **If the Operator prefers Traefik serving `contracts/` directly in Epic 4, this
story's mechanism is the interim and should say so.**

**Acceptance Criteria:**

**Given** AD-1 requires the entire published surface to be served at
`https://cuatro.dev/contracts/`
**When** the serving mechanism is in place
**Then** `https://cuatro.dev/contracts/tokens.css`, `/fonts.css`, `/tailwind.css` and the woff2
files under `/fonts/` all resolve over HTTPS with correct content types
**And** the relative `url()` paths inside the served `fonts.css` resolve against the served
location, verified by loading a page that uses the faces from that URL.

**Given** two copies of a file the Anchor authors is the drift AD-4 forbids for the Registry, and
the same reasoning applies here
**When** the mechanism is chosen
**Then** `contracts/` has exactly one authored location in the repository, and any copy into a
served directory is produced by the build rather than committed
**And** if a build-time copy is used, a stale copy cannot ship — the copy step runs before the
build output is assembled.

**Given** Epic 3 moves the Hub to `apps/hub` and Epic 4 replaces Caddy with Traefik
**When** the mechanism is documented
**Then** the record states which of those two later changes would have to touch it, so neither
epic discovers it late.

---

### Story 1.17: Anchor migration step 1 — add the contract, change nothing

As the Operator,
I want the token contract present in the Anchor's stylesheet graph but consumed by nothing yet,
So that the riskiest commit in the migration is separated from the one that changes how the site
looks.

**Governing ADs:** AD-14, AD-19, AD-20 · **Depends on:** Stories 1.10, 1.11, 1.12.
Realizes UX-DR8, the first of the seven migration steps. **Resolves a conflict:** `DESIGN.md`
step 1 says drop the files into `app/scss/`, but AD-1 makes `contracts/` the published surface
and a second copy inside the authoring repository is the drift AD-4 forbids. The Anchor `@use`s
`contracts/` **directly**; it does not vendor a `cuatro-contracts/` folder, because it is the
publisher, not a Satellite.

**Acceptance Criteria:**

**Given** the Anchor is SCSS and custom properties pass through Sass untouched
**When** `contracts/tokens.css` and `contracts/fonts.css` are wired into `app/scss/_index.scss`
**Then** both are reachable from the compiled stylesheet
**And** no existing selector, property or value in any of the fifteen component stylesheets
changes.

**Given** NFR-2 and AD-20 require every step to leave a working system
**When** the site is built and rendered
**Then** it is visually identical to the pre-change build, asserted by Story 1.10's baseline
comparison against a capture taken before the wiring landed — not by inspection
**And** the new custom properties are present in the computed styles of `:root`, read through the
harness, and consumed by nothing.

**Given** the Anchor is the publisher and not a Satellite
**When** the wiring is reviewed
**Then** there is no copy of `tokens.css`, `fonts.css` or `tailwind.css` anywhere under `app/`,
`components/` or `public/` — the only authored copy is under `contracts/`.

**Given** this is the safe half of a two-commit change
**When** the story closes
**Then** it is shipped on its own, with the appearance change deferred to Story 1.18.

---

### Story 1.18: Anchor migration step 2 — alias the old names onto the token roles

As a Visitor,
I want the Hub to render in the Ecosystem's visual identity,
So that it visibly belongs to the same product family as the other applications in the suite.

**Governing ADs:** AD-14, AD-19, AD-20 · **Depends on:** Stories 1.10, 1.17.
Realizes UX-DR9 and FR-17. This is the one commit in the migration worth a careful visual check —
it touches one file and changes the whole site's appearance.

**Acceptance Criteria:**

**Given** `app/app.scss` defines sixteen custom properties consumed by fifteen component
stylesheets
**When** each is redefined as a `var()` reference to a token role
**Then** the mapping follows `DESIGN.md` § The mapping exactly: `--white-color` → `--token-text`,
`--black-color` → `--token-bg`, `--light-gray-color` → `--token-text-secondary`, `--gray-color`
→ `--token-border-interactive`, `--page-padding` → `--page-pad`, `--font-mono` → `--f-mono`, and
the five font aliases onto `--f-*` plus `--w-*`
**And** `--hero-height` stays local, because a viewport height is a layout constant and the
contract carries none
**And** `--accent` and `--accent-dim` are **not** aliased in this story — they are blocked on
O-10, the palette reconciliation, which is a design decision and not this story's to make
**And** `--accent-glow` is left alone pending O-11, despite having zero call sites
**And** every one of the fifteen component stylesheets keeps working with no edit.

**Given** the alias trap — `--monument-bold` encodes *weight* in a *family* name, so aliasing to
a family alone silently drops bold *(re-baselined: `--font-bold` also did, but the rebrand
retired every one of its call sites, so it is no longer live)*
**When** the aliases are written
**Then** `glitch-text.scss:5`, `error-page.scss:24`, `ProjectsHero.scss:19` and `WorkHero.scss:19`
have `font-weight` set alongside `font-family` by hand in this same commit
**And** all four call sites are asserted bold after the change by reading computed `font-weight`
through Story 1.10's harness — the alias trap is invisible to a screenshot and to a reading of the
CSS, which is why it needs a computed-value check.

**Given** pure white and pure black are retired from the system
**When** the site is rendered
**Then** the body ground is `--token-bg` (`#060509`, never `#000`) and body copy is
`--token-text` (`#eeeef2`, never `#fff`)
**And** the warm `#b3b0aa` secondary becomes the violet-tinted `#98979f`, which is the most
visible single change in the migration and is expected.

**Given** NFR-2 binds every migration step
**When** the change ships
**Then** `cuatro.dev` serves throughout, and every existing route — `/`, `/cv`, `/work`,
`/projects`, `/recommendation`, `/celeste`, `/api/health` — still renders.

**Given** the Three.js narrative's colours are JS values that a custom property cannot reach
**When** FR-17 is assessed
**Then** the 3D scene is a declared exception (seam S-1) and is out of scope for this story, not
a defect found in it.

---

### Story 1.19: `cs-tracker` adopts the token contract

As a Visitor moving from `cuatro.dev` to `cs-tracker.cuatro.dev`,
I want the two applications to look like the same product,
So that the claim that a polyglot estate can be held together at the seams is demonstrated rather
than asserted.

**Governing ADs:** AD-14, AD-15, AD-16, AD-19, AD-20 · **Depends on:** Stories 1.10, 1.13, 1.15,
1.18.
**This is Epic 1's acceptance condition** — FR-18 and SM-6.

**Acceptance Criteria:**

**Given** AD-14 requires the contract to travel as a folder under a fixed name
**When** the contract is vendored into `cs-tracker`
**Then** all three files land together in a folder named exactly `cuatro-contracts/`, never as
individual files and never renamed — the fixed name is what makes AD-16's drift check
implementable
**And** the folder sits inside `assets/css/`, following Phoenix's own sanctioned vendoring
pattern.

**Given** `cs-tracker` is on Phoenix 1.8.7 with Tailwind v4 and daisyUI, so it is a Tailwind
consumer
**When** the contract is imported
**Then** the application imports `tailwind.css`, not the plain pair
**And** the daisyUI mapping uses whichever of AD-15's two routes Story 1.15 found live
**And** daisyUI's own `--color-primary` family resolves to the Cuatro token roles rather than to
daisyUI defaults, verified in rendered output.

**Given** AD-14 makes adoption all-or-nothing, because a half-adopted Satellite looks worse than
an unadopted one
**When** adoption is assessed
**Then** the application renders wholly from the contract — no surface is left on the previous
theme
**And** seam S-7 is accepted deliberately: `cs-tracker`'s existing light theme is dropped rather
than partially carried.

**Given** the per-Satellite hand-fix list is the whole adoption cost beyond importing the files
**When** the nine lines are applied in order
**Then** `color-scheme: dark` is set on `:root` (S-11), `::selection` is set from the accent
(S-12), the focus-ring rule is copied verbatim from `EXPERIENCE.md` § Interaction Primitives
(S-2), form controls take `border-radius: 0` (S-3), and the framework's control defaults are
mapped onto the token roles (S-9)
**And** if LiveView DOM patching visibly interrupts a transition, `phx-update="ignore"` is
applied to the affected containers (S-8).

**Given** FR-18 is the acceptance condition for "the Ecosystem is visible"
**When** a Visitor moves between `cuatro.dev` and `cs-tracker.cuatro.dev`
**Then** both render the same palette, the same type scale and the same spacing rhythm
**And** the resemblance is evidenced by reading the computed values of the shared token roles on
both origins through Story 1.10's harness and recording them side by side, so "looks like the same
product" rests on measured values rather than on both importing the same file
**And** the Operator confirms the result by looking at both, which the measurement supports rather
than replaces.

**Given** NFR-2 and AD-20 bind every step
**When** the change ships
**Then** `cs-tracker.cuatro.dev` serves throughout.

---

### Story 1.20: Record the adopted contract version and the automation policy

As the Operator,
I want each adopter's contract version written down and the no-unattended-automation rule stated
where it binds,
So that a token change can never ship as a minor bump into an unattended merge in a repository
that cannot detect its own breakage.

**Governing ADs:** AD-16, AD-19 · **Depends on:** Story 1.19.
Satisfies the policy and record halves of FR-19; the `token_contract` field and its scheduled
drift check land in Epic 2, and the distribution machinery in Epic 6.

**Acceptance Criteria:**

**Given** AD-16 requires each Satellite's adopted version to be declared and later verified
**When** the adoption is recorded
**Then** `cs-tracker`'s adopted version is written down as `1.0.0`, matching the
`Contract v1.0.0` header in its vendored `cuatro-contracts/tokens.css`
**And** the record names the exact file the Epic 2 drift check will read, so that check has a
target rather than a search.

**Given** NFR-10 and FR-19 forbid unattended automation in repositories lacking a real test suite
**When** the policy is recorded
**Then** it states that no automated dependency merge is enabled in any estate repository without
one, and lists which repositories currently have one
**And** it is confirmed that no such automation is enabled in the Anchor or in `cs-tracker` today.

**Given** AD-19 requires `cs-tracker` to be measured once by hand against the accessibility floor
after token adoption
**When** the manual pass is run
**Then** the 44×44px target floor is checked **by measurement in a browser**, not by reading the
CSS, and the result is recorded
**And** the focus ring is confirmed visible against all three grounds, and confirmed not
transitioned
**And** a failure is recorded as a finding rather than silently corrected out of scope.

**Given** AD-16's model is deprecate → migrate → remove, with no atomic commits across eight
repositories
**When** the record is written
**Then** it states that a value change is a minor bump and any rename is major, so the next
change has the rule at hand rather than in a spine document.

---

## Epic 2: The suite becomes visible — Registry as product and the reshaped front door

Daniela lands on `cuatro.dev`, scrolls into a directory of six running applications, and opens
one. Marcus skips the narrative, reads an accurate `tech` array, and reaches any repository in one
hop. The Registry cannot lie about either of them, and the Operator can see how Visitors move
through the Hub.

Twenty-six stories. This is the largest epic in the breakdown by a wide margin, and deliberately
so: it carries nineteen FRs, six of the nine UX open items, the AD-19 assertion suite,
and the five Anchor migration steps that `DESIGN.md` leaves trailing after Epic 1. **`DESIGN.md`
assigns migration steps 1–2 to Epic 1 and says steps 3–7 "can trail" without naming where — they
land here** (Stories 2.18–2.22), because the Hub's stylesheets are being reshaped in this epic
anyway.

**Gated by Story 1.3** (AD-17b), binding at **Story 2.9** and everything downstream of it. AD-17b
requires bot mitigation live before *the Suite Directory ships*, and the Directory is a crawler
amplifier by construction and now the homepage climax — a hard prerequisite, not a sequencing
preference. Stories 2.1–2.8 ship no new crawler-facing surface and may open before 1.3; Story 2.9
carries the dependency explicitly, and every story that renders the Directory depends on 2.9
transitively, so the gate binds mechanically rather than by this paragraph.

### Story 2.1: The pre-existing repository defects

> ⚠️ **Re-baselined 2026-08-15.** This story originally covered four defects found against
> `main`. **Three were already fixed by the cybercore rebrand** now merged into `dev`:
> `aria-hidden` on `/work`'s only `<h1>` (resolved by PR #65), the `boder:` typo at
> `WorkItem.scss:84` (file rewritten by PR #61), and the `vaR(` case wart (same). Their
> acceptance criteria are removed rather than left to fail against code that no longer exists.
> **Two survive.**

As the Operator,
I want the two shipping defects that survived the rebrand corrected,
So that the dates read correctly and the header cannot be left hidden by a cleanup that never ran.

**Governing ADs:** AD-19, AD-20 · **Depends on:** none.

**Acceptance Criteria:**

**Given** `content/work.ts:18` reads `'Oct. 2023 - Dev. 2025'`
**When** the typo is fixed
**Then** it reads `Dec.`
**And** every other period string in `content/work.ts` is checked in the same pass.

**Given** `Celeste.tsx:8–12` suppresses the site header by mutating
`document.querySelector('header').style.display` inside an effect, leaving the header hidden if
cleanup never runs
**When** the mechanism is replaced
**Then** the suppression is achieved by a route-group layout or a `<body>` class rather than by
mutating another component's DOM node
**And** `/celeste` still renders with no header, because the suppression itself is correct — that
page should not carry suite navigation
**And** navigating away from `/celeste` by any route always restores the header, including on a
client-side transition that unmounts abnormally.

---

### Story 2.2: Measure the narrative bundle against the asset budget

As Daniela on a slow mobile connection,
I want the suite to reach me without waiting for the story,
So that the payload arrives even when the wrapper does not.

**Governing ADs:** AD-19 · **Depends on:** none.
Closes open item **O-2**. `EXPERIENCE.md` § Asset Budget records an estimate, not a measurement,
and says so; SM-C5 counts Hub asset weight as a counter-metric, so it needs a real number before
the Directory is built on top of it.

**Acceptance Criteria:**

**Given** the narrative bundle — Three.js, R3F, drei, `@react-three/postprocessing`, GSAP,
ScrollTrigger, lenis — is estimated at 300–450 KB gzipped from published library sizes rather
than measured
**When** the actual build is measured
**Then** the gzipped weight of the narrative JavaScript is recorded as a number
**And** the narrative's geometry and texture assets are measured and recorded separately
**And** both are recorded against the estimate, so the gap between inference and measurement is
visible.

**Given** the non-3D path total is the budget that binds at **≤140 KB gzipped** — HTML plus
critical CSS ≤20 KB, three latin-subset variable faces ≤120 KB
**When** the non-3D path is measured
**Then** its total is recorded and compared against the 140 KB budget
**And** a breach is recorded as a finding with the largest contributor named, not silently
absorbed.

**Given** `EXPERIENCE.md` names `@react-three/postprocessing` as the first trade to examine if the
narrative lands above ~450 KB
**When** the measurement exceeds that figure
**Then** the record names what would be traded and what it would cost, without making the trade
in this story — that is a separate decision.

---

### Story 2.3: The Registry schema and its blocking CI gate

As a consumer of the App Registry in any language,
I want the entry shape fixed by a schema that CI enforces,
So that a malformed entry cannot ship and I can rely on the fields being present.

**Governing ADs:** AD-1, AD-4, AD-5, AD-6, AD-12, AD-16, AD-21 · **Depends on:** Story 1.14
(the `contracts/` purity gate this sits beside)

**Acceptance Criteria:**

**Given** AD-5 fixes the entry shape, as corrected by C-4 and C-5
**When** `contracts/registry.schema.json` is authored
**Then** it requires `id`, `name`, `description`, `status`, `tech`, `source`, **`demo`** and
**`identity`** on every entry
**And** it permits `live`, `family`, `absorbed_into` and `token_contract` as optional
**And** `demo` and `identity` are required **with an explicit value including `none`** — an
absent field is not a permitted way to say "not applicable"
**And** `identity` accepts exactly `oidc`, `wallet` or `none`
**And** `status` accepts exactly `Live`, `Complete`, `In progress` or `Archived`, and no fifth
value validates.

**Given** FR-6 and FR-28 make the `live` field conditional
**When** the schema expresses the condition
**Then** `live` is **required** when `status` is `Live` and **forbidden** when `status` is
`Archived`
**And** a fixture entry violating either half fails validation, demonstrated rather than
asserted.

**Given** AD-3 makes the public hostname declared rather than derived, because three live
hostnames already diverge from their ids
**When** the schema is written
**Then** nothing in it derives a hostname from an id, and `live` is a free URL field.

**Given** AD-4 requires the file to validate while it is being written
**When** the schema ships
**Then** `contracts/registry.json` carries a `$schema` reference to it so the editor validates
in place
**And** the envelope carries `contract_version`.

**Given** AD-21 makes every CI gate blocking, because no staging environment exists
**When** the validation job is added to `.github/workflows/ci.yml`
**Then** it fails the build on a schema breach rather than warning
**And** it is demonstrated failing against a deliberately malformed fixture, which is removed in
the same story.

---

### Story 2.4: Confirm the assumed Statuses, hostnames and `tech` values

As the Operator,
I want the four assumptions the Registry would otherwise inherit turned into confirmed facts,
So that authoring the Registry is a transcription job rather than a sequence of judgement calls
mid-flight.

**Governing ADs:** AD-3, AD-6 · **Depends on:** Story 1.7 (the routing inventory supplies the
real hostnames).
Closes open items **O-4** and **O-5**, and PRD §13 Q9. Split out deliberately: each item below is
an Operator decision, and a story that needs one mid-flight is a story that escalates.

**Acceptance Criteria:**

**Given** `cuatro-finance` is assumed built-but-not-deployed and `cs-tournament` assumed Live on
Vercel, neither confirmed (O-4, PRD §13 Q9)
**When** both are checked against reality
**Then** each is recorded with its true Status from the four-value taxonomy
**And** the record states what changes in the first public Suite Directory as a result, because
the composition of the six rendered entries depends on both answers.

**Given** `wheel.cuatro.dev` is a placeholder used in the UX mocks (O-5)
**When** the hostname is decided
**Then** the chosen hostname for `list-wheel` is recorded, and it is the value Story 2.25 will
route and Story 2.5 will author into `live`
**And** the hostname for `cs-tournament` is recorded or explicitly deferred, since the spine
leaves both open.

**Given** FR-9 makes an inaccurate `tech` array a defect rather than a cosmetic issue, and Marcus
checks it at step 2 of his journey
**When** every application's `tech` is confirmed
**Then** the `digital-library` entry's stale `Hetzner VPS` value at `content/projects.ts:30` is
recorded for correction
**And** the C-1 narrowing is respected: `SQLite` at `content/projects.ts:23` is **already
correct** and is not "corrected"
**And** `digital-library`'s real stack is recorded as `SvelteKit · Fastify · SQLite · Redis ·
BullMQ · Docker`, with the store declared per AD-10.

**Given** the four `In progress` applications hold entries but are unbuilt (C-10)
**When** their `identity` and `demo` values are decided
**Then** each carries an explicit value — `none` for identity where no authentication exists,
`wallet` for `MaiCoin`, and a not-deployed demo declaration — because AD-5 forbids blank as a way
of saying "not applicable"
**And** `Mutuo`'s pre-existing demo accounts are recorded, since they are an asset for FR-25 later.

---

### Story 2.5: Author `contracts/registry.json`

As Marcus,
I want one record per application with an accurate stack and a working source link,
So that I can verify the polyglot claim without hunting, and read an old commit date as
confirmation rather than as abandonment.

**Governing ADs:** AD-3, AD-4, AD-5, AD-6, AD-12 · **Depends on:** Stories 2.3, 2.4.
Realizes FR-5, FR-6, FR-7, FR-9, FR-10, FR-11, FR-24 *(declaration)*, FR-27 *(declaration)* and
FR-30. Descriptions are Story 2.6 — this story authors structure.

**Acceptance Criteria:**

**Given** AD-6 makes Registry membership a property of the application, not the repository
**When** the entries are authored
**Then** every application in `ops/estate.md` has exactly one entry, including archived and
absorbed ones
**And** `tcg-tracker` carries `absorbed_into: cuatro-tracker` and `connect-four-react` carries
`absorbed_into: cuatro-portfolio` (FR-30), each with a `source` that resolves to where the code
now lives
**And** the entry count and the repository count are different numbers, and nothing in the file
or its validation treats either as validating the other.

**Given** AD-3 gives each application exactly one kebab-case id equal to its repository name
**When** the ids are authored
**Then** each id matches its repository name exactly
**And** the public hostname is declared in `live`, never derived from the id — the three live
hostnames that diverge from their ids are the reason the rule exists.

**Given** FR-10 makes the drill-through path the Registry's contract with Marcus
**When** `source` is authored
**Then** every entry without exception carries one, including `Archived` entries and the Hub's own
**And** each resolves to a repository, never to a profile page.

**Given** FR-11 groups the Tracker Family
**When** `family` is authored
**Then** `cuatro-tracker`, `cs-tracker` and `poketracker-go` share a value
**And** `tcg-tracker` does **not** carry it — it is `Archived` with `absorbed_into`, not a family
member.

**Given** AD-12 and AD-5 require explicit declarations
**When** `identity` and `demo` are authored
**Then** every entry carries both with an explicit value, `MaiCoin` is `wallet`, and no entry
omits either
**And** `token_contract` is set on `cs-tracker` to the version Story 1.20 recorded, and omitted
on entries that have not adopted.

**Given** the schema gate from Story 2.3 is blocking
**When** the file is committed
**Then** CI validates it and passes
**And** the file carries `$schema` and `contract_version`.

---

### Story 2.6: The editorial voice pass

As Daniela, who cannot name a single one of the frameworks involved,
I want each description to tell me what the application does for a person,
So that I can form an opinion from software rather than from a stack list.

**Governing ADs:** AD-4 · **Depends on:** Story 2.5.
Realizes FR-8 and closes open item **O-1**. `EXPERIENCE.md` supplies six drafts written to the
contract from inferred behaviour; this story confirms each against the software and commits them.

**Acceptance Criteria:**

**Given** `EXPERIENCE.md` § Voice and Tone supplies drafts for Digital Library, Cuatro Tracker,
CS Tracker, List Wheel, CS Tournament and Cuatro Ecosystem, written from inferred behaviour (O-1)
**When** each draft is checked against the running software
**Then** each is confirmed accurate or corrected, and the check is recorded per entry
**And** a draft describing behaviour the software does not have is corrected rather than shipped.

**Given** FR-8 fixes the contract
**When** every description in the Registry is assessed
**Then** each is between one and three sentences and none is four
**And** none contains a superlative or a marketing adjective — "powerful", "seamless",
"cutting-edge", "modern", "beautiful", "blazing" are each specifically out
**And** none uses first person
**And** each leads with the thing itself, not with a category.

**Given** the existing `digital-library` description at `content/projects.ts:15` is three
sentences and stack-led, spending two of them on Docker Compose, FTS5 BM25 ranking and SMTP
**When** it is rewritten
**Then** it is treated as **non-conforming and replaced**, not grandfathered
**And** every implementation noun it contained appears in `tech` instead, where it belongs.

**Given** entries not rendered at MVP still hold descriptions
**When** the pass runs
**Then** it covers **every** entry in the Registry, not only the six the Directory renders —
SM-8 targets 100% editorial conformance across the Registry.

**Given** UX-DR38 fixes punctuation and status vocabulary
**When** every string in the Registry is set
**Then** punctuation is typeset — `—`, `…` and curly quotes, never `"`, `--` or `...`
**And** Status words are the four-value taxonomy verbatim, with no synonym anywhere
**And** no number appears that was not supplied, because a metric with no source is an invented
one.

---

### Story 2.7: Retire `content/projects.ts`; the Hub imports the published Registry

As the Operator,
I want exactly one representation of the Registry in the repository,
So that the Hub and its consumers can never read two registries that disagree.

**Governing ADs:** AD-4, AD-21 · **Depends on:** Stories 2.5, 2.6.
Realizes FR-12 and applies forced change **C-6** — the TypeScript module is retired, not promoted.

**Acceptance Criteria:**

**Given** AD-4 makes `contracts/registry.json` the only Registry, and a TypeScript module cannot
satisfy FR-12 for an Elixir or Go consumer
**When** the Hub is rewired
**Then** it imports `contracts/registry.json` directly, with no emitted TypeScript copy and no
private second representation
**And** `content/projects.ts` is deleted, together with the `ProjectEntry` interface it exported
**And** no file under `app/`, `components/` or `content/` holds Registry data.

**Given** the Hub must consume the same published Registry it publishes
**When** the import path is chosen
**Then** it reads the same file that is served at `https://cuatro.dev/contracts/registry.json`,
not a build-time transform of it.

**Given** `app/projects/page.tsx` renders `ProjectCard` from the retired module today, and NFR-2
forbids leaving a live route broken
**When** the module is deleted
**Then** `/projects` is **repointed at `contracts/registry.json`** and keeps rendering through the
existing `ProjectCard`, unchanged in appearance
**And** the route's eventual retirement is Story 2.14's job, not this story's — this story swaps
the data source and nothing else, so `/projects` never spends a commit broken while waiting for a
redirect target that does not exist until Story 2.9
**And** typecheck passes, since AD-21 makes it a blocking gate.

**Given** a Satellite fetches the Registry at build time rather than at request time
**When** the published file is checked
**Then** it is valid JSON reachable over HTTPS with a correct content type, verified with a plain
HTTP GET carrying no JavaScript.

---

### Story 2.8: Assert the 44×44 hit-target floor

As a Visitor tapping on a phone,
I want every interactive element to be big enough to hit,
So that the accessibility floor is a property the build enforces rather than a claim the
documents make.

**Governing ADs:** AD-19, AD-21 · **Depends on:** Story 1.10 (which installed Playwright and
provisioned the browser in CI).
Forced change **C-7** — `@playwright/test` being absent from `package.json` — is **paid in Story
1.10**, not here: Epic 1's migration stories needed the same harness to assert their own rendered
output, so the setup cost lands once, earlier. This story adds the floor assertion on top of it
and closes the automated half of open item **O-8**.

**Acceptance Criteria:**

**Given** AD-19 requires the floor to be asserted at a 360px viewport
**When** the assertion is written
**Then** it loads the Hub at 360px and, for every interactive element, asserts
`boundingBox()` measures at least 44×44
**And** it fails against an element that meets the floor only through vertical padding on a plain
inline element — the ~29px case that reads as compliant in the CSS and is not
**And** A-5 is asserted alongside it: no horizontal scroll at 360px.

**Given** `EXPERIENCE.md` says this floor is the single easiest one to miss while appearing to
meet it, and must be verified by measurement rather than by reading the CSS
**When** the assertion is verified
**Then** it is demonstrated failing against a deliberately undersized element, which is removed in
the same story.

**Given** AD-21 makes every CI gate blocking and AD-19 says the existing Lighthouse assertion
stays
**When** the job is wired into CI
**Then** it fails the build rather than warning
**And** `.lighthouserc.js` keeps `'categories:accessibility': ['error', { minScore: 0.95 }]`
unchanged and unweakened.

---

### Story 2.9: The Suite Directory

As Daniela,
I want the story to resolve into a list of things that are actually running,
So that I form an opinion from software rather than from claims.

**Governing ADs:** AD-4, AD-19, AD-21 · **Depends on:** Stories 1.3 (AD-17b — the Directory may
not ship before bot mitigation is live on all four subdomains), 2.7, 2.8.
Realizes FR-35, FR-3, FR-7, FR-10 and FR-11, and the Directory half of FR-2.

**Acceptance Criteria:**

**Given** FR-35 renders a curated subset while the Registry stays complete
**When** the filter is implemented
**Then** it is a **declarative rule over `status`**, never a hand-maintained second list —
changing an entry's Status to `Live` makes it appear with no other edit, demonstrated by doing so
in a test
**And** entries with Status `In progress` or `Archived` exist in the Registry and are not rendered
**And** ordering is `Live` before `Complete`, then Registry order — not alphabetical, not by date.

**Given** the Hub is one of the six entries PRD §5 counts
**When** the Hub's own entry renders
**Then** it is marked `You are here` and is not a link to the page you are on
**And** this stays declarative — a property of the current origin, not a hand-coded exception to
the filter.

**Given** the row is the unit at every width and nothing reflows into cards
**When** the Directory is built
**Then** each entry is a grid row with a hairline separator and **no containing box**, so
card-in-card cannot occur
**And** at ≥760px the rows gain columns through the same markup and one grid change
**And** the Tracker Family group is the only containment layer in the directory, with a framing
line that names no count.

**Given** FR-3 requires legibility at 360px and A-8 fixes the semantics
**When** the markup is authored
**Then** the Directory is a `<ul>` of entries with the Family group a nested `<ul>` carrying an
accessible name
**And** name, Status, description and `tech` are all readable at 360px with no horizontal scroll
and no truncation of the Status value
**And** the live link and source link are two independently addressable targets, each ≥44×44 via
`min-height` plus `inline-flex`, separated by `--s-lg`, on the links themselves and not on a
wrapper
**And** the row is **never** wholly clickable, because a whole-row target would have to pick one
of two destinations and picking the live link silently costs Marcus his path.

**Given** `EXPERIENCE.md` fixes the strings
**When** copy is authored
**Then** the heading is `The Suite`, the count is the real rendered count, the live link is the
**bare domain** and never "View Live", the source link is `Source` and never "GitHub" or "Code"
**And** each source link carries an accessible name naming the application, per A-10
**And** `Complete` entries have **no live link at all**, not a disabled one
**And** per UX-DR18 the live link carries a `--stroke-emphasis` accent underline and the source
link a `--stroke-hair` `--token-border-interactive` one, and on hover **both** underlines become
`--token-accent-hover` and nothing else moves — no lift, no scale, no shadow, no background
change, no width change.

**Given** the Registry could be unreachable and the page must still render
**When** the failure states are handled
**Then** the Directory renders from the build-time snapshot the Hub was built with
**And** no empty state is designed, because the filter is over Status and the Hub's own entry is
always `Live` — an empty render is a defect, not a state
**And** no toast system, confirmation dialog or skeleton is introduced.

**Given** `html, body { overflow-x: clip }` is required globally and `app/app.scss` currently sets
`width: 100vw` with `overflow-x: hidden` on `body`
**When** the layout is authored
**Then** `clip` replaces `hidden`, because `hidden` breaks sticky positioning
**And** widths are `100%` with container padding, never `100vw`.

---

### Story 2.10: Assert the Status mark's three structural axes

As a Visitor who cannot distinguish the accent hue,
I want the Status taxonomy to survive greyscale,
So that the highest-leverage field in the Registry carries its meaning structurally rather than
by colour.

**Governing ADs:** AD-19, AD-21 · **Depends on:** Stories 2.8, 2.9.
Closes open item **O-9**. AD-19 is explicit that a border-only assertion is forbidden.

**Acceptance Criteria:**

**Given** AD-19 names `EXPERIENCE.md` § Status mark as the single source for the mapping
**When** the Playwright assertions are written
**Then** all three axes are asserted: `Live` carries a 4px dot that `Complete` lacks; `Complete`
is solid where `In progress` is dashed; `In progress` has a border that `Archived` drops
**And** **asserting `border-style` alone is forbidden** — `Live` and `Complete` are both
`1px solid` and sit 1.13:1 apart in greyscale without the dot, so a border-only assertion passes
a broken implementation and fails a correct one
**And** the dot assertion is demonstrated failing against an implementation with the dot removed.

**Given** opacity is barred from expressing state anywhere in the system
**When** the marks are checked
**Then** no Status mark uses `opacity` to express its value
**And** `Archived` drops its container entirely rather than fading it, because a faded mark
computes to 2.25:1 on the border.

**Given** O-9 requires a greyscale render check
**When** the manual check is run
**Then** the Directory is rendered desaturated and all four Status values remain distinguishable
with no legend
**And** the result is recorded, because a check that leaves no record cannot be re-run against a
regression.

**Given** the mark is not interactive
**When** it is implemented
**Then** it carries no tooltip, no popover and no hover state, and the 44px target floor does not
apply to it.

---

### Story 2.11: The premise block and the framework band

As Daniela,
I want to be told in two sentences what this is,
So that I understand the claim before I see the evidence for it.

**Governing ADs:** — · **Depends on:** Story 2.9.
Realizes FR-4.

**Acceptance Criteria:**

**Given** FR-4 caps the premise at three sentences and requires it to be encountered before or
with the Suite Directory
**When** the premise block is placed
**Then** it appears above the Directory in the document on both the default and the non-3D path
**And** it is at most three sentences
**And** it names no framework — it must carry for a reader who cannot name a single one of them.

**Given** the framework band is the only ornament in the system and is made of real facts
**When** it is built
**Then** it renders framework names in Bricolage `wdth 75` / 700 uppercase at `--t-3xs`,
alternating `--token-text-secondary` and `--token-accent-muted`, bounded above and below by
hairlines
**And** it carries no state and is not a legend
**And** the names it lists are the frameworks actually in the Estate, since inventing one would
breach the never-invent-a-metric rule.

**Given** the footer line `Six applications · five languages · one operator` states a count
**When** it is authored
**Then** the count matches the real rendered count from Story 2.9, or the line is deleted rather
than left stale
**And** every count, plate mark and metric carries `font-variant-numeric: tabular-nums`, per
UX-DR45, so a changing figure does not shift the characters beside it.

**Given** the plate mark is section identity, not decoration
**When** section heads are authored
**Then** a plate mark renders in mono `--t-3xs` at `+0.16em` tracking, uppercase, in
`--token-text-secondary`, sitting on a hairline, with section identity top-left and position or
domain top-right
**And** it appears only on section heads carrying a genuine ordinal or domain — **not by
default**, because an eyebrow on every section is a named tell.

---

### Story 2.12: The narrative resolves into the Suite Directory

As Daniela,
I want the story to end in the suite rather than in a contact form,
So that the last thing I see is software that is running.

**Governing ADs:** AD-20 · **Depends on:** Stories 2.9, 2.11.
Realizes FR-1.

**Acceptance Criteria:**

**Given** FR-1 makes the Directory the terminal section of the primary scroll
**When** the homepage is reshaped
**Then** the Directory is in the homepage document and reaching it requires no click and no route
change
**And** nothing follows it in the primary scroll except footer content
**And** the pre-existing `/cv`, `/work`, `/recommendation` and `/celeste` routes remain reachable
and functional.

**Given** the feature NFR says the narrative may not block the payload
**When** the page loads
**Then** the premise and the Directory are interactive independently of the narrative's asset
loading
**And** the narrative bundle is never preloaded and never carries `fetchpriority="high"`
**And** there is no loading spinner for the narrative — a spinner would announce that something
is missing on the one path where nothing is.

**Given** the motion rules
**When** the handoff between narrative and Directory is built
**Then** only `transform` and `opacity` animate, transitioned properties are named individually
and `transition: all` does not appear
**And** there is one orchestrated entrance per page load, with no universal scroll-triggered
fade-up
**And** scroll work uses `IntersectionObserver`, never a raw `scroll` listener.

**Given** NFR-2 binds every step
**When** the reshape ships
**Then** `cuatro.dev` serves throughout and every existing route still renders.

---

### Story 2.13: The non-3D front door and the skip control

As Marcus, who skips the narrative, and as Daniela on a slow connection,
I want the suite without the story,
So that the payload is never gated behind the wrapper.

**Governing ADs:** AD-19 · **Depends on:** Stories 2.9, 2.11.
Realizes FR-2 and NFR-6, and closes PRD §13 Q7.

**Acceptance Criteria:**

**Given** Q7 is closed as **one** non-3D front door, not two
**When** `prefers-reduced-motion: reduce` is set, or the connection is slow
**Then** both receive the **same** typographic hero — premise plus framework band
**And** **no static poster frame of the 3D scene is produced**, because a still of a 3D scene
reads as a broken 3D scene
**And** on that path the 3D asset is never requested and never decoded
**And** the Directory is reached in **zero** interactions.

**Given** FR-2 requires at most one interaction from a cold arrival with no intervening scroll
requirement
**When** the skip control is placed on the default path
**Then** it sits **above the fold**
**And** it reads `Skip to the suite ↓`
**And** activating it **moves focus**, not only scroll position, to the Suite Directory heading
**And** it is distinct from the accessibility skip-link, which remains the first tabbable element
and targets main content (A-6).

**Given** the narrative may fail rather than be disabled
**When** WebGL is unavailable, an extension blocks it, or initialisation throws
**Then** the page falls through to the same non-3D path and the Directory renders fully usable.

**Given** A-14 governs the decorative canvas
**When** the 3D scene renders on the default path
**Then** it is `aria-hidden`, not focusable, and its content is stated in prose.

---

### Story 2.14: `/projects` redirects permanently to `/#suite`

As a Visitor holding an old link,
I want it to land somewhere current,
So that no inbound link breaks and no second rendering of the same data can disagree with the
first.

**Governing ADs:** AD-20 · **Depends on:** Stories 2.7, 2.9.
Realizes UX-DR26 and the route half of FR-2.

**Acceptance Criteria:**

**Given** `/projects` is live at v2.5.3 and is the direct ancestor of the Suite Directory
**When** the redirect is added
**Then** `/projects` returns a permanent 301 to `/#suite`
**And** it is **not deleted**, because NFR-2 says nothing live may break and a 301 keeps every
inbound link, bookmark and search result working
**And** this satisfies FR-2's "stable in-page anchor **or** route" for free.

**Given** two renderings of the same data violate NFR-9 the moment they disagree
**When** the redirect ships
**Then** `ProjectCard` and `ProjectsHero` are retired along with their stylesheets
**And** no component outside the Suite Directory renders Registry data.

**Given** `.lighthouserc.js` collects `http://localhost:3000/projects`
**When** the route becomes a redirect
**Then** the Lighthouse configuration is updated so the accessibility assertion still runs against
a real page rather than a redirect
**And** the ≥0.95 accessibility assertion at severity `error` is preserved unweakened.

---

### Story 2.15: Nav reshape to two destinations

As Marcus,
I want the `Suite` link where I want it, at the moment I want it,
So that the header serves the payload rather than competing with it.

**Governing ADs:** — · **Depends on:** Story 2.9.
Closes PRD §13 Q8.

**Acceptance Criteria:**

**Given** every header link competes with SM-1's ≥60% target, and the AI-nav tell is five inline
links plus a CTA button
**When** the header is authored
**Then** it carries exactly two destinations — `Suite` primary and `CV` secondary — and no CTA
button
**And** no filled button appears anywhere in the system.

**Given** the current route must be identifiable
**When** a route is active
**Then** its link carries a `2px` accent underline and `aria-current="page"`
**And** the underline is the same weight as an active link underline elsewhere, so "current" reads
identically wherever it appears.

**Given** a header that disappears costs Marcus the `Suite` link at the moment he wants it
**When** the page is scrolled
**Then** the header is sticky at `--z-sticky` and does not hide on scroll.

**Given** a two-letter label is narrow
**When** hit targets are measured
**Then** each nav link reaches 44px in **both** dimensions, using `padding-inline` as well as
`min-height`, and passes the Story 2.8 assertion.

---

### Story 2.16: `/cv` built around the existing `WorkTimeline`

As Daniela, forming an opinion and wanting employment context,
I want one destination rather than the same story told twice,
So that the CV route is worth the header slot it occupies.

**Governing ADs:** — · **Depends on:** Stories 2.1, 2.15.
`app/cv/page.tsx` is a one-line stub returning a bare `<h1>` today, while `/work` is the fully
built page — so this is **building `/cv` around a component that already works**, not merging two
built pages.

**Acceptance Criteria:**

**Given** `/work` already renders `WorkHero` + `WorkTimeline` + a `WorkItem` accordion over
`content/work.ts`
**When** `/cv` is built
**Then** it reuses `WorkTimeline` **unchanged** as a section
**And** `/work` keeps rendering it standalone for anyone holding that URL, and remains functional
**And** `/work` is not in the header.

**Given** the accordion's states are fixed
**When** it renders on either route
**Then** the trigger carries `aria-expanded` and the panel carries `aria-controls`
**And** the first entry opens on load **without a collapsed-height flash**
**And** the existing `useReduceMotion` hook drops the GSAP height tween to `0` duration under
`prefers-reduced-motion`.

**Given** Education and Contact content does not exist in the repository
**When** the page is assembled
**Then** those sections are **omitted, not rendered empty** — an empty section reads as
unfinished, an absent one reads as scoped.

**Given** Story 2.1 exposed the `<h1>` on the work hero
**When** `/cv` renders
**Then** A-7 holds on both routes: one `<h1>` per document and no skipped heading levels.

---

### Story 2.17: Secondary surface states

As a Visitor arriving at a route that is not the homepage,
I want it to be finished or absent rather than half-built,
So that nothing on the site reads as a placeholder.

**Governing ADs:** — · **Depends on:** Stories 2.1, 2.15

**Acceptance Criteria:**

**Given** an unattributed quote is worth less than no quote to a hiring reader
**When** `/recommendation` is assessed
**Then** it either ships **loaded with an attributed quote**, or the route is **not linked at
all** from `/cv` or the footer
**And** no unattributed and no placeholder state ships.

**Given** `/celeste` is personal and converts nobody
**When** it is placed
**Then** it is reachable from the footer only, is not indexed, and renders with the header
suppressed by the mechanism Story 2.1 installed
**And** it remains the only surface in the system with no exit, deliberately.

**Given** `Error404` exists and inherits the tokens with no new work
**When** the 404 page is checked
**Then** it offers exactly two exits — Suite and CV — matching the header
**And** it renders from the token contract with no new tokens introduced.

**Given** A-13 requires the page title to distinguish the route
**When** each secondary surface renders
**Then** its `<title>` is distinct and `lang` is set on the document.

---

### Story 2.18: Migration step 3 — retire the violet hairlines

As the Operator,
I want the alpha hairlines replaced with named opaque tokens,
So that a hairline stops changing value with whatever sits behind it, which is precisely why alpha
cannot federate.

**Governing ADs:** AD-14, AD-20 · **Depends on:** Stories 1.18, 2.14.
Realizes UX-DR10. Scoped after Story 2.14 on purpose: `ProjectCard.scss` is retired with
`/projects`, so by the time this story runs only `WorkItem.scss` remains — if 2.14 has not
shipped, this story covers both files.

> ⚠️ **Re-baselined 2026-08-15.** The white alpha hairlines this story targeted are gone; the
> cybercore rebrand replaced them with a violet set. The `boder:` defect it carried no longer
> exists — that file was rewritten by PR #61.

**Acceptance Criteria:**

**Given** `rgba(91, 33, 182, 0.06)` (`WorkItem.scss:35`, `ProjectCard.scss:36`),
`rgba(91, 33, 182, 0.3)` (`WorkItem.scss:145`, `ProjectCard.scss:67`) and
`rgba(10, 0, 20, 0.6)` (`ProjectCard.scss:27`) are used as hairlines and card surfaces
**When** they are replaced
**Then** each becomes `var(--token-border)` or `var(--token-border-interactive)` as the treatment
requires
**And** no `rgba()` colour value remains in any component stylesheet still in the tree, **except
`glitch-text.scss`**, whose `rgba(255, 0, 80, …)` / `rgba(0, 255, 255, …)` pair encodes a
deliberate chromatic-aberration effect and is out of scope unless O-10 assigns it token roles
**And** the rules render as `1px` and opaque.

**Given** NFR-2 binds every migration step
**When** the change ships
**Then** `/work` and `/cv` still render and `cuatro.dev` serves throughout.

---

### Story 2.19: Migration step 4 — sweep the colour literals

As the Operator,
I want every hard-coded colour outside the contract removed,
So that FR-17 holds for values the contract covers.

**Governing ADs:** AD-14 · **Depends on:** Story 1.18.
Realizes UX-DR11 and completes FR-17's coverage.

**Acceptance Criteria:**

**Given** colour literals sit on **28 lines across 9 files** outside `app/app.scss`
*(re-baselined 2026-08-15; was "eleven places" against `main`)*
**When** the sweep runs
**Then** `#444`/`#fff` at `celeste.scss:2`/`:16` and `#fff` at `navbar.scss:10` are replaced with
token roles
**And** `#0a000f` at `HomeLayout.scss:2` and `error-page.scss:7`, the `rgba(140, 90, 210, 0.06)`
grid lines at `HomeLayout.scss:4`–`:5` and `error-page.scss:9`–`:10`, `rgba(139, 92, 246, 0.15)`
at `error-page.scss:28`, and the `rgba(0, 0, 0, …)` scanline set at `ScanlineOverlay.scss:6`,
`:16`, `:17` are all replaced with token roles — these arrived with the cybercore rebrand and
their disposition follows O-10
**And** the bare keyword `color: white` the sweep used to target **no longer exists**, because
`HomeLayout.scss` was rebuilt — but the grep still covers **named colours** as well as `#` and
`rgba(`, because that class of miss is cheap to guard against
**And** a repository-wide search for `#`, `rgba(`, `white`, `black` and other named colours
returns no meaning-bearing hit outside the contract, the print stylesheet, and
`glitch-text.scss`'s deliberate aberration pair.

**Given** paper is genuinely white and toner is genuinely black
**When** `_print.scss` is assessed
**Then** it keeps real `#fff` and `#000` and is explicitly outside the contract by nature.

**Given** the Three.js narrative's colours are JS values a custom property cannot reach without a
runtime `getComputedStyle` read
**When** FR-17 coverage is assessed
**Then** the 3D scene is out of scope as declared seam S-1, and the sweep does not attempt it.

---

### Story 2.20: Migration step 5 — swap the type

As a Visitor,
I want the Ecosystem's typefaces rather than the previous site's,
So that the identity is complete rather than half-applied.

**Governing ADs:** AD-14 · **Depends on:** Stories 1.12, 1.18.
Realizes UX-DR12 and closes open item **O-6**.

**Acceptance Criteria:**

**Given** `--confillia-normal` has two live call sites at `HomeLayout.scss:117` and `:148` and is
retargeted to `--f-display` at `wdth 75` (O-6)
**When** the retarget is applied
**Then** both call sites are rendered and confirmed to read acceptably before the story closes
**And** `--confillia-bold` is deleted outright, having zero call sites.

**Given** the old faces are self-hosted through `app/scss/_fonts.scss`
**When** the swap completes
**Then** `_fonts.scss` is retired in favour of `contracts/fonts.css`
**And** the General Sans, Monument Extended and Confillia binaries are deleted from
`public/fonts/`
**And** no rule anywhere still references a deleted family.

**Given** a swap must not shift layout
**When** the faces load
**Then** `size-adjust`, `ascent-override` and `descent-override` from Story 1.12 keep the layout
stable across the swap, verified by observing a real swap rather than by reading the CSS.

**Given** the weight distinction must survive
**When** the display faces are applied
**Then** `--monument-regular` renders at `--f-display` + `--w-bold` and `--monument-bold` at
`--f-display` + `--w-black`, with the two visually distinct.

---

### Story 2.21: Migration step 6 — rename the call sites

As the Operator,
I want component stylesheets consuming the token roles directly,
So that the aliases become removable.

**Governing ADs:** AD-14, AD-20 · **Depends on:** Stories 2.18, 2.19, 2.20.
Realizes UX-DR13. Purely mechanical.

**Acceptance Criteria:**

**Given** fifteen component stylesheets consume the old alias names
**When** they are migrated
**Then** each moves from `var(--white-color)` to `var(--token-text)` and equivalents, per the
Story 1.18 mapping
**And** the work is done **per component, not in one commit**, so a visual regression is
attributable to one component.

**Given** the raw palette is not for consumption
**When** the renames land
**Then** every call site consumes a `--token-*` semantic role and none reaches for a `--c-*`
palette value directly.

**Given** `--hero-height` is a layout constant rather than a design token
**When** the sweep runs
**Then** it stays local and is not moved into the contract, because the contract carries no
viewport heights.

**Given** NFR-2 binds every step
**When** each component ships
**Then** the site renders unchanged apart from the deliberate token values already adopted.

---

### Story 2.22: Migration step 7 — delete the aliases

As the Operator,
I want the transitional layer gone,
So that the contract is the only source and there is nothing left to drift from.

**Governing ADs:** AD-14 · **Depends on:** Story 2.21.
Realizes UX-DR14 and completes the seven-step migration.

**Acceptance Criteria:**

**Given** the aliases introduced in Story 1.18 exist only to keep the fifteen component stylesheets
working during migration
**When** they are deleted from `app/app.scss`
**Then** `--white-color`, `--black-color`, `--light-gray-color`, `--gray-color`, `--page-padding`
and the five font aliases no longer exist
**And** a repository-wide search returns zero remaining references to any of them.

**Given** the contract is now the only source
**When** the site renders
**Then** it is visually identical to the pre-deletion build
**And** `:root` in the compiled stylesheet carries only the contract's properties plus
`--hero-height`.

**Given** FR-17 requires no colour, spacing or type value to bypass the contract for values it
covers
**When** the story closes
**Then** FR-17 is satisfied for all CSS-expressible styling, with seam S-1 the single declared
exception.

---

### Story 2.23: Scheduled Registry verification, external to the box

As the Operator,
I want a machine checking that the Registry still tells the truth,
So that an entry cannot assert something that stopped being true in an estate with no user to
discover it.

**Governing ADs:** AD-16, AD-18 · **Depends on:** Stories 1.2, 1.20, 2.5.
Realizes FR-32 and FR-28's detection half, and closes FR-19's "which Satellites are on which
version" consequence.

**Acceptance Criteria:**

**Given** AD-18 fixes what one job checks per entry
**When** the job runs
**Then** it verifies that `source` resolves for **every** entry including `Archived` ones
**And** that `live` resolves for every entry whose `status` is `Live`
**And** that each Satellite's vendored `cuatro-contracts/tokens.css` carries a
`Contract vX.Y.Z` header matching its `token_contract` value
**And** any failure notifies the Operator.

**Given** the token drift check depends on AD-14's fixed folder name
**When** a Satellite has renamed or moved the folder
**Then** the check **fails** rather than silently skipping — a Satellite that renames the folder
breaks the check rather than the styling, which is why the name is a rule.

**Given** a whole-box failure must still produce a notification
**When** the job's host is chosen
**Then** it runs **external to the VPS**
**And** this is verified by confirming the job's execution environment, not assumed from where it
was configured.

**Given** FR-28 requires honest degradation
**When** a `live` URL stops resolving
**Then** the recorded procedure is that the entry's `status` moves off `Live` and its `live` URL
is removed **in the same change**
**And** the schema gate from Story 2.3 enforces the second half mechanically, since `live` is
forbidden when `status` is `Archived`.

**Given** SM-4 targets 100% link resolution continuously
**When** the job reports
**Then** its result is recorded in a form the Operator can read historically, not only as a
transient notification.

---

### Story 2.24: Hub visitor instrumentation

As the Operator,
I want to see whether Visitors actually reach the suite,
So that SM-1 through SM-3 are measurable rather than aspirational.

**Governing ADs:** AD-18 · **Depends on:** Stories 2.9, 2.12.
Realizes FR-34. Umami is already self-hosted at `analytics.cuatro.dev` backed by Postgres.

**Acceptance Criteria:**

**Given** page views alone cannot distinguish "loaded the homepage" from "scrolled to the suite",
and that difference is the entire value of story-then-suite
**When** instrumentation is added
**Then** reaching the Suite Directory is a **distinguishable event** from loading the homepage
**And** opening a `live` link and opening a `source` link are distinguishable events from each
other
**And** all three are Umami custom events, per the spine's measurement convention.

**Given** NFR-8 forbids third-party measurement anywhere in the Ecosystem
**When** the events are wired
**Then** no third-party analytics service, tag manager, session recorder or tracking script is
introduced
**And** measurement stays first-party and self-hosted.

**Given** SM-1 targets ≥60% suite reach and SM-2 targets ≥35% click-through
**When** the events are verified
**Then** each fires exactly once per session where it should, checked against a real session
rather than assumed from the code
**And** the "reached the suite" event fires on both the default and the non-3D path, since the
non-3D path reaches the Directory in zero interactions.

**Given** SM-C1 says time on site must never be optimised
**When** the measurement is documented
**Then** the record states that a fall in time-on-site alongside a rise in SM-2 is a **good**
outcome.

---

### Story 2.25: Relocate `list-wheel` onto a `cuatro.dev` subdomain

As Daniela clicking through the suite,
I want every application to stay on the suite's domain,
So that the framing does not break at the exact moment it should hold.

**Governing ADs:** AD-3, AD-7, AD-9, AD-17c · **Depends on:** Stories 1.6, 1.7, 2.4, 2.5.
Realizes PRD §5.3. **This is the first genuinely new placement on the box**, so it is the first
consumer of the Capacity Gate.

**Acceptance Criteria:**

**Given** AD-9 fails new placement closed while `status: blocked`
**When** the deploy is attempted
**Then** it **fails** unless `ops/capacity-gate.yml` carries `status: open` with a written
threshold from Story 1.6
**And** once placed, `list-wheel` is added to the gate's `placements` log
**And** the gate check is confirmed to have actually run and passed, not merely to exist.

**Given** the artifact is assumed to be a static Angular build, since GitHub Pages serves only
static assets, and PRD §15 says the assumption should be verified rather than trusted
**When** the application is inspected
**Then** the assumption is confirmed or corrected before placement
**And** if it turns out to need a server-side runtime, it is re-gated under FR-33 like any other
application and this story records that rather than proceeding.

**Given** AD-3 and AD-7 fix the addressing
**When** it is deployed
**Then** it is reachable at the hostname Story 2.4 decided, on a `cuatro.dev` subdomain
**And** it has its own router matching on `Host` — `PathPrefix` routing between applications is
forbidden, because a shared browser origin would put cookies, `localStorage` and XSS blast radius
across the suite.

**Given** NFR-2 requires `list-wheel` to keep serving through its own relocation
**When** the move is performed
**Then** the GitHub Pages deployment stays live until the new hostname serves correctly
**And** the old URL redirects rather than dying, so an existing link does not break.

**Given** the Registry is the only hostname mapping
**When** the relocation completes
**Then** the `list-wheel` entry's `live` value is updated to the new hostname in the same change
**And** Story 2.23's verification job confirms it resolves.

---

### Story 2.26: The Hub's focus standard and the manual accessibility pass

As a keyboard user, and as every Satellite that will copy the Hub's focus behaviour by hand,
I want the reference standard set and the whole floor checked by a person,
So that the parts of the accessibility floor no automated assertion can reach are asserted rather
than claimed.

**Governing ADs:** AD-19, AD-21 · **Depends on:** Stories 2.9, 2.13, 2.15, 2.16, 2.17.
Closes the manual half of the accessibility floor. **The Hub sets the reference standard the
Satellites copy** — tokens carry the *colour* of a focus ring but cannot carry *when it appears*,
so this is the section that gets copied into every Satellite's hand-fix list.

**Acceptance Criteria:**

**Given** A-1 requires a visible focus indicator on every interactive element
**When** the focus rule is authored
**Then** it uses `:focus-visible`, never `:focus` — a mouse click on a link must not paint a ring
**And** it is `outline: 2px solid var(--token-focus)` at `3px` offset, applied **instantly** and
never transitioned, because a ring that fades in over 200ms leaves no indicator at the moment
focus lands
**And** `outline: none` appears nowhere without an equivalent replacement
**And** the ring is confirmed visible against all three grounds, and uses a **different token
from hover**, so a keyboard user can always tell focus from hover.

**Given** `EXPERIENCE.md` fixes verification as four manual checks, all cheap and sized for one
person
**When** the pass is run
**Then** keyboard-only traversal of the homepage completes in DOM order, with no positive
`tabindex` anywhere and focus never trapped — there are no modals on the Hub
**And** the 360px viewport shows no horizontal scroll and no truncated Status value
**And** the greyscale render from Story 2.10 is confirmed alongside it
**And** `prefers-reduced-motion` is forced and the Suite Directory remains fully reachable
**And** each of the four results is **recorded**, because a check that leaves no record cannot be
re-run against a regression.

**Given** A-11 and A-12 govern type
**When** the Hub is checked
**Then** body text is ≥14px with nothing below 11px
**And** type is sized in `rem` throughout and never in `px`, so prose respects the user's font
size
**And** UX-DR45's rules hold: a weight gap of ≥300 units between any two roles; line-heights at
display `0.95–1.0`, headings `1.1`, body `1.6`; body tracking never above `+0.05em`; the `46ch`
measure on descriptions and lede; prose never below `--t-sm` and nothing below `--t-3xs`
**And** uppercase is structural only — prose is never uppercase, and no gradient text, no
synthesised bold or italic, and no italic heading appears.

**Given** the hallmark anti-patterns are treated as a conformance floor rather than a suggestion
**When** the Hub is reviewed against them
**Then** none of the structurally excluded tells is present: no three-column icon-tile grid, no
card-in-card, no full-viewport centred hero, no shadow anywhere, no gradient anywhere, no aurora
or orb or glass layer, no four-column footer, no emoji used as an icon, no invented metric
**And** accent occupies **≤3% of the viewport**, measured on the rendered homepage rather than
inferred from the rules
**And** per UX-DR44 every `z-index` in the tree resolves to one of the six named levels — an
ad-hoc value is a defect, not a style choice.

**Given** A-16 governs autoplay
**When** the homepage loads
**Then** nothing autoplays with sound and nothing auto-advances.

---

## Epic 3: One repository, one deploy unit each — the Anchor merge and build in CI

Operator-facing and invisible to every Visitor in PRD §2.3, which is exactly why it sits after
Epic 2. The Estate drops from 11 repositories to 8, and the serving two-core box stops compiling.

Eight stories. **The merge order is fixed by AD-20 and is not negotiable**: the Hub moves to
`apps/hub` as its own shipped step with nothing else changing, then `cuatro-finance`, then
`cuatro-tracker`, then `cs-tournament` — one shipped and verified step each.

**A contradiction inside the spine, resolved here.** The Capability → Architecture Map assigns
`.github/workflows` → `contracts/workflows` to Epic 3, and the Structural Seed shows
`contracts/workflows/` existing. But the spine's own § Deferred bundles "published reusable
workflows" into the Epic 6 machinery, and addendum §E names an explicit trigger — the same
workflow copy-pasted into a third repository. **This breakdown takes the Deferred list's side:**
Epic 3 builds the workflows in `.github/workflows`, and publishing them to `contracts/workflows/`
stays Epic 6, earned rather than scheduled.

**What this epic does not do.** Merging an application into the Anchor is not the same as placing
it on the box. Each merge story ends with the application merged, building in CI and its image in
GHCR. **Placement remains separately gated by AD-9**, because a merge is free and a running
container is not.

### Story 3.1: Introduce Turborepo and pin the toolchain

As the Operator,
I want the workspace boundary that Epic 3 depends on established before anything moves,
So that the Hub's move is a move and not a move plus a build-system introduction.

**Governing ADs:** AD-2, AD-7, AD-8, AD-21 · **Depends on:** Story 1.11 (which added the
`packages:` key for `packages/tokens`)

**Acceptance Criteria:**

**Given** `turbo` is not a dependency and no `turbo.json` exists
**When** Turborepo is introduced
**Then** `turbo` is a devDependency at the 2.10.x stack version and `turbo.json` defines the
`build`, `test`, `typecheck` and `lint` pipelines
**And** the existing single application still builds, tests and typechecks through Turborepo with
identical results.

**Given** AD-2 makes Turborepo govern JS/TS only
**When** the pipelines are defined
**Then** nothing in `turbo.json` orchestrates Elixir, Go, Python or Solidity
**And** the configuration expresses that `apps/*` may depend on `packages/*` and that no
Satellite may depend on any `packages/*` artifact.

**Given** AD-8 requires `turbo prune --docker` as the Docker build context for Anchor
applications
**When** Turborepo is configured
**Then** `turbo prune --docker` runs successfully against the current workspace and produces a
pruned tree containing the lockfile and the workspace links
**And** this is verified now, while there is one application, rather than discovered during a
merge.

**Given** the stack targets Node 24 LTS while `ci.yml` and `lighthouse.yml` both pin
`node-version: 22`, which has been maintenance-only since 2025-10-21
**When** the workflows are updated
**Then** both pin Node 24
**And** the application builds and all existing gates pass on 24 before the pin is committed.

**Given** AD-21 makes every CI gate blocking
**When** the pipelines run in CI
**Then** typecheck, unit tests, the Registry schema gate and the `contracts/` purity gate all
still run and still fail the build on breach.

---

### Story 3.2: Move the Hub to `apps/hub`

As the Operator,
I want the Hub relocated with nothing else changing,
So that if the flagship breaks, the cause is a path rewrite and cannot also be a history merge.

**Governing ADs:** AD-2, AD-7, AD-20, AD-21 · **Depends on:** Story 3.1.
**AD-20 fixes this as its own shipped step.** It rewrites `ci.yml`, `lighthouse.yml`,
`deploy.yml`, `docker/Dockerfile`, `tsconfig.json` and `vitest.config.ts` — **and nothing more**.

**Acceptance Criteria:**

**Given** the Hub is at the repository root today
**When** it moves
**Then** `app/`, `components/`, `content/`, `hooks/`, `public/` and the Hub's own configuration
land under `apps/hub/`
**And** `contracts/`, `packages/`, `ops/`, `turbo.json` and `pnpm-workspace.yaml` stay at the
repository root, because they are not the Hub
**And** `git log --follow` works from the new paths afterwards.

**Given** AD-20 names exactly six files as the permitted rewrite surface
**When** the change is reviewed
**Then** `ci.yml`, `lighthouse.yml`, `deploy.yml`, `docker/Dockerfile`, `tsconfig.json` and
`vitest.config.ts` are updated for the new paths
**And** **no other behavioural change ships in this commit** — no product change, no dependency
change, no refactor taken along the way.

**Given** Story 1.10 added the Playwright job, Story 2.8 the hit-target assertions and Story 2.3
the Registry schema gate, all to `ci.yml`
**When** `ci.yml` is rewritten
**Then** both are carried across intact and still blocking, not rediscovered later
**And** `.lighthouserc.js` still asserts accessibility at ≥0.95 severity `error`.

**Given** Story 1.17 wired the Anchor to `@use` `contracts/` directly rather than vendoring a copy
**When** the stylesheet graph moves
**Then** the reference from `apps/hub` to root-level `contracts/` still resolves
**And** there is still exactly one authored copy of the contract files.

**Given** NFR-2 and AD-20 require the flagship to serve throughout
**When** the move ships
**Then** `cuatro.dev` serves before, during and after
**And** every route still renders — `/`, `/cv`, `/work`, `/recommendation`, `/celeste`,
`/api/health`, and the `/projects` redirect
**And** `https://cuatro.dev/contracts/` still serves the published surface.

---

### Story 3.3: Build the Hub image in CI and push to GHCR

As the Operator,
I want images built by GitHub Actions rather than by the serving box,
So that the estate's top unmeasured risk stops being a thing the box does on every deploy.

**Governing ADs:** AD-3, AD-7, AD-8 · **Depends on:** Story 3.2

**Acceptance Criteria:**

**Given** AD-3 derives the image name mechanically from the application id
**When** the image is published
**Then** it is `ghcr.io/luigiespinosa/hub` tagged with the **git sha**
**And** no estate application ever runs a floating tag.

**Given** AD-8 fixes the build context for applications inside the Anchor
**When** the image is built
**Then** the context is the **repository root narrowed by `turbo prune --docker`**, with the
Dockerfile at `apps/hub/Dockerfile`
**And** an app-directory context is confirmed to fail — it cannot see the lockfile or the
workspace links — so the pruned context is demonstrably necessary rather than merely chosen
**And** the resulting image does not contain the whole monorepo.

**Given** AD-7 makes a deploy name exactly one id
**When** the workflow is written
**Then** the build is scoped to one workspace through Turborepo, not to the whole tree.

**Given** `docker-rollout` requires real healthchecks and services with no `container_name` and no
published `ports`
**When** the compose service is prepared
**Then** the `hub` service defines a real healthcheck against `/api/health` that fails when the
application is not serving
**And** it declares no `container_name` and publishes no ports, both of which are already true
behind the proxy and are now requirements rather than accidents
**And** the healthcheck is demonstrated failing against a deliberately broken container.

**Given** the box compiles today, recorded as a standing violation in Story 1.9
**When** this story closes
**Then** an image exists in GHCR built entirely in CI, with no compilation having occurred on the
VPS.

---

### Story 3.4: Deploy by pulling a tag with `docker-rollout`

As the Operator,
I want deployment to pull an image and roll it, never to build,
So that AD-8's standing violation is retired rather than tolerated.

**Governing ADs:** AD-8, AD-9, AD-20, AD-23 · **Depends on:** Story 3.3.
**Closes forced change C-8** and the tracked item Story 1.9 opened.

**Acceptance Criteria:**

**Given** `.github/workflows/deploy.yml` runs `docker compose --env-file .env.production up
--build -d` over SSH, with its step named "Deploy to Hetzner"
**When** it is rewritten
**Then** deployment pulls the git-sha tag from GHCR and runs `docker-rollout` at the v0.14 stack
version
**And** it **never runs a build** — no `--build` flag and no compile step reaches the box
**And** the misleading step name is corrected, since the box is Hostinger.

**Given** AD-9 makes the Capacity Gate a mechanical check inside the deploy path
**When** the workflow runs
**Then** it reads `ops/capacity-gate.yml` and fails when the named id is absent from `placements`
while `status` is `blocked`
**And** an id already in `placements` deploys regardless of gate status, because AD-9 requires
existing ids to always deploy so NFR-2 is never traded against the gate.

**Given** `docker-rollout` is scale-then-drain, so old and new containers overlap by construction
**When** a rollout runs
**Then** the previous container keeps serving until the new one is healthy
**And** `cuatro.dev` serves continuously across a rollout, verified by requesting it throughout
one rather than by trusting the mechanism.

**Given** AD-23 forbids migrations on container boot
**When** the deploy path is written
**Then** any schema migration runs as a **discrete step before the rollout starts**, against the
application's own database, never on boot
**And** the Hub owns no schema today, so this is established as the shape the later merges
inherit rather than exercised here.

**Given** Story 1.9 recorded the violation as tolerated until Epic 3
**When** this story closes
**Then** `ops/known-violations.md` records it as closed with an ISO 8601 UTC date, rather than
having the entry silently deleted.

---

### Story 3.5: Merge `cuatro-finance` into `apps/finance`

As the Operator,
I want the finance application inside the Anchor with its history intact,
So that the Estate shrinks without the code losing its past.

**Governing ADs:** AD-2, AD-3, AD-7, AD-8, AD-20, AD-23 · **Depends on:** Story 3.4.
First of AD-20's three merges, in fixed order.

**Acceptance Criteria:**

**Given** AD-20 fixes the merge mechanism
**When** the merge is performed
**Then** `git filter-repo --to-subdirectory-filter apps/finance` runs on a **scratch clone** of
the source repository, never on the source itself
**And** `git merge --allow-unrelated-histories` brings it into the Anchor
**And** `git log --follow` works from `apps/finance/` afterwards, verified on a real file.

**Given** `cuatro-finance` is Next.js + Prisma + Tailwind and AD-14 makes it a Tailwind consumer
**When** it lands in the workspace
**Then** it builds through Turborepo scoped to its own workspace
**And** its Tailwind setup imports `contracts/tailwind.css`, or the story records explicitly that
token adoption is deferred to a later change rather than half-applied — AD-14 makes adoption
all-or-nothing.

**Given** AD-3 derives everything from one id
**When** the deploy unit is defined
**Then** the image is `ghcr.io/luigiespinosa/finance` tagged with the git sha, built from a root
context narrowed by `turbo prune --docker` with the Dockerfile at `apps/finance/Dockerfile`
**And** it has one compose service and, later, one router — never a `PathPrefix` share with
another application.

**Given** Prisma defaults to running migrations on boot in several deployment recipes
**When** the application is prepared
**Then** **migrate-on-boot is explicitly disabled**, per AD-23
**And** migrations run as a discrete step against the `finance` database before any rollout
**And** each migration is backward-compatible with the version still serving — expand first,
contract in a later release, never both in one.

**Given** AD-10 gives each Postgres consumer one database and one role
**When** its data layer is defined
**Then** it uses database and role `finance`, never a schema inside another application's
database
**And** it sets an explicit `connection_limit`, with the estate's sum staying under
`max_connections`.

**Given** merging is not placing
**When** the story closes
**Then** the application is merged, building in CI and its image is in GHCR
**And** whether it runs on the box is a separate decision gated by AD-9, and the story says so
rather than deploying it.

**Given** NFR-2 binds every step
**When** the merge ships
**Then** `cuatro.dev` and the three other live subdomains serve throughout, and the Hub's build
is unaffected.

---

### Story 3.6: Merge `cuatro-tracker` into `apps/tracker`

As the Operator,
I want the tracker inside the Anchor without its live subdomain ever going dark,
So that a merge of a running application costs nothing to the one person using it.

**Governing ADs:** AD-2, AD-3, AD-7, AD-8, AD-20, AD-23 · **Depends on:** Story 3.5.
Second of AD-20's three merges. **This one is live at `tracker.cuatro.dev`**, which makes it the
riskiest of the three.

**Acceptance Criteria:**

**Given** AD-20 fixes the merge mechanism
**When** the merge is performed
**Then** `git filter-repo --to-subdirectory-filter apps/tracker` runs on a scratch clone, then
`git merge --allow-unrelated-histories`
**And** `git log --follow` works from `apps/tracker/` afterwards.

**Given** `tracker.cuatro.dev` is live and serving today
**When** the deploy unit changes from whatever serves it now to a GHCR image rolled by
`docker-rollout`
**Then** the cutover keeps `tracker.cuatro.dev` serving throughout, verified by requesting it
across the cutover
**And** Story 1.7's routing inventory is the reference for how it reaches the box today, so the
cutover is not a rediscovery
**And** if the inventory turns out to be wrong or incomplete, that is recorded as a finding
against Story 1.7 rather than worked around silently.

**Given** AD-3 derives everything from one id, and the hostname is declared not derived
**When** the deploy unit is defined
**Then** the image is `ghcr.io/luigiespinosa/tracker` tagged with the git sha
**And** `tracker.cuatro.dev` stays the declared hostname in the Registry, which remains the only
mapping.

**Given** the application owns data the Operator actually uses
**When** the cutover is planned
**Then** its data is backed up and the restore verified **before** the cutover, not after
**And** AD-23's migration discipline applies: discrete step before rollout, backward-compatible
with the version still serving, never on boot.

**Given** `cuatro-tracker` is `Live` in the Registry and is a Tracker Family member
**When** the merge completes
**Then** its Registry entry's `source` still resolves — to the Anchor if the source repository is
archived, per AD-6's rule that an absorbed application keeps its entry
**And** Story 2.23's verification job confirms both `source` and `live` still resolve.

---

### Story 3.7: Merge `cs-tournament` into `apps/tournament` and leave Vercel

As the Operator,
I want the tournament manager off external hosting and inside the Anchor,
So that the Estate reaches its end state and no suite member depends on a platform outside it.

**Governing ADs:** AD-2, AD-3, AD-7, AD-8, AD-9, AD-20, AD-23 · **Depends on:** Stories 1.6, 3.6.
Third and last of AD-20's merges. **Placing it on the box is a new placement**, so AD-9 binds.

**Acceptance Criteria:**

**Given** AD-20 fixes the merge mechanism
**When** the merge is performed
**Then** `git filter-repo --to-subdirectory-filter apps/tournament` runs on a scratch clone, then
`git merge --allow-unrelated-histories`, with `git log --follow` working afterwards.

**Given** the Structural Seed records a **separate Go worker service** alongside the Next.js
application
**When** the merge lands
**Then** the Go worker is merged too and is defined as its own deploy unit with its own id, image
and compose service — AD-7 gives one deploy unit per application, not per repository
**And** AD-2 holds: Turborepo governs the JS/TS side only and is not asked to orchestrate Go.

**Given** `cs-tournament` has existing users with bcrypt password hashes
**When** it moves off Vercel
**Then** those hashes are exported and mapped so **no user is forced through a password reset**
**And** the migration is verified by authenticating as an existing user after the move, not by
inspecting the hash table.

**Given** AD-9 fails new placement closed
**When** the application is placed on the box
**Then** the deploy fails unless `ops/capacity-gate.yml` carries `status: open`
**And** on success the id is appended to `placements`
**And** the load reading after placement is recorded against the threshold, because SM-C4 wins
every conflict with any other metric.

**Given** the hostname for `cs-tournament` is left open by the spine
**When** it is placed
**Then** the chosen hostname is declared in its Registry entry, which is the only mapping
**And** its Status and `live` value are updated in the same change, per FR-28's rule that the
Registry never presents a URL that does not resolve.

**Given** Vercel must not be turned off before the replacement serves
**When** the cutover runs
**Then** the Vercel deployment stays live until the new hostname serves correctly, and only then
is it retired.

---

### Story 3.8: Record the Estate end state

As the Operator,
I want the eight-repository end state written down against the fifteen it started from,
So that SM-7 has a closing value and the merge epic has a verifiable finish.

**Governing ADs:** AD-6 · **Depends on:** Story 3.7

**Acceptance Criteria:**

**Given** PRD §5 fixes the end state at the Anchor plus seven Satellites
**When** `ops/estate.md` is updated
**Then** it records the repository count as **8** with an ISO 8601 UTC date
**And** the seven Satellites are named: `cs-tracker`, `digital-library`, `StreamVault`,
`MaiCoin`, `poketracker-go`, `Mutuo`, `list-wheel`
**And** the sequence 15 → 11 → 8 is recorded with its dates, so a later reader cannot mistake a
waypoint for a destination.

**Given** AD-6 keeps absorbed applications in the Registry
**When** the merged repositories are dispositioned
**Then** `cuatro-finance`, `cuatro-tracker` and `cs-tournament` keep Registry entries with
`absorbed_into: cuatro-portfolio` if their source repositories are archived
**And** each `source` link still resolves to where the code now lives, verified by Story 2.23's
job
**And** the Registry entry count and the repository count remain deliberately different numbers.

**Given** SM-C2 counts Registry entry count as a metric **not** to optimise
**When** the record is written
**Then** it states that the Estate is shrinking on purpose and that more entries is not better.

---

# Epics 4–7 — coarse

Story titles, goals, governing ADs and dependencies. **Acceptance intent** replaces acceptance
criteria: the conditions that must hold, stated well enough to size and sequence the work, but
short of the testable Given/When/Then that Epics 1–3 carry.

This is deliberate. AD-22 forces a bounded refresh check before Epic 4's first story opens, and
writing acceptance criteria now against Traefik, PostgreSQL, restic, `docker-rollout` and Clerk
decisions that must be re-verified would be inventing detail that expires. **These epics need an
AC pass before `bmad-sprint-planning` can gate them, and it is correct for sprint planning to
report them as not-ready.**

---

## Epic 4: Greenfield VPS rebuild

Traefik, one Postgres, `docker-rollout`, and four live subdomains that serve throughout.

**Governing ADs:** AD-7, AD-8, AD-10, AD-20, AD-22, AD-23
**Blocked by:** Story 1.7 (the routing inventory — the rebuild must preserve four subdomains it
cannot enumerate from source) and Epic 3 (a host that pulls images requires images to exist).

**⚠ An ambiguity no input document settles.** Research calls this a "greenfield rebuild… cheap
because nothing has real users and you have said the box may be wiped," and specifies migrating
one subdomain at a time. But NFR-2 keeps four subdomains live throughout, and one-at-a-time
migration with everything serving implies parallel capacity — a temporary second VPS with a
marginal cost against NFR-4, or a parallel proxy on a 2 vCPU box whose load average SM-C4 says
wins every conflict. **Story 4.1 decides this; it is not assumed here.**

### Story 4.1: Refresh the settled inputs and choose the rebuild topology
Re-verify exactly AD-22's bounded list — Traefik, PostgreSQL, restic and `docker-rollout`
versions, Clerk and Railway pricing, the Style Dictionary security floor, the Let's Encrypt
lifetime schedule — and decide whether the rebuild runs on a temporary second box or in place.
**Depends on:** none within the epic.
**Acceptance intent:** the refresh covers that list and nothing outside it; no decision is
re-litigated merely because time passed; the topology choice is recorded with its cost against
NFR-4 and its load implication against SM-C4; PostgreSQL 18 versus 19 is decided here, since 19
was expected GA in September 2026.

### Story 4.2: Traefik with Host-matched routers and DNS-01
Stand up Traefik v3.7 as the estate's proxy, with certificate issuance over DNS-01.
**Depends on:** 4.1.
**Acceptance intent:** every router matches on `Host` and `PathPrefix` routing between
applications does not exist; the Traefik dashboard is not publicly reachable without
authentication; certificate issuance and renewal are proven, and Story 1.2's certificate-age
monitoring sees the new certificates.

### Story 4.3: Migrate `list-wheel` — the static first candidate
Move the estate's only application with no server-side component onto the new proxy.
**Depends on:** 4.2, Story 2.25.
**Acceptance intent:** addendum §G names this the natural first candidate precisely because it
verifies static serving without an application runtime in the way; the hostname keeps serving
across the move.

### Story 4.4: One Postgres, one database and one role per consumer
Stand up the estate's single Postgres instance and migrate each consumer onto its own database.
**Depends on:** 4.2.
**Acceptance intent:** one database and one role per application, never schema-per-app; each
application sets an explicit `connection_limit` and the sum stays under `max_connections`; no
PgBouncer, which solves serverless burst rather than long-lived containers; AD-23's discipline
governs every migration — discrete step before rollout, backward-compatible with the version
still serving, never on boot.

### Story 4.5: `pg_dump` on cron plus restic offsite
Establish the estate's backup path and prove it by restoring.
**Depends on:** 4.4.
**Acceptance intent:** backups are verified by a real restore, not by the job exiting zero;
`digital-library`'s separate offsite path from Story 1.8 is carried onto the rebuilt box
unchanged, since `pg_dump` covers none of its data; point-in-time recovery stays deferred until a
loss window `pg_dump` frequency cannot cover.

### Story 4.6: Migrate `cuatro.dev`
Move the flagship onto the new proxy.
**Depends on:** 4.2, 4.4.
**Acceptance intent:** `https://cuatro.dev/contracts/` still serves the published surface, since
Satellites fetch it at build time; Story 1.16's serving mechanism is revisited here if Traefik
should serve `contracts/` directly rather than the interim mechanism.

### Story 4.7: Migrate `analytics.cuatro.dev` and pin Umami
Move the analytics instance and retire the estate's one inherited floating tag.
**Depends on:** 4.4, 4.6.
**Acceptance intent:** `ghcr.io/umami-software/umami:postgresql-latest` is pinned, per the
spine's rule that third-party infrastructure images are pinned to a major at minimum; Story
2.24's custom events survive the move, since SM-1 through SM-3 depend on them.

### Story 4.8: Migrate `tracker.cuatro.dev`
**Depends on:** 4.4, 4.6.
**Acceptance intent:** data backed up and the restore verified before cutover; the subdomain
serves throughout.

### Story 4.9: Migrate `library.cuatro.dev`
Move `digital-library`, the estate's declared AD-10 exception.
**Depends on:** 4.5.
**Acceptance intent:** SQLite and Redis move with their data intact and their offsite backup path
still working after the move; the store stays declared in the Registry's `tech` array.

### Story 4.10: Migrate `cs-tracker.cuatro.dev`
**Depends on:** 4.4, 4.6.
**Acceptance intent:** the vendored `cuatro-contracts/` folder survives the move so Story 2.23's
token drift check still resolves; the subdomain serves throughout.

### Story 4.11: Retire Caddy and decommission the old topology
Remove the incumbent proxy and whatever undocumented configuration Story 1.7 found.
**Depends on:** 4.3, 4.6, 4.7, 4.8, 4.9, 4.10.
**Acceptance intent:** every hostname in `ops/routing-inventory.md` is accounted for on the new
topology before anything is removed; nothing found on the old box is deleted without being either
recreated or explicitly recorded as intentionally dropped; the inventory is updated to describe
the new reality rather than left describing the old one.

---

## Epic 5: One login, and a Visitor who can use the real thing

Cuatro signs in once across his own tools. One identity demonstrably crosses the
JavaScript/Elixir boundary. A Visitor uses real software without registering.

**FRs covered:** FR-20, FR-21, FR-22, FR-23, FR-24 *(behaviour)*, FR-25, FR-26, FR-27 *(accuracy)*
**Governing ADs:** AD-11, AD-12, AD-13, AD-18, AD-22, AD-23
**Blocked by:** Epic 4. Demo Access is additionally gated by AD-9.

### Story 5.1: Refresh Clerk's pricing and terms
**Depends on:** none within the epic.
**Acceptance intent:** AD-22's bounded scope only; the recurring cost is recorded as a named
decision against the NFR-4 ceiling, not absorbed as an incidental subscription.

### Story 5.2: One Clerk issuer and one OIDC client per application
**Depends on:** 5.1.
**Acceptance intent:** client ids are derived mechanically from the application id per AD-3;
credentials live in GitHub Actions secrets and the on-box env file, never in a repository;
`.env.example` documents every required variable.

### Story 5.3: The Hub authenticates over OIDC Authorization Code + PKCE
**Depends on:** 5.2.
**Acceptance intent:** the Hub mints its own host-only `__Host-` session; **no `Domain=.cuatro.dev`
cookie exists anywhere in the estate**, because a domain-scoped cookie forfeits `__Host-`
hardening across every application and lets any one subdomain set a session its siblings accept.

### Story 5.4: `cs-tracker` authenticates — the JavaScript/Elixir boundary
**Depends on:** 5.3.
**Acceptance intent:** this pair is FR-21's acceptance condition and SM-9's binary; the identity
is observed carrying across the boundary by a person, not inferred from configuration; `oidcc`
3.8.0 is the Elixir client.

### Story 5.5: Sign-out reaches every session, including open LiveView sockets
**Depends on:** 5.4.
**Acceptance intent:** RP-Initiated plus Back-Channel logout, and `cs-tracker` **additionally
broadcasts on `live_socket_id`** — without it an open LiveView socket never observes the logout;
verified against a socket that is already open at sign-out time, which is the case FR-22 names
specifically.

### Story 5.6: ForwardAuth gates the surfaces with no authentication of their own
**Depends on:** 5.2, Story 4.2.
**Acceptance intent:** Traefik ForwardAuth covers the Traefik dashboard and admin surfaces only,
and is **never** an application's identity path; AD-11 is explicit that it is not the primary
architecture.

### Story 5.7: Provider replaceability is evidenced, not asserted
**Depends on:** 5.4.
**Acceptance intent:** FR-23 says substituting the provider is a configuration change; no
participating application contains provider-specific logic beyond issuer configuration and client
credentials, and this is demonstrated by pointing an application at a different issuer rather
than by reading the code.

### Story 5.8: The demo principal contract
**Depends on:** 5.3.
**Acceptance intent:** `demo@cuatro.dev` in every application, derived rather than invented per
stack, owning every demo row; demo data and Operator data are never in the same ownership scope;
the principal cannot be deleted and its credentials cannot be changed from inside the application.

### Story 5.9: `demo:reset` and a baseline fixture, per application
**Depends on:** 5.8.
**Acceptance intent:** each application exposes an **idempotent** reset that deletes by owner and
reseeds a baseline fixture committed in that application's own repository; one story per
participating application, since five stacks would otherwise invent five reset semantics.

### Story 5.10: One host-level reset scheduler for the estate
**Depends on:** 5.9.
**Acceptance intent:** scheduled **on the host, outside the application containers** — an
in-process scheduler per application would keep a timer alive in every container on a CPU-bound
box; hourly by default with per-application override; the interval is short enough that two
Visitors arriving the same day both find a usable application.

### Story 5.11: Demo and identity declarations verified against reality
**Depends on:** 5.9, Story 2.23.
**Acceptance intent:** every `demo` declaration authored in Story 2.5 is now accurate — an entry
claiming a Demo Account has a working one; `MaiCoin` remains declared `wallet` and structurally
exempt rather than unimplemented; FR-28's release valve applies if capacity forces an application
offline.

---

## Epic 6: Token distribution machinery — deferred, earned

npm package, Renovate shareable preset, published reusable workflows. The published *shape* is
already fixed by AD-14 and AD-16, so nothing blocks later.

**FRs covered:** FR-19 *(machinery half)*
**Governing ADs:** AD-14, AD-16, AD-22
**Trigger:** three hand-copied token changes actually performed. **Not scheduled.**

### Story 6.1: Confirm the trigger has fired
**Acceptance intent:** three real hand-copied token changes are recorded, with dates; if fewer
than three, the epic does not open and that is the correct outcome — the mechanism is earned by
frequency, not by intent.

### Story 6.2: Publish the token contract as an npm package
**Depends on:** 6.1.
**Acceptance intent:** the package is a convenience for JS consumers only; the `cuatro-contracts/`
folder and the published `contracts/` URL remain the contract for everyone else, because a
package cannot serve an Elixir or Go consumer.

### Story 6.3: A Renovate shareable preset
**Depends on:** 6.2.
**Acceptance intent:** NFR-10 still binds — **no automerge in any repository lacking a real test
suite**; Renovate opens pull requests and the Operator merges them.

### Story 6.4: Publish the reusable CI workflows to `contracts/workflows/`
**Depends on:** 6.1.
**Acceptance intent:** addendum §E's trigger is the same workflow copy-pasted into a **third**
repository; AD-1 holds — nothing under `contracts/` may be executable, and a workflow YAML
definition is a reference, not code the Anchor runs on a consumer's behalf. *(See Epic 3's note:
the Capability Map assigns this row to Epic 3, and this breakdown places it here on the strength
of the spine's § Deferred list and addendum §E.)*

---

## Epic 7: WSL2 relocation

Developer machine only. No ecosystem invariant depends on it, and it is independent of every
other epic — it can run at any point, including first.

**FRs covered:** none. Operator ergonomics.
**Governing ADs:** none — the spine records no invariant here.

### Story 7.1: Copy the repositories into the WSL2 ext4 filesystem
**Acceptance intent:** **copy first, delete only after verification** — the ordering is the whole
risk control; every repository is confirmed to build and its git history intact in the new
location before anything is removed from `C:\`.

### Story 7.2: Repair worktrees and Git configuration
**Depends on:** 7.1.
**Acceptance intent:** `git worktree repair` is run where worktrees exist; `safe.directory` and
`core.longpaths` are expected to need setting and are handled rather than discovered; no
repository is left in a state where a routine git operation fails.
