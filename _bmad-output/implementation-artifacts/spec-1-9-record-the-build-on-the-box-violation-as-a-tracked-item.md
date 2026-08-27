---
title: 'Record the build-on-the-box violation as a tracked item'
type: 'chore'
created: '2026-08-18'
status: 'done'
baseline_commit: '6caac0bc686355fded2181ad9c26a58ec867747e'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/.github/workflows/deploy.yml'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** The estate's top unmeasured risk, a serving two-core box that compiles, is real today and written down nowhere an Operator would look for a violation. `.github/workflows/deploy.yml:56` runs `docker compose --env-file .env.production up --build -d --remove-orphans` over SSH, AD-8 calls that a standing violation until Epic 3, and the only traces are a pitfall line inside the machine-managed `bmad:context` block, one table row in `ops/routing-inventory.md`, and prose in planning documents nobody deploys from. There is no violations register under `ops/`, so a tolerated breach is indistinguishable from an unnoticed one.

**Approach:** Create `ops/known-violations.md`, a register in the shape `ops/estate.md` and `ops/monitoring.md` already set, carrying one entry: the AD-8 breach, its citation, why it is tolerated rather than fixed now, its live interaction with the capacity measurement week running until 2026-08-24T21:00Z, and the two "Hetzner" naming claims with the story that owns each. The violation is recorded, never fixed.

## Boundaries & Constraints

**Always:**
- Every value is marked as a decision or an observation, and the two are never presented as the same kind of fact (NFR-9).
- The record states what is true on 2026-08-18, not what `epics.md` described on 2026-08-16. Story 1-21 repointed `SERVER_HOST` and renamed the deploy step on 2026-08-17, so a record repeating the story's original framing would be wrong on the day it lands.
- Citations are verified against the working tree at `6caac0b` and carry file and line, rather than being quoted from a planning document.
- Dates are ISO 8601 UTC.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash, and no emoji. The commit is a subject line only, no body and no trailer.

**Ask First:**
- Before recording any violation other than AD-8. `deferred-work.md` holds several `deploy.yml` hazards (no `concurrency` group, CI not blocking the deploy, `placements` self-serve). Which of those are violations rather than deferred work is the Operator's call, not this story's.
- Before asking for a merge freeze on `main`. This story records that a deploy distorts the measurement week and names the options; choosing one is an Operator decision.

**Never:**
- Never edit `.github/workflows/deploy.yml`. Recording a violation is not fixing it, and AD-8 puts the fix in Epic 3 behind GHCR images that do not exist yet.
- Never edit `content/projects.ts`. The stale `Hetzner VPS` value is FR-9's, corrected in Epic 2.
- Never edit the `bmad:context` block in `AGENTS.md` by hand. Its pitfall line already names this story and is replaced by a `/bmad-project-context` refresh.
- Never touch the box, the running sampler, `ops/capacity-gate.yml`, or `ops/capacity-measurement.md`.
- Never state that the step name "Deploy to Hetzner" or the deploy-into-the-decommissioned-box hazard is still live. Both were closed on 2026-08-17.

</frozen-after-approval>

## Code Map

Gathered 2026-08-18 against `6caac0b`, working tree clean apart from the sprint board.

- `.github/workflows/deploy.yml:56` -- the offending line, `docker compose --env-file .env.production up --build -d --remove-orphans`, inside the `appleboy/ssh-action` step. **The step at `:45` is now named "Deploy over SSH to SERVER_HOST"**, not "Deploy to Hetzner": Story 1-21 renamed it. `:4-5` is the `push: [main]` trigger, which is what makes any merge a deploy.
- `ARCHITECTURE-SPINE.md:124-128` -- AD-8, including the closing sentence naming `deploy.yml` a standing violation until Epic 3. `:435` is C-8, the same fact as a contradiction between every document and the running system.
- `epics.md:1435-1475` -- Story 1.9's four ACs. `:3927-3929` is Story 3.4, which retires the violation. `:109-114` is FR-9, narrowed to exactly one stale value. `:725` tracks C-8.
- `content/projects.ts:30` -- `'Hetzner VPS'` in `digital-library`'s `tech` array. The surviving half of the naming question, Epic 2's to correct.
- `ops/routing-inventory.md:153-179` -- "Where the deploy actually goes": `SERVER_HOST` repointed to `177.7.52.248` on 2026-08-17, and a deploy-mechanism row that already says "tracked in Story 1-9". The prose below it owns the separate stale-`main` hazard, which the register cites rather than restates.
- `ops/capacity-measurement.md:331-336` -- already states a merge compiles Next.js on the two cores being measured and that close-out must say whether a build fell inside the week. `:239` bounds the window: close-out on or after 2026-08-24T21:00Z. Week confirmed live 2026-08-18T02:24Z, timer `active`, `Result=success`, 5138 rows.
- `AGENTS.md:78-81` -- the existing pitfall line, inside the `bmad:context` markers at `:1` and `:114`. Read-only here.
- `ops/monitoring.md`, `ops/estate.md`, `ops/bot-mitigation.md` -- the conventions to follow: a provenance line naming story and date, tables with a `Nature` column, dated amendment paragraphs.

## Tasks & Acceptance

**Execution:**
- [x] `ops/known-violations.md` -- create the register. A short preamble stating what belongs here and what belongs in `deferred-work.md` instead, then one entry, `KV-1: the serving box compiles`, covering: the rule breached and its citation; the offending file and line; the risk in the words research used; why it is tolerated rather than fixed now (fixing it early builds the CI-to-GHCR path twice, once against today's single-app layout and once after the Epic 3 merge); what retires it and when; the measurement-week interaction with its mitigation options and its end date; and the naming question, both halves, each against its owning story.
- [x] `ops/routing-inventory.md` -- add a pointer naming `ops/known-violations.md` as where the AD-8 breach is now tracked. A register nobody can reach from the file they are already reading is not a tracked item. **Amended during review:** the pointer sits *above* the "Where the deploy actually goes" heading, not below the table as first written, because that section's own closing line expires it when Epic 1 reaches `main` while KV-1 stays open until Epic 3. See Spec Change Log finding 5.

**Acceptance Criteria:**
- Given AD-8 names the current deploy a standing violation, when `ops/known-violations.md` is read, then it names the violation, cites `.github/workflows/deploy.yml` and the exact line that carries `--build`, names AD-8 as the rule breached and Epic 3's Story 3.4 as what retires it, and records why it is tolerated now rather than fixed.
- Given the capacity measurement week runs until 2026-08-24T21:00Z on the same two cores a deploy would compile on, when the record is read, then it states that a deploy during the week distorts the readings, names the mitigation as either avoiding a merge to `main` before that date or annotating the affected readings, and cites the close-out obligation in `ops/capacity-measurement.md` rather than restating it.
- Given Story 1-21 repointed `SERVER_HOST` and renamed the deploy step on 2026-08-17, when the record describes the naming question, then it states that resolved outcome with its date, records that the hazard of deploying into the decommissioned box is closed, and names `content/projects.ts:30` as the one surviving stale Hetzner claim against FR-9 in Epic 2.
- Given recording a violation is not fixing it, when the story closes, then `.github/workflows/deploy.yml`, `content/projects.ts` and `AGENTS.md` are byte-identical to `6caac0b`.

## Spec Change Log

### Review findings, 2026-08-18

Three review layers ran against the diff. No finding reached the frozen block and none was a
spec-level defect: the intent, boundaries and acceptance criteria all held, so nothing was
reverted or re-derived. Eighteen findings were caused by this change and fixed in place
(`4049ef3`). Two were real but belong to no story yet and went to `deferred-work.md`. One was
rejected.

**1. The record claimed the measurement week would measure the thing it is designed to exclude.**
The entry said the top unmeasured risk "is unmeasured, not unmeasurable: the measurement week
below is what would measure it". The week measures serving, and both mitigations in the same
entry exist precisely to keep a build out of its readings, as does `ops/capacity-measurement.md`
under "What this week will not claim". The sentence was wrong, and wrong in the direction that
matters: it implied the estate is about to learn what a build costs, when nothing scheduled will
ever tell it. The entry now states the cost stays unmeasured after close-out and names what would
actually measure it, a deliberate timed build outside the window, which no story has scheduled.

**2. A reader of the entry alone would have concluded that merging to `main` costs a compile
minute.** It costs far more. `ops/routing-inventory.md:177-187` records that the box's checkout
carries `docker-compose.yml` and `docker/Dockerfile` modified in place while the corrected
versions sit on `dev`, and `deploy.yml:55` runs `git reset --hard origin/main` before the compose
line, so a deploy from `origin/main` as it stands would discard those files, recreate the
shared-network name collisions and contend for the ports `cs-tracker-caddy-1` holds. The blast
radius is the whole estate. The register cited that hazard only obliquely, inside a mitigation,
which made avoiding a merge read as a measurement-week concern expiring 2026-08-24. It is
load-bearing for the estate-wide reason first, and it expires when Epic 1 reaches `main`, not
when the window closes. Both facts now sit where the cost of merging is stated.

**3. The register adjudicated another story's status against the board.** It asserted "Story 1-5
is awaiting the week rather than done" while `sprint-status.yaml:71` reads `done`. The claim was
inherited from `ops/capacity-measurement.md` and restated as a decision without checking the
board, so the file landed carrying a fact contradicted by a file in the same change set. It now
reports both readings with attribution and settles neither, because another story's status is not
this entry's to decide.

**4. The file demanded of every entry two things it did not do for its own.** Its admission tests
require a recorded ruling that the breach may continue, and it recorded none for KV-1, dating the
`Status` cell 2026-08-18, which is when the register was written rather than when anything was
ruled. Test 3 also required a named retiring story, which made a tolerated breach with no
scheduled fix impossible to admit, and that is exactly the case the opening paragraph exists to
catch. `Ruled by` and `Ruled on` now record that the ruling is AD-8's own standing-violation
sentence dated 2026-08-15, distinct from `Opened: 2026-08-18`, and no Operator act is invented.
Test 3 admits `Retired by: unassigned`.

**5. The pointer added to make the register findable sat inside a section that expires first.**
`ops/routing-inventory.md` closes the deploy section with "When Epic 1 closes and `dev` reaches
`main` ... this whole section expires". KV-1 stays open until Epic 3, so the pointer would have
been deleted while the thing it points at was still live, defeating the task it existed for. The
pointer moved above the heading and says that it outlives the section. This is a deliberate
deviation from the task's original wording, "below the table", which is amended above rather than
left contradicting the file.

**6. Story 3-4 was given an obligation with nowhere to discharge it.** `epics.md:3962-3965` makes
it an acceptance criterion of that story that this file records KV-1 "as closed with an ISO 8601
UTC date, rather than having the entry silently deleted". The register had no `Retired on` cell,
no status vocabulary, and duplicated `Status` across an index row, the entry table and
`routing-inventory.md` with none marked derived. Story 3-4 would have had to invent the edit and
would plausibly have updated one copy of three. There is now an explicit two-word vocabulary,
`Opened` and `Retired on` columns, and both copies marked as derived from the entry.

**7. Citations into a file scheduled to be rewritten were pinned to line numbers alone.** The
close-out procedure pastes a generated summary block into `ops/capacity-measurement.md`, which
moves everything below the paste, so `:331-336` and `:349` were guaranteed to drift within the
week. Those citations now lead with a heading and a row description and give the dated line
number second, and the file carries a paragraph on what to do when one stops landing.

**8. Smaller fixes.** "Every merge to `main` is a deploy" ignored the blocking Capacity Gate at
`deploy.yml:30-31`, which can refuse a merge before anything reaches the box. The window test was
start time rather than overlap, so a build straddling 2026-08-24T21:00Z would have contaminated
the last samples while the mitigation read as satisfied. `epics.md:725` was cited as naming this
file and does not; `epics.md:1449` does. The live-week observation carried no Nature marker and
no method. The entry never stated its scope, though AD-8 binds every deployed application and the
three Satellites deploy from repositories this one cannot read. Story ids were written both
hyphenated and dotted for the same story. And the file carried neither the "Maintaining this
file" section nor the "Pending Operator actions" table every sibling record under `ops/` has,
while handing the Operator two untracked decisions; both now exist, and the actions table also
carries Story 3-4's retirement and the close-out's section-expiry marking.

**9. Deferred, not fixed here.** `anchor-umami` carries no healthcheck while `anchor-app` and
`anchor-db` do, which is a second live AD-8 breach, and `ARCHITECTURE-SPINE.md:128` asserts the
opposite is already true. It was deliberately not admitted as KV-2, because by this file's own
tests an entry needs a ruling and no story has taken one. Separately, `AGENTS.md:80` and
`ops/capacity-measurement.md:332` still resolve the violation through the string "Story 1-9"
rather than the register, which follows from this spec's own boundaries rather than being an
oversight, since both files are off limits here.

**10. Rejected, with reason.** A reviewer read the `ops/routing-inventory.md:24-29` citation as
supporting "the machine serving all six live hostnames" and argued it should point at `:35-36`.
The cell it annotates is "The box at `177.7.52.248`, 2 vCPU", which `:24-29` carries exactly. A
second layer independently re-read the same citation and found it lands. Left alone.

**11. One process deviation, recorded rather than hidden.** The workflow requires all three review
layers to be launched before any of their output is read, so triage is not anchored by whichever
returns first. I launched them one at a time and read each result before launching the next,
which is the same deviation Story 1-5 recorded as its finding 15 and a worse instance of it. The
strongest findings were raised independently by more than one layer, and the third layer
contradicted the first on the one citation listed above and was believed on the evidence rather
than on order, so the anchoring risk appears not to have bitten. It is recorded because the
control against it is the ordering, not the outcome.

**12. The punctuation sweep failed vacuously on its first run, exactly as Story 1-5 predicted.**
The pattern used `\u{1F300}` syntax, which .NET rejects, so `Select-String` errored on every file
while the script still printed `0` for each. The positive control caught it by also reporting
zero. Rebuilt on surrogate-pair ranges, the control fires 4 of 4 and the register returns 0 on
all four forbidden forms. Story 1-5 recorded this same trap as its finding 5 and it was repeated
anyway, which suggests the sweep belongs in a committed script rather than in each story's shell
history.

## Design Notes

**Why a register rather than a line in an existing record.** The breach is stated in four places and tracked in none: a pitfall line a `/bmad-project-context` refresh rewrites, a table cell about deploy targets, an architecture document, and an epics file. None is where an Operator looks to ask what is knowingly broken right now. Epic 2 and Epic 3 each inherit part of this file, so it needs a stable name and a shape a second entry can join without restructuring.

**Why the story's own ACs are partly historical.** `epics.md:1460-1472` was written on 2026-08-16, when the step read "Deploy to Hetzner" and `SERVER_HOST` pointed at the box being decommissioned. Story 1-21 closed both on 2026-08-17. The honest record of the naming question is that resolution plus the one claim that survives, not a re-narration of a hazard that no longer exists. The live hazard has moved: the deploy now reaches the box the measurement week is running on, a sharper version of the same risk, and that is what the entry leads with.

## Verification

**Commands:**
- `git diff --stat 6caac0b -- .github/workflows/deploy.yml content/projects.ts AGENTS.md`. Expected: empty output.
- `corepack pnpm test --run`. Expected: the suite at `6caac0b`, unchanged and passing. No code is touched.
- `corepack pnpm typecheck`. Expected: pass.
- Punctuation sweep over every file written, using regex escapes rather than literal characters, run against a positive control carrying all three forbidden forms so it cannot pass vacuously (the trap recorded in `spec-1-5`, finding 5).

**Manual checks:**
- Re-read `.github/workflows/deploy.yml` at the moment of writing and confirm the cited line number still lands on the `docker compose` line, since a citation that drifts is worse than none.
- Confirm every date in the record is ISO 8601 UTC and that each entry line is marked observation or decision.

## Suggested Review Order

**What the register is, and the rules it holds itself to**

- Start here. Why a tolerated breach and an unnoticed one need different files.
  [`known-violations.md:3`](../../ops/known-violations.md#L3)

- The three admission tests. Test 3 admits `unassigned`, so an unscheduled breach cannot fall out.
  [`known-violations.md:24`](../../ops/known-violations.md#L24)

- A ruling is not the date it was written down. This distinction is the file's whole point.
  [`known-violations.md:28`](../../ops/known-violations.md#L28)

- The index is a copy, not the source. One place to edit when a status changes.
  [`known-violations.md:55`](../../ops/known-violations.md#L55)

**KV-1, and the two things a reader could get wrong**

- Scope stated before anything else: the Anchor's workflow, nothing claimed about the Satellites.
  [`known-violations.md:68`](../../ops/known-violations.md#L68)

- The breach itself, and why `--build` alone is it.
  [`known-violations.md:77`](../../ops/known-violations.md#L77)

- The risk stays unmeasured after the week closes. The week measures serving, deliberately.
  [`known-violations.md:80`](../../ops/known-violations.md#L80)

- The ruling is AD-8's own sentence, dated 2026-08-15. No Operator act was invented.
  [`known-violations.md:83`](../../ops/known-violations.md#L83)

- The compile is the smaller half. A merge today would reset the box onto a stale compose file.
  [`known-violations.md:104`](../../ops/known-violations.md#L104)

**The parts written to survive the people who wrote them**

- This section expires 2026-08-24T21:00Z, and says so rather than reading as live forever.
  [`known-violations.md:120`](../../ops/known-violations.md#L120)

- Contamination is overlap, not start time. A build straddling the boundary still counts.
  [`known-violations.md:133`](../../ops/known-violations.md#L133)

- Headings first, dated line numbers second, because the close-out rewrites that file.
  [`known-violations.md:138`](../../ops/known-violations.md#L138)

- `Retired on`, which `epics.md:3962-3965` makes Story 3-4 fill rather than delete the entry.
  [`known-violations.md:87`](../../ops/known-violations.md#L87)

- Four Operator decisions the file is not entitled to take, tracked instead of left in prose.
  [`known-violations.md:188`](../../ops/known-violations.md#L188)

- How a drifted citation is amended. Deletion is never the answer.
  [`known-violations.md:202`](../../ops/known-violations.md#L202)

**Peripherals**

- The pointer sits above the section on purpose: that section expires first, KV-1 does not.
  [`routing-inventory.md:153`](../../ops/routing-inventory.md#L153)

- The deploy-mechanism cell now says its status is derived, naming the one place to edit.
  [`routing-inventory.md:168`](../../ops/routing-inventory.md#L168)
