---
title: 'Story 9-0: re-home the trigger-not-met deferred-work entries'
type: 'chore'
created: '2026-10-18'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-9-plan-2026-10-18.md', '{project-root}/_bmad-output/implementation-artifacts/dw-triage-2026-10-18.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The 2026-10-18 triage marked 50 deferred-work entries `trigger-not-met` (48 in § 3 of the Epic 9 plan,
plus DW-75 and DW-140 from the triage table). Each waits in a 10,800-line ledger on an event that some other record
owns, so the story that fires a trigger has to find the entry first, and nobody reads the ledger before that event.

**Approach:** For each entry, one of three outcomes. (a) An Epic 9 story in the plan fires its trigger: name that
story, leave the entry open. (b) Otherwise, close it, and move its trigger verbatim into the `ops/` record that owns
the event, under a dated `## Standing triggers` section that names the DW id. (c) The fix is cheap, repo-only and on
the ops records surface: fix it. The spec's § Ledger closures holds each closing paragraph, which the push step
applies to the ledger.

**Acceptance Criteria:**
- Given each of the 50 entries, when read against this spec, then it is listed as (a) with its story, closed as (b)
  with its record, fixed as (c), or left open untouched with the reason (Operator-deferred, in the Operator question
  table, or with no owning `ops/` record). That last group goes to the Operator.
- Given each record that gains a closure, when read, then its `## Standing triggers` section carries a 2026-10-18 line
  naming the DW id and quoting the ledger's trigger. Where the ledger has no trigger line, it quotes the plan's § 3
  wording and says so.
- Given the root suite and the typecheck, when run, then both are green (WSL-bash flakes re-run per DW-135).

**Boundaries:** documentation only (`ops/*.md` and this spec). No edit to `deferred-work.md` or `sprint-status.yaml`,
no new ledger entry, no push, no box step. Records are edited with the Edit tool only.

</frozen-after-approval>

## Implementation Notes

Worktree `C:\CuatroEcosystem\epic9-wt\9-0-rehome-trigger-entries`, branch `epic9/9-0-rehome-trigger-entries`, from
`origin/dev` `5bf8c3d`, rebased on 2026-10-18 onto `origin/dev` `2e59b57` (which carries `b668c5c`'s rulings) for the
round 1 fix. Route `oneshot`: no intent gap, nothing irreversible, documentation only. The SCOPE
STANDARD's token check belongs to the dispatch route and was not reached. The intent above is about 600 tokens;
§ Ledger closures is output for the push step, not plan.

**Read.** Each of the 50 entries in full (the triage's `trigger-not-met` gate, all three ledger formats), the plan's
§§ 1, 3 and 4, and the triage rows. Repository-side triggers were checked against `git log` at `5bf8c3d` (for
example `ops/deploy-remote.sh` last `b3b72d6`, `ops/capacity-sampler.sh` last `6caac0b`, and no `anchor-umami`
change since DW-316 was filed). None has fired.

**Outcomes (50).**
- (b) closed into a record, 36: DW-24, DW-25, DW-78, DW-86, DW-89, DW-99, DW-102, DW-111, DW-112, DW-132,
  DW-175, DW-176, DW-177, DW-240, DW-264, DW-265, DW-267, DW-268, DW-269, DW-271, DW-304, DW-316, DW-328, DW-336, DW-337, DW-342, DW-344, DW-345, DW-349, DW-353, DW-354, DW-355, DW-356, DW-357, DW-359, DW-362.
- (a) named in an Epic 9 story, left open, 8: DW-256 (9-4: its first asset-budget reading, DW-38), DW-317 (9-26:
  the `cs-tracker` compose change), DW-360 (9-23: the viewer's footer copy; check it there), DW-318
  (9-36-backup-job-reporting, which `b668c5c` opened for DW-193 and DW-315: it changes each backup job and
  re-installs the scripts and cron, so it meets "the next change to any backup script"), and DW-170, DW-288, DW-291
  and DW-292 (9-40-per-id-deploy, which `b668c5c` opened for DW-275 and which that ruling says closes DW-291 and
  DW-292). 9-40 wires the tracker and the tournament into a per-id deploy, so it places ids through the deploy, which
  is DW-170's trigger in the triage, "Next new id or DW-275 wiring" (the gate call at a real placement), and it brings the first `docker
  rollout` of `tournament`, which is DW-288's trigger (its owner is "the story that wires the tournament into a deploy
  (DW-275)"). All four stay open for 9-40 on the same reasoning.
- Closed by `b668c5c`, not this story, 1: DW-75 (Operator ruling 2026-10-18, won't fix). It was in the Operator
  question table when this spec was first written on `5bf8c3d`.
- Left open untouched, in the Operator question table, 1: DW-120 (named in item-5's ruled closer, a KV row the story
  that takes item-5 writes).
- Left open, no `ops/` record owns the event, 4: DW-140 (`EXPERIENCE.md` § Chrome), DW-245 (PRD § 5.1), DW-246
  (footer line and `ESTATE_LANGUAGES`, written by `EXPERIENCE.md` § UI strings), DW-241 (Build's ledger templates).
  The first three are spine edits the Operator owns, and the fourth needs a ruling. Each goes to the Operator. DW-140
  is not in the plan's § 3 at all.
- (c) fixed: none. No entry's fix is on the records surface alone.

**Files.** A `## Standing triggers` section before `## Pending Operator actions` in each of 17 records:
`asset-budget`, `backup-digital-library`, `bot-mitigation`, `capacity-measurement`, `contract-serving`,
`cs-tracker-accessibility-pass`, `demo-principal`, `estate`, `font-contract`, `hub-accessibility-pass`,
`identity-issuer`, `postgres`, `registry-verification`, `rendered-output-harness`, `restyle-floor`, `token-contract`,
`visitor-instrumentation`. (The first build also gave `capacity-threshold`, `postgres-backup` and
`tournament-placement` one line each, for DW-170, DW-318 and DW-288; the round 1 fix moved those three to (a) and
removed the sections.)
Each quotes the ledger's trigger. For DW-24, DW-25, DW-175, DW-176 and DW-177, the ledger has no trigger
line, so the plan's § 3 wording is quoted and the line says so.

**Choices.** DW-78 went to `bot-mitigation.md`, since no record mentions `robots.txt` and that record owns crawler
policy. DW-316 went to `postgres.md`, which holds the paused-database heartbeat rehearsal. DW-102 is (b) and
not (a): 9-16's forced regeneration may meet it but is not certain to, and the standing line names that story.
DW-318, first written as (b) on the same reasoning, is (a): `b668c5c` opened 9-36, whose re-install of every backup
script does meet its trigger.

**Tests.** No assertion was added, so there was nothing to plant. Root suite, first run: `Test Files 4 failed | 77
passed (81)`, `Tests 6 failed | 1977 passed | 1 skipped (1984)`. The failures were in the WSL-bash suites (DW-135),
for example `tracker-backup.test.ts` "refuses a dump pg_restore cannot list": `expected '\u0000' to contain
'list=unreadable'`. The whole suite was re-run: `Test Files 81 passed (81)`, `Tests 1983 passed | 1 skipped
(1984)`. `corepack pnpm typecheck`: exit 0.

**Review.** No subagent tool was available in this run, so Blind Hunter did not run. An inline pass re-checked every
path and symbol the new lines cite. It caught one wrong path (`cs-tracker-accessibility-pass.mjs` for
`cs-tracker-accessibility-probe.mjs`), which was fixed, and found no dash or emoji in an added line. The independent
verifier is still to run.

**Not done.** `sprint-status.yaml` sync and the ledger edits are the push step's work, as this task requires.

## Ledger closures

Each paragraph goes at the end of its entry's evidence (or its `reason:`, for the `### DW-n` format), and the
entry's `status:` moves to `done`.

- **DW-24**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/asset-budget.md` § Standing triggers):
  the triage of 2026-10-18 found the trigger not met. The entry has no trigger line, so the Epic 9 plan's § 3
  wording ("A face is deleted on the reachability word, a family is defined under a selector, or the `font`
  shorthand names a family") moved to that record, with the work, dated and naming DW-24.
- **DW-25**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/asset-budget.md` § Standing triggers):
  trigger not met (no workflow runs the tool). The plan's § 3 wording ("asset-budget goes into CI, or its runtime
  becomes noticeable") moved to that record, dated and naming DW-25. Story 9-4 meets it if it makes CI run the tool.
- **DW-78**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/bot-mitigation.md` § Standing
  triggers): trigger not met. "The first story that adds a `robots.txt`, a sitemap or a `robots` directive anywhere
  but `/celeste`" moved verbatim to that record, dated and naming DW-78.
- **DW-86**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/registry-verification.md` § Standing
  triggers): trigger not met (expiry 2026-12-11). The trigger moved verbatim beside action 6, with the plan's lead
  (rotate by about 2026-12-04), dated and naming DW-86. Action 6 stays `_not done_` until the rotation.
- **DW-89**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/visitor-instrumentation.md` § Standing
  triggers): trigger not met (no SM-3 reading recorded). The trigger moved verbatim, dated and naming DW-89.
- **DW-99**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/asset-budget.md` § Standing triggers):
  trigger not met (`apps/hub/app/layout.tsx` last changed by the move in `bc9cd25`). The trigger moved verbatim,
  with the measurement that has to come before any preload, dated and naming DW-99.
- **DW-102**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/rendered-output-harness.md` § Standing
  triggers): the `threshold` question's trigger, "the next baseline change the comparator measures as none", is not
  met. It moved verbatim beside § Regenerating the baseline, dated and naming DW-102 and Story 9-16's possible
  forced regeneration.
- **DW-111**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/hub-accessibility-pass.md` § Standing
  triggers): trigger not met. It moved verbatim, dated and naming DW-111. The Operator's screen-reader read of `/`
  does not meet it.
- **DW-112**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/hub-accessibility-pass.md` § Standing
  triggers): trigger not met (shared with DW-111). It moved verbatim with the repair's shape, dated and naming DW-112.
- **DW-132**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/backup-digital-library.md` § Standing
  triggers): trigger not met. "The next time the passphrase is verified or rotated" moved verbatim with the closer,
  dated and naming DW-132. The owner is still the Operator.
- **DW-175**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/capacity-measurement.md` § Standing
  triggers): trigger not met. The plan's § 3 wording ("The next measurement week (2027-02-25 review)") moved there
  with the `note`-row closer, dated and naming DW-175.
- **DW-176**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/capacity-measurement.md` § Standing
  triggers): the sampler is unchanged since `6caac0b`. The plan's § 3 wording ("Next sampler edit") moved there with
  the `flock` closer, alongside DW-175, dated and naming DW-176.
- **DW-177**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/capacity-measurement.md` § Standing
  triggers): trigger not met. The plan's § 3 wording ("The next measurement week") moved there with the install-time
  assertion, dated and naming DW-177.
- **DW-240**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/font-contract.md` § Standing
  triggers): trigger not met (no fonts or token contract release since 2026-09-25). It moved verbatim with the
  Operator's two shapes, dated and naming DW-240.
- **DW-264**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/contract-serving.md` § Standing
  triggers): `ops/deploy-remote.sh` is unchanged since `b3b72d6`. "The next edit to `ops/deploy-remote.sh`" moved
  verbatim with the hand-over closer, dated and naming DW-264.
- **DW-265**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/contract-serving.md` § Standing
  triggers): no Deploy run has timed out, and the report job is unchanged since `b3b72d6`. The trigger moved
  verbatim with the throwaway-run closer, dated and naming DW-265.
- **DW-267**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/estate.md` § Standing triggers):
  finance is not placed. The trigger moved verbatim, dated and naming DW-267, beside the three other finance
  placement entries.
- **DW-268**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/estate.md` § Standing triggers): no
  placement story and no Prisma upgrade. The trigger moved verbatim, dated and naming DW-268.
- **DW-269**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/estate.md` § Standing triggers): no
  AD-9 decision to place finance. The trigger moved verbatim, dated and naming DW-269. The line says this entry's
  list predates Epic 4 and is to be read against Traefik and the estate Postgres.
- **DW-271**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/estate.md` § Standing triggers): no
  placement story and no lint gate. The trigger moved verbatim, dated and naming DW-271.
- **DW-304**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/token-contract.md` § Standing
  triggers): trigger not met (npm's latest glob read 13.0.6 on 2026-10-18, per the triage). It moved verbatim,
  dated and naming DW-304. An override still needs its own ruling.
- **DW-316**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/postgres.md` § Standing triggers): no
  change to `anchor-umami` since the entry was filed. The trigger moved verbatim with the closer, dated and naming
  DW-316.
- **DW-328**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/identity-issuer.md` § Standing
  triggers): trigger not met. It moved verbatim, dated and naming DW-328.
- **DW-336**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/registry-verification.md` § Standing
  triggers): no demo release yet. "The first demo release (action 9)" and the Operator's ruling of 2026-10-06 moved
  there, dated and naming DW-336.
- **DW-337**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/demo-principal.md` § Standing
  triggers): no OIDC story for `digital-library` is scheduled. "That story's rollout" moved verbatim with its four
  steps, including the `demo-reset.schedule` flip, dated and naming DW-337.
- **DW-342**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/cs-tracker-accessibility-pass.md`
  § Standing triggers): no AD-19 re-run since Story 8.1. "Before that re-run" moved verbatim with the port's seed,
  dated and naming DW-342 and Story 9-25's Hex bump as a possible trigger.
- **DW-344**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/restyle-floor.md` § Standing
  triggers): trigger not met. It moved verbatim, dated and naming DW-344.
- **DW-345**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/restyle-floor.md` § Standing
  triggers): trigger not met. It moved verbatim, dated and naming DW-345.
- **DW-349**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/restyle-floor.md` § Standing
  triggers): trigger not met. It moved verbatim, dated and naming DW-349.
- **DW-353**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/restyle-floor.md` § Standing
  triggers): trigger not met. It moved verbatim, dated and naming DW-353.
- **DW-354**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/restyle-floor.md` § Standing
  triggers): trigger not met. It moved verbatim with the `motion-reduce` closer, dated and naming DW-354.
- **DW-355**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/restyle-floor.md` § Standing
  triggers): trigger not met. It moved verbatim with the `@source not inline` closer, dated and naming DW-355.
- **DW-356**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/restyle-floor.md` § Standing
  triggers): the trigger as restated on 2026-10-17 is not met. It moved verbatim, dated and naming DW-356.
- **DW-357**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/restyle-floor.md` § Standing
  triggers): R18 stands as ruled. The trigger moved verbatim, dated and naming DW-357.
- **DW-359**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/restyle-floor.md` § Standing
  triggers): trigger not met. It moved verbatim, dated and naming DW-359 and Story 9-22 as the story to check.
- **DW-362**: **Closed 2026-10-18 by Story 9-0-rehome-trigger-entries** (`ops/restyle-floor.md` § Standing
  triggers): no Tailwind bump. The trigger moved verbatim, dated and naming DW-362.

**Stay open (no closing paragraph):** DW-256 (9-4), DW-317 (9-26), DW-360 (9-23), DW-318 (9-36) and DW-170, DW-288,
DW-291 and DW-292 (9-40), each named in an Epic 9 story; DW-120 (Operator question table, item-5); DW-140, DW-241,
DW-245 and DW-246 (no owning record; for the Operator).

**Already closed elsewhere:** DW-75, closed by `b668c5c` (Operator ruling 2026-10-18, won't fix). This story writes
nothing for it.

**Action items:** none in this story's scope.

## Verification

**Independent verifier, round 1:** four findings, all fixed. (1) The branch was behind `origin/dev`, and the spec
still listed DW-75 as open in the Operator question table, though `b668c5c` closed it: rebased, and DW-75 now reads
as closed by `b668c5c`. (2) DW-318 was (b), though `b668c5c` opened 9-36, which fires its trigger: moved to (a) under
9-36, its closing paragraph and its `postgres-backup.md` standing line removed. (3) DW-170 and DW-288 were (b), though
the same 9-40 that holds DW-291 and DW-292 open fires both: moved to (a) under 9-40, their closing paragraphs and the
`capacity-threshold.md` and `tournament-placement.md` standing lines removed. (4) The DW-288 line cited a § Later
rollouts that does not exist: removed with that line. The three records now match `origin/dev`. Round 2: pending.
