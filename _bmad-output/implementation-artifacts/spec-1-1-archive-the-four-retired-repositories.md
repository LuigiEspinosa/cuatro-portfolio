---
title: 'Archive the four retired repositories'
type: 'chore'
created: '2026-08-16'
status: 'awaiting-operator'
baseline_revision: 'bf0fd061168b6169b456257855a8860a7499af47'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: []
deferred:
  - summary: >-
      Four repositories under Ecosystem governance are private, so their Registry
      `source` links will not resolve for an anonymous Visitor.
    evidence: |-
      `gh repo view` against owner `LuigiEspinosa` on 2026-08-16 returned
      visibility PRIVATE for `cs-tracker`, `cs-tournament`, `StreamVault` and
      `Mutuo`. AD-6 keeps every application in the Registry and SM-4 requires
      every Registry link to resolve, so an entry pointing at a private
      repository is a broken link for the reader it is written for. This
      predates Story 1.1 and was surfaced incidentally while reading GitHub
      state for the four retired repositories. Epic 2 authors the Registry and
      is where it lands.
    location: >-
      ops/estate.md:209
    severity: medium
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

- `ops/estate.md`: the file this story creates. `ops/` does not exist yet, so the directory is new. No other file in the repository references an Estate record today (`git ls-files` matches nothing on `estate` or `ops/`).
- `_bmad-output/planning-artifacts/prds/prd-cuatro-portfolio-2026-08-15/prd.md:577-624`: section 5, The Estate Decision. Line 583-588 is the waypoint table (15, 12, 11, 8). Lines 594-610 are the per-repository disposition table, the authoritative source for all fifteen rows, their Status today and their Registry treatment. Read-only.
- `_bmad-output/planning-artifacts/epics.md:971-1009`: Story 1.1 and its three acceptance blocks. Read-only.
- `_bmad-output/planning-artifacts/architecture/architecture-cuatro-portfolio-2026-08-15/ARCHITECTURE-SPINE.md:112-116`: AD-6, the governing decision, that the Registry's unit is the application, and repository count and entry count are different numbers by design. Read-only.
- `_bmad-output/planning-artifacts/prds/prd-cuatro-portfolio-2026-08-15/prd.md:512-526`: FR-29 (playable inside the Hub) and FR-30 (absorption is recorded, not hidden). FR-29 is deferred to v2 at line 697, which is why `connect-four-react` code has not moved.
- `_bmad-output/planning-artifacts/prds/prd-cuatro-portfolio-2026-08-15/prd.md:747`: SM-7, Estate size, target 12 at MVP and 8 at end state. 11 is below 12 and therefore satisfies it.
- `AGENTS.md`: repository policy, the prose punctuation rule and commit subject only.

**Observed GitHub state, read-only, gathered 2026-08-16 via `gh repo view` against owner `LuigiEspinosa`:** `Lumen` public and not archived, `tcg-tracker` public and not archived, `connect-four-react` public and not archived. `apple-music-workspace` returns no repository under that owner, and a full listing of the account shows no repository with a similar name. `cs-tracker`, `cs-tournament`, `StreamVault` and `Mutuo` are private today, which matters to Epic 2's resolving-`source` requirement but is out of scope here.

## Tasks and Acceptance

**Execution:**
- `ops/estate.md`: create the Estate record with a fifteen-row disposition table (Application, Disposition, Status today, `absorbed_into`, Registry treatment), sourced row for row from PRD section 5.1. Gives Epic 2 a single written disposition to author Registry entries from.
- `ops/estate.md`: add a counts section stating repository count 11 and application count 15 as separate numbers, dated `2026-08-16` in ISO 8601 UTC, with an explicit line that the two are deliberately different and neither validates the other. Satisfies AD-6 and prevents a later reader from treating a count mismatch as a defect.
- `ops/estate.md`: add a line reconciling 11 against SM-7's MVP target of 12, stating that 11 satisfies the target rather than missing it. Prevents a later reader reading the gap as an error.
- `ops/estate.md`: add a pending-Operator section naming the four repositories still to be archived on GitHub and recording that the count of 11 is the decided waypoint, not yet the observed GitHub state. Keeps the record honest under NFR-9 while the console actions are outstanding.
- `ops/estate.md`: record that `apple-music-workspace` could not be located under owner `LuigiEspinosa` on 2026-08-16, so the Operator must confirm its owner or its real name before archiving. An unrecorded missing repository would silently break the fifteen-application count Epic 2 depends on.

**Acceptance Criteria:**
- Given AD-6 makes Registry membership a property of the application, when `ops/estate.md` is read, then it records all fifteen applications with their disposition and current Status, and every application whose code moves carries an `absorbed_into` target.
- Given `tcg-tracker` folds into the Tracker family and `connect-four-react` is absorbed by the Anchor, when their rows are read, then `tcg-tracker` records `absorbed_into: cuatro-tracker` and `connect-four-react` records `absorbed_into: cuatro-portfolio` together with the note that its code has not moved because FR-29 is deferred, so Epic 2 authors its `source` against the archived repository.
- Given repository count and application count are different numbers by design, when the counts section is read, then it states 11 and 15 separately and says in words that the two are deliberately different and neither validates the other.
- Given SM-7 targets 12 repositories at MVP, when the counts section is read, then it records 11 with the ISO 8601 UTC date `2026-08-16` and states that 11 satisfies the MVP target rather than missing it.
- Given archiving is a GitHub console action outside this repository, when the story closes, then no repository state has been changed by this session, and the four archive actions are enumerated in the spec frontmatter under `operator_actions`.

## Spec Change Log

## Review Triage Log

### 2026-08-16, Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 8: (high 0, medium 3, low 5)
- defer: 1: (high 0, medium 1, low 0)
- reject: 11: (high 0, medium 2, low 9)
- addressed_findings:
  - `[medium]` `[patch]` `ops/estate.md` claimed "the account still carries 15 repositories", which contradicted its own observed-state table (three of four found) and was checkably false account-wide (31 repositories, 8 already archived). Restated over the governed set, with the observed figure declared not-yet-exact until `apple-music-workspace` is resolved.
  - `[medium]` `[patch]` "Repository count under Ecosystem governance" was undefined, and archiving does not delete a repository, so 11 was uncheckable. Defined at the Counts table as non-archived repositories under governance.
  - `[medium]` `[patch]` FR-30 was cited as a live requirement, but PRD section 9 defers FR-29 and FR-30 together to v2. The `absorbed_into` obligation is now attributed to AD-6, with FR-30 marked deferred.
  - `[low]` `[patch]` The Counts table stated 11 with no caveat at the point of claim. Added a "Nature of the figure" column marking 11 as a decided waypoint, not an observation.
  - `[low]` `[patch]` The `tcg-tracker` note was asymmetric with the `connect-four-react` note and read as though the fold had happened. Added the same plain statement that the fold has not happened and the code has not moved.
  - `[low]` `[patch]` The `connect-four-react` Registry-treatment cell promised an embedded demo in the present tense while FR-29 is deferred, an NFR-9 risk. Made conditional and future tense.
  - `[low]` `[patch]` Four honesty gaps in `ops/estate.md`: observed-state check scope, a maintenance rule for the pending section, reconciliation against PRD section 9.1 as well as SM-7, and a pointer routing the two `[ASSUMPTION: ...]` Statuses to story `2-4`.
  - `[low]` `[patch]` The spec used ` -- ` as a dash separator, violating the rule stated in its own Boundaries and in `AGENTS.md`. Replaced outside `<intent-contract>`, and the dash-scan verification widened to both files and to the double-dash form.

## Design Notes

The story title says four retired repositories while PRD section 5 archives three and absorbs one. These agree: absorption is what produces the 11 waypoint, and an absorbed application is archived on GitHub exactly as an empty shell is. The difference is the Registry treatment, not the GitHub action, so all four rows end at the same archived state and `connect-four-react` additionally carries `absorbed_into`.

`ops/estate.md` is a written record, not Registry data. It is deliberately not `contracts/registry.json`: the Registry is authored JSON validated by schema in Epic 2 under AD-4, and putting Estate data in `contracts/` now would publish an unvalidated surface. Epic 2 reads this file and authors entries from it.

## Verification

**Commands:**
- `Test-Path ops/estate.md`: expected True.
- `Select-String -Path ops/estate.md, _bmad-output/implementation-artifacts/spec-1-1-archive-the-four-retired-repositories.md -Pattern '[\u2014\u2013]| -{2} |\w-{2}\w'`: expected no matches. This covers both files, and catches the double-dash form as well as the em-dash and en-dash. Two details make it usable. The pattern uses regex escapes rather than the literal characters, so it does not match itself now that it scans the file it is written in. It also requires either spaces or word characters on both sides of the dash pair, so a Markdown table separator row (a run of dashes between pipes) does not match, and neither does a CLI flag, which is preceded by a space and followed by a letter.
- `gh repo view LuigiEspinosa/Lumen --json isArchived` and the same for `tcg-tracker` and `connect-four-react`: expected `false` for all three, plus `PUBLIC` visibility, confirming this session changed no repository state.
- `corepack pnpm typecheck`: expected to pass. The change adds no TypeScript, so this only confirms nothing else was disturbed.

**Manual checks:**
- `ops/estate.md` lists exactly fifteen application rows, and every one of the fifteen names in PRD section 5.1 appears exactly once.
- The counts section names 11 and 15 as separate numbers, carries the date `2026-08-16`, and contains both the neither-validates-the-other line and the 11-satisfies-SM-7 line.

## Auto Run Result

Status: awaiting-operator

**Summary.** `ops/estate.md` now records the Estate: fifteen applications with disposition, Status and `absorbed_into` where one applies, the 11 repository waypoint dated `2026-08-16` in ISO 8601 UTC, and the reconciliation showing that 11 satisfies SM-7's MVP target of 12 rather than missing it. The two file-surface acceptance blocks of Story 1.1 are met in full. The first acceptance block, which requires the four repositories to be in GitHub's archived read-only state, is console work outside this repository and is owed to the Operator under `operator_actions`. No GitHub repository state was changed by this run.

**Files changed.**
- `ops/estate.md`: new. The written Estate record, and the file Epic 2 authors Registry entries from. Introduces the `ops/` directory.
- `_bmad-output/implementation-artifacts/spec-1-1-archive-the-four-retired-repositories.md`: new. This spec, carrying the four owed Operator actions.
- `_bmad-output/implementation-artifacts/epic-1-context.md`: new. Epic 1 planning context compiled from the planning artifacts during this run, and referenced by this spec's `context:` frontmatter.

**Review findings.** 8 patches applied (high 0, medium 3, low 5), 1 item deferred (medium), 11 rejected as out of scope or noise, 0 intent gaps, 0 spec repairs. The rejected set was mostly Registry-entry design (an `id` column, a `source` column, AD-5's `demo` and `identity` fields, the FR-35 rendered count), which the epic's acceptance criteria assign to Epic 2 and `contracts/registry.json`, not to this record.

**Follow-up review recommended: true.** Patched findings by severity: high 0, medium 3, low 5. Score = (3 x 3) + (1 x 5) = 14, which is at or above the threshold of 5.

**Verification performed.** `Test-Path ops/estate.md` returned True. The widened dash scan over both files returned no matches, and was checked against positive and negative controls so it is not passing vacuously. A full non-ASCII sweep of `ops/estate.md` found no character above U+007E. `gh repo view` returned `isArchived: false` and `PUBLIC` for `Lumen`, `tcg-tracker` and `connect-four-react`, confirming the run changed no repository state. `corepack pnpm typecheck` exited 0. Manual checks: the disposition table carries exactly fifteen application rows, each PRD section 5.1 name appearing exactly once, and the counts section carries 11, 15, the date, the neither-validates-the-other line and the 11-satisfies-SM-7 line.

**Residual risks.**
- `apple-music-workspace` could not be located under owner `LuigiEspinosa`. It is one of the fifteen applications and Epic 2 will author a Registry entry needing a resolving `source` for it, so if the repository is genuinely gone, both the application count and SM-4 break. This is the first Operator action to resolve, ahead of the archiving itself.
- The four `Archived` Status rows and the count of 11 are decided state, not observed state, until the Operator performs the archive actions. Nothing inside the repository re-checks whether that happens, so the record can drift from reality with no signal. `ops/estate.md` declares the gap and carries a maintenance rule for closing it.
- Four governed repositories are private. Recorded in this spec's `deferred` ledger for Epic 2.
