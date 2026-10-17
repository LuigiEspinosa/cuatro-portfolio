---
title: 'Epic 8 specification amendment: RESTYLE-SPEC.md from the Operator rulings of 2026-10-17'
type: 'chore'
created: '2026-10-17'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/ops/restyle-floor.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/RESTYLE-SPEC.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Story 8.3 left eleven points an implementer had to infer (I-1 to I-11), and Story 8.4 left three
floor questions open (R2 the denominator, R13 F-7's scope, R14 F-12 without a § 2 row). Wave 2 (8.5, 8.6) would
meet all of them again in two more frameworks. The Operator ruled on all of them, and on retiring the two
workspace `DESIGN.md` files (R11, R12), on 2026-10-17.

**Approach:** Write each ruling into `RESTYLE-SPEC.md` where it belongs, date the rows in `ops/restyle-floor.md`
and re-read SM-12 under the amended floor, close DW-346 and DW-350, then check `list-wheel` (live) and
`cs-tracker` (dev) against I-10 and I-11 as ruled and fix any rendered defect presentation-only on a Satellite
branch.

## Boundaries & Constraints

**Always:** the rulings as given (8.3's readings for I-1 to I-10, I-10's dot square, I-11 no radius on a field's
focus ring, R2 (a), R13 (a), R14 accepted); a rendered defect fixed only in a new Satellite worktree branch with a
dated Pending row; evidence under `C:\CuatroEcosystem\epic-8-evidence\8-spec-restyle-spec-amendment\`.

**Never:** push, open or merge a PR; touch the box; edit an Operator checkout; change behaviour, DOM order or
microcopy in a Satellite.

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-cuatro-portfolio-2026-08-15/RESTYLE-SPEC.md`: § 1, § 1b, § 2,
  § 3, § 4, § 5, § 6, § 9, § What is deliberately not in the vocabulary (new § Readings settled 2026-10-17),
  § The floor (scope, F-5, F-7, F-12). Precedence: `DESIGN.md` wins on a value (the dot), this file on geometry.
- `ops/restyle-floor.md`: § `list-wheel` I-table; § `digital-library` F-2 and F-7; § SM-12 per application
  (surfaces, F-2, F-5, F-7, F-12, the verdict); § Pending Operator actions R2, R7, R11 to R14, new R15, R16.
- `_bmad-output/implementation-artifacts/deferred-work.md`: DW-346, DW-350 (and DW-343's selector name).
- `_bmad-output/implementation-artifacts/sprint-status.yaml`: a comment above `8-5`; this story has no key.
- `list-wheel` `src/styles.css` (`:focus-visible` gives `--r-hair`, beating the bare `textarea` hand-fix 4) and
  `src/app/restyle.spec.ts`.
- `cs-tracker` `assets/css/app.css` on `origin/dev` `1e7cd07` (hand-fix 3 sets no radius; `.ct-field`, `.ct-dot`
  at `--r-none`).

## Tasks & Acceptance

**Execution:**
- [x] First commit: the three handed-over minor findings in `ops/restyle-floor.md` (and the selector in DW-343, DW-350).
- [x] `RESTYLE-SPEC.md`: settle I-1 to I-11 in place, index them, amend § The floor for R2 (a), R13 (a), R14 (the rulings).
- [x] `ops/restyle-floor.md`: date the six rows, re-read SM-12, add R15 and R16 (the record).
- [x] `deferred-work.md`, `sprint-status.yaml`: close DW-346 and DW-350, board note.
- [x] Probe I-11 on `list-wheel` live and I-10/I-11 on `cs-tracker`; fix `list-wheel` on `fix/8-spec-field-focus-radius`.
- [x] Retire the two workspace `DESIGN.md` files and the `AGENTS.md` line that called one the law.

**Acceptance Criteria:**
- Given RESTYLE-SPEC.md, when a wave-2 implementer meets any of I-1 to I-11, then the specification states the
  reading, I-10's dot at `--r-none` and a field's ring at `--r-none`.
- Given § The floor, when F-7, F-12 or the denominator is applied, then R13 (a), R14 and R2 (a) are stated there.
- Given the record, when R2, R7, R11 to R14 are read, then each carries the 2026-10-17 ruling and what acted on it,
  and SM-12 is re-read per application under the amended F-5, F-7 and F-12.
- Given `list-wheel` and `cs-tracker`, when a field holds focus, then its computed radius is `0px`, measured in a
  browser; a defect is fixed on a branch with a regression test and a Pending row.

## Implementation Notes

**The three handed-over findings, all applied** (commit 1). The textarea finding is recorded in the I-11 row and is
also the defect this story fixes (R16). The F-2 note sits in § `digital-library` F-2 and in § SM-12's F-2 row. The
selector `:-moz-ui-invalid{box-shadow:none}` is named in three record rows and in DW-343 and DW-350; it is
`cs-tracker`'s one `box-shadow` too, read from its image CSS.

**Decisions.**
- **R2 (a) and `digital-library`.** The ruling names "an application whose anonymous surfaces are a redirect,
  plain text and the issuer's page". `digital-library` renders its own `/login`, so the spec keeps its strict
  floor and its restyled interior is beyond it. Read the other way the reader enters the floor and F-7 fails again
  (`shadow-xl`, `shadow-2xl`). Not decided here: row R15 asks the Operator.
- **A checkbox is a field** for I-11, from F-5's "form field" and 8.3's reading of I-1.
- **I-10's icon-only glyph**: 8.3 recorded "not reached"; the spec takes the reading `cs-tracker` used (H-30).
- **F-7 states that `box-shadow: none` draws none**, as Stories 8.1 and 8.4 already read it, or F-7 under R13 (a)
  would be undecidable on Tailwind's preflight.
- **The amended F-5 is re-read for all three**, `digital-library` included, since it now binds a focused field.
- **The retired files are copied** to the evidence folder's `retired\` before being replaced.

**Observed, not changed** (outside the rulings): `RESTYLE-SPEC.md` § Family C still names `digital-library` (§ O-15
says A, source-owned) and § Family A calls O-14 open; `apps/hub/app/__tests__/anchor-contract.test.ts` cites
`RESTYLE-SPEC.md:326-341` for § 4, which now sits at 336 onwards; `digital-library`'s code comments still cite the
WIRED `DESIGN.md` sections.

**Measurements** (Chromium `151.0.7922.34`, scale factor 1; transcripts and scripts in the evidence folder):
- `list-wheel` live, 2026-10-17T08:21:24Z: after clicking Edit, `textarea ... focus-visible=true radius=2px`; find
  fields and checkbox `0px`. Fix build `2d1b8b8`, 08:24:01Z: every field `0px`, ring `solid 2px`.
- `cs-tracker`, the production image CSS of `32c0d73` (sha256 `47bad236...`; `git diff 32c0d73 origin/dev` empty):
  dot `radius=0px 4pxx4px`; text, search, date (four stops), select, textarea, checkbox all `0px` focused.
- `digital-library`, image CSS of `c25f830` (`790e825e...`): `/login`'s two `.field` inputs and the grid's search
  and sort `0px` focused.

**Tests.** `list-wheel` `npm test`: before the fix `TOTAL: 1 FAILED, 148 SUCCESS` (`Entries, one per line radius:
Expected '2px' to be '0px'.`), after `TOTAL: 149 SUCCESS`; `node --test ops/deploy-remote.test.mjs` `pass 27, fail
0`; `npm run build` no warning, 0 `box-shadow` or `gradient(` in the built stylesheet. Anchor root suite,
`corepack pnpm test --run`: `Test Files 6 failed | 74 passed (80)`, `Tests 6 failed | 1973 passed | 1 skipped (1980)`,
the six failures all in DW-135 WSL-bash files (`deploy-remote`, `library-backup`, `tracker-backup`, `postgres-backup`,
`postgres-init`, `tournament-backup`), one case each; a second full run failed five of the same six. Each alone:
28/28, 59/59, 11/11, 20 passed and 1 skipped, 17/17, 15/15.

## Verification

**Commands:**
- `corepack pnpm test --run`, expected: every file passes (DW-135 files re-run alone if they fail).
- `list-wheel` `fix/8-spec-field-focus-radius`: `npm test`, expected `149 SUCCESS`.

**Independent verifier** (fills this in):
