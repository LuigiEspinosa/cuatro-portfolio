---
baseline_commit: 3b22fa0319bde0ca13a1ac11f0039c8c2aadc949
---

# Story 5.2: Weird demo-only stat derivation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a viewer,
I want the niche, demo-only stats computed,
so that the comedy/weird award tracks have real data behind them.

## Acceptance Criteria

**AC1 — the FR-19 weird five are derived per player, per match.**
**Given** the weird-stats requirement (FR-19, AD-2),
**When** the worker derives a match,
**Then** it computes, per player: knife kills, wallbang kills, through-smoke kills, no-scope kills, and blind kills — each tallied from a **native** `events.Kill` field, never a heuristic.

**AC2 — zero is recorded as zero, never omitted.**
**Given** FR-19's testable consequence ("a weird stat with a zero count is recorded as zero, not omitted"),
**When** a player earned none of a given weird stat,
**Then** the column is written `0`, not left `NULL` — the five columns are present in the INSERT list on **every** parse, for **every** player row.

**AC3 — single writer.**
**Given** the single-writer rule (AD-2),
**When** these stats are written,
**Then** they are written **only** by the worker via the service role into `stat_row`, through the one shared `upsertStatRows` used by **both** `RecordParse` and `RecordReparse` — no app/anon/authenticated path writes any of them.

_Traces: FR-19 · AD-2_

---

### READ THIS FIRST — molotov/HE damage is ALREADY DONE. Do not re-implement it.

The epic's FR-19 sentence ends with "…and molotov/HE damage". **That is `utility_damage`, and Story 5.1 already ships it** (`PlayerHurt` filtered on `Weapon.Type ∈ {EqHE, EqMolotov, EqIncendiary}`, overkill-capped, verified live at THE BAR: `HE 30 + Incendiary 3 = 33`). There is **no** separate molotov column and **no** separate HE column in `stat_row` — migration `0007:43` created exactly one `utility_damage int`, and `0007:45` created exactly the five weird shells this story fills:

```sql
knife_kills int, wallbang_kills int, through_smoke_kills int, no_scope_kills int, blind_kills int,  -- Epic-5 weird shells (FR-19)
```

**Do NOT** split `utility_damage` into molotov/HE halves, **do NOT** add a migration to create such columns, and **do NOT** re-touch the `PlayerHurt` handler. This story is exactly **five new integer counters**, all credited to the **killer** on `events.Kill`.

| FR-19 stat | `stat_row` column (exists, nullable, since 0007) | `PlayerStat` field to add | Source (native field) |
|---|---|---|---|
| knife kills | `knife_kills` | `KnifeKills int` | `e.Weapon != nil && e.Weapon.Type == common.EqKnife` |
| wallbang kills | `wallbang_kills` | `WallbangKills int` | `e.IsWallBang()` (≡ `e.PenetratedObjects > 0`) |
| through-smoke kills | `through_smoke_kills` | `ThroughSmokeKills int` | `e.ThroughSmoke` |
| no-scope kills | `no_scope_kills` | `NoScopeKills int` | `e.NoScope` |
| blind kills | `blind_kills` | `BlindKills int` | `e.AttackerBlind` — **the KILLER was flashed**, see below |
| molotov/HE damage | `utility_damage` | *(none — `UtilityDamage` already exists)* | **SHIPPED in 5.1. Out of scope.** |

## Tasks / Subtasks

> **NO MIGRATION. NO SQL FILE. NO app/route/TS change.** Every target column already exists (nullable) in `stat_row` since `0007` (lines 41–47); `0007:24–34` says verbatim that Epic 5 "only widens the parser, never the schema". `supabase/migrations/` must be **untouched** — asserting that is a scope check, not an omission. This story is the exact same shape as Story 5.1 and Story 4.6a: widen `PlayerStat` → widen `roundStats` → credit in the `events.Kill` handler → widen `StatRow` → widen the two `upsertStatRows` column lists → widen **both** mapping sites → widen the tests.

- [x] **Task 1 — Widen the parser payload (AC: 1)**
  - [x] In [worker/ingest/parse.go](worker/ingest/parse.go), add five `int` fields to `PlayerStat`: `KnifeKills`, `WallbangKills`, `ThroughSmokeKills`, `NoScopeKills`, `BlindKills`. Group them under a comment naming them the FR-19 weird five (Story 5.2), mirroring how the FR-18 core seven are grouped.
  - [x] Update the `PlayerStat` doc comment: the parser now fills FR-18 core **and** FR-19 weird; the still-later derived/idle stats (FR-20/FR-21 — entry frags, opening deaths, clutches, `idle_dq`, `idle_round_count`) remain Stories 5.3–5.4 and stay at their nullable column defaults.

- [x] **Task 2 — Buffer them per round, exactly like every other additive stat (AC: 1)**
  - [x] Add five `map[uint64]int` fields to `roundStats` (`knifeKills`, `wallbangKills`, `throughSmokeKills`, `noScopeKills`, `blindKills`) and initialize all five in `newRoundStats()`.
  - [x] Add five fold loops to `foldRounds` alongside `rs.kills`/`rs.hsKills` (`if s := get(sid); s != nil { s.KnifeKills += n }`, etc.).
  - [x] **⛔ DO NOT write a bare `stats[k].KnifeKills++` on `PlayerStat` at event time.** Every additive stat MUST land in the per-round scratch `cur` and be committed at `RoundEnd`. This is the trap-4 correction (see Dev Notes) — a bare counter silently carries the discarded MatchZy pre-match round, which is a **measured, real** +1 over-count on 14 of 14 demos in `demos/`, not a theoretical risk.

- [x] **Task 3 — Classify each kill with a PURE, unit-testable function (AC: 1)**
  - [x] Add a pure classifier next to `kastQualified` in `parse.go`, e.g.:
    ```go
    // weirdKinds are the FR-19 weird flags one non-warmup kill earns its KILLER. They are NOT mutually
    // exclusive — one kill can be several at once (a blind no-scope wallbang is all three).
    type weirdKinds struct{ knife, wallbang, throughSmoke, noScope, blind bool }
    func classifyWeirdKill(e events.Kill) weirdKinds
    ```
  - [x] Inside the **existing** `events.Kill` handler, in the **existing** `if k := idOf(e.Killer); k != 0 { … }` block (right after the `IsHeadshot` credit), call the classifier once and increment the five `cur` maps from its flags. Do not add a second `events.Kill` handler and do not touch the warmup skip, the victim block, or the assister block.
  - [x] Guard `e.Weapon == nil` inside the classifier (world/corrupt damage) — the knife test is the only one that dereferences it.

- [x] **Task 4 — Widen the single-writer upsert (AC: 2, 3)**
  - [x] Add the five `int` fields to `StatRow` in [worker/db/db.go](worker/db/db.go) with the same grouping comment; update the struct doc (which currently says "the still-later weird/derived/idle columns (5.2–5.4) stay NULL").
  - [x] `upsertStatRows`: add `knife_kills, wallbang_kills, through_smoke_kills, no_scope_kills, blind_kills` to the `insert into stat_row (…)` list, five new `$n` placeholders (→ `$15..$19`), the five values in the `batch.Queue` argument list, **and** five `<col> = excluded.<col>` lines in the `on conflict … do update set` list. Exactly like `rounds_won` / `assists`.
  - [x] **⚠ INVARIANTS THAT MUST SURVIVE (db.go:337–345):** `status` stays ABSENT from the `DO UPDATE` set-list (an approved row stays approved across a re-parse — AD-7). `match_id` (the bracket id) stays ABSENT from **BOTH** lists (it is written only by `0016 bind_match_demo`; adding it would set `match_id = excluded.match_id = NULL` and silently unbind every bound match on every re-parse). Re-read those two comment blocks before editing and leave them intact.
  - [x] Renumbering check: the placeholders are positional — after inserting five, verify `$1..$19` still line up 1:1 with the argument order. A silent off-by-one here writes the wrong stat into the wrong column and no unit test catches it (the fakes do not execute SQL).

- [x] **Task 5 — Populate at BOTH mapping sites (AC: 1, 2, 3)**
  - [x] [worker/ingest/cli.go](worker/ingest/cli.go) `parseAndRecord` first-parse map: copy all five. Also fix the stale doc comment at `cli.go:100` ("the Epic-5 stat columns stay NULL") and at `cli.go:120` ("the still-later weird/derived/idle columns (5.2–5.4) stay NULL") — after this story only FR-20/21 stay NULL.
  - [x] [worker/ingest/reparse.go](worker/ingest/reparse.go) re-parse map: copy the same five, under the existing "⚠ MUST mirror cli.go's first-parse map verbatim" warning.
  - [x] **This is the recurring Epic-4/5 failure mode.** A field mapped in `cli.go` but dropped in `reparse.go` writes correct values on first parse and then **zeroes that column on every re-parse**. Widen both sites in the same edit, and prove both with tests (Task 6).

- [x] **Task 6 — Tests (unit) + mandatory mutation testing (AC: 1, 2, 3)**
  - [x] Widen `cannedParse()` in [worker/ingest/cli_test.go](worker/ingest/cli_test.go) with five more distinct-per-field, per-player values (no two fields sharing a value, so a copy/paste swap reddens), keeping the fixture plausible: each weird stat ≤ that player's `Kills`.
  - [x] Extend `assertCoreSeven` — rename it (e.g. `assertDerivedStats`) or add a sibling `assertWeirdFive` — and call it from **both** the `cli_test.go` first-parse happy path and the `reparse_test.go` re-parse happy path. Both mapping sites must be covered by the same net.
  - [x] Add a pure table test for `classifyWeirdKill` in [worker/ingest/parse_test.go](worker/ingest/parse_test.go), next to `TestKASTClassifierBranches`: one case per flag; a `PenetratedObjects: 0` case that must NOT count as a wallbang; a `Weapon: nil` case that must not panic and must not count a knife kill; a non-knife weapon case; and a **combined** case (knife + blind, and blind + no-scope + wallbang) proving the flags are independent, not exclusive.
  - [x] Add a `foldRounds` case proving the five new counters fold across rounds and respect the `idx > final` stranded-round bound (extend `TestFoldRoundsDropsStrandedRounds` rather than duplicating it).
  - [x] **AC2 zero-case:** assert that a player whose `PlayerStat` carries zeros for all five still produces a `StatRow` with all five explicitly `0` and is **not** skipped or partially mapped (guards against a "only set it if non-zero" optimization creeping in).
  - [x] **Mutation testing is MANDATORY before review** (standing project rule): for **each** of the five columns, delete its line from `cli.go`'s map, then from `reparse.go`'s map, then invert its branch in `classifyWeirdKill` — each must redden a named test. Restore and re-verify green. Record the result in Completion Notes. A suite that survives these mutations is blind and does not count as coverage.
  - [x] Gates: `go build ./...` 0, `go vet ./...` 0, `go test ./...` pass, `gofmt` clean (in `worker/`).
  - [x] **Known, disclosable coverage limit (do not paper over it):** the SQL `DO UPDATE` set-list is not reachable by the in-memory fakes (they store the `StatRow` struct, not SQL), so dropping `knife_kills = excluded.knife_kills` reddens no Go test. This is the accepted 4.6a/5.1 precedent — mirror the verified `rounds_won`/`assists` lines structurally, and state the limit explicitly for the reviewer.

- [x] **Task 7 — THE BAR: live-QA over the real demos (AC: 1, 2)**
  - [x] Run the **real** `ingest.DemoinfocsParser` over the 14 `.dem.gz` in `demos/` (gzip — stream through `gzip.NewReader`; a throwaway `worker/cmd/qa52` harness, deleted after sign-off, is the established pattern from 5.1).
  - [x] Assert per player, per demo: `knife_kills ≤ kills`, `wallbang_kills ≤ kills`, `through_smoke_kills ≤ kills`, `no_scope_kills ≤ kills`, `blind_kills ≤ kills`, all ≥ 0, and — the 5.1 regression net — `Σkills == Σdeaths` and `Σkills == rounds` still hold unchanged (this story must not perturb the fold).
  - [x] **Expect small or zero counts and do not treat zero as failure.** These are 1v1 duel demos: knife/no-scope/through-smoke/wallbang kills are rare and blind kills nearly impossible without teammates flashing. If a stat reads 0 across all 14, **prove the handler fires** by printing a raw per-kill diagnostic (weapon type + the four flags for every counted kill) rather than asserting from the aggregate alone — exactly how 5.1 settled `Σmvps = 0` as a real property instead of a bug. Record which of the five were observed non-zero and which were proven-zero-by-mode.
  - [x] Record the weapon-type breakdown of knife kills if any appear (all knife skins normalize to `common.EqKnife` — see Dev Notes — so `weapon_knife_t`, `weapon_bayonet`, `weapon_knife_karambit` etc. must all land in the one counter).

### Review Findings

Code review 2026-07-21 — three parallel layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). **No acceptance criterion and no spec prohibition was violated**; AC1/AC2/AC3 and every "do not touch" verified clean, and THE BAR was independently reproduced (`ALL INVARIANTS HELD`, knife 1 · wallbang 8 · smoke 2 · noscope 0 · blind 0, 25 raw flagged − 14 at round 0 = 11 counted).

- [x] [Review][Decision] **Post-round kills count toward the weird five** — the `events.Kill` handler ([parse.go:390](worker/ingest/parse.go#L390)) filters warmup only; it has no round-in-progress gate. A kill between `RoundEnd` and the next `RoundStart` lands in the *next* round's `cur`. This is scoreboard-correct for `kills`/`deaths` (CS2 counts them, so the conservation gate can never see it), but the post-round knife-around is the single most common source of knife kills in a casual friends' league. **RESOLVED 2026-07-21 (Cuatro): COUNT THEM — post-round knifing is exactly the comedy FR-19 is for.** No behavioral change; the weird five stay on the identical event path as `kills`/`deaths`. Recorded as a deliberate property in the handler comment (see the patch below) so a future reader does not "fix" it.

- [x] [Review][Patch] Pin the post-round-kill decision in the handler comment — deliberate, not an oversight [worker/ingest/parse.go:390] — APPLIED
- [x] [Review][Patch] The five-way increment dispatch is unreachable by any Go test — a *transposed* counter passes both the suite and THE BAR [worker/ingest/parse.go:403-419] — APPLIED: extracted to `(*roundStats).addWeirdKills`; the closure is now one call. New `TestAddWeirdKillsBindsEachFlagToItsOwnCounter` asserts the whole five-counter vector per case, so a drop OR a swap reddens (mutation-verified, 5/5)
- [x] [Review][Patch] `reparse.go`'s mirror warning still says "both carry all seven" — it is twelve now [worker/ingest/reparse.go:106] — APPLIED
- [x] [Review][Patch] Debug Log's mutation headline (25 mutants / 20 red / 5 survived) contradicts its own table (6 classes × 5 = 30 mutants, 2 survivor classes = 10 survivors) [5-2-weird-demo-only-stat-derivation.md:218] — APPLIED: corrected to 30/20/10, then re-scored 30/25/5 after the addWeirdKills patch closed survivor class 1
- [x] [Review][Patch] `cannedParse` breaks its own stated "no two fields share a value" rule for player …042: `ThroughSmokeKills: 14` collides with `Kills: 14`, `KnifeKills: 3` with `Assists: 3` [worker/ingest/cli_test.go:44-47] — APPLIED: …042 now `MVPs: 6, KnifeKills: 9, ThroughSmokeKills: 11`; all 15 field values distinct within BOTH rows (the third collision, `MVPs: 2`/`FlashAssists: 2`, was pre-existing from 5.1 and is fixed too)
- [x] [Review][Patch] The AC2 zero-case test's five field assertions are `0 == 0` and its comment claims SQL-level NULL coverage the fakes cannot reach [worker/ingest/cli_test.go:198-245] — APPLIED: comment now states exactly what the test proves (the row is not skipped/partially mapped) and what no Go test can reach (0-vs-NULL)
- [x] [Review][Patch] `blind_kills` = *attacker*-blind is disambiguated only in `parse.go`; `StatRow`'s comment and the column name carry no qualifier for Story 5.5's UI label [worker/db/db.go:160-164] — APPLIED
- [x] [Review][Patch] Redundant `w != (weirdKinds{})` guard restates "what counts as weird" a second time and fails silently if the struct ever gains a meaningful-zero field [worker/ingest/parse.go:403] — APPLIED: guard removed by the addWeirdKills extraction
- [x] [Review][Patch] `cli.go`'s header traded a checkable claim ("the Epic-5 stat columns stay NULL") for an unfalsifiable one ("every derived stat the parser fills") [worker/ingest/cli.go:100] — APPLIED

**Post-patch verification (2026-07-21).** Gates re-run in `worker/`: `gofmt -l .` empty · `go build ./...` 0 · `go vet ./...` 0 · `go test ./... -count=1` all packages ok. Mutation-tested the new coverage — 6 mutants: transpose noScope→blindKills ✅ · transpose knife→wallbangKills ✅ · drop knife/blind/throughSmoke increments ✅✅✅ · **drop the whole `cur.addWeirdKills(...)` call ⚠ SURVIVED** (the single remaining closure line, still unreachable by `FakeParser`). That residue is correctly matched to its control: dropping the call makes all five columns 0 everywhere, which is a *missing*-increment failure, and THE BAR's reconciliation does detect that — unlike a transposition, which is now caught in Go. **THE BAR re-run after the refactor reproduces the pre-patch numbers exactly** (`ALL INVARIANTS HELD`; knife 1 · wallbang 8 · smoke 2 · noscope 0 · blind 0; 25 raw flagged; `Knife 15`), proving the extraction is behaviour-neutral on all 14 real demos.

- [x] [Review][Defer] Pre-5.2 rows keep `NULL`, not `0` — AC2 holds only for rows written after this build [worker/db/db.go:131-136] — deferred, pre-existing; explicitly owned by Story 5.5 per Dev Notes
- [x] [Review][Defer] `AttackerBlind` / `ThroughSmoke` semantics unmeasured in 5v5 — the 14 QA demos are 1v1 duels with no teammates to flash [worker/ingest/parse.go:316-318] — deferred, pre-existing; re-verify on the first real tournament demo
- [x] [Review][Defer] A truncated demo whose final `RoundEnd` never fires silently drops that round's weird five [worker/ingest/parse.go:556] — deferred, pre-existing; shared with `kills`/`deaths`, degrades self-consistently
- [x] [Review][Defer] `assertDerivedStats` uses `t.Fatalf`, so one dropped field masks the other eleven and the second player [worker/ingest/cli_test.go:150] — deferred, pre-existing from Story 5.1's `assertCoreSeven`
- [x] [Review][Defer] `worker/cmd/qa52/` is untracked and absent from the review diff [worker/cmd/qa52/main.go] — deferred, pre-existing; delete at sign-off per Completion Notes

**Dismissed as noise (3):** SQL column names unverified against the schema (Auditor confirmed exact match with `0007_stat_row.sql:45`) · native flag semantics never measured (THE BAR was run *and* independently reproduced with a raw per-kill diagnostic) · no production validation gate on the five (Dev Notes explicitly prohibit adding one).

## Dev Notes

### Framing: this is the smallest story in Epic 5 — and its risk is entirely in *not* deviating

Story 5.1 (`5f2d236`, done) built the whole machine: a per-round scratch (`cur`), a `RoundEnd` commit keyed on `TotalRoundsPlayed()`, a `roundStarted` idempotency guard, a survivor `foldRounds`, a widened single-writer upsert, and two mapping sites. **5.2 adds five counters into that machine and changes nothing about it.** Every meaningful correctness property you need is already established and verified; the failure modes are all "the dev invented a shortcut."

Read [worker/ingest/parse.go](worker/ingest/parse.go) top to bottom before editing — especially the `roundStats` doc comment (why commit-whole-round-then-ASSIGN) and the four-trap block above the `RoundEnd` handler. Read [5-1-core-stat-derivation.md](_bmad-output/implementation-artifacts/5-1-core-stat-derivation.md) Review Findings for what the reviewer caught last time.

### The exact demoinfocs v5.2.0 API (verified first-hand at contexting, from the pinned module in the local module cache)

`events.Kill` (`events.go:159–176`), verbatim field set:

```go
type Kill struct {
	Weapon            *common.Equipment
	Victim            *common.Player // may be nil (partially corrupt demo)
	Killer            *common.Player // may be nil (world damage / corrupt)
	Assister          *common.Player
	PenetratedObjects int
	IsHeadshot        bool
	AssistedFlash     bool
	AttackerBlind     bool
	NoScope           bool
	ThroughSmoke      bool
	Distance          float32
}
func (k Kill) IsWallBang() bool { return k.PenetratedObjects > 0 }
```

- **`IsWallBang()` is the library's own value-receiver method** and is exactly `PenetratedObjects > 0`. Prefer it over the raw comparison — it states intent and cannot drift.
- **`AttackerBlind` means the KILLER was flashed when they got the kill** (the "blind justice" sense). `events.Kill` carries **no** victim-blind field, so "blind kills" is unambiguously attacker-blind. Say so in the code comment — a future reader will otherwise assume victim-blind and "fix" it.
- **All knife skins normalize to `common.EqKnife`.** `equipment.go` maps item ids 41/42/59/80 and 500–556 (`weapon_knife_t`, `weapon_bayonet`, `weapon_knife_karambit`, `weapon_knife_kukri`, …) to the single `EqKnife` type, plus a name-contains fallback for `"knife"`/`"bayonet"` (`equipment.go:280`). So the one `Type == common.EqKnife` test covers every knife — do **not** hand-roll a skin list. The zeus/taser is `EqZeus`, correctly **not** a knife.
- **These four flags are CS2-only fields** (they are populated for Source 2 demos, which is all we ingest — the `PBDEMS2` header was confirmed in the spike). All were exercised live by the PoC: wallbang 2, through-smoke 1, no-scope 1, knife 4 on the sample demo.
- **Parser version is PINNED and must not move.** `ParserVersion = "demoinfocs-golang/v5 v5.2.0"` (`parse.go:17`) is stamped onto `demo.parser_version` on every parse and must stay in lockstep with `worker/go.mod` (AD-26). **Do not `go get -u`.** This story needs no API that v5.2.0 lacks.

### The trap-4 pre-match round (why a bare counter is wrong — measured, not hypothetical)

Every real MatchZy demo opens with a round that is **played, won, and then discarded** — and it is **not** warmup, so the `IsWarmupPeriod()` skip does not catch it. MatchZy restarts the match (`MatchStartedChanged true→false→true`, `ScoreUpdated 1→0`) and the game **rewinds** `TotalRoundsPlayed()`; the replayed round re-reaches the same low index. THE BAR measured exactly one extra non-warmup `RoundEnd` on **14 of 14** demos (22 vs 21, 11 vs 10), and Story 5.1 corrected a real, shipped Story-3.3 over-count because of it.

The machine that fixes this already exists: additive stats accumulate into `cur` and are **ASSIGNED** into `byRound[TotalRoundsPlayed()]` at `RoundEnd` (assignment ⇒ the replay **overwrites** the discarded round; a bare `counter++` at event time would land both on the same rewound index and **merge** them, because a rewind cannot un-add). `foldRounds` then drops any index above the final count. **Your five counters get this for free — but only if they go through `cur`.** Bypassing the scratch is the single highest-value mistake to avoid in this story.

Note also the `roundStarted` guard at the top of the `RoundEnd` handler (added by 5.1's code review): a duplicate `RoundEnd` with no intervening `RoundStart` is skipped, so the destructive scratch-move stays idempotent. **Do not remove or restructure it**, and do not move the `cur` reset to `RoundStart` (that reintroduces the post-`RoundEnd` scratch aliasing the immediate reset prevents).

### Zero vs NULL (AC2), and what happens to already-parsed matches

Go's `int` zero value plus unconditional presence in the INSERT column list means a player with no knife kills gets `knife_kills = 0` — never `NULL`. That satisfies FR-19's "recorded as zero, not omitted" **by construction**; the thing to actually verify is that the five columns are in the INSERT list for **every** row (Task 4) and mapped at **both** sites (Task 5).

Rows written **before** this story keep `NULL` in the five columns until their demo is re-parsed (Story 3.6 `RunReparse`, which re-derives everything through the same upsert). That is expected and is not a data migration — do **not** write a backfill SQL script. Story 5.5's leaderboard view is the consumer and must treat these as the nullable ints they are; flag it to 5.5 rather than solving it here.

### Overlap semantics — the five are independent subsets of `kills`

A single kill can earn several flags at once (a no-scope through smoke that also penetrated a wall is three). Each counter increments independently, so:

- each weird stat is individually `≤ kills` (the THE BAR invariant), but
- **`Σ(weird five)` may legitimately exceed `kills`** — do **not** add a validation gate or an assert claiming otherwise.

`hs_kills` (5.1) is likewise an independent overlapping subset; you are following an existing convention, not inventing one.

### No new validation gate

`Validate` ([worker/ingest/validate.go](worker/ingest/validate.go)) runs the three Story-3.4 gates (conservation, empty_stats, unreconciled). Adding five kill-flag counters changes none of them — `Σkills == Σdeaths` is untouched. **Do not add a weird-stat gate**, and do not touch the anti-farm / AFK-idle columns (`idle_dq`, `idle_round_count`) — those are **Story 5.4** and stay at their column defaults.

⚠ **The OPEN Epic-3 retro action item** ("relax the conservation gate to `Σkills > Σdeaths`", owner Amelia) is **NOT in this story's scope** — 5.2 traces only FR-19, and touching `validate.go` would be unrelated leakage. **Cuatro pinned its home to Story 5.4 on 2026-07-21** (5.4 is the only remaining Epic-5 story that legitimately touches the validation surface). If you find yourself editing `validate.go`, you have left the story.

### Project Structure Notes

- Files you will touch (all Go, all existing, all under `worker/`): `worker/ingest/parse.go` (struct + `roundStats` + `newRoundStats` + `foldRounds` + `classifyWeirdKill` + the Kill handler), `worker/db/db.go` (`StatRow` + `upsertStatRows`), `worker/ingest/cli.go` (first-parse map + two stale comments), `worker/ingest/reparse.go` (re-parse map), plus `worker/ingest/parse_test.go`, `worker/ingest/cli_test.go`, `worker/ingest/reparse_test.go`.
- **No change needed** in `worker/db/fake.go` — `FakeStatRecorder` stores the whole `StatRow` struct (no per-field copy), so it widens automatically. Verify by reading it; do not "helpfully" add per-field plumbing.
- **No file outside `worker/` changes.** `supabase/migrations/`, `app/`, `lib/`, and every `.ts`/`.sql` file stay untouched. If you find yourself opening a migration, stop — you have left the story.
- Naming/idiom: match the surrounding worker code — deterministic ordering (already sorted by SteamID64), fail-closed `recover()` on parser panic (already present), warmup + trap-4 discipline on every counted event, structured `log.Printf` warns (never silent).

### Testing standards

- Go unit tests via `go test ./...` in `worker/`; `go build ./...` and `go vet ./...` clean; `gofmt` clean. The suite injects `FakeParser`/`FakeStatRecorder`/`FakeRosterReader` — no real DB or `.dem` needed for unit tests.
- **Per-effect mutation testing is mandatory before review** (standing project rule, hard-won across Epic 4): each of the five columns must have a test that reddens when its map entry (either mapping site) or its classifier branch is removed. Report the mutation results explicitly.
- **Prefer a pure classifier over parser-closure logic.** The 5.1 review's honest disclosure was that the `roundStarted` guard lives inside a parser event-handler closure that `FakeParser` cannot drive, so **no fake-reachable test reddens if it is deleted**. `kastQualified` avoided that by being pure. `classifyWeirdKill` (Task 3) is the same move: keep the *decision* pure and testable, leave only the *increment* in the closure. This is the single design choice that makes 5.2 mutation-testable where 5.1 partly was not.
- THE BAR (Task 7) is the live-QA gate and, together with the automated gates, the sign-off — as in every prior worker story.

### Git / previous-story intelligence

- **Story 5.1** (`5f2d236`) is the exact template and the immediate predecessor: same struct-widening shape, same two mapping sites, same upsert edit, no migration. Its review found **one HIGH** issue — a refactor that silently dropped a defensive idempotency property `RoundsWon` still had. Lesson to carry: when touching `parse.go`, **preserve existing behavior comments and the properties they claim**; if you delete a comment asserting a property, you are on the hook for proving the property still holds.
- **Story 4.6a** (`13dc05f`) established the "widen `PlayerStat` + `StatRow` + `upsertStatRows` + both mapping sites, no migration" pattern for `rounds_won`, and its review's two headline findings were both mutation-blind tests (a probe that never reached the write).
- **Recurring Epic-4/5 lesson:** the "second path" (`reparse.go`) is where widenings get dropped silently. Widen it in the same edit as `cli.go`.
- Baseline for this story is `3b22fa0` (HEAD, working tree clean).

## References

- Epic + AC: [epics.md:849-865](_bmad-output/planning-artifacts/epics.md#L849-L865) (Story 5.2); Epic 5 intro: [epics.md:823-825](_bmad-output/planning-artifacts/epics.md#L823-L825)
- FR-19 (weird demo-only stats + the zero-not-omitted consequence): [prd.md:297-303](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L297-L303)
- `stat_row` weird shells (the five columns, nullable, already created): [0007_stat_row.sql:45](supabase/migrations/0007_stat_row.sql#L45); "Epic 5 widens the parser, never the schema": [0007_stat_row.sql:24-34](supabase/migrations/0007_stat_row.sql#L24-L34)
- Parser: `PlayerStat` [parse.go:45-58](worker/ingest/parse.go#L45-L58) · `roundStats` + the commit-then-assign rationale [parse.go:76-117](worker/ingest/parse.go#L76-L117) · pure `kastQualified` (the classifier precedent) [parse.go:119-151](worker/ingest/parse.go#L119-L151) · `foldRounds` [parse.go:153-237](worker/ingest/parse.go#L153-L237) · the `events.Kill` handler [parse.go:306-331](worker/ingest/parse.go#L306-L331) · four-trap block + `roundStarted` guard [parse.go:378-454](worker/ingest/parse.go#L378-L454)
- Single writer / upsert invariants: `StatRow` [db.go:139-156](worker/db/db.go#L139-L156) · `upsertStatRows` + the `status`/`match_id` exclusion [db.go:321-377](worker/db/db.go#L321-L377)
- Both mapping sites: [cli.go:118-151](worker/ingest/cli.go#L118-L151) · [reparse.go:87-115](worker/ingest/reparse.go#L87-L115)
- Test patterns to extend: `cannedParse` + `assertCoreSeven` [cli_test.go:31-73](worker/ingest/cli_test.go#L31-L73) · re-parse assertions [reparse_test.go:73-74](worker/ingest/reparse_test.go#L73-L74) · pure-classifier tests [parse_test.go:41-140](worker/ingest/parse_test.go#L41-L140)
- Verified stat-coverage table (native fields, live counts from the spike): [technical research Q3](_bmad-output/planning-artifacts/research/technical-cs2-demo-parsing-research-2026-06-29.md#L145-L160); reference implementation of all five: [poc-cs2-demo-parse/main.go:93-110](_bmad-output/planning-artifacts/research/poc-cs2-demo-parse/main.go#L93-L110)
- Predecessor story (template + review lessons): [5-1-core-stat-derivation.md](_bmad-output/implementation-artifacts/5-1-core-stat-derivation.md)
- AD-2 single writer: `ARCHITECTURE-SPINE.md` (AD-2, SPINE:85-88) · AD-20 one-owner aggregation · AD-26 pinned parser
- Demo QA files (gzip `.dem.gz`, decompress before ingest): memory `demos-folder-location`; local live-QA env traps (WinNAT/Kong): memory `local-live-qa-env-traps`
- demoinfocs v5.2.0 source verified in the local module cache: `events.Kill` at `pkg/demoinfocs/events/events.go:159-176`; knife-type mapping at `pkg/demoinfocs/common/equipment.go:280,501-556`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Opus 4.8) — bmad-dev-story, 2026-07-21

### Debug Log References

**Gates (in `worker/`, all clean):** `gofmt -l .` → empty · `go build ./...` → 0 · `go vet ./...` → 0 · `go test ./... -count=1` → all packages ok.

**Mutation testing — 30 valid mutants, 20 reddened, 10 survived (both survivor classes were predicted by the story and are disclosed below).** Driver: throwaway scripts in the session scratchpad (`mutate52b.ps1` / `mutate52c.ps1`); each mutant is applied to a pristine backup, `go test ./...` is run, then the file is restored — the suite was re-verified green after the last restore.

> **Corrected during code review (2026-07-21).** The headline originally read "25 valid mutants, 20 reddened, 5 survived", which contradicted the table below it: 6 classes × 5 mutants = **30**, and **two** survivor classes × 5 = **10** survivors (the prose said "both survivor classes" while counting one class's worth). The Acceptance Auditor re-ran the whole set independently and reproduced every row, so only the arithmetic was wrong — the disclosure was complete. **Survivor class 1 has since been closed** by the review patch that extracted `addWeirdKills`: the five Kill-handler increments are now a pure, fake-reachable function, and `TestAddWeirdKillsBindsEachFlagToItsOwnCounter` reddens on a dropped OR transposed counter. Post-patch: **30 mutants, 25 reddened, 5 survived** — the 5 remaining are all the disclosed `db.go` SQL/positional-arg class, which no in-memory fake can reach.

| Mutation | Result | Reddened test |
|---|---|---|
| `cli.go` first-parse map DROPS each of the 5 fields (×5) | ✅ REDDENED | `TestRunCLIHappyPathParsesAndUpserts` |
| `reparse.go` re-parse map DROPS each of the 5 fields (×5) | ✅ REDDENED | `TestRunReparseHappyPathReplacesAndBumpsGeneration` |
| `classifyWeirdKill` INVERTS each of the 5 flags (×5) | ✅ REDDENED | `TestClassifyWeirdKillBranches` (+ per-flag subtests) |
| `foldRounds` neutralizes each of the 5 sums (`+= n*0`, ×5) | ✅ REDDENED | `TestFoldRoundsDropsStrandedRounds` |
| `parse.go` DROPS/TRANSPOSES each of the 5 flag→counter bindings (×5) | ✅ REDDENED *(post-review)* | `TestAddWeirdKillsBindsEachFlagToItsOwnCounter` |
| `db.go` upsert DROPS each `row.<X>` positional arg (×5) | ⚠ SURVIVED | *(none — see disclosure 2)* |

**THE BAR — real `ingest.DemoinfocsParser` over all 14 `.dem.gz` in `demos/` (`go run ./cmd/qa52 ../demos`) → `ALL INVARIANTS HELD`, exit 0.**

- Per player, per demo: every one of the five is `≥ 0` and `≤ that player's kills` — 0 violations across 28 player-rows.
- 5.1 regression net **unperturbed** on 14/14: `Σkills == Σdeaths == RoundsPlayed` and `ΣRoundsWon == RoundsPlayed` on every demo.
- Aggregate over the 14 demos: **knife 1 · wallbang 8 · through-smoke 2 · no-scope 0 · blind 0**.
- **The handler demonstrably fires.** The harness makes a second, independent raw pass printing every flagged kill (weapon + the four native flags + the round index). It saw **25** flagged non-warmup kills, and the flagged kills at counted round indices reconcile **exactly 1:1** with the aggregate: **11 flagged kills at round > 0 = 1 knife + 8 wallbang + 2 smoke = 11**. Nothing counted is unexplained, and nothing observed is uncounted.
- **⭐ Trap-4 confirmed live, again, and this time it bites the weird five specifically.** Of the 15 raw knife kills, **14 sit at round index 0 — one on each of 14/14 demos** (the knife round every duel opens with, which MatchZy then discards; it is *not* warmup). The `cur` scratch + `RoundEnd` overwrite drops all 14 correctly, leaving exactly the 1 genuine in-match knife kill (round 7 of `samz-mafejavela`). **A bare `stats[k].KnifeKills++` would have shipped 15 instead of 1 — a 15× over-count on a comedy award.** This is measured, not argued.
- **`no_scope` and `blind` are proven-zero-by-mode, not by silence:** the raw pass shows `noscope=false` and `attackerBlind=false` on *every* kill in all 14 demos. These are 1v1 duels — `AttackerBlind` needs a teammate to flash you, and there are no teammates. The classifier branches for both are independently mutation-verified (inverting either reddens `TestClassifyWeirdKillBranches`).
- **Knife weapon-name breakdown:** all 15 raw knife kills report `Knife` and normalize to the single `common.EqKnife` type — no skin escaped the one counter (no hand-rolled skin list needed, as the story specified).

### Completion Notes List

Implemented exactly the story's shape — five integer counters, no deviation. `supabase/migrations/`, `app/`, `lib/` and every `.ts`/`.sql` file are **untouched** (verified via `git status`): the widening is parser + writer only, as `0007:24–34` requires. `worker/db/fake.go` needed no change (it stores the whole `StatRow` struct, so it widened automatically) — read and confirmed, not assumed. `utility_damage` / the `PlayerHurt` handler were **not** touched: FR-19's molotov/HE clause was already shipped by 5.1. `validate.go` was **not** touched, and the open Epic-3 conservation-gate action item was left for Story 5.4 as directed.

Design choice carried from the 5.1 review: the *decision* lives in a pure `classifyWeirdKill(events.Kill) weirdKinds`, and only the *increment* stays in the parser closure. That is what makes all five flags mutation-testable — and it is why the classifier column above is fully green where 5.1's in-closure `roundStarted` guard was not.

Upsert invariants re-read before editing and left intact: `status` stays absent from the `DO UPDATE` set-list (AD-7 — an approved row stays approved across a re-parse), and the bracket `match_id` stays absent from **both** lists (adding it would set `match_id = excluded.match_id = NULL` and silently unbind every bound match on every re-parse). The positional renumbering was re-checked by hand: 19 columns, `$1..$19`, 19 arguments, in the same order; a comment now marks the argument list as positional so a future widening does not drift.

**Two honest coverage disclosures (both predicted by the story; neither is papered over):**

1. ~~**The five `cur.<x>[k]++` increments inside the `events.Kill` closure survive deletion with no Go test reddening.**~~ **CLOSED by the 2026-07-21 code review.** The original disclosure was right that `FakeParser` cannot drive a real parser event handler — but its compensating argument was incomplete. THE BAR reconciliation (11 counted flagged kills matching the aggregate) proves no increment is **missing**; it cannot detect a **transposition**, because swapping two counters keeps each one `≤ kills` and leaves `Σkills`/`Σdeaths`/`ΣRoundsWon` untouched — a green suite *and* a green BAR with two comedy columns silently traded forever. The review extracted the flag→counter binding into `(*roundStats).addWeirdKills`, leaving the closure with nothing but `cur.addWeirdKills(k, classifyWeirdKill(e))`. Both halves are now pure and fake-reachable, and `TestAddWeirdKillsBindsEachFlagToItsOwnCounter` asserts the whole five-counter vector per case, so a drop *or* a swap in either direction reddens.
2. **The SQL `DO UPDATE` set-list and the positional argument list are not reachable by the in-memory fakes** (they store the `StatRow` struct; they never execute SQL), so dropping `knife_kills = excluded.knife_kills` — or a `row.KnifeKills` argument — reddens no Go test. This is the accepted 4.6a/5.1 precedent; the five lines mirror the live-verified `rounds_won`/`assists` lines structurally in both the column list and the set-list.

**Flag to Story 5.5 (leaderboard view), not solved here:** rows written *before* this story keep `NULL` in the five columns until their demo is re-parsed (Story 3.6 `RunReparse` re-derives everything through this same upsert). That is expected and is deliberately **not** a backfill — 5.5 must treat these as the nullable ints they are.

**Pending after sign-off:** `worker/cmd/qa52/` is the throwaway THE BAR harness, kept in the tree so the reviewer can re-run the live gate (`go run ./cmd/qa52 ../demos`). Delete it once the story is signed off, per the 5.1 precedent.

### File List

Modified:
- `worker/ingest/parse.go` — `PlayerStat` +5 fields; `roundStats` +5 maps; `newRoundStats` init; `foldRounds` +5 survivor-fold loops; new pure `classifyWeirdKill` + `weirdKinds`; **(review)** new `(*roundStats).addWeirdKills` binding flag→counter outside the closure, which now holds only `cur.addWeirdKills(k, classifyWeirdKill(e))`; **(review)** the post-round-kill property pinned as deliberate above the `events.Kill` handler; doc comments
- `worker/db/db.go` — `StatRow` +5 fields; `upsertStatRows` column list, `$1..$19` placeholders, positional args and `DO UPDATE` set-list; doc comments
- `worker/ingest/cli.go` — first-parse `PlayerStat`→`StatRow` map +5 fields; two stale "Epic-5 columns stay NULL" comments corrected
- `worker/ingest/reparse.go` — re-parse map +5 fields (the mirrored second path)
- `worker/ingest/parse_test.go` — new `TestClassifyWeirdKillBranches` (10 cases); `TestFoldRoundsDropsStrandedRounds` extended with the five counters; **(review)** new `TestAddWeirdKillsBindsEachFlagToItsOwnCounter` (8 vector cases + accumulation + per-player isolation) — the transposition net
- `worker/ingest/cli_test.go` — `cannedParse` fixture +5 distinct values per player; `assertCoreSeven` → `assertDerivedStats` (now all twelve derived fields); new `TestRunCLIZeroWeirdStatsRecordedAsZeroNotOmitted` (AC2)
- `worker/ingest/reparse_test.go` — re-parse happy path now asserts through `assertDerivedStats`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story status transitions

Added (throwaway, delete after sign-off):
- `worker/cmd/qa52/main.go` — THE BAR live-QA harness (real parser over `demos/*.dem.gz` + independent raw per-kill diagnostic)

## Change Log

| Date | Change |
|---|---|
| 2026-07-21 | **Code review (3 parallel layers) → done.** No AC and no prohibition violated; the Auditor independently reproduced the mutation set and THE BAR. 1 decision resolved (post-round kills COUNT — deliberate, pinned in the handler comment), 9 patches applied, 5 deferred, 3 dismissed. Headline: the five flag→counter bindings were extracted from the `events.Kill` closure into a pure `(*roundStats).addWeirdKills`, closing the seam where a **transposed** counter passed both the Go suite and THE BAR. New `TestAddWeirdKillsBindsEachFlagToItsOwnCounter`; mutation-verified 5/5. Gates green; THE BAR re-run reproduces the pre-patch numbers exactly (behaviour-neutral). |
| 2026-07-21 | Story 5.2 implemented: the FR-19 weird five (`knife_kills`, `wallbang_kills`, `through_smoke_kills`, `no_scope_kills`, `blind_kills`) derived per player per match from native `events.Kill` fields via a pure `classifyWeirdKill`, buffered through the per-round scratch (trap-4 safe), and written by the worker alone through the one shared `upsertStatRows` (AD-2) at both mapping sites. No migration, no SQL, no app change. 25 mutants run (20 reddened, 5 survivors disclosed); THE BAR green on all 14 real demos. Status → review. |
