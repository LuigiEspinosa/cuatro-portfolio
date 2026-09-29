---
baseline_commit: 1ee3348
---

# Story 5.4: Anti-farm floors and AFK/idle DQ

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operator,
I want minimum-participation floors and AFK/idle disqualification applied,
so that no award is won by idle farming or below-floor participation.

## Acceptance Criteria

**AC1 — the participation floors are pinned as reproducible config; the WORKER does NOT apply them.**
**Given** the anti-farm rule (FR-21, SM-C1) and AD-20 (one normalization site),
**When** a player's match stats are later evaluated for award eligibility,
**Then** the floors of **≥24 rounds played** and **≥20 kills** (the latter only for rate/HS%-class awards) are the values that gate eligibility — but they are applied in **Story 5.5's single leaderboard view** over the tournament-cumulative totals, **never per-match in the worker**. This story pins those numbers as reproducible build-time config alongside the AFK config (AC6); the worker's only floor-related duty is that `rounds_played` and `kills` (already written since Story 5.1) remain present and correct on every row. *(See "The 24-round floor is CUMULATIVE" below — a wingman match is ≤ ~22 rounds, so a per-match ≥24 floor would disqualify **every** player.)*

**AC2 — AFK/idle DQ is derived per match from the event + tick stream.**
**Given** the AFK/idle rule (FR-21; cadence/epsilon as published config, [SOLUTION-DESIGN.md:345-348](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L345)),
**When** the worker derives a match,
**Then** a round is **idle for a player** when — over that round — the player's **position displacement stays below the position epsilon AND they fire no shot, throw no utility, and deal no damage**; a player idle in **≥ 50%** of the rounds they were present for is written `idle_dq = true` for that match, and `idle_round_count` carries their per-match idle-round tally. The idle **decision** is a pure function over plain values (displacement `float64`, an `acted` bool); only the position **sampling** touches the live parser.

**AC3 — zero is recorded as zero, never omitted; `idle_dq` is written explicitly.**
**Given** the zero-not-omitted convention Stories 5.2/5.3 established for FR-19/FR-20,
**When** a player was never idle,
**Then** `idle_round_count` is written the integer **`0`** (never SQL `NULL`) and `idle_dq` the boolean **`false`** — both written **unconditionally** through the INSERT list, exactly like the weird five and the derived three, so a re-parse is deterministic and 5.5's view reads them with no NULL branch.

**AC4 — single writer, no schema change.**
**Given** the single-writer rule (AD-2),
**When** these two facts are written,
**Then** they are written **only** by the worker via the service role into `stat_row`, through the one shared `upsertStatRows` used by **both** `RecordParse` and `RecordReparse`. `supabase/migrations/`, `app/`, and `lib/` are **untouched** — `idle_dq boolean not null default false` and `idle_round_count int` already exist since [`0007_stat_row.sql:47`](supabase/migrations/0007_stat_row.sql#L47).

**AC5 — the derivation is proven LIVE, not assumed (the 5.2a gate, aimed at its most dangerous target yet).**
**Given** the Story-5.2a precedent (`blind_kills` shipped permanently empty because a dead event field's zero was explained away instead of measured),
**When** THE BAR runs over the 14 real demos,
**Then** `events.FrameDone` is shown to **actually fire** and `Player.Position()` to return **varying, non-degenerate coordinates** (a printed per-round displacement distribution), and the expected **all-`false` `idle_dq`** result is proven **positively** by printing the measured per-player movement + action activity — because a **dead or degenerate `Position()` signal would make every player look motionless, flag every round idle, and disqualify the entire tournament**, silently and catastrophically inverting SM-C1. A zero that is only *argued* is not accepted.

**AC6 — the AFK config is reproducible and surfaced for the verification bundle.**
**Given** the published-config rule ([epics.md:897-899](_bmad-output/planning-artifacts/epics.md#L897), [ARCHITECTURE-SPINE.md:470-471](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L470)),
**When** the AFK sampling cadence, position epsilon, and the ≥50% idle-DQ threshold are set,
**Then** their values are **reproducible build-time config** (documented constants in `worker/ingest/parse.go`, the same "published stat convention, NOT a secret" home as `kastTradeWindow` at [parse.go:80-86](worker/ingest/parse.go#L80) — never `worker/config`, which is secrets/endpoints only), so a tuned run stays reproducible. *(The physical write into the `verification_bundle` row happens in Epic 6; this story pins the values as config-of-record and hands them forward — see "Config surfacing" below.)*

**AC7 — the conservation gate is relaxed to flag only the impossible direction.**
**Given** the open Epic-3 action item pinned to this story ([sprint-status.yaml:197-200](_bmad-output/implementation-artifacts/sprint-status.yaml#L197)) — "relax the conservation gate to `Σkills > Σdeaths`" — approved at the Epic 3 retro after real demos balanced 16==16 at live-QA,
**When** `Validate` runs its conservation gate ([validate.go:40](worker/ingest/validate.go#L40)),
**Then** it flags **only the over-count direction** (`Σkills > Σdeaths` — impossible in a completed match, so a genuine double-count) and **no longer flags** the normal `Σkills < Σdeaths` under-count (an unattributed fall/world/bomb death), with the gate's comment block updated and its own test.

_Traces: FR-21 · SM-C1 · Epic-3 action item (validate.go relax)_

---

### READ THIS FIRST — three deliverables, four prohibitions, two traps

**Story 5.4 is three deliverables in one worker slice, all under `worker/`:**

| # | Deliverable | Files | AC |
|---|---|---|---|
| A | **AFK/idle DQ derivation** → `idle_dq` + `idle_round_count` on `stat_row` | `parse.go`, `db.go`, `cli.go`, `reparse.go` (+ tests) | AC2/AC3/AC4/AC5 |
| B | **Conservation-gate relax** → flag only `Σkills > Σdeaths` | `validate.go` (+ test) | AC7 |
| C | **AFK config pinned + surfaced** for the verification bundle | `parse.go` constants | AC6 |

**Four prohibitions (leave the story if you cross one):**

1. **NO MIGRATION. NO SQL FILE. NO `app/`/`lib/`/`.ts` CHANGE.** `idle_dq boolean not null default false, idle_round_count int` already exist at [`0007_stat_row.sql:47`](supabase/migrations/0007_stat_row.sql#L47); `0007:24-25` says verbatim the AFK-idle columns are "CREATED (nullable) here but POPULATED by Story 5.4." You widen the parser and the upsert, never the schema.
2. **DO NOT apply the ≥24-round / ≥20-kill floors in the worker.** That is AD-20's single normalization site = **Story 5.5's view** over `status='approved'`, cumulative across the tournament. The worker writes raw facts; it never gates eligibility. (See trap 1.)
3. **DO NOT create or touch the `award.floor_rounds` / `floor_kills` columns or the `verification_bundle` table.** Those live on tables created in **Epic 6** ([SOLUTION-DESIGN.md:168-169](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L168), :235-245). This story pins the floor/AFK **values** as worker-side config only.
4. **DO NOT use `Player.IsAlive()`, `GetTeam()`, or read any pawn-entity property from pure/testable code.** `Player.Position()` IS such a call (it routes through `demoInfoProvider` — see Dev Notes); it may live **only** in the thinnest live `events.FrameDone` closure, handing plain `float64` deltas out to a pure classifier — exactly how `IsBlinded()` is read live and passed as a bool to `classifyWeirdKill` ([parse.go:646](worker/ingest/parse.go#L646)).

**Two traps that will produce a plausible, catastrophic wrong answer:**

- **⚠ TRAP 1 — the 24-round floor is CUMULATIVE, not per-match.** A 1v1 wingman match runs **≤ ~22 rounds** (Story 5.3 measured the corpus at 11–22 rounds/demo). If you apply "≥24 rounds played" against a single match's `rounds_played`, **every player of every match fails the floor and is excluded from all awards** — SM-C1 inverted, silently. The floor sums `rounds_played` across all of a player's `status='approved'` matches and is applied **once, in the 5.5 view**. The worker's job is only to keep the per-match `rounds_played` correct (it already is, since 5.1). This is the story's headline scope trap — do not "helpfully" gate in the worker.
- **⚠ TRAP 2 — a dead `Position()` signal is the 5.2a failure at maximum blast radius.** `blind_kills` shipped empty off a dead field and hurt one award. If `Player.Position()` returns a degenerate value on our demos (all-zero, all-equal, or the accessor silently degrading), **every displacement reads < epsilon, every round flags idle, every player is `idle_dq`, and the entire tournament is disqualified from every award.** That is why AC5 mandates a hard BAR gate that PROVES `FrameDone` fires and `Position()` returns varying real coordinates **before** trusting a single idle verdict. Measure the signal; never assume it.

**One measured expectation you must PROVE, not assert (the 5.3 GATE-2 discipline):** over a real competitive tournament, **nobody is AFK** — so `idle_dq` will be `false` for every player and `idle_round_count` will be ~0. That is the *correct, expected* result, and like the empty `clutches` in 5.3 it must be shown **positively** (players demonstrably move hundreds+ of units and fire every round), never argued from "it's a tournament, nobody's AFK." An all-`true` result means the signal is dead (trap 2); an all-`false` result must be backed by printed activity.

---

## Tasks / Subtasks

> Shape mirrors 5.1/5.2/5.3: widen `PlayerStat` → widen `roundStats` → derive in the handlers → widen `StatRow` → widen the upsert (`$23`,`$24`) → widen **both** mapping sites → widen the tests. **The new parts** are a per-tick `events.FrameDone` sampler, a pure idle classifier, the `validate.go` relax, and the config constants.

- [x] **Task 1 — Pin the AFK config constants (AC: 6)**
  - [x] In [worker/ingest/parse.go](worker/ingest/parse.go), next to `kastTradeWindow` ([parse.go:80-86](worker/ingest/parse.go#L80)), add the FR-21 build-time constants under a comment stating they are **published, fairness-affecting stat convention** (the AC6 "build-time config") — NOT secrets, so they live here and NEVER in `worker/config` (AD-25):
    ```go
    // FR-21 AFK/idle config (Story 5.4). PUBLISHED, fairness-affecting build-time config — surfaced in the
    // Epic-6 verification_bundle so a tuned run reproduces (epics.md:897-899). Starting defaults to validate
    // against real event data (prd.md:519, Open Question 5); tune within the SM-5 parse budget.
    const (
        afkPositionEpsilon = 64.0 // game units: max round displacement (from the round's first sample) below
                                  //  which a player is "not moving". ~1.2 m; a peek/reposition is 100s of units.
        afkIdleDQNumer     = 1    // idle_dq when idle rounds / present rounds >= afkIdleDQNumer/afkIdleDQDenom
        afkIdleDQDenom     = 2    //  i.e. >= 50%. Integer ratio, NO float: idle*Denom >= present*Numer.
    )
    ```
  - [x] **Sampling cadence:** sample on **every** `events.FrameDone` (the finest cadence). SM-5 gives minutes of budget against a ~3.4 s event-only parse ([prd.md:489](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L489)), so per-frame sampling is well within budget; document the cadence choice in the FrameDone handler and let THE BAR report the measured parse time. If a future demo makes per-frame sampling too costly, coarsen by sampling every Nth frame — express that N as a constant here if you add it, don't bury it.

- [x] **Task 2 — Widen the parser payload (AC: 2, 3)**
  - [x] In `PlayerStat` ([parse.go:51-78](worker/ingest/parse.go#L51)), add under a new comment naming them the FR-21 AFK/idle pair (Story 5.4):
    ```go
    IdleDQ         bool // true when the player was idle in >= 50% of the rounds they were present for (FR-21)
    IdleRoundCount int  // per-match count of idle rounds; 0 (never NULL) when never idle
    ```
  - [x] Update the `PlayerStat` doc comment ([parse.go:27-28 region](worker/ingest/parse.go#L27) and the struct header): after this story the parser fills FR-18 core + FR-19 weird + FR-20 derived + **FR-21 AFK/idle** — **nothing** remains at a nullable column default. Restate that the ≥24/≥20 floors are applied in the 5.5 view (AD-20), never here.

- [x] **Task 3 — Track per-round activity + movement in `roundStats`, armed and folded like every other stat (AC: 2)**
  - [x] Add to `roundStats` ([parse.go:110-145](worker/ingest/parse.go#L110)):
    ```go
    // FR-21 AFK/idle (Story 5.4). Per-round, riding `cur` on the trap-4 assign discipline like every stat above.
    acted    map[uint64]bool    // player fired / threw utility / dealt damage this round (any action event)
    posAnchor map[uint64]r3.Vector // first sampled position this round (the displacement origin)
    posMaxDisp map[uint64]float64 // max distance from posAnchor seen this round
    sampled   map[uint64]bool    // player got >=1 FrameDone position sample this round (idle undecidable without one)
    present   map[uint64]bool    // player was Playing() at RoundEnd this round (the idle-ratio denominator)
    idleRound map[uint64]bool    // computed at RoundEnd: this player was idle this round (the fold input)
    ```
    (`r3.Vector` is `github.com/golang/geo/r3`, demoinfocs's position type — the ONLY new import; it is a plain 3-float struct, safe to hold.)
  - [x] Initialize all six maps in `newRoundStats()` ([parse.go:147](worker/ingest/parse.go#L147)).
  - [x] Reset them on re-arm: extend `armLiveWindow()` ([parse.go:209-213](worker/ingest/parse.go#L209)) to clear the FR-21 per-round state too, so a MatchZy mid-round restart cannot carry an aborted attempt's movement/action into the round that commits — the exact asymmetry the 5.3 review fixed for the duel latch. Re-init the six maps (fresh, empty).

- [x] **Task 4 — The idle decision: a PURE method on `roundStats` (AC: 2)**
  - [x] Add the classifier — the `epsilon` is passed IN so the guard is mutation-testable with plain values, no demo:
    ```go
    // isIdleRound decides whether `sid` was idle THIS round: it got at least one position sample, its max
    // displacement from the round's first sample stayed below epsilon, AND it produced no action event
    // (no shot / no utility / no damage dealt). The three conditions are ANDed (FR-20-style ANDed gate,
    // prd.md:321): a player who moved OR acted is not idle. `!sampled` returns false — idle is undecidable
    // without a position sample, and the SAFE direction is "not idle" (never DQ on missing data, SM-C1).
    func (rs *roundStats) isIdleRound(sid uint64, epsilon float64) bool {
        if !rs.sampled[sid] { return false }
        if rs.acted[sid] { return false }
        return rs.posMaxDisp[sid] < epsilon
    }
    ```
  - [x] **All three guards are FR-21 requirements, not defensive noise** — pin that in the comment. `!sampled → false` and `acted → false` and `maxDisp < epsilon` must each redden a named mutation test (Task 8).

- [x] **Task 5 — Sample position per tick, and flag actions, from the live parser (AC: 2, 5)**
  - [x] Register a **new** `events.FrameDone` handler. It skips warmup like every handler, iterates `Participants().Playing()`, and — inside this thinnest-possible closure ONLY — reads `Position()` and records anchor / max-displacement into `cur`:
    ```go
    p.RegisterEventHandler(func(e events.FrameDone) {
        if p.GameState().IsWarmupPeriod() { return }
        for _, pl := range p.GameState().Participants().Playing() {
            if pl == nil || pl.SteamID64 == 0 { continue }
            sid := pl.SteamID64
            pos := pl.Position() // ⚠ demoInfoProvider deref — MUST stay in this live closure, never in a pure fn
            if !cur.sampled[sid] {
                cur.sampled[sid], cur.posAnchor[sid] = true, pos
                continue
            }
            if d := pos.Sub(cur.posAnchor[sid]).Norm(); d > cur.posMaxDisp[sid] {
                cur.posMaxDisp[sid] = d
            }
        }
    })
    ```
  - [x] **Feed the `acted` flag from the EXISTING action handlers — no new action handler.** In the `events.WeaponFire` handler (add one if none exists — it is a new registration, warmup-skipped, `idOf(e.Shooter)`), the existing `events.PlayerHurt` handler ([parse.go:724](worker/ingest/parse.go#L724): set `acted` for `a := idOf(e.Attacker)` where `a != 0`, right where `adrDamage` is credited), and a grenade-throw handler (`events.GrenadeProjectileThrow`, `idOf(e.Projectile.Thrower)` — utility), set `cur.acted[sid] = true`. **Damage means damage DEALT** (attacker side), consistent with ADR.
  - [x] **⚠ Position() and the dead player — accepted, documented.** After a player dies, `Position()` may return the last live position (frozen) or the zero vector. Either is SAFE for idle: a frozen position keeps `maxDisp` where it was (a player who moved while alive already exceeded epsilon → not idle; one who stood still and died registers idle, the correct AFK verdict); a jump to the zero vector inflates `maxDisp` → not idle (the safe direction). So this story does **NOT** track aliveness for sampling and does **NOT** stop sampling at death. Pin this reasoning in the handler comment with the SM-C1 "never wrongly DQ" rationale. A tighter alive-windowed sampler is a **deferred 5v5 refinement** (same posture as 5.3's `Participants().Playing()` team-filter limitation) — file it to deferred-work, do not build it here.

- [x] **Task 6 — Close out idle at `RoundEnd`, and fold (AC: 2, 3)**
  - [x] In the `RoundEnd` handler, **inside the existing `Participants().Playing()` loop** that computes the KAST close-out ([parse.go:843-850](worker/ingest/parse.go#L843)) — reuse that same walk, do NOT add a second one — mark presence and compute the idle verdict for the completed round:
    ```go
    cur.present[pl.SteamID64] = true
    if cur.isIdleRound(pl.SteamID64, afkPositionEpsilon) { cur.idleRound[pl.SteamID64] = true }
    ```
    The commit at [parse.go:853](worker/ingest/parse.go#L853) (`byRound[idx] = cur`) then carries the FR-21 scratch on the same trap-4 assign as everything else — a discarded pre-match round's idle state is overwritten by its replay.
  - [x] In `foldRounds` ([parse.go:355-477](worker/ingest/parse.go#L355)), under the same `idx > final` stranded-round bound as every other stat, accumulate two per-player tallies across surviving rounds: `idleCount` (Σ `idleRound`) and `presentCount` (Σ `present`). After the fold, set on each `PlayerStat`:
    ```go
    s.IdleRoundCount = idleCount[sid]
    // idle_dq at >= 50%: integer ratio, no float. present == 0 (a player with a row but never Playing at any
    // RoundEnd) is NOT DQ'd — undecidable, safe direction.
    s.IdleDQ = presentCount[sid] > 0 && idleCount[sid]*afkIdleDQDenom >= presentCount[sid]*afkIdleDQNumer
    ```
  - [x] **⛔ Do NOT compute `idle_dq` at event time or per round.** The ratio is over the whole match, so it can only be decided after the fold. And `idle_round_count` must come from `cur`/`foldRounds`, never a bare `stats[k].IdleRoundCount++` (the trap-4 discipline — a bare counter carries the discarded pre-match round).

- [x] **Task 7 — Widen the single-writer upsert and BOTH mapping sites (AC: 3, 4)**
  - [x] Add `IdleDQ bool` + `IdleRoundCount int` to `StatRow` in [worker/db/db.go](worker/db/db.go#L145) with the FR-21 grouping comment; update the struct doc (it currently says the idle columns "stay NULL").
  - [x] `upsertStatRows` ([db.go:412-445](worker/db/db.go#L412)): add `idle_dq, idle_round_count` to the INSERT column list, two new placeholders **`$23, $24`** (both plain — no `::jsonb`), the two values (`row.IdleDQ, row.IdleRoundCount`) appended to the `batch.Queue` argument list **after `clutches`**, **and** two `<col> = excluded.<col>` lines in the `DO UPDATE` set-list.
  - [x] **⚠ INVARIANTS THAT MUST SURVIVE ([db.go:404-411](worker/db/db.go#L404)):** `status` stays ABSENT from the `DO UPDATE` set-list (an approved row stays approved across a re-parse — AD-7). The bracket `match_id` stays ABSENT from **BOTH** lists (adding it writes `match_id = NULL` and unbinds every match on re-parse). **Re-read both comment blocks and leave them intact.**
  - [x] Renumbering check: the placeholders are positional. After inserting two, verify `$1..$24` line up 1:1 with the argument order — a silent off-by-one writes the wrong stat into the wrong column and **no unit test catches it** (the fakes store the struct, never execute SQL — [db.go:439-441](worker/db/db.go#L439)).
  - [x] [worker/ingest/cli.go](worker/ingest/cli.go#L136) first-parse map: add `IdleDQ` + `IdleRoundCount` (unconditional). Fix the now-stale comments at [cli.go:100-101](worker/ingest/cli.go#L100) and [cli.go:121-122](worker/ingest/cli.go#L121) — after this story **no column stays NULL** (drop "only FR-21's idle columns stay NULL").
  - [x] [worker/ingest/reparse.go](worker/ingest/reparse.go#L96) re-parse map: add the same two under the existing "⚠ MUST mirror cli.go's first-parse map verbatim" warning, and **update its count** ("all FIFTEEN derived fields" → **seventeen**) at [reparse.go:104-108](worker/ingest/reparse.go#L104), or the warning stops describing what it guards.
  - [x] **This is the recurring Epic-4/5 failure mode** — a field mapped in `cli.go` but dropped in `reparse.go` writes correct values on first parse then **destroys that column on every re-parse**. Widen both sites in the same edit and prove both with tests.

- [x] **Task 8 — Relax the conservation gate (AC: 7)**
  - [x] In [worker/ingest/validate.go](worker/ingest/validate.go#L40), change Gate 1 from `if k != d` to **`if k > d`** — flag only the over-count. Update the `Detail` to name the direction, and rewrite the gate comment ([validate.go:32-34](worker/ingest/validate.go#L32)) to say: `Σkills > Σdeaths` is impossible in a completed match (every kill is exactly one death) and means a double-counted kill; the normal `Σkills < Σdeaths` under-count (an unattributed fall/world/bomb death) is EXPECTED and no longer held. Cite the Epic-3 retro decision ([sprint-status.yaml:197-200](_bmad-output/implementation-artifacts/sprint-status.yaml#L197)).
  - [x] **Do not touch Gate 2 (`empty_stats`) or Gate 3 (`unreconciled`)**, and add no FR-21 validation gate — an all-zero `idle_round_count` is the EXPECTED result, not an anomaly (that is THE BAR's job to prove, not `Validate`'s to flag). Update the stale [validate.go:23-24](worker/ingest/validate.go#L23) partial-safety-net note if the relaxed direction changes what the skip-guard imbalance now surfaces (a dropped id's leftover imbalance is only caught if it makes `Σkills > Σdeaths`).

- [x] **Task 9 — Tests (unit) + mandatory mutation testing (AC: 2, 3, 4, 7)**
  - [x] `TestIsIdleRound` in [worker/ingest/parse_test.go](worker/ingest/parse_test.go), pure over `roundStats` (build the maps directly, no demo): unsampled player → **not idle** · sampled + no action + `maxDisp < epsilon` → **idle** · sampled + `maxDisp >= epsilon` (moved) → **not idle** · sampled + `acted` (even with `maxDisp == 0`) → **not idle** · the `maxDisp == epsilon` boundary → **not idle** (strict `<`).
  - [x] `TestIdleDQThreshold` — the fold's `idle*Denom >= present*Numer` boundary as a pure table over ints: 0/10 → false · 4/10 → false · exactly 5/10 (50%) → **true** · 6/10 → true · 10/10 → true · `present == 0` → **false** (no div-by-zero, safe direction).
  - [x] Extend `TestFoldRoundsDropsStrandedRounds` (or add `TestFoldRoundsAfkIdle`): `idleRound`/`present` fold across surviving rounds, respect the `idx > final` bound, a stranded round contributes nothing, and `idle_dq` is computed from the folded ratio (include a case where a stranded idle round would have flipped the verdict if not dropped).
  - [x] `TestArmLiveWindowResetsAfkState` (or extend the existing `TestArmLiveWindowResetsBothHalvesOfTheFR20State`): a re-arm clears `acted`/`posAnchor`/`posMaxDisp`/`sampled`/`present`/`idleRound`, so an aborted attempt's movement/action cannot leak into the committed round.
  - [x] Widen `cannedParse()` in [worker/ingest/cli_test.go](worker/ingest/cli_test.go) with **distinct-per-field** `IdleDQ`/`IdleRoundCount` values (at least one player `IdleDQ:true` with a non-zero count, one `false` with `0`, no two adjacent fields sharing a value so a copy/paste swap reddens). Extend `assertDerivedStats` to cover **all seventeen** derived fields, called from **both** the `cli_test.go` first-parse and the `reparse_test.go` re-parse happy paths.
  - [x] **AC3 zero-case:** extend the zero-stats test (`TestRunCLIZeroWeirdStatsRecordedAsZeroNotOmitted` sibling) so a never-idle player produces a `StatRow` with `IdleRoundCount == 0` and `IdleDQ == false` **written**, not skipped/NULL. State in the comment what no Go test can reach (0-vs-NULL at the SQL level — the fakes store the struct).
  - [x] `TestValidateConservationFlagsOnlyOvercount` in [worker/ingest/validate_test.go](worker/ingest/validate_test.go): `Σkills > Σdeaths` → conservation reason present · `Σkills < Σdeaths` → **no** conservation reason (the relaxation — this is the AC7 money test) · `Σkills == Σdeaths` → no reason. Keep the existing empty_stats / unreconciled cases green.
  - [x] **Mutation testing is MANDATORY before review** ([memory: mutation-test-suite-before-review]). Per effect, each must redden a **named** test: drop `IdleDQ` from `cli.go`'s map · drop `IdleRoundCount` from `cli.go`'s map · drop each from `reparse.go`'s map · remove the `!sampled` guard · remove the `acted` guard · invert `maxDisp < epsilon` to `>` · flip the DQ threshold to `>` (strict, so exactly-50% no longer DQs) · swap `present`/`idle` in the DQ ratio · change `validate.go`'s `k > d` to `k != d` (the under-count case reddens) and to `k < d`. Restore and re-verify green. Record the table in Debug Log References. **A suite that survives these is blind.**
  - [x] Gates in `worker/`: `gofmt -l .` empty · `go build ./...` 0 · `go vet ./...` 0 · `go test ./... -count=1` all ok.
  - [x] **Known, disclosable coverage limits (do not paper over them):** (a) the SQL `DO UPDATE` set-list and the positional `$1..$24` argument order are unreachable by the in-memory fakes (the accepted 4.6a/5.1/5.2/5.3 precedent — mirror the live-verified lines structurally and say so). (b) The `FrameDone` handler body (the `Position()` deref) and the action-flag call lines cannot be driven by `FakeParser` — **THE BAR is their coverage**, and Task 10 makes that coverage *positive* (a measured, non-degenerate displacement distribution), not an argument.

- [x] **Task 10 — THE BAR: live-QA over the real demos (AC: 2, 3, 5)**
  - [x] Build `worker/cmd/qa54` (throwaway, same pattern as `qa53`) running the **real** `ingest.DemoinfocsParser` over the 14 `.dem.gz` in `demos/` (gzip — stream through `gzip.NewReader`). Usage `go run ./cmd/qa54 ../demos`.
  - [x] **🚨 GATE A — PROVE `FrameDone` FIRES AND `Position()` IS ALIVE (trap 2, the whole point of AC5).** Count `events.FrameDone` per demo and print the total; **if 0, STOP.** For a sample of players/rounds, print the **displacement distribution** (min / median / max `posMaxDisp`). The expected finding is displacements of **hundreds to thousands of game units** per player per round. **If every displacement is ~0 (a degenerate `Position()` signal), STOP and report — a live-idle-flag on every player would DQ the whole tournament.** Report the measured numbers, not the conclusion.
  - [x] **🚨 GATE B — PROVE THE ALL-`false` `idle_dq` POSITIVELY (the 5.3 GATE-2 discipline).** Print, per player per demo: `idle_round_count`, `idle_dq`, the count of rounds where they `acted`, and their median round displacement. The expected finding is **`idle_dq = false` for every player, `idle_round_count` ≈ 0**, backed by "acted in ~every round" and "moved hundreds+ of units every round." **If any player is `idle_dq = true`, do not sign off — investigate** (real AFK, or a broken signal). A zero argued from "it's a tournament" is not accepted.
  - [x] **Conservation-relax live check (AC7):** confirm all 14 demos still balance `Σkills == Σdeaths` (so the relaxed `k > d` gate stays green on real data), and note that the relaxation only *widens* what passes (an under-count that used to flag now passes) — the demos don't exercise the under-count, so the unit test (Task 9) is its real proof; say so.
  - [x] **Regression net — 5.1 + 5.2 + 5.2a + 5.3 must be UNPERTURBED on 14/14** (idle sampling must not touch any prior stat): `Σkills == Σdeaths == RoundsPlayed` · `ΣRoundsWon == RoundsPlayed` · `Σentry_frags == Σopening_deaths` · the weird five reproduce exactly (**knife 1 · wallbang 8 · smoke 2 · noscope 0 · blind 4**, blind at round indices **[3 5 9 13]**) · GATE-2 team sizes still `T:1 CT:1` and Σclutches 0. Carry these forward from `qa53` so nothing is lost.
  - [x] Print the total **parse wall-time** per demo (AC6/SM-5 sanity): per-frame `Position()` sampling must keep the parse in seconds, far under the SM-5 P50 < 5 min budget. Report it; do not assume it.
  - [x] **Task 10b — the owed cleanup.** `qa53` is 5.3's throwaway harness; its regression net is carried forward above. **Delete `worker/cmd/qa53/`** in this story's commit (the per-story pattern: ship `qaNN`, fold the prior net forward, delete `qa(NN-1)`). Note the deletion in the File List.

### Config surfacing (AC6) — what this story owes forward

The `verification_bundle` row is produced by the **awards producer in Epic 6** ([epics.md:992](_bmad-output/planning-artifacts/epics.md#L992), [SOLUTION-DESIGN.md:235-245](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L235)); this story cannot write it (the table doesn't exist yet — prohibition 3). What 5.4 owes is that the fairness-affecting values are **reproducible config-of-record**: `afkPositionEpsilon`, the per-frame cadence, and the ≥50% threshold pinned as documented constants (Task 1), plus a **handover note** (Completion Notes) listing them alongside the FR-21 floors (24 rounds / 20 kills, [prd.md:519](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L519)) so Epic 6 knows exactly which values to serialize into the bundle. Do not invent a bundle schema here.

## Dev Notes

### Framing: 5.4 is the first Epic-5 story that reads a per-TICK signal — and the one most exposed to the 5.2a trap since 5.2a itself

5.1/5.2/5.3 all derived from the **event** stream. 5.4 adds a **per-tick** sampler (`events.FrameDone` + `Player.Position()`), which is (a) a `demoInfoProvider` deref, the exact hazard class 5.2a/5.3 routed around, and (b) a signal whose *silence looks like data*: a dead `Position()` doesn't error — it makes everyone look motionless. Read [worker/ingest/parse.go](worker/ingest/parse.go) top to bottom before editing — especially the `roundStats` doc comment (why commit-whole-round-then-ASSIGN), the four-trap block above `RoundEnd`, and the `armLiveWindow` re-arm reset. The per-round machine (`cur`, `RoundEnd` commit keyed on `TotalRoundsPlayed()`, the `roundStarted` guard, the `foldRounds` survivor bound) is **already correct and must not be restructured** — your idle state rides it exactly like the weird five and the derived three.

### ⚠ The 5.2a lesson, pointed at `Position()` (re-read this before trusting a single idle number)

Story 5.2 shipped `blind_kills` off `events.Kill.AttackerBlind` and reported `blind 0`, "proven by mode." The field was **dead**; measurement later found 4 genuinely-blind kills all reporting `false`. Had it shipped, one award reads 0 all tournament. **5.4's equivalent field is `Player.Position()`, and its blast radius is the entire awards system:** if `Position()` is degenerate on our `PBDEMS2`/Source-2 demos, every displacement is < epsilon, every round is idle, every player is `idle_dq`, and 5.5's view excludes *everyone* from *every* award. This is why AC5/GATE-A is non-negotiable: **prove `FrameDone` fires and `Position()` returns varying real coordinates first.** Two candidate zeros, graded differently (the 5.3 table, updated):

| Zero | Status | What you must do |
|---|---|---|
| `idle_dq` all-`false`, `idle_round_count` ≈ 0 | **Expected and correct** (a real tournament, nobody AFK) | Prove it *positively* — GATE B prints measured movement + action per round. A zero shown in data is proof; "nobody's AFK in a tournament" as prose is not. |
| Every displacement ≈ 0 / `idle_dq` all-`true` | **A DEFECT** — `Position()`/`FrameDone` is dead | GATE A exists to catch exactly this. Never rationalize it as "players held angles." |

### The exact demoinfocs v5.2.0 API (verified first-hand at contexting, from the pinned module cache)

- **`events.FrameDone{}`** — an empty struct dispatched once per demo frame ([events.go:19](https://pkg.go.dev/github.com/markus-wa/demoinfocs-golang/v5)). This is the per-tick hook the PRD addendum §4 warns "adds parse cost (per-tick sampling vs. event-only)" — bounded by SM-5, which has minutes of headroom. Register it warmup-skipped like every handler.
- **`common.Player.Position() r3.Vector`** ([common/player.go:413](https://pkg.go.dev/github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common)) — the player's feet position. **⛔ It routes through `PlayerPawnEntity()` → the unexported `demoInfoProvider`**, the SAME deref class as `IsAlive()`/`GetTeam()`. It nil-guards (returns the zero vector, does NOT panic like `GetTeam()`), but it is a live-state call **unusable from `FakeParser`** — so it lives ONLY in the `FrameDone` closure, never in a pure classifier. There is **no `Velocity()` accessor**; displacement is derived from position samples. `r3.Vector` (`github.com/golang/geo/r3`) has `.Sub(v)` and `.Norm()` — distance is `a.Sub(b).Norm()`.
- **`common.Player.SteamID64`, `.Team`, `.ButtonsPressedState`, `.IsBot`, `.IsConnected`** are **plain struct fields** ([player.go:14-34](https://pkg.go.dev/github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common)) — safe to read anywhere. `idOf(pl)` ([parse.go:597](worker/ingest/parse.go#L597)) already extracts `SteamID64` (0 for bot/world) safely.
  - *(Aside — a SAFE alternative movement signal you may consider but need NOT use: `Player.IsPressingButton(mask)` reads only the plain `ButtonsPressedState` field. But the spec is explicit — "position epsilon" ([SOLUTION-DESIGN.md:347](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L347)) — so `Position()` displacement is the prescribed signal; button-press is a possible cross-check, not the primary.)*
- **Action events** (all carry a `*common.Player` with a safe `SteamID64`): `events.WeaponFire{Shooter}` (shots), `events.PlayerHurt{Attacker,...}` (damage dealt — the `Attacker` side, already handled at [parse.go:724](worker/ingest/parse.go#L724) for ADR), `events.GrenadeProjectileThrow{Projectile.Thrower}` (utility thrown). Flip `cur.acted[sid] = true` from each.
- **Parser version is PINNED** — `ParserVersion = "demoinfocs-golang/v5 v5.2.0"` ([parse.go:17](worker/ingest/parse.go#L17)); stays in lockstep with `worker/go.mod` (AD-26). **Do not `go get -u`.** `FrameDone`, `Position()`, and the action events all exist in v5.2.0.

### The trap-4 pre-match round (measured, not hypothetical) — it applies to idle too

Every real MatchZy demo opens with a round that is played, won, then discarded — and it is **not** warmup, so `IsWarmupPeriod()` does not skip it. The game rewinds `TotalRoundsPlayed()`; the replayed round re-reaches the same index. Because idle state rides `cur` and is **ASSIGNED** into `byRound[idx]` at `RoundEnd`, the replay **overwrites** the discarded round, and `foldRounds` drops any index above `final`. So your `idle_round_count` and `present` denominator are scoreboard-consistent **only if they go through `cur`** — a bare `stats[k].IdleRoundCount++` at event time carries the discarded round (5.1 measured this +1 on 14/14; 5.2 measured a 15× knife over-count from the same mistake). The `armLiveWindow` re-arm reset (Task 3) is the twin of the 5.3 fix: it stops an aborted mid-round restart from leaking movement/action into the round that commits.

### Why the worker does NOT apply the floors (AD-20), and the cumulative-floor trap in full

AD-20 ([ARCHITECTURE-SPINE.md:175-178](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L175)): standings and their FR-21 floors are computed by a **single** SQL view/RPC over `status='approved'` rows, in exactly one place — **Story 5.5**. The worker is the single *writer* of raw facts (AD-2), not an eligibility judge. The eligibility inputs 5.5/6 read are `rounds_played`, `kills`, and `idle_dq` ([epics.md:1030](_bmad-output/planning-artifacts/epics.md#L1030), [SOLUTION-DESIGN.md:414](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L414)). The **≥24-round floor is summed across a player's approved matches** — a wingman match is ≤ ~22 rounds (5.3's corpus: 11–22), so per-match it would fail every player. `idle_dq`, by contrast, IS a per-match fact (a match is DQ'd or not) — which is exactly why the worker computes `idle_dq` per match but never the round/kill floor. Getting this split wrong is the story's headline trap (trap 1).

### The conservation-gate relax (AC7) — the pinned Epic-3 action item

`Validate` ([worker/ingest/validate.go](worker/ingest/validate.go)) runs three Story-3.4 gates. This story owns exactly one change to it, pinned at [sprint-status.yaml:197-200](_bmad-output/implementation-artifacts/sprint-status.yaml#L197): Gate 1's `if k != d` → `if k > d`. Rationale (Epic-3 retro): `Σkills > Σdeaths` is **impossible** in a completed match and signals a double-count (hold it); `Σkills < Σdeaths` is the **normal** unattributed-death under-count (fall/world/bomb deaths credit a death with no kill) and was over-flagging clean matches. This rides with 5.4 specifically because 5.4 is the only remaining Epic-5 story that legitimately touches the validation surface (5.2/5.3 were declared out of scope for it). Add no FR-21 gate — an all-zero `idle_round_count` is expected, not anomalous.

### Zero vs NULL (AC3), and already-parsed rows

`idle_round_count` is a Go `int` placed **unconditionally** in the INSERT list, so a never-idle player writes `0` by construction (never NULL). `idle_dq` is a Go `bool` written explicitly — note the column is already `not null default false`, so unlike the FR-20 columns a pre-5.4 row already reads `false` (correctly "not DQ'd", the fail-safe-toward-inclusion default) — but the worker must now write it through the upsert so a re-parse is deterministic and the value reflects the actual derivation. Rows parsed **before** this story keep `idle_round_count = NULL` (and `idle_dq = false`) until their demo is re-parsed via `RunReparse` (Story 3.6), which re-derives everything through this same upsert. Expected; **not** a backfill — flag it to 5.5 as 5.2/5.3 did.

### Project Structure Notes

- Files you will touch (all Go, all existing, all under `worker/`): `worker/ingest/parse.go` (config constants + `PlayerStat` + `roundStats` + `newRoundStats` + `armLiveWindow` + `isIdleRound` + new `events.FrameDone` handler + new `events.WeaponFire` + `events.GrenadeProjectileThrow` handlers + `acted` flag in the existing `PlayerHurt` handler + the idle close-out in the existing `RoundEnd` Playing() loop + `foldRounds`), `worker/db/db.go` (`StatRow` + `upsertStatRows` `$23/$24`), `worker/ingest/cli.go` (first-parse map + two stale comments), `worker/ingest/reparse.go` (re-parse map + the mirror-count warning fifteen→seventeen), `worker/ingest/validate.go` (Gate 1 relax + comment), plus `worker/ingest/parse_test.go`, `worker/ingest/cli_test.go`, `worker/ingest/reparse_test.go`, `worker/ingest/validate_test.go`.
- **New (throwaway):** `worker/cmd/qa54/main.go`. **Deleted:** `worker/cmd/qa53/` (Task 10b).
- **New import:** `github.com/golang/geo/r3` in `parse.go` (already an indirect dep of demoinfocs — confirm it resolves; it is a plain 3-float vector type).
- **No change needed** in `worker/db/fake.go` — `FakeStatRecorder` stores the whole `StatRow` struct, so it widens automatically. Read it and confirm; do not add per-field plumbing.
- **No file outside `worker/` changes.** `supabase/migrations/`, `app/`, `lib/` and every `.ts`/`.sql` file stay untouched.
- Naming/idiom: match the surrounding worker code — deterministic ordering (already sorted by SteamID64), fail-closed `recover()` on parser panic (already present), warmup + trap-4 discipline on every counted event, structured `log.Printf` warns (never silent).

### Testing standards

- Go unit tests via `go test ./...` in `worker/`; `go build ./...` and `go vet ./...` clean; `gofmt` clean. The suite injects `FakeParser`/`FakeStatRecorder`/`FakeRosterReader` — no real DB or `.dem` for unit tests.
- **Per-effect mutation testing is mandatory before review** (standing project rule, hard-won across Epic 4's 4.1–4.3 reviews — [memory: mutation-test-suite-before-review]). Report the table explicitly, survivors included.
- **Keep the DECISION pure, leave only the CALL in the closure.** `kastQualified` (5.1), `classifyWeirdKill` (5.2), `recordOpeningDuel`/`clutchTracker` (5.3) are the precedent; `isIdleRound` is the same move, and it is the single choice that decides whether AC2 is mutation-testable. The `Position()` deref is the one thing that CANNOT be pure — isolate it to the `FrameDone` closure and hand plain `float64` deltas out.
- THE BAR (Task 10) is the live-QA gate and, with the automated gates, the sign-off — as in every prior worker story. For 5.4 it carries the extra weight of proving the tick signal is alive (GATE A), because the failure mode is silent and tournament-wide.

### Git / previous-story intelligence

- **Story 5.3** (`1ee3348`, HEAD) — the immediate predecessor and the exact structural template: it added the first new handler (`RoundFreezetimeEnd`) + new round state (the live window + `clutchTracker`) + `armLiveWindow`, all riding `cur`. Its review found a re-arm asymmetry (the reset half-covered the FR-20 state) — **carry forward:** your `armLiveWindow` extension must reset ALL FR-21 maps. It also accepted a documented 5v5 limitation rather than relaxing the purity ban — the same posture 5.4 takes on alive-windowed sampling.
- **Story 5.2a** (`3a99d8c`) — the dead-field cautionary tale this story is *most* exposed to. `Position()` is 5.4's `AttackerBlind`. **Carry forward:** measure the signal (GATE A), never narrate a zero.
- **Story 5.2** (`aac2df1`) — logic inside an event closure is unreachable by every Go test; a transposition survived both the suite and THE BAR until the decision was pulled into a pure function. `isIdleRound` is that pure function here.
- **Story 5.1** (`5f2d236`) — built the per-round machine; its review found a refactor that silently dropped an idempotency property. **Lesson:** preserve existing behaviour comments *and the properties they claim* when touching `parse.go`.
- **Recurring Epic-4/5 lesson:** `reparse.go` is where widenings get dropped silently. Widen it in the same edit as `cli.go`, and update the mirror-count.
- Baseline for this story is `1ee3348` (HEAD, working tree clean apart from sprint-status).

## References

- Epic + AC: [epics.md:881-901](_bmad-output/planning-artifacts/epics.md#L881) (Story 5.4); Epic 5 intro [epics.md:823-825](_bmad-output/planning-artifacts/epics.md#L823); the comparator/eligibility inputs [epics.md:1030](_bmad-output/planning-artifacts/epics.md#L1030), [epics.md:1070](_bmad-output/planning-artifacts/epics.md#L1070)
- FR-21 verbatim (floors, idle rule, per-tick position note): [prd.md:314-321](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L314); floors are tunable starting defaults [prd.md:519](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L519), [prd.md:534](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L534); glossary [prd.md:108-109](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L108)
- SM-C1 (award credibility, validates FR-21): [prd.md:493](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L493); SM-5 latency budget (per-tick cost must fit) [prd.md:489](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L489), [prd.md:238](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L238)
- AFK/idle detection mechanism (per-tick `Player.Position()`, idle-round = delta<epsilon AND zero action; DQ ≥50%): [SOLUTION-DESIGN.md:345-348](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L345); the parsing-extension risk + the three decisions to lock (cadence, epsilon, precedence): [addendum §4](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/addendum.md#L75)
- AD-20 (one owner, one normalization site — the 5.4-writes / 5.5-computes split): [ARCHITECTURE-SPINE.md:175-178](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L175); AD-2 single writer [ARCHITECTURE-SPINE.md:85-88](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L85); published config → verification_bundle [ARCHITECTURE-SPINE.md:470-471](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#L470), [epics.md:897-899](_bmad-output/planning-artifacts/epics.md#L897), [epics.md:108](_bmad-output/planning-artifacts/epics.md#L108)
- verification_bundle table (Epic 6 owns the write): [SOLUTION-DESIGN.md:235-245](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L235); award floor config columns (Epic 6): [SOLUTION-DESIGN.md:168-169](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L168)
- The conservation-gate relax action item (pinned to 5.4): [sprint-status.yaml:197-200](_bmad-output/implementation-artifacts/sprint-status.yaml#L197)
- `stat_row` idle shells (exist since 0007, nullable/defaulted): [0007_stat_row.sql:47](supabase/migrations/0007_stat_row.sql#L47); "AFK-idle CREATED nullable here, POPULATED by Story 5.4" [0007_stat_row.sql:24-25](supabase/migrations/0007_stat_row.sql#L24)
- Parser: `PlayerStat` [parse.go:51-78](worker/ingest/parse.go#L51) · `kastTradeWindow` published-constant precedent [parse.go:80-86](worker/ingest/parse.go#L80) · `roundStats` + commit-then-assign [parse.go:96-145](worker/ingest/parse.go#L96) · `armLiveWindow` [parse.go:203-213](worker/ingest/parse.go#L203) · `recordOpeningDuel`/`clutchTracker` (pure-decision precedent) [parse.go:215-268](worker/ingest/parse.go#L215) · `foldRounds` [parse.go:355-477](worker/ingest/parse.go#L355) · the `RoundFreezetimeEnd` + `PlayerHurt` handlers [parse.go:711-747](worker/ingest/parse.go#L711) · four-trap block + `RoundEnd` Playing() loop + commit [parse.go:769-855](worker/ingest/parse.go#L769) · `idOf` [parse.go:597](worker/ingest/parse.go#L597) · pinned `ParserVersion` [parse.go:17](worker/ingest/parse.go#L17)
- Single writer / upsert: `StatRow` [db.go:145-185](worker/db/db.go#L145) · `upsertStatRows` (currently `$1..$22`) + the `status`/`match_id` exclusions [db.go:381-459](worker/db/db.go#L381) · fakes-don't-execute-SQL caveat [db.go:439-441](worker/db/db.go#L439)
- Both mapping sites (widen together): [cli.go:100-166](worker/ingest/cli.go#L100) · [reparse.go:96-129](worker/ingest/reparse.go#L96) (mirror-count warning [reparse.go:104-108](worker/ingest/reparse.go#L104))
- Conservation gate to relax: [validate.go:32-45](worker/ingest/validate.go#L32)
- THE BAR harness to model `qa54` on (and delete `qa53`): [worker/cmd/qa53/main.go](worker/cmd/qa53/main.go)
- Predecessor stories: [5-3-derived-stat-derivation.md](_bmad-output/implementation-artifacts/5-3-derived-stat-derivation.md) · [5-2a-blind-kills-live-source-amendment.md](_bmad-output/implementation-artifacts/5-2a-blind-kills-live-source-amendment.md) · [5-2-weird-demo-only-stat-derivation.md](_bmad-output/implementation-artifacts/5-2-weird-demo-only-stat-derivation.md) · [5-1-core-stat-derivation.md](_bmad-output/implementation-artifacts/5-1-core-stat-derivation.md)
- Memory: demos are gzip `.dem.gz` in `demos/` (decompress before ingest) [demos-folder-location]; 1v1 wingman format [tournament-format-1v1-wingman]; AttackerBlind dead-field precedent [cs2-attackerblind-not-populated]; mutation-test-before-review [mutation-test-suite-before-review]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code / bmad-dev-story), 2026-07-24. Baseline `1ee3348`.

### Debug Log References

**Gates (worker/):** `gofmt -l .` empty · `go vet ./...` 0 · `go build ./...` 0 · `go test ./... -count=1` all ok. `go mod tidy` promoted `github.com/golang/geo` from indirect → direct (the new `r3` import; no other module change).

**Mandatory per-effect mutation table (all KILLED by a NAMED test; 0 survivors):**

| # | Mutation | Named test that reddened |
|---|----------|--------------------------|
| M1 | drop `IdleDQ` from cli.go first-parse map (→ false) | `TestRunCLIHappyPathParsesAndUpserts` (assertDerivedStats) |
| M2 | drop `IdleRoundCount` from cli.go map (→ 0) | `TestRunCLIHappyPathParsesAndUpserts` |
| M3a | drop `IdleDQ` from reparse.go re-parse map | `TestRunReparseHappyPathReplacesAndBumpsGeneration` |
| M3b | drop `IdleRoundCount` from reparse.go map | `TestRunReparseHappyPathReplacesAndBumpsGeneration` |
| M4 | remove the `!sampled` guard in `isIdleRound` | `TestIsIdleRound` (unsampled → not idle) |
| M5 | remove the `acted` guard in `isIdleRound` | `TestIsIdleRound` (acted-but-motionless) |
| M6 | invert `maxDisp < epsilon` to `>` | `TestIsIdleRound` |
| M7 | DQ threshold `>=` → `>` (exactly-50% no longer DQs) | `TestIdleDQThreshold` (5/10 case) |
| M8 | swap `present`/`idle` in the DQ ratio | `TestIdleDQThreshold` (0/10 case) |
| M9 | validate.go `k > d` → `k != d` (under-count reddens) | `TestValidateConservationFlagsOnlyOvercount` |
| M10 | validate.go `k > d` → `k < d` (over-count reddens) | `TestValidateConservationFlagsOnlyOvercount` |
| M11 | drop the `deaths[sid] > 0` survival guard in `isIdleRound` (review-fix, 2026-07-27) | `TestIsIdleRound` (died-this-round → not idle, parse_test.go:599) |

Each mutation applied in isolation, the named test observed RED, then restored; full suite verified GREEN after every restore.

**Known, disclosed coverage limits (not papered over):** (a) the SQL `DO UPDATE` set-list and the positional `$1..$24` argument order are unreachable by the in-memory fakes (FakeStatRecorder stores the `StatRow` struct, never executes SQL — db.go:439-441); mirrored structurally against the live-verified lines and hand-recounted 1:1 (the accepted 4.6a/5.1/5.2/5.3 precedent). (b) The `FrameDone` handler body (the `Position()` deref) and the three action-flag call lines cannot be driven by `FakeParser` — **THE BAR (qa54) is their coverage**, and it is POSITIVE (a measured non-degenerate displacement distribution + an independent second-pass reconciliation), not an argument.

**THE BAR — qa54 over the 14 real demos (`go run ./cmd/qa54 ../demos`) → ALL INVARIANTS HELD:**
- 🚨 **GATE A** (trap 2, the whole point of AC5): `events.FrameDone` fired **750,311 times** across the 14 demos; per-round displacement distribution **min 387 / median 1550 / max 3312 game units** over 408 player-rounds. `Position()` is emphatically ALIVE and non-degenerate — the catastrophic "everyone motionless → everyone idle_dq → whole tournament DQ'd" failure is disproven BY MEASUREMENT, not argued. (qa54 also FAILS if median displacement < 1 unit, so GATE A can bite.)
- 🚨 **GATE B** (the 5.3 GATE-2 discipline): `idle_dq = false` for **EVERY** player on all 14 demos, `Σidle_round_count = 0`, each backed positively — every player acted in ~every round (mostly all rounds; the lowest was 10/11) and moved **~1000–2100 units median** per round. The expected all-false result is shown in data, never prose. An independent second raw pass re-derived the idle facts and reconciled 1:1 against the production aggregate on all 14/14 (the FrameDone/action closures are WIRED UP AND NON-DEAD).
- **AC7 conservation-relax live check:** all 14 demos balance `Σkills == Σdeaths == RoundsPlayed` exactly, so the relaxed `k > d` gate stays green on real data. The relaxation only WIDENS what passes (an under-count that used to flag now passes); the demos don't exercise the under-count, so `TestValidateConservationFlagsOnlyOvercount` is its real proof.
- **Regression net (5.1/5.2/5.2a/5.3) UNPERTURBED on 14/14:** `Σkills == Σdeaths == RoundsPlayed`, `ΣroundsWon == RoundsPlayed`, `Σentry_frags 204 == Σopening_deaths 204`, weird five **knife 1 · wallbang 8 · smoke 2 · noscope 0 · blind 4** with blind at round indices **[3 5 9 13]**, `T:1 CT:1` on 221 rounds, Σclutches 0.
- **Parse wall-time** 437 ms – 1.02 s per demo — far under the SM-5 P50 < 5 min budget; per-frame `Position()` sampling is comfortably within budget.

### Completion Notes List

- **Three deliverables, all under `worker/`, NO schema change** (idle columns exist since 0007:47): (A) FR-21 AFK/idle DQ — a new per-tick `events.FrameDone` `Position()` sampler feeding a PURE `isIdleRound(sid, epsilon)` classifier (idle = sampled && !acted && maxDisp < epsilon), `acted` fed by `WeaponFire`/`PlayerHurt`-attacker/`GrenadeProjectileThrow`, folded into `idle_round_count` + `idle_dq` (≥50% of PRESENT rounds, integer ratio, no float). (B) the conservation-gate relax (`validate.go` `k != d` → `k > d`). (C) the AFK config pinned as published build-time constants next to `kastTradeWindow`.
- **The Position() deref lives ONLY in the FrameDone closure**, handing plain `float64` deltas to the pure classifier — the same 5.2a-safe isolation as `IsBlinded()`. No `IsAlive()`/`GetTeam()`/pawn-property read in any pure/testable code.
- **Trap-1 respected:** the worker does NOT apply the ≥24-round / ≥20-kill floors. They gate eligibility CUMULATIVELY in Story 5.5's view (AD-20). The worker writes raw facts only.
- **AC6 config-of-record handed forward to Epic 6:** the values Epic 6 must serialize into the `verification_bundle` are `afkPositionEpsilon = 64.0` game units, the sampling cadence = **every `events.FrameDone`** (per-frame), and the idle-DQ threshold = **≥ 50%** (`afkIdleDQNumer/afkIdleDQDenom = 1/2`), alongside the FR-21 participation floors **≥24 rounds / ≥20 kills** (prd.md:519, applied in the 5.5 view, not here). This story pins them as constants; Epic 6 owns the physical `verification_bundle` write.
- **Zero-vs-NULL / already-parsed rows (flag to 5.5):** `idle_round_count` is written unconditionally so a never-idle player lands `0` (never NULL); `idle_dq` is written explicitly (its column is already `not null default false`, so a pre-5.4 row already reads false). Rows parsed BEFORE this story keep `idle_round_count = NULL` until their demo is re-parsed via `RunReparse` — expected, NOT a backfill.
- **Deferred (filed forward):** an alive-windowed position sampler (stop sampling at death) is a 5v5 refinement — same posture as 5.3's `Participants().Playing()` team-filter limitation. Not built here because the dead-player `Position()` behaviour (frozen or zero-vector) is already SAFE for idle in both directions.
- **Task 10b discharged:** `worker/cmd/qa53/` deleted; its regression net carried forward into `worker/cmd/qa54/`.

### File List

**Modified (worker/, all Go):**
- `worker/ingest/parse.go` — FR-21 config constants; `PlayerStat` IdleDQ/IdleRoundCount + doc; `roundStats` six FR-21 maps + `newRoundStats` init + `armLiveWindow` reset; pure `isIdleRound`; new `events.FrameDone` sampler + `events.WeaponFire` + `events.GrenadeProjectileThrow` handlers; `acted` flag in the existing `PlayerHurt` handler; idle close-out in the existing `RoundEnd` Playing() loop; `foldRounds` idle/present tallies + the idle_dq ratio; new `github.com/golang/geo/r3` import.
- `worker/db/db.go` — `StatRow` IdleDQ/IdleRoundCount + doc; `upsertStatRows` `idle_dq, idle_round_count` in the INSERT list, `$23/$24`, the two DO UPDATE set-list lines, and the two positional args after `clutches`.
- `worker/ingest/cli.go` — first-parse map + IdleDQ/IdleRoundCount; two stale "idle columns stay NULL" comments corrected.
- `worker/ingest/reparse.go` — re-parse map + IdleDQ/IdleRoundCount under the mirror warning; mirror-count fifteen → seventeen.
- `worker/ingest/validate.go` — Gate 1 relaxed `k != d` → `k > d`; gate comment + Detail + the partial-safety-net note rewritten.
- `worker/ingest/parse_test.go` — `TestIsIdleRound`, `TestIdleDQThreshold`, `TestFoldRoundsAfkIdle`, `TestArmLiveWindowResetsAfkState`; `r3` import.
- `worker/ingest/cli_test.go` — `cannedParse()` widened (distinct IdleDQ/IdleRoundCount per player); `assertDerivedStats` extended to all seventeen; `TestRunCLIZeroWeirdStatsRecordedAsZeroNotOmitted` extended for the FR-21 zero-case.
- `worker/ingest/validate_test.go` — `TestValidateConservation` → `TestValidateConservationFlagsOnlyOvercount` (over/under/equal); `TestValidateMultipleFailuresDeterministic` flipped to an over-count.
- `worker/go.mod` — `github.com/golang/geo` promoted indirect → direct (the `r3` import).

**Added:** `worker/cmd/qa54/main.go` (throwaway THE BAR harness).
**Deleted:** `worker/cmd/qa53/main.go` (Task 10b — prior net carried forward into qa54).

### Review Findings

_Code review 2026-07-27 (bmad-code-review, three adversarial layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). All load-bearing risk areas verified CLEAN: SQL `$1..$24` positional alignment 1:1, both mapping sites (`cli.go`/`reparse.go`) widened, all six FR-21 maps reset in `armLiveWindow`, stranded-round bound honored in the fold, `status`/`match_id` still ABSENT from DO UPDATE, AC7 relax + test correct, four prohibitions all intact. Two findings survived triage._

- [x] [Review][Patch] Killed-before-acting player can read `idle` in the 1v1 wingman format — `isIdleRound` ([parse.go:288](worker/ingest/parse.go#L288)) flags a round idle on `sampled && !acted && maxDisp < 64u`, and the dead-player note ([parse.go:874-880](worker/ingest/parse.go#L874)) calls "stood still and died reads idle" the *correct AFK verdict*. In a duel, a player who is rushed and killed **before firing / dealing damage and before moving 64u (≈1.2m) from the round's first-sample anchor** reads idle despite being active. At ≥50% of present rounds this sets `idle_dq=true` → excluded from every award in Story 5.5 (SM-C1 inverted for that player — the *unsafe* direction). Empirically all-`false` on the 14-demo corpus (qa54 GATE B, lowest acted 10/11) but the format-specific reasoning gap is unclosed: the story frames alive-windowed sampling as a *5v5-only* deferral, yet the false-idle risk is most acute in **1v1 wingman** — the `[[tournament-format-1v1-wingman]]` "it reads 0 because these are duels" trap. **Resolution (Cuatro, 2026-07-27): HARDEN NOW** — add a minimum-observation guard so a round is judged idle only when the player had a real opportunity to move (a killed-too-early round is undecidable → not idle, the same fail-safe-toward-inclusion posture as `!sampled`), plus tests + qa54 re-run. (blind+edge)
- [x] [Review][Patch] Relaxed conservation-gate `Detail` over-asserts a single cause [worker/ingest/validate.go:49] — the anomaly message reads `impossible over-count: a kill was double-counted`, but the file's own top comment ([validate.go:22-26](worker/ingest/validate.go#L22)) documents that a dropped non-17-digit id whose kills exceed its deaths produces the same `Σkills > Σdeaths`. The `Detail` should name both possible causes (double-counted kill **or** a dropped id) so an operator is not pointed at the wrong root cause. **APPLIED**: `Detail` now names both causes; `TestValidateConservationFlagsOnlyOvercount`'s exact-string assertion updated to match.

#### Review Fixes Applied (2026-07-27)

Both patch findings applied and verified — status → `done`.

1. **Idle survival guard** ([parse.go:288-303](worker/ingest/parse.go#L288)) — added `if rs.deaths[sid] > 0 { return false }` to `isIdleRound`: a player KILLED this round was involuntarily stopped, not idle-farming, so they are never idle. This closes the 1v1-wingman false-positive where a duelist rushed and killed near spawn (before moving ≥64u and before firing) read idle and, at ≥50% of rounds, was wrongly DQ'd from every award. **Why the survival fact and not a min-sample "alive long enough" proxy:** `Participants().Playing()` keeps listing a dead player, so the `FrameDone` sampler keeps sampling post-death — a sample-count proxy would be defeated by those frames. The event-stream `deaths[sid]` (already tallied + reset per round) is the robust signal, and it needs no new constant / map / signature change. Safe direction (SM-C1 "never wrongly DQ"); a truly-AFK-and-killed player is left unflagged, which the ≥24-round / ≥20-kill floors already handle. The dead-player note in the `FrameDone` handler ([parse.go:874-882](worker/ingest/parse.go#L874)) was rewritten — a dead player's frozen/zero-vector position is now moot because the classifier short-circuits on death.
2. **Conservation `Detail`** ([validate.go:49](worker/ingest/validate.go#L49)) — reworded to name both over-count causes.

**Verification:** `gofmt -l .` empty · `go vet ./...` 0 · `go build ./...` 0 · `go test ./... -count=1` all ok. **New mutation M11** (drop the `deaths[sid] > 0` survival guard) → `TestIsIdleRound` reddens at the new died-case (parse_test.go:599); restored → green. **THE BAR (qa54) re-run GREEN on 14/14** — GATE A unchanged (FrameDone 750,311×, per-round displacement min 387 / median 1550 / max 3312), GATE B still `Σidle_rounds 0` for every player (the harden touched no real verdict), and the 5.1/5.2/5.2a/5.3 regression net intact (Σentry/Σopening 204, Σclutches 0, T:1 CT:1 on 221 rounds, weird five 1/8/2/0/4 at blind idx [3 5 9 13]).

### Change Log

| Date | Change |
|------|--------|
| 2026-07-27 | Code review (bmad-code-review, 3 adversarial layers) + fixes. 1 decision-needed (killed-before-acting idle false-positive in the 1v1 wingman format) → Cuatro chose HARDEN NOW → applied as an event-stream survival guard (`isIdleRound` returns not-idle when `deaths[sid] > 0`); 1 patch (conservation-gate `Detail` reworded to name both over-count causes); 6 dismissed as noise/by-design/safe-direction. All primary risk areas (SQL `$23/$24` alignment, both mapping sites, `armLiveWindow` reset, DO UPDATE exclusions, AC7 relax, 4 prohibitions) verified clean. Both patches applied + verified: gofmt/vet/build/test clean, new mutation M11 killed, THE BAR (qa54) re-run GREEN on 14/14 (all-`false` idle_dq + full regression net unperturbed). Status → done. |
| 2026-07-24 | Story 5.4 implemented (baseline `1ee3348`, claude-opus-4-8). FR-21 AFK/idle DQ (`idle_dq` + `idle_round_count`) derived from a new per-tick `events.FrameDone` `Position()` sampler + a pure `isIdleRound` classifier, written through the one shared `upsertStatRows` (`$23/$24`) on both mapping paths; conservation gate relaxed to flag only the impossible `Σkills > Σdeaths` over-count (Epic-3 action item closed); AFK cadence/epsilon/50% pinned as published build-time constants for the Epic-6 verification_bundle. No migration/app/lib/.ts change. 11/11 mutations killed. THE BAR (qa54) green on 14/14 demos — GATE A: FrameDone fired 750,311× with median 1550-unit displacement (Position() alive); GATE B: idle_dq false for every player, proven positively. qa53 deleted. Status → review. |
