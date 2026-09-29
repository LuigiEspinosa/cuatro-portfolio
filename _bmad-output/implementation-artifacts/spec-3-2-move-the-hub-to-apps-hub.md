---
title: 'Story 3.2: Move the Hub to apps/hub'
type: 'chore'
created: '2026-09-28'
status: 'done'
route: 'dispatch'
baseline_commit: '857ac6bfb6c0c992e32f60bce7c258bf037e244e'
review_loop_iteration: 0
warnings: ['oversized']
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/ops/contract-serving.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** The Hub is the repository root: its six source roots (`app/`, `components/`, `content/`,
`hooks/`, `lib/`, `public/`) and `next.config.js` sit beside `contracts/`, `packages/` and `ops/`,
so it is not a workspace Turborepo can name (`turbo prune portfolio --docker` fails "Invalid scope"),
and Story 3.3's image, built from the root narrowed by `turbo prune --docker` (AD-8), has nothing to
prune to. AD-20 fixes the move as its own shipped step with nothing else changing, so that a broken
flagship is a path rewrite and cannot also be a history merge.

**Approach:** `git mv` the Hub into `apps/hub/` as the private workspace `hub`, rewrite AD-20's six
files for the new paths, and move with it every path reference that points at the Hub, and nothing
else. Every dependency stays declared where it is, so the lockfile gains one empty importer, and the
repository's gates (typecheck, the unit suite, the browser suite, Lighthouse) keep running from the
root.

## Boundaries & Constraints

**Always:**

- `git mv`, so `git log --follow` works from every new path. A file committed with CRLF
  (`next.config.js`, `.gitignore`, `README.md`) keeps CRLF when edited, or every line differs and
  the rename is lost.
- `contracts/`, `packages/`, `ops/`, `turbo.json` and `pnpm-workspace.yaml` stay at the root.
  `apps/hub/app/scss/_index.scss` loads the root `contracts/tokens.css` and `fonts.css` by `@use`,
  `apps/hub/lib/registry.ts` names only the two Registry files, and there is one authored copy of
  the contract.
- The seven `ci.yml` job names and every command they run stay as they are. The Playwright job, the
  hit-target assertions, the Registry schema gate and `.lighthouserc.js`'s accessibility 0.95
  `error` assertion are carried across unchanged and blocking.
- `pnpm-lock.yaml`'s `packages:` and `snapshots:` sections stay byte-identical.
- The `/work` baseline stays byte-identical at its path, sha256
  `93a1aa4e9c8374207ae689707b1e843285ba927fb762ed2f09d105050b9a59d8`, and is never regenerated on
  this host.
- Every route answers as before the move: `/`, `/cv`, `/work`, `/celeste` and `/api/health` 200,
  `/projects` 301 to `/#suite`, `/recommendation` and an unknown path 404, every file under
  `/contracts/` 200.
- A record stating a moved path as a present-tense instruction or fact changes in the move's own
  commit, and says committed, never live: the move is live at the Epic 3 merge to `main`.

**Never:**

- No product change, no dependency change (declaration, version or resolution), no refactor, no
  Node pin change (DW-251 is Stories 3.3 and 3.4's), no new CI job.
- No edit to `deploy.yml` (it names no moved path) or `docker-compose.yml`; the Dockerfile stays at
  `docker/Dockerfile`, which Story 3.3 replaces with `apps/hub/Dockerfile`.
- No baseline regeneration, no rewrite of a dated observation in a record, no second root for
  `ops/asset-budget.mjs` (deferred with its consequence).
- No push and no merge to `main`.

**Decisions** (unattended run: the orchestrator relayed the Operator's instruction of 2026-09-28 to
finish Epic 3 with the stories as written. Each answers an Open Question from the sources, is
reversible, keeps every gate green, and is an Operator item):

1. **What moves.** The six source roots and `next.config.js`, plus two new files:
   `apps/hub/package.json` (the workspace `hub`, carrying the Hub's `dev`, `build` and `start`) and
   `apps/hub/tsconfig.json` (the compile unit `next build` reads; without one it writes its own,
   with no `@/` paths). The repository's gates stay at the root with their configuration:
   `tsconfig.json` and `vitest.config.ts`, which AD-20 rewrites rather than moves,
   `vitest.setup.ts`, `playwright.config.ts` with `tests/e2e/` and its baseline, `.lighthouserc.js`
   and `.eslintrc.json`. Seventeen `ops/` suites take `process.cwd()` as the repository root, so the
   unit run has to start there, and a browser suite left in place keeps the Playwright job, its
   baseline path and 526 references to `tests/e2e/` true.
2. **Dependencies stay declared in the root manifest.** `apps/hub/package.json` declares none, the
   Hub resolves its modules from the root `node_modules` as it does today, and the lockfile gains
   `apps/hub: {}` alone. Re-homing a declaration re-keys snapshots: `next` resolves with
   `@playwright/test` and `sass` as peers and `vitest` with `sass`, all from the root importer.
3. **The workspace is `hub`**, Story 3.3's image name, so commands read `pnpm --filter hub
   <script>`. The Registry id stays `cuatro-portfolio`.
4. **`test` and `typecheck` stay root scripts**, so CI's `test` job is unchanged and DW-252 closes by
   construction; `build` resolves to `hub#build` and `//#build` goes inert, as Story 3-1 designed. A
   new `ops/__tests__/workflow-hardening.test.ts` case holds every `pnpm` script a workflow runs to a
   script the manifest it runs against defines, so the silent `pnpm test` pass cannot return.
5. **The version stays in the root manifest:** `next.config.js` reads `../../package.json`, so
   `/api/health` answers 3.0.0 from one source.
6. **`/recommendation` (DW-138)** was retired by Story 2-17 on the Operator's ruling of 2026-09-11
   and answers 404 by design, so "every route still renders" is read as "every route answers as it
   did before the move". FR-1's wording stays the Operator's, and DW-138 stays open for it.
7. **Records:** a present-tense instruction or fact naming a moved path is amended in place; a dated
   observation is not rewritten, and one `AGENTS.md` bullet maps a Hub path in anything written
   before the move to `apps/hub/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Unit gate | root `pnpm test --run` | Vitest over the root and `apps/hub` suites: every file and case the base commit ran, plus this story's, all passing | a filter matching no file exits 1 |
| Typecheck | root `pnpm typecheck` | `tsc --noEmit` over the whole tree, `@/` resolving into `apps/hub` | a planted type error exits non-zero |
| Build | `pnpm --filter hub build` | the publish writes 11 files under `apps/hub/public/contracts/`, then the same six routes | root `pnpm build` fails loud: no such script |
| Image | `docker build -f docker/Dockerfile .` | runner starts `apps/hub/server.js`; every route answers as before | a missing standalone path fails the build |
| Silent unit gate | a workflow runs `pnpm test` against a manifest with no `test` | the new workflow-hardening case fails naming it | planted control observed failing |
| Prune | `turbo prune hub --docker` | exit 0; the root name still fails "Invalid scope" | `ops/__tests__/turborepo.test.ts` |

</frozen-after-approval>

## Code Map

- `package.json`: the Hub's manifest at the root (`name: portfolio`, `version: 3.0.0`, which
  `next.config.js:2` reads into `APP_VERSION` and `app/api/health/route.ts:8` reports). `dev` and
  `build` run `node packages/contracts-serve/publish.mjs` then Next; `test`, `typecheck`, `test:e2e`,
  `test:e2e:update`, `contracts:publish`, `tokens:build`, `fonts:*` and `linkg` are repository
  tooling and stay. Every dependency stays here.
- `pnpm-workspace.yaml`: `apps/*` and `packages/*` since Story 3-1; unchanged.
- `turbo.json`: `//#build`, `//#test`, `//#typecheck` registered, each described "while it is the
  root package".
- `tsconfig.json:28-40`: `@/*` to `./*`; includes `next-env.d.ts`, `.next/types/**/*.ts`,
  `.next/dev/types/**/*.ts`. `vitest.config.ts:19`: alias `@` to the root; `exclude` keeps
  `tests/e2e/**`.
- `next.config.js:2` (CRLF): `require('./package.json')`. `app/scss/_index.scss:37-38`:
  `@use '../../contracts/tokens'` and `fonts`. `lib/registry.ts:25`:
  `import registryJson from '@/contracts/registry.json'`, through the alias that will point into
  `apps/hub`.
- `packages/contracts-serve/publish.mjs:83-84`: `SOURCE` and `DESTINATION`
  (`join(REPO_ROOT, 'public', SURFACE)`). Its suite pins the literals `ops/contract-serving.md`
  § The five things Epic 3 has to touch lists (`:673`, `:741`, `:779`, the manifest,
  `PUBLISH_COMMAND`, `:914`, `:925`, `:948`).
- `docker/Dockerfile`: deps copies the workspace manifests (`:9-10`), builder `RUN pnpm build`
  (`:27`), runner copies `/app/.next/standalone`, `static` and `public` and runs `server.js`
  (`:32-36`). `docker/__tests__/deps-stage.test.ts` demands a copy of every workspace manifest, so it
  picks up `apps/hub/package.json` unaided; `runner-stage.test.ts` holds the runner's copy of the
  builder's public directory and the builder command.
- `.gitignore:84,210` (CRLF): `/.next/`, `/public/contracts/`. `.dockerignore:19`: `.next`, which
  matches at the context root only.
- `.github/workflows/ci.yml:303`: a comment naming `app/scss/_print.scss`. `lighthouse.yml:32,38`:
  `pnpm build`, `pnpm start &`. `deploy.yml`: no moved path.
- `playwright.config.ts:87`: webServer `pnpm build && pnpm start --port ${PORT}`.
- `ops/literal-conformance.mjs:45` and its suite (`:36`, `:92-96`): the print allowance path.
  `ops/__tests__/accent-fill.test.ts:49,56`, `status-mark-axes.test.ts:35`,
  `hit-target-floor.test.ts:36,665`, `hub-accessibility-pass.test.ts:443`: Hub paths, and the pinned
  `routesOnDisk(join(REPO_ROOT, 'app'))` literal. `ops/cs-tracker-adoption-probe.mjs:1118`: the Hub's
  built stylesheet under `REPO_ROOT/.next/static`.
- Browser specs reading Hub paths through `REPO_ROOT`: `accessibility-floor.pw.ts:110,356,825,
  1078-1079,1122,1139`, `anchor-aliases.pw.ts:51,55`, `contract-anchor.pw.ts:61`,
  `display-entrance.pw.ts:55,231-235,484`, `hit-target-floor.pw.ts:877`,
  `narrative.pw.ts:1827-1883`. Nothing else in `tests/e2e/` reads a Hub path.
- Hub suites whose root is derived from their own path and which read the root `contracts/`:
  `ScanlineOverlay.test.tsx:8`, `WorkItem.test.tsx:322`, `Header.test.tsx:35`,
  `PlateMark.test.tsx:22`, `Error404.test.tsx:42`, `HomeLayout.test.tsx:410`, `WorkHero.test.tsx:53`,
  `WorkTimeline.test.tsx:51`, `lib/__tests__/registry.test.ts:43`; `Premise.test.tsx:37` reads Hub
  files only. `app/__tests__/anchor-contract.test.ts:53-59` takes `process.cwd()` and names Hub paths
  from the root (its root pin, `KNOWN_TRACKED`, `SEARCH_SENTINELS`, `TOKEN_NATIVE_STYLESHEETS`).
- Records naming a moved path as a present-tense instruction: `AGENTS.md:52-60,79,84-86,105-109,
  165-169`, `README.md` (commands and the Docker diagram), `ops/contract-serving.md` (§ The mechanism,
  § The five things Epic 3 has to touch), `ops/literal-conformance.md` (the allowance),
  `ops/rendered-output-harness.md:334-340` (the regeneration command), `ops/asset-budget.md:61,83`,
  `ops/cs-tracker-token-adoption.md:521-525`.
- `ops/asset-budget.mjs:896,958,1166,1890`: one `root` for the Hub's build and sources and the root
  `contracts/`. `deferred-work.md`: DW-252 and DW-138's Story 3.2 half; next free id DW-256.

## Tasks & Acceptance

**Execution:**

- [x] `app/`, `components/`, `content/`, `hooks/`, `lib/`, `public/`, `next.config.js`: `git mv` into
  `apps/hub/`.
- [x] `apps/hub/package.json`: create: `name` `hub`, `private`, the three scripts moved from the root
  with the publish at `../../packages/contracts-serve/publish.mjs`. `apps/hub/tsconfig.json`: create
  as a byte copy of the base commit's root `tsconfig.json`.
- [x] `package.json`: delete `dev`, `build`, `start`, nothing else. `pnpm-lock.yaml`:
  `corepack pnpm install`, which adds `apps/hub: {}` alone.
- [x] AD-20's six: `ci.yml` (the comment), `lighthouse.yml` (`--filter hub`), `docker/Dockerfile`
  (deps copies `apps/hub/package.json`, builder `pnpm --filter hub build`, runner the workspace's
  standalone layout and `apps/hub/server.js`), `tsconfig.json` (`@/*` and the three Next includes
  under `apps/hub/`), `vitest.config.ts` (`@` to `apps/hub`); `deploy.yml` read and left.
- [x] The references the move breaks: `apps/hub/next.config.js`, `_index.scss`, `lib/registry.ts`;
  `publish.mjs` with its suite; `runner-stage.test.ts`; `.gitignore` (`.next/` unanchored,
  `/apps/hub/public/contracts/`); `.dockerignore` (`**/.next`); `playwright.config.ts`;
  `literal-conformance.mjs` with its suite; `cs-tracker-adoption-probe.mjs`; the four `ops/` suites,
  six browser specs and the Hub suites the Code Map names; `turbo.json` descriptions and the
  `turborepo.test.ts` comment.
- [x] `ops/__tests__/workflow-hardening.test.ts`: the DW-252 case, with a planted control.
- [x] The records the Code Map names and `deferred-work.md` (close DW-252, answer DW-138's Story 3.2
  half, file DW-256 and DW-257), all in the move's commit but the BMAD bookkeeping.
- [x] Local only: delete the root's stale, ignored build output (`.next/`, `next-env.d.ts`,
  `tsconfig.tsbuildinfo`, `public/contracts/`), which the root typecheck would otherwise read.

**Acceptance Criteria:**

- Given the Hub at the root, when it moves, then the six source roots and `next.config.js` are under
  `apps/hub/` beside its manifest and tsconfig, `contracts/`, `packages/`, `ops/`, `turbo.json` and
  `pnpm-workspace.yaml` are at the root, and `git log --follow` from a moved path lists the commits
  made at its old path.
- Given AD-20's six files, when the change is reviewed, then five are rewritten for the new paths and
  `deploy.yml` is shown to name none, every other file touched is listed with its reason, and the
  lockfile's `packages:` and `snapshots:` are byte-identical to the base commit's.
- Given the Playwright job, the hit-target assertions and the Registry schema gate, when `ci.yml` is
  rewritten, then its seven jobs and their commands are unchanged, the rendered-output suite passes in
  the pinned image against the unchanged baseline, and Lighthouse's three thresholds hold.
- Given Story 1.17's direct `@use`, when the stylesheet graph moves, then the load resolves to the root
  `contracts/`, `anchor-contract.test.ts` passes, and no second authored copy exists.
- Given NFR-2, when the move is built as production builds it, then the image serves every route as
  before and `/contracts/` byte for byte; the live proof is the merge to `main`, which is the
  Operator's.
- Given DW-252, when the unit gate runs, then a run executing no test fails, and a workflow step
  invoking a script its manifest lacks fails the unit suite.

## Implementation Notes

Implemented inline (a workflow sub-agent has no Agent tool), from this spec.

- The move: `git mv` of the six source roots and `next.config.js`, recorded as 103 renames.
  `apps/hub/package.json` and `apps/hub/tsconfig.json` are new, the second the base commit's root
  tsconfig byte for byte (blob `6159945`); the root manifest lost `dev`, `build` and `start`, and the
  lockfile gained `apps/hub: {}` and nothing else.
- AD-20's six: `ci.yml` one comment line; `lighthouse.yml` two commands; `docker/Dockerfile` the
  deps copy, the builder command, the runner's three copies and `CMD`, and two comments;
  `tsconfig.json` the alias and three includes; `vitest.config.ts` the alias. `deploy.yml` names no
  moved path, read line by line, and is byte-identical.
- References: as the Code Map lists, and three it missed: `docker/__tests__/deps-stage.test.ts` (its
  pinned workspace list gains `apps/hub`, as its own message instructs, and its planted negatives
  matched `packages/` manifests only, now `apps|packages`), `ops/status-mark-axes.md` (its suite pins
  the record's pointer to the component spec) and `ops/hub-accessibility-pass.md` (its re-run
  commands), plus two strings naming the root's old build command, in `ops/hub-accessibility-probe.mjs`
  and `tests/e2e/contract-serving.pw.ts`. DW-258 was filed beside DW-256 and DW-257: the root Vitest run
  will collect the first merged application's suite under the Hub's alias.
- Hub suites: `REPO_ROOT` is the repository wherever it stays, and `HUB_ROOT` the Hub's tree where
  one is needed (`PlateMark`, `registry`, `Premise`, `anchor-contract`, the last with `fromHub` so
  its pinned lists read as written). The browser specs gained `HUB_ROOT` the same way.
- Line endings: every edit went through a script that keeps a file's CRLF, so `next.config.js`,
  `.gitignore` and `README.md` keep theirs and each rename stays a rename.
- **Surprises.** (1) `git mv public` carried the ignored served copy along, and it showed as
  untracked until `.gitignore` moved: `ops/contract-serving.md` thing 3, as predicted. (2) `pnpm` is
  not on PATH inside a script `corepack pnpm` runs here, which ruled out root scripts delegating to
  `--filter hub`. (3) The scratch prototype's Windows build failed on a 262-character module path
  (the checkout's is 156), so its builds ran in Linux containers instead.

## Spec Change Log

**2026-09-28, fix round 1, after the independent verification.** The verifier passed the story with
three minor findings, all taken; each was a record or a board row saying less than, or other than, the
tree it sits in, and no code, test, workflow or gate changed.

1. AC5's live proof waits on the Operator, and neither this spec nor the board said how AD-20's own
   shipped step is taken while `dev` carries Story 3-1's unshipped commits beneath this story's.
   Verification now ends with the steps, and the board's 3-2 row carries them, as 3-1's row carries
   its own.
2. `ops/hub-accessibility-pass.md` Pending Operator action 4 told the Operator to open `/` on
   `corepack pnpm build && corepack pnpm start`, which fails at the root since `bc9cd25`; its Method
   now names `corepack pnpm --filter hub build && corepack pnpm --filter hub start`. Three rows that
   describe the harness's server as `pnpm build && pnpm start` in the present tense carry a dated
   amendment: that record's Environment row and `ops/contract-serving.md`'s stated limit, which the
   verifier named, and the same stated limit in `ops/anchor-token-adoption.md`, found by searching
   for the claim.
3. `ops/rendered-output-harness.md` § Regenerating the baseline still called the 2026-08-24 container
   command, with `-v pw-next:/w/.next`, the supported way to run the harness; a dated amendment beside
   it names `-v pw-next:/w/apps/hub/.next`. The same search found three more present-tense container
   commands with the pre-move volume, in `ops/hub-accessibility-pass.md` § How to re-run,
   `ops/status-mark-axes.md` § How to re-run and `ops/hit-target-floor.md` § Running it, each amended
   the same way; the one in `ops/status-mark-axes.md` joins an existing line, because
   `ops/hub-accessibility-pass.md` and `ops/hub-accessibility-probe.mjs` cite that record's later
   lines by number. Two commands stay as they were run: `ops/font-contract.md`'s `fonts:measure`
   run, which builds no Hub, and `ops/anchor-token-adoption.md`'s Story 1-17 run.

The record amendments land after the move's commit, against the Always rule that a record naming a
moved path changes in the move's own commit. **The split stays in the history and is logged here; the
rule is not amended**, as Story 3-1's round did: neither `bc9cd25` nor `b5c4dd1` was pushed
(`origin/dev` read `857ac6b` on 2026-09-28), so a push of `dev` carries them with this round, and
nothing deploys from `dev`. Re-run on this tree: `corepack pnpm typecheck` exit 0;
`corepack pnpm --filter hub build` exit 0 (11 files published, Next.js 16.2.1, the same six routes),
and the root's `corepack pnpm build` exit 1, "Command "build" not found", as designed; action 4's
commands as amended, `corepack pnpm --filter hub start` answering `/` 200 and `/api/health` 3.0.0
on port 3000; `corepack pnpm test --run` exit 0, "Test Files 64 passed (64)", "Tests 1659 passed
(1659)".

## Review Triage Log

Pass 1, 2026-09-28, over a 163.2 kB diff (Blind Hunter floor 10). Every layer ran inline in this
session, which had no subagent tool, so none is independent. The Design Review ran: the diff changes one
surface, `apps/hub/app/scss/_index.scss`, and names no motion token or API.

| # | Layer | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | Blind | `apps/hub/package.json` declares no dependency though the Hub imports `next`, `react` and `three` | false | Decision 2 (frozen): the Hub resolves from the root `node_modules`, observed in the host build, the unit run and the image; nothing here installs with `--filter hub`, and Story 3.3's pruned install keeps the root importer (DW-257) | reject |
| 2 | Blind | `next.config.js` couples the Hub's version to the root manifest | false | Decision 5 (frozen); the pruned tree carries the root manifest (observed), and the moved image's `/api/health` answered 3.0.0 | reject |
| 3 | Blind | `.next/` unanchored ignores a `.next` at any depth | false | No tracked `.next` exists, and every suite that writes a `.next` tree writes it under the OS temp directory | reject |
| 4 | Blind | `.dockerignore` lets a stale `apps/hub/public/contracts/` into a local context | low | Real, but pre-existing in shape (the root copy was never dockerignored) and harmless: the publish removes its destination before writing, and the box builds nothing outside Docker | reject |
| 5 | Blind, Edge (deletion) | Re-anchoring `.gitignore` un-ignores the root `public/contracts/` a checkout built before the move still holds, and no gate would catch it committed | medium | Observed: a planted root `public/contracts/tokens.css` read not ignored, and the no-second-copy checks now list `apps/hub/` alone | patch: keep `/public/contracts/` beside the new entry, commented |
| 6 | Blind, Edge | The DW-252 guard reads `pnpm run <script>`, `pnpm exec` and `pnpm dlx` as missing scripts | low | No workflow uses those forms, and the guard fails closed naming the step, so the next author meets a loud case, never a silent pass; handling them adds branches | reject |
| 7 | Blind | The guard also reads `pnpm` inside echoed messages | false | An echo naming a missing script would mislead a log's reader, so flagging it is correct; both echoes name real scripts | reject |
| 8 | Blind | The guard hard-codes `apps` and `packages` rather than reading `pnpm-workspace.yaml` | false | `docker/__tests__/deps-stage.test.ts` pins the globs to exactly those two, so a new glob fails there first, and an unknown filter fails the guard closed | reject |
| 9 | Blind | `README.md` says "the tests stay at the repository root", but the Hub's unit suites moved with it | low | Real: a reader looking for the Hub's suites at the root would not find them; a direct correction | patch |
| 10 | Blind, Ponytail | `apps/hub/tsconfig.json` repeats the root's compilerOptions, and the root could extend it | low | Drift shows loud, since CI runs both typechecks (`tsc` in `test`, `next build` in `rendered-output`); the Hub's must stay self-contained for Story 3.3's pruned context, and deduping restructures the root gate config the story keeps to a path rewrite | reject |
| 11 | Blind | The `AGENTS.md` edits sit in the managed block a refresh replaces | false | A refresh re-derives the same facts from this tree; left stale, the block would tell every Epic 3 agent to run a command that now fails. Story 3-1 edited the block the same way | reject |
| 12 | Blind, Ponytail | `turbo.json` keeps `//#build` though the root has no build script | low | Dead config that frozen Decision 4 keeps inert, as Story 3-1 designed; its one hazard needs a root `build` script, which `AGENTS.md` now says the root does not have | reject |
| 13 | Blind, Verification gap | The runner stage's new `CMD` and standalone copies are held by no test, and nothing in CI builds or starts the image | medium | Pre-verified gap: `docker/__tests__/runner-stage.test.ts` reads the public copy and the builder command alone. Observed serving every route on a local build; Story 3.3 replaces this Dockerfile and builds and healthchecks the image in CI | defer, into DW-257 (this story's) |
| 14 | Blind | The deps-stage planted negatives hard-code `apps` and `packages` | false | A third glob fails that suite's pinned-globs case first | reject |
| 15 | Edge | A filter spelled `hub...` or `./apps/hub` reads as an unknown workspace | low | Fails closed; the workflows use plain names | reject |
| 16 | Edge | `fromHub` would conflate a root-level directory named like a Hub root | low | No such directory exists, and one would be scanned as the Hub's, failing loud if it names a contract role | reject |
| 17 | Verification gap | `next.config.js`'s version source is observed by no test: the health route's suite asserts only a string | low | Pre-verified. The version is diagnostic: the endpoint's one monitor keys on `"status":"ok"` alone (`ops/monitoring.md:48`), and the fix is a new test | reject |
| 18 | Ponytail | The DW-252 guard could be two pinned script names | false | The guard derives its list from the workflows, so it follows CI's commands as they change and reaches `lighthouse.yml`'s filters; a two-name pin would drift from `ci.yml` silently | reject |
| 19 | ECC | The layer's literal build, `corepack pnpm build`, fails: `_bmad/custom/bmad-build.toml:93` still names the command this story retired | medium | Observed exit 1, "Command "build" not found", and the verified `corepack pnpm --filter hub build` exit 0. The fix edits a BMAD customization file | defer, DW-259 |
| 20 | ECC | None beyond row 19: typecheck 0 errors, 1659 of 1659 tests, no secret pattern or `console.log` added; lint N/A | none | Observed on the tree reviewed | none |
| 21 | Design Review | None: the only surface lines are the two `@use` paths into `contracts/`. Approve | none | The compiled CSS is unchanged: anchor-contract, contract-anchor and the `/work` baseline all pass | none |

## Design Notes

**Oversized, kept.** At the plan checkpoint the spec measured about 5,042 tokens (20,168 characters
over four; 2,690 words), against the SCOPE STANDARD's 1600. Answer **Keep**, relayed by the
orchestrating workflow on 2026-09-28 as the Operator's instruction of that day to finish Epic 3
unattended with the stories as written, the answer the unattended Epic 2 run used on 2026-09-23.
The multi-goal check found one goal: DW-252 and the path references are consequences of the move,
not deliverables beside it.

**Open Questions, answered from the sources.** Four gaps an Operator would notice: which
configuration counts as the Hub's own, where the dependencies are declared, the workspace's name, and
the `/recommendation` route. Each is answered in Decisions from `epics.md`, AD-20, AD-8, AD-3,
`ops/contract-serving.md` § The five things Epic 3 has to touch, DW-138 and DW-252, per the
orchestrator's standing instruction; none is irreversible.

**Why the harness stays at the root, and why root scripts cannot delegate.** The unit suite is one
Vitest run whose `ops/`, `packages/` and `docker/` suites resolve the tree from `process.cwd()`;
split into a Hub run under `apps/hub`, those break and CI's `test` job needs a second invocation. A
root `build` script delegating to `pnpm --filter hub build` would keep `corepack pnpm build`, but
`pnpm` is not on PATH inside a script `corepack pnpm` runs on this host (observed: no directory on
the script's PATH holds a `pnpm` binary), and a root `build` beside `hub#build` would make
`turbo run build` build the Hub twice. So the Hub's commands become `corepack pnpm --filter hub
<script>`, and the records say so.

**The prototype (scratch clone, 2026-09-28).** Observed before planning was closed: the lockfile
delta is `apps/hub: {}` (2 lines); `pnpm --filter hub build` finds `next` on the workspace root's
`node_modules/.bin`, which pnpm 10.31.0 adds to every package script (`extraBinPaths`); a Linux image
built from the rewritten Dockerfile writes `apps/hub/.next/standalone/apps/hub/server.js` beside
`node_modules/{next,react,react-dom,sharp}` (tracing root `/app`) and serves every route the matrix
names with `/api/health` at 3.0.0; `next build` leaves `apps/hub/tsconfig.json` untouched. A Windows
build of the clone failed on a 262-character module path (the scratch prefix); the checkout's is 156.

**For Story 3.3 (filed as DW-257).** `turbo prune hub --docker` exits 0 and drops `style-dictionary`
(645 packages against 707), but `full/` carries neither `contracts/` nor `packages/contracts-serve/`,
both of which the Hub's build reads, and the pruned lockfile keeps the root importer's whole set.

**Files touched outside AD-20's six, and why.** Each carries a path the move changes; none changes
what the Hub renders or what a gate asserts.

| File | Reason |
|---|---|
| `apps/hub/package.json` (new) | The workspace `hub`: the Hub's `dev`, `build` and `start`, the publish reached from its directory |
| `apps/hub/tsconfig.json` (new) | `next build` reads the tsconfig beside `next.config.js`; a copy, since a pruned context (Story 3.3) carries no root tsconfig |
| `package.json`, `pnpm-lock.yaml` | The three scripts leave with the Hub; the `apps/hub` importer |
| `apps/hub/next.config.js`, `app/scss/_index.scss`, `lib/registry.ts` | The version, the contract and the Registry are now two, four and three levels up |
| `packages/contracts-serve/publish.mjs` and its suite, `docker/__tests__/runner-stage.test.ts` | The served copy's destination and the runner's copy of it (`ops/contract-serving.md` things 1 to 5) |
| `.gitignore`, `.dockerignore` | The build output and the served copy now sit under `apps/hub/` |
| `playwright.config.ts` | The harness's server is the Hub's build and start |
| `ops/literal-conformance.mjs` and its suite, `ops/cs-tracker-adoption-probe.mjs` | The print allowance's path; the Hub's built stylesheet |
| `docker/__tests__/deps-stage.test.ts` | Its pinned workspace list gains `apps/hub`, and its planted negatives now match `apps/` manifests too |
| Four `ops/` suites, six browser specs, the Hub suites | Hub paths read from the root, root paths read from the Hub |
| `ops/hub-accessibility-probe.mjs`, `tests/e2e/contract-serving.pw.ts` | A refusal and a header comment that name the Hub's build and start |
| `ops/__tests__/workflow-hardening.test.ts` | DW-252's guard |
| `turbo.json`, `ops/__tests__/turborepo.test.ts` | Three descriptions and a comment that forecast the move |
| `AGENTS.md`, `README.md`, seven `ops/` records | Present-tense commands and paths: `contract-serving`, `literal-conformance`, `rendered-output-harness`, `asset-budget`, `cs-tracker-token-adoption`, `hub-accessibility-pass`, `status-mark-axes` |
| `ops/anchor-token-adoption.md`, `ops/hit-target-floor.md` (fix round 1) | A present-tense harness server command and a present-tense container command the move left stale; the same round amended four of the seven records above (Spec Change Log) |

## Verification

All observed on 2026-09-28 on this host (Windows 11, Node v24.15.0, pnpm 10.31.0) over `857ac6b` plus
the working tree, unless a line says otherwise.

**Commands:**

- Baseline, before any edit: `corepack pnpm typecheck` exit 0; `corepack pnpm test --run` exit 0,
  "Test Files 64 passed (64)", "Tests 1653 passed (1653)".
- After the change: `corepack pnpm install --frozen-lockfile` exit 0; `corepack pnpm typecheck` exit 0;
  `corepack pnpm test --run` exit 0, "Test Files 64 passed (64)", "Tests 1659 passed (1659)", the six
  new cases the DW-252 guard's (four per workflow, one non-vacuous read, one planted control). One
  intermediate run failed DW-135's two WSL cases (`deploy-remote`, `library-backup`), and the next
  passed them, as `AGENTS.md` says.
- `corepack pnpm --filter hub build` exit 0: "packages/contracts-serve: published 11 files at
  /contracts/", "Next.js 16.2.1 (Turbopack)", "Running TypeScript", routes `/`, `/_not-found`,
  `/api/health`, `/celeste`, `/cv`, `/work`; the server at `apps/hub/.next/standalone/apps/hub/server.js`;
  `apps/hub/tsconfig.json` still blob `6159945` afterwards. The root's `corepack pnpm build` exit 1,
  "Command "build" not found".
- `git diff 857ac6b -- pnpm-lock.yaml`: two added lines, `apps/hub: {}` and a blank one; `packages:` and
  `snapshots:` untouched.
- The image as production builds it: `docker build -f docker/Dockerfile .` exit 0, the builder listing
  the same six routes; its deps stage again with `--no-cache`: "COPY apps/hub/package.json
  ./apps/hub/", "Packages: +588", "Done in 21.4s", exit 0. The container answered `/`, `/cv`, `/work`,
  `/celeste`, `/api/health`, `/pdf/cv.pdf`, `/pdf/recommendation-letter.pdf`,
  `/assets/og/og-image.png` and `/favicon.ico` 200, `/projects` 301 to `/#suite`, `/recommendation` and
  `/nope` 404, `/contracts/` 308 to `/contracts`, and `/api/health` `{"status":"ok","version":"3.0.0","uptime":2}`;
  all 11 files under `/contracts/` were byte-identical to `contracts/` (`cmp`). The base commit's image,
  built from a scratch clone at `857ac6b`, gave the same fourteen probe lines (`diff` empty). Both
  images deleted afterwards.
- `turbo prune hub --docker` exit 0: `json/apps/hub/package.json` and `json/pnpm-lock.yaml`, and
  `full/` holding `apps/`, `package.json`, `pnpm-workspace.yaml` and `turbo.json`, with no `contracts/`
  or `packages/` (DW-257); the pruned lockfile 645 packages against 707, no `style-dictionary`.
  `turbo prune portfolio --docker` exit 1, "x Invalid scope".
- `git log --follow` from the new paths, after the move's commit `bc9cd25`: `apps/hub/lib/registry.ts` 7
  commits (its 6 at `lib/registry.ts` plus the move), `apps/hub/components/organisms/SuiteDirectory/SuiteDirectory.tsx`
  8 (7 plus 1), `apps/hub/next.config.js` 24 and `apps/hub/app/page.tsx` 25, back to `5076f22` of
  2023-07-12 through their earlier renames; the move reads `R097 next.config.js apps/hub/next.config.js`,
  the CRLF file whose edit kept its endings, and 103 renames in all, 89 of them at 100 percent.
- The five no-browser gates as their jobs run them: `tokens:build` and `fonts:build`, build inputs
  empty, exit 0 with `git status --porcelain --ignored=matching -- contracts/` empty after each;
  `node ops/contract-purity.mjs` "read contracts/, 11 files, none executable and no link (AD-1).";
  `node ops/registry-schema.mjs` "16 applications, valid"; `node ops/literal-conformance.mjs` "read 25
  stylesheets, 21 outside the permitted set and 4 inside it; no colour, spacing or type literal outside
  it". All exit 0.
- Rendered output, the `AGENTS.md` container command as amended (`-v pw-next:/w/apps/hub/.next`), in
  `mcr.microsoft.com/playwright:v1.62.1-noble`: install "Already up to date", "[WebServer] > hub@ build
  /w/apps/hub", "Running 343 tests using 1 worker", "343 passed (6.6m)", exit 0; no snapshot written;
  the baseline's sha256 `93a1aa4e9c8374207ae689707b1e843285ba927fb762ed2f09d105050b9a59d8` and its
  2026-09-23 mtime unchanged. Run again on the final tree, after the review's patches and the string
  fixes in four specs: "[WebServer] > hub@ build /w/apps/hub", then "hub@ start", "343 passed (6.6m)",
  exit 0, the baseline unchanged.
- Lighthouse in the same image, on its Node v24.18.1, taken as `lighthouse.yml` takes it (the Hub built
  by filter with both Umami variables empty, `pnpm --filter hub start` on 3000), with `@lhci/cli` 0.15.1
  `collect` then `assert` against `.lighthouserc.js`: "Checking assertions against 3 URL(s), 9 total
  run(s)", `lhci assert` exit 0; accessibility, best practices and SEO 1 on all nine runs of `/`,
  `/work` and `/cv`, Lighthouse 12.6.1 under Chrome 151 (performance, not gated: 0.69, 0.66, 0.65;
  0.91, 0.91, 0.92; 0.87, 0.88, 0.86). `collect` was given `--no-sandbox` because the container runs
  Chrome as root; the first attempt without it collected nothing, and its vacuous assert is not counted.
- `node ops/cs-tracker-adoption-probe.mjs` against the moved build: "# hub css:
  apps\hub\.next\static\chunks\0gs22kdgso-7q.css", "# 19 cases, 19 PASS, 0 FAIL".
  `node ops/asset-budget.mjs` exit 1, "no production build to measure: .next/BUILD_ID is not there"
  (DW-256).
- Planted breaches, each removed and the tree restored: the root's `test` script deleted, then
  `corepack pnpm test --run` exit 0 with no output at all (DW-252's hazard) and the new case failing,
  "expected [ '//#test' ] to deeply equal []", `package.json` restored byte for byte (`cmp`);
  `corepack pnpm test --run no-such-test-file-anywhere` exit 1, "No test files found, exiting with code
  1"; a failing case at `apps/hub/lib/__tests__/zz-planted.test.ts` exit 1; `apps/hub/lib/zz-planted.ts`
  assigning a string to a `number`, root `corepack pnpm typecheck` exit 2 ("error TS2322") and
  `corepack pnpm --filter hub build` exit 1 ("Type error: Type 'string' is not assignable to type
  'number'").

**Remaining, the Operator's: AC5's live proof.** AD-20 makes the move its own shipped step with
nothing else changing, and Story 3.1's so-that keeps it from also being a build-system introduction,
so Epic 3 cannot reach `main` as one merge. On 2026-09-28 `origin/main` read `bda92cc`, and `dev`
carries Story 3-1's four commits (`e9f77a1` to `857ac6b`) beneath this story's. In order, and none of
it done by this run:

1. After the rulings 3-1's board row names, merge `857ac6b`, 3-1's last commit, into `main` alone: a
   pull request into `main` whose head is a branch at that commit, since `dev` carries later work. See
   its checks, the Deploy run and `lighthouse.yml` green, and cuatro.dev serving.
2. Probe cuatro.dev (before): `/`, `/cv`, `/work`, `/celeste` and `/api/health` 200, `/projects` 301
   to `/#suite`, `/recommendation` and an unknown path 404, and every file under
   `https://cuatro.dev/contracts/` 200.
3. Merge 3-2's last commit (the last one scoped `3-2`, before Story 3-3's first) alone the same way,
   before any later Epic 3 story reaches `main`, polling `/api/health` through the Deploy run
   (during).
4. Probe again (after): the same answers, `/api/health` reporting version 3.0.0, and all eleven files
   under `/contracts/` byte-identical to `contracts/` at that commit.

Where this spec and the records it amends say "live at the Epic 3 merge", for the move that merge is
step 3.
