---
title: 'Story 8.6: cs-tournament visual restyle (apps/tournament in the Anchor)'
type: 'feature'
created: '2026-10-17'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'fac9e40f2dc713e187e313bdf5e1d0095432ca99'
context: []
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** the tournament renders its own 2026 theme (filled, rounded, shadowed cards and pills, green and red
scores, Archivo from Google), has never adopted the token contract, and reads as another product beside the Hub.

**Approach:** verify what it has installed (family C), enumerate the floor by route (strict: every viewer route and the
404), adopt the contract as a non-Tailwind consumer inside the Anchor, restyle every surface from `RESTYLE-SPEC.md`
1.1.0, record what had to be inferred, and measure the floor once by hand (AD-19).

## Boundaries & Constraints

**Always:** presentation only: behaviour, routes, data, DOM order and every string unchanged; one merge of its own
after Story 3.7's verified merge; findings recorded, not corrected; inferred points sent back to the specification.

**Never:** an Anchor import beyond `contracts/` (AD-24), a shared component package, a push, a PR, a merge, a Registry
release or a box step; a screenshot committed.

</frozen-after-approval>

## Code Map

- `apps/tournament/app/globals.css`: imports `contracts/tokens.css` then `fonts.css`; hand-fix lines 1 to 4
- `apps/tournament/app/layout.tsx`: `next/font` Archivo removed
- `apps/tournament/app/(viewer)/**/*.module.css`: every stylesheet rewritten to roles and scale steps
- `apps/tournament/app/not-found.tsx`, `not-found.module.css` (new): the built-in 404's words on the contract ground
- `apps/tournament/Dockerfile`: the builder copies `contracts/` after the prune
- `apps/tournament/lib/restyle-floor.test.ts` (new); `lib/ceremony/reduced-motion.test.ts`: presentation pins moved
- `ops/literal-conformance.mjs` and its suite, `ops/__tests__/accent-fill.test.ts`,
  `apps/hub/app/__tests__/anchor-contract.test.ts`, `docker/__tests__/tournament-image.test.ts`: the tournament read
- `ops/restyle-floor.md` § `cs-tournament`, rows R21 to R24; `ops/literal-conformance.md`; `AGENTS.md`;
  `deferred-work.md` (DW-279 closed, DW-360, DW-361)

## Tasks & Acceptance

**Execution:**
- [x] Verify family and floor; seed a scratch Supabase; measure before (`epic-8-evidence/8-6-.../before/`)
- [x] Adopt the contract, restyle, retire the `OTHER_APPLICATIONS` entry; build and boot the image
- [x] Measure after; record in `ops/restyle-floor.md`; tests and the root suite

**Acceptance Criteria (`epics.md` Story 8.6, in full there):**
- Given AD-20, when sequenced, then the restyle opens after Story 3.7's merge has shipped and been verified (the
  Vercel exit needed no merge, amendment of 2026-09-25) and lands as its own merge.
- Given an unverified family, when the story opens, then what is installed is verified first, the strategy chosen on
  it, and the surfaces inside the floor enumerated by route before the work.
- Given AD-2 and AD-24, when implemented, then no shared React component package is created.
- Given the floor and the ceiling, when complete, then F-1 to F-12 pass by their methods, AD-19's manual pass is run and
  recorded, and the results are added to Story 8.4's record.

## Spec Change Log

## Design Notes

- **Split or Keep:** did not arise; about 1,260 tokens before § Verification (5,032 characters, measured, at 4 per token).
  Orchestrated builder, no human checkpoint; no open question survived investigation.
- **No `cuatro-contracts/` folder.** The task's AD-24 wording names a vendored folder, which is the Satellite's form;
  inside the Anchor a vendored folder fails `anchor-contract.test.ts` and DW-279 named the plain pair from `contracts/`.
- **Epic context compiled from the raw documents**, not cached: no `epic-8-context.md` exists and this builder may not
  write one into the main checkout; `epics.md` § Epic 8, `RESTYLE-SPEC.md` and `ops/restyle-floor.md` were read whole.
- **Parallel with Story 8.5:** both edit `OTHER_APPLICATIONS`, its pins and `ops/restyle-floor.md`, so the verifier's
  `git pull --rebase` may meet a conflict there; keep both sides.

## Implementation Notes

- **Headline** (360x800, nineteen states, 161 interactive readings): under `--tap` 24 to 0, grounds 21 to 0, hover
  grounds 21 to 0, ringless stops 161 to 0, shadowed elements 11 to 0, radii 470 to 10 (the round wheel, I-12); F-7
  0 shadows and 0 gradients built; SM-12's four manual checks all clean.
- **Findings** 1 to 5 and **inferences** I-12 to I-14: `ops/restyle-floor.md` § `cs-tournament`.
- **Tests:** tournament `typecheck` clean, `test` 1980 passed in 57 files before the new suite, then 1988 in 58;
  `restyle-floor.test.ts` failed 2 of 8 on a planted rounded accent ground, then passed reverted;
  `node ops/literal-conformance.mjs` reads 35 stylesheets, no literal. The image built and served (§ The image).

## Verification

**Builder's run (2026-10-17), on the branch rebased onto `origin/dev` `dea2f03`:** root suite `corepack pnpm test
--run`: 80 files, 79 passed; 1980 tests passed, 1 skipped, 1 failed in 101 s. The one is DW-135's WSL-bash
`postgres-backup` failing a case with empty output; alone it passed, 20 passed and 1 skipped. An earlier full run the
same morning failed all seven WSL-bash suites the same way, each passing alone (30, 28, 59, 20 and 1 skipped, 17, 15,
11). Tournament: `typecheck` clean, `test` 58 files, 1988 passed. `node ops/literal-conformance.mjs`: 35 stylesheets
read, no literal outside the permitted set.

**Independent verifier (2026-10-17, round 1): pass, with minor findings.** No PR is opened: the work lives in the
Anchor alone and is pushed to `dev` by the verifier; every promotion to `main` and the tournament's roll are the
Operator's (R23). Read without the builder's context:

- **Diff read against `origin/dev` `dea2f03`, templates included.** The only template changes are `app/layout.tsx`
  (the `next/font` class gone from `<html>`), a comment in `LivePill.tsx` and the new `app/not-found.tsx`, which
  renders Next's built-in title, `404` and `This page could not be found.` in the built-in order. Every `styles.*`
  name the templates use is still defined in its module, so DOM order, routes, data and microcopy are unchanged. No
  `packages/` change, no shared component package, nothing imported from the Anchor beyond `contracts/`. No old
  palette variable is left referenced. No em-dash, en-dash, double-dash or emoji in an added line.
- **Tests, re-run in this worktree.** Tournament `typecheck` clean; `test` 58 files, 1988 passed. Root suite
  `corepack pnpm test --run`: 80 files, 74 passed; 1975 passed, 1 skipped, 6 failed, all six the WSL-bash suites of
  DW-135 (`demo-reset`, `deploy-remote`, `library-backup`, `postgres-backup`, `tournament-backup`, `tracker-backup`);
  each alone passed (30, 28, 59, 20 and 1 skipped, 15, 11). `node ops/literal-conformance.mjs`: 35 stylesheets, no
  literal outside the permitted set.
- **The floor, re-measured by the verifier's own probe** (not the builder's `measure.mjs`), Playwright 1.62.1
  Chromium at 360x800 against `next start` of the branch's production build on loopback and a scratch Supabase
  stack (`epic-scratch-8-6v`) seeded by the builder's `method\` scripts plus the admin routes and RPCs: nineteen
  states (the twelve live, three empty, four ceremony), 161 interactive elements. Under `--tap` 0, overlapping
  targets 0, a ground at rest 0, a ground on hover 0, keyboard stops without a solid 2px ring in the
  `--token-focus` colour 0, a ring transitioned 0, horizontal scroll at 359, 390, 759 and 761 0, F-1 pixel `6,5,9`
  in all nineteen, `color-scheme: dark`, the three contract faces `loaded`. Radius above 0 on 10 elements, the
  reveal's five wheel parts in two states (I-12, R22); `box-shadow` on 0. Built CSS: 0 `box-shadow`, 0
  `gradient(`, one accent ground (`::selection`), no `gstatic`. The ceremony's greyscale render with the words masked
  keeps the four shelf states apart (solid, solid with the dot, a cross, dashed).
- **Records.** `ops/restyle-floor.md` § `cs-tournament` carries the Story 8.4 fields, findings 1 to 5 and I-12 to I-14;
  R21 to R24 are dated Pending rows. Scratch stack and server removed after the run.
- **Rebased onto Story 8.5, which reached `dev` in parallel (`189a922`).** Both sides kept: `accent-fill.test.ts`
  carries four exemptions (the tracker's and the tournament's `::selection`), and this story's rows and items,
  numbered R17 to R20 and DW-355 and DW-356 on the branch, are R21 to R24 and DW-360 and DW-361, since 8.5 took the
  lower numbers. 8.5 vendored a copy of the contract under `apps/tracker/app/cuatro-contracts/` and admitted it in
  `anchor-contract.test.ts`, while this story loads `contracts/` directly, so the two applications inside the Anchor
  consume the contract two ways; R24 now names that for the Operator. Re-run on the rebased tree: root suite 80
  files, 76 passed; 1978 passed, 1 skipped, 4 failed, the WSL-bash `demo-reset`, `deploy-remote`, `library-backup`
  and `postgres-backup` (DW-135), each passing alone (30, 28, 59, 20 and 1 skipped); `accent-fill`,
  `anchor-contract` and `literal-conformance` together 125 passed; tournament `test` 1988 passed. The tracker's own
  suite was not a gate here (no change under `apps/tracker`, and it needs a Redis this host does not run).

Open for the Operator: R21 (visual sign-off), R22 (I-12 to I-14), R23 (`main` and the roll, the live production
check), R24 (`token_contract` for an application inside the Anchor).
