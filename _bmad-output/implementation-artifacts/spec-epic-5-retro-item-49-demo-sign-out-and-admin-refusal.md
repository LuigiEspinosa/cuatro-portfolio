---
title: 'Epic 5 retro action 5 (M4, m13): demo sign-out scope and administrator refusal'
type: 'bugfix'
created: '2026-10-13'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
baseline_commit: 'efb0b7d'
context: []
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Every Visitor would share one demo subject. In `cs-tracker`, sign-out (`GET /auth/sign-out`, `DELETE /auth/sign_out`) and Back-Channel logout end every session of the subject, so one Visitor's sign-out would sign every Visitor out (retro M4). In `digital-library`, the principal is recognised two ways (`isDemoPrincipal` normalises the address, `demoUserId` and the reset match it exactly), and nothing checks at use that the demo account is not an administrator, so an `is_admin` set by hand would open the Operator's libraries and the admin routes to it (retro m13).

**Approach:** Before any Visitor gets the demo sign-in (DW-335, itself out of scope: no sign-in page, no move onto the issuer). In `cs-tracker`, a demo session carries a key of its own; its sign-out revokes that key and disconnects that session's sockets alone, and a logout token reaches a demo session only by its `sid`. The Owner's sign-out is unchanged (every session, FR-22). In `digital-library`, every lookup of the principal normalises the address the way `isDemoPrincipal` does, and an administrator demo account is refused where it is used: sign-in, every authenticated request, the ACL's admin bypass and the reset. Two worktrees from `origin/dev`, two PRs to `dev` left open for the Operator (ruling 2026-10-13).

</frozen-after-approval>

## Acceptance criteria

- Given demo access on in `cs-tracker` and two demo sessions open, when one signs out through either sign-out route, then that session is refused and its open socket closed, and the other session and its socket keep serving.
- Given the Owner signed in on two devices, when one signs out, then both are refused, as before.
- Given a valid logout token naming the demo subject, then it revokes only the demo session holding the token's `sid`, and none when it names no `sid`; a token naming only a `sid` still ends the session holding it, demo or Owner.
- Given `digital-library` with a user row whose email normalises to `demo@cuatro.dev` in another casing or with spaces, then the ACL and the reset treat it as the demo principal.
- Given a demo account with `is_admin` set, then sign-in answers 403 and mints no session, an existing session answers 403 on every authenticated route, the ACL never grants it the admin bypass, and the reset refuses with exit 1.
- Every merge and box step is a dated Pending row in `ops/demo-principal.md`; the record's participant sections describe the new behaviour.

## Implementation Notes

- A demo session's key, `oidc_ref`, is the issuer's `sid` when the ID token carries one, so a Back-Channel token naming that `sid` finds the session's socket topic without a lookup table; without a `sid` it is 18 random bytes. Revocation gains a third kind, `{:ref, ref}`, beside `sub` and `sid`.
- A logout token naming the demo subject and no `sid` ends no demo session: it cannot say which Visitor. Accepted, because the estate's issuer reports `backchannel_logout_supported` false (`ops/identity-issuer.md` S2), so this path is live only after a provider swap.
- A logout token naming only a `sid` now disconnects the Owner's topic and the one demo topic for that `sid`. Before, it disconnected every demo socket too.
- In `digital-library`, `demoAccounts` returns a list rather than an id: two hand-written rows that both normalise to the address are both the demo principal for the ACL, and the reset refuses them both.
- The m13 note on the reset's `PRAGMA journal_mode = WAL` was not changed. The action names only the one-way lookup and the administrator refusal. On the estate the API has already put the database in WAL, so the pragma writes nothing new, and `digital-library` is `off` in the schedule until DW-337.
- A demo account with `is_admin` set cannot reach `POST /auth/logout` either, because that route sits behind `requireAuth`. Its session can do nothing, and it lapses at expiry.
- Neither worktree's own working branch was touched. Both worktrees were first created one level too deep, inside each protected checkout (a relative path given with `git -C`). They were moved at once with `git worktree move` to the workspace folders, and the stray empty directory was removed. Neither checkout's files were touched: `cs-tracker` `main` stayed clean, and `digital-library` `dev` kept the Operator's own uncommitted edits.
- Review: the oneshot route's Blind Hunter layer needs a subagent, and this run has no subagent tool, so it did not run. The independent verifier is the review. The builder's own review found nothing to patch beyond the doc line in `cs-tracker`'s `docs/deployment.md`.

## What was done

- **First commit: the previous verifier's minor findings** (`efb0b7d`). In spec 48, § What was done now says `in-progress`. Its findings list gains the fourth finding and a disposition. The board row's action text reads 2026-05-29. DW-339 files the duplicate `Test` job. DL1's row says to remove the worktree `wt-remove-deploy-job` once PR #63 merges.
- **`cs-tracker`**: worktree `C:/CuatroEcosystem/cs-tracker-workspace/wt-demo-sign-out`, branch `fix/demo-sign-out-own-session` from `origin/dev` `7a2ab09`, commit `e3926898eed231956d329dd0e5dd058c0d0d1e5f`. The changes:
  - `CsTracker.Auth.OIDC.session_for/1` writes `oidc_ref`, and gives a demo session the topic `live_socket_id/2`. `signed_in?/1` checks the ref.
  - `Revocations` revokes and checks `:ref`.
  - `OIDCController.end_signed_in/1` is the one sign-out path for both routes. `AuthController.sign_out/2` calls it.
  - `backchannel_logout/2` treats the demo subject by `sid` only.
  - `docs/deployment.md`: two lines say the Owner.
  - Eight cases are added to `test/cs_tracker_web/controllers/oidc_controller_test.exs` § the demo principal's sign-out ends only its own session. One of them uses a real socket: another Visitor's sign-out leaves it serving, and its own sign-out closes it with the rejoin refused.
- **`digital-library`**: worktree `C:/CuatroEcosystem/digital-library-workspace/wt-demo-principal-one-way`, branch `fix/demo-principal-one-way` from `origin/dev` `4ad020d`, commit `1b14ff69116fd2e4dfaa91e95c9016dde7be51bc`. The changes:
  - `acl.ts`: one SQL predicate, `lower(trim(email)) = ?`, and `demoAccounts`. `hasAccess` and `getAllowedLibraryIds` never give the demo principal the admin bypass.
  - `middleware/auth.ts` `requireAuth` and `routes/auth.ts` login answer 403 for an admin demo account.
  - `demo-reset.ts` uses `demoAccounts` and refuses an admin account, or more than one account.
  - Cases are added: four in `demo-principal.test.ts`, and five in `demo-reset.test.ts` (four for the reset, one for the command).
- **Anchor**: in `ops/demo-principal.md`, § Each participant gains the sign-out bullet for `cs-tracker` and the one-way principal and refusal bullets for `digital-library`. Pending rows DP10 and DP11 are added, and the closing paragraph names action 5. `ops/identity-issuer.md` § Sign-out gets one sentence on the demo subject. The board row is set `in-progress`, with a dated comment.

## Tests run

- `cs-tracker`: a scratch `postgres:18.6` (`epic-scratch-pg-signout`) on `127.0.0.1:5432`. Results:
  - `mix test test/cs_tracker_web/controllers/oidc_controller_test.exs`: `78 tests, 0 failures`.
  - `mix precommit` at `e392689`: `717 tests, 0 failures (4 excluded)` (709 before, plus the 8 new cases). `format` changed nothing after the commit.
  - No image boot: nothing changes how it starts.
- `digital-library`: the host has Node 24 and the repository pins Node 22, so the suite ran in a `node:22-bookworm` container (`epic-scratch-dl-test`). The canvas build libraries were installed as `ci.yml` installs them. Results:
  - Before the change, the default thread pool segfaulted at teardown after the suites it reached had passed. The same happened after the change (the touched suites read demo-principal 17, demo-reset 18, auth 16, books.acl 3, all passed, then `SIGSEGV`).
  - `vitest run --pool=forks`: `Test Files 13 passed (13)`, `Tests 178 passed (178)`.
  - `pnpm typecheck`: api done, web `svelte-check found 0 errors and 0 warnings`.
  - CI runs `pnpm test -- --coverage` on GitHub's runner, which the verifier reads on the PR.
- Added lines in all three repositories were scanned for em-dash, en-dash, spaced double-dash and emoji: clean.
- Anchor: `corepack pnpm vitest --run ops/__tests__/demo-principal.test.ts` and the three suites that read the ledger (`hit-target-floor`, `hub-accessibility-pass`, `status-mark-axes`), after the first commit: 10 and 60 passed.
- Root suite `corepack pnpm test --run` with every Anchor change in the tree: `Test Files 2 failed | 78 passed (80)`, `Tests 2 failed | 1977 passed | 1 skipped (1980)`, 112.55 s. Both failures were WSL-bash suites. In `deploy-remote` it was "refuses a commit on another branch after the fetch". In `library-backup` it was "emits exactly one summary line", which got empty output (`expected [] to have a length of 1`): the DW-135 shape. Each file re-run alone passed: `deploy-remote` 28 of 28, `library-backup` 59 of 59.

## Operator steps (each a dated Pending row in `ops/demo-principal.md`)

- **DP10**: merge `cs-tracker`'s `fix/demo-sign-out-own-session` PR into `dev`, then `dev` into `main`. Then roll `cs-tracker` by the standing redeploy (`ops/cs-tracker-cutover.md` § Later rollouts). There is no new box step.
- **DP11**: merge `digital-library`'s `fix/demo-principal-one-way` PR into `dev`, then `dev` into `main`. Then redeploy by the README's standing redeploy (after DL1). There is no new box step.
- Bring the Anchor's record change to `main` with the Epic 5 retrospective merge (per epic). It is records only.

## Verification

Independent verifier, round 1, 2026-10-13: **pass with minor findings.**

- Read every diff against `origin/dev`: Anchor `efb0b7d` and `0cdea64`, `cs-tracker` `e392689`, `digital-library` `1b14ff6`. Each acceptance criterion is met in code and held by a case. Commit subjects are Conventional, with no body or trailer; added lines carry no em-dash, en-dash, dash-standing double-dash or emoji; no `.env` file is touched; no box step is added.
- `cs-tracker`: `mix precommit` on `e392689` against a scratch `postgres:18.6` (`epic-scratch-pg-verify-49`, removed): `717 tests, 0 failures (4 excluded)`, exit 0, and `format` left the tree clean. Start-up and migrations are unchanged, so no image boot. **Open PR: `cs-tracker` PR 9** (https://github.com/LuigiEspinosa/cs-tracker/pull/9), base `dev`, head `e392689`. No check runs on it: `cs-tracker` has no `.github/`.
- `digital-library`: in `node:22-bookworm` (`epic-scratch-dl-verify-49`, removed), from a `git archive` of `1b14ff6`: `pnpm test -- --pool=forks` gave `Test Files 32 passed (32)`, `Tests 544 passed (544)` (the root config runs both workspaces); `demo-principal` and `demo-reset` alone gave 35 of 35; `pnpm typecheck` gave api done and web `svelte-check found 0 errors and 0 warnings`. **Open PR: `digital-library` PR #64** (https://github.com/LuigiEspinosa/digital-library/pull/64), base `dev`, head `1b14ff6`. Workflows read on that sha: `CI` (push, run 38399200780) success and `CI` (pull_request, run 38399244504) success; `Test & Deploy` runs only for `main`.
- Anchor root suite `corepack pnpm test --run` with both commits in the tree: `Test Files 80 passed (80)`, `Tests 1979 passed | 1 skipped (1980)`, no WSL-bash failure this run.

Minor findings, not blocking:

1. `ops/demo-principal.md` had a blank line before DP10, which cut DP10 and DP11 out of the Pending table. Fixed by the verifier in the verification commit, which also names PR 9 and PR #64 in those rows.
2. `digital-library` is not quite one way for whitespace other than spaces: JavaScript's `trim()` and `toLowerCase()` (`isDemoPrincipal`) also strip tabs and newlines and fold non-ASCII, while SQLite's `trim()` and `lower()` do not. A row written by hand as `demo@cuatro.dev` followed by a tab is the principal for `requireAuth` and `UserRepository` but not for the ACL or the reset. An admin such row is still refused by `requireAuth`, so no bypass follows; a non-admin one would be an ordinary user outside the scope. Trimming tabs and newlines in the SQL predicate, or refusing such rows at write, would close it.
3. A demo session minted before this change carries no `oidc_ref`, so its sign-out revokes nothing beyond dropping its own cookie. Moot: every restart refuses older OIDC sessions, and the roll restarts the app.

Disposition (2026-10-13, the next story's first commit): finding 1 was fixed in the verification commit; finding 2 filed as DW-340, owned by the story that creates `digital-library`'s demo account (DW-337), before that account exists; finding 3 needs no change, since DP10's row already says every restart refuses older OIDC sessions and DP10's roll restarts the app. The verifier's separate note on Anchor `ci.yml` run 38399622554 (attempt 1 failed in the tracker's unit tests on gsap's `ScrollTrigger` calling `requestAnimationFrame` after teardown, attempt 2 passed) is filed as DW-341, to act on at a second occurrence.

Board row set `awaiting-operator`: DP10 (merge PR 9, then `dev` into `main`, then roll) and DP11 (merge PR #64, then `dev` into `main`, then redeploy after DL1) remain.

Live 2026-10-13: DP10 (`cs-tracker` `main` at `4d94dbc`, rolled at 15:26:41Z) and DP11 (`digital-library` `main` at `8d48846`, redeployed at 15:29:24Z) are dated in `ops/demo-principal.md`; board row set `done`.
