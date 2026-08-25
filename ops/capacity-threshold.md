# The Capacity Gate threshold

The written record of the number in `ops/capacity-gate.yml`'s `threshold` key: where each term in
it came from, which of them were measured and which were decided, why the gate moved to `open`,
what `open` mechanically checks and what it does not, and the condition that puts the gate back to
`blocked`. It is the artifact Story 1-6 delivers.

Written **2026-08-25** (ISO 8601 UTC), against the measurement week `ops/capacity-measurement.md`
closed the same day.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/estate.md`, `ops/monitoring.md`, `ops/routing-inventory.md`,
`ops/bot-mitigation.md`, `ops/known-violations.md` and `ops/capacity-measurement.md` set: every
value is marked as either an observation or a decision, and the two are never presented as the same
kind of fact (NFR-9). Where a figure is arithmetic over observations it is marked **Derived**, which
is a third thing again: it is only as good as the observations under it and the step that combined
them, and both are written out below rather than summarised.

Governing decisions: **AD-9** (the Capacity Gate blocks new placement mechanically and defaults to
blocked), **AD-17c** (the gate carries a written threshold before any new id is placed), **AD-21**
(every CI gate is blocking, and every new refusal is demonstrated failing once).

**Story ids are written hyphenated**, as `Story 1-6`, matching the keys in
`_bmad-output/implementation-artifacts/sprint-status.yaml`. `epics.md` writes the same ids dotted.

## The answer, first

| Item | Value | Nature |
|---|---|---|
| `threshold` | **load15 0.60 on 2 vCPU** | **Decided**, from the derivation below |
| `status` | **`open`** | **Decided.** The measured baseline is load15 0.08, which is 13% of the threshold |
| Branch taken | **The open branch.** The box is far from its ceiling | **Decided** |
| Derived from | `ops/capacity-measurement.md`, 10127 observed minutes to `2026-08-25T00:33:34Z` | **Observed** |
| Derived from anything else | Nothing | **Decided.** The PRD's provisional figure was considered and rejected, below |

`0.60` on a box with 2 vCPU is 30% of its two runnable cores. Every load15 figure in this file is a
15-minute load average as `/proc/loadavg` reports it, to two decimal places, which is the precision
the instrument has.

## The derivation, step by step

Five steps. Each names its inputs and its nature, so a later reader can overturn any one of them
without having to reconstruct the other four.

### Step 1. Start at the observed p99, not the mean and not the max

Every row below is read from `ops/capacity-measurement.md`, section **"What the week measured"**,
subsection **"The box"**, which is the block `ops/capacity-summary.mjs` printed at close-out from
10129 box samples and which the close-out session pasted in unedited.

| Reading | Value | Nature |
|---|---|---|
| load15 min | 0.05 | **Observed** |
| load15 p10, the idle floor | 0.08 | **Observed** |
| load15 p50 | 0.11 | **Observed** |
| load15 p90 | 0.16 | **Observed** |
| **load15 p99, the starting point** | **0.21** | **Observed** |
| load15 max | 0.27 | **Observed** |

**Decided: the derivation starts at p99 (0.21).** The mean describes a quiet minute and would make
the threshold a statement about idling. The max is a single excursion and would make it a statement
about one minute in 10127. p99 is the top of what the estate did routinely across the week, which
is the thing a capacity line has to sit above.

### Step 2. Charge the two intended additions, from observed per-container figures

SM-C4 makes VPS load average win every conflict with any other metric, and the estate already
intends two additions: `list-wheel` (Satellite, Angular, `Live` on GitHub Pages and relocating to
the VPS) and `cs-tournament` (arriving from external hosting), both recorded in `ops/estate.md`.
Headroom is reserved for those two, not for today's four applications alone.

The closest observed analogue on the box for an arriving web application with its own datastore is
the Anchor itself, which is exactly that shape:

| Container | CPU mean, 1 core | CPU peak, 1 core | Nature |
|---|---|---|---|
| `cuatro-portfolio-anchor-app-1` | 0.7% | 3.5% | **Observed** |
| `cuatro-portfolio-anchor-db-1` | 0.6% | 0.7% | **Observed** |
| **The pair, one whole application** | **1.3%** | **4.2%** | **Derived**, by addition |

| Charge | Value | Nature |
|---|---|---|
| Applications charged | 2 (`list-wheel`, `cs-tournament`) | **Decided** |
| Weight charged per application | one Anchor-shaped pair, 1.3% of one core | **Decided** |
| Both additions, CPU | 2.6% of one core | **Derived** |
| Both additions, expressed as load | 0.026 | **Decided.** A modelling step, not arithmetic. See below |
| **Reserved headroom** | **0.03** | **Decided**, rounded up from 0.026 to the instrument's precision |

**The CPU to load conversion is a decision, not arithmetic, and NFR-9 makes the difference matter.**
The step treats a mean CPU share of one core as an equal quantity of load average, one for one, on
the ground that load 1.0 on this box is one runnable core. That holds for CPU-bound work and
understates IO-bound work: Linux counts tasks in uninterruptible sleep in the load average as well
as runnable ones, so an application that spends its time waiting on disk raises load without
spending measurable CPU. An addition heavier on IO than on CPU is therefore charged low by this
step, which is one of the things the Step 3 margin exists to absorb and one of the reasons Step 2 is
the step to redo when a real footprint is observed.

**`list-wheel` is deliberately over-charged.** `epics.md` calls it static and near zero, and the
only observed analogue for a static server on this box agrees: `cs-tracker-caddy-1` runs at 0.0% of
one core mean, 2.4% peak. Charging it near zero would reserve nothing, so it is charged as a whole
application of the Anchor's weight instead. Reserving headroom for an application that turns out not
to need it costs a slightly lower threshold. Reserving none for one that does costs the box.

**`cs-tournament` is charged at its analogue and not below it.** Its Status in `ops/estate.md` is
still the unresolved `[ASSUMPTION: Live on Vercel]`, resolved by Story 2-4, so its real footprint is
not known here. The Anchor pair is the closest shape in the observed data.

### Step 3. Multiply by the week's own observed volatility

| Term | Value | Nature |
|---|---|---|
| load15 max | 0.27 | **Observed** |
| load15 p50 | 0.11 | **Observed** |
| Max to median ratio | 2.45 | **Derived** |
| **Volatility factor applied** | **2.5** | **Decided**, rounded up from 2.45 |

**Why a multiplier and not a fixed pad.** The week was quiet and the record says so. It contains no
build minute (`main` sat at `54d3a0d` from 2026-08-15 with no merges, so no
`docker compose up --build` from the standing AD-8 violation fell inside the data), no traffic spike
worth the name, and no run of the nightly `digital-library` backup, which was installed on the box
at 2026-08-24T12:52Z inside the week but fires at 03:45 UTC, so its first run fell after the week
closed (`ops/backup-digital-library.md`). The margin covers what a quiet week could not show, and
the honest size of that margin is the volatility the box itself exhibited rather than a number
picked to feel safe.

The rounding goes up rather than to nearest, because rounding a safety margin up spends headroom
and rounding it down borrows headroom that was never measured.

### Step 4. The arithmetic

| Step | Expression | Value | Nature |
|---|---|---|---|
| 1 | observed p99 | 0.21 | **Observed** |
| 2 | plus reserved headroom | 0.21 + 0.03 = 0.24 | **Derived** |
| 3 | times the volatility factor | 0.24 x 2.5 = 0.60 | **Derived** |
| 4 | **written into the gate** | **load15 0.60** | **Decided** |

**Which step supplied the headroom, said plainly.** The threshold sits 0.39 above the observed p99.
Of that, **0.03 is the two named additions** (`list-wheel` and `cs-tournament`, Step 2) and **0.36 is
the volatility factor** (Step 3), which scales the whole subtotal rather than only the additions. So
the acceptance criterion that the headroom be costed against those two additions is met by Step 2,
and the majority of the room the gate actually has comes from the week's own observed volatility. A
reader who works that split out for themselves should not have to, and one who assumed the additions
accounted for most of 0.39 would be wrong.

### Step 5. The comparison that authorises `open`

`status` may move to `open` only if the measured baseline sits below the written threshold.

| Term | Value | Nature |
|---|---|---|
| Measured baseline, from `ops/capacity-gate.yml` | load15 0.08 | **Observed** |
| Written threshold | load15 0.60 | **Decided** |
| Baseline as a share of the threshold | 13% | **Derived** |
| Threshold as a multiple of the week's max (0.27) | 2.2 times | **Derived** |

The baseline is 13% of the threshold and the highest load15 the box reached in 10127 observed
minutes is still less than half of it. **The gate opens.**

**A load average can be low while the box is still stalling, so the corroborating reading is
checked separately.** Box PSI some, the share of wall time at least one task spent waiting on CPU,
was **1.6%** across the week (**Observed**). A low load15 alongside a high stall share would have
meant the load average was not seeing the pressure and that Step 1's anchor was measuring the wrong
thing. It does not: 1.6% is a box that is essentially never waiting, so the load15 figures this
whole derivation rests on are a fair description of what the box was doing.

**This comparison is asserted, not only written here.** `ops/__tests__/capacity-gate.test.ts` reads
the load15 figure out of `baseline` and out of `threshold` in the committed gate file and fails if
the baseline ever reaches the threshold, so the sentence above cannot quietly stop being true.

## The other branch, and what it would have required

The epic allows a blocked outcome as a valid close, so this record states which branch was taken so
that a later reader cannot mistake either one for unfinished work.

**Had the measured baseline landed at or above any defensible threshold**, `status` would have
stayed `blocked`, this record would have said so, and Story 1-6 would still have closed
successfully. The response would then have been the named overflow path already decided in the gate
file: managed hosting on Railway, the two heavy applications, $15 to $30 per month, inside NFR-4's
$40 to $100 all-in bound. That path is **a new recurring charge**, which under NFR-4 is an Operator
decision recorded as one, never taken unattended by the story that discovered the need for it.

That branch was not taken. The box is at 13% of the line, so nothing was escalated and no charge was
incurred.

## Why the research's provisional ~1.4 was rejected

`prd.md:563` carries the provisional figure as an explicit assumption: *the threshold is the
research's Step 1 gate, 15-minute load average ~1.4 with today's four applications*, with the PRD
requiring that a written threshold exist and bind, not that it be that figure. The architecture was
invited to confirm or replace it with measured data. It is replaced, for three reasons.

- **It was chosen before anything had been measured.** 1.4 is 70% of two cores, a rule of thumb
  about load average on a 2 vCPU box. It is not a fact about this box, and the whole point of AD-9
  and of the measurement week is that the gate binds on evidence.
- **It could not trip until the box was already in trouble.** 1.4 is 6.7 times the observed p99 of
  0.21 and 5.2 times the observed max of 0.27 (both **Derived** from the week). A line the estate
  would have to grow more than sixfold to reach is not a gate, it is a formality.
- **The response it triggers takes days, not minutes.** Crossing the threshold routes to managed
  hosting for two applications: a provider account, a migration, DNS, a recurring charge. A
  threshold that only trips once the box is saturated leaves no time to perform the response it
  exists to trigger. A threshold at 30% of the box trips while there is still room to act.

The rejection is of the number, not of the direction. Both figures are load15 on 2 vCPU, which is
what AD-9 and SM-C4 both name.

## What `open` mechanically checks

Written out because "the gate is open" is easy to read as more than it is.

1. **An id already in `placements` passes, whatever the status.** Continuity is never traded against
   the gate (NFR-2, AD-9). This is checked before the status is looked at.
2. **With `status: open`, any other id passes**, and the message names the threshold the gate was
   opened against, so the exit-0 line in a deploy log carries the number.
3. **With `status: blocked`, any other id is refused**, exit 1, naming the gate path, the blocked
   status, the ids that do pass and the decided overflow. Writing a threshold does not open a gate:
   the status is a separate key and refusal survives a threshold being present.
4. **An open gate that names no positive load15 figure is refused at parse**, before any id is
   considered, with a message naming load15 and AD-9. `threshold: banana` and `threshold: load15 0`
   both fail closed, as does the empty threshold that Story 1-4 already refused.
5. **An open gate whose own recorded `baseline` has reached its own recorded `threshold` refuses a
   new id**, with a message naming both figures, AD-9 and this record, and saying the gate is
   treated as blocked until the status is corrected. This is the Step 5 condition enforced by the
   code rather than only written down here, so a hand edit that leaves `status: open` after the
   baseline crosses the line cannot place anything new. It is a comparison between two values in the
   same file and **not** a comparison against the box. Where `baseline` names no load15 figure at
   all, nothing is compared and the gate is read as written: failing closed on the absence of a
   number would refuse gates that are fine.

**Point 5 is decided at placement, not while reading the file, and that placement is load bearing.**
Points 1 to 4 are refusals to read: the file is malformed, nothing can be decided from it, and it
says no to everything including an id in `placements`. Point 5 is not that. The file is perfectly
readable and is saying something specific, so it is answered where a placement is decided, after the
`placements` check. The consequence is that the Anchor keeps deploying from a gate that is at the
same moment refusing new placement, which is exactly what AD-9 asks for.

Had point 5 been a refusal to read, it would have inverted its own purpose. `deploy.yml` is the only
caller of this checker and it names `cuatro-portfolio`, an incumbent, so at the one live call site a
parse-level version could never have refused a new id, because no new id passes through it, and
could only ever have stopped the Anchor deploying. The single practical effect would have been the
one AD-9 forbids.

Every one of those refusals is demonstrated by a test that stays in the suite, in the pattern AD-21
requires, and the exit-1 ones by a subprocess running the real checker.

## What this record does not claim

The named limits. Each is a real bound on what the number above can be trusted for.

- **Nothing samples the box at deploy time, and this threshold is not compared against a live
  reading anywhere.** `.github/workflows/deploy.yml` runs `ops/capacity-gate.mjs` on a GitHub
  runner, which has no view of `177.7.52.248`. A comparison against a live load15 would be a claim
  the code cannot keep, so the checker enforces the threshold's **shape** and its relationship to
  the **`baseline` recorded beside it in the same file**, and records this limit instead of
  pretending to enforce a value it cannot see.

  **Said precisely, because "nothing re-blocks the gate automatically" is not quite true and not
  quite false.** A new id is refused as soon as the recorded baseline reaches the recorded
  threshold, so a re-measurement that crosses the line and is written into `baseline` stops new
  placement at the next run without anyone editing `status`. What nothing does automatically is
  **notice that the box has changed**: no process re-measures, and until a human runs another
  measurement week and writes a new `baseline`, an open gate stays open however far the real box has
  drifted. The tripwire watches the file, not the machine. That is why the review date below exists.
- **A crossed baseline refuses new placement and nothing else. NFR-2 is not traded.** The
  comparison is made where a placement is decided, after the `placements` check, so a gate recording
  `status: open` with a baseline at or above its threshold refuses `list-wheel` while
  `cuatro-portfolio` still deploys. That is deliberate and it is the whole reason the check does not
  live in the parser: a parse-level refusal rejects the file, a rejected file says no to every id,
  and the only caller names an incumbent, so the rule would have spent itself entirely on the one
  outcome AD-9 rules out while never reaching a new id at all. What is left is the right shape: a
  gate contradicting its own numbers cannot place anything new, continuity is untouched, and the way
  out is one edit, either `status: blocked` or a re-derived threshold, both of which the re-block
  table already names. Tests pin both halves, the refusal and the incumbent still passing, so
  neither becomes an accident.
- **The gate binds only the Anchor's own deploy workflow.** That workflow is the only caller and it
  names `cuatro-portfolio`, which is in `placements` by construction. The three Satellites deploy
  from their own repositories and never call the checker, so `list-wheel` and every id placed in
  Epic 4 do not pass through it today. This is recorded in
  `_bmad-output/implementation-artifacts/deferred-work.md` as a gap in reach, and opening the gate
  neither widens nor narrows it.
- **The week measured what the estate did, not what the box can hold.** No artificial load was
  generated. Load average is the box and per-container CPU is the attribution; neither says anything
  about behaviour under traffic the box did not receive.
- **The two measured bands are identical in container CPU.** `ops/capacity-measurement.md` records
  container CPU at 3.0% of the box and container RSS at 1.23 GiB in both the idle and the loaded
  band, so the observed load15 variation is **not** attributable to the containers the gate governs.
  That is why Step 2 charges an addition from per-container means and then lets Step 3, which is
  anchored to load15 itself, carry the variation. A threshold built only from container CPU would
  have had almost no observed dynamic range to sit in.
- **The sampler is inside every figure quoted here.** Its own cost was 0.113% of one core across the
  week, stated rather than subtracted, because subtracting it would be a modelling decision
  presented as a measurement.
- **`cs-tournament`'s footprint is assumed from an analogue, not observed.** Its Status is still an
  open assumption resolved by Story 2-4. If it arrives materially heavier than an Anchor-shaped
  pair, Step 2 is the step to redo.
- **No rendered-output or browser check is claimed anywhere.** Playwright arrives in Story 1-10.

## What re-blocks the gate

There is no automatic path back. `status` is a hand edit, and these are the conditions that require
one:

| Condition | Response |
|---|---|
| A later measurement puts the baseline at or above load15 0.60 | Set `status: blocked`, invoke the overflow path, and record the Operator decision on the recurring charge (NFR-4). New placement is refused as soon as the crossed baseline is written in, whether or not the status has been moved yet, so this row fails closed on its own. Incumbents keep deploying throughout |
| **Elapsed time: 2027-02-25** (**Decided**, six months from derivation) | Re-read this record against the estate as it is then. If the four applications, the two intended additions or the box have changed, run another measurement week and re-derive. If nothing has changed, move this date on by six months and say so here, so a standing threshold is a decision that was re-taken rather than one nobody revisited |
| An addition arrives materially heavier than the Anchor-shaped pair charged in Step 2 | Redo Step 2 against its observed figures, rewrite `threshold`, and re-check Step 5 before leaving the gate open |
| The box's core count changes | Every figure here is load15 on 2 vCPU. Redo the whole derivation; a load average does not port between boxes of different width |
| The estate intends a third addition beyond `list-wheel` and `cs-tournament` | Charge it in Step 2 and rewrite the threshold, rather than spending the volatility margin on it |

**The first row is enforced by `ops/capacity-gate.mjs` itself**, which refuses a new id against an
open gate whose recorded baseline has reached its recorded threshold, and asserted again in
`ops/__tests__/capacity-gate.test.ts`. Both act on what the file says, so the row still depends on
somebody having re-measured and written the new baseline in.

**The other four rows are the Operator's, and no machine can see any of them.** That is precisely
why the review date is one of them: a threshold derived from one quiet week in August 2026 would
otherwise stand indefinitely on the strength of nobody having looked. The architecture spine already
requires settled inputs to be re-checked on a bounded schedule, and the estate has a scheduled look
at February 2027 in any case, since Let's Encrypt certificate lifetimes fall that month (AD-17a).

## Pending Operator actions

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| 1 | Derive the threshold from the closed week and write it into `ops/capacity-gate.yml` | `load15 0.60 on 2 vCPU`, derived above | **2026-08-25** |
| 2 | Move `status` to `open`, the measured baseline being below the threshold | Baseline load15 0.08 against a threshold of 0.60 | **2026-08-25** |
| 3 | Confirm `cs-tournament`'s real footprint once Story 2-4 resolves its Status | Step 2 charges it from an analogue. If it lands heavier, Step 2 is redone | _not done_ |
| 4 | **Review this derivation on 2027-02-25** | Six months from derivation. Re-derive if the estate or the box has changed, and otherwise move the date on rather than leaving it passed | _not done_ |

**Maintaining this file.** When an action is performed, replace the cell with the ISO 8601 UTC
completion date and leave the row in place. Deletion is not used: which part of the derivation was
established when is what a later reader needs when the threshold stops holding.
