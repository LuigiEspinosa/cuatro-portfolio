---
title: 'DW-285: absorb the three merged entries into the Anchor, and close Story 3.8'
type: 'feature'
created: '2026-09-29'
status: 'done'
baseline_commit: '8dde81a5e2164d53db20271d07a225fddd212198'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/ops/estate.md'
  - '{project-root}/ops/registry-verification.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** `cuatro-finance`, `cuatro-tracker` and `cs-tournament` are merged into the Anchor and
their repositories archived (observed 10 at 2026-09-29T21:53:16Z), but their Registry entries carry no
`absorbed_into`, their `source` names the frozen repositories, Story 2.23's job refuses any
`tree/...` source, and every estate pin still reads 13. Story 3-8 waits on exactly this.

**Approach:** One Registry MINOR release (1.6.0) giving the three entries `absorbed_into:
cuatro-portfolio` and `source: https://github.com/LuigiEspinosa/cuatro-portfolio/tree/main/apps/<dir>`
(the Operator's ruling of 2026-09-29 in DW-285); widen `GITHUB_SOURCE` and `source exists` so a
`tree/<branch>/<path>` URL is accepted and its path proven to exist on that branch; move the estate
sentence, `ESTATE_COUNT` and both `ops/contract-adoption.md` tables to 10; amend every record that
promised this; close DW-285 and Story 3-8.

## Boundaries & Constraints

**Always:** `<dir>` is the real workspace directory, `finance`, `tracker`, `tournament` (DW-285 names
these three paths; the Registry ids differ). `status`, `live`, `demo`, `tech` of the three do not move.
Records take dated amendments, history stays as written. Every gate stays as strict: a github.com
source of any other shape still fails `source exists` by name.

**Never:** touch the schema (its `source` pattern and `absorbed_into` already admit the values), any
other file under `contracts/`, `deploy.yml`, the capacity gate, application code; push; place or
archive anything.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tree source present | `.../cuatro-portfolio/tree/main/apps/finance` | `repos/<slug>` 200, then `contents/apps/finance?ref=main` 200: one PASS naming path and branch | n/a |
| Path absent on branch | contents answers 404 | `source exists` FAIL naming path and branch | by name |
| Contents unreachable | 5xx twice, 401/403, network error | FAIL naming the answer | by name |
| Other shapes | `tree/main` (no path), `.git`, query, fragment, `.` or `..` segment | still refused by `GITHUB_SOURCE` | unchanged message |
| Estate parse | edited `ops/estate.md` | 10 names | suite fails otherwise |

</frozen-after-approval>

## Code Map

- `contracts/registry.json`: entries `cuatro-tracker` (l.17), `cs-tournament` (l.53), `cuatro-finance` (l.96); `contract_version` 1.5.0.
- `ops/registry-verification.mjs:55` `GITHUB_SOURCE`; `checkEntry` source-exists block; `repositoryName` (keys `vendoredTarget` on the last path segment; a tree source yields its directory, which no adoption row names, so a `token_contract` on one fails closed).
- `ops/__tests__/registry-verification.test.ts`: `routesForCommittedRegistry` (l.147), 40-rows and 40-calls pins (l.235-296, calls become 43, `/contents/` calls 4), shapes case (l.500).
- `ops/registry-verification.md:36` source-exists row, `:59` expected-count row.
- `ops/registry-schema.md:193` version history; `ops/__tests__/registry-schema.test.ts:265` version pin.
- `ops/contract-adoption.mjs:27-34` `ESTATE_COUNT`, `ESTATE_SENTENCE`; `ops/__tests__/contract-adoption.test.ts` 13 pins (l.190-275, l.416 comment); `ops/contract-adoption.md` rows 72-74 and 292-294, "thirteen" prose at 28, 61, 234, 305-319.
- `ops/estate.md`: Counts cell l.29, sentence l.175, § The end state l.184-244, disposition table l.293-295, DW-285 promises l.137, 154, 196, 221, 242, 414, 450, 489, 522, 535-537.
- `ops/tracker-cutover.md:263` action 4. `deferred-work.md:8779` DW-285. `sprint-status.yaml:780-804`. `spec-3-8-...md` Verification.
- Hub: `apps/hub/lib/registry.ts` renders by `status` only, so the Suite Directory is unaffected.

## Tasks & Acceptance

**Execution:**
- [x] `contracts/registry.json`: three entries and version 1.6.0, the release.
- [x] `ops/registry-verification.mjs`: optional `/tree/<branch>/<path>` groups (no dot segments), contents probe on the named branch, `repositoryName` left on the last segment; the widened check.
- [x] `ops/__tests__/registry-verification.test.ts`: fixture plants the contents route, pins moved, cases for pass, absent path, unreachable and refused shapes (matrix coverage).
- [x] `ops/registry-verification.md`, `ops/registry-schema.md`, `ops/__tests__/registry-schema.test.ts`: dated amendments, pin to 1.6.0.
- [x] `ops/contract-adoption.mjs`, its test, `ops/contract-adoption.md`: 10, three rows out of each table with a dated note.
- [x] `ops/estate.md`, `ops/tracker-cutover.md`: sentence, counts, end state reached, promises dated done.
- [x] `deferred-work.md`, `sprint-status.yaml`, the 3-8 spec: DW-285 closed, 3-8 done.

**Acceptance Criteria:**
- Given the committed Registry, when the suite's planted run executes, then 40 of 40 rows pass and the three tree sources are probed through `contents` on `main`.
- Given the edited records, when the full suite runs, then it passes with the estate at 10 and the version at 1.6.0.
- Given typecheck, the Hub build and the full suite, then each exits 0, output quoted below.

## Implementation Notes

- Implemented inline (no subagent tool in this run). Planning said `repositoryName` should take the
  repository group; implementing it keyed the three absorbed entries on the Anchor's adoption row
  (`contracts/tokens.css`), which the suite's `vendoredTarget` case caught. Reverted to the last
  segment, which fails a `token_contract` on a tree source as "no recorded target" (fail closed); a
  case holds it. Code Map and task amended to match.
- The contents probe sends `Accept: application/vnd.github+json` and no encoding: `GITHUB_SOURCE`
  admits only `[A-Za-z0-9_.-]` segments. A 401 or 403 names the secret, as the token check does.
- `ops/contract-adoption.md` says deletion is not used; the parse requires each table to name exactly
  the estate, so the three rows were removed and a dated paragraph beside each table keeps their last
  observation, with the full text at `8dde81a`. The maintenance paragraph records the exception.
- Not touched, beyond scope: the `connect-four-react` row of `ops/estate.md` § Pending Operator actions
  (archived 21:43:05Z, not struck by the commit that recorded it) and the observed-state table that
  section says to re-gather after an archive. Filed as DW-286.

## Spec Change Log

## Review Triage Log

All six layers were run inline by the builder, which had no subagent tool: Blind Hunter (floor N = min(floor(sqrt(98.1) + 1), 10) = 10), Edge Case Hunter with the claims check, Verification Gap, Ponytail Review, the ECC verification loop and the Design Review. `review_loop_iteration` stayed 0: no finding routed to intent_gap or bad_spec.

| # | Layer | Finding | Verdict | Route and evidence |
|---|---|---|---|---|
| 1 | Blind Hunter | The contents probe's 200 body is never read | false | the existing anonymous `source resolves` GET leaves its body unread the same way; Node releases it on collection, and a run makes 43 requests |
| 2 | Blind Hunter | A branch holding a slash (`tree/feat/x/y`) is read as branch `feat` and path `x/y` | low | rejected: fails closed as absent, no Registry source has one, and the doc comment and the record say a slashed branch is not accepted |
| 3 | Blind Hunter | A `tree` URL naming a file passes, the contents call answering 200 for a file too | low | rejected: the path does exist, GitHub redirects such a URL to `blob` (3xx, resolves), and no Registry source names a file |
| 4 | Blind Hunter | `repos/LuigiEspinosa/cuatro-portfolio` is fetched four times per run | low | rejected: four authenticated calls in 43, no rate-limit exposure |
| 5 | Blind Hunter | DW-285's closure read "failing by name on 404, 401 or 403, and anything else" | low | patch applied: names each outcome |
| 6 | Blind Hunter | `ops/estate.md` § Pending Operator actions still says only `connect-four-react` is outstanding, the row unstruck, the observed table of 2026-09-02 not re-gathered | medium | defer: pre-existing since `2a4ca40`; filed DW-286 |
| 7 | Blind Hunter | The schema's `source` description says "The repository URL" while three sources are tree URLs | low | rejected: the pattern admits them, `absorbed_into`'s description says `source` names where the code sits today, and a description edit is a schema change the spec keeps out; listed for the Operator |
| 8 | Blind Hunter | `estateNames` errors still say "at the waypoint" beside a sentence that says "at the end state" | low | rejected: the end state is the sequence's last waypoint, and the message stays true |
| 9 | Blind Hunter | `ops/registry-verification.md` says the three absorbed entries are the only tree sources, which a later entry would make stale | low | rejected: true today and dated, the record's convention |
| 10 | Blind Hunter | The spec's task lines used a double-dash as a dash, against the writing rule | low | patch applied before review closed: colons and parentheses |
| 11 | Edge Case Hunter | Every branch of the tree probe: repository absent (no probe), 200, 404, 401, 403, 5xx twice, network error twice | false | each is handled and has a case in `ops/__tests__/registry-verification.test.ts` § a tree source; call sites checked against `contents(slug, path, ref)` and `answered({ response, error })` |
| 12 | Edge Case Hunter (claims) | "Records take dated amendments, history stays as written" against three rows removed from both `ops/contract-adoption.md` tables | false | the parse requires each table to name exactly the estate (`assertEstateCovered`); a dated paragraph beside each table keeps the rows' last observation and the maintenance paragraph records the exception |
| 13 | Edge Case Hunter (deletion) | The removed `repositoryName`-from-match change and the removed owner/repo-only regex | false | `repositoryName` is unchanged from baseline; the old shape is a strict subset of the new, and every previously refused shape but the tree one is still refused, held by the shapes case |
| 14 | Verification Gap | Changed behaviour: `GITHUB_SOURCE`, `source exists` on a tree, the Registry values, `ESTATE_COUNT` | n/a | "No verification gaps found": each is asserted by a running case (planted committed-Registry run, the tree cases, the schema gate, the adoption suite); no other module reads a Registry `source` shape (searched `GITHUB_SOURCE` and `.source` under `ops/`, `packages/`, `apps/hub`) |
| 15 | Ponytail Review | Remaining diff | n/a | "Lean already. Ship.": the dot-segment guards are the one extra, and they stop `fetch` normalising a source into another URL |
| 16 | ECC verification loop | Build, types, tests, security, diff | n/a | PASS: Hub build exit 0, typecheck exit 0, 71 files and 1758 tests, lint N/A (no lint command, see AGENTS.md), no credential and no em-dash, en-dash or double-dash dash in the added lines |
| 17 | Design Review | No `.scss` or `.tsx` and no motion in the diff | n/a | "No UI surface in this diff. Design review skipped." |

## Design Notes

**Size.** About 1,435 tokens (5,738 characters over four) at the plan checkpoint, inside the SCOPE
STANDARD's 1600, so the oversized question did not arise and no Keep was needed. One goal: the
Registry release DW-285 describes, with the job change it cannot pass without and the pins that move
with the count.

**Open Questions, answered from the records.** None remained. The `source` shape is the Operator's
ruling of 2026-09-29 recorded in DW-285; `apps/<id>` there is read as the workspace directory, because
DW-285 itself names `apps/finance`, `apps/tracker` and `apps/tournament` and the Registry ids
(`cuatro-finance`, `cuatro-tracker`, `cs-tournament`) name no directory on `main`. The schema is left
alone: its `source` pattern admits a path and `absorbed_into` says `source` names where the code sits
today, which the tree URL now does.

**Checkpoint 1.** No human present (orchestrated run relaying the Operator's instruction of 2026-09-29
to finish Epic 3): the builder reviewed the spec against READY FOR DEVELOPMENT and approved it.

## Verification

**Commands (final tree, 2026-09-29):**
- `corepack pnpm typecheck`: `> tsc --noEmit`, exit 0.
- `corepack pnpm --filter hub build`: `Compiled successfully in 3.4s`, `Generating static pages using 9 workers (8/8) in 737ms`, exit 0.
- `corepack pnpm test --run`: `Test Files  71 passed (71)`, `Tests  1758 passed (1758)`, exit 0 (run before and after the review patches; 1752 at the baseline, six cases added).
- `corepack pnpm vitest run ops/__tests__/registry-verification.test.ts`: `Tests  61 passed (61)`; `ops/__tests__/contract-adoption.test.ts`: `Tests  30 passed (30)`.
- `node ops/registry-verification.mjs` on `dev`, the Operator's `gh` credential in `REGISTRY_VERIFICATION_TOKEN` for the one run (never printed; the log holds no token), at about 2026-09-29T22:10Z: exit 0, `# 40 of 40 checks passed`, among them `PASS  cuatro-finance source exists: LuigiEspinosa/cuatro-portfolio answered 200 authenticated, default branch main, and LuigiEspinosa/cuatro-portfolio:apps/finance@main answered 200`, the same for `apps/tracker` and `apps/tournament`, and `PASS  cuatro-finance source resolves: https://github.com/LuigiEspinosa/cuatro-portfolio/tree/main/apps/finance answered 200 anonymously`, likewise for the other two.
- `curl -s -o /dev/null -w '%{http_code}'` of `cuatro-portfolio/tree/main/apps/{finance,tracker,tournament}`: 200 each, `apps/nope` 404; `api.github.com/repos/LuigiEspinosa/cuatro-portfolio/contents/apps/finance?ref=main` 200, `apps/nope` 404, `ref=no-such-branch` 404.
- Not run: the rendered-output suite (host-unportable; the diff changes only an `href` value the Suite Directory renders), and the push run of `registry-verification.yml`, since nothing is pushed.
