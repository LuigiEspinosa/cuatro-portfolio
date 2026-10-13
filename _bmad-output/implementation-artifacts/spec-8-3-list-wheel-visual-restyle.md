---
title: 'Story 8.3: list-wheel visual restyle (Angular, static build)'
type: 'feature'
created: '2026-10-13'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '46c8b685ee53d64999d028cf6f340361f797e124'
context: []
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** `list-wheel` renders a Sentry-inspired theme of its own (filled, rounded, shadowed buttons,
a glass panel, Rubik from Google Fonts), has never adopted the token contract, and so reads as another
author's application beside the Hub.

**Approach:** Family C, as Story 8.1 verified (`ops/restyle-floor.md` § O-15). Adopt the contract as its
own commit (vendor `cuatro-contracts/`, the hand-fix lines), then restyle `/`, the one surface (§ O-14),
from `RESTYLE-SPEC.md` by reading it, recording every point that had to be inferred; measure the floor
once by hand (AD-19).

## Boundaries & Constraints

**Always:** presentation only: behaviour, routes, data, DOM order and every string unchanged; adoption
and restyle as two commits on one branch, after Story 2.25's verified relocation; failures recorded as
findings, inferred points sent back to the specification.

**Never:** an Anchor import beyond `cuatro-contracts/` (AD-24); a push, a PR, a merge, a Registry
release or a box step; a screenshot committed to a repository.

</frozen-after-approval>

## Code Map

- `list-wheel` `src/styles/cuatro-contracts/` (new): the nine token-contract files, blob-equal to `contracts/` at `46c8b68`
- `list-wheel` `angular.json`: build and test load the contract first; `src/styles/tokens.css` deleted
- `list-wheel` `src/styles.css`: hand-fixes 1 to 4 and the vocabulary (Control, Field, checkbox), once
- `list-wheel` `src/app/**/*.component.css`, `wheel-svg.component.html`: layout only; wheel colours to role classes
- `list-wheel` `src/index.html` (font links out), `Dockerfile` (comment), `CHANGELOG.md`
- `list-wheel` `src/app/restyle.spec.ts` (new): the floor read off the rendered page
- `ops/restyle-floor.md`: § `list-wheel` (record, floor, findings, I-1 to I-10), rows R5 to R7
- `deferred-work.md`: DW-345 (findings), DW-346 (spec defects), DW-347 (adoption record and Registry after merge)

## Tasks & Acceptance

**Execution:**
- [x] `list-wheel` `e7b7887`: adopt Contract 2.0.0 with hand-fix lines 1 to 5
- [x] `list-wheel` `c665ee9`: restyle to the vocabulary, delete the legacy tokens, add the restyle spec
- [x] Measure before and after (`epic-8-evidence/8-3-list-wheel-visual-restyle/`), record in `ops/restyle-floor.md`

**Acceptance Criteria (`epics.md` Story 8.3, in full there):**
- Given AD-20, when sequenced, then the restyle is a separate step after 2.25's verified relocation, and
  adoption, not done at relocation, lands as its own commit.
- Given O-15 verified family C, when the strategy is chosen, then it is family C's, not route 1 or 2.
- Given the cheapest application tests the specification, when implemented from `RESTYLE-SPEC.md`, then
  every inferred point is recorded as a specification defect and sent back.
- Given the floor, when complete, then F-1 to F-12 pass by § The floor's methods and the evidence goes to 8.4.

## Spec Change Log

## Design Notes

- **Split or Keep:** did not arise; about 1,225 tokens before § Verification (4,895 characters,
  measured, at 4 per token). Orchestrated builder, no human checkpoint; no open question: the two
  candidates (is adoption in scope; is the Registry declaration) are settled by `epics.md` Story 8.3
  ("adoption and restyle may ship together only if adoption has not already happened") and by the
  verification reading `main` (DW-347).
- **The vocabulary lives once, globally.** `ViewEncapsulation.Emulated` stops styles leaking out, not in;
  one global rule set beats a copy per component.

## Implementation Notes

- **Story 2.25 first:** merged to `list-wheel` `main` (`00f5957`, PR #3), board `done`; the Operator's
  checkout sits on `2-25-review-patches` and was not touched; this worktree branched from `origin/main`.
- **The record is `ops/restyle-floor.md` § `list-wheel`**: what changed, the before and after table, F-1 to
  F-12 each with its method, two findings, I-1 to I-10. Headline at 360x800 over nine states, 75
  interactive elements: under `--tap` 73 to 0, grounds 61 to 0, hover grounds 45 to 0, radii 65 to 0,
  ringless stops 3 to 0, horizontal scroll 2 to 0; F-7 0 shadows and 0 gradients in CSS and bundle.
- **Tests:** `npm test` 148 SUCCESS (145 before); the restyle spec failed on a planted filled, rounded
  Control (`1 FAILED, 147 SUCCESS`), then reverted; `node --test ops/deploy-remote.test.mjs` 27 pass; the
  production image built as `epic-scratch-8-3-list-wheel:c665ee9` served `/`, the CSS and three woff2 at
  200, then removed. Anchor root suite: in § Verification's builder line.

## Verification

**Builder's run (2026-10-13):** root suite `corepack pnpm test --run`: 80 files, 75 passed; 1974 tests
passed, 1 skipped, 5 failed in 109 s. The five are DW-135's WSL-bash suites failing with empty output
(`demo-reset`, `deploy-remote`, `library-backup`, `postgres-backup`, `tracker-backup`), and each passed alone:
30, 28, 59, 20 (1 skipped) and 11. `list-wheel` on `c665ee9`: `npm test` 148 SUCCESS, `node --test
ops/deploy-remote.test.mjs` 27 pass, `npm run build` clean.

**Independent verifier:** _to be filled by the verifier: verdict, what was re-run, findings._
