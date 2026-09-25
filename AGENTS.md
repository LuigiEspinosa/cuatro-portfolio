<!-- bmad:context -->
<!-- Verified 2026-09-25 against 79dccf7. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## cuatro-portfolio

The Anchor of the Cuatro Ecosystem: the portfolio at cuatro.dev, plus the contracts in
`contracts/`, published at `https://cuatro.dev/contracts/`: the design token contract, which a
second application, `cs-tracker`, renders, and the App Registry the Hub's Suite Directory reads.
Next.js 16 / React 19 / TypeScript, Sass, pnpm, Vitest, Playwright, deployed by Docker Compose
over SSH to one Hostinger KVM 2 box. Planning artifacts are in `_bmad-output/planning-artifacts/`;
how the estate actually runs is in `ops/`.

## Policy

- Every CI gate is blocking. Never downgrade a gate to a warning, skip one, or mark a check
  `continue-on-error` to get a story green. There is one environment and no staging, so CI is
  the only gate before production (AD-21).
- cuatro.dev deploys from `main` on every push that changes more than Markdown. Every change
  leaves a working system (AD-20, NFR-2).
- Never add third-party analytics, a tag manager, or a session recorder. Measurement is
  first-party self-hosted Umami only (NFR-8).
- Commit messages are a subject line only: no body, no `Co-Authored-By` trailer.
- Never use an em-dash, an en-dash, a double-dash standing in for a dash, or an emoji in any
  prose, comment, commit subject, or documentation written here. Use a comma, a colon,
  parentheses, or two sentences. CLI flags and CSS custom properties keep their dashes.

## Where things are

- Architecture invariants AD-1 to AD-26:
  `_bmad-output/planning-artifacts/architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md`.
  Every story in `epics.md` names its governing AD. Read that AD before starting.
- **`ops/` holds 28 records that are the operational source of truth, not the planning
  artifacts.** Answer an operational question from there before inferring it from code:
  `routing-inventory.md` (the real routing table), `estate.md` (every application and its
  disposition), `known-violations.md` (what is knowingly in breach, and what closes it),
  `capacity-threshold.md`, `contract-serving.md`, `cs-tracker-token-adoption.md`,
  `rendered-output-harness.md`, `monitoring.md`, `backup-digital-library.md`,
  `bot-mitigation.md`, `asset-budget.md` (what the build actually ships, weighed),
  `registry-schema.md` (the App Registry's shape and its blocking gate),
  `registry-inputs.md` (how the Registry's values were first chosen, frozen 2026-09-24:
  `contracts/registry.json` is the only source of Registry values).
- Token contract, and the restyle specification the Hub was rebuilt against in Epic 2:
  `_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/DESIGN.md` and
  `RESTYLE-SPEC.md` beside it.
- The seven-step SCSS migration in `DESIGN.md` is finished and does not hold as written: steps
  1, 2, 5 and 7 shipped as stories `1-17`, `1-18`, `2-20` and `2-22`, step 3 went into `2-31`,
  step 4 became `2-34`'s gate, and step 6 (`2-21`) was deleted. Before acting on any
  migration-step wording, read `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-15.md` § 7.3.

## Running and verifying

- `pnpm` is not on PATH on this host. Prefix every command with `corepack`, as in
  `corepack pnpm build`.
- `corepack pnpm test` starts Vitest in watch mode and never exits. Always pass `--run`. The
  full suite is 1634 tests across 63 files in roughly 80 seconds on this host, so run all of it.
  Measured 2026-09-25 at `935df26`; it was 890 in 34 files on 2026-08-29, so treat this figure
  as a rough expectation and not as a number to assert on.
- On this host two cases that spawn WSL's bash, in `ops/__tests__/deploy-remote.test.ts` and
  `ops/__tests__/library-backup.test.ts`, sometimes fail after about 30 seconds with empty output
  and pass on the next run (DW-135). Re-run the suite before debugging such a failure; CI runs a
  native bash and never sees it.
- There is no lint gate and no working lint command: the script is misspelled `linkg`, and
  `next lint` was removed in Next 16, so `corepack pnpm linkg` fails too. Do not put lint in
  an acceptance criterion, and do not add an `eslint` invocation to CI, until a story lands a
  flat `eslint.config.mjs`.
- Lighthouse CI runs outside `ci.yml` and asserts accessibility at 0.95, best practices and
  SEO at 0.9, so a regression no unit test covers still fails the build. Performance is
  commented out in `.lighthouserc.js`.
- The rendered-output suite runs only inside `mcr.microsoft.com/playwright:v1.62.1-noble`, never on
  this host: glyph rasterization is not portable, so a host run fails and a baseline written here
  fails CI. From the repository root:
  `docker run --rm --ipc=host -v C:/CuatroEcosystem/cuatro-portfolio:/w -v pw-node-modules:/w/node_modules -v pw-next:/w/.next -w /w -e CI=1 mcr.microsoft.com/playwright:v1.62.1-noble bash -lc "corepack enable && pnpm install --frozen-lockfile && pnpm test:e2e"`.
  Regenerate a baseline with `pnpm run test:e2e:update` in that command, only in the cases
  `ops/rendered-output-harness.md` § Regenerating the baseline allows, and record the new sha256
  in its table. A change under the per-pixel threshold makes that run write nothing; the same
  section gives the forced form.
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
  else is generated (`tokens:build`, `fonts:prepare`, `fonts:build`), and the
  `tokens-contract` and `fonts-contract` drift jobs fail a hand edit.
- A consumer's vendored contract folder is named `cuatro-contracts/` exactly. The scheduled
  Registry verification locates each adopter's tokens by that fixed path (AD-14, AD-16).
- Name a new component stylesheet for its component in PascalCase, beside the component, as
  in `WorkTimeline.scss`. The lowercase `celeste.scss` is 2023 legacy; do not copy it, and do
  not rename it in an unrelated story.
- Story 2-22 deleted the Story 1-18 alias layer and the Operator's ruling of 2026-09-24 deleted
  `--hero-height` (DW-122): `app/app.scss` declares no custom property of its own, and every
  stylesheet names contract roles directly. A family role carries no
  weight: a call site that wants the display face at its heaviest sets `font-weight: var(--w-black)`
  beside `font-family: var(--f-display)`. `app/__tests__/anchor-contract.test.ts` refuses an old name.

## Known pitfalls

- `cs-tracker` has no CI at all, a stated limit the Operator accepted on 2026-09-24 (DW-14), and
  `mix precommit` builds no image, so a change to how it builds is not built the way production
  builds it until the deploy runs. Its token contract test asserts against the text of
  `assets/css/app.css` rather than rendered output, so a regression that leaves the source text
  untouched ships green. Re-run `ops/cs-tracker-adoption-probe.mjs` by hand after touching either
  side.
- **Piping a string from PowerShell into a native command or `wsl` appends CRLF.** Anything
  that treats `\r` as data then breaks in ways that read as a wrong value rather than an
  encoding fault: an OpenSSH private key becomes unparseable, a bash heredoc gets `\r` on
  every line, and `gpg --passphrase-fd 0` strips the `\n` but keeps the `\r`, so a correct
  passphrase fails. All three happened on 2026-08-27. Use `cmd /c "prog < file"` for
  byte-exact stdin, or strip it on the far side with `tr -d '\r'`.
- A failed Deploy run opens a GitHub issue, but nothing notices a deploy that never runs.
  Deploys go over SSH from `.github/workflows/deploy.yml` as the `deploy` user, and that
  pipeline was broken for twelve days unnoticed, because nothing merges to `main` often enough
  to expose it. If a change is green in CI but absent from the site, check the Deploy workflow
  before debugging code. Diagnosis and repair commands are in `ops/contract-serving.md`.
- A story that moves the host changes the three secrets `deploy.yml` reads together:
  `SERVER_HOST`, `SERVER_USER` and `SSH_PRIVATE_KEY`. Audit all three against the new box, never
  one; Story 1-21 repointed `SERVER_HOST` alone, and that is the twelve days above.
- `ops/deploy-remote.sh`, which `deploy.yml` runs over SSH, runs `docker compose up --build -d`,
  so the serving two-core box compiles. This is a recorded standing violation of AD-8, not an
  oversight: it is in `ops/known-violations.md` and closes in Epic 3. Do not fix it out of
  sequence, because the replacement needs GHCR images that do not exist yet. The script is also the
  deploy key's forced command: keep the sha the last word of the workflow's command string, and
  never move the file.
- `docker/Caddyfile` is the Anchor's fragment of the one shared Caddyfile on the box
  (`/home/deploy/cs-tracker/Caddyfile`), and no process here reads it: editing it changes nothing
  live, and the box's copy is not in git. Read `ops/routing-inventory.md` for the real routing
  table.
- Adding an application to `deploy.yml` trips the Capacity Gate (AD-9), which refuses any id
  not in `placements` in `ops/capacity-gate.yml`. The gate is open on a measured threshold
  (load15 0.60). Read `ops/capacity-threshold.md` before editing `threshold` or `status`.
- `Body` writes the route onto `<body id>` (`Container.tsx:12-16`), and two stylesheets key on
  that id: `HomeLayout.scss` (`body[id='']`) and `celeste.scss` (`#celeste`, whose `header` rule
  hides the chrome). A route that needs different chrome takes a rule on that id, never an effect
  that mutates another component's node: Story 2-1 removed the one that did, because a mutation
  outlives a cleanup that never runs.
- Three committed listings pin the contents of `contracts/` path by path, so a file added there
  fails all three at once and none of the failures says "a file was added":
  `packages/tokens/__tests__/tokens-contract.test.ts`,
  `packages/fonts/__tests__/fonts-contract.test.ts` and
  `ops/__tests__/cs-tracker-adoption-probe.test.ts`. The last one also drives the vendored-copy
  comparison, whose source side is the token contract's nine paths only
  (`TOKEN_CONTRACT_PATHS`), because a Satellite fetches the Registry over HTTPS and never
  vendors it (AD-4, AD-14). `cs-tracker`'s own Elixir suite pins the same nine and cannot see
  this repository, so a tenth token-contract file is a two-repository change.
- The same shape holds for `.github/workflows/ci.yml`: **two** suites pin its job names as an
  exact set, so adding or removing a job fails both, and neither failure says "a job was added".
  They are `ops/__tests__/contract-purity.test.ts` and `ops/__tests__/registry-schema.test.ts`,
  each of which reads the file for its own gate. Update both, and give the new job its own
  wiring cases beside the module it runs rather than adding them to one of those two.
- Two sources may name `contracts/`, and no third: `app/scss/_index.scss`, which loads the token
  and font stylesheets, and `lib/registry.ts`, which may name only `contracts/registry.json` and
  `contracts/registry.schema.json`. `app/__tests__/anchor-contract.test.ts` fails a third source
  and any other `contracts/` path in the Registry module. Read Registry data through
  `lib/registry.ts`.
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
