---
title: 'CI enforces the contract boundary'
type: 'feature'
created: '2026-08-25'
status: 'done'
baseline_commit: 'b1e02da5e59832796f68ca48d27b265fc50cf622'
baseline_revision: 'b1e02da5e59832796f68ca48d27b265fc50cf622'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-11-publish-contracts-tokens-css-from-packages-tokens.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-13-publish-contracts-tailwind-css-the-generated-theme-inline-ad.md'
warnings: ['oversized']
deferred:
  - summary: >-
      The bmad:context block in AGENTS.md describes a CI file, a suite size and a browser
      toolchain that stopped being true four stories ago.
    evidence: |-
      AGENTS.md:52-53 reads "CI (.github/workflows/ci.yml) runs typecheck and tests only"
      against a file that now carries five jobs, "The full suite is 38 tests in roughly 45
      seconds" against a suite this story leaves at 474, and AGENTS.md:55-57 reads "Playwright
      is not installed" against a rendered-output job that runs pnpm test:e2e. Pre-existing:
      stale since Stories 1-10 and 1-11. Every story since has recorded it as a Pending
      Operator action rather than fixing it, because the block is managed by
      bmad-project-context and edits inside it are replaced on refresh, which is why this
      story's boundaries forbid touching it. It needs one bmad-project-context refresh, not a
      per-story note.
    location: >-
      AGENTS.md:52-57
    severity: low
  - summary: >-
      No job in ci.yml declares a permissions block, so all five inherit the repository default
      GITHUB_TOKEN scope rather than the contents:read they each need.
    evidence: |-
      .github/workflows/ci.yml declares no `permissions:` key at the top level and none on any of
      the five jobs. Every job here only reads the tree and runs a command, so `contents: read` is
      the whole requirement, and a single top-level block would close it for all five at once. The
      new contract-purity job's own comment claims that "nothing reaching this runner can redirect
      it", which is true of argv and of `env:` and says nothing about the token the runner hands
      the process. Pre-existing: the four jobs at b1e02da have the same gap, and this story's
      boundaries forbid touching them or any line of the file outside the job it adds, so closing
      it properly means one top-level key, which is a change to the file as a whole rather than to
      one job.
    location: >-
      .github/workflows/ci.yml
    severity: low
---

<intent-contract>

## Intent

**Problem:** AD-1 says CI fails if any file under `contracts/` matches `\.(ts|js|tsx|jsx|mjs|cjs)$`,
and `AGENTS.md:64-66` tells every agent that it does. Neither is true today. `.github/workflows/ci.yml`
has no purity job: the only thing holding the rule is a pinned nine-path list inside
`packages/tokens/__tests__/tokens-contract.test.ts`, which fails on a `.ts` under `contracts/` only as
a side effect of the list no longer matching, and says nothing about AD-1. The published surface is now
complete (nine files, v1.0.0) and Stories 1.16, 1.19 and 2.5 vendor it into other repositories, so the
boundary needs a gate of its own before the folder is consumed estate-wide.

**Approach:** Add `ops/contract-purity.mjs`, a zero-dependency checker that walks the published surface
and exits non-zero naming AD-1 and every offending path, and one blocking `contract-purity` job in
`.github/workflows/ci.yml` that runs it. Assert its refusals permanently in `ops/__tests__/`, demonstrate
the gate once against a planted `contracts/probe.ts` and remove the probe in the same story, and record
the gate, the probe output and the stated limits in `ops/contract-purity.md`.

## Boundaries & Constraints

**Always:**
- The rule is AD-1's: any file under `contracts/` whose name matches `\.(ts|js|tsx|jsx|mjs|cjs)$` fails
  the build. The check may be stricter than that pattern, never looser, and every deviation is recorded
  with its reason.
- The failure message names AD-1 and names every offending path, repo-relative with forward slashes, so
  a Windows checkout and a runner print the same string.
- The job is blocking (AD-21): no `continue-on-error`, no `|| true`, no `if:` skip, no soft exit. It sits
  in `.github/workflows/ci.yml` and inherits that file's `on:` block (`push` to `**`, `pull_request` to
  `main`) rather than declaring its own, so the two can never drift.
- The gate fails closed. A missing `contracts/` directory, an empty one, or a walk that reaches zero
  files is a refusal, not a pass: a green run must mean the surface was read.
- Nothing redirects the check at runtime. No environment variable and no argument selects the directory
  it reads, because `ci.yml:53-64` had to pin two build inputs empty to close exactly that hole.
- The checker is a script under `ops/` and is never published. Nothing this story writes lands under
  `contracts/` at the closing commit.
- Every recorded number is marked observation or decision and carries its method (NFR-9). Dates are
  ISO 8601 UTC.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash and no
  emoji. The commit is a subject line only, no body and no trailer.

**Block If:**
- Making the gate pass on the committed tree would need a file under `contracts/` renamed, moved or
  deleted. The published surface is v1.0.0 and a rename is a MAJOR bump under AD-16, which is not this
  story's call.
- The rule as written cannot be enforced without weakening an existing gate.

**Never:**
- Never edit anything under `contracts/` (except planting and then removing the probe), anything under
  `packages/`, `packages/tokens/__tests__/tokens-contract.test.ts`,
  `packages/fonts/__tests__/fonts-contract.test.ts`, `package.json`, `pnpm-lock.yaml`,
  `pnpm-workspace.yaml`, `docker/`, `app/`, `public/`, any component stylesheet, `.lighthouserc.js`,
  `.github/workflows/lighthouse.yml`, `.github/workflows/deploy.yml`, `vitest.config.ts`,
  `playwright.config.ts`, or any file under `tests/`.
- Never touch the existing `test`, `tokens-contract`, `fonts-contract` or `rendered-output` jobs in
  `.github/workflows/ci.yml`. This story adds one job and changes no line of the four.
- Never fold the new check into an existing job, and never replace the purity assertions already in
  `tokens-contract.test.ts`. Two independent readers of one rule is the intended state.
- Never add a dependency, a workspace package, or a `package.json` script. The checker imports only
  `node:` builtins, which is what lets the job run without an install.
- Never edit `epics.md`, `DESIGN.md`, or the `bmad:context` block in `AGENTS.md`. `AGENTS.md:64-66`
  already states the rule; this story makes the statement true rather than amending it.
- Never leave the probe, an index entry for it, or a `.gitignore` rule about it in the tree.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| The committed surface | `contracts/` as at `b1e02da`, nine files | Passes, printing the count of files read and the surface it read | Exit 0 |
| A planted probe | `contracts/probe.ts` | Fails, naming AD-1 and `contracts/probe.ts` | Exit 1 |
| A nested probe | `contracts/fonts/helper.mjs` | Fails, naming AD-1 and the nested path | Exit 1 |
| Several offenders | Two executable files under `contracts/` | Fails, naming both paths, not only the first | Exit 1 |
| An extension in another case | `contracts/probe.TS` | Fails. A case-insensitive checkout serves it as `.ts` | Exit 1 |
| A near miss | `contracts/notes.txt`, `contracts/a.css.map` | Passes. The rule matches the final extension only | Exit 0 |
| A symlink under the surface | `contracts/data.css` linked at a `.mjs` outside | Fails, naming the path as an unresolvable publication | Exit 1 |
| The directory is gone | `contracts/` missing or renamed | Fails, naming the directory it could not read | Exit 1 |
| The directory is empty | `contracts/` present with no files | Fails, saying the surface is empty so nothing was checked | Exit 1 |
| The job is soft-failed | `continue-on-error` or `|| true` added to the job | The standing workflow case fails, naming AD-21 | Non-zero test run |
| The job is removed | The `contract-purity` job deleted from `ci.yml` | The standing workflow case fails, naming the job | Non-zero test run |

</intent-contract>

## Code Map

Gathered 2026-08-25 against `b1e02da`, working tree clean.

- `.github/workflows/ci.yml:1-7`: the `on:` block the new job inherits: `push` to `**`,
  `pull_request` to `main`. `:31-88` `tokens-contract` and `:90-142` `fonts-contract` are the
  shape to follow for a small job (checkout, setup-node 22, `timeout-minutes`, one commented step),
  and `:144-186` `rendered-output` is the only container job. **No purity job exists.** All four
  existing jobs are read-only for this story.
- `ops/capacity-gate.mjs`: **the pattern to follow.** A zero-dependency ESM checker with an exported
  `main(argv)` returning `{ allowed, message }` rather than exiting, `:381-399` the invoked-directly
  guard and the write-callback exit (`process.exit` on a pipe truncates a CI message), `:99-101` the
  refusal helper, `:22-29` the one-source-of-truth path constants exported so a test can assert the
  message still names them.
- `.github/workflows/deploy.yml:11-31`: **precedent for a job step that runs a Node script with no
  install**: checkout plus `setup-node` only, then `node ops/capacity-gate.mjs`. The comment there is
  also the model for stating why a gate is blocking.
- `ops/__tests__/capacity-gate.test.ts:1-80`: the test idiom: `resolve(process.cwd(), ...)` rather
  than `import.meta.url` (under Vitest that is a vite URL), a `spawned()` guard so a failure to start
  is not read as a refusal, scratch trees under `tmpdir()`, and `:16` reading the workflow file so the
  workflow's own wiring is asserted. `ops/__tests__/` is inside the blocking `test` job.
- `packages/tokens/__tests__/tokens-contract.test.ts:289-317`: the existing `EXECUTABLE` regex, the
  `SKIP_DIRECTORIES` set, `filesUnder()` and `repoRelative()`. `:881-897` is the pinned nine-path list
  plus the per-file executable assertion, and `:899-917` asserts the generator stays out of the surface.
  **Read-only here**, and the reason the probe will fail two jobs rather than one.
- `contracts/`: the nine published files: `tokens.css`, `fonts.css`, `tailwind.css`, three `.woff2`
  and three `OFL-*.txt` under `fonts/`. Nothing executable, so the gate is green on the committed tree
  before the probe and after it is removed.
- `_bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md:82-86` (AD-1) and `:202-206`
  (AD-21): the two governing rules, AD-21 naming "`contracts/` purity (AD-1)" in its list of gates
  that may never become warnings.
- `AGENTS.md:12-16` (policy) and `:64-66` (the rule as agents already read it). No edit.
- `ops/token-contract.md:309-334`: the drift-gate table shape (Property, Value, Nature) and
  `:336-463` the probe-demonstration shape: what was planted, what was observed, that it was reverted,
  and the output quoted verbatim. `ops/tailwind-adapter.md` follows the same shape and is the more
  recent example.
- `tsconfig.json:34-41`: `**/*.ts` is in the program, so a new `ops/__tests__/*.test.ts` is
  typechecked; `.mjs` is not, which is why `capacity-gate.mjs` carries JSDoc types for its test.
- `vitest.config.ts`: default includes pick up `ops/__tests__/*.test.ts`; `tests/e2e/**` is excluded,
  so nothing here starts a browser.
- Baseline observed 2026-08-25 at `b1e02da`: `corepack pnpm test --run` is the suite Story 1-13 left at
  431 passing in 21 files. Node v24.15.0 on this host, `corepack pnpm` working. `pnpm` is not on PATH.

## Tasks & Acceptance

**Execution:**
- `ops/contract-purity.mjs`: new. A zero-dependency ESM checker. Exports the rule (`EXECUTABLE`),
  the published-surface path constant, an `inspect(directory)` that walks it and returns the findings,
  and `main()` returning `{ ok, message }`; the invoked-directly guard writes the message and exits 1
  on a refusal, following `capacity-gate.mjs:381-399` including the write-callback exit. The walk is
  recursive, does not follow symlinks, and reports every offender rather than the first. It refuses a
  missing directory, an empty surface, and any symlink under the surface, each with its own message.
  Every refusal names AD-1 and the offending path or directory. A pass prints the surface and the
  number of files read. No environment variable and no argument redirects the directory it reads.
- `.github/workflows/ci.yml`: add one job, `contract-purity`, after `fonts-contract` and before
  `rendered-output`. Checkout, `setup-node` at 22, one step running `node ops/contract-purity.mjs`.
  No install and no pnpm cache: the checker has no dependencies, so the gate still fires when the
  lockfile does not resolve. `timeout-minutes: 5`. A comment states why it is blocking (AD-21) and why
  it installs nothing. Change no other line of the file.
- `ops/__tests__/contract-purity.test.ts`: new. One standing case per row of the I/O matrix, each run
  against a scratch tree under `tmpdir()` so the committed `contracts/` is never mutated, plus the two
  rows read off `.github/workflows/ci.yml`: the job exists and runs the checker, and it carries no
  `continue-on-error`, no `|| true` and no `if:`. A positive control asserts the committed surface
  passes, so the refusal cases cannot all be passing on a broken harness. One case spawns the checker
  as a subprocess against the committed tree to prove exit code 0 and the real read path.
- `ops/contract-purity.md`: new record: what the gate checks and what it deliberately does not, the
  job's properties in a Property/Value/Nature table, every refusal that is stricter than AD-1's
  regex with the reason for each, the probe demonstration with its output verbatim, which standing
  cases hold the failure paths permanently, the stated limits, and the Pending Operator actions.

**Acceptance Criteria:**
- Given AD-1 defines a contract as an artifact any estate language uses without executing
  Anchor-authored code, when the checker runs against a tree carrying a file under `contracts/` that
  matches `\.(ts|js|tsx|jsx|mjs|cjs)$` at any depth, then it exits non-zero and its message names AD-1
  and that path, and names every such path when there is more than one.
- Given AD-21 makes every CI gate blocking because no staging environment exists, when
  `.github/workflows/ci.yml` is read after the change, then it carries a `contract-purity` job running
  `node ops/contract-purity.mjs` with no `continue-on-error`, no `|| true` and no `if:` condition, the
  job declares no `on:` of its own so it runs on every push and every pull request to `main` by the
  file's existing triggers, and the `test`, `tokens-contract`, `fonts-contract` and `rendered-output`
  jobs are byte-identical to `b1e02da`.
- Given a gate that has never been observed to fail is not known to work, when `contracts/probe.ts` is
  planted and the job's command is run against it, then the command fails, its output is recorded
  verbatim in `ops/contract-purity.md`, and `git status --porcelain` is empty at the closing commit
  with no file under `contracts/` matching the executable pattern.
- Given a check that passes over nothing is worse than no check, when the checker is run against a
  missing `contracts/` directory and against an empty one, then it refuses in both cases naming the
  directory, and when it passes it prints the number of files it read.
- Given the published surface is v1.0.0 and vendored by later stories, when the diff against `b1e02da`
  is read, then `contracts/`, `packages/`, `package.json`, `pnpm-lock.yaml`, `app/`, `public/`,
  `docker/`, `tests/`, `.lighthouserc.js` and both other workflows are byte-identical, and the only
  files added are the checker, its test and its record.
- Given the checker is a script and not a contract, when the story closes, then it sits under `ops/`,
  is imported by nothing under `app/` or `packages/`, and `corepack pnpm typecheck` and
  `corepack pnpm test --run` both pass with the new cases counted.

## Spec Change Log

## Review Triage Log

### 2026-08-25, Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 16: (high 0, medium 3, low 13)
- defer: 1: (high 0, medium 0, low 1)
- reject: 4: (high 0, medium 0, low 4)
- addressed_findings:
  - `[medium]` `[patch]` **The root-link refusal was dead on the runner.** `main()` resolved the
    surface as `../contracts/`, and a trailing slash forces POSIX to resolve a link, so
    `lstatSync` reported the target and the refusal the record tables as deliberate could never
    fire on Ubuntu. The separator is gone and a subprocess case now reaches that refusal through
    the real entry point rather than through `inspect()`. Windows cannot demonstrate the
    mutation, so it was demonstrated in the pinned Playwright image and quoted in the record.
  - `[medium]` `[patch]` **Two refusal branches rested on nothing.** Replacing the
    unlistable-directory catch with a bare `return`, or the not-a-file branch with `continue`,
    left all 32 cases green, and an unlistable `contracts/fonts/` made the gate print
    `read contracts/, 3 files` and exit 0. That is the gate's own failure mode one level down.
    `inspect` now takes an injected directory reader on the `capacity-gate.mjs` precedent, which
    selects how a directory is listed and never which one, and three cases cover both branches.
  - `[medium]` `[patch]` **The record claimed a blocking reach it does not have.** A job in
    `ci.yml` holds no merge until it is a required status check, and `deploy.yml` fires on the
    same push with no `needs:`, so a red gate does not hold a deploy either. Stated as a limit,
    and the status check is now a Pending Operator action.
  - `[low]` `[patch]` An unlistable surface root printed `contracts/contracts`.
  - `[low]` `[patch]` `EXECUTABLE` and `RULE` were two hand-written literals that every refusal
    claimed were the same rule. `EXECUTABLE` is now derived from `RULE`.
  - `[low]` `[patch]` The no-redirect source assertion looked for `process.argv.slice`, which
    `process.argv[2]` walks straight past. It asserts the shape now, allowing only `argv[1]`.
  - `[low]` `[patch]` The refusal pluralized its count line and then said "Move it".
  - `[low]` `[patch]` Nothing pinned `timeout-minutes`, the absence of `env:`, or more than the
    first token of the `run:` line, and the job-name comparison carried no message.
  - `[low]` `[patch]` Deleting `findings.sort()` survived the multi-offender case, which made
    three independent `toContain` assertions. The order is asserted now.
  - `[low]` `[patch]` A test comment said `.gitattributes` pins LF on the published surface only.
    It also pins `*.mjs`, which is this story's own new file.
  - `[low]` `[patch]` The mutation table reused two matrix row names for different mutations.
  - `[low]` `[patch]` The junction fallback in `linkAt` pointed at the scratch root itself.
  - `[low]` `[patch]` Three collection-time reads failed with a raw ENOENT instead of the named
    error the case exists to report.
  - `[low]` `[patch]` `contracts/probe.ts.` passed the rule while Win32 serves it as `probe.ts`.
  - `[low]` `[patch]` A newline in a path forged extra lines in the refusal.
  - `[low]` `[patch]` The stated limits named a `.css` carrying JavaScript but not a file with no
    extension at all.

One finding was deferred (the stale `bmad:context` block in `AGENTS.md`, in frontmatter `deferred`)
and four were rejected: that the story closes with `git status` non-empty (the untracked spec is
this loop's own commit); that the `deploy.yml` line citations disagree (they were checked against
the file and they agree); that a directory named `util.mjs` under the surface should be refused (a
directory publishes nothing a consumer executes, and its contents are walked); and that the served
path and the seven vendored copies are unenforced (out of scope by the intent, owned by Stories
1.16 and 1.20, and recorded as stated limits).

### 2026-08-25, Review pass (second)

- intent_gap: 0
- bad_spec: 0
- patch: 15: (high 0, medium 3, low 12)
- defer: 1: (high 0, medium 0, low 1)
- reject: 9: (high 0, medium 0, low 9)
- addressed_findings:
  - `[medium]` `[patch]` **`.mts` and `.cts` walked straight through the gate.** Both are
    TypeScript a runtime executes, `tsconfig.json:34-41` puts `**/*.mts` in this repository's
    own program, and AD-1's literal list names neither, so `contracts/build.mts` was exactly
    the artifact the gate exists to stop and exactly the one it passed. The applied pattern and
    the quoted one are now built from one extension list, so a fifth stricter refusal was added
    without giving up the property that the two can never disagree, and the standing case
    asserts containment (everything AD-1 refuses, the checker refuses) rather than string
    equality, which is what the lower-bound argument actually needs. The refusal says the rule
    does not name the extension rather than claiming a match AD-1 never made.
  - `[medium]` `[patch]` **The invoked-directly guard failed open.** `sameFile` answered
    `false` whenever `realpathSync` threw, and a guard that decides it was not invoked directly
    runs nothing and lets the process exit 0. That is a green CI job over a check that never
    ran, in the one file whose whole thesis is failing closed. The fallback now compares the
    resolved paths, and a standing case reads the module's source to hold it, because reaching
    the throwing branch needs a path the OS will not resolve while still being the script Node
    just executed.
  - `[medium]` `[patch]` **The AD-21 assertions did not forbid `needs:`.** They pinned the
    absence of `continue-on-error`, `|| true` and `if:`, and a `needs: test` on the job is a
    skip condition wearing another name: it would drop the purity gate on every run where the
    suite is already red, which is the run where the published folder is most likely to have
    been reached for.
  - `[low]` `[patch]` Every refusal closed by telling the operator to move the entry under
    `packages/` and publish what it generates. A link, a socket and a directory that would not
    list are refusals too, and none of them can follow that instruction. Findings now carry
    whether they are the extension rule firing; the wording the recorded probe output quotes is
    unchanged, and both wordings have a case.
  - `[low]` `[patch]` The trailing-space half of the Win32 served-name rule rested on nothing.
    Narrowing `WIN32_TRAILING` from `/[. ]+$/` to `/[.]+$/` left all 43 cases green while the
    record stated `contracts/probe.ts ` fails as a fact.
  - `[low]` `[patch]` `runs-on` and `node-version` were tabled in a record that states its own
    rule that an unasserted figure drifts, and asserted nowhere. A `container:` is refused now
    as well.
  - `[low]` `[patch]` The builtin-imports case read static imports only, so a dynamic
    `import()` or a `createRequire` walked past it. On a job that installs nothing, that is not
    a slow run but a crash on the very run the no-install argument exists to cover.
  - `[low]` `[patch]` `printable` escaped the C0 controls and left U+2028, U+2029 and the
    bidirectional overrides through, so a name could still forge a line or be drawn as one with
    no executable extension at all.
  - `[low]` `[patch]` `printable` was not injective: a literal backslash and an `n` printed as
    the same string as a real newline, which made the escaping a second place to hide.
  - `[low]` `[patch]` `inspect().read` stayed true when the surface root would not list, and
    the positive control leaned on it as though it meant the whole walk landed.
  - `[low]` `[patch]` The spec used a double-dash as a prose dash 21 times, against its own
    Always constraint and against a recorded sweep that claimed to cover every file written.
    The sweep was built on surrogate-pair ranges, which never see the ASCII form.
  - `[low]` `[patch]` The count of refusals stricter than AD-1 was three in the spec, four in
    the record and a fifth in the record's prose.
  - `[low]` `[patch]` The subprocess-case count was two in the module header and three in the
    record against five in the file.
  - `[low]` `[patch]` The first pass rejected "a directory named `util.mjs` should be refused"
    on the reasoning that a directory publishes nothing and its contents are walked, and that
    decision then rested on the review log alone.
  - `[low]` `[patch]` Two names differing only in case collide on the case-insensitive checkout
    that the first stricter refusal exists for, and that gap was neither refused nor stated.

One finding was deferred (no `permissions:` block on any job in `ci.yml`, in frontmatter
`deferred`). Nine were rejected: that no standing check holds `ci.yml` to being valid YAML (a
recorded decision, and the parser it would need is a dependency the intent forbids); a hard link
under the surface (git cannot carry one, and content blindness is already a stated limit); a
recursion depth guard (a real directory cycle needs a bind mount, and a linked directory is
refused rather than followed); `code()` falling back to a message carrying a host path (the errno
branch is the one that fires); that the write-callback exit is unverified (the subprocess cases
already read the whole message back over a pipe, and the truncation it guards cannot be
reproduced below the pipe buffer); that the spec's deferred entry and Operator action 4 name
different subsets of the stories that noted the stale `bmad:context` block (neither claim is
load-bearing); that `setup-node` is unweighed against the "installs nothing" claim (the row
already enumerates exactly what is not installed); a `.css` carrying an `@import` that resolves
outside the folder (the content-blindness limit is stated twice already); and that the surface
label is substituted rather than derived, so no case distinguishes reading the published surface
from labelling something else as it (deliberate, recorded, and covered by the subprocess cases
that run against the real folder).

### 2026-08-25, Review pass (third)

- intent_gap: 0
- bad_spec: 0
- patch: 9: (high 0, medium 1, low 8)
- defer: 0
- reject: 16: (high 0, medium 0, low 16)
- addressed_findings:
  - `[medium]` `[patch]` **A refusal could still exit 0.** `process.exit` lived only inside the
    write callback, so a stderr torn down before that callback fired left the process falling off
    the end of the module with no exit code set, which is exit 0 on the one path that reports a
    violation. The last review pass rejected a neighbouring claim about the callback truncating a
    message; this is the other direction and it is the gate failing open. `process.exitCode` now
    carries the verdict before anything is written and the callback only decides when to leave.
  - `[low]` `[patch]` The unlistable-directory reason ended with `code(error)`'s message fallback,
    which is the one part of a reason that does not come from the module's own source, and a
    newline in it forged a line in the refusal exactly as one in a path did. Escaped where it is
    built rather than where the message is assembled, so the other reasons still quote AD-1's
    expression with its backslash intact. Both halves have a case.
  - `[low]` `[patch]` `printable` let the C1 controls through, which a terminal reads as escape
    sequence introducers, and let U+00AD, U+061C, U+200B to U+200D and U+FEFF through, which are
    drawn as nothing at all. The record claimed a name could not be drawn as something other than
    what it is while four ways of doing that were unescaped.
  - `[low]` `[patch]` **The closing-advice branch rested on two homogeneous fixtures.** Rewriting
    `allExecutable` from `every` to `some` left all 55 cases green while a refusal carrying a probe
    beside a link told the link to move under `packages/` and publish what it generates. Flipping
    the per-finding flag on the socket or the unlistable directory survived the same way. A mixed
    refusal has a fixture now, and both of those cases assert the wording they are not entitled to.
  - `[low]` `[patch]` The job-id pattern and the block reader assumed a lower-case job name, so a
    job named `E2E` evaded the five-name set and, worse, was swallowed into the preceding job's
    block, which would have run the AD-21 assertions over the wrong job.
  - `[low]` `[patch]` The "declares no `env:`" case read the job block only, and a workflow-wide
    `env:` reaches every job in the file while that block stays empty.
  - `[low]` `[patch]` `import { env } from 'node:process'` spelled no `process.env`, passed the
    `node:`-only imports case, and then read the runner's environment freely.
  - `[low]` `[patch]` Nothing pinned the job's `uses:` steps, so a fourth step could be added to the
    one job in the file that deliberately installs nothing, against a record that states it carries
    exactly three.
  - `[low]` `[patch]` The `every refusal` block sampled three of seven refusal kinds while reading
    as an enumeration of all of them. It now carries one fixture per kind.

Nothing was deferred this pass; the two entries already in frontmatter `deferred` stand. Sixteen
findings were rejected. The load-bearing ones: that the invoked-directly guard should exit 1 when it
cannot confirm (it would kill every in-process import of the module, including this suite's); that a
`readdir` returning no entry type should fall back to `lstat` (the current behaviour refuses, which
is the safe direction, on a filesystem the runners do not use); that the job should cover
`merge_group` and tag pushes, run after the two generators, or pin its actions by digest (all three
need lines of `ci.yml` outside the job this story adds, which the intent forbids); that the deferred
`permissions:` entry should be reopened as a job-level key (the ledger is not this run's to rewrite);
that the five-name `toEqual` couples this suite to any future job (it is what holds the
job-was-removed matrix row); that "installs nothing" overstates `setup-node` (adjudicated in the
second pass); and that `deferred-work.md`, `review_loop_iteration` and the empty Spec Change Log
disagree with the body (each is the orchestrator's bookkeeping or an accurate record of no
loopback having occurred).

## Design Notes

**Why a script and not an inline shell step.** A shell one-liner in `ci.yml` cannot be unit tested, and
this repository has learned twice that a gate is worth exactly what its failure path is worth: Story
1-11 recorded that `git diff --exit-code` was blind to an appeared file, and Story 1-13 found four
checks that could pass over nothing. A module with exported functions gets a standing case per matrix
row inside the already-blocking `test` job, so the refusals survive a later edit rather than resting on
one recorded demonstration. `ops/capacity-gate.mjs` is the same argument already made in this repository
for the same reason.

**Why the job installs nothing.** The checker imports only `node:` builtins. `deploy.yml:13-31` already
runs a gate that way. It means the purity gate reports on the boundary even when `pnpm install
--frozen-lockfile` fails, which is the run where a hurried fix is most likely to reach for the
published folder, and it makes this the fastest job in the file.

**The refusals stricter than AD-1's regex, and why each is safe.** AD-1 fixes a lower bound, so a
check may refuse more but never less. Case-insensitive matching, because a case-insensitive checkout on
macOS or Windows serves `probe.TS` as TypeScript while the literal regex reads it as a novel extension.
A name Win32 strips back to an executable one, on the same argument applied to how a checkout serves a
name rather than to its letter case. `.mts` and `.cts`, because both are TypeScript a runtime executes
directly and AD-1's list predates neither. A symlink under the surface, because a link named `data.css`
pointing at `packages/tokens/build.mjs` publishes executable code the extension rule cannot see, and the
folder is vendored by copy into seven repositories where a link resolves to something else or to
nothing. An empty or missing directory, because the failure mode of a purity gate is a green run over an
unread tree. None of them can turn a violation into a pass, which is the property that makes them safe
to add, and the full set with the reason for each is tabled in `ops/contract-purity.md`.

**Why the existing test keeps its own copy of the rule.** `tokens-contract.test.ts:881-897` pins the
nine published paths and asserts each is not executable. Importing the new checker there would give one
point of failure for two independent readings, and the pinned list catches a file that appears under
`contracts/` with a perfectly innocent extension, which purity does not. They are left as two checks of
overlapping scope on purpose, and the probe is expected to fail both.

## Verification

**Commands:**
- `node ops/contract-purity.mjs`, expected: exit 0, printing the surface and nine files read.
- `corepack pnpm typecheck`, expected: pass, with the new test file inside the program.
- `corepack pnpm test --run`, expected: the 431 tests observed at `b1e02da` still pass, plus the new
  cases, and no browser starts.
- Probe: create `contracts/probe.ts`, run `node ops/contract-purity.mjs`, expected: exit 1, naming
  AD-1 and `contracts/probe.ts`. Record verbatim. Also run `corepack pnpm test --run` while the probe
  exists and record which other cases fail, since the pinned published-file lists see it too. Then
  remove the probe and confirm `git status --porcelain` is empty.
- `git diff --stat b1e02da -- contracts packages package.json pnpm-lock.yaml app public docker tests
  .lighthouserc.js .github/workflows/deploy.yml .github/workflows/lighthouse.yml`, expected: empty.
- `git diff b1e02da -- .github/workflows/ci.yml`, expected: an addition of one job block and nothing
  else, confirmed by extracting the four existing job blocks from `git show b1e02da:.github/workflows/ci.yml`
  and comparing them case-sensitively against the same ranges of the edited file.
- Punctuation sweep over every file written, built on surrogate-pair ranges rather than `\u{...}`
  syntax and run against a positive control carrying all four forbidden forms, so it cannot pass
  vacuously (the trap recorded in `spec-1-5` finding 5 and `spec-1-9` finding 12).

**Manual checks:**
- Read the new job in `.github/workflows/ci.yml` and confirm by eye that it declares no `on:` of its
  own, carries no `continue-on-error` and no `if:`, and that the four existing jobs are untouched.
- Read the refusal message once as an operator would see it in a runner log, and confirm it names AD-1,
  names the path, and says what to do about it.

## Auto Run Result

Status: done

**What was implemented.** AD-1's contract boundary now has a gate of its own.
`.github/workflows/ci.yml` carries a fifth job, `contract-purity`, which runs
`node ops/contract-purity.mjs` on every push and every pull request to `main` by the file's existing
triggers, with no `continue-on-error`, no `|| true`, no `if:`, no `needs:` and no `on:` of its own.
The checker walks the published surface, refuses every file whose name matches AD-1's
`\.(ts|js|tsx|jsx|mjs|cjs)$` at any depth, and names AD-1, the rule verbatim, every offending path
and where a generator belongs instead. It installs nothing: it imports only `node:` builtins, the
way `deploy.yml` runs the Capacity Gate, so the boundary is still reported on a run where
`pnpm install --frozen-lockfile` fails. The statement at `AGENTS.md:64-66` that CI fails on an
executable file under `contracts/` was true of no gate before this story and is true now.

**Five refusals are stricter than AD-1's regular expression, and each is recorded with its reason.**
AD-1 fixes a lower bound, so a check may refuse more and never less, and the applied pattern is
built from the same extension list as the quoted one so the two cannot silently disagree. The
extension rule is applied case insensitively and to the Win32-served name, because a
case-insensitive checkout serves `probe.TS` as TypeScript and Win32 strips a trailing dot or space
from `probe.ts.`. `.mts` and `.cts` are refused, because both are TypeScript a runtime executes
directly and AD-1's list names neither. Any link under the surface or at its root is refused,
because a link named `data.css` pointing at a generator publishes executable code the extension rule
cannot see. A missing, unreadable or empty surface is refused, because the failure mode of a purity
gate is a green run over a tree nobody opened.

**Files changed.**

- `ops/contract-purity.mjs`: new. The checker. Zero dependencies, `node:` builtins only. Exports
  the rule, the surface and generator-home constants, `inspect`, `report` and `main`. Recursive
  walk, never follows a link, reports every offender sorted, escapes the C0 and C1 controls, the
  line separators, the bidirectional overrides, the code points drawn as nothing and the backslash
  itself so a crafted name can neither forge a log line nor be drawn as a different name. No
  environment variable and no argument selects the directory it opens, its invoked-directly guard
  fails closed when a path will not resolve, and a refusal records its exit code before it writes
  so a lost write callback cannot leave the process exiting 0.
- `.github/workflows/ci.yml`: one job added between `fonts-contract` and `rendered-output`. 35
  lines added, **0 removed**: the four existing jobs are byte-identical to `b1e02da`.
- `ops/__tests__/contract-purity.test.ts`: new. 61 cases inside the already-blocking `test` job:
  one per row of the I/O matrix against scratch trees under `tmpdir()`, one per refusal kind no
  matrix row names, the workflow wiring read off `ci.yml` as text, a positive control counting the
  committed surface with Node's own walk, and five subprocess cases that run the real binary,
  including the linked-root refusal through the entry point the job uses.
- `ops/contract-purity.md`: new record. What the gate checks and deliberately does not, the job's
  properties, the five stricter refusals with their reasons, the probe demonstration verbatim, the
  43-mutation table with the line-ending caveat on the method, thirteen stated limits and four
  Pending Operator actions.

**Verification performed**, all on 2026-08-25:

- `node ops/contract-purity.mjs`: exit 0, `contract purity: read contracts/, 9 files, none
  executable and no link (AD-1).`
- `corepack pnpm typecheck`: pass, with the new test file inside the program.
- `corepack pnpm test --run`: **492 passed, 22 files**, up from the 431 observed at `b1e02da`.
- Probe: `contracts/probe.ts` planted, the job's command run against it. Exit 1, the refusal naming
  AD-1 and `contracts/probe.ts`, quoted verbatim in the record and re-verified against the live
  output after this pass. It is byte-identical to what the first pass recorded, which is the point
  of splitting the closing advice on the finding rather than on the count. The same probe fails 9
  cases across 4 files out of 492, since the pinned published-file lists see it too, which is the
  two-independent-readers property working. Probe removed,
  `git status --porcelain --ignored=matching -- contracts/` empty.
- 43 mutations applied one at a time and restored, 42 caught on this host. The other one is the
  trailing separator that made a linked surface root resolve on POSIX: Windows cannot demonstrate
  it, so it was demonstrated in the pinned `mcr.microsoft.com/playwright:v1.62.1-noble` image,
  committed form refusing and mutated form passing, quoted in the record. The eleven mutations
  added by this pass were all caught, including the `every` to `some` rewrite that survived the
  second pass.
- `git diff --stat b1e02da -- contracts packages package.json pnpm-lock.yaml app public docker tests
  .lighthouserc.js .github/workflows/deploy.yml .github/workflows/lighthouse.yml`: empty.
  `.github/workflows/ci.yml` is unchanged from the commit under review; this pass touched only the
  checker, its test and its record.
- Punctuation sweep over every file written, on surrogate-pair ranges plus the literal ASCII
  double-dash form, against a positive control carrying an em-dash, an en-dash, a double-dash and
  an emoji. All four patterns fired on the control first, then swept clean. Every remaining
  double-dash is a CLI flag or a git pathspec separator inside inline code.

**Review findings.** Four review layers ran against the full diff (blind hunter, edge-case hunter,
verification-gap reviewer, intent-alignment auditor). Three passes now, none finding an intent gap
and none needing a spec repair.

- This pass: **9 patches applied**, 0 high, 1 medium, 8 low, itemised in the Review Triage Log
  above. The medium one is the class this epic keeps finding, a refusal that could not fire: the
  exit code lived only inside a write callback, so a refusal whose callback never ran exited 0.
  Five of the eight low ones are the same shape one level out, an assertion that could not fail:
  the closing-advice branch, the job-id pattern, the job-level `env:` claim, the `process.env`
  grep and the `uses:` steps were each held more narrowly than the record read.
- **0 deferred.** The two entries already in frontmatter `deferred`, the stale `bmad:context` block
  in `AGENTS.md` and the absent `permissions:` block in `ci.yml`, stand unchanged and unreopened.
- **16 rejected**, with their reasoning in the triage log.

**Follow-up review recommended: true.** Patched counts this pass are high 0, medium 1, low 8. The
score `3 x 1 + 1 x 8` is 11 against a threshold of 5.

**Residual risks.**

- **A red job holds no merge and no deploy on its own.** The job fails, and nothing mechanical
  follows until `contract-purity` is a required status check on `main`; `deploy.yml` fires on the
  same push with no `needs:`. That is true of all five jobs in the file. Pending Operator action 2.
- The job has never run on a GitHub runner. Everything recorded was observed by running its command
  locally, plus the one POSIX behaviour proved in the pinned container. Pending Operator action 1.
- The gate reads the committed tree. What Story 1.16 serves at `https://cuatro.dev/contracts/`, and
  the seven vendored copies, are outside it. Pending Operator action 3, and AD-16 for the copies.
- It is an extension rule by design, so a `.css` holding JavaScript, a file with no extension and
  two names colliding only in case all pass. Stated limits, with the reason AD-1 makes them the
  right answer.
- The workflow assertions live inside the `test` job, so narrowing that job would remove the thing
  that notices if the purity job is deleted. Same shape as `ops/__tests__/capacity-gate.test.ts`.
- Four properties are asserted by reading the module's own source rather than by running it: that
  no environment variable, no `node:process` import and no argv position beyond `[1]` is read, that
  no dependency is reached by any route, that the invoked-directly guard's fallback is a comparison
  and never a `false`, and that the exit code is recorded before the write rather than only inside
  its callback. Each is a property whose failing branch cannot be constructed portably on both a
  Windows authoring host and a Linux runner.
- Two refusals are exercised through an injected directory reader rather than a real filesystem,
  because an unlistable directory and a non-regular entry cannot be built on the Windows authoring
  host. The reader selects how a directory is listed and never which one, and `main()` passes none.
- The mutation method itself has a failure mode now recorded in `ops/contract-purity.md`: a
  string-replacement mutation whose anchor does not match the file's line endings replaces nothing
  and reports as survived. Three of this pass's eleven read as survivors before the anchors were
  corrected. A survivor is worth re-checking against the file before it is believed.

