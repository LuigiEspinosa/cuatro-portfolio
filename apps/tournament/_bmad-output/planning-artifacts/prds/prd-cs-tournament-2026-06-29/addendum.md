---
title: CS2 Tournament App — PRD Addendum (Technical Depth)
status: final
created: 2026-06-29
updated: 2026-06-29
---

# PRD Addendum — CS2 Tournament App

Downstream technical depth that informs the PRD's requirements but is implementation "how," not capability "what." This is **input to the Architecture and UX phases**, not a competing source of truth. The PRD (`prd.md`) governs requirements; this document preserves the decisions, options, and mechanisms behind them. Sourced from the Phase-1 [brief addendum](../../briefs/brief-cs-tournament-2026-06-29/addendum.md) and [demo-parsing research spike](../../research/technical-cs2-demo-parsing-research-2026-06-29.md), carried forward and reconciled with this session's decisions.

## 1. Parser-language fork (Architecture decision)

The PoC proved Go; the fork stays open for Architecture to settle on one criterion: *if "most battle-tested parser" outweighs "one language across the stack," stay on Go; if stack unification wins, switch.*

| Dimension | `demoinfocs-golang` (Go) ⭐ proven | `demoparser2` (Node/TS, Rust core) |
|---|---|---|
| Reliability | Most battle-tested CS2 parser (FACEIT); tracks Valve format changes fastest | Active, fast; less of a gold standard |
| Stack fit | Second runtime alongside Next.js | One language across the whole stack |
| API style | Event-stream — compose aggregates yourself | Query → ready-shaped rows (less aggregation code) |
| Proven here | **Yes** — 170 MB demo in ~3.4 s, ~257 MB RAM, `v5.2.0` | Reported, not first-hand verified |

`awpy` (Python) is excluded — no 2026 release, transitive dependency on `demoparser2`, high-friction local toolchain. **Tie-in to FR-20/FR-21:** whichever parser is chosen must expose per-tick player positions (needed for AFK/idle detection) and the native fields the weird stats rely on; `demoinfocs-golang` does both.

## 2. Pipeline & transport (maps to FR-11, FR-15, §9 Constraints)

Three hard limits drive the shape:

- **Vercel route body cap ≈ 4.5 MB** — a 50–170 MB `.dem` cannot be POSTed through a Next.js/Vercel function. The intuitive "MatchZy → Vercel API → Supabase Storage" path is **broken**.
- **Supabase free-tier file cap = 50 MB** — below typical demo size.
- **Raw-demo retention** — required (dispute referee + RNG seed), so real object storage, treated as a cost line.

**Recommended v1 flow:**

```
MatchZy server records GOTV
   │  .dem → worker directly, OR → storage via signed/resumable (TUS) upload
   │  (never through a Vercel function)
   ▼
Parsing worker (Go binary, demoinfocs-golang)   ── local CLI for v1; Railway/Fly later
   │  parses in seconds → normalized per-player-per-match Stat rows
   ▼
Supabase Postgres (writes via service-role key; bypasses RLS)
   ▼
Next.js + Supabase Realtime → bracket / stats / roulette / feed update live
```

**Worker hosting (Open Question 2):** local Go CLI (zero cost, proven, Admin runs per Match) is the v1 default; promote to **Railway Hobby** (~$5/mo, auto-sleeps, 10–30 s cold resume) or **Fly.io** (~$11/mo, sub-second wake) when fully hands-off auto-ingestion is wanted. This choice determines whether MatchZy auto-upload (FR-11 happy path) is live at v1 or whether v1 leans on Admin-run parsing with Manual upload.

**The join:** worker writes `stat(match_id, steamid64, kills, deaths, adr, knife_kills, wallbangs, through_smoke, no_scope, …)` and the app joins `stat.steamid64 = roster.steamid64`; SteamID64 captured at Steam OAuth registration closes the loop (FR-2). Also persist `match(match_id, demo_path, demo_hash, …)` for FR-15/FR-27.

## 3. Stat extraction — proven fields (maps to FR-18, FR-19, FR-20)

All verified first-hand against `demoinfocs-golang v5.2.0` on a real 170 MB demo (conservation check passed: 126 kills = 126 deaths).

| Stat | Field / method | Status |
|---|---|---|
| Kills / deaths / assists | `events.Kill{Killer, Victim, Assister}` | ✅ confirmed |
| Damage / **ADR** | `events.PlayerHurt.HealthDamageTaken` (overkill-capped), summed ÷ rounds played | ✅ confirmed (124.1 verified) |
| Headshots / HS% | `events.Kill.IsHeadshot` | ✅ confirmed |
| Knife kills | `e.Weapon.Type == common.EqKnife` | ✅ live (4) |
| Wallbangs | `e.IsWallBang()` / `e.PenetratedObjects > 0` | ✅ live (2) |
| Through-smoke | `e.ThroughSmoke` | ✅ live (1) |
| No-scope | `e.NoScope` | ✅ live (1) |
| Blind kills | `e.AttackerBlind` | ✅ confirmed |
| Flash assists | `events.Kill.AssistedFlash` | ✅ confirmed |
| Utility (molly/HE) damage | `events.PlayerHurt` filtered by weapon + `events.HeExplode`/inferno | ✅ confirmed |
| MVPs | `events.RoundMVPAnnouncement` | ✅ confirmed |
| **Entry frag** (FR-20) | first `events.Kill` after `RoundFreezetimeEnd` | 🔨 derive (simple) |
| **1vX clutch** (FR-20) | track per-team alive counts on `Kill`; fire when lone survivor's team wins (elim or objective) | 🔨 derive (standard) |
| **KAST** (FR-18) | per-round K/A/S/Traded; trade window = 5 s | 🔨 derive |

PoC source: `_bmad-output/planning-artifacts/research/poc-cs2-demo-parse/main.go` (registers `Kill` + `PlayerHurt`, tallies by SteamID64).

## 4. AFK/idle detection — parsing extension (maps to FR-21, risk #2 below)

FR-21's AFK/idle DQ needs per-round activity per Player: **no movement beyond a small position epsilon AND no shots/utility/damage** for the whole round. `demoinfocs-golang` exposes per-tick player positions and the relevant action events, so this is feasible — but the PoC did **not** exercise position tracking, so it is unproven and adds parse cost (per-tick sampling vs. event-only). Architecture should: (a) pick a sampling cadence and epsilon, (b) confirm the added parse time stays within SM-5, (c) decide movement-vs-action precedence. Defaults to tune: idle-round = position delta < epsilon for the round AND zero action events; match DQ at ≥ 50% idle rounds (Open Question 5).

## 5. Awards Roulette — seed & PRNG mechanism (maps to FR-25, FR-26, FR-27, FR-29)

The provably-fair guarantee rests on a clean split: **luck is seeded and deterministic; winners are pure functions of the stat snapshot.**

- **Seed.** `seed = SHA-256(final_demo_bytes)` where the final demo is the championship-deciding Match's retained `.dem` (FR-15). Published with results.
- **PRNG.** A deterministic stream PRNG keyed by `seed` (e.g., a standard CSPRNG/hash-stream — exact algorithm is an Architecture choice, but it **must be published and client-reproducible**, so prefer a widely-available primitive over a language-specific RNG). The PRNG drives **only**: (a) Stage-1 live-category selection per Spin, and (b) the luck-meter weighting (anti-sweep bias toward empty shelves).
- **Winners (deterministic).** For each live category, the winner is the eligible Player (passes FR-21 floors) with the best deciding-stat value in the locked snapshot; ties resolve via the FR-29 ladder. No randomness.
- **Anti-sweep cap.** Within a Spin, a Player caps at one trophy; overflow re-resolves to the next eligible Player via FR-29. Because every step (PRNG stream position, snapshot, ladder) is deterministic, the full Ceremony reproduces from `(final demo + snapshot + published algorithm)`.
- **Reproduction artifact.** Publish: the seed, the locked stat snapshot, the catalog (buckets/classes/deciding-stats/floors), and the algorithm/version. A client re-run must yield identical live-category sets, winners, and Pity outcomes.

**Open mechanism detail for UX/Architecture:** number of Spins and how the catalog maps to them (Open Question 7); whether the luck-meter state is revealed *after* the event for transparency.

## 6. Risk register (carried forward from the spike)

| # | Risk | Likelihood / Impact | Mitigation | PRD tie-in |
|---|---|---|---|---|
| 1 | **Valve format churn** — parsers break for days on game updates | High / High | Pin parser version; retain raw demos; keep Ingestion re-runnable; `demoinfocs-golang` patches fastest | FR-14, FR-15, NFR reliability |
| 2 | **Demo storage cost & architecture** — raw demos retained, exceed free 50 MB cap | High / Medium | Paid object storage budgeted as a cost line; or worker-owns-demo (parse then archive), write only small stat rows | FR-15, §9 |
| 3 | **Parser-language fork** — Go vs `demoparser2` not yet chosen | High / High | Deliberate Architecture-phase decision on battle-tested vs stack-unification | §1, Open Question 3 |
| 4 | **Derived stats need spec'ing** — entry frag, 1vX, anti-farm, AFK, ADR | High / Medium (now mostly closed) | **Resolved in PRD §4.4** (FR-18–FR-21); thresholds remain tunable | FR-18–FR-21, Open Question 5 |
| 5 | **ADR convention** — PoC uses overkill-capped to match scoreboard | Medium / High if changed late | **LOCKED**: overkill-capped, user-confirmed; do not change post-launch or all ADR Awards break | FR-18 |
| 6 | **Demo acquisition needs a server** — cheapest guaranteed path is rented CS2 server + MatchZy (~$8–15/mo) | High / Medium | Rented 10-slot server + MatchZy; Manual upload fallback; do not rely on Valve MM share-codes (7–14 day expiry) | FR-11, §9 |

## 7. Verification note (from the spike)

Parser API field/method names and all PoC numbers were produced first-hand against `demoinfocs-golang v5.2.0` and a real 170 MB CS2 demo (`PBDEMS2` / Source 2). Library versions, vendor limits, and `demoparser2`/`awpy` field names reflect web research as of 2026-06-29 and should be re-confirmed at build time — CS2 and these tools update frequently.
