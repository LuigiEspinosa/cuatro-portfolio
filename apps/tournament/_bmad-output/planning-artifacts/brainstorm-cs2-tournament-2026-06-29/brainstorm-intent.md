# Brainstorm Intent — CS2 Tournament Website

One-line context: Distilled intent for a Counter-Strike 2 tournament website for a group of 8–16 friends (Next.js + Supabase on Vercel; double-elimination; automated stats via parsing CS2 `.dem` demo files). Date: 2026-06-29. Source: brainstorming session (Morphological Analysis, Cross-Pollination, SCAMPER, Reverse Brainstorming).

## Product spine — the three reward tracks

The product is organized around **three independent reward tracks**, so a non-elite player always has a live ladder to chase even after their friend is eliminated:

1. **Champion** — pure skill; winning the double-elim bracket.
2. **Awards Roulette** — luck + niche, demo-only stats; a chance-seeded ceremony that spreads spotlight beyond the best fraggers.
3. **Meta-games** — predictions, fantasy, and streaks; engagement for spectators and casuals.

Why this is the organizing principle: a friends' tournament dies when only the two best players have anything to play for. Three orthogonal ladders mean skill, luck, and participation each pay out independently — nobody is mathematically out of contention until the very end.

## Key strategic insights (synthesis)

- **The demo file is the product keystone.** A single artifact is the stats source, the dispute/score referee, AND the provably-fair RNG seed. One risk concentrated into one moat.
- **Steam OAuth is a triple-win.** It is login, SteamID64 stat-matching, and the reconciliation surface — one integration solves identity, attribution, and data-quality.
- **"Manufacture spotlight for non-winners" is a reusable capability.** Wrapped, nominations, achievement log, and pity-roulette are all one underlying move applied in different places.
- **Provably-fair seeded draw is a trust feature.** Among friends the real threat is rigging *accusations*, not bad stats — reproducible client-side RNG defuses that.
- **The Discord bot is the real front door.** Match-time DMs, result posts, prediction polls, and announcements live where the group already hangs out.

## Awards Roulette — design intent

- **Four category buckets:** skill · comedy/anti-skill · clutch/heroic · weird demo-only (knife kills, molly damage, wallbangs — the demo parser is the moat that makes these possible).
- **Two-stage draw:** luck randomly picks *which categories are live* this spin; stats *deterministically pick the winner* of each live category (luck sets the game, skill wins it). Categories stay blurred/mystery until the ceremony so players can't game toward a known award mid-tournament.
- **One-trophy-per-spin cap:** a winner is removed from the remaining draws that spin; a hidden luck-meter weights draws toward players with empty shelves (anti-sweep).
- **Two award classes:** *rate/normalized* awards (anyone, including early-eliminated players, can win) and *volume* awards (reward the grinders).
- **Anti-farm thresholds:** min rounds/kills on comedy awards plus demo-detected AFK/idle DQ, so nobody farms "worst" by going AFK.
- **Provably-fair seed:** RNG seed = hash of the final demo, published and reproducible client-side.
- **Ceremony:** a literal spinning-wheel reveal at the end, dramatic per-category flip, recap- and stream-ready.
- **Pity roulette:** anyone with zero awards enters a guaranteed consolation draw — nobody leaves empty-handed.

## Feature set tiered for scope

### v1 — must-have core loop
- Roster + **Steam OAuth** (SteamID64 enforced at registration).
- **Double-elim bracket:** random seed, drag/tap-to-advance, live updates, auto byes for non-power-of-2 (a bye is a badge, not a phantom stat win), no-show/forfeit handling with grace timer.
- **Staged demo ingestion** as source of truth: pending → approve flow, easy re-parse/rollback; score derived from the demo where it exists.
- **Awards Roulette** (per the design-intent section above).
- **Tournament-home timeline feed** as the single source of truth.
- **Admin vs viewer** modes.

### Later — high-value extensions
- Prediction game / casino house-chips economy (Oddsmaker crown for best predictor).
- **Discord bot** front door (DMs, result posts, polls, announcements; feed mirrored to Discord).
- MVP voting — eye-test (human vote) alongside numbers (stat MVP), surfacing disagreements as debate fuel.
- Player **"Wrapped"** + permanent shareable recap page.
- **Season persistence:** status tiers (Bronze–Diamond), claimable map segments, RuneScape-style achievement log, hall of fame.
- Fantasy fragger (spectators draft players, earn their stats).
- Gentle / privacy mode.

## Edge cases & fairness rules to specify in the PRD

- **Tie-break policy** set *before* each match, system-enforced and logged (no ad-hoc mid-match decisions).
- **Award-tie ladder:** a defined tie-break order; lean into fun **shared co-winner trophies** where appropriate.
- **Walkover/forfeit stat hygiene:** forfeits contribute no stats; normalize leaderboards for games actually played.
- **Prize-budget cap per player:** limit how many awards count toward the real prize budget so a stat-monster can't hoover all prizes.
- **Opt-in visibility / gentle mode** for the harshest negative ("shame") awards to prevent privacy harm.

## Top risk

CS2 `.dem` demo parsing has **no clean official API** — it is simultaneously the **biggest risk** and the **moat**. De-risk it with a dedicated **parsing spike** before building any feature around it; the entire product (stats, dispute resolution, RNG seed) depends on this one capability.

## Open questions for the brief

- How should **real-money prizes** be handled among friends (collection, payout, legal/tax sensitivity)?
- Is the experience **mobile-first** (friends on phones during matches) or desktop-first?
- Do we need **time-zone-aware scheduling** for match windows and reminders?
- How many friends realistically, and is this a **one-off event or recurring seasons** (drives how much season-persistence to invest in)?
