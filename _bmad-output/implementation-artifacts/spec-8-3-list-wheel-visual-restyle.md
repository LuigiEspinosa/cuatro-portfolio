---
title: 'Story 8.3: list-wheel visual restyle (Angular, static build)'
type: 'feature'
created: '2026-10-13'
status: 'done'
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

**Independent verifier, round 1, 2026-10-13: pass with minor findings.**

**Open PR:** `list-wheel` [#4](https://github.com/LuigiEspinosa/list-wheel/pull/4), `restyle/8-3-visual-restyle`
into `main`, head `c665ee9`. It reports no checks: `gh pr checks 4` says none, and the check-runs and status APIs
on `c665ee9` count 0 and 0, because `deploy.yml`, the repository's only workflow, runs on a push to `main` and
on dispatch, never on a pull request. Merging it is the Operator's job and is the deploy (`ops/restyle-floor.md`
R6), as are the visual sign-off (R5) and the specification ruling (R7).

**Re-run by the verifier:** every diff read against its base (`list-wheel` `718f194...c665ee9`, the Anchor
`46c8b68...0360410`), templates included: the only template changes are the wheel's colour attributes becoming
classes and the three font links leaving `<head>`, so DOM order and every string are unchanged. Story 2.25 is on
`list-wheel` `main` (`00f5957`, PRs #2 and #3 merged 2026-09-13). The nine vendored files are blob-equal to
`contracts/` at `46c8b68` (Contract v2.0.0) by `git rev-parse` on both sides; `package.json` carries no component
framework, so family C holds. `list-wheel` on `c665ee9`: `npm test` 148 SUCCESS; `node --test
ops/deploy-remote.test.mjs` 27 pass, 0 fail; `npm run build` clean; the built CSS and bundle carry 0
`box-shadow`, 0 `gradient`, 0 `backdrop-filter`, and one accent ground, `::selection`. The production image,
built as `epic-scratch-8-3-verify:c665ee9`, served `/` 200 with no `googleapis`, `styles-W6ATMQFT.css` 200, and
the three woff2 200 `font/woff2` (58,992, 24,124, 11,284 bytes); container and image removed. Anchor root suite
`corepack pnpm test --run` in this worktree: 80 files, 74 passed; 1973 passed, 1 skipped, 6 failed, all six
DW-135 WSL-bash suites (`demo-reset`, `library-backup`, `postgres-backup`, `postgres-init`, `tournament-backup`,
`tracker-backup`), each passing alone: 30, 59, 20 (1 skipped), 17, 15 and 11.

**The floor, re-measured by the verifier's own script** (Playwright 1.62.1 driving the host's Chrome, against
the `c665ee9` production build served statically; screenshots and `report.json` in
`C:\CuatroEcosystem\epic-8-evidence\8-3-list-wheel-visual-restyle\verifier\`): nine states at 360 and 1280, 148
interactive readings (a checkbox read by its wrapping label). F-10: none under 44px on either axis, no two
adjacent boxes overlapping. F-4: no ground at rest, and on hover only the border colour changes (no ground,
shadow, transform, border width or label colour). F-5: radius 0 at rest everywhere; the textarea reads 2px only
while focused (minor finding 2). F-6: every keyboard stop in every state shows a 2px solid `--token-focus` ring at
a 3px offset, no stop transitions `outline` (the controls transition `border-color` alone), and a mouse click
paints none. F-1: the ground pixel reads `6,5,9`, equal to `--token-bg` drawn to a canvas. F-2: the three faces
`loaded` in `document.fonts`, the three woff2 200 from `media/`. F-3: the section hairline computes `1px solid`
`--token-border`. F-11: `color-scheme: dark`, `::selection` accent on `--token-bg`. F-12, at its four widths
and 360: no horizontal scroll in any state, and no § 2 row exists to compare, the reading the record states. F-9
read from the builder's masked greyscale renders: an enabled control tells from a disabled one by its border. AD-24 and AD-25 hold: nothing imported
beyond `cuatro-contracts/`, and `list-wheel` is a rendered, `Live` Registry entry.

**Minor findings, none blocking:**
1. The winner badge's border is `0.4px` in the wheel's own units, so it renders about 3px wide at 1280, a fourth
   stroke width beside § 3's three. Recorded as I-6 already; worth the Operator's eye under R5.
2. The editor textarea rounds to `--r-hair` while focused, because `:focus-visible`'s radius outranks the bare
   `textarea` selector, while the two find inputs (`input[type='text']`, higher specificity) stay square. § 4's
   ring radius and F-5 meet here; a candidate for R7.
3. The `copied` state never shows `Copied!`: copying removes the winner and the toast sits inside `@if (winner)`.
   Unchanged behaviour on `main`, outside this story, so the `copied` screenshots show no toast.
