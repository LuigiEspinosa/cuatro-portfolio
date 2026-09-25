---
title: 'Deploy hardening: a forced-command deploy script, one deploy at a time to the pushed sha, an issue for a failed deploy, read-only tokens and SHA-pinned third-party actions'
type: 'bugfix'
created: '2026-09-24'
status: 'done'
baseline_commit: '62e0629b7d1cceef8cb9fab08f8fd2b8aa8bf7ab'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/ops/contract-serving.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** The Anchor's deploy key opens a shell with passwordless sudo on the box that serves
every hostname (DW-94). Two pushes can race one `git reset --hard origin/main`, a Markdown-only push
still compiles on the box, and a redeploy needs a commit (DW-93, `ops/known-violations.md` Pending
Operator row 2). A failed deploy reports to nobody (DW-20, Epic 1 retro action 7). Every workflow
runs on the repository's write-default token and both third-party actions ride mutable tags (DW-87).

**Approach:** Operator ruling 2026-09-24, one package. Today's SSH script moves into
`ops/deploy-remote.sh`, which accepts only a 40-character lowercase sha that is an ancestor of
`origin/main` after a fetch, read from its argument or from the last word of `SSH_ORIGINAL_COMMAND`.
The workflow sends one command string: an unrestricted login shell runs it to fetch `main` and run
the script out of the target commit, and the script run as a forced command parses it for its sha.
Around it: `concurrency: deploy` without cancellation, `paths-ignore: '**.md'`, `workflow_dispatch`
refused off `main`, a last `if: failure()` step running `gh issue create` (`issues: write` on that
job only), `permissions: contents: read` atop all four workflows, and full-SHA pins for
`appleboy/ssh-action` and `pnpm/action-setup`. The `authorized_keys` edit is Luigi's.

## Boundaries & Constraints

**Always:**

- The workflow deploys with the key unrestricted and restricted, including the first deploy after
  the merge, when the box's checkout has no script yet.
- The compose line and its flags stay as they are (`--build` is KV-1's, retired in Epic 3).
- Every changed behaviour has a test red on the baseline tree first; the script is proven with bash
  against a scratch git repository and a stub `docker`, never against the box.
- Records take the UTC date and cite "Operator ruling 2026-09-24"; a ledger entry closes with a dated
  paragraph naming the commit and one `status:`; an ops row keeps its place with its Completed cell
  dated; a planning document gets a dated amendment in its own style.
- No em-dash, en-dash, double-dash standing in for a dash, or emoji in anything written.

**Ask First:** nothing gates this run. It is unattended; open decisions are resolved from the
rulings and stated under Design Notes.

**Never:**

- No deploy, no push, no pull request, nothing on the box (this host has no SSH access to it).
- No change in `list-wheel`, `digital-library` or `cs-tracker`; no Epic 3 work; no new dependency;
  no `ci.yml` job added or renamed; GitHub's own actions stay on tags; `deploy`'s sudo untouched.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Bootstrap, first deploy | a login shell runs the workflow's string; checkout at a commit with no script; target is `main`'s tip | HEAD is the target, compose runs once in the checkout, exit 0, log says the sha came from the argument | N/A |
| Forced, tip | the record's forced command; `SSH_ORIGINAL_COMMAND` is the workflow's string | as above, log says `SSH_ORIGINAL_COMMAND` | N/A |
| Forced, older commit on `main` | target is an ancestor and `main` has moved on | HEAD is the target, not `origin/main` | N/A |
| Malformed | no command (interactive), `id`, upper case, short, `<sha>;id` | exit 1 before any git or docker, HEAD unmoved | `refused` on stderr |
| Not on `main` | a commit on another branch, or an unknown 40-hex | exit 1 after the fetch, HEAD unmoved, no compose | stderr names the sha |
| Compose fails | stub `docker` exits 1 | the SSH command exits non-zero, so the job fails | the issue step runs |
| Dispatch off `main` | `workflow_dispatch` on `dev` | the first step fails; only the issue step runs after it | issue opened |

</frozen-after-approval>

## Code Map

- `.github/workflows/deploy.yml:1-61`: `push: [main]` only; checkout, `setup-node`, the gate
  (`node ops/capacity-gate.mjs cuatro-portfolio`), then `appleboy/ssh-action@v1` running
  `set -euo pipefail; cd ~/cuatro-portfolio; git fetch origin main; git reset --hard origin/main;
  docker compose --env-file .env.production up --build -d --remove-orphans`. No permissions,
  concurrency or failure step.
- `ci.yml` `pnpm/action-setup@v6` at `:15,:43,:103,:249`; `lighthouse.yml:16`; neither declares
  permissions. `registry-verification.yml:18-22` says "no `permissions:`" in its header.
- Pins: `ops/__tests__/capacity-gate.test.ts:381-384` refuses any `if:` in `deploy.yml`, `:378` wants
  `ssh-action` after the gate; `ops/__tests__/registry-verification.test.ts:880-885` pins `on:`
  followed by `jobs:`, `:916` pins no `permissions`. The three `ci.yml` suites pin jobs, `on:` and no
  top-level `env:` only, so a top-level `permissions:` moves none of them.
- Harness to reuse: `ops/__tests__/library-backup.test.ts:43-65,110-140`: on Windows `bash` is WSL's
  (`/mnt/c` paths), the environment goes through a generated launcher. Prototype 2026-09-24: WSL git
  2.34.1 on the Windows temp path clones, fetches and reports `merge-base --is-ancestor` (128 for an
  unknown object) in 2.5 s.
- `appleboy/ssh-action` at `0ff4204d59e8e51228ff73bce53f80d53301dee2` (= `v1` = `v1.2.5`) runs
  `drone-ssh` 1.8.2, which sends `strings.TrimSpace(script)` as the exec request with no export lines
  while `envs` is unset (`plugin.go` `exec`, `scriptCommands`). `pnpm/action-setup` `v6` dereferences
  to `0977fd99725f1db4007ccb2928dbb4e90d06cc86` = `v6.0.10`. Both read with `git ls-remote`.
- Box facts: checkout `/home/deploy/cuatro-portfolio` over HTTPS; the key is ed25519, comment
  `github-actions-deploy@cuatro-portfolio`, private half only in `SSH_PRIVATE_KEY`
  (`ops/contract-serving.md:458-462`); `ops/*.sh` are LF (`.gitattributes`) and mode 100644, run
  with `bash`. `.dockerignore` keeps `*.md` but `README.md` out of the image.
- Repository, read 2026-09-24: public, issues on, `default_workflow_permissions: write`, `main`
  needs a pull request with admins included and no required check.
- Records: `ops/contract-serving.md:427-466` (the broken pipeline), `:532-548` (actions 1 to 6);
  `ops/known-violations.md:41-45`, KV-1 `:90-93,:126-133`, row 2 `:586`;
  `ops/routing-inventory.md:1580-1581,1589-1604`; `ops/contract-purity.md:395-410`. Ledger: the
  three Story 1-4 entries `:555-590`, DW-3 `:1135`, DW-20 `:1414`, DW-87 `:5024`, DW-93 `:5212`,
  DW-94 `:5241`, last id DW-129. `sprint-status.yaml:615-622`; `epics.md:4001-4012` (Story 3.4);
  `AGENTS.md:18,107-115` (managed block, precedent `201f7f2`).

## Tasks & Acceptance

**Execution:**
- [x] `ops/__tests__/deploy-remote.test.ts`: the matrix against the real script, and the deploy workflow's new wiring; red on the baseline.
- [x] `ops/__tests__/workflow-hardening.test.ts`: every workflow's top-level `contents: read`, the one widened job, third-party pins, with a planted control each; red on the baseline.
- [x] `ops/__tests__/capacity-gate.test.ts`, `ops/__tests__/registry-verification.test.ts`: the one `if:` allowed is the last step's `failure()`; the permissions block pinned where its absence was.
- [x] `ops/deploy-remote.sh`: the script.
- [x] `.github/workflows/deploy.yml`, `ci.yml`, `lighthouse.yml`, `registry-verification.yml`: per Intent.
- [x] Records, ledger, `sprint-status.yaml`, `epics.md` Story 3.4, `AGENTS.md`: per Design Notes.
- [x] Verify per § Verification.

**Acceptance Criteria:**
- Given the baseline tree, when the new and moved cases run, then each fails for the reason it names.
- Given the final tree, when typecheck, the full unit suite, the literal gate, the build and the
  unfiltered container e2e run, then all pass and no baseline moves.
- Given `ops/contract-serving.md`, when Luigi reads action 7, then it gives the exact
  `authorized_keys` edit, both verifications and the rollback, and action 8 proves the issue step.

## Spec Change Log

- **Review, 2026-09-24, loop 0.** No subagent could be spawned in this session, so the layers ran
  inline, as the Operator's authorisation of a sub-agent reviewer allows, beside one independent Codex
  pass (read-only, with the files pasted in, since its sandbox refused every file read). No intent gap
  and no bad-spec finding. Patches, each applied and re-run: (1) the permissions reader read only a
  block under a bare key, so a job's inline `permissions: write-all` passed as no block; it now reads
  inline values at any indentation, with a planted case. (2) The pin rule flagged a local `./` action;
  exempted, planted. (3) Codex: each scratch box was cloned after the origin held the target, so a
  script with no fetch passed; boxes now clone from snapshots whose `origin/main` is stale, and
  deleting either fetch fails two cases each. (4) Codex: the script's fetch names its destination,
  `main:refs/remotes/origin/main`, so the ancestor check never reads a tracking ref some fetch
  configuration left behind. (5) Codex: the operator steps count lines rather than list them, force
  the terminal with `-tt` before claiming the PTY refusal, check sshd's `AcceptEnv` and
  `PermitUserEnvironment` (a forced command governs the command a client asks for, not the
  environment it sends), and roll back by stripping the prefix, since a second run of the edit
  overwrites its backup; the edit and the rollback were dry-run on a sample file. (6) Two limits
  stated in the record: a dispatch on another ref replaces a run waiting on `main`, and nothing on the
  box serializes a deploy run by hand; action 8 waits until no Deploy run is queued. Rejected: a lock
  on the box (the ruling chose the workflow group); deduplicating the failure issue (each failed run
  is its own event). Filed: DW-130. Ponytail: lean. Design layer: no UI surface in this diff. ECC
  verification loop: § Verification. KEEP: the one command string, the last-word rule, the stale
  snapshots, the record's forced command read by the suite.

## Design Notes

1. **The Pending Operator actions go in `ops/contract-serving.md`.** It records the deploy path end
   to end (secret, key, `authorized_keys`, user, repair), `AGENTS.md` sends deploy diagnosis there,
   and it has the table; `ops/routing-inventory.md` has none and gets dated notes on its key rows.
2. **The command string** is `cd ~/cuatro-portfolio && git fetch origin main && s="$(git show
   SHA:ops/deploy-remote.sh)" && exec /bin/bash -c "$s" deploy-remote SHA`. A failed `git show`
   stops the chain (a pipe into `bash -s` would run nothing and exit 0), and nothing is written to
   the checkout before the script validates. The sha is the last word, the one thing the forced
   script reads. The script reaches its checkout by `$HOME`, since `$0` is `deploy-remote` there.
3. **The interactive check needs a key nobody holds**, so action 7 checks with a throwaway key given
   the identical options on the box, and the dispatch proves the deploy key's line: only the forced
   command logs "read from SSH_ORIGINAL_COMMAND".
4. **`list-wheel` is outside this package**, so DW-93 and DW-94 close their Anchor half and stay open
   on the other, as the ledger's 2026-09-13 half-closure did; DW-3 closes with DW-87.
5. **`main "$@"; exit` on one line** so a reset that replaces the file cannot feed bash new bytes.
6. A dispatch off `main` fails loudly rather than skipping, and the issue step reports it too.
7. **Records.** `ops/contract-serving.md`: a section on the forced-command deploy (the string, both
   modes, recovery from a broken script, Epic 3 edits the script), a dated note under "What is still
   owed", an invalidation row, actions 7 (edit, verify, roll back) and 8 (a dispatch on `dev` opens
   the issue). `ops/known-violations.md`: row 2 dated with the three dispositions, a dated line under
   `:41-45`, KV-1's moved citations amended in place. `ops/routing-inventory.md`: the two key rows
   and the mechanism row. `ops/contract-purity.md`: a dated section on the pins and the token.
   Ledger: DW-3, DW-20, DW-87 done; DW-93, DW-94 half-closed; the Story 1-4 concurrency entry done,
   placements done as tolerated, CI gating ruled and open until the merge's required checks; DW-130
   for the binary the pinned `ssh-action` downloads unpinned. `sprint-status.yaml` retro 7 done;
   `epics.md` Story 3.4 amended; `AGENTS.md` `:18` and `:107-115` corrected in place.

## Verification

**Commands:**
- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test --run`: every file passes, the new cases among them.
- `node ops/literal-conformance.mjs`: exit 0.
- `corepack pnpm build`: exit 0; no shipped byte moves, so no asset-budget reading is owed.
- The pinned container `pnpm test:e2e`, no filter: every case passes, no snapshot written.

**As run, 2026-09-24:**
- Scope: the spec runs past 1600 tokens; the split prompt was answered Keep, as the Operator ruled one
  package.
- Red on the baseline: the four suites, before any source change, 18 failed, 137 passed, 11 skipped,
  each failure naming its rule (no top-level block, `pnpm/action-setup@v6`, `appleboy/ssh-action@v1`,
  no `failure()` step, no concurrency, no `paths-ignore`, the `on:` pin, no script to copy).
- Mutations against the finished script, each restored: resetting to `origin/main` failed the
  older-commit case; deleting the ancestor check failed both not-on-`main` cases; admitting upper
  case failed its case; deleting the script's fetch, or the string's, failed two cases each.
- `corepack pnpm typecheck`: exit 0. `corepack pnpm test --run`: 63 files, 1626 tests, all passed.
  `node ops/literal-conformance.mjs`: exit 0. `node ops/contract-purity.mjs`: exit 0.
- `corepack pnpm build`: exit 0. `node ops/asset-budget.mjs`: exit 0, narrative 619,351 and non-3D
  231,829 gzipped, the figures of the last dated reading, so none is owed; no shipped source changed.
- The pinned container `pnpm test:e2e`, no filter, from PowerShell: 337 passed in 6.2 m, exit 0, no
  snapshot written, `git status` clean under `tests/`.
- Matrix audit: every row but the last is run by a case in `ops/__tests__/deploy-remote.test.ts`
  against the real script. "Dispatch off `main`" is GitHub's behaviour on the file's wiring, pinned by
  its two wiring cases, and proved live by `ops/contract-serving.md` Pending Operator action 8 after the
  merge, since a dispatch needs the workflow on `main`.
- After the review's tidying, the four touched suites again (167 passed) and `corepack pnpm typecheck`
  (exit 0); the whole suite once more on the committed tree, recorded in the package's report.

## Suggested Review Order

**The box's side: one script, two ways in**

- Entry point: the target comes from the argument or the last word of `SSH_ORIGINAL_COMMAND`, nothing else.
  [`deploy-remote.sh:30`](../../ops/deploy-remote.sh#L30)

- Full lowercase sha only, refused before any git or docker runs.
  [`deploy-remote.sh:38`](../../ops/deploy-remote.sh#L38)

- A named-destination fetch, then the ancestry rule that bounds a leaked key to commits on `main`.
  [`deploy-remote.sh:43`](../../ops/deploy-remote.sh#L43)

- Reset to the validated sha, not `origin/main` (DW-93); compose line unchanged.
  [`deploy-remote.sh:50`](../../ops/deploy-remote.sh#L50)

- One line, so a reset replacing this file cannot feed bash new bytes.
  [`deploy-remote.sh:61`](../../ops/deploy-remote.sh#L61)

**The workflow's side**

- The one string: bootstraps the script unrestricted, ends in the sha the forced script reads.
  [`deploy.yml:86`](../../.github/workflows/deploy.yml#L86)

- Markdown-only pushes skip; dispatch added.
  [`deploy.yml:3`](../../.github/workflows/deploy.yml#L3)

- One deploy at a time, nothing cancelled mid-flight.
  [`deploy.yml:23`](../../.github/workflows/deploy.yml#L23)

- Any ref but `main` fails first, before the box is touched.
  [`deploy.yml:37`](../../.github/workflows/deploy.yml#L37)

- The failure report, the file's only condition, with `issues: write` on this job alone.
  [`deploy.yml:95`](../../.github/workflows/deploy.yml#L95)

- Third-party action pinned by commit, tag in the comment.
  [`deploy.yml:81`](../../.github/workflows/deploy.yml#L81)

**Token and pins across the directory (DW-87)**

- Read-only token at the top of each workflow.
  [`ci.yml:11`](../../.github/workflows/ci.yml#L11)

- Same in Lighthouse and the Registry verification.
  [`lighthouse.yml:11`](../../.github/workflows/lighthouse.yml#L11)
  [`registry-verification.yml:37`](../../.github/workflows/registry-verification.yml#L37)

**What Luigi does on the box**

- The mechanism, the string, the line and the stated limits.
  [`contract-serving.md:471`](../../ops/contract-serving.md#L471)

- Action 7's exact edit, sshd environment check, both verifications, rollback.
  [`contract-serving.md:542`](../../ops/contract-serving.md#L542)

- Actions 7 and 8 in the table.
  [`contract-serving.md:682`](../../ops/contract-serving.md#L682)

**Tests**

- Scratch origin with stale snapshots, so both fetches are load-bearing.
  [`deploy-remote.test.ts:171`](../../ops/__tests__/deploy-remote.test.ts#L171)

- The record's forced command and the workflow's string, run exactly as the box runs them.
  [`deploy-remote.test.ts:155`](../../ops/__tests__/deploy-remote.test.ts#L155)

- Wiring pins for triggers, concurrency, the ref refusal and the issue step.
  [`deploy-remote.test.ts:290`](../../ops/__tests__/deploy-remote.test.ts#L290)

- Directory-wide permissions and pin rules, with planted controls.
  [`workflow-hardening.test.ts:30`](../../ops/__tests__/workflow-hardening.test.ts#L30)

- The capacity gate's no-condition rule, narrowed to the failure report.
  [`capacity-gate.test.ts:383`](../../ops/__tests__/capacity-gate.test.ts#L383)

- The Registry verification's permissions pin, absence turned into the exact block.
  [`registry-verification.test.ts:915`](../../ops/__tests__/registry-verification.test.ts#L915)
