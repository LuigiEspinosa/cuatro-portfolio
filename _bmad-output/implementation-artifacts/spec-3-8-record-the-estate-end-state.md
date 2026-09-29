---
title: 'Story 3.8: Record the Estate end state'
type: 'chore'
created: '2026-09-29'
status: 'done'
baseline_commit: 'c6c5a56fe7f7096253e6f8360df9f275d1c4c7a1'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/ops/estate.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** Epic 3 has merged its three applications on `dev`, but `ops/estate.md` records no end
state: its sequence table still frames the end state as the merge alone, two paragraphs call the
membership of `covidmap` and `future-vizion` undecided though DW-249 closed on 2026-09-26, and
several rows promise that "Story 3.8 then writes `absorbed_into`", which this story cannot do while
no source repository is archived.

**Approach:** Add one dated `### The end state` section to `ops/estate.md` that states the true
destination (10 repositories, named), the true sequence with ISO 8601 UTC dates and which stations
are reached, the observed count today, the Registry entry count beside it, and SM-C2's warning;
amend the stale sentences in place with dated notes; hand the archive-dependent Registry change to
a new DW item and the Operator.

## Boundaries & Constraints

**Always:** every figure is either observed (with the command and UTC time) or a decision (with the
ruling and date); the waypoint sentence `The 13 repositories at this waypoint are ...` and
`ESTATE_COUNT` stay untouched, since no waypoint has moved; history paragraphs stay as written and
take dated amendments (the file's convention).

**Never:** edit `contracts/registry.json` or its schema; write `absorbed_into` or move a `source`
for an unarchived repository; touch `deploy.yml`, `ops/capacity-gate.yml` or any application code;
edit PRD or `epics.md`; archive anything.

**Decisions (answered from the sources, no human present):**
1. The criterion's `8` and `15 -> 11 -> 8` are stale against the Operator rulings of 2026-09-25
   (listing) and 2026-09-26 (SM-7 to 13 and 10). The record states 10 and the real sequence
   (15, corrected to 14; 12; 14; 13; 10), and notes the criterion's numbers against the rulings.
2. `covidmap` and `future-vizion` are in the end state: DW-249 closed with "kept permanently".
3. No `absorbed_into` is written: `gh api` at 2026-09-29T17:02:30Z shows all three sources
   unarchived. The Registry change waits on the archives and is DW-285.
4. The later `source` move is not decided here: Story 2.23's `GITHUB_SOURCE` accepts only
   `https://github.com/<owner>/<repo>`, and the Anchor's `tree/main/apps/<id>` answers 404 until
   the Epic 3 merge. DW-285 carries the options.
5. DW-275 and DW-283, each owned "Story 3.8 or" a later owner, pass to that later owner with a
   dated note; neither is a record change.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Waypoint parse | `estateNames` over the edited file | still 13 names | contract-adoption suite fails if not |
| No archive yet | three sources unarchived | no Registry change; DW-285 open | n/a |

</frozen-after-approval>

## Code Map

- `ops/estate.md`: Counts (lines 20-170), waypoint table 131-137, stale "undecided" at 141-142 and
  233-235, "Story 3.8 then writes" at 327-334, 369, 399-400, 432-433, 446-448.
- `ops/contract-adoption.mjs:31-34`, `ops/__tests__/contract-adoption.test.ts`: parse the waypoint
  sentence; pinned 13. Comment at test line 54-55 says the next waypoint is eight: stale.
- `ops/tracker-cutover.md:174`: action 4 promises Story 3.8 writes `absorbed_into`.
- `ops/registry-verification.mjs:55`: `GITHUB_SOURCE`, owner/repo only (Story 2.23).
- `contracts/registry.json`: 16 entries, 1.5.0; unchanged.
- `_bmad-output/implementation-artifacts/deferred-work.md`: next id DW-285; DW-275, DW-283.

## Tasks & Acceptance

**Execution:**
- [x] `ops/estate.md`: add `### The end state` after the waypoint sequence; amend the sequence
  table's end-state row and the stale sentences with dated notes; repoint every "Story 3.8 then
  writes" to DW-285.
- [x] `ops/tracker-cutover.md`: repoint action 4's note to DW-285.
- [x] `ops/__tests__/contract-adoption.test.ts`: correct the stale comment (eight to thirteen then ten).
- [x] `deferred-work.md`: file DW-285; dated hand-off notes on DW-275 and DW-283.
- [x] `sprint-status.yaml`: 3-8 row and comment.

**Acceptance Criteria:**
- Given the end-state section, when read, then it names the ten repositories (the Anchor, the seven
  Satellites, `covidmap`, `future-vizion`) with the decision date, the observed 14 with its UTC time,
  and the sequence with dates and reached or not.
- Given the three merged applications, when read, then no `absorbed_into` is claimed and the record
  says why, the Registry keeps 16 entries, and the two counts are stated as deliberately different.
- Given SM-C2, then the section states that the Estate shrinks on purpose and more entries is not better.
- Given the suite, then typecheck, the Hub build and the full unit suite pass, and
  `node ops/registry-verification.mjs` passes on `dev`.

## Implementation Notes

- Implemented inline (no subagent tool in this run). `ops/estate.md` gained `### The end state` after the
  waypoint sentence's amendment, so the sentence `estateNames` parses stays first and unchanged.
- A second sequence table was drafted in the new section and folded back into the existing
  § The waypoint sequence table before review, dating its undated cells instead: one table, not two
  that could drift.
- Observation: `gh api repos/LuigiEspinosa/<name>` for the sixteen governed repositories at
  2026-09-29T17:02:30Z; `curl` of `cuatro-portfolio/tree/main/apps/finance` (404) and `tree/dev/...` (200).
- Story 2.23's job was run locally on `dev` with the Operator's `gh` credential passed through the
  environment, never printed; the log was checked to hold no token.

## Spec Change Log

## Review Triage Log

All six layers were run inline by the builder, which had no subagent tool: Blind Hunter (floor N = min(floor(sqrt(26.4) + 1), 10) = 6), Edge Case Hunter with the claims check, Verification Gap, Ponytail Review, the ECC verification loop and the Design Review. `review_loop_iteration` stayed 0: no finding routed to intent_gap or bad_spec.

| # | Layer | Finding | Verdict | Route and evidence |
|---|---|---|---|---|
| 1 | Blind Hunter, Ponytail | The draft added a second dated sequence table in § The end state beside § The waypoint sequence, two tables that could drift | low | patch, applied before the diff was staged: the existing table's undated cells were dated and the new section points at it |
| 2 | Verification Gap (missing adoption) | `ops/contract-adoption.md:860` still said `ops/estate.md` "already schedules eight", the sibling of the test comment this story corrected | low | patch: now "schedules ten, § The end state" |
| 3 | Blind Hunter | Three repointed bullets in `ops/estate.md` ran past the file's line width ("the Registry change DW-285 describes writes") | low | patch: shortened to "DW-285 writes", matching the table rows |
| 4 | Blind Hunter | DW-285's evidence said "Three records promised", which miscounts: the promise stood in seven places in `ops/estate.md` and in `ops/tracker-cutover.md` action 4 | low | patch: names both records and the count |
| 5 | Blind Hunter | The Counts table's observed 14 still reads "as of 2026-09-26" though the section re-observed it on 2026-09-29 | low | rejected: the cell is true of its date, the re-observation is dated in § The end state, and the file re-dates the observed tables only when an Operator action lands (§ Maintaining this section) |
| 6 | Blind Hunter | Criterion 2 asks that each `source` "still resolves to where the code now lives"; the three still name their own repositories | false | the repositories still hold their code and are active until archived; both resolve (Story 2.23's job, 40 of 40), and the move is DW-285, conditional on the archive as the criterion is |
| 7 | Edge Case Hunter | `estateNames` reads the first `The 13 repositories at this waypoint are ... .` match; a new sentence of that shape ahead of it would change the parse | false | the new section follows the sentence and contains no such phrase; `ops/__tests__/contract-adoption.test.ts` passed 30 of 30 on the final tree |
| 8 | Edge Case Hunter (claims) | Task text says the test comment goes "eight to thirteen then ten"; the comment names ten only | false | 13 is already the pinned waypoint, so the only scheduled move is to ten, which is what the comment and `ops/contract-adoption.md` now say |
| 9 | Verification Gap | Every change is prose or a comment | n/a | "No verification gaps found" for behaviour; the one missing-adoption site is row 2 |
| 10 | Ponytail Review | Remaining diff | n/a | "Lean already. Ship." after row 1 |
| 11 | ECC verification loop | Build, types, tests, security, diff | n/a | PASS: build and typecheck exit 0, 71 files and 1752 tests, lint N/A (no lint command, see AGENTS.md), no credential in the diff |
| 12 | Design Review | No `.scss` or `.tsx` and no motion in the diff | n/a | "No UI surface in this diff. Design review skipped." |

## Design Notes

**Size.** The spec measured about 1,396 tokens (5,582 characters over four) at the plan checkpoint,
inside the SCOPE STANDARD's 1600, so the oversized question did not arise. The multi-goal check found
one goal: the end-state record, with the stale sentences it contradicts amended in the same change.

**Resumed after an interruption.** The run was relaunched after a network outage. The tree was clean
at `c6c5a56` and no Story 3.8 work existed, so it started from the beginning.

**Open Questions, answered from the sources.** Five, answered as Decisions 1 to 5 from `epics.md`
Story 3.8, AD-6 (widened 2026-09-24), PRD SM-7 as amended 2026-09-26 and SM-C2, `ops/estate.md`,
`ops/registry-verification.mjs`, DW-249, DW-275 and DW-283, and a `gh api` observation of all sixteen
governed repositories, per the orchestrator's standing instruction. Each is reversible and is listed
among the Operator items.

**Checkpoint 1.** No human present: the builder reviewed the spec as a second reader against the READY
FOR DEVELOPMENT standard and the story text, checked each criterion has a task and a check, and
approved it.

**Why Decision 3 does not write `absorbed_into` although AD-6 allows intent.** Since 2026-09-24 the
field may record a fold that is only set, and these three folds have in fact happened on `dev`. The
record nonetheless promised, three times, to write it once each repository is archived, the
criterion is conditional on the archive, and the orchestrator's instruction limits archive-dependent
claims to what is true today. Writing it now is a Registry release (`contract_version` bump, the
Suite Directory's data) for no reader gain; DW-285 writes it with the `source` move in one change.

**Independent verifier, 2026-09-29.** It found three stale sentences in § The waypoint sequence ("14 to 8 is the decision", "sits on the second row today, at an observed 12", "heading to 8 regardless") and the merge candidates paragraph's "from 11 to 8", all left unamended by the first pass. Each now carries a dated Story 3-8 amendment naming 10 as the decision, the `After listing` row at an observed 14, 13 as the next station and 13 to 10 for the merge; the parsed waypoint sentence is untouched. A second verifier pass found the dated 2026-09-02 paragraph's "The end state of 8 never moved" unamended; it now carries a Story 3-8 amendment saying the end state moved to 10 on 2026-09-26.

## Closure, 2026-09-29

The one criterion left open, criterion 2's `absorbed_into` and `source` for the three merged
applications, conditional on their archive, is met by DW-285
(`spec-dw-285-absorb-the-three-merged-entries.md`): the Operator archived `cuatro-finance` and
`cs-tournament` at 21:43:05Z and `cuatro-tracker` at 21:53:16Z, and Registry 1.6.0 gives each
`absorbed_into: cuatro-portfolio` and a `source` in the Anchor's `tree/main/apps/<dir>`, which answered
200 anonymously that day. The observed count is 10, the end state this spec recorded as not yet reached;
`ops/estate.md` records it reached, and the board moves 3-8 to `done`.

## Verification

**Commands (final tree, 2026-09-29):**
- `corepack pnpm typecheck`: `> tsc --noEmit`, exit 0.
- `corepack pnpm --filter hub build`: `Compiled successfully in 3.3s`, `Generating static pages using 9 workers (8/8)`, exit 0.
- `corepack pnpm test --run`: `Test Files  71 passed (71)`, `Tests  1752 passed (1752)`, exit 0 (run twice, before and after the review patches, and again after the verifier's fixes).
- `corepack pnpm vitest run ops/__tests__/contract-adoption.test.ts`: `Tests  30 passed (30)`, the waypoint parse of the edited `ops/estate.md`.
- `node ops/registry-verification.mjs` on `dev`, with the Operator's `gh` credential in `REGISTRY_VERIFICATION_TOKEN` (never printed; the log holds no token): exit 0, `# 40 of 40 checks passed` at 2026-09-29T17:08:27Z, among them `PASS  cuatro-finance source resolves: https://github.com/LuigiEspinosa/cuatro-finance answered 200 anonymously`, the same for `cs-tournament` and `cuatro-tracker`, and `PASS  cuatro-tracker live: https://tracker.cuatro.dev answered 307`. Its scheduled run on `main`, 36571142029 at 2026-09-29T12:53:12Z, concluded `success`. The story does not touch the workflow's `push` paths, so no push run of it follows these commits.
- `gh api repos/LuigiEspinosa/<name> --jq '[.name,.visibility,.archived]|@tsv'` for the sixteen governed repositories at 2026-09-29T17:02:30Z: `Lumen` and `tcg-tracker` `public true`; `cs-tracker`, `StreamVault` and `Mutuo` `private false`; the other eleven `public false`. Observed 14.
- `curl -s -o /dev/null -w '%{http_code}'`: `cuatro-portfolio/tree/main/apps/finance` 404, `tree/dev/apps/finance` 200, `tree/main/apps/hub` 404.
