# Epic 3 Context: One repository, one deploy unit each, the Anchor merge and build in CI

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Turn the Anchor (`cuatro-portfolio`) into a Turborepo workspace, move the Hub into `apps/hub`,
build every Anchor image in GitHub Actions and deploy by pulling a sha-tagged image, then absorb
`cuatro-finance`, `cuatro-tracker` and `cs-tournament` as `apps/finance`, `apps/tracker` and
`apps/tournament` with their history intact. The epic is Operator-facing and invisible to every
Visitor. It shrinks the Estate by three repositories and ends the standing violation in which the
serving two-core box compiles on every deploy. It supports "nothing live may break" and the
capacity ceiling; it covers no functional requirement directly.

## Stories

- Story 3.1: Introduce Turborepo and pin the toolchain
- Story 3.2: Move the Hub to `apps/hub`
- Story 3.3: Build the Hub image in CI and push to GHCR
- Story 3.4: Deploy by pulling a tag with `docker-rollout`
- Story 3.5: Merge `cuatro-finance` into `apps/finance`
- Story 3.6: Merge `cuatro-tracker` into `apps/tracker`
- Story 3.7: Merge `cs-tournament` into `apps/tournament` and leave Vercel
- Story 3.8: Record the Estate end state

## Requirements & Constraints

- Nothing live may break: `cuatro.dev`, `cs-tracker.cuatro.dev`, `tracker.cuatro.dev` and
  `library.cuatro.dev` serve through every step, and every step leaves a working system.
- The serving box has 2 vCPU and no proven headroom. A new placement on it is gated by the
  Capacity Gate (`ops/capacity-gate.yml`); an id already in `placements` always deploys.
- One environment, no staging: CI is the only pre-production gate, so every gate is blocking and
  none may become a warning (typecheck, unit tests, Registry schema, `contracts/` purity, the
  Playwright floor, Lighthouse accessibility, the colour-literal conformance check).
- Merging an application into the Anchor is not placing it on the box. Each merge story ends with
  the application merged, building in CI and its image in GHCR; placement is a separate decision.
- Work on `dev` is committed, not live. `cuatro.dev` deploys from `main`, merged once per epic.
- The Estate end state is written against the waypoint `ops/estate.md` records (13 repositories
  since 2026-09-26; SM-7's end-state target rose from 8 to 10 the same day, after the epic text
  was written), and the Registry entry count is deliberately a different number.

## Technical Decisions

- **Turborepo boundary.** `apps/*` may depend on `packages/*`; no Satellite may depend on any
  `packages/*` artifact. Turborepo orchestrates JS/TS only, never Elixir, Go, Python or Solidity.
  A shared React package is created only after real duplication across two or more apps.
- **The published surface is `contracts/` alone**, and nothing executable lives under it; it stays
  at the repository root, as do `packages/`, `ops/`, `turbo.json` and `pnpm-workspace.yaml`.
- **One id, derived everywhere:** kebab-case repository name gives the GHCR image, the compose
  service, the router and the Postgres database and role (hyphens to underscores). Hostnames are
  declared in the Registry, never derived.
- **One deploy unit per application:** one Dockerfile, one image, one compose service, one
  `Host`-matched router per id. A deploy names exactly one id and Turborepo scopes its build to
  that workspace. `PathPrefix` sharing between applications is forbidden.
- **Build in CI, never on the box.** Images are `ghcr.io/luigiespinosa/<id>:<git-sha>`, never a
  floating tag. For Anchor applications the build context is the repository root narrowed by
  `turbo prune --docker`, with the Dockerfile at `apps/<id>/Dockerfile`: an app-directory context
  cannot see the lockfile or the workspace links. Deployment pulls a tag and runs `docker-rollout`
  (v0.14), which needs real healthchecks and services with no `container_name` and no published
  `ports`. `ops/deploy-remote.sh` is the deploy key's forced command: keep its path, and keep the
  sha the last word of the workflow's command string.
- **Migrations** run as a discrete step before a rollout, never on container boot, and each is
  backward-compatible with the version still serving (expand first, contract later).
- **Merge mechanism:** `git filter-repo --to-subdirectory-filter apps/<id>` on a scratch clone of
  the source, then `git merge --allow-unrelated-histories`; `git log --follow` must work from the
  new path afterwards.
- **Stack pins:** Node.js 24 LTS, pnpm 10.31.0 (the `packageManager` field), Turborepo 2.10.x,
  Next.js 16, Vitest 4, `@playwright/test` 1.62.1 inside `mcr.microsoft.com/playwright:v1.62.1-noble`.
- **Postgres consumers** get one database and one role each with an explicit `connection_limit`;
  never schema-per-application.
- **Reusable workflows** are built in `.github/workflows`; publishing them to
  `contracts/workflows/` is deferred to Epic 6.

## Cross-Story Dependencies

- The order is fixed and not negotiable: 3.1, then the Hub move (3.2) as its own step with nothing
  else changing, then image build (3.3), pull-based deploy (3.4), then the three merges in order
  finance (3.5), tracker (3.6), tournament (3.7), then the end-state record (3.8).
- Story 3.2's permitted rewrite surface is exactly `ci.yml`, `lighthouse.yml`, `deploy.yml`,
  `docker/Dockerfile`, `tsconfig.json` and `vitest.config.ts`, plus the move itself; it carries the
  Playwright job, the Registry schema gate and the Lighthouse accessibility assertion across
  intact. Anything the move needs from the workspace must therefore already exist after 3.1.
- Story 3.3 answers `ops/token-contract.md` actions 4 and 5 (the pruned install and a real run of
  the image's `deps` stage). Story 3.4 closes the build-on-the-box entry in
  `ops/known-violations.md` with a dated closure rather than a deletion.
- Story 3.6 relies on `ops/routing-inventory.md` for how `tracker.cuatro.dev` reaches the box, and
  backs up and verifies the restore of its data before cutover. Story 3.7's Vercel leaving is
  already done (Registry 1.4.0); its merge and placement remain, and placement is AD-9 gated.
- Epic 8 wave 2 restyles `cuatro-tracker` and `cs-tournament` only after their merges ship.
- `/bmad-project-context` (refresh) is due before Epic 4, because this epic changes the paths and
  the deploy pitfall the `AGENTS.md` block describes.
