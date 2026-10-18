---
title: 'Story 9-9: extract the shared probe scaffold'
type: 'refactor'
created: '2026-10-18'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-plan-2026-10-18.md'
  - '{project-root}/_bmad-output/implementation-artifacts/dw-triage-2026-10-18.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `ops/cs-tracker-adoption-probe.mjs` and `ops/daisyui-route-probe.mjs` each carry their own copy of the
same scaffold (`moduleDir`, `say`, `run`, `describeRun`, `readOrNull`, `serve`, with their own `createServer`,
`spawnSync` and `stripVTControlCharacters` imports), so a fix to one copy never reaches the other (epic-1 retro item
10, triage row in `dw-triage-2026-10-18.md`).

**Approach:** Move the scaffold into one `ops/` module that both probes import, keeping the daisyUI copy's comments
(it is the commented one), with no change to what either probe observes or reports. Pin the shared import with a
test, and re-run `cs-tracker-adoption-probe.mjs` by hand (read-only against cs-tracker and public URLs) and record
the run here. Surface: `ops/` scripts and tests, no deploy.

</frozen-after-approval>

## Implementation Notes

Route oneshot: no intent gap, nothing irreversible, two scripts changed, one module and one suite added.

- **New `ops/probe-scaffold.mjs`** (`6cfad7fc076f698a7358476ba708a3879d3c5749`): `REPO_ROOT`, `CONTRACTS`,
  `CS_TRACKER` (from its own guarded `moduleDir`, which is `ops/` for both probes), `BlockedError`, `say`, `run`,
  `describeRun`, `tailwindBanner`, `readOrNull`, `serve` (with `MIME`) and `invokedDirectly(import.meta.url)`, which
  replaces each probe's `sameFile`/`thisFile`/`entry` trio. The comments are the daisyUI copy's, including its
  `.bat` shell and DEP0190 notes beside `run`. Each probe keeps only a one-line `run` wrapper that fixes its own
  `TIMEOUT_MS` (300 000 and 600 000; the daisyUI one also passes `shell` on Windows, as before), and its own entry
  block, exit codes and comments. `firstMatch` stays in the daisyUI probe, which still uses it for `phx_new`.
- **The two copies differed in two places, and both differences are kept by parameter, not merged:** the timeout
  (now carried on the result, so `describeRun` quotes the figure the command was really given) and the Windows
  shell (the adoption probe spawns no batch file and never used one).
- **Public surface unchanged:** each probe re-exports `BlockedError`, `CONTRACTS`, `CS_TRACKER`, `REPO_ROOT` and
  `tailwindBanner`, so `cs-tracker-adoption-probe.test.ts` and `daisyui-route-probe.test.ts` import exactly what
  they did and pass untouched. Unused imports the move left behind are dropped (`mkdirSync` in the adoption probe
  was already unused).
- **The shared `CS_TRACKER` comment is corrected:** the daisyUI copy said "this story writes nothing under it", but
  the adoption probe plants five files there for its scan cases and removes them (its `cs-tracker's tree is
  unchanged` case). The shared comment says both.
- **New `ops/__tests__/probe-scaffold.test.ts`**, 9 cases: each probe imports the scaffold and defines none of it
  again (no local `moduleDir`, `say`, `describeRun`, `readOrNull`, `serve`, `sameFile`, `thisFile`,
  `tailwindBanner`, `BlockedError`, and no `createServer`, `spawnSync` or `stripVTControlCharacters`); the re-exports
  are the scaffold's own bindings; `run` carries its timeout into `describeRun`; `serve` answers 200 with the MIME
  type, and 404 for `/..%2fsecret.txt`, a directory and a missing file; `invokedDirectly` is true only for
  `process.argv[1]`.
- **Surprise: the adoption probe is BLOCKED against cs-tracker's current `main`, before and after this change.**
  cs-tracker's Story 8.1 restyle (`a0bfbb5272c4777342da438df66dd36c7d8180ed`, "displace daisyui components with the
  cuatro restyle vocabulary") removed the daisyUI class strings the probe's fixture is read from, so its
  `fixtureDrift` guard refuses to run (32 strings). That is the probe's own Block If working, not this refactor: the
  unrefactored probe from `dev` blocks identically. Reworking the fixture for the restyled markup is a redesign of
  the probe and needs an Operator ruling, so it is returned to the Operator, and the green run below is against the
  last pre-restyle cs-tracker commit.

## Planted failures

Each assertion of `probe-scaffold.test.ts` was made to fail once by breaking the code it guards in place (one `sed`
each, `changed: yes` checked by hash), then restored from a copy (`cmp` clean after):

- **P1, daisyUI probe's import line in double quotes:** `× daisyui-route-probe.mjs imports the scaffold and defines
  none of it again`, `AssertionError: expected '// The daisyUI adoption route probe (…' to match /^import
  \{[^}]*…/probe-scaffold\.mjs';$`, `Tests 1 failed | 8 passed (9)`. A first form of this assertion
  (`toContain("from './probe-scaffold.mjs'")`) stayed green under this plant, because the `export { REPO_ROOT } from`
  line also matched; it was tightened to the import statement naming `serve` and re-planted as recorded.
- **P1b, `serve` dropped from the adoption probe's import:** the adoption case fails the same way, `1 failed | 8
  passed (9)`.
- **P2, a local `function say` added to the daisyUI probe:** `AssertionError: expected [ 'say' ] to deeply equal []`.
- **P3, `spawnSync` named in the adoption probe:** `AssertionError: expected '// The \`cs-tracker\` token adoption
  pr…' not to match /\bcreateServer\b|\bspawnSync\b|\bstri…/`.
- **P4, the adoption probe exporting its own `BlockedError`:** `× re-exports the scaffold's bindings, ...`,
  `AssertionError: expected [Function BlockedError] to be [Function BlockedError] // Object.is equality`.
- **P5, `run` not carrying `timeout`:** `× carries the timeout it was given, ...`, `AssertionError: expected {
  status: +0, signal: null, …(4) } to match object { status: +0, signal: null, …(3) }`.
- **P6, `describeRun` quoting a fixed `600`:** same case, `expected 'was killed by SIGTERM, which is what …' to
  match /^was killed by SIGTERM, which is what…/`.
- **P7, `.css` served as `text/plain`:** `× serves a file under its root with its MIME type`, `Expected:
  "text/css; charset=utf-8"`, `Received: "text/plain"`.
- **P8, the `startsWith(root + sep)` guard removed:** `× answers 404 for /..%2fsecret.txt`, `AssertionError:
  expected 200 to be 404`.
- **P9, the directory guard removed:** `× answers 404 for /dir`, `TypeError: fetch failed`, `Caused by: SocketError:
  other side closed` (the read of a directory throws after the 200 head is sent and the handler destroys the socket).
- **P10, a non-`file:` URL read as the entry:** `× is true only for the script node was started with`,
  `AssertionError: expected true to be false`.
- **P11, any file read as the entry:** same case, `expected true to be false`.

Every plant: `Tests 1 failed | 8 passed (9)`.

## By-hand probe run

`cs-tracker-adoption-probe.mjs` reads cs-tracker beside the repository, so it ran against a fresh clone of the
public `https://github.com/LuigiEspinosa/cs-tracker` at `C:\CuatroEcosystem\epic9-wt\cs-tracker-workspace\cs-tracker`
(where the worktree's `CS_TRACKER` resolves; the Operator's own checkout was not touched), after `mix deps.get` and
`mix tailwind.install` there (Tailwind v4.1.12 from its GitHub release) and `corepack pnpm --filter hub build` in this
worktree. All runs 2026-10-18, `NO_COLOR=1 node ops/cs-tracker-adoption-probe.mjs`:

| cs-tracker at | Probe | Result |
|---|---|---|
| `main` `9f70d284f5d9da654458626dd1a438c3cf541717` | this story's | exit 3, `# BLOCKED: 32 fixture class string(s) are no longer in the cs-tracker file they were read out of` (first: `shell needs "bg-base-200" in lib/cs_tracker_web/components/layouts.ex`) |
| same | `dev`'s, unrefactored (`2cc96f93147b7e5672e028c0be364d73190070f5`) | the same BLOCKED line |
| `0e5d0c4f26535630f857072b8839c813566440c0` (parent of the restyle) | this story's, 22:20:39Z | **exit 0, `# 19 cases, 19 PASS, 0 FAIL`**, Tailwind v4.1.12, daisyUI 5.0.35, `cs-tracker's tree is unchanged` PASS (5 planted, 5 removed) |
| same | `dev`'s, unrefactored, 22:21Z | exit 0, 19 of 19; every PASS line and diagnostic line identical to the refactored run once the scratch directory's random suffix is removed (`diff` empty) |

So the refactor changes nothing the probe observes or reports. The daisyUI probe was not run by hand: it needs a
`mix phx.new` scaffold, a hex fetch and the `phx_new` archive, and the story asks for the adoption probe's run; its
unit suite (`daisyui-route-probe.test.ts`) passes untouched and its module imports cleanly.

## Review Triage Log

Layers: Blind Hunter and `verification-loop`, both run inline by this workflow sub-agent (it has no tool to launch
review subagents). Findings and verdicts:

- The shared `CS_TRACKER` comment carried over "writes nothing under it", false for the adoption probe. **low,
  patched** in this story (comment now names the planted files and the `git status` case).
- `describeRun` would print `NaN second timeout` for a command killed by a signal when `run` was given no timeout.
  **low, rejected**: both probes always pass one through their wrapper, and only the timeout kills with a signal in
  either probe.
- The adoption probe now passes `shell: false` explicitly where it passed nothing. **false**: `false` is
  `spawnSync`'s default.
- `invokedDirectly` could misfire when a probe is imported rather than run. **false**: it compares realpaths of
  `process.argv[1]` and the module's own file, as both copies did; case P10 and P11 pin both directions.
- `cs-tracker-accessibility-probe.mjs` still carries its own `moduleDir` and `say`. **low, outside this story**: the
  action names the two probes only; returned to the Operator rather than widened here.
- The adoption probe's header says "It writes nothing into cs-tracker", which the planted files contradict. **low,
  pre-existing, outside this diff**: returned to the Operator.
- The adoption probe is BLOCKED against cs-tracker `main` since the Story 8.1 restyle. **medium, pre-existing**:
  needs a ruling on reworking or retiring the probe's daisyUI fixture; returned to the Operator.

## Ledger closures

No deferred-work entry names this story. One sprint-status action item:

- **epic-1-retro-item-10-extract-the-shared-probe-scaffold-into-o:** done 2026-10-18 by Story
  9-9-shared-probe-scaffold (`6cfad7f`, `ops/probe-scaffold.mjs`): both probes import one scaffold module with the
  daisyUI copy's comments, and the adoption probe re-ran 19 of 19 against cs-tracker `0e5d0c4` (its current `main`
  blocks on the Story 8.1 restyle's fixture drift, before and after, returned to the Operator).

## Verification

**Commands, run 2026-10-18 in this worktree:**
- `corepack pnpm exec vitest --run` (full root suite, before the final comment-only edits): `Test Files 3 failed |
  82 passed (85)`, `Tests 3 failed | 2002 passed | 1 skipped (2006)`. All three failures were DW-135 host stalls,
  each reported as `WSL did not answer` (`demo-reset`, `deploy-remote`, `library-backup`); those three files
  re-run with the new suite: `Test Files 4 passed (4)`, `Tests 126 passed (126)`.
- The four probe suites (`probe-scaffold`, `cs-tracker-adoption-probe`, `daisyui-route-probe`,
  `cs-tracker-accessibility-probe`) after the last edit: `Tests 170 passed (170)`.
- `corepack pnpm typecheck`: exit 0 after the last edit (the first run failed on the test's `{ timeout }` argument
  against `run`'s inferred options type, fixed with a JSDoc `@param` naming `SpawnSyncOptions`).
- `node --check` on all three modules: clean. No `apps/*` file changed, so no per-application suite applies.

**Independent verifier:** pending. No independent verifier has run on this spec; a separate agent must run it.
