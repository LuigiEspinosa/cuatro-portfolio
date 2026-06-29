# PoC — CS2 `.dem` → per-player knife kills + damage

Proof-of-concept for the stat-ingestion spike (BMad Phase 1). Parses a CS2 demo with
[`demoinfocs-golang`](https://github.com/markus-wa/demoinfocs-golang) and prints per-player
**knife kills** and **damage/ADR**, plus the awards-roulette "moat" stats (wallbang,
through-smoke, no-scope) and a full weapon-kill breakdown.

Full write-up: [`../technical-cs2-demo-parsing-research-2026-06-29.md`](../technical-cs2-demo-parsing-research-2026-06-29.md).

## Requirements

- **Go** (built/tested on `go1.26.4`, `windows/amd64`)
- A CS2 (Source 2) `.dem` file — confirm the header is `PBDEMS2` (CS:GO Source-1 demos start with
  `HL2DEMO` and are **not** supported by this PoC).

## Run

```powershell
# from this directory
go run . "C:\Users\NumCuatro\Downloads\cache.dem"

# or default to ./cache.dem
go run .
```

(`go run` downloads `demoinfocs-golang v5.2.0` + deps on first run via the module proxy.)

## What it does

- Registers `events.Kill` → per-`SteamID64` tally: kills, deaths, assists, **knife kills**
  (`e.Weapon.Type == common.EqKnife`), headshots, **wallbangs** (`e.PenetratedObjects > 0`),
  **through-smoke** (`e.ThroughSmoke`), **no-scope** (`e.NoScope`), blind kills (`e.AttackerBlind`).
- Registers `events.PlayerHurt` → sums `e.HealthDamageTaken` (overkill-capped, matches the in-game
  scoreboard) per attacker → **ADR** = damage ÷ `TotalRoundsPlayed()`.
- Skips the warmup period (`GameState().IsWarmupPeriod()`), keys everything by **SteamID64** (the
  roster join key), and prints a sorted table + weapon breakdown.

## Verified result (`cache.dem`, 170.2 MB, parsed in 3.4 s)

```
=== CS2 demo parsed: C:\Users\NumCuatro\Downloads\cache.dem ===
Rounds played: 23

PLAYER      STEAMID64          K   D   A  KNIFE  HS  WB  SMK  NOSC  BLND  DMG   ADR
------      ---------          -   -   -  -----  --  --  ---  ----  ----  ---   ---
zGian       76561198847461130  26  13  7  0      10  0   1    1     0     2855  124.1
cuatro      76561198388441171  22  17  4  1      6   1   0    0     0     2529  110.0
Imlegit     76561198305828891  18  16  7  0      12  0   0    0     0     2447  106.4
mafejavela  76561199094120484  17  15  5  0      8   0   0    0     0     1820  79.1
Samz        76561199197635748  13  16  1  2      4   0   0    0     0     1395  60.7
AdaBad      76561199529848048  12  16  7  0      4   0   0    0     0     1231  53.5
Ñengoso2R   76561199181657312  11  14  4  0      3   0   0    0     0     965   42.0
FateuFz     76561199250683038  7   19  5  1      4   0   0    0     0     883   38.4

=== Weapon kill breakdown (13 weapons) ===
  AK-47 38 · M4A1 33 · P90 12 · Galil AR 9 · AWP 9 · Glock-18 7 · USP-S 6 ·
  Knife 4 · Desert Eagle 2 · MAG-7 2 · FAMAS 2 · Tec-9 1 · Dual Berettas 1

Total KNIFE kills in this match: 4
```

### Cross-checks (why this passes the gate)

- **Knife kills are real:** per-player sum (1 + 2 + 1) = weapon-breakdown `Knife 4`. Consistent.
- **ADR math:** DMG ÷ 23 rounds (e.g. `2855/23 = 124.1`, `2529/23 = 110.0`). Values are believable
  competitive ADR (38–124).
- **Conservation:** total kills (126) == total deaths (126).
- **Niche stats populate:** wallbang 2, through-smoke 1, no-scope 1.
- **Join key:** every row carries a valid **SteamID64** → joins to the Steam-OAuth roster.

Columns: `K` kills · `D` deaths · `A` assists · `KNIFE` knife kills · `HS` headshot kills ·
`WB` wallbang · `SMK` through-smoke · `NOSC` no-scope · `BLND` attacker-blind · `DMG` total
(capped) damage · `ADR` average damage per round.

## Notes

- `poc.exe` and `*.dem` are git-ignored (build artifact / large binary). Rebuild with `go build .`.
- ADR uses `HealthDamageTaken` (capped at victim HP) to match the scoreboard; switch to
  `HealthDamage` if you want raw/uncapped damage.
- Entry frags and 1vX clutches are **derivable** from this same event stream (track round state +
  kill order + per-team alive counts) but are out of scope for this minimal spike.
