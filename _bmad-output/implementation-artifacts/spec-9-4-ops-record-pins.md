---
title: 'Story 9-4: pin the derived counts in ops records with tests, and re-measure prefetch'
type: 'chore'
created: '2026-10-18'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '5bf8c3d937cb18d04007eb6352016700f6808a01'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-plan-2026-10-18.md'
  - '{project-root}/_bmad-output/implementation-artifacts/dw-triage-2026-10-18.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `ops/hit-target-floor.md` states derived totals no test reads, and they have drifted: the
surfaces table sums to 46, the headline says 41 and § The tolerated breach says 39 (DW-53, DW-54). Its
§ Running it table still carries pre-2-14 counts and ten spec files where there are 24 (DW-59).
Nothing reads `ops/asset-budget.md` back (DW-108), and the homepage prefetch was never re-measured after
Story 2-33 (DW-38).

**Approach:** Derive each stated total from its own table in a Vitest case, correct the prose with dated
amendments, append § Running it rows from three readings of the whole e2e suite in the pinned image, add
a record-reading suite for `ops/asset-budget.md`'s arithmetic, and re-record the `/` prefetch in the
pinned image.

## Boundaries & Constraints

**Always:** dated amendments, never a rewritten reading (both records forbid deletion); every new
assertion planted once; e2e and the prefetch recording only in
`mcr.microsoft.com/playwright:v1.62.1-noble` with volumes `epic-scratch-9-4-ops-record-pins-*`.

**Never:** edit `ops/asset-budget.mjs` or take a new asset-budget reading (that is DW-256's trigger);
add a CI job; touch `deferred-work.md` or `sprint-status.yaml`; touch the box.

</frozen-after-approval>

## Code Map

- `ops/__tests__/hit-target-floor.test.ts`: `recordSurfaces` already parses § The surfaces swept and is held equal to `SURFACES`; add the derived-total cases beside `keeps the arithmetic of the two tables consistent`. Parsers from `ops/contract-adoption.mjs` (`section`, `table`, `cells`).
- `ops/hit-target-floor.md`: headline at the table foot (`**41 elements measured across five surfaces**`), § The tolerated breach lead (`None of the 39`) and `**All 39 since 2026-09-23**`, § Running it figures table.
- `ops/asset-budget.md`: § Every route readings (route table, before/after table, whole-build `Figure` table), § Findings runs (narrative, deferred, non-3D, decomposition lines), § Stated limits rows "A route's figure counts what its document references" (DW-38) and "Nothing gates on the figures", Pending Operator action 5's "latest" figure.
- `ops/__tests__/asset-budget.test.ts`: the tool's suite on scratch trees; left alone.

## Tasks & Acceptance

**Execution:**
- [x] `ops/__tests__/hit-target-floor.test.ts`: the headline total and surface count, both tolerated-breach figures and the newest `Cases in this file` row equal what they derive from: DW-53, DW-54, DW-59
- [x] `ops/hit-target-floor.md`: dated corrections; two § Running it rows from three readings
- [x] `ops/__tests__/asset-budget-record.test.ts`: per reading: delta columns close, after equals the route table, over and margin close against 140,000; per run: the lines close and match the same build's reading: DW-108
- [x] `ops/asset-budget.md`: DW-38's dated re-measurement; the gate row and action 5 amended

**Acceptance Criteria:**
- Given the records as committed, when `corepack pnpm test -- --run` runs, then every new case passes and each failed once on a planted value.
- Given a derived figure edited in one place, when the suite runs, then it fails naming the figure and both values.

## Implementation Notes

Epic 9 has no planning-artifact epic; its plan is the context, so no `epic-9-context.md` was compiled.
No subagent tool was available in this run, so implementation and every review layer ran inline in
the builder session (the house precedent for unattended builds); the Design Review layer is skipped
because the diff touches no `.scss`, no `.tsx` and no motion.

- **Derived figures in `ops/hit-target-floor.md`.** `derivedDisagreements` in
  `ops/__tests__/hit-target-floor.test.ts` derives five figures from the surfaces table (already
  held to `SURFACES`), the exemption ledger and the spec file's `test(` count. The record read 41
  (headline), 39 and 39 (§ The tolerated breach) against a sum of 46; all three are restated with
  dated paragraphs, the older readings kept. The `Cases in this file` row's sweep figure was pinned
  at first and the pin dropped at review: a dated row's element count would turn false on every
  surface change, and the headline already holds the total.
- **§ Running it** gains a `Cases in this file` row (18) and a whole-suite row: three runs of one
  tree in the pinned image with volumes `epic-scratch-9-4-ops-record-pins-nm` and `-next`, after a
  separate warm-up install: 10.7 min / 650.9 s, 10.3 min / 626.8 s, 10.8 min / 659.0 s; 344 tests in
  24 files (`playwright test --list`). Run 2 failed one case, `display-entrance.pw.ts:269`, at the
  60 s timeout with a truncated trace archive, and passed in runs 1 and 3; recorded as such.
- **`ops/__tests__/asset-budget-record.test.ts`** reads every § Every route reading and every
  § Findings run (20 of each). Every row it reads must parse, or it fails naming the part, so
  a reflow cannot pass silently. The whole record is consistent today: no historical figure needed
  a correction.
- **DW-38** re-recorded on build `J6-yUrEUgcvXw3AX_9acr` with a scratch script (not committed)
  in the pinned image: under reduced motion `/` fetches `gsap` (26,971) and a 4,469 chunk beyond its
  document, no WebGL; with motion allowed the hero's own three/R3F/drei (234,534) and
  post-processing (105,244) chunks arrive too. Written as a dated amendment to the § Stated limits
  row.
- **DW-256 did not fire**: no asset-budget reading was taken and `ops/asset-budget.mjs` is unchanged.

### Planted failures

The in-suite controls plant each figure (`fails on each figure edited in one place`). In addition,
both new suites were run once against the records as they stood at `5bf8c3d`, with one `/cv` delta
in the newest reading edited from 37 to 36:

```
+   "the headline total: ops/hit-target-floor.md states 41, the surfaces table derives 46",
+   "the tolerated breach lead: ops/hit-target-floor.md states 39, the surfaces table derives 46",
+   "the count clearing the floor: ops/hit-target-floor.md states 39, the surfaces table derives 46",
+   "ops/hit-target-floor.md: § Running it has 2 \"Cases in this file\" rows dated 2026-09-06, so which is current is not stated",
+   "The 2026-09-25 reading, after the home-hero-rulings package, /cv: 230,424 to 230,461 is 37, the row states 36",
      Tests  5 failed | 23 passed (28)
```

A first planted control for the build's bytes row did not fire (`[\d,]+` matched a lone comma, so
the row was skipped); the amount pattern was fixed, the control then fired, and every row is now
required to parse.

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence and route |
|---|---|---|---|---|
| 1 | edge-case | `readReading` and `checkRun` skipped a row or line they could not parse, so a reflowed figure passed silently | medium | Real: the first bytes-row control passed vacuously. Patched: every unreadable decomposition, narrative-total, bytes row, halves, non-3D and decomposition line now pushes a named disagreement; suite green |
| 2 | verification-gap | Pinning the newest `Cases in this file` row's "measures N elements" turns a dated reading false on every surface change | low | Real and cheap to remove; the headline already holds the total. Patched: pin dropped, the case-count pin kept, the doc comment says so |
| 3 | blind | § Maintaining this file in `ops/hit-target-floor.md` did not say which figures are now held, so the next story meets a failure with no rule beside it | low | Patched: a dated paragraph names the five figures and what a story moving them does |
| 4 | blind | The whole-suite row ran on a tree with this story's uncommitted edits | false | The edits are `ops/**` records, two Vitest files and this spec; no browser spec reads any of them, and the row says so |
| 5 | ponytail | A separate test file for the asset-budget record | false | `asset-budget.test.ts` is the tool's suite on scratch trees and states that it never reads the repository's figures; a record reader beside it mirrors `hit-target-floor.test.ts`. One file, no helper module |
| 6 | verification-loop | Hub build | n/a | Built three times by the e2e runs' `webServer` in the pinned image; the diff touches nothing the build reads. Typecheck exit 0; `corepack pnpm test -- --run` 82 files, 1990 passed, 1 skipped; lint N/A (no lint command, see AGENTS.md) |

## Independent verifier

Pending.

## Ledger closures

**DW-53:** **Closed 2026-10-18 by Story 9-4-ops-record-pins** (`ops/__tests__/hit-target-floor.test.ts:derivedDisagreements`): the headline total under § The surfaces swept, and its surface count, are derived from the record's own surfaces table, which is already held equal to `SURFACES`, and the suite fails naming the figure and both values. The headline read 41 against a table summing to 46 and is restated with a date in `ops/hit-target-floor.md`; the planted run at `5bf8c3d` printed "the headline total: ops/hit-target-floor.md states 41, the surfaces table derives 46".

**DW-54:** **Closed 2026-10-18 by Story 9-4-ops-record-pins** (`ops/__tests__/hit-target-floor.test.ts:derivedDisagreements`): both derived counts in § The tolerated breach, "None of the N measured elements is under the floor" (also failed if the ledger covers any element) and "All N since", are derived in the same case as DW-53's total, which is the fix this entry asked for. Both read 39 against 46 and are restated with dated paragraphs, the 2026-09-23 readings kept.

**DW-59:** **Closed 2026-10-18 by Story 9-4-ops-record-pins** (`ops/hit-target-floor.md` § Running it): two dated rows restate the stale ones from three readings of one tree in `mcr.microsoft.com/playwright:v1.62.1-noble`: `Cases in this file` at 18, and the whole suite at twenty-four spec files and 344 tests, 10.7, 10.3 and 10.8 min (walls 650.9, 626.8 and 659.0 s), one run failing one unrelated case, recorded. The newest `Cases in this file` row is held to the spec file's `test(` count by `derivedDisagreements`; the timing rows stay readings.

**DW-108:** **Closed 2026-10-18 by Story 9-4-ops-record-pins** (`ops/__tests__/asset-budget-record.test.ts`): the record is read back under the blocking `test` job. Every § Every route reading's before and after pairs close on their deltas and equal the route table, and its non-3D line, decomposition, narrative total and build bytes close; every § Findings run's halves make its narrative total, its distance to the estimate's top and both budget lines close, and its figures equal the reading of the same `BUILD_ID`. Every row it reads must parse. All 20 readings and 20 runs are consistent today. Holding the figures to a build still needs a build and stays a hand re-run, as `ops/asset-budget.md` § Stated limits now says.

**DW-38:** **Closed 2026-10-18 by Story 9-4-ops-record-pins** (`ops/asset-budget.md` § Stated limits, the prefetch row): re-measured in the pinned image on build `J6-yUrEUgcvXw3AX_9acr` by the entry's own method. Under reduced motion a prefetch from `/` (of `/`, `/celeste` and `/work`) pulls `gsap` (26,971 gzipped) and one 4,469 chunk beyond the document, and no WebGL chunk; with motion allowed, the three/R3F/drei and post-processing chunks that arrive are `/`'s own hero boundary. The § Stated limits line exists and carries the dated re-measurement.

**DW-256:** not closed: its trigger did not fire (no asset-budget reading taken, `ops/asset-budget.mjs` unchanged).

Action items: none named for this story.

## Verification

**Commands:**
- `corepack pnpm test -- --run`: expected: green, about 1845 plus the new cases
- `corepack pnpm typecheck`: expected: exit 0
