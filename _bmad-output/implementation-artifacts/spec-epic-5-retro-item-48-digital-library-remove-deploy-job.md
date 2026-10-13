---
title: 'Epic 5 retro action 4 (M5): remove digital-library Test & Deploy deploy job'
type: 'chore'
created: '2026-10-13'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
baseline_commit: '9e998376dc39fd56495e310eff61d43247707a22'
context: []
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `digital-library`'s `Test & Deploy` workflow has a `deploy` job that SSHes into a VPS; it fails on every push to `main` (retro M5 says since 2026-07-30), the box is redeployed by hand instead, and DP7's record in `ops/demo-principal.md` says only "merged on green CI".

**Approach:** **Operator ruling, 2026-10-12: REMOVE the deploy job, do not repair it.** In a `digital-library` worktree from `origin/dev`, delete the `deploy` job and keep the `test` job intact, renaming the workflow if its name would now lie; check whether any ruleset requires the job's check. Correct DP7's line to name the red job, the removal and the by-hand redeploy, and write the by-hand redeploy into `digital-library`'s standing redeploy runbook. PR to `digital-library` `dev`, left open for the Operator.

</frozen-after-approval>

## Acceptance criteria

- Given `.github/workflows/` on the branch, when read, then no job SSHes anywhere, the former workflow's `test` job is byte for byte as before, and its name no longer says Deploy.
- Given the repository's rulesets and branch protection, when read, then either no rule requires the `deploy` check, or that rule is an Operator step.
- Given `ops/demo-principal.md`, when DP7 is read (By hand step 7, its run entry, its Pending row), then it names the red `deploy` job with its run, the removal by ruling, and the by-hand redeploy.
- Given `digital-library`'s README, when read, then it holds the standing by-hand redeploy, and nothing there still describes the Actions deploy secrets as required.
- Every GitHub setting, merge or box step is a dated Pending row in `ops/demo-principal.md`.

## What was done

- **First commit, the previous verifier's minor findings** (`143002554cfb03223decb31eb9af95f3397f16f8`, `ops/demo-principal.md`): By hand step 18 (DS5) says the first run prints `issue=open` if a real failure after DS4 already opened an issue; § The scheduler item 11 says every exit 1, `lock=held` included, opens the issue; item 8 notes a participant's stdout is printed after it ends, so its `demo:reset` line follows its stderr in the log (cosmetic, no code change).
- **`digital-library`**, worktree `C:/CuatroEcosystem/digital-library-workspace/wt-remove-deploy-job`, branch `chore/remove-deploy-job` from `origin/dev` `4ad020d`, commit `c05434f4153d37487e1901339514c92f9d7c5edd`: `.github/workflows/deploy.yml` renamed `test.yml`, `name: Test & Deploy` to `name: Test`, the `deploy` job deleted, the `test` job and triggers unchanged. README's "Required Secrets (GitHub Actions)" section replaced by "Deploying to library.cuatro.dev", the standing redeploy (fetch, `reset --hard origin/main`, `docker compose up -d --build`, checks, never `git clean`, rollback). One CHANGELOG line under Unreleased, Removed.
- **Anchor** `ops/demo-principal.md`: By hand step 7 names the by-hand redeploy and the ruling, and its build citation corrected from DW-308 (`list-wheel`) to DW-185; the DP7 run entry corrected; the DP7 Pending row says "deployed by hand"; Pending rows DL1 to DL3 added; the closing paragraph says action 4 is live when DL1 is dated.
- Board row `epic-5-retro-item-48-...` set `in-review` with the ruling dated.

Observations behind the record (2026-10-13, `gh`):
- `gh run list --workflow deploy.yml --branch main`: every `main` run since 2026-05-29 failed in `deploy` with `test` passing (26623693302, 28205172235, 30518341072, 30519309818, 37498770241); the last green was 22458358977 on 2026-02-26. So it was red before 2026-07-30, the retro's date. Run 37498770241's failed log: `ssh: handshake failed: ssh: unable to authenticate`.
- `gh api .../rulesets`: one ruleset, `protect-main`; `rules/branches/main` lists only `deletion` and `non_fast_forward`; `rules/branches/dev` is empty; classic protection answers 404 on both. **No rule requires the `deploy` check**, so no Operator step for it.
- `gh secret list`: `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`, `SERVER_PORT`, read by nothing after this change (DL2).

## Design notes

- The workflow file is renamed with its name: a `deploy.yml` holding only a test job would lie as much as the name. GitHub lists `Test` as a new workflow; the old runs stay under `Test & Deploy`. No required check names it.
- The redeploy runbook lives in `digital-library`'s README because that repository has no `docs/` and the README was the only place describing deployment (and it described the Actions secrets). The box script's text is recorded nowhere, so the README writes the steps the records observed (DW-185, DW-187) and DL3 compares them with the script at the next redeploy. Not rehearsed: writing it touches nothing, and running it is a box step.
- The `test` job duplicates `CI`'s; kept, as the ruling says to keep it intact.

## Tests run

- `corepack pnpm vitest --run ops/__tests__/demo-principal.test.ts ops/__tests__/demo-reset.test.ts` after the first commit: `Test Files 2 passed (2)`, `Tests 40 passed (40)`.
- `digital-library`: `npx js-yaml@4.1.0 .github/workflows/test.yml` parses; no code changed, so its suite was not run (the worktree has no `node_modules`); its `test` job is textually unchanged.
- Added lines in both repositories scanned for em-dash, en-dash, spaced double-dash and emoji: clean.
- Root suite `corepack pnpm test --run` with every Anchor change in the tree: `Test Files 80 passed (80)`, `Tests 1979 passed | 1 skipped (1980)`, 112 s; no WSL-bash suite failed.
- Review: the oneshot route's Blind Hunter layer needs a subagent and this run has no subagent tool, so it did not run; the independent verifier is the review. Builder self-review only: the rollback line and `docker compose up -d --build` (no `--env-file`, compose reads the checkout's `.env`) match the recorded box layout; nothing found to patch.

## Operator steps (each a dated Pending row in `ops/demo-principal.md`)

- **DL1**: merge `digital-library`'s `chore/remove-deploy-job` PR into `dev`, then `dev` into `main`.
- **DL2**: after DL1 reaches `main`, delete the four Actions secrets.
- **DL3**: at the next redeploy, compare `~/library-redeploy.sh` with the README's standing redeploy.

## Verification

**Independent verifier (2026-10-13, round 1): pass with minor findings.** A separate session with no builder context read `1430025` and `d32e26a` against the Anchor's `origin/dev` and `c05434f` against `digital-library`'s `origin/dev`, checked the observations with `gh`, and re-ran every stage on this host:
- `gh run list --workflow deploy.yml --branch main` on `digital-library`: runs 37498770241, 30519309818, 30518341072, 28205172235 and 26623693302 each read `test=success deploy=failure`, the oldest 2026-05-29; 22458358977 (2026-02-26) was the last success. Run 37498770241's failed log: `ssh: handshake failed: ssh: unable to authenticate`.
- `gh api`: one ruleset, `protect-main` (active); `rules/branches/main` lists `deletion` and `non_fast_forward` alone, `rules/branches/dev` is empty, classic protection answers 404 on both. No rule requires the `deploy` check, so no Operator step for it.
- The diff: `.github/workflows/test.yml` keeps the triggers and the `test` job byte for byte, the `deploy` job is gone, and no workflow left SSHes anywhere; the README's standing redeploy matches DW-185, DW-187 and DW-338 and the checkout path `ops/routing-inventory.md` records. No dash or emoji in the added lines of either repository; all three commit subjects are Conventional Commit subjects alone; no `.env` file touched; no box step taken.
- Root suite `corepack pnpm test --run`: first run `Test Files 7 failed | 73 passed (80)`, `Tests 13 failed | 1966 passed | 1 skipped (1980)`, every failure a roughly 30 second case in the seven WSL-bash suites (DW-135). Each re-run alone passed: deploy-remote 28, library-backup 59, tracker-backup 11, postgres-backup 20 (1 skipped), postgres-init 17, tournament-backup 15, demo-reset 30. A later full run: `Test Files 80 passed (80)`, `Tests 1979 passed | 1 skipped (1980)`.
- `digital-library` PR #63 (`chore/remove-deploy-job` into `dev`, head `c05434f`), opened by the verifier and **left open for the Operator** (DL1). Every workflow run on `c05434f`: `CI` (push, run 38391849677) success and `CI` (pull_request, run 38391856226) success. `Test` triggers only on `main`, so it does not run on a PR to `dev`.

Minor findings, not blocking:
1. § What was done says the board row was set `in-review`; the builder set it `in-progress`, as the board's legend has no `in-review`.
2. The `Test` workflow's job duplicates `CI`'s `test` job on every push to `main`; kept as the ruling asked, a candidate for removal later.
3. The board row's action text still says "red since 2026-07-30"; the runs show 2026-05-29, which the record and this spec carry.
