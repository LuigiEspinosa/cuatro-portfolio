---
title: "Product Brief: CS2 Tournament App"
status: draft
created: 2026-06-29
updated: 2026-06-29
---

# Product Brief: CS2 Tournament App

## Executive Summary

This is a web app for running a Counter-Strike 2 tournament among a group of **8–16 friends** — a double-elimination bracket with **automated, demo-sourced stats** and a **provably-fair "awards roulette"** that hands out fun prizes far beyond the champion's trophy.

The core problem it solves is the one that kills most friends' tournaments: **once the two best players pull ahead, everyone else has nothing left to play for.** The app fixes this with **three independent reward tracks** — *Champion* (pure skill, the bracket), *Awards Roulette* (luck plus niche demo-only stats like knife kills and wallbangs), and *Meta-games* (predictions and participation). Skill, luck, and just showing up each pay out separately, so nobody is mathematically out of contention until the final ceremony.

What makes it buildable *now* is that the single hardest bet — turning a CS2 `.dem` demo file into granular per-player stats — has been **de-risked and proven**. A real 170 MB match demo parses in 3.4 seconds and yields every stat the product needs — including the weird ones that make the roulette special — each keyed to a player's Steam identity. The keystone risk is retired; the brief proceeds with automated stats as a **proven capability, not a hope.**

## The Problem

Running a real tournament for a friend group is more work and less fun than it should be:

- **Stats are manual and unreliable.** Someone screenshots scoreboards, retypes numbers, and the niche moments everyone actually remembers — the knife kill, the through-smoke spray-down, the 1v3 clutch — are never captured at all. There is no clean official CS2 stats API, so this data simply doesn't exist unless you go get it.
- **Only the elite have stakes.** A single-prize bracket means the moment your friend gets knocked out, you stop caring. Engagement collapses to the two best fraggers.
- **The real threat among friends isn't bad data — it's rigging *accusations*.** Whoever runs the draw gets accused of fixing it. Banter curdles into "this is rigged," and the admin has no way to prove otherwise.

Today the group copes with spreadsheets, Discord arguments, and a trophy that only one person was ever going to win. The cost is a tournament that fizzles before it finishes.

## The Solution

A tournament app organized around **three orthogonal reward tracks**, all fed by one source of truth — the demo file:

- **Champion track** — a double-elimination bracket with random seeding, tap/drag-to-advance, live updates, automatic byes for non-power-of-2 fields, and graceful no-show/forfeit handling.
- **Awards Roulette** — a chance-seeded ceremony that spotlights non-winners. Luck randomly selects *which* award categories are live this spin; stats *deterministically* decide who wins each one — luck sets the game, skill wins it. Categories stay hidden until the ceremony so they can't be gamed mid-tournament, with anti-sweep caps, anti-farm thresholds, and a pity draw so **nobody leaves empty-handed.**
- **Meta-games** — lightweight engagement (predictions, participation) that keep eliminated players and spectators invested to the end. *(Mostly post-v1 — see Scope.)*

Underneath all three, **match demos are parsed automatically** into per-player stats, and a **staged pending → approve ingestion** step makes the demo the single source of truth for stats, disputed scores, *and* the random seed of the roulette.

## What Makes This Different

- **The demo file is the keystone — one artifact, three jobs.** It is the stats source, the dispute/score referee, and the **provably-fair RNG seed** (the seed is a published hash of the final demo, reproducible client-side). One concentrated risk becomes one concentrated moat. The niche awards — knife kills, wallbangs, through-smoke, no-scopes — are native parsed fields, *proven extractable*, and they're what no spreadsheet tournament can offer.
- **Steam OAuth is a triple-win.** A single integration handles login, captures the SteamID64 that joins demo stats to the right player, and serves as the reconciliation surface — solving identity, attribution, and data quality at once.
- **Provably-fair draws defuse the real threat.** Among friends, reproducible client-side RNG turns "the draw is rigged" from an unanswerable accusation into a verifiable fact.
- **"Manufacture spotlight for non-winners" is a reusable capability** that powers the roulette today and Wrapped, nominations, and achievements later.

The honest moat is the demo pipeline plus the fairness model — not novel technology, but a sharp, proven application of it aimed squarely at why friends' tournaments fail.

## Who This Serves

A private group of **8–16 friends**, in four roles:

- **The fragger** — chasing the Champion bracket; wants accurate, live, trustworthy stats.
- **The casual / early-eliminated player** — the make-or-break user. The Awards and Meta tracks keep them with a live ladder to chase long after their bracket run ends.
- **The organizer / admin** — runs the event: manages the bracket, ingests and approves demos, runs the ceremony. Wants it to be low-effort and dispute-proof.
- **The spectator / viewer** — read-only access to follow the bracket, stats, and ceremony, mobile-first, from wherever they are.

## Success Criteria

- **Zero manual stat entry** — every match's stats come from its demo, automatically.
- **Everyone stays in it** — every player has at least one reward track live until the final ceremony; nobody finishes with zero shots at a prize (pity roulette guarantees it).
- **No unresolved rigging disputes** — every contested score resolves to the demo, and every roulette result is reproducible from the published seed.
- **One full event, run end-to-end on the app** — registration through champion crowning and awards ceremony, without falling back to spreadsheets.
- **Demo-to-stats latency is "soon enough"** — stats appear within minutes of a match's demo landing.

## Scope

**v1 is the must-have core loop and nothing more.** Everything below is traceable to the brainstorm's "must-have" tier.

### In (v1)

- **Roster + Steam OAuth**, with SteamID64 enforced at registration.
- **Double-elimination bracket** — random seed, tap/drag-to-advance, live updates, auto-byes (a bye is a badge, not a phantom stat win), no-show/forfeit with a grace timer.
- **Staged demo ingestion** as source of truth — pending → approve, easy re-parse/rollback, score derived from the demo where present. Accepts both **MatchZy auto-upload** and **admin manual upload**.
- **Awards Roulette** — four category buckets; two-stage draw (luck picks live categories, stats pick winners); one-trophy-per-spin cap with a hidden luck-meter (anti-sweep); rate vs. volume award classes; anti-farm thresholds plus AFK/idle DQ; provably-fair demo-hash seed; spinning-wheel ceremony; pity roulette.
- **Tournament-home timeline feed** as the single source of truth.
- **Admin vs. viewer** modes.
- **Mobile-first, responsive** throughout.

### Out (parked for later)

Real-money handling of any kind inside the app (v1 records award **winners only**; all money lives outside the app) · in-app scheduling, time zones, or reminders (coordinate in Discord) · season-persistence *features* — status tiers, claimable map segments, achievement log, hall of fame (the schema stays seasons-aware, but none are built) · Discord bot front door · prediction / house-chips economy · MVP eye-test voting · player Wrapped & shareable recap · fantasy fragger · gentle/privacy mode *(note: required before any public "shame" award ships)*.

## Key Decisions & Constraints

**Resolved this session:**

1. **Prizes — winners only, money stays out.** The app records who won which awards; it processes no payments and tracks no amounts. All buy-ins and payouts happen outside the app, sidestepping KYC, gambling-license, and tax exposure for a friends' pool.
2. **Mobile-first, responsive** — optimized for phones mid-match; admin still works on desktop.
3. **One-off event, seasons-aware schema** — build one tournament; don't preclude seasons in the data model, but build zero season-persistence features in v1.
4. **Demo acquisition — MatchZy backbone + manual fallback.** A self-hosted/rented CS2 server (~$10/mo) running MatchZy guarantees a demo per match; admin manual upload covers gaps. Valve MM share-codes are not relied on.
5. **Scheduling parked** — no in-app match windows or reminders in v1.

**Carried in (locked, not re-litigated):** double-elim for 8–16 players · stack: Next.js (App Router) + Supabase + Vercel, with a **Go parsing worker** (`demoinfocs-golang`; Node/TS `demoparser2` is a documented alternative deferred to Architecture) · stats automated from `.dem` files (**proven**) · the demo as single source of truth · Steam OAuth for identity.

**Hard constraints to honor (detail in addendum):** a 50–170 MB demo cannot be POSTed through a Vercel API route (≈4.5 MB body cap) and exceeds the Supabase free-tier 50 MB file cap — so the worker owns the demo and the **raw demo must be deliberately stored** (it's the dispute referee and the RNG seed), not dropped in a default bucket.

## Risks & Open Questions (for PRD / Architecture)

- **Valve format churn** — game updates occasionally break demo parsers for days. Mitigation: pin a parser version, retain raw demos, keep ingestion re-runnable (already in scope as re-parse/rollback). `demoinfocs-golang` patches fastest.
- **Parser-language fork** — Go (`demoinfocs-golang`, most battle-tested, second runtime) vs. Node/TS (`demoparser2`, one language across the stack). The PoC proves Go; the decision is an explicit Architecture-phase call.
- **Derived-stat definitions need spec'ing in the PRD** — exact rules for entry frag, 1vX clutch, anti-farm thresholds, AFK/idle DQ, and the ADR convention (the PoC uses overkill-capped damage to match the in-game scoreboard — confirm before it's enshrined in awards).
- **Demo storage is a real cost/architecture item**, not an afterthought — plan paid object storage from the start.

## Vision

If the one-off lands, the same spine grows into a **recurring league**: seasons with status tiers and a hall of fame, a **Discord bot as the real front door** (match DMs, result posts, prediction polls), per-player **Wrapped** recaps, a house-chips prediction economy with an Oddsmaker crown, and fantasy drafting for spectators. The seasons-aware schema chosen for v1 is the down payment on that future — but the bar for v1 is simply this: **run one tournament where everyone, not just the winner, has something to play for to the very end.**
