<!-- bmad:context -->
<!-- Verified 2026-08-15 against 3a71afb. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## cuatro-portfolio

The live portfolio at cuatro.dev, shipping at v2.5.3. Next.js 16 / React 19 / TypeScript,
Sass (no Tailwind), pnpm, Vitest, deployed by Docker Compose to one Hetzner box. It is
becoming the Anchor of the Cuatro Ecosystem, a Turborepo of four apps publishing the
contracts seven Satellites consume, but that structure arrives in Epic 3; today this is
one app. Planning artifacts live in `_bmad-output/planning-artifacts/`.

## Policy

- Every CI gate is blocking. Never downgrade a gate to a warning, skip one, or mark a
  check `continue-on-error` to get a story green. There is one environment and no
  staging, so CI is the only gate before production (AD-21).
- cuatro.dev deploys from `main` on every push. Every change leaves a working system
  (AD-20, NFR-2).
- Commit messages are a subject line only: no body, no `Co-Authored-By` trailer.
- Never use an em-dash, an en-dash, a double-dash standing in for a dash, or an emoji in
  any prose, comment, commit subject, or documentation written here. Use a comma, a
  colon, parentheses, or two sentences. CLI flags and CSS custom properties are not
  prose and keep their dashes.
- Never add third-party analytics, a tag manager, or a session recorder. Measurement is
  first-party self-hosted Umami only (NFR-8).

## Where things are

- Architecture invariants AD-1 through AD-23:
  `_bmad-output/planning-artifacts/architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md`.
  Every story in `epics.md` names its governing AD. Read that AD before starting.
- Token contract and the SCSS-to-token migration order:
  `_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md`

## Running and verifying

- `pnpm` is not on PATH on this host. Prefix every command with `corepack`, as in
  `corepack pnpm build` or `corepack pnpm typecheck`.
- `corepack pnpm test` starts Vitest in watch mode and never exits. Always pass `--run`.
  The full suite is 38 tests in roughly 45 seconds, so run all of it.
- There is no lint gate and no working lint command: the script is misspelled `linkg`,
  and `next lint` was removed in Next 16, so `corepack pnpm linkg` fails too. Do not put
  lint in an acceptance criterion, and do not add an `eslint` invocation to CI, until a
  story lands a flat `eslint.config.mjs`.
- CI (`.github/workflows/ci.yml`) runs typecheck and tests only. Lighthouse CI runs
  separately on `main` and PRs and asserts accessibility at 0.95 or above, so an a11y
  regression fails the build even though no unit test covers it.
- Playwright is not installed. `@playwright/test` appears only as a transitive lockfile
  entry, not in `package.json`. Story 1-10 installs it. Until then no acceptance
  criterion may claim a rendered-output or browser check.

## Conventions that differ from defaults

- `--token-*` (semantic) and Tailwind's `--color-*` are separate namespaces. The same
  name must **never** appear on both sides of a `var()`. A self-reference survives only
  by cascade accident and dies when a bundler flattens it (AD-14).
- Creating or editing `contracts/`? It is the published surface: no `.ts`, `.js`, `.tsx`,
  `.jsx`, `.mjs`, or `.cjs` under it, ever, because CI fails on any of them. Generators
  and schema tooling go in `packages/`, which is never published (AD-1).
- A consumer's vendored contract folder is named `cuatro-contracts/` exactly. A scheduled
  job locates tokens by that fixed path across seven repositories (AD-14, AD-16).
- Registry data is hand-authored `contracts/registry.json`, schema-validated in CI. From
  Epic 2 onward, editing `content/projects.ts` to change registry data is the wrong file
  (AD-4, C-6).
- Name a new component stylesheet for its component in PascalCase, beside the component,
  as in `WorkTimeline.scss`. The lowercase names (`navbar.scss`, `error-page.scss`) are
  2023 legacy; do not copy them, and do not rename them in an unrelated story.

## Known pitfalls

- `.github/workflows/deploy.yml` runs `docker compose --env-file .env.production up
  --build -d` over SSH, so the serving two-core box compiles. This is a **known** standing
  violation of AD-8, tracked in story 1-9 and retired in Epic 3. Do not fix it out of
  sequence, because the replacement needs GHCR images that do not exist yet.
- Treat `docker/Caddyfile` as incomplete, not authoritative. It routes only `cuatro.dev`
  and `analytics.cuatro.dev`, yet `cs-tracker.cuatro.dev`, `tracker.cuatro.dev` and
  `library.cuatro.dev` all resolve. Story 1-7 enumerates the real table. Do not infer
  routing from the file.
- Font tokens bake weight into the family name (`--monument-bold: 'MonumentExtended-Bold'`
  at `app/app.scss:29`). Aliasing one to a family-only token silently drops bold. Live
  `--monument-bold` call sites: `glitch-text.scss:5`, `error-page.scss:24`,
  `ProjectsHero.scss:19`, `WorkHero.scss:19`.
- `--confillia-normal` has two live call sites (`HomeLayout.scss:117`,
  `HomeLayout.scss:148`). Retarget it, do not delete it. `--confillia-bold` and
  `--font-bold` have zero call sites and are safe to delete.
- `--accent-glow` is declared at `app/app.scss:11` with **zero call sites**. It arrived with
  the cybercore rebrand and is dead today. Do not assume it is load-bearing.
- The cybercore rebrand hardcoded a violet palette. **O-10 is decided: the contract palette
  wins**, and the value-by-value mapping lives in
  `_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/rebaseline-2026-08-15.md`
  § O-10. Follow that table; do not invent a mapping.
- `--accent-dim` has **15 call sites and is doing two different jobs** — ornament in some, a
  readable boundary in others. It resolves **per call site**, not with one global alias. A
  blanket alias to `--token-accent-muted` silently drops its boundary uses below the 3:1 floor.
- **Three surfaces are held open as O-12 and are not yours to decide:** GlitchText's
  `rgba(255, 0, 80, …)` / `rgba(0, 255, 255, …)` aberration pair (`glitch-text.scss:33`–`:68`),
  ScanlineOverlay's `rgba(0, 0, 0, …)` (`:6`, `:16`, `:17`), and the decorative numeral at
  `error-page.scss:28`. If a story reaches them before O-12 is settled, leave them untouched
  and say so — do not guess a token role.
- One open defect, with its own story. Do not fix it opportunistically and pad an
  unrelated diff: `Dev. 2025` should read `Dec.` (`content/work.ts:18`).
- `Celeste.tsx` hides the header by mutating the DOM in an effect. Known; leave unless the
  story is about it.

<!-- /bmad:context -->
