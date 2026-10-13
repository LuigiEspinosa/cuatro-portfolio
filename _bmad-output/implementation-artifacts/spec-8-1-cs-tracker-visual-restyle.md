---
title: 'Story 8.1: cs-tracker visual restyle, with O-14, O-15 and O-17 for wave 1'
type: 'feature'
created: '2026-10-13'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '3a57510fe87ad56cd04e3451432bd8afc15266f6'
context: []
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** daisyUI's components render `cs-tracker` as a framework default under the contract's
colours (filled, rounded buttons, cards, eased focus rings), and 8.2 and 8.3 cannot be estimated
until the wave-1 floors and stacks are known (O-14, O-15) and the residual review findings triaged (O-17).

**Approach:** Answer O-14, O-15 and O-17 for all three wave-1 Satellites in one new record,
`ops/restyle-floor.md`; restyle `cs-tracker` by family A's strategy (theme kept, every component class
replaced by plain markup carrying `RESTYLE-SPEC.md`'s vocabulary, `core_components.ex` rewritten),
count the call sites before and after, and measure the result once by hand (AD-19).

## Boundaries & Constraints

**Always:** presentation only: DOM order, routes, data and every string unchanged; the plugin stays
installed; vendored contract `v2.0.0` and Registry `token_contract` `2.0.0` unchanged; failures recorded,
not corrected out of scope.

**Never:** an Anchor import beyond `cuatro-contracts/` (AD-24); a push, a PR, a merge or a box step;
a screenshot committed to a repository.

</frozen-after-approval>

## Code Map

- `ops/restyle-floor.md` (new): O-14 by route, O-15 with family per app, O-17 (32 + 6 High), cs-tracker's record, R1 to R4
- `cs-tracker` `assets/css/app.css`: the `ct-*` vocabulary in the components layer; theme block and hand-fixes untouched; the daisyUI `@plugin` block includes no component (fix round 1)
- `cs-tracker` `lib/cs_tracker_web/components/*.ex`, `live/*.ex`, `layouts/root.html.heex`: markup
- `cs-tracker` `test/cs_tracker_web/restyle_test.exs` (new), `components/core_components_test.exs`

## Tasks & Acceptance

**Acceptance Criteria (`epics.md` Story 8.1, in full there):**
- Given O-14, O-15 open, when the story opens, then the anonymous surfaces are enumerated by route for
  all three, each stack verified and assigned a family, a contradicted strategy restated, O-17 triaged.
- Given family A, when restyled, then theme variables map to roles, no component class on a floor
  surface, utilities kept, plugin installed; call sites counted before and after, after zero.
- Given the floor, when complete, then F-1 to F-12 are measured by § The floor's methods; S-8 evaluated;
  contract versions unchanged.

## Spec Change Log

## Design Notes

- **Split or Keep:** did not arise; the spec is about 1,480 tokens (5,910 characters before
  § Verification, measured, at 4 per token). An unattended builder with no subagent tool; Checkpoint 1
  answered Approve with no open question; the record carries the detail.
- **The floor (ruling R2 pending):** cs-tracker renders no styled anonymous surface (redirects,
  plain text, the issuer's page), so the strict floor is empty. The restyle covers the demo-reachable
  interior, where the 2026-09-24 ruling booked the 74 and 38 findings; Active Offers stays S-6.
- **O-15 contradicts two assumptions:** `digital-library` is family A in a source-owned form
  (shadcn-svelte over `bits-ui`), `list-wheel` is C; each story's strategy is restated (R4).
- Deleted, not restyled: six generator components no surface calls. Kept: heroicons inside icon-only
  Controls (the spec has no glyph for one) and the reconnect notice's spin (S-5).

## Implementation Notes

**First commit, `0609563`:** the verifier's handover. `ops/contract-adoption.md`: cs-tracker holds 11
`cuatro-contracts/` entries on `main` (9 blobs, 2 trees), and the event pin reads `1 today`. The flaky
tracker test was already DW-341, filed by that verifier; its evidence now names `63c5a1f`
(`gh run view 38399622554`: attempt 2, `success`), and no duplicate was filed.

**cs-tracker:** worktree `C:\CuatroEcosystem\cs-tracker-workspace\wt-8-1-cs-tracker-visual-restyle`,
branch `restyle/8-1-visual-restyle`, commit `a0bfbb5` from `origin/dev` `0e5d0c4`, 14 files, then the fix
round's `32c0d73` (2 files).
DW-342 (the AD-19 probe mints a deleted Steam session), DW-343 (F-7, H-19, closed by the fix round), DW-344 (two findings
outside the ceiling) filed. S-8 evaluated (`ops/cs-tracker-token-adoption.md`); probe action notes
in `ops/cs-tracker-accessibility-pass.md` action 2 and `ops/contract-adoption.md` action 4.

**Tests and measurements, real output:**
- Daisy call sites (`method/count-daisy.mjs`, 58 roots, 475 classes from the bundle): **98 before, 0 after**.
- `restyle_test.exs` mutant (planted `btn btn-ghost transition-colors`): 4 tests, 2 failures, naming the file; reverted.
- `mix precommit` on `a0bfbb5`: `714 tests, 0 failures (4 excluded)`, exit 0 (717 before: 6 deleted with their components, the button's 4 replaced by 3, 4 added).
- AD-19 pass, 360x800, seven pages, 96 interactive elements: under `--tap` 89 to **0**, transitioned rings
  45 to **0**, grounds at rest or hover 85 to **0**, radii 3 to **0**, ringless stops 0, horizontal scroll at
  359/390/759/761 none; F-1, F-2 (all three faces loaded, display was not before), F-8, F-9, F-11 pass; F-7
  failed as written on unused daisyUI rules (DW-343, fixed in round 1 below); F-12 passes on a stated reading.
  The traversal skipped a press that stayed on the same element, so it missed the date field's calendar stop
  (fixed in round 1 below).
- Production image of `a0bfbb5` booted on a scratch Postgres 16: `GET /` 302, `app.css` and three faces 200.
- Anchor root suite, `corepack pnpm test --run`: `Test Files 6 failed | 74 passed (80)`, `Tests 6 failed | 1973 passed | 1 skipped (1980)`;
  the six were the DW-135 WSL-bash suites, each alone then passing: demo-reset 30/30, deploy-remote 28/28,
  library-backup 59/59, postgres-backup 20 + 1 skipped, tournament-backup 15/15, tracker-backup 11/11.

**Fix round 1 (the independent verifier refused on F-6, F-7 and the Code Map's dashes), `cs-tracker` `32c0d73`:**
- F-6: `.ct-field[type="date"]:focus-within` paints the section 4 ring on the field while its calendar button
  holds focus (that stop never matches `:focus-visible`). `method-round-2/measure.mjs` reads every Tab press,
  a press that stays on one element included, and passes a stop on the ring it paints: **0 ringless** over 72
  presses on the seven pages at 360. `method-round-2/tabs-browse.mjs` on `/browse` at 1280: presses 10 to 13 are
  the date field, press 13 reads `fv=false fw=true` and `solid 2px oklch(0.84 0.13 288)`
  (`after-round-2/browse-1280-tab13.png`).
- F-7: the daisyUI `@plugin` block reads `include: rootcolor, scrollbar;`, so no component rule is emitted, and
  `@source not inline("shadow transition");` stops Tailwind minting `.shadow` and `.transition` from prose.
  The production image's `app.css` (26,825 bytes): **one `box-shadow`, preflight's `box-shadow:none`;
  0 gradients**; no rule reads `--color-primary` or `--color-accent`, and the only accent ground is
  `::selection` (F-8). A new `restyle_test.exs` case pins the include list and the exclusion; a planted
  `include: rootcolor, scrollbar, button;` fails it (5 tests, 1 failure), reverted.
- Re-measure, 360x800, the same seven pages: 95 visible interactive elements (the dashboard read 11 where the
  first run read 12: a fresh database has no recently viewed item, so one Control stands where two tiles stood,
  `after-round-2/dashboard-360.png`), under `--tap` 0, transitioned 0, grounds 0, radii 0, horizontal scroll 0;
  F-1, F-2 and F-11 as before.
- `mix precommit` on `32c0d73`: `715 tests, 0 failures (4 excluded)`, exit 0.
- Production image of `32c0d73` (`epic-scratch-8-1-cs-tracker:restyle`), `bin/migrate` then the release on a
  scratch Postgres 16 at 2026-10-13T16:36:33Z: container up, `GET /` 302, `/assets/css/app.css` and the three
  woff2 faces 200; every scratch object removed.

Evidence: `C:\CuatroEcosystem\epic-8-evidence\8-1-cs-tracker-visual-restyle\`. Scratch Docker objects
(`epic-scratch-8-1-*`) removed; `postgres:16` was pulled for the run and left.

## Verification

_For the independent verifier._
