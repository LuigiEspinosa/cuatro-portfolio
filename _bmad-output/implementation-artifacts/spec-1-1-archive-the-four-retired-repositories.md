---
title: 'Archive the four retired repositories'
type: 'chore'
created: '2026-08-16'
status: 'in-progress'
baseline_revision: 'bf0fd061168b6169b456257855a8860a7499af47'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: []
deferred: []
operator_actions:
  - 'Archive `LuigiEspinosa/Lumen` on GitHub, keeping it public so its `source` link keeps resolving (AD-6).'
  - 'Archive `apple-music-workspace` on GitHub, keeping it public. Blocked first: the repository could not be located under owner `LuigiEspinosa` on 2026-08-16, so confirm its real owner or its real name before archiving.'
  - 'Archive `LuigiEspinosa/tcg-tracker` on GitHub, keeping it public so its `source` link keeps resolving (AD-6).'
  - 'Archive `LuigiEspinosa/connect-four-react` on GitHub, keeping it public so Epic 2 can author its `source` against the archived repository while FR-29 stays deferred.'
---

<intent-contract>

## Intent

**Problem:** The Estate holds fifteen repositories by accumulation rather than by decision. Four are retired: three empty shells and one finished toy whose disposition is absorption. Nothing inside this repository records what happens to any of the fifteen, so Epic 2 has no written disposition to author Registry entries from, and the repository count reads as history rather than as a choice.

**Approach:** Create `ops/estate.md` as the written Estate record: all fifteen applications with disposition, current Status and, where one applies, an `absorbed_into` target, plus the 11 repository waypoint dated and reconciled against the MVP target. The four GitHub archive actions are console work outside this repository, so they are handed to the Operator rather than performed here.

## Boundaries and Constraints

**Always:**
- Registry membership is a property of the application, not the repository (AD-6). All fifteen applications keep an entry, archived and absorbed ones included. An application is never dropped by omission.
- The four archived repositories stay publicly readable, because AD-6 requires their `source` link to keep resolving after archiving.
- `ops/estate.md` states the repository count and the application count as two separate numbers, with an explicit line that they are deliberately different and that neither validates the other.
- The repository count 11 is recorded with an ISO 8601 UTC date, and the record states that 11 satisfies the MVP target of 12 rather than missing it.
- `connect-four-react` is recorded as `absorbed_into: cuatro-portfolio` with the note that its code has not moved, because the playable half of FR-29 is deferred, so Epic 2 authors its `source` against the archived repository.
- `tcg-tracker` is recorded as `absorbed_into: cuatro-tracker`.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash, and no emoji.
- The commit is a subject line only, with no body and no trailer.

**Block If:**
- Two planning artifacts disagree on the disposition or `absorbed_into` target of an application, with nothing in either to select between them.

**Never:**
- Never archive, unarchive, delete, rename or change the visibility of any GitHub repository from this session. Those are Operator console actions and belong in `operator_actions`.
- Never touch the state of any repository outside the four named.
- Never author or edit `contracts/registry.json`. The Registry is Epic 2 (AD-4).
- Never edit `content/projects.ts`.
- Never write `_bmad-output/implementation-artifacts/sprint-status.yaml`. It belongs to the orchestrator.

</intent-contract>

## Code Map

- `ops/estate.md` -- the file this story creates. `ops/` does not exist yet, so the directory is new. No other file in the repository references an Estate record today (`git ls-files` matches nothing on `estate` or `ops/`).
- `_bmad-output/planning-artifacts/prds/prd-cuatro-portfolio-2026-08-15/prd.md:577-624` -- section 5, The Estate Decision. Line 583-588 is the waypoint table (15, 12, 11, 8). Lines 594-610 are the per-repository disposition table: the authoritative source for all fifteen rows, their Status today and their Registry treatment. Read-only.
- `_bmad-output/planning-artifacts/epics.md:971-1009` -- Story 1.1 and its three acceptance blocks. Read-only.
- `_bmad-output/planning-artifacts/architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md:112-116` -- AD-6, the governing decision: the Registry's unit is the application, and repository count and entry count are different numbers by design. Read-only.
- `_bmad-output/planning-artifacts/prds/prd-cuatro-portfolio-2026-08-15/prd.md:512-526` -- FR-29 (playable inside the Hub) and FR-30 (absorption is recorded, not hidden). FR-29 is deferred to v2 at line 697, which is why `connect-four-react` code has not moved.
- `_bmad-output/planning-artifacts/prds/prd-cuatro-portfolio-2026-08-15/prd.md:747` -- SM-7, Estate size: target 12 at MVP, 8 at end state. 11 is below 12 and therefore satisfies it.
- `AGENTS.md` -- repository policy: prose punctuation rule, commit subject only.

**Observed GitHub state, read-only, gathered 2026-08-16 via `gh repo view` against owner `LuigiEspinosa`:** `Lumen` public and not archived, `tcg-tracker` public and not archived, `connect-four-react` public and not archived. `apple-music-workspace` returns no repository under that owner, and a full listing of the account shows no repository with a similar name. `cs-tracker`, `cs-tournament`, `StreamVault` and `Mutuo` are private today, which matters to Epic 2's resolving-`source` requirement but is out of scope here.

## Tasks and Acceptance

**Execution:**
- `ops/estate.md` -- create the Estate record with a fifteen-row disposition table (Application, Disposition, Status today, `absorbed_into`, Registry treatment), sourced row for row from PRD section 5.1 -- gives Epic 2 a single written disposition to author Registry entries from.
- `ops/estate.md` -- add a counts section stating repository count 11 and application count 15 as separate numbers, dated `2026-08-16` in ISO 8601 UTC, with an explicit line that the two are deliberately different and neither validates the other -- satisfies AD-6 and prevents a later reader from treating a count mismatch as a defect.
- `ops/estate.md` -- add a line reconciling 11 against SM-7's MVP target of 12, stating that 11 satisfies the target rather than missing it -- prevents a later reader reading the gap as an error.
- `ops/estate.md` -- add a pending-Operator section naming the four repositories still to be archived on GitHub and recording that the count of 11 is the decided waypoint, not yet the observed GitHub state -- keeps the record honest under NFR-9 while the console actions are outstanding.
- `ops/estate.md` -- record that `apple-music-workspace` could not be located under owner `LuigiEspinosa` on 2026-08-16, so the Operator must confirm its owner or its real name before archiving -- an unrecorded missing repository would silently break the fifteen-application count Epic 2 depends on.

**Acceptance Criteria:**
- Given AD-6 makes Registry membership a property of the application, when `ops/estate.md` is read, then it records all fifteen applications with their disposition and current Status, and every application whose code moves carries an `absorbed_into` target.
- Given `tcg-tracker` folds into the Tracker family and `connect-four-react` is absorbed by the Anchor, when their rows are read, then `tcg-tracker` records `absorbed_into: cuatro-tracker` and `connect-four-react` records `absorbed_into: cuatro-portfolio` together with the note that its code has not moved because FR-29 is deferred, so Epic 2 authors its `source` against the archived repository.
- Given repository count and application count are different numbers by design, when the counts section is read, then it states 11 and 15 separately and says in words that the two are deliberately different and neither validates the other.
- Given SM-7 targets 12 repositories at MVP, when the counts section is read, then it records 11 with the ISO 8601 UTC date `2026-08-16` and states that 11 satisfies the MVP target rather than missing it.
- Given archiving is a GitHub console action outside this repository, when the story closes, then no repository state has been changed by this session, and the four archive actions are enumerated in the spec frontmatter under `operator_actions`.

## Spec Change Log

## Review Triage Log

## Design Notes

The story title says four retired repositories while PRD section 5 archives three and absorbs one. These agree: absorption is what produces the 11 waypoint, and an absorbed application is archived on GitHub exactly as an empty shell is. The difference is the Registry treatment, not the GitHub action, so all four rows end at the same archived state and `connect-four-react` additionally carries `absorbed_into`.

`ops/estate.md` is a written record, not Registry data. It is deliberately not `contracts/registry.json`: the Registry is authored JSON validated by schema in Epic 2 under AD-4, and putting Estate data in `contracts/` now would publish an unvalidated surface. Epic 2 reads this file and authors entries from it.

## Verification

**Commands:**
- `Test-Path ops/estate.md` -- expected: True.
- `Select-String -Path ops/estate.md -Pattern '[—–]'` -- expected: no matches, confirming no em-dash or en-dash reached the prose.
- `gh repo view LuigiEspinosa/Lumen --json isArchived` and the same for `tcg-tracker` and `connect-four-react` -- expected: `false` for all three, confirming this session changed no repository state.
- `corepack pnpm typecheck` -- expected: passes. The change adds no TypeScript, so this only confirms nothing else was disturbed.

**Manual checks:**
- `ops/estate.md` lists exactly fifteen application rows, and every one of the fifteen names in PRD section 5.1 appears exactly once.
- The counts section names 11 and 15 as separate numbers, carries the date `2026-08-16`, and contains both the neither-validates-the-other line and the 11-satisfies-SM-7 line.
