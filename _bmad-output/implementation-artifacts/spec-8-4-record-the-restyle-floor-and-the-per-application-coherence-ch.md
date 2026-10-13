---
title: 'Story 8.4: record the restyle floor and the per-application coherence check'
type: 'chore'
created: '2026-10-13'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
  - '{project-root}/ops/restyle-floor.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** SM-12 is only real once each wave-1 application's restyle is recorded per application against all twelve
floor checks, by each check's stated method, with failures written as findings (`epics.md` Story 8.4).

**Approach:** Extend `ops/restyle-floor.md` with one record per application in `RESTYLE-SPEC.md` § Recording a
restyle's shape, from Stories 8.1 to 8.3's evidence, and run whatever a stated method or SM-12 check still lacks.

## Boundaries & Constraints

**Always:** each F-check by its binding method, pass or fail; record against the branch heads and say so (every
restyle PR awaits the Operator); a failure is a finding plus a DW, never a fix.

**Never:** edit a Satellite repository; touch the box; merge or push; commit screenshots (evidence lives under
`C:\CuatroEcosystem\epic-8-evidence\8-4-...\`).

</frozen-after-approval>

## Code Map

- `ops/restyle-floor.md`: § O-14, § O-15 and the three per-application sections are the source; the new
  § SM-12 per application goes before § Pending Operator actions, which gains R12 and R13.
- `contracts/registry.json` 1.10.0: `token_contract` per entry; status history for SM-C6.
- `apps/hub/lib/registry.ts` `selectRendered`: the Suite Directory renders `Live` and `Complete`.
- `_bmad-output/implementation-artifacts/deferred-work.md`: DW-350 (F-7 scope, owned here), DW-352 to DW-354 new.

## Tasks & Acceptance

**Execution:**
- [x] `ops/restyle-floor.md`: first commit, the 8.2 and 8.3 verifiers' minor findings (coverless tile's `N° NN`, the
  adopt step's `emerald-100` chip, the `.cover` border, the CRLF test, I-6 stroke, I-11 ring radius, the toast, R12).
- [x] `ops/restyle-floor.md`: the per-application table, F-1 to F-12 by method, the four manual checks with AD-19,
  vendored versions against the current contract with the AD-18 gap, SM-C6; R13.
- [x] `deferred-work.md`: DW-352, DW-353, DW-354; DW-350's dated note.
- [x] `sprint-status.yaml`: row 8-4 to `review`.

**Acceptance Criteria:**
- Given the three wave-1 applications, when the record is read, then F-1 to F-12 each show pass or fail with the
  method used, for each application.
- Given § Recording a restyle, then each application carries id, verified family, floor routes, call sites before
  and after (family A), AD-19's date and findings, greyscale renders, and the Registry `token_contract`.
- Given SM-12's four manual checks, then each is recorded per application, with the measured 44 by 44 floor and the
  ring against three grounds, failures as findings.
- Given AD-18, then each application's vendored version sits beside the current contract, stated as the gap AD-18
  does not cover. Given AD-25, then SM-C6 reads zero with its evidence.

## Implementation Notes

- **Record against branch heads**: `cs-tracker` `32c0d73` (PR #11), `digital-library` `c25f830` on `960050b`
  (PR #66), `list-wheel` `c665ee9` (PR #4), all open on 2026-10-13.
- **Gaps closed by Story 8.4's own runs** (production image of `cs-tracker` `32c0d73`, scratch stack, all
  `epic-scratch-8-4-*` objects removed): F-1 and F-3 by sampled pixel (8.1 had read computed style and the
  stylesheet): ground `6,5,9` = `--token-bg`, hairline `40,40,48` = `--token-border`, Control `101,100,113` =
  `--token-border-interactive`, on four routes at 360 and 1280. Reduced motion forced (8.1 never ran it): the
  disconnect notice still fades and slides 16px over 300 ms (finding 7, DW-354).
- **Ring against three grounds**: vendored `tokens.css` sha256 `dd7bf3c2...` on all three heads and the Anchor;
  `--c-focus` contrast 11.70, 11.19, 10.45 to 1.
- **Result**: floor holds for `cs-tracker` (on R2 reading (a)) and `list-wheel`; `digital-library` fails F-7 (R13).
  Reduced motion fails in all three, so SM-12's four checks are clean in none.
- **Deviation**: no `epic-8-context.md` compiled; `epics.md` Epic 8 and both UX specs were read in full instead,
  as Stories 8.1 to 8.3 did.

## Design Notes

F-7 for `digital-library` is recorded as a fail, not reinterpreted: the method is binding, and choosing between
narrowing F-7 and restyling `/admin` is a specification decision, so it is R13. Token count: about 1,450 (5,300 characters), under 1,600.

## Verification

**Builder, 2026-10-13:** `corepack pnpm test --run`, three full runs (80 files, 1980 tests): 5, 3 and 6 files failed,
every one a DW-135 WSL-bash file (the third: demo-reset, deploy-remote, library-backup, postgres-backup,
postgres-init, tournament-backup; 9 failed, 1970 passed, 1 skipped). Each of the seven alone: deploy-remote 28,
library-backup 59, tracker-backup 11, postgres-backup 20 + 1 skipped, postgres-init 17, tournament-backup 15,
demo-reset 30, all passed. Nothing else failed. The change is documentation only.

**Independent verifier:** not yet run; the verdict goes here.
