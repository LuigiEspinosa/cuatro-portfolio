---
title: 'Story 9-2: land the process rules where Build and workflows read them'
type: 'chore'
created: '2026-10-18'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-plan-2026-10-18.md'
  - '{project-root}/_bmad-output/implementation-artifacts/dw-triage-2026-10-18.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Nine retrospective process rules (Epic 2 actions 10 to 14, Epic 5 actions 51 and 52, Epic 8
actions 60 and 61) are practiced or remembered but written nowhere Build or a workflow reads them
(`dw-triage-2026-10-18.md` § action items). Action 14 is reworded by the Operator ruling of 2026-10-18: no new
deferred-work entries in the sprint-completion run.

**Approach:** Per `epic-9-plan-2026-10-18.md` § 2: actions 10, 13, 51, 52 and 60 go in a new AGENTS.md section,
"Process rules from retrospectives", outside the `bmad:context` managed block; actions 11, 12, 14 and 61 go in
`_bmad/custom/bmad-build.toml` `persistent_facts`, with a verifier line in `on_complete` for 11. One test holds
both places. The 2-27 reconcile half of action 10 waits on Q-item-10 and is not in this story.

</frozen-after-approval>

## Implementation Notes

- Base `5bf8c3d937cb18d04007eb6352016700f6808a01` (`origin/dev`).
- `AGENTS.md`: new section after § Dependency automation policy, five bullets, 22 lines. The managed block is
  untouched. The plan placed 51 "next to the box-block rule" and 52 "extending the image-workflow pitfall"; both
  of those sit inside the managed block, so both went into the new section, as the plan's § 2 preamble requires.
- `_bmad/custom/bmad-build.toml`: four facts after the oversized-spec fact; the header comment dates them;
  `on_complete` gains the verifier sentence. `uv run _bmad/scripts/resolve_customization.py --skill <bmad-build>
  --key workflow` resolves nine persistent facts in order, the four new ones included, and an `on_complete` with
  the verifier sentence. The rendered workflow for this run carried the old facts (rendered before the edit).
- The fact for action 14 reads every step text that appends to `deferred-work.md` (multi-goal split, token-count
  split, review defer) as the findings-for-Operator report. It binds while Epic 9 is open; a dated Operator
  ruling lifts it.
- `ops/__tests__/process-rules.test.ts` (new, root suite, `ci.yml` `test` job, no new job): `AGENTS.md states
  each one after the managed block`, `bmad-build.toml carries each one as a persistent fact, and on_complete asks
  for the verifier`, and the synthetic case `refuses a section moved inside the managed block, and a fact moved
  out of the array`. No job-name pin or `contracts/` listing moves.
- The rule text for action 13 gave a `file:N` example at first; this story's own diff would then have failed
  the plan's proof grep, so it says "a citation by line number" instead.
- `sprint-status.yaml` and `deferred-work.md` are not edited here (the push step applies the rows below). The
  bmad-build sprint-sync steps were skipped for the same reason.
- Not done: the optional estate-wide copy of action 60 in `~/.ai-dev/standard/` is outside this repository.

### Planted failures

Each was planted on a copy, the suite run, the file restored byte for byte (`git diff --stat` after each):

| Assertion | Plant | Output |
|---|---|---|
| AGENTS.md rule list | `(Epic 5 action 51)` to `(Epic 5 item 51)` | `AssertionError: expected [ Array(1) ] to deeply equal []` |
| section after the marker | heading demoted to `###` | `AssertionError: no "## Process rules from retrospectives" after <!-- /bmad:context -->: expected '' not to be ''` |
| toml fact list | `"""Planted assertions` to `"""Planted asserts` | `AssertionError: expected [ Array(1) ] to deeply equal []` |
| `on_complete` verifier line | sentence removed and the phrase moved to a comment after `on_complete` | `AssertionError: expected '\non_complete = """\nInvoke the agen...' to contain 'whether an independent verifier has r...'` |
| synthetic: block order | `processSection` order check removed | `AssertionError: expected '## Process rules from retrospectives...' to be ''` |
| synthetic: array end | `persistentFacts` slices to end of file | `AssertionError: expected '\npersistent_facts = [\n  """f""",\n]...' not to contain '"""g"""'` |

### Verification

- `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test -- --run`: 82 files, 1985 passed, 1 skipped, 1 failed: `ops/tracker-backup.test.ts` `refuses
  a dump pg_restore cannot list`, output `'\u0000'` (DW-135's WSL stall). Re-run alone: 11 passed.
- `vitest --run ops/__tests__/process-rules.test.ts ops/__tests__/contract-adoption.test.ts`: 33 passed (the
  dependency-policy pin still reads its section).

## Review Triage Log

- Blind Hunter: not run. This sub-agent has no tool to launch a context-free reviewer, so the layer fell to the
  independent verifier. Inline checks only: no em-dash, en-dash or double-dash in the diff, and no
  `file:N` citation added.

## Ledger closures

No DW entry closes here. DW-247 stays open as the owner of the line-citation backfill (plan § 4).

Action item comments (status `in-progress`; a later story proves each, then it closes):

- epic-2-retro-item-10: `# 2026-10-18: rule landed in AGENTS.md § Process rules from retrospectives (Story 9-2); the 2-27 reconcile waits on Q-item-10; proved by the next retro's grep for a done row that waits on the Operator.`
- epic-2-retro-item-11: `# 2026-10-18: rule landed in _bmad/custom/bmad-build.toml persistent_facts (Independent verifier) and on_complete (Story 9-2); proved by each Epic 9 spec naming a separate verifier run.`
- epic-2-retro-item-12: `# 2026-10-18: rule landed in _bmad/custom/bmad-build.toml persistent_facts (Planted assertions) (Story 9-2); proved by each later Epic 9 spec recording one planted failure per new assertion.`
- epic-2-retro-item-13: `# 2026-10-18: rule landed in AGENTS.md § Process rules from retrospectives (Story 9-2); proved by later Epic 9 diffs adding no file:N citation; backfill stays with DW-247.`
- epic-2-retro-item-14: `# 2026-10-18: reworded rule (Operator ruling 2026-10-18) landed in _bmad/custom/bmad-build.toml persistent_facts (No new deferred work) (Story 9-2); proved by deferred-work.md gaining no entry during Epic 9.`
- epic-5-retro-item-51: `# 2026-10-18: rule landed in AGENTS.md § Process rules from retrospectives (Story 9-2); proved by 9-22, 9-23, 9-24, 9-25, 9-30 and 9-32 editing the runbook's § Later rollouts in the same commit.`
- epic-5-retro-item-52: `# 2026-10-18: rule landed in AGENTS.md § Process rules from retrospectives (Story 9-2); proved by the dated rows of 9-22 and 9-25 naming each workflow and the sha.`
- epic-8-retro-item-60: `# 2026-10-18: rule landed in AGENTS.md § Process rules from retrospectives (Story 9-2); proved by the push times of 9-16, 9-22 and 9-23 falling after their rulings.`
- epic-8-retro-item-61: `# 2026-10-18: rule landed in _bmad/custom/bmad-build.toml persistent_facts (Open inferences) (Story 9-2); proved by each later spec listing its I-n readings with ruling dates before the dependent commit.`

## Independent verifier

pending
