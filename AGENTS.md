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
- Token contract, and the restyle specification the Hub's components are rebuilt against:
  `_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md` and
  `RESTYLE-SPEC.md` in the same folder.
- **The seven-step SCSS migration no longer holds in full.** The restyle scope change rebuilds
  the Hub's components token-native instead of migrating the existing stylesheets, so stories
  `2-18`, `2-19` and `2-21` were deleted. Steps 1 and 2 survive as Epic 1 stories `1-18` and
  `1-19`, and FR-18 is measured on them. Before acting on any migration-step wording in
  `DESIGN.md`, check `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-15.md`
  § 7.3 for what actually remains.

## Running and verifying

- `pnpm` is not on PATH on this host. Prefix every command with `corepack`, as in
  `corepack pnpm build` or `corepack pnpm typecheck`.
- `corepack pnpm test` starts Vitest in watch mode and never exits. Always pass `--run`.
  The full suite is 600 tests across 26 files in roughly 85 seconds, so run all of it.
- There is no lint gate and no working lint command: the script is misspelled `linkg`,
  and `next lint` was removed in Next 16, so `corepack pnpm linkg` fails too. Do not put
  lint in an acceptance criterion, and do not add an `eslint` invocation to CI, until a
  story lands a flat `eslint.config.mjs`.
- CI (`.github/workflows/ci.yml`) runs five jobs: `test`, `tokens-contract`,
  `fonts-contract`, `contract-purity` and `rendered-output`. Lighthouse CI runs separately
  on `main` and PRs and asserts accessibility at 0.95 or above, so an a11y regression fails
  the build even though no unit test covers it.
- Playwright is installed and `rendered-output` is a blocking CI job. Run it with
  `corepack pnpm test:e2e`. It runs in the pinned container image
  `mcr.microsoft.com/playwright:v1.62.1-noble` with Node 22, and the committed baseline PNG
  was generated inside that exact image. Regenerate baselines with
  `corepack pnpm test:e2e:update` in that image only, never on this host: glyph
  rasterization is not portable and a locally regenerated snapshot fails CI.
- `corepack pnpm build` runs `node packages/contracts-serve/publish.mjs` first, which copies
  `contracts/` into `public/contracts/` so the Hub serves it at `/contracts/`.
  `public/contracts/` is generated and never committed. Editing it instead of `contracts/`
  changes nothing.

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
  `library.cuatro.dev` all resolve. The real table is enumerated in
  `ops/routing-inventory.md`; read that rather than inferring routing from the file.
- **Piping a string from PowerShell into a native command or `wsl` appends CRLF.** Anything
  that treats `\r` as data then breaks in ways that read as a wrong value rather than an
  encoding fault: an OpenSSH private key becomes unparseable, a bash heredoc gets `\r` on
  every line, and `gpg --passphrase-fd 0` strips the `\n` but keeps the `\r`, so a correct
  passphrase fails. All three happened on 2026-08-27. Use `cmd /c "prog < file"` for
  byte-exact stdin, or strip it on the far side with `tr -d '\r'`.
- Deploys go over SSH from `.github/workflows/deploy.yml` as the `deploy` user, and
  **nothing monitors whether they succeed**. That pipeline was broken for twelve days
  unnoticed, because nothing merges to `main` often enough to expose it. If a change is
  green in CI but absent from the site, check the Deploy workflow before debugging code.
  The diagnosis and the repair commands are in `ops/contract-serving.md`.
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
- `--accent-dim` has **15 call sites and is doing two different jobs**: ornament in some, a
  readable boundary in others. It resolves **per call site**, not with one global alias. A
  blanket alias to `--token-accent-muted` silently drops its boundary uses below the 3:1 floor.
- **O-12 is closed.** All three surfaces were decided by the restyle UX pass, so do not treat
  them as held. GlitchText's `rgba(255, 0, 80, …)` / `rgba(0, 255, 255, …)` aberration pair is
  **dropped, not excepted**. ScanlineOverlay's `rgba(0, 0, 0, …)` resolves to the new
  **`--token-scrim`** role, which exists precisely so a darkening layer never reaches for pure
  black. The decorative numeral at `error-page.scss:28` is specified in **both** branches, so
  the story cannot stall on it. Dispositions are in `RESTYLE-SPEC.md` and `DESIGN.md`; follow
  them rather than inventing a role.
- One open defect, with its own story. Do not fix it opportunistically and pad an
  unrelated diff: `Dev. 2025` should read `Dec.` (`content/work.ts:18`).
- `Celeste.tsx` hides the header by mutating the DOM in an effect. Known; leave unless the
  story is about it.

<!-- /bmad:context -->

## Dependency automation policy

Stated here because this is where it binds (NFR-10, FR-19, AD-16). Kept outside the managed
block above so a context refresh does not replace it.

- **No automated dependency merge is enabled in any estate repository without a real test
  suite**, and a real test suite is one that exists, exercises the application's own code
  rather than tooling or scaffolding, and runs on a CI service on every push to the default
  branch. That establishes that the suite runs; it does not gate a merge on its own.
- **Enabling automation needs a fourth condition, separate from having a suite:** the suite's
  run is a required status check on the default branch, through branch protection or a
  ruleset, so a merge nobody is watching cannot land while the run is red. Observed on
  2026-08-27, that holds nowhere in the estate (this repository's `main` protection names no
  check), and it cannot hold in the four private repositories on the current GitHub plan. The
  definitions, the observed state of all eleven repositories and the method are in
  `ops/contract-adoption.md`.
- **None is enabled here.** No Dependabot or Renovate configuration anywhere in the
  repository (fifteen file locations under the root, `.github/` and `.gitlab/`, plus a
  `renovate` key in `package.json`, all listed in `ops/contract-adoption.mjs`),
  `allow_auto_merge` off, automated security fixes off, zero bot-authored pull requests.
- **Enabling one is a recorded decision that lands in one commit with the configuration.**
  `ops/__tests__/contract-adoption.test.ts` holds the record's Anchor cell and the
  configuration present in the repository equal in both directions: a cell reading `none`
  with a configuration present fails naming the path, and a cell naming a configuration that
  is absent fails the same way. So the record's policy row (date, the required check that
  makes the merge safe, the reason) and the configuration file are one change, never two.
  The test holds the configuration files and the `package.json` key; `allow_auto_merge`,
  security fixes, bot-authored pull requests and a workflow step that merges are observed by
  the `gh api` sweep the record describes, not by the test. That commit also moves the two
  literal pins in the same suite that state today's `none` cell and empty present list.
