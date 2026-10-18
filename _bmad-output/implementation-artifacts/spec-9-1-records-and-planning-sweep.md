---
title: 'Story 9-1: correct stale records and planning lines'
type: 'chore'
created: '2026-10-18'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-plan-2026-10-18.md'
  - '{project-root}/_bmad-output/implementation-artifacts/dw-triage-2026-10-18.md'
  - '{project-root}/_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-15.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Five records still state as present fact something that stopped being true: `ops/registry-verification.md`
counts four KV-2 private repositories and describes pins with none struck (DW-139); `ops/capacity-measurement.md`
resolves the AD-8 violation through "Story 1-9" rather than the register (DW-180); three records cite the deleted
`content/projects.ts` with no note that it is gone (DW-211); `ops/estate.md` § Pending Operator actions reads as if
`connect-four-react`'s archive were outstanding, under an observed table dated 2026-09-02 (DW-286); and `epics.md`'s
Epic 2 header gives the pre-restyle counts and migration placement (epic-2 retro action 6).

**Approach:** Correct each named line in place with a dated amendment note (2026-10-18, Story 9-1), without quoting the
stale wording back, so a grep for each stale string finds nothing; re-observe the GitHub archive state for DW-286 by
`gh repo list`; follow `sprint-change-proposal-2026-08-15.md` § 7.3 and `AGENTS.md` for item 6. Documentation only.
DW-136, DW-137, DW-138 and DW-242 are out of scope (await a ruling).

</frozen-after-approval>

## Implementation Notes

Route oneshot: no intent gap, nothing irreversible, seven Markdown files. Every correction rewrites the stale
sentence to the present fact and appends `**Amended 2026-10-18 by Story 9-1** (DW-n)`, describing the old wording
rather than quoting it, so the grep below stays empty. Dated observations and earlier dated amendments are left as
written (DW-211's own principle: a record of what was observed on a date is evidence).

- **DW-139**, `ops/registry-verification.md` § Sources tolerated to answer 404 anonymously: the opening now counts
  three tolerated links with the `cs-tournament` row struck, and § How a row is struck names the suite's real pins
  (`KV2_TABLE`, `STRUCK`, `PRIVATE` in `ops/__tests__/registry-verification.test.ts`, read 2026-10-18). The
  `AGENTS.md` and `ops/contract-adoption.md` policy halves were already closed (`2974ceb`, `ad52501`); the
  remaining "four private" lines in `contract-adoption.md` sit under its dated 2026-08-27 observations and carry
  2026-09-25 amendments, so they stay.
- **DW-180**, `ops/capacity-measurement.md` § stated limits, the `deploy.yml` bullet: the pointer is KV-1 in
  `ops/known-violations.md`, with a note that KV-1's Anchor half retired 2026-09-29T20:41:37Z. The other copies
  are in done specs (1-6, 1-9, 1-21), historical, untouched.
- **DW-211**: a trailing retirement note (Story 2-7, `ba9526d`, the deletion commit by `git log --diff-filter=D`) on
  `ops/backup-digital-library.md` § The store (two rows), `CHANGELOG.md` 2.2.0, and the three
  `portfolio-architecture-guide.docx.md` mentions. Citations themselves are not rewritten, as the entry asks.
- **DW-286**, `ops/estate.md`: the Pending Operator actions intro and the `connect-four-react` row (Done
  2026-09-29T21:43:05Z, as § The end state already recorded), the waypoint paragraph, the disposition intro, the
  2026-09-02 reading's "whoever performs" sentence, and a new § Observed GitHub state, 2026-10-18 from
  `gh repo list LuigiEspinosa --limit 100 --json name,visibility,isArchived` at 2026-10-18T20:20:21Z (32 listed; of
  the sixteen governed, ten not archived, six archived, all archived ones public, three private).
- **epic-2 item 6**, `epics.md` Epic 2 header: thirty-one stories (31 `2-*` keys in `sprint-status.yaml`), twenty
  FRs (the epic's own FRs-covered list), and the steps as shipped per `AGENTS.md` and
  `sprint-change-proposal-2026-08-15.md` § 7.3 and § Deleted outright. The rewritten sentence drops the old
  en-dash ranges, which this repository's prose rule forbids in new text.
- No test assertion was added: the story is records only and no suite reads the edited sentences
  (`ESTATE_SENTENCE` in `ops/contract-adoption.mjs` reads a different estate.md sentence, untouched), so there is no
  planted failure to record.
- Review: subagents are not available in this run, so the Blind Hunter layer ran inline as an adversarial self-read
  of the diff, not as a separate agent. One finding patched (item 6: "carry no key" named no file, now
  `sprint-status.yaml`). The independent verifier is the workflow's separate run.

## Ledger closures

- **DW-139:** **Closed 2026-10-18 by Story 9-1-records-and-planning-sweep** (`ops/registry-verification.md` § Sources
  tolerated to answer 404 anonymously): the section's opening counts three tolerated links (`cs-tracker`,
  `StreamVault`, `Mutuo`) with the `cs-tournament` row struck since 2026-09-24, and § How a row is struck names the
  suite's pins as they are (`KV2_TABLE` every row, `STRUCK` the struck ones, the fixture's 404 for `PRIVATE`), each
  with a dated amendment. The `AGENTS.md` and `ops/contract-adoption.md` halves closed earlier (`2974ceb`,
  `ad52501`); the remaining four-count lines in `contract-adoption.md` are dated 2026-08-27 readings, already
  amended, and stay as evidence.
- **DW-180:** **Closed 2026-10-18 by Story 9-1-records-and-planning-sweep** (`ops/capacity-measurement.md`, the
  `deploy.yml` stated limit): the AD-8 violation resolves to KV-1 in `ops/known-violations.md`, with a dated note that
  KV-1's Anchor half retired 2026-09-29T20:41:37Z. The `AGENTS.md` half closed at `967abfd`.
- **DW-211:** **Closed 2026-10-18 by Story 9-1-records-and-planning-sweep** (`ops/backup-digital-library.md` § The
  store, `CHANGELOG.md` 2.2.0, `portfolio-architecture-guide.docx.md`): each mention of `content/projects.ts` carries a
  trailing dated note that Story 2-7 retired it (`ba9526d`) and where the data lives now (`contracts/registry.json`);
  the observations themselves are not rewritten.
- **DW-286:** **Closed 2026-10-18 by Story 9-1-records-and-planning-sweep** (`ops/estate.md` § Pending Operator
  actions and § Observed GitHub state, 2026-10-18): the intro reads no archive outstanding, the `connect-four-react`
  row is dated Done 2026-09-29T21:43:05Z, the waypoint and disposition sentences carry dated amendments, and the
  observed state was re-gathered by `gh repo list` at 2026-10-18T20:20:21Z: ten governed repositories not archived,
  the end state of 10.
- **epic-2-retro-item-6-correct-epics-md-2005-2010-to-thirty-one:** done 2026-10-18 by Story 9-1: `epics.md` Epic 2
  header reads thirty-one stories, twenty FRs and the migration steps as shipped, with a dated amendment citing
  `sprint-change-proposal-2026-08-15.md` § 7.3.

## Verification

**Commands, run 2026-10-18 in this worktree:**
- Stale-string grep, `grep -n -F` per string, each 0 lines: `records four Registry`, `still runs on all four`,
  `with none struck`, `exactly those four` (`ops/registry-verification.md`); `tracked in Story 1-9`
  (`ops/capacity-measurement.md`); every `projects\.ts` line in `ops/backup-digital-library.md`, `CHANGELOG.md` and
  `portfolio-architecture-guide.docx.md` without `Story 2-7`; `` only `connect-four-react` is outstanding ``,
  `single outstanding action`, `` `connect-four-react` is not yet ``, `Whoever performs the remaining`,
  `| Must stay publicly readable |` (`ops/estate.md`); `Twenty-six stories`, `nineteen FRs`, `Stories 2.18–2.22`
  (`epics.md`).
- Added lines: 0 em-dashes, en-dashes, dash-standing double-dashes or emoji (`git diff -U0`, read by `node`).
- `corepack pnpm test -- --run`: `Test Files 5 failed | 76 passed (81)`, `Tests 5 failed | 1978 passed | 1 skipped
  (1984)`, 393 s. All five failures are DW-135 WSL-bash files, one case each at about 30 s; alone: `demo-reset`
  30/30, `library-backup` 59/59, `postgres-backup` 20 passed 1 skipped, `tournament-backup` 15/15, `tracker-backup`
  11/11.
- `corepack pnpm typecheck`: exit 0.

**Independent verifier:** PASS on round 1, 2026-10-18, separate agent; tests: at 1dd4d1c, `corepack pnpm typecheck`
exit 0; `corepack pnpm test -- --run` 81 files (78 passed, 3 failed), 1984 tests (1980 passed, 3 failed, 1 skipped), the
three failures DW-135 WSL-bash files (`demo-reset`, `library-backup`, `postgres-backup`), which re-run alone passed 3 of
3 files, 109 tests passed and 1 skipped. Plant check: changing the `cs-tournament` KV-2 Ruling in
`ops/registry-verification.md` from struck to published failed one `registry-verification.test.ts` case; restored, the
registry-verification, contract-adoption and ops-record-titles suites passed 113 of 113. Every stale-string grep
returned 0 hits outside the historical artifacts; `gh repo list` re-observation matched the new `ops/estate.md` table
(sixteen governed: 10 not archived, 6 archived, all archived public, 3 private); facts checked against their sources;
diff hygiene clean (no edit to `deferred-work.md`, `sprint-status.yaml`, `contracts/` or `ci.yml`, line 1 of every ops
record unchanged, no forbidden punctuation in added prose). No container e2e: no rendered output changed.
