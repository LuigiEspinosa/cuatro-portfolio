---
title: "Product Brief Addendum: CS2 Tournament App"
status: draft
created: 2026-06-29
updated: 2026-06-29
---

# Addendum — CS2 Tournament App

Depth that supports the brief but belongs downstream (PRD, Architecture). Sourced from the brainstorm (`brainstorm-cs2-tournament-2026-06-29`) and the demo-parsing spike (`research/technical-cs2-demo-parsing-research-2026-06-29.md`). Nothing here overrides the brief; it elaborates it.

## 1. Parser-language fork (Architecture-phase decision)

The spike proved the capability with **`demoinfocs-golang` (Go)** but kept a real alternative open. This is a deliberate fork to settle in Architecture, not a reopened question for the brief.

| | `demoinfocs-golang` (Go) ⭐ proven | `demoparser2` (Node/TS via `@laihoe/demoparser2`) |
|---|---|---|
| Reliability | Most battle-tested CS2 parser (FACEIT runs it); tracks Valve format changes fastest | Active and fast (Rust core), but less of a gold standard |
| Stack fit | Second runtime alongside the Next.js app | **One language across the whole stack** |
| API style | Event-stream — you compose aggregates | Query → ready-shaped rows (less aggregation code) |
| v1 deployment | Self-contained `.exe` for a local CLI; drop on Railway/Fly later, same code | Node worker, same ecosystem as the app |
| Proven on dev machine | **Yes** — 3.4 s on a real 170 MB demo | Reported, not first-hand verified |

**Decision criterion:** if "most battle-tested parser" outweighs "one language across the stack," stay on Go. If stack unification wins, switch to `demoparser2`. `awpy` (Python) is **not** a candidate — no 2026 release, transitive dependency on `demoparser2`, and a high-friction local toolchain.

## 2. Pipeline constraints (must be honored)

Demo parsing is CPU/RAM-heavy on large files, so it **cannot** run in a Vercel function. Two specific limits from the spike shape the architecture:

- **Vercel API-route body cap ≈ 4.5 MB.** A 50–170 MB `.dem` cannot be POSTed through a Next.js/Vercel route. The intuitive "MatchZy → Vercel API → Supabase Storage" flow is **broken**. The demo must go **directly** to the worker, or to Supabase Storage via a signed/resumable (TUS) upload, bypassing Vercel functions.
- **Supabase free-tier file cap = 50 MB**, below demo size. Either use a paid tier/bucket, or have the **worker own the demo** (parse, then archive) and write only the small parsed stat rows to Postgres.
- **Raw-demo retention is deliberate**, not incidental — the demo is the dispute referee *and* the RNG seed source, so it must be stored in real object storage, not a default free bucket. Treat this as a real cost line.

**Recommended v1 flow:**

```
MatchZy server records GOTV
        │  (.dem → worker directly, or to a Supabase Storage signed URL — never through a Vercel route)
        ▼
Parsing worker (Go binary, demoinfocs-golang)   ── local CLI for v1; Railway/Fly later
        │  parses in seconds → normalized per-player-per-match rows
        ▼
Supabase Postgres (writes via service-role key)
        ▼
Next.js app + Supabase Realtime → bracket / stats / roulette update live
```

**Worker host options (both run a Go binary fine):** Railway Hobby (~$5/mo, auto-sleeps, 10–30 s cold resume — good for bursty use) vs. Fly.io (~$11/mo, sub-second wake — good for always-on). **v1 simplification:** start with the **local Go CLI** (zero hosting cost, already proven); promote to a hosted worker only when fully hands-off auto-ingestion is needed. A parse takes seconds, so an admin running it locally per match is workable for an 8–16-person event.

**The join, concretely:** the worker writes `stat(match_id, steamid64, kills, deaths, adr, knife_kills, wallbangs, …)`, and the app joins `stat.steamid64 = roster.steamid64`. A SteamID64 captured via Steam OAuth at registration closes the loop.

## 3. Demo acquisition detail (MatchZy)

A self-hosted/rented CS2 server running [MatchZy](https://github.com/shobhit-pathak/MatchZy) is the **only path that guarantees a demo for every match**. Decision: MatchZy backbone + admin manual-upload fallback; Valve MM share-codes are a last resort, not a backbone (codes expire in ~7–14 days, cover only your own recent matches, and are manual per player). xplay.gg is skipped (no reliable programmatic per-match download).

Minimal MatchZy config:

```
tv_enable 1
matchzy_demo_path "demos/"
matchzy_demo_upload_url "https://<your-worker>/api/upload-demo"   # auto-POST on map end
```

Cost: a rented 10-slot CS2 server with MatchZy ≈ **$8–15/month** (DatHost, GameServers, etc.), one-time setup then hands-off. The staged pending → approve gate doubles as the dispute-resolution surface and absorbs both the auto-upload and manual-upload paths.

## 4. Stat coverage (proven) and derived stats to spec

Every required stat is extractable; the niche awards are **native parsed fields, not heuristics**. Confirmed live on the sample demo: knife kills (4), wallbangs (2), through-smoke (1), no-scope (1), plus K/D/A, ADR, HS%, MVPs, flash assists, utility/molotov/HE damage — every row keyed by a valid SteamID64 (e.g. `76561198847461130`).

**Derived stats (not native events; derivation is standard — PRD must define the exact rules):**

- **Entry frag** — first kill after round start.
- **1vX clutch** — track per-team alive counts across kills; trigger when a lone survivor wins the round.
- **Anti-farm thresholds** — min rounds/kills for comedy ("worst") awards.
- **AFK/idle DQ** — demo-detected idle disqualification so nobody farms a "worst" award by going AFK.
- **ADR convention** — the PoC uses overkill-capped damage (`HealthDamageTaken`) to match the in-game scoreboard. **Confirm this convention before it is enshrined in awards.**

## 5. Awards Roulette mechanics & fairness rules (PRD detail)

**Four category buckets:** skill · comedy/anti-skill · clutch/heroic · weird demo-only (knife kills, molly damage, wallbangs — the parser is what makes these possible).

**Two-stage draw:** luck randomly picks *which categories are live* this spin; stats *deterministically* pick each live category's winner. Categories stay blurred/mystery until the ceremony so players can't game toward a known award mid-tournament.

**Anti-sweep:** one-trophy-per-spin cap (a winner is removed from the remaining draws that spin); a hidden luck-meter weights draws toward players with empty shelves.

**Two award classes:** rate/normalized awards (early-eliminated players can still win) and volume awards (reward the grinders).

**Provably-fair seed:** RNG seed = hash of the final demo, published and reproducible client-side.

**Pity roulette:** anyone with zero awards enters a guaranteed consolation draw.

**Edge-case & fairness rules to specify in the PRD:**

- **Tie-break policy** set *before* each match, system-enforced and logged — no ad-hoc mid-match decisions.
- **Award-tie ladder** — a defined tie-break order; lean into fun **shared co-winner trophies** where appropriate.
- **Walkover/forfeit stat hygiene** — forfeits contribute no stats; normalize leaderboards for games actually played.
- **Prize-budget cap per player** — limit how many awards count toward the (out-of-app) prize budget so one stat-monster can't hoover everything.
- **Opt-in visibility / gentle mode** for the harshest negative ("shame") awards — required before any such award ships publicly, to prevent privacy harm.

## 6. Full risk register (from the spike)

1. **Valve format churn** — parsers occasionally break for days on game updates. Mitigation: pin a version, keep raw `.dem` files (re-parse later), treat ingestion as re-runnable. `demoinfocs-golang` patches fastest.
2. **Demo storage** is a real cost/architecture item — raw demos must be retained (dispute referee + RNG seed) and exceed the Supabase free-tier 50 MB cap.
3. **Parser-language fork** — deliberate Architecture-phase decision (see §1).
4. **Derived stats need spec'ing** — PRD work, not a build risk (see §4).
5. **ADR convention** — confirm overkill-capped damage before awards depend on it.
6. **Demo acquisition needs a server** — the cheapest *guaranteed* path is a rented CS2 server + MatchZy (~$10/mo).

> Verification note from the spike: parser API field/method names and all proof-of-concept numbers were produced first-hand against `demoinfocs-golang v5.2.0` and a real 170 MB CS2 demo. Library versions, vendor limits, and `demoparser2`/awpy field names reflect web research as of 2026-06-29 and should be re-confirmed at build time — CS2 and these tools update frequently.
