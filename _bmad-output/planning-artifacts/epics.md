---
stepsCompleted: [1, 2, 3, 4]
status: final
inputDocuments:
  - _bmad-output/planning-artifacts/architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/prds/prd-cuatro-portfolio-2026-08-15/prd.md
  - _bmad-output/planning-artifacts/prds/prd-cuatro-portfolio-2026-08-15/addendum.md
  - _bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/RESTYLE-SPEC.md
  - _bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/review-independent-implementation.md
  - _bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/review-restyle-token-contract.md
  - _bmad-output/planning-artifacts/research/technical-cuatro-ecosystem-architecture-2026-08-15/research.md
  - _bmad-output/planning-artifacts/ecosystem-epics-prompt.md
  - _bmad-output/planning-artifacts/ecosystem-epics-restyle-prompt.md
amendments:
  - date: 2026-08-15
    change: 'Restyle scope change. Deletes Stories 2.18 and 2.21, replaces 2.19 with 2.34, retargets 2.20 and 2.22, adds Stories 2.27 to 2.34 and Epic 8.'
    source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-15.md
  - date: 2026-08-15
    change: >-
      Restyle acceptance-criteria pass, after RESTYLE-SPEC.md landed. Corrects Story 2.28 (the role
      ships in Contract v1.0.0 and is consumed, not added; no version bump) and Story 1.11 (twelve
      palette values and twelve roles, not eleven). Writes full acceptance criteria for Stories 2.27
      to 2.34 and 8.1 to 8.6. Restates Epic 6 trigger; recovers the AD-16 rehearsal in Story 1.20.
      Places O-13, O-14, O-15 and O-17; closes O-16. Sweeps every live v1.1.0 reference.
    source: _bmad-output/planning-artifacts/ecosystem-epics-restyle-prompt.md
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

**Four forced changes are already applied below**: the requirements inventory records the
*corrected* FRs, not the originals. See § Forced Changes Applied.

---

## Requirements Inventory

### Functional Requirements

Source: `prd.md` §4, as corrected by `ARCHITECTURE-SPINE.md` § Contradictions and Forced
Changes. FR IDs are global and stable, not positional: FR-35 sits beside FR-5 because it
modifies it.

**§4.1 The Hub Front Door**

- **FR-1**: Narrative resolves into the Suite Directory as the terminal section of the primary
  scroll, no click and no route change. `/cv`, `/work`, `/recommendation`, `/celeste` remain
  reachable and functional. Nothing follows the Directory except footer content.
- **FR-2**: The Suite is reachable without the narrative: a stable in-page anchor or route
  resolves straight to it; it renders and is fully usable when the 3D narrative fails, is
  blocked, or is disabled by reduced-motion; at most one interaction from a cold arrival with no
  intervening scroll requirement.
- **FR-3**: The Suite Directory is legible at 360px: every rendered entry's name, description,
  Status and `tech` readable without horizontal scrolling; Status never truncates; the live link
  and source link are independently addressable tap targets.
- **FR-4**: The Hub declares what the Ecosystem is: one statement of the premise, at most three
  sentences, encountered before or with the Suite Directory, parseable by a reader who cannot
  name a single framework involved.

**§4.2 The App Registry**

- **FR-5**: The App Registry is exhaustive: exactly one Registry Entry per application in the
  Estate, including Archived and unbuilt ones. Archived applications appear as entries with
  Status `Archived`, not by omission. Exhaustiveness is a property of the Registry (the data),
  not of the Suite Directory (its rendering): see FR-35.
  **[CORRECTED: C-3 / AD-6]** The Registry's unit is the **application**, not the repository.
  An archived or absorbed application keeps its entry. Registry entry count and the
  eight-repository Estate count are deliberately different numbers, and neither validates the
  other. *(This replaces the original third consequence bullet, "No Registry Entry exists for an
  application not in the Estate.")*
- **FR-35**: The Suite Directory renders a curated subset: at MVP only entries with Status
  `Live` or `Complete`. The filter is a declarative rule over Status, never a hand-maintained
  second list: changing an entry's Status to `Live` makes it appear with no other edit. The
  Registry stays complete behind it for link verification (FR-32), the Estate record (§5) and
  any consumer wanting the full picture.
- **FR-6**: The Registry Entry contract. Downstream consumers may rely on field presence.
  Validation failure fails the build; a malformed entry cannot ship. `source` is required on
  every entry without exception. `live` is required when `status` is `Live` and forbidden when
  `status` is `Archived`.
  **[CORRECTED: C-4, C-5 / AD-5, AD-12, AD-16]** Required on every entry: `id`, `name`,
  `description`, `status`, `tech[]`, `source`, **`demo`**, **`identity`**. Optional: `live`,
  `family`, `absorbed_into`, `token_contract`. `demo` and `identity` are **required with an
  explicit value including `none`**: an absent field is never a permitted way to say "not
  applicable". `identity` takes exactly one of `oidc`, `wallet`, `none`. `token_contract`
  records the Satellite's adopted contract version and is what makes AD-18's scheduled drift
  check possible. The envelope carries `contract_version`.
- **FR-7**: The Status taxonomy: exactly `Live`, `Complete`, `In progress`, `Archived`, each
  with a fixed meaning inferable without a legend. No fifth value passes validation. The Hub
  renders Status as a visually distinct element on every entry, never buried in description
  prose.
- **FR-8**: Editorial voice of `description`: written for Daniela not Marcus, what the
  application does *for a person*; one to three sentences, never four; plain declarative voice,
  no superlatives, no marketing adjectives, no first person; leads with the thing itself.
- **FR-9**: The `tech` array reflects what the application runs on today. The
  `digital-library` entry's stale value is corrected before the Registry ships. An inaccurate
  entry is a defect, not a cosmetic issue.
  **[NARROWED: C-1]** The only stale value is `Hetzner VPS`. `content/projects.ts:23` already
  lists `SQLite` correctly; the broader "runs on SQLite not Postgres" claim from the UX
  validation report does not carry forward.
- **FR-10**: Every entry drills through to source in one interaction. The `source` link
  resolves to the repository, not the maintainer's profile. Present and functional on every
  entry including `Archived`. Direction of travel is Hub → repository.
- **FR-11**: The Tracker Family is grouped and explained: `cuatro-tracker`, `cs-tracker` and
  `poketracker-go` share a `family` value; the Directory renders whichever members pass the
  FR-35 filter as a labelled group; the group carries a one-line framing statement that holds
  regardless of member count and names no count. `tcg-tracker` appears as `Archived` with
  `absorbed_into: cuatro-tracker`, not as a family member.
- **FR-12**: The Registry is published as a consumable contract: retrievable by a Satellite in
  Elixir, Go, Python, Svelte, Vue or Angular without importing JavaScript from the Anchor; the
  published shape is versioned so a consumer can detect a change; the Hub consumes the same
  published Registry it publishes, with no private second copy.
  **[CORRECTED: C-6 / AD-4]** `content/projects.ts` is **retired, not promoted**.
  `contracts/registry.json` is hand-authored JSON validated by `contracts/registry.schema.json`
  in CI. A TypeScript module cannot satisfy FR-12 for an Elixir or Go consumer, and an emitted
  copy would give the Hub a second representation to drift from.

**§4.3 The Suite Switcher** *(v2: deferred from MVP, PRD §9.2)*

- **FR-13**: Discovering the Ecosystem from inside a Satellite: the switcher is present in
  every `Live` application; it lists entries drawn from the published Registry, never a
  hardcoded per-app list; it applies the same Status filter as the Suite Directory; each listed
  application is one interaction away; adding a Registry entry makes it appear in every switcher
  with no per-application code change.
- **FR-14**: The switcher reads as siblings, not tabs: selecting an application performs a full
  navigation to that application's own origin; no implication of shared state, shared history or
  a common shell; the Hub is present and distinguishable from the applications.
- **FR-15**: The switcher is cheap for a Satellite to adopt: consuming the published Registry
  plus the Design Tokens plus framework-native rendering. No Satellite imports a component
  package from the Anchor.

**§4.4 Shared Visual Identity**

- **FR-16**: One token contract, consumable by every framework in the Estate: Next.js,
  React/Vite, Svelte, Vue, Angular and Phoenix LiveView, without a framework-specific build step
  in the consuming application and without a JavaScript runtime dependency on the Anchor.
  Covers at minimum colour, typography, spacing, radii, elevation, motion.
- **FR-17**: The Anchor consumes its own tokens: no colour, spacing or type value in the Hub's
  own styling bypasses the token contract for values the contract covers. Scoped to
  CSS-expressible styling: the Three.js narrative is a declared exception (seam S-1).
- **FR-18**: Visible family resemblance across at least two Live applications on different
  frameworks rendering from the shared tokens, encountering the same palette, type scale and
  spacing rhythm. This is the acceptance condition for "the Ecosystem is visible" and is
  reachable before any distribution machinery exists.
- **FR-19**: Token changes propagate without breaking a Satellite silently: adoption is an
  explicit reviewed action, never an unattended automatic merge; the Operator can determine which
  Satellites are on which version; no automated dependency merge in any repository lacking a real
  test suite.
- **FR-36**: *(added 2026-08-15)* Visual restyle is what adoption means for a rendered
  application: its own components follow the Ecosystem's component vocabulary rather than its
  framework's or component library's defaults; the restyle is implemented natively with no
  component, class-name library or Anchor file imported beyond the vendored contract folder; a
  restyle changes presentation only, and one that changes behaviour, routes, data or feature set is
  out of scope by PRD §8; verified by SM-12's per-application check, never by asserting the token
  file is imported.
- **FR-37**: *(added 2026-08-15)* The Anchor's components are token-native by construction: no
  component stylesheet consumes a transitional alias once its component has been redesigned; no
  colour, spacing or type literal exists outside `contracts/` and `_print.scss`, enforced by a
  **blocking CI check** rather than a one-time sweep; the step-2 alias layer has a named removal
  condition (the last redesigned component) and is deleted when it is met; seam S-1 stands.
- **FR-38**: *(added 2026-08-15)* Restyle follows visibility: an application earns a restyle when
  the Suite Directory renders it and never before; the trigger is FR-35's existing declarative
  Status filter with no second list; no restyle work item exists for a `In progress` or `Archived`
  application and SM-C6 targets zero always; becoming `Live` or `Complete` creates the obligation
  at that moment, and archiving closes it permanently.

**§4.5 Cross-App Identity** *(v2: deferred by sequence, PRD §9.2)*

- **FR-20**: One identity across applications: authenticating at one application and opening a
  second results in an authenticated session with no credential prompt; each application
  maintains its own host-scoped session with no cross-subdomain cookie; federation is
  protocol-based so language and framework are irrelevant.
- **FR-21**: The polyglot boundary is crossed and demonstrable: the Hub (Next.js) and
  `cs-tracker` (Phoenix LiveView) both participate; a Visitor can observe the same identity
  carrying across that boundary. This pair is the acceptance condition; further applications are
  optional.
- **FR-22**: Sign-out reaches every session including open sockets: after sign-out a previously
  authenticated application requires re-authentication; an application holding an open persistent
  socket observes the sign-out and does not continue serving authenticated state; verified
  against the Phoenix LiveView case specifically.
- **FR-23**: Identity is replaceable without touching application code: no participating
  application contains provider-specific logic beyond issuer configuration and client
  credentials.
- **FR-24**: Non-participating applications are declared, not silently excluded. `MaiCoin` is
  declared non-participating (wallet auth, structurally exempt). Any application with no
  authentication declares that in its Registry Entry rather than appearing broken.

**§4.6 Demo Access** *(v2: deferred with identity, PRD §9.2)*

- **FR-25**: A Visitor can use a real application without registering: every `Live` application
  requiring authentication provides a Demo Account obtainable from its own sign-in surface;
  it reaches the core function, not a stripped-down preview; no registration, email verification
  or personal data at any point.
- **FR-26**: Demo state is bounded and self-recovering: demo data isolated from Operator data;
  a defined baseline dataset per application; state returns to baseline without manual
  intervention within a window short enough that two Visitors arriving the same day both find a
  usable application; a Visitor cannot delete or lock out the Demo Account.
- **FR-27**: Demo Access is declared per entry: every entry carries a `demo` declaration
  covering at least usable-with-demo-account / usable-without-authentication / not-deployed; the
  declaration is accurate; structurally exempt applications declare their actual access model.
- **FR-28**: Demo Access degrades honestly under capacity pressure: an application taken offline
  has its Status moved off `Live` and its `live` URL removed **in the same change**; no entry
  ever presents a `live` URL that does not resolve.

**§4.7 Embedded Playable Demo** *(v2, PRD §9.2)*

- **FR-29**: Connect Four playable inside the Hub, no authentication, no external service, no
  VPS capacity beyond the Hub's own serving.
- **FR-30**: Absorption is recorded, not hidden: `connect-four-react` appears as a Registry
  Entry with `absorbed_into` naming the Anchor, and its `source` resolves to where the code now
  lives.

**§4.8 Ecosystem Observability**

- **FR-31**: The Operator learns of breakage from a machine: every `Live` application externally
  monitored for reachability; certificate **age** monitored, not only expiry; monitoring external
  to the VPS so a whole-box failure still notifies; monitoring exists **before any automation is
  enabled anywhere** in the Ecosystem.
- **FR-32**: The Registry cannot lie: every `live` URL on a `Live` entry and every `source` URL
  on every entry checked on a schedule; a failing link notifies the Operator.
- **FR-33**: The Capacity Gate governs what may run: per-container resource usage measured and
  recorded before any additional application is placed; a written threshold exists and crossing
  it blocks further placement rather than triggering a judgement call; the response at the
  threshold is a named overflow path, not a downgrade of honesty.
- **FR-34**: Visitor behaviour at the Hub is measurable: reaching the Suite Directory is a
  distinguishable event from loading the homepage; opening a `live` link and opening a `source`
  link are distinguishable events; first-party and self-hosted only.

### NonFunctional Requirements

Source: `prd.md` §6.

- **NFR-1: Solo-maintainable indefinitely.** Operable by one person with no coordination.
  Anything implying a second maintainer, a review queue or an on-call rotation is out of scope by
  construction.
- **NFR-2: Nothing live may break.** `cuatro.dev`, `cs-tracker.cuatro.dev`,
  `tracker.cuatro.dev` and `library.cuatro.dev` serve today, as does `list-wheel` on its current
  host. All keep serving through every step, including the relocation. No step may leave a broken
  application.
- **NFR-3: Capacity-bound.** 2 vCPU is a hard ceiling and is unproven. No requirement may assume
  headroom; where capacity is unmeasured the requirement is gated (FR-33), not assumed.
- **NFR-4: Cost-bound.** All-in spend within $40–100/month. The VPS is prepaid to 2028, so only
  marginal spend counts.
- **NFR-5: Mobile-first for the Hub.** Hub requirements are satisfied on a mobile viewport
  before a desktop one.
- **NFR-6: Reduced-motion respect.** Honoured without denying access to the Suite Directory.
- **NFR-7: Crawler exposure is managed.** Bot mitigation is a prerequisite for shipping the
  Suite Directory, not a follow-up.
- **NFR-8: First-party data only.** No third-party analytics, tag manager, session recorder or
  tracking script anywhere in the Ecosystem, Anchor or Satellite.
- **NFR-9: Honesty over completeness.** Where the Registry could overstate or under-promise, it
  under-promises.
- **NFR-10: No unattended automation without a test suite.** Nothing merges or deploys
  unattended in a repository that cannot detect its own breakage.

### Additional Requirements

Source: `ARCHITECTURE-SPINE.md`. The ADs are the invariants stories are measured against.

**No starter template.** This is a brownfield reshape of `cuatro-portfolio@2.5.3`, a shipping
Next.js 16 / React 19 / SCSS site. Epic 1 Story 1 is not a scaffold step. The Turborepo
structure in the Structural Seed (`apps/`, `packages/`, `contracts/`) does not exist yet,
`pnpm-workspace.yaml` declares only `onlyBuiltDependencies` and has no `packages:` key, and
`turbo` is not in `package.json`. Creating that structure is real work in Epics 2 and 3.

**Architecture Decisions (AD-1 … AD-23)**

- **AD-1**: The contract boundary is a directory, and CI holds it. Entire published surface is
  `contracts/`, served at `https://cuatro.dev/contracts/`. CI fails if any file under
  `contracts/` matches `\.(ts|js|tsx|jsx|mjs|cjs)$`. Generators live in `packages/` and are never
  published.
- **AD-2**: Code may be shared inside the Turborepo boundary, never across it. `apps/*` may
  depend on `packages/*`; no Satellite may depend on any `packages/*` artifact. Turborepo governs
  JS/TS only. A shared React package is created only after real duplication accumulates across
  two or more apps.
- **AD-3**: One application id, mechanically derived everywhere: lowercase kebab-case equal to
  the repository name → GHCR image, compose service, Traefik router, Postgres database and role
  (hyphens → underscores), Clerk client. **The public hostname is not derived**: it is declared
  per entry in the Registry, which is the only mapping.
- **AD-4**: The App Registry is authored JSON validated by schema. `contracts/registry.json` is
  the only Registry; `contracts/registry.schema.json` fixes the shape; the file carries `$schema`
  so the editor validates while writing; CI validates and fails the build. The Hub imports it
  directly. Satellites fetch it at **build** time, never at request time: a Satellite's switcher
  is stale until its next rebuild, deliberately.
- **AD-5**: The Registry entry shape (see corrected FR-6). `status` accepts exactly four
  strings. The envelope carries `contract_version`; value change = minor bump, field rename =
  major.
- **AD-6**: Registry membership is by application, not by repository.
- **AD-7**: Each application is one independent deploy unit, addressed by host. One Dockerfile,
  one GHCR image, one compose service, one Traefik router per id, including the four inside the
  Anchor. A deploy names exactly one id. Every router matches on `Host`; `PathPrefix` routing
  between applications is forbidden.
- **AD-8**: Build in CI, push to GHCR; the box never compiles. Images built in GitHub Actions,
  tagged with the git sha; deployment pulls a tag and runs `docker-rollout`, never a build. For
  the four Anchor applications the build context is the repository root **narrowed by
  `turbo prune --docker`** with the Dockerfile at `apps/<id>/Dockerfile`. `docker-rollout`
  requires real healthchecks and services without `container_name` or published `ports`.
  **The current `deploy.yml` is a standing violation until Epic 3.**
- **AD-9**: The Capacity Gate blocks new placement mechanically and defaults to blocked.
  `ops/capacity-gate.yml` records `measured_at`, `baseline`, `threshold`, `reading`, `status`,
  `overflow`, `placements`. The deploy workflow reads it: placing a **new** id fails while
  `status: blocked`; existing ids always deploy so NFR-2 is never traded against the gate. The
  gate measures 15-minute load average; per-container `cpu.pressure` (cgroup v2) is the
  diagnostic. **Until Epic 1's measurement week writes a threshold, `status` is `blocked`.**
- **AD-10**: One Postgres, one database and role per consumer; never schema-per-app. Explicit
  `connection_limit` per application, sum under `max_connections`; no PgBouncer. An application
  using a different store declares it in `tech` and **carries its own offsite backup path**.
  `digital-library` (SQLite + Redis) is the declared exception. Backups are `pg_dump` on cron
  plus restic offsite; a declared non-Postgres store without an equivalent offsite path is
  unbacked data, which is a defect.
- **AD-11**: Identity federates by protocol; sessions never leave their host. OIDC Authorization
  Code + PKCE per application against one Clerk issuer; each application mints its own
  `__Host-` session; no `Domain=.cuatro.dev` cookie anywhere. Logout is RP-Initiated plus
  Back-Channel, and `cs-tracker` additionally broadcasts on `live_socket_id`. Traefik ForwardAuth
  gates only surfaces with no authentication of their own, never an application's identity path.
- **AD-12**: Identity participation is declared, never inferred.
- **AD-13**: Demo access is one contract, implemented per stack. The demo principal is
  `demo@cuatro.dev` in every application and owns every demo row. Each application exposes an
  idempotent `demo:reset` that deletes by owner and reseeds a baseline fixture committed in its
  own repository. **Reset is scheduled on the host, outside the application containers**: one
  scheduler for the estate. Hourly by default, per-application override permitted. The demo
  principal cannot be deleted and its credentials cannot be changed from inside the application.
- **AD-14**: Token consumption route is a property of the consumer, and adoption is
  all-or-nothing. `tokens.css`, `fonts.css` and `tailwind.css` are versioned together and copied
  as a **folder named `cuatro-contracts/`**, never as individual files and never under another
  name. Tailwind consumers: `cuatro-finance`, `cuatro-tracker`, `cs-tournament` **and
  `cs-tracker`**: import `tailwind.css`; non-Tailwind consumers import `tokens.css` +
  `fonts.css`; the Anchor is SCSS and consumes the plain pair. `--token-*` and Tailwind's
  `--color-*` never share a name across a `var()`. `inline` is mandatory on `@theme`. A Satellite
  adopts the whole contract or none of it.
- **AD-15**: The Phoenix route carries both daisyUI paths: `@plugin "daisyui/theme"` with
  `var()` if a scratch `mix phx.new` confirms it is accepted, and `[data-theme="…"]` plain CSS if
  not. The test gates the step, not the contract; both paths satisfy FR-18.
- **AD-16**: Contract changes are versioned; adoption is explicit and recorded. Value change =
  minor, any rename = major including a typo fix. Model is deprecate → migrate → remove. Each
  Satellite's adopted version is declared in `token_contract` and **verified** against the
  `Contract vX.Y.Z` header in its vendored `cuatro-contracts/tokens.css` by the same scheduled
  job that checks links.
- **AD-17**: Three prerequisite gates, each a blocking predecessor, never a parallel task:
  (a) external uptime + certificate-**age** monitoring before any automation is enabled anywhere;
  (b) bot mitigation live on every live subdomain before the Suite Directory ships;
  (c) the Capacity Gate carries a written threshold before any new id is placed.
- **AD-18**: The Registry is verified against reality on a schedule, from off the box. One job
  checks, per entry: `source` resolves; `live` resolves whenever `status` is `Live`; the
  Satellite's vendored token version matches `token_contract`. Any failure notifies the Operator.
  Runs external to the VPS.
- **AD-19**: The accessibility floor is asserted, not claimed. Playwright runs in CI against the
  Hub at 360px asserting (a) every interactive element's `boundingBox()` measures at least
  44×44, and (b) the Status mark's **three structural axes** hold per `EXPERIENCE.md` § Status
  mark. **Asserting `border-style` alone is forbidden.** Lighthouse CI's accessibility assertion
  (≥0.95, severity error) stays and is not weakened. After token adoption `cs-tracker` is
  measured once by hand against the same floor and the result recorded. Opacity never expresses
  state.
- **AD-20**: Every step leaves a working system, and the Epic 3 order is fixed. Four subdomains
  serve through every step of every epic. In Epic 3 the Hub moves to `apps/hub` as its **own
  shipped step with nothing else changing**: rewriting `ci.yml`, `lighthouse.yml`, `deploy.yml`,
  `docker/Dockerfile`, `tsconfig.json` and `vitest.config.ts` and nothing more. Then
  `cuatro-finance`, then `cuatro-tracker`, then `cs-tournament`, one shipped and verified step
  each, using `git filter-repo --to-subdirectory-filter apps/<id>` then
  `git merge --allow-unrelated-histories`.
- **AD-21**: One environment; CI is the only pre-production gate. No staging exists and none is
  introduced. Every CI gate is blocking and none may be made a warning: typecheck, unit tests,
  Registry schema validation, `contracts/` purity, the Playwright floor, Lighthouse accessibility.
- **AD-22**: Settled inputs have a shelf life, and the re-check is bounded. An epic whose first
  story opens after **2026-11-15** records a refresh check first, scoped to exactly: Traefik,
  PostgreSQL, restic and `docker-rollout` versions; Clerk and Railway pricing; the Style
  Dictionary ≥5.5.1 security floor; the Let's Encrypt lifetime schedule. Nothing outside that
  list re-opens.
- **AD-23**: Migrations are a discrete step and must survive the rollout overlap. Never on
  container boot. They run against the application's own database before the rollout starts, and
  each must be backward-compatible with the version still serving: expand first, contract later,
  never both in one release.
- **AD-24**: *(added 2026-08-15)* Restyle is native; the component vocabulary federates as a
  specification, never as code. Each application implements the vocabulary in its own framework
  from the written **Restyle Specification**. No Satellite imports a component, a class-name
  library, a stylesheet other than its vendored `cuatro-contracts/` folder, or any `packages/*`
  artifact. The same component recurring across three or more applications is evidence the
  *specification* should be better, never that a *package* should exist. **The Restyle
  Specification is a required deliverable, not documentation polish.**
- **AD-25**: *(added 2026-08-15)* A restyle exists only for an application the Suite Directory
  renders. The gate is FR-35's declarative Status filter; no second list, no judgement call. A
  restyle work item for an unrendered application is a defect. Archiving an unbuilt application
  permanently closes its restyle obligation.

**Three amendments to existing ADs, applied 2026-08-15:**

- **AD-14**: all-or-nothing binds the **contract import**, never the restyle. A restyle proceeds
  component by component and reaches the Visitor as one merge, with intermediate commits on a
  branch under the same blocking gates. In the Anchor the step-2 alias layer holds the intermediate
  state together, which is why Story 1.18 survives the collapse of the seven-step migration.
- **AD-19**: the manual accessibility pass extends from `cs-tracker` alone to **every restyled
  application**. Three passes in Epic 8 wave 1, two more in wave 2. Not avoidable: a restyle can
  lower contrast, break a focus ring or shrink a hit target in ways no CI job on the Anchor sees.
- **AD-21**: the FR-17 colour-literal conformance check joins the blocking gate list.

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
- `@playwright/test` is **not** in `package.json`: only a transitive entry in `pnpm-lock.yaml`.
  AD-19 *adds* Playwright; this is real setup cost, not free (C-7).
- CI and Lighthouse workflows pin `node-version: 22`; the target stack is Node 24 LTS.
- `docker-compose.yml` runs `postgres:16-alpine` and `ghcr.io/umami-software/umami:postgresql-latest`.
- `content/projects.ts` holds one entry (`digital-library`) with `github`/`live` optional fields;
  `tech` correctly lists `SQLite` and incorrectly lists `Hetzner VPS` at line 30.
- No `turbo` dependency and no `packages:` key in `pnpm-workspace.yaml`.

### UX Design Requirements

Source: `DESIGN.md` + `EXPERIENCE.md`, treated as one contract. Both files declare they win on
conflict with any mock.

**Token contract: the published artifact**

- **UX-DR1**: Publish `tokens.css`: plain `:root` custom properties, **values only**, naming
  font families but containing no `@font-face`. The full property set is fixed in `DESIGN.md`
  § `tokens.css`: palette (`--c-*` ×11), semantic roles (`--token-*` ×11), families (×3), type
  scale (×10), weight (×5), line-height (×5), tracking (×6), `--measure`, space (×9), shape (×3),
  stroke (×5), elevation (×3), motion (×7), z-index (×7). Header carries `Contract v1.0.0`.
- **UX-DR2**: Publish `fonts.css`: `@font-face` for Bricolage Grotesque, Geist and Geist Mono
  with `url()` paths **relative to itself**, `font-display: swap`, and
  `size-adjust` / `ascent-override` / `descent-override` set so a swap does not shift layout.
  Splitting it from `tokens.css` is what lets a Satellite vendor the folder to any depth.
- **UX-DR3**: Publish `tailwind.css`: generated `@theme inline` adapter. Import order is fixed,
  `tailwindcss`, then `tokens.css`, then `fonts.css`, then the `@theme` block. It **must** import
  `fonts.css`, or the cluster gets three named families and no `@font-face` for any of them.
  Tailwind's `--color-*` maps from `--token-*` and the two namespaces never share a name.
  `inline` is mandatory.
- **UX-DR4**: The three files ship as a folder named `cuatro-contracts/`, copied whole, never as
  individual files and never renamed (this is what makes AD-16's drift check implementable).
- **UX-DR5**: The `@media (prefers-reduced-motion: reduce)` block lives **inside** the contract,
  collapsing `--dur-micro`, `--dur-minor`, `--dur-major` and `--dur-exit` to `1ms`. It is the one
  piece of behaviour the token layer federates.
- **UX-DR6**: Build with Style Dictionary **≥5.5.1** (security floor, 5.5.1 patched a
  prototype-pollution vulnerability in `convertTokenData`), DTCG format 2025.10. Terrazzo is
  rejected.
- **UX-DR7**: Fonts are subset to **latin only**, three variable faces, ≤120 KB gzipped total.

**Anchor SCSS → tokens migration** (`DESIGN.md` § Migrating the Anchor, seven steps, each leaving
the site working)

- **UX-DR8**: *Step 1:* add `tokens.css` + `fonts.css` to `app/scss/`, `@use` from `_index.scss`.
  Nothing consumes them; the site is byte-identical. Ship it.
> ⚠️ **Re-baselined 2026-08-15** against the merged `dev` tree (the cybercore rebrand, PRs
> #46–#70). UX-DR9 through UX-DR13 were authored against `main` and every count and line
> reference in them was stale. See
> [`rebaseline-2026-08-15.md`](ux-designs/ux-cuatro-portfolio-2026-08-15/rebaseline-2026-08-15.md).

- **UX-DR9**: *Step 2:* alias the sixteen existing `:root` properties in `app/app.scss` as
  `var()` references to the new roles, per the mapping table. **The alias trap is now half
  gone:** `--font-bold` and `--monument-bold` encode *weight* in a *family* name, but the
  rebrand retired every `--font-bold` call site. Only `--monument-bold` remains live, at
  `glitch-text.scss:5`, `error-page.scss:24`, `ProjectsHero.scss:19` and `WorkHero.scss:19`,
  set `font-weight` alongside `font-family` at those **four** call sites by hand in step 2.
  **O-10 decided in favour of the contract palette:** `--accent` → `--token-accent`, and
  `--accent-dim` resolves **per call site** across its fifteen: `--token-accent-muted` where it
  is ornament, `--token-border-interactive` where it is a boundary a person reads state from.
- **UX-DR10**: *Step 3:* the old white alpha hairlines are **gone**: the rebrand replaced them
  with a violet set. Replace `rgba(91, 33, 182, 0.06)` (`WorkItem.scss:35`,
  `ProjectCard.scss:36`), `rgba(91, 33, 182, 0.3)` (`WorkItem.scss:145`, `ProjectCard.scss:67`)
  and `rgba(10, 0, 20, 0.6)` (`ProjectCard.scss:27`) with `var(--token-border)` and
  `var(--token-border-interactive)` as the treatment warrants. *(The `boder:` typo this step
  used to also fix no longer exists: that file was rewritten by PR #61.)*
- **UX-DR11**: *Step 4:* sweep the remaining colour literals, **28 lines across 9 files**, up
  from eleven. `#444`/`#fff` in `celeste.scss:2`/`:16`, `#fff` in `navbar.scss:10`, `#0a000f` in
  `HomeLayout.scss:2` and `error-page.scss:7`, the `rgba(140, 90, 210, 0.06)` grid lines in
  both, `rgba(139, 92, 246, 0.15)` at `error-page.scss:28`, the `rgba(0, 0, 0, …)` scanlines at
  `ScanlineOverlay.scss:6`/`:16`/`:17`, and the greys in `_print.scss`. The bare keyword
  `color: white` at the old `HomeLayout.scss:122` **no longer exists**: that file was rebuilt.
  **`glitch-text.scss:33`–`:68` and `ScanlineOverlay.scss:6`/`:16`/`:17` are held by O-12**,
  the aberration pair needs opposing hues a single-hue palette cannot supply, and the scanlines
  are pure blacks the "nothing is pure" rule forbids. Leave both until O-12 is settled.
  `_print.scss` keeps real `#fff`/`#000` and is outside the contract by nature.
- **UX-DR12**: *Step 5:* swap the type, new `@font-face` in `fonts.css`, retire
  `app/scss/_fonts.scss`, delete the General Sans / Monument Extended / Confillia binaries from
  `public/fonts/`, apply `size-adjust` overrides. `--confillia-bold` has zero call sites and is
  deleted; `--confillia-normal` has two (`HomeLayout.scss:117`, `:148`) and is retargeted to
  `--f-display` at `wdth 75`: **O-6: confirm that reads acceptably before this step**.
  `--accent-glow` (`app.scss:11`) has zero call sites and is deleted: **O-11: confirm it is
  genuinely unused, not reserved.**
- **UX-DR13**: *Step 6:* move component stylesheets from `var(--white-color)` to
  `var(--token-text)` and equivalents, per component, never in one commit.
- **UX-DR14**: *Step 7:* delete the step-2 aliases. The contract is then the only source.

**Components: visual and behavioural specification**

- **UX-DR15**: **Status mark.** Uppercase mono at `--t-3xs`, `+0.14em` tracking, `1px` border,
  `--s-2xs`/`--s-xs` padding, square, **outlined never filled**. Per value: `Live` = 4px filled
  square dot + solid `--token-accent`; `Complete` = no dot, solid `--token-border-interactive`;
  `In progress` = **dashed** `--token-border-interactive`; `Archived` = **no border at all**.
  Three structural axes, no two alike in greyscale. Never expressed with opacity. Not interactive
  no tooltip, no popover, no hover state, so the 44px floor does not apply to it.
- **UX-DR16**: **Registry Entry.** A grid row, **never a card**, with no containing box. Name in
  Bricolage `wdth 85`/700 uppercase; status hanging right; description at `--t-sm` in
  `--token-text-secondary` capped at `46ch`; tech array in mono `--t-3xs` uppercase; links in mono
  `--t-2xs` uppercase; `1px` hairline separator. Reading order serves Daniela (name → status →
  description → tech → links); tab order serves Marcus (live link, then source link, two stops).
  **The row is never wholly clickable.** `Complete` has no live link at all, not a disabled one.
  Source is present on every entry without exception, including the Hub's own.
- **UX-DR17**: **Tracker Family group.** `1px solid var(--token-border)` on all four sides, the
  only containment layer in the entire directory. Label in mono `--t-3xs` `+0.14em` uppercase in
  `--token-accent`; framing line beneath at `--t-2xs` in `--token-text-secondary` capped at
  `--measure`, closed by a hairline. The last member drops its bottom rule. Not collapsible, not
  a tab set, not reorderable.
- **UX-DR18**: **Links.** Live link: `--token-text` with a `--stroke-emphasis` accent underline.
  Source link: `--token-text-secondary` with a `--stroke-hair` `--token-border-interactive`
  underline. On hover **both** underlines become `--token-accent-hover` and nothing else moves,
  no lift, no scale, no shadow, no background change, no width change.
- **UX-DR19**: **Button.** `1px solid var(--token-border-interactive)`, no fill, square, mono
  uppercase label at `--t-2xs`; border → `--token-accent-hover` on hover. There is no filled
  button anywhere in the system.
- **UX-DR20**: **Framework band.** Bricolage `wdth 75`/700 uppercase at `--t-3xs`, framework
  names alternating `--token-text-secondary` and `--token-accent-muted`, bounded above and below
  by hairlines. Decorative rhythm; carries no state and is not a legend.
- **UX-DR21**: **Plate mark.** Mono `--t-3xs`, `+0.16em` tracking, uppercase,
  `--token-text-secondary`, sitting on a hairline. Section identity top-left, position or domain
  top-right. Appears on section heads carrying a genuine ordinal or domain, never by default.
- **UX-DR22**: **Nav.** Wordmark left in Bricolage `wdth 75`/800; **two** mono uppercase links
  right (`Suite`, `CV`) and no more. Current route carries a `2px` accent underline plus
  `aria-current="page"`. Sticky at `--z-sticky`; does not hide on scroll.
- **UX-DR23**: **Suite Switcher panel** *(v2)*. `--token-bg-raised` ground, `1px`
  `--token-border-interactive` boundary, rows separated by hairlines, hover ground
  `--token-bg-raised-2`; each row is app name in Bricolage `wdth 85`, framework subtitle in mono,
  external-navigation glyph right. It is a **disclosure, not a menu**: `<button>` with
  `aria-expanded` and `aria-controls`, panel is a labelled region of ordinary links, `Tab` moves
  through and out normally, `Escape` closes and returns focus, focus never trapped. **Do not put
  `role="menu"` on it.** If the Registry is unreachable the trigger does not render at all.
- **UX-DR24**: **Focus ring.** `outline: 2px solid var(--token-focus)` at `3px` offset,
  `--r-hair` 2px radius, `:focus-visible` only never `:focus`, applied **instantly** and never
  transitioned, never removed without an equivalent replacement. A different token from hover so
  a keyboard user can always tell focus from hover.
- **UX-DR25**: **Hit targets.** `min-height: 44px; display: inline-flex; align-items: center` on
  the interactive element itself, never as vertical padding on a plain inline element (which
  paints outward without growing the hit area: an inline link with `padding: 0.25rem 0` measures
  ~29px no matter what the padding says). Two targets on one line take `--s-lg` of gap. Narrow
  labels take `padding-inline` to reach 44px wide. **Verified by measurement, not by reading the
  CSS.**

**Information architecture and front door**

- **UX-DR26**: `/projects` **301-redirects permanently to `/#suite`**, not deleted, this keeps
  every inbound link working and satisfies FR-2's "stable anchor **or** route" for free.
  `ProjectCard` and `ProjectsHero` are retired with it.
- **UX-DR27**: Header carries exactly two destinations: `Suite` (primary) and `CV` (secondary).
  Every header link competes with SM-1's ≥60% target.
- **UX-DR28**: `/cv` is **built around the existing `WorkTimeline` component**, reused unchanged
  `app/cv/page.tsx` and `app/recommendation/page.tsx` are one-line stubs today while `/work` is
  the fully built page. `/work` keeps rendering standalone for anyone holding the URL.
  `/recommendation` is linked from `/cv` and the footer; `/celeste` is footer only.
- **UX-DR29**: **One** non-3D front door: `prefers-reduced-motion: reduce` and the
  slow-connection path receive the **same** typographic hero. No static poster frame of the 3D
  scene is produced. That path reaches the Suite Directory in **zero** interactions.
- **UX-DR30**: Skip control `Skip to the suite ↓` sits **above the fold** on the default path and
  **moves focus**, not just scroll position, to the Suite Directory heading. Distinct from the
  accessibility skip-link, which is the first tabbable element and targets main content.
- **UX-DR31**: Suite Directory ordering is `Live` before `Complete`, then Registry order, not
  alphabetical, not by date. The Hub renders as itself, marked `You are here` rather than linking
  to the page you are on, and this stays declarative (a property of the current origin, not an
  exception to the FR-35 filter).
- **UX-DR32**: State patterns. Registry unreachable → the Directory renders from the build-time
  snapshot. **Empty cannot occur**; if it ever renders empty that is a defect and no empty-state
  illustration is designed. A `live` URL that stops resolving is not a UI state: FR-32 catches
  it and FR-28 degrades the entry. Globally: **no toast system, no confirmation dialogs, no
  skeletons**: do not build them.
- **UX-DR33**: 404: the existing `Error404` inherits the tokens with no new work and offers
  exactly two exits, Suite and CV, matching the header.
- **UX-DR34**: `/cv` accordion: `aria-expanded` on the trigger, `aria-controls` on the panel,
  the first entry opens on load **without a collapsed-height flash**, and the existing
  `useReduceMotion` hook drops the GSAP height tween to `0` duration. Education and Contact do not
  exist in the repository and are **omitted, not rendered empty**.
- **UX-DR35**: `/recommendation` ships **loaded with an attributed quote, or the route is not
  linked at all**. No unattributed and no placeholder state ships.

**Voice and microcopy**

- **UX-DR36**: Six Registry descriptions written to the FR-8 contract. Drafts are supplied in
  `EXPERIENCE.md` § Voice and Tone for Digital Library, Cuatro Tracker, CS Tracker, List Wheel,
  CS Tournament and Cuatro Ecosystem. The existing `digital-library` description is three
  sentences and stack-led: **non-conforming and rewritten**, not grandfathered, with every
  implementation noun moved into `tech`.
- **UX-DR37**: UI strings verbatim: header nav `Suite` · `CV`; skip control `Skip to the suite ↓`;
  directory heading `The Suite` (not "Projects", not "Portfolio"); count `6 running` (a real
  count, never rounded or aspirational); live link is **the bare domain** (`library.cuatro.dev`),
  never "View Live"; source link `Source`, not "GitHub" or "Code"; self-reference `You are here`;
  family framing `One product family, distinct implementations, deliberately not merged.`;
  switcher trigger `Suite`; switcher header `Part of the Cuatro Ecosystem`; footer
  `Six applications · five languages · one operator`: **update when the count changes, or delete
  it**.
- **UX-DR38**: **Never invent a metric**: if a number was not supplied, the slot does not exist.
  Status words are the taxonomy verbatim with no synonyms anywhere, ever. Punctuation is typeset:
  `—`, `…`, curly quotes; never `"`, `--`, `...`.

**Motion and interaction**

- **UX-DR39**: Only `transform` and `opacity` animate, never width, height, margin or any
  layout property. Name the transitioned properties; `transition: all` is banned. **One**
  orchestrated entrance per page load, then content simply exists: universal scroll-triggered
  fade-up is banned. Stagger by DOM index via a custom property, capped at ~500ms total. Scroll
  work uses `IntersectionObserver`, never a raw `scroll` listener. Banned: bounce, elastic and
  overshoot easings on UI; parallax outside the narrative; infinite loops; `hover:scale-105`;
  cursor followers; animated hover gradients; browser default `ease`/`ease-in-out`. Beyond the
  token block, spatial motion collapses to an opacity crossfade under reduced motion and the 3D
  narrative is **never requested**.

**Accessibility floor: WCAG 2.1 AA, exceeded on text contrast**

- **UX-DR40**: The sixteen behavioural requirements, each binding:
  **A-1** visible `:focus-visible` indicator ≥3:1 on every interactive element, never animated ·
  **A-2** reduced motion honoured without denying access to the Suite Directory ·
  **A-3** Status legible without colour: dot plus border treatment carries the taxonomy, hue
  never alone · **A-4** targets ≥44×44px, independently addressable, measured not assumed ·
  **A-5** no horizontal scroll at 360px and Status never truncates · **A-6** skip-link is the
  first tabbable element · **A-7** one `<h1>` per document, heading levels never skip ·
  **A-8** the Directory is a `<ul>` of entries with the Family group a nested `<ul>` carrying an
  accessible name · **A-9** link text self-describing out of context · **A-10** source links carry
  an accessible name naming the application (`Source: Digital Library`) · **A-11** body text
  ≥14px, nothing below 11px · **A-12** `rem` throughout, never `px` for type · **A-13** `lang` set
  and page title distinguishes the route · **A-14** the 3D canvas is `aria-hidden` and not
  focusable, its content stated in prose · **A-15** switcher trigger carries `aria-expanded`, the
  panel is labelled, `Escape` restores focus · **A-16** nothing autoplays with sound, nothing
  auto-advances.
- **UX-DR41**: Verification is four manual checks, keyboard-only traversal of the homepage and
  one Satellite; 360px viewport with no horizontal scroll; **greyscale render with the Status
  taxonomy still readable**; `prefers-reduced-motion` forced, plus AD-19's automated Playwright
  assertions in CI.

**Layout and responsive**

- **UX-DR42**: Mobile-first, authored at 360px. 360px is the design floor where every
  requirement holds; 390px is the reference width; at **≥760px** Directory rows gain columns
  (name and metadata left, description and links centre, status right) via **the same markup and
  one grid change**; at ≥1280px content is capped by `--measure` and the page does not stretch.
  **The row is the unit at every width: nothing reflows into cards.**
- **UX-DR43**: `html, body { overflow-x: clip }` globally, `clip` not `hidden`, because
  `hidden` breaks sticky positioning. Widths are `100%` with container padding, never `100vw`.
  *(The shipping `app/app.scss` currently sets `width: 100vw` and `overflow-x: hidden` on `body`
  both change.)* CSS Grid for page structure, Flexbox inside components, `gap` for sibling
  spacing with `margin` reserved for optical correction. Section padding varies deliberately;
  uniform vertical rhythm is a tell.
- **UX-DR44**: Colour and depth rules: accent occupies **≤3% of any viewport** and is never a
  background fill, a large block or a button ground; **no `#000` and no `#fff`** anywhere outside
  the print stylesheet; **no shadows at all**: depth is lightness (+4 step), then a hairline,
  then a strong rule, then type weight; **no gradients** anywhere; alpha is not a colour;
  **opacity never expresses state**; six named z-levels only and an ad-hoc `z-index` is a defect.
- **UX-DR45**: Typography rules: weight gap ≥300 units between any two roles; line-heights
  display `0.95–1.0`, headings `1.1`, body `1.6`, lede `1.55`; tracking display `-0.05em` through
  mono labels `+0.14em`, body never above `+0.05em`; measure `46ch` on descriptions and lede;
  `font-variant-numeric: tabular-nums` on every count, plate mark and metric; prose never below
  `--t-sm` and nothing below `--t-3xs`; uppercase is structural (display, headings, entry names,
  mono labels) and prose is never uppercase; no gradient text, no synthesised bold or italic, no
  italic headings.

**Seams, where token-only federation visibly fails**

- **UX-DR46**: The per-Satellite hand-fix list, in order, ordered by return per line: (1)
  `color-scheme: dark` on `:root` (S-11); (2) `::selection` from the accent (S-12); (3) the
  focus-ring rule copied verbatim from § Interaction Primitives (S-2); (4) `border-radius: 0` on
  form controls (S-3); (5) map the framework's control defaults onto the token roles (S-9, where
  applicable). **A Satellite that does only steps 1–4 already reads as family.**
- **UX-DR47**: S-8: `phx-update="ignore"` on animated containers in `cs-tracker` if LiveView DOM
  patching visibly interrupts a transition. S-10: `font-display: swap` plus `size-adjust`
  overrides in `fonts.css`, which is why they belong in the contract.
- **UX-DR48**: Seams **accepted and documented rather than fixed**, because a documented seam
  reads as judgement while a discovered one reads as an oversight: S-1 (Three.js narrative
  colours are JS values, a declared FR-17 exception), S-4 (form invalid/error states), S-5
  (overlays: do not build a cross-framework overlay convention), S-6 (dense data UI: this is
  the ceiling), S-7 (dark-only against existing light themes: mitigated by sequencing, a
  Satellite adopts fully or not at all).

**Asset budget** (SM-C5 is a counter-metric, so it needs a number)

- **UX-DR49**: Non-3D path total **≤140 KB gzipped**: HTML + critical CSS ≤20 KB, three
  subsetted variable faces ≤120 KB. That is the number that binds, because it is what Daniela
  gets on a slow connection. Everything narrative is deferred, lazy and non-blocking; the
  narrative bundle is **never preloaded and never `fetchpriority="high"`**; no `loading="lazy"`
  on an LCP element. **Suite Directory interactive is the metric**, not page-load-complete.
- **UX-DR50**: Anti-pattern conformance floor (`nutlope/hallmark`, treated as a floor not a
  suggestion). Structurally excluded: three-column icon-tile feature grid; card-in-card;
  full-viewport centred hero; shadow-glow on dark; the five-links-plus-CTA nav; the four-column
  footer; aurora blobs, floating orbs, glassmorphism; an eyebrow on every section;
  Inter-everywhere; invented metrics; emoji as icons. Purple is not the problem: purple *used as
  a fill* is.

---

## Forced Changes Applied

The Architecture Spine forces four PRD changes and narrows one recorded defect. Stories are cut
against the **corrected** requirements above, never the originals.

| # | Change | Where applied |
|---|---|---|
| **C-1** | The FR-9 defect is narrower than recorded. `content/projects.ts:23` already lists `SQLite` correctly; the only stale value is `Hetzner VPS` at line 30. The broader "runs on SQLite, not Postgres" claim does **not** carry forward | FR-9 above |
| **C-2** | `digital-library` is SQLite + Redis, so `pg_dump` + restic covers **none** of its data. A live application has no backup path in any input document. AD-10 requires the exemption to carry its own offsite path, and the data is live **now**, so this is not Epic 4 work | Story in Epic 1 |
| **C-3** | FR-5's third consequence bullet reworded: Registry membership is by application, not repository (AD-6) | FR-5 above |
| **C-4** | `demo` is required with an explicit value including `none`, not optional. Same for `identity` (AD-5) | FR-6 above |
| **C-5** | Two new required fields: `identity` (AD-12) and `token_contract` (AD-16) | FR-6 above |
| **C-6** | `content/projects.ts` is retired, not promoted. `contracts/registry.json` is hand-authored JSON validated by `contracts/registry.schema.json` in CI (AD-4) | FR-12 above |
| **C-7** | Playwright is **not** installed. AD-19's accessibility floor *adds* it: real setup cost, paid in Epic 1 because Epic 1's own migration stories assert rendered output | Story in Epic 1 |
| **C-8** | The box compiles today. A standing AD-8 violation until Epic 3, tracked explicitly rather than silently tolerated | Tracked item, Epic 1 |
| **C-9** | The deployed routing table exists nowhere in source. Enumerating it on the box is a **prerequisite of Epic 4, not a task inside it**: placed in Epic 1 | Story in Epic 1 |

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
| FR-13 | **deferred** | Spine § Deferred: v2. Data contract ships in Epic 2 |
| FR-14 | **deferred** | Spine § Deferred: v2 |
| FR-15 | **deferred** | Spine § Deferred: v2 |
| FR-16 | 1 | Token contract published |
| FR-17 | 1 | Anchor consumes its own tokens (migration steps 1–2) |
| FR-18 | 1 | **Epic 1's acceptance condition**: Anchor + `cs-tracker` |
| FR-19 | 1 / 2 / 6 | Policy + versioned header (1) · `token_contract` + drift check (2) · machinery (6) |
| FR-20 | 5 | |
| FR-21 | 5 | Hub + `cs-tracker`: the acceptance pair |
| FR-22 | 5 | Including the `live_socket_id` broadcast |
| FR-23 | 5 | OIDC is the reversibility seam |
| FR-24 | 2 / 5 | `identity` field declared (2) · verified against implementation (5) |
| FR-25 | 5 | Capacity-gated |
| FR-26 | 5 | `demo:reset`, scheduled on the host |
| FR-27 | 2 / 5 | `demo` field declared (2) · declaration accurate (5) |
| FR-28 | 2 | Honest degradation; the mechanism is the Registry plus the verification job |
| FR-29 | **deferred** | See § Deferred and Uncovered below |
| FR-30 | 2 | `absorbed_into` entry for `connect-four-react` |
| FR-31 | 1 | AD-17a: blocking predecessor of all automation |
| FR-32 | 2 | AD-18 scheduled job, external to the box |
| FR-33 | 1 | AD-9 / AD-17c: the gate defaults to blocked |
| FR-34 | 2 | Umami custom events for SM-1 … SM-3 |
| FR-35 | 2 | Declarative Status filter |
| FR-36 | 8 | Visual restyle per rendered application, natively (AD-24) |
| FR-37 | 2 | The Anchor's components rebuilt token-native (Stories 2.27–2.34) |
| FR-38 | 8 | Restyle follows visibility; the gate is FR-35's filter (AD-25) |

### Deferred and Uncovered

- **FR-13, FR-14, FR-15: the Suite Switcher.** A recorded deferral: spine § Deferred names it
  as v2, and Epic 2 ships everything it depends on (AD-4's published `registry.json`, fetched at
  build time), so nothing blocks it later.
- **FR-29: embedded playable Connect Four.** PRD §9.2 defers it as "delightful, not
  load-bearing", but unlike the Switcher it was never picked up by the spine's § Deferred list or
  by the Capability → Architecture Map. **Recorded here as an explicit deferral** so it does not
  read as an oversight. FR-30's *record* half still ships in Epic 2 as a Registry entry with
  `absorbed_into: cuatro-portfolio`; only the *playable* half defers.
- **FR-19's distribution machinery**: Epic 6, earned by three real hand-copied token changes,
  not scheduled.
- Everything in the spine's own § Deferred list: a shared React package for the Next.js cluster,
  point-in-time database recovery, a light theme, cross-framework conventions for seams S-4/S-5/
  S-6, authorization, the greenfield PostgreSQL major, whether the four `In progress`
  applications are ever built, and hostnames for `cs-tournament` and `list-wheel`.

## Epic List

The seven epics are **fixed by the spine's Capability → Architecture Map** and are not re-cut
here. Epics 3, 4 and 7 are frankly technical rather than user-value-shaped; that is deliberate
and correct. PRD §12.5 argues explicitly that engineering order and product order diverge after
research Step 2, which is why Epic 2 (the entire hiring-audience payoff) is inserted *ahead* of
the Anchor merge rather than after it.

**Specification depth:** Epics 1–3 are fully specified with executable stories and complete
acceptance criteria. Epics 4–7 carry story titles, goals and dependencies but not full AC,
AD-22 forces a bounded refresh check before Epic 4's first story opens, and writing acceptance
criteria now against decisions that must be re-verified would be inventing detail that expires.

### Epic 1: Foundation, error signal, measured capacity, and the first visible ecosystem moment

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
**O-10: DECIDED 2026-08-15: the contract palette wins.** Cybercore's hardcoded values map to
token roles; the value-by-value mapping is in
[`rebaseline-2026-08-15.md`](ux-designs/ux-cuatro-portfolio-2026-08-15/rebaseline-2026-08-15.md)
§ O-10. **Story 1.18 is unblocked.** Both systems are violet, so the shipped identity largely
survives: what changes is that every value gains a computed contrast.
Also **O-11**: `--accent-glow` is declared with zero call sites; confirm before deleting.
**O-12: CLOSED 2026-08-15 by the UX restyle pass**, and it blocks nothing anywhere. Item 1,
GlitchText's aberration: **dropped**, not excepted (Story 2.27). Item 2, ScanlineOverlay's blacks:
the effect retires and the legibility job it was doing becomes `--token-scrim`, which ships **inside
Contract `v1.0.0`** at Story 1.11 and is **consumed** by Story 2.28. Item 3, the decorative numeral:
not dissolved by any redesign, because whether it is redundant to a screen reader is an
accessibility question, so it survives as a binding acceptance criterion on Story 2.30 with both
branches specified. *(The two stories this item used to block, 2.18 and 2.19, no longer exist.)*
**Governing ADs:** AD-1, AD-9, AD-10, AD-14, AD-15, AD-16, AD-17, AD-18, AD-19, AD-20
**Standalone:** yes. Delivers SM-5 (external uptime), SM-6 (≥2 applications on shared tokens),
SM-7 (Estate 11) and a written Capacity Gate threshold, none of which depend on a later epic.

### Epic 2: The suite becomes visible, Registry as product and the reshaped front door

Daniela lands on `cuatro.dev`, scrolls into a directory of six running applications, and opens
one. Marcus skips the narrative, reads an accurate `tech` array, and reaches any repository in
one hop. The Registry cannot lie about either of them, and the Operator can see how Visitors move
through the Hub.

**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12,
FR-35, FR-37, FR-24 *(declaration)*, FR-27 *(declaration)*, FR-28, FR-30 *(record)*, FR-32, FR-34
**Also carries:** the AD-19 hit-target and Status-mark assertions, on the harness Epic 1 installed
(C-7) · `list-wheel` relocation onto a `cuatro.dev` subdomain (§5.3) · open items O-1, O-2, O-4,
O-5, O-8, O-9 · three of the four pre-existing repository defects
**Amended 2026-08-15 by the restyle scope change.** The Hub's inherited cybercore components are
**rebuilt token-native** (Stories 2.27–2.34) rather than migrated. Stories 2.18 and 2.21 are
deleted, 2.19 is replaced by 2.34's blocking CI gate, 2.20 moves to the front of the redesign
sequence and 2.22 is retargeted. **O-12 items 1 and 2 close inside the redesign pass** rather than
blocking two stories that no longer exist; item 3 survives as a binding acceptance criterion on
Story 2.30, because whether a decorative numeral is redundant to a screen reader is an
accessibility question no redesign answers. The epic goes from 26 stories to 31.
**Governing ADs:** AD-1, AD-3, AD-4, AD-5, AD-6, AD-7, AD-9, AD-18, AD-19, AD-21, AD-24
**Blocked by:** AD-17a (monitoring) from Epic 1, which gates the automation Story 2.8 adds; and
AD-17b (bot mitigation), which binds at Story 2.9: the Suite Directory is a crawler amplifier by
construction and ships only after the bot filter. `list-wheel` placement is additionally blocked
by AD-17c's written threshold.

### Epic 3: One repository, one deploy unit each, the Anchor merge and build in CI

Operator-facing and invisible to every Visitor in PRD §2.3, which is exactly why it sits after
Epic 2. The Estate drops from 11 to 8, and the serving two-core box stops compiling.

**FRs covered:** none directly. Supports NFR-2 and NFR-3, and closes the standing AD-8 violation
opened as a tracked item in Epic 1.
**Governing ADs:** AD-2, AD-3, AD-7, AD-8, AD-20, AD-21, AD-23
**Fixed order (AD-20):** the Hub moves to `apps/hub` as its own shipped step with nothing else
changing, then `cuatro-finance`, then `cuatro-tracker`, then `cs-tournament`: one shipped and
verified step each.
**Expects from Epic 2:** the Playwright job and the Registry schema gate already exist in
`ci.yml`; the Hub-move story rewrites that file and must carry them across rather than
rediscover them.

### Epic 4: Greenfield VPS rebuild

Traefik, one Postgres, `docker-rollout`. Four live subdomains serve throughout.

**FRs covered:** none directly. NFR-2, NFR-3; AD-10's backup topology and AD-23's migration
discipline become real here.
**Governing ADs:** AD-7, AD-8, AD-10, AD-20, AD-22, AD-23
**Blocked by:** Epic 1's C-9 enumeration, the rebuild must preserve four subdomains it cannot
enumerate from source. Also by Epic 3, since a greenfield host that pulls images requires images
to exist. AD-22's refresh check runs before this epic's first story if that story opens after
2026-11-15.

### Epic 5: One login, and a Visitor who can use the real thing

Cuatro signs in once across his own tools. One identity demonstrably crosses the
JavaScript/Elixir boundary. A Visitor uses real software without registering anything.

**FRs covered:** FR-20, FR-21, FR-22, FR-23, FR-24 *(behaviour)*, FR-25, FR-26, FR-27 *(accuracy)*
**Governing ADs:** AD-11, AD-12, AD-13, AD-18, AD-22, AD-23
**Blocked by:** Epic 4, research sequences identity behind the host rebuild. Demo Access is
additionally capacity-gated under AD-9.

### Epic 6: Token distribution machinery, deferred, earned

npm package, Renovate shareable preset, published reusable workflows. The published *shape* is
already fixed by AD-14 and AD-16, so nothing blocks later.

**FRs covered:** FR-19 *(machinery half)*
**Governing ADs:** AD-14, AD-16, AD-22
**Trigger:** three hand-copied token changes actually performed. Not scheduled.

### Epic 7: WSL2 relocation

Developer machine only. No ecosystem invariant depends on it, and it is independent of every
other epic.

**FRs covered:** none. Operator ergonomics.
**Governing ADs:** none, the spine records no invariant here.

### Epic 8: Every rendered application reads as one product

*Added 2026-08-15 by the restyle scope change.*

After Epic 8 a Visitor moving between the Hub and any application in the Suite Directory finds not
just the same palette and type scale but the same component vocabulary: the same separators, the
same unfilled controls, the same focus ring, the same status discipline. The polyglot claim stops
resting on a shared file and starts resting on a shared specification implemented five times, which
is the harder and more interesting version of it.

**FRs covered:** FR-36, FR-38. *(FR-37 is Epic 2's; the Anchor is not a Satellite.)*
**Governing ADs:** AD-14, AD-16, AD-19, AD-20, AD-24, AD-25
**Blocked by:** Epic 2, which must first produce the Hub's component vocabulary. **The Restyle
Specification now exists** *(`RESTYLE-SPEC.md`, final, 2026-08-15)*, so this epic is written against
a target rather than toward one, and its stories carry full acceptance criteria.
**Epic number is not execution position.** Wave 1 runs after Epic 2; wave 2 runs after Epic 3,
because AD-20 forbids a merge step from carrying anything else, so a merge target is restyled after
its merge ships rather than during it. Epic numbers were never execution order here: Epic 7 is
independent of everything, and renumbering to insert an epic would churn every story key in
tracking for no benefit.
**Standalone:** yes. Each story ships one application and leaves every other application untouched.
**Not in this epic, by rule:** `StreamVault`, `MaiCoin`, `poketracker-go`, `Mutuo` and
`cuatro-finance` have **no restyle story**. AD-25 creates one at the moment any of them begins
rendering in the Suite Directory, and not before. SM-C6 targets zero restyles ahead of that moment.

---

## Story Conventions

Two additions to the base story template, both required by the epics prompt:

- **Governing ADs**: named on every story. The spine's ADs are the invariants; a story that
  satisfies its acceptance criteria but violates an AD is a defect the loop should catch.
- **Depends on**: named explicitly, especially across the three AD-17 gates and the Capacity
  Gate. "None" means the story can open the moment its epic does.

**Operator-action stories commit their evidence.** Several Epic 1 stories are actions taken in a
web console or on the box rather than code changes: archiving repositories, buying a monitor,
adding Cloudflare rules, reading `docker stats`. A story whose entire acceptance is "you did a
thing in a dashboard" cannot be verified by a review session, so each one commits a record under
`ops/`, extending the pattern AD-9 already establishes with `ops/capacity-gate.yml`. The record
is the artifact; the acceptance criteria are written against it.

---

## Epic 1: Foundation, error signal, measured capacity, and the first visible ecosystem moment

After Epic 1 the Operator learns of breakage from a machine rather than from a Visitor, knows in
writing what the box can hold, and a Visitor moving between `cuatro.dev` and
`cs-tracker.cuatro.dev` sees two applications on different frameworks that visibly belong to one
product family. The Estate drops from 15 repositories to 11.

Twenty stories in four ordered groups: AD-17 gates and estate (1.1–1.6), discovery and defect
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
repository: exactly as `tcg-tracker`'s does.

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
**Then** it records all fifteen applications with their disposition, current Status and, where
one applies: their `absorbed_into` target
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
tells me, and so that automation may be enabled anywhere in the Ecosystem at all.

**Governing ADs:** AD-17a, AD-18 · **Realizes:** FR-31 · **Depends on:** none.
**This story is a blocking predecessor of every other story in the breakdown that enables
automation.** AD-17a is explicit that this is never a parallel task.

**Acceptance Criteria:**

**Given** four live subdomains: `cuatro.dev`, `cs-tracker.cuatro.dev`, `tracker.cuatro.dev`,
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

### Story 1.21: Restore `cuatro.dev` by completing the move onto the Hostinger VPS

**Added 2026-08-16 by the topology correction. Execution position: FIRST in Epic 1, ahead of
Story 1.3.** The number is 21 because story keys stay stable and numbers are never reshuffled,
the same convention Epic 8 records. Epic number and story number are not execution position.
Proposal: `sprint-change-proposal-2026-08-16.md`.

As the Operator,
I want `cuatro.dev` serving the Anchor from the same VPS as the rest of the estate,
So that the flagship stops being down, and so that every later story that measures, enumerates
or deploys has one box to talk about.

**Governing ADs:** AD-8, AD-20 · **Restores:** NFR-2 · **Depends on:** Story 1.7 (the
enumeration of the address the Anchor is leaving, so nothing on it is lost).

**Acceptance Criteria:**

**Given** `cuatro.dev` presented a self-signed `CN=TRAEFIK DEFAULT CERT` and returned 404 at
`/api/health` on 2026-08-16
**When** the move completes
**Then** `cuatro.dev` serves the Anchor over a publicly trusted certificate
**And** `/api/health` returns 200 with `"status":"ok"` to an ordinary client performing full
certificate validation, not to one with validation disabled.

**Given** `analytics.cuatro.dev` shares one compose stack with the Hub, so the two cannot move
independently without running that stack twice
**When** the move is planned
**Then** both move in the same step, or the deferral of `analytics.cuatro.dev` is recorded with
a date and a reason
**And** AD-20's rule that a migration step carries nothing else is read here as one deploy unit
moving once, with the reading recorded rather than assumed.

**Given** SM-1 through SM-3 and Story 2.24's custom events depend on the Umami data
**When** cutover happens
**Then** the Umami database is verified by querying it after the move, not by the container
starting.

**Given** the Operator confirmed on 2026-08-16 that `SERVER_HOST` points at the old box, so a
push to `main` today deploys into the box that is down and is about to be decommissioned
**When** the Anchor has moved
**Then** `SERVER_HOST` is repointed at the Hostinger VPS and the workflow's step name is
corrected in the same change
**And** the repointing is recorded in `ops/routing-inventory.md`, so no later story has to guess
which host a deploy reaches
**And** until both are done, `main` is not merged into, or the deploy workflow is gated, because
NFR-2 is already in breach and a deploy into the failing box can only widen it.

**Given** Story 1.7 enumerated what the old address served
**When** anything on it is not carried across
**Then** it is recorded as deliberately dropped rather than silently lost.

**Given** the Operator decided on 2026-08-16 that the old address is retired once the Anchor
has moved
**When** every hostname it served is confirmed serving from the Hostinger VPS
**Then** the old box is decommissioned, and the decommissioning date is recorded in
`ops/routing-inventory.md`
**And** nothing is decommissioned before Story 1.7's enumeration of that box is committed.

**Given** the Operator decided on 2026-08-16 to keep both `www.cuatro.dev` and `cuatro.dev`,
and `www.cuatro.dev` was proxied to a different provider returning `DEPLOYMENT_NOT_FOUND`
**When** the move completes
**Then** both hostnames serve the Anchor
**And** `cuatro.dev` is the canonical hostname, because every Registry `live` value, every
acceptance criterion and `ops/monitoring.md` name the apex, so `www.cuatro.dev` redirects to it
with a 301 rather than serving a duplicate
**And** the stale record pointing at the other provider is removed in the same change.

**Given** `ops/monitoring.md` carries an observed-state section dated 2026-08-16
**When** the move completes
**Then** that section is re-gathered and re-dated, so the record stops describing a topology
that no longer exists
**And** `www.cuatro.dev` is added to the probe table, since the monitored set is every live
`cuatro.dev` subdomain and it is now one.

---

### Story 1.3: Bot mitigation on the four live subdomains

As the Operator,
I want bot rules live on every live subdomain before anything crawler-attractive ships,
So that the Suite Directory (a crawler amplifier by construction, and now the homepage climax)
cannot spend scarce CPU on a box whose ceiling is unproven.

**Governing ADs:** AD-17b · **Depends on:** none.
**This story is a blocking predecessor of Epic 2.** NFR-7 and PRD §12.4 both make it a hard
prerequisite rather than a sequencing preference.

**Acceptance Criteria:**

**Given** the zone is on Cloudflare nameservers but on 2026-08-16 all four live subdomains
resolved to origin addresses rather than Cloudflare anycast addresses, so they were DNS-only
records with no proxy in front of them (amended 2026-08-16)
**When** the records are switched to proxied, which the Operator approved on 2026-08-16
**Then** rules are active on `cuatro.dev`, `cs-tracker.cuatro.dev`, `tracker.cuatro.dev` and
`library.cuatro.dev`: every live subdomain, not only the Hub
**And** each of the four still serves a normal request from a normal browser after the rules are
live, verified by hand.

**Given** bot rules apply only to proxied traffic, so the proxy switch is a prerequisite of this
story rather than an implementation detail of it
**When** the switch is made
**Then** Cloudflare's TLS mode is recorded, and Full (strict) is used rather than Flexible,
because Flexible leaves the origin leg unencrypted
**And** the switch is made one hostname at a time with the previous one verified serving, since
NFR-2 admits no step that leaves an application broken.

**Given** proxying moves TLS termination to Cloudflare, so an external probe observes
Cloudflare's edge certificate and can no longer see the origin certificate that Story 1.2's
Rule 1 was written against
**When** the records are switched
**Then** `ops/monitoring.md` is amended in the same change, never afterwards, so the expected
issuer matches what a probe will actually see
**And** an alarm fired by this change is a defect in this story, not a real outage.

**Given** AD-26 settles the origin certificate: Cloudflare Origin CA covering `cuatro.dev` and
`*.cuatro.dev`, behind Full (strict), so no ACME client runs on the origin for a proxied host
**When** the origin is configured
**Then** the steps run in this order, per host: install the Origin CA certificate, disable the
ACME client, verify the host still serves, and only then switch the DNS record to proxied
**And** the order holds regardless of which ACME challenge type is in use, because the risk it
guards against is two issuers contending for one hostname and a public path changing while
issuance is still relied upon; a renewal that breaks does not surface until the next renewal
attempt, which is weeks later
**Then** one Origin CA certificate is installed covering the apex and the wildcard, issued for
the longest term offered
**And** any ACME client previously issuing certificates for a proxied host on that box is
disabled, so two issuers are not fighting over the same hostname
**And** the certificate's expiry date is written into `ops/monitoring.md`'s Decisions table with
a dated review, because nothing renews it

**Given** two Cloudflare API tokens with zone DNS edit rights on `cuatro.dev` were found on
2026-08-16, `tracker-mac` (Zone.Zone plus Zone.DNS, last used 2026-08-05, matching a
`tracker.cuatro.dev` reissuance in Certificate Transparency that same day) and `cuatro-tracker`
(Zone.DNS, last used 2026-04-02, idle for over four months)
**When** Origin CA is installed and the ACME clients are disabled and every host is verified
serving
**Then** both tokens are revoked, because they are the credential for a mechanism this story
retires, and a standing zone-edit credential with no consumer is an unnecessary key
**And** neither is revoked before that point: revoking a live issuance token does not fail
loudly, it fails at the next renewal weeks later, which is the exact failure mode AD-17a exists
to catch
**And** the Cloudflare audit log is read first to confirm which records each token actually
touched, so a token doing something other than ACME is not revoked by assumption.
**And** the record states that a host may not leave the proxy until a publicly trusted
certificate has been issued for it first, which is AD-26's accepted reversibility cost.

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
**And** `threshold` is empty or null: a guessed number written here would be a guess dressed as
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

**Governing ADs:** AD-9, AD-17c · **Depends on:** Story 1.21 (so the week measures the box the
estate is staying on, amended 2026-08-16), Story 1.3 (so the week measures a
post-mitigation box), Story 1.4 (the file the readings land in)

**Acceptance Criteria:**

**Given** the estate is consolidated onto one box by Story 1.21, and that box runs the
applications, the proxy, Umami and Postgres
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
**And** `status` remains `blocked`: this story measures, it does not open the gate.

---

### Story 1.6: Write the Capacity Gate threshold and open the gate

As the Operator,
I want a written, binding threshold in the gate file,
So that placing a new application becomes a mechanical check against measured evidence, and
AD-17c stops blocking the work that depends on it.

**Governing ADs:** AD-9, AD-17c, AD-21 · **Depends on:** Story 1.5.
**This story is a blocking predecessor of every new placement**: `list-wheel` in Epic 2, and
every id placed in Epic 4.

**Acceptance Criteria:**

**Given** a full week of measured readings exists
**When** the threshold is written
**Then** `threshold` in `ops/capacity-gate.yml` carries a specific 15-minute load-average figure
derived from the measurement, not from the research's provisional ~1.4
**And** the derivation is recorded: what the baseline was, what headroom was reserved, and why
**And** `status` moves to `open` only if the measured baseline sits below the written threshold.

**Given** the measurement might show the box is already at or over its ceiling
**When** the baseline exceeds the threshold
**Then** `status` stays `blocked`, the named overflow path is invoked, and the story still closes
successfully: a blocked gate is a valid outcome, not a failed story
**And** the record says so explicitly, so a later reader does not mistake a blocked gate for
unfinished work.

**Given** SM-C4 says VPS load average wins every conflict with any other metric
**When** the threshold is chosen
**Then** the reserved headroom accounts for the near-term additions the estate already intends,
`list-wheel` (static, near-zero) and `cs-tournament` arriving from external hosting, rather than
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
**Then** `ops/routing-inventory.md` records, for every hostname in the zone and for every
address it resolves to: the hostname, the serving address, what terminates TLS for it, what
serves it, the container or process behind it, and the port
**And** the record covers at minimum `cuatro.dev`, `analytics.cuatro.dev`,
`cs-tracker.cuatro.dev`, `tracker.cuatro.dev` and `library.cuatro.dev`
**And** it records whether each DNS record is proxied or DNS-only, since that determines what
terminates TLS and what an external probe observes
**And** `www.cuatro.dev` is accounted for, since on 2026-08-16 it was proxied and returned
`DEPLOYMENT_NOT_FOUND` from a different provider
**And** any hostname found that nobody expected is recorded rather than dropped.

**Given** the estate spans two serving addresses as of 2026-08-16, and the committed compose
file describes a Caddy stack while a Traefik was observed answering on the Anchor's address
**When** the discrepancy is investigated
**Then** the record states, per address, what is actually running there and how each hostname
reaches it: a second Caddy instance, a separate compose project, an uncommitted Caddyfile, a
Cloudflare tunnel, a Traefik nobody committed, or whatever is true
**And** it states which of those configurations exist **only on a box** and not in any
repository, because that is the set Story 1.21 and Epic 4 must recreate from this document.

**Given** AD-3 makes the public hostname a declared value rather than a derived one
**When** the inventory is written
**Then** each hostname is recorded against the application id it serves, giving Epic 2 the
`live` values to author into the Registry and Epic 4 the router definitions to recreate.

**Given** NFR-2 requires all four subdomains to serve through every step
**When** the inspection is performed
**Then** it is read-only: nothing on the box is changed by this story.

---

### Story 1.8: An offsite backup path for `digital-library`

As the Operator,
I want `digital-library`'s SQLite and Redis data backed up offsite,
So that a live application stops being the one thing in the estate whose data no backup design
covers.

**Governing ADs:** AD-10 · **Depends on:** none.
**Not Epic 4 work**: the data is live now, and the `pg_dump` + restic design covers none of it.

**Acceptance Criteria:**

**Given** `digital-library` runs on SQLite + Redis and is AD-10's declared non-Postgres exception
**When** the backup path is built
**Then** the SQLite database is captured with a method that is consistent under concurrent writes
an online backup or a checkpointed copy, never a naive file copy of a live database
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
and names the mitigation, either avoid deploying during the week, or annotate the readings where
a deploy occurred.

**Given** the step is named "Deploy to Hetzner" while `host:` is the opaque secret
`SERVER_HOST`, and on 2026-08-16 the Anchor answered from an address in Hetzner's published
range rather than from the Hostinger VPS the rest of the estate serves from (amended
2026-08-16)
**When** the record is written
**Then** it states that the Operator confirmed on 2026-08-16 that `SERVER_HOST` points at the
**old** box, so the step name "Deploy to Hetzner" was accurate when written and becomes wrong
only after Story 1.21 moves the Anchor
**And** it records the live hazard this creates: `deploy.yml` fires on every push to `main`, so
until `SERVER_HOST` is repointed a merge to `main` deploys into the box that is down, and does
it with `--build` on a box that is being decommissioned
**And** the step name and the secret are corrected together in Story 1.21, not separately, since
correcting one without the other leaves the workflow lying in the opposite direction
**And** the naming question is recorded alongside the stale `Hetzner VPS` value in
`content/projects.ts:30`, so Epic 2's FR-9 correction and Epic 3's workflow rewrite each pick up
their half.

---

### Story 1.10: Install Playwright and establish the rendered-output harness

As the Operator,
I want a browser harness that reads computed styles and compares renders before anything in this
epic claims a visual property,
So that "the site is visually identical" and "this call site renders bold" are assertions a machine
makes rather than claims a document makes.

**Governing ADs:** AD-19, AD-21 · **Depends on:** Story 1.2 (AD-17a, this story adds a CI job,
which is automation).
Applies forced change **C-7**: `@playwright/test` is **not** in `package.json`, only a transitive
entry in `pnpm-lock.yaml`, so this is real setup cost paid once here. **Pulled into Epic 1
deliberately**: Stories 1.12, 1.17, 1.18 and 1.19 each assert a rendered-output property, and
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
**Then** it can read the computed value of a named CSS property on a named selector: the check
the four `--monument-bold` call sites need to prove `font-weight` survived the alias
**And** it can read the computed value of a custom property on `:root`, which is how Story 1.17
proves the contract is present and consumed by nothing.

**Given** a gate that has never been observed to fail is not known to work
**When** the harness is verified
**Then** each capability is demonstrated failing: a baseline comparison against a deliberately
shifted render, and a computed-style read against a deliberately wrong weight, and both probes
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

**Governing ADs:** AD-1, AD-14, AD-16, AD-21 · **Depends on:** Story 1.2 (AD-17a, this story
enables a CI build step, which is automation)

**Acceptance Criteria:**

**Given** the Anchor has no `packages:` key in `pnpm-workspace.yaml` and no Turborepo today
**When** `packages/tokens` is created
**Then** `pnpm-workspace.yaml` gains a `packages:` entry covering it
**And** the package builds with Style Dictionary at **≥5.5.1**: the security floor that patched
prototype pollution in `convertTokenData`: using DTCG format 2025.10
**And** per AD-1 the generator lives in `packages/` and is never published.

**Given** `DESIGN.md` § `tokens.css` fixes the exact property set
**When** `contracts/tokens.css` is generated
**Then** it contains the **twelve** `--c-*` palette values in OKLCH on anchor hue 288, the
**twelve** `--token-*` semantic roles, three families, the ten-step type scale, five weights, five
line-heights, six tracking values, `--measure`, nine spacing steps, **the `--tap` hit-target
floor**, three shape values, five stroke values, three elevation values, seven motion values and
seven z-index values
**And** it carries the header `Contract v1.0.0`
**And** `--tap` is `44px` and is **the only length in the contract authored in `px`**, deliberately,
because a target floor is a physical-size guarantee that must not shrink when a reader reduces their
root font size *(minted 2026-08-16, after three reference renders each invented it locally; review
finding LOW-2)*
**And** the twelfth palette value is `--c-scrim` and the twelfth role is `--token-scrim`, which ship
**at first publication rather than in a later minor bump** *(amended 2026-08-15; `DESIGN.md` § The
scrim, "It ships in `v1.0.0`, not `v1.1.0`")*, so Story 2.28 **consumes** the role rather than
adding it and no version bump occurs anywhere in Epic 2
**And** `--c-scrim` carries the **only alpha value in the contract**, the alpha living on the
palette entry rather than on the role, which is a plain `var()` reference like every other; this is
the single declaration Story 2.34's FR-17 gate permits inside `contracts/`
**And** it contains **no `@font-face` rule**: those live in `fonts.css`, because a `url()` in
`tokens.css` breaks the moment a Satellite vendors it to a different depth
**And** it carries the `@media (prefers-reduced-motion: reduce)` block collapsing the four
duration tokens to `1ms`.

**Given** AD-14 forbids `--token-*` and Tailwind's `--color-*` sharing a name across a `var()`
**When** the semantic roles are emitted
**Then** every `--token-*` role resolves to a `--c-*` palette value and no role is
self-referential.

**Given** AD-16 makes versioning a contract obligation
**When** the file header is written
**Then** it states that a value change **or an addition** is a minor bump, and that any rename,
including fixing a typo in a token name, **or any removal** is major
**And** the addition and removal categories are stated explicitly, the published rule having
previously covered only value changes and renames, which left the first addition to be adjudicated
inside a story's acceptance criteria *(review finding MED-2, closed 2026-08-16 in `DESIGN.md`
§ Versioning)*.

---

### Story 1.12: Publish `contracts/fonts.css` with latin-subset faces

As a Satellite vendoring the contract folder,
I want `@font-face` rules whose paths resolve wherever the folder lands,
So that adopting the type system is a copy operation rather than a silent fallback to
`system-ui`.

**Governing ADs:** AD-1, AD-14 · **Depends on:** Stories 1.10 (the harness that verifies the swap),
1.11

**Acceptance Criteria:**

**Given** three open-licence variable families: Bricolage Grotesque, Geist and Geist Mono
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
**And** the absence of a layout shift on swap is verified through Story 1.10's harness: a
baseline comparison across the swap, rather than assumed from the presence of the overrides.

**Given** AD-1 bars executable code from `contracts/`
**When** the fonts are published
**Then** nothing under `contracts/` is a `.ts`, `.js`, `.tsx`, `.jsx`, `.mjs` or `.cjs` file.

---

### Story 1.13: Publish `contracts/tailwind.css`, the generated `@theme inline` adapter

As a Tailwind consumer: `cuatro-finance`, `cuatro-tracker`, `cs-tournament` and `cs-tracker`,
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
**And** it **imports `fonts.css`**: an adapter pulling in only `tokens.css` gives the cluster
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
Closes open item **O-3**. O-7 is already closed: `cs-tracker` is on `{:phoenix, "~> 1.8.7"}`
with Tailwind v4 + daisyUI, so the adapter route applies and the plain-CSS route is not in play.

**Acceptance Criteria:**

**Given** the behaviour is undocumented either way
**When** a scratch `mix phx.new` application is created and the two candidate mappings are tried
**Then** the result records whether `@plugin "daisyui/theme" { --color-primary:
var(--token-accent); }` resolves to the token value or fails
**And** the test is a rendered-output check: reading the computed value of a daisyUI-driven
property in a browser, not a reading of the source.

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
it survives the Epic 3 move to `apps/hub` and the Epic 4 proxy change without either of them
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
**And** if a build-time copy is used, a stale copy cannot ship: the copy step runs before the
build output is assembled.

**Given** Epic 3 moves the Hub to `apps/hub` and Epic 4 replaces Caddy with Traefik
**When** the mechanism is documented
**Then** the record states which of those two later changes would have to touch it, so neither
epic discovers it late.

---

### Story 1.17: Anchor migration step 1, add the contract, change nothing

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
comparison against a capture taken before the wiring landed, not by inspection
**And** the new custom properties are present in the computed styles of `:root`, read through the
harness, and consumed by nothing.

**Given** the Anchor is the publisher and not a Satellite
**When** the wiring is reviewed
**Then** there is no copy of `tokens.css`, `fonts.css` or `tailwind.css` anywhere under `app/`,
`components/` or `public/`: the only authored copy is under `contracts/`.

**Given** this is the safe half of a two-commit change
**When** the story closes
**Then** it is shipped on its own, with the appearance change deferred to Story 1.18.

---

### Story 1.18: Anchor migration step 2, alias the old names onto the token roles

As a Visitor,
I want the Hub to render in the Ecosystem's visual identity,
So that it visibly belongs to the same product family as the other applications in the suite.

**Governing ADs:** AD-14, AD-19, AD-20 · **Depends on:** Stories 1.10, 1.17.
Realizes UX-DR9 and FR-17. This is the one commit in the migration worth a careful visual check,
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
**And** `--accent` → `--token-accent`, per **O-10, decided in favour of the contract palette**
**And** `--accent-dim` is resolved **per call site across its fifteen**: `--token-accent-muted`
where it is ornament, `--token-border-interactive` where it is a boundary a person reads state
from. It is doing both jobs today, so a single global alias is wrong and would silently drop
`--accent-dim`'s boundary uses below the 3:1 floor AD-19 asserts
**And** `--accent-glow` is left alone pending O-11, despite having zero call sites
**And** every one of the fifteen component stylesheets keeps working with no edit.

**Given** the alias trap: `--monument-bold` encodes *weight* in a *family* name, so aliasing to
a family alone silently drops bold *(re-baselined: `--font-bold` also did, but the rebrand
retired every one of its call sites, so it is no longer live)*
**When** the aliases are written
**Then** `glitch-text.scss:5`, `error-page.scss:24`, `ProjectsHero.scss:19` and `WorkHero.scss:19`
have `font-weight` set alongside `font-family` by hand in this same commit
**And** all four call sites are asserted bold after the change by reading computed `font-weight`
through Story 1.10's harness: the alias trap is invisible to a screenshot and to a reading of the
CSS, which is why it needs a computed-value check.

**Given** pure white and pure black are retired from the system
**When** the site is rendered
**Then** the body ground is `--token-bg` (`#060509`, never `#000`) and body copy is
`--token-text` (`#eeeef2`, never `#fff`)
**And** the warm `#b3b0aa` secondary becomes the violet-tinted `#98979f`, which is the most
visible single change in the migration and is expected.

**Given** NFR-2 binds every migration step
**When** the change ships
**Then** `cuatro.dev` serves throughout, and every existing route: `/`, `/cv`, `/work`,
`/projects`, `/recommendation`, `/celeste`, `/api/health`: still renders.

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
**This is Epic 1's acceptance condition**: FR-18 and SM-6.

**Acceptance Criteria:**

**Given** AD-14 requires the contract to travel as a folder under a fixed name
**When** the contract is vendored into `cs-tracker`
**Then** all three files land together in a folder named exactly `cuatro-contracts/`, never as
individual files and never renamed: the fixed name is what makes AD-16's drift check
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
**Then** the application renders wholly from the contract: no surface is left on the previous
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
change has the rule at hand rather than in a spine document
**And** it states what a pure **addition** is, because the rule as published has no category for
one and the first answer ever given to that question was improvised inside a story's acceptance
criteria *(review finding MED-2)*.

**Given** `--token-scrim` now ships inside `v1.0.0`, which **deletes AD-16's cheap rehearsal**:
`epics.md` had argued that exercising the change process on the cheapest possible change, months
before anything expensive depended on it, was worth having, and shipping at first publication
removes that opportunity *(amended 2026-08-15; review finding HIGH-6)*
**When** this story records the automation policy
**Then** it also writes the AD-16 **change-propagation runbook**: bump the header, publish, notify
each adopter, re-vendor the folder, update the Registry `token_contract` value, and confirm the
scheduled drift check reads the new value
**And** the runbook is **validated by walking it**, on a throwaway `v1.0.1` on a scratch branch that
is **never published and never merged**, so the process is exercised without a release and without a
consumer being asked to migrate
**And** what the walk-through found is recorded, because a runbook nobody has executed is a guess
written in the imperative
**And** this rehearsal is explicitly **not** counted toward Epic 6's trigger, which counts changes
actually propagated to a real adopter, never rehearsals.

---

## Epic 2: The suite becomes visible, Registry as product and the reshaped front door

Daniela lands on `cuatro.dev`, scrolls into a directory of six running applications, and opens
one. Marcus skips the narrative, reads an accurate `tech` array, and reaches any repository in one
hop. The Registry cannot lie about either of them, and the Operator can see how Visitors move
through the Hub.

Twenty-six stories. This is the largest epic in the breakdown by a wide margin, and deliberately
so: it carries nineteen FRs, six of the nine UX open items, the AD-19 assertion suite,
and the five Anchor migration steps that `DESIGN.md` leaves trailing after Epic 1. **`DESIGN.md`
assigns migration steps 1–2 to Epic 1 and says steps 3–7 "can trail" without naming where: they
land here** (Stories 2.18–2.22), because the Hub's stylesheets are being reshaped in this epic
anyway.

**Gated by Story 1.3** (AD-17b), binding at **Story 2.9** and everything downstream of it. AD-17b
requires bot mitigation live before *the Suite Directory ships*, and the Directory is a crawler
amplifier by construction and now the homepage climax: a hard prerequisite, not a sequencing
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
**And** `/celeste` still renders with no header, because the suppression itself is correct: that
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

**Given** the narrative bundle: Three.js, R3F, drei, `@react-three/postprocessing`, GSAP,
ScrollTrigger, lenis: is estimated at 300–450 KB gzipped from published library sizes rather
than measured
**When** the actual build is measured
**Then** the gzipped weight of the narrative JavaScript is recorded as a number
**And** the narrative's geometry and texture assets are measured and recorded separately
**And** both are recorded against the estimate, so the gap between inference and measurement is
visible.

**Given** the non-3D path total is the budget that binds at **≤140 KB gzipped**: HTML plus
critical CSS ≤20 KB, three latin-subset variable faces ≤120 KB
**When** the non-3D path is measured
**Then** its total is recorded and compared against the 140 KB budget
**And** a breach is recorded as a finding with the largest contributor named, not silently
absorbed.

**Given** `EXPERIENCE.md` names `@react-three/postprocessing` as the first trade to examine if the
narrative lands above ~450 KB
**When** the measurement exceeds that figure
**Then** the record names what would be traded and what it would cost, without making the trade
in this story: that is a separate decision.

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
**And** `demo` and `identity` are required **with an explicit value including `none`**: an
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
**Then** each carries an explicit value: `none` for identity where no authentication exists,
`wallet` for `MaiCoin`, and a not-deployed demo declaration, because AD-5 forbids blank as a way
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
FR-30. Descriptions are Story 2.6: this story authors structure.

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
**And** the public hostname is declared in `live`, never derived from the id: the three live
hostnames that diverge from their ids are the reason the rule exists.

**Given** FR-10 makes the drill-through path the Registry's contract with Marcus
**When** `source` is authored
**Then** every entry without exception carries one, including `Archived` entries and the Hub's own
**And** each resolves to a repository, never to a profile page.

**Given** FR-11 groups the Tracker Family
**When** `family` is authored
**Then** `cuatro-tracker`, `cs-tracker` and `poketracker-go` share a value
**And** `tcg-tracker` does **not** carry it: it is `Archived` with `absorbed_into`, not a family
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
**And** none contains a superlative or a marketing adjective: "powerful", "seamless",
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
**Then** it covers **every** entry in the Registry, not only the six the Directory renders,
SM-8 targets 100% editorial conformance across the Registry.

**Given** UX-DR38 fixes punctuation and status vocabulary
**When** every string in the Registry is set
**Then** punctuation is typeset: `—`, `…` and curly quotes, never `"`, `--` or `...`
**And** Status words are the four-value taxonomy verbatim, with no synonym anywhere
**And** no number appears that was not supplied, because a metric with no source is an invented
one.

---

### Story 2.7: Retire `content/projects.ts`; the Hub imports the published Registry

As the Operator,
I want exactly one representation of the Registry in the repository,
So that the Hub and its consumers can never read two registries that disagree.

**Governing ADs:** AD-4, AD-21 · **Depends on:** Stories 2.5, 2.6.
Realizes FR-12 and applies forced change **C-6**: the TypeScript module is retired, not promoted.

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
**And** the route's eventual retirement is Story 2.14's job, not this story's: this story swaps
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
Forced change **C-7** (`@playwright/test` being absent from `package.json`) is **paid in Story
1.10**, not here: Epic 1's migration stories needed the same harness to assert their own rendered
output, so the setup cost lands once, earlier. This story adds the floor assertion on top of it
and closes the automated half of open item **O-8**.

**Acceptance Criteria:**

**Given** AD-19 requires the floor to be asserted at a 360px viewport
**When** the assertion is written
**Then** it loads the Hub at 360px and, for every interactive element, asserts
`boundingBox()` measures at least 44×44
**And** it fails against an element that meets the floor only through vertical padding on a plain
inline element: the ~29px case that reads as compliant in the CSS and is not
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

**Governing ADs:** AD-4, AD-19, AD-21 · **Depends on:** Stories 1.3 (AD-17b, the Directory may
not ship before bot mitigation is live on all four subdomains), 2.7, 2.8.
Realizes FR-35, FR-3, FR-7, FR-10 and FR-11, and the Directory half of FR-2.

**Acceptance Criteria:**

**Given** FR-35 renders a curated subset while the Registry stays complete
**When** the filter is implemented
**Then** it is a **declarative rule over `status`**, never a hand-maintained second list,
changing an entry's Status to `Live` makes it appear with no other edit, demonstrated by doing so
in a test
**And** entries with Status `In progress` or `Archived` exist in the Registry and are not rendered
**And** ordering is `Live` before `Complete`, then Registry order, not alphabetical, not by date.

**Given** the Hub is one of the six entries PRD §5 counts
**When** the Hub's own entry renders
**Then** it is marked `You are here` and is not a link to the page you are on
**And** this stays declarative: a property of the current origin, not a hand-coded exception to
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
`--token-accent-hover` and nothing else moves: no lift, no scale, no shadow, no background
change, no width change.

**Given** the Registry could be unreachable and the page must still render
**When** the failure states are handled
**Then** the Directory renders from the build-time snapshot the Hub was built with
**And** no empty state is designed, because the filter is over Status and the Hub's own entry is
always `Live`: an empty render is a defect, not a state
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
**And** **asserting `border-style` alone is forbidden**: `Live` and `Complete` are both
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

**Governing ADs:** none · **Depends on:** Story 2.9.
Realizes FR-4.

**Acceptance Criteria:**

**Given** FR-4 caps the premise at three sentences and requires it to be encountered before or
with the Suite Directory
**When** the premise block is placed
**Then** it appears above the Directory in the document on both the default and the non-3D path
**And** it is at most three sentences
**And** it names no framework: it must carry for a reader who cannot name a single one of them.

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
**And** it appears only on section heads carrying a genuine ordinal or domain: **not by
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
**And** there is no loading spinner for the narrative: a spinner would announce that something
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
**Then** both receive the **same** typographic hero: premise plus framework band
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

**Governing ADs:** none · **Depends on:** Story 2.9.
Closes PRD §13 Q8.

**Acceptance Criteria:**

**Given** every header link competes with SM-1's ≥60% target, and the AI-nav tell is five inline
links plus a CTA button
**When** the header is authored
**Then** it carries exactly two destinations (`Suite` primary and `CV` secondary) and no CTA
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

**Governing ADs:** none · **Depends on:** Stories 2.1, 2.15.
`app/cv/page.tsx` is a one-line stub returning a bare `<h1>` today, while `/work` is the fully
built page, so this is **building `/cv` around a component that already works**, not merging two
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
**Then** those sections are **omitted, not rendered empty**: an empty section reads as
unfinished, an absent one reads as scoped.

**Given** Story 2.1 exposed the `<h1>` on the work hero
**When** `/cv` renders
**Then** A-7 holds on both routes: one `<h1>` per document and no skipped heading levels.

---

### Story 2.17: Secondary surface states

As a Visitor arriving at a route that is not the homepage,
I want it to be finished or absent rather than half-built,
So that nothing on the site reads as a placeholder.

**Governing ADs:** none · **Depends on:** Stories 2.1, 2.15

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
**Then** it offers exactly two exits (Suite and CV) matching the header
**And** it renders from the token contract with no new tokens introduced.

**Given** A-13 requires the page title to distinguish the route
**When** each secondary surface renders
**Then** its `<title>` is distinct and `lang` is set on the document.

---

### Story 2.18: DELETED 2026-08-15 (migration step 3, retire the violet hairlines)

**Deleted by the restyle scope change.** This story replaced four hairline values across two files.
`ProjectCard.scss` is retired by Story 2.14 with `/projects`, and `WorkItem.scss` is redesigned by
Story 2.31, which absorbs the replacements. There is nothing left for the story to do: tokenizing a
value in a file that is about to be rewritten is the wasted motion the scope change removes.

**Number retained as a tombstone.** Epic 2's numbering is not reshuffled, so no existing story key
in `sprint-status.yaml` changes meaning.

**Where the work went:** `WorkItem.scss`'s two hairline values are acceptance criteria on Story
2.31. `ProjectCard.scss` needs nothing, being retired.

---

### Story 2.19: REPLACED 2026-08-15 by Story 2.34 (migration step 4, sweep the colour literals)

**Replaced by the restyle scope change.** This story hand-swept 28 colour literals across 9 files.
Most of those files are now redesigned (Stories 2.27–2.33) and absorb their own literals as part of
being rewritten. The residue is `celeste.scss` plus whatever a future commit reintroduces, and a
one-time hand sweep cannot hold that.

**Story 2.34 replaces it with a blocking CI grep**, which is cheaper for a solo maintainer,
permanent rather than one-shot, and converts a task into an invariant that the eight redesign
stories cannot regress past. AD-21 gains the gate.

**Number retained as a tombstone**, so no existing story key changes meaning.

**Where the work went:** the conformance rule and `celeste.scss`'s two literals are Story 2.34.
`HomeLayout.scss` and `error-page.scss` literals are Stories 2.29 and 2.30. The `ScanlineOverlay`
blacks are Story 2.28. `navbar.scss` is Story 2.32. `_print.scss` stays outside the contract by
nature and is explicitly excluded from the gate.

---

### Story 2.20: Migration step 5, swap the type

As a Visitor,
I want the Ecosystem's typefaces rather than the previous site's,
So that the identity is complete rather than half-applied.

**Governing ADs:** AD-14 · **Depends on:** Stories 1.12, 1.18.
Realizes UX-DR12 and closes open item **O-6**.

> **Resequenced 2026-08-15.** This story survives the restyle scope change unchanged in content and
> **moves to the front of the redesign sequence**: it is now the first story of the restyle work and
> a blocking predecessor of Stories 2.27 through 2.33. The font layer is global and must land before
> any component is redesigned, or each redesign is authored against faces that are about to be
> deleted. It is also the change with the clearest SM-C5 benefit, since it removes three font
> binaries from `public/fonts/`.

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

### Story 2.21: DELETED 2026-08-15 (migration step 6, rename the call sites)

**Deleted by the restyle scope change, and this is the clearest waste the change removes.** The
story existed to walk fifteen component stylesheets from `var(--white-color)` to
`var(--token-text)`, undoing Story 1.18's aliasing one component at a time. A stylesheet rewritten
against `--token-*` from the first line has no call sites to rename. Every file this story touched
is either redesigned by Stories 2.27–2.33 or retired by Story 2.14.

Two of its constraints survive, relocated rather than lost:

- **Every call site consumes a `--token-*` semantic role and never a raw `--c-*` palette value.**
  Now an acceptance criterion on each redesign story, and enforced permanently by Story 2.34's gate.
- **`--hero-height` stays local**, being a layout constant rather than a design token; the contract
  carries no viewport heights. Now a criterion on Story 2.29, which owns `HomeLayout`.

**Number retained as a tombstone**, so no existing story key changes meaning.

---

### Story 2.22: Migration step 7, delete the aliases

As the Operator,
I want the transitional layer gone,
So that the contract is the only source and there is nothing left to drift from.

**Governing ADs:** AD-14 · **Depends on:** Story 2.33.
Realizes UX-DR14 and closes the migration.

> **Retargeted 2026-08-15.** Its trigger moves from "step 6 complete" to **"the last Hub component
> redesigned"**, and its second acceptance criterion changes, because under the restyle scope change
> the site is *not* expected to be visually identical: it has been deliberately redesigned. The
> alias layer's removal condition is now named in FR-37, and this story is where it is met.

**Acceptance Criteria:**

**Given** the aliases introduced in Story 1.18 exist only to keep un-redesigned component
stylesheets working while the redesign proceeds (AD-14, as clarified 2026-08-15)
**When** the last redesign story has shipped and the aliases are deleted from `app/app.scss`
**Then** `--white-color`, `--black-color`, `--light-gray-color`, `--gray-color`, `--page-padding`
and the five font aliases no longer exist
**And** a repository-wide search returns zero remaining references to any of them
**And** no component stylesheet in the tree still consumes an alias name, which is FR-37's first
consequence.

**Given** the contract is now the only source
**When** the site renders
**Then** Story 2.34's conformance gate passes
**And** `:root` in the compiled stylesheet carries only the contract's properties plus
`--hero-height`
**And** the rendered result is asserted against the redesigned baseline captured by Story 1.10's
harness, **not** against the pre-redesign build: the site is deliberately different by this point,
so a byte-identical comparison would be asserting the wrong thing.

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
**Then** the check **fails** rather than silently skipping: a Satellite that renames the folder
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

> **Note added 2026-08-15.** `list-wheel`'s **visual restyle is Epic 8 Story 8.3**, not this story.
> AD-20 requires them to be separate shipped steps: relocate, verify the subdomain serves, then
> restyle. Do not combine them, however tempting it is to touch the repository once: a relocation
> and a restyle failing together leaves no way to tell which one broke it.
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
**And** it has its own router matching on `Host`: `PathPrefix` routing between applications is
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
Satellites copy**: tokens carry the *colour* of a focus ring but cannot carry *when it appears*,
so this is the section that gets copied into every Satellite's hand-fix list.

**Acceptance Criteria:**

**Given** A-1 requires a visible focus indicator on every interactive element
**When** the focus rule is authored
**Then** it uses `:focus-visible`, never `:focus`: a mouse click on a link must not paint a ring
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
`tabindex` anywhere and focus never trapped: there are no modals on the Hub
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
**And** uppercase is structural only: prose is never uppercase, and no gradient text, no
synthesised bold or italic, and no italic heading appears.

**Given** the hallmark anti-patterns are treated as a conformance floor rather than a suggestion
**When** the Hub is reviewed against them
**Then** none of the structurally excluded tells is present: no three-column icon-tile grid, no
card-in-card, no full-viewport centred hero, no shadow anywhere, no gradient anywhere, no aurora
or orb or glass layer, no four-column footer, no emoji used as an icon, no invented metric
**And** accent occupies **≤3% of the viewport**, measured on the rendered homepage rather than
inferred from the rules
**And** per UX-DR44 every `z-index` in the tree resolves to one of the six named levels: an
ad-hoc value is a defect, not a style choice.

**Given** A-16 governs autoplay
**When** the homepage loads
**Then** nothing autoplays with sound and nothing auto-advances.

---

## Epic 2, continued: the Hub's components rebuilt token-native

*Added 2026-08-15 by the restyle scope change. Realizes FR-37.*

Eight stories replacing migration steps 3, 4, 6 and 7. Each rebuilds an inherited cybercore surface
against the token contract rather than tokenizing values in a file that is about to be rewritten.

**Specification depth. The blocker is lifted.** *(Amended 2026-08-15, after the UX restyle pass
closed.)* These stories previously carried no visual acceptance criteria, because the design
contract for these components did not exist. It exists now, in three files, and every story below is
written against it rather than toward it:

- [`RESTYLE-SPEC.md`](ux-designs/ux-cuatro-portfolio-2026-08-15/RESTYLE-SPEC.md), the
  framework-agnostic component vocabulary AD-24 requires. Ten elements, twelve floor checks, a
  stated ceiling.
- [`DESIGN.md`](ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md) § Components → The redesigned
  Hub surfaces, which owns every **value**.
- [`EXPERIENCE.md`](ux-designs/ux-cuatro-portfolio-2026-08-15/EXPERIENCE.md) § Component Patterns →
  The redesigned Hub surfaces, which owns every **behaviour**.

**The governing aesthetic decision, stated once and not repeated per story.** The glitch loop, the
red and cyan chromatic aberration, the scanline raster, the radial vignette and the SVG film grain
**retire**. The mono uppercase signage on a hairline, the notched panel silhouette, the readout
register and the leading-edge nav rule **survive**. The effects go because they are in structural
collision with the contract independent of colour, and because they are the half that cannot
federate across five frameworks maintained by one person.

**Precedence, when two documents disagree** (`RESTYLE-SPEC.md` § The vocabulary, as a total order):
`DESIGN.md` wins on any value, `EXPERIENCE.md` wins on any behaviour, `RESTYLE-SPEC.md` wins on
geometry and composition and on anything neither spine states, and any mock or implementation loses
to all three. A conflict that is genuinely none of the three is a defect in those documents and is
raised rather than decided in a stylesheet.

**Four criteria bind every story in this group** and are not repeated in each:

- **NFR-2 / AD-20.** `cuatro.dev` serves throughout and every existing route still renders.
- **AD-24 and FR-37.** The component consumes `--token-*` semantic roles only, never a raw `--c-*`
  palette value and never a literal. No colour, spacing or type literal survives in the redesigned
  file. Rendered output is asserted through Story 1.10's harness, not by reading the CSS.
- **UX-DR49's 140 KB non-3D budget**, measured against SM-C5 on every story. Story 2.20 deletes
  three font binaries and Story 2.27 deletes the `glitch-loop` keyframes; those are the two offsets
  available, and each story's contribution is **measured against Story 2.2's baseline rather than
  assumed**.
- **The diff is not reviewable as a CSS-only diff.** The ceiling permits markup changes where layout
  requires them, so review reads templates as well as stylesheets. This is a real review cost and it
  is named here rather than discovered per story.

**Story 2.20 is a blocking predecessor of every story below.** The type layer is global, and
redesigning against `--f-display` while Monument Extended is still the shipped face means designing
against a face about to be deleted.

---

### Story 2.27: Redesign `GlitchText` token-native

As a Visitor,
I want the Hub's most expressive component to belong to the Ecosystem's palette,
So that the identity holds at the exact surface a reviewer looks at first.

**Governing ADs:** AD-14, AD-19, AD-24 · **Depends on:** Stories 1.18, 2.20.
**Closes O-12 item 1** and **fixes O-13** at `GlitchText.tsx:72`.
**Measured against:** `EXPERIENCE.md` § Display entrance, `DESIGN.md` § Components → The redesigned
Hub surfaces, `RESTYLE-SPEC.md` § 6 Heading.

**Acceptance Criteria:**

**Given** the component becomes a **heading that arrives, not a heading that malfunctions**
**When** it is rebuilt
**Then** it sets in the display face at `wdth 100`, `--w-black`, `--t-display`, uppercase,
`--tr-display`, in `--token-text`
**And** the entrance is a per-character reveal on **`opacity` only**, staggered by DOM index through
a custom property, using `--dur-minor` and `--ease-entrance`, and **capped at ~500ms total**
*(the reference mockup runs 820ms and is wrong; a mock loses to all three specification documents,
review finding MED-3)*
**And** there is **no `text-shadow` at any keyframe, no `clip-path`, no `transform` offset and no
second hue**
**And** there is **no looping animation of any kind**: the retired `glitch-loop` ran every six
seconds forever, infinite loops are barred in § Interaction Primitives, and this component was the
estate's only instance.

**Given** O-12 item 1 is closed by dropping the aberration rather than excepting it
**When** the file is rewritten
**Then** the `glitch-loop` animation, its **eight keyframes and its two literals** are **deleted,
not tokenized**
**And** no `rgba(255, 0, 80, …)` or `rgba(0, 255, 255, …)` value remains anywhere in the tree
**And** Story 2.34's gate covers this file with **no exception**, which is the outcome the change
proposal recommended and the UX pass accepted.

**Given** O-13: `aria-label` sits on a plain `<div>` at `GlitchText.tsx:72`, and **a name on a
generic role is not reliably exposed by assistive technology**, so the component's accessible name
is not dependable today
**When** the accessible name is assigned
**Then** it is **the heading element's own text content**, with no `aria-label` on a wrapper and no
`aria-hidden` on the element carrying the words
**And** the fix is verified with a screen reader rather than asserted from the markup
**And** this is recorded as a **pre-existing defect corrected**, not as a defect this redesign
introduced.

**Given** the shipped implementation waits on `document.fonts.ready` before measuring, so **a font
that never loads means an entrance that never runs**
**When** the splitting implementation is written
**Then** the words are in the DOM **before** any split runs, and a split that throws leaves a
readable heading
**And** the heading is **visible at full opacity in that failure case**, never stuck at
`opacity: 0`
**And** the **scrambling glyph pool is retired**, because substituting random characters emits a
stream of nonsense to anything watching the DOM and makes the accessible name unstable during the
entrance.

**Given** `prefers-reduced-motion` is honoured
**When** the preference is set
**Then** the heading is **present at full opacity immediately**: not a faster entrance, not a
crossfade, and **nothing else about the component changes**.

**Given** § 6 bars a second display line and requires one `<h1>` per document
**When** the component is placed
**Then** there is **one display line per page**, and the document outline shows one `<h1>` with no
skipped levels.

**Given** SM-C5 counterbalances Hub asset weight under UX-DR49's 140 KB non-3D budget
**When** the redesign ships
**Then** the component's contribution to CSS weight is **measured against Story 2.2's baseline**,
and dropping the `glitch-loop` keyframes is **recorded as a reduction rather than assumed**.

**Given** the entrance animates `opacity`, and Story 2.34's gate rejects alpha outside `contracts/`
**When** the gate's permitted patterns are set
**Then** this component's `opacity` keyframes are covered by the **allowed-pattern** disposition
Story 2.34 records for animation, so the gate does not reject the entrance it was told to permit
*(review finding HIGH-5 item 1; the design permits `opacity` for entrance while barring it for
state, and the gate must know the difference)*.

---

### Story 2.28: Redesign `ScanlineOverlay` as the scrim layer, consuming `--token-scrim`

As a Visitor,
I want text over the moving narrative to stay legible without a scanline effect carrying the job,
So that the legibility guarantee is a value the contract owns rather than a side effect of an
ornament.

**Governing ADs:** AD-14, AD-19, AD-24 · **Depends on:** Stories 1.18, 2.20.
*(AD-16 is no longer a governing AD of this story: it adds nothing to the contract and bumps no
version.)*
**Closes O-12 item 2 outright.** *(Corrected 2026-08-15. The conditional is resolved: the effects
retire, but the **legibility job survives** as `--token-scrim`, specified with a worst-case contrast
guarantee.)*
**The role already exists.** `--token-scrim` and `--c-scrim` ship inside **`Contract v1.0.0`**,
published by Story 1.11. **This story consumes the role; it does not add it, and no version bump
occurs anywhere in Epic 2.**
**Measured against:** `DESIGN.md` § The scrim, `EXPERIENCE.md` § Scrim layer, `RESTYLE-SPEC.md`
§ The scrim.

**Acceptance Criteria:**

**Given** `ScanlineOverlay.scss:6`, `:16` and `:17` carry `rgba(0, 0, 0, 0.65 / 0.12)`, and § Rules
bars `#000` anywhere outside the print stylesheet
**When** the component is rebuilt
**Then** it is a **single flat `--token-scrim` layer at `--z-raised`** with `pointer-events: none`,
covering exactly the imagery it belongs to
**And** no pure black remains in the file
**And** the role is consumed as `var(--token-scrim)`, with **no literal reproducing the value**:
a hand-written `rgba()` that reproduces the composited colour is a contract break and Story 2.34's
gate rejects it.

**Given** the effect retires while the job survives
**When** the file is rewritten
**Then** there is **no `radial-gradient` vignette, no `repeating-linear-gradient` raster, no noise
asset and no animation**
**And** the shipped `light` / `full` intensity prop is **retired**: the layer has exactly one state,
because **a scrim that varies is a scrim whose guarantee varies**, and the guarantee is the only
reason the role exists
**And** the layer is either present at its one value or **absent**, never faint.

**Given** the layer is decorative by absence, carrying no content at all
**When** it is rendered
**Then** it is **`aria-hidden`, always, and never focusable**
**And** it never intercepts a click meant for what is beneath or beside it.

**Given** the scrim exists for **moving imagery under text, and nothing else**
**When** its placement is decided
**Then** it appears only where text overlays moving imagery
**And** it is **never a surface treatment**: not a card ground, not a section ground, not a vignette,
not a hover state
**And** the 404 surface carries **no scrim**, because nothing moves behind its text (Story 2.30).

**Given** the corrected contrast table: over the scrim, worst case over a pure white backdrop, the
roles compute to `--token-text` 13.51:1, `--token-focus` 9.02:1, `--token-accent-hover` 6.94:1,
`--token-text-secondary` 5.41:1 and `--token-accent` 4.77:1, every one clearing its own floor
**When** what may sit above the layer is decided
**Then** **every role is permitted over a scrim, and an interactive element may sit on one**, rest,
hover and focus landing as three legible steps
**And** the guarantee is verified by **screenshotting the composited surface, sampling the rendered
ground beneath the text and computing the ratio by hand**, never by trusting the table
**And** the earlier restriction to `--token-text` with nothing focusable is **not implemented**: it
rested on a contrast table computed by blending luminances rather than compositing in gamma-encoded
sRGB, which was wrong by a factor of seven. **See the flag below: two sentences in `DESIGN.md` still
carry the retracted rule.**

**Given** the guarantee is a property of the **stack**, not of the token
**When** the layer is positioned
**Then** an element has the guarantee only if the scrim is **genuinely beneath it**, and anything
painted above the imagery at a z-level higher than the scrim's computes against the **imagery**
instead
**And** this constraint is carried into Story 2.29, where the sticky header meets it.

> **⚠ Flag for UX, not a dev decision.** `DESIGN.md` contradicts itself here. § The scrim rule 4
> permits interactive elements over a scrim and says so explicitly, correcting the earlier draft.
> But § Components → The redesigned Hub surfaces still reads "Everything the layer permits above it
> is fixed by § The scrim, `--token-text` only, and nothing focusable", and § Home surface still
> reads "that panel carries no interactive element". Both are residue of the retracted rule and both
> are the unfixed half of audit finding H-10. Resolved here **three documents to one** under the
> § The vocabulary precedence order, since this is a behaviour question and `EXPERIENCE.md` owns
> behaviour. **Two sentences in `DESIGN.md` need deleting; that is UX's file to change, not this
> story's.**

---

### Story 2.29: Redesign `HomeLayout` token-native

As a Visitor,
I want the homepage's ground and structure to come from the contract,
So that the largest surface on the site is not the one exception to it.

**Governing ADs:** AD-14, AD-19, AD-24 · **Depends on:** Stories 1.18, 2.12, 2.20, 2.28.
The Hub's largest single surface. Absorbs `#0a000f` at `HomeLayout.scss:2` and the
`rgba(140, 90, 210, 0.06)` grid lines at `:4`–`:5`.
**Carries the z-level trap.** The scrim's guarantee is a property of the stack, so a sticky header
above the scrim is over the **imagery**, not over the **scrim**. This is the story where that bites.
**Measured against:** `EXPERIENCE.md` § Home surface, `DESIGN.md` § Components → The redesigned Hub
surfaces, `RESTYLE-SPEC.md` § The scrim.

**Acceptance Criteria:**

**Given** the panels keep their identity while the effects retire
**When** the surface is rebuilt
**Then** the corner panels **keep their notched `clip-path` silhouette**, which is geometry rather
than an effect: it costs nothing to federate and it carries most of what read as cybercore
**And** the **grid-line background is retired**, being a `linear-gradient` pair that § Rules bars in
backgrounds
**And** the ground is `--token-bg`
**And** nav items keep their **side-ruled leading edge**, with the rule at `--token-border`.

**Given** the scrim's guarantee belongs to the stack rather than to the token, and the header is
sticky at `--z-sticky` while the scrim sits at `--z-raised`
**When** the layering is built
**Then** the scrim spans the **canvas's full extent**, not merely the panel footprints, so a panel
cannot drift off its cover on a viewport nobody tested
**And** the header is **either positioned outside the canvas's box, or set on `--token-bg` rather
than relying on a scrim painted beneath it**, because a sticky header above the scrim computes
against the imagery
**And** the chosen resolution is verified by **sampling the rendered ground beneath the header's
text**, not by reading the z-index values.

**Given** `opacity: 0.2` on every non-hovered panel expresses state with opacity, which is barred
system-wide and silently takes contrast with it
**When** hover behaviour is rebuilt
**Then** the **dim-siblings-on-hover behaviour is retired**, and a panel that is not hovered is
simply not hovered.

**Given** the 3D canvas is decorative and its content is stated in prose (A-14)
**When** the canvas is rendered
**Then** it is **`aria-hidden` and not focusable**.

**Given** mobile is the authored width
**When** the surface renders below 768px
**Then** the panels **stack in reading order**: name, then imagery, then navigation, then contact
**And** the readout panel is **omitted rather than rendered empty**, per § Empty edge, because an
empty section reads as unfinished while an absent one reads as scoped.

**Given** the notch is a `clip-path` polygon of length literals and the contract mints no token for
the notch size
**When** Story 2.34's gate is written
**Then** this geometry is covered by the disposition Story 2.34 records for `clip-path`, so the gate
does not reject the silhouette the design told it to keep *(review finding HIGH-5 item 2)*.

**Given** `--hero-height` is a layout constant rather than a design token *(criterion relocated
from deleted Story 2.21)*
**When** the redesign lands
**Then** it stays local and is not moved into the contract, because the contract carries no
viewport heights.

**Given** the Three.js narrative's colours are JS values a custom property cannot reach
**When** FR-37 coverage is assessed
**Then** the 3D scene is out of scope as declared seam S-1, and this story does not attempt it.

**Given** `app/app.scss` currently sets `width: 100vw` and `overflow-x: hidden` on `body`, both of
which UX-DR43 changes
**When** the redesign lands
**Then** widths are `100%` with container padding and `overflow-x: clip` is used rather than
`hidden`, because `hidden` breaks the sticky positioning UX-DR22 requires of the nav.

---

### Story 2.30: Redesign `Error404` token-native

As a Visitor who has landed somewhere that does not exist,
I want the 404 to look like the rest of the suite and to say one thing once,
So that the error page is evidence of care rather than the one unfinished surface.

**Governing ADs:** AD-14, AD-19, AD-24 · **Depends on:** Stories 1.18, 2.17, 2.20.
**Carries O-12 item 3, which does NOT dissolve under redesign.** Whether the large decorative
numeral at `error-page.scss:28` is redundant to the visible 404 message is an accessibility
question that survives any redesign, so it is a binding criterion here rather than an open item.
**Both branches are now fully specified**, with the test and the treatment for each, so this story
tests and records rather than stalling. **Also fixes O-13** at `Error404.tsx:41`.
**Measured against:** `EXPERIENCE.md` § Error surface (including its two-branch table),
`DESIGN.md` § Components → The redesigned Hub surfaces, `RESTYLE-SPEC.md` § 8 Empty edge.

**Acceptance Criteria:**

**Given** the surface is a Plate mark, a display line, one supporting line and the exits
**When** the page is rebuilt
**Then** the structure is exactly: a **Plate mark** section variant, the display line, **one line**
of `--token-text-secondary` at `--t-sm`, then the exits as controls
**And** there is **one `<h1>`**
**And** the ground is `--token-bg` with **no grid overlay**
**And** there is **no scrim, because nothing moves behind this text**.

**Given** the numeral currently is a `<p>` reading `404` carrying `aria-label="Error 404"`, is
**not** `aria-hidden`, and sits on a generic role, so what a screen reader announces today is more
likely the bare digits or nothing
**When** the redundancy test is run
**Then** the test is: **with the numeral removed from the accessibility tree entirely, does a
screen-reader user still learn that this is a 404?** The page's accessible output is read top to
bottom and the page title, the heading and the message are checked together
**And** the test is **run, not assumed**, because it has a real chance of going either way
**And** the branch taken is **recorded**.

**Given** branch **A**, where the title, heading or message already says the page was not found
**When** branch A holds
**Then** the numeral is **`aria-hidden`** and purely decorative
**And** `--token-accent-muted` (2.74:1) is **correct**, because the contrast floor does not apply to
something that is not content
**And** the `aria-label` is **removed, not kept**: a hidden element does not need a name.

**Given** branch **B**, where the 404 exists only as the numeral
**When** branch B holds
**Then** the numeral **is text**
**And** `--token-accent-muted` is **forbidden**
**And** it takes **`--token-text-secondary`** (7.03:1 on paper), **not `--token-text`**, because it
is supporting information and the display line is the page's primary voice
**And** the `aria-label` is removed and **replaced by real text content**, since a name on a generic
role is not dependable.

**Given** the message line currently reads `Page not found.`, which carries the meaning without the
numeral, so **the cheaper fix is to make branch A true** by ensuring the page title also
distinguishes the route (A-13)
**When** the branch is chosen
**Then** making branch A true by fixing the title is **preferred over implementing branch B**, and
if branch A is achieved that way the fact is recorded
*(The two source documents disagree about which branch is likely, review finding MED-7. The test
settles it; neither prediction is binding.)*

**Given** O-13: `aria-label` sits on a `<p>` at `Error404.tsx:41`
**When** the component is rebuilt
**Then** **no accessible name is carried on a generic role anywhere in this component**, on either
branch
**And** this is recorded as a **pre-existing defect corrected**, not one this redesign introduced.

**Given** the Plate mark's label is read aloud, and the shipped site uses `// ERR_NOT_FOUND`, where
a screen reader speaks `slash slash E R R underscore NOT underscore FOUND` before reaching the
actual message
**When** the label is written
**Then** **either the `//` marker is styling and lives in CSS, or the label is plain words**, never
decoration inside a string
**And** the label is real words, because the label itself is read.

**Given** UX-DR33 requires exactly two exits matching the header, and § Empty edge permits an error
surface **never more exits than the header and never fewer**
**When** the page is rebuilt
**Then** it offers **Suite and CV and nothing else**
**And** the exits are **controls** per `RESTYLE-SPEC.md` § 1: transparent ground, `1px` border in
`--token-border-interactive`, square corners, mono uppercase label, at **`≥44×44px` on both axes
measured in a browser**
**And** the shipped `error-page__back` treatment, a `1px` outline at `4px` offset in neither the
token width nor the token colour, is **replaced by the standard focus ring**:
`--stroke-focus` solid `--token-focus` at `--focus-offset`, applied instantly and never
transitioned, on `:focus-visible` only.

**Given** `#0a000f` at `error-page.scss:7` and the grid lines at `:9`–`:10` are inherited literals
**When** the redesign lands
**Then** both are gone, the ground coming from `--token-bg` and the grid from `--token-border`
**And** the numeral's own font size sits **on the `--t-*` scale**, the shipped
`clamp(3.5rem, 14vw, 7rem)` being both off-scale and 56% above § Typography's `4.5rem` display cap,
which Story 2.34's gate would reject as a type literal *(review finding LOW-6)*.

---

### Story 2.31: Redesign `WorkItem`, and retire `HudLabel` into the Plate mark

As the Operator,
I want the row rebuilt and the duplicate label atom removed rather than restyled,
So that one component carries every readout on the site instead of two near-identical ones.

**Governing ADs:** AD-14, AD-19, AD-24 · **Depends on:** Stories 1.18, 2.20.
**Absorbs the whole of deleted Story 2.18.**
**`HudLabel` does not survive as a second atom.** *(Decided 2026-08-15.)* It and the Plate mark were
the same thing under two names, mono uppercase tracked on a hairline carrying section identity, and
two near-identical label atoms in a fifteen-component system is a smell. **This story therefore
retires an atom rather than restyling two**, and specifying both to five frameworks would have
doubled the cost of exactly what `RESTYLE-SPEC.md` exists to prevent.
**Measured against:** `RESTYLE-SPEC.md` § 7 Label, `DESIGN.md` § Components → Plate mark and → The
redesigned Hub surfaces, `EXPERIENCE.md` § Plate mark and § Work item.

**Acceptance Criteria:**

**Given** `HudLabel` is folded into the Plate mark
**When** the label atom is built
**Then** exactly **one** label component remains in the tree, and `HudLabel` is deleted rather than
aliased
**And** it sets in `--f-mono` at `--t-3xs`, uppercase, `--tr-label`, in `--token-text-secondary`, on
a `1px solid var(--token-border)` hairline, with `font-variant-numeric: tabular-nums` **always**, so
a readout does not jitter when a digit changes
**And** it carries **three variants and no fourth**: **section** (rule beneath, running the content
width), **annotated** (rule beneath, carrying a subordinate second line) and **side-ruled** (rule on
the leading edge with `padding-inline-start: var(--s-sm)`, mirroring to the trailing edge when the
label is end-aligned)
**And** section identity sets top-left with position or domain top-right
**And** it is **not interactive**: no hover, no focus, no tooltip, no disclosure. It is signage.

**Given** `--token-accent-muted` computes to 2.74:1 and is ornament only
**When** the subordinate line is implemented
**Then** it sets in `--f-mono` at `--t-3xs` in `--token-accent-muted` at `--tr-meta`
**And** it is **`aria-hidden` in every implementation without exception**
**And** **a subordinate line that carries information is a defect, not a styling choice**: any such
information is moved into the label itself, which is read.

**Given** § 7 bars a label below `--t-3xs`, a label in prose, and a label on every section
**When** labels are placed
**Then** they appear **only where a genuine ordinal or domain exists**, an eyebrow above every
heading being a named anti-pattern
**And** the check is run: **with CSS turned off, every label still reads as a short uppercase string
and every subordinate line is absent from the accessibility tree**.

**Given** the work item is **a row, not a card**, and a disclosure rather than an accordion group
with roving focus
**When** the component is rebuilt
**Then** the trigger is a **`<button>`** carrying `aria-expanded` and `aria-controls`, and the panel
is a labelled region
**And** `Tab` moves through triggers normally and is **never trapped**
**And** the first entry **opens on load without a collapsed-height flash**
**And** the row draws **no containing box, no background, no radius and no shadow**, separated from
its neighbour by a `1px solid var(--token-border)` hairline.

**Given** the open state must survive greyscale, so it cannot be carried by colour alone
**When** the open indicator is built
**Then** the leading rule changes **width and colour together**: `--stroke-emphasis` in
`--token-accent` when open, a `1px solid var(--token-border)` hairline when closed
**And** the element **reserves its widest state so nothing reflows**
**And** the change is on a **non-layout property**.

**Given** the shipped `rgba(91, 33, 182, 0.06)` hover ground is both an alpha fill and a second
signal
**When** hover is rebuilt
**Then** hover **recolours the trigger's border and never its ground**
**And** the tech chips are **outlined, never filled**: `1px solid var(--token-border-interactive)`,
no ground, mono `--t-3xs`, square
**And** the chips are **metadata and not interactive**, so they take no hover, no focus and no
target floor.

**Given** the `//` highlight marker is decoration
**When** it is rendered
**Then** it is **CSS generated content** in `--token-text-secondary`, not `--token-accent-muted`,
and it **stays out of the accessible name**
**And** the list is a list.

**Given** height is a layout property and this is the one place the system animates it
**When** `prefers-reduced-motion` is set
**Then** the height tween drops to **`0` duration**
**And** this is recorded as the **single named exception** to "only `transform` and `opacity`
animate", because a disclosure that jumps is worse than one that eases.

**Given** `rgba(91, 33, 182, 0.06)` at `WorkItem.scss:35` and `rgba(91, 33, 182, 0.3)` at
`WorkItem.scss:145` are alpha values used as hairlines *(criteria relocated from deleted Story
2.18; `ProjectCard.scss`'s three values need nothing, the file being retired by Story 2.14)*
**When** the component is rebuilt
**Then** each becomes a **flat token, never an `rgba()` with alpha**, because § Colors bars opacity
from expressing state and both of these are alpha values doing exactly that
**And** the rules render as `1px` and opaque
**And** a hairline no longer changes value with whatever sits behind it, which is why alpha cannot
federate in the first place
**And** the check is run: **the rendered pixel colour of any rule matches the computed value of
`--token-border` exactly, on every ground the rule appears over**.

**Given** `/work` and `/cv` both render `WorkItem`
**When** the change ships
**Then** both routes still render.

---

### Story 2.32: Redesign the chrome: `Navbar`, `Header`, `Logo`, `ContactContainer`, `Container`

As a Visitor on any route,
I want the persistent chrome to carry the identity,
So that the suite framing holds on the secondary routes and not only on the homepage.

**Governing ADs:** AD-14, AD-19, AD-24 · **Depends on:** Stories 2.15, 2.20.
**Sequenced after Story 2.15, never inside it.** 2.15 reshapes the nav to two destinations, which is
a structural change; this restyles the result. Absorbs `#fff` at `navbar.scss:10`.
**The 44px floor is this story's acceptance condition, and it is measured rather than read off the
CSS.** The shipped nav links measure roughly **16×27px**, which is the estate's worst instance of
the floor being missed while appearing to be met (§ Accessibility Floor, A-4).
**Measured against:** `EXPERIENCE.md` § Chrome, `DESIGN.md` § Components → Nav and → The redesigned
Hub surfaces, `RESTYLE-SPEC.md` § 1b Link.

**Acceptance Criteria:**

**Given** the shipped links measure ~16×27px, and **vertical padding on a plain inline element
paints outward without growing the hit area**
**When** the nav links are rebuilt
**Then** every nav link reaches **`≥44×44px` on both axes**, via `min-height` plus
`display: inline-flex` plus `padding-inline` where the label is narrower than 44px
**And** the floor is verified **by measuring the box in DevTools, never by reading the CSS**, which
is what makes this criterion different from the one it replaces
**And** two adjacent targets' boxes are confirmed **not to overlap**, with `--s-lg` of gap where two
sit on one line.

**Given** UX-DR22 fixes the nav's structure and UX-DR24 fixes the focus ring
**When** the chrome is rebuilt
**Then** the current route carries a `--stroke-emphasis` accent underline plus `aria-current="page"`,
the nav is sticky at `--z-sticky` and **does not hide on scroll**, because a header that disappears
costs Marcus the `Suite` link at the exact moment he wants it
**And** the focus ring is `outline: 2px solid var(--token-focus)` at `3px` offset, applied
instantly and never transitioned, on `:focus-visible` only
**And** nav links set in mono uppercase `--t-2xs` at `--tr-label` in `--token-text`.

**Given** an underline that appears on hover is a width change and it reflows the row
**When** hover is implemented
**Then** hover **recolours the existing underline** to `--token-accent-hover` and **does not add
one**, and nothing else moves.

**Given** the shipped `Container` uses `min(80%, 1920px)`, which spends 20% of a 360px viewport on
margin before any padding applies, and is what makes the mobile floor fail
**When** `Container` is rebuilt
**Then** it is **width-capped, not width-percentaged**: `width: min(100%, 1920px)` with
`padding-inline: var(--page-pad)`
**And** `Header` height is **content-driven** with `padding-block: var(--s-lg)`, never a fixed
`140px`
**And** the surface is checked at **360px with no horizontal scroll**.

**Given** `Logo` is a wordmark and it is text
**When** it is rebuilt
**Then** it sets in the display face at `wdth 75` / `--w-black`, and **the raster image retires**
**And** its accessible name is **the site name**, and it does not carry `alt` text describing a
picture.

**Given** A-9 requires a link to be self-describing out of context
**When** `ContactContainer` is rebuilt
**Then** it is a **list of links**, each meeting the target floor and each naming its destination
when read with the surrounding sentence removed.

**Given** `Celeste` suppresses the header by mutating
`document.querySelector('header').style.display` inside an effect, which **leaves the header hidden
if cleanup never runs**
**When** the chrome is restyled
**Then** the suppression moves to a **route-group layout or a `<body>` class**
**And** this is in scope precisely because it touches presentation only, and the restyle is the
right moment for it.

**Given** Story 2.26 sets the Hub's focus standard as the reference every Satellite copies by hand
**When** this story ships
**Then** its focus implementation **is** that reference, and Story 2.26 asserts against it rather
than against a separate one
**And** the ring is confirmed **present on keyboard focus and absent on mouse click**, on
`:focus-visible` and never on `:focus`.

**Given** the contract now mints **`--tap`** for the hit-target floor *(added 2026-08-16)*
**When** the nav links and every other control are written
**Then** they declare `min-height: var(--tap)` and `min-width: var(--tap)`, and **no `44px` literal
is hand-written anywhere**, Story 2.34's gate rejecting it as a spacing literal like any other
**And** the `font-variation-settings` axis literals this story sets on `Logo` remain covered by
Story 2.34's type-axis allowed-pattern disposition, no token existing or being needed for a
font-internal axis coordinate.

---

### Story 2.33: Redesign `WorkHero` and `WorkTimeline` token-native

As a Visitor reading the CV,
I want the timeline to look like the suite,
So that the route Daniela is most likely to open second is not the one that breaks the impression.

**Governing ADs:** AD-14, AD-19, AD-24 · **Depends on:** Stories 2.16, 2.20, 2.31.
**This is the last Hub redesign story, and it is what unblocks Story 2.22.** UX-DR28 reuses
`WorkTimeline` unchanged in *structure*; this story restyles it.
*(Depends on 2.31 because the timeline is a list of that story's work-item rows and its meta line is
that story's Plate mark.)*
**Measured against:** `DESIGN.md` § Components → Work hero and timeline, `EXPERIENCE.md` § Work hero
and work timeline.

**Acceptance Criteria:**

**Given** the hero's composition is fixed by § Work hero and timeline
**When** it is rebuilt
**Then** the display line sets left with the canvas right, **closed beneath by a
`1px solid var(--token-border-interactive)` boundary**
**And** the meta line is a **Plate mark**, not free mono text, so one component carries every readout
on the site
**And** the timeline is a **list of work-item rows**, with the **last row dropping its separator**.

**Given** the heading was inside an `aria-hidden` subtree on `main`, a defect fixed on `dev` by
PR #65
**When** this story ships
**Then** the heading is a **real `<h1>` and is not inside an `aria-hidden` subtree**, and the
redesign **does not reintroduce** the defect
**And** the `aria-hidden` belongs on the **decorative canvas only**
**And** the canvas is not focusable and is **not requested at all under
`prefers-reduced-motion`**.

**Given** Story 2.16 builds `/cv` around the existing `WorkTimeline` component reused unchanged
**When** this story runs
**Then** it changes presentation only and does not alter the component's structure, props or
behaviour, so 2.16's work is not redone
**And** `/work` keeps rendering standalone for anyone holding the URL.

**Given** UX-DR34's accordion behaviour is set by Story 2.16
**When** the restyle lands
**Then** the first entry still opens on load without a collapsed-height flash and the
`useReduceMotion` hook still drops the GSAP height tween to zero duration.

**Given** this is the last redesign in the group
**When** it closes
**Then** FR-37's alias removal condition is met and Story 2.22 is unblocked.

---

### Story 2.34: FR-17 conformance, no colour literal outside the contract

As the Operator,
I want the contract's coverage enforced by a machine on every push,
So that eight redesign stories cannot be undone by the ninth commit.

**Governing ADs:** AD-14, AD-21, AD-24 · **Depends on:** Stories 2.27 through 2.33.
**Replaces deleted Story 2.19.** A one-time hand sweep cannot hold a property; a blocking gate can,
and it is strictly cheaper for a solo maintainer.

**Acceptance Criteria:**

**Given** AD-21 makes every CI gate blocking and forbids downgrading one to a warning
**When** the check is added to `ci.yml`
**Then** it fails the build on any colour literal (`#` hex, `rgb(`, `rgba(`, `hsl(`, or a named
CSS colour) in any stylesheet outside the permitted set
**And** it is **blocking, never `continue-on-error`**
**And** the permitted set is exactly: `contracts/` (the contract defines the values) and
`_print.scss` (paper is genuinely white and toner genuinely black, so it is outside the contract by
nature)
**And** **Story 2.27 records no exception**, the aberration having been dropped rather than
excepted, so the permitted set carries no component-level entry at all *(amended 2026-08-15; the
earlier wording anticipated an exception that the UX pass decided against)*.

**Given** the contract carries exactly one alpha value, and **the alpha lives on `--c-scrim`, not on
`--token-scrim`**, the role being a plain `var()` reference like every other
**When** the alpha exception is written
**Then** it permits the alpha on **that one palette declaration inside `contracts/`** and rejects
alpha everywhere else
**And** it is written **against the palette entry, never against the role name**: a gate written as
"permit alpha on `--token-scrim`" **rejects `contracts/tokens.css` itself**, because that is the file
where the alpha actually sits *(review finding HIGH-4)*
**And** it still rejects **any hand-written `rgba()` that reproduces the same value** anywhere
outside `contracts/`, so the exception cannot be laundered by copying the composited colour.

**Given** four collisions between the gate and material this design newly specifies, **none of which
is named as an exception anywhere**, and which R8 would otherwise meet at scale on its first run
*(review finding HIGH-5)*
**When** the gate's scope is written
**Then** each is dispositioned explicitly rather than discovered:

| # | Collision | Disposition |
|---|---|---|
| 1 | **`opacity` keyframes** in the display entrance (Story 2.27) | **Allowed pattern.** The alpha check scopes to **colour functions only** (`rgba(`, `hsla(`, and slash-alpha inside `oklch()`), never to the `opacity` property. A grep cannot tell an entrance from a state, so barring `opacity` for state stays a design rule enforced in review, not a gate condition |
| 2 | **`clip-path` notch geometry** (Story 2.29) | **Allowed pattern.** The spacing check scopes to **spacing properties** (`padding`, `margin`, `gap`, and inset shorthands). Polygon coordinates are shape geometry, not values on the `--s-*` scale |
| 3 | **The `44px` hit-target literal**, in every control in the estate | **New token. Resolved 2026-08-16: `--tap: 44px` is minted into the contract** and ships inside `v1.0.0` alongside the scrim, on the same reasoning (Story 1.11 had not opened). **The gate therefore rejects a hand-written `44px` like any other spacing literal**, with no local-constant allowance, because a floor hand-written in five frameworks is a floor that drifts in five frameworks *(review finding LOW-2, closed)* |
| 4 | **`font-variation-settings` axis literals**, `"wdth" 100 / 85 / 75` and `"opsz" 48 / 24` | **Allowed pattern.** These are font-internal axis coordinates specified in `DESIGN.md` § Typography, not values on the `--t-*` scale, and no token exists or should |

**And** items 3 and 4 are **pre-existing but restated by every newly specified component**, so the
gate meets them at scale rather than occasionally
**And** each disposition is written into the gate's configuration **with its reason**, so a later
reader can tell an allowance from an oversight.

**Given** the residue not covered by a redesign story
**When** the gate is first run
**Then** `#444` at `celeste.scss:2` and `#fff` at `celeste.scss:16` are replaced with token roles
**And** the gate passes on a clean tree, so it lands green rather than red.

**Given** the Three.js narrative's colours are JS values a custom property cannot reach
**When** the check's scope is set
**Then** it covers stylesheets only, seam S-1 stands as a declared exception, and the check does
not attempt the 3D scene.

**Given** a gate that is easy to silence is not a gate
**When** the check is written
**Then** any suppression mechanism it offers requires a named exception in the permitted set rather
than an inline comment, so silencing it is a reviewed edit to a list rather than a one-character
change in a stylesheet.

---

## Epic 3: One repository, one deploy unit each, the Anchor merge and build in CI

Operator-facing and invisible to every Visitor in PRD §2.3, which is exactly why it sits after
Epic 2. The Estate drops from 11 repositories to 8, and the serving two-core box stops compiling.

Eight stories. **The merge order is fixed by AD-20 and is not negotiable**: the Hub moves to
`apps/hub` as its own shipped step with nothing else changing, then `cuatro-finance`, then
`cuatro-tracker`, then `cs-tournament`: one shipped and verified step each.

**A contradiction inside the spine, resolved here.** The Capability → Architecture Map assigns
`.github/workflows` → `contracts/workflows` to Epic 3, and the Structural Seed shows
`contracts/workflows/` existing. But the spine's own § Deferred bundles "published reusable
workflows" into the Epic 6 machinery, and addendum §E names an explicit trigger: the same
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
`deploy.yml`, `docker/Dockerfile`, `tsconfig.json` and `vitest.config.ts`: **and nothing more**.

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
**And** **no other behavioural change ships in this commit**: no product change, no dependency
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
**And** every route still renders: `/`, `/cv`, `/work`, `/recommendation`, `/celeste`,
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
**And** an app-directory context is confirmed to fail: it cannot see the lockfile or the
workspace links, so the pruned context is demonstrably necessary rather than merely chosen
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
**And** it **never runs a build**: no `--build` flag and no compile step reaches the box
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
token adoption is deferred to a later change rather than half-applied: AD-14 makes adoption
all-or-nothing.

**Given** AD-3 derives everything from one id
**When** the deploy unit is defined
**Then** the image is `ghcr.io/luigiespinosa/finance` tagged with the git sha, built from a root
context narrowed by `turbo prune --docker` with the Dockerfile at `apps/finance/Dockerfile`
**And** it has one compose service and, later, one router, never a `PathPrefix` share with
another application.

**Given** Prisma defaults to running migrations on boot in several deployment recipes
**When** the application is prepared
**Then** **migrate-on-boot is explicitly disabled**, per AD-23
**And** migrations run as a discrete step against the `finance` database before any rollout
**And** each migration is backward-compatible with the version still serving: expand first,
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
**Then** its Registry entry's `source` still resolves: to the Anchor if the source repository is
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
and compose service: AD-7 gives one deploy unit per application, not per repository
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

# Epics 4–7: coarse

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
**Blocked by:** Story 1.7 (the routing inventory, the rebuild must preserve four subdomains it
cannot enumerate from source) and Epic 3 (a host that pulls images requires images to exist).

**⚠ An ambiguity no input document settles.** Research calls this a "greenfield rebuild… cheap
because nothing has real users and you have said the box may be wiped," and specifies migrating
one subdomain at a time. But NFR-2 keeps four subdomains live throughout, and one-at-a-time
migration with everything serving implies parallel capacity: a temporary second VPS with a
marginal cost against NFR-4, or a parallel proxy on a 2 vCPU box whose load average SM-C4 says
wins every conflict. **Story 4.1 decides this; it is not assumed here.**

### Story 4.1: Refresh the settled inputs and choose the rebuild topology
Re-verify exactly AD-22's bounded list: Traefik, PostgreSQL, restic and `docker-rollout`
versions, Clerk and Railway pricing, the Style Dictionary security floor, the Let's Encrypt
lifetime schedule, and decide whether the rebuild runs on a temporary second box or in place.
**Depends on:** none within the epic.
**Acceptance intent:** the refresh covers that list and nothing outside it; no decision is
re-litigated merely because time passed; the topology choice is recorded with its cost against
NFR-4 and its load implication against SM-C4; PostgreSQL 18 versus 19 is decided here, since 19
was expected GA in September 2026. **Amended 2026-08-16:** two serving addresses already
existed on that date, so the temporary-second-box question has a partial answer in reality;
this story records the observed topology from `ops/routing-inventory.md` as its starting point
rather than assuming one box, and AD-22's re-check scope now includes that topology.

### Story 4.2: Traefik with Host-matched routers and DNS-01
Stand up Traefik v3.7 as the estate's proxy, with certificate issuance over DNS-01.
**Depends on:** 4.1.
**Acceptance intent:** every router matches on `Host` and `PathPrefix` routing between
applications does not exist; the Traefik dashboard is not publicly reachable without
authentication; certificate issuance and renewal are proven, and Story 1.2's certificate-age
monitoring sees the new certificates. **Amended 2026-08-16 by AD-26:** the origin no longer
runs ACME for a proxied host, so DNS-01 issuance is scoped to hostnames that are **not** behind
the Cloudflare proxy, and for proxied hosts Traefik serves the existing Origin CA certificate
instead. If every live hostname is proxied by the time this story opens, DNS-01 is configured
and proven against a scratch hostname rather than dropped, so the capability exists the day a
host needs to leave the proxy. AD-26's ordering rule applies: a public certificate is issued
before any host is taken off the proxy.

### Story 4.3: Migrate `list-wheel`: the static first candidate
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
governs every migration: discrete step before rollout, backward-compatible with the version
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
**Acceptance intent:** **amended 2026-08-16,** the Anchor's host move already happened in Story
1.21, so this story moves `cuatro.dev` onto Traefik on the rebuilt topology and does not repeat
the host migration. `https://cuatro.dev/contracts/` still serves the published surface, since
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
the new reality rather than left describing the old one. **Amended 2026-08-16:** the second
serving address was already decommissioned by Story 1.21, so this story retires Caddy on the
Hostinger VPS only and confirms that the earlier decommissioning was recorded rather than
repeating it.

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

### Story 5.4: `cs-tracker` authenticates, the JavaScript/Elixir boundary
**Depends on:** 5.3.
**Acceptance intent:** this pair is FR-21's acceptance condition and SM-9's binary; the identity
is observed carrying across the boundary by a person, not inferred from configuration; `oidcc`
3.8.0 is the Elixir client.

### Story 5.5: Sign-out reaches every session, including open LiveView sockets
**Depends on:** 5.4.
**Acceptance intent:** RP-Initiated plus Back-Channel logout, and `cs-tracker` **additionally
broadcasts on `live_socket_id`**: without it an open LiveView socket never observes the logout;
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
**Acceptance intent:** scheduled **on the host, outside the application containers**: an
in-process scheduler per application would keep a timer alive in every container on a CPU-bound
box; hourly by default with per-application override; the interval is short enough that two
Visitors arriving the same day both find a usable application.

### Story 5.11: Demo and identity declarations verified against reality
**Depends on:** 5.9, Story 2.23.
**Acceptance intent:** every `demo` declaration authored in Story 2.5 is now accurate, an entry
claiming a Demo Account has a working one; `MaiCoin` remains declared `wallet` and structurally
exempt rather than unimplemented; FR-28's release valve applies if capacity forces an application
offline.

---

## Epic 6: Token distribution machinery, deferred, earned

npm package, Renovate shareable preset, published reusable workflows. The published *shape* is
already fixed by AD-14 and AD-16, so nothing blocks later.

**FRs covered:** FR-19 *(machinery half)*
**Governing ADs:** AD-14, AD-16, AD-22
**Trigger:** three hand-copied token changes actually performed. **Not scheduled.**

> **The trigger restated, 2026-08-15, and the count corrected.**
>
> `--token-scrim` was banked here as the first of the three, by both `epics.md` and the approved
> change proposal. It ships **inside `Contract v1.0.0`** instead, and **a value present at first
> publication was never a change**. So the count does **not** fall from three to two: **it was
> always zero performed**, and what existed was an anticipated credit that never materialized. The
> defect was in the plan of record, not in the arithmetic *(review finding LOW-5)*.
>
> **What the trigger counts, stated so it cannot drift again:** a **contract release after
> `v1.0.0` that was actually hand-propagated into at least one Satellite's vendored
> `cuatro-contracts/` folder**. Three such events fire the trigger.
>
> **What it does not count:** anything present at first publication; any change to a document rather
> than to `contracts/`; and **Story 1.20's rehearsal**, which walks the process on a throwaway
> `v1.0.1` that is never published and never reaches an adopter.
>
> **The counter is at zero today and it can still reach three.** After Epic 8 three Satellites
> vendor the contract, so every post-`v1.0.0` change is hand-propagated by construction. Epic 6 is
> not further away than it was; it is exactly as far away as it always was, because the credit that
> made it look nearer was never real.
>
> **AD-16's cheap rehearsal is genuinely lost here, and that cost was not weighed when the timing
> was decided** *(review finding HIGH-6)*. `epics.md` had argued that exercising the change process
> on the cheapest possible change, months before anything expensive depended on it, was worth
> having. **Story 1.20 now recovers it deliberately** by writing the change-propagation runbook and
> validating it on an unpublished `v1.0.1`. Without that, the first exercise of the process would
> have been the first change that mattered.

### Story 6.1: Confirm the trigger has fired
**Acceptance intent:** three real hand-copied token changes are recorded, with dates; if fewer
than three, the epic does not open and that is the correct outcome: the mechanism is earned by
frequency, not by intent.

**Acceptance Criteria:**

**Given** the trigger counts contract releases after `v1.0.0` actually hand-propagated into at
least one Satellite's vendored folder
**When** the count is taken
**Then** each counted event is recorded with **a date, the version it moved from and to, and which
Satellites were re-vendored**
**And** the count **excludes** anything present at `v1.0.0`, any documentation-only change, and
Story 1.20's unpublished rehearsal
**And** if the count is **below three the epic does not open**, and that is the correct outcome.

**Given** a counter that lives only in memory is a counter that will be reconstructed wrongly
**When** the record is kept
**Then** it is **appended to the Story 1.20 record** as each event occurs, rather than reconstructed
from git history when Epic 6 is being considered
**And** the record states the count's **current value explicitly**, so the distance to the trigger is
readable at a glance rather than inferred.

### Story 6.2: Publish the token contract as an npm package
**Depends on:** 6.1.
**Acceptance intent:** the package is a convenience for JS consumers only; the `cuatro-contracts/`
folder and the published `contracts/` URL remain the contract for everyone else, because a
package cannot serve an Elixir or Go consumer.

### Story 6.3: A Renovate shareable preset
**Depends on:** 6.2.
**Acceptance intent:** NFR-10 still binds, **no automerge in any repository lacking a real test
suite**; Renovate opens pull requests and the Operator merges them.

### Story 6.4: Publish the reusable CI workflows to `contracts/workflows/`
**Depends on:** 6.1.
**Acceptance intent:** addendum §E's trigger is the same workflow copy-pasted into a **third**
repository; AD-1 holds: nothing under `contracts/` may be executable, and a workflow YAML
definition is a reference, not code the Anchor runs on a consumer's behalf. *(See Epic 3's note:
the Capability Map assigns this row to Epic 3, and this breakdown places it here on the strength
of the spine's § Deferred list and addendum §E.)*

---

## Epic 7: WSL2 relocation

Developer machine only. No ecosystem invariant depends on it, and it is independent of every
other epic: it can run at any point, including first.

**FRs covered:** none. Operator ergonomics.
**Governing ADs:** none, the spine records no invariant here.

### Story 7.1: Copy the repositories into the WSL2 ext4 filesystem
**Acceptance intent:** **copy first, delete only after verification**: the ordering is the whole
risk control; every repository is confirmed to build and its git history intact in the new
location before anything is removed from `C:\`.

### Story 7.2: Repair worktrees and Git configuration
**Depends on:** 7.1.
**Acceptance intent:** `git worktree repair` is run where worktrees exist; `safe.directory` and
`core.longpaths` are expected to need setting and are handled rather than discovered; no
repository is left in a state where a routine git operation fails.

---

## Epic 8: Every rendered application reads as one product

*Added 2026-08-15 by the restyle scope change. Realizes FR-36 and FR-38.*

After Epic 8 a Visitor moving between the Hub and any application in the Suite Directory finds not
just the same palette and type scale but the same component vocabulary: the same separators, the
same unfilled controls, the same focus ring, the same status discipline. The polyglot claim stops
resting on a shared file and starts resting on a shared specification implemented five times, which
is the harder and more interesting version of it.

**FRs covered:** FR-36, FR-38. *(FR-37 is Epic 2's; the Anchor is not a Satellite.)*
**Governing ADs:** AD-14, AD-16, AD-19, AD-20, AD-24, AD-25
**Blocked by:** Epic 2, which must first produce the Hub's component vocabulary. **The Restyle
Specification now exists** ([`RESTYLE-SPEC.md`](ux-designs/ux-cuatro-portfolio-2026-08-15/RESTYLE-SPEC.md),
`status: final`, v1.0.0), so this epic is written against a target rather than toward one.
**Epic number is not execution position.** Wave 1 runs after Epic 2; wave 2 after Epic 3.
**Specification depth: full acceptance criteria**, added 2026-08-15. Epic 8 was the only epic in the
plan carrying acceptance *intent* and no acceptance *criteria*, and it is the one whose stories touch
repositories outside this one.

---

#### Prerequisite: the floor's denominator, owned by Story 8.1

**O-14 and O-15 are verification, not implementation, and both are answerable in an afternoon from
outside each application.** They are **owned by Story 8.1 and answered there for all three wave-1
applications at once**, not for `cs-tracker` alone, because they set the cost of 8.2 and 8.3 as much
as of 8.1. Stories 8.2 and 8.3 consume that answer rather than re-deriving it.

*(This is deliberately not a separate story. A prerequisite nobody owns is how an estimate ends up
built on an assumed surface count, and a story ahead of 8.1 would move the actionable total off 93.)*

| Item | What must be determined |
|---|---|
| **O-14** | **Which surfaces of each wave-1 Satellite a Visitor reaches without authenticating.** This sets the floor's denominator. If a rendered application's only unauthenticated surface is a login screen, its floor collapses to one screen, and that must be known **before** the restyle is estimated |
| **O-15** | **What each wave-1 Satellite actually has installed**, so § Displacing a component library picks the right family. `cs-tracker` is **confirmed** family A (Tailwind v4 + daisyUI, O-7). `digital-library` and `list-wheel` are **assumed** family C and family B and are **not verified**. A strategy chosen against an assumed stack is worse than none |
| **O-17** | **Triage the residual review findings before 8.1 opens.** The independent-implementation audit returned 26 High findings and the token lens 6; the criticals are resolved in the spines and the remainder are recorded in the two reports. **Most bite a Satellite implementer rather than the Anchor**, which is exactly this epic. Triage is a reading pass, not a fix pass: each residual finding is dispositioned as *binding on a story here*, *already resolved*, or *accepted* |

---

**Four criteria bind every story in this epic** and are not repeated in each:

- **AD-24.** The restyle is implemented natively, from the Restyle Specification. The application
  imports no component, no class-name library, no `packages/*` artifact and no stylesheet from the
  Anchor beyond its vendored `cuatro-contracts/` folder. Recurrence of a component across three or
  more applications is evidence the *specification* should be better, never that a package should
  exist.
- **AD-25 / FR-38.** The application is rendered in the Suite Directory. A restyle story for an
  unrendered application is a defect, and SM-C6 targets zero always.
- **AD-19.** After restyle the application is measured **once by hand** against the accessibility
  floor: the 44×44 target floor by measurement in a browser rather than by reading CSS, the focus
  ring visible against all three grounds and confirmed not transitioned, and the greyscale check.
  The result is recorded, and a failure is recorded as a finding rather than silently corrected out
  of scope.
- **AD-20 / NFR-2.** The application's live hostname serves throughout, and the restyle reaches the
  Visitor as one merge with intermediate commits on a branch (AD-14, as clarified 2026-08-15).

**Presentation only.** A restyle that changes behaviour, routes, data or feature set has left this
epic's scope and PRD §8's carve-out, and is a defect rather than a bonus.

**The ceiling, stated once for the epic** (`RESTYLE-SPEC.md` § The ceiling). **Markup may change
where layout requires it**, because row-not-card is a layout rule that CSS alone cannot honour in an
application whose template emits cards. What comes out unchanged is the **same information, the same
destinations, the same interactions**. Permitted: card markup rewritten as row markup, class
structure rewritten, a wrapper added to reach a 44px target, an element split so a border can move,
a framework component class replaced with plain markup, a stylesheet deleted. Out of scope: a field
appearing or disappearing, a destination gained or lost, **the order a reader encounters information
in**, a new interaction or route, any change to data, schema, query or API, and **microcopy**.

**The reordering ban means DOM order**, and the two rules collide otherwise. Converting a card to a
row almost always changes *visual* order at some width, and that is permitted. What is forbidden is
changing the order a screen reader and a keyboard encounter the content in. § 2's grid template is
built on `grid-template-areas` for exactly this reason. **If a layout cannot be reached without
changing DOM order, change the layout, not the order.**

**Microcopy is out, and it is the tempting one.** Bringing an application's strings onto the Voice
and Tone contract would fix real inconsistency, and it is exactly the change that would put a
restyle story in a position to alter what an application says it does.

**A restyle diff is therefore not reviewable as a CSS-only diff.** Review has to read templates.
That is the price of making Story 8.1 achievable at all, and it is named here rather than discovered
in review.

**Seams S-4, S-5 and S-6 stay accepted permanently.** Form validation states, overlays and dense
data UI are below the ceiling. **The restyle raises the ceiling; it does not dissolve it.** No story
in this epic invents a cross-framework overlay convention, a shared validation vocabulary or a table
system, and an application's modal keeps its own focus trap. **Seam S-1 stands**: the Three.js
narrative's colours are JS values a custom property cannot reach.

---

### Story 8.1: `cs-tracker` visual restyle (Elixir, Phoenix LiveView, Tailwind v4, daisyUI)
**Wave:** 1. **Depends on:** Story 1.19, Epic 2, the Restyle Specification.
**First on purpose, for two reasons.** It is the only Satellite already on the contract from Story
1.19, so its restyle is the smallest delta in the estate rather than a standing start. And it is the
hardest framework in the estate, so failing here is cheapest first.
**Acceptance intent:** daisyUI's component defaults are displaced by the Ecosystem's vocabulary
rather than merely re-coloured by it. A daisyUI button carrying token colours is still a daisyUI
button, and § Components has no filled button anywhere in the system.
**Measured against:** `RESTYLE-SPEC.md` § Displacing a component library (family A), § The floor,
§ The ceiling.

**Acceptance Criteria:**

**Given** O-14 and O-15 are open, and an estimate built on an assumed surface count or an assumed
stack is worse than no estimate
**When** this story opens, **before any line is written**
**Then** **O-14 is answered for all three wave-1 applications**: the surfaces a Visitor reaches
without authenticating are **enumerated by route**, per application, from outside the application
with no login
**And** **O-15 is answered for all three**: what each actually has installed is **verified, not
assumed**, and each is assigned family A, B or C on that evidence. `cs-tracker` is confirmed family
A; `digital-library` and `list-wheel` are currently **assumptions** and are checked
**And** if a verified family contradicts the assumed one, **the affected story's strategy changes
before it opens**, rather than mid-implementation
**And** **O-17 is triaged**: each residual finding from the two review lenses is dispositioned as
binding on a story here, already resolved, or accepted
**And** all three answers are **written down**, because 8.2, 8.3 and 8.4 consume them.

**Given** family A's strategy is **neutralise the component layer, keep the utilities**
**When** the restyle is implemented
**Then** the plugin's **theme variables are mapped onto the token roles** (seam S-9), building on
whatever O-3 determined about `@plugin "daisyui/theme"` accepting a `var()` reference, which Story
1.19 front-loads; the documented fallback is plain CSS on a `[data-theme]` selector
**And** the plugin's **component classes stop being used on surfaces inside the floor**: `btn`,
`card`, `badge`, `alert`, `menu`, `navbar` and their modifiers are replaced by plain markup carrying
token-driven styles from § 1 to § 10
**And** **the utility classes stay**; only the component classes go
**And** **the plugin stays installed and every unrestyled surface keeps working**, nothing outside
the floor being touched.

**Given** the scope is a grep that returns a countable list before a line is written
**When** the work is bounded
**Then** the **component-class call sites are counted before and after**, and **after is zero on the
surfaces inside the floor**
**And** the count is recorded for Story 8.4.

**Given** **the grep is the starting count, not the whole scope**, and five things escape it
**When** the estimate is made
**Then** each is handled explicitly rather than discovered:

| # | What the grep misses | What the story does |
|---|---|---|
| 1 | **daisyUI has roughly sixty component classes, not the six named above** | Grep **the plugin's own class list**, never a remembered subset |
| 2 | **`core_components.ex` is invisible to a template grep**, and is itself a component layer | **Read it. It is one file.** The Phoenix v1.8 generator commits it into the application, and it *is* the component library for everything the generators emit |
| 3 | **Interpolated and conditionally-assembled class names** (`"btn btn-#{variant}"`) do not match a literal grep | Search for **the prefix**, not the full name |
| 4 | **A `navbar` and a `btn` are not one unit each** | The count is call sites; the **work is proportional to distinct components**, and a navbar is a day where a button is an hour. Estimate on components, report on call sites |
| 5 | **The surface list depends on O-14** | Answered in this story's first criterion, above |

**And** the second component layer is the one most easily missed: **an application that maps daisyUI
correctly and never opens `core_components.ex` will still render framework defaults.**

**Given** the floor is what makes this story's completion checkable
**When** the restyle is complete
**Then** **F-1 to F-12 pass on every surface inside the floor**, each by the method § The floor
states, and the evidence is handed to Story 8.4
**And** **F-4, F-6 and F-10 are given particular attention**, each being a check that fails while
appearing to pass: a component library's button looks unfilled until its `:hover` is checked, a
reset clears the outline in a layer nobody reads, and vertical padding on a plain inline element
paints outward without growing the hit area.

**Given** LiveView patches the DOM
**When** an animated container is patched
**Then** **seam S-8** applies: `phx-update="ignore"` on animated containers if patching visibly
interrupts a transition
**And** **seam S-7 stands**, the light theme having been dropped at adoption.

**Given** the vendored contract version must still be correct after the restyle
**When** it is re-checked
**Then** the vendored `cuatro-contracts/tokens.css` still reads `Contract v1.0.0` and the Registry
`token_contract` declaration still reads `1.0.0`, and **both are expected to be unchanged**
**And** **Epic 2 does not move the contract**: `--token-scrim` ships inside `v1.0.0` and Story 2.28
consumes it, so **no re-vendor is required and no version drift is expected here** *(corrected
2026-08-15; this story previously anticipated a `v1.1.0` bump that does not occur)*.

### Story 8.2: `digital-library` adopts the contract and is restyled (Svelte, SvelteKit)
**Wave:** 1. **Depends on:** Epic 2, the Restyle Specification.
**Two shipped steps, not one.** Adopt (vendor `cuatro-contracts/`, import the plain
`tokens.css` + `fonts.css` pair as a non-Tailwind consumer, apply the nine hand-fix lines), verify,
then restyle. AD-20 binds both halves and the first half alone already satisfies FR-18 for this
application.
**Acceptance intent:** this is the entry a Visitor is most likely to open from the Suite Directory,
so it is the application where the gap between "one author" and "one product" is most visible.
**Measured against:** `RESTYLE-SPEC.md` § Displacing a component library (family C), § 10 Media,
§ The floor.

**Acceptance Criteria:**

**Given** AD-20 requires each step to leave a working system, and adoption alone already satisfies
FR-18 for this application
**When** the work is sequenced
**Then** it ships as **two steps, not one**: **adopt** (vendor `cuatro-contracts/`, import the plain
`tokens.css` + `fonts.css` pair as a **non-Tailwind consumer**, apply the nine hand-fix lines in the
order the seams inventory gives them), **verify**, then **restyle**
**And** the two halves are **separate merges**, and the first is verified in production before the
second opens.

**Given** the family assignment for this application is currently an **assumption**, not a
verification (O-15)
**When** Story 8.1's verification pass reports
**Then** the family recorded there governs this story
**And** **if it is not family C, this story's strategy is rewritten before it opens** rather than
during it.

**Given** family C has nothing to displace, so the risk moves to two quieter places that are still
F-checks
**When** the restyle is implemented
**Then** **the browser's own defaults** are handled: form controls, `<button>`, `<select>` and
scrollbars render natively unless told otherwise, so `color-scheme: dark`, `border-radius: 0` and
the focus rule are applied and verified
**And** **the CSS reset is checked explicitly for a cleared `outline`**, because resets commonly
clear it in a layer nobody reads and **F-6 fails silently otherwise**.

**Given** `digital-library` renders book covers, and **§ 10 Media exists because of this
application**
**When** the cover grid is restyled
**Then** the grid is `repeat(auto-fill, minmax(<intrinsic>, 1fr))` at `gap: var(--s-md)`, and the
tile is **still not a card**: no ground, no radius, no shadow, no border box around the whole tile
**And** the border sits **on the image itself** at `--r-none` with intrinsic `width`/`height` set so
it reserves its space
**And** separation is **the gap, not a rule**
**And** a **missing image renders the bordered box empty at the correct aspect ratio** with the name
beneath, and **never a placeholder graphic, an icon or "no image" text**
**And** the check is run: **loaded on a throttled connection, nothing shifts position as images
arrive**
**And** the row-is-never-a-card rule **does not apply here**, this being the one place the estate's
list discipline gives way, because the image genuinely is the content.

**Given** the application has no `token_contract` value today
**When** adoption ships
**Then** its Registry entry **gains one**, and AD-18's scheduled drift check picks it up from that
point
**And** FR-9's `Hetzner VPS` correction is **Story 2.4's, not this one**.

**Given** the floor is what makes completion checkable
**When** the restyle is complete
**Then** **F-1 to F-12 pass on every surface inside the floor**, each by its stated method, and the
evidence is handed to Story 8.4.

### Story 8.3: `list-wheel` visual restyle (Angular, static build)
**Wave:** 1. **Depends on:** Story 2.25, Epic 2, the Restyle Specification.
**A separate shipped step after relocation is verified, never the same commit** (AD-20). A
relocation and a restyle failing together leaves no way to tell which one broke it.
**Acceptance intent:** the smallest surface in the estate and the only application with no
server-side component at all, which makes it the cheapest of the three and a useful check that the
Restyle Specification is implementable by someone reading it rather than inferring it.
**Measured against:** `RESTYLE-SPEC.md` § Displacing a component library (family B), § The floor.

**Acceptance Criteria:**

**Given** AD-20 forbids a relocation and a restyle failing together, because that leaves no way to
tell which one broke it
**When** the work is sequenced
**Then** the restyle is **a separate shipped step after Story 2.25's relocation is verified, never
the same commit**
**And** adoption and restyle may ship together **only if adoption has not already happened at
relocation time**, and even then **the restyle lands as its own commit**.

**Given** the family assignment for this application is currently an **assumption**, not a
verification (O-15), and family B is the assumption
**When** Story 8.1's verification pass reports
**Then** the family recorded there governs this story
**And** **if no opinionated component framework is actually installed, this is a family C story** and
its strategy is rewritten before it opens.

**Given** family B frameworks style components from inside their own encapsulation, where a global
stylesheet does not reach
**When** the strategy is chosen
**Then** **route 1 is preferred: do not use the framework's components on surfaces inside the
floor.** A control, a row and a label are a handful of elements each, hand-writing them is cheaper
than fighting a theming API, and it is the only route that produces the same result in five
frameworks
**And** **route 2 is the fallback**, used only where a component is genuinely load-bearing: drive it
through the framework's own theming API mapped to token roles, then **verify every one of F-1 to
F-12 against the rendered component rather than against the theme configuration**
**And** **a theming API with no input for "unfilled" or "square" is treated as evidence that route 1
was correct**, not as a reason to compromise the vocabulary
**And** `ViewEncapsulation.Emulated` is **not** treated as the obstacle: it stops component styles
leaking out, not global styles reaching in. The obstacle is specificity and the framework's own
defaults.

**Given** this application is the cheapest of the three and therefore the best test of the
specification itself
**When** the restyle is implemented
**Then** it is implemented **from `RESTYLE-SPEC.md` by reading it**, and **any point where the
implementer had to infer rather than read is recorded as a defect in the specification**, per the
independent-implementation test
**And** those findings go back to the specification rather than being solved locally, because a
point that needed inferring here will need inferring in four more frameworks.

**Given** the floor is what makes completion checkable
**When** the restyle is complete
**Then** **F-1 to F-12 pass on every surface inside the floor**, each by its stated method, and the
evidence is handed to Story 8.4.

### Story 8.4: Record the restyle floor and the per-application coherence check
**Wave:** 1. **Depends on:** Stories 8.1, 8.2, 8.3.
**The Story 1.20 equivalent for restyle**, and the story that makes SM-12 real rather than asserted.
**Acceptance intent:** SM-12 is recorded per application, not in aggregate, with results written down
and failures recorded as findings rather than silently corrected.
**Measured against:** `RESTYLE-SPEC.md` § The floor and § Recording a restyle.

**Acceptance Criteria:**

**Given** an application counts as restyled only when the whole floor holds
**When** each of the three wave-1 applications is assessed
**Then** **all twelve checks are recorded, F-1 to F-12**, each **by the method the specification
states**, and each as an explicit pass or fail:

| # | Check | The method, and it is the method that is binding |
|---|---|---|
| **F-1** | Ground is `var(--token-bg)`; no `#000` and no `#fff` outside a print stylesheet | **Sample the rendered pixel** |
| **F-2** | The three families **actually render**: display, body, mono, with no silent fallback | **`document.fonts.check()` per family, or the Network panel.** `getComputedStyle().fontFamily` returns the declared *stack* and **passes identically when every woff2 has 404'd**, so it must not be the check |
| **F-3** | Every divider is a 1px opaque hairline at a token value; no alpha rules, no side-stripes | **Sample any rule** and compare to the computed token value |
| **F-4** | **No filled control on any reachable surface** | **Screenshot every surface**; no control has a ground. Check `:hover` too |
| **F-5** | Square corners on every control, container and form field | **Computed `border-radius` is `0`** |
| **F-6** | The focus treatment on every interactive element, instant and never removed | **Keyboard-only traversal** |
| **F-7** | No `box-shadow` and no gradient anywhere | **Grep the built CSS** |
| **F-8** | **No accent background fill anywhere** | **Grep the built CSS for `--token-accent` used as `background`, `background-color` or `fill`, at any state including `:hover`. Zero occurrences.** The 3%-of-viewport figure is **design intent, not a gate**: it has no defined denominator and eyeballing it is not a check |
| **F-9** | The state vocabulary is carried structurally and survives greyscale with no legend | **Greyscale render with the legend and the status words masked.** Masking the words is what makes this a test rather than a reading exercise |
| **F-10** | Interactive targets `≥44×44px` on **both** axes | **DevTools box model, measured in a browser and never read off the CSS.** Also confirm two adjacent targets' boxes do not overlap |
| **F-11** | `color-scheme: dark` on `:root`; `::selection` sets **both** `background` and `color` | **Computed style, then select some text.** Accent as a selection ground is the one permitted accent fill, and F-8's grep excludes `::selection` explicitly |
| **F-12** | **The vocabulary's geometry is present, not just its colours** | **Compare the rendered row against § 2's grid template at 359px, 390px, 759px and 761px.** Without this check two applications can pass F-1 to F-11 and share none of the layout the specification exists to federate |

**And** F-2, F-8 and F-9 are used **as stated above**, their original methods having amounted to
"look at it" and been rewritten after audit
**And** **F-4, F-6 and F-10 are expected to be the three that fail most often**, each failing while
appearing to pass.

**Given** § Recording a restyle fixes what the record contains
**When** the record is written
**Then** it carries, **per application**: the Registry `id`; the framework family (A, B or C, **as
verified in Story 8.1, never as assumed**); the **surfaces inside the floor enumerated by route**;
**F-1 to F-12 pass or fail with how each was checked**; the component-class call sites **before and
after** where family A applies; AD-19's manual pass with **its date and what it found**; the
**greyscale render attached**; and the **contract version consumed**, from the Satellite's
`token_contract` Registry field.

> **Note.** `RESTYLE-SPEC.md` § Recording a restyle currently lists this row as `F-1 … F-11`, and
> § The floor opens by saying an application passes "only when all eleven hold", while the table
> below it defines **twelve**. Both counts are residue from before F-12 was added. **Twelve is
> correct and is what this story records.** Flagged to UX; it is a two-word fix in their file.

**Given** the four manual UX checks are what SM-12 has always meant
**When** each application is assessed
**Then** all four are run and recorded: **keyboard-only traversal**, **360px with no horizontal
scroll**, **greyscale render with the Status taxonomy still distinguishable**, and
**`prefers-reduced-motion` forced**
**And** AD-19's **measured** 44×44 floor is recorded alongside them
**And** **AD-19 binds every restyled application, not `cs-tracker` alone**: three passes in wave 1,
two in wave 2, recorded per application, because a restyle can lower contrast, break a focus ring or
shrink a hit target in ways no CI job on the Anchor can see
**And** **a failure is recorded as a finding rather than silently corrected out of scope**.

**Given** AD-18's per-Satellite drift check compares a declaration against **its own vendored file**
rather than against the current contract, so it cannot see who is behind
**When** the record is written
**Then** it names **each application's vendored contract version**, so the Operator can see who is
behind **at a glance**
**And** this is stated as **the gap AD-18 does not cover by design**, rather than as a duplicate of
it.

**Given** AD-25 and SM-C6
**When** the record is closed
**Then** **SM-C6 reads zero throughout**: no application is restyled before the Suite Directory
renders it, and **a restyle work item for an unrendered application is a defect, not enthusiasm**.

### Story 8.5: `cuatro-tracker` visual restyle
**Wave:** 2. **Depends on:** Story 3.6, Story 8.4.
Rendered in the first public Suite Directory, so FR-38 applies. A Tailwind consumer inside the
Turborepo after the Epic 3 merge, so it imports `tailwind.css`.
**Acceptance intent:** restyled **after** its merge ships and is verified, never during it, because
AD-20 requires each merge step to change nothing else.
**Measured against:** `RESTYLE-SPEC.md` § The floor, § The ceiling, § Displacing a component library.

**Acceptance Criteria:**

**Given** AD-20 requires each merge step to carry nothing else
**When** the work is sequenced
**Then** the restyle opens **only after Story 3.6's merge has shipped and been verified**, and lands
as **its own merge** with intermediate commits on a branch.

**Given** the application is a Tailwind consumer inside the Turborepo after the Epic 3 merge
**When** it consumes the contract
**Then** it imports **`tailwind.css`**, the generated adapter, rather than the plain pair
**And** the `--token-*` and Tailwind `--color-*` namespaces stay **distinct**, a mapping like
`--color-bg: var(--color-bg)` being a self-reference that falls back to `transparent` the moment a
bundler flattens the imports.

**Given** its family is not yet verified, wave 1's O-15 pass having covered only the three wave-1
applications
**When** this story opens
**Then** **what it actually has installed is verified first**, and the family A, B or C strategy is
chosen on that evidence
**And** its **surfaces inside the floor are enumerated by route** before the work is estimated.

**Given** AD-2 permits an `apps/*` member to depend on `packages/*`, while AD-24 still binds
**When** the restyle is implemented
**Then** **no shared React component package is created for this work**. One is created **only after
real duplication has accumulated across two or more apps**, never in advance, and **never because two
applications are being restyled at once**
**And** recurrence of a component across three or more applications is evidence **the specification
should be better**, never that a package should exist.

**Given** the floor and the ceiling bind every restyled application
**When** the restyle is complete
**Then** **F-1 to F-12 pass on every surface inside the floor**, each by its stated method
**And** AD-19's manual accessibility pass is **run and recorded for this application**
**And** the results are added to Story 8.4's record.

### Story 8.6: `cs-tournament` visual restyle
**Wave:** 2. **Depends on:** Story 3.7, Story 8.4.
Rendered in the first public Suite Directory, so FR-38 applies.
**Acceptance intent:** restyled after the Vercel exit and the merge have shipped and been verified,
not during either.
**Measured against:** `RESTYLE-SPEC.md` § The floor, § The ceiling, § Displacing a component library.

**Acceptance Criteria:**

**Given** AD-20 requires each step to carry nothing else, and this application has **two** preceding
steps rather than one
**When** the work is sequenced
**Then** the restyle opens **only after both the Vercel exit and Story 3.7's merge have shipped and
been verified**, and lands as **its own merge**
**And** it is **never combined with either**, because three changes failing together leaves no way to
tell which one broke it.

**Given** its family is not yet verified
**When** this story opens
**Then** **what it actually has installed is verified first**, the family strategy is chosen on that
evidence, and its **surfaces inside the floor are enumerated by route** before the work is estimated.

**Given** AD-2 permits an `apps/*` member to depend on `packages/*`, while AD-24 still binds
**When** the restyle is implemented
**Then** **no shared React component package is created for this work**, on the same terms as Story
8.5: only after real duplication has accumulated across two or more apps, never in advance, and never
because two applications are being restyled at once.

**Given** the floor and the ceiling bind every restyled application
**When** the restyle is complete
**Then** **F-1 to F-12 pass on every surface inside the floor**, each by its stated method
**And** AD-19's manual accessibility pass is **run and recorded for this application**
**And** the results are added to Story 8.4's record.

---

### Not in this epic, by rule

`StreamVault`, `MaiCoin`, `poketracker-go`, `Mutuo` and `cuatro-finance` have **no restyle story**,
and their absence is the decision rather than an omission. AD-25 creates one at the moment any of
them begins rendering in the Suite Directory, and not before. Restyling an unrendered, unbuilt
application is work with no Visitor-visible return, and it spends the Operator, who is the estate's
scarcest resource.

Two consequences worth stating:

- **SM-C6 targets zero** restyles ahead of rendering, and is the counter-metric that enforces this.
- **PRD §13 Q10 gets cheaper to answer.** Each of the four unbuilt applications now imports a
  restyle as well as feature work at the moment it becomes rendered, and archiving one closes both
  obligations permanently.

---

## Appendix: `sprint-status.yaml` regeneration instructions

*Added 2026-08-15 by the restyle acceptance-criteria pass. Hand to `bmad-sprint-planning`. These
**supersede nothing** in the change proposal's §7.3; they are the delta this pass creates on top of
it.*

**Actionable stories stay at 93.** This pass added no story and deleted none. Any regeneration that
produces a different total has gone wrong.

### 1. Rename two keys, and only two

Both stories are `backlog` and nothing has started, so renaming is free. §7.3's rule is that **no
existing key changes meaning**, which was written to protect keys against renumbering. A key
describing work its story no longer does is the same defect the rule exists to prevent, so here the
rule argues **for** the rename rather than against it.

| Story | Old key | New key |
|---|---|---|
| 2.28 | `2-28-redesign-scanlineoverlay-token-native-and-add-token-scrim` | `2-28-redesign-scanlineoverlay-as-the-scrim-layer-consuming-token` |
| 2.31 | `2-31-redesign-workitem-and-hudlabel-token-native` | `2-31-redesign-workitem-and-retire-hudlabel-into-the-plate-mark` |

**Why 2.28 must change.** Its key is the **last surviving statement anywhere that the role is
added**. The role ships inside `Contract v1.0.0` and this story consumes it. Left alone, the key
outlives every corrected sentence in this document.

**Why 2.31 changes with it.** Its title changed in the same pass, and the story now **retires**
`HudLabel` rather than redesigning it. Renaming one key and not the other would leave the convention
applied inconsistently, which is the failure mode the decision was meant to close.

**Keys are truncated to 64 characters**, matching the existing convention
(`2-32-redesign-the-chrome-navbar-header-logo-contactcontainer-cont`).

**No other key changes.** Epic 1's twenty keys, the Epic 2 holes at 2.18, 2.19 and 2.21, and every
Epic 3 to 8 key stay exactly as they are.

### 2. Replace three stale comment blocks

| Location | Currently says | Should say |
|---|---|---|
| Above `2-27` | "**BLOCKED** until the UX restyle pass lands: these eight have no design contract yet" | The restyle pass landed 2026-08-15 and `RESTYLE-SPEC.md` is final. **The block is lifted.** 2-20 remains a blocking predecessor of all eight |
| Above `epic-8` | "**BLOCKED** by epic-2 and by the UX Restyle Specification, **which does not exist yet**" | Blocked by epic-2 only. The Restyle Specification exists and every story carries full acceptance criteria |
| Header block | "Actionable stories: 82 -> 93" | Unchanged, still correct |

### 3. Add one comment recording the prerequisite

Above `8-1`, record that **O-14, O-15 and O-17 are answered inside Story 8.1 for all three wave-1
applications**, because 8.2 and 8.3 consume that answer. A reader scheduling 8.2 without it will
estimate against an assumed surface count and an unverified framework family.

### 4. What does not change

- **No epic status changes.** Everything stays `backlog`; this was a planning pass.
- **No renumbering**, and the three Epic 2 holes stay holes.
- **Execution order comment stays as written**: Epic 8 wave 1 after Epic 2, wave 2 after Epic 3.
