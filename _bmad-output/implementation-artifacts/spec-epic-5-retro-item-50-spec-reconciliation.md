---
title: 'Epic 5 retro action 6 (m14): spec reconciliation'
type: 'chore'
created: '2026-10-13'
status: 'in-review'
route: 'oneshot'
review_loop_iteration: 0
baseline_commit: '63c5a1fa'
context: []
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** The Epic 5 retrospective (§ C, finding m14) found the planning text behind the rulings: `epics.md`'s acceptance intents for 5.2 (client ids "derived mechanically", where AD-3 was narrowed 2026-10-03, DW-320), 5.3 (no `Domain=.cuatro.dev` cookie anywhere, where KV-10 tolerates the issuer's `__client_uat`), 5.5 ("RP-Initiated plus Back-Channel logout", where AD-11 was amended 2026-10-03 to per-application logout, DW-319) and 5.9 ("one story per participating application", "deletes by owner", where one story built all three resets to one definition that empties the scope), AD-13's "deletes by owner" in `ARCHITECTURE-SPINE.md`, and two passages of `ops/identity-issuer.md` (§ cs-tracker's sign-in and § cs-tracker's Steam sign-in) that still describe `cs-tracker`'s Steam sign-in as present after PS2 deleted it on 2026-10-06.

**Approach:** Documentation only. Amend each intent and AD-13 in place in the repository's own convention (an inline dated `amended` note keeping what the text read), and correct the two Steam passages to the code on `cs-tracker` `main` (`7adfab1`, PR #3, `e4c6103`). No code, no box, no Registry change.

## Acceptance criteria

- AC1: Given `epics.md` § Epic 5, when 5.2, 5.3, 5.5 and 5.9 are read, then each states what was built and ruled, names the ruling or record, and keeps the replaced wording in its amended note.
- AC2: Given AD-13, when it is read, then a dated amendment says the reset empties the participant's demo scope, addressed by an explicit key, and why that is deleting by owner.
- AC3: Given `ops/identity-issuer.md`, when § cs-tracker's sign-in and § cs-tracker's Steam sign-in are read, then neither describes Steam sign-in code as present or as the unconfigured fallback, and both name PS2.
- AC4: Given the root suite, when it runs, then it passes (the records are read by `ops/__tests__/identity-issuer.test.ts` and `registry-verification`).

</frozen-after-approval>

## Implementation Notes

- First commit `e6ca552` (the previous verifier's minor findings, spec item 49): DW-340 (`digital-library` whitespace normalisation, owned by DW-337's story, before its account exists), DW-341 (the tracker's gsap `ScrollTrigger` teardown flake, CI run 38399622554 attempt 1, act at a second occurrence), and a disposition paragraph in item 49's § Verification; finding 3 needs no change (DP10 already says every restart refuses older OIDC sessions).
- Decision: 5.5's amendment also names the demo principal's sign-out (Epic 5 retrospective action 5, `ops/identity-issuer.md` § Sign-out), and AD-11 takes one dated sentence for the same, since AD-11's 2026-10-03 amendment says "every session of the subject" and action 5 narrowed that for the shared demo subject. Without it the reconciliation would write a new drift between the epic and AD-11. The verifier may refuse it as scope; it is one bullet.

## What was done

- `_bmad-output/planning-artifacts/epics.md` § Epic 5: 5.2 (Name and credential variables derived, Client ID assigned by the issuer, DW-320), 5.3 (KV-10 named as the one `.cuatro.dev` cookie), 5.5 (per-application logout, DW-319, and the demo principal's own-session sign-out), 5.9 (reset defined once and implemented per participant by one story, "empties its demo scope", DR3 on DW-337), each with an inline `*(amended 2026-10-13 ...)*` note keeping the replaced wording, the file's existing convention.
- `ARCHITECTURE-SPINE.md`: AD-13 takes an "Amended 2026-10-13" bullet (deletes by owner reads as emptying the scope by explicit key, per `ops/demo-principal.md` § The reset items 1 and 2); AD-11 takes one for the demo sign-out (see the decision above).
- `ops/identity-issuer.md` § cs-tracker's sign-in: Steam no longer "stays beside it"; `STEAM_ID` names the inventory only; the unconfigured state is "cannot be signed into", matching `cs-tracker` `docs/deployment.md` at `f5974b8`. § cs-tracker's Steam sign-in: "What remains is a ruling" replaced by what PS2's deletion (`7adfab1`, PR #3, `e4c6103`) removed and its consequence. Run tables and dated rows left as written: they record what was observed then.
- Board row `epic-5-retro-item-50-...` set `in-progress`, awaiting the verifier.

Review layers: the Blind Hunter subagent was not run, because this unattended builder has no subagent tool; the independent verifier is the review. Self-review of the diff: every new statement traced to its source (AD-3 and AD-11 amendments, KV-10, the retro § C, `ops/demo-principal.md` § The reset, `cs-tracker` `7adfab1` and `f5974b8` read with `git show`, read only, in the Operator's checkout without touching its tree).

## Tests run

- Added lines and this spec scanned for an em-dash, en-dash, ` -- ` or emoji with a `node` regex: `hits 0`.
- `corepack pnpm test --run` (2026-10-13, both commits' changes in the tree): `Test Files  80 passed (80)`, `Tests  1979 passed | 1 skipped (1980)`, exit 0, no WSL-bash suite failed.

## Operator steps

None. Documentation only: no box step, no setting, no other repository. These records reach `main` with the Epic 5 retrospective's per-epic merge, which the Operator already holds.

## Verification

_Filled by the independent verifier._
