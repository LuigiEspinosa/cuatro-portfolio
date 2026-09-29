---
baseline_commit: 3a99d8c
---

# Story 5.3: Derived stat derivation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a viewer,
I want entry frags and 1vX clutches derived from the event stream,
so that opening-duel and clutch award tracks are accurate.

## Acceptance Criteria

**AC1 — the opening duel is derived per round, from the LIVE round only.**
**Given** the derived-stats requirement (FR-20, AD-2) and FR-20's testable consequence,
**When** the worker derives a match,
**Then** each round's **first kill after freeze time ends** credits its killer one `entry_frags` and its victim one `opening_deaths`; a round with no such kill produces **no** opening duel; and world/bomb deaths (`Killer == nil`) and suicides (`Killer == Victim`) are **never** opening deaths and never latch the duel.

**AC2 — a 1vX clutch is a TRANSITION, and it is recorded by X.**
**Given** FR-20's rule ("a Player **becomes** the last alive on their team, X = living opponents at that instant, and their team then wins by elimination or objective"),
**When** a death reduces a player's team from **≥2 alive to exactly 1 alive**, and that player's team then wins the round,
**Then** the survivor is credited a 1vX clutch at the X **locked at the instant they became last alive**; `clutches` is stored on `stat_row` as the `{"1":n,"2":n,…}` jsonb shape.
**And** a team that was **never** at ≥2 alive never produces a candidate — so a 1v1 match yields **no** clutches. *(Decision, Cuatro, 2026-07-21 — see "The clutch decision" below. This is not a bug and must not be "fixed".)*

**AC3 — zero is recorded as zero, never omitted; `clutches` is `{}`, never `null`.**
**Given** the FR-19 zero-not-omitted convention Story 5.2 established, extended to FR-20,
**When** a player earned no entry frags / opening deaths / clutches,
**Then** `entry_frags` and `opening_deaths` are written `0` and `clutches` is written the **empty jsonb object `{}`** — never SQL `NULL` and never the jsonb scalar `null`, so Story 5.5's view can read `clutches->>'1'` with no NULL branch.

**AC4 — single writer, no schema change.**
**Given** the single-writer rule (AD-2),
**When** these stats are written,
**Then** they are written **only** by the worker via the service role into `stat_row`, through the one shared `upsertStatRows` used by **both** `RecordParse` and `RecordReparse`. `supabase/migrations/`, `app/`, and `lib/` are **untouched** — all three columns already exist, nullable, since `0007`.

**AC5 — the derivation is proven live, not assumed.**
**Given** the Story-5.2a precedent (a column shipped permanently empty because a zero was explained away instead of measured),
**When** THE BAR runs over the 14 real demos,
**Then** `events.RoundFreezetimeEnd` is shown to **actually fire** with a counted total, and the empty `clutches` result is proven **positively** by printing the per-round team sizes (a transition to "exactly 1 alive" is structurally impossible at `T:1 CT:1`) — a zero that is only *argued* is not accepted.

_Traces: FR-20 · AD-2_

---

### READ THIS FIRST — three prohibitions and one decision

1. **NO MIGRATION. NO SQL FILE. NO app/route/TS change.** `entry_frags int, opening_deaths int, clutches jsonb` already exist (nullable) at [0007_stat_row.sql:46](supabase/migrations/0007_stat_row.sql#L46), and `0007:24–34` says verbatim that Epic 5 "only widens the parser, never the schema". If you open a migration, you have left the story.
2. **DO NOT touch `worker/ingest/validate.go`.** The open Epic-3 action item ("relax the conservation gate to `Σkills > Σdeaths`") is **pinned to Story 5.4**, and 5.3 was explicitly declared out of scope for it ([sprint-status.yaml:198](_bmad-output/implementation-artifacts/sprint-status.yaml#L198)). No new validation gate for FR-20 either.
3. **DO NOT touch `idle_dq` / `idle_round_count`** — those are Story 5.4 and stay at their column defaults.

**Entry success rate is NOT computed here.** FR-20 defines `entry success = entry_frags ÷ (entry_frags + opening_deaths)`, but AD-20 (one-owner aggregation) puts every ratio in the Story-5.5 leaderboard view — exactly as `ADRDamage`/`HSKills`/`KASTRounds` store raw numerators today. **Store counts. Divide nowhere.**

| FR-20 stat | `stat_row` column (exists since 0007) | `PlayerStat` field to add | Derivation |
|---|---|---|---|
| entry frags | `entry_frags` | `EntryFrags int` | killer of the first live-round kill with a real, non-self killer |
| opening deaths | `opening_deaths` | `OpeningDeaths int` | victim of that same kill |
| 1vX clutches | `clutches` (jsonb) | `Clutches map[int]int` | X → count; transition-only, awarded at `RoundEnd` to the winning team's candidate |
| entry success rate | *(none — a ratio)* | *(none)* | **Story 5.5's view. Out of scope.** |

---

### The clutch decision (Cuatro, 2026-07-21) — and the empty result it produces

FR-20 says a player "**becomes** the last alive on their team". In a 1v1 each team has exactly one player, so nobody ever *becomes* last alive — they start that way. Three readings were put to Cuatro; **transition-only was chosen**:

> A clutch fires **only** when a **teammate's** death reduces the player's team from ≥2 alive to exactly 1 alive.

Consequences you must implement and must not paper over:

- **The entire first tournament is 1v1 on wingman maps** (confirmed 2026-07-21). Under transition-only, `clutches` will be `{}` for **every player in every match of this tournament**. That is the correct, chosen behaviour.
- **It falls out of the rule — do not special-case it.** On a death, look at the **victim's** team: if it now has *exactly 1* alive, that survivor becomes a candidate. In a 1v1 the victim's team goes 1 → 0, never → 1. No branch named "1v1" should appear anywhere in the code.
- **AC5 makes you prove it.** THE BAR must print the per-round team sizes so the empty result is demonstrated as structural (`T:1 CT:1` on every round), not asserted. Story 5.2a exists because a zero was explained away with a plausible story instead of measured; do not repeat it.
- **Flag it to Story 5.5, do not solve it here.** A "Don Clutch — 1vX ganados" award over this data has **no possible winner**. That is a 5.2a-class empty-award risk and belongs in 5.5's award-catalog scoping (or a format change), not in the parser. Record it in Completion Notes.
  - **⚠ AMENDED AT CODE REVIEW (2026-07-21, Cuatro).** This instruction was **overtaken by an in-session decision and is no longer what happened.** Cuatro elected to **retire the award and keep the bucket** during implementation, so the dev removed it from both `mock-leaderboards.html` files and the `EXPERIENCE.md` a11y example, and annotated the binding decision onto `5-5-…` and `6-1-award-catalog-and-buckets` in sprint-status. The code review flagged this as out-of-scope against the instruction above; **Cuatro confirmed the authorization and chose to keep the edits.** Recorded here so the spec no longer contradicts what shipped. Note the *parser* prohibition still stands and was honoured: no code, schema, PRD or architecture change was made for this — the derivation is untouched and a 5v5 format repopulates the award with no code change.

## Tasks / Subtasks

> Same shape as 5.1 / 5.2 / 4.6a: widen `PlayerStat` → widen `roundStats` → derive in the handlers → widen `StatRow` → widen the two `upsertStatRows` lists → widen **both** mapping sites → widen the tests. **The new part** is a new `RoundFreezetimeEnd` handler and two pure state machines.

- [x] **Task 1 — Widen the parser payload (AC: 1, 2)**
  - [x] In [worker/ingest/parse.go](worker/ingest/parse.go), add to `PlayerStat`, grouped under a comment naming them the FR-20 derived three (Story 5.3):
    ```go
    EntryFrags    int         // killer of the round's first live kill (FR-20 opening duel)
    OpeningDeaths int         // victim of that same kill
    Clutches      map[int]int // X -> count of 1vX clutches WON; nil/empty when none
    ```
  - [x] Update the `PlayerStat` doc comment: the parser now fills FR-18 core + FR-19 weird + FR-20 derived; only FR-21's `idle_dq` / `idle_round_count` (Story 5.4) remain at their nullable column defaults. Restate that raw counts are stored and every ratio (ADR, HS%, KAST%, **entry success**) is divided once in the 5.5 view (AD-20).

- [x] **Task 2 — The opening duel: a PURE, live-gated latch (AC: 1)**
  - [x] Add to `roundStats`: `live bool`, `entryFrag uint64`, `openingDeath uint64`, `duelDone bool`.
  - [x] Add a method — **the `live` gate goes INSIDE it**, so the post-round-kill exclusion is itself mutation-testable:
    ```go
    // recordOpeningDuel latches this round's opening duel on the FIRST kill of the LIVE round that has a
    // real killer who is not the victim. Returns true if it latched.
    func (rs *roundStats) recordOpeningDuel(killer, victim uint64) bool {
        if !rs.live || rs.duelDone { return false }
        if killer == 0 || victim == 0 || killer == victim { return false }
        rs.entryFrag, rs.openingDeath, rs.duelDone = killer, victim, true
        return true
    }
    ```
  - [x] **`killer == 0` and `killer == victim` are FR-20 requirements, not defensive noise** — "bomb/suicide deaths are not opening deaths" ([prd.md:310](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L310)). A bomb death before the first real kill must **not** latch the duel and must **not** block it either: the loop keeps looking, so the first *real* kill still wins the duel. Pin that in the comment.

- [x] **Task 3 — The 1vX clutch: a PURE transition state machine (AC: 2)**
  - [x] Add a `clutchTracker` next to `kastQualified` — **it must not import or hold any demoinfocs type**, so every branch is table-testable with plain ints:
    ```go
    type clutchTracker struct {
        team       map[uint64]int // LIVING player -> their team id, as snapshotted at freezetime-end
        aliveOn    map[int]int    // team id -> living count
        candidates map[uint64]int // player who BECAME last alive -> X (living opponents AT THAT INSTANT)
    }
    func newClutchTracker() *clutchTracker
    func (ct *clutchTracker) addAlive(sid uint64, team int)
    func (ct *clutchTracker) kill(victim uint64)              // no-op for an unknown/already-dead victim
    func (ct *clutchTracker) award(winners map[uint64]bool) map[uint64]int // sid -> X, winners only
    ```
  - [x] `kill(victim)`: look up the victim's team; if unknown (late joiner, duplicate event) **return without touching any counter** — idempotence, and it is what keeps `aliveOn` from going negative. Otherwise delete the victim, decrement `aliveOn[t]`, and **only if `aliveOn[t] == 1`** find that team's single survivor and record `candidates[surv] = Σ(alive on all OTHER teams)`. Counts only ever decrease, so a team reaches exactly-1 at most once.
  - [x] **`X == 0` is not a clutch** — if every opponent is already dead the round is over; record no candidate.
  - [x] **A candidate who later dies KEEPS their candidacy.** FR-20 names "bomb explosion" as a winning path, so the plant-and-die clutch counts. Deliberate; pin it in the comment with the PRD citation so it is not "fixed".
  - [x] Both teams can hold a candidate simultaneously (a 5v5 that decays to 1v1). `award()` resolves it by **winner membership**, never by side — the same trap-2-safe move `RoundsWon` makes.

- [x] **Task 4 — Arm the round at `RoundFreezetimeEnd` (AC: 1, 2, 5)**
  - [x] Register a **new** handler. It skips warmup like every other handler, sets `cur.live = true`, and snapshots the living roster into a fresh `cur.clutch`:
    ```go
    p.RegisterEventHandler(func(e events.RoundFreezetimeEnd) {
        if p.GameState().IsWarmupPeriod() { return }
        cur.live = true
        cur.clutch = newClutchTracker()
        for _, pl := range p.GameState().Participants().Playing() {
            if pl == nil || pl.SteamID64 == 0 { continue }
            cur.clutch.addAlive(pl.SteamID64, int(pl.Team))
        }
    })
    ```
  - [x] **`pl.Team` is a plain struct field** ([common/player.go:26](https://pkg.go.dev/github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common)) — no entity dereference, no `demoInfoProvider`, no panic risk. **Do NOT use `pl.IsAlive()` or `pl.GetTeam()` anywhere in this story**: both go through `PlayerPawnEntity()` and are exactly the class of live-state call Story 5.2a had to route around. Alive-tracking here is derived from the event stream, which is what makes it pure.
  - [x] **⭐ This handler is the whole reason post-round kills cannot corrupt FR-20.** `cur` is reset to a fresh `newRoundStats()` at `RoundEnd`, where `live` is `false`; `live` only becomes true again at the **next** `RoundFreezetimeEnd`. So the post-round knife-around — which Cuatro deliberately **counts** for the FR-19 weird five ([parse.go:429](worker/ingest/parse.go#L429)) — lands in the next round's scratch with `live == false` and can neither claim that round's entry frag nor move its alive counts. **Both behaviours are correct and they must coexist. Do not "unify" them.**

- [x] **Task 5 — Feed the two derivations from the existing `events.Kill` handler (AC: 1, 2)**
  - [x] Inside the **existing** handler, after the existing killer/victim/assister blocks, add exactly two calls — no new handler, no change to the warmup skip or to any existing block:
    ```go
    cur.recordOpeningDuel(idOf(e.Killer), idOf(e.Victim))
    if cur.live && cur.clutch != nil { if v := idOf(e.Victim); v != 0 { cur.clutch.kill(v) } }
    ```
  - [x] **⚠ The two gates differ ON PURPOSE.** The opening duel excludes world/bomb/suicide deaths (FR-20). The clutch alive-count must include **every** death — a teammate dying to the bomb still reduces the team to 1. Do not collapse them into one condition.

- [x] **Task 6 — Close out the round in `RoundEnd`, and fold (AC: 1, 2)**
  - [x] Add `clutchWon map[uint64]int` to `roundStats` (the awarded result, so it rides the same trap-4 assign/overwrite commit as every other stat).
  - [x] In the `RoundEnd` handler, **inside the existing `if e.WinnerState != nil` block**, reuse the `winners` slice already built for `RoundsWon` — build a `map[uint64]bool` from it and call `cur.clutchWon = cur.clutch.award(winnerSet)`. Do **not** iterate `Members()` a second time; do **not** read `e.Winner` or any side identifier. A draw leaves `WinnerState == nil` → no clutch (trap 3, unchanged).
  - [x] Guard `cur.clutch != nil` — a demo whose first `RoundFreezetimeEnd` never fired has no tracker for that round.
  - [x] In `foldRounds`, under the same `idx > final` stranded-round bound as every other stat:
    ```go
    if rs.duelDone {
        if s := get(rs.entryFrag); s != nil { s.EntryFrags++ }
        if s := get(rs.openingDeath); s != nil { s.OpeningDeaths++ }
    }
    for sid, x := range rs.clutchWon {
        if s := get(sid); s != nil {
            if s.Clutches == nil { s.Clutches = map[int]int{} }
            s.Clutches[x]++
        }
    }
    ```
  - [x] **⛔ Do NOT write a bare `stats[k].EntryFrags++` at event time.** Every derived value must land in the per-round scratch and commit at `RoundEnd`. This is the trap-4 correction (see Dev Notes) — a **measured** +1 over-count on 14 of 14 real demos, and 5.2 measured a **15×** over-count on knife kills from exactly this mistake.

- [x] **Task 7 — Widen the single-writer upsert, including the jsonb (AC: 3, 4)**
  - [x] Add `EntryFrags int`, `OpeningDeaths int`, `Clutches map[int]int` to `StatRow` in [worker/db/db.go](worker/db/db.go) with the same grouping comment; update the struct doc (which currently says the FR-20/FR-21 columns "stay NULL").
  - [x] Add a marshaling helper and **use `make`, not a nil map**:
    ```go
    // clutchesJSON renders the 1vX tally as the {"1":n,…} jsonb shape (SOLUTION-DESIGN §3). A player with
    // no clutches yields "{}" — an EMPTY OBJECT, never `null` (AC3), so 5.5's view reads clutches->>'1'
    // with no NULL branch.
    // ⚠ json.Marshal of a NIL map yields the literal `null`. The make() below is what makes {} correct;
    //   it is the same nil-vs-empty trap already documented for RecordReparse's newIDs (db.go:290) and
    //   stampDemo's anomaly_reasons (db.go:317-320). Do not "simplify" it away.
    func clutchesJSON(c map[int]int) (string, error)
    ```
    Skip non-positive counts; keys are `strconv.Itoa(X)`.
  - [x] `upsertStatRows`: add `entry_frags, opening_deaths, clutches` to the INSERT list, three new placeholders (`$20, $21, $22` — the last one **`$22::jsonb`**), the three values in the `batch.Queue` argument list, **and** three `<col> = excluded.<col>` lines in the `DO UPDATE` set-list. `clutchesJSON` returns an error — surface it as a wrapped error from `upsertStatRows` (fail closed inside the caller's tx), do not swallow it.
  - [x] **⚠ INVARIANTS THAT MUST SURVIVE ([db.go:359-366](worker/db/db.go#L359-L366)):** `status` stays ABSENT from the `DO UPDATE` set-list (an approved row stays approved across a re-parse — AD-7). `match_id` (the bracket id) stays ABSENT from **BOTH** lists — adding it would write `match_id = excluded.match_id = NULL` and silently unbind every bound match on every re-parse. **Re-read both comment blocks before editing and leave them intact.**
  - [x] Renumbering check: the placeholders are positional. After inserting three, verify `$1..$22` still line up 1:1 with the argument order. A silent off-by-one writes the wrong stat into the wrong column and **no unit test catches it** (the fakes store the struct, they never execute SQL).

- [x] **Task 8 — Populate at BOTH mapping sites (AC: 1, 2, 3, 4)**
  - [x] [worker/ingest/cli.go](worker/ingest/cli.go) `parseAndRecord` first-parse map: copy all three. Fix the now-stale comments at [cli.go:100-101](worker/ingest/cli.go#L100-L101) ("only FR-20/FR-21's entry frags, opening deaths, clutches and idle columns stay NULL") and [cli.go:121-122](worker/ingest/cli.go#L121-L122) — after this story **only FR-21's idle columns stay NULL**.
  - [x] [worker/ingest/reparse.go](worker/ingest/reparse.go) re-parse map: copy the same three, under the existing "⚠ MUST mirror cli.go's first-parse map verbatim" warning — and update its count ("all TWELVE derived fields" → **fifteen**), or the warning stops describing what it guards.
  - [x] **This is the recurring Epic-4/5 failure mode.** A field mapped in `cli.go` but dropped in `reparse.go` writes correct values on first parse and then **destroys that column on every re-parse**. For `clutches` the damage is worse than a zero: a dropped map maps to `nil` → `"{}"`, silently erasing a player's clutch history with no error. Widen both sites in the same edit and prove both with tests.
  - [x] `Clutches` is a **map**, so both maps copy a *reference* into the `StatRow`. That is acceptable — nothing mutates the parse result after mapping — but **do not mutate `row.Clutches` or `pl.Clutches` anywhere downstream**.

- [x] **Task 9 — Tests (unit) + mandatory mutation testing (AC: 1, 2, 3, 4)**
  - [x] `TestRecordOpeningDuelLatchesFirstRealKill` in [worker/ingest/parse_test.go](worker/ingest/parse_test.go), pure over `roundStats`: not-live round does **not** latch · world kill (`killer == 0`) does not latch · suicide (`killer == victim`) does not latch · a bomb death followed by a real kill latches on the **real** kill · the first real kill latches · a **second** real kill does **not** overwrite it · a round with no kills leaves `duelDone == false`.
  - [x] `TestClutchTrackerTransitionOnly`, pure table test over plain ints:
    - **1v1 → no candidate, ever** (the tournament-mode case; label it so nobody deletes it).
    - 2v2: teammate dies → survivor is a candidate with `X == 2`; an opponent then dies → **X stays 2** (locked at the instant).
    - 5v5 chain: four teammates die → candidate with X = opponents alive at that moment.
    - Both teams decay to 1 → **two** candidates, each with their own X.
    - A candidate who later dies **keeps** candidacy (the FR-20 bomb-explosion path).
    - `X == 0` (all opponents already dead) → no candidate.
    - Unknown victim and duplicate death → no-op; `aliveOn` never goes negative and no candidate appears.
  - [x] `TestClutchAwardOnlyWinningTeam`: `award()` credits a candidate **in** the winners set and not one outside it; an empty winners set (a draw, `WinnerState == nil`) credits nobody.
  - [x] Extend `TestFoldRoundsDropsStrandedRounds` with the three new values: they fold across surviving rounds, respect the `idx > final` bound, and a round with `duelDone == false` contributes nothing.
  - [x] `TestClutchesJSON` in `worker/db`: `nil` → `"{}"` · empty map → `"{}"` · `{1:2,3:1}` → the two keys present as **strings** · a zero/negative count is omitted. **The nil → `"{}"` case is the AC3 money test** — it reddens if `make` is replaced by a nil map.
  - [x] Widen `cannedParse()` in [worker/ingest/cli_test.go](worker/ingest/cli_test.go) with three more **distinct-per-field, per-player** values (no two fields in a row sharing a value, so a copy/paste swap reddens), keeping the fixture plausible: `entry_frags ≤ kills`, `opening_deaths ≤ deaths`, and a non-empty `Clutches` map for at least one player. Extend `assertDerivedStats` to cover **all fifteen** derived fields, and keep it called from **both** the `cli_test.go` first-parse happy path and the `reparse_test.go` re-parse happy path.
  - [x] **AC3 zero-case:** extend/mirror `TestRunCLIZeroWeirdStatsRecordedAsZeroNotOmitted` so a player with zeros and a nil `Clutches` still produces a `StatRow` with `EntryFrags == 0`, `OpeningDeaths == 0` and a **non-nil** clutch rendering — the row is neither skipped nor partially mapped. State plainly in the comment what no Go test can reach (0-vs-NULL and `{}`-vs-`null` **at the SQL level**).
  - [x] **Mutation testing is MANDATORY before review** (standing project rule — [memory: mutation-test-suite-before-review]). Per effect, each must redden a **named** test: drop each of the 3 fields from `cli.go`'s map · drop each from `reparse.go`'s map · invert/remove the `!rs.live` gate · remove the `killer == victim` guard · remove the `killer == 0` guard · remove the `rs.duelDone` re-latch guard · change `aliveOn[t] == 1` to `<= 1` or `>= 1` · remove the `X == 0` guard · make `award()` ignore the winners set · replace `make(...)` with a nil map in `clutchesJSON`. Restore and re-verify green. Record the table in Debug Log References. **A suite that survives these is blind and does not count as coverage.**
  - [x] Gates in `worker/`: `gofmt -l .` empty · `go build ./...` 0 · `go vet ./...` 0 · `go test ./... -count=1` all ok.
  - [x] **Known, disclosable coverage limits (do not paper over them):** (a) the SQL `DO UPDATE` set-list and the positional argument list are unreachable by the in-memory fakes — the accepted 4.6a/5.1/5.2 precedent; mirror the live-verified lines structurally and say so. (b) The `RoundFreezetimeEnd` handler body and the two call lines inside the `events.Kill` closure cannot be driven by `FakeParser` — **THE BAR is their coverage**, and Task 10 is written to make that coverage *positive* (a count that must be non-zero), not an argument.

- [x] **Task 10 — THE BAR: live-QA over the real demos (AC: 1, 2, 3, 5)**
  - [x] Build `worker/cmd/qa53` (throwaway, same pattern as `qa52`) running the **real** `ingest.DemoinfocsParser` over the 14 `.dem.gz` in `demos/` (gzip — stream through `gzip.NewReader`). Usage `go run ./cmd/qa53 ../demos`.
  - [x] **🚨 GATE 1 — PROVE `RoundFreezetimeEnd` FIRES.** Count the event per demo in a raw second pass and print the total alongside `RoundsPlayed`. **If the count is 0, STOP and report — do not sign off.** A dead freeze-time signal makes `entry_frags` permanently 0 for every player with no error anywhere to reveal it: precisely the `blind_kills` failure of Story 5.2a. *(Verified at contexting from the pinned v5.2.0 source: with the default parser, Source-1 game-event mimicry is **enabled**, so `round_freeze_end` dispatches `events.RoundFreezetimeEnd` while `RoundFreezetimeChanged` is stashed and NOT dispatched — `datatables.go:1101-1115`, `game_events.go:363`. The named fallbacks if it is dead anyway: `GameState().IsFreezetimePeriod()` sampled at kill time, or `RoundFreezetimeChanged` with mimicry disabled. Do not switch sources without measuring first.)*
  - [x] **🚨 GATE 2 — PROVE THE EMPTY `clutches` POSITIVELY.** At each `RoundFreezetimeEnd`, print the per-team living counts. The expected finding is **`T:1 CT:1` on every round of all 14 demos**, which makes a ≥2 → 1 transition structurally impossible. **Report the measured team sizes, not the conclusion.** If any round shows a team of ≥2 and `clutches` is still empty, that is a defect — investigate before sign-off.
  - [x] Invariants, per player per demo: `entry_frags ≥ 0`, `entry_frags ≤ kills` · `opening_deaths ≥ 0`, `opening_deaths ≤ deaths` · **`Σentry_frags == Σopening_deaths`** across the demo (every opening duel credits exactly one of each) · `Σentry_frags ≤ RoundsPlayed` (at most one duel per round) · every clutch key `X ≥ 1`.
  - [x] **Raw reconciliation** (the 5.2 discipline): a second pass that prints, per round index, the first live kill it sees. The count at round indices `> 0` must reconcile **exactly 1:1** with `Σentry_frags`. ~~and any first-kill at round index 0 must be **absent** from the aggregate (trap-4 working, not a miss).~~ **⚠ TASK TEXT CORRECTED AT CODE REVIEW (2026-07-21) — as written this clause was WRONG, and the implementation was silently right.** Kill-time round index 0 spans **both** the discarded MatchZy pre-match round **and its replay**, so the correct expectation is **2 seen at index 0 collapsing to exactly 1 committed duel** (measured on 14/14), not 0 in the aggregate. Requiring absence would have demanded the replayed round's genuine duel be dropped. The dev implemented and reported the right behaviour but reinterpreted the acceptance text instead of flagging that it was wrong; recorded here so the next story inherits the corrected rule.
  - [x] **Regression net — 5.1 + 5.2 + 5.2a must be unperturbed on 14/14:** `Σkills == Σdeaths == RoundsPlayed` · `ΣRoundsWon == RoundsPlayed` · and the weird five reproduce the 5.2a numbers **exactly**: `knife 1 · wallbang 8 · smoke 2 · noscope 0 · blind 4`, with the 4 blind kills at round indices 3/5/9/13. Any drift means this story perturbed the fold.
  - [x] **Task 10b — the owed cleanup.** Story 5.2a left `worker/cmd/qa52/` and `worker/cmd/qaflash/` in the tree with "delete both in a follow-up". **This is that follow-up.** `qa53` must carry the weird-five regression checks forward (above) so nothing is lost, then **delete both directories** in this story's commit. Note the deletion in the File List.

### Review Findings

*Code review 2026-07-21 (bmad-code-review, 3 layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor; all 3 completed). 28 raw findings → 15 after dedup. THE BAR was re-run independently by the reviewer and reproduced every headline number exactly (221 freeze-ends · Σentry 204 = Σopening 204 · Σclutches 0 · GATE 2 `T:1 CT:1` ×221 · weird five 1/8/2/0/4 · blind `[3 5 9 13]` · exit 0). AC1–AC4 PASS. AC5 PARTIAL — the measurements are real and reproduce, but three of the claims narrated around them are not backed by the code or the data.*

**Decision needed — BOTH RESOLVED by Cuatro, 2026-07-21 (during this review)**

- [x] [Review][Decision] **The Don Clutch award was RETIRED, not flagged — the spec forbade solving it here** — Spec line 77 says verbatim: "**Flag it to Story 5.5, do not solve it here.** … Record it in Completion Notes." The diff instead removes the award from `mockups/mock-leaderboards.html` and `.working/mock-leaderboards.html`, rewrites the a11y reveal example in `EXPERIENCE.md:145`, and writes binding-decision annotations onto **two other stories'** sprint-status entries (`5-5-…` and `6-1-award-catalog-and-buckets`). The edits themselves match what the Completion Notes describe (diffed line by line — nothing beyond the claimed scope changed), so the content was never in question; the **authorization** was. → **RESOLVED (Cuatro, option a): the retirement WAS authorized in-session. Keep the edits; amend the spec instruction so the story no longer contradicts what shipped.** Converted to a patch below.
- [x] [Review][Decision] **`Participants().Playing()` is a TEAM filter, not an aliveness filter — the clutch roster can contain dead or disconnected players, and nothing ever reconciles it** — `parse.go:680-685` snapshots `Playing()`, which filters on `Team` only (verified in demoinfocs v5.2.0 `game_state.go:386-395`). The **only** thing that ever decrements `aliveOn` is `events.Kill` (`parse.go:279-285`); there is no `PlayerDisconnected` handler anywhere in `Parse`. So a player who is on a team at freeze-time end but never produces a Kill event is a permanent phantom: a mid-round disconnect on the *decaying* team means it never reaches exactly-1 and a **genuine clutch is silently dropped**; a disconnect on the *other* team **inflates X** (a real 1v1 published as `{"2":1}`, which 5.5's `clutches->>'1'` read would miss entirely); and a player already dead at freeze-time end (freeze-time suicide, carried-over molotov) breaks the transition the same way. Three comments assert a guarantee the code does not provide — `addAlive` says "one **living** player", the handler says "snapshots the **living** roster", the struct field says "**LIVING** player". **Zero impact on this tournament** (1v1, `T:1 CT:1` on all 221 rounds, Σclutches 0 — measured), so this is a 5v5-only correctness gap. → **RESOLVED (Cuatro, option a): accept as a DOCUMENTED 5v5 limitation. No `PlayerDisconnected` handler, no relaxation of the `IsAlive()` prohibition — the purity that makes AC2 mutation-testable is worth more than a gap no 1v1 demo can reach.** Correct the three misleading comments and pin the limitation; converted to a patch below, with the 5v5 revisit filed to deferred-work.

**Patch**

- [x] [Review][Patch] Amend spec line 77 ("Flag it to Story 5.5, do not solve it here") to record that Cuatro authorized the Don Clutch retirement in-session — the story currently contradicts what shipped [5-3-derived-stat-derivation.md:77]
- [x] [Review][Patch] Correct the three comments claiming a LIVING-roster guarantee `Playing()` does not provide, and pin the accepted 5v5 limitation at the snapshot [worker/ingest/parse.go:242,255,665-673]

- [x] [Review][Patch] `RoundFreezetimeEnd` re-entry resets the clutch tracker but NOT the opening-duel latch — half the round's FR-20 state survives a re-arm [worker/ingest/parse.go:674-686]
- [x] [Review][Patch] GATE 2 is print-only — no `failures = append`, so a team of ≥2 with empty `clutches` still prints "ALL INVARIANTS HELD" and exits 0 [worker/cmd/qa53/main.go:301-309]
- [x] [Review][Patch] Debug Log's GATE 1 explanation is contradicted by the data — "per demo one more than its rounds played" is false, and 204+14=218≠221 was self-refuting in the story [5-3-derived-stat-derivation.md:364]
- [x] [Review][Patch] `sprint-status.yaml`'s machine-readable `last_updated:` still says "CONTEXTED -> ready-for-dev" while line 2 and `development_status` say review [_bmad-output/implementation-artifacts/sprint-status.yaml:46]
- [x] [Review][Patch] File List omits the three UX/docs files actually modified, and the Completion Note claims a `git status` state that is false [5-3-derived-stat-derivation.md:390,432-448]
- [x] [Review][Patch] The qa53 "raw reconciliation" is a mirror of the production algorithm, not an independent derivation — the claim overstates what it proves [worker/cmd/qa53/main.go:227-256]
- [x] [Review][Patch] Task 10's index-0 expectation ("must be **absent** from the aggregate") contradicts the measured 2-seen/1-committed result and was silently reinterpreted rather than corrected [5-3-derived-stat-derivation.md:215]
- [x] [Review][Patch] `TestFakeParserEchoesResultAndErr`'s comment claims the `DeepEqual` switch "proves the MAP rides through the seam" — `FakeParser` echoes the same map header, so it compares an object with itself [worker/ingest/parse_test.go]

**Deferred**

- [x] [Review][Defer] FR-20's bomb exclusion is implemented only as `killer == 0`; a bomb kill attributed to the planter would latch a false opening duel [worker/ingest/parse.go:222] — deferred: **measured 0 bomb-explosion kills and 0 bomb-latched duels across all 14 demos**, so unreachable on current data; revisit if the format changes
- [x] [Review][Defer] A demo where `RoundFreezetimeEnd` never fires writes all-zero FR-20 columns with no anomaly; the only detector (GATE 1) lives in throwaway code [worker/ingest/validate.go] — deferred, out of scope by spec (`validate.go` is pinned to Story 5.4)
- [x] [Review][Defer] Task 10b: qa52's knife weapon-name breakdown and weird-five raw reconciliation, and qaflash's flash instrumentation, were not carried into qa53 [worker/cmd/qa53/main.go] — deferred, the literal Task 10b requirement (weird-five regression checks) is met
- [x] [Review][Defer] `blindRoundIdx` is collected from the unfiltered raw pass while `weirdTotals` comes from the fold — the two can disagree spuriously on a re-recorded demo [worker/cmd/qa53/main.go:219-221] — deferred, throwaway harness, currently agrees
- [x] [Review][Defer] EXPERIENCE.md's a11y example says "21 muertes" for a kills award, colliding with the "más muertes" comedy award [EXPERIENCE.md:145] — deferred, **pre-existing** terminology ambiguity (the mockup already used "muertes" for both at lines 486 and 500); belongs in an Epic 6/7 copy pass

**Dismissed as noise (3):** `clutchesJSON` filters non-positive values but not non-positive keys (unreachable — guarded upstream at `parse.go:310`) · `cannedParse` fixture violates Σentry==Σopening (a transposition-detection fixture, never fed through `foldRounds`; "fixing" it would weaken the distinct-value property) · the Σentry==Σopening line in `TestFoldRoundsDropsStrandedRounds` is arithmetically implied by the four constants above it (decorative, not wrong).

**Verified correct by the reviewer, independently of the story's claims** — `$1..$22` counted 1:1 by hand against the column list and the argument list (no transposition); `status` absent from the `DO UPDATE` set-list and `match_id` absent from **both** lists; all three fields present at **both** mapping sites; X locked at the transition instant; candidacy surviving the candidate's death; `award()` resolved by winner membership only; `clutchesJSON`'s `make(...)` rendering nil/empty as `{}` with the error returned **before** `batch.Queue` (fails closed); the M13 equivalent-mutant argument (agreed — `team`/`aliveOn` move in lockstep, so a wiped team leaves `surv == 0`); `TestFoldRoundsDropsStrandedRounds` genuinely asymmetric now; the three prohibitions held (no migration, no `app/`/`lib/`/`.ts`, `validate.go` and the idle columns untouched); qa52/qaflash actually deleted.

## Dev Notes

### Framing: 5.1 and 5.2 widened a machine. 5.3 adds new state to it.

Stories 5.1 and 5.2 were "add N counters to the existing per-round scratch". **5.3 is the first Epic-5 story that adds a new event handler and genuinely new round state** — a live-window gate and an alive-count state machine. The per-round machine itself (scratch `cur`, `RoundEnd` commit keyed on `TotalRoundsPlayed()`, the `roundStarted` idempotency guard, the survivor `foldRounds` bound) is **already correct and must not be restructured**. Read [worker/ingest/parse.go](worker/ingest/parse.go) top to bottom before editing — especially the `roundStats` doc comment (why commit-whole-round-then-ASSIGN) and the four-trap block above the `RoundEnd` handler.

The risk profile is different from 5.2's. 5.2's risk was inventing a shortcut. **5.3's risk is a plausible-looking zero** — see the next section.

### ⚠ The 5.2a lesson, which this story is most exposed to in the whole epic

Story 5.2 shipped `blind_kills` off `events.Kill.AttackerBlind` and reported `blind 0`, and **both the story and its code review** accepted that as "proven by mode" (1v1 duels, no teammates to flash you). The reasoning was false — in a 1v1 the *enemy* flashes you — and measurement later found 172 flash detonations and 4 genuinely-blind kills, all reporting `AttackerBlind == false`. The field was **dead**. Had it shipped, `blind_kills` would have read 0 for every player, all tournament, with no error anywhere. See [5-2a-blind-kills-live-source-amendment.md](_bmad-output/implementation-artifacts/5-2a-blind-kills-live-source-amendment.md).

**Story 5.3 has two candidate zeros**, and they are not the same:

| Zero | Status | What you must do |
|---|---|---|
| `clutches` empty | **Expected and chosen** (transition-only + 1v1) | Prove it *positively* by printing team sizes — GATE 2. A structural impossibility shown in data is proof; "duels have no teammates" as prose is not. |
| `entry_frags` all zero | **A DEFECT** | It means `RoundFreezetimeEnd` never fired. GATE 1 exists to catch exactly this. Never rationalize it. |

`no_scope_kills` is the third standing zero and is **explicitly out of scope** — 5.2a left it alone deliberately (16 scoped-weapon kills across 218, none no-scoped: an ordinary sample with no counter-evidence). Do not touch it.

### The exact demoinfocs v5.2.0 API (verified first-hand at contexting, from the pinned module cache)

- **`events.RoundFreezetimeEnd{}`** — an empty struct, dispatched from the Source-1 legacy game event `round_freeze_end` (`game_events.go:363`). With the default `dem.NewParser(r)` (mimicry **enabled**), this is the signal that fires; `RoundFreezetimeChanged` is stashed rather than dispatched (`datatables.go:1101-1115`). Event order per round is `RoundStart` → `RoundFreezetimeEnd` → … → `RoundEnd`, so `cur` (reset at the previous `RoundEnd`) is the correct scratch to arm.
- **`GameState().IsFreezetimePeriod() bool`** (`game_state.go:196`) is maintained regardless of mimicry — the cross-check/fallback if GATE 1 ever fails.
- **`common.Player.Team`** is a **plain struct field** (`common.Team`, a byte type) — safe to read and convert with `int(pl.Team)`.
- **⛔ `Player.IsAlive()` and `Player.GetTeam()` are OFF-LIMITS.** Both route through `PlayerPawnEntity()` / `Health()`, which read entity properties via the unexported `demoInfoProvider`. On a test-constructed `common.Player{}` they degrade to `false`/garbage rather than reflecting anything, and `GetTeam()` will panic on a nil pawn. This is the same live-state hazard Story 5.2a had to route around for `IsBlinded()`. **Alive-tracking in this story is derived from the event stream and stays pure** — that is not a stylistic preference, it is what makes AC2 mutation-testable.
- **`Participants().Playing()`** returns players currently on T/CT (benched/spectators excluded) — already the 5.1 KAST precedent for "who is participating".
- **`events.RoundEnd.WinnerState`** is `nil` on a draw (`Winner == TeamSpectators`) and `Members()` resolves the winning side's players **at this instant** — halftime-proof by construction (traps 2 and 3, unchanged). This is the only correct way to answer "did the candidate's team win".
- **Parser version is PINNED and must not move.** `ParserVersion = "demoinfocs-golang/v5 v5.2.0"` ([parse.go:17](worker/ingest/parse.go#L17)) is stamped on `demo.parser_version` every parse and stays in lockstep with `worker/go.mod` (AD-26). **Do not `go get -u`.** Nothing this story needs is missing from v5.2.0.

### The trap-4 pre-match round (measured, not hypothetical)

Every real MatchZy demo opens with a round that is **played, won, and then discarded** — and it is **not** warmup, so the `IsWarmupPeriod()` skip does not catch it. MatchZy restarts (`MatchStartedChanged true→false→true`, `ScoreUpdated 1→0`) and the game **rewinds** `TotalRoundsPlayed()`; the replayed round re-reaches the same index. Additive state accumulates into `cur` and is **ASSIGNED** into `byRound[TotalRoundsPlayed()]` at `RoundEnd`, so the replay **overwrites** the discarded round; `foldRounds` then drops any index above the final count.

**Measured cost of getting this wrong:** 5.1 found a `+1` round over-count on **14 of 14** demos; 5.2 found **14 of 15** raw knife kills sitting at round index 0 — a bare counter would have shipped a **15×** over-count on a comedy award. Your entry frags and clutches get the correction for free **only if they go through `cur`**.

Note also the `roundStarted` guard at the top of `RoundEnd` (added by 5.1's code review): a duplicate `RoundEnd` with no intervening `RoundStart` is skipped, so the destructive scratch-move stays idempotent. **Do not remove or restructure it**, and do not move the `cur` reset to `RoundStart`.

### Zero vs NULL vs `null` (AC3), and already-parsed matches

`entry_frags`/`opening_deaths` are Go `int`s unconditionally present in the INSERT list, so a player with none gets `0` by construction. **`clutches` is the one that can go wrong three ways**: SQL `NULL` (column omitted), the jsonb scalar `null` (a nil map marshaled), or `{}` (correct). Only `make(...)` gives you the third. That is why `TestClutchesJSON`'s nil case is called out as the money test.

Rows written **before** this story keep `NULL` in all three columns until their demo is re-parsed (Story 3.6 `RunReparse` re-derives everything through this same upsert). Expected; **not** a data migration — do not write a backfill script. Flag it to 5.5 as 5.2 did.

### No new validation gate

`Validate` ([worker/ingest/validate.go](worker/ingest/validate.go)) runs the three Story-3.4 gates (conservation, empty_stats, unreconciled). FR-20 changes none of them — `Σkills == Σdeaths` is untouched. **Do not add an FR-20 gate**, and do not touch the conservation gate: its relaxation is an open Epic-3 action item **pinned to Story 5.4** ([sprint-status.yaml:198](_bmad-output/implementation-artifacts/sprint-status.yaml#L198)). If you find yourself editing `validate.go`, you have left the story.

### Project Structure Notes

- Files you will touch (all Go, all existing, all under `worker/`): `worker/ingest/parse.go` (`PlayerStat` + `roundStats` + `newRoundStats` + `recordOpeningDuel` + `clutchTracker` + the new `RoundFreezetimeEnd` handler + two lines in the `events.Kill` handler + the `RoundEnd` close-out + `foldRounds`), `worker/db/db.go` (`StatRow` + `clutchesJSON` + `upsertStatRows`), `worker/ingest/cli.go` (first-parse map + two stale comments), `worker/ingest/reparse.go` (re-parse map + the mirror-count warning), plus `worker/ingest/parse_test.go`, `worker/ingest/cli_test.go`, `worker/ingest/reparse_test.go`, and a new `worker/db/db_test.go` (or the existing db test file) for `clutchesJSON`.
- **New (throwaway):** `worker/cmd/qa53/main.go`. **Deleted:** `worker/cmd/qa52/`, `worker/cmd/qaflash/` (Task 10b).
- **No change needed** in `worker/db/fake.go` — `FakeStatRecorder` stores the whole `StatRow` struct (no per-field copy), so it widens automatically. Read it and confirm; do not "helpfully" add per-field plumbing.
- **No file outside `worker/` changes.** `supabase/migrations/`, `app/`, `lib/` and every `.ts`/`.sql` file stay untouched.
- Naming/idiom: match the surrounding worker code — deterministic ordering (already sorted by SteamID64), fail-closed `recover()` on parser panic (already present), warmup + trap-4 discipline on every counted event, structured `log.Printf` warns (never silent).

### Testing standards

- Go unit tests via `go test ./...` in `worker/`; `go build ./...` and `go vet ./...` clean; `gofmt` clean. The suite injects `FakeParser`/`FakeStatRecorder`/`FakeRosterReader` — no real DB or `.dem` for unit tests.
- **Per-effect mutation testing is mandatory before review** (standing project rule, hard-won across Epic 4's 4.1–4.3 reviews). Report the table explicitly, survivors included.
- **Keep the DECISION pure, leave only the CALL in the closure.** `kastQualified` (5.1), `classifyWeirdKill` + `addWeirdKills` (5.2/5.2a) are the precedent; `recordOpeningDuel` and `clutchTracker` are the same move. This is the single design choice that decides whether AC1/AC2 are mutation-testable at all. The 5.2 review had to retro-fit it after finding that a **transposed** counter passed both the Go suite and THE BAR; do not make that mistake a third time.
- THE BAR (Task 10) is the live-QA gate and, with the automated gates, the sign-off — as in every prior worker story.

### Git / previous-story intelligence

- **Story 5.2a** (`3a99d8c`, HEAD) — the immediate predecessor and the story whose lesson this one is most exposed to. It amended 5.2's AC1 for one column after a dead event field shipped an empty award. **Carry forward:** measure zeros, do not narrate them.
- **Story 5.2** (`aac2df1`) — the exact structural template (widen struct → scratch → writer → both mapping sites → tests, no migration). Its review's headline finding was that logic inside the `events.Kill` closure is unreachable by every Go test, so a transposition survived both the suite and THE BAR.
- **Story 5.1** (`5f2d236`) — built the whole per-round machine. Its review found a refactor that silently dropped a defensive idempotency property. **Lesson:** when touching `parse.go`, preserve existing behaviour comments **and the properties they claim**; deleting a comment that asserts a property puts you on the hook for proving the property still holds.
- **Recurring Epic-4/5 lesson:** `reparse.go` is where widenings get dropped silently. Widen it in the same edit as `cli.go`.
- Baseline for this story is `3a99d8c` (HEAD, working tree clean).

## References

- Epic + AC: [epics.md:867-879](_bmad-output/planning-artifacts/epics.md#L867-L879) (Story 5.3); Epic 5 intro: [epics.md:823-825](_bmad-output/planning-artifacts/epics.md#L823-L825)
- FR-20 (entry frag / opening death / 1vX clutch rules, verbatim): [prd.md:305-312](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L305-L312); glossary: [prd.md:104-105](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#L104-L105)
- `clutches` jsonb shape `{"1":n,"2":n,…}`: [SOLUTION-DESIGN.md:152](_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#L152)
- `stat_row` derived shells (the three columns, nullable, already created): [0007_stat_row.sql:46](supabase/migrations/0007_stat_row.sql#L46); "Epic 5 widens the parser, never the schema": [0007_stat_row.sql:24-34](supabase/migrations/0007_stat_row.sql#L24-L34)
- Parser: `PlayerStat` [parse.go:50-71](worker/ingest/parse.go#L50-L71) · `roundStats` + commit-then-assign rationale [parse.go:89-123](worker/ingest/parse.go#L89-L123) · pure `kastQualified` (the classifier precedent) [parse.go:147-179](worker/ingest/parse.go#L147-L179) · `foldRounds` [parse.go:181-291](worker/ingest/parse.go#L181-L291) · `classifyWeirdKill` / `addWeirdKills` [parse.go:293-359](worker/ingest/parse.go#L293-L359) · the `events.Kill` handler + the post-round-kill decision [parse.go:429-473](worker/ingest/parse.go#L429-L473) · four-trap block + `roundStarted` guard + `RoundEnd` [parse.go:520-596](worker/ingest/parse.go#L520-L596)
- Single writer / upsert invariants: `StatRow` [db.go:127-175](worker/db/db.go#L127-L175) · `upsertStatRows` + the `status`/`match_id` exclusions [db.go:340-408](worker/db/db.go#L340-L408) · the nil-vs-empty precedent [db.go:290](worker/db/db.go#L290) and [db.go:314-328](worker/db/db.go#L314-L328)
- Both mapping sites: [cli.go:119-159](worker/ingest/cli.go#L119-L159) · [reparse.go:87-123](worker/ingest/reparse.go#L87-L123)
- Test patterns to extend: `cannedParse` + `assertDerivedStats` [cli_test.go:31-107](worker/ingest/cli_test.go#L31-L107) · AC-zero case [cli_test.go:212-268](worker/ingest/cli_test.go#L212-L268) · pure-classifier tests [parse_test.go:122-231](worker/ingest/parse_test.go#L122-L231) · `TestFoldRoundsDropsStrandedRounds` [parse_test.go:233](worker/ingest/parse_test.go#L233) · re-parse happy path [reparse_test.go:43](worker/ingest/reparse_test.go#L43)
- THE BAR harness to model `qa53` on (and delete): [worker/cmd/qa52/main.go](worker/cmd/qa52/main.go)
- Derived-stat feasibility (both "derive, well-understood"): [technical research Q3](_bmad-output/planning-artifacts/research/technical-cs2-demo-parsing-research-2026-06-29.md#L155-L167); [prd addendum §3](_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/addendum.md#L69-L70)
- Predecessor stories: [5-2a-blind-kills-live-source-amendment.md](_bmad-output/implementation-artifacts/5-2a-blind-kills-live-source-amendment.md) · [5-2-weird-demo-only-stat-derivation.md](_bmad-output/implementation-artifacts/5-2-weird-demo-only-stat-derivation.md) · [5-1-core-stat-derivation.md](_bmad-output/implementation-artifacts/5-1-core-stat-derivation.md)
- AD-2 single writer (SPINE:85-88) · AD-20 one-owner aggregation (every ratio lives in the 5.5 view) · AD-26 pinned parser
- Demo QA files (gzip `.dem.gz`, decompress before ingest): memory `demos-folder-location`; local live-QA env traps (WinNAT/Kong): memory `local-live-qa-env-traps`; 1v1 tournament format: memory `tournament-format-1v1-wingman`; mutation-testing rule: memory `mutation-test-suite-before-review`
- demoinfocs v5.2.0 verified in the local module cache: `RoundFreezetimeEnd` dispatch at `pkg/demoinfocs/game_events.go:363` and the mimicry branch at `pkg/demoinfocs/datatables.go:1101-1115` · `IsFreezetimePeriod` at `pkg/demoinfocs/game_state.go:196` · `Player.Team` / `IsAlive` / `Health` at `pkg/demoinfocs/common/player.go:26,83,321`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, bmad-dev-story workflow), 2026-07-21. Baseline `3a99d8c`.

### Debug Log References

**Automated gates (in `worker/`, after every change and again after the qa52/qaflash deletion):**
`gofmt -l .` empty · `go build ./...` 0 · `go vet ./...` 0 · `go test ./... -count=1` all packages ok.

**MANDATORY PER-EFFECT MUTATION TESTING (standing project rule).** 19 mutations applied one at a time by a
scripted harness (backup → mutate → `go test ./... -count=1` → restore), recording the NAMED test that
reddens. **18 killed, 1 equivalent mutant (proved, not waved through):**

| # | Mutation | Killed by |
|---|---|---|
| M01 | drop `EntryFrags` from `cli.go` first-parse map | `TestRunCLIHappyPathParsesAndUpserts` |
| M02 | drop `OpeningDeaths` from `cli.go` map | `TestRunCLIHappyPathParsesAndUpserts` |
| M03 | drop `Clutches` from `cli.go` map | `TestRunCLIHappyPathParsesAndUpserts` |
| M04 | **transpose** `EntryFrags`/`OpeningDeaths` in `cli.go` map | `TestRunCLIHappyPathParsesAndUpserts` |
| M05 | drop `EntryFrags` from `reparse.go` map | `TestRunReparseHappyPathReplacesAndBumpsGeneration` |
| M06 | drop `OpeningDeaths` from `reparse.go` map | `TestRunReparseHappyPathReplacesAndBumpsGeneration` |
| M07 | drop `Clutches` from `reparse.go` map | `TestRunReparseHappyPathReplacesAndBumpsGeneration` |
| M08 | remove the `!rs.live` gate | `TestRecordOpeningDuelLatchesFirstRealKill` |
| M09 | **invert** the live gate | `TestRecordOpeningDuelLatchesFirstRealKill` |
| M10 | remove the `rs.duelDone` re-latch guard | `TestRecordOpeningDuelLatchesFirstRealKill` |
| M11 | remove the `killer == victim` (suicide) guard | `TestRecordOpeningDuelLatchesFirstRealKill` |
| M12 | remove the `killer == 0` (world/bomb) guard | `TestRecordOpeningDuelLatchesFirstRealKill` |
| M13 | `aliveOn[t] == 1` → `<= 1` | **SURVIVED — equivalent mutant, see below** |
| M14 | `aliveOn[t] == 1` → `>= 1` | `TestClutchTrackerTransitionOnly` |
| M15 | remove the `X == 0` guard | `TestClutchTrackerTransitionOnly` |
| M16 | `award()` ignores the winners set | `TestClutchAwardOnlyWinningTeam` |
| M17 | cross-wire the fold (entry frag credited to the victim) | `TestFoldRoundsDropsStrandedRounds` |
| M18 | remove the `rs.duelDone` fold guard | `TestFoldRoundsDropsStrandedRounds` |
| M19 | `make(...)` → nil map in `clutchesJSON` | `db.TestClutchesJSON` |

**M13 is an EQUIVALENT mutant, and it is reported as one rather than argued away.** Widening the transition
test to `aliveOn[t] <= 1` lets the `aliveOn[t] == 0` (team wiped) case fall through — but a wiped team has no
living member for the survivor search to find, so `surv` stays 0 and the very next guard returns without
recording a candidate. Two independent guards enforce "a wiped team produces no candidate", so no test can
distinguish them; the mechanism is pinned in a comment at that guard in [parse.go](worker/ingest/parse.go) so
a future reader does not "simplify" the absorbing guard away. The property itself IS covered by a named test
(the 1v1 case of `TestClutchTrackerTransitionOnly`, where both teams reach 0 alive and no candidate appears).

**M17/M18 exist because the first fixture was symmetric.** `TestFoldRoundsDropsStrandedRounds` originally had
one duel latched each way, which made a TRANSPOSED fold produce identical totals for both players — the exact
swap the Story-5.2 review found surviving both the suite and THE BAR. A third duel latched the same way as
round 1 broke the symmetry; M17 then reddened. Recorded because the survivor came from the *test*, not the code.

**THE BAR — `go run ./cmd/qa53 ../demos`, 14 real `.dem.gz`, exit 0, ALL INVARIANTS HELD:**

- **🚨 GATE 1 — `events.RoundFreezetimeEnd` IS ALIVE: 221 events across the 14 demos.** **Σentry_frags = 204,
  not 0.** The Story-5.2a dead-field signature is absent, measured rather than assumed.
  **⚠ CORRECTED AT CODE REVIEW (2026-07-21).** This bullet originally explained the 221 as "per demo one more
  than its rounds played — the discarded MatchZy pre-match round". That explanation is **false and was
  self-refuting on its own arithmetic**: 204 rounds + 14 demos = 218, not 221. Re-measured per demo, most are
  at +1 but **three are at +2** (`alzate-kamurai` 22/21, `andrey-farkas` 17/15, `lejhone-misty` 13/11): a
  MatchZy restart can re-arm a round that never reached a `RoundEnd`, so freeze-time ends are **not** one per
  committed round. The headline numbers were right; the causal story attached to them was written rather than
  measured — the exact habit AC5 exists to forbid, landing this time on the verification layer instead of the
  parser. The re-arm path this uncovered is now handled explicitly (see `armLiveWindow`).
- **🚨 GATE 2 — the empty `clutches` is proven POSITIVELY: `T:1 CT:1` on all 221 freeze-time ends, every round
  of every demo.** No team is ever at ≥2 alive, so a "≥2 → exactly 1" transition is structurally impossible.
  Σclutches = 0 is therefore the correct result of the rule, not a silent failure. No round showed a team of
  ≥2, so the defect branch the story defined for GATE 2 was never entered.
- **Raw reconciliation, per demo, exact 1:1.** A second pass re-derives the duel with its own live window and
  latch and commits it under the game's own round index; its count equals Σentry_frags on 14/14.
  **⚠ CORRECTED AT CODE REVIEW (2026-07-21): this pass is SEPARATE, not INDEPENDENT.** It deliberately mirrors
  production's rule set (same live window, same three latch guards, same `roundStarted` guard, same trap-4
  assign, same `idx > final` bound), so any error in the RULE ITSELF reconciles perfectly in both — it could
  not, for instance, have detected the re-arm asymmetry that this review found. What it genuinely proves is
  that the production handlers are **wired up and non-dead** and that `foldRounds` neither loses nor duplicates
  a duel — the 5.2a failure mode, and worth having. It does **not** independently confirm the rule is correct. The per-kill-time-index breakdown shows **2** first-live-kills at index 0 on every demo (the
  discarded pre-match round plus its replay) collapsing to **1** committed duel — trap-4 working, visibly.
- **FR-20 invariants, 14/14:** `0 ≤ entry_frags ≤ kills` · `0 ≤ opening_deaths ≤ deaths` ·
  `Σentry_frags == Σopening_deaths` · `Σentry_frags ≤ RoundsPlayed` · every clutch key `X ≥ 1` (vacuous — no
  clutches exist).
- **Bonus cross-check the 1v1 format hands us:** with one player per side the round's first kill is its only
  kill, so `entry_frags == kills` and `opening_deaths == deaths` per player, and `Σentry_frags == RoundsPlayed`
  on all 14 demos. Both held exactly — a second, independent confirmation the latch fires on the right kill.
- **Regression net unperturbed, 14/14:** `Σkills == Σdeaths == RoundsPlayed` · `ΣRoundsWon == RoundsPlayed` ·
  the weird five reproduce 5.2a exactly (**knife 1 · wallbang 8 · smoke 2 · noscope 0 · blind 4**) with the 4
  blind kills at round indices **[3 5 9 13]**. These assertions are now carried by `qa53` (Task 10b).

### Completion Notes List

- **FR-20 derived three shipped through the single writer, no schema change.** `entry_frags`, `opening_deaths`
  and `clutches` are written only by the worker, through the one `upsertStatRows` shared by `RecordParse` and
  `RecordReparse`. No migration, no SQL file, no `app/`/`lib/`/`.ts` change. `validate.go` and the idle columns
  were not touched. **⚠ CORRECTED AT CODE REVIEW (2026-07-21):** this bullet claimed `git status` showed
  changes "only under `worker/` (plus this story file + sprint-status)". That was **false** — three UX/docs
  files were also modified by the Don Clutch retirement (`mockups/mock-leaderboards.html`,
  `.working/mock-leaderboards.html`, `EXPERIENCE.md`) and were missing from the File List entirely, mentioned
  only in prose further down. A reviewer trusting either the sentence or the File List would never have opened
  them. They are now listed under **Modified**. The *code*-scope claim itself holds: no non-`worker/` file
  changed that is code, schema or config.
- **The opening duel is a pure latch; the clutch is a pure state machine.** `recordOpeningDuel` and
  `clutchTracker` hold no demoinfocs type, so every guard is table-tested — the seam the 5.2 review had to
  retro-fit, applied up front here. Only two call lines live inside the `events.Kill` closure, and the two
  gates there deliberately differ (the duel excludes world/bomb/suicide deaths; the clutch alive count counts
  every death). The new `RoundFreezetimeEnd` handler is the sole reason post-round kills — which we
  deliberately COUNT for kills/deaths and the FR-19 weird five — cannot corrupt FR-20.
- **AC3, and what no Go test can reach.** `entry_frags`/`opening_deaths` are plain ints sitting
  unconditionally in the INSERT list, so a zero lands as `0`. `clutches` goes through `clutchesJSON`, whose
  `make(...)` renders a nil/empty tally as the empty object `{}` — never SQL `NULL`, never the jsonb scalar
  `null` — so Story 5.5's view reads `clutches->>'1'` with no NULL branch. **Disclosed limits:** the SQL
  `DO UPDATE` set-list and the positional `$1..$22` argument order are unreachable by the in-memory fakes
  (they store the `StatRow` struct and never execute SQL) — the accepted 4.6a/5.1/5.2 precedent; both lists
  were widened together and re-read line-by-line, and the `status` / `match_id` exclusions were verified
  still absent from BOTH lists after the edit. The 0-vs-NULL and `{}`-vs-`null` distinctions likewise exist
  only at the SQL level.
- **⚠ "Don Clutch / 1vX ganados" had NO POSSIBLE WINNER over this data — RAISED AND RESOLVED, 2026-07-21.**
  Transition-only (Cuatro's decision) plus an all-1v1 wingman tournament means `clutches` is `{}` for every
  player of every match — proven structurally by GATE 2 (`T:1 CT:1`, 221/221 rounds), not assumed: a
  **5.2a-class empty-award risk**. **Cuatro's call: retire the AWARD, keep the BUCKET.** Applied in this same
  session, outside the parser as the story required — the award was removed from the seed catalog
  ([mock-leaderboards.html](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/mockups/mock-leaderboards.html)
  + its `.working` draft) and from the a11y reveal example
  ([EXPERIENCE.md:145](_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md#L145)),
  with the binding decision recorded on `6-1-award-catalog-and-buckets` in sprint-status. The `clutch` bucket
  stays in FR-24 and in the check constraint, and this story's derivation is untouched and correct — a 5v5
  format repopulates the award with no code change. **NO code, schema, PRD or architecture change was made.**
  ⚠ One consequence left open for 6-1: the mockup now demonstrates 3 of the 4 buckets. Entry-frag awards are
  unaffected and well-populated (204 duels over 204 rounds) and are the natural candidate if `clutch` needs a
  visible award under the current format.
- **⚠ HANDOVER TO STORY 5.5 — rows parsed before this story keep `NULL` in all three columns** until their
  demo is re-parsed (`RunReparse` re-derives everything through this same upsert). Expected, and explicitly
  **not** a backfill — the same note Story 5.2 flagged forward.
- **Task 10b discharged:** `worker/cmd/qa52/` and `worker/cmd/qaflash/` are DELETED in this story's commit,
  as 5.2a promised. Their measurements are not lost — `qa53` carries the weird-five totals and the blind-kill
  round indices forward as hard assertions, and both reproduced exactly.
- **`worker/db/fake.go` needed no change** (confirmed by reading it): `FakeStatRecorder` stores the whole
  `StatRow`, so it widened automatically. `reparse_test.go` needed no edit either — it already calls
  `assertDerivedStats`, which now covers all fifteen derived fields.

### File List

**Modified**
- `worker/ingest/parse.go` — `PlayerStat` +3 fields; `roundStats` + `live`/`entryFrag`/`openingDeath`/`duelDone`/`clutch`/`clutchWon`; new pure `recordOpeningDuel`; new pure `clutchTracker` (`newClutchTracker`/`addAlive`/`kill`/`award`); new `events.RoundFreezetimeEnd` handler; two call lines in the `events.Kill` closure; the clutch award inside `RoundEnd`'s existing `WinnerState != nil` block; the FR-20 fold in `foldRounds`
- `worker/db/db.go` — `StatRow` +3 fields; new `clutchesJSON`; `upsertStatRows` widened to `$1..$22` (`$22::jsonb`) in the INSERT list, the values list and the `DO UPDATE` set-list
- `worker/ingest/cli.go` — first-parse map +3 fields; two stale FR-20/FR-21 comments corrected
- `worker/ingest/reparse.go` — re-parse map +3 fields; mirror-count warning updated (twelve → fifteen)
- `worker/ingest/parse_test.go` — `TestRecordOpeningDuelLatchesFirstRealKill`, `TestClutchTrackerTransitionOnly`, `TestClutchAwardOnlyWinningTeam`; `TestFoldRoundsDropsStrandedRounds` extended (asymmetric duels + an unlatched round + clutch fold); `TestFakeParserEchoesResultAndErr` switched to `reflect.DeepEqual` (`PlayerStat` is no longer comparable)
- `worker/ingest/cli_test.go` — `cannedParse` +3 distinct-per-field values per player (both with non-empty `Clutches`); `assertDerivedStats` widened to all fifteen; the AC-zero test extended to the derived three
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 5-3 status; `last_updated` corrected at review (it still described the CONTEXTED→ready-for-dev transition while the header and `development_status` said review)

**Modified — the Don Clutch retirement (added to this list at code review, 2026-07-21; they were changed but not listed)**
- `_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/mockups/mock-leaderboards.html` — the "Don Clutch" award row removed from the seed catalog
- `_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/.working/mock-leaderboards.html` — the same removal in the working draft
- `_bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md` — the a11y reveal example reworded off the retired award

**Modified — code review remediation (2026-07-21)**
- `worker/ingest/parse.go` — new pure `roundStats.armLiveWindow()` resetting BOTH halves of the FR-20 state on a re-arm (the handler now calls it); the three comments claiming a LIVING-roster guarantee `Participants().Playing()` does not provide corrected to "presumed-alive", with the accepted 5v5 limitation pinned at the handler
- `worker/ingest/parse_test.go` — new `TestArmLiveWindowResetsBothHalvesOfTheFR20State`; the `TestFakeParserEchoesResultAndErr` comment corrected (the `DeepEqual` switch was forced by compilation and compares an object with itself — it does not prove the map rides the seam)
- `worker/cmd/qa53/main.go` — GATE 2 can now FAIL (a team of ≥2 alive with Σclutches 0 appends a failure) via a new `maxTeamSize` helper; the header's "independent" claim corrected to describe what the second pass actually proves

**Added**
- `worker/cmd/qa53/main.go` — THE BAR (throwaway live-QA harness; GATE 1 + GATE 2 + raw reconciliation + the carried-forward 5.2/5.2a regression net)
- `worker/db/db_test.go` — `TestClutchesJSON` (the AC3 money test)

**Deleted (Task 10b, the cleanup 5.2a owed)**
- `worker/cmd/qa52/main.go`
- `worker/cmd/qaflash/main.go`

## Change Log

- 2026-07-21 — Story 5.3 implemented (FR-20 derived three: entry frags, opening deaths, 1vX clutches) via
  bmad-dev-story on baseline `3a99d8c`. Parser widened with a live-window gate, a pure opening-duel latch and
  a pure transition-only clutch state machine; single-writer upsert widened to `$22::jsonb` with `clutchesJSON`
  rendering `{}` rather than `null`; both mapping sites widened in the same edit. 19-mutation per-effect table
  run (18 killed, 1 proved-equivalent). THE BAR green on 14/14 demos: GATE 1 measured 221 `RoundFreezetimeEnd`
  events and 204 entry frags; GATE 2 measured `T:1 CT:1` on 221/221 rounds, proving the empty `clutches`
  structurally. `qa52`/`qaflash` deleted with their assertions carried into `qa53`. Status → review.
