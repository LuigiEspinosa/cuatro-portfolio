---
baseline_commit: cc63e7a4d623dd299e88690b331d8e6cb13acb9c
---

# Story 5.1: Core stat derivation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a viewer,
I want each player's core CS2 stats computed from the demo,
so that the scoreboard reflects real in-game performance with no hand entry.

## Acceptance Criteria

**AC1 — the FR-18 core seven are derived per player, per match.**
**Given** the core-stats requirement (FR-18, AD-2),
**When** the worker derives a match,
**Then** it computes, per player: kills, deaths, assists, ADR, HS%, MVPs, flash assists, utility (molotov/HE) damage, and KAST (5 s trade window).

**AC2 — ADR uses the overkill-capped, scoreboard-matching convention.**
**Given** the ADR convention (a documented build-time constant: overkill-capped `HealthDamageTaken`),
**When** ADR is computed,
**Then** per-round damage is overkill-capped before aggregation so the number matches the in-game scoreboard.

**AC3 — single writer.**
**Given** the single-writer rule (AD-2),
**When** these stats are written,
**Then** they are written **only** by the worker via the service role into `stat_row` — no app/anon/authenticated path writes any of them.

_Traces: FR-18 · AD-2_

---

### What is actually stored vs. what is a ratio (READ THIS FIRST)

The AC names ADR, HS%, and KAST as **percentages/rates**, but `stat_row` deliberately stores the **raw numerators/counts**, not the ratios. The ratios are computed **once**, in Story 5.5's single leaderboard view/RPC (AD-20 "exactly one place"). The worker stores:

| AC stat | `stat_row` column (already exists, 0007) | What the worker writes | Ratio owner |
|---|---|---|---|
| kills | `kills` | count (already shipped by 3.3) | — |
| deaths | `deaths` | count (already shipped by 3.3) | — |
| assists | `assists` | count of kills with an assister (damage **+** flash, = scoreboard "A") | — |
| ADR | `adr_damage` **(int)** | **total** overkill-capped damage dealt | 5.5: `adr_damage / rounds_played` |
| HS% | `hs_kills` **(int)** | count of headshot kills | 5.5: `hs_kills / kills` |
| MVPs | `mvps` | count of `RoundMVPAnnouncement` for the player | — |
| flash assists | `flash_assists` | count of assists where `AssistedFlash` (a **subset** of `assists`) | — |
| utility damage | `utility_damage` | total capped HE + molotov/incendiary damage dealt | — |
| KAST | `kast_rounds` **(int)** | count of rounds the player got a **K**ill/**A**ssist/**S**urvived/was **T**raded | 5.5: `kast_rounds / rounds_played` |
| (rounds) | `rounds_played` | already filled by 3.3 (`result.RoundsPlayed`, same value on every row of the match) | denominator |

**Do NOT store a float ADR/HS%/KAST.** `0007_stat_row.sql:42` says verbatim: "ADR is computed in the Epic-5 leaderboard view from `adr_damage`." Storing a pre-divided ratio would (a) put the aggregation in two places (violates AD-20) and (b) lose precision the view needs for floor-gated normalization (FR-21/FR-22). Store integers; 5.5 divides.

## Tasks / Subtasks

> **NO MIGRATION. NO SQL. NO app/route/TS change.** Every target column already exists (nullable) in `stat_row` (migration `0007`, lines 41–47). This story widens **Go only**: the parser struct, the parser event handlers, the writer's upsert column list, both mapping sites, and the test fakes. Mirror exactly how Story 3.3 → 4.6a widened `PlayerStat`/`StatRow`/`upsertStatRows` for `rounds_won` **without a migration**.

- [x] **Task 1 — Widen the parser payload (AC: 1)**
  - [x] In [worker/ingest/parse.go](worker/ingest/parse.go), add fields to `PlayerStat`: `Assists`, `ADRDamage`, `HSKills`, `MVPs`, `FlashAssists`, `UtilityDamage`, `KASTRounds` (all `int`). Update the doc comment: the parser now fills the FR-18 core (the weird/derived/idle stats of FR-19/20/21 are still Epic 5.2–5.4).
  - [x] Define named, documented constants (the AC2 "build-time config"): `kastTradeWindow = 5 * time.Second` and the ADR overkill-cap convention (documented at the PlayerHurt handler: always `HealthDamageTaken`, never `HealthDamage`). Kept in `parse.go`, NOT `worker/config` (AD-25).

- [x] **Task 2 — Kill-derived stats + the pre-match-round correction (AC: 1, 2)**
  - [x] `events.Kill` handler: credits `HSKills` on `IsHeadshot`, `Assister` an assist (+ flash assist on `AssistedFlash`), and records the death `(victim, killer, p.CurrentTime())` for KAST.
  - [x] `events.PlayerHurt` handler: adds overkill-capped `HealthDamageTaken` to `ADRDamage`; when `Weapon.Type ∈ {EqHE, EqMolotov, EqIncendiary}` also to `UtilityDamage`. Skips warmup + world attacker.
  - [x] `events.RoundMVPAnnouncement` handler: keys the announced `Player` into `mvpByRound` (one per round, assignment/overwrite — it fires AFTER RoundEnd so it can't ride the scratch). Skips warmup.
  - [x] **⭐ HEADLINE — trap-4 correction applied to EVERY additive stat.** Instead of a bare `field++`, the additive stats (kills, deaths, assists, flash, hs, adr, utility) accumulate into a per-round scratch `cur` and are ASSIGNED into `byRound[TotalRoundsPlayed()]` at RoundEnd (assignment, not increment, so a MatchZy restart's replay OVERWRITES the discarded pre-match round — a bare event-time `counter++` would merge the two at the same rewound index). The final fold keeps only `idx <= final`. This unifies kills/deaths onto the corrected path. **Empirically confirmed at THE BAR: this fixes a latent Story-3.3 over-count** (see Completion Notes).

- [x] **Task 3 — KAST derivation (AC: 1)**
  - [x] Per round in `cur`: `gotKill`/`gotAssist` sets + `deathEvents []{victim,killer,at}`. Restart-safe via the same RoundEnd commit key as Task 2.
  - [x] At `events.RoundEnd`, over `GameState().Participants().Playing()` (participants only — benched/spectators excluded), the pure `roundStats.kastQualified` credits `kast[sid]` on K / A / Survived (not a victim this round) / Traded (killer died within `kastTradeWindow` after). Draws are committed too (a round still played).
  - [x] Folded only for surviving round indices (`foldRounds`), same trap-4 discipline as Task 2.

- [x] **Task 4 — Widen the single-writer upsert (AC: 3)**
  - [x] Added the seven fields to `StatRow` in [worker/db/db.go](worker/db/db.go).
  - [x] `upsertStatRows`: seven columns added to BOTH the `INSERT (...)` list AND the `ON CONFLICT DO UPDATE SET` list (`excluded.<col>`), exactly like `rounds_won`. Shared by `RecordParse` + `RecordReparse`. `status` and `match_id` kept ABSENT from both lists (bind-preservation invariant intact).

- [x] **Task 5 — Populate at BOTH mapping sites (AC: 1, 3)**
  - [x] [worker/ingest/cli.go](worker/ingest/cli.go) `parseAndRecord` first-parse map: seven fields copied.
  - [x] [worker/ingest/reparse.go](worker/ingest/reparse.go) re-parse map: same seven copied (the "second path" — with an inline warning comment). Both mutation-tested.

- [x] **Task 6 — Tests (unit) (AC: 1, 2, 3)**
  - [x] `cannedParse()` widened with distinct-per-field values; `assertCoreSeven` asserts all seven flow through BOTH `RecordParse` (cli_test happy path) and `RecordReparse` (reparse_test happy path) seams.
  - [x] KAST classifier four branches (K/A/S/T) + two non-qualifying death cases + trade-window boundary (inclusive at 5 s, exclusive just over, killer-before-victim) + `foldRounds` trap-4 drop-above-final, all as pure unit tests. **Mutation-verified**: dropping a mapping field (cli or reparse), inverting the KAST "survived" branch, and neutering the fold bound each reddened a test; restored + re-verified green. (The SQL `DO UPDATE` set-list is not reachable by the fakes — covered live at THE BAR, per the 4.6a `rounds_won` precedent.)

- [x] **Task 7 — THE BAR: live-QA over the real demos (AC: 1, 2)**
  - [x] Ran the **real** `ingest.DemoinfocsParser` over all 14 `.dem.gz` in `demos/` (streamed via gunzip, throwaway harness, since these are 1v1 duel demos — 2 players each). **All invariants hold on 14/14**: `Σkills == Σdeaths` (Δ=0 everywhere); ADR `adr_damage/rounds` 32.9–94.5 (believable — low values are the losers of lopsided duels); `hs_kills ≤ kills`; `0 ≤ kast_rounds ≤ rounds`; `flash_assists ≤ assists`; `utility_damage ≤ adr_damage`.
  - [x] `Σmvps = 0` on all 14 — **settled as a real property, not a bug**: a raw diagnostic counted `RoundMVPAnnouncement total=0` (these MatchZy 1v1 duel demos emit no round-MVP events). The handler is correct; a 5v5 demo would emit them. `assists=0`/`flash=0` likewise correct (no teammates in 1v1); `KAST==kills` correct (in 1v1 the killer survives→K, the victim can't be traded).
  - [x] **⭐ Trap-4 kills question SETTLED — a latent bug was corrected.** Raw diagnostic: every MatchZy demo has one MORE non-warmup RoundEnd than final rounds (22 vs 21, 11 vs 10) — the pre-match round. The OLD bare kill counter tallied `rounds+1` (raw kills = 22, 11), while the new per-round fold gives Σkills = rounds exactly (21, 10). So Story 3.3's shipped kills/deaths were silently over-counting by the pre-match round; unifying them into the fold **fixes it as 5.1 lands**.
  - [x] **Utility-damage weapon filter verified live:** raw weapon breakdown vs stored `utility_damage` matches exactly (alzate-kamurai: `HE 30 + Incendiary 3` = stored `33`). Fire damage attributes to `EqIncendiary` (in the set); no fourth type appeared — set unchanged.

### Review Findings

_Code review 2026-07-19 (bmad-code-review, Opus 4.8 — 3 parallel layers: Blind Hunter / Edge-Case Hunter / Acceptance Auditor over the working-tree diff vs baseline `cc63e7a`). All automated gates re-verified green independently (build 0 / vet 0 / `go test ./...` pass / gofmt clean); the two mapping-site + KAST-survived guards mutation-tested by the reviewer (both reddened, restored green). AC1/AC2/AC3 + scope discipline + bind-preservation all CONFIRMED by the Acceptance Auditor._

- [x] [Review][Decision→Patch APPLIED 2026-07-19] Duplicate `RoundEnd` at a stable index destroys that round's additive stats + mis-credits KAST — `worker/ingest/parse.go` RoundEnd handler. Found HIGH by Blind Hunter, echoed by Acceptance Auditor + Edge-Case Hunter. The commit was a **destructive assign** (`byRound[idx] = cur; cur = newRoundStats()`), not idempotent: a second `RoundEnd` for the same `TotalRoundsPlayed()` (no round played between) re-assigned the freshly-reset empty `cur`, wiping kills/deaths/assists/hs/adr/utility for that round AND filling `cur.kast` with false "survived" credits for every `Playing()` player (empty `deathEvents` → all survive). `RoundsWon` did NOT lose this — it recomputes `winners` from `e.WinnerState.Members()` every call; the additive+KAST path had become asymmetric. The diff had **removed** the old code's explicit line _"It also makes a duplicate RoundEnd for one round idempotent. Verified."_ — a defensive property silently dropped by the refactor. NOT observed on the 14-demo BAR corpus (`Σkills==Σdeaths`, `kills==rounds` held 14/14) — a latent robustness regression, not a demonstrated miscount.
  - **FIX (Cuatro chose restore-idempotency):** added a `roundStarted` flag set by a new `events.RoundStart` handler + a `if !roundStarted { return }` guard at the top of the `RoundEnd` handler (reset to false on each commit). A duplicate `RoundEnd` (no intervening `RoundStart`) is skipped, so an empty scratch never overwrites a committed round nor false-credits KAST. Trap-4's legitimate replay is unaffected — a real `RoundStart` fires for it, so `roundStarted` is true and the rewound-index overwrite still happens. The `RoundStart` flag was chosen over moving the `cur` reset to `RoundStart` (which would reintroduce the post-`RoundEnd` scratch aliasing the immediate reset prevents) and over an empty-`cur` check (a genuine no-engagement save round is also "empty" but must still commit its KAST-survived credits). **Behavior-preserving on the happy path by construction:** every real round fires a `RoundStart`, so every legitimate `RoundEnd` still commits exactly as before — the 14/14 BAR results cannot regress. Gates re-verified: build 0 / vet 0 / `go test ./...` pass / gofmt clean.
  - **Coverage boundary (honest disclosure):** the guard lives in the parser's event-handler closure, which the in-memory `FakeParser` does not drive — so, like the SQL `DO UPDATE` set-list (Known unit-test limit), no fake-reachable Go unit test reddens if the guard is removed. Its correctness is established by reasoning + happy-path preservation; a duplicate-`RoundEnd` demo would confirm it live. Recommend re-confirming on the next real THE BAR run (the throwaway `qa51` harness was deleted, so it was not re-run for this fix).

- [x] [Review][Defer] KAST per-round-at-RoundEnd model edge cases — `worker/ingest/parse.go:413-419` — deferred, inherent to the model + does not bite a fixed-roster 1v1 tournament. (a) A mid-round joiner in `Participants().Playing()` at RoundEnd with no death event banks a false "survived" KAST round; (b) a player who fragged then disconnected before RoundEnd is dropped from the KAST loop though their kill is folded (internally inconsistent row); (c) a trade completed in the next round's freeze-time (still inside the 5s window) is missed because the window is evaluated over `cur` at RoundEnd.
- [x] [Review][Defer] KAST "traded" credits an unattributed (world/suicide, `killer==0`) death of the killer as a trade — `worker/ingest/parse.go:141-146` — deferred, a self-consistent convention choice (the boundary test asserts it as intended); revisit if the leaderboard wants strict "killed-by-a-player" trades.
- [x] [Review][Defer] Self-inflicted damage inflates ADR + UtilityDamage — `worker/ingest/parse.go:329-347` (only `attacker==0` filtered, no `attacker==victim` guard) — deferred, the PoC's unfiltered sum matched the scoreboard golden values and THE BAR ADR values were believable; add an `attacker==victim` skip if a 5v5 demo reads high.
- [x] [Review][Defer] Per-player ratio denominator uses match-wide `RoundsPlayed` — `worker/ingest/cli.go:140` / `reparse.go:102` — deferred, this is Story 5.5's concern (the view divides by `RoundsPlayed`) and is inherited from `RoundsWon`; a substitute/late-joiner would read artificially low KAST%/ADR, but fixed 2-player 1v1 rosters never trigger it.
- [x] [Review][Defer] SQL `DO UPDATE` set-list not reachable by the in-memory fakes — `worker/db/db.go:349-361` — deferred, disclosed by the dev (Known unit-test limit) and consistent with the 4.6a `rounds_won` precedent: dropping `assists = excluded.assists` etc. reddens no Go test; covered by a live re-parse (THE BAR family) + structural mirroring of the verified `rounds_won` line.

## Dev Notes

### The single most important framing

**This is the direct sequel to Story 3.3 and Story 4.6a**: the worker already parses a demo into `stat_row` and is already the single writer (AD-2). Story 3.3 shipped `kills`/`deaths`/`rounds_played`; Story 4.6a added `rounds_won`. **All seven Epic-5-core columns already exist, nullable, since `0007`** (`assists, adr_damage, hs_kills, mvps, flash_assists, utility_damage, kast_rounds`). Your job is to widen the parser + writer to fill them — you are walking a paved road, not laying schema.

The PoC (`_bmad-output/planning-artifacts/research/poc-cs2-demo-parse/main.go`) **already implements** kills/deaths/assists/HS/ADR/utility-adjacent handlers against real demos and prints a verified table. Treat it as reference implementation; do not re-derive from scratch.

### Exact demoinfocs v5.2.0 API (re-verified at contexting)

Pinned parser: `demoinfocs-golang/v5 v5.2.0` (`parse.go:16` `ParserVersion` — keep in lockstep with `worker/go.mod`). Verified field shapes:

- `events.Kill{ Killer, Victim, Assister *common.Player; Weapon *common.Equipment; IsHeadshot, AssistedFlash, AttackerBlind, NoScope, ThroughSmoke bool; PenetratedObjects int }`. A single `Assister` field carries **both** damage and flash assists; `AssistedFlash` flags the flash case. So **assists** = every kill with a non-nil `Assister` (matches the CS2 scoreboard "A", which includes flash assists); **flash_assists** = that subset where `AssistedFlash` is true. `Killer`/`Victim`/`Assister` may be nil (world/corrupt) — reuse the existing `get()`/`getByID()` nil-and-id-0 guards.
- `events.PlayerHurt{ Player, Attacker *common.Player; Weapon *common.Equipment; HealthDamageTaken int (overkill-capped); HealthDamage int (raw/uncapped); ... }`. **Use `HealthDamageTaken`** (AC2 — matches the scoreboard). `HealthDamage` is raw/uncapped — do not use it.
- `events.RoundMVPAnnouncement{ Player *common.Player; Reason RoundMVPReason }`. One per counted round (unless the round has no MVP, e.g. some draws).
- `events.RoundStart` / `events.RoundEnd{ Winner common.Team; WinnerState, LoserState *common.TeamState (nil on draw) }` — round boundaries; already handled for `RoundsWon`.
- `p.CurrentTime() time.Duration` — ingame time since demo start; timestamp deaths/kills with it for the KAST 5 s trade window.
- Equipment types (`common.EquipmentType`): `EqKnife`, `EqHE`, `EqMolotov`, `EqIncendiary`. `e.Weapon` may be nil — guard it.
- Player liveness: `player.IsAlive()` for KAST "survived"; `GameState().Participants().Playing()` for the on-T/CT participant set.

### The pre-match-round trap, extended (the headline correctness risk)

`parse.go` trap-4 (L147–160) documents that **every real MatchZy demo opens with a non-warmup round that is played, won, then discarded** when MatchZy restarts the match (`MatchStartedChanged true→false→true`, `ScoreUpdated 1→0`). `RoundsWon` survives this because it tallies into a **map keyed on `TotalRoundsPlayed()`** and a restart rewinds that counter, so the replayed round **overwrites** the discarded one; the final fold then drops any index above the final count.

The existing `Kills`/`Deaths` counters do **not** have this correction — they `++` on a bare `IsWarmupPeriod()` skip, and the pre-match round is not warmup. So a naive "add a `k.HSKills++` next to `k.Kills++`" reproduces the trap on every new additive stat. The right fix — and it unifies the design — is to **buffer additive stats per round index and fold only the surviving indices**, exactly as `RoundsWon` does:

```
// pseudocode — buffer per counted round, fold survivors at the end
type roundAccum struct {
    kills, deaths, assists, adrDamage, hsKills, mvps, utilityDamage map[uint64]int
}
byRound := map[int]*roundAccum{}   // key = TotalRoundsPlayed() at event time
// ... handlers write into byRound[p.GameState().TotalRoundsPlayed()] (skip warmup) ...
final := p.GameState().TotalRoundsPlayed()
for idx, ra := range byRound {
    if idx > final { continue }    // a stranded round from a restart/rewind — the game drops it, so do we
    // fold ra into each player's PlayerStat totals
}
```

This also means `kills`/`deaths` become scoreboard-correct here (a latent-bug fix landing with 5.1 — verify at THE BAR whether they were already off). KAST is naturally per-round already (Task 3), so it slots into the same keyed/fold discipline. If you keep the existing additive `Kills`/`Deaths` handlers unchanged and only buffer the *new* stats, you get scoreboard-correct new stats but leave the (possibly-wrong) old kills — acceptable only if THE BAR proves the old kills already match the scoreboard; otherwise unify.

### KAST definition (locked)

PRD FR-18 (prd.md:294) + glossary (prd.md:103): a round counts for KAST if the player got a **K**ill, an **A**ssist, **S**urvived, or was **T**raded, where "traded" means the player's killer died within **5 seconds** of the player's death. `kast_rounds` is the count of qualifying rounds; the percentage is `kast_rounds / rounds_played` in Story 5.5. Evaluate over **participating** players only (on a team at round end) so a benched player is not silently credited "survived" every round.

### The single-writer path (AD-2) — do not widen it, reuse it

`worker/db/db.go` is the sole writer of `stat_row` (owner/service-role connection, bypasses RLS). `upsertStatRows` is the **one** batch `INSERT … ON CONFLICT (matchzy_match_id, steamid64) DO UPDATE` shared by `RecordParse` and `RecordReparse`. Widen its two column lists once. **Invariants to preserve (db.go:311–333):** `status` stays out of `DO UPDATE` (an approved row stays approved across a re-parse — AD-7); `match_id` (the bracket id) stays out of **both** lists (it is written only by `0016` `bind_match_demo`; adding it would `= NULL` and silently unbind every bound match on every re-parse). Your seven new columns behave like `rounds_won`: present in both lists, `excluded.<col>` in the update, re-derived on every parse.

### No new validation gate

`Validate` (worker/ingest/validate.go) runs the three Story-3.4 anomaly gates (conservation, empty_stats, unreconciled). Adding assists/damage/HS/etc. does **not** change `Σkills == Σdeaths` and needs no new gate. **Do not add an anti-farm/idle gate here** — floors, AFK/idle DQ, and `idle_dq`/`idle_round_count` are **Story 5.4** and stay at their column defaults (`idle_dq=false`, `idle_round_count=NULL`).

### Project Structure Notes

- Files you will touch (all Go, all existing): `worker/ingest/parse.go` (struct + handlers), `worker/db/db.go` (`StatRow` + `upsertStatRows`), `worker/ingest/cli.go` (first-parse map), `worker/ingest/reparse.go` (re-parse map), plus the test files (`parse_test.go`, `db/fake.go`/`db/fake_test.go`, `cli_test.go`/`reparse_test.go`). No file outside `worker/` changes.
- **No migration file.** `supabase/migrations/` is untouched — asserting this is a scope check, not an omission. The `0007` shells were created precisely so Epic 5 "only widens the parser, never the schema" (0007:32–34).
- Naming/idiom: match the surrounding worker code — deterministic ordering (sort players by SteamID64, already done), fail-closed on parser panic (existing `recover`), warmup + trap-4 discipline on every counted event, and structured `log.Printf` warns (never silent).

### Testing standards

- Go unit tests via `go test ./...` in `worker/`; `go build ./...` and `go vet ./...` must be clean. The suite injects `FakeParser`/`FakeStatRecorder`/`FakeRosterReader` — no real DB or `.dem` needed for unit tests.
- Per-effect **mutation testing is mandatory** before review (standing project rule): each of the seven new columns must have a test that reddens when its write (in the upsert set-list) or its map (in either mapping site) is removed. A green suite that survives these mutations is blind.
- THE BAR (Task 7) is the live-QA gate: real parser over `demos/`, cross-checked against the PoC golden values and the in-game scoreboard. Automated gates + THE BAR together are the sign-off, as in every prior worker story.

### Git / previous-story intelligence

- Story 4.6a (`13dc05f`, done) is the exact template: it widened `PlayerStat` + `StatRow` + `upsertStatRows` + both mapping sites for `rounds_won`, **no migration**, and its review's two headline findings were both about mutation-blind tests (a probe that never reached the write). Read its parse.go trap commentary before touching handlers.
- Recurring Epic-4 lesson to pre-empt: the "second path" (re-parse) is where widenings get dropped silently. Widen `reparse.go` in the same commit as `cli.go`.

## References

- Epic + AC: [epics.md:823-847](_bmad-output/planning-artifacts/epics.md#L823-L847) (Epic 5 intro + Story 5.1)
- FR-18 (core stats, ADR/KAST definitions): [prd.md:288-294](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L288-L294); glossary ADR/KAST: [prd.md:101-103](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L101-L103); locked assumptions: [prd.md:532](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L532)
- `stat_row` column set (the nullable Epic-5 shells): [0007_stat_row.sql:41-47](supabase/migrations/0007_stat_row.sql#L41-L47) (esp. `:42` — ADR from `adr_damage` in the view); scope note "Epic 5 widens the parser, never the schema": [0007_stat_row.sql:24-34](supabase/migrations/0007_stat_row.sql#L24-L34)
- Parser + the trap-4 pre-match-round correction: [worker/ingest/parse.go](worker/ingest/parse.go) (`PlayerStat` L40-45; Kill handler L116-126; trap-4 fold L147-203)
- Single writer / upsert invariants: [worker/db/db.go](worker/db/db.go) (`StatRow` L138-146; `upsertStatRows` L316-356, esp. the `status`/`match_id` exclusion L326-333)
- Both mapping sites: [worker/ingest/cli.go:121-143](worker/ingest/cli.go#L121-L143) · [worker/ingest/reparse.go:89-105](worker/ingest/reparse.go#L89-L105)
- Reference implementation (K/D/A/HS/ADR/utility handlers, verified over real demos): [poc-cs2-demo-parse/main.go](_bmad-output/planning-artifacts/research/poc-cs2-demo-parse/main.go); stat-coverage table (verified fields): [technical research Q3](_bmad-output/planning-artifacts/research/technical-cs2-demo-parsing-research-2026-06-29.md#L145-L160)
- AD-2 single writer / app-side approvals: `ARCHITECTURE-SPINE.md` (AD-2, SPINE:85-88, cited throughout parse.go/db.go)
- Demo QA files location (gzip `.dem.gz`, decompress before ingest): memory `demos-folder-location`; local live-QA env traps (WinNAT/Kong): memory `local-live-qa-env-traps`

## Dev Agent Record

### Agent Model Used

Opus 4.8 (claude-opus-4-8) via bmad-dev-story. Baseline commit `cc63e7a`.

### Debug Log References

- `go build ./...` 0 · `go vet ./...` 0 · `go test ./...` all pass · `gofmt` clean (worker module).
- THE BAR harnesses (`worker/cmd/qa51`, `worker/cmd/qa51diag`) were throwaway and DELETED after sign-off — they are not in the File List. They drove the real `ingest.DemoinfocsParser` over `demos/*.dem.gz`.

### Completion Notes List

- **Design decision — commit-whole-round-then-ASSIGN, not event-time `counter++`.** The story recommended "buffer per round, fold survivors." The subtlety I resolved: RoundsWon works via an assignment-keyed map (last write wins) so a MatchZy restart's rewind OVERWRITES the discarded pre-match round. An additive stat keyed at *event time* would land the pre-match round AND its replay on the SAME rewound index and **merge** them (a rewind can't un-add). So the additive stats accumulate into a per-round scratch `cur` and are ASSIGNED into `byRound[TotalRoundsPlayed()]` at RoundEnd, giving the same overwrite guarantee. This is robust to the exact RoundEnd/increment timing (each per-round map only needs its own pre-match-twin to land on one index). MVP fires *after* RoundEnd, so it can't ride the scratch — it uses its own one-per-round assignment map (`mvpByRound`), same as RoundsWon.
- **⭐ Latent bug corrected (Story 3.3).** THE BAR proved the pre-5.1 bare `Kills`/`Deaths` counters were carrying the MatchZy pre-match round: every demo has one extra non-warmup RoundEnd (22 vs 21 final rounds), and the old counter tallied `rounds+1` (raw 22 kills) while the new per-round fold gives exactly `rounds` (21). Unifying kills/deaths into the fold fixes it. RoundsWon was already correct (it always used the keyed map), so 4.6a's demo-derived score was never affected — only the K/D columns were silently +1.
- **1v1 demos.** All 14 tournament demos are 1v1 duels (2 players): `assists=0`/`flash_assists=0` (no teammates), `KAST==kills` (killer survives→K, victim can't be traded), `mvps=0` (a raw diagnostic confirmed the game mode emits zero `RoundMVPAnnouncement`). All correct-by-mode; the assists/flash/MVP handler logic is covered by the unit tests + the pure-classifier tests, and would light up on a 5v5 demo.
- **AC coverage.** AC1: the seven derived per player, per match (parser handlers + fold). AC2: ADR uses overkill-capped `HealthDamageTaken` (documented convention constant), verified to isolate utility damage exactly (HE 30 + Incendiary 3 = 33). AC3: single writer — the seven ride the one `upsertStatRows` shared by both `RecordParse`/`RecordReparse`; `status`/`match_id` stay out of both lists; no app/anon/authenticated path added.
- **No migration / no SQL / no app change** — every target column pre-existed nullable in `stat_row` (0007:41–47). `supabase/migrations/` untouched (a scope check, held).
- **Known unit-test limit (per the 4.6a precedent):** the SQL `DO UPDATE` set-list is not reachable by the in-memory fakes (they mirror the `StatRow` struct, not the SQL). Dropping `assists = excluded.assists` from the SQL would not redden a Go unit test — that column-list is validated by a live re-parse (part of THE BAR family) and structurally mirrors the verified `rounds_won` line. Flagged for the reviewer.

### File List

- `worker/ingest/parse.go` — `PlayerStat` +7 fields; `kastTradeWindow` const; `roundDeath`/`roundStats` types; `newRoundStats`, `kastQualified`, `foldRounds`; rewritten `Parse` (Kill/PlayerHurt/RoundMVPAnnouncement/RoundEnd handlers + per-round commit/fold).
- `worker/db/db.go` — `StatRow` +7 fields; `upsertStatRows` INSERT + ON CONFLICT DO UPDATE widened for the seven columns.
- `worker/ingest/cli.go` — `parseAndRecord` first-parse map carries the seven; doc comment updated.
- `worker/ingest/reparse.go` — re-parse map carries the seven (with second-path warning).
- `worker/ingest/parse_test.go` — `TestKASTClassifierBranches`, `TestKASTTradeWindowBoundary`, `TestFoldRoundsDropsStrandedRounds`; `time` import.
- `worker/ingest/cli_test.go` — `cannedParse()` widened; `assertCoreSeven` helper; first-parse assertions.
- `worker/ingest/reparse_test.go` — re-parse core-seven assertions.

### Change Log

- 2026-07-19 — Story 5.1 implemented (Opus 4.8, baseline `cc63e7a`): FR-18 core seven derived in the worker + written via the single-writer upsert (both parse paths), no migration. Unit + mutation tests green; THE BAR passed on 14/14 real demos and corrected a latent Story-3.3 pre-match-round K/D over-count. Status → review.
- 2026-07-19 — Code review (bmad-code-review, Opus 4.8; 3 parallel layers). AC1/AC2/AC3 + scope + bind-preservation CONFIRMED; gates re-verified green + mapping-site/KAST mutation-tested by the reviewer. 1 HIGH decision-needed resolved by patch: restored duplicate-`RoundEnd` idempotency via a `roundStarted` guard (new `events.RoundStart` handler) — the refactor had dropped a defensive property `RoundsWon` still had; behavior-preserving on the happy path. 5 findings deferred (KAST per-round-model edge cases, world/suicide-as-trade, self-damage ADR, per-player ratio denominator, SQL set-list mutation-blindness) → deferred-work.md; 5 dismissed. Status → done.
