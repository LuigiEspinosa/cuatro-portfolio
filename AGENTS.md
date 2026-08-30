<!-- bmad:context -->
<!-- Verified 2026-08-28 against c490f33. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## cuatro-portfolio

The Anchor of the Cuatro Ecosystem: the portfolio at cuatro.dev, plus the design token
contract in `contracts/` that is published at `https://cuatro.dev/contracts/` and rendered by
a second application, `cs-tracker`. Next.js 16 / React 19 / TypeScript, Sass, pnpm, Vitest,
Playwright, deployed by Docker Compose over SSH to one Hostinger KVM 2 box. Planning
artifacts are in `_bmad-output/planning-artifacts/`; how the estate actually runs is in
`ops/`.

## Policy

- Every CI gate is blocking. Never downgrade a gate to a warning, skip one, or mark a check
  `continue-on-error` to get a story green. There is one environment and no staging, so CI is
  the only gate before production (AD-21).
- cuatro.dev deploys from `main` on every push. Every change leaves a working system (AD-20,
  NFR-2).
- Never add third-party analytics, a tag manager, or a session recorder. Measurement is
  first-party self-hosted Umami only (NFR-8).
- Commit messages are a subject line only: no body, no `Co-Authored-By` trailer.
- Never use an em-dash, an en-dash, a double-dash standing in for a dash, or an emoji in any
  prose, comment, commit subject, or documentation written here. Use a comma, a colon,
  parentheses, or two sentences. CLI flags and CSS custom properties keep their dashes.

## Where things are

- Architecture invariants AD-1 to AD-23:
  `_bmad-output/planning-artifacts/architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md`.
  Every story in `epics.md` names its governing AD. Read that AD before starting.
- **`ops/` holds 21 records that are the operational source of truth, not the planning
  artifacts.** Answer an operational question from there before inferring it from code:
  `routing-inventory.md` (the real routing table), `estate.md` (every application and its
  disposition), `known-violations.md` (what is knowingly in breach, and what closes it),
  `capacity-threshold.md`, `contract-serving.md`, `cs-tracker-token-adoption.md`,
  `rendered-output-harness.md`, `monitoring.md`, `backup-digital-library.md`,
  `bot-mitigation.md`, `asset-budget.md` (what the build actually ships, weighed),
  `registry-schema.md` (the App Registry's shape and its blocking gate).
- Token contract, and the restyle specification Epic 2 rebuilds the Hub against:
  `_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md` and
  `RESTYLE-SPEC.md` beside it.
- The seven-step SCSS migration in `DESIGN.md` no longer holds in full: steps 1 and 2 shipped
  as stories `1-17` and `1-18`, and `2-18`, `2-19` and `2-21` were deleted. Before acting on
  any migration-step wording, read
  `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-15.md` § 7.3.

## Running and verifying

- `pnpm` is not on PATH on this host. Prefix every command with `corepack`, as in
  `corepack pnpm build`.
- `corepack pnpm test` starts Vitest in watch mode and never exits. Always pass `--run`. The
  full suite is 738 tests across 32 files in roughly 90 to 120 seconds depending on load, so
  run all of it.
- There is no lint gate and no working lint command: the script is misspelled `linkg`, and
  `next lint` was removed in Next 16, so `corepack pnpm linkg` fails too. Do not put lint in
  an acceptance criterion, and do not add an `eslint` invocation to CI, until a story lands a
  flat `eslint.config.mjs`.
- Lighthouse CI runs outside `ci.yml` and asserts accessibility at 0.95, best practices and
  SEO at 0.9, so a regression no unit test covers still fails the build. Performance is
  commented out in `.lighthouserc.js`.
- Run the rendered-output job with `corepack pnpm test:e2e`. Regenerate its baselines with
  `corepack pnpm test:e2e:update` inside `mcr.microsoft.com/playwright:v1.62.1-noble` only,
  never on this host: glyph rasterization is not portable and a locally regenerated snapshot
  fails CI.
- `corepack pnpm build` runs `packages/contracts-serve/publish.mjs` first, which copies
  `contracts/` into the generated, never committed `public/contracts/`. Editing
  `public/contracts/` changes nothing.

## Conventions that differ from defaults

- `--token-*` (semantic) and Tailwind's `--color-*` are separate namespaces. The same name
  must never appear on both sides of a `var()`. A self-reference survives only by cascade
  accident and dies when a bundler flattens it (AD-14).
- Creating or editing `contracts/`? It is the published surface: no `.ts`, `.js`, `.tsx`,
  `.jsx`, `.mjs`, or `.cjs` under it, ever. Generators and schema tooling go in `packages/`,
  which is never published (AD-1). `contracts/registry.json` and
  `contracts/registry.schema.json` are the only hand-authored files there (AD-4); everything
  else is generated, so editing it by hand is a change the next `tokens:build` throws away.
- A consumer's vendored contract folder is named `cuatro-contracts/` exactly. A scheduled job
  locates tokens by that fixed path across seven repositories (AD-14, AD-16).
- Name a new component stylesheet for its component in PascalCase, beside the component, as
  in `WorkTimeline.scss`. The lowercase names (`navbar.scss`, `error-page.scss`) are 2023
  legacy; do not copy them, and do not rename them in an unrelated story.
- `--monument-bold` and `--monument-regular` are family-only aliases onto `var(--f-display)`
  (`app/app.scss:56-57`). A family alias cannot carry weight, so any new `--monument-bold`
  call site must set `font-weight: var(--w-black)` by hand beside `font-family`, as the four
  existing sites do. Omitting it silently drops bold.

## Known pitfalls

- `contracts/tailwind.css` names its spacing keys (`--spacing-sm` through `--spacing-2xl`),
  which shadows Tailwind's container scale in every consumer: `max-w-md` compiles to
  `max-width: var(--s-md)`, 16px, not 28rem. Verified against tailwindcss 4.3.3. Use
  `max-w-measure` or an explicit value, not `max-w-sm` through `max-w-2xl`. Filed as DW-15.
- `cs-tracker` has no CI at all, and `mix precommit` builds no image, so a change to how it
  builds is not built the way production builds it until the deploy runs. Its token contract
  test asserts against the text of `assets/css/app.css` rather than rendered output, so a
  regression that leaves the source text untouched ships green. Re-run
  `ops/cs-tracker-adoption-probe.mjs` by hand after touching either side. Filed as DW-14.
- **Piping a string from PowerShell into a native command or `wsl` appends CRLF.** Anything
  that treats `\r` as data then breaks in ways that read as a wrong value rather than an
  encoding fault: an OpenSSH private key becomes unparseable, a bash heredoc gets `\r` on
  every line, and `gpg --passphrase-fd 0` strips the `\n` but keeps the `\r`, so a correct
  passphrase fails. All three happened on 2026-08-27. Use `cmd /c "prog < file"` for
  byte-exact stdin, or strip it on the far side with `tr -d '\r'`.
- Nothing monitors whether a deploy succeeds. Deploys go over SSH from
  `.github/workflows/deploy.yml` as the `deploy` user, and that pipeline was broken for
  twelve days unnoticed, because nothing merges to `main` often enough to expose it. If a
  change is green in CI but absent from the site, check the Deploy workflow before debugging
  code. Diagnosis and repair commands are in `ops/contract-serving.md`.
- `deploy.yml` runs `docker compose up --build -d` over SSH, so the serving two-core box
  compiles. This is a recorded standing violation of AD-8, not an oversight: it is in
  `ops/known-violations.md` and closes in Epic 3. Do not fix it out of sequence, because the
  replacement needs GHCR images that do not exist yet.
- `docker/Caddyfile` routes only `cuatro.dev`, `www.cuatro.dev` and `analytics.cuatro.dev`,
  yet `cs-tracker.cuatro.dev`, `tracker.cuatro.dev` and `library.cuatro.dev` all resolve.
  Treat it as incomplete rather than authoritative, and read `ops/routing-inventory.md` for
  the real table.
- Adding an application to `deploy.yml` trips the Capacity Gate (AD-9), which refuses any id
  not in `placements` in `ops/capacity-gate.yml`. The gate is open on a measured threshold
  (load15 0.60). Read `ops/capacity-threshold.md` before editing `threshold` or `status`.
- `Body` writes the route onto `<body id>` (`Container.tsx:12-16`), and five rules across three
  stylesheets key on that id, `#celeste header` among them. A route that needs different chrome
  takes a rule on that id, never an effect that mutates another component's node: Story 2-1
  removed the one that did, because a mutation outlives a cleanup that never runs.
- Three committed listings pin the contents of `contracts/` path by path, so a file added there
  fails all three at once and none of the failures says "a file was added":
  `packages/tokens/__tests__/tokens-contract.test.ts`,
  `packages/fonts/__tests__/fonts-contract.test.ts` and
  `ops/__tests__/cs-tracker-adoption-probe.test.ts`. The last one also drives the vendored-copy
  comparison, whose source side is the token contract's nine paths only
  (`TOKEN_CONTRACT_PATHS`), because a Satellite fetches the Registry over HTTPS and never
  vendors it (AD-4, AD-14). `cs-tracker`'s own Elixir suite pins the same nine and cannot see
  this repository, so a tenth token-contract file is a two-repository change.
- On the 404, `usePathname()` answers `/_not-found` during the prerender and the requested path
  on the client, so `<body id>` differs across hydration and settles on whichever side ran last.
  Assert on markup both sides render identically (`.error-page`), never on that id. A chrome
  regression on one side only shows up as a timing-dependent browser test, not a clean failure.

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
