---
title: 'list-wheel: a test job gates the deploy, and the Anchor''s deploy hardening mirrored'
type: 'bugfix'
created: '2026-09-24'
status: 'done'
baseline_commit: '47270538cccb67f75098c5f73930ee0bd2d3ff19'
review_loop_iteration: 0
context:
  - '{project-root}/ops/contract-serving.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-dw-94-deploy-hardening.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** Every push to `LuigiEspinosa/list-wheel`'s unprotected `main` rebuilds `wheel.cuatro.dev`
on the box with no test run (DW-90). Its deploy is the Anchor's pre-hardening shape: an unrestricted
key with passwordless sudo (DW-94), no concurrency, a reset to `origin/main`, no `paths-ignore` or
dispatch (DW-93), no failure report (DW-20), a mutable `ssh-action@v1` and no `permissions:` (DW-87).

**Approach:** Operator ruling 2026-09-24, one package, in a fresh clone of `list-wheel` `main`. Mirror
the Anchor's `deploy.yml` and `ops/deploy-remote.sh` as they stand at `4727053`, adapted to
`~/list-wheel` and `docker compose up --build -d --remove-orphans`; add a `test` job (checkout,
`setup-node` 22, `npm ci`, `npm test` in `ChromeHeadlessNoSandbox`) that `deploy` needs. Commit in the
clone, never push; record it in this repository.

## Boundaries & Constraints

**Always:** the deploy works with the key unrestricted and restricted, the first deploy included, whose
checkout (`00f5957`) has no script; the compose line and its flags unchanged (KV-1); every changed
behaviour has a test red on the baseline; the script proven with bash, a scratch repository and a stub
`docker`, never against the box; records dated UTC, citing "Operator ruling 2026-09-24"; no em-dash,
en-dash, double-dash standing in for a dash, or emoji.

**Ask First:** nothing gates this unattended run; open points are resolved under Design Notes.

**Never:** no push, pull request, deploy or box access; no dependency added to `list-wheel`; `npm test`
stays the Karma suite; no change to the Anchor's workflows, scripts or tests; no Epic 3 or 4 work;
GitHub's own actions stay on tags.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Green push | suite passes, gate open | `deploy` runs after `test`; `report` skipped | N/A |
| Red suite | a spec fails | `npm test` exits non-zero, `deploy` skipped, box untouched | `report` opens an issue |
| Bootstrap, forced, older commit, malformed, not on `main`, compose fails | the Anchor's six script rows, against `~/list-wheel` | as the Anchor's matrix | as the Anchor's |
| Dispatch off `main` | `workflow_dispatch` on another ref | `deploy`'s first step fails | `report` opens an issue |

</frozen-after-approval>

## Code Map

- `list-wheel` at `00f595709348f7684cabcb5b0c8e7830561c1754`: `.github/workflows/deploy.yml:1-71` (one
  job; gate by sparse checkout of the Anchor's `ops` at `main`, `:19-24`, `:43-44`; `ssh-action@v1`
  running `cd ~/list-wheel`, fetch, `reset --hard origin/main`, compose, `:60-71`); `karma.conf.js:25-31`
  (`ChromeHeadlessNoSandbox`); `package.json` `"test": "ng test --no-watch"`; `.dockerignore` (its rule:
  what the build never reads stays out); no `.gitattributes`, `core.autocrlf` true here.
- Remote, read 2026-09-24: public, issues on, `default_workflow_permissions: read`, `main` unprotected,
  branches `main` and `gh-pages`; last Deploy run `34776876533` at `00f5957`. `ssh-action` `v1` and
  `v1.2.5` = `0ff4204d59e8e51228ff73bce53f80d53301dee2` (`git ls-remote`), the Anchor's pin.
- Baseline suite: 145 of 145, exit 0, in the pinned Playwright image (Node 24, Chromium 151).
- Anchor sources: `.github/workflows/deploy.yml`, `ops/deploy-remote.sh`, harness
  `ops/__tests__/deploy-remote.test.ts:26-53,94-143`, readers `ops/__tests__/workflow-hardening.test.ts:28-52`.
  `deploy-remote.test.ts:84` takes the first `restrict,command=` in `ops/contract-serving.md` as the Anchor's.
- Records: `ops/contract-serving.md:515-522,542-600,682-683,699`; `ops/contract-adoption.md:267,273-278,775`;
  `ops/known-violations.md:97`; `ops/routing-inventory.md:1581`; ledger DW-20 `:1444`, DW-87 `:5066`,
  DW-90 `:5162`, DW-93 `:5269`, DW-94 `:5310`, DW-130 `:6749`; `epics.md:4300-4305` (Story 4.3).

## Tasks & Acceptance

**Execution:**
- [x] `list-wheel/ops/deploy-remote.test.mjs`: a `node:test` port of the Anchor's matrix plus the
  workflow's wiring, readers with planted controls; red on the baseline.
- [x] `list-wheel/ops/deploy-remote.sh`: the Anchor's script, adapted (DW-93, DW-94).
- [x] `list-wheel/.github/workflows/deploy.yml`: the `test` job, `needs: test`, the Anchor's
  hardening, a `report` job (DW-90, DW-93, DW-20, DW-87).
- [x] `list-wheel/.gitattributes`, `list-wheel/.dockerignore`: per Design Notes.
- [x] Records, ledger, `epics.md` Story 4.3: per Design Notes.

**Acceptance Criteria:**
- Given the baseline tree with only the new test file, when it runs, then every case holding a changed
  behaviour fails naming its rule; the two planted-reader controls and the gate-order case, which holds
  a rule the baseline already met, pass.
- Given the finished clone, when the test job's three commands run on Node 22 with a Chromium, then all
  pass; given a planted failing spec, `npm test` exits non-zero.
- Given this repository after the records, when typecheck, the full unit suite, the literal gate, the
  build and the unfiltered container e2e run, then all pass and no baseline moves.

## Spec Change Log

- **Review, 2026-09-24, loop 0.** No subagent could be spawned in this session, so the layers ran
  inline, as the Operator's authorisation of a sub-agent reviewer allows, beside one independent Codex
  pass (read-only, `gpt-5.6-terra`, the files pasted in). No intent gap and no bad-spec finding. Codex
  found the report job's `failure()` semantics, `issues: write` alone, the public checkout on
  `contents: read`, the bootstrap and forced paths and the node test's reach all sound; its one high
  item, the key unrestricted until action 9, is the ruling's design and is recorded. Patches: (1) action
  10 pushed the clone's `HEAD`, which is whatever it has checked out; it now pushes `origin/main` by
  name. (2) The first criterion said every case fails on the baseline, where three pass by design; the
  criterion now says which, and why. Deferred: DW-131, a forced call naming a pre-script commit on
  `main` deletes the file the key's line names (**Observed** in a container), in both scripts, so it
  waits for a change that edits both. Rejected: `persist-credentials` on the test job's checkout (a
  read-only token on a public repository), a job timeout (Karma's own timeouts end a hung browser),
  and live proof of the job graph before the push (none is possible; the push and action 10 give it).
  Ponytail: lean; the WSL harness stays because it is what lets the test run on the authoring host.
  Design layer: no UI surface in this diff. ECC verification loop: § Verification. KEEP: the report as
  its own job, the forced command read from the script's header, the line after the Anchor's own.

## Design Notes

1. **The failure report is a job**, `needs: [test, deploy]`, `if: failure()`, `issues: write` alone. A
   last step in `deploy` never runs on a red suite, since `deploy` is then skipped, and a red suite is a
   failed deploy the Operator must hear of (DW-20). It also keeps a write scope off the job running
   `npm ci`. Otherwise `deploy` is the Anchor's.
2. **`node --test ops/deploy-remote.test.mjs` is the test job's last step.** DW-90's closer names the
   deploy wiring test, Karma cannot reach a file or bash, and `node:test` is the standard library.
3. **`.gitattributes` `*.sh text eol=lf`**, the Anchor's rule: a CRLF checkout fails the script's test
   on Windows. `.dockerignore` gains `ops` and `.gitattributes`.
4. **The forced command is written in the script's header**, and the test reads it there. The
   Anchor's record copies it after the Anchor's own line (see Code Map).
5. **Records.** `contract-serving.md`: a list-wheel section, actions 9 (the line: edit, checks,
   rollback) and 10 (prove the report once, by a dispatch on a throwaway ref), an invalidation row,
   line 522 amended. Ledger: DW-90 and DW-93 done; DW-94 open until actions 7 and 9; dated notes on
   DW-20, DW-87, DW-130; DW-131 filed at review. `contract-adoption.md`: row re-observed, verdict yes
   from the push, the two dependent passages amended. KV-1's list-wheel citation, the
   routing-inventory key row and Story 4.3 get dated amendments.
6. **list-wheel commits in its own convention**, subject only: `30e5e8b` `feat(dw-90): ...` for the
   code, `50691bd` `docs(dw-90): ...` for its README line and a dated CHANGELOG entry. Not pushed; the
   verifier's one push redeploys `wheel.cuatro.dev` through the unrestricted path.

## Verification

**Commands:**
- `node --test ops/deploy-remote.test.mjs` in the clone (WSL bash on this host): exit 0.
- `node:22` container with Chromium: `npm ci && npm test && node --test ops/deploy-remote.test.mjs`: exit 0.
- `corepack pnpm typecheck`; `corepack pnpm test --run`; `node ops/literal-conformance.mjs`;
  `corepack pnpm build`; the pinned container `pnpm test:e2e`: all exit 0, no snapshot written.

**As run, 2026-09-24:**
- Scope: the spec runs past 1600 tokens (about 2,020 at the plan checkpoint); the split prompt was
  answered Keep, as the Operator ruled one package.
- Baseline Karma suite at `00f5957`, in the pinned Playwright image (Node 24.18.1, Chromium 151):
  145 of 145, exit 0.
- Red on the baseline (`00f5957` plus only the new test file, WSL bash on this host): 26 cases, 12
  failed each naming its rule, 11 cancelled because the matrix's hook could not build the origin
  (`cp: cannot stat '.../ops/deploy-remote.sh'`), 3 passed by design (the two planted-reader controls,
  and the gate-order case, a rule the baseline already met).
- Mutations against the finished files, each restored: a reset to `origin/main` failed the
  older-commit case; deleting the ancestor check failed both not-on-`main` cases; admitting upper case
  failed its case; deleting the script's fetch failed two cases and the string's fetch two more;
  deleting `needs: test` failed its case; deleting the report's `if: failure()` failed two.
- `node --test ops/deploy-remote.test.mjs` on this host through WSL bash at `50691bd`: 26 of 26, exit 0.
- `node:22` container (Node 22.23.3, Debian Chromium 153), the test job's three commands from the
  committed tree by `git clone`: `npm ci`; `npm test` 145 of 145, exit 0; `node --test` 26 of 26, exit
  0. A planted failing spec then made `npm test` exit 1 (1 FAILED, 145 SUCCESS).
- Real-history rehearsal in the same image: a checkout at `/home/deploy/list-wheel` cloned at `00f5957`
  took the unrestricted string to `50691bd` (`read from its argument`) and then the forced command
  (`read from SSH_ORIGINAL_COMMAND`), compose once each against a stub; `id` and an empty command were
  refused with exit 1. The same image showed DW-131: a forced call naming `00f5957` removed the script
  and the next call exited 127.
- actionlint 1.7.7 on the workflow: exit 0, no findings. shellcheck 0.10.0 on the script: exit 0.
- `docker build` of the clone: builds with `ops` and `.gitattributes` out of the context; `/srv` holds
  `index.html`, the three bundles and `favicon.ico`; the throwaway image was removed.
- `corepack pnpm typecheck`: exit 0. `node ops/literal-conformance.mjs`: exit 0.
  `corepack pnpm test --run`: 63 files, 1626 tests, all passed (76.65 s). After the review's patches,
  the nine suites that read the touched records: 336 passed.
- `corepack pnpm build`: exit 0. `node ops/asset-budget.mjs`: exit 0, narrative 619,351 gzipped, the
  last dated reading's figure; only Markdown changed here, so no reading is owed.
- The pinned container `pnpm test:e2e`, no filter, from PowerShell: 337 passed in 6.8 m, exit 0, no
  snapshot written, `git status` clean under `tests/`.
- Matrix audit: the six script rows are run by `ops/deploy-remote.test.mjs` against the real script;
  green and red push by its wiring cases with the two rehearsals (the suite passing, and a planted spec
  failing it); dispatch off `main` by its ref-refusal case. The job graph itself runs only on GitHub:
  the verifier's push is its first live run, and action 10 its first live failure.

## Suggested Review Order

The `list-wheel` stops link to GitHub at `30e5e8b8688f32c6529417a9d0a701d7a6aad4bd`, which resolves once
the verifier pushes that commit; before then, the same paths are in the clone under the scratchpad.

**The gate: a red suite stops the deploy (DW-90)**

- Entry point: the suite runs in its own job, and the deploy needs it.
  [`deploy.yml:32`](https://github.com/LuigiEspinosa/list-wheel/blob/30e5e8b8688f32c6529417a9d0a701d7a6aad4bd/.github/workflows/deploy.yml#L32)

- `needs: test`, the whole gate on an unprotected `main`.
  [`deploy.yml:47`](https://github.com/LuigiEspinosa/list-wheel/blob/30e5e8b8688f32c6529417a9d0a701d7a6aad4bd/.github/workflows/deploy.yml#L47)

- The deploy script's own cases run after Karma, on the standard library's runner.
  [`deploy.yml:44`](https://github.com/LuigiEspinosa/list-wheel/blob/30e5e8b8688f32c6529417a9d0a701d7a6aad4bd/.github/workflows/deploy.yml#L44)

**The box's side: the Anchor's script, two lines changed (DW-94, DW-93)**

- The target comes from the argument or the last word of `SSH_ORIGINAL_COMMAND`, nothing else.
  [`deploy-remote.sh:34`](https://github.com/LuigiEspinosa/list-wheel/blob/30e5e8b8688f32c6529417a9d0a701d7a6aad4bd/ops/deploy-remote.sh#L34)

- Full lowercase sha only, refused before any git or docker runs.
  [`deploy-remote.sh:40`](https://github.com/LuigiEspinosa/list-wheel/blob/30e5e8b8688f32c6529417a9d0a701d7a6aad4bd/ops/deploy-remote.sh#L40)

- Named-destination fetch, then the ancestry rule bounding a leaked key to `main` (see DW-131).
  [`deploy-remote.sh:45`](https://github.com/LuigiEspinosa/list-wheel/blob/30e5e8b8688f32c6529417a9d0a701d7a6aad4bd/ops/deploy-remote.sh#L45)

- Reset to the validated sha, not `origin/main`.
  [`deploy-remote.sh:52`](https://github.com/LuigiEspinosa/list-wheel/blob/30e5e8b8688f32c6529417a9d0a701d7a6aad4bd/ops/deploy-remote.sh#L52)

- list-wheel's compose line, unchanged from its old SSH step; KV-1 still applies.
  [`deploy-remote.sh:59`](https://github.com/LuigiEspinosa/list-wheel/blob/30e5e8b8688f32c6529417a9d0a701d7a6aad4bd/ops/deploy-remote.sh#L59)

**The workflow's side (DW-93, DW-20, DW-87)**

- The one string: bootstraps the script unrestricted, ends in the sha the forced script reads.
  [`deploy.yml:110`](https://github.com/LuigiEspinosa/list-wheel/blob/30e5e8b8688f32c6529417a9d0a701d7a6aad4bd/.github/workflows/deploy.yml#L110)

- Any ref but `main` fails before the box is touched.
  [`deploy.yml:52`](https://github.com/LuigiEspinosa/list-wheel/blob/30e5e8b8688f32c6529417a9d0a701d7a6aad4bd/.github/workflows/deploy.yml#L52)

- The report is a job, so a red suite that skips the deploy still opens an issue.
  [`deploy.yml:122`](https://github.com/LuigiEspinosa/list-wheel/blob/30e5e8b8688f32c6529417a9d0a701d7a6aad4bd/.github/workflows/deploy.yml#L122)

- One deploy at a time, nothing cancelled mid-flight.
  [`deploy.yml:24`](https://github.com/LuigiEspinosa/list-wheel/blob/30e5e8b8688f32c6529417a9d0a701d7a6aad4bd/.github/workflows/deploy.yml#L24)

- Read-only token at the top; Markdown-only pushes skip; the ssh action pinned by commit.
  [`deploy.yml:18`](https://github.com/LuigiEspinosa/list-wheel/blob/30e5e8b8688f32c6529417a9d0a701d7a6aad4bd/.github/workflows/deploy.yml#L18)
  [`deploy.yml:9`](https://github.com/LuigiEspinosa/list-wheel/blob/30e5e8b8688f32c6529417a9d0a701d7a6aad4bd/.github/workflows/deploy.yml#L9)
  [`deploy.yml:105`](https://github.com/LuigiEspinosa/list-wheel/blob/30e5e8b8688f32c6529417a9d0a701d7a6aad4bd/.github/workflows/deploy.yml#L105)

**What Luigi does on the box, and the records**

- The list-wheel mechanism, the string, the rehearsal and the added limits.
  [`contract-serving.md:606`](../../ops/contract-serving.md#L606)

- Action 9's exact edit, checks and rollback for `github-actions-deploy@list-wheel`.
  [`contract-serving.md:647`](../../ops/contract-serving.md#L647)

- Actions 9 and 10 in the table, and the invalidation row.
  [`contract-serving.md:779`](../../ops/contract-serving.md#L779)
  [`contract-serving.md:797`](../../ops/contract-serving.md#L797)

- DW-90 closed, DW-131 filed.
  [`deferred-work.md:5209`](deferred-work.md#L5209)
  [`deferred-work.md:6842`](deferred-work.md#L6842)

- The policy row, verdict yes from the push, fourth condition still unmet.
  [`contract-adoption.md:267`](../../ops/contract-adoption.md#L267)

**Tests**

- Scratch origin with stale snapshots, so both fetches are load-bearing.
  [`deploy-remote.test.mjs:228`](https://github.com/LuigiEspinosa/list-wheel/blob/30e5e8b8688f32c6529417a9d0a701d7a6aad4bd/ops/deploy-remote.test.mjs#L228)

- The forced command read from the script's header, run as sshd would.
  [`deploy-remote.test.mjs:175`](https://github.com/LuigiEspinosa/list-wheel/blob/30e5e8b8688f32c6529417a9d0a701d7a6aad4bd/ops/deploy-remote.test.mjs#L175)

- Wiring: the test job, `needs:`, the report job, token and pins.
  [`deploy-remote.test.mjs:361`](https://github.com/LuigiEspinosa/list-wheel/blob/30e5e8b8688f32c6529417a9d0a701d7a6aad4bd/ops/deploy-remote.test.mjs#L361)
  [`deploy-remote.test.mjs:394`](https://github.com/LuigiEspinosa/list-wheel/blob/30e5e8b8688f32c6529417a9d0a701d7a6aad4bd/ops/deploy-remote.test.mjs#L394)

- Readers refusing planted text, so no case passes over nothing.
  [`deploy-remote.test.mjs:420`](https://github.com/LuigiEspinosa/list-wheel/blob/30e5e8b8688f32c6529417a9d0a701d7a6aad4bd/ops/deploy-remote.test.mjs#L420)
