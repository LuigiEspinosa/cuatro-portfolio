---
title: 'Write the Capacity Gate threshold and open the gate'
type: 'feature'
created: '2026-08-25'
status: 'done'
baseline_revision: '309fd2a54454d75da15719dbbac6015d4865e061'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/ops/capacity-gate.yml'
  - '{project-root}/ops/capacity-measurement.md'
warnings: ['oversized']
deferred:
  - summary: >-
      The threshold's shape rule has a floor and no ceiling, so a typo opens the gate
      against a line the box could never reach.
    evidence: |-
      `ops/capacity-gate.mjs` refuses an open gate whose threshold is empty, names no
      load15 figure, or names zero, but accepts `load15 60` or `load15 9999`. A figure
      typed with a misplaced decimal opens the gate against nothing, which is the same
      failure `ops/capacity-threshold.md` rejects the PRD's provisional 1.4 for: a line
      the estate cannot reach is a formality rather than a gate. The natural ceiling is
      the box's runnable core count, and the gate records no core count: `on 2 vCPU`
      sits inside the `threshold` prose and AD-9's seven-key contract has no room for an
      eighth key to hold it. Closing this needs a decision about where the core count
      lives, which is why it is not closed here.
    location: >-
      ops/capacity-gate.mjs
    severity: medium
  - summary: >-
      Nothing compares the box's live load against the threshold, and the file-level
      comparison that replaced it is enforced on a surface that does not hold a deploy.
    evidence: |-
      This story closed half of the Story 1-4 ledger entry that reads "`status: open`
      means yes to every id, and nothing ever compares `reading` against `threshold`":
      `evaluate` now refuses a new id when the gate's own recorded baseline has reached
      its own recorded threshold. The other half stands. `.github/workflows/deploy.yml`
      runs the checker on a GitHub runner with no view of `177.7.52.248`, so an estate
      that drifts past the line goes on deploying until someone re-measures by hand and
      edits the file. The unit test that pins the two figures apart runs in `ci.yml`,
      and `deferred-work.md` already records that `ci.yml` and `deploy.yml` both fire on
      a push to `main` with no `needs` and no required checks, so its red does not hold
      a deploy either. A live comparison needs a sampler reachable from the call site,
      which does not exist in any epic yet.
    location: >-
      ops/capacity-gate.mjs
    severity: medium
---

<intent-contract>

## Intent

**Problem:** The measurement week closed on 2026-08-25 and filled `measured_at`, `baseline` and
`reading`, but `ops/capacity-gate.yml` still carries `threshold:` empty and `status: blocked`, so
AD-17c refuses every new application id: `list-wheel` in Epic 2 and every id placed in Epic 4. The
gate is also weaker than it reads. `ops/capacity-gate.mjs` validates `threshold` only as a
non-empty string, so `threshold: banana` would open it, and the review of Story 1-4 assigned this
story the question of what a threshold is allowed to be.

**Approach:** Derive one 15-minute load-average figure from the week's own numbers, reserving
headroom costed from observed analogues for `list-wheel` and `cs-tournament`, write it into
`threshold`, and move `status` to `open` because the measured baseline sits far below it. Record
the derivation in `ops/capacity-threshold.md` so a later reader can re-check it or overturn it, and
teach the reader to refuse an `open` gate whose threshold carries no load15 figure, so the gate
still fails closed on a threshold nobody could act on.

## Boundaries & Constraints

**Always:**
- The threshold is derived from `ops/capacity-measurement.md` and from nothing else. Every figure in
  the new record is marked **observed** or **decided/derived** and the two are never presented as the
  same kind of fact (NFR-9).
- The gate keeps exactly its seven keys, one level of nesting, and one-line scalars. `threshold` must
  parse through `ops/capacity-gate.mjs` unchanged in shape.
- Dates are ISO 8601 UTC. Today is 2026-08-25 UTC.
- Every CI gate stays blocking (AD-21). The new refusal is demonstrated failing by a test that stays,
  in the pattern Story 1-4 set with its planted probe.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash, and no
  emoji. The commit is a subject line only, no body and no trailer.

**Block If:**
- The derivation lands with the measured baseline at or above any defensible threshold. Then the gate
  stays `blocked` and the overflow path is invoked, which is a new recurring charge and therefore an
  Operator decision under NFR-4, not an unattended one.

**Never:**
- Never change `measured_at`, `baseline`, `reading`, `overflow` or `placements`. Story 1-5 measured
  them and this story reads them.
- Never rewrite the week's observed figures, and never trim or restate them to fit a nicer number.
- Never make `evaluate` sample the box. Nothing at the call site reads live load, so a comparison
  against a live reading would be a claim the code cannot keep. Record the limit instead.
- Never touch the box, the sampler, the units, or `.github/workflows/deploy.yml`'s SSH step.
- Never claim a rendered-output or browser check. Playwright arrives in Story 1-10.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| New id against the opened gate | committed gate, `status: open`, id `list-wheel` | exit 0, message names the written threshold | N/A |
| Incumbent id | committed gate, id `cuatro-portfolio` | exit 0, message names `placements` | N/A |
| New id against a blocked gate | synthetic gate, `status: blocked` | exit 1, `REFUSED`, naming the gate path, the blocked status and the overflow | Refusal, the AD-21 probe |
| Open on an unreadable threshold | `status: open`, `threshold: banana` | refused at parse, message names load15 and AD-9 | `GateError`, fails closed |
| Open on an empty threshold | `status: open`, `threshold:` | refused at parse, unchanged from Story 1-4 | `GateError` |
| Threshold written, gate blocked | `status: blocked`, threshold present | new id refused, incumbent passes | Refusal, not an error |
| Threshold with a load15 figure of zero | `status: open`, `threshold: load15 0` | refused: zero is not a capacity line | `GateError` |

</intent-contract>

## Code Map

- `ops/capacity-gate.yml:23-27` -- the five scalars. `measured_at`, `baseline` and `reading` are
  filled by Story 1-5's close-out and are read-only here. This story writes `threshold:` (line 25)
  and `status:` (line 27). The header comment at `:18-21` announces what Story 1-6 will do and needs
  rewriting into what it did.
- `ops/capacity-gate.mjs:179-181` -- the one existing threshold rule: `open` with an empty threshold
  is refused. The shape check belongs beside it, reading the same `gate.threshold`.
- `ops/capacity-gate.mjs:25` -- `SCALAR_KEYS`. `threshold` is a scalar, so the value stays on one
  line and may not contain `#` (`:69`).
- `ops/capacity-gate.mjs:198-221` -- `evaluate`. Open passes any id (`:205`), an id in `placements`
  passes regardless (`:202`), and the refusal text at `:216` says "Story 1-6 writes the threshold and
  opens the gate. Until then", which stops being true the moment this story lands.
- `ops/__tests__/capacity-gate.test.ts:54` -- asserts the committed gate is `blocked` with an empty
  `threshold`. This story inverts it. `:109` and `:142` demonstrate the AD-21 refusal **against the
  committed gate**, so both go green-but-meaningless once the gate opens and must be re-anchored on
  the synthetic `VALID` gate at `:18`. `:120` builds an open gate with `threshold: load average 3.0`,
  which the new shape rule refuses, so that fixture becomes `load15 3.0`.
- `ops/capacity-measurement.md:341-452` -- the week, under "What the week measured": load15 p50 0.11,
  p90 0.16, p99 0.21, max 0.27, containers 3.0% of the box mean and 7.1% peak. `:447-452` warns that
  container CPU is identical in both bands, so the load15 variation is not attributable to the
  containers the gate governs. `:302-312` describes what `capacity-gate.test.ts` asserts and goes
  stale here. `:463` is Operator action 5, "Hand the closed record to Story 1-6", still `_not done_`.
- `_bmad-output/implementation-artifacts/deferred-work.md:529-539` -- the finding this story is named
  in: `status: open` means yes to every id, `threshold: banana` would open it, and Story 1-6 must
  define what a threshold is.
- `ops/backup-digital-library.md:463-494` -- Story 1-8 installed the nightly job on the box at
  2026-08-24T12:52Z, inside the week, but it runs at 03:45 UTC and its first run falls after the week
  closed. A limit for the record, not a defect.
- Read-only sources: `epics.md:1309-1345` (this story), `ARCHITECTURE-SPINE.md:130-134` (AD-9),
  `:181-182` (AD-17c), `prd.md:563` (the provisional ~1.4 this story must not inherit), `:758` (SM-C4).
- Precedent for the record's shape: `ops/capacity-measurement.md`, `ops/bot-mitigation.md`,
  `ops/known-violations.md`. One `ops/*.md` per story, observed and decided marked separately.
- Baseline: 288 tests in 19 files, green at `309fd2a`, in roughly 140 seconds.

## Tasks & Acceptance

**Execution:**
- `ops/capacity-threshold.md` -- new. The derivation, step by step and each step marked observed or
  decided: the week's p99, the headroom costed from observed analogues for `list-wheel` and
  `cs-tournament`, the volatility margin, the resulting figure, the comparison against the measured
  baseline that authorises `open`, what would have happened had it not, what `open` mechanically
  checks, the condition that re-blocks the gate, why the research's provisional ~1.4 was rejected,
  and the named limits including that nothing samples the box at deploy time.
- `ops/capacity-gate.yml` -- write `threshold` as a one-line load15 figure pointing at the record, and
  move `status` to `open`. Rewrite the header comment at `:18-21` to say what happened and when,
  rather than what Story 1-6 will do.
- `ops/capacity-gate.mjs` -- refuse `status: open` unless `threshold` carries a readable positive
  load15 figure, and correct the refusal text so a blocked gate reads correctly in the era after a
  threshold exists.
- `ops/__tests__/capacity-gate.test.ts` -- invert the committed-gate assertions, re-anchor the AD-21
  refusal demonstration and the CLI refusal on a synthetic blocked gate so both keep discriminating,
  add one case per new matrix row, and assert from the committed file that the baseline load15 sits
  below the threshold load15.
- `ops/capacity-measurement.md` -- close Operator action 5 with the UTC completion date and a pointer
  to the new record, and amend the two paragraphs that describe the gate as blocked with an empty
  threshold so they date themselves rather than misdescribing the current file.

**Acceptance Criteria:**
- Given the week's measurement is closed and `threshold` was empty, when `ops/capacity-gate.yml` is
  read after this story, then `threshold` carries a specific 15-minute load-average figure traceable
  to the week, `status` is `open`, and `measured_at`, `baseline`, `reading`, `overflow` and
  `placements` are byte-identical to what Story 1-5 left.
- Given AD-17c gates every new placement on this story, when `node ops/capacity-gate.mjs list-wheel`
  runs against the committed gate, then it exits 0 and names the threshold, and the same check against
  a gate whose only difference is `status: blocked` still exits 1 with `REFUSED`, so opening the gate
  did not retire the demonstration that it can refuse.
- Given `status` may move to `open` only if the measured baseline sits below the written threshold,
  when the test suite runs, then a test reads both numbers out of the committed gate file itself and
  fails if the baseline ever reaches the threshold, rather than the comparison living only in prose.
- Given the epic allows a blocked outcome as a valid close, when `ops/capacity-threshold.md` is read,
  then it states which branch was taken and why, and says what the other branch would have required,
  so a later reader cannot mistake either outcome for unfinished work.
- Given SM-C4 makes load average win every conflict and the estate already intends `list-wheel` and
  `cs-tournament`, when the derivation is read, then the reserved headroom is costed against those two
  additions from observed per-container figures, and the rejection of the research's provisional ~1.4
  is stated with its reason.
- Given a threshold nobody can act on is not a threshold, when a gate carrying `status: open` and a
  threshold with no readable load15 figure is parsed, then it is refused with a message naming AD-9,
  and that refusal is demonstrated by a test that stays in the suite.

## Spec Change Log

## Review Triage Log

### 2026-08-25, Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 20: (high 2, medium 7, low 11)
- defer: 2: (high 0, medium 2, low 0)
- reject: 10: (high 0, medium 0, low 10)
- addressed_findings:
  - `[high]` `[patch]` The reader never enforced the comparison that authorises `open`, so a gate
    left at `status: open` with a baseline past its threshold deployed cleanly and only CI would
    have gone red, on a surface that does not hold a deploy. Added as a third state in `evaluate`.
    Placed in `parseGate` first, which was wrong: the only caller names an incumbent, so a parse
    refusal could never have refused a new id and could only ever have stopped the Anchor
    deploying, trading NFR-2. Moved to placement, where an id in `placements` still passes.
  - `[high]` `[patch]` Following the record's own re-block procedure would have turned four
    committed-gate assertions and a CLI case red and pointed the blame at the measurement. This is
    the failure Story 1-5 fixed for the measurement keys. The assertions are now implications of
    the gate's own status, so both states assert something real.
  - `[medium]` `[patch]` The machine tripwire compared only `baseline`, the p10 idle floor, so it
    could fire only long after the loaded band and the max had crossed. `reading` is compared too.
  - `[medium]` `[patch]` Literal pins on `measured_at`, `baseline` and `reading` recreated the
    Story 1-5 fragility. Narrowed to shape and relationship.
  - `[medium]` `[patch]` The `BLOCKED` fixture used the bare-prefix replacement Story 1-5 removed
    for appending to a filled value. Every fixture now uses one anchored helper.
  - `[medium]` `[patch]` `runAgainst` had no spawn guard and no positive control, so a broken
    harness read as a gate defect. It throws `run.error`, has an exit-0 control, and a test pins
    the no-relative-imports assumption its module copy rests on.
  - `[medium]` `[patch]` The gate file's header explained the shape rule but not its limit. It now
    says which check runs when, and that neither compares anything against the live box.
  - `[medium]` `[patch]` `ops/capacity-summary.mjs` still printed "`threshold` stays empty and
    `status` stays `blocked`" and a test pinned that wording, so the one tool a future close-out
    runs handed out retired instructions and correcting them meant deleting an assertion. Reworded
    to hold in both eras; the test now asserts the invariant that the summariser emits neither key.
  - `[medium]` `[patch]` Nothing in the record prompted a re-measurement, so a threshold from one
    quiet week stayed open indefinitely. A dated review row was added to the re-block table.
  - `[low]` `[patch]` Eleven smaller ones: the pattern rejected `Load15` and `load15:`;
    first-match-wins was undocumented; the refusal named no record to read; `load15()` had no
    direct tests; two CLI assertions passed on the bare word; a cast defeated its own null check;
    Step 1 cited no producing artifact for the p99 the whole derivation rests on; the load-to-CPU
    conversion was marked Derived when it is a modelling decision; Step 4 did not say that the two
    named additions supply 0.03 of the 0.39 headroom and the volatility factor the rest; a dangling
    PSI row sat in the table that authorises `open`; and the retired instruction inside the pasted
    summariser block was explained but not marked where an operator would copy from it.

## Design Notes

**The number, and why it is not 1.4.** The PRD's provisional gate was 70% of two cores, chosen before
anything had been measured. Against the week it is 6.7 times the observed p99, so it could not trip
until the box was already in trouble, and the response it triggers (moving two applications to managed
hosting) takes days rather than minutes. A threshold derived from the measurement instead starts at
the observed p99, charges both intended additions as though each were a whole application of average
weight, then multiplies by the week's own observed max-to-median volatility to cover what a quiet week
could not show: a build minute on the serving box (AD-8, tracked in Story 1-9), a traffic spike behind
the WAF, the nightly backup whose first run fell after the week closed.

**Why the reader gets a shape rule and not a comparison.** Nothing at the call site samples the box:
`deploy.yml` runs the checker on a GitHub runner, which has no view of `177.7.52.248`. A comparison
against a live reading would be a claim the code cannot keep. What the reader can enforce is that an
open gate carries a figure someone could act on, which is exactly the hole the Story 1-4 review named.

**Why the demonstration moves off the committed file.** Two tests currently prove the gate refuses a
new id by asking the committed gate, which is about to say yes to everything. Left as they are they
would keep passing for the wrong reason. Re-anchored on the synthetic gate they keep proving what
AD-21 asks: that the refusal path still works and can be rerun rather than trusted.

## Verification

**Commands:**
- `node ops/capacity-gate.mjs list-wheel` -- expected: exit 0, stdout naming the threshold. This is
  the AD-17c criterion, and it exits 1 before the change.
- `node ops/capacity-gate.mjs cuatro-portfolio` -- expected: exit 0, naming `placements`.
- `corepack pnpm test --run` -- expected: the 288 tests at `309fd2a` plus the new cases, all passing.
- `corepack pnpm typecheck` -- expected: pass.
- `git diff --stat ops/capacity-gate.yml` plus reading the file -- expected: exactly two changed value
  lines plus the header comment.
- Punctuation sweep over every file written, using regex escapes rather than literal characters, run
  against a positive control carrying all three forbidden characters so it cannot pass vacuously.

**Manual checks:**
- Confirm every figure quoted in `ops/capacity-threshold.md` appears in `ops/capacity-measurement.md`
  with the same value, so the record cites the week rather than restating it from memory.

## Auto Run Result

Status: done. Implemented at `ec682a3` on `dev`, over baseline `309fd2a`.

**What was implemented.** The Capacity Gate carries a threshold and is open. `threshold` reads
`load15 0.60 on 2 vCPU`, derived from the measurement week in five recorded steps: the observed p99
of 0.21, plus 0.03 of headroom charging `list-wheel` and `cs-tournament` at one Anchor-shaped
application pair each from observed per-container figures, times the week's own observed
max-to-median volatility of 2.5. The measured baseline of load15 0.08 is 13% of that line and the
week's highest reading, 0.27, is under half of it, so the open branch was taken and no overflow was
invoked. AD-17c no longer blocks a new placement: `node ops/capacity-gate.mjs list-wheel` exits 0
where it exited 1 before. The gate also stopped accepting a threshold nobody could act on, which is
the half of the Story 1-4 ledger entry that named this story as its resolver.

**Files changed:**
- `ops/capacity-threshold.md` -- new. The derivation step by step, every figure marked Observed,
  Derived or Decided, the comparison that authorised `open`, what the blocked branch would have
  required, why the PRD's provisional ~1.4 was rejected, what `open` mechanically checks, four
  conditions that re-block the gate including a dated review, and the named limits.
- `ops/capacity-gate.yml` -- `threshold` written, `status: open`, header rewritten to say which
  check runs when and that neither compares anything against the live box.
- `ops/capacity-gate.mjs` -- refuses an open gate whose threshold names no positive load15 figure;
  exports `load15()`; `evaluate` gained a third state, refusing a new id when the gate's own
  baseline has reached its own threshold while still passing an incumbent; refusal text corrected
  for the era after a threshold exists and pointed at the record.
- `ops/__tests__/capacity-gate.test.ts` -- committed-gate assertions rewritten as implications of
  the gate's own status; the AD-21 refusal demonstration and the CLI exit-1 case re-anchored on
  synthetic gates; direct `load15()` coverage; one case per I/O matrix row.
- `ops/capacity-summary.mjs` and `ops/__tests__/capacity-summary.test.ts` -- the closing instruction
  no longer tells a future close-out to leave the gate blocked, and its test asserts the invariant
  rather than the retired sentence.
- `ops/capacity-measurement.md` -- Operator action 5 closed with a pointer, the two paragraphs
  describing the gate as blocked now date themselves, and the retired instruction inside the pasted
  summariser block is marked where an operator would copy from it.

**Review findings:** 20 patched (2 high, 7 medium, 11 low), 2 deferred to frontmatter, 10 rejected.
No intent gaps and no spec-level defects: the intent, boundaries and matrix all held, and nothing
was reverted or re-derived.

**Follow-up review recommended: true.** Two patched findings were high severity, which sets the flag
on its own; the medium and low counts (7 and 11) are well past the threshold in any case.

**Verification performed.** `node ops/capacity-gate.mjs list-wheel` exits 0 naming the threshold and
`cuatro-portfolio` exits 0 naming `placements`, both run against the committed file. `corepack pnpm
test --run` reports 322 passed in 19 files, against 288 at `309fd2a`. `corepack pnpm typecheck`
passes, and it caught one real defect during the patch pass. Every I/O matrix row has a covering
test that ran and passed. A live demonstration against a temporary gate carrying `baseline: load15
0.91` with `status: open` refuses `list-wheel` with both figures named and passes `cuatro-portfolio`
on the identical gate. The punctuation sweep ran against a positive control carrying all three
forbidden characters and reported hits on the control only.

**Residual risks.**
- `cs-tournament`'s footprint is charged from an analogue, not observed, because its Status is still
  an open assumption until Story 2-4. If it arrives materially heavier than an Anchor-shaped pair,
  Step 2 of the record is the step to redo. It is Pending Operator action 3 in that file.
- The threshold's headroom is dominated by the volatility factor rather than by the two additions
  the acceptance criterion names. The record states the 0.03 against 0.36 split rather than leaving
  a reader to work it out and conclude the argument was thinner than it looks.
- The two deferred items are the real remaining holes: the shape rule has no ceiling, and nothing
  compares the box's live load against the line.
- The gate still binds only the Anchor's own deploy workflow, so `list-wheel` will not pass through
  it at its actual placement. That is the standing `deferred-work.md` reach gap, unchanged by this
  story and stated in the new record.

**One process deviation, recorded rather than hidden.** The workflow requires every review layer to
be launched before any of their output is read, so triage is not anchored by whichever returns
first. I launched the blind hunter alone and read its findings before launching the other three
layers. The strongest findings of the pass came from the layers launched second, and the two
findings I acted on hardest, the missing comparison and the re-block turning CI red, were each
raised independently by more than one layer, so the anchoring risk appears not to have bitten. It is
recorded because the check against it is the ordering, not the outcome.
