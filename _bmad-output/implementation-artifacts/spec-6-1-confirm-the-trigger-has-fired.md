---
title: 'Story 6.1: confirm whether the Epic 6 trigger has fired'
type: 'chore'
created: '2026-10-13'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
baseline_commit: '625377a0ebfcfab7b024f3531df344323f388cba'
context: []
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** Epic 6 (token distribution machinery) is earned, not scheduled: it opens only when three
contract releases after `v1.0.0` have actually been hand-propagated into at least one Satellite's
vendored `cuatro-contracts/` folder. Nobody has taken the count since the ledger was started.

**Approach:** Take the count from the evidence (the Anchor's `contracts/` history and tags, the Story 1-20
ledger in `ops/contract-adoption.md`, `ops/cs-tracker-token-adoption.md`, and `cs-tracker`'s vendored folder
history on its remote branches, read without touching its checkout), append it with each counted event
and the current value to the Story 1-20 record, and, below three, record that Epic 6 does not open.

</frozen-after-approval>

## Acceptance criteria

1. Given the trigger counts contract releases after `v1.0.0` hand-propagated into at least one Satellite's
   vendored folder, when the count is taken, then each counted event is recorded with its date, from and to
   version, and the Satellites re-vendored, and the count excludes anything present at `v1.0.0`, any
   documentation-only change and Story 1-20's unpublished rehearsal.
2. Given a counter kept only in memory is reconstructed wrongly, when the record is kept, then it is appended
   to the Story 1-20 record and states the count's current value explicitly.
3. Given the count is below three, when the story closes, then the record says Epic 6 does not open, 6-1
   carries that outcome, 6-2 to 6-4 stay backlog and `epic-6` is not opened, stated in a board comment.
4. Given the previous verifier's two minor findings, when this story starts, then its first commit addresses
   them alone.

## Implementation Notes

- No intent gap, nothing irreversible, three files: `route: oneshot`. `epic-6-context.md` compiled inline
  (no subagent tool in this session).
- The sprint sync's rule that a story going `in-progress` opens its epic was not applied: the story's own
  outcome is that `epic-6` is not opened, so it stays `backlog` and the board comment says why.
- The ledger already held event 1 (2026-09-24, 1.0.0 to 2.0.0, `cs-tracker`, `991d0f6`) and the count line
  at 1, pinned by `ops/__tests__/contract-adoption.test.ts` ("1 today"). The count did not move, so no row,
  count line or pin changed; the count taken is a `###` subsection inside § The propagation ledger, prose
  only, so `ledger()` still finds one count line and one `#` table.
- Registry releases are excluded by name: a Satellite fetches the Registry over HTTPS and never vendors it.
- Review layers: the Blind Hunter subagent and `verification-loop` were not run, because this session has no
  subagent tool; the independent verifier is the review layer for this change.

## What was done

- Commit 1, `58f75d09a49960f157be778afa20ba6530282283`: the previous verifier's minor findings. Finding 1:
  AD-11's 2026-10-13 sentence, 5.5's amendment and `ops/identity-issuer.md` § Sign-out now say the demo
  principal's own-session sign-out holds in `cs-tracker` once PR 9 is merged and rolled (DP10, not yet dated;
  PR 9 read `OPEN`, `mergedAt` null, head `e392689`). Finding 2: no change, the backticked token is the
  pattern searched for; both recorded under the item-50 spec's minor findings.
- Commit 2: `ops/contract-adoption.md` § The propagation ledger gains "The count taken by Story 6.1,
  2026-10-13": count 1 of 3, Epic 6 does not open, the one event, and the observations behind it
  (six non-Registry `contracts/` commits, five of them the content of `v1.0.0` before the first adoption on
  2026-08-27 and `40591cd` the 2.0.0 bump; no git tag; `cs-tracker` `origin/dev` and `origin/main` touch the
  folder twice, `3f37cce` the 1.0.0 adoption and `991d0f6` the 2.0.0 re-vendor, both reading
  `Contract v2.0.0`; a `gh api` tree sweep of the nine estate repositories finds the folder in `cs-tracker`
  alone; the Anchor's `apps/` vendor nothing). Board row `6-1` to `review` with the outcome comment;
  `epic-6` and 6-2 to 6-4 stay `backlog`. `epic-6-context.md` added.

## Tests run

- Suites that read the edited records, after commit 1: `corepack pnpm vitest run` on `identity-issuer`,
  `provider-swap`, `traefik-config`, `anchor-contract`, `tokens-contract` and `contract-adoption`:
  `Test Files  6 passed (6)`, `Tests  162 passed (162)`.
- Full root suite, `corepack pnpm test --run`, with commit 2's changes in the tree:
  `Test Files  7 failed | 73 passed (80)`, `Tests  7 failed | 1972 passed | 1 skipped (1980)`. The seven are
  exactly the WSL-bash suites (DW-135): `demo-reset`, `deploy-remote`, `library-backup`, `postgres-backup`,
  `postgres-init`, `tournament-backup`, `tracker-backup`, one case each. Re-run alone with
  `--no-file-parallelism`: `Test Files  7 passed (7)`, `Tests  180 passed | 1 skipped (181)`.
- Commit 1's added lines scanned with a `node` regex for an em-dash, en-dash, a spaced double hyphen or a
  pictograph: `added 7 hits 0`.

## Operator steps

None. Nothing in this story needs a box step, a setting, a ruling or a merge: the records reach `main` with
the next per-epic Anchor merge, which carries no deploy for Markdown alone. DP10 (cs-tracker PR 9) is already
a Pending row in `ops/demo-principal.md`, owned by the Epic 5 retrospective.

## Verification

**Independent verifier, round 1, 2026-10-13: pass with minor findings.** No builder context; every claim
re-read.

- Diff against `origin/dev` `625377a`: two commits, `58f75d0` and `6d6877f`, Markdown and YAML only, subject
  lines only. A `node` scan of the 200 added lines for an em-dash, an en-dash, a spaced double hyphen or a
  pictograph: 0 hits.
- AC 1: `git log` over `contracts/` without the two Registry files, on `HEAD` and `origin/main`, lists the same
  six commits; line 2 of `contracts/tokens.css` reads `Contract v1.0.0` at `95d8937`, `a485cb9`, `11a82bf`,
  `dd490c5` and `016613a`, and `Contract v2.0.0` at `40591cd`. No tag, local or on `origin`. `cs-tracker`'s
  `origin/dev` and `origin/main` touch `assets/css/cuatro-contracts/` in `3f37cce` (2026-08-27) and `991d0f6`
  (2026-09-24) only, both reading `Contract v2.0.0`. A `gh api` recursive tree sweep of sixteen of the
  Operator's repositories' default branches found the folder in `cs-tracker` alone; every `digital-library`
  remote branch holds none; the Anchor tracks no `cuatro-contracts` path. The count of 1 holds, and the
  exclusions are named.
- AC 2: appended inside § The propagation ledger of `ops/contract-adoption.md`, the count stated as 1 of 3; the
  count line, row 1 and the test pin agree.
- AC 3: the record says Epic 6 does not open; `epic-6` and 6-2 to 6-4 stay `backlog` with the board comment; 6-1
  set `done` by this verifier.
- AC 4: `58f75d0` addresses the previous verifier's findings alone; `cs-tracker` PR 9 read `OPEN`, `mergedAt`
  null, head `e392689`, matching DP10 in `ops/demo-principal.md`.
- Tests: `corepack pnpm vitest run` on `contract-adoption`, `identity-issuer`, `provider-swap`,
  `anchor-contract` and `tokens-contract`: `Test Files  5 passed (5)`, `Tests  128 passed (128)`. Full root
  suite, `corepack pnpm test --run`: `Test Files  7 failed | 73 passed (80)`,
  `Tests  18 failed | 1961 passed | 1 skipped (1980)`, the seven files being exactly the WSL-bash suites
  (DW-135); re-run alone with `--no-file-parallelism`: `Test Files  7 passed (7)`,
  `Tests  180 passed | 1 skipped (181)`. No `cs-tracker` or `digital-library` change, so no `mix precommit`
  and no PR.

Minor findings, not blocking:

1. The subsection says `cs-tracker` holds 10 `cuatro-contracts/` paths; its tree reads 11 entries (nine blobs,
   two trees). The count is unaffected.
2. The ledger's "How to append an event" paragraph still says to move the `0 today` pin; the pin reads
   `1 today` since event 1. Pre-existing, not from this story.

No PR is open from this story. Operator steps: none.
