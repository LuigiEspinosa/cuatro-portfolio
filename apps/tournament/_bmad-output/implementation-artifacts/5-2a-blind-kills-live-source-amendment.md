---
baseline_commit: aac2df1
---

# Story 5.2a: `blind_kills` live-source amendment (FR-19 repair)

Status: done

## Story

As a viewer,
I want the blind-kill comedy award to actually have data,
so that FR-19's weird track is not published with a permanently empty column.

## Why this story exists

Story 5.2 shipped `blind_kills` off `events.Kill.AttackerBlind`, and THE BAR reported `blind 0` across all 14 demos. Both the story and its code review accepted that zero as **"proven by mode"**, on the reasoning that `AttackerBlind` needs a *teammate* to flash you and the QA demos are 1v1 duels.

**That reasoning was false.** In a 1v1 the *enemy* flashes you and you kill them anyway — that is exactly the "blind justice" the award is named for — and self-flashing counts too. Cuatro confirmed on 2026-07-21 that the **entire first tournament is 1v1 on wingman maps**, which removed the "we'll see it in a real 5v5" escape hatch and forced the question to be measured instead of assumed.

## Measured evidence (throwaway `worker/cmd/qaflash` probe, same 14 demos)

| Metric | Value |
|---|---|
| `FlashExplode` events | 172 |
| `PlayerFlashed` events | 67 |
| Non-warmup kills | 218 |
| Kills where the killer was genuinely blind (`Player.IsBlinded()`) | **4** |
| …of those, `e.AttackerBlind == true` | **0** |

Strongest single case: an `M4A4` kill in `alzate-kamurai` with **2.13 s of flash still remaining** — unambiguously blind — reporting `AttackerBlind = false`.

`IsBlinded()` (≡ `FlashDurationTimeRemaining() > 0`) was used rather than the raw `FlashDuration` field, because `FlashDuration` is the *assigned* duration and can persist stale after the effect expires. The finding survives the stricter test.

This is **specific to `AttackerBlind`**, not a broken pipeline: `wallbang` (8) and `through_smoke` (2) fire normally on the same data. It contradicts Story 5.2's Dev Note asserting all four CS2 flags "are populated for Source 2 demos".

**Consequence had it shipped:** `blind_kills` reads 0 for every player, all tournament — an award with no possible winner and no error anywhere to reveal it.

## Acceptance Criteria

**AC1 — `blind_kills` derives from the live killer flash state.**
**Given** `events.Kill.AttackerBlind` is measurably dead on our demos,
**When** the worker derives a match,
**Then** a kill counts as blind iff the KILLER was blind at trigger time per the parser's own flash state (`Killer.IsBlinded()`), and `e.AttackerBlind` has **no** effect on the result in either direction.

**AC2 — the classifier stays pure and mutation-testable.**
**Given** the Story-5.2 review's hard-won property that the weird-five decision is unit-testable,
**When** the blind source moves to live parser state,
**Then** `classifyWeirdKill` must **not** dereference the player: `IsBlinded()` → `FlashDurationTimeRemaining()` reads the unexported `demoInfoProvider`, so a test-constructed `common.Player` panics. The state is evaluated by the caller and passed in as a plain `bool`.

**AC3 — no schema change, single writer unchanged.**
Same column, same `upsertStatRows`, same two mapping sites. `supabase/migrations/`, `app/`, `lib/` untouched.

_Traces: FR-19 · AD-2 · amends Story 5.2 AC1_

## Spec amendment

Story 5.2 AC1 required each stat be "tallied from a **native** `events.Kill` field, never a heuristic". `Killer.IsBlinded()` is **not** a heuristic — it is the parser's own tracked flash state, strictly more accurate than the dead event field — but it is **not** an `events.Kill` field either. **AC1 is amended for `blind_kills` only:** native parser state is permitted where the corresponding `events.Kill` field is *demonstrated* dead. The other four remain on their native event fields, unchanged.

## Implementation

- `worker/ingest/parse.go` — `classifyWeirdKill(e events.Kill, killerBlind bool)`; `blind` now comes from the parameter. Call site: `cur.addWeirdKills(k, classifyWeirdKill(e, e.Killer != nil && e.Killer.IsBlinded()))`.
- `worker/ingest/parse_test.go` — `TestClassifyWeirdKillBranches` widened with the `killerBlind` parameter and **two dead-input cases**: `e.AttackerBlind = true` must NOT grant blind on its own, and `e.AttackerBlind = false` must NOT suppress a live blind kill. Those two exist so nobody "restores" the field later thinking it is redundant.
- `worker/cmd/qa52/main.go` — the raw second pass now filters on the live source and prints `deadAttackerBlindField=…` alongside, so the dead field stays visible in the QA output rather than being quietly forgotten.

No change to `db.go`, `cli.go`, `reparse.go` — the column, the writer and both mapping sites are untouched.

## Verification

**Gates** (in `worker/`): `gofmt -l .` empty · `go build ./...` 0 · `go vet ./...` 0 · `go test ./... -count=1` all ok.

**Mutation testing — 4 mutants, 3 reddened, 1 survived (disclosed):**

| Mutation | Result | Reddened test |
|---|---|---|
| revert `blind` to the dead `e.AttackerBlind` | ✅ REDDENED | `TestClassifyWeirdKillBranches/blind_comes_from_killerBlind` |
| hardcode `blind: false` | ✅ REDDENED | `TestClassifyWeirdKillBranches/blind_comes_from_killerBlind` |
| hardcode `blind: true` | ✅ REDDENED | `TestClassifyWeirdKillBranches/knife` |
| drop `e.Killer.IsBlinded()` at the call site | ⚠ SURVIVED | *(none — the closure seam)* |

The survivor is the same irreducible seam Story 5.2 disclosed: one expression inside the `events.Kill` closure that `FakeParser` cannot drive. **THE BAR is now positive coverage for it** — dropping it takes `blind` from 4 back to 0, which the live run shows directly.

**THE BAR** — `go run ./cmd/qa52 ../demos`, all 14 demos, `ALL INVARIANTS HELD`:

- Aggregate: **knife 1 · wallbang 8 · smoke 2 · noscope 0 · blind 4** (was `blind 0`).
- All 4 blind kills sit at round indices **3, 5, 9, 13** — none in the discarded pre-match round, so trap-4 is unaffected.
- Reconciliation still exact: **29 raw flagged − 14 at round 0 = 15 counted = 1 + 8 + 2 + 4.**
- 5.1 regression net unperturbed: `Σkills == Σdeaths == RoundsPlayed` and `ΣRoundsWon == RoundsPlayed` on 14/14.
- Every counted blind kill prints `deadAttackerBlindField=false`, i.e. the QA output itself carries the proof.

## Still open

- **`no_scope_kills` remains 0, and that is NOT the same situation.** The probe found only **16 scoped-weapon kills across 218** (AWP/SSG08/G3SG1/SCAR-20), none no-scoped. Zero out of 16 is an ordinary sample with no positive counter-evidence — unlike `AttackerBlind`, where blind kills demonstrably existed and the flag still read false. Left alone deliberately; re-check when the tournament produces AWP volume.
- **Throwaway harnesses** `worker/cmd/qa52/` and `worker/cmd/qaflash/` are committed so the evidence stays recoverable. Delete both in a follow-up.

## Change Log

| Date | Change |
|---|---|
| 2026-07-21 | `blind_kills` moved off the dead `events.Kill.AttackerBlind` onto the live `Killer.IsBlinded()`, keeping `classifyWeirdKill` pure by passing the state in. Measured cause: 172 flash detonations and 4 genuinely-blind kills, all reporting `AttackerBlind=false`. THE BAR now reports `blind 4` with exact reconciliation. Story 5.2 AC1 amended for this column only. |
